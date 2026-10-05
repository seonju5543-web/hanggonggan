/* 부팅 화면 — 앱 코드가 다 실릴 때까지 덮어 두는 한 장 (2026-09-09)
   설계: docs/designs/first-run-and-resume.md

   왜 있나 (2026-09-09 실측):
   `index.html` 에서 `hidden` 이 없는 화면이 **환영 화면 하나뿐**이라, 앱 코드가 도착해
   `showScreen()` 을 부를 때까지 그게 화면이었다. app.js 를 2.5초 늦추자 이미 프로필이 있는
   학생에게 그 2.5초 내내 '한대장 / 시작하기'가 떠 있었다 — **최초 실행에만 떠야 할 화면이
   매 실행 떠 있던 것**이다. 게다가 시작 중에 무엇이든 잘못되면 화면을 정하는 줄(app.js 맨 끝)에
   닿지 못해 학생이 거기 갇혔다. 눌렀으면 온보딩을 처음부터 다시 했을 것이다.

   🔴 **이 파일은 다른 열일곱 개 스크립트보다 먼저 실려야 한다.** 뒤에 두면 그 사이가
      그대로 빈다 — 그게 이 파일이 없애려는 바로 그 틈이다.
   🔴 **인라인 `<script>` 로 옮기지 말 것.** 이 앱의 CSP 는 `script-src 'self'` 라 인라인을
      막는다. 오류도 안 나고 조용히 아무 일도 안 일어난다. 반드시 파일이어야 한다. */
