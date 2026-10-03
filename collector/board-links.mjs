/* ============================================================
   게시판 HTML 에서 글 링크를 뽑는 규칙 — **한 곳** (2026-09-26 · 노션 F-13)
   collect.mjs 안에 있던 extractLinks·stripSessionId 를 떼어 왔다. 재단 게시판 찾기 로봇
   (find-boards.mjs)도 같은 눈으로 읽어야 '찾을 때는 글로 보였는데 수집할 때는 안 보이는'
   어긋남이 없다. ⚠️ collect.mjs 는 불러오는 순간 실행되는 파일이라 거기서 import 할 수 없다.
   ============================================================ */
import { createRequire } from 'node:module';
import { cleanTitle, decodeEntities } from './clean-title.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';   // 글 줄 뽑기(extractDatedRows)가 파일 링크를 뺀다 (2026-10-01)

/* 주소 속성(href) 글자 → 주소 (2026-10-03 · 원문 링크 정직성)
   🔴 HTML 은 속성 안의 `&` 를 `&amp;` 뿐 아니라 숫자로도 적는다 — 워드프레스·KBoard 는 `&#038;` 이다(서울대 학생처).
      예전엔 `&amp;` 만 풀어서 `?mod=document&#038;category1=…&#038;uid=392` 가 그대로 저장됐고, 브라우저는 `#038;…` 을
      **조각(fragment)** 으로 읽어 서버에 `?mod=document&` 만 보냈다 — 글 번호(uid)가 사라져 공고가 아니라 메뉴 화면이 열렸다.
   푸는 규칙은 새로 만들지 않고 둘을 잇는다: 제목에 쓰는 decodeEntities(clean-title.mjs — 숫자·이름 기호 전부) →
   앱과 같은 decodeUrlEntities(source-link.js — 두 겹 `&amp;#038;` 까지). 수집기의 첨부 주소도 이 함수를 쓴다(collect.mjs). */
const { decodeUrlEntities } = createRequire(import.meta.url)('../source-link.js');
export function hrefText(raw) {
  return decodeUrlEntities(decodeEntities(String(raw == null ? '' : raw)));
}

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
    try { url = new URL(hrefText(m[1]), base).href; } catch { continue; }   // `&#038;`·`&amp;` 를 **주소로 풀기 전에** 되돌린다
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
/* 기간(「신청기간 2026.07.01 ~ 2026.12.31」)의 날짜는 게시일이 아니다 (재검증 2026-10-02: 기간 시작일이 게시일이 되어 최근 글이 60일 상한에 빠졌다).
   기간인지는 날짜 **토막마다** 앞뒤를 본다 — 뒤에 (요일)·시각이 붙고 물결표·줄표가 오거나, 앞에 물결표·줄표가 있으면 기간의 한쪽이다.
   「2026.09.01.(월) ~ 2026.09.30.(화)」 · 「2026-09-01 09:00 ~ …」 · 「2026년 9월 1일 ~ 9월 30일」 · 「&nbsp;~&nbsp;」 · 「2026.09.01-2026.09.30」 (리뷰 12차: 한 덩어리 정규식은 이 꼴들을 놓쳤다).
   날짜 안의 줄표(2026-09-01)는 토막 안이라 해당하지 않는다. */
