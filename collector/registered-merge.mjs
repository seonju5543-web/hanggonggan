/* 정식 등록 두 건을 하나로 합치는 규칙 — 관리자 버튼(tools/admin-apply.mjs merge)과 로봇(auto-register · scope-promote)이
   **같은 함수**를 쓴다(2026-09-30 · 베끼면 갈라진다). 서로 다른 학교에 같은 공고가 올라온 것은 사실 여러 학교가 받는
   장학금이라 한쪽만 남기면 다른 학교 학생이 못 보게 되므로 **전국으로 승격**한다(호반 선례). 남기는 쪽에 없는 정보는
   지우는 쪽에서 살려 온다. 사람이 일부러 비운 마감(`관리자 … · 비움`)은 되살리지 않는다. */
import { evidenceExcerpts, excerptsHumanOwned } from './notice-source.mjs';
/* 지우는 쪽에서 그 마감 날짜를 **글자로 내는** 문구 하나 — 화면 문구(period) · 출처 표식의 인용 · 발췌 줄 순. 없으면 null. */
export function deadlineQuote(drop) {
  const iso = String(drop.deadline || '');
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const mo = String(Number(m[2])), da = String(Number(m[3]));
  const hit = new RegExp(`${iso}|(^|\\D)0?${mo}\\s*[./월\\-]\\s*0?${da}(?![\\d])`);
  const fromQuote = /·/.test(drop.deadlineFrom || '') ? drop.deadlineFrom.slice(drop.deadlineFrom.indexOf('·') + 1).trim() : '';
  /* 🔴 사람이 쓴 발췌(excerptsFrom '관리자 …')는 날짜의 원문 근거가 아니다 — 근거로 읽는 곳은 전부 evidenceExcerpts 를 지난다(2026-11-17) */
  const cands = [drop.period, fromQuote, ...evidenceExcerpts(drop)].filter(Boolean).map(String);
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
  /* 🔴 학교 창구 증거로 되돌린 것(scope-promote ⓪ · 「원문 재판정으로 학교 한정」)은 합치기로도 다시 넓히지 않는다 — 학교 추천·창구 접수분은
     학교마다 따로다(리뷰 2026-11-23 · 안 그러면 같은 실행의 ③ 이나 다음 자동 등록이 다른 학교 같은 사업과 합쳐 44개교로 되돌린다). 사람이 본다 */
  if (/원문 재판정으로 학교 한정/.test((it && it.scopeFrom) || '')) return false;
  return robotScoped(it, today) && !!((it.eligibility || {}).schoolOnly);
}

/** 이미 전국인 로봇 등록분이 school 게시판의 같은 사업 글을 흡수해도 되는가 — 위 조건 + 학교 한정 없음 ·
 *  여러 학교만 받는 공고(schoolsAny · "학교" 또는 "학교|캠퍼스")는 그 학교가 목록에 있을 때만(푸른등대 K-원전 13개교가 이 꼴) */
export function absorbsOn(it, school, today) {
  const e = (it && it.eligibility) || {};
  if (!robotScoped(it, today) || e.schoolOnly) return false;
  return !e.schoolsAny || !school || e.schoolsAny.some((x) => String(x).split('|')[0] === school);
}

/** 원문 증거로 전국으로 풀었던 로봇 등록분 — 지금 규칙으로 다시 볼 대상이면 돌려줄 학교 `{ school, campus }`, 아니면 null (2026-11-23 · 원칙 7 소급).
 *  scope-promote ①② 가 남긴 표식 `로봇 YYYY-MM-DD · 원문 증거로 전국 — … (게시: 학교[ · 캠퍼스])` 이 있고 · 지금도 전국이고 · 다른 학교 글을 흡수하지 않은 것만
 *  (흡수했으면 그 학교 학생 몫도 들어 있다 — 한 학교로 좁히면 그 학생들이 못 본다 · 사람이 본다).
 *  🔴 사람이 범위를 정하면 표식이 '관리자 …' 로 바뀌므로 여기 걸리지 않는다. 좁히는 쪽이라 마감이 지나도 본다(넓히는 승격만 마감 전 · collect-14). */
