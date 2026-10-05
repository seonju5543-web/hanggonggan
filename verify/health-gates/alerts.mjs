/* 「로봇·도구 점검 관문」 — alerts 묶음: 경보가 사람에게 닿고, 하나로 모이고, 회복하면 닫히는가 (2026-10-04)
   사고(10-04 열린 이슈 186건):
     ① 같은 초에 두 실행이 경보를 둘 만들었다(#389·#390) · 없는 라벨로 gh 가 실패해 라벨 없는 🔧 가 25건 쌓였고,
        `|| true` 뒤에서 🚨 누락 감사 실패 이슈는 **아예 안 만들어졌다**.
     ② 여는 길만 있고 닫는 길이 없어 회복 뒤에도 경보가 열려 있었다(#274·#350·#356·#386).
     ③ 실패 알림이 요약 한 줄(`$GITHUB_STEP_SUMMARY`)·`::warning` 뿐인 로봇 일곱 — 사람에게 안 닿는다.
     ④ 체크아웃 없이 로컬 액션(robot-down)을 부르는 워크플로 둘 — 넘어진 날 알림까지 넘어진다.
     ⑤ 실제 앱 반영 확인이 앱이 받는 파일 아홉을 안 봤다(404 여도 초록) · 리포트 정리가 두 종류만 닫았다.
   잰다: ① planAlert ② pickToClose ③ robotDownVerdicts ④ fetchPathsIn·check-live ⑤ closableReadyIssues
         ⑥ 전역 S1 라벨·S2 체크아웃·S3 실패가 사람에게 닿음·S4 이슈 권한 ⑦ 인스타 tee·pipefail ⑧ collect-news ⑨ verify-ui
         ⑩ open-api·device-deploy·essay ⑪ push-check·admin-lock ⑫ link-hunter·audit-coverage
   🔴 순수 함수는 표본으로만, 워크플로는 글자(코드)로 잰다 — data/·collector/ 장부는 읽지 않는다. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { stepsOf } from './ci.mjs';
import { planAlert, runAlert, titleMatches, fitBody, BODY_LIMIT } from '../../tools/alert-issue.mjs';
import { pickToClose, REPORT_RULES } from '../../tools/report-retention.mjs';
import { robotNamesOf, robotDownVerdicts, lastRunIdIn, ROBOT_DOWN_PREFIX } from '../../collector/robot-heartbeat.mjs';
import { codesIn, liveCodes, closableReadyIssues } from '../../insta/ready-issues.mjs';

const require = createRequire(import.meta.url);
const { fetchPathsIn, appScripts } = require('../../tools/app-fetch-files.cjs');

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');
/** 주석 줄을 걷어 낸 코드 — 주석 속 낱말로 통과하지 않게 */
export const codeOf = (t) => String(t).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** 워크플로의 job 들 — `jobs:` 아래 두 칸 들여쓴 이름마다 글 한 덩이 */
export function jobsOf(yml) {
  const lines = codeOf(yml).split('\n');
  const at = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (at < 0) return [];
  const jobs = [];
  for (let i = at + 1; i < lines.length; i += 1) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (m) jobs.push({ name: m[1], lines: [] });
    else if (/^\S/.test(lines[i])) break;
    else if (jobs.length) jobs[jobs.length - 1].lines.push(lines[i]);
  }
  return jobs.map((j) => ({ name: j.name, text: j.lines.join('\n') }));
}

/** S1 — `gh issue create … --label X` 인데 같은 파일에 `gh label create X` 가 없는 라벨 */
export function labelGaps(text) {
  const code = codeOf(text);
  const lines = code.split('\n');
  const resolve = (tok) => {
    const v = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?$/.exec(tok);
    if (!v) return tok;
    const a = new RegExp(`\\b${v[1]}\\s*[=:]\\s*["']?([^"'\\s]+)`).exec(code);
    return a ? a[1] : null;
  };
  const made = [...code.matchAll(/gh label create\s+("?)([^"\s]+)\1/g)].map((m) => resolve(m[2]));
  const gaps = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/gh issue create\b/.test(lines[i])) continue;
    let cmd = lines[i];
    for (let j = i; /\\\s*$/.test(lines[j]) && j + 1 < lines.length; j += 1) cmd += `\n${lines[j + 1]}`;
    for (const m of cmd.matchAll(/--label[ =]("?)([^"\s]+)\1/g)) {
      const want = resolve(m[2]);
      if (!want || !made.includes(want)) gaps.push(want || m[2]);
    }
  }
  return [...new Set(gaps)];
}

