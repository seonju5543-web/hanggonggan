/* app-onboarding.js — 온보딩(첫 화면): 시작 화면 장면 · 학적정보 입력 칸 · 쓰다 만 온보딩 이어쓰기 · collectProfile (2026-11-19 app.js 에서 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 맨 아래의 시작 코드(initOnboarding 등)가 이 파일의 함수를 부른다.
   🔴 이 파일 맨 윗단에는 **함수 선언과 리터럴 값만** 둔다 — app.js 의 상수·함수를 불러오는 순간 쓰면 아직 없어서 넘어진다(부르는 것은 함수 안에서만).
   🔴 검사는 이 파일을 따로 읽지 않는다 — verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼워 **나누기 전과 같은 글자**로 읽는다.
      그래서 검사의 뜻이 그대로다. 관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
/* ---------------- 온보딩 ---------------- */
let onboardStep = 0;
/* 프로필을 **고치러** 들어왔나 (처음 가입이 아니라) — 취소 버튼을 띄울지 정한다 */
let onboardEditing = false;
const ONBOARD_STEPS = 7;   /* 2026-08-27 — '지금 받고 있는 장학금'(이중수혜) 단계 추가 · 2026-10-04 — '관심 대외활동·공모전' 단계 추가
                              · 2026-10-24 — 그 단계를 「적합도 높이기」(처지 예/아니요 + 출신 고교 지역)로 바꾸고 관심은 대외활동 탭 관문으로 옮김(개발자 지시 3·4) */

function renderOnboardStep() {
  /* 고치러 들어온 경우에만 취소를 보여 준다 — 처음 가입하는 사람에게는 취소할 것이 없다 */
  $$('#screen-onboarding .btn-onboard-cancel').forEach((b) => (b.hidden = !onboardEditing));
  $$('.onboard-step').forEach((el) => (el.hidden = Number(el.dataset.step) !== onboardStep));
  /* 🔴 **환영 화면(0단계)에서는 진행 막대를 감춘다** (2026-09-09 · 설계 ②).
     아직 '시작하기'도 안 눌렀는데 막대가 1/6 차 있으면 "벌써 뭔가 하고 있다"로 읽힌다.
     환영 화면은 앱을 소개하는 자리이지 절차의 첫 칸이 아니다. */
  const bar = $('.onboard-top');
  if (bar) bar.hidden = onboardStep === 0;
  /* 뒤로가기는 **돌아갈 곳이 있을 때만** 보인다 (노션 UI-2).
     🔴 고치러 들어온 사람의 첫 칸은 1단계다(initOnboarding) — 그 사람에게 0단계는
        '시작하기' 인사말이라 돌아갈 곳이 아니다. 취소 버튼이 그 자리를 이미 맡고 있다. */
  const back = $('#btn-onboard-back');
  if (back) back.hidden = onboardStep <= (onboardEditing ? 1 : 0);
  $('#onboard-bar').style.width = `${((onboardStep + 1) / ONBOARD_STEPS) * 100}%`;
  appScrollTo(0);
  /* 시작 화면(0단계)이 보이면 정문 투어링을 준비한다 — 한 번만 돈다(startMontage 안의 표식) */
  if (onboardStep === 0 && !onboardEditing) startMontage();
}

/* ---------------- 시작 화면 — 정문 투어링 (2026-09-18 개발자 결정 · 노션 UI-3) ----------------
   승인받은 컷 A 그대로: 14개교 사진(assets/gates/gates.json) 중 **무작위 3장**이 학교당
   `--start-dur`(2.5초)씩 걸어 들어가고, 마지막 장면에서 멈춘다(한 번 재생 후 정지).
   🔴 시간은 style.css 의 --start-dur 를 읽는다 — 여기 숫자로 두면 CSS 와 어긋난다(boot.js 와 같은 규칙).
   🔴 부팅 덮개가 열리는 순간(`boot:open` · boot.js)에 첫 사진이 스며든다 — 덮개 밑에서 먼저 돌기
      시작하면 학생은 첫 장면을 못 본다. 덮개가 없거나 이미 걷혔으면 바로 시작한다.
   🔴 사진을 못 받으면 지어내지 않는다 — 바탕색(--start-base) 위에 글과 버튼만 남는다.
   🔴 움직임 줄이기 기기에서는 한 장만 .last 로 둔다(전역 * 규칙이 .run 을 끝값(투명)으로 보낸다).
   ⚠️ 뒤로 돌아와도 다시 돌지 않는다 — 장면은 마지막 사진에서 멈춘 채 남아 있다. */
