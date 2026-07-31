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
const ID_PARAMS = /^(ntt_?id|nttSn|bbs_?seq|seq|article_?no|articleNo|artcl_?seq|idx|no|num|board_?no|bidx|wr_id|DUID|list_id|b_idx|boardSeq|postId|id)$/i;

/* 목록 화면임을 드러내는 경로 조각 */
const LIST_PATH = /(^|\/)(list|artclList|notice|board|bbs|index)(\.do|\.jsp|\.php|\.asp[x]?)?\/?$/i;

/* 주소 하나가 '공고 원문(상세)'을 가리키는지 판정한다.
   listUrl을 주면 '목록과 같은 주소'인지도 함께 본다.

   판정 근거 (하나라도 만족하면 상세로 본다):
   ① 글 식별자 파라미터가 값과 함께 있다      (…/view.do?nttId=12345)
   ② 목록 경로보다 더 깊은 경로 조각이 있다   (…/JANGHAKNOTICE/detail/2666)
   ③ 경로 자체가 상세를 뜻한다(view/detail/read/artclView) + 어떤 식별자든 있다 */
export function isDetailUrl(raw, listUrl) {
  const s = String(raw || '');
  if (!s || !/^https?:/i.test(s)) return false;
  if (isMarkerUrl(s)) return false;
  let u;
  try { u = new URL(s); } catch { return false; }

  // 목록 주소와 사실상 같으면 상세가 아니다 (해시·빈 쿼리 차이는 무시)
  if (listUrl) {
    try {
      const l = new URL(listUrl);
      const norm = (x) => x.origin + x.pathname.replace(/\/+$/, '') + x.search;
      if (norm(u) === norm(l)) return false;
    } catch { /* listUrl이 이상하면 그냥 넘어간다 */ }
  }

  // ① 값이 있는 글 식별자 파라미터
  for (const [k, v] of u.searchParams) {
    if (ID_PARAMS.test(k) && String(v).trim() !== '') return true;
  }

  const segs = u.pathname.split('/').filter(Boolean);
  const last = segs[segs.length - 1] || '';
  const prev = segs[segs.length - 2] || '';

  // ③ 상세를 뜻하는 경로 + 식별자
  if (/^(view|detail|read|artclView|selectBoardArticle)(\.do|\.jsp|\.php|\.asp[x]?)?$/i.test(prev)
      && /^[A-Za-z0-9_-]{1,40}$/.test(last)) return true;
  if (/^(view|detail|read|artclView)/i.test(last) && u.search) return true;

  // ② 목록 경로 뒤에 식별자 조각이 더 붙은 경로형 상세 (동국대 …/detail/2666)
  if (/^\d{1,12}$/.test(last) && segs.length >= 2) return true;
  if (/^(detail|view|read)$/i.test(prev)) return true;

  // 목록으로 보이는 경로는 상세가 아니다
  if (LIST_PATH.test(u.pathname) && !u.search) return false;

  return false;
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

  // 3순위: 숨은 입력칸의 글 번호로 view 주소를 조립한다
  //   (경희 유형: list.do 옆에 view.do가 있고 nttId·menuNo·bbsId를 GET으로 받는다)
  const hid = dom.hiddenInputs || {};
  const idKey = Object.keys(hid).find((k) => ID_PARAMS.test(k) && String(hid[k]).trim() !== '');
  if (idKey && dom.listUrl) {
    try {
      const l = new URL(dom.listUrl);
      const base = l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?$/i, (m) => m.replace(/(list|artclList|index)/i, 'view'));
      const v = new URL(l.origin + base);
      // 목록 주소가 지니고 있던 메뉴·게시판 파라미터를 그대로 이어붙인다
      for (const [k, val] of l.searchParams) v.searchParams.set(k, val);
      v.searchParams.set(idKey, String(hid[idKey]));
      for (const extra of ['bbsId', 'bbs_id', 'menuNo', 'key', 'boardId']) {
        if (hid[extra] && !v.searchParams.get(extra)) v.searchParams.set(extra, String(hid[extra]));
      }
      push(v.href);
    } catch { /* 조립 실패는 그냥 건너뛴다 */ }
  }
  return out;
}

export default { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, titleFingerprint, sameTitle, detailCandidates };
