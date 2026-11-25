# 대외활동·공모전 유료 관문 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판에서 주운 새 활동 글을 숨겨 두었다가 AI 카드가 생기면 올리고, 둘째 AI 가 고치게 한다 — 장학금을 읽는 그 로봇이 활동 목록도 돌게 해서.

**Architecture:** `card-read.mjs`·`final-review.mjs` 에 목록 표(`LANES`)를 두고 `--activities` 로 활동 목록을 돈다(대상·원문·지시문·파일 이름만 바꿔 끼운다). 활동 글의 원문은 `activity-docs.mjs` 가 글자만 `collector/act-text/` 에 저장하고, 앱은 `match-engine.js` `publishedActivities` 한 곳으로 거르고 얹는다. 스위치는 끝까지 꺼 두고, 켜기 전 확인은 저장하지 않는 「유료 시험」 워크플로로 한다.

**Tech Stack:** Node ESM 로봇 · 정적 PWA(빌드 없음) · GitHub Actions · `verify/test-collector.mjs`(가짜 응답 `CARD_READ_FAKE`·`FINAL_REVIEW_FAKE`·`ATTACH_ROLE_FAKE` + 가짜 SDK `paidBox`) · Playwright 드라이버.

**Spec:** `docs/designs/paid-gate-activities.md` (2026-11-25 승인) · 화면 기준 `docs/designs/mockups/paid-gate-activities/`

## Global Constraints

- 🔴 유료 호출 없음. 관문은 가짜 응답과 `paidBox` 로만 돈다. 스위치 기본값은 false 이고 이 계획의 어떤 단계도 켜지 않는다.
- 🔴 장학금의 `SYSTEM`·`CARD_RULES`(`card-read.mjs`)와 `SYSTEM`(`final-review.mjs`)은 바이트 하나 바꾸지 않는다. Task 0 의 고정값이 끝까지 초록이어야 한다.
- 🔴 유료 로봇은 `data/activities.json`·`data/registered.json` 을 쓰지 않는다. 브라우저 모드(`activity-docs --browser`)도 `data/activities.json` 을 쓰지 않는다.
- 파일 이름(확정):
  - 글자 저장 `collector/act-text/<id>.json` · `collector/act-text/<id>.browser.json`
  - 결과 `data/act-read.json` = `{ updatedAt, items: { <id>: 카드 }, gateHeld: { <id>: 까닭 } }`
  - 장부·기록 `collector/act-read-ledger.json` · `collector/act-read-review.json` · `collector/act-role-ai.json` · `collector/act-final-review.json` · `collector/act-final-review-ledger.json` · `collector/act-read-done.json`(관리자 「확인함」)
  - 스위치 `collector/card-read-config.json` 의 `activities: { enabled: false, maxPerRun: 20, maxUsdPerRun: 3 }` · `collector/final-review-config.json` 의 `activities: { enabled: false, maxPerRun: 15, maxUsdPerRun: 3 }`
- 표시: 활동 글의 `paidGate: 'YYYY-MM-DD'`(한국 날짜). 관리자 「올리기」는 표시를 지우지 않고 `paidOpen: '관리자 YYYY-MM-DD'` 를 더한다(병합 도구 `mergeFeedByUrl` 이 두 쪽의 칸을 합쳐서, 지운 칸은 되살아난다).
- 날짜: 앱은 표시 뒤 `> 3`일에 무료 값으로 연다(`paidGateOpen`). 활동 목록은 원문 없는 글을 `>= 3`일에 넘기고, `> 3`일인 글은 새로 넘기지 않는다(전 실행에서 넘긴 글은 유지). 첨부 기다리기는 2일.
- 화면: 시안 그대로. 새로 보이는 것은 시트 「접수」의 「방법」 줄 하나. 「공고 안내」 여덟 줄 규칙(`noticeSummaryRows`)은 바꾸지 않는다. 이름표 묶기는 한 줄 170자까지.
- 로봇 파일 형식 `JSON.stringify(x, null, 1) + '\n'`. `verify/test-collector.mjs` 는 파일을 `readText` 로만 읽는다. 새 관문은 고친 것을 되돌려 실패하는지 본다(red-green). 실데이터에 기댄 고정 검사는 두지 않는다.
- 커밋 끝줄 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. push 는 작업 → 기본(`claude/nice-heisenberg-WESq5`) → main 세 곳에 같은 내용(먼저 fetch·merge).
- `CLAUDE.md` 는 60KB·400줄 천장이다. 줄을 더하려면 다른 줄을 줄인다.

## Review Focus

