/* 절 머리글 판정 — **한 곳** (2026-08-24 신설)
   ─────────────────────────────────────────────────────────────────────────
   공고는 자기 구조를 스스로 적어 둔다: `◎ 신청 자격` / `◎ 지원 제외 대상` / `4. 선발기준`.
   그런데 발췌기와 화면이 **그 머리글을 버리고** 줄마다 낱말로 소속을 다시 알아맞히고
   있었다. 그래서 제외 대상이 지원 자격으로, 선발기준이 지원 자격으로 새어 나갔다
   (개발자가 앱을 눈으로 보고 다섯 가지를 찾는 동안 검사는 '잡음 0'을 답했다).

   🔴 이 파일을 베끼지 말 것. 베끼는 순간 발췌기·화면·감사가 서로 다른 경계를 쓰게 되고,
      그게 정확히 지금까지 재발한 이유다(canon-url.mjs·notice-source.mjs와 같은 계열).

   판정은 셋으로 나뉘고, **서로 겹치지 않는다**:
     · 자격 (isQualifyHead)  — 누가 받을 수 있나
     · 제외 (isExcludeHead)  — 누가 못 받나
     · 선발 (isSelectHead)   — 자격을 갖춘 사람 중 어떻게 뽑나 (자격이 아니다)
   ───────────────────────────────────────────────────────────────────────── */

/* 머리글 앞에 붙는 것들. 기호·번호·괄호번호를 뗀 뒤에 낱말을 본다.
   ⚠️ 예전에는 이 접두어 **바로 뒤**에서만 낱말을 찾아서, `◎ 지원 제외 대상`처럼
      낱말 앞에 다른 낱말('지원')이 붙으면 못 알아봤다. 그게 이 파일이 생긴 이유다. */
const PREFIX = /^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭ㆍ·ㅇ*※]*\s*(?:[가-힣]\s*[.)]\s*|\d+\s*[.)]\s*|[①-⑳]\s*|[(（]\s*\d+\s*[)）]\s*)?/;

/** 머리글에서 기호·번호를 떼고 공백을 접는다 (한글 문서가 `제 외 대 상`처럼 자간을 벌린다) */
function headText(line) {
  return String(line || '').replace(PREFIX, '').replace(/[ \t　]+/g, ' ').trim();
}

/* 🔴 낱말은 머리글 **어디에 있어도** 잡는다(앞에 안 붙어 있어도) — 위 ⚠️ 참조.
   대신 머리글은 짧다는 성질로 오탐을 막는다(아래 isHead의 길이 제한). */
const EXCLUDE_WORD = /(제외\s?대상|제외\s?자|제외\s?기준|지원\s?제외|신청\s?제외|장학\s?제외|선발\s?제외|참여\s?제외|결격\s?사유|지원\s?불가\s?대상|제외)/;
const SELECT_WORD  = /(선발\s?기준|심사\s?기준|평가\s?기준|선정\s?기준|배점|심사\s?방법|평가\s?방법|선발\s?방법|우선\s?선발|우선\s?순위|선발\s?우선|고려\s?사항|가산점)/;
const QUALIFY_WORD = /(신청\s?자격|지원\s?자격|응모\s?자격|응시\s?자격|참가\s?자격|참여\s?자격|모집\s?자격|추천\s?자격|장학생\s?자격|장학생\s?기본\s?자격|자격\s?요건|자격\s?기준|지원\s?요건|신청\s?요건|응모\s?요건|선발\s?요건|지원\s?조건|신청\s?조건|추천\s?조건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상|수혜\s?대상|장학\s?대상|지급\s?대상|참가\s?대상|참여\s?대상|응모\s?대상|지원\s?가능\s?대상)/;

/* 자격도 제외도 선발도 아닌, **그냥 다음 절**(여기서도 자격 절은 끝난다).
   여기 빠진 낱말은 그대로 '자격 요건'이 되어 학생에게 보인다(2026-08-20 교훈). */
const OTHER_SECTION = /(신청\s?기간|접수\s?기간|지원\s?기간|신청\s?접수|신청\s?방법|접수\s?방법|제출\s?서류|구비\s?서류|제출\s?방법|제출\s?기한|신청\s?기한|접수\s?기한|확인\s?방법|대상자\s?확인|양식|서식|유의\s?사항|문의|지급|장학금?\s?(지급|금액|내용|혜택|종류)|안내|일정|기타|참고|지원\s?내용|혜택)/;

