/* ============================================================
   한장 — 앱 로직 (매칭 엔진 · 화면 · 신청 플로우)
   ============================================================ */

const STORAGE_KEY = 'hanjang.v1';
const TODAY = new Date();

/* ---------------- 상태 ---------------- */
let state = {
  profile: null,          // 온보딩 결과
  applications: [],       // { id, appliedAt, status }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) { /* 손상된 데이터는 무시 */ }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------------- 매칭 엔진 ----------------
   결과: { status: 'eligible' | 'selective' | 'unknown' | 'ineligible',
           reasons: [...], missing: [...] } */
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

  if (e.colleges && !e.colleges.includes(p.college)) {
    ok = false; reasons.push('지원 대상 계열(단과대학)이 아니에요');
  } else if (e.colleges) {
    reasons.push('지원 대상 계열 충족');
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

function getMatches() {
  const p = state.profile;
  return SCHOLARSHIPS.map((s) => ({ sch: s, result: evaluate(s, p) }));
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

const APP_STEPS = ['신청 완료', '서류 검토', '심사 중', '선정 발표'];

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => (el.hidden = true), 250);
  }, 2200);
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
const ONBOARD_STEPS = 4;

function renderOnboardStep() {
  $$('.onboard-step').forEach((el) => (el.hidden = Number(el.dataset.step) !== onboardStep));
  $('#onboard-bar').style.width = `${((onboardStep + 1) / ONBOARD_STEPS) * 100}%`;
  window.scrollTo(0, 0);
}

function initOnboarding() {
  const sel = $('#in-college');
  sel.innerHTML = COLLEGES.map((c) => `<option value="${c}">${c}</option>`).join('');

  // 기존 프로필이 있으면 값 채우기 (프로필 수정 진입)
  const p = state.profile;
  if (p) {
    $('#in-name').value = p.name || '';
    sel.value = p.college;
    $('#in-major').value = p.major || '';
    $('#in-gpa').value = p.gpa != null ? p.gpa : '';
    $('#in-bracket').value = p.bracket != null ? String(p.bracket) : '';
    $('#in-cert').checked = !!p.cert;
    $('#in-exchange').checked = !!p.exchange;
    setChip('#in-year', String(p.year));
    setChip('#in-status', p.status);
    setChip('#in-region', p.region);
    $$('#in-flags input').forEach((c) => (c.checked = p.flags.includes(c.value)));
  } else {
    setChip('#in-year', '1');
    setChip('#in-status', 'enrolled');
    setChip('#in-region', 'seoul');
  }

  onboardStep = p ? 1 : 0; // 프로필 수정 시 인트로 생략
  renderOnboardStep();
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
    college: $('#in-college').value,
    major: $('#in-major').value.trim(),
    year: Number(getChip('#in-year')),
    status: getChip('#in-status'),
    gpa: Number.isNaN(gpa) ? null : gpa,
    bracket: bracketRaw === '' ? null : Number(bracketRaw),
    region: getChip('#in-region'),
    flags: $$('#in-flags input:checked').map((c) => c.value),
    cert: $('#in-cert').checked,
    exchange: $('#in-exchange').checked,
  };
}

