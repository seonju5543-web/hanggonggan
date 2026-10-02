/* ============================================================
   게시판 HTML 에서 글 링크를 뽑는 규칙 — **한 곳** (2026-09-26 · 노션 F-13)
   collect.mjs 안에 있던 extractLinks·stripSessionId 를 떼어 왔다. 재단 게시판 찾기 로봇
   (find-boards.mjs)도 같은 눈으로 읽어야 '찾을 때는 글로 보였는데 수집할 때는 안 보이는'
   어긋남이 없다. ⚠️ collect.mjs 는 불러오는 순간 실행되는 파일이라 거기서 import 할 수 없다.
   ============================================================ */
import { cleanTitle } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';   // 글 줄 뽑기(extractDatedRows)가 파일 링크를 뺀다 (2026-10-01)

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
/* 두 자리 연도는 점(26.09.30)과 줄표(26-09-30 · 계명 4차 정찰 실측) 둘 다 — 달 1~12·날 1~31 검사가 전화번호 같은 숫자를 거른다 */
const ROW_DATE = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)|(?<![\d-])(\d{2})([.\-])(\d{2})\5(\d{2})(?![\d-])/;
export function rowDate(text) {
  const m = ROW_DATE.exec(String(text || '').replace(/<[^>]+>/g, ' '));
  if (!m) return null;
  const [y, mo, d] = m[1] ? [m[1], m[2], m[3]] : [`20${m[4]}`, m[6], m[7]];
  const mm = Number(mo); const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
/* 주소의 꼴 — 숫자는 #, 물음표 뒤는 열쇠 이름만. 같은 게시판의 글은 같은 꼴이다(/kor/notice/view.do?seq=# · /bbs/hufs/#/#/artclView.do). */
export function urlShape(url) {
  try {
    const u = new URL(url);
    const keys = [...u.searchParams.keys()].sort().join(',');
    return u.hostname + u.pathname.replace(/\d+/g, '#') + (keys ? '?' + keys : '');
  } catch { return ''; }
}
/* 글 줄: 게시판은 글마다 「제목 링크 … 날짜」가 차례로 놓인다(표든 목록이든 div 든). 그래서 블록 꼬리표(<tr>·<li>)에 기대지 않고
   **날짜 토큰과 그 앞 토막**을 한 줄로 본다 — 4차 실행 실측: 광운(날짜 121개·<tr><li> 블록엔 4개)·한양(41개·0개)·성균관(<dt> 제목 + <dd> 날짜)·
   고려·외대처럼 div 로 그린 목록은 블록 규칙으로 0행이었다. 한 토막 = 앞 날짜 끝부터 이 날짜까지(최대 SEG_MAX 자 · 첫 토막이 메뉴를 통째로 삼키지 않게).
   그 토막의 글 링크(파일·짧은 제목 제외) 가운데 **여러 토막에서 되풀이되는 주소 꼴**(MIN_SHAPE 이상)만 글이다 — 날짜가 든 메뉴 덩어리는
   꼴이 한 번씩이라 떨어지고, 첨부가 여럿 달린 글 줄도 제목 링크의 꼴은 하나라 산다. 토막 하나에 같은 꼴이 둘이면 제목이 긴 쪽 하나. */
const MIN_SHAPE = 3;
const SEG_MAX = 3000;
const DATE_G = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?!\d)|(?<![\d-])(\d{2})([.\-])(\d{2})\5(\d{2})(?![\d-])/g;
const inScript = (seg) => /<script\b(?:(?!<\/script>)[\s\S])*$/i.test(seg) || /<style\b(?:(?!<\/style>)[\s\S])*$/i.test(seg);
/* 줄의 게시일 (2026-10-02 · 리뷰) — **제목 링크 밖의 날짜**가 게시일이다. 예전엔 줄의 첫 날짜를 썼더니 「2025.12.1 공고 정정 안내」·
   「2026.11.20 축제 개최」처럼 제목 안 날짜가 게시일이 되어 60일 상한에 최근 글이 빠지고 앞날이 '게시'로 보였다.
   링크가 줄 전체를 감싸 밖에 날짜가 없으면(동국 WISE) 줄의 **마지막** 날짜가 게시일이다(제목 → 날짜 → 작성자 순).
   오늘보다 뒤인 날짜는 게시일이 아니다(지어내지 않는다 — 비운다). */
