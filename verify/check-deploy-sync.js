#!/usr/bin/env node
/* 배포 반영 확인 — "지금 작업한 내용이 실제로 앱에 보이는 상태인가?"
 *
 * 배경(2026-07-31): 앱(GitHub Pages)은 **main 브랜치만** 배포하는데, 수집 로봇과 세션 작업은
 * 기본 브랜치에 커밋한다. 그래서 main에 옮기는 걸 빠뜨리면 아무리 데이터를 모아도 앱에는
 * 어제 것이 그대로 보인다(실제로 7/30~7/31 수집분이 이 상태였다). 이 검사가 그걸 잡는다.
 *
 * 실행: node verify/check-deploy-sync.js        (인터넷 필요 — git fetch)
 * 종료 코드: 0 = 앱에 다 반영됨 / 1 = 아직 배포 안 된 변경 있음
 */
const { execSync } = require('node:child_process');

const sh = (cmd, allowFail = false) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch (e) { if (allowFail) return ''; throw e; }
};

/* 앱이 실제로 읽어가는 파일들 — 이것만 main에 있으면 사용자 화면이 최신이다 */
const APP_PATHS = ['index.html', 'app.js', 'style.css', 'forms.js', 'data.js', 'sw.js', 'manifest.json', 'data', 'icons'];

sh('git fetch origin main', true);
const hasMain = sh('git rev-parse --verify --quiet origin/main', true);
if (!hasMain) {
  console.log('⚠️  origin/main을 못 읽었어요 (네트워크 차단?) — 배포 반영 확인을 건너뜁니다.');
  process.exit(0);
}

const head = sh('git rev-parse --short HEAD');
const diff = sh(`git diff --stat origin/main..HEAD -- ${APP_PATHS.join(' ')}`, true);
const behind = sh('git rev-list --count HEAD..origin/main', true) || '0';

console.log(`현재 브랜치: ${sh('git rev-parse --abbrev-ref HEAD')} (${head})`);
console.log(`배포 브랜치: main (${sh('git rev-parse --short origin/main')})`);

if (!diff) {
  console.log('\n✅ 앱 파일 기준으로 main과 같음 — 지금 내용이 사용자 앱에 반영되는 상태입니다.');
  if (behind !== '0') console.log(`   (참고: main에만 있는 커밋 ${behind}개 — 앱 파일 외 변경이라 화면에는 영향 없음)`);
  process.exit(0);
}

console.log('\n❌ 아직 앱에 배포되지 않은 변경이 있습니다 (사용자는 이 내용을 볼 수 없어요):\n');
console.log(diff);

/* 사람이 바로 이해할 수 있게 데이터 건수 차이도 보여준다 */
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
for (const f of ['data/notices.json', 'data/registered.json', 'data/forms.json']) {
  const now = count(null, f), live = count('origin/main', f);
  if (now !== null && live !== null && now !== live) {
    console.log(`  · ${f}: 앱(main) ${live}건 → 작업본 ${now}건 (${now - live > 0 ? '+' : ''}${now - live})`);
  }
}

console.log(`
해결: 아래로 main에 올리면 GitHub Pages가 자동 배포하고, 설치된 앱도 재설치 없이 반영됩니다.
  git push origin HEAD:main
(로봇 수집분은 '배포 동기화' 워크플로가 자동으로 올리므로 보통 이 검사는 통과합니다.)`);
process.exit(1);
