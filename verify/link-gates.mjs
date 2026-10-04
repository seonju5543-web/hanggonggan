/* 「원문 링크 정직성」 관문 묶음 (2026-10-03) — test-collector.mjs 의 같은 이름 절이 부른다.
   갈래마다 파일 하나(verify/link-gates/*.mjs · 기본 내보내기 = async (eq, ctx) => void).
   🔴 파일을 더하면 여기 목록에도 적는다 — 디렉터리를 훑어 부르면 지운 파일·오타가 조용히 빠진다. */
const PARTS = ['core', 'app', 'robot', 'producers', 'data', 'fixes', 'candidates'];

export async function runLinkGates(eq) {
  for (const p of PARTS) {
    const mod = await import(`./link-gates/${p}.mjs`);
    console.log(`  — ${p}`);
    await mod.default(eq, { root: new URL('../', import.meta.url) });
  }
}
