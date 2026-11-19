/* 학교별 마스코트 — kit.js 의 K 로 빚는다 (part-1: 경희 · 서울 · 연세 · 서강 · 성균관 · 한양 · 중앙 · 서울시립) */
(function () {
  'use strict';
  if (!window.K) return;
  const { mat, sph, cyl, cone, box, torus, tube, chibi, eyes, cheeks, muzzle, ear, smile, tailChain, register } = K;
  const INK = 0x22283a;
  // 얼굴을 두르는 갈기 — 뒤통수 한 덩어리 + 둘레 구슬 (from~to 각도 · 도 단위, 0 = 오른쪽 · 90 = 정수리)
  const mane = (ch, col, o) => {
    const m = mat(col, 0.8); ch.head.add(sph(o.back || 0.8, m, 0, 0.02, -0.3));
    for (let i = 0; i < o.n; i++) { const a = (o.from + (o.to - o.from) * i / (o.n - 1)) * Math.PI / 180; ch.head.add(sph(o.r, m, Math.cos(a) * o.rad * 1.06, Math.sin(a) * o.rad, o.z || 0)); }
  };
  // 벌린 입 (안쪽 + 혀)
  const mouth = (ch, y, w, col) => { ch.on(sph(w, mat(col == null ? 0x7a2a2a : col, 0.5), 0, 0, 0, 1, 0.8, 0.3), 0, y, -0.01); ch.on(sph(w * 0.55, mat(0xff8f8f, 0.6), 0, 0, 0, 1, 0.6, 0.3), 0, y - w * 0.35, 0.012); };
  // 눈썹 한 쌍 — tilt + 면 안쪽이 내려간다(야무진 표정)
  const brows = (ch, x, y, w, tilt, col) => [-1, 1].forEach((s) => { const b = sph(w, mat(col == null ? INK : col, 0.5), 0, 0, 0, 1, 0.26, 0.3); ch.on(b, s * x, y, 0.005); b.rotateZ(s * tilt); });

  // 경희대 쿠옹 — 황갈색 웃는 사자 · 얼굴을 두른 진홍 갈기 · 흰 장갑 · 꼬리 끝 진홍 / 과잠: Kyung Hee Red · 흰 K
  register('khu', { school: '경희대학교', name: '쿠옹', build() {
    const TAN = 0xc8894e, RED = 0xa4161c;
    const ch = chibi({ body: TAN, belly: 0xe9c08a, hand: 0xffffff, jacket: { color: 0xa40f16, letter: 'K' } });
    mane(ch, RED, { n: 13, from: -40, to: 220, r: 0.24, rad: 0.75, z: -0.06 });
    ear(ch, { color: TAN, inner: 0x7a4a2a, x: 0.52, y: 0.6, z: 0.26, r: 0.17 });
    eyes(ch, { x: 0.25, y: 0.06, r: 0.08, style: 'dot' });
    cheeks(ch, { x: 0.43, y: -0.14, r: 0.09 });
    muzzle(ch, { color: 0xe9c08a, nose: 0x5a3320, w: 1.25, y: -0.16, r: 0.22 });
    mouth(ch, -0.33, 0.085);
    tailChain(ch, [TAN, TAN, TAN, TAN, RED], 0.13);
    return ch;
  } });

  // 서울대 스누베어 — 크림색 테디베어 · 작은 까만 눈 · 갈색 코 · 파란 학사모(생협 졸업 곰) / 과잠: SNU Blue · 흰 S
  register('snu', { school: '서울대학교', name: '스누베어', build() {
    const CR = 0xfaf3e3, BL = 0x1c2fa8;
    const ch = chibi({ body: CR, belly: 0xffffff, jacket: { color: 0x0f0f70, letter: 'S' } });
    ear(ch, { color: CR, inner: 0xf1dcc0, x: 0.5, y: 0.52, r: 0.22 });
    eyes(ch, { x: 0.24, y: 0.04, r: 0.062, style: 'dot' });
    cheeks(ch, { x: 0.43, y: -0.16, r: 0.09 });
    muzzle(ch, { color: 0xffffff, nose: 0x5b3a2e, w: 1.2, r: 0.24 });
    smile(ch, { y: -0.32, r: 0.06 });
    const cap = new K.T.Group(); cap.position.set(0.24, 0.66, 0.06); cap.rotation.z = -0.32; ch.head.add(cap);
    const band = cyl(0.24, 0.27, 0.16, mat(BL, 0.7)); cap.add(band);
    const top = box(0.66, 0.05, 0.66, mat(BL, 0.7)); top.position.y = 0.1; top.rotation.y = Math.PI / 4; cap.add(top);
    cap.add(sph(0.04, mat(0xffffff), 0, 0.14, 0));
    cap.add(tube([[0, 0.14, 0], [0.2, 0.13, 0.2], [0.36, 0.02, 0.3], [0.37, -0.16, 0.3]], 0.014, mat(0xffffff)));
    cap.add(sph(0.045, mat(0xffffff), 0.37, -0.2, 0.3, 1, 1.5, 1));
    return ch;
  } });

  // 연세대 독수리 — 청회색 독수리 · 노란 갈고리 부리·눈썹·발 · 뒤로 뻗친 머리깃 · 꽁지깃 (원작은 6~7등신 근육질 — 2등신으로 줄였다) / 과잠: YONSEI Blue · 흰 Y
  const buildEagle = () => {
    const G = 0x97a4b0, GL = 0xc3ccd4, YL = 0xf6bb2b;
    const ch = chibi({ body: G, belly: GL, feet: YL, jacket: { color: 0x003876, letter: 'Y' } });
    const g = mat(G, 0.75), y = mat(YL, 0.5);
    [[0, 0.58, -0.5, 1.5], [-0.24, 0.46, -0.52, 1.2], [0.24, 0.46, -0.52, 1.2], [0, 0.26, -0.7, 1.2]].forEach(([x, yy, z, l]) => { const f = sph(0.2, g, x, yy + 0.04, z - 0.1, 0.5, 0.3, l * 1.35); f.rotation.x = -0.75; f.rotation.y = x * 1.4; ch.head.add(f); });
    eyes(ch, { x: 0.27, y: 0.05, r: 0.1 });
    brows(ch, 0.27, 0.21, 0.14, 0.3, YL);
    cheeks(ch, { x: 0.47, y: -0.15 });
    ch.head.add(sph(0.17, y, 0, -0.14, ch.R - 0.03, 1, 0.78, 1.25));
    const tip = cone(0.085, 0.2, y, 16); tip.position.set(0, -0.25, ch.R + 0.13); tip.rotation.x = Math.PI * 0.92; ch.head.add(tip);
    const tail = new K.T.Group(); tail.position.set(0, 0.42, -0.5);
    [-1, 0, 1].forEach((s) => { const f = sph(0.16, g, s * 0.15, -0.06, -0.2, 0.7, 0.3, 1.8); f.rotation.x = 0.5; f.rotation.y = s * 0.3; tail.add(f); });
    ch.squash.add(tail); ch.tail = tail;
    return ch;
  };
  register('yonsei', { school: '연세대학교', name: '독수리', build: buildEagle });
  register('yonsei-mirae', { school: '연세대학교 미래캠퍼스', name: '독수리', build: () => K.MASCOTS.yonsei.build() });

  // 서강대 알로스 — 흰 통통한 알바트로스 · 검은 눈썹 · 납작한 주황 부리 · 정수리 깃 둘 · 짙은 회색 날개 끝·발 / 과잠: Sogang Cardinal · 흰 SG
  register('sogang', { school: '서강대학교', name: '알로스', build() {
    const W = 0xfdfdfb, DK = 0x3f3f41, OR = 0xeea52e;
    const ch = chibi({ body: W, hand: DK, feet: DK, headR: 0.8, headY: 1.84, headSx: 1.12, headSy: 0.9, jacket: { color: 0xb30000, letter: 'SG' } });
    eyes(ch, { x: 0.25, y: -0.02, r: 0.095, style: 'dot', color: DK }); ch.eyes.forEach((e) => { e.scale.y = 1.3; });
    brows(ch, 0.27, 0.2, 0.13, 0.22, DK);
    ch.head.add(sph(0.2, mat(OR, 0.55), 0, -0.22, ch.R - 0.06, 1.3, 0.5, 0.9));
    const lip = torus(0.1, 0.016, mat(DK, 0.5), Math.PI); lip.rotation.z = Math.PI; lip.position.set(0, -0.17, ch.R + 0.115); lip.scale.y = 0.45; ch.head.add(lip);
    cheeks(ch, { x: 0.5, y: -0.2 });
    [[-0.07, -0.1, 0.34], [0.1, 0.22, 0.24]].forEach(([x, lean, h]) => { const f = sph(0.11, mat(W, 0.75), x + lean * 0.5, 0.72 + h * 0.5, 0, 0.75, h / 0.11 * 0.6, 0.6); f.rotation.z = -lean * 2; ch.head.add(f); });
    return ch;
  } });

  // 성균관대 율전이 — 유생 · 검은 유건 · 살구색 얼굴 · 짧은 검은 머리 · 굵은 눈썹 · 남색 쾌자 (원작 옷은 유생복 — 과잠으로 갈아입혔다) / 과잠: #072A60 · 흰 S
  register('skku', { school: '성균관대학교', name: '율전이', build() {
    const SK = 0xffdcc0, BK = 0x1c1c22;
    const ch = chibi({ body: 0x2a4aa0, belly: 0xffffff, head: SK, hand: SK, feet: BK, jacket: { color: 0x072a60, letter: 'S' } });
    const k = mat(BK, 0.85);
    ch.head.add(sph(0.75, k, 0, 0.1, -0.1, 1.05, 0.92, 0.98));                        // 머리카락
    [-1, 1].forEach((s) => ch.head.add(sph(0.16, k, s * 0.6, 0.12, 0.3, 0.6, 1.5, 0.8)));   // 구레나룻
    const hat = cyl(0.86, 0.72, 0.5, k, 4); hat.rotation.y = Math.PI / 4; hat.position.set(0, 0.66, -0.04); hat.scale.z = 0.72; ch.head.add(hat);   // 유건 — 위가 넓은 네모 두건
    [-1, 1].forEach((s) => ch.head.add(sph(0.13, k, s * 0.5, 0.9, -0.04, 1, 0.8, 1.6)));
    ear(ch, { color: SK, x: 0.74, y: -0.06, z: 0.02, r: 0.13 });
    eyes(ch, { x: 0.25, y: -0.02, r: 0.115 });
    brows(ch, 0.26, 0.19, 0.13, 0.08, BK);
    cheeks(ch, { x: 0.45, y: -0.2 });
    mouth(ch, -0.3, 0.12);
    return ch;
  } });

  // 한양대 하이리온 — 노란 사자 · 위로 한 가닥 솟은 파란 갈기 · 파란 코 · 흰 주둥이 · 꼬리 끝 파랑 / 과잠: HANYANG BLUE · 흰 H
  register('hanyang', { school: '한양대학교', name: '하이리온', build() {
    const Y = 0xffd98a, B = 0x0077c8;
    const ch = chibi({ body: Y, belly: 0xfff4d6, jacket: { color: 0x0e4a84, letter: 'H' } });
    mane(ch, B, { n: 11, from: -20, to: 200, r: 0.26, rad: 0.77, z: -0.08, back: 0.84 });
    ch.head.add(tube([[-0.1, 0.7, 0.05], [0.0, 1.0, 0.05], [0.2, 1.16, 0.05], [0.38, 1.08, 0.05]], 0.15, mat(B, 0.8)));
    ch.head.add(sph(0.15, mat(B, 0.8), 0.38, 1.08, 0.05));
    ear(ch, { color: Y, inner: 0xffecc0, x: 0.54, y: 0.5, z: 0.3, r: 0.16 });
    eyes(ch, { x: 0.24, y: 0.0, r: 0.06, style: 'dot' });
    brows(ch, 0.24, 0.14, 0.075, 0.35);
    cheeks(ch, { x: 0.44, y: -0.16, r: 0.09 });
    muzzle(ch, { color: 0xffffff, nose: B, w: 1.2, y: -0.2, r: 0.2, noseR: 0.065 });
    tailChain(ch, [Y, Y, Y, Y, B], 0.15);
    return ch;
  } });

  // 중앙대 푸앙 — 하늘색 아기 청룡 · 베이지 사슴뿔 · 양옆으로 말린 긴 수염 · 흰 눈썹·송곳니 · 꼬리 끝 분홍 꽃 / 과잠: CAU BLUE · 흰 C
  register('cau', { school: '중앙대학교', name: '푸앙', build() {
    const S = 0x6cc5f1, NV = 0x1b2a5c, BG = 0xd9b98c, PK = 0xf6b3cf;
    const ch = chibi({ body: S, belly: 0xffffff, jacket: { color: 0x2155a4, letter: 'C' } });
    const bg = mat(BG, 0.7), nv = mat(NV, 0.5);
    [-1, 1].forEach((s) => {
      ch.head.add(tube([[s * 0.2, 0.6, 0], [s * 0.26, 0.86, 0], [s * 0.3, 1.1, 0]], 0.065, bg)); ch.head.add(sph(0.065, bg, s * 0.3, 1.1, 0));
      ch.head.add(tube([[s * 0.25, 0.82, 0], [s * 0.42, 0.9, 0], [s * 0.48, 1.0, 0]], 0.055, bg)); ch.head.add(sph(0.055, bg, s * 0.48, 1.0, 0));
      ch.head.add(tube([[s * 0.27, 0.9, 0], [s * 0.16, 0.98, 0], [s * 0.13, 1.06, 0]], 0.05, bg)); ch.head.add(sph(0.05, bg, s * 0.13, 1.06, 0));
      const e = cone(0.11, 0.24, mat(S, 0.75), 12); e.position.set(s * 0.72, 0.34, 0); e.rotation.z = -s * 1.0; ch.head.add(e); ch.ears.push(e);
      ch.head.add(tube([[s * 0.36, -0.14, 0.62], [s * 0.7, -0.16, 0.4], [s * 1.0, -0.12, 0.2], [s * 1.16, 0.02, 0.2], [s * 1.08, 0.12, 0.2], [s * 1.0, 0.04, 0.2]], 0.02, nv));
      const f = cone(0.035, 0.08, mat(0xffffff, 0.5), 10); ch.on(f, s * 0.16, -0.22, 0.0); f.rotateX(Math.PI);
    });
    ch.head.add(sph(0.1, mat(S, 0.75), 0, 0.68, 0.1, 1, 0.9, 1));
    eyes(ch, { x: 0.25, y: 0.0, r: 0.075, style: 'dot', color: NV }); ch.eyes.forEach((e) => { e.scale.y = 1.3; });
    brows(ch, 0.24, 0.17, 0.085, 0.4, 0xffffff);
    cheeks(ch, { x: 0.47, y: -0.16, r: 0.11, color: 0xfbd3e4 });
    smile(ch, { y: -0.17, r: 0.045, color: NV }); ch.on(sph(0.035, nv, 0, 0, 0, 1.3, 0.6, 0.5), 0, -0.08, 0);
    tailChain(ch, [S, S, S, S, PK], 0.1);
    const tip = ch.tail.children[4]; [0, 1, 2].forEach((i) => { const a = (i - 1) * 0.9; ch.tail.add(sph(0.09, mat(PK, 0.7), tip.position.x + Math.sin(a) * 0.1, tip.position.y + Math.cos(a) * 0.1, tip.position.z, 0.75, 1.2, 0.6)); });
    return ch;
  } });

  // 서울시립대 이루매 — 갈색 후드 같은 머리(뒤로 뾰족) · 흰 얼굴과 몸 · 벌린 노란 부리 · 노란 발 / 과잠: UOS Blue · 흰 U
  register('uos', { school: '서울시립대학교', name: '이루매', build() {
    const BR = 0x8f6252, W = 0xffffff, YL = 0xfdb913, DK = 0x5a3a22;
    const ch = chibi({ body: W, feet: YL, jacket: { color: 0x004094, letter: 'U' } });
    const br = mat(BR, 0.8);
    ch.head.add(sph(0.82, br, 0, 0.05, -0.15, 1.05, 0.96, 1));
    const tip = cone(0.36, 1.0, br, 18); tip.position.set(0.42, 0.6, -0.5); tip.rotation.set(-0.7, 0, -0.85); ch.head.add(tip);
    for (let i = 0; i < 7; i++) { const a = (200 + i * 23.3) * Math.PI / 180; ch.head.add(sph(0.17, br, Math.cos(a) * 0.6, -0.66, Math.sin(a) * 0.5 - 0.22)); }
    eyes(ch, { x: 0.3, y: 0.06, r: 0.075, style: 'dot', color: DK }); ch.eyes.forEach((e) => { e.scale.y = 1.3; });
    cheeks(ch, { x: 0.43, y: -0.14, r: 0.09 });
    const beak = sph(0.17, mat(YL, 0.5), 0, -0.1, ch.R - 0.02, 1, 0.9, 1.1); ch.head.add(beak);
    ch.head.add(sph(0.11, mat(0xdb3a2e, 0.5), 0, -0.14, ch.R + 0.085, 1, 0.75, 0.6));
    return ch;
  } });
})();
