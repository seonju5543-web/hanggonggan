/* ============================================================
   robots.txt 존중 — 공공·재단 게시판을 읽기 전에 그 사이트가 막아 둔 길인지 본다 (2026-09-29 · 4차 리서치)
   왜 — 국내 판례는 접근 제한 조치(robots.txt 등)를 깨고 긁은 것을 불법행위로 본다. 학교 게시판은 계약 관계가 있어
   지금까지처럼 읽고, 새로 넓힌 공공·재단 출처는 여기서 한 번 묻는다.
   규칙 — User-agent: * 묶음의 Disallow 만 본다(우리 UA 이름은 http-headers.mjs 의 것) · 사이트마다 한 번만 받는다 ·
   robots.txt 를 못 받으면(없음·오류) **읽어도 된다**고 본다(대부분의 사이트가 파일이 없다 — 막힌 것과 없는 것은 다르다).
   ============================================================ */
import { FETCH_HEADERS } from './http-headers.mjs';

/** robots.txt 본문을 `*` 묶음의 Disallow 접두 목록으로. Allow 는 더 긴 것이 이긴다(구글 해석과 같다). */
export function parseRobots(txt) {
  const groups = [];
  let cur = null;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(); const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || cur.closed) { cur = { agents: [], disallow: [], allow: [], closed: false }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
    } else if (cur && (key === 'disallow' || key === 'allow')) {
      cur.closed = true;
      if (val) cur[key].push(val);
    }
  }
  const star = groups.filter((g) => g.agents.includes('*'));
  return { disallow: star.flatMap((g) => g.disallow), allow: star.flatMap((g) => g.allow) };
}

/* 규칙 하나 → 정규식. `*` 는 아무 글자(0개 이상) · 끝의 `$` 는 '여기서 끝' · 나머지는 앞부분 일치 (구글 해석과 같다).
   🔴 첫 별표에서 잘라 앞부분만 보던 옛 방식은 `Disallow: /*down*` 을 `Disallow: /` 로 읽어 사이트 전체를 막았다(2026-10-04 · 출처 넷이 ⛔). */
const ruleRe = (r) => new RegExp('^' + r.replace(/\$$/, '').replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + (r.endsWith('$') ? '$' : ''));
/** pathname 은 경로 + 물음표 뒤(`/a/subview.do?enc=…`) — robots.txt 규칙은 물음표 뒤까지 본다 */
export function allowedByRules(rules, pathname) {
  const p = pathname || '/';
  const hit = (list) => list.filter((r) => ruleRe(r).test(p)).sort((a, b) => b.length - a.length)[0] || '';
  const d = hit(rules.disallow); const a = hit(rules.allow);
  if (!d) return true;
  return a.length >= d.length;
}

const cache = new Map();   // origin → rules | null(못 받음)
export async function robotsAllows(url, fetchImpl = fetch) {
  let u; try { u = new URL(url); } catch { return true; }
  if (!cache.has(u.origin)) {
    let rules = null;
    try {
      const r = await fetchImpl(`${u.origin}/robots.txt`, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000), redirect: 'follow' });
      if (r.ok && /text/i.test(r.headers.get('content-type') || 'text/plain')) rules = parseRobots(await r.text());
    } catch { rules = null; }
    cache.set(u.origin, rules);
  }
  const rules = cache.get(u.origin);
  return rules ? allowedByRules(rules, u.pathname + u.search) : true;
}
