/* ============================================================
   교내 소식 요약 한 토막 — 순수 모듈 (2026-10-10 팀 업무 분장 프론트 8번 · 유은서)
   지시: "앱 내 교내 뉴스 게시글을 오늘 날짜 기준으로 몇 줄 요약한 디스크립션 제공"

   🔴 **지어내지 않는다 — 원문 문장을 앞에서부터 잘라 온다(발췌 요약).** AI 를 쓰지 않는다.
      글의 화면에서 제목 다음에 오는 본문 문장을 두세 줄(최대 DESC_MAX 자)만 떠 온다.
      그래서 틀릴 수 있는 것은 "어디까지 본문인가" 하나뿐이고, 확신이 없으면 빈 값('')을 돌려준다 —
      빈 값이면 앱은 요약 줄을 안 그린다(없는 것을 있는 척하지 않는다 · 운영 원칙 8-1).
   쓰는 곳: collector/collect-news-thumbs.mjs(글 화면을 이미 여는 썸네일 로봇이 같은 화면에서 함께 뜬다).
   검사: verify/test-collector.mjs 「교내 소식 요약」 절이 이 파일을 그대로 부른다.
   ============================================================ */

export const DESC_MAX = 120;      // 카드 두 줄 남짓
const DESC_MIN = 24;              // 이보다 짧으면 본문이라 믿기 어렵다

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, k) => (k.toLowerCase() in ENT ? ENT[k.toLowerCase()] : m));
}

/* 게시판 화면의 껍데기 줄 — 본문이 아니다 */
const META_LINE = /^(작성자|글쓴이|등록일|작성일|게시일|수정일|조회|조회수|첨부|첨부파일|파일|다운로드|목록|이전글|다음글|이전|다음|공유|인쇄|프린트|스크랩|담당부서|담당자|연락처|전화|부서|분류|카테고리|번호|제목|URL|top|TOP|맨 ?위로)\b|^(\d{2,4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\.?\s*(\d{1,2}:\d{2}(:\d{2})?)?)$|\.(hwp|hwpx|pdf|docx?|xlsx?|zip|jpg|png)\b/i;
const MENU_HINT = /로그인|회원가입|사이트맵|바로가기|본문 바로가기|주메뉴|전체메뉴|copyright|개인정보처리방침|Family Site|패밀리사이트/i;

/* 두 글자씩 겹치는 비율(다이스 계수) — 목록 제목과 글 화면 제목이 조금 다를 때(앞 번호 「9 」·괄호 꼬리) 같은 제목으로 본다 */
function bigrams(s) { const a = []; for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2)); return a; }
export function titleLike(line, title) {
  const a = norm(line); const b = norm(title);
  if (a.length < 6 || !b) return false;
  if (a === b || b.includes(a) && a.length >= b.length * 0.7 || a.includes(b) && a.length <= b.length + 30) return true;
  if (a.length > b.length * 1.6) return false;
  const x = bigrams(a); const y = bigrams(b); const pool = new Map();
  for (const g of y) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0; for (const g of x) { const c = pool.get(g); if (c) { hit += 1; pool.set(g, c - 1); } }
  return (2 * hit) / (x.length + y.length) >= 0.6;
}
const LIST_START = /^(\d{1,2}\s*[.)]|[가-하]\s*[.)]|[○●■□▶▷◆◇※\-•ㅇ]\s)/;

const norm = (s) => String(s || '').replace(/\[[^\]]{0,20}\]/g, '').replace(/[^0-9a-z가-힣]/gi, '').toLowerCase();
const hangul = (s) => (String(s).match(/[가-힣]/g) || []).length;

/** HTML(또는 본문 API 의 JSON 을 문자열로 편 것) → 줄 목록 */
export function pageLines(html) {
  return decode(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|select|button)\b[\s\S]*?<\/\1>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|dd|dt)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\n|\\r/g, '\n'))
    .split(/\n+/)
    .map((l) => l.replace(/[ \t ​]+/g, ' ').trim())
    .filter(Boolean);
}

/** 문장 끝에서 자른다 — DESC_MAX 를 넘으면 마지막 문장 끝(없으면 마지막 띄어쓰기)에서 끊고 … */
export function clip(text, max = DESC_MAX) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  /* 문장 끝(「…다.」「…요.」)에서 자를 수 있으면 거기서 — 날짜 「10. 13.」 의 점은 문장 끝이 아니다 */
  const ends = [...cut.matchAll(/[다요죠][.!?](?=\s|$)/g)].map((m) => m.index + 2);
  const end = ends.length ? ends[ends.length - 1] : -1;
  if (end >= max * 0.4) return cut.slice(0, end).trim();
  const sp = cut.lastIndexOf(' ');
  return `${cut.slice(0, sp > max * 0.6 ? sp : max).trim()}…`;
}

/**
 * 글 화면에서 요약 한 토막을 뜬다.
 * @param {string} html 글 화면(또는 본문 API) 글자
 * @param {string} title 그 글의 제목(게시판 목록에서 주운 것)
 * @returns {string} 요약(원문 그대로 · 잘림) — 확신이 없으면 ''
 */
export function newsDesc(html, title) {
  const lines = pageLines(html);
  const nt = norm(title);
  if (!nt) return '';
  /* 제목이 나오는 **마지막** 줄 다음부터가 본문이다 — 화면 맨 위 <title>·이동 경로에도 제목이 나오므로 마지막을 쓴다 */
  let at = -1;
  lines.forEach((l, i) => { if (titleLike(l, title)) at = i; });
  if (at < 0) return '';
  const body = [];
  for (const l of lines.slice(at + 1)) {
    if (MENU_HINT.test(l)) { if (body.length) break; continue; }      // 본문 뒤 꼬리(이전글·저작권)에 닿으면 멈춘다
    if (META_LINE.test(l) || hangul(l) < 4) continue;                  // 작성자·날짜·조회수·파일 이름
    if (titleLike(l, title)) continue;                                  // 제목이 한 번 더
    if (body.length && LIST_START.test(l) && body.join(' ').length >= 40) break;   // 첫 문단 뒤 「1. 납부기간 …」 목록은 요약에 넣지 않는다
    body.push(l);
    if (body.join(' ').length >= DESC_MAX) break;
  }
  const out = clip(body.join(' '));
  return hangul(out) >= DESC_MIN * 0.6 && out.length >= DESC_MIN ? out : '';
}
