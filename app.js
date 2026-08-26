/* ============================================================
   한대장 — 앱 로직 (매칭 엔진 · 화면 · 신청 준비 플로우)
   ============================================================ */

const STORAGE_KEY = 'handaejang.v1';
const LEGACY_KEYS = ['hanjang.v2', 'hanjang.v1'];
/* 오늘 — 🔴 상수로 굳히지 말 것 (2026-08-25 수리, 개발자 지적으로 발견).
   예전엔 `const TODAY = new Date()`로 **앱을 불러올 때 한 번만** 정했다. 그런데 이 앱은
   홈 화면에 설치해 쓰는 앱(PWA)이라 한 번 연 화면이 며칠씩 살아 있다. 그러면 그 값이
   사흘 전인 채로 남아 **이미 마감된 공고가 D-2로 보이고 일괄 신청 준비 대상에도 들어갔다.**
   부를 때마다 새로 읽는다 — dday를 쓰는 홈·탐색·상세·신청내역·알림이 함께 낫는다(원칙 7). */
function todayStart() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/* ---------------- 상태 ---------------- */
let state = {
  profile: null,          // 온보딩 결과
  applications: [],       // { id, appliedAt, step, docs?, pending? }
  /* 민감정보(기초생활수급·장애 등)를 서버에 올려도 되는가 — 온보딩 Step 3에서 받는다.
     동의 안 하면 그 항목은 기기에만 남는다(supabase-client.js syncSafeProfile). */
  consent: { sensitive: false },
  /* 이 기기에서 마지막으로 고친 시각. 서버 것과 견줘 **최신이 이긴다**. */
  updatedAt: null,
};

/* 분교를 별개 학교로 나누기 전에 저장된 프로필 고치기 (2026-08-02).
   예전엔 '한양대학교 + ERICA캠퍼스(안산)'처럼 캠퍼스로 골랐는데 이제 학교 자체가 다르다.
   그대로 두면 캠퍼스 값이 갈 곳을 잃고 **분교 학생이 본교 학생으로 취급돼** 남의 학교
   공고를 받게 되므로, 옛 캠퍼스 이름을 새 학교 이름으로 한 번 옮겨 준다. */
const LEGACY_BRANCH_CAMPUS = {
  '연세대학교': { '미래캠퍼스(원주)': '연세대학교 미래캠퍼스' },
  '고려대학교': { '세종캠퍼스': '고려대학교 세종캠퍼스' },
  '한양대학교': { 'ERICA캠퍼스(안산)': '한양대학교 ERICA캠퍼스' },
  '건국대학교': { '글로컬캠퍼스(충주)': '건국대학교 글로컬캠퍼스' },
  '동국대학교': { 'WISE캠퍼스(경주)': '동국대학교 WISE캠퍼스' },
  '홍익대학교': { '세종캠퍼스': '홍익대학교 세종캠퍼스' },
  '상명대학교': { '천안캠퍼스': '상명대학교 천안캠퍼스' },
};
/* 학교 이름이 바뀌면 저장된 프로필도 함께 옮긴다 — 안 그러면 목록에 없는 이름이 남아
   그 학생만 매칭이 통째로 비게 된다 (2026-08-02 켄텍 표기 변경). */
const RENAMED_SCHOOLS = {
  '한국에너지공과대학교': '한국에너지공과대학교(KENTECH)',
};
function migrateBranchCampus(p) {
  if (!p || !p.school) return p;
  if (RENAMED_SCHOOLS[p.school]) p.school = RENAMED_SCHOOLS[p.school];
  const moved = (LEGACY_BRANCH_CAMPUS[p.school] || {})[p.campus];
  if (moved) { p.school = moved; p.campus = null; }
  // 본교로 남은 학교는 이제 캠퍼스가 하나뿐 — 남아 있던 캠퍼스 값을 지운다
  else if (LEGACY_BRANCH_CAMPUS[p.school] && !CAMPUSES_BY_SCHOOL[p.school]) p.campus = null;
  return p;
}

/* 🔴 적합도 재설계로 값의 **모양이 바뀐 항목**을 옮긴다 (2026-08-24 · docs/designs/fit-score.md).
   이런 이전을 빼먹으면 기존 사용자의 학적상태가 갈 곳을 잃어 판정이 통째로 'unknown'이 되고,
   적합도가 이유 없이 뚝 떨어진다(분교 나눌 때 겪은 것과 같은 유형이다 — 원칙 7).
     · 학적상태: 영문 코드 → 파서와 같은 한글 낱말
     · 거주지: 뭉뚱그린 3분류 → 시·도 이름 (경기/인천은 가를 수 없으니 경기로 둔다) */
const LEGACY_STATUS = { enrolled: '재학', freshman: '신입학', returning: '복학예정' };
const LEGACY_REGION = { seoul: '서울', gyeonggi: '경기', etc: null };
function migrateFitFields(p) {
  if (!p) return p;
  if (p.status && LEGACY_STATUS[p.status]) p.status = LEGACY_STATUS[p.status];
  if (p.region && LEGACY_REGION[p.region] !== undefined) p.region = LEGACY_REGION[p.region];
  if (p.nationality == null) p.nationality = 'korean';   // 예전 사용자는 국적을 물은 적이 없다
  return p;
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    if (raw) state = Object.assign(state, JSON.parse(raw));
    if (!state.consent) state.consent = { sensitive: false };   // 로그인 이전에 저장된 판
    if (state.profile) { migrateBranchCampus(state.profile); migrateFitFields(state.profile); }
  } catch (e) { /* 손상된 데이터는 무시 */ }
}
/* opts.fromServer = 서버에서 받아 온 것을 그대로 적는 중이라는 뜻.
   그때는 시각을 새로 찍지 않고(서버 시각을 그대로 쓴다) 되돌려 올리지도 않는다 —
   안 그러면 받은 것을 곧바로 다시 올리는 헛돌기가 생긴다. */
function saveState(opts) {
  const o = opts || {};
  if (!o.fromServer) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // 알림 판단에 쓰는 프로필·신청내역 사본을 갱신한다 (서비스워커는 localStorage를 못 읽는다)
  if (typeof notifySyncContext === 'function') notifySyncContext();
  if (!o.fromServer && typeof syncSchedulePush === 'function') syncSchedulePush();
}

/* ---------------- 장학금 목록 (한국장학재단 상시 제도 + 정식 등록 실공고) ---------------- */
let registeredList = []; // data/registered.json — 수집 로봇이 확보한 실공고를 큐레이션해 정식 등록한 목록

function registeredFor(p) {
  return scopedToProfile(registeredList, p); // match-engine.js — 알림도 같은 기준을 쓴다
}

function allScholarships() {
  const p = state.profile;
  if (!p || !p.school) return NATIONAL_SCHOLARSHIPS;
  return NATIONAL_SCHOLARSHIPS.concat(registeredFor(p));
}
function findSch(id) {
  return allScholarships().find((s) => s.id === id) || null;
}

/* ---------------- 매칭 엔진 ----------------
   자격 판정(evaluate)·적합도(fitScore)·학교 한정 필터(scopedToProfile)는 match-engine.js에 있다.
   서비스워커(백그라운드 알림)도 같은 파일을 읽어, 화면과 알림의 기준이 갈라지지 않는다. */

function getMatches() {
  const p = state.profile;
  return allScholarships().map((s) => {
    const result = evaluate(s, p);
    return { sch: s, result, fit: fitScore(s, result, p), fd: fitDetail(s, p) };
  });
}

/* ---------------- 유틸 ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function won(n) {
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

function deadlineTs(sch) {
  return sch.deadline ? new Date(sch.deadline).getTime() : Infinity; // 기한 미확정은 뒤로 정렬
}

/* 마감된 공고를 목록에 며칠 더 남겨 둘지 (2026-08-02 개발자 지시로 30 → 7).
   0으로 두면 마감 당일 사라져 '내가 신청한 그 공고'를 못 찾으므로 짧게 남긴다. */
const CLOSED_KEEP_DAYS = 7;

function dday(dateStr) {
  if (!dateStr) return { label: '기한 원문 확인', cls: '', days: 14 }; // 마감을 확정 못 한 공고 — 목록에 유지
  // 날짜끼리 비교해야 마감 다음 날 새벽에 D-DAY로 잘못 뜨지 않는다 (마감 당일=D-DAY, 지난 날=마감)
  const startOfToday = todayStart();
  const d = Math.round((new Date(dateStr + 'T00:00:00') - startOfToday) / 86400000);
  if (d < 0) return { label: '마감', cls: 'closed', days: d };
  if (d === 0) return { label: 'D-DAY', cls: 'urgent', days: d };
  if (d <= 7) return { label: `D-${d}`, cls: 'urgent', days: d };
  return { label: `D-${d}`, cls: '', days: d };
}

/* notStale(오래된 공고 숨김)은 match-engine.js에 있다 — 화면에서 숨긴 공고를
   알림으로는 알리는 모순이 생기지 않도록 알림 규칙도 같은 함수를 쓴다. */

const STATUS_META = {
  eligible:   { label: '신청 가능',        cls: 'ok' },
  selective:  { label: '지원 가능 · 선발 심사', cls: 'sel' },
  unknown:    { label: '정보 입력 필요',     cls: 'unk' },
  ineligible: { label: '요건 미충족',       cls: 'no' },
};

const APP_STEPS = ['신청 준비 완료', '공식 제출', '심사', '선정 발표'];

/* 진척도 판정 — 앱이 학교·재단 시스템을 들여다볼 수 없으므로(정직 원칙)
   '공식 제출'과 '발표 결과'는 사용자가 직접 기록하고,
   '심사'만 객관적 사실(제출 기록 + 접수 마감 경과)로 자동 표시한다. */
function effectiveStep(app, sch) {
  if (app.result) return 3;                                   // 발표 결과 기록됨
  if (app.submittedAt) {
    const d = sch && sch.deadline ? dday(sch.deadline) : null;
    if (d && d.days < 0) return 2;                            // 제출함 + 접수 마감 → 심사 진행 중
    return 1;                                                 // 제출함
  }
  return 0;                                                   // 준비 완료
}

function recordSubmitted(sch) {
  const app = state.applications.find((a) => a.id === sch.id);
  if (!app) return;
  if (!confirm(`${officialChannel(sch).label}에서 공식 제출을 마치셨나요?\n\n제출 완료로 기록하면 진행 단계가 '공식 제출'로 넘어가요.`)) return;
  app.submittedAt = nowStamp();
  saveState();
  toast('공식 제출로 기록했어요. 접수 마감 후에는 자동으로 심사 단계로 표시돼요');
  refreshProgressViews(sch.id);
}

function recordResult(sch, won) {
  const app = state.applications.find((a) => a.id === sch.id);
  if (!app) return;
  app.result = won ? 'won' : 'lost';
  app.resultAt = nowStamp();
  saveState();
  toast(won ? '🎉 선정 축하드려요! 결과를 기록했어요' : '결과를 기록했어요. 다음 기회를 함께 찾아봐요');
  refreshProgressViews(sch.id);
}

function undoProgress(sch) {
  const app = state.applications.find((a) => a.id === sch.id);
  if (!app) return;
  if (app.result) { app.result = null; app.resultAt = null; }
  else if (app.submittedAt) { app.submittedAt = null; }
  saveState();
  refreshProgressViews(sch.id);
}

/* 진척도 기록 후 시트와 뒤 화면(내역·홈)을 함께 갱신 */
function refreshProgressViews(id) {
  const current = $$('.screen').find((s) => !s.hidden);
  if (current) showScreen(current.id.replace('screen-', ''));
  openDetail(id);
}

function toast(msg, action) {
  const el = $('#toast');
  el.textContent = msg;
  /* 되돌리기처럼 **되살릴 수 있는 실수**는 단추를 함께 준다.
     터치 타깃 44px은 style.css의 .toast-undo가 지킨다. */
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      clearTimeout(toast._t);
      el.classList.remove('show');
      setTimeout(() => (el.hidden = true), 250);
      action.run();
    });
    el.appendChild(b);
  }
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

/* 외부 링크 안전화 — http(s)·mailto만 허용한다. 수집 로봇이 받아 온 데이터가 오염되거나
   정식 등록에 오타가 있어도 javascript:·data: 같은 위험한 스킴이 href나 window.open으로
   들어가지 못하게 막는 2차 방어선(CSP가 뚫리거나 완화돼도 안전). 허용 안 되면 빈 문자열. */
function safeUrl(u) {
  if (!u) return '';
  try {
    const parsed = new URL(String(u), location.origin);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') return parsed.href;
  } catch (e) { /* 잘못된 URL */ }
  return '';
}

/* 원문 링크의 정직한 표기 (2026-07-31)
   수집 로봇이 공고 원문 주소를 끝내 못 찾은 경우에만, 주소가 '게시판 목록 + 제목 표식'
   (…/list.do#n-제목) 형태로 남는다. 이 링크를 누르면 그 장학금 공고가 아니라 학교
   장학 공지 목록이 열리므로, '원문 공고 ↗'라고 적으면 거짓말이 된다.
   그래서 이럴 때만 라벨을 '게시판 목록 ↗'으로 바꾸고, 목록에서 찾을 제목을 함께 알려준다.
   (대부분의 공고는 복구 로봇 resolve-detail-urls가 진짜 원문 주소로 바꿔 둔다.) */
