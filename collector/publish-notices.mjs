/* ============================================================
   학교별 공고 파일 발행 (2026-08-17 신설)
   ------------------------------------------------------------
   왜 나눴나 — '학교당 16건'의 정체

   `data/notices.json`은 **폰이 통째로 내려받는 파일**이다. 앱은 그걸 다 받은 뒤
   자기 학교 것만 골라 쓴다(app.js liveNoticesHtml). 그래서 고려대 학생도 동국대
   공고를 같이 받았고, 파일이 커지지 않게 크기 상한(capNotices — 학교 수 × 15건)이
   필요했다. 학교가 41곳이 되면서 그 상한이 실제로 물려 **바쁜 학교 34곳이 정확히
   16건에서 잘리고** 있었다(2026-08-17 실측).

   학교별로 나누면 학생은 **자기 학교 파일 하나만** 받으므로 상한이 필요 없다.
   폰이 받는 양은 오히려 크게 줄어든다(476KB → 10KB 안팎).

   ⚠️ `data/notices.json`은 **지우지 않는다.** 이유 두 가지:
     ① 이미 설치된 앱은 옛 코드로 그 파일을 받는다. 지우면 새 코드가 도달하기 전까지
        그 사람들 화면이 빈다(서비스워커가 네트워크 우선이라 곧 갱신되지만 '곧'이 0초는 아니다).
     ② 로봇 여럿(auto-register·deepfetch·link-hunter·resolve-detail-urls)과 감사 도구가
        그 파일을 읽는다. 한 번에 다 바꾸면 어디가 깨졌는지 알 수 없다.
   그래서 **둘 다 쓴다.** 앱은 학교별 파일을 보고, 로봇은 기존 파일을 그대로 본다.

   ⚠️ 파일 이름 규칙은 `match-engine.js`의 noticeFileKey **한 곳**에 있다.
   여기서 베끼면 로봇이 쓴 파일을 앱이 못 찾는데, 앱은 404를 조용히 넘기므로
   **오류 하나 없이 공고가 0건**이 된다 — 가장 찾기 어려운 종류의 고장이다.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const HERE = new URL('.', import.meta.url);
const require = createRequire(import.meta.url);
// 화면·알림·로봇이 같은 규칙을 쓰게 — 이름 규칙은 match-engine.js에만 있다
const { noticeFileKey } = require('../match-engine.js');

/* 학교 하나가 가질 수 있는 공고 수. 전체 상한(capNotices)과 달리 **다른 학교에 밀려
   줄어들지 않는다** — 학생은 자기 파일만 받으므로 옆 학교가 바쁘든 말든 상관없다. */
export const PER_SCHOOL = Number(process.env.NOTICES_PER_SCHOOL || 60);

export function schoolKeyOf(n) {
  return `${n.school || ''}${n.campus ? ` ${n.campus}` : ''}`;
}

/* 학교별로 갈라 담는다. 입력 순서(최신 수집분이 앞)를 그대로 유지한다. */
export function splitBySchool(items, perSchool = PER_SCHOOL) {
  const out = new Map();
  for (const n of items || []) {
    if (!n || !n.school) continue;
    const k = n.school;                       // 파일은 **학교** 단위 (캠퍼스는 파일 안에서 가른다)
    if (!out.has(k)) out.set(k, []);
    const arr = out.get(k);
    if (arr.length < perSchool) arr.push(n);
  }
  return out;
}

/* 발행 — 학교별 파일 + 사람이 읽을 색인.
   ⚠️ 사라진 학교의 옛 파일은 **지우지 않는다.** 그 학교가 이번 실행에서 접속 실패했을
   뿐일 수 있고(하루 2회 중 한 번은 자주 실패한다), 지우면 그 학교 학생 화면이 그날
   통째로 빈다. 파일 안의 공고는 어차피 60일 규칙으로 늙어 사라진다. */
export function publishBySchool(items, opts = {}) {
  const dir = opts.dir || new URL('../data/notices/', HERE);
  const perSchool = opts.perSchool ?? PER_SCHOOL;
  const today = opts.today || new Date();
  const updatedAt = new Date(today.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  fs.mkdirSync(dir, { recursive: true });

  const groups = splitBySchool(items, perSchool);
  const index = {};
  for (const [school, list] of groups) {
    const key = noticeFileKey(school);
    index[school] = { file: `${key}.json`, count: list.length };
    fs.writeFileSync(new URL(`${key}.json`, dir), JSON.stringify({ school, updatedAt, items: list }, null, 1));
  }
  /* 색인은 앱이 쓰지 않는다(앱은 이름 규칙으로 바로 찾아간다). 사람과 도구가
     '어느 파일이 어느 학교인가'를 볼 수 있게 두는 것 — 이름이 n1abc처럼 읽을 수 없으므로. */
  fs.writeFileSync(new URL('index.json', dir), JSON.stringify({
    note: '학교별 실시간 공고 파일 색인. 앱은 match-engine.js의 noticeFileKey로 파일을 직접 찾으므로 이 파일을 읽지 않는다 — 사람이 보기 위한 것.',
    updatedAt,
    schools: Object.keys(index).length,
    files: index,
  }, null, 1));
  return { schools: groups.size, updatedAt };
}
