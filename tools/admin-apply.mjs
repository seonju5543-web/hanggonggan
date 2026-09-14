/* 관리자 화면이 요청한 조정 1건을 데이터 파일에 적용한다.
   ------------------------------------------------------------------
   왜 이렇게 만들었나 (중요):
   관리자 화면(브라우저)이 저장소를 **직접** 고치지 않는다. 화면은 이 스크립트를 담은
   워크플로를 깨우기만 하고, 실제 수정은 여기서 일어난 뒤 **기존 감사(verify/audit-data.js)를
   통과해야만** 저장된다. 그래서 관리자 열쇠에는 파일 쓰기 권한을 주지 않아도 되고,
   잘못된 데이터가 학생 앱으로 나가는 경로가 원천 차단된다.

   또 하나: 요청 내용은 브라우저에서 오므로 **믿지 않는다.** 고칠 수 있는 항목을
   아래 ALLOWED로 못 박아서, 예상 못 한 키가 데이터에 섞이지 않게 한다.

   실행: ACTION=<이름> PAYLOAD='<json>' node tools/admin-apply.mjs            */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as canon from '../collector/canon-url.mjs';
import { indexTexts, sourceFor, hasText } from '../collector/notice-source.mjs';
import { attachmentText, readable } from '../collector/attachment-text.mjs';

/* 저장소 뿌리. 데이터 파일은 지금까지처럼 **작업 폴더 기준**으로 읽고 쓰지만(워크플로가
   저장소 안에서 돈다), 아래 '저장된 공고 원문'은 이 파일 기준으로 읽는다 — 검사도 같은 원문을
   봐야 "화면에선 통과, 검사에선 실패" 가 안 생긴다.
   🔴 디스크 경로를 URL 로 다루지 않는다(이름 속 `%`·`#` 에서 깨진다 — CLAUDE.md 층2 사고). */
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const canonUrl = canon.canonUrl;
/* 🔴 '주소 → id' 파생식의 원본은 `collector/canon-url.mjs` **한 곳**이다 — 베끼지 않는다.
   로봇(auto-register)과 이 파일이 각자 계산하면 차단 목록이 어긋나 뺀 공고가 되살아난다
   (2026-08-14 부경대: 규칙이 바뀌자 막아 둔 23건이 새 id 를 달고 돌아왔다).
   공용 파일이 옛 판이면 **조용히 다른 식으로 계산하지 않고 멈춘다.** */
const idFromUrl = (prefix, raw) => {
  if (typeof canon.idFromUrl !== 'function') {
    fail('collector/canon-url.mjs 에 idFromUrl 이 없습니다 — 공용 규칙 파일이 옛 판입니다 (같이 배포돼야 합니다)');
  }
  return canon.idFromUrl(prefix, raw);
};

/* 등록 규칙은 로봇이 쓰는 그 파일 하나뿐이다 — 화면이 따로 판단하게 만들지 않는다 */
const { checkEntry } = createRequire(import.meta.url)('../verify/entry-rules.cjs');

const REG = 'data/registered.json';
const CFG = 'collector/auto-register-config.json';
const SCHOOLS = 'collector/schools.json';
const PENDING = 'collector/pending-forms.json';
const FORMS = 'data/forms.json';
const LOG = 'data/admin-log.json';

const action = process.env.ACTION || '';
const actor = process.env.ACTOR || 'unknown';

let payload;
try {
  payload = JSON.parse(process.env.PAYLOAD || '{}');
} catch (e) {
  fail('요청 내용을 읽지 못했습니다 (JSON 형식 오류)');
}

function fail(msg) {
  console.error(`::error::관리자 조정 실패 — ${msg}`);
  process.exit(1);
}
const readJson = (p, dflt) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return dflt; }
};
const writeJson = (p, obj) => fs.writeFileSync(p, `${JSON.stringify(obj, null, 1)}\n`);
const kstNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);   // KST 기준 날짜

/* 고칠 수 있는 항목만 — 이 목록에 없는 키는 무시한다 */
const ALLOWED = new Set([
  'name', 'provider', 'type', 'amount', 'amountValue', 'deadline', 'period',
  'summary', 'note', 'sourceUrl', 'formId', 'noForm', 'applyEmail',
  /* 자격 요건 (2026-08-09 추가) — 학생 앱이 이미 읽는 칸들이라 앱 코드 변경은 필요 없다
     (`app.js`의 qBlock·reasonRows, `match-engine.js`의 tidyRequirement). */
  'eligibilityLines', 'eligibilityVerified', 'eligibility', 'documents',
  /* 앱이 이미 읽는데 화면에만 칸이 없던 넷 (2026-09-13 · C4) — 달력 발표 점(app.js 의
     announceDate) · '이런 학생은 못 받아요'(eligibilityExcludes) · '먼저 뽑는 기준'
     (eligibilityPriority) · 이중수혜(exclusivity).
     🔴 `amountSpec`(금액 구조)은 **일부러 안 넣는다** — 손으로 적으면 홈 합계가 틀어지고,
        그건 학생에게 받을 수 없는 숫자를 보여 주는 일이다(기망). */
  'announceDate', 'eligibilityExcludes', 'eligibilityPriority', 'exclusivity',
  /* 자유 형식 제출 스위치 — 아래에서 **근거 문장과 짝으로만** 다룬다 */
  'prepDoc', 'prepDocBasis',
]);

/* 🔴 **빈칸으로 지울 수 없는 칸.** 지금까지는 빈 값이 오면 칸을 지웠는데,
   `verify/entry-rules.cjs` 의 REQUIRED 가 사라지면 감사가 오류를 내고 **그 묶음 전체**가
   되돌려진다(같이 보낸 남의 수정까지). 게다가 documents 가 없으면 학생 앱이
   `for (const doc of sch.documents)` 에서 그대로 죽는다.
   감사가 잡기 전에, 읽을 수 있는 말로 여기서 멈춘다. */