function isBoardListLink(u) {
  return /#n-/.test(String(u || ''));
}
function boardListTitle(u) {
  const s = String(u || '');
  const i = s.indexOf('#n-');
  if (i < 0) return '';
  try { return decodeURIComponent(s.slice(i + 3)); } catch (e) { return s.slice(i + 3); }
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
  let sel = -1; // 키보드로 하이라이트한 항목
  const close = () => { list.hidden = true; sel = -1; };
  const highlight = () => {
    Array.from(list.querySelectorAll('.ac-item')).forEach((b, i) => b.classList.toggle('ac-active', i === sel));
    if (sel >= 0) { const el = list.children[sel]; if (el) el.scrollIntoView({ block: 'nearest' }); }
  };
  const pick = (i) => {
    if (i < 0 || i >= items.length) return;
    input.value = items[i];
    close();
    input.dispatchEvent(new Event('change'));
  };
  /* 목록 높이를 '키보드 위에 실제로 남은 공간'에 맞춘다.
     휴대폰은 키보드가 올라와도 화면 높이(innerHeight·vh)가 그대로라, 높이를 고정값으로 두면
     목록이 키보드 뒤로 뻗어 아래쪽 학교를 아예 못 고른다(2026-08-02 개발자 제보 — '서울'을 치면
     서울과학기술대학교 다음 항목이 키보드에 가렸다). visualViewport가 키보드를 뺀 실제 보이는
     영역을 알려주므로 그걸로 잰다. 지원하지 않는 브라우저는 예전처럼 innerHeight로 넘어간다. */
  const fit = () => {
    if (list.hidden) return;
    const vv = window.visualViewport;
    const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    // 입력창 아래로 실제 남은 공간에 딱 맞춘다 — 목록은 항상 입력창 아래에 두고,
    // 넘치는 항목은 목록 안에서 스크롤해 고른다(개발자 지시: 위로 띄우지 말 것).
    let below = bottom - input.getBoundingClientRect().bottom - 18; // 18px = 화면 끝 여백
    /* 카카오톡·인스타 같은 앱 안 브라우저는 키보드가 올라와도 visualViewport 높이를 안 줄여 준다.
       그러면 below가 실제보다 훨씬 크게 나와 목록이 다시 키보드 뒤로 뻗는다.
       키보드가 올라온 것으로 보이는데(터치 기기 + 입력창에 커서) 높이가 안 줄었으면,
       화면의 45%쯤을 키보드가 먹는다고 보고 그만큼 뺀다 — 못 재는 상황의 안전판이다. */
    const 키보드안잼 = vv && Math.abs(vv.height - window.innerHeight) < 2;
    if ((!vv || 키보드안잼) && matchMedia('(pointer: coarse)').matches && document.activeElement === input) {
      const 보이는한계 = window.innerHeight * 0.55;   // 키보드가 아래 45%를 먹는다고 본다
      below = Math.min(below, 보이는한계 - input.getBoundingClientRect().bottom - 18);
    }
    // 최소값은 1줄(44px)만 둔다 — 이보다 크게 잡으면 남은 공간이 좁을 때 그만큼 키보드에 가린다.
    list.style.maxHeight = Math.max(44, below) + 'px';
  };
  if (window.visualViewport) {
    ['resize', 'scroll'].forEach((ev) => window.visualViewport.addEventListener(ev, fit));
  }

  const render = () => {
    // 예전엔 6개까지만 보여줘서 나머지는 스크롤해도 안 나왔다 — '교육'을 치면 교대 10곳 중
    // 전주·진주·청주·춘천교대가 아예 없어 그 학교 학생은 자기 학교를 찾을 수 없었다.
    // 목록이 스크롤되도록 고쳤으니(style.css .ac-list) 넉넉히 보여준다.
    items = getItems(input.value.trim()).slice(0, 30);
    sel = -1;
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((it, i) =>
      `<button type="button" class="ac-item" role="option" data-i="${i}">${esc(it)}</button>`).join('');
    list.hidden = false;
    fit();
    // 키보드는 focus 직후 조금 늦게 올라온다 — 그때 다시 한 번 맞춘다
    setTimeout(fit, 300);
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', () => {
    render();
    /* 입력창을 화면 위쪽으로 밀어 올려 목록이 펼쳐질 자리를 만든다.
       이게 근본 해법이다 — 키보드 크기를 못 재는 브라우저(카카오톡 등)에서도,
       입력창이 위에 있으면 아래 공간이 넉넉해 목록이 키보드에 안 걸린다.
       키보드가 올라온 뒤에 해야 하므로 조금 기다렸다 실행한다. */
    setTimeout(() => {
      if (!list.hidden) { input.scrollIntoView({ block: 'start', behavior: 'smooth' }); setTimeout(fit, 350); }
    }, 320);
  });
  // 키보드 접근성: ↑/↓ 이동, Enter 선택, Esc 닫기 (데스크톱·보조기기 지원)
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; highlight(); }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); pick(sel); }
    else if (e.key === 'Escape') { close(); }
  });
  // 마우스는 누르는 즉시 고른다 (mousedown이 blur보다 먼저라 클릭이 씹히지 않음)
  list.addEventListener('mousedown', (e) => {
    const b = e.target.closest('.ac-item');
    if (!b) return;
    e.preventDefault();
    pick(Number(b.dataset.i));
  });
  /* 손가락은 '누름'과 '끌기'를 구분해야 한다.
     예전엔 touchstart에서 바로 preventDefault + 선택이라 목록을 끌어 내릴 수가 없었다 —
     닿는 순간 스크롤이 막히고 그 항목이 선택돼 버렸다. 2026-08-02 '스크롤이 안 된다'는
     제보의 진짜 원인이 이것이었다(높이·키보드 문제가 아니었다. 마우스로만 검사해서 놓쳤다). */
  let touchFrom = null;
  list.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    touchFrom = t ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });            // passive = 스크롤을 막지 않겠다는 선언
  list.addEventListener('touchend', (e) => {
    const b = e.target.closest('.ac-item');
    const from = touchFrom;
    touchFrom = null;
    if (!b || !from) return;
    const t = e.changedTouches[0];
    // 10px 넘게 움직였으면 고르려던 게 아니라 목록을 스크롤한 것이다
    if (t && Math.hypot(t.clientX - from.x, t.clientY - from.y) > 10) return;
    e.preventDefault();
    pick(Number(b.dataset.i));
  });
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
  const campus = getChip('#in-campus');
  /* 그 학교에 실제로 있는 학과 목록을 확보한 곳은 **그 목록만** 쓴다.
     예전엔 전국 공통 목록을 뒤에 붙여서, 외대에서 '일'을 치면 학교에 없는
     '일어일문학과'가 같이 떴다(2026-08-02 개발자 지적 — 경희대 사례).
     캠퍼스별로 학과가 다른 학교는 '학교 캠퍼스' 열쇠를 먼저 본다. */
  const own = MAJORS_BY_SCHOOL[`${school} ${campus}`] || MAJORS_BY_SCHOOL[school];
  const pool = own || MAJORS_COMMON;   // 확보 못 한 학교는 전국 공통 목록을 힌트로
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
    $('#in-region').value = p.region || '';
    $('#in-parent-region').value = p.parentRegion || '';
    $('#in-nationality').value = p.nationality || 'korean';
    $('#in-credits').value = p.credits != null ? p.credits : '';
    $('#in-birth-year').value = p.birthYear || '';
    $$('#in-flags input').forEach((cb) => (cb.checked = p.flags.includes(cb.value)));
    $('#in-sensitive-ok').checked = !!(state.consent && state.consent.sensitive);
  } else {
    setChip('#in-track', 'humanities');
    setChip('#in-year', '1');
    setChip('#in-status', '재학');
    $('#in-nationality').value = 'korean';
  }

  renderCampusChips(p ? p.campus : null);
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
    /* 적합도 판정에 쓰는 값들 — 자격 요건의 37%(학적상태)·9%(학점)·7%(거주지)를 연다.
       빈 칸은 null로 둔다. **모르면 판정하지 않는 것**이 이 앱의 규칙이라, 0이나 기본값을
       넣으면 안 된다(엉뚱한 0% 판정이 난다). 설계: docs/designs/fit-score.md */
    region: $('#in-region').value || null,
    parentRegion: $('#in-parent-region').value || null,
    nationality: $('#in-nationality').value || null,
    credits: $('#in-credits').value.trim() === '' ? null : Number($('#in-credits').value),
    birthYear: $('#in-birth-year').value.trim() === '' ? null : Number($('#in-birth-year').value),
    flags: $$('#in-flags input:checked').map((c) => c.value),
    cert: $('#in-cert').checked,
    exchange: $('#in-exchange').checked,
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

/* 신청서를 채우며 배운 값 — 온보딩에는 칸이 없고 '다음에도 쓸게요'로만 쌓인다.
   MY 화면에서 언제든 보고 지울 수 있어야 한다(개인정보는 학생의 것이다). */
const LEARNED_COMMON = [
  ['gender', '성별'], ['addr', '주소'], ['emergency', '긴급연락처'],
  ['guardianName', '보호자 성명'], ['guardianRel', '보호자와의 관계'], ['guardianPhone', '보호자 연락처'],
  ['rrn', '주민등록번호'],
];

/* 적합도 배지 — **숫자만 두지 않는다** (2026-08-24 · docs/designs/fit-score.md).
   개발자 지적: "적합도 높은 줄 알고 들어갔는데 신청을 못 하면 피로감이 쌓여 앱을 안 쓰게 된다."
   그래서 퍼센트 옆에 근거를 함께 적어, 학생이 **누르기 전에** 판단할 수 있게 한다.
     · 0%      → 왜 안 되는지 (미달 사유)
     · 미확인   → 앱이 자격을 못 읽었음을 밝힌다 (지어내지 않는다 — 원칙 8-1)
     · 그 외    → 요건 n개 중 m개 충족 */
function fitBadgeHtml(fit, fd) {
  if (!fd) return fit > 0 ? `<span class="badge badge-fit">적합도 ${fit}%</span>` : '';
  if (fd.unread) return '<span class="badge badge-fit-unknown">자격 미확인</span>';
  if (fd.pct === 0) return '<span class="badge badge-fit-no">지원 자격 미달</span>';
  const note = fd.unknown > 0 ? ` · 확인 필요 ${fd.unknown}` : '';
  return `<span class="badge badge-fit">적합도 ${fd.pct}% <em>요건 ${fd.total}개 중 ${fd.met}개 충족${note}</em></span>`;
}

