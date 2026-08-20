/* 링크 사냥꾼 — '원문 공고로 못 가는 링크'를 계속 찾아 고치는 전담 로봇 (2026-08-01)

   ⭐ 목적을 좁히지 말 것 (2026-08-01 개발자 지적으로 바로잡음)
   이 로봇은 '동국대 고치기'가 아니다. **어느 학교든, 어떤 이유로든 학생이 원문 공고에
   못 가는 링크를 계속 찾아 고치는 것**이 목적이다. 처음 만들 때 내가 두 가지로 목적을
   좁혀 놨고, 그 바람에 경희대 로그인 벽 7건을 놓쳤다:
     ① onlyBoard로 한 학교에 묶음  → 이제 기본이 전체 학교다.
     ② 표식(#n-)이 붙은 것만 대상  → '주소는 멀쩡해 보이는데 눌러 보면 로그인 벽/다른 글'인
        경우는 표식이 없어 눈에 안 띄었다(그런 사각지대가 229건 있었다).
        → **순찰 단계**를 앞에 둬서 기존 링크도 돌아가며 다시 열어 본다.

   왜 따로 두나
   ─────────────────────────────────────────────────────────────────
   수집 로봇(browser-collect)은 매일 12개 캠퍼스를 훑어야 해서 **빨라야 한다**.
   그래서 공고마다 행을 눌러 보는 대신, 목록에서 글 번호를 긁어 주소를 '조립'한다.
   빠르지만 틀릴 수 있다 — 실제로 동국대에서 조립한 `view?nttId=…`가 33건 전부 404였고
   (그 주소 형태가 동국대엔 아예 없었다), 다른 17건은 열리긴 했는데 그 공고가 아니었다.

   이 로봇은 반대로 **느려도 정확한 방법**만 쓴다. 대상이 '남은 어려운 것들'뿐이라
   느려도 괜찮다. 핵심 원칙은 하나다:

       ⭐ 짐작하지 않는다. 행을 실제로 눌러서 브라우저가 간 주소를 받아 적는다.

   조립은 게시판이 폼을 안 내주고 클릭도 실패했을 때의 마지막 수단이다.

   무엇을 하나 — 본업이 먼저, 순찰은 덤 (2026-08-01 개발자 지시로 순서를 바꿈)
   ─────────────────────────────────────────────────────────────────
   본업은 **'앱에서 원문 공고를 눌렀을 때 그 공고가 안 열리는 링크'를 고치는 것**이다.
   멀쩡히 열리는 링크까지 매번 다시 둘러보느라 본업이 밀리면 안 되므로,
   사냥을 먼저 다 하고 **시간이 남을 때만** 순찰한다(`patrol: 0`이면 순찰 아예 끔).

   [1단계 사냥 — 본업]
   ① 표식(#n-…)인 공고를 전부 모은다 — **학교를 가리지 않는다.**
   ② 게시판을 페이지별로 넘기며 그 제목의 행을 찾는다.
   ③ 행을 **클릭**해 브라우저가 실제로 이동한 주소를 받는다.
      주소가 안 바뀌는 게시판(form POST)이면 상세 화면과 목록 폼에서 재료를 모아 조립한다.
   ④ 만든 주소를 **로그인도 리퍼러도 없는 새 탭**에서 다시 열어 그 공고가 맞는지 확인한다.
      (사용자는 그 조건으로 링크를 누르므로 그 조건으로 확인해야 한다.)
   ⑤ 통과한 것만 데이터에 반영한다. 못 찾은 것은 지어내지 않고 표식을 그대로 둔다.
   [덤 · 순찰] 시간이 남으면, 이미 주소가 있는 링크를 오래 안 본 것부터 조금 열어 본다.
      학생이 그 공고를 못 보는 링크(로그인 벽·다른 글·목록)면 표식으로 되돌려
      **다음 실행의 사냥 대상**으로 넘긴다. 이게 필요한 이유는 그런 링크가 겉보기엔
      멀쩡해서 표식이 없고, 열어 보기 전엔 아무도 모르기 때문이다(경희대 7건이 그랬다).

   같은 것을 영원히 다시 두드리지 않기
   ─────────────────────────────────────────────────────────────────
   `collector/link-hunt.json`에 공고별로 시도 횟수와 마지막 사유를 남긴다.
   · '목록에서 못 찾음'이 3회 쌓이면 → 게시판에서 내려간 공고로 보고 `gone` 처리.
     더는 시도하지 않고, 리포트에 '내려간 공고'로 분류한다.
   · '읽었는데 다른 화면'이 3회 쌓이면 → 사람이 봐야 하는 건으로 `stuck` 처리하고
     리포트에 올린다(추측으로 아무 주소나 붙이지 않는다).
   · 네트워크로 못 읽은 것은 횟수에 세지 않는다 — 학교 서버 사정이지 공고 잘못이 아니다.

   실행: node collector/link-hunter.mjs [--dry]
         (워크플로 link-hunter.yml · collector/run-link-hunt.txt 를 고쳐 push해도 실행) */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { isMarkerUrl, markerTitle, listUrlOf, isDetailUrl, sameTitle, titleFingerprint, detailCandidates, idsFromSource, looksLikeLoginWall, rowDetailCandidates, looksLikeList } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
const DRY = process.argv.includes('--dry');
/* 오늘 날짜(KST) — 순찰·재시도 간격 판단에 쓴다.
   ⚠️ 반드시 맨 위에 둘 것: 2026-08-01에 순찰 단계를 넣으면서 이 선언이 사용처보다
   아래에 남아, 로봇이 시작하자마자 죽는 상태였다(const는 선언 전에 못 쓴다). */
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

/* 집계 — 맨 위에 둔다. 아래 '넘어져도 저장' 장치가 언제 불려도 읽을 수 있어야 하기 때문. */
let found = 0; let failed = 0; let gone = 0; let stuck = 0;

