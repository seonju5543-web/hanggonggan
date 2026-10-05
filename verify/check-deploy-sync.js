#!/usr/bin/env node
/* 배포 반영 확인 — "지금 작업한 내용이 실제로 앱에 보이는 상태인가?"
 *
 * 배경(2026-07-31): 앱(GitHub Pages)은 **main 브랜치만** 배포하는데, 수집 로봇과 세션 작업은
 * 기본 브랜치에 커밋한다. 그래서 main에 옮기는 걸 빠뜨리면 아무리 데이터를 모아도 앱에는
 * 어제 것이 그대로 보인다(실제로 7/30~7/31 수집분이 이 상태였다). 이 검사가 그걸 잡는다.
 *
 * 실행: node verify/check-deploy-sync.js        (인터넷 필요 — git fetch)
 * 종료 코드: 0 = 내 쪽에만 있고 main 에 없는 앱 변경이 없음 / 1 = 있음(아직 배포 안 됨)
 *
 * 🔴 비교는 **갈라진 뒤 내 쪽에만 생긴 앱 변경**(세 점 `origin/main...HEAD`)으로 한다 (2026-10-05 로봇·도구 점검 · ops-09).
 *    두 점(`origin/main..HEAD`)은 두 판의 차이 전부라 **main 만 앞선 것**(배포 동기화 로봇이 하루 수십 번 main 을 움직인다)도
 *    ❌ 로 냈고 `git push origin HEAD:main` 을 권했다(하면 거절된다) → 세션 점검이 거의 늘 거짓 ❌ → 사람이 경고를 무시하게 된다.
 *    main 만 앞선 것은 (참고)로만 말한다. 앱이 받는 그림 묶음(assets/ — 정문·학교 사진 목록)도 앱 파일이다.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const BASE = 'claude/nice-heisenberg-WESq5';   // 기본 브랜치 — 로봇이 커밋하고 예약 실행이 도는 곳 (check-collab.js 와 같은 값)

const sh = (cmd, allowFail = false) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { if (allowFail) return ''; throw e; }
};

/* ── 수집 로봇의 '저장 위치' 점검 (2026-07-31 추가) ───────────────────────────────
   로봇은 자기가 읽은 브랜치에만 저장해야 한다. 읽는 곳과 쓰는 곳이 갈리면
   '이미 본 공고' 기록(seen.json)이 안 늘어 매일 같은 공고를 새 공고로 다시 담는다.
   실제로 그런 판이 만들어진 적이 있어(7/31), 되살아나면 여기서 바로 잡는다. */
const COLLECTORS = [
  '.github/workflows/collect-scholarships.yml',
  '.github/workflows/browser-collect.yml',
  '.github/workflows/deep-fetch.yml',
  '.github/workflows/collect-news.yml',   // 교내 소식 (2026-09-30)
];
let wfBad = 0;
for (const f of COLLECTORS) {
  let y; try { y = fs.readFileSync(f, 'utf8'); } catch { continue; }
  if (/checkout\s+(-f\s+)?-B\s+main|push\s+origin\s+(HEAD:)?main/.test(y)) {
    console.log(`❌ ${f}: 로봇이 main에 직접 저장하도록 돼 있어요.`);
    console.log('   → 읽는 곳(기본 브랜치)과 쓰는 곳이 달라져 "이미 본 공고" 기록이 안 늘고,');
    console.log('     매일 같은 공고가 새 공고로 다시 담깁니다. 저장은 기본 브랜치에 하고,');
    console.log('     앱 배포는 deploy-sync.yml에 맡기세요.');
    wfBad++;
  }
  if (!/pushed=1|pushed" != "1/.test(y)) {
    console.log(`⚠️  ${f}: push 3회 실패해도 조용히 넘어갑니다 (실패를 알리는 장치 없음).`);
    wfBad++;
  }
}
if (wfBad === 0) console.log(`✅ 수집 로봇 ${COLLECTORS.length}종: 저장 위치·실패 알림 정상`);

/* ── 배포 동기화가 '데이터를 고치는 로봇'을 전부 알고 있나 (2026-08-01 추가) ─────────
   로봇이 기본 브랜치에 커밋해도, deploy-sync의 workflow_run 목록에 그 로봇 이름이 없으면
   앱까지 밀어 올려지지 않는다 — '하루 2회 보정'에 걸릴 때까지 최대 12시간 안 나간다.
   (로봇의 push는 GitHub 규칙상 push 트리거를 못 깨우기 때문.)
   새 로봇을 만들고 이 목록에 추가하는 걸 잊는 실수를 여기서 잡는다. */
