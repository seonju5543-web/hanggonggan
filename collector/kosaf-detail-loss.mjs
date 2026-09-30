/* 층2 상세(자격 20칸)를 잃었는가 — 판정 한 곳 (2026-09-30)
   ─────────────────────────────────────────────────────────────────────────
   🔴 예전 관문은 **전체 개수**만 비교했다(`지금 상세 수 >= 지난 상세 수`).
      그런데 상세가 줄어드는 길은 둘이고 뜻이 정반대다:
        ① 지금도 목록에 있는 재단의 상세가 사라졌다 → **이어받기가 끊긴 것**(사고 · 되찾을 길 없음)
        ② 재단이 한국장학재단 목록에서 내려갔다 → 그 재단의 상세도 따라 빠진다(로봇은 정상)
      개수로는 둘을 못 가른다. 2026-09-17 저장본 1,849곳이 목록에서 1,847곳이 되자
      관문이 ②를 ①로 읽고 저장을 막았고, 내려간 재단은 돌아오지 않으므로
      **9/22·9/25·9/29 세 번 연속** 저장이 막혀 층2가 13일간 굳었다(이슈 #227).
   → 재단 코드로 맞춘다. ①은 한 곳이라도 실패, ②는 이름을 대고 알린다.
   ⚠️ 목록 파싱이 반쯤 깨져도 ②처럼 보인다 — 그래서 ②가 너무 많으면(DROP_LIMIT) 실패시킨다.

   이 파일은 불러와도 아무것도 실행하지 않는다(kosaf-check.mjs 는 불러오는 순간 돈다 —
   검사가 판정을 돌려 보려면 여기 있어야 한다). */

/* 지난 상세 보유분 중 이만큼 넘게 목록에서 내려가면 '내려감'이 아니라 '목록이 깨짐'으로 본다.
   실측: 2026-09-17 → 09-29 에 내려간 곳은 1,647곳 중 2곳(0.1%). */
export const DROP_LIMIT = 0.1;

export function detailLoss(prevItems, nowItems) {
  const now = new Map((nowItems || []).map((i) => [i.code, i]));
  const prevWith = (prevItems || []).filter((i) => i.detail);
  const lost = [];      // ① 목록에 남았는데 상세가 사라짐
  const dropped = [];   // ② 목록에서 내려감
  for (const p of prevWith) {
    const n = now.get(p.code);
    const who = { code: p.code, name: [p.org, p.name].filter(Boolean).join(' / ') };
    if (!n) dropped.push(who);
    else if (!n.detail) lost.push(who);
  }
  const dropRate = prevWith.length ? dropped.length / prevWith.length : 0;
  return { prevCount: prevWith.length, lost, dropped, dropRate, tooManyDropped: dropRate > DROP_LIMIT };
}
