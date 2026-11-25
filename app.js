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
/* 🔴 **빈 상태는 여기 한 곳에서만 만든다** (2026-09-09 코드 리뷰에서 잡았다).
   예전에는 '데이터 초기화' 버튼이 `state = { profile: null, applications: [] }` 라고
   **제 손으로 다시 적고** 있었다. 그래서 그 뒤에 늘어난 칸(`saved`·`consent`·`updatedAt`)이
   빠졌고, 초기화한 뒤 그 자리에서 온보딩을 다시 마치면 `state.saved` 가 undefined 라
   화면을 그릴 때마다 `Cannot read properties of undefined (reading 'some')` 가 났다
   (브라우저 실측). 앱을 껐다 켜면 `loadState` 가 메워 주기 때문에 **눈으로 재현하기 가장
   어려운 유형**이다 — 개발자는 '가끔 이상하다'로만 겪는다.
   ⚠️ 칸을 새로 늘릴 때는 여기만 고치면 된다. 다른 곳에서 이 모양을 다시 적지 말 것. */
function emptyState() {
  return {
    profile: null,          // 온보딩 결과
    applications: [],       // { id, appliedAt, step, docs?, pending? }
    /* 저장(북마크)한 공고 — { id, savedAt } (2026-09-07 · 노션 UI-21).
     🔴 `applications` 의 `pending` 과 **절대 합치지 말 것.** 뜻이 다르다:
        · pending  = 신청을 시작했는데 서류 작성이 남았다
        · saved    = 아직 신청할 생각은 없고 관심만 있다
     한 칸에 넣으면 그 값을 읽는 곳이 한꺼번에 오염된다 — 홈의 예상 수혜액 합계에
     관심만 둔 공고 금액이 섞이고, 진척도 4단계가 시작도 안 한 공고를 1단계로 세고,
     알림이 신청도 안 한 공고를 재촉한다.
     ⚠️ 이 목록은 **이 기기에만 남는다.** 서버(profiles 표)에는 profile·applications
        칸만 있어 동기화되지 않는다 — 칸을 늘리려면 표부터 고쳐야 한다. */
    saved: [],
    /* 휴지통 — 지운 신청내역이 30일 동안 여기 머문다 (2026-09-11 개발자 지시).
       { at, app, deletedAt } · at = 지우기 전 목록에서의 자리(되살릴 때 그 자리로 돌려놓는다).
       🔴 지운 **서류 파일**은 여기 없다 — 파일은 크기 때문에 localStorage 에 못 담아
          IndexedDB 'trash' 칸에 있다. 화면(renderTrash)이 둘을 합쳐 보여 준다.
       ⚠️ 이 목록도 saved 와 같이 **이 기기에만** 남는다(서버 표에 칸이 없다). */
    trash: [],
    /* 민감정보(기초생활수급·장애 등)를 서버에 올려도 되는가 — 온보딩 Step 3에서 받는다.
     동의 안 하면 그 항목은 기기에만 남는다(supabase-client.js syncSafeProfile). */
    consent: { sensitive: false },
    /* 이 기기에서 마지막으로 고친 시각. 서버 것과 견줘 **최신이 이긴다**. */
    updatedAt: null,
  };
}
let state = emptyState();

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

/* 시·도를 고르면 그 아래 시·군·구를 채운다 (2026-08-30).
   🔴 표는 data.js 의 REGION_CITIES 하나뿐이다 — 여기에 목록을 베끼지 말 것.
   ⚠️ 시·도를 바꾸면 전에 고른 시·군은 뜻이 없어지므로 비운다(경기 성남시를 골라 두고
      시·도만 부산으로 바꾸면 '부산 성남시'가 된다). */
