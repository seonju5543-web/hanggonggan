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
import { titleKey, noticeUrlRank, dedupeNotices } from './url-key.mjs';
/* 장부 메우기(healFromLedger)가 거는 규칙도 수집기의 것을 그대로 부른다 — 60일 · 첨부 링크 · 제목 청소 */
import { KEEP_DAYS } from './candidates.mjs';
import { isAttachmentEntry } from './attachment-link.mjs';
import { cleanTitle } from './clean-title.mjs';

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
   🔴 넘겨받는 것은 **그날 주운 글이 아니라 60일치를 쌓은 전체 목록**이다(수집기가 notices.json 에 누적한 것).
      게시판 하나가 그날 접속에 실패해도 그 학교 글은 목록에 그대로 있다 — 그래서 목록에 글이 하나도 없는 학교는
      '오늘 못 읽은 학교'가 아니라 **그 학교 글이 목록에서 다 빠진 학교**다(60일 경과 · 서비스 제외 · 병합 사고 등 — 까닭은 여기서 모른다).
   🔴 그런 학교의 옛 파일은 **빈 파일로 다시 쓴다** (2026-10-04 점검 app2-F4 · collect-12). 예전 주석은 '접속 실패했을 뿐일 수 있어
      남긴다 · 60일 규칙으로 늙어 사라진다'였는데 둘 다 틀렸다 — 다시 쓰이지 않는 파일은 늙지 않고, 앱은 색인을 거치지 않고 파일 이름으로
      바로 받아(app.js loadNotices) 나이 거르기 없이 보여 준다(실측: 9-30 판 그대로 굳은 충북·충남·방통 파일 셋).
   ⚠️ 파일을 **지우지는 않는다** — 한 로봇이 지우고 다른 로봇이 같은 파일을 고치면 수정/삭제 충돌이 나는데, 그 충돌은 병합기
      (merge-json-union)가 부르지 않아 pull --rebase 가 실패한다. 이미 빈 파일은 손대지 않는다(날짜만 바뀐 커밋을 매 실행 만들지 않게).
      교내 소식 로봇(collect-news.mjs)도 같은 일을 제 손으로 한다 — 결과가 같다. */
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
       ⚠️ **'상한을 차지해 새 공고를 밀어낸다'고 적지 말 것 — 재 보니 사실이 아니다**
       (2026-09-05 리뷰가 잡았다). capNotices 의 전체 상한은 `max(200, 학교수 × 15)` 라
       **죽은 학교가 많을수록 상한이 커진다**: 35개교일 때 525 라 200건은 한 건도 안 잘렸고,
       새 공고 30건을 얹어도 30건 전부 살아남았다(실측). 이득은 아래 셋이지 상한이 아니다.
     · 폰이 받는 `notices.json` 이 **120KB → 14KB**.
     · 링크 사냥꾼이 그 공고들의 게시판(중앙대·동국대·서울시립대…)까지 뒤진다 —
       25분 예산을 아무도 안 보는 학교에 쓴다(시간초과의 한 원인).
       실측: 표적 게시판 3 → 0곳 · 순찰 후보 237 → 72건.
     · 학교별 파일이 41개인데 실제로 쓰이는 것은 2개다.

   ⚠️ **되돌리기** — schools.json·browser-targets.json 의 `parked` 에서 학교를 되살리고 SERVED_SCHOOLS 에 이름을 넣으면
   그날 수집부터 **새 글**이 담긴다(설정은 지우지 않고 보관 중이다). 🔴 이미 본 글은 seen.json 때문에 다시 수집되지 않는다 —
   그 글은 아래 healFromLedger 가 후보 장부(candidates.json)에서 FEED_HEAL_SINCE 이후 수집분만 메운다(2026-10-04 점검 collect-05).
   ⚠️ **`data/registered.json` 은 건드리지 않는다** — 거기 남은 파킹 학교 공고는
   '전국인데 학교로 묶인 것'이라 개발자 판단 대기 항목이다(CLAUDE.md 첫머리). 성격이 다르다. */
export function dropUnserved(items, served = SERVED_SCHOOLS) {
  const ok = new Set(served);
  return (items || []).filter((n) => ok.has(n && n.school));
}

