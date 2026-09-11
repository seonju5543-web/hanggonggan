-- ============================================================
-- 로그인 활동 (2026-09-11 개발자 지시 — 설정 1번 "로그인 활동 추가")
-- ------------------------------------------------------------
-- 학생이 "내 계정에 언제 어디서 로그인됐나"를 직접 볼 수 있게 하는 표.
-- 낯선 기기가 보이면 비밀번호를 바꾸라고 알려 주는 것이 목적이다.
--
-- 🔴 **적게 담는다.** 시각 · 거친 기기 이름 · 이 설치본의 임의 문자열, 셋뿐이다.
--    · IP 주소·위치는 담지 않는다. 브라우저는 제 IP 를 알 수 없고(서버만 안다), Supabase 에
--      바로 쓰는 구조에서는 받아 적을 자리가 없다. IP 를 보여 주려면 Edge Function 을 하나
--      두어 거기서 받아 적어야 한다 — 개발자가 원하면 그때 더한다. **지어내지 않는다.**
--    · 기기 이름은 UA 에서 **낱말 몇 개만** 뽑아 만든다(원문 UA 를 통째로 담지 않는다 —
--      그건 기기를 특정하는 지문이 된다).
-- 🔴 담는 것이 늘었으므로 `terms.html` 수집 항목 표에도 **같이 적어야 한다**(그렇게 했다).
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 실행.
-- ============================================================
create table if not exists public.login_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  at         timestamptz not null default now(),
  device     text,                      -- 예: '아이폰 · Safari' (거친 이름만)
  client     text                       -- 이 설치본을 가리키는 **뜻 없는 임의 문자열**.
                                        -- '현재 기기' 배지를 정확히 붙이려고 둔다. 기기 지문이
                                        -- 아니라 우리가 만든 난수라, 지우면 새로 만들어진다.
);

create index if not exists login_events_user_at
  on public.login_events (user_id, at desc);

-- ============================================================
-- 🔴 행 단위 접근 규칙(RLS) — 끄면 남의 로그인 기록이 열린다.
-- ⚠️ profiles 와 달리 **수정(update)은 아무도 못 한다.** 기록은 고쳐 쓰는 물건이 아니고,
--    고칠 수 있으면 '낯선 기기를 지운다'는 공격이 가능해진다. 넣기·읽기·지우기만 연다
--    (지우기는 본인이 기록을 비울 수 있어야 해서 연다).
-- ============================================================
alter table public.login_events enable row level security;

drop policy if exists "자기 기록만 읽는다" on public.login_events;
create policy "자기 기록만 읽는다"
  on public.login_events for select
  using (auth.uid() = user_id);

drop policy if exists "자기 기록만 넣는다" on public.login_events;
create policy "자기 기록만 넣는다"
  on public.login_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "자기 기록만 지운다" on public.login_events;
create policy "자기 기록만 지운다"
  on public.login_events for delete
  using (auth.uid() = user_id);
