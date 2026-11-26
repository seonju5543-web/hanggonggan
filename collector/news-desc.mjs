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
      ③ 남의 제목으로 멈추는 것은 그 제목을 통째로(또는 6할 이상) 담은 줄뿐이다(otherTitleLevel) — 짧은 조각은 건너뛰기만.
         본문 자리(제목 줄)를 고를 때도 남의 제목을 통째로 담은 줄(비슷한 제목의 다른 글)은 고르지 않는다.
   🔴 2차 (2026-11-23 — 서울과기대 「도서관 첫 대출자」 요약이 다른 글 제목으로 이어진 것을 보고 요약이 보이는 821건의 글 화면을 다시 받아 전수:
      실린 요약 821건 중 본문 밖 글자가 든 것 50건 · 6개교). 이웃 글은 같은 학교 소식 파일에 **없는** 글이라 ② 의 형제 제목으로는 못 막았다.
      ④ 제목 자리를 바로 고른다 — 「이전글 …」·「… 다음글」 줄, 홀로 선 「이전글·다음글」 바로 아래 줄(비슷한 제목의 이웃 글 — 경기 「…졸업시험 재시험 안내」 ·
         영남 「[국민대학교] …학점교류 안내」), 제목과 닮은 첨부 파일 이름(충북 「…행정예고.hwp」)은 고르지 않는다. 고르면 본문을 건너뛰고 그 아래
         옆 칸(숭실 「HOT 공지사항」)·메뉴(경기 「맞춤설정」)·표 설명부터 읽었다. 글자가 거의 같은 줄(titleStrong)이 있으면 그중 마지막을 쓰고
         (두 글자씩 닮기만 한 맺음말 「충북대학교 AI부트캠프 사업단장」에 끌려가지 않게), 본문 쪽 제목 칸 뒤 본문을 지나 「목록·이전글·다음글」을 만나면
         잠근다(옆 칸 목록에 이 글 자신이 올라 있는 숭실).
      ⑤ 본문 밖 글자를 알아본다 — 그림 단추의 alt 뿐인 「이전·다음·목록」(서울과기대 th_prev.png alt="이전" · pageLines 가 그 이름표만 한 줄로 살린다),
         표 설명 <caption>(충북 「…상세보기 - 제목, 부서, 카테고리, 내용, 파일 정보 제공」 · 화면에 안 보이는 접근성 글자),
         「카카오톡으로 공유하기」·「URL복사하기」, 「(다운로드 : 4284)」, 「이미지 확대보기」, 이름표 없이 선 작성 부서 줄(홍익 「학사지원팀」 · ORG_ONLY).
         글 머리(<header>) 안의 그 글 제목 칸은 지우지 않는다(서울대 — 지우면 <title> 이 제목 자리가 된다).
      장부 규칙(nextEntry · applyDescs · staleRule · descToShow)도 이 파일의 순수 함수다 — 로봇은 부르기만 하고 관문이 표본으로 잰다.
   ============================================================ */
import { createRequire } from 'node:module';
import { makeTitleLine, normTitle } from './notice-source.mjs';

export const DESC_MAX = 120;      // 카드 두 줄 남짓
const DESC_MIN = 24;              // 이보다 짧으면 본문이라 믿기 어렵다
export const DESC_RULE = 3;       // 규칙 판 — 장부(collector/news-desc.json)의 v 와 다르면 그 글을 다시 연다 (3: 2026-11-23 이동 단추 둘레·본문 밖 글자 — 머리말 ④⑤)

/* HTML 기호 풀이는 엔진(match-engine decodeEntities) 한 곳을 불러 쓴다 — 여기 따로 두었던 표는 일곱째 사본이었고 범위 밖 숫자 기호(&#99999999;)에서 넘어졌다(2026-11-26 리뷰 7차) ·
   앱(app.js ENTITIES)이 아는 이름은 엔진도 다 안다(관문 「앱이 아는 이름 기호를 …도 다 푼다」) */
const { decodeEntities } = createRequire(import.meta.url)('../match-engine.js');
const decode = (s) => decodeEntities(String(s || ''));
export const decodeNewsEntities = decode;   // 관문이 앱 ENTITIES 와 대조한다

