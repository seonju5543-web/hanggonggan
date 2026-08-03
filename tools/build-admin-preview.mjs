/* 관리자 페이지 '읽기 전용 미리보기' 만들기
   ------------------------------------------------------------------
   왜 필요한가: 관리자 화면은 Cloudflare에 올려야 볼 수 있는데, 그 설정에 30분이 든다.
   그 전에 **화면을 눌러 보고 고칠 점을 말할 수 있어야** 순서가 맞다.
   그래서 데이터를 파일 안에 넣은 **한 장짜리 사본**을 만든다. 인터넷 연결도, 열쇠도,
   서버도 필요 없이 휴대폰에서 바로 열린다.

   진짜 화면과 다른 점은 두 가지뿐이다.
     ① 데이터를 GitHub에서 받아오지 않고 파일 안에서 읽는다 (그 순간의 사진)
     ② 바꾸기 버튼이 눌리지 않는다 — 미리보기라고 화면에 명시한다
   화면 코드(admin.js·admin.css)는 **그대로** 쓴다. 따로 만들면 진짜 화면과 달라지기 때문.

   실행: node tools/build-admin-preview.mjs [출력경로] [--fragment]
     --fragment : 바깥 <html>·<head>·<body> 껍데기를 빼고 알맹이만 (공유 문서로 발행할 때) */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2).filter((a) => a !== '--fragment');
const FRAGMENT = process.argv.includes('--fragment');
const OUT = args[0] || path.join(ROOT, '_admin', 'preview.html');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => { try { return JSON.parse(read(p)); } catch { return null; } };

/* 화면이 읽는 파일들을 그대로 담는다 (admin.js의 loadAll과 같은 목록) */
const DATA = {
  'data/registered.json': readJson('data/registered.json'),
  'data/notices.json': readJson('data/notices.json'),
  'data/forms.json': readJson('data/forms.json'),
  'collector/health.json': readJson('collector/health.json'),
  'collector/schools.json': readJson('collector/schools.json'),
  'collector/browser-targets.json': readJson('collector/browser-targets.json'),
  'collector/link-hunt.json': readJson('collector/link-hunt.json'),
  'collector/pending-forms.json': readJson('collector/pending-forms.json'),
  'collector/auto-register-config.json': readJson('collector/auto-register-config.json'),
  'data/admin-log.json': readJson('data/admin-log.json'),
};

const css = read('_admin/admin.css');
const adminJs = read('_admin/admin.js');
const dataJs = read('data.js');
const formsJs = read('forms.js');
const entryRules = read('verify/entry-rules.cjs');
const urlKeyMjs = read('collector/url-key.mjs');

/* admin.js는 ES 모듈이라 url-key를 import한다. 한 장짜리 파일에서는 파일이 없으므로
   import 줄을 지우고, 같은 이름의 함수를 앞에 붙여 준다. */
const urlKeyInline = urlKeyMjs
  .replace(/^export default .*$/m, '')
  .replace(/^export /gm, '');

const adminInline = adminJs
  .replace(/^import\s+\{[^}]*\}\s+from\s+'\.\/vendor\/url-key\.mjs';\s*$/m, '')
  /* 바깥으로 나가지 않고 파일 안 데이터를 읽는다 */
  .replace(
    /async function readJson\(path, fallback\) \{[\s\S]*?\n\}/,
    `async function readJson(path, fallback) {
  const v = window.__PREVIEW_DATA[path];
  return v === undefined ? fallback : v;
}`,
  )
  .replace(
    /async function readText\(path\) \{[\s\S]*?\n\}/,
    `async function readText(path) {
  return '미리보기에서는 리포트 전문을 담지 않았습니다. 실제 화면에서 볼 수 있어요.';
}`,
  )
  /* 열쇠 확인·배포 상태 조회는 바깥 통신이라 미리보기에선 흉내만 낸다 */
  .replace(
    /async function verifyKey\(k\) \{[\s\S]*?\n\}/,
    'async function verifyKey(k) { return { ok: true }; }',
  )
  .replace(
    /  \/\* 앱1\(main\)까지 반영됐는지[\s\S]*?catch \(e\) \{ D\.deployAhead = null; \}/,
    '  D.deployAhead = 0;',
  )
  /* 바꾸기 버튼은 아무 일도 하지 않는다 — 미리보기가 진짜 데이터를 건드리면 안 된다 */
  .replace(
    /async function dispatchWorkflow\(file, inputs\) \{[\s\S]*?\n\}/,
    `async function dispatchWorkflow(file, inputs) {
  throw new Error('미리보기에서는 실제로 바꾸지 않습니다. Cloudflare에 올린 화면에서 눌러 주세요.');
}`,
  );