(function () {
  var BOOT_TIMEOUT_MS = 6000;
  /* 🔴 **인트로는 켤 때마다 한 번** (2026-10-04 개발자 지시: "선이 그려지는 에니메이션 -> 페이드아웃 효과 전체로 통일").
     학사모 선이 그려지고 → 금색 점 → '한대장' → 정지 → 페이드. 이 값은 인트로가 **돌기 시작한 뒤** 보여 주는 최소 시간
     — 등장(1.35초) + 다 그려진 로고의 정지(0.35초). 이게 1초 바닥값(2026-09-09)을 대신한다: 인트로가 늘 이보다 길다.
     ⚠️ 이 값을 고치면 시안 둘(docs/designs/mockups/first-run/Boot.dc.html · Main.dc.html)도 같이 — 관문이 대조한다. */
  var BOOT_INTRO_SHOW_MS = 1700;
  /* 🔴 **인트로는 앱이 다 그려지고 손이 빈 뒤에야 돈다** (2026-10-04 개발자 지적: "중간에 끊기고 프로페셔널하지 못해").
     실측(폰 정도 CPU · 4배 느리게): 인트로를 스크립트가 실리는 동안 돌렸더니 6초 동안 프레임이 20장뿐이었고
     1.6초씩 멈췄다 — 자격 판정 엔진이 홈을 그리는 일(section-head·match-engine)이 같은 줄(메인 스레드)을 쓴다.
     선을 그리는 움직임(stroke-dashoffset)은 그 줄이 비어야 움직인다. 그래서 순서를 바꿨다:
       ① 앱이 화면을 정할 때까지는 빈 덮개(시스템 스플래시와 같은 색이라 이음매가 없다)
       ② 앱이 다 됐다고 알리면(bootDone) → 글꼴이 준비되고 → 프레임이 고르게 흐르는 것(손이 빈 것)을 확인하고
       ③ 그때 인트로를 돌린다 → 최소 시간 뒤 페이드.
     '손이 빈 것'은 프레임 간격으로 잰다 — iOS 사파리에는 긴 작업을 알려 주는 기능(longtask)이 없다. */
  var BOOT_FONT_WAIT_MS = 700;      // 글꼴을 기다리는 천장 — 늦으면 대체 글꼴로라도 돈다
  var BOOT_QUIET_FRAMES = 8;        // 이만큼 연달아 고른 프레임이면 손이 빈 것으로 본다(약 0.13초)
  var BOOT_QUIET_GAP_MS = 34;       // 고른 프레임 = 앞 프레임과 이 안쪽 간격(60fps 두 장 사이)
  var BOOT_QUIET_MAX_MS = 1500;     // 그래도 이보다 오래 기다리지 않는다 — 기다리는 화면을 만들지 않는다
  /* 🔴 앱은 bootDone 에 '처음 데이터가 다 와서 한 번 그렸다'는 약속을 건넨다(app.js `bootSettled`).
     실측: 데이터 일곱 개가 올 때마다 홈을 다시 그리느라 0.4~1.8초짜리 멈춤이 여섯 번 — 프레임 간격만 보면
     파일이 오는 틈(네트워크를 기다리는 동안은 한가하다)을 '손이 빈 것'으로 잘못 읽고 인트로를 시작했다.
     그래서 먼저 그 약속을 기다리고, 그다음 프레임을 본다. 늦은 네트워크에는 천장이 있다. */
  var BOOT_SETTLE_MAX_MS = 2500;

  /* ① 브라우저의 스크롤 되살리기를 끈다.
     🔴 안 끄면 브라우저가 **이전 화면의 스크롤을 다른 화면에 붙인다** — 탐색 탭에서
        나갔다 들어오면 홈인데 282px 내려가 있었다(실측). 우리가 화면별로 되살린다. */
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* 무시 */ }

  /* ② 처음 켠 사람인가 — 값을 읽지 않고 **있나 없나만** 본다(빠르게, 그림 하나 고르려고) */
  var first = true;
  try {
    var raw = localStorage.getItem('handaejang.v1')
      || localStorage.getItem('hanjang.v2') || localStorage.getItem('hanjang.v1');
    first = !(raw && JSON.parse(raw).profile);
  } catch (e) { /* 못 읽으면 처음 켠 것으로 본다 — 온보딩은 되돌릴 수 있고 그 반대는 아니다 */ }
  document.documentElement.setAttribute('data-boot', first ? 'first' : 'return');

  var bootEl = document.getElementById('boot');
  var introRunAt = 0;
  var introSkip = false;
  var appReady = false;
  var pending = null;

  /* 글꼴 준비 — 앱 코드가 실리는 동안 미리 기다려 둔다(그 사이에 대개 끝난다) */
  var fontReady = false;
  var markFont = function () { fontReady = true; };
  try {
    if (document.fonts && document.fonts.load) document.fonts.load('800 38px "Pretendard Variable"', '한대장').then(markFont, markFont);
    else markFont();
  } catch (e) { markFont(); }
  setTimeout(markFont, BOOT_FONT_WAIT_MS);

  /* 프레임이 고르게 흐를 때까지 기다렸다 부른다(천장 있음) */
  function whenQuiet(cb) {
    var good = 0, last = 0, since = Date.now();
    var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var step = function (t) {
      if (last) good = (t - last) < BOOT_QUIET_GAP_MS ? good + 1 : 0;
      last = t;
      if ((good >= BOOT_QUIET_FRAMES && fontReady) || Date.now() - since > BOOT_QUIET_MAX_MS) cb();
      else raf(step);
    };
    raf(step);
  }

  function runIntro() {
    if (introRunAt || !bootEl) return;
    introRunAt = Date.now();
    bootEl.classList.add('boot-intro-run');
    pending = setTimeout(fadeOut, introSkip ? 0 : BOOT_INTRO_SHOW_MS);
  }

  /* 화면을 누르면 — 인트로 중이면 남은 시간을 건너뛰고 걷는다. 앱이 아직이면 준비되는 대로 곧바로 걷는다. */
  if (bootEl) bootEl.addEventListener('pointerdown', function () {
    introSkip = true;
    if (introRunAt && pending) { clearTimeout(pending); fadeOut(); }
  });

  /* ③ 시한 — 무슨 일이 있어도 부팅 화면은 걷힌다.
     앱 코드가 끝내 안 오면 '시작하기'를 남기지 않고 **무슨 일인지 말하고 다시 시도**하게 한다.
     여기서 온보딩을 보여 주면 이미 쓰던 학생이 프로필을 다시 만들게 된다. */
  var timer = setTimeout(function () {
    if (document.documentElement.getAttribute('data-boot') === 'done') return;
    var el = document.getElementById('boot');
    if (!el) return;
    var msg = document.getElementById('boot-fail');
    if (msg) msg.hidden = false;
    var spin = document.getElementById('boot-spin');
    if (spin) spin.hidden = true;
    /* 🔴 '다시 시도' 는 **여기서** 배선한다. index.html 에 `onclick="location.reload()"` 로
       두었더니 CSP(`script-src 'self'`)가 인라인 처리기를 막아 **눌러도 아무 일도 안 일어났다**
       (2026-09-09 브라우저로 확인 — "Refused to execute inline event handler").
       오류도 화면에 안 나므로, 앱이 안 오는 학생은 죽은 버튼 앞에 갇힌다. */
    var retry = document.getElementById('boot-retry');
    if (retry) retry.addEventListener('click', function () { location.reload(); });
  }, BOOT_TIMEOUT_MS);

  /* 앱이 화면을 정했다고 알려 오면(app.js 가 부른다) — 손이 빌 때를 기다려 인트로를 돌린다.
     눌러서 건너뛰기로 했으면 인트로 없이 곧바로 걷는다. */
  window.bootDone = function (settled) {
    clearTimeout(timer);
    if (appReady || document.documentElement.getAttribute('data-boot') === 'done') return;
    appReady = true;
    if (introSkip) { fadeOut(); return; }
    var went = false;
    var go = function () { if (went) return; went = true; whenQuiet(runIntro); };
    setTimeout(go, BOOT_SETTLE_MAX_MS);
    if (settled && settled.then) settled.then(go, go); else go();
  };

  /* 걷힘 — **페이드**(2026-10-04 개발자 결정). 로고와 글자가 살짝 커지며 흐려지고 덮개가 투명해지는 동안,
     밑에 이미 그려진 앱 화면이 드러난다. 모양·길이는 style.css '걷힘 움직임' 절에 있고 여기는 단계를 넘기기만 한다.
     🔴 시간은 CSS 에서 읽는다 — 숫자를 여기 적으면 CSS 를 고칠 때 조용히 어긋난다.
        움직임 줄이기 기기에서는 CSS 가 0 을 주므로 곧바로 사라진다. */
  function fadeOut() {
    if (document.documentElement.getAttribute('data-boot') === 'done') return;
    pending = null;
    document.documentElement.setAttribute('data-boot', 'done');
    var el = document.getElementById('boot');
    if (!el) return;
    var v = String(getComputedStyle(el).getPropertyValue('--boot-fade') || '').trim();
    var n = parseFloat(v) || 0;
    /* 초 단위(`0.4s`)만 1000배 한다. ⚠️ 단위 없는 값은 ms 로 본다 — 못 읽으면(`''`) 0 이라 곧바로 걷힌다. */
    var fadeMs = /[^m]s$/.test(v) ? n * 1000 : n;
    el.classList.add('boot-fade');
    /* 걷히기 시작했다고 앱에 알린다 — 시작 화면의 정문 투어링(app.js startMontage)이 이 순간에
       첫 사진을 스며들게 한다(덮개 밑에서 먼저 돌면 학생이 첫 장면을 못 본다). */
    try { window.dispatchEvent(new Event('boot:open')); } catch (e) { /* 아주 옛 브라우저 — 투어링은 안 돌고 화면은 뜬다 */ }
    setTimeout(function () {
      el.hidden = true;
      /* 덮개가 다 걷혔다 — 앱이 모아 둔 다시 그리기를 푼다(app.js `bootHoldRelease` · 늦게 온 데이터) */
      try { window.dispatchEvent(new Event('boot:gone')); } catch (e) { /* 옛 브라우저 — 앱은 데이터가 다 오면 스스로 푼다 */ }
    }, fadeMs + 20);
  }
})();
