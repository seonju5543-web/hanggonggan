/* 공고 '원문 주소' 판정·복원 규칙 (2026-07-31 도입)

   문제: 클릭형 게시판(경희 news.khu.ac.kr, 동국 dongguk.edu 등)에서 수집한 공고의 주소가
   **게시판 목록 주소 + 제목 표식**(`…/list.do?menuNo=200318#n-제목`)으로 기록돼 있었다.
   그래서 앱에서 '원문 공고 ↗'를 누르면 그 장학금 공고가 아니라 **학교 장학 공지 목록 전체**가
   열렸다. 사용자는 목록에서 제목을 눈으로 다시 찾아야 했고, 목록이 넘어가면 아예 못 찾는다.

   원인은 두 가지였다:
   ① browser-collect.mjs가 '진짜 상세 주소인가'를 **물음표(?) 유무**로만 판정했다.
      동국대처럼 주소가 `/article/JANGHAKNOTICE/detail/2666`(경로형)인 게시판은 물음표가 없어
      멀쩡한 상세 주소가 통째로 버려지고 목록 주소로 대체됐다.
   ② 경희대처럼 클릭이 form POST 전송이라 주소창이 안 바뀌는 게시판은, 상세 화면 안에
      **GET으로도 열리는 주소**(canonical·og:url·숨은 입력칸의 글 번호)가 있는데 그걸 안 찾아봤다.

   그래서 '어떤 주소가 공고 원문인가'를 여기 한 곳에 모았다. 수집기(browser-collect)와
   복구 로봇(resolve-detail-urls), 등록 관문(verify/entry-rules)이 **같은 규칙**을 쓴다. */
import { createRequire } from 'node:module';

/* 주소에 박힌 HTML 기호(`&#038;`·`&amp;`)를 되돌리는 규칙은 앱과 같은 파일 하나다(source-link.js · 2026-10-03).
   안 되돌리면 `#038;…uid=392` 가 조각(fragment)이 되어 글 번호가 사라진다 — 서울대 학생처 3건 실측. */
const { decodeUrlEntities } = createRequire(import.meta.url)('../source-link.js');

/* 목록 주소 + 제목 표식(#n-…) — 이 형태는 '원문으로 못 간다'는 뜻이다 */
export function isMarkerUrl(raw) {
  return /#n-/.test(String(raw || ''));
}

/* 표식에서 제목 되찾기 (복구 로봇이 게시판에서 이 제목의 행을 찾는 데 쓴다) */
export function markerTitle(raw) {
  const s = String(raw || '');
  const i = s.indexOf('#n-');
  if (i < 0) return '';
  try { return decodeURIComponent(s.slice(i + 3)); } catch { return s.slice(i + 3); }
}

/* 표식을 뗀 게시판 목록 주소 */
export function listUrlOf(raw) {
  const s = String(raw || '');
  const i = s.indexOf('#n-');
  return i < 0 ? s : s.slice(0, i);
}

/* 글 하나를 가리키는 식별자로 쓰이는 파라미터 이름들 (학교 게시판 공통) */
const ID_PARAMS = /^(ntt_?id|nttSn|bbs_?seq|seq|article_?no|articleNo|artcl_?seq|idx|no|num|board_?no|board_?id|bidx|wr_id|DUID|list_id|b_idx|boardSeq|postId|id)$/i;
/* boardId는 2026-08-01에 추가했다 — 경희대가 쓰는 이름인데 목록에 없어서, 폼에서
   'boardId=' 빈 칸을 보고도 글 번호 자리로 알아보지 못하고 엉뚱한 이름(nttId)을 썼다. */

/* 식별자 '값'이 진짜 글 번호처럼 생겼는지 — 이름만 보고 믿으면 안 된다.
   실제로 동국대 상세 화면에는 name="no" value="dongguk.edu" 같은 칸이 있어서,
   그대로 조립하면 `…/detail/dongguk.edu` 라는 없는 주소가 만들어졌다 (2026-07-31 1차 실행에서 발견). */
function looksLikeId(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s.length > 24) return false;
  if (/[.@/\\:\s]/.test(s)) return false;          // 도메인·경로·메일 주소 모양은 글 번호가 아니다
  if (!/\d/.test(s)) return false;                 // 숫자가 하나도 없으면 글 번호로 보지 않는다
  return /^[A-Za-z0-9_-]+$/.test(s);
}

/* 목록 화면임을 드러내는 경로 조각 */
const LIST_PATH = /(^|\/)(list|artclList|notice|board|bbs|index)(\.do|\.jsp|\.php|\.asp[x]?)?\/?$/i;

