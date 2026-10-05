/* 공고 본문에서 '접수 기간 한 줄'을 뽑는 규칙 — **한 곳** (2026-09-12 신설)

   왜 만드나 — 이 규칙이 `collect.mjs` 와 `browser-collect.mjs` 에 **똑같이 두 벌** 있었고,
   그 규칙이 `/(마감|까지|기한|접수기간|신청기간)[^\n<]{0,60}/` 였다. 첫 낱말이 걸리는 곳에서
   60자를 잘라 오므로 본문 아무 데나 있는 **`까지`** 가 걸려 이런 것이 학생 화면에 떴다:

     · `까지) 다음글 2025학년도 후기 학위수여식 행사 안내 목록 미리보기…`
     · `까지 나 . 선발 : 10 월 중순예정 다 . 선발확인 : Hufs Ability 로그인 후…`
     · `마감 안내 작성일 2026.08.31 수정일 2026.08.31 작성자 2026085 조회수 5…`

   실측(`collector/extracted/notices-text.json` 86건): 옛 규칙이 41건에서 무언가를 잡았는데
   그중 **20건이 문장 중간**에서 시작했고 **5건은 게시판 껍데기**(목록·조회수·챗봇)였다.
   지금 규칙은 31건을 잡고 문장 중간·껍데기 0건이다. 덜 잡는 대신 잡은 것은 읽을 수 있다.

   ⚠️ **같은 일을 하는 규칙이 하나 더 있다** — `collector/extract-excerpts.mjs` 의 `PERIOD_LABEL`
      (등록 공고의 마감일을 읽는다). 둘을 합치지 않은 이유는 쓰임이 다르기 때문이다: 저쪽은
      날짜 하나를 뽑아 `deadline` 에 넣고(틀리면 학생이 마감을 놓친다), 이쪽은 **문장 한 줄**을
      화면에 그대로 옮긴다. 다만 저쪽에는 값이 `까지|마감` 으로 끝나기를 요구하는 방어가 더
      있으니(`근로기간` 오탐 방지), 이 파일을 손볼 때 그쪽도 함께 볼 것.

   🔴 이 저장소가 이미 정한 것과 같은 방식이다 — **마감일은 '이름표'에 매달아 읽는다**
      (2026-08-30 · `collector/extract-excerpts.mjs` 의 extractDeadline). 넓히지 말 것.
      ⚠️ 2026-09-16 에 한 번만 넓혔다 — 동사 이름표는 날짜 **범위**도 받되 **끝 날짜 뒤에
      한글 산문이 없을 때만**(그 조건이 없으면 자격 줄의 괄호 기간이 마감을 덮는다).
   🔴 **첫 이름표를 그냥 쓰지 않는다** — 학교 홈페이지 배너에 `모집기간: … 상시신청` 같은
      다른 공고의 띠가 먼저 나오는 곳이 있다(실측 2건). 그래서 날짜가 든 것 중에서 고른다. */

/* 기간을 말하는 이름표. `까지`·맨 `기한` 처럼 문장 중간에 흔한 낱말은 안 쓴다.
   🔴 **이름표만 잡고 뒷글자는 안 삼킨다** — 뒤 60자까지 한 정규식으로 잡으면 그 60자 안에 든
      다음 이름표를 건너뛴다(배너가 먼저 나오는 학교에서 진짜 기간을 놓쳤다 · 만들면서 실측). */
/* 🔴 **내보내지 않는다** — `/g` 정규식은 `lastIndex` 를 들고 다녀서, 밖에서 누가 한 번
   `.test()` 하면 그 뒤 `matchAll` 이 중간부터 읽어 **한 실행 내내 힌트가 통째로 빈다**
   (2026-09-12 코드 리뷰가 실측으로 보여 줬다). 쓰는 곳은 아래 함수 둘뿐이다. */
const HINT_LABEL = /((신청|접수|모집|제출|응모|추천|지원)\s*(기간|기한)\s*[:：]?|(?<![가-힣])기한\s*[:：]|마감\s*(일시|일자|일)?\s*[:：])\s*/g;
/* ⚠️ 맨 `기한`·`마감` 은 **콜론이 있을 때만** 이름표로 본다 — 둘 다 문장 중간에 흔하다
   (`기한 내에 희망근로지 신청을…` · `이미 마감 되었습니다 2026. 9. 1. 부터는…`).
   🔴 `마감` 에 콜론을 안 걸었다가 2026-09-12 코드 리뷰에 잡혔다: 오늘 데이터에서 안 걸린 것은
      마침 셋 다 콜론이 있어서였지 규칙이 막아서가 아니었다 — '오늘 데이터가 지켜 주는 것'은
      규칙이 아니다. 신청기간·접수기한처럼 **앞말이 붙은 이름표**는 콜론 없이도 받는다. */
/* 게시판 껍데기 — 이런 낱말이 섞였으면 본문이 아니라 화면 장식이다 */
const HINT_JUNK = /(슬라이드|목록|조회수|개인정보처리방침|챗봇|이전글|다음글|바로가기|미리보기)/;
/* 날짜가 없으면 기간을 말한 것이 아니다(`신청기간 중 화면에서 확인이 가능함` 류) */
const HINT_DATE = /\d{4}\s*[.\-년]|\d{1,2}\s*[.월]\s*\d{1,2}/;

