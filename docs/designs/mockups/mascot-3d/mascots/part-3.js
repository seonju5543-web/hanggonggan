/* 학교별 마스코트 — kit.js 의 K 로 빚는다 (아주 · 국민 · 숭실 · 세종 · 이화 · 인하 · 부산 · 가톨릭) */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, mat, sph, cyl, cone, box, torus, tube, INK, eggBase, eggJacket, chibi, eyes, cheeks, ear, smile, register } = K;
  const rot = (o, x, y, z) => { o.rotation.set(x || 0, y || 0, z || 0); return o; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  // 아주대 치토 — 파란 불꽃 후드(위로 솟은 불꽃 끝 · 양옆 작은 불꽃) · 크림색 얼굴 · 흰 눈썹 · 분홍 볼 / 과잠: 남색(임시 값) · 흰 A
  register('ajou', { school: '아주대학교', name: '치토', build() {
    const C = 0xfdeac2, B = 0x1648ad, BL = 0x6aa3e6, blue = mat(B, 0.7);
    const ch = chibi({ body: C, jacket: { color: 0x0b2a5b, letter: 'A' } }), h = ch.head;
    h.add(sph(0.84, blue, 0, 0, -0.17, 1.1, 1, 1));
    const rim = at(torus(0.5, 0.065, mat(BL, 0.7)), 0, 0, 0.52); rim.scale.set(1, 0.86, 1); h.add(rim);
    h.add(at(rot(cone(0.5, 0.75, blue, 28), -0.1, 0, 0.22), -0.06, 0.98, -0.17));
    h.add(at(rot(cone(0.15, 0.46, blue, 20), -0.1, 0, 0.8), -0.17, 1.29, -0.2));
    h.add(at(rot(cone(0.2, 0.36, mat(BL, 0.7), 20), 0, 0, 0.2), -0.04, 0.9, 0.2));
    [-1, 1].forEach((s) => h.add(at(rot(cone(0.2, 0.5, blue), 0, 0, -s * 0.55), s * 0.9, 0.3, -0.17)));
    eyes(ch, { x: 0.2, y: 0.02, r: 0.06, style: 'dot' });
    [-1, 1].forEach((s) => rot(ch.on(sph(0.055, mat(0xffffff, 0.8), 0, 0, 0, 1.6, 0.55, 0.4), s * 0.2, 0.17, 0), -0.2, s * 0.25, s * 0.3));
    cheeks(ch, { x: 0.39, y: -0.14, r: 0.13 });
    ch.on(sph(0.03, mat(0x7a4a3a, 0.5), 0, 0, 0, 1.2, 0.8, 0.6), 0, -0.06, 0);
    smile(ch, { y: -0.12, r: 0.045, color: 0x7a4a3a });
    return ch;
  } });

  // 국민대 Mr. Doctor — 얼굴 없는 둥근 머리의 황금색 사람 · 사각 학사모(술 달림) / 과잠: KMU Blue(#004F9F) · 흰 K
  register('kookmin', { school: '국민대학교', name: 'Mr. Doctor', build() {
    const G = 0xf0aa1e, gold = mat(G, 0.4, 0.25), dark = mat(0xd08c12, 0.4, 0.25);
    const ch = chibi({ body: G, jacket: { color: 0x004f9f, letter: 'K' } }), h = ch.head;
    ch.root.traverse((m) => { if (m.material && m.material.color && m.material.color.getHex() === G) { m.material.roughness = 0.4; m.material.metalness = 0.25; } });
    const cap = new T.Group(); cap.position.set(0, 0.5, -0.02); cap.rotation.set(-0.12, 0, 0.06); h.add(cap);
    cap.add(at(cyl(0.5, 0.56, 0.3, dark, 32), 0, 0.02, 0));
    cap.add(rot(at(box(1.34, 0.07, 1.34, gold), 0, 0.2, 0), 0, Math.PI / 4, 0));
    cap.add(sph(0.07, dark, 0, 0.25, 0, 1, 0.6, 1));
    cap.add(tube([[0, 0.25, 0], [0.45, 0.25, 0.3], [0.72, 0.2, 0.42], [0.76, -0.05, 0.44]], 0.022, dark));
    cap.add(sph(0.05, dark, 0.76, -0.12, 0.44, 0.8, 1.8, 0.8));
    return ch;
  } });

  // 숭실대 슝슝이 — 두 발로 선 흰 말 · 하늘색 곱슬 갈기와 꼬리 · 넓은 베이지 주둥이 / 과잠: SSU Blue(#02A6CB) · 흰 S
  register('ssu', { school: '숭실대학교', name: '슝슝이', build() {
    const W = 0xffffff, BG = 0xf6e4c8, SK = 0x35b4e2, sky = mat(SK, 0.7);
    const ch = chibi({ body: W, belly: BG, feet: 0xc4edf6, headSx: 0.95, headSy: 1.06, jacket: { color: 0x02a6cb, letter: 'S' } }), h = ch.head;
    ear(ch, { color: W, inner: BG, x: 0.3, y: 0.72, r: 0.13, sy: 1.5 });
    h.add(sph(0.37, mat(BG, 0.75), 0, -0.3, 0.46, 1.4, 0.82, 0.8));
    eyes(ch, { x: 0.1, y: 0.12, r: 0.055, style: 'dot' });
    [-1, 1].forEach((s) => h.add(sph(0.022, mat(INK, 0.4), s * 0.08, -0.14, 0.72)));
    h.add(at(rot(torus(0.09, 0.018, mat(INK, 0.4), Math.PI), -0.15, 0, Math.PI), 0, -0.34, 0.755));
    [[0.0, 0.7, 0.34, 0.2], [0.14, 0.8, 0.14, 0.22], [0.26, 0.76, -0.1, 0.23], [0.4, 0.6, -0.26, 0.23], [0.52, 0.36, -0.32, 0.22], [0.58, 0.1, -0.34, 0.21], [0.56, -0.16, -0.34, 0.19], [0.48, -0.4, -0.32, 0.16],
      [0.08, 0.6, -0.42, 0.24], [0.14, 0.3, -0.6, 0.24], [0.16, 0.0, -0.64, 0.22], [0.14, -0.3, -0.56, 0.19]].forEach(([x, y, z, r]) => h.add(sph(r, sky, x, y, z)));
    const tail = new T.Group(); tail.position.set(0, 0.42, -0.52);
    [[0, 0, 0, 0.12], [0.12, -0.06, -0.14, 0.14], [0.26, -0.02, -0.22, 0.14], [0.36, 0.14, -0.24, 0.12], [0.38, 0.3, -0.22, 0.08]].forEach(([x, y, z, r]) => tail.add(sph(r, sky, x, y, z)));
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });

  // 세종대 세린이 — 노란 아기 기린 · 갈색 뿔 끝 · 뿔 사이 검은 익선관 · 크림색 아래 얼굴 · 큰 눈 · 벌린 입 / 과잠: Sejong Crimson(#C3002F) · 흰 S
  register('sejong', { school: '세종대학교', name: '세린이', build() {
    const Y = 0xfcc530, CR = 0xf4ecdc, BR = 0x4a2f24, OR = 0xf8a51e, brown = mat(BR, 0.6), black = mat(0x1b1b22, 0.7);
    const ch = chibi({ body: Y, feet: BR, jacket: { color: 0xc3002f, letter: 'S' } }), h = ch.head;
    h.add(sph(0.5, mat(CR, 0.8), 0, -0.3, 0.3, 1.12, 0.78, 0.86));
    eyes(ch, { x: 0.29, y: 0.1, r: 0.125, style: 'oval', color: 0x3d2b25 });
    [-1, 1].forEach((s) => {
      rot(ch.on(torus(0.13, 0.024, brown, Math.PI * 0.8), s * 0.29, 0.21, 0.02), -0.25, s * 0.35, 0.3);
      ch.on(sph(0.07, mat(OR, 0.8), 0, 0, 0, 1.2, 0.8, 0.3), s * 0.27, 0.5, -0.01);
      const g = new T.Group(); g.position.set(s * 0.8, 0.3, -0.04); g.rotation.z = s * 0.25;
      g.add(sph(0.26, mat(Y, 0.75), s * 0.1, 0, 0, 1.25, 0.8, 0.45)); g.add(sph(0.2, mat(CR, 0.8), s * 0.12, -0.02, 0.07, 1.15, 0.72, 0.3));
      h.add(g); ch.ears.push(g);
      h.add(at(rot(cyl(0.06, 0.075, 0.3, mat(Y, 0.75), 14), 0, 0, -s * 0.3), s * 0.42, 0.72, -0.02)); h.add(sph(0.115, brown, s * 0.47, 0.9, -0.02));
      h.add(sph(0.05, black, s * 0.06, 1.12, -0.08, 0.9, 1.7, 0.7));
    });
    cheeks(ch, { x: 0.5, y: -0.12, r: 0.13, color: OR });
    h.add(sph(0.045, brown, 0, 0.0, 0.735, 1.3, 0.85, 0.7));
    h.add(sph(0.17, brown, 0, -0.31, 0.7, 1.05, 0.62, 0.22)); h.add(sph(0.1, mat(0xf79ab0, 0.7), 0, -0.36, 0.715, 1.1, 0.5, 0.22));
    h.add(sph(0.27, black, 0, 0.72, -0.02, 1.2, 0.72, 1.1)); h.add(sph(0.2, black, 0, 0.9, -0.08, 1, 0.9, 1));
    return ch;
  } });

  // 이화여대 화여니 — 흰 배꽃 몸 · 초록 외곽선 · 머리 위 꽃잎 끝 둘 · 가슴의 초록 꽃술 · 등에 꽃받침 날개 / 과잠: Ewha Green(#00462A) · 흰 E (공식 지정은 미확인)
  register('ewha', { school: '이화여자대학교', name: '화여니', build() {
    const W = 0xffffff, G = 0x2f9e5c, DG = 0x1f6b3f, green = mat(G, 0.7), white = mat(W, 0.8), line = new T.MeshBasicMaterial({ color: G, side: T.BackSide });
    const ch = chibi({ body: W, belly: 0xeef9f0, headSx: 1.12, headSy: 0.9, jacket: { color: 0x00462a, letter: 'E', gap: 0.42 } }), h = ch.head;
    h.add(sph(0.755, line, 0, 0, 0, 1.12, 0.9, 0.98));
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * 0.27, 0.56, 0); g.rotation.z = -s * 0.3;
      g.add(sph(0.17, white, 0, 0, 0, 0.9, 1.2, 0.75)); g.add(sph(0.205, line, 0, 0, 0, 0.9, 1.2, 0.75)); h.add(g); ch.ears.push(g);
    });
    eyes(ch, { x: 0.17, y: 0.04, r: 0.055, style: 'dot', color: DG });
    ch.on(sph(0.045, mat(DG, 0.5), 0, 0, 0, 0.85, 1.15, 0.3), 0, -0.09, 0);
    [-1, 1].forEach((s) => ch.on(sph(0.09, mat(0xffb3a0, 0.8), 0, 0, 0, 1.2, 0.8, 0.35), s * 0.42, -0.1, 0.04));
    const star = new T.Group();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; star.add(rot(sph(0.018, green, Math.sin(a) * 0.055, Math.cos(a) * 0.055, 0, 1, 3, 0.7), 0, 0, -a)); star.add(sph(0.026, green, Math.sin(a) * 0.118, Math.cos(a) * 0.118, 0)); }
    ch.squash.add(ch.e.place(star, 0.5, 0, 0.03));
    [-1, 0, 1].forEach((s) => ch.squash.add(at(rot(sph(0.2, green, 0, 0, 0, 0.62, 1.25, 0.3), 0.15, 0, -s * 0.95), s * 0.2, 0.86 - Math.abs(s) * 0.1, -0.68)));
    return ch;
  } });

  // 인하대 안뇽 — 연하늘색 통통한 용 · 크림색 가지 뿔 · 이마 소용돌이 · 송곳니 둘 · 등 뒤 구름 날개 · 크림색 꼬리 끝 / 과잠: INHA Blue(#005BAC) · 흰 I
  register('inha', { school: '인하대학교', name: '안뇽', build() {
    const S = 0xa9d4f6, CR = 0xfff0c4, cream = mat(CR, 0.75), skyM = mat(S, 0.75), white = mat(0xffffff, 0.85);
    const ch = chibi({ body: S, belly: CR, headSx: 1.12, jacket: { color: 0x005bac, letter: 'I' } }), h = ch.head;
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * 0.3, 0.58, -0.02);
      g.add(tube([[0, 0, 0], [s * 0.08, 0.24, 0], [s * 0.1, 0.5, 0]], 0.055, cream)); g.add(sph(0.055, cream, s * 0.1, 0.5, 0));
      g.add(tube([[s * 0.06, 0.2, 0], [s * 0.2, 0.28, 0], [s * 0.27, 0.42, 0]], 0.045, cream)); g.add(sph(0.045, cream, s * 0.27, 0.42, 0));
      h.add(g); ch.ears.push(g);
      h.add(rot(sph(0.15, skyM, s * 0.8, 0.34, -0.05, 1.3, 0.7, 0.5), 0, 0, s * 0.5));
      rot(ch.on(torus(0.035, 0.014, mat(INK, 0.4), Math.PI), s * 0.045, 0.1, 0.005), 0, 0, Math.PI);
      const f = ch.on(cone(0.045, 0.1, white, 12), s * 0.13, -0.17, 0.035); f.rotation.x += Math.PI;
      [[0.6, 1.04, -0.5, 0.2], [0.82, 1.12, -0.52, 0.16], [0.8, 0.9, -0.54, 0.15], [0.98, 1.0, -0.54, 0.11]].forEach(([x, y, z, r]) => ch.squash.add(sph(r, white, s * x, y, z, 1, 1, 0.7)));
    });
    ch.on(torus(0.085, 0.03, mat(0x86bdea, 0.7)), 0, 0.42, 0);
    eyes(ch, { x: 0.27, y: 0.1, r: 0.06, style: 'dot' });
    [-1, 1].forEach((s) => ch.on(sph(0.12, mat(0xffb3a0, 0.8), 0, 0, 0, 1.2, 0.8, 0.35), s * 0.5, -0.12, 0.045));
    ch.on(sph(0.23, mat(0xc4504e, 0.6), 0, 0, 0, 1.15, 0.8, 0.2), 0, -0.26, 0); ch.on(sph(0.15, mat(0xf79aa8, 0.7), 0, 0, 0, 1.1, 0.6, 0.2), 0, -0.33, 0.02);
    const tail = new T.Group(); tail.position.set(0, 0.36, -0.5);
    tail.add(tube([[0, 0, 0], [0.3, -0.08, -0.22], [0.52, 0.12, -0.26], [0.56, 0.36, -0.22]], 0.085, skyM));
    [[0.56, 0.42, -0.22, 0.1], [0.48, 0.5, -0.22, 0.07], [0.65, 0.5, -0.22, 0.07]].forEach(([x, y, z, r]) => tail.add(sph(r, cream, x, y, z)));
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  } });

  // 부산대 산지니 — 파란 달걀형 새(한 덩어리 몸) · 머리 위 깃 세 갈래 · 큰 눈 · 노란 부리·발 · 톱니 모양 흰 가슴 털 / 과잠: PNU Blue(#005BAA) · 흰 P
  register('pnu', { school: '부산대학교', name: '산지니', build() {
    const root = new T.Group(), squash = new T.Group(); root.add(squash);
    const B = 0x4a8be0, YL = 0xf8d44c, blue = mat(B, 0.75), yel = mat(YL, 0.6), white = mat(0xffffff, 0.8), J0 = 0.2, J1 = 0.6;
    const e = eggBase(squash, { H: 1.9, W: 0.98, Y0: 0.28, color: B, belly: 0xffffff, bellyTop: J1 - 0.04 });
    const arms = eggJacket(e, { t0: J0, t1: J1, color: 0x005baa, letter: 'P', hand: B });
    [-1, 1].forEach((s) => {
      const leg = cyl(0.06, 0.06, 0.34, yel, 12); leg.position.set(s * 0.24, 0.2, 0); squash.add(leg);
      [-1, 0, 1].forEach((k) => squash.add(rot(sph(0.085, yel, s * 0.24 + k * 0.1, 0.07, 0.14, 0.85, 0.7, 2), 0, k * 0.3, 0)));
    });
    const head = new T.Group(), PY = 1.2; head.position.y = PY; squash.add(head);
    const onFace = (o, t, phi, off) => { e.place(o, t, phi, off); o.position.y -= PY; head.add(o); return o; };
    const w = new T.MeshBasicMaterial({ color: 0xffffff });
    const eyeG = [-1, 1].map((s) => {
      const g = new T.Group();
      g.add(sph(0.2, white, 0, 0, 0, 1.05, 1, 0.3)); g.add(sph(0.13, mat(INK, 0.35), -s * 0.03, 0, 0.04, 1, 1, 0.45));
      g.add(sph(0.045, w, -s * 0.03 + 0.05, 0.055, 0.1)); g.add(sph(0.02, w, -s * 0.03 - 0.05, -0.05, 0.1));
      onFace(sph(0.05, mat(0x1f3f86, 0.5), 0, 0, 0, 1.6, 0.45, 0.4), 0.895, s * 0.3, 0.0).rotateZ(-s * 0.35);
      onFace(sph(0.1, mat(0xff9fa0, 0.8), 0, 0, 0, 1.25, 0.8, 0.25), 0.69, s * 0.62, -0.01);
      return onFace(g, 0.78, s * 0.32, -0.02);
    });
    onFace(sph(0.11, yel, 0, 0, 0, 1.35, 0.8, 1.1), 0.7, 0, 0.0); onFace(sph(0.07, mat(0xe0a92a, 0.6), 0, 0, 0, 1.3, 0.5, 1), 0.675, 0, 0.0);
    const ears = [[-0.14, -0.1, 0.3, 0.07], [0.02, 0.1, 0.46, 0.085], [0.2, 0.34, 0.34, 0.075]].map(([x0, dx, hgt, r]) => {
      const g = new T.Group(); g.position.set(x0, e.yy(0.97) - PY - 0.05, 0);
      g.add(tube([[0, 0, 0], [dx * 0.3, hgt * 0.6, 0], [dx + 0.12, hgt, 0]], r, blue)); g.add(sph(r, blue, dx + 0.12, hgt, 0));
      head.add(g); return g;
    });
    return { root, squash, head, arms, eyes: eyeG, ears, look: 0.4, scale: 0.9 };
  } });

  // 가톨릭대 하양이 — 흰 뭉게 양털 머리의 어린양 · 갈색 돌돌 말린 뿔 · 분홍 볼 · 분홍 입 / 과잠: 가대 Blue(#0C2E86) · 흰 C
  register('cuk', { school: '가톨릭대학교', name: '하양이', build() {
    const F = 0xfff8ef, WL = 0xf1f7ff, HB = 0x8a5a3c, wool = mat(WL, 0.9), horn = mat(HB, 0.7);
    const ch = chibi({ body: F, hand: 0xffffff, feet: 0xffffff, jacket: { color: 0x0c2e86, letter: 'C' } }), h = ch.head;
    h.add(sph(0.36, wool, 0, 0.6, -0.02));
    const ring = (y, rad, n, a0, a1, r) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / (n - 1); h.add(sph(r, wool, Math.sin(a) * rad, y, Math.cos(a) * rad)); } };
    ring(0.44, 0.46, 9, 0, Math.PI * 16 / 9, 0.28); ring(0.16, 0.66, 7, 1.15, Math.PI * 2 - 1.15, 0.29); ring(-0.18, 0.62, 5, 1.7, Math.PI * 2 - 1.7, 0.26);
    ch.on(torus(0.07, 0.022, mat(0xdfe9f7, 0.8)), 0.08, 0.4, 0.2);
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * 0.93, 0.14, 0.1); g.rotation.y = s * 1.2;
      g.add(torus(0.13, 0.075, horn)); g.add(sph(0.075, horn, 0, 0, 0.02)); g.add(sph(0.06, horn, 0.02, -0.2, 0.03));
      h.add(g); ch.ears.push(g);
    });
    eyes(ch, { x: 0.2, y: -0.02, r: 0.055, style: 'dot' });
    cheeks(ch, { x: 0.4, y: -0.2, r: 0.11 });
    ch.on(sph(0.05, mat(0xf0668a, 0.6), 0, 0, 0, 1.1, 0.9, 0.4), 0, -0.2, 0);
    ch.squash.add(sph(0.16, wool, 0, 0.4, -0.62));
    return ch;
  } });
})();