/* ── 목록 파일 · 글 화면 꼴 (2026-10-03 · 원문 대신 목록이 열리던 사고) ─────────────────────
   🔴 **목록 파일에 글 번호를 덧붙인 주소는 원문이 아니다.** 서버가 번호를 무시하고 목록을 준다 —
      저장된 본문으로 확인(collector/extracted): 가천 `…/kor/7986/subview.do?nttId=…` 18건의 본문이 2가지뿐(15건이 글자 하나 안 다름) ·
      고려 `…/ko/568/subview.do?nttId=…` 9건이 전부 같은 글자 · 서울교대 `selectNttList.do?…&nttId=…` 14건 중 10건이 같은 글자.
      그런데 파라미터 이름이 nttId 라는 이유로 ① 이 '원문'이라 불렀고, 수집기 확인이 '목록에도 그 제목이 있다'는
      이유로 통과시켜 그 게시판 전체가 목록 주소로 저장됐다. 목록 파일은 '보기' 표시(mode=view 등)가 함께 있을 때만 글이다.
   🔴 반대로 **진짜 글 꼴을 버리고 있었다** — 물음표 없는 K2Web `/bbs/<사이트>/<게시판>/<글>/artclView.do`(외대·인하·연세·조선·건국·
      가천·명지·방송대 — 저장된 본문 104건이 104가지로 글마다 다르고 99건에 제목이 보인다), eGov `selectBbsNttView.do?…nttNo=`(충북·경기),
      계명 `page.jsp?…parm_bod_uid=`(본문 116건이 전부 다르고 전부 제목이 보인다), K2Web 프레임 `subview.do?enc=<글 주소를 감싼 base64>`(고려·질병청),
      경북 `sub.htm?mode=view&mv_data=<base64>`, 부산 `Board.do?mode=view&board_seq=`, 서울대 `?mod=document&…&uid=`.
      그래서 이 꼴들이 원문 후보에서 빠지고 표식(#n-)이 영영 남았다. */
