/* 공고 주소 정규화 — '이 주소가 같은 글인가'를 정하는 규칙 한 곳 (2026-08-09 분리)
   ------------------------------------------------------------------
   왜 따로 뺐나: 이 규칙은 원래 `collector/auto-register.mjs` 안에 있었는데, 그 파일은
   **불러오는 순간 수집·등록을 실행한다**(맨 아래에 최상위 코드가 있다). 그래서 관리자
   화면의 쓰기 경로(`tools/admin-apply.mjs`)가 규칙을 쓰려고 import하면 로봇이 통째로 돌아 버린다.

   **규칙을 베껴 두면 안 된다.** 사람이 관리자 화면에서 등록한 공고와 로봇이 등록하는 공고가
   서로 다른 기준으로 '같은 글'을 판정하면, 로봇이 이미 등록된 공고를 하루 뒤에 **다시 등록한다**.
   auto-register는 등록 여부를 `canonUrl(sourceUrl)` 집합으로 판정하므로(classify의 첫 줄),
   양쪽이 반드시 이 함수를 함께 써야 한다. `collector/notice-source.mjs`도 이 파일을 가져다 쓴다.

   이 파일은 **순수 함수만** 둔다 — 파일도 안 읽고 인터넷도 안 본다. 그래야 어디서든 안전하게 부른다.

   ==================================================================
   🔴 2026-08-14 — 규칙을 뒤집었다. 되돌리지 말 것.
   ------------------------------------------------------------------
   예전 규칙은 **'아는 이름의 파라미터만 남기고 나머지는 버린다'** 였다. 아는 이름 목록
   (ID_PARAMS)에 없는 방식으로 글 번호를 넣는 게시판에서는 **서로 다른 글이 같은 열쇠**가 됐다.
   실측: 실시간 공고 613건 중 **177건이 14덩어리로 합쳐져** 있었다.

   무슨 일이 벌어졌나 (둘 다 실제로 확인된 피해):
     ① **다른 공고의 원문이 붙는다.** 경북대는 글 번호를 `mv_data=<base64>` 안에 숨긴다.
        idx=2112(세종이도인재장학금)와 idx=2105(코나아이 소상공인)가 같은 열쇠가 되어,
        세종이도 공고 화면에 **코나아이 공고의 원문 발췌**가 붙어 있었다 — 원칙 8-1 정면 위반.
     ② **새 공고가 조용히 등록되지 않는다.** auto-register는 '이미 등록된 열쇠'면 건너뛰므로,
        그 학교에서 한 건이라도 등록되면 **나머지 공고 전부가 중복으로 취급**된다.

   이름으로 가리려는 시도는 실패한다 — **같은 이름이 학교마다 다른 뜻을 가진다.**
   경희대 `boardId=322765`는 글 번호지만, 전남대 `boardID=5`는 게시판 번호다(글은 `key=`).

   그래서 규칙을 **'군더더기만 버리고 나머지는 남긴다'** 로 바꿨다(`url-key.mjs`가 쓰던 방식 —
   그쪽은 같은 실측에서 뭉갠 것이 0건이었다). 무엇이 글 번호인지 몰라도 안전하다.

   방향을 이렇게 정한 이유: 두 쓰임 모두 **'다른 글'로 잘못 보는 쪽이 훨씬 싸다.**
     · 원문 잇기 — 잘못 '같은 글'이면 남의 자격 요건을 보여 준다. 잘못 '다른 글'이면
       "원문을 아직 읽지 못했어요"로 정직하게 표시될 뿐이다.
     · 중복 판정 — 잘못 '같은 글'이면 새 공고가 영영 안 뜬다. 잘못 '다른 글'이면 같은 공고가
       두 번 등록되고, 그건 눈에 보여서 사람이 지울 수 있다(제목 열쇠도 한 겹 더 받친다).
   ================================================================== */

/* 글과 무관한 값 — 정렬·페이지·검색어·표시 방식. 이것만 버린다.
   `url-key.mjs`의 VOLATILE과 같은 뜻이어야 한다(둘이 갈라지면 판정이 어긋난다). */
const VOLATILE = /^(sort|pageindex|page|pageno|pageunit|nowpage|mode|bbsmode|do|article\.offset|articlelimit|searchcnd|searchwrd|searchkey|searchvalue|searchtype|searchtitle|search_item|search_order|order_list|list_scale|cate_id|viewauth|writeauth|board_list_num|lpagecount|identified|offset|rownum|startpage|listno|allboard|jsessionid|pageref|pageprvnxt|pageorder)$/i;
/* ↑ 끝의 셋(pageref·pageprvnxt·pageorder · 2026-10-05 점검 B6)은 계명대 page.jsp 의 목록 상태 값 — url-key.mjs 와 같은 날 같은 이름을 넣었다.
   ⚠️ idFromUrl(끝 24글자)은 바뀌지 않는다: 정렬 뒤 이 이름들은 가운데에 오고 끝은 srch* 값이다(계명 등록분 실측 변화 0). */

/* 아직 남아 있는 이름 목록 — 이제는 '무엇을 남길까'가 아니라 **글 번호가 확실히 하나는
   잡혔는지** 확인하는 용도로만 쓴다. 다른 곳에서 import해 쓰고 있어 그대로 둔다. */
export const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|nttid|nttno|bbsno|bnum|pstsn|idx|wr_id|bidx)$/i;

