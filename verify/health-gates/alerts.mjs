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
   🔴 순수 함수는 표본으로만, 워크플로는 글자(코드)로 잰다 — data/·collector/ 장부는 읽지 않는다.
   🔴 워크플로 글자를 재는 줄(eqWf)은 로봇 워크플로에서는 경고만 한다(⓪ · 리뷰 2026-10-05) — 다른 세션의 워크플로 편집으로
      모든 로봇의 결과가 되돌려지지 않게. 엄격하게 실패시키는 곳은 로컬과 verify-ui.yml(DOC_GATES=1 · 워크플로만 고친 커밋에도 돈다).
   🔴 '실패 단계가 robot-down 하나뿐'처럼 **개수**로 재지 않는다 — 덮는가(coversDown · broadFailKinds)로 잰다. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { stepsOf } from './ci.mjs';
import { planAlert, runAlert, titleMatches, fitBody, BODY_LIMIT } from '../../tools/alert-issue.mjs';
import { pickToClose, REPORT_RULES } from '../../tools/report-retention.mjs';
import { robotNamesOf, robotDownVerdicts, lastRunIdIn, mergeLastOk, successEventFor, ROBOT_DOWN_PREFIX } from '../../collector/robot-heartbeat.mjs';
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
/** 조건이 반응하는 실패 갈래 — failure()·cancelled() 중 무엇이 들어 있나(`!cancelled()` 처럼 부정한 것은 뺀다) */
export const failKinds = (cond) => {
  const c = String(cond || '').replace(/!\s*(?:failure|cancelled)\(\)/g, '');
  return ['failure', 'cancelled'].filter((k) => new RegExp(`\\b${k}\\(\\)`).test(c));
};
const onFailure = (cond) => failKinds(cond).length > 0;

/* 조건식 쪼개기 — 바깥 괄호 한 겹 벗기기 · 괄호·따옴표 바깥의 연산자로 나누기 */
const unwrap = (s) => {
  let t = String(s).trim();
  while (t.startsWith('(') && t.endsWith(')')) {
    let d = 0;
    let whole = true;
    for (let i = 0; i < t.length; i += 1) {
      if (t[i] === '(') d += 1;
      else if (t[i] === ')') { d -= 1; if (d === 0 && i < t.length - 1) { whole = false; break; } }
    }
    if (!whole) break;
    t = t.slice(1, -1).trim();
  }
  return t;
};
const splitTop = (s, op) => {
  const out = [];
  let d = 0;
  let q = null;
  let last = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === "'" || c === '"') q = c;
    else if (c === '(') d += 1;
    else if (c === ')') d -= 1;
    else if (d === 0 && s.startsWith(op, i)) { out.push(s.slice(last, i)); last = i + op.length; i += op.length - 1; }
  }
  out.push(s.slice(last));
  return out.map((x) => x.trim());
};
/** 조건이 **그 갈래 전체**에 반응하는 실패 갈래 — `failure()`·`cancelled()` 가 `||` 의 한 갈래로 홀로 있을 때만 센다.
    `failure() && github.event_name == 'schedule'` 처럼 다른 조건이 `&&` 로 붙으면 좁힌 것이라 세지 않는다(리뷰 2026-10-05 —
    글자가 '들어 있기만' 하면 덮었다고 보던 판은 좁힌 넘어짐 알림을 통과시켰다). `always()` 는 참이라 `always() && (…)` 는 안쪽을 본다. */
export const broadFailKinds = (cond) => {
  const go = (e) => {
    const x = unwrap(e);
    const ors = splitTop(x, '||');
    if (ors.length > 1) return ors.flatMap(go);
    if (x === 'always()') return ['failure', 'cancelled'];
    const ands = splitTop(x, '&&').filter((t) => unwrap(t) !== 'always()');
    if (ands.length > 1) return [];
    if (ands.length === 1 && ands[0] !== x) return go(ands[0]);
    return x === 'failure()' ? ['failure'] : x === 'cancelled()' ? ['cancelled'] : [];
  };
  const c = String(cond || '').trim().replace(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/, '$1');
  const got = c ? go(c) : [];
  return ['failure', 'cancelled'].filter((k) => got.includes(k));
};
/** 넘어짐 알림(robot-down)이 실패·취소(시간 초과) **둘 다**를 좁히지 않고 덮는 단계가 있는가.
    🔴 '실패 단계는 robot-down 하나뿐'으로 재지 말 것(리뷰 2026-10-05) — 실패 때만 결과물을 올리는 단계 하나만 더해져도
    헛빨간불이 나고, 이 관문은 모든 로봇의 데이터 관문에서 돈다. 나머지 실패 단계가 사람에게 닿는지는 S3 이 잰다. */
export const coversDown = (steps) => steps.some((s) => /uses:\s*\.\/\.github\/actions\/robot-down\b/.test(s.raw || '')
  && ['failure', 'cancelled'].every((k) => broadFailKinds(s.if).includes(k)));
/** 표본 만들기 — 진짜 워크플로의 첫 넘어짐 알림 **앞**에 '실패 때만 결과물 올리기' 단계를 끼운다(2026-10-04 기본 브랜치 꼴) */
export function withUploadStep(yml) {
  const lines = String(yml).split('\n');
  const at = lines.findIndex((l) => /^\s+uses:\s*\.\/\.github\/actions\/robot-down\b/.test(l));
  let start = at;
  while (start > 0 && !/^ {6}- /.test(lines[start])) start -= 1;
  if (at < 0 || start <= 0) return yml;
  lines.splice(start, 0, '      - name: 못 넣은 수집분 보관 (저장 실패 때만)', '        if: failure()', '        uses: actions/upload-artifact@v4',
    '        with:', '          name: leftover', '          path: collector/');
  return lines.join('\n');
}
/** S3 — `if:` 에 failure()·cancelled() 가 있는데 사람에게 닿지 않는 단계.
    같은 job 의 **뒤** 단계 가운데 그 갈래를 모두 덮는 단계(failure() 면 failure(), cancelled() 면 cancelled() 를 **좁히지 않고** 보는 단계 —
    broadFailKinds)가 사람에게 닿으면 통과 — 실패 때만 결과물을 올리는 단계(2026-10-04 기본 브랜치 '못 넣은 수집분 보관' · if: failure())처럼
    알림이 아닌 실패 단계가 있다. 조건 글자가 같을 것까지 요구하면 그런 단계가 들어오는 순간 관문이 헛빨간불을 낸다. */