/* ---------------- 카드 렌더링 ---------------- */
function schCard(sch, result, { compact = false, fit = 0, fd = null } = {}) {
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const applied = state.applications.some((a) => a.id === sch.id);
  return `
    <button class="sch-card" data-detail="${sch.id}">
      <div class="sch-top">
        <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
        ${sch.program ? '<span class="badge badge-program">상시 제도</span>' : `<span class="badge badge-dday ${d.cls}">${d.label}</span>`}
        ${sch.auto ? '<span class="badge badge-auto">자동 등록 · 검수 전</span>' : ''}
        ${applied ? '<span class="badge badge-applied">신청함</span>' : ''}
        ${fitBadgeHtml(fit, fd)}
      </div>
      <p class="sch-name">${esc(sch.name)}</p>
      <p class="sch-amount">${esc(sch.amount)}</p>
      ${compact ? '' : `<p class="sch-provider">${esc(sch.provider)}</p>`}
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
  /* '지금 받을 수 있는' 이라고 말하려면 **정말 지금 신청할 수 있어야** 한다 (2026-08-02 개발자 지적).
     예전엔 자격 판정만 보고 마감을 안 봐서, 히어로의 금액 합계와 '바로 신청 n건'에
     **이미 마감된 공고가 섞여** 실제보다 부풀려져 있었다. */
  const applyable = matches.filter((m) =>
    ['eligible', 'selective'].includes(m.result.status) && dday(m.sch.deadline).days >= 0 && notStale(m.sch));
  const notApplied = applyable.filter((m) => !state.applications.some((a) => a.id === m.sch.id));
  const total = applyable.reduce((sum, m) => sum + (m.sch.amountValue || 0), 0);
  const unknownAmt = applyable.filter((m) => !m.sch.amountValue).length;

  countUp($('#hero-amount'), total, (v) => `최대 ${won(v)}`);
  $('#hero-count').textContent = `바로 신청 ${applyable.filter((m) => m.result.status === 'eligible').length}건 · 선발 심사형 ${applyable.filter((m) => m.result.status === 'selective').length}건${unknownAmt ? ` · 금액 미확인 ${unknownAmt}건 제외` : ''}`;

  const btn = $('#btn-apply-all');
  btn.disabled = notApplied.length === 0;
  btn.textContent = notApplied.length ? `⚡ ${notApplied.length}건 한 번에 신청 준비하기` : '✓ 가능한 장학금을 모두 준비했어요';

  const upcoming = applyable
    .filter((m) => dday(m.sch.deadline).days >= 0 && notStale(m.sch))
    .sort((a, b) => deadlineTs(a.sch) - deadlineTs(b.sch))
    .slice(0, 3);
  $('#home-deadline-list').innerHTML = upcoming.length
    ? upcoming.map((m) => schCard(m.sch, m.result, { compact: true, fit: m.fit, fd: m.fd })).join('')
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
    deadlineTs(a.sch) - deadlineTs(b.sch)
  );

  list = list.filter((m) => dday(m.sch.deadline).days >= -CLOSED_KEEP_DAYS); // 마감 1주일 경과 시 자동 숨김
  list = list.filter((m) => notStale(m.sch)); // 마감을 확정 못 한 공고는 등록 후 60일까지만 노출
  if (exploreFilter === '교내' || exploreFilter === '교외') list = list.filter((m) => m.sch.type === exploreFilter);
  /* '신청 가능만'은 **정말 지금 신청할 수 있는 것**만 보여야 한다 (2026-08-02 개발자 지적).
     예전엔 자격 판정(status)만 보고 마감을 안 봐서, 자격이 맞으면 **이미 마감된 공고도** 떴다.
     상시 제도(마감일 없음)는 dday가 days:14를 주므로 그대로 남는다 — 실제로 상시 신청 가능하다. */
  if (exploreFilter === 'eligible') {
    list = list.filter((m) => ['eligible', 'selective'].includes(m.result.status) && dday(m.sch.deadline).days >= 0);
  }

  $('#live-notices').innerHTML = exploreFilter === 'all' ? liveNoticesHtml() : '';
  $('#explore-list').innerHTML = list.length
    ? list.map((m) => schCard(m.sch, m.result, { fit: m.fit, fd: m.fd })).join('')
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

/* 🔴 이름 주의 — 이 함수는 **AI가 아니다.** 네트워크 호출이 0건인 고정 문장 조립기다.
   2026-08-23까지 버튼 이름이 'AI 초안 만들기'였는데 학생은 AI가 써 준 줄 알고 눌렀다.
   원칙 1(정직한 신청 상태)의 계열 문제라 이름을 '초안 문장 만들기'로 고쳤다.
   진짜 AI 초안은 등록 양식 쪽(essay.js + server/essay/)에 붙어 있다 —
   나중에 이 자유서식 도우미까지 그쪽으로 잇게 되면 그때 이름을 되돌릴 것. */
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
        <p class="sheet-provider">${sch.name} · 답을 고르면 그 답으로 초안 문장을 엮어 드려요</p>
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
        <button class="btn btn-primary btn-lg" id="btn-dp-generate">초안 문장 만들기</button>
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
  /* 프로필이 바뀌었을 수 있으니 질문 설계를 다시 짠다 */
  if (typeof formInvalidatePlan === 'function') formInvalidatePlan();
  renderFormFill();
}

function renderFormFill() {
  const sch = findSch(formFill.schId);
  const tpl = FORM_TEMPLATES[formTplIdFor(sch)];
  const sheet = $('#detail-sheet');

  if (formFill.stage === 'q') {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">${tpl.unofficial ? '지원문서 작성 도우미' : '양식 작성 도우미'}</h3>
        <p class="sheet-provider">${esc(tpl.title)} · ${tpl.unofficial ? '자유 형식 제출 공고라 이 문서를 그대로 제출할 수 있어요' : '실제 공고 양식과 동일한 문서가 만들어져요'}</p>
        ${formQuestionsHtml(tpl)}
        ${typeof essayButtonHtml === 'function' ? essayButtonHtml(tpl) : ''}
        <button class="btn btn-primary btn-lg" id="btn-ff-generate">양식 문서 만들기</button>
        <p class="dp-note">앱이 이미 아는 정보는 묻지 않고 채워요 — 위 '프로필에서 채웠어요'를 열어 확인·수정할 수 있어요.</p>
      </div>`;
    /* AI 초안 버튼 — essay-config.js 의 endpoint 가 비어 있으면 버튼 자체가 없다 */
    if (typeof essayBind === 'function') essayBind(tpl, sch);
    $('#btn-ff-generate').addEventListener('click', () => {
      formFill.ans = collectFormAnswers(tpl);
      /* '다음 신청서에도 쓸게요'를 켜 둔 항목은 프로필에 남긴다 —
         두 번째 신청서부터는 그 질문이 아예 안 나온다 (기기 안에만 저장) */
      const kept = typeof formKeepToProfile === 'function' ? formKeepToProfile() : 0;
      if (kept) { saveState(); if (typeof formInvalidatePlan === 'function') formInvalidatePlan(); }
      formFill.stage = 'preview';
      renderFormFill();
    });
  } else {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">이대로 제출 준비할까요?</h3>
        <p class="sheet-provider">칸을 눌러 직접 수정할 수 있어요 · ${tpl.unofficial ? '자유 형식 제출용 지원문서' : '실제 공고 양식과 동일한 구조'}</p>
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
/* 학교별 파일을 읽는다 (2026-08-17). 예전에는 전 학교 공고가 든 data/notices.json을
   통째로 받아서 자기 학교 것만 골라 썼다 — 고려대 학생이 동국대 공고까지 받는 구조라
   파일이 커지지 않게 상한(학교 수 × 15건)이 필요했고, 학교가 41곳이 되면서 그 상한이
   실제로 물려 **바쁜 학교는 16건에서 잘리고** 있었다.
   지금은 자기 학교 파일 하나만 받으므로 받는 양이 크게 줄고(476KB → 10KB 안팎)
   상한도 필요 없다. 파일 이름 규칙은 match-engine.js의 noticeFileFor 한 곳에 있다.

   ⚠️ 옛 파일(data/notices.json)로 물러나는 길을 남겨 둔다 — 학교별 파일이 아직 없거나
   (그 학교 첫 수집 전) 배포가 엇갈린 순간에도 화면이 비지 않게. */
function loadNotices() {
  const p = state.profile;
  const files = (typeof noticeFilesForProfile === 'function' && p) ? noticeFilesForProfile(p) : [];
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const job = files.length
    ? Promise.all(files.map(get)).then((docs) => {
      const ok = docs.filter(Boolean);
      if (!ok.length) return get('data/notices.json');    // 아직 학교별 파일이 없는 학교
      return {
        updatedAt: ok.map((d) => d.updatedAt).filter(Boolean).sort().pop() || null,
        items: ok.flatMap((d) => d.items || []),
      };
    })
    : get('data/notices.json');
  job.then((d) => {
    if (!d) return;
    liveNotices = d;
    if (!$('#screen-explore').hidden) renderExplore();
  }).catch(() => { /* 오프라인 등 — 조용히 무시 */ });
}

/* 자유 형식 지원문서 연결 (2026-07-15): 공고가 별도 양식 없이 자유 형식 제출을
   받는다고 '원문으로 확인된' 공고(prepDoc)에만 질문형 문서 작성 흐름을 붙인다.
   공식 양식(formId)과 구분되도록 prepFormId로만 연결 — 채널 라벨은 그대로 유지. */
function attachPrepTemplates(list) {
  if (typeof FORM_TEMPLATES === 'undefined' || typeof buildPrepTemplate !== 'function') return;
  for (const s of list) {
    // 개발자 지시(2026-07-15): 앱 제작 지원문서는 '문서 제출이 실제로 가능하다고
    // 원문으로 확인된 공고(prepDoc: true)'에만 붙인다 — 나머지는 원문 발췌·링크만.
    if (!s.prepDoc || s.formId || s.program) continue;
    const pid = 'prep:' + s.id;
    FORM_TEMPLATES[pid] = buildPrepTemplate(s);
    s.prepFormId = pid;
  }
}

/* 이 공고에서 쓸 양식 템플릿 id — 공식 양식이 우선, 없으면 준비용 문서 */
function formTplIdFor(sch) {
  if (typeof FORM_TEMPLATES === 'undefined') return null;
  if (sch.formId && FORM_TEMPLATES[sch.formId]) return sch.formId;
  if (sch.prepFormId && FORM_TEMPLATES[sch.prepFormId]) return sch.prepFormId;
  return null;
}

/* 학교별 학과 목록 (2026-08-06 — 커리어넷 오픈API에서 수확, collector/majors.mjs가 발행).
   MAJORS_BY_SCHOOL에 합쳐서 학과 자동추천이 '그 학교에 실제로 있는 학과'만 보여 주게 한다
   (경희대에서 '일'을 치면 없는 일어일문학과가 뜨던 문제 — 2026-08-02 개발자 지적).
   손으로 검수해 둔 목록(외대)이 이미 있으면 그쪽을 지키고 덮어쓰지 않는다. */
function loadMajors() {
  fetch('data/majors.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d || !d.bySchool) return;
      for (const [school, majors] of Object.entries(d.bySchool)) {
        if (!MAJORS_BY_SCHOOL[school]) MAJORS_BY_SCHOOL[school] = majors;
      }
    })
    .catch(() => { /* 오프라인 등 — 전국 공통 목록으로 동작 */ });
}

/* 정식 등록 공고 (수집 → 큐레이션 → 매칭·신청 지원) */
function loadRegistered() {
  fetch('data/registered.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      registeredList = (d && d.items) || [];
      attachPrepTemplates(registeredList);
      if (state.profile) {
        if (!$('#screen-home').hidden) renderHome();
        if (!$('#screen-explore').hidden) renderExplore();
      }
    })
    .catch(() => { /* 오프라인 등 — 조용히 무시 */ });
}