/* 게시판 화면의 껍데기 줄 — 본문이 아니다.
   FIELD: 본문 문장을 시작하지 않는 이름표 — 뒤에 값이 같은 줄에 붙어도(「작성자 IC-PBL교수학습센터 …」) 줄째 뺀다.
   WEAK : 본문 문장도 시작할 수 있는 낱말(「첨부 서류를 …」 「전화 문의 …」) — 홀로 서거나 쌍점·숫자만 붙을 때만 뺀다.
   이름표 뒤 경계는 (?=\s|:|\(|$) — `\b` 는 한글 뒤에서 안 걸린다(위 머리말 ①). */
const FIELD = '작성자|글쓴이|작성처|등록일|작성일자?|게시일|게시종료일|수정일|최종\\s?수정일|조회수|첨부\\s?파일|다운로드|미리\\s?보기|바로\\s?보기|담당부서|담당자|연락처|공지분류|공지기간|행사기간|카테고리|게시글\\s?내용|내용\\s?보기|댓글\\s?달기|URL|top|맨\\s?위로|이미지\\s?확대\\s?보기';
/* 이름표 없이 작성 부서 이름만 홀로 선 줄 — <span>학사지원팀</span><span>2026.11.18</span>(홍익) · 제목 칸 아래 「학생생활관」(부경) ·
   「국제처 국제협력과」(전북) · 「보건진료소」(조선) · 「세종캠퍼스」「앵커사업단(세종)」(홍익 분류·부서 칸) (2026-11-23).
   기관 꼬리로 끝나는 낱말 한두 개뿐인 줄만 — 본문 문장은 그런 낱말로만 이뤄지지 않는다(「선발결과」 같은 소제목 한 낱말은 빠져도 요약에 해가 없다) */
const ORG_WORD = '[가-힣]{2,14}(팀|과|처|실|센터|관|단|본부|위원회|사업단|연구소|연구원|교육원|대학원|대학|학과|학부|도서관|행정실|사무국|진료소|상담소|캠퍼스)(\\([^)]{1,10}\\))?';
const ORG_ONLY = `${ORG_WORD}(\\s${ORG_WORD})?`;
const WEAK = '조회|첨부|파일|공유|인쇄|프린트|스크랩|전화|부서|분류|번호|제목';
const FILE_EXT = 'hwp|hwpx|pdf|docx?|xlsx?|zip|jpg|png';   // 첨부 파일 이름 — 껍데기 줄(META_LINE)과 제목 자리 빼기(FILE_LINE)가 같은 목록을 쓴다
const FILE_LINE = new RegExp(`\\.(${FILE_EXT})\\b`, 'i');
const META_LINE = new RegExp(`^(${FIELD})(?=\\s|:|\\(|$)|^(${WEAK})\\s*(:|$)|^(${WEAK})\\s+[\\d\\s.,:;()\\-/]+$`
  + `|^(\\d{2,4}[.\\-/]\\s?\\d{1,2}[.\\-/]\\s?\\d{1,2}\\.?\\s*(\\d{1,2}:\\d{2}(:\\d{2})?)?)$|\\.(${FILE_EXT})\\b`
  + '|^(첨부\\s?)?파일이\\s?\\(가\\)\\s?없습니다'                                              // 「첨부파일이(가) 없습니다.」
  + '|^((카카오(톡)?|페이스북|트위터|밴드|네이버|블로그|링크|URL|주소)\\s?(으로|로)?\\s?(공유하기|공유|복사하기|복사)\\s*)+$'   // 공유 단추 줄 — 「카카오톡으로 공유하기」「URL복사하기」(서울대 2026-11-23)
  + '|^\\(\\s*(다운로드|다운|조회수?)\\s*:?\\s*[\\d,]+\\s*(회|건)?\\s*\\)$'                    // 첨부 옆 「(다운로드 : 4284)」(영남 2026-11-23)
  + `|^${ORG_ONLY}$`                                                                             // 작성 부서 이름만 홀로 선 줄(위 ORG_ONLY)
  + '|^\\[[^\\]]{1,30}\\]$', 'i');                                                               // 「[언어교육원 행정실]」 처럼 꼬리표만 있는 줄