const START_SCENES = 3;
let startMontageState = null;   /* null → 아직 · 'pending' → 사진 준비 중 · 'done' → 한 번 돌았다 */

function pickRandom(list, n) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/* CSS 변수의 시간을 ms 로 — boot.js 의 msOf 와 같은 규칙(초 단위만 1000배 · 못 읽으면 0) */
function cssMs(el, name) {
  const v = String(getComputedStyle(el).getPropertyValue(name) || '').trim();
  const n = parseFloat(v) || 0;
  return /[^m]s$/.test(v) ? n * 1000 : n;
}

function startMontage() {
  if (startMontageState) return;
  const stage = $('#start-stage');
  if (!stage) return;
  startMontageState = 'pending';
  fetch('assets/gates/gates.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const all = Array.isArray(list) ? list.filter((g) => g && g.file && g.name) : [];
      const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const picks = pickRandom(all, reduce ? 1 : START_SCENES);
      const scenes = picks.map((g) => {
        const d = document.createElement('div');
        d.className = 'start-scene';
        if (g.focus) d.style.setProperty('--focus', g.focus);
        d.innerHTML = `<img src="assets/gates/${esc(g.file)}" alt="" /><span class="start-school">${esc(g.name)}</span><span class="start-credit">${esc(g.credit || '')}</span>`;
        stage.appendChild(d);
        return d;
      });
      const dur = cssMs(stage, '--start-dur');
      whenBootOpen(() => {
        startMontageState = 'done';
        scenes.forEach((d, i) => setTimeout(() => d.classList.add(i === scenes.length - 1 ? 'last' : 'run'), i * dur));
        /* 🔴 다 돌고 나면 '멈춘 상태'를 클래스로 굳힌다 — 1단계에 갔다 돌아오면 0단계가 display:none 에서
           다시 보이는 것이라 CSS 애니메이션이 **셋 다 처음부터 다시** 돈다(실측: 되돌아온 0.3초 뒤 세 장면이
           전부 0.81). .start-done 은 마지막 장면만 남기고 나머지를 투명으로 고정한다(style.css). */
        setTimeout(() => stage.classList.add('start-done'), scenes.length * dur);
      });
    });
}

/* 부팅 덮개가 걷히기 시작하는 순간(boot.js 가 페이드를 켜며 'boot:open' 을 보낸다)에 부른다.
   덮개가 없거나(검사 픽스처) 이미 걷혔으면 곧바로 부른다. */
function whenBootOpen(fn) {
  const boot = document.getElementById('boot');
  if (!boot || boot.hidden || boot.classList.contains('boot-fade')) { fn(); return; }
  window.addEventListener('boot:open', fn, { once: true });
}

