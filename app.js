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
  return cleanCardTitle(String(sch.name || '').trim());
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
  const raw = String(sch.name || '').trim().replace(/^\s*(\S{2,8})\s+(?=[[【]\s*\1\s*[\]】])/, '').replace(/^공통\s+(?=\d)/, '');   // 「공통 2026-2학기 …」 — 게시판 분류(공통/학부/대학원) 머리말 · 해 앞에 선 것만(실측 경희대)
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
  const x = String(seg || '');
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
  /* 붙여 쓴 기간 꼬리 — `…신청 안내_09.22(화)~10.9(금)` · `…프로그램:10/1(목)~10/6(화)` · `… 안내 2026.09.01.(화)~2026.10.06.(화)` */
  t = t.replace(/(?:\s*[_:：]\s*|\s+)([~\d][\d.\s~\-–/()（）월화수목금토일년시:까지마감부터]{3,40})$/, (m, tail) => (isDateBit(tail) && /[~\-–]|까지|마감/.test(m + tail) || /[_:：]/.test(m) && isDateBit(tail) ? (dates.push(tail.trim()), ' ') : m));
  t = t.replace(/\s+(20\d{2}\s?\.\s?\d{1,2}(?:\s?\.\s?\d{1,2})?\.?|20\d{2}-\d{1,2}-\d{1,2})\s*$/, ' ');   // 꼬리 게시일 — 마감이 아니라 dates 에 안 넣는다
  t = t.replace(/\s{2,}/g, ' ').replace(/[\s·\-–—:,]+$/, '').trim();
  return t.replace(/\s/g, '').length >= 4 ? { title: t, dates } : { title: before, dates: [] };
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
const APP_VERSION = 'v0.3 (MVP)';

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
  if (typeof trackUse === 'function') trackUse('submitted', sch.id);
  /* 손끝에도 한 번 (2026-09-09). 여기까지만 울린다 — 진동은 **되돌리기 어려운 일이 방금
     일어났다**는 신호로만 쓴다(저장·새로고침·이 기록 셋). 화면이 바뀔 때마다 울리면
     알림처럼 느껴져서 학생이 폰 설정에서 앱 진동을 통째로 꺼 버린다. */
  if (typeof haptic === 'function') haptic(14);
  toast('공식 제출 기록 완료 · 접수 마감 후 심사 단계로 자동 전환');
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

function toast(msg, action) {
  const el = $('#toast');
  /* 🔴 사라지는 중에 새 알림이 뜨면 **옛 숨김 타이머가 새 알림을 지운다** — 2600ms 타이머만
     껐지 250ms 숨김 타이머는 안 끄고 있었다. 등장 전환이 살아난 지금은 증상이 더 나쁘다
     (반쯤 뜬 채로 사라진다). 두 타이머를 한자리에서 끈다. */
  clearTimeout(toast._t);
  clearTimeout(toast._h);
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
      toast._h = setTimeout(() => (el.hidden = true), 250);
      action.run();
    });
    el.appendChild(b);
  }
  el.hidden = false;
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
    el.textContent = formatter(target);
    return;
  }
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
function hintShort(s) {
  let t = hintText(s)
    .replace(/^\s*([가-힣]{2,8})\s*\)\s*/, '$1 ')                   // 앞이 잘려 짝 잃은 괄호 이름표 「접수기한 )」
    .replace(/[(（]\s*([가-힣]{2,8})\s*[)）]/g, '$1');                  // 「( 접수방법 )」
  t = t.split(/\s(?=[ㅇ○◯●■□\u25AA•※\u25B6]\s|\d{1,2}[.)]\s*[가-힣])/)[0];      // 다음 항목(「ㅇ 접수방법」·「2. 신청방법」) 앞에서 끊는다 — 날짜 「10. 7.」 은 항목 번호가 아니다
  t = t.replace(/\s+/g, ' ').trim();   // 글자는 원문 그대로(「신청기간 :」 의 띄어쓰기도) — 검사 드라이버가 잠근다
  if (!/\d/.test(t)) return '';                                            // 날짜가 없으면 기간 줄이 아니다
  if (t.length > 44) { const cut = t.slice(0, 44); t = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim()}…`; }
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
    toast(ok ? '프로필 사진 저장 완료 · 이 기기에만 남아요' : '이 사진은 읽을 수 없어요 · JPG·PNG 로 다시 올려 주세요');
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
    ? { ok: true, slot: s, text: `보관함에서 자동 첨부 · ${rec.name}` }
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
  ['onboarding', 'home', 'explore', 'activities', 'applications', 'my', 'myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms', 'formfill'].forEach((n) => {
    $(`#screen-${n}`).hidden = n !== name;
  });
  $('#bottom-nav').hidden = name === 'onboarding' || name === 'formfill';   // 양식 채우기는 쪽 그림이 화면을 다 써야 한다(formfill.js)
  /* 설정·휴지통은 MY 안쪽 화면이라 아래 탭에서 **MY 가 켜진 채**로 둔다 —
     아무 탭도 안 켜져 있으면 학생이 지금 어디에 있는지 알 수 없다. */
  const navOn = ['myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms'].includes(name) ? 'my' : (name === 'formfill' ? 'applications' : name);
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.nav === navOn));

  /* 🔴 안쪽 화면(설정·휴지통)은 **방향이 있는** 움직임으로 들어온다 (2026-09-11 개발자 지시).
     들어갈 때는 오른쪽에서, 되돌아올 때는 왼쪽에서 — 방향이 '어디로 가는 중인지'를 말한다.
     ⚠️ `.screen` 에는 이미 taste-in(위로 떠오르기)이 걸려 있다. 그 위에 덮어쓰는 것이라
        style.css 에서 **이 규칙이 뒤에 와야** 이긴다(같은 굵기면 나중 것이 이긴다).
     ⚠️ 클래스를 떼었다 붙이는 것만으로는 다시 안 돈다 — 브라우저가 '바뀐 게 없다'고 본다.
        중간에 offsetWidth 를 한 번 읽어 강제로 끊어 준다. */
  const SUB = ['myinfo', 'mydocs', 'mysaved', 'settings', 'trash', 'terms', 'logins', 'faq', 'support', 'perms', 'formfill'];
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
     예전에는 신청내역에 있기만 하면 '신청 완료' 배지를 달았다. 그런데 '한 번에 신청 준비'로
     담은 건은 `pending: bulkNeedsWork(sch)` 로 **서류 작성이 남은 채** 들어간다(applyAll).
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
function renderResumeCard() {
  const el = $('#home-resume');
  if (!el) return;
  const saved = typeof resumeLoad === 'function' ? resumeLoad() : null;
  const prog = saved && saved.form;
  const alive = typeof resumeProgressAlive === 'function' && resumeProgressAlive(prog, Date.now());
  const sch = alive && findSch(prog.schId);
  if (!sch) { el.hidden = true; return; }

  el.hidden = false;
  el.innerHTML = `
    <span class="rc-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15h6"/></svg></span>
    <span class="rc-body">
      <span class="rc-title">쓰던 신청서가 있어요</span>
      <span class="rc-sub">${esc(sch.name || sch.title || '')} · ${esc(agoLabel(prog.at))}에 쓰던 것</span>
    </span>
    <span class="rc-go">신청서 마저 쓰기</span>`;
  el.onclick = () => { openSheetShell(); startFormFill(sch, prog); };
}

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
  const notApplied = applyable.filter((m) => !state.applications.some((a) => a.id === m.sch.id));

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
  countUp($('#hero-amount'), total, (v) => `최대 ${won(v)}`);
  /* 🔴 히어로 아랫줄을 **통째로 없앴다** (2026-09-17 개발자 지시 2차: "금액 밑에 있는
     '그중 N건은 바로 신청할 수 있어요' 안내도 삭제해줘"). 앞서 같은 자리에서 금액 회계
     두 줄을 걷어냈고, 이 줄이 마지막 하나였다. 이제 히어로는 **건수 · 금액 · 버튼** 셋뿐이다.
     🔴 `#hero-count` 요소도 index.html 에서 뺐다 — 채우는 곳이 없는 빈 칸을 남겨 두면
        다음 세션이 '왜 안 채우지'를 뒤진다. 그 칸이 주던 아래 여백은 style.css 파일 끝
        '히어로' 절에서 `.hero-amount` 가 물려받는다(실측 57px → 같은 자리 유지). */
  $('#hero-label').textContent = '지금 신청할 수 있는 장학금';
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
  $('#hero-tiles').innerHTML = HERO_TILES.map((t) => `
    <button type="button" class="hero-tile" data-hero-go="${t.go}" aria-label="${t.name}${tileN[t.go] == null ? '' : ` ${tileN[t.go]}건`}">
      <span class="hero-ico ${t.tone}">${t.svg}${tileN[t.go] == null ? '' : `<span class="hero-badge${tileN[t.go] ? '' : ' zero'}">${tileN[t.go]}</span>`}</span>
      <span class="hero-tile-name">${t.name}</span>
    </button>`).join('');

  const btn = $('#btn-apply-all');
  btn.disabled = notApplied.length === 0;
  /* 버튼은 **누르면 무슨 일이 나는지**만 말한다 (2026-08-30 개발자 지시).
     '⚡ 한 번에 모두 신청 준비하기'에서 이모지·'한 번에'·'모두'는 전부 앱의 감탄이지
     학생이 얻는 정보가 아니었다. 남는 것은 건수와 동사뿐이다. */
  btn.textContent = notApplied.length ? `${notApplied.length}건 신청 준비` : '준비할 장학금이 남아 있지 않아요';

  renderResumeCard();

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
     아랫줄이 '원문 보기 ↗' 라고 말한다. 누르면 예전처럼 학교 게시판으로 나간다).
     ⚠️ 검색어는 여기에도 건다 — 안 걸면 '검색했는데 그대로'가 된다(2026-09-12 · UI-16).
        카드에 보이는 글자(제목)로만 거른다, 위 등록 공고와 같은 규칙이다. */
  const boardIn = inSchoolTab
    ? boardNoticesInSchool().filter((n) => !q || String(unent(n.title)).toLowerCase().includes(q))
    : [];
  $('#explore-list').innerHTML = (list.length || boardIn.length)
    ? list.map((m) => schCard(m.sch, m.result, { fit: m.fit, fd: m.fd })).join('')
      + boardIn.map(noticeCardHtml).join('')
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

/* 증명서류(작성형 제외)의 보관함 상태 목록 HTML */
function certStatusListHtml(sch) {
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
    if (/자동/.test(doc)) return `<li>△ ${name} — 학교·재단 연동 후 자동 첨부 (또는 보관함에 올려두세요)</li>`;
    return `<li>□ ${esc(doc)} — 공식 제출 시 함께 준비하세요</li>`;
  }).join('');
  /* doc-check — 줄마다 ✓·□·△ 표식이 있어 목록 점은 뺀다(표식이 두 겹이던 자리 · 2026-10-15 · style.css) */
  return `<h4>증명서류 체크리스트</h4><ul class="doc-list doc-check">${rows}</ul>
    <p class="dp-note">보관함(MY 탭) 서류는 다음 신청부터 자동 첨부.</p>`;
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
        <p class="sheet-provider">${esc(sch.name)} · 고른 답으로 초안 문장을 엮습니다</p>
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
        <p class="dp-note">완료하면 작성한 서류가 저장되고 최종 제출처가 표시됩니다.</p>
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

function startFormFill(sch, restore) {
  formFill = { schId: sch.id, stage: 'q', ans: null };
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
    const tplId = sch && formTplIdFor(sch);
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
  const tpl = FORM_TEMPLATES[formTplIdFor(sch)];
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
    if (tpl.unofficial && typeof attachFormFillButtons === 'function') attachFormFillButtons(sch, sheet);   // 「원본 양식 그대로 보기」 밑 「양식 채우기」(formfill.js)
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
        <p class="sheet-provider">칸을 눌러 직접 수정할 수 있습니다 · ${tpl.unofficial ? esc(tpl.lead || '이 공고에 맞춘 지원문서') : '실제 공고 양식과 동일한 구조'}</p>
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

function rerenderVisible() {
  if (!state.profile) return;
  if (bootHold) { bootHeld = true; return; }
  if (!$('#screen-home').hidden) renderHome();
  if (!$('#screen-explore').hidden) renderExplore();
  if (!$('#screen-activities').hidden) renderActivities();
  if (!$('#screen-applications').hidden) renderApplications();
}

/* 마지막으로 **성공적으로** 받아 온 학교별 파일 목록 — 학교가 바뀌면 다시 받아야 한다.
   🔴 **받기 전에 적지 않는다** (2026-09-26 코드 리뷰에서 잡았다). 받기 전에 적으면
      ① 실패한 받아오기도 '받았다'로 남아 같은 학교로 다시 시도하지 않고
      ② 학교가 바뀌는 순간 두 받아오기가 겹쳤을 때 **늦게 온 옛 학교 것이 이긴다**
      (앱을 열 때 A 로 시작했는데 로그인 사본이 B 였던 경우가 정확히 그 꼴이다). */
let noticeFilesLoaded = null;
/* 지금 받고 있는 목록 — 이것과 다른 것이 돌아오면 **버린다**(늦게 온 옛 학교 것이다). */
let noticeFilesWanted = null;

function loadNotices() {
  const p = state.profile;
  const files = (typeof noticeFilesForProfile === 'function' && p) ? noticeFilesForProfile(p) : [];
  const wanted = files.join(',');
  noticeFilesWanted = wanted;
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => tidyData(d)).catch(() => null);   // 깨진 글자 씻기(2026-11-17)
  /* ⚠️ 색인은 학교별 파일과 **나란히** 부른다 — 먼저 받고 나서 부르면 공고가 있는 학생에게
     왕복이 한 번 더 늘어(모바일에서 눈에 보인다) 아낀 것보다 손해다. */
  const job = files.length
    ? Promise.all([...files.map(get), get('data/notices/index.json')]).then((docs) => {
      const idx = docs[docs.length - 1];
      const ok = docs.slice(0, files.length).filter(Boolean);
      if (!ok.length) {
        /* ⚠️ `typeof` 로 감싼다 — 위 `noticeFilesForProfile` 과 같은 이유다(코드 리뷰에서
           잡았다). 서비스워커가 옛 `match-engine.js` 를 캐시에서 내주면 이 함수가 아직
           없고, 그 오류는 아래 `job.catch` 가 삼켜 **물러나는 길이 조용히 사라진다.** */
        return (typeof noticeFallbackNeeded !== 'function' || noticeFallbackNeeded(idx, files))
          ? get('data/notices.json')                       // 배포 엇갈림·색인 못 읽음 → 물러난다
          : { updatedAt: (idx && idx.updatedAt) || null, items: [] };   // 우리에게 그 학교 공고가 없다
      }
      return {
        updatedAt: ok.map((d) => d.updatedAt).filter(Boolean).sort().pop() || null,
        items: ok.flatMap((d) => d.items || []),
      };
    })
    /* 🔴 **프로필이 없으면 아무것도 받지 않는다** (2026-09-26). 예전에는 여기서 옛 파일을
       통째로 받았는데, 프로필이 없으면 `boardNoticesForMe` 가 `if (!p || !liveNotices)` 로
       끝나 **받아도 한 줄도 못 쓴다.** 첫 실행 학생 전원이 그 낭비를 치르고 있었다.
       ⚠️ 그래서 **프로필이 정해지는 순간 다시 받는다** — `loadNoticesIfSchoolChanged`.
          그 짝이 없으면 첫 실행 학생의 실시간 공고가 새로 열 때까지 비어 보인다. */
    : Promise.resolve({ items: [], updatedAt: null });
  /* 🔴 **부르는 쪽이 끝을 기다릴 수 있게 약속을 돌려준다** (2026-09-09).
     당겨서 새로고침은 '다 받아 왔다'를 알아야 뱅뱅이를 멈춘다 — 예전처럼 아무것도
     안 돌려주면 손을 떼자마자 멈춰서 학생 눈에는 아무 일도 안 한 것으로 보인다. */
  /* 🔴 받아오기 실패만 여기서 삼킨다 — 그리기(rerenderVisible)까지 같은 catch 로 감싸면
     그리다 난 진짜 버그가 조용히 묻히고, 그 안에서 다시 그리려다 두 번 던진다. */
  return job.catch(() => null).then((d) => {
    /* 🔴 **늦게 온 옛 학교 것은 버린다** (2026-09-26 코드 리뷰). 그 사이 학교가 바뀌었으면
       이 결과는 남의 학교 것이다 — 앱을 열 때 A 로 시작했는데 로그인 사본이 B 였던 경우가
       정확히 그 꼴이고, A 가 늦게 오면 B 학생 화면에 A 의 공고가 앉는다.
       ⚠️ 버릴 때는 `noticeFilesLoaded` 를 건드리지 않는다 — 지금 받고 있는 쪽이 적는다. */
    if (noticeFilesWanted !== wanted) return liveNotices;
    /* 성공한 것만 '받았다'로 남긴다 — 실패를 적으면 같은 학교로 다시 시도하지 않는다. */
    noticeFilesLoaded = d ? wanted : null;
    /* 🔴 **못 받아 왔어도 빈 문서를 넣는다** (2026-09-09). `null` 로 두면 화면이
       '아직 오는 중'(뼈대)으로 읽어 영영 그 상태로 굳는다 — 오프라인 학생에게
       끝나지 않는 기다림을 보여 주는 것은 '없음'보다 나쁘다.
       ⚠️ 앞서 받아 둔 것이 있으면 그것을 남긴다(실패했다고 있던 공고를 지우지 않는다). */
    liveNotices = d || liveNotices || { items: [], updatedAt: null };
    rerenderVisible();
  });
}

/* 공고별 지원문서 연결 (2026-07-15 → 2026-10-13 개발자 결정으로 범위 확대).
   🔴 앱 양식(formId)이 없는 **모든 정식 등록 공고**에 질문형 문서 작성 흐름을 붙인다.
      예전엔 '자유 형식 제출이 원문으로 확인된 공고(prepDoc)'에만 붙였는데 실데이터에 0건이라, 학생은
      「신청 준비 시작」을 눌러도 할 일 없는 빈 시트만 보고 버튼 한 번에 '준비 완료'가 됐다(2026-10-13 개발자:
      *"앱 자체 문서는 있는 게 맞다 — 없으면 바로 신청내역으로 가고 앱의 신뢰도가 낮아진다"*).
   🔴 정직함은 문서의 머리말이 지킨다(forms.js prepKindFor · '그대로 제출 가능'은 prepDoc 에서만).
   공식 양식(formId)과 구분되도록 prepFormId 로만 연결 — 채널 라벨은 그대로 유지. 상시 제도(program)는 제외. */
function attachPrepTemplate(s) {
  if (typeof FORM_TEMPLATES === 'undefined' || typeof buildPrepTemplate !== 'function') return s;
  if (s.formId || s.program || s.noApply) return s;   // noApply: 신청 절차가 없는 공고(applyLock 참조) — 준비할 문서도 없다
  const pid = 'prep:' + s.id;
  /* 층2 항목은 부를 때마다 새로 만들어지므로(kosafAsScholarships) 템플릿은 한 번만 짓고 다시 쓴다 — 목록을 다시 받으면 loadKosaf 가 지운다 */
  if (!FORM_TEMPLATES[pid] || s.sourceKind !== 'kosaf') FORM_TEMPLATES[pid] = buildPrepTemplate(s);
  s.prepFormId = pid;
  return s;
}
function attachPrepTemplates(list) {
  for (const s of list) attachPrepTemplate(s);
}

/* 공고문 뒷장에서 뗀 신청서 서식 쪽 (2026-10-13 ② · collector/form-pages.mjs · data/form-pages/index.json) — 층1·층2 모두. 줄 꼴은 시안 A 의 PDF 줄과 같다 */
let formPagesIndex = {};
function loadFormPagesIndex() {
  return fetch('data/form-pages/index.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d && d.items) formPagesIndex = d.items; })
    .catch(() => { /* 없으면 그 줄만 안 그린다 */ });
}
function formPagesFor(sch) { return ((sch && formPagesIndex[sch.id]) || []).filter((f) => f && f.file); }
function formPageRowsHtml(sch) {
  return formPagesFor(sch).map((f) => {
    const meta = `${f.pages ? `${f.pages}쪽 · ` : ''}${Math.max(1, Math.round((f.bytes || 0) / 1024))}KB · 공고문에서 뗀 서식 쪽${f.srcPages ? ` (원문 ${f.srcPages}쪽)` : ''}`;
    return `<li class="att att-row att-row-new"><span class="att-ic att-ic-pdf">PDF</span><span class="att-t"><a href="${esc(`data/form-pages/${f.file}`)}" target="_blank" rel="noopener">${esc(f.name || '공고문 안 신청서 서식')}</a><span class="att-m">${esc(meta)}</span></span><span class="att-go">열기 ›</span></li><li class="fill-slot" data-file="${esc(f.file)}" hidden></li>`;   /* 서식 쪽도 빈칸을 찾았으면 「양식 채우기」(formfill.js · 2026-11-18) */
  }).join('');
}
/* 원본 신청서 — 공고 첨부 중 신청서(isApplicationForm · data.js 한 곳) + 로봇이 PDF 로 바꿔 둔 사본(data/forms-pdf/index.json · formPdfsFor) + 공고문에서 뗀 서식 쪽(formPagesFor).
   양식 작성 화면(지원문서 질문 화면)과 신청 준비 시트가 **같은 줄 꼴**(attachRowHtml · formPdfRowsHtml — 승인 시안 A 2026-10-14)로 그린다(베끼면 한쪽만 PDF 를 모른다).
   층2(10-13 ①)는 첨부를 **선발 공고문**이라 부른다 — 신청서가 아니다(CLAUDE.md 「층2」). 10-13 개발자 결정으로 층1은 지원문서 질문 화면이 먼저 뜨므로 시안 A 의 줄은 여기(화면 머리)에 선다. */
function prepOriginalsHtml(sch) {
  const kosaf = sch.sourceKind === 'kosaf';
  const atts = (sch.attachments || []).filter((a) => a && !a.bodyImage && (kosaf || isApplicationForm(a)));
  const pdfRows = kosaf ? '' : formPdfRowsHtml(sch);
  const pageRows = formPageRowsHtml(sch);
  if (!atts.length && !pdfRows && !pageRows) return '';
  const head = kosaf ? '선발 공고문 <span class="channel-tag">재단 원문</span>' : '신청서 양식 <span class="channel-tag">공고 원본</span>';
  const attMeta = kosaf ? '재단 공고문 사본 · 내려받기' : '학교 게시판 첨부 · 내려받기';
  const note = kosaf
    ? '접수 방법과 서식은 재단의 공고문이 정합니다 — 아래에서 정리한 내용을 그 서식에 옮겨 적으세요.'
    : `제출은 이 원본 양식으로 합니다 — 아래에서 정리한 내용을 옮겨 적으세요.${pdfRows ? ' 빈칸을 찾은 PDF 는 「양식 채우기」로 답을 얹을 수 있어요.' : ''}`;
  /* 줄 순서 — 원본 PDF 사본 → 첨부 원본 파일 → 공고문에서 뗀 서식 쪽(시안 A 드라이버가 앞 두 묶음의 자리를 잰다) */
  return `<h4>${head}</h4>
      <ul class="doc-list">${pdfRows}${atts.map((a) => attachRowHtml(a, { meta: `${attMeta}${attachKb(a)}` })).join('')}${pageRows}</ul>
      <p class="dp-note">${note}</p>`;
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
   손으로 검수해 둔 목록(외대)이 이미 있으면 그쪽을 지키고 덮어쓰지 않는다.

   🔴 **자기 학교 파일 하나만 받는다** (2026-09-26 · 고문 보고서). 그전에는 209개교가 든
      `data/majors.json` 을 **첫 화면에서 통째로** 받았다 — 실측 407KB(gzip 65KB)로 앱이
      받는 것 중 가장 큰 파일이었는데, 쓰는 곳은 온보딩 학과 자동추천 한 곳뿐이다.
      학교별 파일은 gzip 1.5KB다(한국외대 실측).
   ⚠️ 그래서 **앱을 열 때 받지 않는다** — 학교가 정해질 때(또는 학과를 칠 때) 받는다.
      못 받으면 전국 공통 목록(`MAJORS_COMMON`)으로 물러난다 — 원래 있던 폴백이다.
   ⚠️ 열쇠는 `'학교'` 또는 `'학교 캠퍼스'` 다(캠퍼스마다 학과가 다른 학교가 있다).
      이름 규칙은 `match-engine.js majorsFileFor` 한 곳 — 로봇과 같은 함수다. */
const majorsAsked = new Set();     // 같은 학교를 두 번 받지 않는다
const MAJOR_FILES = {};            // 학교 → 받은 파일 그대로({ majors, campuses? }) — 캠퍼스별 목록은 majorPool 이 본다
/* 학교(캠퍼스)의 소재 시·도 — 학과 파일의 campusRegion(캠퍼스별) → region(학교 · 하나일 때만). 모르면 null(엔진은 '모름') */
function schoolRegionFor(school, campus) {
  const f = MAJOR_FILES[school];
  if (!f) return null;
  if (campus && f.campusRegion && f.campusRegion[campus]) return f.campusRegion[campus];
  return Array.isArray(f.region) && f.region.length === 1 ? f.region[0] : null;
}
function loadMajorsFor(school) {
  if (!school || typeof majorsFileFor !== 'function') return;
  /* 🔴 **실제 학교 이름일 때만 부른다** (2026-09-26 코드 리뷰). 학교 칸은 `input` 마다
     돌아서, '한국외국어대학교' 를 치는 동안 '한'·'한국'… 아홉 번 404 를 부르고 그 쓰레기
     열쇠가 `majorsAsked` 에 쌓였다. `UNIVERSITIES` 에 있는 이름만 받는다(아래 캠퍼스 칩을
     그리는 `renderCampusChips` 도 정확한 이름으로만 맞춰 보므로 폭이 같다). */
  if (typeof UNIVERSITIES !== 'undefined' && !UNIVERSITIES.includes(school)) return;
  /* 🔴 **`'학교 캠퍼스'` 열쇠는 받지 않는다** (2026-09-26 실측). `majorSuggestions` 가 그
     열쇠를 먼저 보긴 하지만, 수확 로봇은 그 꼴을 **하나도 발행하지 않는다** — 캠퍼스별로
     학과가 다른 곳은 `BRANCH_MAP` 이 **분교를 별개 학교 이름**으로 바꿔 저장한다
     (`건국대학교 글로컬캠퍼스` 처럼 `UNIVERSITIES` 에 따로 있다). 그래서 캠퍼스 열쇠로
     부르면 **언제나 404** 다. 그 열쇠는 `data.js` 에 손으로 넣은 목록만을 위한 자리이고,
     그건 이미 기억에 있어 받아올 것이 없다.
     ⚠️ 로봇이 그 꼴을 발행하기 시작하면 여기도 같이 고칠 것 — 관문이 색인을 보고 잰다. */
  for (const key of [school]) {
    if (majorsAsked.has(key)) continue;
    majorsAsked.add(key);
    fetch(majorsFileFor(key), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.majors) || !d.majors.length) return;
        /* 로봇 파일이 목록이다 — 손검수 목록은 2026-10-24 에 없앴다(외대 손목록이 로봇 파일을 가려 GBT학부가 안 떴다 · data.js 주석) */
        MAJOR_FILES[key] = d;
        MAJORS_BY_SCHOOL[key] = d.majors;
        /* 이미 저장된 프로필에 소재지가 비어 있으면 지금 채운다(가입 때 파일이 늦게 왔거나 옛 프로필) — 판정이 그 자리에서 넓어진다 */
        if (state.profile && state.profile.school === key && !state.profile.schoolRegion) {
          const r = schoolRegionFor(key, state.profile.campus || '');
          if (r) { state.profile.schoolRegion = r; saveState(); }
        }
        /* 계열 칩도 그 학교 것으로 다시 그린다 — 학생이 이미 누른 칩은 지킨다(renderTrackChips) */
        if (!$('#screen-onboarding').hidden && $('#in-school').value.trim() === key) renderTrackChips();
        /* 🔴 **도착했으면 추천을 다시 그린다** (코드 리뷰에서 잡았다). 받아오기는 비동기라
           학생이 이미 학과를 치고 있으면 화면에는 **전국 공통 목록이 그대로 떠 있다** —
           경희대 학생이 '일'을 치고 `일어일문학과` 를 눌러 버릴 수 있다(2026-08-02 그 사고).
           ⚠️ 목록을 여기서 직접 만들지 말 것 — `attachAutocomplete` 가 `input` 으로 그린다. */
        const el = $('#in-major');
        if (el && el.value.trim() && document.activeElement === el) {
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })
      .catch(() => {
        /* 🔴 실패는 **다시 시도할 수 있게** 지운다 (코드 리뷰). 남겨 두면 지하철에서 한 번
           끊긴 학생이 그 세션 내내 전국 공통 목록으로 남는다. */
        majorsAsked.delete(key);
      });
  }
}