function fillRegionCities(provSel, citySel, keep) {
  const prov = $(provSel) && $(provSel).value;
  const el = $(citySel);
  if (!el) return;
  const first = el.querySelector('option') ? el.querySelector('option').textContent : '선택 안 함';
  const list = (typeof REGION_CITIES !== 'undefined' && REGION_CITIES[prov]) || [];
  el.innerHTML = `<option value="">${esc(first)}</option>`
    + list.map((c) => `<option${keep === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
  el.disabled = !list.length;
}

/* 이사하면 「지금 주소에 산 지」 답은 옛 주소의 것이다 (2026-11-13 · 리뷰) — 저장해 둔 시·도나 시·군을
   다른 값으로 바꾸면 거주 기간 칩을 끈다(저장하면 null = 모름). 안 끄면 옹진군 「10년 이상」이 이사 간
   서초구에 그대로 붙어 「1년 이상 ○○구 거주」 줄이 틀린 ✓ 가 된다. 처음 적는 칸(저장값이 비어 있음)은
   이사가 아니라서 건드리지 않는다 · 끈 뒤 학생이 다시 고르면 그 답을 쓴다. */
function residenceMovedOff() {
  const p = state.profile;
  if (!p) return;
  const moved = (saved, now) => !!saved && now !== saved;
  if (moved(p.region, $('#in-region').value) || moved(p.regionCity, $('#in-region-city').value)) setChip('#in-residence-months', null);
}

function loadState() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    if (raw) state = Object.assign(state, JSON.parse(raw));
    if (!state.consent) state.consent = { sensitive: false };   // 로그인 이전에 저장된 판
    if (!Array.isArray(state.saved)) state.saved = [];          // 저장 기능 이전에 저장된 판
    if (!Array.isArray(state.trash)) state.trash = [];          // 휴지통 이전에 저장된 판
    if (state.profile) { migrateBranchCampus(state.profile); migrateFitFields(state.profile); }
    /* 예전에 저장된 있을 수 없는 값(평점 999·출생연도 3000)은 **그 칸만** 비운다(운영 원칙 7 · 소급).
       고쳐 넣지 않는다 — 비우면 '모름'이라 판정하지 않는다. 학생에게는 시작 뒤 한 번 알린다. */
    if (state.profile) scrubbedOnLoad = scrubProfileNumbers(state.profile);
  } catch (e) { /* 손상된 데이터는 무시 */ }
}
let scrubbedOnLoad = [];
/* opts.fromServer = 서버에서 받아 온 것을 그대로 적는 중이라는 뜻.
   그때는 시각을 새로 찍지 않고(서버 시각을 그대로 쓴다) 되돌려 올리지도 않는다 —
   안 그러면 받은 것을 곧바로 다시 올리는 헛돌기가 생긴다. */
/* opts.local = 학생이 고친 것이 아니라 **기기 안 캐시**를 적는 중(신청 내역의 공고 사본 · 2026-10-02 코드 리뷰 · 치명).
   시각을 찍으면 '방금 고쳤다'가 되어, 로봇 데이터만 새로 받은 폰이 다른 폰의 진짜 기록(제출·선정)을 서버에서 덮는다
   (CLAUDE.md 「기기 사이 덮어쓰기」). 그래서 시각도 안 찍고 올리지도 않는다 — fromServer 와 같은 길. */
function saveState(opts) {
  const o = opts || {};
  if (o.local) o.fromServer = true;
  if (!o.fromServer) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // 알림 판단에 쓰는 프로필·신청내역 사본을 갱신한다 (서비스워커는 localStorage를 못 읽는다)
  if (typeof notifySyncContext === 'function') notifySyncContext();
  if (!o.fromServer && typeof syncSchedulePush === 'function') syncSchedulePush();
}

/* ---------------- 장학금 목록 (한국장학재단 상시 제도 + 정식 등록 실공고) ---------------- */
let registeredList = []; // data/registered.json — 수집 로봇이 확보한 실공고를 큐레이션해 정식 등록한 목록
/* 층2 — 한국장학재단(KOSAF) 통합검색에서 받은 **마감 전** 재단 장학금 (2026-08-30).
   🔴 층1(registeredList)과 절대 섞지 않는다. 우리가 원문을 읽은 것이 아니라 재단이
      KOSAF 에 적어 둔 칸이라, 자격 진단도 양식 작성도 붙이지 않는다 — 그대로 보여 주고
      "자격은 재단 홈페이지에서 확인"이라고 밝힌다(설계: docs/designs/kosaf-and-narrowing.md ②). */
let kosafList = [];
/* 두 공고 목록을 **실제로 받아 왔는가** (2026-10-02 리뷰) — 신청 내역은 '공고가 내려갔다'를 이것으로만 말한다.
   받기 전·못 받았을 때 모든 신청이 '내려간 것'처럼 보여 「아직 준비한 장학금이 없어요」가 뜨는 것을 막는다.
   'wait' 받는 중 · 'ok' 받음 · 'fail' 못 받음 */
const appsData = { registered: 'wait', kosaf: 'wait' };
let kosafUpdatedAt = '';

function registeredFor(p) {
  return scopedToProfile(registeredList, p); // match-engine.js — 알림도 같은 기준을 쓴다
}

function allScholarships() {
  const p = state.profile;
  if (!p || !p.school) return NATIONAL_SCHOLARSHIPS;
  /* 한국장학재단 등록분은 **교외 공고로 함께** 낸다 (2026-08-30 개발자 지시:
     "한국장학재단에 뜬 장학금이라고 하지 말고 그냥 교외에 포함시켜줘").
     따로 두면 아무도 못 찾고, 화면도 두 벌이 된다. */
  return NATIONAL_SCHOLARSHIPS.concat(registeredFor(p), kosafAsScholarships());
}
function findSch(id) {
  return allScholarships().find((s) => s.id === id) || null;
}

/* ---------------- 매칭 엔진 ----------------
   자격 판정(evaluate)·적합도(fitScore)·학교 한정 필터(scopedToProfile)는 match-engine.js에 있다.
   서비스워커(백그라운드 알림)도 같은 파일을 읽어, 화면과 알림의 기준이 갈라지지 않는다. */

/* 🔴 한국장학재단 등록분의 자격은 **우리가 확인한 것이 아니다** (2026-08-30).
   그대로 두면 evaluate 가 `selective`(선발형 = 신청 가능)로 읽고, 그 status 를 믿는 곳이
   전부 딸려 온다 — 실측: 홈 히어로 합계가 **2억 2,420만원**으로 부풀고, 일괄 신청 준비
   118건 중 **104건이 KOSAF** 였다. 앱이 준비해 줄 수도 없는 것들이다.
   확인 안 한 것을 '받을 수 있다'고 더하는 것은 기망이다(운영 원칙 · parse-amount 첫머리).
   🔴 호출자마다 막지 않고 **여기 한 곳**에서 정직한 값으로 바꾼다 — getMatches 와
      openDetail 이 같은 함수를 쓴다. 베끼면 카드와 상세가 갈라진다.
   ⚠️ 확정된 미달(`ineligible`)은 그대로 둔다 — evaluate 가 근거를 갖고 내린 판정이라
      '미확인'으로 덮으면 그것도 거짓말이다(배지 규칙과 같은 이유). */
function evaluateFor(s, p) {
  const r = evaluate(s, p);
  return (s && s.sourceKind === 'kosaf' && r.status !== 'ineligible')
    ? { ...r, status: 'unknown' } : r;
}
/* 🔴 적합도는 **한 곳**에서 낸다 (2026-08-30). getMatches 만 고치고 openDetail 을 안 고쳐서
   카드는 「자격 미확인」인데 시트는 「적합도 25%」였다 — 개발자가 바로 눌러 보고 잡았다.
   ⚠️ 한때 여기서 한국장학재단 등록분을 **무조건 '자격 미확인'** 으로 눌러 뒀다.
      지역 요건(83곳)을 판정할 수 없어 서울 학생에게 안양시 장학금이 95%로 뜨던 때의
      임시 조치였다. 시·군을 받아 지역을 판정하게 된 뒤로는 그 눌림이 **오히려 거짓말**이라
      걷어냈다(실측: 미달 79 · 적합 33 · 미확인 4로 갈린다). */
function fitDetailFor(s, p) {
  return fitDetail(s, p);
}

function getMatches() {
  const p = state.profile;
  /* 기한도 자격도 모르는 정식 공고는 카드가 아니라 게시판 글로 간다 — 판정은 match-engine feedOnlyFormal 한 곳(알림과 같다 · 2026-11-15 결정 1) */
  return allScholarships().map((s) => {
    const result = evaluateFor(s, p);
    /* 🔴 한국장학재단 등록분은 **적합도를 단정하지 않는다** (2026-08-30).
       재단이 적어 둔 칸에는 `지역거주구분: 안양시에 주소를 두고…` 처럼 기계가 못 읽는 요건이
       섞여 있는데, 그 줄은 판정에서 조용히 빠진다. 그러면 서울 학생에게 안양시 장학금이
       **「적합도 95% · 요건 3개 중 3개 충족」** 으로 뜬다 — 실제로 그렇게 떠 있었다.
       틀린 미달이 못 받는 것보다 나쁜 것처럼, **틀린 안심도 그만큼 나쁘다.**
       그래서 배지·정렬이 보는 fd 를 '아직 못 읽음'으로 준다(자격 줄은 그대로 보여 준다).
       판정 규칙은 fitVerdict 한 곳 그대로다 — 여기서는 근거만 정직하게 넘긴다. */
    return { sch: s, result, fit: fitScore(s, result, p), fd: fitDetailFor(s, p) };
  }).filter((m) => !feedOnlyFormal(m.sch, p, { status: m.result.status, fd: m.fd }));
}

/* ---------------- 공고 저장(북마크) ----------------
   인스타그램처럼 공고를 찜해 두는 자리 (2026-09-07 개발자 지시 · 노션 UI-21).
   신청과는 다른 일이다 — 저장은 "나중에 볼게"이고 신청은 "준비를 시작했다"이다.
   그래서 저장분은 **홈의 예상 수혜액 합계에 넣지 않는다**(확인 안 한 것을 받을 수
   있다고 더하지 않는다는 규칙과 같은 정신). 대신 보관함이 저장분 합계를 따로 낸다. */
function isSaved(id) {
  return state.saved.some((s) => s.id === id);
}
/** 저장/해제. 되돌리기를 붙여 잘못 누른 학생이 한 번에 복구할 수 있게 한다. */
function toggleSave(id) {
  const at = state.saved.findIndex((s) => s.id === id);
  /* 🔴 **해제는 findSch 를 요구하지 않는다** (2026-09-07 코드 리뷰).
     데이터에서 내려간 공고를 저장해 둔 학생은, 그것을 찾을 수 없다는 이유로
     영영 지우지 못하게 된다. 없는 것을 새로 담는 것만 막으면 된다. */
  if (at < 0 && !findSaveTarget(id)) return;
  if (at >= 0) {
    /* 되돌리기는 **뺀 줄을 그대로** 제자리에 돌려놓는다(2026-10-02) — 다시 담기(toggleSave)로 되돌리면 데이터에서 빠진 공고·활동은
       '없는 것을 담지 않는다'에 막혀 영영 못 돌아오고, 활동은 떠 둔 사본까지 잃는다 */
    const removed = state.saved.splice(at, 1)[0];
    saveState();
    toast('저장을 해제했어요', { label: '되돌리기', run: () => {
      if (isSaved(id)) return;
      state.saved.splice(Math.min(at, state.saved.length), 0, removed);
      saveState();
      refreshSaveViews(id);
    } });
  } else {
    /* 대외활동·공모전은 **글 사본을 함께** 담는다(2026-10-02) — 활동 글은 60일·마감 뒤 데이터에서 빠지는데,
       빠져도 보관함·달력에서 사라지지 않게. 저장 목록은 이 기기에만 있어(서버로 안 감) 동기화와 무관하다 */
    const act = isActivityId(id) ? findActivity(id.slice(4)) : null;
    state.saved.push(act ? { id, savedAt: nowStamp(), snap: JSON.parse(JSON.stringify(act)) } : { id, savedAt: nowStamp() });
    saveState();
    if (typeof trackUse === 'function') trackUse('save', isActivityId(id) ? id.slice(4) : id);
    toast('보관함에 저장했어요', { label: '보관함', run: () => showScreen('my') });
  }
  refreshSaveViews(id);
}
/** 저장한 공고를 **최근 저장 순**으로. 못 찾는 것(데이터에서 내려간 공고)은 조용히 뺀다.
    대외활동·공모전도 같은 목록에 온다(2026-10-02) — 활동은 엔진 모양(activityAsSch)으로 바꿔 장학과 같은 줄로 그린다. */
function savedScholarships() {
  return state.saved.slice().reverse()
    .map((s) => findSaveTarget(s.id))
    .filter(Boolean);
}

/* ── 대외활동·공모전 저장·달력 (2026-10-02 개발자 지시: "대외활동도 북마크랑 달력 연결해줘") ──
   id 는 'act:' + 글 주소(activityAsSch 와 같다 · 장학 id 와 섞이지 않는다). 찾는 길은 **한 곳**(findSaveTarget):
   장학 id 는 findSch, 활동 id 는 지금 피드의 글 → 없으면 담을 때 떠 둔 사본. 보관함·달력·상세가 이것만 쓴다. */
const isActivityId = (id) => String(id || '').startsWith('act:');
function findActivity(url) {
  return ((liveActivities && liveActivities.items) || []).find((x) => x && x.url === url) || null;
}
/* 「양식 채우기」(formfill.js)가 여는 대상 — 장학(allScholarships)이 먼저, 없으면 활동 글(2026-10-31 · 공모전 참가신청서).
   활동 글은 신청서 원본 PDF·빈칸 장부가 글 id(collector activityId)에 붙는다 — 화면은 id·이름만 쓴다(장학 엔진 모양 activityAsSch 와 다르다: 그쪽 id 는 act:주소). */
function activityFillTarget(n) { return n && n.id ? { id: n.id, name: activityTitle(n), activity: true } : null; }
function fillTargetFor(id) {
  const s = allScholarships().find((x) => x.id === id);
  if (s) return s;
  return activityFillTarget(((liveActivities && liveActivities.items) || []).find((x) => x && x.id === id));
}
/* 활동 글 원본(피드 모양) — 피드에 있으면 그것, 없으면 저장할 때 떠 둔 사본 */
function activityItem(url) {
  const live = findActivity(url);
  if (live) return live;
  const sv = state.saved.find((x) => x.id === `act:${url}`);
  return (sv && sv.snap) || null;
}
/* 담아 둔 활동의 사본을 피드의 새 글로 갈아 둔다 — 피드에서 빠진 뒤에 쓰이는 사본이 담던 날의 옛 마감을 말하지 않게(2026-10-02 리뷰).
   기기 안 캐시라 saveState({ local: true }) — 학생이 고친 것으로 찍지 않는다(신청 내역 사본과 같은 규칙) */
function refreshActivitySnaps() {
  let changed = false;
  for (const sv of state.saved) {
    if (!isActivityId(sv.id)) continue;
    const live = findActivity(sv.id.slice(4));
    if (!live) continue;
    const json = JSON.stringify(live);
    if (sv.snap && JSON.stringify(sv.snap) === json) continue;
    sv.snap = JSON.parse(json);
    changed = true;
  }
  if (changed) saveState({ local: true });
}
function findSaveTarget(id) {
  if (!isActivityId(id)) return findSch(id);
  const n = activityItem(id.slice(4));
  return n ? activityAsSch(n) : null;
}
/* 저장 상태가 바뀌면 지금 떠 있는 것만 다시 그린다 — 화면을 통째로 새로 그리면
   스크롤이 맨 위로 튄다(일괄 준비 목록에서 겪은 것과 같은 유형). */
function refreshSaveViews(id) {
  const on = isSaved(id);
  $$(`[data-save="${CSS.escape(id)}"]`).forEach((b) => {
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? '저장 해제' : '공고 저장');
    /* 눌린 단추가 튕긴다 (2026-09-09) — 인스타 더블탭 하트와 같은 일이다.
       🔴 **담을 때만** 튕긴다. 해제까지 축하하듯 튕기면 무슨 일이 일어났는지 흐려진다.
          해제는 토스트가 '되돌리기'와 함께 말한다. */
    if (on && typeof popEl === 'function') popEl(b);
    else b.classList.remove('pop');   // 해제하면 앞서 담을 때의 표시를 즉시 지운다
  });
  /* 손끝에도 한 번 — 아주 짧게(10ms). 폰 설정에서 진동을 끈 학생에게는 아무 일도 없다.
     🔴 `toggleSave` 가 아니라 여기 둔다: 저장이 실제로 화면에 반영되는 지점이 여기라
        "울렸는데 안 담긴" 경우가 생기지 않는다. */
  if (typeof haptic === 'function') haptic(on ? 12 : 8);
  if (!$('#screen-my').hidden) renderSaved();
  if (!$('#screen-applications').hidden && calMode) renderCalendar();
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

/* 마감된 공고를 **신청 화면 목록에** 며칠 더 남겨 둘지 (2026-09-05 개발자 지시로 7 → 1).
   1 = 마감 다음 날까지 '마감'으로 보이고, 그 다음 날 목록에서 내려간다.
   🔴 사라지는 게 아니라 **자리를 옮기는 것**이다 — 담아 둔 공고는 신청 내역에 그대로
      남는다(renderApplications 는 이 상수도 dday 도 쓰지 않는다 — 회귀 검사가 못 박음).
      예전 주석이 걱정한 "'내가 신청한 그 공고'를 못 찾는다"는 그 경로로 해결된다.
      층2(KOSAF) 목록도 같은 상수를 쓰므로 함께 적용된다 — 규칙이 갈라지지 않게 그대로 둔다. */
const CLOSED_KEEP_DAYS = 1;

function dday(dateStr) {
  /* 마감을 확정 못 한 공고 — 목록에 유지(days 14 는 목록에서 안 사라지게 하는 값일 뿐 · 순서에 쓰지 말 것 — homeScore).
     🔴 글자는 비운다 (2026-11-15 · 개발자 결정 11-02 "'모름' 같은 말이 보이면 신뢰가 떨어진다") — 예전 '기한 원문 확인'·'기한 확인 중'.
        모르는 마감은 **아무것도 그리지 않는다**(지어내지 않는다). 모른다는 표시는 unknown 하나 — 글자로 판정하지 말 것 */
  if (!dateStr) return { label: '', cls: '', days: 14, unknown: true };
  // 날짜끼리 비교해야 마감 다음 날 새벽에 D-DAY로 잘못 뜨지 않는다 (마감 당일=D-DAY, 지난 날=마감)
  const startOfToday = todayStart();
  const d = Math.round((new Date(dateStr + 'T00:00:00') - startOfToday) / 86400000);
  if (d < 0) return { label: '마감', cls: 'closed', days: d };
  if (d === 0) return { label: 'D-DAY', cls: 'urgent', days: d };
  if (d <= 7) return { label: `D-${d}`, cls: 'urgent', days: d };
  return { label: `D-${d}`, cls: '', days: d };
}

/* 마감을 학생에게 보이는 **한 가지 말**로 옮긴다 (2026-09-10 페이스리프트).
   왜 — 앱 전체에 마감 표기가 다섯 가지였고 홈 한 화면에 그중 넷이 함께 떴다:
   'D-DAY' 배지 · '9/10 마감' 막대 · '9월 10일 15:25' · '2026-09-09'.
   🔴 **판정을 새로 하지 않는다** — 위 dday() 가 낸 값만 받아 말로 바꾼다.
      여기서 날짜를 다시 계산하면 배지·달력이 서로 다른 말을 하게 된다.
   🔴 시간 단위를 쓰지 않는다 — 우리가 아는 것은 날짜뿐이라 마감 '시각'을 모른다.
   🔴 **카드의 말은 D-DAY 카운트다** (2026-09-11 개발자 지시: "빨간색 마감 인터렉션 바를
      지우고 마감 D-DAY 카운트만 남겨놓기"). '오늘 마감·3일 남음' 으로 풀어 쓰던 것을
      상세 시트·달력 배지가 이미 쓰는 `dday().label`(D-DAY · D-3 · 마감) 과 **같은 글자**로
      맞췄다 — 목록과 상세가 마감을 다른 글자로 말하지 않는다.
   ⚠️ 달력은 날짜 자체가 내용이라 이 말을 쓰지 않는다(isoOf 그대로). */
function ddayWords(d) {
  if (!d || d.unknown) return '';   // 마감을 모르면 말하지 않는다(2026-11-15 · 예전 '기한 확인 중')
  return d.label;   // '마감' · 'D-DAY' · 'D-n' — dday() 가 낸 글자 그대로
}

/* 🔴 **카드 제목에서 기관명을 떼지 않는다** (2026-09-21 개발자 지시:
   *"공고 이름이 너무 축약되어 있음. `~재단 성적 장학금` 이면 메인 제목은 그냥 `성적장학금` 으로
   뜨니까 학생 입장에서 헷갈릴 것 같아."*)

   2026-09-10~11 에는 기관명을 뗐다. 한 카드에 기관명이 두 번 나와서였다(윗줄 `교외 · 동산장학회`
   + 제목 `동산장학회 장학생`). 그런데 떼고 나니 **제목이 누구 것인지 모르는 말**이 됐다 —
   실측: `장학생 (이공계 새터민 대상)` · `장학생 (2026 하반기)` · `특기장학금` · `복지장학금`.
   층2(한국장학재단)는 `name = 재단명 + 사업명` 이라 떼면 사업명만 남는데, 그 사업명이
   `장학생`·`특기장학금` 처럼 재단을 빼면 뜻이 없는 것이 흔하다.
   2026-09-11 에 `GENERIC_TITLE_REST` 로 막아 봤지만 **괄호가 붙으면 새어 나간다**
   (`장학생 (이공계 새터민 대상)` 은 '흔한 낱말뿐'이 아니라서 통과했다).

   → 제목에 기관명을 **되살리고**, 대신 **윗줄에서 뺀다**(`cardOrgLine`). 기관명은 카드에 한 번
     나오되, 그 한 번이 **학생이 실제로 읽는 굵은 줄**이 된다. 두 지적을 다 지킨다.

   길이는 재 봤다(2026-09-21 · 375px 폰 너비에 실제로 그려 놓고 잰 값, 카드 제목 폭 335px):
   전체 169장에서 1줄 158 → 154 · 2줄 11 → 15. **3줄은 0건이고 잘리는 카드도 없다**
   (`.sch-name` 은 줄임표도 줄 수 제한도 없다). 4장이 한 줄 늘어나는 것이 전부다.
   ⚠️ 상세 시트 제목도 이 함수를 쓴다(2026-10-06 사장님 지시 · 개선안 E). 원문과 대조할 글자는
      '공고 원문 안내' 발췌와 원문 링크가 그대로 준다. */
function cardTitle(sch) {
  return cleanCardTitle(stripBoardHead(sch.name, sch.sourceUrl));   // 게시판 분류 머리말(공통·일반공지·장학 ★)부터 뗀다(2026-11-25)
}

/* 카드 맨 윗줄의 `교외 · 기관명`. 🔴 **제목이 이미 기관명을 담고 있으면 기관명을 뺀다** —
   안 빼면 `교외 · 해석정해영선생장학문화재단` 바로 밑에 `해석정해영선생장학문화재단 해석미술장학생`
   이 와서 같은 이름을 두 번 읽게 된다(2026-09-10에 개발자가 짚은 바로 그 모습).
   ⚠️ 지우기만 한다 — 아무 글자도 더하지 않는다.
   🔴 기관명을 못 읽은 공고(`주관 기관 원문 확인` · 로봇이 적는 '모름' 표시)는 **윗줄에 기관 칸을 안 붙인다** — `교외` 만 (2026-10-05 점검 app1-09).
      예전엔 `교외 · 주관 기관 원문 확인` 이 그대로 떠 정식 등록 대부분의 카드 윗줄이 앱 내부 사정을 말했다 — 제출처(data.js knownProvider)·
      지원서 초안(provLead)·도우미는 이미 숨기는 글자다(2026-09-17 지시 "앱 내부 사정은 학생 화면에 안 적는다"). 판정은 아래 `providerUnknown` 한 곳.

   🔴 **'카드에 딱 한 번' 을 보장하지는 못한다** (2026-09-21 코드 리뷰가 잡았다 · 실측 5건).
      `한국외대 총동문회` ↔ `총동문회 장학금` 처럼 **이름이 일부만 겹치는** 짝은 그대로 둔다 —
      맞히려면 느슨한 대조가 필요하고, 그건 멀쩡한 기관명을 지우는 쪽으로 틀린다.
      여기서 막는 것은 **이름이 통째로 겹치는 것**뿐이다.
   ⚠️ `p.length >= 3` 바닥값을 낮추지 말 것 — 두 글자 기관명(`KT`)은 엉뚱한 낱말 안에서 걸린다. */
const bareOrg = (t) => String(t || '').replace(/^(재단법인|사단법인|학교법인|의료법인|\(재\)|\(사\)|재\)|사\))\s*/, '').trim();
/* 기관명 칸에 붙은 꼬리 괄호를 뗀다 — `(재)가송재단 (한국외대 접수)` 의 접수처 표기.
   안 떼면 제목이 `(재)가송재단 장학생 (한국외대 접수, 2026-2학기)` 인데도 겹침을 못 알아본다(실측 3건). */
const orgBase = (t) => String(t || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
/* 주관 기관 칸이 비었거나 '모름' 표시(`주관 기관 원문 확인`·`미확인` — auto-register PROVIDER_UNKNOWN)인가 — 카드 윗줄·지원서 초안이 같이 쓴다 */
const providerUnknown = (v) => !String(v || '').trim() || /원문 확인|미확인|확인\s?필요/.test(String(v));
/* 학생 화면에 싣지 않는 '모름'류 글자 — verify/no-unknown-words.cjs UNKNOWN_WORDS 와 같은 낱말(브라우저가 그 파일을 못 읽어 한 번 더 · 관문 「학생 화면에 '모름'류 글자가 없다」 ⑥이 낱말마다 대조한다) */
const SAYS_UNKNOWN = /모름|미확인|원문(?:에서)? 확인|확인\s?필요|기한 확인 중|정보 입력 필요/;
/* 칸 하나의 '아는 것만' (2026-11-16 리뷰 — 달력 줄·지원서 초안이 칸을 그대로 옮겨 「금액 원문 확인」·「기관확인필요」가 샜다).
   🔴 **통째로 싣거나 통째로 뺀다** (2026-11-16 2차 리뷰 · 원칙 8-1) — 원문·재단 칸은 인용이다. 예전엔 「확인 필요」 마디만 떼어
      「등록금 전액 지원 단, 소득분위 확인 필요」 → 「등록금 전액」(조건이 사라져 무조건 전액으로 읽힌다)처럼 **문장 가운데를 자른 글**을 원문이라며 보였다.
      '모름'류 낱말이 하나라도 있으면 그 값은 화면에 없다 · 없으면 한 글자도 안 바꾸고 그대로 · 글자를 더하지 않는다 */
function knownValue(v) {
  const t = String(v || '').trim();
  return t && !SAYS_UNKNOWN.test(t) ? t : '';
}   // 「기관확인필요」 — 재단이 KOSAF 칸에 적어 둔 모름 표시(2026-11-02 실화면)
function cardOrgLine(sch) {
  const prov = String(sch.provider || '').trim();
  /* 🔴 **'모른다'는 표시는 카드 윗줄에 싣지 않는다** (2026-10-06 사장님 지시 'AI 티' · 개선안 D).
     로봇이 주관 기관을 못 읽으면 `주관 기관 원문 확인` 이 들어오는데, 그게 거의 모든 카드
     윗줄을 채워 **템플릿이 자기 빈칸을 읽어 주는** 모양이 됐다(AI 화면의 대표 지문).
     감추는 게 아니라 자리를 옮기는 것이다 — 상세 시트의 주관 줄은 그대로 그 말을 한다(원칙 8-1).
     판정은 `providerUnknown` 한 곳(지원서 초안 provLead 와 같이 쓴다 — 2026-10-05 점검 app1-09 가 같은 일을 먼저 했다). */
  if (providerUnknown(prov)) return String(sch.type || '');
  const title = cardTitle(sch);
  /* ⚠️ `bareOrg(title)` 로도 대조하지 않는다 — 앞머리를 떼는 것은 **없던 조각을 만들지 못하므로**
     `title.includes` 가 이미 하는 일이다(리뷰가 죽은 코드로 짚었고 실측으로도 0건이었다). */
  const dup = [prov, bareOrg(prov), orgBase(prov), bareOrg(orgBase(prov))]
    .some((p) => p.length >= 3 && title.includes(p));
  return dup ? String(sch.type || '') : `${sch.type} · ${prov}`;
}

/* ── 카드 시안 B · 상세 시트 한 벌 (2026-11-02 개발자 승인 · docs/designs/mockups/card-consistency.html 「시안 B」 · sheet-consistency.html) ──
   윗줄 = 갈래 칩 + 주최(알 때만) + 적합도 알약 · 제목은 지우고 나누기만 · 핵심 한 줄은 장학 「금액 · …」 / 활동 「대상 · …」 · 마감은 아랫줄 그대로(옛 결정).
   🔴 글자를 더하지 않는다 — 칩 이름 여섯과 이름표 셋(금액·대상·접수)만 앱의 말이고 나머지는 원문이다. */
const KIND_CHIP_CLS = { '교내': 'badge-in', '교외': 'badge-out' };
const ACT_CHIP_CLS = { '공모전': 'badge-kind badge-contest', '봉사': 'badge-kind badge-vol', '청년정책': 'badge-kind', '대외활동': 'badge-kind badge-act' };   // 청년정책은 회색 그대로(시안에 없던 갈래)
/* 갈래 칩 — 장학은 교내/교외, 활동은 공모전·봉사·청년정책·대외활동(출처·분야로 · 판정은 activity-kind 그대로) */
function kindChip(x) {
  if (isActivityItem(x)) {
    const label = x.kind === '공모전' ? '공모전' : x.api === 'youthPolicy' ? '청년정책' : (x.field === '봉사' || x.api === 'vol1365') ? '봉사' : '대외활동';
    return { label, cls: ACT_CHIP_CLS[label] };   // 갈래 색(2026-11-15 승인 시안 1)
  }
  const type = String(x.type || '').trim();
  return { label: type ? `장학 · ${type}` : '장학', cls: `badge-kind${KIND_CHIP_CLS[type] ? ' ' + KIND_CHIP_CLS[type] : ''}` };
}
function kindChipHtml(x) { const c = kindChip(x); return `<span class="badge ${c.cls}">${esc(c.label)}</span>`; }
/* 윗줄 주최 — cardOrgLine 과 같은 겹침 규칙(제목이 기관명을 담으면 뺀다 · 모르면 빈 글자). 구분은 칩이 말하므로 여기엔 기관명만 */
function cardProviderLine(sch) {
  const prov = String(sch.provider || '').trim();
  if (providerUnknown(prov)) return '';
  const title = cardTitle(sch);
  const dup = [prov, bareOrg(prov), orgBase(prov), bareOrg(orgBase(prov))].some((p) => p.length >= 3 && title.includes(p));
  return dup ? '' : prov;
}
/* 제목 나누기 — 앞머리 괄호의 대상(「(대학생,대학원생만)」·「(성인, 대학생)」)과 「(※…)」 꼬리를 떼어 대상 줄로 옮긴다 · 끝 마침표를 뗀다.
   🔴 기관 약칭 「(재)」·「(사)」 와 대상 낱말 없는 괄호(「(강릉.원주)」)는 제목에 둔다 — 떼면 남의 제목이 된다. 날짜 괄호는 splitTitleDates 가 먼저 뗀다 */
const WHO_PAREN = /(?:대학생|대학원생|고등학생|청소년|성인|청년|재학생|졸업생|신입생|\d+\s?세|학년|전공|계열|거주|주민|시민|구민|도민|군민|대상|가능|이공계|여성|남성|외국인|유학생|누구나)(?!처|팀|센터|과|부|실|원)/;
const NOT_WHO_PAREN = /접수|제출|문의|처\b|팀\b|센터/;   // 「(학생처)」·「(학생지원팀 접수)」·「(※ 신청서는 학생처에 제출)」 은 접수처·안내지 대상이 아니다(리뷰 2026-11-02)
function splitTitleWho(title) {
  let t = String(title || '').trim();
  const who = [];
  for (;;) {
    const m = t.match(/^[(（]\s*([^()（）]{2,30})\s*[)）]\s*/);
    if (!m || !WHO_PAREN.test(m[1]) || NOT_WHO_PAREN.test(m[1]) || t.length - m[0].length < 4) break;
    who.push(m[1].trim()); t = t.slice(m[0].length).trim();
  }
  const tail = t.match(/\s*[(（]\s*※\s*([^()（）]{2,60})\s*[)）]\s*$/);
  if (tail && t.length - tail[0].length >= 4 && !NOT_WHO_PAREN.test(tail[1])) { who.push(tail[1].trim()); t = t.slice(0, t.length - tail[0].length).trim(); }
  t = t.replace(/\.\s*$/, '').trim();
  return { title: t, who };
}
/* 정식 등록 공고 — 게시판 머리말이 대괄호와 같은 낱말이면(「공통 [공통] 2026…」) 그 머리말도 뗀다(지우기만) */
function cardTitleParts(sch) {
  const raw = stripBoardHead(String(sch.name || '').trim().replace(/^\s*(\S{2,8})\s+(?=[[【]\s*\1\s*[\]】])/, ''), sch.sourceUrl);   // 게시판 분류 머리말(공통·일반공지·장학 ★) — stripBoardHead 한 곳(2026-11-25 · 전엔 해 앞의 「공통」만 뗐다)
  /* 🔴 장학 제목의 괄호는 떼지 않는다 — 장학 카드엔 「대상 · …」 줄이 없어 뗀 글자가 갈 자리가 없다(지우기가 된다 · 리뷰 2026-11-02). 끝 마침표만 */
  return { title: cleanCardTitle(raw).replace(/\.\s*$/, '').trim(), who: [] };
}
/* 핵심 한 줄(장학) — 금액을 읽었으면 「금액 · 200만원」, 층2 재단이 적어 둔 긴 금액은 옅게, 못 읽었으면 줄 없음(「금액 원문 확인」 글자를 카드에 남기지 않는다) */
function amountLine(sch) {
  const a = String(sch.amount || '');
  if (!providerUnknown(a) && a !== KOSAF_AMOUNT_UNKNOWN) return { text: `금액 · ${a}`, known: /\d/.test(a) && a.length <= 20 };
  if (sch.amountNote && !providerUnknown(sch.amountNote)) return { text: `금액 · ${sch.amountNote}`, known: false };   // 재단이 「기관확인필요」 라 적은 것도 모름(실화면 2026-11-02 대한간호협회)
  return { text: '', known: false };
}

/* 카드 제목에서 **게시판 표식**을 걷어낸다 (2026-09-10 페이스리프트).
   실측: '[공통][국가]2026년 2학기 푸른등대 기부장학금 장학생 선발(~9/10)'.
   앞의 대괄호 분류표는 그 게시판 안에서만 뜻이 있고, 뒤의 '(~9/10)'은 카드가 이미
   '오늘 마감'이라고 말하는 것과 **같은 사실을 두 번** 적는 것이다.
   🔴 지어내지 않는다 — 지우기만 하고 아무 글자도 더하지 않는다.
   🔴 짧은 표식만 뗀다(12자 이하) — 긴 대괄호는 제목의 일부일 수 있다.
   🔴 뒤 괄호는 **날짜·기간처럼 보일 때만** 뗀다. '(서울캠퍼스)' 같은 것은 남겨야 한다
      (느슨하게 떼면 캠퍼스가 사라져 다른 공고와 구별이 안 된다 — 2026-08-21 사고 유형).
   🔴 남는 글자가 4자 미만이면 아무것도 떼지 않는다(제목이 사라지는 것을 막는다).
   ⚠️ 2026-10-06 부터 상세 시트 제목도 이 함수를 쓴다(사장님 지시 · 개선안 E — openDetail 주석). */
function cleanCardTitle(name) {
  let t = String(name || '').trim();
  const before = t;
  /* 🔴 앞 표식은 **대괄호만** 뗀다 — 소괄호를 넣으면 '(재)무안군승달장학회'의 법인 표기와
     '(서울캠퍼스)' 같은 구분자가 사라진다(실측으로 확인하고 좁혔다). */
  t = t.replace(/^(?:[[【]\s*[^\]】]{1,12}\s*[\]】]\s*)+/, '').trim();
  t = trimStars(t);   // 대괄호 표식 뒤의 강조 별표(`[국가/신청] ★2026 …` · 2026-11-25)
  t = splitTitleDates(t).title;   // 날짜·기간은 한 곳에서(2026-10-05)
  t = t.replace(/[\s·\-–—:,]+$/, '').trim();
  return t.length >= 4 ? t : before;
}

/* ── 카드 제목의 날짜·기간 (2026-10-05 개발자 지적 "제목에 날짜 들어간 거 아직도 있는데") ──
   카드 제목 세 갈래(정식 등록 cleanCardTitle · 대외활동 activityTitle · 게시판·재단·소식 noticeCardHtml)가 **이 한 곳**을 부른다 —
   예전엔 셋이 따로 떼어 게시판 카드는 원제목 그대로였고 정식 등록은 `(~9/10)` 꼴만 뗐다.
   · 괄호 안이 날짜·기간뿐이면 괄호째 뗀다(`(~8/3)` `(9.11~9.28)` `(10/5 마감)` `(~2026.11.11.(수))` `[10월10일(토)/10-18시]`)
   · 괄호 안에 다른 말이 섞였으면 **날짜 조각만** 뗀다(`(10/26 마감, 공학계열, 생활비 연 1200만원)` → `(공학계열, 생활비 연 1200만원)`)
   · 꼬리 게시일(`… 공고 2026.09 . 28`)을 뗀다
   🔴 '날'까지 있는 날짜만 날짜다 — `2026학년도`·`10월 프로그램`·`2학기`·`제13회` 는 제목이다.
   🔴 지어내지 않는다 — 떼어 낸 조각(dates)은 원문 글자 그대로 돌려준다(D-day 가 없는 카드는 회색 줄로 옮긴다 · 정보를 잃지 않게).
   ⚠️ 장학 상세 시트 제목도 cardTitle 로 정리한다(2026-10-06 · 개선안 E). */
const TD_DAY = '(?:(?:20)?\\d{2}\\s?[.\\-/년]\\s?)?\\d{1,2}\\s?(?:[./]|월\\s?)\\s?\\d{1,2}\\s?(?:일)?\\.?(?:\\s?(?:[(（][월화수목금토일][)）]|[/.]?[월화수목금토일](?![가-힣])))?';
const TD_DAY_RE = new RegExp(TD_DAY);
const TD_DAY_G = new RegExp(TD_DAY, 'g');
function isDateBit(seg) {
  /* 띄어 쓴 맨 요일 + 시각(`~12/7 월 15시`)은 괄호 요일로 읽는다 (2026-11-25 실화면 · 숭실대 윤준성교수님장학금) — 그대로 두면 `12/7 월 15` 가 「12년 7월 15일」로 읽혀 `시` 가 남는다.
     🔴 요일 한 글자 뒤에 시각이 바로 올 때만 — `10월 프로그램` 은 건드리지 않는다 */
  const x = String(seg || '').replace(/(\d)\s+([월화수목금토일])(?=\s+\d{1,2}\s?(?:시|:\d))/g, '$1($2)');
  if (!TD_DAY_RE.test(x)) return false;
  const rest = x.replace(TD_DAY_G, '')
    .replace(/(?:오전|오후)?\s?\d{1,2}\s?(?::\d{2}|시)(?:\s?\d{1,2}분)?/g, '')
    .replace(/까지|부터|마감|모집|접수|연장|기간|신청|중|\d+일?/g, '')
    .replace(/[~\-–—/.,:()（）\s]/g, '');
  return rest.length === 0;
}
function splitTitleDates(title) {
  const before = String(title || '').trim();
  const dates = [];
  let t = before.replace(/([(（[【])([^()（）[\]【】]*(?:[(（][^()（）]*[)）][^()（）[\]【】]*)*)([)）\]】])/g, (m, open, inner, close) => {
    let hit = false;
    const keep = [];
    for (const x of inner.split(/\s*[,，]\s*/)) {
      if (isDateBit(x)) { hit = true; dates.push(x.trim()); continue; }
      const tag = x.match(/^([^\d~\-–]{1,8}?)\s*[-–]\s*(.+)$/);              // `[교내-10/30]` — 분류표는 두고 날짜만
      if (tag && isDateBit(tag[2])) { hit = true; dates.push(tag[2].trim()); keep.push(tag[1]); continue; }
      const lead = x.match(/^\s*(~?\s*[\d.\s/()（）월화수목금토일~\-–]+(?:까지|마감|부터))\s+(.+)$/);   // `(9/18까지 신청 및 제출)` — 앞 날짜만
      if (lead && isDateBit(lead[1])) { hit = true; dates.push(lead[1].trim()); keep.push(lead[2]); continue; }
      keep.push(x);
    }
    if (!hit) return m;
    return keep.filter((x) => x.trim()).length ? `${open}${keep.join(', ')}${close}` : ' ';
  });
  /* 게시판이 자른 제목의 꼬리 — `…신청 안내(2026.11.25...` (2026-11-25 실화면 · 경희대 Cheer-up 장학): 닫히지 않은 괄호 안이 날짜 글자뿐이고 말줄임으로 끝날 때만 뗀다.
     🔴 `(2...` 처럼 날짜인지 알 수 없는 꼬리(「2차」일 수 있다)·다른 말이 섞인 꼬리는 그대로 둔다 */
  t = t.replace(/\s*[(（]([\d.\s~\-–/()（）월화수목금토일년]*?)\s*(?:\.{2,}|…)\s*$/, (m, inner) => (TD_DAY_RE.test(inner) ? ' ' : m));   // 날(월·일)이 있어야 날짜다 — `(3~4...`(학년)·`(900~990...` 같은 범위는 그대로(리뷰 2026-11-25) · 잘린 꼬리라 dates 에는 안 넣는다(`~12.1...` 은 12.1x 일 수 있다)
  /* 붙여 쓴 기간 꼬리 — `…신청 안내_09.22(화)~10.9(금)` · `…프로그램:10/1(목)~10/6(화)` · `… 안내 2026.09.01.(화)~2026.10.06.(화)` */
  t = t.replace(/(?:\s*[_:：]\s*|\s+)([~\d][\d.\s~\-–/()（）월화수목금토일년시:까지마감부터]{3,40})$/, (m, tail) => (isDateBit(tail) && /[~\-–]|까지|마감/.test(m + tail) || /[_:：]/.test(m) && isDateBit(tail) ? (dates.push(tail.trim()), ' ') : m));
  t = t.replace(/\s+(20\d{2}\s?\.\s?\d{1,2}(?:\s?\.\s?\d{1,2})?\.?|20\d{2}-\d{1,2}-\d{1,2})\s*$/, ' ');   // 꼬리 게시일 — 마감이 아니라 dates 에 안 넣는다
  t = t.replace(/\s{2,}/g, ' ').replace(/[\s·\-–—:,]+$/, '').trim();
  return t.replace(/\s/g, '').length >= 4 ? { title: t, dates } : { title: before, dates: [] };
}

/* ── 게시판 분류 머리말 (2026-11-25 개발자 결정 · 화면 점검 — 숭실대 「장학 ★ 2026학년도 …」) ──
   몇 학교 게시판은 **분류 칸**(공통·일반공지·장학)이 제목 앞에 붙어 수집된다(전수 2026-11-25: 경희 「공통」 · 연세 「일반공지」 · 숭실 「장학」).
   그 게시판 안에서만 뜻이 있는 표식이라 카드 제목에서 뗀다 — 정식 등록(cardTitle·cardTitleParts)과 게시판 카드(noticeCardHtml)가 이 한 곳을 부른다.
   🔴 「장학」 은 제목의 첫 낱말일 수 있다(「장학 담당자 변경 안내」) — 그 분류를 쓰는 게시판 주소(숭실)에서 온 글만 뗀다. 「공통」·「일반공지」 는 어디서나.
   🔴 경희 「서울」·「국제」 는 캠퍼스라 떼지 않는다. 지우기만 한다(강조 별표 ★ 포함) · 남는 글자가 4자 미만이면 그대로 */
/* 강조 별표 — 앞뒤 것을 같이 떼고, 떼고도 별이 남으면(「★필독★ 2027학년도 …」 처럼 제목 가운데에 별이 있다) 아무것도 안 뗀다 — 한쪽만 깎인 제목이 더 나쁘다(리뷰 2026-11-25 · 실제 제목 7건) */
function trimStars(t) {
  const x = String(t || '').replace(/^★+\s*/, '').replace(/\s*★+$/, '').trim();
  return /[★☆]/.test(x) ? String(t || '') : x;
}
const BOARD_HEAD_ANY = /^(?:공통|일반공지)\s+(?=\S)/;
const BOARD_HEAD_BY_HOST = [[/(?:^|\.)ssu\.ac\.kr$/, /^장학\s+(?=\S)/]];
function stripBoardHead(title, url) {
  const before = String(title || '').trim();
  const host = (String(url || '').match(/^https?:\/\/([^/:?#]+)/) || [])[1] || '';
  let t = before.replace(BOARD_HEAD_ANY, '');
  for (const [h, re] of BOARD_HEAD_BY_HOST) if (h.test(host)) t = t.replace(re, '');
  t = trimStars(t);
  return t.replace(/\s/g, '').length >= 4 ? t : before;
}

/* notStale(오래된 공고 숨김)은 match-engine.js에 있다 — 화면에서 숨긴 공고를
   알림으로는 알리는 모순이 생기지 않도록 알림 규칙도 같은 함수를 쓴다. */

/* 판정 알약 이름표(STATUS_META · '신청 가능'·'지원 가능 · 선발 심사'·'정보 입력 필요'·'요건 미충족')는 **지웠다** (2026-11-15) —
   2026-11-02 시안 B 부터 어느 화면도 그리지 않는 죽은 표였고, '정보 입력 필요'는 개발자 결정 11-02(학생 화면에 '모름'류 글자 없음)에 걸린다.
   되살리지 말 것 — 판정은 fitVerdict·cardBadgeHtml 이 말한다. */

const APP_STEPS = ['신청 준비 완료', '공식 제출', '심사', '선정 발표'];

/* 🔴 앱 판 번호는 **여기 한 곳**이다 (2026-09-13 고객센터 신설).
   MY 아래 줄과 고객센터의 진단 정보가 같은 값을 써야 한다 — 두 곳에 적어 두면
   한쪽만 고쳐져 학생이 알려 준 판 번호가 실제와 달라진다. */
const APP_VERSION = 'v0.3';

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
  /* 확인 창 둘째 문단(진행 단계 설명)은 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */
  if (!confirm(`${officialChannel(sch).label}에서 공식 제출을 마치셨나요?`)) return;
  app.submittedAt = nowStamp();
  saveState();
  if (typeof trackUse === 'function') trackUse('submitted', sch.id);
  /* 손끝에도 한 번 (2026-09-09). 여기까지만 울린다 — 진동은 **되돌리기 어려운 일이 방금
     일어났다**는 신호로만 쓴다(저장·새로고침·이 기록 셋). 화면이 바뀔 때마다 울리면
     알림처럼 느껴져서 학생이 폰 설정에서 앱 진동을 통째로 꺼 버린다. */
  if (typeof haptic === 'function') haptic(14);
  /* 뒤 절 「접수 마감 후 심사 단계로 자동 전환」은 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */
  toast('공식 제출을 기록했어요');
  refreshProgressViews(sch.id);
}

function recordResult(sch, won) {
  const app = state.applications.find((a) => a.id === sch.id);
  if (!app) return;
  app.result = won ? 'won' : 'lost';
  app.resultAt = nowStamp();
  saveState();
  /* 데이터에서 내려간 공고는 결과를 적는 순간 신청 내역에서 빠진다(shownAppRows) — 잘못 누른 것이면 줄째 사라지므로 되돌리기를 준다 */
  if (!findSch(sch.id)) toast(`${won ? '선정을' : '결과를'} 기록했어요 · 내려간 공고라 신청 내역에서 정리했어요`, { label: '실행 취소', run: () => undoProgress(sch.id) });
  else toast(won ? '선정 결과를 기록했습니다' : '결과를 기록했습니다');
  refreshProgressViews(sch.id);
}

/* 🔴 공고가 아니라 **id 로도** 받는다 (2026-09-20). 목록에서 내려간 공고의 기록도
   되돌릴 수 있어야 한다 — 저장 해제(`toggleSave`)가 같은 이유로 findSch 를 요구하지
   않는 것과 같은 규칙이다. 하는 일은 기록을 지우는 것뿐이라 공고가 필요 없다. */
function undoProgress(schOrId) {
  const id = typeof schOrId === 'string' ? schOrId : schOrId && schOrId.id;
  if (!id) return;
  const app = state.applications.find((a) => a.id === id);
  if (!app) return;
  if (app.result) { app.result = null; app.resultAt = null; }
  else if (app.submittedAt) { app.submittedAt = null; }
  saveState();
  refreshProgressViews(id);
}

/* 진척도 기록 후 시트와 뒤 화면(내역·홈)을 함께 갱신 */
function refreshProgressViews(id) {
  /* 🔴 시트 **안에서** 기록했을 때만 시트를 다시 연다. 예전엔 무조건 열었는데,
     그때는 기록 버튼이 시트에만 있었다. 지금은 신청 내역 패널에도 있어서
     그대로 두면 패널에서 '선정' 을 누를 때마다 엉뚱하게 상세 시트가 튀어나온다(실측). */
  const wasOpen = !$('#detail-sheet').hidden;
  /* 🔴 **화면을 '바꾸지' 않고 '다시 그리기만' 한다** (2026-09-10 코드 리뷰에서 잡았다).
     예전에는 지금 화면을 `showScreen()` 으로 다시 열었는데, 그 함수는 마지막에 조건 없이
     `appScrollTo(o.scroll || 0)` 로 스크롤을 되돌린다. 그래서 신청 내역을 한참
     내려가 '선정'·'제출했다고 기록'을 누르면 **목록 맨 위로 튀었다**(실측 2527 → 0).
     학생은 방금 기록한 공고를 찾아 다시 끝까지 내려가야 하고, 여러 건을 이어서 기록할
     때마다 되풀이된다. 옆의 `deleteApps` 는 처음부터 렌더 함수만 부르고 있었다. */
  const current = $$('.screen').find((sc) => !sc.hidden);
  const name = current ? current.id.replace('screen-', '') : '';
  if (name === 'applications') renderApplications();
  else if (name === 'home') renderHome();
  else if (name === 'explore') renderExplore();
  else if (name === 'my') renderMy();
  if (wasOpen) { if (appSch(id)) openDetail(id); else closeSheet(); }   // 결과를 적어 사라진 줄의 시트는 닫는다
}

/* 알림 글을 머리·설명으로 가른다 — 첫 ` · ` 또는 ` — ` 에서 한 번만.
   머리가 너무 길면(문장 하나짜리 경고 등) 가르지 않는다: 머리만 굵어져 오히려 무겁다. */
function toastParts(msg) {
  const t = String(msg == null ? '' : msg).trim();
  const m = t.match(/^(.+?)\s+[·—]\s+(.+)$/s);
  if (!m || m[1].length > 24) return { head: t, sub: '' };
  return { head: m[1], sub: m[2] };
}

/* 알림의 성격 — 아이콘을 고른다(승인 시안 C · 2026-11-21).
   안 된 일(실패·차단·막음)을 먼저 본다: '서류를 지우지 못했어요' 처럼 '지웠'·'완료'류 낱말이 섞여도 실패다.
   🔴 서버 오류 문구(supabase-client.js authErrorText — '문제가 생겼어요 (…)')·입력 막음(input-guard)·초안 거절(essay.js)도
      여기서 잡는다 — '생겼어요'는 끝난 말꼴이라 안 잡으면 **서버 정보 삭제 실패에 초록 체크**가 붙는다(리뷰 2026-11-21).
   된 일은 끝난 말꼴(완료·했어요·했습니다…)로만 · 둘 다 아니면 안내(새 알림 n건 · 켜기 가능 등). */
const TOAST_WARN = /실패|미지원|못\s?[가-힣]|차단|벗어나|사이만|이하 (파일|사진)|이미 다른|필요$|^먼저|골라 주세요|읽을 수 없|찾지 못|문제가 생겼|다시 시도|연결을 확인|로그인해 주세요|맞지 않아요|이상이어야|다시 확인해|먼저 눌러|보내지 않았|다시 눌러|적을 수 있어요|적을 수 없|적어 주세요|있을 수 없|재료에 없는|비어 있음|직접 쓰셔야|아니에요/;
const TOAST_DONE = /완료|[했됐웠겼렸왔켰] ?(어요|습니다)|해제했|저장했|기록했|되살|불러왔|^로그아웃|\d+건 삭제/;
function toastTone(msg) {
  const t = String(msg == null ? '' : msg);
  if (TOAST_WARN.test(t)) return 'warn';
  if (TOAST_DONE.test(t)) return 'done';
  return 'info';
}
const TOAST_ICONS = {
  done: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  warn: '<path d="M12 6.5v7"/><path d="M12 17.6v.01"/>',
  info: '<path d="M12 11v6.5"/><path d="M12 6.6v.01"/>',
};

function toast(msg, action) {
  const el = $('#toast');
  /* 🔴 사라지는 중에 새 알림이 뜨면 **옛 숨김 타이머가 새 알림을 지운다** — 2600ms 타이머만
     껐지 250ms 숨김 타이머는 안 끄고 있었다. 등장 전환이 살아난 지금은 증상이 더 나쁘다
     (반쯤 뜬 채로 사라진다). 두 타이머를 한자리에서 끈다. */
  clearTimeout(toast._t);
  clearTimeout(toast._h);
  /* 읽어 주는 영역(role=status)은 보이는 상태에서 글이 바뀌어야 화면 낭독기가 읽는다 — 먼저 펼친다
     (아직 .show 전이라 투명하다 · 리뷰 2026-11-21) */
  el.hidden = false;
  /* 머리 한 줄 + 설명 한 줄 (2026-11-21 개발자 요청 — "조금 더 프로페셔널하고 깔끔하게").
     부르는 쪽은 이미 `결과 · 할 일` / `결과 — 할 일` 꼴로 적고 있다. 긴 문장을 가운데 정렬로
     네댓 줄 쌓으면 무엇이 끝났고 무엇을 하라는지가 섞였다 → 첫 구분자 앞을 굵게, 뒤를 흐리게.
     부르는 자리(60여 곳)는 손대지 않는다 · 글자는 여전히 textContent 로만 넣는다(태그 해석 없음). */
  const { head, sub } = toastParts(msg);
  el.textContent = '';
  const tone = toastTone(msg);
  const ico = document.createElement('span');
  ico.className = 'toast-ico';
  ico.dataset.tone = tone;
  ico.setAttribute('aria-hidden', 'true');
  /* 고정된 그림 글자만 넣는다(알림 글은 아래에서 textContent 로) */
  ico.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${TOAST_ICONS[tone]}</svg>`;
  el.appendChild(ico);
  const body = document.createElement('div');
  body.className = 'toast-body';
  const h = document.createElement('div');
  h.className = 'toast-head';
  h.textContent = head;
  body.appendChild(h);
  if (sub) {
    const d = document.createElement('div');
    d.className = 'toast-sub';
    d.textContent = sub;
    body.appendChild(d);
  }
  el.appendChild(body);
  /* 되돌리기처럼 **되살릴 수 있는 실수**는 단추를 함께 준다.
     터치 타깃 44px은 style.css의 .toast-undo가 지킨다. */
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.textContent = action.label;
    b.addEventListener('click', () => {
      clearTimeout(toast._t);
      el.classList.remove('show');
      toast._h = setTimeout(() => (el.hidden = true), 250);
      action.run();
    });
    el.appendChild(b);
  }
  /* 🔴 `display:none` 에서 **같은 태스크에** .show 를 붙이면 전환이 아예 안 걸린다 —
     토스트가 페이드 없이 튀어나오고 사라질 때만 부드러웠다(들어올 때/나갈 때가 거꾸로).
     ⚠️ **rAF 한 번으로는 안 된다** — 실측했다(2026-09-06, 헤드리스 크롬):
        rAF 로는 opacity 가 그대로 1 이고, `void offsetHeight` 로 배치를 강제로 확정시켜야
        0.159 → 1 로 전환이 재생된다. `openSheetShell` 이 "rAF 대신"이라고 적어 둔 이유가 이것.
        notify.js·chat.js 는 아직 rAF 한 번을 쓴다 — 같은 유형인지 따로 확인할 것. */
  void el.offsetHeight;
  el.classList.add('show');
  toast._t = setTimeout(() => {
    el.classList.remove('show');
    toast._h = setTimeout(() => (el.hidden = true), 250);
  }, 2600);
}

function countUp(el, target, formatter, duration = 900) {
  /* 🔴 '모션 줄이기'를 켠 사람에게는 숫자를 굴리지 않는다 (2026-08-30).
     어지럼증·전정기관 질환 때문에 켜는 설정이라, 히어로 금액이 900ms 동안 튀어오르는 것이
     정확히 그 사람들이 끄고 싶어 한 움직임이다. 값은 그대로 보여 준다 — 정보는 안 줄인다. */
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el._countRun = (el._countRun || 0) + 1;
    el.textContent = formatter(target);
    return;
  }
  const start = performance.now();
  /* 같은 칸을 다시 올리면 앞의 것은 멈춘다 (2026-11-20) — 히어로 줄은 그 줄로 넘어올 때마다 다시 올린다.
     안 멈추면 앞의 것이 남은 프레임 동안 옛 숫자를 덮어써 새 숫자 옆에 틀린 숫자가 남는다 */
  const run = (el._countRun = (el._countRun || 0) + 1);
  function tick(now) {
    if (el._countRun !== run) return;
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

/* 수집한 게시판 글에 남은 HTML 기호를 사람이 읽는 글자로 되돌린다 (2026-09-11).
   🔴 실시간 공고 39건 중 9건이 화면에 `&nbsp;` 를 **글자 그대로** 띄우고 있었다
      ('국가근로장학금 장학생 기본요건 ( 소득구간 &nbsp; 9 구간 이하'). 게시판 원문은 빈칸인데
      수집이 기호를 그대로 담아 온 것이라, 되돌리는 것이 원문에 **더 가깝다**(원칙 8-1 위반 아님).
   🔴 반드시 `esc()` **앞에** 부른다 — 되돌린 뒤 다시 감싸므로, `&lt;script&gt;` 가 섞여 있어도
      화면에는 글자로만 뜬다(먼저 esc 하면 `&amp;nbsp;` 가 돼 영영 안 풀린다).
   🔴 목록은 늘리지 않는다 — 숫자 기호(`&#NN;`)까지 열면 보이지 않는 제어문자가 들어온다. */
/* 🔴 여기 없는 기호는 학생 화면에 **글자 그대로** 뜬다 — 데이터에 실제로 있는 것만 담는다.
   `middot` 는 2026-09-13 에 더했다: 금액 근거 줄(`amountSpec.raw`)에 게시판이 담아 온
   `취 &middot; 창업지원금` 이 그대로 들어 있었다(실측 4건). 관문 ui-tone ⑦ 이
   **데이터에 나오는 기호를 전부 아는지** 세므로, 새 기호가 들어오면 그때 빨간불이 된다.
   2026-09-30 에 여덟 개를 더했다 — 44개교 복원으로 들어온 게시판들이 `&lsquo;`·`&#40;` 등을
   담아 왔다(관문이 잡았다). 숫자 기호도 **보이는 글자인 것만** 이름을 대고 넣는다(위 🔴 그대로). */
const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#160': ' ', middot: '·', '#038': '&', '#039': "'", '#40': '(', '#41': ')', lsquo: '‘', rsquo: '’', bull: '•', sim: '∼', rarr: '→', rArr: '⇒', ge: '≥', le: '≤', ldquo: '“', rdquo: '”', times: '×', egrave: 'è' };   // rArr·ge — 수집 글에 나온 겹화살표·부등호(2026-10-12 ui-tone) · ldquo·rdquo — 큰따옴표(2026-10-24 ui-tone) · times·egrave — 소식 글(「센터 &times; Google」·「Herm&egrave;s」 2026-11-17)
/* 🔴 **목록을 두 벌 두지 않는다** (2026-09-13). 예전에는 정규식에 이름이 한 벌 더 박혀 있어서,
   ENTITIES 에 `middot` 를 더해도 정규식이 그걸 몰라 **아무 일도 안 일어났다**(실측).
   이 저장소가 여러 번 데인 자리다 — 목록에서 정규식을 만든다. */
const ENTITY_RE = new RegExp('&(' + Object.keys(ENTITIES).join('|') + ');', 'g');
function unent(s) {
  return String(s == null ? '' : s).replace(ENTITY_RE, (m, k) => ENTITIES[k]);
}
/* 깨진 글자 씻기 — 받은 데이터 **전부**를 받는 순간 한 번 (2026-11-17 개발자 지시 "깨진 글자 모두 찾아서 수리 · 장학금, 대외활동/공모전 모두").
   unent 를 23곳에서만 불러 자격 줄·서류 칸에 `중소 &middot; 중견기업` 이 그대로 떴고, 이 앱이 거르지 않던 넷이 더 있었다(실측 11-17):
   · HWP 전용 기호 글자(사용자 정의 영역 U+E000–F8FF — 폰에서 네모) · 대체 문자(U+FFFD — 이모지가 깨진 것) · 폭 0 공백·소프트 하이픈 · 제어 문자
   · OCR 이 주소를 깨뜨린 괄호 `(//“\6401510.0ㅁ.<0)` — 역슬래시가 든 「/로 시작하는 괄호」만 걷는다(진짜 주소는 모르니 지어내지 않는다 · 원칙 8-1).
   🔴 주소 칸(url·href·link·file·path·thumb·img·id)은 건드리지 않는다 — 주소의 & 기호는 decodeUrlEntities 한 곳의 몫이다.
   🔴 지우기·기호 되돌리기만 한다(글자를 더하지 않는다). 관문 「깨진 글자 씻기」. */
const JUNK_CHARS = /[\uE000-\uF8FF\uFFFD\u200B\u200C\u2060\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const OCR_URL_GARBLE = /\s*\(\s*\/[^()가-힣]*\\[^()]*\)/g;
const TIDY_SKIP_KEY = /(?:urls?|href|link|file|path|thumb|img|image|hash|home|src|page|^id)$/i;   // home(층2 재단 홈페이지)·src·page(학교 사진)·avoidUrls 도 주소(리뷰 2026-11-17)
/* OCR 이 동그라미 숫자(①②)를 @·저작권·등록상표 기호(U+00A9·U+00AE)로 읽은 글머리와 표의 세로줄(|·ㅣ) — 자격·서류·발췌·안내 칸에서만 걷는다(리뷰 2026-11-17 · 「@)-1 주민등록초본」·「|@ 자기소개서」·「(저작권 기호) 학자금 지원구간 통지서」).
   🔴 이메일(abc@x.kr)의 @ 는 앞뒤가 글자라 안 걸린다 · 다른 칸(제목·이름)은 건드리지 않는다 */
const OCR_TEXT_KEY = /^(?:documents|eligibilityLines|eligibilityExcludes|eligibilityPriority|excerpts|noticeLines|text)$/;
const OCR_MARK = /(^|[\s|(\[ㅣ])[@\u00A9\u00AE]\)?(?:-?\d)?(?=\s|$)/g;
function tidyOcr(t) {
  return t.replace(OCR_MARK, '$1').replace(/^[\s|ㅣ_]+/, '').replace(/[\s|ㅣ_]+$/, '').replace(/\s*\|\s*\|\s*/g, ' | ').replace(/([^ \t]) {2,}(?=\S)/g, '$1 ');
}
function tidyText(s, key = '') {
  const t = unent(s).replace(/(\S)[\uE000-\uF8FF]+(?=\S)/g, '$1 ')   // 단어 사이에 끼인 HWP 기호(「이미지·상징성」의 가운뎃점 자리)는 빈칸으로 — 지우면 두 낱말이 붙는다(리뷰 2026-11-17)
    .replace(JUNK_CHARS, '').replace(OCR_URL_GARBLE, '').replace(/^[ \t]+/, '')
    .replace(/[(（]\s*([월화수목금토일])\s*[)）]/g, '($1)')
    .replace(/([^ \t]) {2,}(?=\S)/g, "$1 ");
  return OCR_TEXT_KEY.test(key) ? tidyOcr(t) : t;   // 요일 괄호 안 빈칸(「11. 17.(화 )」) · 폭 0 공백을 지운 자리의 겹친 빈칸(「유형 Ⅱ  장학금」) — 2026-11-17 · 이모지 잇개(U+200D)는 지우지 않는다(사람+학사모 같은 합친 이모지가 쪼개진다)
}
function tidyData(v, key = '') {
  if (typeof v === 'string') return TIDY_SKIP_KEY.test(key) ? v : tidyText(v, key);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i += 1) v[i] = tidyData(v[i], key); return v; }
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = tidyData(v[k], k); return v; }
  return v;
}
/* 이미 저장된 기간 한 줄의 끝에 반쯤 잘린 기호(`16:00 &n`)가 남은 것 — 로봇은 이제 기호를 풀고 자르지만(collector/deadline-hint.mjs) 실린 글에 남아 있다(소급 · 관문이 같은 꼴을 대조) */
const PARTIAL_ENTITY_END = /&(?:[a-z]{1,7}|#\d{0,6}|#x[0-9a-f]{0,5})?$/;
const hintText = (s) => unent(s).replace(PARTIAL_ENTITY_END, '').trim();
/* 카드 회색 줄 — 기간 한 마디만 (2026-10-04 개발자 지적 "재단·지자체 새 공고 회색 글씨가 못생겼다").
   로봇이 주운 기간 문장(deadlineHint)은 원문 한 토막이라 뒤 항목(ㅇ 접수방법 · 2. 신청방법)까지 딸려 와 글자 중간에서 잘렸다
   (「접수기한 ) ~ 10. 7.(수) 18시 ㅇ ( 접수방법 ) 모바일 … 응」). 첫 항목만 남기고 원문의 괄호 이름표를 펴고, 날짜가 없으면 안 보인다.
   🔴 지우고 다듬기만 한다 — 글자를 지어내지 않는다(원칙 8-1). 원문 전체는 상세·원문 링크가 그대로 보여 준다. */
function hintShort(s, max = 44) {   // max — 카드는 44자 · 상세 시트(openBoardDetail)는 자르지 않는다(Infinity — 마감 날짜가 잘려 나가지 않게 · 2026-11-20 리뷰)
  let t = hintText(s)
    .replace(/^\s*([가-힣]{2,8})\s*\)\s*/, '$1 ')                   // 앞이 잘려 짝 잃은 괄호 이름표 「접수기한 )」
    .replace(/[(（]\s*([가-힣]{2,8})\s*[)）]/g, '$1');                  // 「( 접수방법 )」
  t = t.split(/\s(?=[ㅇ○◯●■□\u25AA•※\u25B6]\s|\d{1,2}[.)]\s*[가-힣])/)[0];      // 다음 항목(「ㅇ 접수방법」·「2. 신청방법」) 앞에서 끊는다 — 날짜 「10. 7.」 은 항목 번호가 아니다
  t = t.replace(/\s+/g, ' ').trim();   // 글자는 원문 그대로(「신청기간 :」 의 띄어쓰기도) — 검사 드라이버가 잠근다
  if (!/\d/.test(t)) return '';                                            // 날짜가 없으면 기간 줄이 아니다
  if (t.length > max) { const cut = t.slice(0, max); t = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim()}…`; }
  return t;
}

/* 🔴 서비스워커 엇갈림 대비 — source-link.js 가 안 실려 있을 때 (2026-10-03 리뷰 APP-1 · 실제 서비스워커로 재현).
   새 app.js 가 **옛 index.html**(캐시 — 첫 요청이 3.5초를 넘기면 서비스워커가 캐시를 내준다)과 만나면 source-link.js 태그가 없어
   sourceLink 가 없다 → 상세 시트가 통째로 죽고 홈이 '불러오는 중'에 굳었다. 옛 match-engine.js 에 대한 같은 대비가 loadNotices 에 있다.
   그 한 번은 **글자 없는 자리표**로 버티고(이름 글자는 source-link.js 한 곳에만 — 여기 베끼지 않는다), 파일을 직접 불러
   다 실리면 장부를 다시 넘기고 화면을 다시 그린다. 보통 수십 ms 다. */
if (typeof sourceLink !== 'function') {
  const g = (typeof window !== 'undefined') ? window : globalThis;
  g.decodeUrlEntities = g.decodeUrlEntities || ((u) => String(u == null ? '' : u).trim());
  g.linkShape = g.linkShape || (() => 'page');   // 자리표의 갈래는 늘 글(post)이라 목록 꼴을 물을 일이 없다 — 꼴 규칙은 source-link.js 한 곳
  g.setLinkChecks = g.setLinkChecks || (() => {});
  g.setLinkFixes = g.setLinkFixes || (() => {});
  g.effectiveLinkUrl = g.effectiveLinkUrl || ((item) => String((item && (item.sourceUrl || item.url)) || ''));
  g.sourceLink = (item) => ({ href: String((item && (item.sourceUrl || item.url)) || ''), kind: 'page', cls: 'post', label: '', hint: '', caution: '' });
  if (typeof document !== 'undefined' && document.createElement) {
    const s = document.createElement('script');
    s.src = 'source-link.js';
    s.onload = () => {
      try { if (typeof linkChecksDoc !== 'undefined') setLinkChecks(linkChecksDoc); } catch (e) { /* 장부 없음 */ }
      try { if (typeof linkFixesDoc !== 'undefined') setLinkFixes(linkFixesDoc); } catch (e) { /* 바로잡기 없음 */ }
      try { rerenderVisible(); } catch (e) { /* 아직 첫 그림 전 — 첫 그림이 진짜 이름을 쓴다 */ }
    };
    (document.head || document.documentElement).appendChild(s);
  }
}
/* 옛 source-link.js(캐시 · v221 — sourceLink 는 있는데 원문 바로잡기 ⑥ 이 없다)가 새 app.js 와 만나면 setLinkFixes 가 없어
   장부를 받는 길이 통째로 던진다(리뷰 2026-10-04) — 빠진 것만 따로 메운다. 그 한 번은 바로잡기 없이 데이터 주소 그대로 연다 */
{
  const g = (typeof window !== 'undefined') ? window : globalThis;
  if (typeof setLinkFixes !== 'function') g.setLinkFixes = () => {};
  if (typeof effectiveLinkUrl !== 'function') g.effectiveLinkUrl = (item) => String((item && (item.sourceUrl || item.url)) || '');
}

/* 외부 링크 안전화 — http(s)·mailto만 허용한다. 수집 로봇이 받아 온 데이터가 오염되거나
   정식 등록에 오타가 있어도 javascript:·data: 같은 위험한 스킴이 href나 window.open으로
   들어가지 못하게 막는 2차 방어선(CSP가 뚫리거나 완화돼도 안전). 허용 안 되면 빈 문자열. */
function safeUrl(u) {
  if (!u) return '';
  /* 🔴 주소에 박힌 HTML 기호(`&#038;`·`&amp;`)를 **먼저** 되돌린다 (2026-10-03 · 원문 링크 정직성).
     안 되돌리면 브라우저가 `#038;uid=392` 를 조각(fragment)으로 읽어 글 번호가 서버에 안 가고
     공고 대신 메뉴 화면이 열린다(서울대 학생처 실측). 규칙은 source-link.js 의 decodeUrlEntities
     한 곳 — 이 자리에서 풀어 두면 원문 링크·첨부·제출처 바로가기가 **전부 한 번에** 고쳐진다. */
  u = decodeUrlEntities(u);   // (자리표가 있을 때는 그대로 돌려준다 — 위 엇갈림 대비)
  try {
    /* 🔴 기준은 `location.origin` 이 아니라 **앱이 놓인 자리**(`document.baseURI`) 다
       (2026-09-12). 앱은 `…github.io/hanggonggan/` 에 있는데 origin 을 기준으로 풀면
       `data/kosaf-files/…` 같은 **우리 파일 경로가 사이트 뿌리**로 풀려 404 가 된다.
       밖으로 나가는 주소(http/https/mailto)는 기준이 무엇이든 결과가 같으므로,
       지금까지의 링크는 한 글자도 안 바뀐다. */
    const parsed = new URL(String(u), document.baseURI);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') return parsed.href;
  } catch (e) { /* 잘못된 URL */ }
  return '';
}

/* 원문 링크의 정직한 표기 (2026-07-31 → 2026-10-03 한 곳으로)
   링크 이름(원문 공고 · 게시판 목록 · 재단 홈페이지 · 확인 필요)은 **source-link.js 의 sourceLink 한 곳**이 정한다.
   🔴 여기에 isBoardListLink 같은 판정을 다시 두지 말 것 (2026-10-03 개발자 보고 · P0 —
      *"원문 공고를 누르면 그 공고가 아니라 재단·장학금 페이지 전체가 열린다"*).
      예전엔 화면 일곱 곳이 각자 주소 글자(`#n-`)만 보고 '원문'이라 불렀다 — 층2 재단 홈페이지를
      아는 곳은 상세 시트 하나뿐이라, 같은 재단 홈페이지를 금액 상세는 '원문 공고 ↗',
      신청 내역은 '공고 원문 보기 ↗' 라고 불렀다. 지금은 아래 작은 함수들이 모두 sourceLink 를 부른다. */

/* 목록 링크면 '목록에서 ○○을(를) 찾아 눌러 주세요', 로봇이 '그 공고가 아니었다'를 확정한 링크면
   본 것을 그대로 한 줄 — 상세 시트(맨 아래 한 문단)와 활동 시트가 같이 쓴다. 글자는 sourceLink 가 준다. */
function sourceLinkHintHtml(link) {
  if (!link) return '';
  if (link.cls === 'list' && link.hint) return `목록에서 <strong>${esc(unent(link.hint))}</strong>을(를) 찾아 눌러 주세요.`;
  if (link.cls === 'trouble' && link.caution) return esc(link.caution);
  return '';
}

/* 첨부 한 줄 — 주소가 안전하지 않으면(`javascript:downloadfile(…)` 같은 게시판 내려받기 스크립트) 이름만 쓴다.
   🔴 `<a href="">` 로 그리지 말 것 (2026-10-03) — 빈 href 는 **앱 자신**을 다시 연다(첨부를 눌렀는데 앱이 또 뜬다).
   실측: 정식 등록·활동 첨부 50건이 이 꼴이다. 받을 길은 원문 게시판뿐이라 그렇게 말한다(지어내지 않는다). */
function attachmentLinkHtml(a, style) {
  const href = safeUrl(a && a.url);
  const name = esc(unent((a && a.name) || '').replace(/\s+/g, ' ').trim() || '첨부 파일');   // 이름에 남은 `&nbsp;[ 101.7 KB ]` 엔터티를 푼다(2026-10-15)
  return href
    ? `<a href="${esc(href)}" target="_blank" rel="noopener"${style ? ` style="${style}"` : ''}>${name}</a>`
    : `${name} <span class="doc-legend">(원문 게시판에서 내려받기)</span>`;
}

/* ---------------- 서류 보관함 (기기 내 저장 · 브라우저 내장 금고) ----------------
   파일은 서버로 전송되지 않고 사용자 기기 안에만 저장된다. */
let walletCache = {}; // slot -> { name, type, savedAt }

function dbOpen() {
  return new Promise((res, rej) => {
    /* 🔴 판 2 — 'trash'(지운 서류) 보관소가 늘었다 (2026-09-11).
       이미 판 1 로 만들어진 폰에서는 'files' 가 **이미 있으므로** 그대로 만들면
       그 자리에서 오류가 나고 서류 보관함이 통째로 안 열린다. 있는지 보고 만든다. */
    const rq = indexedDB.open('handaejang-docs', 2);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'slot' });
      if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash', { keyPath: 'key' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

/* 휴지통 보관소 — 서류와 같은 금고 안의 다른 칸. 파일은 여전히 기기 밖으로 안 나간다. */
function trashTx(mode, fn) {
  return dbOpen().then((db) => new Promise((res, rej) => {
    const tx = db.transaction('trash', mode);
    const out = fn(tx.objectStore('trash'));
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = () => rej(tx.error);
  }));
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
/* 🔴 삭제가 아니라 **옮기기**다 (2026-09-11 개발자 지시로 휴지통 신설).
   증명서는 학생이 주민센터·학교에 다시 가야 다시 받는 물건이라, 잘못 눌렀을 때
   되돌릴 길이 없으면 그 손실이 그대로 학생 몫이 된다. */
async function walletDeleteSlot(slot) {
  try {
    const rec = await walletGetRec(slot);
    if (rec) {
      await trashTx('readwrite', (st) => st.put({
        key: `doc:${slot}:${Date.now()}`, kind: 'doc',
        slot, name: rec.name, type: rec.type, blob: rec.blob,
        ...(rec.dataUrl ? { dataUrl: rec.dataUrl } : {}),   // 프로필 사진의 문서용 사본도 함께 (2026-09-11)
        savedAt: rec.savedAt, deletedAt: Date.now(),
      }));
    }
  } catch (e) { /* 휴지통에 못 담아도 삭제 자체는 진행한다 — 학생이 누른 일은 일어나야 한다 */ }
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

/* ---------------- 프로필 사진 (2026-09-11 개발자 지시) ----------------
   *"마이페이지에서 프로필사진 교체 기능 추가. 해당 기능은 본인의 사진을 요구하는 장학 공고에 쓰일 수 있음."*
   🔴 **서류 보관함과 같은 금고**(IndexedDB `files`)의 `photo` 칸에 둔다 — 새 저장소를 만들지
      않는다. 지우면 서류처럼 휴지통(30일)으로 옮겨진다(walletDeleteSlot 그대로).
   🔴 **서버로 안 올라간다** — `state.profile` 에 넣지 않으므로 syncSafeProfile 이 볼 일이 없다.
      verify-supabase 가 나가는 본문을 전부 모아 세는데, 사진은 애초에 그 길에 없다.
   🔴 **줄여서 저장한다**(긴 변 640px · JPEG). 폰 사진 한 장은 4~8MB 라 그대로 두면 양식 문서 한 장이
      그 크기가 된다. 줄인 뒤 dataUrl 도 같이 적어 둔다 — 양식 문서(forms.js)는 동기로 그려지고
      .doc 파일로 나갈 때 blob 주소는 죽으므로, 문서에 들어갈 수 있는 것은 글자로 된 사진뿐이다.
   ⚠️ 사진이 **어느 양식에 들어가는가**는 짐작하지 않는다 — `data/forms.json` 의 `photoNote`
      (원본 서식에 사진란이 있다고 스키마화 때 적어 둔 것)가 있는 양식에만 들어간다. */
const PHOTO_SLOT = 'photo';
const PHOTO_MAX_W = 480;
const PHOTO_MAX_H = 640;
let profilePhoto = null;   // { url, dataUrl, savedAt } — 금고에서 읽어 둔 사본. 없으면 null

/** 양식 문서가 부른다(forms.js) — 사진이 없으면 빈 문자열(지어내지 않는다). */
function profilePhotoDataUrl() {
  const d = profilePhoto && profilePhoto.dataUrl;
  return typeof d === 'string' && d.startsWith('data:image/') ? d : '';
}

/* blob → data URL (문서용). 옛 기록이나 휴지통을 거친 기록에 dataUrl 이 없을 때만 쓴다. */
function blobToDataUrl(blob) {
  return new Promise((res) => {
    try {
      const r = new FileReader();
      r.onload = () => res(typeof r.result === 'string' ? r.result : '');
      r.onerror = () => res('');
      r.readAsDataURL(blob);
    } catch (e) { res(''); }
  });
}
async function photoRefresh() {
  try {
    const rec = await walletGetRec(PHOTO_SLOT);
    if (profilePhoto && profilePhoto.url) { try { URL.revokeObjectURL(profilePhoto.url); } catch (e) { /* 이미 해제됨 */ } }
    if (rec && rec.blob) {
      /* 🔴 dataUrl 이 없으면 만들어 채운다 — 없으면 MY 에는 사진이 보이는데 양식 문서에는 조용히 안 들어간다(코드 리뷰) */
      const dataUrl = rec.dataUrl || await blobToDataUrl(rec.blob);
      profilePhoto = { url: URL.createObjectURL(rec.blob), dataUrl, savedAt: rec.savedAt };
    } else profilePhoto = null;
  } catch (e) { profilePhoto = null; }
  return profilePhoto;
}

/* 사진을 줄여 JPEG 로 — 못 읽는 파일(HEIC 를 브라우저가 못 여는 경우 등)이면 null */
function shrinkPhoto(file) {
  return new Promise((res) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    const done = (v) => { try { URL.revokeObjectURL(src); } catch (e) { /* 무시 */ } res(v); };
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) return done(null);   // 크기 없는 그림(SVG 등) → 1px 사진이 되는 것을 막는다
        const r = Math.min(1, PHOTO_MAX_W / img.naturalWidth, PHOTO_MAX_H / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth * r));
        const h = Math.max(1, Math.round(img.naturalHeight * r));
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = cv.toDataURL('image/jpeg', 0.86);
        cv.toBlob((blob) => done(blob ? { blob, dataUrl } : null), 'image/jpeg', 0.86);
      } catch (e) { done(null); }
    };
    img.onerror = () => done(null);
    img.src = src;
  });
}

async function photoSet(file) {
  const small = await shrinkPhoto(file);
  if (!small) return false;
  await walletTx('readwrite', (st) => st.put({
    slot: PHOTO_SLOT, name: '증명사진.jpg', type: 'image/jpeg',
    blob: small.blob, dataUrl: small.dataUrl, savedAt: nowStamp(),
  }));
  await walletRefresh();
  await photoRefresh();
  return true;
}
async function photoRemove() {
  await walletDeleteSlot(PHOTO_SLOT);   // 서류처럼 휴지통으로 — 30일 안에 되살릴 수 있다
  await photoRefresh();
}

/* MY 맨 위 카드의 머리 — 사진(없으면 첫 글자) + 이름 줄 + 단추 두 개 */
function photoHeadHtml(p, nameLineHtml) {
  const initial = esc((p.name || '학').charAt(0));
  /* 겉 상자가 role=img + 이름표를 갖고 있으니 안쪽 그림의 alt 는 비운다 — 낭독기가 두 번 읽지 않게 */
  const img = profilePhoto && profilePhoto.url ? `<img src="${esc(profilePhoto.url)}" alt="" />` : initial;
  return `
    <div class="my-head">
      <div class="my-photo" id="my-photo" role="img" aria-label="프로필 사진">${img}</div>
      ${nameLineHtml}
    </div>
    <div class="my-photo-btns" data-photo>
      <label class="my-photo-btn">${profilePhoto ? '사진 교체' : '사진 올리기'}
        <input type="file" id="my-photo-file" accept="image/*" hidden />
      </label>
      ${profilePhoto ? '<button type="button" class="my-photo-btn danger" id="my-photo-del">사진 삭제</button>' : ''}
    </div>`;
}
function bindPhotoButtons() {
  const inp = $('#my-photo-file');
  if (inp) inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('20MB 이하 사진만 올릴 수 있어요'); return; }
    const ok = await photoSet(file);
    toast(ok ? '프로필 사진을 저장했어요 · 이 기기에만 남아요' : '이 사진은 읽을 수 없어요 · JPG·PNG 로 다시 올려 주세요');
    renderMy();
    if (!$('#screen-home').hidden) renderHome();
  });
  const del = $('#my-photo-del');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('프로필 사진을 지울까요? 휴지통에 30일 남아요.')) return;
    await photoRemove();
    toast('휴지통으로 옮겼어요');
    renderMy();
    if (!$('#screen-home').hidden) renderHome();
  });
}

