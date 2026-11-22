/* 학교별 마스코트 — kit.js 의 K 로 빚는다 (항공대 · 경기대 · 서울과기대 · 계명대 · 서울교대 · 방송대 · 경북대 · 영남대) */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, mat, sph, INK, cyl, cone, box, torus, tube, eggBase, eggJacket, chibi, eyes, cheeks, muzzle, tailChain, register } = K;
  const WHITE = 0xffffff, PI = Math.PI;
  const lit = () => new T.MeshBasicMaterial({ color: 0xffffff });
  // 웃는 입(아래로 볼록한 반원) — ch.on 으로 붙일 묶음
  const grin = (r, col) => { const g = new T.Group(), q = torus(r, 0.02, mat(col == null ? INK : col, 0.4), PI); q.rotation.z = PI; g.add(q); return g; };

  /* 한 덩어리 몸(buildBoo 방식) — o: { H, W, Y0, color, belly, bellyTop, pow, taper, PY 얼굴 묶음 높이, jacket{…}, leg 다리 색, legR, foot 발 색 } */
  function blob(o) {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const e = eggBase(squash, o);
    const arms = eggJacket(e, o.jacket);
    [-1, 1].forEach((s) => {
      const leg = cyl(o.legR || 0.06, o.legR || 0.06, o.Y0 + 0.1, mat(o.leg, 0.75), 12); leg.position.set(s * 0.22, (o.Y0 + 0.1) / 2 + 0.04, 0); squash.add(leg);
      squash.add(sph(0.19, mat(o.foot, 0.6), s * 0.22, 0.09, 0.1, 1, 0.5, 1.35));
    });
    const head = new T.Group(), PY = o.PY; head.position.y = PY; squash.add(head);
    const onFace = (obj, t, phi, off) => { e.place(obj, t, phi, off); obj.position.y -= PY; head.add(obj); return obj; };
    return { root, squash, head, arms, eyes: [], ears: [], jacket: arms.jacket, look: 0.4, scale: o.scale || 0.9, e, onFace, top: e.yy(1) - PY };
  }

  // 한국항공대 마하 — 미색 큰 머리 송골매 · 깃 한 가닥 · 이마의 고글 · 노란 부리 (원작 파란 비행복 → 과잠)
  register('kau', { school: '한국항공대학교', name: '마하', build() {
    const C = 0xfbf5e4, YL = 0xf6c32c, BR = 0x8a5a2b;
    const ch = chibi({ body: 0x2f80d8, head: C, hand: C, feet: YL, jacket: { color: 0x002870, letter: 'K' } });
    eyes(ch, { x: 0.36, y: -0.04, r: 0.065, style: 'dot' });
    cheeks(ch, { x: 0.52, y: -0.2 });
    ch.head.add(sph(0.13, mat(YL, 0.5), 0, -0.1, ch.R - 0.03, 1.3, 0.72, 0.8));
    ch.on(sph(0.02, mat(0xc98d12, 0.5), 0, 0, 0, 3.6, 0.7, 1), 0, -0.1, 0.075);
    const band = torus(0.625, 0.045, mat(BR, 0.6)); band.rotation.x = PI / 2; band.position.y = 0.36; band.scale.y = 0.95; ch.head.add(band);
    [-1, 1].forEach((s) => { const g = new T.Group(); g.add(torus(0.15, 0.045, mat(BR, 0.6))); g.add(sph(0.14, mat(YL, 0.25), 0, 0, 0, 1, 1, 0.4)); g.scale.x = 1.15; ch.on(g, s * 0.21, 0.4, 0.03); });
    ch.head.add(tube([[0, 0.6, 0], [0.02, 0.86, 0], [0.12, 1.0, 0], [0.28, 0.98, 0]], 0.055, mat(C, 0.75)));
    ch.head.add(sph(0.055, mat(C, 0.75), 0.28, 0.98, 0));
    return ch;
  } });

  // 경기대 기룡이 — 연하늘색 아기 귀룡 · 하늘색 사슴뿔 · 초록 등껍질 · 머리 위 주황 조개
  register('kgu', { school: '경기대학교', name: '기룡이', build() {
    const S = 0xa9d6f7, A = 0x7dbdf0, G = 0x2fa868, O = 0xf0935a;
    const ch = chibi({ body: S, belly: 0xdcefff, jacket: { color: 0x003876, letter: 'K' } });
    eyes(ch, { x: 0.28, y: 0, r: 0.115, color: 0x2a63b8 });
    cheeks(ch, { x: 0.47, y: -0.2, r: 0.12 });
    ch.on(sph(0.07, mat(0xf48a9a, 0.6), 0, 0, 0, 1.25, 0.9, 0.4), 0, -0.22, -0.01);
    [-1, 1].forEach((s) => {
      const g = new T.Group(), m = mat(A, 0.7); g.position.set(s * 0.5, 0.42, 0);
      g.add(tube([[0, 0, 0], [s * 0.14, 0.2, 0], [s * 0.2, 0.44, 0]], 0.06, m)); g.add(sph(0.06, m, s * 0.2, 0.44, 0));
      g.add(tube([[s * 0.12, 0.18, 0], [s * 0.24, 0.2, 0], [s * 0.34, 0.28, 0]], 0.05, m)); g.add(sph(0.05, m, s * 0.34, 0.28, 0));
      ch.head.add(g); ch.ears.push(g);
    });
    const clam = new T.Group(); clam.position.set(0.08, 0.68, 0.08); ch.head.add(clam);
    clam.add(sph(0.3, mat(O, 0.6), 0, 0, 0, 1, 0.34, 0.9)); clam.add(sph(0.26, mat(0xf9c9b8, 0.7), 0, 0.03, 0, 1, 0.3, 0.9));
    const lid = sph(0.3, mat(O, 0.6), 0, 0.24, -0.2, 1, 0.3, 0.9); lid.rotation.x = -1.15; clam.add(lid);
    const lin = sph(0.26, mat(0xf9c9b8, 0.7), 0, 0.24, -0.18, 1, 0.26, 0.9); lin.rotation.x = -1.15; clam.add(lin);
    clam.add(sph(0.12, mat(WHITE, 0.4), 0, 0.14, 0.04));
    ch.squash.add(sph(0.46, mat(G, 0.7), 0, 0.72, -0.4, 1, 1, 0.62));
    [-0.2, 0, 0.2].forEach((x) => ch.squash.add(sph(0.45, mat(0xe3f6ea, 0.7), x, 0.72, -0.43, 0.07, 0.94 - Math.abs(x), 0.62)));
    return ch;
  } });

  // 서울과기대 테크뇽 — 진회색 아기 용 · 빨강(짧게 부러진) 뿔 + 파랑 뿔 · 연회색 배
  register('seoultech', { school: '서울과학기술대학교', name: '테크뇽', build() {
    const G = 0x717682, L = 0xd9dde3, RED = 0xd9404f, BLUE = 0x2a57a6;
    const ch = chibi({ body: G, belly: L, jacket: { color: 0xB50306, letter: 'S' } });
    eyes(ch, { x: 0.26, y: 0, r: 0.08 });
    cheeks(ch, { x: 0.46, y: -0.15, r: 0.115, color: 0xf4a896 });
    [-1, 1].forEach((s) => {
      ch.on(sph(0.05, mat(WHITE, 0.7), 0, 0, 0, 1.4, 0.8, 0.4), s * 0.2, 0.27, -0.01);
      ch.on(grin(0.055), s * 0.055, -0.17, 0.01);
      const ea = cone(0.13, 0.3, mat(G, 0.75)); ea.position.set(s * 0.8, 0.26, 0); ea.rotation.z = -s * (PI / 2 - 0.35); ea.scale.z = 0.6; ch.head.add(ea); ch.ears.push(ea);
    });
    const r = mat(RED, 0.6), b = mat(BLUE, 0.6);
    ch.head.add(tube([[-0.3, 0.52, 0], [-0.34, 0.74, 0], [-0.44, 0.88, 0]], 0.075, r)); ch.head.add(sph(0.075, r, -0.44, 0.88, 0));
    ch.head.add(tube([[0.3, 0.52, 0], [0.32, 0.84, 0], [0.3, 1.08, 0]], 0.075, b)); ch.head.add(sph(0.075, b, 0.3, 1.08, 0));
    ch.head.add(tube([[0.32, 0.82, 0], [0.44, 0.86, 0], [0.5, 0.97, 0]], 0.06, b)); ch.head.add(sph(0.06, b, 0.5, 0.97, 0));
    tailChain(ch, [G, G, G, L], 0.14);
    return ch;
  } });

  // 계명대 진리 — SNS 홍보 캐릭터 3총사 중 파랑: 달걀형 파란 몸 · 둥근 안경 · 앞머리 한 올 · 누런 볼과 발
  register('kmu', { school: '계명대학교', name: '진리', build() {
    const BL = 0x3a80ea, NV = 0x16306e, BE = 0xe2c36d;
    const ch = blob({ H: 2.0, W: 0.9, Y0: 0.28, color: BL, belly: WHITE, bellyTop: 0.56, PY: 1.2, leg: BL, foot: BE, jacket: { t0: 0.16, t1: 0.54, color: 0x034EA2, letter: 'K', hand: BL, armK: 0.8 } });
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      g.add(sph(0.15, mat(WHITE, 0.8), 0, 0, 0, 1, 1, 0.3)); g.add(torus(0.155, 0.028, mat(NV, 0.5))); g.add(sph(0.05, mat(NV, 0.35), 0, 0, 0.04, 1, 1, 0.5));
      ch.onFace(g, 0.75, s * 0.31, -0.01); ch.eyes.push(g);
      ch.onFace(box(0.17, 0.035, 0.03, mat(NV, 0.5)), 0.86, s * 0.3, 0.005).rotation.z = s * 0.28;
      ch.onFace(sph(0.11, mat(BE, 0.8), 0, 0, 0, 1.2, 0.85, 0.25), 0.66, s * 0.66, -0.01);
    });
    ch.onFace(box(0.1, 0.03, 0.03, mat(NV, 0.5)), 0.75, 0, 0.03);
    ch.onFace(grin(0.09, NV), 0.65, 0, 0.01);
    ch.head.add(sph(0.2, mat(BL, 0.75), 0, ch.top - 0.02, 0)); ch.head.add(sph(0.13, mat(BL, 0.75), 0.17, ch.top + 0.1, 0.02));
    return ch;
  } });

  // 서울교대 새록이 — 연하늘색 공 모양 사슴 · 큰 흰 배 · 아주 큰 남색 눈 · 하트 코 · 작은 남색 뿔
  register('snue', { school: '서울교육대학교', name: '새록이', build() {
    const SK = 0xa5d3f7, NV = 0x1c3c78;
    const ch = blob({ H: 1.8, W: 1.05, Y0: 0.24, color: SK, belly: WHITE, bellyTop: 0.56, pow: 2.2, PY: 1.1, leg: SK, foot: NV, jacket: { t0: 0.1, t1: 0.44, color: 0x1a1a1a, letter: 'S', hand: NV, armK: 0.62, armS: 0.9 } });
    [-1, 1].forEach((s) => {
      const g = new T.Group();
      g.add(sph(0.2, mat(WHITE, 0.8), 0, 0, 0, 1, 1, 0.3)); g.add(sph(0.16, mat(NV, 0.35), 0, 0, 0.035, 1, 1, 0.4));
      g.add(sph(0.055, lit(), 0.05, 0.07, 0.1)); g.add(sph(0.028, lit(), -0.06, -0.06, 0.1));
      g.scale.setScalar(1.25); ch.onFace(g, 0.7, s * 0.42, -0.02); ch.eyes.push(g);
      ch.onFace(sph(0.09, mat(0xffb3a0, 0.8), 0, 0, 0, 1.25, 0.75, 0.25), 0.57, s * 0.7, -0.01);
      const ea = new T.Group(); ea.position.set(s * 0.72, ch.e.yy(0.86) - 1.1, 0); ea.rotation.z = s * 0.25;
      ea.add(sph(0.2, mat(SK, 0.75), s * 0.16, 0, 0, 1.5, 0.6, 0.5)); ea.add(sph(0.13, mat(WHITE, 0.8), s * 0.17, 0, 0.06, 1.4, 0.5, 0.4));
      ch.head.add(ea); ch.ears.push(ea);
      const m = mat(NV, 0.6), x = s * 0.32, y = ch.top - 0.06;
      ch.head.add(tube([[x, y, 0], [x + s * 0.04, y + 0.2, 0], [x + s * 0.08, y + 0.4, 0]], 0.05, m)); ch.head.add(sph(0.05, m, x + s * 0.08, y + 0.4, 0));
      ch.head.add(tube([[x + s * 0.04, y + 0.18, 0], [x + s * 0.15, y + 0.22, 0], [x + s * 0.21, y + 0.33, 0]], 0.045, m)); ch.head.add(sph(0.045, m, x + s * 0.21, y + 0.33, 0));
    });
    const nose = new T.Group(), n = mat(NV, 0.4);
    nose.add(sph(0.034, n, -0.026, 0.014, 0)); nose.add(sph(0.034, n, 0.026, 0.014, 0)); nose.add(sph(0.034, n, 0, -0.018, 0, 0.9, 1.1, 1));
    nose.scale.setScalar(1.2); ch.onFace(nose, 0.63, 0, 0.01);
    ch.onFace(sph(0.065, mat(0xf48a9a, 0.6), 0, 0, 0, 1, 0.95, 0.4), 0.565, 0, 0);
    return ch;
  } });

  // 방송대 크누 — 초록 공 모양 큰 곰 · 작은 귀 · 흰 주둥이 · 가는 검정 다리에 파란 운동화
  register('knou', { school: '한국방송통신대학교', name: '크누', build() {
    const G = 0x1fab33;
    const ch = blob({ H: 1.95, W: 1.1, Y0: 0.34, color: G, pow: 2.6, taper: 0.05, PY: 1.35, leg: 0x1c1c1c, legR: 0.045, foot: 0x2450b8, jacket: { t0: 0.1, t1: 0.44, color: 0x00A0E9, letter: 'K', hand: G, armK: 0.65, armS: 0.9 } });
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.add(sph(0.05, mat(INK, 0.35), 0, 0, 0, 1, 1.15, 0.5)); g.scale.setScalar(1.3); ch.onFace(g, 0.74, s * 0.3, 0); ch.eyes.push(g);
      ch.onFace(box(0.09, 0.022, 0.02, mat(INK, 0.5)), 0.8, s * 0.3, 0.005).rotation.z = s * 0.3;
      ch.onFace(sph(0.1, mat(0xffb3a0, 0.8), 0, 0, 0, 1.25, 0.75, 0.25), 0.67, s * 0.5, -0.01);
      const ea = sph(0.17, mat(G, 0.75), s * 0.5, ch.top - 0.08, 0, 1, 1, 0.8); ch.head.add(ea); ch.ears.push(ea);
      ch.squash.add(sph(0.075, mat(WHITE, 0.8), s * 0.22, 0.22, 0, 1, 0.8, 1));
    });
    ch.onFace(sph(0.16, mat(WHITE, 0.8), 0, 0, 0, 1.2, 0.95, 0.5), 0.71, 0, 0);
    ch.onFace(sph(0.042, mat(INK, 0.4), 0, 0, 0, 1.3, 0.9, 0.8), 0.735, 0, 0.08);
    return ch;
  } });

  // 경북대 호반우 — 베이지 몸에 검은 가로 줄무늬 칡소 · 각진 넓은 머리 · 작은 뿔 (기본형이 빨간 과잠 차림)
  register('knu', { school: '경북대학교', name: '호반우', build() {
    const B = 0xcdb48c, D = 0x3b2f2a, L = 0xeee4cc;
    const ch = chibi({ body: B, feet: D, headSx: 1.2, headSy: 0.88, jacket: { color: 0xE60000, letter: 'K' } });
    eyes(ch, { x: 0.33, y: 0.04, r: 0.06, style: 'dot' });
    cheeks(ch, { x: 0.56, y: -0.14 });
    muzzle(ch, { color: L, w: 1.6, y: -0.24, r: 0.3 });
    [-1, 1].forEach((s) => {
      ch.head.add(sph(0.03, mat(D, 0.4), s * 0.1, -0.14, ch.R + 0.02, 1, 1.2, 0.6));
            const h = cone(0.085, 0.26, mat(L, 0.6)); h.position.set(s * 0.52, 0.66, 0); h.rotation.z = -s * 0.35; ch.head.add(h);
      const ea = sph(0.15, mat(B, 0.75), s * 0.92, 0.3, -0.02, 1.4, 0.7, 0.5); ea.rotation.z = s * 0.2; ch.head.add(ea); ch.ears.push(ea);
    });
    ch.head.add(sph(0.3, mat(D, 0.7), 0, 0.4, 0.4, 1.1, 0.7, 0.7));
    [0.3, 0.08, -0.14, -0.36].forEach((y) => {   // 머리를 두르는 가로 줄무늬(얼굴 쪽은 비운다)
      const g = new T.Group(), q = torus(0.72 * 0.98 * Math.sqrt(1 - Math.pow(y / (0.72 * 0.88), 2)) - 0.005, 0.035, mat(D, 0.7), PI * 1.4), in_ = new T.Group();
      q.rotation.x = -PI / 2; in_.add(q); in_.rotation.y = -0.2 * PI; g.add(in_); g.scale.set(1.2 / 0.98, 0.7, 1); g.position.y = y; ch.head.add(g);
    });
    ch.on(grin(0.07), 0, -0.32, 0.07);
    const tail = new T.Group(); tail.position.set(0, 0.42, -0.5); ch.squash.add(tail); ch.tail = tail;
    tail.add(tube([[0, 0, 0], [0.14, -0.06, -0.2], [0.34, 0.02, -0.3]], 0.03, mat(D))); tail.add(sph(0.08, mat(D), 0.38, 0.04, -0.31, 1.3, 0.9, 0.9));
    return ch;
  } });

  // 영남대 푸르마 — 흰 조랑말(원작은 네 발 → 2등신으로 세움) · 파란 톱니 갈기 · 파란 날개 모양 꼬리 · 두 톤 발굽
  register('yu', { school: '영남대학교', name: '푸르마', build() {
    const W = 0xfbfbfb, BL = 0x1c4fa6, SK = 0x7fcaf0;
    const ch = chibi({ body: W, feet: SK, jacket: { color: 0x153974, letter: 'Y' } });
    ch.head.add(sph(0.36, mat(W, 0.75), 0, -0.2, 0.5, 1, 0.8, 1.1));
    eyes(ch, { x: 0.33, y: 0.12, r: 0.055, style: 'dot' });
    cheeks(ch, { x: 0.5, y: -0.1 });
    const sm = grin(0.1); sm.position.set(0, -0.3, 0.84); sm.rotation.x = 0.35; ch.head.add(sm);
    [-1, 1].forEach((s) => {
      ch.head.add(sph(0.022, mat(INK, 0.4), s * 0.08, -0.08, 0.86, 1, 1.3, 0.6));
      const ea = cone(0.11, 0.3, mat(W, 0.75)); ea.position.set(s * 0.3, 0.7, 0.05); ea.rotation.z = -s * 0.25; ch.head.add(ea); ch.ears.push(ea);
      ch.squash.add(sph(0.2, mat(BL, 0.6), s * 0.25, 0.06, 0.16, 1.02, 0.3, 1.32));
    });
    [0.05, 0.6, 1.15, 1.7, 2.2].forEach((a) => { const c = cone(0.22, 0.42, mat(BL, 0.65)); c.position.set(0, 0.8 * Math.cos(a) * 0.94, -0.82 * Math.sin(a)); c.rotation.x = -a; c.scale.x = 0.5; ch.head.add(c); });
    const tail = new T.Group(); tail.position.set(0, 0.5, -0.5); ch.squash.add(tail); ch.tail = tail;
    [0.7, 1.25, 1.8].forEach((a, i) => { const l = 0.34 - i * 0.05, f = sph(0.2, mat(BL, 0.65), 0, l * Math.cos(a), -l * Math.sin(a), 0.75, 1.6 - i * 0.25, 0.5); f.rotation.x = -a; tail.add(f); });
    return ch;
  } });
})();
