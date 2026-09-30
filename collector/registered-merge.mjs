/* 정식 등록 두 건을 하나로 합치는 규칙 — 관리자 버튼(tools/admin-apply.mjs merge)과 로봇(auto-register · scope-promote)이
   **같은 함수**를 쓴다(2026-09-30 · 베끼면 갈라진다). 서로 다른 학교에 같은 공고가 올라온 것은 사실 여러 학교가 받는
   장학금이라 한쪽만 남기면 다른 학교 학생이 못 보게 되므로 **전국으로 승격**한다(호반 선례). 남기는 쪽에 없는 정보는
   지우는 쪽에서 살려 온다. 사람이 일부러 비운 마감(`관리자 … · 비움`)은 되살리지 않는다. */
export function mergeInto(keep, drop, { reason = '' } = {}) {
  const ke = keep.eligibility || {};
  const de = drop.eligibility || {};
  let promoted = false;
  /* 남기는 쪽이 **이미 전국**이고 지우는 쪽이 학교 한정이면 '흡수' — 범위는 그대로, 게시 학교만 근거에 더한다
     (리뷰 3차 2026-09-30: 전국으로 풀린 뒤 세 번째 학교 게시판 글이 다시 학교 한정으로 등록되던 구멍). */
  const absorbed = !ke.schoolOnly && !!de.schoolOnly;
  if (ke.schoolOnly && de.schoolOnly && ke.schoolOnly !== de.schoolOnly) {
    delete ke.schoolOnly; delete ke.campusOnly;
    keep.eligibility = ke;
    promoted = true;
  }
  if (!keep.deadline && drop.deadline && !/^(AI|관리자)/.test(keep.deadlineFrom || '')) {
    keep.deadline = drop.deadline;
    if (drop.deadlineFrom) keep.deadlineFrom = drop.deadlineFrom;
  }
  if (!(keep.attachments || []).length && (drop.attachments || []).length) keep.attachments = drop.attachments;
  if (!(keep.excerpts || []).length && (drop.excerpts || []).length) {
    keep.excerpts = drop.excerpts;
    if (drop.excerptNote) keep.excerptNote = drop.excerptNote;
  }
  if (!keep.formId && drop.formId) keep.formId = drop.formId;
  /* 어느 학교 게시판에도 올라왔는지 — 전국으로 승격한 근거를 남긴다(원문 링크와 함께) */
  if (promoted || absorbed) {
    const seen = (keep.alsoPostedAt || []).some((a) => a && (a.id === drop.id || (drop.sourceUrl && a.url === drop.sourceUrl)));
    if (!seen) keep.alsoPostedAt = [...(keep.alsoPostedAt || []), { school: de.schoolOnly, url: drop.sourceUrl || '', id: drop.id }];
  }
  if (promoted) keep.scopeFrom = `${reason || '다른 학교 게시판에도 같은 사업'} — ${de.schoolOnly} 게시판 ${drop.sourceUrl || drop.id}`;
  return { promoted, absorbed };
}