const LIST_FILE = /^(?:[\w-]*list|subview)(?:\.(?:do|jsp|php|aspx?|action))?$/i;
const VIEW_FILE = /^(?:artclView|view|detailView|detail|read|boardView|articleView)\.(?:do|jsp|php|aspx?|action)$/i;
const VIEWISH_FILE = /(?:view|detail|read|info)[\w-]*\.(?:do|jsp|php|aspx?|action)$/i;
/* '지금 글 하나를 본다'는 표시 — 이름과 값을 **둘 다** 본다(값만 보면 type=show 같은 우연이 걸린다) */
const VIEW_MODE_KEY = /^(?:mode|md|bbsmode|boardmode|p_p_mode|action|act|amode|schm|viewmode|do|mod|type)$/i;
const VIEW_MODE_VAL = /^(?:v|view|read|detail|show|commonview|document)$/i;
/* 글 번호 이름 — ID_PARAMS(조립에도 쓰는 목록)와 따로 둔다: 여기 더한 이름으로 주소를 **만들지는** 않는다 */
const POST_ID = /^(?:nttNo|parm_bod_uid|document_srl|board_seq|bbsidx|pstSn|articleId|(?:[\w-]*_)?entryId)$/i;
const SESSION_IN_PATH = /;jsessionid=[^/?#]*/i;
/* 글 번호처럼 생긴 값 — 숫자 셋 이상(페이지 번호 1·2 와 가른다) */
const idValue = (v) => /^\d{3,20}$/.test(String(v || '').trim()) || (looksLikeId(v) && (String(v).match(/\d/g) || []).length >= 3);
/* base64 로 감싼 글 주소·글 번호 (K2Web enc · 경북 mv_data) — 풀어서 글 화면 경로나 글 번호가 있으면 글이다 */
export function encodedPost(v) {
  const s = String(v || '').trim();
  if (s.length < 12 || !/^[A-Za-z0-9+/=_-]+$/.test(s)) return false;
  let d = '';
  try { d = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch { return false; }
  try { d = decodeURIComponent(d); } catch { /* 반쯤 인코딩된 것은 그대로 본다 */ }
  return /(?:artclView|[Vv]iew)\.(?:do|jsp|php)/.test(d)
    || /(?:^|[?&|/])(?:idx|nttId|nttSn|nttNo|seq|articleNo|no|bbsidx|board_seq|wr_id)=\d{2,}/.test(d);
}

/* 주소 하나가 '공고 원문(상세)'을 가리키는지 판정한다.
   listUrl을 주면 '목록과 같은 주소'인지도 함께 본다.

   판정 근거 (하나라도 만족하면 상세로 본다):
   ① 글 식별자 파라미터가 값과 함께 있다      (…/view.do?nttId=12345)
   ② 목록 경로보다 더 깊은 경로 조각이 있다   (…/JANGHAKNOTICE/detail/2666)
   ③ 경로 자체가 상세를 뜻한다(view/detail/read/artclView) + 어떤 식별자든 있다
   ⓪ (2026-10-03) 목록 파일 + 덧붙인 번호는 아니다 · 실측으로 확인한 글 꼴은 맞다 — 위 LIST_FILE 주석 */
export function isDetailUrl(raw, listUrl) {
  const s = decodeUrlEntities(raw);
  if (!s || !/^https?:/i.test(s)) return false;
  if (isMarkerUrl(s)) return false;
  let u;
  try { u = new URL(s.replace(SESSION_IN_PATH, '')); } catch { return false; }

  // 목록 주소와 사실상 같으면 상세가 아니다 (해시·빈 쿼리 차이는 무시)
  if (listUrl) {
    try {
      const l = new URL(listUrl);
      const norm = (x) => x.origin + x.pathname.replace(/\/+$/, '') + x.search;
      if (norm(u) === norm(l)) return false;
    } catch { /* listUrl이 이상하면 그냥 넘어간다 */ }
  }

  const segs = u.pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] || '';
  const prev = segs[segs.length - 2] || '';
  const params = [...u.searchParams];
  const viewMode = params.some(([k, v]) => VIEW_MODE_KEY.test(k) && VIEW_MODE_VAL.test(String(v).trim()));

  // ⓪-1 K2Web 프레임(subview.do) — 글 주소를 감싼 enc 가 있을 때만 글이다. nttId 만 덧붙인 것은 목록(가천·고려 실측)
  if (/^subview\.do$/i.test(last)) return encodedPost(u.searchParams.get('enc'));
  // ⓪-2 목록 파일에 번호만 덧붙인 것 — 보기 표시가 없으면 목록이다(서울교대 selectNttList.do?…&nttId= 실측)
  if (LIST_FILE.test(last) && !viewMode) return false;
  // ⓪-3 실측으로 확인한 글 꼴
  if (VIEW_FILE.test(last) && /^\d{2,}$/.test(prev)) return true;   // /bbs/<사이트>/<게시판>/<글>/artclView.do · /Board/<글>/detailView.do
  for (const [k, v] of params) if (POST_ID.test(k) && idValue(v)) return true;   // nttNo · parm_bod_uid · board_seq · bbsidx …
  if (String(u.searchParams.get('slug') || '').length >= 6) return true;   // 숭실 scatch `?f&category=장학&slug=<글 이름>` (본문 17건이 글마다 다르고 제목이 보인다)
  if (viewMode && params.some(([k, v]) => !VIEW_MODE_KEY.test(k) && (idValue(v) || encodedPost(v)))) return true;   // mode=view&mv_data= · mod=document&uid=
  if (VIEWISH_FILE.test(last) && params.some(([k, v]) => idValue(v) && !/page|offset|limit|unit|size|cnt|count/i.test(k))) return true;   // selectBbsNttView.do?…

  // ① 값이 있는 글 식별자 파라미터
  for (const [k, v] of u.searchParams) {
    if (ID_PARAMS.test(k) && String(v).trim() !== '') return true;
  }

  // 목록으로 보이는 경로는 (식별자 파라미터가 없는 한) 상세가 아니다 — /page/533 같은 안내 페이지 포함
  if (/(^|\/)page\/\d+\/?$/i.test(u.pathname)) return false;

  // ③ 상세를 뜻하는 경로 + 식별자
  if (/^(view|detail|read|artclView|selectBoardArticle)(\.do|\.jsp|\.php|\.asp[x]?)?$/i.test(prev)
      && /^[A-Za-z0-9_-]{1,40}$/.test(last)) return true;
  if (/^(view|detail|read|artclView)/i.test(last) && u.search) return true;

  // ② 목록 경로 뒤에 식별자 조각이 더 붙은 경로형 상세 (동국대 …/detail/2666)
  if (/^\d{1,12}$/.test(last) && segs.length >= 2) return true;
  /* `…/detail/<조각>` 형태는 조각이 **글 번호처럼 생겼을 때만** 상세로 본다.
     동국 상세 화면의 name="no" value="dongguk.edu" 때문에 `…/detail/dongguk.edu` 라는
     없는 주소가 계속 후보로 새어 나왔다 — 이름 검사만으로는 못 막아 여기서도 막는다. */
  if (/^(detail|view|read)$/i.test(prev)) return looksLikeId(last);

  // 목록으로 보이는 경로는 상세가 아니다
  if (LIST_PATH.test(u.pathname) && !u.search) return false;

  return false;
}

/* 로그인 벽 판정 (2026-08-01 개발자 지적으로 도입)
   경희대 링크가 '로그인하세요'로 뜨는데도 확인을 통과했다. 확인 기준이
   '제목이 보이나 / 목록이 아닌가' 둘뿐이라 **로그인 벽은 아예 검사 항목에 없었기 때문**이다.
   학생은 로그인 없이 링크를 누른다 — 로그인을 요구하면 그 링크는 쓸모가 없다.
   그러니 '제목이 보여도' 로그인 화면이면 떨어뜨려야 한다.

   주의: 공고 본문에 '로그인'이라는 낱말이 지나가듯 나올 수 있으므로,
   **로그인을 요구하는 화면의 특징**(아이디/비밀번호 입력칸, 로그인 안내 문구가 화면 주인공)
   으로 판정한다. text는 화면 글자, hasPasswordField는 비밀번호 입력칸 유무. */
export function looksLikeLoginWall(text, hasPasswordField) {
  const t = String(text || '');
  if (hasPasswordField) return true;                       // 비밀번호 칸이 있으면 로그인 화면
  const short = t.slice(0, 1500);                          // 화면 앞부분 = 주인공 영역
  const signals = [
    /로그인\s*(이|을|후|하신|해\s*주|이\s*필요)/,
    /로그인\s*후\s*이용/, /권한이\s*없습니다/, /접근\s*권한/,
    /통합\s*로그인/, /portal\s*login/i, /sign\s*in/i,
    /아이디.{0,6}비밀번호/,
  ];
  const hits = signals.filter((re) => re.test(short)).length;
  // 글자가 거의 없는 화면(로그인 폼만 있는 페이지)에서 신호가 하나라도 있으면 로그인 벽
  if (short.replace(/\s/g, '').length < 400 && hits >= 1) return true;
  return hits >= 2;
}

/* 목록 행의 클릭 스크립트 인자에서 글 번호 후보 뽑기.
   경희 news.khu.ac.kr 유형: 행이 `fn_view('1078712')` 같은 스크립트를 부르고 form을 POST 전송해
   주소창이 안 바뀐다. 이때 인자에 든 글 번호가 원문 주소를 만드는 유일한 재료다. */
export function idsFromSource(src) {
  const out = [];
  for (const m of String(src || '').matchAll(/['"]?(\d{3,20})['"]?/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out.slice(0, 4);
}

/* 제목 비교용 정규화 — 게시판 목록 행에는 번호·분류·조회수가 섞여 들어오므로
   글자만 남겨 비교한다 (clean-title.mjs와 목적이 다르다: 저쪽은 '보여줄 제목' 다듬기,
   여기는 '같은 글인가' 판정용이라 더 과감하게 지운다). */
export function titleFingerprint(raw) {
  return String(raw || '')
    .replace(/^\s*\d{1,5}\s+/, '')                 // 앞머리 글 번호
    .replace(/^\s*(공통|서울|글로벌|국제|공지|일반|신규)\s+/, '') // 앞머리 분류 표식
    .replace(/\[[^\]]{0,20}\]/g, '')               // [공지] [홍보] 등
    .replace(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/g, '')
    .replace(/조회\s*\d+/g, '')
    .replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '')
    .toLowerCase();
}

/* 두 제목이 같은 글을 가리키는가 — 짧은 쪽이 긴 쪽에 들어 있으면 같은 글로 본다
   (목록 제목은 잘려 있고 상세 제목은 온전한 경우가 흔하다) */
export function sameTitle(a, b) {
  const x = titleFingerprint(a);
  const y = titleFingerprint(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [shortT, longT] = x.length <= y.length ? [x, y] : [y, x];
  if (shortT.length < 8) return false;             // 너무 짧으면 우연히 겹칠 수 있다
  return longT.includes(shortT);
}

/* ── 알맹이 낱말로 한 번 더 찾기 (2026-09-18) ──────────────────────────────
   🔴 왜 필요한가: 앱 이름은 사람이 다듬은 것이라 게시판 행과 글자가 달라
      `sameTitle` 이 애초에 안 맞는다. 실측 — 한국외대 6건이 이 이유로 4회 연속
      `목록에서 못 찾음` 이 되어 `likelyGone` 처리됐다:
        앱  `면학장학금 (한국외대 교내)`
        행  `[공통][교내] 2026학년도 2학기 면학장학금 신청 안내`
      서로를 품지 않아 지문 대조로는 영영 안 붙는다. 그런데 게시판에서 `면학` 으로
      검색하면 그 글이 **멀쩡히 있다**(/bbs/student/2431/259473/artclView.do).

   🔴 **느슨하게 풀면 안 된다.** 예전에 `복지장학금 (서울캠퍼스)` 가 `(다빈치캠퍼스)`
      공고에 붙은 적이 있다. 그래서 세 겹으로 좁힌다:
        ① 알맹이는 괄호·대괄호·학기·연도를 떼고 남은 **장학금 이름**이고 4글자 이상
        ② 그 알맹이를 품은 행이 **딱 하나**일 때만 (여럿이면 지어내지 않는다)
        ③ 앱 이름에 캠퍼스 말이 있으면 행에도 **같은 캠퍼스**여야 한다 */
const CAMPUS_WORDS = ['서울', '글로벌', '용인', 'erica', '다빈치', '안성', '천안', '제2'];

export function titleCore(raw) {
  const s = String(raw || '')
    .replace(/\([^)]*\)/g, ' ')                       // (한국외대 교내)
    .replace(/\[[^\]]*\]/g, ' ')                      // [공통][교내]
    .replace(/20\d{2}\s*(학년도|년도|년)?/g, ' ')
    .replace(/\d\s*학기/g, ' ')
    .replace(/(신청|모집|선발|지급)\s*(안내|공고)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  /* 장학금 이름은 대개 `…장학금`·`…장학생` 으로 끝난다 — 그 덩어리를 집는다 */
  const m = s.match(/([가-힣A-Za-z0-9]{2,20}(?:장학금|장학생|장학))/);
  return m ? m[1] : '';
}

function campusOf(raw) {
  const t = String(raw || '').toLowerCase();
  return CAMPUS_WORDS.filter((w) => t.includes(w));
}

/* 행 목록에서 알맹이로 딱 하나를 고른다. 못 고르면 null — 지어내지 않는다.
   rows: [{ t, ... }] (t = 행에 보이는 글자) */
/* 게시판 행이 그 공고의 행인가 (2026-10-03) — sameTitle 에 '행이 제목의 대부분을 담는다'를 더한다.
   🔴 sameTitle 은 '짧은 쪽이 긴 쪽에 들어 있으면 같다'라서, 사이트 메뉴 링크 `지역미래불자육성장학`(10자)이
      공고 제목 `(은평)삼천사 지역미래불자육성장학 장학생 선발 안내` 의 **행으로** 뽑혔다 — 원문 링크 복구 로봇이
      그 메뉴의 번호(/page/533)로 `…/detail/533` 을 만들어 실었다(같은 날 재검사가 '목록'으로 잡음 · 동국 진담거사 사고와 같은 길).
      행은 보통 제목 + 날짜·조회수라 제목을 **품거나**, 잘려도 제목의 60% 이상이다. 메뉴 조각은 둘 다 아니다. */
export function rowMatchesTitle(want, rowText) {
  if (!sameTitle(want, rowText)) return false;
  const x = titleFingerprint(want);
  const y = titleFingerprint(rowText);
  return y.includes(x) || y.length >= Math.ceil(x.length * 0.6);
}

export function rowByCore(want, rows) {
  const core = titleCore(want);
  if (core.length < 4) return null;                   // 짧으면 우연히 겹친다
  /* 🔴 알맹이 낱말 **그것뿐인** 행(사이트 메뉴 `지역미래불자육성장학`)은 행이 아니다 — 알맹이 말고 두 글자 이상('안내'·'신청' 등)이 더 있어야 한다 (2026-10-03) */
  const hit = (rows || []).filter((r) => String(r.t || '').includes(core) && titleFingerprint(r.t).length >= titleFingerprint(core).length + 2);
  if (hit.length !== 1) return null;                  // 여럿이면 판단하지 않는다
  const wantCampus = campusOf(want);
  if (wantCampus.length) {
    const rowCampus = campusOf(hit[0].t);
    /* 행이 캠퍼스를 말하는데 다른 캠퍼스면 버린다 (복지장학금 사고) */
    if (rowCampus.length && !wantCampus.some((w) => rowCampus.includes(w))) return null;
  }
  return hit[0];
}

/* 상세 화면 문서(HTML)에서 'GET으로도 열리는 원문 주소' 후보를 뽑는다.
   경희대처럼 클릭이 form POST라 주소창이 안 바뀌는 게시판 대응.
   dom: { url, html, canonical, ogUrl, hiddenInputs: {name: value}, listUrl } */
export function detailCandidates(dom) {
  const out = [];
  const push = (u) => {
    if (!u) return;
    try {
      const abs = new URL(u, dom.url || dom.listUrl).href;
      if (!out.includes(abs)) out.push(abs);
    } catch { /* 주소가 아니면 버린다 */ }
  };

  // 1순위: 클릭 후 실제로 이동한 주소
  if (isDetailUrl(dom.url, dom.listUrl)) push(dom.url);
  // 2순위: 문서가 스스로 밝힌 정본 주소
  push(dom.canonical);
  push(dom.ogUrl);

  // 3순위: 글 번호로 view 주소를 조립한다
  //   (경희 유형: 목록에서 클릭이 form POST라 주소창이 안 바뀐다. list.do 옆에 view.do가 있고
  //    nttId·menuNo·bbsId를 GET으로도 받으므로, 글 번호만 알아내면 원문 주소를 만들 수 있다.)
  //   글 번호의 출처는 두 곳: 상세 화면의 숨은 입력칸, 그리고 목록 행의 클릭 스크립트 인자.
  /* 상세 주소를 조립할 때 **어느 형태를 먼저 시도할지는 목록 주소의 생김새로 정한다.**
     학교마다 정답이 달랐고, 순서를 잘못 잡으면 통째로 실패한다 (둘 다 실제로 겪었다):
       · 동국대 목록 `…/JANGHAKNOTICE/list`      (물음표 없는 경로형)
         → 상세도 경로형 `…/JANGHAKNOTICE/detail/26765595`  ✅
           조립형을 먼저 놨더니 33건이 전부 404였다.
       · 경희대 목록 `…/BMSR00040/list.do?menuNo=200318`  (물음표 있는 쿼리형)
         → 상세도 쿼리형 `…/BMSR00040/view.do?menuNo=200318&boardId=322535`  ✅
           경로형을 먼저 놨더니 404, 폼에서 가져온 메뉴는 로그인 화면이었다.
     즉 **게시판이 쓰는 주소 생김새를 그대로 따라가면 된다.** 둘 다 후보로는 남기되
     순서만 이 규칙으로 정하고, 최종 판단은 언제나 '열어서 확인'이 한다. */
  if (dom.listUrl) {
    const mkPath = (idVal) => {
      try {
        const l = new URL(dom.listUrl);
        const base = l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?\/?$/i, '');
        return base && base !== l.pathname ? `${l.origin}${base}/detail/${idVal}` : null;
      } catch { return null; }
    };
    const mkQuery = (idVal) => {
      // 글 번호의 '이름'은 게시판 폼에서 빌려 온다 (경희=boardId, 다른 곳=nttId 등)
      const names = new Set();
      for (const f of dom.forms || []) {
        for (const kv of String(f.fields || '').split('&')) {
          const [k, v] = kv.split('=');
          if (k && v === '' && ID_PARAMS.test(k)) names.add(k);
        }
      }
      if (!names.size) names.add('nttId');
      const out2 = [];
      for (const nm of names) {
        try {
          const l = new URL(dom.listUrl);
          const v = new URL(l.origin + l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?$/i,
            (m) => m.replace(/(list|artclList|index)/i, 'view')));
          /* 🔴 목록 경로가 view 로 **안 바뀌었으면** 만들지 않는다 (2026-10-03) — `subview.do`·`selectNttList.do`·`scholnoti.php`
             처럼 고쳐 쓸 이름이 없는 목록에 번호만 붙이면 서버가 번호를 무시하고 **목록을 준다**(가천·고려·서울교대 실측:
             번호만 다른 주소들의 본문이 거의 전부 같은 목록 화면 — 위 LIST_FILE 주석). 짐작으로 만든 주소가 '원문'으로 저장되던 길이다. */
          if (v.pathname === l.pathname) continue;
          for (const [k, val] of l.searchParams) v.searchParams.set(k, val);   // menuNo 등 그대로 유지
          v.searchParams.set(nm, idVal);
          out2.push(v.href);
        } catch { /* 조립 실패는 건너뛴다 */ }
      }
      return out2;
    };
    let listHasQuery = false;
    try { listHasQuery = !!new URL(dom.listUrl).search; } catch { /* 무시 */ }
    for (const idVal of (dom.rowIds || []).filter(looksLikeId)) {
      const pathForm = mkPath(idVal);
      const queryForms = mkQuery(idVal);
      if (listHasQuery) { queryForms.forEach(push); push(pathForm); }
      else { push(pathForm); queryForms.forEach(push); }
    }
  }

  const hid = dom.hiddenInputs || {};
  const ids = [];
  for (const k of Object.keys(hid)) {
    if (ID_PARAMS.test(k) && looksLikeId(hid[k])) ids.push([k, String(hid[k]).trim()]);
  }
  // 목록 행의 onclick/href가 넘겨주는 인자 (예: fn_view('1078712') · goDetail(1078712,'BMSR00040'))
  for (const raw of dom.rowIds || []) {
    if (looksLikeId(raw)) ids.push([dom.idParam || 'nttId', String(raw).trim()]);
  }
  /* 가장 확실한 재료: **게시판이 스스로 쓰는 폼**.
     주소를 짐작하지 말고, 클릭이 실제로 보내는 폼의 action과 기본 필드를 그대로 쓰고
     빈 칸에만 글 번호를 넣는다.
     경희 news.khu.ac.kr에서 이게 왜 필요했나 (2026-07-31):
       행 = `javascript:view('322635','')`
       view = function(boardId, catId){ form.elements["boardId"].value = boardId; form.submit(); }
       폼   = action=/kor/user/contents/view.do · menuNo=200226&boardId=
     즉 원문 주소는 `/kor/user/contents/view.do?menuNo=200226&boardId=322635`다.
     목록 주소(`/kor/user/bbs/BMSR00040/list.do?menuNo=200318`)에서 이름을 유추하면
     경로도 파라미터 이름도 메뉴 번호도 전부 틀린다 — 실제로 세 번 틀렸다. */
  const DETAILISH_ACTION = /(view|detail|read|artclView)(\.do|\.jsp|\.php)?$/i;
  /* ⛔ 2026-08-01 경희대 사고에서 배운 것 — **겉모습으로는 못 가려낸다**
     경희 목록 화면에는 `action=/kor/user/contents/view.do · menuNo=200226` 폼이 있는데,
     이건 공고를 여는 폼이 아니라 **로그인 페이지 폼**이었다. 그런데 action에도 필드에도
     'login' 같은 글자가 하나도 없어서, 마크업만 봐서는 구분할 방법이 없다.
     → 그래서 '어느 폼이 로그인 폼인지 알아맞히려' 하지 않는다. 대신 두 가지로 푼다:
        ① 목록의 경로·메뉴를 유지한 형태를 **맨 먼저** 시도한다(위 블록) — 학생이 보고 있는
           그 메뉴 안에서 여는 것이라 엉뚱한 화면으로 갈 일이 적다.
        ② 만든 주소는 **열어 보고 로그인 벽이면 떨어뜨린다**(looksLikeLoginWall).
           결국 '열어서 확인한다'가 유일하게 믿을 수 있는 방법이다.
     비밀번호 칸이 명시된 폼만 명백하므로 그것만 여기서 뺀다. */
  const LOGIN_FORM = /(^|&)(passwd|password|pwd|userPw)=/i;
  for (const f of dom.forms || []) {
    if (!f || !DETAILISH_ACTION.test(String(f.action || '').split('?')[0])) continue;
    if (LOGIN_FORM.test(String(f.fields || ''))) continue;
    const pairs = String(f.fields || '').split('&').filter(Boolean)
      .map((kv) => { const i = kv.indexOf('='); return i < 0 ? [kv, ''] : [kv.slice(0, i), kv.slice(i + 1)]; });
    const blanks = pairs.filter(([, v]) => v === '').map(([k]) => k);
    for (const idVal of (dom.rowIds || []).filter(looksLikeId)) {
      for (const slot of blanks) {
        try {
          const v = new URL(f.action, dom.url || dom.listUrl);
          for (const [k, val] of pairs) if (val !== '') v.searchParams.set(k, val);
          v.searchParams.set(slot, idVal);
          push(v.href);
        } catch { /* 조립 실패는 건너뛴다 */ }
      }
    }
  }

  for (const [idKey, idVal] of ids) {
    if (!dom.listUrl) break;
    try {
      const l = new URL(dom.listUrl);
      const base = l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?$/i,
        (m) => m.replace(/(list|artclList|index)/i, 'view'));
      const v = new URL(l.origin + base);
      // 목록 주소가 지니고 있던 메뉴·게시판 파라미터를 그대로 이어붙인다
      for (const [k, val] of l.searchParams) v.searchParams.set(k, val);
      v.searchParams.set(idKey, idVal);
      for (const extra of ['bbsId', 'bbs_id', 'menuNo', 'key', 'boardId']) {
        if (looksLikeId(hid[extra]) && !v.searchParams.get(extra)) v.searchParams.set(extra, String(hid[extra]));
      }
      /* 순서가 중요하다 (2026-08-01에 값을 치르고 배운 것).
         경로형(…/detail/26765595)을 **조립형(view?nttId=…)보다 먼저** 놓는다.
         예전엔 조립형이 앞이라 동국대에서 그게 먼저 채택됐는데, 동국대에는 그런 주소가
         아예 없어서 **33건이 전부 404**였다(경로형 5건은 전부 통과). 조립형은 '이름을
         유추한' 주소라 틀릴 수 있고, 경로형은 게시판이 실제로 쓰는 모양이다.
         조립형은 마지막 수단으로만 남긴다. */
      const listPath = l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?\/?$/i, '');
      if (listPath && listPath !== l.pathname) push(`${l.origin}${listPath}/detail/${idVal}`);
      /* 목록 경로 그대로에 번호만 붙인 것은 만들지 않는다 — 위 mkQuery 와 같은 이유(2026-10-03) */
      if (v.pathname !== l.pathname) push(v.href);
    } catch { /* 조립 실패는 그냥 건너뛴다 */ }
  }
  return out;
}

