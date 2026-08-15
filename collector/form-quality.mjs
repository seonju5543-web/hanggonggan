/* 만들어진 양식이 '학생이 실제로 채울 수 있는 신청서'인가를 본다 (2026-08-14 신설)
   ------------------------------------------------------------------
   왜 필요했나: 무료 변환기(`schema-from-text.mjs`)는 **원본이 표로 짜인 신청서**에서
   칸을 잘못 쪼갠다. 그런데 판정을 **입력 글자**로만 하고 있어서(`COMPLEX_LAYOUT` —
   '시간표·원고지·월|화|수' 같은 몇 낱말) 아래 것들이 전부 통과해 앱에 등록됐다.

     · "성적 (직전학기) __ 점"  → '점'이 **따로 하나의 질문**이 됨
     · "타 장학금 활동 여부 여/부" → '여'와 '부'가 각각 질문
     · 대상구분 표 초/중/고/대 → 질문 4개, 동의 선택지가 `")"` 로 깨짐
     · 선발계획 **공고문**을 신청서로 오인 → '목적'·'1) 신청대상'이 질문

   운영 원칙 4는 "원본에 첨부된 신청서와 **동일한 구조**"를 요구한다. 위 결과물은
   그 조건을 못 지키는데도 '성공'으로 등록됐다. 학생이 그걸 그대로 내면 원본과 다른
   신청서를 내는 셈이라, **없는 것보다 나쁘다.**

   그래서 판정을 **입력이 아니라 결과물**로 옮겼다. 원본이 어떻게 생겼든,
   나온 양식이 못 쓸 모양이면 걸린다. 걸리면 등록하지 않고 API 경로로 넘긴다
   (지금은 잔액이 없어 그냥 건너뛰고, 공고에는 원본 첨부 안내가 그대로 남는다).

   기준선(2026-08-14 실측): 그때 등록돼 있던 로봇 양식 33종에 돌려
   **5종이 걸리고 22종은 깨끗**했다. 걸린 5종은 사람이 하나씩 열어 확인했다. */

/* 값의 단위·체크칸 한 글자 — 원본에서는 앞 칸에 붙어 있던 것이다 */
const UNIT = /^(점|명|원|시간|년|월|일|호|여|부|초|중|고|대|남|화|수|목|금|토)$/;
/* 문서의 안내 문구·꼬리표 — 학생이 채우는 칸이 아니다.
   ⚠️ '1. 성명'처럼 **번호 뒤에 진짜 이름이 오는 것**은 원본 신청서가 실제로 쓰는 방식이라
   걸면 안 된다(손으로 만든 조병두·산학·롯데 양식이 전부 그 모양이다 — 실측으로 확인).
   그래서 번호만 있고 이름이 없는 것, 그리고 문서 꼬리표만 잡는다. */
const NUMBERED = /^\s*[0-9]+\s*[).\-]?\s*$|^※|^예시\)|^\(작성 시 삭제\)|^붙임\s*\d*\s*$/;
/* 공고문 본문의 절 제목 — 이게 질문이면 신청서가 아니라 공고문을 옮긴 것이다 */
const BODY = /^(목적|근거|개요|신청\s*대상|지원\s*자격|제출\s*서류|선발\s*인원|유의\s*사항|문의|추진\s*일정|배정\s*인원|선발\s*계획|합격자\s*통보|최종\s*합격)/;

export function badLabel(label) {
  const s = String(label || '').trim();
  if (s.length < 2) return '이름이 한 글자거나 비어 있음';
  if (UNIT.test(s)) return '단위·체크칸 한 글자가 질문이 됨';
  if (NUMBERED.test(s)) return '문서 번호·안내 문구가 질문이 됨';
  /* 공고문 판정은 **번호를 떼고** 본다 — 공고문의 절도 '1) 신청대상'처럼 번호가 붙어 있다.
     번호를 안 떼면 '3. 최종 합격자 통보'가 그냥 통과한다(실제로 통과하고 있었다). */
  if (BODY.test(s.replace(/^\s*[0-9]+\s*[).\-]\s*/, ''))) return '공고문 본문 제목이 질문이 됨';
  return '';
}

export const badOption = (o) => !/[가-힣A-Za-z0-9]/.test(String(o || ''));

/* 결과: { ok, ratio, problems[] }  — ok=false면 등록하지 말고 API 경로로 넘긴다.

   ⚠️ 비율만으로는 다 못 잡는다 — 이걸 실제로 겪고 기준을 두 갈래로 나눴다.
   국가우수장학금 건은 **선발계획 공고문**을 통째로 양식으로 만들었는데, 표 안의 값
   (과학고·일반고·1순위·3등급 이내…)이 전부 그럴듯한 이름이라 비율이 18%밖에 안 됐다.
   반면 '목적'·'제출 서류'·'1) 신청대상' 같은 **공고문 절 제목은 신청서에 절대 안 나온다.**
   그래서 그건 비율과 무관하게 바로 탈락시킨다(지금 앱의 양식 48종 중 해당 0종 — 확인함).

   한도 20%는 나머지 약한 신호(단위 한 글자·꼬리표)에만 쓴다.
   실측: 지금 양식 48종 중 46종이 0%, 나머지가 11%(시간표 요일)·3%(붙임 1). */
export function checkFormQuality(tpl, { maxBadRatio = 0.2 } = {}) {
  const fields = (tpl?.sections || []).flatMap((s) => s.fields || []);
  const problems = [];
  for (const f of fields) {
    const why = badLabel(f.label);
    if (why) problems.push(`"${String(f.label).slice(0, 24)}" — ${why}`);
    for (const o of f.options || []) {
      if (badOption(o)) problems.push(`선택지 ${JSON.stringify(o)} (질문: ${String(f.label).slice(0, 20)}) — 부스러기`);
    }
  }
  const labelBad = fields.filter((f) => badLabel(f.label)).length;
  const ratio = fields.length ? labelBad / fields.length : 0;
  /* 선택지가 깨진 것은 비율과 무관하게 못 쓴다 — 학생이 고를 수 없는 칸이 생긴다 */
  const optBroken = fields.some((f) => (f.options || []).some(badOption));
  /* 공고문 절 제목이 질문이 됐다 = 신청서가 아니라 공고문을 옮긴 것 */
  const isNotice = fields.some((f) => badLabel(f.label) === '공고문 본문 제목이 질문이 됨');
  return { ok: !optBroken && !isNotice && ratio < maxBadRatio && fields.length > 0, ratio, problems };
}

export default checkFormQuality;
