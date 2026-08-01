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
const { checkEntry, isDuplicatePair } = require('./entry-rules.cjs');
const FIELD_TYPES = ['text', 'textarea', 'checks', 'checks+text', 'schedule'];

const errors = [];
const warns = [];

/* ① ② ③ ⑤ — 정식 등록 항목 */
const seenIds = new Set();
for (const it of reg.items) {
  const where = `registered:${it.id || '(id 없음)'}`;
  if (seenIds.has(it.id)) errors.push(`${where} — id 중복`);
  seenIds.add(it.id);
  /* 항목별 규칙은 verify/entry-rules.cjs 한 곳에만 있다 — 수집 로봇도 같은 규칙으로
     등록 '전'에 거르므로, 새 규칙을 거기 추가하면 양쪽에 동시에 적용된다 */
  for (const p of checkEntry(it, { formIds: new Set(Object.keys(forms.templates)) })) {
    (p.level === 'error' ? errors : warns).push(`${where} — ${p.msg}`);
  }
  // 신청서 첨부가 있는데 양식도 사유도 없는 경우는 따로 더 구체적으로 알린다
  const formAtt = (it.attachments || []).filter((a) =>
    /신청서|양식|지원서|서류/.test(a.name) && /\.(hwp|hwpx|doc|docx|zip)/i.test(a.name));
  if (formAtt.length && !it.formId && !it.noForm) {
    warns.push(`${where} — 신청서류 첨부(${formAtt[0].name.slice(0, 30)}…)가 있는데 양식 미등록`);
  }
}

/* 같은 공고 이중 등록 (2026-07-30 추가: 시립대 빅데이터 장학금이 수동·자동으로 두 번 등록돼 있었다) */
for (let a = 0; a < reg.items.length; a++) {
  for (let b = a + 1; b < reg.items.length; b++) {
    if (isDuplicatePair(reg.items[a], reg.items[b])) {
      warns.push(`registered — 같은 공고 이중 등록 의심: ${reg.items[a].id}('${reg.items[a].name.slice(0, 26)}') ↔ ${reg.items[b].id}('${reg.items[b].name.slice(0, 26)}')`);
    }
  }
}

/* ④ — 양식 스키마 */
for (const [key, tpl] of Object.entries(forms.templates)) {
  const where = `forms:${key}`;
  // pledge(서약문)는 필수가 아니다 — 원본에 서약 문구가 아예 없는 양식이 있다.
  // (2026-08-02: 사랑나눔 자기소개서. 서약은 별개 문서인 개인정보 동의서에 들어 있어,
  //  없는 것을 지어내면 원문 그대로 원칙에 어긋난다. forms.js는 없으면 그 줄을 안 그린다.)
  for (const f of ['title', 'docName', 'org', 'sections']) {
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

/* 피드·양식 큐 감사 (2026-07-30 추가) — 로봇이 매일 바꾸는 데이터도 같이 본다.
   그동안 감사는 정식 등록만 봤고, 피드 중복(시립대 40건 중 실제 13건)과
   양식 원본 유실은 사람이 눈으로 볼 때까지 아무도 몰랐다. */
const { urlKey, titleKey } = require('../collector/url-key.cjs');
try {
  const notices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
  const byUrl = new Map(); const byTitle = new Map(); let dup = 0;
  for (const n of notices.items || []) {
    const uk = `u:${urlKey(n.url)}`; const tk = titleKey(n) ? `t:${titleKey(n)}` : null;
    if (byUrl.has(uk) || (tk && byTitle.has(tk))) {
      dup++;
      if (dup <= 3) warns.push(`notices — 같은 공고가 두 번 들어 있음: '${(n.title || '').slice(0, 40)}'`);
    }
    byUrl.set(uk, 1); if (tk) byTitle.set(tk, 1);
  }
  if (dup) errors.push(`notices — 실시간 공고에 중복 ${dup}건 (수집기 중복 제거가 동작하지 않았습니다)`);
  // 첨부 내려받기 주소가 공고 주소로 들어온 것 (앱에서 '원문 보기'가 파일 다운로드가 된다)
  const badUrl = (notices.items || []).filter((n) => /mode=download|attachNo=|fileDown/i.test(n.url || ''));
  if (badUrl.length) warns.push(`notices — 첨부 내려받기 주소가 공고로 들어온 것 ${badUrl.length}건 (예: '${badUrl[0].title.slice(0, 30)}')`);
} catch { /* 피드 파일이 없으면 건너뜀 */ }

/* 양식 원본 큐: '원본 확보됨(fetched)'이라고 표시됐는데 실제 파일이 없으면,
   다음 세션이 양식을 만들 수 없다 (2026-07-30 도레이·염곡 원본이 이렇게 사라졌다) */
try {
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'collector/pending-forms.json'), 'utf8'));
  const files = fs.existsSync(path.join(ROOT, 'collector/extracted'))
    ? fs.readdirSync(path.join(ROOT, 'collector/extracted')) : [];
  const indexTxt = files.includes('forms-index.txt')
    ? fs.readFileSync(path.join(ROOT, 'collector/extracted/forms-index.txt'), 'utf8') : '';
  for (const q of queue.items || []) {
    if (!q.fetched || q.schematized) continue;
    const key = (q.target || q.name || '').trim().slice(0, 10);
    if (key && !indexTxt.includes(key)) {
      warns.push(`pending-forms:${q.id} — 원본 확보(fetched)로 표시됐는데 collector/extracted에 파일이 없습니다: 재확보가 필요합니다`);
    }
  }
} catch { /* 큐가 없으면 건너뜀 */ }

/* 결과 */
console.log(`감사 대상: 정식 등록 ${reg.items.length}건 · 양식 ${Object.keys(forms.templates).length}종`);
if (errors.length) { console.log('\n[오류 — 반드시 수정]'); errors.forEach((e) => console.log(' ✕', e)); }
if (warns.length) { console.log('\n[경고 — 소급 적용 필요 항목]'); warns.forEach((w) => console.log(' ⚠', w)); }
if (!errors.length && !warns.length) console.log('✓ 모든 데이터가 현재 엔진 기준을 충족합니다');
process.exit(errors.length ? 1 : 0);
