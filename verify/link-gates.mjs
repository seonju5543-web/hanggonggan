/* 「원문 링크 정직성」 관문 묶음 (2026-10-03) — test-collector.mjs 의 같은 이름 절이 부른다.
   갈래마다 파일 하나(verify/link-gates/*.mjs · 기본 내보내기 = async (eq, ctx) => void).
   🔴 파일을 더하면 여기 목록에도 적는다 — 디렉터리를 훑어 부르면 지운 파일·오타가 조용히 빠진다.
      반대쪽(폴더엔 있는데 목록에서 빠진 갈래)은 폴더와 대조해 빨간불로 잡는다(2026-10-11 점검 gates-1 · 대조는 health-gates.mjs checkPartsMatchDir 한 곳). */
import { checkPartsMatchDir } from './health-gates.mjs';

const PARTS = ['core', 'app', 'robot', 'producers', 'data', 'fixes', 'candidates', 'admin'];

export async function runLinkGates(eq) {
  checkPartsMatchDir(eq, PARTS, new URL('./link-gates/', import.meta.url), '원문 링크 정직성(verify/link-gates/)');
  for (const p of PARTS) {
    const mod = await import(`./link-gates/${p}.mjs`);
    console.log(`  — ${p}`);
    await mod.default(eq, { root: new URL('../', import.meta.url) });
  }
}
