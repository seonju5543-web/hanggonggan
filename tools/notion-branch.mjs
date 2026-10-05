/* 노션 「작업 현황」의 '브랜치' 칸과 노션 쓰기 재시도 — 순수 함수 (2026-10-05 로봇·도구 점검 · ops-12)
 *
 * 🔴 왜 따로 두나: tools/notion-status.mjs 는 **불러오는 순간 실행된다**(노션에 쓴다). 관문이 규칙만 재려면
 *    규칙이 다른 파일에 있어야 한다 — 관문은 이 파일만 불러 쓰고, 본체는 따로 돌려 본다.
 *
 * '브랜치' 칸이 늘 main 이던 까닭: 관례대로 작업 브랜치·기본 브랜치·main 세 곳에 push 하면 사람마다 대기줄 하나
 *    (update-progress.yml `notion-status-<사람>` · 늦게 온 실행이 앞 실행을 취소)에서 **마지막 실행만** 남고, 그게 대개 main 이다.
 *    그 실행의 GITHUB_REF_NAME(main)을 그대로 적었다 → 누가 어느 작업 브랜치에서 일하는지 칸이 말하지 못했다.
 *    → 지금 커밋을 가리키는 원격 브랜치 가운데 main·기본 브랜치가 아닌 것(작업 브랜치)을 고른다. 못 읽으면 칸을 쓰지 않는다
 *      (빈 값·짐작으로 덮지 않는다 · 원칙 8-1).
 * 재시도가 없던 까닭: 노션이 한 번 500(2026-10-01 'Cross-cell memcached access is not allowed')을 내자 그대로 빨간불로 끝났다.
 *    → 429·5xx·네트워크 예외만 쉬었다 다시 보낸다. 마지막 실패는 지금처럼 빨간불(열쇠 만료·공유 해제를 숨기지 않는다).
 */
import { BASE_BRANCH } from '../collector/robot-heartbeat.mjs';

export { BASE_BRANCH };

/** `git for-each-ref --points-at HEAD --format=%(refname) refs/remotes/origin` 출력 → 원격 브랜치 이름들 (origin/ 떼고 HEAD 뺌)
    못 읽었으면(null·undefined) null — '없음'과 '못 읽음'을 가른다 */
export function remoteBranchesFrom(text) {
  if (text == null) return null;
  return String(text).split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.replace(/^refs\/remotes\/origin\//, '').replace(/^origin\//, ''))
    .filter((b) => b && b !== 'HEAD' && b !== 'origin');
}

/** '브랜치' 칸에 쓸 이름 — 못 정하면 null (칸을 쓰지 않는다)
    ref: 이 실행의 GITHUB_REF_NAME · pointsAt: 지금 커밋을 가리키는 원격 브랜치 이름들(못 읽었으면 null) */
export function branchLabel({ ref, pointsAt, base = BASE_BRANCH }) {
  const r = String(ref || '');
  if (r && r !== 'main' && r !== base) return r;              // 작업 브랜치에서 돈 실행 — 그대로
  if (pointsAt == null) return null;                           // 못 읽음 — 짐작하지 않는다
  /* 이름순 첫째 — 어느 실행이 대기줄에서 살아남든 같은 값을 쓴다 */
  const topic = [...pointsAt].filter((b) => b && b !== 'main' && b !== base).sort()[0];
  if (topic) return topic;
  if (pointsAt.includes(base)) return base;
  return r || null;
}

/** 다시 보낼 만한 응답인가 — 너무 잦음(429)·서버 쪽 잘못(5xx)만. 400·401·404 는 다시 보내도 같다 */
export const retryable = (status) => status === 429 || (status >= 500 && status <= 599);

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 네트워크 예외·다시 보낼 만한 응답이면 waits 만큼 쉬고 다시 보낸다. 마지막 응답은 그대로 돌려주고, 마지막 예외는 그대로 던진다. */
export async function patchWithRetry(fetchFn, url, init, waits = [3000, 8000], sleep = realSleep, log = console.log) {
  for (let i = 0; ; i += 1) {
    let res = null;
    let err = null;
    try { res = await fetchFn(url, init); } catch (e) { err = e; }
    const again = err ? true : retryable(res.status);
    if (!again || i >= waits.length) {
      if (err) throw err;
      return res;
    }
    log(`  · 노션 ${err ? `연결 실패(${err.message})` : `응답 ${res.status}`} — ${Math.round(waits[i] / 1000)}초 뒤 다시 보냅니다 (${i + 2}/${waits.length + 1})`);
    await sleep(waits[i]);
  }
}
