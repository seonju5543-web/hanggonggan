# 첨부 문서 PDF 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마감 전 공고의 한글·워드 첨부마다 글자를 대조한 PDF 사본을 만들고, 앱의 첨부 목록 세 곳을 「PDF 줄 위 · 올린 첨부 목록 맨 밑」으로 바꾼다.

**Architecture:** 새 로봇 `collector/doc-pdf.mjs` 가 `form-pdf.mjs` 의 변환·정리 함수를 불러 `data/docs-pdf/` 에 사본과 색인을 쓴다(층1·활동은 받아 바꾼 뒤 원본을 버리고, 층2는 저장소 사본에서). `deep-fetch.yml` 보강 단계로 돈다. 앱은 `app-live.js` 의 줄 함수 하나로 상세 시트·지원문서 머리·신청 준비 시트를 그린다.

**Tech Stack:** Node ESM 로봇 · LibreOffice + H2Orestart · poppler `pdftotext` · `collector/hwp-bodytext.py` · 정적 PWA(빌드 없음) · Playwright 드라이버 · `verify/test-collector.mjs`.

**Spec:** `docs/designs/all-docs-pdf.md` (2026-11-20 승인)

## Global Constraints

- 유료 호출 없음(CLAUDE.md 🔴 8) · `data/registered.json` 안 고침.
- 대상: 첨부 이름(`cleanAttachName`) 끝이 `.hwp`·`.hwpx`·`.doc`·`.docx`. 층1·활동은 `isApplicationForm` 이 **아닌** 것만, 층2(`kosaf-<코드>`)는 전부.
- 결과: `data/docs-pdf/<id>/<n>-<safeName(이름)>.pdf` · 색인 `data/docs-pdf/index.json` = `{ updatedAt, items: { <id>: [{ file, name, pages, bytes, fonts, kept, at }] }, tried: { "<id>|<name>": { at, why } } }`.
- 쉼 3일 · 받기 시한 30초 · 받기 크기 1KB~15MB · PDF 상한 `MAX_PDF_BYTES`(5MB).
- 글자 대조: 한글 음절·숫자 **개수** 비율 ≥ `0.98` 통과. 원본 글자 < `50`·`.doc`·`pdftotext` 없음은 대조 안 함(사본은 두고 리포트에 센다).
- 줄 꼴: `li.att.att-row.att-row-new` · `span.att-ic.att-ic-pdf` 글자 `PDF` · 링크 글자 = 첨부 이름 그대로(`unent`·공백만) · `.att-m` 없음 · 오른쪽 `열기 ›` · `target="_blank" rel="noopener"`.
- 순서: PDF 줄(첨부 차례) → (지원문서 머리만) 서식 쪽 줄 → 올린 첨부 목록 그대로(맨 밑 · 원래 PDF 도 다시).
- 지우는 글: `prepOriginalsHtml` 의 `p.dp-note` · `renderApplyPrep` 「신청서 양식」 밑 `p.dp-note` · `formfill.js` `.fill-open-m`. 남기는 글: `신청내역에 담길 뿐, 학교·재단에 접수되지는 않아요.`
- 보강 단계 규칙: `timeout-minutes` + `continue-on-error: true` + 경보 짝(같은 제목 open/resolve) + apt `-o DPkg::Lock::Timeout=120`.

## Review Focus

1. 첨부 주소가 `javascript:` 게시판 스크립트이거나 비었을 때 — 받기는 `resolveJsDownload` 로 풀고, 못 풀면 `tried` 에 `주소 없음`. 화면 원본 줄은 지금처럼 `(원문 게시판에서 내려받기)`. → Task 2 테스트.
2. 같은 첨부가 아이콘 꼬리로 두 줄(`공고문.hwp chevron_forward` · `공고문.hwp`) — 사본은 하나, PDF 줄도 하나. → Task 1·4 테스트.
3. 사본 색인을 못 받음(404·오프라인) — PDF 줄만 없고 맨 밑 목록은 그대로(정보 손실 없음). → Task 4 드라이버.
4. 받아 보니 웹페이지(로그인 벽) — 버리고 `tried` 에 `웹페이지`, 색인에 안 싣는다. → Task 2 테스트.
5. 층2 첨부 이름에 공백·괄호·`※` — 파일 이름은 `safeName`, 링크는 브라우저가 열 수 있는 주소(`esc`·상대 경로). → Task 2·4 테스트.