/* ── 넘어져도 그때까지 찾은 것은 반드시 저장한다 (2026-08-01) ──────────────
   왜 만들었나: 리포트 마지막 줄의 낱말 하나가 틀려(옛 이름 GIVE_UP_AFTER) 로봇이
   마지막에 넘어졌는데, 그 바람에 **4분 동안 실제로 찾아낸 원문 주소 13건이 통째로
   버려졌다**(저장 단계가 통째로 건너뛰어졌다). 사냥은 오래 걸리는 일이라
   '다 되거나 아니면 전부 버리거나'는 너무 비싸다. 그래서 넘어지면
   ① 그때까지의 결과를 저장하고 ② 리포트에 넘어진 자리를 적고 ③ 그래도 실패는
   실패라고 알린다(종료 코드 1 → 워크플로가 🚨 알림). 저장 단계는 실패해도 돌도록
   link-hunter.yml에서 always()로 바꿔 두었다. */
let crashed = false;
const onCrash = (err) => {
  if (crashed) return;             // 두 번 저장하지 않는다
  crashed = true;
  console.error('\n🚨 사냥 도중 넘어졌습니다 — 그때까지 찾은 것은 저장합니다:\n', err);
  try { saveAll(String((err && err.stack) || err).split('\n').slice(0, 3).join(' · ')); } catch (e) {
    console.error('저장까지 실패했습니다:', e);
  }
  process.exit(1);
};
process.on('uncaughtException', onCrash);
process.on('unhandledRejection', onCrash);

function runSetting(key) {
  try {
    const txt = fs.readFileSync(new URL('run-link-hunt.txt', HERE), 'utf8');
    const m = txt.match(new RegExp('^\\s*' + key + ':\\s*(.+)$', 'm'));
    return m ? m[1].trim() : '';
  } catch { return ''; }
}
const ONLY = process.env.HUNT_ONLY_BOARD || runSetting('onlyBoard');
const MAX_PAGES = Number(process.env.HUNT_MAX_PAGES || runSetting('maxPages') || 10);
const BUDGET_MS = Number(process.env.HUNT_BUDGET_MS || 25 * 60000);
/* 끈질김의 규칙 (2026-08-01 개발자 지시: "어떻게든 원문을 찾아서 올려둬라")
   실패해도 **영영 포기하지 않는다.** 다만 같은 것을 매일 두드리면 학교 서버에 무례하고
   시간도 낭비하므로, 실패가 쌓일수록 **간격을 늘려 가며 계속 시도한다.**
   3회째에 사람에게 알리지만(이슈), 그 뒤로도 로봇은 계속 찾아본다. */
const ESCALATE_AT = 3;                       // 이 횟수에서 사람에게 알린다 (중단이 아니다)
const BACKOFF_DAYS = [0, 1, 1, 3, 7, 14, 30]; // 실패 n회 뒤 며칠 있다 다시 볼지 (마지막 값이 상한)
const startedAt = Date.now();
const outOfTime = () => Date.now() - startedAt > BUDGET_MS;

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
const statePath = new URL('link-hunt.json', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));
let state = { updatedAt: null, items: {} };
try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* 첫 실행 */ }
state.items = state.items || {};

/* 사냥 대상 모으기 — 학교를 가리지 않는다 */
const targets = [];
for (const n of notices.items || []) {
  if (isMarkerUrl(n.url)) targets.push({ ref: n, field: 'url', title: n.title, key: `n:${n.url}`, school: n.school });
}
for (const r of registered.items || []) {
  if (isMarkerUrl(r.sourceUrl)) targets.push({ ref: r, field: 'sourceUrl', title: r.name, key: `r:${r.id}`, id: r.id, school: (r.eligibility || {}).schoolOnly });
}
/* 게시판에서 행을 찾을 때 쓰는 제목은 **게시판에 적힌 원래 제목**이어야 한다.
   앱에 보여주는 이름(r.name)은 사람이 다듬은 것이라("전문자격장학 (2026-2학기)")
   게시판 행("공지 공지 2026-2학기 전문자격장학 신청안내 …")과 안 맞아 못 찾는다.
   표식(#n-)에 든 제목이 원래 제목이고, boardTitle 필드가 있으면 그게 더 정확하다. */
function huntTitle(t) {
  const stored = (t.ref.boardTitle || '').trim();
  if (stored) return stored;
  const fromMarker = markerTitle(t.ref[t.field]);
  if (fromMarker) return fromMarker;
  return String(t.title);
}

const report0 = [];

/* 되돌릴 때 쓸 '그 공고가 있던 게시판 목록 주소'를 찾는다.
   같은 호스트의 다른 공고가 이미 표식(#n-)을 달고 있으면 그 목록 주소를 쓰고,
   없으면 수집 설정(browser-targets.json·schools.json)에서 그 학교 게시판을 찾는다.
   못 찾으면 되돌리지 않는다 — 엉뚱한 목록으로 보내느니 그대로 두는 게 낫다. */
let BOARD_HINTS = [];
try {
  const bt = JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8'));
  BOARD_HINTS = BOARD_HINTS.concat((bt.targets || []).flatMap((t) => t.candidates || []));
} catch { /* 없으면 생략 */ }
try {
  const sc = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8'));
  BOARD_HINTS = BOARD_HINTS.concat((sc.schools || []).map((x) => x.boardUrl).filter(Boolean));
} catch { /* 없으면 생략 */ }

function boardListFor(t) {
  const url = String(t.ref[t.field] || '');
  let origin = '';
  try { origin = new URL(url).origin; } catch { return null; }
  // ① 같은 호스트의 다른 공고가 이미 쓰고 있는 목록 주소
  const mate = [...(notices.items || []), ...(registered.items || [])]
    .map((x) => x.url || x.sourceUrl || '')
    .find((u) => u.startsWith(origin) && isMarkerUrl(u));
  if (mate) return listUrlOf(mate);
  // ② 수집 설정에 적힌 그 학교 게시판 주소
  const hint = BOARD_HINTS.find((h) => { try { return new URL(h).origin === origin; } catch { return false; } });
  return hint || null;
}