function liveNoticesHtml() {
  const p = state.profile;
  if (!liveNotices || !p) return '';
  // 정식 등록된 공고(registered.json + data.js 실공고)는 카드로 노출되므로 피드에서 제외
  // URL 뒤에 목록 파라미터가 붙는 경우가 있어 전방일치로 비교한다
  const regUrls = registeredList.map((s) => s.sourceUrl)
    .concat(NATIONAL_SCHOLARSHIPS.filter((s) => s.sourceKind === 'official' && s.sourceUrl).map((s) => s.sourceUrl))
    .filter(Boolean);
  const isRegistered = (url) => regUrls.some((u) => url.startsWith(u) || u.startsWith(url));
  /* 내 학교 공고인지는 match-engine이 정한다 — 알림(notify-rules)도 같은 함수를 쓴다 */
  const forMe = (liveNotices.items || []).filter((n) => noticeForProfile(n, p) && !isRegistered(n.url));
  /* 학자금 대출·융자는 장학금이 아니라서 매칭 카드로는 만들지 않는다(정직 원칙).
     그렇다고 피드에서까지 밀려 잘리면 학생이 대출 정보를 아예 볼 곳이 없어지므로,
     장학 공고를 앞에 두되 대출 공고 자리 2칸을 따로 남겨 둔다 (2026-07-30 조정). */
  const isLoan = (n) => /대출|융자/.test(n.title);
  const scholarships = forMe.filter((n) => !isLoan(n));
  const loans = forMe.filter(isLoan);
  const mine = scholarships.slice(0, loans.length ? 8 : 10).concat(loans.slice(0, 2));
  const head = `<div class="section-head" style="margin-top:4px"><h3>우리 학교 실시간 공고</h3>
    <span class="link-btn">매일 아침 자동 갱신${liveNotices.updatedAt ? ' · ' + liveNotices.updatedAt : ''}</span></div>`;
  if (!mine.length) {
    return head + `<p class="empty" style="margin-bottom:16px">아직 ${esc(p.school)} 게시판이 연결 전이거나 새 공고가 없어요.<br />연결되면 실제 공고가 여기에 자동으로 떠요.</p>`;
  }
  return head + `<div class="card-list" style="margin-bottom:18px">` + mine.map((n) => `
    <a class="sch-card notice-card" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener">
      <div class="sch-top">
        <span class="badge badge-in">교내 공고</span>
        ${n.deadlineHint ? `<span class="badge badge-dday urgent">⏰</span>` : ''}
        ${(n.attachments || []).length ? `<span class="badge badge-applied">양식 ${n.attachments.length}</span>` : ''}
      </div>
      <p class="sch-name">${esc(n.title)}</p>
      ${n.deadlineHint && !/window\.|dataLayer|function|\)\s*\)/.test(n.deadlineHint) ? `<p class="sch-provider">⏰ ${esc(n.deadlineHint)}</p>` : ''}
      <p class="sch-provider">${esc(n.school)}${n.campus ? ' ' + esc(n.campus) : ''} · ${esc(n.foundAt || '')} 수집 · ${isBoardListLink(n.url) ? '게시판 목록에서 보기 ↗' : '원문 보기 ↗'}</p>
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
  if (formTplIdFor(sch)) { // 공식 양식 또는 준비용 지원문서
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

/* ══════════════════════════════════════════════════════════════════════════
   일괄 신청 준비 (2026-08-25 개발자 지시로 재설계)

   예전엔 브라우저 기본 `confirm()` 창 하나였다. 그 창은 앱이 아니라 **브라우저가**
   만드는 것이라 확인·취소 두 버튼밖에 못 넣는다 — 그래서 지원자격도 금액도 안 보이고,
   원하지 않는 장학금을 **한 건도 뺄 수 없었다**(전부 담거나 전부 취소).

   지금은 앱이 만든 목록이다. 겉에 보이는 것은 넷 — 체크 · 제목 · 자격 단어 · 금액.
   마감·배지·제출처·자격 원문은 '더보기' 안에 접는다(2026-08-25 개발자 지시).

   🔴 확인을 눌러도 학교·재단에 **실제 접수가 되는 것은 아니다**(운영원칙 1).
      일어나는 일은 '신청 준비 완료 상태로 신청내역에 담기는 것'이고, 화면 문구도 그렇게 적는다.
   🔴 시트 그릇은 #detail-sheet 를 그대로 쓴다 — 쓸어 닫기·배경 눌러 닫기·ESC 가 이미
      배선돼 있다. 새 시트를 만들면 그 배선을 또 해야 하고 한쪽만 고쳐져 갈라진다.
   ══════════════════════════════════════════════════════════════════════════ */
let bulkPrep = null;   // { list: [sch], ids: Set } — 목록이 열려 있는 동안만 산다

/* 서류(자소서·앱 양식)를 써야 끝나는 공고인가.
   🔴 신청내역의 '서류 작성 필요' 배지와 **같은 기준**이어야 한다 — 여기서 새 기준을
      만들면 두 화면이 같은 공고를 두고 다른 말을 한다. */
function bulkNeedsWork(sch) {
  return !!(essayDefsFor(sch).length
    || (sch.formId && typeof FORM_TEMPLATES !== 'undefined' && FORM_TEMPLATES[sch.formId]));
}

/* 일괄 준비 대상 — 자격 통과 · 아직 안 담음 · 마감 전 · 오래되지 않음.
   ⚠️ 목록을 **열 때와 확인을 누를 때 둘 다** 이 함수를 쓴다. 열 때만 거르면
      목록을 한참 보다가 자정을 넘겨 확인한 학생이 마감된 공고를 담게 된다. */
function bulkTargets() {
  return getMatches()
    .filter((m) => ['eligible', 'selective'].includes(m.result.status))
    .filter((m) => !state.applications.some((a) => a.id === m.sch.id))
    .filter((m) => dday(m.sch.deadline).days >= 0 && notStale(m.sch))
    .map((m) => m.sch)
    .sort((a, b) => deadlineTs(a) - deadlineTs(b));   // 마감일을 겉에 안 써도 급한 것이 위로
}

/* 지원 자격을 **단어로** 옮긴다.
   🔴 원문 문장을 잘라 단어를 만들지 않는다 — 자르면 뜻이 바뀐다. 등록할 때 이미
      구조로 저장해 둔 값(sch.eligibility)만 옮긴다 — evaluate() 가 읽는 그 값이다.
      하나도 없으면 지어내지 않고 '자격 원문 확인'이라고 말한다(원칙 8-1).
   순수 함수라 브라우저 없이 검사할 수 있다. */
/* 학적상태 낱말에 '생'을 붙일지 — `복학예정생`·`초과학기생`은 말이 안 된다 */
const BULK_STATUS_WORD = {
  재학: '재학생', 휴학: '휴학생', 졸업: '졸업생', 수료: '수료생', 대학원: '대학원생',
  복학예정: '복학예정', 초과학기: '초과학기', 졸업유예: '졸업유예', 자퇴: '자퇴',
};

/* 파서가 읽어 낸 조건 하나 → 화면에 띄울 낱말.
   🔴 숫자·지역·학적은 **원문에서 읽어 낸 값 그대로** 쓴다. 앱이 보태는 것은 조사뿐이다. */
function bulkCondWords(c, L) {
  const S = (typeof GRADE_SCALE !== 'undefined' && GRADE_SCALE) || {};
  switch (c.kind) {
    case 'grade':
      if (c.min == null) return [];
      /* 단위를 섞으면 재앙이다 — 백분위 70을 평점 70으로 적으면 학생이 오해한다 */
      if (c.scale === S.percent) return [`백분위 ${c.min} 이상`];
      if (c.scale === S.letter) return [`${c.min} 이상`];
      return [`평점 ${c.min} 이상`];
    case 'bracket': return c.max == null ? [] : [`소득 ${c.max}구간 이하`];
    case 'credits':
      if (c.min != null) return [`${c.min}학점 이상`];
      return c.max != null ? [`${c.max}학점 이하`] : [];
    case 'year':
      if (c.eq != null) return [`${c.eq}학년`];
      if (c.min != null) return [`${c.min}학년 이상`];
      return c.max != null ? [`${c.max}학년 이하`] : [];
    case 'status':
      return (c.anyOf || []).map((x) => BULK_STATUS_WORD[x] || x)
        .concat((c.not || []).map((x) => (BULK_STATUS_WORD[x] || x) + ' 제외'));
    case 'flags': return (c.anyOf || []).map((f) => L[f] || f);
    case 'nationality': return [c.eq === 'foreign' ? '외국인 유학생' : '대한민국 국적'];
    case 'age': return c.max == null ? [] : [`만 ${c.max}세 이하`];
    case 'residence': return (c.anyOf || []).slice(0, 2).map((r) => r + ' 거주');
    default: return [];
  }
}

/* 지원 자격을 **단어로** 옮긴다. 두 곳에서 가져온다.
   ① 등록할 때 사람이 구조로 넣어 둔 값(sch.eligibility) — evaluate() 가 읽는 그 값.
   ② 공고 원문 자격 줄 — 화면·적합도가 이미 쓰는 파서(parse-requirements.js)로 읽는다.
   ②가 필요한 이유: 등록 데이터의 eligibility 는 실제로 대부분 selective 하나뿐이라
   ①만 쓰면 거의 모든 공고가 '자격 원문 확인'으로만 뜬다(실측으로 확인).
   🔴 어느 쪽도 지어내지 않는다 — 문장을 잘라 만들지도 않는다. 원문에 실제로 적힌
      숫자·지역·자격만 읽어 조사만 붙인다. 하나도 못 읽으면 '자격 원문 확인'이다(원칙 8-1).
   순수 함수라 브라우저 없이 검사할 수 있다. */
const BULK_TAG_MAX = 5;
function bulkTags(sch) {
  const out = [];
  const add = (label) => { if (label && !out.includes(label)) out.push(label); };
  const e = (sch && sch.eligibility) || {};
  const L = (typeof FLAG_LABELS !== 'undefined' && FLAG_LABELS) || {};

  if (e.schoolOnly) add('우리 학교 공고');
  if (e.flagsAny) e.flagsAny.forEach((f) => add(L[f] || f));
  if (e.minGpa != null) add(`평점 ${e.minGpa} 이상`);
  if (e.maxBracket != null) add(`소득 ${e.maxBracket}구간 이하`);
  if (e.freshmanOnly) add('신입생만');
  else if (e.years && e.years.length) add(`${e.years.join('·')}학년`);
  if (e.tracks && e.tracks.length && typeof TRACKS !== 'undefined') {
    e.tracks.forEach((id) => {
      const tr = TRACKS.find((x) => x.id === id);
      if (tr) add(tr.label);
    });
  }
  if (e.seoulOnly) add('서울 거주');
  if (e.needCert) add('외국어성적');
  if (e.exchange) add('교환학생 예정');

  if (typeof parseLine === 'function' && typeof requirementLines === 'function') {
    for (const line of requirementLines(sch) || []) {
      if (out.length >= BULK_TAG_MAX) break;
      /* 대학원 전용 줄은 학부생 화면에 띄우지 않는다 — 파서가 이미 가려 준다 */
      if (typeof gradOnly === 'function' && gradOnly(line)) continue;
      for (const c of (parseLine(line).conds || [])) bulkCondWords(c, L).forEach(add);
    }
  }
  return out.length ? out.slice(0, BULK_TAG_MAX) : ['자격 원문 확인'];
}

/* 목록 한 줄. 겉은 넷(체크·제목·자격 단어·금액)이고 나머지는 <details> 안이다.
   <details> 는 브라우저가 이미 가진 접기 기능이라 여닫는 코드가 한 줄도 필요 없다. */
function bulkRowHtml(sch) {
  const on = bulkPrep.ids.has(sch.id);
  const d = dday(sch.deadline);
  const reqs = (typeof requirementLines === 'function' ? requirementLines(sch) : []).slice(0, 6);
  return `
    <div class="bulk-row${on ? '' : ' off'}" data-row="${esc(sch.id)}">
      <input type="checkbox" class="bulk-check" data-bulk="${esc(sch.id)}" ${on ? 'checked' : ''}
        aria-label="${esc(sch.name)} 준비 목록에 넣기" />
      <div class="bulk-main">
        <p class="bulk-name">${esc(sch.name)}${bulkNeedsWork(sch) ? '<span class="badge badge-pending">서류 작성 필요</span>' : ''}</p>
        <p class="bulk-tags">${bulkTags(sch).map((x) => `<span class="chip-sm">${esc(x)}</span>`).join('')}</p>
        <p class="bulk-amount">${esc(sch.amount || '금액 원문 확인')}</p>
        <details class="bulk-more">
          <summary>더보기</summary>
          <div class="bulk-badges">
            <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${esc(sch.type)}</span>
            ${sch.program ? '<span class="badge badge-program">상시 제도</span>' : `<span class="badge badge-dday ${d.cls}">${d.label}</span>`}
            ${sch.auto ? '<span class="badge badge-auto">자동 등록 · 검수 전</span>' : ''}
          </div>
          <p class="bulk-meta">${sch.deadline
            ? `마감 ${esc(sch.deadline.replace(/-/g, '.'))}`
            : '마감 기한을 아직 읽지 못했어요 — 공고 원문에서 꼭 확인하세요'}</p>
          <p class="bulk-meta">${esc(submitChannelLabel(sch))}</p>
          ${reqs.length
            ? `<p class="bulk-meta-head">지원자격 (공고 원문)</p><ul class="bulk-reqs">${reqs.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`
            : '<p class="bulk-meta">지원 자격을 아직 읽지 못했어요 — 공고 원문에서 확인하세요</p>'}
        </details>
      </div>
    </div>`;
}

function renderBulkPrep() {
  const targets = bulkPrep.list;
  const ready = targets.filter((sch) => !bulkNeedsWork(sch));
  const need = targets.filter(bulkNeedsWork);
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">한 번에 신청 준비</h3>
      <p class="sheet-provider" id="bulk-sum"></p>
      <label class="bulk-all"><input type="checkbox" id="bulk-all" checked /> 전체 선택</label>
      ${ready.length ? `<p class="bulk-group-head">바로 준비돼요 · ${ready.length}건</p>${ready.map(bulkRowHtml).join('')}` : ''}
      ${need.length ? `<p class="bulk-group-head">서류를 써야 해요 · ${need.length}건</p>${need.map(bulkRowHtml).join('')}
        <p class="dp-note">이 ${need.length}건은 담아 둔 뒤 신청내역에서 자소서·신청서를 이어서 쓰면 돼요.</p>` : ''}
      <button class="btn btn-primary btn-lg" id="btn-bulk-go"></button>
      <p class="dp-note">※ 최종 제출은 한국장학재단·학교 등 공식 채널에서 이루어져요.</p>
    </div>`;
  bulkRefresh();
  $('#detail-sheet').scrollTop = 0;
}

/* 체크를 눌렀을 때 **목록을 다시 그리지 않는다** — 다시 그리면 펼쳐 둔 '더보기'가 접히고
   스크롤이 맨 위로 튄다. 바뀌는 것(줄 흐리기·합계·버튼)만 손댄다. */
function bulkRefresh() {
  const picked = bulkPrep.list.filter((sch) => bulkPrep.ids.has(sch.id));
  const total = picked.reduce((sum, sch) => sum + (sch.amountValue || 0), 0);
  /* 금액을 확인 못 한 공고는 합계에 넣지 않는다 — 지어낸 숫자를 섞지 않는다(원칙 8-1).
     홈 히어로의 '금액 미확인 n건 제외'와 같은 규칙이다. */
  const unknown = picked.filter((sch) => !sch.amountValue).length;
  $('#bulk-sum').textContent = `선택 ${picked.length}건 · 최대 ${won(total)}${unknown ? ` · 금액 미확인 ${unknown}건 제외` : ''}`;
  const all = $('#bulk-all');
  if (all) all.checked = picked.length === bulkPrep.list.length;
  $$('#detail-sheet [data-bulk]').forEach((box) => {
    const row = box.closest('.bulk-row');
    if (row) row.classList.toggle('off', !box.checked);
  });
  const go = $('#btn-bulk-go');
  go.disabled = !picked.length;
  go.textContent = `선택한 ${picked.length}건 준비하기`;
}

function bulkStart() {
  /* 🔴 담기 직전에 마감을 한 번 더 본다. 목록을 열 때만 걸렀다면, 한참 보다가 자정을
     넘겨 확인한 학생이 마감된 공고를 담게 된다. 빠진 건은 조용히 버리지 않고 알린다. */
  const live = new Set(bulkTargets().map((sch) => sch.id));
  const picked = bulkPrep.list.filter((sch) => bulkPrep.ids.has(sch.id));
  const gone = picked.filter((sch) => !live.has(sch.id));
  const go = picked.filter((sch) => live.has(sch.id));
  if (!go.length) {
    closeSheet();
    toast(gone.length ? '고른 장학금이 그 사이 모두 마감됐어요' : '준비할 수 있는 장학금이 없어요');
    return;
  }
  const need = go.filter(bulkNeedsWork);
  go.forEach((sch) => state.applications.push({
    id: sch.id, appliedAt: nowStamp(), step: 0, docs: null, pending: bulkNeedsWork(sch),
  }));
  saveState();
  closeSheet();
  const goneMsg = gone.length ? ` · ${gone.length}건은 그 사이 마감돼 빼놓았어요` : '';
  toast(need.length
    ? `${go.length - need.length}건 준비 완료 · ${need.length}건은 신청내역에서 서류를 이어서 쓰세요${goneMsg}`
    : `장학금 ${go.length}건 신청 준비가 완료됐어요 🎉${goneMsg}`);
  showScreen('applications');
}

function applyAll() {
  const targets = bulkTargets();
  if (!targets.length) { toast('준비할 수 있는 장학금이 없어요'); return; }
  bulkPrep = { list: targets, ids: new Set(targets.map((sch) => sch.id)) };
  openSheetShell();
  renderBulkPrep();
}

/* ---------------- 상세 바텀시트 ---------------- */
function openDetail(id) {
  const sch = findSch(id);
  if (!sch) return;
  const result = evaluate(sch, state.profile);
  const fit = fitScore(sch, result, state.profile);
  const fd = fitDetail(sch, state.profile);
  const meta = STATUS_META[result.status];
  const d = dday(sch.deadline);
  const app = state.applications.find((a) => a.id === id);
  const canApply = ['eligible', 'selective'].includes(result.status) && (!app || app.pending) && d.days >= 0;
  const ch = officialChannel(sch);

  /* 공고 원문에 적힌 자격 문장을 **그대로** 덧붙인다 (2026-08-02 개발자 지시).
     소득·학년 같은 구조화된 조건이 일부 있어도 그게 요건의 전부가 아니다 — 5·18희망장학생의
     '민주화운동·국가폭력 피해자 유자녀' 같은 항목은 기계 조건으로 잡히지 않는다.
     그래서 조건 유무와 상관없이 **항상** 보여 준다. 추론이 아니라 원문 발췌라 원칙 8-1을 지킨다. */
  const QUALIFY_RE = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
  /* eligibilityLines = 공고의 자격 항목을 **블록째** 뽑아 둔 것(1) 2) …).
     없으면 자격 낱말이 든 발췌 문장이라도 보여 준다. */
  const qBlock = (sch.eligibilityLines || []).filter((l) => !QUALIFY_RE.test(l) || l.length > 14);
  const qLines = qBlock.length ? qBlock : (sch.excerpts || []).filter((e) => QUALIFY_RE.test(e));

  /* '재학 대학 공고 (○○대)'는 자격이 아니라 **이 공고가 우리 학교 것**이라는 범위 표시다.
     초록 체크로 띄우면 "자격이 된다"로 읽혀 모순이 된다(2026-08-02 개발자 지적) — 카드 자체가
     이미 그 학교 학생에게만 보이므로 통과 쪽은 아예 빼고, 학교가 다른 경우(✕)만 남긴다. */
  const isScopeOk = (r) => /^재학 대학 공고/.test(r);
  const judged = result.reasons.filter((r) => !isScopeOk(r));

  const checkRows = judged.map((r) => {
    const bad = /필요|아니에요|가능$/.test(r) && !/충족|확인/.test(r);
    return `<li class="${bad ? 'r-bad' : 'r-ok'}">${bad ? '✕' : '✓'} ${esc(r)}</li>`;
  }).join('')
    + result.missing.map((m) => `<li class="r-unk">? ${esc(m)} 정보를 입력하면 정확히 판단할 수 있어요</li>`).join('');

  /* 지원 자격 한 덩어리 — 원문 요건을 먼저 보여 주고, 그 아래에 '내 정보로 확인한 것'을 붙인다.
     앱이 판정할 수 있는 건 성적·소득구간·학년 같은 숫자 조건뿐이고, 원문의 '유자녀' 같은 항목은
     판정할 수 없다. 그래서 두 묶음을 **구분해서** 보여 준다 — 섞으면 앱이 다 판정한 것처럼 읽힌다. */
  let reasonRows = '';
  /* 'AI가 읽음 · 검수 전' — '자동 등록 · 검수 전' 배지와 같은 규칙(2026-08-23).
     사람이 검수하지 않았다는 사실을 숨기지 않는다. 관리자 화면에서 컨펌하면
     eligibilityReviewed 가 true 가 되어 사라진다. */
  const aiRead = /^AI/.test(sch.eligibilityFrom || '') && sch.eligibilityReviewed !== true;
  /* 요건은 원문을 통째로 붙이지 않고 **짧게 다듬어 번호를 매겨** 보여 준다.
     프로필과 확실히 맞으면 ✓, 확실히 안 맞으면 ✕, 판정할 수 없으면 색 없이 둔다
     (2026-08-02 개발자 지시). 판정 규칙은 match-engine에 있어 알림과 갈라지지 않는다. */
  const reqLines = requirementLines(sch);
  /* 요건 한 줄을 그리는 법 — 구조 렌더와 평평한 렌더가 **같은 함수**를 쓴다.
     따로 두면 한쪽만 고쳐져서 두 모양의 판정이 갈라진다. */
  const reqRow = (e, extra) => {
    const m = requirementMatch(e, state.profile, sch);
    const cls = m === 'ok' ? 'r-ok' : m === 'no' ? 'r-bad' : 'r-req';
    const mark = m === 'ok' ? '✓ ' : m === 'no' ? '✕ ' : '';
    return `<li class="${cls}${extra ? ' ' + extra : ''}">${mark}${esc(e)}</li>`;
  };

  /* 원문이 표인 공고 — 공통 / 둘 중 하나 / 성적을 갈라서 그린다 (2026-08-23).
     평평하게 늘어놓으면 '둘 중 하나'가 '둘 다'로 읽혀 뜻이 정반대가 된다
     (동국대 종단추천장학: 신규 지원자가 "기수혜자여야 한다"로 읽고 포기했다).
     🔴 갈래가 둘 이상인 공고에서만 이 모양이 나온다 — 나머지는 아래 평평한 렌더 그대로. */
  const reqStruct = requirementStruct(sch);
  if (reqStruct) {
    const must = [...reqStruct.common, ...reqStruct.grade];
    if (must.length) reasonRows += `<li class="r-head">모두 해당해야 해요</li>` + must.map((e) => reqRow(e)).join('');
    reasonRows += `<li class="r-head">아래 ${reqStruct.either.length === 2 ? '둘' : reqStruct.either.length + '가지'} 중 하나에 해당하면 돼요</li>`;
    reqStruct.either.forEach((b, i) => {
      /* 이름을 못 읽었으면 지어내지 않고 순서로만 가른다 (원칙 8-1) */
      reasonRows += `<li class="r-branch">${esc(b.label || `${i + 1}번째 경우`)}</li>`
        + b.lines.map((e) => reqRow(e, 'r-inbranch')).join('');
    });
  } else if (reqLines.length) {
    // 소제목을 달지 않는다 — 바깥 <h4>가 이미 '지원 자격'이라 두 번 나온다
    /* 번호(1) 2) 3))는 붙이지 않는다 — 요건은 순서가 아니라 목록이고,
       판정 못 한 줄에 번호만 달면 체크된 줄과 뒤섞여 어수선하다(2026-08-02 개발자 지시). */
    reasonRows += reqLines.map((e) => reqRow(e)).join('');
  } else if (requirementLines(sch, qLines).length) {
    // 자격 줄이 없으면 발췌 문장으로 물러나되, **같은 정리를 거쳐** 보여 준다
    reasonRows += requirementLines(sch, qLines)
      .map((e) => `<li class="r-req">${esc(e)}</li>`).join('');
  }
  /* 먼저 뽑는 기준 — 자격이 **아니지만** 학생에게 쓸모가 있다 (2026-08-21 개발자 지적).
     자격 블록에 섞으면 요건이 실제보다 훨씬 까다로워 보여 지원할 수 있는 학생이 포기한다
     (목포향우회: 진짜 자격은 한 줄인데 우선순위까지 5줄이 떠 있었다). 그래서 자리를 나눈다.
     🔴 판정(✓/✗)을 하지 않는다 — 충족해도 '된다'가 아니라 '먼저 본다'는 뜻이라
     초록 체크를 달면 거짓 안심이 된다(제외 대상과 같은 규칙). */
  /* 두 곳에서 모은다 — 수집기가 따로 갈라 둔 것 + **자격 줄에 섞여 있던 것**.
     뒤쪽이 없으면 `학년이 높은 학생`처럼 자격에서 뺀 줄이 그냥 사라진다(2026-08-24). */
  const priLines = [...new Set([
    ...requirementLines(sch, sch.eligibilityPriority || [], { keepPriority: true }),
    ...requirementLines(sch, sch.eligibilityLines || [], { keepPriority: true, onlyPriority: true }),
    /* 자격 칸이 비지 않게 되돌린 줄은 여기 또 쓰지 않는다 — 같은 문장이 두 블록에 뜬다 */
  ])].filter((t) => !reqLines.includes(t));
  if (priLines.length) {
    reasonRows += `<li class="r-head">자격을 갖춘 사람 중 먼저 뽑는 기준이에요</li>`
      + priLines.map((e) => `<li class="r-req">${esc(e)}</li>`).join('');
  }

  /* 제외 대상 — '누가 받을 수 있나'만큼 '누가 못 받나'도 자격 정보다 (2026-08-03 개발자 지적).
     판정하지 않고 원문 그대로 보여 준다 — 해당 여부는 학생이 안다. */
  /* 🔴 제외 줄은 **자격 줄 목록 안에도** 섞여 있다 (2026-08-24 개발자 지적).
     발췌기가 따로 뽑아 둔 eligibilityExcludes만 보면, 자격 절에 섞인 제외 줄이
     '지원 자격'으로 뜨거나(휴학생·자퇴생이 자격으로 떴다) 갈 곳이 없어 사라졌다.
     둘을 합쳐 넘기고, 무엇이 제외인지는 match-engine이 절 경계로 판정한다. */
  const exLines = requirementLines(
    sch, [...(sch.eligibilityExcludes || []), ...(sch.eligibilityLines || [])], { onlyExclude: true });
  if (exLines.length) {
    reasonRows += `<li class="r-head">이런 경우는 제외돼요</li>`
      + exLines.map((e) => `<li class="r-req">${esc(e)}</li>`).join('');
  }
  if (aiRead && reasonRows) {
    reasonRows = `<li class="r-ai">🤖 이 자격은 AI가 공고 원문에서 읽었어요 · 사람 검수 전</li>` + reasonRows;
  }
  if (checkRows) {
    reasonRows += `<li class="r-head">내 정보로 확인한 것</li>` + checkRows;
  }
  if (!reasonRows) {
    /* 원문 요건도 못 읽었고 판정할 조건도 없는 경우 — '제한이 없다'가 아니라 **모른다**는 뜻이다.
       원문에서 '제한 없음'을 확인한 공고만 eligibilityVerified로 확신 문구를 낸다. */
    reasonRows = sch.eligibilityVerified
      ? `<li class="r-ok">✓ 별도 자격 제한이 없는 공고예요${result.status === 'selective' ? ' — 지원자 중 선발 심사로 결정돼요' : ''}</li>`
      : `<li class="r-unk">? 지원 자격을 아직 읽지 못했어요 — 아래 원문에서 확인해 주세요${result.status === 'selective' ? ' (지원자 중 선발 심사로 결정돼요)' : ''}</li>`;
  }
  const missingRows = '';

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
        ${sch.program ? '<span class="badge badge-program">상시 제도</span>' : `<span class="badge badge-dday ${d.cls}">${d.label}</span>`}
        ${sch.auto ? '<span class="badge badge-auto">자동 등록 · 검수 전</span>' : ''}
        ${fitBadgeHtml(fit, fd)}
        <span class="status-pill pill-${meta.cls}">${meta.label}</span>
      </div>
      <h3 class="sheet-title">${esc(sch.name)}</h3>
      <p class="sheet-provider">${esc(sch.provider)} · ${esc(sch.period)}</p>
      <p class="sheet-amount">${esc(sch.amount)}</p>
      <p class="sheet-summary">${esc(sch.summary)}</p>

      <h4>지원 자격</h4>
      <ul class="reason-list">${reasonRows}${missingRows}</ul>
      <p class="doc-legend">앱이 확인할 수 있는 건 성적·소득구간·학년처럼 프로필에 있는 항목뿐이에요. 나머지 요건과 최신 내용은 ${sch.sourceUrl
        ? `<a href="${esc(safeUrl(sch.sourceUrl))}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:700">${sch.program ? '한국장학재단 ↗' : (isBoardListLink(sch.sourceUrl) ? '게시판 목록 ↗' : '원문 공고 ↗')}</a>에서`
        : '공고 원문에서'} 다시 확인하세요.</p>

      <h4>제출 서류</h4>
      <ul class="doc-list">
        ${sch.documents.map((doc) => {
          const auto = /자동/.test(doc);
          return `<li>${auto ? '<span class="doc-auto">자동</span>' : '<span class="doc-manual">직접</span>'} ${doc}</li>`;
        }).join('')}
      </ul>
      <p class="doc-legend">${sch.documents.some((doc) => /자동/.test(doc))
        ? `'자동' 표시 서류는 한국장학재단 등 제출처가 신청 과정에서 전산으로 확인하는 항목이에요 — 따로 준비해야 하는지는 공고 원문에서 확인하세요. `
        : ''}'직접' 서류 중 자기소개서·계획서·사유서·신청 양식은 앱에서 바로 작성할 수 있어요.</p>

      ${(sch.excerpts && sch.excerpts.length) ? `
      <h4>공고 원문 안내 <span class="channel-tag">원문 그대로</span></h4>
      <ul class="doc-list">${sch.excerpts.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      <p class="doc-legend">공고 본문에서 자동으로 그대로 가져온 문장이에요 — 전체 내용은 원문 공고 ↗에서 확인하세요.</p>` : ''}
      <p class="sheet-note">💡 ${esc(sch.note)}</p>
      ${(sch.attachments && sch.attachments.length) ? `
      <h4>공고 원본 첨부 양식</h4>
      <ul class="doc-list">
        ${sch.attachments.map((a) => `<li>📎 <a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener" style="color:var(--primary)">${esc(a.name)}</a></li>`).join('')}
      </ul>` : ''}
      <p class="sheet-deadline">${sch.program ? '신청 기간: 한국장학재단 공지 확인' : `마감일 ${sch.deadline || '원문 공고 확인'}`} · ${sch.duplicable ? '타 장학금과 중복 수혜 가능' : '중복 수혜 제한 있음'}${sch.sourceUrl ? ` · <a href="${esc(safeUrl(sch.sourceUrl))}" target="_blank" rel="noopener" style="color:var(--primary);font-weight:700">${sch.program ? '한국장학재단 ↗' : (isBoardListLink(sch.sourceUrl) ? '게시판 목록 ↗' : '원문 공고 ↗')}</a>` : ''}</p>
      ${(!sch.program && isBoardListLink(sch.sourceUrl)) ? `<p class="doc-legend">이 학교 게시판은 목록에서 글을 눌러야 열리는 방식이라 공고 하나로 바로 가는 주소를 확인하지 못했어요. 열리는 목록에서 <strong>${esc(boardListTitle(sch.sourceUrl))}</strong>을(를) 찾아 눌러 주세요.</p>` : ''}

      ${app && !app.pending ? (() => {
        const step = effectiveStep(app, sch);
        const stepLabels = APP_STEPS.map((s, i) => (i === 3 && app.result === 'lost') ? '결과 확인' : s);
        return `
        <div class="app-progress">
          ${stepLabels.map((s, i) => `
            <div class="ap-step ${i <= step ? 'done' : ''}">
              <span class="ap-dot"></span><span class="ap-label">${s}</span>
            </div>`).join('')}
        </div>
        <p class="applied-at">${app.appliedAt} 준비 완료 · 최종 제출처: ${ch.url ? `<a href="${esc(safeUrl(ch.url))}" target="_blank" rel="noopener">${esc(ch.label)}</a>` : esc(ch.label)}</p>
        ${step === 0 ? `
          <button class="btn btn-outline" id="btn-mark-submitted" style="width:100%;margin-bottom:6px">✅ 공식 제출을 마쳤어요 — 제출 완료로 기록</button>
          <p class="dp-note">최종 제출은 ${ch.label}에서 이루어져요. 제출을 마친 뒤 눌러 주시면 진행 단계가 넘어가요.</p>` : ''}
        ${step === 1 ? `
          <p class="progress-note">📮 ${app.submittedAt} 공식 제출 기록됨${sch.deadline ? ` · 접수 마감(${sch.deadline}) 후 자동으로 심사 단계로 표시돼요` : ''}</p>
          <button class="link-btn" id="btn-undo-progress" style="margin-bottom:10px">제출 기록 취소</button>` : ''}
        ${step === 2 ? `
          <p class="progress-note">🔍 접수가 마감되어 심사가 진행 중이에요. 발표 결과가 나오면 아래에 기록해 주세요 — 발표 확인은 ${ch.label}${sch.sourceUrl ? ' 또는 원문 공고' : ''}에서 할 수 있어요.</p>
          <div class="submit-actions" style="margin-bottom:12px">
            <button class="btn btn-outline" id="btn-result-won">🎉 선정됐어요</button>
            <button class="btn btn-outline" id="btn-result-lost">아쉽게 미선정</button>
          </div>` : ''}
        ${step === 3 ? `
          <p class="progress-note ${app.result === 'won' ? 'progress-won' : ''}">${app.result === 'won'
            ? `🎉 ${app.resultAt} 선정! 축하드려요 — ${sch.amount}`
            : `${app.resultAt} 미선정으로 기록했어요. 아래 탐색 탭에서 다음 장학금을 함께 찾아봐요.`}</p>
          <button class="link-btn" id="btn-undo-progress" style="margin-bottom:10px">결과 기록 취소</button>` : ''}
        ${app.docs && app.docs.length ? `
          <details class="dp-saved"><summary>작성한 서류 보기 (${app.docs.length})</summary>
            ${app.docs.map((t) => `<h4>${esc(t.doc)}</h4><pre>${esc(t.text)}</pre>`).join('')}
          </details>` : ''}
        ${app.formAns && formTplIdFor(sch) ? `
          <h4>작성한 양식 문서</h4>
          <div class="submit-actions">
            <button class="btn btn-outline" id="btn-form-save">📄 .doc 저장</button>
            <button class="btn btn-outline" id="btn-form-print">🖨 인쇄/PDF</button>
            <button class="btn btn-outline" id="btn-form-share">📤 공유</button>
          </div>
          <button class="btn btn-outline" id="btn-form-edit" style="width:100%;margin-bottom:14px">✏️ 양식 다시 작성</button>` : ''}
        ${certStatusListHtml(sch)}
        <h4>최종 제출 방법 <span class="channel-tag">${submitChannelLabel(sch)}</span></h4>
        <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
        ${(ch.url || sch.sourceUrl) && step < 1 ? `
        <button class="btn btn-primary" id="btn-go-submit" style="width:100%;margin-bottom:8px">⚡ 내용 복사하고 제출처 열기 ↗</button>` : ''}
        <div class="submit-actions">
          <button class="btn btn-outline" id="btn-copy-docs">📋 서류 내용 복사</button>
          <button class="btn btn-outline" id="btn-share-docs">📤 파일과 함께 공유</button>
        </div>
        ${sch.applyEmail ? `<button class="btn btn-primary btn-lg" id="btn-mail-apply" style="margin-bottom:14px">📧 접수 메일 열기 (내용 자동 완성)</button>` : ''}`;
      })() : ''}

      <button class="btn btn-primary btn-lg" id="btn-apply-one" ${canApply ? '' : 'disabled'}>${btnLabel}</button>
      ${canApply ? `<p class="dp-note">준비 완료 후 최종 제출처(${ch.label})를 안내해 드려요.${(!sch.formId && sch.prepFormId) ? ' 이 공고는 별도 양식 없이 자유 형식 제출을 받는 공고라, 앱이 제출용 지원문서 작성을 도와드려요.' : ''}</p>` : ''}
    </div>`;

  openSheetShell();

  if (canApply) {
    $('#btn-apply-one').addEventListener('click', () => applyTo(sch));
  }
  /* 진척도 기록 버튼 (있을 때만) */
  const markBtn = $('#btn-mark-submitted');
  if (markBtn) markBtn.addEventListener('click', () => recordSubmitted(sch));
  const wonBtn = $('#btn-result-won');
  if (wonBtn) wonBtn.addEventListener('click', () => recordResult(sch, true));
  const lostBtn = $('#btn-result-lost');
  if (lostBtn) lostBtn.addEventListener('click', () => recordResult(sch, false));
  const undoBtn = $('#btn-undo-progress');
  if (undoBtn) undoBtn.addEventListener('click', () => undoProgress(sch));
  const goBtn = $('#btn-go-submit');
  if (goBtn) goBtn.addEventListener('click', () => {
    copyText(buildSubmissionText(sch, app));
    const url = safeUrl(ch.url || sch.sourceUrl);
    if (url) window.open(url, '_blank', 'noopener');
  });
  if (app && app.formAns && formTplIdFor(sch)) {
    const tpl = FORM_TEMPLATES[formTplIdFor(sch)];
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

/* 손가락 아래에 아직 위로 올릴 수 있는 스크롤 영역이 남아 있으면 그건 '닫기'가 아니라 스크롤이다.
   시트 자신뿐 아니라 **안쪽 스크롤 영역까지** 봐야 한다 — 도우미 시트는 시트가 고정이고
   안쪽 대화 목록이 스크롤돼서, 시트만 보면 scrollTop이 늘 0이라 대화를 올려 보려 할 때마다 닫힌다. */
function scrollableAtTop(target, sheet) {
  for (let el = target; el && el !== sheet.parentNode; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

/* 바텀시트를 아래로 쓸어내려 닫기 — 앱 안에서 뜨는 시트 전부가 같은 규칙을 쓴다
   (#detail-sheet · #notify-sheet · #chat-sheet). 위로 올릴 내용이 남아 있지 않을 때
   아래로 끄는 동작만 '닫기'로 본다. 그래야 안쪽 내용 스크롤을 뺏지 않는다
   (학교 목록에서 손가락이 닿는 순간 선택돼 버리던 것과 같은 계열의 실수를 막는 조건).
   ⚠️ 새로 만드는 시트에도 반드시 붙일 것 — 2026-08-21 개발자 지시. */
function enableSheetSwipe(sheet, close) {
  let startY = 0, dy = 0, dragging = false;
  sheet.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    dy = 0;
    dragging = scrollableAtTop(e.target, sheet);
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { dragging = false; sheet.style.transition = ''; sheet.style.transform = ''; return; }
    e.preventDefault();
    sheet.style.transition = 'none';
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  }, { passive: false });

  sheet.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    void sheet.offsetHeight;          // transition을 되살린 뒤에 transform을 바꿔야 튀지 않는다
    sheet.style.transform = '';
    if (dy > 90) close();
  }, { passive: true });
}

/* 바텀시트를 여는 동작 한 곳 — 상세 시트와 일괄 준비 목록이 **같은 함수**를 쓴다.
   베끼면 열리는 모양이 갈라진다(내용은 부르는 쪽이 innerHTML 로 채운다). */
function openSheetShell() {
  $('#sheet-backdrop').hidden = false;
  const sheet = $('#detail-sheet');
  sheet.hidden = false;
  requestAnimationFrame(() => {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
  });
}

function closeSheet() {
  docPrep = null;
  bulkPrep = null;
  $('#sheet-backdrop').classList.remove('show');
  $('#detail-sheet').classList.remove('show');
  setTimeout(() => {
    $('#sheet-backdrop').hidden = true;
    $('#detail-sheet').hidden = true;
  }, 250);
}

/* ---------------- 신청 내역 ---------------- */
/* ── 신청 내역 관리 (2026-08-24 개발자 요청) ──────────────────────────────
   *"신청내역에서 왼쪽으로 끌면 삭제도 가능하게 하고 전체 선택에서 삭제도 가능하게"*

   🔴 여기서 지우는 것은 **학생이 기록한 진행 상황**이다(담아둔 것·제출 기록·선정 결과).
      장학 공고 자체는 모두의 데이터라 사라지지 않는다 — 화면에도 그렇게 적었다.
      기록은 되살릴 길이 없으면 그대로 손실이라 **되돌리기를 반드시 붙인다.**
   🔴 방향은 **왼쪽**이다. iOS는 왼쪽 끝에서 오른쪽으로 끄는 것을 '뒤로 가기'로 가로채므로
      오른쪽 스와이프는 설치형 앱에서 안 열린다(개발자와 확인 후 왼쪽으로 결정).
   ────────────────────────────────────────────────────────────────────── */
let appsSelectMode = false;
const appsSelected = new Set();
let lastSwipeAt = 0;            // 스와이프 직후의 클릭을 삼키는 자리 (아래 주석)
let undoBuffer = null;          // 되돌리기용 — 지운 항목과 원래 자리

function appCard(app) {
  const sch = findSch(app.id);
  if (!sch) return '';
  const step = effectiveStep(app, sch);
  const stepLabel = step === 3 ? (app.result === 'won' ? '🎉 선정' : '결과 확인') : APP_STEPS[step];
  const statusBadge = app.pending
    ? '<span class="badge badge-pending">서류 작성 필요</span>'
    : `<span class="badge badge-applied">${stepLabel}</span>`;
  const checked = appsSelected.has(app.id) ? 'checked' : '';
  return `
    <div class="swipe-row" data-row="${esc(app.id)}">
      <button class="swipe-del" data-del="${esc(app.id)}" aria-label="이 신청 기록 삭제">삭제</button>
      ${appsSelectMode ? `<input type="checkbox" class="row-check" data-pick="${esc(app.id)}" ${checked}
         aria-label="${esc(sch.name)} 선택" />` : ''}
      <button class="sch-card" data-detail="${sch.id}">
        <div class="sch-top">
          <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${sch.type}</span>
          ${statusBadge}
        </div>
        <p class="sch-name">${esc(sch.name)}</p>
        <p class="sch-provider">${app.appliedAt} ${app.pending ? '담아둠' : '준비 완료'} · 제출처 ${esc(officialChannel(sch).label)}</p>
        <div class="mini-progress"><div style="width:${app.pending ? 6 : ((step + 1) / APP_STEPS.length) * 100}%"></div></div>
      </button>
    </div>`;
}

/* 지우기 — 여러 건을 한 번에 받는다(스와이프 1건도 같은 길로 지나간다). */
function deleteApps(ids) {
  if (!ids.length) return;
  const removed = ids
    .map((id) => ({ id, at: state.applications.findIndex((a) => a.id === id) }))
    .filter((r) => r.at >= 0)
    .map((r) => ({ at: r.at, app: state.applications[r.at] }));
  if (!removed.length) return;
  state.applications = state.applications.filter((a) => !ids.includes(a.id));
  appsSelected.clear();
  saveState();
  /* 되돌릴 때 **원래 자리로** 넣는다 — 뒤에 붙이면 목록 순서가 바뀌어
     학생이 "지웠다 살렸더니 딴 데 가 있네" 하고 또 헷갈린다. */
  undoBuffer = removed.slice().sort((x, y) => x.at - y.at);
  renderApplications();
  renderHome();
  toast(`${removed.length}건을 지웠어요`, {
    label: '되돌리기',
    run: () => {
      for (const r of undoBuffer) state.applications.splice(r.at, 0, r.app);
      undoBuffer = null;
      saveState();
      renderApplications();
      renderHome();
      toast('되돌렸어요');
    },
  });
}

/* 카드를 왼쪽으로 미는 손짓. **세로 스크롤을 막지 않는 것**이 이 함수의 어려운 부분이다 —
   첫 움직임에서 가로/세로를 정하고, 세로면 즉시 손을 뗀다(목록이 정상으로 스크롤된다).
   ⚠️ 이 유형은 **마우스로는 한 번도 재현되지 않는다** — 검사는 TouchEvent로 해야 한다
   (13차 세션 학교 검색 사고와 같은 계열, CLAUDE.md 참조). */
function enableRowSwipe(list) {
  const REVEAL = 96;            // 삭제 버튼 너비와 같아야 한다 (style.css .swipe-del)
  let row = null, x0 = 0, y0 = 0, dir = null, dx = 0;
  const end = () => { if (row) row.classList.remove('dragging'); row = null; dir = null; };

  list.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || appsSelectMode) return;
    const r = e.target.closest('.swipe-row');
    if (!r) return;
    list.querySelectorAll('.swipe-row.open').forEach((o) => { if (o !== r) o.classList.remove('open'); });
    row = r; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dir = null; dx = 0;
    row.classList.add('dragging');
  }, { passive: true });

  list.addEventListener('touchmove', (e) => {
    if (!row) return;
    const ax = e.touches[0].clientX - x0;
    const ay = e.touches[0].clientY - y0;
    if (!dir) {
      if (Math.abs(ax) < 6 && Math.abs(ay) < 6) return;   // 아직 방향을 모른다
      dir = Math.abs(ax) > Math.abs(ay) ? 'x' : 'y';
      if (dir === 'y') { end(); return; }                 // 세로다 — 목록에 넘긴다
    }
    e.preventDefault();
    const base = row.classList.contains('open') ? -REVEAL : 0;
    dx = Math.max(-REVEAL, Math.min(0, base + ax));
    row.style.setProperty('--dx', `${dx}px`);
  }, { passive: false });

  list.addEventListener('touchend', () => {
    if (!row) return;
    row.style.removeProperty('--dx');
    row.classList.toggle('open', dx < -REVEAL / 2);
    /* 민 뒤에 곧바로 오는 click은 카드 열기가 아니다 — 삼킨다 */
    if (Math.abs(dx) > 6) lastSwipeAt = Date.now();
    end();
  }, { passive: true });
}

