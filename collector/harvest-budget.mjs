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

/* ── 절대 시한 (2026-08-17 사고로 신설) ─────────────────────────────────
   위 예산 시계에는 구멍이 하나 있었다: **일을 시작하기 전과 끝난 뒤에만** 물어볼 수
   있다는 것. 학교 하나를 보는 중에 브라우저가 답을 영영 안 주면, 예산이 다 돼도
   물어볼 사람이 없어서 로봇은 그 자리에 그대로 멈춰 선다.

   2026-08-15~17에 이걸로 브라우저 수집이 **3회 연속** 통째로 버려졌다:
     · 8/16 08:29 — 학교 17곳을 7분 50초에 다 돌고 끝났는데, 덤으로 붙는
       '실패 학교 재시도'의 가천대가 답을 안 줘서 18분을 더 서 있다가 강제 종료.
       **다 모은 하루치가 전부 버려졌다.**
     · 8/16 13:20 — 시작 30초 만에 시립대·중앙대·가천대 세 곳이 동시에 멈춰,
       17곳 중 6곳만 손대 본 채로 25분 30초를 서 있었다.
     · 8/17 08:29 — 중앙대·상명대가 멈춰 14분 50초를 서 있었다.
   강제 종료되면 저장 단계까지 죽으므로 그날 수집분·리포트가 통째로 사라진다.
   (커서까지 저장을 못 해서, 다음 실행도 **같은 순서로 같은 학교에서** 멈춘다 —
    멈춘 학교를 비켜 가라고 만든 회전 커서가 바로 그 멈춤 때문에 못 도는 악순환.)

   그래서 '물어보는 예산' 옆에 **대답을 안 기다리는 시한**을 둔다. 시한이 지나면
   그 작업의 결과를 버리고 다음으로 간다 — 버려진 작업이 계속 돌든 말든 신경 쓰지
   않는다. 학교 하나를 잃는 것과 하루치를 잃는 것 사이의 선택이기 때문이다. */
export const TIMED_OUT = Symbol('timed-out');

/* promise가 ms 안에 끝나면 그 결과를, 못 끝내면 TIMED_OUT을 돌려준다.
   setTimeout은 반드시 걷어낸다 — 안 그러면 다 끝난 뒤에도 이 타이머 때문에
   프로세스가 안 죽는다. */
export function withDeadline(promise, ms, setTimer = setTimeout, clearTimer = clearTimeout) {
  let timer;
  const alarm = new Promise((resolve) => { timer = setTimer(() => resolve(TIMED_OUT), ms); });
  return Promise.race([promise, alarm]).finally(() => clearTimer(timer));
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