/* 정식 등록 항목에 게시판 원래 제목이 없으면, 같은 글이 실시간 공고로도 수집돼 있는지 보고
   거기서 가져온다. 정식 등록의 name은 사람이 다듬은 이름이라 게시판 행과 안 맞기 때문.
   (제목이 없으면 그 공고는 게시판에서 영영 못 찾는 미아가 된다 — 2026-08-01에 15건이 그랬다) */
function backfillBoardTitles() {
  let n = 0;
  for (const t of targets) {
    if (t.field !== 'sourceUrl' || (t.ref.boardTitle || '').trim()) continue;
    const list = listUrlOf(t.ref[t.field]);
    const mate = (notices.items || []).find((x) => listUrlOf(x.url) === list && sameTitle(markerTitle(t.ref[t.field]) || t.title, x.title));
    if (mate) { t.ref.boardTitle = mate.title; n += 1; }
  }
  return n;
}
const backfilled = backfillBoardTitles();
if (backfilled) report0.push(`- 게시판 원래 제목을 실시간 공고에서 보강: ${backfilled}건`);

/* ── 순찰 대상: **이미 주소가 있는 링크**도 다시 열어 본다 (2026-08-01 개발자 지적) ──
   이 로봇을 만든 목적은 '동국대 고치기'가 아니라 **원문 공고로 못 가는 링크를 계속 찾아
   고치는 것**이다. 그런데 표식(#n-)이 붙은 것만 집어 들고 있었다. 경희대처럼
   '주소는 멀쩡해 보이는데 눌러 보면 로그인 벽'인 경우는 표식이 없어 로봇 눈에 안 띄었다
   — 229건이 그렇게 사각지대에 있었다.
   그래서 순찰 단계를 앞에 둔다: 기존 링크를 돌아가며 열어 보고, 학생이 그 공고를 못 보는
   링크(로그인 벽·다른 글·목록)면 표식으로 되돌려 사냥 대상으로 넘긴다. */
const patrol = [];
for (const n of notices.items || []) {
  if (n.url && !isMarkerUrl(n.url)) patrol.push({ ref: n, field: 'url', title: n.title, key: `n:${n.url}` });
}
for (const r of registered.items || []) {
  if (r.sourceUrl && !isMarkerUrl(r.sourceUrl)) patrol.push({ ref: r, field: 'sourceUrl', title: r.boardTitle || r.name, key: `r:${r.id}`, id: r.id });
}

/* 이미 포기한 건은 건너뛴다 (하지만 리포트에는 남긴다) */
const skipped = [];
const active = targets.filter((t) => {
  const st = state.items[t.key];
  // 영구 포기는 없다 — '아직 다시 볼 날이 안 된 것'만 이번 회차에서 쉰다
  if (st && st.nextTryAt && st.nextTryAt > today) { skipped.push({ t, st }); return false; }
  return true;
});

const boards = new Map();
for (const t of active) {
  const list = listUrlOf(t.ref[t.field]);
  if (ONLY && !list.includes(ONLY)) continue;
  if (!boards.has(list)) boards.set(list, []);
  boards.get(list).push(t);
}