export function silentFailureSteps(yml) {
  const bad = [];
  for (const j of jobsOf(yml)) {
    const steps = stepsOf(j.text);
    steps.forEach((s, k) => {
      if (!onFailure(s.if)) return;
      if (REACH.test(s.raw)) return;
      const need = failKinds(s.if);
      if (steps.slice(k + 1).some((t) => REACH.test(t.raw) && need.every((x) => broadFailKinds(t.if).includes(x)))) return;
      bad.push(`${j.name}: ${s.name || s.id || s.uses || '(이름 없음)'}`);
    });
  }
  return bad;
}

/** 워크플로·액션 **글자**를 재는 줄의 eq — 로컬·코드 검사(verify-ui.yml · `DOC_GATES=1`)에서는 그대로 실패하고,
    로봇 워크플로(데이터 관문)에서는 어긋나도 경고 한 줄만 남긴다(리뷰 2026-10-05).
    🔴 왜 — test-collector 는 모든 수집 로봇의 데이터 관문에서 돌고, 빨간불이면 그 실행의 결과를 되돌린다. 다른 세션이 워크플로에
       무해한 단계 하나를 더해도 모든 로봇 결과가 되돌려지면 안 된다(CLAUDE.md 문서 관문·link-gates/producers ⑥ 과 같은 잣대).
       대신 verify-ui.yml 이 `.github/workflows/**` 를 감시해 워크플로만 고친 커밋에서도 엄격하게 돈다(⑨). 순수 함수 표본은 어디서나 실패한다. */
export function softEq(eq, strict, log = console.log) {
  return (label, got, want) => {
    if (strict || JSON.stringify(got) === JSON.stringify(want)) return eq(label, got, want);
    log(`  ⚠ ${String(label).trim()} — 어긋남(받은 값 ${JSON.stringify(got)}) · 로봇 워크플로라 경고만 — 로컬·화면 검사(verify-ui)에서는 실패`);
    return undefined;
  };
}