/* 🔴 **피드에서 빠진 글을 후보 장부에서 다시 싣는다** (2026-10-04 점검 collect-05 · collect-01).
   수집기는 '이미 본 글인가'를 seen.json 으로만 묻고 '지금 피드에 있는가'는 묻지 않는다. 그래서 한 번 피드에서 빠진 글은
   **영영 돌아오지 않는다** — 9-30 병합기가 notices.json 을 200건으로 잘랐을 때(옛 slice(0,200)) 15개교 215건이 그렇게 사라졌고,
   seen.json 은 지우는 곳이 없어 다음 실행들도 '새 글 0건'이었다. 후보 장부(candidates.json)에는 그 글이 다 남아 있다.

   하는 일: 장부에서 ① 서비스 학교 ② 60일(KEEP_DAYS) 안 ③ FEED_HEAL_SINCE 이후 수집 ④ 첨부 링크 아님 — 인 글을 골라
   **지금 피드에 없는 것만** 덧붙인다. 낱말 그물(KEYWORDS)·메뉴 판정은 다시 걸지 않는다(피드에 남은 글에도 안 거는 규칙이라 갈라진다).
   제목은 저장하는 로봇과 같은 청소(cleanTitle)를 거친다 — 장부에는 청소 전 제목이 남아 있다.

   🔴 **메우기만 하고 바꾸지 않는다.** 그냥 합치면(dedupeNotices(피드 + 장부)) preferNotice 가 첨부·힌트가 있는 장부의 옛 판을 골라,
      링크 로봇이 고친 지금 글의 주소가 옛 판으로 되돌아간다(실측 11건 · 서울교대 목록 표식 3건 포함). 그래서 같이 돌려
      '새로 생긴 칸'만 가져오고, 지금 글은 같은 객체 그대로 둔다. 판정은 dedupeNotices 를 그대로 부른다(열쇠를 베끼지 않는다).
   🔴 **다리 막기** — 장부 안의 두 변형(같은 주소·다른 제목)이 피드 글과 이어지면, 새 칸에 남은 판이 피드 글과 제목(또는 주소·글 번호)을
      공유해 감사의 '실시간 공고에 중복'(오류 → 데이터 관문 빨간불 → 자동 등록 되돌림)이 된다. 새 칸 하나하나를 dedupeNotices 의 열쇠
      전부로 피드 글·앞서 받은 새 칸과 대 보고, 하나라도 겹치면 버린다.
   ⚠️ foundAt 은 원래 날짜 그대로 둔다 — 오늘로 바꾸면 알림(notify-rules.js foundBeforeLastCheck)이 '새 공고'로 울리고 60일 수명도 늘어난다.
   🔴 **피드에서 글을 빼는 규칙을 새로 만들면 여기 pool 거르기에도 같은 함수를 건다** — 안 걸면 이 메우기가 다음 실행에 그 글을 장부에서
      되살린다(지금 피드에서 빼는 규칙은 60일 · 첨부 링크 · 서비스 밖 셋이고 셋 다 여기 걸려 있다).
   반환: 새 배열(입력을 고치지 않는다). 새 칸이 없으면 dedupe 한 피드 그대로, 있으면 foundAt 내림차순 안정 정렬(병합기 mergeNotices 와 같은 차례). */
/* 9-29 = 44개교 복원일. 그 전 수집분은 8월 30일 파킹으로 **일부러 뺀** 글이라 메우지 않는다(마감도 대부분 지났다).
   11-28 이후에는 60일 경계가 이 날을 넘으므로 저절로 뜻이 없어진다 — 다시 학교를 파킹할 일이 생기면 그때 이 날을 옮긴다. */
export const FEED_HEAL_SINCE = '2026-09-29';

export function healFromLedger(items, ledger, opts = {}) {
  const today = opts.today || new Date();
  const keepDays = opts.keepDays ?? KEEP_DAYS;
  const since = opts.since ?? FEED_HEAL_SINCE;
  const ok = new Set(opts.served || SERVED_SCHOOLS);
  const cutoff = new Date(today.getTime() - keepDays * 86400000).toISOString().slice(0, 10);
  const from = since > cutoff ? since : cutoff;
  const pool = [];
  for (const n of ledger || []) {
    if (!n || !n.url || !n.school || !ok.has(n.school)) continue;
    if (!(String(n.foundAt || '') >= from)) continue;
    if (isAttachmentEntry(n)) continue;
    const title = cleanTitle(n.title || '');
    pool.push(title && title !== n.title ? { ...n, title } : n);
  }
  const A = dedupeNotices(items || []);
  if (!pool.length) return A;
  /* 새 칸 = '피드를 먼저 넣고 장부를 이어 넣었을 때 피드 칸 뒤에 생긴 칸'. 앞 칸 수가 피드 길이와 같으려면 피드가 dedupe 를 다시 걸어도
     줄지 않아야 한다 — 드물게 줄면(같은 열쇠로 이어진 두 글) 줄지 않을 때까지 걸어 앞 칸 수를 맞춘다(지금 글은 A 그대로 쓴다). */
  let base = A;
  for (let again = dedupeNotices(base); again.length !== base.length; again = dedupeNotices(base)) base = again;
  const fresh = dedupeNotices(base.concat(pool)).slice(base.length);
  if (!fresh.length) return A;
  /* 다리 막기 — 새 칸을 피드 뒤에 붙여 dedupeNotices 를 한 번 더 돌리되, 합치지는 않고(distinct 가 늘 참) '어느 칸과 열쇠가 겹쳤나'만 본다.
     distinct 는 열쇠가 겹치는 칸마다 불리므로 주소·제목·글 번호 열쇠를 dedupe 와 똑같이 다 대 본다(열쇠 규칙을 여기 베끼지 않는다). */
  const feed = new Set(A);
  const isNew = new Set(fresh);
  const clash = new Set();
  dedupeNotices(A.concat(fresh), { distinct: (slot, n) => { if (isNew.has(n) && (feed.has(slot) || isNew.has(slot))) clash.add(n); return true; } });
  const gap = fresh.filter((n) => !clash.has(n));
  if (!gap.length) return A;
  return A.concat(gap).sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
}