const report = [`## 🎯 링크 사냥꾼 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
report.push(`사냥 대상 **${active.length}건** (게시판 ${boards.size}곳) · 포기 처리된 건 ${skipped.length}건`);
report0.forEach((l) => report.push(l));
report.push('');

/* CHROME_PATH가 있으면 그 브라우저를 쓴다 — 검증 드라이버와 같은 방식(2026-08-20).
   맥에서 세션을 여는 개발자도 이 로봇을 손으로 돌려 볼 수 있어야 한다. CI에서는 비어 있어
   playwright가 알아서 찾으므로 동작이 바뀌지 않는다. */
const browser = await chromium.launch({ args: ['--no-sandbox'],
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  locale: 'ko-KR',
});

/* ── 확인: 로그인도 리퍼러도 없는 새 탭에서 진짜 그 공고가 열리는가 ── */
let verifyCtx = null;
async function freshPage() {
  if (!verifyCtx) {
    verifyCtx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      locale: 'ko-KR',
    });
  }
  await verifyCtx.clearCookies().catch(() => {});
  return verifyCtx.newPage();
}

const fp = (s) => String(s || '').replace(/[\s .,·ㆍ~〜'"“”‘’!?()[\]{}<>:;|/\\_+\-*&#%]/g, '').toLowerCase();
/* 제목 정규화는 **공용 규칙(titleFingerprint)을 그대로 쓴다.**
   여기에 복사본을 두었다가 규칙이 갈라져 크게 손해를 봤다 (2026-08-01):
   복사본은 날짜·조회수를 안 떼서 '…안내 2026.07.30. 조회 104'가 지문에 그대로 남았고,
   상세 화면 본문엔 그런 글자가 없으니 **멀쩡한 주소가 전부 '제목 불일치'로 떨어졌다.**
   규칙은 한 곳에만 둔다 — 이 저장소가 entry-rules·url-key에서 이미 지키는 원칙이다. */
const coreTitle = titleFingerprint;

/* looksLikeList는 detail-url.mjs 한 곳에 있다 — 복사본을 두면 한쪽만 고쳐져
   "사냥꾼은 통과시키는데 복구 로봇은 버리는" 어긋남이 생긴다 (2026-08-20 합침). */

async function verify(url, title, others) {
  const p = await freshPage();
  try {
    const res = await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (res && res.status() >= 400) return { ok: false, why: `HTTP ${res.status()}`, net: true };
    /* 화면에 제목이 그려질 때까지 기다릴 때 쓰는 조각.
       말머리([홍보]·공지)와 앞머리 번호를 떼야 상세 화면 본문과 맞는다 —
       안 떼면 매번 7초를 헛되이 기다린 뒤 판정으로 넘어간다. */
    const probe = String(title)
      .replace(/^\s*\d{1,5}\s+/, '')
      .replace(/\[[^\]]{0,20}\]/g, '')
      .replace(/^\s*(공통|서울|글로벌|국제|공지|홍보|일반)\s+/g, '')
      .trim().slice(0, 12).trim();
    if (probe.length >= 4) {
      await p.waitForFunction((n) => (document.body && document.body.innerText || '').includes(n), probe, { timeout: 7000 }).catch(() => {});
    }
    await p.waitForTimeout(700);
    const text = await p.evaluate(() => (document.body.innerText || '').slice(0, 14000)).catch(() => '');
    /* 로그인 벽이면 제목이 보여도 떨어뜨린다 — 학생은 로그인 없이 링크를 누르므로
       로그인을 요구하는 주소는 그 학생에게 '안 열리는 링크'다 (2026-08-01 개발자 지적) */
    const hasPw = await p.evaluate(() => !!document.querySelector('input[type=password]')).catch(() => false);
    if (looksLikeLoginWall(text, hasPw)) return { ok: false, why: '로그인 요구(학생이 못 봄)' };
    const docTitle = await p.title().catch(() => '');
    const t = coreTitle(title);
    const hit = sameTitle(title, docTitle) || (t.length >= 8 && (fp(text).includes(t) || (t.length >= 24 && fp(text).includes(t.slice(0, 24)))));
    /* ⭐ '못 읽은 것'을 '다른 글'이라고 부르지 않는다 (2026-08-01 정찰로 확인).
       동국대 12건이 전부 '제목 불일치(다른 글이 열림)'로 떨어졌는데, 정찰로 그 주소들을
       직접 열어 보니 **전부 맞는 공고**였다(가송재단·서울인재대학장학금 등 200 응답,
       로그인도 필요 없음). 무슨 일이 있었나: 동국대는 우리가 짧은 시간에 여러 번
       두드리면 응답을 막는다(정찰에서도 주소 3개 뒤 4번째가 연결 끊김). 그때 오는 것은
       404가 아니라 **본문이 안 그려진 껍데기 화면**이고, 로봇은 그걸 보고 '다른 글'이라
       단정해 멀쩡한 주소를 버렸다.
       화면에 글이 거의 없으면 '판정 불가'다 — 판정하지 말고 다음에 다시 본다.
       (저장소가 이미 지키는 원칙: '못 읽음'과 '읽었는데 다른 화면'을 뭉뚱그리지 말 것) */
    if (!hit) {
      // 한 번 더 기다렸다 다시 본다 — 늦게 그려지는 화면을 성급히 '다른 글'로 몰지 않는다
      await p.waitForTimeout(4000);
      const text2 = await p.evaluate(() => (document.body.innerText || '').slice(0, 14000)).catch(() => '');
      const hit2 = t.length >= 8 && (fp(text2).includes(t) || (t.length >= 24 && fp(text2).includes(t.slice(0, 24))));
      if (hit2) return { ok: true };
      // 메뉴만 있고 본문이 없는 화면(막혔을 때 오는 껍데기)이면 판정하지 않는다
      if (!/등록일|작성일|조회수|첨부|담당|이전글|다음글/.test(text2)) {
        return { ok: false, why: '본문이 안 그려짐(판정 불가 — 다음에 다시 봅니다)', net: true };
      }
      return { ok: false, why: '제목 불일치(다른 글이 열림)' };
    }
    if (looksLikeList(text, others)) return { ok: false, why: '목록 화면(다른 공고 제목이 여럿 보임)' };
    return { ok: true };
  } catch (e) {
    return { ok: false, why: (e.message || String(e)).split('\n')[0].slice(0, 56), net: true };
  } finally {
    await p.close().catch(() => {});
  }
}

/* ── 목록 훑기 ── */
const ROW_SEL = 'a[href], [onclick]';
async function scrapeRows(page) {
  return page.$$eval(ROW_SEL, (els) => els.map((e, i) => ({
    i,
    t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
    abs: e.tagName === 'A' ? (e.href || '') : '',
    src: [e.getAttribute('onclick') || '', e.getAttribute('href') || '', e.getAttribute('data-id') || ''].join('|'),
  })).filter((x) => x.t.length >= 6 && x.t.length <= 160)).catch(() => []);
}
async function scrapeForms(page) {
  return page.evaluate(() => [...document.querySelectorAll('form')].slice(0, 4).map((f) => ({
    action: f.getAttribute('action') || '',
    fields: [...f.querySelectorAll('input,select')].map((i) => `${i.name}=${i.value}`).filter((x) => !x.startsWith('=')).slice(0, 16).join('&'),
  }))).catch(() => []);
}
async function gotoPage(page, n) {
  return page.evaluate((num) => {
    const cands = [...document.querySelectorAll('a, button, [onclick]')].filter((e) => (e.textContent || '').trim() === String(num));
    const el = cands.find((e) => /pag|page|num/i.test(e.className + ' ' + ((e.parentElement || {}).className || ''))) || cands[0];
    if (!el) return false;
    el.click();
    return true;
  }, n).catch(() => false);
}


/* ── 1단계: 순찰 ─────────────────────────────────────────────────
   기존 링크를 돌아가며 열어 보고, 학생이 그 공고를 못 보는 링크를 찾아낸다.
   한 번에 다 보지 않고 **오래 안 본 것부터 조금씩** 돈다(학교 서버를 몰아치지 않게).

   되돌리기는 조심스럽게 — 예전에 안전장치가 없어 멀쩡한 링크 17건을 되돌릴 뻔했다:
   · 게시판 목록조차 안 열리면(카나리아) 그 게시판은 통째로 건너뛴다.
   · '못 읽음'(404·시간초과)은 판정할 수 없으니 되돌리지 않는다.
     되돌리는 건 '읽었는데 그 공고가 아니었던 것'(로그인 벽·다른 글·목록)뿐이다.
   · 한 게시판에서 절반 넘게 실패하면 우리 쪽 문제로 보고 아무것도 되돌리지 않는다. */
/* 순찰은 **덤이다** (2026-08-01 개발자 지시로 순서를 바꿈)
   이 로봇의 본업은 '앱에서 원문 공고를 눌렀을 때 그 공고가 안 열리는 링크'를 고치는 것이다.
   멀쩡히 열리는 링크까지 매번 다시 둘러보느라 본업이 밀리면 안 된다.
   그래서 **사냥(2·3단계)을 먼저 끝내고, 시간이 남을 때만** 순찰한다.

   순찰을 아주 없애지는 않았다. '주소는 멀쩡해 보이는데 눌러 보면 로그인 벽/다른 글'인
   링크는 표식이 없어 눈에 띄지 않는데(경희대 7건이 실제로 그랬다 — 개발자가 직접
   "로그인하라고 뜬다"고 알려 주기 전까지 아무도 몰랐다), 그런 건 열어 봐야만 안다.
   0으로 두면 순찰을 완전히 끈다: collector/run-link-hunt.txt 의 `patrol: 0`.

   되돌리기는 조심스럽게 — 예전에 안전장치가 없어 멀쩡한 링크 17건을 되돌릴 뻔했다:
   · 게시판 목록조차 안 열리면(카나리아) 그 게시판은 통째로 건너뛴다.
   · '못 읽음'(404·시간초과)은 판정할 수 없으니 되돌리지 않는다.
   · 한 게시판에서 절반 넘게 실패하면 우리 쪽 문제로 보고 아무것도 되돌리지 않는다. */
const PATROL_PER_RUN = Number(process.env.HUNT_PATROL || runSetting('patrol') || 20);
let patrolled = 0; let demoted = 0;
async function runPatrol() {
  if (!(PATROL_PER_RUN > 0) || outOfTime()) {
    report.push(`_(순찰 생략 — ${outOfTime() ? '사냥에 시간을 다 썼습니다' : '이번 실행은 순찰 끔'})_`);
    report.push('');
    return;
  }
  report.push('## 덤 · 순찰 (멀쩡해 보이는 링크가 정말 그 공고로 가는가)');
  const due = patrol
    .filter((t) => !ONLY || String(t.ref[t.field]).includes(ONLY))
    .sort((a, b) => {
      const A = (state.items[a.key] || {}).patrolledAt || '';
      const B = (state.items[b.key] || {}).patrolledAt || '';
      return A < B ? -1 : A > B ? 1 : 0;          // 오래 안 본 것 먼저
    })
    .slice(0, PATROL_PER_RUN);

  const byBoard = new Map();
  for (const t of due) {
    const host = (() => { try { return new URL(t.ref[t.field]).origin; } catch { return '?'; } })();
    if (!byBoard.has(host)) byBoard.set(host, []);
    byBoard.get(host).push(t);
  }

  for (const [host, group] of byBoard) {
    if (outOfTime()) { report.push('- (시간 상한 — 순찰 나머지는 다음 실행)'); break; }
    const verdicts = [];
    for (const t of group) {
      if (outOfTime()) break;
      patrolled += 1;
      const v = await verify(t.ref[t.field], huntTitle(t), []);
      const st = state.items[t.key] || {};
      st.patrolledAt = today; st.lastWhy = v.ok ? '' : v.why;
      state.items[t.key] = st;
      verdicts.push({ t, v });
      await new Promise((r) => setTimeout(r, 700));
    }
    const fails = verdicts.filter((x) => !x.v.ok);
    const netFails = fails.filter((x) => x.v.net);
    const realFails = fails.filter((x) => !x.v.net);   // 읽었는데 그 공고가 아니었던 것

    // 카나리아 — 이 학교 서버가 지금 우리를 받아 주는가
    let canaryOk = true;
    if (realFails.length) {
      const p = await freshPage();
      try {
        const res = await p.goto(host, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (!res || res.status() >= 400) canaryOk = false;
      } catch { canaryOk = false; } finally { await p.close().catch(() => {}); }
    }
    const tooMany = verdicts.length >= 4 && fails.length / verdicts.length > 0.5;
    report.push(`### ${host}`);
    report.push(`- 순찰 ${verdicts.length}건 · 통과 ${verdicts.length - fails.length} · 못 읽음 ${netFails.length} · **학생이 못 보는 링크 ${realFails.length}**`);

    if (!canaryOk || tooMany) {
      report.push(`- ⏸ 되돌리기 취소 — ${!canaryOk ? '학교 서버가 지금 응답하지 않습니다' : '실패가 너무 많아 우리 쪽 문제로 보입니다'}. 다음 실행에서 다시 봅니다.`);
      continue;
    }
    for (const { t, v } of realFails) {
      const list = boardListFor(t);
      if (!list) { report.push(`  - ⚠️ ${t.id || String(t.title).slice(0, 30)} (${v.why}) — 되돌릴 게시판 주소를 몰라 그대로 둡니다`); continue; }
      const back = (t.ref.boardTitle || '').trim() || String(t.title);
      if (!t.ref.boardTitle) t.ref.boardTitle = back;      // 게시판 원래 제목을 잃지 않게
      if (!DRY) t.ref[t.field] = `${list}#n-${encodeURIComponent(back.slice(0, 40))}`;
      demoted += 1;
      report.push(`  - ↩️ 표식으로 되돌림(${v.why}): ${String(t.title).slice(0, 44)}`);
      // 되돌린 것은 이번 실행의 사냥 대상에 바로 넣는다
      const listKey = list;
      if (!boards.has(listKey)) boards.set(listKey, []);
      boards.get(listKey).push({ ref: t.ref, field: t.field, title: t.title, key: t.key, id: t.id });
    }
  }
  report.push(`- 순찰 합계: ${patrolled}건 확인 · ${demoted}건을 사냥 대상으로 넘김`);
  report.push('');
}