/* 이름표만 홀로 선 줄 — 다음 줄이 그 값(<dt>작성자</dt><dd>학생지원팀</dd>)이라 함께 뺀다. 본문을 여는 이름표(게시글 내용·내용보기·첨부파일)는 넣지 않는다 */
const VALUE_LABEL = /^(작성자|글쓴이|작성처|등록일|작성일자?|게시일|게시종료일|수정일|최종\s?수정일|조회수?|담당부서|담당자|연락처|전화|부서|분류|공지분류|공지기간|행사기간|카테고리|번호)\s*:?$/;
/* 여기부터는 남의 글이다 — 「이전글·다음글」(「다음글이 없습니다」 포함)·「목록」 단추 줄(「목록보기 다음글이 없습니다.」처럼 단추가 한 줄에 붙어도) ·
   홀로 선 「이전」「다음」「prev」「next」「list」(그림 단추의 alt 로만 있던 이름표 — pageLines 가 살린다 · 서울과기대 2026-11-23).
   「다음」 하나만 선 줄은 본문 문장이 될 수 없다(「다음과 같이 …」「다음 주 …」는 줄째 「다음」이 아니다) */
const STOP_LINE = /^[\s<>‹›«»◀▶◁▷▲▼△▽∧∨^|·\-]*((이전|다음|윗|아랫)\s?(글|게시물|게시글)|목록(\s?(보기|으로|가기))?(\s|$)|(이전|다음|prev(ious)?|next|list)\s*$)/i;
/* 홀로 선 이전·다음 이름표 — **그 바로 아래 줄은 이웃 글 제목**이다(<em>다음글</em></div><div><a>…</a> · 경기·영남 2026-11-23). 제 제목 자리로 고르지 않는다.
   「목록」은 넣지 않는다 — 글 위쪽 단추 줄의 「목록」 바로 아래가 제 제목인 게시판이 있을 수 있다 */
const NEIGHBOR_LABEL = /^[\s<>‹›«»◀▶◁▷▲▼△▽∧∨^|·\-]*((이전|다음|윗|아랫)\s?(글|게시물|게시글)|이전|다음|prev(ious)?|next)\s*:?\s*$/i;
/* 이름표가 줄 끝에 붙은 이웃 글 — 「<제목> 다음글」(숭실 <a>제목 <small>다음글</small></a>) */
const NAV_TAIL = /(이전|다음|윗|아랫)\s?(글|게시물|게시글)\s*$/;
/* 그림 단추의 alt 가 이동 이름표인 것 — 그 이름표만 글자로 살린다. 다른 그림의 alt 는 여전히 버린다(포스터 alt 에 제목·본문이 통째로 든 글이 흔하다) */
const NAV_ALT = /^\s*((이전|다음|윗|아랫)\s?(글|게시물|게시글)?(\s?보기)?|목록(\s?(보기|으로|가기))?|prev(ious)?|next|list)\s*$/i;
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

/**
 * 줄이 같은 학교 다른 글의 제목과 얼마나 겹치나 — newsDesc 가 멈출지·건너뛸지·본문 자리로 고를지를 이 값으로 정한다.
 *   0 남의 제목 아님(제 제목에 들어 있는 줄 포함) · 1 남의 제목의 짧은 조각(6할 미만) · 2 긴 조각(6할 이상) · 3 남의 제목을 통째로 담은 줄
 * 짧은 조각(「2026.10.13.(화) 오전 11시」처럼 남의 제목 꼬리와 같은 날짜·시각 줄, 본문의 짧은 소제목)은 남의 목록이 시작됐다는
 * 증거가 못 된다(점검 리뷰 — 조각 하나에 요약 전체가 '' 가 됐다). 담았는가 판정은 makeTitleLine 을 제목 하나씩 불러 쓴다(베끼지 말 것) —
 * 여기서 더하는 것은 길이 비교 하나다.
 * @returns {(line: string) => 0|1|2|3}
 */
