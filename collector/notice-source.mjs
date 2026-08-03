/* ============================================================
   등록 공고 ↔ 저장된 원문을 잇는 규칙 한 곳 (2026-08-03 신설)

   예전엔 이 규칙(주소 정규화·제목 정규화)이 extract-excerpts.mjs 안에만 있었다.
   그래서 "발췌기는 원문을 찾았는데 수집기는 못 찾는" 어긋남이 생길 수 있었고,
   실제로 **등록 공고 17건이 원문 없이 방치**돼 있었다(수집 목록에서 밀려나면
   원문 파일이 통째로 다시 만들어지며 사라졌다).

   지금은 세 곳이 같은 함수를 쓴다:
     · collector/extract-excerpts.mjs  (원문에서 자격·발췌 뽑기)
     · collector/deepfetch.mjs         (원문 없는 등록 공고 보충 수집)
     · verify/eligibility-report.mjs   (전수 재채점)
   ============================================================ */

/* 상세 주소에서 '이 글이 무엇인가'를 정하는 파라미터만 남긴다.
   세션값·페이지 번호·검색어는 매번 달라져서 같은 글을 다른 글로 보게 만든다. */
const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|idx|wr_id|bidx)$/i;

export function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) if (ID_PARAMS.test(k) && v) keep.push(`${k.toLowerCase()}=${v}`);
    keep.sort();
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    return u.origin + u.pathname + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}

export const normTitle = (t) => (t || '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/[\s·ㆍ()~〜.,'"“”‘’!⭐★]/g, '')
  .toLowerCase();

/* 저장된 원문 배열을 주소·제목 두 갈래로 색인한다 */
export function indexTexts(texts) {
  const byUrl = new Map();
  const byTitle = new Map();
  for (const v of Object.values(texts || {})) {
    if (v && v.url) byUrl.set(canonUrl(v.url), v);
    if (v && v.title) byTitle.set(normTitle(v.title), v);
  }
  return { byUrl, byTitle };
}

/* 등록 항목 하나의 원문을 찾는다 — 주소 우선, 제목은 차선 */
export function sourceFor(item, idx) {
  if (!item || !idx) return null;
  return idx.byUrl.get(canonUrl(item.sourceUrl || ''))
      || idx.byTitle.get(normTitle(item.name))
      || null;
}

/* 원문을 '읽을 수 있는 상태로' 갖고 있는가.
   FETCH_FAIL/FETCH_ERROR는 deepfetch가 실패를 기록해 둔 문자열이라 본문이 아니다. */
export const hasText = (src) => !!(src && src.text && !/^FETCH_(FAIL|ERROR)/.test(src.text));

/* 원문이 중간에 잘렸는가.
   지금은 deepfetch가 잘랐을 때 cut:true를 남긴다. 그 표시가 생기기 전(2026-08-03 이전)에
   저장된 것은 5,000자에서 잘려 있으므로 길이로 알아본다 — 한 번 다시 받으면 표시가 붙는다. */
export const isCut = (src) => !!(hasText(src) && (src.cut === true || (src.cut === undefined && src.text.length >= 4990)));

/* 다시 받아야 하는가 = 없거나 · 실패했거나 · 잘렸거나 */
export const needsFetch = (src) => !hasText(src) || isCut(src);
