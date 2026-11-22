/* 마스코트 표정·몸짓 연출 (2026-11-21 개발자 지시 — 시안 docs/designs/mockups/mascot-3d/mood.html · 승인 전)

   kit.js 의 무대(Stage)가 매 프레임 정한 자세 위에 '마지막으로 얹는' 층이다(Stage opt.after · opt.beforeTap).
   부르지 않으면 앱 화면은 예전 그대로다. 45개교 캐릭터·대장님이 같은 뼈대(머리·눈·팔·과잠 묶음)를 쓰므로 부품은 한 벌로 모두에 붙는다.

   손짓(학생이 하는 것) → 반응 — 🔴 말풍선은 없다(11-21 개발자 지시 3차) · 몸짓·표정만으로 말한다 · 🔴 눈썹도 없다(5차 "못생겼다")
     · 1초에 4번 넘게 연타   → 화남(약 6초 · 5차 — 실제 동작을 리서치해 다시 짰다):
         ① 과잠 벗기 1.8초 — 어깨를 펴고 턱을 당겨 노려본다 → 두 손으로 앞판을 움켜쥐고 → 확 젖혀 연다(똑딱단추가 위에서 아래로 튄다) →
            어깨 뒤로 흘려 내린다 → 몸을 돌려 한 팔씩 소매에서 뺀다(휙) → 빠진 과잠을 손에 쥐고 머리 옆으로 치켜들었다가 → 바닥에 패대기 → 발을 쾅
            (사람이 실제로 벗는 차례 — 앞섶 열기 → 어깨에서 내리기 → 팔 하나씩 빼기. 화난 사람은 과잠을 보지 않고 상대를 노려본 채 손으로만 벗는다)
            🔴 몸에 입은 과잠은 옮기거나 기울이지 않는다 — 좌우 두 쪽으로 갈라(rig.jk) 몸의 세로축으로만 돌린다(몸을 뚫지 않는다 · 4차까지 일그러진 까닭)
         ② 몽둥이 줍기 0.7초 — 옆으로 기울여 바닥의 몽둥이를 쥐고 → 던질 준비 자세로
         ③ 던지기 1.2초 — 투구 6단계(와인드업 → 내딛기 → 팔 젖히기 → 가속 → 놓기 → 팔로우스루) · 팔은 방향(벡터)으로 겨눈다(rig.aim) ·
            놓는 순간(+0.76초) 화면 전체에 몽둥이가 날아와 유리가 깨진다(ScreenHit) · 디딘 발은 바닥에 붙어 있다
         ④ 허리에 손 · 고개 홱 · 발 동동 → ⑤ 바닥의 과잠을 주워 어깨 뒤로 휙 걸치고 팔을 한쪽씩 넣어 여민다
     · 세게 빙글빙글 돌리기  → 어지러움: 소용돌이 눈 · 머리 위 별 · 비틀
     · 길게 누르기(0.7초)    → 쓰다듬기: 눈 감고 좋아함 · 그 캐릭터의 볼 자리가 분홍 · 하트
     · 아래로 끌어당기기     → 납작하게 찌그러졌다가 튕겨 오름
     · 20초 동안 안 건드림   → 꾸벅꾸벅 졸기(Zzz · 몸 전체로 꾸벅) · 건드리면 깜짝 놀라며 깬다(「!」)
   가리키는 줄(홈 히어로)
     · 수령 가능액 → 네모난 비즈니스 선글라스 · 회장님 의자(높은 등받이 · 다이아몬드 단추 누빔 가죽 · 날개 · 둥글게 말린 팔걸이 · 놋쇠 못 · 크롬 다섯 갈래 바퀴 다리)가
                     옆에서 묵직하게 굴러 들어와 → 폴짝 뛰어 앉아 등을 깊이 기댄다 → 두 발은 좌판 앞에서 발목을 꼰다 → 팔걸이에 얹은 손이 옆으로 무심하게 툭 — 지폐가 위로
     · 마감 D-Day  → 「이럴 수는 없어」 — 몸수색 받는 자세: 두 손을 번쩍 들었다가 뒤통수 뒤로 접어 숨긴다(앞에서 손이 안 보인다) · 팔꿈치를 벌리고 어깨를 으쓱 ·
                     발을 벌리고 번갈아 동동 · 식은땀(머리 옆 물방울이 흘러내린다 — 11-22 개발자 지시로 4판 모양 그대로)
     · 줄을 떠날 때(다른 줄 · 다른 손짓) — 한 프레임에 끊지 않고 0.25초에 푼다: 의자에선 앞으로 폴짝 내려오고 의자는 뒤로 물러났다가 왔던 쪽으로 · 몸수색은 팔을 내리며

   🔴 화남은 손짓에만 반응한다 — 학생의 데이터(마감 놓침·미신청)로 화내지 않는다(혼나는 느낌 금지 · 11-21 제안 그대로).
   🔴 '동작 줄이기'를 켠 폰은 표정만 바꾸고 덤비기·과잠 벗기·흔들림·지폐·발 구르기는 뺀다(REDUCED) — 끝 자세만 보인다. */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, REDUCED, rand, lerp, clamp, mat, sph, cyl, torus, box } = K;
  const D2R = Math.PI / 180;
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const EASE = { lin: (u) => u, in: (u) => u * u, out: (u) => 1 - (1 - u) * (1 - u), io: ease, in3: (u) => u * u * u, out3: (u) => 1 - Math.pow(1 - u, 3) };
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const nlerp = (a, b, u) => { const A = nrm(a), B = nrm(b); return nrm([lerp(A[0], B[0], u), lerp(A[1], B[1], u), lerp(A[2], B[2], u)]); };
  const blendQ = (a, b, u) => a.map((v, k) => lerp(v, b[k], u));
  const crossed = (prev, now, x) => prev < x && now >= x;

  /* 키 장면 표 — [{ t, ease, 칸: 값 }] · 빈 칸은 앞 키의 값을 잇는다 · ease 는 그 키로 들어가는 구간에 쓴다(기본 io)
     값이 숫자면 그대로 · 배열이면 칸마다 · vecs 에 든 칸은 방향(정규화해 섞는다) */
  function track(keys, vecs) {
    const K2 = []; let prev = {};
    keys.forEach((k) => { const o = Object.assign({}, prev); delete o.ease; Object.keys(k).forEach((c) => { o[c] = k[c]; }); K2.push(o); prev = o; });
    return (t) => {
      if (t <= K2[0].t) return K2[0];
      for (let i = 1; i < K2.length; i++) {
        const b = K2[i]; if (t > b.t) continue;
        const a = K2[i - 1], u = (EASE[b.ease] || ease)((t - a.t) / Math.max(1e-6, b.t - a.t)), o = { t };
        Object.keys(b).forEach((c) => {
          if (c === 't' || c === 'ease') return; const A = a[c], B = b[c];
          if (A == null) o[c] = B; else if (typeof B === 'number') o[c] = lerp(A, B, u); else if (vecs && vecs.has(c)) o[c] = nlerp(A, B, u); else o[c] = B.map((v, j) => lerp(A[j], v, u));
        });
        return o;
      }
      return K2[K2.length - 1];
    };
  }

  // ── 글자·그림 스프라이트(캔버스 한 장 → 늘 화면을 보는 판) ──
  function canvasSprite(w, h, draw, scale) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(scale * (w / h), scale, 1); sp.renderOrder = 20; sp.visible = false;
    return sp;
  }
  function texOf(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t; }
  const FONT = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  function glyph(ch, color, px) {
    return (g, w, h) => { g.fillStyle = color; g.font = `900 ${px}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + px * 0.04); };
  }
  function angerMark(g, w) {   // 화남 표시(네 갈래 굽은 선)
    g.strokeStyle = '#e0412f'; g.lineWidth = w * 0.1; g.lineCap = 'round';
    const c = w / 2, d = w * 0.16, L = w * 0.22;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      g.beginPath(); g.moveTo(c + sx * d, c + sy * (d + L)); g.quadraticCurveTo(c + sx * d, c + sy * d, c + sx * (d + L), c + sy * d); g.stroke();
    });
  }
  /* 휙 — 빠른 동작을 덮는 굽은 선(만화의 동작선 · 스미어). 밝은 바탕에서도 보이게 짙은 테 + 흰 속 */
  function swoosh(g, w, h) {
    g.lineCap = 'round';
    [[0.36, 11], [0.55, 8], [0.74, 6]].forEach(([r, lw]) => {
      g.beginPath(); g.arc(w * 0.5, h * 0.92, h * r, Math.PI * 1.1, Math.PI * 1.66);
      g.strokeStyle = 'rgba(34,40,58,.5)'; g.lineWidth = lw + 5; g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = lw; g.stroke();
    });
  }
  function spiralTex() {
    return texOf(128, 128, (g) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#22283a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath();
      for (let a = 0; a < Math.PI * 6; a += 0.08) { const r = 4 + a * 3.0; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; a ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    });
  }
  function billTex() {
    return texOf(128, 64, (g) => {
      g.fillStyle = '#7cc58a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#3f8a52'; g.lineWidth = 6; g.strokeRect(5, 5, 118, 54);
      g.fillStyle = '#2f6e40'; g.beginPath(); g.arc(64, 32, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8f6ea'; g.font = `900 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₩', 64, 33);
    });
  }
  const TEX = {};
  const tex = (k) => TEX[k] || (TEX[k] = k === 'spiral' ? spiralTex() : billTex());

  // 물체의 경계 상자를 기준(ref) 좌표로 — 캐릭터마다 얼굴 크기가 달라 부품 자리를 여기서 잰다
  const _m = new T.Matrix4(), _b = new T.Box3();
  /* 🔴 정점으로 잰다 — 부품의 상자를 돌려 다시 상자로 감싸면 비스듬한 과잠 고리 때문에 몸이 실제보다 25% 넘게 커졌다(허리에 얹은 손이 몸 밖에 떴다 · 11-22 리뷰) */
  const _v3 = new T.Vector3();
  function meshInto(o, inv, out) {
    const p = o.geometry && o.geometry.attributes && o.geometry.attributes.position; if (!p) return;
    _m.multiplyMatrices(inv, o.matrixWorld); const step = Math.max(1, Math.ceil(p.count / 4000));
    for (let i = 0; i < p.count; i += step) out.expandByPoint(_v3.fromBufferAttribute(p, i).applyMatrix4(_m));
  }
  function localBox(obj, ref) {
    obj.updateWorldMatrix(true, true); ref.updateWorldMatrix(true, false);
    const inv = new T.Matrix4().copy(ref.matrixWorld).invert(), out = new T.Box3();
    obj.traverse((o) => { if (o.isMesh) meshInto(o, inv, out); });
    return out;
  }
  /* 자세를 중립(몸 찌그러짐 1 · 고개 0)으로 두고 잰다 — kit 은 줄이 바뀔 때마다 깡충 뛰어 몸을 찌그러뜨리는데, 그 순간에 푼 손 닿기 자세가
     캐릭터마다 저장돼 계속 쓰였다(손이 팔걸이에서 떴다 · 11-22 리뷰) */
  function neutral(ch, fn) {
    const ks = ch.squash.scale.clone(), kh = ch.head.rotation.clone();
    ch.squash.scale.set(1, 1, 1); ch.head.rotation.set(0, 0, 0); ch.root.updateWorldMatrix(true, true);
    try { return fn(); } finally { ch.squash.scale.copy(ks); ch.head.rotation.copy(kh); ch.root.updateWorldMatrix(true, true); }
  }

  /* 회장님 의자(11-21 개발자 지시 5차 — "비싸 보이는 회장님 의자를 리서치해서") — 리서치로 정한 모습:
     · 한국에서 '회장님 의자' 하면 두껍고 묵직한 가죽에 크고 높은 등받이(높은 등받이 = 권위의 상징 · Fritz Hansen Oxford 하이백)
     · 체스터필드 윙백 중역 의자: 다이아몬드 단추 누빔(단추도 가죽) · 머리 높이의 날개 · 둥글게 말린 팔걸이 · 팔걸이 앞면과 날개 가장자리에 놋쇠 못
     · 진짜 고급 의자의 다리는 광낸 알루미늄·크롬 다섯 갈래 + 바퀴(Poltrona Frau · 한샘 로얄 프레스티지) — 금은 못·고리·바퀴 모자에만
     · 앞에서 보이는 곳은 넷뿐이다(머리가 등받이 가운데를 가린다): 머리 위 등받이 꼭대기 · 머리 옆 날개 · 몸 옆 팔걸이 · 좌판 밑 다리 — 공을 거기에 들인다
     · 좌판·팔걸이는 몸통에 맞추고(머리·갈기까지 재면 소파가 된다) 등받이·날개는 머리에 맞춘다 · 빨간 과잠이면 검은 가죽(옥스블러드와 섞인다) */
  function pickLeather(ch) {
    let col = null;
    if (ch.jacket) ch.jacket.traverse((o) => { if (!col && o.isMesh && o.material && o.material.color && o.geometry && o.geometry.type === 'LatheGeometry') col = o.material.color; });
    if (!col) return 0x5a1820;
    const h = {}; col.getHSL(h); const deg = h.h * 360;
    return (deg > 330 || deg < 30) && h.s > 0.35 ? 0x1f1f26 : 0x5a1820;   // 빨간 과잠이면 검정 가죽, 아니면 옥스블러드
  }
  function makeChair(rig) {
    const ch = rig.ch, g = new T.Group();
    const LEA = pickLeather(ch); rig.leatherHex = LEA;
    const phys = (c, r, cc) => new T.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: cc, clearcoatRoughness: 0.3 });
    const hsl = {}; new T.Color(LEA).getHSL(hsl);
    const leather = phys(LEA, 0.45, 0.6);
    const puffM = phys(new T.Color().setHSL(hsl.h, hsl.s, Math.min(0.85, hsl.l * 1.3 + 0.02)).getHex(), 0.32, 0.9);
    const seam = phys(new T.Color().setHSL(hsl.h, hsl.s, hsl.l * 0.5).getHex(), 0.6, 0.2);
    const brass = mat(0xe2b655, 0.3, 0.55); brass.emissive = new T.Color(0x6a4800); brass.emissiveIntensity = 0.5;
    const chrome = mat(0xe6e9ee, 0.18, 0.5); chrome.emissive = new T.Color(0x2a2e36); chrome.emissiveIntensity = 0.6;
    const rubber = mat(0x16161a, 0.55, 0.1);
    const soft = (w, h, d, m, r) => {
      const sh = new T.Shape(), x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      const geo = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: Math.min(0.05, d * 0.3), bevelSize: Math.min(0.05, r * 0.5), bevelSegments: 3, curveSegments: 8 });
      geo.translate(0, 0, -d / 2); return new T.Mesh(geo, m);
    };
    // 1) 몸 재기 — 몸통(머리·팔·발·꼬리 빼고) · 머리(귀·모자 포함)
    const skip = new Set([ch.head].concat(ch.arms || [], rig.legs.map((l) => l.o), ch.tail ? [ch.tail] : [], rig.jk ? [rig.jk.shell] : []));
    ch.root.updateWorldMatrix(true, true);
    const inv = new T.Matrix4().copy(ch.root.matrixWorld).invert(), tb = new T.Box3();
    (function walk(o) { if (skip.has(o)) return; if (o.isMesh && o.geometry && o.visible !== false) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld)); tb.union(_b); } o.children.forEach(walk); })(ch.squash);
    const hb = localBox(ch.head, ch.root);
    if (tb.isEmpty() || !isFinite(tb.min.y)) tb.copy(hb);   // 몸통이 머리와 한 덩어리인 캐릭터(대장님) — 머리 상자로 잰다
    const LEAN = 0.24, S = 0.68, eggBot = tb.min.y, lift = S - eggBot - 0.03;
    rig.seatLift = lift; rig.seatTop = S; rig.lean = LEAN;
    const SM = new T.Matrix4().compose(new T.Vector3(0, lift, -0.14), new T.Quaternion().setFromEuler(new T.Euler(-LEAN, 0, 0)), new T.Vector3(1, 1, 1));
    const bodyHalf = Math.max(0.45, (tb.max.x - tb.min.x) / 2);
    const headHalf = Math.min(1.0, Math.max(bodyHalf, (hb.max.x - hb.min.x) / 2));
    const zl = tb.min.z - 0.03;
    const base = new T.Vector3(0, eggBot, zl).applyMatrix4(SM);
    const Hb = (hb.max.y - eggBot) + 0.42;
    const wBot = bodyHalf * 2 + 0.08, wSh = Math.min(1.9, Math.max(bodyHalf * 2 + 0.16, headHalf * 2 * 0.96));
    // 2) 등받이 — 아치 꼭대기(카멜백) · 위가 넓다 · 몸과 같이 14° 뒤로(몸이 기대면 틈이 없다)
    const hw0 = wBot / 2, hw1 = wSh / 2, yS = Hb * 0.4, yC = Hb - 0.22;
    const bs = new T.Shape();
    bs.moveTo(-hw0, 0); bs.lineTo(hw0, 0); bs.quadraticCurveTo(hw1, yS * 0.45, hw1, yS); bs.lineTo(hw1, yC);
    bs.quadraticCurveTo(hw1, Hb - 0.02, hw1 * 0.5, Hb - 0.03); bs.quadraticCurveTo(0, Hb + 0.07, -hw1 * 0.5, Hb - 0.03);
    bs.quadraticCurveTo(-hw1, Hb - 0.02, -hw1, yC); bs.lineTo(-hw1, yS); bs.quadraticCurveTo(-hw1, yS * 0.45, -hw0, 0);
    const BD = 0.24, BB = 0.08;
    const bgeo = new T.ExtrudeGeometry(bs, { depth: BD, bevelEnabled: true, bevelThickness: BB, bevelSize: 0.07, bevelSegments: 4, curveSegments: 18 });
    bgeo.translate(0, 0, -(BD + BB));
    const backG = new T.Group(); backG.position.copy(base); backG.rotation.x = -LEAN; g.add(backG);
    backG.add(new T.Mesh(bgeo, leather));
    const halfAt = (y) => (y < yS ? lerp(hw0, hw1, Math.sqrt(clamp(y / yS, 0, 1))) : hw1);
    // 다이아몬드 누빔 — 볼록한 칸 + 가죽 단추(금 점은 부스러기처럼 보였다)
    const dx = 0.34, dy = 0.25, puffs = [], buttons = [];
    for (let j = 0, y = 0.3; y < yC + 0.04; j++, y += dy) {
      const off = (j % 2) * dx / 2;
      for (let x = -hw1 - dx + off; x <= hw1 + dx; x += dx) {
        const lim = halfAt(y);
        if (Math.abs(x) <= lim - 0.1 && y < Hb - 0.1) puffs.push([x, y]);
        const bx = x + dx / 2, by = y + dy / 2; if (Math.abs(bx) <= halfAt(by) - 0.12 && by < yC) buttons.push([bx, by]);
      }
    }
    const PG = new T.SphereGeometry(1, 14, 10), D4 = new T.Object3D();
    const pim = new T.InstancedMesh(PG, puffM, Math.max(1, puffs.length));
    puffs.forEach(([x, y], i) => { D4.position.set(x, y, 0); D4.scale.set(dx * 0.6, dy * 0.66, 0.11); D4.updateMatrix(); pim.setMatrixAt(i, D4.matrix); });
    backG.add(pim);
    const bim = new T.InstancedMesh(PG, seam, Math.max(1, buttons.length));
    buttons.forEach(([x, y], i) => { D4.position.set(x, y, 0.05); D4.scale.set(0.036, 0.036, 0.024); D4.updateMatrix(); bim.setMatrixAt(i, D4.matrix); });
    backG.add(bim);
    const NG = new T.SphereGeometry(1, 8, 6);
    const nailMesh = (pts, parent) => { const m = new T.InstancedMesh(NG, brass, Math.max(1, pts.length)); pts.forEach((p, i) => { D4.position.set(p[0], p[1], p[2]); D4.scale.setScalar(0.024); D4.updateMatrix(); m.setMatrixAt(i, D4.matrix); }); parent.add(m); };
    // 3) 날개 — 머리 높이에서 앞·바깥으로 벌어진다(머리보다 밖으로 나와야 앞에서 보인다) · 앞 가장자리에 놋쇠 못
    [-1, 1].forEach((s) => {
      const wh = Hb * 0.52, wd = 0.5;
      const ws = new T.Shape(); ws.moveTo(0, 0); ws.lineTo(wd * 0.45, 0); ws.quadraticCurveTo(wd, wh * 0.28, wd * 0.94, wh * 0.7); ws.quadraticCurveTo(wd * 0.8, wh, 0, wh); ws.lineTo(0, 0);
      const wg = new T.ExtrudeGeometry(ws, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 14 });
      wg.translate(0, 0, -0.05);
      const piv = new T.Group(); piv.position.set(s * (hw1 - 0.04), Hb * 0.4, -0.16); piv.rotation.y = -Math.PI / 2 + s * 0.55; backG.add(piv);
      piv.add(new T.Mesh(wg, leather));
      const pts = []; const qp = (a, b, c, n) => { for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; pts.push([v * v * a[0] + 2 * v * u * b[0] + u * u * c[0] + 0.035, v * v * a[1] + 2 * v * u * b[1] + u * u * c[1], 0]); } };
      qp([wd * 0.45, 0], [wd, wh * 0.28], [wd * 0.94, wh * 0.7], 9); qp([wd * 0.94, wh * 0.7], [wd * 0.8, wh], [wd * 0.2, wh * 0.98], 6);
      nailMesh(pts, piv);
    });
    // 4) 좌판 — 몸통 너비만큼 · 얕게(깊으면 위에서 내려다보는 카메라에 넓적한 벤치가 된다)
    const zFront = new T.Vector3(0, eggBot + 0.2, tb.max.z * 0.8).applyMatrix4(SM).z + 0.04, zRear = base.z - 0.06;
    const seatW = Math.max(bodyHalf * 2 + 0.02, 1.0), sd = zFront - zRear, zm = (zFront + zRear) / 2;
    const cush = soft(seatW, sd, 0.16, leather, 0.1); cush.rotation.x = -Math.PI / 2; cush.position.set(0, S - 0.13, zm); g.add(cush);
    const r = 0.16, armTop = S + 0.42, ax = seatW / 2 + r + 0.03;
    const rail = box(seatW + 4 * r + 0.1, 0.1, sd * 0.96, leather); rail.position.set(0, S - 0.22, zm); g.add(rail);
    const nailsC = [];
    for (let x = -(seatW / 2 + 2 * r); x <= seatW / 2 + 2 * r + 0.001; x += 0.075) nailsC.push([x, S - 0.2, zm + sd * 0.48 + 0.012]);
    // 5) 팔걸이 — 두툼하게 말린 스크롤(앞면이 소용돌이) · 둘레에 놋쇠 못
    [-1, 1].forEach((s) => {
      const len = sd * 0.94;
      const roll = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.05, len - 2 * r), 8, 18), leather); roll.rotation.x = Math.PI / 2; roll.position.set(s * ax, armTop - r, zm); g.add(roll);
      const pnl = box(0.24, armTop - r - (S - 0.27), len * 0.96, leather); pnl.position.set(s * (ax - 0.02), (armTop - r + S - 0.27) / 2, zm); g.add(pnl);
      const fz = zm + len / 2 - 0.02;
      const face = cyl(r * 1.2, r * 1.2, 0.07, leather, 28); face.rotation.x = Math.PI / 2; face.position.set(s * (ax + 0.02), armTop - r, fz); g.add(face);
      const sp = torus(r * 0.6, 0.024, seam); sp.position.set(s * (ax + 0.02), armTop - r, fz + 0.04); g.add(sp);
      const fp = box(0.3, armTop - r - (S - 0.27), 0.07, leather); fp.position.set(s * (ax + 0.02), (armTop - r + S - 0.27) / 2, fz); g.add(fp);
      for (let a = -Math.PI / 2 + 0.6; a <= Math.PI * 1.5 - 0.6; a += 0.27) nailsC.push([s * (ax + 0.02) + Math.cos(a) * r * 1.22, armTop - r + Math.sin(a) * r * 1.22, fz + 0.045]);
      for (let y = S - 0.23; y < armTop - r - r * 1.15; y += 0.075) [-1, 1].forEach((e) => nailsC.push([s * (ax + 0.02) + e * 0.13, y, fz + 0.045]));
    });
    nailMesh(nailsC, g);
    // 6) 다리 — 보이는 크롬 가스 기둥 + 놋쇠 고리 + 다섯 갈래(한 갈래는 뒤로 · 두 갈래는 앞으로 — 앞에서 보면 좌우가 같다) + 바퀴
    const zc = zm - 0.02, colTop = S - 0.27, hubY = 0.14;
    const col = cyl(0.06, 0.065, Math.max(0.1, colTop - hubY), chrome, 18); col.position.set(0, (colTop + hubY) / 2, zc); g.add(col);
    const collar = torus(0.08, 0.025, brass); collar.rotation.x = Math.PI / 2; collar.position.set(0, colTop - 0.03, zc); g.add(collar);
    g.add(sph(0.12, chrome, 0, hubY, zc, 1, 0.6, 1));
    rig.wheels = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 5, Lg = 0.74;
      const leg = box(0.11, 0.06, Lg, chrome); leg.position.set(Math.sin(a) * Lg / 2, hubY - 0.01, zc + Math.cos(a) * Lg / 2); leg.rotation.y = a; g.add(leg);
      g.add(sph(0.04, brass, Math.sin(a) * Lg, hubY + 0.0, zc + Math.cos(a) * Lg));
      const wheel = cyl(0.055, 0.055, 0.08, rubber, 16); wheel.rotation.z = Math.PI / 2; wheel.position.set(Math.sin(a) * Lg, 0.055, zc + Math.cos(a) * Lg); g.add(wheel); rig.wheels.push(wheel);
    }
    g.userData.armY = armTop; g.userData.armX = ax; g.userData.armZ = zm + sd * 0.25;
    g.userData.zFront = zFront; g.userData.back = backG; g.userData.crown = { y: Hb - 0.05, hw: hw1 };
    g.visible = false; return g;
  }

  /* 과잠을 좌우 두 쪽으로 가른다(11-21 개발자 지적 "과잠을 벗는 모션에서 일그러져" — 리서치로 찾은 까닭과 해법)
     몸판은 몸(달걀)에 딱 맞게 돌려 깎은 껍데기라 통째로 옮기거나 기울이면 앞 깃이 가슴에 박히고 밑단이 몸을 뚫었다.
     돌려 깎은 면은 제 세로축으로 돌리면 몸 위에 그대로 있다 — 그래서 왼쪽·오른쪽 반쪽을 만들어 세로축으로만 돌린다(30° = 확 젖혀 엶 · 55° = 어깨 뒤로 흘러내림 — 70° 면 앞에서 남색이 거의 안 보였다).
     부품을 다른 묶음으로 옮겨 붙이지 않는다(옮기면 비틀렸다) — 모양을 그대로 베껴 반쪽 묶음에 새로 만든다. 평소엔 숨겨 두고 원래 과잠을 보인다 */
  function splitJacket(ch) {
    const jk = ch.jacket; if (!jk) return null;
    ch.root.updateWorldMatrix(true, true);
    const inv = new T.Matrix4().copy(jk.matrixWorld).invert();
    const shell = new T.Group(); shell.position.copy(jk.position); shell.quaternion.copy(jk.quaternion); shell.scale.copy(jk.scale);
    const halves = [-1, 1].map((s) => { const g = new T.Group(); g.userData.s = s; shell.add(g); return g; });
    halves[1].scale.set(1.006, 1, 1.006);   // 등에서 겹치는 곳이 깜빡이지 않게 한쪽을 아주 조금 밖으로
    const mats = { body: null, trim: null, letter: null }, snaps = [];
    const meshes = []; jk.traverse((o) => { if (o.isMesh && o.visible !== false) meshes.push(o); });
    meshes.forEach((o) => {
      const t = o.geometry.type;
      if (t === 'LatheGeometry' && !mats.body) mats.body = o.material;
      if (o.material && o.material.map && !mats.letter) mats.letter = o;
      const g0 = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g0.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld)); g0.computeBoundingBox();
      const bb = g0.boundingBox;
      const add = (geo, k) => { const m = new T.Mesh(geo, o.material); m.renderOrder = o.renderOrder; halves[k].add(m); return m; };
      if (bb.min.x > -0.03 || bb.max.x < 0.03) {   // 한쪽에만 있는 작은 부품(단추·글자) — 통째로
        const m = add(g0, (bb.min.x + bb.max.x) / 2 < 0 ? 0 : 1);
        if (t === 'SphereGeometry' && bb.max.x - bb.min.x < 0.2) { snaps.push(m); if (!mats.trim) mats.trim = o.material; }
        return;
      }
      const pos = g0.attributes.position, names = Object.keys(g0.attributes), lists = [[], []];
      for (let i = 0; i < pos.count; i += 3) lists[pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2) < 0 ? 0 : 1].push(i);
      lists.forEach((L, k) => {
        if (!L.length) return; const ng = new T.BufferGeometry();
        names.forEach((n) => { const a = g0.attributes[n], it = a.itemSize, out = new a.array.constructor(L.length * 3 * it);
          L.forEach((i0, j) => { out.set(a.array.subarray(i0 * it, (i0 + 3) * it), j * 3 * it); });
          ng.setAttribute(n, new T.BufferAttribute(out, it, a.normalized)); });
        add(ng, k);
      });
    });
    shell.visible = false; ch.squash.add(shell);
    snaps.sort((a, b) => { a.geometry.computeBoundingBox(); b.geometry.computeBoundingBox(); return b.geometry.boundingBox.max.y - a.geometry.boundingBox.max.y; });
    const jb = localBox(jk, ch.squash);
    return { shell, halves, mats, snaps, h: jb.max.y - jb.min.y, w: jb.max.x - jb.min.x };
  }
  /* 손에 쥔 과잠 · 바닥에 패대기친 과잠 — 벗은 과잠은 '모양을 납작하게 만든 소품'으로 바꿔 쥔다(애니메이션 현장의 방식: 소품을 손에 붙이고 보이기만 바꾼다 ·
     속이 빈 껍데기를 통째로 들면 통처럼 보인다). 그 캐릭터의 과잠 색·소매 색·글자를 그대로 쓴다 */
  function jacketProps(rig, jkInfo) {
    const m = jkInfo.mats, body = m.body || mat(0x223355, 0.85), trim = m.trim || mat(0xffffff, 0.8);
    const limb = rig.limbs.find((l) => l && l.sleeveParts.length), sleeveM = limb ? limb.sleeveParts[0].material : trim;
    const W = clamp(jkInfo.w * 0.5, 0.55, 0.95), H = clamp(jkInfo.h * 0.8, 0.5, 0.8), sr = clamp((limb ? limb.r : 0.14) * 0.85, 0.08, 0.2);
    const panel = () => {   // 어깨가 각진 과잠 앞판 모양
      const s = new T.Shape(); s.moveTo(-W * 0.14, 0); s.lineTo(W * 0.14, 0); s.quadraticCurveTo(W * 0.46, -0.02, W * 0.5, -0.12); s.lineTo(W * 0.46, -H); s.lineTo(-W * 0.46, -H); s.lineTo(-W * 0.5, -0.12); s.quadraticCurveTo(-W * 0.46, -0.02, -W * 0.14, 0);
      const geo = new T.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 6 }); geo.translate(0, 0, -0.035); return new T.Mesh(geo, body);
    };
    const hcap = (len, rad, mtl) => { const c = new T.Mesh(new T.CapsuleGeometry(rad, len, 4, 10), mtl); c.rotation.z = Math.PI / 2; return c; };
    const letterOn = (g, x, y, z, rx) => { if (!m.letter) return; const L = m.letter, sz = (L.geometry.parameters && L.geometry.parameters.width) || 0.3; const p = new T.Mesh(new T.PlaneGeometry(sz * 0.9, sz * 0.9), L.material); p.position.set(x, y, z); p.rotation.x = rx || 0; g.add(p); };
    // 쥔 과잠 — 깃(위 가운데)이 손 자리 · 아래로 늘어진다 · 두 소매가 어깨에서 늘어진다
    const held = new T.Group(); held.add(panel());
    const col = hcap(W * 0.22, 0.04, trim); col.position.set(0, -0.01, 0.03); held.add(col);
    const hem = hcap(W * 0.82, 0.045, body); hem.position.set(0, -H + 0.02, 0.02); held.add(hem);
    const st = hcap(W * 0.82, 0.016, trim); st.position.set(0, -H + 0.05, 0.075); held.add(st);
    [-1, 1].forEach((s) => {
      const sv = new T.Group(); sv.position.set(s * W * 0.46, -0.1, 0); sv.rotation.z = s * 0.22;
      const tube = new T.Mesh(new T.CapsuleGeometry(sr, H * 0.6, 4, 10), sleeveM); tube.position.y = -H * 0.36; sv.add(tube);
      const cf = torus(sr * 0.85, sr * 0.4, body); cf.rotation.x = Math.PI / 2; cf.position.y = -H * 0.36 - H * 0.3 - sr * 0.6; sv.add(cf);
      held.add(sv);
    });
    letterOn(held, W * 0.2, -H * 0.36, 0.08);
    held.visible = false;
    // 바닥의 과잠 — 납작한 덩어리 둘 + 삐져나온 소매 하나 + 카메라 쪽으로 30° 기운 글자
    const pile = new T.Group();
    pile.add(sph(1, body, 0, 0.05, 0, W * 0.5, 0.07, W * 0.34));
    pile.add(sph(1, body, -W * 0.22, 0.1, -0.06, W * 0.3, 0.07, W * 0.24));
    const ps = new T.Group(); ps.position.set(W * 0.42, 0.05, 0.12); ps.rotation.set(0, -0.5, 0);
    const pt = new T.Mesh(new T.CapsuleGeometry(sr * 0.9, H * 0.5, 4, 10), sleeveM); pt.rotation.z = Math.PI / 2; pt.position.x = H * 0.28; ps.add(pt);
    const pc = torus(sr * 0.8, sr * 0.38, body); pc.rotation.y = Math.PI / 2; pc.position.x = H * 0.56; ps.add(pc); pile.add(ps);
    const pcol = hcap(W * 0.3, 0.04, trim); pcol.position.set(-W * 0.06, 0.13, -W * 0.2); pile.add(pcol);
    letterOn(pile, W * 0.12, 0.135, 0.06, -Math.PI / 2 + 0.52);
    pile.visible = false;
    return { held, pile, H, W };
  }

  /* 캐릭터 하나에 부품을 붙인다 — 볼 · 선글라스 · 소용돌이 눈 · 식은땀 · 팔꿈치 · 과잠 반쪽 · 소품 · 몽둥이 (처음엔 숨김) */
  function buildRig(ch) {
    const head = ch.head, hb = localBox(head, head);
    const top = hb.max.y, front = hb.max.z, hw = Math.max(0.3, (hb.max.x - hb.min.x) / 2);
    let eyes = (ch.eyes || []).map((e) => { const b = localBox(e, head); const c = b.getCenter(new T.Vector3()); const sz = b.getSize(new T.Vector3()); return { obj: e, base: e.scale.clone(), c, r: Math.max(0.05, Math.max(sz.x, sz.y) / 2), z: b.max.z }; });
    if (eyes.length < 2) eyes = [-1, 1].map((s) => ({ obj: null, c: new T.Vector3(s * hw * 0.38, hb.min.y + (top - hb.min.y) * 0.55, front - 0.05), r: hw * 0.14, z: front }));
    eyes.sort((a, b) => a.c.x - b.c.x);
    /* 부품 크기는 눈 크기로 재되 머리에 비해 너무 작지 않게 — 점 눈(스누베어 등)이면 선글라스가 눈만 하게 나와 눈처럼 보였다(11-21 시안 실측) */
    const L = eyes[0], R = eyes[eyes.length - 1], er = Math.max((L.r + R.r) / 2, hw * 0.13), ez = Math.max(L.z, R.z);
    const mid = new T.Vector3().addVectors(L.c, R.c).multiplyScalar(0.5), span = Math.max(0.2, R.c.x - L.c.x);
    const rig = { ch, top, front, hw, er, span, mid, eyes: [L, R], poses: {} };

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
    rig.blushMat = blushMat; rig.cheekAt = cheekAt;
    // 선글라스
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
        const temple = box(lh * 0.09, lh * 0.13, hw * 0.9, frameM); temple.position.set(side * (lw / 2 + th * 0.6), lh * 0.32, -hw * 0.42); temple.rotation.y = side * 0.12; one.add(temple);
        one.position.set(x, 0, 0); one.rotation.y = side * 0.16; g.add(one);
      });
      const bridge = box(Math.max(0.03, span - lw), lh * 0.12, lh * 0.1, frameM); bridge.position.set(0, lh * 0.36, lh * 0.06); g.add(bridge);
      g.position.set(mid.x, mid.y, ez + er * 0.35); g.visible = false; head.add(g); rig.shades = g; rig.lensR = lr;
    }
    // 소용돌이 눈(어지러움)
    {
      const m = new T.MeshBasicMaterial({ map: tex('spiral'), transparent: true });
      rig.swirls = [L, R].map((e) => { const p = new T.Mesh(new T.PlaneGeometry(er * 2.6, er * 2.6), m); p.position.set(e.c.x, e.c.y, e.z + 0.02); p.visible = false; head.add(p); return p; });
    }
    /* 식은땀 — 머리 옆 물방울 하나가 흘러내린다(11-22 개발자 지시 "땀을 기존으로" — 4판 모양 그대로 · 5판의 만화식 땀 겹은 뺐다) */
    {
      const d = new T.Group(); d.add(sph(er * 0.55, mat(0x9fd8ff, 0.2), 0, 0, 0, 0.8, 1.1, 0.6)); const tip = new T.Mesh(new T.ConeGeometry(er * 0.42, er * 0.9, 12), mat(0x9fd8ff, 0.2)); tip.position.y = er * 0.75; d.add(tip);
      d.position.set(hw * 0.82, top * 0.45, front * 0.55); d.visible = false; head.add(d); rig.sweat = d;
    }

    /* 팔꿈치 — 팔을 위팔(어깨 묶음)과 아래팔(팔꿈치 묶음)로 나눈다(11-21 개발자 지시 4차 "팔을 굽힌 다음 펴서 던진다").
       원래 팔은 한 덩어리(긴 소매 공 하나 + 소맷단 + 손)라 굽지 않는다 — 소매 공을 위·아래 두 개로 바꿔 끼우고, 팔꿈치 아래 부품(소맷단·손·손가락)을 팔꿈치 묶음으로 옮긴다.
       가만히 있을 때 모양은 예전과 같다(두 공이 이어져 한 소매처럼 보인다).
       🔴 팔 묶음의 '고르지 않은 크기'(길이 0.6 · 굵기 0.72 같은)를 부품 쪽으로 옮겨 굽는다 — 그대로 두면 팔꿈치를 굽힐 때 비틀린 모양(층밀림)이 생긴다 */
    (ch.arms || []).forEach((a) => {
      a.userData.p0 = a.position.clone();
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
      const sleeve = meshes.filter((o) => o !== hand && o.geometry && o.geometry.type === 'SphereGeometry' && o.scale.y > o.scale.x * 1.5).sort((p, q) => q.scale.y - p.scale.y)[0] || null;
      const Ln = Math.max(0.1, -handY);
      const EY = sleeve ? sleeve.position.y : handY * 0.5;          // 팔꿈치 — 소매 한가운데(없으면 팔 중간)
      const elbow = new T.Group(); elbow.position.y = EY; a.add(elbow);
      const sleeveParts = [];
      let r0 = Ln * 0.18;
      if (sleeve) {
        const r = sleeve.scale.x, ry = sleeve.scale.y, tp = sleeve.position.y + ry, bot = sleeve.position.y - ry; r0 = r;
        const up = sph(r, sleeve.material, 0, (tp + EY) / 2, 0, 1, (tp - EY) / 2 / r * 1.18, 1); a.add(up);
        const lo = sph(r * 0.96, sleeve.material, 0, (bot - EY) / 2, 0, 1, (EY - bot) / 2 / (r * 0.96) * 1.18, 1); elbow.add(lo);
        sleeve.visible = false; sleeveParts.push(up, lo);
      }
      meshes.filter((o) => o !== sleeve && o.position.y < EY - Ln * 0.05).forEach((o) => { elbow.attach(o); if (o !== hand && ch.jacket && o.position.y > handY - EY + Ln * 0.1) sleeveParts.push(o); });
      // 맨팔 — 위팔·아래팔(손과 같은 색 · 소매보다 가늘게)
      const skin = hand ? hand.material : mat(0xffffff), br = r0 * 0.5;
      const bu = new T.Mesh(new T.CapsuleGeometry(br, Math.max(0.02, -EY - br), 4, 10), skin); bu.position.y = EY / 2; bu.visible = false; a.add(bu);
      const bl = new T.Mesh(new T.CapsuleGeometry(br * 0.95, Math.max(0.02, EY - handY - br * 2), 4, 10), skin); bl.position.y = (handY - EY) / 2; bl.visible = false; elbow.add(bl);
      // 손 부품(손 · 손가락 공) — 몸수색 자세에서 뒤통수에 가려졌다고 보고 숨긴다 · 팔이 곧 손인 캐릭터(대장님)는 숨기지 않는다
      const handParts = [];
      if (hand && sleeve) { const rr = Math.max(hand.scale.x, hand.scale.y) * 1.9; elbow.children.forEach((o) => { if (o.isMesh && sleeveParts.indexOf(o) < 0 && o !== bl && o.position.distanceTo(hand.position) < rr) handParts.push(o); }); }
      return { arm: a, elbow, hand, L: Ln, EY, r: r0, sleeveParts, bare: [bu, bl], handParts, off: false };
    });
    rig.elbows = rig.limbs.map((l) => (l ? l.elbow : null));
    rig.handLocal = (i) => { const l = rig.limbs[i]; return l && l.hand ? l.hand.position.clone() : new T.Vector3(0, -0.3, 0); };   // 팔꿈치 묶음 안의 손 자리
    rig.handWorld = (i, out) => { const l = rig.limbs[i]; (l ? l.elbow : ch.root).localToWorld(out.copy(rig.handLocal(i))); return out; };
    /* 손 닿기 풀이(IK) — 손을 목표 자리(캐릭터 기준 좌표)에 가장 가깝게 두는 어깨·팔꿈치 각을 찾는다. 캐릭터마다 팔 길이가 달라
       각을 손으로 정하면 어떤 캐릭터는 손이 머리를 뚫고 어떤 캐릭터는 안 닿는다 — 자세마다 한 번 풀어 기억한다(rig.poses).
       q = [어깨 벌림(옆으로 · 0 내림 ~ π 위), 어깨 앞뒤(− 앞 · + 뒤), 팔꿈치 옆 굽힘(+ 바깥), 팔꿈치 앞뒤 굽힘(− 앞 · + 뒤)] */
    const _inv = new T.Matrix4(), _h = new T.Vector3(), _e = new T.Vector3();
    function armHand(i, q) {
      const sl = rig.limbs[i]; const a = sl.arm, el = sl.elbow, sd = a.userData.side;
      a.rotation.set(q[1], 0, sd * q[0]); el.rotation.set(q[3], 0, sd * q[2]);
      ch.root.updateWorldMatrix(true, true); _inv.copy(ch.root.matrixWorld).invert();
      el.localToWorld(_e.set(0, 0, 0)).applyMatrix4(_inv);
      return el.localToWorld(_h.copy(sl.hand ? sl.hand.position : new T.Vector3(0, -0.2, 0))).applyMatrix4(_inv);
    }
    rig.solveArm = (i, target, init, lo, hi, extra) => neutral(ch, () => {
      const sl = rig.limbs[i]; if (!sl) return init.slice();
      const keepA = sl.arm.rotation.clone(), keepE = sl.elbow.rotation.clone();
      const cost = (q) => { const h = armHand(i, q); return h.distanceToSquared(target) + (extra ? extra(h, q, _e) : 0); };
      let q = init.slice(), best = cost(q);
      for (let step = 0.5; step > 0.01; step *= 0.6) {
        for (let it = 0; it < 6; it++) { let moved = false;
          for (let k = 0; k < 4; k++) for (const d of [step, -step]) { const n = q.slice(); n[k] = clamp(n[k] + d, lo[k], hi[k]); const c = cost(n); if (c < best - 1e-6) { best = c; q = n; moved = true; } }
          if (!moved) break; }
      }
      sl.arm.rotation.copy(keepA); sl.elbow.rotation.copy(keepE);
      return q;
    });
    rig.setArm = (i, q, k) => { const sl = rig.limbs[i]; if (!sl || !q) return; const sd = sl.arm.userData.side, w = k == null ? 1 : k;
      sl.arm.rotation.z = lerp(sl.arm.rotation.z, sd * q[0], w); sl.arm.rotation.x = lerp(sl.arm.rotation.x, q[1], w);
      sl.elbow.rotation.z = lerp(sl.elbow.rotation.z, sd * q[2], w); sl.elbow.rotation.x = lerp(sl.elbow.rotation.x, q[3], w); };
    /* 팔을 '방향'으로 겨눈다(던지기 · 11-21 리서치) — 이 뼈대의 rotation.x 는 팔이 수평 아래일 때만 '앞으로 휘두르기'이고 수평 위에선 부호가 뒤집혀
       손이 뒤로 갔다(4차 던지기가 옆으로 퍼덕인 까닭). 위팔 방향 U · 아래팔 방향 F(몸 기준 · x 는 그 팔 쪽이 +)를 주면 어깨 회전과 팔꿈치 굽힘을 바로 만든다 */
    const _X = new T.Vector3(), _Y = new T.Vector3(), _Z = new T.Vector3(), _M4 = new T.Matrix4(), _u = new T.Vector3(), _f = new T.Vector3(), _w = new T.Vector3();
    rig.aim = (i, U, F) => {
      const sl = rig.limbs[i]; if (!sl) return; const sd = sl.arm.userData.side;
      _u.set(U[0] * sd, U[1], U[2]).normalize(); _f.set(F[0] * sd, F[1], F[2]).normalize();
      _w.copy(_f).addScaledVector(_u, -_f.dot(_u));
      if (_w.lengthSq() < 1e-6) { _w.copy(sl.prevW || new T.Vector3(0, 0, -1)); _w.addScaledVector(_u, -_w.dot(_u)); }
      _w.normalize(); sl.prevW = (sl.prevW || new T.Vector3()).copy(_w);
      const beta = Math.acos(clamp(_u.dot(_f), -1, 1));
      _X.crossVectors(_u, _w); _Y.copy(_u).negate(); _Z.copy(_w).negate();
      _M4.makeBasis(_X, _Y, _Z); sl.arm.quaternion.setFromRotationMatrix(_M4);
      sl.elbow.rotation.set(beta, 0, 0);
    };
    // q 자세의 위팔·아래팔 방향(rig.aim 과 같은 눈금) — 각 자세에서 방향 자세로 이어 붙일 때
    rig.dirsOf = (i, q) => {
      const sl = rig.limbs[i]; if (!sl) return { U: [0.3, -1, 0], F: [0.3, -1, 0] }; const sd = sl.arm.userData.side;
      const kA = sl.arm.quaternion.clone(), kE = sl.elbow.quaternion.clone();
      sl.arm.rotation.set(q[1], 0, sd * q[0]); sl.elbow.rotation.set(q[3], 0, sd * q[2]);
      const u = new T.Vector3(0, -1, 0).applyQuaternion(sl.arm.quaternion), f = new T.Vector3(0, -1, 0).applyQuaternion(sl.elbow.quaternion).applyQuaternion(sl.arm.quaternion);
      sl.arm.quaternion.copy(kA); sl.elbow.quaternion.copy(kE);
      return { U: [u.x * sd, u.y, u.z], F: [f.x * sd, f.y, f.z] };
    };
    // 머리 묶음 좌표 → 캐릭터 기준 좌표
    rig.headToRoot = (v) => { const kh = ch.head.rotation.clone(); ch.head.rotation.set(0, 0, 0); ch.root.updateWorldMatrix(true, true); const out = ch.head.localToWorld(v.clone()).applyMatrix4(new T.Matrix4().copy(ch.root.matrixWorld).invert()); ch.head.rotation.copy(kh); return out; };
    /* 다리·발 — 몸 묶음의 바로 아래 자식 중 바닥에 닿은 옆쪽 작은 부품(발 · 다리 막대 · 발가락). 한쪽에 여러 조각이면(부: 다리 막대 + 발)
       그 쪽에서 가장 낮은 조각을 '발'로 삼고 나머지는 발에 대한 자리를 기억한다 — 앉을 때 조각들이 한 점으로 뭉치지 않게(11-22 리뷰) */
    rig.legs = [];
    ch.squash.children.forEach((o) => {
      if (o === ch.head || o === ch.jacket || o === ch.tail || (ch.arms || []).indexOf(o) >= 0) return;
      const b = localBox(o, ch.squash), cc = b.getCenter(new T.Vector3());
      if ((b.max.y < 0.42 || (b.min.y < 0.1 && b.max.y < 0.7)) && Math.abs(cc.x) > 0.06 && b.max.x - b.min.x < 0.7)
        rig.legs.push({ o, x: o.position.x, y: o.position.y, z: o.position.z, s: cc.x < 0 ? -1 : 1, q0: o.quaternion.clone(), s0: o.scale.clone(), minY: b.min.y });
    });
    [-1, 1].forEach((sd) => {
      const side = rig.legs.filter((l) => l.s === sd); if (!side.length) return;
      const foot = side.slice().sort((p, q) => p.minY - q.minY)[0];
      side.forEach((l) => { l.foot = foot; l.d = new T.Vector3(l.x - foot.x, l.y - foot.y, l.z - foot.z); });
    });
    /* 몸통 크기(머리·팔·발 빼고) — 가슴·허리 자리를 정하는 데 쓴다 · 몸통이 머리와 한 덩어리인 캐릭터(대장님)는 머리 상자로 */
    {
      ch.root.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(ch.root.matrixWorld).invert(), bb = new T.Box3(), skip = new Set((ch.arms || []).concat([ch.head], rig.legs.map((l) => l.o), ch.tail ? [ch.tail] : []));
      (function walk(o) { if (skip.has(o)) return; if (o.isMesh && o.visible !== false) meshInto(o, inv, bb); o.children.forEach(walk); })(ch.squash);
      const hb3 = localBox(ch.head, ch.root);
      const fb = bb.isEmpty() || bb.max.y - bb.min.y < 0.3; if (fb) bb.copy(hb3);
      rig.body = { top: fb ? lerp(bb.min.y, bb.max.y, 0.75) : Math.min(bb.max.y, hb3.min.y + (hb3.max.y - hb3.min.y) * 0.25), bot: bb.min.y, front: bb.max.z, w: bb.max.x - bb.min.x };
      rig.body.chest = lerp(rig.body.bot, rig.body.top, 0.72); rig.body.waist = lerp(rig.body.bot, rig.body.top, 0.38);
    }
    // 과잠 반쪽 · 쥔 과잠 · 바닥 과잠
    rig.jk = splitJacket(ch);
    if (rig.jk) { const p = jacketProps(rig, rig.jk); rig.held = p.held; rig.pile = p.pile; rig.propH = p.H; }
    // 소매 벗기·입기 — 🔴 부품을 다른 묶음으로 옮기지 않는다(옮기면 비틀렸다). 소매를 숨기고 맨팔을 보인다
    rig.sleeve = (i, on) => { const sl = rig.limbs[i]; if (!sl || !ch.jacket || !sl.sleeveParts.length) return; if (sl.off === !on) return; sl.sleeveParts.forEach((o) => { o.visible = on; }); sl.bare.forEach((b) => { b.visible = !on; }); sl.off = !on; };
    rig.dress = () => rig.limbs.forEach((sl, i) => rig.sleeve(i, true));
    // 몽둥이 — 바닥(던지는 팔 쪽)에 놓여 있다가 화날 때 줍는다 · 바닥에선 장면(바닥 기준)에 · 쥐면 팔꿈치 묶음(손 자리)에
    {
      const club = new T.Group(), wood = mat(0x9a6634, 0.7), dark = mat(0x5b3a1c, 0.75), tape = mat(0x2b2b33, 0.9);
      const h = cyl(0.045, 0.05, 0.42, tape, 12); h.position.y = 0.21; club.add(h);
      const b = cyl(0.12, 0.06, 0.78, wood, 16); b.position.y = 0.42 + 0.39; club.add(b);
      club.add(sph(0.12, wood, 0, 1.2, 0, 1, 0.5, 1)); club.add(sph(0.06, dark, 0, 0, 0, 1, 0.5, 1));
      [0.6, 0.9, 1.08].forEach((yy) => { club.add(sph(0.025, dark, 0.1, yy, 0.02)); });   // 옹이
      club.visible = false; rig.club = club;
    }
    return rig;
  }

  /* 자세 — 캐릭터마다 한 번 풀어 기억한다(rig.poses) */
  const REST = [0.30, 0, 0, 0], FIST = [0.52, 0, 0, -0.44], SHRUG = [0.61, 0.61, 0, -0.26], RIP = [1.31, 0.17, 0, -0.87], COCK = [2.62, 0, 0, 1.05];
  const LO = [-1.2, -2.8, -2.0, -2.8], HI = [3.0, 1.6, 2.0, 2.0];
  const sideIdx = (ch, s) => (ch.arms || []).findIndex((a) => a.userData.side === s);
  /* 손을 뻗을 때의 몸(앞으로 lean° · 옆으로 tilt° · 내려앉음 dip) — 그 자세에서 바닥의 물건에 손이 닿는 자리를 잰다 */
  function reachFrame(lean, tiltSide, tilt, dip) { const q = new T.Quaternion().setFromEuler(new T.Euler(lean * D2R, 0, -tiltSide * tilt * D2R)); return { q, dip }; }
  function angryPoses(rig) {
    if (rig.poses.angry) return rig.poses.angry;
    const ch = rig.ch, B = rig.body, iT = sideIdx(ch, 1), iO = sideIdx(ch, -1);
    const solveAll = (fn, init, lo, hi, extra) => rig.limbs.map((sl, i) => (sl ? rig.solveArm(i, fn(sl.arm.userData.side, sl), init, lo || LO, hi || HI, extra) : null));
    // 앞판 움켜쥐기 — 깃(턱 밑에 숨어 있다)이 아니라 가슴판 · 어깨 바로 아래 앞
    const grab = solveAll((sd, sl) => new T.Vector3(sd * Math.abs(sl.arm.userData.p0.x) * 0.98, lerp(B.waist, B.top, 0.75), B.front * 0.97 + 0.02), [0.52, -1.05, -0.79, -0.70], [-0.3, -2.4, -2.0, -2.4], [1.6, 0.8, 1.2, 0.6]);
    const hips = solveAll((sd) => new T.Vector3(sd * B.w * 0.5, B.waist, B.front * 0.25), [0.9, 0.2, -1.0, 0], LO, HI,
      (h, q, e) => (Math.abs(e.x) < B.w * 0.62 ? 3 * (B.w * 0.62 - Math.abs(e.x)) * (B.w * 0.62 - Math.abs(e.x)) : 0));   // 팔꿈치는 바깥으로
    /* 바닥에 손 닿기 — 옆으로 24° 기울이고 12° 숙인 몸에서 팔을 늘어뜨린 자리(그 자리에 몽둥이 손잡이를 둔다 · 손이 늘 닿는다) */
    const floorReach = (i, side, lean, tilt, out) => {
      const sl = rig.limbs[i]; if (!sl) return null;
      const F = reachFrame(lean, side, tilt, -0.03), sp = sl.arm.userData.p0.clone().applyQuaternion(F.q); sp.y += F.dip;
      const want = new T.Vector3(sp.x + side * 0.05, 0.07, sp.z + out);     // 어깨 바로 아래 바닥(조금 앞)
      const local = want.clone().sub(new T.Vector3(0, F.dip, 0)).applyQuaternion(F.q.clone().invert());
      // 손이 바닥(0.06) 아래로 들어가면 벌점 — 들어간 손을 나중에 끌어올리면 쥐는 순간 몽둥이가 손으로 튀었다(11-22 리뷰)
      const Fi = F.q.clone(), hw2 = new T.Vector3();
      const q = rig.solveArm(i, local, [0.15, -0.35, 0, -0.1], [-0.4, -1.6, -1.0, -1.6], [1.2, 0.6, 1.0, 0.4], (h) => { const y = hw2.copy(h).applyQuaternion(Fi).y + F.dip; return y < 0.06 ? 40 * (0.06 - y) * (0.06 - y) : 0; });
      // 실제로 닿은 손 자리(바닥 기준) — 손이 덜 닿는 캐릭터는 손잡이가 조금 들린 채 놓인다
      const hw = neutral(ch, () => {
        const keepA = sl.arm.rotation.clone(), keepE = sl.elbow.rotation.clone(), keepR = ch.root.quaternion.clone(), keepP = ch.root.position.clone(), keepS = ch.root.scale.clone();
        ch.root.position.set(0, F.dip, 0); ch.root.quaternion.copy(F.q); ch.root.scale.setScalar(1);
        sl.arm.rotation.set(q[1], 0, sl.arm.userData.side * q[0]); sl.elbow.rotation.set(q[3], 0, sl.arm.userData.side * q[2]);
        ch.root.updateMatrixWorld(true); const parentInv = ch.root.parent ? new T.Matrix4().copy(ch.root.parent.matrixWorld).invert() : new T.Matrix4();
        const out = sl.elbow.localToWorld(rig.handLocal(i)).applyMatrix4(parentInv);
        sl.arm.rotation.copy(keepA); sl.elbow.rotation.copy(keepE); ch.root.position.copy(keepP); ch.root.quaternion.copy(keepR); ch.root.scale.copy(keepS);
        return out;
      });
      return { q, hand: hw, frame: F };
    };
    const reach = iT >= 0 ? floorReach(iT, 1, 12, 24, 0.12) : null;
    const pileReach = iO >= 0 ? floorReach(iO, -1, 10, 24, 0.18) : null;
    const P = { grab, hips, reach, pileReach };
    P.reachD = reach ? rig.dirsOf(iT, reach.q) : null;
    P.balanceT = [0.75, 0, 0, -0.3];
    P.balanceD = iO >= 0 ? rig.dirsOf(iO, P.balanceT) : null;
    P.hipsD = hips.map((q, i) => (q ? rig.dirsOf(i, q) : null));
    /* 바닥의 몽둥이 — 손이 닿는 자리(reach)에 손잡이를 두고, 굵은 쪽은 바닥에 · 바깥·뒤로 눕힌다 · 몸 기준 방향은 쥔 순간 손 안의 방향과 같게
       🔴 여기서 한 번에 정한다 — 바닥 장면을 거치지 않고 줍기 구간에서 시작하면(학교를 바꾼 직후 등) 비어 있어 멈췄다(11-22 리뷰) */
    {
      const g = reach ? reach.hand.clone() : new T.Vector3(0.8, 0.07, 0.3); g.y = Math.max(0.05, g.y);
      const dh = new T.Vector3(0.75, 0, -0.66).normalize(), Lc = 1.2, dy = 0.12 - g.y, hz = Math.sqrt(Math.max(0.01, Lc * Lc - dy * dy));
      const dir = new T.Vector3(dh.x * hz, dy, dh.z * hz).normalize();
      P.clubFloor = { g, dir };
      P.clubFloorBody = reach ? dir.clone().applyQuaternion(reach.frame.q.clone().invert()).toArray() : [0.2, 1, 0];
    }
    rig.poses.angry = P;
    return P;
  }
  /* 팔걸이에 얹은 손 — 의자 팔걸이 끝 · 앉은 자세(들어 올림·뒤로 물러남·뒤로 기댐)를 되돌려 캐릭터 기준 좌표로 · 한 번 푼다 */
  function armrestPose(rig, i) {
    rig.poses.armrest = rig.poses.armrest || [];
    if (rig.poses.armrest[i]) return rig.poses.armrest[i];
    const sl = rig.limbs[i], cd = rig.chair && rig.chair.userData; if (!sl || !cd) return [0.5, -0.3, 0, -0.5];
    const sd = sl.arm.userData.side;
    const seated = new T.Matrix4().compose(new T.Vector3(0, rig.seatLift, -0.14), new T.Quaternion().setFromEuler(new T.Euler(-rig.lean, 0, 0)), new T.Vector3(1, 1, 1));
    const target = new T.Vector3(sd * cd.armX * 0.92, cd.armY + 0.04, cd.armZ).applyMatrix4(seated.invert());
    rig.poses.armrest[i] = rig.solveArm(i, target, [0.5, -0.4, 0, -0.6], [0.0, -1.6, -1.2, -2.0], [1.4, 0.8, 1.2, 0.6]);
    return rig.poses.armrest[i];
  }
  /* 몸수색 자세(11-21 개발자 지시 5차 — "손이 뒤통수에 가려 안 보여야 · 몸수색 받는 죄수처럼") — 리서치:
     경찰의 서서 하는 몸수색은 '두 손을 머리 뒤로 깍지 끼고 발을 벌린 뒤' 시작한다(손은 뒤통수 아래에 붙인다 · 발끝은 바깥으로).
     이 뼈대(팔 0.6 · 머리 반지름 0.7)로는 손이 뒤통수 가운데까지 못 간다 — 손은 '머리 앞 윤곽 안 · 머리 가운데보다 뒤'에만 있으면 되고,
     팔꿈치는 '그 높이의 머리 윤곽 바깥'에만 있으면 된다(팔꿈치를 머리의 가장 넓은 폭 밖으로 끌면 손이 밖으로 끌려 나와 턱 옆에 보였다 — 4차 실측 270번 중 260번).
     어깨를 으쓱(팔 뿌리 +0.12 위 · −0.06 뒤)하면 더 깊이 들어간다 · 그래도 조금 비치는 손은 자세가 70% 넘게 잡히면 숨긴다(실제로도 머리에 가려진다) */
  const SHRUG_D = new T.Vector3(0, 0.12, -0.06);
  function friskPose(rig) {
    if (rig.poses.frisk) return rig.poses.frisk;
    const ch = rig.ch;
    let skull = null; ch.head.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry' && o.position.length() < 0.15 && (!skull || o.scale.x > skull.scale.x)) skull = o; });
    const bx = neutral(ch, () => localBox(skull || ch.head, ch.root));
    const c = bx.getCenter(new T.Vector3()), a = bx.getSize(new T.Vector3()).multiplyScalar(0.5);
    (ch.arms || []).forEach((ar) => { ar.position.copy(ar.userData.p0).add(SHRUG_D); });
    rig.poses.frisk = rig.limbs.map((sl, i) => {
      if (!sl) return null; const s = sl.arm.userData.side, rh = (sl.r || 0.14) * 0.85, re = (sl.r || 0.14);
      const target = new T.Vector3(s * a.x * 0.3, c.y - a.y * 0.35, c.z - a.z * 0.5);
      return rig.solveArm(i, target, [2.2, 0.4, 1.4, 0.8], [1.2, -0.6, -0.4, -0.3], [3.0, 1.5, 2.7, 2.8], (h, q, e) => {
        let k = 0; const u = ((h.x - c.x) / Math.max(0.05, a.x - rh)) ** 2 + ((h.y - c.y) / Math.max(0.05, a.y - rh)) ** 2; if (u > 1) k += 30 * (u - 1);   // 손은 머리 앞 윤곽 안
        if (h.z > c.z - 0.05) k += 10 * (h.z - c.z + 0.05) ** 2;                                                                                          // 머리 가운데보다 뒤
        const wy = a.x * Math.sqrt(Math.max(0, 1 - ((e.y - c.y) / a.y) ** 2)), need = wy + re; if (Math.abs(e.x) < need) k += 6 * (need - Math.abs(e.x)) ** 2;   // 팔꿈치는 그 높이의 윤곽 밖
        if (e.y < c.y - a.y) k += 3 * (c.y - a.y - e.y) ** 2; return k; });
    });
    (ch.arms || []).forEach((ar) => { ar.position.copy(ar.userData.p0); });
    ch.root.updateWorldMatrix(true, true);
    return rig.poses.frisk;
  }

  /* ── 화남 장면 차례(초) — T0 노려봄 · T0~T1 과잠 벗기 · T1~T2 몽둥이 줍기 · T2~T3 던지기 · T3~T4 허리에 손 · T4~END 다시 입기 ── */
  const T0 = 0.15, T1 = T0 + 1.8, T2 = T1 + 0.7, T3 = T2 + 1.2, T4 = T3 + 0.95, END = T4 + 1.15;
  /* 과잠 벗기 1.8초(리서치 키 장면) — q 는 [어깨 벌림, 앞뒤(+뒤), 팔꿈치 옆(+바깥), 팔꿈치 앞뒤(+뒤)] · R = 화면 오른쪽 팔 · L = 왼쪽 팔
     yaw(+ 는 오른쪽 어깨가 뒤로) · lean(+ 앞으로 숙임) · hx(+ 턱을 당김) · hy 고개를 반대로 돌려 얼굴은 늘 화면을 본다 · shell 과잠 반쪽이 열린 각 */
  function jacketKeys(GR, GL) {
    return [
      { t: 0, R: REST, L: REST, yaw: 0, lean: 0, rise: 0, hx: 0, hy: 0, shell: 0, lfx: 0, lfy: 0, rfx: 0 },
      { t: 0.1, R: [0.44, 0.17, 0, 0], L: [0.44, 0.17, 0, 0], lean: -6, rise: 0.03, hx: 8, lfx: -0.06, rfx: 0.03 },      // 어깨를 펴고 가슴을 내밀어 커진다 · 턱을 당겨 노려본다
      { t: 0.22, R: GR, L: GL, lean: 4, rise: 0, hx: 10 },                                                                  // 두 손으로 앞판을 움켜쥔다
      { t: 0.32, ease: 'in', R: RIP, L: RIP, shell: 30, lean: -8, rise: 0.02, hx: 2 },                                      // 확 젖혀 연다(단추가 위에서 아래로 튄다)
      { t: 0.38, ease: 'lin', shell: 33, lean: -8.5, rise: 0.022 },
      { t: 0.5, R: SHRUG, L: SHRUG, shell: 55, lean: -10, rise: 0.01, hx: -6 },                                             // 어깨 뒤로 흘려 내린다
      { t: 0.62, ease: 'in', R: [0.26, 0.79, 0, 0], yaw: -30, hy: 25, lean: -4 },                                           // 몸을 틀어 오른팔을 소매에서 홱
      { t: 0.74, R: [0.17, -0.96, 0, -0.26], yaw: -20, hy: 18 },
      { t: 0.8, R: FIST },
      { t: 0.86, ease: 'in', L: [0.52, 0.26, 0, 0], yaw: 25, hy: -20 },                                                     // 반대로 틀어 왼팔을 빼며 과잠을 낚아챈다
      { t: 1.02, R: [0.79, 0, 0, -0.52], L: [2.53, -0.09, 0, 0], yaw: 10, lean: -8, rise: 0.02, hx: -4, hy: -8, lfy: 0.05 }, // 과잠을 머리 옆으로 치켜든다
      { t: 1.1, L: COCK, lean: -10 },                                                                                         // 머리 뒤로 한 번 젖혔다가
      { t: 1.22, ease: 'in', R: [0.7, 0.35, 0, 0], L: [0.44, -0.52, 0, 0], yaw: 0, lean: 18, rise: -0.03, hx: 10, hy: 0, lfy: 0, lfx: -0.08 }, // 패대기 · 쾅
      { t: 1.27, ease: 'lin', lean: 18.5, rise: -0.04 },   // 18° 넘게 숙이면 큰 머리가 앞으로 쏠려 '꾸벅 인사'로 보였다(시안 실측)
      { t: 1.34, lfy: 0.08, lean: 12, rise: -0.01 },
      { t: 1.42, ease: 'in', R: FIST, L: FIST, lean: 6, rise: 0.02, hx: 6, lfy: 0 },                                      // 발을 한 번 더 쾅 · 씩씩
      { t: 1.8, R: [0.49, 0, 0, -0.44], L: [0.49, 0, 0, -0.44], lean: 0, rise: 0, hx: 6, lfx: -0.07, rfx: 0.07 },
    ];
  }
  /* 대장님(과잠이 없다) — 씩씩대다 '뚜껑이 열린다'(학사모가 튕겨 바닥으로) */
  const CAP_KEYS = [
    { t: 0, R: REST, L: REST, yaw: 0, lean: 0, rise: 0, hx: 0, hy: 0, shell: 0, lfx: 0, lfy: 0, rfx: 0 },
    { t: 0.1, R: [0.44, 0.17, 0, 0], L: [0.44, 0.17, 0, 0], lean: -6, rise: 0.03, hx: 8 },
    { t: 0.22, R: [0.35, -0.6, 0, -0.9], L: [0.35, -0.6, 0, -0.9], lean: 4, rise: 0, hx: 10 },
    { t: 0.32, ease: 'in', R: RIP, L: RIP, lean: -8, rise: 0.06, hx: 2 },
    { t: 0.5, ease: 'lin', lean: -9, rise: 0.05 },
    { t: 0.8, R: FIST, L: FIST, lean: 4, rise: 0, hx: 6 },
    { t: 1.2, lfy: 0.06 }, { t: 1.3, lfy: 0 }, { t: 1.5, lfy: 0.06 }, { t: 1.6, lfy: 0 },
    { t: 1.8, R: [0.49, 0, 0, -0.44], L: [0.49, 0, 0, -0.44], lean: 0, rise: 0, hx: 6, lfx: -0.05, rfx: 0.05 },
  ];
  /* 쥔 과잠이 흔들리는 각(화면 평면 · + 는 바깥으로 · 180 은 손 위로 뒤집힘) · dz 앞뒤 */
  const HELD_KEYS = track([{ t: 0.84, a: 50, dz: 0.05 }, { t: 0.9, a: 56 }, { t: 1.02, a: 35, dz: 0 }, { t: 1.1, ease: 'in', a: 205, dz: -0.38 }, { t: 1.22, ease: 'in', a: 165, dz: -0.05 }, { t: 1.27, ease: 'in', a: 75, dz: 0.15 }]);
  /* 몽둥이 줍기 0.7초 — 옆으로 기울여 손을 바닥에 → 쥐고 → 던질 준비 자세로 */
  const PICK_KEYS = track([{ t: 0, tilt: 0, lean: 0, rise: 0 }, { t: 0.25, tilt: 24, lean: 12, rise: -0.03 }, { t: 0.32, ease: 'lin', tilt: 24.5, lean: 12.5, rise: -0.032 }, { t: 0.7, tilt: 0, lean: 0, rise: 0 }]);
  /* 던지기 1.2초(리서치 키 장면 — 앞에서 보는 카메라로 실제 마스코트를 그려 확인한 값) ·
     U 위팔 · F 아래팔 · C 몽둥이 방향(던지는 팔 기준 · x 는 그 팔 쪽이 +) · GU/GF 반대 팔 · yaw(+ 는 던지는 어깨가 뒤로 · 닫힘) · lean(+ 화면 쪽으로) · tilt(+ 반대 팔 쪽으로)
     lx/ly/lz 앞발 · bx/by/bz 뒷발(기본 캐릭터의 제자리 ±0.25, 0.1, 0.16 기준 — 캐릭터마다 그 차이만 쓴다) · 놓는 순간 +0.76초 */
  const THROW_REL = 0.76;
  const THROW_DEF = { yaw: 0, lean: 0, tilt: 0, py: 0, pz: 0, sq: 1, hk: 0.85, hp: 0, hr: 0, lx: -0.25, ly: 0.1, lz: 0.16, bx: 0.25, by: 0.1, bz: 0.16 };
  const THROW = track([
    Object.assign({}, THROW_DEF, { t: 0.0, U: [0.35, -0.8, 0.45], F: [0.15, 0.6, 0.8], C: [0.25, 1, -0.1], GU: [0.3, -1, 0.1], GF: [0.3, -1, 0.3] }),   // 준비(줍기의 끝 자세)
    { t: 0.1, sq: 0.95, py: -0.02, U: [0.35, -0.85, 0.4], F: [0.2, 0.4, 0.9], C: [0.3, 1, 0.1] },                                                        // 반대로 살짝(2~3장)
    { t: 0.36, yaw: 25, lean: -5, tilt: 8, hr: 6, sq: 1.03, py: 0.03, hk: 0.9, hp: -6, lx: -0.12, ly: 0.42, lz: 0.36, bx: 0.29, bz: 0.04, U: [0.75, 0.45, 0.4], F: [0.4, 0.9, -0.1], C: [0.4, 0.95, -0.25], GU: [0.55, 0.25, 0.8], GF: [0.5, 0.3, 0.8] },   // 와인드업 · 앞발 들기
    { t: 0.42, ease: 'lin', py: 0.035, ly: 0.44, F: [0.4, 0.9, -0.2], lz: 0.38 },                                                                         // 꼭대기에서 잠깐
    { t: 0.56, yaw: 22, lean: -2, tilt: 12, hr: 8, pz: 0.12, py: -0.06, sq: 0.93, hp: 0, lx: -0.14, ly: 0.1, lz: 0.62, U: [0.8, 0.4, 0.45], F: [0.55, 0.8, -0.25], C: [0.55, 0.6, -0.6], GU: [0.55, 0.2, 0.8], GF: [0.45, 0.25, 0.85] },   // 내딛기
    { t: 0.66, yaw: 4, lean: 2, tilt: 14, pz: 0.16, py: -0.05, sq: 0.97, U: [0.8, 0.45, 0.4], F: [0.5, 0.6, -0.6], C: [0.75, 0.1, -0.65], GU: [0.6, 0.0, 0.6], GF: [-0.2, 0.3, 0.9] },   // 팔을 가장 뒤로 젖힘(몽둥이는 머리 밖 2시 방향)
    { t: 0.71, ease: 'in', yaw: -6, lean: 8, tilt: 16, pz: 0.22, py: -0.05, sq: 1.02, U: [0.6, 0.6, 0.5], F: [0.3, 1, 0.1], C: [0.25, 1, -0.35], GU: [0.4, -0.4, 0.5], GF: [-0.4, 0.1, 0.8] },   // 가속 — 팔꿈치가 앞서고 몽둥이는 뒤처진다
    { t: 0.76, ease: 'lin', yaw: -12, lean: 16, tilt: 18, hr: 6, pz: 0.42, py: -0.05, sq: 1.08, hk: 0.7, hp: -4, U: [0.45, 0.6, 0.65], F: [0.3, 0.55, 0.8], C: [0.2, 0.75, 0.65], GU: [0.35, -0.8, 0.3], GF: [-0.5, 0.3, 0.7] },   // 놓는다
    { t: 0.84, ease: 'out', yaw: -22, lean: 20, tilt: 10, pz: 0.44, py: -0.08, sq: 0.95, hp: -8, bx: 0.2, by: 0.25, bz: 0.15, U: [0.15, -0.3, 0.95], F: [-0.35, -0.55, 0.75], GU: [0.5, -0.7, -0.3], GF: [0.3, -0.5, -0.5] },
    { t: 0.98, ease: 'out', yaw: -28, lean: 16, tilt: 6, hr: 3, pz: 0.44, py: -0.06, sq: 0.96, hp: -6, bx: 0.1, by: 0.1, bz: 0.5, U: [-0.1, -0.75, 0.65], F: [-0.85, -0.1, 0.5], GU: [0.45, -0.85, -0.2], GF: [0.3, -0.9, 0.1] },   // 팔이 몸을 가로질러
    { t: 1.2, ease: 'io', yaw: -6, lean: 3, tilt: 0, hr: 0, pz: 0.42, py: 0, sq: 1.0, hk: 0.8, hp: 0, U: [0.3, -1, 0.15], F: [0.25, -1, 0.3], GU: [0.3, -1, 0.1], GF: [0.3, -1, 0.3] },
  ], new Set(['U', 'F', 'C', 'GU', 'GF']));
  const READY = THROW(0), THROW_END = THROW(1.2);
  /* 다시 입기 1.15초 — 바닥 과잠을 줍고(0.3) → 어깨 뒤로 휙 걸치고(0.6) → 왼팔(0.6) · 오른팔(0.72)을 소매에 넣고 → 앞판을 여민다(1.0) */
  function redressKeys(P, iT, iO) {
    const H = P.hips;
    return [
      { t: 0, L: H[iO] || FIST, R: H[iT] || FIST, tilt: 0, lean: 0, rise: 0, yaw: 0, shell: 55 },
      { t: 0.3, L: P.pileReach ? P.pileReach.q : FIST, R: [0.75, 0, 0, -0.3], tilt: 24, lean: 10, rise: -0.03 },
      { t: 0.6, L: COCK, R: FIST, tilt: 0, lean: -6, rise: 0.02, yaw: 20 },
      { t: 0.72, L: SHRUG, R: [0.26, 0.79, 0, 0], yaw: -20 },
      { t: 0.82, R: SHRUG, yaw: 0 },
      { t: 1.0, ease: 'out', L: P.grab[iO] || FIST, R: P.grab[iT] || FIST, shell: 0, lean: 4 },
      { t: 1.05, rise: -0.02, lean: 2 },
      { t: 1.15, L: REST, R: REST, rise: 0, lean: 0 },
    ];
  }

  function Mood(stage, opt) {
    opt = opt || {};
    const c = stage.ctx, btn = c.btn, scene = c.scene;
    const M = { mode: 'idle', t: 0, line: null, dday: false, lastInput: performance.now(), idleMs: opt.idleMs || 20000, sh: 0, squish: 0, squishV: 0, pullY: null, suppress: false, petting: false, amT: 0, dueT: 0, prevT: 0, prevA: 0, prevD: 0 };
    let rig = null;

    // 장면에 두는 것 — 기호 · 김 · 하트 · 지폐 · 휙 · 단추 튐 · 먼지
    /* 말풍선은 없다(11-21 개발자 지시 3차 — "모든 말풍선은 삭제") — 몸짓·표정만으로 말한다 */
    const mark = canvasSprite(128, 128, angerMark, 0.42); scene.add(mark);
    const bang = canvasSprite(128, 128, glyph('!', '#e0412f', 118), 0.5); scene.add(bang);
    const heart = canvasSprite(128, 128, glyph('♥', '#ef5a7a', 120), 0.42); scene.add(heart);
    const zs = [0, 1, 2].map(() => { const z = canvasSprite(128, 128, glyph('Z', '#5c6a8a', 110), 0.3); scene.add(z); return z; });
    const glint = canvasSprite(128, 128, glyph('✦', '#fff6cf', 120), 0.3); scene.add(glint);
    const glint2 = canvasSprite(128, 128, glyph('✦', '#fff2b8', 120), 0.3); scene.add(glint2);
    const stars = [0, 1, 2].map(() => { const z = canvasSprite(128, 128, glyph('★', '#f2b632', 110), 0.26); scene.add(z); return z; });
    const whoosh = canvasSprite(128, 128, swoosh, 0.6); scene.add(whoosh);
    const pops = [0, 1, 2, 3].map(() => { const p = canvasSprite(64, 64, glyph('✦', '#ffffff', 60), 0.13); scene.add(p); return p; });
    const steamMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
    const steam = Array.from({ length: 12 }, () => { const p = sph(0.12, steamMat.clone()); p.visible = false; p.userData = { life: 9 }; scene.add(p); return p; });
    const dustMat = new T.MeshBasicMaterial({ color: 0xcfc6b6, transparent: true, opacity: 0.8, depthWrite: false });
    const dust = Array.from({ length: 6 }, () => { const p = sph(0.1, dustMat.clone()); p.visible = false; p.userData = { life: 9, v: new T.Vector3() }; scene.add(p); return p; });
    const BILL_GEO = new T.PlaneGeometry(0.34, 0.17);
    const billMat = () => new T.MeshStandardMaterial({ map: tex('bill'), side: T.DoubleSide, roughness: 0.8 });
    const bills = Array.from({ length: 28 }, () => { const m = new T.Mesh(BILL_GEO, billMat()); m.visible = false; m.userData = { on: false, v: new T.Vector3(), w: new T.Vector3(), life: 0, ph: 0 }; scene.add(m); return m; });
    // 손에 쥔 지폐 뭉치(부채꼴 셋) — 날아가는 지폐가 어디서 나오는지 보인다
    const fan = new T.Group(); [-1, 0, 1].forEach((k) => { const m = new T.Mesh(BILL_GEO, billMat()); m.rotation.z = k * 0.32 + 0.4; m.position.set(k * 0.03, 0.04, k * 0.004); m.scale.setScalar(0.62); fan.add(m); }); fan.visible = false;

    const W = new T.Vector3(), W2 = new T.Vector3(), Q = new T.Quaternion(), Q2 = new T.Quaternion(), V = new T.Vector3(), E = new T.Euler(), Yax = new T.Vector3(0, 1, 0);
    function headTopWorld(out, up) { rig.ch.head.localToWorld(out.set(0, rig.top + (up || 0), 0)); return out; }
    function emitSteam(side) {
      const p = steam.find((q) => !q.visible); if (!p) return;
      rig.ch.head.localToWorld(W.set(side * rig.hw * 0.75, rig.top * 0.6, 0));
      p.position.copy(W); p.visible = true; p.userData.life = 0; p.userData.v = new T.Vector3(side * rand(0.3, 0.7), rand(1.2, 1.8), rand(-0.1, 0.2)); p.scale.setScalar(rand(0.08, 0.12));
    }
    function emitDust(at, k) {
      for (let n = 0; n < 3; n++) { const p = dust.find((q) => !q.visible); if (!p) return; p.position.copy(at); p.position.x += rand(-0.3, 0.3) * k; p.visible = true; p.userData.life = 0; p.userData.v.set(rand(-0.9, 0.9), rand(0.4, 0.9), rand(-0.2, 0.4)); p.scale.setScalar(0.08 * k); }
    }
    function throwBills(i, n) {
      if (i < 0 || !rig.limbs[i]) return; rig.handWorld(i, W); const sd = rig.limbs[i].arm.userData.side;
      for (let j = 0, k = 0; j < bills.length && k < n; j++) {
        const b = bills[j]; if (b.userData.on) continue; k++;
        b.userData.on = true; b.userData.life = 0; b.visible = true; b.position.copy(W);
        b.userData.v.set(sd * rand(0.6, 1.2), rand(2.4, 3.2), rand(0, 0.4)); b.userData.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); b.userData.ph = rand(0, 6);
        b.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      }
    }
    /* 멈춘 사진의 지폐 — 놓은 뒤 age 초의 자리(공기 저항·떨어지는 속도 한계를 식으로) · 실제 지폐와 같은 꼴 */
    function frozenBills(at, age, side) {
      bills.forEach((b) => { if (b.userData.on) b.visible = false; });
      if (age < 0 || age > 3) return;
      for (let j = 0; j < 3; j++) {
        const b = bills[j], vx = side * (0.7 + 0.25 * j), vy = 2.6 + 0.3 * j, vz = 0.15 + 0.1 * j, as = (vy + 0.7) / 9;
        let y = age < as ? at.y + vy * age - 4.5 * age * age : at.y + vy * as - 4.5 * as * as - 0.7 * (age - as);
        const x = at.x + vx * (1 - Math.exp(-1.2 * age)) / 1.2 + Math.sin(age * 6 + 2 * j) * 0.012, z = at.z + vz * (1 - Math.exp(-1.2 * age)) / 1.2;
        b.userData.on = false; b.userData.fz = M.frame; b.visible = true; b.scale.setScalar(age > 2.6 ? Math.max(0.001, 1 - (age - 2.6) / 0.4) : 1);
        if (y <= 0.02) { y = 0.02; b.rotation.set(-Math.PI / 2, 0, j); } else b.rotation.set((5 - 3 * j) * age, (4 - 2 * j) * age, (-4 + 3 * j) * age);
        b.position.set(x, y, z);
      }
    }
    /* 발을 바닥에 붙인다 — 몸을 돌리고 숙여도 디딘 발은 미끄러지지 않는다(발은 몸 묶음 안이라 그냥 두면 몸을 따라 돈다)
       off(l) → { x, y, z, rx, ry, rz }: 그 발 제자리에서 바닥 기준으로 얼마나 · 몇 도 */
    function plantFeet(ch, off) {
      const rs = ch.root.scale.x || 1, sq = ch.squash.scale;
      Q.setFromEuler(ch.root.rotation).invert();
      rig.legs.forEach((l) => {
        const o = off(l) || {};
        V.set((l.x + (o.x || 0)) * rs - ch.root.position.x, (l.y + (o.y || 0)) * rs + (M.kitY || 0) - ch.root.position.y, (l.z + (o.z || 0)) * rs - ch.root.position.z).divideScalar(rs).applyQuaternion(Q);
        l.o.position.set(V.x / sq.x, V.y / sq.y, V.z / sq.z);
        E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q2.setFromEuler(E);
        l.o.quaternion.copy(Q).multiply(Q2).multiply(l.q0);
      });
    }

    function start(mode) {
      if (REDUCED && (mode === 'squish')) return;
      M.mode = mode; M.t = 0; M.prevT = 0; c.S.busy = true;
      if (mode === 'angry') { M.thrown = false; if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) {} } }
      if (mode === 'startle') { if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} } }
    }
    function stop() { M.mode = 'idle'; M.t = 0; c.S.busy = false; }
    function poke() { M.lastInput = performance.now(); if (M.mode === 'sleep') start('startle'); }

    // ── 손짓 읽기 — kit 의 누르기·돌리기와 같은 손가락을 같이 본다 ──
    const taps = []; let down = null;
    btn.addEventListener('pointerdown', (e) => {
      /* 다른 손가락이 이미 누르고 있으면 그 손짓을 먼저 끝낸다(안 끝내면 쓰다듬기·찌그러짐이 영영 안 풀렸다 · 11-22 리뷰) */
      if (down) { if (down.long) { M.petting = false; M.petEnd = performance.now(); } if (down.pull) M.pullY = null; clearTimeout(M.longT); down = null; }
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

    function dropRig() {
      if (!rig) return;
      [rig.chair, rig.held, rig.pile, rig.club, fan].forEach((o) => { if (o && o.parent) o.parent.remove(o); });
    }

    // ── 매 프레임 — kit 이 정한 자세 위에 얹는다 ──
    function after(dt, cx) {
      const ch = cx.ch; if (!ch) return;
      if (!rig || rig.ch !== ch) {
        dropRig(); neutral(ch, () => { rig = buildRig(ch); rig.chair = makeChair(rig); }); scene.add(rig.chair);
        if (rig.held) { scene.add(rig.held); scene.add(rig.pile); }
        scene.add(rig.club); M.amT = 0; M.dueT = 0;
      }
      const FZ = M.freeze;   // 시안 사진용 — 한 순간에 멈춘다(그 순간의 자세를 시간만으로 다시 그린다)
      M.t += dt; if (FZ != null) M.t = FZ;
      const S = cx.S, t = M.t, now = performance.now(), k = ch.root.scale.x || 1;
      M.kitY = ch.root.position.y; M.frame = (M.frame || 0) + 1;   // kit 이 정한 깡충 높이 — 바닥에 붙인 발도 이만큼은 같이 뜬다(몸만 떠서 발과 떨어졌다 · 11-22 리뷰)
      if (M.mode === 'idle' && now - M.lastInput > M.idleMs && !S.drag) start('sleep');

      // 기본값으로 되돌림(kit 이 손대지 않는 칸)
      ch.root.rotation.order = 'XYZ';
      ch.root.position.x = 0; ch.root.position.z = 0; ch.root.rotation.z = 0; ch.root.rotation.x = 0;
      ch.arms.forEach((a) => { a.rotation.x = 0; a.rotation.y = 0; if (a.userData.p0) a.position.copy(a.userData.p0); });
      rig.elbows.forEach((e) => { if (e) e.rotation.set(0, 0, 0); });
      rig.limbs.forEach((sl) => { if (sl) sl.handParts.forEach((o) => { o.visible = true; }); });
      rig.legs.forEach((l) => { l.o.position.set(l.x, l.y, l.z); l.o.quaternion.copy(l.q0); l.o.scale.copy(l.s0); });
      if (ch.jacket) { ch.jacket.visible = true; ch.jacket.position.set(0, 0, 0); ch.jacket.rotation.set(0, 0, 0); ch.jacket.scale.set(1, 1, 1); }
      if (rig.jk) { rig.jk.shell.visible = false; rig.jk.halves.forEach((h) => { h.rotation.y = 0; }); rig.held.visible = false; rig.pile.visible = false; }
      rig.swirls.forEach((s) => { s.visible = false; });
      rig.eyes.forEach((e) => { if (e.obj) { e.obj.visible = true; e.obj.scale.x = e.base.x; e.obj.scale.z = e.base.z; } });   // 🔴 캐릭터 본래 눈 크기로(1 로 두면 눈을 키워 만든 캐릭터의 눈이 좁아졌다 · 11-22 리뷰)
      if (M.mode !== 'angry') { rig.club.visible = false; rig.dress(); if (ch.cap) { ch.cap.position.x = 0; ch.cap.position.z = 0; ch.cap.rotation.x = 0; ch.cap.rotation.z = 0; } }   // kit 은 학사모의 높이·돌기만 정한다 — 화남이 중간에 끊겨도 제자리로
      let chairOn = 0, blush = 0, blushColor = 0xff5a4a, shades = 0, sweat = false;
      mark.visible = false; bang.visible = false; glint.visible = false; glint2.visible = false; whoosh.visible = false; pops.forEach((p) => { p.visible = false; });
      heart.visible = heart.visible && heart.userData.t < 1.2; fan.visible = false;
      zs.forEach((z) => { z.visible = false; }); stars.forEach((z) => { z.visible = false; });

      const P = S.point;
      const pointSide = P ? (P.x < 0 ? -1 : 1) : 0;
      const iT = sideIdx(ch, 1), iO = sideIdx(ch, -1);
      const showWhoosh = (i, u, rot) => {
        if (i < 0 || !rig.limbs[i]) return; const sl = rig.limbs[i];
        sl.elbow.getWorldPosition(W); whoosh.visible = true; whoosh.position.copy(W); whoosh.position.z += 0.2 * k;
        whoosh.material.opacity = Math.sin(Math.PI * clamp(u, 0, 1)); whoosh.material.rotation = rot == null ? sl.arm.userData.side * 0.9 : rot; whoosh.scale.setScalar(0.62 * k);
      };
      /* 줄 연출을 떠날 때 — 한 프레임에 툭 끊지 않는다(11-22 리뷰): 의자에선 앞으로 폴짝 내려오고(0.25초) 의자는 뒤로 물러났다가 왔던 쪽으로 나간다 ·
         몸수색은 0.25초에 풀린다 · 다른 손짓 연출이 시작돼도 같은 길로 · '동작 줄이기'면 한 번에 끝 */
      const amountOn = M.mode === 'idle' && M.line === 'amount' && !!P;
      const dueOn = M.mode === 'idle' && M.line === 'due' && M.dday && !!P;
      if (!amountOn && M.amT > 0) { if (REDUCED) { M.lastC = null; rig.chair.visible = false; M.exA = null; } else { M.exA = M.amT; M.exT = 0; M.outT = 0; } M.amT = 0; }
      if (amountOn) M.exA = null;
      if (M.exA != null) {
        M.exT += dt; const u = clamp(M.exT / 0.25, 0, 1), arc = Math.sin(Math.PI * u);
        seated(ch, cx, M.exA, k, -(M.sideX || 1), 1 - ease(u), 0);
        ch.root.position.y += arc * Math.max(0.25, (rig.seatLift || 0) * 0.55) * k;   // 좌판보다 높이 뛰어 내려온다
        ch.root.position.z += arc * 0.22 * k;                                         // 앞으로 — 뒤로 물러나는 의자와 겹치지 않게
        if (u >= 1) M.exA = null;
      }
      if (!dueOn && M.dueT > 0) { if (!REDUCED) { M.dueA = M.dueT; M.duX = 0; } M.dueT = 0; }
      if (dueOn) M.dueA = null;
      if (M.dueA != null) { M.duX += dt; const u = clamp(M.duX / 0.25, 0, 1); frisk(ch, cx, M.dueA, k, t, dt, 1 - ease(u)); if (u >= 1) M.dueA = null; }

      if (M.mode === 'angry') {
        blush = 0.6; mark.visible = t < T4;
        headTopWorld(W, 0.05); mark.position.set(W.x + 0.42 * k, W.y + 0.05, W.z); mark.scale.setScalar(0.42 * (REDUCED ? 1 : 1 + Math.sin(t * 14) * 0.08));
        if (!REDUCED && t < T4 && Math.floor(t * 8) !== Math.floor(M.prevT * 8)) { emitSteam(-1); emitSteam(1); }
        if (REDUCED) { if (t > 2.2) stop(); }
        else angry(ch, cx, t, k, iT, iO, showWhoosh);
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
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(e.base.x * 1.25, 1.35, e.base.z); });
        if (!REDUCED) ch.root.position.y += 0.7 * 4 * u * (1 - u);
        ch.arms.forEach((a) => { a.rotation.z = a.userData.side * 2.5; });
        headTopWorld(W, 0.35); bang.visible = true; bang.position.copy(W); bang.scale.setScalar(0.5 * (1 + 0.2 * Math.sin(t * 20)));
        if (u >= 1) { rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(e.base.x, 1, e.base.z); }); stop(); }
      } else {
        // 가리키는 줄에 따른 연출 — 손짓 연출이 없을 때만
        if (amountOn) {
          shades = 1; chairOn = 1;
          M.amT = REDUCED ? 3.2 : FZ != null ? FZ : M.amT + dt;
          M.sideX = -pointSide || 1;
          seated(ch, cx, M.amT, k, pointSide, 1, dt);
        }
        if (dueOn && M.exA == null) {   // 의자에서 다 내려온 뒤에 시작한다(내려오는 중에 겹치면 기댄 자세·꼰 발이 한 프레임에 사라졌다)
          sweat = true;
          M.dueT = REDUCED ? 2.0 : FZ != null ? FZ : M.dueT + dt;
          frisk(ch, cx, M.dueT, k, t, dt, 1);
        }
      }

      // 의자 — 옆(빈손 쪽)에서 뒤로 돌아 묵직하게 굴러 들어온다 → 엉덩이 밑으로 굴러와 앉힌다 → 나갈 땐 왔던 쪽으로
      {
        const A = M.amT || 0, sx = M.sideX || 1, chair = rig.chair, la = M.landA != null ? A - M.landA : -1;
        if (chairOn) {
          const u = seg(A, 0.12, 0.95), p = 1 - Math.pow(1 - u, 3);
          let cxp = sx * 3.6 * (1 - p);
          const s2 = A - 0.95; if (s2 > 0 && s2 < 0.7) cxp += -sx * 0.05 * Math.sin(s2 * Math.PI / 0.3) * Math.exp(-s2 * 6);   // 한 번 살짝 지나쳤다 돌아온다
          const cz = lerp(-1.5, 0, ease(seg(A, 1.1, 1.36)));
          const sinkC = la > 0 ? Math.exp(-la * 9) * Math.sin(la * 22) * 0.025 : 0;   // 가스 실린더가 출렁
          chair.visible = A > 0.12; chair.scale.setScalar(k);
          chair.position.set(cxp * k, -sinkC * k, cz * k);
          chair.rotation.order = 'YXZ'; chair.rotation.y = A >= 1.1 ? (M.seatYaw || 0) * ease(seg(A, 1.1, M.landA || 1.4)) : 0;   // 앉기 전에 미리 돌려 둔다(앉는 순간 10° 홱 돌았다)
          chair.rotation.z = u > 0 && u < 1 ? -sx * 0.035 * (1 - p) : 0;
          if (rig.wheels) rig.wheels.forEach((w) => { w.rotation.x = cxp / 0.055; });
          M.lastC = { x: cxp, z: cz, yaw: chair.rotation.y }; M.outT = 0;
          // 도착하면 놋쇠 못을 따라 반짝 하고 지나간다
          if (A > 0.95 && A < 1.2 && !REDUCED) { const g = seg(A, 0.95, 1.2), cr = chair.userData.crown, bk = chair.userData.back; bk.localToWorld(W.set(lerp(-cr.hw, cr.hw, g), cr.y, 0.12)); glint2.visible = true; glint2.position.copy(W); glint2.scale.setScalar(0.3 * k * Math.sin(Math.PI * g)); glint2.material.rotation = g * 4; }
        } else if (M.lastC) {
          /* 들어올 때를 거꾸로 — 먼저 뒤로 굴러 물러나고(0.2초 · 내려오는 몸과 겹치지 않게) 그다음 왔던 쪽으로 미끄러져 나간다 */
          M.outT = (M.outT || 0) + dt; const zb = ease(seg(M.outT, 0, 0.2)), u = clamp((M.outT - 0.15) / 0.5, 0, 1);
          chair.position.set((M.lastC.x + sx * 3.6 * u * u * u) * k, 0, lerp(M.lastC.z, -1.5, zb) * k); chair.rotation.y = M.lastC.yaw * (1 - zb);
          if (rig.wheels) rig.wheels.forEach((w) => { w.rotation.x = (M.lastC.x + sx * 3.6 * u * u * u) / 0.055; });
          if (u >= 1) { chair.visible = false; M.lastC = null; }
        } else chair.visible = false;
        // 등받이도 몸과 같이 기운다(앉을 때 한 번 튕겼다가 · 지폐를 튕길 때 조금 더 뒤로)
        if (chair.visible) chair.userData.back.rotation.x = -(rig.lean + (M.backRock || 0));
        M.chair = chair.visible ? 1 : 0;
      }

      // 부품 그리기
      if (blush > 0) rig.blushMat.color.setHex(blushColor); rig.blushMat.opacity = lerp(rig.blushMat.opacity, blush, 1 - Math.pow(0.001, dt));
      M.sh = lerp(M.sh, shades, 1 - Math.pow(0.0005, dt));
      rig.shades.visible = M.sh > 0.02; rig.shades.position.y = rig.mid.y + (1 - M.sh) * 0.7; rig.shades.scale.setScalar(Math.max(0.01, M.sh));
      if (!sweat) rig.sweat.visible = false;
      if (shades && M.mode === 'idle' && M.sh > 0.85) rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = false; });   // 선글라스가 눈을 덮은 뒤에(눈 없는 얼굴이 잠깐 보였다)

      // 김 · 먼지 · 하트 · 지폐
      steam.forEach((p) => { if (!p.visible) return; const d = p.userData; d.life += dt; p.position.addScaledVector(d.v, dt); p.scale.multiplyScalar(1 + dt * 1.6); p.material.opacity = Math.max(0, 0.85 - d.life * 1.3); if (d.life > 0.65) p.visible = false; });
      dust.forEach((p) => { if (!p.visible) return; const d = p.userData; d.life += dt; d.v.multiplyScalar(1 - dt * 3); p.position.addScaledVector(d.v, dt); p.scale.multiplyScalar(1 + dt * 2.2); p.material.opacity = Math.max(0, 0.75 - d.life * 1.4); if (d.life > 0.55) p.visible = false; });
      if (heart.visible) { heart.userData.t += dt; headTopWorld(W, 0.15 + heart.userData.t * 0.5); heart.position.copy(W); heart.material.opacity = Math.max(0, 1 - heart.userData.t / 1.2); heart.scale.setScalar(0.3 + Math.min(1, heart.userData.t * 4) * 0.15); }
      if (FZ != null) bills.forEach((b) => { if (b.userData.on || b.userData.fz !== M.frame) b.visible = false; });   // 멈춘 사진엔 이번 프레임에 그린 것만
      else bills.forEach((b) => {
        const d = b.userData; if (!d.on) { b.visible = false; return; } d.life += dt;
        d.v.y -= (d.v.y > -0.7 ? 9 : 0) * dt; d.v.x *= 1 - dt * 1.2; d.v.z *= 1 - dt * 1.2;
        b.position.addScaledVector(d.v, dt); b.position.x += Math.sin(d.life * 6 + d.ph) * 0.012;
        b.rotation.x += d.w.x * dt; b.rotation.y += d.w.y * dt; b.rotation.z += d.w.z * dt;
        if (b.position.y < 0.02) { b.position.y = 0.02; d.v.set(0, 0, 0); d.w.set(0, 0, 0); b.rotation.x = -Math.PI / 2; }
        if (d.life > 2.6) b.scale.setScalar(Math.max(0.001, 1 - (d.life - 2.6) / 0.4));
        if (d.life > 3.0) { d.on = false; b.visible = false; b.scale.setScalar(1); }
      });
      M.prevT = t; M.prevA = M.amT; M.prevD = M.dueT;
      c.S.busy = M.mode !== 'idle' || bills.some((b) => b.userData.on) || M.sh > 0.02 || steam.some((p) => p.visible) || dust.some((p) => p.visible) || heart.visible || (M.line === 'due' && M.dday && !!P) || (M.line === 'amount' && !!P) || M.chair > 0.02;
    }

    /* ── 화남 — 과잠 벗기 → 몽둥이 줍기 → 던지기 → 허리에 손 → 다시 입기 ── */
    function angry(ch, cx, t, k, iT, iO, showWhoosh) {
      const S = cx.S, P0 = angryPoses(rig);
      const wIn = ease(seg(t, 0, 0.12)), wOut = 1 - ease(seg(t, END - 0.15, END)), w = wIn * wOut;
      ch.root.rotation.y -= S.py * w;                 // 가리키느라 돌린 몸은 되돌린다 — 화면을 정면으로 노려본다
      const kitHy = ch.head.rotation.y;
      if (!rig.tracks) rig.tracks = {};
      const tr = rig.tracks;
      if (!tr.J) tr.J = track(rig.jk ? jacketKeys(P0.grab[iT] || FIST, P0.grab[iO] || FIST) : CAP_KEYS);
      if (!tr.R) tr.R = track(redressKeys(P0, iT, iO));
      const prev = M.prevT;
      let feet = () => null;
      const jkOn = !!rig.jk;
      /* 과잠·소매 상태는 시각만으로 정한다(멈춘 사진·되감기에서도 같게) — 입은 반쪽은 벗기 시작(0)~왼팔이 빠질 때(0.84)와 다시 입을 때(T4+0.6~)만 ·
         오른 소매는 0.6 에 빠져 T4+0.72 에 다시 · 왼 소매는 0.84 에 빠져 T4+0.6 에 다시 */
      if (jkOn) {
        const a = t - T0, b = t - T4;
        ch.jacket.visible = false;
        rig.jk.shell.visible = a < 0.84 || b >= 0.6;
        rig.sleeve(iT, !(a >= 0.6 && b < 0.72)); rig.sleeve(iO, !(a >= 0.84 && b < 0.6));
      }
      rig.club.visible = t < T2 + THROW_REL;
      const clubInHand = t >= T1 + 0.25 && t < T2 + THROW_REL;
      if (!clubInHand) placeClubOnFloor(ch, k);
      rig.club.scale.setScalar(clubInHand ? 1 : k);

      if (t < T1) {
        // ── ① 과잠 벗기 ──
        const tj = t - T0, J = tr.J(tj);
        rig.setArm(iT, J.R, w); rig.setArm(iO, J.L, w);
        ch.root.rotation.y += J.yaw * D2R * w; ch.root.rotation.x = J.lean * D2R * w; ch.root.position.y += J.rise * w;
        ch.head.rotation.x += J.hx * D2R * w; ch.head.rotation.y = lerp(kitHy, J.hy * D2R, w);
        feet = (l) => (l.s < 0 ? { x: J.lfx, y: J.lfy } : { x: J.rfx });
        if (jkOn) {
          rig.jk.halves.forEach((h) => { h.rotation.y = h.userData.s * J.shell * D2R; });
          if (tj >= 0.58 && tj < 0.66) showWhoosh(iT, seg(tj, 0.58, 0.66));
          if (tj >= 0.82 && tj < 0.9) showWhoosh(iO, seg(tj, 0.82, 0.9));
          // 똑딱단추가 위에서 아래로 튄다(0.26 · 0.28 · 0.30 · 0.32)
          rig.jk.snaps.slice(0, 4).forEach((m, n) => { const pt = 0.26 + n * 0.02, p = pops[n]; if (tj >= pt && tj < pt + 0.08) { m.updateWorldMatrix(true, false); m.geometry.computeBoundingBox(); m.geometry.boundingBox.getCenter(W).applyMatrix4(m.matrixWorld); p.visible = true; p.position.copy(W); p.position.z += 0.08 * k; p.scale.setScalar(0.16 * k * Math.sin(Math.PI * seg(tj, pt, pt + 0.08))); p.material.rotation = n; } });
          // 쥔 과잠 → 바닥 과잠
          if (tj >= 0.84 && tj < 1.27) {
            const Hd = HELD_KEYS(tj), sd = iO >= 0 ? rig.limbs[iO].arm.userData.side : -1;
            rig.handWorld(iO, W); rig.held.visible = true; rig.held.position.set(W.x, W.y, W.z + Hd.dz * k);
            rig.held.rotation.set(0, 0, sd * (Hd.a + Math.sin(tj * 26) * 4) * D2R); rig.held.scale.setScalar(k);
          } else if (tj >= 1.27) showPile(k, tj - 1.27);
          if (crossed(prev - T0, tj, 1.27)) emitDust(W.set(-0.85 * k, 0.05, 0.35 * k), k);
          if (crossed(prev - T0, tj, 1.42)) { for (let n = 0; n < 3; n++) { emitSteam(-1); emitSteam(1); } }
        } else if (ch.cap) {   // 대장님 — 씩씩대다 학사모가 튕겨 바닥으로
          const u = ease(seg(tj, 0.32, 0.95));
          if (tj >= 0.95) capOnFloor();
          else { ch.cap.position.set(-0.95 * u, 0.7 + Math.sin(u * Math.PI) * 0.7 - u * 1.42, 0); ch.cap.rotation.set(0, ch.cap.rotation.y, (Math.PI * 2 + 0.12) * u); }   // 한 바퀴 돌아 납작하게 떨어진다
        }
      } else if (t < T2) {
        // ── ② 몽둥이 줍기 — 옆으로 기울여 손을 바닥에 · 쥐고 · 던질 준비 자세로 ──
        const tc = t - T1, C = PICK_KEYS(tc);
        ch.root.rotation.z = -C.tilt * D2R; ch.root.rotation.x = C.lean * D2R; ch.root.position.y += C.rise;
        ch.head.rotation.x += 6 * D2R * (1 - ease(seg(tc, 0.5, 0.7))); ch.head.rotation.y = 0; ch.head.rotation.z += C.tilt * D2R * 0.5;   // 얼굴은 화면을 본다 · 턱 당김은 던지기 전에 푼다(단계가 바뀔 때 고개가 툭 튀지 않게)
        if (tc < 0.32) {
          const u = ease(seg(tc, 0, 0.25));
          rig.setArm(iT, blendQ([0.49, 0, 0, -0.44], P0.reach ? P0.reach.q : FIST, u)); rig.setArm(iO, blendQ([0.49, 0, 0, -0.44], P0.balanceT, u));
        } else {
          const u = ease(seg(tc, 0.32, 0.7));
          if (P0.reachD) rig.aim(iT, nlerp(P0.reachD.U, READY.U, u), nlerp(P0.reachD.F, READY.F, u));
          if (P0.balanceD) rig.aim(iO, nlerp(P0.balanceD.U, READY.GU, u), nlerp(P0.balanceD.F, READY.GF, u));
        }
        const fw = 1 - ease(seg(tc, 0.3, 0.7));
        feet = (l) => ({ x: (l.s < 0 ? -0.07 : 0.07 + 0.04 * ease(seg(tc, 0, 0.25))) * fw });
        if (clubInHand) holdClub(iT, tc < 0.32 ? P0.clubFloorBody : nlerp(P0.clubFloorBody, mirS(READY.C), ease(seg(tc, 0.32, 0.7))));
        if (jkOn) showPile(k, 9);
        if (ch.cap) capOnFloor();
      } else if (t < T3) {
        // ── ③ 던지기 — 투구 6단계 · 디딘 발은 바닥에 붙어 있다 ──
        const tt = t - T2, Pp = THROW(tt), s = 1;
        ch.root.rotation.x = Pp.lean * D2R; ch.root.rotation.y += s * Pp.yaw * D2R; ch.root.rotation.z = s * Pp.tilt * D2R;
        ch.root.position.y += Pp.py * k; ch.root.position.z = Pp.pz * k;
        const sq = Pp.sq, sx = 1 / Math.sqrt(sq); ch.squash.scale.set(ch.squash.scale.x * sx, ch.squash.scale.y * sq, ch.squash.scale.z * sx);
        ch.head.rotation.x += Pp.hp * D2R; ch.head.rotation.y = -s * Pp.yaw * D2R * Pp.hk; ch.head.rotation.z += s * Pp.hr * D2R;
        rig.aim(iT, Pp.U, Pp.F); rig.aim(iO, Pp.GU, Pp.GF);
        feet = (l) => (l.s === -s ? { x: s * (Pp.lx + 0.25), y: Pp.ly - 0.1, z: Pp.lz - 0.16 } : { x: s * (Pp.bx - 0.25), y: Pp.by - 0.1, z: Pp.bz - 0.16 });
        if (clubInHand) {
          holdClub(iT, mirS(Pp.C));
          if (tt >= 0.69) rig.club.scale.set(1, 1.25, 1);                  // 가속 구간 — 몽둥이가 길게 번진다(스미어)
          if (tt >= 0.69) showWhoosh(iT, seg(tt, 0.69, 0.8), -0.7);
        } else if (tt < 0.84) showWhoosh(iT, seg(tt, 0.69, 0.84), -0.7);
        if (tt >= THROW_REL && !M.thrown && M.freeze == null) {
          M.thrown = true;
          rig.handWorld(iT, W); W.project(cx.cam);
          const r = cx.btn.getBoundingClientRect();
          if (opt.onThrow) opt.onThrow({ x: r.left + (W.x + 1) / 2 * r.width, y: r.top + (1 - W.y) / 2 * r.height });
        }
        if (jkOn) showPile(k, 9);
        if (ch.cap) capOnFloor();
      } else if (t < T4) {
        // ── ④ 허리에 손 · 고개 홱 · 발 동동 ──
        const th = t - T3, u = ease(seg(th, 0, 0.3)), hopB = Math.sin(Math.PI * seg(th, 0, 0.3)) * 0.1;
        ch.root.position.z = lerp(THROW_END.pz, 0, u) * k; ch.root.position.y += hopB * k;   // 폴짝 제자리로
        ch.root.rotation.y += THROW_END.yaw * D2R * (1 - u); ch.root.rotation.x = THROW_END.lean * D2R * (1 - u);   // 던진 끝 자세에서 이어서 푼다(한 프레임에 돌지 않게)
        if (th < 0.3) {
          if (P0.hipsD[iT]) rig.aim(iT, nlerp(THROW_END.U, P0.hipsD[iT].U, u), nlerp(THROW_END.F, P0.hipsD[iT].F, u));
          if (P0.hipsD[iO]) rig.aim(iO, nlerp(THROW_END.GU, P0.hipsD[iO].U, u), nlerp(THROW_END.GF, P0.hipsD[iO].F, u));
        } else { rig.setArm(iT, P0.hips[iT]); rig.setArm(iO, P0.hips[iO]); }
        const turn = 0.5 * ease(seg(th, 0.35, 0.5)) * (1 - ease(seg(th, 0.82, 0.95)));
        ch.head.rotation.y = lerp(-THROW_END.yaw * D2R * THROW_END.hk, kitHy * 0.3 * (1 - ease(seg(th, 0.8, 0.95))), u) + turn;
        ch.head.rotation.x += 8 * D2R * ease(seg(th, 0, 0.2)) * (1 - ease(seg(th, 0.8, 0.95)));
        const stomp = th > 0.35 ? Math.abs(Math.sin((th - 0.35) * 16)) : 0;
        ch.root.position.y += stomp * 0.03 * k;
        feet = (l) => {
          const back = 1 - u, f = l.s === -1 ? { x: (THROW_END.lx + 0.25) * back, y: hopB, z: (THROW_END.lz - 0.16) * back } : { x: (THROW_END.bx - 0.25) * back, y: hopB, z: (THROW_END.bz - 0.16) * back };   // 폴짝 뛸 땐 발도 같이 뜬다
          if (th > 0.35) { const ph = Math.sin((th - 0.35) * 16 + (l.s > 0 ? 0 : Math.PI)); f.y += Math.max(0, ph) * 0.06; }
          return f;
        };
        if (jkOn) showPile(k, 9);
        if (ch.cap) capOnFloor();
      } else {
        // ── ⑤ 다시 입기 ──
        const trT = t - T4, R2 = tr.R(trT);
        rig.setArm(iT, R2.R, w); rig.setArm(iO, R2.L, w);
        ch.root.rotation.z = R2.tilt * D2R; ch.root.rotation.x = R2.lean * D2R; ch.root.position.y += R2.rise; ch.root.rotation.y += R2.yaw * D2R * w;
        ch.head.rotation.y = lerp(kitHy, -R2.yaw * 0.8 * D2R, w); ch.head.rotation.z -= R2.tilt * D2R * 0.5;
        feet = (l) => ({ x: l.s < 0 ? -0.05 * ease(seg(trT, 0, 0.3)) * (1 - ease(seg(trT, 0.4, 0.7))) : 0 });
        if (jkOn) {
          if (trT < 0.3) showPile(k, 9);
          else if (trT < 0.6) {   // 쥐고 어깨 뒤로 휙
            const u = ease(seg(trT, 0.3, 0.6)), sd = iO >= 0 ? rig.limbs[iO].arm.userData.side : -1;
            rig.handWorld(iO, W); rig.held.visible = true; rig.held.position.set(W.x, W.y, W.z - 0.38 * u * k);
            rig.held.rotation.set(0, 0, sd * lerp(40, 200, u) * D2R); rig.held.scale.setScalar(k);
          } else rig.jk.halves.forEach((h) => { h.rotation.y = h.userData.s * R2.shell * D2R; });
          if (trT >= 0.58 && trT < 0.66) showWhoosh(iO, seg(trT, 0.58, 0.66));
          if (trT >= 0.7 && trT < 0.78) showWhoosh(iT, seg(trT, 0.7, 0.78));
        } else if (ch.cap) {
          const u = ease(seg(trT, 0.3, 0.9));
          if (trT < 0.3) capOnFloor();
          else { capFloorLocal(W); ch.cap.position.set(lerp(W.x, 0, u), lerp(W.y, 0.7, u) + Math.sin(u * Math.PI) * 0.8, lerp(W.z, 0, u)); ch.cap.rotation.set(0, ch.cap.rotation.y, 0.12 * (1 - u) - Math.PI * 2 * u); }
        }
        if (t >= END) { stop(); M.thrown = false; rig.dress(); }
      }
      if (M.mode === 'angry') plantFeet(ch, feet);
    }
    const mirS = (v) => [v[0], v[1], v[2]];   // 던지는 팔이 화면 오른쪽(+1)이라 그대로
    /* 바닥의 학사모 — 머리 묶음 안에 있지만 바닥 자리(캐릭터 제자리 기준)에 붙여 둔다 · 던지느라 몸이 기울어도 바닥 모자는 그대로 */
    const CAP_FLOOR = new T.Vector3(-0.95, 0.14, 0.05);
    function capFloorLocal(out) { const ch = rig.ch; ch.head.updateWorldMatrix(true, false); return ch.head.worldToLocal(out.copy(CAP_FLOOR).multiplyScalar(ch.root.scale.x || 1)); }
    function capOnFloor() { const c2 = rig.ch.cap; capFloorLocal(c2.position); rig.ch.head.getWorldQuaternion(Q).invert(); c2.quaternion.copy(Q).multiply(Q2.setFromEuler(E.set(0, 0, 0.12))); }
    function showPile(k, since) {
      const p = rig.pile; p.visible = true; const u = clamp(since / 0.15, 0, 1);
      p.position.set(-0.85 * k, (0.02 + 0.05 * (1 - u)) * k, 0.35 * k); p.scale.setScalar(k * lerp(1.08, 1, u)); p.rotation.set(0, 0.25, 0);
    }
    function placeClubOnFloor(ch, k) {
      const f = angryPoses(rig).clubFloor, club = rig.club;
      if (club.parent !== c.scene) c.scene.add(club);
      club.position.copy(f.g).multiplyScalar(k); club.quaternion.setFromUnitVectors(Yax, f.dir);
    }
    /* 손에 쥔 몽둥이 — 손잡이 끝이 손 자리 · 방향 C(몸 기준) */
    function holdClub(i, Cb) {
      const sl = rig.limbs[i]; if (!sl) return; const club = rig.club;
      if (club.parent !== sl.elbow) sl.elbow.add(club);
      club.position.copy(rig.handLocal(i));
      Q.copy(sl.arm.quaternion).multiply(sl.elbow.quaternion).invert();
      V.set(Cb[0], Cb[1], Cb[2]).normalize().applyQuaternion(Q);
      club.quaternion.setFromUnitVectors(Yax, V);
    }

    /* ── 회장님 의자에 앉기(수령 가능액) — 리서치 키 장면 ──
       A: 이 줄을 가리킨 뒤 흐른 시간 · W: 앉은 자세의 무게(내려올 때 1 → 0)
       0.12~0.95 의자가 옆에서 굴러 들어온다(무거운 것은 천천히 서고 길게 미끄러진다) · 0.95~1.1 움츠림 · 1.1~ 폴짝(의자가 밑으로 굴러온다) · 내려오다 좌판에 닿으면 착석(가죽에 푹 · 가스 실린더 출렁)
       → 0.45초 동안 14° 뒤로 기댄다 · 턱을 든다 · 빈손은 팔걸이 끝에 · 두 발은 좌판 앞에서 발목을 꼰다(무릎이 없는 몸이라 다리를 배 위로 올리면 혹처럼 보였다)
       앉은 뒤 2초마다: 1초 가만히 → 0.2초 손을 안으로 살짝 → 0.1초 옆으로 툭(블랙잭의 '그만' 손짓처럼 화면과 나란히) → 지폐 3장 → 0.2초 떠 있다가 → 0.4초 천천히 내려놓는다
       윗발은 2초에 한 번 느긋하게 좌우로(빠르게 까딱이면 초조해 보인다) · 의자째 4초에 한 번 살짝 좌우로 돈다(지루한 부자) */
    function seated(ch, cx, A, k, pointSide, W0, dt) {
      const lift = rig.seatLift, F = -pointSide || 1, sL = pointSide || -1;
      const hopH = Math.max(0.62, lift + 0.12);
      const landA = 1.1 + 0.35 * (1 - Math.asin(Math.min(1, lift / hopH)) / Math.PI); M.landA = landA;
      const crouch = A > 0.95 && A < 1.1 ? Math.sin(Math.PI * seg(A, 0.95, 1.1)) : 0;
      const hopU = seg(A, 1.1, 1.45), hopY = A >= 1.1 && A < landA ? Math.sin(Math.PI * hopU) * hopH : 0;
      const sitOn = A >= landA, la = sitOn ? A - landA : 0;
      const sink = sitOn ? Math.exp(-la * 9) * Math.sin(la * 22) * 0.035 : 0;
      const leanK = (sitOn ? ease(clamp(la / 0.45, 0, 1)) : 0) * W0;
      const loopT = A - (landA + 0.6), cyc = loopT > 0 ? loopT % 2 : -1;   // 앉아 쉬는 2초 고리
      // 흔들림 — 지폐를 튕길 때 등을 3° 더 뒤로 · 착석 순간 등받이가 4° 더 젖혔다가 돌아온다
      const rock = cyc >= 1.0 && cyc < 1.35 ? 0.052 * Math.sin(Math.PI * seg(cyc, 1.0, 1.35)) : 0;
      M.backRock = (sitOn && la < 0.6 ? 0.07 * Math.exp(-la * 7) * Math.cos(la * 16) : 0) + rock;
      ch.squash.scale.y *= 1 - 0.12 * crouch * W0 - (sitOn && la < 0.18 ? 0.1 * Math.sin(Math.PI * la / 0.18) : 0) * W0 + (cyc >= 0 ? 0.0075 * (1 - Math.cos(2 * Math.PI * cyc)) : 0);
      ch.root.rotation.order = 'YXZ';
      const swivel = sitOn && la > 0.6 && !REDUCED ? Math.sin((la - 0.6) * 1.5) * 0.08 : 0;
      const yaw0 = ch.root.rotation.y, yawT = clamp(yaw0, -0.1, 0.1) + swivel;
      ch.root.rotation.y = lerp(yaw0, yawT, ease(seg(A, 1.1, 1.5)) * W0);
      M.seatYaw = ch.root.rotation.y;
      const off = new T.Vector3(0, sitOn ? lift - sink : hopY, -0.14 * ease(seg(A, 1.15, 1.4))).multiplyScalar(W0);
      off.applyAxisAngle(Yax, ch.root.rotation.y).multiplyScalar(k);
      ch.root.position.add(off);
      ch.root.rotation.x = -(rig.lean + rock) * leanK;
      ch.root.rotation.z = -F * 0.052 * leanK;                                   // 팔걸이 쪽으로 3° 기대어 늘어진다
      ch.head.rotation.x -= 0.12 * leanK; ch.head.rotation.z -= F * 0.05 * leanK; ch.head.rotation.y *= 1 - 0.5 * leanK;   // 턱을 들고 얼굴은 화면을
      // 발 — 의자 기준 자리(기댄 뒤)를 몸 기준으로 되돌린다 · 아랫발(가리키는 쪽)은 좌판 앞에 걸치고 · 윗발이 그 위로 반쯤 겹친다(발목 꼬기)
      const legK = (sitOn ? ease(clamp((la - 0.05) / 0.4, 0, 1)) : 0) * W0;
      if (legK > 0) {
        const zF = rig.chair.userData.zFront, Sy = rig.seatTop;
        const RM = new T.Matrix4().compose(new T.Vector3(0, lift - sink, -0.14), new T.Quaternion().setFromEuler(new T.Euler(-(rig.lean + rock), 0, 0)), new T.Vector3(1, 1, 1)).invert();
        const sq = ch.squash.scale, sw = cyc >= 0 ? Math.sin(Math.PI * cyc) : 0, kick = cyc >= 0 ? Math.exp(-Math.pow((cyc - 1.15) / 0.06, 2)) : 0;
        rig.legs.forEach((l) => {
          const topF = l.s !== sL, f = l.foot || l;   // 그 쪽의 발을 기준으로 자리를 정하고, 다리 막대·발가락은 발에 대한 자리를 그대로 지킨다
          const w = topF ? new T.Vector3(sL * 0.05 + sL * 0.04 * sw * (REDUCED ? 0 : 1), Sy + 0.1 + 0.03 * sw * sw + 0.04 * kick, zF + 0.17) : new T.Vector3(f.x * 0.9, Sy - 0.03, zF + 0.04);
          w.applyMatrix4(RM); w.x /= sq.x; w.y /= sq.y; w.z /= sq.z;
          E.set(-(topF ? 0.5 + 0.1 * sw * sw + 0.14 * kick : 0.35) * legK, (topF ? sL * 0.44 : sL * 0.17) * legK, (topF ? sL * 0.21 : 0) * legK); Q2.setFromEuler(E);
          if (l.d) w.add(V.copy(l.d).applyQuaternion(Q2));
          l.o.position.set(lerp(l.x, w.x, legK), lerp(l.y, w.y, legK), lerp(l.z, w.z, legK));
          l.o.quaternion.copy(Q2).multiply(l.q0);
        });
      }
      // 가리키는 팔 — 느긋하게 '저거 내 거야'(조금 내리고 팔꿈치를 살짝 굽힌다)
      const pi = sideIdx(ch, sL), fi = sideIdx(ch, F);
      if (pi >= 0 && leanK > 0) { const a = ch.arms[pi]; a.rotation.z -= a.userData.side * 0.25 * leanK; a.rotation.x += -0.17 * leanK; rig.elbows[pi].rotation.x += -0.35 * leanK; }
      // 빈손 — 팔걸이 끝에 얹고 · 지폐를 옆으로 툭
      if (fi >= 0 && rig.limbs[fi]) {
        const R0 = armrestPose(rig, fi);
        let q = R0, flick = false, relQ = null;
        if (cyc >= 0 && !REDUCED) {
          const ANT = [R0[0] - 0.07, R0[1], R0[2] - 0.26, R0[3] - 0.26], FL = [R0[0] + 0.44, R0[1], R0[2] + 0.35, R0[3] + 0.26], AP = [R0[0] + 0.49, R0[1], R0[2] + 0.35, R0[3] + 0.36], AP2 = [R0[0] + 0.38, R0[1], R0[2] + 0.3, R0[3] + 0.3];
          if (cyc < 0.8) q = R0;
          else if (cyc < 1.0) q = blendQ(R0, ANT, ease(seg(cyc, 0.8, 1.0)));
          else if (cyc < 1.1) q = blendQ(ANT, FL, EASE.out(seg(cyc, 1.0, 1.1)));
          else if (cyc < 1.15) q = blendQ(FL, AP, EASE.out(seg(cyc, 1.1, 1.15)));
          else if (cyc < 1.3) q = blendQ(AP, AP2, ease(seg(cyc, 1.15, 1.3)));
          else if (cyc < 1.35) q = AP2;
          else if (cyc < 1.72) q = blendQ(AP2, R0, ease(seg(cyc, 1.35, 1.72)));
          else { const p = Math.sin(Math.PI * seg(cyc, 1.72, 1.8)); q = [R0[0], R0[1], R0[2], R0[3] - 0.09 * p]; }   // 팔걸이에 툭 내려놓는다
          const pc = M.prevA - (landA + 0.6), pcy = pc > 0 ? pc % 2 : -1;
          flick = pcy >= 0 && pcy < 1.06 && cyc >= 1.06 && Math.floor(pc / 2) === Math.floor(loopT / 2);
          relQ = blendQ(ANT, FL, EASE.out(0.6));   // 지폐가 손을 떠나는 순간(1.06)의 자세
          if (cyc >= 1.35 && cyc < 1.5 && M.sh > 0.9) {   // 빈손 쪽 렌즈에 반짝
            const g = seg(cyc, 1.35, 1.5); rig.shades.updateWorldMatrix(true, false); rig.shades.localToWorld(W.set(F * rig.span * 0.45, rig.lensR * 0.4, rig.lensR * 0.4));
            glint.visible = true; glint.position.copy(W); glint.scale.setScalar(0.32 * Math.sin(g * Math.PI)); glint.material.rotation = g * 6;
          }
        }
        /* 지폐는 팔을 그 자세로 둔 뒤에 손에서 낸다(먼저 내면 kit 이 늘어뜨린 손 — 엉덩이 옆에서 나왔다 · 11-22 리뷰) */
        const sl = rig.limbs[fi];
        if (relQ && M.freeze != null) {   // 멈춘 사진 — 날아가는 지폐 셋을 그 순간의 자리로
          const kA = sl.arm.rotation.clone(), kE = sl.elbow.rotation.clone();
          rig.setArm(fi, relQ, leanK); ch.root.updateMatrixWorld(true); rig.handWorld(fi, W2); sl.arm.rotation.copy(kA); sl.elbow.rotation.copy(kE);
          frozenBills(W2, cyc - 1.06, F);
        }
        rig.setArm(fi, q, leanK);
        if (flick) { ch.root.updateMatrixWorld(true); throwBills(fi, 3); }
        // 지폐 뭉치 — 튕긴 뒤 다시 내려놓을 때까지는 손에 없다
        const showFan = leanK > 0.9 && (cyc < 0 || cyc < 1.06 || cyc >= 1.72 || REDUCED);
        if (showFan) {
          const el = rig.elbows[fi]; if (fan.parent !== el) el.add(fan);
          fan.visible = true; fan.position.copy(rig.handLocal(fi)); fan.position.z += 0.06;
          el.getWorldQuaternion(Q).invert(); fan.quaternion.copy(Q);                  // 손이 돌아도 지폐는 화면을 본다
          const el2 = new T.Vector3(); el.getWorldScale(el2); fan.scale.set(k / el2.x, k / el2.y, k / el2.z);
        }
      }
      // 렌즈에 반짝 — 가끔
      const gl = ((A + 0.3) * 0.5) % 1;   // 이 줄의 시각으로(멈춘 사진에서도 같게)
      if (!REDUCED && M.sh > 0.9 && gl < 0.12 && !glint.visible) { rig.shades.updateWorldMatrix(true, false); rig.shades.localToWorld(W.set(-rig.lensR * 0.6, rig.lensR * 0.4, rig.lensR * 0.4)); glint.visible = true; glint.position.copy(W); glint.scale.setScalar(0.32 * Math.sin(gl / 0.12 * Math.PI)); glint.material.rotation = gl * 6; }
      void dt;
    }

    /* ── 「이럴 수는 없어」(마감 D-Day) — 몸수색 자세 + 발 동동 + 식은땀 ──
       d: 이 줄을 가리킨 뒤 흐른 시간 · 0~0.5 들어가기(깜짝 → 두 손 번쩍 → 뒤통수 뒤로 접기 → 발 벌려 디딤) · 그 뒤 1.5초 고리(발 넷 번갈아 쾅 · 0.375초 간격)
       리서치: 경찰은 '손 들어 → 머리 뒤로'를 차례로 시킨다 · 팔을 곧장 내린 자세에서 접힌 자세로 섞으면 손이 얼굴 앞을 지난다 — 화면과 나란히 위·바깥으로 들었다가 접는다
       발 구르기는 '천천히 들고 빨리 내리찍는다'(0.24초 들기 · 0.075초 쾅) · 찍는 순간만 2~4장 찌그러진다 */
    function frisk(ch, cx, d, k, t, dt, W) {
      /* W: 자세의 무게 — 1 이면 그대로 · 줄을 떠날 때 0.25초 동안 1 → 0 으로 풀린다(발 구르기·땀은 W=1 일 때만) */
      W = W == null ? 1 : W;
      const FR = friskPose(rig), HU = [2.79, 0, 0, -0.26], full = W >= 1;
      const up = (REDUCED ? 1 : ease(seg(d, 0.06, 0.2))) * W, fold = REDUCED ? 1 : ease(seg(d, 0.28, 0.44)), shrug = (REDUCED ? 1 : ease(seg(d, 0.06, 0.3))) * W;
      const loop = d >= 0.5 && !REDUCED && full, run = d - 0.5, L = loop ? run % 1.5 : -1;
      // 발 높이 — 그 발이 다음에 찍힐 때까지 남은 시간으로(A 는 0 · 0.75 · B 는 0.375 · 1.125 에 쾅)
      const FH = 0.18;
      const footH = (impact) => { if (!loop) return 0; const dd = ((impact - L) % 0.75 + 0.75) % 0.75; if (dd < 0.075) { const u = 1 - dd / 0.075; return FH * (1 - u * u); } if (dd < 0.315) { const u = (0.315 - dd) / 0.24; return FH * (1 - (1 - u) * (1 - u)); } return 0; };
      // 쾅 한 뒤 지난 시간 — 고리가 시작하기 전에 들어 올린 적 없는 발의 '쾅'은 세지 않는다(첫 박자에 발을 안 들고 찍었다 · 11-22 리뷰)
      const sinceHit = (impact) => { if (!loop) return 9; const sh = ((L - impact) % 0.75 + 0.75) % 0.75; return run - sh < 0.315 ? 9 : sh; };
      const hA = footH(0), hB = footH(0.375), dA = sinceHit(0), dB = sinceHit(0.375);
      const hitA = dA < 0.06 ? 1 - dA / 0.06 : 0, hitB = dB < 0.06 ? 1 - dB / 0.06 : 0, hit = Math.max(hitA, hitB);
      // 팔 — 번쩍 들었다가 뒤통수 뒤로 접는다 · 쾅 할 때마다 움찔
      ch.arms.forEach((a, i) => {
        if (!FR[i]) return;
        let q = fold > 0 ? blendQ(HU, FR[i], fold) : HU.slice();
        if (!REDUCED && d >= 0.3 && d < 0.44) q[0] += 0.05 * Math.sin(Math.PI * seg(d, 0.3, 0.44));   // 팔꿈치가 가장 벌어졌다가 자리를 잡는다
        if (hit > 0) { q = q.slice(); q[0] += 0.1 * hit; q[2] -= 0.04 * hit; }
        rig.setArm(i, q, up);
        a.position.copy(a.userData.p0).addScaledVector(SHRUG_D, shrug);
        if (fold * W > 0.62) rig.limbs[i] && rig.limbs[i].handParts.forEach((o) => { o.visible = false; });
      });
      // 몸 — 가슴을 내밀고 5° 뒤로 · 턱을 8° 든다 · 깜짝 뛰기 · 쾅 할 때 살짝 주저앉음 · 들린 발 반대쪽으로 기운다
      const hop = REDUCED || !full ? 0 : Math.sin(Math.PI * seg(d, 0, 0.12)) * 0.08;
      const land = !REDUCED && full && d >= 0.44 && d < 0.49 ? Math.sin(Math.PI * seg(d, 0.44, 0.49)) : 0;
      ch.root.position.y += (hop - 0.03 * hit) * k;
      ch.squash.scale.y *= (1 + 0.06 * Math.sin(Math.PI * seg(d, 0, 0.12)) * (REDUCED || !full ? 0 : 1)) * (1 - 0.08 * land) * (1 - 0.06 * hit);
      ch.root.rotation.x = -0.087 * up;
      ch.root.rotation.z = 0.07 * (hB - hA) / FH;
      ch.root.rotation.y = lerp(ch.root.rotation.y, clamp(ch.root.rotation.y, -0.3, 0.3), W);
      ch.head.rotation.x -= 0.14 * up; ch.head.rotation.y = lerp(ch.head.rotation.y, clamp(ch.head.rotation.y, -0.3, 0.3), W);
      ch.head.rotation.x += 0.05 * Math.max(dA > 0.016 && dA < 0.08 ? 1 : 0, dB > 0.016 && dB < 0.08 ? 1 : 0);        // 쾅 한 박자 뒤 고개가 툭
      ch.head.rotation.y += 0.12 * (Math.exp(-dA * 9) * (loop ? -1 : 0) + Math.exp(-dB * 9) * (loop ? 1 : 0));         // 「아니, 아니」 — 찍은 발 쪽으로 홱
      if (!REDUCED) ch.head.rotation.z += 0.026 * Math.sin(t * Math.PI * 2 * 12) * W;                                   // 바들바들
      // 눈 — 깜짝 1.3배 → 1.15배
      const ek = lerp(1, REDUCED ? 1.15 : d < 0.12 ? lerp(1, 1.3, seg(d, 0, 0.05)) : lerp(1.3, 1.15, seg(d, 0.12, 0.3)), W);
      rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.set(e.base.x * ek, ek * (e.obj.scale.y || 1), e.base.z); });
      // 발 — 0.44 에 벌려 디딘다(제자리의 1.45배 · 발끝 바깥으로 25°) · 번갈아 쾅(찍을 때 발이 납작)
      const wide = (REDUCED ? 1 : ease(seg(d, 0.38, 0.44))) * W;
      rig.legs.forEach((l) => {
        const h = l.s < 0 ? hA : hB, hitF = l.s < 0 ? hitA : hitB;
        l.o.position.set(l.x * (1 + 0.45 * wide) - l.s * 0.033 * (h / FH), l.y + h + (!REDUCED && full && d >= 0.38 && d < 0.44 ? Math.sin(Math.PI * seg(d, 0.38, 0.44)) * 0.06 : 0), l.z);
        E.set(0.26 * (h / FH), l.s * 0.44 * wide, 0); Q2.setFromEuler(E); l.o.quaternion.copy(Q2).multiply(l.q0);
        if (hitF > 0) { const f = hitF * (dA < 0.05 || dB < 0.05 ? 1 : 0); l.o.scale.set(l.s0.x * (1 + 0.2 * f), l.s0.y * (1 - 0.25 * f), l.s0.z * (1 + 0.2 * f)); }
      });
      // 식은땀 — 머리 옆 물방울이 흘러내린다(약 1.1초마다 · 4판 그대로 · 이 줄의 시각으로 — 멈춘 사진에서도 같게) · 풀리는 동안에는 없다
      if (full) { const u = REDUCED ? 0.5 : (d * 0.9) % 1; rig.sweat.visible = true; rig.sweat.position.y = rig.top * (0.55 - u * 0.4); rig.sweat.scale.setScalar(Math.sin(u * Math.PI) + 0.01); }
      void cx; void dt;
    }
    return {
      after,
      /* kit 의 누르기(동전) 앞에서 — 연출이 가져간 누르기는 동전을 내지 않는다 */
      beforeTap() { if (M.suppress) { M.suppress = false; return false; } return M.mode === 'idle'; },
      /* 홈 히어로가 지금 가리키는 줄 — 'amount' 이면 선글라스+회장님 의자 · 'due' 이고 dday 면 「이럴 수는 없어」 */
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
      get _rig() { return rig; },   // 시안 점검용(앱은 쓰지 않는다)
    };
  }
  K.Mood = Mood;

  /* ── 화면 전체 연출 — 던진 몽둥이가 날아와 화면(유리)이 깨진다 (11-21 개발자 지시) ──
     캐릭터 무대(히어로 칸)가 아니라 **휴대폰 화면 전체**에 덮는 한 장(container 위 캔버스)이다 — 장학금 공고·실시간 공고까지 덮는다.
     시안에서는 container = 휴대폰 틀(흔들기도 그 틀) · 앱에서는 container = 화면 전체를 덮는 한 장(#mascot-fx) · 흔드는 것은 shakeEl(홈 화면 —
     🔴 앱 틀(#app)을 흔들면 그 안의 고정 요소(아래 탭)가 스크롤 자리로 튄다). 누르기를 막지 않는다(pointer-events: none) · 2.3초 뒤 걷힌다.
     🔴 '동작 줄이기'를 켠 폰에서는 부르지 않는다(Mood 가 REDUCED 면 던지지 않는다) */
  function ScreenHit(container, shakeEl) {
    const shaker = shakeEl || container;
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
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(ix, iy, 26 * Math.min(1, grow * 3), 0, Math.PI * 2); g.fill();
      [['rgba(20,24,34,.55)', 2.6], ['rgba(255,255,255,.95)', 1]].forEach(([col, kk]) => {
        g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
        lines.forEach((l) => {
          g.lineWidth = l.w * kk; g.beginPath(); let acc = 0;
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
            const u = e / FLY, kk = Math.pow(u, 1.7);
            drawClub(lerp(sx, ix, kk), lerp(sy, iy, kk) - Math.sin(u * Math.PI) * h * 0.12, 0.35 * Math.pow(10, u), u * Math.PI * 4.2);
          } else {
            if (!crack) {
              crack = makeCrack(ix, iy, w, h);
              if (navigator.vibrate) { try { navigator.vibrate([30, 30, 60]); } catch (er) {} }
            }
            const d = e - FLY;
            if (d < 110) { g.fillStyle = `rgba(255,255,255,${0.55 * (1 - d / 110)})`; g.fillRect(0, 0, w, h); }   // 번쩍
            const shake = d < 340 ? (1 - d / 340) * 9 : 0;
            shaker.style.transform = shake ? `translate(${rand(-shake, shake)}px, ${rand(-shake, shake)}px)` : '';
            drawCrack(crack, ix, iy, Math.min(1, d / 160), d < 1500 ? 1 : Math.max(0, 1 - (d - 1500) / 450));
            if (d >= 1950) { g.clearRect(0, 0, w, h); cv.style.display = 'none'; shaker.style.transform = ''; return; }
          }
          if (at == null) requestAnimationFrame(step);
        })(performance.now());
      },
    };
  }
  K.ScreenHit = ScreenHit;
})();
