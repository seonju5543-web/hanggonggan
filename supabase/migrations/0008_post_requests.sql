-- ============================================================
-- 게시 요청 — 기관 담당자가 공고 게시를 요청하고 관리하는 곳 (2026-11-21 개발자 지시)
-- ------------------------------------------------------------
-- 개발자 말 그대로: *"게시 요청 탭에는 게시물 관리(게시 요청 현황, 정보 수정, 댓글 작성 등
-- 관리 기능을 이용할 수 있는 탭)이 존재해야 하고 담당자 로그인이 따로 존재해야 해."*
--
-- 누가 쓰는가 — 장학금·대외활동 공고를 한대장에 올리고 싶은 **기관 담당자**(학교 장학팀·재단·지자체).
--   앱(post-request.js)의 「담당자 로그인」은 학생 로그인과 **다른 세션**이다(기기 안 열쇠가 다르다).
--   계정 자체는 같은 Supabase 인증을 쓰고, 담당자라는 표시는 아래 post_staff 한 줄이다.
--
-- 🔴 지키는 것
--   ① 담당자는 **자기 요청만** 보고 고친다(RLS).
--   ② 상태(접수 → 검토 중 → 게시됨/보완 요청/반려)는 **운영자만** 바꾼다 — 담당자가 스스로
--      '게시됨'으로 바꿀 수 없어야 한다(운영 원칙 2 '정식 등록은 개발자 컨펌 후').
--      예외는 하나: 보완 요청을 받은 담당자가 내용을 고치면 다시 '접수'로 돌아간다(트리거가 한다).
--   ③ 게시된 요청은 담당자가 고치거나 지우지 못한다 — 고칠 것은 댓글로 요청한다.
--   ④ 댓글은 지우거나 고치지 못한다(주고받은 기록이다). 운영자 댓글은 대시보드·service_role 로만 넣는다.
--   ⑤ 운영자(대시보드 SQL·service_role)는 JWT 사용자가 없다(auth.uid() 가 null) — 트리거는 그때 손을 뗀다.
--      anon 열쇠만으로는 RLS 정책이 하나도 안 맞아 아무것도 못 한다.
--
-- ⚠️ 이 표는 **학생 앱 데이터가 아니다** — 게시 요청이 '게시됨'이 돼도 앱에 저절로 실리지 않는다.
--    운영자가 보고 data/registered.json 등에 정식 등록하는 길(tools/admin-apply.mjs)은 그대로다.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 실행.
-- ============================================================

-- ── 담당자 표시 ─────────────────────────────────────────────
create table if not exists public.post_staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  org         text not null,                 -- 기관명
  name        text not null,                 -- 담당자 이름
  contact     text not null,                 -- 연락처(전화 또는 이메일)
  verified    boolean not null default false,-- 운영자가 기관 담당자임을 확인했는가(운영자만 바꾼다)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint post_staff_org_ck     check (char_length(org) between 1 and 100),
  constraint post_staff_name_ck    check (char_length(name) between 1 and 50),
  constraint post_staff_contact_ck check (char_length(contact) between 3 and 100)
);

alter table public.post_staff enable row level security;

drop policy if exists "담당자는 자기 정보만 읽는다" on public.post_staff;
create policy "담당자는 자기 정보만 읽는다" on public.post_staff
  for select using (auth.uid() = user_id);
drop policy if exists "담당자는 자기 정보만 만든다" on public.post_staff;
create policy "담당자는 자기 정보만 만든다" on public.post_staff
  for insert with check (auth.uid() = user_id and verified = false);
drop policy if exists "담당자는 자기 정보만 고친다" on public.post_staff;
create policy "담당자는 자기 정보만 고친다" on public.post_staff
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- verified 는 운영자만 — 담당자가 고치면 원래 값으로 되돌린다
create or replace function public.post_staff_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then new.verified := old.verified; new.created_at := old.created_at; end if;
    if tg_op = 'INSERT' then new.verified := false; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists post_staff_guard on public.post_staff;
create trigger post_staff_guard before insert or update on public.post_staff
  for each row execute function public.post_staff_guard();