/* 학교별 등록금 (2026-08-27) — `수업료 100%` 같은 비율형 공고를 원으로 바꾸는 데 쓴다.
   비어 있으면 그 공고들은 '금액 미확인'으로 남는다. **전국 평균 같은 걸 지어내지 않는다.**
   채우는 로봇: collector/fetch-tuition.mjs */
let tuitionTable = {};
/* 홈 합계를 마지막으로 계산한 내역 — '금액 상세' 시트가 이걸 그대로 보여 준다.
   시트가 따로 다시 계산하면 화면과 시트가 다른 말을 하게 된다. */
let lastBill = null;

/* 홈 히어로 그림 4칸 (2026-10-01 CTO 결정 · 시안 I4).
   🔴 **이모지가 아니라 직접 그린 SVG** 다 — 화면 이모지는 ui-tone 관문이 0개로 막고 있고
      (공동개발자·전문가 지적 "AI 가 만든 티"), 이모지는 폰마다 그림이 달라진다.
   🔴 교외는 지구가 아니라 **기둥 있는 재단 건물**이다(CTO 지시 — 교외 = 재단·지자체).
   `go` 는 누르면 갈 곳: 장학금 탭의 필터 칸 이름 · 'deadline'(마감 임박순) · 'applications'. */
const HERO_TILES = [
  { go: 'deadline', name: '마감 임박', tone: 'red',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="7.5" cy="7.5" r="4" fill="#c9503f"/><circle cx="24.5" cy="7.5" r="4" fill="#c9503f"/><path d="M9.5 27.5l-2 2.5M22.5 27.5l2 2.5" stroke="#5a2a22" stroke-width="2.2" stroke-linecap="round"/><circle cx="16" cy="17.5" r="11" fill="#dd5d4b"/><circle cx="16" cy="17.5" r="8" fill="#fff"/><path d="M16 12.5v5.2l3.4 2.1" fill="none" stroke="#33231f" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="17.5" r="1.3" fill="#33231f"/><ellipse cx="11.5" cy="10.5" rx="3" ry="1.3" fill="#fff" opacity=".35"/></svg>' },
  { go: '교내', name: '교내', tone: 'green',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5v6" stroke="#6b5a3a" stroke-width="1.6"/><path d="M16 2.5h6.5l-1.6 2 1.6 2H16z" fill="#dd5d4b"/><rect x="4" y="15" width="24" height="14" rx="1.5" fill="#f1c56c"/><path d="M2 16.5L16 8.5l14 8z" fill="#c4553f"/><rect x="13" y="20" width="6" height="9" rx="1" fill="#8a5a2b"/><rect x="6.5" y="19" width="4" height="4" rx=".8" fill="#7cbfe6"/><rect x="21.5" y="19" width="4" height="4" rx=".8" fill="#7cbfe6"/><circle cx="16" cy="14.3" r="2" fill="#fff"/></svg>' },
  { go: '교외', name: '교외', tone: 'navy',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 11.5L16 3.5l13 8z" fill="#6f87ba"/><circle cx="16" cy="8.4" r="1.7" fill="#f1c56c"/><rect x="3" y="11.5" width="26" height="3" rx="1" fill="#55709f"/><rect x="6" y="15" width="3.4" height="10" fill="#e9eef7"/><rect x="11.6" y="15" width="3.4" height="10" fill="#e9eef7"/><rect x="17" y="15" width="3.4" height="10" fill="#e9eef7"/><rect x="22.6" y="15" width="3.4" height="10" fill="#e9eef7"/><path d="M8.4 15v10M14 15v10M19.4 15v10M25 15v10" stroke="#c3cde0" stroke-width="1"/><rect x="3" y="25" width="26" height="2.5" rx="1" fill="#55709f"/><rect x="1.5" y="27.5" width="29" height="2.6" rx="1" fill="#3f5788"/></svg>' },
  /* 대외활동·공모전 칸 (2026-10-10 팀 업무 분장 4번 — 은서: "홈 버튼 수를 늘려 크기 축소 · 대외활동 및 공모전 탭 홈화면에 반영").
     누르면 대외활동·공모전 화면을 그 종류 칩이 켜진 채로 연다(아래 data-hero-go 배선). 숫자는 그 화면 목록과 같은 activitiesForMe(). */
  { go: '대외활동', name: '대외활동', tone: 'orange', act: true,
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 13h5l11-6.5v19L10 19H5a2 2 0 01-2-2v-2a2 2 0 012-2z" fill="#f08a3c"/><path d="M21 6.5v19" stroke="#c4651f" stroke-width="2.4" stroke-linecap="round"/><path d="M7.5 19l2 7.5h3.6L11.6 19z" fill="#8a4a1f"/><path d="M25 12.5c1.6.9 2.5 2.1 2.5 3.5s-.9 2.6-2.5 3.5" fill="none" stroke="#f1c56c" stroke-width="2" stroke-linecap="round"/><ellipse cx="8" cy="14.6" rx="2.2" ry="1" fill="#fff" opacity=".4"/></svg>' },
  { go: '공모전', name: '공모전', tone: 'violet', act: true,
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5h14v7a7 7 0 01-14 0z" fill="#f1b03b"/><path d="M9 7.5H5.5a4 4 0 004 5M23 7.5h3.5a4 4 0 01-4 5" fill="none" stroke="#d9952a" stroke-width="2" stroke-linecap="round"/><rect x="14" y="18" width="4" height="5" fill="#d9952a"/><rect x="9.5" y="23" width="13" height="5" rx="1.5" fill="#7a5cc4"/><path d="M16 8.2l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="#fff"/></svg>' },
  { go: 'applications', name: '신청 내역', tone: 'gold',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="3" width="19" height="25" rx="2.5" fill="#fff" stroke="#cfc6b6" stroke-width="1.2"/><path d="M9 9h11M9 13.5h11M9 18h7" stroke="#9db2d8" stroke-width="2" stroke-linecap="round"/><g transform="rotate(38 22 19)"><rect x="19.5" y="7" width="5" height="17" rx="1" fill="#f1b03b"/><rect x="19.5" y="7" width="5" height="3" fill="#e98c9b"/><path d="M19.5 24h5L22 28.5z" fill="#f2d7ae"/><path d="M21.3 27.1h1.4L22 28.5z" fill="#33231f"/></g></svg>' },
];
function loadTuition() {
  return fetch('data/tuition.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      tuitionTable = (d && d.schools) || {};
      rerenderVisible();
    })
    .catch(() => { /* 오프라인 — 비율형은 미확인으로 둔다 */ });
}

/* 정식 등록 공고 (수집 → 큐레이션 → 매칭·신청 지원) */
/* 언제 받은 목록인가 — 홈 맨 아래에 적는다 (2026-09-01 개발자 요청).
   dataFetchedAt 은 **이 폰이 받아 온 시각**, regUpdatedAt 은 **로봇이 발행한 날**이다. */
let dataFetchedAt = null;
let regUpdatedAt = '';

function renderHomeUpdated() {
  const el = $('#home-updated');
  if (!el) return;
  if (!dataFetchedAt) {
    /* 받아 온 적이 없다 — 저장된 목록을 최신인 것처럼 보이면 안 된다 */
    el.textContent = '장학금 목록을 아직 받지 못했어요 · 인터넷 연결을 확인해 주세요';
    return;
  }
  const t = dataFetchedAt;
  const two = (n) => String(n).padStart(2, '0');
  const when = `${t.getMonth() + 1}월 ${t.getDate()}일 ${two(t.getHours())}:${two(t.getMinutes())}`;
  /* 두 줄로 나눈다 — 한 줄로 두면 오른쪽 끝이 도우미 동그라미에 가린다(실측).
     두 가지가 서로 다른 사실이기도 하다. */
  el.innerHTML = `<span>장학금 목록 마지막 확인 ${esc(when)}</span>`
    + (regUpdatedAt ? `<span>공고 갱신 ${esc(regUpdatedAt)}</span>` : '');
}

/* 원문 링크 확인 장부 (2026-10-03 · 원문 링크 정직성 — 개발자 보고 P0 *"원문 공고를 누르면 재단·장학금 페이지 전체가 열린다"*).
   로봇이 학생처럼 새 탭으로 열어 보고 '그 공고가 아니었다'(목록·홈·로그인·404·다른 화면)를 **확정한** 주소만
   data/link-check.json 의 bad 에 담는다. 링크 이름은 source-link.js 의 sourceLink 가 이 장부로 정한다(setLinkChecks).
   🔴 못 받아도(404·오프라인·파일 없음·깨진 JSON) **조용히** 넘어간다 — 장부가 없으면 예전 이름 그대로다(주소 꼴만 본다).
      네트워크가 끊긴 것뿐이면 받아 둔 장부를 지킨다(비우면 확인된 문제 링크가 다시 '원문'이 된다).
   🔴 정식 등록과 **나란히** 받는다 — 목록이 먼저 와도 장부를 잠깐(LINK_CHECK_WAIT_MS) 기다려 첫 그림부터 맞는 이름을 단다.
      장부는 작아서 보통 먼저 온다. 더 늦으면 기다리지 않고 그리고, 장부가 오면 다시 그린다(바뀐 것이 있을 때만). */
let linkChecksDoc = null;
let linkFixesDoc = null;   // data/link-fixes.json — 관리자가 넣은 원문(source-link.js ⑥ · 같은 규칙으로 받는다)
let linkChecksJob = null;
const LINK_CHECK_WAIT_MS = 800;
function loadLinkChecks() {
  const getDoc = (path) => fetch(path, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null), () => undefined)   // undefined = 네트워크 실패(받아 둔 것을 지킨다)
    .catch(() => null);                                          // 깨진 JSON — 장부 없음으로
  linkChecksJob = Promise.all([getDoc('data/link-check.json'), getDoc('data/link-fixes.json')])
    .then(([d, fx]) => {
      const before = JSON.stringify([linkChecksDoc, linkFixesDoc]);
      if (d !== undefined) linkChecksDoc = d && d.bad && typeof d.bad === 'object' ? d : null;
      if (fx !== undefined) linkFixesDoc = fx && fx.fix && typeof fx.fix === 'object' ? fx : null;
      setLinkChecks(linkChecksDoc);
      setLinkFixes(linkFixesDoc);
      if (JSON.stringify([linkChecksDoc, linkFixesDoc]) !== before) rerenderVisible();
    });
  return linkChecksJob;
}
/* 장부를 기다리되 오래 붙잡지 않는다 — 정식 등록 목록 그리기가 이것 때문에 LINK_CHECK_WAIT_MS 넘게 늦지 않는다 */
function linkChecksWait() {
  if (!linkChecksJob) return Promise.resolve();
  return Promise.race([linkChecksJob.catch(() => {}), new Promise((res) => setTimeout(res, LINK_CHECK_WAIT_MS))]);
}

/* 신청서 원본 PDF 색인 (2026-10-14 · 승인 시안 A) — 로봇(collector/form-pdf.mjs)이 공고 첨부의 신청서 원본을 글자 하나 안 바꾸고 PDF 로 바꿔 둔 것.
   { items: { <공고 id>: [{ file, name, pages, bytes }] } }. 못 받으면 빈 채로 — 줄이 안 보일 뿐 시트는 그대로 뜬다. */
let formsPdfIndex = { items: {} };
function loadFormsPdfIndex() {
  return fetch('data/forms-pdf/index.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (j && j.items && typeof j.items === 'object') formsPdfIndex = j; })
    .catch(() => {});
}
function formPdfsFor(sch) { return (sch && formsPdfIndex.items && formsPdfIndex.items[sch.id]) || []; }
/* 첨부 한 줄(시안 A 꼴) — 아이콘(확장자) · 이름 · 작은 글씨 · 오른쪽 동작 */
function attachKb(a) { return a && a.bytes ? ` · ${Math.max(1, Math.round(a.bytes / 1024))}KB` : ''; }
function attachRowHtml(a, { meta = '', go = '↓' } = {}) {
  const ext = (String((a && a.name) || '').match(/\.(\w{2,5})$/) || [, ''])[1].toUpperCase();
  return `<li class="att att-row"><span class="att-ic att-ic-${esc(ext.toLowerCase())}">${esc(ext || '파일')}</span><span class="att-t">${attachmentLinkHtml(a)}${meta ? `<span class="att-m">${esc(meta)}</span>` : ''}</span><span class="att-go">${esc(go)}</span></li>`;
}
function formPdfRowsHtml(sch) {
  return formPdfsFor(sch).map((f) => {
    const meta = `${f.pages ? `${f.pages}쪽 · ` : ''}${Math.max(1, Math.round((f.bytes || 0) / 1024))}KB · 글자 하나 안 바꾼 원본 사본${formPdfsFor(sch).length > 1 ? ` · ${f.name}` : ''}`;
    /* 밑 자리(li.fill-slot)는 formfill.js attachFormFillButtons 가 빈칸을 찾은 파일에만 「양식 채우기」 단추로 채운다(시트·지원문서 머리 둘 다) */
    return `<li class="att att-row att-row-new"><span class="att-ic att-ic-pdf">PDF</span><span class="att-t"><a href="${esc(`data/forms-pdf/${f.file}`)}" target="_blank" rel="noopener">원본 양식 그대로 보기</a><span class="att-m">${esc(meta)}</span></span><span class="att-go">열기 ›</span></li><li class="fill-slot" data-file="${esc(f.file)}" hidden></li>`;
  }).join('');
}

function loadRegistered() {
  return Promise.all([
    fetch('data/registered.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    linkChecksWait(),
    /* 유료 카드 읽기 결과(2026-11-15) — 못 받으면 null 이고 그때는 무료 길 값 그대로다(비상망). 받기 실패가 공고 목록을 막지 않는다 */
    fetch('data/card-read.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
    .then(([d, , cardRead]) => {
      tidyData(d); tidyData(cardRead);   // 깨진 글자 씻기(2026-11-17) — 받는 순간 한 번
      if (!d) { if (appsData.registered !== 'ok') appsData.registered = 'fail'; return; }   // 한 번 받았으면 다시 받기 실패에도 'ok'(목록은 메모리에 그대로)
      appsData.registered = 'ok';
      registeredList = typeof applyCardRead === 'function' ? applyCardRead(d.items || [], cardRead) : (d.items || []);   // match-engine.js — 알림도 같은 함수로 얹는다
      regUpdatedAt = d.updatedAt || '';
      dataFetchedAt = new Date();
      attachPrepTemplates(registeredList);
    })
    .catch(() => { if (appsData.registered !== 'ok') appsData.registered = 'fail'; /* 오프라인 등 — 신청 내역이 '못 받음'으로 말한다 */ })
    /* 🔴 **성공이든 실패든 여기를 지난다** — 못 받아 왔을 때도 화면을 한 번 다시 그려야
       늦게 온 다른 데이터(층2·실시간 공고)와 함께 제자리를 잡는다. */
    .then(() => { rerenderVisible(); });
}

function loadKosaf() {
  return fetch('data/kosaf-open.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      tidyData(d);   // 깨진 글자 씻기(2026-11-17)
      if (!d) { if (appsData.kosaf !== 'ok') appsData.kosaf = 'fail'; rerenderVisible(); return; }   // 다시 받기 실패에 받아 둔 목록을 비우지 않는다
      appsData.kosaf = 'ok';
      kosafList = d.items || [];
      /* 층2 지원문서 템플릿은 다시 받을 때 지운다 — 다음 kosafAsScholarships 가 새 데이터로 다시 짓는다 */
      if (typeof FORM_TEMPLATES !== 'undefined') for (const k of Object.keys(FORM_TEMPLATES)) if (k.startsWith('prep:kosaf-')) delete FORM_TEMPLATES[k];
      kosafUpdatedAt = d.updatedAt || '';
      rerenderVisible();
    })
    .catch(() => { if (appsData.kosaf !== 'ok') appsData.kosaf = 'fail'; rerenderVisible(); /* 층2가 없어도 앱은 그대로 돈다 */ });
}

/* 데이터를 한꺼번에 다시 받는다 — 당겨서 새로고침과 화면 복귀가 **같은 함수**를 쓴다
   (2026-09-09). 갈라 두면 한쪽에만 새 로더를 붙이는 일이 반드시 생긴다
   (rerenderVisible 주석이 말하는 것과 같은 유형의 사고다). */
function refreshAllData() {
  const ledger = loadLinkChecks();   // 원문 링크 확인 장부 먼저 — 정식 등록 그리기가 이것을 잠깐 기다린다(2026-10-03)
  const jobs = [loadNotices(), loadNews(), loadRegistered(), loadKosaf(), loadActivities(), loadExternal()];
  jobs.push(ledger);
  if (typeof loadFormTemplates === 'function') jobs.push(loadFormTemplates());
  jobs.push(loadFormsPdfIndex());   // 신청서 원본 PDF 색인 (시안 A)
  jobs.push(loadFormPagesIndex());  // 공고문에서 뗀 서식 쪽 색인 (2026-10-13 ②)
  /* 🔴 `swReg` 는 이 파일 한참 아래(서비스워커 등록 자리)에서 `let` 으로 선언된다.
     그 줄이 아직 실행되기 전에 여기를 부르면 `typeof` 로 물어봐도 예외가 난다(TDZ).
     감싸 두지 않으면 새로고침이 통째로 넘어지므로 감싼다 — 새 버전 확인은 덤이고
     데이터를 다시 받는 것이 본업이다. */
  try { if (swReg) swReg.update().catch(() => {}); } catch (e) { /* 아직 등록 전 */ }
  return Promise.all(jobs.map((j) => Promise.resolve(j).catch(() => {})));
}

/* 층2 — 한국장학재단이 아는 재단 장학금을 **교외 공고와 같은 모양**으로 만든다 (2026-08-30).
   🔴 처음에는 목록 맨 아래에 전용 구역으로 붙였다가 개발자에게 두 번 지적받았다:
      ① 5,745px 아래라 "앱에 하나도 안 뜬다"  ② "복붙 수준으로 못생기게 해놨네."
      맞는 지적이다. 새 화면을 만들 게 아니라 **이미 있는 카드에 얹었어야** 했다.
      지금은 registeredList 와 같은 모양의 객체로 바꿔 schCard·openDetail·dday·정렬이
      **한 글자도 새로 안 짜고** 그대로 돌아간다.
   🔴 정직함은 그대로다 — KOSAF 는 재단이 적어 둔 칸이지 우리가 읽은 공고 원문이 아니다:
      · 금액은 **합계에 넣지 않는다**(amountValue 0) — 확인 안 한 숫자를 더하면 기망이다
      · 양식(formId)·준비문서(prepDoc)를 붙이지 않는다 → '앱에서 작성'이 안 뜬다
      · 자격 줄은 **재단이 쓴 글자 그대로** 옮긴다(지어내지 않는다 — 원칙 8-1)
      · 상세 시트가 출처를 밝힌다(openDetail 의 sourceKind 분기) */
/* 🔴 **문장인 칸만 자격 요건으로 보여 준다** (2026-08-30 개발자 지적).
   `학년구분: 대학신입생 대학2학기 대학3학기 …` 은 요건 문장이 아니라 **코드 나열**이라,
   그대로 띄우면 요건 칸이 데이터 덤프가 된다. 나열형 칸은 화면에서 뺀다.
   ⚠️ 뺀다고 판정이 나빠지지 않는다 — 어차피 적합도는 이 공고들에 대해 단정하지 않는다. */
const KOSAF_ELIG = ['특정자격', '성적기준', '소득기준', '지역거주구분'];
const KOSAF_CORE = ['특정자격', '성적기준'];   // 그중 「누가·성적」 칸 — 이 줄이 모두 버려지면 거주 ✓ 하나로 적합도를 주지 않는다(fitDetail · kosafCoreLines)

/* 🔴 재단이 쓴 글에는 `○`·`ㅇ`·`※` 같은 **머리 기호**가 그대로 들어 있다. 뜻이 아니라
   서식이므로 화면에서는 떼어낸다(문장 자체는 한 글자도 바꾸지 않는다).
   개발자 지적: "동그라미 기호니 … 너무 원문 그대로 가져오는 거 아니야?" */
/* 🔴 머리 기호는 **머리 자리에 있을 때만** 뗀다 (2026-09-12 코드 리뷰).
   `ㅇ` 은 한글 자모라 그냥 지우면 낱말 속 글자를 지운다 — 한국장학재단 원본에는 실제로
   떨어져 나온 자모가 섞여 있어(실측 7곳), 그걸 지우면 `LG스플레이` 처럼 **다르게 틀린**
   글자가 된다. 지우는 것도 지어내는 것과 같다(원칙 8-1). */
const kosafClean = (t) => String(t || '').replace(/(^|\s)[○ㅇ●◦※]+/g, '$1').replace(/\s+/g, ' ').trim();
const KOSAF_NOISE = /제한없음|^(?:기관\s?확인\s?필요|해당\s?없음)[요음]*$/;   // 아무것도 말하지 않는 줄 — kosafAsScholarships · verify/eligibility-coverage.mjs 가 같이 쓴다(한 줄로 둘 것 · 도구가 글자로 읽는다)
/* 한 칸에 여러 항목이 `○` 로 붙어 있다 — 재단이 쓴 대로 줄만 나눈다(`※ 자세한 사항은 …` 꼬리도 따로 한 줄이 된다).
   🔴 이 한 줄을 kosafAsScholarships·verify/eligibility-coverage.mjs·what-shows 가 같이 쓴다 (2026-11-11 · 6차) — 집계 도구가 따로 쪼갰더니(`○` 와 줄바꿈만)
   `※` 꼬리가 앞 줄에 붙어 **앱에 없는 줄**을 '못 읽는 줄'로 세고 있었다(`외국대학/사이버대학/대학원 학생 자세한 사항은 …`). 한 줄로 둘 것 · 도구가 글자로 읽는다 */
const kosafSplit = (t) => String(t || '').split(/\s*[○ㅇ※]\s*/).map((x) => kosafClean(x)).filter((x) => x.length >= 4 && !KOSAF_NOISE.test(x));

/* 층2 「공고 안내」 칸 값 (2026-11-15 · 개발자 결정 11-02) — 재단이 적어 둔 '모름' 표시(`기관확인필요`·`대학 확인 필요`·`… 각 대학 홈페이지 확인 필요`)는 화면에 싣지 않는다.
   🔴 **칸째 뺀다 — 자르지 않는다** (2026-11-16 2차 리뷰 · 원칙 8-1) — 예전엔 「확인 필요」 로 끝나는 마디(앞 세 낱말까지)를 떼어
      「※ 학교마다 선발인원 상이하므로 각 대학 홈페이지 확인 필요」 → 「학교마다 선발인원 상이하므로」(실데이터 2700058001)처럼 끊긴 글을 「이름표: 값」 원문으로 보였다.
      머리 기호(○·※)만 떼고(kosafClean · 서식) 나머지는 재단이 쓴 그대로 · 낱말 판정은 knownValue 와 같은 SAYS_UNKNOWN 한 곳 */
function kosafNoticeValue(v) {
  const t = kosafClean(v);
  return !t || KOSAF_NOISE.test(t) ? '' : knownValue(t);
}

/* 카드·시트에 보이는 **혜택 한 줄**. 원문 문단을 통째로 띄우지 않는다 —
   금액은 이미 parse-amount 가 읽어 뒀으니 그 숫자로 짧게 말하고, 조건은 상세 칸에서 본다.
   개발자 지적: "받을 수 있는 혜택만 간편하게 적어놔야지 원문 그대로 배껴놨네." */
const KOSAF_AMOUNT_UNKNOWN = '금액은 재단 홈페이지에서 확인';
function kosafAmountLabel(spec) {
  if (spec && spec.kind === 'fixed' && spec.value) return `최대 ${won(spec.value)}`;
  if (spec && spec.kind === 'range' && spec.max) {
    return spec.min && spec.min !== spec.max ? `${won(spec.min)} ~ ${won(spec.max)}` : `최대 ${won(spec.max)}`;
  }
  if (spec && spec.kind === 'ratio' && spec.ratio) return `등록금의 ${Math.round(spec.ratio * 100)}%`;
  /* 🔴 **못 읽은 금액 자리에 원문 문단을 흘리지 않는다** (2026-09-12 개발자 지적:
     "lg ㄷ 스플레이 이런 식으로 글자 깨짐"). 예전에는 숫자를 못 읽으면 원문 40자를 잘라
     그대로 띄웠다. 실측(열려 있는 116곳): 109곳은 숫자가 읽히고 **7곳만** 이 길로 갔는데,
     그 7곳이 전부 금액이 아니었다 — `예산범위 내에서 이사회에서 결정한 금액`,
     `기관확인필요`, `예산 총 5억원…`(총 사업규모다), 그리고 한국장학재단 원본의 오타가
     그대로 드러난 `LGㄷ스플레이 입사 자격 부여…`.
     🔴 오타는 **우리가 만든 것이 아니다** — `data/kosaf.json` 원본이 이미 그렇고
        (겹친 글자 822곳·홀자모 7곳 실측: `프로그램램`·`유효효기간`·`기관확인필요요`),
        같은 재단의 `운영기관명` 은 `LG디스플레이` 로 멀쩡하다. 우리 코드에는 글자를
        복제하거나 지우는 자리가 없다(strip 은 태그·엔티티·공백만 만진다).
        고칠 수 없는 남의 오타를 **카드 머리**에 띄우지 않는 것이 우리가 할 수 있는 일이고,
        원문은 버리지 않고 상세 시트에 '재단이 적어 둔 것'으로 그대로 남긴다(원칙 8-1).
     ⚠️ 여기서 원문을 다듬어 보여 주려 하지 말 것 — 지우면 `LG스플레이` 처럼 **다르게 틀린**
        글자가 되고, 그건 지어낸 것과 같다. */
  return KOSAF_AMOUNT_UNKNOWN;
}
function kosafAsScholarships() {
  return kosafList
    /* 마감 판정을 파일에 굳히지 않는다 — 수확 로봇은 가끔 돌고 앱은 매일 열린다 */
    /* 🔴 **저장한 공고는 마감이 지나도 남긴다** (2026-09-07). 여기서 떨어뜨리면
       findSch 가 그 공고를 못 찾아 **보관함에서 통째로 사라지고** 상세도 안 열린다.
       층1(registeredList)은 이 걸러내기가 없어 원래 남으므로, 층2만 맞춰 주는 것이다.
       ⚠️ 목록에 되살아나지는 않는다 — 탐색·홈은 각자 dday 로 한 번 더 거른다. */
    /* 🔴 **신청 내역에 담은 공고도 남긴다** (2026-10-02 리뷰) — 내려간 공고를 신청 내역에서 안 보이게 하면서, 마감 이틀 뒤
       이 걸러내기 때문에 제출·발표를 적을 바로 그 때 줄이 사라졌다(공고는 데이터에 그대로 있는데). 목록에는 안 되살아난다(탐색·홈이 dday 로 거른다). */
    .filter((i) => !i.due || dday(i.due).days >= -CLOSED_KEEP_DAYS || isSaved(`kosaf-${i.code}`) || state.applications.some((a) => a.id === `kosaf-${i.code}`))
    .map((i) => {
      const f = i.fields || {};
      /* 한 칸에 여러 항목이 `○` 로 붙어 있다 — 재단이 쓴 대로 줄만 나눈다(kosafSplit 한 곳) */
      /* 🔴 `제한없음` 이 든 칸은 **제한이 없다는 뜻**이라 자격 요건이 아니다 (2026-08-30).
         재단이 체크박스를 통째로 적어 놓은 것(`제한없음 인문계열 사회계열 …`)이 자격 요건
         자리를 차지하고 있었다 — 116곳 중 107줄. 아무것도 말하지 않는 줄이다. */
      /* `기관확인필요`·`해당없음` 만 적힌 줄도 아무것도 말하지 않는다 — 요건으로 세면 '확인 필요'가 부풀어 적합도가 깎인다(층2 16줄 · 2026-11-02). 규칙은 KOSAF_NOISE 한 곳(집계 도구가 글자로 읽어 쓴다) */
      const split = kosafSplit;
      /* 🔴 `특정자격: ` 같은 **칸 이름을 붙이지 않는다** — 자격 요건 자리에는 요건만 적는다
         (개발자 지적). 어느 칸에서 왔는지는 학생에게 아무 뜻이 없다. */
      const lines = KOSAF_ELIG.flatMap((k) => split(f[k]));
      const docs = split(f['제출처 및 제출서류']).filter((d) => !/자세한 사항/.test(d));
      /* 이름표를 붙여 넘긴다 — parse-amount 는 `isAmountHead` 로 금액 절을 찾는다(section-head.js) */
      const aSpec = amountFrom([`지원금액: ${f['지원금액'] || ''}`]);
      const aExcl = exclusivityFrom([f['지원금액'] || '', f['자격제한'] || '']);
      return {
        id: `kosaf-${i.code}`,
        name: `${i.org} ${i.name}`,
        provider: i.org,
        type: '교외',
        amount: kosafAmountLabel(aSpec),
        /* 금액을 못 읽었을 때만 원문을 함께 넘긴다 — 상세 시트에서 '재단이 적어 둔 것'으로 보여 준다.
           읽은 경우에는 카드 문구가 이미 그 숫자라 두 번 말할 뿐이다. */
        /* 🔴 조건을 **라벨과 같은 식으로** 쓴다 — 따로 적었다가 `{kind:'fixed', value:0}`
           에서 라벨은 폴백인데 원문은 버려지는 어긋남이 있었다(2026-09-12 코드 리뷰). */
        ...(kosafAmountLabel(aSpec) !== KOSAF_AMOUNT_UNKNOWN && kosafClean(f['지원금액'])
          ? {} : (kosafClean(f['지원금액']) ? { amountNote: kosafClean(f['지원금액']) } : {})),
        /* 🔴 금액은 **손으로 박지 않는다** — `parse-amount.js` 한 곳을 그대로 통과시킨다
           (2026-08-30 개발자 지적). 처음엔 amountValue 를 0 으로 박아 뒀는데, 그러면
           ① 재단이 적어 둔 금액이 홈 합계에서 통째로 빠지고 ② 앞으로 들어올 재단도
           영영 0 이다. 이름표를 붙여 넘기면 절대액·비율형·시급·미확인을 그쪽이 가른다.
           `amountSpec` 이 있으면 화면의 amountWon 이 그것을 읽는다(amountValue 는 폴백). */
        amountSpec: aSpec,
        amountValue: (aSpec.kind === 'fixed' || aSpec.kind === 'range') ? aSpec.value : 0,
        /* 이중수혜 조항도 같은 파일이 읽는다 — 합계는 더하기가 아니라 **고르기**라
           '타 장학금과 중복 불가'를 놓치면 학생이 못 받는 숫자를 받을 수 있다고 말하게 된다 */
        ...(aExcl && aExcl.kind ? { exclusivity: aExcl } : {}),
        deadline: i.due || null,
        listedAt: (kosafUpdatedAt || '').slice(0, 10) || null,   // 마감 미상일 때 60일 규칙이 걸리게
        period: i.due ? `접수 ~${i.due}` : (kosafClean(f['신청기간']) || ''),   // 모르면 비운다(2026-11-15 · 예전 '접수 기간 원문 확인' — 「접수」 절이 기간 줄을 안 그린다)
        summary: `${i.org} — 한국장학재단 등록 장학금.`,
        eligibility: { selective: true },     // 구조화된 조건이 없으니 판정하지 않는다(=unknown)
        ...(lines.length ? { eligibilityLines: lines } : {}),
        /* 「누가」·「성적」 칸(특정자격·성적기준)의 줄 — 이 칸의 줄이 **전부** 요건으로 못 읽혀 버려지고 거주 줄만 남으면 적합도는 「자격 미확인」이다
           (match-engine fitDetail 한 곳 · 2026-11-13 병합 리뷰 · 강서구장학회 「구민한마음」이 거주 기간 ✓ 하나로 95% 였다). 줄 글자는 eligibilityLines 와 같은 것 */
        ...(KOSAF_CORE.flatMap((k) => split(f[k])).length ? { kosafCoreLines: KOSAF_CORE.flatMap((k) => split(f[k])) } : {}),
        /* 「누가」 칸(특정자격)만 따로 — 이 칸의 줄이 **전부** 버려지면 성적 칸이 살아도 「자격 미확인」(fitDetail · 2026-11-13 · 1회차 수리 · 구민한마음 `2022 ~ 2026년 선발 … 장학생 8명`) */
        ...(split(f['특정자격']).length ? { kosafWhoLines: split(f['특정자격']) } : {}),
        ...(split(f['자격제한']).length ? { eligibilityExcludes: split(f['자격제한']) } : {}),
        documents: docs.length ? docs : ['재단 공고문에서 확인'],
        sourceUrl: i.home || '',
        sourceKind: 'kosaf',
        /* 🔴 **층2의 유일한 '공고 원문'** (2026-09-12 개발자 지시로 신설).
           그전까지 층2 재단이 학생에게 주는 것은 **재단 홈페이지 주소 하나**뿐이었다 —
           들어가도 그 공고가 어디 있는지는 학생이 다시 찾아야 했다. KOSAF 상세 화면은
           POST 전용이라 줄 주소가 아예 없고, KOSAF 첨부 원주소는 Referer 검사라
           앱에서 누르면 "비정상적인 접근"이 뜬다.
           → `collector/kosaf-attach.mjs` 가 리퍼러를 붙여 받아 둔 **우리 쪽 사본**을 준다.
           ⚠️ 여기 들어오는 것은 `data/kosaf-files/…` 뿐이다(kosaf-open.mjs 가 거른다).
              kosaf.go.kr 주소가 섞이면 학생이 못 받는다 — 관문 kosaf-check.mjs. */
        ...((i.files || []).length
          ? { attachments: i.files.map((f) => ({ name: f.name, url: f.path, bytes: f.bytes || 0 })) }
          : {}),
        ...(kosafClean(f['문의처']) ? { contact: kosafClean(f['문의처']) } : {}),
        /* 층2 줄에 함께 보여 줄 **재단이 적어 둔 칸** (2026-09-07 캘린더).
           자격 판정을 못 붙이는 대신 재단이 쓴 것을 그대로 옮긴다 — 해석하지 않는다. */
        ...(kosafClean(f['선발인원']) ? { headcount: kosafClean(f['선발인원']) } : {}),
        /* 재단 칸 중 자격·서류·금액·문의 밖의 것(선발방법·선발인원·추천필요여부)은 「공고 안내」 줄로 — 「이름표: 값」 원문 그대로(승인 시안 2026-11-02) · 「해당없음」은 말이 없다 */
        noticeLines: ['선발방법', '선발인원', '추천필요여부'].map((k) => [k, kosafNoticeValue(f[k])]).filter(([, v]) => v && !/해당\s*없음/.test(v)).map(([k, v]) => `${k}: ${v}`),
      };
    })
    /* 층2에도 앱 지원문서 (2026-10-13 ① · 개발자 "남은 것 모두 진행") — 머리말은 forms.js prepKindFor 의 'kosaf'(재단 접수 방법은 공고문 확인) */
    .map(attachPrepTemplate);
}

/* 실시간 공고 구역의 머리말 — '아직 안 옴'과 '없음' 이 같은 머리말을 쓰도록 한 곳에 둔다 */
/* 🔴 이름이 '우리 학교 실시간 공고' 였다 → **'우리 학교 게시판 새 공고'** (2026-09-18).
   홈으로 옮기면서 이름이 하는 일이 달라졌다 — 여기서 말해야 하는 것은 '실시간'이 아니라
   **이게 어디서 온 글인가**다(우리가 읽은 공고가 아니라 학교 게시판에 올라온 글). */
function liveNoticesHead(updatedAt) {
  /* ⚠️ 두 토막이 한 줄에 들어가야 한다 — 그려 놓고 재 보니 제목이 한 글자 길어지고 오른쪽
     글이 길어서 **둘 다 두 줄로 꺾였다**(390px). 제목은 옛 길이(11자)로, 오른쪽은 날짜만. */
  /* ⚠️ 제목 아래 설명 한 줄(`.section-sub`)을 2026-10-03 에 붙였다가 **같은 날 개발자 지시로
     걷었다** — 홈 아래 세 구역(학교 게시판 공고 · 우리 학교 소식 · 재단·지자체 새 공고)에
     전부 있었다. 다시 붙이지 말 것. */
  /* 🔴 갱신 날짜는 **누를 수 없는 글자**라 파랑(link-btn — 이 앱에서 '누를 수 있음')을 쓰지 않는다 (2026-10-10 팀 업무 분장 11번 · 은서) */
  return `<div class="section-head" style="margin-top:4px"><h3>우리 학교 게시판 공고</h3>
    <span class="section-note">${updatedAt ? esc(shortDay(updatedAt)) + ' 갱신' : '매일 아침 갱신'}</span></div>`;
}

/* ⚠️ 검색 인자를 걷었다 (2026-09-18) — 이 목록이 탐색 화면에 있던 시절에는 그 화면의
   검색창이 안 걸리면 "검색했는데 그대로"가 됐다(2026-09-12 · UI-16). 홈에는 검색창이
   없으므로 그 이유가 사라졌다. 다시 검색이 필요해지면 그 화면에 창이 생길 때 같이 둔다. */
/* 게시판 글 중 **내 학교 것 · 아직 등록 안 한 것**만 고른다 (2026-09-18 분리).
   🔴 이 목록을 두 곳이 본다 — 홈의 '우리 학교 게시판 공고' 와 '교내' 칸의 꼬리
   (`renderExplore`). 베끼면 한쪽에만 뜨는 공고가 생긴다. */
/* '이 주소는 이미 정식 등록됐나' — 학교 게시판 구역과 재단·지자체 구역이 **같은 잣대**를 쓴다 (2026-09-26 분리).
   URL 뒤에 목록 파라미터가 붙는 경우가 있어 전방일치로 비교한다. */
function registeredUrlMatcher() {
  /* 카드로 안 그리는 정식 공고(feedOnlyFormal — 기한·자격을 다 모름)의 주소는 빼지 않는다 — 그 글은 게시판 새 공고로 보여야 한다(2026-11-15 결정 1) */
  const p = state.profile;
  const regUrls = registeredList.filter((s) => !feedOnlyFormal(s, p)).map((s) => s.sourceUrl)
    .concat(NATIONAL_SCHOLARSHIPS.filter((s) => s.sourceKind === 'official' && s.sourceUrl).map((s) => s.sourceUrl))
    .filter(Boolean);
  return (url) => regUrls.some((u) => url.startsWith(u) || u.startsWith(url));
}

function boardNoticesForMe() {
  const p = state.profile;
  if (!p || !liveNotices) return [];
  // 정식 등록된 공고(registered.json + data.js 실공고)는 카드로 노출되므로 피드에서 제외
  // URL 뒤에 목록 파라미터가 붙는 경우가 있어 전방일치로 비교한다
  const isRegistered = registeredUrlMatcher();
  /* 내 학교 공고인지는 match-engine이 정한다 — 알림(notify-rules)도 같은 함수를 쓴다 */
  const fromFeed = (liveNotices.items || []).filter((n) => noticeForProfile(n, p) && !isRegistered(n.url));
  /* 카드로 안 그리는 정식 공고(feedOnlyFormal — 기한·자격을 다 모름 · 2026-11-15 결정 1)가 이 학교 게시판 글에 없으면(다른 게시판에서 온 공고) 여기 한 줄로 싣는다.
     🔴 판정은 match-engine feedOnlyBoardRows 한 곳 — 알림(notify-rules 「4. 실시간 공고」)도 같은 함수에 같은 목록(allScholarships — notify.js 가 넘기는 것)을 넘긴다 */
  const demoted = feedOnlyBoardRows(allScholarships(), fromFeed, p);
  const forMe = fromFeed.concat(demoted);
  /* 학자금 대출·융자는 장학금이 아니라서 매칭 카드로는 만들지 않는다(정직 원칙).
     그렇다고 피드에서까지 밀려 잘리면 학생이 대출 정보를 아예 볼 곳이 없어지므로,
     장학 공고를 앞에 두되 대출 공고는 뒤에 둔다 (2026-07-30 조정). */
  const isLoan = (n) => /대출|융자/.test(n.title);
  return forMe.filter((n) => !isLoan(n)).concat(forMe.filter(isLoan));
}

/* 🔴 **'교내' 칸에 함께 놓을 게시판 글** (2026-09-18 개발자 지적:
   *"실시간 공고 보니까 교내에서 진행되는 거 있는데 교내탭에는 안 들어가져 있어"*).
   실측으로 확인한 것 하나 — 한국외대 `[공통][교내] 2026-2학기 가족장학금` 이 홈에만 있고
   '교내' 칸에는 없었다(수집 기록 650건 중 학교가 제목에 `교내` 를 적어 둔 것이 29건).
   🔴 **우리가 주최를 알아맞히는 것이 아니다** — 학교가 제 게시판에 `[교내]` 라고 **직접
      적어 둔 글**만 온다. 그게 `noticeKind` 가 하는 일이고, 판정은 `match-engine.js`
      한 곳뿐이다(등록 로봇 auto-register 도 같은 함수를 쓴다).
   ⚠️ 제목에 표식이 없는 교내 장학금(경희대 반영장학·우정장학 등)은 여기 안 온다 —
      그건 원문을 읽어 정식 등록해야 알 수 있고, 그러면 이 꼬리가 아니라 카드가 된다.
      낱말 목록을 늘려 맞히려 하지 말 것(이 저장소가 같은 방식으로 여러 번 틀렸다). */
function boardNoticesInSchool() {
  return boardNoticesForMe().filter((n) => noticeKind(n.title) === '교내');
}

function liveNoticesHtml() {
  const p = state.profile;
  if (!p) return '';
  /* 🔴 **'아직 안 왔다'와 '없다'는 다른 말이다** (2026-09-09).
     예전에는 둘 다 빈 문자열이라 이 구역이 통째로 없다가 갑자기 나타났다 — 이 앱에서
     실제로 기다림이 보이는 거의 유일한 자리다(정식 등록 공고는 data.js 의 상시 제도가
     동기로 먼저 채워 목록이 빌 틈이 없다 — 실측으로 확인했다).
     ⚠️ 뼈대가 굳지 않는 것은 `liveNotices` 가 성공·실패와 무관하게 채워지기 때문이 아니라,
        실패하면 `null` 로 남기 때문이다. 그래서 아래 loadNotices 가 실패해도 **빈 문서**를
        넣어 이 구역이 '없음'으로 정직하게 내려앉게 한다. */
  if (!liveNotices) {
    return liveNoticesHead('') + (typeof skeletonRows === 'function' ? skeletonRows(3) : '');
  }
  /* 🔴 **상한을 걷었다** (2026-09-12 · UI-16). 8+2 는 이 목록이 '전체' 카드 **아래에**
     얹혀 있던 시절의 자리 다툼 때문이었다 — 제 칸이 생겼으니 학생이 보러 온 것을 잘라서
     보여 줄 이유가 없다(실측: 한국외국어대학교 22건 · 경희대학교 17건). */
  const mine = boardNoticesForMe();
  const head = liveNoticesHead(liveNotices.updatedAt);
  if (!mine.length) {
    return head + `<p class="empty" style="margin-bottom:16px">아직 ${esc(p.school)} 게시판 연결 전이거나 새 공고가 없어요<br />연결되면 실제 공고가 여기에 자동으로 떠요.</p>`;
  }
  /* 🔴 (2026-10-10 팀 업무 분장 11번 · 은서 — 「우리학교 게시판 공고 · 재단 지자체 새 공고 인터페이스 개선」)
     ① 카드마다 같은 「○○대학교 게시판」 윗줄이 반복됐다 — 구역 제목이 이미 그 말을 한다. 윗줄에는 **언제 올라왔나**를 적는다.
     ② 22건이 한꺼번에 깔려 홈이 끝없이 길었다 — 다른 구역처럼 석 장만 펴고 「더보기」로 **가려 둔 카드를 편다**
        (카드는 전부 그려 두고 CSS 가 가린다 · 다시 그리지 않으니 스크롤이 튀지 않는다 · 잘라 버리는 것이 아니다). */
  const cards = mine.map((n, i) => noticeCardHtml(n, { org: noticeDayLine(n), dateTop: true })
    .replace('class="sch-card notice-card', `class="sch-card notice-card${i >= HOME_DEADLINE_TOP ? ' home-extra' : ''}`)).join('');
  const more = mine.length > HOME_DEADLINE_TOP
    ? `<button type="button" class="link-btn home-more" id="live-more" data-live-more aria-controls="live-list" aria-expanded="${liveOpen ? 'true' : 'false'}">${liveOpen ? '접기' : `더보기 (${mine.length - HOME_DEADLINE_TOP}건)`}</button>`
    : '';
  return head + `<div class="card-list${liveOpen ? ' more-open' : ''}" id="live-list">` + cards + `</div>${more}<div style="margin-bottom:18px"></div>`;
}
let liveOpen = false;
/* 날짜 짧게 — 「10.08」 (연도가 올해가 아니면 앞에 붙인다) */
function shortDay(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s || '');
  return m[1] === String(new Date().getFullYear()) ? `${m[2]}.${m[3]}` : `${m[1]}.${m[2]}.${m[3]}`;
}
/* 게시판 카드 윗줄 — 「오늘 수집」·「어제 수집」·「10.08 수집」 (게시일이 있으면 그것) */
function noticeDayLine(n) {
  const d = n.postedAt || n.foundAt || '';
  const word = n.postedAt ? '게시' : '수집';
  if (!d) return '게시판';
  const days = Math.round((todayStart() - new Date(d + 'T00:00:00')) / 86400000);
  return days === 0 ? `오늘 ${word}` : days === 1 ? `어제 ${word}` : `${shortDay(d)} ${word}`;
}

/* 게시판 글 카드 한 장 — 홈과 '교내' 칸이 **같은 그림**을 쓴다 (2026-09-18 분리).
   ⚠️ 베끼지 말 것: 2026-09-11 에 카드 그림이 두 벌이라 한쪽에만 배지 무더기가 남아 있었다
      (실측 147장 중 9장). */
/* 소식 썸네일 경로 — 로봇이 만든 해시 이름만 그린다(collector/news-thumb.mjs THUMB_RE 와 같은 꼴 · 관문이 대조). 그 밖의 값(바깥 주소 등)은 그리지 않는다 */
const NEWS_THUMB_RE = /^data\/news\/img\/[0-9a-f]{16}\.webp$/;
/* 학교 대표 사진 — 글에 사진이 없을 때 대신 (2026-10-03 · tools/build-school-photos.mjs 가 만든 이름 꼴만 · 자를 자리도 꼴을 본다) */
const SCHOOL_PHOTO_RE = /^assets\/schools\/[a-z0-9]+-[0-9a-f]{8}\.webp$/;
const PHOTO_FOCUS_RE = /^\d{1,3}% \d{1,3}%$/;
function noticeCardHtml(n, opts) {
  const o = opts || {};
  const tSplit = splitTitleDates(unent(n.title));   // 카드 제목의 날짜·기간 — 공용 규칙(2026-10-05)
  const thumb = o.thumb && NEWS_THUMB_RE.test(o.thumb) ? o.thumb : '';
  const link = sourceLink(n, 'card');
  /* 안전하지 않은 주소면 href 를 아예 안 단다 — `href=""` 는 앱 자신을 다시 연다(첨부와 같은 사고 · 2026-10-03)
     🔴 주소도 이름과 같은 link 에서 — 바로잡은 원문(source-link.js ⑥)이 있으면 그 주소다. n.url 로 열면 이름은 「원문」인데 목록이 열린다(리뷰 2026-10-04) */
  const href = safeUrl(link.href);
  const sp = !thumb && o.schoolPhoto && SCHOOL_PHOTO_RE.test(o.schoolPhoto.src || '') ? o.schoolPhoto : null;
  return `
    <a class="sch-card notice-card${thumb || sp ? ' has-thumb' : ''}"${href ? ` href="${esc(href)}" target="_blank" rel="noopener"` : ''}>
      ${/* 🔴 맨 윗줄은 매칭 카드와 **같은 말투**다 — 기관 글 + 판정 하나 (2026-09-11).
           예전엔 배지 셋(`교내 공고`·`마감 임박`·`양식 2`)이 한 줄을 채워, 페이스리프트로
           걷어낸 배지 무더기가 이 경로에만 그대로 남아 있었다(실측 147장 중 9장).
           🔴 첨부 개수를 `badge-applied` 로 쓰지 말 것 — 그 색은 '신청 완료'의 초록이라
              첨부가 있다는 말이 신청이 끝났다는 말로 읽혔다. 아래 메타 줄로 내린다. */ ''}
      <div class="sch-top">
        ${/* 🔴 **`교내 공고` 로 못 박혀 있었다** (2026-09-18 개발자 지적: "교내공고에서 교내로").
             학교 게시판에서 온 글이라는 뜻으로 적은 말인데, 목록 카드는 바로 이 자리에
             `교외 · (재)수림재단` 처럼 **교내/교외 구분**을 적는다. 그래서 학생이 읽기에는
             제목이 `[공통][교외]` 인 공고가 `교내 공고` 로 뜨는 화면이었다 —
             실측: 한국외대 실시간 27건 중 **26건이 교외**인데 27건 전부 '교내 공고'.
             🔴 판정을 여기서 새로 만들지 않는다 — `match-engine.js` 의 `noticeKind` 하나다
                (등록 로봇 auto-register 도 같은 함수를 쓴다. 베끼면 같은 공고가 목록과
                실시간 구역에서 다른 말을 한다). */ ''}
        ${/* 🔴 **교내/교외를 여기서 말하지 않는다** (2026-09-18 개발자 지시).
             *"교내 교외가 어디에 게시되느냐가 아니라 어떤 재단이 주최하는가가 기준이 되어야 돼."*
             이 카드는 제목·링크뿐이라 **주최를 모른다** — 그래서 아는 것(어느 게시판에서 왔나)만
             적는다. 같은 날 아침에 `noticeKind` 로 교내/교외를 적어 봤지만, 그건 제목 표식일 뿐
             주최가 아니다. 실측: 제목의 바깥 기관 낱말로 갈라 보니 `정영오 장학금`·`구종서
             장학금`·`금신사랑`·`선원가족` 같은 외부 장학금이 전부 '교내 후보' 로 떨어졌다.
             🔴 낱말 목록을 늘려 다시 맞히려 하지 말 것 — 이 저장소가 같은 방식으로 여러 번 틀렸다.
                진짜로 알려면 원문을 읽어 정식 등록해야 하고, 그러면 이 목록이 아니라 카드가 된다. */ ''}
        ${/* 대외활동·공모전 탭은 윗줄만 바꿔 쓴다(opts.org · 2026-09-25) — 카드 그림은 이 한 벌이다 */ ''}
        ${o.org ? `<span class="sch-org">${esc(o.org)}</span>` : `<span class="sch-org">${esc(n.school)}${n.campus ? ' ' + esc(n.campus) : ''} 게시판</span>`}
        ${/* 마감을 **읽은** 글만 D-day 를 단다 (2026-09-29 · 원문 이름표 뒤 날짜 — 장학 카드와 같은 dday()·같은 글자). 못 읽은 글은 아래 기간 한 줄이 원문 그대로 말한다. */ ''}
        ${o.dday ? `<span class="sch-due${o.dday.urgent ? ' urgent' : ''}">${esc(o.dday.label)}</span>` : ''}
        ${/* 🔴 **'마감 임박' 배지를 여기 달지 않는다** (2026-09-12 · UI-16 으로 이 카드가 제 칸을
             갖게 되면서 드러났다). 그 배지는 `deadlineHint` 가 **있기만 하면** 붙었다 — 본문에
             '까지'·'마감' 이라는 낱말이 한 번이라도 나오면 붙는다는 뜻이라, `마감 안내 작성일
             2026.08.31 … 조회수 5` 같은 게시판 껍데기에도 빨간 '마감 임박' 이 달려 있었다.
             우리는 이 글의 마감일을 **모른다**(수집한 것은 제목·링크·기간 문장 한 줄뿐이다).
             모르는 것을 단정하지 않는다(원칙 8-1) — 기간은 아래 줄이 원문 그대로 말한다. */ ''}
      </div>
      <p class="sch-name">${esc(tSplit.title)}</p>
      ${o.desc ? `<p class="sch-desc">${esc(unent(o.desc))}</p>` : ''}
      ${/* 제목에서 뗀 마감·기간은 D-day·기간 줄이 없는 카드에서만 회색 줄로 — 같은 사실을 두 번 적지 않는다 */ ''}
      ${!o.dday && !(o.excerpts || []).length && !(n.deadlineHint && hintShort(n.deadlineHint)) && tSplit.dates.length ? `<p class="sch-provider">${esc(tSplit.dates.join(' · '))}</p>` : ''}
      ${/* 원문 발췌 줄 (2026-09-29 · 활동 글) — 이름표 : 원문 문장. 발췌가 있으면 기간 한 줄은 겹쳐 적지 않는다 */ ''}
      ${(o.excerpts || []).map((x) => `<p class="sch-provider">${esc(x.label)} · ${esc(unent(x.text))}</p>`).join('')}
      ${!(o.excerpts || []).length && n.deadlineHint && !/window\.|dataLayer|function|\)\s*\)/.test(n.deadlineHint) && hintShort(n.deadlineHint) ? `<p class="sch-provider">${esc(hintShort(n.deadlineHint))}</p>` : ''}
      ${/* 링크 이름은 sourceLink 한 곳(card) — 목록·홈페이지·로봇이 확인한 문제 주소는 '원문'이라 부르지 않는다 (2026-10-03) */ ''}
      <p class="sch-provider">${[(n.attachments || []).length ? `첨부 ${(n.attachments || []).length}개` : '', o.dateTop || !n.foundAt ? '' : `${esc(shortDay(n.foundAt))} 수집`, link.label ? esc(link.label) : ''].filter(Boolean).join(' · ')}</p>
      ${/* 그 글의 사진 썸네일 (2026-10-03 개발자 지시 — 학교 글의 실제 사진). 소식 카드만 opts.thumb 로 넘긴다 · 제목이 이미 글자로 있어 alt 는 비운다(읽기 도구가 두 번 읽지 않게).
           못 받으면(404·오프라인) 그림을 빼고 글자 카드로 돌아간다 — bindEvents 의 error 잡이 · CSP 가 onerror= 를 막는다 */ ''}
      ${thumb ? `<img class="notice-thumb" src="${esc(thumb)}" alt="" loading="lazy" decoding="async" width="72" height="72" />` : ''}
      ${/* 글에 사진이 없으면 학교 대표 사진 (2026-10-03 개발자 지시) — 글의 사진과 같은 자리·같은 모양(같은 img 한 장).
           🔴 사진 위 「학교 사진」 표시는 **개발자 지시로 뺐다**(같은 날 *"학교사진에 '학교사진' 이라는 디스크립션 빼"*) — 다시 붙이지 말 것(관문이 잠근다).
           출처 줄(작가·라이선스 — 열린 라이선스의 표기 의무)은 구역 아래 한 번(schoolNewsHtml) · 학교 사진인지는 클래스(notice-thumb-school)로만 안다 */ ''}
      ${sp ? `<img class="notice-thumb notice-thumb-school" src="${esc(sp.src)}" alt="" loading="lazy" decoding="async" width="72" height="72"${PHOTO_FOCUS_RE.test(sp.focus || '') ? ` style="object-position:${esc(sp.focus)}"` : ''} />` : ''}
    </a>`;
}

/* 학교 사진 고르기 — 학교에 여러 장이면 구역에서 사진 없는 카드의 차례(k)대로 돌아가며 쓴다(이웃 카드끼리 같은 사진이 이어지지 않게).
   🔴 글마다 해시로 고르면 이웃이 겹친다 — 실측: 전북대 앞 다섯 장이 같은 사진 셋 연속(리뷰 10-03). 차례를 모르면(k 없음) 첫 장 */
let schoolPhotos = null;   // assets/schools/photos.json — 못 받으면 null(그대로 글자 카드)
function schoolPhotoFor(n, k) {
  /* 🔴 내 학교 글에만 — 분교 학생(한양 ERICA·건국 글로컬·홍익 세종)은 본교 게시판 글을 같이 받는데, 본교 사진은 **다른 캠퍼스 사진**이고
     출처(「사진 출처」 · 내 학교 사진만 적는다)도 안 맞는다(리뷰 10-04). 그 글은 글의 사진만, 없으면 바탕색 칸 */
  const me = state.profile && state.profile.school;
  if (me && n && n.school !== me) return null;
  const list = ((schoolPhotos && schoolPhotos.schools && schoolPhotos.schools[n.school]) || [])
    .filter((x) => x && SCHOOL_PHOTO_RE.test(x.src || ''));
  if (!list.length) return null;
  return list[(Number.isInteger(k) && k >= 0 ? k : 0) % list.length];
}

/* ---------------- 대외활동·공모전 (2026-09-25 · 노션 UI-34) ----------------
   로봇이 학교 게시판에서 주운 **제목+링크** 목록(data/activities.json)을 제 탭에 보인다.
   장학 피드의 '우리 학교 게시판 공고'와 같은 종류라 **같은 카드 그림**(noticeCardHtml)을 쓴다 —
   윗줄 글자만 '공모전 · 경희대학교 게시판' 처럼 종류를 앞세운다(두 번째 카드 함수를 만들지 않는다 ·
   2026-09-11 카드 두 벌 사고). 자격·적합도·양식은 없다 — 원문을 읽지 않은 것을 판정하지 않는다(8-1).
   🔴 받아오기 실패는 **빈 문서**로 내려앉힌다(`null` 로 두면 뼈대가 굳는다 — loadNotices 와 같은 규칙).
   🔴 새 데이터가 오면 rerenderVisible 을 부른다 — 갈라 두면 한 화면만 굳는다(2026-09-01 규칙). */
let liveActivities = null;
let activitiesFilter = 'all';
/* 분야 칩 (2026-10-03 개발자 지시 "제목 아래 회색 분류를 위에 버튼으로") — 종류와 **다른 축**이다.
   종류 칩과 같이 **저장하지 않는다**(탐색의 exploreFilter 와 같은 성격 — 새로고침하면 전체). */
let activitiesField = 'all';
/* 🔴 '기타'는 **화면의 이름일 뿐**이다 — 데이터는 지금처럼 비워 둔다(activityField 가 null 을 낸다).
   수집기 관문(verify/test-collector 「못 가르면 null — 억지로 기타라고 적지 않는다」)이 그걸 지킨다.
   즉 학생에게 "분야를 아직 못 읽은 글"을 부르는 이름이 기타이고, 데이터가 기타라고 말하는 게 아니다. */
const ACT_FIELD_ETC = '기타';
const ACT_FIELD_FOLD = 6;          // 접었을 때 보이는 분야 수(분야 전체 · +n 제외) — 375px 에서 「+n」 까지 두 줄 · ponytail: 글자 폭을 안 재는 어림이라 분야 이름이 길어지면 셋째 줄로 샐 수 있다
let activitiesFieldOpen = false;   // 「+n」 으로 펼쳤는가 — 종류 칩과 같이 저장하지 않는다
let activitiesQuery = '';
/* 정렬 둘 — 등록 최신순(기본) · 마감 임박순(마감을 읽은 글이 앞, 못 읽은 글은 뒤에 최근순) (2026-09-29 · 4차 리서치: 경쟁 앱의 기본 축) */
let activitiesSort = 'recent';

function loadActivities() {
  return fetch('data/activities.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((d) => {
      tidyData(d);   // 깨진 글자 씻기(2026-11-17)
      liveActivities = d || liveActivities || { items: [], updatedAt: null };
      refreshActivitySnaps();
      fillInterestFields();   // 온보딩 관심 분야 칸 — 목록이 이제 왔다(고른 것은 지킨다)
      rerenderVisible();
    });
}

/* 내 학생에게 보이는 글 — 학교 범위는 match-engine 의 activityForProfile 한 곳(학교 글은 장학 피드와
   같은 잣대 · 학교가 빈 글은 전국). 여기서 학교 이름을 다시 비교하지 않는다. */
function activitiesForMe() {
  const p = state.profile;
  if (!p || !liveActivities) return [];
  /* 관리자가 숨긴 글(hidden · activity-config.json)은 보이지 않는다 — 지운 것이 아니라 표식이다.
     마감을 읽은 글은 장학 목록과 같은 규칙(CLOSED_KEEP_DAYS)으로 마감 다음 날까지만 — 마감을 못 읽은 글은 60일 규칙(로봇)에 맡긴다 */
  return (liveActivities.items || []).filter((n) => n && n.url && !n.hidden && activityForProfile(n, p)
    && (!n.deadline || dday(n.deadline).days >= -CLOSED_KEEP_DAYS));
}

/* 분야 칩 줄을 **데이터에서 만든다** (2026-10-03).
   🔴 분야 이름을 여기 적지 않는다 — 원본 목록은 collector/activity-kind.mjs 의 ACTIVITY_FIELDS
      한 곳이고, 앱은 빌드가 없어 그 .mjs 를 못 들여온다. 적으면 두 벌이 되어 수집기가 갈래를
      늘려도 화면은 모른다(관리자 화면은 _admin/build.sh 의 vendor 복사로 같은 문제를 푼다).
      그래서 **지금 보이는 글들의 field 를 세어** 많은 순으로 늘어놓는다. 덤으로:
        · 실제 0건인 갈래(체험단·네이밍·슬로건)는 애초에 안 뜬다 — 눌러도 빈 목록인 칩이 없다.
        · 종류를 바꾸면 그 종류에 있는 분야만 뜬다.
   🔴 고른 칩이 **사라지면 그 자리에서 푼다** — 종류를 바꾸면 그 분야가 없을 수 있다(공모전에만 있는
      '영상·사진'을 고른 채 대외활동으로 옮기는 길). 안 풀면 칩은 켜져 있는데 목록이 0건이 된다. */
function renderActivityFieldChips(list) {
  const row = $('#activities-field-filters');
  if (!row) return;
  const n = new Map();
  let etc = 0;
  for (const it of list) { if (it.field) n.set(it.field, (n.get(it.field) || 0) + 1); else etc += 1; }
  const fields = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([f]) => f);
  if (etc) fields.push(ACT_FIELD_ETC);                              // 못 읽은 글은 늘 맨 뒤
  if (activitiesField !== 'all' && !fields.includes(activitiesField)) activitiesField = 'all';   // 고른 칩이 사라졌다
  /* 칩이 하나도 없으면(분야가 다 비었다) 줄 자체를 감춘다 — 「전체」만 덩그러니 두지 않는다 */
  /* 🔴 첫 칩을 그냥 '전체'라 하지 않는다 — 윗줄(종류) 첫 칩도 '전체'라 두 개가 위아래로 겹쳐
     어느 쪽을 끄는 단추인지 안 읽힌다(화면으로 확인). */
  row.hidden = !fields.length;
  /* 🔴 옆으로 밀지 않는다 (2026-10-04 개발자 지시 "분야가 너무 길어서 옆으로 넘겨야 해 불편") —
     줄바꿈하고, 많은 순 ACT_FIELD_FOLD 개만 보인 뒤 「+n」 칩으로 펼친다(두 줄 안팎).
     고른 칩은 접어도 늘 보인다 — 숨으면 무엇으로 걸렀는지 안 보인다. */
  let shown = activitiesFieldOpen ? fields : fields.slice(0, ACT_FIELD_FOLD);
  if (activitiesField !== 'all' && !shown.includes(activitiesField)) shown = [...shown, activitiesField];
  const rest = fields.length - shown.length;
  row.innerHTML = ['all', ...shown].map((f) => `<button class="filter-chip${f === activitiesField ? ' active' : ''}" data-filter="${esc(f)}">${esc(f === 'all' ? '분야 전체' : f)}</button>`).join('')
    + (rest > 0 ? `<button class="filter-chip field-more" data-more="open" aria-label="분야 ${rest}개 더 보기">+${rest}</button>`
      : activitiesFieldOpen && fields.length > ACT_FIELD_FOLD ? '<button class="filter-chip field-more" data-more="close">접기</button>' : '');
}

/* ── 대외활동 탭 관문 (2026-10-24 · 개발자 지시 4) ─────────────────────────────────
   관심 종류(interestKinds)를 하나 이상 골라야 탭이 열린다. 값은 온보딩 5단계가 적던 그 칸이라(2026-10-04) 이미 고른 학생은 바로 지난다.
   🔴 '지났나'는 이 함수 한 곳 — 홈 「나에게 맞는 대외활동」(homeActivitiesHtml)도 같은 것을 본다. */
function activityGateDone(p) {
  return !!(p && Array.isArray(p.interestKinds) && p.interestKinds.length);
}
let actGateEditing = false;   // 「관심 바꾸기」로 다시 연 상태 — 취소가 있다
function renderActivityGate() {
  const p = state.profile || {};
  $$('#in-act-kinds input').forEach((cb) => (cb.checked = (p.interestKinds || []).includes(cb.value)));
  fillInterestFields(p.interestFields || []);
  $('#act-gate-cancel').hidden = !actGateEditing;
  /* 「내 정보」 — 장학금 학적정보에서 온 한 줄(학교·학년·학적) + 활동 글이 묻는 칸들 */
  $('#act-gate-me').textContent = [[p.school, p.campus].filter(Boolean).join(' '), p.year ? p.year + '학년' : '', p.status].filter(Boolean).join(' · ');
  drawActivityAsk(true);
}

/* ── 대외활동 관문 「내 정보」 (2026-11-15 개발자 지시 — "장학금 학적정보 입력이 대외활동 적합도·자격요건 매칭에 연동되게 ·
   정보 입력 다각화 … 장학금과 연동") ──
   활동 카드의 적합도는 처음부터 장학금과 **같은 프로필·같은 엔진**(activityFit → evaluateFor)으로 잰다. 다만 관문이 종류·분야 둘만 물어
   그 사실이 안 보였고, 활동 글이 자주 묻는 칸(태어난 해·거주지·봉사 실적…)이 비어 있으면 그 줄은 판정되지 않았다.
   그래서 관문이 **지금 보이는 활동 글의 자격 줄이 실제로 쓰는 학적정보 칸**을 같이 보이고 받는다 — 저장하는 곳은 장학금과 같은 프로필 칸이다
   (birthYear·region·traits… · 새 칸을 만들지 않는다 → 여기서 적으면 장학금 적합도에도, 학적정보에서 적으면 여기에도 쓰인다).
   🔴 칸 목록을 손으로 적지 않는다 — 공고 안 「미확인 자격」과 같은 탐침(elig-ask askableForSch)을 **묻는 칸을 비운 프로필**로 돌려 센다.
      글이 바뀌면 묻는 칸도 저절로 바뀐다. 한 곳만 쓰는 칸(혜택 줄에 걸린 낱말 같은 잡음)은 안 묻는다(ACT_ASK_MIN).
   🔴 처지(예/아니요)는 여기서 안 묻는다 (2026-11-15 리뷰) — 활동 글은 혜택·태그 줄(「1365 자원봉사시간 부여」·「#공모전」)이 처지 요건으로 읽히는 잡음이 있어
      「아니요」가 틀린 미달을 만든다. 처지는 공고 안 「미확인 자격」과 온보딩이 묻는다.
   🔴 줄마다 조건 종류가 읽는 칸만 찔러 본다(elig-ask probeKeysFor) — 전부 찔러 보면 화면이 몇 초 멈춘다(리뷰 실측).
   ponytail(옛 메모): 관문을 그릴 때 한 번 (보이는 글 × 자격 줄 × 칸) 탐침 — 글 100건에 1만 번 안팎. 글이 천 건대로 늘면 수집 로봇이 세어 싣는 쪽으로 옮긴다. */
const ACT_ASK_MIN = 2;
let actAskMemo = null;   // { src, who, keys } — 같은 글 목록·같은 학적(묻는 칸을 비운 프로필)이면 다시 세지 않는다
function activityAskKeys() {
  const p = state.profile;
  if (!p || !liveActivities || typeof askableFields !== 'function') return [];
  const blank = Object.assign({}, p, { traits: {} });
  Object.keys(FIELD_PROBE).forEach((k) => { blank[k] = null; });
  const who = JSON.stringify(blank);
  if (actAskMemo && actAskMemo.src === liveActivities && actAskMemo.who === who) return actAskMemo.keys;
  const n = new Map();
  for (const it of activitiesForMe()) {
    const sch = activityAsSch(it);
    const hit = new Set();
    for (const line of sch.eligibilityLines) {
      const only = probeKeysFor(line);
      askableFields(line, blank, sch, only ? only.filter((k) => k.indexOf('trait:') !== 0) : Object.keys(FIELD_PROBE)).forEach((k) => hit.add(k));
    }
    hit.forEach((k) => n.set(k, (n.get(k) || 0) + 1));
  }
  const keys = [...n.entries()].filter(([k, c]) => c >= ACT_ASK_MIN && k.indexOf('trait:') !== 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  actAskMemo = { src: liveActivities, who, keys };
  return keys;
}
/* force 없이 부르면 **빈 칸일 때만** 그린다 — 글 목록이 뒤늦게 와도 학생이 적던 값을 지우지 않는다(fillInterestFields 와 같은 규칙) */
function drawActivityAsk(force) {
  const box = $('#act-gate-ask');
  if (!box || (!force && box.children.length)) return;
  box.innerHTML = eligAskRowsHtml(activityAskKeys());
  box.hidden = !box.children.length;
  eligAskWireTraits(box);
}
/* 관문이 열리면 목록·칩·검색·정렬을 감춘다 — 관문을 지나기 전에는 쓸 수 없다(지시 4) */
function activityGateShow(on) {
  $('#activities-gate').hidden = !on;
  $('#act-gate-bar').hidden = on;
  ['#screen-activities .search-box', '#activities-filters', '#activities-field-filters', '#activities-list',
    '#screen-activities .data-note', '#screen-activities .sort-wrap'].forEach((sel) => { const el = $(sel); if (el) el.hidden = on; });
  if (!on) {
    const p = state.profile || {};
    const n = (p.interestFields || []).length;
    $('#act-gate-summary').textContent = `관심 ${(p.interestKinds || []).join(' · ')}${n ? ` · 분야 ${n}개` : ''}`;
  }
}
function saveActivityGate() {
  const kinds = $$('#in-act-kinds input:checked').map((c) => c.value);
  if (!kinds.length) { toast('종류를 하나 이상 골라 주세요'); return; }
  const fields = $$('#in-act-fields input:checked').map((c) => c.value);
  if ($('#act-gate-ask') && !guardStepOk($('#act-gate-ask'))) return;   // 「내 정보」 칸에 다 못 친 값
  state.profile.interestKinds = kinds;
  state.profile.interestFields = fields.length ? fields : null;
  eligAskCollect($('#act-gate-ask'));   // 「내 정보」 — 장학금과 같은 프로필 칸에 적는다(2026-11-15)
  saveState();
  actGateEditing = false;
  renderActivities();
  if (!$('#screen-home').hidden) renderHome();
}

let actGateDrawn = false;     // 관문 칸을 프로필로 그려 둔 상태 — 데이터가 다시 와도(새로고침·복귀) 학생이 고르던 체크를 지우지 않는다(코드 리뷰)
function renderActivities() {
  const p = state.profile;
  if (!p) return;
  /* 관문 — 관심을 고르기 전에는 목록을 그리지 않는다(2026-10-24 지시 4) */
  const gateOn = !activityGateDone(p) || actGateEditing;
  activityGateShow(gateOn);
  if (gateOn) {
    if (!actGateDrawn) { renderActivityGate(); actGateDrawn = true; }
    else { fillInterestFields(); drawActivityAsk(); }   // 분야 목록·묻는 칸이 뒤늦게 와도 고른 것은 지킨다(인자 없이 = 체크 유지)
    return;
  }
  actGateDrawn = false;
  const box = $('#activities-list');
  /* 🔴 갱신 날짜는 보이지 않는다(2026-09-30 개발자 지시) — 머리줄 셋째 칸이 정렬 단추를 가운데로 밀었다 */
  if (!liveActivities) {   // 아직 오는 중 — '없다'와 다른 말이다
    box.innerHTML = typeof skeletonRows === 'function' ? skeletonRows(3) : '';
    return;
  }
  let list = activitiesForMe();
  if (activitiesFilter !== 'all') list = list.filter((n) => n.kind === activitiesFilter);
  /* 🔴 분야 칩은 **종류로 거른 뒤 · 분야로 거르기 전**에 만든다 (2026-10-03).
     분야로 거른 목록에서 세면 칩 하나를 누르는 순간 나머지 칩이 사라진다. */
  renderActivityFieldChips(list);
  /* 분야 거르기 — 종류 뒤 · **검색 앞**. '기타'는 field 가 비어 있는 글이다. */
  if (activitiesField !== 'all') {
    list = list.filter((n) => (activitiesField === ACT_FIELD_ETC ? !n.field : n.field === activitiesField));
  }
  /* 검색은 카드에 **보이는 글자**(제목)로만 — 탐색 화면과 같은 규칙(2026-08-30) */
  const q = activitiesQuery.trim().toLowerCase();
  /* 검색은 카드에 보이는 글자로 — 제목 · 분야 · 발췌 줄 */
  if (q) list = list.filter((n) => [n.title, n.field, ...(n.excerpts || []).map((x) => x.text)].filter(Boolean).map((x) => String(unent(x)).toLowerCase()).some((x) => x.includes(q)));
  const byRecent = (a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || ''));
  /* 마감 임박순은 **마감을 읽은 글끼리만** 잰다 — 못 읽은 글에 가짜 날짜를 주지 않는다(dday 의 가짜 14 를 순서에 쓰지 말 것 · CLAUDE.md) */
  const byDeadline = (a, b) => (a.deadline && b.deadline ? a.deadline.localeCompare(b.deadline) : a.deadline ? -1 : b.deadline ? 1 : byRecent(a, b));
  /* 적합도순 — 장학 탐색(EXPLORE_SORTS.fit)과 같은 순서: fitRank 먼저(미달은 맨 아래), 그 안에서 적합도, 같으면 마감 */
  const fits = activitiesSort === 'fit' ? new Map(list.map((n) => [n, activityFit(n)])) : null;   // 한 번만 잰다(비교마다 엔진을 돌리지 않게)
  const byFit = (a, b) => { const fa = fits.get(a), fb = fits.get(b); return fitRank(fa) - fitRank(fb) || fb.fit - fa.fit || byDeadline(a, b); };
  list = list.slice().sort(activitiesSort === 'deadline' ? byDeadline : activitiesSort === 'fit' ? byFit : byRecent);
  const sortLabel = $('#activities-sort-label');
  if (sortLabel) sortLabel.textContent = (ACTIVITY_SORTS[activitiesSort] || ACTIVITY_SORTS.recent).label;
  if (!list.length) {
    box.innerHTML = `<p class="empty">${q
      ? `'${esc(activitiesQuery.trim())}'와 맞는 글이 없어요`
      : `아직 ${esc(p.school)} 게시판에서 모은 ${activitiesField === 'all' ? '' : esc(activitiesField) + ' '}${activitiesFilter === 'all' ? '대외활동·공모전' : esc(activitiesFilter)} 글이 없어요<br /><span class="empty-sub">게시판이 연결되면 새 글이 여기에 자동으로 떠요</span>`}</p>`;
    return;
  }
  box.innerHTML = list.map(activityCardHtml).join('');
}

/* ── 대외활동·공모전 카드와 상세 시트 (2026-10-01 개발자 지시: *"장학금처럼 깔끔하게 · 공고도 카드 형식으로 열리게 ·
   장학금 탭이랑 똑같은 흐름"*) ──
   그전에는 게시판 글 카드(noticeCardHtml)에 발췌 대여섯 줄을 쌓아 카드 한 장이 화면 반을 먹었고, 누르면 앱을 떠나
   원문 사이트로 바로 나갔다. 이제 장학 카드와 **같은 그림**(cardShellHtml)으로 석 줄만 보이고, 누르면 장학과 **같은
   시트**(#detail-sheet)가 열려 발췌·첨부·원문 단추를 보여 준다. 신청은 원문에서 한다(우리가 접수하지 않는다 · 원칙 1).
   🔴 자격·적합도·양식은 붙이지 않는다 — 원문을 읽어 판정한 것이 아니다(원칙 8-1). 발췌는 원문 문장 그대로다. */
/* 카드·시트 윗줄의 주최 — 학교 게시판에서 주운 글은 주최를 모른다(「○○대학교 게시판」은 어디에 올라왔는지이지 누가 주는지가 아니다 · 2026-11-02 개발자 결정: 학생 화면에 적지 않는다 · school 칸은 범위 판정에만) · 호스트가 있는 전국 글만 */
const activityHostLine = (n) => (n.school ? '' : String(n.host || '').trim());
/* 혜택 줄이 짧으면 카드 아랫줄 왼쪽(장학 카드의 금액 자리)에 굵게 — 길거나 없으면 분야를 옅게 */
const activityBenefit = (n) => ((n.excerpts || []).find((x) => x.label === '혜택') || {}).text || '';

/* ── 대외활동 제목·혜택을 깔끔하게 (2026-10-04 개발자 지적 — *"제목도 날짜나 이모티콘이 들어가 있는 등 깔끔하지가 않고 …
   파란 글씨 … 원문 그대로 들어가서 진짜 개못생겼어 … 공고 카드에 넣어 주든가 깔끔하게 정리해서"*) ──
   🔴 지우고 나누기만 한다 — 글자를 지어내지 않는다(원칙 8-1). 원제목은 데이터에 그대로 있고 '원문에서 신청하기'가 원문으로 간다.
   🔴 주최를 적은 대괄호(`[감사원]`·`[KOICA…]`)는 남긴다 — 정책브리핑 글은 그것이 유일한 주최 정보다. 게시판 분류표(`[일반]`·`[공고]`)만 뗀다 */
const ACT_TAG = /^(?:일반|공통|외부|공고|공지|모집|안내|홍보|국제학생|학사|봉사|행사|교내|교외|마감|모집중|접수중|진행중|이벤트)$/;
function activityTitle(n) {
  let t = unent(String((n && n.title) || '')).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/[\u2022\u25CF]/g, '\u00B7').replace(/[\u2605\u2606\u261E]+/g, ' ').replace(/\s+/g, ' ').trim();   // 제목의 굵은 점·별·손가락 기호는 가운뎃점이나 공백으로 — 꾸밈이지 뜻이 아니다 (2026-10-15)
  const before = t;
  t = t.replace(/\s*기간\s*:\s*\d{4}[\d.\s~\-]*$/, '');                                   // 정책브리핑 `… 기간 : 2026.09.14 ~ 2026.10.13`
  t = t.replace(/\s+\S*(?:팀|과|처|센터)\s+\d{4}-\d{2}-\d{2}.*$/, '');                     // 게시판 행 찌꺼기 `학생지원팀 2026-05-18 1,0…`
  t = t.replace(/\s+\d{4}\s?[.\-]\s?\d{1,2}(?:\s?[.\-]\s?\d{1,2})?\.?\s*$/, '');         // 꼬리 날짜 `2026.09 . 28` · `2026.08.04`
  t = t.replace(/^(?:마감|모집중|접수중)\s+/, '');
  t = t.replace(/^(?:[[【]\s*[^\]】]{1,14}\s*[\]】]\s*)+/, (run) => run.replace(/[[【]\s*([^\]】]{1,14})\s*[\]】]\s*/g, (m, tag) => (ACT_TAG.test(tag.trim()) ? '' : m)));
  t = t.replace(/\s*[(（]\s*~[^()（）]*(?:[(（][^()（）]*[)）][^()（）]*)*[)）]\s*$/, '');      // `(~10/22)` · `(~9/30(금)까지)`
  t = t.replace(/\s*(?:자세히|더보기)\s*$/, '').replace(/[\s·\-–—:,]+$/, '').trim();
  t = splitTitleDates(t).title;   // 남은 날짜·기간은 카드 제목 공용 규칙으로(2026-10-05)
  return t.length >= 4 ? t : before;
}
/* 혜택 원문은 `○ 맞춤형 정책상담 · 일자리 … ○ 참여혜택 · 대면 …` 처럼 한 줄에 여럿이 붙어 온다 — 항목으로 **나누기만** 한다 */
function benefitItems(text) {
  const t = unent(String(text || '')).replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s*[○◯●■□\u25AA\u25B6•]\s*/).map((x) => x.trim()).filter((x) => x.length >= 2);   // 네모·세모 기호는 번호로 적는다(화면 말투 관문 ui-tone)
  return parts.length ? parts : (t ? [t] : []);
}
/* 카드 아랫줄 — 짧은 혜택은 그대로, 긴 혜택은 첫 항목의 이름(원문 글자)만 + '외 n' */
function benefitShort(text) {
  const t = unent(String(text || '')).trim();
  if (t && t.length <= 20) return t;
  const items = benefitItems(t);
  const label = (items[0] || '').split(/\s*(?:·|[:：](?!\d))\s*/)[0].trim();   // `1:1 매칭` 의 콜론은 이름표가 아니다
  if (!label || label.length > 16) return '';
  return items.length > 1 ? `${label} 외 ${items.length - 1}` : label;
}
/* 제목 괄호 속 대상(`(기존 전라남도 22개 시·군 대상)`)은 자격이다 — 본문·API 칸에 없고 제목에만 있어 서울 학생에게 95% 가 떴다(2026-10-04) */
const titleTargetLines = (title) => [...String(unent(title || '')).matchAll(/[(（]([^()（）]{4,40}대상)[)）]/g)].map((m) => m[1].trim());

/* 활동 글 → 판정 엔진이 읽는 모양 (2026-10-01). 칸 이름이 장학과 같아(eligibilityLines·Excludes·Priority) **엔진을 그대로** 부른다.
   🔴 eligibility(구조화 조건)는 비워 둔다 — 활동 글에는 사람이 확인한 성적·소득 조건이 없다. 판정 근거는 원문에서 뽑은 줄뿐이다(원칙 8-1).
   id 는 'act:' + 주소 — 장학 id 와 섞이지 않는다(묻기 상자 eligAsk 가 이 id 로 '어느 시트의 상자인가'를 가린다). */
function activityAsSch(n) {
  return {
    id: `act:${n.url}`, name: activityTitle(n), type: n.kind || '대외활동', eligibility: {},
    eligibilityLines: [...(n.eligibilityLines || []), ...titleTargetLines(n.title).filter((l) => !(n.eligibilityLines || []).some((x) => String(x).includes(l)))], eligibilityExcludes: n.eligibilityExcludes || [], eligibilityPriority: n.eligibilityPriority || [],
    excerpts: n.noticeLines || [], documents: [], deadline: n.deadline || null,
    activity: true, amount: [n.kind || '대외활동', activityHostLine(n)].filter(Boolean).join(' · '),   // 학교 게시판 글자는 어디에도 안 그린다(2026-11-02 개발자 결정)   // 달력·보관함 줄의 둘째 줄(장학은 금액 자리) — 지어낸 값이 아니라 종류·주최
  };
}
/* 카드·정렬·시트가 **같은 값**을 쓴다 — getMatches 와 같은 세 함수(evaluateFor · fitScore · fitDetailFor) */
function activityFit(n) {
  const sch = activityAsSch(n);
  const result = evaluateFor(sch, state.profile);
  return { sch, result, fit: fitScore(sch, result, state.profile), fd: fitDetailFor(sch, state.profile) };
}

function activityCardHtml(n) {
  const m = activityFit(n);
  const d = n.deadline ? dday(n.deadline) : null;
  /* 2026-11-15 개발자 결정("밑에 대상은 아예 빼버리고 시안 1로 · 간결하고 모던하게") — 윗줄 색 칩 + 주최 · 제목 · 아랫줄은 마감과 원문 아이콘뿐.
     대상·혜택·분야는 시트가 말한다(제목에서 뗀 괄호 대상도 시트 「공고 안내」로 간다 — openActivityDetail) · 시안 docs/designs/mockups/activity-card-options.html */
  const parts = splitTitleWho(activityTitle(n));
  return cardShellHtml({
    save: saveBtnHtml(`act:${n.url}`),   // 장학 카드와 같은 북마크(카드 바깥 · 2026-10-02)
    attrs: `data-activity="${esc(n.url)}"`,
    chip: kindChipHtml(n),
    org: activityHostLine(n),   // 학교 게시판 글은 빈 글자(칩만) · 2026-11-02 개발자 결정
    /* 장학 카드와 같은 판정 하나(적합도 % · 지원 자격 미달). 🔴 **'자격 미확인' 배지는 활동 카드에 안 단다** (2026-10-03 개발자 결정 —
       "왜 대외활동 공모전은 자격 미확인이야 죄다"). 활동 글은 자격이 포스터·첨부에만 있는 것이 많아 대부분의 카드에 같은 회색 배지가 붙어
       아무 말도 안 하는 배지가 됐다. 장학 카드의 '자격 미확인'은 그대로다. ⚠️ 2026-11-07 부터 시트도 자격 0줄이면 「지원 자격」 칸을 안 그리므로(sheetSectionsHtml) 활동 글은 모른다는 사실을 어디서도 말하지 않는다 — 개발자 지시. */
    badge: fitVerdict(m.fit, m.fd) === 'unread' ? '' : cardBadgeHtml(m.fit, m.fd, null),
    name: parts.title,
    foot: '',
    footKnown: false,
    due: d ? ddayWords(d) : '',
    urgent: !!d && d.days >= 0 && d.days <= 7,
    link: activityCardLinkHtml(n),
  });
}
/* 활동 카드의 원문 링크 — 이름은 시트 단추와 같은 sourceLink(n, 'activity') 한 곳(「원문 공고 ↗」 · 목록·홈페이지면 그 이름) · 안전하지 않은 주소면 안 그린다 */
/* 카드 왼쪽 아래의 원문 링크(아이콘) — **장학 카드와 활동 카드가 같은 것**(2026-10-28 개발자 "장학금에도 적용해야지 … 다른 영역이 아니야").
   이름은 sourceLink 한 곳(화면마다의 글자) · 안전하지 않은 주소면 안 그린다(href="" 는 앱 자신을 연다) */
function cardSrcLinkHtml(n, surface) {
  const link = sourceLink(n, surface);
  const href = safeUrl(link.href);
  return href ? `<a class="card-src-link" href="${esc(href)}" target="_blank" rel="noopener" title="${esc(link.label)}">${esc(link.label)}</a>` : '';
}
function activityCardLinkHtml(n) { return cardSrcLinkHtml(n, 'activity'); }

/* 활동 시트 맨 아래 — 안내 한 줄 + 원문 단추 (2026-10-03 · 원문 링크 정직성).
   🔴 이름은 sourceLink(n, 'activity') 한 곳이다. 예전엔 `#n-` 표식만 보고 나머지를 전부 '원문에서 신청하기 ↗' 라 불러,
      청년정책 API 가 준 기관 **첫 화면**(`www.jeju.go.kr/index.htm`)까지 '신청하기' 단추가 됐다(실측 10건).
   🔴 '신청은 주최 측 원문 페이지에서 진행돼요' 는 **글 하나로 가는 주소(post)일 때만** — 목록·홈페이지·문제 주소에 붙이면
      열리는 화면과 다른 말을 한다.
   찾기(data-activity)는 저장된 n.url 그대로 · 안전하지 않은 주소면 단추를 안 그린다(href="" 는 앱 자신을 연다) */
function activityLinkWhy(n, link) {
  /* 목록 표식(#n-)의 안내 문장은 예전 그대로(승인된 글자) — 「원문」 절의 안내 줄로 쓴다(승인 시안 2026-11-02 · 단추는 검정 하나) */
  return link.cls === 'list'
    ? (linkShape(n.url) === 'marker'
      ? '이 게시판은 목록에서 글을 눌러야 열리는 방식이라 글 하나로 바로 가는 주소를 확인하지 못했습니다. 열리는 '
      : '이 주소를 열면 게시판 목록이 떠요. ') + sourceLinkHintHtml(link)
    : link.cls === 'home' ? '주최 측 홈페이지 첫 화면이 열려요 — 이 글은 그 사이트에서 제목으로 찾아 주세요.'
    : sourceLinkHintHtml(link);
}
/* 활동 시트의 검정 단추 하나 — 이름은 source-link.js 의 activityButton 자리(글 하나로 가는 주소만 「원문에서 신청하기 ↗」) · 안전하지 않은 주소면 안 그린다(href="" 는 앱 자신을 연다) */
function activityLinkHtml(n) {
  const link = sourceLink(n, 'activityButton');
  const href = safeUrl(link.href);
  return href ? `<a class="btn btn-primary btn-lg" href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a>` : '';
}

function openActivityDetail(url) {
  if (typeof trackUse === 'function') trackUse('detail', url);   // 이용 횟수 — 주소는 보내지 않고 지문으로(usage-report.js)
  { const dsh = document.getElementById('detail-sheet'); if (dsh) dsh.dataset.useItem = url; }
  const n = activityItem(url);   // 피드에서 빠졌어도 저장해 둔 글이면 사본으로 연다
  if (!n) return;
  const { sch, result, fit, fd } = activityFit(n);
  const d = n.deadline ? dday(n.deadline) : null;
  const benefit = unent(activityBenefit(n));
  /* 「대상」 발췌는 자격 줄이 있으면 위 「지원 자격」이 이미 보여 준다 — 같은 A·B·C 조건이 「모집 안내」에 한 번 더 떴다(쇼미더임팩트 · 2026-10-16 개발자 지적) */
  const rows = (n.excerpts || []).filter((x) => x.label !== '혜택' && x.label !== '모집기간' && !(x.label === '대상' && (n.eligibilityLines || []).length));   // 모집기간은 「접수 · 기간」 줄이 말한다(승인 시안 2026-11-02)
  const parts = splitTitleWho(activityTitle(n));
  /* 제목에서 뗀 괄호 대상 — 카드에 대상 줄이 없어(2026-11-15) 여기가 그 글자가 남는 유일한 자리다. 자격 줄이 이미 같은 말을 하면 한 번만 */
  const titleWho = parts.who.filter((w) => !(n.eligibilityLines || []).some((l) => String(l).replace(/\s/g, '').includes(w.replace(/\s/g, ''))));
  /* 「접수 · 기간」 — 발췌 모집기간(없으면 기간 토막 deadlineHint)을 그대로 넘긴다 · 날짜만 있는 글은 applySectionHtml 이 마감으로 말한다(리뷰 2026-11-02 · 9건이 「원문 확인」으로 떴다) */
  const recruit = ((n.excerpts || []).find((x) => x.label === '모집기간') || {}).text || (n.deadlineHint && !/window\.|dataLayer|function|\)\s*\)/.test(n.deadlineHint) ? hintText(n.deadlineHint) : '');
  if (recruit) sch.period = unent(recruit);
  /* 원문 안내 — 위 '모집 안내'에 이미 나온 문장은 다시 적지 않는다(같은 접수기간이 두 칸에 떴다 · 2026-10-01) */
  const seenText = [...(n.excerpts || []).map((x) => noticeFlat(x.text)), ...(n.eligibilityLines || []).map(noticeFlat)].filter((x) => x.length >= 6);
  const notice = (n.noticeLines || []).filter((l) => !seenText.some((e) => noticeFlat(l).includes(e)));
  sheetBack = null;   // 이 시트에는 돌아갈 곳이 없다 — 내리면 닫힌다
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body act-sheet">
      ${/* act-sheet — 활동 시트만의 표식(2026-11-15 은서: 활동 시트는 목록 앞 점 없이 · 장학 시트는 그대로 — style.css) */ ''}
      ${/* 승인 시안(2026-11-02) — 장학 시트와 같은 머리줄·절 다섯(sheetSectionsHtml). 짧은 혜택은 금액 자리, 긴 혜택·활동기간·지역·원문 줄은 「공고 안내」, 모집기간은 「접수 · 기간」.
           단추는 검정 하나 — 이름은 source-link.js 의 activityButton 자리(글 하나로 가는 주소만 신청하기 · 목록·홈페이지는 그 이름 그대로 · 2026-10-03 원문 링크 정직성). */ ''}
      ${sheetHeadHtml({ x: n, d, save: saveBtnHtml(`act:${n.url}`) })}
      <h3 class="sheet-title">${esc(parts.title)}</h3>
      ${benefit && benefit.length <= 40 ? `<p class="sheet-amount">${esc(benefit)}</p>` : ''}
      ${sheetSectionsHtml({ sch, result, fit, fd, activity: n, noticeLines: [
        ...(benefit && benefit.length > 40 ? [`혜택: ${benefit}`] : []),
        ...(titleWho.length ? [`대상: ${titleWho.join(' · ')}`] : []),   // 제목에서 뗀 조각만 — 발췌 「대상」은 아래 rows 가 적는다(리뷰 2026-11-02)
        ...rows.map((x) => `${x.label}: ${unent(x.text)}`),
        ...notice,
      ] })}
      ${activityLinkHtml(n)}
    </div>`;
  openSheetShell();
  /* 빈칸을 찾은 신청서 PDF 에만 「양식 채우기」(장학 시트와 같은 formfill.js · 2026-10-31 공동개발자 "공모전 신청 양식이 매우 미흡") */
  if (n.id && typeof attachFormFillButtons === 'function') attachFormFillButtons(activityFillTarget(n), $('#detail-sheet'));
  eligAskWire(sch, () => openActivityDetail(url));   // 묻기 상자 배선 — 다시 그릴 때 이 시트로 돌아온다
}
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
  return `<div class="section-head" style="margin-top:4px"><h3>재단·지자체 새 공고</h3>
    <span class="section-note">${liveExternal.updatedAt ? esc(shortDay(liveExternal.updatedAt)) + ' 갱신' : ''}</span></div>`
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

/* 오늘 올라온 글인가 — 게시일(없으면 수집일)이 오늘. todayStart 는 부를 때마다 오늘을 읽는다(PWA 가 며칠 살아 있어도 맞다) */
function newsIsToday(n) {
  const d = String(n.postedAt || n.foundAt || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return new Date(d + 'T00:00:00').getTime() === todayStart().getTime();
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
  /* 오늘 올라온 글 수 — 「오늘 날짜 기준」(2026-10-10 업무 분장 8번). 머리줄 아래 설명 줄은 두지 않는다(10-03 개발자 지시) — 제목 옆 작은 알약 하나 */
  const todayN = liveNews ? schoolNewsForMe().filter((n) => newsIsToday(n)).length : 0;
  const head = (all) => `<div class="section-head home-news-head"><h3>우리 학교 소식${todayN ? ` <span class="news-today">오늘 ${todayN}</span>` : ''}</h3>${all ? '<button type="button" class="link-btn home-news-all" data-news-all>전체 보기</button>' : ''}</div>`;
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
      <span class="news-tile-title">${esc(unent(n.title))}</span>
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
      <p class="sheet-provider">${esc(p.school || '')} 공지 게시판${liveNews && liveNews.updatedAt ? ` · ${esc(liveNews.updatedAt)} 갱신` : ''}</p>
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
  const done = () => toast(okMsg || '복사 완료 · 공식 신청 페이지에 붙여넣기');
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
      toast('서류와 함께 공유 완료 · 메일 앱에서 바로 접수 가능');
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: `${sch.name} 신청 서류`, text });
      toast('내용 공유 완료 · 파일은 보관함에서 따로 첨부');
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
    state.applications.push({ id: sch.id, name: sch.name, appliedAt: nowStamp(), step: 0, docs, pending: false, prep: {} });
    if (typeof trackUse === 'function') trackUse('prep', sch.id);
  }
  saveState();
  const ch = officialChannel(sch);
  toast(`'${sch.name}' 신청 준비 완료 · 최종 제출은 ${ch.label}`);
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
  /* 🔴 **여기서 곧장 finalizeApply 를 부르지 말 것** (2026-09-23 개발자 지적:
     "공고 대부분이 공고양식을 읽지 못하고 신청 준비 시작 버튼을 눌렀을때 바로 신청내역으로 이동").
     예전엔 앱 양식도 서류 도우미도 없는 공고는 **누르는 순간** '신청 준비 완료'가 됐다 —
     학생은 아무것도 준비하지 않았는데 신청내역에 '준비 완료'가 찍혔다(원칙 1 정직한 신청 상태).
     실측으로 마감 전 공고 112건 중 100건(층1 32 · 층2 68)이 이 길이었다.
     이제는 '신청 준비' 시트가 먼저 뜬다 — 원본 양식 파일 · 제출 서류 · 최종 제출 방법을 보여 주고,
     학생이 확인 버튼을 눌러야 담긴다. 관문: verify/test-collector.mjs 「신청 준비 시작 버튼」. */
  renderApplyPrep(sch);
}

/* 앱 양식이 없는 공고의 '신청 준비' 시트.
   🔴 여기서 새로 판정하지 않는다 — 제출처는 officialChannel · 채널 이름은 submitChannelLabel ·
      양식 첨부인지는 isFormAttachment(data.js) · 원문 링크 이름은 sourceNoteHtml 한 곳씩이다.
   🔴 앱 내부 사정(왜 앱 양식이 없는지)은 적지 않는다(2026-09-17 지시) — 학생이 할 일만 적는다.
   🔴 원본에 없는 서류·방법을 지어내지 않는다 — 발췌(excerpts)와 공고가 준 서류 이름만 옮긴다. */
function renderApplyPrep(sch) {
  const ch = officialChannel(sch);
  const atts = sch.attachments || [];
  const kosaf = sch.sourceKind === 'kosaf';
  /* 층2 첨부는 재단이 올린 **선발 공고문**이다 — 신청서라고 부르면 학생이 그 안에서 빈칸을 찾는다
     (상세 시트의 '선발 공고문' 머리말과 같은 규칙) */
  const formAtts = kosaf ? [] : atts.filter(isApplicationForm);
  /* 본문 사진(bodyImage)은 공고 원문 그 자체다 — '첨부 파일'로 늘어놓지 않는다(원문 링크가 준다) */
  const pdfRows = kosaf ? '' : formPdfRowsHtml(sch);
  /* 로봇이 PDF 로 둔 그 파일(이름이 같은 첨부)은 「원본 양식 그대로 보기」 줄이 이미 보여 준다 — 밑에 또 늘어놓지 않는다(PDF 신청서는 isApplicationForm 밖이라 여기 걸렸다 · 10-14 실측 선원가족) */
  const pdfNames = new Set(formPdfsFor(sch).map((f) => f.name));   // 이름으로만 거른다 — 학교가 같은 이름으로 다른 파일을 올리면 로봇이 크기 차이로 다시 바꾼다(form-pdf srcBytes)
  const otherAtts = atts.filter((a) => !formAtts.includes(a) && !a.bodyImage && !pdfNames.has(a.name));
  /* 첨부 줄 — 승인 시안 A(2026-10-14) 꼴: 아이콘 · 이름 · 작은 글씨(출처 · 크기) · 오른쪽 ↓. 신청서 양식 묶음엔 로봇이 바꿔 둔 원본 PDF 줄이 맨 위에 선다 */
  const kb = attachKb;
  const attList = (list, where) => `<ul class="doc-list">${list.map((a) => attachRowHtml(a, { meta: `${where}${kb(a)}` })).join('')}</ul>`;
  const excerpts = sch.excerpts || [];
  const certHtml = certStatusListHtml(sch);
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" id="apply-prep">
      <h3 class="sheet-title">신청 준비</h3>
      <p class="sheet-provider">${esc(sch.name)} · 준비할 것을 확인하고 담아 두세요</p>
      ${(formAtts.length || pdfRows) ? `
      <h4>신청서 양식 <span class="channel-tag">공고 원본</span></h4>
      <ul class="doc-list">${pdfRows}${formAtts.map((a) => attachRowHtml(a, { meta: `학교 게시판 첨부 · 내려받기${kb(a)}` })).join('')}</ul>
      <p class="dp-note">${pdfRows ? '빈칸을 찾은 PDF 는 「양식 채우기」로 답을 얹을 수 있어요 — 문서는 그대로예요.' : '원본 파일을 내려받아 작성해 주세요.'}</p>` : ''}
      ${otherAtts.length ? `
      <h4>${kosaf ? '선발 공고문 <span class="channel-tag">재단 원문</span>' : '공고 첨부 파일'}</h4>
      ${attList(otherAtts, kosaf ? '재단 원문 첨부' : '학교 게시판 첨부')}` : ''}
      ${noticeSummaryHtml(excerpts)}
      ${certHtml}
      <h4>최종 제출 방법 <span class="channel-tag">${submitChannelLabel(sch)}</span></h4>
      <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
      ${schoolPortalNote(sch)}
      ${(kosaf && sch.contact) ? `<p class="doc-legend">문의 ${esc(sch.contact)}</p>` : ''}
      ${sourceNoteHtml(sch)}
      ${/* 🔴 '완료'라는 말을 학생이 아무것도 안 한 시점에 쓰지 않는다 (2026-10-13 개발자 결정 — 이 시트는 이제
           앱 지원문서가 없는 상시 제도·층2에서만 뜬다 · 그 밖은 양식 작성 화면이 먼저다) */ ''}
      <button class="btn btn-primary btn-lg" id="btn-prep-confirm">확인했어요 — 신청내역에 담기</button>
      ${/* 정직한 신청 상태(원칙 1)는 한 마디로 — 긴 설명은 뺐다(2026-10-15) */ ''}
      <p class="dp-note">신청내역에 담길 뿐, 학교·재단에 접수되지는 않아요.</p>
    </div>`;
  /* 확인하면 **닫지 않고 그 공고의 '준비 완료' 화면을 연다** (2026-09-23 리뷰) — 다음 할 일
     (메일 접수 버튼·제출처 열기·'공식 제출 완료로 기록')이 거기 있다. 닫아 버리면 메일 접수
     공고는 버튼을 찾으러 공고를 다시 열어야 했다. */
  $('#btn-prep-confirm').addEventListener('click', () => {
    finalizeApply(sch, null);
    openDetail(sch.id);
  });
  if (typeof attachFormFillButtons === 'function') attachFormFillButtons(sch, $('#detail-sheet'));   // 빈칸을 찾은 PDF 에만 「양식 채우기」(formfill.js)
  $('#detail-sheet').scrollTop = 0;
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
  /* 앱 지원문서(prep:)도 '쓸 것'이다 (2026-10-13 리뷰 — formId 만 보던 탓에 일괄 준비가 107건을 아무 문서 없이 '준비 완료'로 담았다) */
  return !!(essayDefsFor(sch).length || formTplIdFor(sch));
}

