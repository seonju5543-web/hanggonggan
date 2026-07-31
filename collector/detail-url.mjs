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

  // 목록으로 보이는 경로는 (식별자 파라미터가 없는 한) 상세가 아니다 — /page/533 같은 안내 페이지 포함
  if (/(^|\/)page\/\d+\/?$/i.test(u.pathname)) return false;

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
  for (const f of dom.forms || []) {
    if (!f || !DETAILISH_ACTION.test(String(f.action || '').split('?')[0])) continue;
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
      push(v.href);
      // 경로형 상세(동국 …/detail/26765595)를 쓰는 게시판도 있으므로 그 형태도 후보에 넣는다
      const listPath = l.pathname.replace(/\/(list|artclList|index)(\.do|\.jsp|\.php)?\/?$/i, '');
      if (listPath && listPath !== l.pathname) push(`${l.origin}${listPath}/detail/${idVal}`);
    } catch { /* 조립 실패는 그냥 건너뛴다 */ }
  }
  return out;
}

export default { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, titleFingerprint, sameTitle, detailCandidates, idsFromSource };
