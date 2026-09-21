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
  /* 저장해 둔 공고 원문 (2026-09-13) — 상세 시트의 오른쪽 칸이 이걸 읽는다.
     ⚠️ 둘이 합쳐 800KB 라 미리보기 파일이 그만큼 커진다. 그래도 담는 이유:
        안 담으면 미리보기가 '원문이 없습니다'라고 **거짓으로** 말한다. */
  'collector/extracted/notices-text.json': readJson('collector/extracted/notices-text.json'),
  'collector/extracted/browser-bodies.json': readJson('collector/extracted/browser-bodies.json'),
  /* 인스타 화면 (2026-09-12) — 없는 파일은 null 그대로(화면이 빈 값으로 그린다) */
  'insta/seen.json': readJson('insta/seen.json'),
  'insta/templates.json': readJson('insta/templates.json'),
  'insta/stats.json': readJson('insta/stats.json'),
  'insta/comments.json': readJson('insta/comments.json'),
  'insta/token-seen.json': readJson('insta/token-seen.json'),
  'insta/samples/index.json': readJson('insta/samples/index.json'),
};

const css = read('_admin/admin.css');
const adminJs = read('_admin/admin.js');
const dataJs = read('data.js');
const formsJs = read('forms.js');
const entryRules = read('verify/entry-rules.cjs');
const urlKeyMjs = read('collector/url-key.mjs');

/* admin.js는 ES 모듈이라 url-key를 import한다. 한 장짜리 파일에서는 파일이 없으므로
   import 줄을 지우고, 같은 이름의 함수를 앞에 붙여 준다.

   🔴 **그 파일이 또 부르는 이웃까지 데려와야 한다 (2026-09-13 사고)** — url-key.mjs 가
   `./deadline-hint.mjs` 를 부르기 시작하자 그 import 줄이 인라인 사본에 그대로 남았고,
   `<script type="module">` 안의 상대 경로는 preview.html 옆을 가리키므로 파일을 못 찾아
   **모듈 전체가 실행되지 않았다**(미리보기가 통째로 죽었다 — 관리자 화면과 똑같은 증상).
   그래서 이름을 하나씩 적지 않고 **상대 import 를 따라가며 모아 온다.** */
/** 모듈 하나를 **제 방(IIFE)에 담아** 한 파일로 모은다.
 *  🔴 예전에는 본문을 그냥 이어 붙였다. 그래서 서로 다른 모듈이 같은 이름을 쓰면
 *  '이미 선언됨' 으로 모듈 전체가 죽었다 — 실제로 `url-key.mjs` 와 `canon-url.mjs` 가
 *  둘 다 `VOLATILE` 을, `url-key.mjs` 와 `notice-source.mjs` 가 둘 다 `normTitle` 을 쓴다.
 *  진짜 모듈이면 각자 방이 있어 괜찮은 것이라, 여기서도 방을 만들어 준다.
 *  내보내는 이름만 밖으로 나오고, 그 이름은 `__ns__<파일이름>` 아래에 모인다. */
const nsName = (rel) => `__ns__${rel.replace(/[^A-Za-z0-9]/g, '_')}`;