function initOnboarding() {
  /* 계열 칩은 학교·캠퍼스가 정해진 뒤 그 학교 것으로 다시 그린다(renderTrackChips) — 여기서는 전부 그려 둔다 */
  trackChipsOpen = false;
  renderTrackChips(null);

  const p = state.profile;
  /* 계좌 칸은 **처음 가입할 때는 감춘다** (2026-08-31). 프로필을 고치러 들어온
     사람에게만 보인다 — 그때는 이미 앱을 써 보고 신뢰가 생긴 뒤다. */
  const acField = $('#in-account-field');
  if (acField) acField.hidden = !p;
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
    $('#in-region').value = p.region || '';
    $('#in-parent-region').value = p.parentRegion || '';
    fillRegionCities('#in-region', '#in-region-city', p.regionCity);
    fillRegionCities('#in-parent-region', '#in-parent-region-city', p.parentRegionCity);
    setChip('#in-residence-months', p.residenceMonths != null ? String(p.residenceMonths) : null);   // 지금 주소에 산 지 — 안 골랐으면 아무 칩도 안 켠다
    $('#in-nationality').value = p.nationality || 'korean';
    $('#in-credits').value = p.credits != null ? p.credits : '';
    $('#in-birth-year').value = p.birthYear || '';
    $$('#in-flags input').forEach((cb) => (cb.checked = p.flags.includes(cb.value)));
    if (Array.isArray(p.scholarships)) {
      $$('#in-scholarships input').forEach((cb) => (cb.checked = p.scholarships.includes(cb.value)));
      if ($('#in-schol-none')) $('#in-schol-none').checked = p.scholarships.length === 0;
    }
    $('#in-sensitive-ok').checked = !!(state.consent && state.consent.sensitive);
    /* 적합도 높이기 (2026-10-24) — 답해 둔 처지·출신 지역을 되살린다. 관심 대외활동은 이 화면에 없다(대외활동 탭 관문) */
    renderOnboardTraits(p.traits || {});
    $('#in-origin-region').value = p.originRegion || '';
    fillRegionCities('#in-origin-region', '#in-origin-city', p.originCity);
  } else {
    setChip('#in-year', '1');
    setChip('#in-status', '재학');
    $('#in-nationality').value = 'korean';
    renderOnboardTraits({});
  }

  renderCampusChips(p ? p.campus : null);
  /* 캠퍼스가 정해진 뒤 그 학교 계열로(파일이 아직이면 여덟 개 전부). 🔴 처음 가입은 **아무 계열도 안 켠다** — 옛 기본값 인문·어문이
     남으면 분류가 못 가른 학과(융합인재학부…)의 학생이 그대로 저장돼 `공학계열` 공고에 틀린 ✕ 를 받는다(코드 리뷰). 학과를 고르면 따라오고, 모르면 비워 둔다 */
  renderTrackChips(p ? p.track : null);
  /* 🔴 **고치러 들어온 학생도 자기 학교 학과 파일을 받아야 한다** (2026-09-26 코드 리뷰).
     위에서 `#in-school` 값을 **코드로** 넣었으므로 `input` 이 뜨지 않고, 그래서 학교 입력
     쪽 프리페치가 **한 번도 돌지 않았다** — 그 학생이 학과를 고치려고 '일'을 치면 전국
     공통 목록이 뜨고 `일어일문학과` 를 눌러 버릴 수 있다(2026-08-02 그 사고 그대로다). */
  if (p && p.school) loadMajorsFor(p.school);
  syncConsentRow();

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

/* ── 쓰다 만 온보딩을 적어 둔다 (2026-09-09 · 개발자 지시 ②) ─────────────
   학교·학년·성적을 다시 치게 만드는 것이 이 앱에서 가장 큰 손실이다. 그래서 온보딩
   진행분은 **창(4시간)과 상관없이** 되살린다 — 사흘 뒤에 돌아와도 치던 자리에서 잇는다.

   🔴 `collectProfile()` 로 적지 않는다. 그건 **다 채운 프로필**을 만드는 함수라 빈 칸을
      기본값으로 메워 버린다(성적 0, 소득 미선택 등) — 학생이 고른 적 없는 값이 프로필에
      들어가는 것은 원칙 8-1(추론 금지) 위반이다. 화면의 칸을 **그대로** 적었다 그대로 되돌린다. */
function onboardSnapshot() {
  const fields = {};
  $$('#screen-onboarding input, #screen-onboarding select').forEach((el) => {
    if (!el.id) return;
    if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) fields[el.id] = true; return; }
    if (String(el.value || '').trim()) fields[el.id] = el.value;
  });
  /* 🔴 **id 가 없는 체크박스가 있다** (2026-09-09 코드 리뷰). 특별자격(`#in-flags`)과
     보유 장학금(`#in-scholarships`)의 칸들은 `value` 만 있어서, id 로만 담으면 **매칭을
     좌우하는 자격이 통째로 안 담긴다**(기초생활수급자·다자녀·국가유공자…).
     그래서 그 묶음은 **묶음 id + 체크된 value 목록**으로 담는다. */
  const boxes = {};
  $$('#screen-onboarding .check-list').forEach((g) => {
    if (!g.id) return;
    const on = $$(`#${g.id} input[type="checkbox"]`).filter((c) => c.checked).map((c) => c.value);
    if (on.length) boxes[g.id] = on;
  });
  const chips = {};
  $$('#screen-onboarding .chip-group').forEach((g) => {
    if (!g.id) return;
    const on = $$(`#${g.id} .chip.active`).map((c) => c.dataset.value);
    if (on.length) chips[g.id] = on;
  });
  /* 적합도 높이기의 예/아니요 알약 (2026-10-24) — 누른 것만 {처지: true/false} */
  const traits = onboardTraitAnswers();
  return { step: onboardStep, fields: fields, boxes: boxes, chips: chips, traits: traits, at: Date.now() };
}