1. 결과 파일을 못 받거나 깨진 JSON 일 때 — 숨김 글만 안 보이고 나머지 목록은 그대로 뜬다(탭이 비지 않는다). → Task 7 Step 1 ⑦·드라이버.
2. 카드의 칸이 null·빈 배열·꼴이 틀린 값일 때 — 그 칸만 무료 값 그대로 두고 화면은 선다. → Task 7 Step 1 ④.
3. 같은 바이트의 첨부가 글자 기록과 `collector/extracted/` 양쪽에 있을 때 — 원문에 한 번만 들어가고 검토 해시가 그대로다. → Task 5 Step 1 ④ · Task 6 Step 1 ③.
4. 활동 글에 id 가 없을 때(지문 겹침) — 표시를 떼고 지금처럼 바로 보인다. 로봇은 건너뛴다. → Task 8 Step 1 ③.
5. 스위치를 켰다가 끈 뒤 — 표시가 달린 글은 사흘 뒤 무료 값으로 오르고, 로봇은 한 번도 부르지 않으며, 읽고도 실을 것이 없던 글 때문에 경보가 계속 울리지 않는다. → Task 5 Step 1 ⑥⑦.

---

### Task 0: 장학금은 그대로다 — 지시문·해시 고정

**Files:**
- Modify: `verify/test-collector.mjs` (「■ 유료 카드 읽기」 절 바로 앞에 새 절)

**Interfaces:**
- Produces: 절 `■ 대외활동 유료 관문 ⓪ 장학금은 그대로다`. 뒤 Task 가 `card-read.mjs`·`final-review.mjs` 를 고친 뒤에도 이 절이 초록이어야 한다.

- [ ] **Step 1: 고정값을 뽑는다** — 지금 코드에서 `sha256(CR.SYSTEM)`·`sha256(FR.SYSTEM)`(hex 앞 16자), `CR.sourceHash('고정 원문 — 활동 관문 0\n조회수 12')`, `FR.reviewHash('고정 원문', { eligibility: ['a'], hash: 'h' }, [{ file: 'f', hash: 'x', role: 'form', formStart: '' }], [{ kind: 'form', file: 'p.pdf', bytes: 10 }])` 를 `node -e` 로 찍는다.
- [ ] **Step 2: 관문을 쓴다** — 위 네 값을 글자 그대로 기대값으로 적은 `eq` 넷.
- [ ] **Step 3: red-green** — `card-read.mjs` 의 `SYSTEM` 끝에 빈칸 하나를 더해 `DOC_GATES=1 node verify/test-collector.mjs` 가 이 절에서 실패하는지 보고 되돌린다(`git diff --quiet`).
- [ ] **Step 4: Commit** `관문: 장학금 유료 지시문·해시 고정 (활동 관문 준비)`

### Task 1: 다시 읽을 때 첨부를 합친다 + 열린 글 소급

**Files:**
- Modify: `collector/activity-excerpts.mjs` (`actRereadNeed`) · `collector/collect.mjs` (소급 반복문 · 새 글) · `verify/test-collector.mjs` (「대외활동·공모전」 절)

**Interfaces:**
- Consumes: `newAttachments(have, found)` (`collector/rescue-plan.mjs` — 새 줄만 돌려준다 · 같은 파일은 한 줄)
- Produces: `export const ACT_ATTACH_V = 1` · `export function mergeActAttachments(it, found)` (`it.attachments` 에 새 줄을 더하고 `it.attachV = ACT_ATTACH_V` 를 적는다 · 있던 줄은 지우지 않는다 · 더한 줄 수를 돌려준다) · `actRereadNeed(it, today)` 가 `'attach'` 를 더 낸다(API 글 아님 · 마감 전 · `attachV !== ACT_ATTACH_V` · 다른 까닭 없음)

- [ ] **Step 1: 실패하는 관문** — ① 있던 줄 2 + 찾은 줄 3(하나는 같은 파일) → 4줄, 있던 줄 차례 그대로 ② 찾은 것이 빈 배열이어도 `attachV` 를 적는다 ③ `actRereadNeed`: 마감 전 게시판 글 → `'attach'`, 적은 뒤 → null, API 글·마감 지난 글 → `'attach'` 아님 ④ `collect.mjs` 글자: `'details'` 가지와 `'attach'` 가지 모두 `mergeActAttachments(it, detail.attachments)` 를 부른다 · `'attach'` 가지는 자격·발췌·마감을 건드리지 않는다.
- [ ] **Step 2: 돌려서 실패 확인**
- [ ] **Step 3: 구현** — 소급 반복문의 `need === 'attach'` 가지는 `'docs'` 가지와 같은 꼴(상한 `ACT_BACKFILL` 에 센다 · 못 받으면 `detailsTriedAt`). `actRereadNeed` 를 부르는 다른 곳(리포트의 「남은」 수)은 `'attach'` 를 세지 않는다.
- [ ] **Step 4: 통과 확인 · red-green**(`mergeActAttachments` 가 있던 줄을 버리게 바꿔 실패 확인)
- [ ] **Step 5: Commit**

