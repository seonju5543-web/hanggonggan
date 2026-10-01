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
const { eachLabeledValue, extractDeadline, extractQualifyLines, scoopQualifyLines, extractExcludeLines, extractPriorityLines, extractFrom } = await import('./extract-excerpts.mjs');

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

/* ── 자격 · 제외 · 우선 선발 · 원문 안내 (2026-10-01 개발자 지시 "원문·첨부·자격요건·적합도를 장학금 탭 수준으로") ──
   🔴 규칙은 **장학 발췌기(extract-excerpts.mjs) 그대로** 부른다 — 활동용 자격 규칙을 따로 만들면 두 벌이 된다.
   조합도 장학 로봇과 같다: 자격 절(extractQualifyLines)이 있으면 그것, 없으면 2차 경로(scoopQualifyLines).
   그래도 없으면 '대상:' 이름표 줄 하나를 **자르지 않고** 쓴다(카드 발췌는 160자에서 자르지만 판정은 전체 문장으로).
   이름이 장학과 같은 이유: 앱의 판정 엔진(match-engine fitDetail)이 이 칸 이름으로 읽는다.
   원문 안내(noticeLines)는 장학의 `excerpts` 와 같은 규칙(extractFrom)인데, 활동 글의 `excerpts` 는 이미 {label,text} 라 이름을 달리 한다.
   🔴 문의처(전화·메일)는 싣지 않는다 — 활동 발췌의 기존 규칙(2026-09-29) 그대로. */
/* 2026-10-01 코드 리뷰로 넓힘(앞뒤가 숫자면 전화가 아니다 — `20261001 ~ 20261020` 이 지워지던 것 막음) — `02) 123-4567`·`010 - 1234 - 5678`·`01012345678`(1365 담당자 휴대전화)·`☎ 1588-1234`·`hong[at]korea.kr`·`담당자 김철수` */
export const CONTACT = /(?<!\d)0\d{1,2}\D{0,3}\d{3,4}\D{0,3}\d{4}(?!\d)|(?<!\d)1\d{3}\D{0,2}\d{4}(?!\d)|(?<!\d)01\d{8,9}(?!\d)|\d{2,4}[-.)\s]\d{3,4}[-.\s]\d{4}|@[a-z0-9.-]+\.[a-z]{2,}|\[at\]|문의\s*[:：]|담당자?|연락처|☎|☏/i;
const noContact = (lines) => lines.filter((l) => !CONTACT.test(l));
export function activityDetails(text) {
  const t = String(text || '');
  if (!t.trim()) return { eligibilityLines: [], eligibilityExcludes: [], eligibilityPriority: [], noticeLines: [] };
  let qual = extractQualifyLines(t);
  if (!qual.length) qual = scoopQualifyLines(t);
  /* '대상:' 이름표 줄도 **함께** 본다 (2026-10-01) — 자격 절이 짧은 한 줄(`참가자격 : 만 19~34세 대한민국 국민`)만 주고
     진짜 조건은 '대상:' 줄(`KOICA 사업 참여 경험이 있으며 …`)에 있던 공고가 **95% ✓** 로 떴다(틀린 안심). 한쪽이 다른 쪽을 품으면 하나만 둔다. */
  const who = eachLabeledValue(t, (label) => EXCERPT_LABELS[2][1].test(label.replace(/\s/g, '')), (v) => (cleanValue(v).length >= 4 ? cleanValue(v) : null));
  const flat = (x) => String(x).replace(/[\s:：·]/g, '');
  if (who && !qual.some((q) => flat(q).includes(flat(who)) || flat(who).includes(flat(q).replace(/^.*?(?:대상|자격)/, '')))) qual = [...qual, who];
  return {
    eligibilityLines: noContact(qual),
    eligibilityExcludes: noContact(extractExcludeLines(t)),
    eligibilityPriority: noContact(extractPriorityLines(t)),
    noticeLines: noContact(extractFrom(t)).slice(0, 8),
  };
}

/* 글 하나에 위 결과를 붙인다 — 수집 로봇의 세 길(새 글 · 재단 글 · 소급)과 API 로봇이 **같은 함수**를 쓴다.
   빈 칸은 지운다(읽었는데 없으면 옛 값을 남기지 않는다 · 장학 로봇과 같은 규칙). */
export const ACT_DETAILS_V = 2;   // 이 판으로 읽은 글은 detailsV 가 같다 — 다르면 수집 로봇이 원문을 다시 읽는다(소급 · 원칙 7)
export function putActivityDetails(it, details) {
  for (const k of ['eligibilityLines', 'eligibilityExcludes', 'eligibilityPriority', 'noticeLines']) {
    if (details[k] && details[k].length) it[k] = details[k]; else delete it[k];
  }
  it.detailsV = ACT_DETAILS_V;
  return it;
}

export default activityExcerpts;
