# 유료 관문 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 새로 자동 등록되는 공고는 유료 확인(읽기→고치기→사실 검사)을 통과해야 학생 화면에 나오고, 마지막에 유료 최종 검토가 문서 다섯 가지를 본다.

**Architecture:** `auto-register.mjs` 가 새 등록분에 `paidGate: <등록일>` 을 단다. 보이는가는 `match-engine.js` `publishedList` 한 곳이 `card-read.json` 으로 정한다. `card-read.mjs` 는 `paidGate` 공고만 읽고, 둘째 모델이 첫째 결과를 고치며, 기계 검사는 근거 문구(`quote`)와 사실 낱알로 본다. 최종 검토는 새 로봇 `collector/final-review.mjs` → `data/final-review.json`(관리자용).

**Tech Stack:** Node 22 ESM · `@anthropic-ai/sdk`(워크플로에서 설치) · 관문 `verify/test-collector.mjs` · GitHub Actions.

**Spec:** `docs/designs/paid-gate-pipeline.md`

## Global Constraints

- 🔴 `card-read.mjs` 는 `data/registered.json` 을 고치지 않는다 · 결과 파일 칸은 **글자 배열** 그대로(앱·`checkData` 불변).
- 🔴 돈은 관문(가짜 응답 `CARD_READ_FAKE`)으로만 시험 — 실제 호출 0. 스위치 둘(`enabled` + `CARD_READ_ENABLE=1`) 유지.
- 🔴 기계 검사를 느슨하게 하지 않는다 — `quote` 는 `inSource` 그대로.
- 예전 등록분(`paidGate` 없음)은 숨기지도 읽지도 않는다 · 예전 장부 항목(`mode` 없음)은 `--recheck` 때 옛 `agree` 길.
- 기다림 기준 `PAID_GATE_WAIT_DAYS = 3`(KST 날짜 차) · 실행당 상한(`maxPerRun`·`maxUsdPerRun`)은 남기고 한 달 상한은 두지 않는다.
- 숨김 거르기를 부르는 곳: `app-live.js` `loadRegistered` · `sw.js` · `server/push/worker.js`(사본) · `verify/what-shows.mjs` · `insta/school.mjs` · `collector/build-search-index.mjs` · `server/apply/apply-guard.mjs`.

## Review Focus

- `card-read.json` 을 못 받은 날 — 숨김분이 나오면 안 된다(사흘 지난 것만) → Task 2 테스트.
- 한 번 실린 공고를 재읽기가 비우면 — 결과를 지우지 않는다 → Task 1 테스트.
- 고친 줄이 부정(「제외」「않」)을 빼거나 숫자를 바꾸면 — 떨어진다 → Task 1 테스트.
- 옛 장부(`raw.a/raw.b` 가 글자 줄)로 `--recheck` — 넘어지지 않고 옛 결과 그대로 → Task 1 테스트.
- 원문이 없는 숨김분 — 사흘 뒤 무료로 새지 않고 관리자 대기(`gateHeld`) → Task 1·2 테스트.

---

### Task 1: 유료 확인 1 — 읽기→고치기→사실 검사 (`collector/card-read.mjs`)

**Files:** Modify `collector/card-read.mjs` · Test `verify/test-collector.mjs` 「유료 카드 읽기」 절 뒤에 새 절 「유료 관문 — 읽기→고치기→사실 검사 (2026-11-20)」

**Interfaces — Produces:**
- `factsMatch(text: string, quote: string, extra?: string) -> {ok: boolean, why?: string}` — 숫자 모음 같음 · 부정·비교 낱말(TOK) 모음 같음 · `text` 의 기관 이름(재단·장학회·대학교·대학·공단·공사·구청·시청·군청·도청·협회·은행·위원회로 끝남)이 `quote`+`extra` 에 있음 · `text` 두 글자 조각의 절반 이상이 `quote` 에 있음.
- `verify(out, source, item)` — 줄이 `{text, quote}` 면: `quote` 를 `inSource`(자격·제외는 `inSourceEnding`), 그 다음 `factsMatch`. `kept[k]` 에는 `text` 를 넣는다. 줄이 글자면 지금 그대로(옛 길).
- `buildEntryFixed(item, source, outFixed, wonIn) -> {entry, held, dropped, unreadable}` — `verify` 한 번 + 지금 `buildEntry` 의 뒤쪽 규칙(엄격 칸 떨어지면 null · 제외 null → 자격 null · 연장 공고 마감 보류 · 맨 위 금액). 공용 꼬리는 `finishEntry(final, held, dropped, unreadable, item, wonIn)` 로 뽑아 두 함수가 같이 쓴다.
- `pickTargets(..., { gatedOnly = true })` — `only` 가 없으면 `it.paidGate` 있는 것만.
- `gateHeldOf(items, partsOf, ledger, data, today) -> {[id]: 'no-source'|'unreadable'}` — `paidGate` 이 있고 결과가 없는 공고 중: 원문 한글 40자 미만이면서 등록 사흘 지남 → `no-source` · 장부 `done` 인데 항목 없음 → `unreadable`. 매 `--write` 실행에서(유료 스위치와 상관없이) `data.gateHeld` 에 적는다.
- `SCHEMA`: 목록 칸의 줄 = `{text, quote}`(둘 다 필수 글자). `SYSTEM`(읽기) · `FIX_SYSTEM`(고치기) 지시문.
- 장부: `led.mode = 'fix'` · `raw = {a, b}`(b = 고친 결과).