### Task 2: 첨부 이름의 사이트 꼬리 떼기 (활동 글)

**Files:**
- Modify: `collector/attachment-link.mjs` · `collector/collect.mjs` (활동 발행 — `stripSiteChrome([acts.items])` 바로 앞) · `verify/test-collector.mjs`

**Interfaces:**
- Consumes: `fileNameIn(name)` (같은 파일)
- Produces: `export function trimSiteTail(name: string): string` · `export function trimActivityTails(items, used: Map<string, Set<string>>): number` (`used` = 글 id → 그 이름으로 이미 만든 사본·색인 줄의 첨부 이름들 · 든 이름은 건드리지 않는다)

- [ ] **Step 1: 실패하는 관문** — `trimSiteTail`: `'제안서.hwp &nbsp;&nbsp;&nbsp;(파일 용량 : 1449 KB'` → `'제안서.hwp'` · `'신청서.hwp (다운로드 : 12회)'` → `'신청서.hwp'` · `'공고문.hwp'`·`'2026 안내(최종).pdf'`·`'참가 안내'` 는 그대로 · `trimActivityTails`: `used` 에 든 이름은 그대로, 바꾼 수를 돌려준다, 같은 글에 다듬은 이름과 같은 줄이 이미 있으면 그 뒤 `stripSiteChrome` 이 한 줄로 만든다.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과 · red-green**. `used` 는 `collector/extracted/forms-index.txt` 의 id 줄과 `data/forms-pdf`·`data/docs-pdf`·`data/form-pages` 색인의 `name`·`src` 에서 만든다(읽기만).
- [ ] **Step 5: Commit**

### Task 3: 동아대 국어문화원 게시판의 내려받기 규칙 (조사 먼저)

**Files:**
- Modify: `collector/attachment-link.mjs` (`JS_DOWNLOAD_RULES`) · `verify/test-collector.mjs` (서울시립대 규칙 관문 옆) · `docs/designs/paid-gate-activities.md` 6절(결과 한 줄)

- [ ] **Step 1: 읽는다** — `https://korea.donga.ac.kr/korea/CMS/Board/Board.do?mCode=MN032&mode=view&mgr_seq=1002&board_seq=8520208` 의 첨부 링크 꼴과 내려받기 함수 정의를 받아 읽는다.
- [ ] **Step 2: 확인한다** — 규칙으로 만든 주소를 쿠키 없는 새 요청으로 받아 첫 바이트가 한글 파일(`D0 CF 11 E0`)·PDF(`%PDF`)인지 본다.
- [ ] **Step 3: 확인되면** 규칙과 관문(그 호스트의 호출이 풀린다 · 다른 호스트는 그대로 · 인자가 모자라면 null)을 더한다. **확인 못 하면 규칙을 넣지 않고** 설계 6절에 까닭을 적는다.
- [ ] **Step 4: Commit**

### Task 4: 원문 글자 저장

**Files:**
- Create: `collector/act-text.mjs`
- Modify: `collector/activity-docs.mjs` · `.github/workflows/collect-scholarships.yml` · `.github/workflows/rescue-bodies.yml` (저장·되돌리기 단계에 `collector/act-text`) · `verify/test-collector.mjs`

**Interfaces:**
- Produces (`collector/act-text.mjs`):
  - `storeFile(dir, id, mode: 'plain'|'browser'): string`
  - `writeStore(dir, id, mode, { url, body, bodyFrom, docs }, today): boolean` — 🔴 이미 빈 글자가 아닌 `body` 는 덮지 않는다 · `docs` 는 지문이 새것만 더한다 · 한 파일 2MB 를 넘으면 큰 `docs` 부터 빼고 `dropped: [이름]` 에 적는다
  - `readStore(dir, id): { body, bodyFrom, docs } | null` — 본문은 plain 이 비지 않았으면 plain, 아니면 browser · `docs` 는 지문으로 한 번씩(plain 먼저)
  - `wantsText(n, today, ids: Set): boolean` — `ids` 에 있거나, `paidGate` 가 있고 `paidOpen`·`hidden` 이 없고 id 가 있고 표시 뒤 3일 이내
  - `pruneStore(dir, liveIds: Set, mode): number` — 제 모드의 파일만 지운다
  - 한 `docs` 줄 = `{ name, hash, from: 'attach'|'img'|'guide', ocr: boolean, text }` (`hash` 는 원본 바이트의 sha1 앞 16자 · 요강 페이지는 글자의 지문)
