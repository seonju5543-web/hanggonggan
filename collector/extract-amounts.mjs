/* ============================================================
   금액·이중수혜·동일성 뽑기 (2026-08-27 신설)

   등록 공고 원문에서 세 가지를 읽어 data/registered.json 에 넣는다.
     · amountSpec   — 얼마인가 (절대액 / 등록금 비율 / 범위 / 시급 / 미확인)
     · exclusivity  — 다른 장학금과 함께 받을 수 있는가
     · sameAs       — 같은 장학금이 여러 학교 접수분으로 등록돼 있는가

   🔴 왜 셋을 한 번에 하나: 셋 중 하나만 해도 홈 합계가 **더 틀린다.**
      금액만 채우면 (재)가송재단 8건이 4,000만원으로 세어지고,
      이중수혜를 모르면 함께 못 받는 공고를 다 더한다. 학생이 실제로 받을 수 없는
      숫자를 '지금 받을 수 있는 장학금'이라고 말하는 것은 기망이다(개발자 지시 2026-08-27).

   판정 규칙은 여기에 없다 — parse-amount.js 한 곳에 있다(화면·감사와 공유).
   이 파일이 하는 일은 '원문을 찾아 그 함수에 먹이고 결과를 저장'뿐이다.

   실행:  node collector/extract-amounts.mjs          (미리보기 — 아무것도 안 고침)
          node collector/extract-amounts.mjs --write  (registered.json 반영)
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';
import { attachmentText, readable, docOrder } from './attachment-text.mjs';
/* 🔴 금액 문구(`500만원`)를 만드는 규칙은 **한 곳**이다 — 관리자 화면이 손으로 금액을 적을
   때도 같은 문구가 붙어야 한다(2026-09-17 · F-9 컨펌 2). 여기에 다시 적으면 로봇이 쓴 카드와
   사람이 쓴 카드가 다른 꼴로 뜬다. */
import { amountText } from '../tools/edit-diff.mjs';

const require = createRequire(import.meta.url);
const PA = require('../parse-amount.js');

const HERE = new URL('.', import.meta.url);
const WRITE = process.argv.includes('--write');
const regPath = new URL('../data/registered.json', import.meta.url);
const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const items = reg.items || [];

