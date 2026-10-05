/* ============================================================
   앱이 실제로 받는 정적 파일 목록 — 앱 스크립트에서 뽑는다 (2026-10-04 로봇·도구 점검 · 묶음 alerts)
   ------------------------------------------------------------
   .github/workflows/check-live.yml(실제 앱 반영 확인)이 부른다. 그 점검은 손으로 적은 목록만 봐서
   대외활동(data/activities.json)·재단(data/external.json)·층2(data/kosaf-open.json)·등록금·검색 요약·
   자기소개서 규칙 둘·정문 사진 목록·약관이 **404 여도 초록불**이었다(앱은 404 를 조용히 넘긴다).
   🔴 손 목록을 만들지 않는다(CLAUDE.md '파일 이름은 박아 두지 말 것') — index.html 이 싣는 스크립트를 읽어
      `fetch('…')`·`getDoc('…')` 의 **글자 그대로인 상대 경로**만 모은다. 변수·템플릿 문자열·바깥 주소는 뺀다
      (학교별 공고·학과·소식처럼 이름을 계산하는 파일은 check-live 가 match-engine.js 규칙으로 따로 뽑는다).
   CommonJS 인 이유: check-live 의 `node -e` 에서 require 로 부른다.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const FETCH_RE = /\b(?:fetch|getDoc)\(\s*(['"])([^'"`$\n]+?)\1/g;

/** 글 하나에서 fetch·getDoc 의 글자 그대로인 상대 경로 (중복 제거 · 정렬) */
function fetchPathsIn(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(FETCH_RE)) {
    let p = m[2].trim();
    if (!p || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//') || p.startsWith('/')) continue;   // 바깥 주소·뿌리 주소는 뺀다
    p = p.replace(/^\.\//, '').replace(/[?#].*$/, '');
    if (p) out.add(p);
  }
  return [...out].sort();
}

/** index.html 이 싣는 우리 스크립트 (바깥 주소는 뺀다) */
function appScripts(indexHtml) {
  return [...String(indexHtml || '').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => !/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('//'))
    .map((s) => s.replace(/^\.\//, '').replace(/[?#].*$/, ''));
}

/** 앱이 받는 파일 전부 — rootDir 은 저장소 뿌리 */
function appFetchFiles(rootDir = '.') {
  const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const out = new Set();
  for (const s of appScripts(html)) {
    const f = path.join(rootDir, s);
    if (!fs.existsSync(f)) continue;
    for (const p of fetchPathsIn(fs.readFileSync(f, 'utf8'))) out.add(p);
  }
  return [...out].sort();
}

module.exports = { fetchPathsIn, appScripts, appFetchFiles };

if (require.main === module) console.log(appFetchFiles(process.argv[2] || '.').join('\n'));