- Produces (`collector/activity-docs.mjs`): `export function storeFromFiles(n, files, names, { dir, readText, isOcr })` → `{ body, bodyFrom, docs }` · 환경 변수 `ACT_TEXT_IDS`(쉼표 목록)

- [ ] **Step 1: 실패하는 관문** — ① 같은 글을 두 번 써도 본문이 처음 것이다 · 본문이 비었을 때만 채운다 ② 새 지문의 첨부만 더해진다 ③ browser 모드는 `<id>.browser.json` 만 만든다 ④ `readStore` 의 본문 고르기·지문 중복 ⑤ `wantsText`: 표시 없음 false · 표시 3일째 true · 4일째 false · `paidOpen` false · `ids` 에 있으면 true ⑥ `pruneStore` 가 다른 모드 파일을 안 지운다 ⑦ 2MB 상한 ⑧ `storeFromFiles`: 제목 낱말이 없는 본문은 빈 글자(`ownsImageText`) · 페이지에서 주운 그림과 요강 페이지도 같은 거름 · 글자 못 뽑은 파일은 싣지 않는다 ⑨ `activity-docs.mjs` 글자: 브라우저 모드에서 `ACTS` 쓰기가 없다(있던 관문 유지) · 저장 대상이 지금 대상(`needsElig`·`staleDocs`)보다 먼저다.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `fetchPost` 가 페이지 글자를 `-P.txt` 로 남기고(규칙 게시판은 있는 `-R.txt`), 파일마다 첨부 이름을 `manifest._names[파일]` 에 적는다. `fetchPhase` 대상에 `wantsText` 를 더하고 그 글을 먼저 돈다. 브라우저 모드는 plain 기록의 본문이 빈 글만. `applyPhase` 끝에서 `storeFromFiles` → `writeStore`. 끝에 `pruneStore`.
- [ ] **Step 4: 통과 · red-green**(`writeStore` 가 본문을 덮게 바꿔 실패 확인)
- [ ] **Step 5: Commit**

### Task 5: 카드 쓰기 로봇에 활동 목록

**Files:**
- Create: `collector/act-card.mjs` · `data/act-read.json`(`{ "updatedAt": null, "items": {}, "gateHeld": {} }` 로봇 형식)
- Modify: `collector/card-read.mjs` · `collector/card-read-config.json` · `verify/test-collector.mjs`

**Interfaces:**
- Consumes: Task 4 `readStore` · `collector/attachment-text.mjs` `loadNoticeDocIndex`·`attachmentText`
- Produces (`collector/card-read.mjs`):
  - `export const LANES = { scholarship: { list: '../data/registered.json', result: '../data/card-read.json', ledger: 'card-read-ledger.json', review: 'card-read-review.json', roles: 'attach-role-ai.json' }, activity: { list: '../data/activities.json', result: '../data/act-read.json', ledger: 'act-read-ledger.json', review: 'act-read-review.json', roles: 'act-role-ai.json' } }` — 경로는 글자 그대로(파일 목록 관문이 읽는다)
  - `sourceHash(text, system = SYSTEM)` · `ask(client, model, item, source, effort, system = SYSTEM)` · `--activities` · `--only=a,b,c`(쉼표 목록)
- Produces (`collector/act-card.mjs`):
  - `ACT_CARD_RULES` · `ACT_SYSTEM`(설계 5-3 의 칸 뜻 · 이름표 목록 `주제·규격·참가 형태·일정·장소·선발 규모·활동 내용·후속 지원·유의사항·문의` · 자격 칸에는 사람의 조건만)
  - `actView(n)` → `{ ...n, name: n.title, eligibility: { schoolOnly: n.school || n.host || '' } }`
  - `makeActSources({ storeDir, formRows, extractedDir })` → `(view) => parts` — 본문 `{ label: '게시판 본문', text }`, 글자 기록의 줄 `{ tag: 'A<n>', file: 'text-<hash>', attach: name || null, hash, label, text }`, 그 뒤 `forms-index` 의 그 id 줄 가운데 지문이 아직 없는 것 `{ tag, file: <extracted 이름>, attach, hash, label, text }`
  - `actAwaits(view, parts, today, days = 2)` — 이름이 `.hwp|.hwpx|.doc|.docx|.pdf` 로 끝나는(`fileNameIn`) 첨부 가운데 `attach` 가 같은 덩어리가 없는 것이 있고 표시 뒤 `days` 일이 안 됐다
  - `actGateHeldOf(items, partsOf, ledger, paid, today, prevHeld)` · `actGateStalled(items, data, ledger, today)`
  - `actGateOn(cfg)` → `cfg.enabled === true && !!cfg.activities && cfg.activities.enabled === true` (수집 로봇의 표시 달기와 유료 로봇이 같은 함수를 쓴다)
