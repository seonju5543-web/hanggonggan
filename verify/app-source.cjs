/* 검사가 읽는 app.js 글자 — 나누기 전과 같은 글자로 (2026-11-19 · app.js 나누기)

   app.js 를 화면별 파일로 나누면서, app.js 에는 떼어 낸 자리마다 표시 한 줄만 남겼다.
   검사 40여 개가 app.js 를 **글자로** 읽어 함수가 있는지·순서가 맞는지 재는데, 떼어 낸 파일을 못 보면
   「있어야 한다」 검사는 빨개지고 **「없어야 한다」 검사는 조용히 통과**한다(뜻이 사라진다).
   그래서 표시 자리에 그 파일을 그대로 끼워, 검사는 늘 **하나로 이어진 app.js** 를 읽는다.
   🔴 app.js 를 글자로 읽는 검사는 fs.readFileSync('app.js') 대신 이 함수를 쓴다(관문 「app.js 나누기」가 센다).
   새 화면 파일을 떼어 내면 PARTS 에 한 줄 더한다. */
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const PARTS = [
  { file: 'app-prep.js', mark: '/* @@ 신청 준비(일괄 준비·신청 준비 시트·제출처 안내)은 app-prep.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-events.js', mark: '/* @@ 이벤트 연결(버튼·화면 전환·입력 묶기)은 app-events.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-live.js', mark: '/* @@ 실시간 공고 구역(공고 파일 받기·학과·등록금·원문 링크·층2·학교 사진)은 app-live.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-sheet.js', mark: '/* @@ 상세 시트(공고 상세·자격 묻기·시트 되돌아가기)은 app-sheet.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-my.js', mark: '/* @@ MY 화면(보관함·설정·자주 묻는 질문·고객센터·약관·휴지통)은 app-my.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-applications.js', mark: '/* @@ 신청 내역 화면은 app-applications.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
  { file: 'app-onboarding.js', mark: '/* @@ 온보딩(첫 화면)은 app-onboarding.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */' },
];

function rootDir(root) {
  if (!root) return path.join(__dirname, '..');
  if (root instanceof URL) return fileURLToPath(root);
  const s = String(root);
  return s.startsWith('file:') ? fileURLToPath(s) : s;
}

function appSource(root) {
  const dir = rootDir(root);
  let src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  for (const p of PARTS) {
    const at = src.indexOf(p.mark);
    if (at < 0) throw new Error(`app.js 에 ${p.file} 표시가 없습니다 — 떼어 낸 화면을 끼울 자리를 못 찾아 검사를 멈춥니다`);
    /* 맨 위의 설명 주석(떼어 낼 때 붙인 머리말)은 빼고 끼운다 — 나누기 전 app.js 와 **한 글자도 다르지 않게** */
    const part = fs.readFileSync(path.join(dir, p.file), 'utf8').replace(/^\/\*[\s\S]*?\*\/\n/, '').replace(/\n$/, '');
    src = src.slice(0, at) + part + src.slice(at + p.mark.length);
  }
  return src;
}

/* 나누기 뒤의 app.js 원본 그대로(표시 줄이 남은 것) — 표시가 제자리에 하나 있는지 재는 관문용 */
function rawApp(root) { return fs.readFileSync(path.join(rootDir(root), 'app.js'), 'utf8'); }

module.exports = { appSource, rawApp, PARTS };
