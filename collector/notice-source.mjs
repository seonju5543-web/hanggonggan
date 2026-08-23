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
import { makeStripper } from './page-boilerplate.mjs';

export const normTitle = (t) => (t || '')
  .replace(/\[[^\]]*\]/g, '')
  .replace(/[\s·ㆍ()~〜.,'"“”‘’!⭐★]/g, '')
  .toLowerCase();

/* 저장된 원문 배열을 주소·제목 두 갈래로 색인한다 */
export function indexTexts(texts, browserBodies) {
  const byUrl = new Map();
  const byTitle = new Map();
  /* 각 원문에 '메뉴를 걷어내고 남는 본문이 몇 글자인가'를 붙여 둔다.
     이게 있어야 아래 hasText가 **본문 없는 껍데기**를 가려낸다 — 자세한 사정은 MIN_BODY 참조.
     스트리퍼는 '같은 학교의 여러 공고에 똑같이 나오는 줄 = 메뉴'라는 원리라 원문 전체가 필요하다. */
  const strip = makeStripper(texts);
  const measure = (v) => {
    if (!v || typeof v.text !== 'string' || v.bodyChars !== undefined) return v;
    try { v.bodyChars = strip(v.url || '', v.text).replace(/[^가-힣]/g, '').length; } catch { /* 재지 못하면 안 잰다 */ }
    return v;
  };
  for (const v of Object.values(texts || {}).map(measure)) {
    if (v && v.url) byUrl.set(canonUrl(v.url), v);
    if (v && v.title) byTitle.set(normTitle(v.title), v);
  }
  /* 브라우저가 그린 본문은 **나중에, 그러나 이길 때만** 얹는다.
     🔴 순서를 뒤집지 말 것 — 먼저 깔면 그 뒤 일반 수집분(껍데기)이 덮어써서
     애써 그린 본문을 잃는다(처음에 그렇게 썼다가 고쳤다).
     '이긴다'의 기준은 **읽을 수 있는 본문이 있는가** 하나다: 기존 것이 껍데기·오류화면·
     실패 기록이면 브라우저 본문으로 바꾸고, 기존 것이 멀쩡하면 건드리지 않는다. */
  const better = (had, now) => !hasText(had) && !!(now && now.text);
  for (const [url, v] of Object.entries(browserBodies || {})) {
    if (!v || !v.text) continue;
    const entry = measure({ url, ...v });
    const k = canonUrl(url);
    if (better(byUrl.get(k), entry)) byUrl.set(k, entry);
    if (v.title) {
      const t = normTitle(v.title);
      if (better(byTitle.get(t), entry)) byTitle.set(t, entry);
    }
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

/* 🔴 **본문을 자바스크립트로 그리는 게시판의 껍데기** (2026-08-20 발견).
   서강·부산·건국·명지는 일반 fetch로 받으면 `L o a d i n g . . .`이나 사이트 메뉴만 오고
   정작 공고 본문이 없다. 그런데 글자 수는 제법 되니 지금까지 **'원문 확보'로 세어져**,
   자격을 못 읽는 원인이 '원문이 없어서'가 아니라 '규칙이 나빠서'인 것처럼 보였다.
   못 받은 것을 받은 것으로 세면 문제가 있는 곳을 영영 못 찾는다(오류 화면 판정과 같은 계열).
   → 껍데기는 '원문 없음'으로 다룬다. 진짜 본문은 브라우저 수집기가 따로 저장한다
     (`extracted/browser-bodies.json` — browser-collect.mjs 참조). */
const SHELL_PAGE = /L\s*o\s*a\s*d\s*i\s*n\s*g\s*\.\s*\.\s*\.|divLoadBody|K2Web Wizard/;

/* 🔴 **껍데기 표시가 없는 껍데기가 훨씬 많다** (2026-08-23 실측).
   `Loading...`·`K2Web` 같은 표시만 보던 시절, 자격을 못 읽는 70건 중 **29건**이
   "원문 확보"로 세어지고 있었다. 실제로는 5,439자를 받아 놓고 그중 공고 본문은
   **한글 191자**뿐이고 나머지는 로그인·사이트맵·학사일정이었다(세종이도).
   AI에게 물어보면 셋 중 하나 꼴로 "메뉴/네비게이션만 있다"고 답한 이유가 이것이다.

   못 받은 것을 받은 것으로 세면 문제가 있는 곳을 영영 못 찾는다 —
   이 저장소가 오류 화면·JS 껍데기에서 두 번 겪은 것과 같은 계열이고, 이번이 세 번째다.
   그래서 **표시가 아니라 실제 본문 분량**으로 판정한다. 메뉴를 걷어낸 뒤(page-boilerplate)
   한글이 이 수보다 적으면 본문이 안 온 것이다.

   문턱을 100으로 정한 근거 (2026-08-23 실측 — 두 번 쟀다):

   처음엔 300으로 잡았다. 그건 **본문 재수집을 하기 전 데이터**로 잰 값이었고,
   재수집으로 본문이 들어온 뒤 다시 재니 멀쩡한 공고를 버리고 있었다 —
   동국대 `교내장학(전체)`은 본문이 정상으로 왔는데(하위 공고로 잇는 목차 페이지라
   원래 짧다) 한글 237자여서 '본문 없음'으로 떨어졌다.

   지금 데이터 기준:
     100자 → '본문 없음'으로 볼 것 14건 · 멀쩡한 걸 잘못 버릴 위험 1건   ← 채택
     200자 →                      29건 ·                        4건
     300자 →                      37건 ·                        6건
   (자격을 읽어낸 124건의 본문 분량 중앙값은 673자다)

   🔴 **손해가 대칭이 아니라서 낮게 잡는다.**
     · 멀쩡한 본문을 '없음'으로 보면 → AI가 영영 시도하지 않는다. 공고 하나를 영구히 잃는다.
     · 메뉴뿐인데 '있음'으로 보면 → AI가 "못 읽겠다"고 답하고 끝난다. **0.2원.**
   높게 잡을 이유가 없다. 거르는 일은 이 문턱이 아니라 AI 뒤의 verifyPick이 한다. */
export const MIN_BODY = 100;

export const looksLikeShell = (text, bodyChars) => {
  const t = String(text || '');
  /* 본문 분량을 잴 수 있으면 그것이 우선이다. 못 재면(옛 호출부) 예전 규칙으로 돈다. */
  if (typeof bodyChars === 'number') return bodyChars < MIN_BODY;
  if (!SHELL_PAGE.test(t.slice(0, 3000))) return false;
  // 껍데기 표시가 있어도 본문이 충분히 딸려 왔으면 진짜 원문이다
  return t.replace(/[^가-힣]/g, '').length < 400;
};

export const hasText = (src) => !!(src && src.text
  && !looksLikeShell(src.text, src.bodyChars)
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