- 스위치: `cfg.enabled === true && cfg.activities && cfg.activities.enabled === true && CARD_READ_ENABLE === '1'`. 상한은 `cfg.activities` 의 값.
- 대상: id 있음 · `hidden` 아님 · `paidOpen` 아님 · `paidGate` 있음(`--only` 는 표시가 없어도 읽는다) · 마감 전 · 원문 한글 40자 이상 · 이 원문을 아직 안 읽음.

- [ ] **Step 1: 실패하는 관문** (`paidBox('hdj-act-read-')`) — ① 대상 고르기(표시 없음·관리자 숨김·id 없음·마감 지남·`paidOpen` 은 안 읽는다) ② 스위치 넷 조합 — 셋이 다 맞을 때만 부른다(가짜 SDK 호출 0 · 파일 0) ③ `actAwaits` — 공고문 글자만 있고 신청서가 아직이면 1일째 기다림, 2일째 읽음, 그림 첨부·zip 은 안 기다린다 ④ 원문 — 글자 기록의 첨부와 바이트가 같은 원본이 `extracted` 에 생겨도 덩어리와 `sourceHash` 가 그대로다 ⑤ `gateHeld` 날짜 — 원문 없는 글이 2일째 없음 · 3일째 `no-source` · 4일째에도 유지, 3일째 실행이 없었던 글은 4일째에 새로 넘어가지 않는다, 넘긴 글에 원문이 오면 대상이 된다 ⑥ 4일을 넘겨 오른 글에 「읽을 내용 없음」 답이 와도 `gateHeld` 에 안 들어간다 ⑦ `actGateStalled` 가 장부 `done` 인 글을 세지 않는다 ⑧ 🔴 장학금 실행 뒤 활동 파일 넷이 바이트 그대로 · 활동 실행 뒤 장학금 파일 넷이 바이트 그대로 ⑨ `--only=a,b` 가 표시 없는 두 글을 읽는다 ⑩ `--check --activities`·`--stats --activities`·`--gate-alarm --activities` ⑪ 파일 목록 관문 `robotWrites` 가 `LANES` 의 경로를 읽어 두 목록의 파일이 전부 워크플로 `git add` 에 있는지 본다(이 Task 에서는 활동 쪽 기대를 빨갛게 두지 말고 Task 10 에서 잇는다 — 장학금 쪽은 지금처럼 초록) ⑫ Task 0 절이 그대로 초록 ⑬ 대학원생만 받는 카드는 활동 목록에서도 결과에서 내려가고 `grad-only` 로 넘어간다(같은 코드 `sweepGrad`).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 본편의 경로·지시문·원문·대상·넘기기를 `lane` 하나로 묶는다. 장학금 갈래는 지금 동작과 글자까지 같아야 한다(있던 관문 전부 초록).
- [ ] **Step 4: 통과 · red-green**(⑤의 `>= 3` 을 `> 3` 으로 바꿔 실패 확인 · ⑧은 가지치기가 다른 목록 파일을 지우게 바꿔 실패 확인)
- [ ] **Step 5: Commit**

### Task 6: 최종 검토 로봇에 활동 목록 · 첨부 구분과 사본 판정을 읽는 곳

**Files:**
- Modify: `collector/final-review.mjs` · `collector/final-review-config.json` · `collector/act-card.mjs`(`ACT_REVIEW_SYSTEM`) · `collector/attach-role-ai.mjs`(`loadAiRoles`) · `collector/pdf-verdicts.mjs`(`loadPdfVerdicts`) · `verify/test-collector.mjs`

**Interfaces:**
- Consumes: Task 5 `LANES`·`actView`·`makeActSources`
- Produces: `reviewHash(source, entry, roles4, pdfs, system = SYSTEM)` · `--activities` · `--only=a,b` · 활동 결과 `collector/act-final-review.json`·장부 `collector/act-final-review-ledger.json` · `loadAiRoles` 가 `act-role-ai.json`·`act-final-review.json` 도 한 표에 싣는다 · `loadPdfVerdicts` 가 `act-final-review.json` 의 판정도 낸다

