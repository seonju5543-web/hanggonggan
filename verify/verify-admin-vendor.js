#!/usr/bin/env node
/* 관리자 화면 — 빠진 이웃 관문 (2026-09-13 실사고에서 나왔다)
 *
 * 무엇을 막는가:
 *   `_admin/admin.js` 는 ES 모듈이다. **import 하나가 404 나면 파일 전체가 실행되지 않는다.**
 *   화면은 HTML 이라 멀쩡히 그려지는데 버튼에 동작이 안 붙는다 → 개발자 눈에는
 *   "들어가기를 눌러도 아무 일이 없다"로 보이고, **오류 문구조차 안 뜬다**
 *   (그 문구도 admin.js 가 띄우는 것이기 때문이다). 브라우저 콘솔을 열기 전에는 안 보인다.
 *
 * 실제로 겪은 것: `collector/url-key.mjs` 가 `./deadline-hint.mjs` 를 부르기 시작했는데
 *   (커밋 c34c5ed) `_admin/build.sh` 가 그 파일을 vendor 로 안 옮겨 관리자 화면이 통째로 죽었다.
 *
 * 어떻게 보는가:
 *   빌드 결과 폴더를 받아 **실제로 놓인 파일들**의 모듈 그래프를 훑는다.
 *   추측하지 않는다 — 브라우저가 하는 것과 같은 방식으로 경로를 푼다(그 파일 위치 기준 상대 경로).
 *
 * 🔴 규칙은 이 파일 하나다. build.sh 와 CI 가 **같은 것을 부른다**(베끼면 갈라진다).
 *   · build.sh 끝에서 부른다 → 빌드가 실패하면 Cloudflare 는 **옛 판을 그대로 둔다**(깨진 화면보다 낫다)
 *   · verify-ui.yml 에서 부른다 → push 하는 그 순간 잡는다
 *
 * ⚠️ 이 검사를 `test-collector.mjs` 에 두면 안 된다(한 번 그렇게 만들었다가 리뷰가 잡았다).
 *   그 파일은 수집 로봇의 **데이터 관문**이라, 빨간불이면 워크플로가 `revert-auto.mjs` 로
 *   그날 자동 등록분을 되돌린다. build.sh 의 cp 한 줄을 잊은 것이 장학금 등록을 지우면 안 된다.
 *
 * 쓰는 법: node verify/verify-admin-vendor.js [빌드폴더]   (기본값 _admin/dist)
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const out = path.resolve(process.argv[2] || path.join(__dirname, '..', '_admin', 'dist'));

/* 상대 경로 import 를 전부 뽑는다 — 셋 다 404 나면 똑같이 모듈이 죽는다.
 *   ① import { x } from './a.mjs'     ② import './a.mjs' (부작용만)     ③ import('./a.mjs') (동적)
 * 🔴 ①만 보면 안 된다 — 리뷰가 실증했다: `import './vendor/side-effect.mjs';` 는 ①만 보는
 *    검사를 그냥 통과하면서 정확히 같은 증상(버튼이 안 눌린다)을 만든다. */
const PATTERNS = [
  /\bfrom\s*['"](\.[^'"]*)['"]/g,          // from './x'
  /\bimport\s*['"](\.[^'"]*)['"]/g,        // import './x'
  /\bimport\s*\(\s*['"](\.[^'"]*)['"]/g,   // import('./x')
];

function depsOf(text) {
  const found = new Set();
  for (const re of PATTERNS) for (const m of text.matchAll(re)) found.add(m[1]);
  return [...found];
}

/* 검사 대상: 빌드 폴더에 놓인 스크립트 전부. 목록을 손으로 적지 않는다 —
   손으로 적은 목록은 새 파일이 생길 때마다 어긋난다(이 저장소가 verify-ui.yml 에서 겪은 유형). */
function scripts(dir) {
  const hits = [];
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(m?js|cjs)$/.test(e.name)) hits.push(full);
    }
  };
  walk(dir);
  return hits;
}

if (!fs.existsSync(out)) {
  console.error(`✕ 빌드 폴더가 없습니다: ${out}\n   먼저 \`bash _admin/build.sh\` 를 돌리세요.`);
  process.exit(1);
}

const files = scripts(out);
if (!files.length) {
  console.error(`✕ ${out} 에 스크립트가 하나도 없습니다 — 빌드가 제대로 안 된 것입니다.`);
  process.exit(1);
}

