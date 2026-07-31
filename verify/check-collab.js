#!/usr/bin/env node
/* 협업 겹침 조기 경보 (2026-07-31 신설 — COLLAB.md 참조)

   ─ 무엇을 알려주나 ─────────────────────────────────────────────────
   "지금 내가 하려는 작업이 상대 작업과 부딪히나?"를 **작업을 시작하기 전에** 알려준다.
   지금까지는 다 만들고 push할 때가 되어서야 충돌을 알았고, 그때는 이미 양쪽이
   같은 파일을 각자 고쳐 놓은 뒤라 한쪽 작업을 손으로 되살려야 했다.
   (7/31 저녁 browser-collect.yml 사건이 정확히 이 경우 — 두 사람이 같은 파일을
    25분 간격으로 서로 모르고 고쳤고, 다음 세션이 '판 통합'에 시간을 썼다.)

   ─ 언제 실행되나 ───────────────────────────────────────────────────
   · Claude 세션이 시작될 때 자동 (.claude/hooks/session-start.sh)
   · 작업을 끝내고 push하기 전에 한 번 더:  node verify/check-collab.js

   ─ 사용법 ──────────────────────────────────────────────────────────
     node verify/check-collab.js            자세히 보기
     node verify/check-collab.js --brief    문제가 있을 때만 짧게 (세션 시작 훅용)
     node verify/check-collab.js --no-fetch 인터넷 없이 (이미 받아 둔 정보로만)
*/

const { execSync } = require('node:child_process');

const BASE = 'claude/nice-heisenberg-WESq5'; // 기본 브랜치 — 로봇이 커밋하고 예약 실행이 도는 곳
const DEPLOY = 'main';                        // 앱이 배포되는 브랜치
const RECENT_HOURS = 48;                      // '최근에 누가 만졌나'를 볼 기간

const brief = process.argv.includes('--brief');
const noFetch = process.argv.includes('--no-fetch');

const sh = (cmd, fallback = '') => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

const out = [];
const warnings = [];
const say = (s = '') => out.push(s);

/* ── 0. 최신 정보 받아오기 ─────────────────────────────────────────── */
if (!noFetch) sh('git fetch origin --prune --quiet');

const me = sh('git rev-parse --abbrev-ref HEAD', '(알 수 없음)');
const myEmail = sh('git config user.email');
const hasBase = !!sh(`git rev-parse --verify --quiet origin/${BASE}`);
const hasDeploy = !!sh(`git rev-parse --verify --quiet origin/${DEPLOY}`);

if (!hasBase || !hasDeploy) {
  console.log('ℹ️  기준 브랜치를 찾지 못해 겹침 검사를 건너뜁니다 (인터넷이 막혀 있거나 브랜치 이름이 바뀐 경우).');
  process.exit(0);
}

say(`📍 지금 브랜치: ${me}`);

/* ── 1. 내 브랜치가 뒤쳐져 있나 ────────────────────────────────────── */
const [behind, ahead] = lines(
  sh(`git rev-list --left-right --count 'origin/${BASE}...HEAD'`).replace(/\s+/g, '\n'),
).map(Number);

if (behind > 0) {
  warnings.push(
    `내 브랜치가 기본 브랜치보다 ${behind}커밋 뒤쳐져 있어요. 지금 합쳐 두면 충돌이 작습니다:\n` +
    `      git merge origin/${BASE}`,
  );
}
say(`   기본 브랜치 대비: 뒤 ${behind} · 앞 ${ahead}`);

/* ── 2. main에만 있는 커밋 = 누군가 앱 배포 브랜치를 직접 고쳤다 ──────── */
const mainOnly = lines(sh(`git log --format='%h|%an|%ad|%s' --date='format:%m-%d %H:%M' origin/${BASE}..origin/${DEPLOY}`))
  .filter((l) => !/배포 동기화|Merge (remote-tracking )?branch|진척도 자동 갱신/.test(l));