function inlineModule(startRel, seen = new Set()) {
  if (seen.has(startRel)) return '';
  seen.add(startRel);
  const text = read(startRel);
  const dir = path.posix.dirname(startRel);

  /* 이웃부터 먼저 담는다 */
  let out = '';
  const deps = [];
  for (const m of text.matchAll(/^\s*import\s+\{([^}]*)\}\s+from\s+['"](\.[^'"]+)['"];?\s*$/gm)) {
    const rel = path.posix.normalize(path.posix.join(dir, m[2]));
    deps.push({ names: m[1], rel });
    out += inlineModule(rel, seen);
  }

  /* 내보내는 이름을 먼저 센다 (export 를 지우기 전에) */
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:const|let|var|async\s+function|function|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    m[1].split(',').forEach((n) => {
      const t = n.trim().split(/\s+as\s+/).pop().trim();
      if (t) names.add(t);
    });
  }

  /* 🔴 `export { x } from './dep.mjs'` (재수출) 를 먼저 지운다.
     나중에 `^export ` 만 떼면 `{ x } from './dep.mjs';` 라는 **문법 오류**가 남는다
     (notice-source.mjs 가 실제로 이 꼴이라 모듈이 통째로 죽었다 — 만들면서 겪었다).
     그 이름은 바로 아래 import 줄로 이미 방 안에 들어오므로 잃는 것이 없다. */
  let body = text
    .replace(/^\s*export\s*\{[^}]*\}\s*from\s+['"][^'"]+['"];?\s*$/gm, '')      // 재수출(from) 줄 제거
    .replace(/^\s*import\s+(?:[^'"]*\sfrom\s+)?['"]\.[^'"]+['"];?\s*$/gm, '')   // 이웃 import 줄 제거
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')                                  // 재수출 줄 제거
    .replace(/^export default [\s\S]*?;\s*$/m, '')
    .replace(/^export default .*$/m, '')
    .replace(/^export /gm, '');

  /* 이웃이 내보낸 것을 이 방 안으로 들여온다 */
  const bring = deps.map((d) => `const {${d.names}} = ${nsName(d.rel)};`).join('\n');

  out += `const ${nsName(startRel)} = (() => {\n${bring}\n${body}\nreturn { ${[...names].join(', ')} };\n})();\n`;
  return out;
}

/* admin.js 가 `./vendor/…` 에서 가져오는 것들을 **이름을 적지 않고** 찾아 한 파일로 모은다.
   🔴 예전에는 `url-key.mjs` 하나만 이름으로 지웠다. 그래서 admin.js 가 vendor 에서
   무언가를 새로 가져오기 시작하면 그 import 줄이 인라인 사본에 그대로 남고,
   `<script type="module">` 안의 상대 경로는 preview.html 옆을 가리켜 파일을 못 찾아
   **모듈 전체가 조용히 안 돈다** — 오류 한 줄 없이 화면이 죽는다(2026-09-13 에 실제로 겪었고,
   notice-source.mjs 를 더하다 같은 방식으로 또 겪었다).
   이제 import 를 읽어 vendor 이름을 뽑고, build.sh 의 복사 규칙과 같은 자리에서 원본을 찾는다. */
const VENDOR_SRC = {
  'url-key.mjs': 'collector/url-key.mjs',
  'deadline-hint.mjs': 'collector/deadline-hint.mjs',
  'notice-source.mjs': 'collector/notice-source.mjs',
  'canon-url.mjs': 'collector/canon-url.mjs',
  'page-boilerplate.mjs': 'collector/page-boilerplate.mjs',
  'edit-diff.mjs': 'tools/edit-diff.mjs',        // 관리자 수정 전후 대조 규칙 (2026-09-14)
};
const wantedVendor = [...adminJs.matchAll(/from\s+['"]\.\/vendor\/([^'"]+)['"]/g)].map((m) => m[1]);
const unknownVendor = wantedVendor.filter((n) => !VENDOR_SRC[n]);
if (unknownVendor.length) {
  console.error(`✕ admin.js 가 가져오는 vendor 모듈을 미리보기가 모릅니다: ${unknownVendor.join(', ')}`);
  console.error('  tools/build-admin-preview.mjs 의 VENDOR_SRC 에 더해 주세요 (build.sh 도 함께 확인).');
  process.exit(1);
}
const seenModules = new Set();
const urlKeyInline = wantedVendor.map((n) => inlineModule(VENDOR_SRC[n], seenModules)).join('\n');

const adminInline = adminJs
  /* vendor 에서 가져오던 줄은 **지우지 않고** 그 방에서 꺼내 쓰는 줄로 바꾼다.
     지우면 이름이 없어져 admin.js 가 죽고, 그대로 두면 파일을 못 찾아 모듈이 죽는다. */
  .replace(
    /^\s*import\s+\{([^}]*)\}\s+from\s+['"]\.\/vendor\/([^'"]+)['"];?\s*$/gm,
    (_, names, file) => `const {${names}} = ${nsName(VENDOR_SRC[file])};`,
  )
  /* 바깥으로 나가지 않고 파일 안 데이터를 읽는다 */
  .replace(
    /async function readJson\(path, fallback\) \{[\s\S]*?\n\}/,
    `async function readJson(path, fallback) {
  const v = window.__PREVIEW_DATA[path];
  return v === undefined ? fallback : v;
}`,
  )
  /* 인스타 화면의 '없어도 되는 파일' 읽기도 파일 안 데이터를 본다 */
  .replace(
    /const quiet = async \(path, fallback\) => \{[\s\S]*?\n  \};/,
    `const quiet = async (path, fallback) => { const v = window.__PREVIEW_DATA[path]; return v == null ? fallback : v; };`,
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

/* ── 화면 껍데기는 _admin/index.html 에서 만든다 (2026-09-13) ────────────────────
   🔴 **베끼지 않는다.** 예전에는 이 파일이 index.html 을 손으로 옮겨 적은 사본을 들고
   있었고, 그 사본이 낡아서 실제로 이런 일이 있었다(실측으로 드러남):
     · 화면 8개 중 **robots·insta 두 개가 통째로 빠져** 그 탭이 미리보기에 아예 없었다.
     · `form-plan.js` 를 안 실어서 `planFormQuestions` 가 없고, 그것을 부르는
       `forms.js`  → `renderFormDoc` 이 죽어 **양식 미리보기가 통째로 안 떴다.**
     · 셸에 없는 버튼(`btn-density`·`btn-theme`)을 `bindGlobal()` 이 배선하려다
       `null.addEventListener` 로 넘어져 **`enter()` 가 중간에 멈췄다** — 그래서
       `window.__admin` 이 안 만들어지고 뒤의 배선이 통째로 날아갔다.
   그래서 지금은 진짜 파일을 읽어 바꿔치기만 한다. index.html 에 화면을 더하면
   미리보기에도 저절로 따라온다. */

/** vendor/<이름> → 저장소 원본. build.sh 의 복사 목록과 같아야 한다.
 *  🔴 여기 없는 vendor 파일이 index.html 에 새로 실리면 **조용히 빠지지 않고 실패한다**(아래 검사). */
const VENDOR = {
  /* 🔴 data.js 가 전역으로 부르는 이웃 — 빠뜨리면 미리보기에서만 채널 판정이 '모름'으로 떨어진다 */
  'vendor/apply-channel.js': () => read('apply-channel.js'),
  'vendor/data.js': () => read('data.js'),
  'vendor/forms.js': () => read('forms.js'),
  'vendor/form-plan.js': () => read('form-plan.js'),
  'vendor/entry-rules.js': () => [
    'var module = { exports: {} }; var exports = module.exports;',
    read('verify/entry-rules.cjs'),
    'window.ENTRY_RULES = module.exports;',
  ].join('\n'),
};

const PREVIEW_CSS = `
/* 미리보기 표시 — 이 파일에만 있는 스타일 */
.preview-bar {
  position: sticky; top: 0; z-index: 50; background: var(--warn); color: #17140b;
  padding: 9px 16px; font-size: .85rem; font-weight: 650; text-align: center;
}
.preview-bar b { font-weight: 800; }
`;

const PREVIEW_BAR = `<div class="preview-bar">
  미리보기 — <b>바꾸기 버튼은 동작하지 않습니다.</b>
  ${stamp} KST 기준 데이터 (정식 등록 ${nReg}건)
</div>`;

let shell = read('_admin/index.html');

/* ① 보안 설정(CSP)을 뺀다 — 미리보기는 코드를 파일 안에 넣으므로 'self' 규칙에 걸린다.
      진짜 화면은 index.html 의 CSP 를 그대로 쓴다(여기서 빼는 것은 이 사본뿐이다). */
shell = shell.replace(/\s*<meta http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '');

/* ② 스타일을 파일 안으로 */
/* 🔴 치환 '문자열' 을 쓰지 말 것 — 파일 내용 안의 `$$` 를 자바스크립트가 `$` 로 바꿔 먹는다.
   실제로 그래서 `const $$ =` 가 `const $ =` 가 되어 **'$ 가 이미 선언됐다'** 로 모듈이 통째로
   죽었다(2026-09-13). 내용을 끼워 넣을 때는 **함수**로 돌려준다(함수 반환값은 그대로 들어간다). */
shell = shell.replace(
  /<link rel="stylesheet" href="admin\.css"\s*\/?>/,
  () => `<style>\n${css}\n${PREVIEW_CSS}</style>`,
);

/* ③ vendor 스크립트를 파일 안으로. 모르는 것이 나오면 **조용히 넘기지 않고 멈춘다.** */
const missing = [];
shell = shell.replace(/<script src="(vendor\/[^"]+)"><\/script>/g, (_, rel) => {
  if (!VENDOR[rel]) { missing.push(rel); return ''; }
  return `<script>\n${VENDOR[rel]()}\n</script>`;
});
if (missing.length) {
  console.error(`✕ index.html 이 싣는 vendor 파일을 미리보기가 모릅니다: ${missing.join(', ')}`);
  console.error('  tools/build-admin-preview.mjs 의 VENDOR 목록에 더해 주세요 (build.sh 도 함께 확인).');
  process.exit(1);
}