/* ---------------- 카드 렌더링 ---------------- */
function schCard(sch, result, { compact = false } = {}) {
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const applied = state.applications.some((a) => a.id === sch.id);
  return `
    <button class="sch-card" data-detail="${sch.id}">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        <span class="badge badge-dday ${d.cls}">${d.label}</span>
        ${applied ? '<span class="badge badge-applied">신청함</span>' : ''}
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

  const matches = getMatches();
  const applyable = matches.filter((m) => ['eligible', 'selective'].includes(m.result.status));
  const notApplied = applyable.filter((m) => !state.applications.some((a) => a.id === m.sch.id) && dday(m.sch.deadline).days >= 0);
  const total = applyable.reduce((sum, m) => sum + m.sch.amountValue, 0);

  $('#hero-amount').textContent = `최대 ${won(total)}`;
  $('#hero-count').textContent = `신청 가능 ${applyable.filter((m) => m.result.status === 'eligible').length}건 · 선발 심사 ${applyable.filter((m) => m.result.status === 'selective').length}건`;

  const btn = $('#btn-apply-all');
  btn.disabled = notApplied.length === 0;
  btn.textContent = notApplied.length ? `⚡ ${notApplied.length}건 한 번에 신청하기` : '✅ 가능한 장학금을 모두 신청했어요';

  // 마감 임박 (신청 가능한 것 중 마감 가까운 순 3개)
  const upcoming = applyable
    .filter((m) => dday(m.sch.deadline).days >= 0)
    .sort((a, b) => new Date(a.sch.deadline) - new Date(b.sch.deadline))
    .slice(0, 3);
  $('#home-deadline-list').innerHTML = upcoming.length
    ? upcoming.map((m) => schCard(m.sch, m.result, { compact: true })).join('')
    : '<p class="empty">지금 신청 가능한 장학금이 없어요. 프로필을 업데이트해 보세요.</p>';

  // 신청 현황 미리보기
  const recent = state.applications.slice(-2).reverse();
  $('#home-apps').innerHTML = recent.length
    ? recent.map(appCard).join('')
    : '<p class="empty">아직 신청한 장학금이 없어요.</p>';
}

/* ---------------- 탐색 ---------------- */
let exploreFilter = 'all';

function renderExplore() {
  const matches = getMatches();
  const order = { eligible: 0, selective: 1, unknown: 2, ineligible: 3 };
  let list = matches.slice().sort((a, b) =>
    order[a.result.status] - order[b.result.status] ||
    new Date(a.sch.deadline) - new Date(b.sch.deadline)
  );

  if (exploreFilter === '교내' || exploreFilter === '교외') list = list.filter((m) => m.sch.type === exploreFilter);
  if (exploreFilter === 'eligible') list = list.filter((m) => ['eligible', 'selective'].includes(m.result.status));

  $('#explore-list').innerHTML = list.length
    ? list.map((m) => schCard(m.sch, m.result)).join('')
    : '<p class="empty">조건에 맞는 장학금이 없어요.</p>';
}

/* ---------------- 상세 바텀시트 ---------------- */
function openDetail(id) {
  const sch = SCHOLARSHIPS.find((s) => s.id === id);
  const result = evaluate(sch, state.profile);
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const app = state.applications.find((a) => a.id === id);
  const canApply = ['eligible', 'selective'].includes(result.status) && !app && d.days >= 0;

  const reasonRows = result.reasons.map((r) => {
    const bad = /필요|아니에요|가능$/.test(r) && !/충족|확인/.test(r);
    return `<li class="${bad ? 'r-bad' : 'r-ok'}">${bad ? '✕' : '✓'} ${r}</li>`;
  }).join('');
  const missingRows = result.missing.map((m) => `<li class="r-unk">? ${m} 정보를 입력하면 정확히 판단할 수 있어요</li>`).join('');

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        <span class="badge badge-dday ${d.cls}">${d.label}</span>
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

      <p class="sheet-note">💡 ${sch.note}</p>
      <p class="sheet-deadline">마감일 ${sch.deadline} · ${sch.duplicable ? '타 장학금과 중복 수혜 가능' : '중복 수혜 제한 있음'}</p>

      ${app ? `
        <div class="app-progress">
          ${APP_STEPS.map((s, i) => `
            <div class="ap-step ${i <= app.step ? 'done' : ''}">
              <span class="ap-dot"></span><span class="ap-label">${s}</span>
            </div>`).join('')}
        </div>
        <p class="applied-at">${app.appliedAt} 신청 완료</p>` : ''}

      <button class="btn btn-primary btn-lg" id="btn-apply-one" ${canApply ? '' : 'disabled'}>
        ${app ? '✅ 신청 완료됨' : d.days < 0 ? '마감된 장학금이에요' : canApply ? '⚡ 원클릭 신청하기' : '요건 미충족으로 신청할 수 없어요'}
      </button>
    </div>`;

  $('#sheet-backdrop').hidden = false;
  const sheet = $('#detail-sheet');
  sheet.hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
  });

  const applyBtn = $('#btn-apply-one');
  if (canApply) {
    applyBtn.addEventListener('click', () => {
      applyTo([sch]);
      closeSheet();
    });
  }
}

function closeSheet() {
  $('#sheet-backdrop').classList.remove('show');
  $('#detail-sheet').classList.remove('show');
  setTimeout(() => {
    $('#sheet-backdrop').hidden = true;
    $('#detail-sheet').hidden = true;
  }, 250);
}

/* ---------------- 신청 ---------------- */
function applyTo(schList) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  schList.forEach((sch) => {
    if (state.applications.some((a) => a.id === sch.id)) return;
    state.applications.push({ id: sch.id, appliedAt: dateStr, step: 0 });
  });
  saveState();
  toast(schList.length === 1
    ? `'${schList[0].name}' 신청이 완료됐어요 🎉`
    : `장학금 ${schList.length}건 신청이 완료됐어요 🎉`);
  const current = $$('.screen').find((s) => !s.hidden);
  if (current) showScreen(current.id.replace('screen-', ''));
}

function applyAll() {
  const matches = getMatches();
  const targets = matches
    .filter((m) => ['eligible', 'selective'].includes(m.result.status))
    .filter((m) => !state.applications.some((a) => a.id === m.sch.id))
    .filter((m) => dday(m.sch.deadline).days >= 0)
    .map((m) => m.sch);
  if (!targets.length) { toast('신청할 수 있는 장학금이 없어요'); return; }

  const ok = confirm(
    `아래 ${targets.length}건을 한 번에 신청할까요?\n\n` +
    targets.map((s) => `· [${s.type}] ${s.name}`).join('\n') +
    '\n\n성적·재학증명서는 자동 첨부되고, 추가 서류가 필요한 항목은 신청 후 알림으로 안내돼요.'
  );
  if (ok) applyTo(targets);
}

