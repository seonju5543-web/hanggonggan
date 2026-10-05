/* 정식 등록 두 건을 하나로 합치는 규칙 — 관리자 버튼(tools/admin-apply.mjs merge)과 로봇(auto-register · scope-promote)이
   **같은 함수**를 쓴다(2026-09-30 · 베끼면 갈라진다). 서로 다른 학교에 같은 공고가 올라온 것은 사실 여러 학교가 받는
   장학금이라 한쪽만 남기면 다른 학교 학생이 못 보게 되므로 **전국으로 승격**한다(호반 선례). 남기는 쪽에 없는 정보는
   지우는 쪽에서 살려 온다. 사람이 일부러 비운 마감(`관리자 … · 비움`)은 되살리지 않는다. */
/* 지우는 쪽에서 그 마감 날짜를 **글자로 내는** 문구 하나 — 화면 문구(period) · 출처 표식의 인용 · 발췌 줄 순. 없으면 null. */
export function deadlineQuote(drop) {
  const iso = String(drop.deadline || '');
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mo = String(Number(m[2])), da = String(Number(m[3]));
  const hit = new RegExp(`${iso}|(^|\\D)0?${mo}\\s*[./월\\-]\\s*0?${da}(?![\\d])`);
  const fromQuote = /·/.test(drop.deadlineFrom || '') ? drop.deadlineFrom.slice(drop.deadlineFrom.indexOf('·') + 1).trim() : '';
  const cands = [drop.period, fromQuote, ...(Array.isArray(drop.excerpts) ? drop.excerpts : [])].filter(Boolean).map(String);
  return cands.find((t) => !/원문\s*확인/.test(t) && hit.test(t)) || null;
}

/* 마감 전인가 — 로봇의 범위 승격·흡수(scope-promote · auto-register)는 **마감 전 등록분끼리만** 한다 (2026-10-05 점검 collect-14).
   지난 등록분을 전국으로 풀면 44개교 모든 학생에게 30일 동안 '마감' 카드로 보이고(부산대 희망사다리·동국대 파안 실례),
   지난 회차가 다음 학기 같은 사업 글을 흡수하면 새 회차가 등록되지 않는다(사업 열쇠는 연도를 뗀다).
   마감을 모르면 열린 것으로 본다. 🔴 관리자 merge 는 사람이 정하므로 이 조건을 쓰지 않는다(mergeInto 는 그대로). */
export const openOn = (it, today) => !(it && it.deadline) || it.deadline >= today;

/* 로봇이 범위를 움직여도 되는 등록분 — 로봇 등록 · 교외 · 사람이 범위를 정하지 않음(scopeFrom '관리자 …') · 마감 전.
   승격 로봇(scope-promote)과 자동 등록(auto-register)의 판정을 **한 곳**에 둔다(2026-10-05 리뷰) — 두 파일은 불러오는 순간 실행되어
   관문이 표본으로 못 잰다(글자로만 보던 관문은 판정 안의 openOn 을 무력화해도 초록이었다). */
const robotScoped = (it, today) => !!(it && it.auto && it.type === '교외' && !/^관리자/.test(it.scopeFrom || '') && openOn(it, today));

/** 승격 후보 — 위 조건 + 학교 한정(schoolOnly) */
export function promotableOn(it, today) {
  return robotScoped(it, today) && !!((it.eligibility || {}).schoolOnly);
}

/** 이미 전국인 로봇 등록분이 school 게시판의 같은 사업 글을 흡수해도 되는가 — 위 조건 + 학교 한정 없음 ·
 *  여러 학교만 받는 공고(schoolsAny · "학교" 또는 "학교|캠퍼스")는 그 학교가 목록에 있을 때만(푸른등대 K-원전 13개교가 이 꼴) */
export function absorbsOn(it, school, today) {
  const e = (it && it.eligibility) || {};
  if (!robotScoped(it, today) || e.schoolOnly) return false;
  return !e.schoolsAny || !school || e.schoolsAny.some((x) => String(x).split('|')[0] === school);
}

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
  /* 🔴 마감은 **근거 문구와 함께**만 옮긴다 (2026-10-01 실측 — 인하대 글의 마감을 전국 등록분에 옮기자 그 항목에는 그 날짜를 내는
     줄이 없어 마감일 감사 「근거를 못 찾음」이 4건이 되고, 데이터 관문이 빨간불 → 그날 자동 등록 8건이 통째로 되돌려졌다).
     감사(verify/deadline-audit.mjs)는 출처 표식의 `·` 뒤 문구에서 그 날짜를 읽을 수 있으면 근거로 본다. 근거 문구가 없으면 옮기지 않는다 — 못 믿으면 비운다. */
  if (!keep.deadline && drop.deadline && !/^(AI|관리자)/.test(keep.deadlineFrom || '')) {
    const quote = deadlineQuote(drop);
    if (quote) {
      keep.deadline = drop.deadline;
      keep.deadlineFrom = `${(drop.deadlineFrom || '합친 등록분').replace(/\s*·.*$/, '')}(${de.schoolOnly || drop.id} 게시판 · 합친 등록분) · ${quote}`;
      if (!keep.period || /원문\s*확인/.test(keep.period)) keep.period = drop.period && !/원문\s*확인/.test(drop.period) ? drop.period : keep.period;
    }
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