report.push('## 1단계 · 사냥 (원문 공고가 안 열리는 링크 고치기 — 본업)');

function record(t, outcome, why) {
  const st = state.items[t.key] || { attempts: 0, title: String(t.title).slice(0, 80) };
  st.lastTried = today;
  st.lastWhy = why || '';
  if (outcome === 'ok') { st.status = 'resolved'; st.resolvedUrl = t.ref[t.field]; st.attempts = 0; }
  else if (outcome === 'net') { st.lastWhy = why; }          // 못 읽음은 횟수에 안 센다
  else {
    st.attempts = (st.attempts || 0) + 1;
    // 다음에 언제 다시 볼지 — 실패가 쌓일수록 간격을 늘린다 (그래도 계속 본다)
    const wait = BACKOFF_DAYS[Math.min(st.attempts, BACKOFF_DAYS.length - 1)];
    const d = new Date(Date.now() + 9 * 3600000 + wait * 86400000);
    st.nextTryAt = d.toISOString().slice(0, 10);
    st.status = '';                                   // 영구 포기 상태를 두지 않는다
    if (st.attempts === ESCALATE_AT) { st.escalated = true; stuck += 1; }  // 사람에게 한 번 알림
    if (why === '목록에서 못 찾음' && st.attempts >= ESCALATE_AT) st.likelyGone = true;
  }
  state.items[t.key] = st;
}

