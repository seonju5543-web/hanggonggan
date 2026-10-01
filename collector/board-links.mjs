/* ============================================================
   게시판 HTML 에서 글 링크를 뽑는 규칙 — **한 곳** (2026-09-26 · 노션 F-13)
   collect.mjs 안에 있던 extractLinks·stripSessionId 를 떼어 왔다. 재단 게시판 찾기 로봇
   (find-boards.mjs)도 같은 눈으로 읽어야 '찾을 때는 글로 보였는데 수집할 때는 안 보이는'
   어긋남이 없다. ⚠️ collect.mjs 는 불러오는 순간 실행되는 파일이라 거기서 import 할 수 없다.
   ============================================================ */
import { cleanTitle } from './clean-title.mjs';

/* 세션 표식(;jsessionid=…)을 뗀다 — 접속할 때마다 값이 달라서 그대로 두면 **매일 같은 공고를
   새 공고로 다시 담고**(이슈 #75와 같은 병), 남의 세션이 박힌 주소를 학생에게 보여 주게 된다.
   충북대에서 실제로 이 형태가 왔고, 떼고 열어도 정상인 것을 확인했다 (2026-08-02). */
export function stripSessionId(u) {
  return String(u || '').replace(/;jsessionid=[^?#/]*/i, '');
}

/* 목록 HTML 의 <a> 를 {title, url} 로 — 제목은 clean-title 규칙으로 정리하고 6~140자만 남긴다 */
export function extractLinks(html, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const title = cleanTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (title.length < 6 || title.length > 140) continue;
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https?:/.test(url)) continue;
    out.push({ title, url: stripSessionId(url) });
  }
  const uniq = new Map();
  out.forEach((i) => { if (!uniq.has(i.url)) uniq.set(i.url, i); });
  return [...uniq.values()];
}

/* 같은 사이트인가 — 게시판 글 링크가 그 학교 도메인 안에 있는지 본다 (2026-09-30 · 교내 소식).
   공지 게시판 바닥에는 SNS·포털·외부 사이트 링크가 함께 놓여 있어, 제목만 보고 걸러도 '네이버 블로그' 같은 것이
   남는다. 학교 도메인(ac.kr 는 세 토막 · 그 밖은 두 토막)이 같으면 같은 사이트로 본다(www-3.kw.ac.kr ↔ www.kw.ac.kr).
   찾기 로봇(find-news-boards.mjs)과 수집기(collect-news.mjs)가 같은 눈을 쓴다. */
export function siteKey(url) {
  let h;
  try { h = new URL(url).hostname.toLowerCase(); } catch { return ''; }
  const parts = h.split('.');
  const n = /\.(ac|co|or|go|re|ne|pe)\.kr$/.test(h) ? 3 : 2;
  return parts.slice(-n).join('.');
}
export function sameSite(url, base) {
  const a = siteKey(url); const b = siteKey(base);
  return !!a && !!b && a === b;
}

/* ── 게시판 **글 줄**만 뽑기 (2026-10-01 · 교내 소식 첫 실행 사고) ──────────────────────────────
   extractLinks 는 페이지의 <a> 전부를 준다 — 장학 수집기는 그 뒤에 장학 낱말로 거르니 괜찮았지만, 낱말 그물이 없는 교내 소식은
   첫 실행에서 **사이트 메뉴 906건**(「학교법인 경희학원」「대학정보공시」…)을 글로 담아 발행했다. 게시판 글 줄은 메뉴와 다르게
   **같은 줄(<tr>·<li>…)에 날짜가 붙어 있다** — 그것으로 가른다. 날짜는 게시일로 같이 담는다(postedAt · 지어낸 것이 아니라 줄에 적힌 것).
   ⚠️ 날짜가 줄에 없는 게시판(SPA·날짜 없는 목록)은 0건이 된다 — 그런 곳은 리포트 🟡 로 뜨고 사람이 규칙을 적는다. 메뉴를 섞는 것보다 낫다. */
const ROW_DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)|(?<!\d)(\d{2})\.(\d{2})\.(\d{2})(?!\d)/;
export function rowDate(text) {
  const m = ROW_DATE.exec(String(text || '').replace(/<[^>]+>/g, ' '));
  if (!m) return null;
  const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [`20${m[4]}`, m[5], m[6]];
  const mm = Number(mo); const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
export function extractDatedRows(html, base) {
  const out = new Map();
  /* 같은 꼬리표가 안에 또 나오지 않는 가장 안쪽 블록만 — 중첩 메뉴(li 안의 li)는 날짜가 없어 어차피 걸러진다 */
  const re = /<(tr|li|article|dd)\b[^>]*>((?:(?!<\1\b)[\s\S])*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const block = m[2];
    const postedAt = rowDate(block);
    if (!postedAt) continue;
    /* 글 줄은 링크 한둘(제목·첨부)에 짧다 — 날짜가 든 **메뉴 덩어리**(부산대 상단 바 · 충북대 바닥글 · 2차 실행 실측)는 링크가 많고 길다 */
    const links = extractLinks(block, base);
    if (links.length > 4 || block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length > 600) continue;
    for (const l of links) {
      if (!out.has(l.url)) out.set(l.url, { ...l, postedAt });
    }
  }
  return [...out.values()];
}
