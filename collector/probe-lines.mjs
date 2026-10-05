/* 링크 정찰 지시 줄 읽기 — 순수 함수 (2026-10-05 로봇·도구 점검 · gaps-05)
 *
 * 왜 따로 두나: collector/probe-links.mjs 는 **불러오는 순간 브라우저를 띄운다** — 관문은 이 파일만 불러 쓴다.
 *
 * 무엇을 고쳤나: 정찰은 push 마다 run-probe.txt 의 **살아 있는 줄 전부**(25줄 남짓)를 다시 열었다. 2026-10-03 하루에 네 번 돌며
 *   매번 동국·서강·서울대·상명의 옛 줄을 다시 두드렸고(CLAUDE.md '같은 학교를 하루에 여러 번 두드리지 말 것'),
 *   10-04 실행은 예산 11분 가운데 10분 10초를 썼다. → push 로 깨면 **이번 push 가 새로 넣은 줄만** 연다(addedDirectives).
 *   손으로 돌리면(Actions 수동 실행) 지금처럼 전부 연다.
 */
/* certHost 줄은 이 파일의 몫이 아니다 — collector/certs/probe-chain.sh 가 따로 읽는다(그대로 둔다). */
export const DIRECTIVE_KEYS = ['checkUrl', 'findBoard'];

/** `key:` 로 시작하는 줄의 값들 (앞뒤 공백 다듬음 · 주석 줄 `# …` 은 key 로 시작하지 않으므로 빠진다) */
export function directives(text, key) {
  return String(text || '').split('\n').map((l) => l.trim())
    .filter((l) => l.startsWith(`${key}:`)).map((l) => l.slice(key.length + 1).trim()).filter(Boolean);
}

/** after 의 살아 있는 지시 줄 가운데 before 에 (같은 지시로) 살아 있지 않던 것만 — { checkUrl: [...], findBoard: [...] }
    주석을 풀어 되살린 줄은 before 에서 주석이었으므로 '새 줄'로 센다 · 그대로인 줄·주석·빈 줄은 빠진다 */
export function addedDirectives(beforeText, afterText, keys = DIRECTIVE_KEYS) {
  const out = {};
  for (const k of keys) {
    const had = new Set(directives(beforeText, k));
    out[k] = [...new Set(directives(afterText, k))].filter((v) => !had.has(v));
  }
  return out;
}