function renderApplications() {
  const apps = state.applications.slice().reverse().filter((a) => findSch(a.id));
  const prepared = apps.filter((a) => !a.pending);
  const pending = apps.filter((a) => a.pending);
  const submitted = prepared.filter((a) => a.submittedAt && !a.result);
  const wonApps = prepared.filter((a) => a.result === 'won');
  const totalExpected = apps.reduce((sum, a) => sum + findSch(a.id).amountValue, 0);
  const wonAmount = wonApps.reduce((sum, a) => sum + findSch(a.id).amountValue, 0);

  $('#apps-summary').innerHTML = apps.length
    ? `<div class="summary-card">
         <p>준비 완료 ${prepared.length}건${submitted.length ? ` · 제출·심사 중 ${submitted.length}건` : ''}${wonApps.length ? ` · 🎉 선정 ${wonApps.length}건` : ''}${pending.length ? ` · 서류 작성 필요 ${pending.length}건` : ''} · ${wonApps.length ? '선정된 장학금' : '예상 최대 수혜액'}</p>
         <p class="summary-amount">${won(wonApps.length ? wonAmount : totalExpected)}</p>
         <p class="summary-note">제출·발표 단계는 각 장학금 상세에서 직접 기록할 수 있어요 · 최종 제출은 각 공식 채널에서 이루어져요</p>
       </div>`
    : '';

  /* 지워진 항목이 선택 목록에 남지 않게 — 남으면 '삭제 3건'인데 2건만 지워진다 */
  for (const id of [...appsSelected]) if (!apps.some((a) => a.id === id)) appsSelected.delete(id);

  const list = $('#apps-list');
  list.classList.toggle('selecting', appsSelectMode);
  list.innerHTML = apps.length
    ? apps.map(appCard).join('')
    : '<p class="empty">아직 준비한 장학금이 없어요.<br />홈에서 한 번에 준비해 보세요 ⚡</p>';

  /* 항목이 없으면 관리 장치를 통째로 숨긴다 — 빈 화면에 쓸 수 없는 버튼을 두지 않는다 */
  $('#apps-select-toggle').hidden = !apps.length;
  $('#apps-swipe-hint').hidden = !apps.length;
  $('#apps-select-toggle').textContent = appsSelectMode ? '완료' : '선택';
  $('#apps-bulkbar').hidden = !(appsSelectMode && apps.length);
  const all = $('#apps-check-all');
  if (all) all.checked = apps.length > 0 && appsSelected.size === apps.length;
  const del = $('#apps-delete-selected');
  if (del) {
    del.disabled = appsSelected.size === 0;
    del.textContent = appsSelected.size ? `삭제 ${appsSelected.size}건` : '삭제';
  }
}