/* 일괄 준비 대상 — 자격 통과 · 아직 안 담음 · 마감 전 · 오래되지 않음.
   ⚠️ 목록을 **열 때와 확인을 누를 때 둘 다** 이 함수를 쓴다. 열 때만 거르면
      목록을 한참 보다가 자정을 넘겨 확인한 학생이 마감된 공고를 담게 된다. */
function bulkTargets() {
  return getMatches()
    .filter((m) => ['eligible', 'selective'].includes(m.result.status))
    .filter((m) => !state.applications.some((a) => a.id === m.sch.id))
    .filter((m) => dday(m.sch.deadline).days >= 0 && notStale(m.sch) && !m.sch.noApply)   // noApply: 신청 절차가 없는 공고(applyLock) — 일괄 시트에도 안 담는다(리뷰 2026-11-02 가 잡았다)
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
  편입학: '편입생', 재입학: '재입학생',
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
  if (e.schoolsAny) add('지원 대상 대학');
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
  return out.slice(0, BULK_TAG_MAX);   // 못 읽었으면 칩 없음(2026-11-15 · 예전 '자격 원문 확인')
}

/* 목록 한 줄. 겉은 넷(체크·제목·자격 단어·금액)이고 나머지는 <details> 안이다.
   <details> 는 브라우저가 이미 가진 접기 기능이라 여닫는 코드가 한 줄도 필요 없다. */
