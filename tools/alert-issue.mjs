/* ============================================================
   경보 이슈 한 곳 — 로봇 경보를 이슈 **하나**에 모으고, 풀리면 닫는다 (2026-10-04 로봇·도구 점검 · 묶음 alerts)
   ------------------------------------------------------------
   왜 만들었나
     워크플로마다 '열린 이슈 찾기 → 있으면 댓글 · 없으면 만들기'를 셸로 따로 적었다. 그 사이 구멍이 셋 생겼다.
       ① 같은 초에 두 실행이 둘 다 '없음'을 보고 이슈를 둘 만들었다(#389·#390 — 화면 검사 · 기본 브랜치와 main).
       ② 없는 라벨로 `gh issue create --label X` 를 부르면 gh 가 실패해 라벨 없는 이슈가 새로 쌓이거나(🔧 링크 사냥꾼 25건),
          `|| true` 뒤에서 **이슈가 아예 안 만들어졌다**(🚨 공고 누락 감사 실패).
       ③ 여는 길만 있고 닫는 길이 없어 회복한 뒤에도 경보가 열려 있었다(#350·#356·#386).
   하는 일
     open    — 제목이 같은(prefix 면 그 글자로 시작하는) 열린 이슈 가운데 번호가 가장 작은 것에 댓글.
               없으면 하나 만들고, 3초 뒤 다시 보아 같은 경보가 둘 이상이면 큰 번호를 닫는다(같은 초 경합 정리).
     resolve — 제목이 맞는 열린 이슈를 전부 닫는다(회복).
   🔴 찾을 때는 **라벨이 아니라 제목**으로 찾는다 — 라벨 없이 쌓인 옛 이슈도 잡히고, 같은 라벨을 쓰는 다른 로봇의
      경보와 섞이지 않는다. 라벨은 만들 때 붙이기만 한다(없으면 먼저 만든다 — REST 는 없는 라벨도 붙지만 색·설명을 맞춘다).
      ⚠️ 옛 판의 '제목 검색은 이모지·한글에서 놓친다(2026-07-31)'는 GitHub **검색**(`--search … in:title`) 이야기다.
         여기서는 검색을 쓰지 않고 열린 이슈 목록을 받아 글자를 직접 비교한다.
   🔴 순수 함수(planAlert)는 표본으로 잰다 — 관문 verify/health-gates/alerts.mjs ①.
   실행:  node tools/alert-issue.mjs --mode open|resolve --title "…" [--match exact|prefix] [--label X]
            [--label-color B60205] [--label-description "…"] [--body "…" | --body-file 파일] [--assignee 계정 …]
          (값은 ALERT_MODE · ALERT_TITLE · ALERT_MATCH · ALERT_LABEL · ALERT_LABEL_COLOR · ALERT_LABEL_DESCRIPTION ·
           ALERT_BODY · ALERT_BODY_FILE · ALERT_ASSIGNEE 환경 변수로도 받는다 — 공용 액션 .github/actions/alert-issue 가 그 길로 넘긴다)
   필요:  GH_TOKEN(또는 GITHUB_TOKEN) · GITHUB_REPOSITORY. 없으면 실패(종료 1)로 끝난다 — 부른 쪽이 옛 길로 물러날 수 있게.
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const BODY_LIMIT = 60000;   // 이슈 본문 한도는 65,536자 — 여유를 둔다

/** 제목이 경보 열쇠와 맞는가 — exact 는 글자 그대로(앞뒤 빈칸만 무시), prefix 는 그 글자로 시작 */
export function titleMatches(title, key, match = 'exact') {
  const t = String(title ?? '').trim();
  const k = String(key ?? '').trim();
  if (!k) return false;
  return match === 'prefix' ? t.startsWith(k) : t === k;
}

/** 무엇을 할지 정한다 (순수 함수) — openIssues: [{ number, title, pull_request? }]
    → { comment: 번호|null, create: bool, close: [번호…] } */
export function planAlert({ mode = 'open', title, match = 'exact' } = {}, openIssues = []) {
  if (!String(title ?? '').trim()) throw new Error('경보 제목(title)이 비었습니다');
  if (!['exact', 'prefix'].includes(match)) throw new Error(`모르는 match: ${match}`);
  const hits = (openIssues || [])
    .filter((i) => i && !i.pull_request && (i.state == null || i.state === 'open') && titleMatches(i.title, title, match))
    .map((i) => Number(i.number))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const uniq = [...new Set(hits)];
  if (mode === 'resolve') return { comment: null, create: false, close: uniq };
  if (mode !== 'open') throw new Error(`모르는 mode: ${mode}`);
  if (!uniq.length) return { comment: null, create: true, close: [] };
  return { comment: uniq[0], create: false, close: uniq.slice(1) };
}

