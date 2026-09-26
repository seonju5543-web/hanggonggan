-- ============================================================
-- 한대장 — 프로필 '자격 매칭 핵심 정보'를 개별 칸으로 (2026-09-26 · 기술 고문 보고서 Q6)
-- ------------------------------------------------------------
-- 쓰는 법: Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여넣고 Run.
--          여러 번 붙여넣어도 안전하다(같은 것을 다시 만들지 않는다).
--
-- 무엇을 하는가: 지금까지 `profile` jsonb 한 칸에만 있던 **학교·캠퍼스·학과·학년·성별·
-- 학적상태·계열·성적·소득구간**을 각각의 칸으로 꺼내고, 그 칸에 **DB 가 직접 값을 검사하는
-- 제약(CHECK)** 을 건다. 앱이 무엇을 보내든 DB 가 한 번 더 본다.
--
-- ============================================================
-- 🔴 왜 '앱이 칸마다 따로 써 넣기'가 아니라 '꺼내 쓰기(generated)' 인가
-- ------------------------------------------------------------
-- 보고서는 개별 컬럼으로 **분리**하라고 했다. 분리하는 방법은 두 가지다.
--
--  (가) 앱이 jsonb 와 개별 칸을 **둘 다** 써 넣는다
--       → 두 곳이 갈라진다. 실제로 이 저장소에서 프로필 구조가 두 번 바뀌었고
--         (app.js migrateBranchCampus · migrateFitFields), 그때 DB 를 같이 안 고치면
--         **조용히 값이 사라진다**(0001_profiles.sql 이 칸을 안 쪼갠 이유가 이것이다).
--       → 더 나쁜 것: 옛 앱이 깔린 폰은 쪼갠 칸을 **제 옛 값으로 똑같이 덮는다**
--         (docs/designs/sync-overwrite.md).
--
--  (나) DB 가 jsonb 에서 **직접 꺼내 채운다** (`generated always as … stored`)  ← 이걸 골랐다
--       → 앱은 고칠 것이 없고, 두 곳이 **갈라질 수가 없다**(쓰는 길이 하나다).
--       → 그런데 CHECK 는 꺼낸 칸에 걸리므로, 값이 이상하면 **jsonb 쓰기 자체가 거절된다.**
--         즉 "개별 컬럼 + DB 검증"이라는 보고서의 목적은 그대로 달성된다.
--
-- ⚠️ 그래서 앱의 쓰기 경로(supabase-client.js syncPush)는 **그대로다.** 이 파일만 붙여넣으면 된다.
--
-- ============================================================
-- 🔴 CHECK 가 잡는 것과 못 잡는 것 — 착각하지 말 것
-- ------------------------------------------------------------
--  잡는다: **있을 수 없는 값.** 성적 999, 학년 0, 소득구간 99, 10MB 짜리 학교 이름.
--          변조한 앱이 `gpa: 999` 를 올리면 여기서 거절된다. 이게 중요한 이유는,
--          서버가 자격을 재검증할 때 **우리 사본을 읽기 때문**이다(server/apply/apply-guard.mjs).
--          999 가 사본에 들어와 있으면 `minGpa` 를 뭐라고 적어 둬도 전부 통과한다.
--  못 잡는다: **거짓말.** 성적 2.0 인 학생이 4.1 이라고 적는 것은 4.1 이 정상 범위라 통과한다.
--          학교와 학사 정보가 연동되기 전까지 이것을 확인할 방법은 없다. 없는 방어를
--          있다고 적지 않는다(원칙 8-1).
--
-- 🔴 닫힌 목록(`gender in ('남','여')` 같은 것)은 **일부러 걸지 않는다.**
--    성별은 온보딩 칸이 아니라 **신청서를 채우다 배우는 값**이고(app.js LEARNED_COMMON),
--    양식 48종 중에는 성별을 **자유 입력**으로 받는 것이 있다(data/forms.json '성별(필수)' type:text).
--    거기에 '남자' 라고 쓴 학생은 닫힌 목록에 걸려 **프로필이 영영 서버에 안 올라간다.**
--    학적상태·계열도 같다 — 칩 목록은 앱에서 늘어난다. 늘어날 수 있는 것에 자물쇠를 걸면
--    자물쇠가 아니라 고장이 된다. 그래서 문자 칸은 **길이만** 잰다.
--
-- ⚠️ 길이 상한은 실측한 최장값의 두 배 이상으로 잡았다 —
--    학교 최장 19자(`한국에너지공과대학교(KENTECH)`) · 입력칸 maxlength 30 → 상한 60.
--    캠퍼스 최장 13자 → 40. 이 상한에 걸리는 정상 값은 없다.
-- ============================================================