/* 서비스 학교인데 넘겨받은 목록에 글이 하나도 없는 학교 (2026-10-04 점검 app2-F2) — 수집 리포트 머리에 한 줄로 적는다.
   학교별 상태 줄은 '✅ 정상 (실공고 15건 감지)'인데 학생 화면은 0건인 학교(한양 — 감지한 글이 전부 전에 본 글)가 조용히 남아 있었다.
   차례는 served 그대로. 게시판을 공유하는 분교(SHARED_BOARD_BRANCH)는 SERVED 에 없어 따로 다룰 것이 없다. */
export function zeroFeedSchools(items, served = SERVED_SCHOOLS) {
  const has = new Set((items || []).map((n) => n && n.school).filter(Boolean));
  return (served || []).filter((s) => !has.has(s));
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
      /* 🔴 순위를 낮추는 쪽으로는 고치지 않는다 (2026-10-03 실측) — 복구 로봇이 학교별 파일에만 찾아 둔 항공대 진짜 주소 2건을
         사냥꾼이 이 함수로 notices.json 의 옛 목록 표식으로 덮었다(notices.json 은 그 글을 아직 표식으로 들고 있었다). */
      if (url && url !== n.url && noticeUrlRank(url) <= noticeUrlRank(n.url)) { n.url = url; changed += 1; }
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
  /* 목록에 글이 없는 학교의 옛 파일 → 빈 파일 (이유는 이 함수 위 주석). 그 학교의 파일인지는 이름 규칙(noticeFileKey) 한 곳으로 확인한다 —
     같은 폴더에 다른 파일이 생겨도 건드리지 않게. 못 읽는 파일·이미 빈 파일은 그대로 둔다. 색인에는 지금처럼 글이 있는 학교만 싣는다. */
  let emptied = 0;
  const wrote = new Set(Object.values(index).map((x) => x.file));
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => /\.json$/.test(f) && f !== 'index.json' && !wrote.has(f)); } catch { names = []; }
  for (const f of names) {
    const p = new URL(f, dir);
    let doc;
    try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    if (!doc || typeof doc.school !== 'string' || `${noticeFileKey(doc.school)}.json` !== f) continue;
    if (!Array.isArray(doc.items) || !doc.items.length) continue;
    fs.writeFileSync(p, JSON.stringify({ school: doc.school, updatedAt, items: [] }, null, 1));
    emptied += 1;
  }
  /* 🔴 **색인은 앱도 읽는다** (2026-09-26 · 고문 보고서 — 그전까지는 사람용이었다).
     앱은 이름 규칙(noticeFileKey)으로 자기 파일을 바로 찾아가지만, 그 파일이 **없을 때**
     옛 파일(data/notices.json)을 통째로 받을지 말지를 이 색인으로 판단한다
     (match-engine.js `noticeFallbackNeeded` 한 곳 · 화면과 알림이 같이 쓴다).
     수집 학교가 두 곳이고 온보딩은 213개교를 고를 수 있어, 그 판단이 없으면
     **대다수 학생이 옛 파일을 통째로 받고 자기 공고 0건**이다(실측 33.5KB → 0건).
     🔴 그래서 `files` 의 모양(`{ 학교: { file, count } }`)을 바꾸면 앱이 조용히 옛 파일을
        다시 받기 시작한다 — 관문 「학교별 공고 파일 · 옛 파일로 물러나는 길」이 이 로봇의
        출력을 실제로 만들어 앱의 판정 함수에 먹여 본다. 사람용 설명도 그대로 둔다. */
  fs.writeFileSync(new URL('index.json', dir), JSON.stringify({
    /* 교내 소식(data/news/)도 같은 발행기를 쓴다 — 색인 설명만 제 것으로 바꾼다(opts.note · 2026-09-30). 모양(files)은 같다. */
    note: opts.note || '학교별 실시간 공고 파일 색인. 앱은 noticeFileKey 로 자기 파일을 바로 찾아가고, 그 파일이 없을 때 옛 data/notices.json 을 받을지 말지를 이 색인으로 판단한다(match-engine.js noticeFallbackNeeded). 사람이 어느 파일이 어느 학교인지 보는 데도 쓴다.',
    updatedAt,
    schools: Object.keys(index).length,
    files: index,
  }, null, 1));
  return { schools: groups.size, updatedAt, emptied };
}