/* 신청 내역 관리 배선 — 화면이 처음 만들어질 때 한 번만 건다 */
function wireAppsManage() {
  const list = $('#apps-list');
  enableRowSwipe(list);

  $('#apps-select-toggle').addEventListener('click', () => {
    appsSelectMode = !appsSelectMode;
    appsSelected.clear();
    list.querySelectorAll('.swipe-row.open').forEach((o) => o.classList.remove('open'));
    renderApplications();
  });

  $('#apps-check-all').addEventListener('change', (e) => {
    const ids = state.applications.filter((a) => findSch(a.id)).map((a) => a.id);
    appsSelected.clear();
    if (e.target.checked) ids.forEach((id) => appsSelected.add(id));
    renderApplications();
  });

  $('#apps-delete-selected').addEventListener('click', () => {
    const ids = [...appsSelected];
    if (!ids.length) return;
    deleteApps(ids);
    appsSelectMode = false;
    renderApplications();
  });

  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { deleteApps([del.dataset.del]); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      if (pick.checked) appsSelected.add(pick.dataset.pick);
      else appsSelected.delete(pick.dataset.pick);
      renderApplications();
    }
  });
}

/* ---------------- MY ---------------- */

/* 신청서를 채우며 앱이 배운 값 — 무엇을 갖고 있는지 학생에게 보이고 지울 수 있게 한다.
   🔴 주민등록번호는 이 기기 안에만 있고 어디로도 보내지 않는다(외부 전송 코드 없음).
      그 사실을 화면에 그대로 적는다 — 말하지 않으면 학생은 알 수 없다. */