/* 목록의 '한 행'에서 원문 주소 후보를 순서대로 만든다 — 두 로봇(링크 사냥꾼·복구 로봇)이
   **같은 규칙**을 쓰게 하려고 여기에 둔다.

   순서가 전부다: ① 눌러서 브라우저가 실제로 간 주소 ② **행에 원래 적혀 있던 주소**
   ③ 그래도 없으면 조립한 주소. 앞의 둘은 게시판이 스스로 알려 준 것이라 틀릴 수가 없고,
   조립은 우리가 짐작하는 것이라 틀릴 수 있다.

   왜 규칙을 한 곳으로 모았나 (2026-08-01): 링크 사냥꾼이 이 규칙을 따로 갖고 있다가
   ②를 통째로 빠뜨렸다. 행에 `…/article/JANGHAKNOTICE/detail/26765625`라고 **적혀 있는데도**
   그걸 안 쓰고 매번 주소를 조립했고, 그래서 동국대 12건이 전부 떨어졌다.
   복구 로봇에는 처음부터 있던 규칙이다 — 규칙이 두 벌이면 반드시 이렇게 갈라진다. */
export function rowDetailCandidates({ row, listUrl, forms, landed, dom }) {
  const out = [];
  const add = (u) => { if (u && isDetailUrl(u, listUrl) && !out.includes(u)) out.push(u); };
  add(landed);
  add(row && row.abs);
  for (const c of detailCandidates({
    ...(dom || {}),
    url: landed || listUrl,
    listUrl,
    forms,
    rowIds: idsFromSource((row && row.src) || ''),
  })) add(c);
  return out;
}