function onboardRestore(snap) {
  if (!snap) return false;
  Object.keys(snap.fields || {}).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!snap.fields[id];
    else el.value = snap.fields[id];
  });
  renderOnboardTraits(snap.traits || {});   // 적합도 높이기 알약 — 눌러 둔 것 그대로(안 누른 것은 안 누른 채)
  Object.keys(snap.boxes || {}).forEach((gid) => {
    const on = snap.boxes[gid] || [];
    $$(`#${gid} input[type="checkbox"]`).forEach((c) => { c.checked = on.indexOf(c.value) >= 0; });
  });
  /* 시·도를 되돌린 뒤에야 그 아래 시·군·구 목록이 채워진다 — 순서가 있다 */
  fillRegionCities('#in-region', '#in-region-city', (snap.fields || {})['in-region-city']);
  fillRegionCities('#in-parent-region', '#in-parent-region-city', (snap.fields || {})['in-parent-region-city']);
  fillRegionCities('#in-origin-region', '#in-origin-city', (snap.fields || {})['in-origin-city']);
  /* 🔴 **학교 칸에 값만 넣으면 캠퍼스 칸이 안 생긴다** (2026-09-09 코드 리뷰). 그 칸은
     학교를 고를 때 `renderCampusChips()` 가 만드는데, 여기서는 값을 코드로 넣어 그 함수가
     안 불린다 → `#campus-field` 가 숨은 채라 `collectProfile()` 이 캠퍼스를 빈 값으로 적고,
     학생이 나중에 학교 칸을 건드리면 **첫 캠퍼스가 골라진 채**로 되살아난다. */
  const campus = ((snap.chips || {})['in-campus'] || [])[0] || null;
  if (typeof renderCampusChips === 'function') renderCampusChips(campus);
  Object.keys(snap.chips || {}).forEach((gid) => {
    const on = snap.chips[gid] || [];
    $$(`#${gid} .chip`).forEach((c) => c.classList.toggle('active', on.indexOf(c.dataset.value) >= 0));
  });
  if (typeof syncConsentRow === 'function') syncConsentRow();
  /* 🔴 되살린 학교의 학과 파일을 **여기서 받는다** (2026-10-31). 학교 칸에 값을 코드로 넣어 `input` 이 안 뜨므로, 안 받으면
     되살린 뒤 바로 마친 학생은 학교 소재지(schoolRegion)·학교별 계열 칩·캠퍼스별 학과가 모두 빈다 — 검사가 「데이터 없음」으로 조용히 넘기던 길이다.
     도착하면 loadMajorsFor 가 계열 칩을 그 학교 것으로 다시 그린다(고른 칩은 지킨다). */
  const restoredSchool = String((snap.fields || {})['in-school'] || '').trim();
  if (restoredSchool) loadMajorsFor(restoredSchool);
  onboardStep = Math.max(0, Math.min(ONBOARD_STEPS - 1, Number(snap.step) || 0));
  renderOnboardStep();
  return true;
}

/* 온보딩에서 무엇을 치거나 고를 때마다 적어 둔다 (디바운스) */
let onboardSaveTimer = null;
function onboardProgressSave() {
  if (typeof resumeSave !== 'function') return;
  clearTimeout(onboardSaveTimer);
  onboardSaveTimer = setTimeout(() => {
    if ($('#screen-onboarding').hidden) return;   /* 이미 끝났으면 안 적는다 */
    resumeSave({ onboard: onboardSnapshot() });
  }, 500);
}

/* ── 적합도 높이기 — 처지 예/아니요 알약 (2026-10-24 · 개발자 지시 3) ─────────────
   무엇을 묻는지는 elig-ask.js ONBOARD_TRAITS 한 곳 · 이름표는 TRAIT_LABEL(명사형) · 알약 모양은 공고 안 「미확인 자격」과 한 벌(.elig-yn).
   🔴 안 누른 칸은 저장하지 않는다(false 로 적으면 '아니요'라고 답한 것이 된다 — 설계 문서 eligibility-ask.md 9절). 누른 알약을 다시 누르면 푼다. */
