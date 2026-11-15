/* 「로봇·도구 점검 관문」 — savegate 묶음: 저장하는 로봇은 저장 **앞에** 관문을 거치는가 (2026-11-15 · 노션 G-16)
   사고(10-13 실측): 저장하는 워크플로 25개 중 규칙 관문(test-collector)을 저장 앞에 둔 것은 11개 — 데이터 감사만 5 · 아무것도 없음 9.
     관문 없이 저장한 로봇 하나가 규칙 파일을 어기면 **그날 돈 다른 로봇 전부**가 관문에 걸려 제 결과를 되돌린다
     (10-13 층2 사냥꾼: 증거 2건짜리 게시판을 외부 출처 목록에 적어 수집·브라우저·링크 사냥꾼이 6회 빨간불).
   규칙(CLAUDE.md 매 세션 7):
     · `collector/*.json`(규칙 파일 · collector 바로 밑 json)이나 `data/` 를 저장하면 → 규칙 관문(verify/test-collector.mjs)이 저장 앞에
     · `data/` 를 저장하면 → 데이터 감사(verify/audit-data.js)도 저장 앞에
     · '앞에'는 같은 job 안, 로봇이 파일을 쓴 단계 **뒤** · 저장 단계는 관문이 빨가면 돌지 않아야 한다
       (저장 단계의 if 가 관문 단계 결과를 보거나 · 관문 단계가 continue-on-error 없이 넘어지고 저장 단계가 always() 로 덮지 않거나 · 같은 단계 안에서 관문이 먼저).
   🔴 톱니(ratchet): 지금 관문이 없는 저장 job 은 아래 SAVE_GATE_EXCEPTIONS 에 이유 한 줄과 함께 있다 —
      새 저장 job 이 관문 없이 생기면 빨간불 · 목록에 있는 job 이 관문을 갖추면(또는 저장을 그만두면) 그것도 빨간불(목록에서 지우라고) → 목록은 줄기만 한다.
   🔴 저장 여부는 `git add <경로>` 로 본다(주석 줄은 걷어 낸다) — 커밋 옮기기 로봇(deploy-sync·main-guard·device-deploy·rollback)은 git add 가 없어 저장 로봇이 아니다.
   🔴 YAML 해석기를 들이지 않는다(수집 로봇도 이 관문을 돌린다 · npm 설치 없음) — ci 묶음의 stepsOf · alerts 묶음의 jobsOf 를 불러 쓴다.
   🔴 표본(고정 YAML 글)으로 규칙을 red-green 하고, 실제 워크플로 대조는 softEq(로봇 워크플로에서는 경고만 · 로컬·verify-ui DOC_GATES=1 에서 실패). */
import fs from 'node:fs';
import { stepsOf } from './ci.mjs';
import { jobsOf, softEq } from './alerts.mjs';

export const RULE_GATE_RE = /\bverify\/test-collector\.mjs\b/;
export const DATA_GATE_RE = /\bverify\/audit-data\.js\b/;
/** 되돌리기 — gate-guard(되돌리고 다시 잰다) · git checkout/restore(직전 판으로) */
export const REVERT_RE = /\bcollector\/gate-guard\.mjs\b|\bgit\s+(checkout|restore)\b/;

/** 관문이 없는 저장 job — `파일#job` → 이유 한 줄. 🔴 줄기만 한다(관문을 붙였으면 여기서 지운다 · 새로 더하지 말 것) */
export const SAVE_GATE_EXCEPTIONS = {
  'admin-apply.yml#apply': '관리자 버튼 — 감사만 돈다: test-collector 만 알던 규칙은 감사·저장소 거절로 옮겼다(관문 gate ② · 10-04) · 남의 빨간불에 관리자 수정이 막히지 않게',
  'audit-coverage.yml#audit': '쓰는 json 은 제 기록장(coverage-history·coverage-cursor)뿐 — 관문·감사·다른 로봇이 읽지 않는다(11-15 grep) · 걸면 남의 빨간불에 감사만 멈춘다',
};

