/* '종류를 못 알아본 자기소개서 칸' 찾기 — 한 곳 (2026-10-04 · 로봇·도구 점검)

   왜 있나 — 양식의 서술형 칸(kind 'story') 이름을 essay-ask.js 가 모르면(종류 'generic') 학생 화면은 일반 질문만 내고,
   주 1회 작성 규칙 학습 로봇(essay-playbook.yml)이 학습 전에 돌리는 검사(verify-essay-ask.mjs '① generic 0')가 멈춘다.
   실제로 한 번 그렇게 멈췄다 — 세션이 손으로 옮긴 하나장학생 양식(09-24 f4438304)의 '학업 수행에 어려움이 되는 환경 요인과
   본인의 노력' 칸 하나 때문이었다. 그 세션은 감사·규칙 관문·화면 검사를 다 돌렸지만 이 검사는 주간 로봇에만 걸려 있어
   닷새 뒤 예약 실행(09-29)에서야 드러났고, 10-01 에 칸 이름을 가르쳐 고쳤다(2b4d99a1 · #317).
   ⚠️ 양식 로봇(schematize-forms.mjs)은 칸에 kind 를 달지 않는다 — 'story' 는 세션이 양식을 옮기거나 다듬을 때 단다.
      그래서 알림 자리는 로봇 리포트가 아니라 **양식을 고친 세션이 반드시 돌리는 데이터 감사**(audit-data.js · 경고)다.

   🔴 경고로만 쓴다 — 데이터 관문(오류)으로 두지 말 것. 감사가 빨개지면 그날 수집 로봇의 자동 등록분이 되돌려진다.
   🔴 주간 검사(verify-essay-ask.mjs)와 감사가 **이 함수 하나**를 부른다 — 베끼면 한쪽만 고쳐져 경고와 검사가 갈라진다.
   🔴 판정은 essay-ask.js 의 essayAskFor 그대로(사람이 적어 둔 질문 ask 가 있는 칸은 'data' 라 모르는 칸이 아니다). */
const { essayAskFor } = require('../essay-ask.js');

/* templates: { 양식id: { sections: [{ fields: [...] }] } } → [{ form, id, label }] */
function unknownStoryFields(templates) {
  const out = [];
  for (const [form, tpl] of Object.entries(templates || {})) {
    for (const sec of (tpl && Array.isArray(tpl.sections) ? tpl.sections : [])) {
      for (const f of (sec && Array.isArray(sec.fields) ? sec.fields : [])) {
        if (!f || f.type !== 'textarea' || f.kind !== 'story') continue;
        if (essayAskFor(f).kind !== 'generic') continue;
        out.push({ form, id: f.id, label: String(f.label || '').replace(/\s+/g, ' ').trim() });
      }
    }
  }
  return out;
}

module.exports = { unknownStoryFields };
