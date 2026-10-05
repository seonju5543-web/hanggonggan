/* 「로봇·도구 점검 관문」 — admin 묶음: 관리자 화면 버튼 길이 실제로 끝까지 가는가 (2026-10-04)
   사고·진단:
     F1 저장소(tools/admin-apply.mjs)는 6건 이상(또는 목록의 10% 초과) 지우면 지울 건수(expect)를 요구하는데,
        화면(_admin/admin.js)은 숫자 칸 없이 보내 그런 되돌리기·삭제가 늘 '받은 값: 없음'으로 거절됐다.
        → 문턱을 한 곳(tools/edit-diff.mjs needsBulkExpect)에 두고 화면·저장소가 같이 부른다.
     F4 관리자 조정은 수집 로봇과 같은 대기줄(collector)에 선다 — GitHub 은 기다리는 실행 하나만 남기고 새로 온 것이
        기다리던 것을 시작 전에 취소한다. → 화면이 보내기 전에 줄을 보고(COLLECTOR_QUEUE), 줄 서는 동안은 따로 말한다.
     F6 _admin/README.md 의 Cloudflare 빌드 감시 목록에서 build.sh 원본 일곱이 빠져 있었다.
        (F3·F12 — 미리보기 vendor 목록·워크플로 작업 목록 어긋남 — 은 다른 세션이 고쳤다. 다시 어긋나지 않게 같이 잰다.)
     F9 실패는 무엇이든 '검사를 통과하지 못해 되돌렸습니다'였다(대부분은 감사가 아니라 입력 거절) → 단계 결과로 가른다.
     F10 버튼 길이 08-09 이후 Actions 에서 한 번도 안 돌았다 → 저장하지 않는 시험 실행(dry_run) 스위치.
   🔴 어디서나 엄격한 것은 표본(needsBulkExpect 고정 예시)뿐이다. 관리자 도구 파일끼리의 대조(정적 대조·경보 셸)는
      로봇 워크플로에서는 어긋나도 **경고만** 한다(softEq — alerts·servers·insta 묶음과 같은 잣대) — 이 관문은 test-collector 를 거쳐
      **수집 로봇의 데이터 관문**으로도 돌아서, 관리자 도구 목록이 어긋난 것이 그날 자동 등록분을 되돌리면 안 된다
      (verify/verify-admin-vendor.js 머리말과 같은 이유). 로컬과 화면 검사(verify-ui.yml · DOC_GATES=1)에서는 그대로 실패한다.
   🔴 data/·collector 장부는 읽지 않는다. 화면 동작은 verify/verify-admin.js(브라우저)가 잰다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stepsOf } from './ci.mjs';
import { softEq } from './alerts.mjs';

const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');

/* 글로브 → 정규식 (`*` 는 `/` 를 안 넘는다 · `**` 는 넘는다 — test-collector 「CI 감시 범위」와 같은 해석) */
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`);

/* build.sh 가 관리자 화면으로 옮기는 원본 — cp 의 원본들과 cat 으로 감싸는 파일. { src, dest } */
export function buildSources(sh) {
  const out = [];
  for (const m of String(sh).matchAll(/^\s*cp\s+(.+)$/gm)) {
    const toks = m[1].trim().split(/\s+/).filter((t) => !t.startsWith('-'));   // cp -r 같은 선택지는 원본이 아니다
    const dest = toks.pop().replace(/^"|"$/g, '');
    toks.forEach((src) => out.push({ src, dest }));
  }
  for (const m of String(sh).matchAll(/^\s*cat\s+(\S+)\s*$/gm)) {
    /* 감싼 결과가 가는 곳 — 같은 { … } 묶음 끝의 `> "$OUT/vendor/x"` */
    const tail = String(sh).slice(m.index);
    const to = (/\}\s*>\s*"([^"]+)"/.exec(tail) || [])[1] || '';
    out.push({ src: m[1], dest: to });
  }
  return out;
}

/* README 「빌드 감시 경로」 코드 블록의 줄들 */
export function readmeWatchList(md) {
  const i = String(md).indexOf('빌드 감시 경로');
  if (i < 0) return [];
  const a = md.indexOf('```', i);
  const b = a < 0 ? -1 : md.indexOf('```', a + 3);
  if (b < 0) return [];
  return md.slice(a + 3, b).split('\n').map((s) => s.trim()).filter(Boolean);
}