function bulkRowHtml(sch) {
  const on = bulkPrep.ids.has(sch.id);
  const d = dday(sch.deadline);
  /* 줄마다 택1 묶음의 머리 줄(`head` · 상세 시트와 같은 이름표)을 그 묶음 첫 줄 위에 — 요건 줄로 세지 않는다(2026-11-17) */
  const reqs = (typeof requirementLines === 'function' ? requirementLines(sch, null, { withMeta: true }) : []).slice(0, 6);
  return `
    <div class="bulk-row${on ? '' : ' off'}" data-row="${esc(sch.id)}">
      <input type="checkbox" class="bulk-check" data-bulk="${esc(sch.id)}" ${on ? 'checked' : ''}
        aria-label="${esc(sch.name)} 준비 목록에 넣기" />
      <div class="bulk-main">
        <p class="bulk-name">${esc(sch.name)}${bulkNeedsWork(sch) ? '<span class="badge badge-pending">서류 작성 필요</span>' : ''}</p>
        <p class="bulk-tags">${bulkTags(sch).map((x) => `<span class="chip-sm">${esc(x)}</span>`).join('')}</p>
        ${amountLine(sch).text ? `<p class="bulk-amount">${esc(amountLine(sch).text.replace(/^금액 · /, ''))}</p>` : ''}${/* 모르는 금액은 줄 없음(2026-11-15 · amountLine 한 곳 · 예전 '금액 원문 확인') */ ''}
        <details class="bulk-more">
          <summary>더보기</summary>
          <div class="bulk-badges">
            <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${esc(sch.type)}</span>
            ${sch.program ? '<span class="badge badge-program">상시 제도</span>' : (ddayWords(d) ? `<span class="badge badge-dday ${d.cls}">${esc(ddayWords(d))}</span>` : '')}
            ${/* 🔴 '자동 등록 · 검수 전' 배지를 뺐다 (2026-09-17 개발자 지시 — 내부 공정은
                 관리자에게만). 운영 원칙 2 의 '정직한 표시'는 **학생이 판단에 쓸 수 있는 것**을
                 감추지 말라는 뜻이고, 우리 검수 공정의 단계는 거기 해당하지 않는다.
                 세는 곳은 관리자 '오늘 할 일'의 검수 전 카드 둘이다(_admin/admin.js). */ ''}
          </div>
          ${sch.deadline ? `<p class="bulk-meta">마감 ${esc(sch.deadline.replace(/-/g, '.'))}</p>` : ''}${/* 마감을 모르면 줄 없음(2026-11-15) */ ''}
          <p class="bulk-meta">${esc(submitChannelLabel(sch))}</p>
          ${reqs.length
            ? `<p class="bulk-meta-head">지원자격 (공고 원문)</p><ul class="bulk-reqs">${reqs.map((r) => `${r.head ? `<li class="r-pick">${esc(r.head)}</li>` : ''}<li>${esc(r.text)}</li>`).join('')}</ul>`
            : ''}
        </details>
      </div>
    </div>`;
}

