# 자격 확인 도우미 (AI-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 온보딩에서 비워 둔 프로필 칸을, 그 칸이 필요해진 공고 상세 화면에서 물어 채우게 한다. 답은 프로필에 저장돼 모든 공고에 자동으로 쓰인다.

**Architecture:** 새 순수 모듈 `elig-ask.js`(브라우저·Node 겸용, `essay-ask.js` 와 같은 방식)가 "이 줄을 푸는 프로필 칸이 무엇인가"를 **탐침 값을 넣고 화면이 쓰는 `requirementMatch` 를 다시 돌려** 정한다. 화면은 `app.js` 의 `reqRow` 한 자리에 단추를 달고, 시트는 이미 있는 `openSheetShell()` 그릇을 쓴다. 저장은 `state.profile` → `saveState()` 기존 경로 그대로라 서버 전송·알림 판정이 저절로 따라온다.

**Tech Stack:** 순수 정적 파일(빌드 없음) · CommonJS/전역 겸용 JS · Node 18+ 검사(`verify/test-collector.mjs`) · Playwright 브라우저 검사(`verify/*.js`)

**설계 문서:** [docs/designs/eligibility-ask.md](../../designs/eligibility-ask.md) — 갈림길마다 왜 그렇게 정했는지는 거기 있다.

## Global Constraints

이 저장소의 규칙이다. **모든 태스크의 요구사항에 이것이 포함된다.**