/* HTML 기호(&nbsp; 등)를 글자로 — 본문 글자에 `&nbsp;` 가 날것으로 남아 있으면 80자 자르기가 그 한가운데를 잘라
   학생 화면에 `16:00 &n` 이 떴다(2026-10-03 실측 20건 · 고려대·서울과기대). 두 번 싼 것(&amp;nbsp;)도 있어 두 번 푼다. */
/* 이름 기호는 앱(app.js ENTITIES)이 아는 것 전부 — 관문이 두 목록을 대조한다(리뷰 10-03: &middot;·&lsquo; 가 같은 자리에서 `접&middo` 로 잘렸다) · 숫자 기호(&#183; &#xB7;)는 모두 */
export const HINT_ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', lsquo: '‘', rsquo: '’', bull: '•', sim: '∼', rarr: '→' };
const unentHint = (s) => s
  .replace(/&([a-z]+);/gi, (m, k) => (HINT_ENT[k.toLowerCase()] ?? m))
  .replace(/&#(\d{1,6});/g, (m, d) => String.fromCodePoint(Number(d) === 160 ? 32 : Number(d)))
  .replace(/&#x([0-9a-f]{1,5});/gi, (m, h) => String.fromCodePoint(parseInt(h, 16) === 160 ? 32 : parseInt(h, 16)));
/* 그래도 끝에 반쯤 잘린 기호(`&n`·`&middo`·`&#3`·`&#x`)가 남으면 뗀다 — 기호 꼴(소문자·숫자)만. `R&D` 같은 글자는 안 건드린다 */
export const PARTIAL_ENTITY_END = /&(?:[a-z]{1,7}|#\d{0,6}|#x[0-9a-f]{0,5})?$/;
const cutPartialEntity = (s) => s.replace(PARTIAL_ENTITY_END, '').trim();

/** 본문에서 접수 기간 한 줄. 못 찾으면 null — **지어내지 않는다**. */
export function deadlineHintFrom(text) {
  const t = unentHint(unentHint(String(text || ''))).replace(/\s+/g, ' ');
  for (const m of t.matchAll(HINT_LABEL)) {
    const hint = cutPartialEntity(t.slice(m.index, m.index + 80).trim());
    /* 🔴 날짜는 **이름표 가까이**에 있어야 한다 — 멀리 있으면 다른 문장의 날짜다.
       (`신청기간을 안내합니다. 궁금한 사항은 … 2026년 2학기 푸른등대…` 가 그렇게 남았다) */
    if (!HINT_JUNK.test(hint) && HINT_DATE.test(hint.slice(0, 34))) return hint;
  }
  return null;
}

/* ── 학교 홈페이지 껍데기(머리 배너·메뉴)의 기간 줄 (2026-10-05 점검 collect-04) ──
   항공대 글 19건 전부의 힌트가 `접수기간 : 2026.10.15.(목) 13:30까지 …` 로 같았다 — 매 쪽 머리에 도는 **교수 채용 배너**
   (`모집대상 : 정년 및 비정년트랙 / 접수기간 : …`)가 본문보다 먼저 나와 첫 이름표로 잡혔다. 각 글의 진짜 기간 줄은 그 아래에 있다.
   껍데기 줄(같은 호스트 여러 쪽에 똑같이 나오는 줄 · page-boilerplate.mjs buildBoilerplate)을 **부르는 쪽이 넘긴다** —
   🔴 이 파일에 import 를 더하지 말 것: url-key.cjs 가 이 소스를 new Function 으로 평가하고 관리자 화면이 복사해 쓴다(2026-09-12 감사 전멸).
   🔴 '여러 글이 같은 힌트면 버린다'는 빈도 규칙을 쓰지 말 것 — 진짜로 같은 기간인 다른 공고가 있다(국민 2건·서강 3건 실측). */
const sqHint = (s) => unentHint(unentHint(String(s || ''))).replace(/\s+/g, ' ').trim();

/** 껍데기 줄(boiler · Set)을 뺀 본문 줄로 기간 한 줄. 껍데기를 모르면(빈 Set) 예전과 같다. */
export function hintWithoutChrome(lines, boiler) {
  const arr = (Array.isArray(lines) ? lines : String(lines || '').split(/\n+/)).map((l) => String(l).trim()).filter(Boolean);
  const kept = boiler && boiler.size ? arr.filter((l) => !boiler.has(l)) : arr;
  return deadlineHintFrom(kept.join(' '));
}

/** 저장된 힌트가 껍데기 줄에서 시작했는가 — 힌트 머리가 껍데기 줄 안에 있고, 그 줄의 남은 꼬리가 힌트와 이어지면 참 */
export function isChromeHint(hint, boiler) {
  if (!hint || !boiler || !boiler.size) return false;
  const h = sqHint(hint);
  const head = h.slice(0, 12);
  if (head.length < 6) return false;
  for (const raw of boiler) {
    const l = sqHint(raw);
    const at = l.indexOf(head);
    if (at < 0) continue;
    const rest = l.slice(at);
    if (h.startsWith(rest) || rest.startsWith(h.slice(0, 30).trim())) return true;
  }
  return false;
}

/** 저장된 힌트가 지금 기준을 통과하는가 — 옛 데이터 청소·검사에 쓴다 */
export function looksLikeHint(hint) {
  const t = String(hint || '').trim();
  if (!t) return false;
  const plain = cutPartialEntity(unentHint(unentHint(t)).replace(/\s+/g, ' ').slice(0, 80).trim());   // 기호를 푼 옛 힌트도 같은 힌트로 본다
  return deadlineHintFrom(t) === plain;
}
