-- ============================================================
-- 한대장 — 과팅 표 (2026-09-21)
-- ------------------------------------------------------------
-- 쓰는 법: Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여넣고 Run.
--   (0001 · 0002 를 먼저 넣었어야 한다 — auth.users 만 쓰므로 순서는 사실 상관없다)
--
-- 이 앱에서 **학생끼리 서로를 보는 첫 표**다. 지금까지의 표(profiles·login_events)는
-- 전부 "자기 행만" 이었고, 여기서 처음으로 남의 행을 읽는 규칙이 생긴다.
-- 그래서 규칙을 잘못 쓰면 남의 글이 아니라 **남의 인증 정보·채팅**이 열린다.
--
-- 🔴 되돌리지 말 것 여섯 — 전부 흔한 RLS 사고다
--   ① 정책 안에서 같은 표를 다시 읽으면 "infinite recursion detected in policy" 로
--      **표 전체가 안 읽힌다.** 그래서 도우미 함수(is_room_member 등)는 security definer 다.
--      security definer 에는 반드시 `set search_path = public` 을 붙인다 — 없으면
--      호출자가 search_path 를 바꿔 다른 함수를 끼워 넣을 수 있다(권한 상승).
--   ② gating_profiles 의 verified_at 을 학생이 스스로 켤 수 있으면 인증이 무의미하다.
--      학생이 고칠 수 있는 칸은 nickname · dept · gender **셋뿐**이다(컬럼 단위 grant).
--      ⚠️ Supabase 는 새 표에 `grant all … to authenticated` 를 기본으로 준다 —
--         **먼저 revoke 하고** 필요한 칸만 grant 한다.
--   ③ `for all using(...)` 만 있으면 남의 user_id 로 **써 넣는** 것은 안 막힌다.
--      insert 정책은 전부 `with check` 다.
--   ④ 글·요청의 닉네임·학교·학과·성별은 **트리거가 gating_profiles 에서 덮어쓴다.**
--      앱이 보내는 값은 무시한다 — 안 그러면 남의 학교·학과를 적을 수 있다(사칭).
--   ⑤ 사용자 칸은 전부 `references auth.users on delete cascade` 다 — 탈퇴하면 글·요청·
--      메시지·차단이 같이 사라진다(약관 "탈퇴 시 파기"의 근거). 앱의 authDeleteData 가
--      gating_profiles 를 지우면 나머지는 그 행이 아니라 auth.users 를 따라 지워진다.
--      ⚠️ 계정 껍데기는 남으므로(0001 주석) 표마다 자기 행 delete 정책도 둔다.
--   ⑥ anon(로그인 안 한 요청)은 표를 **아예** 못 본다 — 정책 평가도 안 하게 revoke.
-- ============================================================

-- ------------------------------------------------------------
-- 1. 표
-- ------------------------------------------------------------

