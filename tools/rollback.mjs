/* ============================================================
   직전 판으로 되돌리기 — 사람이 올린 작업 하나를 **취소하는 기록**을 얹는다 (2026-11-11 · 은서 · 출시 전 백엔드 8번)
   ------------------------------------------------------------
   왜: 출시 뒤 잘못 나간 판을 되돌리려면 지금은 사람이 git 명령을 써야 했다.
   어떻게: `git revert` — 기록을 지우지 않고, 고른 작업 하나만 거꾸로 적용한 새 기록을 얹는다.
     🔴 기록을 되감지 않는다(reset·강제 push 금지) — 되감으면 그 사이 로봇이 모은 공고 데이터와 다른 사람의 작업이 사라진다.
     🔴 main 만 돌리지 않는다 — 배포 동기화가 기본 브랜치를 다시 main 에 덮어 잘못된 판이 되살아난다. 기본 브랜치에서 되돌린다.
   고를 수 있는 것 = **사람의 작업**만(로봇 handaejang-bot·github-actions 의 기록은 목록에서 뺀다 — 수집 기록을 실수로 지우지 않게) ·
     합치기(merge) 기록은 뺀다(어느 쪽을 되돌릴지 사람이 정해야 한다) · 워크플로 파일(.github/workflows)을 고친 작업은 버튼으로 못 되돌린다
     (GitHub 이 로봇 열쇠로 워크플로 파일을 고치는 push 를 거절한다 — Claude 세션에서 되돌린다).
   부딪히면(그 뒤에 같은 줄을 또 고쳤으면) **멈추고 아무것도 바꾸지 않는다**(revert --abort).
   🔴 미리보기 없이 '가장 최근 작업'을 바로 되돌리는 길은 없다(2026-11-11 은서 결정) — 작업 번호를 직접 넣어야 한다.

   쓰기: node tools/rollback.mjs --list [--n 10]          최근 사람 작업 목록
         node tools/rollback.mjs --preview <번호>         그 작업을 되돌리면 바뀌는 파일 (아무것도 안 바꾼다)
         node tools/rollback.mjs --revert <번호>          취소 기록을 만든다(커밋까지 · push 는 워크플로가 검사 뒤에)
   결과는 표준 출력 + GITHUB_STEP_SUMMARY(있으면) + GITHUB_OUTPUT(status=… · sha=…).
   워크플로: .github/workflows/rollback.yml · 관문: verify/health-gates/ops.mjs 「⑤ 직전 판으로 되돌리기」(임시 저장소로 진짜 돌린다).
   ============================================================ */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BIG = 64 * 1024 * 1024;
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: BIG });
export const ROBOT_AUTHOR = /handaejang-bot|github-actions(\[bot\])?|41898282\+github-actions/i;
export const isRobot = (name, email) => ROBOT_AUTHOR.test(`${name || ''} <${email || ''}>`);
const SEP = '\u001f';

/** 최근 사람 작업 — 합치기 기록·로봇 기록은 뺀다. 뒤져 보는 범위는 최근 scan 개 */
export function listHumanCommits(cwd, { n = 10, scan = 400 } = {}) {
  const r = git(['log', `-${scan}`, '--no-merges', `--format=%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%ad${SEP}%s`, '--date=format:%Y-%m-%d %H:%M'], cwd);
  if (r.status !== 0) return [];
  return r.stdout.split('\n').filter(Boolean).map((l) => {
    const [sha, short, name, email, date, subject] = l.split(SEP);
    return { sha, short, name, email, date, subject };
  }).filter((c) => !isRobot(c.name, c.email)).slice(0, n);
}

/** 번호(앞자리)를 이 저장소의 작업 하나로 — 없거나 둘 이상이면 null */
export function resolveSha(cwd, ref) {
  const s = String(ref || '').trim();
  if (!/^[0-9a-f]{6,40}$/i.test(s)) return null;
  const r = git(['rev-parse', '--verify', '--quiet', `${s}^{commit}`], cwd);
  return r.status === 0 ? r.stdout.trim() : null;
}

/** 이 작업을 버튼으로 되돌려도 되는가 — 이유를 돌려준다(되면 null) */
export function refuseReason(cwd, sha) {
  if (!sha) return '그런 작업 번호를 찾지 못했어요 — 미리보기 목록의 번호를 그대로 넣어 주세요';
  const head = git(['merge-base', '--is-ancestor', sha, 'HEAD'], cwd);
  if (head.status !== 0) return '이 브랜치에 들어온 적 없는 작업이에요';
  const info = git(['show', '-s', `--format=%an${SEP}%ae${SEP}%P`, sha], cwd).stdout.trim().split(SEP);
  if (isRobot(info[0], info[1])) return '로봇이 한 작업은 버튼으로 되돌리지 않아요(수집 기록이 사라질 수 있어요) — 데이터는 관리자 화면에서 고쳐요';
  if ((info[2] || '').trim().split(/\s+/).length > 1) return '합치기(merge) 기록은 버튼으로 되돌리지 않아요 — 그 안의 작업 하나를 골라 주세요';
  const files = changedFiles(cwd, sha);
  if (files.some((f) => f.path.startsWith('.github/workflows/'))) return '워크플로 파일(.github/workflows)을 고친 작업이라 버튼으로는 못 되돌려요 — Claude 세션에서 되돌려 주세요';
  return null;
}