function learnedHtml(c) {
  const rows = LEARNED_COMMON.filter(([k]) => c[k]);
  if (!rows.length) return '';
  return `<div class="my-learned">
    <p class="my-learned-head">신청서에서 배운 정보 <span>${rows.length}개 · 이 기기에만 저장돼요</span></p>
    <ul>${rows.map(([k, label]) => `<li><span>${esc(label)}</span><strong>${esc(k === 'rrn' ? maskRrn(c[k]) : c[k])}</strong>
      <button type="button" class="btn-link" data-forget="${k}">지우기</button></li>`).join('')}</ul>
  </div>`;
}

/* 주민등록번호는 화면에도 통째로 띄우지 않는다 — 어깨너머로 보인다 */
function maskRrn(v) {
  const s = String(v || '');
  return s.length > 8 ? `${s.slice(0, 8)}${'*'.repeat(s.length - 8)}` : s;
}

function forgetLearned(key) {
  if (!state.profile || !state.profile.common) return;
  delete state.profile.common[key];
  saveState();
  if (typeof formInvalidatePlan === 'function') formInvalidatePlan();
  renderMy();
  toast('지웠어요 — 다음 신청서에서 다시 물어볼게요');
}

function renderMy() {
  const p = state.profile;
  if (!p) return;   // 온보딩을 아직 안 마친 상태 — 그릴 프로필이 없다
  const c = p.common || {};
  const flagText = p.flags.length ? p.flags.map((f) => FLAG_LABELS[f]).join(', ') : '해당 없음';
  const trackLabel = (TRACKS.find((t) => t.id === p.track) || {}).label || '-';
  const commonFilled = ['studentId', 'birth', 'phone', 'email', 'account'].filter((k) => c[k]).length;
  $('#my-profile').innerHTML = `
    <p class="my-name">${p.name || '대학생'} 님<span class="my-edit-hint">수정하기 ›</span></p>
    <p class="my-line">${p.school || '대학 미설정'} · ${trackLabel}${p.major ? ' · ' + p.major : ''}</p>
    <div class="my-grid">
      <div><span>학년</span><strong>${p.year}학년 (${esc(p.status || '미설정')})</strong></div>
      <div><span>직전학기 평점</span><strong>${p.gpa != null ? p.gpa.toFixed(2) : '미입력'}</strong></div>
      <div><span>지원구간</span><strong>${p.bracket != null ? p.bracket + '구간' : '모름'}</strong></div>
      <div><span>공통 서류정보</span><strong>${commonFilled}/5 입력됨</strong></div>
    </div>
    <p class="my-flags">특별자격: ${flagText}</p>
    ${learnedHtml(c)}
    <p class="my-flags">공통 서류정보(학번·연락처·계좌 등)는 이 기기에만 저장되고 서류 초안에 자동 기입돼요.</p>`;
  renderAccountCard();
  renderNotifyCard();
  renderWallet();
}

/* 알림 설정 카드 (notify.js가 내용을 만든다) */
function renderNotifyCard() {
  const el = $('#my-notify');
  if (!el) return;
  if (typeof notifySettingsHtml !== 'function' || !notifyReady) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = notifySettingsHtml();
  bindNotifySettings();
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
    const isFirstTime = !state.profile;
    state.profile = collectProfile();
    /* 민감정보 동의는 프로필이 아니라 따로 둔다 — 프로필은 서버로 나가는 값이고
       동의 여부는 '나가도 되는가'를 정하는 값이라 섞으면 헷갈린다. */
    state.consent = { sensitive: !!$('#in-sensitive-ok').checked };
    saveState();
    toast('프로필이 저장됐어요. 맞춤 장학금을 찾았어요!');
    showScreen('home');
    // 프로필을 처음 만든 직후에 알림 동의를 딱 한 번 묻는다 (이후에는 MY 화면에서만)
    // 저장 완료 토스트가 사라진 뒤에 물어본다 (문구가 겹치지 않게)
    if (isFirstTime && typeof notifyMaybeAskConsent === 'function') notifyMaybeAskConsent(2900);
  });

  $('#in-flags').addEventListener('change', syncConsentRow);

  $('#btn-notify').addEventListener('click', () => {
    if (typeof openNotifyInbox === 'function') openNotifyInbox();
  });
  $('#notify-backdrop').addEventListener('click', () => closeNotifyPanel());
  $('#notify-sheet').addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-handle')) closeNotifyPanel();
  });
  enableSheetSwipe($('#notify-sheet'), closeNotifyPanel);

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
    /* 🔴 순서 주의 — 단일 선택(.fq-choice)을 다중 선택(.fq-checks)보다 먼저 본다.
       뒤에 두면 '하나만 고르기'가 영영 안 걸려 성별에 남·여를 둘 다 체크할 수 있다 */
    const one = e.target.closest('.fq-choice .chip');
    if (one) {
      const g = one.closest('.fq-choice');
      const was = one.classList.contains('active');
      g.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      if (!was) one.classList.add('active');   // 다시 누르면 선택 해제 (잘못 고른 것을 되돌릴 수 있게)
      return;
    }
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
    /* 🔴 카드를 민 직후에 오는 click은 '열기'가 아니다 — 밀었는데 상세가 열리면
       삭제 버튼을 보려던 학생이 매번 시트를 닫아야 한다. 선택 모드에서도 열지 않는다. */
    if (Date.now() - lastSwipeAt < 350) return;
    if (e.target.closest('[data-del]') || e.target.closest('[data-pick]')) return;
    const card = e.target.closest('[data-detail]');
    if (!card) return;
    if (appsSelectMode && card.closest('#apps-list')) {
      const id = card.dataset.detail;                 // 선택 모드에서는 카드를 눌러도 선택이 된다
      if (appsSelected.has(id)) appsSelected.delete(id); else appsSelected.add(id);
      renderApplications();
      return;
    }
    openDetail(card.dataset.detail);
  });

  $('#sheet-backdrop').addEventListener('click', closeSheet);
  $('#detail-sheet').addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-handle')) closeSheet();
    if (e.target.id === 'btn-bulk-go' && bulkPrep) bulkStart();
  });
  /* 일괄 준비 목록의 체크 — 시트는 innerHTML 이 계속 갈리므로 줄마다 리스너를 걸지 않고
     **시트 하나에 위임**한다. 걸어 두면 다시 그릴 때마다 리스너가 쌓여 새는 자리가 된다. */
  $('#detail-sheet').addEventListener('change', (e) => {
    if (!bulkPrep) return;
    if (e.target.id === 'bulk-all') {
      bulkPrep.ids.clear();
      if (e.target.checked) bulkPrep.list.forEach((sch) => bulkPrep.ids.add(sch.id));
      $$('#detail-sheet [data-bulk]').forEach((box) => { box.checked = e.target.checked; });
      bulkRefresh();
      return;
    }
    const id = e.target.dataset && e.target.dataset.bulk;
    if (!id) return;
    if (e.target.checked) bulkPrep.ids.add(id); else bulkPrep.ids.delete(id);
    bulkRefresh();
  });
  enableSheetSwipe($('#detail-sheet'), closeSheet);
  wireAppsManage();   // 신청 내역 — 왼쪽으로 밀어 삭제 · 선택 모드 (2026-08-24)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#notify-sheet').hidden) closeNotifyPanel();
    else if (!$('#detail-sheet').hidden) closeSheet();
  });

  $('#btn-apply-all').addEventListener('click', applyAll);

  const editProfile = () => { initOnboarding(); showScreen('onboarding'); };
  $('#btn-edit-profile').addEventListener('click', editProfile);
  $('#btn-my-edit').addEventListener('click', editProfile);

  /* 눌러서 넘어가는 영역 — 마우스·손가락뿐 아니라 키보드로도 되어야 한다
     (div라 버튼과 달리 Enter·스페이스가 저절로 먹지 않는다) */
  const onTap = (sel, run) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener('click', run);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();          // 스페이스로 화면이 스크롤되지 않게
      run();
    });
  };
  onTap('#btn-home-profile', () => showScreen('my'));   // 홈 왼쪽 위 프로필 → MY
  /* 🔴 캡처 단계로 먼저 잡는다 — 카드 전체가 '프로필 수정' 버튼이라
     그냥 두면 '지우기'를 눌러도 수정 화면이 열려 버린다 */
  $('#my-profile').addEventListener('click', (e) => {
    const del = e.target.closest('[data-forget]');
    if (!del) return;
    e.stopPropagation();
    e.preventDefault();
    forgetLearned(del.dataset.forget);
  }, true);
  onTap('#my-profile', editProfile);                     // MY 맨 위 카드 → 프로필 수정

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('프로필과 신청 내역을 모두 삭제할까요?')) return;
    [STORAGE_KEY, ...LEGACY_KEYS].forEach((k) => localStorage.removeItem(k));
    state = { profile: null, applications: [] };
    if (typeof notifyReset === 'function') notifyReset(); // 알림 설정·알림함도 함께 초기화
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

/* ---------------- PWA + 자동 업데이트 ----------------
   설치된 앱을 지우고 다시 깔지 않아도:
   1) 장학금·양식 데이터(data/*.json)는 앱을 열 때마다 + 화면에 돌아올 때마다 새로 받고
   2) 앱 코드 자체가 바뀌면 새 서비스워커가 설치된 뒤 화면을 한 번 새로 고쳐 즉시 적용한다. */
let swReg = null;
// localhost도 허용 — 검증 드라이버가 알림·백그라운드 경로까지 실제로 눌러볼 수 있어야 한다
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const hadController = !!navigator.serviceWorker.controller; // 최초 설치와 업데이트를 구분
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => { swReg = reg; reg.update().catch(() => {}); })
      .catch(() => { /* 오프라인 캐시는 선택 기능 */ });
  });
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedForUpdate) return; // 첫 설치 때는 새로고침 불필요
    reloadedForUpdate = true;
    location.reload();
  });
}

/* 화면 복귀(설치형 앱을 다시 열 때 포함) 시 데이터 갱신 + 새 버전 확인 — 5분 간격 제한 */
let lastFgRefresh = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastFgRefresh < 5 * 60 * 1000) return;
  lastFgRefresh = Date.now();
  loadNotices();
  loadRegistered();
  if (typeof loadFormTemplates === 'function') loadFormTemplates();
  if (swReg) swReg.update().catch(() => {});
});

/* ══════════════════════════════════════════════════════════════════════════
   회원가입·로그인 — 기기를 바꿔도 이어쓰기 (2026-08-25)

   개발자가 겪던 문제: *"핸드폰으로 로그인했을 때 정보가 저장되지 않아 다른 기기와
   연결이 되지 않는다."* 프로필·신청내역이 폰 안에만 있어서 기기를 바꾸면 온보딩부터
   다시 해야 했다.

   🔴 **기기 우선**이다. 화면은 언제나 폰 안 데이터로 즉시 뜨고, 서버는 뒤에서 맞출 뿐이다.
      서버 우선으로 바꾸면 지하철·비행기모드에서 화면이 비거나 온보딩이 다시 뜬다.
   🔴 서버로 나가는 값은 **반드시** supabase-client.js 의 syncSafeProfile 을 거친다 —
      주민등록번호·계좌번호는 거기서 떨어져 나간다. 여기서 profile 을 직접 보내지 말 것.
   ══════════════════════════════════════════════════════════════════════════ */
let syncTimer = null;
let syncBusy = false;

/* 저장할 때마다 서버를 두들기지 않는다 — 온보딩에서 한 칸 고칠 때마다 보내면
   무료 등급이 금방 닳는다. 묶어서 한 번만 올린다. */
function syncSchedulePush() {
  if (typeof signedIn !== 'function' || !signedIn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncPush(state).catch(() => { /* 실패해도 앱은 그대로 — 폰 안 저장이 원본이다 */ });
  }, (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.pushDelayMs) || 2000);
}

/* 서버에서 받은 것을 이 기기에 적는다.
   🔴 **서버에 일부러 안 올린 것**(주민번호·계좌·미동의 민감자격)은 서버에 없다.
      그대로 덮어쓰면 이 기기의 값이 사라지므로, 빈자리만 기기 것으로 채운다. */
function syncApplyRemote(remote) {
  const wasOnboarding = !state.profile;
  if (remote.profile) {
    const localP = state.profile || {};
    const localCommon = localP.common || {};
    const p = JSON.parse(JSON.stringify(remote.profile));
    p.common = Object.assign({}, p.common || {});
    for (const k of ['rrn', 'account']) if (localCommon[k] && !p.common[k]) p.common[k] = localCommon[k];
    if (!p.flags) p.flags = localP.flags || [];
    migrateBranchCampus(p);
    migrateFitFields(p);
    state.profile = p;
  }
  if (Array.isArray(remote.applications)) state.applications = remote.applications;
  state.consent = Object.assign({}, state.consent, { sensitive: !!remote.sensitiveOk });
  state.updatedAt = remote.updatedAt || state.updatedAt;
  saveState({ fromServer: true });

  if (wasOnboarding && state.profile) { initOnboarding(); showScreen('home'); return; }
  const cur = $$('.screen').find((sc) => !sc.hidden);
  if (cur) showScreen(cur.id.replace('screen-', ''));
}

/* 앱을 열 때 / 로그인 직후 한 번. **최신이 이긴다**(last-write-wins). */
async function syncAfterLoad() {
  if (typeof signedIn !== 'function' || !signedIn() || syncBusy) return;
  syncBusy = true;
  try {
    const remote = await syncPull();
    if (!remote) { await syncPush(state); return; }          // 서버가 비었으면 내 것을 올린다
    const mine = state.updatedAt || '';
    const theirs = remote.updatedAt || '';
    /* 새 기기(프로필이 아예 없음)면 무조건 받는다 — 이게 개발자가 겪던 바로 그 상황이다 */
    if (!state.profile || theirs > mine) syncApplyRemote(remote);
    else if (mine > theirs) await syncPush(state);
  } catch (e) {
    /* 인터넷이 없거나 서버가 자고 있으면 그냥 지나간다 — 앱은 폰 안 데이터로 계속 돈다 */
  } finally { syncBusy = false; }
}

