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
/* ── 활동 글에서 자격을 못 뽑던 이유 셋 (2026-10-03 실측 · 활동 188건 중 122건이 자격 0줄) ──
   ① 활동 공고만 쓰는 절 제목 — `공모자격`·`공모대상`·`교육대상`. 장학 목록엔 없어 절을 못 찾았다(ACT_HEAD).
   ② 콜론 없는 이름표 — `ㅇ ( 신청자격 ) 대전시 거주 청년`·`○ (참가자격) 전 국민 누구나`·`<응모자격>`.
      장학 발췌기는 `이름표 :` 꼴만 이름표로 읽는다 → 괄호만 콜론으로 바꿔 넘긴다(labelColon · 글자는 그대로).
   ③ 사이트 메뉴의 `지원대상`·`신청자격` 같은 짧은 줄이 자격 절 제목으로 뽑혔다(본문보다 위에 있다).
      → 글 제목이 본문에 다시 나오는 **마지막 자리부터** 읽고, 거기서 못 찾으면 전체를 읽는다(atTitle).
   그래도 이름표가 없으면 `대한민국 국민 누구나`·`AI에 관심 있는 누구나` 처럼 **누가 낼 수 있나만 말하는 줄**을 원문 그대로 쓴다(OPEN_LINE). */
const ACT_HEAD = /공모\s?(?:자격|대상)|교육\s?대상|참가\s?범위|응모\s?범위|지원\s?범위/;
/* 🔴 `누구나` 가 **말의 끝**이어야 한다 — `③ 국민 누구나 찾고 머물며 … 공간`(공모 소재 예시)이 자격으로 뽑혔다(첨부 첫 실측).
   뒤에 붙어도 되는 것: 참여·신청 가능 · 괄호 부연(개인 또는 팀) · 인원(25인) */
const OPEN_LINE = /(?:(?:국민|세계인|시민|청년|학생|대학생|개인|팀|관심\s?(?:있는|있으신)\s?(?:분|사람)?)\s*(?:이면\s*)?(?:누구나|모두)|누구나)\s*(?:참여|참가|신청|응모|지원)?\s*(?:가능)?\s*(?:\d+\s?(?:인|명))?\s*(?:[(（].*[)）])?\s*[.!]?\s*$|(?:대상|자격|연령|나이)\s*[:：]?\s*제한\s?없음/;
const NOT_OPEN = /심사|수상|시상|제외|이해|쉽게|볼\s?수|이용|열람|니다/;
/* 누가 낼 수 있나를 말하는 줄글 — `…누구나 참가할 수 있으며` · `…재학생을 대상으로 …를 모집` · `…이면 신청할 수 있다` */
const WHO_SENTENCE = /누구나\s*(?:참가|참여|신청|응모|지원)\s*(?:할\s*수\s*있|이?\s*가능)|(?:재학생|대학생|청년|주민|시민|도민|구민|학생|국민)[^.]{0,20}(?:을|를)\s*대상으로|(?:이면|라면|인\s*경우)\s*(?:누구나\s*)?(?:참가|참여|신청|응모|지원)\s*(?:할\s*수\s*있|가능)/;
/* 🔴 `[ \t]` 이지 `\s` 가 아니다 — `\s` 는 줄바꿈까지 먹어 `<응모자격>` 아래 줄이 이름표 줄에 붙었다(첫 실측) */
/* 🔴 칸 이름으로 끝나는 이름표만 — `[서울문화재단] 2026년 …` 같은 제목 머리말을 `서울문화재단 : …` 으로 바꾸지 않는다(리뷰) */
/* 납작해진 표 — 이름표가 한 줄에 혼자, 값이 다음 줄(`대상` ↵ `대학생, 일반인 …` · `대상연령` ↵ `만 20세 이상 …` — K-Startup·대전청년포털 실측).
   이름표가 **그것뿐인 줄**일 때만 다음 줄과 `이름표 : 값` 으로 잇는다(글자는 그대로 · 콜론만). 🔴 `봉사대상` 은 봉사를 **받는** 사람이라 넣지 않는다 */
