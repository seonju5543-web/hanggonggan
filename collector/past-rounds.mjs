/* '지난 회차' 장부 — 등록 뒤 마감 경과로 뺀 로봇 등록분의 사업을 기억한다 (2026-10-05 리뷰 · 한 곳)

   왜: 자동 등록은 '등록할 때 이미 마감이 지나 있던' 로봇 등록분을 뺀다(verify/entry-rules.cjs registeredAfterDeadline · 점검 collect-07).
   그런데 빼는 순간 **다른 학교의 같은 사업 글을 막던 짝이 사라졌다** — 그 등록분이 있을 때는 같은 사업 글이 '승격 불가(마감 경과) 컨펌 대기'로
   걸렸는데, 빼고 나면 같은 실행에서 그 글이 마감 없이 새로 등록되고, 셋째 학교 글이 그것을 전국으로 승격했다(실데이터 재현: 세종대 K-원전
   마감 9/28 을 빼자 부산대 같은 사업 글이 '접수 기간 원문 확인'으로 등록 → 동국대 글이 전국 승격 → alsoPostedAt 이 붙어 다시는 안 빠지고
   44개교 전체에 30일 '마감' 카드). 그래서 뺀 등록분의 사업(programKey)과 마감을 여기 적고, 자동 등록이 같은 사업 글을
   '같은 사업의 지난 회차 — 새 회차인지 컨펌 대기'로 내린다(빼기 전 짝이 하던 일과 같다).
   🔴 다른 학교 글에 남의 마감을 적어 넣지 않는다 — 학교마다 접수 마감이 다를 수 있다. 사람이 컨펌한다.

   장부: collector/past-rounds.json { _comment, items: [{ id, name, school, deadline, url, droppedAt }] } — 자동 등록이 처음 뺄 때 만든다.
   줄은 뺀 날부터 PAST_ROUND_DAYS 일 뒤 지운다 — 실시간 공고가 피드에 머무는 기간(60일)과 같다(그 회차 글이 피드에 있을 동안만 막는다).
   '같은 사업인가'는 자동 등록이 등록분과 견줄 때 쓰는 **그 판정**(사업 열쇠 sameProgram · 이름 대조 isDuplicatePair · 재단 이름)을 부르는 쪽이
   넘긴다 — 사업 열쇠만 보면 모자랐다(실데이터: 부산대 K-원전 글은 세종대 등록분과 열쇠가 달라 이름 대조로만 걸렸다).
   🔴 순수 함수 — 읽고 쓰기는 부르는 쪽(저장 형식 JSON.stringify(x, null, 1) + '\n'). */
import { canonUrl } from './canon-url.mjs';

export const PAST_ROUND_DAYS = 60;
export const PAST_ROUNDS_COMMENT = '등록 뒤 마감 경과로 뺀 로봇 등록분의 사업(지난 회차) — 같은 사업 글은 새로 등록하지 않고 컨펌 대기로 내린다(collector/past-rounds.mjs). 뺀 날부터 60일 뒤 지운다. 로봇이 쓴다 · 손으로 고치지 말 것.';

const dayNum = (d) => Math.floor(new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime() / 86400000);

/** 빈 장부(또는 읽은 것)를 같은 꼴로 */
export function normalizePastRounds(ledger) {
  const items = Array.isArray(ledger && ledger.items) ? ledger.items.filter((x) => x && x.id && x.name) : [];
  return { _comment: PAST_ROUNDS_COMMENT, items };
}

/** 뺀 등록분들을 적는다 — 같은 id 는 한 줄(뺀 날만 오늘로). 새 장부를 돌려준다. */
export function recordPastRounds(ledger, dropped, today) {
  const L = normalizePastRounds(ledger);
  for (const it of dropped || []) {
    if (!it || !it.id || !it.name) continue;
    const row = { id: it.id, name: String(it.name), school: (it.eligibility || {}).schoolOnly || '',
      deadline: it.deadline || '', url: canonUrl(it.sourceUrl || ''), droppedAt: today };
    const at = L.items.findIndex((x) => x.id === it.id);
    if (at >= 0) L.items[at] = row; else L.items.push(row);
  }
  return L;
}

/** 뺀 날부터 PAST_ROUND_DAYS 일 넘은 줄을 지운다 — { ledger, removed } */
export function prunePastRounds(ledger, today) {
  const L = normalizePastRounds(ledger);
  const t = dayNum(today);
  const before = L.items.length;
  L.items = L.items.filter((x) => { const gap = t - dayNum(x.droppedAt); return !(Number.isFinite(gap) && gap > PAST_ROUND_DAYS); });
  return { ledger: L, removed: before - L.items.length };
}

/** 장부의 어느 지난 회차가 sameAs(줄 → 참/거짓)에 맞는가 — 그 줄 또는 null. sameAs 는 자동 등록이 등록분과 견줄 때 쓰는 판정 그대로(학교 축은 보지 않는다). */
export function pastRoundOf(ledger, sameAs) {
  if (typeof sameAs !== 'function') return null;
  return normalizePastRounds(ledger).items.find((x) => sameAs(x)) || null;
}
