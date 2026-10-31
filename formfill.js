/* ============================================================
   양식 채우기 — 원본 쪽 그림 위에 답 얹기 (양식 5단계 · 시안 B/C · 2026-10-31)
   ------------------------------------------------------------
   왜 — 앱이 양식을 다시 그리면 원본과 다른 문서가 된다(docs/designs/forms-links-cards.md 5단계 · 10-13 시안 확정 A + B/C).
        그래서 로봇(collector/form-fields.mjs)이 만든 **쪽 그림(WebP)** 위, 로봇이 찾은 **빈칸 자리**에 학생 답을 얹는다. 문서는 한 글자도 안 바뀐다.
   화면 — 가운데 쪽 그림(#fill-pages · 칸은 쪽 크기에 대한 % 로 놓여 폭이 바뀌어도 제자리) + 칸 목록(#fill-panel):
          폰(좁은 폭)은 아래 서랍(B) · 넓은 폭은 오른쪽 사이드바(C). 목록 머리에 「남은 칸 n」 알약. 같은 칸은 그림 위와 목록이 한 값(두 곳 어디서 고쳐도 같이).
   채움 — 로봇이 key 를 매긴 칸(이름·학교·학과·학년·학번·생년월일·연락처·이메일·은행·계좌)은 학적정보로 먼저 채운다(ffAutoValue · 프로필은 기기 안에서만).
          key 가 없는 칸(가족 표 아래 칸·주소 등)은 비워 둔다 — 학생이 적는다. 자동으로 들어간 값을 고치면 「되돌리기」가 뜬다.
   저장 — state.formFills["<공고 id>|<파일>"][칸 id] (기기 안 · saveState). 내보내기 — 결정 4: 브라우저 「인쇄 → PDF 저장」(style.css @media print 가 쪽 그림만 종이 크기로).
   🔴 정직 — '제출 완료'라 하지 않는다 · 서명·날인 칸은 비워 둔다(결정 5) · 로봇이 못 찾은 칸을 지어내지 않는다(그 파일은 단추가 안 뜬다 · 원본 PDF 를 받아 손으로 쓴다).
   의존 — app.js 의 $, esc, state, saveState, showScreen, closeSheet, formPdfsFor, currentScreen(전역). index.html 이 app.js 뒤에 싣는다.
   ============================================================ */
const ffCache = {};       // 공고 id → fields.json(없으면 null)
const ffPending = {};     // 공고 id → 받는 중 Promise
let ffCur = null;         // 열린 양식 { sch, file, rel, F, from }

/* 프로필 칸 → 자동으로 넣을 값. 🔴 지어내지 않는다 — 없으면 빈 글자 */
function ffAutoValue(key) {
  const p = (typeof state !== 'undefined' && state && state.profile) || {};
  const c = p.common || {};
  switch (key) {
    case 'name': return p.name || '';
    case 'school': return p.school || '';
    case 'campus': return p.campus || '';
    case 'major': return p.major || '';
    case 'year': return p.year ? `${p.year}학년` : '';
    case 'gpa': return p.gpa != null && p.gpa !== '' ? String(p.gpa) : '';
    case 'bracket': return p.bracket != null && p.bracket !== '' ? `${p.bracket}구간` : '';
    case 'studentId': return c.studentId || '';
    case 'birth': return c.birth || '';
    case 'phone': return c.phone || '';
    case 'email': return c.email || '';
    case 'bank': return c.bank || '';
    case 'account': return c.account || '';
    default: return '';
  }
}