/* ── 금액 상세 (2026-08-27) ────────────────────────────────────
   홈의 '최대 N원'을 누르면 열린다. 그 숫자가 **어떻게 나왔는지 줄 단위로** 보여 준다.
   갈래를 넷으로 나눈 이유: 합계 하나만 보여 주면 방어가 안 되고, 갈래를 나누면
   각 줄이 원문을 근거로 갖는다. 특히 **안 더한 것도 보여 준다** — 감춘 게 아니라
   이유가 있다는 걸 학생이 봐야 한다(개발자와 확정한 배치).

   🔴 여기서 다시 계산하지 않는다. renderHome 이 만든 lastBill 을 그대로 그린다 —
      따로 계산하면 히어로 숫자와 상세가 다른 말을 하게 된다. */
/* 🔴 **추정값을 확정값처럼 적지 않는다** (2026-09-11 코드 리뷰에서 잡았다).
   2026-09-10 수리로 비율형(`등록금 100%`)도 이중수혜 갈래를 거치게 되면서, 같은 공고가
   `added`(또는 `onlyOne`)와 `estimated` **양쪽에** 들어간다 — 합계는 맞지만(한 번만 더한다)
   화면은 네 갈래를 서로 안 겹치는 것처럼 그리고 있었다. 그래서 ① 건수를 더하면 공고 수보다
   많아지고 ② 무엇보다 합산 줄이 `400만원` 이라고 **딱 떨어지게** 적었다 — 그 값은 학교 평균
   등록금에서 뽑은 추정인데 확정된 금액처럼 읽힌다(원칙 8-1 · 이 파일 첫머리의 '기망').
   ⚠️ 계산은 건드리지 않는다 — `parse-amount.js` 의 total 은 옳다. 적는 법만 고친다. */
