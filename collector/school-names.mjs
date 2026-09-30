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
  if (!unis.size) throw new Error('data.js 에서 UNIVERSITIES 를 못 읽었습니다 — 파일 모양이 바뀐 것 같습니다');
  return { unis, alias };
}

/* 학교 하나를 가리키는 글자들 — 정식 이름 + 그 학교로 풀리는 별칭 전부 + 이름에서 '대학교'를 뗀 짧은 꼴.
   교내·교외 판정기가 "제목에 이 학교의 이름표가 있나"를 볼 때 쓴다. */
export function schoolTokens(school, names) {
  const out = new Set([school]);
  for (const [alias, full] of names.alias) if (full === school) out.add(alias);
  const short = school.replace(/대학교$/, '');
  if (short.length >= 2) out.add(short);
  return [...out].filter((t) => t.length >= 2).sort((a, b) => b.length - a.length);
}