const NEVER_EMPTY = new Set(['name', 'type', 'provider', 'amount', 'summary', 'sourceUrl', 'documents']);

/* 🔴 `eligibility`(기계 판정용)와 `eligibilityLines`(사람이 읽는 문장)를 **섞지 말 것.**
   매칭·알림·홈 합계는 전부 `eligibility`를 보고 판정한다. 여기에 자유 문장이 들어가면
   판정이 조용히 망가진다. 그래서 중첩 키도 화이트리스트로 못 박고, 값의 형태까지 검사한다. */
const ELIG_KEYS = {
  selective: 'bool',
  schoolOnly: 'str',
  campusOnly: 'str',
  years: 'numArr',      // [1,2,3,4]
  minGpa: 'num',
  maxBracket: 'num',
  tracks: 'strArr',
};

function cleanEligibility(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('자격(기계 판정용) 형식이 올바르지 않습니다');
  const out = {};
  Object.keys(v).forEach((k) => {
    const kind = ELIG_KEYS[k];
    if (!kind) return;                                  // 모르는 키는 조용히 버린다
    const raw = v[k];
    if (raw === null || raw === '' || raw === undefined) return;
    if (kind === 'bool') { if (raw === true) out[k] = true; return; }
    if (kind === 'str') { const t = String(raw).trim(); if (t) out[k] = t; return; }
    if (kind === 'num') { const n = Number(raw); if (Number.isFinite(n)) out[k] = n; return; }
    if (kind === 'numArr') {
      const a = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => Number(String(x).trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 6);
      if (a.length) out[k] = [...new Set(a)].sort();
      return;
    }
    if (kind === 'strArr') {
      const a = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => String(x).trim()).filter(Boolean);
      if (a.length) out[k] = [...new Set(a)];
    }
  });
  return out;
}

/* 달력에 **실제로 있는 날**인가 (2026-09-13).
   모양만 보면 `2026-13-01`·`2026-02-30` 이 통과하는데, 브라우저는 그런 날을 조용히 다음 달로
   굴려 버린다 — 학생 달력에 엉뚱한 날짜로 점이 찍힌다. 되읽어서 같은 글자가 나오는지 본다. */
const isDay = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/* 사람이 읽는 자격 문장 — 줄 수·길이에 상한을 둔다(브라우저에서 오는 값을 믿지 않는다) */
function cleanLines(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split('\n');
  return arr.map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20)
    .map((x) => x.slice(0, 300));
}

/* ── 저장된 공고 원문 — '이 문장이 정말 원문에 있나'를 확인할 때만 읽는다 ───────────
   🔴 근거를 안 보고 켜는 칸을 만들면 운영 원칙 8-1(추론 금지)이 그 자리에서 깨진다.
      그래서 화면이 적어 온 문장을 **저장된 원문에서 그대로 찾아** 확인한다.
   ⚠️ 두 파일이 840KB라 근거 확인이 필요할 때만 읽고, 한 번 읽은 것은 그 실행 안에서 다시 안 읽는다. */
let SRC = null;
function corpus(it) {
  if (!SRC) {
    const rd = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    let texts = [];
    let bodies = {};
    let docs = {};
    try { texts = rd('collector/extracted/notices-text.json'); } catch { /* 아직 없음 */ }
    try { bodies = rd('collector/extracted/browser-bodies.json'); } catch { /* 아직 없음 */ }
    try { docs = rd('collector/extracted/elig-docs.json'); } catch { /* 아직 없음 */ }
    /* 원문 잇는 규칙은 `collector/notice-source.mjs` 한 곳이다 — 베끼면
       "발췌기는 찾았는데 여기선 못 찾는" 어긋남이 생긴다. */
    SRC = { idx: indexTexts(texts, bodies), docs };
  }
  const parts = [];
  let hasSource = false;                 // 저장된 '공고 원문'을 실제로 찾았는가
  const src = sourceFor(it, SRC.idx);
  if (hasText(src)) { parts.push(src.text); hasSource = true; }
  /* 자유 형식 제출이 **첨부에만** 적힌 공고가 있다 — 공고문 첨부까지 본다(elig-docs 가 그 연결).
     글자가 안 나오는 스캔 PDF 등은 조용히 건너뛴다(읽은 척하지 않는다). */
  for (const f of ((SRC.docs[it.id] || {}).files || [])) {
    const t = attachmentText(path.join(ROOT, 'collector/extracted', f));
    if (readable(t)) { parts.push(t); hasSource = true; }
  }
  /* 발췌는 로봇이 **원문에서 그대로 뽑아 둔 것**이라 근거로 쓸 수 있다(ALLOWED 밖이라 사람이 못 고친다).
     다만 이것만 있는 상태는 '원문을 갖고 있다'가 아니다 — 아래에서 사유를 가를 때 쓴다.
     🔴 **자격 줄은 사람이 방금 쓴 것일 수 있다** (2026-09-14 수리). `eligibilityLines` 는
        같은 관리자 화면이 고칠 수 있는 칸이라, 근거로 인정하면 **자기가 쓴 글을 근거로**
        prepDoc·exclusivity 를 켤 수 있었다 — 한 묶음 안에서 ①자격 줄에 문장을 적고
        ②그 문장을 근거로 스위치를 켜면 통과했다(실측). 원칙 8-2 를 정면으로 깬다.
        그래서 **로봇이 넣은 자격 줄만** 근거로 쓴다(관리자 표식이 붙은 것은 뺀다). */
  parts.push(...(it.excerpts || []));
  if (!/^관리자/.test(it.eligibilityFrom || '')) parts.push(...(it.eligibilityLines || []));
  return { text: parts.join('\n'), hasSource };
}