/* ---------------- 신청 내역 ---------------- */
function appCard(app) {
  const sch = SCHOLARSHIPS.find((s) => s.id === app.id);
  return `
    <button class="sch-card" data-detail="${sch.id}">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        <span class="badge badge-applied">${APP_STEPS[app.step]}</span>
      </div>
      <p class="sch-name">${sch.name}</p>
      <p class="sch-provider">${app.appliedAt} 신청</p>
      <div class="mini-progress"><div style="width:${((app.step + 1) / APP_STEPS.length) * 100}%"></div></div>
    </button>`;
}

function renderApplications() {
  const apps = state.applications.slice().reverse();
  const totalExpected = apps.reduce((sum, a) => {
    const sch = SCHOLARSHIPS.find((s) => s.id === a.id);
    return sum + (sch ? sch.amountValue : 0);
  }, 0);

  $('#apps-summary').innerHTML = apps.length
    ? `<div class="summary-card">
         <p>신청 ${apps.length}건 · 예상 최대 수혜액</p>
         <p class="summary-amount">${won(totalExpected)}</p>
       </div>`
    : '';

  $('#apps-list').innerHTML = apps.length
    ? apps.map(appCard).join('')
    : '<p class="empty">아직 신청한 장학금이 없어요.<br />홈에서 한 번에 신청해 보세요 ⚡</p>';
}

/* ---------------- MY ---------------- */
function renderMy() {
  const p = state.profile;
  const flagText = p.flags.length ? p.flags.map((f) => FLAG_LABELS[f]).join(', ') : '해당 없음';
  $('#my-profile').innerHTML = `
    <p class="my-name">${p.name || '외대생'} 님</p>
    <p class="my-line">한국외국어대학교 · ${p.college}${p.major ? ' ' + p.major : ''}</p>
    <div class="my-grid">
      <div><span>학년</span><strong>${p.year}학년 (${{ enrolled: '재학', freshman: '신입', returning: '복학' }[p.status]})</strong></div>
      <div><span>직전학기 평점</span><strong>${p.gpa != null ? p.gpa.toFixed(2) : '미입력'}</strong></div>
      <div><span>지원구간</span><strong>${p.bracket != null ? p.bracket + '구간' : '모름'}</strong></div>
      <div><span>거주지</span><strong>${{ seoul: '서울', gyeonggi: '경기/인천', etc: '그 외' }[p.region]}</strong></div>
    </div>
    <p class="my-flags">특별자격: ${flagText}</p>`;
}

/* ---------------- 이벤트 바인딩 ---------------- */
function bindEvents() {
  // 온보딩 진행
  $$('.onboard-step [data-next]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (onboardStep === 1 && !getChip('#in-year')) { toast('학년을 선택해 주세요'); return; }
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

  // 칩 선택
  $$('.chip-group').forEach((group) =>
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
    })
  );

  // 하단 내비
  $$('.nav-item').forEach((btn) =>
    btn.addEventListener('click', () => showScreen(btn.dataset.nav))
  );
  $$('[data-goto]').forEach((btn) =>
    btn.addEventListener('click', () => showScreen(btn.dataset.goto))
  );

  // 탐색 필터
  $('#explore-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    exploreFilter = chip.dataset.filter;
    $$('.filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderExplore();
  });

  // 카드 → 상세
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-detail]');
    if (card) openDetail(card.dataset.detail);
  });

  // 시트 닫기 (배경 탭 · 핸들 탭 · ESC)
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  $('#detail-sheet').addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-handle')) closeSheet();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#detail-sheet').hidden) closeSheet();
  });

  // 전체 신청
  $('#btn-apply-all').addEventListener('click', applyAll);

  // 프로필 수정
  const editProfile = () => { initOnboarding(); showScreen('onboarding'); };
  $('#btn-edit-profile').addEventListener('click', editProfile);
  $('#btn-my-edit').addEventListener('click', editProfile);

  // 초기화
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('프로필과 신청 내역을 모두 삭제할까요?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { profile: null, applications: [] };
    initOnboarding();
    showScreen('onboarding');
  });
}

/* ---------------- 신청 상태 시뮬레이션 ----------------
   실제 서비스에서는 학교·재단 시스템 연동으로 갱신됩니다.
   시연용: 신청 후 방문할 때마다 하루 단위로 단계가 진행된 것처럼 표시 */
function simulateProgress() {
  const now = new Date();
  state.applications.forEach((a) => {
    const applied = new Date(a.appliedAt.replace(/\./g, '-'));
    const daysSince = Math.floor((now - applied) / 86400000);
    a.step = Math.min(APP_STEPS.length - 1, Math.max(a.step, Math.floor(daysSince / 2)));
  });
  saveState();
}

/* ---------------- 시작 ---------------- */
loadState();
bindEvents();
initOnboarding();
if (state.profile) {
  simulateProgress();
  showScreen('home');
} else {
  showScreen('onboarding');
}