const texts = JSON.parse(fs.readFileSync(new URL('extracted/notices-text.json', HERE), 'utf8'));
let browserBodies = {};
try { browserBodies = JSON.parse(fs.readFileSync(new URL('extracted/browser-bodies.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }
const idx = indexTexts(texts, browserBodies);

/* 공고문 첨부 색인 — 자격 발췌기(extract-excerpts `qualFromDocs`)와 **같은 색인·같은 함수**다.
   🔴 2026-09-15 까지 이 로봇은 첨부를 한 번도 안 열어 봤다. 게시판 본문이 '붙임 참조'뿐이고
   금액이 공고문 HWP·DOCX 안에만 있는 공고는 영영 '금액 원문 확인'이었다 — 마감 전 20건 중
   금액 모르는 18건을 원문을 열어 가른 F-9 실측에서 그 유형이 가장 컸다.
   본문 → AI 가 옮긴 줄 → 첨부 순서다(본문이 있으면 본문이 언제나 정확하다 — 첨부에는
   붙임·서식이 섞인다). 신청서·동의서는 색인 단계(deepfetch `isNoticeDoc`)에서 이미 걸러져 있다.
   ⚠️ 여기서도 얼마인지는 parse-amount 가 정한다 — 예산표(`115명 180백만원`)를 1인당으로
      읽지 않는 관문(`TOTAL_TABLE` — 표의 합계 행)이 첨부에서 처음 걸렸다. */
let eligDocs = {};
try { eligDocs = JSON.parse(fs.readFileSync(new URL('extracted/elig-docs.json', HERE), 'utf8')); } catch { /* 아직 없음 */ }
function amountFromDocs(it) {
  for (const f of docOrder((eligDocs[it.id] || {}).files)) {   // 원문 글자(HWP)가 OCR 보다 먼저
    const t = attachmentText(new URL(`extracted/${f}`, HERE).pathname);
    if (!readable(t)) continue;
    const got = PA.amountFrom(t.split('\n').map((s) => s.trim()).filter(Boolean));
    if (got.kind !== 'unknown') return got;
  }
  return null;
}

/* ── 동일성 ────────────────────────────────────────────────────
   같은 재단이 여러 학교에서 접수하는 공고는 **하나의 장학금**이다.
   (재)가송재단이 8개 학교 접수분으로 등록돼 있는 것이 실제 사례다.

   🔴 느슨한 제목 대조로 이으면 안 된다 (CLAUDE.md 2026-08-21 사고):
      `복지장학금 (서울캠퍼스)`가 `(다빈치캠퍼스)` 공고에 붙은 적이 있다.
      그래서 조건 셋을 **모두** 만족할 때만 잇는다 (자세한 사정은 아래 merges 주석):
        ① 이름/주관에서 `○○재단·○○장학회` 꼴 이름표가 뽑히고
        ② 원문에서 읽어낸 **금액이 정확히 같은 것이 2건 이상**이고
        ③ 그 2건이 서로 **다른 학교 게시판**에서 온 것일 때
      하나라도 어긋나면 잇지 않는다 —
      **안 잇는 것은 합계가 부풀 뿐이고, 잘못 잇는 것은 남의 공고가 붙는 것이다.**
   ────────────────────────────────────────────────────────── */
const FOUND_RE = /([가-힣A-Za-z]{2,10})\s*(재단|장학회|장학재단|문화재단|복지재단|장학문화재단)/;
/* 학교 이름이 들어간 것은 그 학교 교내 장학금이라 잇지 않는다 */
const SCHOOL_WORD = /(대학교|대학|학원|캠퍼스)/;

function foundationKey(it) {
  const src = `${it.provider || ''} ${it.name || ''}`;
  const m = src.match(FOUND_RE);
  if (!m) return '';
  const name = m[1].replace(/^\(재\)|^재\)|^\(사\)/, '').trim();
  if (name.length < 2 || SCHOOL_WORD.test(name)) return '';
  return name + m[2];
}

/* 어느 학교 게시판에서 온 공고인가 — 같은 학교끼리는 잇지 않는다(교내 중복일 수 있다) */
function originOf(it) {
  const u = String(it.sourceUrl || '');
  const m = u.match(/^https?:\/\/([^/]+)/);
  return m ? m[1].replace(/^www\./, '') : (it.school || '');
}

/* ── 읽기 ─────────────────────────────────────────────────── */
let read = 0, noText = 0;
const stat = { fixed: 0, ratio: 0, range: 0, hourly: 0, unknown: 0 };
const excl = { forbidden: 0, allowed: 0, unknown: 0 };
const parsed = new Map();
let fromAi = 0;   // AI 가 첨부(그림·PDF)를 읽어 둔 줄에서 건진 금액
let fromDoc = 0;  // 공고문 첨부(HWP·DOCX) 글자에서 직접 건진 금액

for (const it of items) {
  const src = sourceFor(it, idx);
  /* 🔴 본문이 없다고 포기하지 않는다 (2026-08-28 개발자 지시).
     원문 미확보 15건을 실제로 열어 보니 **수집 실패가 아니라** 게시자가 공고문을
     그림·PDF 로만 올린 것이었다(`본문이미지-5906x8268.jpg`). 페이지에 글자가 없으니
     브라우저를 아무리 몰아도 못 읽는다. 그 글자는 `eligibility-ai.mjs` 가 그림을 읽어
     `amountLines` 에 **원문 그대로** 담아 둔다 — 여기서 그것을 본문 대신 쓴다.
     ⚠️ 모델이 옮긴 글자여도 얼마인지는 여전히 parse-amount 가 정한다 —
        총액/1인당 가르기·유의사항 절 차단·'전액'의 닻·자릿수 관문이 그대로 걸린다. */
  const aiLines = Array.isArray(it.amountLines) ? it.amountLines : [];
  const bodyLines = hasText(src) ? String(src.text).split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const hasDocs = ((eligDocs[it.id] || {}).files || []).length > 0;
  if (!bodyLines.length && !aiLines.length && !hasDocs) { noText++; continue; }
  read++;
  /* 본문이 있으면 본문이 먼저다. 본문으로 못 읽었을 때만 AI 가 옮겨 둔 줄로 한 번 더 본다 —
     읽어 둔 것을 안 쓰는 것이 지금까지 같은 그림을 두 번 읽게 만든 원인이었다. */
  let a = bodyLines.length ? PA.amountFrom(bodyLines) : { kind: 'unknown', value: 0, ratio: 0, min: 0, max: 0, raw: '' };
  if (a.kind === 'unknown' && aiLines.length) {
    /* 금액 절만 뽑아 온 줄이라 머리글이 없을 수 있다 — 머리글을 붙여 절로 읽히게 한다 */
    const b = PA.amountFrom(['장학금액', ...aiLines]);
    if (b.kind !== 'unknown') { a = b; fromAi++; }
  }
  /* 본문으로도 AI 줄로도 못 읽었으면 공고문 첨부를 연다 (위 amountFromDocs 주석) */
  if (a.kind === 'unknown' && hasDocs) {
    const d = amountFromDocs(it);
    if (d) { a = d; fromDoc++; }
  }
  const e = PA.exclusivityFrom(bodyLines.length ? bodyLines : aiLines);
  stat[a.kind]++; excl[e.kind]++;
  parsed.set(it.id, { a, e });
}

/* ── 동일성 묶기 ──────────────────────────────────────────── */
const byFoundation = new Map();
for (const it of items) {
  const key = foundationKey(it);
  if (!key) continue;
  if (!byFoundation.has(key)) byFoundation.set(key, []);
  byFoundation.get(key).push(it);
}

/* 🔴 재단 이름만으로는 부족하다 (처음에 그렇게 썼다가 실제로 틀렸다):
     · 한국장학재단 7건 — 국가근로·주거안정·대청교 멘토는 **서로 다른 사업**인데 한 건으로 묶였다
     · 한국고등교육재단 2건 — 동아시아연구장학생과 인재림 제6기는 다른 사업이다
   큰 재단은 사업을 여러 개 굴린다. 그래서 이름표에 더해 **금액이 같다는 증거**를 요구한다:
   같은 재단 안에서 **원문에서 읽어낸 금액이 정확히 같은 것끼리만**, 그것도 **2건 이상이
   각자 읽었을 때만** 묶는다. 한 건만 읽히고 나머지가 미확인이면 묶지 않는다 —
   미확인은 어차피 0원이라 합계가 부풀지 않으므로, **안 묶는 쪽이 언제나 안전하다.** */
const merges = [];
for (const [key, group] of byFoundation) {
  if (group.length < 2) continue;
  const byWon = new Map();
  for (const g of group) {
    const won = parsed.get(g.id)?.a.value || 0;
    if (!won) continue;                       // 미확인은 묶지 않는다 (0원이라 무해)
    if (!byWon.has(won)) byWon.set(won, []);
    byWon.get(won).push(g);
  }
  for (const [won, same] of byWon) {
    if (same.length < 2) continue;            // 혼자면 증거가 아니다
    const origins = new Set(same.map(originOf));
    if (origins.size < 2) continue;           // 같은 학교끼리는 교내 중복일 수 있다
    merges.push({ key, group: same, won, skipped: group.length - same.length });
  }
}

/* ── 보고 ─────────────────────────────────────────────────── */
const man = (n) => (n ? (n / 10000).toLocaleString('ko-KR') + '만원' : '-');

console.log(`\n■ 금액 읽기 — 등록 ${items.length}건 (원문 있음 ${read} · 없음 ${noText}${fromAi ? ` · 그중 AI 가 읽어 둔 첨부에서 건진 것 ${fromAi}건` : ''}${fromDoc ? ` · 공고문 첨부 글자에서 건진 것 ${fromDoc}건` : ''})`);
console.log(`   절대액 ${stat.fixed + stat.range}건 · 등록금 비율 ${stat.ratio}건 · 시급 ${stat.hourly}건 · 미확인 ${stat.unknown}건`);
console.log(`\n■ 이중수혜`);
console.log(`   함께 못 받음 ${excl.forbidden}건 · 함께 받을 수 있음 ${excl.allowed}건 · 원문에 없음 ${excl.unknown}건`);
console.log(`\n■ 같은 장학금으로 묶은 것 — ${merges.length}갈래`);
for (const m of merges) {
  console.log(`   ${m.key} · ${m.group.length}건 · ${man(m.won)}${m.skipped ? `  (같은 재단 ${m.skipped}건은 금액 미확인이라 안 묶음)` : ''}`);
  m.group.forEach((g) => console.log(`      - ${g.id}  ${String(g.name || '').slice(0, 46)}`));
}

if (!WRITE) {
  console.log('\n(미리보기입니다 — 아무것도 고치지 않았습니다. 반영하려면 --write)');
  process.exit(0);
}

/* ── 반영 ─────────────────────────────────────────────────── */
const sameAsOf = new Map();
for (const m of merges) for (const g of m.group) sameAsOf.set(g.id, m.key);

let wrote = 0;
/* 🔴 **사람이 넣은 값을 덮거나 지우지 않는다** (2026-09-13 코드 리뷰가 잡았다).
   이 로봇은 amountSpec·exclusivity·sameAs 를 **조건 없이** 덮고, 못 읽으면 **지웠다.**
   손으로 돌리던 동안에는 드물었지만 2026-09-13 에 수집 워크플로에 걸면서 매일 돌게 됐다 —
   그러면 관리자 화면에서 고친 값이 다음 날 아침에 조용히 되돌아간다. 실제로 이번 실행이
   `sameAs: "가송재단"` 을 지웠다.
   → `deadlineFrom` 과 같은 방식으로 **주인 표식**을 둔다. 이 로봇이 쓴 값에만 표식이 붙고,
     표식이 없는 값(= 사람이 넣은 값)은 건드리지 않는다.
   ⚠️ 그래서 파서를 고치면 **로봇이 쓴 값은 그대로 따라 갱신된다** — 사람 값만 고정이다.
      (안 그러면 파서를 고쳐도 옛 값이 영영 남는다.) */
const OWN_AMOUNT = '공고 원문';
const OWN_SAME = '자동';
let keptHuman = 0;
for (const it of items) {
  const got = parsed.get(it.id);
  if (got) {
    const { a, e } = got;
    /* 🔴 `amount` 가 아니라 `amountSpec` 이다 — `amount` 는 이미 금액 문구 문자열 칸이다.
       처음에 `amount` 에 객체를 넣었다가 entry-rules.cjs 의 `it.amount.slice()` 가 죽어
       감사가 통째로 멈췄다. 앱·챗봇·알림도 전부 문자열로 읽는다. */
    /* 사람이 넣은 금액이면 손대지 않는다.
       🔴 **로봇이 소유하는 표식은 `OWN_AMOUNT` 하나뿐**이고 그 밖은 전부 남의 것이다
       (2026-09-17 · 노션 UI-12). 예전엔 `!it.amountFrom` 즉 **표식이 없어야** 사람 값이라
       봐서, 사람이 근거를 적는 순간(`공고문 이미지 … · <원문 문구>`) 로봇이 제 것으로 알고
       다음 실행에 지웠다 — **근거를 남길수록 사라지는** 구조였다.
       바로 아래 `exclusivityFrom` 은 이미 `!== OWN_*` 로 판정한다(그 주석이 "표식이 없는
       옛 데이터도 여전히 사람 값이다" 라고 적어 뒀다) — 금액만 어긋나 있었다.
       ⚠️ 표식이 없는 옛 데이터는 그대로 사람 값이다(undefined !== OWN_AMOUNT).
       🔴 `· 비움` 은 사람이 **틀린 금액을 지운** 조치다 (2026-09-17 · F-9 컨펌 2) — 값이
          비었다고 로봇에게 돌려주면 다음 실행이 같은 줄을 다시 읽어 **같은 틀린 금액을
          되채운다**(마감일에서 겪었다). 그래서 비움 표식도 사람 값으로 본다. */
    const amountCleared = /^관리자 .*· 비움$/.test(it.amountFrom || '');
    const humanAmount = amountCleared
      || ((it.amountSpec || Number(it.amountValue) > 0) && it.amountFrom !== OWN_AMOUNT);

    if (humanAmount) keptHuman += 1;
    else if (a.kind === 'unknown') { delete it.amountSpec; delete it.amountFrom; }
    else { it.amountSpec = a; it.amountFrom = OWN_AMOUNT; wrote++; }

    /* 🔴 amountValue 는 남겨 둔다 — 앱·챗봇·관리자 화면이 아직 이걸 읽는다.
       amount 를 읽는 쪽으로 다 옮기기 전에 지우면 금액이 통째로 사라진다.
       비율형·시급형은 학생 등록금을 모르면 원으로 못 바꾸므로 0 그대로 둔다
       (지어내지 않는다 — 원칙 8-1). */
    if (!humanAmount && (a.kind === 'fixed' || a.kind === 'range')) {
      it.amountValue = a.value;
      /* 🔴 화면 문구도 같이 고쳐야 한다. 숫자만 채우고 `금액 원문 확인` 을 그대로 두면
         **카드는 "금액 원문 확인", 합계는 500만원**이라고 서로 다른 말을 한다.
         감사(entry-rules.cjs)가 바로 이걸 오류로 잡는다 — 처음에 그 상태로 저장했다가 걸렸다.
         ⚠️ 이미 숫자가 든 문구는 건드리지 않는다. 사람이 손으로 다듬어 넣은 것
            (`등록금 + 영농정착 지원` 같은)을 맨 숫자로 덮으면 뜻이 사라진다. */
      if (!/\d/.test(String(it.amount || ''))) it.amount = amountText(a);
    }

    /* 이중수혜도 같은 규칙 — 사람이 넣은 것은 그대로 둔다.
       🔴 **주인은 '표식이 있나'가 아니라 '누구 표식인가'로 가른다** (2026-09-14 수리).
          옛 판은 `!it.exclusivityFrom` — 표식이 **없는** 값을 사람 값으로 봤다. 그런데
          관리자 화면이 사람 값을 지키려고 `관리자 <날짜>` 표식을 붙이기 시작하자,
          그 표식 때문에 '로봇 것'으로 읽혀 **다음 실행에 지워졌다**(실측으로 재현).
          표식이 지키는 게 아니라 표식 때문에 지워지던 것이다.
       ⚠️ 표식이 없는 옛 데이터도 여전히 사람 값이다(undefined !== OWN_AMOUNT). */
    const humanExcl = it.exclusivity && it.exclusivityFrom !== OWN_AMOUNT;
    if (humanExcl) { /* 그대로 */ }
    else if (e.kind === 'unknown') { delete it.exclusivity; delete it.exclusivityFrom; }
    else { it.exclusivity = e; it.exclusivityFrom = OWN_AMOUNT; }
  }
  /* 🔴 동일성도 마찬가지다 — 이번 실행이 사람이 넣은 `sameAs: "가송재단"` 을 지웠다.
     이 로봇이 붙인 것만 지운다. */
  const key = sameAsOf.get(it.id);
  if (key) { it.sameAs = key; it.sameAsFrom = OWN_SAME; }
  else if (it.sameAsFrom === OWN_SAME) { delete it.sameAs; delete it.sameAsFrom; }
}

if (keptHuman) console.log(`   사람이 넣은 금액 ${keptHuman}건은 그대로 뒀습니다 (로봇 표식 '${OWN_AMOUNT}' 이 아닌 값은 안 덮습니다)`);
/* 🔴 날짜만 적는다 — 다른 로봇이 전부 `slice(0,10)` 이라, 여기만 시각까지 적으면
   registered.json 이 매 실행 더러워지고 관리자 화면의 '데이터 기준일' 에 시각이 뜬다
   (2026-09-13 코드 리뷰). */
reg.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(regPath, JSON.stringify(reg, null, 1) + '\n');
console.log(`\nregistered.json 반영 완료 — 금액 ${wrote}건 · 동일성 ${sameAsOf.size}건`);