-- ── 게시 요청 ───────────────────────────────────────────────
create table if not exists public.post_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null default '장학금',   -- 장학금 | 대외활동 | 공모전
  org         text not null,                   -- 주최·주관 기관
  title       text not null,                   -- 공고 제목
  url         text not null,                   -- 원문 링크(그 공고 하나)
  deadline    date,                            -- 마감일(모르면 비움 — 지어내지 않는다)
  target      text,                            -- 지원 대상
  amount      text,                            -- 지원 금액·혜택(원문 그대로)
  memo        text,                            -- 운영자에게 하는 말
  status      text not null default 'submitted',
  -- submitted(접수) → reviewing(검토 중) → published(게시됨) | needs_info(보완 요청) | rejected(반려)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint post_requests_kind_ck   check (kind in ('장학금', '대외활동', '공모전')),
  constraint post_requests_status_ck check (status in ('submitted', 'reviewing', 'needs_info', 'published', 'rejected')),
  constraint post_requests_org_ck    check (char_length(org) between 1 and 100),
  constraint post_requests_title_ck  check (char_length(title) between 2 and 200),
  constraint post_requests_url_ck    check (url ~* '^https?://' and char_length(url) <= 1000),
  constraint post_requests_target_ck check (target is null or char_length(target) <= 1000),
  constraint post_requests_amount_ck check (amount is null or char_length(amount) <= 300),
  constraint post_requests_memo_ck   check (memo is null or char_length(memo) <= 2000)
);
create index if not exists post_requests_user_at on public.post_requests (user_id, created_at desc);
create index if not exists post_requests_status on public.post_requests (status, created_at);

alter table public.post_requests enable row level security;

drop policy if exists "담당자는 자기 요청만 읽는다" on public.post_requests;
create policy "담당자는 자기 요청만 읽는다" on public.post_requests
  for select using (auth.uid() = user_id);
-- 🔴 담당자 표시(post_staff)가 있는 사람만 요청한다 — 학생 계정 토큰으로 요청을 쌓지 못하게
drop policy if exists "담당자는 자기 이름으로만 요청한다" on public.post_requests;
create policy "담당자는 자기 이름으로만 요청한다" on public.post_requests
  for insert with check (
    auth.uid() = user_id and status = 'submitted'
    and exists (select 1 from public.post_staff s where s.user_id = auth.uid())
  );
drop policy if exists "담당자는 게시 전 자기 요청만 고친다" on public.post_requests;
create policy "담당자는 게시 전 자기 요청만 고친다" on public.post_requests
  for update using (auth.uid() = user_id and status in ('submitted', 'needs_info'))
  with check (auth.uid() = user_id);
drop policy if exists "담당자는 게시 전 자기 요청만 거둔다" on public.post_requests;
create policy "담당자는 게시 전 자기 요청만 거둔다" on public.post_requests
  for delete using (auth.uid() = user_id and status in ('submitted', 'needs_info', 'rejected'));

-- 상태는 운영자만 — 담당자가 고치면 상태는 그대로, 보완 요청 중이었으면 다시 '접수'로
create or replace function public.post_requests_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.status := 'submitted';
      new.created_at := now();
    else
      new.user_id := old.user_id;
      new.created_at := old.created_at;
      new.status := case when old.status = 'needs_info' then 'submitted' else old.status end;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists post_requests_guard on public.post_requests;
create trigger post_requests_guard before insert or update on public.post_requests
  for each row execute function public.post_requests_guard();

-- ── 댓글 ────────────────────────────────────────────────────
create table if not exists public.post_comments (
  id          bigint generated always as identity primary key,
  request_id  bigint not null references public.post_requests(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,  -- 운영자 댓글은 null
  author      text not null default 'staff',                       -- staff(담당자) | admin(운영자)
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint post_comments_author_ck check (author in ('staff', 'admin')),
  constraint post_comments_body_ck   check (char_length(btrim(body)) between 1 and 2000)
);
create index if not exists post_comments_req_at on public.post_comments (request_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "자기 요청의 댓글만 읽는다" on public.post_comments;
create policy "자기 요청의 댓글만 읽는다" on public.post_comments
  for select using (exists (select 1 from public.post_requests r where r.id = request_id and r.user_id = auth.uid()));
drop policy if exists "담당자는 자기 요청에 담당자로만 단다" on public.post_comments;
create policy "담당자는 자기 요청에 담당자로만 단다" on public.post_comments
  for insert with check (
    author = 'staff' and user_id = auth.uid()
    and exists (select 1 from public.post_requests r where r.id = request_id and r.user_id = auth.uid())
  );
-- update·delete 정책은 일부러 없다(④ — 주고받은 기록이다)

create or replace function public.post_comments_guard() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.author := 'staff';
    new.user_id := auth.uid();
    new.created_at := now();
  end if;
  return new;
end $$;
drop trigger if exists post_comments_guard on public.post_comments;
create trigger post_comments_guard before insert on public.post_comments
  for each row execute function public.post_comments_guard();
