/* PDF 보기 — 홈 화면에 설치한 앱에서 앱 안 PDF 를 열면 **돌아올 길이 없던** 사고를 막는다 (2026-11-21 개발자 제보 · 아이폰 화면 사진).
   🔴 왜: 설치한 앱(standalone)에는 주소창·뒤로 버튼이 없다. 같은 집 주소(data/forms-pdf · docs-pdf · form-pages · kosaf-files)의 PDF 는
      `target=_blank` 여도 앱 창 그대로 PDF 로 넘어가 버려서, 학생이 앱을 껐다 켜야 나올 수 있었다.
      (바깥 주소의 원래 PDF 는 아이폰이 「완료」 단추가 있는 따로 창으로 열어 문제가 없다 — 그래서 그대로 둔다.)
   🔴 왜 앱 안 그리기인가: 아이폰은 <iframe>·<embed> 에 넣은 PDF 를 **첫 쪽만** 그림처럼 보여 준다(오래된 WebKit 버릇).
      그래서 pdf.js(Mozilla · Apache-2.0 · pdfjs/LICENSE)를 저장소에 두고(CSP script-src 'self' 그대로) 쪽마다 그린다.
   브라우저에서 연 앱은 그대로 새 탭이다(2026-11-20 결정 (가) 「폰의 PDF 보기로 연다」 — 새 탭은 돌아올 길이 있다).
   설치한 앱에서도 「저장·공유」 단추가 폰의 PDF 보기(파일 앱·북스·인쇄)로 넘겨 준다 — 확대·검색·인쇄는 거기서.
   엔진(약 1.8MB)은 PDF 를 처음 열 때만 싣는다. 관문 「PDF 보기 — 설치한 앱에서 돌아올 길」. */

const PDFV_LIB = 'pdfjs/pdf.min.mjs';
const PDFV_WORKER = 'pdfjs/pdf.worker.min.mjs';
const PDFV_ZOOMS = [1, 1.5, 2, 3];
let pdfvLibP = null;     // 엔진 싣기(한 번)
let pdfvCur = null;      // { href, name, doc, task, seq, zoom, io, lay, file }
let pdfvSeqN = 0;

/* 설치한 앱으로 떠 있는가 — 아이폰(navigator.standalone)·안드로이드(display-mode) 둘 다 */
function pdfvStandalone() {
  try { return window.navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); } catch (e) { return false; }
}
/* 우리 집 PDF 인가 — 같은 출처 + 이름이 .pdf (바깥 주소는 CORS 로 못 읽고, 아이폰이 따로 창으로 열어 준다) */
function pdfvOwnPdf(href) {
  try {
    const u = new URL(href, location.href);
    return u.origin === location.origin && /\.pdf$/i.test(u.pathname);
  } catch (e) { return false; }
}

function pdfvLoadLib() {
  if (!pdfvLibP) {
    pdfvLibP = import(new URL(PDFV_LIB, document.baseURI).href).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(PDFV_WORKER, document.baseURI).href;
      return lib;
    }).catch((e) => { pdfvLibP = null; throw e; });   // 실패하면 다음에 다시 시도
  }
  return pdfvLibP;
}

function pdfvEl() {
  let el = document.getElementById('pdf-view');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'pdf-view';
  el.className = 'pdfv';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<header class="pdfv-bar">
      <button type="button" class="sub-back pdfv-close" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
      <p class="pdfv-title"><strong class="pdfv-name"></strong><span class="pdfv-pages"></span></p>
      <button type="button" class="pdfv-share" hidden>저장·공유</button>
    </header>
    <div class="pdfv-scroll"><div class="pdfv-doc"></div><p class="pdfv-msg" hidden></p></div>
    <div class="pdfv-zoom" role="group" aria-label="크기">
      <button type="button" class="pdfv-zoom-out" aria-label="작게">−</button>
      <button type="button" class="pdfv-zoom-in" aria-label="크게">+</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('.pdfv-close').addEventListener('click', closePdfView);
  el.querySelector('.pdfv-share').addEventListener('click', pdfvShare);
  el.querySelector('.pdfv-zoom-in').addEventListener('click', () => pdfvZoomStep(1));
  el.querySelector('.pdfv-zoom-out').addEventListener('click', () => pdfvZoomStep(-1));
  return el;
}

