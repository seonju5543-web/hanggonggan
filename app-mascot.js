/* 3D 마스코트 (2026-11-19 개발자 결정 — 홈 총 장학금 · 신청 내역을 마스코트 중심으로)

   홈은 그 학생 학교의 마스코트가, 신청 내역은 대장님이 선다. 누르면 뛰어오르며 동전이 튀고, 옆으로 끌면 돌아간다.

   🔴 금액·건수는 이 파일이 만들지 않는다 — 글자는 예전 그대로 app.js·app-my.js 가 쓴다(#hero-label · #hero-amount · .summary-card).
      3D 가 준비되면 그 글자를 **말풍선 모양으로 바꿔 캐릭터 위에 놓을 뿐**이다. 3D 를 못 그리는 폰(WebGL 없음 · 파일을 못 받음)은
      아무것도 바뀌지 않고 글자 화면 그대로다.
   🔴 엔진(mascot/three.min.js 약 670KB)은 첫 화면을 막지 않게 **늦게** 싣는다 — 홈이 그려진 뒤 한가할 때. 앱 CSP(script-src 'self')
      안에서 같은 출처 파일만 싣는다.
   🔴 학교 캐릭터는 학교의 자산이다. 학교가 빼 달라고 하면 그 학교 이름을 MASCOT_OFF 에 적는다 — 그 학교 학생에게는 대장님이 선다.
      창구·규정·요청 경위는 docs/designs/mascot-permissions.md · 생김새·과잠 색은 docs/designs/mascot-survey.md. */
(function () {
  'use strict';
  const MASCOT_OFF = [];   // 학교 정식 이름 — 여기 적힌 학교는 대장님이 대신 선다
  const FILES = ['mascot/three.min.js', 'mascot/kit.js', 'mascot/part-0.js', 'mascot/part-1.js', 'mascot/part-2.js', 'mascot/part-3.js',
    'mascot/part-4.js', 'mascot/part-5.js', 'mascot/part-6.js'];
  const st = { asked: false, ready: false, failed: false, home: null, apps: null, homeKey: '', school: '', appsOn: false };
  const $id = (id) => document.getElementById(id);

  function canGl() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function loadOne(src) {
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.appendChild(s); });
  }
  /* 엔진 싣기 — 한 번만. 실패하면 조용히 글자 화면에 머문다(다시 조르지 않는다) */
  function load() {
    if (st.asked) return; st.asked = true;
    if (!canGl()) { st.failed = true; return; }
    FILES.reduce((p, f) => p.then(() => loadOne(f)), Promise.resolve())
      .then(() => { if (!window.K) throw new Error('kit'); st.ready = true; mountHome(); mountApps(); })
      .catch(() => { st.failed = true; });
  }
  /* 학교 이름 → 장부 열쇠 (없거나 꺼 둔 학교는 '' = 대장님) */
  function keyOf(school) {
    if (!school || MASCOT_OFF.indexOf(school) >= 0 || !window.K) return '';
    return K.ORDER.find((k) => K.MASCOTS[k].school === school) || '';
  }
  function bump(el) { if (!el) return; el.classList.remove('mascot-bump'); void el.offsetWidth; el.classList.add('mascot-bump'); }

  function mountHome() {
    if (!st.ready) return;
    const wrap = $id('mascot-home'), card = wrap && wrap.closest('.hero-card');
    if (!wrap || !card) return;
    if (!st.home) {
      st.home = K.Stage(wrap.querySelector('.mascot-stage'), { stack: [1.3, 0.3], coins: 12, jump: 0.42, camY: 1.5, lookY: 1.3, dist: 5.4,
        onTap() { bump($id('hero-amount')); } });
      if (!st.home) { st.failed = true; return; }
      wrap.hidden = false; card.classList.add('has-mascot');
    }
    const key = keyOf(st.school);
    if (key !== st.homeKey || !st.homeSet) {
      st.homeKey = key; st.homeSet = true;
      st.home.setChar(key ? K.MASCOTS[key].build() : K.buildCaptain());
      const stage = wrap.querySelector('.mascot-stage');
      stage.setAttribute('aria-label', (key ? K.MASCOTS[key].name : '대장님') + ' — 누르면 동전이 나와요');
    }
  }
  function mountApps() {
    if (!st.ready) return;
    const wrap = $id('mascot-apps'), box = wrap && wrap.parentElement;
    if (!wrap || !box) return;
    if (st.appsOn && !st.apps) {
      st.apps = K.Stage(wrap.querySelector('.mascot-stage'), { coins: 5, spread: 1.2, jump: 0.36, camY: 1.35, lookY: 1.15, dist: 5.4, coinY: 1.3,
        onTap() { bump(document.querySelector('#apps-summary .summary-amount')); } });
      if (st.apps) st.apps.setChar(K.buildCaptain());
    }
    const on = !!(st.appsOn && st.apps);
    wrap.hidden = !on; box.classList.toggle('has-mascot', on);
  }

  window.Mascot = {
    /* 홈을 그릴 때마다 부른다 — 처음 불릴 때 엔진을 늦게 싣기 시작한다 */
    syncHome(school) {
      st.school = school || '';
      if (!st.asked) { (window.requestIdleCallback || ((f) => setTimeout(f, 700)))(load, { timeout: 2500 }); return; }
      mountHome();
    },
    /* 신청 내역 요약을 그릴 때마다 부른다 — show: 요약이 보이는가(신청 건이 있고 달력 보기가 아님) */
    syncApps(show) { st.appsOn = !!show; mountApps(); },
    _state: st,   // 검사용
  };
})();