const TABLE_LABEL = /^(?:(?:모집|신청|참가|참여|지원|응모|교육|공모|활동)\s?(?:대상|자격)|대상\s?연령|대상자?|자격\s?요건|연령)$/;
const joinTablePairs = (t) => {
  const ls = t.split('\n');
  for (let i = 0; i < ls.length - 1; i += 1) {
    const a = ls[i].trim(), b = (ls[i + 1] || '').trim();
    /* 🔴 맨 `대상` 은 공모전 **1등 상 이름**이기도 하다 — 시상표의 `대상` ↵ `교육부장관상`·`1`·`300만 원` 을 잇지 않는다(2026-10-04 실측) */
    const award = /^대상$/.test(a) && /상(?:\s|\(|$)|^\d+\s*(?:명|점|건)?$|원$|만\s?원/.test(b);
    if (TABLE_LABEL.test(a) && b && b.length <= 150 && !TABLE_LABEL.test(b) && !/[:：]/.test(a) && !award) { ls[i] = `${a} : ${b}`; ls[i + 1] = ''; }
  }
  return ls.join('\n');
};
const labelColon = (t) => t.replace(/^([ \t]*(?:[ㅇ○●■□▣◆◇▶·•\-*✅✔]|\d+[ \t]*[.)])?[ \t]*)[(<\[【〈][ \t]*([가-힣 ]{0,10}(?:자격|대상|기간|방법|일정|일시|내용|혜택|인원|장소|요건|조건|범위|접수|신청|제한|주최|주관|분야|주제|시상|상금|발표))[ \t]*[)>\]】〉][ \t]*/gm, (m, pre, label) => `${pre}${label.trim()} : `);
/** 글 제목이 나오는 줄 번호들 (없으면 빈 배열) */
function titleStarts(t, title) {
  const key = String(title || '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 12);
  if (key.length < 6) return [];
  const out = [];
  t.split('\n').forEach((l, i) => { if (l.length <= 200 && l.replace(/[^가-힣A-Za-z0-9]/g, '').includes(key)) out.push(i); });
  return out;
}
const flatQ = (x) => String(x).replace(/[\s:：·]/g, '');
/** 본문 하나에서 자격 줄 — 절(qualifyLines) + 납작한 표에서 이은 이름표 줄 전부(`대상연령 : 만 20세 이상 …`) */
function bodyQual(body) {
  const q = qualifyLines(body);
  for (const l of body.split('\n').map((x) => x.trim())) {
    const m = l.match(/^([^:：]{1,10})\s:\s(.+)$/);
    if (m && TABLE_LABEL.test(m[1].trim()) && !q.some((x) => flatQ(x).includes(flatQ(m[2])))) q.push(l);
  }
  return q;
}
/* 절 제목으로 짚은 줄이 **정말 이름표인가** — 앞머리(기호·번호 뗀 12자 안)에 그 낱말이 있어야 한다.
   `… 심사 기준 등 자세한 사항은 누리집에서` 같은 보도자료 문장이 '심사 기준' 으로 절 제목이 되어 줄글 4줄이 자격 자리에 앉았다(첫 실측). */
const HEAD_LIKE = (l) => {
  const t = String(l || '').replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*ㅇ✅✔]+/, '').replace(/^(?:[가-힣]\s*[.)]|\d+\s*[.)])\s*/, '').slice(0, 14);
  /* 🔴 **짧은 이름표**여야 한다 — `참가 자격부터 제출 형식, 심사와 시상까지 확인하세요.` 는 안내 문장이다(요강 페이지 실측) */
  const whole = String(l || '').replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*ㅇ✅✔]+/, '').replace(/^(?:[가-힣]\s*[.)]|\d+\s*[.)])\s*/, '');
  const labelOnly = whole.replace(/\s*[(（][^)）]*[)）]\s*/g, '').length <= 20 || /^[^:：]{2,14}[:：]/.test(whole)   // 괄호 부연(`( 아래 2 개 조건 모두 만족해야 함 )`)은 빼고 잰다
    /* 콜론 없이 이름표와 내용이 한 줄 — OCR 포스터의 `모집대상 구리시 거주 또는 생활권 청년`. 이름표 낱말 뒤가 **빈칸**이면 이름표다(`자격부터` 처럼 조사가 붙으면 문장) */
    || /^[가-힣·#]{0,6}\s?(?:대상|자격|요건)(?:\s|$)/.test(whole);
  return labelOnly && /자격|대상|요건|조건|범위|기준/.test(t);
};
/* 줄글 — `모바일신분증에 관심 있는 국민이면 누구나 참가할 수 있으며 , …`(보도자료 꼴 · 2026-10-03 실측 20건이 이 꼴이었다).
   '누가 낼 수 있나'를 말하는 문장만 원문 그대로. **이름표 줄이 하나도 없을 때만** 쓴다(activityDetails 맨 끝).
   판정은 parseOpen 이 남는 글자 0일 때만 ✓ 라 이런 긴 문장은 '모름'으로 남는다(틀린 안심 없음) */
