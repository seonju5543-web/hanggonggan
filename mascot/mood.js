/* 마스코트 표정·몸짓 연출 (2026-11-21 개발자 지시 — 시안 docs/designs/mockups/mascot-3d/mood.html · 승인 전)

   kit.js 의 무대(Stage)가 매 프레임 정한 자세 위에 '마지막으로 얹는' 층이다(Stage opt.after · opt.beforeTap).
   부르지 않으면 앱 화면은 예전 그대로다. 45개교 캐릭터·대장님이 같은 뼈대(머리·눈·팔·과잠 묶음)를 쓰므로 부품은 한 벌로 모두에 붙는다.

   손짓(학생이 하는 것) → 반응 — 🔴 말풍선은 없다(11-21 개발자 지시 3차) · 몸짓·표정만으로 말한다
     · 1초에 4번 넘게 연타   → 화남: 눈썹·빨간 볼·김 → 두 손으로 깃을 잡고 어깨를 젖혀 과잠을 내리고 팔을 하나씩 소매에서 뺀다(맨팔) → 바닥에 내팽개친다 →
                              바닥의 몽둥이를 주워 머리 위로 → 팔꿈치를 굽혀 머리 뒤로 젖혔다가 쭉 펴며 던진다(ScreenHit — 앱 화면 전체에 날아와 유리가 깨진다) → 허리에 손 → 과잠을 다시 입는다
                              (팔꿈치 — 팔을 위팔·아래팔로 나눈다 rig.limbs · 11-21 4차)
     · 세게 빙글빙글 돌리기  → 어지러움: 소용돌이 눈 · 머리 위 별 · 비틀
     · 길게 누르기(0.7초)    → 쓰다듬기: 눈 감고 좋아함 · 그 캐릭터의 볼 자리가 분홍 · 하트
     · 아래로 끌어당기기     → 납작하게 찌그러졌다가 튕겨 오름
     · 20초 동안 안 건드림   → 꾸벅꾸벅 졸기(Zzz · 몸 전체로 꾸벅) · 건드리면 깜짝 놀라며 깬다(「!」)
   가리키는 줄(홈 히어로)
     · 수령 가능액 → 네모난 비즈니스 선글라스 · 가죽 사장 의자가 밀려 들어와 기대앉아 다리를 꼬고 · 팔걸이에 얹은 손목만 툭 — 지폐가 위로
     · 마감 D-Day  → 「이럴 수는 없어」 — 팔꿈치를 벌리고 두 손으로 뒤통수를 쥔다 · 고개를 살짝 젖혀 멍하니 · 발 동동 · 식은땀

   🔴 화남은 손짓에만 반응한다 — 학생의 데이터(마감 놓침·미신청)로 화내지 않는다(혼나는 느낌 금지 · 11-21 제안 그대로).
   🔴 '동작 줄이기'를 켠 폰은 표정만 바꾸고 덤비기·과잠 날리기·흔들림·지폐는 뺀다(REDUCED). */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, REDUCED, rand, lerp, clamp, mat, sph, cyl, torus, box } = K;
  const INK = 0x22283a;
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  // ── 글자·그림 스프라이트(캔버스 한 장 → 늘 화면을 보는 판) ──
  function canvasSprite(w, h, draw, scale) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(scale * (w / h), scale, 1); sp.renderOrder = 20; sp.visible = false;
    sp.userData.redraw = (fn) => { const g = cv.getContext('2d'); g.clearRect(0, 0, w, h); fn(g, w, h); tex.needsUpdate = true; };
    return sp;
  }
  const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  function glyph(ch, color, px) {
    return (g, w, h) => { g.fillStyle = color; g.font = `900 ${px}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + px * 0.04); };
  }
  function angerMark(g, w, h) {   // 화남 표시(네 갈래 굽은 선)
    g.strokeStyle = '#e0412f'; g.lineWidth = w * 0.1; g.lineCap = 'round';
    const c = w / 2, d = w * 0.16, L = w * 0.22;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      g.beginPath(); g.moveTo(c + sx * d, c + sy * (d + L)); g.quadraticCurveTo(c + sx * d, c + sy * d, c + sx * (d + L), c + sy * d); g.stroke();
    });
  }
  function spiralTex() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#22283a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.08) { const r = 4 + a * 3.0; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function billTex() {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#7cc58a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#3f8a52'; g.lineWidth = 6; g.strokeRect(5, 5, 118, 54);
    g.fillStyle = '#2f6e40'; g.beginPath(); g.arc(64, 32, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8f6ea'; g.font = `900 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₩', 64, 33);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }

  // 물체의 경계 상자를 기준(ref) 좌표로 — 캐릭터마다 얼굴 크기가 달라 부품 자리를 여기서 잰다
  const _m = new T.Matrix4(), _b = new T.Box3();
  function localBox(obj, ref) {
    obj.updateWorldMatrix(true, true); ref.updateWorldMatrix(true, false);
    const inv = new T.Matrix4().copy(ref.matrixWorld).invert(), out = new T.Box3();
    obj.traverse((o) => { if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); out.union(_b); });
    return out;
  }

  /* 가죽 사장 의자 — 수령 가능액을 가리킬 때 밀려 들어와 앉는다(11-21 개발자 지시 4차). 몸 너비(bw)·뒤쪽 끝(back)에 맞춰 크기를 정한다 · 장면(바닥)에 둔다 */
  function makeChair(bw, back, seatTop, bh) {
    const g = new T.Group(), leather = mat(0x3a2519, 0.45, 0.05), seam = mat(0x2a1a11, 0.6), chrome = mat(0xc9cdd4, 0.18, 1.0), gold = mat(0xd4a93c, 0.25, 1.0);
    const W = bw * 1.12, D = 0.95;
    const seat = box(W, 0.2, D, leather); seat.position.set(0, seatTop - 0.1, -0.05); g.add(seat);
    const cushion = box(W * 0.92, 0.06, D * 0.86, seam); cushion.position.set(0, seatTop + 0.005, -0.03); g.add(cushion);
    const backH = Math.min(bw * 0.95, (bh || 2) * 0.5), backr = box(W, backH, 0.24, leather); backr.position.set(0, seatTop + backH / 2 - 0.05, back - 0.16); backr.rotation.x = -0.12; g.add(backr);
    [0.3, 0.55, 0.8].forEach((u) => { const st = box(W * 0.86, 0.03, 0.02, seam); st.position.set(0, seatTop + backH * u, back - 0.02 - 0.12 * u * 0.12); st.rotation.x = -0.12; g.add(st); });   // 누빈 줄
    [-1, 1].forEach((s) => {
      const arm = box(0.16, 0.12, D * 0.9, leather); arm.position.set(s * (W / 2 + 0.06), seatTop + 0.34, 0); g.add(arm);
      const post = cyl(0.035, 0.035, 0.34, chrome, 10); post.position.set(s * (W / 2 + 0.06), seatTop + 0.17, 0.1); g.add(post);
      [-1, 1].forEach((k) => g.add(sph(0.025, gold, s * (W / 2 + 0.06), seatTop + 0.34, k * D * 0.38)));   // 금 징
    });
    const stem = cyl(0.06, 0.08, seatTop - 0.25, chrome, 14); stem.position.y = (seatTop - 0.25) / 2 + 0.1; g.add(stem);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, leg = box(0.07, 0.05, 0.55, chrome); leg.position.set(Math.sin(a) * 0.26, 0.1, Math.cos(a) * 0.26 - 0.05); leg.rotation.y = a; g.add(leg); g.add(sph(0.06, mat(0x1b1d22, 0.6), Math.sin(a) * 0.52, 0.05, Math.cos(a) * 0.52 - 0.05)); }
    g.visible = false; return g;
  }

  /* 캐릭터 하나에 부품을 붙인다 — 눈썹 · 볼 · 선글라스 · 소용돌이 눈 · 식은땀 (모두 머리 묶음에 · 처음엔 숨김) */
  function buildRig(ch) {
    const head = ch.head, hb = localBox(head, head);
    const top = hb.max.y, front = hb.max.z, hw = Math.max(0.3, (hb.max.x - hb.min.x) / 2);
    const tmp = new T.Vector3();
    let eyes = (ch.eyes || []).map((e) => { const b = localBox(e, head); const c = b.getCenter(new T.Vector3()); const sz = b.getSize(new T.Vector3()); return { obj: e, c, r: Math.max(0.05, Math.max(sz.x, sz.y) / 2), z: b.max.z }; });
    if (eyes.length < 2) eyes = [-1, 1].map((s) => ({ obj: null, c: new T.Vector3(s * hw * 0.38, hb.min.y + (top - hb.min.y) * 0.55, front - 0.05), r: hw * 0.14, z: front }));
    eyes.sort((a, b) => a.c.x - b.c.x);
    /* 부품 크기는 눈 크기로 재되 머리에 비해 너무 작지 않게 — 점 눈(스누베어 등)이면 선글라스가 눈만 하게 나와 눈처럼 보였다(11-21 시안 실측) */
    const L = eyes[0], R = eyes[eyes.length - 1], er = Math.max((L.r + R.r) / 2, hw * 0.13), ez = Math.max(L.z, R.z);
    const mid = new T.Vector3().addVectors(L.c, R.c).multiplyScalar(0.5), span = Math.max(0.2, R.c.x - L.c.x);
    const rig = { ch, top, front, hw, er, span, mid, eyes: [L, R] };

    // 눈썹 — 둥근 막대 둘
    rig.brows = [L, R].map((e, i) => {
      const g = new T.Group(), m = new T.Mesh(new T.CapsuleGeometry(er * 0.17, er * 1.05, 4, 10), mat(INK, 0.5));
      m.rotation.z = Math.PI / 2; g.add(m); g.position.set(e.c.x, e.c.y + er * 1.55, e.z + 0.03); g.userData.s = i ? 1 : -1; g.visible = false; head.add(g); return g;
    });
    // 볼 — 빨갛게(화남) · 분홍(좋아함)
    const blushMat = new T.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0, depthWrite: false });
    /* 🔴 그 캐릭터의 볼 자리에 — 눈 밑으로 재서 놓았더니 부(달걀 몸)는 볼이 과잠 위에 찍혔다(11-21 개발자 지적).
       볼 부품(분홍 0xffb3a0)이 있으면 그 자리 그대로 · 없으면 눈 바로 밑 */
    const cheekParts = [];
    head.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0xffb3a0) cheekParts.push(o); });
    const cheekAt = cheekParts.length >= 2
      ? cheekParts.map((o) => { const b = localBox(o, head); return { c: b.getCenter(new T.Vector3()), w: (b.max.x - b.min.x) / 2, z: b.max.z }; }).sort((a, b) => a.c.x - b.c.x).filter((x, i, a) => i === 0 || i === a.length - 1)
      : [L, R].map((e) => ({ c: new T.Vector3(e.c.x * 1.25, e.c.y - er * 0.95, 0), w: er * 0.8, z: e.z - 0.02 }));
    rig.blush = cheekAt.map((k) => { const b = sph(Math.max(k.w, er * 0.5) * 1.05, blushMat, k.c.x, k.c.y, k.z + 0.012, 1.15, 0.75, 0.25); head.add(b); return b; });
    rig.blushMat = blushMat;
    // 선글라스 — 렌즈 둘 + 다리
    {
      /* 비즈니스 선글라스(11-21 개발자 지시 2차 — "네모나고 business 상황에 쓰일 만한 · 지금은 눈가리개 같다")
         각진 직사각 렌즈 둘(모서리만 살짝 둥글게) · 위가 두꺼운 검은 뿔테 · 코다리 · 귀까지 가는 다리 · 렌즈는 얼굴 곡면을 따라 바깥으로 살짝 돈다 */
      const g = new T.Group(), frameM = mat(0x14161b, 0.35, 0.2), lensM = mat(0x23272f, 0.04, 0.55);
      lensM.emissive = new T.Color(0x0e1626); lensM.emissiveIntensity = 0.4;
      const lr = er * 1.22, lw = clamp(span * 0.86, lr * 1.7, lr * 2.5), lh = lw * 0.58, rr = lh * 0.16, th = lh * 0.12;
      const rrect = (sh, x, y, w, h, r) => { sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h); sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y); };
      [L, R].forEach((e) => {
        const x = e.c.x - mid.x, side = x < 0 ? -1 : 1, one = new T.Group();
        const outer = new T.Shape(); rrect(outer, -lw / 2 - th, -lh / 2 - th * 0.8, lw + th * 2, lh + th * 2.4, rr + th);   // 위쪽 테가 더 두껍다
        const hole = new T.Path(); rrect(hole, -lw / 2, -lh / 2, lw, lh, rr); outer.holes.push(hole);
        one.add(new T.Mesh(new T.ExtrudeGeometry(outer, { depth: lh * 0.12, bevelEnabled: false, curveSegments: 6 }), frameM));
        const ls = new T.Shape(); rrect(ls, -lw / 2, -lh / 2, lw, lh, rr);
        const lens = new T.Mesh(new T.ExtrudeGeometry(ls, { depth: lh * 0.05, bevelEnabled: false, curveSegments: 6 }), lensM); lens.position.z = lh * 0.03; one.add(lens);
        // 다리 — 바깥 끝에서 귀 쪽으로
        const temple = box(lh * 0.09, lh * 0.13, hw * 0.9, frameM); temple.position.set(side * (lw / 2 + th * 0.6), lh * 0.32, -hw * 0.42); temple.rotation.y = side * 0.12; one.add(temple);
        one.position.set(x, 0, 0); one.rotation.y = side * 0.16; g.add(one);
      });
      const bridge = box(Math.max(0.03, span - lw), lh * 0.12, lh * 0.1, frameM); bridge.position.set(0, lh * 0.36, lh * 0.06); g.add(bridge);
      g.position.set(mid.x, mid.y, ez + er * 0.35); g.visible = false; head.add(g); rig.shades = g; rig.lensR = lr;
    }
    // 소용돌이 눈(어지러움)
    {
      const tex = spiralTex(), m = new T.MeshBasicMaterial({ map: tex, transparent: true });
      rig.swirls = [L, R].map((e) => { const p = new T.Mesh(new T.PlaneGeometry(er * 2.6, er * 2.6), m); p.position.set(e.c.x, e.c.y, e.z + 0.02); p.visible = false; head.add(p); return p; });
    }
    // 식은땀 — 머리 옆 물방울
    {
      const d = new T.Group(); d.add(sph(er * 0.55, mat(0x9fd8ff, 0.2), 0, 0, 0, 0.8, 1.1, 0.6)); const tip = new T.Mesh(new T.ConeGeometry(er * 0.42, er * 0.9, 12), mat(0x9fd8ff, 0.2)); tip.position.y = er * 0.75; d.add(tip);
      d.position.set(hw * 0.82, top * 0.45, front * 0.55); d.visible = false; head.add(d); rig.sweat = d;
    }
    // 손 자리(지폐를 뿌리는 곳 · 몽둥이를 쥐는 곳) — 팔 묶음의 맨 아래
    /* 팔꿈치 — 팔을 위팔(어깨 묶음)과 아래팔(팔꿈치 묶음)로 나눈다(11-21 개발자 지시 4차 "팔을 굽힌 다음 펴서 던진다 · 손으로 뒤통수를 쥔다").
       원래 팔은 한 덩어리(긴 소매 공 하나 + 소맷단 + 손)라 굽지 않는다 — 소매 공을 위·아래 두 개로 바꿔 끼우고, 팔꿈치 아래 부품(소맷단·손·손가락)을 팔꿈치 묶음으로 옮긴다.
       가만히 있을 때 모양은 예전과 같다(두 공이 이어져 한 소매처럼 보인다).
       소매·맨팔(과잠을 손으로 벗는 연출): 벗을 때 소매 부품을 과잠 묶음으로 옮겨 붙이면(attach — 그 자리 그대로) 팔이 빠져나가며 소매가 남는다. 그 밑에 맨팔을 숨겨 둔다 */
    rig.limbs = (ch.arms || []).map((a) => {
      const meshes = a.children.filter((o) => o.isMesh);
      if (!meshes.length) return null;
      const handY = Math.min.apply(null, meshes.map((o) => o.position.y));
      const hand = meshes.find((o) => o.position.y === handY);
      const sleeve = meshes.find((o) => o !== hand && o.position.y < -0.25 && o.position.y > -0.6 && o.scale.y > o.scale.x * 1.6);
      const top = sleeve ? sleeve.position.y + sleeve.scale.y : 0, bot = handY;
      const EY = sleeve ? sleeve.position.y - 0.02 : (top + bot) / 2;        // 팔꿈치 높이 — 소매 한가운데
      const elbow = new T.Group(); elbow.position.y = EY; a.add(elbow);
      const parts = [];
      if (sleeve) {
        const r = sleeve.scale.x, m = sleeve.material, half = (top - bot > 0 ? Math.abs(sleeve.scale.y) : 0.4);
        const up = sph(r, m, 0, (top + EY) / 2, 0, 1, (top - EY) / 2 / r * 1.15, 1); a.add(up);
        const lo = sph(r * 0.96, m, 0, (sleeve.position.y - sleeve.scale.y - EY) / 2, 0, 1, (EY - (sleeve.position.y - sleeve.scale.y)) / 2 / (r * 0.96) * 1.15, 1); elbow.add(lo);
        sleeve.visible = false; void half;
        parts.push(up, lo);
      }
      // 팔꿈치 아래 부품을 팔꿈치 묶음으로(그 자리 그대로)
      meshes.filter((o) => o !== sleeve && o.position.y < EY - 0.05).forEach((o) => { elbow.attach(o); if (o !== hand && ch.jacket && o.position.y > handY - EY + 0.08) parts.push(o); });
      // 맨팔 — 위팔·아래팔 따로(손과 같은 색)
      const skin = hand ? hand.material : mat(0xffffff);
      const bu = new T.Mesh(new T.CapsuleGeometry(0.1, Math.max(0.05, -EY - 0.15), 4, 10), skin); bu.position.y = EY / 2; bu.visible = false; a.add(bu);
      const bl = new T.Mesh(new T.CapsuleGeometry(0.095, Math.max(0.05, EY - handY - 0.2), 4, 10), skin); bl.position.y = (handY - EY) / 2; bl.visible = false; elbow.add(bl);
      return { arm: a, elbow, hand, parts: parts.map((o) => ({ o, par: o.parent, p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() })), bare: [bu, bl], off: false };
    });
    rig.elbows = rig.limbs.map((l) => (l ? l.elbow : null));
    rig.handLocal = (i) => { const l = rig.limbs[i]; return l && l.hand ? l.hand.position.clone() : new T.Vector3(0, -0.3, 0); };   // 팔꿈치 묶음 안의 손 자리
    rig.undress = (i) => { const sl = rig.limbs[i]; if (!sl || sl.off || !ch.jacket || !sl.parts.length) return; sl.parts.forEach((x) => ch.jacket.attach(x.o)); sl.bare.forEach((b) => { b.visible = true; }); sl.off = true; };
    rig.dress = () => rig.limbs.forEach((sl) => { if (!sl || !sl.off) return; sl.parts.forEach((x) => { x.par.add(x.o); x.o.position.copy(x.p); x.o.rotation.copy(x.r); x.o.scale.copy(x.s); }); sl.bare.forEach((b) => { b.visible = false; }); sl.off = false; });
    // 다리·발(다리 꼬기) — 몸 묶음의 바로 아래 자식 중 바닥 가까운 것
    { /* 몸 크기 — 팔은 빼고 잰다(팔까지 재면 의자가 두 배가 됐다 · 11-21 시안 실측) */
      ch.root.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(ch.root.matrixWorld).invert(), bb = new T.Box3(), armsSet = new Set(ch.arms || []);
      (function walk(o) { if (armsSet.has(o)) return; if (o.isMesh && o.geometry) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); bb.union(_b); } o.children.forEach(walk); })(ch.squash);
      rig.bw = bb.max.x - bb.min.x; rig.bh = bb.max.y - bb.min.y; rig.back = bb.min.z; rig.seatLift = 0.3; rig.seatTop = 0.3 + Math.max(0.12, bb.min.y + 0.18); }
    rig.legs = [];
    ch.squash.children.forEach((o) => {
      if (o === ch.head || o === ch.jacket || (ch.arms || []).indexOf(o) >= 0) return;
      const b = localBox(o, ch.squash), cc = b.getCenter(new T.Vector3());
      if (b.max.y < 0.42 && Math.abs(cc.x) > 0.06 && b.max.x - b.min.x < 0.7) rig.legs.push({ o, x: o.position.x, y: o.position.y, z: o.position.z, s: cc.x < 0 ? -1 : 1 });
    });
    // 몽둥이 — 바닥(오른쪽)에 놓여 있다가 화날 때 줍는다
    {
      const club = new T.Group(), wood = mat(0x9a6634, 0.7), dark = mat(0x5b3a1c, 0.75), tape = mat(0x2b2b33, 0.9);
      const h = cyl(0.045, 0.05, 0.42, tape, 12); h.position.y = 0.21; club.add(h);
      const b = cyl(0.12, 0.06, 0.78, wood, 16); b.position.y = 0.42 + 0.39; club.add(b);
      club.add(sph(0.12, wood, 0, 1.2, 0, 1, 0.5, 1)); club.add(sph(0.06, dark, 0, 0, 0, 1, 0.5, 1));
      [0.6, 0.9, 1.08].forEach((yy) => { const k = sph(0.025, dark, 0.1, yy, 0.02); club.add(k); });   // 옹이
      club.visible = false; ch.root.add(club); rig.club = club;
      rig.clubFloor = () => { if (club.parent !== ch.root) ch.root.add(club); club.position.set(0.95, 0.07, 0.35); club.rotation.set(0, -0.5, Math.PI / 2); club.scale.setScalar(1); };
      rig.clubFloor();
    }
    void tmp;
    return rig;
  }

  function Mood(stage, opt) {
    opt = opt || {};
    const c = stage.ctx, btn = c.btn, scene = c.scene;
    const M = { mode: 'idle', t: 0, line: null, dday: false, lastInput: performance.now(), idleMs: opt.idleMs || 20000, sh: 0, squish: 0, squishV: 0, pullY: null, suppress: false, petting: false };
    let rig = null;

    // 장면에 두는 것 — 말풍선 · 기호 · 김 · 하트 · 지폐
    /* 말풍선은 없다(11-21 개발자 지시 3차 — "모든 말풍선은 삭제") — 몸짓·표정만으로 말한다 */
    const mark = canvasSprite(128, 128, angerMark, 0.42); scene.add(mark);
    const bang = canvasSprite(128, 128, glyph('!', '#e0412f', 118), 0.5); scene.add(bang);
    const heart = canvasSprite(128, 128, glyph('♥', '#ef5a7a', 120), 0.42); scene.add(heart);
    const zs = [0, 1, 2].map(() => { const z = canvasSprite(128, 128, glyph('Z', '#5c6a8a', 110), 0.3); scene.add(z); return z; });
    const glint = canvasSprite(128, 128, glyph('✦', '#fff6cf', 120), 0.3); scene.add(glint);
    const stars = [0, 1, 2].map(() => { const z = canvasSprite(128, 128, glyph('★', '#f2b632', 110), 0.26); scene.add(z); return z; });
    const steamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    const steam = Array.from({ length: 10 }, () => { const p = sph(0.12, steamMat.clone()); p.visible = false; p.userData = { life: 9 }; scene.add(p); return p; });
    const BILL_TEX = billTex(), BILL_GEO = new T.PlaneGeometry(0.34, 0.17);
    const bills = Array.from({ length: 28 }, () => { const m = new T.Mesh(BILL_GEO, new T.MeshStandardMaterial({ map: BILL_TEX, side: T.DoubleSide, roughness: 0.8 })); m.visible = false; m.userData = { on: false, v: new T.Vector3(), w: new T.Vector3(), life: 0, ph: 0 }; scene.add(m); return m; });

    const W = new T.Vector3(), W2 = new T.Vector3();
    function headTopWorld(out, up) { rig.ch.head.localToWorld(out.set(0, rig.top + (up || 0), 0)); return out; }
    function emitSteam(side) {
      const p = steam.find((q) => !q.visible); if (!p) return;
      rig.ch.head.localToWorld(W.set(side * rig.hw * 0.75, rig.top * 0.6, 0));
      p.position.copy(W); p.visible = true; p.userData.life = 0; p.userData.v = new T.Vector3(side * rand(0.3, 0.7), rand(1.2, 1.8), rand(-0.1, 0.2)); p.scale.setScalar(rand(0.08, 0.12));
    }
    function throwBills(arm, n, lazy) {
      if (!arm) return; const i = rig.ch.arms.indexOf(arm), el = rig.elbows[i] || arm;
      el.localToWorld(W.copy(rig.handLocal(i)));   // 손은 팔꿈치 묶음 안에 있다
      for (let i = 0, k = 0; i < bills.length && k < n; i++) {
        const b = bills[i]; if (b.userData.on) continue; k++;
        b.userData.on = true; b.userData.life = 0; b.visible = true; b.position.copy(W);
        if (lazy) b.userData.v.set(rand(-0.6, 0.9), rand(2.4, 3.4), rand(-0.1, 0.5)); else b.userData.v.set(rand(-1.3, 1.3), rand(3.6, 5.2), rand(-0.2, 0.9)); b.userData.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); b.userData.ph = rand(0, 6);
        b.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      }
    }

    function start(mode) {
      if (REDUCED && (mode === 'squish')) return;
      M.mode = mode; M.t = 0; c.S.busy = true;
      if (mode === 'angry') { M.thrown = false; if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) {} } }
      if (mode === 'startle') { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} } }
    }
    function stop() { M.mode = 'idle'; M.t = 0; c.S.busy = false; }
    function poke() { M.lastInput = performance.now(); if (M.mode === 'sleep') start('startle'); }

    // ── 손짓 읽기 — kit 의 누르기·돌리기와 같은 손가락을 같이 본다 ──
    const taps = []; let down = null;
    btn.addEventListener('pointerdown', (e) => {
      const wasAsleep = M.mode === 'sleep'; poke();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false, travel: 0, lx: e.clientX, pull: false, long: false };
      M.suppress = wasAsleep;   // 깨우는 누르기는 동전 대신 깜짝
      clearTimeout(M.longT);
      M.longT = setTimeout(() => { if (down && !down.moved && (M.mode === 'idle' || M.mode === 'pet')) { down.long = true; M.petting = true; start('pet'); } }, 700);
    });
    btn.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.travel += Math.abs(e.clientX - down.lx); down.lx = e.clientX;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { down.moved = true; clearTimeout(M.longT); }
      if (!down.pull && dy > 10 && dy > Math.abs(dx) * 1.2 && (M.mode === 'idle' || M.mode === 'squish')) { down.pull = true; try { btn.setPointerCapture(e.pointerId); } catch (er) {} }
      if (down.pull) { M.pullY = clamp(dy / 150, 0, 0.5); if (M.mode !== 'squish') start('squish'); }
    });
    function up(e) {
      if (!down || e.pointerId !== down.id) return;
      clearTimeout(M.longT);
      const now = performance.now();
      if (down.long) { M.petting = false; M.t = Math.max(M.t, 0); M.petEnd = now; M.suppress = true; }
      else if (down.pull) { M.pullY = null; M.suppress = true; }
      else if (down.moved && down.travel > 520 && M.mode === 'idle') start('dizzy');   // 돌리기는 kit 이 누르기(click)를 이미 막는다 — 여기서 또 막으면 다음 누르기를 삼킨다
      else if (!down.moved && now - down.t < 350) {
        taps.push(now); while (taps.length && now - taps[0] > 1000) taps.shift();
        if (taps.length >= 4 && (M.mode === 'idle' || M.mode === 'pet')) { taps.length = 0; start('angry'); M.suppress = true; }
        else if (M.mode === 'angry') M.suppress = true;
      }
      down = null;
    }
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);

    // ── 매 프레임 — kit 이 정한 자세 위에 얹는다 ──
    function after(dt, cx) {
      const ch = cx.ch; if (!ch) return;
      if (!rig || rig.ch !== ch) { if (rig && rig.chair) scene.remove(rig.chair); rig = buildRig(ch); rig.chair = makeChair(rig.bw, rig.back, rig.seatTop, rig.bh); scene.add(rig.chair); }
      M.t += dt; if (M.freeze != null) M.t = M.freeze;   // 시안 사진용 — 한 순간에 멈춘다
      const S = cx.S, t = M.t, now = performance.now();
      if (M.mode === 'idle' && now - M.lastInput > M.idleMs && !S.drag) start('sleep');

      // 기본값으로 되돌림(kit 이 손대지 않는 칸)
      ch.root.position.x = 0; ch.root.position.z = 0; ch.root.rotation.z = 0; ch.root.rotation.x = 0;
      ch.arms.forEach((a) => { a.rotation.x = 0; });
      rig.elbows.forEach((e) => { if (e) e.rotation.set(0, 0, 0); });
      let chairOn = 0;
      M.dueT = M.line === 'due' && M.dday && S.point ? (M.dueT || 0) + dt : 0;
      if (ch.jacket) { ch.jacket.visible = true; ch.jacket.position.set(0, 0, 0); ch.jacket.rotation.set(0, 0, 0); ch.jacket.scale.set(1, 1, 1); }
      rig.legs.forEach((l) => l.o.position.set(l.x, l.y, l.z));
      rig.brows.forEach((b) => { b.visible = false; }); rig.swirls.forEach((s) => { s.visible = false; });
      rig.eyes.forEach((e) => { if (e.obj) { e.obj.visible = true; e.obj.scale.x = 1; } });
      if (M.mode !== 'angry') { rig.club.visible = false; rig.clubFloor(); rig.dress(); }
      let blush = 0, blushColor = 0xff5a4a, shades = 0, sweat = false, browAng = 0, browOn = 0;
      mark.visible = false; bang.visible = false; glint.visible = false; heart.visible = heart.visible && heart.userData.t < 1.2;
      zs.forEach((z) => { z.visible = false; }); stars.forEach((z) => { z.visible = false; });

      const armOf = (s) => ch.arms.find((a) => a.userData.side === s);
      const P = S.point;
      const pointSide = P ? (P.x < 0 ? -1 : 1) : 0;

      if (M.mode === 'angry') {
        /* 화남 — 11-21 개발자 지시 셋째 판(말풍선 없음 · "과잠을 직접 손으로 벗어야")
           0~0.4 표정(눈썹·빨간 볼·김) · 과잠 벗기: 0.4~0.8 두 손으로 깃을 잡고 → 0.8~1.25 어깨를 뒤로 젖혀 과잠을 어깨에서 내린다 →
           1.25~1.75 왼팔을 앞으로 빼며 소매에서 빠져나온다(소매는 과잠에 남고 맨팔이 보인다) → 1.75~2.25 오른팔도 → 2.25~2.7 벗은 과잠을 옆 바닥에 내팽개친다 ·
           2.7~3.4 몸을 숙여 바닥의 몽둥이를 줍고 · 3.4~4.2 머리 위로 치켜들어 화면으로 던진다(4.18 onThrow — 앱 화면 전체로 날아와 유리가 깨진다) ·
           4.3~5.4 허리에 손 · 고개 홱 · 발 동동 · 5.4~5.9 과잠을 집어 어깨에 걸치고 → 5.9 두 팔을 소매에 다시 넣고 → 6.2 여민다 · 6.3 끝 */
        const thrower = armOf(1) || ch.arms[1], other = armOf(-1) || ch.arms[0];
        const ts = thrower ? thrower.userData.side : 1, iOf = (a) => ch.arms.indexOf(a);
        browOn = 1; browAng = 0.55; blush = 0.6; mark.visible = t < 5.4;
        headTopWorld(W, 0.05); mark.position.set(W.x + 0.42 * ch.root.scale.x, W.y + 0.05, W.z); mark.scale.setScalar(0.42 * (1 + Math.sin(t * 14) * 0.08));
        if (t < 5.4 && Math.floor(t * 8) !== Math.floor((t - dt) * 8)) { emitSteam(-1); emitSteam(1); }
        if (REDUCED) { if (t > 2.2) stop(); }
        else {
          if (t < 0.4) ch.root.position.x += Math.sin(t * 55) * 0.02;
          const jk = ch.jacket || null;
          const POSE_B = { z: -0.22, y: -0.12, rx: 0.3 }, FLOOR = { x: -0.6, y: 0.02, z: 0.15, rz: 1.5, sx: 0.42, sy: 0.9, sz: 0.5 };
          const setJ = (x, y, z, rx, rz, sx, sy, sz) => { if (!jk) return; jk.position.set(x, y, z); jk.rotation.set(rx, 0, rz); jk.scale.set(sx, sy, sz); };
          const armSet = (a, th, rx) => { if (a) { a.rotation.z = a.userData.side * th; a.rotation.x = rx; } };
          // ① 깃을 잡는다 → ② 어깨를 젖혀 내린다
          if (t >= 0.4 && t < 1.25) {
            const a = ease(seg(t, 0.4, 0.8)), b = ease(seg(t, 0.8, 1.25));
            ch.arms.forEach((arm) => armSet(arm, lerp(lerp(0.3, -0.35, a), 0.9, b), lerp(lerp(0, -2.3, a), 0.7, b)));
            setJ(0, POSE_B.y * b, POSE_B.z * b, POSE_B.rx * b, 0, 1, 1, 1);
            ch.root.rotation.x = 0.1 * b;
          }
          // ③ 왼팔 빼기 → ④ 오른팔 빼기 (소매는 과잠에 남는다)
          if (t >= 1.25 && t < 2.25) {
            setJ(0, POSE_B.y, POSE_B.z, POSE_B.rx, 0, 1, 1, 1);
            const c1 = ease(seg(t, 1.25, 1.7)), c2 = ease(seg(t, 1.75, 2.2));
            if (jk) { rig.undress(iOf(other)); if (t >= 1.75) rig.undress(iOf(thrower)); }
            armSet(other, lerp(0.9, 0.35, c1), lerp(0.7, -0.45, c1));
            armSet(thrower, lerp(0.9, 0.35, c2), lerp(0.7, -0.45, c2));
            ch.root.rotation.z = Math.sin(t * 16) * 0.06; ch.root.rotation.x = 0.1;
          }
          // ⑤ 벗은 과잠을 옆 바닥에 내팽개친다
          if (t >= 2.25 && t < 5.4) {
            const d = ease(seg(t, 2.25, 2.7));
            setJ(lerp(0, FLOOR.x, d), lerp(POSE_B.y, FLOOR.y, d) + Math.sin(d * Math.PI) * 0.5, lerp(POSE_B.z, FLOOR.z, d), POSE_B.rx * (1 - d), FLOOR.rz * d, lerp(1, FLOOR.sx, d), lerp(1, FLOOR.sy, d), lerp(1, FLOOR.sz, d));
            if (t < 2.7) { armSet(other, 0.35 + Math.sin(d * Math.PI) * 0.9, -0.45 + d * 0.3); armSet(thrower, 0.35, -0.2); }
          }
          if (!jk && ch.cap) {   // 대장님 — 과잠 대신 학사모를 손으로 벗어 바닥에
            if (t >= 0.4 && t < 5.4) { const u = ease(seg(t, 0.6, 1.4)); ch.cap.position.y = 0.7 + Math.sin(u * Math.PI) * 0.6 - u * 1.45; ch.cap.position.x = -0.9 * u; ch.cap.rotation.z = 1.4 * u; armSet(other, t < 1.4 ? lerp(0.3, 2.6, ease(seg(t, 0.4, 0.7))) * (1 - ease(seg(t, 1.1, 1.4))) + 0.3 : 0.3, 0); }
            else if (t >= 5.4) { const u = ease(seg(t, 5.4, 6.0)); ch.cap.position.y = lerp(0.7 - 1.45, 0.7, u) + Math.sin(u * Math.PI) * 0.8; ch.cap.position.x = -0.9 * (1 - u); ch.cap.rotation.z = 1.4 * (1 - u); }
          }
          // ⑥ 몽둥이 줍기
          rig.club.visible = t < 4.18;
          if (t >= 2.7 && t < 3.4) {
            const u = ease(seg(t, 2.7, 3.05)) * (1 - ease(seg(t, 3.15, 3.4)));
            ch.root.rotation.x = 0.42 * u; ch.root.rotation.y += -ts * 0.35 * u;
            armSet(thrower, 0.2, -0.9 * u); armSet(other, 0.6, 0);
            const el = rig.elbows[iOf(thrower)]; if (el) el.rotation.x = -0.5 * u;   // 바닥으로 손을 뻗으며 팔꿈치를 살짝 굽혀 쥔다
          }
          if (t >= 3.05 && t < 4.18 && thrower && rig.club.parent !== (rig.elbows[iOf(thrower)] || thrower)) {   // 손에 쥔다
            const el = rig.elbows[iOf(thrower)] || thrower; el.add(rig.club); rig.club.position.copy(rig.handLocal(iOf(thrower))); rig.club.rotation.set(0, 0, Math.PI); rig.club.scale.setScalar(1 / Math.max(0.3, thrower.scale.y));
          }
          // ⑦ 치켜들기 → 팔꿈치를 굽혀 몽둥이를 머리 뒤로 젖혔다가(3.4~3.9) → 어깨가 앞으로 나오며 팔꿈치를 쭉 펴서 던진다(3.95~4.2) · 참고: 오버핸드 던지기 자세
          if (t >= 3.4 && t < 4.3 && thrower) {
            /* 3.4~3.7 팔을 머리 위로 쭉 · 3.7~3.95 팔꿈치를 굽혀 몽둥이를 머리 뒤로 젖힌다 · 3.95~4.2 어깨를 앞으로 휘두르며 팔꿈치를 쭉 편다 → 4.18 놓는다 */
            const raise = ease(seg(t, 3.4, 3.7)), cock = ease(seg(t, 3.7, 3.95)), whip = ease(seg(t, 3.95, 4.2)), ext = ease(seg(t, 4.0, 4.18)), wind = raise;
            thrower.rotation.z = ts * lerp(0.3, 2.75, raise) * (1 - whip * 0.45);
            thrower.rotation.x = 0.15 * cock - whip * 1.8;
            const el = rig.elbows[iOf(thrower)]; if (el) { el.rotation.x = 1.75 * cock * (1 - ext) - 0.15 * ext; el.rotation.z = 0; }
            ch.root.rotation.x = -0.12 * wind + 0.25 * whip; ch.root.rotation.y += -ts * 0.25 * wind + ts * 0.35 * whip;
            armSet(other, 0.7 + 0.5 * wind, 0);
            if (t >= 4.18 && !M.thrown) {
              M.thrown = true; rig.club.visible = false;
              (rig.elbows[iOf(thrower)] || thrower).localToWorld(W.copy(rig.handLocal(iOf(thrower)))); W.project(cx.cam);
              const r = cx.btn.getBoundingClientRect();
              if (opt.onThrow) opt.onThrow({ x: r.left + (W.x + 1) / 2 * r.width, y: r.top + (1 - W.y) / 2 * r.height });
            }
          }
          // ⑧ 허리에 손 · 고개 홱 · 발 동동
          if (t >= 4.3 && t < 5.4) {
            ch.arms.forEach((a) => armSet(a, 0.78, 0.4));
            ch.head.rotation.y += 0.5 * ease(seg(t, 4.3, 4.5));
            ch.root.position.y += Math.abs(Math.sin(t * 18)) * 0.05;
          }
          // ⑨ 다시 입기 — 과잠을 집어 어깨 뒤에 걸치고(소매가 팔 자리로 온다) → 소매에 팔을 넣고 → 여민다
          if (t >= 5.4) {
            const u = ease(seg(t, 5.4, 5.9)), w = ease(seg(t, 5.95, 6.25));
            if (t < 5.95) {
              setJ(lerp(FLOOR.x, 0, u), lerp(FLOOR.y, POSE_B.y, u) + Math.sin(u * Math.PI) * 0.9, lerp(FLOOR.z, POSE_B.z, u), POSE_B.rx * u, FLOOR.rz * (1 - u), lerp(FLOOR.sx, 1, u), lerp(FLOOR.sy, 1, u), lerp(FLOOR.sz, 1, u));
              ch.arms.forEach((a) => armSet(a, lerp(0.35, 0.9, u), lerp(-0.2, 0.7, u)));
            } else {
              rig.dress();
              setJ(0, POSE_B.y * (1 - w), POSE_B.z * (1 - w), POSE_B.rx * (1 - w), 0, 1, 1, 1);
              ch.arms.forEach((a) => armSet(a, lerp(0.9, 0.3, w), lerp(0.7, 0, w)));
            }
          }
          if (t > 6.3) { stop(); M.thrown = false; rig.dress(); rig.clubFloor(); }
        }
      } else if (M.mode === 'dizzy') {
        const u = seg(t, 0, 2.2), fade = 1 - ease(seg(t, 1.6, 2.2));
        rig.swirls.forEach((s) => { s.visible = true; s.rotation.z = -t * 9; }); rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = false; });
        if (!REDUCED) { ch.root.rotation.z = Math.sin(t * 6) * 0.2 * fade; ch.head.rotation.z += Math.sin(t * 6 + 1) * 0.12 * fade; ch.root.position.x += Math.sin(t * 3) * 0.12 * fade; }
        headTopWorld(W, 0.25);
        stars.forEach((z, i) => { const a = t * 4 + i * 2.1; z.visible = true; z.position.set(W.x + Math.cos(a) * 0.55, W.y + Math.sin(a * 2) * 0.05, W.z + Math.sin(a) * 0.4); });
        if (u >= 1) stop();
      } else if (M.mode === 'pet') {
        blush = 0.75; blushColor = 0xff8fa8;
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.y = 0.14; });
        if (!REDUCED) { ch.root.rotation.z = Math.sin(t * 3) * 0.06; }
        if (!heart.visible || heart.userData.t > 1.1) { heart.visible = true; heart.userData.t = 0; }
        if (!M.petting && performance.now() - (M.petEnd || 0) > 600) stop();
      } else if (M.mode === 'squish') {
        if (M.pullY != null) { M.squish = lerp(M.squish, M.pullY, 1 - Math.pow(0.0001, dt)); M.squishV = 0; }
        else { M.squishV += (-M.squish * 220 - M.squishV * 9) * dt; M.squish += M.squishV * dt; if (Math.abs(M.squish) < 0.004 && Math.abs(M.squishV) < 0.05) { M.squish = 0; stop(); } }
        const a = M.squish, sy = 1 - a, sxz = 1 + a * 0.7;
        ch.squash.scale.set(ch.squash.scale.x * sxz, ch.squash.scale.y * sy, ch.squash.scale.z * sxz);
        rig.eyes.forEach((e) => { if (e.obj && a > 0.15) e.obj.scale.y = 0.35; });
        if (a < 0 && !REDUCED) ch.root.position.y += -a * 0.6;   // 튕겨 오를 때
      } else if (M.mode === 'sleep') {
        /* 🔴 머리 묶음을 크게 숙이지 않는다 — 부(달걀 몸)처럼 머리가 몸에 그려진 캐릭터는 눈·코·볼이 과잠 쪽으로 미끄러져 내려갔다(11-21 개발자 지적).
           꾸벅임은 몸 전체를 앞으로 기울여서 낸다 */
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.y = 0.1; });
        const nod = Math.max(0, Math.sin(t * 1.6));
        ch.root.rotation.x = 0.08 + nod * 0.1; ch.root.rotation.z = Math.sin(t * 0.8) * 0.04;
        ch.head.rotation.x = ch.head.rotation.x * 0.3; ch.head.rotation.y *= 0.2;
        ch.arms.forEach((a) => { a.rotation.z = a.userData.side * 0.18; });
        const br = 1 + Math.sin(t * 1.6) * 0.03; ch.squash.scale.set(ch.squash.scale.x / br, ch.squash.scale.y * br, ch.squash.scale.z / br);
        headTopWorld(W, 0.1);
        zs.forEach((z, i) => { const u = ((t * 0.45) + i / 3) % 1; z.visible = true; z.material.opacity = Math.sin(u * Math.PI); z.position.set(W.x + 0.35 + u * 0.55, W.y + u * 0.9, W.z); z.scale.setScalar(0.18 + u * 0.22); });
      } else if (M.mode === 'startle') {
        const u = seg(t, 0, 0.8);
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(1.25, 1.35, 1); });
        if (!REDUCED) ch.root.position.y += 0.7 * 4 * u * (1 - u);
        ch.arms.forEach((a) => { a.rotation.z = a.userData.side * 2.5; });
        headTopWorld(W, 0.35); bang.visible = true; bang.position.copy(W); bang.scale.setScalar(0.5 * (1 + 0.2 * Math.sin(t * 20)));
        if (u >= 1) { rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(1, 1, 1); }); stop(); }
      } else {
        // 가리키는 줄에 따른 연출 — 손짓 연출이 없을 때만
        if (M.line === 'amount' && P) {
          /* 거만하게(11-21 개발자 지시 4차 — "의자에 앉아서 거만하게 다리를 꼬고 무심한 듯 돈을 위로") · 참고: 등받이 의자에 기대 다리를 꼰 사장님 그림
             가죽 사장 의자가 밀려 들어오고 → 걸터앉아 뒤로 기대고 → 한쪽 다리를 다른 무릎 위로 꼰다 → 가리키지 않는 손은 팔걸이에 얹어 두었다가 손목만 툭 — 지폐가 위로 */
          shades = 1;
          const sit = ease(Math.min(1, M.sh * 1.15));
          chairOn = sit;
          ch.root.position.y += rig.seatLift * sit;
          ch.root.position.z += -0.08 * sit;
          ch.root.rotation.x = -0.2 * sit; ch.root.rotation.z = -pointSide * 0.04 * sit;
          // 다리 꼬기 — 가리키지 않는 쪽 다리를 반대편 무릎 위로
          rig.legs.forEach((l) => { if (l.s === -pointSide) l.o.position.set(l.x - l.s * 0.42 * sit, l.y + 0.3 * sit, l.z + 0.3 * sit); else l.o.position.set(l.x, l.y + 0.08 * sit, l.z + 0.16 * sit); });
          const other = armOf(-pointSide), oi = ch.arms.indexOf(other);
          if (other) {
            other.rotation.z = other.userData.side * lerp(0.3, 0.55, sit); other.rotation.x = -0.35 * sit;   // 팔걸이에 얹은 팔
            if (!REDUCED && sit > 0.9) {
              const ph = (t * 0.6) % 1, flick = ph > 0.8 ? Math.sin((ph - 0.8) / 0.2 * Math.PI) : 0;
              if (rig.elbows[oi]) rig.elbows[oi].rotation.x = -0.5 - 1.3 * flick;   // 손목·아래팔만 툭 — 무심하게
              if (ph > 0.88 && ph - dt * 0.6 <= 0.88) throwBills(other, 4, true);
            } else if (rig.elbows[oi]) rig.elbows[oi].rotation.x = -0.5 * sit;
          }
          // 렌즈에 반짝 — 가끔
          const gl = ((t + 0.3) * 0.5) % 1;
          if (M.sh > 0.9 && gl < 0.12) { rig.shades.updateWorldMatrix(true, false); rig.shades.localToWorld(W.set(-rig.lensR * 0.6, rig.lensR * 0.4, rig.lensR * 0.4)); glint.visible = true; glint.position.copy(W); glint.scale.setScalar(0.32 * Math.sin(gl / 0.12 * Math.PI)); glint.material.rotation = gl * 6; }
        } else if (M.line === 'due' && M.dday && P) {
          /* 「이럴 수는 없어」(11-21 개발자 지시 4차 — "손으로 뒤통수를 쥐어야지 · 진짜 큰일 나서 믿기지 않는다는 듯") · 참고: 두 손으로 머리를 감싸 쥔 놀란 사람
             팔꿈치를 양옆으로 벌리고 두 손은 뒤통수로 · 고개는 살짝 뒤로 젖혀 멍하니 · 눈은 커진다 · 발 동동 · 식은땀 */
          sweat = true;
          const k = ease(seg(M.dueT, 0, 0.35));
          ch.arms.forEach((a, i) => {
            const s = a.userData.side;
            a.rotation.z = s * lerp(0.3, 2.3, k); a.rotation.x = 0.55 * k;
            const el = rig.elbows[i]; if (el) { el.rotation.z = s * 1.35 * k; el.rotation.x = 1.05 * k + Math.sin(t * 9 + s) * 0.04 * k; }   // 손이 뒤통수로
          });
          ch.head.rotation.x -= 0.16 * k; rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(1.12, 1.25 * (e.obj.scale.y || 1), 1); });
          if (!REDUCED) {
            ch.root.position.y += Math.abs(Math.sin(t * 15)) * 0.05;
            ch.squash.scale.y *= 1 - Math.abs(Math.sin(t * 15)) * 0.04;
            ch.root.rotation.z = Math.sin(t * 3.2) * 0.06;
            ch.head.rotation.y += Math.sin(t * 3.2) * 0.12;
          }
        }
      }

      // 부품 그리기
      M.chair = lerp(M.chair || 0, chairOn, 1 - Math.pow(0.002, dt));
      rig.chair.visible = M.chair > 0.02;
      if (rig.chair.visible) { const k = ch.root.scale.x; rig.chair.scale.setScalar(k * Math.max(0.01, M.chair)); rig.chair.position.set(0, 0, -1.4 * (1 - M.chair)); rig.chair.rotation.y = ch.root.rotation.y; }
      rig.brows.forEach((b) => { b.visible = browOn > 0; b.rotation.z = b.userData.s * -browAng; b.position.y = rig.eyes[0].c.y + rig.er * (browAng > 0 ? 1.12 : 1.4); });
      rig.blushMat.color.setHex(blushColor); rig.blushMat.opacity = lerp(rig.blushMat.opacity, blush, 1 - Math.pow(0.001, dt));
      M.sh = lerp(M.sh, shades, 1 - Math.pow(0.0005, dt));
      rig.shades.visible = M.sh > 0.02; rig.shades.position.y = rig.mid.y + (1 - M.sh) * 0.7; rig.shades.scale.setScalar(Math.max(0.01, M.sh));
      if (sweat) { rig.sweat.visible = true; const u = (t * 0.9) % 1; rig.sweat.position.y = rig.top * (0.55 - u * 0.4); rig.sweat.scale.setScalar(Math.sin(u * Math.PI) + 0.01); } else rig.sweat.visible = false;
      if (shades && M.mode === 'idle') rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = false; });

      // 김 · 하트 · 말풍선 · 지폐
      steam.forEach((p) => { if (!p.visible) return; const d = p.userData; d.life += dt; p.position.addScaledVector(d.v, dt); p.scale.multiplyScalar(1 + dt * 1.6); p.material.opacity = Math.max(0, 0.85 - d.life * 1.3); if (d.life > 0.65) p.visible = false; });
      if (heart.visible) { heart.userData.t += dt; headTopWorld(W, 0.15 + heart.userData.t * 0.5); heart.position.copy(W); heart.material.opacity = Math.max(0, 1 - heart.userData.t / 1.2); heart.scale.setScalar(0.3 + Math.min(1, heart.userData.t * 4) * 0.15); }
      bills.forEach((b) => {
        const d = b.userData; if (!d.on) return; d.life += dt;
        d.v.y -= (d.v.y > -0.7 ? 9 : 0) * dt; d.v.x *= 1 - dt * 1.2; d.v.z *= 1 - dt * 1.2;
        b.position.addScaledVector(d.v, dt); b.position.x += Math.sin(d.life * 6 + d.ph) * 0.012;
        b.rotation.x += d.w.x * dt; b.rotation.y += d.w.y * dt; b.rotation.z += d.w.z * dt;
        if (b.position.y < 0.02) { b.position.y = 0.02; d.v.set(0, 0, 0); d.w.set(0, 0, 0); b.rotation.x = -Math.PI / 2; }
        if (d.life > 2.6) b.scale.setScalar(Math.max(0.001, 1 - (d.life - 2.6) / 0.4));
        if (d.life > 3.0) { d.on = false; b.visible = false; b.scale.setScalar(1); }
      });
      c.S.busy = M.mode !== 'idle' || bills.some((b) => b.userData.on) || M.sh > 0.02 || steam.some((p) => p.visible) || heart.visible || (M.line === 'due' && M.dday && !!P) || (M.line === 'amount' && !!P) || M.chair > 0.02;
    }

    return {
      after,
      /* kit 의 누르기(동전) 앞에서 — 연출이 가져간 누르기는 동전을 내지 않는다 */
      beforeTap() { if (M.suppress) { M.suppress = false; return false; } return M.mode === 'idle'; },
      /* 홈 히어로가 지금 가리키는 줄 — 'amount' 이면 선글라스+지폐 · 'due' 이고 dday 면 안절부절 */
      setLine(k, info) { M.line = k || null; M.dday = !!(info && info.dday); },
      /* 시안 단추용 — 손으로 하기 어려운 것(길게 누르기·끌어내리기·20초 기다리기)을 그 자리에서 보여 준다 */
      trigger(mode) {
        poke(); if (M.mode !== 'idle') stop();
        if (mode === 'sleep') { M.lastInput = -1e9; return; }
        if (mode === 'pet') { M.petting = true; start('pet'); setTimeout(() => { M.petting = false; M.petEnd = performance.now(); }, 1600); return; }
        if (mode === 'squish') { M.pullY = 0.45; start('squish'); setTimeout(() => { M.pullY = null; }, 650); return; }
        start(mode);
      },
      poke,
      get mode() { return M.mode; },
      get asleep() { return M.mode === 'sleep'; },
      _M: M,
    };
  }
  K.Mood = Mood;

  /* ── 화면 전체 연출 — 던진 몽둥이가 날아와 화면(유리)이 깨진다 (11-21 개발자 지시) ──
     캐릭터 무대(히어로 칸)가 아니라 **휴대폰 화면 전체**에 덮는 한 장(container 위 캔버스)이다 — 장학금 공고·실시간 공고까지 덮는다.
     앱에서는 container = 앱 전체 틀 · 시안에서는 휴대폰 틀. 누르기를 막지 않는다(pointer-events: none) · 2.3초 뒤 걷힌다.
     🔴 '동작 줄이기'를 켠 폰에서는 부르지 않는다(Mood 가 REDUCED 면 던지지 않는다) */
  function ScreenHit(container) {
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '60', display: 'none' });
    container.appendChild(cv);
    const g = cv.getContext('2d');
    function drawClub(x, y, s, a) {
      g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
      const L = 120;
      const wood = g.createLinearGradient(0, -14, 0, 14); wood.addColorStop(0, '#c98d4e'); wood.addColorStop(0.45, '#a86c34'); wood.addColorStop(1, '#6e4420');
      g.fillStyle = wood; g.beginPath(); g.moveTo(-L * 0.15, -5); g.lineTo(L * 0.6, -13); g.quadraticCurveTo(L * 0.72, 0, L * 0.6, 13); g.lineTo(-L * 0.15, 5); g.closePath(); g.fill();
      g.fillStyle = '#2b2b33'; g.beginPath(); g.moveTo(-L * 0.42, -4.5); g.lineTo(-L * 0.12, -5.2); g.lineTo(-L * 0.12, 5.2); g.lineTo(-L * 0.42, 4.5); g.closePath(); g.fill();
      g.fillStyle = '#5b3a1c'; g.beginPath(); g.ellipse(-L * 0.44, 0, 3, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-L * 0.1, -9, L * 0.62, 2.5);
      g.restore();
    }
    function makeCrack(ix, iy, w, h) {
      const lines = [], n = 13, R = Math.hypot(w, h);
      const rays = [];
      for (let i = 0; i < n; i++) {
        let a = (i / n) * Math.PI * 2 + rand(-0.18, 0.18), x = ix, y = iy, len = 0; const pts = [[x, y]];
        while (len < R) { const step = rand(18, 46); a += rand(-0.22, 0.22); x += Math.cos(a) * step; y += Math.sin(a) * step; len += step; pts.push([x, y]); if (x < -20 || y < -20 || x > w + 20 || y > h + 20) break; }
        rays.push(pts); lines.push({ pts, w: rand(1.1, 2.2) });
      }
      [28, 62, 115].forEach((r, ri) => {   // 고리 — 이웃 빛살 사이를 잇는 금
        for (let i = 0; i < n; i++) {
          if (Math.random() < 0.25 + ri * 0.15) continue;
          const p1 = pointAt(rays[i], r * rand(0.85, 1.15)), p2 = pointAt(rays[(i + 1) % n], r * rand(0.85, 1.15));
          if (p1 && p2) lines.push({ pts: [p1, [(p1[0] + p2[0]) / 2 + rand(-6, 6), (p1[1] + p2[1]) / 2 + rand(-6, 6)], p2], w: rand(0.8, 1.4) });
        }
      });
      function pointAt(pts, d) { let acc = 0; for (let i = 1; i < pts.length; i++) { const s2 = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + s2 >= d) { const u = (d - acc) / s2; return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; } acc += s2; } return null; }
      return lines;
    }
    function drawCrack(lines, ix, iy, grow, alpha) {
      g.save(); g.globalAlpha = alpha;
      const maxD = grow * 1400;
      // 조각 그늘 — 가운데 둘레
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(ix, iy, 26 * Math.min(1, grow * 3), 0, Math.PI * 2); g.fill();
      [['rgba(20,24,34,.55)', 2.6], ['rgba(255,255,255,.95)', 1]].forEach(([col, k]) => {
        g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
        lines.forEach((l) => {
          g.lineWidth = l.w * k; g.beginPath(); let acc = 0;
          for (let i = 0; i < l.pts.length; i++) {
            const p = l.pts[i];
            if (i) { const q = l.pts[i - 1], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (acc + d > maxD) { const u = (maxD - acc) / d; g.lineTo(lerp(q[0], p[0], u), lerp(q[1], p[1], u)); break; } acc += d; g.lineTo(p[0], p[1]); }
            else g.moveTo(p[0], p[1]);
          }
          g.stroke();
        });
      });
      const rg = g.createRadialGradient(ix, iy, 0, ix, iy, 22); rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(ix, iy, 22, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    let run = 0;
    return {
      canvas: cv,
      /* at(ms): 시안 사진용 — 그 순간 한 장만 그리고 멈춘다 */
      fire(from, at) {
        const my = ++run, rect = container.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
        const w = rect.width, h = rect.height; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
        cv.style.display = 'block';
        const sx = clamp(from.x - rect.left, 0, w), sy = clamp(from.y - rect.top, 0, h);
        const ix = w * rand(0.42, 0.58), iy = h * rand(0.36, 0.5), FLY = 430;
        let crack = null; const t0 = performance.now() - (at || 0);
        (function step(now) {
          if (my !== run) return;
          const e = now - t0; g.clearRect(0, 0, w, h);
          if (e < FLY) {   // 날아온다 — 작게 떠나 점점 커지며(다가오며) 빙글
            const u = e / FLY, k = Math.pow(u, 1.7);
            drawClub(lerp(sx, ix, k), lerp(sy, iy, k) - Math.sin(u * Math.PI) * h * 0.12, 0.35 * Math.pow(10, u), u * Math.PI * 4.2);
          } else {
            if (!crack) {
              crack = makeCrack(ix, iy, w, h);
              if (navigator.vibrate) { try { navigator.vibrate([30, 30, 60]); } catch (er) {} }
            }
            const d = e - FLY;
            if (d < 110) { g.fillStyle = `rgba(255,255,255,${0.55 * (1 - d / 110)})`; g.fillRect(0, 0, w, h); }   // 번쩍
            const shake = d < 340 ? (1 - d / 340) * 9 : 0;
            container.style.transform = shake ? `translate(${rand(-shake, shake)}px, ${rand(-shake, shake)}px)` : '';
            drawCrack(crack, ix, iy, Math.min(1, d / 160), d < 1500 ? 1 : Math.max(0, 1 - (d - 1500) / 450));
            if (d >= 1950) { g.clearRect(0, 0, w, h); cv.style.display = 'none'; container.style.transform = ''; return; }
          }
          if (at == null) requestAnimationFrame(step);
        })(performance.now());
      },
    };
  }
  K.ScreenHit = ScreenHit;
})();