- [ ] Step 1: 실패하는 테스트 — `factsMatch`: `('평점 3.0 이상인 학생','평점 3.0 이상인 자')` ok · `('평점 3.5 이상인 학생','평점 3.0 이상인 자')` ✕ · `('휴학생','휴학생 제외')` ✕ · `('삼성꿈장학재단 추천자','본교 총장 추천자')` ✕ · `('통영시에 6년 이상 거주한 학생','통영시에 주소를 두고 6년 이상')` ok. `verify` 에 `{text, quote}` 줄: 근거가 원문에 없으면 떨어짐 · 근거가 있고 사실 같으면 `kept` 에 `text`. `buildEntryFixed`: 엄격 칸 한 줄 떨어지면 그 칸 null. 옛 꼴(글자 줄) `buildEntry(…a, b)` 결과가 지금과 같다(기존 ①② 테스트가 그대로 초록).
- [ ] Step 2: `node verify/test-collector.mjs 2>&1 | grep -A3 "유료 관문"` → 빨강 확인.
- [ ] Step 3: 위 함수들 구현 · 본편 루프를 `a` 읽기 → `b` 고치기(입력: 원문 + `JSON.stringify(a)`) 순서로 · 실패하면 두 쪽 쓴 돈을 다 센다 · `put` 은 `mode` 에 따라 `buildEntryFixed`/`buildEntry` · `paidGate` 공고의 결과가 비면 있던 항목을 지우지 않는다 · `--recheck` 는 `led.mode` 로 길을 고른다 · `gateHeldOf` 를 `save` 전에.
- [ ] Step 4: 가짜 응답 실행 테스트 — `CARD_READ_FAKE` 로 `paidGate` 공고 하나(통과)·없는 공고 하나(안 읽힘)를 `crSandbox` 에서 돌려 결과 파일·`gateHeld`·장부 `mode` 를 잰다. 초록 확인.
- [ ] Step 5: 커밋.

### Task 2: 숨김 등록과 거르기 (`auto-register` · `match-engine` · 소비처)

**Files:** Modify `collector/auto-register.mjs:494` 근처 · `match-engine.js`(내보내기) · `app-live.js:339` · `sw.js:268` · `server/push/worker.js` `summarize` · `verify/what-shows.mjs:42` · `insta/school.mjs:111` · `collector/build-search-index.mjs:155` · `server/apply/apply-guard.mjs` `findNotice` · `tools/edit-diff.mjs`(`paidGate` 칸) · Test `verify/test-collector.mjs` 같은 새 절.

**Interfaces — Produces (match-engine):**
- `PAID_GATE_WAIT_DAYS = 3`
- `paidGateOpen(sch, cardReadDoc, today: 'YYYY-MM-DD') -> boolean` — `!sch.paidGate` → true · `doc.items[id]` → true · `doc.gateHeld[id]` → false · 그 밖은 `today − paidGate > 3일`.
- `publishedList(list, cardReadDoc, today = kstToday()) -> list` — 거르고 `applyCardRead` 를 얹는다. `cardReadDoc` 가 null 이어도 거른다.

- [ ] Step 1: 실패하는 테스트 — 표본 넷(게이트 없음 / 게이트+결과 / 게이트+`gateHeld` 닷새 / 게이트 하루·나흘) × `doc` 있음·null → 보임 `[t,t,f,f,t]`·null 일 때 `[t,f,f,f,t]` 꼴. 소비처 정적 검사: 위 파일 일곱이 `publishedList` 를 부르고 `applyCardRead(` 를 직접 부르지 않는다(worker 는 `paidGateOpen` 사본 글자 대조). `auto-register` 새 항목에 `paidGate: TODAY`(정적 검사).
- [ ] Step 2: 빨강 확인.
- [ ] Step 3: 구현 · 소비처 바꾸기 · `edit-diff` `EDIT_LABEL.paidGate = '유료 확인 대기(지우면 무료 값으로 올림)'`(빈 값 = 칸 삭제가 되는지 `admin-apply` 로 확인).
- [ ] Step 4: `node verify/test-collector.mjs` · `node verify/audit-data.js` 초록 · `node verify/what-shows.mjs <아무 공고>` 가 예전과 같은 줄.
- [ ] Step 5: 커밋.

