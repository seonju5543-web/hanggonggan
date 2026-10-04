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

   다시 선 로봇의 넘어짐 경보 닫기 (2026-10-04 로봇·도구 점검 · 묶음 alerts)
     `.github/actions/robot-down` 은 열기·댓글만 하고 닫는 길이 없었다 — 22분 뒤 같은 로봇이 성공했는데도
     「🚨 로봇이 넘어졌어요」(#386)가 열린 채 남았다. 워크플로 아홉 곳마다 '성공하면 닫기' 단계를 붙이는 대신
     여기서 한 번에 본다: 워크플로 파일에서 robot-down 의 robot 이름을 읽고(robotNamesOf), 그 워크플로의
     마지막 성공 실행이 **경보를 낸 실행보다 뒤에 시작됐을 때만** 닫는다(robotDownVerdicts).
     🔴 못 읽음을 괜찮음으로 읽지 않는다 — 성공 기록·댓글을 못 읽으면 닫지 않는다.

   실행:  node collector/robot-heartbeat.mjs            (사람이 눈으로)
          node collector/robot-heartbeat.mjs --json     (워크플로가 읽는 형태)
          node collector/robot-heartbeat.mjs --close-recovered   (다시 선 로봇의 넘어짐 경보를 닫는다)
   필요:  GH_TOKEN(또는 GITHUB_TOKEN) · GITHUB_REPOSITORY. 없으면 계산만 하고 조회는 건너뛴다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { restClient, kstStamp } from '../tools/alert-issue.mjs';

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
  /* runId·startedAt 은 넘어짐 경보 닫기(--close-recovered)가 쓴다 — 경보를 낸 실행보다 뒤에 시작한 성공인가 */
  return run ? { at: run.updated_at || run.created_at, runId: run.id || null, startedAt: run.run_started_at || run.created_at || null } : { at: null };
}

/* 🔴 **경보 전에 한 번 더 다른 길로 묻는다** (2026-09-30).
   2026-09-28 하트비트가 배포 동기화를 「마지막 성공 175.7시간 전」으로 올렸는데, 그 주에도
   하루 15~18번씩 전부 성공해 있었다(틀린 경보 — 이슈 #316). 위 질문(`status=success` 거르기)이
   그때 옛 실행을 돌려준 것으로 보이나, 다음 날부터는 재현되지 않아 원인은 **확인하지 못했다.**
   그래서 원인을 짐작해 고치지 않고, 경보를 올리기 **직전에만** 거르기 없이 최근 실행 목록을
   받아 가장 늦은 성공을 직접 찾는다. 둘 중 **늦은 쪽**을 쓴다 — 한쪽이 옛 답을 줘도 경보가 서지 않고,
   정말 조용하면 두 길 모두 옛 시각이라 경보는 그대로 선다. */
