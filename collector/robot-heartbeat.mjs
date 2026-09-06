/* ============================================================
   로봇 하트비트 — "아예 안 돈 것"을 잡는 두 번째 겹 (2026-09-06 신설)
   ------------------------------------------------------------
   왜 필요한가
     `failure() || cancelled()` 는 **로봇이 시작한 뒤**에만 작동한다. 시작조차 안 한 것은
     실행 기록이 없어 붙을 자리가 없다. 그런데 GitHub 은 예약을 실제로 미루거나 거른다 —
     2026-07-05 +3h44m 지연, **2026-07-06 완전 누락**(CLAUDE.md '예약 실행 혼잡 회피 정책').
     그날은 관리자 화면 잠금 확인이 아예 안 된 건데 아무 흔적도 안 남았다.

   무엇을 하나
     워크플로 파일에서 예약(cron)을 읽어 **기대 간격**을 스스로 계산하고,
     GitHub API 로 그 워크플로의 **마지막 성공 시각**을 물어, 너무 오래됐으면 올린다.
     설정 파일을 따로 두지 않는 이유: 예약을 고치면 설정이 낡는데 아무도 안 고친다.

   🔴 문턱을 기대 간격의 **3배**로 잡는다
     GitHub 이 몇 시간 미루는 것은 정상이다. 2배로 잡으면 헛알림이 난다.

   같은 계열: collector/health.json 이 학교별 `lastOk` 로 하는 일과 똑같다.

   실행:  node collector/robot-heartbeat.mjs            (사람이 눈으로)
          node collector/robot-heartbeat.mjs --json     (워크플로가 읽는 형태)
   필요:  GH_TOKEN(또는 GITHUB_TOKEN) · GITHUB_REPOSITORY. 없으면 계산만 하고 조회는 건너뛴다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WF_DIR = path.join(HERE, '..', '.github', 'workflows');
export const STALE_FACTOR = 3;

/* cron 다섯 칸에서 '며칠에 한 번인가'를 읽는다.
   요일 칸이 지정돼 있으면 주 1회로 본다(월요일만 도는 로봇이 그렇다). */
export function hoursFor(cronLines) {
  if (!cronLines.length) return null;
  const weekly = cronLines.some((c) => {
    const dow = c.trim().split(/\s+/)[4];
    return dow && dow !== '*';
  });
  if (weekly) return 24 * 7;
  return 24 / cronLines.length;          // 하루 n회 → 24/n 시간
}

/* 워크플로 파일에서 예약 줄만 뽑는다 — 주석(#로 시작하는 줄)은 세지 않는다 */
export function cronsOf(text) {
  return text.split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.match(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/))
    .filter(Boolean)
    .map((m) => m[1]);
}

export function scheduledWorkflows(dir = WF_DIR) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      const crons = cronsOf(text);
      const name = (text.match(/^name:\s*(.+)$/m) || [])[1] || f;
      return { file: f, name: name.trim(), crons, everyHours: hoursFor(crons) };
    })
    .filter((w) => w.crons.length);
}

async function lastSuccessAt(repo, file, token) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${file}/runs`
    + '?status=success&per_page=1';
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return { error: `${r.status}` };
  const j = await r.json();
  const run = (j.workflow_runs || [])[0];
  return run ? { at: run.updated_at || run.created_at } : { at: null };
}

export function isStale(everyHours, lastIso, nowMs) {
  if (everyHours == null) return false;
  if (!lastIso) return true;                       // 성공 기록이 아예 없다
  const age = (nowMs - Date.parse(lastIso)) / 3600000;
  return age > everyHours * STALE_FACTOR;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const asJson = process.argv.includes('--json');
  const now = Date.now();
  const rows = [];

  for (const w of scheduledWorkflows()) {
    let last = { at: null, error: '조회 안 함' };
    if (repo && token) last = await lastSuccessAt(repo, w.file, token);
    const ageH = last.at ? Math.round((now - Date.parse(last.at)) / 360000) / 10 : null;
    rows.push({
      file: w.file, name: w.name,
      everyHours: w.everyHours,
      lastOk: last.at || null, ageHours: ageH,
      error: last.error || null,
      /* 조회에 실패한 것은 '멈췄다'고 단정하지 않는다 — 못 읽은 것과 없는 것은 다르다
         (이 저장소의 '못 읽음을 사실로 단정하지 말 것' 원칙). */
      stale: last.error ? false : isStale(w.everyHours, last.at, now),
    });
  }

  const stale = rows.filter((r) => r.stale);
  if (asJson) { console.log(JSON.stringify({ rows, stale }, null, 1)); return; }

  console.log(`예약 로봇 ${rows.length}대 · 문턱 = 기대 간격 × ${STALE_FACTOR}`);
  for (const r of rows.sort((a, b) => (b.ageHours || 1e9) - (a.ageHours || 1e9))) {
    const mark = r.stale ? '🚨' : (r.error ? '· ' : '✓ ');
    const every = r.everyHours >= 24 ? `${Math.round(r.everyHours / 24)}일에 1회` : `하루 ${Math.round(24 / r.everyHours)}회`;
    const age = r.error ? r.error : (r.ageHours == null ? '성공 기록 없음' : `${r.ageHours}시간 전`);
    console.log(`${mark} ${r.name.padEnd(24)} ${every.padEnd(10)} 마지막 성공 ${age}`);
  }
  if (stale.length) {
    console.log(`\n🚨 너무 오래 조용한 로봇 ${stale.length}대 — 예약이 걸러졌거나 멈춰 있습니다.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('robot-heartbeat.mjs')) await main();