/* 🔴 대조는 **공백을 지우고** 한다 — 수집 원문은 `취 · 창업` 처럼 띄어쓰기가 상해 있다 */
const squash = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();

/** 원문에 그 문장이 실제로 있는가 — 빈 문자열이면 확인된 것, 아니면 사람이 읽을 사유를 돌려준다 */
function basisProblem(it, quote) {
  const q = squash(quote);
  if (q.length < 12) return '근거 문장이 너무 짧습니다 (원문에서 12자 이상 그대로 복사해 주세요)';
  const c = corpus(it);
  if (squash(c.text).includes(q)) return '';
  /* 🔴 **못 찾은 사유를 짐작해 적지 않는다**(원칙 5). 저장된 원문이 아예 없으면 사유는
     '문장이 틀렸다'가 아니라 '대조할 원문이 없다'이고, 사람이 할 수 있는 일도 다르다. */
  if (!c.hasSource) return '이 공고의 원문이 저장돼 있지 않아 확인할 수 없습니다 — 먼저 워크플로 "공고 본문 재수집"을 돌려 주세요';
  return '적어 주신 문장을 저장된 공고 원문에서 찾지 못했습니다 (원문 대조 칸에서 그대로 복사해 주세요)';
}

/* 이중수혜 — 학생이 받을 수 있는 돈의 합계를 정하는 값이라 형태를 못 박는다.
   🔴 원문의 **한정어**로만 정한다: 한정어 없는 '타 대외/타 장학금' → external
      (= 교외 민간 장학금 전부. 학교·국가장학금은 안 들어간다) · '타 인재양성사업' 같이
      좁은 것 → narrow(합계에서 빼지 않는다).
   🔴 값 이름을 'all' 로 바꾸지 말 것 — 그 이름을 읽고 국가장학금까지 막으면 거의 모든 학생이 떨어진다.
   🔴 화면에서 'allowed'(중복 가능)를 만들지 않는다 — 확인 못 한 허용에 학생이 기댄다.
      조항이 없거나 못 읽으면 **칸을 비운다.** */
