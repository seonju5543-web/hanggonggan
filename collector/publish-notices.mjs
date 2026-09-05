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
/* 화면·알림·로봇이 같은 규칙을 쓰게 — 파일 이름 규칙도, 서비스 학교 목록도
   match-engine.js 에만 있다. 베끼면 '로봇이 쓴 파일을 앱이 못 찾는' 유형의 고장이 난다. */
const { noticeFileKey } = require('../match-engine.js');
/* ⚠️ 대문자 이름은 **`const 이름 =` 꼴로 따로 받는다** — test-collector 의 '선언 없는 이름'
   검사는 `const { A, B } = require(...)` 의 중괄호 안을 선언으로 못 본다. 구조분해로 쓰면
   멀쩡한 코드가 빨간불이 된다(2026-09-05). 검사를 느슨하게 하는 대신 이렇게 맞춘다 —
   그 검사가 잡으려는 것(옛 이름이 문자열 안에 남는 사고)은 계속 잡혀야 한다. */
const SERVED_SCHOOLS = require('../match-engine.js').SERVED_SCHOOLS;
/* 제목 열쇠는 수집기·중복 판정과 같은 규칙을 쓴다 — 베끼면 갈라진다 */
import { titleKey } from './url-key.mjs';

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
/* 🔴 **주소만 고치는 로봇은 재발행하면 안 된다 — 이 자리만 고친다** (2026-09-05 신설).

   링크 사냥꾼·원문 링크 복구는 `data/notices.json` 의 주소를 표식(#n-)에서 진짜 주소로
   바꾸는데, 그동안 **학교별 파일을 갱신하지 않아** 고친 주소가 다음 수집까지 학생 화면에
   닿지 않았다(앱이 읽는 것은 학교별 파일이다).

   🔴 그렇다고 `publishBySchool(notices.items)` 를 부르면 **더 나빠진다.** 수집기는
   `capNotices` 로 **자르기 전** 목록을 발행하는데, 이 로봇들이 가진 것은 이미 잘린
   목록(전체 상한 = 학교 수 × 15)이다. 그대로 재발행하면 학교별 파일이 그 상한만큼
   **줄어들어** 나눈 뜻이 통째로 사라진다. 이 함수는 그래서 **갈아치우지 않고 고친다.**

   ⚠️ 잇는 열쇠는 **제목**(titleKey)이다 — 주소는 지금 바뀌는 중이라 열쇠로 쓸 수 없고,
   이 로봇들은 제목을 건드리지 않는다(두 로봇 전체에서 title·school·campus 에 대입하는
   자리가 한 곳도 없다 — 2026-09-05 전수 확인). 학교·캠퍼스까지 함께 보므로 같은 제목이
   다른 학교에 있어도 섞이지 않는다. **다만 같은 학교 안의 제목 충돌까지 막지는 못한다** —
   normTitle 이 공지·괄호·점·물결을 지우므로 이론상 두 공고가 한 열쇠가 될 수 있다
   (실데이터 충돌 0건 · dedupeNotices 가 이미 같은 열쇠를 쓰므로 새로 생긴 위험은 아니다).

   🔴 **이 함수가 닿는 범위에는 천장이 있다 — 다음 세션이 없는 버그를 쫓지 않도록 적어 둔다.**
   `notices.json` 은 전체 상한 200건이고 학교별 파일은 학교당 60건이라, 학교별 파일에는
   **`notices.json` 에 대응이 없는 항목이 대다수다**(2026-09-05 실측: 551건 중 351건 = 64%).
   그런 항목은 이 함수가 영영 못 고친다 — 그중 표식(#n-)으로 남은 것이 15건 있다
   (동국대 10 · 가천/중앙/연세/항공/외대 각 1). 그걸 고치려면 사냥꾼이 학교별 파일에서도
   표적을 집어 들어야 하는데 그건 별건이다. **표식이 남아 있다고 이 함수를 의심하지 말 것.** */
/* 🔴 **서비스하지 않는 학교의 공고는 피드에 담지 않는다** (2026-09-05 개발자 지시).

   2026-08-30 에 수집을 경희대·한국외대 둘로 좁혔지만, **이미 담겨 있던 다른 학교 공고는
   그대로 남았다.** 앱은 SERVED_SCHOOLS 로 걸러 학생에게 안 보여 주지만, 데이터는 계속
   자리를 차지하고 로봇들은 그걸 붙들고 일한다:
     · `data/notices.json` 200건 중 **173건(87%)이 서비스 안 하는 33개교** 것이었다.
       전체 상한(200)을 그것들이 차지해 **정작 두 학교의 새 공고를 밀어낸다.**
     · 링크 사냥꾼이 그 공고들의 게시판(중앙대·동국대·서울시립대…)까지 뒤진다 —
       25분 예산을 아무도 안 보는 학교에 쓴다(시간초과의 한 원인).
     · 학교별 파일이 41개인데 실제로 쓰이는 것은 2개다.

   ⚠️ **되돌리기는 쉽다** — schools.json·browser-targets.json 의 `parked` 에서 학교를 되살리고
   SERVED_SCHOOLS 에 이름을 넣으면 그날 수집부터 다시 담긴다(설정은 지우지 않고 보관 중이다).
   ⚠️ **`data/registered.json` 은 건드리지 않는다** — 거기 남은 파킹 학교 공고는
   '전국인데 학교로 묶인 것'이라 개발자 판단 대기 항목이다(CLAUDE.md 첫머리). 성격이 다르다. */
export function dropUnserved(items, served = SERVED_SCHOOLS) {
  const ok = new Set(served);
  return (items || []).filter((n) => ok.has(n && n.school));
}

export function patchUrlsBySchool(items, opts = {}) {
  const dir = opts.dir || new URL('../data/notices/', HERE);
  const want = new Map();
  for (const n of items || []) {
    const k = titleKey(n);
    if (k && n.url) want.set(k, n.url);
  }
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => /\.json$/.test(f) && f !== 'index.json'); } catch { return { files: 0, fixed: 0 }; }

  let fixed = 0, touched = 0;
  for (const f of files) {
    const path = new URL(f, dir);
    let doc;
    try { doc = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { continue; }
    let changed = 0;
    for (const n of doc.items || []) {
      const url = want.get(titleKey(n));
      if (url && url !== n.url) { n.url = url; changed += 1; }
    }
    if (changed) {
      fs.writeFileSync(path, JSON.stringify(doc, null, 1));
      fixed += changed; touched += 1;
    }
  }
  return { files: touched, fixed };
}

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