function estOpt(m, opt) {
  const bill = lastBill && lastBill.bill;
  if (!bill || bill.estimated.indexOf(m) < 0) return opt;
  return Object.assign({}, opt, { tone: 'est', text: '약 ' + won(m.won) });
}

function amountDetailRow(m, opt) {
  const o = opt || {};
  const sch = m.ref, a = sch.amountSpec || null;
  const val = o.text || (m.won ? won(m.won) : '');   // 모르는 금액은 비운다(2026-11-15 · 예전 '금액 원문 확인' — 갈래 이름이 이미 그 사실을 말한다)
  /* 줄을 누르면 **그 공고의 상세 시트**가 뜬다 (2026-08-27 개발자 지시로 변경).
     처음엔 장학금 탭으로 옮겨 그 카드를 찾아 스크롤했는데, 카드를 못 찾으면(필터·정렬·
     마감 숨김) 아무 일도 안 일어난 것처럼 보였다. 지금은 찾아가지 않고 **바로 연다** —
     장학금 탭에서 카드를 누른 것과 같은 화면이다.
     시트 그릇(`#detail-sheet`)이 금액 상세와 같아서 내용만 갈린다(새 시트를 만들지 않는다).
     안쪽 `원문 보기` 를 여닫는 클릭은 이동이 아니다 — 아래 핸들러가 details·a 를 걸러낸다. */
  const cls = (o.dim ? 'ad-row dim' : 'ad-row') + ' tappable';
  const merged = (m.mergedFrom || []).length;
  /* 🔴 **수집한 글이므로 `esc()` 앞에서 기호를 되돌린다** (2026-09-13).
     이 두 줄은 게시판 원문에서 그대로 온다 — `취 &middot; 창업지원금` 처럼 HTML 기호가
     섞여 있고, `esc()` 만 하면 `&` 가 한 번 더 감싸져 학생 화면에 **글자로** 뜬다.
     ⚠️ 순서를 뒤집지 말 것 — `esc()` 뒤에 되돌리면 `&amp;middot;` 가 돼 영영 안 풀린다.
     (2026-09-11 에 `n.title`·`n.deadlineHint` 에서 같은 사고가 있었다. 그때 관문은
      **칸 이름 두 개만** 보는 손 목록이라 이 자리를 못 잡았다 — 관문도 함께 넓혔다.) */
  /* 인용은 통째로 싣거나 통째로 뺀다 — '모름'류 낱말이 있는 원문·재단 글(「지원금액: ※ 기관확인필요」 · 「… 단, 소득분위 확인 필요」)은 따옴표 안에 싣지 않는다(knownValue · 2026-11-16 2차 리뷰 · 원칙 8-1).
     자른 글을 원문이라며 보이면 조건이 사라진 문장이 된다 — 그때는 아래 원문 링크만 남는다 */
  const raw = a && a.raw ? knownValue(unent(a.raw)) : '';
  const exRaw = sch.exclusivity && sch.exclusivity.raw ? knownValue(unent(sch.exclusivity.raw)) : '';
  return `<div class="${cls}" data-goto="${esc(sch.id)}" role="button" tabindex="0">
    <div class="ad-top"><p class="ad-name">${esc(sch.name || '')}</p>
      ${val || o.check ? `<p class="ad-val ${o.tone || ''}">${o.check ? '<span class="ad-chk">✓</span>' : ''}${esc(val)}</p>` : ''}</div>
    ${o.note ? `<p class="ad-note">${esc(o.note)}</p>` : ''}
    ${merged ? `<details><summary>${esc(schoolOfNotice(m.mergedFrom[0]) || '다른 학교')} 외 ${merged}건</summary>
      <div class="ad-list"><span>같은 재단이 여러 학교에서 접수하는 공고. 1건으로 합산.</span>
      ${[sch, ...m.mergedFrom].map((x) => `<span>${esc(providerUnknown(x.provider) ? (x.name || '') : x.provider)}</span>`).join('')}</div></details>` : ''}
    ${/* 층2는 우리가 읽은 공고 원문이 아니라 재단이 한국장학재단에 적어 둔 칸이다 — '원문'이라 부르지 않는다 (2026-10-03) */ ''}
    ${raw || exRaw ? `<details><summary>${sch.sourceKind === 'kosaf' ? '재단이 적어 둔 글' : '원문 보기'}</summary>
      <p class="ad-src">"${esc(raw || exRaw)}"<em>${esc(noticeSourceLabel(sch))}</em></p></details>`
    /* 🔴 발췌가 없으면 지어내지 않고 **원문으로 가는 길**을 준다 (원칙 8-1).
       금액이 첨부파일이나 제목에만 있어 사람이 손으로 넣은 공고가 있다 — 화면에 금액이
       뜨는데 근거를 하나도 못 보여 주는 상태로 두면 안 된다(개발자 지적 2026-08-27).
       게시판 목록 주소인 공고는 '원문 공고'라고 쓰면 거짓말이라 라벨을 바꾼다. */
    : (o.text || m.won || o.srcLink ? amountSourceLinkHtml(sch) : '')}
  </div>`;
}

/* 금액 상세 한 줄의 출처 링크 — 이름은 sourceLink(sch, 'amount') 한 곳 (2026-10-03 · 원문 링크 정직성).
   🔴 층2(재단 홈페이지)를 '원문 공고'라 부르던 자리다 — 상세 시트는 '재단 홈페이지'라 하는데 여기만
      `program`·`#n-` 둘만 보고 나머지를 전부 원문이라 불렀다(같은 재단 홈페이지가 화면마다 다른 이름). */
function amountSourceLinkHtml(sch) {
  const link = sourceLink(sch, 'amount');
  const href = safeUrl(link.href);
  return href ? `<p class="ad-link"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a></p>` : '';
}

/* 원문 발췌 밑에 붙는 출처 한 줄 — `광운대학교 게시 원문`.
   🔴 학교 이름을 줄이지 않는다(기관명 축약 금지) — provider 의 `(광운대 접수)` 대신
      eligibility.schoolOnly 의 정식 명칭을 쓴다. 둘 다 없으면 출처를 지어내지 않고 비운다. */
const noticeSourceLabel = (sch) => {
  if (sch && sch.sourceKind === 'kosaf') return '한국장학재단 등록 정보';   // 층2 — 공고 원문이 아니다(2026-10-03)
  const school = (sch && sch.eligibility && sch.eligibility.schoolOnly) || '';
  return school ? `${school} 게시 원문` : '공고 원문';
};

const schoolOfNotice = (sch) => {
  const m = String(sch && sch.provider || '').match(/\(([^)]*대학교[^)]*)\s*접수\)/);
  return m ? m[1] : (sch && sch.school) || '';
};