export const kstStamp = (ms = Date.now()) => new Date(ms + 9 * 36e5).toISOString().slice(0, 16).replace('T', ' ');

/** 본문이 한도를 넘으면 자른다(넘으면 GitHub 이 이슈를 거절해 경보가 통째로 사라진다) */
export function fitBody(body) {
  const b = String(body ?? '');
  if (b.length <= BODY_LIMIT) return b;
  return `${b.slice(0, BODY_LIMIT)}\n\n> ⚠️ 본문이 길어 여기서 잘렸습니다 — 전문은 실행 로그를 보세요.`;
}

/** GitHub REST — 이 도구와 하트비트(collector/robot-heartbeat.mjs --close-recovered)가 같이 쓴다 */
export function restClient({ repo, token, fetchImpl = globalThis.fetch, base = 'https://api.github.com' }) {
  if (!repo || !token) throw new Error('GITHUB_REPOSITORY 와 GH_TOKEN(또는 GITHUB_TOKEN)이 있어야 이슈를 다룰 수 있습니다');
  async function call(method, path, body) {
    const r = await fetchImpl(`${base}/repos/${repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!r.ok) {
      const e = new Error(`${method} ${path} → HTTP ${r.status}${json && json.message ? ` (${json.message})` : ''}`);
      e.status = r.status;
      throw e;
    }
    return json;
  }
  async function pages(path) {
    const out = [];
    for (let page = 1; page <= 30; page += 1) {
      const sep = path.includes('?') ? '&' : '?';
      const got = await call('GET', `${path}${sep}per_page=100&page=${page}`);
      if (!Array.isArray(got)) break;
      out.push(...got);
      if (got.length < 100) break;
    }
    return out;
  }
  return {
    call,
    /** 열린 이슈 전부(끌어오기 요청 제외) */
    openIssues: async () => (await pages('/issues?state=open')).filter((i) => !i.pull_request),
    comments: (n) => pages(`/issues/${n}/comments`),
    create: ({ title, body, labels = [], assignees = [] }) => call('POST', '/issues', { title, body, labels, assignees }),
    comment: (n, body) => call('POST', `/issues/${n}/comments`, { body }),
    close: async (n, body, reason = 'completed') => {
      if (body) await call('POST', `/issues/${n}/comments`, { body });
      return call('PATCH', `/issues/${n}`, { state: 'closed', state_reason: reason });
    },
    /** 라벨이 없으면 만든다 — 이미 있으면(422) 그대로 둔다 */
    ensureLabel: async (name, color = 'B60205', description = '') => {
      try { await call('POST', '/labels', { name, color: String(color).replace(/^#/, ''), description: String(description).slice(0, 100) }); }
      catch (e) { if (e.status !== 422) throw e; }
    },
  };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** 실제로 한다 — api 는 restClient 꼴(관문은 가짜를 넣는다). 돌려주는 것: { action, issue, closed } */
export async function runAlert(opts, api, { log = console.log, sleep = wait } = {}) {
  const { mode = 'open', title, match = 'exact', label = '', labelColor, labelDescription, assignees = [] } = opts;
  const body = fitBody(opts.body);
  const plan = planAlert({ mode, title, match }, await api.openIssues());
  const result = { action: 'none', issue: null, closed: [] };

  if (mode === 'resolve') {
    for (const n of plan.close) {
      await api.close(n, body || `✅ ${kstStamp()} KST 다시 정상입니다 — 자동으로 닫습니다.`, 'completed');
      result.closed.push(n);
      log(`닫음 #${n}`);
    }
    if (!plan.close.length) log(`닫을 경보가 없습니다 — 「${title}」`);
    result.action = plan.close.length ? 'closed' : 'none';
    return result;
  }

  const labels = label ? [label] : [];
  let keep = plan.comment;
  if (plan.comment) {
    await api.comment(plan.comment, body);
    result.action = 'commented';
    result.issue = plan.comment;
    log(`열린 경보 #${plan.comment} 에 댓글을 남겼습니다(새 이슈를 만들지 않음).`);
  } else {
    if (label) {
      try { await api.ensureLabel(label, labelColor, labelDescription); }
      catch (e) { log(`⚠️ 라벨 「${label}」을 만들지 못했습니다(이슈는 그대로 만듭니다) — ${e.message}`); }
    }
    let made;
    try { made = await api.create({ title, body, labels, assignees }); }
    catch (e) {
      if (!assignees.length) throw e;
      log(`⚠️ 담당자 지정이 막혀 담당자 없이 다시 만듭니다 — ${e.message}`);
      made = await api.create({ title, body, labels, assignees: [] });
    }
    result.action = 'created';
    result.issue = made && made.number;
    log(`새 경보 이슈 #${result.issue} 를 만들었습니다.`);
    /* 같은 초에 다른 실행도 만들었을 수 있다 — 잠깐 뒤 다시 보아 가장 작은 번호 하나만 남긴다.
       🔴 여기서 넘어져도 경보는 이미 섰다 — 실패로 끝내지 않는다(부른 쪽이 옛 길로 한 번 더 만들면 중복이 된다). */
    try {
      await sleep(3000);
      const again = planAlert({ mode: 'open', title, match }, await api.openIssues());
      keep = again.comment || result.issue;
      if (again.close.includes(result.issue) && again.comment) {
        await api.comment(again.comment, body);   // 내 본문은 남는 이슈로 옮긴다
        result.issue = again.comment;
      }
      plan.close.push(...again.close);
    } catch (e) { log(`⚠️ 중복 확인을 못 했습니다(경보는 섰습니다) — ${e.message}`); }
  }
  for (const n of [...new Set(plan.close)].filter((x) => x !== keep)) {
    try {
      await api.close(n, `같은 경보가 #${keep} 에 모입니다 — 중복이라 닫습니다. (자동)`, 'not_planned');
      result.closed.push(n);
      log(`중복 경보 #${n} 을 닫았습니다(#${keep} 에 모음).`);
    } catch (e) { log(`⚠️ 중복 #${n} 을 닫지 못했습니다 — ${e.message}`); }
  }
  return result;
}

