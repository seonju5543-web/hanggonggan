/* ============================================================
   한대장 — 앱 로직 (매칭 엔진 · 화면 · 신청 준비 플로우)
   ============================================================ */

const STORAGE_KEY = 'handaejang.v1';
const LEGACY_KEYS = ['hanjang.v2', 'hanjang.v1'];
const TODAY = new Date();

/* ---------------- 상태 ---------------- */
let state = {
  profile: null,          // 온보딩 결과
  applications: [],       // { id, appliedAt, step, docs?, pending? }
};

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* 손상된 데이터는 무시 */ }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- 장학금 목록 (교외 공통 + 재학 대학 교내) ---------------- */
let campusCache = { key: null, list: [] };
function allScholarships() {
  const p = state.profile;
  if (!p || !p.school) return NATIONAL_SCHOLARSHIPS;
  const key = p.school + '|' + (p.campus || '');
  if (campusCache.key !== key) {
    campusCache = { key, list: buildCampusScholarships(p.school, p.campus) };
  }
  return NATIONAL_SCHOLARSHIPS.concat(campusCache.list);
}
function findSch(id) {
  return allScholarships().find((s) => s.id === id) || null;
}

/* ---------------- 매칭 엔진 ---------------- */
function evaluate(sch, p) {
  const e = sch.eligibility || {};
  const reasons = [];
  const missing = [];
  let ok = true;

  const gpaExempt = p.status === 'freshman';

  if (e.minGpa != null && !gpaExempt) {
    if (p.gpa == null) missing.push('직전학기 평점');
    else if (p.gpa < e.minGpa) { ok = false; reasons.push(`평점 ${e.minGpa} 이상 필요 (현재 ${p.gpa})`); }
    else reasons.push(`성적 요건 충족 (${e.minGpa} 이상)`);
  }

  if (e.maxBracket != null) {
    if (p.bracket == null) missing.push('학자금 지원구간');
    else if (p.bracket > e.maxBracket) { ok = false; reasons.push(`지원구간 ${e.maxBracket}구간 이내 필요 (현재 ${p.bracket}구간)`); }
    else reasons.push(`소득 요건 충족 (${e.maxBracket}구간 이내)`);
  }

  if (e.years && !e.years.includes(p.year)) {
    ok = false; reasons.push(`${e.years.join('·')}학년만 지원 가능`);
  }

  if (e.freshmanOnly && p.status !== 'freshman') {
    ok = false; reasons.push('신입학 첫 학기 학생만 지원 가능');
  }

  if (e.tracks && !e.tracks.includes(p.track)) {
    ok = false; reasons.push('지원 대상 전공 계열이 아니에요');
  } else if (e.tracks) {
    reasons.push('전공 계열 요건 충족');
  }

  if (e.flagsAny) {
    const has = e.flagsAny.some((f) => p.flags.includes(f));
    if (!has) { ok = false; reasons.push('해당 특별자격(수급자·다자녀·보훈 등)이 필요해요'); }
    else reasons.push('특별자격 요건 충족');
  }

  if (e.seoulOnly) {
    if (p.region !== 'seoul') { ok = false; reasons.push('서울 거주자만 지원 가능'); }
    else reasons.push('거주지 요건 충족 (서울)');
  }

  if (e.needCert) {
    if (!p.cert) { ok = false; reasons.push('공인 외국어성적 보유가 필요해요'); }
    else reasons.push('외국어성적 보유 확인');
  }

  if (e.exchange) {
    if (!p.exchange) { ok = false; reasons.push('교환학생 파견 예정자만 지원 가능'); }
    else reasons.push('교환학생 요건 충족');
  }

  if (!ok) return { status: 'ineligible', reasons, missing };
  if (missing.length) return { status: 'unknown', reasons, missing };
  if (e.selective) return { status: 'selective', reasons, missing };
  return { status: 'eligible', reasons, missing };
}

/* ---------------- 적합도 점수 (0~99) ---------------- */
function fitScore(sch, result, p) {
  if (result.status === 'ineligible') return 0;
  const e = sch.eligibility || {};
  let score = 62;
  const condCount = ['minGpa', 'maxBracket', 'years', 'tracks', 'flagsAny', 'seoulOnly', 'needCert', 'exchange', 'freshmanOnly']
    .filter((k) => e[k] != null && e[k] !== false).length;
  score += Math.min(15, condCount * 3);
  if (result.status === 'selective') score -= 8;
  if (result.status === 'unknown') score -= 22;
  if (e.minGpa != null && p.gpa != null) score += Math.min(12, Math.max(0, Math.round((p.gpa - e.minGpa) * 10)));
  if (e.maxBracket != null && p.bracket != null) score += Math.min(6, e.maxBracket - p.bracket);
  if (e.flagsAny) score += 6;
  return Math.max(5, Math.min(99, score));
}

function getMatches() {
  const p = state.profile;
  return allScholarships().map((s) => {
    const result = evaluate(s, p);
    return { sch: s, result, fit: fitScore(s, result, p) };
  });
}

/* ---------------- 유틸 ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function won(n) {
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

function dday(dateStr) {
  const d = Math.ceil((new Date(dateStr + 'T23:59:59') - TODAY) / 86400000);
  if (d < 0) return { label: '마감', cls: 'closed', days: d };
  if (d === 0) return { label: 'D-DAY', cls: 'urgent', days: d };
  if (d <= 7) return { label: `D-${d}`, cls: 'urgent', days: d };
  return { label: `D-${d}`, cls: '', days: d };
}

const STATUS_META = {
  eligible:   { label: '신청 가능',        cls: 'ok' },
  selective:  { label: '지원 가능 · 선발 심사', cls: 'sel' },
  unknown:    { label: '정보 입력 필요',     cls: 'unk' },
  ineligible: { label: '요건 미충족',       cls: 'no' },
};

const APP_STEPS = ['신청 준비 완료', '공식 제출', '심사', '선정 발표'];

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => (el.hidden = true), 250);
  }, 2600);
}

function countUp(el, target, formatter, duration = 900) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatter(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------------- 서류 보관함 (기기 내 저장 · 브라우저 내장 금고) ----------------
   파일은 서버로 전송되지 않고 사용자 기기 안에만 저장된다. */
let walletCache = {}; // slot -> { name, type, savedAt }

function dbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('handaejang-docs', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('files', { keyPath: 'slot' });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function walletTx(mode, fn) {
  return dbOpen().then((db) => new Promise((res, rej) => {
    const tx = db.transaction('files', mode);
    const out = fn(tx.objectStore('files'));
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = () => rej(tx.error);
  }));
}
async function walletPut(slot, file) {
  await walletTx('readwrite', (st) => st.put({
    slot, name: file.name, type: file.type, blob: file, savedAt: nowStamp(),
  }));
  await walletRefresh();
}
function walletGetRec(slot) {
  return walletTx('readonly', (st) => st.get(slot));
}
async function walletDeleteSlot(slot) {
  await walletTx('readwrite', (st) => st.delete(slot));
  await walletRefresh();
}
async function walletRefresh() {
  try {
    const all = await walletTx('readonly', (st) => st.getAll());
    walletCache = {};
    (all || []).forEach((r) => { walletCache[r.slot] = { name: r.name, type: r.type, savedAt: r.savedAt }; });
  } catch (e) { walletCache = {}; }
}

/* 요구 서류의 보관함 상태 한 줄 */
function docWalletStatus(doc) {
  const s = slotForDoc(doc);
  if (!s) return null;
  const rec = walletCache[s.slot];
  return rec
    ? { ok: true, slot: s, text: `보관함에서 자동 첨부 ✓ (${rec.name})` }
    : { ok: false, slot: s, text: `보관함에 없음 · 발급처: ${s.issue}` };
}

/* ---------------- 자동추천 (autocomplete) ---------------- */
function attachAutocomplete(input, getItems) {
  const list = input.parentElement.querySelector('.ac-list');
  let items = [];
  const close = () => { list.hidden = true; };
  const render = () => {
    items = getItems(input.value.trim()).slice(0, 6);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((it, i) =>
      `<button type="button" class="ac-item" data-i="${i}">${esc(it)}</button>`).join('');
    list.hidden = false;
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  // mousedown/touchstart는 blur보다 먼저 발생 → 클릭이 씹히지 않음
  ['mousedown', 'touchstart'].forEach((ev) =>
    list.addEventListener(ev, (e) => {
      const b = e.target.closest('.ac-item');
      if (!b) return;
      e.preventDefault();
      input.value = items[Number(b.dataset.i)];
      close();
      input.dispatchEvent(new Event('change'));
    })
  );
  input.addEventListener('blur', () => setTimeout(close, 150));
}

function schoolSuggestions(q) {
  const n = q.replace(/\s/g, '');
  if (!n) return [];
  const set = new Set();
  UNIVERSITIES.forEach((u) => {
    if (u.replace(/\s/g, '').includes(n) || u.toLowerCase().includes(n.toLowerCase())) set.add(u);
  });
  Object.entries(UNIV_ALIASES).forEach(([alias, full]) => {
    if (alias.includes(n) || n.includes(alias)) set.add(full);
  });
  return Array.from(set).sort((a, b) => (b.startsWith(n) ? 1 : 0) - (a.startsWith(n) ? 1 : 0));
}

function majorSuggestions(q) {
  const n = q.replace(/\s/g, '');
  if (!n) return [];
  const school = $('#in-school').value.trim();
  const pool = [...new Set((MAJORS_BY_SCHOOL[school] || []).concat(MAJORS_COMMON))];
  return pool.filter((m) => m.replace(/\s/g, '').includes(n));
}

/* ---------------- 화면 전환 ---------------- */
function showScreen(name) {
  ['onboarding', 'home', 'explore', 'applications', 'my'].forEach((n) => {
    $(`#screen-${n}`).hidden = n !== name;
  });
  $('#bottom-nav').hidden = name === 'onboarding';
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
  window.scrollTo(0, 0);

  if (name === 'home') renderHome();
  if (name === 'explore') renderExplore();
  if (name === 'applications') renderApplications();
  if (name === 'my') renderMy();
}

/* ---------------- 온보딩 ---------------- */
let onboardStep = 0;
const ONBOARD_STEPS = 5;

function renderOnboardStep() {
  $$('.onboard-step').forEach((el) => (el.hidden = Number(el.dataset.step) !== onboardStep));
  $('#onboard-bar').style.width = `${((onboardStep + 1) / ONBOARD_STEPS) * 100}%`;
  window.scrollTo(0, 0);
}

function initOnboarding() {
  $('#in-track').innerHTML = TRACKS.map(
    (t) => `<button class="chip" data-value="${t.id}">${t.label}</button>`
  ).join('');

  const p = state.profile;
  if (p) {
    const c = p.common || {};
    $('#in-name').value = p.name || '';
    $('#in-school').value = p.school || '';
    $('#in-major').value = p.major || '';
    $('#in-gpa').value = p.gpa != null ? p.gpa : '';
    $('#in-bracket').value = p.bracket != null ? String(p.bracket) : '';
    $('#in-cert').checked = !!p.cert;
    $('#in-exchange').checked = !!p.exchange;
    $('#in-sid').value = c.studentId || '';
    $('#in-birth').value = c.birth || '';
    $('#in-phone').value = c.phone || '';
    $('#in-email').value = c.email || '';
    $('#in-bank').value = c.bank || '';
    $('#in-account').value = c.account || '';
    setChip('#in-track', p.track);
    setChip('#in-year', String(p.year));
    setChip('#in-status', p.status);
    setChip('#in-region', p.region);
    $$('#in-flags input').forEach((cb) => (cb.checked = p.flags.includes(cb.value)));
  } else {
    setChip('#in-track', 'humanities');
    setChip('#in-year', '1');
    setChip('#in-status', 'enrolled');
    setChip('#in-region', 'seoul');
  }

  renderCampusChips(p ? p.campus : null);

  onboardStep = p ? 1 : 0;
  renderOnboardStep();
}

/* 학교에 캠퍼스가 있으면 캠퍼스 선택을 보여준다.
   같은 학교에서 반복 호출되면(포커스 이동으로 인한 change 등) 기존 선택을 유지한다. */
let campusChipsSchool = null;
function renderCampusChips(selected) {
  const school = $('#in-school').value.trim();
  if (selected == null && school === campusChipsSchool) return;
  campusChipsSchool = school;
  const campuses = CAMPUSES_BY_SCHOOL[school];
  const field = $('#campus-field');
  if (!campuses) { field.hidden = true; $('#in-campus').innerHTML = ''; return; }
  field.hidden = false;
  $('#in-campus').innerHTML = campuses.map((c, i) =>
    `<button class="chip ${(selected ? c === selected : i === 0) ? 'active' : ''}" data-value="${esc(c)}">${esc(c)}</button>`
  ).join('');
}

function setChip(groupSel, value) {
  $$(groupSel + ' .chip').forEach((c) => c.classList.toggle('active', c.dataset.value === value));
}
function getChip(groupSel) {
  const el = $(groupSel + ' .chip.active');
  return el ? el.dataset.value : null;
}

function collectProfile() {
  const gpaRaw = $('#in-gpa').value.trim();
  const gpa = gpaRaw === '' ? null : Math.min(4.5, Math.max(0, parseFloat(gpaRaw)));
  const bracketRaw = $('#in-bracket').value;
  return {
    name: $('#in-name').value.trim(),
    school: $('#in-school').value.trim(),
    track: getChip('#in-track'),
    major: $('#in-major').value.trim(),
    year: Number(getChip('#in-year')),
    status: getChip('#in-status'),
    gpa: Number.isNaN(gpa) ? null : gpa,
    bracket: bracketRaw === '' ? null : Number(bracketRaw),
    campus: $('#campus-field').hidden ? '' : (getChip('#in-campus') || ''),
    region: getChip('#in-region'),
    flags: $$('#in-flags input:checked').map((c) => c.value),
    cert: $('#in-cert').checked,
    exchange: $('#in-exchange').checked,
    common: {
      studentId: $('#in-sid').value.trim(),
      birth: $('#in-birth').value.trim(),
      phone: $('#in-phone').value.trim(),
      email: $('#in-email').value.trim(),
      bank: $('#in-bank').value.trim(),
      account: $('#in-account').value.trim(),
    },
  };
}

/* ---------------- 카드 렌더링 ---------------- */
function schCard(sch, result, { compact = false, fit = 0 } = {}) {
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const applied = state.applications.some((a) => a.id === sch.id);
  return `
    <button class="sch-card" data-detail="${sch.id}">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        <span class="badge badge-dday ${d.cls}">${d.label}</span>
        ${applied ? '<span class="badge badge-applied">신청함</span>' : ''}
        ${fit > 0 ? `<span class="badge badge-fit">적합도 ${fit}%</span>` : ''}
      </div>
      <p class="sch-name">${sch.name}</p>
      <p class="sch-amount">${sch.amount}</p>
      ${compact ? '' : `<p class="sch-provider">${sch.provider}</p>`}
      <span class="status-pill pill-${meta.cls}">${meta.label}</span>
    </button>`;
}

/* ---------------- 홈 ---------------- */
function renderHome() {
  const p = state.profile;
  $('#home-greet').textContent = p.name ? `${p.name}님, 안녕하세요!` : '안녕하세요!';
  $('#home-school').textContent = (p.school || '대학 미설정') + (p.campus ? ' · ' + p.campus : '');
  $('#home-avatar').textContent = (p.name || '학').charAt(0);

  const matches = getMatches();
  const applyable = matches.filter((m) => ['eligible', 'selective'].includes(m.result.status));
  const notApplied = applyable.filter((m) => !state.applications.some((a) => a.id === m.sch.id) && dday(m.sch.deadline).days >= 0);
  const total = applyable.reduce((sum, m) => sum + m.sch.amountValue, 0);

  countUp($('#hero-amount'), total, (v) => `최대 ${won(v)}`);
  $('#hero-count').textContent = `신청 가능 ${applyable.filter((m) => m.result.status === 'eligible').length}건 · 선발 심사 ${applyable.filter((m) => m.result.status === 'selective').length}건`;

  const btn = $('#btn-apply-all');
  btn.disabled = notApplied.length === 0;
  btn.textContent = notApplied.length ? `⚡ ${notApplied.length}건 한 번에 신청 준비하기` : '✓ 가능한 장학금을 모두 준비했어요';

  const upcoming = applyable
    .filter((m) => dday(m.sch.deadline).days >= 0)
    .sort((a, b) => new Date(a.sch.deadline) - new Date(b.sch.deadline))
    .slice(0, 3);
  $('#home-deadline-list').innerHTML = upcoming.length
    ? upcoming.map((m) => schCard(m.sch, m.result, { compact: true, fit: m.fit })).join('')
    : '<p class="empty">지금 신청 가능한 장학금이 없어요. 프로필을 업데이트해 보세요.</p>';

  const recent = state.applications.slice(-2).reverse().filter((a) => findSch(a.id));
  $('#home-apps').innerHTML = recent.length
    ? recent.map(appCard).join('')
    : '<p class="empty">아직 준비한 장학금이 없어요.</p>';
}

/* ---------------- 탐색 ---------------- */
let exploreFilter = 'all';

function renderExplore() {
  const matches = getMatches();
  const order = { eligible: 0, selective: 0, unknown: 1, ineligible: 2 };
  let list = matches.slice().sort((a, b) =>
    order[a.result.status] - order[b.result.status] ||
    b.fit - a.fit ||
    new Date(a.sch.deadline) - new Date(b.sch.deadline)
  );

  if (exploreFilter === '교내' || exploreFilter === '교외') list = list.filter((m) => m.sch.type === exploreFilter);
  if (exploreFilter === 'eligible') list = list.filter((m) => ['eligible', 'selective'].includes(m.result.status));

  $('#live-notices').innerHTML = exploreFilter === 'all' ? liveNoticesHtml() : '';
  $('#explore-list').innerHTML = list.length
    ? list.map((m) => schCard(m.sch, m.result, { fit: m.fit })).join('')
    : '<p class="empty">조건에 맞는 장학금이 없어요.</p>';
}

/* ---------------- 서류 도우미 (AI 초안 작성) ---------------- */
const ESSAY_DEFS = [
  {
    kind: 'intro', match: /자기소개서/,
    questions: [
      { id: 'motive', label: '지원 동기', options: [
        '등록금 부담을 덜고 학업에 온전히 집중하고 싶어요',
        '가계에 보탬이 되고 있어 장학 지원이 절실해요',
        '전공 심화와 진로 준비에 필요한 비용을 마련하고 싶어요',
      ] },
      { id: 'strength', label: '나의 강점', options: [
        '성실함과 꾸준한 성적 관리',
        '전공 역량과 프로젝트 경험',
        '대외활동과 리더십 경험',
        '외국어 실력과 글로벌 역량',
      ] },
    ],
  },
  {
    kind: 'plan', match: /(학업계획서|수학계획서|연구계획서)/,
    questions: [
      { id: 'goal', label: '이번 학기 목표', options: [
        '전공 심화 과목을 집중 이수할 계획이에요',
        '어학 성적과 자격증을 취득할 계획이에요',
        '연구·프로젝트에 참여할 계획이에요',
        '교환학생·대외활동을 준비하고 있어요',
      ] },
      { id: 'career', label: '진로 방향', options: [
        '전공 분야 취업', '대학원 진학', '전문직·공공 분야 준비', '창업',
      ] },
    ],
  },
  {
    kind: 'need', match: /사유서/,
    questions: [
      { id: 'situation', label: '가계 상황', options: [
        '가계 소득이 줄어 등록금 마련이 어려워요',
        '부양가족이 많아 지원이 필요해요',
        '예상치 못한 지출(의료비 등)이 생겼어요',
      ] },
      { id: 'use', label: '장학금 사용 계획', options: [
        '등록금 납부', '주거·생활비', '교재·학습비',
      ] },
    ],
  },
];

function essayDefsFor(sch) {
  return sch.documents
    .filter((doc) => !/자동/.test(doc))
    .map((doc) => {
      const def = ESSAY_DEFS.find((e) => e.match.test(doc));
      return def ? { doc: doc.replace(/\s*\(.*\)$/, ''), ...def } : null;
    })
    .filter(Boolean);
}
function otherManualDocs(sch) {
  return sch.documents.filter((doc) => !/자동/.test(doc) && !ESSAY_DEFS.some((e) => e.match.test(doc)));
}
function autoDocs(sch) {
  return sch.documents.filter((doc) => /자동/.test(doc));
}

/* 증명서류(작성형 제외)의 보관함 상태 목록 HTML */
function certStatusListHtml(sch) {
  const certDocs = sch.documents.filter((doc) => !ESSAY_DEFS.some((e) => e.match.test(doc)));
  if (!certDocs.length) return '';
  const rows = certDocs.map((doc) => {
    const st = docWalletStatus(doc);
    const name = doc.replace(/\s*\(.*\)$/, '');
    if (st && st.ok) return `<li class="doc-ok">✓ ${name} — ${st.text}</li>`;
    if (st) return `<li class="doc-miss">□ ${name} — ${st.text}</li>`;
    if (/자동/.test(doc)) return `<li>△ ${name} — 학교·재단 연동 후 자동 첨부 (또는 보관함에 올려두세요)</li>`;
    return `<li>□ ${doc} — 공식 제출 시 함께 준비하세요</li>`;
  }).join('');
  return `<h4>증명서류 체크리스트</h4><ul class="doc-list">${rows}</ul>
    <p class="dp-note">보관함(MY 탭)에 올려둔 서류는 다음 신청부터 자동으로 함께 준비돼요.</p>`;
}

function personLine(p) {
  const c = p.common || {};
  const bits = [p.school, p.major, `${p.year}학년`, p.name].filter(Boolean).join(' ');
  const extra = [c.studentId && `학번 ${c.studentId}`, c.phone && `연락처 ${c.phone}`, c.email].filter(Boolean).join(' · ');
  return bits + (extra ? `\n${extra}` : '');
}

function generateEssay(def, sch, p, ans, extra) {
  const gpaTxt = p.gpa != null ? `직전 학기 평점 ${p.gpa}/4.5` : '';
  const trackLabel = (TRACKS.find((t) => t.id === p.track) || {}).label || '';
  const paras = [`[인적사항]\n${personLine(p)}`];

  if (def.kind === 'intro') {
    paras.push(
      `[지원 동기]\n안녕하세요. ${p.school} ${p.major || trackLabel} ${p.year}학년 ${p.name || '지원자'}입니다. ${sch.provider}의 '${sch.name}'에 지원합니다. ${ans.motive}. ${gpaTxt ? gpaTxt + '을 유지하며 학업에 성실히 임해 왔고, 이 장학금은 제가 흔들림 없이 공부를 이어가는 데 큰 힘이 될 것입니다.' : ''}`,
      `[나의 강점]\n저의 강점은 ${ans.strength}입니다. 전공 공부와 병행하며 쌓아 온 이 경험은 장학생으로서의 책임을 다하는 밑거름이 될 것이라 확신합니다.`,
      `[마무리]\n선발해 주신다면 학업 성취로 보답하고, 받은 도움을 후배들에게 돌려주는 선순환의 일원이 되겠습니다. 감사합니다.`
    );
  } else if (def.kind === 'plan') {
    paras.push(
      `[학업 계획]\n${sch.period} 동안 ${ans.goal}. ${gpaTxt ? '현재 ' + gpaTxt + '을 바탕으로 학점 관리도 병행하겠습니다.' : ''}`,
      `[진로 계획]\n중장기적으로는 ${ans.career}을(를) 목표로 하고 있습니다. 이번 학기의 계획은 그 목표로 가는 구체적인 발판입니다.`,
      `[장학금 활용]\n지원받는 장학금은 학업 관련 비용에 우선 사용하여 계획 실행에 온전히 집중하겠습니다.`
    );
  } else if (def.kind === 'need') {
    paras.push(
      `[가계 상황]\n${ans.situation}. ${p.bracket != null ? `한국장학재단 학자금 지원구간 ${p.bracket}구간에 해당합니다.` : ''}`,
      `[사용 계획]\n장학금을 지원받게 되면 ${ans.use}에 사용하여 학업을 중단 없이 이어가고자 합니다.`,
      `[다짐]\n어려운 여건 속에서도 학업을 포기하지 않도록 도와주시면, 성실한 결과로 보답하겠습니다.`
    );
  }
  if (extra) paras.push(`[추가 내용]\n${extra}`);
  return paras.join('\n\n');
}

/* ---------------- 서류 준비 플로우 (질문 → 초안 → 확인) ---------------- */
let docPrep = null; // { schId, defs, stage }

function startDocPrep(sch) {
  docPrep = { schId: sch.id, defs: essayDefsFor(sch), stage: 'questions' };
  renderDocPrep();
}

function renderDocPrep() {
  const sch = findSch(docPrep.schId);
  const sheet = $('#detail-sheet');

  if (docPrep.stage === 'questions') {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">서류 작성 도우미</h3>
        <p class="sheet-provider">${sch.name} · 답을 선택하면 AI가 초안을 만들어드려요</p>
        ${docPrep.defs.map((def, di) => `
          <div class="dp-block">
            <h4>${def.doc}</h4>
            ${def.questions.map((q) => `
              <div class="field">
                <span class="field-label">${q.label}</span>
                <div class="chip-group dp-q" data-def="${di}" data-q="${q.id}">
                  ${q.options.map((o, oi) => `<button class="chip ${oi === 0 ? 'active' : ''}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
                </div>
              </div>`).join('')}
            <label class="field">
              <span class="field-label">직접 추가할 내용 (선택)</span>
              <textarea class="dp-extra" data-def="${di}" rows="2" placeholder="넣고 싶은 문장을 자유롭게 적어주세요"></textarea>
            </label>
          </div>`).join('')}
        <button class="btn btn-primary btn-lg" id="btn-dp-generate">AI 초안 만들기</button>
      </div>`;

    $('#btn-dp-generate').addEventListener('click', () => {
      const p = state.profile;
      docPrep.texts = docPrep.defs.map((def, di) => {
        const ans = {};
        def.questions.forEach((q) => {
          const chip = $(`.dp-q[data-def="${di}"][data-q="${q.id}"] .chip.active`);
          ans[q.id] = chip ? chip.dataset.value : q.options[0];
        });
        const extra = ($(`.dp-extra[data-def="${di}"]`) || { value: '' }).value.trim();
        return { doc: def.doc, text: generateEssay(def, sch, p, ans, extra) };
      });
      docPrep.stage = 'preview';
      renderDocPrep();
    });
  } else {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">이대로 제출 준비할까요?</h3>
        <p class="sheet-provider">${sch.name} · 내용을 자유롭게 수정할 수 있어요</p>
        ${docPrep.texts.map((t, i) => `
          <div class="dp-block">
            <h4>${t.doc}</h4>
            <textarea class="dp-text" data-i="${i}" rows="10">${esc(t.text)}</textarea>
          </div>`).join('')}
        ${certStatusListHtml(sch)}
        <button class="btn btn-primary btn-lg" id="btn-dp-confirm">✓ 이대로 신청 준비 완료</button>
        <p class="dp-note">완료하면 작성한 서류가 저장되고, 최종 제출처를 안내해 드려요.</p>
      </div>`;

    $$('.dp-text').forEach((ta) =>
      ta.addEventListener('input', () => { docPrep.texts[Number(ta.dataset.i)].text = ta.value; })
    );
    $('#btn-dp-confirm').addEventListener('click', () => {
      finalizeApply(sch, docPrep.texts);
      docPrep = null;
      closeSheet();
    });
  }
  sheet.scrollTop = 0;
}

/* ---------------- 실제 양식 채움 플로우 ---------------- */
let formFill = null; // { schId, stage:'q'|'preview', ans }

function startFormFill(sch) {
  formFill = { schId: sch.id, stage: 'q', ans: null };
  renderFormFill();
}

function renderFormFill() {
  const sch = findSch(formFill.schId);
  const tpl = FORM_TEMPLATES[sch.formId];
  const sheet = $('#detail-sheet');

  if (formFill.stage === 'q') {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">양식 작성 도우미</h3>
        <p class="sheet-provider">${esc(tpl.title)} · 실제 공고 양식과 동일한 문서가 만들어져요</p>
        ${formQuestionsHtml(tpl)}
        <button class="btn btn-primary btn-lg" id="btn-ff-generate">양식 문서 만들기</button>
        <p class="dp-note">기본정보(학교·이름·학번·연락처)는 프로필에서 자동으로 채워져요.</p>
      </div>`;
    $('#btn-ff-generate').addEventListener('click', () => {
      formFill.ans = collectFormAnswers(tpl);
      formFill.stage = 'preview';
      renderFormFill();
    });
  } else {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">이대로 제출 준비할까요?</h3>
        <p class="sheet-provider">칸을 눌러 직접 수정할 수 있어요 · 실제 공고 양식과 동일한 구조</p>
        <div class="fd-wrap" id="ff-doc">${renderFormDoc(tpl, state.profile, formFill.ans, { editable: true })}</div>
        <button class="btn btn-primary btn-lg" id="btn-ff-confirm">✓ 이대로 신청 준비 완료</button>
        <div class="submit-actions" style="margin-top:8px">
          <button class="btn btn-outline" id="btn-ff-back">← 질문 다시</button>
          <button class="btn btn-outline" id="btn-ff-doc">📄 .doc 저장</button>
        </div>
      </div>`;
    $('#btn-ff-back').addEventListener('click', () => { formFill.stage = 'q'; renderFormFill(); });
    $('#btn-ff-doc').addEventListener('click', () => downloadFormDoc(tpl, state.profile, formFill.ans));
    $('#btn-ff-confirm').addEventListener('click', () => {
      const existing = state.applications.find((a) => a.id === sch.id);
      if (existing) { existing.pending = false; existing.formAns = formFill.ans; existing.appliedAt = nowStamp(); }
      else state.applications.push({ id: sch.id, appliedAt: nowStamp(), step: 0, formAns: formFill.ans, pending: false });
      saveState();
      const ch = officialChannel(sch);
      toast(`양식 작성 완료! 문서를 저장해 ${ch.label}에 제출하세요`);
      formFill = null;
      closeSheet();
      const current = $$('.screen').find((s) => !s.hidden);
      if (current) showScreen(current.id.replace('screen-', ''));
    });
    sheet.scrollTop = 0;
  }
}

/* ---------------- 실시간 공고 (수집 로봇 발행) ---------------- */
let liveNotices = null;
function loadNotices() {
  fetch('data/notices.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      liveNotices = d;
      if (!$('#screen-explore').hidden) renderExplore();
    })
    .catch(() => { /* 오프라인 등 — 조용히 무시 */ });
}

function liveNoticesHtml() {
  const p = state.profile;
  if (!liveNotices || !p) return '';
  const mine = (liveNotices.items || []).filter((n) =>
    n.school === p.school && (!n.campus || !p.campus || n.campus === p.campus)
  ).slice(0, 10);
  const head = `<div class="section-head" style="margin-top:4px"><h3>우리 학교 실시간 공고</h3>
    <span class="link-btn">매일 아침 자동 갱신${liveNotices.updatedAt ? ' · ' + liveNotices.updatedAt : ''}</span></div>`;
  if (!mine.length) {
    return head + `<p class="empty" style="margin-bottom:16px">아직 ${esc(p.school)} 게시판이 연결 전이거나 새 공고가 없어요.<br />연결되면 실제 공고가 여기에 자동으로 떠요.</p>`;
  }
  return head + `<div class="card-list" style="margin-bottom:18px">` + mine.map((n) => `
    <a class="sch-card notice-card" href="${esc(n.url)}" target="_blank" rel="noopener">
      <div class="sch-top">
        <span class="badge badge-in">교내 공고</span>
        ${n.deadlineHint ? `<span class="badge badge-dday urgent">⏰</span>` : ''}
        ${(n.attachments || []).length ? `<span class="badge badge-applied">양식 ${n.attachments.length}</span>` : ''}
      </div>
      <p class="sch-name">${esc(n.title)}</p>
      ${n.deadlineHint ? `<p class="sch-provider">${esc(n.deadlineHint)}</p>` : ''}
      <p class="sch-provider">${esc(n.school)}${n.campus ? ' ' + esc(n.campus) : ''} · ${esc(n.foundAt || '')} 수집 · 원문 보기 ↗</p>
    </a>`).join('') + `</div>`;
}

/* ---------------- 제출: 복사 · 파일 공유 ---------------- */
function buildSubmissionText(sch, app) {
  const p = state.profile;
  const parts = [`[${sch.name} 지원서류]`, personLine(p)];
  if (app && app.docs) app.docs.forEach((t) => parts.push(`\n■ ${t.doc}\n${t.text}`));
  return parts.join('\n');
}

function copyText(text, okMsg) {
  const done = () => toast(okMsg || '복사했어요. 공식 신청 페이지에 붙여넣으세요');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('복사에 실패했어요'); }
  ta.remove();
}

async function shareApplication(sch, app) {
  const text = buildSubmissionText(sch, app);
  const files = [];
  for (const doc of sch.documents) {
    const s = slotForDoc(doc);
    if (!s) continue;
    const rec = await walletGetRec(s.slot);
    if (rec && rec.blob) files.push(new File([rec.blob], rec.name, { type: rec.type }));
  }
  try {
    if (files.length && navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ title: `${sch.name} 신청 서류`, text, files });
      toast('서류와 함께 공유했어요 (메일 앱에서 바로 접수 가능)');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `${sch.name} 신청 서류`, text });
      toast('내용을 공유했어요. 파일은 보관함에서 따로 첨부하세요');
      return;
    }
  } catch (e) { /* 사용자가 공유를 취소한 경우 */ return; }
  copyText(text);
}

/* ---------------- 신청 준비 ---------------- */
function nowStamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function finalizeApply(sch, docs) {
  const existing = state.applications.find((a) => a.id === sch.id);
  if (existing) {
    existing.pending = false;
    existing.docs = docs;
    existing.appliedAt = nowStamp();
  } else {
    state.applications.push({ id: sch.id, appliedAt: nowStamp(), step: 0, docs, pending: false });
  }
  saveState();
  const ch = officialChannel(sch);
  toast(`'${sch.name}' 신청 준비 완료! 최종 제출은 ${ch.label}에서 확인하세요`);
  const current = $$('.screen').find((s) => !s.hidden);
  if (current) showScreen(current.id.replace('screen-', ''));
}

function applyTo(sch) {
  if (sch.formId && typeof FORM_TEMPLATES !== 'undefined' && FORM_TEMPLATES[sch.formId]) {
    startFormFill(sch);
    return;
  }
  if (essayDefsFor(sch).length) {
    startDocPrep(sch);
    return;
  }
  finalizeApply(sch, null);
  closeSheet();
}

function applyAll() {
  const matches = getMatches();
  const targets = matches
    .filter((m) => ['eligible', 'selective'].includes(m.result.status))
    .filter((m) => !state.applications.some((a) => a.id === m.sch.id))
    .filter((m) => dday(m.sch.deadline).days >= 0)
    .map((m) => m.sch);
  if (!targets.length) { toast('준비할 수 있는 장학금이 없어요'); return; }

  const needsWork = (s) => essayDefsFor(s).length || (s.formId && typeof FORM_TEMPLATES !== 'undefined' && FORM_TEMPLATES[s.formId]);
  const ready = targets.filter((s) => !needsWork(s));
  const needsDocs = targets.filter(needsWork);

  const ok = confirm(
    `아래 ${targets.length}건을 한 번에 신청 준비할까요?\n\n` +
    targets.map((s) => `· [${s.type}] ${s.name}${needsWork(s) ? ' (서류 작성 필요)' : ''}`).join('\n') +
    `\n\n${ready.length}건은 바로 준비되고, ${needsDocs.length}건은 서류 작성 도우미로 이어서 완성할 수 있어요.` +
    '\n※ 최종 제출은 한국장학재단·학교 등 공식 채널에서 이루어져요.'
  );
  if (!ok) return;

  ready.forEach((s) => state.applications.push({ id: s.id, appliedAt: nowStamp(), step: 0, docs: null, pending: false }));
  needsDocs.forEach((s) => state.applications.push({ id: s.id, appliedAt: nowStamp(), step: 0, docs: null, pending: true }));
  saveState();
  toast(needsDocs.length
    ? `${ready.length}건 준비 완료 · ${needsDocs.length}건은 신청내역에서 서류를 작성해 주세요`
    : `장학금 ${ready.length}건 신청 준비가 완료됐어요 🎉`);
  const current = $$('.screen').find((s) => !s.hidden);
  if (current) showScreen(current.id.replace('screen-', ''));
}

/* ---------------- 상세 바텀시트 ---------------- */
function openDetail(id) {
  const sch = findSch(id);
  if (!sch) return;
  const result = evaluate(sch, state.profile);
  const fit = fitScore(sch, result, state.profile);
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const app = state.applications.find((a) => a.id === id);
  const canApply = ['eligible', 'selective'].includes(result.status) && (!app || app.pending) && d.days >= 0;
  const ch = officialChannel(sch);

  const reasonRows = result.reasons.map((r) => {
    const bad = /필요|아니에요|가능$/.test(r) && !/충족|확인/.test(r);
    return `<li class="${bad ? 'r-bad' : 'r-ok'}">${bad ? '✕' : '✓'} ${r}</li>`;
  }).join('');
  const missingRows = result.missing.map((m) => `<li class="r-unk">? ${m} 정보를 입력하면 정확히 판단할 수 있어요</li>`).join('');

  let btnLabel = '⚡ 원클릭 신청 준비하기';
  if (app && !app.pending) btnLabel = '✓ 신청 준비 완료됨';
  else if (app && app.pending) btnLabel = '📝 서류 작성하고 준비 완료하기';
  else if (d.days < 0) btnLabel = '마감된 장학금이에요';
  else if (!canApply) btnLabel = '요건 미충족으로 신청할 수 없어요';

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        <span class="badge badge-dday ${d.cls}">${d.label}</span>
        ${fit > 0 ? `<span class="badge badge-fit">적합도 ${fit}%</span>` : ''}
        <span class="status-pill pill-${meta.cls}">${meta.label}</span>
      </div>
      <h3 class="sheet-title">${sch.name}</h3>
      <p class="sheet-provider">${sch.provider} · ${sch.period}</p>
      <p class="sheet-amount">${sch.amount}</p>
      <p class="sheet-summary">${sch.summary}</p>

      <h4>자격 진단</h4>
      <ul class="reason-list">${reasonRows}${missingRows || ''}</ul>

      <h4>제출 서류</h4>
      <ul class="doc-list">
        ${sch.documents.map((doc) => {
          const auto = /자동/.test(doc);
          return `<li>${auto ? '<span class="doc-auto">자동</span>' : '<span class="doc-manual">직접</span>'} ${doc}</li>`;
        }).join('')}
      </ul>
      <p class="doc-legend">'자동' 서류는 학교·재단 연동 후 자동 첨부되는 항목이에요 (현재 시연 단계 — 실제 발급·제출 전).
      '직접' 서류 중 자기소개서·계획서·사유서는 아래 도우미로 앱에서 바로 작성할 수 있어요.</p>

      <p class="sheet-note">💡 ${sch.note}</p>
      <p class="sheet-deadline">마감일 ${sch.deadline} · ${sch.duplicable ? '타 장학금과 중복 수혜 가능' : '중복 수혜 제한 있음'}${sch.sourceUrl ? ` · <a href="${sch.sourceUrl}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:700">원문 공고 ↗</a>` : ''}</p>

      ${app && !app.pending ? `
        <div class="app-progress">
          ${APP_STEPS.map((s, i) => `
            <div class="ap-step ${i <= app.step ? 'done' : ''}">
              <span class="ap-dot"></span><span class="ap-label">${s}</span>
            </div>`).join('')}
        </div>
        <p class="applied-at">${app.appliedAt} 준비 완료 · 최종 제출처: ${ch.url ? `<a href="${ch.url}" target="_blank" rel="noopener">${ch.label}</a>` : ch.label}</p>
        ${app.docs && app.docs.length ? `
          <details class="dp-saved"><summary>작성한 서류 보기 (${app.docs.length})</summary>
            ${app.docs.map((t) => `<h4>${esc(t.doc)}</h4><pre>${esc(t.text)}</pre>`).join('')}
          </details>` : ''}
        ${app.formAns && sch.formId ? `
          <h4>작성한 양식 문서</h4>
          <div class="submit-actions">
            <button class="btn btn-outline" id="btn-form-save">📄 .doc 저장</button>
            <button class="btn btn-outline" id="btn-form-print">🖨 인쇄/PDF</button>
            <button class="btn btn-outline" id="btn-form-share">📤 공유</button>
          </div>
          <button class="btn btn-outline" id="btn-form-edit" style="width:100%;margin-bottom:14px">✏️ 양식 다시 작성</button>` : ''}
        ${certStatusListHtml(sch)}
        <h4>최종 제출 방법</h4>
        <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
        <div class="submit-actions">
          <button class="btn btn-outline" id="btn-copy-docs">📋 서류 내용 복사</button>
          <button class="btn btn-outline" id="btn-share-docs">📤 파일과 함께 공유</button>
        </div>
        ${sch.applyEmail ? `<button class="btn btn-primary btn-lg" id="btn-mail-apply" style="margin-bottom:14px">📧 접수 메일 열기 (내용 자동 완성)</button>` : ''}` : ''}

      <button class="btn btn-primary btn-lg" id="btn-apply-one" ${canApply ? '' : 'disabled'}>${btnLabel}</button>
      ${canApply ? `<p class="dp-note">준비 완료 후 최종 제출처(${ch.label})를 안내해 드려요.</p>` : ''}
    </div>`;

  $('#sheet-backdrop').hidden = false;
  const sheet = $('#detail-sheet');
  sheet.hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
  });

  if (canApply) {
    $('#btn-apply-one').addEventListener('click', () => applyTo(sch));
  }
  if (app && app.formAns && sch.formId) {
    const tpl = FORM_TEMPLATES[sch.formId];
    $('#btn-form-save').addEventListener('click', () => downloadFormDoc(tpl, state.profile, app.formAns));
    $('#btn-form-print').addEventListener('click', () => printFormDoc(tpl, state.profile, app.formAns));
    $('#btn-form-share').addEventListener('click', () => shareFormDoc(tpl, state.profile, app.formAns, sch));
    $('#btn-form-edit').addEventListener('click', () => { startFormFill(sch); formFill.ans = app.formAns; formFill.stage = 'preview'; renderFormFill(); });
  }
  const copyBtn = $('#btn-copy-docs');
  if (copyBtn) copyBtn.addEventListener('click', () => copyText(buildSubmissionText(sch, app)));
  const shareBtn = $('#btn-share-docs');
  if (shareBtn) shareBtn.addEventListener('click', () => shareApplication(sch, app));
  const mailBtn = $('#btn-mail-apply');
  if (mailBtn) mailBtn.addEventListener('click', () => {
    const p = state.profile;
    const subject = `[장학금 신청] ${sch.name} - ${p.school} ${p.name || ''}`;
    const body = buildSubmissionText(sch, app) + '\n\n(첨부: 앱 보관함의 증명서류와 작성한 양식 문서를 함께 첨부해 주세요)';
    location.href = `mailto:${sch.applyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

function closeSheet() {
  docPrep = null;
  $('#sheet-backdrop').classList.remove('show');
  $('#detail-sheet').classList.remove('show');
  setTimeout(() => {
    $('#sheet-backdrop').hidden = true;
    $('#detail-sheet').hidden = true;
  }, 250);
}

/* ---------------- 신청 내역 ---------------- */
function appCard(app) {
  const sch = findSch(app.id);
  if (!sch) return '';
  const statusBadge = app.pending
    ? '<span class="badge badge-pending">서류 작성 필요</span>'
    : `<span class="badge badge-applied">${APP_STEPS[app.step]}</span>`;
  return `
    <button class="sch-card" data-detail="${sch.id}">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        ${statusBadge}
      </div>
      <p class="sch-name">${sch.name}</p>
      <p class="sch-provider">${app.appliedAt} ${app.pending ? '담아둠' : '준비 완료'} · 제출처 ${officialChannel(sch).label}</p>
      <div class="mini-progress"><div style="width:${app.pending ? 6 : ((app.step + 1) / APP_STEPS.length) * 100}%"></div></div>
    </button>`;
}

function renderApplications() {
  const apps = state.applications.slice().reverse().filter((a) => findSch(a.id));
  const prepared = apps.filter((a) => !a.pending);
  const pending = apps.filter((a) => a.pending);
  const totalExpected = apps.reduce((sum, a) => sum + findSch(a.id).amountValue, 0);

  $('#apps-summary').innerHTML = apps.length
    ? `<div class="summary-card">
         <p>준비 완료 ${prepared.length}건${pending.length ? ` · 서류 작성 필요 ${pending.length}건` : ''} · 예상 최대 수혜액</p>
         <p class="summary-amount">${won(totalExpected)}</p>
         <p class="summary-note">최종 제출은 각 공식 채널(한국장학재단·학교 포털 등)에서 이루어져요</p>
       </div>`
    : '';

  $('#apps-list').innerHTML = apps.length
    ? apps.map(appCard).join('')
    : '<p class="empty">아직 준비한 장학금이 없어요.<br />홈에서 한 번에 준비해 보세요 ⚡</p>';
}

/* ---------------- MY ---------------- */
function renderMy() {
  const p = state.profile;
  const c = p.common || {};
  const flagText = p.flags.length ? p.flags.map((f) => FLAG_LABELS[f]).join(', ') : '해당 없음';
  const trackLabel = (TRACKS.find((t) => t.id === p.track) || {}).label || '-';
  const commonFilled = ['studentId', 'birth', 'phone', 'email', 'account'].filter((k) => c[k]).length;
  $('#my-profile').innerHTML = `
    <p class="my-name">${p.name || '대학생'} 님</p>
    <p class="my-line">${p.school || '대학 미설정'} · ${trackLabel}${p.major ? ' · ' + p.major : ''}</p>
    <div class="my-grid">
      <div><span>학년</span><strong>${p.year}학년 (${{ enrolled: '재학', freshman: '신입', returning: '복학' }[p.status]})</strong></div>
      <div><span>직전학기 평점</span><strong>${p.gpa != null ? p.gpa.toFixed(2) : '미입력'}</strong></div>
      <div><span>지원구간</span><strong>${p.bracket != null ? p.bracket + '구간' : '모름'}</strong></div>
      <div><span>공통 서류정보</span><strong>${commonFilled}/5 입력됨</strong></div>
    </div>
    <p class="my-flags">특별자격: ${flagText}</p>
    <p class="my-flags">공통 서류정보(학번·연락처·계좌 등)는 이 기기에만 저장되고 서류 초안에 자동 기입돼요.</p>`;
  renderWallet();
}

function renderWallet() {
  const el = $('#my-wallet');
  el.innerHTML = `
    <p class="wallet-title">서류 보관함</p>
    <p class="wallet-sub">한 번 올려두면 모든 신청에 자동으로 함께 준비돼요. 파일은 휴대폰 안에만 저장돼요.</p>
    ${DOC_SLOTS.map((s) => {
      const rec = walletCache[s.slot];
      return `
        <div class="wallet-row">
          <div class="wallet-info">
            <p class="wallet-label">${s.label}</p>
            <p class="wallet-status">${rec ? `✓ ${esc(rec.name)} · ${rec.savedAt}` : `없음 · ${s.issue}`}</p>
          </div>
          <div class="wallet-btns">
            ${rec ? `<button class="wallet-btn" data-view="${s.slot}">보기</button>
                     <button class="wallet-btn danger" data-del="${s.slot}">삭제</button>` : ''}
            <label class="wallet-btn primary">${rec ? '교체' : '올리기'}
              <input type="file" data-slot="${s.slot}" accept="image/*,application/pdf" hidden />
            </label>
          </div>
        </div>`;
    }).join('')}`;

  $$('#my-wallet input[type=file]').forEach((inp) =>
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('10MB 이하 파일만 올릴 수 있어요'); return; }
      await walletPut(inp.dataset.slot, file);
      toast('보관함에 저장했어요');
      renderWallet();
    })
  );
  $$('#my-wallet [data-view]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const rec = await walletGetRec(btn.dataset.view);
      if (rec && rec.blob) window.open(URL.createObjectURL(rec.blob), '_blank');
    })
  );
  $$('#my-wallet [data-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('이 서류를 보관함에서 삭제할까요?')) return;
      await walletDeleteSlot(btn.dataset.del);
      renderWallet();
    })
  );
}

/* ---------------- 이벤트 바인딩 ---------------- */
function bindEvents() {
  $$('.onboard-step [data-next]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (onboardStep === 1) {
        if (!$('#in-school').value.trim()) { toast('학교명을 입력해 주세요'); return; }
        if (!getChip('#in-year')) { toast('학년을 선택해 주세요'); return; }
      }
      onboardStep += 1;
      renderOnboardStep();
    })
  );

  $('#btn-finish-onboard').addEventListener('click', () => {
    state.profile = collectProfile();
    saveState();
    toast('프로필이 저장됐어요. 맞춤 장학금을 찾았어요!');
    showScreen('home');
  });

  $$('.chip-group').forEach((group) =>
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    })
  );
  // 서류 도우미의 동적 칩 그룹 (이벤트 위임)
  document.addEventListener('click', (e) => {
    const fill = e.target.closest('[data-fill]');
    if (fill) { const ta = $('#' + fill.dataset.fill); if (ta) { ta.value = fill.dataset.text; } return; }
    const multi = e.target.closest('.fq-checks .chip');
    if (multi) { multi.classList.toggle('active'); return; }
    const chip = e.target.closest('.dp-q .chip');
    if (!chip) return;
    chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
  });

  $$('.nav-item').forEach((btn) =>
    btn.addEventListener('click', () => showScreen(btn.dataset.nav))
  );
  $$('[data-goto]').forEach((btn) =>
    btn.addEventListener('click', () => showScreen(btn.dataset.goto))
  );

  $('#explore-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    exploreFilter = chip.dataset.filter;
    $$('.filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderExplore();
  });

  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-detail]');
    if (card) openDetail(card.dataset.detail);
  });

  $('#sheet-backdrop').addEventListener('click', closeSheet);
  $('#detail-sheet').addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-handle')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#detail-sheet').hidden) closeSheet();
  });

  $('#btn-apply-all').addEventListener('click', applyAll);

  const editProfile = () => { initOnboarding(); showScreen('onboarding'); };
  $('#btn-edit-profile').addEventListener('click', editProfile);
  $('#btn-my-edit').addEventListener('click', editProfile);

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('프로필과 신청 내역을 모두 삭제할까요?')) return;
    [STORAGE_KEY, ...LEGACY_KEYS].forEach((k) => localStorage.removeItem(k));
    state = { profile: null, applications: [] };
    initOnboarding();
    showScreen('onboarding');
  });

  // 자동추천
  attachAutocomplete($('#in-school'), schoolSuggestions);
  attachAutocomplete($('#in-major'), majorSuggestions);
  ['change', 'input'].forEach((ev) =>
    $('#in-school').addEventListener(ev, () => renderCampusChips(null))
  );
}

/* ---------------- PWA ---------------- */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시는 선택 기능 */ });
  });
}

/* ---------------- 시작 ---------------- */
loadState();
bindEvents();
initOnboarding();
loadNotices();
walletRefresh().then(() => {
  if (!$('#screen-my').hidden) renderMy();
});
if (state.profile) {
  saveState(); // 레거시 키 → 새 키 이관
  showScreen('home');
} else {
  showScreen('onboarding');
}
