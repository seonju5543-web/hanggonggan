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

/* cron 다섯 칸에서 '몇 시간에 한 번 도는가'를 읽는다.

   🔴 **요일 칸이 적혔다고 무조건 주 1회로 보면 안 된다** (2026-09-13 수리).
      옛 판은 요일이 `*` 가 아니기만 하면 168시간으로 봤다. 그래서 한국장학재단
      수확(`53 20 * * 1,4` — 월·목 **주 2회**)이 7일에 1회로 읽혀 경보 문턱이
      **21일**이었다. 21일이면 층2 90곳 중 72곳이 이미 마감이라(실측), 로봇이
      멈춰도 목록이 거의 빈 뒤에야 알림이 온다. 같은 자리에서 인스타 댓글 로봇
      (시각 칸이 「슬래시 3」 — 세 시간마다)도 '하루 1회'로 읽히고 있었다.
      → 칸에 **실제로 적힌 개수**를 센다.

   ⚠️ 달(4번째 칸)이 지정된 줄은 판정하지 않는다(null) — '1년에 한 번' 같은 것을
      주 단위로 환산하면 뜻이 없다. null 은 '조용한 것'이 아니라 '판정 안 함'이다. */
const SIZE = { min: 60, hour: 24, dom: 31, mon: 12, dow: 7 };

/** cron 한 칸이 **몇 번**을 뜻하는지 센다 — `*`(전부) · `1,4`(둘) · `1-5`(범위) ·
    「별 슬래시 3」(건너뛰기) 네 꼴을 읽는다 */
export function countField(f, kind) {
  const size = SIZE[kind];
  return String(f).split(',').reduce((n, part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0) return n + 1;
    if (range === '*') return n + Math.ceil(size / step);
    const m = range.match(/^(\d+)-(\d+)$/);
    if (m) return n + Math.floor((Number(m[2]) - Number(m[1])) / step) + 1;
    return n + 1;
  }, 0);
}

/** cron 한 줄이 **주당 몇 번** 도는가 (판정할 수 없으면 null) */
export function runsPerWeek(cron) {
  const [mi, ho, dom, mon, dow] = cron.trim().split(/\s+/);
  if (mon == null || mon !== '*') return null;   // 특정 달만 도는 로봇 — 판정하지 않는다
  const perDay = countField(mi, 'min') * countField(ho, 'hour');
  let days;
  if (dow === '*' && dom === '*') days = 7;
  else if (dow !== '*' && dom === '*') days = countField(dow, 'dow');
  else if (dow === '*' && dom !== '*') days = (7 * countField(dom, 'dom')) / 30.44;
  /* 표준 cron 은 요일·날짜가 둘 다 적히면 **둘 중 하나라도 맞으면** 돈다(합집합).
     지금 저장소엔 그런 줄이 없지만, 생기면 적게 세어 문턱을 넓히는 쪽이 위험하다. */
  else days = Math.min(7, countField(dow, 'dow') + (7 * countField(dom, 'dom')) / 30.44);
  return perDay * days;
}

export function hoursFor(cronLines) {
  if (!cronLines.length) return null;
  let total = 0;
  for (const c of cronLines) {
    const r = runsPerWeek(c);
    if (r == null) return null;
    total += r;
  }
  return total > 0 ? (24 * 7) / total : null;
}

/** 사람이 읽는 간격 문구 — 84시간을 '4일에 1회'라고 적으면 뜻이 어긋난다 */
export function everyWords(h) {
  if (h == null) return '판정 안 함';
  if (h <= 24) return `하루 ${Math.round(24 / h)}회`;
  if (h < 24 * 7) return `주 ${Math.round((24 * 7) / h)}회`;
  return `${Math.round(h / 24)}일에 1회`;
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
    const every = everyWords(r.everyHours);
    const age = r.error ? r.error : (r.ageHours == null ? '성공 기록 없음' : `${r.ageHours}시간 전`);
    console.log(`${mark} ${r.name.padEnd(24)} ${every.padEnd(10)} 마지막 성공 ${age}`);
  }
  if (stale.length) {
    console.log(`\n🚨 너무 오래 조용한 로봇 ${stale.length}대 — 예약이 걸러졌거나 멈춰 있습니다.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && process.argv[1].endsWith('robot-heartbeat.mjs')) await main();