/* 그 공고의 fields.json — 한 번만 받는다(없으면 null · 마감 뒤 로봇이 지운 공고도 null) */
function loadFormFields(sch) {
  if (!sch || typeof formPdfsFor !== 'function' || !formPdfsFor(sch).length) return Promise.resolve(null);
  if (sch.id in ffCache) return Promise.resolve(ffCache[sch.id]);
  if (ffPending[sch.id]) return ffPending[sch.id];
  ffPending[sch.id] = fetch(`data/forms-pdf/${encodeURIComponent(sch.id)}/fields.json`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((j) => { ffCache[sch.id] = j && j.files && typeof j.files === 'object' ? j : null; delete ffPending[sch.id]; return ffCache[sch.id]; });
  return ffPending[sch.id];
}
/* index.json 의 file("<id>/<n>-<이름>.pdf") → fields.json 의 항목(빈칸이 하나라도 있을 때만) */
function ffFileEntry(fj, file) {
  if (!fj || !file) return null;
  const rel = String(file).split('/').pop();
  const F = fj.files[rel];
  return F && Array.isArray(F.fields) && F.fields.length && Array.isArray(F.pages) && F.pages.length ? { rel, F } : null;
}

/* 신청 준비 시트·지원문서 머리의 「원본 양식 그대로 보기」 줄 밑 자리(li.fill-slot)에 「양식 채우기」 단추를 붙인다 — 빈칸을 찾은 파일만 */
function attachFormFillButtons(sch, root) {
  const slots = [...(root || document).querySelectorAll('.fill-slot[data-file]')];
  if (!slots.length || !sch) return;
  loadFormFields(sch).then((fj) => {
    for (const slot of slots) {
      const e = ffFileEntry(fj, slot.dataset.file);
      if (!e) { slot.hidden = true; continue; }
      const keyed = e.F.fields.filter((f) => f.key).length;
      slot.innerHTML = `<button type="button" class="btn fill-open" data-id="${esc(sch.id)}" data-file="${esc(slot.dataset.file)}">양식 채우기<span class="fill-open-m">빈칸 ${e.F.fields.length}개${keyed ? ` · 학적정보로 ${keyed}개 먼저 채워요` : ''}</span></button>`;
      slot.hidden = false;
    }
  });
}

function ffKey(sch, rel) { return `${sch.id}|${rel}`; }
function ffSaved(sch, rel) { return ((state && state.formFills) || {})[ffKey(sch, rel)] || {}; }
function ffValueOf(f, saved) { return Object.prototype.hasOwnProperty.call(saved, f.id) ? saved[f.id] : ffAutoValue(f.key); }
const ffPct = (v, base) => `${(v / base * 100).toFixed(3)}%`;

function openFormFill(sch, file) {
  const fj = ffCache[sch.id];
  const e = ffFileEntry(fj, file);
  if (!e) return;
  const { rel, F } = e;
  ffCur = { sch, file, rel, F, from: (typeof currentScreen !== 'undefined' && currentScreen) || 'applications' };
  const saved = ffSaved(sch, rel);
  const pagesHtml = F.pages.map((pg) => {
    const fields = F.fields.filter((f) => f.page === pg.n);
    return `<div class="fillp-page" data-page="${pg.n}" style="aspect-ratio:${pg.w}/${pg.h}" data-w="${pg.w}">
      <img src="data/forms-pdf/${esc(sch.id)}/${esc(F.dir)}/${esc(pg.img)}" alt="${pg.n}쪽" loading="lazy">
      ${fields.map((f) => `<input class="fillp-field${ffValueOf(f, saved) ? '' : ' fillp-empty'}" data-fid="${esc(f.id)}" aria-label="${esc(f.label)}" value="${esc(ffValueOf(f, saved))}" placeholder="${esc(f.label)}"
        style="left:${ffPct(f.x, pg.w)};top:${ffPct(f.y, pg.h)};width:${ffPct(f.w, pg.w)};height:${ffPct(f.h, pg.h)}">`).join('')}
    </div>`;
  }).join('');
  $('#fill-pages').innerHTML = pagesHtml;
  $('#fill-title').textContent = sch.name;
  $('#fill-file').textContent = F.pages.length === 1 ? rel.replace(/^\d+-/, '') : `${rel.replace(/^\d+-/, '')} · ${F.pages.length}쪽`;
  $('#fill-list').innerHTML = F.fields.map((f) => `<li data-fid="${esc(f.id)}">
      <label class="fill-lab">${esc(f.label)}<span class="fill-page-n">${f.page}쪽</span></label>
      <input class="fill-pin" data-fid="${esc(f.id)}" value="${esc(ffValueOf(f, saved))}" placeholder="${f.key ? '학적정보에 없어요 — 적어 주세요' : '직접 적어요'}">
      <button type="button" class="link-btn fill-undo" data-fid="${esc(f.id)}" hidden>되돌리기</button>
    </li>`).join('');
  ffRefresh();
  closeSheet();
  showScreen('formfill');
  $('#fill-panel').classList.remove('open');
  ffScale();
  if (typeof appScrollTo === 'function') appScrollTo(0); else appScroller().scrollTop = 0;
}

/* 남은 칸 수 · 되돌리기 표시 · 빈칸 표시 */
function ffRefresh() {
  if (!ffCur) return;
  const saved = ffSaved(ffCur.sch, ffCur.rel);
  let left = 0;
  for (const f of ffCur.F.fields) {
    const v = ffValueOf(f, saved);
    if (!v) left++;
    const pin = $(`#fill-list [data-fid="${f.id}"] .fill-undo`);
    if (pin) pin.hidden = !(Object.prototype.hasOwnProperty.call(saved, f.id) && saved[f.id] !== ffAutoValue(f.key));
    const el = $(`#fill-pages .fillp-field[data-fid="${f.id}"]`);
    if (el) el.classList.toggle('fillp-empty', !v);
  }
  $('#fill-left').textContent = left ? `남은 칸 ${left}` : '다 채웠어요';
  $('#fill-left').classList.toggle('done', !left);
  $('#fill-handle-n').textContent = left ? `남은 칸 ${left}` : '다 채웠어요';
}

function ffSet(fid, value, fromEl) {
  if (!ffCur) return;
  const f = ffCur.F.fields.find((x) => x.id === fid);
  if (!f) return;
  state.formFills = state.formFills || {};
  const k = ffKey(ffCur.sch, ffCur.rel);
  state.formFills[k] = state.formFills[k] || {};
  state.formFills[k][fid] = value;
  for (const el of $$(`[data-fid="${fid}"]`)) if (el !== fromEl && 'value' in el && el.tagName === 'INPUT') el.value = value;
  clearTimeout(ffSet.t);
  ffSet.t = setTimeout(() => saveState(), 250);
  ffRefresh();
}
function ffUndo(fid) {
  if (!ffCur) return;
  const f = ffCur.F.fields.find((x) => x.id === fid);
  const k = ffKey(ffCur.sch, ffCur.rel);
  if (f && state.formFills && state.formFills[k]) delete state.formFills[k][fid];
  const v = ffAutoValue(f ? f.key : null);
  for (const el of $$(`input[data-fid="${fid}"]`)) el.value = v;
  saveState();
  ffRefresh();
}
/* 쪽 그림 폭에 맞춰 글자 크기를 — 1pt 가 화면에서 몇 px 인지 */
function ffScale() {
  for (const pg of $$('#fill-pages .fillp-page')) {
    const w = Number(pg.dataset.w) || 595;
    pg.style.setProperty('--ffpt', `${pg.clientWidth / w}px`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!$('#screen-formfill')) return;
  document.addEventListener('click', (ev) => {
    const open = ev.target.closest('.fill-open');
    if (open) {
      const sch = (typeof allScholarships === 'function' ? allScholarships() : []).find((s) => s.id === open.dataset.id);
      if (sch) loadFormFields(sch).then(() => openFormFill(sch, open.dataset.file));
      return;
    }
    const undo = ev.target.closest('.fill-undo');
    if (undo) { ffUndo(undo.dataset.fid); return; }
    const pin = ev.target.closest('#fill-list li');
    if (pin && !ev.target.closest('input') && ffCur) {
      const el = $(`#fill-pages .fillp-field[data-fid="${pin.dataset.fid}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); }
    }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el && el.matches && el.matches('.fillp-field, .fill-pin')) ffSet(el.dataset.fid, el.value, el);
  });
  $('#btn-fill-back').addEventListener('click', () => { const from = (ffCur && ffCur.from) || 'applications'; ffCur = null; showScreen(from === 'formfill' ? 'applications' : from, { back: true }); });
  $('#btn-fill-print').addEventListener('click', () => window.print());
  $('#fill-handle').addEventListener('click', () => $('#fill-panel').classList.toggle('open'));
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => ffScale()).observe($('#fill-pages'));
  else window.addEventListener('resize', ffScale);
});
