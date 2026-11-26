/* ============================================================
   대외활동 유료 관문 — 활동 피드의 숨김 표시(paidGate) 꼴 감사 (2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-1)
   🔴 **경고만** 낸다 — 오류로 두면 수집 로봇의 저장이 통째로 되돌려진다(gate-guard). verify/audit-data.js 가 부른다 · 관문 「대외활동 유료 관문 ⑤」.
   표시는 수집 로봇(collector/act-card.mjs stampNewActivity)이 한국 날짜로만 단다 — 날짜 꼴이 아닌 표시는 손으로 고쳤거나 병합이 깨뜨린 것이다:
   앱은 날짜를 못 세어 그 글을 AI 카드가 실릴 때까지 숨기고(사흘 규칙이 안 통한다), 로봇도 그 글의 원문을 받지 않는다 — 조용히 사라지는 글이 된다.
   ============================================================ */
function actGateWarnings(items) {
  const bad = []; const noId = [];
  for (const n of items || []) {
    if (!n || n.paidGate == null) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.paidGate))) bad.push(n);
    else if (!n.id && !n.paidOpen) noId.push(n);   // 수집 로봇이 「id 없는 글」 표식을 단 글은 이미 보인다(2026-11-26)
  }
  const names = (xs) => xs.slice(0, 3).map((n) => String(n.title || n.url || '').slice(0, 30)).join(' · ');
  return [
    ...(bad.length ? [`activities — 숨김 표시(paidGate)가 날짜 꼴(YYYY-MM-DD)이 아닌 글 ${bad.length}건 — 앱이 날짜를 못 세어 AI 카드가 실릴 때까지 안 보이고 로봇도 원문을 받지 않습니다(표시를 지우거나 날짜로 고쳐 주세요): ${names(bad)}`] : []),
    ...(noId.length ? [`activities — 숨김 표시가 달렸는데 id 가 없는 글 ${noId.length}건 — AI 카드와 만날 수 없습니다(수집 로봇이 다음 실행에 표시를 뗍니다): ${names(noId)}`] : []),
  ];
}
module.exports = { actGateWarnings };
