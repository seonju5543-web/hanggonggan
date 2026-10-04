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
  /* 🔴 **최소로 보여 주는 시간 = 1초** (2026-09-09 개발자 지시: "페이드까지 포함하면 최소
     1초는 머물러 있어야 하는데 아주 잠깐 표시되고 사라져"). 그 뒤에 걷힘(페이드 0.4초 —
     style.css `--boot-fade`)이 붙는다. 눈에 '깜빡였다'가 아니라 '봤다'로 남는 길이다.
     인트로가 뜨는 날은 이 값 대신 아래 `BOOT_INTRO_SHOW_MS` 를 쓴다.
     바닥값이 없던 시절에는 떠 있는 시간이 **앱 코드가 실리는 데 걸린 시간 그대로**여서,
     캐시가 데워진 폰에서는 눈에 안 보일 만큼 짧았다(개발자가 그걸 겪고 지적했다).
     ⚠️ 이 값을 고치면 시안(docs/designs/mockups/first-run/Main.dc.html)도 **같이** 고쳐야 한다.
        관문이 둘을 대조해 갈라지면 빨간불을 낸다. */
  var BOOT_MIN_SHOW_MS = 1000;
  /* 🔴 세는 시작점은 **이 파일이 실린 때**다 — 부팅 화면이 화면에 그려지는 시점과 가장 가깝다
     (HTML 과 CSS 를 다 읽은 뒤에야 이 스크립트가 돈다).
     ⚠️ `performance.now()`(페이지가 열린 시각)로 재지 말 것 — 한 번 열어 둔 문서를 다시 쓰는
        경우(뒤로가기 캐시·설치형 앱의 재개)에는 그 값이 이미 커져 있어서 **기다림이 0이 되고
        부팅 화면이 깜빡이고 만다.** 여기서는 늘 0부터 시작하는 값이 안전하다. */
  var startedAt = Date.now();
  var sinceShown = function () { return Date.now() - startedAt; };

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

  /* ②-1 인트로를 보일 차례인가 (2026-10-04 개발자 결정: "둘 다 페이드, 4시간 기준, 태그라인 빼고").
     **오늘 처음 열었거나 마지막으로 본 뒤 4시간이 넘었으면** 학사모 선이 그려지는 인트로,
     아니면 지금까지의 조용한 부팅이다. 하루에 여러 번 여는 학생이 매번 긴 화면을 보지 않게 하려는 구분.
     '마지막으로 본 시각'은 이어보기 장부(resume.js `handaejang.resume` 의 `at`)를 그대로 읽는다 —
     창 판정과 같은 시각이라야 '홈으로 간다'와 '인트로가 뜬다'가 같은 순간에 바뀐다.
     🔴 4시간은 resume.js `RESUME_WINDOW_MS` 와 **같은 값**이어야 한다. 이 파일은 다른 스크립트보다
        먼저 실려 그 값을 불러 쓸 수 없어 여기 한 번 더 적는다 — 관문(test-collector '첫 실행 화면')이
        둘을 대조해 갈라지면 빨간불을 낸다.
     처음 켠 학생은 인트로 대상이 아니다 — 그 학생에게는 온보딩 0단계(정문 투어링)가 먼저다. */
  var BOOT_INTRO_GAP_MS = 4 * 60 * 60 * 1000;
  /* 인트로를 보여 주는 최소 시간 — 등장(1.35초) + 다 그려진 로고의 정지(0.35초).
     🔴 세는 시작점은 인트로가 **실제로 돌기 시작한 때**다(글꼴을 기다린 뒤). 스크립트가 실린 때부터
        세면 글꼴이 늦은 날 '한대장' 글자가 뜨기도 전에 앱으로 넘어간다(2026-10-04 개발자가 시안에서 지적).
     ⚠️ 이 값을 고치면 시안(docs/designs/mockups/first-run/Intro.dc.html)도 같이 — 관문이 대조한다. */
  var BOOT_INTRO_SHOW_MS = 1700;
  /* 글꼴을 기다리는 천장. 이보다 늦으면 대체 글꼴로라도 돈다 — 기다리는 화면을 만들지 않는다. */
  var BOOT_FONT_WAIT_MS = 700;
  var intro = false;
  if (!first) {
    try {
      var rs = JSON.parse(localStorage.getItem('handaejang.resume') || 'null');
      var lastAt = rs && typeof rs.at === 'number' ? rs.at : 0;
      var nowAt = Date.now();
      /* 장부가 없거나 · 시계가 뒤로 갔거나(resume.js 와 같은 판단) · 4시간이 넘었거나 · 날짜가 바뀌었으면 */
      intro = !lastAt || nowAt < lastAt || nowAt - lastAt > BOOT_INTRO_GAP_MS
        || new Date(lastAt).toDateString() !== new Date(nowAt).toDateString();
    } catch (e) { intro = false; /* 못 읽으면 조용한 부팅 — 인트로는 덤이다 */ }
  }
  var introRunAt = 0;
  var introSkip = false;
  var bootEl = document.getElementById('boot');
  if (intro && bootEl) {
    bootEl.classList.add('boot-intro');
    var runIntro = function () {
      if (introRunAt) return;
      introRunAt = Date.now();
      bootEl.classList.add('boot-intro-run');
    };
    /* 🔴 글꼴이 준비된 뒤에 돈다 — 안 기다리면 '한대장' 이 보이지 않는 채로 움직임이 끝난다. */
    try {
      if (document.fonts && document.fonts.load) document.fonts.load('800 38px "Pretendard Variable"', '한대장').then(runIntro, runIntro);
      else runIntro();
    } catch (e) { runIntro(); }
    setTimeout(runIntro, BOOT_FONT_WAIT_MS);
    /* 화면을 누르면 앱이 준비되는 대로 곧바로 넘어간다 */
    bootEl.addEventListener('pointerdown', function () { introSkip = true; if (window.bootSkipNow) window.bootSkipNow(); });
  }

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

  /* 앱이 화면을 정했다고 알려 오면 걷는다 (app.js 가 부른다).
     🔴 **곧바로 걷지 않는다** — 뜬 지 `BOOT_MIN_SHOW_MS` 가 안 됐으면 남은 만큼 기다렸다 걷는다.
        앱이 준비되는 시간은 기기마다 다른데, 학생 눈에 보이는 길이는 늘 같아야 한다. */
  var closing = false;
  var pending = null;
  /* 인트로가 글꼴을 기다리는 동안 다시 볼 간격 */
  var BOOT_POLL_MS = 50;
  /* 앞으로 얼마나 더 보여 줘야 하나. 인트로가 아직 안 돌기 시작했으면 null(모른다 — 조금 뒤 다시 본다). */
  var remaining = function () {
    if (!intro) return Math.max(0, BOOT_MIN_SHOW_MS - sinceShown());
    if (introSkip) return 0;
    if (!introRunAt) return null;
    return Math.max(0, BOOT_INTRO_SHOW_MS - (Date.now() - introRunAt));
  };
  window.bootDone = function () {
    clearTimeout(timer);
    if (closing || document.documentElement.getAttribute('data-boot') === 'done') return;
    closing = true;
    var tryClose = function () {
      var wait = remaining();
      if (wait === null) { pending = setTimeout(tryClose, BOOT_POLL_MS); return; }
      pending = setTimeout(fadeOut, wait);
    };
    /* 인트로 중에 누르면 남은 시간을 건너뛴다 (앱이 이미 준비된 뒤에만 — 준비 전이면 준비되는 대로) */
    window.bootSkipNow = function () { if (pending) { clearTimeout(pending); pending = null; fadeOut(); } };
    tryClose();
  };
  /* 걷힘 — **페이드**(2026-10-04 개발자 결정: 인트로와 평소 부팅 둘 다).
     로고와 글자가 살짝 커지며 흐려지고 덮개가 투명해지는 동안, 밑에 이미 그려진 앱 화면이 드러난다.
     모양·길이는 style.css '걷힘 움직임' 절에 있고 여기는 단계를 넘기기만 한다.
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
    setTimeout(function () { el.hidden = true; }, fadeMs + 20);
  }
})();