/** S2 — 체크아웃보다 앞에서 로컬 액션(./.github/actions/…)을 부르는 job */
export function actionBeforeCheckout(yml) {
  const bad = [];
  for (const j of jobsOf(yml)) {
    const local = j.text.search(/uses:\s*\.\/\.github\/actions\//);
    if (local < 0) continue;
    const co = j.text.search(/uses:\s*actions\/checkout@/);
    if (co < 0 || co > local) bad.push(j.name);
  }
  return bad;
}

const REACH = /uses:\s*\.\/\.github\/actions\/(?:robot-down|alert-issue)\b|tools\/alert-issue\.mjs|gh issue (?:create|comment)\b|issues\.(?:create|createComment)\(/;
const onFailure = (cond) => /\b(?:failure|cancelled)\(\)/.test(String(cond || '').replace(/!\s*(?:failure|cancelled)\(\)/g, ''));
/** S3 — `if:` 에 failure()·cancelled() 가 있는데 사람에게 닿지 않는 단계(같은 조건의 뒤 단계가 대신 닿으면 통과) */
export function silentFailureSteps(yml) {
  const bad = [];
  for (const j of jobsOf(yml)) {
    const steps = stepsOf(j.text);
    steps.forEach((s, k) => {
      if (!onFailure(s.if)) return;
      if (REACH.test(s.raw)) return;
      if (steps.slice(k + 1).some((t) => t.if === s.if && REACH.test(t.raw))) return;
      bad.push(`${j.name}: ${s.name || s.id || s.uses || '(이름 없음)'}`);
    });
  }
  return bad;
}

const stepNamed = (steps, re) => steps.find((s) => re.test(s.name || '')) || null;
const with_ = (s, k) => ((new RegExp(`^ {10}${k}:\\s*(.+)$`, 'm').exec((s && s.raw) || '') || [])[1] || '').trim();

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const wfDir = new URL('.github/workflows/', root);
  const wfs = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml')).sort();
  const wf = (f) => read(root, `.github/workflows/${f}`);

  /* ── ① 경보 이슈 한 곳 — planAlert (표본) ── */
  eq('① 열린 경보가 없으면 하나 만든다', planAlert({ mode: 'open', title: '🚨 X' }, []), { comment: null, create: true, close: [] });
  eq('  같은 제목이 하나면 그 이슈에 댓글', planAlert({ mode: 'open', title: '🚨 X' }, [{ number: 7, title: '🚨 X' }]), { comment: 7, create: false, close: [] });
  eq('  같은 초에 둘(#389·#390 꼴) — 작은 번호에 댓글 · 큰 번호는 닫는다',
    planAlert({ mode: 'open', title: '🚨 앱 화면 검사가 빨간불입니다', match: 'prefix' }, [
      { number: 390, title: '🚨 앱 화면 검사가 빨간불입니다 (2026-10-04 12:57 KST)' },
      { number: 389, title: '🚨 앱 화면 검사가 빨간불입니다 (2026-10-04 12:57 KST)' }]),
    { comment: 389, create: false, close: [390] });
  eq('  같은 라벨을 쓰는 **다른 로봇** 경보와 섞지 않는다(라벨이 아니라 제목으로 찾는다)',
    planAlert({ mode: 'open', title: `${ROBOT_DOWN_PREFIX}원문 링크 복구 로봇` }, [{ number: 386, title: `${ROBOT_DOWN_PREFIX}실제 앱 반영 확인`, labels: [{ name: 'robot-down' }] }]),
    { comment: null, create: true, close: [] });
  eq('  prefix — 시각이 붙은 옛 제목(#350)에 댓글 · resolve 면 닫는다 · 맞지 않는 🚨 는 안 닫는다',
    [planAlert({ mode: 'open', title: '🚨 앱 반영 점검 실패', match: 'prefix' }, [{ number: 350, title: '🚨 앱 반영 점검 실패 (2026-10-01 19:53 KST)' }, { number: 380, title: '🚨 앱 배포 동기화 실패 (2026-10-02 09:00 KST)' }]),
      planAlert({ mode: 'resolve', title: '🚨 앱 반영 점검 실패', match: 'prefix' }, [{ number: 350, title: '🚨 앱 반영 점검 실패 (2026-10-01 19:53 KST)' }, { number: 380, title: '🚨 앱 배포 동기화 실패 (2026-10-02 09:00 KST)' }])],
    [{ comment: 350, create: false, close: [] }, { comment: null, create: false, close: [350] }]);
  eq('  exact 는 글자 그대로(앞뒤 빈칸만 무시) · 끌어오기 요청은 안 센다',
    [titleMatches(' 🛰 공공 API 로봇 알림 ', '🛰 공공 API 로봇 알림'), titleMatches('🛰 공공 API 로봇 알림 (옛)', '🛰 공공 API 로봇 알림'),
      planAlert({ mode: 'resolve', title: 'T' }, [{ number: 1, title: 'T', pull_request: {} }]).close],
    [true, false, []]);
  eq('  긴 본문은 한도 안으로 자른다(넘으면 GitHub 이 거절해 경보가 사라진다)', [fitBody('x'.repeat(BODY_LIMIT + 10)).length < 65536, fitBody('짧음')], [true, '짧음']);
  {
    /* 실행부 — 가짜 저장소로 한 바퀴: 담당자 지정이 막히면 담당자 없이 다시 만든다 · 같은 초에 다른 실행이 만든 작은 번호가 있으면 내 것을 닫고 본문을 옮긴다 */
    const mk = (open, { failAssignee = false, racer = null } = {}) => {
      const log = [];
      let n = 500;
      const api = {
        openIssues: async () => open.slice(),
        create: async ({ title, assignees }) => { if (failAssignee && assignees.length) throw new Error('담당자 불가'); n += 1; open.push({ number: n, title }); if (racer) open.push(racer); log.push(`create#${n}${assignees.length ? '+담당' : ''}`); return { number: n }; },
        comment: async (k) => { log.push(`comment#${k}`); },
        close: async (k, _b, why) => { log.push(`close#${k}:${why}`); },
        ensureLabel: async () => { log.push('label'); },
      };
      return { api, log };
    };
    const a = mk([], { failAssignee: true });
    await runAlert({ mode: 'open', title: 'T', label: 'l', assignees: ['me'], body: 'b' }, a.api, { log: () => {}, sleep: async () => {} }).catch((e) => a.log.push(`넘어짐: ${e.message}`));
    eq('  실행부 — 라벨을 먼저 맞추고 · 담당자 지정이 막히면 담당자 없이 다시 만든다', a.log, ['label', 'create#501']);
    const b = mk([], { racer: { number: 499, title: 'T' } });
    const r = await runAlert({ mode: 'open', title: 'T', body: 'b' }, b.api, { log: () => {}, sleep: async () => {} });
    eq('  실행부 — 같은 초에 다른 실행이 먼저 만든 경보가 있으면 내 본문을 그쪽에 옮기고 내 것을 닫는다', [b.log, r.issue], [['create#501', 'comment#499', 'close#501:not_planned'], 499]);
    const c = mk([{ number: 350, title: '🚨 앱 반영 점검 실패 (옛)' }, { number: 384, title: '🚨 앱 반영 점검 실패 (옛2)' }]);
    await runAlert({ mode: 'resolve', title: '🚨 앱 반영 점검 실패', match: 'prefix', body: 'ok' }, c.api, { log: () => {} });
    eq('  실행부 — resolve 는 맞는 경보를 전부 닫는다(만들지 않는다)', c.log, ['close#350:completed', 'close#384:completed']);
  }
  const rd = read(root, '.github/actions/robot-down/action.yml');
  eq('  robot-down 이 경보 도구를 **제목 그대로**(exact) 부르고 · 실패하면 옛 gh 길로 물러난다 · 제목 꼴은 그대로',
    [/node "\$tool" --mode open --match exact --title "\$title"/.test(rd), /--label robot-down/.test(rd), /gh issue create --repo "\$REPO" --label robot-down/.test(rd),
      rd.includes('title="🚨 로봇이 넘어졌어요 — ${ROBOT}"'), ROBOT_DOWN_PREFIX === '🚨 로봇이 넘어졌어요 — '],
    [true, true, true, true, true]);
  const ai = read(root, '.github/actions/alert-issue/action.yml');
  eq('  공용 액션 alert-issue 는 도구 한 곳을 부르고 본문은 환경 변수로 넘긴다(셸 글자에 끼우지 않는다)',
    [/run: node "\$GITHUB_ACTION_PATH\/\.\.\/\.\.\/\.\.\/tools\/alert-issue\.mjs"/.test(ai), /ALERT_BODY: \$\{\{ inputs\.body \}\}/.test(ai), /\$\{\{ inputs\.body \}\}/.test((/run:[^\n]*/.exec(ai) || [''])[0])],
    [true, true, false]);

  /* ── ② 지난 리포트 정리 — pickToClose (표본) ── */
  const NOW = Date.parse('2026-10-20T00:00:00Z');
  const ago = (d) => new Date(NOW - d * 864e5).toISOString();
  const news = [1, 2, 3, 4, 5].map((k) => ({ number: 100 + k, title: `🗞 교내 소식 수집 리포트 2026-09-${10 + k}`, createdAt: ago(40 - k) }));
  eq('② 14일 지난 🗞 소식 리포트 다섯 — 최신 셋은 남기고 둘만', pickToClose(news, { now: NOW, days: 14 }).map((c) => c.number), [101, 102]);
  eq('  14일이 안 된 것은 하나도 안 고른다', pickToClose([1, 2, 3, 4, 5].map((k) => ({ number: k, title: '🗞 교내 소식 수집 리포트 x', createdAt: ago(k) })), { now: NOW, days: 14 }), []);
  eq('  📘 셋 — 최신 하나만 남긴다',
    pickToClose([1, 2, 3].map((k) => ({ number: 200 + k, title: `📘 작성 규칙 학습 — 2026-08-${10 + k}`, createdAt: ago(60 - k) })), { now: NOW, days: 14 }).map((c) => c.number), [201, 202]);
  const never = ['🚨 작성 규칙 학습 — 2026-08-01', '🚨 자격요건 매칭 · AI 자격 읽기 — 2026-08-01', '🔧 원문 주소를 3회 못 찾은 공고 3건', '📸 인스타 카드 준비됐습니다 — a', '🛰 공공 API 로봇 알림', '🎨 판형', `${ROBOT_DOWN_PREFIX}링크 사냥꾼`];
  eq('  🚨·🔧·📸·🛰·🎨 는 아무리 오래돼도 안 고른다(경보·사냥꾼·인스타는 각자 닫는 길이 있다)',
    pickToClose(never.flatMap((t, k) => [0, 1, 2, 3, 4].map((x) => ({ number: k * 10 + x, title: t, createdAt: ago(300) }))), { now: NOW, days: 14 }), []);
  eq('  규칙 표에 경보·사냥꾼·인스타 머리가 없다', REPORT_RULES.filter((r) => /^\^(?:🚨|🔧|📸|🛰|🎨)/.test(r.re.source)).length, 0);
  eq('  days 를 바꾸면 기준이 따라간다(🗞 다섯 · days 38 → 하나)', pickToClose(news, { now: NOW, days: 38 }).map((c) => c.number), [101]);
  eq('  유형마다 따로 센다(🤖 넷 + 🖥 넷 → 각 하나씩)',
    pickToClose([...[1, 2, 3, 4].map((k) => ({ number: k, title: '🤖 장학공고 수집 리포트 x', createdAt: ago(30 + k) })), ...[1, 2, 3, 4].map((k) => ({ number: 10 + k, title: '🖥 브라우저형 수집 리포트 x', createdAt: ago(30 + k) }))], { now: NOW, days: 14 }).map((c) => c.number), [4, 14]);
  const cor = wf('close-old-reports.yml');
  eq('  close-old-reports 가 규칙 한 곳(tools/report-retention.mjs)을 부르고 · 옛 두 종류 jq 정규식이 없다 · 목록 상한 1000',
    [/node tools\/report-retention\.mjs/.test(codeOf(cor)), /test\("\^\(🤖 장학공고 수집 리포트\|🖥 브라우저형 수집 리포트\)"\)/.test(cor), /--limit 1000/.test(codeOf(cor))],
    [true, false, true]);

  /* ── ③ 다시 선 로봇의 넘어짐 경보 닫기 — 하트비트 (표본) ── */
  const YML = [
    'jobs:', '  a:', '    steps:', '      - uses: actions/checkout@v4',
    '      - name: 🚨 로봇이 넘어졌다', '        if: failure() || cancelled()', '        uses: ./.github/actions/robot-down', '        with:', '          robot: 원문 링크 복구 로봇', '          token: ${{ github.token }}',
    '  b:', '    steps:', '      - uses: actions/checkout@v4',
    '      - name: 🚨', '        if: cancelled()', '        with:', "          robot: '검색용 요약 만들기'", '          token: x', '        uses: ./.github/actions/robot-down',
    '      #   `.github/actions/robot-down` 이 같은 이유로 라벨을 쓴다',
    '      - name: 딴 단계', '        with:', '          robot: 아님',
  ].join('\n');
  eq('③ robotNamesOf — robot-down 단계의 robot 이름 둘(with 가 uses 앞이어도 · 따옴표 걷음 · 주석·딴 단계는 안 셈)', robotNamesOf(YML), ['원문 링크 복구 로봇', '검색용 요약 만들기']);
  eq('  lastRunIdIn — 글의 마지막 실행 번호', [lastRunIdIn('a https://github.com/o/r/actions/runs/37141082198 b /actions/runs/37141332557'), lastRunIdIn('없음')], [37141332557, null]);
  const T = `${ROBOT_DOWN_PREFIX}원문 링크 복구 로봇`;
  const iss = (o) => ({ number: 386, title: T, createdAt: '2026-10-03T17:36:00Z', lastBotCommentAt: null, lastAlertRunId: 37141082198, ...o });
  const v = (o, ok) => robotDownVerdicts([iss(o)], { '원문 링크 복구 로봇': ok })[0].verdict;
  eq('  경보 17:36 → 17:40 에 시작한 실행이 17:58 성공 → 닫는다(#386)', v({}, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'close');
  eq('  성공이 경보보다 앞(17:00 시작) → 둔다', v({}, { runId: 37141000000, startedAt: '2026-10-03T17:00:00Z' }), 'keep');
  eq('  성공 뒤 17:59 에 다시 넘어진 봇 댓글 → 둔다', v({ lastBotCommentAt: '2026-10-03T17:59:00Z', lastAlertRunId: 37141399999 }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'keep');
  eq('  성공 정보를 못 읽음 → 둔다(못 읽음을 괜찮음으로 읽지 않는다)', [v({}, null), v({}, { runId: null, startedAt: null })], ['keep', 'keep']);
  eq('  경보를 낸 **바로 그 실행**이 초록으로 끝난 것(단계 실패를 넘김)은 닫지 않는다',
    v({ createdAt: '2026-10-03T17:50:00Z', lastAlertRunId: 37141332557 }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'keep');
  eq('  경보 뒤에 생긴 실행(번호가 더 큼)이 성공 — 취소된 앞 실행의 헛경보도 닫는다', v({ createdAt: '2026-10-03T17:41:00Z' }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'close');
  eq('  넘어짐 경보가 아닌 이슈는 판정하지 않는다', robotDownVerdicts([{ number: 1, title: '🚨 앱 반영 점검 실패', createdAt: '2026-10-01T00:00:00Z' }], {}), []);
  const hbYml = wf('robot-heartbeat.yml');
  const closeStep = stepsOf(hbYml).find((s) => /--close-recovered/.test(s.run || ''));
  eq('  하트비트 워크플로가 닫기 단계를 돌린다(보강 — 시한 · 실패해도 판정은 그대로)', closeStep ? [closeStep['timeout-minutes'], closeStep['continue-on-error']] : null, ['2', 'true']);
  eq('  robot-down 을 쓰는 워크플로가 실제로 있고 이름을 읽어 낸다(헛도는 검사가 아니다)',
    wfs.filter((f) => robotNamesOf(wf(f)).length).length >= 8, true);

  /* ── ④ 실제 앱 반영 확인 — 앱이 받는 파일 · 다시 보기 · 경보 짝 ── */
  eq('④ fetchPathsIn — 글자 그대로인 상대 경로만(getDoc 포함 · 변수·템플릿·바깥 주소 제외)',
    fetchPathsIn("fetch('data/a.json',{}) getDoc('data/b.json') fetch(u) fetch(`x${y}`) fetch('https://x/y.json') fetch(\"./c.json?v=1\") fetch('data/a.json')"),
    ['c.json', 'data/a.json', 'data/b.json']);
  eq('  appScripts — index.html 이 싣는 우리 스크립트(바깥 주소 제외)', appScripts('<script src="boot.js"></script><script defer src="https://cdn.x/y.js"></script><script src="./app.js?v=2">'), ['boot.js', 'app.js']);
  const live = wf('check-live.yml');
  const liveSteps = stepsOf(live);
  const chk = liveSteps.find((s) => s.id === 'check') || {};
  eq('  check-live 가 앱 스크립트에서 목록을 뽑고(손 목록 금지) 지문으로 대조한다',
    [/require\('\.\/tools\/app-fetch-files\.cjs'\)/.test(chk.run || ''), /for \(const f of appFiles\) rows\.push\(\[[^\]]*hash\(f\), hash\('live\/' \+ f\)\]\)/.test(chk.run || ''), /const hash = \(p\) =>/.test(chk.run || '')],
    [true, true, true]);
  eq('  어긋나면 3분 뒤 main 을 다시 받아 한 번 더 본다(Pages 배포 중 헛경보)',
    [/sleep 180/.test(chk.run || ''), /git fetch -q origin main && git checkout -q --detach FETCH_HEAD/.test(chk.run || ''), /for try in 1 2/.test(chk.run || '')], [true, true, true]);
  const liveAlarm = liveSteps.find((s) => s.name === '🚨 어긋남 알림') || {};
  const liveOk = liveSteps.find((s) => /alert-issue/.test(s.uses || '') && with_(s, 'mode') === 'resolve') || {};
  eq('  어긋남은 경보 한 곳(prefix · live-check) · 같아지면 닫는다 · 맨몸 gh issue create 없음',
    [/alert-issue/.test(liveAlarm.uses || ''), with_(liveAlarm, 'match'), with_(liveAlarm, 'title'), with_(liveAlarm, 'label'), liveOk.if, with_(liveOk, 'title'), /gh issue create/.test(liveAlarm.raw || '')],
    [true, 'prefix', '🚨 앱 반영 점검 실패', 'live-check', "steps.check.outputs.bad == '0'", '🚨 앱 반영 점검 실패', false]);

  /* ── ⑤ 인스타 준비 이슈 — 살아 있는 카드가 없으면 닫는다 (표본) ── */
  const seen = { prepared: [
    { code: 'A', status: 'prepared', due: '2026-09-16' }, { code: 'B', status: 'prepared', due: '2026-12-31' },
    { code: 'C', status: 'skipped', due: '2026-12-31' }, { code: 'D', status: 'prepared', due: '2026-09-18' }, { code: 'F', status: 'prepared', due: '' }],
  posted: [{ code: 'E' }] };
  const body = (...cs) => cs.map((c) => `## x\n<!-- insta-code: ${c} -->`).join('\n');
  eq('⑤ codesIn — 본문의 카드 표식', codesIn(body('A', 'D', 'A')), ['A', 'D']);
  eq('  (A 마감 지남, D 마감 지남, E 올림) → 닫는다 · (A, B) → 둔다 · (C 건너뜀) → 닫는다 · (F 마감 없음) → 둔다',
    closableReadyIssues([{ number: 1, body: body('A', 'D', 'E') }, { number: 2, body: body('A', 'B') }, { number: 3, body: body('C') }, { number: 4, body: body('F') }], seen, '2026-10-04').map((x) => x.number),
    [1, 3]);
  eq('  장부에 없는 카드는 모름 → 살아 있는 것으로(닫지 않는다) · 마감 당일은 살아 있다', [liveCodes(['Z'], seen, '2026-10-04'), liveCodes(['A'], seen, '2026-09-16')], [['Z'], ['A']]);
  const insta = wf('insta.yml');
  const ij = Object.fromEntries(jobsOf(insta).map((j) => [j.name, stepsOf(j.text)]));
  eq('  insta.yml — 게시·건너뛰기의 정리는 살아 있는 카드 수로(옛 「1건 이하」 규칙 없음) · 준비 끝에 쓸모없어진 이슈 닫기',
    [(insta.match(/node insta\/ready-issues\.mjs live-in-body/g) || []).length, /grep -c '<!-- insta-code: '/.test(codeOf(insta)),
      (ij.prepare || []).some((s) => /node insta\/ready-issues\.mjs closable/.test(s.run || '') && s['continue-on-error'] === 'true' && /timeout-minutes/.test(s.raw))],
    [2, false, true]);

  /* ── ⑥ 전역 — 모든 워크플로 ── */
  eq('⑥ S1 표본 — gh 로 없는 라벨을 붙이면 잡는다 · 같은 파일에서 만들면(변수 포함) 통과',
    [labelGaps('gh issue create \\\n  --label "a" || true'), labelGaps('LABEL="b"\ngh label create "$LABEL"\ngh issue create --label "$LABEL"'), labelGaps('gh label create c --color 1\ngh issue create --label c')],
    [['a'], [], []]);
  eq('  S1 모든 워크플로·액션 — `gh issue create --label X` 면 같은 파일에 `gh label create X` 가 있다(없으면 gh 가 실패해 라벨 없는 이슈가 쌓이거나 아예 안 만들어진다)',
    [...wfs.map((f) => [`workflows/${f}`, labelGaps(wf(f))]), ...fs.readdirSync(new URL('.github/actions/', root)).map((d) => [`actions/${d}`, labelGaps(read(root, `.github/actions/${d}/action.yml`))])]
      .filter(([, g]) => g.length).map(([f, g]) => `${f}: ${g.join(',')}`), []);
  eq('  S2 표본 — 체크아웃 없이 로컬 액션 → 잡는다', [actionBeforeCheckout('jobs:\n  a:\n    steps:\n      - run: x\n      - uses: ./.github/actions/robot-down\n  b:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/alert-issue\n')], [['a']]);
  eq('  S2 모든 워크플로 — 로컬 액션(./.github/actions/…)보다 앞에 actions/checkout 이 있다(job 마다)',
    wfs.map((f) => [f, actionBeforeCheckout(wf(f))]).filter(([, b]) => b.length).map(([f, b]) => `${f}: ${b.join(',')}`), []);
  eq('  S3 표본 — 요약 한 줄뿐인 실패 단계 → 잡는다 · 같은 조건의 뒤 단계가 이슈로 닿으면 통과 · !cancelled() 는 실패 조건이 아니다',
    [silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: ${{ failure() || cancelled() }}\n        run: echo x >> \"$GITHUB_STEP_SUMMARY\"\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: failure()\n        run: echo x\n      - name: t\n        if: failure()\n        uses: ./.github/actions/alert-issue\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: ${{ !cancelled() }}\n        run: echo x\n")],
    [['a: s'], [], []]);
  eq('  S3 모든 워크플로 — failure()·cancelled() 단계는 이슈(robot-down·alert-issue·gh issue·issues.create)로 사람에게 닿는다(요약 한 줄·::warning 만이면 실패)',
    wfs.flatMap((f) => silentFailureSteps(wf(f)).map((s) => `${f} ${s}`)), []);
  eq('  S4 경보를 여는 워크플로는 이슈 쓰기 권한(issues: write)을 적어 둔다 — 없으면 경보가 403 으로 넘어진다',
    wfs.filter((f) => /uses:\s*\.\/\.github\/actions\/(?:robot-down|alert-issue)\b|tools\/alert-issue\.mjs/.test(codeOf(wf(f))) && !/^\s+issues: write\b/m.test(codeOf(wf(f)))), []);
  eq('  S3 잰 단계가 실제로 있다(헛도는 검사가 아니다)', wfs.flatMap((f) => jobsOf(wf(f)).flatMap((j) => stepsOf(j.text).filter((s) => onFailure(s.if)))).length >= 30, true);

  /* ── ⑦ 인스타 보조 로봇 — 수확이 실패하면 단계가 실패한다 ── */
  for (const f of ['insta-stats.yml', 'insta-comments.yml']) {
    const tees = stepsOf(wf(f)).filter((s) => /\|\s*tee\b/.test(s.run || ''));
    eq(`⑦ ${f} — \`| tee\` 단계는 pipefail(shell: bash 또는 set -o pipefail) — 없으면 node 가 넘어져도 초록`,
      [tees.length > 0, tees.every((s) => s.shell === 'bash' || /set -o pipefail/.test(s.run || ''))], [true, true]);
  }
  for (const f of ['insta-stats.yml', 'insta-comments.yml', 'insta-samples.yml']) {
    eq(`  ${f} — 이슈를 열 권한(issues: write)`, /^ {2}issues: write\b/m.test(wf(f)), true);
  }
  eq('  insta-samples — 밀린 실행은 기다리던 것만 버린다(도는 실행을 취소하면 넘어짐 알림이 헛경보로 선다)', /cancel-in-progress: false/.test(codeOf(wf('insta-samples.yml'))), true);

  /* ── ⑧ 교내 소식 로봇 — 감사·단계·사진 경보가 모이고 회복하면 닫힌다 · 리포트는 사람 손이 필요할 때만 ── */
  const nw = wf('collect-news.yml');
  const ns = stepsOf(nw);
  const alertsWhere = (cond) => ns.filter((s) => s.if === cond && (/alert-issue/.test(s.uses || '') || /tools\/alert-issue\.mjs/.test(s.run || '')));
  const modeOf = (s) => with_(s, 'mode') || ((/--mode (\w+)/.exec(s.run || '') || [])[1]) || '';
  eq('⑧ 감사 실패 — 경보 한 곳(날짜 붙은 새 이슈를 매번 만들지 않는다) · 다시 통과하면 닫는다',
    [alertsWhere("steps.audit.outcome == 'failure'").map(modeOf), alertsWhere("steps.audit.outcome == 'success'").map(modeOf), /gh issue create[^\n]*\n?[^\n]*교내 소식 데이터 감사 실패 \$\(/.test(nw)],
    [['open'], ['resolve'], false]);
  eq('  수집 단계가 끝까지 못 감 — 경보 한 곳 · 성공하면 닫는다',
    [alertsWhere("steps.run.outcome != 'success'").map(modeOf), alertsWhere("steps.run.outcome == 'success'").map(modeOf)], [['open'], ['resolve']]);
  eq('  사진(썸네일) 단계에 id 가 있고 그 결과를 보는 경보·닫기 짝이 있다',
    [ns.some((s) => s.id === 'thumbs' && /collect-news-thumbs\.mjs/.test(s.run || '')), alertsWhere("steps.thumbs.outcome == 'failure'").map(modeOf), alertsWhere("steps.thumbs.outcome == 'success'").map(modeOf)],
    [true, ['open'], ['resolve']]);
  const nfail = ns.filter((s) => onFailure(s.if));
  eq('  실패·시간초과는 robot-down(리포트 이슈가 없어도 닿는다)', nfail.map((s) => /robot-down/.test(s.uses || '')), [true]);
  const rep = ns.find((s) => /교내 소식 수집 리포트/.test(s.raw || '') && /alert-issue/.test(s.raw || '')) || {};
  eq('  리포트는 사람 손이 필요할 때만(수동 실행만으로는 안 연다 · 확인용 inputs.report) · 경보 도구 · 제목에 건수 없음',
    [/github\.event_name == 'workflow_dispatch'/.test(rep.if || ''), /needs_human == '1'/.test(rep.if || ''), /inputs\.report/.test(rep.if || ''), /new_count/.test((/--title "[^"]*"/.exec(rep.run || '') || [''])[0]),
      /^ {6}report:\n(?: {8}.*\n)*? {8}type: boolean/m.test(nw)],
    [false, true, true, false, true]);

  /* ── ⑨ 화면 검사 — 경보는 한 곳(같은 초 중복 정리) · 닫기는 기본 브랜치에서만 ── */
  const ui = wf('verify-ui.yml');
  const us = stepsOf(ui);
  const uAlarm = us.find((s) => s.name === '🚨 화면 검사가 빨간불이다') || {};
  const uIssue = us.find((s) => /alert-issue/.test(s.uses || '') && s.if === uAlarm.if) || {};
  eq('⑨ 빨간불 경보는 failure() 그대로 · 경보 도구(prefix · ui-gate)로 · 본문은 앞 단계 출력 · 맨몸 gh issue create 없음',
    [uAlarm.if, with_(uIssue, 'match'), with_(uIssue, 'title'), with_(uIssue, 'label'), /steps\.alarm\.outputs\.body/.test(uIssue.raw || ''), uAlarm.id, /gh issue create/.test(uAlarm.raw || '')],
    ['failure()', 'prefix', '🚨 앱 화면 검사가 빨간불입니다', 'ui-gate', true, 'alarm', false]);
  eq('  다시 초록불이면 닫는 단계는 기본 브랜치 success 에서만(main 의 초록불이 기본 브랜치 경보를 닫지 않게)',
    us.some((s) => /success\(\) && github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(s.if || '') && /gh issue close/.test(s.run || '')), true);
  eq('  경보 도구·규칙 파일만 고친 커밋에도 화면 검사가 돈다(감시 경로)',
    ["- 'tools/alert-issue.mjs'", "- 'tools/report-retention.mjs'", "- 'tools/app-fetch-files.cjs'", "- '.github/actions/**'"].map((p) => ui.includes(p)), [true, true, true, true]);

  /* ── ⑩ 공공 API · 작업 브랜치 배포 · 작성 규칙 학습 — 회복하면 닫는다 ── */
  const oa = stepsOf(wf('open-api.yml'));
  const oaOk = oa.find((s) => /--mode resolve/.test(s.run || '')) || {};
  eq('⑩ open-api — 출처가 모두 다시 받아지면(❌ 없음 · 정찰 아님 · success) 「🛰 공공 API 로봇 알림」을 닫는다',
    [/success\(\)/.test(oaOk.if || ''), /inputs\.probe != true/.test(oaOk.if || ''), /grep -q '❌' collector\/open-api-report\.md/.test(oaOk.run || ''), /--title '🛰 공공 API 로봇 알림'/.test(oaOk.run || '')],
    [true, true, true, true]);
  eq('  open-api 알림은 경보 한 곳으로(검색으로 찾지 않는다)', oa.some((s) => /출처 실패 알림/.test(s.name || '') && /tools\/alert-issue\.mjs --mode open --match exact --title '🛰 공공 API 로봇 알림'/.test(s.run || '') && !/gh issue list[^\n]*--search/.test(s.run || '')), true);
  const dd = stepsOf(wf('device-deploy.yml'));
  const ddClose = dd.find((s) => /compare\/main\.\.\./.test(s.run || '')) || {};
  eq('  device-deploy — 배포됐으면(deployed·uptodate) 옛 배포 실패 경보를 브랜치가 전부 main 에 들어갔을 때만 닫는다(모름은 둔다)',
    [/state == 'deployed'/.test(ddClose.if || '') && /state == 'uptodate'/.test(ddClose.if || ''), /ahead_by/.test(ddClose.run || ''), ddClose['continue-on-error'], /timeout-minutes/.test(ddClose.raw || '')],
    [true, true, 'true', true]);
  const es = stepsOf(wf('essay-playbook.yml'));
  const esRep = es.find((s) => s.name === '결과 리포트 이슈') || {};
  eq('  essay-playbook — 시간 초과(취소)에도 리포트 · 새 리포트가 옛 📘 를 넘겨받아 닫고 · 성공하면 🚨 를 닫는다 · 실패는 robot-down',
    [/cancelled\(\)/.test(esRep.if || ''), /issues\.update\(/.test(esRep.raw || '') && /state: 'closed'/.test(esRep.raw || ''), /'📘 작성 규칙 학습'/.test(esRep.raw || ''), /'🚨 작성 규칙 학습'/.test(esRep.raw || '') && /if \(ok\)/.test(esRep.raw || ''),
      es.some((s) => onFailure(s.if) && /robot-down/.test(s.uses || ''))],
    [true, true, true, true, true]);

  /* ── ⑪ 푸시 시험 발송 · 관리자 화면 잠금 — 판정 못 한 것을 초록으로 두지 않는다 ── */
  const pc = stepsOf(wf('push-check.yml')).find((s) => /\/test/.test(s.run || '')) || {};
  /* 판정 갈래마다 그 갈래 안에서 실패로 끝나는지 본다(낱말이 어딘가 있는지가 아니라) — 판정 하나를 지우면 그 줄이 빨개진다 */
  const ends1 = (head) => new RegExp(`${head}[^\\n]*then\\n(?:[^\\n]*\\n){0,3}?[^\\n]*exit 1`).test(pc.run || '');
  eq('⑪ push-check — /test 응답을 읽어 실패로 끝낸다: HTTP 200 아님 · JSON 아님 · 서버 오류 · 숫자를 못 읽음 · 한 대도 못 깨움 (등록 0대는 경고만)',
    [/-w '\\n%\{http_code\}'/.test(pc.run || ''), ends1('if \\[ "\\$RC" != "0" \\] \\|\\| \\[ "\\$CODE" != "200" \\]; '), ends1("if ! printf '%s' \"\\$JSON\" \\| jq -e 'type == \"object\"' >/dev/null 2>&1; "),
      ends1('if \\[ -n "\\$ERR" \\]; '), ends1('if ! \\[\\[ "\\$TRIED" =~ \\^\\[0-9\\]\\+\\$ && "\\$WOKE" =~ \\^\\[0-9\\]\\+\\$ \\]\\]; '), ends1('if \\[ "\\$WOKE" -eq 0 \\]; '),
      /if \[ "\$TRIED" -eq 0 \]; then\n[^\n]*::warning::[^\n]*\n[^\n]*exit 0/.test(pc.run || '')],
    [true, true, true, true, true, true, true]);
  const al = wf('admin-lock-check.yml');
  const as = stepsOf(al);
  eq('  admin-lock-check — 판정 불가(unknown)면 그날 실행을 실패로 남긴다(며칠 이어지면 하트비트가 알린다)',
    as.some((s) => s.if === "steps.probe.outputs.verdict == 'unknown'" && /exit 1/.test(s.run || '')), true);
  const probe = (as.find((s) => s.id === 'probe') || {}).run || '';
  eq('  admin-lock-check — 주소를 안 줬으면 미리보기 주소도 연다 · 열리면 경보(open=1) · 없는 미리보기는 판정에서 뺀다(매일 빨간불 금지) · 판정 앞에서 잰다',
    [/if \[ -z "\$\{IN_URL:-\}" \]; then\n\s*PREVIEW_URL="https:\/\/main\.hanggonggan-admin\.pages\.dev"/.test(probe), /curl [^\n]*"\$PREVIEW_URL\/"/.test(probe),
      /open=1; preview=open/.test(probe), /\*\)\n\s*echo "[^"\n]*미리보기 주소 없음[^"\n]*판정에서 제외"/.test(probe),
      probe.indexOf('PREVIEW_URL=') > 0 && probe.indexOf('PREVIEW_URL=') < probe.indexOf('verdict=open')],
    [true, true, true, true, true]);

  /* ── ⑫ 링크 사냥꾼 · 공고 누락 감사 — 이슈 하나에 모은다 · 실패가 사람에게 닿는다 ── */
  const lh = stepsOf(wf('link-hunter.yml'));
  const lhAsk = lh.find((s) => /사람 확인 필요/.test(s.name || '') && /alert-issue/.test(s.uses || '')) || lh.find((s) => /사람 확인 필요/.test(s.name || '')) || {};
  eq('⑫ 링크 사냥꾼 🔧 — 경보 한 곳(라벨 link-hunter · 고정 제목 · 제목에 건수 없음) · 보강(시한·continue-on-error)',
    [/alert-issue/.test(lhAsk.uses || ''), with_(lhAsk, 'label'), with_(lhAsk, 'match'), /stuck/.test(with_(lhAsk, 'title')), with_(lhAsk, 'title').startsWith('🔧 원문 주소를 3회 못 찾은 공고'), lhAsk['continue-on-error'], !!lhAsk['timeout-minutes']],
    [true, 'link-hunter', 'exact', false, true, 'true', true]);
  eq('  링크 사냥꾼 실패는 robot-down(::warning 한 줄이 아니다)', lh.filter((s) => onFailure(s.if)).map((s) => /robot-down/.test(s.uses || '')), [true]);
  const ac = stepsOf(wf('audit-coverage.yml'));
  const acRep = ac.find((s) => /원인 미상/.test(s.name || '') && /alert-issue/.test(s.uses || '')) || ac.find((s) => /원인 미상/.test(s.name || '')) || {};
  eq('  공고 누락 감사 — 결과는 경보 도구(라벨 coverage-audit) · 실패는 robot-down',
    [/alert-issue/.test(acRep.uses || ''), with_(acRep, 'label'), ac.filter((s) => onFailure(s.if)).map((s) => /robot-down/.test(s.uses || ''))], [true, 'coverage-audit', [true]]);
}
