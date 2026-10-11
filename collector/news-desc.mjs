/* ============================================================
   교내 소식 요약 한 토막 — 순수 모듈 (2026-10-10 팀 업무 분장 프론트 8번 · 유은서)
   지시: "앱 내 교내 뉴스 게시글을 오늘 날짜 기준으로 몇 줄 요약한 디스크립션 제공"

   🔴 **지어내지 않는다 — 원문 문장을 앞에서부터 잘라 온다(발췌 요약).** AI 를 쓰지 않는다.
      글의 화면에서 제목 다음에 오는 본문 문장을 두세 줄(최대 DESC_MAX 자)만 떠 온다.
      그래서 틀릴 수 있는 것은 "어디까지 본문인가" 하나뿐이고, 확신이 없으면 빈 값('')을 돌려준다 —
      빈 값이면 앱은 요약 줄을 안 그린다(없는 것을 있는 척하지 않는다 · 운영 원칙 8-1).
   쓰는 곳: collector/collect-news-desc.mjs(교내 소식 요약 로봇 — collect-news.yml 의 보강 단계 · 글 화면을 제 장부로 따로 연다).
   검사: verify/test-collector.mjs 「교내 소식 요약」 절이 이 파일을 그대로 부른다.

   🔴 남의 글을 그 글의 요약으로 싣지 않는다 (2026-10-11 점검 gap-04 — 실린 요약 322건 중 25건에 같은 학교 다른 글 제목, 60여 건에 껍데기 낱말).
      ① 이름표 뒤는 `\b` 가 아니라 띄어쓰기·쌍점·괄호·줄 끝으로 본다 — JS 의 `\b` 는 영문·숫자 경계라 한글 이름표(작성자·첨부파일·조회수)에선 한 번도 안 걸렸다.
      ② 「이전글·다음글·목록」 줄, 그리고 같은 학교 다른 글의 제목 줄(셋째 인자 siblings)에 닿으면 멈춘다 — 거기부터는 남의 글 목록이다.
         제목 줄 판정은 도우미 검색 요약과 같은 함수(notice-source.mjs makeTitleLine)를 불러 쓴다 — 베끼지 말 것.
      규칙을 바꾸면 DESC_RULE 을 올린다 — 로봇이 옛 판으로 뜬 글(desc·none)을 한 번씩 다시 연다.
   ============================================================ */
import { makeTitleLine, normTitle } from './notice-source.mjs';

export const DESC_MAX = 120;      // 카드 두 줄 남짓
const DESC_MIN = 24;              // 이보다 짧으면 본문이라 믿기 어렵다
export const DESC_RULE = 2;       // 규칙 판 — 장부(collector/news-desc.json)의 v 와 다르면 그 글을 다시 연다

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, k) => (k.toLowerCase() in ENT ? ENT[k.toLowerCase()] : m));
}

/* 게시판 화면의 껍데기 줄 — 본문이 아니다.
   FIELD: 본문 문장을 시작하지 않는 이름표 — 뒤에 값이 같은 줄에 붙어도(「작성자 IC-PBL교수학습센터 …」) 줄째 뺀다.
   WEAK : 본문 문장도 시작할 수 있는 낱말(「첨부 서류를 …」 「전화 문의 …」) — 홀로 서거나 쌍점·숫자만 붙을 때만 뺀다.
   이름표 뒤 경계는 (?=\s|:|\(|$) — `\b` 는 한글 뒤에서 안 걸린다(위 머리말 ①). */
const FIELD = '작성자|글쓴이|작성처|등록일|작성일자?|게시일|게시종료일|수정일|최종\\s?수정일|조회수|첨부\\s?파일|다운로드|미리\\s?보기|바로\\s?보기|담당부서|담당자|연락처|공지분류|공지기간|행사기간|카테고리|게시글\\s?내용|내용\\s?보기|댓글\\s?달기|URL|top|맨\\s?위로';
const WEAK = '조회|첨부|파일|공유|인쇄|프린트|스크랩|전화|부서|분류|번호|제목';
const META_LINE = new RegExp(`^(${FIELD})(?=\\s|:|\\(|$)|^(${WEAK})\\s*(:|$)|^(${WEAK})\\s+[\\d\\s.,:;()\\-/]+$`
  + '|^(\\d{2,4}[.\\-/]\\s?\\d{1,2}[.\\-/]\\s?\\d{1,2}\\.?\\s*(\\d{1,2}:\\d{2}(:\\d{2})?)?)$|\\.(hwp|hwpx|pdf|docx?|xlsx?|zip|jpg|png)\\b'
  + '|^(첨부\\s?)?파일이\\s?\\(가\\)\\s?없습니다'                                              // 「첨부파일이(가) 없습니다.」
  + '|^((카카오(톡)?|페이스북|트위터|밴드|네이버|블로그|링크|URL)\\s?(공유하기|공유|복사)\\s*)+$'   // 공유 단추 줄
  + '|^\\[[^\\]]{1,30}\\]$', 'i');                                                               // 「[언어교육원 행정실]」 처럼 꼬리표만 있는 줄
