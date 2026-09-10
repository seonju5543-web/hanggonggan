/* 손짓과 움직임 한 곳 — interactions.js (2026-09-09)

   왜 따로 두나: 개발자 지적 *"인스타그램과 달리 사람냄새가 안나 … 정적이고 ai스럽다."*
   진단해 보니 색은 이미 정리돼 있었고(2026-08-31 팔레트 정리) 눌림·hover·focus 도
   갖춰져 있었다. 비어 있던 것은 **시간과 손짓** 둘이었다 —
   앱 전체의 움직임이 넷뿐이고(목록 등장·카드 반짝임·메뉴 열림·누름 축소),
   당겨서 새로고침도 저장할 때의 손끝 답도 없었다.

   여기 넣는 것은 넷:
     ① 당겨서 새로고침  ② 저장할 때 튕김과 진동
     ③ 마감까지 남은 시간 막대(컨텍스트 바)  ④ 기다리는 동안 보여 줄 뼈대

   🔴 **판정을 새로 만들지 않는다.** 마감 판정은 `app.js` 의 `dday()` 한 곳이고
      이 파일은 그것이 낸 `days` 를 **받아서** 그릴 뿐이다. 여기에 날짜 계산을 한 줄이라도
      옮겨 적으면 카드의 배지와 막대가 서로 다른 말을 하게 된다.
   🔴 **Node 에서도 불러 쓸 수 있어야 한다** — 막대 수치는 브라우저 없이 검사한다
      (match-engine.js 와 같은 방식, 파일 끝 module.exports).
*/

/* ──────────────────────────────────────────────────────────────────────────
   ③ 마감까지 남은 시간 — 컨텍스트 바

   개발자 지시(2026-09-09): *"홈 화면 수정 사안은 컨텍스트 바(밑에 빨간색으로 마감 기간
   알려주는 것)까지만."*

   🔴 **'접수 기간의 몇 %' 로 그리지 않는다.** 그렇게 그리려면 접수 시작일이 필요한데
      등록 공고 46건 중 `openDate` 가 있는 것은 17건뿐이다(실측). 없는 27건에 시작일을
      짐작해 넣으면 그 순간 앱이 지어낸 숫자가 된다(원칙 8-1). 그래서 이 막대가 말하는 것은
      **오직 '마감이 얼마나 가까운가'** 하나이고, 재료는 이미 아는 마감일 하나뿐이다.

   🔴 **문턱은 7일 — `dday()` 가 `urgent` 를 붙이는 바로 그 값이다.** 새 문턱을 만들면
      "배지는 빨간데 막대는 없는" 칸이 생긴다. 여기를 고칠 일이 생기면 `dday()` 를 함께 본다.

   🔴 **시간 단위('6시간 남았어요')는 쓰지 않는다.** 우리가 아는 것은 날짜(`2026-08-31`)뿐이고
      마감 시각이 23:59 인지 18:00 인지는 모른다. 시간을 붙이는 순간 지어내는 것이 된다.
*/
var DEADLINE_WINDOW_DAYS = 7;   // dday() 의 urgent 문턱과 같은 값 — 갈라놓지 말 것

/**
 * 마감 임박 막대의 수치.
 * @param {number} days  dday().days — 오늘부터 마감까지 남은 날짜(음수면 마감)
 * @returns {{show:boolean, pct:number, label:string}}
 *          show=false 면 그리지 않는다(멀거나·마감했거나·마감을 못 읽은 공고).
 */
function deadlineMeter(days) {
  var off = { show: false, pct: 0, label: '' };
  if (typeof days !== 'number' || !isFinite(days)) return off;
  if (days < 0 || days > DEADLINE_WINDOW_DAYS) return off;
  /* 바닥을 6% 둔다 — D-7 에 폭이 0이면 '막대가 안 그려졌다'로 보인다.
     D-7 = 6% · D-DAY = 100% 로 곧게 늘어난다. */
  var ratio = (DEADLINE_WINDOW_DAYS - days) / DEADLINE_WINDOW_DAYS;
  var pct = Math.round(6 + ratio * 94);
  return {
    show: true,
    pct: Math.max(0, Math.min(100, pct)),
    /* 눈이 아니라 소리로 읽는 사람에게 막대는 아무 말도 하지 않는다 — 글로도 적는다 */
    label: days === 0 ? '오늘 마감' : '마감까지 ' + days + '일',
  };
}

/** `2026-08-31` → `8/31`. 못 읽으면 빈 문자열(지어내지 않는다). */
function shortDate(dateStr) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return '';
  return Number(m[2]) + '/' + Number(m[3]);
}

