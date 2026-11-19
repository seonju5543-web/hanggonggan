/* 학교별 마스코트 — 본보기 (다른 part-*.js 가 이 꼴을 따른다) */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, mat, sph, chibi, eyes, cheeks, muzzle, ear, tailChain, register } = K;

  // 고려대 호이 — 둥근 노란 호랑이 · 이마 검은 줄 셋 · 볼 옆 줄무늬 · 흰 주둥이 · 줄무늬 꼬리 / 과잠: 크림슨(#8B0029) · 흰 K
  register('korea', { school: '고려대학교', name: '호이', build() {
    const Y = 0xf7b23b, D = 0x3a2a22;
    const ch = chibi({ body: Y, belly: 0xfff6e0, jacket: { color: 0x8b0029, letter: 'K' } });
    ear(ch, { color: Y, inner: 0xfff6e0, x: 0.46, y: 0.5, r: 0.19 });
    eyes(ch, { x: 0.26, y: 0.04, r: 0.085, style: 'dot' });
    cheeks(ch, { x: 0.46, y: -0.16 });
    muzzle(ch, { color: 0xfff6e0, nose: 0x7a3b2e, w: 1.3 });
    [[0, 0.55, 1.2], [-0.19, 0.5, 0.9], [0.19, 0.5, 0.9]].forEach(([x, y, l]) => { const s = sph(0.09, mat(D), 0, 0, 0, 0.42, l, 0.45); ch.on(s, x, y, -0.03); });
    [-1, 1].forEach((s) => [0.1, -0.1].forEach((y) => { const st = sph(0.09, mat(D), s * 0.71, y, 0.2, 0.3, 0.36, 1.2); st.rotation.y = s * 0.3; ch.head.add(st); }));
    tailChain(ch, [Y, D, Y, D, Y, D], 0.12);
    return ch;
  } });
  register('korea-sejong', { school: '고려대학교 세종캠퍼스', name: '호이', build: () => K.MASCOTS.korea.build() });
})();