export function revertTarget(it) {
  if (!it || !it.auto) return null;
  const m = String(it.scopeFrom || '').match(/^로봇 \S+ · 원문 증거로 전국 — [\s\S]*\(게시: ([^()]+)\)\s*$/);
  if (!m) return null;
  const e = it.eligibility || {};
  if (e.schoolOnly || (e.schoolsAny || []).length || (it.alsoPostedAt || []).length) return null;
  const [school, campus] = m[1].split(' · ').map((s) => s.trim());
  return school ? { school, campus: campus || null } : null;
}

/** 다른 학교의 같은 사업을 합친다 — 범위 승격 로봇(scope-promote ③)의 짝짓기 한 곳 (2026-11-23 이리 옮김 · 그 파일은 불러오는 순간 실행되어 관문이 표본으로 못 잰다).
 *  남기는 쪽은 앞의 후보(둘 다 학교 한정 · 다른 학교 → 전국 승격) 또는 전국 등록분(흡수 · 범위 그대로).
 *  🔴 전국 등록분이 배열 **뒤**에 있어도 짝을 짓는다 — 예전 고리는 앞쪽이 후보이고 뒤쪽이 전국이면 건너뛰어,
 *     사업 열쇠를 고친 뒤 되살아난 짝(먼저 등록된 학교 한정 · 나중에 전국으로 풀린 등록분)이 영영 안 합쳐졌다.
 *  items 를 제자리에서 고친다(지운 쪽을 뺀다). 반환: [{ keep, drop, dropSchool, promoted, absorbed }] */
export function mergeSamePrograms(items, today, sameProgram, { reason = '다른 학교 게시판에도 같은 사업(자동 승격)' } = {}) {
  const out = [];
  const sch = (it) => (it.eligibility || {}).schoolOnly;
  for (let i = 0; i < items.length; i++) {
    for (let j = items.length - 1; j > i; j--) {
      const a = items[i]; const b = items[j];
      let keep = null; let drop = null; let at = -1;
      if (promotableOn(b, today) && (promotableOn(a, today) ? sch(a) !== sch(b) : absorbsOn(a, sch(b), today))) { keep = a; drop = b; at = j; }
      else if (promotableOn(a, today) && absorbsOn(b, sch(a), today)) { keep = b; drop = a; at = i; }
      if (!keep || !sameProgram(keep, drop)) continue;
      const dropSchool = sch(drop);
      const r = mergeInto(keep, drop, { reason });
      if (!r.promoted && !r.absorbed) continue;
      out.push({ keep, drop, dropSchool, ...r });
      items.splice(at, 1);
      if (at === i) { i -= 1; break; }   // 앞쪽(a)을 지웠다 — 같은 자리에 온 다음 항목부터 다시 본다
    }
  }
  return out;
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
  /* 발췌는 **주인 표식과 한 세트로** 옮긴다(2026-11-17) — 사람이 쓴 발췌를 표식 없이 옮기면 남는 쪽에서 '로봇이 원문에서 뽑은 줄'로
     둔갑해 근거로 쓰인다. 남는 쪽을 사람이 일부러 비웠으면(`관리자 … · 비움`) 되살리지 않는다(마감과 같다) */
  /* 🔴 버리는 쪽 발췌가 **사람 것**이고 남는 쪽이 로봇 것이면 사람 것이 이긴다(2026-11-17 리뷰 4차) — 범위 승격 로봇이 지켜보는 사람 없이
     합치므로, 남는 쪽에 로봇 발췌가 있다는 이유로 관리자가 바로잡은 줄과 그 표식이 소리 없이 사라졌다 */
  const dropHuman = (drop.excerpts || []).length && excerptsHumanOwned(drop);
  if ((dropHuman && !excerptsHumanOwned(keep))
      || (!(keep.excerpts || []).length && (drop.excerpts || []).length && !excerptsHumanOwned(keep))) {
    keep.excerpts = drop.excerpts;
    if (drop.excerptNote) keep.excerptNote = drop.excerptNote; else delete keep.excerptNote;
    if (drop.excerptsFrom) keep.excerptsFrom = drop.excerptsFrom; else delete keep.excerptsFrom;
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
