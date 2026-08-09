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
import { createRequire } from 'node:module';
import { canonUrl } from '../collector/canon-url.mjs';

/* 등록 규칙은 로봇이 쓰는 그 파일 하나뿐이다 — 화면이 따로 판단하게 만들지 않는다 */
const { checkEntry } = createRequire(import.meta.url)('../verify/entry-rules.cjs');

const REG = 'data/registered.json';
const CFG = 'collector/auto-register-config.json';
const SCHOOLS = 'collector/schools.json';
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
]);

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

/* 사람이 읽는 자격 문장 — 줄 수·길이에 상한을 둔다(브라우저에서 오는 값을 믿지 않는다) */
function cleanLines(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split('\n');
  return arr.map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20)
    .map((x) => x.slice(0, 300));
}

const reg = readJson(REG, null);
if (!reg || !Array.isArray(reg.items)) fail(`${REG} 를 읽지 못했습니다`);

const byId = (id) => reg.items.find((x) => x.id === id);
const ids = Array.isArray(payload.ids) ? payload.ids : (payload.id ? [payload.id] : []);

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
    const before = reg.items.length;
    const removed = reg.items.filter((x) => ids.includes(x.id)).map((x) => x.id);
    reg.items = reg.items.filter((x) => !ids.includes(x.id));
    if (reg.items.length === before) fail('되돌릴 대상을 찾지 못했습니다');

    const cfg = readJson(CFG, { enabled: true, blockIds: [] });
    cfg.blockIds = Array.from(new Set([...(cfg.blockIds || []), ...removed]));
    writeJson(CFG, cfg);

    detail = `${removed.length}건 제거 + 재등록 차단: ${removed.join(', ')}`;
    touched = true;
    break;
  }

  /* ── 등록 삭제 (차단 목록에는 넣지 않는다) ───────────────────── */
  case 'remove': {
    if (!ids.length) fail('대상이 지정되지 않았습니다');
    const before = reg.items.length;
    reg.items = reg.items.filter((x) => !ids.includes(x.id));
    if (reg.items.length === before) fail('삭제할 대상을 찾지 못했습니다');
    detail = `${before - reg.items.length}건 삭제: ${ids.join(', ')}`;
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

    const id = `adm-${cu.replace(/[^a-z0-9]/gi, '').slice(-24).toLowerCase()}`;
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

  /* ── 개별 항목 수정 ─────────────────────────────────────────── */
  case 'edit': {
    const it = byId(payload.id);
    if (!it) fail(`수정할 공고를 찾지 못했습니다: ${payload.id}`);
    const patch = payload.patch || {};
    const changed = [];

    Object.keys(patch).forEach((k) => {
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
      } else if (k === 'documents') {
        v = cleanLines(v);
        if (!v.length) v = null;
      } else if (k === 'amountValue') {
        v = Number(v) || 0;
      } else if (k === 'deadline' && v) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) fail(`마감일 형식이 올바르지 않습니다: ${v} (YYYY-MM-DD)`);
      } else if (k === 'type' && v && !['교내', '교외'].includes(v)) {
        fail(`구분은 '교내' 또는 '교외'만 가능합니다: ${v}`);
      } else if ((k === 'sourceUrl' || k === 'applyEmail') && v) {
        if (k === 'sourceUrl' && !/^https?:\/\//i.test(v)) fail(`원문 주소는 http(s)로 시작해야 합니다: ${v}`);
        if (k === 'applyEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(`이메일 형식이 올바르지 않습니다: ${v}`);
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

    if (!changed.length) fail('바뀐 내용이 없습니다');
    detail = `${payload.id} — ${changed.join(', ')}`;
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
   "등록했다고 하는데 목록에 없다"로 잡혔다. 이슈 #79('로봇이 고친 파일은 전부 git add')와 같은 유형이다. */
const WRITES_REG = ['confirm', 'revert', 'remove', 'edit', 'merge', 'register'];
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