- **작업 브랜치**: `claude/notion-task-search-5e1ec5` (현재 워크트리). 기본 브랜치는 `claude/nice-heisenberg-WESq5`, 배포는 `main`. 푸시는 세 브랜치 관례를 따른다.
- **화면에 새로 넣는 한국어는 이것뿐**: `적어서 확인`(줄 아래 단추 · 2026-09-17 개발자 확정) · `미확인 자격` · `저장` · `저장됨` · 칸 라벨(`평점`·`직전 학기 이수학점`·`학자금 지원구간`·`태어난 해`·`국적`·`학과`·`거주 시·군·구`). **설명 문장·안내 문장을 새로 넣지 않는다.**
- **느낌표 0개** · **1인칭 서비스 말투 0개**(`드릴게요`·`드려요`·`챙겨드`·`알려드`·`찾아드`·`보내 드`·`해 드리`) — `verify/ui-tone.mjs` 가 막는다.
- **"받을 수 있는지 알 수 있어요" 류 장담 금지.** 앱은 공고에 적힌 요건 중 자기가 읽어낸 것만 안다.
- **색 토큰은 이미 있는 것만**: 충족 `var(--green)`(#3d6b47) · 미달 `var(--red)`(#8f3a2e) · 흐린 글자 `var(--text-weak)`. 모서리는 `--radius-sm`(13px)·`--radius-pill`. **새 토큰·토큰 밖 값 금지** — `verify/ui-tone.mjs` '토큰 이탈' 톱니가 지금 값을 천장으로 잡고 있다.
- **모르면 판정하지 않는다.** 빈 칸은 `null` 로 둔다. `0`·기본값을 넣으면 엉뚱한 판정이 난다.
- **`flags`·`scholarships` 는 빈 배열(`[]` = 없다고 답함)과 `null`(= 아직 안 물음)이 다르다.** 뭉개면 안 된다.
- **프로필을 직접 서버로 보내지 않는다.** `state.profile` 에 넣고 `saveState()` 만 부른다 — `supabase-client.js` 의 `syncSafeProfile()` 이 주민번호·계좌를 떼는 유일한 자리다.
- **새 검사는 red-green 으로 확인한다.** 고친 것을 되돌려 실제로 빨간불이 되는지 본 뒤에야 진짜다.
- **커밋 메시지 끝에** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` 을 붙인다.
- **데이터 파일(`data/registered.json`·`forms.json`)은 건드리지 않는다.** 이 작업은 코드만 고친다.

---

## File Structure

| 파일 | 하는 일 | 새로 만드나 |
|---|---|---|
| `elig-ask.js` | **무엇을 물을까** — `askableFields`·`askableForSch`·`FIELD_META`. 순수 함수만, 사실을 만들지 않는다 | 새로 만든다 |
| `app.js` | `reqRow` 에 단추 · `openEligAsk(schId)` 시트 · 저장 | 고친다 |
| `style.css` | 시트 안 줄 목록·접기 표시 규칙 | 고친다 (끝에 추가) |
| `index.html` | `elig-ask.js` 를 `match-engine.js` **뒤에** 싣는다 | 고친다 |
| `sw.js` | `ASSETS` 에 `elig-ask.js` 추가 · `CACHE` 번호 인상 | 고친다 |
| `verify/test-collector.mjs` | 「자격 묻기」 절 — 순수 로직 관문 | 고친다 (끝에 추가) |
| `verify/verify-elig-ask.js` | 브라우저 관문 — 단추를 눌러 실제로 동작하는가 | 새로 만든다 |
| `.github/workflows/verify-ui.yml` | 브라우저 검사 목록에 등록 | 고친다 |

🔴 `sw.js` 의 `importScripts` 에는 **넣지 않는다.** 서비스워커는 알림만 판정하고 묻지 않는다. 넣으면 경계가 흐려진다.

🔴 `_admin/build.sh` 의 vendor 목록에도 **넣지 않는다.** 관리자 화면은 이 기능을 안 쓴다.

---

## Task 1: `elig-ask.js` — 「채우면 판정이 달라지는가」 판정

이 태스크가 설계의 심장이다. `백분율환산 85점` 같은 줄은 평점을 적어도 파서가 여전히 못 읽으므로 **단추를 달면 안 된다.** 규칙표를 손으로 적는 대신 탐침 값을 넣고 다시 판정한다.

**Files:**
- Create: `elig-ask.js`
- Test: `verify/test-collector.mjs` (파일 끝에 절 추가)

**Interfaces:**
- Consumes: `match-engine.js` 의 `requirementMatch(line, profile, sch)` → `'ok' | 'no' | null` — **화면(`reqRow`)이 쓰는 바로 그 함수다**
- Produces:
  - `FIELD_PROBE` — `{ [profileKey]: any[] }` 물어볼 수 있는 칸과 그 탐침 값
  - `askableFields(line, profile, sch)` → `string[]` (프로필 칸 이름, `FIELD_PROBE` 키 순서)

🔴 **`judgeCond` 를 조건마다 부르지 않는다** (사전 점검 2026-09-17 에서 잡았다). `judgeCond` 로 바로 가면 화면이 쓰는 관문들(경우별 분기 `caseBranch` · 표 라벨 `gradTarget` · 선택지 묶음 · `unaskedAttr`)을 건너뛴다. 실제로 `신입생: 2026년 1학기 85점 이상` 줄이 **재학생에게 「평점을 물어라」** 를 냈다 — 그 줄은 평점을 적어도 영영 판정되지 않는다(재학생의 줄이 아니니까). `requirementMatch` 를 탐침하면 규칙이 **갈라질 수가 없다.**

- [ ] **Step 1: 실패하는 회귀를 먼저 쓴다**

`verify/test-collector.mjs` 의 `process.exit(fail ? 1 : 0);` **바로 위**에 붙인다:

```js
/* ── 자격 묻기 — 채워도 판정이 안 바뀌는 줄에는 묻지 않는다 (2026-09-17 · 노션 AI-1) ──
   🔴 이 절이 이 기능의 심장이다. 적어도 안 풀리는 줄에 단추를 달면
      **학생이 적었는데 화면이 그대로다** — 묻지 않는 것보다 나쁘다.
   🔴 판정은 화면이 쓰는 `requirementMatch` 를 그대로 탐침해서 낸다. judgeCond 로
      바로 가면 경우별 분기·표 라벨·선택지 묶음 관문을 건너뛴다(사전 점검에서 실제로
      `신입생:` 줄이 재학생에게 '평점을 물어라'를 냈다).
   ⚠️ 아래 줄과 기대값은 **실제로 재서 얻은 것**이다(2026-09-17). 지어내지 말 것.
      기대값이 안 맞으면 코드를 의심하기 전에 이 값을 다시 재 볼 것. */
console.log('\n■ 자격 묻기 — 무엇을 물을 수 있나');
{
  const EA = createRequire(import.meta.url)('../elig-ask.js');
  /* 온보딩 선택 칸을 하나도 안 채운 학생 — 필수(학교·캠퍼스·학년·학적)만 있다 */
  const bare = { school: '경희대학교', campus: '서울', year: 3, status: '재학' };
  const sch = { id: 't', name: '두을장학재단', provider: '두을장학재단' };
  const L45 = '26년 정규 1학기를 총 15학점 이상 이수하고, 성적을 3.5/4.5 이상 취득한 자';

  eq('평점과 이수학점을 묻는다 (4.5 만점으로 적힌 줄)',
    EA.askableFields(L45, bare, sch), ['gpa', 'credits']);

  /* 🔴 되돌림 방지 — 백분위 성적은 평점을 적어도 그 줄이 안 풀린다(줄이 풀리려면
     조건이 **전부** 풀려야 하는데 환산 조건이 막혀 있다). 학점만 묻는 것이 맞다. */
  eq('백분율환산 줄에서는 평점을 묻지 않는다 (학점만)',
    EA.askableFields('학기별 최소 9학점 이상 이수하고 평점평균(백분율환산)이 85점 이상인 자', bare, sch),
    ['credits']);

  /* 🔴 되돌림 방지 — 재학생에게 `신입생:` 줄은 영영 판정되지 않는다 */
  eq('내 경우가 아닌 분기 줄은 묻지 않는다',
    EA.askableFields('신입생: 2026년 1학기 85점 이상', bare, sch), []);

  eq('자격이 아닌 줄은 묻지 않는다 (접수 주소)',
    EA.askableFields('[13620] 경기도 성남시 분당구 구미로 173번길 82 분당서울대학교병원 2동 7층', bare, sch), []);
  eq('절 제목은 묻지 않는다', EA.askableFields('2. 신청자격', bare, sch), []);

  eq('소득구간을 묻는다',
    EA.askableFields('한국장학재단 학자금 지원구간 8구간 이내인 자', bare, sch), ['bracket']);
  eq('국적을 묻는다',
    EA.askableFields('대한민국 국적을 가진 자에 한함', bare, sch), ['nationality']);

  /* 🔴 이미 채운 칸은 다시 묻지 않는다 */
  eq('이미 적은 칸은 묻지 않는다',
    EA.askableFields(L45, { ...bare, gpa: 3.42 }, sch), ['credits']);
  eq('  둘 다 적었으면 물을 것이 없다 (판정이 났으므로)',
    EA.askableFields(L45, { ...bare, gpa: 3.42, credits: 15 }, sch), []);
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node verify/test-collector.mjs 2>&1 | tail -20`
Expected: `Cannot find module '../elig-ask.js'` 로 죽는다.

- [ ] **Step 3: `elig-ask.js` 를 만든다**

```js
/* ============================================================
   한대장 — 자격 확인 도우미: 무엇을 물을까 (2026-09-17 · 노션 AI-1)
   ------------------------------------------------------------
   🔴 이 파일이 있는 이유 (실측 2026-09-17):

     마감 안 지난 등록 공고 20건의 자격 줄 70줄 중, 온보딩을 빠짐없이 채운 학생은
     19줄을 판정받고 **필수만 채운 학생은 4줄**을 판정받는다. 못 읽는 원인은 파서가
     아니라 **학생이 비워 둔 프로필 칸**이었다. 그 칸을 필요해진 자리에서 묻는다.

   🔴 이 파일의 심장 — **채워도 판정이 안 바뀌는 줄에는 묻지 않는다.**
     `평점평균(백분율환산)이 85점 이상` 은 평점을 적어도 그 줄이 안 풀리고,
     `신입생:` 줄은 재학생에게 영영 판정되지 않는다. 거기에 단추를 달면
     학생이 적었는데 화면이 그대로다 — 묻지 않는 것보다 나쁘다.

     그래서 규칙표를 손으로 적지 않고 **화면이 쓰는 `requirementMatch` 를 그대로
     탐침한다.** 규칙이 갈라질 수가 없고, 파서가 좋아지면 물을 수 있는 줄이 저절로 는다.

   🔴 여기서 사실을 만들지 않는다. 정하는 것은 **무엇을 물을까**이지 답이 아니다.

   브라우저·Node 겸용 (match-engine.js·essay-ask.js 와 같은 방식) —
   화면과 검사가 같은 파일로 같은 결과를 봐야 한다.
   설계: docs/designs/eligibility-ask.md
   ============================================================ */

/* 판정기 — 브라우저는 전역, Node는 require.
   ⚠️ `window.requirementMatch` 로 찾으면 안 된다(서비스워커에는 window 가 없다).
   🔴 아래 전역 이름 목록에 빠뜨리면 **Node 검사는 다 통과하는데 앱이 죽는다** —
      match-engine 이 `unaskedAttr` 로 실제로 그렇게 죽었다(2026-08-24).
   🔴 **화면이 쓰는 그 함수 하나만** 쓴다. judgeCond 로 내려가면 경우별 분기·표 라벨·
      선택지 묶음 관문을 건너뛰어, 재학생에게 `신입생:` 줄의 평점을 묻게 된다. */
const EA_ME = (typeof module !== 'undefined' && module.exports)
  ? require('./match-engine.js')
  : { requirementMatch };

/* 물어볼 수 있는 칸과 그 **탐침 값**.
   🔴 칸 이름은 app.js `collectProfile()` 이 만드는 이름과 반드시 같아야 한다 —
      다르면 시트가 엉뚱한 칸에 저장하고 판정은 영영 안 바뀐다(관문이 대조한다).
   🔴 값은 양 끝을 넣는다. 한쪽이라도 줄을 풀면 물을 수 있는 칸이다.
      ⚠️ 양쪽 다 요구하면(엄격) 멀쩡한 경우가 통째로 죽는다 — `3.5/4.5 이상` 줄에
         평점 0 을 넣으면 judgeCond 가 'fail' 이 아니라 'unknown' 을 내기 때문이다(실측).
   ⚠️ 이 값들은 **화면에 안 나간다.** 판정이 달라지는지 보려고 잠깐 넣어 보는 것뿐이다.
   ⚠️ 여기 없는 것(학교·학년·학적)은 온보딩 필수라 늘 차 있다. */
const FIELD_PROBE = {
  gpa: [0, 4.5],
  credits: [0, 24],
  bracket: [1, 10],
  birthYear: [1980, 2010],
  nationality: ['대한민국', '기타'],
  major: ['국어국문학과', '기계공학과'],
  regionCity: ['종로구', '무안군'],
};

/* 이 줄을 푸는 프로필 칸이 무엇인가 → ['gpa', 'credits']
   빈 배열이면 물을 것이 없다(= 단추를 달지 않는다).

   ⚠️ 알려진 천장: 어떤 칸은 **탐침 값으로는 풀리는데 학생의 실제 값으로는 안 풀릴** 수
      있다. 그때는 적어도 그 줄이 흐린 채 남는다(틀린 말을 하지는 않는다). 실측 8줄에서는
      그런 경우가 없었고, 막으려면 칸마다 판정 가능 구간을 적어야 해서 하지 않는다. */
function askableFields(line, profile, sch) {
  const p = profile || {};
  if (EA_ME.requirementMatch(line, p, sch)) return [];   // 지금도 판정된다
  const out = [];
  for (const key of Object.keys(FIELD_PROBE)) {
    if (p[key] !== null && p[key] !== undefined && p[key] !== '') continue;  // 이미 적었다
    for (const v of FIELD_PROBE[key]) {
      const trial = Object.assign({}, p);
      trial[key] = v;
      if (EA_ME.requirementMatch(line, trial, sch)) { out.push(key); break; }
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { askableFields, FIELD_PROBE };
}
```

- [ ] **Step 4: 회귀를 돌려 통과를 확인한다**

Run: `node verify/test-collector.mjs 2>&1 | grep -A 12 "자격 묻기"`
Expected: 8항목 모두 `✓`.

기대 값이 실제와 다르면 **기대 값을 고치기 전에 원문 줄을 다시 읽는다.** 예를 들어 `학자금 지원구간 8구간 이내` 가 `[]` 를 내면 `parseBracket` 이 그 문구를 안 잡는 것이므로, 그 사실을 회귀 문구에 적고(`지금은 소득구간을 못 잡는다`) 이 태스크에서 파서는 고치지 않는다 — 설계 7절의 '이번에 안 하는 것'이다.

- [ ] **Step 5: red-green 으로 관문이 살아 있는지 확인한다**

`askableFields` 의 탐침 고리를 잠시 무력화한다 — 탐침 없이 **빈 칸이면 무조건** 묻게 만든다:

```js
    if (p[key] !== null && p[key] !== undefined && p[key] !== '') continue;
    out.push(key); continue;       // ← 이 줄을 넣어 탐침을 건너뛴다
    for (const v of FIELD_PROBE[key]) {
```

Run: `node verify/test-collector.mjs 2>&1 | grep "백분율환산\|분기 줄\|절 제목"`
Expected: 세 항목 모두 `✕` — **빨간불이 나와야 진짜다.** 확인했으면 넣은 줄을 지운다.

- [ ] **Step 6: 커밋**

```bash
git add elig-ask.js verify/test-collector.mjs
git commit -m "자격 묻기 ① 채우면 판정이 달라지는 칸만 고른다 (노션 AI-1)

규칙표를 손으로 적지 않고 **화면이 쓰는 requirementMatch 를 그대로 탐침**한다.
그래서 경우별 분기·표 라벨·선택지 묶음 관문이 저절로 지켜진다 —
재학생에게 '신입생:' 줄의 평점을 묻지 않고, 백분율환산 줄에서는 학점만 묻는다.
관문 9항목, red-green 확인(탐침을 건너뛰게 바꾸면 세 항목이 빨간불).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: 칸의 이름·단위·입력 규칙 (`FIELD_META`) 과 갈라짐 관문

칸 하나를 화면에 그리려면 라벨·단위·입력 규칙이 있어야 한다. **온보딩과 갈라지면 시트가 엉뚱한 칸에 저장한다** — 관문이 `collectProfile()` 과 대조한다.

**Files:**
- Modify: `elig-ask.js`
- Test: `verify/test-collector.mjs` (Task 1 이 만든 절 안에 이어 붙인다)

**Interfaces:**
- Consumes: Task 1 의 `askableFields(line, profile, sch)`·`FIELD_PROBE`
- Produces:
  - `FIELD_META` — `{ [key]: { label, kind, suffix?, min?, max?, step?, options? } }` · `kind` 는 `'number' | 'text' | 'select'`
  - `askableForSch(sch, profile)` → `string[]` — 그 공고의 자격 줄 전부에서 모은 칸(중복 없음)
  - `coerceField(key, raw)` → `number | string | null` — 입력 문자열을 프로필 값으로. 빈 값·못 읽는 값은 `null`

- [ ] **Step 1: 실패하는 회귀를 쓴다**

Task 1 이 만든 절의 닫는 `}` **앞**에 이어 붙인다:

```js
  /* ── 칸의 이름·단위 ─────────────────────────────────────────────
     🔴 칸 이름이 온보딩(app.js collectProfile)과 갈라지면 시트가 엉뚱한 칸에
        저장하고 판정은 영영 안 바뀐다. 사람이 기억하는 대신 소스를 대조한다. */
  eq('물을 수 있는 칸에는 전부 이름표가 있다',
    Object.keys(EA.FIELD_PROBE).filter((f) => !EA.FIELD_META[f]), []);
  eq('  이름표만 있고 탐침이 없는 칸은 없다 (물을 수 없는 칸을 화면에 그리지 않는다)',
    Object.keys(EA.FIELD_META).filter((f) => !EA.FIELD_PROBE[f]), []);

  {
    const appJs = readText(new URL('../app.js', import.meta.url));
    const body = appJs.slice(appJs.indexOf('function collectProfile()'),
      appJs.indexOf('function collectProfile()') + 2600);
    const made = new Set([...body.matchAll(/^\s{4}([A-Za-z_$][\w$]*):/gm)].map((m) => m[1]));
    eq('FIELD_META 의 칸 이름이 전부 온보딩이 만드는 칸이다',
      Object.keys(EA.FIELD_META).filter((k) => !made.has(k)), []);
  }

  /* 입력 문자열 → 프로필 값. 🔴 못 읽으면 0 이 아니라 null 이다(모르면 판정하지 않는다) */
  eq('평점은 숫자로 바뀐다', EA.coerceField('gpa', '3.42'), 3.42);
  eq('  빈 칸은 null', EA.coerceField('gpa', '  '), null);
  eq('  글자는 null (0 이 아니다)', EA.coerceField('gpa', '몰라요'), null);
  eq('  4.5 를 넘으면 4.5 로 깎는다 (온보딩과 같은 규칙)', EA.coerceField('gpa', '5.0'), 4.5);
  eq('  음수는 0 으로', EA.coerceField('gpa', '-1'), 0);
  eq('소득구간은 정수', EA.coerceField('bracket', '8'), 8);

  /* 공고 단위로 모은다 — 같은 칸을 두 번 담지 않는다 */
  {
    const many = { id: 't', name: '두을장학재단', provider: '두을장학재단', eligibilityLines: [
      L45,
      '직전 학기 평점 3.0 이상인 자',
      '대한민국 국적을 가진 자에 한함',
    ] };
    eq('공고의 자격 줄 전부에서 모으고 중복은 뺀다',
      EA.askableForSch(many, bare), ['gpa', 'credits', 'nationality']);
    eq('  자격 줄이 없는 공고에서도 죽지 않는다 (층2·상시 제도)',
      EA.askableForSch({ id: 'k', name: '상시' }, bare), []);
  }
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node verify/test-collector.mjs 2>&1 | grep -c "✕"`
Expected: `FIELD_META`·`coerceField`·`askableForSch` 가 없어 여러 항목이 `✕`.

- [ ] **Step 3: `elig-ask.js` 에 이어 붙인다**

`askableFields` 함수 **아래**, `module.exports` **위**에 넣는다:

```js
/* 칸 하나를 화면에 그리는 데 필요한 것.
   🔴 라벨은 온보딩(index.html)이 쓰는 말과 같은 말이어야 한다 — 같은 값을 두 화면이
      다르게 부르면 학생이 다른 것을 묻는 줄 안다.
   🔴 `label` 은 칸 이름이지 문장이 아니다. 여기에 설명을 넣지 말 것
      (화면에 새로 넣는 한국어를 늘리지 않는다 — 설계 3-3). */
const FIELD_META = {
  gpa:         { label: '평점', kind: 'number', suffix: '/ 4.5', min: 0, max: 4.5, step: 0.01 },
  credits:     { label: '직전 학기 이수학점', kind: 'number', min: 0, max: 30, step: 1 },
  bracket:     { label: '학자금 지원구간', kind: 'number', min: 0, max: 10, step: 1 },
  birthYear:   { label: '태어난 해', kind: 'number', min: 1950, max: 2015, step: 1 },
  nationality: { label: '국적', kind: 'select', options: ['대한민국', '기타'] },
  major:       { label: '학과', kind: 'text' },
  regionCity:  { label: '거주 시·군·구', kind: 'text' },
};

/* 입력 문자열 → 프로필에 넣을 값.
   🔴 못 읽으면 **0 이 아니라 null** 이다. 0 을 넣으면 '평점 0.0' 인 학생이 되어
      멀쩡한 공고가 전부 미달로 뒤집힌다(모르면 판정하지 않는다). */
function coerceField(key, raw) {
  const meta = FIELD_META[key];
  if (!meta) return null;
  const s = String(raw == null ? '' : raw).trim();
  if (s === '') return null;
  if (meta.kind === 'number') {
    const n = parseFloat(s);
    if (Number.isNaN(n)) return null;
    const lo = meta.min == null ? -Infinity : meta.min;
    const hi = meta.max == null ? Infinity : meta.max;
    const clamped = Math.min(hi, Math.max(lo, n));
    return meta.step === 1 ? Math.round(clamped) : clamped;
  }
  return s;
}

/* 이 공고에서 물을 수 있는 칸 전부 (자격 줄을 다 훑어 중복 제거).
   ⚠️ 자격 줄이 없는 공고(층2 KOSAF·상시 제도)에서도 죽지 않아야 한다 — 빈 배열을 낸다. */
function askableForSch(sch, profile) {
  const lines = (sch && sch.eligibilityLines) || [];
  const out = [];
  for (const line of lines) {
    for (const k of askableFields(line, profile, sch)) {
      if (out.indexOf(k) === -1) out.push(k);
    }
  }
  return out;
}
```

`module.exports` 를 이렇게 바꾼다:

```js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { askableFields, askableForSch, coerceField, FIELD_META, FIELD_PROBE };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node verify/test-collector.mjs 2>&1 | grep -A 22 "자격 묻기"`
Expected: 전 항목 `✓`.

`FIELD_META 의 칸 이름이 전부 온보딩이 만드는 칸이다` 가 실패하면 **`FIELD_META` 쪽을 고친다** — `collectProfile()` 을 고치지 말 것. 온보딩이 원본이다.

- [ ] **Step 5: red-green**

`FIELD_META` 의 `credits` 를 `credit` 으로 잠시 오타 낸다.
Run: `node verify/test-collector.mjs 2>&1 | grep "이름표\|온보딩이 만드는"`
Expected: `✕` 두 줄. 확인했으면 되돌린다.

- [ ] **Step 6: 커밋**

```bash
git add elig-ask.js verify/test-collector.mjs
git commit -m "자격 묻기 ② 칸의 이름·단위 + 온보딩과 갈라짐 관문 (노션 AI-1)

칸 이름이 collectProfile 과 갈라지면 시트가 엉뚱한 칸에 저장한다 —
소스를 대조하는 관문을 뒀다. 못 읽는 입력은 0 이 아니라 null 이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: 화면 — 줄 아래 단추와 시트

**Files:**
- Modify: `app.js:2941-2950` (`reqRow`) · `app.js` (새 함수 `openEligAsk`·`eligAskSave`)
- Modify: `style.css` (파일 끝)
- Modify: `index.html` (`match-engine.js` 다음 줄)
- Modify: `sw.js` (`ASSETS`·`CACHE`)

**Interfaces:**
- Consumes: Task 2 의 `askableFields`·`askableForSch`·`coerceField`·`FIELD_META` (브라우저 전역) · `app.js` 의 `openSheetShell()`·`dismissSheet()`·`sheetBack`·`allScholarships()`(app.js:149)·`renderHome()`(1443)·`renderExplore()`(1602)·`openDetail(id)`(2886)
- Produces: `openEligAsk(schId, open)` · `eligAskSave(schId)` · `eligAskHtml(sch, open)`

🔴 **시트 그릇의 진실**: `#detail-sheet` 은 `innerHTML` 이 **통째로 교체**된다(`app.js:2722` 금액 상세가 그 예다). 그러니 "시트 뒤에 자격 블록이 남아 있다"는 것은 **없다.** 돌아갈 곳은 `sheetBack`(app.js:3466 `dismissSheet`·3493 `rememberAmountBack`)이 맡는다 — 자격 묻기 시트를 열기 전에 `sheetBack` 을 **그 공고 상세로** 걸어 둔다. 그래야 쓸어 내렸을 때 목록이 아니라 공고로 돌아간다.

🔴 **배선은 이벤트 위임이 아니라 `innerHTML` 뒤 `addEventListener`** 다 — `openDetail` 이 그렇게 한다(`$('#btn-apply-one').addEventListener(...)` 계열). 인라인 `onclick` 은 CSP(`script-src 'self'`)가 조용히 막으므로 쓰지 않는다. 단, `reqRow` 가 만드는 단추는 `openDetail` 이 그린 뒤에 배선한다.

- [ ] **Step 1: `elig-ask.js` 를 싣는다**

`index.html` 에서 `<script src="match-engine.js"></script>` **바로 아래**에 넣는다:

```html
    <script src="elig-ask.js"></script>
```

🔴 `match-engine.js` 보다 **뒤**여야 한다 — `requirementMatch` 전역이 먼저 있어야 한다. `section-head.js` 를 `match-engine.js` 보다 먼저 싣지 않아 앱이 첫 카드에서 죽은 적이 있다(2026-08-24).

`sw.js` 의 `ASSETS` 배열 첫 줄, `'essay-submit-check.js',` 뒤에 `'elig-ask.js',` 를 넣고 `CACHE` 를 한 단 올린다:

```js
const CACHE = 'handaejang-v189';  /* v189 — 자격 확인 도우미: 못 읽은 자격을 그 자리에서 묻는다 (노션 AI-1) */
```

🔴 `importScripts` 에는 **넣지 않는다.**

- [ ] **Step 2: 실린 순서를 확인한다**

Run:
```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');const i=(s)=>h.indexOf('src=\"'+s+'\"');console.log('match-engine',i('match-engine.js'),'elig-ask',i('elig-ask.js'),'app',i('app.js'));"
```
Expected: `match-engine` < `elig-ask` < `app` 순서의 숫자.

- [ ] **Step 3: `reqRow` 에 단추를 단다**

`app.js:2941` 의 `reqRow` 를 이렇게 바꾼다:

```js
  const reqRow = (e, extra) => {
    const m = requirementMatch(e, state.profile, sch);
    /* 🔴 `r-req`는 **자격 요건·먼저 뽑는 기준·제외** 세 블록이 함께 쓴다. 그래서 밖에서는
       어느 줄이 자격인지 가릴 수 없었다(검사가 셋을 다 세고 있었다 — 2026-08-26).
       자격 줄에만 `r-elig`를 달아 구분한다. 보이는 모양은 그대로다. */
    const cls = m === 'ok' ? 'r-elig r-ok' : m === 'no' ? 'r-elig r-bad' : 'r-elig r-req';
    const mark = m === 'ok' ? '✓ ' : m === 'no' ? '✕ ' : '';
    /* 🔴 판정이 없고 **적으면 판정이 생기는** 줄에만 단추를 단다 (2026-09-17 · 노션 AI-1).
       적어도 안 풀리는 줄(`백분율환산 85점`)에 달면 학생이 적었는데 화면이 그대로다.
       판정은 elig-ask.js 한 곳 — 여기서 규칙을 새로 만들지 않는다.
       ⚠️ 목록 카드(schCard)에는 달지 않는다. 카드는 5줄 상한이고 카드 전체가 누르는
          자리라 손가락이 엉뚱한 곳을 친다. */
    let ask = '';
    if (!m && typeof askableFields === 'function'
        && askableFields(e, state.profile, sch).length) {
      ask = `<button type="button" class="elig-ask-btn" data-elig-ask="${esc(sch.id)}">적어서 확인</button>`;
    }
    return `<li class="${cls}${extra ? ' ' + extra : ''}">${mark}${esc(e)}${ask}</li>`;
  };
```

- [ ] **Step 4: 시트를 연다**

`app.js` 의 `openSheetShell` 함수 **위**에 넣는다:

```js
/* ── 자격 확인 도우미 — 못 읽은 자격을 그 자리에서 묻는다 (2026-09-17 · 노션 AI-1) ──
   🔴 앱이 하는 말은 「미확인 자격 n」 하나다. 설명·약속 문장을 넣지 말 것 —
      앱이 아는 것은 공고에 적힌 요건 중 **자기가 읽어낸 것**뿐이고, 적는다고
      좋은 소식이 는 것도 아니다(적은 결과가 ✕ 일 수 있다). 설계 3-2.
   🔴 시트 그릇은 `#detail-sheet` 를 그대로 쓴다 — 쓸어 닫기·배경·ESC 가 이미 배선돼 있다.
   설계: docs/designs/eligibility-ask.md */
let eligAskUnread = [];     /* 이 시트가 펼쳐 보여 주는 미확인 줄 (원문 그대로) */

function eligAskHtml(sch, open) {
  const keys = askableForSch(sch, state.profile);
  const unread = (sch.eligibilityLines || [])
    .filter((l) => !requirementMatch(l, state.profile, sch));
  eligAskUnread = unread;
  const rows = keys.map((k) => {
    const f = FIELD_META[k];
    const val = state.profile && state.profile[k] != null ? String(state.profile[k]) : '';
    const input = f.kind === 'select'
      ? `<select class="elig-ask-in" data-elig-field="${k}">`
        + `<option value=""></option>`
        + f.options.map((o) => `<option${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')
        + `</select>`
      : `<input class="elig-ask-in" data-elig-field="${k}" value="${esc(val)}"`
        + (f.kind === 'number' ? ` type="number" inputmode="decimal" step="${f.step}" min="${f.min}" max="${f.max}"` : ' type="text"')
        + `>`;
    return `<label class="elig-ask-row"><span>${esc(f.label)}</span>`
      + `<span class="elig-ask-wrap">${input}`
      + (f.suffix ? `<em>${esc(f.suffix)}</em>` : '') + `</span></label>`;
  }).join('');
  /* 줄 목록은 접어 둔다 — 라벨을 누르면 펼친다 */
  const list = open
    ? `<ul class="elig-ask-lines">` + unread.map((l) => {
        const m = requirementMatch(l, state.profile, sch);
        const c = m === 'ok' ? ' class="ok"' : m === 'no' ? ' class="bad"' : '';
        return `<li${c}>${esc(l)}</li>`;
      }).join('') + `</ul>`
    : '';
  return `<div class="elig-ask">`
    + `<button type="button" class="elig-ask-head" data-elig-toggle="${esc(sch.id)}" aria-expanded="${open ? 'true' : 'false'}">`
    + `미확인 자격 <b>${unread.length}</b><i>${open ? '▴' : '▾'}</i></button>`
    + list + rows
    + `<button type="button" class="elig-ask-save" data-elig-save="${esc(sch.id)}">저장</button>`
    + `</div>`;
}

/* 🔴 `#detail-sheet` 은 innerHTML 이 통째로 갈린다(금액 상세와 같은 방식 · app.js:2722).
   그래서 돌아갈 곳은 `sheetBack` 이 맡는다 — 걸어 두지 않으면 쓸어 내렸을 때
   공고가 아니라 목록으로 튄다. */
function openEligAsk(schId, open) {
  const sch = allScholarships().find((s) => s.id === schId);
  if (!sch) return;
  const y = $('#detail-sheet').scrollTop;
  openSheetShell();
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">${eligAskHtml(sch, !!open)}</div>`;
  sheetBack = () => { openDetail(schId); $('#detail-sheet').scrollTop = y; };
  eligAskWire(schId);
}

/* innerHTML 을 채운 **뒤에** 배선한다 — openDetail 이 쓰는 방식 그대로.
   🔴 인라인 `onclick` 은 CSP(`script-src 'self'`)가 조용히 막는다(2026-09-09 boot.js). */
function eligAskWire(schId) {
  const sheet = $('#detail-sheet');
  const tog = $('[data-elig-toggle]', sheet);
  if (tog) tog.addEventListener('click',
    () => openEligAsk(schId, tog.getAttribute('aria-expanded') !== 'true'));
  const save = $('[data-elig-save]', sheet);
  if (save) save.addEventListener('click', () => eligAskSave(schId));
}

function eligAskSave(schId) {
  const sheet = $('#detail-sheet');
  $$('[data-elig-field]', sheet).forEach((el) => {
    state.profile[el.dataset.eligField] = coerceField(el.dataset.eligField, el.value);
  });
  saveState();
  /* 적은 것이 다른 공고에도 쓰이므로 목록·홈도 다시 그린다 */
  renderHome();
  renderExplore();
  const back = sheetBack;           /* 되돌아갈 곳은 그대로 둔다 */
  openEligAsk(schId, true);         /* 줄이 펼쳐진 채로 색이 바뀐 것을 보여 준다 */
  sheetBack = back;
}
```

- [ ] **Step 5: 상세 화면의 단추를 배선한다**

`reqRow` 가 만든 `[data-elig-ask]` 는 `openDetail` 이 그린 것이라 **`openDetail` 안에서** 배선한다. `openDetail` 이 `$('#btn-apply-one').addEventListener(...)` 계열을 부르는 자리(app.js 3197 부근, `innerHTML` 을 채운 뒤)에 이어 붙인다:

```js
  /* 자격 묻기 — 못 읽은 줄 아래 단추 (2026-09-17 · 노션 AI-1) */
  $$('[data-elig-ask]', $('#detail-sheet')).forEach((b) => {
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();        /* 카드 전체가 누르는 자리라 위로 안 새게 막는다 */
      rememberEligBack(sch.id);
      openEligAsk(b.dataset.eligAsk, false);
    });
  });
```

그리고 `rememberAmountBack`(app.js:3493) **아래**에 짝을 만든다:

```js
/* 자격 묻기 시트에서 쓸어 내리면 보던 공고로 돌아간다 (금액 상세와 같은 방식) */
function rememberEligBack(schId) {
  const y = $('#detail-sheet').scrollTop;
  sheetBack = () => { openDetail(schId); $('#detail-sheet').scrollTop = y; };
}
```

⚠️ `openDetail` 안에서 그 공고를 가리키는 변수 이름이 `sch` 가 아니면 **그 이름에 맞춘다** — 이름을 바꾸지 말 것. 확인:

```bash
sed -n '2886,2900p' app.js
```

- [ ] **Step 6: 모양을 입힌다**

`style.css` **맨 끝**에 붙인다. 🔴 토큰 밖의 값을 쓰지 않는다 — `verify/ui-tone.mjs` 의 '토큰 이탈' 톱니가 지금 값을 천장으로 잡고 있다.

```css
/* ── 자격 확인 도우미 (2026-09-17 · 노션 AI-1) ─────────────────────────────
   🔴 앱이 하는 말은 「미확인 자격 n」뿐이다. 설명 문장을 넣지 말 것(설계 3-2).
   🔴 저장 뒤 줄은 **글자 색만** 바뀐다 — 마커(✓·✕)도 배경도 안 넣는다(개발자 지시). */
.elig-ask-btn {
  display: inline-block; margin-left: var(--space-8);
  background: none; border: 0; padding: 0;
  color: var(--accent); font-size: 12.5px; font-weight: 500;
}
.elig-ask-head {
  display: flex; align-items: center; gap: var(--space-4);
  background: none; border: 0; padding: 0; margin-bottom: var(--space-12);
  color: var(--text-weak); font-size: 11.5px;
}
.elig-ask-head b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
.elig-ask-head i { color: var(--text-weak); font-style: normal; font-size: 10px; }
.elig-ask-lines { list-style: none; margin: 0 0 var(--space-12); padding: 0; }
.elig-ask-lines li {
  font-size: 13px; line-height: 1.55; padding: var(--space-2) 0;
  color: var(--text-weak);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.elig-ask-lines li.ok  { color: var(--green); }
.elig-ask-lines li.bad { color: var(--red); }
.elig-ask-row { display: block; margin-bottom: var(--space-12); }
.elig-ask-row > span:first-child {
  display: block; font-size: 12px; color: var(--text-sub); margin-bottom: var(--space-6);
}
.elig-ask-wrap { position: relative; display: block; }
.elig-ask-wrap em {
  position: absolute; right: var(--space-12); top: 50%; transform: translateY(-50%);
  font-style: normal; font-size: 12px; color: var(--text-weak);
}
.elig-ask-in {
  width: 100%; box-sizing: border-box;
  background: var(--surface); border: 1px solid var(--line);
  border-radius: var(--radius-sm); padding: var(--space-8) var(--space-12);
  font: inherit; font-size: 15px; color: var(--text);
}
.elig-ask-save {
  width: 100%; background: var(--accent); color: #fff; border: 0;
  border-radius: var(--radius-pill); padding: var(--space-12);
  font-size: 14.5px; font-weight: 600;
}
```

- [ ] **Step 7: 앱을 띄워 눈으로 본다**

```bash
PORT=8137 python3 -m http.server 8137
```

🔴 **포트를 반드시 준다** — 8123은 다른 워크트리 서버일 수 있다. `drive.js` 가 두 번 연속 통과했는데 전부 남의 코드였던 적이 있다.

브라우저로 `http://localhost:8137` 을 열어 온보딩에서 **평점·이수학점을 비워 두고** 끝낸 뒤, 공고 상세를 열어 확인한다:
- 단추가 못 읽은 줄 아래에만 있는가 (`백분율환산` 줄에는 없어야 한다)
- 누르면 시트가 뜨고 `미확인 자격 n` 이 맞는가
- `▾` 를 누르면 줄이 흐린 글자로 펼쳐지는가
- 적고 저장하면 **그 줄의 색만** 바뀌는가 (충족 초록 · 미달 빨강, 마커 없음)

- [ ] **Step 8: 말투·토큰 관문**

Run: `node verify/ui-tone.mjs 2>&1 | tail -20`
Expected: `✓ 말투·토큰 관문 전부 통과`

실패하면 **관문을 고치지 말고 화면을 고친다.** 토큰 이탈이 늘었다면 위 CSS 에 토큰 밖 값이 들어간 것이다.

- [ ] **Step 9: 커밋**

```bash
git add index.html sw.js app.js style.css
git commit -m "자격 묻기 ③ 줄 아래 단추와 시트 (노션 AI-1 · 개발자 화면 승인)

미확인 줄은 접어 두고 ▾ 로 펼친다 · 칸은 하나씩 세로 ·
앱이 하는 말은 '미확인 자격 n' 하나 · 저장하면 그 줄의 글자 색만 바뀐다.
CSP 가 onclick 을 막으므로 이벤트 위임으로 배선했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: 브라우저 관문

글자만 보는 검사는 "단추가 붙는가"까지만 안다. **눌러서 실제로 값이 저장되고 색이 바뀌는지**는 브라우저로만 잴 수 있다.

**Files:**
- Create: `verify/verify-elig-ask.js`
- Modify: `.github/workflows/verify-ui.yml:134-140` (검사 목록)

**Interfaces:**
- Consumes: `verify/onboard-helper.js` 의 `nextUntil(page, selector)` · `dismissNotify(page)`

- [ ] **Step 1: 헬퍼가 무엇을 내주는지 확인한다**

```bash
grep -n "module.exports\|^async function" verify/onboard-helper.js
head -40 verify/verify-interactions.js
```

새 드라이버는 **가장 최근에 만들어진 드라이버의 뼈대를 그대로 베낀다**(브라우저 경로·포트·온보딩 처리가 이미 옳게 돼 있다).

- [ ] **Step 2: 드라이버를 쓴다**

`verify/verify-elig-ask.js` 를 만든다. 뼈대는 `verify-interactions.js` 를 따르고, 재는 것은 이것이다:

```js
/* 자격 확인 도우미 — 눌러서 실제로 동작하는가 (2026-09-17 · 노션 AI-1)
   🔴 글자만 보는 검사(test-collector)는 '단추가 붙는가'까지만 안다.
      값이 저장되고 색이 바뀌는지는 브라우저로만 잴 수 있다.
   🔴 온보딩 단계 번호를 박지 말 것 — nextUntil 로 칸이 보일 때까지 누른다.
   🔴 PORT 를 반드시 준다 — 8123 은 다른 워크트리 서버일 수 있다. */
```

재는 항목(각각 `eq` 한 줄):

1. `평점·이수학점을 비운 프로필`로 온보딩을 마치면, 공고 상세에 `[data-elig-ask]` 가 **1개 이상** 있다
2. 그 단추를 누르면 `#detail-sheet` 안에 `.elig-ask` 가 보인다
3. 시트의 `미확인 자격 n` 의 `n` 이 **판정 없는 줄 수와 같다**(화면에서 센 값과 대조)
4. 기본 상태에서 `.elig-ask-lines` 는 **없다**(접혀 있다)
5. `[data-elig-toggle]` 을 누르면 `.elig-ask-lines li` 가 나타난다
6. 칸에 값을 넣고 `[data-elig-save]` 를 누르면 `localStorage` 의 프로필에 그 값이 **숫자로** 들어간다
7. 저장 뒤 그 줄이 `.ok` 또는 `.bad` 를 갖는다 (**색만** — `textContent` 에 `✓`·`✕` 가 **없다**)
8. 시트를 닫고 같은 공고를 다시 열면 그 자격 줄에 `[data-elig-ask]` 가 **없다**(이미 적었으므로)
9. **다른 공고**를 열어도 그 값이 반영돼 있다 (재사용 — 같은 칸을 묻는 공고가 있을 때만, 없으면 건너뛴다고 알린다)

🔴 **공고 id 를 박지 말 것.** `askableForSch` 가 비어 있지 않은 공고를 **그때그때 고른다**. 하나도 없으면 건너뛴다고 알리고 종료 코드 0 으로 끝낸다(마감이 지나 대상이 사라져도 검사가 죽지 않게).

🔴 알림 동의 시트를 스스로 치운다 — `dismissNotify(page)`. 온보딩 2.9초 뒤에 떠서 그때부터 클릭을 전부 막는다(세 번 재발한 자리다).

- [ ] **Step 3: 돌려서 통과를 확인한다**

```bash
export CHROME_PATH="$(ls -d ~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/'Google Chrome for Testing.app'/Contents/MacOS/'Google Chrome for Testing' | head -1)"
PORT=8137 node verify/verify-elig-ask.js
```

🔴 `verify/README.md` 의 경로(`/opt/pw-browsers/...`)는 **클라우드 샌드박스(Linux)용**이라 이 맥에는 없다. 버전 번호를 하드코딩하지 말 것.

- [ ] **Step 4: red-green**

`app.js` 의 `reqRow` 에서 단추 조건을 `if (!m)` 으로 바꿔(탐침 무시) 다시 돌린다.
Expected: 3번 또는 7번이 `✕`. 확인했으면 되돌린다.

- [ ] **Step 5: 워크플로에 등록한다**

`.github/workflows/verify-ui.yml` 의 `for f in verify-fit-badge.js ...` 목록 끝(`verify-admin-shape.js` 뒤)에 `verify-elig-ask.js` 를 넣는다.

🔴 **안내문에 적는 것은 리포트다. 강제하는 것은 워크플로뿐이다** — `verify/` 드라이버 31개 중 워크플로가 돌리던 것이 5개뿐이라 7개가 깨진 채 방치된 적이 있다.

- [ ] **Step 6: 관문 전부 돌린다**

```bash
node verify/test-collector.mjs 2>&1 | tail -3
node verify/audit-data.js 2>&1 | tail -3
node verify/ui-tone.mjs 2>&1 | tail -3
```
Expected: 셋 다 통과.

- [ ] **Step 7: 커밋**

```bash
git add verify/verify-elig-ask.js .github/workflows/verify-ui.yml
git commit -m "자격 묻기 ④ 브라우저 관문 — 눌러서 실제로 되는가 (노션 AI-1)

값이 저장되고 색이 바뀌는지는 브라우저로만 잴 수 있다. 공고 id 를 박지 않고
askableForSch 가 비지 않은 공고를 그때그때 고른다. verify-ui.yml 에 등록.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: 코드 리뷰 · 노션 · 배포

**Files:** 없음(문서·저장소 작업)

- [ ] **Step 1: 코드 리뷰**

`Skill(skill="superpowers:requesting-code-review")` 를 부른다. 서브에이전트를 못 쓰는 세션이면 **건너뛰지 말고** diff 를 직접 보되 스킬 항목을 하나씩 짚는다(요구사항 충족 · 경계값·빈 값 · 기존 검사를 무력화하지 않는가). 그 절차 없이 훑다가 '마감일 칸이 빈 재단을 통째로 버리는' 버그를 놓친 적이 있다.

특히 짚을 것:
- `coerceField` 가 `0` 을 `null` 로 만들지 않는가 (0학점·0구간은 유효한 값이다)
- `flags`·`scholarships` 를 건드리지 않는가 (이번 범위 밖 · 빈 배열과 null 이 다르다)
- 저장 뒤 다시 그릴 때 시트 스크롤이 튀지 않는가
- `askableForSch` 가 `eligibilityLines` 없는 공고(층2 KOSAF·상시 제도)에서 죽지 않는가

- [ ] **Step 2: 완료 전 검증**

`Skill(skill="superpowers:verification-before-completion")` 을 부르고, 관문 넷을 **실제로 돌린 출력**으로 확인한다:

```bash
node verify/test-collector.mjs 2>&1 | tail -3
node verify/audit-data.js 2>&1 | tail -3
node verify/ui-tone.mjs 2>&1 | tail -3
PORT=8137 node verify/verify-elig-ask.js 2>&1 | tail -3
```

- [ ] **Step 3: 노션 백로그를 고친다**

🔴 **백로그에 있는 일을 했으면 끝내기 전에 노션을 고친다** — 상태와 **상태 메모(날짜·근거)** 까지. 날짜 없는 완료는 나중에 확인할 방법이 없다.

- 데이터베이스: `collection://60ac025f-edbd-4284-bb57-5e077bab1c3d`
- 행: 번호 `AI-1` (업무 `자격 확인 도우미 — 못 읽는 자격은 물어본다`)
- 상태: **검토** (앱 배포 전이면) 또는 **완료** (배포했으면)
- 담당: `세현`
- 상태 메모에 반드시 적을 것:
  - 날짜 `2026-09-17` · 커밋 해시 · 브랜치
  - **과녁을 좁힌 근거 숫자** — 자격 줄 70줄 중 29줄이 자격이 아니고, 필수만 채운 학생은 4줄만 판정된다
  - **설계 문서 위치** `docs/designs/eligibility-ask.md`
  - **안 한 것** — 앱에 칸 없는 처지(재직·기혼·수상·성씨) · 자격 줄 잡음 걷기 · 파서 고치기
  - **개발자에게 물을 것 하나** — 저장하면 다른 공고도 같이 바뀌는데 그걸 화면이 말해 줄지(설계 5절 4번)

- [ ] **Step 4: 배포**

푸시 전 항상 충돌을 검토하고, 없으면 세 브랜치에 바로 올린다:

```bash
git fetch origin claude/nice-heisenberg-WESq5 main
git log --oneline HEAD..origin/claude/nice-heisenberg-WESq5 | head
```

겹치는 게 없으면:

```bash
git push origin HEAD:refs/heads/claude/notion-task-search-5e1ec5
git push origin HEAD:refs/heads/claude/nice-heisenberg-WESq5
git push origin HEAD:refs/heads/main
```

🔴 기본 브랜치를 건너뛰고 main 에만 올리지 말 것 — 그 작업이 기본 브랜치에 없으면 **다음 세션이 그 내용이 빠진 옛 판 위에서** 작업한다.

- [ ] **Step 5: 배포 반영을 확인한다**

```bash
node verify/check-deploy-sync.js 2>&1 | tail -10
```

---

## Self-Review 기록

**설계 문서 대조** — 설계의 각 절이 어느 태스크에 들어갔나:

| 설계 | 태스크 |
|---|---|
| 1절 과녁(비운 프로필 칸) | Task 1·2 (`FIELD_PROBE`·`FIELD_META`) |
| 2절 확정 모양(단추→시트·접기·세로 칸·색만) | Task 3 Step 3~6 |
| 3-1 채워도 안 바뀌면 안 묻는다 | Task 1 전체 + Task 3 Step 3 · Task 4 Step 4 red-green |
| 3-2 장담 금지 | Global Constraints + Task 3 Step 6 주석 |
| 3-3 말투 관문 | Task 3 Step 8 |
| 4-1 `elig-ask.js` | Task 1·2 |
| 4-2 화면(`reqRow`·`openEligAsk`) | Task 3 |
| 4-3 저장(새 길을 내지 않는다) | Task 3 Step 4 `eligAskSave` |
| 5절 저장 뒤 | Task 3 Step 4·7 · Task 4 항목 7~9 |
| 6절 관문 4종 | Task 1·2(test-collector) · Task 4(브라우저·워크플로) · Task 3 Step 8(ui-tone) · Task 5 Step 1(supabase 는 기존 검사가 그대로 잡는다) |
| 7절 안 하는 것 | 어느 태스크에도 없다 — Task 5 Step 3 이 노션에 적는다 |

**이름 일관성** — `askableFields` · `askableForSch` · `coerceField` · `FIELD_META` · `FIELD_PROBE` · `openEligAsk` · `eligAskSave` · `eligAskHtml` · `data-elig-ask` / `data-elig-toggle` / `data-elig-save` / `data-elig-field` · CSS `.elig-ask*`. Task 1→4 에서 철자가 같다.

**미확정 하나** — 설계 5절 4번(재사용을 화면이 말해 줄지)은 일부러 안 정했다. Task 3 Step 7 에서 화면을 보고, Task 5 Step 3 에서 개발자에게 묻는다.