/* 머리글은 짧다. 길면 그건 제목이 아니라 내용이다 —
   `1. 대한민국 국적으로 외국 대학에 재학 중인 대학생`을 제외 머리글로 보면
   제외 절이 첫 항목에서 끊긴다. 콜론이 붙으면 `신청자격 : …` 꼴이라 조금 길어도 머리글. */
/* 🔴 길이만 보면 **내용 줄이 머리글로 둔갑한다** (2026-08-24 회귀 검사가 잡았다).
   `시간 및 장소 추후 개별 안내 예정`은 20자라 길이 관문을 통과하고 '안내'를 갖고 있어
   머리글로 읽혔다. 그러면 그 줄부터 절이 바뀌어 **뒤따르는 진짜 요건이 통째로 사라진다** —
   잡음보다 나쁜 실패다. 그래서 '절 낱말을 빼고 나면 거의 아무것도 안 남는다'를 본다:
   머리글은 이름표일 뿐이고, 내용 줄은 낱말을 빼도 문장이 남는다. */
const isHead = (t, re) => {
  const test = (x) => {
    const mm = x.match(re);
    if (!mm) return false;
    const rest = x.replace(mm[0], '').replace(/[\s\-–—:：()（）<>《》「」【】.]/g, '');
    return rest.length <= 6;
  };
  if (test(t)) return true;
  const beforeColon = t.split(/[:：]/)[0];   // `신청자격 : 내용` — 이름표 쪽만 본다
  return beforeColon !== t && test(beforeColon);
};

/** '누가 못 받나' 절의 머리글인가 */
function isExcludeHead(line) {
  const t = headText(line);
  return isHead(t, EXCLUDE_WORD);
}

/** '어떻게 뽑나' 절의 머리글인가 — 자격이 아니다(개발자 지적 2026-08-24) */
function isSelectHead(line) {
  const t = headText(line);
  if (isExcludeHead(line)) return false;        // '선발 제외'는 제외 절이다
  return isHead(t, SELECT_WORD);
}

/** '누가 받을 수 있나' 절의 머리글인가 */
function isQualifyHead(line) {
  const t = headText(line);
  if (isExcludeHead(line) || isSelectHead(line)) return false;   // 겹치면 그쪽이 이긴다
  return isHead(t, QUALIFY_WORD);
}

/** 자격 절을 여기서 끊어야 하는가 (제외·선발·그 밖의 다음 절 전부) */
function isSectionBreak(line) {
  if (isQualifyHead(line)) return false;         // 자격이 이어지는 머리글은 안 끊는다
  if (isExcludeHead(line) || isSelectHead(line)) return true;
  const t = headText(line);
  return isHead(t, OTHER_SECTION);
}

/* 머리글 뒤에 내용이 같은 줄에 붙어 있는 경우 그 내용 (`2) 추천대상 : 4년제 대학교…`).
   🔴 머리글이라고 줄을 통째로 버리면 **그 줄에 적힌 진짜 자격이 사라진다** —
   동산장학회의 유일한 자격 줄이 실제로 이렇게 생겼다(2026-08-24에 한 번 없앴다가 되살림). */
function headRest(line) {
  const t = headText(line);
  const i = t.search(/[:：]/);
  if (i < 0) return '';
  const rest = t.slice(i + 1).trim();
  return rest.length >= 4 ? rest : '';
}

/** 이 줄이 속한 절 — 'qualify' | 'exclude' | 'select' | 'other' | null(머리글 아님) */
function sectionOf(line) {
  if (isQualifyHead(line)) return 'qualify';
  if (isExcludeHead(line)) return 'exclude';
  if (isSelectHead(line)) return 'select';
  return isHead(headText(line), OTHER_SECTION) ? 'other' : null;
}

/* Node(발췌기·검사·감사)에서도 같은 판정을 쓰게 — 브라우저·서비스워커에는 영향 없음.
   match-engine.js와 같은 겸용 방식이다. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { headText, headRest, isExcludeHead, isSelectHead, isQualifyHead, isSectionBreak, sectionOf };
}
