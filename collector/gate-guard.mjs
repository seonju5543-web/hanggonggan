/* 데이터 관문이 빨갈 때 — 단계별로 되돌리고 **되돌릴 때마다 관문을 다시 잰다** (2026-10-04 · 로봇·도구 점검)

   왜 만들었나 (실측):
   예전 되돌리기(revert-auto)는 '이번 실행에 새로 들어온 자동 등록분'만 빼고 끝났다 — 관문을 다시 재지 않았다.
   그래서 빨간불의 원인이 **기존 항목을 고친 것**(발췌기가 자격 줄을 채움 등)이면 되돌리기는 아무것도 못 하고,
   저장 단계는 관문 결과와 상관없이 그 고친 정식 등록 파일을 커밋했다(수집 10-04 a31a8538 · 브라우저 b364d997 — 관문 실패 상태로 저장).
   링크 사냥꾼은 감사에 걸려 결과를 전부 버리고도 초록불로 끝났다(이슈 #381 코멘트 '결과 전량 폐기' 4회 — 전부 초록불).

   하는 일 — 단계를 순서대로 하나씩 적용하고, 바뀐 것이 있으면 관문을 다시 돌린다. 통과하면 거기서 멈춘다:
     · `auto` 단계: 이번 실행에 새로 들어온 자동 등록분(auto:true · HEAD 에 없던 id)을 뺀다 → 양식 대기열에서도 정리(pending-queue.mjs).
     · 파일 단계(`a,b,c`): 그 파일·폴더를 HEAD 바이트 그대로 되돌린다(git checkout HEAD -- · 폴더는 새 파일도 지운다 ·
       HEAD 에 없던 파일은 지운다). 🔴 JSON 을 다시 쓰지 않는다 — registered/forms 형식이 바뀌면 파일 전체가 충돌한다(CLAUDE.md 매 세션 4).
   결과(gate): reverted-auto(자동 등록분만 빼서 통과) · reverted-files(파일까지 되돌려 통과) ·
               still-failing(다 되돌려도 빨간불 — 이번 실행의 그 파일들이 원인이 아니다) · flaky(되돌릴 것 없이 다시 재니 통과).
   리포트(--report)의 '자동 등록 — N건 등록' 줄에 '시도 · ↩ 되돌림'을 붙이고 사람이 읽을 단락을 넣는다(이슈 본문에도 그대로 간다).
   🔴 단락은 **실제로 되돌린 파일**에서 만든다(FILE_LABELS 한 곳) — 소식 로봇도 이 도구를 쓰는데 단락이 늘 '정식 등록'을 말해
      소식 리포트에 사실과 반대인 문장이 들어갔다(2026-10-04 리뷰). 워크플로 알림도 이 단락(--note)을 그대로 싣는다(문구를 베끼지 말 것).
   $GITHUB_OUTPUT 에 gate=<결과> · removed=<뺀 자동 등록 수>. reverted-auto 이면 뺀 id 를 collector/auto-held.json 에 적는다
   (두 번 걸린 공고는 3일 쉰다 — auto-held.mjs).
   🔴 늘 exit 0 — 결과는 gate 로 말한다(빨간불은 워크플로의 마지막 단계가 낸다). 예상 못 한 예외만 exit 1(워크플로가 파일을 직접 되돌린다).

   실행: node collector/gate-guard.mjs --report collector/report.md --stage auto --stage data/registered.json,data/forms.json,collector/pending-forms.json [--note /tmp/gate-note.md]
   관문 명령: GATE_CMD (기본 'node verify/test-collector.mjs && node verify/audit-data.js') · 저장소 뿌리 = 지금 폴더.
   관문: verify/health-gates/gate.mjs 「데이터 관문 되돌리기」(임시 git 저장소 · 가짜 관문으로 잰다). */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { pruneOrphans } from './pending-queue.mjs';
import { recordReverts } from './auto-held.mjs';

