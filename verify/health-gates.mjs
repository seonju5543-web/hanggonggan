/* 「로봇·도구 점검 관문」 묶음 (2026-10-04 대대적 점검 · 개발자 "모든 로봇과 앱 안 도구가 제 기능을 하는지 확인하고 수리") —
   test-collector.mjs 의 같은 이름 절이 부른다. 점검에서 고친 것마다 다시 깨지면 빨간불이 되게 묶음별 파일 하나씩 둔다
   (verify/health-gates/<묶음>.mjs · 기본 내보내기 = async (eq, ctx) => void · verify/link-gates/*.mjs 와 같은 꼴).
   🔴 표본(고정 예시)만 잰다 — 실데이터(data/·collector/ 장부)를 읽어 단정하지 말 것. 그 실수가 이번 점검에서 사고 셋을 냈다
      (로봇이 데이터를 바꾸는 순간 관문이 빨개져 자동 등록분이 되돌려지고, 관문을 같이 쓰는 다른 로봇이 제 결과를 버렸다).
   🔴 파일을 더하면 여기 목록에도 적는다 — 디렉터리를 훑어 부르면 지운 파일·오타가 조용히 빠진다.
   🔴 묶음 파일이 아무것도 재지 않으면 실패로 센다(검사가 조용하면 통과가 아니라 무력해진 것 — CLAUDE.md 매 세션 3).
   혼자 돌리기: node verify/health-gates.mjs [묶음 …] */
export const PARTS = ['gate', 'feed', 'bodies', 'browser', 'qnotice', 'qfeeds', 'links', 'ci', 'alerts', 'servers', 'insta', 'admin', 'refresh', 'ops'];

export async function runHealthGates(eq, only = []) {
  const root = new URL('../', import.meta.url);
  for (const p of PARTS) {
    if (only.length && !only.includes(p)) continue;
    const mod = await import(`./health-gates/${p}.mjs`);
    console.log(`  — ${p}`);
    let n = 0;
    const counted = (label, got, want) => { n++; eq(label, got, want); };
    await mod.default(counted, { root });
    if (!n) eq(`  ${p} 묶음 관문이 아무것도 재지 않는다`, 0, '1 이상');
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  let fail = 0;
  const eq = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
    else console.log(`  ✓ ${label}`);
  };
  const only = process.argv.slice(2);
  const unknown = only.filter((p) => !PARTS.includes(p));
  if (unknown.length) { console.log(`✕ 목록에 없는 묶음: ${unknown.join(', ')} (PARTS: ${PARTS.join(', ')})`); process.exit(1); }
  await runHealthGates(eq, only);
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 로봇·도구 점검 관문 전부 통과');
  process.exit(fail ? 1 : 0);
}
