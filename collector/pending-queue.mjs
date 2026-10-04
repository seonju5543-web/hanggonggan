/* 양식 대기열(collector/pending-forms.json) 정리 — 한 곳 (2026-10-04 · 로봇·도구 점검)

   대기열에는 '정식 등록된 공고의 신청서 원본을 받아 양식으로 옮길 일'이 쌓인다. 그런데 공고가 정식 등록에서 빠져도
   (마감+30일 뒤 정리 · 데이터 관문에 걸려 되돌림 · 사람이 삭제) 대기열 항목은 남아, 점검 때 123건 중 71건이 등록에 없는 고아였다.
   다시 받으러 가지는 않지만(받기 단계가 fetched·retired 를 거른다) 리포트의 '건너뜀 n건'과 자동 등록의 '스키마화 대기 중 n건'을 부풀린다.

   쓰는 곳: collector/schematize-forms.mjs(매 실행 시작 때) · collector/gate-guard.mjs(데이터 관문에 걸린 자동 등록분을 뺀 뒤).
   🔴 순수 함수 — 파일을 읽고 쓰는 것은 부르는 쪽(저장 형식 JSON.stringify(x, null, 1) + '\n' 도 부르는 쪽).
   ⚠️ 다시 등록되면 자동 등록이 대기열에 다시 넣는다('대기줄에 없으면 넣는다') — 지워도 잃는 것이 없다.
   ⚠️ 사람이 retired 로 내린 항목도 그 공고가 등록돼 있으면 고아가 아니라 그대로 남는다. */

/** 정식 등록에 없는 대기 항목을 뺀다. 남는 항목의 칸은 손대지 않는다.
 *  queue: { items: [{ id, … }] } · registeredIds: Set<string> 또는 배열
 *  돌려주는 것: { kept: 남은 항목[], dropped: 뺀 항목[] } (queue 자체는 바꾸지 않는다) */
export function pruneOrphans(queue, registeredIds) {
  const ids = registeredIds instanceof Set ? registeredIds : new Set(registeredIds || []);
  const kept = [];
  const dropped = [];
  for (const q of (queue && queue.items) || []) (ids.has(q && q.id) ? kept : dropped).push(q);
  return { kept, dropped };
}