if (mainOnly.length) {
  warnings.push(
    `앱 배포 브랜치(${DEPLOY})에만 있는 작업이 ${mainOnly.length}건 있어요 — 기본 브랜치에는 없습니다.\n` +
    mainOnly.slice(0, 5).map((l) => {
      const [h, an, ad, ...s] = l.split('|');
      return `      · ${ad} ${an}: ${s.join('|')} (${h})`;
    }).join('\n') +
    `\n      → 이대로 두면 배포 동기화 로봇이 매번 이 지점에서 충돌합니다. 기본 브랜치로 되가져오세요:\n` +
    `      git checkout ${BASE} && git merge origin/${DEPLOY} && git push origin ${BASE}`,
  );
}

/* ── 3. 아직 내가 못 받은, 남의 최근 작업이 만진 파일 ─────────────────
   ⚠️ 사람으로 구분할 수 없다: 두 개발자 모두 Claude 세션으로 작업하므로 커밋 작성자가
      똑같이 'Claude <noreply@anthropic.com>'로 찍힌다. 이름·메일로는 누가 한 건지 모른다.
      그래서 **브랜치**를 기준으로 본다 — "내 이력에 아직 없는 최근 커밋"은 정의상
      상대(또는 다른 세션)의 아직 못 받은 작업이고, 그게 곧 부딪힐 지점이다. */
const since = `${RECENT_HOURS} hours ago`;
const branches = lines(sh(`git for-each-ref --format='%(refname:short)' refs/remotes/origin`))
  .filter((b) => b !== 'origin/HEAD' && b !== `origin/${me}`);

const touchedByOthers = new Map(); // 파일 → "어느 브랜치 · 언제"
for (const b of branches) {
  // --not HEAD = 내가 아직 안 받은 커밋만
  const log = sh(`git log '${b}' --not HEAD --since='${since}' --format='@@@%an|%ae|%ad' --date='format:%m-%d %H:%M' --name-only`);
  let who = null;
  for (const raw of log.split('\n')) {
    if (raw.startsWith('@@@')) {
      const [an, ae, ad] = raw.slice(3).split('|');
      // 로봇 커밋은 제외 — 로봇이 쓰는 파일은 병합기가 자동으로 합쳐 준다
      who = /bot|github-actions/i.test(`${an} ${ae}`) ? null : { ad };
      continue;
    }
    const f = raw.trim();
    if (!who || !f) continue;
    if (!touchedByOthers.has(f)) touchedByOthers.set(f, `${b.replace(/^origin\//, '')} · ${who.ad}`);
  }
}
void myEmail;

/* ── 4. 내가 이번에 건드린 파일 ────────────────────────────────────── */
const myChanged = new Set([
  ...lines(sh('git diff --name-only HEAD')),                    // 아직 커밋 안 한 수정
  ...lines(sh('git ls-files --others --exclude-standard')),     // 새로 만든 파일
  ...lines(sh(`git diff --name-only 'origin/${BASE}...HEAD'`)), // 이 브랜치에서 이미 커밋한 것
].map((s) => s.replace(/^"|"$/g, '')));

const clash = [...myChanged].filter((f) => touchedByOthers.has(f));

if (clash.length) {
  warnings.push(
    `내가 아직 못 받은 남의 최근 작업과 같은 파일을 고치고 있어요 (${clash.length}개):\n` +
    clash.map((f) => `      · ${f}  ← ${touchedByOthers.get(f)}`).join('\n') +
    `\n      → 지금 origin/${BASE}를 합쳐서 상대 작업 위에 얹으세요. 나중에 합치면 한쪽을 손으로 되살려야 합니다.`,
  );
} else if (touchedByOthers.size) {
  say(`   내가 아직 못 받은 남의 작업 파일 ${touchedByOthers.size}개 — 나와 겹치는 것 없음 ✅`);
}

/* ── 출력 ─────────────────────────────────────────────────────────── */
if (brief) {
  if (!warnings.length) process.exit(0);
  console.log('\n🚨 협업 주의 — 지금 확인하면 충돌을 피할 수 있어요');
  warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  console.log('  (자세히: node verify/check-collab.js · 규칙: COLLAB.md)\n');
  process.exit(0);
}

console.log('\n🤝 협업 겹침 점검');
console.log(out.join('\n'));
if (warnings.length) {
  console.log('\n🚨 확인이 필요한 항목');
  warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
} else {
  console.log('\n✅ 지금 부딪힐 만한 곳이 없습니다.');
}
console.log('\n규칙 문서: COLLAB.md\n');