function renderOnboardTraits(traits) {
  const box = $('#in-traits');
  if (!box) return;
  const keys = typeof ONBOARD_TRAITS !== 'undefined' ? ONBOARD_TRAITS : [];
  const labels = typeof TRAIT_LABEL !== 'undefined' ? TRAIT_LABEL : {};
  const tr = traits || {};
  box.innerHTML = keys.map((k) => {
    const now = tr[k];
    const yn = (v, lbl) => `<button type="button" class="elig-yn${now === v ? ' on' : ''}" data-trait="${esc(k)}" data-val="${v ? '1' : '0'}">${lbl}</button>`;
    return `<div class="elig-ask-row elig-ask-yn"><span>${esc(labels[k] || k)}</span><span class="elig-yn-pair">${yn(true, '예')}${yn(false, '아니요')}</span></div>`;
  }).join('');
}
/* 누른 알약 → { 처지: true/false } · 이 단계가 묻는데 안 누른 처지는 undefined(= 지운다 — 고치러 와서 푼 답이 남지 않게 · JSON 저장에서 빠진다) */
function onboardTraitAnswers() {
  const out = {};
  const keys = typeof ONBOARD_TRAITS !== 'undefined' ? ONBOARD_TRAITS : [];
  for (const k of keys) {
    const on = $(`#in-traits [data-trait="${k}"].on`);
    out[k] = on ? on.dataset.val === '1' : undefined;
  }
  return out;
}

/* 관심 분야 칸 — 수집 로봇이 data/activities.json 에 싣는 fields(ACTIVITY_FIELDS 원본)로 만든다 (2026-10-04).
   목록이 아직 안 왔으면 실린 글들의 분야로 · 그것도 없으면 빈 칸(loadActivities 가 받은 뒤 다시 부른다).
   🔴 다시 그려도 **고른 것은 지킨다** — 받아 오기가 늦게 끝나 칸을 다시 그리면 학생이 고른 게 사라진다. */
let interestPending = [];   // 목록이 오기 전에 정해진 선택(프로필·이어보기) — 칸이 아직 없어도 잃지 않게
function fillInterestFields(selected) {
  const box = $('#in-act-fields');
  if (!box) return;
  if (selected) interestPending = selected;
  const keep = new Set(selected || (box.querySelector('input') ? $$('#in-act-fields input:checked').map((c) => c.value) : interestPending));
  const src = liveActivities && liveActivities.fields;
  const list = src ? [...new Set(Object.values(src).flat())]
    : [...new Set(((liveActivities && liveActivities.items) || []).map((n) => n.field).filter(Boolean))];
  box.innerHTML = list.map((f) => `<label class="check-item"><input type="checkbox" value="${esc(f)}"${keep.has(f) ? ' checked' : ''} /><span>${esc(f)}</span></label>`).join('');
}

