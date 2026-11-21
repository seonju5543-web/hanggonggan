/* 마스코트 표정·몸짓 연출 (2026-11-21 개발자 지시 — 시안 docs/designs/mockups/mascot-3d/mood.html · 승인 전)

   kit.js 의 무대(Stage)가 매 프레임 정한 자세 위에 '마지막으로 얹는' 층이다(Stage opt.after · opt.beforeTap).
   부르지 않으면 앱 화면은 예전 그대로다. 45개교 캐릭터·대장님이 같은 뼈대(머리·눈·팔·과잠 묶음)를 쓰므로 부품은 한 벌로 모두에 붙는다.

   손짓(학생이 하는 것) → 반응
     · 1초에 4번 넘게 연타   → 화남: 눈썹·빨간 볼·김 → 과잠을 벗어 던지고 → 화면 쪽으로 뛰쳐나올 듯 덤빈다(「그만!」) → 팔짱(「흥」) → 과잠을 다시 입는다
     · 세게 빙글빙글 돌리기  → 어지러움: 소용돌이 눈 · 머리 위 별 · 비틀
     · 길게 누르기(0.7초)    → 쓰다듬기: 눈 감고 좋아함 · 하트
     · 아래로 끌어당기기     → 납작하게 찌그러졌다가 튕겨 오름
     · 20초 동안 안 건드림   → 꾸벅꾸벅 졸기(Zzz) · 건드리면 깜짝 놀라며 깬다(「!」)
   가리키는 줄(홈 히어로)
     · 수령 가능액 → 선글라스를 끼고 다른 손으로 지폐를 위로 흩뿌린다
     · 마감 D-Day  → 안절부절 — 걱정 눈썹 · 식은땀 · 발 동동 · 가리키는 팔이 떨린다

   🔴 화남은 손짓에만 반응한다 — 학생의 데이터(마감 놓침·미신청)로 화내지 않는다(혼나는 느낌 금지 · 11-21 제안 그대로).
   🔴 '동작 줄이기'를 켠 폰은 표정만 바꾸고 덤비기·과잠 날리기·흔들림·지폐는 뺀다(REDUCED). */