export const DEFAULT_GATE = 'node verify/test-collector.mjs && node verify/audit-data.js';
const REG = 'data/registered.json';
const QUEUE = 'collector/pending-forms.json';
const HELD = 'collector/auto-held.json';
const BIG = 256 * 1024 * 1024;
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/* 되돌릴 수 있는 파일의 사람 이름 · 되돌리면 학생 화면·리포트에서 무엇이 달라지는가(after).
   단락은 **실제로 되돌린 파일**만 말한다 — 표에 없는 파일은 경로를 그대로 적는다(지어내지 않는다). */
export const FILE_LABELS = [
  { path: 'data/registered.json', name: '정식 등록', after: '이 리포트의 자동 등록·승격 숫자는 시도한 것입니다(저장 안 됨)' },
  { path: 'data/forms.json', name: '양식' },
  { path: 'collector/pending-forms.json', name: '양식 대기열' },
  { path: 'data/news', name: '교내 소식 발행분', after: '홈 「우리 학교 소식」은 이번 실행에 갱신되지 않습니다' },
  { path: 'collector/seen-news.json', name: '소식 장부' },
  { path: 'collector/news-thumbs.json', name: '소식 사진 장부' },
  { path: 'collector/news-sources.json', name: '소식 출처 목록', after: '찾기 로봇이 이번에 고친 게시판 주소도 저장하지 않았습니다' },
];
const labelOf = (p) => FILE_LABELS.find((l) => l.path === p.replace(/\/+$/, '')) || { path: p, name: `\`${p}\`` };
const names = (paths) => [...new Set(paths.map((p) => labelOf(p).name))].join('·');

export function parseArgs(argv) {
  const o = { stages: [], report: '', note: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stage') o.stages.push(argv[++i]);
    else if (argv[i] === '--report') o.report = argv[++i];
    else if (argv[i] === '--note') o.note = argv[++i];
  }
  return o;
}

const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: BIG });
const inHead = (p, cwd) => git(['cat-file', '-e', `HEAD:${p}`], cwd).status === 0;

/** 관문을 돌린다 — 통과 여부와 걸린 줄(✕ · 요약 줄 빼고 앞 5개) */
export function runGate(cmd, cwd) {
  const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf8', maxBuffer: BIG });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const failing = out.split('\n').map((l) => l.trim())
    .filter((l) => /^✕/.test(l) && !/^✕ 실패 \d+건/.test(l))
    .map((l) => l.replace(/^✕\s*/, '').slice(0, 140)).slice(0, 5);
  if (r.status !== 0 && !failing.length) failing.push(`(관문 명령이 ${r.status ?? r.signal} 로 끝남 — 실행 로그 참고)`);
  return { ok: r.status === 0, failing };
}

/** auto 단계 — 이번 실행에 새로 들어온 자동 등록분을 뺀다. 뺀 항목들을 돌려준다(못 하면 빈 배열). */
export function revertAutoStage(cwd) {
  const regPath = path.join(cwd, REG);
  if (!fs.existsSync(regPath)) return [];
  const head = git(['show', `HEAD:${REG}`], cwd);
  if (head.status !== 0) { console.log('직전 판(HEAD)의 정식 등록을 읽지 못해 자동 등록분을 고르지 않았습니다'); return []; }
  const known = new Set((JSON.parse(head.stdout).items || []).map((i) => i.id));
  const cur = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const removed = [];
  cur.items = (cur.items || []).filter((i) => {
    if (i.auto && !known.has(i.id)) { removed.push(i); return false; }   // 사람이 등록한 것·기존 항목은 건드리지 않는다
    return true;
  });
  if (!removed.length) return [];
  fs.writeFileSync(regPath, `${JSON.stringify(cur, null, 1)}\n`);   // 로봇과 같은 저장 형식 (auto-register 와 같다)
  /* 뺀 공고의 양식 대기열 항목도 정리한다 — 규칙은 pending-queue.mjs 한 곳(스키마화 로봇과 같다) */
  const qPath = path.join(cwd, QUEUE);
  if (fs.existsSync(qPath)) {
    const queue = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    const { kept, dropped } = pruneOrphans(queue, new Set(cur.items.map((i) => i.id)));
    if (dropped.length) { queue.items = kept; fs.writeFileSync(qPath, `${JSON.stringify(queue, null, 1)}\n`); }
  }
  return removed;
}

