/* 학교별 마스코트 — kit.js 의 K 로 빚는다 (건국 · 동국 · 홍익 · 숙명 · 광운 · 명지 · 상명 · 가천) */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, mat, sph, cyl, cone, torus, tube, box, chibi, eyes, cheeks, smile, tailChain, register, INK } = K;

  // 머리 묶음에 붙이는 작은 도우미들 (원점 = 머리 중심)
  const put = (ch, o, x, y, z, rz, rx) => { o.position.set(x, y, z); if (rz) o.rotation.z = rz; if (rx) o.rotation.x = rx; ch.head.add(o); return o; };
  // 납작한 귀(옆으로 뻗거나 늘어진 귀) 한 쌍 — 살랑이는 ch.ears 에 넣는다. tilt: 바깥쪽이 처지는 각
  function flap(ch, o) {
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * o.x, o.y, o.z || 0);
      const p = new T.Group(); p.rotation.z = -s * (o.tilt || 0); g.add(p);
      p.add(sph(o.r, mat(o.color, 0.75), s * o.r * (o.sx || 1) * 0.7, 0, 0, o.sx || 1, o.sy || 1, o.sz || 0.3));
      if (o.inner != null) p.add(sph(o.r * 0.62, mat(o.inner, 0.8), s * o.r * (o.sx || 1) * 0.7, 0, o.r * (o.sz || 0.3) * 0.72, o.sx || 1, o.sy || 1, 0.12));
      ch.head.add(g); ch.ears.push(g);
    });
  }
  // 튀어나온 주둥이 + 콧구멍 둘 + 웃는 입
  function snout(ch, o) {
    const r = o.r, z = o.z, f = z + r * (o.sz || 0.8);
    put(ch, sph(r, mat(o.color, 0.75), 0, 0, 0, o.w || 1.3, o.h || 0.8, o.sz || 0.8), 0, o.y, z);
    [-1, 1].forEach((s) => put(ch, sph(0.026, mat(o.ink || INK, 0.4)), s * (o.nx || 0.1), o.y + r * 0.3, f - 0.035));
    const q = torus(o.mr || 0.08, 0.02, mat(o.ink || INK, 0.4), Math.PI); put(ch, q, 0, o.y - r * 0.12, f - 0.02, Math.PI, 0.25);
  }
  const hornPair = (ch, x, y, r, h, col, lean) => [-1, 1].forEach((s) => put(ch, cone(r, h, mat(col, 0.6), 16), s * x, y, 0, -s * lean));
  const pointEar = (ch, x, y, col, inner) => [-1, 1].forEach((s) => {
    const g = new T.Group(); g.position.set(s * x, y, 0); const p = new T.Group(); p.rotation.z = -s * 0.3; g.add(p);
    const c = cone(0.15, 0.36, mat(col, 0.75), 16); c.position.y = 0.14; p.add(c);
    const i = cone(0.08, 0.24, mat(inner, 0.75), 12); i.position.set(0, 0.12, 0.07); p.add(i);
    ch.head.add(g); ch.ears.push(g);
  });

  // 건국대 쿠 — 노란 송아지 · 크림색 큰 주둥이 · 작은 크림 뿔 · 이마 곱슬 한 가닥 · 갈색 꼬리 술 / 과잠: 녹색(#00703E) · 흰 K
  register('konkuk', { school: '건국대학교', name: '쿠', build() {
    const Y = 0xf5c86e, C = 0xf6ead4, BR = 0x6b4a36;
    const ch = chibi({ body: Y, belly: 0xfde6b8, jacket: { color: 0x00703e, letter: 'K' } });
    flap(ch, { x: 0.6, y: 0.2, r: 0.26, sx: 1.25, sy: 0.72, sz: 0.4, color: Y, inner: 0xfde6b8, tilt: 0.25 });
    hornPair(ch, 0.4, 0.68, 0.085, 0.26, C, 0.5);
    snout(ch, { color: C, r: 0.4, y: -0.2, z: 0.36, w: 1.42, h: 0.72, sz: 0.86, ink: BR, nx: 0.12, mr: 0.09 });
    eyes(ch, { x: 0.25, y: 0.16, r: 0.075, style: 'dot', color: BR });
    put(ch, tube([[-0.06, 0.4, 0.61], [-0.02, 0.53, 0.52], [0.08, 0.56, 0.48], [0.1, 0.46, 0.57]], 0.024, mat(BR, 0.5)), 0, 0, 0);
    tailChain(ch, [Y, Y, Y, BR], 0.13);
    return ch;
  } });

  // 동국대 아코 — 흰 아기 코끼리 · 늘어진 큰 귀 · 주황 타원 볼 · 짧은 코 / 과잠: 주황(#E17100) · 흰 D
  register('dongguk', { school: '동국대학교', name: '아코', build() {
    const W = 0xfffaf3, O = 0xf08a1c;
    const ch = chibi({ body: W, jacket: { color: 0xe17100, letter: 'D' } });
    flap(ch, { x: 0.5, y: 0.06, z: -0.08, r: 0.46, sx: 0.85, sy: 1.12, sz: 0.24, color: W, inner: 0xf2dcc0, tilt: 0.28 });
    eyes(ch, { x: 0.2, y: 0.1, r: 0.06, style: 'dot' });
    cheeks(ch, { x: 0.4, y: -0.14, r: 0.13, color: O });
    put(ch, tube([[0, -0.1, 0.62], [0, -0.16, 0.86], [0, -0.36, 0.88], [0, -0.44, 0.76]], 0.1, mat(W, 0.75)), 0, 0, 0);
    put(ch, sph(0.1, mat(W, 0.75)), 0, -0.44, 0.76);
    put(ch, tube([[0, 0.66, 0.1], [0.03, 0.82, 0.12], [0.12, 0.84, 0.12]], 0.022, mat(0xd9c2a4, 0.6)), 0, 0, 0);
    [-1, 1].forEach((s) => ch.squash.add(sph(0.07, mat(O, 0.8), s * 0.25, 0.14, 0.4, 1.2, 0.8, 0.5)));
    return ch;
  } });
  register('dongguk-wise', { school: '동국대학교 WISE캠퍼스', name: '아코', build: () => K.MASCOTS.dongguk.build() });

  // 홍익대 와우 — 흰 송아지 · 남색 앞머리 무늬 · 굵은 흰 눈썹 · ω 입 · 살구색 볼 / 과잠: 남색(#05014A) · 흰 H
  register('hongik', { school: '홍익대학교', name: '와우', build() {
    const W = 0xffffff, N = 0x0c1f52, P = 0xf0c394;
    const ch = chibi({ body: W, jacket: { color: 0x05014a, letter: 'H' } });
    flap(ch, { x: 0.6, y: 0.12, r: 0.27, sx: 1.3, sy: 0.7, sz: 0.36, color: W, inner: P, tilt: 0.2 });
    hornPair(ch, 0.36, 0.74, 0.12, 0.36, W, 0.35);
    ch.on(sph(0.4, mat(N, 0.7), 0, 0, 0, 1.05, 0.72, 0.2), 0, 0.5, -0.06);
    ch.on(sph(0.17, mat(N, 0.7), 0, 0, 0, 1.1, 1.0, 0.3), 0, 0.3, -0.04);
    eyes(ch, { x: 0.27, y: -0.04, r: 0.12, color: 0x10125a });
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.add(box(0.27, 0.085, 0.05, mat(N, 0.6))); const w = box(0.235, 0.05, 0.05, mat(W, 0.6)); w.position.z = 0.015; g.add(w);
      ch.on(g, s * 0.27, 0.17, 0.0); g.rotation.z = -s * 0.24;
    });
    cheeks(ch, { x: 0.5, y: -0.2, r: 0.12, color: P });
    [-1, 1].forEach((s) => { const q = torus(0.045, 0.016, mat(N, 0.4), Math.PI); ch.on(q, s * 0.045, -0.24, 0.012); q.rotation.z = Math.PI; });
    return ch;
  } });

  // 숙명여대 눈송이 — 남색 눈 결정(잎 다섯 갈래) 머리 장식 · 흰 얼굴 · 남색 옷 / 과잠: 로열 블루(#003087) · 노란 S
  register('sookmyung', { school: '숙명여자대학교', name: '눈송이', build() {
    const W = 0xffffff, N = 0x0b2a8f;
    const ch = chibi({ body: N, head: W, hand: W, feet: N, jacket: { color: 0x003087, letter: 'S', letterColor: '#FFB500' } });
    put(ch, sph(ch.R * 1.07, mat(N, 0.75), 0, 0, 0, 1.05, 0.95, 0.98), 0, 0.05, -0.15);
    [[90, 0.5, 0.86], [36, 0.42, 0.84], [144, 0.42, 0.84], [-12, 0.38, 0.84], [192, 0.38, 0.84]].forEach(([deg, r, d]) => {
      const a = deg * Math.PI / 180; put(ch, sph(r, mat(N, 0.75), 0, 0, 0, 0.85, 1.4, 0.3), Math.cos(a) * d, Math.sin(a) * d + 0.05, -0.16, a - Math.PI / 2);
    });
    ch.on(sph(0.15, mat(N, 0.75), 0, 0, 0, 0.9, 1.4, 0.3), 0, 0.52, -0.03);
    eyes(ch, { x: 0.24, y: 0.02, r: 0.085, color: 0x0b2a8f });
    cheeks(ch, { x: 0.44, y: -0.17, r: 0.09 });
    smile(ch, { y: -0.2, r: 0.08, color: N });
    return ch;
  } });

  // 광운대 비마(현행판) — 흰 아기 천마 · 자주색 갈기(이마 곱슬)·꼬리·발굽 · 작은 흰 날개 · 분홍 볼 / 과잠: 자주 갈색(#702732) · 흰 K
  register('kw', { school: '광운대학교', name: '비마', build() {
    const W = 0xffffff, M = 0x8c1c2e, mm = mat(M, 0.6);
    const ch = chibi({ body: W, feet: M, jacket: { color: 0x702732, letter: 'K' } });
    pointEar(ch, 0.45, 0.48, W, M);
    [[0.02, 0.6, 0.36, 0.2], [0, 0.76, 0.08, 0.25], [0, 0.62, -0.32, 0.23], [0, 0.3, -0.6, 0.19], [0.14, 0.93, 0.16, 0.12]].forEach(([x, y, z, r]) => put(ch, sph(r, mm), x, y, z));
    snout(ch, { color: W, r: 0.3, y: -0.2, z: 0.5, w: 1.35, h: 0.78, nx: 0.09 });
    eyes(ch, { x: 0.28, y: 0.08, r: 0.065, style: 'dot' });
    cheeks(ch, { x: 0.5, y: -0.1, r: 0.1, color: 0xf7b0a0 });
    [-1, 1].forEach((s) => [0, 1, 2].forEach((i) => {
      const f = sph(0.2, mat(W, 0.7), s * (0.74 + i * 0.02), 1.12 - i * 0.13, -0.3, 1.6 - i * 0.28, 0.42, 0.22); f.rotation.z = s * (0.6 - i * 0.3); ch.squash.add(f);
    }));
    tailChain(ch, [M, M, M, M], 0.14);
    return ch;
  } });

  // 명지대 마루 — 흰 말 · 뻗친 남색 갈기 · 이마 나뭇잎 3장 · 긴 주둥이 · 남색 발굽 / 과잠: 짙은 남색(#071D49) · 흰 M
  register('mju', { school: '명지대학교', name: '마루', build() {
    const W = 0xffffff, N = 0x1d3f8a, nm = mat(N, 0.6);
    const ch = chibi({ body: W, feet: N, jacket: { color: 0x071d49, letter: 'M' } });
    pointEar(ch, 0.4, 0.5, W, 0xbcd4f2);
    [-0.3, 0.1, 0.5, 0.9, 1.3, 1.7, 2.1].forEach((a, i) => {   // 정수리에서 목덜미까지 뒤로 뻗친 갈기
      const c = cone(0.19, 0.5, nm, 14); put(ch, c, (i % 2 ? 1 : -1) * 0.03, Math.cos(a) * 0.74, -Math.sin(a) * 0.72, 0, -a - 0.45);
    });
    snout(ch, { color: W, r: 0.3, y: -0.2, z: 0.54, w: 1.2, h: 0.8, sz: 0.95, nx: 0.09, ink: 0x2a3a66 });
    eyes(ch, { x: 0.3, y: 0.1, r: 0.075, style: 'dot', color: 0x16233f });
    cheeks(ch, { x: 0.52, y: -0.08, r: 0.1, color: 0xbcd4f2 });
    [[0, 0.44, 0], [-0.11, 0.4, 0.75], [0.11, 0.4, -0.75]].forEach(([x, y, rz]) => { const l = sph(0.075, mat(0x2f6fc4, 0.6), 0, 0, 0, 0.55, 1.2, 0.3); ch.on(l, x, y, 0.0); l.rotation.z = rz; });
    tailChain(ch, [N, N, N, N], 0.15);
    return ch;
  } });

  // 상명대 수뭉이 — 살구색 둥근 사슴 · 소나무 모양 갈색 뿔 · 분홍 볼 · 옆으로 누운 작은 귀 / 과잠: SM 블루(#0E207F) · 흰 S
  register('smu', { school: '상명대학교', name: '수뭉이', build() {
    const A = 0xf6cfa3, BR = 0x7a5a3c, bm = mat(BR, 0.6);
    const ch = chibi({ body: A, belly: 0xfde9d2, jacket: { color: 0x0e207f, letter: 'S' } });
    flap(ch, { x: 0.62, y: 0.3, r: 0.17, sx: 1.2, sy: 0.75, sz: 0.4, color: A, inner: 0xf7b3a6, tilt: -0.2 });
    [-1, 1].forEach((s) => {
      const g = new T.Group(); g.position.set(s * 0.24, 0.62, 0.02); g.rotation.z = -s * 0.22; ch.head.add(g);
      const st = cyl(0.04, 0.05, 0.5, bm, 10); st.position.y = 0.22; g.add(st); g.add(sph(0.045, bm, 0, 0.47, 0));
      [[0.2, 0.36], [0.34, 0.24]].forEach(([y, l]) => { const b = cyl(0.036, 0.036, l, bm, 10); b.rotation.z = Math.PI / 2; b.position.y = y; g.add(b); [-1, 1].forEach((k) => g.add(sph(0.036, bm, k * l / 2, y, 0))); });
    });
    eyes(ch, { x: 0.2, y: 0.0, r: 0.06, style: 'dot', color: 0x4a3526 });
    cheeks(ch, { x: 0.42, y: -0.16, r: 0.14, color: 0xf9a9a6 });
    ch.on(sph(0.04, mat(0x4a3526, 0.4), 0, 0, 0, 1.3, 0.8, 0.6), 0, -0.08, 0.0);
    ch.on(sph(0.055, mat(0xe8707a, 0.5), 0, 0, 0, 1, 1.1, 0.3), 0, -0.2, 0.0);
    ch.squash.add(sph(0.11, mat(A, 0.75), 0, 0.42, -0.56));
    return ch;
  } });

  // 가천대 무한이 — 연파랑 후드 · 머리 위 ∞ 고리 · 흰 얼굴에 진파랑 앞머리 · 주황 볼 / 과잠: 가천 블루(#004E96) · 흰 G
  register('gachon', { school: '가천대학교', name: '무한이', build() {
    const W = 0xffffff, L = 0xa9c8f0, B = 0x0a4fb4, lm = mat(L, 0.7);
    const ch = chibi({ body: L, head: W, hand: W, feet: W, jacket: { color: 0x004e96, letter: 'G' } });
    put(ch, sph(ch.R * 1.13, lm, 0, 0, 0, 1.05, 0.96, 0.98), 0, 0.04, -0.16);
    put(ch, sph(0.3, lm, 0, 0, 0, 0.9, 1.2, 0.9), 0, 0.74, -0.14);
    const loop = torus(0.25, 0.14, lm); put(ch, loop, 0.03, 1.28, -0.14); loop.rotation.y = 0.25;
    [-1, 1].forEach((s) => { const h = sph(0.3, mat(B, 0.55), 0, 0, 0, 1, 0.62, 0.22); ch.on(h, s * 0.2, 0.4, -0.03); h.rotation.z = -s * 0.42; });
    eyes(ch, { x: 0.2, y: 0.0, r: 0.065, style: 'dot', color: 0x111111 });
    cheeks(ch, { x: 0.42, y: -0.18, r: 0.12, color: 0xf2b22e });
    smile(ch, { y: -0.2, r: 0.07, color: 0x111111 });
    return ch;
  } });
})();
