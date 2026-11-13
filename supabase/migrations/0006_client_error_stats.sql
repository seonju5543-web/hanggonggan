-- ============================================================
-- 앱 오류 개수만 알려 주는 창구 (2026-11-13 · 은서 · 출시 전 백엔드 11번)
-- ------------------------------------------------------------
-- 0005 의 client_errors 는 넣기만 열려 있어 아무도 숫자를 안 봤다. 오류가 갑자기 늘어도 모른다.
-- → **개수만** 돌려주는 함수 하나. 감시 로봇(.github/workflows/error-watch.yml · tools/error-watch.mjs)이 공개 열쇠로 2시간마다 부른다.
--
-- 🔴 **오류 내용은 돌려주지 않는다** — 문구·파일·화면·기기 칸을 꺼내지 않고 count 만. 공개 열쇠는 누구나 가지므로
--    누가 불러도 '오류가 몇 건' 이상은 알 수 없게 한다(표 자체의 읽기 정책은 여전히 없다).
-- 🔴 SECURITY DEFINER 는 search_path 를 못 박는다(0005 와 같은 규칙) · 실행 권한은 public 에서 거두고 anon·authenticated 에만.
-- 적용: Supabase → SQL Editor 에 이 파일 전체를 붙여 실행(몇 번 실행해도 같다).
-- 관문: verify/health-gates/ops.mjs 「⑨ 앱 오류 급증 감시」
-- ============================================================
create or replace function public.client_error_stats()
returns json
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'last_hour', (select count(*) from public.client_errors where at > now() - interval '1 hour'),
    'last_day', (select count(*) from public.client_errors where at > now() - interval '1 day'),
    'prev_week_daily_avg', (select round(count(*)::numeric / 7, 1) from public.client_errors
                              where at > now() - interval '8 days' and at <= now() - interval '1 day'),
    'kinds_day', (select count(distinct message) from public.client_errors where at > now() - interval '1 day'),
    'day_cap', 3000
  );
$$;
revoke all on function public.client_error_stats() from public;
grant execute on function public.client_error_stats() to anon, authenticated;
