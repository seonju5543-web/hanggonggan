/* app-activities.js — 대외활동·공모전 탭(목록·관심 관문·분야 칩·상세) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
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

/* 유료 관문(2026-11-25 · 설계 docs/designs/paid-gate-activities.md 5-4) — 활동 파일과 AI 카드 결과(data/act-read.json)를 같이 받아 **거르고 얹은 목록**을 둔다
   (match-engine publishedActivities — verify/what-shows.mjs 와 같은 함수). 탭·홈·도우미·저장·달력·양식 채우기·온보딩 분야 목록이 전부 이 목록을 본다.
   결과 파일을 못 받으면(404·깨진 JSON → null) 숨김 표시가 달린 글만 안 보이고 나머지는 그대로다(장학금과 같다) · 옛 엔진이 캐시에서 오면 숨김 글을 통째로 감춘다(안전한 쪽) */
function loadActivities() {
  return Promise.all([
    fetch('data/activities.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('data/act-read.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
    .then(([d, ar]) => {
      tidyData(d); tidyData(ar);   // 깨진 글자 씻기(2026-11-17) — 받는 순간 한 번
      if (d && Array.isArray(d.items)) d.items = typeof publishedActivities === 'function' ? publishedActivities(d.items, ar, undefined, SAYS_UNKNOWN) : d.items.filter((n) => !n.paidGate || n.paidOpen);
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
    '#screen-activities .sort-wrap'].forEach((sel) => { const el = $(sel); if (el) el.hidden = on; });
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
      : `아직 ${activitiesField === 'all' ? '' : esc(activitiesField) + ' '}${activitiesFilter === 'all' ? '대외활동·공모전' : esc(activitiesFilter)} 글이 없어요${/* 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내 — 게시판 수집·연결 설명) */ ''}`}</p>`;
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
    ...(n.cardRead ? { cardRead: n.cardRead } : {}),   // AI 카드(유료 관문 · 2026-11-25) — 엔진이 AI 가 쓴 자격 줄을 다시 거르지 않고, 시트 「접수」가 방법 줄을 읽는다
    activity: true, amount: [n.kind || '대외활동', activityHostLine(n)].filter(Boolean).join(' · '),   // 학교 게시판 글자는 어디에도 안 그린다(2026-11-02 개발자 결정)   // 시트·금액 줄이 읽는 값 — 달력·보관함 줄은 이것을 안 쓴다(갈래는 칩 · 둘째 줄은 주최만 — calRowHtml · 2026-11-21) — 지어낸 값이 아니라 종류·주최
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

/* 활동 시트 「공고 안내」에 넘기는 줄 — 시트(openActivityDetail)와 verify/what-shows.mjs 가 이 함수 하나를 쓴다(최종 리뷰 2026-11-26 · 도구가 시트와 다른 줄을 말하지 않게).
   차례: 긴 혜택(40자 넘음 — 짧으면 제목 아래 큰 글씨) → 제목에서 뗀 괄호 대상 → 발췌(혜택·모집기간은 다른 자리 · 자격 줄이 있으면 대상도) → 원문 안내(위 칸에 이미 나온 문장은 뺀다) */
function activitySheetNotices(n) {
  const benefit = unent(activityBenefit(n));
  /* 「대상」 발췌는 자격 줄이 있으면 위 「지원 자격」이 이미 보여 준다 — 같은 A·B·C 조건이 「모집 안내」에 한 번 더 떴다(쇼미더임팩트 · 2026-10-16 개발자 지적) */
  const rows = (n.excerpts || []).filter((x) => x.label !== '혜택' && x.label !== '모집기간' && !(x.label === '대상' && (n.eligibilityLines || []).length));   // 모집기간은 「접수 · 기간」 줄이 말한다(승인 시안 2026-11-02)
  const parts = splitTitleWho(activityTitle(n));
  /* 제목에서 뗀 괄호 대상 — 카드에 대상 줄이 없어(2026-11-15) 여기가 그 글자가 남는 유일한 자리다. 자격 줄이 이미 같은 말을 하면 한 번만 */
  const titleWho = parts.who.filter((w) => !(n.eligibilityLines || []).some((l) => String(l).replace(/\s/g, '').includes(w.replace(/\s/g, ''))));
  /* 원문 안내 — 위 '모집 안내'에 이미 나온 문장은 다시 적지 않는다(같은 접수기간이 두 칸에 떴다 · 2026-10-01) */
  const seenText = [...(n.excerpts || []).map((x) => noticeFlat(x.text)), ...(n.eligibilityLines || []).map(noticeFlat)].filter((x) => x.length >= 6);
  const notice = (n.noticeLines || []).filter((l) => !seenText.some((e) => noticeFlat(l).includes(e)));
  /* 긴 혜택 첫 줄(40자 넘음)은 카드의 「혜택:」 줄 앞에 붙여 한 줄로 — 「혜택」 두 줄이 되지 않게(합쳐 170자를 넘으면 두 줄 그대로 — 시트가 180자에서 자른다 · 최종 리뷰 2026-11-26) */
  const bi = benefit && benefit.length > 40 ? notice.findIndex((l) => /^혜택\s*[:：]/.test(l)) : -1;
  const merged = bi >= 0 ? `혜택: ${benefit} · ${notice[bi].replace(/^혜택\s*[:：]\s*/, '')}` : '';
  const one = !!merged && merged.length <= 174;
  return [
    ...(benefit && benefit.length > 40 ? [one ? merged : `혜택: ${benefit}`] : []),
    /* 제목에서 뗀 대상 괄호 — 「제목 대상」 이름표로 넘긴다(시트가 「대상」 으로 보인다 · 「대상」 그대로면 시트의 NS_SKIP 이 빼서 화면 어디에도 안 남았다 · 2026-11-26) */
    ...(titleWho.length ? [`제목 대상: ${titleWho.join(' · ')}`] : []),   // 제목에서 뗀 조각만 — 발췌 「대상」은 아래 rows 가 적는다(리뷰 2026-11-02)
    ...rows.map((x) => `${x.label}: ${unent(x.text)}`),
    ...(one ? notice.filter((_, i) => i !== bi) : notice),
  ];
}
function openActivityDetail(url) {
  if (typeof trackUse === 'function') trackUse('detail', url);   // 이용 횟수 — 주소는 보내지 않고 지문으로(usage-report.js)
  { const dsh = document.getElementById('detail-sheet'); if (dsh) dsh.dataset.useItem = url; }
  const n = activityItem(url);   // 피드에서 빠졌어도 저장해 둔 글이면 사본으로 연다
  if (!n) return;
  const { sch, result, fit, fd } = activityFit(n);
  const d = n.deadline ? dday(n.deadline) : null;
  const benefit = unent(activityBenefit(n));
  const parts = splitTitleWho(activityTitle(n));
  /* 「접수 · 기간」 — 발췌 모집기간(없으면 기간 토막 deadlineHint)을 그대로 넘긴다 · 날짜만 있는 글은 applySectionHtml 이 마감으로 말한다(리뷰 2026-11-02 · 9건이 「원문 확인」으로 떴다) */
  const recruit = ((n.excerpts || []).find((x) => x.label === '모집기간') || {}).text || (n.deadlineHint && !/window\.|dataLayer|function|\)\s*\)/.test(n.deadlineHint) ? hintText(n.deadlineHint) : '');
  if (recruit) sch.period = unent(recruit);
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
      ${sheetSectionsHtml({ sch, result, fit, fd, activity: n, noticeLines: activitySheetNotices(n) })}
      ${activityLinkHtml(n)}
    </div>`;
  openSheetShell();
  /* 빈칸을 찾은 신청서 PDF 에만 「양식 채우기」(장학 시트와 같은 formfill.js · 2026-10-31 공동개발자 "공모전 신청 양식이 매우 미흡") */
  if (n.id && typeof attachFormFillButtons === 'function') attachFormFillButtons(activityFillTarget(n), $('#detail-sheet'));
  eligAskWire(sch, () => openActivityDetail(url));   // 묻기 상자 배선 — 다시 그릴 때 이 시트로 돌아온다
}