const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16);
const reg = DATA['data/registered.json'];
const nReg = (reg && reg.items ? reg.items.length : 0);

const head = FRAGMENT ? '<title>한대장 관리자 — 미리보기</title>\n' : `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>한대장 관리자 — 미리보기</title>
<meta name="robots" content="noindex, nofollow" />
</head>
<body>`;
const tail = FRAGMENT ? '' : '\n</body>\n</html>';

const html = `${head}
<style>
${css}
/* 미리보기 표시 — 이 파일에만 있는 스타일 */
.preview-bar {
  position: sticky; top: 0; z-index: 50; background: var(--warn); color: #17140b;
  padding: 9px 16px; font-size: .85rem; font-weight: 650; text-align: center;
}
.preview-bar b { font-weight: 800; }
</style>

<div class="preview-bar">
  미리보기 — <b>바꾸기 버튼은 동작하지 않습니다.</b>
  ${stamp} KST 기준 데이터 (정식 등록 ${nReg}건)
</div>

<div id="gate" class="gate">
  <div class="gate-box">
    <h1>한대장 관리자 <span style="font-size:.7em;color:var(--ink-3)">미리보기</span></h1>
    <p class="gate-lede">실제 화면에서는 여기에 GitHub 열쇠를 넣어야 들어갑니다.
      미리보기라 아무 글자나 넣고 눌러도 열립니다.</p>
    <label class="gate-label" for="gate-key">GitHub 개인 열쇠</label>
    <input id="gate-key" type="password" value="preview" autocomplete="off" />
    <label class="gate-check"><input id="gate-remember" type="checkbox" /><span>이 기기에 기억하기</span></label>
    <button id="gate-enter" class="btn btn-primary btn-lg">둘러보기</button>
    <p id="gate-msg" class="gate-msg" hidden></p>
  </div>
</div>

<div id="app" hidden>
  <header class="topbar">
    <div class="topbar-in">
      <div class="brand"><span class="brand-mark">한대장</span><span class="brand-sub">관리자</span></div>
      <div class="topbar-actions">
        <span id="deploy-state" class="deploy-state"></span>
        <button id="btn-reload" class="btn btn-ghost btn-sm">새로고침</button>
        <button id="btn-logout" class="btn btn-ghost btn-sm danger">열쇠 지우기</button>
      </div>
    </div>
    <nav class="tabs" id="tabs">
      <button class="tab active" data-tab="todo">오늘 할 일 <span class="tab-n" id="n-todo"></span></button>
      <button class="tab" data-tab="list">공고 전체 <span class="tab-n" id="n-list"></span></button>
      <button class="tab" data-tab="review">컨펌 작업대 <span class="tab-n" id="n-review"></span></button>
      <button class="tab" data-tab="forms">양식 <span class="tab-n" id="n-forms"></span></button>
      <button class="tab" data-tab="network">수집망 <span class="tab-n" id="n-network"></span></button>
      <button class="tab" data-tab="quality">데이터 품질 <span class="tab-n" id="n-quality"></span></button>
    </nav>
  </header>

  <div id="job" class="job" hidden>
    <span class="job-dot"></span><span id="job-text"></span>
    <a id="job-link" href="#" target="_blank" rel="noreferrer noopener" hidden>실행 기록 보기 ↗</a>
    <button id="job-close" class="job-close" aria-label="닫기">×</button>
  </div>

  <main class="wrap">
    <section id="screen-todo" class="screen"></section>
    <section id="screen-list" class="screen" hidden></section>
    <section id="screen-review" class="screen" hidden></section>
    <section id="screen-forms" class="screen" hidden></section>
    <section id="screen-network" class="screen" hidden></section>
    <section id="screen-quality" class="screen" hidden></section>
  </main>

  <footer class="foot"><span id="foot-info"></span></footer>
</div>

<div id="sheet-back" class="sheet-back" hidden></div>
<aside id="sheet" class="sheet" hidden aria-label="상세"></aside>
<div id="toast" class="toast" hidden></div>

<script>window.__PREVIEW_DATA = ${JSON.stringify(DATA)};</script>
<script>${dataJs}</script>
<script>${formsJs}</script>
<script>
var module = { exports: {} }; var exports = module.exports;
${entryRules}
window.ENTRY_RULES = module.exports;
</script>
<script type="module">
${urlKeyInline}
${adminInline}
</script>${tail}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`미리보기 생성 → ${OUT}`);
console.log(`  크기 ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 정식 등록 ${nReg}건 · 기준 ${stamp} KST`);