- [ ] **Step 1: 실패하는 관문** (`paidBox('hdj-act-review-')`) — ① 가짜 응답으로 활동 카드가 `data/act-read.json` 에서 통째로 바뀌고 기록이 활동 파일에만 적힌다 · 장학금 파일은 바이트 그대로 ② 스위치 조합 ③ 글자 기록 열쇠(`text-<지문>`)로 적힌 구분을 `aiRoleFor(roles, id, 'form-x.hwp', abs)`(바이트 같음)와 `aiRoleByName(roles, id, 이름, 지문)` 이 찾는다 · 같은 바이트가 `extracted` 에 생긴 뒤에도 `reviewHash` 가 그대로다 ④ ok 가 아닌 활동 사본이 색인에서 내려가고 `loadPdfVerdicts` 가 그 판정을 다시 낸다 ⑤ `--only`.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과 · red-green**
- [ ] **Step 5: Commit**

### Task 7: 엔진 · 앱 · what-shows (시안 그대로)

**Files:**
- Modify: `match-engine.js` · `app-activities.js`(`loadActivities`·`activityAsSch`) · `app-sheet.js`(`applySectionHtml` 의 `paidApply`) · `verify/what-shows.mjs` · `verify/verify-activities.js` · `verify/test-collector.mjs`

**Interfaces:**
- Produces: `withActRead(n, cr)` · `publishedActivities(list, doc, today)` (둘 다 `module.exports` 에) — 거르기는 `(n) => !!n.paidOpen || paidGateOpen(n, doc, today)`
- `withActRead` 의 몸(시안에서 쓴 그대로 — 이름표 묶기는 서명과 관문만으로 정해지지 않는다):

```js
function withActRead(n, cr) {
  const arr = (x) => (Array.isArray(x) ? x.filter((l) => typeof l === 'string' && l.trim()) : null);
  const out = Object.assign({}, n, { cardRead: cr });
  const E = arr(cr.eligibility), X = arr(cr.excludes), Pr = arr(cr.priority), D = arr(cr.documents), Am = arr(cr.amount), N = arr(cr.notes);
  if (E) { out.eligibilityLines = E; if (X) out.eligibilityExcludes = X; if (Pr) out.eligibilityPriority = Pr; delete out.eligibilityFrom; }
  else out.cardRead = Object.assign({}, cr, { eligibility: null });
  if (D) out.documents = D;
  const dl = cr.deadline && typeof cr.deadline === 'object' ? String(cr.deadline.date || '') : '';
  const hasDl = /^\d{4}-\d{2}-\d{2}$/.test(dl);
  if (hasDl) { out.deadline = dl; delete out.deadlineHint; }
  if (Am || N) {
    const keepPeriod = hasDl ? [] : (n.excerpts || []).filter((x) => x && x.label === '모집기간');
    out.excerpts = [...(Am && Am.length ? [{ label: '혜택', text: Am[0] }] : []), ...keepPeriod];
    const contact = (n.noticeLines || []).filter((l) => /^\s*(?:문의처?|담당)\s*[:：]/.test(String(l)));
    const rows = []; const at = new Map();
    const put = (label, body) => {
      const i = at.get(label);
      if (label && i != null && rows[i].body.includes(body)) return;
      if (label && i != null && (rows[i].body + ' · ' + body).length <= 170) { rows[i].body += ' · ' + body; return; }
      rows.push({ label, body }); if (label) at.set(label, rows.length - 1);
    };
    for (const x of (Am || []).slice(1)) put('혜택', x);
    for (const l of [...(N || []), ...contact]) {
      const m = String(l).match(/^([가-힣A-Za-z0-9\s·]{1,14}?)\s*[:：](?!\d|\/\/)\s*(.+)$/);
      if (m) put(m[1].trim(), m[2].trim()); else put('', String(l).trim());
    }
    out.noticeLines = rows.map((r) => (r.label ? r.label + ': ' + r.body : r.body));
  }
  return out;
}
```

