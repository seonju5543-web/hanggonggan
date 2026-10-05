/* 데이터 관문에 거듭 걸린 자동 등록 공고를 며칠 쉬게 하는 장부 — 한 곳 (2026-10-04 · 로봇·도구 점검)

   왜: 10-03~04 에 같은 자동 등록 8건이 '등록 → 데이터 관문 빨간불 → 되돌림'을 실행마다 되풀이했다. 되돌리기는 그 실행분만 빼므로
   다음 실행이 같은 공고를 또 등록하고, 관문이 또 빨개져 그 실행의 다른 결과까지 흔들었다(관문 자체의 원인은 따로 고쳤다).
   그래서 '관문에 걸려 되돌린 공고'를 장부에 적고, **두 번 걸린 공고는 마지막으로 걸린 날부터 3일** 자동 등록에서 쉬게 한다
   (리포트의 '데이터 관문 쉬기' 묶음에 이유와 함께 남는다 — 조용히 빠지지 않는다). 사흘 뒤에는 다시 본다(그 사이 규칙이 고쳐졌을 수 있다).

   장부: collector/auto-held.json { _comment, items: [{ id, reverts, lastAt }] } — 첫 되돌림 때 로봇(gate-guard)이 만든다(손으로 만들지 말 것).
   쓰는 곳: collector/gate-guard.mjs(되돌린 id 적기) · collector/auto-register.mjs(쉬는 공고 거르기 · 등록된 id·30일 지난 줄 지우기).
   🔴 순수 함수 — 읽고 쓰기는 부르는 쪽(저장 형식 JSON.stringify(x, null, 1) + '\n'). */

export const HOLD_AFTER = 2;   // 이만큼 걸리면 쉰다
export const HOLD_DAYS = 3;    // 마지막으로 걸린 날부터 며칠
export const LEDGER_COMMENT = '데이터 관문에 걸려 되돌린 자동 등록 공고 — 두 번 걸리면 마지막으로 걸린 날부터 3일 자동 등록에서 쉰다(collector/auto-held.mjs). 로봇이 쓴다 · 손으로 고치지 말 것.';

const dayNum = (d) => Math.floor(new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime() / 86400000);

/** 빈 장부(또는 읽은 것)를 같은 꼴로 */
export function normalizeLedger(ledger) {
  const items = Array.isArray(ledger && ledger.items) ? ledger.items.filter((x) => x && x.id) : [];
  return { _comment: LEDGER_COMMENT, items };
}

/** 되돌린 id 들을 적는다 — 걸린 횟수 +1 · 마지막 날 = today(YYYY-MM-DD). 새 장부를 돌려준다. */
export function recordReverts(ledger, ids, today) {
  const L = normalizeLedger(ledger);
  for (const id of ids || []) {
    const row = L.items.find((x) => x.id === id);
    if (row) { row.reverts = (Number(row.reverts) || 0) + 1; row.lastAt = today; } else L.items.push({ id, reverts: 1, lastAt: today });
  }
  return L;
}

/** 지금 쉬는 공고인가 — 두 번 이상 걸렸고 마지막으로 걸린 날부터 3일 안 */
export function isHeld(ledger, id, today) {
  const row = normalizeLedger(ledger).items.find((x) => x.id === id);
  if (!row || (Number(row.reverts) || 0) < HOLD_AFTER) return false;
  const gap = dayNum(today) - dayNum(row.lastAt);
  return Number.isFinite(gap) && gap >= 0 && gap < HOLD_DAYS;
}

/* 마지막으로 걸린 날부터 이만큼 지난 줄은 지운다 — 끝내 등록되지 않는 공고(마감이 지났거나 사람이 막은 것)가 장부에 영영 남지 않게
   (리뷰 2026-10-04). 쉬는 기간(3일)보다 훨씬 길어 쉬기 판정에는 닿지 않는다. 다시 걸리면 처음부터 다시 센다. */
export const STALE_DAYS = 30;

/** 정식 등록된 id 는 장부에서 뺀다(관문을 지났다) · today 를 주면 STALE_DAYS 넘게 지난 줄도 뺀다 — { ledger, removed, stale } */
export function pruneRegistered(ledger, ids, today) {
  const L = normalizeLedger(ledger);
  const reg = ids instanceof Set ? ids : new Set(ids || []);
  const before = L.items.length;
  L.items = L.items.filter((x) => !reg.has(x.id));
  let stale = 0;
  if (today) {
    const t = dayNum(today);
    const keep = L.items.filter((x) => { const gap = t - dayNum(x.lastAt); return !(Number.isFinite(gap) && gap > STALE_DAYS); });
    stale = L.items.length - keep.length;
    L.items = keep;
  }
  return { ledger: L, removed: before - L.items.length, stale };
}