function pdfvMsg(text) {
  const m = document.querySelector('#pdf-view .pdfv-msg');
  if (!m) return;
  m.textContent = text || '';
  m.hidden = !text;
}

function openPdfView(href, name) {
  const el = pdfvEl();
  closePdfDoc();
  const seq = ++pdfvSeqN;
  pdfvCur = { href, name: String(name || '').trim() || 'PDF', doc: null, task: null, seq, zoom: 1, io: null, lay: 0, file: null };
  el.querySelector('.pdfv-name').textContent = pdfvCur.name;
  el.querySelector('.pdfv-pages').textContent = '';
  el.querySelector('.pdfv-doc').innerHTML = '';
  el.querySelector('.pdfv-share').hidden = true;   // 파일을 다 받은 뒤 넘길 수 있는 폰에서만 보인다(pdfvPrepareShare)
  el.querySelector('.pdfv-scroll').scrollTop = 0;
  pdfvMsg('불러오는 중…');
  el.hidden = false;
  pdfvLoadLib()
    .then((lib) => {
      if (!pdfvCur || pdfvCur.seq !== seq) return null;
      pdfvCur.task = lib.getDocument({ url: new URL(href, location.href).href, isEvalSupported: false });
      return pdfvCur.task.promise;
    })
    .then((doc) => {
      if (!doc) return;
      if (!pdfvCur || pdfvCur.seq !== seq) { doc.destroy(); return; }
      pdfvCur.doc = doc;
      el.querySelector('.pdfv-pages').textContent = `${doc.numPages}쪽`;
      pdfvMsg('');
      pdfvPrepareShare(seq);
      return pdfvLayout(seq);
    })
    .catch(() => { if (pdfvCur && pdfvCur.seq === seq) pdfvMsg('문서를 열지 못했어요. 연결을 확인하고 다시 열어 주세요.'); });
}

/* 쪽 자리를 먼저 깔고(쪽 크기 비율) 화면 근처에 온 쪽만 그린다 — 쪽이 많아도 폰 메모리를 다 쓰지 않게(멀어진 쪽은 비운다) */
async function pdfvLayout(seq) {
  const cur = pdfvCur;
  if (!cur || cur.seq !== seq || !cur.doc) return;
  const lay = ++cur.lay;   // 쪽 자리를 까는 도중에 크기를 바꾸면 앞선 깔기는 멈춘다(쪽이 두 벌 깔리지 않게)
  const live = () => pdfvCur === cur && cur.lay === lay;
  const el = pdfvEl();
  const box = el.querySelector('.pdfv-doc');
  const scroller = el.querySelector('.pdfv-scroll');
  if (cur.io) { cur.io.disconnect(); cur.io = null; }
  box.innerHTML = '';
  box.style.width = `${cur.zoom * 100}%`;
  const views = [];
  for (let n = 1; n <= cur.doc.numPages; n++) {
    const page = await cur.doc.getPage(n);
    if (!live()) return;
    const vp = page.getViewport({ scale: 1 });
    const slot = document.createElement('div');
    slot.className = 'pdfv-page';
    slot.dataset.n = String(n);
    slot.style.aspectRatio = `${vp.width} / ${vp.height}`;
    slot.setAttribute('aria-label', `${n}쪽`);
    box.appendChild(slot);
    views.push({ slot, page });
  }
  const draw = (v) => {
    if (v.drawn || v.busy) return;
    v.busy = true;
    const cssW = v.slot.clientWidth || box.clientWidth;
    const base = v.page.getViewport({ scale: 1 });
    /* 선명도는 화면 배율(최대 2) — 한 쪽이 약 600만 화소를 넘지 않게 묶는다(아이폰 그림판 한도) */
    let scale = (cssW / base.width) * Math.min(window.devicePixelRatio || 1, 2);
    const px = base.width * base.height * scale * scale;
    if (px > 6e6) scale *= Math.sqrt(6e6 / px);
    const vp = v.page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    v.task = v.page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    v.task.promise.then(() => {
      v.busy = false;
      if (!live()) return;
      v.slot.replaceChildren(canvas);
      v.drawn = true;
    }).catch(() => { v.busy = false; });
  };
  const clear = (v) => {
    if (v.task && v.busy) { try { v.task.cancel(); } catch (e) { /* 이미 끝남 */ } }
    v.busy = false;
    if (!v.drawn) return;
    const c = v.slot.querySelector('canvas');
    if (c) { c.width = 0; c.height = 0; }
    v.slot.replaceChildren();
    v.drawn = false;
  };
  if (typeof IntersectionObserver === 'undefined') { views.forEach(draw); return; }
  const near = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const v = views.find((x) => x.slot === en.target);
      if (!v) continue;
      if (en.isIntersecting) draw(v); else if (!pdfvNear(en, scroller)) clear(v);
    }
  }, { root: scroller, rootMargin: '150% 0px' });
  views.forEach((v) => near.observe(v.slot));
  cur.io = near;
}
/* 화면에서 쪽 높이 셋 넘게 멀어진 쪽만 비운다(살짝 벗어난 쪽을 지웠다 다시 그리면 깜빡인다) */
function pdfvNear(en, scroller) {
  const r = en.boundingClientRect;
  const h = (scroller && scroller.clientHeight) || window.innerHeight;
  return r.bottom > -3 * h && r.top < 4 * h;
}