/** 파일 단계 — HEAD 바이트 그대로. 실제로 되돌린 경로들을 돌려준다(바뀐 것이 없으면 빈 배열). */
export function revertFilesStage(paths, cwd) {
  const done = [];
  for (const p of paths.map((x) => x.trim()).filter(Boolean)) {
    const abs = path.join(cwd, p);
    if (inHead(p, cwd)) {
      const dirty = git(['status', '--porcelain', '--', p], cwd).stdout.trim();
      if (!dirty) continue;
      done.push(p);
      git(['checkout', 'HEAD', '--', p], cwd);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) git(['clean', '-fdq', '--', p], cwd);
    } else if (fs.existsSync(abs)) {   // 이번 실행이 새로 만든 파일
      done.push(p);
      fs.rmSync(abs, { recursive: true, force: true });
    }
  }
  return done;
}

/** 단계를 돌리고 결과를 정한다 — { status, removed, failing, reverted, files, targets }
    files = 실제로 HEAD 판으로 되돌린 파일 · targets = 되돌릴 수 있었던 것 전부('auto' 포함 — 단락이 '무엇이 안 바뀌었나'를 말할 때) */
export function guard({ stages, gateCmd = DEFAULT_GATE, cwd = process.cwd(), today = todayKst() }) {
  let status = 'still-failing';
  let removed = [];
  let failing = [];
  const files = [];
  const targets = stages.flatMap((st) => (st === 'auto' ? ['auto'] : st.split(',').map((x) => x.trim()).filter(Boolean)));
  let reverted = false;     // 무엇이든 되돌렸는가
  let measured = false;     // 마지막으로 바꾼 뒤 관문을 쟀는가
  for (const st of stages) {
    let changed;
    if (st === 'auto') { removed = revertAutoStage(cwd); changed = removed.length > 0; } else {
      const done = revertFilesStage(st.split(','), cwd);
      files.push(...done);
      changed = done.length > 0;
    }
    if (!changed) continue;   // 바뀐 것이 없으면 관문 결과도 그대로다 — 다시 재지 않는다(시간만 든다)
    reverted = true;
    const g = runGate(gateCmd, cwd);
    measured = true;
    if (g.ok) { status = st === 'auto' ? 'reverted-auto' : 'reverted-files'; failing = []; break; }
    failing = g.failing;
  }
  /* 아무것도 못 되돌렸거나 마지막 상태를 안 쟀으면 한 번 잰다 — 걸린 검사 이름을 이슈에 적으려고(그리고 재현되는지) */
  if (status === 'still-failing' && !measured) {
    const g = runGate(gateCmd, cwd);
    if (g.ok) status = reverted ? 'reverted-files' : 'flaky';
    failing = g.ok ? [] : g.failing;
  }
  if (status === 'reverted-auto' && removed.length) {
    /* 두 번 걸린 공고는 3일 쉰다 — 파일 단계까지 간 경우엔 적지 않는다(그때 새 등록분은 무고할 수 있다) */
    const hp = path.join(cwd, HELD);
    let ledger = null;
    try { ledger = JSON.parse(fs.readFileSync(hp, 'utf8')); } catch { /* 첫 기록 */ }
    fs.writeFileSync(hp, `${JSON.stringify(recordReverts(ledger, removed.map((i) => i.id), today), null, 1)}\n`);
  }
  return { status, removed, failing, reverted, files, targets };
}