function renderAmountDetail(keepScroll) {
  /* 못 그렸다는 것을 부르는 쪽이 알아야 한다 — dismissSheet 가 이 값을 보고 닫는다 */
  if (!lastBill) return false;
  const { bill, count } = lastBill;
  const p = state.profile;
  const sum = (arr) => arr.reduce((s, m) => s + (m.won || 0), 0);
  /* 🔴 갈래는 **비어 있어도 그린다.** 승인받은 화면이 네 갈래이기 때문이다.
     처음에 '내용 없으면 통째로 숨김'을 넣었다가 개발자가 승인한 화면과 다른 것이 나갔다
     (2026-08-27). 보여 주고 승인받은 구조를 코드에서 조용히 바꾸지 말 것. */
  const grp = (title, right, note, rows, empty) => `
    <div class="ad-grp"><div class="ad-grp-h"><b>${title}</b><span>${rows ? right : '해당 없음'}</span></div>
    ${rows && note ? `<p class="ad-grp-note">${note}</p>` : ''}${rows || `<p class="ad-empty">${empty}</p>`}</div>`;

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">금액 상세</h3>
      <p class="sheet-provider">${esc(p.school || '')}${p.campus ? ' · ' + esc(p.campus) : ''} · 신청 가능 ${count}건</p>
      <div class="ad-total">
        <p class="ad-total-lb">지금 받을 수 있는 장학금</p>
        <p class="ad-total-amt">${bill.assumedWon > 0 ? '약' : '최대'} ${won(bill.total)}</p>
        <p class="ad-total-sub">${bill.assumedWon > 0
          ? `금액을 못 읽은 ${bill.assumed.length}건은 어림잡아 더함`
          : `금액을 읽은 공고만 합산${bill.unknown.length ? ` · 못 읽은 ${bill.unknown.length}건 제외` : ''}`}</p>
      </div>
      ${grp('합산', `${bill.added.length}건 · ${won(sum(bill.added))}`, '',
        bill.added.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on' }))).join(''),
        '합산할 공고가 아직 없어요')}
      ${grp('중복 수혜 불가', `${bill.onlyOne.length + bill.dropped.length}건 중 ${bill.onlyOne.length}건`,
        '함께 받을 수 없는 공고입니다. 가장 큰 1건만 합산했습니다.',
        bill.onlyOne.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on', check: true }))).join('')
        + (bill.dropped.length ? `<details><summary>함께 못 받는 공고 ${bill.dropped.length}건</summary>
          ${bill.dropped.map((m) => amountDetailRow(m, { dim: true, tone: 'off', note: '위 공고와 동시 수혜 불가' })).join('')}</details>` : ''),
        '모두 함께 받을 수 있는 공고입니다.')}
      ${grp('등록금 비율 환산', `${bill.estimated.length}건 · 추정`,
        '금액이 등록금 비율로만 적힌 공고입니다. 학교별 한 학기 등록금 기준 추정값이며 실제 금액과 다를 수 있습니다. 위 갈래에 이미 들어 있는 공고를 다시 적은 것이라 건수를 더하지 마세요.',
        bill.estimated.map((m) => amountDetailRow(m, { tone: 'est', text: '약 ' + won(m.won) })).join(''),
        '등록금 비율로 적힌 공고는 없어요')}
      ${/* 🔴 홈 히어로가 이 몫을 어림잡아 더하므로(2026-09-17 개발자 지시) 이 칸도 그렇게
           적어야 한다 — 합계에 넣어 놓고 '0원'이라고 적으면 두 숫자가 서로 다른 말을 한다.
           🔴 줄마다의 금액은 여전히 비어 있다(2026-11-15 · 예전 '금액 원문 확인'): 어림잡은 것은 **합계 한 곳**이지
              그 공고의 금액이 아니다(원칙 8-1 · parse-amount.js sumAmounts ④). */ ''}
      ${/* 갈래 이름 '금액 미확인' → '금액을 못 읽은 공고' (2026-11-15 · 개발자 결정 11-02 '미확인'류 글자 없음 · 히어로 아랫줄 「금액을 못 읽은 n건」과 같은 말) */ ''}
      ${grp('금액을 못 읽은 공고', bill.assumedWon > 0
          ? `${bill.unknown.length}건 · 어림 ${won(bill.assumedWon)}`
          : `${bill.unknown.length}건 · 0원`,
        bill.assumedWon > 0
          ? `원문에 금액이 없거나 첨부파일에만 있는 공고입니다. 이 중 ${bill.assumed.length}건은 위 합계에 한 건당 ${won(bill.assumedEach)}(확인된 공고들의 중앙값)으로 어림잡아 더했습니다 — 실제 금액과 다를 수 있습니다.`
          : '원문에 금액이 없거나 첨부파일에만 있는 공고입니다.',
        bill.unknown.length ? `<details><summary>공고 ${bill.unknown.length}건 보기</summary>
          ${bill.unknown.map((m) => amountDetailRow(m, { dim: true, tone: 'off', srcLink: true })).join('')}</details>` : '',
        '모든 공고의 금액을 확인했습니다.')}
      <p class="ad-foot">모든 금액은 공고 원문 기준입니다.<br>선발 결과에 따라 실제 수혜액은 달라질 수 있습니다.</p>
    </div>`;
  openSheetShell(keepScroll);   // 되돌아온 것이면 보던 자리로 (아니면 undefined → 맨 위)
  return true;
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
      ${ready.length ? `<p class="bulk-group-head">바로 준비 가능 · ${ready.length}건</p>${ready.map(bulkRowHtml).join('')}` : ''}
      ${need.length ? `<p class="bulk-group-head">서류 작성 필요 · ${need.length}건</p>${need.map(bulkRowHtml).join('')}
        <p class="dp-note">이 ${need.length}건은 담아 둔 뒤 신청내역에서 자소서·신청서 작성.</p>` : ''}
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
  $('#bulk-sum').textContent = `선택 ${picked.length}건 · 최대 ${won(total)}${unknown ? ` · 금액을 못 읽은 ${unknown}건 제외` : ''}`;
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
    toast(gone.length ? '고른 장학금 전부 그 사이 마감' : '준비할 수 있는 장학금이 없어요');
    return;
  }
  const need = go.filter(bulkNeedsWork);
  go.forEach((sch) => state.applications.push({
    id: sch.id, name: sch.name, appliedAt: nowStamp(), step: 0, docs: null, pending: bulkNeedsWork(sch), prep: {},
  }));
  saveState();
  if (typeof trackUse === 'function') go.forEach((sch) => trackUse('prep', sch.id));   // 일괄 신청 준비도 공고마다 한 번
  closeSheet();
  const goneMsg = gone.length ? ` · ${gone.length}건은 그 사이 마감돼 제외` : '';
  toast(need.length
    ? `${go.length - need.length}건 준비 완료 · ${need.length}건은 신청내역에서 서류를 이어서 쓰세요${goneMsg}`
    : `장학금 ${go.length}건 신청 준비 완료${goneMsg}`);
  showScreen('applications');
}

function applyAll() {
  const targets = bulkTargets();
  if (!targets.length) { toast('준비할 수 있는 장학금이 없어요'); return; }
  bulkPrep = { list: targets, ids: new Set(targets.map((sch) => sch.id)) };
  openSheetShell();
  renderBulkPrep();
}

/* 🔴 **'신청 버튼을 누를 수 있는가'의 단 하나의 기준** (2026-09-13 · 노션 백로그 핵심-2).
   화면(openDetail)과 검사 도구(verify/what-shows.mjs)가 **같은 함수**를 쓴다.
   ⚠️ 베껴 두면 갈라진다 — 실제로 갈라져 있었다: 이 규칙이 openDetail 안의 지역 변수라
      what-shows 가 제 사본을 들고 있었고, 잠금을 푼 뒤에도 계속 '잠김'이라 보고했다.
      (그 파일 머리말은 "앱 규칙을 한 줄도 베끼지 않는다"고 적어 둔 채였다.)

   🔴 **자격 판정으로는 막지 않는다.** 예전에는 `['eligible','selective']` 가 이 식에
   함께 있어서 미달·미확인이면 버튼이 통째로 잠겼다. 그런데 우리 판정은 100% 가 아니다 —
   원문을 못 받았거나(`unknown`) 축이 없어서 미달이 된 공고가 실제로는 신청 가능하고,
   막아 버리면 그 학생은 받을 수 있는 장학금을 **영영 못 본다**. 판정은 참고로 보여 주고
   **결정은 학생이 한다**(caution 이 무엇을 확인해야 하는지 말한다).

   ⚠️ 마감(`d.days >= 0`)과 이미 신청함(`app.pending`)은 **그대로 막는다** — 그 둘은
      우리 판정이 아니라 **사실**이다. 마감된 공고를 신청하게 하는 것은 정직하지 않다(원칙 1).
   ⚠️ 일괄 신청 준비(`bulkTargets`)는 일부러 안 열었다 — 거기는 여러 건을 한꺼번에 고르는
      자리라 미달까지 섞으면 학생이 무엇을 고른 것인지 알 수 없게 된다.

   caution — 자격이 확인되지 않은 채 신청하는 경우에만 값이 있다(없으면 빈 문자열).
   🔴 **모르는 것을 '미충족'이라고 부르지 않는다** (2026-09-09 에 배운 것을 여기로 옮겼다).
      `unknown` 은 '요건에 못 미친다'가 아니라 **'우리가 못 읽었다'**는 뜻이다 — 동산장학회
      (이공계 새터민)에서 실제로 그랬다: 새터민이고 이공계이고 성적도 넘는 학생인데 자격 줄
      셋 중 둘을 못 읽어 unknown 이 됐고, 화면은 그 학생에게 '요건 미충족'이라 단정했다.
      그때는 **버튼 문구만** 갈랐고 잠금은 안 갈라서, 그 학생은 여전히 못 눌렀다. */
/* 🔴 fd(fitDetailFor) — 자격 줄을 한 줄도 못 읽은 공고(fd.unread)도 「원문에서 자격을 보라」 한 문장을 단다 (2026-11-16 리뷰). 정식 등록 공고는 거의 다
   status 'selective' 라 status 갈래로는 안내가 영영 안 붙고, 「자격 미확인」 배지도 뺐으니(11-02 결정) 앱이 자격을 확인해 준 공고와 똑같아 보인다.
   문장은 'unknown' 갈래와 같은 것(모르는 것을 말하는 낱말이 없는 할 일 안내) · 판정은 바꾸지 않는다(버튼은 그대로 열린다) */
function applyLock(result, app, d, sch, fd) {
  /* 🔴 원문이 「별도 신청 없이 학교가 선발」이라 적은 공고(noApply = 그 원문 문장 · 관리자가 적는다 · 2026-11-02 세종대 학업수석총장장학금) —
     자격이 맞아도 버튼을 열지 않는다. 열면 학생이 없는 절차를 준비한다. 홈 「바로 신청」·앱 지원문서도 같은 칸을 본다. */
  if (sch && sch.noApply) return { canApply: false, caution: '', noApply: true };
  const canApply = (!app || app.pending) && d.days >= 0;
  const unsure = !['eligible', 'selective'].includes((result && result.status) || '');
  const caution = !canApply ? '' : unsure ? result.status : (fd && fd.unread ? 'unknown' : '');
  return { canApply, caution };
}

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

/* ---------------- 이벤트 바인딩 ---------------- */
function bindEvents() {
  /* 소식 썸네일을 못 받으면(아직 배포 전·오프라인·지워짐) 그림만 빼고 글자 카드로 (2026-10-03).
     error 는 거품이 일지 않아 잡는 단계(capture)로 문서에서 받는다 — CSP(script-src 'self')가 onerror= 를 막는다. */
  document.addEventListener('error', (e) => {
    const img = e.target;
    /* 홈 띠 카드(2026-10-04): 글의 사진을 못 받으면 학교 사진으로 한 번 갈아 끼우고, 그것도 못 받으면 사진만 빼고 바탕색 칸으로 */
    if (img && img.classList && img.classList.contains('news-tile-img')) {
      const fb = img.getAttribute('data-fallback');
      const ff = img.getAttribute('data-fallback-focus');
      img.removeAttribute('data-fallback');
      img.removeAttribute('data-fallback-focus');
      if (fb) { if (ff && PHOTO_FOCUS_RE.test(ff)) img.style.objectPosition = ff; img.src = fb; } else img.remove();
      return;
    }
    /* 글의 사진·학교 사진 모두 img.notice-thumb 한 장이 썸네일 자리다 */
    if (!img || !img.classList || !img.classList.contains('notice-thumb')) return;
    const card = img.closest('.has-thumb');
    img.remove();
    if (card) card.classList.remove('has-thumb');
  }, true);
  /* 우리 학교 소식 「전체 보기」 (2026-10-04) — 띠는 통째로 다시 그려지므로 그릇(#home-news)에 위임한다 */
  const newsBox = $('#home-news');
  if (newsBox) newsBox.addEventListener('click', (e) => {
    if (!e.target.closest('[data-news-all]')) return;
    openNewsSheet();
  });
  /* 취소 — 고치던 것을 버리고 있던 화면으로 돌아간다.
     🔴 저장하지 않는다: collectProfile() 을 부르지 않으므로 입력칸에 친 값은 버려지고
        state.profile 은 손대지 않은 그대로다. 되돌리기가 아니라 '아무 일도 없던 것'이다. */
  $$('[data-onboard-cancel]').forEach((btn) =>
    btn.addEventListener('click', () => {
      onboardEditing = false;
      onboardStep = 0;
      initOnboarding();          /* 칸을 저장된 프로필 값으로 되돌린다 */
      showScreen('my');
    })
  );

  /* 뒤로 — 친 값은 그대로 두고 단계만 되돌린다 (노션 UI-2).
     앞으로 갈 때의 확인(학교·학년)은 여기서 하지 않는다: 돌아가는 길을 막으면
     못 채운 칸에 갇힌다. 어디까지 왔는지는 이어보기 장부에도 적는다. */
  $('#btn-onboard-back').addEventListener('click', () => {
    if (onboardStep <= 0) return;
    onboardStep -= 1;
    renderOnboardStep();
    onboardProgressSave();
  });

  $$('.onboard-step [data-next]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (onboardStep === 1) {
        if (!$('#in-school').value.trim()) { toast('학교명 입력 필요'); return; }
        if (!getChip('#in-year')) { toast('학년 선택 필요'); return; }
      }
      /* 다 못 친 값(출생연도 '19')·있을 수 없는 날짜는 칠 때 못 막으니 넘어갈 때 짚는다 (input-guard ②) */
      if (!guardStepOk(btn.closest('.onboard-step'))) return;
      onboardStep += 1;
      renderOnboardStep();
      onboardProgressSave();   /* 어느 단계까지 왔는지도 진행분이다 */
    })
  );

  /* 온보딩에서 친 것·고른 것을 적어 둔다 — 위임 하나로(칸이 많고 단계마다 다시 그린다) */
  ['input', 'change', 'click'].forEach((ev) => {
    $('#screen-onboarding').addEventListener(ev, () => onboardProgressSave());
  });

  $('#btn-finish-onboard').addEventListener('click', () => {
    /* 저장 전에 **온보딩 전체**를 한 번 더 본다 — 이어보기로 옛 진행분이 칸에 채워진 경우 등.
       걸린 칸이 있으면 그 칸의 단계로 데려가 짚는다(저장하지 않는다) */
    const bad = guardFirstBad($('#screen-onboarding'));
    if (bad) {
      const st = bad.el.closest('.onboard-step');
      if (st && st.dataset.step != null && Number(st.dataset.step) !== onboardStep) {
        onboardStep = Number(st.dataset.step);
        renderOnboardStep();
        onboardProgressSave();
      }
      guardShowBad(bad);
      return;
    }
    onboardEditing = false;
    const isFirstTime = !state.profile;
    state.profile = collectProfile();
    /* 민감정보 동의는 프로필이 아니라 따로 둔다 — 프로필은 서버로 나가는 값이고
       동의 여부는 '나가도 되는가'를 정하는 값이라 섞으면 헷갈린다. */
    state.consent = { sensitive: !!$('#in-sensitive-ok').checked };
    saveState();
    /* 학교가 정해졌거나 바뀌었으면 그 학교 공고 파일을 받는다 (위 주석) */
    loadNoticesIfSchoolChanged();
    loadNewsIfSchoolChanged();   // 교내 소식도 같은 조건으로 (2026-09-30)
    /* 온보딩을 마쳤으니 '쓰다 만 온보딩' 표시를 지운다 — 안 지우면 다음에 켤 때
       이미 만든 프로필을 두고 또 온보딩 진행분을 들고 있게 된다 */
    clearTimeout(onboardSaveTimer);
    if (typeof resumeSave === 'function') resumeSave({ onboard: null });
    toast('프로필을 저장했습니다');
    showScreen('home');
    // 프로필을 처음 만든 직후에 알림 동의를 딱 한 번 묻는다 (이후에는 MY 화면에서만)
    // 저장 완료 토스트가 사라진 뒤에 물어본다 (문구가 겹치지 않게)
    if (isFirstTime && typeof notifyMaybeAskConsent === 'function') notifyMaybeAskConsent(2900);
    if (isFirstTime) if (typeof trackUse === 'function') trackUse('onboard', '');
  });

  $('#in-flags').addEventListener('change', syncConsentRow);
  /* 시·도를 바꾸면 그 아래 시·군·구 목록을 다시 채운다 (2026-08-30) */
  $('#in-region').addEventListener('change', () => { fillRegionCities('#in-region', '#in-region-city'); residenceMovedOff(); });
  $('#in-region-city').addEventListener('change', residenceMovedOff);
  $('#in-parent-region').addEventListener('change', () => fillRegionCities('#in-parent-region', '#in-parent-region-city'));
  $('#in-origin-region').addEventListener('change', () => fillRegionCities('#in-origin-region', '#in-origin-city'));
  /* 적합도 높이기 알약 — 같은 처지의 다른 알약을 끄고 이것을 켠다 · 켜진 것을 다시 누르면 푼다(안 답함) */
  $('#in-traits').addEventListener('click', (e) => {
    const b = e.target.closest('[data-trait]');
    if (!b) return;
    const was = b.classList.contains('on');
    $$(`#in-traits [data-trait="${b.dataset.trait}"]`).forEach((o) => o.classList.remove('on'));
    if (!was) b.classList.add('on');
  });

  /* 히어로 금액을 누르면 '금액 상세' — 그 숫자가 어떻게 나왔는지 줄 단위로 보여 준다 */
  const heroAmt = $('#hero-amount');
  if (heroAmt) {
    heroAmt.addEventListener('click', renderAmountDetail);
    heroAmt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); renderAmountDetail(); }
    });
  }

  /* '받고 있는 장학금 없음'과 나머지는 같이 켤 수 없다 — 둘 다 켜지면 뜻이 모순된다 */
  const scholBox = $('#in-scholarships'), scholNone = $('#in-schol-none');
  if (scholBox && scholNone) {
    scholBox.addEventListener('change', () => {
      if ($$('#in-scholarships input:checked').length) scholNone.checked = false;
    });
    scholNone.addEventListener('change', () => {
      if (scholNone.checked) $$('#in-scholarships input').forEach((c) => (c.checked = false));
    });
  }

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
      const was = chip.classList.contains('active');
      group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      /* `data-toggle` 묶음(선택 사항 — 지금 주소에 산 지)은 켜진 칩을 다시 누르면 푼다(안 답함) · 나머지(학년·학적)는 늘 하나가 켜져 있다 */
      if (!(was && group.hasAttribute('data-toggle'))) chip.classList.add('active');
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

  /* 홈 히어로 그림 칸 — 누르면 그 목록으로 간다(장식으로 두지 않는다).
     교내·교외는 장학금 탭의 같은 필터 칸을 켜고, 마감 임박은 전체 칸 + 마감 임박순으로 연다.
     ⚠️ 칩을 직접 .click() 하지 않는다 — 탭을 옮기기 전에 목록을 한 번 더 그리게 된다. */
  $('#hero-tiles').addEventListener('click', (e) => {
    const t = e.target.closest('[data-hero-go]');
    if (!t) return;
    const go = t.dataset.heroGo;
    if (go === 'applications') { showScreen('applications'); return; }
    if (go === '대외활동' || go === '공모전') {
      /* 종류 칩을 켠 채로 연다 — 칩을 직접 누른 것과 같은 상태(분야는 푼다 · 칩 배선 주석과 같은 이유) */
      activitiesFilter = go;
      activitiesField = 'all';
      $$('#activities-filters .filter-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === go));
      showScreen('activities');
      return;
    }
    exploreFilter = go === 'deadline' ? 'all' : go;
    $$('#explore-filters .filter-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === exploreFilter));
    if (go === 'deadline') { $(SORT_MENUS.explore.label).textContent = EXPLORE_SORTS.deadline.label; exploreSort = 'deadline'; }
    showScreen('explore');
  });

  /* 검색 (2026-08-30) — 치는 대로 거른다.
     ⚠️ 디바운스를 두지 않았다. 등록이 190건대라 한 번 거르는 데 밀리초 단위고,
        기다렸다 그리면 '반응이 굼뜨다'는 느낌만 준다. 몇 천 건이 되면 그때 넣는다. */
  {
    const box = $('#explore-search');
    const clear = $('#explore-search-clear');
    const sync = () => {
      exploreQuery = box.value;
      clear.hidden = !box.value;
      renderExplore();
    };
    box.addEventListener('input', sync);
    /* type="search" 의 브라우저 기본 ✕ 는 iOS 에서 안 보인다 — 우리 버튼을 쓴다 */
    clear.addEventListener('click', () => { box.value = ''; sync(); box.focus(); });
  }

  $('#explore-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    exploreFilter = chip.dataset.filter;
    $$('#explore-filters .filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderExplore();
  });

  /* 대외활동·공모전 — 탐색 화면과 같은 손짓(칩 · 검색). ⚠️ 칩 상태는 **제 줄 안에서만** 바꾼다 —
     `$$('.filter-chip')` 전체를 건드리면 다른 화면의 칩이 같이 꺼진다(그래서 위 탐색 쪽도 좁혔다). */
  $('#activities-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    activitiesFilter = chip.dataset.filter;
    /* 🔴 종류를 바꾸면 **분야를 푼다** (2026-10-03) — 공모전에만 있는 분야를 고른 채 대외활동으로
       옮기면 칩은 켜져 있는데 목록이 0건이 된다. 칩 줄을 다시 그릴 때도 한 번 더 지킨다
       (renderActivityFieldChips) — 거기서 푸는 것은 데이터가 바뀌어 분야가 사라지는 길이다. */
    activitiesField = 'all';
    $$('#activities-filters .filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderActivities();
  });

  /* 분야 칩 — 같은 손짓. ⚠️ 여기서도 선택자를 **제 그릇 안으로** 좁힌다(관문이 전역 $$('.filter-chip') 를 막는다).
     켜짐 표시는 손으로 토글하지 않는다 — 칩 줄 자체를 renderActivityFieldChips 가 다시 그리면서 붙인다
     (칩이 데이터에서 만들어지므로, 토글해 두어도 다시 그리는 순간 날아간다). */
  $('#activities-field-filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    if (chip.dataset.more) activitiesFieldOpen = chip.dataset.more === 'open';
    else activitiesField = chip.dataset.filter;
    renderActivities();
  });
  /* 관심 관문 (2026-10-24) — 저장·취소·바꾸기 */
  $('#act-gate-save').addEventListener('click', saveActivityGate);
  $('#act-gate-cancel').addEventListener('click', () => { actGateEditing = false; actGateDrawn = false; renderActivities(); });
  $('#act-gate-edit').addEventListener('click', () => { actGateEditing = true; actGateDrawn = false; renderActivities(); appScrollTo(0); });
  /* 정렬 버튼은 탐색 화면과 한 벌로 묶었다 — 아래 '정렬 버튼' 블록(SORT_MENUS) 이 둘 다 배선한다 */
  {
    const box = $('#activities-search');
    const clear = $('#activities-search-clear');
    const sync = () => {
      activitiesQuery = box.value;
      clear.hidden = !box.value;
      renderActivities();
    };
    box.addEventListener('input', sync);
    clear.addEventListener('click', () => { box.value = ''; sync(); box.focus(); });
  }

  /* 정렬 버튼 — **누르면 목록이 열린다** (2026-08-31 개발자 지시).
     🔴 예전에는 짧게 누르면 기준이 한 칸씩 넘어가고 길게 눌러야 목록이 떴다.
        그 방식은 지금 무슨 기준인지 눌러 보기 전에는 알 수 없고, 길게 누르기는
        아무도 발견하지 못하는 동작이다. 한 번 눌러 목록에서 고르는 쪽이 짧다.
     ⚠️ 키보드도 같은 길이다 — Enter/Space 는 click 으로 와서 목록을 연다.
     대외활동·공모전 화면도 **같은 배선**을 탄다(2026-09-30 · SORT_MENUS). */
  for (const which of Object.keys(SORT_MENUS)) {
    const btn = $(SORT_MENUS[which].btn);
    const menu = $(SORT_MENUS[which].menu);
    if (!btn || !menu) continue;

    btn.addEventListener('click', () => {
      if (!menu.hidden) { closeSortMenu(which); return; }
      openSortMenu(which);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); openSortMenu(which); }
    });

    menu.addEventListener('click', (e) => {
      const pick = e.target.closest('[data-sort]');
      if (pick) applySort(pick.dataset.sort, which);
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sort-wrap')) closeSortMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSortMenu(); });

  /* 펼친 패널 안의 기록 버튼 — 상세 시트를 열지 않고 그 자리에서 남긴다 */
  document.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-mark-submit]');
    const wb = e.target.closest('[data-mark-won]');
    const lb = e.target.closest('[data-mark-lost]');
    const ub = e.target.closest('[data-undo-result]');
    if (ub) {
      /* 잘못 누른 결과 되돌리기 — 기록만 지운다. 상세 시트의 '결과 기록 취소'와 같은 함수다 */
      e.stopPropagation();
      /* id 로 넘긴다 — undoProgress 는 공고 없이도 기록을 되돌린다(공고를 요구하면 내려간 공고의 기록이 영영 안 지워진다) */
      undoProgress(ub.dataset.undoResult);
      return;
    }
    if (!sb && !wb && !lb) return;
    e.stopPropagation();
    const id = (sb || wb || lb).dataset.markSubmit || (wb || lb).dataset.markWon || lb.dataset.markLost;
    const sch = appSch(id);   // 사본으로 보이는 줄의 단추도 동작해야 결과를 적을 수 있다
    if (!sch) return;
    if (sb) recordSubmitted(sch); else recordResult(sch, !!wb);
  });

  /* 공고 저장(북마크) — 2026-09-07.
     🔴 단추가 카드 **바깥**에 있어(saveBtnHtml 주석) 상세 열기와 겹치지 않는다.
        그래도 stopPropagation 을 둔다: 나중에 누가 카드 안으로 옮겨도 조용히
        상세가 함께 열리는 일이 없게. */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-save]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    toggleSave(b.dataset.save);
  });

  /* 달력 — 달 이동과 날짜 펼치기 */
  document.addEventListener('click', (e) => {
    const mv = e.target.closest('[data-cal-move]');
    if (mv) {
      const ms = calMonthStart();
      calCursor = new Date(ms.getFullYear(), ms.getMonth() + Number(mv.dataset.calMove), 1);
      calPicked = null;                      // 달을 옮기면 펼쳐 둔 날은 그 달에 없다
      renderCalendar();
      return;
    }
    const day = e.target.closest('[data-cal-day]');
    if (!day) return;
    const iso = day.dataset.calDay;
    calPicked = (!iso || iso === calPicked) ? null : iso;
    /* 🔴 격자를 통째로 다시 그리지 않는다 — 날짜를 누를 때마다 달력이 깜빡이고
       스크롤이 튄다(일괄 준비 목록에서 겪은 것과 같은 유형). 바뀐 것만 고친다. */
    $$('.cal-cell[data-cal-day]').forEach((c) => {
      const on = !!calPicked && c.dataset.calDay === calPicked;
      c.classList.toggle('cal-picked', on);
      c.setAttribute('aria-pressed', String(on));
    });
    const panel = $('#cal-day');
    if (panel) panel.innerHTML = calPicked ? calDayHtml(calPicked) : '';
  });

  /* 빈 상태의 '다음 동작' 단추 (2026-09-10 페이스리프트).
     빈 화면이 "홈 화면에서 준비할 수 있습니다"처럼 **다른 데로 보내기만** 하고
     정작 갈 단추는 없었다. 여기서 그 한 걸음을 받는다. */
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go) return;
    showScreen(go.dataset.go);
  });

  /* 대외활동·공모전 카드 → 장학과 같은 상세 시트 (2026-10-01) */
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-activity]');
    if (card) openActivityDetail(card.dataset.activity);
  });

  document.addEventListener('click', (e) => {
    /* 🔴 카드를 민 직후에 오는 click은 '열기'가 아니다 — 밀었는데 상세가 열리면
       삭제 버튼을 보려던 학생이 매번 시트를 닫아야 한다. 선택 모드에서도 열지 않는다. */
    if (e.target.closest('[data-pick]')) return;
    /* 이름 있는 손잡이('세부사항 입력하기')도 카드와 같은 길로 여닫는다 */
    const handle = e.target.closest('[data-log-toggle]');
    const card = handle || e.target.closest('[data-detail]');
    if (!card) return;
    /* 신청 내역에서는 시트가 아니라 **그 자리에서 펼친다** (2026-09-01 개발자 지시).
       담아 둔 공고에서 궁금한 것은 공고 내용이 아니라 '내가 어디까지 왔나'다.
       공고 원문은 펼친 패널 안의 '공고 상세 보기'로 간다. */
    const row = card.closest('.swipe-row');
    if (row && !appsSelectMode && handle) {
      const log = row.querySelector('.app-log');
      if (log) {
        log.hidden = !log.hidden;
        if (log.hidden) appsLogOpen.delete(row.dataset.row); else appsLogOpen.add(row.dataset.row);
        row.classList.toggle('log-open', !log.hidden);
        row.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', String(!log.hidden)));
        /* 🔴 펼치기만 하면 화면 밖에서 열린다 — 카드(250px) 아래로 300px 가 더 붙는데
           카드가 화면 중간 아래에 있으면 펼쳐진 부분이 통째로 안 보인다.
           카드를 위로 올려 패널 전체가 화면에 들어오게 한다. */
        if (!log.hidden) row.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
    }
    if (appsSelectMode && card.closest('#apps-list')) {
      const id = card.dataset.detail;                 // 선택 모드에서는 카드를 눌러도 선택이 된다
      if (appsSelected.has(id)) appsSelected.delete(id); else appsSelected.add(id);
      renderApplications();
      return;
    }
    /* 신청 내역의 이름 박스도 홈·장학금 탭과 **같이** 상세 시트를 연다
       (2026-09-02 개발자 지시). 그 자리에서 펼치는 진행 기록은 아래
       '세부사항 입력하기' 손잡이 몫이라 서로 겹치지 않는다.
       ⚠️ 한때 이 카드를 눌러도 아무 일이 없게 뒀던 것은 **밀어서 삭제** 때문이었다 —
          목록을 내리다 손이 스치면 삭제가 뜨던 시절의 방어다. 그 손짓은 제거됐으므로
          (v129) 눌림을 막을 이유가 없어졌다. */
    openDetail(card.dataset.detail);
  });

  /* 금액 상세의 줄 → 장학금 찾기의 그 카드로 이동 (2026-08-27 개발자 요청).
     🔴 필터가 '교내'·'교외'로 걸려 있으면 그 카드가 목록에 없어
        스크롤할 곳이 사라진다. 그래서 **필터만 전체로 되돌린다** —
        정렬은 건드리지 않는다(학생이 고른 기준을 말없이 바꾸면 그것도 임의 변경이다). */
  /* 🔴 `details` 안쪽 클릭을 통째로 막으면 안 된다 (2026-08-27에 그렇게 했다가 걸렸다).
     뺀 공고(`함께 못 받는 공고 2건`)와 미확인 공고(`공고 N건 보기`)는 **그 접기 안에 들어 있어서**,
     통째로 막으면 그 줄들은 눌러도 안 간다. 막아야 하는 것은 셋뿐이다:
       ① summary — 여닫는 손잡이  ② a — 원문 공고 링크
       ③ **그 줄 자신의** 접기 안쪽 (원문 발췌·합친 학교 목록)
     ③이 핵심이다. 바깥 접기 안에 든 줄은 `row.contains(det)` 가 false 라 그대로 이동한다. */
  const notNav = (t, row) => {
    if (t.closest('summary') || t.closest('a')) return true;
    const det = t.closest('details');
    return !!(det && row.contains(det));
  };
  document.addEventListener('click', (e) => {
    const row = e.target.closest('[data-goto]');
    if (!row || notNav(e.target, row)) return;
    /* 시트 **안**에서 눌렀을 때만 돌아갈 곳을 기억한다 — index.html 의
       `data-goto="explore"` 같은 화면 이동 버튼까지 걸리면 엉뚱한 곳으로 되돌아간다 */
    /* 🔴 **진짜 공고일 때만** 기억한다 — openDetail 은 못 찾으면 조용히 돌아오는데,
       그때 되돌아갈 곳만 남으면 학생이 한 번 더 내려야 닫힌다. */
    if (row.closest('#detail-sheet') && findSch(row.dataset.goto)) rememberAmountBack();
    openDetail(row.dataset.goto);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest && e.target.closest('[data-goto]');
    if (!row || notNav(e.target, row)) return;
    e.preventDefault();
    /* 🔴 **진짜 공고일 때만** 기억한다 — openDetail 은 못 찾으면 조용히 돌아오는데,
       그때 되돌아갈 곳만 남으면 학생이 한 번 더 내려야 닫힌다. */
    if (row.closest('#detail-sheet') && findSch(row.dataset.goto)) rememberAmountBack();
    openDetail(row.dataset.goto);
  });

  $('#sheet-backdrop').addEventListener('click', dismissSheet);
  $('#detail-sheet').addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-handle')) dismissSheet();
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
  /* 쓰던 신청서를 치는 동안 적어 둔다 (2026-09-09 · 이어보기 3겹).
     🔴 시트 **하나에 위임**한다 — 시트는 innerHTML 이 계속 갈리므로 그릴 때마다 걸면
        리스너가 쌓인다(바로 위 일괄 준비 체크가 같은 이유로 위임이다). */
  ['input', 'change'].forEach((ev) => {
    $('#detail-sheet').addEventListener(ev, () => { if (formFill) formProgressSave(); });
  });
  enableSheetSwipe($('#detail-sheet'), dismissSheet);   // 쓸어 내리기 — 개발자가 말한 그 동작
  wireAppsManage();   // 신청 내역 — 왼쪽으로 밀어 삭제 · 선택 모드 (2026-08-24)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#notify-sheet').hidden) closeNotifyPanel();
    else if (!$('#detail-sheet').hidden) dismissSheet();
  });

  $('#btn-apply-all').addEventListener('click', applyAll);

  /* 우리 학교 게시판 공고 더보기 (2026-10-10) — 다시 그리지 않고 가려 둔 카드를 편다(홈 '나에게 맞는 장학금'과 같은 방식) */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-live-more]');
    if (!b) return;
    liveOpen = !liveOpen;
    const list = $('#live-list');
    if (list) list.classList.toggle('more-open', liveOpen);
    b.setAttribute('aria-expanded', liveOpen ? 'true' : 'false');
    b.textContent = liveOpen ? '접기' : `더보기 (${list ? list.querySelectorAll('.home-extra').length : 0}건)`;
  });

  /* 재단·지자체 새 공고 더보기 (2026-10-01) — 이 구역만 다시 그린다. 다 폈으면 '접기'로 석 장에 돌아간다. */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-external-more]')) return;
    const total = externalNoticesForMe().length;
    externalShown = externalShown >= total
      ? HOME_DEADLINE_TOP
      : (externalShown < HOME_DEADLINE_MORE ? HOME_DEADLINE_MORE : externalShown + HOME_DEADLINE_MORE);
    $('#external-notices').innerHTML = externalNoticesHtml();
  });

  /* '마감 임박' 더보기 (노션 UI-14) — 다시 그리지 않고 **가려 둔 카드를 편다**.
     renderHome() 을 부르면 히어로 금액이 또 세어 올라가고(countUp 900ms) 스크롤이 튄다. */
  {
    const btn = $('#home-deadline-more');
    if (btn) btn.addEventListener('click', () => {
      homeDeadlineOpen = !homeDeadlineOpen;
      $('#home-deadline-list').classList.toggle('more-open', homeDeadlineOpen);
      btn.textContent = homeDeadlineOpen ? '접기' : '더보기';
      btn.setAttribute('aria-expanded', homeDeadlineOpen ? 'true' : 'false');
    });
  }

  const editProfile = () => {
    onboardEditing = !!state.profile;   /* 이미 프로필이 있으면 '고치는 중'이다 */
    initOnboarding();
    showScreen('onboarding');
  };
  /* 🔴 홈 톱니는 없앴다 (2026-09-11 개발자 지시) — 입구는 MY 프로필 카드 하나다.
     배선은 남겨 두되 **있을 때만** 건다(없는 요소에 걸면 그 자리에서 죽는다). */
  { const e = $('#btn-edit-profile'); if (e) e.addEventListener('click', editProfile); }
  { const e = $('#btn-my-edit'); if (e) e.addEventListener('click', editProfile); }
  { const e = $('#act-gate-profile'); if (e) e.addEventListener('click', () => { actGateDrawn = false; editProfile(); }); }   // 대외활동 관문 「내 정보」의 「학적정보 수정」 — 같은 입구(2026-11-15)

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
  /* 🔴 **카드 전체를 버튼으로 두지 않는다** (2026-09-12 개발자 지시 — "학적정보수정 부분만
     눌렀을 때 수정가능하게"). 전에는 `onTap('#my-profile', …)` 로 카드 아무 데나 누르면
     수정 화면이 열려, 학생이 성적·구간 표를 짚기만 해도 화면이 바뀌었다.
     ⚠️ 그때 필요했던 **캡처 단계 가로채기 둘도 함께 걷었다** — 사진 단추·'지우기'가 카드로
        번지는 것을 막던 장치라, 카드가 버튼이 아니게 된 지금은 할 일이 없다. 남은 것은
        '지우기'가 실제로 하는 일 하나뿐이고, 위임이라 카드를 다시 그려도 산다. */
  $('#my-profile').addEventListener('click', (e) => {
    if (e.target.closest('.my-edit-hint')) { editProfile(); return; }
    const del = e.target.closest('[data-forget]');
    if (!del) return;
    e.preventDefault();
    forgetLearned(del.dataset.forget);
  });

  /* 🔴 브라우저 confirm 을 쓰지 않는다 — 그 창은 앱이 아니라 브라우저가 만드는 것이라
     무엇이 지워지는지 목록으로 보여 줄 수 없고, 확인·취소 두 버튼밖에 못 넣는다.
     되돌릴 수 없는 동작이므로 **무엇이 사라지는지 적어 두고** 묻는다. */
  /* 설정 화면 — MY 오른쪽 위 톱니로 들어가고, 왼쪽 위 화살표로 되돌아온다 (2026-09-11). */
  $('#btn-open-settings').addEventListener('click', () => showScreen('settings'));
  $('#btn-settings-back').addEventListener('click', () => showScreen('my', { back: true }));
  /* MY 메뉴 줄 → 안쪽 화면 (2026-10-10 C안 구조). 되돌아오기는 왼쪽 위 화살표와 오른쪽으로 쓸기(SWIPE_BACK_TO) */
  $$('[data-my-go]').forEach((b) => b.addEventListener('click', () => showScreen(b.dataset.myGo)));
  for (const n of ['myinfo', 'mydocs', 'mysaved']) $(`#btn-${n}-back`).addEventListener('click', () => showScreen('my', { back: true }));
  $('#my-saved').addEventListener('click', (e) => {
    const b = e.target.closest('[data-saved-kind]');
    if (!b || b.dataset.savedKind === savedKind) return;
    savedKind = b.dataset.savedKind;
    renderSaved();
  });
  $('#btn-trash-back').addEventListener('click', () => showScreen('settings', { back: true }));
  $('#btn-terms-back').addEventListener('click', () => showScreen('settings', { back: true }));
  for (const id of ['#btn-logins-back', '#btn-faq-back', '#btn-support-back', '#btn-perms-back']) {
    const b = $(id);
    if (b) b.addEventListener('click', () => showScreen('settings', { back: true }));
  }

  /* 🔴 안쪽 화면 셋 다 같은 손짓으로 나간다 (2026-09-11 개발자 요청은 휴지통·약관이었는데,
     설정만 안 되면 거기서 쓸어 보고 '안 된다'가 된다 — 안쪽 화면이라는 점이 같다).
     어디로 나가는지는 위 `SWIPE_BACK_TO` 한 곳에 적혀 있다. */
  enableScreenSwipeBack($('#app'));

  $('#btn-reset').addEventListener('click', () => {
    const pop = $('#wallet-pop');
    const bg = $('#wallet-pop-backdrop');
    if (!pop) return;
    const close = () => { pop.classList.remove('show'); if (bg) bg.classList.remove('show'); pop.hidden = true; };
    pop.innerHTML = `
      <p class="wp-title wp-danger">데이터 초기화</p>
      <p class="wp-issue">아래가 이 기기에서 모두 사라집니다. 되돌릴 수 없습니다.</p>
      <ul class="wp-list">
        <li>프로필 (학교·성적·자격)</li>
        <li>신청 내역과 진행 기록</li>
        <li>알림 설정과 알림함</li>
      </ul>
      <label class="auth-remember wp-wipe"><input type="checkbox" id="wp-wipe-docs" /> 서류 보관함 파일과 휴지통도 지우기 (공용 기기라면 체크)</label>
      <div class="wp-actions">
        <button class="wp-cancel" type="button">취소</button>
        <button class="wp-go" type="button">초기화</button>
      </div>`;
    pop.hidden = false;
    if (bg) bg.classList.add('show');
    requestAnimationFrame(() => pop.classList.add('show'));
    pop.querySelector('.wp-cancel').addEventListener('click', close);
    pop.querySelector('.wp-go').addEventListener('click', () => {
      /* 🔴 서류(증명서 스캔)는 기본으로 남긴다 — 다시 떼려면 주민센터·학교에 가야 한다(09-11 휴지통 결정과 같은 이유).
         공용 기기라면 학생이 골라서 서류·휴지통까지 **영구히** 지운다(휴지통으로 옮기지 않는다 — 남기면 공용 기기에 그대로 있다). (2026-11-15) */
      const wipeDocs = !!(pop.querySelector('#wp-wipe-docs') || {}).checked;
      close();
      if (wipeDocs) {
        Promise.all([walletTx('readwrite', (st) => st.clear()), trashTx('readwrite', (st) => st.clear())])
          .then(() => walletRefresh())
          .then(() => toast('서류 보관함과 휴지통도 지웠어요'))
          .catch(() => toast('서류를 지우지 못했어요 · 서류 보관함에서 직접 지워 주세요'));
      }
      [STORAGE_KEY, ...LEGACY_KEYS].forEach((k) => localStorage.removeItem(k));
      /* 🔴 **이어보기 장부도 함께 지운다** (2026-09-09 코드 리뷰 — 안 지우면 초기화가 거짓말이 된다).
         그 장부에는 쓰다 만 온보딩(이름·학번·전화·계좌번호)과 신청서에 쓴 글이 들어 있어서,
         지우지 않으면 다음에 앱을 켤 때 **지웠다고 말한 값이 그대로 되살아난다.** */
      if (typeof resumeClear === 'function') resumeClear();
      formFill = null;
      /* 🔴 손으로 다시 적지 말 것 — 늘어난 칸이 빠진다(위 emptyState 주석).
         ⚠️ 이 설명을 줄 끝 `//` 주석으로 두지 말 것 — verify/ui-tone.mjs 의 주석 제거기는
            줄 **첫머리** `//` 만 걷어내서, 줄 끝에 둔 🔴 가 '화면에 이모지가 있다'로 잡힌다. */
      state = emptyState();
      if (typeof notifyReset === 'function') notifyReset(); // 알림 설정·알림함도 함께 초기화
      initOnboarding();
      showScreen('onboarding');
    });
  });

  // 자동추천
  attachAutocomplete($('#in-school'), schoolSuggestions);
  attachAutocomplete($('#in-major'), majorSuggestions);
  ['change', 'input'].forEach((ev) =>
    $('#in-school').addEventListener(ev, () => {
      renderCampusChips(null);
      /* 학과 칸에 닿기 전에 미리 받아 둔다 — 첫 글자에 전국 공통 목록이 보이지 않게 */
      loadMajorsFor($('#in-school').value.trim());
      renderTrackChips();   // 학교가 바뀌면 계열 칩도 그 학교 것으로(파일이 아직이면 여덟 개 전부)
    })
  );
  /* 캠퍼스를 바꾸면 그 캠퍼스의 계열로 — 칩 그룹 공용 배선이 .active 를 옮긴 **뒤**에 돌아야 해서 같은 click 을 한 번 더 듣는다 */
  $('#in-campus').addEventListener('click', (e) => { if (e.target.closest('.chip')) renderTrackChips(); });
  /* 「+n」·「접기」 — 계열 칩 접기 (2026-10-24). .chip 이 아니라 공용 배선이 값으로 삼지 않는다 */
  $('#in-track').addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (!more) return;
    trackChipsOpen = more.dataset.more === 'open';
    renderTrackChips();
  });
  /* 학과를 고르거나 다 치면 계열이 따라온다 — 자동완성의 pick 은 change 를 보낸다(attachAutocomplete) */
  $('#in-major').addEventListener('change', syncTrackFromMajor);
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
    syncPushMerging(state).then(syncTellIfRejected)
      .catch(() => { /* 실패해도 앱은 그대로 — 폰 안 저장이 원본이다 */ });
  }, (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.pushDelayMs) || 2000);
}