function pdfvZoomStep(dir) {
  if (!pdfvCur || !pdfvCur.doc) return;
  const i = PDFV_ZOOMS.indexOf(pdfvCur.zoom);
  const next = PDFV_ZOOMS[Math.max(0, Math.min(PDFV_ZOOMS.length - 1, i + dir))];
  if (next === pdfvCur.zoom) return;
  const scroller = pdfvEl().querySelector('.pdfv-scroll');
  const ratio = scroller.scrollHeight ? scroller.scrollTop / scroller.scrollHeight : 0;
  pdfvCur.zoom = next;
  pdfvLayout(pdfvCur.seq).then(() => { scroller.scrollTop = ratio * scroller.scrollHeight; });
}

/* 폰의 PDF 보기로 넘기기 — 공유 시트(파일 앱 저장·북스·인쇄). 파일은 문서를 연 뒤 미리 만들어 둔다:
   아이폰은 누른 손길이 식기 전에 navigator.share 를 불러야 해서, 누른 뒤에 받으러 가면 공유 창이 안 뜰 수 있다.
   파일째 못 넘기는 폰이면 단추를 감춘 채 둔다 */
function pdfvPrepareShare(seq) {
  const cur = pdfvCur;
  if (!cur || !cur.doc || !navigator.share || !navigator.canShare || typeof File === 'undefined') return;
  cur.doc.getData().then((bytes) => {
    if (pdfvCur !== cur || cur.seq !== seq) return;
    const fname = (/\.pdf$/i.test(cur.name) ? cur.name : `${cur.name}.pdf`).replace(/[\\/:*?"<>|]/g, '_');
    const file = new File([bytes], fname, { type: 'application/pdf' });
    if (!navigator.canShare({ files: [file] })) return;
    cur.file = file;
    pdfvEl().querySelector('.pdfv-share').hidden = false;
  }).catch(() => { /* 단추를 안 띄울 뿐 */ });
}
function pdfvShare() {
  const cur = pdfvCur;
  if (!cur || !cur.file) return;
  navigator.share({ files: [cur.file], title: cur.name }).catch(() => { /* 학생이 공유 창을 닫은 것도 여기로 온다 — 알리지 않는다 */ });
}

function closePdfDoc() {
  if (!pdfvCur) return;
  if (pdfvCur.io) pdfvCur.io.disconnect();
  if (pdfvCur.task) { try { pdfvCur.task.destroy(); } catch (e) { /* 이미 닫힘 */ } }
  const box = document.querySelector('#pdf-view .pdfv-doc');
  if (box) { box.querySelectorAll('canvas').forEach((c) => { c.width = 0; c.height = 0; }); box.innerHTML = ''; }
  pdfvCur = null;
}

function closePdfView() {
  closePdfDoc();
  const el = document.getElementById('pdf-view');
  if (el) el.hidden = true;
}

/* 우리 집 PDF 링크를 누르면 — 설치한 앱일 때만 가로챈다(브라우저는 새 탭 그대로). 위임 하나라 어느 화면의 PDF 줄이든 같다 */
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || !pdfvStandalone() || !pdfvOwnPdf(a.getAttribute('href'))) return;
  e.preventDefault();
  openPdfView(a.getAttribute('href'), a.textContent);
});
/* 키보드 Esc 도 닫기로(넓은 화면) */
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pdfvCur) closePdfView(); });