function cleanExclusivity(it, v) {
  if (v === null || v === '' || v === undefined) return null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('이중수혜 값의 형식이 올바르지 않습니다');
  if (v.kind !== 'forbidden') fail("이중수혜는 '중복 불가'만 화면에서 정합니다 (가능·모름은 칸을 비우세요)");
  if (!['external', 'narrow'].includes(v.scope)) fail(`이중수혜 범위는 external·narrow 둘뿐입니다: ${v.scope}`);
  const raw = String(v.raw || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  /* 이 문장은 학생 화면의 '원문 보기'에 **그대로** 뜬다(app.js) — 요약·의역이 아니라 원문이어야 한다 */
  const why = basisProblem(it, raw);
  if (why) fail(`${it.id} — 이중수혜 근거를 확인하지 못했습니다: ${why}`);
  return { kind: 'forbidden', scope: v.scope, raw };
}

const reg = readJson(REG, null);
if (!reg || !Array.isArray(reg.items)) fail(`${REG} 를 읽지 못했습니다`);

const byId = (id) => reg.items.find((x) => x.id === id);
const ids = Array.isArray(payload.ids) ? payload.ids : (payload.id ? [payload.id] : []);

/* ── 많이 지울 때는 지울 건수를 손으로 한 번 더 받는다 (2026-09-13) ───────────────
   🔴 감사(verify/audit-data.js)는 **'남은 것'만 본다** — 없어진 것은 못 본다.
      실측: 사본 저장소에서 items 를 48 → 0 으로 비우고 감사를 돌리니 **종료코드 0** 이었다.
      그래서 '실수로 목록을 통째로 지우는 일'은 여기서만 막을 수 있다.
   🔴 이 관문을 감사로 옮기지 말 것 — 같은 감사를 **수집 워크플로가 관문으로** 쓰므로,
      감사가 실패하면 그날 수집분 저장이 통째로 멈춘다(로봇이 차단 목록을 반영해 지우는
      정상 삭제까지 걸린다). */
const BULK_MIN = 5;         // 이보다 많이 지우거나
const BULK_RATIO = 0.1;     // 지금 목록의 10%를 넘게 지우면 → 지울 건수를 숫자로 한 번 더 받는다
function guardBulkRemove(targetIds) {
  const before = reg.items.length;
  /* 🔴 요청한 id 개수가 아니라 **실제로 지워질 건수**와 대조한다 — 없는 id 가 섞였으면 둘이
     다르고, 그때는 멈추는 것이 맞다(사람이 생각한 것과 다른 일이 벌어지고 있다는 뜻이다). */
  const willRemove = reg.items.filter((x) => targetIds.includes(x.id)).length;
  if (!(willRemove > BULK_MIN || willRemove > before * BULK_RATIO)) return { before, willRemove };
  const expect = Number(payload.expect);
  if (!Number.isInteger(expect) || expect !== willRemove) {
    fail(`한 번에 ${willRemove}건을 지우는 요청입니다(지금 ${before}건). 실수로 목록을 통째로 지우는 것을 막으려고 `
      + `지울 건수를 숫자로 한 번 더 받습니다 — 받은 값: ${payload.expect === undefined ? '없음' : payload.expect}`);
  }
  return { before, willRemove };
}

let detail = '';
let touched = false;

switch (action) {
  /* ── 검수 완료 — 자동 등록 배지를 뗀다 ───────────────────────── */
  case 'confirm': {
    if (!ids.length) fail('대상이 지정되지 않았습니다');
    const done = [];
    ids.forEach((id) => {
      const it = byId(id);
      if (!it) return;
      if (it.auto) { delete it.auto; done.push(id); }
      if (it.sourceKind === 'auto') it.sourceKind = 'official';
    });
    if (!done.length) fail('컨펌할 대상이 없습니다 (이미 검수 완료이거나 없는 id)');
    detail = `${done.length}건: ${done.slice(0, 6).join(', ')}${done.length > 6 ? ' 외' : ''}`;
    touched = true;
    break;
  }

  /* ── 되돌리기 — 등록에서 빼고, 로봇이 다시 넣지 않게 차단 목록에 올린다 ── */
  case 'revert': {
    if (!ids.length) fail('대상이 지정되지 않았습니다');
    const { before } = guardBulkRemove(ids);
    /* 🔴 지우기 **전에** 주소를 챙긴다 — 지운 뒤에는 registered.json 에 아무 흔적도 없다 */
    const dropped = reg.items.filter((x) => ids.includes(x.id));
    const removed = dropped.map((x) => x.id);
    reg.items = reg.items.filter((x) => !ids.includes(x.id));
    if (reg.items.length === before) fail('되돌릴 대상을 찾지 못했습니다');

    const cfg = readJson(CFG, { enabled: true, blockIds: [], blockUrls: [] });
    cfg.blockIds = Array.from(new Set([...(cfg.blockIds || []), ...removed]));
    /* 🔴 **주소로도 막는다.** id 는 canonUrl 에서 파생되므로 정규화 규칙이 바뀌면 통째로
       무효가 된다 — 2026-08-14 에 실제로 그래서 막아 둔 23건이 새 id 를 달고 되살아났다.
       로봇이 읽을 때 canonUrl 로 맞추므로 **원본 주소 문자열 그대로** 넣는다(사람이 눈으로
       알아볼 수 있어야 하고, 규칙이 또 바뀌어도 살아남는다).
       ⚠️ 정렬하지 말고 뒤에 붙인다 — 이 파일은 자동 병합 대상이 아니라, 정렬하면 diff 가
          파일 전체가 되어 로봇 커밋과 부딪힌다. */
    const have = new Set((cfg.blockUrls || []).map((u) => canonUrl(u)));
    const addUrls = [];
    dropped.forEach((x) => {
      const u = String(x.sourceUrl || '').trim();
      if (!u) return;
      const cu = canonUrl(u);
      if (have.has(cu)) return;
      have.add(cu);                       // 같은 묶음 안에서 겹치는 것도 한 번만
      addUrls.push(u);
    });
    cfg.blockUrls = [...(cfg.blockUrls || []), ...addUrls];
    /* 🔴 **id 와 주소의 짝을 적어 둔다** (2026-09-14 신설).
       차단을 푸는 쪽이 id 만 받으면 주소를 되찾을 방법이 없다 — id 가 주소에서
       파생되는 것은 `auto-`·`adm-` 뿐이고, 손으로 큐레이션한 `reg-` 는 주소와 아무
       관계가 없다(지금 등록 48건 중 18건). 그래서 파생으로 맞추려던 옛 코드는
       그 18건에서 **영원히 안 맞았고**, 화면은 '✅ 차단 해제'라고 말하면서 주소는
       남겨 두어 그 공고가 다시는 등록되지 않았다.
       ⚠️ 로봇(auto-register)은 이 칸을 안 읽는다 — blockIds·blockUrls 만 본다. */
    cfg.blockPairs = { ...(cfg.blockPairs || {}) };
    dropped.forEach((x) => {
      const u = String(x.sourceUrl || '').trim();
      if (u) cfg.blockPairs[x.id] = u;
    });
    /* 주소가 없는 항목은 id 로만 막힌다 — 조용히 넘기지 않고 사람에게 말한다 */
    const noUrl = dropped.filter((x) => !x.sourceUrl).map((x) => x.id);
    writeJson(CFG, cfg);

    detail = `${removed.length}건 제거(${before} → ${reg.items.length}건) · 재등록 차단 id ${removed.length}·주소 ${addUrls.length}`
      + (noUrl.length ? ` · ⚠️ 주소가 없어 id 로만 막은 것 ${noUrl.length}건: ${noUrl.join(', ')}` : '');
    touched = true;
    break;
  }

  /* ── 차단 풀기 — 되돌리기의 짝 (2026-09-13 신설) ──────────────
     이게 없으면 잘못 막은 공고를 **영영 되살릴 수 없다**(사람이 파일을 못 고치는 구조라
     차단 목록에 한 번 들어가면 끝이었다).
     ⚠️ 차단을 풀어도 공고가 되살아나지는 않는다 — 다음 수집 때 로봇이 다시 판단한다. */
  case 'unblock': {
    const urls = Array.isArray(payload.urls) ? payload.urls : [];
    if (!ids.length && !urls.length) fail('풀 대상이 지정되지 않았습니다');
    const cfg = readJson(CFG, { enabled: true, blockIds: [], blockUrls: [] });
    const wantUrl = new Set(urls.map((u) => canonUrl(u)));
    const bI = (cfg.blockIds || []).length;
    const bU = (cfg.blockUrls || []).length;
    cfg.blockIds = (cfg.blockIds || []).filter((x) => !ids.includes(x));
    /* 🔴 id 로 풀면 **그 id 가 파생된 주소도 같이** 푼다 — 한쪽만 풀면 계속 막힌 채 남는다.
       푸는 순서: ①막을 때 적어 둔 짝(blockPairs) ②주소에서 파생되는 id 를 쓰는 공고는 파생으로.
       🔴 **접두사를 하나로 박지 말 것** — 옛 판은 `idFromUrl('auto-', u)` 로만 봐서
          `reg-`(손 큐레이션 18건)·`adm-`(화면이 만든 것)은 절대 안 맞았다. */
    const paired = new Set(ids.map((x) => (cfg.blockPairs || {})[x]).filter(Boolean).map(canonUrl));
    const prefixOf = (x) => (String(x).match(/^[a-z]+-/) || ['auto-'])[0];
    const derived = (u) => ids.some((x) => x === idFromUrl(prefixOf(x), u));
    cfg.blockUrls = (cfg.blockUrls || []).filter((u) => {
      const cu = canonUrl(u);
      return !wantUrl.has(cu) && !paired.has(cu) && !derived(u);
    });
    if (cfg.blockPairs) ids.forEach((x) => { delete cfg.blockPairs[x]; });
    const gone = (bI - cfg.blockIds.length) + (bU - cfg.blockUrls.length);
    if (!gone) fail('차단 목록에서 그 대상을 찾지 못했습니다');
    writeJson(CFG, cfg);
    detail = `차단 해제 ${gone}줄 (id ${bI - cfg.blockIds.length}·주소 ${bU - cfg.blockUrls.length})`;
    touched = true;
    break;
  }

  /* ── 등록 삭제 (차단 목록에는 넣지 않는다) ───────────────────── */
  case 'remove': {
    if (!ids.length) fail('대상이 지정되지 않았습니다');
    const { before } = guardBulkRemove(ids);
    reg.items = reg.items.filter((x) => !ids.includes(x.id));
    if (reg.items.length === before) fail('삭제할 대상을 찾지 못했습니다');
    /* ⚠️ 여기서는 **일부러 차단하지 않는다** — 로봇이 내일 다시 등록할 수 있다.
       영영 빼려는 것이면 `revert` 다. 화면 문구에서 이 차이를 지우지 말 것. */
    detail = `${before - reg.items.length}건 삭제(${before} → ${reg.items.length}건): ${ids.join(', ')}`;
    touched = true;
    break;
  }

  /* ── 새 등록 — 수집된 공고를 사람이 골라 정식 등록한다 (2026-08-09 신설) ──
     로봇의 자동 등록과 다른 점: `auto` 배지를 붙이지 않는다(사람이 보고 넣은 것이므로
     이미 검수 완료다). 대신 **로봇과 똑같은 관문 두 개**를 통과해야 한다.
       ① 중복 판정 — auto-register와 **같은 canonUrl**로 본다. 규칙이 갈라지면
          로봇이 이 공고를 하루 뒤에 다시 등록한다(classify의 첫 줄이 이 집합을 본다).
       ② 등록 규칙 — `verify/entry-rules.cjs`의 checkEntry. 대출·대학원 전용·행사·
          목록 주소 등이 **사람 손으로도** 들어가지 않는다. */
  case 'register': {
    const n = payload.notice || {};
    const patch = payload.patch || {};
    const url = String(n.url || patch.sourceUrl || '').trim();
    const title = String(patch.name || n.title || '').trim();
    if (!url) fail('공고 원문 주소가 없습니다');
    if (title.length < 8) fail('제목이 너무 짧습니다 (8자 이상)');

    const cu = canonUrl(url);
    const dup = reg.items.find((x) => x.sourceUrl && canonUrl(x.sourceUrl) === cu);
    if (dup) fail(`이미 등록된 공고입니다 (${dup.id})`);

    /* 🔴 파생식은 공용 원본(`collector/canon-url.mjs`)만 쓴다 — 로봇과 갈라지면
       차단 목록과 중복 판정이 동시에 어긋난다 */
    const id = idFromUrl('adm-', url);
    if (byId(id)) fail(`같은 id가 이미 있습니다 (${id})`);

    const school = String(n.school || '').trim();
    const campus = String(n.campus || '').trim();
    const entry = {
      id,
      name: title.slice(0, 70),
      type: patch.type === '교외' ? '교외' : '교내',
      provider: patch.provider || `${school}${campus ? ` ${campus}` : ''} 게시 공고`.trim() || '원문 확인',
      amount: patch.amount || '금액 원문 확인',
      // 금액을 확인하지 못했으면 0 — 지어낸 숫자를 홈 합계에 섞지 않는다 (운영 원칙 8-1)
      amountValue: Number(patch.amountValue) > 0 ? Number(patch.amountValue) : 0,
      deadline: patch.deadline || null,
      ...(patch.deadline ? {} : { listedAt: TODAY }),
      period: patch.period || (patch.deadline ? `접수 ~${patch.deadline}` : '접수 기간 원문 확인'),
      summary: patch.summary || '관리자 화면에서 사람이 확인해 등록한 공고예요. 세부 내용은 원문 공고에서 확인하세요.',
      eligibility: { selective: true, ...(school ? { schoolOnly: school } : {}), ...(campus ? { campusOnly: campus } : {}) },
      documents: ['지원 자격·제출 서류는 원문 공고에서 확인'],
      duplicable: true,
      sourceUrl: url,
      sourceKind: 'admin',
      ...(patch.note ? { note: patch.note } : {}),
      ...(patch.formId ? { formId: patch.formId }
        : { noForm: patch.noForm || `관리자 등록 ${TODAY} — 양식은 확인 후 연결` }),
      ...(Array.isArray(n.attachments) && n.attachments.length ? { attachments: n.attachments.slice(0, 6) } : {}),
    };

    /* 로봇이 쓰는 규칙으로 먼저 걸러 본다 — 오류가 있으면 아예 넣지 않는다.
       (경고는 통과시킨다. 금액·마감 미확인은 정직한 상태이지 잘못이 아니다) */
    const problems = (checkEntry(entry, { formIds: new Set(Object.keys(readJson('data/forms.json', { templates: {} }).templates || {})) }) || [])
      .filter((p) => p.level === 'error');
    if (problems.length) fail(`등록 규칙에 걸립니다 — ${problems.map((p) => p.msg).join(' · ')}`);

    reg.items.push(entry);
    detail = `${id} · ${entry.name.slice(0, 40)}`;
    touched = true;
    break;
  }

  /* ── 양식 큐 조작 (D2, 2026-08-09) ──────────────────────────
     화면이 '스키마화 대기'를 보여만 주고 못 고쳤다. 두 가지만 연다:
       retire  — 자동 재시도를 멈춘다(원본을 6회 받아도 못 받는 것 등)
       retry   — 다시 받아 보게 한다(retired 해제 + fetched 되돌림)
     스키마 자체를 화면에서 만드는 것은 넣지 않는다 — 운영 원칙 4(원본과 동일 구조)와
     부딪힌다. 원본을 눈으로 보고 옮기는 일이라 사람이 세션에서 해야 한다. */
  case 'formQueue': {
    const q = readJson(PENDING, null);
    if (!q || !Array.isArray(q.items)) fail(`${PENDING} 를 읽지 못했습니다`);
    const op = payload.op;
    if (!['retire', 'retry'].includes(op)) fail(`모르는 작업입니다: ${op}`);
    if (!ids.length) fail('대상이 지정되지 않았습니다');

    const done = [];
    ids.forEach((id) => {
      const item = q.items.find((x) => x.id === id);
      if (!item) return;
      if (op === 'retire') { item.retired = true; done.push(id); }
      else { delete item.retired; item.fetched = false; done.push(id); }
    });
    if (!done.length) fail('큐에서 대상을 찾지 못했습니다');
    writeJson(PENDING, q);
    detail = `${op === 'retire' ? '자동 재시도 중단' : '다시 받기'} ${done.length}건: ${done.slice(0, 5).join(', ')}`;
    touched = true;
    break;
  }

  /* ── 없는 양식을 가리키는 연결 끊기 (D2) ────────────────────
     `formId`가 실제로는 없는 양식을 가리키면 학생이 '앱에서 작성'을 눌렀을 때 아무것도 안 뜬다.
     화면이 빨간 배너로 알려만 주고 고칠 수는 없었다. */
  case 'unlinkForm': {
    if (!ids.length) fail('대상이 지정되지 않았습니다');
    const templates = (readJson(FORMS, { templates: {} }) || {}).templates || {};
    const done = [];
    ids.forEach((id) => {
      const it = byId(id);
      if (!it || !it.formId) return;
      if (templates[it.formId]) fail(`${id} 의 양식(${it.formId})은 실제로 있습니다 — 끊지 않았습니다`);
      delete it.formId;
      it.noForm = `양식 연결 끊음 ${TODAY} — 가리키던 양식이 없어 정리했습니다`;
      done.push(id);
    });
    if (!done.length) fail('끊을 연결을 찾지 못했습니다');
    detail = `${done.length}건 연결 끊음: ${done.join(', ')}`;
    touched = true;
    break;
  }

  /* ── 항목 수정 ──────────────────────────────────────────────
     🔴 **여러 건을 한 번에 받는다** (2026-09-13). 예전에는 `payload.id` 한 건만 받아서,
     검수하며 마감·금액을 채우는 일이 **공고 수만큼 GitHub 작업을 깨웠다.** 화면 쪽은
     `applyAction` 의 `jobBusy` 가 한 번에 하나만 돌리고 그 작업이 끝날 때까지 화면 전체를
     잠그므로(그리고 `waitForRun` 은 최대 6분 기다린다), 13건을 고치면 13번을 **차례로**
     기다려야 했다. 실측으로 '관리자 조정' 한 번이 21초이고 큐·폴링까지 더하면 건당
     30~60초라, 하루치가 순수 대기만 7~13분이었다.
     이제 `payload.edits = [{ id, patch }, …]` 로 받아 한 번에 끝낸다.
     ⚠️ 옛 모양(`payload.id` + `payload.patch`)도 그대로 받는다 — 화면을 단계적으로 옮기므로
        둘 다 살아 있어야 중간에 배포해도 안 깨진다.
     🔴 한 건이라도 규칙을 어기면 **전부 멈춘다**(fail). 감사가 저장 직전에 다시 보고
        실패하면 통째로 되돌리므로, 반만 반영되는 상태가 생기지 않는다. */
  case 'edit': {
    const edits = Array.isArray(payload.edits) && payload.edits.length
      ? payload.edits
      : [{ id: payload.id, patch: payload.patch }];

    /* 🔴 **짝으로만 다루는 칸** — 아래 일반 루프가 건드리면 안 된다.
       스위치(prepDoc)와 근거 문장(prepDocBasis)은 따로 저장되면 뜻이 없다. 키 순서에
       기대지 않으려고 루프보다 **먼저** 처리한다. */
    const PAIRED = new Set(['prepDoc', 'prepDocBasis']);

    /* 자유 형식 제출 스위치 — 운영 원칙 8-2. '자유 형식으로 낼 수 있다'가 **원문으로 확인된**
       공고에만 켠다. 그래서 근거 문장을 함께 받아 저장된 원문에서 실제로 찾아본다.
       🔴 근거 검사를 경고로 낮추지 말 것 — 경고는 아무도 안 읽는다. */
    const applyPrepDoc = (it, patch, changed) => {
      if (!('prepDoc' in patch)) {
        if (!('prepDocBasis' in patch)) return;
        /* 근거만 왔다 = 이미 켜 둔 공고의 **근거 문장을 고친다**는 뜻이다.
           꺼져 있는데 근거만 오면 조용히 버리지 않고 말한다 — 화면엔 아무 말이 없는데
           아무 일도 안 일어나는 것이 이 저장소가 여러 번 데인 자리다. */
        if (!it.prepDoc) fail(`${it.id} — 자유 형식 제출 근거만 왔습니다. 스위치(prepDoc)를 함께 보내 주세요`);
      }
      const on = ('prepDoc' in patch) ? (patch.prepDoc === true || patch.prepDoc === 'true') : true;
      if (!on) {
        if (it.prepDoc !== undefined || it.prepDocBasis !== undefined) {
          delete it.prepDoc; delete it.prepDocBasis; changed.push('prepDoc');
        }
        return;
      }
      /* 🔴 앱은 `!s.prepDoc || s.formId || s.program` 이면 아무것도 안 한다 —
         조용한 무효 대신 멈춰서 왜인지 말한다. */
      if (it.formId) fail(`${it.id} — 이 공고에는 양식(${it.formId})이 연결돼 있어 준비용 문서가 뜨지 않습니다 (양식 연결을 먼저 끊으세요)`);
      if (it.program) fail(`${it.id} — 상시 제도에는 준비용 문서가 뜨지 않습니다`);
      const basis = String(patch.prepDocBasis || it.prepDocBasis || '').replace(/\s+/g, ' ').trim();
      const why = basisProblem(it, basis);
      if (why) fail(`${it.id} — 자유 형식 제출 근거를 확인하지 못했습니다: ${why}`);
      /* 🔴 근거는 학생 화면에 안 나가지만 **남긴다** — 나중에 '왜 켰나'를 되물을 수 있는 유일한 자리다 */
      const next = basis.slice(0, 300);
      if (it.prepDoc !== true || it.prepDocBasis !== next) {
        it.prepDoc = true; it.prepDocBasis = next; changed.push('prepDoc');
      }
    };

    /** 한 건에 patch 를 입힌다. 바뀐 칸 이름들을 돌려준다. */
    const applyPatch = (it, patch) => {
      const changed = [];
      applyPrepDoc(it, patch || {}, changed);
      Object.keys(patch || {}).forEach((k) => {
        if (PAIRED.has(k)) return;                         // 위에서 짝으로 처리했다
        if (!ALLOWED.has(k)) return;                       // 모르는 키는 버린다
        let v = patch[k];
        if (typeof v === 'string') v = v.trim();

        if (k === 'eligibility') {
          v = cleanEligibility(v);
        } else if (k === 'eligibilityLines') {
          v = cleanLines(v);
          if (!v.length) v = null;
        } else if (k === 'eligibilityVerified') {
          v = v === true || v === 'true';
          if (!v) v = null;                                // 거짓이면 칸 자체를 지운다
        } else if (k === 'documents' || k === 'eligibilityExcludes' || k === 'eligibilityPriority') {
          v = cleanLines(v);
          if (!v.length) v = null;
        } else if (k === 'exclusivity') {
          v = cleanExclusivity(it, v);
        } else if (k === 'announceDate' && v) {
          if (!isDay(v)) fail(`발표일 형식이 올바르지 않습니다: ${v} (YYYY-MM-DD · 달력에 있는 날)`);
          /* 🔴 로봇과 같은 순서 검사(extract-excerpts) — 발표일이 마감일보다 앞이면 결과
             발표일일 리가 없다. 해를 고쳐 주지 않고 멈춘다(지어내지 않는다). */
          if (it.deadline && v < it.deadline) fail(`${it.id} — 발표일(${v})이 마감일(${it.deadline})보다 앞섭니다`);
        } else if (k === 'amountValue') {
          v = Number(v) || 0;
        } else if (k === 'deadline' && v) {
          if (!isDay(v)) fail(`마감일 형식이 올바르지 않습니다: ${v} (YYYY-MM-DD · 달력에 있는 날)`);
        } else if (k === 'type' && v && !['교내', '교외'].includes(v)) {
          fail(`구분은 '교내' 또는 '교외'만 가능합니다: ${v}`);
        } else if ((k === 'sourceUrl' || k === 'applyEmail') && v) {
          if (k === 'sourceUrl' && !/^https?:\/\//i.test(v)) fail(`원문 주소는 http(s)로 시작해야 합니다: ${v}`);
          if (k === 'applyEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(`이메일 형식이 올바르지 않습니다: ${v}`);
        }

        /* 필수 칸을 빈칸으로 지우려는 요청은 여기서 멈춘다 (위 NEVER_EMPTY 주석 참조).
           🔴 문구에 `it.id` 를 반드시 넣는다 — 한 건이라도 걸리면 묶음 전체가 멈추므로,
              어느 공고인지 말해 주지 않으면 사람이 찾을 방법이 없다. */
        if ((v === null || v === '') && NEVER_EMPTY.has(k)) {
          fail(k === 'documents'
            ? `${it.id} — 요구 서류는 비울 수 없습니다. 모르면 "제출 서류는 공고 원문에서 확인" 처럼 한 줄이라도 남겨 주세요`
            : `${it.id} — '${k}' 는 비울 수 없는 칸입니다 (비우면 학생 화면이 깨집니다)`);
        }

        const old = it[k];
        const same = (a, b) => (typeof a === 'object' || typeof b === 'object')
          ? JSON.stringify(a) === JSON.stringify(b) : a === b;
        if (v === null || v === '') {
          if (old !== undefined) { delete it[k]; changed.push(k); }
        } else if (!same(old, v)) {
          it[k] = v; changed.push(k);
        }
      });

      /* ── 주인 표식 ────────────────────────────────────────────
         🔴 로봇이 **내일 아침에 덮지 않게** 누가 넣은 값인지 남긴다. 이 표식이 없으면
            `extract-excerpts` 가 매 실행 제외·우선 줄을 통째로 다시 쓰고 지운다 —
            화면에 칸만 생기고 값은 하루도 안 남는다.
         🔴 비우면 표식도 함께 지워 **로봇에게 돌려준다**(다음 수집 때 원문에서 다시 읽는다).
         ⚠️ `exclusivityFrom` 은 뜻이 거꾸로였다(표식이 **없는** 값이 사람 값) — 로봇 쪽
            판정 한 줄(`extract-amounts.mjs`)이 같이 고쳐져야 이 표식이 일한다. */
      const OWNER = `관리자 ${TODAY}`;
      const mark = (key, from) => {
        if (!changed.includes(key)) return;
        if (it[key] !== undefined) it[from] = OWNER; else delete it[from];
      };
      mark('exclusivity', 'exclusivityFrom');
      mark('eligibilityExcludes', 'eligibilityExcludesFrom');
      mark('eligibilityPriority', 'eligibilityPriorityFrom');
      mark('eligibilityLines', 'eligibilityFrom');   // 이미 열려 있던 칸 — 지금은 매일 지워진다
      return changed;
    };

    const parts = [];
    edits.forEach((e) => {
      const it = byId(e && e.id);
      if (!it) fail(`수정할 공고를 찾지 못했습니다: ${e && e.id}`);
      const changed = applyPatch(it, e.patch);
      /* 바뀐 게 없는 건은 **묶음을 죽이지 않고 건너뛴다** — 여러 건을 보낼 때는
         그중 하나가 이미 같은 값인 일이 흔하다. 전부 그대로면 아래에서 멈춘다. */
      if (changed.length) parts.push(`${e.id} — ${changed.join(', ')}`);
    });

    if (!parts.length) fail('바뀐 내용이 없습니다');
    detail = parts.length === 1 ? parts[0] : `${parts.length}건 — ${parts.join(' / ')}`;
    touched = true;
    break;
  }

  /* ── 중복 합치기 ────────────────────────────────────────────── */
  case 'merge': {
    const keep = byId(payload.keepId);
    const drop = byId(payload.dropId);
    if (!keep || !drop) fail('합칠 두 공고를 모두 찾지는 못했습니다');
    if (keep.id === drop.id) fail('같은 공고끼리는 합칠 수 없습니다');

    const ke = keep.eligibility || {};
    const de = drop.eligibility || {};
    let promoted = false;
    /* 서로 다른 학교에 같은 공고가 올라온 경우 = 사실 여러 학교가 받는 장학금이다.
       한쪽만 남기면 다른 학교 학생이 못 보게 되므로 전국으로 승격한다 (호반 선례). */
    if (ke.schoolOnly && de.schoolOnly && ke.schoolOnly !== de.schoolOnly) {
      delete ke.schoolOnly; delete ke.campusOnly;
      keep.eligibility = ke;
      promoted = true;
    }
    /* 남기는 쪽에 없는 정보는 지우는 쪽에서 살려 온다 (링크·첨부·발췌를 잃지 않게) */
    if (!keep.deadline && drop.deadline) keep.deadline = drop.deadline;
    if (!(keep.attachments || []).length && (drop.attachments || []).length) keep.attachments = drop.attachments;
    if (!(keep.excerpts || []).length && (drop.excerpts || []).length) {
      keep.excerpts = drop.excerpts;
      if (drop.excerptNote) keep.excerptNote = drop.excerptNote;
    }
    if (!keep.formId && drop.formId) keep.formId = drop.formId;

    reg.items = reg.items.filter((x) => x.id !== drop.id);
    detail = `${drop.id} → ${keep.id} 로 합침${promoted ? ' (전국으로 승격)' : ''}`;
    touched = true;
    break;
  }

  /* ── 자동 등록 로봇 켜기/끄기 ───────────────────────────────── */
  case 'autoRegister': {
    const cfg = readJson(CFG, { enabled: true, blockIds: [] });
    cfg.enabled = !!payload.enabled;
    writeJson(CFG, cfg);
    detail = `자동 등록 ${cfg.enabled ? '켜짐' : '꺼짐'}`;
    touched = true;
    break;
  }

  /* ── 게시판 주소 추가 ───────────────────────────────────────── */
  case 'addBoard': {
    const url = String(payload.boardUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) fail(`게시판 주소는 http(s)로 시작해야 합니다: ${url}`);
    const s = readJson(SCHOOLS, null);
    if (!s || !Array.isArray(s.schools)) fail(`${SCHOOLS} 를 읽지 못했습니다`);
    const row = s.schools.find((x) => x.school === payload.school
      && (x.campus || '') === (payload.campus || ''));
    if (!row) fail(`학교를 찾지 못했습니다: ${payload.school} ${payload.campus || ''}`);
    row.boardUrl = url;
    row.note = `관리자 화면에서 등록 (${kstNow()} KST)`;
    writeJson(SCHOOLS, s);
    detail = `${payload.school} ${payload.campus || ''} → ${url}`;
    touched = true;
    break;
  }

  default:
    fail(`알 수 없는 작업입니다: ${action}`);
}

if (!touched) fail('아무것도 바뀌지 않았습니다');

/* 공고 목록을 건드린 작업만 저장 (설정·게시판은 위에서 이미 저장했다).
   ⚠️ **새 동작을 추가하면 이 목록에도 반드시 넣을 것.** 빠뜨리면 화면에는 "✅ 성공"이
   뜨는데 파일은 그대로다 — 2026-08-09에 `register`가 실제로 이 상태였고, 로컬 시험에서
   "등록했다고 하는데 목록에 없다"로 잡혔다. 이슈 #79('로봇이 고친 파일은 전부 git add')와 같은 유형이다.
   ⚠️ `unblock`(차단 풀기)은 **일부러 여기 없다** — 공고 목록을 건드리지 않고 설정 파일만 고치며,
      그 저장은 위 case 안에서 이미 끝났다. */
const WRITES_REG = ['confirm', 'revert', 'remove', 'edit', 'merge', 'register', 'unlinkForm'];
if (WRITES_REG.includes(action)) {
  reg.updatedAt = kstNow().slice(0, 10);
  writeJson(REG, reg);
}

/* 변경 이력 — 개발자가 둘이라 '누가 언제 무엇을'이 남아야 서로 덮어쓰지 않는다 */
const log = readJson(LOG, { items: [] });
log.items = log.items || [];
log.items.push({ at: `${kstNow()} KST`, by: actor, action, detail });
if (log.items.length > 500) log.items = log.items.slice(-500);
writeJson(LOG, log);

console.log(`✅ ${action} — ${detail}`);
console.log(`   요청자: ${actor}`);
