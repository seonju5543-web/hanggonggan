/* ============================================================
   수집 시간 예산 + 학교 순서 회전 (2026-08-03 신설)
   ------------------------------------------------------------
   왜 만들었나 — 2026-08-02~03 사고
     학교를 13→29곳으로 늘리자 브라우저 수집이 8분 → 40분+로 늘어,
     워크플로의 `timeout-minutes: 40`에 걸려 **4회 연속 취소**됐다.
     취소되면 그 아래 저장 단계가 통째로 죽어서, 그때까지 모은 공고가 **전부 버려진다**.

   ⚠️ 12차 세션의 '넘어져도 저장'(uncaughtException에서 저장)으로는 이걸 못 막는다.
      그건 **크래시**를 막는 장치이고, 시간초과는 GitHub이 프로세스를 **강제 종료**하는
      것이라 자바스크립트가 손쓸 틈이 없다.
      → 그래서 해법은 저장이 아니라 **"스스로 예산 안에 끝내기"**다.

   이 파일이 순수 함수만 담는 이유: 학교에 접속하지 않고도 검사할 수 있어야
   같은 사고를 다시 겪지 않는다 (verify/test-collector.mjs가 가짜 시계로 검사).
   ============================================================ */

/* 남은 시간을 알려 주는 시계.
   now를 바꿔 끼울 수 있어서 검사 때 진짜로 기다리지 않아도 된다. */
export function makeBudget(totalMs, now = () => Date.now()) {
  const startedAt = now();
  return {
    startedAt,
    elapsed: () => now() - startedAt,
    remaining: () => totalMs - (now() - startedAt),
    /* 예산을 다 썼나 — 다음 학교를 집기 전에 이걸 묻는다 */
    expired: () => now() - startedAt >= totalMs,
    /* 이 일을 시작해도 되나: 최소 이만큼은 남아 있어야 한다는 뜻.
       남은 시간이 3초인데 학교 하나를 새로 시작하면 어차피 중간에 잘린다. */
    hasRoom: (needMs) => totalMs - (now() - startedAt) >= needMs,
  };
}

/* 학교를 도는 순서를 cursor부터 시작하도록 돌린다.
   반환값은 **원본 인덱스의 배열**(리포트를 설정 파일 순서로 되돌릴 때 필요).

   왜 필요한가: 예산에 걸려 잘리면 항상 설정 파일 **뒤쪽 학교**만 못 돈다.
   시작점을 매번 옮기면 하루 2회 실행으로 모든 학교가 돌아간다.
   (seen.json이 중복을 걸러 주므로 순서가 바뀌어도 같은 공고가 두 번 담기지 않는다.) */
export function rotateOrder(length, cursor) {
  if (!Number.isFinite(length) || length <= 0) return [];
  const n = Math.floor(length);
  const start = (((Number(cursor) || 0) % n) + n) % n;   // 음수·범위 초과도 안전하게
  return Array.from({ length: n }, (_, k) => (start + k) % n);
}

/* 다음 실행이 시작할 자리 = 이번에 마지막으로 처리한 학교의 다음 칸.
   전부 돌았으면 제자리(start)로 돌아와 순서가 고정되지 않는다. */
export function nextCursor(length, cursor, doneCount) {
  if (!Number.isFinite(length) || length <= 0) return 0;
  const n = Math.floor(length);
  const start = (((Number(cursor) || 0) % n) + n) % n;
  return (start + Math.max(0, Math.floor(doneCount || 0))) % n;
}
