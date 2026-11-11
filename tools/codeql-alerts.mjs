/* ============================================================
   CodeQL 경고 → 경보 본문 (2026-11-11 · 은서 · 출시 전 백엔드 10번)
   ------------------------------------------------------------
   code-scanning/alerts 응답(열린 것)에서 **심각한 것**만 고른다 — 보안 심각도 high·critical, 또는 (보안 등급이 없는) 규칙 수준 error.
   나머지(medium·low·note·warning)는 Security 탭에만 둔다(전부 경보로 띄우면 아무도 안 읽는다).
   쓰기: node tools/codeql-alerts.mjs <alerts.json> <본문.md>   → GITHUB_OUTPUT 에 serious=<개수>
   워크플로: .github/workflows/codeql.yml · 관문: verify/health-gates/ops.mjs 「⑦ 보안 자동 점검」
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function isSerious(a) {
  const r = (a && a.rule) || {};
  const sec = String(r.security_severity_level || '').toLowerCase();
  if (sec) return sec === 'high' || sec === 'critical';
  return String(r.severity || '').toLowerCase() === 'error';
}

/** gh api --paginate 는 쪽마다 배열을 이어 붙인다(`][`) — 그것도 읽는다 */
export function parseAlerts(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch { /* 이어 붙인 쪽 */ }
  return JSON.parse(`[${t.replace(/\]\s*\[/g, ',').replace(/^\[|\]$/g, '')}]`);
}

/* 🔴 2026-11-11 — 이 저장소는 **공개**라 이슈·실행 로그·요약은 누구나 본다. 경고의 규칙·파일·줄을 거기 적으면 '어디가 뚫렸는지'를 공개하는 꼴이다
   (첫 실행이 #607 에 그렇게 적었다). 공개되는 곳엔 **개수만** 적고, 자세한 것은 쓰기 권한자만 보는 Security 탭에서 본다. */
export function alertBody(serious, repo = process.env.GITHUB_REPOSITORY || 'seonju5543-web/hanggonggan') {
  const by = {};
  for (const a of serious) { const r = a.rule || {}; const k = String(r.security_severity_level || r.severity || '?').toLowerCase(); by[k] = (by[k] || 0) + 1; }
  return [
    `🛡 **열린 심각 경고 ${serious.length}개** (${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ')}) — 보안 심각도 high·critical 또는 오류 수준만 셌습니다.`, '',
    `자세한 위치는 공개 저장소라 여기 적지 않습니다 → https://github.com/${repo}/security/code-scanning (저장소 쓰기 권한이 있는 사람만 보입니다)`, '',
    'Claude 세션에 "보안 점검 경고 고쳐줘"라고 하면 됩니다. 잘못 짚은 경고는 Security 탭에서 **Dismiss → False positive** 로 닫고 이유를 적습니다 — 다음 실행부터 세지 않습니다.',
  ].join('\n');
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const [inPath, outPath] = argv;
  const serious = parseAlerts(fs.readFileSync(inPath, 'utf8')).filter((a) => a && a.state === 'open' && isSerious(a));
  if (outPath) fs.writeFileSync(outPath, `${alertBody(serious)}\n`);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `serious=${serious.length}\n`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${serious.length ? alertBody(serious) : '🛡 열린 심각 경고 없음'}\n`);   // 개수만 — 요약도 공개
  console.log(`열린 심각 경고 ${serious.length}개`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main()); } catch (e) { console.error(`::error::CodeQL 경고를 읽지 못했습니다 — ${e.message}`); process.exit(1); }
}
