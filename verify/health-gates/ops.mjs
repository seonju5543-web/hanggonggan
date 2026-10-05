/* 「로봇·도구 점검 관문」 — ops 묶음: 운영 감시 도구가 거짓 신호를 내지 않는가 (2026-10-05)
   찾은 것:
     ① ops-09 배포 감시(check-deploy-sync)가 두 점 비교라 **main 만 앞선 것**(배포 동기화가 하루 수십 번 main 을 움직인다)도 ❌ 로 내고
        `git push origin HEAD:main` 하나를 권했다(하면 거절된다) · 앱이 받는 assets/(정문·학교 사진 목록)를 앱 파일로 안 봤다(거짓 초록).
     ② ops-10 하트비트 문턱(간격 × 3)이 3시간 로봇에서 9시간 — 예약 실측 최대 틈 9.7시간보다 짧아 헛경보 → 바닥값 12시간.
     ③ ops-11 하트비트가 작업 브랜치의 성공도 셌다 → 기본 브랜치(와 main)의 성공만.
     ④ ops-12 노션 '브랜치' 칸이 늘 main(세 곳 push 에서 대기줄에 남는 실행) · 노션 500 한 번에 빨간불 → 커밋을 가리키는 작업 브랜치 · 재시도.
     ⑤ gaps-04 tools/robot-run.sh 의 손 목록(8개)이 낡아 registered.json 을 쓰는 로봇이 빠졌고, gh 실패를 '비어 있음 ✅'으로 말했다.
     ⑥ gaps-05 정찰이 push 마다 살아 있는 줄 전부(25개)를 다시 열어 같은 학교를 하루 네 번 두드렸다 → 이번 push 가 넣은 줄만.
     ⑦ ops-14 Node 20 판 액션(checkout·setup-node v4 · github-script v7)과 node-version 20.
   🔴 표본(고정 예시)과 임시 git 저장소만 잰다 — data/·collector/ 장부는 읽지 않는다.
   🔴 코드 위생 대조(⑤ 겉옷 글자 · ⑥ 워크플로 글자 · ⑦ 액션 판)는 문서 관문과 같은 잣대(로컬·verify-ui DOC_GATES=1 에서만 실패 ·
      수집 로봇의 데이터 관문에서는 경고만) — 거기서 빨개지면 자동 등록분이 되돌려진다.
   🔴 임시 저장소를 쓰는 관문(①④)은 자식 env 에서 GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE 을 지운다(훅 안에서 돌 때 진짜 저장소를 건드리지 않게).
   🔴 notion-status.mjs·probe-links.mjs 는 **불러오는 순간 실행된다** — 규칙 파일(notion-branch.mjs·probe-lines.mjs)만 불러 쓰고, 본체는 따로 돌린다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { softEq } from './alerts.mjs';
import { stripComments } from './servers.mjs';

const BASE = 'claude/nice-heisenberg-WESq5';
const read = (root, rel) => fs.readFileSync(new URL(rel, root), 'utf8').replace(/\r/g, '');
/** 함수 몸통 — `head` 부터 짝 맞는 `}` 까지 (못 찾으면 '') */
function fnBody(src, head) {
  const at = src.indexOf(head);
  if (at < 0) return '';
  let d = 0;
  for (let j = src.indexOf('{', at); j > 0 && j < src.length; j += 1) {
    if (src[j] === '{') d += 1;
    else if (src[j] === '}' && --d === 0) return src.slice(at, j + 1);
  }
  return '';
}
/** 임시 git 저장소 — 진짜 저장소를 가리키는 GIT_* 를 지운 env 로만 git 을 부른다 */
function tmpRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const env = { ...process.env };
  for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES', 'GIT_COMMON_DIR', 'GIT_PREFIX']) delete env[k];
  const git = (...a) => spawnSync('git', ['-c', 'user.name=관문', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false', ...a],
    { cwd: dir, encoding: 'utf8', env });
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  return { dir, env, git, put, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export default async function gate(eq, ctx) {
  const root = ctx.root;
  const rootPath = fileURLToPath(root);
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  const eqCode = softEq(eq, DOC_GATES);
  if (!DOC_GATES) console.log('  (로봇 워크플로 — 코드 위생 대조는 어긋나도 경고만 · verify-ui.yml 과 로컬에서는 실패)');

  /* ── ① ops-09 배포 감시: 갈라진 뒤 내 쪽에만 생긴 앱 변경만 ❌ ── */
  {
    const cds = (setup) => {
      const R = tmpRepo('ops-cds-');
      try {
        R.git('init', '-q', '-b', 'work');
        R.put('style.css', 'a{}\n'); R.put('data/x.json', '[1]\n'); R.put('assets/schools/photos.json', '{}\n'); R.put('README.md', 'x\n');
        R.git('add', '-A'); R.git('commit', '-qm', '씨앗');
        setup(R);
        const r = spawnSync(process.execPath, [path.join(rootPath, 'verify/check-deploy-sync.js')],
          { cwd: R.dir, encoding: 'utf8', env: { ...R.env, GH_TOKEN: '', GITHUB_TOKEN: '' }, timeout: 60000 });
        return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
      } finally { R.done(); }
    };
    const mainSide = (R, file, text) => {           // main 쪽에만 커밋 하나 → origin/main 으로 세운다
      R.git('checkout', '-q', '-b', 'side'); R.put(file, text); R.git('commit', '-qam', 'main 쪽');
      R.git('update-ref', 'refs/remotes/origin/main', 'HEAD'); R.git('checkout', '-q', 'work');
    };
    const behindOnly = cds((R) => mainSide(R, 'style.css', 'b{}\n'));
    const aheadAssets = cds((R) => { R.git('update-ref', 'refs/remotes/origin/main', 'HEAD'); R.put('assets/schools/photos.json', '{"a":1}\n'); R.git('commit', '-qam', '내 쪽'); });
    const diverged = cds((R) => { mainSide(R, 'style.css', 'b{}\n'); R.put('data/x.json', '[1,2]\n'); R.git('commit', '-qam', '내 쪽'); });
    const noBase = cds((R) => {
      R.git('checkout', '-q', '--orphan', 'other'); R.put('style.css', 'z{}\n'); R.git('add', '-A'); R.git('commit', '-qm', '남남');
      R.git('update-ref', 'refs/remotes/origin/main', 'HEAD'); R.git('checkout', '-q', '-f', 'work');
    });
    eq('① ops-09 main 만 앞선 것(뒤처짐만) — 통과(0) + (참고)로만 말한다',
      [behindOnly.status, /\(참고\)/.test(behindOnly.out), /❌/.test(behindOnly.out)], [0, true, false]);
    eq('  내 쪽에만 assets/schools/photos.json 변경 — 앱 파일이다 · 실패(1) · 그 경로를 보인다',
      [aheadAssets.status, aheadAssets.out.includes('assets/schools/photos.json')], [1, true]);
    eq('  갈라짐(main 은 style.css · 내 쪽은 data/x.json) — 실패(1) · 내 쪽 것만 보이고 main 쪽 것은 안 보인다',
      [diverged.status, diverged.out.includes('data/x.json'), diverged.out.includes('style.css')], [1, true, false]);
    eq('  공통 조상이 없으면(얕은 클론) — 못 쟀다고 말하고(0) ✅ 라고 쓰지 않는다',
      [noBase.status, /공통 조상/.test(noBase.out), /✅ 내 쪽에만/.test(noBase.out)], [0, true, false]);
    const outs = [behindOnly, aheadAssets, diverged, noBase].map((o) => o.out);
    eq('  main 하나에만 올리라고 권하지 않는다 — HEAD:main 을 말하면 기본 브랜치 push 와 run-deploy.txt 도 같이 말한다',
      [outs.every((o) => !/git push origin HEAD:main/.test(o) || (o.includes(`HEAD:${BASE}`) && /deploy\/run-deploy\.txt/.test(o))),
        [aheadAssets.out, diverged.out].every((o) => o.includes(`HEAD:${BASE}`))],
      [true, true]);
    eq('  뒤처졌으면 먼저 main 을 합치라고 적는다', /⓪[^\n]*git merge origin\/main/.test(diverged.out), true);
    /* 리뷰 R1 — push 마다 따로 합치라고 하면 세 곳이 세 커밋이 된다 → ⓪ 에서 둘 다 합치고 ①②③ 은 같은 HEAD (뒤처지지 않았어도 ⓪ 을 적는다 — 기본 브랜치는 봇이 늘 움직인다) */
    const steps = (o) => {
      const L = o.split('\n');
      const zero = L.find((l) => /^\s*⓪/.test(l)) || '';
      const pushes = L.filter((l) => /^\s*[①②③]/.test(l));
      return [zero.includes(`git merge origin/${BASE}`) && zero.includes('git merge origin/main') && L.indexOf(zero) < L.indexOf(pushes[0]),
        pushes.length, pushes.some((l) => /git merge|git fetch/.test(l)), pushes.map((l) => (l.match(/git push origin (\S+)/) || [])[1])];
    };
    eq('  해결 안내 — ⓪ 에서 기본 브랜치·main 을 먼저 합치고 ①②③ 은 같은 HEAD 를 올린다(push 사이에 합치기 없음 · 뒤처지지 않은 경우도)',
      [steps(aheadAssets.out), steps(diverged.out)],
      [[true, 3, false, ['HEAD', `HEAD:${BASE}`, 'HEAD:main']], [true, 3, false, ['HEAD', `HEAD:${BASE}`, 'HEAD:main']]]);
  }

  /* ── ② ops-10 하트비트 문턱 바닥값 · ③ ops-11 기본 브랜치·main 의 성공만 ── */
  {
    const HB = await import(new URL('collector/robot-heartbeat.mjs', root));
    const now = Date.parse('2026-10-05T00:00:00Z');
    const ago = (h) => new Date(now - h * 3600e3).toISOString();
    eq('② ops-10 문턱 = 간격 × 3, 최소 12시간 — 3시간 로봇 10시간 조용함은 아직 아님 · 13시간은 조용함 · 하루 로봇은 72시간 그대로',
      [HB.isStale(3, ago(10), now), HB.isStale(3, ago(13), now), HB.isStale(24, ago(71), now), HB.isStale(24, ago(73), now), HB.staleAfterHours(null), HB.STALE_MIN_HOURS],
      [false, true, false, true, null, 12]);
    const runs = [
      { conclusion: 'success', head_branch: 'claude/foo', updated_at: '2026-10-04T12:00:00Z' },
      { conclusion: 'success', head_branch: HB.BASE_BRANCH, updated_at: '2026-10-04T08:00:00Z' },
      { conclusion: 'success', head_branch: 'main', updated_at: '2026-10-04T10:00:00Z' },
      { conclusion: 'failure', head_branch: HB.BASE_BRANCH, updated_at: '2026-10-04T13:00:00Z' },
    ];
    eq('③ ops-11 두 번째 길은 기본 브랜치·main 의 성공만 센다(작업 브랜치의 더 늦은 성공을 고르지 않는다) · 인자 없으면 옛 동작',
      [HB.BASE_BRANCH, HB.latestSuccessIso(runs, { branches: [HB.BASE_BRANCH, 'main'] }), HB.latestSuccessIso(runs)],
      [BASE, '2026-10-04T10:00:00Z', '2026-10-04T12:00:00Z']);
    const src = stripComments(read(root, 'collector/robot-heartbeat.mjs'));
    eq('  첫 질문(lastSuccessAt)의 주소가 기본 브랜치로 거르고 · 두 번째 길(recentSuccessAt)이 [기본 브랜치, main] 을 넘긴다',
      [/&branch=\$\{encodeURIComponent\(BASE_BRANCH\)\}/.test(fnBody(src, 'async function lastSuccessAt(')),
        /latestSuccessIso\([^;]*\{\s*branches:\s*\[BASE_BRANCH,\s*'main'\]\s*\}\)/.test(fnBody(src, 'async function recentSuccessAt('))],
      [true, true]);
  }

  /* ── ④ ops-12 노션 '브랜치' 칸 · 재시도 ── */
  {
    const NB = await import(new URL('tools/notion-branch.mjs', root));
    eq('④ ops-12 branchLabel — main 실행이어도 그 커밋의 작업 브랜치 · 작업 브랜치 실행은 그대로 · 작업 브랜치가 없으면 기본 브랜치 · 그것도 없으면 ref · 못 읽으면 null',
      [NB.branchLabel({ ref: 'main', pointsAt: ['main', BASE, 'claude/foo'] }), NB.branchLabel({ ref: 'claude/foo', pointsAt: ['claude/foo'] }),
        NB.branchLabel({ ref: 'main', pointsAt: ['main', BASE] }), NB.branchLabel({ ref: 'main', pointsAt: ['main'] }), NB.branchLabel({ ref: 'main', pointsAt: null })],
      ['claude/foo', 'claude/foo', BASE, 'main', null]);
    eq('  작업 브랜치가 둘이면 이름순 첫째(어느 실행이 남든 같은 값) · 원격 이름 읽기는 origin/ 떼고 HEAD 뺌 · 못 읽음은 null',
      [NB.branchLabel({ ref: BASE, pointsAt: ['claude/zzz', 'main', 'claude/aaa'] }),
        NB.remoteBranchesFrom('refs/remotes/origin/HEAD\nrefs/remotes/origin/main\nrefs/remotes/origin/claude/foo\n'), NB.remoteBranchesFrom(null)],
      ['claude/aaa', ['main', 'claude/foo'], null]);
    /* 병합 커밋 push (리뷰 R1) — Z = merge(X, 봇) 를 main 에 올렸다: Z 를 가리키는 작업 브랜치는 없고 첫 부모 X 를 claude/foo 가 가리킨다 */
    const refsAt = NB.refsByCommit(`zzz refs/remotes/origin/main\nzzz refs/remotes/origin/${BASE}\nxxx refs/remotes/origin/claude/foo\nbbb refs/remotes/origin/claude/other\nzzz refs/remotes/origin/HEAD\n`);
    eq('  pushBranchLabel — 병합 커밋 main 실행: HEAD 다음 첫 부모(X)의 작업 브랜치 · 둘째 부모 쪽(봇 커밋을 가리키는 남의 브랜치)은 줄에 없으면 안 본다 · 아무도 없으면 HEAD 만 보는 규칙 · 못 읽음은 null',
      [NB.pushBranchLabel({ ref: 'main', commits: ['zzz', 'xxx'], refsAt }), NB.pushBranchLabel({ ref: 'main', commits: ['zzz'], refsAt }),
        NB.pushBranchLabel({ ref: 'main', commits: ['zzz', 'yyy'], refsAt }), NB.pushBranchLabel({ ref: 'claude/bar', commits: ['zzz'], refsAt }),
        NB.pushBranchLabel({ ref: 'main', commits: ['zzz', 'xxx'], refsAt: null }), NB.pushBranchLabel({ ref: 'main', commits: [], refsAt }),
        [...NB.refsByCommit('aaa refs/remotes/origin/HEAD\naaa refs/remotes/origin/main\n').entries()], NB.refsByCommit(null)],
      ['claude/foo', BASE, BASE, 'claude/bar', null, null, [['aaa', ['main']]], null]);
    eq('  다시 보낼 응답은 429·5xx 만', [429, 500, 503, 400, 401, 404, 200].map(NB.retryable), [true, true, true, false, false, false, false]);
    const fake = (seq) => {
      let n = 0;
      const fn = async () => { const s = seq[Math.min(n, seq.length - 1)]; n += 1; if (s === 'throw') throw new Error('끊김'); return { status: s, ok: s >= 200 && s < 300 }; };
      return { fn, calls: () => n };
    };
    const tryWith = async (seq) => {
      const f = fake(seq);
      try { const r = await NB.patchWithRetry(f.fn, 'u', {}, [0, 0], async () => {}, () => {}); return [f.calls(), r.ok, r.status]; }
      catch (e) { return [f.calls(), 'throw']; }
    };
    eq('  patchWithRetry — 500→200 은 두 번에 성공 · 400 은 한 번만 · 500 세 번이면 마지막 500 · 끊김→200 은 성공 · 끊김 세 번이면 던진다',
      [await tryWith([500, 200]), await tryWith([400]), await tryWith([500, 500, 500]), await tryWith(['throw', 200]), await tryWith(['throw', 'throw', 'throw'])],
      [[2, true, 200], [1, false, 400], [3, false, 500], [2, true, 200], [3, 'throw']]);
    /* 동작 — 임시 저장소에서 notion-status.mjs --dry 를 따로 돌린다(불러오면 노션에 쓴다) */
    const R = tmpRepo('ops-notion-');
    try {
      R.git('init', '-q', '-b', 'main'); R.put('seed.txt', 'x'); R.git('add', '-A'); R.git('commit', '-qm', '씨앗');
      for (const b of ['main', BASE, 'claude/foo']) R.git('update-ref', `refs/remotes/origin/${b}`, 'HEAD');
      const dry = () => {
        const r = spawnSync(process.execPath, [path.join(rootPath, 'tools/notion-status.mjs'), '--dry'], { cwd: R.dir, encoding: 'utf8', timeout: 60000,
          env: { ...R.env, NOTION_TOKEN: 'dry', GITHUB_ACTOR: 'didinin-wq', GITHUB_REF_NAME: 'main', GITHUB_EVENT_BEFORE: '' } });
        return (r.stdout || '') + (r.stderr || '');
      };
      const withTopic = dry();
      R.git('update-ref', '-d', 'refs/remotes/origin/claude/foo');
      const baseOnly = dry();
      eq('  동작 — main 실행이 그 커밋의 작업 브랜치를 적는다 · 작업 브랜치가 없으면 기본 브랜치',
        [/^\s*브랜치: claude\/foo$/m.test(withTopic), new RegExp(`^\\s*브랜치: ${BASE.replace(/[/.]/g, '\\$&')}$`, 'm').test(baseOnly)], [true, true]);
    } finally { R.done(); }
    /* 동작 — 병합 커밋 main (리뷰 R1 재현): 작업 브랜치 claude/foo = X · main = merge(X, 봇 커밋) = Z · 기본 브랜치 = Z(또는 봇 커밋) */
    const M = tmpRepo('ops-notion-merge-');
    try {
      const sha = () => M.git('rev-parse', 'HEAD').stdout.trim();
      M.git('init', '-q', '-b', 'main'); M.put('seed.txt', 's'); M.git('add', '-A'); M.git('commit', '-qm', '씨앗'); const S = sha();
      M.git('checkout', '-q', '-b', 'claude/foo'); M.put('x.txt', 'x'); M.git('add', '-A'); M.git('commit', '-qm', '작업 X'); const X = sha();
      M.git('checkout', '-q', '-b', 'bot', S); M.put('b.txt', 'b'); M.git('add', '-A'); M.git('commit', '-qm', '봇 커밋'); const B = sha();
      M.git('checkout', '-q', 'claude/foo'); M.git('merge', '-q', '--no-ff', '--no-edit', 'bot'); const Z = sha();
      M.git('update-ref', 'refs/remotes/origin/claude/foo', X); M.git('update-ref', 'refs/remotes/origin/main', Z); M.git('update-ref', `refs/remotes/origin/${BASE}`, Z);
      M.git('update-ref', 'refs/remotes/origin/claude/other', B);      // 남의 브랜치가 둘째 부모(봇 커밋)를 가리킨다 — 고르면 안 된다
      const dry = (beforeSha) => {
        const r = spawnSync(process.execPath, [path.join(rootPath, 'tools/notion-status.mjs'), '--dry'], { cwd: M.dir, encoding: 'utf8', timeout: 60000,
          env: { ...M.env, NOTION_TOKEN: 'dry', GITHUB_ACTOR: 'didinin-wq', GITHUB_REF_NAME: 'main', GITHUB_EVENT_BEFORE: beforeSha } });
        return (((r.stdout || '') + (r.stderr || '')).match(/^\s*브랜치: (.*)$/m) || [])[1] || '(없음)';
      };
      const baseAtZ = dry(S);
      M.git('update-ref', `refs/remotes/origin/${BASE}`, B);
      const baseElsewhere = dry(S);
      eq('  동작 — 병합 커밋을 main 에 올린 실행도 작업 브랜치를 적는다(기본 브랜치가 그 병합 커밋이든 아니든) · 둘째 부모를 가리키는 남의 브랜치는 안 고른다',
        [baseAtZ, baseElsewhere], ['claude/foo', 'claude/foo']);
    } finally { M.done(); }
    /* 배선 — 노션 쓰기가 재시도 함수를 거친다(맨 fetch 로 노션을 부르지 않는다 · 리뷰 R5) */
    const ns = stripComments(read(root, 'tools/notion-status.mjs'));
    eqCode('  notion-status.mjs — 노션 PATCH 는 patchWithRetry(fetch, …) 로만 · 맨 fetch( 호출 없음 · 브랜치 칸은 pushBranchLabel 로',
      [/patchWithRetry\(fetch,\s*`https:\/\/api\.notion\.com\/v1\/pages\//.test(ns), (ns.match(/(?<![\w.$])fetch\s*\(/g) || []).length,
        /const label = pushBranchLabel\(\{[^}]*commits:\s*pushedCommits/.test(ns)],
      [true, 0, true]);
  }

  /* ── ⑤ gaps-04 데이터 로봇 목록은 워크플로에서 읽는다 ── */
  {
    const DR = await import(new URL('tools/data-robots.mjs', root));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-wf-'));
    try {
      const wf = (f, text) => fs.writeFileSync(path.join(dir, f), text);
      wf('a.yml', 'name: 가 로봇 (괄호 · 점)\njobs:\n  a:\n    steps:\n      - run: git add data/registered.json\n');
      wf('b.yml', "name: '나'\njobs:\n  a:\n    steps:\n      - run: |\n          git add collector/seen.json || true\n");
      wf('c.yml', 'name: 다\njobs:\n  a:\n    steps:\n      - run: echo 저장 안 함\n');
      wf('d.yml', 'name: 라\n# 예전엔 git add data/old.json 을 했다\njobs:\n  a:\n    steps:\n      - run: git add assets/x.png\n');
      eq('⑤ gaps-04 dataRobotNames — data/·collector/ 를 git add 하는 워크플로만(따옴표 뗌 · 정렬) · 저장 안 하는 것·주석 속 git add·assets 는 빠진다',
        DR.dataRobotNames(dir), ['가 로봇 (괄호 · 점)', '나']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    const sh = read(root, 'tools/robot-run.sh').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    eqCode('  robot-run.sh — 손 목록(DATA_ROBOTS=) 없음 · tools/data-robots.mjs 를 부른다 · 상태마다 --status 로 묻는다 · 이름은 grep -Fx 로 · gh 실패를 비어 있음 ✅ 으로 말하지 않는다',
      [/DATA_ROBOTS='/.test(sh), /node tools\/data-robots\.mjs/.test(sh), /gh run list --status "\$st"/.test(sh), /grep -Fx -f/.test(sh), /비어 있음 ✅/.test(sh), /--limit 30/.test(sh)],
      [false, true, true, true, false, false]);
  }

  /* ── ⑥ gaps-05 정찰은 이번 push 가 넣은 줄만 ── */
  {
    const PL = await import(new URL('collector/probe-lines.mjs', root));
    const before = [
      '# 머리말 checkUrl: https://주석.kr/0',
      'checkUrl: https://a.kr/1',
      '# (답 받음 2026-10-04) checkUrl: https://b.kr/2',
      'findBoard: https://c.kr | 장학',
      '# checkUrl: https://d.kr/4',
      '',
    ].join('\n');
    const after = [
      '# 머리말 checkUrl: https://주석.kr/0',
      '  checkUrl: https://a.kr/1  ',
      '# (답 받음 2026-10-04) checkUrl: https://b.kr/2',
      'findBoard: https://c.kr | 장학',
      'checkUrl: https://d.kr/4',
      'checkUrl: https://e.kr/5',
      '',
      'findBoard: https://f.kr | 공지',
      '# (답 받음 2026-10-05) checkUrl: https://g.kr/7',
    ].join('\n');
    eq('⑥ gaps-05 addedDirectives — 새 줄·주석을 풀어 되살린 줄만 · 그대로인 줄·주석·빈 줄·답 받음 줄은 빠진다 (checkUrl·findBoard 따로)',
      PL.addedDirectives(before, after), { checkUrl: ['https://d.kr/4', 'https://e.kr/5'], findBoard: ['https://f.kr | 공지'] });
    eq('  directives — 살아 있는 줄 전부(손으로 돌릴 때) · 옛 판이 비면 전부 새 줄',
      [PL.directives(after, 'checkUrl'), PL.addedDirectives('', 'checkUrl: https://x.kr').checkUrl], [['https://a.kr/1', 'https://d.kr/4', 'https://e.kr/5'], ['https://x.kr']]);
    const pl = stripComments(read(root, 'collector/probe-links.mjs'));
    const yml = read(root, '.github/workflows/probe-links.yml');
    eqCode('  probe-links.mjs 가 probe-lines.mjs 를 불러 PROBE_BEFORE 의 옛 판과 견주고(셸 없이 git show) · 워크플로가 github.event.before 를 넘기고 그 커밋을 받아 둔다',
      [/from '\.\/probe-lines\.mjs'/.test(pl), /process\.env\.PROBE_BEFORE/.test(pl), /execFileSync\('git', \['show'/.test(pl), /addedDirectives\(/.test(pl),
        /PROBE_BEFORE:\s*\$\{\{[^}]*github\.event\.before[^}]*\}\}/.test(yml), /git fetch --no-tags --depth=1 origin "\$PROBE_BEFORE"/.test(yml)],
      [true, true, true, true, true, true]);
  }
}
