/* ============================================================
   앱 오류 급증 감시 (2026-11-13 · 은서 · 출시 전 백엔드 11번)
   ------------------------------------------------------------
   학생 폰의 앱 오류는 Supabase client_errors 에 모이기만 하고 아무도 숫자를 안 봤다.
   개수만 주는 함수(supabase/migrations/0006_client_error_stats.sql · client_error_stats)를 공개 열쇠로 불러 판정한다.
   판정(verdictOf · 순수 함수):
     spike — 1시간 60건 이상 · 또는 하루 300건 이상이면서 지난 1주 하루 평균의 3배 이상 · 또는 하루 상한(3,000)의 90% 이상(넘으면 표가 거절해 숫자가 멈춘다)
     ok    — 그 밖
     setup — 함수가 없다(404) → SQL 을 실행해야 한다(그전까지 감시가 숫자를 못 읽는다 — 조용히 두지 않고 경보)
     off   — 로그인·오류 수집이 꺼져 있다(supabase-config.js) → 볼 것이 없다
     unknown — 서버가 답하지 않는다(세 번 물은 뒤) → 실패로 끝낸다(넘어짐 알림 · 로그인 서버 자체는 supabase-health 가 본다)
   🔴 경보·요약에는 **개수만** 적는다(공개 저장소 · 오류 문구는 대시보드에서만 본다).
   쓰기: node tools/error-watch.mjs --body <파일>   → GITHUB_OUTPUT verdict=…
   워크플로: .github/workflows/error-watch.yml · 관문: verify/health-gates/ops.mjs 「⑨ 앱 오류 급증 감시」
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readSupabaseConfig, readErrorReport } from './supabase-health.mjs';

export const RULES = { hour: 60, dayMin: 300, dayRatio: 3, avgFloor: 20, cap: 3000, capRatio: 0.9 };

export function verdictOf(r) {
  if (!r || r.state === 'off') return { verdict: 'off', why: '' };
  if (r.state === 'missing') return { verdict: 'setup', why: '개수 함수(client_error_stats)가 없습니다 — Supabase SQL Editor 에서 supabase/migrations/0006_client_error_stats.sql 을 실행하세요' };
  if (r.state !== 'ok' || !r.stats) return { verdict: 'unknown', why: r.why || '서버가 답하지 않았습니다' };
  const s = r.stats; const h = Number(s.last_hour) || 0; const d = Number(s.last_day) || 0;
  const avg = Number(s.prev_week_daily_avg) || 0; const cap = Number(s.day_cap) || RULES.cap;
  const why = [];
  if (h >= RULES.hour) why.push(`최근 1시간 ${h}건(기준 ${RULES.hour})`);
  if (d >= RULES.dayMin && d >= RULES.dayRatio * Math.max(avg, RULES.avgFloor)) why.push(`최근 하루 ${d}건 — 지난주 하루 평균 ${avg}건의 ${RULES.dayRatio}배 이상`);
  if (d >= cap * RULES.capRatio) why.push(`하루 상한 ${cap}건에 거의 닿음(${d}건) — 넘으면 더는 안 모인다`);
  return { verdict: why.length ? 'spike' : 'ok', why: why.join(' · ') };
}

export async function fetchStats(cfg, { fetchImpl = fetch, tries = 3, sleep = (ms) => new Promise((res) => setTimeout(res, ms)) } = {}) {
  let last = { state: 'down', why: '' };
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetchImpl(`${cfg.url}/rest/v1/rpc/client_error_stats`, {
        method: 'POST', headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(20000),
      });
      if (r.status === 404) return { state: 'missing' };
      if (r.status === 200) return { state: 'ok', stats: await r.json() };
      last = { state: 'down', why: `HTTP ${r.status}` };
    } catch (e) { last = { state: 'down', why: String((e && e.message) || e) }; }
    if (i < tries - 1) await sleep(10000 * (i + 1));
  }
  return last;
}

export function bodyOf(v, stats) {
  const s = stats || {};
  return [
    v.verdict === 'spike' ? `🚨 **학생 폰에서 앱 오류가 갑자기 늘었습니다** — ${v.why}` : `⚠️ ${v.why}`, '',
    stats ? `| 최근 1시간 | 최근 하루 | 지난주 하루 평균 | 오늘 오류 종류 |\n| --- | --- | --- | --- |\n| ${s.last_hour} | ${s.last_day} | ${s.prev_week_daily_avg} | ${s.kinds_day} |` : '', '',
    '오류 문구는 공개 저장소라 여기 적지 않습니다 → Supabase 대시보드 › Table Editor › client_errors 에서 최근 것부터 보세요.',
    '방금 나간 작업이 원인 같으면: Actions › 「직전 판으로 되돌리기」 (docs/backend/되돌리기-사용법.md) · 또는 Claude 세션에 "앱 오류 늘어난 것 봐줘".',
  ].join('\n');
}

export async function main(argv = process.argv.slice(2), env = process.env, { fetchImpl = fetch, src = null } = {}) {
  const text = src != null ? src : fs.readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
  const cfg = readSupabaseConfig(text);
  const r = (!cfg || !readErrorReport(text)) ? { state: 'off' } : await fetchStats(cfg, { fetchImpl });
  const v = verdictOf(r);
  console.log(`판정: ${v.verdict}${v.why ? ` — ${v.why}` : ''}${r.stats ? ` · 1시간 ${r.stats.last_hour} · 하루 ${r.stats.last_day} · 지난주 평균 ${r.stats.prev_week_daily_avg}` : ''}`);
  const i = argv.indexOf('--body');
  if (i >= 0 && argv[i + 1]) fs.writeFileSync(argv[i + 1], `${bodyOf(v, r.stats)}\n`);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `verdict=${v.verdict}\n`);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${v.verdict === 'ok' ? `✅ 앱 오류 평소 수준${r.stats ? ` (1시간 ${r.stats.last_hour} · 하루 ${r.stats.last_day})` : ''}` : bodyOf(v, r.stats)}\n`);
  return v.verdict === 'unknown' ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c), (e) => { console.error(`::error::앱 오류 감시가 넘어졌습니다 — ${e.message}`); process.exit(1); });
}