let syncBad = 0;
try {
  const sync = fs.readFileSync('.github/workflows/deploy-sync.yml', 'utf8');
  const watched = (sync.match(/workflows:\s*\[([\s\S]*?)\]/) || [])[1] || '';
  for (const f of fs.readdirSync('.github/workflows')) {
    if (!/\.ya?ml$/.test(f) || /deploy-sync|main-guard|update-progress|check-live|fetch-page/.test(f)) continue;
    const y = fs.readFileSync(`.github/workflows/${f}`, 'utf8');
    /* 앱이 받는 데이터를 커밋하는 워크플로만 대상.
       🔴 **파일 이름을 하나씩 적지 않는다** (2026-09-26). 예전에는 `notices|registered` 둘만
          봤는데, 학과 목록이 앱 데이터가 되자 이 검사가 **초록불인 채로 놓쳤다**(코드 리뷰에서
          잡았다). `git add data/…` 이면 전부 본다 — 앱이 안 읽는 것(seen·후보 장부 등)은
          `data/` 밖에 있으므로 이 폭이 맞다. */
    if (!/git add[^\n]*\bdata\/[a-z-]+/.test(y)) continue;
    const name = (y.match(/^name:\s*(.+)$/m) || [])[1]?.trim();
    if (name && !watched.includes(name)) {
      console.log(`❌ deploy-sync가 '${name}'(${f})를 모릅니다 — 이 로봇이 고친 데이터는 최대 12시간 앱에 안 나갑니다.`);
      console.log("   → .github/workflows/deploy-sync.yml 의 workflow_run.workflows 목록에 이름을 추가하세요.");
      syncBad++;
    }
  }
} catch { /* 파일이 없으면 검사 생략 */ }
if (!syncBad) console.log('✅ 배포 동기화가 데이터 로봇 전부를 감시 중\n');

/* 앱이 실제로 읽어가는 파일들 — 이것만 main에 있으면 사용자 화면이 최신이다.
   🔴 스크립트 목록은 index.html 에서 **읽는다**(2026-09-29 리뷰) — 손으로 적은 목록에 match-engine.js·boot.js·
   notify-rules.js 등이 빠져 있어, SERVED_SCHOOLS 를 44곳으로 바꾼 커밋이 main 에 없는데도 「앱 파일 기준으로
   main과 같음」이라고 초록불을 냈다. check-brief.mjs 와 같은 셈법(index.html 의 src + sw.js). */
const APP_PATHS = (() => {
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  /* assets — 앱이 받는 정문 사진·학교 대표 사진 목록(app.js 의 assets/gates/gates.json · assets/schools/photos.json)과 그 그림 (ops-09) */
  const fixed = ['index.html', 'style.css', 'sw.js', 'manifest.json', 'terms.html', 'data', 'icons', 'assets'];
  try {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/src="([a-z0-9.-]+\.js)"/g)].map((m) => m[1]);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    const swScripts = [...sw.matchAll(/['"]\.?\/?([a-z0-9-]+\.js)['"]/g)].map((m) => m[1]);
    return [...new Set([...fixed, ...scripts, ...swScripts])];
  } catch { return [...fixed, 'app.js', 'forms.js', 'data.js']; }
})();

sh('git fetch origin main', true);
const hasMain = sh('git rev-parse --verify --quiet origin/main', true);
if (!hasMain) {
  console.log('⚠️  origin/main을 못 읽었어요 (네트워크 차단?) — 배포 반영 확인을 건너뜁니다.');
  process.exit(0);
}

const head = sh('git rev-parse --short HEAD');
/* 갈라진 자리(공통 조상)를 먼저 찾는다 — 얕은 클론이면 없다. 그때는 '같음'이라고 말하지 않는다(못 잰 것은 통과가 아니다). */
const mergeBase = sh('git merge-base origin/main HEAD', true);
if (!mergeBase) {
  console.log(`현재 브랜치: ${sh('git rev-parse --abbrev-ref HEAD', true)} (${head})`);
  console.log('⚠️  main 과 공통 조상을 못 찾아 비교하지 못했습니다 (얕은 클론일 수 있어요) — git fetch --unshallow 뒤 다시 돌리세요.');
  process.exit(0);
}
/* 세 점(...) = 공통 조상 → 내 작업본: **내 쪽에서 바뀐** 앱 파일만. 그중 지금 main 과 글자가 같은 것(같은 내용이 다른 커밋으로 이미 main 에 감)은 뺀다. */
const changed = sh(`git diff --name-only origin/main...HEAD -- ${APP_PATHS.join(' ')}`, true).split('\n').filter(Boolean);
const sameAsMain = (f) => { try { execSync(`git diff --quiet origin/main HEAD -- "${f}"`, { stdio: 'ignore' }); return true; } catch { return false; } };
const mineOnly = changed.filter((f) => !sameAsMain(f));
const diff = mineOnly.length ? (sh(`git diff --stat origin/main...HEAD -- ${mineOnly.map((f) => `"${f}"`).join(' ')}`, true) || mineOnly.join('\n')) : '';
const ahead = sh('git rev-list --count origin/main..HEAD', true) || '0';
const behind = sh('git rev-list --count HEAD..origin/main', true) || '0';

console.log(`현재 브랜치: ${sh('git rev-parse --abbrev-ref HEAD')} (${head}) · main 보다 앞선 커밋 ${ahead}개 · 뒤처진 커밋 ${behind}개`);
console.log(`배포 브랜치: main (${sh('git rev-parse --short origin/main')})`);

/* 🔴 main 에 있다 ≠ 학생 앱에 나갔다 (2026-10-04 — main push 셋이 Pages 빌드를 하나도 안 일으켜 홈 새 구역이 두 시간 넘게 안 떴는데
   이 검사는 ✅ 「반영되는 상태」라고 말했다). Pages 가 마지막으로 지은 커밋의 앱 파일이 main 과 다르면 그 사실을 말한다.
   gh 가 없거나 못 물으면 건너뛴다(로봇·다른 컴퓨터) — 그때는 그렇게 적는다. 고치는 법: gh api -X POST repos/<저장소>/pages/builds */
function pagesLag() {
  const repo = (sh('git remote get-url origin', true) || '').replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '');
  if (!repo) return { skip: '저장소 이름을 못 읽음' };
  const out = sh(`gh api repos/${repo}/pages/builds/latest -q '"\\(.status) \\(.commit)"'`, true);
  if (!out) return { skip: 'gh 로 Pages 상태를 묻지 못함' };
  const [status, commit] = out.trim().split(/\s+/);
  const lag = sh(`git diff --stat ${commit}..origin/main -- ${APP_PATHS.join(' ')}`, true);
  return { status, commit: (commit || '').slice(0, 8), lag, repo };
}