export function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) {
      if (!v || VOLATILE.test(k)) continue;
      keep.push(`${k.toLowerCase()}=${v}`);
    }
    keep.sort();                       // 순서가 바뀌어도 같은 글로 본다
    // 클릭형 게시판(경희 등)은 목록 주소+제목 표식(#n-…)이 글의 정체성이다 — 떼면 서로 뭉개진다
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    /* 경로에 박힌 세션 표식(`View.do;jsessionid=…`)은 글과 무관하다 — 접속마다 값이 달라 같은 글이 다른 주소가 됐다(경기대 2026-10-05 · links-7).
       떼는 규칙의 원본은 board-links.mjs stripSessionId — 이 파일은 관리자 화면이 브라우저 모듈로 싣고 import 가 없어야 해서 한 줄만 옮겨 둔다
       (관문 「로봇·도구 점검 관문」 links ② 가 두 규칙이 같은 답을 내는지 대조한다).
       ⚠️ 끝 24자 id 공식: 세션은 물음표 앞이라 뒤에 쿼리가 24자 넘게 붙은 주소는 id 가 그대로다 — 2026-10-05 등록·차단·피드 주소 539개 실측 변화 0. */
    return u.origin + u.pathname.replace(/;jsessionid=[^/?#]*/i, '') + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}

/* 🔴 **주소에서 공고 id 를 만드는 공식 — 여기 하나** (2026-09-14 분리).
   원래 이 식은 `auto-register.mjs` 안에만 있었다. 그런데 관리자 화면의 쓰기 경로
   (`tools/admin-apply.mjs` 의 register·unblock)도 **같은 id** 를 만들어야 한다 —
   다르면 사람이 막아 둔 공고를 로봇이 다른 id 로 다시 담는다.
   🔴 **베끼지 말 것.** 2026-08-14 에 주소 정규화 규칙이 바뀌자 막아 둔 23건의 id 가
   전부 어긋나 부경대 옛 공고가 새 id 를 달고 학생 앱에 되살아났다. 두 벌이면 또 갈라진다.
   ⚠️ 이 식을 고치면 **이미 저장된 id 가 전부 무효가 된다**(설정의 blockIds 포함).
   고쳐야 한다면 blockUrls 처럼 주소로 막는 쪽을 먼저 세우고 옮길 것. */
export function idFromUrl(prefix, raw) {
  return prefix + canonUrl(raw).replace(/[^a-z0-9]/gi, '').slice(-24).toLowerCase();
}

/* 주소 꼬리표 — 정규화한 주소의 짧은 지문(FNV-1a 32비트 → 36진 7자). 같은 주소면 늘 같은 값 */
export function idHash(cu) {
  let h = 0x811c9dc5;
  for (const ch of String(cu || '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/* 🔴 **새로 등록할 id — 겹치면 꼬리표를 단다** (2026-10-05 점검 links-new-1 · 위 공식은 그대로).
   idFromUrl 은 정렬한 주소의 **끝 24자**라, 글 번호가 앞에 오고 게시판 공통값(searchKrwd·sf.pnos·srchVoteType·namepage…)이
   끝을 차지하는 게시판에서는 **그 게시판의 모든 글이 같은 id** 를 받는다(경기·계명·서강·강원·숭실·중앙 등 9개교 · 실측 70여 건).
   그래서 한 글이 등록되면 나머지가 '이미 등록(같은 id)'으로, 사람이 한 글을 막으면 나머지가 '사람이 막아 둔 공고'로 **조용히** 빠졌다 —
   위 2026-08-14 사고(한 건 등록 → 나머지 전부 중복)가 id 단계에서 다시 난 것이다.
   공식을 바꾸면 저장된 id·blockIds 가 전부 어긋나므로, **겹칠 때만** `<옛 id>-<주소 꼬리표>` 를 준다:
     · 그 id 를 이미 다른 주소의 등록분이 쓰고 있으면(holderCanon) → 꼬리표 id
     · 그 id 가 막혀 있지만 이번 묶음에서 여러 주소가 같은 id 를 받고(ambiguous) 이 주소는 막은 주소(blockedCanons)가 아니면 → 꼬리표 id
       (사람은 **그 한 글**을 막았다 — 막은 글은 주소로 계속 막힌다)
     · 그 밖에는 옛 id 그대로(이미 저장된 id·막은 id 가 하나도 안 바뀐다)
   holderCanon(id) 은 그 id 의 등록분 주소(canonUrl)를, 없으면 null 을 돌려준다(주소 없는 등록분은 '' — 겹친 것으로 본다). */
export function registerId(prefix, raw, { holderCanon = () => null, blockedIds = new Set(), blockedCanons = new Set(), ambiguous = () => false } = {}) {
  const legacy = idFromUrl(prefix, raw);
  const cu = canonUrl(raw);
  const tagged = `${legacy}-${idHash(cu)}`;
  const amb = !!ambiguous(legacy);
  const blockedByLegacy = blockedIds.has(legacy) && !amb;
  const held = holderCanon(legacy);
  if (held !== null && held !== undefined && held !== cu) return { id: tagged, legacy, blockedByLegacy };
  if (blockedIds.has(legacy) && amb && !blockedCanons.has(cu)) return { id: tagged, legacy, blockedByLegacy };
  return { id: legacy, legacy, blockedByLegacy };
}

export default canonUrl;
