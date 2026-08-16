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

/* 상세 주소에서 '이 글이 무엇인가'를 정하는 규칙은 `collector/canon-url.mjs` 한 곳에 있다.
   ⚠️ 여기에 **베껴 두면 안 된다.** 2026-08-14까지 실제로 똑같은 함수가 두 벌 있었고,
   그래서 "발췌기는 A공고 원문을 붙였는데 등록 로봇은 B공고로 판정"하는 어긋남이 생겼다.
   canon-url은 순수 함수만 담고 있어(불러도 아무것도 실행되지 않아) 안전하게 가져다 쓴다. */
export { canonUrl } from './canon-url.mjs';
import { canonUrl } from './canon-url.mjs';

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
/* 🔴 200으로 받았지만 **공고가 아니라 오류·점검 화면**인 경우 (2026-08-14 발견).
   서울대가 점검 중이던 날 수집이 돌아, 저장된 '원문' 16건이 전부
   "정보서비스 장애 조치 안내"였다. 발췌기는 그걸 공고 원문으로 읽어
   **장학금 공고의 문의처를 전산실 헬프데스크 번호로** 만들어 놨다 —
   원칙 8-1(원문 그대로)이 가장 나쁘게 깨지는 방식이다.
   받아 오지 못한 것과 똑같이 '원문 없음'으로 다룬다. 그래야 앱이 정직하게
   "아직 못 읽었어요"라고 말한다. 실패는 안심되는 쪽으로 틀리면 안 된다. */
const ERROR_PAGE = /장애\s*조치\s*안내|Domain Recovery Notice|서비스\s*점검\s*중|일시적으로 사용할 수 없|Service (Unavailable|Temporarily)|페이지를 찾을 수 없|잠시 후 다시 시도해\s*주/i;

export const looksLikeErrorPage = (text) => ERROR_PAGE.test(String(text || '').slice(0, 1500));

export const hasText = (src) => !!(src && src.text
  && !/^FETCH_(FAIL|ERROR)/.test(src.text)
  && !looksLikeErrorPage(src.text));

/* 원문이 중간에 잘렸는가.
   deepfetch는 받을 때마다 cut(true/false)과 그때 쓴 한도(limit)를 함께 남긴다.
   그 표시가 생기기 전(2026-08-03 이전)에 저장된 것은 5,000자에서 잘려 있으므로 길이로 알아본다 —
   한 번 다시 받으면 표시가 붙어 더는 길이로 짐작하지 않는다. */
export const isCut = (src) => !!(hasText(src) && (src.cut === true || (src.cut === undefined && src.text.length >= 4990)));

/* 다시 받아야 하는가 = 없거나 · 실패했거나 · **지금보다 짧은 한도로** 잘렸거나.
   지금 한도로 이미 잘린 것은 다시 받아도 똑같으므로 건너뛴다 — 안 그러면 아주 긴 공고
   몇 건을 매 실행 영원히 다시 받는다(2026-08-03 실측 3건). 한도를 올리면 그때 다시 받는다. */
export const needsFetch = (src, limit) => {
  if (!hasText(src)) return true;
  if (!isCut(src)) return false;
  if (limit === undefined) return true;
  return (src.limit ?? 5000) < limit;      // 옛 항목은 5,000자 한도였다
};
