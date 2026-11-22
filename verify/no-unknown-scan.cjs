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
  /* 닫는 태그는 `</script >`·`</script\t\n bar>` 처럼 빈칸·군글자가 끼어도 잡는다 — 브라우저는 그것도 닫는 태그로 읽는다
     (2026-11-18 · CodeQL #56·#60 — 안 잡으면 그 뒤 스크립트 글자까지 화면 글자로 훑는다) */
  const s = src.replace(/<!--[\s\S]*?-->/g, blank).replace(/<script\b[\s\S]*?<\/script\b[^>]*>/gi, blank).replace(/<style\b[\s\S]*?<\/style\b[^>]*>/gi, blank);
  return s.split('\n').map((t, k) => ({ text: t, line: k + 1 }));
}

/* 학생 화면 글자를 만드는 파일 전부 (2026-11-16 리뷰 — 예전엔 app.js·index.html·match-engine.js 셋뿐이라 source-link.js 의 「(확인 필요)」 링크 이름·
   data.js 제출처 이름이 훑개 밖에서 살아남았다). 화면이 싣는 공용 파일·서비스워커(알림 문구)·약관 화면(앱 안에서 읽는다)까지.
   새로 화면 글자를 만드는 파일을 더하면 여기에도 — 관문이 index.html 의 <script src> 가 전부 여기 있는지 본다 */
const SCREEN_FILES = ['app.js', 'app-account.js', 'app-activities.js', 'app-prep.js', 'app-events.js', 'app-mascot.js', 'app-live.js', 'app-sheet.js', 'app-my.js', 'app-applications.js', 'app-onboarding.js', 'index.html', 'match-engine.js', 'source-link.js', 'data.js', 'apply-channel.js', 'forms.js', 'form-plan.js',
  'notify-rules.js', 'notify.js', 'parse-amount.js', 'parse-requirements.js', 'section-head.js', 'formfill.js', 'pdf-view.js', 'essay.js', 'essay-ask.js', 'essay-quality.js',
  'essay-submit-check.js', 'chat.js', 'chat-kb.js', 'chat-nlu.js', 'resume.js', 'boot.js', 'sw.js', 'interactions.js', 'elig-ask.js', 'input-guard.js', 'major-track.js', 'about.js', 'supabase-client.js',
  'error-report.js', 'usage-report.js', 'terms.html'];

/* 파일 하나 훑기 → [{ file, line, word, text }] — allow 는 { 'app.js:낱말:글자 일부': '까닭' } 꼴이 아니라 [{ file, has, why, exact? }]
   exact 는 문자열 **전체**가 has 와 같을 때만 넘긴다(짧은 낱말 하나를 has 로 두면 그 파일의 같은 낱말이 전부 풀리므로) */
function scanFile(file, src, allow = []) {
  const parts = /\.html$/.test(file) ? htmlTexts(src) : jsStrings(src);
  const hits = [];
  for (const p of parts) for (const w of UNKNOWN_WORDS) {
    if (!p.text.includes(w)) continue;
    if (allow.some((a) => a.file === file && (a.exact ? p.text.trim() === a.has : p.text.includes(a.has)))) continue;
    hits.push({ file, line: p.line, word: w, text: p.text.trim().slice(0, 120) });
  }
  return hits;
}

module.exports = { jsStrings, htmlTexts, scanFile, SCREEN_FILES };

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const { NO_UNKNOWN_ALLOW } = require('./no-unknown-allow.cjs');
  let all = [];
  for (const f of SCREEN_FILES) all = all.concat(scanFile(f, fs.readFileSync(path.join(root, f), 'utf8'), NO_UNKNOWN_ALLOW));
  for (const h of all) console.log(`${h.file}:${h.line}  [${h.word}]  ${h.text}`);
  console.log(`${all.length}건`);
  process.exit(all.length ? 1 : 0);
}