/**
 * 카드에 붙일 막대 HTML. 그릴 것이 없으면 빈 문자열.
 * @param {number} days      dday().days
 * @param {string} deadline  공고의 마감일 문자열(있으면 오른쪽에 날짜를 적는다)
 */
function deadlineMeterHtml(days, deadline) {
  var m = deadlineMeter(days);
  if (!m.show) return '';
  /* 🔴 2026-09-10 페이스리프트: 막대 옆 날짜('9/10 마감')를 **뗐다.**
     카드가 이미 '오늘 마감 / 20일 남음'이라고 글로 말하는데 그 옆에 M/D 를 또 두면
     한 카드가 마감을 두 가지 형식으로 말한다(앱 전체 다섯 형식의 한 축이었다).
     막대는 남은 시간을 **모양**으로만 전한다. 낭독기용 aria-label 은 그대로 남는다.
     shortDate 는 다른 곳(검사·달력)이 쓰므로 지우지 않는다. */
  return '<div class="dl-meter" role="img" aria-label="' + m.label + '">'
    + '<span class="dl-meter-track"><span class="dl-meter-fill" style="width:' + m.pct + '%"></span></span>'
    + '</div>';
}

/* ──────────────────────────────────────────────────────────────────────────
   ② 손끝의 답 — 아주 짧은 진동

   🔴 **없으면 조용히 넘어간다.** iOS 사파리에는 `navigator.vibrate` 가 아예 없고,
      데스크톱에도 없다. 있는지 보지 않고 부르면 그 줄에서 화면이 죽는다.
   🔴 **길게 울리지 않는다.** 10ms 는 '눌렸다'는 감각이고 100ms 는 알림이다.
      여기서 쓰는 것은 앞의 것뿐이다 — 폰이 자꾸 울면 학생은 앱을 지운다.
   ⚠️ 폰 설정에서 진동을 끈 학생에게는 이 호출이 아무 일도 하지 않는다(브라우저가 무시).
      그래서 앱이 따로 켜고 끌 자리를 만들지 않았다 — 폰 설정이 이미 그 자리다. */
function haptic(ms) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(ms || 10);
  } catch (e) { return false; }   // 일부 브라우저는 사용자 조작 밖에서 부르면 예외를 던진다
}

/* 튕김이 끝났다고 보는 시간 — 위 두 움직임(0.42s 튕김 · 0.52s 고리)보다 길어야 한다.
   ⚠️ style.css 의 `save-pop`·`save-ring` 길이를 늘리면 이 값도 같이 늘릴 것. */
var POP_CLEAR_MS = 560;

/** 저장 단추가 눌렸을 때의 튕김 — 클래스는 움직임이 끝나면 스스로 떨어진다. */
function popEl(el) {
  if (!el || !el.classList) return;
  el.classList.remove('pop');
  /* 🔴 지웠다가 바로 붙이면 브라우저가 '안 바뀌었다'고 보고 애니메이션을 다시 안 튼다.
     한 번 강제로 재도록 만든 뒤에 붙인다(연달아 두 번 누르는 학생이 실제로 있다). */
  void el.offsetWidth;
  el.classList.add('pop');
  /* 🔴 **끝나면 스스로 뗀다** (2026-09-09 검사가 잡았다). 안 떼면 다음에 **해제**할 때도
     튕김 표시가 그대로 남아, 화면에서 "담았다"와 "뺐다"가 구분되지 않는다.
     ⚠️ `animationend` 로 떼지 않는 이유: 이 단추에는 움직임이 둘(svg 튕김·고리)이라
        먼저 끝나는 쪽이 클래스를 떼면 나머지 하나가 중간에 잘린다. */
  clearTimeout(el._popTimer);
  el._popTimer = setTimeout(function () { el.classList.remove('pop'); }, POP_CLEAR_MS);
}

/* ──────────────────────────────────────────────────────────────────────────
   ④ 기다리는 동안의 뼈대

   🔴 이건 꾸밈이 아니라 **거짓말을 지우는 일**이다. 지금은 `registeredList` 가 빈 배열로
      시작해서, 공고가 도착하기 전 몇 백 밀리초 동안 홈에
      "지금 신청 가능한 장학금 없음", 탐색에 "조건에 맞는 장학금 없음" 이 뜬다.
      **없는 게 아니라 아직 안 온 것**인데 앱이 없다고 말하고 있었다. */