(function () {
  'use strict';
  if (!window.K) return;
  const { T, REDUCED, rand, lerp, clamp, mat, sph } = K;
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
  function bubbleDraw(text) {
    return (g, w, h) => {
      const r = 34, pad = 10;
      g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(25,23,19,.22)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(pad + r, pad); g.arcTo(w - pad, pad, w - pad, h - 40, r); g.arcTo(w - pad, h - 40, pad, h - 40, r);
      g.lineTo(w / 2 + 18, h - 40); g.lineTo(w / 2, h - pad); g.lineTo(w / 2 - 18, h - 40);
      g.arcTo(pad, h - 40, pad, pad, r); g.arcTo(pad, pad, w - pad, pad, r); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#191713'; g.font = `900 ${Math.round(h * 0.34)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, (h - 40) / 2 + pad / 2 + 2);
    };
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
    rig.blush = [L, R].map((e) => { const b = sph(er * 0.62, blushMat, e.c.x * 1.3, e.c.y - er * 1.45, Math.max(e.z - 0.03, front - 0.14), 1.35, 0.7, 0.3); head.add(b); return b; });
    rig.blushMat = blushMat;
    // 선글라스 — 렌즈 둘 + 다리
    {
      const g = new T.Group(), lens = mat(0x111318, 0.18, 0.6), frame = mat(0x111318, 0.3, 0.4);
      [L, R].forEach((e) => { const l = sph(er * 1.18, lens, e.c.x - mid.x, 0, 0, 1.2, 0.88, 0.28); g.add(l); });
      const br = new T.Mesh(new T.CylinderGeometry(er * 0.14, er * 0.14, Math.max(0.05, span - er * 2.6), 8), frame); br.rotation.z = Math.PI / 2; br.position.y = er * 0.35; g.add(br);
      g.position.set(mid.x, mid.y, ez + er * 0.35); g.visible = false; head.add(g); rig.shades = g;
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
    // 손 자리(지폐를 뿌리는 곳) — 팔 묶음의 맨 아래
    rig.hands = (ch.arms || []).map((a) => { const b = localBox(a, a); return new T.Vector3(0, b.min.y + 0.05, 0); });
    void tmp;
    return rig;
  }

  function Mood(stage, opt) {
    opt = opt || {};
    const c = stage.ctx, btn = c.btn, scene = c.scene;
    const M = { mode: 'idle', t: 0, line: null, dday: false, lastInput: performance.now(), idleMs: opt.idleMs || 20000, sh: 0, squish: 0, squishV: 0, pullY: null, suppress: false, petting: false };
    let rig = null;

    // 장면에 두는 것 — 말풍선 · 기호 · 김 · 하트 · 지폐
    const bubble = canvasSprite(256, 150, () => {}, 0.85); scene.add(bubble);
    function say(text) { bubble.userData.redraw(bubbleDraw(text)); bubble.visible = true; bubble.userData.t = 0; }
    const mark = canvasSprite(128, 128, angerMark, 0.42); scene.add(mark);
    const bang = canvasSprite(128, 128, glyph('!', '#e0412f', 118), 0.5); scene.add(bang);
    const heart = canvasSprite(128, 128, glyph('♥', '#ef5a7a', 120), 0.42); scene.add(heart);
    const zs = [0, 1, 2].map(() => { const z = canvasSprite(128, 128, glyph('Z', '#5c6a8a', 110), 0.3); scene.add(z); return z; });
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
    function throwBills(arm, n) {
      if (!arm) return; const hand = rig.hands[rig.ch.arms.indexOf(arm)] || W2.set(0, -0.5, 0);
      arm.localToWorld(W.copy(hand));
      for (let i = 0, k = 0; i < bills.length && k < n; i++) {
        const b = bills[i]; if (b.userData.on) continue; k++;
        b.userData.on = true; b.userData.life = 0; b.visible = true; b.position.copy(W);
        b.userData.v.set(rand(-1.3, 1.3), rand(3.6, 5.2), rand(-0.2, 0.9)); b.userData.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6)); b.userData.ph = rand(0, 6);
        b.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      }
    }

    function start(mode) {
      if (REDUCED && (mode === 'squish')) return;
      M.mode = mode; M.t = 0; c.S.busy = true;
      if (mode === 'angry') { say('그만!'); if (navigator.vibrate) { try { navigator.vibrate([18, 40, 18]); } catch (e) {} } }
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
      if (!rig || rig.ch !== ch) rig = buildRig(ch);
      M.t += dt; if (M.freeze != null) M.t = M.freeze;   // 시안 사진용 — 한 순간에 멈춘다
      const S = cx.S, t = M.t, now = performance.now();
      if (M.mode === 'idle' && now - M.lastInput > M.idleMs && !S.drag) start('sleep');

      // 기본값으로 되돌림(kit 이 손대지 않는 칸)
      ch.root.position.x = 0; ch.root.position.z = 0; ch.root.rotation.z = 0; ch.root.rotation.x = 0;
      ch.arms.forEach((a) => { a.rotation.x = 0; });
      if (ch.jacket) { ch.jacket.visible = true; ch.jacket.position.set(0, 0, 0); ch.jacket.rotation.set(0, 0, 0); }
      rig.brows.forEach((b) => { b.visible = false; }); rig.swirls.forEach((s) => { s.visible = false; });
      rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = true; });
      let blush = 0, blushColor = 0xff5a4a, shades = 0, sweat = false, browAng = 0, browOn = 0;
      mark.visible = false; bang.visible = false; heart.visible = heart.visible && heart.userData.t < 1.2;
      zs.forEach((z) => { z.visible = false; }); stars.forEach((z) => { z.visible = false; });

      const armOf = (s) => ch.arms.find((a) => a.userData.side === s);
      const P = S.point;
      const pointSide = P ? (P.x < 0 ? -1 : 1) : 0;

      if (M.mode === 'angry') {
        /* 0~0.3 표정 · 0.3~0.85 과잠 벗어 던지기 · 0.85~2.1 덤비기(「그만!」) · 2.1~2.8 팔짱(「흥」) · 2.8~3.4 과잠 다시 · 3.6 끝 */
        browOn = 1; browAng = 0.55; blush = 0.6; mark.visible = t < 2.8;
        headTopWorld(W, 0.05); mark.position.set(W.x + 0.42 * ch.root.scale.x, W.y + 0.05, W.z); mark.scale.setScalar(0.42 * (1 + Math.sin(t * 14) * 0.08));
        if (t < 2.8 && Math.floor(t * 9) !== Math.floor((t - dt) * 9)) { emitSteam(-1); emitSteam(1); }
        const shake = REDUCED ? 0 : 0.035;
        ch.root.position.x += Math.sin(t * 60) * shake * (t < 2.1 ? 1 : 0.3);
        const lift = ease(seg(t, 0.3, 0.5)) * (1 - ease(seg(t, 0.75, 0.9)));
        if (t < 2.1) ch.arms.forEach((a) => { const s = a.userData.side; a.rotation.z = s * (lerp(0.3, 2.7, lift) + (t > 0.85 ? 2.4 - lerp(0.3, 2.7, lift) + Math.sin(t * 26 + s * 1.6) * 0.45 : 0)); });
        // 과잠 — 벗어 위로 날아간다 · 끝에 다시 떨어져 입힌다
        const jk = ch.jacket || null;
        if (jk && !REDUCED) {
          if (t >= 0.45 && t < 2.8) { const u = seg(t, 0.45, 1.25); jk.position.set(-0.6 * u, 3.6 * u * u + 0.6 * u, -1.2 * u); jk.rotation.set(-1.5 * u, 0, 2.4 * u); jk.visible = u < 1; }
          else if (t >= 2.8) { const u = ease(seg(t, 2.8, 3.25)); jk.position.set(0, (1 - u) * 2.4, 0); jk.rotation.set(0, 0, 0); }
        }
        if (!jk && ch.cap && !REDUCED && t >= 0.45 && t < 2.8) { const u = seg(t, 0.45, 1.2); ch.cap.position.y = 0.7 + 2.6 * u; ch.cap.rotation.z = 4 * u; ch.cap.visible = u < 1; }
        else if (ch.cap) { ch.cap.visible = true; if (t >= 2.8) { const u = ease(seg(t, 2.8, 3.2)); ch.cap.position.y = 0.7 + (1 - u) * 1.8; ch.cap.rotation.z = 0; } }
        // 덤비기 — 카메라 쪽으로(화면 밖으로 튀어나올 듯)
        const k = REDUCED ? 0 : ease(seg(t, 0.85, 1.15)) * (1 - ease(seg(t, 1.9, 2.25)));
        if (k > 0) {
          W.copy(cx.cam.position).multiplyScalar(0.46); ch.root.position.x += W.x * k; ch.root.position.z += W.z * k;
          ch.root.position.y += Math.abs(Math.sin(t * 16)) * 0.12 * k; ch.root.rotation.x = 0.18 * k;
        }
        if (t > 0.85 && t < 0.9 && bubble.userData.text !== '그만!') { say('그만!'); bubble.userData.text = '그만!'; }
        // 팔짱 · 고개 홱 · 발 동동
        if (t >= 2.1) {
          ch.arms.forEach((a) => { const s = a.userData.side; a.rotation.z = s * 0.78; a.rotation.x = 0.4; });   // 허리에 손(씩씩) — 둥근 몸이라 팔짱은 팔이 몸 안으로 묻혀 안 보인다(11-21 시안 실측)
          ch.head.rotation.y += 0.55 * ease(seg(t, 2.1, 2.3)); ch.head.rotation.x += 0.12;
          if (!REDUCED) ch.root.position.y += Math.abs(Math.sin(t * 18)) * 0.05;
          if (bubble.userData.text !== '흥') { say('흥'); bubble.userData.text = '흥'; }
        }
        if (t > 3.6) { stop(); bubble.userData.text = ''; }
      } else if (M.mode === 'dizzy') {
        const u = seg(t, 0, 2.2), fade = 1 - ease(seg(t, 1.6, 2.2));
        rig.swirls.forEach((s) => { s.visible = true; s.rotation.z = -t * 9; }); rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = false; });
        if (!REDUCED) { ch.root.rotation.z = Math.sin(t * 6) * 0.2 * fade; ch.head.rotation.z += Math.sin(t * 6 + 1) * 0.25 * fade; ch.root.position.x += Math.sin(t * 3) * 0.12 * fade; }
        headTopWorld(W, 0.25);
        stars.forEach((z, i) => { const a = t * 4 + i * 2.1; z.visible = true; z.position.set(W.x + Math.cos(a) * 0.55, W.y + Math.sin(a * 2) * 0.05, W.z + Math.sin(a) * 0.4); });
        if (u >= 1) stop();
      } else if (M.mode === 'pet') {
        blush = 0.75; blushColor = 0xff8fa8;
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.y = 0.14; });
        if (!REDUCED) { ch.root.rotation.z = Math.sin(t * 3) * 0.06; ch.head.rotation.z += Math.sin(t * 3) * 0.08; }
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
        rig.eyes.forEach((e) => { if (e.obj) e.obj.scale.y = 0.1; });
        ch.head.rotation.x += 0.32 + Math.max(0, Math.sin(t * 1.6)) * 0.18; ch.head.rotation.y *= 0.2;
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
          shades = 1;
          const other = armOf(-pointSide);
          if (other && !REDUCED) {
            const ph = (t * 1.7) % 1;                                   // 한 번 뿌리는 주기
            other.rotation.z = other.userData.side * lerp(0.4, 2.9, ph < 0.55 ? ease(ph / 0.55) : 1 - ease((ph - 0.55) / 0.45));
            if (ph > 0.5 && ph - dt * 1.7 <= 0.5) throwBills(other, 5);
          }
        } else if (M.line === 'due' && M.dday && P) {
          browOn = 1; browAng = -0.45; sweat = true;
          if (!REDUCED) {
            ch.root.position.y += Math.abs(Math.sin(t * 15)) * 0.06; ch.root.position.x += Math.sin(t * 7.5) * 0.05;
            ch.squash.scale.y *= 1 - Math.abs(Math.sin(t * 15)) * 0.05;
            const pa = armOf(pointSide); if (pa) pa.rotation.z += Math.sin(t * 34) * 0.07;
            const other = armOf(-pointSide); if (other) other.rotation.z = other.userData.side * (0.5 + Math.sin(t * 15) * 0.25);
            ch.head.rotation.z += Math.sin(t * 9) * 0.06;
          }
        }
      }

      // 부품 그리기
      rig.brows.forEach((b) => { b.visible = browOn > 0; b.rotation.z = b.userData.s * -browAng; b.position.y = rig.eyes[0].c.y + rig.er * (browAng > 0 ? 1.12 : 1.4); });
      rig.blushMat.color.setHex(blushColor); rig.blushMat.opacity = lerp(rig.blushMat.opacity, blush, 1 - Math.pow(0.001, dt));
      M.sh = lerp(M.sh, shades, 1 - Math.pow(0.0005, dt));
      rig.shades.visible = M.sh > 0.02; rig.shades.position.y = rig.mid.y + (1 - M.sh) * 0.7; rig.shades.scale.setScalar(Math.max(0.01, M.sh));
      if (sweat) { rig.sweat.visible = true; const u = (t * 0.9) % 1; rig.sweat.position.y = rig.top * (0.55 - u * 0.4); rig.sweat.scale.setScalar(Math.sin(u * Math.PI) + 0.01); } else rig.sweat.visible = false;
      if (shades && M.mode === 'idle') rig.eyes.forEach((e) => { if (e.obj) e.obj.visible = false; });

      // 김 · 하트 · 말풍선 · 지폐
      steam.forEach((p) => { if (!p.visible) return; const d = p.userData; d.life += dt; p.position.addScaledVector(d.v, dt); p.scale.multiplyScalar(1 + dt * 1.6); p.material.opacity = Math.max(0, 0.85 - d.life * 1.3); if (d.life > 0.65) p.visible = false; });
      if (heart.visible) { heart.userData.t += dt; headTopWorld(W, 0.15 + heart.userData.t * 0.5); heart.position.copy(W); heart.material.opacity = Math.max(0, 1 - heart.userData.t / 1.2); heart.scale.setScalar(0.3 + Math.min(1, heart.userData.t * 4) * 0.15); }
      if (bubble.visible) {
        bubble.userData.t += dt;
        /* 덤빌 때는 머리 위가 화면 밖이라 머리 옆에 둔다 */
        if (ch.root.position.z > 0.6) { ch.head.localToWorld(W.set(-rig.hw * 1.75, rig.top * 0.75, 0)); bubble.position.copy(W); }
        else { headTopWorld(W, 0.55); bubble.position.set(W.x - 0.35 * ch.root.scale.x, W.y, W.z); }
        if (M.mode !== 'angry' && bubble.userData.t > 0.6) bubble.visible = false;
      }
      bills.forEach((b) => {
        const d = b.userData; if (!d.on) return; d.life += dt;
        d.v.y -= (d.v.y > -0.7 ? 9 : 0) * dt; d.v.x *= 1 - dt * 1.2; d.v.z *= 1 - dt * 1.2;
        b.position.addScaledVector(d.v, dt); b.position.x += Math.sin(d.life * 6 + d.ph) * 0.012;
        b.rotation.x += d.w.x * dt; b.rotation.y += d.w.y * dt; b.rotation.z += d.w.z * dt;
        if (b.position.y < 0.02) { b.position.y = 0.02; d.v.set(0, 0, 0); d.w.set(0, 0, 0); b.rotation.x = -Math.PI / 2; }
        if (d.life > 2.6) b.scale.setScalar(Math.max(0.001, 1 - (d.life - 2.6) / 0.4));
        if (d.life > 3.0) { d.on = false; b.visible = false; b.scale.setScalar(1); }
      });
      c.S.busy = M.mode !== 'idle' || bills.some((b) => b.userData.on) || M.sh > 0.02 || steam.some((p) => p.visible) || heart.visible || bubble.visible || (M.line === 'due' && M.dday && !!P);
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
})();
