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
  /* ⑥ 양식 정보 자체가 없는 항목 (2026-07-30 추가 — 9건이 이 상태로 방치돼 있었다).
     원칙 5: 채울 신청서 양식이 없는 공고는 noForm에 사유를 남겨야 감사를 통과한다 */
  if (!it.formId && !it.noForm) {
    warns.push(`${where} — formId도 noForm도 없음: 양식을 연결하거나 '양식 없음' 사유를 기재하세요`);
  }
  /* ⑦ 지어낸 금액 (원칙 8-1 추론 금지) — 금액 문구에 숫자가 없는데 합계에 들어갈 값이 있으면
     추론으로 넣은 값이다. 자동 등록이 일괄 50만원을 넣던 사고가 있었다 (2026-07-30) */
  if ((it.amountValue || 0) > 0 && !/\d/.test(it.amount || '')) {
    errors.push(`${where} — 금액 문구('${(it.amount || '').slice(0, 24)}')에 숫자가 없는데 amountValue=${it.amountValue}: 확인 못 한 금액은 0이어야 합니다`);
  }
  /* ⑧ 마감도 등록일도 없으면 앱 목록에서 영영 사라지지 않는다 (2026-07-30 추가) */
  if (!it.deadline && !it.listedAt) {
    warns.push(`${where} — 마감일이 없으면 listedAt(등록일)이 있어야 60일 뒤 자동으로 감춰집니다`);
  }
  if (it.listedAt && !/^\d{4}-\d{2}-\d{2}$/.test(it.listedAt)) {
    errors.push(`${where} — listedAt 형식 오류: ${it.listedAt}`);
  }
  /* ⑨ 원문 주소가 첨부 내려받기 링크면 '원문 보기'가 파일 다운로드가 된다 (2026-07-30 추가) */
  if (/mode=download|attachNo=|fileDown/i.test(it.sourceUrl || '') ||
      /\.(png|jpe?g|gif|hwpx?|pdf|docx?|zip|xlsx?)(\?|$)/i.test(it.sourceUrl || '')) {
    errors.push(`${where} — sourceUrl이 첨부 내려받기 주소입니다: 공고 원문 주소로 바꾸세요`);
  }
}

/* ⑩ 같은 공고 이중 등록 — 주소가 달라도 같은 학교·비슷한 이름이면 중복이다
   (2026-07-30 추가: 시립대 빅데이터 장학금이 수동·자동으로 두 번 등록돼 있었다) */
/* 괄호 안은 남긴다 — '복지장학2(부분)'과 '복지장학2(기초생활수급자)'처럼 괄호가 유일한 구분자인
   장학금이 있어서, 떼면 서로 다른 장학금이 중복으로 잡힌다. 대괄호는 뗀 판·살린 판을 모두 비교한다
   (대괄호 안에 사업단 이름이 든 공고가 있어 한쪽만 보면 놓친다) */
const clean = (s) => (s || '').replace(/[\s·ㆍ~〜.,'"]/g, '').toLowerCase();
const variants = (s) => [clean(s), clean((s || '').replace(/\[[^\]]*\]/g, ''))];
const gram = (s) => { const g = new Set(); for (let i = 0; i <= s.length - 4; i++) g.add(s.slice(i, i + 4)); return g; };
const simOf = (x, y) => {
  const [ga, gb] = [gram(x), gram(y)];
  const small = ga.size <= gb.size ? ga : gb; const big = ga.size <= gb.size ? gb : ga;
  if (!small.size) return 0;
  let hit = 0; for (const g of small) if (big.has(g)) hit++;
  return hit / small.size;
};
/* 이름 전체가 비슷해도 '(2026-2학기)'·'(한국외대 교내)' 같은 공통 꼬리표 때문일 수 있다
   ('국가고시 장학금 (2026-2학기)'와 '보훈장학금 (2026-2학기)'은 서로 다른 장학금이다).
   그래서 공통 꼬리표를 떼고 남은 '이름다운 부분'도 비슷한지 한 번 더 본다. */
const distinctiveSim = (x, y) => {
  let i = 0;
  while (i < x.length && i < y.length && x[x.length - 1 - i] === y[y.length - 1 - i]) i++;
  const [rx, ry] = [x.slice(0, x.length - i), y.slice(0, y.length - i)];
  if (!rx.length || !ry.length) return 1; // 한쪽이 다른 쪽을 그대로 품고 있음 = 같은 공고
  return simOf(rx, ry);
};
for (let a = 0; a < reg.items.length; a++) {
  for (let b = a + 1; b < reg.items.length; b++) {
    const A = reg.items[a]; const B = reg.items[b];
    const sa = (A.eligibility || {}).schoolOnly || ''; const sb = (B.eligibility || {}).schoolOnly || '';
    if (sa !== sb) continue; // 학교별 접수분은 별건 등록이 정상
    let sim = 0; let distinct = 0;
    for (const x of variants(A.name)) {
      for (const y of variants(B.name)) {
        if (simOf(x, y) > sim) { sim = simOf(x, y); distinct = distinctiveSim(x, y); }
      }
    }
    if (sim >= 0.8 && distinct >= 0.5) {
      warns.push(`registered — 같은 공고 이중 등록 의심: ${A.id}('${A.name.slice(0, 26)}') ↔ ${B.id}('${B.name.slice(0, 26)}')`);
    }
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
