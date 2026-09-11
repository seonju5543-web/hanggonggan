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
     1초는 머물러 있어야 하는데 아주 잠깐 표시되고 사라져"). 페이드 120ms 를 더해 총 1.12초 —
     눈에 '깜빡였다'가 아니라 '봤다'로 남는 길이다.
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
  window.bootDone = function () {
    clearTimeout(timer);
    if (closing || document.documentElement.getAttribute('data-boot') === 'done') return;
    closing = true;
    var wait = Math.max(0, BOOT_MIN_SHOW_MS - sinceShown());
    setTimeout(function () {
      document.documentElement.setAttribute('data-boot', 'done');
      var el = document.getElementById('boot');
      if (!el) return;
      /* 걷힘 — 페이드가 아니라 **로고가 세로 막대로 접혔다가 그 자리에서 앱이 열린다**
         (2026-09-11 개발자 지시 · 카카오웹툰 환영 화면 참고). 모양·길이는 전부
         style.css '걷힘 움직임' 절에 있고 여기는 단계를 넘기기만 한다.
         🔴 시간은 CSS 에서 읽는다 — 숫자를 여기 적으면 CSS 를 고칠 때 조용히 어긋난다.
            움직임 줄이기 기기에서는 CSS 가 둘 다 0 을 주므로 곧바로 사라진다. */
      var style = getComputedStyle(el);
      var msOf = function (name) {
        var v = String(style.getPropertyValue(name) || '').trim();
        var n = parseFloat(v) || 0;
        return /ms$/.test(v) ? n : n * 1000;
      };
      var foldMs = msOf('--boot-fold');
      var openMs = msOf('--boot-open');
      /* 열리는 자리는 로고의 **실제** 위치 — 로고는 화면 정중앙이 아니다(밑에 글자가 있다).
         가로로만 눌리므로 중심은 접힌 뒤에도 그대로다. */
      var logo = el.querySelector('.boot-logo');
      if (logo) {
        var r = logo.getBoundingClientRect();
        el.style.setProperty('--boot-hx', (r.left + r.width / 2) + 'px');
        el.style.setProperty('--boot-hy', (r.top + r.height / 2) + 'px');
      }
      el.classList.add('boot-fold');
      /* 접힌 막대를 아주 잠깐(60ms) 세워 둔다 — 참고 영상도 막대에서 한 박자 쉰다.
         쉼이 없으면 접힘과 열림이 한 동작으로 뭉개져 '막대가 창이 된다'가 안 보인다. */
      setTimeout(function () {
        el.classList.add('boot-open');
        setTimeout(function () { el.hidden = true; }, openMs + 20);
      }, foldMs + 60);
    }, wait);
  };
})();
