/* 이어보기 장부 — '다시 열면 어디로 가는가'를 정하는 단 한 곳 (2026-09-09)
   설계: docs/designs/first-run-and-resume.md

   개발자 지시 둘을 함께 지킨다:
   ① "잠깐 다른 화면으로 이탈했다가 최근 앱 목록에서 다시 열면 작업하던 화면 그대로"
   ② "장시간 나갔다가 들어온 경우 해당 프로그레스가 저장되어 있었으면"

   그래서 **창(시간)이 정하는 것은 '어디로 가는가'뿐이고, '무엇을 잃는가'는 아니다.**
   창 안이면 하던 화면째 돌아가고, 창을 넘기면 홈으로 가되 쓰던 신청서·온보딩은
   그대로 남아 홈의 '이어서 쓰기' 줄로 되살아난다. 어느 쪽이든 학생이 친 글자는 안 버린다.

   🔴 이 장부는 **`handaejang.v1`(프로필·신청내역)과 다른 열쇠에 둔다.** 저쪽은 로그인하면
      서버로 올라가는 값이고 이건 이 기기의 화면 상태다. 게다가 여기엔 **학생이 신청서에
      쓴 글**이 들어가므로 `syncSafeProfile()` 이 나르는 자리에 섞이면 안 된다.
      (app.js:2958 이 이미 같은 이유로 같은 선택을 해 뒀다. 검사: verify/verify-resume.js)

   🔴 판정(`resumeDecide`)은 **순수 함수**다 — 브라우저 없이 Node 에서 검사한다
      (verify/test-collector.mjs '이어보기' 절). 규칙을 화면 코드에 흩어 두면 갈라진다. */

/* '잠깐'의 길이. 증명서를 떼러 갔다 오는 것(10~30분)과 수업을 듣고 오는 것(1~3시간)은
   담고, 밤을 넘기는 것은 안 담는 선이다. 아침에 앱을 여는 학생이 보고 싶은 것은
   어젯밤 화면이 아니라 '오늘 뭐 있지'라서 홈이 맞다.
   🔴 값을 바꾸려면 여기 한 곳만 고친다. 여러 곳에 적으면 그때부터 못 바꾼다. */
var RESUME_WINDOW_MS = 4 * 60 * 60 * 1000;      // 4시간
/* 쓰던 것을 버리는 시점. 창과 **다른 값**이다 — 창은 '어디로 가는가', 이건 '언제 버리는가'. */
var RESUME_KEEP_MS = 7 * 24 * 60 * 60 * 1000;   // 7일
var RESUME_KEY = 'handaejang.resume';
var RESUME_TABS = ['home', 'explore', 'applications', 'my'];

/* 알림·로그인 복귀로 열렸는가 — 그러면 이어보기가 **처음부터 손을 뗀다**.
   🔴 나중에 덮으면 안 된다: notify.js 의 `notifyHandleLaunch()` 는 시작 1.6초 뒤에 도는데,
      이어보기가 먼저 그리면 학생 눈앞에서 화면이 두 번 바뀐다. */
function resumeHijacked(search, hash) {
  var s = String(search || '');
  var h = String(hash || '');
  if (/[?&](sch|screen)=/.test(s)) return true;
  return /access_token=|refresh_token=|[?&]code=|type=recovery/.test(h + s);
}

function resumeIsTab(name) { return RESUME_TABS.indexOf(name) >= 0; }

/* 저장된 장부가 쓸 만한가 — 손상됐거나 옛 판이면 없는 것으로 친다 */
function resumeValid(saved) {
  return !!(saved && typeof saved === 'object' && saved.v === 1 && typeof saved.at === 'number');
}

/* 진행 중이던 작업이 아직 살아 있는가 (창이 아니라 **보관 기한**으로 본다) */
function resumeProgressAlive(prog, now) {
  if (!prog || typeof prog.at !== 'number') return false;
  var age = now - prog.at;
  return age >= 0 && age <= RESUME_KEEP_MS;
}

/* ── 다시 열었을 때 어디로 갈 것인가 ──────────────────────────────────────
   opts = { saved, now, search, hash, hasProfile }
   돌려주는 것:
     skip      … 이어보기가 손을 뗀다(알림·로그인 복귀). 부르는 쪽이 제 흐름을 그대로 탄다
     screen    … 열 화면
     sheet     … 다시 열 공고 id (없으면 null). 🔴 판정은 그릴 때 새로 한다
     form      … 되살릴 신청서 진행분 (없으면 null)
     onboard   … 되살릴 온보딩 진행분 (없으면 null)
     scroll    … 그 화면에서 되살릴 스크롤
     resumeCard… 홈에 '이어서 쓰기' 줄을 놓을 진행분 (없으면 null)
     fresh     … 창 안이었나 (설명·검사용) */