/* 🔴 **DB 가 값을 거절한 것은 학생에게 알린다** (2026-09-26 · 고문 보고서 Q6)

   0004_profile_columns.sql 부터 있을 수 없는 값(성적 999 · 1만 자 학교 이름)은 DB 가 쓰기를
   거절한다. 그런데 올리기 실패는 여기서 `.catch(() => {})` 로 **통째로 삼켜지고 있었다** —
   그러면 프로필이 **영영 서버에 안 올라가고** 학생은 다른 기기에서 이어쓰기가 안 되는 이유를
   모른다. '인터넷이 없다'는 지나가도 되지만 '값이 틀렸다'는 지나가면 안 된다.

   ⚠️ **한 번만 알린다.** 값을 고치지 않으면 저장할 때마다 같은 자리에서 거절되므로,
      매번 띄우면 토스트가 화면을 덮어 앱을 못 쓴다.
   🔴 **성공하면 그 기억을 푼다** (2026-09-26 코드 리뷰에서 잡았다). 안 풀면, 값을 고쳐
      한 번 올라간 뒤 **다른 칸**이 거절될 때 다시 조용해진다 — 이 장치가 없애려던 상태로
      그대로 돌아간다. 푸는 자리는 '실제로 올라간 순간' 하나뿐이다.
   ⚠️ 문구는 supabase-client.js 가 만든다(어느 칸이 문제인지 아는 곳이 거기다). 여기서
      따로 만들지 말 것 — 두 곳이 갈라진다. */
let syncRejectTold = false;
function syncTellIfRejected(r) {
  if (r && r.ok) { syncRejectTold = false; return r; }
  if (!r || !r.rejected || syncRejectTold) return r;
  syncRejectTold = true;
  if (typeof toast === 'function') toast(r.error);
  return r;
}

/* 🔴 **다른 기기가 먼저 썼으면 덮지 않고 합친 뒤 올린다** (2026-09-25 · 고문 보고서 Q6)

   `syncPush` 는 이제 '내가 본 판이 아직 서버에 있을 때만' 고친다(supabase-client.js).
   다른 기기가 먼저 썼으면 `conflict` 를 돌려주는데, 그때 **그냥 포기하면 이 기기가 고친 것이
   영영 안 올라간다.** 그래서 받아서 합치고(`syncApplyRemote` — 합치는 규칙은 거기 한 곳뿐이다)
   **한 번만** 다시 올린다.
   ⚠️ 다시 올리는 것은 한 번뿐이다 — 계속 밀면 두 기기가 서로를 밀어내며 돌 수 있다.
      한 번 더 부딪히면 다음 저장이나 다음 실행이 가져간다(기기 안 저장이 원본이라 안 잃는다). */
async function syncPushMerging(st) {
  const r = await syncPush(st);
  if (!r || !r.conflict || !r.remote) return r;
  syncApplyRemote(r.remote, { quiet: true });   // 합치기만 한다 — 방금 고친 값을 되돌리지 않는다
  /* ⚠️ 다시 올릴 때는 **전역 `state`** 다 — `syncApplyRemote` 가 고치는 것이 그것이라,
     넘겨받은 `st` 를 그대로 쓰면 합친 결과가 아니라 합치기 전 것을 올리게 된다. */
  return syncPush(state);
}

/* 서버에서 받은 것을 이 기기에 적는다.
   🔴 **서버에 일부러 안 올린 것**(주민번호·계좌·미동의 민감자격)은 서버에 없다.
      그대로 덮어쓰면 이 기기의 값이 사라지므로, 빈자리만 기기 것으로 채운다. */
function syncApplyRemote(remote, opts) {
  const o = opts || {};
  const wasOnboarding = !state.profile;
  /* 🔴 `quiet` — **덮어쓰기 충돌을 풀 때** 쓴다(syncPushMerging). 방향이 반대이기 때문이다:
     여기 기본값은 '앱을 열었는데 서버가 더 새것' 이라 서버 프로필이 이긴다. 그런데 충돌은
     **학생이 방금 이 기기에서 고쳐서** 올리려던 참에 난 것이라, 서버 것으로 갈아치우면
     방금 고친 값이 눈앞에서 되돌아간다(실측: 성적 4.1 → 3.6).
     그래서 quiet 일 때는 ①프로필·동의는 **이 기기 것을 둔다** ②신청내역은 **합친다**
     ③화면을 다시 그리지 않는다(글을 쓰는 중일 수 있다 — 포커스가 날아간다).
     ⚠️ 잃는 쪽을 막는 기준은 아래 신청내역 주석과 같다 — **글은 다시 못 쓰고, 프로필 한 칸은
        다시 고치면 된다.** 그래서 합치는 것은 글이 든 신청내역 쪽이다. */
  if (remote.profile && !o.quiet) {
    const localP = state.profile || {};
    const localCommon = localP.common || {};
    const p = JSON.parse(JSON.stringify(remote.profile));
    p.common = Object.assign({}, p.common || {});
    for (const k of ['rrn', 'account']) if (localCommon[k] && !p.common[k]) p.common[k] = localCommon[k];
    if (!p.flags) p.flags = localP.flags || [];
    migrateBranchCampus(p);
    migrateFitFields(p);
    state.profile = p;
    /* 🔴 다른 기기에서 학교를 바꿨을 수도 있다 — 받아 둔 공고가 남의 학교 것이면 다시 받는다.
       ⚠️ `quiet` 일 때는 프로필을 안 바꾸므로 이 안(바꾼 경우)에만 둔다. */
    loadNoticesIfSchoolChanged();
    loadNewsIfSchoolChanged();   // 교내 소식도 같은 조건으로 (2026-09-30)
  }
  /* 🔴 **학생이 쓴 글은 서버에 없다** — syncSafeApplications 가 `formAns`·`docs` 를 떼고 보낸다
     (주민등록번호·계좌·자기소개서가 들어 있어서다). 그래서 받은 것으로 통째로 갈아치우면
     **이 기기에 있던 신청서 답이 지워진다.** 프로필의 rrn·account 를 되살리는 것과 같은 이유로
     여기서도 기기 것을 되살린다. ⚠️ 서버가 가진 칸(단계·제출기록)은 서버 것이 이긴다. */
  if (Array.isArray(remote.applications)) {
    const mineByIdx = new Map((state.applications || []).map((a) => [a.id, a]));
    state.applications = remote.applications.map((a) => {
      const local = mineByIdx.get(a.id);
      if (!local) return a;
      const merged = Object.assign({}, a);
      for (const k of ['formAns', 'docs', 'snap']) if (merged[k] == null && local[k] != null) merged[k] = local[k];   // snap: 기기 안 공고 사본(서버로 안 감 · SYNC_OMIT_APP)
      return merged;
    });
    /* 🔴 **서버가 아직 모르는 신청서도 살린다** (2026-09-11 코드 리뷰에서 잡았다).
       위 `map` 은 서버 목록을 기준으로 삼으므로, 아직 못 올린 신청서는 **통째로 사라진다.**
       올리기는 2초 미룬 뒤 조용히 실패할 수 있어서(`syncSchedulePush`) 드문 일이 아니다 —
       폰 A 에서 신청서를 쓰다 지하철에 들어가고, 폰 B 에서 프로필만 고쳐 `updated_at` 이
       올라가면, 폰 A 가 다음에 열릴 때 그 글이 지워진다. 위에서 애써 되살린 바로 그 값이다.
       ⚠️ **학생이 쓴 것이 든 건만** 되살린다 — 빈 건까지 되살리면 다른 기기에서 지운 신청이
          되살아난다. 글은 다시 쓸 수 없고 빈 건은 다시 지우면 되므로, 잃는 쪽을 막는다. */
    const remoteIds = new Set(remote.applications.map((a) => a.id));
    for (const a of mineByIdx.values()) {
      if (remoteIds.has(a.id)) continue;
      if (a.formAns || a.docs) state.applications.push(a);
    }
  }
  if (!o.quiet) {
    state.consent = Object.assign({}, state.consent, { sensitive: !!remote.sensitiveOk });
    state.updatedAt = remote.updatedAt || state.updatedAt;
  }
  saveState({ fromServer: true });

  if (o.quiet) return;                 // 화면은 건드리지 않는다 (위 주석 ③)
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
    if (!remote) { syncTellIfRejected(await syncPushMerging(state)); return; }   // 서버가 비었으면 내 것을 올린다
    const mine = state.updatedAt || '';
    const theirs = remote.updatedAt || '';
    /* 새 기기(프로필이 아예 없음)면 무조건 받는다 — 이게 개발자가 겪던 바로 그 상황이다 */
    if (!state.profile || theirs > mine) syncApplyRemote(remote);
    else if (mine > theirs) syncTellIfRejected(await syncPushMerging(state));
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
    ? `<p class="acc-head">계정</p>
       <p class="acc-mail">${esc(u.email || '로그인됨')}</p>
       <div class="acc-actions">
         <button class="btn btn-outline" id="btn-acc-out">로그아웃</button>
         <button class="btn btn-outline danger" id="btn-acc-del">탈퇴 (서버 정보 삭제)</button>
       </div>`
    : `<p class="acc-head">로그인</p>
       <p class="acc-note">다른 폰에서도 내 정보와 신청 내역을 그대로 볼 수 있어요.</p>
       <div class="acc-actions">
         <button class="btn btn-primary" id="btn-acc-in">로그인</button>
         <button class="btn btn-outline" id="btn-acc-up">회원가입</button>
       </div>`;

  const btnIn = $('#btn-acc-in'); if (btnIn) btnIn.addEventListener('click', () => openAuthSheet('in'));
  const btnUp = $('#btn-acc-up'); if (btnUp) btnUp.addEventListener('click', () => openAuthSheet('up'));
  const btnOut = $('#btn-acc-out');
  if (btnOut) btnOut.addEventListener('click', async () => {
    await authSignOut();
    toast('로그아웃 · 이 기기의 정보는 그대로 유지');
    renderMy();
  });
  const btnDel = $('#btn-acc-del');
  if (btnDel) btnDel.addEventListener('click', async () => {
    if (!confirm('서버에 저장된 프로필·신청내역을 지울까요?\n이 기기의 정보는 그대로 남습니다.')) return;
    const r = await authDeleteData();
    toast(r.ok ? '서버 정보 삭제 완료' : r.error);
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
    }).join('')}</div>`;
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
        <button type="button" class="btn-link" id="btn-auth-forgot">비밀번호 찾기</button>
      </div>`;
  } else if (mode === 'up') {
    mid = emailField + pwField('비밀번호 (6자 이상)', 'new-password') + `
      <label class="check-item consent-item">
        <input type="checkbox" id="in-auth-agree" />
        <span>(필수) <a href="terms.html" target="_blank" rel="noopener">이용약관 · 개인정보처리방침</a>에 동의합니다</span>
      </label>`;
  } else if (mode === 'reset') {
    mid = `<p class="auth-lead">가입할 때 쓴 이메일로 비밀번호 재설정 링크를 보냅니다.</p>`
      + emailField;
  } else {
    mid = `<p class="auth-lead">새로 쓸 비밀번호를 정해 주세요.</p>`
      + pwField('새 비밀번호 (6자 이상)', 'new-password');
  }

  const goLabel = { in: '로그인', up: '가입하기', reset: '재설정 메일 보내기', newpw: '비밀번호 바꾸기' }[mode];
  const swap = mode === 'in'
    ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">회원가입</button>'
    : mode === 'up'
      ? '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">로그인</button>'
      : '<button class="btn btn-outline" id="btn-auth-swap" style="width:100%">← 로그인으로 돌아가기</button>';

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body auth-sheet">
      <h3 class="sheet-title">${title}</h3>
      ${mid}
      <p class="auth-err" id="auth-err" ${errText ? '' : 'hidden'}>${esc(errText || '')}</p>
      <p class="auth-ok" id="auth-ok" ${okText ? '' : 'hidden'}>${esc(okText || '')}</p>
      <button class="btn btn-primary btn-lg" id="btn-auth-go">${goLabel}</button>
      ${swap}
      ${mode === 'in' || mode === 'up' ? authProvidersHtml() : ''}
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
    authShowError('이메일과 비밀번호 입력 필요'); return;
  }
  if (mode === 'reset' && !email) { authShowError('이메일 입력 필요'); return; }
  if (mode === 'newpw' && !pw) { authShowError('새 비밀번호 입력 필요'); return; }
  if (mode === 'up' && !$('#in-auth-agree').checked) {
    authShowError('약관·개인정보처리방침 동의 필요'); return;
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
    renderAuthSheet(null, '재설정 링크 요청 완료. 메일함(스팸함도)을 확인해 주세요.\n'
      + '몇 분 안에 안 오면 아직 메일 발송이 준비되지 않은 것이니 관리자에게 알려 주세요.');
    return;
  }
  if (mode === 'newpw') {
    closeSheet();
    toast('비밀번호 변경 완료');
    renderMy();
    return;
  }
  if (r.needsEmailConfirm) {
    renderAuthSheet(null, '가입 확인 메일 발송 — 메일의 링크를 누른 뒤 로그인해 주세요.');
    return;
  }

  /* '아이디 저장' — 이메일 한 줄만. 비밀번호는 절대 저장하지 않는다. */
  const rememberEl = $('#in-auth-remember');
  if (mode === 'in') setRememberedEmail(rememberEl && rememberEl.checked ? email : '');
  else setRememberedEmail(email);          // 가입한 사람은 그 주소를 기억해 둔다

  closeSheet();
  toast('로그인 완료 · 기기를 바꿔도 이어짐');
  /* 🔴 순서가 중요하다 — **먼저** 서버와 맞춘다. 새 기기에서는 이 줄에서 프로필이
     처음 생기므로, 화면 그리기를 앞에 두면 아직 프로필이 없는 상태로 그리게 된다. */
  await syncAfterLoad();
  renderMy();
}

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
bootJobs.push(loadFormsPdfIndex());   // 신청서 원본 PDF 색인 — 신청 준비 시트의 「원본 양식 그대로 보기」 줄
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
  if (resumePlan.form || resumePlan.sheet) {
    setTimeout(() => {
      if (resumePlan.form) {
        const sch = findSch(resumePlan.form.schId);
        /* 🔴 마감·자격은 여기서 다시 보지 않는다 — 이미 쓴 글을 뺏지 않는다.
           마감된 공고는 시트 안의 판정이 제 손으로 말한다. */
        if (sch) { openSheetShell(); startFormFill(sch, resumePlan.form); return; }
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
  if (document.visibilityState === 'hidden') { resumeMark(); formProgressSave(true); }
});
window.addEventListener('pagehide', () => { resumeMark(); formProgressSave(true); });
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