/* ④ admin.js 본체 — ES 모듈이라 import 를 따라가며 이웃까지 모아 넣는다 */
shell = shell.replace(
  /<script type="module" src="admin\.js"><\/script>/,
  () => `<script type="module">\n${urlKeyInline}\n${adminInline}\n</script>`,
);

/* ⑤ 데이터를 파일 안에 심는다 — 다른 스크립트보다 먼저 있어야 한다 */
shell = shell.replace(/<body>/, () => `<body>\n${PREVIEW_BAR}\n<script>window.__PREVIEW_DATA = ${JSON.stringify(DATA)};</script>`);

/* ⑥ 입장 화면을 미리보기용으로 — 열쇠를 미리 채우고 문구를 바꾼다.
      화면을 새로 짜지 않고 있는 것을 고쳐 쓴다(다시 베끼면 또 낡는다). */
shell = shell
  .replace(/(<h1>한대장 관리자)(<\/h1>)/, '$1 <span style="font-size:.7em;color:var(--ink-3)">미리보기</span>$2')
  .replace(/(<p class="gate-lede">)[\s\S]*?(<\/p>)/,
    '$1실제 화면에서는 여기에 GitHub 열쇠를 넣어야 들어갑니다. 미리보기라 아무 글자나 넣고 눌러도 열립니다.$2')
  .replace(/(<input id="gate-key"[^>]*?)\s*\/>/, '$1 value="preview" />')
  .replace(/(<button id="gate-enter"[^>]*>)들어가기(<\/button>)/, '$1둘러보기$2');

/* ⑦ 조각으로 내보낼 때는 바깥 껍데기를 벗긴다 (공유 문서용) */
const html = FRAGMENT
  ? `<title>한대장 관리자 — 미리보기</title>\n${
    shell.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '')}`
  : shell;

/* ⑧ 베끼기로 되돌아가지 않게 하는 관문 — 화면 개수가 진짜 파일과 같아야 한다.
      (예전 사본은 6개였고 진짜는 8개였는데 아무도 몰랐다) */
const screensIn = (s) => [...s.matchAll(/id="screen-([a-z]+)"/g)].map((m) => m[1]);
const want = screensIn(read('_admin/index.html'));
const got = screensIn(html);
const lost = want.filter((n) => !got.includes(n));
if (lost.length) {
  console.error(`✕ 화면이 빠졌습니다: ${lost.join(', ')} — 껍데기를 index.html 에서 만들지 않았다는 뜻입니다.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`미리보기 생성 → ${OUT}`);
console.log(`  크기 ${(Buffer.byteLength(html) / 1024).toFixed(0)}KB · 정식 등록 ${nReg}건 · 기준 ${stamp} KST`);
console.log(`  화면 ${got.length}개: ${got.join(' · ')}`);
