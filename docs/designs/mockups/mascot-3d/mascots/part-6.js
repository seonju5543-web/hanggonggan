/* 학교별 마스코트 — 2026-11-19 에 더한 학교 */
(function () {
  'use strict';
  if (!window.K) return;
  const { mat, sph, tube, chibi, eyes, cheeks, ear, smile, register } = K;

  /* 성신여대 수룡이 — 2017 재학생 캐릭터 공모전 당선작(개발자 제공 그림). 흰 몸의 아기 용 · 보라 사슴뿔 · 이마 소용돌이 · 큰 눈 ·
     끝이 말린 꼬리 · 품에 안은 수정 구슬. 과잠 보라는 그림의 주조색(Sungshin Bright Violet)을 눈으로 맞춘 임시 값 */
  register('sungshin', { school: '성신여자대학교', name: '수룡이', build() {
    const W = 0xf6f3ff, V = 0x4a3f9f, L = 0xb9b3ea;
    const ch = chibi({ body: W, belly: 0xffffff, jacket: { color: V, letter: 'S' } });
    eyes(ch, { x: 0.27, y: 0.02, r: 0.12 });
    cheeks(ch, { x: 0.47, y: -0.17, color: 0xf7b9d3 });
    smile(ch, { y: -0.22, r: 0.08, color: V });
    ear(ch, { x: 0.66, y: 0.12, r: 0.13, color: W, inner: L, sx: 1.4, sy: 0.75 });
    // 사슴뿔 — 줄기 하나에 가지 둘
    [-1, 1].forEach((s) => {
      const m = mat(V, 0.6);
      ch.head.add(tube([[s * 0.24, 0.56, 0], [s * 0.32, 0.86, 0], [s * 0.5, 1.08, 0]], 0.045, m));
      ch.head.add(tube([[s * 0.31, 0.8, 0], [s * 0.18, 0.98, 0]], 0.036, m));
      ch.head.add(tube([[s * 0.4, 0.96, 0], [s * 0.6, 0.94, 0]], 0.034, m));
      [[0.5, 1.08], [0.18, 0.98], [0.6, 0.94]].forEach(([x, y]) => ch.head.add(sph(0.05, m, s * x, y, 0)));
    });
    // 이마 소용돌이
    const swirl = K.torus(0.075, 0.02, mat(L, 0.6), Math.PI * 1.5); ch.on(swirl, 0, 0.36, 0.005);
    // 끝이 말린 꼬리
    const tail = new K.T.Group(); tail.position.set(0, 0.42, -0.5);
    tail.add(tube([[0, 0, 0], [0.2, 0.1, -0.22], [0.42, 0.34, -0.26], [0.4, 0.62, -0.2], [0.24, 0.64, -0.18], [0.26, 0.48, -0.2]], 0.085, mat(W, 0.75)));
    tail.add(sph(0.1, mat(L, 0.7), 0.26, 0.48, -0.2)); ch.squash.add(tail); ch.tail = tail;
    // 수정 구슬 — 앞섶 앞에 품는다
    ch.squash.add(sph(0.2, mat(0x8f86e6, 0.25, 0.1), 0, 0.72, 0.62));
    ch.squash.add(sph(0.055, new K.T.MeshBasicMaterial({ color: 0xffffff }), 0.07, 0.8, 0.78));
    return ch;
  } });
})();
