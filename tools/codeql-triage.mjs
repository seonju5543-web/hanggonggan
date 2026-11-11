/* ============================================================
   CodeQL 경고 정리 — 목록 줄이기 · 닫을 목록 검사 (2026-11-11 · 은서 · 출시 전 백엔드 10번 후속)
   ------------------------------------------------------------
   🔴 공개 저장소라 실행 로그도 누구나 본다 → 목록은 **세션이 준 공개 열쇠로 잠가서만** 로그에 싣는다(워크플로가 openssl 로 잠근다).
   닫기는 경고 **번호**와 정해진 이유만 받는다(이유 글은 짧게 — 로그에 보인다. 위치·수법을 적지 않는다).
   쓰기: node tools/codeql-triage.mjs slim <alerts.json> <out.json>     목록을 번호·규칙·심각도·파일·줄·글로 줄인다
         node tools/codeql-triage.mjs plan <닫을 목록 JSON 글자>          [{ n, reason, comment }] 를 검사해 한 줄씩 n<TAB>reason<TAB>comment
   워크플로: .github/workflows/codeql-triage.yml · 관문: verify/health-gates/ops.mjs 「⑦ 보안 자동 점검」
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseAlerts } from './codeql-alerts.mjs';

export const REASONS = ['false positive', "won't fix", 'used in tests'];

export function slim(alerts) {
  return alerts.filter((a) => a && a.state === 'open').map((a) => {
    const i = a.most_recent_instance || {}; const loc = i.location || {}; const r = a.rule || {};
    return { n: a.number, rule: r.id, sev: r.security_severity_level || r.severity, path: loc.path, line: loc.start_line, msg: ((i.message && i.message.text) || '').slice(0, 200) };
  });
}

/** 닫을 목록 검사 — 틀리면 던진다(하나라도 틀리면 아무것도 닫지 않는다) */
export function plan(text) {
  const list = JSON.parse(String(text || '[]'));
  if (!Array.isArray(list) || !list.length) throw new Error('닫을 목록이 비었습니다');
  if (list.length > 100) throw new Error('한 번에 100개까지');
  const seen = new Set();
  return list.map((x) => {
    const n = Number(x && x.n);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`경고 번호가 틀렸습니다: ${JSON.stringify(x).slice(0, 60)}`);
    if (seen.has(n)) throw new Error(`같은 번호가 두 번: ${n}`);
    seen.add(n);
    if (!REASONS.includes(x.reason)) throw new Error(`이유는 ${REASONS.join(' · ')} 중 하나: ${n}`);
    const comment = String(x.comment || '').replace(/[\t\r\n]+/g, ' ').trim();
    if (!comment || comment.length > 280) throw new Error(`이유 글은 1~280자: ${n}`);
    return { n, reason: x.reason, comment };
  });
}

export function main(argv = process.argv.slice(2)) {
  const [cmd, a, b] = argv;
  if (cmd === 'slim') { const s = slim(parseAlerts(fs.readFileSync(a, 'utf8'))); fs.writeFileSync(b, JSON.stringify(s)); console.log(`열린 경고 ${s.length}개를 줄였습니다(내용은 잠가서만 싣는다)`); return 0; }
  if (cmd === 'plan') { for (const p of plan(a)) console.log(`${p.n}\t${p.reason}\t${p.comment}`); return 0; }
  console.error('쓰기: slim <alerts.json> <out.json> | plan <JSON>'); return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main()); } catch (e) { console.error(`::error::${e.message}`); process.exit(1); }
}