/** 그 작업이 바꾼 파일 — [{ status: A|M|D|R…, path }] */
export function changedFiles(cwd, sha) {
  const r = git(['show', '--name-status', '--format=', sha], cwd);
  if (r.status !== 0) return [];
  return r.stdout.split('\n').filter(Boolean).map((l) => { const p = l.split('\t'); return { status: p[0], path: p[p.length - 1] }; });
}

/** 되돌린다 — { status: 'reverted' | 'refused' | 'conflict', reason?, files?, newSha? }. 부딪히면 원래대로 둔다 */
export function revertCommit(cwd, ref) {
  const sha = resolveSha(cwd, ref);
  const why = refuseReason(cwd, sha);
  if (why) return { status: 'refused', reason: why };
  const before = git(['rev-parse', 'HEAD'], cwd).stdout.trim();
  const dirty = git(['status', '--porcelain', '--untracked-files=no'], cwd).stdout.trim();
  if (dirty) return { status: 'refused', reason: '작업 폴더에 저장 안 한 변경이 있어 멈췄어요' };
  const subject = git(['show', '-s', '--format=%s', sha], cwd).stdout.trim();
  const r = git(['revert', '--no-edit', sha], cwd);
  if (r.status !== 0) {
    const conflicted = git(['diff', '--name-only', '--diff-filter=U'], cwd).stdout.split('\n').filter(Boolean);
    git(['revert', '--abort'], cwd);   // 되돌리기를 시작하기 전 그대로(HEAD·파일) — 기록을 되감는 것이 아니다
    return { status: 'conflict', reason: '그 뒤에 같은 곳을 또 고쳐서 자동으로 되돌릴 수 없어요 — 사람이 봐야 해요(아무것도 바꾸지 않았어요)', files: conflicted };
  }
  const newSha = git(['rev-parse', 'HEAD'], cwd).stdout.trim();
  if (newSha === before) return { status: 'refused', reason: '되돌릴 변경이 없었어요(이미 되돌려져 있을 수 있어요)' };
  return { status: 'reverted', sha, newSha, subject, files: changedFiles(cwd, sha) };
}

const STATUS_WORD = { A: '추가했던 파일 → 지움', M: '고쳤던 파일 → 원래대로', D: '지웠던 파일 → 되살림' };
const fileLines = (files) => files.map((f) => `  - ${STATUS_WORD[f.status[0]] || '바뀐 파일'}: \`${f.path}\``).join('\n');

export function main(argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const out = [];
  const say = (s) => { out.push(s); console.log(s); };
  const setOut = (k, v) => { if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `${k}=${String(v).replace(/\r?\n/g, ' ')}\n`); };
  let code = 0;
  if (argv.includes('--list')) {
    const list = listHumanCommits(cwd, { n: Number(arg('--n')) || 10 });
    say('### 최근 사람 작업 (로봇 기록·합치기 기록은 뺐어요)\n');
    say('| 번호 | 날짜 | 누가 | 무엇을 |\n| --- | --- | --- | --- |');
    for (const c of list) say(`| \`${c.short}\` | ${c.date} | ${c.name} | ${c.subject.replace(/\|/g, '\\|').slice(0, 90)} |`);
    if (!list.length) say('| — | — | — | 사람 작업을 찾지 못했어요 |');
    say('\n되돌리려면: 같은 버튼을 다시 눌러 **모드 = 되돌리기**, **작업 번호** 칸에 위 번호를 넣으세요.');
  } else if (arg('--preview')) {
    const sha = resolveSha(cwd, arg('--preview'));
    const why = refuseReason(cwd, sha);
    if (why) { say(`🚫 ${why}`); setOut('status', 'refused'); code = 0; } else {
      const s = git(['show', '-s', '--format=%h · %ad · %an · %s', '--date=format:%Y-%m-%d %H:%M', sha], cwd).stdout.trim();
      say(`### 이 작업을 되돌리면\n\n**${s}**\n\n${fileLines(changedFiles(cwd, sha))}\n\n아직 아무것도 바꾸지 않았어요. 되돌리려면 모드 = 되돌리기 로 다시 누르세요.`);
      setOut('status', 'preview');
    }
  } else if (arg('--revert')) {
    const r = revertCommit(cwd, arg('--revert'));
    setOut('status', r.status);
    if (r.status === 'reverted') {
      setOut('sha', r.sha); setOut('newsha', r.newSha);
      say(`↩ **되돌림 기록을 만들었어요** — \`${r.sha.slice(0, 8)}\` 「${r.subject}」\n\n${fileLines(r.files)}`);
    } else {
      say(`🚫 ${r.reason}${r.files && r.files.length ? `\n\n부딪힌 파일: ${r.files.map((f) => `\`${f}\``).join(' · ')}` : ''}`);
      code = r.status === 'conflict' ? 2 : 1;
    }
  } else {
    say('쓰기: node tools/rollback.mjs --list | --preview <번호> | --revert <번호>');
    code = 1;
  }
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${out.join('\n')}\n`);
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
