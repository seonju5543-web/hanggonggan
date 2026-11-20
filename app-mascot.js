/* 3D 마스코트 (2026-11-19 개발자 결정 — 홈 총 장학금 · 신청 내역을 마스코트 중심으로)

   홈은 그 학생 학교의 마스코트가, 신청 내역은 대장님이 선다. 누르면 뛰어오르며 동전이 튀고, 옆으로 끌면 돌아간다.
   홈은 2026-11-20 승인 시안 「가리키는 마스코트」 — 마스코트가 오른쪽에서 왼쪽 안내 줄을 가리키고, 줄·캐릭터가 한 상태로 움직인다(아래 히어로 절).

   🔴 금액·건수는 이 파일이 만들지 않는다 — 숫자는 app.js renderHome(히어로 줄 #hero-match · #hero-amount · #hero-due · #hero-draft)·app-my.js(.summary-card)가 쓴다.
      이 파일은 '지금 말하는 줄' 상태와 캐릭터만 움직인다. 3D 를 못 그리는 폰(WebGL 없음 · 파일을 못 받음)은 무대만 비고 줄은 그대로 돈다.
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

  /* ── 홈 히어로 — 가리키는 마스코트 (2026-11-20 개발자 승인 시안 docs/designs/mockups/mascot-3d/point.html) ──
     🔴 상태는 하나(hero.active — 지금 말하는 줄)뿐이다. 줄을 누르든, 마스코트를 누르든, 가만히 두든(3.4초마다) setActive 하나가 돈다 —
        줄이 커지고 숫자가 0부터 올라가고 · 왼쪽 막대가 그 줄로 옮겨 가고 · 점이 옮겨 가고 · 캐릭터가 그 줄을 가리키며 한 번 뛴다.
     🔴 줄과 점·막대는 3D 없이도 돈다(못 그리는 폰은 무대만 빈다). 숫자·숨김은 app.js renderHome 이 정한다 — 여기서 세지 않는다. */
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hero = { active: null, holdUntil: 0, sheetTimer: 0, bound: false };
  const lines = () => Array.prototype.slice.call(document.querySelectorAll('#hero-lines .hero-ln'));
  const visible = () => lines().filter((l) => !l.hidden);
  const lineOf = (k) => lines().find((l) => l.dataset.k === k);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hold(ms) { hero.holdUntil = Date.now() + (ms || 8000); }
  /* 줄의 자리 → 막대 · 캐릭터가 가리킬 높이. 글자 크기가 바뀌는 동안에도 맞게 잠깐 뒤 한 번 더 잰다 */
  function aim() {
    const ln = lineOf(hero.active), box = $id('hero-lines'), bar = $id('hero-bar');
    if (!ln || ln.hidden || !box || !bar) return;
    const r = ln.getBoundingClientRect(), b = box.getBoundingClientRect();
    bar.style.transform = `translateY(${r.top - b.top + 8}px)`; bar.style.height = Math.max(0, r.height - 16) + 'px';
    const wrap = $id('mascot-home');
    if (st.home && wrap && !wrap.hidden) {
      const s = wrap.getBoundingClientRect(), cy = r.top + r.height / 2;
      st.home.point({ x: -1, y: clamp(-((cy - (s.top + s.height * 0.5)) / (s.height * 0.5)), -0.9, 0.9) * 0.8 });
    }
  }
  function drawDots() {
    const d = $id('hero-dots');
    if (!d) return;
    d.textContent = '';
    visible().forEach((l) => { const i = document.createElement('i'); if (l.dataset.k === hero.active) i.className = 'on'; d.appendChild(i); });
  }
  /* 🔴 상태가 바뀌는 곳은 여기 하나 */
  function setActive(k, how) {
    const ln = lineOf(k);
    if (!ln || ln.hidden) return;
    if (k === hero.active) { if (how !== 'mascot' && how !== 'quiet' && st.home) st.home.hop(); return; }
    hero.active = k;
    lines().forEach((l) => { const on = l.dataset.k === k; l.classList.toggle('on', on); l.setAttribute('aria-current', on ? 'true' : 'false'); });
    drawDots();
    const b = ln.querySelector('b');
    const fmt = typeof HERO_FMT !== 'undefined' && HERO_FMT.get(b);
    if (fmt && how !== 'quiet' && typeof countUp === 'function') countUp(b, Number(b.dataset.to) || 0, fmt, 700);
    aim();
    if (how !== 'mascot' && how !== 'quiet' && st.home) st.home.hop();
    setTimeout(aim, 420);
  }
  /* 다음 줄 — 마스코트 누르기와 저절로 넘어가기가 같은 한 곳을 쓴다 */
  function nextKey() { const v = visible(); return v.length ? v[(v.indexOf(lineOf(hero.active)) + 1) % v.length].dataset.k : null; }
  function homeShown() { const h = $id('screen-home'); return !!(h && !h.hidden); }
  function sheetOpen() { const sh = $id('detail-sheet'); return !!(sh && !sh.hidden && sh.classList.contains('show')); }
  function bindHero() {
    if (hero.bound || !$id('hero-lines')) return;
    hero.bound = true;
    lines().forEach((l) => l.addEventListener('click', () => {
      const k = l.dataset.k;
      hold(); setActive(k);
      clearTimeout(hero.sheetTimer);
      /* 먼저 가리키고(0.35초) 그 줄의 내용을 연다 — 캐릭터가 없으면 기다릴 까닭이 없다 */
      hero.sheetTimer = setTimeout(() => {
        if (homeShown() && !sheetOpen() && typeof openHeroLine === 'function') openHeroLine(k);   // 그 사이 홈을 떠났으면 열지 않는다
      }, st.home && !REDUCED ? 350 : 0);
    }));
    let wasOpen = false;
    setInterval(() => {
      /* 시트를 닫은 뒤에도 그 줄에 8초 머문다(시안 closeSheet → hold) — 닫자마자 다른 줄로 넘어가지 않게 */
      const open = sheetOpen();
      if (wasOpen && !open) hold();
      wasOpen = open;
      if (REDUCED || document.hidden || Date.now() < hero.holdUntil || !homeShown() || open || visible().length < 2) return;
      const k = nextKey(); if (k) setActive(k);
    }, 3400);
    window.addEventListener('resize', aim);
  }
  /* 그 줄이 숨었으면 첫 줄로 · 아니면 막대·점만 다시 맞춘다(숫자를 다시 올리지 않는다 — renderHome 이 이미 올렸다) */
  function syncLines() {
    bindHero();
    const cur = lineOf(hero.active);
    /* 처음 그릴 때는 첫 줄을 0부터 올린다(시안 setActive('match')) · 보던 줄이 숨었으면 조용히 첫 줄로 */
    if (!cur || cur.hidden) { const first = hero.active === null; hero.active = null; setActive('match', first ? undefined : 'quiet'); }
    else { drawDots(); aim(); }
  }

  function mountHome() {
    if (!st.ready) return;
    const wrap = $id('mascot-home'), card = wrap && wrap.closest('.hero-card');
    if (!wrap || !card) return;
    if (!st.home) {
      /* 무대는 히어로 전체에 깔고 캐릭터만 오른쪽에 세운다(screenX) — 오른쪽 칸에만 두면 왼쪽으로 뻗은 팔이 칸 끝에서 잘린다(11-20 개발자 지적) */
      st.home = K.Stage(wrap.querySelector('.mascot-stage'), { screenX: 0.33, coins: 8, spread: 1.0, jump: 0.28, camY: 1.4, lookY: 1.22, dist: 8.0,
        onTap() { hold(); const k = nextKey(); if (k) setActive(k, 'mascot'); } });
      if (!st.home) { st.failed = true; return; }
      wrap.hidden = false; card.classList.add('has-mascot');
    }
    const key = keyOf(st.school);
    if (key !== st.homeKey || !st.homeSet) {
      st.homeKey = key; st.homeSet = true;
      st.home.setChar(key ? K.MASCOTS[key].build() : K.buildCaptain());
      const stage = wrap.querySelector('.mascot-stage');
      stage.setAttribute('aria-label', (key ? K.MASCOTS[key].name : '대장님') + ' — 누르면 다음 안내로');
      const who = $id('hero-who');
      if (who) who.textContent = key ? `${K.MASCOTS[key].school} · ${K.MASCOTS[key].name}` : '';
    }
    setTimeout(aim, 60);
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
    /* 히어로 줄 숫자·숨김을 바꾼 뒤 부른다(app.js renderHome) */
    syncLines,
    _state: st,   // 검사용
  };
})();
