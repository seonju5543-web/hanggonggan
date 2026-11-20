/* 3D 마스코트 공용 부품 (2026-11-19) — 앱(app-mascot.js 가 늦게 싣는다)과 시안(docs/designs/mockups/mascot-3d/)이 같이 쓴다.
   three.min.js 다음에 싣는다. 바깥에는 window.K 하나만 낸다. */
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = THREE;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ───────── 조형 도우미 ─────────
  const mat = (c, r = 0.62, m = 0) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const SPH = new T.SphereGeometry(1, 36, 26);
  function sph(r, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const o = new T.Mesh(SPH, m); o.position.set(x, y, z); o.scale.set(r * sx, r * sy, r * sz); return o;
  }
  // 반지름 R 인 공 표면 위(앞쪽)의 z
  const onZ = (R, x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y));
  const INK = 0x22283a;

  function addEyes(head, R, ex, ey, er, hl) {
    const eyes = [];
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      const z = onZ(R, ex, ey) - er * 0.25;
      g.position.set(s * ex, ey, z);
      g.rotation.y = s * Math.asin(ex / R) * 0.9; g.rotation.x = -Math.asin(ey / R) * 0.9;
      g.add(sph(er, mat(INK, 0.35), 0, 0, 0, 1, 1, 0.5));
      const white = new T.MeshBasicMaterial({ color: 0xffffff });
      g.add(sph(er * hl, white, er * 0.34, er * 0.38, er * 0.46));
      g.add(sph(er * hl * 0.5, white, -er * 0.3, -er * 0.36, er * 0.46));
      head.add(g); eyes.push(g);
    });
    return eyes;
  }
  function addCheeks(head, R, cx, cy, r) {
    [-1, 1].forEach((s) => {
      const c = sph(r, mat(0xffb3a0, 0.8), s * cx, cy, onZ(R, cx, cy) - r * 0.2, 1.2, 0.8, 0.35);
      c.rotation.y = s * Math.asin(cx / R); head.add(c);
    });
  }


  // ───────── 공용 부품 ─────────
  const cyl = (rt, rb, h, m, seg) => new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), m);
  const cone = (r, h, m, seg) => new T.Mesh(new T.ConeGeometry(r, h, seg || 20), m);
  const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
  const torus = (r, tube, m, arc) => new T.Mesh(new T.TorusGeometry(r, tube, 12, 48, arc || Math.PI * 2), m);
  // 점 [[x,y,z],…] 을 잇는 둥근 관 (꼬리·깃·수염·뿔)
  const tube = (pts, r, m) => new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), 24, r, 10), m);
  function letterTex(txt, color) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const cx = cv.getContext('2d'); cx.fillStyle = color || '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.font = `900 ${txt.length > 1 ? 78 : 122}px Rockwell, "Roboto Slab", Georgia, serif`; cx.fillText(txt, 64, 70);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; return tex;
  }

  /* 달걀 몸 — 돌려 깎은 한 덩어리. o: { H 키, W 반폭, Y0 바닥 높이, color, belly(앞판 색·없으면 생략), bellyTop, taper, pow }
     돌려주는 것: rr(t) 반지름 · yy(t) 높이 · lathe(t0,t1,off,재질,phi시작,phi길이) · place(물체,t,phi,off) 표면에 붙이기 (t: 0 바닥~1 꼭대기 · phi: 0 정면, + 는 보는 쪽 오른쪽) */
  function eggBase(squash, o) {
    const H = o.H, W = o.W, Y0 = o.Y0 || 0, tp = o.taper == null ? 0.1 : o.taper, pw = o.pow || 2.4;
    const rr = (t) => { t = clamp(t, 0, 1); return W * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), pw)), 0.5) * (1 - tp * t); };
    const yy = (t) => Y0 + H * t;
    const lathe = (t0, t1, off, m, ps, pl) => {
      const pts = []; for (let i = 0; i <= 40; i++) { const t = lerp(t0, t1, i / 40); pts.push(new T.Vector2(Math.max(0.0001, rr(t) + off), yy(t))); }
      return new T.Mesh(new T.LatheGeometry(pts, 56, ps || 0, pl || Math.PI * 2), m);
    };
    const place = (obj, t, phi, off) => {
      const r = rr(t) + (off || 0), e = 0.01, tilt = Math.atan2(-(rr(t + e) - rr(t - e)), H * 2 * e);
      obj.position.set(r * Math.sin(phi), yy(t), r * Math.cos(phi)); obj.rotation.order = 'YXZ'; obj.rotation.y = phi; obj.rotation.x = -tilt; return obj;
    };
    squash.add(lathe(0, 1, 0, mat(o.color, 0.75)));
    if (o.belly != null) squash.add(lathe(0.02, o.bellyTop || 0.6, 0.012, mat(o.belly, 0.8), -0.55, 1.1));
    return { H, W, Y0, rr, yy, lathe, place, squash };
  }
  /* 과잠 — 달걀 몸 위에 입힌다. o: { t0, t1 밑단·깃 높이, color 몸판, sleeve 소매(기본 흰색), trim 줄 색(기본 흰색), letter, letterColor,
     hand 손 색, armK 팔 길이 배율, armS 팔 굵기 배율, gap 앞섶 벌어짐(0 이면 닫힘) }. 팔 둘(어깨가 축)을 돌려준다 */
  function eggJacket(e, o) {
    const squash = e.squash, G = o.gap == null ? 0.3 : o.gap, t0 = o.t0, t1 = o.t1;
    const body = mat(o.color, 0.85), trim = mat(o.trim == null ? 0xffffff : o.trim, 0.8), sleeve = mat(o.sleeve == null ? 0xffffff : o.sleeve, 0.8), hand = mat(o.hand, 0.75);
    body.side = T.DoubleSide;
    const arc = Math.PI * 2 - G * 2;
    squash.add(e.lathe(t0, t1, 0.04, body, G, arc));
    const ring = (t, off, tb, m, dy) => {
      const g = new T.Group(), q = torus(e.rr(t) + off, tb, m, arc); q.rotation.x = Math.PI / 2; g.add(q);
      g.rotation.y = -(Math.PI / 2 + G); g.position.y = e.yy(t) + (dy || 0); squash.add(g);
    };
    const k = o.armS || 1;
    [[t0, 0.075 * k], [t1, 0.06 * k]].forEach(([t, tb]) => { ring(t, 0.045, tb, body); ring(t, 0.045 + tb * 0.62, 0.016 * k, trim, 0.028 * k); ring(t, 0.045 + tb * 0.62, 0.016 * k, trim, -0.028 * k); });
    [0.2, 0.4, 0.6, 0.8].map((u) => lerp(t0, t1, u)).forEach((t) => squash.add(e.place(sph(0.042 * k, trim), t, G + 0.1, 0.05)));
    if (o.letter) {
      const s = 0.36 * (o.letterS || k);
      squash.add(e.place(new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshBasicMaterial({ map: letterTex(o.letter, o.letterColor), transparent: true, depthWrite: false })), lerp(t0, t1, 0.68), G + 0.52, 0.06));
    }
    return [-1, 1].map((s) => {
      const g = new T.Group(); g.position.set(s * e.rr(t1 - 0.06), e.yy(t1 - 0.06), 0.04); g.scale.set(k, (o.armK || 1), k);
      g.add(sph(0.2, sleeve, 0, -0.42, 0, 1, 2.3, 1));
      const cuff = torus(0.14, 0.06, body); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.84; g.add(cuff);
      const st = torus(0.19, 0.014, trim); st.rotation.x = Math.PI / 2; st.position.y = -0.84; g.add(st);
      g.add(sph(0.16, hand, 0, -1.0, 0, 1, 1, 0.75));
      g.userData.side = s; squash.add(g); return g;
    });
  }

  // 한국외대 '부' — 하늘색 달걀 몸 · 머리 위 깃 둘 · 주황 세모 부리 · 남색 몸판/흰 소매 과잠(H). cute: 0 원작 얼굴 · 1 더 귀엽게(개발자 선택)
  function buildBoo(cute) {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const SKY = 0x9dd3f2, SKY_L = 0xc9e6f8, NAVY = 0x14305c, WHITE = 0xffffff, ORANGE = 0xf59a3c, white = mat(WHITE, 0.8);
    const H = cute ? 1.92 : 2.05, W = cute ? 0.98 : 0.92, J0 = 0.2, J1 = 0.64;
    const e = eggBase(squash, { H, W, Y0: 0.28, color: SKY, belly: SKY_L, bellyTop: J1 - 0.04 });
    const arms = eggJacket(e, { t0: J0, t1: J1, color: NAVY, letter: 'H', hand: SKY });
    arms.forEach((g) => [-1, 0, 1].forEach((k) => g.add(sph(0.065, mat(SKY, 0.75), k * 0.09, -1.13, 0))));
    [-1, 1].forEach((s) => {
      const leg = cyl(0.06, 0.06, 0.34, mat(SKY, 0.75), 12); leg.position.set(s * 0.22, 0.2, 0); squash.add(leg);
      squash.add(sph(0.2, mat(ORANGE, 0.6), s * 0.22, 0.09, 0.1, 1, 0.5, 1.35));
    });
    const head = new T.Group(), PY = 1.2; head.position.y = PY; squash.add(head);
    const onFace = (o, t, phi, off) => { e.place(o, t, phi, off); o.position.y -= PY; head.add(o); return o; };
    const eyes = [-1, 1].map((s) => {
      const g = new T.Group();
      if (cute) {
        g.add(sph(0.17, white, 0, 0, 0, 1.15, 1, 0.3));
        g.add(sph(0.105, mat(INK, 0.35), 0, 0, 0.035, 1, 1, 0.45));
        const w = new T.MeshBasicMaterial({ color: 0xffffff });
        g.add(sph(0.038, w, 0.04, 0.045, 0.085)); g.add(sph(0.018, w, -0.04, -0.04, 0.085));
      } else {
        g.add(sph(0.15, white, 0, 0, 0, 1.32, 0.82, 0.3));
        g.add(sph(0.07, mat(0x4a4f58, 0.4), 0, 0, 0.03, 1.15, 0.85, 0.45));
      }
      return onFace(g, cute ? 0.77 : 0.79, s * (cute ? 0.36 : 0.33), -0.02);
    });
    const beak = cone(cute ? 0.1 : 0.085, cute ? 0.17 : 0.15, mat(ORANGE, 0.5), 18);
    onFace(beak, cute ? 0.7 : 0.725, 0, 0.03); beak.rotateX(Math.PI / 2);
    if (cute) [-1, 1].forEach((s) => onFace(sph(0.1, mat(0xffb3a0, 0.8), 0, 0, 0, 1.25, 0.75, 0.25), 0.7, s * 0.6, -0.01));
    const ears = [-1, 1].map((s) => {
      const g = new T.Group(); g.position.set(s * 0.2, e.yy(0.975) - PY - 0.04, 0);
      const curve = new T.QuadraticBezierCurve3(new T.Vector3(0, 0, 0), new T.Vector3(s * 0.06, 0.24, 0), new T.Vector3(s * 0.26, 0.32, 0));
      g.add(new T.Mesh(new T.TubeGeometry(curve, 16, 0.06, 10), mat(SKY, 0.75))); g.add(sph(0.06, mat(SKY, 0.75), s * 0.26, 0.32, 0));
      head.add(g); return g;
    });
    return { root, squash, head, arms, eyes, ears, look: 0.4, scale: 0.9 };
  }

  /* 2등신 캐릭터 틀 — 둥근 머리 + 과잠 입은 작은 몸. o: { body 몸 색, belly 배 색, head 머리 색(기본 body), hand 손 색, feet 발 색,
     headR 머리 반지름(0.72), headY 머리 중심 높이(1.78), headSx/headSy 머리 납작함, jacket: { color, letter, letterColor, sleeve, trim, gap } }
     돌려주는 ch: { root, squash, head(머리 묶음 — 원점이 머리 중심), R, on(물체,x,y,off) 머리 앞면에 붙이기, arms, eyes[], ears[], e(몸 달걀) } */
  function chibi(o) {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const e = eggBase(squash, { H: 1.12, W: 0.66, Y0: 0.14, color: o.body, belly: o.belly, bellyTop: 0.5, taper: 0.18 });
    let arms;
    if (o.jacket) arms = eggJacket(e, Object.assign({ t0: 0.14, t1: 0.8, hand: o.hand == null ? o.body : o.hand, armK: 0.6, armS: 0.72 }, o.jacket));
    else arms = [-1, 1].map((s) => { const g = new T.Group(); g.position.set(s * 0.52, 1.0, 0.06); g.add(sph(0.14, mat(o.hand == null ? o.body : o.hand, 0.75), 0, -0.2, 0, 1, 1.6, 1)); g.userData.side = s; squash.add(g); return g; });
    [-1, 1].forEach((s) => squash.add(sph(0.2, mat(o.feet == null ? o.body : o.feet, 0.7), s * 0.25, 0.1, 0.16, 1, 0.55, 1.3)));
    const R = o.headR || 0.72, head = new T.Group(); head.position.set(0, o.headY || 1.78, 0.02); squash.add(head);
    head.add(sph(R, mat(o.head == null ? o.body : o.head, 0.75), 0, 0, 0, o.headSx || 1.05, o.headSy || 0.94, 0.98));
    const on = (obj, x, y, off) => {
      obj.position.set(x, y, onZ(R, x, y) + (off || 0)); obj.rotation.y = Math.asin(clamp(x / R, -1, 1)) * 0.9; obj.rotation.x = -Math.asin(clamp(y / R, -1, 1)) * 0.9; head.add(obj); return obj;
    };
    return { root, squash, head, arms, eyes: [], ears: [], R, on, e, scale: o.scale || 0.92 };
  }
  // 얼굴 부품 — ch.on 으로 머리 앞면에 붙인다
  function eyes(ch, o) {   // o: { x 0.27, y 0.05, r 0.105, style: 'sparkle'(기본)|'dot'|'oval', color }
    o = o || {}; const x = o.x == null ? 0.27 : o.x, y = o.y == null ? 0.05 : o.y, r = o.r || 0.105, w = new T.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      if (o.style === 'oval') { g.add(sph(r * 1.4, mat(0xffffff, 0.8), 0, 0, 0, 1.3, 0.85, 0.3)); g.add(sph(r * 0.7, mat(o.color == null ? 0x4a4f58 : o.color, 0.4), 0, 0, r * 0.3, 1, 1, 0.45)); }
      else { g.add(sph(r, mat(o.color == null ? INK : o.color, 0.35), 0, 0, 0, 1, 1, 0.5));
        if (o.style !== 'dot') { g.add(sph(r * 0.36, w, r * 0.34, r * 0.38, r * 0.46)); g.add(sph(r * 0.18, w, -r * 0.3, -r * 0.36, r * 0.46)); } }
      ch.on(g, s * x, y, -r * 0.25); ch.eyes.push(g);
    });
  }
  function cheeks(ch, o) { o = o || {}; const x = o.x || 0.45, y = o.y == null ? -0.14 : o.y, r = o.r || 0.1; [-1, 1].forEach((s) => ch.on(sph(r, mat(o.color == null ? 0xffb3a0 : o.color, 0.8), 0, 0, 0, 1.2, 0.8, 0.35), s * x, y, -r * 0.2)); }
  function muzzle(ch, o) {   // o: { color, w 1.3 너비, y -0.2, r 0.25, nose 코 색(없으면 생략), noseR }
    o = o || {}; const y = o.y == null ? -0.2 : o.y, r = o.r || 0.25;
    ch.head.add(sph(r, mat(o.color == null ? 0xfff3dc : o.color, 0.75), 0, y, ch.R - r * 0.88, o.w || 1.3, 0.78, 0.72));
    if (o.nose != null) ch.head.add(sph(o.noseR || 0.07, mat(o.nose, 0.4), 0, y + r * 0.4, ch.R - r * 0.88 + r * 0.72, 1.25, 0.8, 0.8));
  }
  function ear(ch, o) {   // 둥근 귀 한 쌍. o: { x 0.46, y 0.5, z 0, r 0.19, color, inner(안쪽 색·생략 가능), sx, sy }
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * (o.x == null ? 0.46 : o.x), o.y == null ? 0.5 : o.y, o.z || 0); const r = o.r || 0.19;
      g.add(sph(r, mat(o.color, 0.75), 0, 0, 0, o.sx || 1, o.sy || 1, 0.8)); if (o.inner != null) g.add(sph(r * 0.58, mat(o.inner, 0.75), 0, -0.01, r * 0.5, o.sx || 1, o.sy || 1, 0.5));
      ch.head.add(g); ch.ears.push(g);
    });
  }
  function smile(ch, o) { o = o || {}; const q = torus(o.r || 0.09, 0.022, mat(o.color == null ? INK : o.color, 0.4), Math.PI); q.rotation.z = Math.PI; ch.on(q, 0, o.y == null ? -0.2 : o.y, 0.01); return q; }
  function tailChain(ch, colors, tipR) {   // 구슬을 이은 꼬리(뒤쪽) — ch.tail 이 살랑인다
    const g = new T.Group(); g.position.set(0, 0.36, -0.5);
    colors.forEach((col, i) => { const a = i / (colors.length - 1); g.add(sph(i === colors.length - 1 ? (tipR || 0.12) : 0.1, mat(col, 0.75), Math.sin(a * 1.6) * 0.34, a * 0.62, -0.1 - a * 0.14)); });
    ch.squash.add(g); ch.tail = g; return g;
  }

  // 학교별 마스코트 장부 — mascots/*.js 가 채운다
  const MASCOTS = {}, ORDER = [];
  function register(key, def) { MASCOTS[key] = def; if (ORDER.indexOf(key) < 0) ORDER.push(key); }

  // 대장님 — index.html 의 <symbol id="mascot"> ('왕눈이')를 입체로
  function buildCaptain() {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const cream = mat(0xfdfbf6, 0.7);
    const head = new T.Group(); head.position.set(0, 0.86, 0); squash.add(head);
    const R = 0.8;
    head.add(sph(R, cream, 0, 0, 0, 1.06, 0.96, 0.94));
    const eyes = addEyes(head, R, 0.3, 0.0, 0.175, 0.36);
    addCheeks(head, R, 0.56, -0.22, 0.12);
    const smile = new T.Mesh(new T.TorusGeometry(0.1, 0.026, 10, 20, Math.PI), mat(INK, 0.4));
    smile.rotation.z = Math.PI; smile.position.set(0, -0.26, onZ(R, 0, -0.26) * 0.94 + 0.02); smile.rotation.x = 0.3; head.add(smile);
    [-1, 1].forEach((s) => squash.add(sph(0.19, cream, s * 0.3, 0.09, 0.14, 1, 0.55, 1.25)));
    const arms = [-1, 1].map((s) => {
      const g = new T.Group(); g.position.set(s * 0.78, 0.66, 0.1);
      g.add(sph(0.13, cream, 0, -0.14, 0, 1, 1.4, 1)); g.userData.side = s; squash.add(g); return g;
    });
    // 학사모
    const cap = new T.Group(); cap.position.set(0, 0.7, 0); head.add(cap);
    const band = new T.Mesh(new T.CylinderGeometry(0.5, 0.56, 0.24, 36), mat(0xc19a45, 0.55));
    band.position.y = 0.02; cap.add(band);
    const board = new T.Mesh(new T.BoxGeometry(1.34, 0.07, 1.34), mat(0xd9b56a, 0.5));
    board.position.y = 0.17; board.rotation.y = Math.PI / 4; cap.add(board);
    cap.add(sph(0.07, mat(0xc19a45), 0, 0.22, 0));
    const tassel = new T.Group(); tassel.position.set(0.9, 0.18, 0.02); cap.add(tassel);
    const cord = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.4, 8), mat(0xd9b56a));
    cord.position.y = -0.2; tassel.add(cord); tassel.add(sph(0.085, mat(0xd9b56a), 0, -0.44, 0, 1, 1.3, 1));
    const cordTop = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.9, 8), mat(0xd9b56a));
    cordTop.rotation.z = Math.PI / 2; cordTop.position.set(0.45, 0.215, 0.02); cap.add(cordTop);
    return { root, squash, head, arms, eyes, cap, tassel, R, isCaptain: true };
  }

  // ───────── 동전 ─────────
  const COIN_GEO = new T.CylinderGeometry(0.15, 0.15, 0.045, 24);
  const COIN_MAT = mat(0xffcf4a, 0.35, 0.15);
  COIN_MAT.emissive = new T.Color(0xb07a00); COIN_MAT.emissiveIntensity = 0.45;
  function Coins(scene, n) {
    const pool = [];
    for (let i = 0; i < n; i++) { const m = new T.Mesh(COIN_GEO, COIN_MAT); m.visible = false; scene.add(m); pool.push({ m, on: false, v: new T.Vector3(), w: new T.Vector3(), life: 0 }); }
    this.burst = (o, count, spread) => {
      let k = 0;
      for (const c of pool) {
        if (c.on) continue; if (k++ >= count) break;
        c.on = true; c.life = 0; c.m.visible = true; c.m.scale.setScalar(1);
        c.m.position.set(o.x + rand(-0.25, 0.25), o.y + rand(0, 0.3), o.z + rand(0, 0.3));
        c.v.set(rand(-spread, spread), rand(3.6, 5.8), rand(-0.2, 1.3));
        c.w.set(rand(-12, 12), rand(-6, 6), rand(-12, 12));
        c.m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      }
    };
    this.update = (dt) => {
      for (const c of pool) {
        if (!c.on) continue;
        c.life += dt; c.v.y -= 13 * dt;
        c.m.position.addScaledVector(c.v, dt);
        c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt; c.m.rotation.z += c.w.z * dt;
        if (c.m.position.y < 0.04 && c.v.y < 0) {
          c.m.position.y = 0.04;
          if (Math.abs(c.v.y) < 1.1) { c.v.set(c.v.x * 0.5, 0, c.v.z * 0.5); c.w.multiplyScalar(0.3); c.m.rotation.x = lerp(c.m.rotation.x, Math.round(c.m.rotation.x / Math.PI) * Math.PI, 0.5); c.m.rotation.z = lerp(c.m.rotation.z, Math.round(c.m.rotation.z / Math.PI) * Math.PI, 0.5); }
          else { c.v.y *= -0.4; c.v.x *= 0.7; c.v.z *= 0.7; c.w.multiplyScalar(0.6); }
        }
        if (c.life > 1.7) c.m.scale.setScalar(Math.max(0, 1 - (c.life - 1.7) / 0.4));
        if (c.life > 2.1) { c.on = false; c.m.visible = false; }
      }
    };
  }
  // 옆에 쌓이는 동전 탑
  function Stack(scene, x, z, max) {
    const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
    const items = []; let shown = 0;
    for (let i = 0; i < max; i++) { const m = new T.Mesh(COIN_GEO, COIN_MAT); m.position.set(rand(-0.025, 0.025), 0.03 + i * 0.05, rand(-0.025, 0.025)); m.rotation.y = rand(0, 6); m.scale.setScalar(0.001); m.visible = false; g.add(m); items.push({ m, s: 0, t: 0 }); }
    this.add = () => { if (shown < max) { items[shown].m.visible = true; items[shown].t = 1; shown++; } return shown >= max; };
    this.reset = () => { shown = 0; items.forEach((i) => { i.m.visible = false; i.s = 0; i.t = 0; i.m.scale.setScalar(0.001); }); };
    this.update = (dt) => items.forEach((i) => { if (i.t) { i.s = lerp(i.s, 1, 1 - Math.pow(0.0005, dt)); i.m.scale.setScalar(Math.max(0.001, i.s)); } });
    this.group = g;
  }

  // ───────── 무대 ─────────
  function Stage(btn, opt) {
    const canvas = btn.querySelector('canvas');
    let renderer;
    try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch (e) { { const ng = document.getElementById('nogl'); if (ng) ng.style.display = 'block'; } return null; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(opt.fov || 34, 1, 0.1, 50);
    scene.add(new T.HemisphereLight(0xffffff, opt.ground || 0xe9dcc8, 2.1));
    const key = new T.DirectionalLight(0xfff6e8, 2.3); key.position.set(2.5, 5, 4.5); scene.add(key);
    const rim = new T.DirectionalLight(0xdfe8ff, 1.0); rim.position.set(-3.5, 2.5, -3); scene.add(rim);
    const shadow = new T.Mesh(new T.CircleGeometry(0.72, 40), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: opt.shadow == null ? 0.13 : opt.shadow, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.004; scene.add(shadow);
    const coins = new Coins(scene, 48);
    const stack = opt.stack ? new Stack(scene, opt.stack[0], opt.stack[1], 12) : null;

    let ch = null, appear = 1;
    const S = { yaw: 0, yawV: 0, drag: false, lookX: 0, lookY: 0, lx: 0, ly: 0, tJump: -1, blink: rand(1.5, 3.5), blinkT: 0, armUp: 0, capT: -1, tas: 0, tasV: 0, time: 0, visible: true, point: null, pz: 0.3, py: 0 };

    function setChar(next) {
      if (ch) { scene.remove(ch.root); }
      ch = next; scene.add(ch.root); appear = 0; if (stack) stack.reset();
    }
    function size() {
      const w = btn.clientWidth, h = btn.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      // 좁은 무대에서는 물러나 캐릭터가 잘리지 않게
      const dist = (opt.dist || 5.7) * Math.max(1, 0.95 / cam.aspect);
      cam.position.set(0, opt.camY || 1.45, dist); cam.lookAt(0, opt.lookY || 1.28, 0); cam.updateProjectionMatrix();
      if (stack) stack.group.visible = cam.aspect > 0.85;
    }
    new ResizeObserver(size).observe(btn); size();
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { S.visible = es[0].isIntersecting; }).observe(btn);

    function tap() {
      if (S.tJump >= 0 && S.tJump < 0.5) return;       // 뛰는 중에는 한 번만
      S.tJump = 0; if (ch.cap) S.capT = 0;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
      setTimeout(() => {
        coins.burst({ x: 0, y: opt.coinY || 1.5, z: 0.3 }, REDUCED ? 4 : (opt.coins || 12), opt.spread || 1.9);
        const full = stack ? stack.add() : false;
        opt.onTap && opt.onTap(full);
      }, 120);
    }
    // 손짓 — 6px 넘게 움직이면 돌리기, 아니면 누르기
    let px = 0, py = 0, moved = false, pid = null;
    btn.addEventListener('pointerdown', (e) => { pid = e.pointerId; px = e.clientX; py = e.clientY; moved = false; S.drag = true; look(e); });
    btn.addEventListener('pointermove', (e) => {
      look(e);
      if (!S.drag || e.pointerId !== pid) return;
      const dx = e.clientX - px;
      if (!moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - py)) { moved = true; try { btn.setPointerCapture(pid); } catch (er) {} }
      if (moved) { const d = dx * 0.012; S.yawV = (d - S.yaw) * 30; S.yaw = d; }
    });
    const end = (e) => { if (e.pointerId !== pid) return; S.drag = false; pid = null; };
    btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end);
    btn.addEventListener('pointerleave', () => { S.lookX = 0; S.lookY = 0; });
    btn.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; return; } tap(); });  // Enter·Space 도 이 길
    function look(e) {
      const r = btn.getBoundingClientRect();
      S.lookX = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      S.lookY = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    }

    let last = performance.now();
    let skip = false;
    function frame(now) {
      requestAnimationFrame(frame);
      if (S.tJump < 0 && !S.drag && appear >= 1 && (skip = !skip)) return;   // 쉬는 동안은 한 프레임 걸러 (전력)
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!S.visible || !ch) return;
      S.time += dt;
      // 돌리기 — 놓으면 용수철로 제자리
      if (!S.drag || !moved) { S.yawV += (-S.yaw * 60 - S.yawV * 7) * dt; S.yaw += S.yawV * dt; }
      // 뛰기: 움츠림 → 공중 → 착지 출렁
      let y = 0, sy = 1 + Math.sin(S.time * 2.2) * 0.012;
      if (S.tJump >= 0) {
        S.tJump += dt; const t = S.tJump;
        if (t < 0.12) sy = 1 - 0.24 * (t / 0.12);
        else if (t < 0.56) { const u = (t - 0.12) / 0.44; y = (opt.jump || 0.6) * 4 * u * (1 - u); sy = 1 + 0.14 * Math.sin(Math.PI * u); }
        else if (t < 1.3) { const v = t - 0.56; sy = 1 - 0.2 * Math.exp(-7 * v) * Math.cos(19 * v); }
        else S.tJump = -1;
        S.armUp = lerp(S.armUp, t < 0.7 ? 1 : 0, 1 - Math.pow(0.0001, dt));
      } else S.armUp = lerp(S.armUp, 0, 1 - Math.pow(0.001, dt));
      appear = Math.min(1, appear + dt * 3.2);
      const pop = 1 + 0.25 * Math.sin(appear * Math.PI) * (1 - appear) - Math.pow(1 - appear, 3);
      const sxz = 1 / Math.sqrt(sy);
      ch.root.position.y = y; ch.root.rotation.y = S.yaw + (opt.yaw || 0) + Math.sin(S.time * 0.8) * 0.04;
      ch.root.scale.setScalar(Math.max(0.001, pop) * (opt.scale || 1) * (ch.scale || 1));
      ch.squash.scale.set(sxz, sy, sxz);
      shadow.scale.setScalar((1 - y * 0.45) * (opt.scale || 1) * (ch.scale || 1));
      // 시선
      /* 가리키기(point) — 화면의 글자 쪽을 본다 · 그쪽 팔을 뻗는다 · 몸을 조금 돌린다 (없으면 예전 그대로 손가락을 따라 본다) */
      const P = S.point && !S.drag ? S.point : null;
      S.lx = lerp(S.lx, P ? P.x : S.lookX, 1 - Math.pow(0.002, dt)); S.ly = lerp(S.ly, P ? -P.y : S.lookY, 1 - Math.pow(0.002, dt));
      S.py = lerp(S.py, P ? P.x * 0.38 : 0, 1 - Math.pow(0.01, dt)); ch.root.rotation.y += S.py;
      const lk = ch.look || 1;
      ch.head.rotation.y = (S.lx * 0.34 - S.yaw * 0.25) * lk; ch.head.rotation.x = (S.ly * 0.2 + (S.tJump >= 0 && S.tJump < 0.56 ? -0.18 : 0)) * lk;
      ch.head.rotation.z = Math.sin(S.time * 1.1) * 0.03 * lk;
      // 깜빡임
      S.blink -= dt; if (S.blink < 0) { S.blinkT = 0.14; S.blink = rand(2.2, 4.8); }
      if (S.blinkT > 0) S.blinkT -= dt;
      const happy = S.tJump >= 0.12 && S.tJump < 0.7;
      ch.eyes.forEach((e) => { e.scale.y = S.blinkT > 0 ? 0.12 : (happy ? 0.55 : 1); });
      // 팔 · 귀 · 꼬리
      const ps = P ? (P.x < 0 ? -1 : 1) : 0;   // 가리키는 쪽 팔
      S.pz = lerp(S.pz, P ? Math.PI / 2 + P.y * 0.6 : 0.3, 1 - Math.pow(0.0008, dt));
      ch.arms.forEach((a) => { const s = a.userData.side;
        a.rotation.z = s === ps || (!P && Math.abs(S.pz - 0.3) > 0.02 && s === S.lastPs) ? s * (S.pz + Math.sin(S.time * 5) * 0.03) : s * (0.3 + S.armUp * 2.3 + Math.sin(S.time * 2.2 + s) * 0.05); });
      if (ps) S.lastPs = ps;
      if (ch.ears) ch.ears.forEach((e, i) => { e.rotation.z = (i ? -1 : 1) * (Math.sin(S.time * 3 + i) * 0.04 + S.armUp * 0.22); });
      if (ch.tail) ch.tail.rotation.z = Math.sin(S.time * 2.6) * 0.22 + S.yawV * 0.03;
      // 학사모 — 톡 떠올라 한 바퀴
      if (ch.cap) {
        let cy = 0, cr = 0;
        if (S.capT >= 0) { S.capT += dt; const u = S.capT / 0.72; if (u < 1) { cy = 0.75 * 4 * u * (1 - u); cr = u * Math.PI * 2; } else S.capT = -1; }
        ch.cap.position.y = 0.7 + cy; ch.cap.rotation.y = cr;
        const drive = -S.yawV * 0.12 + (S.capT >= 0 ? Math.sin(S.capT * 14) * 0.5 : 0);
        S.tasV += ((drive - S.tas) * 40 - S.tasV * 4) * dt; S.tas += S.tasV * dt;
        ch.tassel.rotation.z = clamp(S.tas, -1.1, 1.1) + Math.sin(S.time * 1.7) * 0.05;
      }
      coins.update(dt); if (stack) stack.update(dt);
      renderer.render(scene, cam);
    }
    requestAnimationFrame(frame);
    /* 밖에서 상태를 맞출 때 — point({x,y}): 화면 좌표(-1~1 · x 왼쪽이 −, y 위가 +)의 그 자리를 가리킨다(null 이면 그만) · hop(): 동전 없이 한 번 뛴다 */
    return { setChar, tap, size, point(p) { S.point = p || null; }, hop() { if (S.tJump < 0 || S.tJump > 0.5) S.tJump = 0.1; } };
  }


  /* 작은 정지 그림 — 한 렌더러로 차례로 찍어 <img> 로 쓴다(WebGL 화면은 한 쪽에 16개쯤이 한계) */
  let TR = null;
  function thumb(build, size) {
    try {
      if (!TR) { TR = { r: new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }), s: new T.Scene(), c: new T.PerspectiveCamera(32, 1, 0.1, 50) };
        TR.s.add(new T.HemisphereLight(0xffffff, 0xe9dcc8, 2.1)); const k = new T.DirectionalLight(0xfff6e8, 2.3); k.position.set(2.5, 5, 4.5); TR.s.add(k);
        TR.c.position.set(0, 1.55, 5.9); TR.c.lookAt(0, 1.32, 0); }
      TR.r.setSize(size || 240, size || 240, false);
      const ch = build(); ch.root.scale.setScalar(ch.scale || 1); ch.root.rotation.y = -0.28; TR.s.add(ch.root); TR.r.render(TR.s, TR.c);
      const url = TR.r.domElement.toDataURL('image/png'); TR.s.remove(ch.root); return url;
    } catch (e) { return ''; }
  }

  window.K = { T, REDUCED, rand, lerp, clamp, mat, sph, onZ, INK, cyl, cone, box, torus, tube, letterTex, eggBase, eggJacket, chibi, eyes, cheeks, muzzle, ear, smile, tailChain,
    buildBoo, buildCaptain, Coins, Stack, Stage, thumb, MASCOTS, ORDER, register };
  register('hufs', { school: '한국외국어대학교', name: '부', build: () => buildBoo(1) });
})();
