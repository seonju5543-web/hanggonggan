/* 「로봇·도구 점검 관문」 — ops 묶음: 운영 감시 도구가 거짓 신호를 내지 않는가 (2026-10-05)
   찾은 것:
     ① ops-09 배포 감시(check-deploy-sync)가 두 점 비교라 **main 만 앞선 것**(배포 동기화가 하루 수십 번 main 을 움직인다)도 ❌ 로 내고
        `git push origin HEAD:main` 하나를 권했다(하면 거절된다) · 앱이 받는 assets/(정문·학교 사진 목록)를 앱 파일로 안 봤다(거짓 초록).
     ② ops-10 하트비트 문턱(간격 × 3)이 3시간 로봇에서 9시간 — 예약 실측 최대 틈 9.7시간보다 짧아 헛경보 → 바닥값 12시간.
     ③ ops-11 하트비트가 작업 브랜치의 성공도 셌다 → 기본 브랜치(와 main)의 성공만.
     ④ ops-12 노션 '브랜치' 칸이 늘 main(세 곳 push 에서 대기줄에 남는 실행) · 노션 500 한 번에 빨간불 → 커밋을 가리키는 작업 브랜치 · 재시도.
        (리뷰 R1·R5: 병합 커밋을 main 에 올린 push 는 첫 부모 쪽으로 따라간다 · 노션 PATCH 가 재시도 함수를 거치는지 배선도 잰다)
     ⑤ gaps-04 tools/robot-run.sh 의 손 목록(8개)이 낡아 registered.json 을 쓰는 로봇이 빠졌고, gh 실패를 '비어 있음 ✅'으로 말했다.
        (리뷰 R3: 글자 대조만으로는 `gh … || true` 되돌림을 못 잡았다 → 가짜 gh 로 겉옷을 실제로 돌린다)
     ⑥ gaps-05 정찰이 push 마다 살아 있는 줄 전부(25개)를 다시 열어 같은 학교를 하루 네 번 두드렸다 → 이번 push 가 넣은 줄만.
        (리뷰 R4·R6: 줄 고르기를 pickDirectives 한 곳으로 · 열 줄이 그 결과뿐인지 · 받기 단계의 continue-on-error)
     ⑦ ops-14(Node 20 판 액션)는 이 묶음에 없다 — 다른 묶음이 새 판 줄을 더해 반드시 부딪힌다(리뷰 R2). 모든 묶음을 합친 뒤 마지막 한 커밋이
        판 줄을 바꾸고 그 관문을 이 파일 끝에 더한다.
   🔴 표본(고정 예시)과 임시 git 저장소만 잰다 — data/·collector/ 장부는 읽지 않는다.
   🔴 코드 위생 대조(④ 노션 배선 · ⑤ 겉옷 글자 · ⑥ 정찰 배선·워크플로 글자)는 문서 관문과 같은 잣대(로컬·verify-ui DOC_GATES=1 에서만 실패 ·
      수집 로봇의 데이터 관문에서는 경고만) — 거기서 빨개지면 자동 등록분이 되돌려진다.
   🔴 임시 저장소를 쓰는 관문(①④⑤)은 자식 env 에서 GIT_DIR·GIT_WORK_TREE·GIT_INDEX_FILE 을 지운다(훅 안에서 돌 때 진짜 저장소를 건드리지 않게).
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
    /* 🔴 저장은 됐는데 관문만 빨간 실행 (2026-11-10 · 은서 — 11/4~11/7 수집분은 매번 저장됐는데 '96시간 조용'이라 경보해 '수집이 멈췄다'고 잘못 보고했다).
       표본은 실제 실행(11/7 장학 42377311075 · 10월 브라우저 넘어짐)의 단계 꼴 그대로 */
    const job = (...st) => [{ steps: st.map(([name, conclusion]) => ({ name, conclusion })) }];
    const SAVE = ['수집 상태 저장 (중복 방지 기록)', 'success'];
    const RED = ['🚨 관문이 끝내 빨간불 (되돌린 뒤에도)', 'failure'];
    eq('② ⓑ 저장 성공 + 실패한 단계가 「관문이 끝내 빨간불」 하나뿐 → 저장됨·관문 빨간불(조용하다고 경보하지 않는다)',
      HB.savedThoughGateRed(job(['데이터 관문 (수집기 규칙 테스트 + 데이터 감사)', 'success'], SAVE, RED)), true);
    eq('  🔴 다른 단계가 하나라도 실패(넘어짐·시간초과·저장 실패)면 아니다 — 진짜로 멈춘 것 · 저장이 안 됐으면 아니다 · 단계를 못 읽으면 아니다(모르면 경보)',
      [HB.savedThoughGateRed(job(SAVE, ['공고 원문 발췌 갱신 (정직 원칙 — 추론 대신 원문 그대로)', 'failure'])),
        HB.savedThoughGateRed(job(SAVE, RED, ['게시판 수집', 'cancelled'])),
        HB.savedThoughGateRed(job(['수집 상태 저장 (중복 방지 기록)', 'failure'], RED)),
        HB.savedThoughGateRed(job(['수집 상태 저장 (중복 방지 기록)', 'skipped'], RED)),
        HB.savedThoughGateRed([]), HB.savedThoughGateRed(null), HB.savedThoughGateRed(job(SAVE))],
      [false, false, false, false, false, false, false]);
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
    /* 동작 — 임시 저장소에 겉옷·목록 도구·표본 워크플로를 두고 **가짜 gh** 로 실제로 돌린다 (리뷰 R3).
       글자 대조만으로는 `OUT=$(gh … || true)` 로 되돌려 gh 실패가 다시 '없음 ✅' 이 되는 것을 못 잡았다. 실데이터·진짜 gh 는 쓰지 않는다. */
    if (spawnSync('bash', ['-c', 'true']).status !== 0) {
      eqCode('  bash 를 못 찾아 robot-run.sh 를 돌려 보지 못했다(못 잰 것은 통과가 아니다)', false, true);
    } else {
      const R = tmpRepo('ops-robotrun-');
      try {
        R.git('init', '-q', '-b', 'work');
        R.put('tools/robot-run.sh', read(root, 'tools/robot-run.sh'));
        R.put('tools/data-robots.mjs', read(root, 'tools/data-robots.mjs'));
        R.put('.github/workflows/a.yml', 'name: 가 로봇 (괄호 · 점)\njobs:\n  a:\n    steps:\n      - run: git add data/registered.json\n');
        R.put('.github/workflows/c.yml', 'name: 다른 로봇\njobs:\n  a:\n    steps:\n      - run: echo 저장 안 함\n');
        R.put('fakebin/gh', [
          '#!/usr/bin/env bash',
          'st=""; while [ $# -gt 0 ]; do [ "$1" = "--status" ] && st=$2; shift; done',
          'case "$FAKE_GH" in',
          '  fail) echo "가짜 gh: HTTP 401 열쇠 거절" >&2; exit 1 ;;',
          '  fail-last) [ "$st" = requested ] && { echo "가짜 gh: 모르는 상태 이름 requested" >&2; exit 1; } ;;',
          '  busy) [ "$st" = queued ] && echo "가 로봇 (괄호 · 점)" ;;',
          '  other) [ "$st" = in_progress ] && echo "다른 로봇" ;;',
          'esac',
          'exit 0', ''].join('\n'));
        fs.chmodSync(path.join(R.dir, 'fakebin/gh'), 0o755);
        R.git('add', '-A'); R.git('commit', '-qm', '씨앗');
        const run = (mode) => {
          const r = spawnSync('bash', [path.join(R.dir, 'tools/robot-run.sh'), 'true'], { cwd: R.dir, encoding: 'utf8', timeout: 60000,
            env: { ...R.env, PATH: `${path.join(R.dir, 'fakebin')}${path.delimiter}${process.env.PATH}`, FAKE_GH: mode, ROBOT_RUN_FORCE: '0' } });
          const out = (r.stdout || '') + (r.stderr || '');
          return { status: r.status, out, ran: out.includes('■ ③ 로봇 실행: true'), calm: /도는 데이터 로봇 없음 ✅/.test(out) };
        };
        const fail = run('fail'), failLast = run('fail-last'), busy = run('busy'), other = run('other');
        eq('  동작(가짜 gh) — gh 가 실패하면 멈춘다(1) · 못 확인했다고 말하고 실패한 상태 이름과 gh 의 문구를 그대로 보인다 · 없음 ✅ 이라고 하지 않는다 · 로봇을 안 돌린다',
          [fail.status, /⚠️ 클라우드 상태를 확인하지 못했습니다/.test(fail.out), /--status in_progress 가 실패했습니다: 가짜 gh: HTTP 401 열쇠 거절/.test(fail.out), fail.calm, fail.ran],
          [1, true, true, false, false]);
        eq('  동작(가짜 gh) — 마지막 상태(requested)만 실패해도 멈춘다(상태 다섯을 다 묻는다)',
          [failLast.status, /--status requested 가 실패했습니다: 가짜 gh: 모르는 상태 이름 requested/.test(failLast.out), failLast.calm, failLast.ran], [1, true, false, false]);
        eq('  동작(가짜 gh) — 데이터 로봇이 줄 서 있으면 ⛔ 로 멈춘다(괄호·가운뎃점 이름을 글자 그대로 맞춘다) · 다른 로봇만 돌면 없음 ✅ 뒤 로봇을 돌린다(0)',
          [busy.status, /⛔ 지금 클라우드에서 돌거나 줄 선 데이터 로봇/.test(busy.out), busy.out.includes('· 가 로봇 (괄호 · 점)'), busy.ran, other.status, other.calm, other.ran],
          [1, true, true, false, 0, true, true]);
        R.git('rm', '-q', '.github/workflows/a.yml'); R.git('commit', '-qm', '데이터 로봇 없음');
        const none = run('other');
        eq('  동작 — 데이터 로봇 목록이 비면 ⛔ 로 멈춘다(1 · 어느 로봇과 겹치는지 못 가른다)',
          [none.status, /⛔ 데이터 로봇 목록을 못 읽었습니다/.test(none.out), none.ran], [1, true, false]);
      } finally { R.done(); }
    }
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
    /* 줄 고르기 한 곳(pickDirectives) — 손 실행 · push(옛 판 읽음) · 옛 판 못 읽음 · 0 커밋(새 브랜치) · 16진수 아닌 값 (리뷰 R4) */
    const OLD_SHA = 'a'.repeat(40);
    const asked = [];
    const readOld = (sha) => { asked.push(sha); if (sha !== OLD_SHA) throw new Error('없음'); return before; };
    const pick = (b) => { const p = PL.pickDirectives({ before: b, cfg: after, readOld }); return [p.lines('checkUrl'), p.lines('findBoard'), p.only === null, /못 가려 전부/.test(p.note)]; };
    const allC = PL.directives(after, 'checkUrl'), allF = PL.directives(after, 'findBoard');
    eq('  pickDirectives — 손 실행은 전부(문구 없음) · push 는 새 줄만 · 옛 판을 못 읽거나 0 커밋·이상한 값이면 전부 열고 그렇다고 적는다 · 16진수 40자리만 git 에 넘긴다',
      [pick(''), pick(OLD_SHA), pick('b'.repeat(40)), pick('0'.repeat(40)), pick('HEAD; rm -rf /'), asked],
      [[allC, allF, true, false], [['https://d.kr/4', 'https://e.kr/5'], ['https://f.kr | 공지'], false, false], [allC, allF, true, true], [allC, allF, true, true], [allC, allF, true, true],
        [OLD_SHA, 'b'.repeat(40)]]);
    const pl = stripComments(read(root, 'collector/probe-links.mjs'));
    const yml = read(root, '.github/workflows/probe-links.yml');
    const fetchStep = (yml.match(/- name: push 직전 판 받기[^\n]*\n((?:[ \t]{8,}[^\n]*\n)+)/) || [])[1] || '';
    eqCode('  probe-links.mjs 의 열 줄(lines)은 pickDirectives 가 준 것뿐(PROBE_BEFORE · 셸 없는 git show 를 넘김 · 따로 고르는 directives( 없음) · 두 반복문이 그 lines 를 쓴다',
      [/from '\.\/probe-lines\.mjs'/.test(pl), /const \{\s*lines\b[^}]*\}\s*=\s*pickDirectives\(\{[^]*?before:\s*process\.env\.PROBE_BEFORE[^]*?readOld:[^]*?execFileSync\('git', \['show'/.test(pl),
        (pl.match(/\b(const|let|var|function)\s+lines\b|\blines\s*=/g) || []).length, /(?<![\w.])(directives|addedDirectives)\(/.test(pl),
        /for \(const \w+ of lines\('checkUrl'\)\)/.test(pl), /for \(const \w+ of lines\('findBoard'\)\)/.test(pl)],
      [true, true, 0, false, true, true]);
    eqCode('  probe-links.yml — github.event.before 를 넘기고 그 커밋을 받아 둔다 · 그 받기 단계는 보강 단계(시한 + continue-on-error) · 실패해도 정찰은 돈다',
      [/PROBE_BEFORE:\s*\$\{\{[^}]*github\.event\.before[^}]*\}\}/.test(yml), /git fetch --no-tags --depth=1 origin "\$PROBE_BEFORE"/.test(fetchStep),
        /^\s*timeout-minutes:\s*\d+/m.test(fetchStep), /^\s*continue-on-error:\s*true\b/m.test(fetchStep)],
      [true, true, true, true]);
  }

  /* ── ⑤ 직전 판으로 되돌리기 (2026-11-11 · 은서 · 출시 전 백엔드 8번 — tools/rollback.mjs · rollback.yml) ──
     임시 git 저장소에서 진짜로 돌린다: 고른 사람 작업만 취소되고 그 뒤의 로봇 데이터·다른 작업은 남는다 · 로봇 작업·합치기·워크플로 파일은 못 고른다 ·
     부딪히면 아무것도 안 바꾼다 · 미리보기는 아무것도 안 바꾼다 · 워크플로는 미리보기가 기본·번호 필수·검사 뒤 저장·되감기 없음 */
  {
    const RB = await import(new URL('tools/rollback.mjs', root));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-rollback-'));
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k)));
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env });
    const w = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
    const r = (f) => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null);
    const as = (who) => (who === 'bot' ? ['-c', 'user.name=handaejang-bot', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com'] : ['-c', `user.name=${who}`, '-c', `user.email=${who}@example.com`]);
    const commit = (who, msg) => { g('add', '-A'); g(...as(who), 'commit', '-qm', msg); return g('rev-parse', 'HEAD').stdout.trim(); };
    try {
      g('init', '-q', '-b', 'main'); g('config', 'commit.gpgsign', 'false');
      g('config', 'user.name', 'handaejang-bot'); g('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');   // rollback.yml 이 하는 것과 같게(2026-11-11 — 이게 없어 GitHub 기계에서만 빨갰다)
      w('app.js', 'line1\nline2\n'); w('data/notices.json', '[]\n'); commit('은서', '씨앗');
      w('app.js', 'line1\nBROKEN\n'); const bad = commit('은서', '앱을 망가뜨린 작업');
      w('data/notices.json', '[{"id":1}]\n'); const botSha = commit('bot', 'collector: seen state update');
      w('style.css', 'a{}\n'); const later = commit('세현', '뒤의 다른 작업');
      w('.github/workflows/x.yml', 'name: x\n'); const wf = commit('은서', '워크플로 고침');
      const list = RB.listHumanCommits(dir).map((c) => c.subject);
      eq('⑤ 목록 — 사람 작업만(로봇 수집 기록은 뺀다) · 최근 것부터',
        list, ['워크플로 고침', '뒤의 다른 작업', '앱을 망가뜨린 작업', '씨앗']);
      const head0 = g('rev-parse', 'HEAD').stdout.trim();
      const pv = RB.refuseReason(dir, RB.resolveSha(dir, bad.slice(0, 8)));
      eq('  미리보기·검사는 아무것도 안 바꾼다(HEAD 그대로 · 짧은 번호도 알아본다)', [pv, g('rev-parse', 'HEAD').stdout.trim() === head0], [null, true]);
      const ok = RB.revertCommit(dir, bad.slice(0, 8));
      eq('  🔴 고른 작업만 취소 — 앱 파일은 원래대로 · 그 뒤 로봇 데이터·다른 사람 작업은 그대로 · 기록은 지우지 않고 하나 얹는다(되감지 않는다)',
        [ok.status, r('app.js'), r('data/notices.json'), r('style.css'), g('rev-list', '--count', 'HEAD').stdout.trim(), g('cat-file', '-e', bad).status],
        ['reverted', 'line1\nline2\n', '[{"id":1}]\n', 'a{}\n', '6', 0]);
      const head1 = g('rev-parse', 'HEAD').stdout.trim();
      eq('  🔴 못 고르는 것 — 로봇 작업 · 워크플로 파일을 고친 작업 · 없는 번호 · 합치기 기록(전부 아무것도 안 바꾼다)',
        [RB.revertCommit(dir, botSha).status, RB.revertCommit(dir, wf).status, RB.revertCommit(dir, 'deadbeef').status, g('rev-parse', 'HEAD').stdout.trim() === head1],
        ['refused', 'refused', 'refused', true]);
      g('checkout', '-qb', 'side', `${later}`); w('side.txt', 's\n'); commit('은서', '옆 작업');
      g('checkout', '-q', 'main'); g(...as('은서'), 'merge', '-q', '--no-ff', '-m', '합치기', 'side');
      const mergeSha = g('rev-parse', 'HEAD').stdout.trim();
      eq('  합치기 기록은 못 고른다', RB.revertCommit(dir, mergeSha).status, 'refused');
      w('style.css', 'b{}\n'); const s1 = commit('세현', '스타일 1');
      w('style.css', 'c{}\n'); commit('세현', '스타일 2(같은 줄을 또 고침)');
      const head2 = g('rev-parse', 'HEAD').stdout.trim();
      const cf = RB.revertCommit(dir, s1);
      eq('  🔴 부딪히면 멈추고 아무것도 안 바꾼다 — HEAD·파일 그대로 · 되돌리기 진행 중 상태가 남지 않는다 · 부딪힌 파일을 알려 준다',
        [cf.status, g('rev-parse', 'HEAD').stdout.trim() === head2, r('style.css'), fs.existsSync(path.join(dir, '.git', 'REVERT_HEAD')), cf.files],
        ['conflict', true, 'c{}\n', false, ['style.css']]);
      /* 2026-11-11 — GitHub 기계엔 커밋 이름이 없어 git 이 거절했는데 도구가 '부딪힘'이라 적었다. 이름 없는 기계를 흉내 낸다 */
      g('config', '--unset', 'user.name'); g('config', '--unset', 'user.email'); g('config', 'user.useConfigOnly', 'true');
      const saved = { G: process.env.GIT_CONFIG_GLOBAL, S: process.env.GIT_CONFIG_NOSYSTEM };
      process.env.GIT_CONFIG_GLOBAL = '/dev/null'; process.env.GIT_CONFIG_NOSYSTEM = '1';
      const head3 = g('rev-parse', 'HEAD').stdout.trim();
      let noName; try { noName = RB.revertCommit(dir, bad); } finally {
        if (saved.G === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = saved.G;
        if (saved.S === undefined) delete process.env.GIT_CONFIG_NOSYSTEM; else process.env.GIT_CONFIG_NOSYSTEM = saved.S;
      }
      eq('  git 이 다른 이유로 거절하면(커밋 이름 없음) 부딪힘이라 하지 않고 그 이유를 말한다 · 아무것도 안 바꾼다',
        [noName.status, /거절/.test(noName.reason || ''), g('rev-parse', 'HEAD').stdout.trim() === head3, fs.existsSync(path.join(dir, '.git', 'REVERT_HEAD'))],
        ['error', true, true, false]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    const yml = read(root, '.github/workflows/rollback.yml').replace(/^\s*#.*$/gm, '');   // 주석은 걷고 잰다(금지된 길을 설명하는 주석에 걸리지 않게)
    const src = stripComments(read(root, 'tools/rollback.mjs'));
    eq('  rollback.yml — 미리보기가 기본 · 되돌리기는 번호 없으면 멈춤 · 기본 브랜치에서만 · 검사가 저장보다 앞 · 저장 뒤 배포 동기화를 깨움 · 입력은 환경 변수로만 · 되감기·강제 push 없음 · 시한',
      [/default: '미리보기'/.test(yml), /if \[ -z "\$COMMIT" \]; then[\s\S]*?exit 1/.test(yml), /if: github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(yml),
        yml.indexOf('node verify/audit-data.js') > 0 && yml.indexOf('node verify/audit-data.js') < yml.indexOf('git push origin'), /gh workflow run deploy-sync\.yml/.test(yml),
        !/run:[^\n]*\$\{\{\s*inputs\./.test(yml) && /COMMIT: \$\{\{ inputs\.commit \}\}/.test(yml), !/--force|reset --hard|push -f\b/.test(yml + src), /^ {4}timeout-minutes: \d+/m.test(yml)],
      [true, true, true, true, true, true, true, true]);
    eq('  🔴 \'가장 최근 작업 바로 되돌리기\' 길이 없다(2026-11-11 은서 결정) — 되돌리기는 번호를 받아야만 한다',
      [/--latest|최근 것 바로|HEAD~1/.test(yml + src), /revertCommit\(cwd, arg\('--revert'\)\)/.test(src)], [false, true]);
  }

  /* ── ⑥ 열쇠 목록 · 만료 알림 (2026-11-11 · 은서 · 출시 전 백엔드 9번 — docs/backend/keys.json · tools/key-expiry.mjs · key-expiry.yml) ──
     관리자 열쇠가 아무도 모르게 11/7 에 만료됐다. 🔴 목록에 값은 없다 · 새 열쇠는 목록에 적어야 통과 · 14일 전부터 경보 · 사람용 표는 원본과 같다 */
  {
    const KE = await import(new URL('tools/key-expiry.mjs', root));
    const st = (e) => KE.keyState({ expires: e }, '2026-11-11');
    eq('⑥ 만료 판정 — 지남 · 14일째까지 임박 · 15일째는 아직 · 없음 · 확인 필요(경보 안 함) · 자동 확인',
      [st('2026-11-10'), st('2026-11-25'), st('2026-11-26'), st('없음').state, st('확인 필요').state, st('자동 확인').state],
      [{ state: 'expired', days: -1 }, { state: 'soon', days: 14 }, { state: 'ok', days: 15 }, 'none', 'unknown', 'auto']);
    eq('  임박 목록 — 지남·임박만, 급한 순 · 확인 필요는 빠진다',
      KE.dueKeys([{ name: 'a', expires: '2026-12-31' }, { name: 'b', expires: '2026-11-20' }, { name: 'c', expires: '2026-11-01' }, { name: 'd', expires: '확인 필요' }], '2026-11-11').map((k) => k.name), ['c', 'b']);
    const bad = (k) => { try { KE.loadKeys(JSON.stringify({ keys: [k] })); return '통과'; } catch (e) { return '거절'; } };
    const base = { name: 'X', where: 'GitHub Secrets', expires: '없음' };
    eq('  🔴 값처럼 생긴 글자는 거절 — 열쇠 접두어·JWT·긴 덩어리 · 이름·두는 곳 빠짐 · 틀린 날짜 꼴도 거절 · 멀쩡한 줄은 통과',
      [bad({ ...base, renew: 'sk-ant-api03-abcdefghij' }), bad({ ...base, renew: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.x' }), bad({ ...base, for: 'AbCdEf0123456789AbCdEf0123456789xy' }),
        bad({ name: 'X', expires: '없음' }), bad({ ...base, expires: '내년쯤' }), bad(base)],
      ['거절', '거절', '거절', '거절', '거절', '통과']);
    const keys = KE.loadKeys(read(root, 'docs/backend/keys.json'));
    const names = new Set(keys.map((k) => k.name));
    const wfDir = path.join(rootPath, '.github');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const usedSecrets = [...new Set(walk(wfDir).filter((f) => /\.ya?ml$/.test(f)).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1])))].filter((n) => n !== 'GITHUB_TOKEN');
    const serverSecrets = [...new Set(walk(path.join(rootPath, 'server')).filter((f) => /\.(md|toml|js|mjs)$/.test(f)).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/wrangler secret put ([A-Z0-9_]+)/g)].map((m) => m[1])))];
    eq(`  🔴 로봇(secrets.이름 ${usedSecrets.length}개)·서버(wrangler secret put ${serverSecrets.length}개)가 쓰는 열쇠는 전부 목록에 있다 — 새 열쇠를 쓰면 목록에도 적어야 통과`,
      [...usedSecrets, ...serverSecrets].filter((n) => !names.has(n)), []);
    eq('  (대조할 것을 실제로 뽑았다 — 로봇 열쇠 10개 이상 · 서버 열쇠 5개 이상)', [usedSecrets.length >= 10, serverSecrets.length >= 5], [true, true]);
    eq('  사람용 표(열쇠-목록.md)가 원본(keys.json)과 같다 — 다르면 node tools/key-expiry.mjs --render',
      KE.renderDoc(read(root, 'docs/backend/열쇠-목록.md'), keys) === read(root, 'docs/backend/열쇠-목록.md'), true);
    const yml = read(root, '.github/workflows/key-expiry.yml').replace(/^\s*#.*$/gm, '');
    const cronMin = Number(((yml.match(/cron: '(\d+) /) || [])[1]));
    eq('  key-expiry.yml — 홀수 분 예약 · 기본 브랜치에서만 · 시한 · 여는·닫는 경보 제목이 같다 · 세 사람 · issues: write · 넘어지면 robot-down',
      [cronMin % 2 === 1, /if: github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(yml), /^ {4}timeout-minutes: \d+/m.test(yml),
        (yml.match(/🔑 열쇠 만료가 다가옵니다/g) || []).length, /--assignee seonju5543-web --assignee Se-Hyeon-Jo --assignee didinin-wq/.test(yml), /issues: write/.test(yml),
        /failure\(\) \|\| cancelled\(\)[\s\S]*robot-down/.test(yml)],
      [true, true, true, 2, true, true, true]);
  }

  /* ── ⑦ 보안 자동 점검 (2026-11-11 · 은서 · 출시 전 백엔드 10번 — .github/dependabot.yml · codeql.yml · tools/codeql-alerts.mjs) ──
     🔴 Security 탭은 아무도 안 본다 → 심각 경고는 경보 이슈로 · Dependabot 판 올림 PR 이 와도 관문이 판 번호 때문에 빨개지지 않는다 */
  {
    const CA = await import(new URL('tools/codeql-alerts.mjs', root));
    const A = (sec, sev, state = 'open') => ({ state, rule: { security_severity_level: sec, severity: sev } });
    eq('⑦ 심각 경고 — 보안 high·critical 만 · 보안 등급이 없으면 규칙 수준 error 만 · medium·warning·note 는 Security 탭에만',
      [A('critical'), A('high'), A('medium', 'error'), A('low'), A(null, 'error'), A(null, 'warning'), A(null, 'note')].map(CA.isSerious),
      [true, true, false, false, true, false, false]);
    eq('  gh api --paginate 가 쪽마다 이어 붙인 배열(][)도 읽는다 · 빈 응답은 0개',
      [CA.parseAlerts('[{"a":1}][{"a":2},{"a":3}]').length, CA.parseAlerts('[]').length, CA.parseAlerts('').length], [3, 0, 0]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-codeql-'));
    fs.writeFileSync(path.join(tmp, 'a.json'), JSON.stringify([{ ...A('high'), html_url: 'u1', rule: { id: 'js/xss', security_severity_level: 'high' }, most_recent_instance: { location: { path: 'app.js', start_line: 9 } } }, A('high', null, 'dismissed'), A('low')]));
    const outF = path.join(tmp, 'out'); fs.writeFileSync(outF, '');
    CA.main([path.join(tmp, 'a.json'), path.join(tmp, 'b.md')], { GITHUB_OUTPUT: outF });
    const bodyMd = fs.readFileSync(path.join(tmp, 'b.md'), 'utf8');
    eq('  열린 것만 센다(닫은 것 제외) · GITHUB_OUTPUT 에 serious= · 🔴 공개 저장소라 본문엔 개수·심각도와 Security 탭 주소만(규칙·파일·줄을 적지 않는다)',
      [fs.readFileSync(outF, 'utf8').trim(), /1개/.test(bodyMd) && /security\/code-scanning/.test(bodyMd), /js\/xss|app\.js|u1/.test(bodyMd)], ['serious=1', true, false]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const dep = read(root, '.github/dependabot.yml').replace(/^\s*#.*$/gm, '');
    eq('  dependabot.yml — 워크플로 부품(github-actions)·푸시 서버(npm /server/push) · 기본 브랜치로 · 한 달에 한 번 · 묶어서 PR 하나 · 열린 PR 상한',
      [/package-ecosystem: github-actions[^\n]*\n\s+directory: \//.test(dep), /package-ecosystem: npm[^\n]*\n\s+directory: \/server\/push/.test(dep),
        (dep.match(/target-branch: claude\/nice-heisenberg-WESq5/g) || []).length, (dep.match(/interval: monthly/g) || []).length,
        (dep.match(/patterns: \['\*'\]/g) || []).length, (dep.match(/open-pull-requests-limit: \d/g) || []).length],
      [true, true, 2, 2, 2, 2]);
    const cq = read(root, '.github/workflows/codeql.yml').replace(/^\s*#.*$/gm, '');
    eq('  codeql.yml — 언어 셋(자바스크립트·파이썬·워크플로) · 기본 브랜치에서만 · 코드가 바뀔 때만 push(데이터 커밋엔 안 돈다) · 홀수 분 예약 · 결과 올리기 권한 · 시한',
      [/language: \[javascript-typescript, python, actions\]/.test(cq), (cq.match(/github\.ref_name == 'claude\/nice-heisenberg-WESq5'/g) || []).length >= 2,
        /push:\s+branches: \[claude\/nice-heisenberg-WESq5\]\s+paths:/.test(cq) && !/- 'data\//.test(cq), Number((cq.match(/cron: '(\d+) /) || [])[1]) % 2 === 1,
        /security-events: write/.test(cq), (cq.match(/^ {4}timeout-minutes: \d+/gm) || []).length],
      [true, true, true, true, true, 2]);
    eq('  🔴 CodeQL 은 새 push 에 돌던 점검을 취소하지 않는다 — 취소가 robot-down 경보 셋을 열었다(2026-11-12 #619~621)', /cancel-in-progress: false/.test(cq) && !/cancel-in-progress: true/.test(cq), true);
    const cor = read(root, '.github/workflows/close-old-reports.yml').replace(/^\s*#.*$/gm, '');
    eq('  지난 리포트 정리 — 매일 · 기본 3일(2026-11-12 · 주 1회·14일이라 리포트 87건이 경보를 묻었다) · 수동 입력 기본값도 3',
      [/cron: '\d+ \d+ \* \* \*'/.test(cor), /DAYS: \$\{\{ inputs\.days \|\| '3' \}\}/.test(cor), /default: '3'\n\s+dry_run:/.test(cor)], [true, true, true]);
    eq('  🔴 심각 경고는 세 사람 경보 이슈로 — 여는·닫는 제목이 같다 · 두 일자리 모두 넘어지면 robot-down',
      [(cq.match(/🛡 보안 코드 점검에서 고칠 것이 나왔습니다/g) || []).length, /--assignee seonju5543-web --assignee Se-Hyeon-Jo --assignee didinin-wq/.test(cq),
        (cq.match(/if: failure\(\) \|\| cancelled\(\)\s+uses: \.\/\.github\/actions\/robot-down/g) || []).length],
      [2, true, 2]);
    /* Dependabot 이 actions/checkout@v4 → v5 로 올리면, 실제 워크플로를 판 번호까지 박아 읽는 관문은 빨개진다(11-11 모의로 넷을 찾아 고쳤다).
       정규식 안의 `actions\/이름@v숫자` 를 금지한다 — 표본 글자('actions/checkout@v4')는 괜찮다 */
    const gateFiles = ['verify/test-collector.mjs', ...fs.readdirSync(path.join(rootPath, 'verify/health-gates')).filter((f) => f.endsWith('.mjs')).map((f) => `verify/health-gates/${f}`)];
    const TR = await import(new URL('tools/codeql-triage.mjs', root));
    const planOk = (t) => { try { return TR.plan(t).length; } catch { return '거절'; } };
    eq('  경고 정리 — 닫을 목록: 번호·정해진 이유·짧은 글만 · 틀린 번호·이유·중복·빈 글·빈 목록은 통째로 거절',
      [planOk('[{"n":3,"reason":"false positive","comment":"검사 파일"}]'), planOk('[{"n":"x","reason":"false positive","comment":"a"}]'), planOk('[{"n":3,"reason":"그냥","comment":"a"}]'),
        planOk('[{"n":3,"reason":"used in tests","comment":"a"},{"n":3,"reason":"used in tests","comment":"b"}]'), planOk('[{"n":3,"reason":"won\'t fix","comment":""}]'), planOk('[]')],
      [1, '거절', '거절', '거절', '거절', '거절']);
    eq('  경고 정리 — 열린 것만 줄인다(닫은 것 제외)', TR.slim([{ number: 1, state: 'open', rule: { id: 'r' }, most_recent_instance: { location: { path: 'a.js', start_line: 2 } } }, { number: 2, state: 'dismissed' }]).map((x) => [x.n, x.path, x.line]), [[1, 'a.js', 2]]);
    const tri = read(root, '.github/workflows/codeql-triage.yml').replace(/^\s*#.*$/gm, '');
    eq('  🔴 codeql-triage.yml — 버튼만(예약·push 없음) · 기본 브랜치에서만 · 목록은 공개 열쇠로 잠가서만 싣는다(열쇠 없으면 멈춤 · 잠그지 않은 list.json 을 찍지 않는다) · 입력은 env 로 · 넘어지면 robot-down',
      [!/schedule:|push:/.test(tri), /if: github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(tri), /openssl pkeyutl -encrypt -pubin/.test(tri) && /\[ -n "\$PUBKEY_B64" \] \|\| \{/.test(tri),
        !/cat [^\n]*list\.json|echo [^\n]*\$\(cat/.test(tri), tri.split('\n').filter((l) => /\$\{\{\s*inputs\./.test(l)).every((l) => /^\s+[A-Z0-9_]+: \$\{\{ inputs\.\w+ \}\}\s*$|^\s+if: inputs\./.test(l)), /failure\(\) \|\| cancelled\(\)\s+uses: \.\/\.github\/actions\/robot-down/.test(tri)],
      [true, true, true, true, true, true]);
    /* CodeQL js/redos — 등록 로봇의 붙박이 말 판정이 겹치는 말(장학+생=장학생) 때문에 길이마다 두 배로 느려졌다(73자 0.7초 실측) → 자리별 표로 바꿨다 */
    {
      const RT = await import(new URL('collector/register-timing.mjs', root));
      const W = ['장학', '장학생', '생', '대학', '대학생', '대학원', '학년', '학년도', '년도', '공통', '서울'];
      let seed = 7; const rnd = () => { seed = (seed * 48271) % 2147483647; return seed; };
      const samples = ['', '가', '대산', '장학생가', '하반기신규장학생', '교외장학금안내', '서울대학교'];
      for (let i = 0; i < 300; i += 1) { let t = ''; const k = 1 + (rnd() % 6); for (let j = 0; j < k; j += 1) t += W[rnd() % W.length]; if (rnd() % 3 === 0) t += '가'; samples.push(t); }
      eq('  🔴 붙박이 말 판정(STOCK)이 예전 정규식과 같은 답 — 표본 307개(짧은 것만 · 정규식이 느려지기 전)',
        samples.filter((t) => RT.STOCK.test(t) !== RT.STOCK_RE_FOR_GATE.test(t)), []);
      const t0 = Date.now(); RT.STOCK.test('장학생'.repeat(26) + '가'); const ms = Date.now() - t0;
      eq('  🔴 79자 최악 덩어리도 즉시 끝난다(200ms 안 — 예전 정규식은 몇 초 · 12자 늘 때마다 약 16배)', ms < 200, true);
    }
    /* 🔴 2026-11-11 CodeQL #607 — tools/gate-reel/reel.html 이 주소 뒤 글자(?list=)를 innerHTML 로 끼워 넣어, 조작한 링크 하나로 앱과 같은 주소의
       저장소(프로필·로그인)를 읽을 수 있었다(진짜 브라우저로 실행 확인 → 고친 뒤 막힘 확인). 학생 주소에 공개되는 HTML 은 전부 같은 기준 */
    const servedHtml = spawnSync('git', ['ls-files', '-z', '*.html'], { cwd: rootPath, encoding: 'utf8' }).stdout.split('\0').filter((f) => f && !f.startsWith('_admin/') && fs.existsSync(path.join(rootPath, f)));
    eq(`  🔴 공개되는 HTML(${servedHtml.length}장)은 주소 뒤 글자(location.search·hash)를 읽으면서 HTML 로 끼워 넣지 않는다(innerHTML·insertAdjacentHTML·document.write)`,
      servedHtml.filter((f) => { const t = fs.readFileSync(path.join(rootPath, f), 'utf8'); return /location\.(search|hash)|URLSearchParams/.test(t) && /\.innerHTML\s*[+]?=|insertAdjacentHTML|document\.write/.test(t); }), []);
    const reel = read(root, 'tools/gate-reel/reel.html');
    eq('  reel.html — manifest 에 있는 사진 이름만 받는다 · 글자는 textContent 로', [/hasOwnProperty\.call\(byFile, file\)/.test(reel), /textContent/.test(reel)], [true, true]);
    eq('  🔴 관문 정규식이 부품 판 번호를 박지 않는다(actions\\/이름@v숫자) — 박으면 Dependabot PR 마다 관문이 빨개진다',
      gateFiles.filter((f) => /actions\\\/[a-z-]+@v\d/.test(read(root, f))), []);
  }

  /* ── ⑧ 경보 짝 — 회복하면 닫힌다 (2026-11-13 · 은서 · 출시 전 백엔드 마무리) ──
     #501(한국장학재단)·#546(인스타 준비)은 여는 단계만 있어 회복한 뒤에도 몇 주씩 열려 있었고, 배포 동기화는 제목에 날짜를 붙여
     실패마다 새 이슈를 만들고 닫지 않았다(CLAUDE.md '제목에 날짜 금지'). 상태 경보는 여는 제목 = 닫는 제목이어야 한다 */
  {
    const wfDir = path.join(rootPath, '.github/workflows');
    const files = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml'));
    const opens = []; const closes = new Set(); const labelClosers = new Set();
    for (const f of files) {
      const t = fs.readFileSync(path.join(wfDir, f), 'utf8').replace(/^\s*#.*$/gm, '');
      for (const m of t.matchAll(/gh issue create[^\n]*(?:\\\n[^\n]*)*?--title\s+(['"])(.+?)\1/g)) opens.push({ f, title: m[2] });
      for (const m of t.matchAll(/const title = (['"`])(.+?)\1/g)) opens.push({ f, title: m[2] });
      for (const m of t.matchAll(/mode: resolve\s+title:\s*(.+)/g)) closes.add(m[1].trim());
      for (const m of t.matchAll(/--mode resolve[^\n]*?--title\s+(['"])(.+?)\1/g)) closes.add(m[2]);
      /* 라벨로 닫는 로봇 — 상태 하나만 다루는 셋만(insta.yml 처럼 다른 작업이 라벨로 닫는 파일 전체를 '닫힘'으로 치면 짝 빠짐을 못 본다 · 11-13 red-green 에서 실제로 놓쳤다) */
      if (/gh issue close "\$n"/.test(t) && ['robot-heartbeat.yml', 'push-health.yml', 'admin-lock-check.yml'].includes(f)) labelClosers.add(f);
    }
    const alarms = opens.filter((o) => /^🚨/.test(o.title));
    /* 날짜를 붙인 제목 — 사람이 누른 한 번의 일(실패 기록)만 허용 · 상태 경보는 고정 제목 + 닫기 */
    const DATED_OK = new Set(['main-guard.yml', 'admin-apply.yml', 'device-deploy.yml', 'push-health.yml', 'admin-lock-check.yml', 'check-live.yml']);
    eq('⑧ 🔴 제목에 날짜를 붙인 🚨 경보는 정해진 곳만(사람이 누른 일 · 라벨로 닫는 곳) — 새로 만들면 고정 제목 + 회복 때 닫기',
      alarms.filter((o) => /\$\(TZ=|date '/.test(o.title) && !DATED_OK.has(o.f)).map((o) => o.f), []);
    /* 고정 제목인데 닫는 단계가 없는 것 — 사람이 닫는 한 번의 일만 허용(각 이유는 그 워크플로 주석) */
    const MANUAL_OK = new Set(['🚨 인스타 게시가 실패했습니다', '🚨 인스타 건너뛰기 기록에 실패했습니다', '🚨 인스타 수정본 알림을 못 깨웠습니다']);
    eq('  🔴 고정 제목 🚨 경보는 같은 제목으로 닫는 단계가 있다(또는 라벨로 닫는 로봇) — 사람이 닫는 한 번의 일 셋만 예외',
      alarms.filter((o) => !/\$/.test(o.title) && !closes.has(o.title) && !labelClosers.has(o.f) && !MANUAL_OK.has(o.title)).map((o) => `${o.f}: ${o.title}`), []);
    eq('  (대조할 것을 실제로 뽑았다 — 🚨 경보 10개 이상 · 닫는 제목 10개 이상)', [alarms.length >= 10, closes.size >= 10], [true, true]);
    const ds = read(root, '.github/workflows/deploy-sync.yml').replace(/^\s*#.*$/gm, '');
    eq('  배포 동기화 — 실패는 경보 하나(옛 날짜 제목도 prefix 로) · 다시 되면 닫는다',
      [/alert-issue\.mjs --mode open --title "🚨 앱 배포 동기화 실패" --match prefix/.test(ds), /mode: resolve\s+title: 🚨 앱 배포 동기화 실패\s+match: prefix/.test(ds)], [true, true]);
  }

  /* ── ⑨ 앱 오류 급증 감시 (2026-11-13 · 은서 · 출시 전 백엔드 11번 — tools/error-watch.mjs · error-watch.yml · 0006_client_error_stats.sql) ──
     오류는 모이기만 하고 아무도 숫자를 안 봤다 → 개수만 주는 함수 + 2시간마다 판정 + 세 사람 경보 */
  {
    const EW = await import(new URL('tools/error-watch.mjs', root));
    const V = (st) => EW.verdictOf({ state: 'ok', stats: { last_hour: 0, last_day: 0, prev_week_daily_avg: 0, day_cap: 3000, ...st } }).verdict;
    eq('⑨ 급증 판정 — 1시간 59 아님·60 급증 · 하루 299 아님 · 하루 300(평균 0→바닥 20의 3배=60 넘음) 급증 · 하루 400 이라도 평균 200 이면 평소 · 상한 90%(2700) 급증',
      [V({ last_hour: 59 }), V({ last_hour: 60 }), V({ last_day: 299 }), V({ last_day: 300 }), V({ last_day: 400, prev_week_daily_avg: 200 }), V({ last_day: 2700, prev_week_daily_avg: 2000 })],
      ['ok', 'spike', 'ok', 'spike', 'ok', 'spike']);
    eq('  함수 없음(404) → setup · 꺼짐 → off · 답 없음 → unknown(실패로 끝낸다)',
      [EW.verdictOf({ state: 'missing' }).verdict, EW.verdictOf({ state: 'off' }).verdict, EW.verdictOf({ state: 'down', why: 'x' }).verdict], ['setup', 'off', 'unknown']);
    const fake = (codes) => { let i = 0; return async () => { const c = codes[Math.min(i++, codes.length - 1)]; return { status: c, json: async () => ({ last_hour: 1, last_day: 2 }) }; }; };
    const fs3 = async (codes) => (await EW.fetchStats({ url: 'https://x', anonKey: 'k' }, { fetchImpl: fake(codes), sleep: async () => {} })).state;
    eq('  서버 응답 — 200 읽음 · 404 함수 없음 · 500 이 세 번이면 down · 500 뒤 200 이면 읽음(다시 묻는다)',
      [await fs3([200]), await fs3([404]), await fs3([500, 500, 500]), await fs3([500, 200])], ['ok', 'missing', 'down', 'ok']);
    const body = EW.bodyOf({ verdict: 'spike', why: 'w' }, { last_hour: 61, last_day: 70, prev_week_daily_avg: 3, kinds_day: 4 });
    eq('  경보 본문은 개수와 되돌리기 안내만(오류 문구 칸이 없다)', [/61/.test(body), /되돌리기/.test(body), /message|문구:/.test(body)], [true, true, false]);
    const sql = read(root, 'supabase/migrations/0006_client_error_stats.sql').replace(/--.*$/gm, '');
    eq('  🔴 개수 함수 — SECURITY DEFINER + search_path 고정 · 실행 권한 public 회수·anon 부여 · count 만 꺼낸다(오류 칸을 그대로 돌려주지 않는다)',
      [/security definer/i.test(sql) && /set search_path = public, pg_temp/.test(sql), /revoke all on function public\.client_error_stats\(\) from public/.test(sql), /grant execute on function public\.client_error_stats\(\) to anon/.test(sql),
        [...sql.matchAll(/select\s+([^\n]+?)\s+from public\.client_errors/g)].every((m) => /^(count\(\*\)|count\(distinct message\)|round\(count\(\*\)::numeric \/ 7, 1\))$/.test(m[1].trim()))],
      [true, true, true, true]);
    const ew = read(root, '.github/workflows/error-watch.yml').replace(/^\s*#.*$/gm, '');
    eq('  error-watch.yml — 홀수 분 · 기본 브랜치에서만 · 시한 · 급증 경보 여닫는 제목 같음 · 못 읽음 경보 여닫는 제목 같음 · 세 사람 · 넘어지면 robot-down',
      [Number((ew.match(/cron: '(\d+) /) || [])[1]) % 2 === 1, /if: github\.ref_name == 'claude\/nice-heisenberg-WESq5'/.test(ew), /^ {4}timeout-minutes: \d+/m.test(ew),
        (ew.match(/🚨 앱 오류가 갑자기 늘었습니다/g) || []).length, (ew.match(/🚨 앱 오류 감시가 숫자를 못 읽습니다/g) || []).length,
        /--assignee seonju5543-web --assignee Se-Hyeon-Jo --assignee didinin-wq/.test(ew), /failure\(\) \|\| cancelled\(\)\s+uses: \.\/\.github\/actions\/robot-down/.test(ew)],
      [true, true, true, 2, 2, true, true]);
  }

  /* ── ⑩ 사고 대응 한 장 (2026-11-13 · 은서 · 출시 전 백엔드 12번 — docs/backend/사고-대응.md) ──
     급할 때 펴는 문서가 없는 파일·없는 버튼·바뀐 경보 제목을 가리키면 그날 헛걸음한다 → 가리키는 것이 실제로 있는지 잰다 */
  {
    const doc = read(root, 'docs/backend/사고-대응.md');
    const wfDir = path.join(rootPath, '.github/workflows');
    const wfText = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml')).map((f) => fs.readFileSync(path.join(wfDir, f), 'utf8')).join('\n');
    const wfNames = [...wfText.matchAll(/^name: (.+)$/gm)].map((m) => m[1]);
    const paths = [...doc.matchAll(/`([\w./가-힣-]+\.(?:md|mjs|js|json|yml))`/g)].map((m) => m[1]);
    const MUST_NOT = ['_config.yml'];   // '생겼으면 지운다'로 적은 파일 — 있으면 관리자 화면이 공개된다(CLAUDE.md) · 그래서 없어야 맞다
    eq(`⑩ 문서가 가리키는 파일(${paths.length}개)이 실제로 있다 · '생기면 지운다'는 파일은 없다`,
      [paths.filter((p) => !MUST_NOT.includes(p) && !fs.existsSync(path.join(rootPath, p))), MUST_NOT.filter((p) => fs.existsSync(path.join(rootPath, p)))], [[], []]);
    const titles = [...doc.matchAll(/「((?:🚨|🔑|🛡)[^」]+)」/g)].map((m) => m[1].replace(/…$/, ''));
    eq(`  가리키는 경보 제목(${titles.length}개)이 워크플로에 있다(제목을 바꾸면 이 문서도)`, titles.filter((t) => !wfText.includes(t)), []);
    const buttons = [...doc.matchAll(/Actions › 「([^」]+)」/g)].map((m) => m[1]);
    eq(`  가리키는 Actions 버튼(${buttons.length}개)이 워크플로 이름에 있다`, buttons.filter((b) => !wfNames.some((n) => n.startsWith(b))), []);
    eq('  (대조할 것을 실제로 뽑았다 — 파일 4·경보 8·버튼 3 이상)', [paths.length >= 4, titles.length >= 8, buttons.length >= 3], [true, true, true]);
  }
}
