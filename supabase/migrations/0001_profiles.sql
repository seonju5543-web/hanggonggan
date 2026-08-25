-- ============================================================
-- 한대장 — 회원 프로필 표 (2026-08-25)
-- ------------------------------------------------------------
-- 쓰는 법: Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여넣고 Run.
--
-- 🔴 이 파일이 저장소에 있는 이유: Supabase 는 Cloudflare 와 달리 저장소를 보고 자동
--    배포하지 않는다. 대시보드에서 손으로 고치면 "언제 왜 바꿨는지"가 아무 데도 안 남는다.
--    표를 바꿀 일이 생기면 여기에 0002_....sql 을 새로 추가하고 그걸 붙여넣는다.
-- ============================================================

create table if not exists public.profiles (
  user_id       uuid primary key references auth.users on delete cascade,

  -- 프로필과 신청내역을 통째로 넣는다.
  -- 🔴 칸을 쪼개지 않는 이유: 앱의 프로필 구조는 이미 두 번 바뀌었다
  --    (app.js 의 migrateBranchCampus·migrateFitFields). 칸으로 쪼개면 앱을 고칠 때마다
  --    DB 설계도 같이 고쳐야 하고, 안 고치면 조용히 값이 사라진다.
  profile       jsonb,
  applications  jsonb default '[]'::jsonb,

  -- 민감정보(기초생활수급·장애·국가유공자 등) 수집에 동의했는가.
  -- 동의하지 않았으면 앱이 애초에 그 항목을 안 보낸다(supabase-client.js syncSafeProfile).
  sensitive_ok  boolean default false,

  updated_at    timestamptz default now()
);

-- ============================================================
-- 🔴 진짜 방어선 — 행 단위 접근 규칙(RLS)
-- ------------------------------------------------------------
-- 앱이 들고 다니는 anon 열쇠는 브라우저에 그대로 나가는 공개값이라 숨길 수가 없다.
-- 남의 프로필을 못 읽게 막는 것은 오직 아래 정책이다. **끄면 전 회원 정보가 열린다.**
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "자기 행만 읽고 쓴다" on public.profiles;
create policy "자기 행만 읽고 쓴다"
  on public.profiles
  for all
  using (auth.uid() = user_id)          -- 읽기·수정·삭제 대상이 내 행일 때만
  with check (auth.uid() = user_id);    -- 남의 user_id 로 써 넣는 것도 막는다