for (const [listUrl, group] of boards) {
  if (outOfTime()) { report.push('_(시간 상한 — 나머지 게시판은 다음 실행)_'); break; }
  report.push(`### ${listUrl}`);
  const page = await ctx.newPage();
  let opened = false;
  for (let a = 0; a < 3 && !opened; a += 1) {
    try { await page.goto(listUrl, { waitUntil: a >= 2 ? 'commit' : 'domcontentloaded', timeout: a ? 45000 : 30000 }); opened = true; }
    catch (e) { if (a === 2) report.push(`- ❌ 게시판 열기 실패: ${(e.message || '').split('\n')[0].slice(0, 70)}`); else await page.waitForTimeout(3000 * (a + 1)); }
  }
  if (!opened) { await page.close().catch(() => {}); report.push(''); continue; }
  await page.waitForTimeout(3500);
  const forms = await scrapeForms(page);

  /* 페이지를 넘기며, 각 페이지에서 '이 페이지에 있는 대상'을 그 자리에서 처리한다.
     (행 번호는 페이지를 넘기면 달라지므로, 찾은 페이지에서 바로 눌러야 한다) */
  const remaining = new Map(group.map((t) => [t.key, t]));
  for (let pageNo = 1; pageNo <= MAX_PAGES && remaining.size; pageNo += 1) {
    if (pageNo > 1) {
      const moved = await gotoPage(page, pageNo);
      if (!moved) break;
      await page.waitForTimeout(3000);
    }
    let rows = await scrapeRows(page);
    if (!rows.length) break;

    for (const t of [...remaining.values()]) {
      if (outOfTime()) break;
      const want = huntTitle(t);
      const others = rows.map((r) => r.t).filter((x) => !sameTitle(want, x)).slice(0, 40);
      const idx = rows.findIndex((r) => sameTitle(want, r.t));
      if (idx < 0) continue;                       // 이 페이지엔 없다 — 다음 페이지에서 찾는다
      remaining.delete(t.key);

      let url = null; let lastWhy = '';
      /* ⭐ 1순위: 행을 실제로 눌러 브라우저가 간 주소를 받아 적는다 (짐작하지 않는다) */
      try {
        const els = await page.$$(ROW_SEL);
        const el = els[rows[idx].i];
        if (el) {
          const popupP = ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null);
          const navP = page.waitForNavigation({ timeout: 8000 }).catch(() => null);
          /* 클릭이 막히는 게시판이 있다 (2026-08-01 동국대 — 정찰로 확인).
             동국대 목록에는 '디지털 역사관 … 오늘 하루 보지 않기 X' 팝업이 화면을 덮고 있어
             평범한 클릭이 5초를 기다리다 실패했다(진담거사 등이 이 이유로 떨어졌다).
             ① 먼저 팝업을 닫아 보고 ② 그래도 막히면 화면 위치를 따지지 않는 방식으로 누른다.
             (동국대 행은 href가 '#none'이라 '행에 적힌 주소'가 아예 없다 — 반드시 눌러야 한다.) */
          await page.evaluate(() => {
            const hit = [...document.querySelectorAll('a,button,span,div')].filter((e) => {
              const s = (e.textContent || '').trim();
              return s === 'X' || s === '닫기' || /오늘 하루 보지 않기/.test(s);
            });
            hit.slice(0, 6).forEach((e) => { try { e.click(); } catch { /* 무시 */ } });
          }).catch(() => {});
          try {
            await el.click({ timeout: 5000 });
          } catch {
            // 화면이 가려져 못 누르면 요소에게 직접 누르라고 시킨다 (위치를 따지지 않는다)
            await el.evaluate((e) => e.click());
          }
          const popup = await popupP;
          const detail = popup || page;
          if (popup) await popup.waitForLoadState('domcontentloaded').catch(() => {});
          else { await navP; await page.waitForTimeout(2500); }

          const landed = detail.url();
          const dom = await detail.evaluate(() => {
            const hidden = {};
            document.querySelectorAll('input[name]').forEach((i) => { if (i.name && i.value) hidden[i.name] = i.value; });
            const can = document.querySelector('link[rel=canonical]');
            const og = document.querySelector('meta[property="og:url"]');
            return { canonical: can ? can.getAttribute('href') : null, ogUrl: og ? og.getAttribute('content') : null, hiddenInputs: hidden };
          }).catch(() => ({ hiddenInputs: {} }));
          /* 후보 만들기는 **공용 규칙 한 곳**에서만 한다 (detail-url.mjs).
             예전엔 여기에 따로 적어 두었다가 '행에 적힌 주소'를 통째로 빠뜨렸고,
             그래서 동국대 12건이 전부 떨어졌다 — 규칙이 두 벌이면 반드시 갈라진다. */
          const cands = rowDetailCandidates({ row: rows[idx], listUrl, forms, landed, dom });
          for (const c of cands) {
            const v = await verify(c, want, others);
            if (v.ok) { url = c; break; }
            lastWhy = v.why;
            report.push(`    · 탈락(${v.why}) ${c.slice(0, 96)}`);
            /* 404는 '이 주소가 틀렸다'는 뜻이므로 **다음 후보를 시도해야 한다**.
               멈춰야 하는 건 시간초과·연결끊김처럼 '학교 서버에 닿지 못하는' 상황뿐이다.
               예전엔 둘을 뭉뚱그려 404에서도 멈췄고, 그래서 첫 후보가 404면 정답일 수도 있는
               두 번째 후보(경로형)를 아예 안 열어 봤다 — 동국 5건이 이 이유로 실패했다. */
            if (v.net && !/^HTTP /.test(v.why)) break;
          }
          if (popup) await popup.close().catch(() => {});
        }
      } catch (e) {
        lastWhy = `클릭 실패: ${(e.message || '').split('\n')[0].slice(0, 40)}`;
      }
      // 목록으로 복귀 (다음 대상을 같은 페이지에서 계속 찾기 위해)
      if (page.url() !== listUrl) { await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}); await page.waitForTimeout(2000); }
      if (pageNo > 1) { for (let k = 2; k <= pageNo; k += 1) { if (!(await gotoPage(page, k))) break; await page.waitForTimeout(2500); } }
      rows = await scrapeRows(page);

      if (url) {
        if (!DRY) { t.ref[t.field] = url; if (!t.ref.boardTitle) t.ref.boardTitle = want; }
        found += 1;
        record(t, 'ok');
        report.push(`  - ✅ ${want.slice(0, 42)} → ${url.slice(0, 104)}`);
      } else {
        failed += 1;
        /* '못 읽음'으로 셀 것은 **학교 서버에 닿지 못한 경우만**이다.
           HTTP 404는 닿았는데 그 주소가 없다는 뜻이라 판정이 난 것이므로 횟수에 센다.
           안 그러면 404만 나는 공고는 시도 횟수가 영영 안 올라가 escalate가 되지 않고,
           매일 조용히 같은 실패를 반복한다 — '조용한 방치 불가' 설계가 무력해진다. */
        const unreachable = /Timeout|ERR_|net::|클릭 실패/i.test(lastWhy);
        record(t, unreachable ? 'net' : 'bad', lastWhy || '주소를 못 만듦');
        report.push(`  - ⚠️ 실패(${lastWhy || '주소를 못 만듦'}): ${want.slice(0, 42)}`);
      }
      /* 학교 서버를 몰아치지 않는다. 900ms는 동국대에 너무 빨랐다 — 짧은 시간에 여러 번
         두드리자 응답이 막혀 껍데기 화면이 왔고, 로봇은 그걸 '다른 글'로 오해했다.
         대상이 몇 건뿐인 로봇이라 느려도 된다(25분 예산). */
      await new Promise((r) => setTimeout(r, 2500));
    }
  }
  // 모든 페이지를 봐도 못 찾은 것 = 게시판에서 내려갔을 가능성
  for (const t of remaining.values()) {
    failed += 1;
    record(t, 'bad', '목록에서 못 찾음');
    const st = state.items[t.key];
    report.push(`  - ⚠️ 목록에서 못 찾음 (${st.attempts}회째 · 계속 다시 찾습니다): ${huntTitle(t).slice(0, 46)}`);
  }
  await page.close().catch(() => {});
  report.push('');
}


