/* 카드 채움 현황 — 마감 전 정식 등록 공고의 네 칸(자격 · 마감 · 금액 · 양식)이 얼마나 차 있는가 (2026-10-30 · 개발자 "카드 설명이 짧다 · 양식이 안 나온다")
   🔴 관문이 아니라 **보고 도구**다 — 실데이터에 기댄 고정 검사를 관문에 두지 않는다(CLAUDE.md). 작업 전후 숫자를 비교하는 자.
   🔴 카드가 실제로 그리는 칸으로 센다: 자격은 eligibilityLines(+구조 조건) · 신청 방법은 excerpts(별개 칸 — 이걸 '자격'으로 세면 틀린다 · 10-30 실측) ·
      양식은 앱 양식(formId) · 원본 PDF(data/forms-pdf) · 공고문 서식 쪽(data/form-pages) 셋 중 하나.
   쓰는 법: node verify/card-coverage.mjs [--list] [--today=YYYY-MM-DD] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
const today = String(flag('today') || new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10));
const read = (p, fb) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fb; } };

const STRUCT_KEYS = ['years', 'minGpa', 'maxBracket', 'tracks'];   // 구조화 자격 칸 — admin-apply ELIG_KEYS 의 자격 칸(schoolOnly·campusOnly·schoolsAny 는 범위라 안 센다 · 리뷰 2026-10-30)
export const hasStruct = (e) => !!e && STRUCT_KEYS.some((k) => e[k] != null && (!Array.isArray(e[k]) || e[k].length));
const FORM_ATT = /신청서|지원서|원서|계획서/;

/** 순수 함수 — 공고 하나의 빈 칸 목록. 관문이 표본으로 잰다. */
export function gaps(x, { formsPdf = {}, formPages = {} } = {}) {
  const g = [];
  if (!(x.eligibilityLines || []).length && !hasStruct(x.eligibility)) g.push('자격');
  if (!x.deadline) g.push('마감');
  if (!x.amountValue) g.push('금액');
  if (!(x.excerpts || []).length) g.push('신청방법');
  const hasForm = x.formId || (formsPdf[x.id] || []).length || (formPages[x.id] || []).some((f) => f && f.file);
  const formAtt = (x.attachments || []).some((a) => FORM_ATT.test(a.name || ''));
  if (!hasForm && formAtt) g.push('양식');
  return g;
}

export function coverage(items, ctx, day = today) {
  const live = items.filter((x) => !x.deadline || x.deadline >= day);
  const counts = { 마감전: live.length, 자격: 0, 마감: 0, 금액: 0, 신청방법: 0, 양식: 0, 네칸다찬것: 0 };
  const rows = [];
  for (const x of live) {
    const g = gaps(x, ctx);
    for (const k of g) counts[k] += 1;
    if (!g.filter((k) => k !== '신청방법').length) counts.네칸다찬것 += 1;
    if (g.length) rows.push({ id: x.id, school: (x.eligibility && x.eligibility.schoolOnly) || (x.eligibility && x.eligibility.schoolsAny ? '여러 학교' : '전국'), name: (x.name || '').slice(0, 44), gaps: g });
  }
  return { counts, rows };
}

if (process.argv[1] && fileURLToPath(new URL(import.meta.url)) === path.resolve(process.argv[1])) {
  const items = (read('data/registered.json', { items: [] }).items) || [];
  const ctx = { formsPdf: read('data/forms-pdf/index.json', {}).items || {}, formPages: read('data/form-pages/index.json', {}).items || {} };
  const { counts, rows } = coverage(items, ctx);
  console.log(`■ 카드 채움 현황 (${today} · 마감 전 정식 등록 ${counts.마감전}건)`);
  console.log(`   빈 칸 — 자격 ${counts.자격} · 마감 ${counts.마감} · 금액 ${counts.금액} · 양식(신청서 첨부가 있는데 PDF 없음) ${counts.양식} · 신청 방법 발췌 ${counts.신청방법}`);
  console.log(`   자격·마감·금액·양식이 다 찬 공고 ${counts.네칸다찬것}건 (${Math.round(counts.네칸다찬것 / Math.max(counts.마감전, 1) * 100)}%)`);
  if (flag('list')) for (const r of rows) console.log(`   - ${r.id} · ${r.school} · ${r.name} — 빈 칸: ${r.gaps.join('·')}`);
  else console.log('   (--list 로 공고별 빈 칸)');
}
