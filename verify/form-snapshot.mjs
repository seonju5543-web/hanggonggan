/* ============================================================
   양식 문서 스냅샷 (2026-08-18 — 질문 방식 최적화의 안전망)

   이 작업이 지키기로 한 단 하나의 약속:
   **학생에게 묻는 방식만 바꾸고, 만들어지는 문서는 그대로 둔다**
   (운영 원칙 4 — 원본 첨부 신청서와 동일한 구조).

   그 약속을 사람 기억이 아니라 기계가 지키게 하는 도구다.

   🔑 핵심 설계 — 답을 '필드 id'가 아니라 '라벨'로 채운다.
   질문을 병합하면(group) 필드 id가 바뀌지만 원본 항목의 라벨은 그대로다.
   id로 채우면 병합만 해도 스냅샷이 달라져 아무것도 증명하지 못한다.
   라벨로 채우면 "같은 항목에 같은 답 → 같은 문서"를 그대로 비교할 수 있다.

   사용법
     node verify/form-snapshot.mjs --save   기준본 저장 (작업 시작 전에 한 번)
     node verify/form-snapshot.mjs          기준본과 대조 (달라지면 exit 1)
     node verify/form-snapshot.mjs --diff <formId>   그 양식의 달라진 줄 보기
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFormEngine, SAMPLE_PROFILE } from './form-engine-node.mjs';

const OUT = fileURLToPath(new URL('form-snapshots.json', import.meta.url));

/* 라벨을 답으로 — 같은 항목이면 언제나 같은 값이 나온다 */
const fill = (label) => `«${String(label || '').replace(/\s+/g, ' ').trim()}»`;

/* 한 필드에 줄 답. 새 타입이 생기면 여기에 추가한다.
   ⚠️ 모르는 타입을 조용히 문자열로 넘기면 렌더가 빈 칸을 찍고 검사가 통과해 버린다 */
function answerFor(f, unknown) {
  if (f.type === 'checks' || f.type === 'checks+text') {
    return { checks: (f.options || []).slice(0, 1), text: f.type === 'checks+text' ? fill(f.textLabel || f.label) : '' };
  }
  if (f.type === 'choice') return { checks: (f.options || []).slice(0, 1), text: '' };
  if (f.type === 'schedule') return { days: ['월'], time: '15:00 ~ 17:00' };
  if (f.type === 'group') {
    const o = {};
    (f.sub || []).forEach((s) => { o[s.id] = fill(s.label); });
    return o;
  }
  if (f.type === 'static') return '';
  if (f.type !== 'text' && f.type !== 'textarea') unknown.push(`${f.id}:${f.type}`);
  return fill(f.label);
}

function answersFor(tpl, unknown) {
  const ans = {};
  (tpl.sections || []).forEach((sec) => (sec.fields || []).forEach((f) => { ans[f.id] = answerFor(f, unknown); }));
  return ans;
}

/* 작성일은 매일 바뀐다 — 스냅샷에서만 고정한다 */
const stripDate = (html) => html.replace(/작성일: \d+년 \d+월 \d+일/, '작성일: (날짜)');

export function snapshotAll() {
  const eng = loadFormEngine({ profile: SAMPLE_PROFILE });
  const shots = {};
  const unknown = [];
  for (const key of Object.keys(eng.FORM_TEMPLATES).sort()) {
    const tpl = eng.FORM_TEMPLATES[key];
    try {
      shots[key] = stripDate(eng.renderFormDoc(tpl, SAMPLE_PROFILE, answersFor(tpl, unknown)));
    } catch (e) {
      shots[key] = `__ERROR__ ${e.message}`;
    }
  }
  return { shots, unknown: [...new Set(unknown)] };
}

/* ---- 실행 ---- */
const arg = process.argv[2] || '';
const { shots, unknown } = snapshotAll();
const errs = Object.entries(shots).filter(([, v]) => v.startsWith('__ERROR__'));

if (unknown.length) console.log(`⚠ 스냅샷이 모르는 필드 타입: ${unknown.join(', ')} — answerFor()에 추가하세요`);
if (errs.length) { errs.forEach(([k, v]) => console.log(`🚨 ${k} — 문서 생성 실패: ${v}`)); }

if (arg === '--save') {
  fs.writeFileSync(OUT, JSON.stringify(shots, null, 1));
  console.log(`기준본 저장: ${path.basename(OUT)} — 양식 ${Object.keys(shots).length}종`);
  process.exit(errs.length ? 1 : 0);
}

if (!fs.existsSync(OUT)) {
  console.log('기준본이 없습니다 — 먼저 `node verify/form-snapshot.mjs --save`를 실행하세요');
  process.exit(1);
}
const base = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const added = Object.keys(shots).filter((k) => !(k in base));
const removed = Object.keys(base).filter((k) => !(k in shots));
const changed = Object.keys(shots).filter((k) => k in base && base[k] !== shots[k]);

if (arg === '--diff') {
  const key = process.argv[3];
  if (!key || !(key in base)) { console.log('사용법: --diff <formId>'); process.exit(1); }
  const a = base[key].split('><'); const b = shots[key].split('><');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) console.log(`  ${i}\n   전: ${a[i]}\n   후: ${b[i]}`);
  }
  process.exit(0);
}

console.log(`양식 ${Object.keys(shots).length}종 · 문서 생성 실패 ${errs.length}건`);
added.forEach((k) => console.log(`  + 새 양식: ${k}`));
removed.forEach((k) => console.log(`  - 사라진 양식: ${k}`));
changed.forEach((k) => console.log(`  ✗ 문서가 달라짐: ${k}  (자세히: --diff ${k})`));
if (!changed.length && !removed.length && !errs.length) console.log('✅ 문서 출력 동일 — 원칙 4 유지');
process.exit(changed.length || removed.length || errs.length ? 1 : 0);
