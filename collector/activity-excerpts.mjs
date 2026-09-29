/* ============================================================
   대외활동·공모전 글의 원문 발췌 — **한 곳** (2026-09-29 · 4차 리서치 적용)
   경쟁 앱(링커리어·위비티·씽유)이 공고 하나에 보여 주는 칸은 모집기간·활동기간·지원자격·혜택·주최·모집인원이다.
   우리는 그 칸을 **원문 문장 그대로** 발췌한다(원칙 8-1 — 추론 금지). 없으면 비운다.
   · 마감일: 장학 공고와 **같은 규칙**(extract-excerpts.mjs extractDeadline — 이름표 뒤 날짜만, 못 믿으면 null)
   · 나머지: 콜론이 있는 짧은 이름표 줄만 읽는다(eachLabeledValue — 베끼지 않는다)
   관문: verify/test-collector.mjs 「대외활동·공모전」 ⑥
   ============================================================ */
/* 🔴 extract-excerpts.mjs 는 불러오는 순간 본편(발췌 로봇)이 통째로 도는 파일이다 — EXCERPTS_AS_LIB=1 이면 본편을 건너뛴다.
   정적 import 는 끌어올려져 환경변수보다 먼저 실행되므로, 변수를 먼저 세우고 **동적으로** 불러온다(관문 test-collector 도 같은 길). */
process.env.EXCERPTS_AS_LIB = process.env.EXCERPTS_AS_LIB || '1';
const { eachLabeledValue, extractDeadline } = await import('./extract-excerpts.mjs');

/* 카드에 보이는 순서. 이름표 정규식은 **줄 머리의 짧은 이름표**에만 맞춘다. */
export const EXCERPT_LABELS = [
  ['모집기간', /^(?:모집|접수|신청|공모|응모|참가\s*신청)\s*(?:기간|일정|기한)$/],
  ['활동기간', /^(?:활동|운영|교육|봉사|파견|프로그램)\s*(?:기간|일정|일자)$/],
  ['대상', /^(?:모집|지원|참가|응모|참여|신청)\s*(?:대상|자격)$|^자격\s*요건$|^대상$/],
  ['혜택', /^(?:활동\s*)?(?:혜택|특전|지원\s*사항|지원\s*내용)$|^시상(?:\s*내역|\s*내용)?$|^상금$|^혜택\s*및\s*특전$/],
  ['주최', /^(?:주최|주관|주최\s*[·/]\s*주관|주관\s*[·/]\s*주최|운영\s*기관)$/],
  ['모집인원', /^(?:모집|선발)\s*(?:인원|규모)$/],
  ['활동지역', /^(?:활동|근무)\s*(?:지역|장소)$/],
];
const MAX_LEN = 160;

const cleanValue = (v) => String(v || '').replace(/\s+/g, ' ').replace(/^[\s:：\-–]+/, '').trim();

/* 이름표 하나의 값 — 첫 줄만, 160자 안에서 끊는다(문장 중간이면 …). 값이 짧은 기호뿐이면 안 읽은 것으로. */
function valueFor(text, re) {
  return eachLabeledValue(text, (label) => re.test(label.replace(/\s/g, '').replace(/^\s*[·•\-*]\s*/, '')) || re.test(label), (value) => {
    const v = cleanValue(value);
    if (v.length < 2) return null;
    return v.length > MAX_LEN ? `${v.slice(0, MAX_LEN - 1)}…` : v;
  });
}

/** @returns {{ deadline: string|null, excerpts: Array<{label:string, text:string}> }} */
export function activityExcerpts(text) {
  const t = String(text || '');
  if (!t.trim()) return { deadline: null, excerpts: [] };
  const excerpts = [];
  for (const [label, re] of EXCERPT_LABELS) {
    const v = valueFor(t, re);
    if (v) excerpts.push({ label, text: v });
  }
  return { deadline: extractDeadline(t) || null, excerpts };
}

export default activityExcerpts;