/** 명령줄 → 설정 (인자가 우선, 없으면 ALERT_* 환경 변수) */
export function parseArgs(argv, env = process.env) {
  const o = {};
  const multi = { assignee: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    const v = m[2] != null ? m[2] : argv[i + 1];
    if (m[2] == null) i += 1;
    if (m[1] === 'assignee') multi.assignee.push(v);
    else o[m[1]] = v;
  }
  const pick = (k, e) => (o[k] != null && o[k] !== '' ? o[k] : (env[e] || ''));
  const bodyFile = pick('body-file', 'ALERT_BODY_FILE');
  /* 본문 파일을 못 읽어도 경보는 선다 — 본문을 만드는 앞 단계가 넘어진 날이 바로 알려야 하는 날이다 */
  const readBody = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return `(본문 파일 ${f} 을 읽지 못했습니다 — 실행 로그를 보세요)`; } };
  const assignees = [...multi.assignee, ...String(env.ALERT_ASSIGNEE || '').split(/[\s,]+/)]
    .map((s) => String(s || '').trim()).filter(Boolean);
  return {
    mode: pick('mode', 'ALERT_MODE') || 'open',
    title: pick('title', 'ALERT_TITLE'),
    match: pick('match', 'ALERT_MATCH') || 'exact',
    label: pick('label', 'ALERT_LABEL'),
    labelColor: pick('label-color', 'ALERT_LABEL_COLOR') || 'B60205',
    labelDescription: pick('label-description', 'ALERT_LABEL_DESCRIPTION'),
    body: bodyFile ? readBody(bodyFile) : pick('body', 'ALERT_BODY'),
    assignees: [...new Set(assignees)],
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!opts.body.trim()) {
    opts.body = opts.mode === 'resolve'
      ? `✅ ${kstStamp()} KST 다시 정상입니다 — 자동으로 닫습니다.`
      : `🚨 ${kstStamp()} KST 경보 — 본문을 만들지 못했습니다.`;
  }
  /* 실행 로그 주소가 본문에 없으면 붙인다 — 어느 실행이 알렸는지가 경보의 첫 증거다(넘어짐 경보는 하트비트가 이 번호로 회복을 판정한다) */
  const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
  if (run && !/\/actions\/runs\/\d+/.test(opts.body)) opts.body += `\n\n실행 로그: ${run}`;
  const api = restClient({ repo, token });
  const r = await runAlert(opts, api);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `action=${r.action}\nissue=${r.issue || ''}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`🚨 경보 이슈를 다루지 못했습니다 — ${e.message}`); process.exit(1); });
}
