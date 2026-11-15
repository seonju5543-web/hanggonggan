-- ============================================================
-- 이용 횟수 — 하루 단위 합계만 (2026-11-15 · 은서 · 사용자 트랙션)
-- ------------------------------------------------------------
-- 앱(usage-report.js)이 행동 하나마다 track_usage() 를 부르면, **낱낱의 기록은 남기지 않고** 그날의 합계 칸에 1을 더한다.
-- 🔴 누가 했는지는 어디에도 없다 — 계정·기기 번호 칸이 없다. 칸은 날짜·행동·공고 번호·나눔 기준·그 값·횟수뿐.
-- 🔴 카테고리는 겹쳐서 2~3개까지만: 공고별로는 「학년×계열」 하나만 · 지역과 학교는 공고 없이 **따로** 센다
--    (공고 × 학교 × 학년처럼 잘게 겹치면 사람이 좁혀진다). 특별자격·소득·성적은 받지도 않는다.
-- 🔴 표는 아무도 직접 못 읽고 못 쓴다(RLS 켬 · 정책 없음) — 쓰기는 track_usage(), 읽기는 usage_report(열쇠) 함수로만.
-- 🔴 쓰레기 막기: 하루 전체 5만 건 넘으면 더 세지 않는다 · 행동 이름은 정해진 목록만 · 칸마다 길이 상한 · 1년 지난 칸은 지운다.
-- 🔴 보고서는 **열쇠가 있어야** 나온다 — 열쇠는 아래 마지막 줄이 한 번 만들어 보여 준다. 그 값을 관리자 사이트 「아침 지표」 칸에만 넣는다
--    (채팅·저장소·이슈에 붙여넣지 말 것). 5건 미만 칸은 숫자 대신 null 로 가린다.
-- 적용: Supabase → SQL Editor 에 이 파일 전체를 붙여 실행(여러 번 실행해도 같다 — 열쇠는 처음 한 번만 만든다).
-- 관문: verify/health-gates/ops.mjs 「⑬ 이용 횟수 세기」
-- ============================================================
create table if not exists public.usage_counts (
  day   date    not null,
  event text    not null check (char_length(event) between 1 and 20),
  item  text    not null default '' check (char_length(item) <= 80),
  dim   text    not null check (dim in ('all', 'grade_track', 'region', 'school')),
  val   text    not null default '' check (char_length(val) <= 60),
  n     integer not null default 0,
  primary key (day, event, item, dim, val)
);
alter table public.usage_counts enable row level security;

create table if not exists public.report_keys (
  key        text primary key,
  created_at timestamptz not null default now()
);
alter table public.report_keys enable row level security;

create or replace function public.track_usage(p_event text, p_item text, p_grade text, p_track text, p_region text, p_school text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d   date := (now() at time zone 'Asia/Seoul')::date;
  it  text := left(coalesce(p_item, ''), 80);
  gt  text := left(coalesce(nullif(p_grade, ''), '?'), 4) || '|' || left(coalesce(nullif(p_track, ''), '?'), 20);
  rg  text := left(coalesce(nullif(p_region, ''), '?'), 12);
  sc  text := left(coalesce(nullif(p_school, ''), '?'), 40);
  tot integer;
begin
  if p_event is null or p_event not in ('open', 'onboard', 'detail', 'save', 'source', 'prep', 'form_open', 'form_edit', 'submitted') then
    return;
  end if;
  select n into tot from public.usage_counts where day = d and event = '*' and item = '' and dim = 'all' and val = '';
  if coalesce(tot, 0) >= 50000 then return; end if;
  if tot is null then
    delete from public.usage_counts where day < d - 365;   -- 하루 첫 기록 때 1년 지난 칸 정리
  end if;
  insert into public.usage_counts as u (day, event, item, dim, val, n) values
    (d, '*',     '', 'all',         '', 1),
    (d, p_event, it, 'all',         '', 1),
    (d, p_event, it, 'grade_track', gt, 1),
    (d, p_event, '', 'region',      rg, 1),
    (d, p_event, '', 'school',      sc, 1)
  on conflict (day, event, item, dim, val) do update set n = u.n + 1;
end;
$$;
revoke all on function public.track_usage(text, text, text, text, text, text) from public;
grant execute on function public.track_usage(text, text, text, text, text, text) to anon, authenticated;

-- 보고서 — 열쇠가 맞을 때만 · 5건 미만은 null 로 가린다 · 앱 오류 요약도 함께(관리자 사이트 「아침 지표」가 쓴다)
create or replace function public.usage_report(p_key text, p_days integer default 7)
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  d0 date := (now() at time zone 'Asia/Seoul')::date - least(greatest(coalesce(p_days, 7), 1), 60);
  gate integer := 5;
begin
  if p_key is null or not exists (select 1 from public.report_keys where key = p_key) then
    return json_build_object('ok', false);
  end if;
  return json_build_object(
    'ok', true,
    'today', (now() at time zone 'Asia/Seoul')::date,
    'daily', (select coalesce(json_agg(x order by x.day, x.event), '[]'::json) from (
        select day, event, sum(n)::int as n from public.usage_counts
        where day >= d0 and dim = 'all' and event <> '*' group by day, event) x),
    'items', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select event, item, sum(n)::int as n from public.usage_counts
        where day >= d0 and dim = 'all' and item <> '' group by event, item
        having sum(n) >= gate order by sum(n) desc limit 60) x),
    'groups', (select coalesce(json_agg(x order by x.dim, x.n desc), '[]'::json) from (
        select event, dim, val, case when sum(n) >= gate then sum(n)::int end as n from public.usage_counts
        where day >= d0 and dim in ('grade_track', 'region', 'school')
        group by event, dim, val) x),
    'errors_daily', (select coalesce(json_agg(x order by x.day), '[]'::json) from (
        select (at at time zone 'Asia/Seoul')::date as day, count(*)::int as n from public.client_errors
        where at >= d0 group by 1) x),
    'errors_top', (select coalesce(json_agg(x order by x.n desc), '[]'::json) from (
        select message, source, count(*)::int as n, max(at) as last_at from public.client_errors
        where at > now() - interval '1 day' group by message, source order by count(*) desc limit 10) x)
  );
end;
$$;
revoke all on function public.usage_report(text, integer) from public;
grant execute on function public.usage_report(text, integer) to anon, authenticated;

-- 보고서 열쇠 — 처음 한 번만 만든다(무작위 UUID 두 개 · 244비트). 아래 결과 칸의 key 를 관리자 사이트 「아침 지표」에 넣는다.
insert into public.report_keys (key)
select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.report_keys);
select key as "아침 지표 열쇠 (관리자 사이트에만 넣으세요)" from public.report_keys order by created_at limit 1;