const missing = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const dep of depsOf(text)) {
    /* 브라우저와 같게 푼다: 부르는 파일이 있는 자리 기준 상대 경로.
       🔴 파일 이름만 대조하면 안 된다 — '../x.mjs' 나 './lib/x.mjs' 가 통과해 버린다. */
    const target = path.resolve(path.dirname(file), dep);
    if (!fs.existsSync(target)) {
      missing.push({ from: path.relative(out, file), dep, target: path.relative(out, target) });
    }
  }
}

const shown = files.map((f) => path.relative(out, f)).sort();
console.log(`■ 관리자 화면 빠진 이웃 검사 — ${out}`);
console.log(`  훑은 스크립트 ${files.length}개: ${shown.join(' · ')}`);

if (missing.length) {
  console.error('');
  for (const m of missing) console.error(`  ✕ ${m.from} 가 부르는 ${m.dep} 이 없습니다 (찾은 자리: ${m.target})`);
  console.error(`\n✕ 빠진 이웃 ${missing.length}건 — 이대로 내보내면 관리자 화면이 통째로 죽습니다.`);
  console.error('   증상은 "들어가기를 눌러도 아무 일이 없다"이고 오류 문구도 안 뜹니다.');
  console.error("   고치는 법: _admin/build.sh 의 '공용 원본' 절에 그 파일을 옮기는 cp 를 한 줄 더하세요.");
  process.exit(1);
}

console.log('✓ 빠진 이웃 없음 — 모든 import 가 짝을 찾았습니다');

/* ── ② vendor 로 옮기는 collector 원본이 CI 감시 범위 안에 있는가 ──────────────
 * 위 검사가 있어도, 그 커밋에서 **검사가 돌지 않으면** 아무 소용이 없다.
 * 2026-09-13 사고가 정확히 그랬다: 이웃을 부르기 시작한 것은 `collector/url-key.mjs` 인데
 * verify-ui.yml 은 collector 를 안 보고 있어서 push 때 어떤 관문도 울리지 않았다.
 * 🔴 `collector/**` 로 넓히면 안 된다 — 로봇이 하루 열 번 커밋해서 25분짜리 브라우저 검사가
 *    그때마다 돈다(test-collector 'CI 감시 범위' 절이 그것을 막는다). 그래서 목록은 좁게 두되,
 *    **build.sh 에서 읽어 대조**한다. 새 파일을 vendor 에 넣고 여기 안 적으면 이 관문이 말해 준다.
 * ⚠️ 저장소 밖(다른 폴더)에서 돌릴 때는 건너뛴다 — 없는 파일을 두고 실패시키지 않는다. */
const repo = path.join(__dirname, '..');
const shPath = path.join(repo, '_admin', 'build.sh');
const wfPath = path.join(repo, '.github', 'workflows', 'verify-ui.yml');

if (fs.existsSync(shPath) && fs.existsSync(wfPath)) {
  const sh = fs.readFileSync(shPath, 'utf8');
  const wf = fs.readFileSync(wfPath, 'utf8');

  /* build.sh 가 vendor 로 옮기는 원본 중 collector/ 아래 것만 (뿌리 파일은 '*.js' 가 이미 잡는다) */
  const fromCollector = [...sh.matchAll(/^\s*cp\s+(collector\/\S+)\s+"\$OUT\/vendor\//gm)].map((m) => m[1]);

  /* verify-ui.yml 의 push paths 목록 (따옴표 안의 글로브만 본다) */
  const globs = [...wf.matchAll(/^\s*-\s*'([^']+)'\s*$/gm)].map((m) => m[1]);
  const toRe = (g) => new RegExp('^' + g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*') + '$');
  const res = globs.map(toRe);
  const unwatched = fromCollector.filter((f) => !res.some((r) => r.test(f)));

  console.log(`\n■ CI 감시 범위 — vendor 로 옮기는 collector 원본 ${fromCollector.length}개`);
  if (unwatched.length) {
    for (const f of unwatched) console.error(`  ✕ ${f} 가 verify-ui.yml 의 감시 범위 밖입니다`);
    console.error('\n✕ 이 파일이 바뀌어도 push 때 관문이 돌지 않습니다 — 2026-09-13 사고와 같은 상태입니다.');
    console.error("   고치는 법: .github/workflows/verify-ui.yml 의 paths 에 그 경로를 한 줄 더하세요.");
    console.error("   ⚠️ 'collector/**' 로 넓히지 말 것 — 로봇 커밋마다 브라우저 검사가 돕니다.");
    process.exit(1);
  }
  console.log(`  ✓ 전부 감시 범위 안: ${fromCollector.join(' · ')}`);
}