export function latestSuccessIso(runs) {
  let best = null;
  for (const r of runs || []) {
    if (r.conclusion !== 'success') continue;
    const at = r.updated_at || r.created_at;
    if (at && (!best || Date.parse(at) > Date.parse(best))) best = at;
  }
  return best;
}
export function newerIso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}
async function recentSuccessAt(repo, file, token) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?per_page=100`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return null;                          // 못 읽으면 첫 답을 그대로 쓴다
  return latestSuccessIso((await r.json()).workflow_runs);
}

export function isStale(everyHours, lastIso, nowMs) {
  if (everyHours == null) return false;
  if (!lastIso) return true;                       // 성공 기록이 아예 없다
  const age = (nowMs - Date.parse(lastIso)) / 3600000;
  return age > everyHours * STALE_FACTOR;
}

/* ── 다시 선 로봇의 넘어짐 경보 닫기 ───────────────────────────────── */
export const ROBOT_DOWN_PREFIX = '🚨 로봇이 넘어졌어요 — ';

/** 워크플로 글에서 `uses: ./.github/actions/robot-down` 단계의 `robot:` 이름들 (주석 줄은 안 본다) */
export function robotNamesOf(yml) {
  const lines = String(yml).replace(/\r/g, '').split('\n');
  const names = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*#/.test(lines[i]) || !/uses:\s*\.\/\.github\/actions\/robot-down\b/.test(lines[i])) continue;
    /* 단계의 처음(`- `)을 거슬러 찾고, 다음 단계(같은 들여쓰기의 `- `)나 더 얕은 줄이 나올 때까지 robot: 을 본다 */
    let start = i;
    while (start > 0 && !/^\s*- /.test(lines[start])) start -= 1;
    const indent = (/^(\s*)- /.exec(lines[start]) || [, ''])[1].length;
    for (let j = start; j < lines.length; j += 1) {
      const l = lines[j];
      if (/^\s*#/.test(l)) continue;
      if (j > start && l.trim()) {
        const lead = l.length - l.trimStart().length;
        if (lead < indent || (lead === indent && /^\s*- /.test(l))) break;
      }
      const m = /^\s*robot:\s*(.+?)\s*$/.exec(l);
      if (m) { names.push(m[1].replace(/^(['"])(.*)\1$/, '$2')); break; }
    }
  }
  return names;
}

/** 글 속의 마지막 실행 번호(…/actions/runs/123) — 경보 댓글이 어느 실행에서 왔는가 */
export function lastRunIdIn(text) {
  const all = [...String(text || '').matchAll(/\/actions\/runs\/(\d+)/g)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

/** 열린 넘어짐 경보마다 닫을지(close) 둘지(keep) 정한다 (순수 함수)
    issues: [{ number, title, createdAt, lastBotCommentAt?, lastAlertRunId? }]
    okByRobot: { 로봇 이름: { runId, startedAt } | null }  — 그 로봇 워크플로의 마지막 성공 실행 (못 읽으면 null)
    닫는 조건(둘 중 하나): ① 성공 실행 번호가 경보를 낸 실행 번호보다 크다(뒤에 시작된 실행)
                          ② 성공 실행이 시작한 시각이 마지막 경보(이슈 생성·봇 댓글 중 늦은 것)보다 늦다
    🔴 경보를 낸 바로 그 실행이 초록으로 끝난 경우(단계 실패를 continue-on-error 로 넘김)는 닫지 않는다 —
       번호가 같고 시작이 경보보다 앞이다. 성공 뒤에 다시 넘어져 봇 댓글이 달렸으면 그 댓글이 기준이다. */
export function robotDownVerdicts(issues, okByRobot = {}) {
  const out = [];
  for (const i of issues || []) {
    const title = String((i && i.title) || '');
    if (!title.startsWith(ROBOT_DOWN_PREFIX)) continue;
    const robot = title.slice(ROBOT_DOWN_PREFIX.length).trim();
    const ok = okByRobot[robot];
    const alertAt = Math.max(Date.parse(i.createdAt) || 0, Date.parse(i.lastBotCommentAt) || 0);
    if (!ok || (!ok.runId && !ok.startedAt)) { out.push({ number: i.number, robot, verdict: 'keep', why: '마지막 성공을 못 읽음' }); continue; }
    if (!alertAt) { out.push({ number: i.number, robot, verdict: 'keep', why: '경보 시각을 못 읽음' }); continue; }
    const byRun = !!(ok.runId && i.lastAlertRunId && Number(ok.runId) > Number(i.lastAlertRunId));
    const byTime = !!(ok.startedAt && Date.parse(ok.startedAt) > alertAt);
    out.push(byRun || byTime
      ? { number: i.number, robot, verdict: 'close', why: byRun ? '경보 뒤에 시작한 실행이 성공' : '경보 뒤에 시작해 성공', ok }
      : { number: i.number, robot, verdict: 'keep', why: '경보 뒤 성공이 아직 없음' });
  }
  return out;
}

export function robotFilesByName(dir = WF_DIR) {
  const by = {};
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
    for (const name of robotNamesOf(fs.readFileSync(path.join(dir, f), 'utf8'))) (by[name] ||= []).push(f);
  }
  return by;
}

async function closeRecovered(repo, token) {
  if (!repo || !token) { console.log('GH_TOKEN·GITHUB_REPOSITORY 가 없어 넘어짐 경보를 보지 않았습니다.'); return; }
  const api = restClient({ repo, token });
  const downs = (await api.openIssues()).filter((i) => String(i.title || '').startsWith(ROBOT_DOWN_PREFIX));
  if (!downs.length) { console.log('열린 넘어짐 경보가 없습니다.'); return; }
  const files = robotFilesByName();
  const okByRobot = {};
  for (const robot of new Set(downs.map((i) => String(i.title).slice(ROBOT_DOWN_PREFIX.length).trim()))) {
    const fl = files[robot];
    if (!fl || !fl.length) { okByRobot[robot] = null; continue; }   // 워크플로에서 그 이름을 못 찾음 — 모름
    /* 같은 이름이 여러 파일에 있으면 **가장 오래된 성공**으로 — 어느 파일이 넘어졌는지 모르므로 보수적으로 */
    const got = [];
    for (const f of fl) got.push(await lastSuccessAt(repo, f, token).catch((e) => ({ error: e.message })));
    okByRobot[robot] = got.some((g) => g.error || !g.runId) ? null : {
      runId: Math.min(...got.map((g) => Number(g.runId))),
      startedAt: got.map((g) => g.startedAt).filter(Boolean).sort()[0] || null,
    };
  }
  const issues = [];
  for (const i of downs) {
    try {
      const bots = (await api.comments(i.number)).filter((c) => c.user && c.user.type === 'Bot');
      const last = bots[bots.length - 1];
      issues.push({ number: i.number, title: i.title, createdAt: i.created_at, lastBotCommentAt: last ? last.created_at : null, lastAlertRunId: lastRunIdIn(last ? last.body : i.body) });
    } catch (e) { console.log(`· #${i.number} 댓글을 못 읽어 그대로 둡니다 — ${e.message}`); }
  }
  for (const v of robotDownVerdicts(issues, okByRobot)) {
    if (v.verdict !== 'close') { console.log(`· 그대로 둠 #${v.number} ${v.robot} — ${v.why}`); continue; }
    const runUrl = `https://github.com/${repo}/actions/runs/${v.ok.runId}`;
    try {
      await api.close(v.number, `✅ ${kstStamp()} KST — **${v.robot}** 이 다시 끝까지 돌았습니다(${v.why} · ${runUrl}). 넘어짐 경보를 닫습니다. 다시 넘어지면 새로 알립니다. (로봇 하트비트 · 자동)`, 'completed');
      console.log(`✅ 닫음 #${v.number} ${v.robot}`);
    } catch (e) { console.log(`· #${v.number} 를 닫지 못했습니다 — ${e.message}`); }
  }
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (process.argv.includes('--close-recovered')) { await closeRecovered(repo, token); return; }
  const asJson = process.argv.includes('--json');
  const now = Date.now();
  const rows = [];

  for (const w of scheduledWorkflows()) {
    let last = { at: null, error: '조회 안 함' };
    if (repo && token) {
      last = await lastSuccessAt(repo, w.file, token);
      /* 경보감일 때만 두 번째 길로 확인한다 — 스무 대 전부 두 번 물을 필요는 없다 */
      if (!last.error && isStale(w.everyHours, last.at, now)) {
        last = { at: newerIso(last.at, await recentSuccessAt(repo, w.file, token)) };
      }
    }
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
