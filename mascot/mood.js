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

  /* 회장님 의자(11-21 개발자 지시 5차 — "비싸 보이는 회장님 의자") — 고급 사무용 임원 의자의 공통 모습:
     머리 위까지 오는 높은 등받이 + 머리 받침 · 다이아몬드 단추 누빔(체스터필드) 가죽 · 두툼하게 말린 팔걸이 · 호두나무 장식 · 금빛 다섯 갈래 바퀴 다리.
     가죽은 짙은 와인색(옥스블러드) · 단추·바퀴 다리는 금. 몸 너비(bw)·높이(bh)·등 자리(back)에 맞춘다 · 장면(바닥)에 둔다 */
  function makeChair(bw, back, seatTop, bh) {
    const g = new T.Group();
    const leather = mat(0x5a1a1f, 0.42, 0.05), leatherDk = mat(0x3d1014, 0.5, 0.05), wood = mat(0x5b3418, 0.35, 0.1), gold = mat(0xd8ac45, 0.2, 1.0), black = mat(0x1a1a1e, 0.5, 0.2);
    gold.emissive = new T.Color(0x4a3000); gold.emissiveIntensity = 0.3;
    const W = bw * 1.18, D = Math.max(0.9, bw * 0.75), H = Math.max(1.6, (bh || 2) * 0.95);
    const soft = (w, h, d, m, r) => {   // 모서리 둥근 쿠션(누빈 가죽)
      const sh = new T.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      const geo = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: Math.min(0.06, d * 0.3), bevelSize: Math.min(0.05, r * 0.5), bevelSegments: 3, curveSegments: 8 });
      geo.translate(0, 0, -d / 2); return new T.Mesh(geo, m);
    };
    // 앉는 쿠션
    const seat = soft(W, D, 0.2, leather, 0.12); seat.rotation.x = -Math.PI / 2; seat.position.set(0, seatTop - 0.1, -0.02); g.add(seat);
    // 높은 등받이 — 살짝 뒤로 기울고, 위가 넓다(날개) · 다이아몬드 단추 누빔 · 머리 받침
    const backG = new T.Group(); backG.position.set(0, seatTop, back - 0.18); backG.rotation.x = -0.16; g.add(backG);
    const bk = soft(W * 1.02, H, 0.26, leather, 0.22); bk.position.y = H / 2; backG.add(bk);
    [-1, 1].forEach((s) => { const wing = soft(0.16, H * 0.55, 0.42, leatherDk, 0.07); wing.position.set(s * (W * 0.51 + 0.02), H * 0.66, 0.12); wing.rotation.y = s * -0.35; backG.add(wing); });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = (c - 1.5) * W * 0.22 + (r % 2 ? W * 0.11 : 0); if (Math.abs(x) > W * 0.4) continue;
      backG.add(sph(0.028, gold, x, H * (0.22 + r * 0.16), 0.2));
    }
    const pillow = soft(W * 0.7, H * 0.17, 0.18, leatherDk, 0.08); pillow.position.set(0, H * 0.9, 0.18); backG.add(pillow);
    const trim = soft(W * 1.04, 0.07, 0.3, wood, 0.03); trim.position.set(0, H + 0.02, 0); backG.add(trim);   // 위 호두나무 테
    // 두툼하게 말린 팔걸이 + 호두나무 앞머리
    [-1, 1].forEach((s) => {
      const arm = new T.Mesh(new T.CapsuleGeometry(0.11, D * 0.75, 6, 14), leather); arm.rotation.x = Math.PI / 2; arm.position.set(s * (W / 2 + 0.06), seatTop + 0.34, 0); g.add(arm);
      const cap = sph(0.115, wood, s * (W / 2 + 0.06), seatTop + 0.34, D * 0.45, 1, 1, 0.55); g.add(cap);
      const post = soft(0.1, 0.34, 0.5, leatherDk, 0.04); post.position.set(s * (W / 2 + 0.06), seatTop + 0.15, -0.05); g.add(post);
    });
    // 금빛 다섯 갈래 다리 · 바퀴 · 크롬 기둥
    const stem = cyl(0.06, 0.07, Math.max(0.1, seatTop - 0.3), mat(0xc9cdd4, 0.18, 1.0), 14); stem.position.y = (seatTop - 0.3) / 2 + 0.14; g.add(stem);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, leg = box(0.08, 0.06, 0.6, gold); leg.position.set(Math.sin(a) * 0.29, 0.13, Math.cos(a) * 0.29 - 0.05); leg.rotation.y = a; g.add(leg);
      g.add(sph(0.065, black, Math.sin(a) * 0.57, 0.06, Math.cos(a) * 0.57 - 0.05, 1, 1, 0.8));
    }
    g.userData.armY = seatTop + 0.45; g.userData.armX = W / 2 + 0.06; g.userData.armZ = D * 0.25;
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
      const sw = mat(0x8fd3ff, 0.1, 0.1); sw.emissive = new T.Color(0x2a6a9a); sw.emissiveIntensity = 0.35;
      const d = new T.Group(); d.add(sph(er * 0.6, sw, 0, 0, 0, 0.85, 1.1, 0.7)); const tip = new T.Mesh(new T.ConeGeometry(er * 0.47, er * 1.0, 14), sw); tip.position.y = er * 0.82; d.add(tip);
      d.add(sph(er * 0.16, new T.MeshBasicMaterial({ color: 0xffffff }), -er * 0.2, er * 0.15, er * 0.38));   // 반짝이
      d.position.set(hw * 0.82, top * 0.45, front * 0.55); d.visible = false; head.add(d); rig.sweat = d;
    }
    // 손 자리(지폐를 뿌리는 곳 · 몽둥이를 쥐는 곳) — 팔 묶음의 맨 아래
    /* 팔꿈치 — 팔을 위팔(어깨 묶음)과 아래팔(팔꿈치 묶음)로 나눈다(11-21 개발자 지시 4차 "팔을 굽힌 다음 펴서 던진다 · 손으로 뒤통수를 쥔다").
       원래 팔은 한 덩어리(긴 소매 공 하나 + 소맷단 + 손)라 굽지 않는다 — 소매 공을 위·아래 두 개로 바꿔 끼우고, 팔꿈치 아래 부품(소맷단·손·손가락)을 팔꿈치 묶음으로 옮긴다.
       가만히 있을 때 모양은 예전과 같다(두 공이 이어져 한 소매처럼 보인다).
       소매·맨팔(과잠을 손으로 벗는 연출): 벗을 때 소매 부품을 과잠 묶음으로 옮겨 붙이면(attach — 그 자리 그대로) 팔이 빠져나가며 소매가 남는다. 그 밑에 맨팔을 숨겨 둔다 */
    /* 🔴 팔 묶음의 '고르지 않은 크기'(길이 0.6 · 굵기 0.72 같은)를 부품 쪽으로 옮겨 굽는다 — 그대로 두면 팔꿈치를 굽히거나 부품을 다른 묶음으로 옮길 때
       비틀린 모양(층밀림)이 생긴다(11-21 개발자 지적 "과잠을 벗는 모션에서 마스코트가 일그러져"). 보이는 모양은 그대로다 */
    (ch.arms || []).forEach((a) => {
      const S = a.scale.clone(); if (Math.abs(S.x - S.y) < 1e-6 && Math.abs(S.y - S.z) < 1e-6) return;
      const Sm = new T.Matrix4().makeScale(S.x, S.y, S.z);
      a.children.slice().forEach((o) => { o.updateMatrix(); const m = new T.Matrix4().multiplyMatrices(Sm, o.matrix); m.decompose(o.position, o.quaternion, o.scale); });
      a.scale.set(1, 1, 1); a.userData.baked = S;
    });
    rig.limbs = (ch.arms || []).map((a) => {
      const meshes = a.children.filter((o) => o.isMesh);
      if (!meshes.length) return null;
      const handY = Math.min.apply(null, meshes.map((o) => o.position.y));
      const hand = meshes.find((o) => o.position.y === handY);
      // 소매 = 위아래로 가장 길쭉한 공(손 말고) · 팔 길이에 맞춰 잰다(굽기 뒤라 숫자가 캐릭터마다 다르다)
      const sleeve = meshes.filter((o) => o !== hand && o.geometry && o.geometry.type === 'SphereGeometry' && o.scale.y > o.scale.x * 1.5).sort((p, q) => q.scale.y - p.scale.y)[0] || null;
      const L = Math.max(0.1, -handY);
      const EY = sleeve ? sleeve.position.y : handY * 0.5;          // 팔꿈치 — 소매 한가운데(없으면 팔 중간)
      const elbow = new T.Group(); elbow.position.y = EY; a.add(elbow);
      const sleeveParts = [];
      let r0 = L * 0.18;
      if (sleeve) {
        const r = sleeve.scale.x, ry = sleeve.scale.y, top = sleeve.position.y + ry, bot = sleeve.position.y - ry; r0 = r;
        const up = sph(r, sleeve.material, 0, (top + EY) / 2, 0, 1, (top - EY) / 2 / r * 1.18, 1); a.add(up);
        const lo = sph(r * 0.96, sleeve.material, 0, (bot - EY) / 2, 0, 1, (EY - bot) / 2 / (r * 0.96) * 1.18, 1); elbow.add(lo);
        sleeve.visible = false; sleeveParts.push(up, lo);
      }
      // 팔꿈치 아래 부품을 팔꿈치 묶음으로(그 자리 그대로 — 팔 묶음이 고른 크기라 비틀리지 않는다)
      meshes.filter((o) => o !== sleeve && o.position.y < EY - L * 0.05).forEach((o) => { elbow.attach(o); if (o !== hand && ch.jacket && o.position.y > handY - EY + L * 0.1) sleeveParts.push(o); });
      // 맨팔 — 위팔·아래팔(손과 같은 색 · 소매보다 가늘게)
      const skin = hand ? hand.material : mat(0xffffff), br = r0 * 0.5;
      const bu = new T.Mesh(new T.CapsuleGeometry(br, Math.max(0.02, -EY - br), 4, 10), skin); bu.position.y = EY / 2; bu.visible = false; a.add(bu);
      const bl = new T.Mesh(new T.CapsuleGeometry(br * 0.95, Math.max(0.02, EY - handY - br * 2), 4, 10), skin); bl.position.y = (handY - EY) / 2; bl.visible = false; elbow.add(bl);
      return { arm: a, elbow, hand, L, EY, r: r0, sleeveParts, bare: [bu, bl], off: false };
    });
    rig.elbows = rig.limbs.map((l) => (l ? l.elbow : null));
    rig.handLocal = (i) => { const l = rig.limbs[i]; return l && l.hand ? l.hand.position.clone() : new T.Vector3(0, -0.3, 0); };   // 팔꿈치 묶음 안의 손 자리
    /* 손 닿기 풀이(IK) — 손을 목표 자리(캐릭터 기준 좌표)에 가장 가깝게 두는 어깨·팔꿈치 각을 찾는다. 캐릭터마다 팔 길이가 달라
       각을 손으로 정하면 어떤 캐릭터는 손이 머리를 뚫고 어떤 캐릭터는 안 닿는다 — 자세마다 한 번 풀어 기억한다(rig.poses).
       q = [어깨 벌림(옆으로 · 0 내림 ~ π 위), 어깨 앞뒤(− 앞 · + 뒤), 팔꿈치 안쪽 굽힘, 팔꿈치 앞뒤 굽힘(− 앞 · + 뒤)] */
    const _inv = new T.Matrix4(), _h = new T.Vector3(), _e = new T.Vector3();
    function armHand(i, q) {
      const sl = rig.limbs[i]; const a = sl.arm, el = sl.elbow, sd = a.userData.side;
      a.rotation.set(q[1], 0, sd * q[0]); el.rotation.set(q[3], 0, sd * q[2]);
      ch.root.updateWorldMatrix(true, true); _inv.copy(ch.root.matrixWorld).invert();
      el.localToWorld(_e.set(0, 0, 0)).applyMatrix4(_inv);
      return el.localToWorld(_h.copy(sl.hand ? sl.hand.position : new T.Vector3(0, -0.2, 0))).applyMatrix4(_inv);
    }
    rig.solveArm = (i, target, init, lo, hi, extra) => {
      const sl = rig.limbs[i]; if (!sl) return init.slice();
      const keepA = sl.arm.rotation.clone(), keepE = sl.elbow.rotation.clone(), keepH = ch.head.rotation.clone();
      ch.head.rotation.set(0, 0, 0);
      const cost = (q) => { const h = armHand(i, q); return h.distanceToSquared(target) + (extra ? extra(h, q, _e) : 0); };
      let q = init.slice(), best = cost(q);
      for (let step = 0.5; step > 0.01; step *= 0.6) {
        for (let it = 0; it < 6; it++) { let moved = false;
          for (let k = 0; k < 4; k++) for (const d of [step, -step]) { const n = q.slice(); n[k] = clamp(n[k] + d, lo[k], hi[k]); const c = cost(n); if (c < best - 1e-6) { best = c; q = n; moved = true; } }
          if (!moved) break; }
      }
      sl.arm.rotation.copy(keepA); sl.elbow.rotation.copy(keepE); ch.head.rotation.copy(keepH);
      ch.root.updateWorldMatrix(true, true);
      return q;
    };
    rig.poses = {};
    /* 팔걸이에 얹은 손 — 의자(rig.chair)의 팔걸이 끝 · 앉은 자세(들어 올림·뒤로 기댐)를 반영해 한 번 푼다 */
    rig.armrestPose = (i) => {
      rig.poses.armrest = rig.poses.armrest || [];
      if (rig.poses.armrest[i]) return rig.poses.armrest[i];
      const sl = rig.limbs[i], cd = rig.chair && rig.chair.userData; if (!sl || !cd) return [0.5, -0.3, 0, -0.5];
      const k = ch.root.scale.x || 1, sd = sl.arm.userData.side;
      // 의자 팔걸이 끝(바닥 기준) → 앉은 캐릭터 기준 좌표(들어 올림 · 뒤로 물러남 · 뒤로 기댐을 되돌려)
      const seated = new T.Matrix4().compose(new T.Vector3(0, rig.seatLift, -0.14), new T.Quaternion().setFromEuler(new T.Euler(-0.24, 0, 0)), new T.Vector3(k, k, k));
      const target = new T.Vector3(sd * cd.armX * 0.92 * k, (cd.armY + 0.04) * k, cd.armZ * k).applyMatrix4(seated.invert());
      rig.poses.armrest[i] = rig.solveArm(i, target, [0.5, -0.4, 0, -0.6], [0.0, -1.6, -1.2, -2.0], [1.4, 0.8, 1.2, 0.6]);
      return rig.poses.armrest[i];
    };
    /* 몸수색 자세 — 손을 뒤통수(머리 뒤쪽 가운데 가까이)에 · 손이 머리보다 앞으로 나오면 벌점(앞에서 보이면 안 된다) · 팔꿈치는 옆으로 벌린 쪽을 좋아한다 */
    rig.friskPose = () => {
      if (rig.poses.frisk) return rig.poses.frisk;
      const hb2 = localBox(ch.head, ch.head), zc = (hb2.max.z + hb2.min.z) / 2, yc = (hb2.max.y + hb2.min.y) / 2;
      rig.poses.frisk = rig.limbs.map((sl, i) => {
        if (!sl) return null; const s = sl.arm.userData.side;
        const target = rig.headToRoot(new T.Vector3(s * rig.hw * 0.22, yc + (hb2.max.y - yc) * 0.15, zc - (zc - hb2.min.z) * 0.75));
        const front = rig.headToRoot(new T.Vector3(0, yc, zc)).z, hx = rig.headToRoot(new T.Vector3(hb2.max.x, yc, zc)).x;
        return rig.solveArm(i, target, [2.3, 0.5, 1.3, 1.0], [1.2, -0.6, -0.4, -0.3], [3.0, 1.5, 2.7, 2.8],
          (h, q, e) => (h.z > front - 0.05 ? 6 * (h.z - front + 0.05) * (h.z - front + 0.05) : 0)
            + (Math.abs(e.x) < hx * 1.08 ? 4 * (hx * 1.08 - Math.abs(e.x)) * (hx * 1.08 - Math.abs(e.x)) : 0));   // 팔꿈치는 머리 밖으로 보이게
      });
      return rig.poses.frisk;
    };
    rig.setArm = (i, q, k) => { const sl = rig.limbs[i]; if (!sl) return; const sd = sl.arm.userData.side, w = k == null ? 1 : k;
      sl.arm.rotation.z = lerp(sl.arm.rotation.z, sd * q[0], w); sl.arm.rotation.x = lerp(sl.arm.rotation.x, q[1], w);
      sl.elbow.rotation.z = lerp(sl.elbow.rotation.z, sd * q[2], w); sl.elbow.rotation.x = lerp(sl.elbow.rotation.x, q[3], w); };
    // 머리 묶음 좌표 → 캐릭터 기준 좌표
    rig.headToRoot = (v) => { const kh = ch.head.rotation.clone(); ch.head.rotation.set(0, 0, 0); ch.root.updateWorldMatrix(true, true); const out = ch.head.localToWorld(v.clone()).applyMatrix4(new T.Matrix4().copy(ch.root.matrixWorld).invert()); ch.head.rotation.copy(kh); return out; };
    /* 몸통 크기(머리·팔 빼고) — 가슴·허리 자리를 정하는 데 쓴다 */
    {
      ch.root.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(ch.root.matrixWorld).invert(), bb = new T.Box3(), skip = new Set((ch.arms || []).concat([ch.head]));
      (function walk(o) { if (skip.has(o)) return; if (o.isMesh && o.geometry && o.visible !== false) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); bb.union(_b); } o.children.forEach(walk); })(ch.squash);
      const hb3 = localBox(ch.head, ch.root);
      rig.body = { top: Math.min(bb.max.y, hb3.min.y + (hb3.max.y - hb3.min.y) * 0.25), bot: bb.min.y, front: bb.max.z, w: bb.max.x - bb.min.x };
      rig.body.chest = lerp(rig.body.bot, rig.body.top, 0.72); rig.body.waist = lerp(rig.body.bot, rig.body.top, 0.38);
    }
    /* 빈 소매 — 과잠에 달린 채 늘어진 소매(벗은 뒤 보인다) · 팔 소매와 같은 색 · 과잠 묶음 안이라 같이 움직인다 */
    rig.emptySleeves = rig.limbs.map((sl) => {
      if (!sl || !ch.jacket || !sl.sleeveParts.length) return null;
      const g = new T.Group(), sd = sl.arm.userData.side; g.position.copy(sl.arm.position); g.rotation.z = sd * 0.22;
      const tube = new T.Mesh(new T.CapsuleGeometry(sl.r * 0.92, sl.L * 0.62, 4, 12), sl.sleeveParts[0].material); tube.position.y = -sl.L * 0.42; g.add(tube);
      const cuffSrc = sl.sleeveParts.find((o) => o.geometry && o.geometry.type === 'TorusGeometry');
      if (cuffSrc) { const cf = new T.Mesh(cuffSrc.geometry, cuffSrc.material); cf.rotation.x = Math.PI / 2; cf.position.y = -sl.L * 0.8; cf.scale.copy(cuffSrc.scale); g.add(cf); }
      g.visible = false; ch.jacket.add(g); return g;
    });
    /* 과잠을 손에 쥐기 · 바닥에 두기 — 과잠 묶음(몸 묶음 안)을 옮길 뿐이다(부품을 옮겨 붙이지 않는다 → 비틀림 없음) */
    if (ch.jacket) {
      const jb = localBox(ch.jacket, ch.squash); rig.collar = new T.Vector3(0, jb.max.y - 0.04, (jb.max.z + jb.min.z) / 2);
      const held = { p: new T.Vector3(), r: new T.Euler() };
      rig.jacketToHand = (i) => {
        const sl = rig.limbs[i]; if (!sl) return;
        ch.root.updateWorldMatrix(true, true);
        const hw2 = sl.elbow.localToWorld(rig.handLocal(i)), hl = ch.squash.worldToLocal(hw2);
        ch.jacket.rotation.set(0.15, 0, Math.sin(performance.now() / 1000 * 9) * 0.12); ch.jacket.scale.set(1, 1, 1);
        const c = rig.collar.clone().applyEuler(ch.jacket.rotation);
        ch.jacket.position.copy(hl).sub(c); held.p.copy(ch.jacket.position); held.r.copy(ch.jacket.rotation);
      };
      const FL = { p: new T.Vector3(-0.8, 0.02, 0.25), rz: 1.5, s: new T.Vector3(0.42, 0.9, 0.5) };
      rig.jacketFloor = (g) => {
        const k = clamp(g, 0, 1);
        ch.jacket.position.set(lerp(held.p.x, FL.p.x, k), lerp(held.p.y, FL.p.y, k) + Math.sin(k * Math.PI) * 0.25, lerp(held.p.z, FL.p.z, k));
        ch.jacket.rotation.set(held.r.x * (1 - k), 0, lerp(held.r.z, FL.rz, k));
        ch.jacket.scale.set(lerp(1, FL.s.x, k), lerp(1, FL.s.y, k), lerp(1, FL.s.z, k));
      };
    } else { rig.jacketToHand = () => {}; rig.jacketFloor = () => {}; }
    /* 화남 자세 — 손으로 정한 각 + 캐릭터마다 손 닿기로 푼 각(앞섶 잡기 · 와인드업 · 허리에 손) · 한 번 풀어 기억한다
       q = [어깨 벌림, 어깨 앞뒤(+뒤), 팔꿈치 옆 굽힘(+바깥), 팔꿈치 앞뒤 굽힘(+뒤 · −앞)] */
    rig.angryPoses = () => {
      if (rig.poses.angry) return rig.poses.angry;
      const B = rig.body, lo = [-1.2, -2.8, -2.0, -2.8], hi = [3.0, 1.6, 2.0, 2.0];
      const solveAll = (fn, init) => rig.limbs.map((sl, i) => (sl ? rig.solveArm(i, fn(sl.arm.userData.side), init, lo, hi) : null));
      const lapel = solveAll((sd) => new T.Vector3(sd * B.w * 0.13, B.chest + (B.top - B.chest) * 0.5, B.front + 0.04), [0.2, -1.0, -0.3, -1.2]);
      const hips = rig.limbs.map((sl, i) => (sl ? rig.solveArm(i, new T.Vector3(sl.arm.userData.side * B.w * 0.5, B.waist, B.front * 0.25), [0.9, 0.2, -1.0, 0], lo, hi,
        (h, q, e) => (Math.abs(e.x) < B.w * 0.62 ? 3 * (B.w * 0.62 - Math.abs(e.x)) * (B.w * 0.62 - Math.abs(e.x)) : 0)) : null));   // 팔꿈치는 바깥으로
      const iT = (ch.arms || []).findIndex((a) => a.userData.side === 1);
      const windup = iT >= 0 ? rig.solveArm(iT, new T.Vector3(-B.w * 0.05, B.chest, B.front + 0.18), [0.0, -1.2, -0.6, -1.2], lo, hi) : [0, -1.2, 0, -1.2];
      const balance = rig.limbs.map((sl, i) => (sl && i !== iT ? rig.solveArm(i, new T.Vector3(B.w * 0.02, B.chest, B.front + 0.2), [0.0, -1.2, -0.6, -1.2], lo, hi) : null)).find(Boolean) || [0.2, -1.2, 0, -1.2];
      rig.poses.angry = {
        rest: [0.3, 0, 0, 0], lapel, hips, yank: [1.05, 0.75, 0.1, -0.35], shake: [0.35, 0.95, 0, 0],
        catchBack: [0.45, 1.25, 0, 0.3], swingUp: [2.35, 0.25, 0.3, 0], slam: [0.75, -0.95, 0, 0], reachFloor: [0.25, -0.95, 0, -0.35],
        windup, balance, armBack: [0.6, 1.1, 0, 0], lead: [0.9, -1.35, 0, 0], cocked: [1.55, 0.3, 1.45, 0.95], release: [1.9, -1.15, 0.15, -0.1],
        follow: [-0.45, -1.1, 0, -0.3], pullIn: [0.35, -0.5, -0.4, -1.3],
      };
      return rig.poses.angry;
    };
    /* 벗기·입기 — 🔴 부품을 다른 묶음으로 옮기지 않는다(옮기면 비틀렸다). 팔의 소매는 숨기고 맨팔을 보이며, 과잠 쪽 '빈 소매'(아래 jacketSleeves)를 켠다 */
    rig.undress = (i) => { const sl = rig.limbs[i]; if (!sl || sl.off || !ch.jacket || !sl.sleeveParts.length) return; sl.sleeveParts.forEach((o) => { o.visible = false; }); sl.bare.forEach((b) => { b.visible = true; }); if (rig.emptySleeves && rig.emptySleeves[i]) rig.emptySleeves[i].visible = true; sl.off = true; };
    rig.dress = () => rig.limbs.forEach((sl, i) => { if (!sl || !sl.off) return; sl.sleeveParts.forEach((o) => { o.visible = true; }); sl.bare.forEach((b) => { b.visible = false; }); if (rig.emptySleeves && rig.emptySleeves[i]) rig.emptySleeves[i].visible = false; sl.off = false; });
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
    // 튀는 땀방울
    const dropMat = mat(0x8fd3ff, 0.12, 0.1); dropMat.emissive = new T.Color(0x2a6a9a); dropMat.emissiveIntensity = 0.35;
    const drops = Array.from({ length: 16 }, () => { const d = sph(0.06, dropMat, 0, 0, 0, 0.8, 1.15, 0.8); d.visible = false; d.userData = { life: 9, v: new T.Vector3(), s: 1 }; scene.add(d); return d; });
    function emitDrop(side) {
      const d = drops.find((q) => !q.visible); if (!d) return;
      rig.ch.head.localToWorld(W.set(side * rig.hw * 0.85, rig.top * rand(0.25, 0.6), rig.front * 0.2));
      d.position.copy(W); d.visible = true; d.userData.life = 0; d.userData.s = rand(0.9, 1.5) * rig.ch.root.scale.x;
      d.userData.v.set(side * rand(1.2, 2.2), rand(1.4, 2.4), rand(0, 0.6));
    }
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
        /* 화남 — 11-21 개발자 지시 5차(실제 동작 리서치 반영 · 눈썹·말풍선 없음)
           과잠 벗기(실제로 사람이 벗는 차례를 빠르게): 0.4~0.65 두 손으로 앞섶을 움켜쥔다 → 0.65~0.95 확 젖혀 어깨 뒤로 밀어낸다 →
             0.95~1.25 두 팔을 뒤로 쭉 뻗어 털면 소매에서 팔이 빠진다(소매는 과잠에 남는다) → 1.25~1.5 떨어지는 과잠 깃을 한 손으로 낚아채고 →
             1.5~1.9 옆 바닥에 패대기친다
           몽둥이: 1.9~2.6 몸을 숙여 줍는다
           던지기(투구 동작 순서 — 와인드업 → 내딛기 → 팔 뒤로 젖히기 → 가속 → 놓기 → 팔로우스루): 2.6~2.9 몸을 옆으로 틀며 앞발을 들고 몽둥이를 가슴 앞에 모은다 →
             2.9~3.15 앞발을 화면 쪽으로 내딛고 던질 팔을 아래·뒤로 → 3.15~3.35 팔꿈치를 어깨 높이로 들고 아래팔을 세워 몽둥이를 머리 뒤로 젖힌다 →
             3.35~3.45 몸을 화면 쪽으로 홱 돌리며 팔꿈치를 쭉 편다 · 3.43 놓는다(ScreenHit) → 3.45~3.9 팔이 몸을 가로질러 반대쪽 아래로 · 몸은 앞으로 숙인다
           3.9~5.0 허리에 손 · 고개 홱 · 발 동동 · 5.0~5.8 과잠을 주워 어깨 뒤에 걸치고 팔을 넣어 여민다 · 5.9 끝 */
        const thrower = armOf(1) || ch.arms[1], other = armOf(-1) || ch.arms[0];
        const ts = thrower ? thrower.userData.side : 1, iT = ch.arms.indexOf(thrower), iO = ch.arms.indexOf(other);
        blush = 0.6; mark.visible = t < 5.0;
        headTopWorld(W, 0.05); mark.position.set(W.x + 0.42 * ch.root.scale.x, W.y + 0.05, W.z); mark.scale.setScalar(0.42 * (1 + Math.sin(t * 14) * 0.08));
        if (t < 5.0 && Math.floor(t * 8) !== Math.floor((t - dt) * 8)) { emitSteam(-1); emitSteam(1); }
        if (REDUCED) { if (t > 2.2) stop(); }
        else {
          if (t < 0.4) ch.root.position.x += Math.sin(t * 55) * 0.02;
          const jk = ch.jacket || null, P0 = rig.angryPoses();
          const setA = (i, q, k) => rig.setArm(i, q, k == null ? 1 : k);
          const blend = (q1, q2, u) => q1.map((v, k) => lerp(v, q2[k], u));
          // ── 과잠 벗기 ──
          if (t >= 0.4 && t < 1.9) {
            const a = ease(seg(t, 0.4, 0.65)), b = ease(seg(t, 0.65, 0.95)), c = ease(seg(t, 0.95, 1.25));
            for (const i of [iO, iT]) {
              let q = blend(P0.rest, P0.lapel[i] || P0.rest, a);
              q = blend(q, P0.yank, b); q = blend(q, P0.shake, c);
              setA(i, q);
            }
            if (jk) {
              // 앞섶을 젖혀 어깨 뒤로(b) → 팔을 털며 아래·뒤로 흘러내린다(c)
              jk.position.set(0, -0.15 * b - 0.35 * c, -0.25 * b - 0.2 * c); jk.rotation.set(0.35 * b + 0.25 * c, 0, 0);
              if (t >= 1.05) { rig.undress(iO); rig.undress(iT); }
              ch.root.rotation.x = 0.12 * b - 0.05 * c; ch.root.rotation.z = Math.sin(t * 18) * 0.05 * c;
            }
            if (t >= 1.25) {
              // 한 손(반대쪽)이 뒤로 떨어지는 과잠 깃을 낚아채 → 옆으로 크게 휘둘러 바닥에 패대기
              const d = ease(seg(t, 1.25, 1.42)), e = ease(seg(t, 1.42, 1.62)), f = ease(seg(t, 1.62, 1.78));
              let q = blend(P0.shake, P0.catchBack, d); q = blend(q, P0.swingUp, e); q = blend(q, P0.slam, f); setA(iO, q);
              setA(iT, blend(P0.shake, P0.rest, d));
              if (jk && t < 1.72) rig.jacketToHand(iO);
              else if (jk) { const g = ease(seg(t, 1.72, 1.9)); rig.jacketFloor(g); }
              ch.root.rotation.y += -ts * -0.3 * e; ch.root.rotation.x = 0.25 * f;
            }
          } else if (jk && t >= 1.9 && t < 5.0) rig.jacketFloor(1);
          if (!jk && ch.cap) {   // 대장님 — 학사모를 손으로 벗어 바닥에
            if (t >= 0.4 && t < 5.0) { const u = ease(seg(t, 0.6, 1.4)); ch.cap.position.y = 0.7 + Math.sin(u * Math.PI) * 0.6 - u * 1.45; ch.cap.position.x = -0.9 * u; ch.cap.rotation.z = 1.4 * u; }
            else if (t >= 5.0) { const u = ease(seg(t, 5.0, 5.6)); ch.cap.position.y = lerp(0.7 - 1.45, 0.7, u) + Math.sin(u * Math.PI) * 0.8; ch.cap.position.x = -0.9 * (1 - u); ch.cap.rotation.z = 1.4 * (1 - u); }
          }
          // ── 몽둥이 줍기 ──
          rig.club.visible = t < 3.43;
          if (t >= 1.9 && t < 2.6) {
            const u = ease(seg(t, 1.9, 2.2)) * (1 - ease(seg(t, 2.35, 2.6)));
            ch.root.rotation.x = 0.42 * u; ch.root.rotation.y += -ts * 0.3 * u;
            setA(iT, blend(P0.rest, P0.reachFloor, u)); setA(iO, P0.rest);
          }
          if (t >= 2.25 && t < 3.43 && thrower && rig.club.parent !== rig.elbows[iT]) {
            const el = rig.elbows[iT]; el.add(rig.club); rig.club.position.copy(rig.handLocal(iT)); rig.club.rotation.set(0, 0, Math.PI); rig.club.scale.setScalar(1);
          }
          // ── 던지기 ──
          if (t >= 2.6 && t < 3.9 && thrower) {
            const w = ease(seg(t, 2.6, 2.9)), st = ease(seg(t, 2.9, 3.15)), ck = ease(seg(t, 3.15, 3.35)), ac = ease(seg(t, 3.35, 3.45)), ft = ease(seg(t, 3.45, 3.85));
            let q = blend(P0.rest, P0.windup, w); q = blend(q, P0.armBack, st); q = blend(q, P0.cocked, ck); q = blend(q, P0.release, ac); q = blend(q, P0.follow, ft); setA(iT, q);
            let o = blend(P0.rest, P0.balance, w); o = blend(o, P0.lead, st); o = blend(o, P0.pullIn, ac); o = blend(o, P0.rest, ft); setA(iO, o);
            // 몸 — 옆으로 틀었다가(와인드업·젖히기) 화면 쪽으로 홱(가속) · 팔로우스루에서 앞으로 숙임
            ch.root.rotation.y += -ts * (0.95 * w * (1 - ac)) + ts * 0.35 * ac * (1 - ft * 0.6);
            ch.root.rotation.x = -0.1 * ck + 0.35 * ac * (1 - ft * 0.3) + 0.15 * ft;
            // 발 — 앞발(반대쪽) 들기 → 화면 쪽으로 내딛기 · 뒷발은 팔로우스루에서 살짝 든다
            const lift = Math.sin(seg(t, 2.6, 3.15) * Math.PI) * 0.22, stride = st;
            rig.legs.forEach((l) => { if (l.s === -ts) l.o.position.set(l.x, l.y + lift, l.z + 0.28 * stride); else l.o.position.set(l.x, l.y + 0.1 * ft * (1 - ft) * 4, l.z - 0.08 * ft); });
            if (t >= 3.43 && !M.thrown) {
              M.thrown = true; rig.club.visible = false;
              rig.elbows[iT].localToWorld(W.copy(rig.handLocal(iT))); W.project(cx.cam);
              const r = cx.btn.getBoundingClientRect();
              if (opt.onThrow) opt.onThrow({ x: r.left + (W.x + 1) / 2 * r.width, y: r.top + (1 - W.y) / 2 * r.height });
            }
          }
          // ── 허리에 손 · 고개 홱 · 발 동동 ──
          if (t >= 3.9 && t < 5.0) {
            const u = ease(seg(t, 3.9, 4.1));
            setA(iT, P0.hips[iT] || P0.rest, u); setA(iO, P0.hips[iO] || P0.rest, u);
            ch.head.rotation.y += 0.5 * ease(seg(t, 3.95, 4.15));
            ch.root.position.y += Math.abs(Math.sin(t * 18)) * 0.05;
          }
          // ── 다시 입기 — 줍고(5.0~5.25) → 어깨 뒤로 휙 걸치고(5.25~5.5) → 팔을 뒤로 넣어 소매에 끼우고(5.5) → 앞으로 여민다(5.5~5.8) ──
          if (t >= 5.0) {
            const p1 = ease(seg(t, 5.0, 5.25)), p2 = ease(seg(t, 5.25, 5.5)), p3 = ease(seg(t, 5.55, 5.8));
            if (jk) {
              if (t < 5.25) { rig.jacketFloor(1 - p1 * 0.15); setA(iO, blend(P0.rest, P0.reachFloor, p1)); ch.root.rotation.x = 0.3 * p1; }
              else if (t < 5.55) {
                jk.position.set(0, -0.15 - 0.35 * (1 - p2), -0.25 - 0.2 * (1 - p2)); jk.rotation.set(0.35 + 0.25 * (1 - p2), 0, 0); jk.scale.set(1, 1, 1);
                setA(iO, blend(P0.reachFloor, P0.shake, p2)); setA(iT, blend(P0.rest, P0.shake, p2));
              } else {
                rig.dress();
                jk.position.set(0, -0.15 * (1 - p3), -0.25 * (1 - p3)); jk.rotation.set(0.35 * (1 - p3), 0, 0);
                setA(iO, blend(P0.yank, P0.rest, p3)); setA(iT, blend(P0.yank, P0.rest, p3));
              }
            }
          }
          if (t > 5.9) { stop(); M.thrown = false; rig.dress(); rig.clubFloor(); }
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
          /* 거만하게(11-21 개발자 지시 5차 — "회장님 의자 · 다리를 꼬고 앉은 모습이 어색") · 리서치: 등받이에 깊이 기대고, 무릎 위로 다리를 꼬고, 팔은 팔걸이에 늘어뜨리고, 턱은 살짝 든다
             회장님 의자가 빙글 돌며 굴러 들어오고 → 깊숙이 앉아 등을 기댄다 → 두 발은 의자 앞에 걸치고(무릎이 굽은 것처럼) 한쪽 발을 다른 무릎 위로 꼬아 까딱인다 →
             가리키지 않는 손은 팔걸이 끝에 얹은 채(손 닿기 풀이) 이따금 손목만 툭 — 지폐가 위로 */
          shades = 1;
          const sit = ease(clamp((M.chair - 0.55) / 0.45, 0, 1));   // 의자가 다 들어온 뒤에 앉는다
          chairOn = 1;
          ch.root.position.y += rig.seatLift * sit;
          ch.root.position.z += -0.14 * sit;
          ch.root.rotation.x = -0.24 * sit; ch.root.rotation.z = -pointSide * 0.04 * sit;
          ch.head.rotation.x -= 0.1 * sit;   // 턱을 살짝 든다
          // 다리 — 의자 앞에 걸친 두 발 · 꼰 발은 반대쪽 무릎 위로 올라가 까딱
          const bob = Math.sin(t * 2.2) * 0.04;
          rig.legs.forEach((l) => {
            if (l.s === -pointSide) l.o.position.set(lerp(l.x, -l.x * 0.35, sit), l.y + (0.44 + bob) * sit, l.z + 0.46 * sit);
            else l.o.position.set(l.x * 0.95, l.y + 0.2 * sit, l.z + 0.34 * sit);
          });
          const other = armOf(-pointSide), oi = ch.arms.indexOf(other);
          if (other && oi >= 0) {
            const rest = rig.armrestPose(oi);
            rig.setArm(oi, rest, sit);
            if (!REDUCED && sit > 0.95) {
              const ph = (t * 0.55) % 1, flick = ph > 0.78 ? Math.sin((ph - 0.78) / 0.22 * Math.PI) : 0;
              if (rig.elbows[oi]) rig.elbows[oi].rotation.x += -1.1 * flick;   // 손목·아래팔만 툭 — 무심하게
              other.rotation.z += other.userData.side * 0.25 * flick;
              if (ph > 0.87 && ph - dt * 0.55 <= 0.87) throwBills(other, 3, true);
            }
          }
          // 렌즈에 반짝 — 가끔
          const gl = ((t + 0.3) * 0.5) % 1;
          if (M.sh > 0.9 && gl < 0.12) { rig.shades.updateWorldMatrix(true, false); rig.shades.localToWorld(W.set(-rig.lensR * 0.6, rig.lensR * 0.4, rig.lensR * 0.4)); glint.visible = true; glint.position.copy(W); glint.scale.setScalar(0.32 * Math.sin(gl / 0.12 * Math.PI)); glint.material.rotation = gl * 6; }
        } else if (M.line === 'due' && M.dday && P) {
          /* 「이럴 수는 없어」(11-21 개발자 지시 4차 — "손으로 뒤통수를 쥐어야지 · 진짜 큰일 나서 믿기지 않는다는 듯") · 참고: 두 손으로 머리를 감싸 쥔 놀란 사람
             팔꿈치를 양옆으로 벌리고 두 손은 뒤통수로 · 고개는 살짝 뒤로 젖혀 멍하니 · 눈은 커진다 · 발 동동 · 식은땀 */
          sweat = true;
          const k = ease(seg(M.dueT, 0, 0.35));
          /* 몸수색 받을 때처럼 — 팔꿈치를 양옆으로 활짝, 두 손은 뒤통수에 붙여 앞에서는 안 보이게(손 닿기 풀이로 캐릭터마다 맞춘다) */
          const fr = rig.friskPose();
          ch.arms.forEach((a, i) => { if (fr[i]) rig.setArm(i, fr[i], k); });
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
      M.chair = chairOn ? Math.min(1, (M.chair || 0) + dt / 0.9) : Math.max(0, (M.chair || 0) - dt / 0.4);   // 0.9초 동안 굴러 들어온다
      rig.chair.visible = M.chair > 0.02;
      if (rig.chair.visible) { const k = ch.root.scale.x, u = ease(M.chair); rig.chair.scale.setScalar(k * Math.max(0.01, Math.min(1, M.chair * 1.6))); rig.chair.position.set(0, 0, -1.6 * (1 - u)); rig.chair.rotation.y = ch.root.rotation.y + (1 - u) * Math.PI * 1.3; }   // 빙글 돌며 굴러 들어온다
      rig.brows.forEach((b) => { b.visible = browOn > 0; b.rotation.z = b.userData.s * -browAng; b.position.y = rig.eyes[0].c.y + rig.er * (browAng > 0 ? 1.12 : 1.4); });
      rig.blushMat.color.setHex(blushColor); rig.blushMat.opacity = lerp(rig.blushMat.opacity, blush, 1 - Math.pow(0.001, dt));
      M.sh = lerp(M.sh, shades, 1 - Math.pow(0.0005, dt));
      rig.shades.visible = M.sh > 0.02; rig.shades.position.y = rig.mid.y + (1 - M.sh) * 0.7; rig.shades.scale.setScalar(Math.max(0.01, M.sh));
      /* 땀 — 더 크게(11-21 개발자 지시 5차): 머리 옆 큰 땀방울이 흘러내리고 · 양옆으로 작은 땀방울이 튄다 */
      if (sweat) {
        rig.sweat.visible = true; const u = (t * 1.1) % 1;
        rig.sweat.position.y = rig.top * (0.62 - u * 0.5); rig.sweat.scale.setScalar(1.6 * (Math.min(1, u * 5) * (1 - Math.max(0, u - 0.85) / 0.15)) + 0.01);
        if (!REDUCED && Math.floor(t * 7) !== Math.floor((t - dt) * 7)) { emitDrop(-1); emitDrop(1); }
      } else rig.sweat.visible = false;
      drops.forEach((d) => { if (!d.visible) return; const v = d.userData.v; d.userData.life += dt; v.y -= 9 * dt; d.position.addScaledVector(v, dt); { const k = 0.06 * d.userData.s * Math.max(0.001, 1 - d.userData.life / 0.7); d.scale.set(k * 0.8, k * 1.15, k * 0.8); } if (d.userData.life > 0.7) d.visible = false; });
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