if (!diff) {
  const pg = pagesLag();
  if (pg.lag) {
    console.log(`\n⚠️ main 에는 있지만 **학생 앱(Pages)은 아직 옛 판**입니다 — Pages 가 마지막으로 지은 커밋 ${pg.commit} (${pg.status}).`);
    console.log(pg.status === 'building' ? '   지금 짓는 중이면 1~2분 뒤 다시 보세요.' : `   빌드가 안 일어났습니다. 이렇게 요청하세요:\n   gh api -X POST repos/${pg.repo}/pages/builds`);
    process.exit(1);
  }
  console.log('\n✅ 내 쪽에만 있는 앱 변경 없음 — 지금 작업분의 앱 파일은 main(앱)에 들어가 있습니다.' + (pg.skip ? ` (Pages 빌드 확인은 건너뜀 — ${pg.skip})` : ` (Pages 빌드 ${pg.commit} 확인)`));
  if (behind !== '0') console.log(`   (참고) main 에만 있는 커밋 ${behind}개 — 앱은 이미 그 내용을 보여 줍니다 · 작업본을 맞추려면 git fetch origin && git merge origin/main`);
  process.exit(0);
}

console.log('\n❌ 내 쪽에만 있고 main(앱)에 없는 앱 파일 변경이 있습니다 (학생은 이 내용을 볼 수 없어요):\n');
console.log(diff);

/* 사람이 바로 이해할 수 있게 데이터 건수 차이도 보여준다 — **갈라진 자리 → 작업본**으로 잰다(내 작업이 바꾼 건수).
   origin/main 과 견주면 그사이 로봇이 main 에 더한 공고 수가 섞여 '내가 지웠다'처럼 보인다. */
const count = (ref, file) => {
  try {
    const raw = ref === null
      ? require('node:fs').readFileSync(file, 'utf8')
      : sh(`git show ${ref}:${file}`);
    const j = JSON.parse(raw);
    const arr = Array.isArray(j) ? j : (j.items || []);
    return arr.length;
  } catch { return null; }
};
const counted = [];
for (const f of ['data/notices.json', 'data/activities.json', 'data/registered.json', 'data/forms.json']) {
  if (!mineOnly.includes(f)) continue;
  const now = count(null, f), was = count(mergeBase, f);
  if (now !== null && was !== null && now !== was) counted.push(`  · ${f}: ${was}건 → 작업본 ${now}건 (${now - was > 0 ? '+' : ''}${now - was})`);
}
if (counted.length) console.log(`\n내 작업이 바꾼 건수:\n${counted.join('\n')}`);

/* 🔴 main 하나에만 올리라고 권하지 않는다 — 기본 브랜치를 건너뛰면 로봇이 옛 판에서 돌고 다음 배포 동기화가 부딪힌다(CLAUDE.md 「브랜치 · 배포」). */
console.log(`
해결 — CLAUDE.md 「브랜치 · 배포」 대로 세 곳에 같은 내용을 올립니다 (기본 브랜치를 건너뛰고 main 에만 올리지 마세요):${behind !== '0' ? `
  ⓪ main 이 ${behind}커밋 앞서 있으니 먼저:  git fetch origin && git merge origin/main` : ''}
  ① 작업 브랜치:  git push origin HEAD
  ② 기본 브랜치:  git fetch origin && git merge origin/${BASE} 뒤  git push origin HEAD:${BASE}
  ③ 앱(main):     git fetch origin && git merge origin/main 뒤  git push origin HEAD:main   (GitHub Pages 가 자동 배포)
  휴대폰·웹 세션(작업 브랜치 하나만 쓰는 세션)은 deploy/run-deploy.txt 의 branch: 줄에 브랜치 이름을 적어 push 하세요.
(로봇 수집분은 '배포 동기화' 워크플로가 자동으로 올리므로 보통 이 검사는 통과합니다.)`);
process.exit(1);