const stripAnchors = (html) => String(html || '').replace(/<a\b[\s\S]*?<\/a>/gi, ' ');
function lastRowDate(text) {
  const re = new RegExp(DATE_G.source, 'g'); const src = String(text || '').replace(/<[^>]+>/g, ' ');
  let m; let last = null;
  while ((m = re.exec(src)) !== null) last = m[0];
  return last ? rowDate(last) : null;
}
const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export function rowPostedAt(rowHtml) {
  const d = rowDate(stripAnchors(rowHtml)) || lastRowDate(rowHtml);
  return d && d <= todayKst() ? d : null;
}
/* 클릭형 <a> 가 줄 전체(제목·게시일·작성자·조회수)를 감쌀 때만(동국 WISE 7차 실측 「… 안내 2026.09.17. 임준택」) 제목 뒤 꼬리를 뗀다.
   🔴 자르는 자리는 **그 줄의 게시일과 같은 날짜**의 마지막 자리이고, 그 뒤에는 작성자 한 낱말·조회수만 와야 한다 — 그 밖엔 손대지 않는다.
   (리뷰 2026-10-02: 날짜 뒤 낱말 목록으로 가르면 「셔틀 운행 2026.10.5 중단」처럼 목록에 없는 낱말이 올 때 제목이 잘렸다.) */
export function cutRowTail(title, postedAt) {
  const t = String(title || '').trim();
  if (!postedAt) return t;
  const re = new RegExp(DATE_G.source, 'g');
  let m; let last = null;
  while ((m = re.exec(t)) !== null) if (rowDate(m[0]) === postedAt) last = m;
  if (!last || last.index < 6) return t;
  const after = t.slice(last.index + last[0].length).replace(/^\./, '').trim();
  /* 날짜 뒤에 남는 것이 작성자 한 낱말·조회수일 때만 꼬리다. 기간·안내 낱말(「까지」·「휴무」)은 이름이 아니다 — 제목의 일부로 둔다 */
  if (after && (!/^(?:[가-힣A-Za-z]{2,10})?\s*(?:조회(?:수)?\s*[\d,]+)?$/.test(after) || /^(?:까지|부터|마감|이후|이전|예정|안내|휴무|중단|시행|개최|접수|신청|모집|변경|연기|취소)/.test(after))) return t;
  return t.slice(0, last.index).trim();
}
/* 앞머리 분류 꼬리표(경희 「공통 [추천채용] …」)는 **떼지 않는다** (2026-10-02 · 리뷰) — 9차에 뗐더니 ① 같은 글이 새 제목으로 다시 실렸고
   ② 「국제」(이원화 학교의 캠퍼스 표시)까지 지워졌다. 사이트가 적은 그대로 두고, 같은 글인지는 글 번호(postId)로 가린다. */
/* 클릭형 게시판(news-board-rules.mjs) — <a onclick=…>·<a data-id=…> 는 href 가 없어 extractLinks 가 못 본다.
   resolve(속성 글자, 제목) 가 상세 주소(문자열) 또는 { url, id } 를 돌려주면 그 링크도 글 줄의 링크로 센다.
   id 는 **게시판이 붙인 글 번호**다 — 제목을 다듬는 규칙이 바뀌어도 같은 글로 알아보는 열쇠(postId · 리뷰 2026-10-02: 경희 6건이 두 번씩 실렸다). */