function skeletonRows(n) {
  var out = '<div class="skel-list" role="status" aria-live="polite">'
    + '<span class="sr-only">공고를 불러오는 중이에요</span>';
  for (var i = 0; i < (n || 3); i++) {
    out += '<div class="skel-row" aria-hidden="true">'
      + '<span class="skel skel-badge"></span>'
      + '<span class="skel skel-title"></span>'
      + '<span class="skel skel-sub"></span>'
      + '</div>';
  }
  return out + '</div>';
}

/* ──────────────────────────────────────────────────────────────────────────
   ① 당겨서 새로고침

   🔴 **`.app` 을 옮기면 안 된다.** 하단 탭·시트·떠 있는 도우미 단추는 전부 `#app` **안**에
      있고 `position: fixed` 다. 조상에 `transform` 이 걸리면 그 셋이 화면이 아니라
      `.app` 을 기준으로 자리를 잡아 — 하단 탭이 화면 아래에 안 붙고 목록과 함께 밀려 올라간다.
      그래서 옮기는 것은 **지금 보이는 `.screen` 하나뿐**이다(고정 요소는 전부 그 바깥에 있다).

   🔴 **시트가 떠 있으면 손대지 않는다.** 알림 동의 시트는 온보딩 2.9초 뒤에 떠서 그때부터
      화면을 덮는데, 그 위에서 당기면 시트 뒤의 목록이 움직여 보인다. 게다가 이 시트는
      브라우저 검사를 세 번이나 넘어뜨린 자리다(2026-09-07). 열려 있으면 아예 시작하지 않는다.

   ⚠️ `touchmove` 는 **passive: false** 로 달아야 `preventDefault()` 가 먹는다.
      기본값(passive)으로 달면 브라우저가 무시하고 화면이 같이 스크롤돼 손이 두 개로 느껴진다.
*/
var PTR_TRIGGER_PX = 64;    // 이만큼 당기면 새로고침
var PTR_MAX_PX = 92;        // 이보다 더 늘어나지 않는다(고무줄 저항)
var PTR_MIN_SPIN_MS = 450;  // 너무 빨리 끝나면 '아무 일도 안 났다'로 보인다