-- 과팅 프로필 — 학교 이메일 인증을 통과한 학생만 행이 생긴다.
-- 행을 **만드는 것은 서버(워커 · service_role)뿐**이다. 학생은 nickname·dept·gender 만 고친다.
create table if not exists public.gating_profiles (
  user_id            uuid primary key references auth.users on delete cascade,
  nickname           text
    check (nickname is null or (nickname ~ '^[가-힣a-zA-Z0-9]{2,10}$' and nickname !~* '(운영자|관리자|한대장)')),
  -- 학교 이름 — data/school-domains.json 에 그 도메인이 있을 때만 적힌다.
  -- 없으면 지어내지 않고 null 로 두고 앱은 verified_domain 을 그대로 보여 준다(원칙 8-1).
  school             text,
  dept               text check (dept is null or char_length(dept) <= 40),
  gender             text check (gender is null or gender in ('남', '여')),
  verified_domain    text not null,
  verified_at        timestamptz not null default now(),
  -- 학교 이메일은 **해시만** 남긴다(같은 이메일로 계정 둘을 인증하는 것을 막는 용도).
  school_email_hash  text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists gating_profiles_nickname_lower
  on public.gating_profiles (lower(nickname)) where nickname is not null;

-- 인증 코드 — 서버만 읽고 쓴다. 코드 원문은 없고 해시뿐이다.
create table if not exists public.school_verifications (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users on delete cascade,
  email        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     smallint not null default 0,
  sent_at      timestamptz not null default now(),
  consumed_at  timestamptz
);
create index if not exists school_verifications_user on public.school_verifications (user_id, sent_at desc);

-- 게시글 — "우리 과 n명, 과팅 구해요"
create table if not exists public.gating_posts (
  id            bigint generated always as identity primary key,
  author        uuid not null default auth.uid() references auth.users on delete cascade,
  -- ④ 스냅숏 — 트리거가 채운다. 앱이 보낸 값은 버린다.
  nickname      text not null default '',
  school        text,
  dept          text,
  gender        text,
  headcount     smallint not null check (headcount between 2 and 8),
  want_school   text not null default 'any' check (want_school in ('same', 'any')),
  body          text not null
    check (char_length(body) between 1 and 300
      -- 전화번호는 공개 글에 못 적는다(앱도 막지만 DB 가 마지막 선이다)
      and body !~ '01[016789][-. ]?[0-9]{3,4}[-. ]?[0-9]{4}'),
  status        text not null default 'open' check (status in ('open', 'closed', 'hidden')),
  report_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '14 days'
);
create index if not exists gating_posts_open on public.gating_posts (status, created_at desc);

-- 매칭 요청 — 앱이 짝을 맞춰 준다
create table if not exists public.gating_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  school       text,      -- ④ 스냅숏
  dept         text,
  gender       text,
  headcount    smallint not null check (headcount between 2 and 8),
  want_school  text not null default 'any' check (want_school in ('same', 'any')),
  status       text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled', 'expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days'
);
create index if not exists gating_requests_waiting on public.gating_requests (status, created_at);

-- 채팅방 — 글에서 열린 방(kind='post') 또는 매칭으로 열린 방(kind='match')
create table if not exists public.gating_rooms (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('post', 'match')),
  post_id     bigint references public.gating_posts on delete set null,
  opened_by   uuid references auth.users on delete cascade,   -- 글에 말 건 사람
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create unique index if not exists gating_rooms_one_per_post_visitor
  on public.gating_rooms (post_id, opened_by) where post_id is not null;

create table if not exists public.gating_matches (
  id          bigint generated always as identity primary key,
  req_a       bigint not null references public.gating_requests on delete cascade,
  req_b       bigint not null references public.gating_requests on delete cascade,
  user_a      uuid not null references auth.users on delete cascade,   -- 30일 재매칭 금지용 스냅숏
  user_b      uuid not null references auth.users on delete cascade,
  room_id     bigint not null references public.gating_rooms on delete cascade,
  created_at  timestamptz not null default now(),
  unique (req_a, req_b)
);

create table if not exists public.gating_room_members (
  room_id       bigint not null references public.gating_rooms on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  nickname      text not null default '',
  joined_at     timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  left_at       timestamptz,
  primary key (room_id, user_id)
);