### Task 3: 워크플로·경보·이름 (`card-read.yml` · 원문 받기 로봇)

**Files:** Modify `.github/workflows/card-read.yml` · `collector/card-read.mjs`(`--gate-alarm`) · `rescue-bodies.yml` `name:` · `deploy-sync.yml` `workflows:` · `_admin/admin.js` · `tools/data-robots.mjs` · 코드 주석·문서의 「자격요건 로봇」(SESSIONS.md·report.md 제외).

- [ ] Step 1: 테스트 — `--gate-alarm` 이 `count=` 를 찍는다(사흘 넘게 기다린 · 결과 없음 · `gateHeld` 아님) · `card-read.yml` 에 같은 제목의 여는·닫는 경보 짝(`tools/alert-issue.mjs`) · 「자격요건 로봇」 글자가 워크플로·관리자·배포 감시에 0건이고 `deploy-sync.yml` 목록에 새 이름이 있다.
- [ ] Step 2: 빨강 → 구현 → 초록 · `node verify/check-deploy-sync.js` 초록.
- [ ] Step 3: 커밋.

### Task 4: 유료 확인 2 — 최종 검토 (`collector/final-review.mjs`)

**Files:** Create `collector/final-review.mjs` · `collector/final-review-config.json`(`enabled`·`maxPerRun`·`maxUsdPerRun`) · `.github/workflows/final-review.yml`(card-read 와 같은 틀 · 예약은 신청서 PDF 로봇 뒤 홀수 분) · Modify `_admin/admin.js`(「할 일」에 문제 목록) · Test 새 절 「유료 최종 검토 (2026-11-20)」.

**Interfaces — Produces:**
- `docsOf(item, formsPdfIndex, extractedDir) -> [{name, kind:'attachment'|'form-pdf', text, hash}]`
- `machineChecks(doc, originalText) -> {same: boolean|null, hasContent: boolean}` — 같은가는 공백 뗀 글자 비교(원본 글자가 없으면 null) · 내용은 한글 `MIN_BODY` 이상.
- 모델 응답 꼴 `{docs:[{name, thisNotice:boolean, isForm:boolean|null, empty:boolean, why}], missing:[{field, quote}]}` — `missing.quote` 는 `inSource` 로 원문 대조, 떨어지면 버린다.
- `data/final-review.json` `{updatedAt, items:{[id]:{hash, at, problems:[…]}}}` — 앱은 받지 않는다(관문: `match-engine` 의 받는 파일 목록에 없다).
- 빠진 내용이 있으면 `card-read-ledger.json` 의 그 공고 `hash` 를 비워 다음 유료 확인 1 이 다시 읽게 한다.

- [ ] Step 1: 실패하는 테스트 — 가짜 응답으로: 같은 해시는 다시 안 부름 · `missing.quote` 가 원문에 없으면 버림 · 결과 파일 꼴 · 빠진 내용 → 장부 해시 비움 · 기계 검사 표본(빈 PDF 글자 → `hasContent:false`).
- [ ] Step 2: 빨강 → 구현 → 초록.
- [ ] Step 3: 관리자 화면 표본(`node tools/build-admin-preview.mjs`)에 「최종 검토 문제」 묶음이 뜬다.
- [ ] Step 4: 커밋.

### Task 5: 문서·원칙 8-1·관문 마무리

**Files:** `CLAUDE.md`(원칙 8-1 · 「유료 카드 읽기」 절에 관문 흐름 한두 줄) · `docs/designs/paid-card-reading.md`(2·3절이 바뀌었다는 머리줄) · `docs/designs/data-flow.md` ② 구간.

- [ ] Step 1: `node verify/test-collector.mjs`(「CLAUDE.md 부피」·「가리키는 것이 실제로 있다」 포함) · `node verify/audit-data.js` · `node verify/check-deploy-sync.js` 초록.
- [ ] Step 2: 리뷰(스킬 `superpowers:requesting-code-review`) → 고침 → 커밋 → 세 브랜치 push · 노션 백로그 행 갱신.