/* 요구 서류의 보관함 상태 한 줄 */
function docWalletStatus(doc) {
  const s = slotForDoc(doc);
  if (!s) return null;
  const rec = walletCache[s.slot];
  return rec
    ? { ok: true, slot: s, text: `보관함에 있어요 · ${rec.name}` }
    : { ok: false, slot: s, text: `아직 안 올렸어요 · 발급처: ${s.issue}` };
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

/* 학과 자동추천의 **바탕 목록** (2026-10-24 · 개발자 지시 "학과를 학교에 맞춰").
   학교별 파일이 캠퍼스별 목록(`campuses` · majors.mjs CAMPUS_BY_AREA)을 가지면 **고른 캠퍼스의 목록**,
   없으면 학교 전체 목록, 그것도 없으면 전국 공통 목록(원래 있던 폴백). 손으로 적은 목록은 없다(data.js 주석). */
function majorPool(school, campus) {
  const file = MAJOR_FILES[school];
  if (file && campus && file.campuses && Array.isArray(file.campuses[campus]) && file.campuses[campus].length) return file.campuses[campus];
  return MAJORS_BY_SCHOOL[school] || null;
}

function majorSuggestions(q) {
  const n = q.replace(/\s/g, '');
  if (!n) return [];
  const school = $('#in-school').value.trim();
  const campus = getChip('#in-campus');
  /* 🔴 **쓰는 자리에서 확실히 한 번 받는다** (2026-09-26). 아래 학교 입력 listener 가 미리
     받아 두지만, 고치러 들어온 학생은 `initOnboarding` 이 값을 **프로그램으로** 넣어
     `input` 이 안 뜬다 — 그 경우 여기서만 받는다. 같은 학교는 두 번 받지 않는다.
     ⚠️ 받아오기는 비동기라 **이 호출의 결과가 지금 당장 오지는 않는다.** 그래서 학교 입력
        쪽에서 미리 받는 것이 짝이다(안 그러면 첫 글자에 전국 공통 목록이 잠깐 보인다). */
  loadMajorsFor(school);
  /* 그 학교에 실제로 있는 학과 목록을 확보한 곳은 **그 목록만** 쓴다.
     예전엔 전국 공통 목록을 뒤에 붙여서, 외대에서 '일'을 치면 학교에 없는
     '일어일문학과'가 같이 떴다(2026-08-02 개발자 지적 — 경희대 사례).
     캠퍼스별로 학과가 다른 학교는 '학교 캠퍼스' 열쇠를 먼저 본다. */
  const own = majorPool(school, campus);
  /* 🔴 **캠퍼스 목록은 먼저 보일 뿐 빼지 않는다** (2026-10-30). 캠퍼스 칩은 첫 칩이 기본으로 켜져 있어(renderCampusChips)
     글로벌캠퍼스 학생이 칩을 안 건드린 채 '수학'을 치면 서울 목록만 뒤져 수학과·GBT학부가 안 떴다 — 학과 로봇이
     캠퍼스별 목록을 처음 실은 날(10-30) 화면 검사 둘이 그걸로 빨간불이었다. 계열 칩과 같은 원칙: 먼저, 그러나 빼지 않는다.
     (계열 칩은 majorPool 그대로 — 그 캠퍼스에 있는 계열만 보이는 것이 맞다) */
  const whole = MAJORS_BY_SCHOOL[school] || null;
  const pool = own ? (whole && whole !== own ? own.concat(whole.filter((m) => !own.includes(m))) : own)
    : MAJORS_COMMON;   // 확보 못 한 학교는 전국 공통 목록을 힌트로
  const hits = pool.filter((m) => m.replace(/\s/g, '').toLowerCase().includes(n.toLowerCase()));
  /* 고른 계열의 학과를 **먼저** 보인다(빼지는 않는다 — 계열을 잘못 눌렀을 수 있다). 분류는 major-track.js 한 곳 */
  const track = getChip('#in-track');
  if (!track || typeof trackOfMajor !== 'function') return hits;
  const rank = (m) => (trackOfMajor(m) === track ? 0 : 1);
  return hits.map((m, i) => [m, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
}

/* ── 전공 계열 칩을 **그 학교(캠퍼스)에 있는 계열만, 많은 순으로** 그린다 (2026-10-24 · 개발자 지시) ──
   학과 목록(majorPool)을 major-track.js 로 갈라 센다. 목록이 아직 안 왔거나 하나도 못 가르면 여덟 개 전부(원래 모양).
   🔴 없는 계열을 **아주 감추지는 않는다** — 분류가 못 가른 학과(디지털콘텐츠·융합인재…)의 학생은 제 계열을 직접 눌러야
      하므로 나머지는 「+n」 뒤에 둔다(대외활동 분야 칩과 같은 접기). 고른 계열은 접혀 있어도 늘 보인다.
   🔴 다시 그려도 고른 것은 지킨다 — 파일이 늦게 도착해 다시 그릴 때 학생이 누른 칩이 날아가면 안 된다. */
let trackChipsOpen = false;
const trackCountCache = new WeakMap();   // 학과 목록(배열) → 계열 순서 — 학교 칸 글자마다 300개를 다시 가르지 않는다(코드 리뷰)
function presentTracks(pool) {
  if (!pool || typeof tracksOfMajors !== 'function') return [];
  if (!trackCountCache.has(pool)) trackCountCache.set(pool, tracksOfMajors(pool).map((t) => t.id).filter((id) => TRACKS.some((t) => t.id === id)));
  return trackCountCache.get(pool);
}
function renderTrackChips(selected) {
  const box = $('#in-track');
  if (!box) return;
  /* 아는 계열 id 만 지킨다 — 옛 프로필·서버 사본의 낯선 값이면 아무 칩도 안 켠 채(코드 리뷰: 모르는 id 로 넘어지면 초기화가 중간에 멈춘다) */
  const raw = selected !== undefined ? selected : getChip('#in-track');
  const keep = raw && TRACKS.some((t) => t.id === raw) ? raw : null;
  const school = $('#in-school').value.trim();
  const pool = majorPool(school, getChip('#in-campus'));
  const present = presentTracks(pool);
  const rest = TRACKS.map((t) => t.id).filter((id) => !present.includes(id));
  let shown = present.length && !trackChipsOpen ? present.slice() : TRACKS.map((t) => t.id);
  if (keep && !shown.includes(keep)) shown.push(keep);
  const hidden = TRACKS.length - shown.length;
  /* 같은 모양이면 다시 그리지 않는다 — 학교 칸은 글자마다 부르므로(초점·누름 상태가 날아간다) */
  const sig = `${shown.join(',')}|${keep || ''}|${trackChipsOpen ? 1 : 0}|${hidden}`;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = shown.map((id) => {
    const t = TRACKS.find((x) => x.id === id);
    return `<button class="chip${id === keep ? ' active' : ''}" data-value="${t.id}">${t.label}</button>`;
  }).join('')
    + (hidden > 0 ? `<button type="button" class="chip-more" data-more="open" aria-label="계열 ${hidden}개 더 보기">+${hidden}</button>`
      : (trackChipsOpen && present.length && rest.length ? '<button type="button" class="chip-more" data-more="close">접기</button>' : ''));
}

/* 학과를 고르면 계열이 따라온다 — 분류가 확실한 학과만(모르면 그대로 둔다 · major-track.js 의 규칙). */
function syncTrackFromMajor() {
  if (typeof trackOfMajor !== 'function') return;
  const t = trackOfMajor($('#in-major').value.trim());
  if (!t || getChip('#in-track') === t) return;
  if (!$(`#in-track .chip[data-value="${t}"]`)) renderTrackChips(t);
  setChip('#in-track', t);
}

/* ---------------- 화면 전환 ---------------- */
/* 지금 보고 있는 화면 — 이어보기 장부에 적을 때와 스크롤을 갈무리할 때 쓴다 */
let currentScreen = 'onboarding';

function showScreen(name, opts) {
  const o = opts || {};
  /* 떠나기 전 화면의 스크롤을 먼저 갈무리한다 — 다음에 그 탭으로 돌아오면 여기서 이어진다 */
  if (typeof resumeSaveScroll === 'function' && currentScreen && currentScreen !== name) {
    resumeSaveScroll(currentScreen, appScroller().scrollTop);
  }
  ['onboarding', 'home', 'explore', 'activities', 'applications', 'my', 'myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms', 'formfill', 'postreq'].forEach((n) => {
    $(`#screen-${n}`).hidden = n !== name;
  });
  $('#bottom-nav').hidden = name === 'onboarding' || name === 'formfill';   // 양식 채우기는 쪽 그림이 화면을 다 써야 한다(formfill.js)
  /* 설정·휴지통은 MY 안쪽 화면이라 아래 탭에서 **MY 가 켜진 채**로 둔다 —
     아무 탭도 안 켜져 있으면 학생이 지금 어디에 있는지 알 수 없다. */
  const navOn = ['myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms'].includes(name) ? 'my' : (name === 'formfill' ? 'applications' : name === 'postreq' ? 'home' : name);
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.nav === navOn));

  /* 🔴 안쪽 화면(설정·휴지통)은 **방향이 있는** 움직임으로 들어온다 (2026-09-11 개발자 지시).
     들어갈 때는 오른쪽에서, 되돌아올 때는 왼쪽에서 — 방향이 '어디로 가는 중인지'를 말한다.
     ⚠️ `.screen` 에는 이미 taste-in(위로 떠오르기)이 걸려 있다. 그 위에 덮어쓰는 것이라
        style.css 에서 **이 규칙이 뒤에 와야** 이긴다(같은 굵기면 나중 것이 이긴다).
     ⚠️ 클래스를 떼었다 붙이는 것만으로는 다시 안 돈다 — 브라우저가 '바뀐 게 없다'고 본다.
        중간에 offsetWidth 를 한 번 읽어 강제로 끊어 준다. */
  const SUB = ['myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms', 'formfill', 'postreq'];
  /* 🔴 안쪽 화면에서는 **가로 손짓이 우리 것**이라고 앱 전체에 표시해 둔다 (2026-09-12).
     짧은 화면 아래 빈 자리는 화면이 아니라 `#app` 이라, 화면에만 주면 거기서 시작한
     손짓을 브라우저가 세로 스크롤로 가져간다. 안쪽 화면일 때만 켜는 이유는 style.css 에. */
  $('#app').classList.toggle('on-sub-screen', SUB.includes(name));
  $('#app').classList.toggle('on-formfill', name === 'formfill');   // 양식 채우기만 넓은 폭(시안 C 사이드바)을 쓴다 — style.css #app.on-formfill
  if (SUB.includes(name) || SUB.includes(currentScreen)) {
    const el = $(`#screen-${name}`);
    if (el) {
      el.classList.remove('screen-in', 'screen-back');
      void el.offsetWidth;
      el.classList.add(o.back ? 'screen-back' : 'screen-in');
    }
  }
  currentScreen = name;

  if (name === 'home') renderHome();
  if (name === 'explore') renderExplore();
  if (name === 'activities') renderActivities();
  if (name === 'applications') renderApplications();
  if (name === 'my' || name === 'myinfo' || name === 'mydocs' || name === 'mysaved') renderMy();
  if (name === 'settings') renderSettings();
  if (name === 'trash') renderTrash();
  if (name === 'terms') renderTerms();
  if (name === 'logins') renderLogins();
  if (name === 'faq') renderFaq();
  if (name === 'support') renderSupport();
  if (name === 'perms') renderPerms();
  if (name === 'postreq' && typeof renderInquiry === 'function') renderInquiry();   // 게시 요청 · 광고 문의 한 화면(post-request.js)

  /* 🔴 스크롤은 **그린 뒤에** 옮긴다 — 먼저 옮기면 아직 짧은 화면이라 그 자리가 없다.
     `opts.scroll` 은 이어보기가 되살릴 때만 온다(보통은 늘 맨 위로). */
  appScrollTo(o.scroll || 0);   // 문서가 아니라 #app 이 굴러간다(interactions.js ⓪)

  if (typeof resumeSave === 'function' && name !== 'onboarding') resumeSave({ screen: name });
}

/* 이어보기 장부에 지금 화면·스크롤을 적는다.
   🔴 `beforeunload` 를 믿지 말 것 — 휴대폰에서는 안 불린다. 앱이 숨는 순간
      (`visibilitychange` 의 hidden)이 유일하게 믿을 수 있는 신호다. */
function resumeMark() {
  if (typeof resumeSave !== 'function') return;
  if (!currentScreen || currentScreen === 'onboarding') { resumeSave({}); return; }
  resumeSaveScroll(currentScreen, appScroller().scrollTop);
  /* 🔴 화면 이름도 **여기서 다시** 적는다 (2026-09-09 · 검사를 강화하다 드러났다).
     예전에는 시각과 스크롤만 찍었는데, 그러면 숨는 순간의 기록이 `showScreen` 이 앞서
     적어 둔 것에 얹혀야만 온전해진다 — 장부가 그 사이에 비었으면(초기화·저장 공간 정리)
     **스크롤만 있고 화면이 없는 기록**이 남아 다음에 켤 때 홈으로 간다.
     앱이 숨는 순간이 가장 믿을 수 있는 신호이므로, 그때 아는 것을 다 적는다. */
  resumeSave({ screen: currentScreen });
}

/* @@ 온보딩(첫 화면)은 app-onboarding.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

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
/* 🔴 적합도 색깔 (2026-08-24 개발자 지시): "빨강 주황 노랑 초록 파랑 순이고
   제일 딸리는 게 빨강, 제일 적합한 게 파랑."
   ⚠️ 색만으로 뜻을 전하지 않는다 — 숫자와 '요건 n개 중 m개'가 늘 함께 간다
   (색각 이상이 있는 학생에게 색은 아무 말도 하지 않는다). */
function fitTone(pct) {
  if (pct >= 80) return 'blue';
  if (pct >= 60) return 'green';
  if (pct >= 40) return 'yellow';
  if (pct >= 20) return 'orange';
  return 'red';
}
/* 어긋난 요건이 없는 공고의 색 — 빨강·주황(경고색)은 미달에만 쓴다 (2026-11-15). 낮은 퍼센트는 노랑까지만 */
function fitToneNoFail(pct) {
  const t = fitTone(pct);
  return t === 'red' || t === 'orange' ? 'yellow' : t;
}

/* 🔴 '미달인가'를 정하는 **단 한 곳** (2026-08-29 신설).
   배지는 여기를 보고, 목록 정렬도 여기를 본다. 예전에는 배지가 `fd.fails` 로,
   정렬이 `result.status` 로 각각 판단해서 **화면이 스스로 모순**됐다:
   `적합도 33%` 라고 적힌 카드가 '지원 자격 미달' 카드들 **사이에** 앉아 있었다
   (verify-explore-sort 가 그걸 잡고 있었는데 아무도 그 검사를 안 돌렸다).
   ⚠️ 여기 규칙을 복사해 쓰지 말 것 — 복사하는 순간 다시 갈라진다. */
function fitVerdict(fit, fd) {
  if (fit === 0) return 'no';                                   // evaluate 가 미달로 확정
  if (fd && fd.unread) return 'unread';                         // 자격을 아직 못 읽었다
  if (fd && fd.fails && fd.fails.length) return 'no';           // 원문 요건을 못 맞춘다
  return 'ok';
}
/* 정렬용 순위 — 낮을수록 위. 미달은 맨 아래(2026-08-26 개발자 결정) */
function fitRank(m) {
  const v = fitVerdict(m.fit, m.fd);
  return v === 'no' ? 2 : (v === 'unread' ? 1 : 0);
}

function fitBadgeHtml(fit, fd, { full = false } = {}) {
  if (!fd) return fit > 0 ? `<span class="badge badge-fit">적합도 ${fit}%</span>` : '';
  /* 🔴 `fit === 0`은 **evaluate()가 미달로 확정한 것**이다 (fitDetail은 FIT_MIN=5가 바닥이라
     0을 내지 않는다 — fitScore만 ineligible에 0을 준다). 여기를 안 보면 판정이 갈라진다:
     다자녀 국가장학금은 학생이 다자녀가 아니라고 **확실히** 판정됐는데, fitDetail이
     `eligibilityLines`만 읽어 구조화된 자격(flagsAny·tracks)을 못 봐서 '자격 미확인'이 떴다
     (2026-08-26 정렬 검증에서 발견). 미달을 모른다고 말하면 학생이 헛걸음한다. */
  const verdict = fitVerdict(fit, fd);
  /* 🔴 자격을 못 읽었으면 **배지를 안 그린다** (2026-11-15 · 개발자 결정 11-02 — 예전 「자격 미확인」).
     빈 글자를 돌려준다 — 이 갈래의 퍼센트(FIT_UNREAD 35%)는 정렬용이라 화면에 새면 지어낸 숫자가 된다. 순서(fitRank)는 그대로 아래다 */
  if (verdict === 'unread') return '';
  if (verdict === 'no') return '<span class="badge badge-fit-no">지원 자격 미달</span>';
  /* 🔴 미달은 **숫자가 아니라 fails로** 판정한다 (2026-08-24). 0%를 안 쓰기로 하면서
     `pct === 0`이 영영 참이 되지 않아 '지원 자격 미달' 배지가 통째로 사라졌었다.
     숫자는 순서를 정할 뿐이고 뜻은 배지가 전한다 — 그 뜻의 근거는 fails다. */
  /* 🔴 카드와 상세가 **같은 내용을 다른 분량으로** 말한다 (2026-08-30 개발자 지시).
     카드는 훑는 자리라 `요건 3/6` 하나로 줄이고, 퍼센트와 '확인 필요'는 상세에 남긴다.
     ⚠️ 상세까지 줄이면 안 된다 — '확인 필요 n'은 **앱이 모르는 요건이 몇 개인지** 밝히는
        자리라(원칙 8-1) 화면 어디에도 없으면 "다 확인했다"는 거짓말이 된다.
     ⚠️ 판정은 새로 만들지 않는다 — 위 `fitVerdict` 갈래를 그대로 지나온 뒤라
        미달·미확인은 이미 각자 배지로 빠졌다. 여기 남는 것은 비율이 있는 경우뿐이다.
     ⚠️ 색(fit-*)은 카드에도 그대로 둔다. 다만 `요건 3/6`이 늘 함께 가므로 색만으로 뜻을
        전하지는 않는다(색각 이상이 있는 학생에게 색은 아무 말도 하지 않는다). */
  /* 🔴 카드는 **퍼센트만** (2026-08-31 개발자 지시: "요건 없애고 퍼센테이지로").
     ⚠️ 이건 2026-08-24 결정("숫자만 두지 않는다 — 퍼센트 옆에 근거를 함께")을 카드에서는
        뒤집는 것이다. 그때 이유는 "적합도 높은 줄 알고 들어갔는데 신청을 못 하면 피로감이
        쌓인다"였다. 근거는 사라지지 않고 **상세로 내려간다** — 아래 full 갈래가
        `요건 6개 중 3개 충족 · 확인 필요 3`을 그대로 낸다.
     ⚠️ 색(fit-*)만으로 뜻을 전하지 않는다 — 퍼센트 숫자가 늘 함께 간다
        (색각 이상이 있는 학생에게 색은 아무 말도 하지 않는다). */
  /* 🔴 어긋난 요건이 없으면(여기 오는 것은 늘 그렇다 — 미달은 위에서 빠졌다) 빨강·주황을 쓰지 않는다 (2026-11-15) —
     판정 못 한 요건이 분모에 있어 퍼센트가 낮을 뿐인데 경고색이면 '안 맞는다'로 읽힌다(틀린 미달처럼 보인다) */
  const tone = fitToneNoFail(fd.pct);
  if (!full) return `<span class="badge badge-fit fit-${tone}">적합도 ${fd.pct}%</span>`;
  /* 상세 — 「적합도 n% · 맞는 요건 M개」 (2026-11-15 · 예전 「요건 n개 중 m개 충족 · 확인 필요 k」).
     판정 못 한 요건 수는 말하지 않는다(개발자 결정 11-02) — 그 줄들은 표시 없이 목록에 그대로 있다(eligibilityRowsHtml).
     🔴 「어긋난 요건 없음」은 **요건을 전부 판정했을 때만**(fd.unknown === 0 · 2026-11-16 리뷰) — 판정 못 한 줄이 있는데 이 말을 하면
        모르는 줄까지 '괜찮다'고 단정하는 틀린 안심이 된다. 모르는 줄이 있으면 **확인한 것만** 말한다(맞는 요건 M개 · 0개면 퍼센트만) */
  const judgedAll = !(fd.unknown > 0);
  const why = judgedAll ? `${fd.met > 0 ? `맞는 요건 ${fd.met}개 · ` : ''}어긋난 요건 없음` : (fd.met > 0 ? `맞는 요건 ${fd.met}개` : '');
  return `<span class="badge badge-fit fit-${tone}">적합도 ${fd.pct}%${why ? ` <em>${why}</em>` : ''}</span>`;
}

/* 카드에 붙는 판정은 **하나뿐**이다 (2026-09-10 페이스리프트).
   왜 — 한 카드에 최대 5개가 동시에 붙고 있었다: 적합도 · 교내외 · 마감 · 검수 전 · 신청 완료.
   배지는 넣기 쉽고 아무도 빼자고 하지 않아 계속 늘었고, 전부 같은 무게라 우선순위가 안 보였다.
   실측으로 '검수 전'은 등록 48건 중 20건(42%)에 붙어 **내부 검수 공정 상태**가 학생 화면에 나갔다.
   🔴 판정을 새로 만들지 않는다 — fitVerdict / fitTone 을 그대로 쓴다.
   🔴 뺀 것들이 사라지는 게 아니다: 교내외는 기관명 줄로, 마감은 글로, '검수 전'은 상세 시트로
      옮겼다(상세의 badge-kind 가 '교외 · 검수 전'을 이미 낸다). 정직 표기는 그대로 지켜진다. */
function cardBadgeHtml(fit, fd, myApp, sch) {
  /* 🔴 신청내역에 **있기만 한 것**을 '신청 완료'라고 부르지 않는다 (2026-09-10 코드 리뷰).
     '한 번에 신청 준비'로 담은 건은 `pending` 인 채 들어가므로, 신청내역은 '서류 작성 필요'
     라고 하는데 목록 카드만 '신청 완료'라고 말하고 있었다 — 학생은 다 끝난 줄 알고 넘어간다.
     ⚠️ 낱말은 신청내역(`stepNow`)이 쓰는 것과 같은 것을 쓴다. */
  if (myApp) return myApp.pending
    ? '<span class="badge badge-pending">서류 작성 필요</span>'
    : (sch && /^준비 중/.test(prepStateLabel(myApp, sch, '')) ? `<span class="badge badge-pending">${esc(prepStateLabel(myApp, sch, ''))}</span>`
      : '<span class="badge badge-applied">신청 완료</span>');
  const v = fitVerdict(fit, fd);
  if (v === 'no') return '<span class="badge badge-fit-no">지원 자격 미달</span>';
  if (v === 'unread') return '';   // 자격을 못 읽었으면 카드 알약도 없다(2026-11-15 · fitBadgeHtml 과 같은 규칙)
  /* 퍼센트 — 2026-08-31 개발자 지시('요건 없애고 퍼센테이지로')대로 숫자만.
     2026-09-10 페이스리프트가 이것을 알약이 아닌 **글자**로 낮췄는데(다섯 장 연속 같은 알약이
     제목보다 먼저 읽혔다), **2026-09-11 개발자 지시로 다시 알약**이 됐다 — "옅은 회색으로 잘
     보이지 않음". 모양은 style.css 파일 끝 '적합도 알약' 절이 정한다(여기 클래스 이름은 그대로). */
  return fd ? '<span class="sch-fit fit-' + fitToneNoFail(fd.pct) + '">적합도 ' + fd.pct + '%</span>' : '';
}

/* ---------------- 카드 렌더링 ---------------- */
function schCard(sch, result, { compact = false, fit = 0, fd = null } = {}) {
  const d = dday(sch.deadline);
  /* 🔴 **'담았다'와 '다 했다'를 가른다** (2026-09-10 코드 리뷰에서 잡았다).
     예전에는 신청내역에 있기만 하면 '신청 완료' 배지를 달았다. 그런데 담은 건 가운데에는
     `pending: true` 로 **서류 작성이 남은 채** 들어 있는 것이 있다(옛 '한 번에 신청 준비'가 그렇게 담았다 — 기능은 2026-11-19 에 없앴지만 그때 담긴 건은 남아 있다).
     그래서 같은 공고를 **신청내역은 '서류 작성 필요', 목록 카드는 '신청 완료'** 라고
     서로 다르게 말했다 — 학생은 다 끝난 줄 알고 넘어가고 실제로는 아무것도 제출하지 못한다.
     ⚠️ 낱말은 신청내역(`stepNow`)이 쓰는 것과 **같은 것을 쓴다** — 여기서 새로 지어내면
        두 화면이 또 다른 말을 하게 된다. */
  const myApp = state.applications.find((a) => a.id === sch.id);
  const badge = cardBadgeHtml(fit, fd, myApp, sch);
  const due = sch.program ? '상시 제도' : ddayWords(d);
  /* 금액을 못 읽은 공고가 등록 48건 중 34건(71%)이다. 예전엔 그 자리에 '금액 원문 확인'이
     카드에서 **가장 굵은 줄**로 떴다 — 템플릿이 자기 빈칸을 읽어 주는 모습이었다.
     🔴 감추지 않는다(원칙 8-1). 대신 **무게를 낮춘다** — 아는 금액은 굵게, 모르는 것은 옅게. */
  /* 🔴 숫자가 있다고 다 '아는 금액'이 아니다 — 원문이 통째로 들어온 칸이 있다.
     실측: '예산 총 5억원 1천만원 범위 내 최소 50만원 최대 400만원'(1인당 금액이 아니다),
     '등록금 실납부액에 따라 차등지급 자세한 사항은 첨부파일 또는 홈페이지 참…'(잘린 본문).
     이런 줄을 굵게 쓰면 카드가 확정되지 않은 금액을 확정된 것처럼 말한다.
     그래서 **짧고 숫자가 있는 것만** 굵게 쓴다. 나머지는 지우지 않고 옅게 남긴다(원칙 8-1). */
  /* 시안 B (2026-11-02) — 윗줄은 칩(장학 · 교내/교외) + 주최(알 때만) + 알약.
     🔴 아랫줄 왼쪽의 회색 「금액 · …」 줄은 뺐다 (2026-11-15 개발자 지시 "회색으로 금액 뜨는거 빼라 … 장학금이랑 대외활동 다 같이 말하는거야" —
     같은 날 활동 카드의 「대상 · …」 줄을 뺀 것과 한 짝이다). 금액은 시트 머리(amountLine)가 그대로 말한다 */
  return cardShellHtml({
    save: saveBtnHtml(sch.id),
    attrs: `data-detail="${sch.id}"`,
    chip: kindChipHtml(sch),
    org: cardProviderLine(sch),
    badge,
    name: cardTitleParts(sch).title,
    foot: '',
    footKnown: false,
    due,
    urgent: !sch.program && d.days >= 0 && d.days <= 7,
    link: cardSrcLinkHtml(sch, 'detail'),   // 원문 아이콘 — 활동 카드와 같은 자리·같은 모양(2026-10-28)
  });
}

/* 카드 한 장의 그림 — **장학 카드와 대외활동·공모전 카드가 이 한 벌을 쓴다** (2026-10-01 개발자 지시:
   *"장학금 탭이랑 똑같은 흐름으로 갈거야"*). 🔴 그림을 베끼지 말 것 — 2026-09-11 카드 두 벌 사고(한쪽에만
   배지 무더기가 남았다). 무엇을 넣을지는 부르는 쪽이 정하고, 모양은 여기 하나다.
   · 맨 윗줄은 **기관명 + 판정 하나**다 (2026-09-10 페이스리프트). 교내·교외는 배지를 빼고 기관명 앞에 글로 붙인다 —
     배지 줄이 카드를 지배하던 것을 끝내면서도 학생이 알아야 할 구분은 남긴다.
   · 🔴 마감(D-DAY 카운트)의 자리는 **맨 아랫줄 오른쪽**이다 (2026-09-11 개발자 지시).
     맨 윗줄은 적합도가 쓰는 자리라 거기 두면 안 된다("적합도와 같은 곳에 있으면 안됨").
     금액(왼쪽)과 마감(오른쪽)이 한 줄에 나란히 — 학생이 카드에서 마지막으로 읽는 두 숫자다.
     2026-09-09 에 카드 밑에 두었던 빨간 막대는 같은 지시로 **뺐다**(interactions.js 에서도
     지웠다 — 남겨 두면 다음 사람이 다시 붙인다). 7일 안쪽은 글자를 빨갛게(urgent) 한다.
   · 북마크 단추는 카드 **바깥**(save) — `.sch-card` 가 `<button>` 이라 안에 넣으면 단추 안의 단추가 된다. */
function cardShellHtml({ save = '', attrs, chip = '', org, badge = '', name, foot = '', footKnown = true, due = '', urgent = false, link = '' }) {
  /* link — 카드 오른쪽 아래의 작은 원문 링크(활동 카드 · 2026-10-19 개발자 "카드에도 원문공고 하이퍼링크"). 북마크처럼 **단추 바깥**에 둔다(단추 안의 링크는 허용되지 않는 구조) */
  return `
    <div class="sch-card-wrap${link ? ' has-link' : ''}">
    ${save}${link}
    <button class="sch-card" ${attrs}>
      <div class="sch-top">
        ${chip}${org ? `<span class="sch-org">${esc(org)}</span>` : ''}
        ${badge}
      </div>
      <p class="sch-name">${esc(name)}</p>
      <div class="sch-foot">
        <span class="sch-amount${footKnown ? '' : ' unknown'}">${esc(foot)}</span>
        ${due ? `<span class="sch-due${urgent ? ' urgent' : ''}">${esc(due)}</span>` : ''}
      </div>
    </button>
    </div>`;
}

/* 북마크 단추 — 카드·상세 시트가 **같은 함수**를 쓴다 (2026-09-07).
   🔴 카드 **바깥**에 둔다. `.sch-card` 가 `<button>` 이라 그 안에 단추를 넣으면
      단추 안의 단추가 되어(허용되지 않는 구조) 브라우저마다 다르게 깨진다.
      감싸는 `.sch-card-wrap` 이 자리를 잡아 주고, 누름은 서로 안 겹친다. */
function saveBtnHtml(id) {
  const on = isSaved(id);
  return `<button class="save-btn${on ? ' on' : ''}" data-save="${esc(id)}"
      aria-pressed="${on}" aria-label="${on ? '저장 해제' : '공고 저장'}">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 3h12a1 1 0 0 1 1 1v16.2a.8.8 0 0 1-1.25.66L12 17.3l-5.75 3.56A.8.8 0 0 1 5 20.2V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>`;
}

/* ── 홈 '신청서 마저 쓰기' 줄 (2026-09-09 · 개발자 지시 ②) ────────────────────
   *"장시간 나갔다가 들어온 경우 해당 프로그레스가 저장되어 있었으면 해."*
   창(4시간)을 넘겨 들어오면 화면은 홈으로 가지만 **쓰던 것은 안 버린다.** 자동으로
   신청서를 열지 않는 이유는 하나다 — 며칠 만에 앱을 켰는데 반쯤 쓴 폼이 갑자기 뜨면
   학생이 자기가 어디 있는지 모른다. 그래서 눌러서 들어오는 한 줄로 둔다.

   🔴 여기서 마감·자격을 보고 숨기지 않는다. 이미 쓴 글은 학생 것이고, 마감됐다는 사실은
      들어간 화면이 제 손으로 말한다. 숨기면 쓴 글이 사라진 것처럼 보인다. */
/* 쓰던 신청서 — 창(4시간)을 넘겨 들어와도 진행분은 안 버린다(docs/designs/first-run-and-resume.md).
   예전엔 홈의 「쓰던 신청서」 띠(#home-resume)였는데 2026-11-20 승인 시안으로 히어로의 「이어서 쓰기」 줄이 그 일을 맡았다.
   여기서는 **있는지와 무엇인지**만 돌려준다 — 줄을 그리는 것은 renderHome, 여는 것은 renderDraftSheet(app-prep.js). */
/* 🔴 쓰던 것은 둘이다 (2026-11-21 개발자 지시 "이어서 쓰기 클릭 시 전의 작성 내용이"): 앱 신청서(`form` · 답째 장부에) · 원본 양식 채우기(`fill` · 답은 state.formFills, 장부엔 어느 공고·파일인가만).
   둘 다 살아 있으면 **나중에 쓴 것** 하나를 돌려준다. kind 로 여는 길을 가른다(renderDraftSheet). */
function resumeDraft() {
  const saved = typeof resumeLoad === 'function' ? resumeLoad() : null;
  const now = Date.now();
  const alive = (p) => typeof resumeProgressAlive === 'function' && resumeProgressAlive(p, now);
  /* 🔴 이미 다 쓴 신청(신청내역에 pending 없이 담김)은 '쓰던 신청서'가 아니다 (리뷰 2026-11-23) — 신청 내역 「다시 작성」으로 열어 보기만 하고 닫아도
     양식 화면이 이어보기 장부(form)를 적어, 홈 히어로가 끝난 신청을 「쓰던 신청서 1건」으로 불렀다 */
  const formDone = (id) => (state.applications || []).some((a) => a.id === id && !a.pending);
  const form = saved && alive(saved.form) && findSch(saved.form.schId) && !formDone(saved.form.schId) ? { kind: 'form', sch: findSch(saved.form.schId), prog: saved.form } : null;
  const fillSch = saved && alive(saved.fill) && (typeof fillTargetFor === 'function' ? fillTargetFor(saved.fill.schId) : findSch(saved.fill.schId));
  /* 🔴 그 양식(PDF 사본·서식 쪽)이 아직 실려 있을 때만 — 마감 뒤 로봇이 사본을 지우면 열 수 없는 줄이 7일 남고, 더 늦게 쓴 그것이 열리는 앱 신청서를 가린다(리뷰 2026-11-21) */
  const fillOpenable = fillSch && ((typeof formPdfsFor === 'function' && formPdfsFor(fillSch).length) || (typeof formPagesFor === 'function' && formPagesFor(fillSch).length));
  const fill = fillOpenable ? { kind: 'fill', sch: fillSch, prog: saved.fill } : null;
  if (form && fill) return fill.prog.at > form.prog.at ? fill : form;
  return form || fill;
}
/* 히어로 줄 숫자 한 칸 — 그 줄로 넘어올 때 app-mascot.js 가 같은 값·같은 모양으로 다시 올린다(dataset 두 칸) */
const HERO_FMT = new Map();
function heroLine(sel, to, fmt) {
  const el = $(sel);
  if (!el) return;
  el.dataset.to = String(to);
  HERO_FMT.set(el, fmt);
  /* 숫자는 그 자리에 바로 쓴다 — 0부터 올리는 것은 **지금 말하는 줄 하나**뿐이고 그건 app-mascot.js setActive 가 한다(시안 그대로).
     renderHome 은 공고 파일이 올 때마다 다시 돈다 — 여기서 올리면 그때마다 네 줄이 한꺼번에 0부터 돈다 */
  el._countRun = (el._countRun || 0) + 1;
  el.textContent = fmt(to);
}
/* 히어로 줄을 누르면 열리는 목록에 쓰는 값 — renderHome 이 채운다(lastBill 과 같은 때) */
let lastHero = null;

/* '5분 전'·'어제' 처럼 사람이 읽는 말로. 🔴 지어내지 않는다 — 못 재면 빈 말을 하지 않고
   '전에'라고만 한다(원칙 8-1). */
function agoLabel(ts) {
  const ms = Date.now() - Number(ts || 0);
  if (!isFinite(ms) || ms < 0) return '조금 전';
  const min = Math.floor(ms / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return day === 1 ? '어제' : `${day}일 전`;
}

/* ---------------- 홈 ---------------- */
/* 홈 목록에 펴 두는 장수 (노션 UI-14). 접으면 셋, 펴면 열까지 —
   그 위는 '전체 보기'(장학금 찾기)가 맡는다.
   ⚠️ 이름의 DEADLINE 과 `#home-deadline-list` 표식은 **일부러 그대로 둔다** — 구획 이름이
      '마감 임박'이던 시절의 이름이지만, 여기에 붙은 style.css 규칙과 검사 드라이버가 이미
      있어 이름을 바꾸면 통째로 떨어져 나간다(설정 화면의 `#my-account` 와 같은 이유). */
const HOME_DEADLINE_TOP = 3;
const HOME_DEADLINE_MORE = 10;
let homeDeadlineOpen = false;

/* 🔴 홈의 차례는 **적합도와 마감일을 한 점수로 묶어** 내림차순이다 (2026-09-17 개발자 지시:
   "마감임박이라는 수치를 지우고 … 적합도와 마감일을 모두 고려하여 내림차순으로 정렬").
   그전에는 '마감 7일 안쪽인가'(dday 의 cls 'urgent')가 **1차 키**라, 7일 안쪽이기만 하면
   적합도가 아무리 낮아도 바깥의 어떤 공고보다 위였다 — 실측(한국외대 프로필)에서
   `50% D-11` 이 `15% D-1`·`20% D-1` **아래**였다. 게다가 그 칸 안은 적합도순이라
   구획 제목('마감 임박')과 실제 차례가 서로 다른 말을 하고 있었다(개발자 지적).
   지금은 둘을 한 자로 잰다 — **적합도 1%p 를 마감 하루로 친다.**
       점수 = 적합도 − 남은 날   (한 달 너머로 남은 것은 다 같이 '아직 멀다')
   같은 적합도면 마감이 가까운 것이 위로 오고(옛 동점 규칙 그대로), 적합도가 크게 앞서면
   마감이 조금 멀어도 위에 남는다. 2026-09-12 지적("적합도가 낮아도 마감이 임박하면 홈에
   뜬다 — 학생 입장에서는 '굳이…' 다")과 이번 지시를 **식 하나**가 함께 지킨다.
   🔴 **판정을 새로 만들지 않는다** — 적합도는 카드 배지·탐색 정렬과 같은 `m.fit`·`fitRank`,
      남은 날은 `dday()` 다. 여기서 문턱을 새로 정하면 홈과 장학금 찾기가 다른 말을 한다.
   🔴 **마감을 모르는 공고에 `dday().days` 를 쓰지 말 것** — 그 값은 목록에서 안 사라지게
      하려고 주는 **가짜 14**다(dday() 주석·CLAUDE.md). 순서에 쓰면 '한 달 뒤 마감'보다
      위로 올라가 우리가 모르는 날짜를 아는 척하게 된다(원칙 8-1). 그래서 마감이 **적힌**
      공고만 남은 날을 세고, 안 적힌 공고(상시 제도·기한 원문 확인)는 지평선으로 둔다. */
const HOME_FIT_DAY_HORIZON = 30;
function homeScore(m) {
  const left = m.sch.deadline
    ? Math.min(HOME_FIT_DAY_HORIZON, Math.max(0, dday(m.sch.deadline).days))
    : HOME_FIT_DAY_HORIZON;
  return m.fit - left;
}
/* 🔴 미달·자격 미확인은 점수와 무관하게 **아래**다 (2026-08-26 개발자 결정 — 탐색
   '적합도순'과 같은 `fitRank`). 이게 없으면 마감이 가까운 '지원 자격 미달' 카드가
   홈 맨 위에 앉는다 — 적합도를 고려한다면서 미달을 맨 위에 두는 셈이 된다.
   ⚠️ 이 함수를 베끼지 말 것 — 검사 드라이버도 이것을 그대로 불러 차례를 대조한다. */
const byHomeOrder = (a, b) =>
  fitRank(a) - fitRank(b) || homeScore(b) - homeScore(a) || byDeadline(a, b);

function renderHome() {
  const p = state.profile;
  /* 🔴 이름이 없으면 인사말로 때우지 않는다 — 이름은 신청서에도 들어가는 값이라
     비어 있다는 사실 자체를 알려야 한다. 이 줄은 이미 눌러서 프로필로 가는 자리다. */
  $('#home-greet').textContent = p.name ? `${p.name}님` : '이름 설정';
  $('#home-school').textContent = (p.school || '대학 미설정') + (p.campus ? ' · ' + p.campus : '');
  /* 프로필 사진이 있으면 홈 왼쪽 위 동그라미에도 그 사진 (2026-09-11) — 없으면 첫 글자 그대로 */
  if (profilePhoto && profilePhoto.url) $('#home-avatar').innerHTML = `<img src="${esc(profilePhoto.url)}" alt="" />`;
  else $('#home-avatar').textContent = (p.name || '학').charAt(0);

  const matches = getMatches();
  /* '지금 받을 수 있는' 이라고 말하려면 **정말 지금 신청할 수 있어야** 한다 (2026-08-02 개발자 지적).
     예전엔 자격 판정만 보고 마감을 안 봐서, 히어로의 금액 합계와 '바로 신청 n건'에
     **이미 마감된 공고가 섞여** 실제보다 부풀려져 있었다. */
  const applyable = matches.filter((m) =>
    ['eligible', 'selective'].includes(m.result.status) && dday(m.sch.deadline).days >= 0 && notStale(m.sch) && !m.sch.noApply);

  /* 🔴 합계는 **더하기가 아니라 고르기**다 (2026-08-27 · parse-amount.js).
     그냥 다 더하면 ① 같은 장학금이 여러 학교 접수분으로 등록된 것(가송재단 5건)을
     5번 세고 ② 원문이 '함께 받을 수 없다'고 적은 공고까지 다 더한다.
     학생이 실제로 받을 수 없는 숫자를 '지금 받을 수 있는 장학금'이라 부르는 것은
     기망이고 법적 책임이 따른다(개발자 지적). sumAmounts 가 그 둘을 걸러 준다. */
  /* 🔴 `estimate: true` — 못 읽은 금액을 **우리가 읽은 금액들의 중앙값**으로 어림잡아
     합계에 넣는다 (2026-09-17 개발자 지시). 켜는 곳은 여기 하나다: 금액 상세·관리자
     화면·감사는 켜지 않으므로 거기서는 확인된 금액만 더한 숫자가 그대로 보인다.
     짐작이 데이터에 남지 않는 이유와 근거는 parse-amount.js sumAmounts ④ 참조. */
  const bill = sumAmounts(applyable.map((m) => m.sch),
    { tuition: tuitionFor(p, tuitionTable), estimate: true });
  const total = bill.total;
  lastBill = { bill, count: applyable.length };

  /* 🔴 **'약' 을 붙이지 않는다** (2026-09-17 개발자 지시 2차). 한때 어림잡은 몫이 섞이면
     '약' 을 붙였는데, 개발자 판단은 이렇다 — *"어차피 사용자가 직접 공고 내 들어가면 금액
     있는 원문은 최대 ~ 라고 표시되고 추정치는 금액 원문 확인으로 표시되므로"*. 즉 어느
     공고의 금액이 확인된 것이고 어느 것이 아닌지는 **공고 카드와 상세가 이미 말하고 있어서**,
     합계 숫자 앞의 글자 하나가 더 할 일이 없다는 것이다.
     🔴 그래도 내역은 남아 있다 — 금액을 누르면 열리는 **금액 상세**가 '금액을 못 읽은 n건은
        어림잡아 더함' 과 한 건당 얼마로 쳤는지를 그대로 적는다(renderAmountDetail).
     ⚠️ 되돌려 '약' 을 다시 붙이지 말 것 — 관문이 막는다. */
  /* 🔴 수령 가능액 — 「최대」 를 붙이지 않는다 (2026-11-20 개발자 지시: "수령 가능액에서 최대도 빼줘"). '약' 도 안 붙인다(아래 9/17 지시 그대로).
     줄 글자는 app-mascot.js 가 그 줄로 넘어올 때 0부터 올린다(같은 dataset.to · 같은 모양) */
  heroLine('#hero-amount', total, won);
  /* 🔴 히어로 아랫줄을 **통째로 없앴다** (2026-09-17 개발자 지시 2차: "금액 밑에 있는
     '그중 N건은 바로 신청할 수 있어요' 안내도 삭제해줘"). 앞서 같은 자리에서 금액 회계
     두 줄을 걷어냈고, 이 줄이 마지막 하나였다. 이제 히어로는 **금액과 그림 칸**뿐이다(버튼은 2026-11-19 에 없앴다 — 일괄 신청 준비 삭제).
     🔴 `#hero-count` 요소도 index.html 에서 뺐다 — 채우는 곳이 없는 빈 칸을 남겨 두면
        다음 세션이 '왜 안 채우지'를 뒤진다. 그 칸이 주던 아래 여백은 style.css 파일 끝
        '히어로' 절에서 `.hero-amount` 가 물려받는다(실측 57px → 같은 자리 유지). */
  if (window.Mascot) Mascot.syncHome(state.profile && state.profile.school);   // 3D 마스코트(app-mascot.js) — 학교가 바뀌면 캐릭터도 바뀐다
  /* 🔴 히어로 2026-10-01 CTO 결정(시안 I4) — 금액 아래 한 줄 + 그림 4칸.
     9/17 에 걷었던 아랫줄 자리지만 CTO 가 이 시안을 골라 다시 둔다. 숫자는 **전부 위
     `applyable` 하나에서 센다** — 판정을 새로 만들면 히어로와 목록이 다른 말을 한다.
     '이번 주 마감' = 남은 날 7일 이하(기한을 못 읽은 공고는 dday 가 14일을 주므로 안 들어간다). */
  const soon = applyable.filter((m) => m.sch.deadline && dday(m.sch.deadline).days <= 7).length;
  /* 🔴 금액과 버튼 사이의 한 줄(`#hero-sub`)을 **통째로 없앴다** (2026-10-03 개발자 지시).
     10-01 에 그림 4칸이 생기면서 그 줄이 말할 수 있는 숫자가 **전부 칸이나 버튼에 이미**
     있게 됐다 — 마감·교내·교외·신청내역은 칸 배지, 신청 가능은 버튼. 무엇을 적어도 바로
     아래와 겹쳤다(실측: `신청 가능 28건` 과 `28건 신청 준비` 가 8px 사이로 나란히 떴고,
     `이번 주 마감 5건` 은 첫 칸 배지 5 와 같은 수였다).
     🔴 `#hero-sub` 요소도 index.html 에서 뺐다 — 채우는 곳이 없는 빈 칸을 남겨 두면
        다음 세션이 '왜 안 채우지'를 뒤진다(9/17 에 `#hero-count` 를 뺄 때와 같은 이유).
     ⚠️ `soon` 은 지우지 말 것 — 바로 아래 `tileN.deadline` 이 쓴다. */
  const tileN = {
    deadline: soon,
    '교내': applyable.filter((m) => m.sch.type === '교내').length,
    '교외': applyable.filter((m) => m.sch.type === '교외').length,
    /* 신청 내역 화면과 같은 수(내려간 공고 빼고) — 공고 목록을 받기 전엔 담은 수 그대로(받고 나서 줄어드는 것은 '내려감'이 확정된 뒤다) */
    applications: shownAppCount(),
  };
  /* 대외활동·공모전 칸 — 목록이 아직 안 왔으면 0 이 아니라 '모름'이라 배지를 숨긴다(없다고 말하지 않는다) */
  const acts = liveActivities ? activitiesForMe() : null;
  ['대외활동', '공모전'].forEach((k) => { tileN[k] = acts ? acts.filter((n) => (n.kind || '대외활동') === k).length : null; });
  /* 학교 바로가기 칸은 그 학교 주소를 확인한 것만 그린다(school-links.js · 지어낸 주소로 보내지 않는다) */
  const heroTiles = HERO_TILES.filter((t) => !t.link || (typeof schoolLinkFor === 'function' && schoolLinkFor(state.profile, t.link)));
  $('#hero-tiles').innerHTML = heroTiles.map((t) => `
    <button type="button" class="hero-tile" data-hero-go="${t.go}" aria-label="${t.name}${tileN[t.go] == null ? '' : ` ${tileN[t.go]}건`}">
      <span class="hero-ico ${t.tone}">${t.svg}${tileN[t.go] == null ? '' : `<span class="hero-badge${tileN[t.go] ? '' : ' zero'}">${tileN[t.go]}</span>`}</span>
      <span class="hero-tile-name">${t.name}</span>
    </button>`).join('');

  /* 히어로 안내 줄 (2026-11-20 승인 시안 「가리키는 마스코트」) — 차례: 매칭된 공고 → 수령 가능액 → 마감 D-n → 이어서 쓰기.
     🔴 숫자는 전부 위 `applyable` 하나에서 센다 — 금액 상세(lastBill)·그림 칸과 같은 모집단이다.
     · 매칭된 공고 = applyable 건수(금액 상세 머리줄 「신청 가능 n건」 과 같은 수)
     · 마감 = **가장 빠른 마감일** 하나와 그날 마감인 공고 수(마감이 적힌 것만 — dday 의 가짜 14 를 쓰지 않는다) · 없으면 줄을 숨긴다
     · 이어서 쓰기 = 쓰던 신청서(이어보기 저장분이 살아 있고 그 공고를 찾을 때) · 없으면 줄을 숨긴다 */
  const dated = applyable.filter((m) => m.sch.deadline).sort(byDeadline);
  const dueDays = dated.length ? dday(dated[0].sch.deadline).days : null;
  const dueList = dated.filter((m) => dday(m.sch.deadline).days === dueDays).sort(byHomeOrder);
  const draft = resumeDraft();
  lastHero = { applyable: applyable.slice().sort(byHomeOrder), dueDays, dueList, draft };
  heroLine('#hero-match', applyable.length, (v) => `${v}건`);
  $('#hero-due-dd').textContent = dueDays === 0 ? 'D-Day' : `D-${dueDays}`;
  heroLine('#hero-due', dueList.length, (v) => `${v}건`);
  heroLine('#hero-draft', draft ? 1 : 0, (v) => `${v}건`);
  $('#hero-lines [data-k="due"]').hidden = !dueList.length;
  $('#hero-lines [data-k="due"]').classList.toggle('urgent', dueDays === 0);
  $('#hero-lines [data-k="draft"]').hidden = !draft;
  if (window.Mascot) Mascot.syncLines();

  /* 담을 것은 그대로다 — 자격이 확실히 미달인 것과 이미 마감된 것, 오래된 것만 뺀다.
     차례는 위 `byHomeOrder`(적합도 + 마감일 한 점수) 하나가 정한다. */
  const upcomingAll = matches
    .filter((m) => m.result.status !== 'ineligible' && dday(m.sch.deadline).days >= 0 && notStale(m.sch))
    .sort(byHomeOrder);
  /* 석 장만 펴 두고 나머지는 '더보기' 로 편다 — 그려는 두고 CSS 가 가린다(style.css).
     ⚠️ `HOME_DEADLINE_MORE` 를 넘는 것은 '전체 보기'(장학금 찾기)가 맡는다. */
  const upcoming = upcomingAll.slice(0, HOME_DEADLINE_MORE);
  /* ⚠️ 여기에는 뼈대를 두지 않는다 (2026-09-09 실측). 처음엔 "공고가 오기 전에 홈이
     '없음'이라고 말한다"고 보고 뼈대를 넣었는데, 실제로 재 보니 **그런 일이 없었다** —
     `allScholarships()` 가 data.js 의 상시 제도 6종을 동기로 먼저 내주기 때문에
     이 목록은 받아오기 중에도 비지 않는다. 뼈대는 실제로 기다림이 보이는
     `liveNoticesHtml()` 한 곳에만 둔다. */
  const deadlineList = $('#home-deadline-list');
  deadlineList.innerHTML = upcoming.length
    ? upcoming.map((m) => schCard(m.sch, m.result, { compact: true, fit: m.fit, fd: m.fd })).join('')
    : '<p class="empty">지금 신청할 수 있는 장학금이 없어요<br /><span class=\"empty-sub\">프로필을 채우면 더 많이 찾을 수 있어요</span></p>';
  /* 앞의 HOME_DEADLINE_TOP 장을 뺀 나머지에 표를 붙인다 — 가리는 것은 style.css 가 한다.
     '몇 장'은 이 상수 하나에만 산다(CSS 에 숫자를 두면 둘이 갈라진다). */
  [...deadlineList.children].forEach((el, i) => el.classList.toggle('home-extra', i >= HOME_DEADLINE_TOP));
  deadlineList.classList.toggle('more-open', homeDeadlineOpen);
  const moreBtn = $('#home-deadline-more');
  moreBtn.hidden = upcoming.length <= HOME_DEADLINE_TOP;
  moreBtn.textContent = homeDeadlineOpen ? '접기' : '더보기';
  moreBtn.setAttribute('aria-expanded', homeDeadlineOpen ? 'true' : 'false');

  /* 🔴 **우리 학교 게시판 새 공고는 여기서 그린다** (2026-09-18 개발자 지시로 '교내' 칸에서 옮겼다).
     이 카드들은 대개 제목·링크뿐이라 **누가 주최하는지 모른다** — 그래서 통째로는 '교내' 칸에
     둘 수 없다(거기 두면 외부 장학금이 교내로 섞여 보인다 · 개발자가 짚은 혼동이 그것이다).
     ✅ 그중 학교가 제목에 `[교내]` 라고 **직접 적어 둔 글**만 '교내' 칸 꼬리에도 함께 뜬다
        (`boardNoticesInSchool` · 같은 날 개발자 지적). 여기서는 전부 그대로 나온다.
     ⚠️ 검색은 안 건다 — 홈에는 검색창이 없다(탐색에 있던 시절의 이유가 사라졌다). */
  $('#home-activities').innerHTML = homeActivitiesHtml();
  $('#live-notices').innerHTML = liveNoticesHtml();
  /* 우리 학교 소식 — 홈 첫 화면 사진 카드 띠 (2026-10-04 승인 시안 1안 · 아이콘 네 칸 밑) · 없으면 구역째 숨긴다 */
  const newsHtml = homeNewsHtml();
  $('#home-news').innerHTML = newsHtml;
  $('#home-news').hidden = !newsHtml;
  /* 재단·지자체 새 공고 (2026-09-26 · 교외 확대) — 학교 게시판 구역 아래, 글이 있을 때만 */
  $('#external-notices').innerHTML = externalNoticesHtml();

  renderHomeUpdated();
}

/* ---------------- 탐색 ---------------- */
let exploreFilter = 'all';
/* 검색어 — 필터·정렬과 같은 성격으로 **저장하지 않는다**(새로고침하면 빈 값) */
let exploreQuery = '';
/* 정렬 기준 — 필터와 같은 성격으로 **저장하지 않는다**(새로고침하면 기본값). */
let exploreSort = 'fit';

/* 🔴 정렬 키가 비면 **방향과 무관하게 뒤로** 보낸다 (2026-08-26).
   `deadlineTs()`는 마감일이 없는 공고에 `Infinity`를 주는데(app.js 위쪽), 그걸 그대로
   비교에 쓰면 내림차순에서 **마감 없는 131건 + 상시 제도 6건이 통째로 맨 위로** 올라온다.
   관리자 화면(_admin/admin.js `sortItems`)이 같은 데이터에서 이미 쓰는 규칙이다.
   ⚠️ `dday().days`를 정렬 키로 쓰면 안 된다 — 마감 없는 건에 **가짜 14**를 준다
      (목록에서 안 사라지게 하려는 장치라 순서로 쓰면 전부 D-14 자리에 뭉친다). */
function byMissingLast(va, vb, dir) {
  if (!va && !vb) return 0;
  if (!va) return 1;
  if (!vb) return -1;
  return va < vb ? -dir : va > vb ? dir : 0;
}
/* 🔴 이미 마감된 공고는 '마감 임박순'에서 **뒤로** 보낸다 (2026-08-26 스크린샷으로 발견).
   마감 다음 날까지는 목록에 남기는 규칙(CLOSED_KEEP_DAYS) 때문에, 그냥 날짜 오름차순으로 두면
   **지나간 공고가 맨 위**에 온다. '임박'은 다가온다는 뜻이지 지나갔다는 뜻이 아니다.
   지난 것끼리는 최근에 마감된 것부터 (아직 접수를 받을 여지가 그나마 크다). */
const isPastDue = (d) => !!d && dday(d).days < 0;
const byDeadline = (a, b) => {
  const pa = isPastDue(a.sch.deadline), pb = isPastDue(b.sch.deadline);
  if (pa !== pb) return pa ? 1 : -1;
  if (pa && pb) return byMissingLast(a.sch.deadline, b.sch.deadline, -1);
  return byMissingLast(a.sch.deadline, b.sch.deadline, 1);
};
/* 등록일이 없는 50건은 전부 마감일이 있다 — 폴백하면 사실상 전건이 값을 갖는다 */
const listedKey = (m) => m.sch.listedAt || m.sch.deadline || '';
const byListed = (a, b) => byMissingLast(listedKey(a), listedKey(b), -1);

const EXPLORE_SORTS = {
  fit: { label: '적합도순', cmp: (a, b) => b.fit - a.fit || byDeadline(a, b) },
  deadline: { label: '마감 임박순', cmp: byDeadline },
  listed: { label: '등록 최신순', cmp: byListed },
};

/* 정렬 — **누르면 다음 기준으로 넘어가고, 길게 누르면 아래에 목록이 뜬다**
   (2026-08-26 개발자 지시). 기준이 셋뿐이라 한 번 누르는 것이 가장 빠르고,
   바로 고르고 싶을 때만 목록을 연다. 목록은 화면 절반을 덮는 시트가 아니라
   **아이콘 바로 아래** 뜨는 작은 팝오버다. */
/* 🔴 정렬 목록은 **한 벌**이다 — 탐색과 대외활동·공모전이 같은 함수로 연다(2026-09-30 개발자 지시
   "장학금 쪽과 똑같이"). 화면마다 다른 것은 단추·목록의 id 와 기준표뿐이다. 두 벌로 베끼면
   한쪽만 고쳐져 또 달라진다(이 화면이 이미 한 번 그렇게 갈라져 있었다). */
const ACTIVITY_SORTS = {
  /* 🔴 이름은 장학 탐색의 '등록 최신순'과 같은 말을 쓴다 (2026-10-10 팀 업무 분장 14번 — 은서: 용어 통일).
     예전 이름 '최근 수집순'은 같은 기준을 다른 말로 불러 두 화면이 다른 정렬처럼 읽혔다. */
  recent: { label: '등록 최신순' },
  deadline: { label: '마감 임박순' },
  /* 적합도순 (2026-10-01) — 장학 탐색과 같은 잣대: 판정(fitRank — 맞음 < 미확인 < 미달)이 먼저, 그 안에서 적합도 */
  fit: { label: '적합도순' },
};
const SORT_MENUS = {
  explore: { btn: '#explore-sort-btn', menu: '#explore-sort-menu', label: '#explore-sort-label',
    sorts: EXPLORE_SORTS, get: () => exploreSort,
    set: (k) => { exploreSort = k; renderExplore(); } },
  activities: { btn: '#activities-sort-btn', menu: '#activities-sort-menu', label: '#activities-sort-label',
    sorts: ACTIVITY_SORTS, get: () => activitiesSort,
    set: (k) => { activitiesSort = k; renderActivities(); } },
};

function openSortMenu(which = 'explore') {
  const m = SORT_MENUS[which];
  const menu = $(m.menu);
  menu.innerHTML = Object.keys(m.sorts).map((k) => `
    <button class="sort-opt" role="menuitemradio" data-sort="${k}"
            aria-checked="${k === m.get()}">${m.sorts[k].label}</button>`).join('');
  menu.hidden = false;
  $(m.btn).setAttribute('aria-expanded', 'true');
}

function closeSortMenu(which) {
  for (const k of which ? [which] : Object.keys(SORT_MENUS)) {
    const menu = $(SORT_MENUS[k].menu);
    if (!menu || menu.hidden) continue;
    menu.hidden = true;
    $(SORT_MENUS[k].btn).setAttribute('aria-expanded', 'false');
  }
}

function applySort(key, which = 'explore') {
  const m = SORT_MENUS[which];
  if (!m.sorts[key]) return;
  $(m.label).textContent = m.sorts[key].label;
  m.set(key);
  closeSortMenu(which);
}

/* 금액 상세에서 고른 공고를 장학금 찾기 화면에서 찾아 보여 준다 (2026-08-27).
   못 찾으면 아무 일도 안 일어나게 두지 않고 그 공고 상세를 연다 —
   '눌렀는데 아무 반응 없음'이 학생에게는 고장으로 보인다. */
function renderExplore() {
  const matches = getMatches();
  const sorter = EXPLORE_SORTS[exploreSort] || EXPLORE_SORTS.fit;
  /* 🔴 **'교내' 칸에는 우리가 확인한 등록 공고만 온다** (2026-09-18 개발자 지시 · 되돌리지 말 것).
     2026-09-17 에 '우리 학교' 칸을 여기에 합쳤는데, 그 결과 **교내 칸에 외부 장학금이 섞여**
     보였다(게시판 글은 주최를 모르는 채 얹혀 있었다). 개발자가 그 혼동을 짚었다 —
     *"교내 장학금만 볼 수 있는 창을 누르면 교내에서 주최하는 성적장학금이나 가족장학금 등과
      같은 것만 올라왔으면 좋겠어 … 어떤 재단이 주최하는가가 기준이 되어야 돼."*
     → 게시판 글은 **홈**으로 옮겼다(renderHome · 사라지면 학생이 볼 곳이 없다는 같은 지시).
     ⚠️ 이 칸은 학교 게시판에 교내 공고가 있어도 **우리가 안 읽었고 학교도 `[교내]` 라고
        안 적어 뒀으면 0건**이다. 그래서 빈 문구가 '없어요' 로 끝나지 않고 홈을 가리킨다
        (아래 emptyMsg). 학교가 적어 둔 것은 `boardIn` 이 주워 온다. */
  const inSchoolTab = exploreFilter === '교내';
  /* 🔴 판정 3단(가능/정보부족/미달)은 **적합도순일 때만** 1차 키다 (2026-08-26 개발자 결정:
     "적합도를 기준으로 했을 때는 맨 아래에 두는 게 맞지"). 마감순·최신순에서는 고른 기준이
     곧이곧대로 적용된다 — 마감 임박순인데 미달이라고 뒤로 밀면 그 정렬은 거짓말이 된다.
     미달 카드는 빨간 '지원 자격 미달' 배지로 구분되므로 위로 와도 오해하지 않는다. */
  /* 🔴 정렬도 **배지와 같은 근거**(fitVerdict)를 쓴다 — `order[status]` 만 보면
     배지가 '미달'인 카드와 '적합도 N%'인 카드가 뒤섞인다(2026-08-29에 실제로 그랬다). */
  let list = matches.slice().sort((a, b) =>
    (exploreSort === 'fit' ? fitRank(a) - fitRank(b) : 0)
    || sorter.cmp(a, b)
  );

  list = list.filter((m) => dday(m.sch.deadline).days >= -CLOSED_KEEP_DAYS); // 마감 다음 날까지만 (그 뒤로는 신청 내역에서)
  list = list.filter((m) => notStale(m.sch)); // 마감을 확정 못 한 공고는 등록 후 60일까지만 노출
  if (exploreFilter === '교내' || exploreFilter === '교외') list = list.filter((m) => m.sch.type === exploreFilter);
  /* 🔴 **'신청 가능만' 칸은 없다** (2026-09-17 개발자 지시 · 되살리지 말 것).
     그 칸은 `['eligible','selective']` 인 공고만 남겼는데, 2026-09-13 에 `applyLock` 이
     **자격 판정으로 신청을 막지 않게** 되면서 뜻이 어긋났다 — 앱이 미달·미확인이라 읽은
     공고도 실제로는 신청할 수 있고(우리 판정은 100% 가 아니다), 그래서 이 칸은
     '신청 가능한 것'이 아니라 **'우리가 자격을 읽어낸 것'**을 보여 주고 있었다.
     잘못 미달로 읽은 공고를 학생에게서 통째로 감추던 자리라 없앤다. */

  /* 검색 (2026-08-30) — 정렬·필터가 다 끝난 **마지막에** 거른다.
     ⚠️ 순서를 앞으로 옮기지 말 것: 마감·오래된 공고 숨김은 검색 결과에도 적용돼야 한다.
        검색으로 마감된 공고가 나오면 '있는 줄 알고 눌렀다 마감'이 된다.
     ⚠️ 색인을 따로 만들지 않는다 — 카드에 실제로 **보이는 글자**(제목·기관·금액)만 본다.
        학생이 화면에서 읽은 낱말로 찾는 것이 검색이고, 안 보이는 값으로 걸리면 왜 나왔는지 모른다. */
  const q = exploreQuery.trim().toLowerCase();
  if (q) {
    list = list.filter((m) => [m.sch.name, m.sch.provider, m.sch.amount]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
  }

  /* 🔴 **게시판 글을 통째로 이 칸에 붓지 말 것** (2026-09-18 개발자 지시).
     2026-09-17 에 '우리 학교' 칸을 '교내' 에 합쳤는데, 그 결과 **교내 칸에 외부 장학금이
     섞여** 보였다 — 개발자 지적: *"교내 장학금만 볼 수 있는 창을 누르면 교내에서 주최하는
     성적장학금이나 가족장학금 등과 같은 것만 올라왔으면 좋겠어 … 교내 교외가 어디에
     게시되느냐가 아니라 어떤 재단이 주최하는가가 기준이 되어야 돼."*
     게시판 글은 대개 제목·링크뿐이라 **주최를 알 수 없다**(실측으로 확인: 제목의 바깥 기관
     낱말로 갈라 보니 `정영오 장학금`·`구종서 장학금`·`금신사랑`·`선원가족` 같은 외부
     장학금이 전부 '교내 후보'로 떨어졌다). 모르는 것을 교내라고 부르지 않는다.
     ✅ **예외는 학교가 스스로 `[교내]` 라고 적어 둔 글 하나뿐이다** — 그건 우리가 맞히는
        것이 아니라 주최자가 적어 둔 것이라 아래 `boardIn` 으로 이 칸 꼬리에 붙인다
        (같은 날 개발자 지적: *"교내에서 진행되는 거 있는데 교내탭에는 안 들어가져 있어"*).
     ⚠️ 낱말 목록을 늘려 나머지를 맞히려 하지 말 것 — 그 길은 위 실측대로 틀린다. */
  /* 🔴 **구획 없이 한 목록이다** (2026-09-12 개발자 지시: "오늘 내일 마감 이번 주 마감
     이번 달 마감 삭제 후 하나로 통합, 적합도 순 마감 임박순 이런 거 하나도 안 지켜짐").
     2026-09-10 페이스리프트가 마감으로 7구획을 나눴는데, 구획이 **마감 순서로 고정**이라
     학생이 고른 정렬은 구획 **안에서만** 살아 있었다 — 적합도순을 골라도 화면 맨 위는
     늘 '오늘·내일 마감' 구획이라 정렬이 통째로 안 먹는 것처럼 보였다(그게 지적 그대로다).
     정렬은 이제 위 sort 하나가 목록 전체에 그대로 적용된다.
     ⚠️ 구획을 되살리려면 정렬을 어떻게 살릴지부터 정할 것 — 둘은 같은 자리를 두고 다툰다. */
  /* 🔴 '교내' 칸이 비면 **왜 비었는지**를 말한다 (2026-09-18). 우리가 원문을 읽어 교내로
     확인한 공고만 여기 오므로, 학교 게시판에 교내 공고가 있어도 아직 안 읽었으면 0건이 된다.
     '없어요' 로만 끝내면 학생은 학교에 교내 장학금이 없다고 읽는다 — 그건 우리가 모르는 것이다. */
  const emptyMsg = q
    ? `'${esc(exploreQuery.trim())}'와 맞는 장학금이 없어요`
    : (inSchoolTab
      ? '확인된 교내 장학금이 아직 없어요<br /><span class="empty-sub">학교 게시판 새 공고는 홈에서 볼 수 있어요</span>'
      : '조건에 맞는 장학금이 없어요');
  /* 🔴 **학교가 `[교내]` 라고 적어 둔 게시판 글은 이 칸에도 온다** (2026-09-18 개발자 지적:
     *"실시간 공고 보니까 교내에서 진행되는 거 있는데 교내탭에는 안 들어가져 있어"*).
     우리가 원문을 읽어 등록한 카드가 먼저 오고, 그 **뒤에** 게시판 글이 붙는다 — 읽은 것과
     읽지 않은 것을 섞지 않는다(게시판 글 카드는 `.notice-card` 라 겉모습부터 다르고,
     2026-11-20 부터 누르면 원문으로 바로 나가지 않고 상세 시트를 연다 — openBoardDetail · 원문은 시트 맨 아래).
     ⚠️ 검색어는 여기에도 건다 — 안 걸면 '검색했는데 그대로'가 된다(2026-09-12 · UI-16).
        카드에 보이는 글자(제목)로만 거른다, 위 등록 공고와 같은 규칙이다. */
  const boardIn = inSchoolTab
    ? boardNoticesInSchool().filter((n) => !q || String(unent(n.title)).toLowerCase().includes(q))
    : [];
  $('#explore-list').innerHTML = (list.length || boardIn.length)
    ? list.map((m) => schCard(m.sch, m.result, { fit: m.fit, fd: m.fd })).join('')
      + boardIn.map((n) => noticeCardHtml(n, { sheet: true })).join('')   // 이 칸의 카드는 전부 시트를 연다(2026-11-20 · 원문은 시트 맨 아래)
    : `<p class="empty">${emptyMsg}</p>`;
}

/* 🔴 '전체 목록을 보여 주겠다'고 **말한 곳**에서 부른다 (도우미의 '장학금 탭에서 전체 보기' ·
   알림이 공고를 못 찾았을 때). 고른 칸은 화면을 옮겨도 그대로 남는 것이 맞지만, 전체 목록을
   약속해 놓고 '교내'·'교외'로 걸린 목록을 띄우면 약속을 안 지키는 것이다 — 그래서 칸을
   되돌린다(2026-09-12 코드 리뷰가 '우리 학교' 칸에서 실측으로 잡은 길이다: 카드 0장짜리
   화면이 떴다. 그 칸은 2026-09-17 에 '교내'로 합쳐졌고 이 되돌림은 그대로 필요하다). */
function exploreShowAll() {
  exploreFilter = 'all';
  $$('#explore-filters .filter-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === 'all'));
  showScreen('explore');
  renderExplore();
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
/* '서류가 무엇인지는 원문에서 확인' 이라는 **안내 줄** — 서류 이름이 아니다.
   자동 등록분은 documents 에 `지원 자격·제출 서류는 원문 공고에서 확인` 한 줄만 들고 온다
   (층2는 `재단 공고문에서 확인`). 이걸 체크리스트에 올리면 "□ 지원 자격·제출 서류는 원문 공고에서
   확인 — 공식 제출 시 함께 준비하세요" 처럼 **서류가 아닌 것을 챙기라고** 말한다(2026-09-23). */
const DOC_PLACEHOLDER = /(원문\s*공고|공고문|재?공고\s*원문)(에서)?\s*확인/;   // `구비서류는 재공고 원문 확인` 도 서류가 아니다(2026-10-15)

/* ── 신청 준비 체크리스트 (2026-10-13 ③ · 개발자 "남은 것 모두 진행") ──────────────────────
   '준비 완료'는 버튼이 아니라 네 항목의 결과다 — ① 제출 서류 확인 ② 서류 작성 ③ 증명서 준비 ④ 제출 방법 확인.
   🔴 `app.pending`(서류 작성이 남았다)의 뜻은 그대로다 — 그 위에 나머지 항목을 얹는다. 자동으로 아는 것(작성했나 · 보관함에 증명서가 다 있나)은
      앱이 체크하고, 모르는 것(서류를 확인했나 · 제출 방법을 봤나)은 학생이 누른다(`app.prep`). 상태 낱말은 신청내역·카드·상세가 **같은 함수**를 쓴다. */
const PREP_ITEMS = [
  { key: 'docs', label: '제출 서류 확인', manual: true },
  { key: 'write', label: '서류 작성', manual: false },
  { key: 'certs', label: '증명서 준비', manual: true },
  { key: 'submit', label: '제출 방법 확인', manual: true },
];
function prepChecklist(app, sch) {
  /* 🔴 체크리스트가 생기기 전에 담은 항목(`prep` 칸이 없다)은 그때 규칙대로 '준비 완료'다 — 새 규칙을 소급해 영영 '준비 중'에 가두지 않는다
     (리뷰 2026-10-13: 옛 항목은 버튼이 잠겨 작성 항목을 채울 길이 없었다). 새로 담는 자리마다 `prep: {}` 를 적는다. */
  const legacy = !app || app.prep === undefined;
  const manual = legacy ? { docs: true, certs: true, submit: true } : (app.prep || {});
  /* '작성'은 `pending`(서류 작성이 남았다)의 반대다 — 양식·자소서가 없는 공고는 담는 순간 pending:false 라 바로 ✓ */
  const written = !!app && !app.pending;
  const certDocs = sch ? (sch.documents || []).filter((d) => !/자동/.test(d) && !DOC_PLACEHOLDER.test(d) && !ESSAY_DEFS.some((e) => e.match.test(d))) : [];
  const certsAuto = certDocs.length > 0 && certDocs.every((d) => { const st = docWalletStatus(d); return !!(st && st.ok); });
  const items = PREP_ITEMS.map((it) => {
    if (it.key === 'write') return { ...it, done: written, auto: true };
    if (it.key === 'certs') return { ...it, done: certsAuto || !!manual.certs, auto: certsAuto };
    return { ...it, done: !!manual[it.key], auto: false };
  });
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, complete: done === items.length };
}
/* 신청내역·카드가 쓰는 짧은 상태 — '서류 작성 필요' > '준비 중 n/4' > 단계 이름 */
function prepStateLabel(app, sch, stepLabel) {
  if (app.pending) return '서류 작성 필요';
  const pc = prepChecklist(app, sch);
  return !pc.complete && !app.submittedAt && !app.result ? `준비 중 ${pc.done}/${pc.total}` : stepLabel;
}

/* 증명서류(작성형 제외)의 보관함 상태 목록 HTML
   opts.bare — 머리글 없이 목록과 보관함 한 줄만(신청 내역 「제출 전 준비」의 「제출 서류 확인」 줄 밑에 붙는다 · 2026-11-21) */
function certStatusListHtml(sch, opts) {
  const certDocs = sch.documents.filter((doc) => !ESSAY_DEFS.some((e) => e.match.test(doc)) && !DOC_PLACEHOLDER.test(doc));
  if (!certDocs.length) return '';
  const rows = certDocs.map((doc) => {
    const st = docWalletStatus(doc);
    /* 🔴 서류 이름은 **수집한 외부 글**이다(층1 documents · 층2 재단 칸) — 전부 esc 를 거친다 (2026-09-23 리뷰).
       예전엔 마지막 갈래만 거쳐서, 이름에 든 태그가 그대로 그려졌다(가짜 '발급처' 링크를 심을 수 있었다).
       이 목록이 이제 확인 전 신청 준비 시트에도 뜨므로 더는 미룰 수 없다. st.text 에도 파일 이름이 든다. */
    const name = esc(doc.replace(/\s*\(.*\)$/, ''));
    if (st && st.ok) return `<li class="doc-ok">✓ ${name} — ${esc(st.text)}</li>`;
    if (st) return `<li class="doc-miss">□ ${name} — ${esc(st.text)}</li>`;
    /* △ · □ 줄 꼬리 안내(「연동 후 자동 첨부」·「공식 제출 시 함께 준비하세요」)는 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) — 원문 서류 이름만 보인다 */
    if (/자동/.test(doc)) return `<li>△ ${esc(doc)}</li>`;
    return `<li>□ ${esc(doc)}</li>`;
  }).join('');
  /* doc-check — 줄마다 ✓·□·△ 표식이 있어 목록 점은 뺀다(표식이 두 겹이던 자리 · 2026-10-15 · style.css) */
  /* 목록 밑 「보관함(MY 탭) 서류는 다음 신청부터 자동 첨부.」는 2026-11-21 개발자 지시로 지웠다(학생이 읽지 않는 안내 · 서류함 상태는 각 줄이 말한다) */
  const list = `<ul class="doc-list doc-check">${rows}</ul>`;
  return opts && opts.bare ? list : `<h4>증명서류 체크리스트</h4>${list}`;
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
/* 초안 첫 문장에 붙일 주관 기관. 🔴 **모른다고 적어 둔 값은 문장에 넣지 않는다** (2026-09-18).
   수집 로봇이 주관 기관을 못 읽으면 `주관 기관 원문 확인` 을 넣는데(auto-register PROVIDER_UNKNOWN),
   그걸 그대로 이으면 학생 지원서에 "주관 기관 원문 확인의 '○○장학금'에 지원합니다" 가 찍힌다.
   앱이 모르는 것은 **빼고 쓴다** — 지어내지도, 앱 내부 사정을 학생 글에 흘리지도 않는다. */
const provLead = (sch) => {
  const v = String((sch && sch.provider) || '').trim();
  return providerUnknown(v) ? '' : v + '의 ';   // '모름' 판정은 카드 윗줄과 같은 providerUnknown 한 곳
};

function generateEssay(def, sch, p, ans, extra) {
  const gpaTxt = p.gpa != null ? `직전 학기 평점 ${p.gpa}/4.5` : '';
  const trackLabel = (TRACKS.find((t) => t.id === p.track) || {}).label || '';
  const paras = [`[인적사항]\n${personLine(p)}`];

  if (def.kind === 'intro') {
    paras.push(
      `[지원 동기]\n안녕하세요. ${p.school} ${p.major || trackLabel} ${p.year}학년 ${p.name || '지원자'}입니다. ${provLead(sch)}'${sch.name}'에 지원합니다. ${ans.motive}. ${gpaTxt ? gpaTxt + '을 유지하며 학업에 성실히 임해 왔고, 이 장학금은 제가 흔들림 없이 공부를 이어가는 데 큰 힘이 될 것입니다.' : ''}`,
      `[나의 강점]\n저의 강점은 ${ans.strength}입니다. 전공 공부와 병행하며 쌓아 온 이 경험은 장학생으로서의 책임을 다하는 밑거름이 될 것이라 확신합니다.`,
      `[마무리]\n선발해 주신다면 학업 성취로 보답하고, 받은 도움을 후배들에게 돌려주는 선순환의 일원이 되겠습니다. 감사합니다.`
    );
  } else if (def.kind === 'plan') {
    paras.push(
      `[학업 계획]\n${knownValue(sch.period) ? knownValue(sch.period) + ' 동안 ' : ''}${ans.goal}. ${gpaTxt ? '현재 ' + gpaTxt + '을 바탕으로 학점 관리도 병행하겠습니다.' : ''}`,
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
        <h3 class="sheet-title">서류 작성</h3>
        <p class="sheet-provider">${esc(sch.name)}${/* 「고른 답으로 초안 문장을 엮습니다」는 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */ ''}</p>
        ${docPrep.defs.map((def, di) => `
          <div class="dp-block">
            <h4>${esc(def.doc)}</h4>
            ${def.questions.map((q) => `
              <div class="field">
                <span class="field-label">${q.label}</span>
                <div class="chip-group dp-q" data-def="${di}" data-q="${q.id}">
                  ${q.options.map((o, oi) => `<button class="chip ${oi === 0 ? 'active' : ''}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
                </div>
              </div>`).join('')}
            <label class="field">
              <span class="field-label">직접 추가할 내용 (선택)</span>
              <textarea class="dp-extra" data-def="${di}" rows="2" placeholder="추가할 문장을 직접 적을 수 있습니다"></textarea>
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
        <h3 class="sheet-title">작성 내용 확인</h3>
        <p class="sheet-provider">${esc(sch.name)} · 내용을 직접 수정할 수 있습니다</p>
        ${docPrep.texts.map((t, i) => `
          <div class="dp-block">
            <h4>${esc(t.doc)}</h4>
            <textarea class="dp-text" data-i="${i}" rows="10">${esc(t.text)}</textarea>
          </div>`).join('')}
        ${certStatusListHtml(sch)}
        <button class="btn btn-primary btn-lg" id="btn-dp-confirm">이대로 신청 준비 완료</button>
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
let formFill = null; // { schId, tplId, stage:'q'|'preview', ans } — tplId 는 startFormFill 이 한 번 정한다

function startFormFill(sch, restore) {
  /* 6-1 (2026-11-21) — 앱 지원문서를 띄울 공고가 아니면 질문 화면을 그리지 않고 원본이 놓인 「신청 준비」 시트로 간다(템플릿 없이 그리면 FORM_TEMPLATES[null] 이라 화면이 멈춘다).
     🔴 쓰던 글이 있으면(restore.ans — 이어보기·히어로 「이어서 쓰기」·「다시 작성」) 그 사이 원본이 생겼어도 쓰던 문서를 그대로 연다 — 이미 쓴 글을 뺏지 않는다(리뷰 2026-11-22).
     🔴 템플릿은 여기서 한 번 정해 formFill.tplId 에 둔다 — 그릴 때마다 다시 고르면, 쓰는 도중에 색인이 도착해 원본이 생긴 순간 다음 그리기가 템플릿을 잃고 멈춘다 */
  const tplId = formTplIdFor(sch, !!(restore && restore.ans));
  if (!tplId) { renderApplyPrep(sch); return; }
  formFill = { schId: sch.id, tplId, stage: 'q', ans: null };
  /* 프로필이 바뀌었을 수 있으니 질문 설계를 다시 짠다 */
  if (typeof formInvalidatePlan === 'function') formInvalidatePlan();
  renderFormFill(restore);
}

/* ── 쓰던 신청서를 적어 둔다 (2026-09-09 · 이어보기 3겹) ─────────────────
   개발자 지시: *"신청서 혹은 앱 내에서 어떠한 작업을 진행 중, 장시간 나갔다가 들어온
   경우 해당 프로그레스가 저장되어 있었으면 해."*

   🔴 **'만들기'를 누를 때 저장하는 것으로는 늦다.** 학생은 아무것도 누르지 않고 나간다
      (증명서를 떼러 가는 것이 이 앱에서 가장 흔한 이탈이다). 그래서 **치는 동안**
      적는다 — 그러지 않으면 크레딧을 낸 AI 초안까지 통째로 사라진다.
   ⚠️ 글자마다 저장하면 긴 자소서에서 버벅인다. 잠깐 멈췄을 때만 적는다(디바운스). */
let formSaveTimer = null;
function formProgressSave(now) {
  if (!formFill || typeof resumeSave !== 'function') return;
  clearTimeout(formSaveTimer);
  const run = () => {
    if (!formFill) return;
    /* 🔴 **질문 화면이 진짜 떠 있을 때만** 모은다. 시트는 하나를 돌려 쓰므로, 다른 내용이
       올라온 뒤에 모으면 칸이 하나도 없어 **빈 답이 좋은 답을 덮는다**(코드 리뷰). */
    if (formFill.stage === 'q' && !$('#btn-ff-generate')) return;
    const sch = findSch(formFill.schId);
    const tplId = sch && formFill.tplId;   // 시작할 때 정한 그 문서(startFormFill) — 다시 고르지 않는다
    const tpl = tplId && FORM_TEMPLATES[tplId];
    if (!tpl) return;
    /* 미리보기 단계에서는 화면에 질문 칸이 없다 — 그때는 이미 모아 둔 답을 그대로 적는다 */
    const ans = formFill.stage === 'q' ? collectFormAnswers(tpl) : formFill.ans;
    if (!ans) return;
    resumeSave({
      sheet: { kind: 'form', id: formFill.schId },
      form: { schId: formFill.schId, tplId: tplId, stage: formFill.stage, ans: ans, at: Date.now() },
    });
  };
  if (now) run(); else formSaveTimer = setTimeout(run, 700);
}

/* 다 썼다 — 쓰던 것 표시를 지운다 (이제 신청내역에 정식으로 들어갔다) */
function formProgressClear() {
  clearTimeout(formSaveTimer);
  if (typeof resumeSave === 'function') resumeSave({ form: null, sheet: null });
}

function renderFormFill(restore) {
  const sch = findSch(formFill.schId);
  const tpl = FORM_TEMPLATES[formFill.tplId];   // 시작할 때 정한 그 문서(startFormFill)
  const sheet = $('#detail-sheet');

  if (formFill.stage === 'q') {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">${tpl.unofficial ? '지원문서 작성' : '양식 작성'}</h3>
        ${/* 양식 이름의 깨진 점(`수집․이용․제3자` — 한글 문서의 가운뎃점 글자)은 보통 가운뎃점으로(2026-10-15) · 뒤의 설명 문장은 뺐다 */ ''}
        <p class="sheet-provider">${esc(tidyChars(tpl.title))}${tpl.unofficial ? ` · ${esc(tpl.lead || '이 공고에 맞춘 지원문서')}` : ''}</p>
        ${tpl.unofficial ? prepOriginalsHtml(sch) : ''}
        ${formQuestionsHtml(tpl)}
        ${typeof essayButtonHtml === 'function' ? essayButtonHtml(tpl) : ''}
        <button class="btn btn-primary btn-lg" id="btn-ff-generate">양식 문서 만들기</button>
        ${/* '이미 아는 정보는 묻지 않고 자동으로 채웁니다 — 위 …에서 확인' 줄을 뺐다(2026-10-15) — 그 '위 항목'이 없는 양식에서도 떠 있었고, 있을 땐 그 접힘 제목이 이미 같은 말을 한다 */ ''}
      </div>`;
    /* 잠깐 나갔다 온 학생의 답을 그대로 되돌려 넣는다 (AI 초안도 같은 칸에 있어 함께 온다).
       🔴 `essayBind` **앞에** 둔다 — 뒤에 두면 초안 도우미가 이미 읽어 간 값과 어긋난다. */
    if (restore && restore.ans && typeof fillFormAnswers === 'function') {
      const n = fillFormAnswers(tpl, restore.ans);
      /* 되살렸다고 말하는 것은 **앱을 다시 열었을 때뿐**이다. '질문 다시 보기'로 돌아온
         학생에게는 당연한 일이라 알릴 것이 없다(quiet). */
      if (n && !restore.quiet) toast('쓰던 신청서를 그대로 불러왔어요');
    }
    /* AI 초안 버튼 — essay-config.js 의 endpoint 가 비어 있으면 버튼 자체가 없다 */
    if (typeof essayBind === 'function') essayBind(tpl, sch);
    if (tpl.unofficial && typeof attachFormFillButtons === 'function') attachFormFillButtons(sch, sheet);   // 신청서 PDF 줄 밑 「양식 채우기」(formfill.js)
    /* 들어온 순간에도 한 번 적는다 — 자동으로 채운 값부터 남는다.
       치는 동안의 저장은 bindEvents 의 **위임 리스너 하나**가 맡는다:
       여기서 걸면 단계를 오갈 때마다 리스너가 쌓인다(시트는 innerHTML 만 갈린다). */
    formProgressSave(true);
    $('#btn-ff-generate').addEventListener('click', (e) => {
      /* 제출 전 점검(1순위) — 그대로 내면 사고가 나는 것(빈칸 [ ]·블라인드에 학교명)이
         있으면 한 번 세운다. 막지 않는다 — 다시 누르면 진행된다(이 앱의 방식). */
      if (typeof essaySubmitReadiness === 'function') {
        const chk = essaySubmitReadiness(tpl, sch);
        const gen = e.currentTarget;
        /* 🔴 '한 번 봤다'를 무엇에 대해 봤는지까지 기억한다 (2026-08-29 코드 리뷰 지적).
           예전에는 `forced` 를 한 번 켜면 영영 안 껐다 — 그래서 학생이 그 뒤에 AI 초안을
           새로 받아 `[봉사 기관명]` 이 **새로 생겨도** 관문이 두 번째부터는 아무 말 없이
           통과시켰다. 막을 것이 달라지면 다시 한 번 세운다(같은 것이면 그대로 진행). */
        const sig = (chk && chk.items || []).filter((i) => i.status === 'block')
          .map((i) => `${i.id}:${i.detail}`).join('|');
        if (chk && !chk.submittable && gen.dataset.forced !== sig) {
          gen.dataset.forced = sig;
          if (typeof essayRenderSubmitCheck === 'function') essayRenderSubmitCheck(tpl, sch);
          const panel = $('#essay-submit-check');
          if (panel) panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
          toast('먼저 고칠 곳이 있습니다 — 위 점검표를 확인해 주세요 (다시 누르면 그대로 진행됩니다)');
          return;
        }
      }
      formFill.ans = collectFormAnswers(tpl);
      /* '다음 신청서에도 쓸게요'를 켜 둔 항목은 프로필에 남긴다 —
         두 번째 신청서부터는 그 질문이 아예 안 나온다 (기기 안에만 저장) */
      const kept = typeof formKeepToProfile === 'function' ? formKeepToProfile() : 0;
      if (kept) { saveState(); if (typeof formInvalidatePlan === 'function') formInvalidatePlan(); }
      formFill.stage = 'preview';
      renderFormFill();
      formProgressSave(true);   /* 미리보기로 넘어간 것도 진행분이다 */
    });
    /* 🔴 맨 위부터 (2026-10-13 · verify-apply-prep 이 잡았다). 상세 시트에서 「신청 준비 시작」을 누르면 버튼까지 내려간
       스크롤이 그대로 남아 질문 화면이 **중간부터** 보였고, 그 상태에선 아래로 쓸어 닫기도 안 됐다(scrollableAtTop). */
    sheet.scrollTop = 0;
  } else {
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-body">
        <h3 class="sheet-title">작성 내용 확인</h3>
        <p class="sheet-provider">칸을 눌러 직접 고칠 수 있어요${tpl.unofficial ? ' · ' + esc(tpl.lead || '이 공고에 맞춘 지원문서') : ''}${/* 「실제 공고 양식과 동일한 구조」는 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */ ''}</p>
        <div class="fd-wrap" id="ff-doc">${renderFormDoc(tpl, state.profile, formFill.ans, { editable: true })}</div>
        <button class="btn btn-primary btn-lg" id="btn-ff-confirm">이대로 신청 준비 완료</button>
        <div class="submit-actions" style="margin-top:8px">
          <button class="btn btn-outline" id="btn-ff-back">질문 다시 보기</button>
          <button class="btn btn-outline" id="btn-ff-doc">.doc 저장</button>
        </div>
      </div>`;
    /* 🔴 '질문 다시 보기'는 **쓴 답을 들고 돌아가야 한다** (2026-09-09 코드 리뷰).
       질문 화면을 새로 그리므로 칸이 전부 비는데, 예전에는 그대로 두어 학생이 다시 쳐야 했고,
       이제는 그 빈 화면이 곧바로 장부에 적혀 **좋은 답을 빈 값으로 덮기까지** 한다. */
    $('#btn-ff-back').addEventListener('click', () => {
      formFill.stage = 'q';
      renderFormFill({ ans: formFill.ans, quiet: true });
    });
    $('#btn-ff-doc').addEventListener('click', () => downloadFormDoc(tpl, state.profile, formFill.ans));
    $('#btn-ff-confirm').addEventListener('click', () => {
      const existing = state.applications.find((a) => a.id === sch.id);
      if (existing) { existing.pending = false; existing.formAns = formFill.ans; existing.appliedAt = nowStamp(); }
      else state.applications.push({ id: sch.id, name: sch.name, appliedAt: nowStamp(), step: 0, formAns: formFill.ans, pending: false, prep: {} });
    if (typeof trackUse === 'function') trackUse('prep', sch.id);
      saveState();
      const ch = officialChannel(sch);
      /* 문서의 성격대로 말한다 (리뷰 2026-10-13) — 모르는 공고에 '양식·입력 칸이 있다'고 단정하지 않는다 */
      toast(!tpl.unofficial || tpl.prepKind === 'free'
        ? `양식 작성 완료 · 문서를 저장해 ${ch.label}에 제출하세요`
        : tpl.prepKind === 'unknown'
          ? `지원문서 작성 완료 · 내용을 ${ch.label}의 접수 방법에 맞춰 옮겨 제출하세요`
          : `지원문서 작성 완료 · 내용을 ${ch.label}의 양식·입력 칸에 옮겨 제출하세요`);
      formFill = null;
      formProgressClear();   /* 신청내역에 정식으로 들어갔으니 '쓰던 것' 표시를 지운다 */
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
   (그 학교 첫 수집 전) 배포가 엇갈린 순간에도 화면이 비지 않게.
   🔴 **다만 '알 수 있을 때'는 받지 않는다** (2026-09-26 · 고문 보고서). 수집망은 두 곳뿐이고
      온보딩은 213개교를 고를 수 있어, **대다수 학생이 그 물러나는 길로 들어가 옛 파일을
      통째로 받고 자기 공고 0건**이었다(실측: 33.5KB 받아 0건 · 수집 40곳이면 670KB).
      그래서 색인(400바이트)을 나란히 받아 "네 파일은 없다"면 옛 파일을 받지 않는다.
      판정은 `noticeFallbackNeeded` 한 곳 — 알림(sw.js)도 같은 함수를 쓴다. */
/* 🔴 늦게 온 데이터로 **보이는 화면을 다시 그린다** (2026-09-01).
   예전에는 loadRegistered 만 홈을 다시 그리고 loadKosaf·loadNotices 는 탐색만 그렸다.
   그래서 한국장학재단 공고가 뒤늦게 들어오면 홈의 '마감 임박'이 그 전에 계산한
   순서로 굳어, D-DAY 공고가 있는데도 D-2 부터 보였다.
   ⚠️ 새로 데이터를 불러오는 곳을 만들면 여기를 부를 것 — 갈라 두면 또 한 곳만 고치게 된다. */
/* 🔴 **학교가 정해지거나 바뀌면 공고 파일을 다시 받는다** (2026-09-26).
   공고는 학교별 파일에서 오므로 학교가 바뀌면 받아 둔 파일이 남의 학교 것이 된다.
   그전까지 `loadNotices()` 는 **앱을 열 때 한 번**과 당겨서 새로고침에서만 돌았다 —
   그래서 ①첫 실행 학생은 프로필이 생겨도 공고를 다시 받지 않았고(그때는 옛 파일을
   통째로 받아 두어 우연히 가려졌다) ②MY 에서 **학교를 바꾸면** 실시간 공고가 조용히
   비어 보였다(받아 둔 것이 전부 남의 학교 것이라 필터에서 다 떨어진다).
   ⚠️ 같은 학교면 다시 받지 않는다 — 프로필을 고칠 때마다 네트워크를 두드릴 이유가 없다. */
function loadNoticesIfSchoolChanged() {
  const key = (typeof noticeFilesForProfile === 'function' && state.profile)
    ? noticeFilesForProfile(state.profile).join(',') : '';
  if (key === noticeFilesLoaded) return;
  loadNotices();
}

/* 🔴 **부팅 덮개가 떠 있는 동안에는 다시 그리기를 모았다가 한 번에** (2026-10-04 개발자 지적:
   "시안과 같이 스무스한 트랜지션이 필요한데 지금 현황은 중간에 끊기고 프로페셔널하지 못해").
   실측(폰 정도 CPU · 4배 느리게): 앱을 열면 데이터 파일 일곱 개가 하나씩 도착할 때마다 홈을 통째로
   다시 그렸다 — 한 번에 0.4~1.8초, 다 합쳐 6초. 그 사이 인트로(선 긋기)가 1.6초씩 멈췄다.
   덮개 밑이라 학생은 그 중간 그림을 볼 일이 없다 → 모았다가 다 도착하면 한 번만 그린다(`bootHoldRelease`).
   덮개가 걷힌 뒤(`boot:gone`)에는 무조건 풀린다 — 늦게 온 데이터가 영영 안 그려지는 일은 없다. */
let bootHold = true;
let bootHeld = false;
function bootHoldRelease() {
  if (!bootHold) return;
  bootHold = false;
  if (bootHeld) { bootHeld = false; rerenderVisible(); }
}
window.addEventListener('boot:gone', bootHoldRelease);

/* @@ 실시간 공고 구역(공고 파일 받기·학과·등록금·원문 링크·층2·학교 사진)은 app-live.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* @@ 대외활동·공모전 탭(목록·관심 관문·분야 칩·상세)은 app-activities.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */
/* ---------------- 재단·지자체 새 공고 (2026-09-26 · 노션 F-13 · 교외 확대) ----------------
   재단·지자체 홈페이지의 장학 게시판에서 로봇이 주운 **제목+링크**(data/external.json). 학교 글이 아니라
   '우리 학교 게시판 공고'에는 못 들어간다(그 판정은 학교를 요구한다). 주최(host)는 로봇 설정에서 온
   것이라 카드 윗줄에 적는다 — 제목으로 짐작한 것이 아니다. 자격·적합도·양식은 없다(원칙 8-1).
   같은 카드 그림(noticeCardHtml)을 쓴다. 정식 등록된 공고(같은 주소)는 카드가 따로 있으니 뺀다.
   🔴 받아오기 실패는 빈 문서로 내려앉힌다 · 새 데이터가 오면 rerenderVisible (loadNotices 와 같은 규칙). */
let liveExternal = null;

function loadExternal() {
  return fetch('data/external.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => {
      tidyData(d);   // 깨진 글자 씻기(2026-11-17)
      liveExternal = d || liveExternal || { items: [], updatedAt: null };
      rerenderVisible();
    });
}

function externalNoticesForMe() {
  const p = state.profile;
  if (!p || !liveExternal) return [];
  const isRegistered = registeredUrlMatcher();
  return (liveExternal.items || [])
    .filter((n) => n && n.url && n.host && !n.school && !isRegistered(n.url))
    .sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
}

/* 글이 없으면 빈 문자열 — 홈에 '없어요' 구역을 하나 더 만들지 않는다(학교 게시판 구역이 이미 그 말을 한다) */
/* 🔴 **몇 장만 펴 두고 '더보기'로 편다** (2026-10-01 개발자 지시 — "나에게 맞는 장학금처럼").
   재단·지자체 글이 156건이라 홈이 끝없이 길어졌다. 처음엔 '나에게 맞는 장학금'과 같은 석 장
   (`HOME_DEADLINE_TOP`)만 보이고, 더보기를 누를 때마다 `HOME_DEADLINE_MORE`(10)장씩 더 편다.
   ⚠️ '나에게 맞는 장학금'은 10장 너머를 '전체 보기'(장학금 찾기)가 맡지만, 이 글들은 **따로 볼
      화면이 없다** — 그래서 10장에서 멈추지 않고 끝까지 편다(멈추면 나머지 글이 앱에서 사라진다).
   다 펴면 '접기'. 누를 때 이 구역만 다시 그린다(renderHome 을 부르면 히어로 금액이 또 세어 올라간다). */
let externalShown = HOME_DEADLINE_TOP;
/* 홈 「나에게 맞는 대외활동·공모전」 (2026-10-04 개발자 지시 — 장학금 구역 바로 밑).
   🔴 판정·차례를 새로 만들지 않는다 — 글 고르기는 대외활동 탭과 같은 activitiesForMe · activityFit,
      차례는 장학 홈과 같은 fitRank(미달·미확인은 아래) → homeScore(적합도 − 남은 날). 미달은 아예 싣지 않는다(장학 홈과 같다).
   관심(프로필 interestKinds·interestFields · 같은 날 추가)은 **같은 판정 단계 안에서만** 앞으로 — 관심이 자격을 이기지 않는다. */
const HOME_ACT_TOP = 3;
function homeActivitiesHtml() {
  if (!liveActivities || !state.profile) return '';   // 아직 오는 중 — '없다'고 말하지 않는다
  const p = state.profile;
  /* 관문을 안 지났으면 추천 대신 관문으로 가는 단추 하나 (2026-10-24 지시 4 — 관련 기능 전부가 관문 뒤에 있다) */
  if (!activityGateDone(p)) {
    return `<div class="section-head"><h3>나에게 맞는 대외활동·공모전</h3></div>`
      + `<button type="button" class="btn btn-ghost btn-empty act-gate-cta" data-go="activities">관심 종류를 고르면 추천이 시작돼요</button>`;
  }
  const likes = (n) => ((p.interestFields || []).includes(n.field) ? 2 : 0) + ((p.interestKinds || []).includes(n.kind) ? 1 : 0);
  const ms = activitiesForMe()
    .filter((n) => !n.deadline || dday(n.deadline).days >= 0)
    .map((n) => ({ ...activityFit(n), n }))
    .filter((m) => fitVerdict(m.fit, m.fd) !== 'no')
    .sort((a, b) => fitRank(a) - fitRank(b) || likes(b.n) - likes(a.n) || homeScore(b) - homeScore(a) || byDeadline(a, b))
    .slice(0, HOME_ACT_TOP);
  if (!ms.length) return '';
  return `<div class="section-head"><h3>나에게 맞는 대외활동·공모전</h3><button type="button" class="link-btn" data-go="activities">전체 보기</button></div>`
    + `<div class="card-list" id="home-activity-list">${ms.map((m) => activityCardHtml(m.n)).join('')}</div>`;
}

function externalNoticesHtml() {
  const mine = externalNoticesForMe();
  if (!mine.length) return '';
  const shown = Math.min(externalShown, mine.length);
  const more = mine.length > HOME_DEADLINE_TOP
    ? `<button type="button" class="link-btn home-more" id="external-more" data-external-more
         aria-expanded="${shown >= mine.length ? 'true' : 'false'}">${shown >= mine.length ? '접기' : '더보기'}</button>`
    : '';
  return `<div class="section-head" style="margin-top:4px"><h3>재단·지자체 새 공고</h3></div>`
    + `<div class="card-list" id="external-list">`
    + mine.slice(0, shown).map((n) => noticeCardHtml(n, { org: n.host, dday: n.deadline ? { label: ddayWords(dday(n.deadline)), urgent: dday(n.deadline).days >= 0 && dday(n.deadline).days <= 7 } : null })).join('')
    + `</div>${more}<div style="margin-bottom:18px"></div>`;
}

/* ---------------- 교내 소식 (2026-09-30 · 개발자 지시 "사용자들 학교에 맞춘 교내 뉴스를 앱 내에 추가") ----------------
   로봇(collector/collect-news.mjs)이 학교 공지 게시판에서 주운 **제목+링크+수집일**을 학교별 파일(data/news/<학교키>.json)로 싣는다.
   장학 피드(notices)·대외활동(activities)과 파일을 섞지 않는다 — 알림이 공지로 울지 않고, 학생은 제 학교 파일 하나만 받는다.
   🔴 옛 통짜 파일로 물러나는 길이 **없다** — 파일이 없으면(404) 빈 목록이고 구역은 '없어요' 한 줄을 보인다(뼈대로 굳지 않는다).
   판정·파일 이름은 match-engine.js 한 곳(newsFilesForProfile · 내 글인가는 noticeForProfile — 공고와 같은 잣대).
   카드는 noticeCardHtml **한 벌**(윗줄만 '학교 공지 · 갈래'). 자격·적합도·마감은 없다 — 원문을 읽지 않은 것을 판정하지 않는다(원칙 8-1). */
let liveNews = null;
let newsFilesLoaded = null;   // 마지막으로 **성공적으로** 받은 파일 목록 (loadNotices 와 같은 규칙 — 받기 전에 적지 않는다)
let newsFilesWanted = '';
const NEWS_STRIP_N = 4;       // 홈 첫 화면 띠에 놓는 장 수 (2026-10-04 승인 시안 1안 · 네 장) · 나머지는 「전체 보기」 시트

function loadNews() {
  const p = state.profile;
  const files = (typeof newsFilesForProfile === 'function' && p) ? newsFilesForProfile(p) : [];
  const wanted = files.join(',');
  newsFilesWanted = wanted;
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => tidyData(d)).catch(() => null);   // 깨진 글자 씻기(2026-11-17)
  /* 학교 대표 사진 목록 — 소식을 받을 때 한 번(작은 파일 · 실패하면 다음 받기 때 다시). 소식보다 늦게 와도 다시 그린다 */
  if (files.length && !schoolPhotos) get('assets/schools/photos.json').then((d) => { if (d && d.schools && !schoolPhotos) { schoolPhotos = d; if (liveNews) rerenderVisible(); } });
  const job = files.length
    ? Promise.all(files.map(get)).then((docs) => {
      const ok = docs.filter(Boolean);
      return { updatedAt: ok.map((d) => d.updatedAt).filter(Boolean).sort().pop() || null, items: ok.flatMap((d) => d.items || []) };
    })
    : Promise.resolve({ items: [], updatedAt: null });   // 프로필이 없으면 아무것도 받지 않는다 — 학교가 정해지면 loadNewsIfSchoolChanged 가 받는다
  return job.catch(() => null).then((d) => {
    if (newsFilesWanted !== wanted) return liveNews;   // 늦게 온 옛 학교 것은 버린다 (loadNotices 와 같은 규칙)
    newsFilesLoaded = d ? wanted : null;
    liveNews = d || liveNews || { items: [], updatedAt: null };   // 못 받아 왔어도 빈 문서 — 뼈대가 굳지 않게
    rerenderVisible();
  });
}

/* 학교가 정해지거나 바뀌면 그 학교 소식 파일을 받는다 — loadNoticesIfSchoolChanged 와 **같은 자리에서 같이** 부른다(관문이 짝을 센다) */
function loadNewsIfSchoolChanged() {
  const key = (typeof newsFilesForProfile === 'function' && state.profile) ? newsFilesForProfile(state.profile).join(',') : '';
  if (key === newsFilesLoaded) return;
  loadNews();
}

function schoolNewsForMe() {
  const p = state.profile;
  if (!p || !liveNews) return [];
  return (liveNews.items || [])
    .filter((n) => n && n.url && n.title && !n.hidden && noticeForProfile(n, p))
    /* 게시판 줄에 적힌 게시일(postedAt)이 있으면 그것으로, 없으면 수집일로 — 최근 것이 앞 */
    .sort((a, b) => String(b.postedAt || b.foundAt || '').localeCompare(String(a.postedAt || a.foundAt || '')));
}

/* 「우리 학교 소식」 전부 — 홈 띠의 「전체 보기」 시트 안 목록 (2026-10-04 · 옛 홈 아래 구역의 카드 그대로).
   글의 사진이 없는 카드는 학교 대표 사진(차례대로 돌려 이웃끼리 다른 사진). 🔴 사진 출처 줄은 여기 두지 않는다 —
   개발자 지시(10-03 "학교 사진에 대한 설명은 사용자가 읽지 않는 happy talk 이므로 빼")로 설정 › 앱 권한 · 오픈소스 라이선스 의 「사진 출처」로 옮겼다(renderPerms). */
function schoolNewsHtml() {
  const mine = schoolNewsForMe();
  if (!mine.length) return `<p class="empty">아직 새 소식이 없어요</p>`;
  const turn = {};
  return `<div class="card-list">${mine.map((n) => {
    const sp = n.thumb && NEWS_THUMB_RE.test(n.thumb) ? null : schoolPhotoFor(n, turn[n.school] = (turn[n.school] ?? -1) + 1);
    return noticeCardHtml(n, { org: `${n.school} 공지${n.kind ? ' · ' + n.kind : ''}`, excerpts: n.postedAt ? [{ label: '게시', text: n.postedAt }] : [], thumb: n.thumb, schoolPhoto: sp, desc: n.desc });
  }).join('')}</div>`;
}

/* 날짜 짧게 — 띠 카드 윗줄의 'MM.DD' (게시일, 없으면 수집일) */
const newsDay = (n) => { const m = String(n.postedAt || n.foundAt || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${m[1]}.${m[2]}` : ''; };

/* 홈 첫 화면 「우리 학교 소식」 띠 (2026-10-04 개발자 승인 시안 1안 「사진 카드 띠」).
   최근 NEWS_STRIP_N 장 — 사진(위) · 갈래·날짜(작은 회색) · 제목 두 줄. 누르면 그 글의 원문(카드와 같은 safeUrl).
   사진은 글의 사진 → 없으면 학교 대표 사진(차례대로) → 둘 다 없으면 바탕색 칸(사진을 지어내지 않는다).
   글의 사진을 못 받으면 학교 사진으로 갈아 끼운다(data-fallback · bindEvents 의 error 잡이).
   받는 중엔 뼈대 세 장 · 소식이 없으면 '' (구역째 숨긴다 — 첫 화면에 빈 안내를 두지 않는다). */
function homeNewsHtml() {
  const p = state.profile;
  if (!p) return '';
  /* 🔴 제목 옆 「오늘 n」 알약은 없앴다(2026-11-21 개발자 지시 — 'AI 티가 나고 학생이 읽지 않는 글자'). 날짜는 카드마다 적혀 있다. 되살리지 말 것 */
  const head = (all) => `<div class="section-head home-news-head"><h3>우리 학교 소식</h3>${all ? '<button type="button" class="link-btn home-news-all" data-news-all>전체 보기</button>' : ''}</div>`;
  if (!liveNews) return head(false) + `<div class="news-strip" aria-busy="true">${'<span class="news-tile is-skel"><span class="news-tile-photo"></span><span class="news-tile-meta">&nbsp;</span><span class="news-tile-title">&nbsp;</span></span>'.repeat(3)}</div>`;
  const mine = schoolNewsForMe();
  if (!mine.length) return '';
  const turn = {};
  const tiles = mine.slice(0, NEWS_STRIP_N).map((n) => {
    const own = n.thumb && NEWS_THUMB_RE.test(n.thumb) ? n.thumb : '';
    /* 차례는 모든 카드가 센다 — 글의 사진이 깨져 학교 사진으로 바뀐 카드가 이웃과 같은 사진이 되지 않게(리뷰 10-04) */
    const sp = schoolPhotoFor(n, turn[n.school] = (turn[n.school] ?? -1) + 1);
    const spFocus = sp && PHOTO_FOCUS_RE.test(sp.focus || '') ? sp.focus : '';
    const src = own || (sp && sp.src) || '';
    const focus = own ? '' : spFocus;
    const fallback = own && sp && SCHOOL_PHOTO_RE.test(sp.src || '') ? sp.src : '';
    /* 링크 이름은 sourceLink 한 곳 — 글 화면이 아닌 링크(목록 표식 등)면 윗줄에 그 이름을 붙인다(시트 카드와 같은 말 · 리뷰 10-04) ·
       주소도 같은 link 에서(바로잡은 원문이 있으면 그 주소 · 원문 바로잡기 리뷰 10-04) */
    const link = sourceLink(n, 'card');
    const href = safeUrl(link.href);
    const meta = [n.kind, newsDay(n), link.cls !== 'post' && link.label ? link.label : ''].filter(Boolean).join(' · ');
    return `<a class="news-tile"${href ? ` href="${esc(href)}" target="_blank" rel="noopener"` : ''}>
      <span class="news-tile-photo">${src ? `<img class="news-tile-img" src="${esc(src)}" alt="" loading="lazy" decoding="async" width="148" height="104"${focus ? ` style="object-position:${esc(focus)}"` : ''}${fallback ? ` data-fallback="${esc(fallback)}"${spFocus ? ` data-fallback-focus="${esc(spFocus)}"` : ''}` : ''} />` : ''}</span>
      <span class="news-tile-meta">${esc(meta)}</span>
      <span class="news-tile-title">${esc(stripBoardHead(unent(n.title), n.url))}</span>
      ${/* 요약 — 로봇이 원문 첫 문장을 떠 둔 글만(collector/collect-news-desc.mjs · 2026-10-10 업무 분장 8번). 없으면 줄을 안 그린다 */ ''}
      ${n.desc ? `<span class="news-tile-desc">${esc(unent(n.desc))}</span>` : ''}
    </a>`;
  }).join('');
  return head(true) + `<div class="news-strip">${tiles}</div>`;
}

/* 「전체 보기」 — 학교 소식 전부를 시트로 (시트 그릇은 #detail-sheet 하나 · openSheetShell) */
function openNewsSheet() {
  const p = state.profile;
  if (!p) return;
  sheetBack = null;   // 돌아갈 곳이 없다 — 내리면 닫힌다
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">우리 학교 소식</h3>
      ${/* 부제 「○○ 공지 게시판」은 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */ ''}
      ${schoolNewsHtml()}
    </div>`;
  openSheetShell();
}

/* ---------------- 제출: 복사 · 파일 공유 ---------------- */
function buildSubmissionText(sch, app) {
  const p = state.profile;
  const parts = [`[${sch.name} 지원서류]`, personLine(p)];
  if (app && app.docs) app.docs.forEach((t) => parts.push(`\n■ ${t.doc}\n${t.text}`));
  return parts.join('\n');
}

function copyText(text, okMsg) {
  const done = () => toast(okMsg || '복사했어요 · 신청 페이지에 붙여 넣으세요');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('복사 실패'); }
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
      /* 뒤 절 「메일 앱에서 바로 접수 가능」은 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */
      toast('서류와 함께 공유했어요');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `${sch.name} 신청 서류`, text });
      toast('내용을 공유했어요 · 파일은 보관함에서 따로 첨부해 주세요');
      return;
    }
  } catch (e) { /* 사용자가 공유를 취소한 경우 */ return; }
  copyText(text);
}

/* @@ 신청 준비(일괄 준비·신청 준비 시트·제출처 안내)은 app-prep.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* @@ 상세 시트(공고 상세·자격 묻기·시트 되돌아가기)은 app-sheet.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* @@ 신청 내역 화면은 app-applications.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* 상세 시트에 접수 시작일·발표일을 한 줄로 (개발자 지시 4-1).
   🔴 **원문에서 읽은 것만** 적는다. 없으면 그 자리를 비운다 — 발표일을 짐작해 적으면
      학생이 그날 결과를 보러 갔다가 아무것도 없다(원칙 8-1). */
/* @@ MY 화면(보관함·설정·자주 묻는 질문·고객센터·약관·휴지통)은 app-my.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* ---------------- 입력 안전장치 (2026-11-17 · HDJ-요청-2026-001 후속) ----------------
   규칙(범위·글자 종류)은 input-guard.js 한 곳이다. 여기는 그 규칙을 **칸에 거는 배선**만 한다.
   · data-guard="gpa|credits|birthYear"   — PROFILE_LIMITS 의 범위
   · data-guard-min/max/dec               — PROFILE_LIMITS 에 없는 숫자 칸
   · data-guard-kind="studentId|phone|date|account" — 글자 종류만
   🔴 위임 하나로 건다 — 공고 시트·대외활동 관문 칸은 나중에 그려지므로 칸마다 걸면 새 칸이 빠진다. */
function guardLimitOf(el) {
  const key = el.dataset.guard;
  if (key && typeof PROFILE_LIMITS !== 'undefined' && PROFILE_LIMITS[key]) return PROFILE_LIMITS[key];
  if (el.dataset.guardMin != null) {
    const lab = el.closest('label') && el.closest('label').querySelector('span');
    return { min: Number(el.dataset.guardMin), max: Number(el.dataset.guardMax), decimals: Number(el.dataset.guardDec || 0),
      label: lab ? lab.textContent.trim() : '이 칸', unit: '' };
  }
  return null;
}
const guardLast = new WeakMap();   // 칸마다 마지막으로 받아 준 글자 — 막을 때 이 글자로 되돌린다
let guardHintAt = 0;
function guardTextOk(el, text) {
  const lim = guardLimitOf(el);
  if (lim) return guardText(text, lim);
  if (el.dataset.guardKind) return guardKind(text, el.dataset.guardKind);
  return true;
}
const GUARD_KIND_MSG = {
  studentId: '학번은 숫자·영문만 적을 수 있어요',
  phone: '휴대폰 번호는 숫자와 - 만 적을 수 있어요',
  date: '생년월일은 숫자로 적어 주세요 (예: 2005.03.14)',
  account: '계좌번호는 숫자와 - 만 적을 수 있어요',
};
function guardHint(el) {
  el.classList.add('guard-bad');
  clearTimeout(el._guardT);
  el._guardT = setTimeout(() => el.classList.remove('guard-bad'), 900);
  const now = Date.now();
  if (now - guardHintAt < 1500) return;   // 연달아 친 글자마다 알림을 띄우지 않는다
  guardHintAt = now;
  const lim = guardLimitOf(el);
  toast(lim ? `${lim.label}은(는) ${lim.min}~${lim.max}${lim.unit || ''} 사이만 적을 수 있어요`
    : (GUARD_KIND_MSG[el.dataset.guardKind] || '적을 수 없는 글자예요'));
}
function bindInputGuards() {
  const isGuarded = (el) => !!(el && el.matches && el.matches('input[data-guard], input[data-guard-min], input[data-guard-kind]'));
  /* 칸에 들어갈 때 지금 글자를 '받아 준 글자'로 적는다 — 코드가 채운 값(저장된 프로필)도 여기서 잡힌다 */
  document.addEventListener('focusin', (e) => { if (isGuarded(e.target)) guardLast.set(e.target, e.target.value); }, true);
  /* 친 뒤 — 받을 수 없는 글자면 직전 글자로 되돌린다. 붙여넣기·자동완성도 전부 여기를 지난다 */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!isGuarded(el) || e.isComposing) return;
    if (guardTextOk(el, el.value)) { guardLast.set(el, el.value); return; }
    const prev = guardLast.has(el) ? guardLast.get(el) : '';
    /* 🔴 직전 글자부터 이미 규칙 밖이면(안전장치 전에 저장된 '2005년 3월 14일' 같은 값) **지우는 쪽은 받아 준다** —
       안 받으면 한 글자 치는 순간 칸이 통째로 비거나, 고칠 길 없이 갇힌다. 덧붙이는 것만 막는다. */
    if (!guardTextOk(el, prev) && el.value.length < prev.length) { guardLast.set(el, el.value); return; }
    const pos = Math.max(0, (el.selectionStart || 0) - (el.value.length - prev.length));
    el.value = prev;
    try { el.setSelectionRange(pos, pos); } catch (err) { /* 선택 범위를 못 쓰는 칸 */ }
    guardHint(el);
  }, true);
  /* 한글 입력이 끝나는 순간 한 번 더 — 조합 중에는 위에서 건너뛰었다 */
  document.addEventListener('compositionend', (e) => {
    const el = e.target;
    if (!isGuarded(el) || guardTextOk(el, el.value)) return;
    const prev = guardLast.has(el) ? guardLast.get(el) : '';
    if (!guardTextOk(el, prev) && el.value.length < prev.length) { guardLast.set(el, el.value); return; }   // 위와 같은 규칙
    el.value = prev;
    guardHint(el);
  }, true);
}
/* 넘길 때 — 이 범위 안 칸 중 **다 쳤는데 범위 밖**이거나 있을 수 없는 날짜인 첫 칸 */
function guardFirstBad(root) {
  if (!root) return null;
  /* 🔴 `$$` 는 범위(root)를 안 받는다 — 화면 전체를 뒤지면 다른 단계의 칸에 걸린다 */
  for (const el of Array.from(root.querySelectorAll('input[data-guard], input[data-guard-min], input[data-guard-kind="date"]'))) {
    const lim = guardLimitOf(el);
    const r = lim ? checkNumber(el.value, lim) : checkBirthDate(el.value);
    if (!r.ok) return { el, msg: r.msg };
  }
  return null;
}
function guardShowBad(bad) {
  bad.el.classList.add('guard-bad');
  clearTimeout(bad.el._guardT);
  bad.el._guardT = setTimeout(() => bad.el.classList.remove('guard-bad'), 1800);
  try { bad.el.focus(); } catch (e) { /* 숨은 칸 */ }
  toast(bad.msg);
}
function guardStepOk(root) {
  const bad = guardFirstBad(root);
  if (bad) { guardShowBad(bad); return false; }
  return true;
}

/* @@ 이벤트 연결(버튼·화면 전환·입력 묶기)은 app-events.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

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
  refreshAllData();
});

/* 🔴 문서가 밀려 있으면 제자리로 (2026-10-04 · 짝은 style.css `.app` 머리말 · interactions.js ⓪).
   문서는 굴러가지 않게 막았지만, 아이폰은 입력 칸을 키보드 위로 보이려고 문서 자체를 밀어 올릴
   수 있다 — 그 채로 키보드가 닫히면 하단 탭이 또 중간에 남는다(iOS 26 의 그 버그).
   키보드가 닫히는 순간(화면 높이가 돌아올 때)과 입력 칸에서 손을 뗄 때 문서를 0 으로 되돌린다.
   ⚠️ 입력 중에는 건드리지 않는다 — 그때 되돌리면 입력 칸이 키보드 밑으로 숨는다. */
(function keepDocumentStill() {
  const reset = () => {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    const se = document.scrollingElement || document.documentElement;
    if (se.scrollTop || se.scrollLeft) window.scrollTo(0, 0);
  };
  if (window.visualViewport) window.visualViewport.addEventListener('resize', reset);
  document.addEventListener('focusout', () => setTimeout(reset, 120));
})();

/* 당겨서 새로고침 (2026-09-09) — 짝은 interactions.js.
   🔴 **시트가 떠 있으면 시작하지 않는다.** 알림 동의 시트는 온보딩 2.9초 뒤에 떠서 화면을
      덮는데, 그 위에서 당기면 시트 뒤 목록이 움직여 보인다. 이 시트는 브라우저 검사를
      세 번 넘어뜨린 자리이기도 하다(2026-09-07 · onboard-helper 의 dismissNotify).
   🔴 **온보딩 중에는 끈다** — 아직 받아올 것이 정해지지 않았고(학교 미선택), 단계 사이에서
      화면이 밀리면 입력하던 칸이 손가락을 따라 움직인다. */
if (typeof installPullToRefresh === 'function') {
  installPullToRefresh({
    onRefresh: () => {
      lastFgRefresh = Date.now();   // 방금 받았으니 화면 복귀 갱신은 5분 쉰다
      return refreshAllData();
    },
    isBlocked: () => {
      if (!state.profile) return true;                        // 온보딩 중
      if (!$('#screen-onboarding').hidden) return true;
      return !!document.querySelector(
        '#notify-sheet:not([hidden]), #detail-sheet:not([hidden]), '
        + '.sheet-backdrop:not([hidden]), .wallet-pop:not([hidden]), #chat-sheet:not([hidden])');
    },
  });
}

/* @@ 로그인·이어쓰기(기기 사이 동기화·MY 계정 카드·로그인 시트)은 app-account.js 로 옮겼다 — 검사는 verify/app-source.cjs 가 이 자리에 다시 끼워 읽는다 @@ */

/* ---------------- 시작 ---------------- */
loadState();
bindEvents();
bindInputGuards();
initOnboarding();
if (scrubbedOnLoad.length) setTimeout(() => toast(`저장돼 있던 ${scrubbedOnLoad.join('·')} 값이 범위를 벗어나 비웠어요 — 내 정보에서 다시 적어 주세요`), 1500);
loadLinkChecks();   // 원문 링크 확인 장부 — 링크를 그리는 목록들보다 먼저 띄운다(작다 · 없어도 조용하다)
/* 처음 받는 데이터 — 다 도착하면(`bootJobs`) 홈을 한 번 그리고 인트로를 돌린다(위 `bootHold` 머리말) */
const bootJobs = [loadNotices(), loadNews(), loadActivities(), loadExternal(), loadRegistered(), loadKosaf()];
/* 🔴 학과 목록은 **여기서 받지 않는다** (2026-09-26) — 209개교가 든 407KB 파일이었고
   쓰는 곳은 온보딩 자동추천 한 곳뿐이다. 학교가 정해질 때 그 학교 파일만 받는다
   (`loadMajorsFor` · 위 주석). */
bootJobs.push(loadTuition());  // 학교별 등록금 — `수업료 100%` 비율형 공고를 원으로 바꾸는 데 쓴다
if (typeof loadFormTemplates === 'function') loadFormTemplates(); // 정식 등록 양식 최신화
bootJobs.push(loadFormsPdfIndex());   // 신청서 원본 PDF 색인 — 첨부 목록의 신청서 PDF 줄(attachPdfRowsHtml)
bootJobs.push(loadDocsPdfIndex());    // 공고문·안내문 PDF 사본 색인 (2026-11-20 · docs/designs/all-docs-pdf.md)
bootJobs.push(loadFormPagesIndex());  // 공고문에서 뗀 서식 쪽 색인 (2026-10-13 ②)
/* 🔴 두 손가락으로 화면이 커졌다 작아졌다 하던 것 (2026-09-01 개발자 지적).
   막는 곳이 셋이라 셋 다 있어야 한다 — 하나만 두면 어떤 폰에서는 그대로 커진다:
     ① index.html 뷰포트 user-scalable=no  (안드로이드 크롬 · 설치형 iOS)
     ② style.css  html { touch-action } (크롬 계열의 손가락 두 개 벌리기)
     ③ 여기 gesture* 차단          (iOS 사파리 — 위 둘을 **무시한다**)
   ⚠️ 이 앱은 폰 화면에 맞춰 짜인 목록이라 확대할 일이 없다. 글자를 키우려면
      폰 설정의 글자 크기를 쓰면 되고 그건 이 차단과 무관하게 그대로 동작한다. */
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => {
  document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
});

/* 🔴 보관함·알림은 **늦게** 준비된다(IndexedDB·권한 확인). 준비되면 지금 보고 있는
   화면을 다시 그려야 빈 칸이 채워진다. 알림 설정은 이제 **설정 화면**에 있으므로
   MY 만 다시 그리면 '알림' 절이 영영 안 나온다 — 두 화면을 함께 본다. */
function refreshOpenScreen() {
  if (!$('#screen-my').hidden) renderMy();
  if (!$('#screen-settings').hidden) renderSettings();
}
bootJobs.push(walletRefresh().then(photoRefresh).then(() => {
  refreshOpenScreen();
  rerenderVisible();   // 홈 왼쪽 위 동그라미의 사진
}));
if (typeof notifyInit === 'function') {
  notifyInit().then(refreshOpenScreen).catch(() => {});
}
/* ── 다시 열었을 때 어디로 갈 것인가 (2026-09-09 · 노션 원문 목록 4번) ────────
   예전에는 프로필이 있으면 **늘 홈**이었다 — 탐색 탭을 보다 잠깐 나갔다 와도 홈이었고,
   브라우저가 이전 화면의 스크롤만 그 홈에 붙여 놓았다(실측 282px).
   지금은 판정을 `resume.js` 한 곳에 두고 그대로 따른다. 설계·경위는
   docs/designs/first-run-and-resume.md, 관문은 verify/verify-resume.js. */
let resumePlan = { screen: 'home', scroll: 0, sheet: null, form: null, onboard: null, resumeCard: null };
if (state.profile) saveState();   // 레거시 키 → 새 키 이관
if (typeof resumeDecide === 'function') {
  resumePlan = resumeDecide({
    saved: typeof resumeLoad === 'function' ? resumeLoad() : null,
    now: Date.now(),
    search: location.search,
    hash: location.hash,
    hasProfile: !!state.profile,
  });
}
/* 알림·로그인 복귀로 열렸으면 이어보기가 손을 뗀다 — 그 흐름이 제 화면을 정한다 */
/* 🔴 약관 화면에서 나가기를 누르면 **떠났던 자리(설정)** 로 되돌아온다 (2026-09-11 개발자 지시:
   "나가면 홈화면으로 이어지는게 아니라 마이페이지로"). terms.html 은 앱 밖의 진짜 페이지라
   돌아올 때 앱이 처음부터 뜨는데, 그때 이어보기는 `?screen=` 이 붙어 있으면 손을 떼고
   (resumeHijacked) 홈으로 보내고 있었다 — 그래서 늘 홈이었다.
   ⚠️ 'settings'·'trash' 는 탭이 아니라서 이어보기 장부가 기억하지 못한다(RESUME_TABS).
      그래서 기억에 기대지 않고 **주소에 적어 보내고** 여기서 그대로 읽는다. */
const backToScreen = (() => {
  try { return new URLSearchParams(location.search).get('screen'); } catch (e) { return null; }
})();
if (resumePlan.skip && state.profile && (backToScreen === 'settings' || backToScreen === 'trash')) {
  showScreen(backToScreen, { back: true });
}
else if (resumePlan.skip) showScreen(state.profile ? 'home' : 'onboarding');
else if (resumePlan.screen === 'onboarding') {
  /* 쓰다 만 온보딩을 되살린다(창과 무관 — 학교·학년을 다시 치게 하지 않는다) */
  if (resumePlan.onboard && onboardRestore(resumePlan.onboard)) toast('쓰다 만 곳부터 이어서 할게요');
  showScreen('onboarding');
} else {
  showScreen(resumePlan.screen, { scroll: resumePlan.scroll });
  /* 보던 시트·쓰던 신청서는 화면이 그려진 **뒤에** 올린다. 공고·양식 데이터가 아직 오는
     중일 수 있어 조금 기다린다 — 못 찾으면 조용히 넘어간다(홈은 이미 떠 있다). */
  if (resumePlan.form || resumePlan.sheet || resumePlan.fill) {
    setTimeout(() => {
      /* 원본 양식 채우기 화면에 있다가 나갔다 돌아왔다 — 그 양식을 다시 연다(칸 값은 state.formFills 에서 · formfill.js) */
      if (resumePlan.fill && typeof resumeOpenFill === 'function' && resumeOpenFill(resumePlan.fill)) return;
      if (resumePlan.form) {
        const sch = findSch(resumePlan.form.schId);
        /* 🔴 마감·자격은 여기서 다시 보지 않는다 — 이미 쓴 글을 뺏지 않는다.
           마감된 공고는 시트 안의 판정이 제 손으로 말한다. */
        /* 다 쓴 신청을 「다시 작성」으로 보던 중이었다면 「쓰던 신청서를 그대로 불러왔어요」 알림은 맞지 않다 — 조용히 연다(리뷰 2026-11-23) */
        const done = (state.applications || []).some((a) => a.id === resumePlan.form.schId && !a.pending);
        if (sch) { openSheetShell(); startFormFill(sch, done ? { ...resumePlan.form, quiet: true } : resumePlan.form); return; }
      }
      /* 🔴 공고 상세는 저장해 둔 판정을 쓰지 않고 `openDetail` 이 처음부터 다시 판정한다 */
      if (resumePlan.sheet && findSch(resumePlan.sheet)) openDetail(resumePlan.sheet);
    }, 900);
  }
}
/* 부팅 화면을 걷는다 — 화면이 정해진 바로 이 자리다 */
/* 🔴 덮개에는 '데이터가 다 와서 한 번 그렸다'는 약속을 건넨다 — 덮개는 그걸 기다렸다가(천장 있음) 인트로를 돌린다.
   실패한 받기도 '끝'이다(오프라인 학생을 덮개 앞에 세워 두지 않는다). 덮개 파일이 없어도 그림은 그려진다. */
const bootSettled = Promise.all(bootJobs.map((j) => Promise.resolve(j).catch(() => {}))).then(bootHoldRelease);
if (typeof window.bootDone === 'function') window.bootDone(bootSettled);
else bootHoldRelease();

/* 앱이 숨는 순간에 본 시각·스크롤을 확실히 적어 둔다 (formProgressSave 머리말 참조) */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { resumeMark(); formProgressSave(true); if (typeof ffFlush === 'function') ffFlush(); }
});
window.addEventListener('pagehide', () => { resumeMark(); formProgressSave(true); if (typeof ffFlush === 'function') ffFlush(); });
/* 🔴 소셜 로그인·비밀번호 재설정 메일은 **주소 뒤에 토큰을 붙여** 이 앱으로 돌아온다.
   그걸 먼저 주워 담아야(그리고 주소창에서 지워야) 로그인 상태로 이어진다.
   그 뒤에 서버와 맞춘다 — 기기 우선이라 여기서 기다리지 않는다. 인터넷이 없으면
   아무 일도 안 일어나고 앱은 지금처럼 그대로 돈다. */
if (typeof authCaptureFromUrl === 'function') {
  authCaptureFromUrl().then((kind) => {
    if (kind === 'recovery') { openAuthSheet('newpw'); return; }   // 새 비밀번호를 정할 차례
    if (kind === 'signin') { toast('로그인 완료'); renderMy(); }
    if (typeof syncAfterLoad === 'function') syncAfterLoad();
  }).catch(() => {
    if (typeof syncAfterLoad === 'function') syncAfterLoad();
  });
} else if (typeof syncAfterLoad === 'function') {
  syncAfterLoad();
}