create table if not exists public.gating_messages (
  id          bigint generated always as identity primary key,
  room_id     bigint not null references public.gating_rooms on delete cascade,
  sender      uuid not null default auth.uid() references auth.users on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists gating_messages_room on public.gating_messages (room_id, id);

create table if not exists public.gating_reports (
  id           bigint generated always as identity primary key,
  reporter     uuid not null default auth.uid() references auth.users on delete cascade,
  target_user  uuid,
  post_id      bigint references public.gating_posts on delete set null,
  message_id   bigint references public.gating_messages on delete set null,
  reason       text not null check (reason in ('욕설', '광고', '연락처강요', '사칭', '기타')),
  detail       text check (detail is null or char_length(detail) <= 200),
  created_at   timestamptz not null default now()
);

create table if not exists public.gating_blocks (
  blocker     uuid not null default auth.uid() references auth.users on delete cascade,
  blocked     uuid not null,
  created_at  timestamptz not null default now(),
  primary key (blocker, blocked)
);

-- 방 목록용 — 방마다 마지막 말 한 줄. security_invoker 라 아래 RLS 가 그대로 걸린다
-- (남의 방은 애초에 행이 안 나온다).
create or replace view public.gating_room_last
  with (security_invoker = true) as
select r.id as room_id, r.kind, r.post_id, r.opened_by, r.created_at, r.closed_at,
  (select m.body from public.gating_messages m where m.room_id = r.id order by m.id desc limit 1) as last_body,
  (select m.created_at from public.gating_messages m where m.room_id = r.id order by m.id desc limit 1) as last_at,
  (select max(m.id) from public.gating_messages m where m.room_id = r.id) as last_id
from public.gating_rooms r;

-- ------------------------------------------------------------
-- 2. 도우미 함수 — ① security definer + search_path 고정
-- ------------------------------------------------------------
create or replace function public.is_verified(uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gating_profiles p
    where p.user_id = uid and p.verified_at is not null and p.nickname is not null
  );
$$;

create or replace function public.is_room_member(rid bigint, uid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gating_room_members m
    where m.room_id = rid and m.user_id = uid and m.left_at is null
  );
$$;

create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.gating_blocks x
    where (x.blocker = a and x.blocked = b) or (x.blocker = b and x.blocked = a)
  );
$$;

revoke execute on function public.is_verified(uuid) from public, anon;
revoke execute on function public.is_room_member(bigint, uuid) from public, anon;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon;
grant execute on function public.is_verified(uuid) to authenticated, service_role;
grant execute on function public.is_room_member(bigint, uuid) to authenticated, service_role;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. 트리거 — ④ 스냅숏 · 속도 제한 · 신고 누적
-- ------------------------------------------------------------

-- 글·요청을 넣을 때 프로필에서 덮어쓴다. 인증 안 된 사람은 여기서 막힌다.
create or replace function public.gating_fill_author() returns trigger
  language plpgsql security definer set search_path = public as $$
declare p public.gating_profiles;
begin
  select * into p from public.gating_profiles where user_id = auth.uid();
  if not found or p.verified_at is null or p.nickname is null then
    raise exception 'not_verified';
  end if;
  new.school := p.school;
  new.dept := p.dept;
  new.gender := p.gender;
  if tg_table_name = 'gating_posts' then
    new.author := auth.uid();
    new.nickname := p.nickname;
  else
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists gating_posts_fill on public.gating_posts;
create trigger gating_posts_fill before insert on public.gating_posts
  for each row execute function public.gating_fill_author();
drop trigger if exists gating_requests_fill on public.gating_requests;
create trigger gating_requests_fill before insert on public.gating_requests
  for each row execute function public.gating_fill_author();

-- 속도 제한 — 글 하루 3건 · 요청 동시에 1건 · 메시지 분당 30건 · 신고 하루 10건
create or replace function public.gating_rate_posts() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.gating_posts where author = new.author and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate:posts';
  end if;
  return new;
end;
$$;
drop trigger if exists gating_posts_rate on public.gating_posts;
create trigger gating_posts_rate before insert on public.gating_posts
  for each row execute function public.gating_rate_posts();

create or replace function public.gating_rate_requests() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.gating_requests where user_id = new.user_id and status = 'waiting') then
    raise exception 'rate:requests';
  end if;
  return new;
end;
$$;
drop trigger if exists gating_requests_rate on public.gating_requests;
create trigger gating_requests_rate before insert on public.gating_requests
  for each row execute function public.gating_rate_requests();