function resolvedLinks(seg, resolve, row = {}) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(seg)) !== null) {
    let title = cleanTitle(m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (row.wraps) title = cutRowTail(title, row.postedAt);
    if (title.length < 6 || title.length > 140) continue;
    const r = resolve(m[1], title);
    const url = typeof r === 'string' ? r : (r && r.url);
    if (!url) continue;
    out.push(r && r.id != null ? { title, url, postId: String(r.id) } : { title, url });
  }
  return out;
}
const rowLinks = (seg, base, postedAt, resolve) => {
  const wraps = !rowDate(stripAnchors(seg));   // 날짜가 링크 안에만 있다 = 링크가 줄 전체를 감쌌다
  return extractLinks(seg, base).concat(resolve ? resolvedLinks(seg, resolve, { wraps, postedAt }) : []).filter((l) => l.title.length >= 4 && !isAttachmentEntry(l)).map((l) => ({ ...l, postedAt, shape: urlShape(l.url) })).filter((l) => l.shape);
};
/* 두 눈을 합친다 (5차 실행 실측 · 2026-10-01): ① 블록 눈(<tr>·<li>·<dl>·<dd>·<article> 안에 날짜) — 표 게시판에 강하다(서울대·연세·국민·인하·방송대…)
   ② 토막 눈(날짜 토큰 앞 SEG_MAX 자) — div·dt/dd 로 그린 목록에 강하다(성균관·광운·한양·명지). 한쪽만 쓰면 다른 쪽 학교가 0행이 된다.
   후보 묶음마다 주소 꼴을 세고, 되풀이되는 꼴(MIN_SHAPE 이상)만 글 — 메뉴 덩어리는 꼴이 한 번씩이라 떨어진다. */
export function extractDatedRows(html, base, opts = {}) {
  const src = String(html || '');
  const resolve = typeof opts.resolve === 'function' ? opts.resolve : null;   // 클릭형 게시판의 링크 눈 (news-board-rules.mjs)
  const groups = [];
  const blockRe = /<(tr|li|dl|dd|article)\b[^>]*>((?:(?!<\1\b)[\s\S])*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    if (!rowDate(m[2])) continue;                 // 날짜가 붙은 줄만 글 줄이다
    const postedAt = rowPostedAt(m[2]);           // 게시일은 제목 밖 날짜 (없거나 앞날이면 비운다)
    const links = rowLinks(m[2], base, postedAt, resolve);
    if (links.length) groups.push({ links, pick: 'longest' });
  }
  let prev = 0;
  DATE_G.lastIndex = 0;
  while ((m = DATE_G.exec(src)) !== null) {
    const tokenDate = rowDate(m[0]);
    const seg = src.slice(Math.max(prev, m.index - SEG_MAX), m.index);
    prev = DATE_G.lastIndex;
    if (!tokenDate || inScript(seg)) continue;
    const postedAt = tokenDate <= todayKst() ? tokenDate : null;   // 토막 눈의 날짜는 링크 뒤(밖)의 날짜다 — 앞날만 비운다
    const links = rowLinks(seg, base, postedAt, resolve);
    if (links.length) groups.push({ links, pick: 'last' });   // 토막에선 날짜에 가장 가까운 링크가 제 줄의 제목
  }
  const count = new Map();
  for (const g of groups) for (const sh of new Set(g.links.map((l) => l.shape))) count.set(sh, (count.get(sh) || 0) + 1);
  const top = [...count.entries()].filter(([, n]) => n >= MIN_SHAPE).sort((a, c) => c[1] - a[1])[0];
  if (!top) return [];
  const out = new Map();
  for (const g of groups) {
    const same = g.links.filter((l) => l.shape === top[0]);
    if (!same.length) continue;
    const anchor = g.pick === 'last' ? same[same.length - 1] : same.slice().sort((a, c) => c.title.length - a.title.length)[0];
    const best = same.filter((l) => l.url === anchor.url).sort((a, c) => c.title.length - a.title.length)[0];
    if (!out.has(best.url)) out.set(best.url, { title: best.title, url: best.url, postedAt: best.postedAt || undefined, ...(best.postId ? { postId: best.postId } : {}) });
  }
  return [...out.values()];
}