---

### Task 1: 로봇 순수 함수 — 고르기 · 대조 · 쉼

**Files:**
- Create: `collector/doc-pdf.mjs` (이 Task 에선 export 만 · 본편은 `if (!process.env.DOC_PDF_AS_LIB)` 아래)
- Test: `verify/test-collector.mjs` 새 절 `■ 공고문 PDF 사본 — 고르기 · 글자 대조 · 쉼` (「신청서 원본 → PDF」 절 바로 뒤)

**Interfaces:**
- Produces:
  - `export const OFFICE_DOC = /\.(hwp|hwpx|doc|docx)$/i`
  - `export const KEEP_MIN = 0.98, MIN_CHARS = 50, REST_DAYS = 3, FETCH_TIMEOUT_MS = 30000`
  - `export function pickDocTargets({ registered = [], activities = [], kosaf = [] }, { today, isApplicationForm })` → `[{ id, pageUrl, files: [{ name, url } | { name, src }] }]`
  - `export function keptRatio(origText, pdfText)` → `number` 0~1, 원본 글자 < `MIN_CHARS` 면 `null`
  - `export function resting(tried, key, today, restDays = REST_DAYS)` → `boolean`

- [ ] **Step 1: 실패하는 관문을 쓴다** — `process.env.DOC_PDF_AS_LIB = '1'; const DP = await import('../collector/doc-pdf.mjs')`
  - `pickDocTargets` — 등록 공고(마감 전) 첨부 `['공고문.hwp chevron_forward', '공고문.hwp', '장학생 신청서.hwp', '포스터.jpg', '모집요강.pdf']` → `files.map(f=>f.name)` = `['공고문.hwp chevron_forward']` 하나(이름 기준 한 번 · 신청서·그림·PDF 제외). 마감 지남·`program`·`hidden` 은 빈 결과. 활동 글도 같은 규칙.
  - 층2 `{ code: '123', due: '2026-12-01', files: [{ name: '선발 공고.hwpx', path: 'data/kosaf-files/123/선발 공고.hwpx' }, { name: '장학생 신청서.hwp', path: … }, { name: '안내.pdf', path: … }] }` → `{ id: 'kosaf-123', files: [{ name: '선발 공고.hwpx', src: '…' }, { name: '장학생 신청서.hwp', src: '…' }] }`. `due` 지남 → 없음.
  - `keptRatio(T, T)` = 1 (T = 한글 60자 + `2026`) · 한글 10% 뺀 PDF → `< 0.98` · 원본 40자 → `null` · PDF 에 글자가 더 있어도 1.
  - `resting({ 'a|b': { at: '2026-11-18' } }, 'a|b', '2026-11-20')` = true · `at: '2026-11-17'` = false · 없는 열쇠 = false.
- [ ] **Step 2: `node verify/test-collector.mjs 2>&1 | grep -A3 "공고문 PDF 사본"` → 모듈이 없어 실패**
- [ ] **Step 3: 구현** — 마감 판정은 `form-pdf.mjs` 의 `isOpen` 을 불러 쓴다(`FORM_PDF_AS_LIB=1` 뒤 동적 import · 정적 import 금지 — 불러오는 순간 본편이 돈다). 이름 정리는 `form-rules.mjs` 의 `cleanAttachName`.
- [ ] **Step 4: 같은 명령 → 통과**
- [ ] **Step 5: 커밋** `공고문 PDF 로봇 1/3 — 고르기·글자 대조·쉼 (순수 함수 · 관문)`

### Task 2: 로봇 본편 — 받기 · 변환 · 대조 · 색인 · 정리 · 리포트

**Files:**
- Modify: `collector/doc-pdf.mjs`
- Test: `verify/test-collector.mjs` 같은 절(임시 폴더 · 가짜 받기·변환기·글자 뽑기)