/** 사람이 읽을 단락 — 리포트와 이슈에 같은 말. 🔴 '무엇을 되돌렸나'는 실제로 되돌린 파일(files)·뺀 자동 등록(removed)에서만 만든다 */
export function noteFor({ status, removed = [], failing = [], files = [], targets = [] }) {
  const ids = removed.map((i) => `\`${i.id}\``).join(' · ');
  const checks = failing.length ? `\n>\n> 걸린 검사: ${failing.map((f) => `「${f}」`).join(' · ')}` : '';
  /* 되돌린 것 — '새 자동 등록 n건' · '정식 등록·양식 변경' (둘 다 받침으로 끝나 조사는 '을') */
  const did = [removed.length ? `새 자동 등록 ${removed.length}건` : '', files.length ? `${names(files)} 변경` : ''].filter(Boolean).join('과 ');
  const after = [...new Set(files.map((p) => labelOf(p).after).filter(Boolean))].join(' · ');
  const could = [targets.includes('auto') ? '새 자동 등록분' : '', names(targets.filter((t) => t !== 'auto'))].filter(Boolean).join('·');
  const head = {
    'reverted-auto': `↩ **데이터 관문에 걸려 새 자동 등록 ${removed.length}건을 되돌렸습니다**${ids ? `(${ids})` : ''} — 같은 실행의 다른 결과는 저장합니다. 두 번 걸린 공고는 3일 쉬었다 다시 봅니다. 걸린 검사는 실행 로그의 「데이터 관문」 단계에 있습니다.`,
    'reverted-files': `↩ **데이터 관문에 걸려 이번 실행의 ${did || '변경'}을 저장하지 않았습니다**(직전 판으로 되돌림)${after ? ` — ${after}` : ''}. 그 밖의 결과는 저장합니다.`,
    'still-failing': did
      ? `🚨 **되돌린 뒤에도 데이터 관문이 빨갛습니다** — 이번 실행의 ${did}을 되돌려도 통과하지 않았으니 기존 데이터나 이번 실행의 다른 파일을 사람이 봐야 합니다(실행을 빨간불로 끝냅니다).`
      : `🚨 **데이터 관문이 빨갛습니다** — 되돌릴 수 있는 것(${could || '없음'})이 이번 실행에 바뀌지 않았는데도 빨가니 기존 데이터나 이번 실행의 다른 파일을 사람이 봐야 합니다(실행을 빨간불로 끝냅니다).`,
    flaky: 'ℹ **데이터 관문을 다시 재니 통과했습니다** — 처음 실패가 다시 나지 않았습니다(되돌린 것 없음). 실행 로그의 「데이터 관문」 단계를 보세요.',
  }[status];
  return `> ${head}${checks}`;
}

/** 리포트에 단락을 넣는다 — '자동 등록 — N건 등록' 줄 바로 아래(없으면 파일 끝) */
export function annotateReport(text, result) {
  const note = noteFor(result);
  const lines = String(text || '').split('\n');
  const i = lines.findIndex((l) => /^### 🤖 자동 등록 \(선조치후보고\) — \d+건 등록/.test(l));
  if (i < 0) return `${String(text || '').replace(/\s*$/, '')}\n\n${note}\n`;
  /* 새 자동 등록이 실제로 빠졌을 때만 — 뺀 것이 있거나 정식 등록 파일을 직전 판으로 되돌렸을 때(다른 파일만 되돌렸으면 등록은 저장된다) */
  const undone = (result.removed || []).length > 0 || (result.files || []).includes(REG);
  if (undone) lines[i] = lines[i].replace(/— (\d+)건 등록/, '— $1건 등록 시도 · ↩ 데이터 관문에 걸려 되돌림');
  lines.splice(i + 1, 0, '', note);
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const o = parseArgs(argv);
  if (!o.stages.length) { console.log('쓰는 법: node collector/gate-guard.mjs --report <리포트> --stage auto --stage <파일,파일> [--note <파일>]'); return 0; }
  const cwd = process.cwd();
  const res = guard({ stages: o.stages, gateCmd: env.GATE_CMD || DEFAULT_GATE, cwd });
  console.log(`데이터 관문 되돌리기 결과: ${res.status} · 뺀 자동 등록 ${res.removed.length}건`);
  res.removed.forEach((i) => console.log(`  - ${i.id} | ${String(i.name || '').slice(0, 50)}`));
  res.failing.forEach((f) => console.log(`  ✕ ${f}`));
  if (o.report) {
    const rp = path.join(cwd, o.report);
    fs.writeFileSync(rp, annotateReport(fs.existsSync(rp) ? fs.readFileSync(rp, 'utf8') : '', res));
  }
  if (o.note) fs.writeFileSync(o.note, `${noteFor(res)}\n`);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `gate=${res.status}\nremoved=${res.removed.length}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main()); } catch (e) {
    console.error(`::error::데이터 관문 되돌리기가 넘어졌습니다 — ${e && e.stack ? e.stack : e}`);
    process.exit(1);
  }
}