export default { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, titleFingerprint, sameTitle, rowMatchesTitle, detailCandidates, idsFromSource, looksLikeLoginWall, rowDetailCandidates };

/* ── 이 화면이 '목록'인가 '상세'인가 (2026-08-20 — 두 로봇에 있던 복사본을 여기로 합쳤다) ──
   제목이 화면에 보인다는 것만으로는 부족하다: **게시판 목록에도 그 제목이 있다.**
   그래서 다른 공고 제목이 여럿 보이면 목록으로 본다(동국 진담거사에 안내 페이지 번호가
   붙었던 사고를 막은 규칙).

   🔴 그런데 그 규칙만으로는 **한 장에 목록과 상세가 함께 들어 있는 게시판**을 통째로 버린다.
   중앙대가 그렇다 — 상세 화면에도 사이트 전체와 목록이 같이 그려져, 멀쩡한 상세 12건이
   전부 '목록 화면'으로 탈락하고 있었다(2026-08-20 실측: 같은 주소를 그냥 받으면
   한글 5,368자에 자격 절까지 멀쩡히 있다).

   가르는 신호는 **`이전글`·`다음글`**이다. 이건 '지금 글 하나를 보고 있다'는 뜻이라
   목록 화면에는 나올 이유가 없다. 세 학교로 확인했다:
     중앙대 상세 있음 / 중앙대 목록 없음 · 동국 상세 있음 / 동국 목록 없음 · 경희 목록 없음
   ⚠️ 이 표지를 무시하도록 되돌리면 중앙대가 다시 통째로 막히고, 반대로 표지를 안 보고
   통과시키면 동국 사고가 되살아난다. 둘 다 test-collector가 지킨다. */