**Interfaces:**
- Consumes: Task 1 · `form-pdf.mjs` 의 `convertOne, prune, safeName, FONT_STAMP, isOpen, loadActivities, loadFormRules, SOFFICE_TIMEOUT_MS` · `attachment-link.mjs` 의 `resolveJsDownload, isHtmlPayload` · `form-rules.mjs` 의 `attachExt` · `http-headers.mjs` 의 `FETCH_HEADERS` · `attachment-text.mjs` 의 `attachmentText`
- Produces:
  - `export const BUDGET_SEC = Number(process.env.DOC_PDF_BUDGET_SEC || 240)`
  - `export async function runDocPdf({ root, today, dry = false, budgetSec = BUDGET_SEC, fetchImpl = fetch, convert, origText, pdfText, log = console.log })` → `{ targets, done, failed, skipped, rested, unchecked, dropped, left, index }` · `convert` 기본값 `convertOne`, `origText(path)` 기본값은 hwp 면 `python3 collector/hwp-bodytext.py <임시 폴더>` 뒤 `attachmentText`, hwpx·docx 면 `attachmentText`, 그 밖 `''` · `pdfText(path)` 기본값 `pdftotext -enc UTF-8 <pdf> -` 의 출력, 도구가 없으면 `null`
  - 실행: `node collector/doc-pdf.mjs [--dry] [--today=YYYY-MM-DD]` · `DOC_PDF_ROOT` · 한글·워드를 하나도 못 바꿨는데 「변환기가 못 읽음」이 있으면 종료 3

- [ ] **Step 1: 실패하는 관문** (임시 저장소 `fs.mkdtempSync` · `data/registered.json`·`data/kosaf-open.json`·`data/activities.json` 표본 · 층2 원본 파일 하나)
  - 첫 실행: 층1(주소) 하나 + 층2(사본) 하나 → 색인 두 줄(`kept: 1` · `fonts: FONT_STAMP`) · 리포트 파일 있음 · 가짜 받기 1번.
  - 같은 날 다시: 받기 0번 · `skipped` 2.
  - 받기 404 → `tried['<id>|<name>'].why` 에 `HTTP 404` · 이튿날 다시 → 받기 0번(쉼).
  - 받은 것이 HTML → `why` 에 `웹페이지` · 색인 없음.
  - 주소가 `javascript:` 이고 못 풀면 → `why` = `주소 없음`.
  - 대조 80% → 색인 없음 · 만든 PDF 지움 · `why` 에 `글자 빠짐(80%)`.
  - `pdfText` 가 `null` → 사본은 두고 `unchecked` 1.
  - 마감 지난 공고의 옛 색인·폴더 → 지워짐 · 같은 임시 저장소의 `data/forms-pdf/x/1.pdf` 는 그대로.
  - 층2 이름 `※ 2026 (재)빛고을 공고.hwpx` → 파일 `kosaf-…/1-<safeName>.pdf`.
- [ ] **Step 2: 관문 실행 → 실패**
- [ ] **Step 3: 구현** — 예산은 `form-pdf` 와 같은 셈(경과 + (`FETCH_TIMEOUT_MS`+`SOFFICE_TIMEOUT_MS`)/1000 > 예산이면 새 파일 시작 안 함 → `left`). 색인은 파일 하나마다 `JSON.stringify(x, null, 1) + '\n'` 로 쓴다. 받은 원본은 `os.tmpdir()` 아래에만 두고 끝나면 지운다. 정리는 `prune(index, 대상 id 집합, data/docs-pdf)`.
- [ ] **Step 4: 관문 통과 · 로컬 `node collector/doc-pdf.mjs --dry` 가 대상 공고 수를 찍는다**(층1·층2·활동 합 약 79개 · 변환은 안 함)
- [ ] **Step 5: 커밋** `공고문 PDF 로봇 2/3 — 받기·변환·글자 대조·색인·정리 (가짜 받기로 관문)`

### Task 3: 배선 — `deep-fetch.yml` · `sw.js`

**Files:**
- Modify: `.github/workflows/deep-fetch.yml`, `sw.js:178-180`
- Test: `verify/test-collector.mjs` 같은 절 + 「층2 첨부 — 앱이 그 파일을 실제로 열 수 있게 배선돼 있다」 절의 sw 순서 검사 옆