const proseLines = (t) => [...new Set(t.split('\n').map((l) => l.trim()).filter((l) => l.length >= 8 && l.length <= 200 && WHO_SENTENCE.test(l) && !NOT_OPEN.test(l.replace(/니다\s*\.?$/, ''))))].slice(0, 2);
function qualifyLines(t) {
  let q = extractQualifyLines(t, { head: ACT_HEAD, trustHead: true });
  /* 맨 제목 줄(`지원자격`)은 장학 발췌기가 표 머리글로 보고 빼므로 첫 줄이 내용일 수 있다 — 그 바로 윗줄이 제목이면 맞다(리뷰) */
  if (q.length && !HEAD_LIKE(q[0])) {
    const ls = t.split('\n').map((l) => l.trim()).filter(Boolean);
    const at = ls.indexOf(q[0]);
    if (!(at > 0 && HEAD_LIKE(ls[at - 1]))) q = [];
  }
  if (!q.length) q = scoopQualifyLines(t);
  if (!q.length) q = [...new Set(t.split('\n').map((l) => l.trim()).filter((l) => l.length >= 4 && l.length <= 60 && OPEN_LINE.test(l) && !NOT_OPEN.test(l)))].slice(0, 2);
  return q;
}
export function activityDetails(text, title) {
  const t = labelColon(String(text || ''));
  if (!t.trim()) return { eligibilityLines: [], eligibilityExcludes: [], eligibilityPriority: [], noticeLines: [] };
  /* 어디서부터 읽나 — 글 제목이 나오는 **자리마다** 읽어 보고 자격이 가장 많이 나오는 자리(같으면 뒤쪽).
     🔴 마지막 자리만 보면 두 번 나오는 제목 **사이**의 자격 표를 놓쳤다(K-Startup DMC 캠프 · 제목 191·214줄, 표 195~208줄 · 2026-10-04).
     맨 앞 세 줄(브라우저 제목줄 · 그 아래는 사이트 메뉴)은 제목이 한 번뿐일 때만 시작점으로 쓴다.
     표 잇기는 **본문을 자른 뒤에** — 먼저 이으면 메뉴의 `지원대상` 이 바로 아래 글 제목과 붙어 본문 첫 줄이 됐다(관문) */
  const tl = t.split('\n');
  const starts = titleStarts(t, title);
  const cands = starts.filter((i) => i > 2 || starts.length === 1);
  let body = t, qual = [];
  for (const i of cands) {
    const b = joinTablePairs(tl.slice(i).join('\n'));
    const q = bodyQual(b);
    if (body === t || q.length >= qual.length) { body = b; qual = q; }
  }
  if (!qual.length) qual = bodyQual(joinTablePairs(t));
  /* '대상:' 이름표 줄도 **함께** 본다 (2026-10-01) — 자격 절이 짧은 한 줄(`참가자격 : 만 19~34세 대한민국 국민`)만 주고
     진짜 조건은 '대상:' 줄(`KOICA 사업 참여 경험이 있으며 …`)에 있던 공고가 **95% ✓** 로 떴다(틀린 안심). 한쪽이 다른 쪽을 품으면 하나만 둔다. */
  const who = eachLabeledValue(t, (label) => EXCERPT_LABELS[2][1].test(label.replace(/\s/g, '')), (v) => (cleanValue(v).length >= 4 ? cleanValue(v) : null));
  const flat = (x) => String(x).replace(/[\s:：·]/g, '');
  /* 🔴 이름표를 뗀 앞 줄이 **빈 글자**면 비교하지 않는다 — 빈 글자는 어디에나 '들어 있어서' 대상 줄이 빠졌다(`■ 참가자격` 제목 줄 · 2026-10-04 관문) */
  const core = (q) => flat(q).replace(/^.*?(?:대상|자격)/, '');
  if (who && !qual.some((q) => flat(q).includes(flat(who)) || (core(q).length >= 4 && flat(who).includes(core(q))))) qual = [...qual, who];
  if (!qual.length) qual = proseLines(body);
  if (!qual.length && body !== t) qual = proseLines(t);
  return {
    eligibilityLines: noContact(qual),
    eligibilityExcludes: noContact(extractExcludeLines(t)),
    eligibilityPriority: noContact(extractPriorityLines(t)),
    noticeLines: noContact(extractFrom(t)).slice(0, 8),
  };
}

/* 글 하나에 위 결과를 붙인다 — 수집 로봇의 세 길(새 글 · 재단 글 · 소급)과 API 로봇이 **같은 함수**를 쓴다.
   빈 칸은 지운다(읽었는데 없으면 옛 값을 남기지 않는다 · 장학 로봇과 같은 규칙). */
export const ACT_DETAILS_V = 3;   // 이 판으로 읽은 글은 detailsV 가 같다 — 다르면 수집 로봇이 원문을 다시 읽는다(소급 · 원칙 7) · 3 = 2026-10-03 활동 자격 읽기(제목부터·괄호 이름표·누구나)
export function putActivityDetails(it, details) {
  /* 🔴 본문에 자격이 없는데 첨부·포스터에서 읽어 둔 자격(eligibilityFrom · collector/activity-docs.mjs)은 지우지 않는다 —
     본문을 다시 읽을 때마다 첨부에서 건진 자격이 빈 본문에 덮여 사라진다. 본문에서 자격이 나오면 본문이 이긴다(출처 표식도 뗀다). */
  const keepDocs = !!it.eligibilityFrom && !(details.eligibilityLines && details.eligibilityLines.length);
  for (const k of ['eligibilityLines', 'eligibilityExcludes', 'eligibilityPriority', 'noticeLines']) {
    if (keepDocs && k !== 'noticeLines') continue;
    if (details[k] && details[k].length) it[k] = details[k]; else delete it[k];
  }
  if (!keepDocs) { delete it.eligibilityFrom; delete it.eligibilityReviewed; }
  it.detailsV = ACT_DETAILS_V;
  return it;
}

export default activityExcerpts;