- [ ] **Step 1: 실패하는 관문**(엔진을 Node 로) — ① 결과 파일 null → 표시 글만 빠진다 ② `items` 에 있으면 보인다 · `gateHeld` 면 안 보인다 · 표시 뒤 4일이면 무료 값으로 보인다 · `paidOpen` 이면 보인다 ③ 얹기 — 자격·제외·우선 · 혜택 첫 줄은 발췌 「혜택」 · 둘째 줄부터 `혜택:` 한 줄 · 마감 · 서류 · 안내 줄이 이름표끼리 한 줄, 170자를 넘으면 두 줄 · 카드에 마감이 없으면 무료 마감과 「모집기간」이 남는다 · 문의처 줄이 남는다 ④ 칸이 null·빈 배열·글자가 아닌 값이어도 던지지 않고 그 칸만 그대로 둔다 ⑤ 원본 객체가 안 바뀐다 ⑥ 부르는 곳 — `app-activities.js` 가 `publishedActivities(` 를 부르고 `verify/what-shows.mjs` 가 `ME.publishedActivities(` 를 부른다 · `activityAsSch` 가 `cardRead` 를 넘긴다 · `app-sheet.js` 에 `!act && sch.cardRead` 가 없다 ⑦ 결과 파일이 깨진 JSON 이어도 `loadActivities` 가 목록을 세운다(글자 관문: `.catch(() => null)`).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**. `what-shows.mjs` 는 숨겨진 활동 글을 물으면 까닭(카드를 기다림 · 사람에게 넘김)을 말하고 종료 코드는 지금처럼 둔다.
- [ ] **Step 4: 드라이버** `verify/verify-activities.js` — 표시가 달리고 카드가 없는 글이 탭·홈 「나에게 맞는 대외활동」·도우미 목록에 없다 · 카드가 얹힌 글의 시트에 「방법」 줄·「서류」 줄·큰 글씨 혜택·「공고 안내」 줄(이름표)·적합도 배지가 시안의 해커톤 글과 같은 꼴로 나온다 · 결과 파일 404 와 깨진 JSON 에서도 다른 글이 그대로 뜬다 · 오류 0. 로컬은 `PORT=` 와 `CHROME_PATH`.
- [ ] **Step 5: 시안 대조** — 앱을 띄워 시안의 다섯 글을 열고 `docs/designs/mockups/paid-gate-activities/after-sheet-*-open.png` 와 줄 단위로 맞춘다(사진을 열어 본다). 저장해 둔 글의 사본에 얹은 값이 그대로 들어가는지도 본다.
- [ ] **Step 6: red-green · Commit**

### Task 8: 숨김 표시 · 상한 · 변환 로봇 연결

**Files:**
- Modify: `collector/collect.mjs` · `collector/open-api-map.mjs`(`capActivities`) · `verify/audit-data.js` · `collector/form-pages.mjs` · `collector/attach-role-read.mjs` · `collector/form-pdf.mjs`(`pickFormBacklog`) · `collector/deepfetch.mjs` · `verify/test-collector.mjs`

**Interfaces:**
- Consumes: Task 7 `paidGateOpen`·`publishedActivities`(collect 가 `createRequire` 로 엔진을 부른다) · Task 6 `loadAiRoles`
- Consumes: Task 5 `actGateOn(cfg)`
- Produces: `capActivities(items, cap, isVisible = () => true)` — 안 보이는 글은 전부 남기고 보이는 글만 `cap` 건(보이는가 = `n.paidOpen || paidGateOpen(n, 결과 파일, 오늘)`) · `pickPageTargets({ registered, activities, kosaf, … })` · `pickFormBacklog(items, rows, { …, aiWants = () => false })`(`aiWants(it, a)` 가 참이면 이름이 신청서류가 아니어도 받는다) · `pickRoleTargets` 가 표시가 달린 활동 글도 받는다

- [ ] **Step 1: 실패하는 관문** — ① 스위치가 켜졌을 때 처음 본 게시판 글에만 `paidGate`(한국 날짜) · 꺼져 있으면 안 단다 · 이미 실린 글·API 글에는 안 단다(`collect.mjs` 글자 + 순수 함수) ② 표시가 `retitleItems`·`dedupeNotices`·`capActivities`·`mergeApi` 의 남기는 길·`mergeFeedByUrl` 을 지나도 남는다 ③ id 가 비워진 글은 표시가 떼인다 ④ 상한 — 보이는 글 200 + 숨김 글 30 → 230건 남고, 보이는 글 205 + 숨김 30 → 보이는 글 5건만 빠진다 ⑤ 감사 — 표시가 날짜 꼴이 아니면 경고(오류 아님) ⑥ `pickPageTargets` 가 받아 둔 원본이 있는 활동 글을 낸다 · 관리자 숨김 글은 안 낸다 ⑦ `pickFormBacklog` — AI 가 `form`·`mixed` 라 한 「공고문.hwp」를 활동 글에서만 받는다 ⑧ `pickRoleTargets` 가 표시가 달린 활동 글의 글자 없는 원본을 낸다.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과 · red-green**(④는 `isVisible` 을 무시하게 바꿔 실패 확인)
- [ ] **Step 5: Commit**

### Task 9: 관리자 「할 일」

**Files:**
- Modify: `_admin/admin.js` · `tools/admin-apply.mjs` · `.github/workflows/admin-apply.yml` · `verify/test-collector.mjs`(관리자 왕복 절) · 해당 드라이버(`verify/verify-admin-shape.js`)

**Interfaces:**
- Produces: 동작 `activityGate` `{ urls: [...], op: 'open' }` → 그 글에 `paidOpen: '관리자 YYYY-MM-DD'`(표시는 그대로) · 동작 `activityReviewDone` `{ items: [{ id, key }] }` → `collector/act-read-done.json` `{ v: 1, items: { <id>: { done: [key], by, at } } }` · 화면: `D.actReview`(`collector/act-read-review.json`) · `D.actFinal`(`collector/act-final-review.json`) · `D.actDone`