- [ ] **Step 1: 실패하는 관문**
  - 단계 `공고문 → PDF (첨부 원본 그대로)`: `id: docpdf` · `timeout-minutes: 8` · `continue-on-error: true` · `DOC_PDF_BUDGET_SEC` · 설치 줄에 `DPkg::Lock::Timeout` · `poppler-utils` · `pip install olefile` · `install-h2orestart.sh` · `install-form-fonts.sh` · `node collector/doc-pdf.mjs`. 경보 짝 `label: doc-pdf-step` open/resolve 제목이 같다.
  - 「공고문 뒷장 서식 쪽 떼기」 단계: `id: formpages` · 잠금 대기 · 경보 짝 `label: form-pages-step`.
  - 되돌리기 `--stage` 와 `git checkout`·`git clean` 줄에 `data/docs-pdf` · 저장에 `[ -d data/docs-pdf ] && git add -A data/docs-pdf` 와 `[ -f collector/doc-pdf-report.md ] && git add collector/doc-pdf-report.md`.
  - 작업 상한 ≥ 62(지금 54 + 새 단계 8) · 새 단계 시한(분)×60 ≥ 예산 + 받기 30 + 변환 60 + 설치 여유 180.
  - `sw.js`: `/\/data\/docs-pdf\//` 건너뛰기가 navigate 갈래보다 앞.
- [ ] **Step 2: 관문 → 실패**
- [ ] **Step 3: 고친다**(단계는 「✅ 신청서 원본 → PDF 단계 회복」 바로 뒤 · 작업 상한 주석에 `공고문 PDF 8분 (2026-11-20)` 추가)
- [ ] **Step 4: 관문 통과 → 하나씩 되돌려 빨개지는지(red-green) 보고 원복**
- [ ] **Step 5: 커밋** `공고문 PDF 로봇 3/3 — deep-fetch 보강 단계·경보 짝(서식 쪽 단계 빠진 짝 포함)·서비스워커`

### Task 4: 앱 — 줄 함수 하나로 세 곳 · 단추 · what-shows

**Files:**
- Modify: `app-live.js`(색인·줄 함수·`prepOriginalsHtml`·`formPageRowsHtml` · `formPdfRowsHtml` 은 지운다), `app.js:2858`(첫 실행 받기), `app-sheet.js:220-225`(④ 첨부), `app-prep.js:55-81`, `formfill.js:74`, `style.css:5251`, `verify/what-shows.mjs:207-212`
- Test: `verify/verify-kosaf.js`(새 절) · `verify/verify-apply-prep.js` ②-A · `verify/verify-activities.js` ⑤ · `verify/verify-formfill.js` · `verify/test-collector.mjs`(정적)