const DETAIL_MARK = /이전\s?글|다음\s?글|이전글보기|다음글보기/;

export function looksLikeList(text, otherTitles) {
  const body = String(text || '');
  if (DETAIL_MARK.test(body)) return false;          // 글 하나를 보고 있는 화면이다
  const flat = titleFingerprint(body);
  let hits = 0;
  for (const t of otherTitles || []) {
    const k = titleFingerprint(t);
    if (k.length >= 10 && flat.includes(k)) hits += 1;
    if (hits >= 3) return true;
  }
  return false;
}

/* 같은 사이트의 **다른 공고 제목** — '이 화면이 목록인가'를 가리는 재료 (2026-10-03).
   🔴 빈 목록을 넘기면 목록 화면을 영영 못 알아본다(link-landing.mjs 원칙 ②) — 순찰이 `verify(url, title, [])` 로 불러
   목록 41건을 통과시켰다. 우리가 가진 같은 사이트 공고(실시간 공고·정식 등록)의 제목을 쓴다 — 목록 화면은 최근 글 여럿을 함께 그린다.
   items = [{ url|sourceUrl, boardTitle|title|name }] · clean = 제목 다듬기(로봇은 link-landing.mjs stripRowTail 을 넘긴다 —
   여기서 불러오면 link-landing ↔ detail-url 이 서로를 부르는 고리가 된다) */
