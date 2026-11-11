-- ============================================================
-- 앱 오류 수집 창구 (2026-11-10 · 은서 · 출시 전 백엔드 7번)
-- ------------------------------------------------------------
-- 학생 폰에서 난 앱 오류를 우리가 알게 하는 표. 앱 쪽은 error-report.js (스위치 supabase-config.js errorReport).
--
-- 🔴 **누구인지 알 수 있는 것은 담지 않는다** — user_id 칸이 아예 없다. 오류 문구·파일·줄·화면·앱 판·거친 기기 이름뿐.
--    문구 속 주소·메일·전화·긴 숫자는 앱(cleanError)이 지운 뒤 보낸다. 담는 것은 terms.html 수집 항목 표와 한 세트.
-- 🔴 **넣기만 연다** — 읽기·고치기·지우기 정책이 없다. 앱(공개 열쇠)으로는 아무도 못 읽는다.
--    읽는 것은 대시보드(Table Editor)뿐이다.
-- 🔴 공개 열쇠로 누구나 넣을 수 있으므로 **쓰레기 넣기를 막는다**:
--    ① 칸마다 길이 상한(CHECK) ② 표 전체 1분 60건 · 하루 3,000건 상한(넘으면 거절) ③ 30일 지난 줄은 넣을 때마다 지운다.
--    (1분·하루 세기는 정책상 읽기가 막혀 있어 SECURITY DEFINER 함수로 센다 — search_path 를 못 박는다.)
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 실행. 그다음 supabase-config.js 의 errorReport 를 true 로.
-- ============================================================
create table if not exists public.client_errors (
  id       bigint generated always as identity primary key,
  at       timestamptz not null default now(),
  message  text not null check (char_length(message) between 1 and 300),
  source   text check (source is null or char_length(source) <= 80),
  line     integer check (line is null or line between 0 and 10000000),
  col      integer check (col is null or col between 0 and 10000000),
  screen   text check (screen is null or char_length(screen) <= 40),
  version  text check (version is null or char_length(version) <= 40),
  device   text check (device is null or char_length(device) <= 40)
);

create index if not exists client_errors_at on public.client_errors (at desc);

alter table public.client_errors enable row level security;

drop policy if exists "누구나 넣기만 한다" on public.client_errors;
create policy "누구나 넣기만 한다"
  on public.client_errors for insert
  to anon, authenticated
  with check (true);

-- 상한 · 정리 — 넣기 직전에 돈다
create or replace function public.client_errors_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.client_errors where at > now() - interval '1 minute') >= 60 then
    raise exception 'client_errors: 1분 상한' using errcode = 'P0001';
  end if;
  if (select count(*) from public.client_errors where at > now() - interval '1 day') >= 3000 then
    raise exception 'client_errors: 하루 상한' using errcode = 'P0001';
  end if;
  delete from public.client_errors where at < now() - interval '30 days';
  new.at := now();   -- 시각은 서버가 정한다(앱이 보낸 값을 믿지 않는다)
  return new;
end;
$$;

revoke all on function public.client_errors_guard() from public, anon, authenticated;

drop trigger if exists client_errors_guard on public.client_errors;
create trigger client_errors_guard
  before insert on public.client_errors
  for each row execute function public.client_errors_guard();
