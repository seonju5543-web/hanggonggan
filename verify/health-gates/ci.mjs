/* 「로봇·도구 점검 관문」 — ci 묶음: 화면 검사(verify-ui.yml) 그물이 데이터 탓으로 걷히지 않는가 (2026-10-04)
   사고: 10-03~10-04 verify-ui 가 연속 빨간불(이슈 #383 → #389·#390). 원인 둘이 겹쳤다 —
     ① verify-registered.js 가 '이 학생에게 보이는 마감 전 양식 공고'를 실데이터에서 못 찾으면 실패했다(데이터 탓 빨간불).
     ② 화면 검사 단계가 `set -e` + 맨몸 `node` 라 그 하나가 넘어지면 뒤 드라이버 22개와 아래 단계 셋(말투·토큰 · 수집기 규칙 · 전 여정)이
        통째로 안 돌았다 — 그 사이 들어온 토큰 위반(ui-tone 천장 75→76)이 CI 에 한 번도 안 보였다.
   잰다:
     ① 양식 표본 — 표본을 언제·무엇으로 심는가(verify/open-form-sample.cjs · 드라이버와 같은 함수) + 드라이버 배선
        (배선은 driveAnyLiveForm 몸통을 가짜 page·driveOneForm 으로 **실제로 돌려** 잰다 — `ids.length && …` 로 감싸는 10-04 꼴을 글자로는 못 잡았다)
     ② 화면 검사 워크플로 — 한 곳이 넘어져도 그물이 남는다(실패를 모아 끝에 한 번 · 브라우저 경로 뒤 **모든** 관문 단계 !cancelled() ·
        화면 검사·전 여정은 서버·브라우저 준비가 됐을 때만 · 경보는 failure() 그대로 · 경보 본문은 화면 검사가 돌았는지부터 가른다 — 셸 글을 실제로 돌려 본다)
        · 드라이버 루프도 **셸 글을 실제로 돌린다**(가짜 node·timeout) — 실패를 모으는가 · 20분 예산을 넘으면 남은 이름을 넘기고 실패로 끝나는가
          (2026-10-04 코드 리뷰: 루프 줄을 `|| echo` 로 바꿔 영구 초록불을 만들어도 글자 대조는 통과했다)
     ③ 작업 브랜치 배포(device-deploy.yml) 뒤 화면 검사를 깨운다
     ④ 양식을 고친 그날 '종류를 모르는 자기소개서 칸'을 데이터 감사가 경고한다(verify/essay-unknown-fields.cjs · 주간 검사와 같은 함수 · 경고만)
        (점검 명세는 양식 로봇 리포트에 붙이라 했지만, 그 로봇은 칸에 kind 를 달지 않아 영영 안 울린다 — 'story' 는 세션이 단다.
         09-29 에 주간 로봇을 멈춘 칸도 세션이 손으로 옮긴 양식(09-24 f4438304)이었다. 그래서 세션이 반드시 돌리는 감사에 건다.)
   🔴 표본(고정 예시)만 쓴다 — data/ 를 읽지 않는다. 워크플로·코드 파일은 코드라 글자로 대조한다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { shouldPlantSample, openFormSample } = require('../open-form-sample.cjs');
const { unknownStoryFields } = require('../essay-unknown-fields.cjs');

/* 워크플로 단계 읽기 — `      - ` 로 시작하는 단계마다 name·id·if·run·continue-on-error 와 원문(raw).
   YAML 해석기를 들이지 않는다(수집 로봇도 이 관문을 돌리는데 npm 설치가 없다). 이 저장소 워크플로의 꼴만 안다:
   단계 칸은 8칸 들여쓰기, 여러 줄 값(`|` · `>`)은 그보다 더 들여 쓴 줄들. */