function resumeDecide(opts) {
  var o = opts || {};
  var now = typeof o.now === 'number' ? o.now : Date.now();
  var saved = resumeValid(o.saved) ? o.saved : null;
  var out = {
    skip: false, screen: 'home', sheet: null, form: null, onboard: null,
    scroll: 0, resumeCard: null, fresh: false,
  };

  if (resumeHijacked(o.search, o.hash)) { out.skip = true; return out; }

  /* 프로필이 없으면 온보딩이다. 쓰다 만 온보딩은 **창과 상관없이** 되살린다 —
     학교·학년을 다시 치게 만드는 것이 이 앱에서 가장 큰 손실이다. */
  if (!o.hasProfile) {
    out.screen = 'onboarding';
    if (saved && resumeProgressAlive(saved.onboard, now)) out.onboard = saved.onboard;
    return out;
  }

  if (!saved) return out;

  var elapsed = now - saved.at;
  /* 시계가 뒤로 간 경우(폰 시각 변경·표준시)는 '방금'으로 친다 — 음수로 두면
     창 판정이 늘 참이 되거나 늘 거짓이 되는 쪽으로 쏠린다. */
  out.fresh = elapsed >= 0 && elapsed <= RESUME_WINDOW_MS;

  var prog = resumeProgressAlive(saved.form, now) ? saved.form : null;

  if (out.fresh) {
    out.screen = resumeIsTab(saved.screen) ? saved.screen : 'home';
    out.scroll = (saved.scroll && saved.scroll[out.screen]) || 0;
    out.sheet = (saved.sheet && saved.sheet.id) || null;
    /* 시트가 신청서였으면 그 신청서를 이어서 연다 — 공고 상세보다 이쪽이 우선이다 */
    if (prog && saved.sheet && saved.sheet.kind === 'form') { out.form = prog; out.sheet = null; }
    else if (prog) out.resumeCard = prog;   // 다른 화면에 있었어도 쓰던 것은 알려 준다
    return out;
  }

  /* 창을 넘겼다 — 홈으로 간다. 하지만 **쓰던 것은 안 버린다**(개발자 지시 ②). */
  out.screen = 'home';
  if (prog) out.resumeCard = prog;
  return out;
}

/* ── 저장·읽기 (브라우저에서만) ──────────────────────────────────────── */
function resumeLoad() {
  try {
    var raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    var v = JSON.parse(raw);
    return resumeValid(v) ? v : null;
  } catch (e) { return null; }   // 손상됐으면 없는 것으로
}

/* patch 의 칸만 덮어쓴다. `at`(마지막으로 본 시각)은 늘 지금으로 찍는다 —
   그게 창 판정의 기준이다. */
function resumeSave(patch) {
  try {
    var cur = resumeLoad() || { v: 1, scroll: {} };
    var next = Object.assign({}, cur, patch || {}, { v: 1, at: Date.now() });
    if (!next.scroll || typeof next.scroll !== 'object') next.scroll = {};
    localStorage.setItem(RESUME_KEY, JSON.stringify(next));
    return next;
  } catch (e) { return null; }   /* 저장 공간이 꽉 찼어도 앱은 그대로 돈다 */
}

function resumeSaveScroll(screen, y) {
  if (!resumeIsTab(screen)) return;
  var cur = resumeLoad() || { v: 1, scroll: {} };
  var scroll = Object.assign({}, cur.scroll || {});
  scroll[screen] = Math.max(0, Math.round(y || 0));
  resumeSave({ scroll: scroll });
}

function resumeClear() {
  try { localStorage.removeItem(RESUME_KEY); } catch (e) { /* 무시 */ }
}

/* Node 에서도 판정을 검사할 수 있게 (match-engine.js·parse-amount.js 와 같은 방식) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    RESUME_WINDOW_MS: RESUME_WINDOW_MS,
    RESUME_KEEP_MS: RESUME_KEEP_MS,
    RESUME_KEY: RESUME_KEY,
    RESUME_TABS: RESUME_TABS,
    resumeDecide: resumeDecide,
    resumeHijacked: resumeHijacked,
    resumeProgressAlive: resumeProgressAlive,
    resumeValid: resumeValid,
  };
}
