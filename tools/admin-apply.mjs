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

/* 고칠 수 있는 항목만 — 이 목록에 없는 키는 무시한다 */
const ALLOWED = new Set([
  'name', 'provider', 'type', 'amount', 'amountValue', 'deadline', 'period',
  'summary', 'note', 'sourceUrl', 'formId', 'noForm', 'applyEmail',
]);

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

      if (k === 'amountValue') {
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
      if (v === null || v === '') {
        if (old !== undefined) { delete it[k]; changed.push(k); }
      } else if (old !== v) {
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

/* 공고 목록을 건드린 작업만 저장 (설정·게시판은 위에서 이미 저장했다) */
if (['confirm', 'revert', 'remove', 'edit', 'merge'].includes(action)) {
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