/* `{ 'a': 'b', … }` 꼴 객체 글자에서 열쇠 → 값 (값이 함수면 열쇠만 쓴다) */
function objectKeys(src, name) {
  const i = src.indexOf(`const ${name} = {`);
  if (i < 0) return {};
  const j = src.indexOf('\n};', i);
  const body = src.slice(i, j < 0 ? undefined : j);
  const out = {};
  for (const m of body.matchAll(/^\s*'([^']+)':\s*(?:'([^']*)')?/gm)) out[m[1]] = m[2] === undefined ? true : m[2];
  return out;
}

/* 경보 단계의 셸 글을 실제로 돌려 이슈 본문을 받는다 — 진짜 gh 는 절대 안 부른다(같은 이름 셸 함수가 먼저 잡히고 열쇠·집 폴더를 안 넘긴다) */
function runAlarm(script, env) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-alarm-'));
  const fake = 'gh() { while [ $# -gt 0 ]; do if [ "$1" = --body ]; then printf \'%s\' "$2"; fi; shift; done; }';
  try {
    const r = spawnSync('bash', ['-c', `${fake}\n${script}`], {
      encoding: 'utf8', timeout: 10000,
      env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: home, GH_CONFIG_DIR: home, REPO: 'gate/none', RUN_URL: 'gate', ACTION_NAME: 'revert', WHO: 'gate', ...env },
    });
    return r.status === 0 ? r.stdout : `(셸 실패 ${r.status} ${String(r.error || r.stderr || '').slice(0, 120)})`;
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const ED = await import('../../tools/edit-diff.mjs');

  /* ── F1 표본 (늘 돈다) — 많이 지울 때 숫자를 받는 문턱: 5건 초과 또는 목록의 10% 초과 ── */
  eq('F1 needsBulkExpect — (6건, 152건)=예 · (5, 152)=아니요 · (2, 5)=예(10% 초과) · (3, 50)=아니요 · (1, 9)=예(한 건도 작은 목록이면)',
    [[6, 152], [5, 152], [2, 5], [3, 50], [1, 9]].map(([w, b]) => ED.needsBulkExpect(w, b)), [true, false, true, false, true]);

  /* 관리자 도구 파일 대조의 엄격함 — test-collector 문서 관문(DOC_GATES)·다른 묶음과 같은 잣대(로컬이거나 DOC_GATES=1 이면 엄격) */
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 관리자 도구 파일 대조는 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');
  eq = softEq(eq, DOC_GATES);

  const adminJs = read(root, '_admin/admin.js');
  const applyMjs = read(root, 'tools/admin-apply.mjs');
  const ay = read(root, '.github/workflows/admin-apply.yml');
  const steps = stepsOf(ay);

  /* ── 관리자 화면이 모듈로 읽히는가 (2026-10-05 · admin 재시도에서 실제로 겪음) ──
     🔴 `node --check _admin/admin.js` 는 **틀린 파일도 통과시킨다** — 확장자가 .js 라 모듈로 재지 않고 넘어간다.
        이번에 실패 문구 표(STEP)가 같은 파일의 STEP(50)과 이름이 겹쳐 '이미 선언됨'으로 **화면 전체가 안 떴는데** 그 검사는 초록이었다.
        그래서 .mjs 이름의 사본으로 모듈 문법을 잰다(실행하지 않는다 — --check 는 읽기만 한다). */
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-syntax-'));
    try {
      const copy = path.join(dir, 'admin.mjs');
      fs.writeFileSync(copy, adminJs);
      const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8', timeout: 20000 });
      eq('관리자 화면(_admin/admin.js)이 모듈 문법으로 읽힌다 (같은 이름을 두 번 선언하면 화면 전체가 안 뜬다)',
        r.status === 0 ? 'ok' : String(r.stderr || r.error || '').split('\n').find((l) => /Error/.test(l)) || `종료 ${r.status}`, 'ok');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  /* ── F1 배선 — 문턱은 edit-diff 한 곳 · 화면이 숫자를 실어 보낸다 ── */
  const goAt = adminJs.indexOf("closest('[data-bulk-go]')");
  /* 처리기 몸통 — 다음 처리기(줄 누르기 [data-row][data-id])까지. 그 사이에 applyAction 이 expect 를 싣는다 */
  const goEnd = goAt < 0 ? -1 : adminJs.indexOf("closest('[data-row][data-id]')", goAt);
  const goSeg = goEnd < 0 ? '' : adminJs.slice(goAt, goEnd);
  const bulkFn = adminJs.slice(adminJs.indexOf('async function bulkAction('), adminJs.indexOf('/* 선택 바만 갈아 끼운다'));
  eq('F1 배선 — 저장소는 needsBulkExpect 를 edit-diff 에서 가져오고 문턱 상수를 따로 두지 않는다 · 화면도 vendor/edit-diff 에서 가져와 시트에 숫자 칸을 그리고, 실행 버튼이 expect 를 싣는다',
    [/import \{[^}]*\bneedsBulkExpect\b[^}]*\} from '\.\/edit-diff\.mjs'/.test(applyMjs), /needsBulkExpect\(willRemove, before\)/.test(applyMjs),
      /const BULK_(MIN|RATIO)\b/.test(applyMjs),
      /import \{[^}]*\bneedsBulkExpect\b[^}]*\} from '\.\/vendor\/edit-diff\.mjs'/.test(adminJs),
      /needsBulkExpect\(items\.length, D\.reg\.length\)/.test(bulkFn) && /bulkExpectHtml\(/.test(bulkFn),
      goSeg.length > 0 && /expect:/.test(goSeg)],
    [true, true, false, true, true, true]);

  /* ── F4 — 화면의 대기줄 목록 == 워크플로들의 group: collector ── */
  const wfDir = new URL('.github/workflows/', root);
  const inCollector = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml'))
    .filter((f) => /^\s*(?:group|concurrency):\s*['"]?collector['"]?\s*$/m.test(read(root, `.github/workflows/${f}`))).sort();
  const queue = (((/const COLLECTOR_QUEUE = \[([^\]]*)\]/.exec(adminJs)) || [])[1] || '').match(/'([^']+)'/g) || [];
  eq('F4 관리자 화면 COLLECTOR_QUEUE == concurrency group 이 정확히 collector 인 워크플로 (로봇이 줄에 새로 들어오면 화면 목록도 — 둘 다 비면 못 읽은 것)',
    [queue.map((x) => x.slice(1, -1)).sort(), inCollector.length > 1], [inCollector, true]);
  /* 함수 몸통에서 줄 확인이 보내기보다 먼저 오는가 — 관리자 조정(applyAction)과 로봇 '지금 실행'(reallyRun) 둘 다 */
  const checksFirst = (fn) => {
    const a = adminJs.indexOf(`async function ${fn}(`);
    if (a < 0) return false;
    const seg = adminJs.slice(a, adminJs.indexOf('\n}\n', a));
    const q = seg.indexOf('collectorQueueState()');
    return q > 0 && q < seg.indexOf('dispatchWorkflow(');
  };
  eq('  보내기 전에 줄을 본다 — 관리자 조정(applyAction)·로봇 지금 실행(reallyRun)이 dispatch 앞에서 collectorQueueState 를 부른다',
    [checksFirst('applyAction'), checksFirst('reallyRun')], [true, true]);

  /* ── F6 ⓐ README 감시 목록 ⊇ build.sh 원본 ── */
  const sh = read(root, '_admin/build.sh');
  const srcs = buildSources(sh);
  const watch = readmeWatchList(read(root, '_admin/README.md')).map(globRe);
  eq('F6ⓐ _admin/README.md 「빌드 감시 경로」가 build.sh 가 옮기는 원본을 전부 덮는다 (빠진 것 — Cloudflare 설정에도 더할 것)',
    [srcs.length > 10, watch.length > 0, [...new Set(srcs.map((s) => s.src))].filter((f) => !watch.some((r) => r.test(f)))],
    [true, true, []]);

  /* ── F6 ⓑ build.sh 의 vendor 사본 ↔ 미리보기(tools/build-admin-preview.mjs) 목록 (F3 재발 방지) ── */
  const pv = read(root, 'tools/build-admin-preview.mjs');
  const VSRC = objectKeys(pv, 'VENDOR_SRC');
  const VEND = objectKeys(pv, 'VENDOR');
  const vend = srcs.filter((s) => /\$OUT\/vendor\//.test(s.dest)).map((s) => ({ ...s, name: s.dest.split('/').pop() }));
  eq('F6ⓑ build.sh 의 vendor 사본마다 미리보기도 안다 — .mjs 는 VENDOR_SRC[이름] === 원본 · 그 밖(.js·감싼 entry-rules.js)은 VENDOR[vendor/이름] (어긋난 것)',
    [vend.length > 5, Object.keys(VSRC).length > 0, Object.keys(VEND).length > 0,
      vend.filter((v) => (v.name.endsWith('.mjs') ? VSRC[v.name] !== v.src : !VEND[`vendor/${v.name}`])).map((v) => `${v.name} ← ${v.src}`)],
    [true, true, true, []]);

  /* ── F6 ⓒ 워크플로 작업 목록(사람이 읽는 줄) == 저장소 switch 의 case (F12 재발 방지) ── */
  const desc = ((/description:\s*'작업 \(([^)]*)\)'/.exec(ay)) || [])[1] || '';
  const listed = desc.split(' / ').map((s) => s.trim()).filter(Boolean).sort();
  const cases = [...applyMjs.matchAll(/^ {2}case '([^']+)':/gm)].map((m) => m[1]).sort();
  eq('F6ⓒ admin-apply.yml 작업 목록 == tools/admin-apply.mjs 의 case 목록 (둘 다 비면 못 읽은 것)',
    [listed.length > 10, listed], [true, cases]);

  /* ── F9 — 화면이 가르는 단계 이름이 워크플로에 글자 그대로 있다 · 🚨 본문이 단계 결과로 갈린다 ── */
  const stepNames = new Set(steps.map((s) => s.name).filter(Boolean));
  const stepBlock = ((/^const APPLY_STEP = \{([\s\S]*?)\n\};/m.exec(adminJs)) || [])[1] || '';
  const names = [...stepBlock.matchAll(/^\s*\w+:\s*'([^']+)'/gm)].map((m) => m[1]);
  eq('F9 화면(admin.js APPLY_STEP)이 가르는 단계 이름이 admin-apply.yml 의 name: 에 모두 있다 (없는 것)',
    [names.length >= 3, names.filter((n) => !stepNames.has(n))], [true, []]);
  const alarm = steps.find((s) => /실패 알림/.test(s.name || ''));
  eq('  🚨 단계가 단계 결과를 받는다 — apply·audit·save outcome · 저장 단계에 id: save',
    [!!alarm && /steps\.apply\.outcome/.test(alarm.raw) && /steps\.audit\.outcome/.test(alarm.raw) && /steps\.save\.outcome/.test(alarm.raw),
      steps.some((s) => s.name === '저장' && s.id === 'save')],
    [true, true]);
  const bodyOf = (env) => runAlarm((alarm && alarm.run) || 'exit 3', env);
  const bApply = bodyOf({ APPLY: 'failure', AUDIT: 'skipped', SAVE: 'skipped' });
  const bAudit = bodyOf({ APPLY: 'success', AUDIT: 'failure', SAVE: 'skipped' });
  const bSave = bodyOf({ APPLY: 'success', AUDIT: 'success', SAVE: 'failure' });
  const bStop = bodyOf({ APPLY: 'success', AUDIT: 'success', SAVE: '' });
  eq('  🚨 본문(셸을 실제로 돌림) — 입력 거절은 「요청 내용 적용」 · 감사는 감사 · 저장은 저장 · 그 밖은 저장 여부를 단정하지 않는다 · 어느 것도 옛 \'감사 탓\' 문장이 없다',
    [/요청 내용 적용/.test(bApply) && /바뀌지 않았습니다/.test(bApply), /데이터 감사를 통과하지 못해/.test(bAudit), /저장\(push\)에 실패/.test(bSave),
      /저장됐는지는 실행 기록에서/.test(bStop) && !/바뀌지 않았습니다/.test(bStop),
      [bApply, bAudit, bSave, bStop].some((b) => /감사를 통과하지 못하면 되돌리도록/.test(b))],
    [true, true, true, true, false]);

  /* ── F10 — 시험 실행: 적용·감사까지만, 저장 안 함, 이슈 안 엶 ── */
  const save = steps.find((s) => s.name === '저장');
  const dry = steps.find((s) => /시험 실행/.test(s.name || ''));
  eq('F10 시험 실행(dry_run) — 입력이 boolean · 저장은 dry_run 이 아닐 때만 · 시험 단계는 감사 통과 + dry_run 일 때 push 없이 · 🚨 이슈는 dry_run 이 아닐 때만',
    [/\n {6}dry_run:\n(?: {8}.*\n)*? {8}type: boolean/.test(ay),
      !!save && /!inputs\.dry_run/.test(save.if || ''),
      !!dry && /steps\.audit\.outcome == 'success'/.test(dry.if || '') && /inputs\.dry_run/.test(dry.if || '') && !/!inputs\.dry_run/.test(dry.if || '') && !/git (push|commit)/.test(dry.run || ''),
      !!alarm && /!inputs\.dry_run/.test(alarm.if || '')],
    [true, true, true, true]);
}