function installPullToRefresh(opts) {
  opts = opts || {};
  var onRefresh = opts.onRefresh;
  var isBlocked = opts.isBlocked || function () { return false; };
  var doc = opts.document || (typeof document !== 'undefined' ? document : null);
  if (!doc || typeof onRefresh !== 'function') return function () {};

  var startY = 0, startX = 0, pulling = false, busy = false, dist = 0;
  var spinner = null;
  var releaseTimer = null;
  /* 🔴 **당기기 시작한 화면을 붙잡아 둔다.** 그때그때 `.screen:not([hidden])` 을 물으면,
     당기는 도중에 화면이 바뀌었을 때 되돌리기가 **새 화면**에 걸리고 **옛 화면은 내려간 채
     굳는다** — 그 탭으로 돌아가면 목록이 삐뚤어져 있다. */
  var held = null;

  function screenEl() { return doc.querySelector('.screen:not([hidden])'); }

  function ensureSpinner() {
    if (spinner && spinner.isConnected) return spinner;
    spinner = doc.createElement('div');
    spinner.className = 'ptr';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.innerHTML = '<span class="ptr-ring"></span>';
    /* 🔴 `#app` 이 아니라 `body` 에 붙인다 — `#app` 안에 두면 위에서 말한
       transform 문제를 그대로 다시 만든다. */
    doc.body.appendChild(spinner);
    return spinner;
  }

  function setPull(px) {
    var el = held;
    if (el) el.style.transform = px ? 'translateY(' + px + 'px)' : '';
    var s = ensureSpinner();
    s.style.transform = 'translateX(-50%) translateY(' + Math.min(px, PTR_MAX_PX) + 'px)';
    s.style.opacity = String(Math.min(1, px / PTR_TRIGGER_PX));
    s.classList.toggle('ready', px >= PTR_TRIGGER_PX);
  }

  function release() {
    var el = held;
    if (el) { el.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1)'; el.style.transform = ''; }
    var s = ensureSpinner();
    s.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.2s';
    s.style.transform = 'translateX(-50%) translateY(0)';
    s.style.opacity = '0';
    s.classList.remove('ready', 'spin');
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(function () {
      if (el) el.style.transition = '';
      s.style.transition = '';
      /* 🔴 **새 당김이 시작됐으면 놓지 않는다** (2026-09-09 코드 리뷰가 잡았다).
         그냥 null 로 만들면, 300ms 안에 두 번 당겼을 때 이 타이머가 **두 번째 당김이
         붙잡아 둔 화면**을 지워 버려 그 화면이 내려간 채 영영 굳는다(재현됨).
         `onStart` 가 이 타이머를 끄고, 여기서도 한 번 더 확인한다. */
      if (!busy && !pulling) held = null;
    }, 300);
  }

  function onStart(e) {
    if (busy || isBlocked()) return;
    if (!e.touches || e.touches.length !== 1) return;          // 두 손가락은 확대·이동이다
    if ((window.scrollY || window.pageYOffset || 0) > 0) return; // 맨 위에서만 시작한다
    var t = e.target;
    /* 🔴 **끌어서 옮기는 마스코트(도우미 단추)에서 시작한 손짓은 우리 것이 아니다**
       (2026-09-09 코드 리뷰가 잡았다). 그 단추는 pointer 이벤트로 자기 위치를 옮기는데,
       document 의 touchmove 는 그대로 흘러와서 **마스코트를 아래로 끌면 화면 전체가
       같이 내려왔다**. 128px 넘게 끌면 원치 않은 새로고침과 진동까지 갔다(재현됨). */
    if (t && t.closest && t.closest('input, textarea, select, .sheet, .ptr, .chat-fab, #btn-chat-fab')) return;
    held = screenEl();
    if (!held) return;
    clearTimeout(releaseTimer);      // 앞 당김의 되돌리기 타이머가 이 화면을 놓지 못하게
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    pulling = true;
    dist = 0;
  }

  function onMove(e) {
    if (!pulling || busy) return;
    var dy = e.touches[0].clientY - startY;
    /* 🔴 **가로로 미는 손짓은 넘겨준다** — 신청 내역의 '밀어서 지우기'(.swipe-row)와
       같은 손가락을 두고 다투면 둘 다 어중간해진다. 세로가 더 클 때만 우리가 맡는다. */
    if (Math.abs(e.touches[0].clientX - startX) > Math.abs(dy)) {
      if (dist > 0) release();
      pulling = false; dist = 0;
      return;
    }
    if (dy <= 0) {                       // 위로 밀면 평범한 스크롤이다 — 손을 뗀다
      if (dist > 0) { release(); }
      pulling = false; dist = 0;
      return;
    }
    /* 고무줄 저항 — 당길수록 덜 따라온다. 그냥 1:1 로 따라오면 화면이 통째로 떠 버린다. */
    dist = Math.min(PTR_MAX_PX, dy * 0.5);
    if (dist > 6) e.preventDefault();    // 여기서만 브라우저 스크롤을 막는다
    setPull(dist);
  }

  function onEnd() {
    if (!pulling || busy) { pulling = false; return; }
    pulling = false;
    if (dist < PTR_TRIGGER_PX) { if (dist > 0) release(); dist = 0; return; }

    busy = true;
    haptic(12);
    var s = ensureSpinner();
    s.classList.remove('ready');   // 'ready' 의 확대가 남으면 회전이 아니라 크기가 출렁인다
    s.classList.add('spin');
    setPull(PTR_TRIGGER_PX);
    var startedAt = Date.now();
    /* 🔴 `onRefresh` 가 넘어져도 **반드시 원래대로 돌아온다.** 안 그러면 화면이
       내려간 채 굳어 학생이 앱을 껐다 켜야 한다. */
    Promise.resolve().then(onRefresh).catch(function () {})
      .then(function () {
        var wait = Math.max(0, PTR_MIN_SPIN_MS - (Date.now() - startedAt));
        setTimeout(function () { busy = false; dist = 0; release(); }, wait);
      });
  }

  doc.addEventListener('touchstart', onStart, { passive: true });
  doc.addEventListener('touchmove', onMove, { passive: false });
  doc.addEventListener('touchend', onEnd, { passive: true });
  doc.addEventListener('touchcancel', onEnd, { passive: true });

  return function uninstall() {
    doc.removeEventListener('touchstart', onStart);
    doc.removeEventListener('touchmove', onMove);
    doc.removeEventListener('touchend', onEnd);
    doc.removeEventListener('touchcancel', onEnd);
    if (spinner && spinner.parentNode) spinner.parentNode.removeChild(spinner);
  };
}

/* Node(검증 스크립트)에서도 같은 규칙을 불러 쓸 수 있게 — 브라우저에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    deadlineMeter, deadlineMeterHtml, shortDate, skeletonRows,
    haptic, popEl, installPullToRefresh,
    DEADLINE_WINDOW_DAYS, PTR_TRIGGER_PX, PTR_MAX_PX, PTR_MIN_SPIN_MS, POP_CLEAR_MS,
  };
}