export function otherTitleLevel(siblings, title) {
  const own = normTitle(title);
  const each = (siblings || []).filter((t) => t && normTitle(t) !== own)
    .map((t) => ({ len: normTitle(t).length, hit: makeTitleLine([{ title: t }]) }));
  return (line) => {
    const n = normTitle(line);
    /* 제 제목에 들어 있는 줄은 제 것 — 남의 제목과 글자가 똑같아도. 「… 안내(기간연장)」 글의 본문 머리가 「… 안내」로
       되풀이되고, 같은 학교에 「… 안내」(첫 공고)가 따로 있는 일이 실제로 있다(인하대 저장 화면 — 남의 것으로 보면 본문 전에 멈춘다) */
    if (own.includes(n)) return 0;
    let lv = 0;
    for (const s of each) if (s.hit(line)) lv = Math.max(lv, n.length >= s.len ? 3 : n.length >= s.len * 0.6 ? 2 : 1);
    return lv;
  };
}

/* 두 글자씩 겹치는 비율(다이스 계수) — 목록 제목과 글 화면 제목이 조금 다를 때(앞 번호 「9 」·괄호 꼬리) 같은 제목으로 본다 */
function bigrams(s) { const a = []; for (let i = 0; i < s.length - 1; i++) a.push(s.slice(i, i + 2)); return a; }
/* 제목과 글자가 거의 같은 줄 — 같거나, 한쪽이 다른 쪽을 거의 통째로 담은 줄(<title> 의 「제목 | 학교」 · 목록 제목의 분류 낱말 「봉사 」). titleLike 의 앞 갈래 */
export function titleStrong(line, title) {
  const a = norm(line); const b = norm(title);
  if (a.length < 6 || !b) return false;
  return a === b || b.includes(a) && a.length >= b.length * 0.7 || a.includes(b) && a.length <= b.length + 30;
}
export function titleLike(line, title) {
  const a = norm(line); const b = norm(title);
  if (a.length < 6 || !b) return false;
  if (titleStrong(line, title)) return true;
  if (a.length > b.length * 1.6) return false;
  const x = bigrams(a); const y = bigrams(b); const pool = new Map();
  for (const g of y) pool.set(g, (pool.get(g) || 0) + 1);
  let hit = 0; for (const g of x) { const c = pool.get(g); if (c) { hit += 1; pool.set(g, c - 1); } }
  return (2 * hit) / (x.length + y.length) >= 0.6;
}
const LIST_START = /^(\d{1,2}\s*[.)]|[가-하]\s*[.)]|[○●■□▶▷◆◇※\-•ㅇ]\s)/;

const norm = (s) => String(s || '').replace(/\[[^\]]{0,20}\]/g, '').replace(/[^0-9a-z가-힣]/gi, '').toLowerCase();
const hangul = (s) => (String(s).match(/[가-힣]/g) || []).length;

/**
 * HTML(또는 본문 API 의 JSON 을 문자열로 편 것) → 줄 목록
 * @param {string} html
 * @param {string} [title] 그 글의 제목 — 주면 글 머리(<header>) 안의 그 제목 칸을 지우지 않는다
 */
