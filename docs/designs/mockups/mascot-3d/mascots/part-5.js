/* 학교별 마스코트 — kit.js 의 K 로 빚는다 (전북대 · 충남대 · 전남대 · 조선대 · 충북대 · 부경대 · 강원대) */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, mat, sph, cyl, cone, box, torus, tube, INK, eggBase, eggJacket, chibi, eyes, cheeks, muzzle, ear, smile, tailChain, register } = K;
  const WHITE = 0xffffff, PINK = 0xffb3a0;

  // 한 덩어리 몸(새·고래) 틀 — buildBoo 방식. 돌려주는 것: ch + e(달걀) · onFace(물체, t, phi, off) · PY
  function eggChar(o) {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const e = eggBase(squash, Object.assign({ Y0: 0.28 }, o.egg));
    const arms = eggJacket(e, Object.assign({ t0: 0.2, t1: 0.63, hand: o.egg.color }, o.jacket));
    [-1, 1].forEach((s) => squash.add(sph(0.2, mat(o.feet, 0.65), s * 0.24, 0.12, 0.12, 1, 0.55, 1.35)));
    const head = new T.Group(), PY = 1.2; head.position.y = PY; squash.add(head);
    const onFace = (obj, t, phi, off) => { e.place(obj, t, phi, off); obj.position.y -= PY; head.add(obj); return obj; };
    const eyeList = [];
    const eye = (t, phi, r, sparkle) => [-1, 1].forEach((s) => {
      const g = new T.Group(), w = new T.MeshBasicMaterial({ color: 0xffffff });
      g.add(sph(r, mat(INK, 0.35), 0, 0, 0, 1, 1, 0.5));
      if (sparkle) { g.add(sph(r * 0.36, w, r * 0.34, r * 0.38, r * 0.46)); g.add(sph(r * 0.18, w, -r * 0.3, -r * 0.36, r * 0.46)); }
      eyeList.push(onFace(g, t, s * phi, -r * 0.2));
    });
    return { root, squash, head, arms, eyes: eyeList, ears: [], look: 0.4, scale: 0.9, e, onFace, eye, PY };
  }

  // 전북대 표돌이 — 주황빛 아기 표범 · 갈색 반점 · 크림 주둥이 · 큰 흰 눈 / 과잠: 보라(#56296E) · 흰 J
  register('jbnu', { school: '전북대학교', name: '표돌이', build() {
    const O = 0xf6a013, B = 0xb5651d, C = 0xfde3c8;
    const ch = chibi({ body: O, belly: C, jacket: { color: 0x56296e, letter: 'J' } });
    [-1, 1].forEach((s) => {   // 뾰족한 큰 귀
      const g = new T.Group(), q = new T.Group(); g.position.set(s * 0.48, 0.46, 0); q.rotation.z = -s * 0.55; g.add(q);   // 기울기는 안쪽 묶음에(바깥은 움직임이 덮어쓴다)
      q.add(sph(0.26, mat(O, 0.75), 0, 0.1, 0, 0.9, 1.3, 0.6)); q.add(sph(0.16, mat(B, 0.75), 0, 0.08, 0.1, 0.85, 1.2, 0.4));
      ch.head.add(g); ch.ears.push(g);
    });
    [-1, 1].forEach((s) => {   // 크고 흰 눈 + 큰 눈동자
      const g = new T.Group(), w = new T.MeshBasicMaterial({ color: 0xffffff });
      g.add(sph(0.15, mat(WHITE, 0.8), 0, 0, 0, 0.92, 1.12, 0.3)); g.add(sph(0.095, mat(0x2a1a16, 0.35), -s * 0.02, -0.02, 0.035, 1, 1.1, 0.45)); g.add(sph(0.03, w, -s * 0.02 + 0.035, 0.03, 0.08));
      ch.on(g, s * 0.25, 0.08, -0.03); ch.eyes.push(g);
    });
    muzzle(ch, { color: C, nose: 0x2a1a16, w: 1.75, r: 0.27, y: -0.24, noseR: 0.075 });
    smile(ch, { y: -0.3, r: 0.08, color: 0x7a4a1e });
    [[-0.12, 0.5, 0.07], [0.14, 0.52, 0.06], [0.36, 0.42, 0.05], [-0.52, 0.22, 0.075], [-0.6, 0.02, 0.05], [0.56, 0.16, 0.08], [0.62, -0.06, 0.05]]
      .forEach(([x, y, r]) => ch.on(sph(r, mat(B, 0.8), 0, 0, 0, 1, 1.3, 0.3), x, y, -0.015));
    const curl = torus(0.07, 0.025, mat(0xd98a10, 0.7), Math.PI * 1.4); ch.on(curl, 0.02, 0.6, 0.0);
    [-1, 1].forEach((s) => [0.0, -0.14].forEach((y, i) => { const c = cone(0.05, 0.2, mat(O, 0.75), 10); c.position.set(s * 0.76, -0.12 + y, 0.12); c.rotation.z = -s * (1.4 + i * 0.35); ch.head.add(c); }));
    tailChain(ch, [O, B, O, B, O, O], 0.13);
    return ch;
  } });

  // 충남대 차차 — 두 발로 선 흰 말 · 청록 갈기와 꼬리 · 긴 주둥이 / 과잠: 남색(#034EA2) · 하늘색 C
  register('cnu', { school: '충남대학교', name: '차차', build() {
    const W = 0xfffdf7, TL = 0x16a5c4, TL2 = 0x5fd0e0, tl = mat(TL, 0.7), tl2 = mat(TL2, 0.7);
    const ch = chibi({ body: W, feet: TL, jacket: { color: 0x034ea2, letter: 'C', letterColor: '#8FD3F4' } });
    [-1, 1].forEach((s) => {   // 길고 뾰족한 흰 귀
      const g = new T.Group(), q = new T.Group(); g.position.set(s * 0.56, 0.42, -0.02); q.rotation.z = -s * 0.7; g.add(q);
      q.add(sph(0.17, mat(W, 0.75), 0, 0.16, 0, 0.75, 1.9, 0.6)); q.add(sph(0.1, mat(0xbfe9f2, 0.75), 0, 0.16, 0.06, 0.7, 1.7, 0.4));
      ch.head.add(g); ch.ears.push(g);
    });
    ch.head.add(sph(0.34, mat(0xf6efe2, 0.75), 0, -0.2, 0.52, 1.15, 0.85, 0.95));   // 긴 주둥이
    [-1, 1].forEach((s) => ch.head.add(sph(0.022, mat(0x8a94a8, 0.5), s * 0.13, -0.07, 0.8, 1, 1.3, 0.5)));
    const sm = torus(0.09, 0.02, mat(INK, 0.4), Math.PI); sm.rotation.z = Math.PI; sm.position.set(0, -0.26, 0.82); sm.rotation.x = 0.35; ch.head.add(sm);
    eyes(ch, { x: 0.33, y: 0.12, r: 0.075, style: 'dot' });
    cheeks(ch, { x: 0.52, y: -0.1, r: 0.085 });
    // 앞머리 갈기(크게 넘긴 뭉치) + 뒤통수 갈기
    ch.head.add(sph(0.34, tl, 0.06, 0.62, 0.22, 1.25, 0.75, 1.0)); ch.head.add(sph(0.22, tl2, -0.22, 0.6, 0.36, 1.2, 0.7, 0.9));
    ch.head.add(sph(0.16, tl, 0.34, 0.5, 0.42, 1.1, 0.8, 0.8));
    [[0.66, -0.3, 0.3], [0.4, -0.55, 0.28], [0.1, -0.68, 0.25], [-0.2, -0.7, 0.2]].forEach(([y, z, r], i) => ch.head.add(sph(r, i % 2 ? tl2 : tl, 0, y, z, 0.8, 1, 1)));
    const tail = new T.Group(); tail.position.set(0, 0.5, -0.5);
    tail.add(tube([[0, 0, 0], [0, 0.22, -0.3], [0.05, 0.05, -0.55], [0.12, -0.2, -0.6]], 0.11, tl)); tail.add(sph(0.13, tl2, 0.12, -0.24, -0.6, 1, 1.4, 1));
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });

  // 전남대 용비 — 흰 얼굴 · 초록 갈기 아기 용 · 이마 초록 불꽃 무늬 · 파란 눈 / 과잠: 초록(#007A33) · 흰 J
  register('jnu', { school: '전남대학교', name: '용비', build() {
    const W = 0xfbfdf8, G = 0x2faa3c, G2 = 0x7fd04a, g1 = mat(G, 0.7), g2 = mat(G2, 0.7);
    const ch = chibi({ body: W, feet: G, jacket: { color: 0x007a33, letter: 'J' } });
    [-1, 1].forEach((s) => {   // 옆으로 뻗은 긴 귀(뿔처럼)
      const g = new T.Group(), q = new T.Group(); g.position.set(s * 0.56, 0.34, -0.02); q.rotation.z = -s * 0.85; g.add(q);
      q.add(sph(0.16, mat(W, 0.75), 0, 0.2, 0, 0.7, 2.1, 0.55)); q.add(sph(0.09, g2, 0, 0.2, 0.055, 0.6, 1.8, 0.4));
      ch.head.add(g); ch.ears.push(g);
    });
    // 초록 갈기 — 정수리에서 뒤통수로 뾰족뾰족
    [[0, 0.74, 0.12, 0.2, 0.5, 0.25], [-0.2, 0.68, 0.02, 0.16, 0.4, -0.35], [0.2, 0.68, 0.02, 0.16, 0.4, 0.35], [0, 0.66, -0.3, 0.19, 0.46, 0], [0, 0.36, -0.62, 0.18, 0.42, 0], [0, 0.0, -0.74, 0.16, 0.36, 0]]
      .forEach(([x, y, z, r, h, rz], i) => { const c = cone(r, h, i % 2 ? g2 : g1, 14); c.position.set(x, y, z); c.rotation.z = -rz; c.rotation.x = z < -0.1 ? -0.55 - (0.66 - y) * 0.6 : z > 0.05 ? 0.2 : -0.3; ch.head.add(c); });
    ch.on(sph(0.1, g1, 0, 0, 0, 0.75, 1.9, 0.3), 0, 0.42, -0.02);   // 이마 무늬
    [-1, 1].forEach((s) => { const m = sph(0.07, g2, 0, 0, 0, 0.6, 1.6, 0.3); ch.on(m, s * 0.17, 0.4, -0.015); m.rotation.z = -s * 0.5; });
    eyes(ch, { x: 0.27, y: 0.02, r: 0.12, color: 0x1f6fc4 });
    cheeks(ch, { x: 0.47, y: -0.2 });
    [-1, 1].forEach((s) => ch.on(sph(0.022, mat(0x5a8a5a, 0.5)), s * 0.05, -0.15, 0));   // 콧구멍
    smile(ch, { y: -0.26, r: 0.07 });
    [-1, 1].forEach((s) => [[-0.02, 0.2, 1.75], [-0.2, 0.17, 2.1]].forEach(([y, h, rz], i) => { const c = cone(0.075, h + 0.1, i ? g2 : g1, 12); c.position.set(s * 0.74, y, 0.05); c.rotation.z = -s * rz; ch.head.add(c); }));   // 볼 옆 갈기
    tailChain(ch, [W, W, G2, G, G], 0.14);
    return ch;
  } });

  // 조선대 조아 — 남색 머리·날개에 흰 배의 백학 · 긴 노란 부리 · 뒤통수 분홍 깃 · 펭귄 체형 / 과잠: 파랑(#0160AF) · 흰 C
  register('chosun', { school: '조선대학교', name: '조아', build() {
    const N = 0x16307a, Y = 0xf7b500;
    const ch = eggChar({ egg: { H: 1.95, W: 0.95, color: N, belly: WHITE, bellyTop: 0.7 }, jacket: { color: 0x0160af, letter: 'C', t1: 0.58 }, feet: Y });
    [-1, 1].forEach((s) => ch.onFace(sph(0.19, mat(WHITE, 0.8), 0, 0, 0, 1.0, 1.15, 0.2), 0.8, s * 0.42, -0.02));   // 흰 눈자위
    ch.eye(0.8, 0.42, 0.085, true); ch.eyes.forEach((g) => g.translateZ(0.05));
    const bk = new T.Group(); const c = cone(0.13, 0.62, mat(Y, 0.5), 18); c.rotation.x = Math.PI / 2; c.position.z = 0.24; bk.add(c);
    const tip = cone(0.05, 0.2, mat(INK, 0.5), 18); tip.rotation.x = Math.PI / 2; tip.position.z = 0.475; bk.add(tip);
    ch.onFace(bk, 0.71, 0, -0.06); bk.rotation.x += 0.2;
    [-1, 1].forEach((s) => ch.onFace(sph(0.09, mat(PINK, 0.8), 0, 0, 0, 1.2, 0.8, 0.25), 0.69, s * 0.7, -0.01));
    [[0.94, 0.2, 0.3], [0.9, 0.16, 0.24]].forEach(([t, r, len], i) => {   // 뒤통수 분홍 깃
      const f = sph(r, mat(0xf08cb4, 0.7), 0, 0, 0, 0.75, 0.42, 1.7); ch.onFace(f, t, Math.PI + (i ? 0.25 : -0.1), len * 0.5); f.rotation.x -= 0.5;
    });
    return ch;
  } });

  // 충북대 우왕이 — 주황 황소 · 흰 작은 뿔 · 크림 아래 얼굴 · 덧니 하나 / 과잠: 자주(#B72654) 몸판·소매 · 흰 C
  register('cbnu', { school: '충북대학교', name: '우왕이', build() {
    const O = 0xd97a2c, C = 0xffe2b0;
    const ch = chibi({ body: O, belly: C, headSx: 1.12, jacket: { color: 0xb72654, sleeve: 0xb72654, letter: 'C' } });
    [-1, 1].forEach((s) => {   // 옆으로 누운 귀
      const g = new T.Group(); g.position.set(s * 0.78, 0.18, 0); g.rotation.z = -s * 0.25;
      g.add(sph(0.17, mat(O, 0.75), 0, 0, 0, 1.5, 0.85, 0.6)); g.add(sph(0.1, mat(0xf2a36b, 0.75), 0, -0.01, 0.07, 1.4, 0.8, 0.4));
      ch.head.add(g); ch.ears.push(g);
      const h = cone(0.12, 0.32, mat(0xfff4e0, 0.6), 14); h.position.set(s * 0.42, 0.68, 0.02); h.rotation.z = -s * 0.45; ch.head.add(h);   // 흰 뿔
    });
    [[0, 0.72, 0.1, 0], [-0.1, 0.7, 0.1, 0.5], [0.1, 0.7, 0.1, -0.5]].forEach(([x, y, z, rz]) => { const t = cone(0.07, 0.2, mat(O, 0.75), 10); t.position.set(x, y, z); t.rotation.z = rz; ch.head.add(t); });
    ch.head.add(sph(0.6, mat(C, 0.75), 0, -0.2, 0.16, 1.12, 0.72, 0.98));   // 크림 아래 얼굴
    eyes(ch, { x: 0.2, y: 0.12, r: 0.06, style: 'dot' });
    [-1, 1].forEach((s) => ch.on(sph(0.13, mat(PINK, 0.8), 0, 0, 0, 1.2, 0.85, 0.35), s * 0.5, -0.1, 0.03));
    const sm = torus(0.1, 0.022, mat(INK, 0.4), Math.PI); sm.rotation.z = Math.PI; ch.on(sm, 0, -0.1, 0.035);
    const tooth = cone(0.045, 0.1, mat(WHITE, 0.5), 10); ch.on(tooth, 0.09, -0.235, 0.05); tooth.rotation.z = Math.PI;
    const tail = new T.Group(); tail.position.set(0, 0.4, -0.5);
    tail.add(tube([[0, 0, 0], [0.1, 0.2, -0.28], [0.22, 0.42, -0.3]], 0.035, mat(O, 0.75))); tail.add(sph(0.1, mat(0xa9551c, 0.75), 0.24, 0.48, -0.3, 1, 1.25, 1));
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });

  // 부경대 백경이(2021년판) — 하늘색 향유고래 · 흰 줄무늬 배 · 파란 학사모 · 길게 웃는 입 / 과잠: 남색(#003876) · 흰 P
  register('pknu', { school: '부경대학교', name: '백경이', build() {
    const S = 0x8fd2f4, NV = 0x1f5fae, sky = mat(S, 0.75);
    const ch = eggChar({ egg: { H: 1.95, W: 1.02, color: S, belly: WHITE, bellyTop: 0.6, taper: 0.03, pow: 3 }, jacket: { color: 0x003876, letter: 'P', t1: 0.58 }, feet: S });
    const e = ch.e;
    [-0.16, 0, 0.16].forEach((p) => ch.squash.add(e.lathe(0.04, 0.6, 0.016, mat(0xbfe3f7, 0.8), p - 0.012, 0.024)));   // 배 줄무늬
    ch.eye(0.81, 0.52, 0.075, false);
    const A = 1.5, mg = new T.Group(), q = torus(e.rr(0.71) + 0.004, 0.02, mat(NV, 0.5), A); q.rotation.x = Math.PI / 2; mg.add(q);
    mg.rotation.y = -(Math.PI / 2 - A / 2); mg.position.y = e.yy(0.71) - ch.PY; ch.head.add(mg);   // 긴 입
    [-1, 1].forEach((s) => { ch.onFace(sph(0.03, mat(NV, 0.5)), 0.716, s * (A / 2 + 0.01), 0.004); ch.onFace(sph(0.12, mat(0xf7a8c8, 0.8), 0, 0, 0, 1.15, 0.85, 0.25), 0.745, s * 0.9, -0.01); });
    const cap = new T.Group(), nv = mat(NV, 0.6), yl = mat(0xf7c400, 0.5);
    const base = cyl(0.19, 0.21, 0.16, nv, 18); base.position.y = 0.06; cap.add(base);
    const top = box(0.56, 0.035, 0.56, nv); top.position.y = 0.16; top.rotation.y = Math.PI / 4; cap.add(top);
    cap.add(sph(0.035, yl, 0, 0.19, 0)); cap.add(tube([[0, 0.19, 0], [0.26, 0.17, 0.1], [0.36, 0.02, 0.14]], 0.012, nv)); cap.add(sph(0.06, yl, 0.36, -0.03, 0.14, 1, 1.1, 0.7));
    cap.position.set(0.34, e.yy(0.965) - ch.PY, 0.1); cap.rotation.z = -0.38; ch.head.add(cap);
    const tail = new T.Group(); tail.position.set(0, 0.44, -e.rr(0.08) + 0.06); tail.rotation.x = 0.45;
    tail.add(sph(0.2, sky, 0, 0, -0.14, 0.9, 0.7, 1.5)); [-1, 1].forEach((s) => { const f = sph(0.17, sky, s * 0.16, 0.06, -0.42, 1.2, 0.45, 0.9); f.rotation.y = -s * 0.5; tail.add(f); });
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });

  // 강원대 곰두리 — 하늘색 곰 · 흰 주둥이 · 목의 흰 하트 펜던트 / 과잠: 임시 파랑(#1F4FA3 — 상징색 미확인) · 흰 K
  register('kangwon', { school: '강원대학교', name: '곰두리', build() {
    const S = 0x7cc4f2, D = 0x1c5fb8;
    const ch = chibi({ body: S, jacket: { color: 0x1f4fa3, letter: 'K' } });
    ear(ch, { color: S, inner: 0xb8e0fa, x: 0.5, y: 0.52, r: 0.22 });
    eyes(ch, { x: 0.27, y: 0.1, r: 0.07, style: 'dot', color: D });
    cheeks(ch, { x: 0.5, y: -0.12 });
    ch.head.add(sph(0.26, mat(WHITE, 0.75), 0, -0.2, 0.52, 1.25, 0.85, 0.8)); ch.head.add(sph(0.06, mat(D, 0.4), 0, -0.1, 0.715, 1.3, 0.8, 0.7));
    [-1, 1].forEach((s) => { const q = torus(0.05, 0.018, mat(D, 0.4), Math.PI); q.rotation.z = Math.PI; q.position.set(s * 0.05, -0.2, 0.725); ch.head.add(q); });   // ω 입
    const hp = new T.Group(), w = mat(WHITE, 0.6);   // 하트 펜던트
    [-1, 1].forEach((s) => hp.add(sph(0.062, w, s * 0.045, 0.03, 0, 1, 1, 0.6)));
    const pt = cone(0.105, 0.13, w, 4); pt.rotation.z = Math.PI; pt.position.y = -0.05; pt.scale.z = 0.5; pt.rotation.y = Math.PI / 4; hp.add(pt);
    hp.scale.setScalar(1.5); ch.e.place(hp, 0.66, 0, 0.07); ch.squash.add(hp);
    const cord = torus(ch.e.rr(0.84) + 0.07, 0.014, w); cord.rotation.x = Math.PI / 2; cord.position.y = ch.e.yy(0.84); ch.squash.add(cord);
    const tail = sph(0.14, mat(S, 0.75), 0, 0.42, -0.62); ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });
})();
