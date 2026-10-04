/* 화면 검사 「양식 표본」 — verify-registered.js 가 '마감 전 양식 공고'를 몰지 못할 때 심는 표본을 고르는 규칙 한 곳 (2026-10-04)

   왜 따로 떼었나 — 고르는 규칙이 드라이버의 page.evaluate 안에만 있으면 브라우저 없이는 아무도 못 잰다.
   그 자리가 이틀 연속 '데이터 탓 빨간불'을 냈다(이슈 #383 · 10-03: 보이는 양식 공고가 전부 마감 /
   #389·#390 · 10-04: 성균관대 학생에게 보이는 양식 공고가 0장 — 남은 셋은 외대 한정 · 마감일 없어 60일 규칙으로 내려감).
   그래서 순수 함수로 두고 드라이버(verify-registered.js)와 관문(verify/health-gates/ci.mjs)이 **같은 함수**를 부른다(베끼지 말 것).

   🔴 칸이 적은 가짜 항목을 지어내지 말 것 — 이름·기관만 넣은 항목은 상세를 열 때 앱이 넘어졌다(PAGEERROR · 실측).
      늘 **실제 등록 항목**을 깊은 복사하고 마감·학교 범위만 바꾼다. 잰 것은 '질문 → 문서 생성' 길이라 양식·질문·문서는 진짜 그대로다.
   🔴 진짜 고장을 표본으로 덮지 않는다 — 실제 후보 가운데 '신청 버튼 잠김' 말고 다른 이유로 실패한 것이 하나라도 있으면 표본을 쓰지 않는다. */

const LOCKED = /\(신청 버튼 잠김\)$/;

/* 표본을 심을 때인가 — 보이는 양식 공고가 아예 없거나, 시도한 실제 후보가 전부 '마감이라 버튼이 잠긴 것'뿐일 때만 */
function shouldPlantSample(visibleIds, tried) {
  const ids = Array.isArray(visibleIds) ? visibleIds : [];
  const t = Array.isArray(tried) ? tried : [];
  return !ids.length || (t.length > 0 && t.every((x) => LOCKED.test(String(x))));
}

/* 날짜 글자(YYYY-MM-DD)에 n일 — 세계 표준시 날짜로 더해 달·해가 바뀌어도 맞다 */
function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* 표본 고르기 — { copy, from } 또는 null(그때는 빨간불로 남긴다).
   고르는 순서: ⓐ 화면에 보인 후보 중 양식이 있는 것 → ⓑ 등록 목록 전체에서 양식이 있는 것(어느 학교든 · 보이든 말든)
              → ⓒ 그것도 없으면 앱에 내장된 양식(builtinId · forms.js — 데이터에 기대지 않는다)을 아무 실제 등록 항목에 붙인다.
   복사본: id 'gate-open-form' · 마감 오늘+20일 · 등록일 오늘(60일 규칙에 안 걸리게) · 학교 범위 칸 셋만 지움(다른 자격 칸은 그대로) · 원본은 안 바꾼다. */
function openFormSample(list, templateIds, visibleIds, todayISO, builtinId = 'jobyungdu-apply') {
  const items = Array.isArray(list) ? list : [];
  const tpl = new Set(Array.isArray(templateIds) ? templateIds : []);
  const hasForm = (x) => !!(x && x.formId && tpl.has(x.formId));
  let src = null;
  for (const id of Array.isArray(visibleIds) ? visibleIds : []) {
    const x = items.find((it) => it && it.id === id);
    if (hasForm(x)) { src = x; break; }
  }
  if (!src) src = items.find(hasForm) || null;
  let formId = src && src.formId;
  if (!src && builtinId && tpl.has(builtinId)) {
    src = items.find((it) => it && it.id) || null;
    formId = builtinId;
  }
  if (!src) return null;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = 'gate-open-form';
  copy.formId = formId;
  copy.deadline = addDaysISO(todayISO, 20);
  copy.listedAt = todayISO;
  if (copy.eligibility && typeof copy.eligibility === 'object') {
    delete copy.eligibility.schoolOnly;
    delete copy.eligibility.campusOnly;
    delete copy.eligibility.schoolsAny;
  }
  return { copy, from: src.id };
}

module.exports = { shouldPlantSample, openFormSample, addDaysISO };