- [ ] **Step 1: 실패하는 관문** — ① `activityGate` 가 `paidOpen` 을 더하고 `paidGate` 를 지우지 않는다 · 없는 주소면 멈춘다 ② `activityReviewDone` 이 활동 파일에만 쓰고 `data/card-read-fixes.json` 을 안 건드린다 ③ 「할 일」 묶음이 활동의 넘긴 글과 둘째 AI 가 넘긴 문제를 세고, 「확인함」 한 줄은 내려간다 ④ 워크플로가 새 파일을 저장한다.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과**. 버튼은 「올리기」(`activityGate`)·「숨기기」(있는 `activityHide`)·「확인함」. 문구는 장학금 카드의 말투를 따른다(로봇 말 금지).
- [ ] **Step 5: Commit**

### Task 10: 워크플로 · 「유료 시험」 워크플로 · 문서

**Files:**
- Modify: `.github/workflows/card-read.yml` · `.github/workflows/final-review.yml` · `verify/test-collector.mjs`(파일 목록·화면이 못 부르는 워크플로 목록) · `CLAUDE.md` · `docs/designs/activities-tab.md` · `docs/designs/data-model.md` · `docs/designs/data-flow.md` · `docs/designs/paid-gate-pipeline.md`(6절에 가리키는 줄) · `SESSIONS.md`
- Create: `.github/workflows/act-paid-probe.yml`

**Interfaces:**
- Consumes: Task 4 `ACT_TEXT_IDS` · Task 5·6 `--activities`·`--only`

- [ ] **Step 1: 실패하는 관문** — ① `LANES.activity` 의 파일과 `act-final-review*.json`·`act-role-ai.json` 이 두 워크플로의 `git add` 에 전부 있다 ② 활동 단계가 장학금 단계 뒤에 있고 제 `timeout-minutes` 가 있으며 작업 시한이 단계 합보다 길다 ③ 활동 쪽 멈춤 경보가 다른 제목으로 여는·닫는 짝을 이룬다 ④ 장학금 단계가 실패해도 활동 단계가 돈다(`if: always()` 또는 같은 뜻) ⑤ `act-paid-probe.yml` — `workflow_dispatch` 뿐(예약·push 없음) · `git push`·`git commit`·`git add` 없음 · id 가 비면 아무것도 안 부른다 · 입력은 `env` 로만 · 시한 · `upload-artifact` ⑥ 화면이 못 부르는 워크플로 목록에 새 워크플로.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과**. 시험 워크플로는 작업 폴더 안에서만 두 스위치 파일의 `activities.enabled` 를 true 로 바꾼 뒤 글자 받기 → 카드 쓰기(`--activities --only`) → 최종 검토(`--activities --only`) → `--stats --activities` → 결과 묶음 올리기 순으로 돈다.
- [ ] **Step 5: 문서** — `CLAUDE.md` 「유료 관문」 절에 활동 줄 하나와 규칙 8 에 `act-paid-probe.yml`·활동 스위치(다른 줄을 줄여 천장 안에). 나머지 문서는 새 파일과 흐름을 한 문단씩.
- [ ] **Step 6: Commit**

### Task 11: 마무리

- [ ] `DOC_GATES=1 node verify/test-collector.mjs` 전부 통과 · `node verify/audit-data.js` 통과
- [ ] 드라이버 — `verify-activities.js` · `verify-card-read.js` · 관리자 드라이버(로컬 `PORT=`·`CHROME_PATH`)
- [ ] `Skill(superpowers:requesting-code-review)` — 지적을 반영한다
- [ ] 세 브랜치에 push(스위치 꺼진 채) · `node verify/check-deploy-sync.js` · `verify-ui.yml` 과 `check-live.yml` 결과 확인
- [ ] 보고 — 무엇이 나갔는지, 스위치가 꺼져 있다는 것, 시험은 개발자가 「시험해」라고 할 때 돌린다는 것

## 짓는 순서와 배포

Task 0~3 은 무료이고 서로 독립이라 먼저 배포한다(수집 로봇의 동작이 바뀐다: 첨부 합치기·이름 다듬기). Task 4~6 은 스위치가 꺼져 있어 배포해도 아무 일도 하지 않는다. Task 7~9 는 화면과 관리자다(결과 파일이 비어 있어 화면은 지금과 같다). Task 10 뒤에 개발자가 「시험해」라고 하면 시험 워크플로를 돌리고, 결과를 화면으로 보인 뒤 「켜」를 기다린다.