export function pageLines(html, title = '') {
  let src = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  /* 🔴 글 머리(<header>)에 그 글 제목과 닮은 제목 칸이 있으면 그 칸만 남긴다 (2026-11-23 서울대 꼴) — 사이트 머리글을 지우려고 <header> 를 통째로
     지웠더니 <article><header><h3 class="title"> 처럼 글 머리를 같은 태그로 쓰는 게시판에서 제목까지 지워져, 맨 위 <title> 이 제목 자리가 되고
     그 아래 이동 경로·공유 단추가 요약이 됐다. 그 글 제목이 없는 머리글(사이트 머리글)은 그대로 지운다 */
  if (title) {
    src = src.replace(/<header\b[^>]*>([\s\S]*?)<\/header>/gi, (whole, inner) => {
      for (const h of inner.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) if (titleLike(decode(h[2].replace(/<[^>]+>/g, ' ')), title)) return `\n${h[0]}\n`;
      return whole;
    });
  }
  return decode(src
    /* <caption> 은 표 설명(「…상세보기 - 제목, 부서, 카테고리, 내용, 파일 정보 제공」 · 충북 2026-11-23) — 화면에 안 보이는 접근성 글자라 본문이 아니다 */
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|select|button|caption)\b[\s\S]*?<\/\1>/gi, '\n')
    /* 이동 단추 그림(alt="이전"·"다음"·"목록")은 그 이름표를 한 줄로 남긴다 — 이름표가 그림뿐인 게시판(서울과기대)에서도 남의 글이 시작되는 자리를 안다 */
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = decode((tag.match(/\balt\s*=\s*(["'])([^"']*)\1/i) || [])[2] || '');
      return alt && NAV_ALT.test(alt) ? `\n${alt.trim()}\n` : ' ';
    })
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
  const lines = pageLines(html, title);
  const nt = norm(title);
  if (!nt) return '';
  /* 같은 학교 다른 글의 제목과 겹치는 정도(0~3) — 제 제목을 담은 줄(목록에 제 제목이 다시 나온 것)은 0 */
  const sibLevel = otherTitleLevel(siblings, title);
  /* 제목이 나오는 **마지막** 줄 다음부터가 본문이다 — 화면 맨 위 <title>·이동 경로에도 제목이 나오므로 마지막을 쓴다.
     🔴 단 남의 제목을 통째로 담은 줄(비슷한 제목의 **다른 글** — 희망사다리Ⅰ↔Ⅱ · 헌혈 버스 회차)은 제 제목이 아니다 — 그 줄을
     본문 자리로 고르면 본문을 건너뛰고 목록 뒤(주소·메뉴)부터 읽는다(점검 리뷰). 조각(1·2)은 고를 수 있다 — 본문 머리의
     「2026 학년도 제1 학기」 같은 줄이 목록의 잘린 제목(「… 제1학기 형설장학금 ..」)에 들어 있을 뿐인 일이 있다(서울시립대 저장 화면). */
  let at = -1; let strongAt = -1; let bodySince = 0; let locked = false;
  lines.forEach((l, i) => {
    if (locked) return;
    /* 🔴 본문 쪽 제목 칸(맨 윗줄 <title> 말고) 다음에 본문 글이 나온 뒤 「목록·이전글·다음글」을 만나면 잠근다 — 그 아래는 남의 글 구역이다.
       숭실 옆 칸 「HOT 공지사항」에 **이 글 자신**이 올라 있으면 그 목록 속 제 제목 줄이 제목 자리가 되어 목록을 요약으로 읽었다(2026-11-23).
       본문 전 위쪽 단추 줄의 「목록」에서는 잠그지 않는다(본문 글이 아직 없다) */
    if (STOP_LINE.test(l)) { if (strongAt >= 1 && bodySince > 0) { locked = true; return; } }
    else if (strongAt >= 1 && !titleLike(l, title) && !META_LINE.test(l) && !VALUE_LABEL.test(l) && !MENU_HINT.test(l) && hangul(l) >= 4) bodySince += 1;
    if (!titleLike(l, title) || sibLevel(l) >= 3) return;
    /* 🔴 이동 단추 둘레·첨부 파일 이름은 제 제목 자리가 아니다 (2026-11-23 전수 — 머리말 ④) — 이웃 글이 소식 파일에 없으면 위 형제 제목으로는 못 거른다.
       「이전글 <다시 올린 같은 제목>」(숭실) · 「<제목> 다음글」 · 홀로 선 「다음글」 바로 아래 비슷한 제목(경기·영남) · 「…행정예고.hwp」(충북) */
    if (STOP_LINE.test(l) || NAV_TAIL.test(l) || FILE_LINE.test(l) || (i > 0 && NEIGHBOR_LABEL.test(lines[i - 1]))) return;
    at = i;
    if (titleStrong(l, title)) { strongAt = i; bodySince = 0; }
  });
  /* 제목과 글자가 거의 같은 줄이 있으면 그중 마지막을 쓴다 — 두 글자씩 닮기만 한 줄은 본문 **뒤**에도 온다(맺음말 「충북대학교 AI부트캠프 사업단장」 ·
     첨부 이름 · 이웃 글). 그 줄을 고르면 본문을 통째로 건너뛰었다(충북 2026-11-23). 닮기만 한 줄은 글자가 거의 같은 줄이 없을 때만 쓴다(목록 제목에 「9 」·꼬리가 붙은 글) */
  if (strongAt >= 0) at = strongAt;
  if (at < 0) return '';
  const body = [];
  let skipValue = false;
  for (const l of lines.slice(at + 1)) {
    /* 홀로 선 이름표의 값(작성자 → 학생지원팀) — 값처럼 보일 때만(짧고 문장으로 안 끝남) 건너뛴다.
       값이 빈 이름표(「담당부서」 바로 다음이 본문 첫 문장 — 연세 미래 꼴)에서 본문을 버리지 않게(점검 리뷰) */
    if (skipValue) { skipValue = false; if (l.length <= 30 && !/[다요]\.?$/.test(l)) continue; }
    /* 🔴 여기부터는 남의 글 — 본문 전이어도 멈춘다(본문이 그림뿐인 글은 빈 값이 맞다. 건너뛰고 읽으면 목록 뒤 주소·메뉴가 요약이 된다).
       남의 제목 판정은 「제목이 한 번 더」보다 먼저 — 비슷한 제목의 다른 글을 제 제목으로 보고 건너뛰면 그 뒤 주소가 요약이 된다 */
    if (STOP_LINE.test(l)) break;
    const lv = sibLevel(l);
    if (lv >= 2) break;                                                 // 남의 제목(통째 또는 6할 이상)
    if (lv === 1) continue;                                             // 남의 제목의 짧은 조각(날짜·소제목)은 건너뛰기만
    if (titleLike(l, title)) continue;                                  // 제목이 한 번 더
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

/**
 * 글 하나를 열어 본 결과로 장부 항목을 새로 쓴다.
 * 🔴 열기가 잠깐 실패하면(err) **전에 뜬 요약을 지우지 않는다** — 옛 판 요약을 새 판으로 다시 열다(staleRule) 학교 서버가
 * 잠깐 안 받으면 멀쩡한 요약이 사라지고, 재시도 세 번이 다 실패하면 영영 안 돌아왔다(점검 리뷰). 재시도 동안에도 옛 요약은
 * descToShow(남의 제목 거르기)를 거쳐 그대로 보인다. 다시 열어 새 판이 none 이라고 말하면 그때 빠진다.
 * @param {object|undefined} prev 지금 장부 항목
 * @param {{desc?: string, none?: string, err?: string}} out 이번에 열어 본 결과
 * @param {string} today 오늘(YYYY-MM-DD · 한국 시각)
 */
export function nextEntry(prev, out, today) {
  if (out && out.desc) return { at: today, v: DESC_RULE, desc: String(out.desc).slice(0, DESC_MAX + 1) };
  if (out && out.none) return { at: today, v: DESC_RULE, none: out.none };
  return {
    at: today, v: DESC_RULE, err: (out && out.err) || '알 수 없는 실패', tries: ((prev && prev.err && prev.tries) || 0) + 1,
    ...(prev && prev.desc ? { desc: prev.desc } : {}),
  };
}

/**
 * 한 학교 파일의 글들에 장부의 요약을 입힌다(소급) — 입힐 것이 없거나 남의 제목을 담은 요약이면 desc 를 뗀다.
 * 같은 학교 제목들은 이 글 목록에서 뽑는다(학교 파일 하나가 한 학교 · 숨긴 글도 그 학교 게시판에는 떠 있으니 넣는다).
 * @param {object[]} items 학교 파일의 글들(제자리에서 고친다)
 * @param {object} posts 장부의 posts
 * @param {(n: object) => string} keyOf 글 열쇠(news-thumb.mjs thumbKey — 썸네일 장부와 같은 열쇠)
 * @returns {number} 바뀐 글 수
 */
export function applyDescs(items, posts, keyOf) {
  const titles = (items || []).map((n) => n && n.title).filter(Boolean);
  let changed = 0;
  for (const n of items || []) {
    if (!n) continue;
    const w = descToShow((posts || {})[keyOf(n)], n.title, titles);
    if (n.desc === w) continue;
    if (w) n.desc = w; else delete n.desc;
    changed += 1;
  }
  return changed;
}
