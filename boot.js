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
  }, BOOT_TIMEOUT_MS);

  /* 앱이 화면을 정했다고 알려 오면 걷는다 (app.js 가 부른다) */
  window.bootDone = function () {
    clearTimeout(timer);
    if (document.documentElement.getAttribute('data-boot') === 'done') return;
    document.documentElement.setAttribute('data-boot', 'done');
    var el = document.getElementById('boot');
    if (!el) return;
    el.classList.add('boot-out');
    /* 사라지는 시간은 CSS 에서 읽는다 — 숫자를 여기 적으면 CSS 를 고칠 때 조용히 어긋난다 */
    var ms = (parseFloat(getComputedStyle(el).transitionDuration) || 0.12) * 1000;
    setTimeout(function () { el.hidden = true; }, ms + 20);
  };
})();