/* 이름표만 홀로 선 줄 — 다음 줄이 그 값(<dt>작성자</dt><dd>학생지원팀</dd>)이라 함께 뺀다. 본문을 여는 이름표(게시글 내용·내용보기·첨부파일)는 넣지 않는다 */
const VALUE_LABEL = /^(작성자|글쓴이|작성처|등록일|작성일자?|게시일|게시종료일|수정일|최종\s?수정일|조회수?|담당부서|담당자|연락처|전화|부서|분류|공지분류|공지기간|행사기간|카테고리|번호)\s*:?$/;
/* 여기부터는 남의 글이다 — 「이전글·다음글」(「다음글이 없습니다」 포함)·「목록」 단추 줄(「목록보기 다음글이 없습니다.」처럼 단추가 한 줄에 붙어도) */
const STOP_LINE = /^[\s<>‹›«»◀▶◁▷▲▼△▽∧∨^|·\-]*((이전|다음|윗|아랫)\s?(글|게시물|게시글)|목록(\s?(보기|으로|가기))?(\s|$))/;
const MENU_HINT = /로그인|회원가입|사이트맵|바로가기|본문 바로가기|주메뉴|전체메뉴|copyright|개인정보처리방침|Family Site|패밀리사이트/i;

/**
 * 같은 학교 다른 글의 제목을 담은 줄인가 — 판정은 notice-source.mjs makeTitleLine 한 곳(도우미 검색 요약·본문 분량 재기와 같은 함수).
 * 제 제목과 같은 제목(정규화가 같은 것)은 남의 글이 아니라 뺀다.
 * @param {string[]} siblings 같은 학교 소식의 제목들(제 제목이 섞여 있어도 된다)
 * @param {string} title 그 글의 제목
 * @returns {(line: string) => boolean}
 */
export function otherTitleLine(siblings, title) {
  const own = normTitle(title);
  return makeTitleLine((siblings || []).filter((t) => t && normTitle(t) !== own).map((t) => ({ title: t })));
}

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
 * @param {string[]} [siblings] 같은 학교 소식의 다른 글 제목들 — 이 제목을 담은 줄에 닿으면 멈춘다(옆 목록·이전글·다음글)
 * @returns {string} 요약(원문 그대로 · 잘림) — 확신이 없으면 ''
 */
export function newsDesc(html, title, siblings = []) {
  const lines = pageLines(html);
  const nt = norm(title);
  if (!nt) return '';
  /* 제목이 나오는 **마지막** 줄 다음부터가 본문이다 — 화면 맨 위 <title>·이동 경로에도 제목이 나오므로 마지막을 쓴다 */
  let at = -1;
  lines.forEach((l, i) => { if (titleLike(l, title)) at = i; });
  if (at < 0) return '';
  const isOther = otherTitleLine(siblings, title);
  const body = [];
  let skipValue = false;
  for (const l of lines.slice(at + 1)) {
    if (skipValue) { skipValue = false; continue; }                   // 홀로 선 이름표의 값(작성자 → 학생지원팀)
    if (titleLike(l, title)) continue;                                  // 제목이 한 번 더
    /* 🔴 여기부터는 남의 글 — 본문 전이어도 멈춘다(본문이 그림뿐인 글은 빈 값이 맞다. 건너뛰고 읽으면 목록 뒤 주소·메뉴가 요약이 된다) */
    if (STOP_LINE.test(l) || isOther(l)) break;
    if (MENU_HINT.test(l)) { if (body.length) break; continue; }      // 본문 뒤 꼬리(저작권)에 닿으면 멈춘다
    if (VALUE_LABEL.test(l)) { skipValue = true; continue; }
    if (META_LINE.test(l) || hangul(l) < 4) continue;                  // 작성자·날짜·조회수·파일 이름
    if (body.length && LIST_START.test(l) && body.join(' ').length >= 40) break;   // 첫 문단 뒤 「1. 납부기간 …」 목록은 요약에 넣지 않는다
    body.push(l);
    if (body.join(' ').length >= DESC_MAX) break;
  }
  const out = clip(body.join(' '));
  return hangul(out) >= DESC_MIN * 0.6 && out.length >= DESC_MIN ? out : '';
}

/* ── 로봇(collect-news-desc.mjs)이 장부를 다룰 때 쓰는 두 규칙 — 순수 함수라 관문이 표본으로 잰다 ── */

/** 옛 판 규칙으로 뜬 장부 항목인가(desc·none) — 그렇다면 한 번 다시 연다. err 는 로봇의 재시도 규칙(하루·세 번)이 따로 본다. */
export const staleRule = (e) => !!(e && !e.err && e.v !== DESC_RULE);

/**
 * 실린 글에 입힐 요약 — 장부의 desc 가 같은 학교 다른 글 제목을 담았으면 입히지 않는다.
 * 옛 판으로 이미 실린 남의 제목 요약이 다음 실행에 **네트워크 없이** 바로 빠진다(다시 열어 새 판으로 뜨기 전까지).
 * @returns {string|undefined}
 */
export function descToShow(entry, title, siblings) {
  const d = entry && entry.desc;
  if (!d) return undefined;
  return otherTitleLine(siblings, title)(d) ? undefined : d;
}