/* ── 3단계 · 끈질기게 (2026-08-01 개발자 지시) ─────────────────────────────
   "다른 수집 로봇이 못 잡은 원문을 어떻게든 찾아서 올려둬라."

   1·2단계는 **그 공고가 기록된 게시판 한 곳**만 뒤진다. 그런데 공고가 거기 없을 수 있다:
   경희대가 그랬다 — 우리는 news.khu.ac.kr을 보는데 학생은 대학생활>장학에서 본다.
   그래서 여기서는 같은 학교의 **다른 게시판**과 **학교 사이트 검색**까지 동원한다.
   사람이 공고를 찾을 때 하는 행동 그대로다. */
const stillLost = [];
for (const [, group] of boards) {
  for (const t of group) {
    const st = state.items[t.key] || {};
    if (st.status === 'resolved') continue;
    if (isMarkerUrl(t.ref[t.field])) stillLost.push(t);
  }
}
let extraFound = 0;
if (stillLost.length && !outOfTime()) {
  report.push('## 3단계 · 끈질기게 (다른 게시판 · 학교 사이트 검색)');
  report.push(`- 아직 못 찾은 ${stillLost.length}건에 대해 다른 방법을 시도합니다`);

  /* 학교 사이트 검색창에 제목을 넣어 결과에서 그 공고를 찾는다 */
  async function siteSearch(origin, title) {
    const p = await freshPage();
    try {
      await p.goto(origin, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await p.waitForTimeout(2000);
      const q = String(title).replace(/^\s*\d{1,5}\s+/, '').replace(/\[[^\]]{0,20}\]/g, '')
        .replace(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}.*$/, '').trim().slice(0, 30);
      if (q.length < 6) return null;
      // 검색창 찾아 입력 (이름이 학교마다 달라 여러 후보를 본다)
      const typed = await p.evaluate((kw) => {
        const sel = 'input[type=search], input[name*=search i], input[name*=keyword i], input[name*=query i], input[name*=kwd i], input[id*=search i], input[placeholder*="검색"]';
        const el = [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null) || document.querySelector(sel);
        if (!el) return false;
        el.focus(); el.value = kw;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }, q).catch(() => false);
      if (!typed) return null;
      await p.keyboard.press('Enter').catch(() => {});
      await p.waitForTimeout(4000);
      // 결과 화면에서 제목이 맞는 링크를 고른다
      const hit = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({
        t: (a.textContent || '').replace(/\s+/g, ' ').trim(), u: a.href,
      })).filter((x) => x.t.length >= 8), []).catch(() => []);
      const match = (hit || []).find((x) => sameTitle(title, x.t) && /^https?:/.test(x.u));
      return match ? match.u : null;
    } catch { return null; } finally { await p.close().catch(() => {}); }
  }

  for (const t of stillLost) {
    if (outOfTime()) { report.push('- (시간 상한 — 나머지는 다음 실행)'); break; }
    const want = huntTitle(t);
    let origin = '';
    try { origin = new URL(t.ref[t.field]).origin; } catch { /* 무시 */ }
    const others = [];
    // ① 같은 학교의 다른 게시판 후보
    for (const h of BOARD_HINTS) {
      try { if (new URL(h).origin === origin && listUrlOf(t.ref[t.field]) !== h) others.push(h); } catch { /* skip */ }
    }
    let got = null; const tried = [];
    for (const board of others.slice(0, 3)) {
      if (outOfTime()) break;
      tried.push(board);
      const p = await freshPage();
      try {
        await p.goto(board, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await p.waitForTimeout(3000);
        const rows = await p.$$eval('a[href]', (els) => els.map((e) => ({
          t: (e.textContent || '').replace(/\s+/g, ' ').trim(), u: e.href,
        })).filter((x) => x.t.length >= 8)).catch(() => []);
        const row = rows.find((r) => sameTitle(want, r.t) && isDetailUrl(r.u, board));
        if (row) { const v = await verify(row.u, want, []); if (v.ok) got = row.u; }
      } catch { /* 다음 후보 */ } finally { await p.close().catch(() => {}); }
      if (got) break;
    }
    // ② 학교 사이트 검색
    if (!got && origin && !outOfTime()) {
      tried.push(`${origin} (사이트 검색)`);
      const u = await siteSearch(origin, want);
      if (u) { const v = await verify(u, want, []); if (v.ok) got = u; }
    }
    if (got) {
      if (!DRY) { t.ref[t.field] = got; if (!t.ref.boardTitle) t.ref.boardTitle = want; }
      extraFound += 1; found += 1;
      record(t, 'ok');
      report.push(`  - ✅ 다른 경로에서 찾음: ${want.slice(0, 40)} → ${got.slice(0, 100)}`);
    } else {
      report.push(`  - ⚠️ 다른 경로에서도 못 찾음 (${tried.length}곳 시도): ${want.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 900));
  }
  report.push(`- 3단계 추가 확보: ${extraFound}건`);
  report.push('');
}

/* 저장·리포트를 한 곳에 모아 둔다 — 정상 종료도, 넘어졌을 때도 **같은 길로** 저장한다.
   (위 onCrash가 이 함수를 부른다. 그래서 중간에 넘어져도 찾아낸 주소는 살아남는다.) */
function saveAll(crashNote) {
  state.updatedAt = today;
  if (!DRY) {
    if (found) {
      fs.writeFileSync(noticesPath, JSON.stringify(notices, null, 1));
      fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1));
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 1));
  }

  if (skipped.length) {
    report.push('### 이번 회차는 쉬는 건 (간격을 두고 다시 시도합니다)');
    skipped.forEach(({ t, st }) => report.push(`- ⏳ ${st.nextTryAt} 에 다시 시도 (${st.attempts || 0}회 실패${st.likelyGone ? ' · 게시판에서 내려간 듯' : ''}) — ${String(t.title).slice(0, 44)} (${st.lastWhy || ''})`));
    report.push('');
  }
  report.push('---');
  if (crashNote) {
    report.push(`🚨 **로봇이 도중에 넘어졌습니다** — 여기까지 찾은 것은 저장했습니다. 넘어진 자리: \`${crashNote}\``);
    report.push('');
  }
  report.push(`원문 주소 확보 **${found}건** · 아직 못 찾음 ${failed}건 · 사람에게 알릴 건 ${stuck}건${DRY ? ' — 모의 실행' : ''}`);
  report.push('');
  report.push('**포기하는 건 없습니다** — 못 찾은 공고는 간격을 늘려 가며(1일→3일→7일→14일→30일) 계속 다시 찾습니다.');
  report.push('');
  report.push('실패해도 앱은 지어내지 않습니다 — 원문 주소를 못 찾은 공고는 "게시판 목록 ↗"으로 정직하게 안내합니다.');
  fs.writeFileSync(new URL('link-hunt-report.md', HERE), report.join('\n'));
  console.log(report.join('\n'));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `found=${found}\nfailed=${failed}\nstuck=${stuck}\n`);
  }
}

/* 본업(사냥)이 끝났다. 시간이 남으면 그때 순찰한다 — 순찰에서 새로 드러난 건은
   이번 실행에서 고치지 않고 **다음 실행의 사냥 대상**이 된다(표식으로 되돌려 놓는다). */
report.push('');
await runPatrol();

await verifyCtx?.close().catch(() => {});
await browser.close();
saveAll(null);
