/* 데이터 소급 감사 — 엔진·정책이 업데이트될 때마다 실행해서
   '새 데이터'뿐 아니라 '기존 데이터'도 현재 기준을 충족하는지 전수 점검한다.
   (2026-07-05 도입: 페이스리프트가 신규 항목에만 적용되고 기존 항목이
    미흡하게 남는 문제의 재발 방지 장치)

   기준:
   ① 정식 등록 항목 필수 필드 (id·name·type·provider·amount·summary·eligibility·documents·sourceUrl)
   ② 신청서류(양식) 첨부가 있는 항목은 formId 연결 또는 noForm 사유 명시
   ③ formId는 data/forms.json에 실제 존재
   ④ forms.json 스키마 유효성 (섹션·필드·타입)
   ⑤ 마감일 형식(YYYY-MM-DD 또는 null)
   실행: node verify/audit-data.js  (오류 시 exit 1 — 경고는 목록만) */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
const forms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/forms.json'), 'utf8'));
const FIELD_TYPES = ['text', 'textarea', 'checks', 'checks+text', 'schedule'];

const errors = [];
const warns = [];

/* ① ② ③ ⑤ — 정식 등록 항목 */
const seenIds = new Set();
for (const it of reg.items) {
  const where = `registered:${it.id || '(id 없음)'}`;
  for (const f of ['id', 'name', 'type', 'provider', 'amount', 'summary', 'eligibility', 'documents', 'sourceUrl']) {
    if (it[f] == null) errors.push(`${where} — 필수 필드 누락: ${f}`);
  }
  if (seenIds.has(it.id)) errors.push(`${where} — id 중복`);
  seenIds.add(it.id);
  if (it.deadline != null && !/^\d{4}-\d{2}-\d{2}$/.test(it.deadline)) {
    errors.push(`${where} — 마감일 형식 오류: ${it.deadline}`);
  }
  const formAtt = (it.attachments || []).filter((a) =>
    /신청서|양식|지원서|서류/.test(a.name) && /\.(hwp|hwpx|doc|docx|zip)/i.test(a.name));
  if (formAtt.length && !it.formId && !it.noForm) {
    warns.push(`${where} — 신청서류 첨부(${formAtt[0].name.slice(0, 30)}…)가 있는데 양식 미등록: formId를 연결하거나 noForm 사유를 기재하세요`);
  }
  if (it.formId && !forms.templates[it.formId]) {
    errors.push(`${where} — formId '${it.formId}'가 data/forms.json에 없음`);
  }
}

/* ④ — 양식 스키마 */
for (const [key, tpl] of Object.entries(forms.templates)) {
  const where = `forms:${key}`;
  for (const f of ['title', 'docName', 'org', 'pledge', 'sections']) {
    if (tpl[f] == null) errors.push(`${where} — 필수 필드 누락: ${f}`);
  }
  const ids = new Set();
  for (const sec of tpl.sections || []) {
    for (const f of sec.fields || []) {
      if (!f.id || !f.label || !f.type) { errors.push(`${where} — 필드에 id/label/type 누락`); continue; }
      if (ids.has(f.id)) errors.push(`${where} — 필드 id 중복: ${f.id}`);
      ids.add(f.id);
      if (!FIELD_TYPES.includes(f.type)) errors.push(`${where}.${f.id} — 알 수 없는 type: ${f.type}`);
      if (/checks/.test(f.type) && (!Array.isArray(f.options) || !f.options.length)) {
        errors.push(`${where}.${f.id} — checks 타입인데 options 없음`);
      }
      if (!f.q) warns.push(`${where}.${f.id} — 질문 문구(q) 없음`);
    }
  }
}

/* 결과 */
console.log(`감사 대상: 정식 등록 ${reg.items.length}건 · 양식 ${Object.keys(forms.templates).length}종`);
if (errors.length) { console.log('\n[오류 — 반드시 수정]'); errors.forEach((e) => console.log(' ✕', e)); }
if (warns.length) { console.log('\n[경고 — 소급 적용 필요 항목]'); warns.forEach((w) => console.log(' ⚠', w)); }
if (!errors.length && !warns.length) console.log('✓ 모든 데이터가 현재 엔진 기준을 충족합니다');
process.exit(errors.length ? 1 : 0);