/* 온보딩 Step 3 — 특별자격을 **하나라도 켰을 때만** 동의 줄을 보여 준다.
   아무것도 안 켠 학생은 민감정보를 주지 않으므로 동의를 물을 이유가 없다. */
function syncConsentRow() {
  const row = $('#in-sensitive-row');
  if (!row) return;
  const anyFlag = $$('#in-flags input:checked').length > 0;
  row.hidden = !(anyFlag && typeof supabaseConfigured === 'function' && supabaseConfigured());
}

/* ---------------- MY 화면 계정 카드 ---------------- */
function renderAccountCard() {
  const el = $('#my-account');
  if (!el) return;
  /* 설정이 비어 있으면 로그인 기능이 아예 없는 앱처럼 보인다 (push-config·chat-config와 같은 규칙) */
  if (typeof supabaseConfigured !== 'function' || !supabaseConfigured()) { el.hidden = true; return; }
  el.hidden = false;
  const u = authUser();
  el.innerHTML = u
    ? `<p class="acc-head">계정 <span class="acc-on">이어쓰기 켜짐</span></p>
       <p class="acc-mail">${esc(u.email || '로그인됨')}</p>
       <p class="acc-note">이 계정으로 다른 기기에서 로그인하면 프로필과 신청내역이 그대로 이어져요.
         주민등록번호·계좌번호·증명서류는 서버로 보내지 않아요.</p>
       <div class="acc-actions">
         <button class="btn btn-outline" id="btn-acc-out">로그아웃</button>
         <button class="btn btn-outline danger" id="btn-acc-del">탈퇴 (서버 정보 삭제)</button>
       </div>`
    : `<p class="acc-head">계정</p>
       <div class="acc-actions">
         <button class="btn btn-primary" id="btn-acc-in">로그인</button>
         <button class="btn btn-outline" id="btn-acc-up">회원가입</button>
       </div>`;

  const btnIn = $('#btn-acc-in'); if (btnIn) btnIn.addEventListener('click', () => openAuthSheet('in'));
  const btnUp = $('#btn-acc-up'); if (btnUp) btnUp.addEventListener('click', () => openAuthSheet('up'));
  const btnOut = $('#btn-acc-out');
  if (btnOut) btnOut.addEventListener('click', async () => {
    await authSignOut();
    toast('로그아웃했어요 — 이 기기의 정보는 그대로 남아 있어요');
    renderMy();
  });
  const btnDel = $('#btn-acc-del');
  if (btnDel) btnDel.addEventListener('click', async () => {
    if (!confirm('서버에 저장된 프로필·신청내역을 지울까요?\n이 기기의 정보는 그대로 남습니다.')) return;
    const r = await authDeleteData();
    toast(r.ok ? '서버 정보를 지웠어요' : r.error);
    renderMy();
  });
}

/* ---------------- 로그인 · 가입 시트 ---------------- */
/* 🔴 새 시트를 만들지 않고 #detail-sheet 를 그대로 쓴다 —
   쓸어 내려 닫기·배경 눌러 닫기·ESC 가 이미 배선돼 있다(2026-08-21 개발자 지시). */
/* 화면 넷 — 'in' 로그인 · 'up' 가입 · 'reset' 비밀번호 재설정 요청 · 'newpw' 새 비밀번호 */
let authMode = 'in';

function openAuthSheet(mode) {
  authMode = mode || 'in';
  openSheetShell();
  renderAuthSheet();
}

/* 소셜 로그인 — supabase-config.js 의 providers 에 적은 것만 **동그란 아이콘**으로 나온다.
   🔴 여기에 적는 것만으로는 안 되고, 대시보드에서 그 제공자를 켜야 실제로 동작한다.
   🔴 로고는 **그림 파일이 아니라 코드 안의 도형**이다 — 앱의 보안 설정(CSP)이 바깥 그림을
      막기도 하고, 파일이 없어도 아이콘이 깨지지 않아서다. */
const AUTH_PROVIDERS = {
  google: { label: '구글', svg: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z"/></svg>' },
  kakao: { label: '카카오', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191600" d="M12 3.5C6.8 3.5 2.6 6.9 2.6 11c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.6-.8 3-.1.5.2.5.4.4.2-.1 2.7-1.9 3.8-2.6.6.1 1.2.1 1.7.1 5.2 0 9.4-3.4 9.4-7.5S17.2 3.5 12 3.5z"/></svg>' },
  naver: { label: '네이버', svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M16.3 12.9L7.5 0H0v24h7.7V11.1L16.5 24H24V0h-7.7v12.9z"/></svg>' },
};
function authProvidersHtml() {
  const list = (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.providers) || [];
  const known = list.filter((p) => AUTH_PROVIDERS[p]);
  if (!known.length) return '';
  return `<div class="auth-or"><span>또는 간편하게</span></div>
    <div class="auth-social">${known.map((p) => {
      const m = AUTH_PROVIDERS[p];
      return `<button type="button" class="auth-social-btn auth-${esc(p)}" data-oauth="${esc(p)}"
        aria-label="${esc(m.label)}로 계속하기" title="${esc(m.label)}로 계속하기">${m.svg}</button>`;
    }).join('')}</div>
    <p class="auth-social-note">한 번 연결하면 다음부터는 비밀번호 없이 바로 로그인돼요</p>`;
}

function renderAuthSheet(errText, okText) {
  const mode = authMode;
  const title = { in: '로그인', up: '회원가입', reset: '비밀번호 재설정', newpw: '새 비밀번호 정하기' }[mode];
  const emailVal = mode === 'up' ? '' : (typeof rememberedEmail === 'function' ? rememberedEmail() : '');
  const remembered = !!emailVal;

  const emailField = `
      <label class="field">
        <span class="field-label">이메일</span>
        <input type="email" id="in-auth-email" placeholder="name@example.com" value="${esc(emailVal)}"
          autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" />
      </label>`;
  const pwField = (label, auto) => `
      <label class="field">
        <span class="field-label">${label}</span>
        <input type="password" id="in-auth-pw" placeholder="비밀번호" autocomplete="${auto}" />
      </label>`;

  let mid = '';
  if (mode === 'in') {
    mid = emailField + pwField('비밀번호', 'current-password') + `
      <div class="auth-row">
        <label class="auth-remember"><input type="checkbox" id="in-auth-remember" ${remembered ? 'checked' : ''} /> 아이디 저장</label>
        <button type="button" class="btn-link" id="btn-auth-forgot">비밀번호를 잊으셨나요?</button>
      </div>`;
  } else if (mode === 'up') {
    mid = emailField + pwField('비밀번호 (6자 이상)', 'new-password') + `
      <label class="check-item consent-item">
        <input type="checkbox" id="in-auth-agree" />
        <span>(필수) <a href="terms.html" target="_blank" rel="noopener">이용약관 · 개인정보처리방침</a>에 동의합니다</span>
      </label>`;
  } else if (mode === 'reset') {
    mid = `<p class="auth-lead">가입할 때 쓴 이메일로 비밀번호를 다시 정하는 링크를 보내 드려요.</p>`
      + emailField;
  } else {
    mid = `<p class="auth-lead">새로 쓸 비밀번호를 정해 주세요.</p>`
      + pwField('새 비밀번호 (6자 이상)', 'new-password');
  }

  const goLabel = { in: '로그인', up: '가입하기', reset: '재설정 메일 보내기', newpw: '비밀번호 바꾸기' }[mode];
  const swap = mode === 'in'
    ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">계정이 없어요 — 회원가입</button>'
    : mode === 'up'
      ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">이미 계정이 있어요 — 로그인</button>'
      : '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">← 로그인으로 돌아가기</button>';

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">${title}</h3>
      ${mid}
      <p class="auth-err" id="auth-err" ${errText ? '' : 'hidden'}>${esc(errText || '')}</p>
      <p class="auth-ok" id="auth-ok" ${okText ? '' : 'hidden'}>${esc(okText || '')}</p>
      <button class="btn btn-primary btn-lg" id="btn-auth-go">${goLabel}</button>
      ${swap}
      ${mode === 'in' || mode === 'up' ? authProvidersHtml() : ''}
      <p class="dp-note">주민등록번호·계좌번호·증명서류는 서버로 보내지 않고 이 기기에만 남아요.</p>
    </div>`;

  $('#btn-auth-go').addEventListener('click', authSubmit);
  $('#btn-auth-swap').addEventListener('click', () => {
    authMode = mode === 'up' ? 'in' : (mode === 'in' ? 'up' : 'in');
    renderAuthSheet();
  });
  const forgot = $('#btn-auth-forgot');
  if (forgot) forgot.addEventListener('click', () => { authMode = 'reset'; renderAuthSheet(); });
  const pw = $('#in-auth-pw');
  if (pw) pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') authSubmit(); });
  const mail = $('#in-auth-email');
  if (mail) mail.addEventListener('keydown', (e) => { if (e.key === 'Enter' && mode === 'reset') authSubmit(); });
  $$('#detail-sheet [data-oauth]').forEach((b) =>
    b.addEventListener('click', () => authOAuthGo(b.dataset.oauth)));
  $('#detail-sheet').scrollTop = 0;
}

function authShowError(msg) {
  const el = $('#auth-err');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  const okEl = $('#auth-ok');
  if (okEl) okEl.hidden = true;
}

async function authSubmit() {
  const mode = authMode;
  const emailEl = $('#in-auth-email');
  const pwEl = $('#in-auth-pw');
  const email = emailEl ? emailEl.value.trim() : '';
  const pw = pwEl ? pwEl.value : '';

  if ((mode === 'in' || mode === 'up') && (!email || !pw)) {
    authShowError('이메일과 비밀번호를 모두 입력해 주세요'); return;
  }
  if (mode === 'reset' && !email) { authShowError('이메일을 입력해 주세요'); return; }
  if (mode === 'newpw' && !pw) { authShowError('새 비밀번호를 입력해 주세요'); return; }
  if (mode === 'up' && !$('#in-auth-agree').checked) {
    authShowError('약관과 개인정보처리방침에 동의해 주세요'); return;
  }

  const btn = $('#btn-auth-go');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '잠시만요…';
  let r;
  if (mode === 'up') r = await authSignUp(email, pw);
  else if (mode === 'in') r = await authSignIn(email, pw);
  else if (mode === 'reset') r = await authResetRequest(email);
  else r = await authUpdatePassword(pw);
  btn.disabled = false;
  btn.textContent = label;

  if (!r.ok) { authShowError(r.error); return; }

  /* 🔴 재설정 메일은 **정말 갔는지 앱이 알 수 없다.** Supabase 기본 발송기는 시간당 2통이고
     팀원이 아닌 주소로는 거부하는데, 그 거부가 앱에는 성공으로 보인다. 그래서
     "보냈습니다"라고 단정하지 않고 안 왔을 때 무엇을 하면 되는지까지 적는다. */
  if (mode === 'reset') {
    renderAuthSheet(null, '재설정 링크를 보내 달라고 요청했어요. 메일함(스팸함도)을 확인해 주세요.\n'
      + '몇 분 안에 안 오면 아직 메일 발송이 준비되지 않은 것이니 관리자에게 알려 주세요.');
    return;
  }
  if (mode === 'newpw') {
    closeSheet();
    toast('비밀번호를 바꿨어요');
    renderMy();
    return;
  }
  if (r.needsEmailConfirm) {
    renderAuthSheet(null, '가입 확인 메일을 보냈어요 — 메일의 링크를 누른 뒤 로그인해 주세요.');
    return;
  }

  /* '아이디 저장' — 이메일 한 줄만. 비밀번호는 절대 저장하지 않는다. */
  const rememberEl = $('#in-auth-remember');
  if (mode === 'in') setRememberedEmail(rememberEl && rememberEl.checked ? email : '');
  else setRememberedEmail(email);          // 가입한 사람은 그 주소를 기억해 둔다

  closeSheet();
  toast('로그인했어요 — 이제 기기를 바꿔도 이어져요');
  /* 🔴 순서가 중요하다 — **먼저** 서버와 맞춘다. 새 기기에서는 이 줄에서 프로필이
     처음 생기므로, 화면 그리기를 앞에 두면 아직 프로필이 없는 상태로 그리게 된다. */
  await syncAfterLoad();
  renderMy();
}

/* ---------------- 시작 ---------------- */
loadState();
bindEvents();
initOnboarding();
loadNotices();
loadRegistered();
loadMajors();   // 학교별 학과 목록 — 온보딩 학과 자동추천이 그 학교 것만 보게
if (typeof loadFormTemplates === 'function') loadFormTemplates(); // 정식 등록 양식 최신화
walletRefresh().then(() => {
  if (!$('#screen-my').hidden) renderMy();
});
if (typeof notifyInit === 'function') {
  notifyInit().then(() => { if (!$('#screen-my').hidden) renderMy(); }).catch(() => {});
}
if (state.profile) {
  saveState(); // 레거시 키 → 새 키 이관
  showScreen('home');
} else {
  showScreen('onboarding');
}
/* 🔴 소셜 로그인·비밀번호 재설정 메일은 **주소 뒤에 토큰을 붙여** 이 앱으로 돌아온다.
   그걸 먼저 주워 담아야(그리고 주소창에서 지워야) 로그인 상태로 이어진다.
   그 뒤에 서버와 맞춘다 — 기기 우선이라 여기서 기다리지 않는다. 인터넷이 없으면
   아무 일도 안 일어나고 앱은 지금처럼 그대로 돈다. */
if (typeof authCaptureFromUrl === 'function') {
  authCaptureFromUrl().then((kind) => {
    if (kind === 'recovery') { openAuthSheet('newpw'); return; }   // 새 비밀번호를 정할 차례
    if (kind === 'signin') { toast('로그인했어요'); renderMy(); }
    if (typeof syncAfterLoad === 'function') syncAfterLoad();
  }).catch(() => {
    if (typeof syncAfterLoad === 'function') syncAfterLoad();
  });
} else if (typeof syncAfterLoad === 'function') {
  syncAfterLoad();
}