**Interfaces:**
- Produces (모두 `app-live.js` 전역 함수):
  - `let docsPdfIndex = { items: {} }` · `function loadDocsPdfIndex()` — `fetch('data/docs-pdf/index.json', { cache: 'no-store' })` · 실패는 조용히
  - `function docPdfsFor(sch)` → 색인 항목 배열
  - `function pdfRowHtml({ href, name, slot = '' })` → Global Constraints 의 줄 꼴 + `slot` 이 있으면 `<li class="fill-slot" data-file="…" hidden></li>`
  - `function attachPdfRowsHtml(sch, atts)` → 첨부 차례대로: 신청서 사본(같은 이름 · `slot` = 그 file) → `data/forms-pdf/<file>` · 공고문 사본 → `data/docs-pdf/<file>` · 이름이 `.pdf` 이고 `safeUrl` 이 되는 원래 PDF → 원래 주소. ~~끝에 첨부와 이름이 안 맞는 신청서 사본을 덧붙인다~~ — 일부러 뺐다(리뷰 11-20 #3 · 오늘 0건 · 첨부 이름이 바뀐 날 하루만 빠지고 다음 실행이 새 이름으로 다시 만든다).
  - `attachRowHtml(a, { meta = '' })` 은 그대로 · 호출하는 곳은 `meta` 를 안 준다.

- [ ] **Step 1: 실패하는 드라이버**
  - `verify-kosaf.js` 새 절 `■ 첨부 — PDF 줄 위 · 올린 첨부 목록 맨 밑 (2026-11-20 승인 시안)`: `page.route('**/data/docs-pdf/index.json*')` 로 `{ items: { 'kosaf-<code>': [{ file: 'kosaf-<code>/1-선발_공고.pdf', name: '선발 공고.hwpx', pages: 2, bytes: 1000 }] } }` 를 주고, 그 재단의 `files` 를 `[선발 공고.hwpx, 안내 (2026).pdf]` 로 얹는다.
    - 상세 시트 「첨부」 첫 목록 = `[['PDF','선발 공고.hwpx','data/docs-pdf/…','_blank','열기 ›'], ['PDF','안내 (2026).pdf','data/kosaf-files/…','_blank','열기 ›']]` · `.att-m` 0개.
    - 둘째 목록 링크 글자 = `['선발 공고.hwpx', '안내 (2026).pdf']`.
    - 지원문서 머리 「선발 공고문」: PDF 줄 → (서식 쪽) → `↓` 줄 둘 · 목록 바로 뒤 `p.dp-note` 없음.
    - 색인 404 로 다시 열면 PDF 줄 0 · 둘째 목록은 그대로 2.
  - `verify-apply-prep.js` ②-A: PDF 줄 링크 글자 = 그 공고 신청서 사본의 첨부 이름들 · `.att-m` 없음 · 원본 신청서 줄(`↓`)이 목록 **끝** · 안내 문구 `null`.
  - `verify-activities.js` ⑤: 첫 줄 링크 글자 = 표본 신청서 첨부 이름 · 둘째 목록에 원본 · `.fill-open` 글자 = `양식 채우기`(작은 글씨 없음).
  - `verify-formfill.js`: PDF 줄마다 단추 자리 · 단추 글자 `양식 채우기`.
  - `test-collector.mjs`: `tools/app-fetch-files.cjs` 결과에 `data/docs-pdf/index.json` · `formfill.js`·`style.css` 에 `fill-open-m` 없음 · `app-*.js` 에 `원본 양식 그대로 보기` 없음.
- [ ] **Step 2: `PORT=8741 CHROME_PATH=… node verify/verify-kosaf.js` 등 → 실패**
- [ ] **Step 3: 구현** — 상세 시트 ④는 `<ul class="doc-list">${attachPdfRowsHtml(대상, atts)}</ul>` (비면 생략) + `<ul class="doc-list">${atts.map((a) => \`<li class="att">${attachmentLinkHtml(a, 'color:var(--primary)')}</li>\`).join('')}</ul>`. 지원문서 머리는 한 목록에 PDF 줄 + `formPageRowsHtml` + `attachRowHtml`(meta 없음), 안내 문단 없음. 층1 신청서 묶음은 `isApplicationForm(a) || 신청서 사본 이름`. 신청 준비 시트는 두 묶음 모두 같은 규칙이고 `pdfNames` 거르기를 뺀다. `what-shows` 에 `─ 공고문 PDF n개` 줄.
- [ ] **Step 4: 드라이버·관문 통과 → 줄 순서를 일부러 뒤집어 빨개지는지(red-green) 보고 원복**
- [ ] **Step 5: 커밋** `앱 첨부 — PDF 줄 위·올린 목록 맨 밑 · 이름 그대로 · 회색 글씨·안내 문단·단추 작은 글씨 없음 (승인 시안 11-20)`

### Task 5: 실제 화면 대조 · 전체 관문 · 올리기

- [ ] **Step 1: 실제 앱(`PORT=8741` · 430×940)에 가짜 색인을 얹어 시안 세 공고(송원·문우림·통영)와 국가우수 머리를 찍고, 그림을 **열어** 시안과 줄마다 대조한다**(줄 수·이름·순서·회색 글씨 없음).
- [ ] **Step 2: 전체 관문** — `node verify/test-collector.mjs` · `node verify/audit-data.js` · 드라이버 넷(`PORT=8741`) · `node verify/check-deploy-sync.js` → 모두 초록(빨가면 `superpowers:systematic-debugging` 먼저).
- [ ] **Step 3: `superpowers:requesting-code-review` → 지적 반영 → `superpowers:verification-before-completion`**
- [ ] **Step 4: 문서** — 설계 문서 상태 줄에 커밋 · CLAUDE.md 데이터 표에 `data/docs-pdf/` 한 줄(60KB 천장 — 넘으면 경위 괄호를 깎는다) · 신청서 PDF 51/51 실측을 설계 문서에 둔다(이미 있음).
- [ ] **Step 5: 올리기** — `git fetch` → 작업 브랜치 → 기본 브랜치 `claude/nice-heisenberg-WESq5` → `main`(푸시 규약: 충돌 검토 후) · 노션 「개발 업무」 백로그에 새 줄(상태·날짜·근거·커밋).