const with_ = (s, k) => ((new RegExp(`^ {10}${k}:\\s*(.+)$`, 'm').exec((s && s.raw) || '') || [])[1] || '').trim();

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const wfDir = new URL('.github/workflows/', root);
  const wfs = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml')).sort();
  const wf = (f) => read(root, `.github/workflows/${f}`);
  /* 워크플로 글자 관문의 엄격함 — test-collector 문서 관문과 같은 잣대(로컬이거나 DOC_GATES=1 이면 엄격) */
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqWf = softEq(eq, DOC_GATES);
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 워크플로 글자 관문은 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');
  {
    const calls = [];
    const logs = [];
    const fake = (l) => { calls.push(l); };
    softEq(fake, false, (s) => logs.push(s))('어긋남', 1, 2);
    softEq(fake, false, (s) => logs.push(s))('맞음', 1, 1);
    softEq(fake, true, (s) => logs.push(s))('엄격', 1, 2);
    eq('⓪ 워크플로 글자 관문 — 로봇 워크플로에선 어긋나도 경고 한 줄(결과를 되돌리지 않는다) · 맞으면 그대로 잰다 · 로컬·verify-ui 에선 실패',
      [calls, logs.length, /경고만/.test(logs[0] || '')], [['맞음', '엄격'], 1, true]);
  }

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
  eqWf('  robot-down 이 경보 도구를 **제목 그대로**(exact) 부르고 · 실패하면 옛 gh 길로 물러난다 · 제목 꼴은 그대로',
    [/node "\$tool" --mode open --match exact --title "\$title"/.test(rd), /--label robot-down/.test(rd), /gh issue create --repo "\$REPO" --label robot-down/.test(rd),
      rd.includes('title="🚨 로봇이 넘어졌어요 — ${ROBOT}"'), ROBOT_DOWN_PREFIX === '🚨 로봇이 넘어졌어요 — '],
    [true, true, true, true, true]);
  /* 리뷰 2026-10-05 — 도구가 성공하면 그 자리에서 끝난다(exit 0). 빠지면 옛 gh 길까지 돌아 같은 경보에 댓글이 두 번 달리거나 새 이슈가 하나 더 선다 */
  eqWf('  robot-down — 경보 도구가 성공하면 그 자리에서 끝난다(옛 gh 길은 도구가 실패했을 때만)',
    /--label robot-down --label-color B60205 --label-description "[^"\n]*"; then\n\s*exit 0\n\s*fi\n\s*echo "::warning::/.test(rd), true);
  const ai = read(root, '.github/actions/alert-issue/action.yml');
  eqWf('  공용 액션 alert-issue 는 도구 한 곳을 부르고 본문은 환경 변수로 넘긴다(셸 글자에 끼우지 않는다)',
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
  eqWf('  close-old-reports 가 규칙 한 곳(tools/report-retention.mjs)을 부르고 · 옛 두 종류 jq 정규식이 없다 · 목록 상한 1000',
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
  eq('  경보 17:36 → 17:40 에 시작한 실행이 17:58 성공 → 닫는다(#386)', v({}, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z', endedAt: '2026-10-03T17:58:00Z' }), 'close');
  eq('  성공이 경보보다 앞(17:00 시작) → 둔다', v({}, { runId: 37141000000, startedAt: '2026-10-03T17:00:00Z' }), 'keep');
  eq('  성공 뒤 17:59 에 다시 넘어진 봇 댓글 → 둔다', v({ lastBotCommentAt: '2026-10-03T17:59:00Z', lastAlertRunId: 37141399999 }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'keep');
  eq('  성공 정보를 못 읽음 → 둔다(못 읽음을 괜찮음으로 읽지 않는다)', [v({}, null), v({}, { runId: null, startedAt: null })], ['keep', 'keep']);
  eq('  경보를 낸 **바로 그 실행**이 초록으로 끝난 것(단계 실패를 넘김)은 닫지 않는다',
    v({ createdAt: '2026-10-03T17:50:00Z', lastAlertRunId: 37141332557 }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z' }), 'keep');
  eq('  경보 뒤에 생긴 실행(번호가 더 큼)이 경보 뒤에 성공으로 끝남 — 취소된 앞 실행의 헛경보도 닫는다', v({ createdAt: '2026-10-03T17:41:00Z' }, { runId: 37141332557, startedAt: '2026-10-03T17:40:00Z', endedAt: '2026-10-03T17:58:00Z' }), 'close');
  /* 리뷰 2026-10-05 — 번호가 크기만 하면 닫던 판: 경보 10:00(실행 100) · 실행 150 이 09:00 시작 09:30 성공(넘어지기 전에 이미 끝남) → 닫았다 */
  eq('  번호가 더 큰 성공이라도 경보 **전에** 끝났으면 둔다(대기줄 없는 워크플로의 겹친 실행) · 끝난 시각을 모르면 둔다',
    [v({ createdAt: '2026-10-03T10:00:00Z', lastAlertRunId: 100 }, { runId: 150, startedAt: '2026-10-03T09:00:00Z', endedAt: '2026-10-03T09:30:00Z' }),
      v({ createdAt: '2026-10-03T10:00:00Z', lastAlertRunId: 100 }, { runId: 150, startedAt: '2026-10-03T09:00:00Z' }),
      v({ createdAt: '2026-10-03T10:00:00Z', lastAlertRunId: 100 }, { runId: 150, startedAt: '2026-10-03T09:00:00Z', endedAt: '2026-10-03T10:20:00Z' })],
    ['keep', 'keep', 'close']);
  /* 같은 로봇 이름을 쓰는 파일 여럿의 성공을 하나로 — 하나라도 못 읽으면 모름(null) · 가장 오래된 것 · 예약 실행만 봤는가 */
  const okA = { runId: 300, startedAt: '2026-10-03T03:00:00Z', endedAt: '2026-10-03T03:10:00Z', event: 'schedule' };
  const okB = { runId: 200, startedAt: '2026-10-03T02:00:00Z', endedAt: '2026-10-03T02:30:00Z', event: 'schedule' };
  eq('  mergeLastOk — 하나라도 못 읽음(오류·성공 기록 없음)·빈 목록은 모름 · 둘 다 읽으면 가장 오래된 성공 · 예약 실행만이면 그렇다고 적는다',
    [mergeLastOk([okA, { error: '502' }]), mergeLastOk([okA, { at: null }]), mergeLastOk([]), mergeLastOk([okA, okB]), mergeLastOk([okA, { ...okB, event: 'push' }]).scheduledOnly, mergeLastOk([okA, { ...okB, endedAt: null }]).endedAt],
    [null, null, null, { runId: 200, startedAt: '2026-10-03T02:00:00Z', endedAt: '2026-10-03T02:30:00Z', scheduledOnly: true }, false, null]);
  eq('  successEventFor — 예약이 있는 워크플로는 예약 실행의 성공만 센다(수동 실행은 모의·부분일 수 있다) · 예약이 없으면 거르지 않는다',
    [successEventFor("on:\n  schedule:\n    - cron: '17 3 * * *'\n  workflow_dispatch:\n"), successEventFor('on:\n  push:\n  workflow_dispatch:\n')], ['schedule', null]);
  eq('  넘어짐 경보가 아닌 이슈는 판정하지 않는다', robotDownVerdicts([{ number: 1, title: '🚨 앱 반영 점검 실패', createdAt: '2026-10-01T00:00:00Z' }], {}), []);
  {
    /* 실제로 묶는 곳 — 닫기 실행부가 예약 실행만 묻고(successEventFor → event=…) 여러 파일의 답을 mergeLastOk 하나로 합친다(손으로 다시 짜지 않는다) */
    const hb = fs.readFileSync(new URL('collector/robot-heartbeat.mjs', root), 'utf8');
    const cr = hb.slice(hb.indexOf('async function closeRecovered('), hb.indexOf('async function main('));
    eq('  닫기 실행부 — 예약 실행만 묻고(event) · 답은 mergeLastOk 로 합치고 · 닫는 글은 확인한 만큼만(예약 실행 / 성공한 실행이 있다)',
      [/const ev = successEventFor\(/.test(cr), /await lastSuccessAt\(repo, f, token, ev\)/.test(cr), /okByRobot\[robot\] = mergeLastOk\(got\);/.test(cr),
        /'\?status=success&per_page=1' \+ \(event \? `&event=\$\{encodeURIComponent\(event\)\}` : ''\)/.test(hb), /v\.ok\.scheduledOnly \?/.test(cr)],
      [true, true, true, true, true]);
  }
  const hbYml = wf('robot-heartbeat.yml');
  const closeStep = stepsOf(hbYml).find((s) => /--close-recovered/.test(s.run || ''));
  eqWf('  하트비트 워크플로가 닫기 단계를 돌린다(보강 — 시한 · 실패해도 판정은 그대로)', closeStep ? [closeStep['timeout-minutes'], closeStep['continue-on-error']] : null, ['2', 'true']);
  eqWf('  robot-down 을 쓰는 워크플로가 실제로 있고 이름을 읽어 낸다(헛도는 검사가 아니다)',
    wfs.filter((f) => robotNamesOf(wf(f)).length).length >= 8, true);

  /* ── ④ 실제 앱 반영 확인 — 앱이 받는 파일 · 다시 보기 · 경보 짝 ── */
  eq('④ fetchPathsIn — 글자 그대로인 상대 경로만(getDoc 포함 · 변수·템플릿·바깥 주소 제외)',
    fetchPathsIn("fetch('data/a.json',{}) getDoc('data/b.json') fetch(u) fetch(`x${y}`) fetch('https://x/y.json') fetch(\"./c.json?v=1\") fetch('data/a.json')"),
    ['c.json', 'data/a.json', 'data/b.json']);
  eq('  appScripts — index.html 이 싣는 우리 스크립트(바깥 주소 제외)', appScripts('<script src="boot.js"></script><script defer src="https://cdn.x/y.js"></script><script src="./app.js?v=2">'), ['boot.js', 'app.js']);
  const live = wf('check-live.yml');
  const liveSteps = stepsOf(live);
  const chk = liveSteps.find((s) => s.id === 'check') || {};
  eqWf('  check-live 가 앱 스크립트에서 목록을 뽑고(손 목록 금지) 지문으로 대조한다',
    [/require\('\.\/tools\/app-fetch-files\.cjs'\)/.test(chk.run || ''), /for \(const f of appFiles\) rows\.push\(\[[^\]]*hash\(f\), hash\('live\/' \+ f\)\]\)/.test(chk.run || ''), /const hash = \(p\) =>/.test(chk.run || '')],
    [true, true, true]);
  eqWf('  어긋나면 3분 뒤 main 을 다시 받아 한 번 더 본다(Pages 배포 중 헛경보)',
    [/sleep 180/.test(chk.run || ''), /git fetch -q origin main && git checkout -q --detach FETCH_HEAD/.test(chk.run || ''), /for try in 1 2/.test(chk.run || '')], [true, true, true]);
  /* 리뷰 2026-10-05 — 실제로 묶는 줄: 같으면 다시 보지 않고 멈춘다 · 고리 **뒤**에 마지막 회차 값을 진짜 출력으로 옮긴다
     (빠지면 bad 가 비어 매일 헛경보가 서고 같아져도 닫히지 않는다 · break 가 무조건이면 다시 보기가 사라진다) */
  eqWf('  다시 보기 — 같아지면(bad=0) 그때만 멈추고 · 고리 뒤에 마지막 회차 출력을 진짜 출력으로 옮긴다',
    [/bad=\$\(sed -n 's\/\^bad=\/\/p' \/tmp\/try\.out \| tail -1\)\n\s*\[ "\$bad" = "0" \] && break\n\s*done\n\s*cat \/tmp\/try\.out >> "\$GITHUB_OUTPUT"/.test(chk.run || ''),
      (/\n\s*break\s*\n/.test(chk.run || ''))], [true, false]);
  const liveAlarm = liveSteps.find((s) => s.name === '🚨 어긋남 알림') || {};
  const liveOk = liveSteps.find((s) => /alert-issue/.test(s.uses || '') && with_(s, 'mode') === 'resolve') || {};
  eqWf('  어긋남은 경보 한 곳(prefix · live-check) · 같아지면 닫는다 · 맨몸 gh issue create 없음',
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
  eqWf('  insta.yml — 게시·건너뛰기의 정리는 살아 있는 카드 수로(옛 「1건 이하」 규칙 없음) · 준비 끝에 쓸모없어진 이슈 닫기',
    [(insta.match(/node insta\/ready-issues\.mjs live-in-body/g) || []).length, /grep -c '<!-- insta-code: '/.test(codeOf(insta)),
      (ij.prepare || []).some((s) => /node insta\/ready-issues\.mjs closable/.test(s.run || '') && s['continue-on-error'] === 'true' && /timeout-minutes/.test(s.raw)),
      /* 리뷰 2026-10-05 — 남은 카드를 세지 못하면(빈 값) '남아 있음'(1)으로 읽는다 · 0 일 때만 닫는다(게시·건너뛰기 둘 다) */
      (codeOf(insta).match(/if \[ "\$\{LIVE:-1\}" = "0" \]; then gh issue close /g) || []).length, /\$\{LIVE:-0\}/.test(codeOf(insta))],
    [2, false, true, 2, false]);

  /* ── ⑥ 전역 — 모든 워크플로 ── */
  eq('⑥ S1 표본 — gh 로 없는 라벨을 붙이면 잡는다 · 같은 파일에서 만들면(변수 포함) 통과',
    [labelGaps('gh issue create \\\n  --label "a" || true'), labelGaps('LABEL="b"\ngh label create "$LABEL"\ngh issue create --label "$LABEL"'), labelGaps('gh label create c --color 1\ngh issue create --label c')],
    [['a'], [], []]);
  eqWf('  S1 모든 워크플로·액션 — `gh issue create --label X` 면 같은 파일에 `gh label create X` 가 있다(없으면 gh 가 실패해 라벨 없는 이슈가 쌓이거나 아예 안 만들어진다)',
    [...wfs.map((f) => [`workflows/${f}`, labelGaps(wf(f))]), ...fs.readdirSync(new URL('.github/actions/', root)).map((d) => [`actions/${d}`, labelGaps(read(root, `.github/actions/${d}/action.yml`))])]
      .filter(([, g]) => g.length).map(([f, g]) => `${f}: ${g.join(',')}`), []);
  eq('  S2 표본 — 체크아웃 없이 로컬 액션 → 잡는다', [actionBeforeCheckout('jobs:\n  a:\n    steps:\n      - run: x\n      - uses: ./.github/actions/robot-down\n  b:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/alert-issue\n')], [['a']]);
  eqWf('  S2 모든 워크플로 — 로컬 액션(./.github/actions/…)보다 앞에 actions/checkout 이 있다(job 마다)',
    wfs.map((f) => [f, actionBeforeCheckout(wf(f))]).filter(([, b]) => b.length).map(([f, b]) => `${f}: ${b.join(',')}`), []);
  eq('  S3 표본 — 요약 한 줄뿐인 실패 단계 → 잡는다 · 같은 조건의 뒤 단계가 이슈로 닿으면 통과 · !cancelled() 는 실패 조건이 아니다',
    [silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: ${{ failure() || cancelled() }}\n        run: echo x >> \"$GITHUB_STEP_SUMMARY\"\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: failure()\n        run: echo x\n      - name: t\n        if: failure()\n        uses: ./.github/actions/alert-issue\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: ${{ !cancelled() }}\n        run: echo x\n")],
    [['a: s'], [], []]);
  /* 실패 때만 결과물을 올리는 단계(알림이 아님) 뒤에 더 넓은 조건의 넘어짐 알림이 있으면 통과 — 2026-10-04 기본 브랜치 수집 로봇 둘이
     '못 넣은 수집분 보관'(if: failure() · upload-artifact)을 더했다. 조건 글자가 같을 것까지 요구하면 합치는 순간 모든 로봇의 데이터 관문이 빨개진다.
     반대로 뒤 알림이 cancelled() 를 안 보면(시간 초과) 그 갈래는 여전히 잡는다 · 알림이 **앞**에 있으면 안 닿는다(실패 뒤에 안 돈다). */
  eq('  S3 표본 — 실패 때만 결과물 올리기 + 뒤의 넓은 넘어짐 알림 → 통과 · 뒤 알림이 cancelled() 를 안 덮음 → 잡는다 · 알림이 앞에 있음 → 잡는다',
    [silentFailureSteps("jobs:\n  collect:\n    steps:\n      - name: 못 넣은 수집분 보관 (저장 실패 때만)\n        if: failure()\n        uses: actions/upload-artifact@v4\n      - name: 리포트\n        if: github.event_name == 'workflow_dispatch'\n        run: gh issue create --title r\n      - name: 🚨 로봇이 넘어졌다\n        if: failure() || cancelled()\n        uses: ./.github/actions/robot-down\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: s\n        if: ${{ failure() || cancelled() }}\n        run: echo x >> \"$GITHUB_STEP_SUMMARY\"\n      - name: t\n        if: failure()\n        uses: ./.github/actions/robot-down\n"),
      silentFailureSteps("jobs:\n  a:\n    steps:\n      - name: t\n        if: failure() || cancelled()\n        uses: ./.github/actions/robot-down\n      - name: s\n        if: failure()\n        run: echo x\n")],
    [[], ['a: s'], ['a: s']]);
  /* 리뷰 2026-10-05 — 덮는 단계의 조건이 좁혀지면(`failure() && …schedule`) 그 갈래는 덮지 못한다 · 글자가 들어 있기만 하면 통과하던 판을 잡는다 */
  const narrowYml = (cond) => `jobs:\n  a:\n    steps:\n      - name: 보관\n        if: failure()\n        uses: actions/upload-artifact@v4\n      - name: 🚨\n        if: ${cond}\n        uses: ./.github/actions/robot-down\n`;
  eq('  S3 표본 — 덮는 알림의 조건이 && 로 좁혀지면 잡는다(예약 실행만 · 그림 실패 없을 때만) · 괄호로 감싼 넓은 갈래·always() && (…)·|| 로 갈래를 더한 조건(브라우저 수집 꼴)은 통과',
    [silentFailureSteps(narrowYml("failure() && github.event_name == 'schedule'")), silentFailureSteps(narrowYml("${{ (failure() || cancelled()) && steps.draw.outputs.bad == '' }}")),
      silentFailureSteps(narrowYml('${{ (failure() || cancelled()) }}')), silentFailureSteps(narrowYml("always() && (github.event_name == 'workflow_dispatch' || failure() || cancelled())")),
      silentFailureSteps(narrowYml("failure() || cancelled() || steps.run.outcome == 'failure'"))],
    [['a: 보관'], ['a: 보관'], [], [], []]);
  eq('  broadFailKinds 표본 — 좁히지 않은 갈래만 센다(부정·따옴표 속 || 는 갈래가 아니다)',
    [broadFailKinds('failure() || cancelled()'), broadFailKinds("cancelled() || (failure() && steps.probe.outcome != 'success')"), broadFailKinds('${{ !cancelled() }}'), broadFailKinds("steps.x.outputs.y == 'failure() || z'"), broadFailKinds('success() || failure() || cancelled()')],
    [['failure', 'cancelled'], ['cancelled'], [], [], ['failure', 'cancelled']]);
  eq('  coversDown 표본 — 넘어짐 알림이 실패·취소를 좁히지 않고 덮으면 참 · 앞에 결과물 올리기 단계가 있어도 참 · 좁히거나 failure() 만이면 거짓',
    [coversDown(stepsOf(narrowYml('failure() || cancelled()'))), coversDown(stepsOf(narrowYml("failure() && github.event_name == 'schedule'"))), coversDown(stepsOf(narrowYml('failure()')))],
    [true, false, false]);
  eqWf('  S3 모든 워크플로 — failure()·cancelled() 단계는 이슈(robot-down·alert-issue·gh issue·issues.create)로 사람에게 닿는다(요약 한 줄·::warning 만이면 실패)',
    wfs.flatMap((f) => silentFailureSteps(wf(f)).map((s) => `${f} ${s}`)), []);
  eqWf('  S4 경보를 여는 워크플로는 이슈 쓰기 권한(issues: write)을 적어 둔다 — 없으면 경보가 403 으로 넘어진다',
    wfs.filter((f) => /uses:\s*\.\/\.github\/actions\/(?:robot-down|alert-issue)\b|tools\/alert-issue\.mjs/.test(codeOf(wf(f))) && !/^\s+issues: write\b/m.test(codeOf(wf(f)))), []);
  eqWf('  S3 잰 단계가 실제로 있다(헛도는 검사가 아니다)', wfs.flatMap((f) => jobsOf(wf(f)).flatMap((j) => stepsOf(j.text).filter((s) => onFailure(s.if)))).length >= 30, true);

  /* ── ⑦ 인스타 보조 로봇 — 수확이 실패하면 단계가 실패한다 ── */
  for (const f of ['insta-stats.yml', 'insta-comments.yml']) {
    const tees = stepsOf(wf(f)).filter((s) => /\|\s*tee\b/.test(s.run || ''));
    eqWf(`⑦ ${f} — \`| tee\` 단계는 pipefail(shell: bash 또는 set -o pipefail) — 없으면 node 가 넘어져도 초록`,
      [tees.length > 0, tees.every((s) => s.shell === 'bash' || /set -o pipefail/.test(s.run || ''))], [true, true]);
  }
  for (const f of ['insta-stats.yml', 'insta-comments.yml', 'insta-samples.yml']) {
    eqWf(`  ${f} — 이슈를 열 권한(issues: write)`, /^ {2}issues: write\b/m.test(wf(f)), true);
  }
  eqWf('  insta-samples — 밀린 실행은 기다리던 것만 버린다(도는 실행을 취소하면 넘어짐 알림이 헛경보로 선다)', /cancel-in-progress: false/.test(codeOf(wf('insta-samples.yml'))), true);

  /* ── ⑧ 교내 소식 로봇 — 감사·단계·사진 경보가 모이고 회복하면 닫힌다 · 리포트는 사람 손이 필요할 때만 ── */
  const nw = wf('collect-news.yml');
  const ns = stepsOf(nw);
  const alertsWhere = (cond) => ns.filter((s) => s.if === cond && (/alert-issue/.test(s.uses || '') || /tools\/alert-issue\.mjs/.test(s.run || '')));
  const modeOf = (s) => with_(s, 'mode') || ((/--mode (\w+)/.exec(s.run || '') || [])[1]) || '';
  eqWf('⑧ 감사 실패 — 경보 한 곳(날짜 붙은 새 이슈를 매번 만들지 않는다) · 다시 통과하면 닫는다',
    [alertsWhere("steps.audit.outcome == 'failure'").map(modeOf), alertsWhere("steps.audit.outcome == 'success'").map(modeOf), /gh issue create[^\n]*\n?[^\n]*교내 소식 데이터 감사 실패 \$\(/.test(nw)],
    [['open'], ['resolve'], false]);
  eqWf('  수집 단계가 끝까지 못 감 — 경보 한 곳 · 성공하면 닫는다',
    [alertsWhere("steps.run.outcome != 'success'").map(modeOf), alertsWhere("steps.run.outcome == 'success'").map(modeOf)], [['open'], ['resolve']]);
  eqWf('  사진(썸네일) 단계에 id 가 있고 그 결과를 보는 경보·닫기 짝이 있다',
    [ns.some((s) => s.id === 'thumbs' && /collect-news-thumbs\.mjs/.test(s.run || '')), alertsWhere("steps.thumbs.outcome == 'failure'").map(modeOf), alertsWhere("steps.thumbs.outcome == 'success'").map(modeOf)],
    [true, ['open'], ['resolve']]);
  /* 경보를 여는 단계는 저장 **뒤**에 (리뷰 2026-10-05) — 여는 단계는 continue-on-error 가 없어(넘어지면 robot-down 이 닿게) 저장 앞에 두면
     이슈 API 가 흔들린 날 관문·저장이 건너뛰어져 그 실행의 소식이 저장되지 않는다. 저장 앞에 둘 거면 continue-on-error 를 단다. */
  const saveAt = ns.findIndex((s) => /git commit/.test(s.run || ''));
  /* 여는 경보 셋(수집·사진·감사) — 감사 실패 알림은 gate-guard 단락(/tmp/gate-note.md)을 본문 파일로 싣느라 도구를 직접 부른다
     (run: node tools/alert-issue.mjs --match prefix · 2026-10-05 병합). 액션(uses)만 세면 둘이 되므로 둘 다 세고, 리포트 이슈(같은 도구 · open)는 뺀다 */
  const opensAlert = ns.filter((s) => modeOf(s) === 'open' && /alert-issue/.test(`${s.uses || ''} ${s.run || ''}`) && !/교내 소식 수집 리포트/.test(s.raw || ''));
  const opensBeforeSave = ns.slice(0, Math.max(saveAt, 0)).filter((s) => modeOf(s) === 'open' && /alert-issue/.test(`${s.uses || ''} ${s.run || ''}`) && s['continue-on-error'] !== 'true').map((s) => s.name);
  eqWf('  경보를 여는 단계는 저장 뒤에(저장 앞이면 continue-on-error) — 경보 하나가 넘어져 그 실행의 소식이 저장되지 않는 일이 없게',
    [saveAt > 0, opensBeforeSave, opensAlert.length], [true, [], 3]);
  /* 🔴 '실패 단계가 robot-down 하나뿐'으로 재지 않는다 — 다른 세션이 '못 넣은 수집분 보관(if: failure())' 같은 단계를 더하면 헛빨간불(리뷰 2026-10-05).
     그런 단계를 끼운 표본(진짜 파일 + 한 단계)에도 같은 판정이 나는지 함께 잰다. */
  eqWf('  실패·시간초과는 robot-down(리포트 이슈가 없어도 닿는다) · 결과물 올리기 단계를 끼워도 같은 판정(S3 도 통과)',
    [coversDown(ns), coversDown(stepsOf(withUploadStep(nw))), silentFailureSteps(withUploadStep(nw)), withUploadStep(nw) !== nw], [true, true, [], true]);
  const rep = ns.find((s) => /교내 소식 수집 리포트/.test(s.raw || '') && /alert-issue/.test(s.raw || '')) || {};
  eqWf('  리포트는 사람 손이 필요할 때만(수동 실행만으로는 안 연다 · 확인용 inputs.report) · 경보 도구 · 제목에 건수 없음',
    [/github\.event_name == 'workflow_dispatch'/.test(rep.if || ''), /needs_human == '1'/.test(rep.if || ''), /inputs\.report/.test(rep.if || ''), /new_count/.test((/--title "[^"]*"/.exec(rep.run || '') || [''])[0]),
      /^ {6}report:\n(?: {8}.*\n)*? {8}type: boolean/m.test(nw)],
    [false, true, true, false, true]);

  /* ── ⑨ 화면 검사 — 경보는 한 곳(같은 초 중복 정리) · 닫기는 기본 브랜치에서만 ── */
  const ui = wf('verify-ui.yml');
  const us = stepsOf(ui);
  const uAlarm = us.find((s) => s.name === '🚨 화면 검사가 빨간불이다') || {};
  const uIssue = us.find((s) => /alert-issue/.test(s.uses || '') && s.if === uAlarm.if) || {};
  eqWf('⑨ 빨간불 경보는 failure() 그대로 · 경보 도구(prefix · ui-gate)로 · 본문은 앞 단계 출력 · 맨몸 gh issue create 없음',
    [uAlarm.if, with_(uIssue, 'match'), with_(uIssue, 'title'), with_(uIssue, 'label'), /steps\.alarm\.outputs\.body/.test(uIssue.raw || ''), uAlarm.id, /gh issue create/.test(uAlarm.raw || '')],
    ['failure()', 'prefix', '🚨 앱 화면 검사가 빨간불입니다', 'ui-gate', true, 'alarm', false]);
  eqWf('  다시 초록불이면 닫는 단계는 기본 브랜치 success 에서만(main 의 초록불이 기본 브랜치 경보를 닫지 않게)',
    us.some((s) => /success\(\) && github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(s.if || '') && /gh issue close/.test(s.run || '')), true);
  eqWf('  경보 도구·규칙 파일만 고친 커밋에도 화면 검사가 돈다(감시 경로)',
    ["- 'tools/alert-issue.mjs'", "- 'tools/report-retention.mjs'", "- 'tools/app-fetch-files.cjs'", "- '.github/actions/**'"].map((p) => ui.includes(p)), [true, true, true, true]);
  /* 리뷰 2026-10-05 — 워크플로 글자 관문은 로봇에선 경고만이라, 엄격하게 실패시키는 화면 검사가 워크플로만 고친 커밋에도 돌아야 한다 */
  const uiPaths = ui.slice(ui.indexOf('    paths:'), ui.indexOf('  workflow_dispatch:'));
  const tcStep = us.find((s) => /node verify\/test-collector\.mjs/.test(s.run || '')) || {};
  eqWf('  워크플로만 고친 커밋에도 화면 검사가 돈다(.github/workflows/** 감시) · 그 검사의 관문 단계는 DOC_GATES=1(엄격)',
    [/^\s*- '\.github\/workflows\/\*\*'/m.test(codeOf(uiPaths)), /DOC_GATES: '1'/.test(tcStep.env || tcStep.raw || '')], [true, true]);

  /* ── ⑩ 공공 API · 작업 브랜치 배포 · 작성 규칙 학습 — 회복하면 닫는다 ── */
  const oa = stepsOf(wf('open-api.yml'));
  const oaOk = oa.find((s) => /--mode resolve/.test(s.run || '')) || {};
  eqWf('⑩ open-api — 출처가 모두 다시 받아지면(❌ 없음 · 정찰 아님 · success) 「🛰 공공 API 로봇 알림」을 닫는다',
    [/success\(\)/.test(oaOk.if || ''), /inputs\.probe != true/.test(oaOk.if || ''), /grep -q '❌' collector\/open-api-report\.md/.test(oaOk.run || ''), /--title '🛰 공공 API 로봇 알림'/.test(oaOk.run || '')],
    [true, true, true, true]);
  eqWf('  open-api 알림은 경보 한 곳으로(검색으로 찾지 않는다)', oa.some((s) => /출처 실패 알림/.test(s.name || '') && /tools\/alert-issue\.mjs --mode open --match exact --title '🛰 공공 API 로봇 알림'/.test(s.run || '') && !/gh issue list[^\n]*--search/.test(s.run || '')), true);
  const dd = stepsOf(wf('device-deploy.yml'));
  const ddClose = dd.find((s) => /compare\/main\.\.\./.test(s.run || '')) || {};
  eqWf('  device-deploy — 배포됐으면(deployed·uptodate) 옛 배포 실패 경보를 브랜치가 전부 main 에 들어갔을 때만 닫는다(모름은 둔다)',
    [/state == 'deployed'/.test(ddClose.if || '') && /state == 'uptodate'/.test(ddClose.if || ''), /ahead_by/.test(ddClose.run || ''), ddClose['continue-on-error'], /timeout-minutes/.test(ddClose.raw || ''),
      /* 리뷰 2026-10-05 — 실제로 묶는 줄: 0 만 '들어갔다' · 빈 값·숫자 아님(404·조회 실패)은 모름(all=0) · 다 들어갔을 때만 닫는다 */
      /\n\s*0\) lines\+=/.test(ddClose.run || ''), /\n\s*''\|\*\[!0-9\]\*\) all=0;/.test(ddClose.run || ''), /if \[ "\$all" = "1" \]; then\n\s*gh issue close/.test(ddClose.run || '')],
    [true, true, 'true', true, true, true, true]);
  const es = stepsOf(wf('essay-playbook.yml'));
  const esRep = es.find((s) => s.name === '결과 리포트 이슈') || {};
  eqWf('  essay-playbook — 시간 초과(취소)에도 리포트 · 새 리포트가 옛 📘 를 넘겨받아 닫고 · 성공하면 🚨 를 닫는다 · 실패는 robot-down',
    [/cancelled\(\)/.test(esRep.if || ''), /issues\.update\(/.test(esRep.raw || '') && /state: 'closed'/.test(esRep.raw || ''), /'📘 작성 규칙 학습'/.test(esRep.raw || ''), /'🚨 작성 규칙 학습'/.test(esRep.raw || '') && /if \(ok\)/.test(esRep.raw || ''),
      coversDown(es)],
    [true, true, true, true, true]);

  /* ── ⑪ 푸시 시험 발송 · 관리자 화면 잠금 — 판정 못 한 것을 초록으로 두지 않는다 ── */
  const pc = stepsOf(wf('push-check.yml')).find((s) => /\/test/.test(s.run || '')) || {};
  /* 판정 갈래마다 그 갈래 안에서 실패로 끝나는지 본다(낱말이 어딘가 있는지가 아니라) — 판정 하나를 지우면 그 줄이 빨개진다 */
  const ends1 = (head) => new RegExp(`${head}[^\\n]*then\\n(?:[^\\n]*\\n){0,3}?[^\\n]*exit 1`).test(pc.run || '');
  eqWf('⑪ push-check — /test 응답을 읽어 실패로 끝낸다: HTTP 200 아님 · JSON 아님 · 서버 오류 · 숫자를 못 읽음 · 한 대도 못 깨움 (등록 0대는 경고만)',
    [/-w '\\n%\{http_code\}'/.test(pc.run || ''), ends1('if \\[ "\\$RC" != "0" \\] \\|\\| \\[ "\\$CODE" != "200" \\]; '), ends1("if ! printf '%s' \"\\$JSON\" \\| jq -e 'type == \"object\"' >/dev/null 2>&1; "),
      ends1('if \\[ -n "\\$ERR" \\]; '), ends1('if ! \\[\\[ "\\$TRIED" =~ \\^\\[0-9\\]\\+\\$ && "\\$WOKE" =~ \\^\\[0-9\\]\\+\\$ \\]\\]; '), ends1('if \\[ "\\$WOKE" -eq 0 \\]; '),
      /if \[ "\$TRIED" -eq 0 \]; then\n[^\n]*::warning::[^\n]*\n[^\n]*exit 0/.test(pc.run || '')],
    [true, true, true, true, true, true, true]);
  const al = wf('admin-lock-check.yml');
  const as = stepsOf(al);
  eqWf('  admin-lock-check — 판정 불가(unknown)면 그날 실행을 실패로 남긴다(며칠 이어지면 하트비트가 알린다)',
    as.some((s) => s.if === "steps.probe.outputs.verdict == 'unknown'" && /exit 1/.test(s.run || '')), true);
  const probe = (as.find((s) => s.id === 'probe') || {}).run || '';
  eqWf('  admin-lock-check — 주소를 안 줬으면 미리보기 주소도 연다 · 열리면 경보(open=1) · 없는 미리보기는 판정에서 뺀다(매일 빨간불 금지) · 판정 앞에서 잰다',
    [/if \[ -z "\$\{IN_URL:-\}" \]; then\n\s*PREVIEW_URL="https:\/\/main\.hanggonggan-admin\.pages\.dev"/.test(probe), /curl [^\n]*"\$PREVIEW_URL\/"/.test(probe),
      /open=1; preview=open/.test(probe), /\*\)\n\s*echo "[^"\n]*미리보기 주소 없음[^"\n]*판정에서 제외"/.test(probe),
      probe.indexOf('PREVIEW_URL=') > 0 && probe.indexOf('PREVIEW_URL=') < probe.indexOf('verdict=open')],
    [true, true, true, true, true]);

  {
    /* 리뷰 2026-10-05 — 미리보기 블록은 '열렸다'(open=1)만 판정에 보탠다. 잠김 셈(sure·total)을 건드리면 없는 미리보기가 매일 '판정 불가'를 낸다 */
    const pv = probe.slice(probe.indexOf('preview=""'), probe.indexOf('echo "preview=$preview"'));
    eqWf('  admin-lock-check — 미리보기 블록은 잠김 셈(sure·total)을 건드리지 않고 · 열렸을 때만 open=1 · 없는 미리보기 갈래는 알리기만',
      [pv.length > 0, /\b(?:sure|total)=/.test(pv), (pv.match(/open=1/g) || []).length, /\*\)\n\s*echo "[^"\n]*미리보기 주소 없음[^"\n]*판정에서 제외"\n\s*;;/.test(pv)],
      [true, false, 1, true]);
  }

  /* ── ⑫ 링크 사냥꾼 · 공고 누락 감사 — 이슈 하나에 모은다 · 실패가 사람에게 닿는다 ── */
  const lh = stepsOf(wf('link-hunter.yml'));
  const lhAsk = lh.find((s) => /사람 확인 필요/.test(s.name || '') && /alert-issue/.test(s.uses || '')) || lh.find((s) => /사람 확인 필요/.test(s.name || '')) || {};
  eqWf('⑫ 링크 사냥꾼 🔧 — 경보 한 곳(라벨 link-hunter · 고정 제목 · 제목에 건수 없음) · 보강(시한·continue-on-error)',
    [/alert-issue/.test(lhAsk.uses || ''), with_(lhAsk, 'label'), with_(lhAsk, 'match'), /stuck/.test(with_(lhAsk, 'title')), with_(lhAsk, 'title').startsWith('🔧 원문 주소를 3회 못 찾은 공고'), lhAsk['continue-on-error'], !!lhAsk['timeout-minutes']],
    [true, 'link-hunter', 'exact', false, true, 'true', true]);
  const lhY = wf('link-hunter.yml');
  eqWf('  링크 사냥꾼 실패는 robot-down(::warning 한 줄이 아니다) · 결과물 올리기 단계를 끼워도 같은 판정',
    [coversDown(lh), coversDown(stepsOf(withUploadStep(lhY))), silentFailureSteps(withUploadStep(lhY)), withUploadStep(lhY) !== lhY], [true, true, [], true]);
  const acY = wf('audit-coverage.yml');
  const ac = stepsOf(acY);
  const acRep = ac.find((s) => /원인 미상/.test(s.name || '') && /alert-issue/.test(s.uses || '')) || ac.find((s) => /원인 미상/.test(s.name || '')) || {};
  eqWf('  공고 누락 감사 — 결과는 경보 도구(라벨 coverage-audit) · 실패는 robot-down · 결과물 올리기 단계를 끼워도 같은 판정',
    [/alert-issue/.test(acRep.uses || ''), with_(acRep, 'label'), coversDown(ac), coversDown(stepsOf(withUploadStep(acY))), silentFailureSteps(withUploadStep(acY)), withUploadStep(acY) !== acY],
    [true, 'coverage-audit', true, true, [], true]);
}
