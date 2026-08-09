/* 공고 주소 정규화 — '이 주소가 같은 글인가'를 정하는 규칙 한 곳 (2026-08-09 분리)
   ------------------------------------------------------------------
   왜 따로 뺐나: 이 규칙은 원래 `collector/auto-register.mjs` 안에 있었는데, 그 파일은
   **불러오는 순간 수집·등록을 실행한다**(맨 아래에 최상위 코드가 있다). 그래서 관리자
   화면의 쓰기 경로(`tools/admin-apply.mjs`)가 규칙을 쓰려고 import하면 로봇이 통째로 돌아 버린다.

   **규칙을 베껴 두면 안 된다.** 사람이 관리자 화면에서 등록한 공고와 로봇이 등록하는 공고가
   서로 다른 기준으로 '같은 글'을 판정하면, 로봇이 이미 등록된 공고를 하루 뒤에 **다시 등록한다**.
   auto-register는 등록 여부를 `canonUrl(sourceUrl)` 집합으로 판정하므로(classify의 첫 줄),
   양쪽이 반드시 이 함수를 함께 써야 한다.

   이 파일은 **순수 함수만** 둔다 — 파일도 안 읽고 인터넷도 안 본다. 그래야 어디서든 안전하게 부른다. */

/* 글을 가리키는 파라미터만 남기고 목록용(정렬·페이지·검색어)은 버린다 */
export const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|idx|wr_id|bidx)$/i;

export function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) if (ID_PARAMS.test(k) && v) keep.push(`${k.toLowerCase()}=${v}`);
    keep.sort();
    // 클릭형 게시판(경희 등)은 목록 주소+제목 표식(#n-…)이 글의 정체성이다 — 떼면 서로 뭉개진다
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    return u.origin + u.pathname + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}

export default canonUrl;