export function stepsOf(yml) {
  const lines = String(yml).replace(/\r/g, '').split('\n');
  const steps = [];
  let i = 0;
  while (i < lines.length) {
    const m = /^ {6}- (.*)$/.exec(lines[i]);
    if (!m) { i += 1; continue; }
    const chunk = [`        ${m[1]}`];
    i += 1;
    while (i < lines.length && !/^ {6}- /.test(lines[i])
      && (lines[i].trim() === '' || /^ {8,}\S/.test(lines[i]) || /^\s*#/.test(lines[i]))) { chunk.push(lines[i]); i += 1; }
    const st = { raw: chunk.join('\n') };
    for (let j = 0; j < chunk.length; j += 1) {
      const km = /^ {8}([A-Za-z_-]+):(?:\s(.*))?$/.exec(chunk[j]);
      if (!km) continue;
      const key = km[1];
      const rest = (km[2] || '').trim();
      if (/^[|>][-+]?$/.test(rest)) {
        const body = [];
        while (j + 1 < chunk.length && (chunk[j + 1].trim() === '' || /^ {9,}/.test(chunk[j + 1]))) { j += 1; body.push(chunk[j].replace(/^ {10}/, '')); }
        st[key] = rest[0] === '>' ? body.map((s) => s.trim()).filter(Boolean).join(' ') : body.join('\n').replace(/\n+$/, '');
      } else st[key] = rest;
    }
    steps.push(st);
  }
  return steps;
}

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8');

/* 함수 하나의 원문 — `async function 이름(` 부터 맨 앞 칸의 `}` 까지 */
function fnSource(src, name) {
  const i = src.indexOf(`async function ${name}(`);
  const j = i < 0 ? -1 : src.indexOf('\n}\n', i);
  return j < 0 ? '' : src.slice(i, j + 2);
}
/* 같은 몸통에서 주석을 걷어 낸 것(줄 세기용) */
function fnBody(src, name) {
  return fnSource(src, name).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/* 드라이버의 driveAnyLiveForm 을 **실제로 돌린다** — 브라우저 없이.
   page.evaluate 에 넘긴 함수는 vm 안에서 돈다(앱 전역 document·registeredList·FORM_TEMPLATES·renderExplore 를 가짜로 둔다).
   driveOneForm 은 시나리오가 정한 결과를 돌려주는 가짜 · 표본 고르기는 진짜(open-form-sample.cjs) · console 은 조용히.
   🔴 드라이버가 page 의 새 기능을 쓰기 시작하면 여기서 빨개진다 — 그때 가짜 page 에 더한다(검사를 무르게 하지 말 것). */
async function runDriveAny(src, { visible, list, tpl, outcome }) {
  const code = fnSource(src, 'driveAnyLiveForm');
  if (!code) return { error: 'driveAnyLiveForm 을 못 찾음' };
  const st = { visible: [...visible], list: JSON.parse(JSON.stringify(list)), calls: [], rendered: 0 };
  const sandbox = vm.createContext({
    document: { querySelectorAll: (sel) => (sel === '#explore-list [data-detail]' ? st.visible.map((id) => ({ dataset: { detail: id } })) : []) },
    registeredList: st.list,
    FORM_TEMPLATES: tpl,
    renderExplore: () => { st.rendered += 1; st.visible = st.list.map((x) => x.id); },
  });
  const page = {
    click: async () => {},
    waitForTimeout: async () => {},
    keyboard: { press: async () => {} },
    evaluate: async (fn, arg) => vm.runInContext(`(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})`, sandbox, { timeout: 2000 }),
  };
  const driveOneForm = async (_page, id) => {
    st.calls.push(id);
    const r = outcome(id);
    if (r instanceof Error) throw r;
    return { id, ...r };
  };
  const quiet = { log() {}, warn() {}, error() {} };
  try {
    const fn = new Function('driveOneForm', 'shouldPlantSample', 'openFormSample', 'console', `${code}\nreturn driveAnyLiveForm;`)(
      driveOneForm, shouldPlantSample, openFormSample, quiet);
    const r = await fn(page);
    return { ok: !!(r && r.ok), id: r && r.id, calls: st.calls, planted: st.list.some((x) => x && x.id === 'gate-open-form'), rendered: st.rendered };
  } catch (e) {
    return { error: String((e && e.message) || e).slice(0, 100), calls: st.calls };
  }
}

/* 화면 검사 단계의 셸 글을 **실제로 돌린다** — GitHub 의 기본 셸과 같은 `bash -eo pipefail`.
   가짜 node: 드라이버 이름을 적고 · GATE_FAIL 에 든 이름이면 실패 · GATE_STEP 초만큼 시계(SECONDS)를 앞으로 민다(오래 걸린 드라이버).
   가짜 timeout: `node` 앞의 마지막 인자(그 드라이버의 시한)를 적고 뒤를 그대로 부른다.
   🔴 진짜 드라이버를 절대 부르지 않는다: 같은 이름의 셸 함수가 먼저 잡히고, 빈 임시 폴더에서 돌아 함수가 빠져도 verify/ 가 없다.
      GITHUB_OUTPUT 은 임시 파일 — 이 관문이 Actions 안에서 돌 때 진짜 출력을 더럽히지 않게 환경을 새로 만든다. */
function runDriverLoop(script, { fail = [], step = 0 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-loop-'));
  const f = (n) => path.join(dir, n);
  for (const n of ['out', 'ran', 'tl']) fs.writeFileSync(f(n), '');
  const fake = [
    'timeout() { local d=""; while [ $# -gt 0 ] && [ "$1" != node ]; do d="$1"; shift; done; echo "$d" >> "$GATE_TL"; "$@"; }',
    'node() { echo "${1#verify/}" >> "$GATE_RAN"; if [ "${GATE_STEP:-0}" -gt 0 ]; then SECONDS=$((SECONDS + GATE_STEP)); fi; case " $GATE_FAIL " in *" ${1#verify/} "*) return 1 ;; esac; return 0; }',
  ].join('\n');
  try {
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', `${fake}\n${script}`], {
      cwd: dir, encoding: 'utf8', timeout: 20000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: dir, GITHUB_OUTPUT: f('out'), GATE_RAN: f('ran'), GATE_TL: f('tl'), GATE_FAIL: fail.join(' '), GATE_STEP: String(step) },
    });
    const lines = (n) => fs.readFileSync(f(n), 'utf8').split('\n').filter(Boolean);
    const out = {};
    for (const l of lines('out')) { const k = l.indexOf('='); if (k > 0) out[l.slice(0, k)] = l.slice(k + 1); }
    return { rc: r.status, out, ran: lines('ran'), tl: lines('tl').map(Number) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/* 경보 단계의 셸 글을 **실제로 돌려** 본문을 받는다 — 글자 대조로는 갈래가 바뀌어도 모른다.
   🔴 진짜 gh 를 절대 부르지 않는다: 같은 이름의 셸 함수가 먼저 잡히고(함수가 실행 파일보다 앞선다),
      열쇠(GH_TOKEN·GITHUB_TOKEN)와 집 폴더를 넘기지 않는다 — 함수가 빠져도 이슈를 못 만든다. */
function runAlarm(script, env) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-alarm-'));
  const fake = 'gh() { while [ $# -gt 0 ]; do if [ "$1" = --body ]; then printf \'%s\' "$2"; fi; shift; done; }';
  try {
    const r = spawnSync('bash', ['-c', `${fake}\n${script}`], {
      encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: home, GH_CONFIG_DIR: home, BRANCH: 'gate', RUN_URL: 'gate', REPO: 'gate/none', ...env },
    });
    return r.status === 0 ? r.stdout : `(셸 실패 ${r.status} ${String(r.error || r.stderr || '').slice(0, 120)})`;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

export default async function gate(eq, ctx) {
  const root = ctx.root;

  /* ── ① 화면 검사 — 양식 표본 (표본만 쓴다) ── */
  eq('① 보이는 양식 공고가 아예 없으면 표본을 심는다 (10-04 #390 — 예전 조건 `ids.length && …` 로는 false)', shouldPlantSample([], []), true);
  eq('  시도한 후보가 전부 「신청 버튼 잠김」(마감)이면 표본', shouldPlantSample(['a'], ['a(신청 버튼 잠김)']), true);
  eq('  잠김 말고 다른 이유로 실패한 후보가 하나라도 있으면 표본을 쓰지 않는다(진짜 고장을 덮지 않는다)',
    shouldPlantSample(['a', 'b'], ['a(신청 버튼 잠김)', 'b(문서가 비었다)']), false);
  const LIST = [
    { id: 'hufs-only', formId: 'f1', deadline: '2026-09-30', eligibility: { schoolOnly: '한국외국어대학교', campusOnly: '서울', schoolsAny: ['x'], minGpa: 3 } },
    { id: 'no-tpl', formId: 'missing' },
    { id: 'plain', name: 'p', eligibility: {} },
  ];
  const pick = openFormSample(LIST, ['f1'], [], '2026-10-04');
  eq('  화면에 안 보여도 양식이 있는 실제 등록 항목을 고른다(어느 학교든)', pick && pick.from, 'hufs-only');
  eq('  표본: id · 마감 오늘+20일 · 등록일 오늘(60일 규칙에 안 걸리게) · 양식 그대로',
    pick && [pick.copy.id, pick.copy.deadline, pick.copy.listedAt, pick.copy.formId], ['gate-open-form', '2026-10-24', '2026-10-04', 'f1']);
  eq('  학교 범위 칸 셋만 지우고 다른 자격 칸은 그대로',
    pick && [['schoolOnly', 'campusOnly', 'schoolsAny'].some((k) => k in pick.copy.eligibility), pick.copy.eligibility.minGpa], [false, 3]);
  eq('  원본은 바꾸지 않는다(깊은 복사)', [LIST[0].eligibility.schoolOnly, LIST[0].id, LIST[0].deadline], ['한국외국어대학교', 'hufs-only', '2026-09-30']);
  eq('  달·해가 바뀌어도 날짜가 맞다', (openFormSample(LIST, ['f1'], [], '2026-12-20') || {}).copy?.deadline, '2027-01-09');
  eq('  화면에 보인 후보가 있으면 그것을 먼저',
    (openFormSample([...LIST, { id: 'vis', formId: 'f1' }], ['f1'], ['vis'], '2026-10-04') || {}).from, 'vis');
  const builtin = openFormSample([{ id: 'plain', eligibility: { schoolOnly: 'A' } }], ['jobyungdu-apply'], [], '2026-10-04');
  eq('  등록 목록에 양식 공고가 하나도 없으면 앱 내장 양식을 실제 항목에 붙인다(데이터에 기대지 않는다)',
    builtin && [builtin.from, builtin.copy.formId, 'schoolOnly' in builtin.copy.eligibility], ['plain', 'jobyungdu-apply', false]);
  eq('  쓸 양식이 하나도 없으면 null — 빨간불로 남긴다', openFormSample(LIST, [], [], '2026-10-04'), null);

  const drv = read(root, 'verify/verify-registered.js');
  eq('  드라이버가 같은 함수를 불러 쓴다(베끼지 않는다) · 후보 0장에서 빠져나가는 이른 반환이 없다',
    [/require\('\.\/open-form-sample\.cjs'\)/.test(drv), /shouldPlantSample\(/.test(drv), /openFormSample\(/.test(drv),
      /if \(!ids\.length\) return/.test(drv), /delete copy\.eligibility|864e5/.test(drv)],
    [true, true, true, false, false]);
  /* (2026-10-04 코드 리뷰) 위 글자 하나만 막으면 뜻이 같은 이른 반환(`if (ids.length === 0) return …` ·
     `if (!ids.length) { return { id: null, ok: false }; }`)을 되살려도 초록불이다 — 그래서 **몸통을 잘라** 본다:
     표본을 심기(shouldPlantSample) 전에 나오는 return 은 후보 거르기 콜백과 성공 return 둘뿐이어야 한다. */
  const anyBody = fnBody(drv, 'driveAnyLiveForm');
  const plantAt = anyBody.indexOf('shouldPlantSample(');
  eq('  driveAnyLiveForm 몸통을 잘라 냈다(헛도는 검사가 아니다)', [anyBody.length > 500, plantAt > 0], [true, true]);
  eq('  표본 심기 전에 나오는 return 은 후보 거르기 콜백 · 성공한 후보 둘뿐(실패로 빠져나가는 길이 없다)',
    anyBody.slice(0, Math.max(plantAt, 0)).split('\n').filter((l) => /\breturn\b/.test(l)).map((l) => l.trim()),
    ['return s && s.formId && FORM_TEMPLATES[s.formId];', 'if (r.ok) return r;']);
  eq('  실패를 돌려주는 return 은 함수 맨 끝 하나 · `id: null` 로 돌려주는 길이 없다',
    [[...anyBody.matchAll(/\breturn\s*\{[^}]*\bok:\s*false/g)].map((m) => m.index > plantAt), /return\s*\{\s*id:\s*null/.test(anyBody)],
    [[true], false]);
  /* (2026-10-04 코드 리뷰 2차) 위 줄 세기는 return 꼴만 본다 — 조건을 `if (ids.length && shouldPlantSample(ids, tried)) {` 로 감싸
     10-04 사고를 그대로 되살려도 · `if (!ids.length) throw …` 를 넣어도 초록불이었다(실측). 그래서 몸통을 **실제로 돌려** 잰다. */
  const TPL = { f1: { sections: [] } };
  const A = { id: 'a', formId: 'f1', eligibility: { schoolOnly: '성균관대학교' } };
  const B = { id: 'b', formId: 'f1', eligibility: {} };
  const H = { id: 'hufs-only', formId: 'f1', eligibility: { schoolOnly: '한국외국어대학교' } };
  const LOCKED = { ok: false, why: '신청 버튼 잠김' };
  const s0 = await runDriveAny(drv, { visible: [], list: [H], tpl: TPL, outcome: (id) => (id === 'gate-open-form' ? { ok: true } : LOCKED) });
  eq('  (돌려 봄) 보이는 양식 공고가 0장(#390): 다른 학교 양식 공고를 복사한 표본을 심고 · 목록을 다시 그리고 · 그 표본을 몬다',
    [s0.error || null, s0.ok, s0.id, s0.calls, s0.planted, s0.rendered], [null, true, 'gate-open-form(←hufs-only)', ['gate-open-form'], true, 1]);
  const s1 = await runDriveAny(drv, { visible: ['a'], list: [A], tpl: TPL, outcome: (id) => (id === 'gate-open-form' ? { ok: true } : LOCKED) });
  eq('  (돌려 봄) 보이는 후보가 전부 마감(#383): 후보를 먼저 몰고 · 잠겼으면 표본으로',
    [s1.error || null, s1.ok, s1.id, s1.calls], [null, true, 'gate-open-form(←a)', ['a', 'gate-open-form']]);
  const s2 = await runDriveAny(drv, { visible: ['a', 'b'], list: [A, B], tpl: TPL, outcome: (id) => (id === 'a' ? LOCKED : id === 'b' ? { ok: false, why: '문서가 비었다' } : { ok: true }) });
  eq('  (돌려 봄) 잠김 말고 다른 이유로 실패한 후보가 있으면 표본을 심지 않고 실패로 남긴다(진짜 고장을 덮지 않는다)',
    [s2.error || null, s2.ok, s2.calls, s2.planted], [null, false, ['a', 'b'], false]);
  const s3 = await runDriveAny(drv, { visible: ['a', 'b'], list: [A, B], tpl: TPL, outcome: (id) => (id === 'a' ? new Error('Timeout 8000ms exceeded') : { ok: true }) });
  eq('  (돌려 봄) 첫 후보가 예외로 넘어져도 다음 후보를 몬다 · 성공하면 표본을 심지 않는다',
    [s3.error || null, s3.ok, s3.id, s3.calls, s3.planted], [null, true, 'b', ['a', 'b'], false]);
  const s4 = await runDriveAny(drv, { visible: [], list: [{ id: 'plain', eligibility: {} }], tpl: {}, outcome: () => ({ ok: true }) });
  eq('  (돌려 봄) 쓸 양식이 하나도 없으면 아무것도 몰지 않고 실패로 남긴다(빨간불을 지우지 않는다)',
    [s4.error || null, s4.ok, s4.calls, s4.planted, /표본 없음/.test(s4.id || '')], [null, false, [], false, true]);

  /* ── ② 화면 검사 워크플로 — 한 곳이 넘어져도 그물이 남는다 ── */
  const SAMPLE = [
    'jobs:', '  x:', '    steps:',
    '      - uses: actions/checkout@v4',
    '      # 사이 주석',
    '      - name: 둘째',
    '        id: two',
    '        if: ${{ !cancelled() }}',
    '        run: node a.js',
    '      - name: 셋째',
    '        if: >',
    '          failure() ||',
    '          cancelled()',
    '        env: { A: \'1\' }',
    '        run: |',
    '          echo 1',
    '          echo 2',
    '', '  y:', '    runs-on: z',
  ].join('\n');
  const ss = stepsOf(SAMPLE);
  eq('② (해석기 자체 점검) 단계 셋 · 이름 · if · 여러 줄 run · 접힌 if',
    [ss.length, ss[1].name, ss[1].id, ss[1].if, ss[1].run, ss[2].if, ss[2].run, ss[0].uses],
    [3, '둘째', 'two', '${{ !cancelled() }}', 'node a.js', 'failure() || cancelled()', 'echo 1\necho 2', 'actions/checkout@v4']);

  const ui = read(root, '.github/workflows/verify-ui.yml');
  const steps = stepsOf(ui);
  const by = (name) => steps.find((s) => s.name === name) || {};
  const drivers = by('화면 검사 (관문)');
  const runLines = String(drivers.run || '').split('\n');
  const nodeLines = runLines.filter((l) => l.includes('node "verify/$f"'));
  eq('  verify-ui.yml 의 단계를 읽어 냈다(헛도는 검사가 아니다)', [steps.length > 10, !!drivers.run, nodeLines.length > 0], [true, true, true]);
  eq('  ⓐ 화면 검사 단계에 `set -e` 가 없다', runLines.some((l) => /^\s*set -e\s*$/.test(l)), false);
  eq('  ⓑ 드라이버 실패를 `||` 로 받아 모은다(기본 셸이 bash -e 라 이게 없으면 첫 실패에서 멈춘다)', nodeLines.every((l) => l.includes('||')), true);
  eq('  ⓒ 모은 실패로 마지막에 한 번 빨간불 · 실패 목록을 출력으로 넘긴다',
    [/\bexit 1\b/.test(drivers.run || ''), /failed=.*>>\s*"\$GITHUB_OUTPUT"/.test(drivers.run || ''), drivers.id], [true, true, 'drivers']);
  /* ⓙ 루프를 **실제로 돌린다**(2026-10-04 코드 리뷰 2차) — 위 ⓑⓒ 는 글자라, 루프 줄을 `|| echo "❌ $f"`(실패를 안 모음)로 바꿔
     화면 검사가 늘 초록으로 끝나도 `||`·`exit 1`·`failed=` 글자가 남아 통과했다(실측). 막으려는 최악이 바로 그 '조용한 초록불'이다. */
  const list = ((/for f in ([\s\S]*?);\s*do\b/.exec(drivers.run || '') || [])[1] || '').split(/[\s\\]+/).filter((x) => /\.js$/.test(x));
  const iReg = list.indexOf('verify-registered.js');
  const iNews = list.indexOf('verify-news.js');
  eq('  ⓙ 드라이버 목록을 읽어 냈다 · verify-registered 와 verify-news 사이에 다른 드라이버가 있다(사이도 도는지 잴 수 있다)',
    [list.length >= 20, iReg >= 0, iNews > iReg + 1], [true, true, true]);
  const two = runDriverLoop(drivers.run || '', { fail: ['verify-registered.js', 'verify-news.js'] });
  eq('  ⓙ (돌려 봄) 둘이 넘어지면: 종료 1 · 출력 failed 가 정확히 그 둘 · 돌리지 못한 것 없음 · 목록 전부가 차례대로 돌았다',
    [two.rc, two.out.failed, two.out.unrun, JSON.stringify(two.ran) === JSON.stringify(list)],
    [1, 'verify-registered.js verify-news.js', '', true]);
  eq('  ⓙ (돌려 봄) 드라이버마다 시한을 걸었다(timeout · 5분 이하)',
    [two.tl.length === list.length, two.tl.every((t) => t > 0 && t <= 300)], [true, true]);
  const none = runDriverLoop(drivers.run || '', {});
  eq('  ⓙ (돌려 봄) 전부 통과하면: 종료 0 · failed 빈 값 · unrun 빈 값 · 전부 돌았다',
    [none.rc, none.out.failed, none.out.unrun, none.ran.length === list.length], [0, '', '', true]);
  const budgetMin = Number((/^budget=\$\(\((\d+)\s*\*\s*60\)\)$/m.exec(drivers.run || '') || [])[1]);
  eq('  ⓚ 루프 전체 예산을 읽어 냈다(budget=$((분*60)))', budgetMin > 0, true);
  const slow = runDriverLoop(drivers.run || '', { step: budgetMin * 60 - 50 });
  eq('  ⓚ (돌려 봄) 예산을 다 쓰면: 새 드라이버를 시작하지 않고 · 남은 이름 전부를 unrun 으로 넘기고 · 실패(1)로 끝난다(취소 대신 경보)',
    [slow.rc, slow.ran, slow.out.unrun, slow.out.failed], [1, list.slice(0, 2), list.slice(2).join(' '), '']);
  eq('  ⓚ (돌려 봄) 드라이버 하나의 시한도 남은 예산을 넘지 않는다(첫째 5분 · 둘째는 남은 50초 안)',
    [slow.tl[0], slow.tl[1] > 0 && slow.tl[1] <= 50], [300, true]);
  const jobCap = Number((/^ {4}timeout-minutes:\s*(\d+)/m.exec(ui) || [])[1]);
  const journeyRun = by('전 여정 회귀 (drive.js)').run || '';
  const journeySec = Number((/\btimeout -k \d+ (\d+) node verify\/drive\.js\b/.exec(journeyRun) || [])[1]);
  eq('  ⓚ 전 여정(drive.js)도 스스로 끝낸다(timeout -k · 5분 이하)', [journeySec > 0, journeySec <= 300], [true, true]);
  eq('  ⓚ 작업 상한 > 화면 검사 예산 + 전 여정 시한 + 준비·값싼 관문 여유 3분 (넘치면 \'취소\'로 끝나 경보가 안 뜬다)',
    jobCap > budgetMin + Math.ceil(journeySec / 60) + 3, true);
  for (const n of ['말투·토큰 관문', '수집기·관리자 규칙 관문 (브라우저 불필요)', '전 여정 회귀 (drive.js)']) {
    eq(`  ⓓ 「${n}」 은 앞 단계가 실패해도 돈다(!cancelled())`, /!cancelled\(\)|always\(\)/.test(by(n).if || ''), true);
  }
  eq('  ⓓ 전 여정은 서버를 띄웠을 때만', [/steps\.server\.outcome == 'success'/.test(by('전 여정 회귀 (drive.js)').if || ''), by('로컬 서버 띄우기').id], [true, 'server']);
  /* (2026-10-04 코드 리뷰) 화면 검사 단계에 조건이 없으면 **그 앞** 값싼 관문 일곱 가운데 하나만 넘어져도 드라이버 전부와 전 여정이
     통째로 건너뛰어진다 — 막으려던 '그물 걷힘'과 같은 꼴. 그래서 브라우저 경로를 잡은 뒤부터 경보 앞까지 **모든** 단계를 하나씩 잰다
     (새 단계를 조건 없이 더해도 여기서 걸린다). */
  const fromAt = steps.findIndex((s) => s.name === '브라우저 경로 찾기');
  const alarmAt = steps.findIndex((s) => s.name === '🚨 화면 검사가 빨간불이다');
  const guarded = steps.slice(fromAt + 1, alarmAt);
  eq('  ⓖ 관문 구간을 읽어 냈다(브라우저 경로 찾기 → 경보 사이 · 값싼 관문 일곱 + 서버 + 화면 검사 + 말투·토큰 + 수집기 규칙 + 전 여정)',
    [fromAt >= 0, alarmAt > fromAt, guarded.length >= 12], [true, true, true]);
  eq('  ⓖ 그 구간의 단계는 전부 앞 단계가 실패해도 돈다(!cancelled()) — 조건 없는 단계 이름',
    guarded.filter((s) => !/!cancelled\(\)|always\(\)/.test(s.if || '')).map((s) => s.name || s.id || s.run), []);
  const browser = steps.find((s) => s.id === 'browser') || {};
  eq('  ⓗ 브라우저 설치 단계에 id: browser (화면 검사·전 여정이 그 성공을 본다)', /playwright@1 install/.test(browser.run || ''), true);
  for (const n of ['화면 검사 (관문)', '전 여정 회귀 (drive.js)']) {
    eq(`  ⓗ 「${n}」 은 서버를 띄우고 브라우저를 깔았을 때만(준비 실패로 드라이버가 다 빨개지는 소음 대신 '돌지 않았다'로 알린다)`,
      [/steps\.server\.outcome == 'success'/.test(by(n).if || ''), /steps\.browser\.outcome == 'success'/.test(by(n).if || '')], [true, true]);
  }
  const alarm = by('🚨 화면 검사가 빨간불이다');
  eq('  ⓔ 경보는 failure() 그대로(cancel-in-progress 취소에 헛경보를 안 낸다)', alarm.if, 'failure()');
  eq('  ⓕ 경보 본문이 옛 설명(`set -e` 로 뒤가 안 돈다)을 하지 않고 실패한 드라이버를 싣는다',
    [/set -e/.test(alarm.run || ''), /steps\.drivers\.outputs\.failed/.test(alarm.raw || ''), /\$\{FAILED/.test(alarm.run || '')], [false, true, true]);
  /* ⓘ 경보가 화면 검사 단계가 **돌았는지**부터 가른다 — 실패 목록만 보면 건너뛴 날에도 '실패한 드라이버: 없음'이라
     하나도 안 돈 것을 다 통과한 것처럼 적었다(CLAUDE.md 매 세션 5). 셸 글을 실제로 돌려 세 갈래 본문을 받는다. */
  const envOf = (k) => ((new RegExp(`^ {10}${k}:\\s*(.+)$`, 'm').exec(alarm.raw || '') || [])[1] || '').trim();
  eq('  ⓘ 경보가 화면 검사 단계의 결과(outcome)·실패 목록·돌리지 못한 목록을 받는다',
    [envOf('DRIVERS'), envOf('FAILED'), envOf('UNRUN')], ['${{ steps.drivers.outcome }}', '${{ steps.drivers.outputs.failed }}', '${{ steps.drivers.outputs.unrun }}']);
  const HEAD = '앱 화면 검사(브라우저)가 빨간불입니다';
  const OLD_LIE = /실패한 드라이버: 없음/;
  const skipped = runAlarm(alarm.run || '', { DRIVERS: 'skipped', FAILED: '' });
  eq('  ⓘ 건너뛴 날(앞 준비 단계 실패): 「돌지 않았습니다」라고 적고 · 「없음」·「전부 통과」라고 하지 않는다',
    [skipped.includes(HEAD), /돌지 않았습니다/.test(skipped), OLD_LIE.test(skipped), /전부 통과/.test(skipped)], [true, true, false, false]);
  const passed = runAlarm(alarm.run || '', { DRIVERS: 'success', FAILED: '' });
  eq('  ⓘ 드라이버는 다 돈 날(다른 단계 실패): 드라이버는 통과 · 빨간 단계는 그 밖이라고 적는다',
    [passed.includes(HEAD), /드라이버는 \*\*전부 통과/.test(passed), /돌지 않았습니다/.test(passed), OLD_LIE.test(passed)], [true, true, false, false]);
  const failed = runAlarm(alarm.run || '', { DRIVERS: 'failure', FAILED: 'verify-x.js verify-y.js' });
  eq('  ⓘ 드라이버가 넘어진 날: 실패한 드라이버 이름을 그대로 싣는다',
    [failed.includes(HEAD), failed.includes('실패한 드라이버: verify-x.js verify-y.js.'), /전부 통과|돌지 않았습니다/.test(failed)], [true, true, false]);
  const unrunOnly = runAlarm(alarm.run || '', { DRIVERS: 'failure', FAILED: '', UNRUN: 'verify-a.js verify-b.js' });
  eq('  ⓘ 예산을 다 써서 못 돈 날: 그 이름을 「돌리지 못한」 것으로 적고 · 「실패한 드라이버」·「끝까지 돌았습니다」라고 하지 않는다',
    [unrunOnly.includes(HEAD), /돌리지 못한 드라이버\W*verify-a\.js verify-b\.js/.test(unrunOnly), /실패한 드라이버:/.test(unrunOnly), /끝까지 돌았습니다/.test(unrunOnly), /목록을 받지 못했습니다/.test(unrunOnly)],
    [true, true, false, false, false]);
  const both = runAlarm(alarm.run || '', { DRIVERS: 'failure', FAILED: 'verify-x.js', UNRUN: 'verify-y.js' });
  eq('  ⓘ 넘어진 것과 못 돈 것이 함께면 둘을 갈라 적는다',
    [both.includes('실패한 드라이버: verify-x.js.'), /돌리지 못한 드라이버\W*verify-y\.js/.test(both), /끝까지 돌았습니다/.test(both)], [true, true, false]);
  const noList = runAlarm(alarm.run || '', { DRIVERS: 'failure', FAILED: '' });
  eq('  ⓘ 실패했는데 목록이 비면 「없음」이 아니라 목록을 못 받았다고 적는다',
    [noList.includes(HEAD), /목록을 받지 못했습니다/.test(noList), OLD_LIE.test(noList)], [true, true, false]);

  /* ── ③ 작업 브랜치 배포 뒤 화면 검사를 깨운다 ── */
  const dd = read(root, '.github/workflows/device-deploy.yml');
  const perm = (/^permissions:\n((?: {2}.*\n?)*)/m.exec(dd) || [])[1] || '';
  eq('③ device-deploy 권한에 actions: write(화면 검사를 깨울 열쇠)', /^ {2}actions: write\b/m.test(perm), true);
  const wake = stepsOf(dd).find((s) => /gh workflow run verify-ui\.yml/.test(s.run || ''));
  eq('  배포가 끝났을 때만 깨우고 · 깨우기 실패가 배포를 실패로 보이게 하지 않는다',
    wake ? [/steps\.run\.outputs\.state == 'deployed'/.test(wake.if || ''), wake['continue-on-error'], /--ref claude\/nice-heisenberg-WESq5/.test(wake.run)] : null,
    [true, 'true', true]);
  eq('  verify-ui.yml 이 버튼 실행(workflow_dispatch)을 받는다 — 지우면 깨우기가 조용히 실패한다', /^ {2}workflow_dispatch:/m.test(ui), true);

  /* ── ④ 양식을 고친 그날 모르는 자기소개서 칸을 경고한다 ── */
  const T = { t1: { sections: [{ fields: [
    { id: 'a', type: 'textarea', kind: 'story', label: '성장과정' },
    { id: 'b', type: 'textarea', kind: 'story', label: '특이사항 서술' },
    { id: 'c', type: 'textarea', kind: 'fact', label: '특이사항 서술' },
    { id: 'd', type: 'text', label: '특이사항 서술' },
  ] }] } };
  eq('④ 서술형(story) 칸 가운데 종류를 못 알아본 것만 집는다', unknownStoryFields(T), [{ form: 't1', id: 'b', label: '특이사항 서술' }]);
  eq('  사람이 적어 둔 질문(ask)이 있는 칸은 모르는 칸이 아니다',
    unknownStoryFields({ t: { sections: [{ fields: [{ id: 'x', type: 'textarea', kind: 'story', label: '특이사항 서술', ask: [{ q: 'a' }, { q: 'b' }] }] }] } }), []);
  const audit = read(root, 'verify/audit-data.js');
  const auditBlock = (audit.match(/require\('\.\/essay-unknown-fields\.cjs'\)[\s\S]*?\n\}/) || [''])[0];
  eq('  데이터 감사가 같은 함수로 양식 전부를 보고 **경고**로 적는다(오류면 그날 자동 등록분이 되돌려진다)',
    [/unknownStoryFields\(forms\.templates\)/.test(auditBlock), /warns\.push\([^;]*자기소개서 칸/.test(auditBlock), /errors\.push/.test(auditBlock)],
    [true, true, false]);
  const weekly = read(root, 'verify/verify-essay-ask.mjs');
  eq('  주간 검사(verify-essay-ask)도 같은 함수를 부른다 — 경고와 검사가 갈라지지 않는다',
    [/require\('\.\/essay-unknown-fields\.cjs'\)/.test(weekly), /unknownStoryFields\(T\)/.test(weekly), /essayAskFor\(f\)\.kind === 'generic'/.test(weekly)],
    [true, true, false]);
}
