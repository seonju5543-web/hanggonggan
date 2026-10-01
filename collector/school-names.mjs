/* 앱의 학교 이름(UNIVERSITIES)과 별칭(UNIV_ALIASES)을 data.js 에서 **글자로** 읽는다.
   data.js 는 브라우저 스크립트라 require 할 수 없다. 표를 새로 만들지 않고 앱의 것을 그대로 쓴다 —
   publish-majors.mjs 에 있던 것을 2026-09-30 여기로 옮겼다(교내·교외 증거 판정기가 같은 것을 써야 해서 · 베끼지 않는다). */
import fs from 'node:fs';

export function loadSchoolNames(dataJsUrl) {
  const src = fs.readFileSync(dataJsUrl, 'utf8');
  const block = (head) => {
    const i = src.indexOf(head);
    if (i < 0) return '';
    return src.slice(i, src.indexOf(head.endsWith('[') ? '\n];' : '\n};', i));
  };
  const unis = new Set([...block('const UNIVERSITIES = [').matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const alias = new Map();
  for (const m of block('const UNIV_ALIASES = {').matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
    alias.set(m[1], m[2]);
  }
  /* 지역 이름(REGION_CITIES 의 열쇠 — 서울·부산·경기·세종…) — 학교 짧은 이름과 겹치는 것을 가려내는 데 쓴다 */
  const regions = new Set([...block('const REGION_CITIES = {').matchAll(/^\s*"([가-힣]+)"\s*:/gm)].map((m) => m[1]));
  if (!unis.size) throw new Error('data.js 에서 UNIVERSITIES 를 못 읽었습니다 — 파일 모양이 바뀐 것 같습니다');
  return { unis, alias, regions };
}

/* 학교 하나를 가리키는 글자들 — 정식 이름 + 그 학교로 풀리는 별칭 전부 + 이름에서 '대학교'를 뗀 짧은 꼴.
   교내·교외 판정기가 "제목에 이 학교의 이름표가 있나"를 볼 때 쓴다. */
export function schoolTokens(school, names) {
  const out = new Set([school]);
  for (const [alias, full] of names.alias) if (full === school) out.add(alias);
  /* '고려대학교 세종캠퍼스' → 밑동 '고려' · '부산대학교' → '부산' */
  const base = school.replace(/\s*[가-힣A-Za-z]*캠퍼스$/, '').replace(/대학교$/, '');
  if (/대학교/.test(school) && base.length >= 2) out.add(`${base}대`);
  /* 🔴 지역 이름(REGION_CITIES 의 열쇠 — 서울·부산·경기·세종·대전…)과 같은 밑동은 맨 꼴로 쓰지 않는다 (리뷰 3차 2026-09-30):
     「부산광역시 대학생 장학」이 부산대 교내로 읽혔다. 그 학교는 `부산대` 꼴로만 받는다.
     지역이 아닌 두 글자 밑동(동국·경희·한양…)은 남긴다 — 학교 제도 이름(동국리더장학·경희꿈도전장학)이 이 꼴로 붙는다.
     별칭은 세 글자 이상만 — '부대'·'연대'·'중대'·'홍대'는 '학부대학'·'연대 보증'·'중대한'·'홍대입구' 안에 있다. */
  if (base.length >= 2 && !(names.regions || new Set()).has(base)) out.add(base);
  return [...out].filter((t) => t.length >= 3 || t === base).sort((a, b) => b.length - a.length);
}
