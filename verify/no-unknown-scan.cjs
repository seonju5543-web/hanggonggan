/* 학생 화면 글자 훑기 — 코드의 **문자열 안**에 '모름'류 글자가 있는가 (2026-11-15 · 관문 「학생 화면에 '모름'류 글자가 없다」)
   주석·정규식은 화면에 안 나오므로 보지 않는다 — 작은 글자 읽개(lexer)로 문자열(' " `)만 꺼낸다. 의존 패키지 없이(관문은 설치 없이 돈다).
   index.html 은 <script>·주석 밖의 글자와 속성값을 본다.
   쓰는 곳: verify/test-collector.mjs 같은 절 · 손으로: node verify/no-unknown-scan.cjs */
const fs = require('node:fs');
const path = require('node:path');
const { UNKNOWN_WORDS } = require('./no-unknown-words.cjs');

/* JS 글자에서 문자열 조각을 꺼낸다 — [{ text, line }]. 템플릿의 ${…} 안은 코드로 다시 읽는다 */
function jsStrings(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  let prevSig = '';   // 정규식/나눗셈 가르기 — 직전의 의미 있는 글자
  const regexOk = () => prevSig === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prevSig) || /\b(return|typeof|case|in|of|void|delete|throw|new|else|do)$/.test(prevSig);
  function readTemplate() {   // i 는 ` 다음
    let buf = '', start = line;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src.slice(i, i + 2); if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; out.push({ text: buf, line: start }); return; }
      if (c === '$' && src[i + 1] === '{') {
        out.push({ text: buf, line: start }); buf = ''; i += 2;
        readCode(true); start = line; continue;
      }
      if (c === '\n') line++;
      buf += c; i++;
    }
  }
  function readCode(inTpl) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const seg = src.slice(i, e < 0 ? n : e + 2); line += (seg.match(/\n/g) || []).length; i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") {
        const q = c; let buf = ''; i++;
        while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { buf += src.slice(i, i + 2); i += 2; continue; } buf += src[i]; i++; }
        i++; out.push({ text: buf, line }); prevSig = 'x'; continue;
      }
      if (c === '`') { i++; readTemplate(); prevSig = 'x'; continue; }
      if (c === '/' && regexOk()) {   // 정규식 — 건너뛴다(화면에 안 나온다)
        i++; let cls = false;
        while (i < n && src[i] !== '\n') { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; i++; }
        i++; while (/[a-z]/.test(src[i] || '')) i++; prevSig = 'x'; continue;
      }
      if (inTpl) { if (c === '{') depth++; else if (c === '}') { if (depth === 0) { i++; return; } depth--; } }
      if (/[A-Za-z0-9_$]/.test(c)) { let w = ''; while (i < n && /[A-Za-z0-9_$]/.test(src[i])) w += src[i++]; prevSig = w; continue; }
      prevSig = c; i++;
    }
  }
  readCode(false);
  return out;
}

/* HTML — 주석·<script>·<style> 을 뺀 글자와 속성값(줄 번호와 함께) */
function htmlTexts(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  const s = src.replace(/<!--[\s\S]*?-->/g, blank).replace(/<script\b[\s\S]*?<\/script>/gi, blank).replace(/<style\b[\s\S]*?<\/style>/gi, blank);
  return s.split('\n').map((t, k) => ({ text: t, line: k + 1 }));
}

/* 파일 하나 훑기 → [{ file, line, word, text }] — allow 는 { 'app.js:낱말:글자 일부': '까닭' } 꼴이 아니라 [{ file, has, why }] */
function scanFile(file, src, allow = []) {
  const parts = /\.html$/.test(file) ? htmlTexts(src) : jsStrings(src);
  const hits = [];
  for (const p of parts) for (const w of UNKNOWN_WORDS) {
    if (!p.text.includes(w)) continue;
    if (allow.some((a) => a.file === file && p.text.includes(a.has))) continue;
    hits.push({ file, line: p.line, word: w, text: p.text.trim().slice(0, 120) });
  }
  return hits;
}

module.exports = { jsStrings, htmlTexts, scanFile };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const { NO_UNKNOWN_ALLOW } = require('./no-unknown-allow.cjs');
  let all = [];
  for (const f of ['app.js', 'index.html', 'match-engine.js']) all = all.concat(scanFile(f, fs.readFileSync(path.join(root, f), 'utf8'), NO_UNKNOWN_ALLOW));
  for (const h of all) console.log(`${h.file}:${h.line}  [${h.word}]  ${h.text}`);
  console.log(`${all.length}건`);
  process.exit(all.length ? 1 : 0);
}