const codeLines = (t) => String(t || '').split('\n').filter((l) => !/^\s*#/.test(l));

/** 셸 글에서 `git add` 가 올리는 경로들 — 줄 이어 쓰기(\) 를 잇고, 주석 줄·꼬리 주석은 걷는다.
    `-A`·`--all` 만 있고 경로가 없으면 '*'(전부). 변수 경로(`$f`)는 '?'(모름 — 저장으로 센다) */
export function addedPaths(run) {
  const text = codeLines(run).join('\n').replace(/\\\n/g, ' ');
  const out = [];
  for (const m of text.matchAll(/\bgit\s+add\b([^\n;&|]*)/g)) {
    const args = m[1].replace(/\s#.*$/, '').replace(/\s\d?>\S*/g, ' ').trim().split(/\s+/).filter(Boolean);
    const paths = args.filter((a) => !a.startsWith('-')).map((a) => a.replace(/^["']|["']$/g, ''));
    if (!paths.length) { if (args.some((a) => a === '-A' || a === '--all' || a === '-u')) out.push('*'); continue; }
    for (const p of paths) out.push(/\$/.test(p) ? '?' : p.replace(/^\.\//, ''));
  }
  return out;
}

/** 이 경로를 저장하면 어떤 관문이 필요한가 — { rule, data } */
export function needsOf(paths) {
  const need = { rule: false, data: false };
  for (const p of paths) {
    if (p === '*' || p === '?' || p === '.') { need.rule = true; need.data = true; continue; }
    const q = p.replace(/\/+$/, '');
    if (q === 'data' || q.startsWith('data/')) { need.rule = true; need.data = true; }
    if (q === 'collector' || /^collector\/[^/]+\.json$/.test(q) || /^collector\/\*/.test(q)) need.rule = true;
  }
  return need;
}

const hasAlways = (cond) => /\b(always|failure|cancelled)\s*\(\)/.test(String(cond || ''));
const truthyCoe = (s) => /^(true|'true'|"true")$/.test(String(s['continue-on-error'] || '').trim());
/** 관문 줄이 빨간불을 삼키는가 — `|| true` · `|| :` · `|| echo …`(뒤에 exit 없음) */
const swallowed = (line) => /\|\|\s*(true|:)\b/.test(line) || (/\|\|\s*echo\b/.test(line) && !/exit\s+[1-9]/.test(line));

/** 단계 하나가 거치는 관문 — 셸 글의 줄 중 관문을 부르고 삼키지 않는 줄. 반환 { rule, data } (그 단계 run 의 첫 git add 앞 줄만 셀 수 있게 upto 를 준다) */
function gatesIn(run, upto = Infinity) {
  const g = { rule: false, data: false };
  const lines = codeLines(run).join('\n').replace(/\\\n/g, ' ').split('\n');
  for (let i = 0; i < lines.length && i < upto; i += 1) {
    if (swallowed(lines[i])) continue;
    if (RULE_GATE_RE.test(lines[i])) g.rule = true;
    if (DATA_GATE_RE.test(lines[i])) g.data = true;
  }
  return g;
}
const firstAddLine = (run) => codeLines(run).join('\n').replace(/\\\n/g, ' ').split('\n').findIndex((l) => /\bgit\s+add\b/.test(l));

/** 파일을 쓰는 단계인가 — 로봇·도구를 부르는 run(node·python·bash 스크립트). 관문·되돌리기·알림 도구는 뺀다 */
function producing(s) {
  const run = codeLines(s.run).join('\n');
  if (!run.trim()) return false;
  if (/\bgit\s+add\b/.test(run)) return false;
  const calls = [...run.matchAll(/\b(?:node|python3?|bash)\s+([^\s;&|]+)/g)].map((m) => m[1]);
  return calls.some((c) => !/^(verify\/|collector\/gate-guard\.mjs|tools\/alert-issue\.mjs|tools\/setup-collab\.sh|-e$|-c$|--check$)/.test(c));
}

/** 워크플로 글 하나 → 저장 job 마다 { job, needs, has, ok, why } */
export function saveGateReport(yml) {
  const res = [];
  for (const job of jobsOf(yml)) {
    const steps = stepsOf(job.text);
    const saves = steps.map((s, i) => ({ s, i, paths: addedPaths(s.run) })).filter((x) => x.paths.length);
    if (!saves.length) continue;
    const need = { rule: false, data: false };
    for (const x of saves) { const n = needsOf(x.paths); need.rule ||= n.rule; need.data ||= n.data; }
    if (!need.rule && !need.data) continue;
    /* 저장 단계마다 그 앞(같은 job · 마지막 '파일을 쓰는 단계' 뒤)의 관문 중 저장을 막을 수 있는 것 */
    const perSave = saves.map(({ s, i, paths }) => {
      const n = needsOf(paths);
      const got = gatesIn(s.run, firstAddLine(s.run));            // 같은 단계 안에서 git add 앞
      let lastProd = -1;
      for (let k = 0; k < i; k += 1) if (producing(steps[k])) lastProd = k;
      for (let k = lastProd + 1; k < i; k += 1) {
        const g = steps[k];
        const gg = gatesIn(g.run);
        if (!gg.rule && !gg.data) continue;
        const cond = String(s.if || '');
        const looksAt = g.id && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'success'`).test(cond);
        /* 되돌리기 짝 — 관문이 빨가면 되돌린다(gate-guard 가 되돌리고 다시 재거나 · git checkout 으로 직전 판).
           관문 단계와 저장 단계 사이에 있고, 그 관문의 실패를 보고 돈다 */
        const guarded = g.id && steps.slice(k + 1, i).some((r) => REVERT_RE.test(codeLines(r.run).join('\n'))
          && new RegExp(`steps\\.${g.id}\\.(outcome|conclusion)\\s*==\\s*'failure'`).test(String(r.if || '')));
        const blocks = looksAt || guarded || (!truthyCoe(g) && !hasAlways(cond));
        if (!blocks) continue;
        got.rule ||= gg.rule; got.data ||= gg.data;
      }
      const miss = [];
      if (n.rule && !got.rule) miss.push('규칙 관문(test-collector)');
      if (n.data && !got.data) miss.push('데이터 감사(audit-data)');
      return { name: s.name || s.uses || `단계 ${i + 1}`, paths, miss };
    });
    const miss = [...new Set(perSave.flatMap((p) => p.miss))];
    res.push({ job: job.name, need, ok: !miss.length, miss, saves: perSave });
  }
  return res;
}

/** 워크플로 폴더 전부({파일: 글}) → 관문이 없는 저장 job 열쇠(`파일#job`) 목록 */
export function ungatedSavers(files) {
  const out = [];
  for (const [f, yml] of Object.entries(files)) for (const r of saveGateReport(yml)) if (!r.ok) out.push(`${f}#${r.job}`);
  return out.sort();
}

/** 톱니 — 관문 없는 저장 job 과 예외 목록을 맞댄다. fresh = 목록에 없는데 관문 없이 저장(새로 생김) · stale = 목록에 있는데 이제 관문이 있거나 저장 안 함(지울 것) */
export function ratchet(ungated, exceptions) {
  const listed = new Set(Object.keys(exceptions));
  const now = new Set(ungated);
  return { fresh: [...now].filter((k) => !listed.has(k)).sort(), stale: [...listed].filter((k) => !now.has(k)).sort() };
}

/* ── 표본 YAML — 이 저장소 워크플로의 꼴 그대로(jobs: 두 칸 · 단계 여섯 칸) ── */
const wfOf = (steps) => `name: 표본\non:\n  workflow_dispatch:\njobs:\n  run:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - uses: actions/checkout@v7\n${steps}`;
const ROBOT = '      - name: 로봇\n        run: node collector/robot.mjs\n';
const SAVE = (paths, cond = '') => `      - name: 저장\n${cond ? `        if: ${cond}\n` : ''}        run: |\n          git config user.name bot\n${paths.map((p) => `          [ -f ${p} ] && git add ${p}\n`).join('')}          git commit -m x && git push\n`;
const GATE = (cmds, { id = 'audit', coe = false, cond = '' } = {}) => `      - name: 데이터 관문\n        id: ${id}\n${cond ? `        if: ${cond}\n` : ''}${coe ? '        continue-on-error: true\n' : ''}        run: |\n${cmds.map((c) => `          ${c}\n`).join('')}`;
const TC = 'node verify/test-collector.mjs';
const AU = 'node verify/audit-data.js';
export const SAMPLES = {
  noGate: wfOf(ROBOT + SAVE(['data/x.json'])),
  gateHard: wfOf(ROBOT + GATE([TC, AU]) + SAVE(['data/x.json', 'collector/x-state.json'])),
  gateSoftAlways: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + SAVE(['data/x.json'], 'always()')),
  gateSoftChecked: wfOf(ROBOT + GATE([TC, AU], { coe: true }) + SAVE(['data/x.json'], "always() && steps.audit.outcome == 'success'")),
  gateSoftGuard: wfOf(ROBOT + GATE([TC, AU], { coe: true })
    + "      - name: 되돌리기\n        id: guard\n        if: steps.audit.outcome == 'failure'\n        run: node collector/gate-guard.mjs --keep-preexisting --stage data/x.json || git checkout -- data/x.json\n"
    + SAVE(['data/x.json'])),
  gateBeforeRobot: wfOf(GATE([TC, AU]) + ROBOT + SAVE(['data/x.json'])),
  auditOnly: wfOf(ROBOT + GATE([AU]) + SAVE(['data/x.json'])),
  ruleOnlyForRules: wfOf(ROBOT + GATE([TC]) + SAVE(['collector/x-state.json', 'collector/x-report.md'])),
  ruleFileNoGate: wfOf(ROBOT + SAVE(['collector/x-state.json'])),
  notRuleFiles: wfOf(ROBOT + SAVE(['collector/x-report.md', 'collector/extracted/x.json', 'insta/seen.json', 'docs/designs/assets/gates'])),
  commentOnly: wfOf(ROBOT + '      - name: 저장\n        run: |\n          # git add data/x.json 은 하지 않는다\n          git add insta/seen.json\n'),
  sameStep: wfOf(ROBOT + `      - name: 관문과 저장\n        run: |\n          ${TC}\n          ${AU}\n          git add data/x.json\n`),
  sameStepSwallow: wfOf(ROBOT + `      - name: 관문과 저장\n        run: |\n          ${TC} || true\n          ${AU} || true\n          git add data/x.json\n`),
  gateAfterSave: wfOf(ROBOT + SAVE(['data/x.json']) + GATE([TC, AU])),
  twoJobs: `${wfOf(ROBOT + GATE([TC, AU]) + SAVE(['data/x.json']))}  other:\n    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n${ROBOT}${SAVE(['data/y.json'])}`,
  addAll: wfOf(ROBOT + '      - name: 저장\n        run: |\n          git add -A\n          git commit -m x\n'),
};

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqWf = softEq(eq, DOC_GATES);
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 실제 워크플로 대조는 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');

  /* ① 표본 red-green — 규칙이 무력해지면(늘 통과) 여기서 빨개진다 */
  const ok = (k) => saveGateReport(SAMPLES[k]).map((r) => [r.job, r.ok, r.miss]);
  eq('① 관문 없이 data/ 를 저장 → 둘 다 빠짐', ok('noGate'), [['run', false, ['규칙 관문(test-collector)', '데이터 감사(audit-data)']]]);
  eq('  로봇 뒤·저장 앞 관문(continue-on-error 없음 · 저장 단계 if 없음) → 통과', ok('gateHard'), [['run', true, []]]);
  eq('  관문이 continue-on-error 인데 저장이 always() 로 덮으면 → 관문이 저장을 못 막는다', ok('gateSoftAlways').map((r) => r[1]), [false]);
  eq('  continue-on-error 라도 저장 if 가 관문 성공을 보면 → 통과', ok('gateSoftChecked').map((r) => r[1]), [true]);
  eq('  continue-on-error 라도 관문 실패를 보고 되돌리는(gate-guard) 단계가 사이에 있으면 → 통과', ok('gateSoftGuard').map((r) => r[1]), [true]);
  eq('  관문이 로봇보다 **앞**이면(파일을 쓰기 전에 잰 것) → 빠짐', ok('gateBeforeRobot').map((r) => r[1]), [false]);
  eq('  관문이 저장 **뒤**면 → 빠짐', ok('gateAfterSave').map((r) => r[1]), [false]);
  eq('  data/ 인데 감사만 → 규칙 관문 빠짐', ok('auditOnly'), [['run', false, ['규칙 관문(test-collector)']]]);
  eq('  collector/*.json 만 → 규칙 관문만 있으면 통과 · 없으면 빠짐', [ok('ruleOnlyForRules'), ok('ruleFileNoGate')],
    [[['run', true, []]], [['run', false, ['규칙 관문(test-collector)']]]]);
  eq('  리포트(.md)·하위 폴더(collector/extracted/)·insta/·docs/ 만 저장 → 저장 로봇이 아니다', [ok('notRuleFiles'), ok('commentOnly')], [[], []]);
  eq('  같은 단계에서 관문이 git add 앞 → 통과 · `|| true` 로 삼키면 → 빠짐', [ok('sameStep').map((r) => r[1]), ok('sameStepSwallow').map((r) => r[1])], [[true], [false]]);
  eq('  job 마다 따로 본다 — 관문은 그 job 안에 있어야 한다', ok('twoJobs').map((r) => [r[0], r[1]]), [['run', true], ['other', false]]);
  eq('  `git add -A`(경로 없음) → 전부로 센다', ok('addAll').map((r) => r[1]), [false]);
  eq('  경로 읽기 — 줄 이어 쓰기 · 꼬리 주석 · 2>/dev/null · 변수', addedPaths('git add data/a.json \\\n  collector/b.json # 설명\ngit add insta/c.json 2>/dev/null || true\ngit add "$f"'),
    ['data/a.json', 'collector/b.json', 'insta/c.json', '?']);

  /* ② 톱니 — 새 저장 로봇은 빨간불 · 목록에 있는데 관문이 생기면 그것도 빨간불(목록은 줄기만 한다) */
  eq('② 톱니 — 목록에 없는 관문 없는 저장 job 은 fresh · 관문이 생긴 목록 항목은 stale',
    ratchet(['a.yml#x', 'b.yml#y'], { 'b.yml#y': '이유', 'c.yml#z': '이유' }), { fresh: ['a.yml#x'], stale: ['c.yml#z'] });

  /* ③ 실제 워크플로 — 관문 없는 저장 job == 예외 목록(이유 한 줄씩) */
  const dir = new URL('.github/workflows/', root);
  const files = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).sort()
    .map((f) => [f, fs.readFileSync(new URL(f, dir), 'utf8').replace(/\r/g, '')]));
  const savers = Object.entries(files).flatMap(([f, y]) => saveGateReport(y).map((r) => `${f}#${r.job}`));
  eq('③ 실제 워크플로에서 저장 job 을 읽었다(0 이면 읽는 눈이 무력해진 것)', savers.length > 5, true);
  const { fresh, stale } = ratchet(ungatedSavers(files), SAVE_GATE_EXCEPTIONS);
  const why = (k) => {
    const [f, j] = k.split('#');
    const r = files[f] && saveGateReport(files[f]).find((x) => x.job === j);
    return r ? `${k} — 빠진 것: ${r.miss.join('·')}` : k;
  };
  eqWf('  관문 없이 저장하는 **새** job 이 없다 — 저장 앞에 관문(test-collector · data/ 면 audit-data)을 붙인다(예외 목록에 더하지 말 것)', fresh.map(why), []);
  eqWf('  예외 목록의 job 이 이제 관문을 갖췄거나 저장하지 않는다 — SAVE_GATE_EXCEPTIONS 에서 지운다(목록은 줄기만 한다)', stale, []);
  eq('  예외마다 이유 한 줄(10자 이상 · 줄바꿈 없음)', Object.entries(SAVE_GATE_EXCEPTIONS).filter(([, w]) => !(typeof w === 'string' && w.trim().length >= 10 && !/\n/.test(w))).map(([k]) => k), []);
}
