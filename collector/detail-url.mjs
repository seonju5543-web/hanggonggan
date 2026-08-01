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
      push(v.href);
    } catch { /* 조립 실패는 그냥 건너뛴다 */ }
  }
  return out;
}

export default { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, titleFingerprint, sameTitle, detailCandidates, idsFromSource, looksLikeLoginWall };