const plainText = (html) => String(html || '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ').replace(/&#126;|&#x7e;|&tilde;|&sim;|&#8764;|&#x223c;/gi, '~').replace(/&ndash;|&#8211;|&#x2013;/gi, '–');
const RANGE_AFTER = /^\.?\s*일?\.?\s*(?:\(\s*[월화수목금토일]\s*\)\.?)?\s*(?:\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?)?\s*(?:[~∼～〜]|[-–](?=\s*(?:20\d{2}|\d{1,2}\s*[./월])))/;
const RANGE_BEFORE = /(?:[~∼～〜]|(?:^|[\s\d.)일])[-–])\s*$/;
const isRangePart = (before, after) => RANGE_AFTER.test(after) || RANGE_BEFORE.test(before);
/* 글자에서 기간의 날짜 토막을 지운다 (나머지 날짜는 그대로) */
function dropRanges(html) {
  const t = plainText(html); const re = new RegExp(DATE_G.source, 'g');
  let out = ''; let at = 0; let m;
  while ((m = re.exec(t)) !== null) {
    const end = m.index + m[0].length;
    if (isRangePart(t.slice(Math.max(0, m.index - 40), m.index), t.slice(end, end + 40))) { out += t.slice(at, m.index) + ' '; at = end; }
  }
  return out + t.slice(at);
}
/* 줄 안의 <a> 가운데 **첨부 파일 링크가 아닌 것** (재검증 2026-10-02: 「붙임_2026.07.01_계획.hwp」 의 날짜가 게시일이 되었다) */
function nonFileAnchors(html) {
  const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const href = (m[1].match(/\bhref\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!isAttachmentEntry({ title, url: href })) out.push(m[2]);
  }
  return out;
}
function lastRowDate(text) {
  const re = new RegExp(DATE_G.source, 'g'); const src = dropRanges(text);
  let m; let last = null;
  while ((m = re.exec(src)) !== null) last = m[0];
  return last ? rowDate(last) : null;
}
const todayKst = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
export function rowPostedAt(rowHtml) {
  const outside = stripAnchors(rowHtml);
  /* 링크 밖에 날짜가 (기간이라도) 있으면 링크는 제목만 감쌌다 — 밖의 기간 아닌 날짜만 게시일이다. 밖에 기간뿐이면 **비운다**
     (리뷰 12차: 그때 링크 안 날짜로 물러나면 제목 안 행사 날짜 「수여식 2026.09.10」 이 게시일이 되고 제목이 잘렸다). */
  if (rowDate(plainText(outside))) { const d = rowDate(dropRanges(outside)); return d && d <= todayKst() ? d : null; }
  /* 밖에 날짜가 없으면 링크가 줄을 감쌌다 — 그 링크(첨부 링크 말고) 안의 마지막 날짜가 게시일이다. 옆 첨부 링크의 파일 이름 날짜는 보지 않는다. */
  const d = nonFileAnchors(rowHtml).map(lastRowDate).filter(Boolean).pop() || null;
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
  const wraps = !rowDate(plainText(stripAnchors(seg)));   // 날짜(기간 포함)가 링크 안에만 있다 = 링크가 줄 전체를 감쌌다
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
    /* 기간의 날짜는 게시일이 아니다 — 그래도 토막의 링크는 글 줄로 센다(게시일은 비움). 건너뛰면 [제목][기간][게시일]·[게시일][제목][기간] 줄이
       통째로 사라졌다(리뷰 12차: div 목록 게시판 0행). 같은 글을 다른 토막이 게시일과 함께 보면 그 날짜를 쓴다(아래 out). */
    const ranged = isRangePart(plainText(src.slice(Math.max(0, m.index - 200), m.index)), plainText(src.slice(DATE_G.lastIndex, DATE_G.lastIndex + 200)));
    const postedAt = !ranged && tokenDate <= todayKst() ? tokenDate : null;   // 토막 눈의 날짜는 링크 뒤(밖)의 날짜다 — 앞날·기간은 비운다
    const links = rowLinks(seg, base, postedAt, resolve);
    if (links.length) groups.push({ links, pick: 'last' });   // 토막에선 날짜에 가장 가까운 링크가 제 줄의 제목
  }
  const count = new Map();
  for (const g of groups) for (const sh of new Set(g.links.map((l) => l.shape))) count.set(sh, (count.get(sh) || 0) + 1);
  const top = [...count.entries()].filter(([, n]) => n >= MIN_SHAPE).sort((a, c) => c[1] - a[1])[0];
  if (!top) return [];
  /* 글 하나의 열쇠는 **글 번호가 있으면 글 번호**다 (재검증 2026-10-02) — 목록 표식(#n-제목) 주소는 제목에서 만들어서,
     같은 제목의 새 글(「휴강 안내」를 해마다 다시 올림)이 주소 열쇠로는 옛 글과 하나로 합쳐져 사라졌다. */
  const keyOf = (l) => (l.postId ? `p|${l.postId}` : `u|${l.url}`);
  /* 같은 링크를 두 눈이 다르게 볼 수 있다 — href 로 읽은 것(번호 없음)과 규칙으로 푼 것(번호 있음). 주소가 같고 그 주소의 번호가 하나뿐이면
     번호를 나눠 준다(리뷰 12차: 아니면 한 글이 'u|주소'·'p|번호' 두 열쇠로 두 번 나왔다). 번호가 둘인 주소(같은 제목의 목록 표식)는 건드리지 않는다. */
  const idsOfUrl = new Map();
  for (const g of groups) for (const l of g.links) if (l.postId) idsOfUrl.set(l.url, (idsOfUrl.get(l.url) || new Set()).add(l.postId));
  for (const g of groups) for (const l of g.links) if (!l.postId && idsOfUrl.has(l.url) && idsOfUrl.get(l.url).size === 1) l.postId = [...idsOfUrl.get(l.url)][0];
  const out = new Map();
  for (const g of groups) {
    const same = g.links.filter((l) => l.shape === top[0]);
    if (!same.length) continue;
    const anchor = g.pick === 'last' ? same[same.length - 1] : same.slice().sort((a, c) => c.title.length - a.title.length)[0];
    const best = same.filter((l) => keyOf(l) === keyOf(anchor)).sort((a, c) => c.title.length - a.title.length)[0];
    const had = out.get(keyOf(best));
    if (!had) out.set(keyOf(best), { title: best.title, url: best.url, postedAt: best.postedAt || undefined, ...(best.postId ? { postId: best.postId } : {}) });
    else if (!had.postedAt && best.postedAt) had.postedAt = best.postedAt;   // 기간 토막이 먼저 본 글에 게시일 토막의 날짜를 채운다
  }
  return [...out.values()];
}