-- ------------------------------------------------------------
-- ① 개별 칸 — profile jsonb 에서 DB 가 꺼내 채운다
-- ------------------------------------------------------------
-- 🔴 꺼내는 식은 **절대 실패하지 않아야 한다.** `(profile->>'year')::int` 처럼 맨 형변환을 쓰면
--    숫자가 아닌 값이 한 번 들어오는 순간 **저장 자체가 오류로 죽는다**(학생은 이유를 모른다).
--    그래서 숫자는 정규식으로 먼저 걸러 본다.
--
-- 🔴 **읽을 수 없는 값을 NULL 로 두면 안 된다** (2026-09-26 실측으로 잡았다).
--    처음에는 '숫자가 아니면 NULL' 로 만들었는데, `gpa: 999` 를 올려 보니 **거절되지 않고
--    조용히 통과**했다 — 정규식이 세 자리를 안 받아 NULL 이 되고, NULL 은 CHECK 를 통과한다.
--    그런데 jsonb 안에는 999 가 **그대로 남는다.** 서버는 자격을 볼 때 jsonb 를 읽으므로
--    (server/apply/apply-guard.mjs → loadProfile), `minGpa` 를 뭐라고 적어 둬도 전부 통과한다.
--    막으려던 구멍이 그대로 열려 있었던 것이다.
--    그래서 **읽을 수 없으면 `-1`** 로 둔다 — 아래 CHECK 가 `0 이상`을 요구하므로 **쓰기가 거절된다.**
--    ⚠️ 즉 세 갈래다: 비었으면 NULL('모른다' — 통과) · 읽혔으면 그 값(범위로 판정) ·
--       읽을 수 없으면 -1(거절). 정상 앱은 -1 에 닿을 일이 없다.
--
-- ⚠️ 학년·소득구간의 0 은 '안 골랐다'다(app.js `Number(getChip('#in-year'))` 는 빈 칩에서 0).
--    0 을 그대로 두면 아래 CHECK 가 **정상 학생의 저장을 거절한다** → NULL 로 바꾼다.

alter table public.profiles
  add column if not exists school text
    generated always as (nullif(btrim(profile->>'school'), '')) stored,
  add column if not exists campus text
    generated always as (nullif(btrim(profile->>'campus'), '')) stored,
  add column if not exists major text
    generated always as (nullif(btrim(profile->>'major'), '')) stored,
  add column if not exists track text
    generated always as (nullif(btrim(profile->>'track'), '')) stored,
  add column if not exists enroll_status text
    generated always as (nullif(btrim(profile->>'status'), '')) stored,
  -- 성별은 프로필 뿌리가 아니라 `common` 묶음 안에 있다 (신청서를 채우다 배운 값)
  add column if not exists gender text
    generated always as (nullif(btrim(profile->'common'->>'gender'), '')) stored,
  add column if not exists grade smallint
    generated always as (
      case
        when nullif(btrim(profile->>'year'), '') is null      then null   -- 안 적었다
        when btrim(profile->>'year') = '0'                   then null   -- 칩을 안 골랐다
        when btrim(profile->>'year') ~ '^[0-9]{1,4}$'        then (btrim(profile->>'year'))::smallint
        else -1                                                          -- 읽을 수 없다 → 거절
      end
    ) stored,
  add column if not exists gpa numeric
    generated always as (
      case
        when nullif(btrim(profile->>'gpa'), '') is null                     then null
        -- ⚠️ 소수점 아래를 넉넉히 받는다 — 처음에 6자리로 잡았더니 `3.4285714` 를 적은
        --    **정상 학생**이 거절될 수 있었다(코드 리뷰에서 잡았다 · 앱은 반올림하지 않는다).
        when btrim(profile->>'gpa') ~ '^-?[0-9]{1,6}(\.[0-9]{1,30})?$'      then (btrim(profile->>'gpa'))::numeric
        else -1
      end
    ) stored,
  add column if not exists income_bracket smallint
    generated always as (
      case
        when nullif(btrim(profile->>'bracket'), '') is null   then null
        when btrim(profile->>'bracket') = '0'                 then null
        when btrim(profile->>'bracket') ~ '^[0-9]{1,4}$'      then (btrim(profile->>'bracket'))::smallint
        else -1
      end
    ) stored,
  -- ⚠️ 아래 둘은 뒤늦게 더했다 (2026-09-26 코드 리뷰). **둘 다 판정을 뒤집는다** —
  --    실측: '15학점 이상' 줄에서 `credits: 999999` 가 통과하고, `birthYear: 3000` 은
  --    나이가 **음수**가 되어 '만 30세 이하'를 통과했다.
  add column if not exists credits smallint
    generated always as (
      case
        when nullif(btrim(profile->>'credits'), '') is null    then null
        when btrim(profile->>'credits') ~ '^[0-9]{1,4}$'       then (btrim(profile->>'credits'))::smallint
        else -1
      end
    ) stored,
  add column if not exists birth_year smallint
    generated always as (
      case
        when nullif(btrim(profile->>'birthYear'), '') is null  then null
        when btrim(profile->>'birthYear') ~ '^[0-9]{1,4}$'     then (btrim(profile->>'birthYear'))::smallint
        else -1
      end
    ) stored;

