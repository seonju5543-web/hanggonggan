/**
 * "무엇을 올릴 수 있나" 에 답하는 **한 곳** (2026-09-10)
 *
 * 교외는 한국장학재단 등재분(`data/kosaf-open.json`), 교내는 경희대·한국외대 등록분
 * (`data/registered.json` → `insta/school.mjs`). 🔴 렌더러·고르기·관문이 **같은 목록**을
 * 봐야 한다 — 따로 읽으면 "고르기는 찾았는데 렌더러는 못 찾는" 일이 생긴다.
 */
import { readFileSync } from 'node:fs';
import { schoolNotices } from './school.mjs';

const ROOT = new URL('../', import.meta.url);

/** 교외 + 교내 전부. 각 항목은 같은 모양이다 — `{code, org, name, due, home, school?, fields}` */
export function allNotices() {
  const j = JSON.parse(readFileSync(new URL('data/kosaf-open.json', ROOT), 'utf8'));
  const outside = (j.items || j).map((x) => ({ ...x, school: x.school || null }));
  return { items: [...outside, ...schoolNotices()], meta: j };
}

/** 이름 일부로 찾는다. 🔴 교내·교외에 같은 이름이 있을 수 있으니 **먼저 맞는 것**이 아니라
 *  코드가 정확히 같은 것을 우선한다. */
export function findNotice(items, needle) {
  return items.find((x) => x.code === needle)
    || items.find((x) => (x.org + x.name).includes(needle));
}