function collectProfile() {
  /* 🔴 범위 밖 값을 **깎지 않는다** (2026-11-17 · HDJ-요청-2026-001 후속). 예전엔 평점 999 를
     말없이 4.5 로 바꿔 저장해 학생 모르게 만점 학생이 됐다(지어낸 값). 지금은 칠 때부터 막고
     (input-guard.js), 혹시 새어 들어와도 여기서는 null(모름)로 둔다 — 고쳐 넣지 않는다. */
  const guardedNum = (sel, key) => { const r = checkNumber($(sel).value, PROFILE_LIMITS[key]); return r.ok ? r.value : null; };
  const bracketRaw = $('#in-bracket').value;
  return {
    name: $('#in-name').value.trim(),
    school: $('#in-school').value.trim(),
    track: getChip('#in-track'),
    major: $('#in-major').value.trim(),
    year: Number(getChip('#in-year')),
    status: getChip('#in-status'),
    gpa: guardedNum('#in-gpa', 'gpa'),
    bracket: bracketRaw === '' ? null : Number(bracketRaw),
    campus: $('#campus-field').hidden ? '' : (getChip('#in-campus') || ''),
    /* 적합도 판정에 쓰는 값들 — 자격 요건의 37%(학적상태)·9%(학점)·7%(거주지)를 연다.
       빈 칸은 null로 둔다. **모르면 판정하지 않는 것**이 이 앱의 규칙이라, 0이나 기본값을
       넣으면 안 된다(엉뚱한 0% 판정이 난다). 설계: docs/designs/fit-score.md */
    region: $('#in-region').value || null,
    regionCity: $('#in-region-city').value || null,
    /* 지금 주소에 산 지 (2026-11-13) — 고른 칸의 하한 개월(0·12·36·60·120 · match-engine RESIDENCE_SPANS). 🔴 안 골랐으면 null(모름) — 0 은 「1년 미만」이라는 답이다 */
    residenceMonths: (() => { const v = getChip('#in-residence-months'); return v == null ? null : Number(v); })(),
    parentRegion: $('#in-parent-region').value || null,
    parentRegionCity: $('#in-parent-region-city').value || null,
    nationality: $('#in-nationality').value || null,
    credits: guardedNum('#in-credits', 'credits'),
    birthYear: guardedNum('#in-birth-year', 'birthYear'),
    flags: $$('#in-flags input:checked').map((c) => c.value),
    /* 🔴 **처지(traits) 는 이 화면에 칸이 없다 — 그래서 그대로 물려받는다** (2026-09-18 코드
       리뷰). 학적정보 수정은 이 객체를 **통째로 새로 만들어** 프로필에 넣으므로, 여기 안
       적으면 저장을 누르는 순간 학생이 답해 둔 처지가 전부 사라진다(아래 `common` 을
       Object.assign 으로 물려받는 이유와 같다). */
    traits: Object.assign({}, (state.profile && state.profile.traits) || {}, onboardTraitAnswers()),
    /* 출신 고교 소재지 (2026-10-24 · 「적합도 높이기」) — 빈 칸은 null(모름) */
    originRegion: $('#in-origin-region').value || null,
    originCity: $('#in-origin-city').value || null,
    /* 학교 소재 시·도 (2026-10-31) — 학과 파일(로봇이 커리어넷 개설 지역에서 모은 것)에서 읽는다. 파일이 아직이면 null — 도착하면 loadMajorsFor 가 채운다.
       엔진이 「○○시 소재 대학 재학생」 줄을 ✓/모름으로 보는 데 쓴다(✕ 없음). 묻지 않는다 — 학생이 적을 일이 아니다 */
    schoolRegion: schoolRegionFor($('#in-school').value.trim(), $('#campus-field').hidden ? '' : (getChip('#in-campus') || '')),
    /* 지금 받고 있는 장학금 (2026-08-27) — 이중수혜 금지 공고를 자격 판정에서 거른다.
       '없음'을 눌렀으면 빈 배열, 아무것도 안 골랐으면 null(= 모른다). 둘은 다르다:
       빈 배열이면 "안 받는다"라 전부 지원 가능이고, null 이면 판정하지 않는다. */
    scholarships: $('#in-schol-none') && $('#in-schol-none').checked
      ? []
      : (() => { const v = $$('#in-scholarships input:checked').map((c) => c.value); return v.length ? v : null; })(),
    cert: $('#in-cert').checked,
    exchange: $('#in-exchange').checked,
    /* 관심 대외활동·공모전 (2026-10-04) — 2026-10-24 부터 이 화면이 아니라 **대외활동 탭 관문**(saveActivityGate)이 적는다.
       🔴 그래서 여기서는 그대로 물려받는다 — 안 그러면 학적정보 수정 한 번에 관심이 지워져 관문이 다시 뜬다(traits·common 과 같은 이유) */
    interestKinds: (state.profile && state.profile.interestKinds) || null,
    interestFields: (state.profile && state.profile.interestFields) || null,
    /* 🔴 온보딩 화면에 칸이 없는 값(현주소·긴급연락처·보호자·성별·주민등록번호)은
       신청서를 채우다 학생이 알려 준 것이라, 여기서 통째로 새로 만들면 **사라진다.**
       프로필을 한 번 수정할 때마다 그동안 배운 것을 잃게 되므로 반드시 이어 붙인다. */
    common: Object.assign({}, (state.profile && state.profile.common) || {}, {
      studentId: $('#in-sid').value.trim(),
      birth: $('#in-birth').value.trim(),
      phone: $('#in-phone').value.trim(),
      email: $('#in-email').value.trim(),
      bank: $('#in-bank').value.trim(),
      account: $('#in-account').value.trim(),
    }),
  };
}