-- ------------------------------------------------------------
-- ② DB 가 값을 검사한다 — 클라이언트를 믿지 않는다
-- ------------------------------------------------------------
-- `drop … if exists` 를 앞세운 이유: 이 파일을 두 번 붙여넣어도 오류가 나지 않게 한다.
-- 🔴 NULL 은 전부 통과시킨다 — '모른다'는 정상이고, 이 앱은 모르면 판정하지 않는다.

alter table public.profiles drop constraint if exists profiles_grade_range;
alter table public.profiles add  constraint profiles_grade_range
  check (grade is null or grade between 1 and 8);        -- 8: 초과학기·대학원까지 여유

alter table public.profiles drop constraint if exists profiles_gpa_range;
alter table public.profiles add  constraint profiles_gpa_range
  check (gpa is null or (gpa >= 0 and gpa <= 4.5));      -- 앱도 4.5 로 깎는다(collectProfile)

alter table public.profiles drop constraint if exists profiles_bracket_range;
alter table public.profiles add  constraint profiles_bracket_range
  check (income_bracket is null or income_bracket between 1 and 10);   -- 학자금지원구간 1~10

-- 🔴 아래 세 범위는 **`index.html` 의 입력칸 min/max 와 같은 숫자다.** 입력칸을 넓히면서
--    여기를 안 넓히면 정상 학생의 저장이 거절된다 — 관문이 두 곳을 대조한다.
alter table public.profiles drop constraint if exists profiles_credits_range;
alter table public.profiles add  constraint profiles_credits_range
  check (credits is null or credits between 0 and 30);          -- #in-credits min=0 max=30

alter table public.profiles drop constraint if exists profiles_birth_year_range;
alter table public.profiles add  constraint profiles_birth_year_range
  check (birth_year is null or birth_year between 1940 and 2020);  -- #in-birth-year min=1940 max=2020
-- ⚠️ 위 상한이 '미래 출생연도'도 함께 막는다 — 나이가 음수가 되면 '만 n세 이하'를 통과한다.
--    `now()` 는 generated 칸에 쓸 수 없으므로(불변 함수만) 입력칸과 같은 고정값으로 둔다.

alter table public.profiles drop constraint if exists profiles_text_len;
alter table public.profiles add  constraint profiles_text_len
  check (
        (school        is null or char_length(school)        <= 60)
    and (campus        is null or char_length(campus)        <= 40)
    and (major         is null or char_length(major)         <= 60)
    and (track         is null or char_length(track)         <= 30)
    and (enroll_status is null or char_length(enroll_status) <= 20)
    and (gender        is null or char_length(gender)        <= 20)
  );

-- ------------------------------------------------------------
-- ③ 색인은 아직 만들지 않는다
-- ------------------------------------------------------------
-- 지금 이 칸들로 검색하는 코드가 없다. 쓰지 않는 색인은 쓰기를 느리게만 한다.
-- '학교별 가입자 수' 같은 것을 실제로 세기 시작하면 그때 `create index … on profiles(school)`.

-- ============================================================
-- 붙여넣은 뒤 눈으로 확인 (한 줄씩 Run)
-- ============================================================
-- 칸이 생겼는가:
--   select school, campus, major, grade, gender, enroll_status, track, gpa, income_bracket
--     from public.profiles limit 20;
--
-- 제약이 걸렸는가 (네 줄이 나와야 한다):
--   select conname from pg_constraint
--    where conrelid = 'public.profiles'::regclass and conname like 'profiles_%';
--
-- 🔴 붙여넣을 때 `violates check constraint` 오류가 나면, **이미 있는 행 중에 이상한 값이 있다**는
--    뜻이다(0004 이전에 올라간 행은 검사를 받지 않았다). 어느 행인지 이렇게 찾는다:
--      select user_id, profile->>'gpa', profile->>'year', profile->>'bracket'
--        from public.profiles
--       where (profile->>'gpa') !~ '^[0-4](\.[0-9]+)?$|^$' ;
--    그 행을 고치거나 지운 뒤 다시 붙여넣는다. 값을 고칠 때는 학생 본인 것이므로 임의로
--    바꾸지 말고 해당 칸을 지운다(NULL = '모른다'가 이 앱의 안전한 기본값이다).
