/* 앱 그리기 함수를 Node 에서 **파일 그대로** 부른다 (2026-11-15 · 관문 「학생 화면에 '모름'류 글자가 없다」)
   index.html 이 싣는 순서대로 공용 파일(source-link·data·section-head·parse-requirements·parse-amount·match-engine·elig-ask·forms)을 싣고,
   app.js 는 **최상위 선언만**(열 0의 function … } · const/let) 싣는다 — 부팅 코드(이벤트 걸기·받아오기)는 돌리지 않는다.
   🔴 규칙을 베끼지 않는다 — 카드(schCard)·시트(openDetail)·층2(kosafAsScholarships)를 앱 함수 그대로 부른다(what-shows.mjs 와 같은 원칙).
   DOM 은 가짜다: document.querySelector(선택자)는 그 선택자의 innerHTML 을 담아 두는 그릇을 돌려주고, 나머지 호출은 조용히 넘어간다.
   쓰는 법: const A = loadApp({ profile }); A.run('schCard')(sch, result, {fit, fd}); A.sheetHtml(id) */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const LIBS = ['source-link.js', 'data.js', 'section-head.js', 'parse-requirements.js', 'parse-amount.js', 'match-engine.js', 'elig-ask.js', 'notify-rules.js', 'forms.js'];

/* 무엇을 불러도 넘어가는 가짜 요소 — innerHTML·textContent 만 담아 둔다 */
function fakeEl(store, key) {
  const fn = function () {};
  const p = new Proxy(fn, {
    get(t, k) {
      if (k === 'innerHTML' || k === 'textContent' || k === 'innerText') return store[key] || '';
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      if (k === 'then') return undefined;
      if (k === 'dataset' || k === 'style') return {};
      if (k === 'classList') return { add() {}, remove() {}, toggle() {}, contains: () => false };
      if (k === 'value' || k === 'id' || k === 'className') return '';
      if (k === 'hidden' || k === 'checked' || k === 'disabled') return false;
      if (k === 'scrollTop' || k === 'offsetTop' || k === 'scrollHeight' || k === 'clientHeight') return 0;
      return p;
    },
    set(t, k, v) { if (k === 'innerHTML' || k === 'textContent') store[key] = String(v); return true; },
    apply() { return p; },
  });
  return p;
}

/* app.js 최상위 선언을 하나씩 꺼낸다 — 열 0의 function…} 과 const/let(한 줄 · 또는 열 0의 ]; }; ); 로 끝나는 덩이) */
function topLevelDecls(src) {
  const lines = src.split('\n');
  const fns = [], vars = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(async )?function\*? [A-Za-z_$][\w$]*\s*\(/.test(l)) {
      let j = i; while (j < lines.length && lines[j] !== '}' && !/^\}\s*(\/\/.*)?$/.test(lines[j])) j++;
      if (/\}\s*$/.test(l) && j !== i && /^(async )?function[^{]*\{.*\}\s*$/.test(l)) j = i;   // 한 줄 함수
      fns.push(lines.slice(i, j + 1).join('\n')); i = j; continue;
    }
    if (/^(const|let|var) [A-Za-z_$]/.test(l)) {
      let j = i;
      const single = /;\s*(\/\/.*|\/\*.*\*\/\s*)?$/.test(l) && !/[[{(]\s*$/.test(l);
      if (!single) { j = i + 1; while (j < lines.length && !/^[\]})]+[\])};,]*\s*(\/\/.*)?$/.test(lines[j])) j++; }
      vars.push(lines.slice(i, j + 1).join('\n')); i = j;
    }
  }
  return { fns, vars };
}

function loadApp({ profile = null, kosaf = [], registered = [], read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8') } = {}) {   // read — 관문은 readText 를 넘긴다
  const store = {};
  const doc = {
    querySelector: (s) => fakeEl(store, s), getElementById: (s) => fakeEl(store, '#' + s), querySelectorAll: () => [],
    createElement: () => fakeEl(store, '__new'), addEventListener() {}, removeEventListener() {}, body: fakeEl(store, 'body'),
    documentElement: fakeEl(store, 'html'), baseURI: 'https://seonju5543-web.github.io/hanggonggan/', visibilityState: 'visible', hidden: false,
  };
  const memory = {};
  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {}, info() {} }, URL, URLSearchParams, Math, Date, JSON, Object, Array, String, Number, RegExp, Map, Set, WeakMap, Promise, Symbol, Error, TypeError,
    encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN, isFinite, Intl, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0,
    document: doc, location: { href: 'https://x/', search: '', hash: '', pathname: '/' }, history: { pushState() {}, replaceState() {}, state: null },
    navigator: { userAgent: 'node', serviceWorker: undefined }, matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: { getItem: (k) => (k in memory ? memory[k] : null), setItem: (k, v) => { memory[k] = String(v); }, removeItem: (k) => { delete memory[k]; } },
    fetch: () => Promise.reject(new Error('관문 — 받아오지 않는다')), addEventListener() {}, removeEventListener() {}, performance: { now: () => 0 },
  });
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  for (const f of LIBS) vm.runInContext(read(f), ctx, { filename: f });
  const { fns, vars } = topLevelDecls(require('./app-source.cjs').appSource());
  vm.runInContext(fns.join('\n\n'), ctx, { filename: 'app.js(함수)' });
  const skipped = [];
  for (const v of vars) { try { vm.runInContext(v, ctx, { filename: 'app.js(선언)' }); } catch (e) { skipped.push(`${v.split('\n')[0].slice(0, 60)} — ${e.message}`); } }
  const run = (s) => vm.runInContext(s, ctx);
  run('(p, k, r) => { state = emptyState(); state.profile = p; kosafList = k; registeredList = r; }')(profile, kosaf, registered);
  /* 상세 시트 — openDetail 이 #detail-sheet 에 쓴 글자를 그대로 돌려준다(그 뒤 그릇 열기에서 넘어져도 이미 쓴 것은 남는다) */
  const sheetHtml = (id) => { store['#detail-sheet'] = ''; try { run('openDetail')(id); } catch (e) { /* 그릇 열기 등 DOM 일 */ } return store['#detail-sheet'] || ''; };
  return { ctx, run, sheetHtml, store, skipped, setProfile: (p) => run('(p) => { state.profile = p; }')(p) };
}

/* HTML → 화면 글자(태그를 줄바꿈으로) */
/* 🔴 (2026-11-18 · CodeQL #57·#58) ① <script>/<style> 덩어리는 더 지울 것이 없을 때까지 지운다(한 번만 지우면 「<scr<script></script>ipt>」 꼴이 남는다) ·
   닫는 태그는 `</script >` 처럼 빈칸이 있어도 잡는다 ② `&amp;` 는 **맨 마지막에** 푼다 — 먼저 풀면 화면에 「&lt;」로 보이는 글자가 「<」로 두 번 풀린다(decodeEntities 와 같은 규칙) */
const stripBlocks = (s) => { let prev; do { prev = s; s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\b[^>]*>/gi, ''); } while (s !== prev); return s; };
const screenText = (html) => stripBlocks(String(html || '')).replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').trim();

module.exports = { loadApp, topLevelDecls, screenText };