-- 요청 상태는 학생이 '대기 → 취소' 만 바꿀 수 있다. 나머지는 서버(service_role)의 몫.
create or replace function public.gating_requests_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' then return new; end if;
  if not (old.status = 'waiting' and new.status = 'cancelled') then
    raise exception 'not_allowed';
  end if;
  return new;
end;
$$;
drop trigger if exists gating_requests_guard on public.gating_requests;
create trigger gating_requests_guard before update on public.gating_requests
  for each row execute function public.gating_requests_guard();

create or replace function public.gating_message_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.sender := auth.uid(); end if;
  if exists (select 1 from public.gating_rooms r where r.id = new.room_id and r.closed_at is not null) then
    raise exception 'room_closed';
  end if;
  if not exists (select 1 from public.gating_room_members m
                 where m.room_id = new.room_id and m.user_id = new.sender and m.left_at is null) then
    raise exception 'not_member';
  end if;
  if (select count(*) from public.gating_messages where sender = new.sender and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate:messages';
  end if;
  return new;
end;
$$;
drop trigger if exists gating_messages_guard on public.gating_messages;
create trigger gating_messages_guard before insert on public.gating_messages
  for each row execute function public.gating_message_guard();

create or replace function public.gating_after_report() returns trigger
  language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if (select count(*) from public.gating_reports where reporter = new.reporter and created_at > now() - interval '24 hours') > 10 then
    raise exception 'rate:reports';
  end if;
  if new.post_id is not null then
    select count(distinct reporter) into n from public.gating_reports where post_id = new.post_id;
    update public.gating_posts set report_count = n,
      status = case when n >= 3 and status = 'open' then 'hidden' else status end
      where id = new.post_id;
  end if;
  return new;
end;
$$;
drop trigger if exists gating_reports_after on public.gating_reports;
create trigger gating_reports_after after insert on public.gating_reports
  for each row execute function public.gating_after_report();

create or replace function public.gating_touch() returns trigger
  language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists gating_profiles_touch on public.gating_profiles;
create trigger gating_profiles_touch before update on public.gating_profiles
  for each row execute function public.gating_touch();

-- ------------------------------------------------------------
-- 4. RPC
-- ------------------------------------------------------------

-- 글에 말 걸기 — 방 하나를 열고 둘을 넣는다. 이미 열었으면 그 방을 돌려준다.
create or replace function public.gating_open_room(p_post bigint) returns bigint
  language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  post public.gating_posts;
  me public.gating_profiles;
  rid bigint;
begin
  if uid is null or not public.is_verified(uid) then raise exception 'not_verified'; end if;
  select * into post from public.gating_posts where id = p_post;
  if not found or post.status <> 'open' or post.expires_at < now() then raise exception 'post_closed'; end if;
  if post.author = uid then raise exception 'own_post'; end if;
  if public.is_blocked_pair(uid, post.author) then raise exception 'blocked'; end if;
  select id into rid from public.gating_rooms where post_id = p_post and opened_by = uid;
  if found then return rid; end if;
  if (select count(*) from public.gating_rooms where opened_by = uid and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'rate:rooms';
  end if;
  select * into me from public.gating_profiles where user_id = uid;
  insert into public.gating_rooms (kind, post_id, opened_by) values ('post', p_post, uid) returning id into rid;
  insert into public.gating_room_members (room_id, user_id, nickname) values
    (rid, uid, coalesce(me.nickname, '')),
    (rid, post.author, post.nickname);
  return rid;
end;
$$;
revoke execute on function public.gating_open_room(bigint) from public, anon;
grant execute on function public.gating_open_room(bigint) to authenticated, service_role;

-- 매칭 확정 — 서버(service_role)만. 워커가 고른 짝을 **원자적으로** 굳힌다.
create or replace function public.gating_commit_match(a bigint, b bigint) returns bigint
  language plpgsql volatile security definer set search_path = public as $$
declare
  ra public.gating_requests; rb public.gating_requests;
  na text; nb text; rid bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_only'; end if;
  select * into ra from public.gating_requests where id = a for update;
  select * into rb from public.gating_requests where id = b for update;
  if ra.status <> 'waiting' or rb.status <> 'waiting' then raise exception 'already_matched'; end if;
  if ra.user_id = rb.user_id then raise exception 'same_user'; end if;
  select nickname into na from public.gating_profiles where user_id = ra.user_id;
  select nickname into nb from public.gating_profiles where user_id = rb.user_id;
  insert into public.gating_rooms (kind) values ('match') returning id into rid;
  insert into public.gating_room_members (room_id, user_id, nickname) values
    (rid, ra.user_id, coalesce(na, '')), (rid, rb.user_id, coalesce(nb, ''));
  insert into public.gating_matches (req_a, req_b, user_a, user_b, room_id) values (a, b, ra.user_id, rb.user_id, rid);
  update public.gating_requests set status = 'matched' where id in (a, b);
  return rid;
end;
$$;
revoke execute on function public.gating_commit_match(bigint, bigint) from public, anon, authenticated;
grant execute on function public.gating_commit_match(bigint, bigint) to service_role;

-- 만료 정리 — 서버만
create or replace function public.gating_run_expiry() returns void
  language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_only'; end if;
  update public.gating_requests set status = 'expired' where status = 'waiting' and expires_at < now();
  update public.gating_posts set status = 'closed' where status = 'open' and expires_at < now();
  delete from public.school_verifications where sent_at < now() - interval '1 day';
end;
$$;
revoke execute on function public.gating_run_expiry() from public, anon, authenticated;
grant execute on function public.gating_run_expiry() to service_role;

-- ------------------------------------------------------------
-- 5. 권한 — ② ⑥ 기본 grant 를 걷어내고 필요한 것만 준다
-- ------------------------------------------------------------
revoke all on table public.gating_profiles, public.school_verifications, public.gating_posts,
  public.gating_requests, public.gating_rooms, public.gating_matches, public.gating_room_members,
  public.gating_messages, public.gating_reports, public.gating_blocks, public.gating_room_last
  from anon;

-- 인증 코드 표는 로그인한 사람도 못 본다
revoke all on table public.school_verifications from authenticated;

-- 과팅 프로필: 행 만들기는 서버만 · 고치는 칸은 셋 · 자기 행 지우기(탈퇴)
revoke insert, update on table public.gating_profiles from authenticated;
grant update (nickname, dept, gender) on table public.gating_profiles to authenticated;

-- 글: 고칠 수 있는 칸은 본문·상태(마감)뿐
revoke update on table public.gating_posts from authenticated;
grant update (body, status) on table public.gating_posts to authenticated;

-- 요청: 상태만(트리거가 '대기 → 취소' 로 좁힌다)
revoke update on table public.gating_requests from authenticated;
grant update (status) on table public.gating_requests to authenticated;

-- 방·짝: RPC 만 만든다
revoke insert, update, delete on table public.gating_rooms from authenticated;
revoke insert, update, delete on table public.gating_matches from authenticated;

-- 방 구성원: 읽음 시각·나가기만
revoke insert, update, delete on table public.gating_room_members from authenticated;
grant update (last_read_at, left_at) on table public.gating_room_members to authenticated;

-- 메시지는 고치거나 지우지 않는다(신고 근거가 남아야 한다)
revoke update, delete on table public.gating_messages from authenticated;

-- 신고는 넣기만
revoke select, update, delete on table public.gating_reports from authenticated;

revoke update on table public.gating_blocks from authenticated;

-- ------------------------------------------------------------
-- 6. 행 단위 접근 규칙(RLS) — 진짜 방어선
-- ------------------------------------------------------------
alter table public.gating_profiles enable row level security;
alter table public.school_verifications enable row level security;   -- 정책 0개 = service_role 말고는 아무도
alter table public.gating_posts enable row level security;
alter table public.gating_requests enable row level security;
alter table public.gating_rooms enable row level security;
alter table public.gating_matches enable row level security;
alter table public.gating_room_members enable row level security;
alter table public.gating_messages enable row level security;
alter table public.gating_reports enable row level security;
alter table public.gating_blocks enable row level security;

-- gating_profiles: 자기 행만
drop policy if exists "과팅 프로필 자기 행 읽기" on public.gating_profiles;
create policy "과팅 프로필 자기 행 읽기" on public.gating_profiles
  for select using (auth.uid() = user_id);
drop policy if exists "과팅 프로필 자기 행 고치기" on public.gating_profiles;
create policy "과팅 프로필 자기 행 고치기" on public.gating_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "과팅 프로필 자기 행 지우기" on public.gating_profiles;
create policy "과팅 프로필 자기 행 지우기" on public.gating_profiles
  for delete using (auth.uid() = user_id);

-- gating_posts: 인증한 사람은 열린 글 전부(차단 관계 제외) · 자기 글은 상태와 상관없이
drop policy if exists "과팅 글 읽기" on public.gating_posts;
create policy "과팅 글 읽기" on public.gating_posts
  for select using (
    author = auth.uid()
    or (public.is_verified(auth.uid()) and status = 'open' and not public.is_blocked_pair(auth.uid(), author))
  );
drop policy if exists "과팅 글 쓰기" on public.gating_posts;
create policy "과팅 글 쓰기" on public.gating_posts
  for insert with check (author = auth.uid() and public.is_verified(auth.uid()));
drop policy if exists "과팅 글 고치기" on public.gating_posts;
create policy "과팅 글 고치기" on public.gating_posts
  for update using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists "과팅 글 지우기" on public.gating_posts;
create policy "과팅 글 지우기" on public.gating_posts
  for delete using (author = auth.uid());

-- gating_requests: 자기 것만
drop policy if exists "과팅 요청 자기 것" on public.gating_requests;
create policy "과팅 요청 자기 것" on public.gating_requests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_verified(auth.uid()));

-- gating_matches: 내 요청이 낀 짝만
drop policy if exists "과팅 짝 읽기" on public.gating_matches;
create policy "과팅 짝 읽기" on public.gating_matches
  for select using (user_a = auth.uid() or user_b = auth.uid());

-- gating_rooms / members / messages: 방 구성원만
drop policy if exists "과팅 방 읽기" on public.gating_rooms;
create policy "과팅 방 읽기" on public.gating_rooms
  for select using (public.is_room_member(id, auth.uid()));
drop policy if exists "과팅 방 구성원 읽기" on public.gating_room_members;
create policy "과팅 방 구성원 읽기" on public.gating_room_members
  for select using (public.is_room_member(room_id, auth.uid()));
drop policy if exists "과팅 방 구성원 자기 줄 고치기" on public.gating_room_members;
create policy "과팅 방 구성원 자기 줄 고치기" on public.gating_room_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "과팅 메시지 읽기" on public.gating_messages;
create policy "과팅 메시지 읽기" on public.gating_messages
  for select using (public.is_room_member(room_id, auth.uid()) and not public.is_blocked_pair(auth.uid(), sender));
drop policy if exists "과팅 메시지 쓰기" on public.gating_messages;
create policy "과팅 메시지 쓰기" on public.gating_messages
  for insert with check (sender = auth.uid() and public.is_room_member(room_id, auth.uid()));

-- gating_reports: 넣기만 · gating_blocks: 자기 것만
drop policy if exists "과팅 신고 넣기" on public.gating_reports;
create policy "과팅 신고 넣기" on public.gating_reports
  for insert with check (reporter = auth.uid());
drop policy if exists "과팅 차단 자기 것" on public.gating_blocks;
create policy "과팅 차단 자기 것" on public.gating_blocks
  for all using (blocker = auth.uid()) with check (blocker = auth.uid() and blocked <> auth.uid());