export function otherTitlesOnSite(url, items, { exclude = [], clean = (s) => String(s || '').trim(), max = 60 } = {}) {
  let origin = '';
  try { origin = new URL(decodeUrlEntities(url)).origin; } catch { return []; }
  const out = [];
  for (const x of items || []) {
    const u = (x && (x.url || x.sourceUrl)) || '';
    if (!u.startsWith(origin)) continue;
    const t = clean(x.boardTitle || x.title || x.name || '');
    if (t.length < 8 || exclude.some((w) => w && sameTitle(w, t)) || out.some((o) => sameTitle(o, t))) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/* ── 열린 화면에서 판정 재료 걷기 (2026-10-03) ───────────────────────────────────────────
   판정은 collector/link-landing.mjs 의 judgeLanding **한 곳**이다 — 세 로봇(링크 사냥꾼·원문 링크 복구·브라우저 수집)이
   제각각 '제목이 보이면 통과'를 들고 있다가 목록 화면을 원문으로 통과시켰다(가천·고려·서울교대 · 순찰이 목록 41건 통과).
   여기는 그 판정에 넘길 **재료만** 걷는다(Playwright 화면 하나 → obs).
   🔴 제목 자리(headings)는 **그 꼬리표가 화면에 하나뿐일 때만** 센다 — 목록 화면은 행마다 h3·.subject 를 달아 두는 곳이 있어,
      그걸 제목 자리로 세면 목록이 '제목 자리에 그 공고 제목'(post)이 된다. */
const HEAD_SELECTORS = ['h1', 'h2', 'h3', '.view-title', '.view_title', '.viewTitle', '.bbs-title', '.board-view-title',
  '.artclViewTitle', '.tit_view', '.title_view', '.subject', '.board_view .title', '.bbs_view .title'];
/* 🔴 틀(iframe) 안도 본다 (2026-10-03 · 리뷰 LC-3) — 공고 본문을 틀에 담는 게시판이 있다. 원문 링크 확인 로봇이 따로
   읽던 사본(h1~h3 를 **전부** 제목 자리로 세어 행마다 h3 인 목록을 'post' 로 판정)을 걷고 이 한 벌을 같이 쓴다.
   틀마다 '하나뿐인 꼬리표'만 센다 · 글자는 바깥 화면 먼저 이어 붙인다(최대 maxText). */
export async function observeLanding(page, res, { maxText = 20000, maxFrames = 6 } = {}) {
  const status = res && typeof res.status === 'function' ? res.status() : 0;
  let finalUrl = '';
  try { finalUrl = page.url(); } catch { /* 닫힌 화면 */ }
  const docTitle = await page.title().catch(() => '');
  const read = (fr) => fr.evaluate(({ sels, max }) => {
    const one = (sel) => {
      const els = document.querySelectorAll(sel);
      return els.length === 1 ? (els[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    };
    const og = document.querySelector('meta[property="og:title"]');
    /* 🔴 이름이 정해진 꼬리표 밖의 제목 자리도 본다 (2026-10-03 · 원문 링크 복구 로봇 첫 실행에서 국민대·고려 상세 화면이 '목록'으로
       재검사됨 — 제목이 h4·.view_tit 같은 곳에 있으면 '본문 어딘가'(weak)로만 잡히고, 옆의 최근 글 목록 때문에 목록이 됐다).
       같은 (태그+class) 꼴이 **화면에 하나뿐인** 요소만 센다 — 목록 행은 같은 꼴이 줄마다 되풀이되므로 여기 안 들어온다. */
    const groups = new Map();
    for (const el of document.querySelectorAll('h4, h5, [class*="tit"], [class*="Tit"], [class*="subject"], [class*="Subject"], [id*="title"], [id*="subject"]')) {
      const k = `${el.tagName}.${el.className || ''}#${el.id ? 'id' : ''}`;
      groups.set(k, (groups.get(k) || []).concat(el));
    }
    const lone = [...groups.values()].filter((g) => g.length === 1)
      .map((g) => (g[0].textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 4 && t.length <= 200).slice(0, 24);
    const heads = [og ? (og.getAttribute('content') || '').trim() : '', ...sels.map(one), ...lone].filter(Boolean);
    return {
      headings: heads.slice(0, 40),
      text: ((document.body && document.body.innerText) || '').slice(0, max),
      hasPassword: !!document.querySelector('input[type=password]'),
    };
  }, { sels: HEAD_SELECTORS, max: maxText }).catch(() => null);
  let frames = [];
  try { frames = page.frames().slice(0, maxFrames); } catch { frames = []; }
  if (!frames.length) frames = [page];
  const got = { headings: [], text: '', hasPassword: false };
  for (const fr of frames) {
    const one = await read(fr);
    if (!one) continue;
    got.headings.push(...one.headings);
    if (got.text.length < maxText) got.text += (got.text ? '\n' : '') + one.text;
    got.hasPassword = got.hasPassword || one.hasPassword;
  }
  got.headings = got.headings.slice(0, 60);
  got.text = got.text.slice(0, maxText);
  return { status, finalUrl, docTitle, ...got };
}
