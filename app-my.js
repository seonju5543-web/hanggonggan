/* app-my.js — MY 화면(보관함·설정·자주 묻는 질문·고객센터·약관·휴지통) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
/* ---------------- 보관함 (MY) ----------------
   저장한 공고를 모아 보는 자리. 🔴 **금액 합계를 내지 않는다** — 합산은 더하기가 아니라
   고르기라(같은 장학금 한 번만 + 배타 그룹에서 최대 하나) 여기서 따로 더하면
   홈과 다른 숫자를 말하게 된다. 건수만 센다. */
/* 장학금 · 대외활동 나눠 보기 (2026-11-16 은서 「공고보관함에서 대외활동과 장학금이 구분되게」) — 칩 셋(전체·장학금·대외활동) ·
   한쪽만 담겼으면 칩을 안 그린다 · 고른 칩은 이 화면을 떠 있는 동안만(기기에 저장하지 않는다) · 위 숫자(sub)는 늘 전체 */
let savedKind = 'all';
const SAVED_KINDS = [['all', '전체'], ['sch', '장학금'], ['act', '대외활동']];
function renderSaved() {
  const el = $('#my-saved');
  if (!el) return;
  const all = savedScholarships();
  const nAct = all.filter((s) => isActivityId(s.id)).length;
  const counts = { all: all.length, act: nAct, sch: all.length - nAct };
  const both = counts.act > 0 && counts.sch > 0;
  if (!both) savedKind = 'all';
  const list = savedKind === 'all' ? all : all.filter((s) => (savedKind === 'act') === isActivityId(s.id));
  const kindRow = both ? `<div class="filter-row saved-kinds" role="group" aria-label="공고 종류">${SAVED_KINDS.map(([k, label]) =>
    `<button type="button" class="filter-chip${k === savedKind ? ' active' : ''}" data-saved-kind="${k}" aria-pressed="${k === savedKind}">${label} ${counts[k]}</button>`).join('')}</div>` : '';
  { const sub = $('#my-sub-saved'); if (sub) { const n = all.filter((s) => s.deadline && dday(s.deadline).days >= 0 && dday(s.deadline).days <= CAL_SOON_DAYS).length; sub.textContent = all.length ? `${all.length}개${n ? ` · 이번 주 마감 ${n}개` : ''}` : '비어 있음'; } }
  if (!list.length) {
    el.innerHTML = (`
      <p class="empty">저장한 공고가 없어요<br /><span class="empty-sub">공고에서 북마크를 누르면 여기 모여요</span></p><button class="btn btn-ghost btn-empty" data-go="explore">장학금 둘러보기</button>`);
    return;
  }
  const open = list.filter((s) => s.deadline && dday(s.deadline).days >= 0)
    .sort((a, b) => deadlineTs(a) - deadlineTs(b));
  const undated = list.filter((s) => !s.deadline);
  const closed = list.filter((s) => s.deadline && dday(s.deadline).days < 0)
    .sort((a, b) => deadlineTs(b) - deadlineTs(a));
  const soon = open.filter((s) => dday(s.deadline).days <= CAL_SOON_DAYS).length;

  el.innerHTML = (`${kindRow}
    ${open.length ? `<h5 class="cal-sec">마감 순</h5>${open.map((s) => calRowHtml(s, { save: true })).join('')}` : ''}
    ${/* 🔴 날짜를 못 읽은 공고를 **숨기지 않는다** — 달력에는 찍을 수 없어 사라지는데,
         사라지면 학생은 그 공고가 없는 줄 안다. 여기가 그 자리다. */ ''}
    ${/* 🔴 '날짜를 아직 읽지 못한' → '기한은 원문에서 확인' (2026-09-17 개발자 지시).
         앞은 우리가 못 한 일이고 뒤는 학생이 할 일이다. 건수는 관리자 '마감일 없음'이 센다. */ ''}
    ${/* 이름 '마감일 확인 필요' → '날짜 없는 저장 공고' (2026-11-15 · 개발자 결정 11-02) — 달력에 못 찍는 저장 공고라는 사실만 말한다 */ ''}
    ${undated.length ? `<h5 class="cal-sec">날짜 없는 저장 공고 ${undated.length}개</h5>
      ${undated.map((s) => calRowHtml(s, { save: true })).join('')}` : ''}
    ${closed.length ? `<details class="cal-kosaf">
        <summary>이미 마감된 저장 공고 ${closed.length}건</summary>
        ${closed.map((s) => calRowHtml(s, { badge: false, save: true })).join('')}
      </details>` : ''}`);
}

/* 신청 기록 ↔ 공고 잇기 — **기록을 버리지 않는다** (2026-09-20 개발자 지시로 신설).
   ⚠️ 2026-10-02 개발자 지시로 **화면은** 바뀌었다 — 내려간 공고의 줄은 이제 안 보인다(아래 shownAppRows).
      이 함수는 그대로 '모든 기록을 잇는' 일을 하고, 기록 자체는 여전히 지우지 않는다. 아래는 그 전 경위다.

   🔴 예전엔 `.filter((a) => findSch(a.id))` 였다. 공고를 못 찾으면 그 신청 기록을 화면에서
      통째로 빼고 **아무 말도 하지 않았다.** 실측: 저장 3건 → 화면 1장, 선정으로 기록해 둔
      건까지 흔적 없이 사라지고 요약 카드도 '준비 완료 1건'으로 바뀌었다.
   못 찾는 일은 드물지 않다 — 두 갈래로 실제로 일어난다:
     ① 학생이 MY 에서 **학교를 바꾸면** 그 학교 한정 공고(schoolOnly)가 목록에서 빠진다.
     ② **층2(한국장학재단) 공고는 마감 다음 날 데이터에서 내려간다**
        (`collector/kosaf-open.mjs` — `i.due >= today`). 하필 제출·발표를 기록할 시점이다.
   기록 자체는 기기에 남아 있으므로 잃은 것은 아니지만, 학생은 보지도 지우지도 못했다.

   같은 것을 이 저장소는 이미 두 번 정했다 — 저장 해제(`toggleSave`, 2026-09-07 코드 리뷰)와
   휴지통 줄(`renderTrash` 의 '(목록에서 내려간 공고)')이다. **줄은 남기고 사정을 그대로
   적는다**가 그 규칙이고, 여기서도 같이 간다.

   🔴 이름을 지어내지 않는다 — 신청할 때 적어 둔 `name`(그때 공고에서 읽은 글자)만 쓰고,
      그것조차 없는 옛 기록은 '(목록에서 내려간 공고)'라고 말한다(원칙 8-1).
   순수 함수라 브라우저 없이 검사가 그대로 부른다(test-collector '신청 기록을 버리지 않는다'). */
function appRows(applications, resolve) {
  return (applications || []).slice().reverse()
    .map((a) => ({ app: a, sch: resolve(a.id) || null }));
}

/* 🔴 **목록에서 내려간 공고는 신청 내역에 보이지 않는다** (2026-10-02 개발자 지시 — 2026-09-20 결정을 바꿈:
   *"내려간 공고는 그냥 없어졌으면 좋겠는데 막 목록에서 내려감 이러네"*).
   그때는 '줄을 남기고 사정을 적는다'였다(선정 기록까지 말없이 사라지던 사고). 지금 규칙:
     · **화면에서만 뺀다 — 기기 안 기록(state.applications)은 지우지 않는다.** 공고가 다시 올라오면
       (학교를 되돌렸거나 재단 공고가 다시 열리면) 적어 둔 제출·선정 기록과 함께 그대로 돌아온다.
     · 목록·요약 카드·홈 '신청내역' 칸 숫자·전체 선택이 **이 함수 하나**를 쓴다 — 갈라 쓰면 숫자가 서로 다른 말을 한다.
   순수 함수라 검사가 그대로 돌린다(test-collector '신청 내역 — 내려간 공고는 보이지 않는다'). */
function shownAppRows(applications, resolve) {
  /* 🔴 **결과를 적을 때까지는 남긴다** (2026-10-02 개발자 결정: *"일단 결과를 적을 때까지는 남겨두자"*).
     정식 등록은 마감+30일, 층2는 마감 뒤 데이터에서 빠진다 — 발표가 늦으면 선정 결과를 적기 전에 줄이 사라졌다.
     그래서 공고가 있을 때 떠 둔 사본(app.snap · snapApplications)으로 그린다. 선정·미선정을 적으면 그때 빠진다. */
  return appRows(applications, resolve)
    .map((r) => (r.sch || r.app.result || !r.app.snap ? r : { ...r, sch: r.app.snap }))
    .filter((r) => r.sch);
}
/* 신청 기록이 가리키는 공고 — 데이터에 있으면 그것, 없고 결과를 아직 안 적었으면 떠 둔 사본(위와 같은 규칙).
   신청 내역 패널의 제출·결과 단추와 상세 시트가 이것으로 찾는다(findSch 만 쓰면 사본이 있는 줄을 눌러도 아무것도 안 열린다) */
function appSch(id) {
  const live = findSch(id);
  if (live) return live;
  const a = state.applications.find((x) => x.id === id);
  return a && !a.result && a.snap ? a.snap : null;
}
/* 홈 「신청내역」 칸의 숫자 — 신청 내역 화면과 같은 수. 공고 목록을 받기 전엔 담은 수 그대로(받고 나서 줄어드는 것은 '내려감'이 확정된 뒤다).
   홈은 앱을 켜면 먼저 그려지므로 사본도 여기서 한 번 뜬다(신청 내역을 안 열어 본 학생도 사본이 남는다) */
function shownAppCount() {
  if (appsDataState() !== 'ok') return state.applications.length;
  const r = schResolver();
  if (snapApplications(r)) saveState({ local: true });   // 캐시 — 시각을 안 찍고 서버로 안 올린다
  return shownAppRows(state.applications, r).length;
}
/* 공고가 데이터에 있는 동안 사본을 떠 둔다 — 바뀌었을 때만 적는다(매번 저장하지 않게). 공고 목록을 다 받았을 때만 돈다 */
function snapApplications(resolve) {
  if (appsDataState() !== 'ok') return false;
  let changed = false;
  for (const a of state.applications) {
    const s = resolve(a.id);
    if (!s) continue;
    const json = JSON.stringify(s);
    if (a.snap && JSON.stringify(a.snap) === json) continue;
    a.snap = JSON.parse(json);
    changed = true;
  }
  return changed;
}
/* 공고 찾기를 **한 번에** — findSch 는 부를 때마다 목록 전체(층2 파싱 포함)를 다시 만든다. 신청이 n건이면 n번이라 지도로 한 번만 만든다 */
function schResolver() {
  const byId = new Map(allScholarships().map((s) => [s.id, s]));
  return (id) => byId.get(id) || null;
}
/* 두 목록을 다 받았는가 — 하나라도 '받는 중'이면 아직 '내려갔다'고 말하지 않는다 */
const appsDataState = () => (Object.values(appsData).includes('wait') ? 'wait' : Object.values(appsData).includes('fail') ? 'fail' : 'ok');

/* 차례 — **지금 할 일이 있는 것부터** (2026-09-20 개발자 지적).

   🔴 예전엔 담은 순서를 뒤집기만 했다(`.slice().reverse()`). 그래서 실측으로 위 세 장이
      전부 마감·선정·미선정(끝난 일)이고, '서류 작성 필요'와 마감 전 공고가 맨 아래로
      밀려 있었다 — 학생이 스크롤을 끝까지 내려야 할 일을 만난다.

   세 묶음으로만 가른다(더 잘게 나누면 왜 이 차례인지 학생이 못 읽는다):
     0 할 일 남음   — 서류를 쓰던 중이거나 아직 제출을 기록하지 않았다
     1 기다리는 중  — 제출을 기록했고 결과를 기다린다
     2 끝남         — 선정·미선정을 기록했다
   묶음 안에서는 **마감 전이 먼저**(임박한 것부터), 마감이 지난 것은 뒤로 돌리되
   최근에 마감된 것부터 둔다. 마감을 모르는 것은 맨 뒤다.

   🔴 **거르지 않는다 — 차례만 바꾼다.** (내려간 공고를 빼는 일은 앞 단계 shownAppRows 몫이다 · 2026-10-02) 줄 수는 그대로여야 한다(바로 위 `appRows` 머리말과
      '신청 내역은 마감으로 거르지 않는다' 관문이 지키는 것이 그것이다).
   🔴 `dday()` 를 쓰지 않는다 — 그 함수는 마감을 모르는 공고에 '남은 날 14일'이라는 가짜
      값을 준다(CLAUDE.md). 여기서는 날짜 글자를 그대로 견준다.
   순수 함수라 가짜 날짜로 검사가 그대로 돌려 본다. */
function appOrder(rows, today) {
  const t = today || todayStart().toISOString().slice(0, 10);
  const stage = (a) => (a.result ? 2 : a.submittedAt ? 1 : 0);
  const key = (r) => {
    const dl = (r.sch && r.sch.deadline) || '';
    const closed = dl ? dl < t : false;
    return { stage: stage(r.app), unknown: dl ? 0 : 1, closed: closed ? 1 : 0, dl };
  };
  return rows.slice().sort((x, y) => {
    const a = key(x), b = key(y);
    if (a.stage !== b.stage) return a.stage - b.stage;
    if (a.unknown !== b.unknown) return a.unknown - b.unknown;   // 마감을 모르면 뒤로
    if (a.closed !== b.closed) return a.closed - b.closed;       // 마감 지난 것은 뒤로
    if (a.dl === b.dl) return 0;                                 // 같으면 담은 차례 유지
    /* 마감 전은 임박한 것부터, 마감 뒤는 최근 마감부터 */
    return a.closed ? (a.dl < b.dl ? 1 : -1) : (a.dl < b.dl ? -1 : 1);
  });
}

function renderApplications() {
  /* 잇고 → 내려간 공고는 화면에서 뺀다(기록은 그대로 · shownAppRows) → 차례를 정한다. 셋 다 순수 함수라 검사가 직접 돌린다. */
  /* 🔴 공고 목록을 아직 못 받았으면 '내려간 공고'를 가르지 않는다 — 가르면 모든 신청이 사라져 「아직 준비한 장학금이 없어요」가 뜬다(2026-10-02 리뷰) */
  const dataState = appsDataState();
  if (dataState !== 'ok' && state.applications.length) {
    $('#apps-summary').innerHTML = '';
    $('#apps-list').innerHTML = dataState === 'wait'
      ? (typeof skeletonRows === 'function' ? skeletonRows(3) : '')
      : '<p class="empty">공고 목록을 받아오지 못했어요<br /><span class="empty-sub">연결되면 신청 내역이 다시 보여요 · 기록은 그대로 있어요</span></p>';
    $('#apps-select-toggle').hidden = true;
    return;
  }
  const resolve = schResolver();
  if (snapApplications(resolve)) saveState({ local: true });   // 캐시 — 시각을 안 찍고 서버로 안 올린다
  const rows = appOrder(shownAppRows(state.applications, resolve));
  /* 공고를 아직 찾을 수 있는 동안 이름을 적어 둔다 — 나중에 목록에서 내려가도 학생이
     무엇이었는지 알아볼 수 있다. 옛 기록을 살리는 길이 이것 하나뿐이라 여기서 한다
     (loadState 는 registered.json 이 오기 전에 돌아 아직 아무것도 못 찾는다). */
  let learned = false;
  for (const r of rows) {
    if (r.sch && r.sch.name && r.app.name !== r.sch.name) { r.app.name = r.sch.name; learned = true; }
  }
  if (learned) saveState();
  const apps = rows.map((r) => r.app);
  const pending = apps.filter((a) => a.pending);
  /* 준비 중(체크리스트 남음)은 '준비 완료'로 세지 않는다 (2026-10-13 ③) — 제출·결과를 적은 건은 체크리스트와 상관없이 다음 단계다 */
  const inPrep = rows.filter((r) => !r.app.pending && /^준비 중/.test(prepStateLabel(r.app, r.sch, ''))).map((r) => r.app);
  const prepared = apps.filter((a) => !a.pending && !inPrep.includes(a));
  const submitted = prepared.filter((a) => a.submittedAt && !a.result);
  const wonApps = prepared.filter((a) => a.result === 'won');
  /* 🔴 금액을 못 읽은 공고는 **금액을 모른다** — 0 으로 두고 그 건수를 따로 센다(내려간 공고는 2026-10-02 부터 여기 오지 않는다).
     예전엔 `findSch(a.id).amountValue` 라 못 찾는 순간 여기서 죽었다(그래서 위 filter 가
     있었던 것이기도 하다). 모르는 금액을 지어내 더하지 않는 것은 홈 히어로·일괄 준비와
     같은 규칙이고, 말하는 법도 그쪽과 같다 — '금액 미확인 n건 제외'. */
  const amountOf = (a) => { const s = resolve(a.id); return (s && s.amountValue) || 0; };
  const totalExpected = apps.reduce((sum, a) => sum + amountOf(a), 0);
  const wonAmount = wonApps.reduce((sum, a) => sum + amountOf(a), 0);
  const counted = wonApps.length ? wonApps : apps;
  const unknownAmount = counted.filter((a) => !amountOf(a)).length;
  /* 🔴 **합이 0 이면 '0원'이라고 쓰지 않는다** — 그건 '한 푼도 못 받는다'로 읽힌다.
     금액을 못 읽은 공고가 많아서(실측 68건 중 41건) 그중 하나를 선정으로 기록하면
     화면이 '선정된 장학금 0원'이라고 말하고 있었다. 모르는 것은 모른다고 적는다
     (원칙 8-1). 이건 목록에서 내려간 기록을 살리기 전부터 있던 것이다. */
  const shownAmount = wonApps.length ? wonAmount : totalExpected;

  $('#apps-summary').innerHTML = apps.length
    ? `<div class="summary-card">
         ${/* 🔴 금액의 이름표를 **건수 줄에서 떼어냈다** (2026-09-20 개발자 지적).
              예전엔 `… · 서류 작성 필요 1건 · 선정된 장학금` 처럼 한 줄에 가운뎃점으로
              붙어 있어, 아래 금액의 이름표가 **네 번째 건수처럼** 읽혔다. */ ''}
         <p>준비 완료 ${prepared.length}건${inPrep.length ? ` · 준비 중 ${inPrep.length}건` : ''}${submitted.length ? ` · 제출·심사 중 ${submitted.length}건` : ''}${wonApps.length ? ` · 선정 ${wonApps.length}건` : ''}${pending.length ? ` · 서류 작성 필요 ${pending.length}건` : ''}</p>
         ${/* 합이 0 이면 금액 두 줄을 안 그린다(2026-11-15 · 예전 「금액 미확인」 — '0원'도 쓰지 않는다: 한 푼도 못 받는다로 읽힌다) */ ''}
         ${shownAmount ? `<p class="summary-label">${wonApps.length ? '선정된 장학금' : '예상 최대 수혜액'}</p>
         <p class="summary-amount">${won(shownAmount)}</p>` : ''}
         <p class="summary-note">제출·발표는 각 공식 채널에서 · 결과는 여기에 기록${
           shownAmount && unknownAmount ? ` · 금액을 못 읽은 ${unknownAmount}건 제외` : ''}</p>
       </div>`
    : '';

  /* 지워진 항목이 선택 목록에 남지 않게 — 남으면 '삭제 3건'인데 2건만 지워진다 */
  for (const id of [...appsSelected]) if (!apps.some((a) => a.id === id)) appsSelected.delete(id);

  const list = $('#apps-list');
  list.classList.toggle('selecting', appsSelectMode);
  list.innerHTML = apps.length
    ? rows.map((r) => appCard(r.app, r.sch)).join('')
    : '<p class="empty">아직 준비한 장학금이 없어요<br /><span class="empty-sub">공고를 고르면 서류 준비가 여기에 쌓여요</span></p><button class="btn btn-ghost btn-empty" data-go="explore">장학금 둘러보기</button>';

  /* 항목이 없으면 관리 장치를 통째로 숨긴다 — 빈 화면에 쓸 수 없는 버튼을 두지 않는다 */
  $('#apps-select-toggle').hidden = !apps.length;
  /* 🔴 손짓 안내는 **처음 3번만** 띄운다 (2026-08-30 개발자 지시).
     늘 떠 있으면 안내가 아니라 배경이 된다 — 읽어야 할 때는 이미 안 읽힌다.
     세는 단위는 '앱을 켠 횟수'다. renderApplications() 는 삭제·되돌리기 때마다 다시 도는데
     그때마다 세면 한 번 방문에 3회를 다 써 버린다(`_counted`가 그걸 막는다).
     장부에 넣지 않고 localStorage 를 따로 쓰는 이유: 이건 이 기기의 화면 상태일 뿐이라
     서버로 동기화될 프로필·신청내역에 섞이면 안 된다. */
  $('#apps-select-toggle').textContent = appsSelectMode ? '완료' : '선택';
  $('#apps-bulkbar').hidden = !(appsSelectMode && apps.length);
  const all = $('#apps-check-all');
  if (all) all.checked = apps.length > 0 && appsSelected.size === apps.length;
  const del = $('#apps-delete-selected');
  if (del) {
    del.disabled = appsSelected.size === 0;
    del.textContent = appsSelected.size ? `삭제 ${appsSelected.size}건` : '삭제';
  }

  /* 목록 ↔ 달력 (2026-09-07 · 노션 UI-21).
     🔴 새 탭을 만들지 않는다 — 하단바가 이미 꽉 찼고(2026-09-25 대외활동 탭으로 5칸), 달력은 결국 '내 것'의 다른
        보기다. 달력일 때는 목록 관리 장치(선택·삭제)를 감춘다: 달력에는 지울 줄이 없다. */
  const cal = $('#apps-calendar');
  const tog = $('#apps-view-toggle');
  if (cal) cal.hidden = !calMode;
  list.hidden = calMode;
  /* 🔴 달력에서는 **수혜액 카드를 숨긴다** (2026-09-07 개발자 지시).
     달력은 '언제'를 보는 화면이라 금액이 화면 위쪽을 차지하면 정작 달을 못 본다.
     ⚠️ 지우는 게 아니라 숨기는 것이다 — 목록 보기에서는 그대로 나온다. */
  $('#apps-summary').hidden = calMode;
  if (tog) {
    tog.textContent = calMode ? '목록 보기' : '달력 보기';
    tog.setAttribute('aria-pressed', String(calMode));
  }
  $('#apps-select-toggle').hidden = !apps.length || calMode;
  if (calMode) {
    $('#apps-bulkbar').hidden = true;
    renderCalendar();
  }
}

/* 신청 내역 관리 배선 — 화면이 처음 만들어질 때 한 번만 건다 */
function wireAppsManage() {
  const list = $('#apps-list');

  /* 목록 ↔ 달력 (2026-09-07 · 노션 UI-21) */
  const tog = $('#apps-view-toggle');
  if (tog) tog.addEventListener('click', () => {
    calMode = !calMode;
    if (!calMode) calPicked = null;
    /* 달력을 열 때는 늘 이번 달부터 — 지난달을 보다 나갔다 돌아왔는데 그대로면
       "내 공고가 하나도 없다"로 보인다 */
    if (calMode) calCursor = null;
    renderApplications();
  });

  $('#apps-select-toggle').addEventListener('click', () => {
    appsSelectMode = !appsSelectMode;
    appsSelected.clear();
    renderApplications();
  });

  $('#apps-check-all').addEventListener('change', (e) => {
    /* 화면에 있는 줄만 고른다 — 내려간 공고는 보이지 않으므로 '전체 선택'이 보이지 않는 기록까지 지우면 안 된다(2026-10-02) */
    const ids = shownAppRows(state.applications, schResolver()).map((r) => r.app.id);
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
    <p class="my-learned-head">신청서에서 가져온 정보 <span>${rows.length}개</span></p>
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
  toast('삭제 완료 · 다음 신청서에서 다시 질문');
}

function renderMy() {
  /* 판 번호는 APP_VERSION 한 곳에서 온다 — 프로필이 없어 일찍 돌아가더라도 적어 둔다 */
  const ver = $('#my-version');
  /* 🔴 "· 전국 대학 지원" 이라고 적혀 있었다 (2026-09-13 수정). 학교는 전국에서 고를 수
     있지만 **교내 공고가 있는 학교는 두 곳뿐**이라, 그 말은 학생이 확인할 수 없는 약속이다.
     지금은 **데이터가 세어 말한다** — 숫자를 손으로 적지 않으므로 학교가 늘면 저절로 맞는다.
     ⚠️ 층2(한국장학재단)는 전국 재단이라 학교와 무관하다 — 그래서 따로 센다. */
  if (ver) {
    const inSchools = new Set(registeredList
      .map((s) => s.eligibility && s.eligibility.schoolOnly).filter(Boolean));
    const kosafN = kosafList.length;
    const parts = [`한대장 ${APP_VERSION}`];
    if (inSchools.size) parts.push(`교내 공고 ${inSchools.size}개교`);
    if (kosafN) parts.push(`한국장학재단 ${kosafN}곳`);
    ver.textContent = parts.join(' · ');
  }

  /* 계정(로그인) 절 — 프로필이 없어도 그린다(새 기기에서 로그인해 프로필을 받아 오는 길 · 2026-10-10 MY 로 옮김) */
  renderAccountCard();
  const p = state.profile;
  if (!p) return;   // 온보딩을 아직 안 마친 상태 — 그릴 프로필이 없다
  const c = p.common || {};
  /* ⚠️ 이름표가 없으면 **열쇠라도 보여 준다** — match-engine 과 같은 방식이다.
     빈칸을 내놓으면 학생이 고른 것이 화면에서 사라져 '해당 없음'처럼 읽힌다(2026-09-03~09 실제로 그랬다). */
  const trackLabel = (TRACKS.find((t) => t.id === p.track) || {}).label || '-';
  const commonFilled = ['studentId', 'birth', 'phone', 'email', 'account'].filter((k) => c[k]).length;
  /* 🔴 **누를 수 있는 것은 이 버튼 하나다** (2026-09-12 개발자 지시). 전에는 카드 전체가
     '프로필 수정' 버튼이라 표 아무 데나 눌러도 수정 화면으로 넘어갔다 — 학생이 제 성적을
     확인하려고 표를 짚기만 해도 화면이 바뀌었다. span 이 아니라 button 이라야 키보드
     Tab 으로 닿고 보조기기가 읽는다. 배선은 `#my-profile` 에 위임해 뒀다(다시 그려도 산다). */
  const nameLine = `<p class="my-name">${esc(p.name || '대학생')} 님`
    + `<button type="button" class="my-edit-hint">학적정보 수정 ›</button></p>`;
  $('#my-profile').innerHTML = `
    ${photoHeadHtml(p, nameLine)}
    ${/* 🔴 학과 칸은 **학생이 직접 치는 자유 입력**이다 — esc 를 빠뜨리면 `B<b>학과` 같은 글자에
         MY 화면 아래쪽이 통째로 그 태그 안으로 빨려 들어간다(브라우저 실측). 2026-09-10. */ ''}
    <p class="my-line">${esc(p.school || '대학 미설정')} · ${esc(trackLabel)}${p.major ? ' · ' + esc(p.major) : ''}</p>
    <div class="my-grid">
      <div><span>학년</span><strong>${p.year}학년 (${esc(p.status || '미설정')})</strong></div>
      <div><span>직전학기 평점</span><strong>${p.gpa != null ? p.gpa.toFixed(2) : '미입력'}</strong></div>
      <div><span>지원구간</span><strong>${p.bracket != null ? p.bracket + '구간' : '미입력'}</strong></div>
      <div><span>공통 서류정보</span><strong>${commonFilled}/5 입력됨</strong></div>
    </div>
    ${/* 🔴 줄 셋을 뺐다 (2026-09-12 개발자 지시) — '특별자격: 해당 없음' · 공통 서류정보
         안내 · 프로필 사진 안내. 대부분의 학생에게 '해당 없음' 한 줄이고, 나머지 둘은
         온보딩에서 이미 같은 말을 했다(index.html '모두 선택 사항이며 이 기기에만
         저장됩니다'). ⚠️ 저장 위치 고지 자체가 사라진 것은 아니다 — 온보딩 그 줄과
         약관 「③ 서버로 보내지 않는 정보」가 원본이다. */ ''}
    ${learnedHtml(c)}`;
  bindPhotoButtons();
  renderMyMenu(p, trackLabel);
  /* 🔴 알림은 여기서 그리지 않는다 — 설정 화면(renderSettings). 계정은 2026-10-10 에 MY 로 되돌렸다(위 renderAccountCard). */
  renderWallet();
  renderSaved();
}

/* MY 첫 화면 — 머리줄 + 메뉴 줄의 작은 글씨 (2026-10-10 C안 구조).
   🔴 숫자·말을 새로 만들지 않는다 — 프로필·서류함·보관함·알림 장부에 있는 것을 줄여 적을 뿐이다.
   서류함·보관함 줄은 각자 그리는 함수(renderWallet·renderSaved)가 고친다(서류 캐시가 늦게 와도 맞게). */
function renderMyMenu(p, trackLabel) {
  const head = $('#my-head');
  if (head) {
    const img = profilePhoto && profilePhoto.url ? `<img src="${esc(profilePhoto.url)}" alt="" />` : esc((p.name || '학').charAt(0));
    const line = [p.school || '대학 미설정', p.major || trackLabel, p.year ? `${p.year}학년` : ''].filter(Boolean).map(esc).join(' · ');
    head.innerHTML = `<span class="me-av" aria-hidden="true">${img}</span><span class="me-who"><b>${esc(p.name || '대학생')} 님</b><small>${line}</small></span>`;
  }
  const info = $('#my-sub-info');
  /* 🔴 작은 글씨는 **상태·숫자만** (2026-10-10 은서 「멘트들이 너무 AI 같애」) — 설명을 덧붙이지 않는다 */
  if (info) info.textContent = [p.gpa != null ? p.gpa.toFixed(2) : '평점 없음', p.bracket != null ? `${p.bracket}구간` : '', p.status || ''].filter(Boolean).join(' · ');
  const set = $('#my-sub-settings');
  if (set) {
    const on = typeof notifyLedger !== 'undefined' && notifyLedger && notifyLedger.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted';
    set.textContent = `알림 ${on ? '켜짐' : '꺼짐'}`;
  }
}

/* ---------------- 설정 화면 (2026-09-11 · 개발자 목업 승인) ---------------- */
function renderSettings() {
  /* 계정 절은 MY 로 옮겼다(2026-10-10 · renderMy 가 그린다) — 여기서는 알림만 */
  renderNotifyCard();
  const t = $('#btn-open-trash');
  if (t && !t.dataset.wired) { t.dataset.wired = '1'; t.addEventListener('click', () => showScreen('trash')); }
  const w = $('#btn-withdraw');
  if (w && !w.dataset.wired) { w.dataset.wired = '1'; w.addEventListener('click', withdrawAccount); }
  const tm = $('#btn-open-terms');
  if (tm && !tm.dataset.wired) { tm.dataset.wired = '1'; tm.addEventListener('click', () => showScreen('terms')); }
  for (const [id, screen] of [['#btn-open-logins', 'logins'], ['#btn-open-support', 'support'], ['#btn-open-faq', 'faq'], ['#btn-open-perms', 'perms']]) {
    const b = $(id);
    if (b && !b.dataset.wired) { b.dataset.wired = '1'; b.addEventListener('click', () => showScreen(screen)); }
  }
}

/* ---------------- 로그인 활동 (2026-09-11 개발자 지시 1번) ----------------
   "내 계정에 언제 어디서 로그인됐나". 낯선 기기가 보이면 비밀번호를 바꾸라고 알려 준다.
   🔴 '없다'와 '못 읽었다'를 가른다 — 못 읽은 것을 '없다'로 보여 주면 낯선 기기를 놓친다.
   🔴 **IP 는 적지 않는다.** 브라우저는 제 IP 를 모르고(서버만 안다) Supabase 에 바로 쓰는
      지금 구조에는 받아 적을 자리가 없다. 지어내느니 줄을 비운다(원칙 8-1).
   🔴 '현재 기기' 배지는 **기기 이름이 아니라 설치본 식별자**로 붙인다 — 이름으로 견주면
      같은 기종을 쓰는 남의 로그인에 배지가 붙어, 찾으라고 만든 화면이 안심시킨다. */
function loginWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '시각 확인 불가';
  const ap = d.getHours() < 12 ? '오전' : '오후';
  const h12 = d.getHours() % 12 || 12;
  const two = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ap} ${h12}:${two(d.getMinutes())}`;
}

async function renderLogins() {
  const el = $('#logins-body');
  if (!el) return;
  if (typeof authUser !== 'function' || !authUser()) {
    el.innerHTML = `<div class="my-card trash-empty">
        <p class="trash-empty-title">로그인한 계정이 없어요</p>
        <p class="legal-loading">로그인하면 이 계정에 언제 어느 기기로 접속했는지 여기에 쌓여요.</p>
      </div>`;
    return;
  }
  el.innerHTML = '<p class="legal-loading">불러오는 중이에요…</p>';
  const r = await authLoginEvents(20);
  if (!r.ok) {
    /* 🔴 못 읽은 것을 '없다'로 말하지 않는다 */
    el.innerHTML = `<div class="my-card trash-empty">
        <p class="trash-empty-title">기록을 불러오지 못했어요</p>
        <p class="legal-loading">인터넷이 끊겼거나 서버 준비가 아직 안 됐어요. 잠시 뒤 다시 열어 주세요.</p>
      </div>`;
    return;
  }
  if (!r.items.length) {
    el.innerHTML = `<div class="my-card trash-empty">
        <p class="trash-empty-title">아직 기록이 없어요</p>
        <p class="legal-loading">다음 로그인부터 여기에 쌓여요.</p>
      </div>`;
    return;
  }
  const me = typeof clientId === 'function' ? clientId() : '';
  el.innerHTML = r.items.map((it) => `
    <div class="login-card">
      ${it.client && me && it.client === me ? '<span class="login-now">현재 기기</span>' : ''}
      <p class="login-device">${esc(it.device || '알 수 없는 기기')}</p>
      <p class="login-meta">로그인 | ${esc(loginWhen(it.at))}</p>
    </div>`).join('');
}

/* ---------------- 자주 묻는 질문 (2026-09-11 개발자 지시 2번 · 2026-09-13 고도화) ----------------
   🔴 **앱이 실제로 하는 일만** 적는다. '곧 됩니다'나 확인 안 한 것을 적으면 그게 가장
      눈에 잘 띄는 거짓말이 된다(운영 원칙 1·8-1). 답은 전부 지금 동작 기준이고,
      기능이 바뀌면 이 목록도 같이 고쳐야 한다.
   🔴 여기 적은 사실은 **코드에서 하나씩 확인한 것**이다 — 알림 5종은 `notify-rules.js`,
      진척도 4단계는 `APP_STEPS`, 저장 목록이 기기 안에만 남는 것은 `supabase-client.js`
      가 그 값을 안 보낸다는 것으로 확인했다. 새 항목을 더할 때도 같은 방식으로 확인한다.

   칸은 셋이다 — [갈래, 질문, 답].
   🔴 **갈래를 지어내지 않는다** — 칩 줄은 이 목록에 실제로 있는 갈래만 나온다(`faqCats`).
      목록에 없는 갈래를 칩에 박아 두면 눌러도 0건인 칩이 생긴다.
   🔴 `FAQ_TOP` 은 고객센터의 '자주 찾는 질문 TOP 5'가 쓰는 **같은 원본**이다. 두 화면이
      제각기 목록을 들고 있으면 한쪽만 고쳐져 갈라진다(이 저장소가 반복해 겪은 사고다). */
const FAQ_ITEMS = [
  ['신청', '이 앱에서 신청까지 끝나나요?',
    '아니요. 한대장은 <strong>신청 준비까지</strong> 도와줍니다. 최종 신청·접수는 한국장학재단, 각 대학, 각 재단 같은 공식 접수처에서 직접 하셔야 해요. 그래서 앱은 "신청 완료"라고 쓰지 않고 "신청 준비 완료"라고 적습니다.'],
  ['신청', '신청 준비를 끝내면 그다음은 어떻게 되나요?',
    '신청내역에 <strong>신청 준비 완료 → 공식 제출 → 심사 → 선정 발표</strong> 네 단계로 남습니다. 앱은 학교·재단 전산을 볼 수 없어서 <strong>제출과 결과는 학생이 직접 기록</strong>합니다("제출했어요", "선정·미선정" 버튼). 심사 단계만 제출 기록과 마감 경과로 앱이 표시해요.'],
  ['신청', '대장님(도우미)은 무엇을 답해 주나요?',
    '앱이 <strong>이미 알고 있는 것</strong>만 답합니다 — 등록된 공고, 필요한 서류, 내 신청 현황, 공고 원문에서 뽑아 둔 문장이에요. 모르는 것은 지어내지 않고 "못 찾았다"고 말합니다. 그게 이 도우미를 만든 이유예요.'],

  ['공고·매칭', '우리 학교 공고가 안 보여요.',
    '지금 공고 원문을 모으고 있는 학교가 정해져 있어요. 그 밖의 학교라도 <strong>전국 대상 공고</strong>와 <strong>한국장학재단이 아는 재단 장학금</strong>은 그대로 보입니다.'],
  ['공고·매칭', '자격 요건이 안 적힌 공고가 있어요.',
    '그 공고에서는 자격 요건을 <strong>공고 원문에서 직접 확인</strong>해 주세요. 앱이 짐작해서 채우지 않습니다 — 틀린 자격 판정은 모른다고 말하는 것보다 나쁘기 때문이에요.'],
  ['공고·매칭', '금액이 안 보이는 공고가 있어요.',
    '공고 원문에 금액이 적혀 있지 않거나 첨부파일에만 있는 경우입니다. 그 공고의 카드에는 지어낸 숫자를 적지 않고 <strong>금액 줄을 비워</strong> 둡니다. 다만 홈의 합계는 이런 공고를 빼 버리면 실제보다 작아지므로, <strong>금액을 확인한 공고들의 중앙값</strong>으로 어림잡아 더하고 숫자 앞에 "약"을 붙입니다. 자세한 내역은 홈의 금액을 눌러 <strong>금액 상세</strong>에서 볼 수 있어요.'],
  ['공고·매칭', '저장(북마크)한 공고는 어디에 남나요?',
    '<strong>이 기기에만</strong> 남습니다. 로그인해도 저장 목록은 서버로 올라가지 않아서, 기기를 바꾸면 다시 저장하셔야 해요.'],
  ['공고·매칭', '달력에 왜 몇 개만 표시되나요?',
    '상시로 찍는 것은 <strong>신청하거나 저장한 공고</strong>의 마감일(파랑)과 발표일(빨강)뿐입니다. 전부 찍으면 하루에 스무 건이 넘는 날이 있어 달력이 읽히지 않아요. 나머지는 <strong>날짜를 누르면</strong> 그날 것만 펼쳐집니다.'],

  ['알림', '알림이 안 와요.',
    '설정 → 알림에서 켜 주세요. <strong>아이폰은 홈 화면에 앱을 추가해야만</strong> 알림이 옵니다(사파리 탭에서는 안 옵니다). 폰에서 알림을 차단해 두었다면 설정 → 앱 권한에 바꾸는 방법이 적혀 있어요.'],
  ['알림', '어떤 알림이 오나요?',
    '다섯 가지입니다 — <strong>내 조건에 맞는 새 공고</strong>, <strong>마감 하루 전·당일</strong>, <strong>제출 기록을 안 한 공고</strong>, <strong>우리 학교 게시판 새 공고</strong>, <strong>마감 지난 공고의 결과 기록</strong>. 설정 → 알림에서 항목마다 따로 끄고 켤 수 있어요.'],

  ['계정·기기', '내 정보는 어디에 저장되나요?',
    '기본은 <strong>이 기기 안</strong>입니다. 로그인하면 기기를 바꿔도 이어 쓸 수 있도록 프로필과 신청내역이 서버에 저장되고, 낯선 기기를 알아차릴 수 있게 <strong>로그인한 시각과 기기 종류</strong>도 함께 남습니다(설정 → 로그인 활동에서 볼 수 있어요).'],
  ['계정·기기', '기기를 바꾸면 이어서 쓸 수 있나요?',
    '로그인하면 새 기기에서 프로필과 신청내역을 받아옵니다. 로그인하지 않으면 정보가 그 기기에만 남습니다.'],
  ['계정·기기', '로그인하지 않아도 쓸 수 있나요?',
    '네. 공고 검색·추천·알림·서류 보관함까지 <strong>로그인 없이 그대로</strong> 됩니다. 로그인은 기기를 바꿀 때 이어 쓰기 위한 것이에요.'],

  ['개인정보', '주민등록번호·계좌번호·증명서류도 서버에 올라가나요?',
    '아니요. 이 셋은 <strong>서버로 보내지 않습니다</strong>. 기기 안에만 저장되고, 서버로 나가는 사본에서 떼어냅니다.'],
  ['개인정보', '기초생활수급·장애 같은 정보는요?',
    '민감정보라 <strong>따로 동의하셨을 때만</strong> 서버에 올라갑니다. 동의하지 않으셔도 기기 안에는 그대로 남아 <strong>매칭은 똑같이</strong> 됩니다.'],

  ['요금·기타', '유료인가요?',
    '공고 검색·추천·알림은 무료입니다. 앞으로 유료 기능이 생기면 쓰기 전에 분명히 안내하고 동의를 받습니다.'],
  ['요금·기타', '잘못 지웠어요. 되살릴 수 있나요?',
    '설정 → 휴지통에서 되살릴 수 있어요. 지운 신청내역과 서류는 <strong>30일 동안</strong> 남습니다.'],
  ['요금·기타', '인터넷이 없어도 열리나요?',
    '한 번 열어 본 뒤로는 <strong>비행기 모드에서도</strong> 앱이 열리고 저장해 둔 공고·서류를 볼 수 있어요. 다만 새 공고를 받아오는 것은 연결됐을 때만 됩니다.'],
];

/* 고객센터의 '자주 찾는 질문 TOP 5' — 질문 글자로 가리킨다(번호로 가리키면 목록 순서가
   바뀌는 순간 엉뚱한 질문이 TOP 에 오른다). 🔴 없는 질문을 적으면 관문이 잡는다. */
const FAQ_TOP = [
  '이 앱에서 신청까지 끝나나요?',
  '우리 학교 공고가 안 보여요.',
  '알림이 안 와요.',
  '자격 요건이 안 적힌 공고가 있어요.',
  '유료인가요?',
];

/* 목록에 실제로 있는 갈래만, 나온 순서대로 */
function faqCats() {
  const seen = [];
  for (const [cat] of FAQ_ITEMS) if (!seen.includes(cat)) seen.push(cat);
  return seen;
}

let faqCat = '전체';
let faqQuery = '';

/* 검색은 **질문과 답 둘 다** 본다 — '주민번호'는 질문에 없고 답에만 있다.
   답에 섞인 <strong> 같은 표시는 빼고 글자만 견준다(안 빼면 'strong'이 검색된다). */
function faqPlain(html) {
  /* 더 지울 것이 없을 때까지 — 한 번만 지우면 `<<b>b>` 가 `<b>` 로 남는다(CodeQL 「불완전한 여러 글자 정리」 · 2026-11-19 app.js 에서 떼어 올 때 새 경보) */
  let s = String(html), prev;
  do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev);
  return s;
}
function faqHit(item, q) {
  if (!q) return true;
  const hay = `${item[1]} ${faqPlain(item[2])}`.toLowerCase();
  /* 띄어쓰기로 끊어 **전부 들어 있는 것**만 — '알림 아이폰'처럼 두 낱말로 좁힐 수 있다 */
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}

/* 찾은 낱말에 표시를 남긴다. 🔴 반드시 `esc()` **뒤에** 넣는다 — 먼저 넣으면 우리가 넣은
   태그까지 글자로 바뀌어 화면에 `<mark>` 가 그대로 뜬다. */
function faqWords(q) {
  return String(q).toLowerCase().split(/\s+/).filter(Boolean);
}
function faqMarkPlain(text, q) {
  let out = esc(text);
  for (const w of faqWords(q)) {
    const re = new RegExp(esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, (m) => `<mark>${m}</mark>`);
  }
  return out;
}
function faqMark(text, q) { return faqMarkPlain(text, q); }

/* 답은 이미 HTML(`<strong>` 등)이라 통째로 바꾸면 **태그 속 글자까지** 건드려 문서가 깨진다.
   그래서 태그와 글자를 갈라 **글자 조각에만** 표시를 남긴다.
   🔴 이 표시가 필요한 이유: 검색은 질문뿐 아니라 **답도** 본다(‘주민번호’는 답에만 있다).
      그래서 질문에는 안 걸린 결과가 목록에 뜨는데, 표시가 없으면 학생이 "왜 이게 나왔지?"
      하고 만다 — 펼치면 걸린 자리가 보이게 해 준다. */
function faqMarkHtml(html, q) {
  if (!q) return html;
  return String(html).split(/(<[^>]*>)/).map((piece) => {
    if (piece.startsWith('<')) return piece;      // 태그는 손대지 않는다
    for (const w of faqWords(q)) {
      const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      piece = piece.replace(re, (m) => `<mark>${m}</mark>`);
    }
    return piece;
  }).join('');
}

function faqListHtml() {
  const items = FAQ_ITEMS.filter((it) => (faqCat === '전체' || it[0] === faqCat) && faqHit(it, faqQuery));

  /* 🔴 결과가 없을 때 — 아파트너 참고안 그대로 '검색결과가 없습니다' + 고객센터로 보내는 길.
     여기서 막다른 길로 두면 학생이 앱을 닫는다. */
  if (!items.length) {
    return `<div class="faq-empty">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="28" cy="28" r="17"/><path d="M40.5 40.5L54 54"/>
        <path d="M22.5 25.5h.02M33.5 25.5h.02"/><path d="M22 34c3.6-2.6 8.4-2.6 12 0"/>
      </svg>
      <p class="faq-empty-title">검색결과가 없습니다</p>
      <p class="faq-empty-sub">찾으시는 답이 없다면 고객센터에서<br />도우미에게 물어보거나 문의를 남기실 수 있어요.</p>
      <button type="button" class="btn btn-outline" id="btn-faq-to-support">고객센터 가기</button>
    </div>`;
  }

  const q = faqQuery;
  return items.map(([cat, question, answer]) => `
    <details class="faq-item">
      <summary><span class="faq-cat">${esc(cat)}</span>${faqMark(question, q)}</summary>
      <div class="faq-a">${faqMarkHtml(answer, q)}</div>
    </details>`).join('');
}

/* 목록만 다시 그린다 — 검색창까지 다시 그리면 글자를 칠 때마다 **커서가 튄다**.
   그래서 renderFaq(틀)과 faqRefresh(목록)를 갈라 두었다. */
function faqRefresh() {
  const list = $('#faq-list');
  const banner = $('#faq-result');
  if (!list) return;
  list.innerHTML = faqListHtml();

  /* 검색 중일 때만 몇 건인지 말한다(아파트너 참고안의 파란 ⓘ 줄) */
  if (banner) {
    const n = list.querySelectorAll('.faq-item').length;
    banner.hidden = !faqQuery;
    if (faqQuery) banner.innerHTML = `<strong>"${esc(faqQuery)}"</strong>에 대한 결과가 ${n}개입니다.`;
  }

  const go = $('#btn-faq-to-support');
  if (go) go.addEventListener('click', () => showScreen('support'));
}

/* 화면을 **열 때마다** 검색어와 갈래를 처음으로 되돌린다.
   🔴 이게 없으면 옛 검색어가 남는다 — 실제로 없는 낱말을 찾아 빈 화면을 본 학생이 설정으로
      나갔다 '자주 묻는 질문'을 다시 눌렀을 때 **또 빈 화면**이 떴다(실측으로 잡았다).
      목록에서 다시 들어오는 것은 "처음부터 보겠다"는 뜻이다. */
function faqReset() {
  faqCat = '전체';
  faqQuery = '';
  const input = $('#faq-search');
  if (input) input.value = '';
  const clear = $('#faq-search-clear');
  if (clear) clear.hidden = true;
  $$('#faq-cats .filter-chip').forEach((c) => c.classList.toggle('active', c.dataset.faqCat === '전체'));
  faqRefresh();
}

function renderFaq() {
  const el = $('#faq-body');
  if (!el) return;
  /* 틀(검색창·칩)은 한 번만 그린다 — 글자를 칠 때마다 다시 그리면 커서가 튄다.
     되돌리기는 틀이 이미 있어도 매번 한다(위 faqReset 주석). */
  if (el.dataset.filled) { faqReset(); return; }
  el.dataset.filled = '1';

  /* 갈래 칩 — '전체'가 맨 앞이고 처음에 켜져 있다 */
  const chips = ['전체', ...faqCats()]
    .map((c) => `<button type="button" class="filter-chip${c === faqCat ? ' active' : ''}" data-faq-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');

  /* 검색창은 탐색 화면과 **같은 부품**(.search-box)을 쓴다 — 베끼면 두 검색창이 따로 논다 */
  el.innerHTML = `
    <div class="search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="search" id="faq-search" placeholder="질문을 입력해주세요" maxlength="40" autocomplete="off" aria-label="자주 묻는 질문 검색" />
      <button type="button" id="faq-search-clear" class="search-clear" aria-label="검색어 지우기" hidden>✕</button>
    </div>
    <div class="faq-cats" id="faq-cats">${chips}</div>
    <p class="faq-result" id="faq-result" hidden></p>
    <div id="faq-list"></div>`;

  const input = $('#faq-search');
  const clear = $('#faq-search-clear');
  input.addEventListener('input', () => {
    faqQuery = input.value.trim();
    clear.hidden = !input.value;
    faqRefresh();
  });
  clear.addEventListener('click', () => {
    input.value = ''; faqQuery = ''; clear.hidden = true;
    faqRefresh(); input.focus();
  });
  /* 폰 자판의 '검색'을 누르면 자판을 내린다 — 결과는 이미 글자를 칠 때마다 좁혀졌다 */
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });

  $('#faq-cats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-faq-cat]');
    if (!b) return;
    faqCat = b.dataset.faqCat;
    $$('#faq-cats .filter-chip').forEach((c) => c.classList.toggle('active', c === b));
    faqRefresh();
  });

  faqRefresh();
}

/* 고객센터에서 특정 질문으로 들어올 때 — 그 질문을 펼쳐 준다.
   🔴 갈래·검색어 되돌리기는 renderFaq(→ faqReset)이 이미 한다. 여기에 한 벌 더 두면
      한쪽만 고쳐져 갈라진다 — 이 저장소가 반복해 겪은 사고다. */
function faqOpenQuestion(question) {
  showScreen('faq');
  for (const d of $$('#faq-list .faq-item')) {
    if (d.querySelector('summary').textContent.includes(question)) {
      d.open = true;
      d.scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
  }
}

/* ---------------- 고객센터 (2026-09-13 개발자 지시 · 아파트너·라이프캐치 참고안) ----------------
   "설정 안에 고객센터를 두고, FAQ 는 강화해 달라"는 지시로 만들었다.

   🔴 **여기 있는 길은 전부 실제로 가는 길이다.** 라이프캐치 참고안에는 '나의 문의 내역'
      탭이 있지만 우리는 문의를 받아 두는 서버가 없다 — 없는 것을 탭으로 만들어 두면
      눌렀을 때 빈 화면이 나오고, 그게 이 앱이 가장 하지 말아야 할 일이다(운영 원칙 1).
      그래서 넣은 것은 넷뿐이고 넷 다 지금 동작한다:
        ① 자주 찾는 질문 TOP 5 → 누르면 그 질문이 펼쳐진 FAQ 로 간다
        ② 대장님(도우미)에게 묻기 → chat.js 의 chatOpen() 을 그대로 부른다
        ③ 문의 메일 쓰기 → **문의처가 정해졌을 때만** 나온다(support-config.js)
        ④ 진단 정보 복사 → 문의에 붙일 값. 개인정보는 한 줄도 담지 않는다.

   🔴 문의처가 비어 있을 때 '문의하기' 자리를 **빈칸으로 두지 않는다** — 대신 지금 할 수
      있는 것을 적는다. terms.html 9번과 **같은 사실**을 말해야 한다(약관과 앱이 다른 말을
      하면 안 된다). 그 문장을 여기에 베끼지는 않는다 — 원본은 terms.html 하나다. */

/* 문의·진단에 붙일 값. 🔴 이름·학교·성적·이메일 같은 개인정보는 **한 줄도 담지 않는다**.
   담는 것은 '어느 앱을 어떤 환경에서 쓰는가'뿐이라 그대로 남에게 보여 줘도 된다. */
function supportDiagnostics() {
  const cap = typeof notifySupport === 'function' ? notifySupport() : {};
  const perm = cap.hasApi ? cap.permission : '지원 안 함';
  return [
    ['앱 버전', APP_VERSION],
    ['설치 형태', cap.standalone ? '홈 화면에 설치함' : '브라우저에서 열었음'],
    ['알림 권한', perm === 'granted' ? '허용됨' : perm === 'denied' ? '차단됨' : perm === 'default' ? '아직 묻지 않음' : perm],
    ['로그인', (typeof authLoad === 'function' && authLoad()) ? '로그인함' : '로그인 안 함'],
    ['브라우저', navigator.userAgent],
  ];
}

function supportDiagText() {
  return supportDiagnostics().map(([k, v]) => `${k}: ${v}`).join('\n');
}

function renderSupport() {
  const el = $('#support-body');
  if (!el) return;

  /* TOP 5 — FAQ_TOP 이 가리키는 질문을 FAQ_ITEMS 에서 찾는다.
     🔴 못 찾으면 **번호를 비우지 않고 그 줄을 뺀다** — 없는 질문으로 가는 줄을 그려 두면
        눌러도 아무 일이 없다. (관문이 '다섯 줄인가'를 세므로 빠지면 바로 드러난다) */
  const top = FAQ_TOP
    .map((q) => FAQ_ITEMS.find((it) => it[1] === q))
    .filter(Boolean);

  const topHtml = top.map((it, i) => `
    <button type="button" class="sup-top-item" data-q="${esc(it[1])}">
      <span class="sup-top-no">${i + 1}</span>
      <span class="sup-top-q">${esc(it[1])}</span>
      <span class="sup-top-go" aria-hidden="true">›</span>
    </button>`).join('');

  /* 문의처가 정해졌을 때만 메일 버튼을 낸다 — 없으면 정직하게 무엇이 되는지 적는다 */
  const 문의 = supportConfigured()
    ? `<p class="sup-desc">답변은 적어 주신 메일 주소로 받으실 수 있어요.${SUPPORT_CONFIG.hours ? ` 응대 시간은 ${esc(SUPPORT_CONFIG.hours)}입니다.` : ''}</p>
       <button type="button" class="btn btn-outline" id="btn-support-mail">문의 메일 쓰기</button>`
    : `<p class="sup-desc">한대장은 아직 시범 개발 중이라 <strong>따로 받아 볼 문의처를 두지 않았어요.</strong>
         정해지면 이 자리에 적고 그때부터 받습니다(이용약관 9번과 같은 내용이에요).</p>
       <p class="sup-desc">그때까지는 위의 <strong>대장님</strong>에게 물어봐 주세요.
         내 정보를 지우는 것은 문의 없이 바로 하실 수 있어요 — 설정의 <strong>탈퇴</strong>(서버 정보),
         MY 의 <strong>데이터 초기화</strong>(이 기기 정보)입니다.</p>`;

  el.innerHTML = `
    <div class="my-card">
      <p class="wallet-title">자주 찾는 질문</p>
      <div class="sup-top">${topHtml}</div>
      <button type="button" class="sup-more" id="btn-support-faq">질문 전체 보기 · 검색</button>
    </div>

    <div class="my-card">
      <p class="wallet-title">바로 물어보기</p>
      <p class="sup-desc">대장님은 앱이 <strong>이미 아는 것</strong>(등록된 공고·서류·내 신청 현황·공고 원문)을 찾아 줍니다. 모르면 지어내지 않고 못 찾았다고 말해요.</p>
      <button type="button" class="btn btn-outline" id="btn-support-chat">대장님에게 물어보기</button>
    </div>

    <div class="my-card">
      <p class="wallet-title">문의하기</p>
      ${문의}
    </div>

    <div class="my-card">
      <p class="wallet-title">진단 정보</p>
      <p class="sup-desc">문제를 알려 주실 때 아래를 함께 보내 주시면 원인을 훨씬 빨리 찾을 수 있어요.
        <strong>이름·학교·성적 같은 개인정보는 들어 있지 않습니다.</strong></p>
      <div class="sup-diag">${supportDiagnostics()
        .map(([k, v]) => `<div class="sup-diag-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      <button type="button" class="btn btn-outline" id="btn-support-copy">진단 정보 복사</button>
    </div>`;

  el.querySelectorAll('[data-q]').forEach((b) => {
    b.addEventListener('click', () => faqOpenQuestion(b.dataset.q));
  });
  $('#btn-support-faq').addEventListener('click', () => showScreen('faq'));
  $('#btn-support-chat').addEventListener('click', () => {
    if (typeof chatOpen === 'function') chatOpen();
    else toast('도우미를 열지 못했어요');
  });
  $('#btn-support-copy').addEventListener('click', () => copyText(supportDiagText(), '진단 정보를 복사했어요'));

  const mail = $('#btn-support-mail');
  if (mail) {
    mail.addEventListener('click', () => {
      /* 🔴 메일 앱을 여는 것뿐이다 — 앱이 대신 보내지 않는다. 학생이 내용을 보고 직접 보낸다.
         진단 정보를 본문에 미리 넣어 두되, 보내기 전에 눈으로 볼 수 있는 자리에 둔다. */
      const body = `\n\n\n--- 아래는 문제를 찾는 데 쓰는 정보입니다 (개인정보 없음) ---\n${supportDiagText()}\n`;
      location.href = `mailto:${encodeURIComponent(SUPPORT_CONFIG.email)}`
        + `?subject=${encodeURIComponent('[한대장] 문의')}&body=${encodeURIComponent(body)}`;
    });
  }
}

/* ---------------- 앱 권한 · 오픈소스 라이선스 (2026-09-11 개발자 지시 4번) ----------------
   🔴 **웹앱은 폰 설정 앱을 열 수 없다.** 그런 길이 브라우저에 없다(앱스토어에 올린 진짜
      앱만 된다). 그래서 '눌러서 폰 설정으로 이동'은 만들 수 없고, 대신 **지금 권한 상태를
      보여 주고 어디로 가야 하는지 글로 안내**한다. 있지도 않은 버튼을 만들어 두면
      눌러도 아무 일이 없어 더 나쁘다.
   🔴 라이선스 목록은 **실제로 싣는 것만** 적는다. 이 앱은 CSP 가 바깥 스크립트를 막아
      자바스크립트 라이브러리를 하나도 싣지 않고, 바깥에서 받는 것은 글꼴 하나뿐이다. */
const OSS_LICENSES = [
  ['Pretendard', 'SIL Open Font License 1.1', 'https://github.com/orioncactus/pretendard'],
];

function permLabel() {
  if (typeof Notification === 'undefined') return { text: '이 브라우저는 알림을 지원하지 않아요', cls: 'off' };
  if (Notification.permission === 'granted') return { text: '허용됨', cls: 'on' };
  if (Notification.permission === 'denied') return { text: '차단됨', cls: 'off' };
  return { text: '아직 묻지 않음', cls: 'off' };
}

function renderPerms() {
  const el = $('#perms-body');
  if (!el) return;
  const p = permLabel();
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  /* 🔴 **줄을 긋지 않는다** (2026-09-11 개발자 지시 — "단락 나누는 용으로 줄 그어져 있는 거 없애고").
     전에는 서류 보관함의 `.wallet-row`·`.my-card` 를 빌려 써서 그 목록의 구분선이 딸려 왔다.
     목록이 아니라 **읽는 글**이라 선이 문단을 토막 냈다. 이제 절은 **빈칸으로만** 나누고
     (`.perm-sec` 사이 --space-32), 문단은 제 리듬을 갖는다 — 이끄는 글 → 항목 → 덧붙이는 글.
     🔴 이 화면 전용 이름을 쓴다: 보관함 클래스를 여기서 고치면 서류 목록의 선까지 사라진다. */
  el.innerHTML = `
    <section class="perm-sec">
      <p class="perm-title">앱 권한</p>
      <div class="perm-state">
        <p class="perm-name">알림</p>
        <p class="perm-value nf-status-${p.cls}">${esc(p.text)}</p>
      </div>
      ${blocked ? `<p class="perm-how"><strong>폰에서 차단해 두셨어요.</strong> 앱에서는 다시 물을 수 없고,
        폰 설정에서 직접 바꿔야 합니다.</p>
      <p class="perm-how perm-steps">아이폰: 설정 → 알림 → 한대장 → 알림 허용<br />
        안드로이드: 설정 → 앱 → 한대장 → 알림</p>`
      : `<p class="perm-how">알림을 켜고 끄는 것은 <strong>설정 → 알림</strong>에서 합니다.
        폰 설정에서 아예 차단해 두면 앱에서는 되돌릴 수 없어요.</p>`}
      <p class="perm-how">한대장은 <strong>웹앱</strong>이라 사진·카메라·연락처 권한을 쓰지 않습니다.
        서류 보관함에 파일을 올릴 때만 그때그때 파일을 고르게 되어 있고, 앱이 폰 안을 뒤지지 않습니다.</p>
    </section>
    <section class="perm-sec">
      <p class="perm-title">오픈소스 라이선스</p>
      <p class="perm-lead">이 앱은 바깥 자바스크립트 라이브러리를 하나도 싣지 않습니다(보안 설정이 막습니다).
        바깥에서 받아 쓰는 것은 아래 글꼴 하나뿐이에요.</p>
      ${OSS_LICENSES.map(([name, lic, url]) => `
        <div class="perm-state">
          <div>
            <p class="perm-name">${esc(name)}</p>
            <p class="perm-value">${esc(lic)}</p>
          </div>
          <a class="perm-link" href="${esc(url)}" target="_blank" rel="noopener">원문 ↗</a>
        </div>`).join('')}
    </section>${photoCreditsHtml()}`;
  /* 학교 사진 목록을 아직 안 받았으면 받아서 다시 그린다(소식을 받을 때 같이 받는 작은 파일) */
  if (!schoolPhotos && state.profile && state.profile.school) {
    fetch('assets/schools/photos.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { if (d && d.schools && !schoolPhotos) { schoolPhotos = d; if (currentScreen === 'perms') renderPerms(); } });
  }
}

/* 사진 출처 (2026-10-04) — 홈 소식 카드에 쓰는 우리 학교 대표 사진의 작가·라이선스. 위키미디어 공용 CC BY·BY-SA 는 출처를 적어야 한다.
   개발자 지시(10-03 "학교 사진에 대한 설명은 … happy talk 이므로 빼")로 홈 구역 아래 출처 줄을 여기로 옮겼다 — 학생 화면에는 사진만. */
function photoCreditsHtml() {
  const p = state.profile;
  const list = ((schoolPhotos && schoolPhotos.schools && p && schoolPhotos.schools[p.school]) || []).filter((x) => x && x.credit);
  if (!list.length) return '';
  return `
    <section class="perm-sec">
      <p class="perm-title">사진 출처</p>
      ${list.map((x) => `
        <div class="perm-state">
          <div>
            <p class="perm-name">${esc(p.school)}</p>
            <p class="perm-value">${esc(x.credit)} · 위키미디어 공용</p>
          </div>
          ${/^https:\/\/commons\.wikimedia\.org\//.test(x.page || '') ? `<a class="perm-link" href="${esc(x.page)}" target="_blank" rel="noopener">원문 ↗</a>` : ''}
        </div>`).join('')}
    </section>`;
}

/* ---------------- 이용약관 · 개인정보처리방침 (2026-09-11) ----------------
   🔴 글을 여기 베끼지 않는다 — 원본은 `terms.html` 하나다(법적 문서라 제 주소가 있어야 하고,
      온보딩 동의 줄은 지금도 새 탭으로 그 파일을 연다). 두 벌이 되면 한쪽만 고쳐져
      화면과 약관이 다른 말을 하게 된다. 그래서 그 파일을 읽어 와 본문만 옮겨 넣는다.
   🔴 넣는 것은 **우리 저장소의 정적 파일**이지 수집한 글이 아니다 — 그래서 innerHTML 로
      넣어도 된다(CSP 가 script-src 'self' 라 혹시 섞여 들어와도 실행되지 않는다).
   ⚠️ 못 읽어 왔을 때 빈 화면으로 두지 않는다 — 무슨 일인지 말하고 원문 링크를 준다. */
let termsHtml = null;

async function renderTerms() {
  const el = $('#terms-body');
  if (!el) return;
  if (termsHtml) { el.innerHTML = termsHtml; return; }
  el.innerHTML = '<p class="legal-loading">약관을 불러오는 중이에요…</p>';
  try {
    const res = await fetch('terms.html', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const src = doc.querySelector('.legal');
    if (!src) throw new Error('본문 없음');
    /* 그 파일의 제 머리줄(뒤로+제목)은 뺀다 — 이 화면이 이미 갖고 있다 */
    const head = src.querySelector('.legal-header');
    if (head) head.remove();
    termsHtml = src.innerHTML;
    el.innerHTML = termsHtml;
  } catch (e) {
    el.innerHTML = `<p class="legal-loading">약관을 불러오지 못했어요.
      <a href="terms.html" target="_blank" rel="noopener">따로 열어 보기 ↗</a></p>`;
  }
}

/* 탈퇴 — 계정 카드 안의 '탈퇴' 와 **같은 일**을 한다(서버에 저장된 내 정보 삭제).
   🔴 지우는 것은 서버 사본뿐이고 이 기기의 프로필·신청내역은 그대로 남는다.
      말과 다르게 굴면 안 되므로 묻는 문장에도 그렇게 적는다. */
async function withdrawAccount() {
  if (typeof authUser !== 'function' || !authUser()) {
    toast('로그인한 계정이 없어요 — 지울 서버 정보가 없습니다');
    return;
  }
  if (!confirm('서버에 저장된 프로필·신청내역을 지울까요?\n이 기기의 정보는 그대로 남습니다.')) return;
  const r = await authDeleteData();
  /* 🔴 알림 구독도 함께 끊는다 (2026-09-11 코드 리뷰). 약관이 '탈퇴 시 즉시 파기'라고
     적고 있는데 탈퇴가 발송 서버의 구독을 건드리지 않아, 지웠다는 폰으로 알림이 계속 갔다.
     ⚠️ 실패해도 탈퇴는 성공으로 둔다 — 프로필은 이미 지워졌고, 죽은 구독은 발송 때
        404 정리가 받친다. */
  if (typeof pushUnsubscribe === 'function') { try { await pushUnsubscribe(); } catch (e) { /* 무시 */ } }
  toast(r.ok ? '서버 정보 삭제 완료' : r.error);
  renderSettings();
}

/* ---------------- 휴지통 (2026-09-11 · 개발자 지시 "둘 다") ----------------
   지운 **신청내역**(state.trash)과 지운 **서류 파일**(IndexedDB 'trash')이 함께 모인다.
   🔴 두 곳에 나눠 담는 이유: 파일은 수 MB 라 localStorage 에 들어가지 않는다.
      화면에서만 한 목록으로 합친다 — 학생에게는 '지운 것'이 한 군데여야 한다.
   🔴 보관 기간 30일은 이 앱의 다른 규칙(마감+30일 숨김)과 같은 값으로 맞췄다. */
const TRASH_KEEP_DAYS = 30;

/* 지운 지 30일이 지난 것을 실제로 지운다. 앱을 열 때 한 번 돈다.
   '보관 기간이 지나면 사라진다'고 화면에 적어 둔 이상, 정말로 사라져야 한다. */
async function trashPurgeOld() {
  const cut = Date.now() - TRASH_KEEP_DAYS * 86400000;
  const before = state.trash.length;
  state.trash = state.trash.filter((t) => (t.deletedAt || 0) > cut);
  if (state.trash.length !== before) saveState();
  try {
    const all = await trashTx('readonly', (st) => st.getAll());
    for (const r of all || []) {
      if ((r.deletedAt || 0) <= cut) await trashTx('readwrite', (st) => st.delete(r.key));
    }
  } catch (e) { /* 금고를 못 열면 다음 실행에서 다시 시도한다 */ }
}

/* '3일 전' 처럼 읽기 쉬운 말로. 오늘 지운 것은 '오늘'이라고 한다. */
function trashWhen(ms) {
  const d = Math.floor((Date.now() - (ms || 0)) / 86400000);
  if (d <= 0) return '오늘 지움';
  if (d === 1) return '어제 지움';
  return `${d}일 전에 지움`;
}

async function renderTrash() {
  const el = $('#trash-body');
  if (!el) return;
  await trashPurgeOld();

  let docs = [];
  try { docs = (await trashTx('readonly', (st) => st.getAll())) || []; } catch (e) { docs = []; }

  const rows = [
    ...state.trash.map((t, i) => {
      const sch = findSch(t.app && t.app.id);
      return {
        at: t.deletedAt || 0,
        kind: '신청내역',
        /* 🔴 공고가 목록에서 내려갔으면 이름을 **지어내지 않는다** — 원칙 8-1.
           그래도 되살릴 수는 있어야 하므로 줄은 남기고 그렇게 적는다.
           신청할 때 적어 둔 이름(`app.name`)은 그때 공고에서 읽은 글자라 지어낸 것이
           아니다 — 있으면 그걸 쓴다(2026-09-20, 신청내역과 같은 규칙). */
        title: (sch && sch.name) || (t.app && t.app.name) || '(목록에서 내려간 공고)',
        restore: `app:${i}`,
        drop: `app:${i}`,
      };
    }),
    ...docs.map((d) => {
      const slot = (typeof DOC_SLOTS !== 'undefined' ? DOC_SLOTS : []).find((x) => x.slot === d.slot);
      return {
        at: d.deletedAt || 0,
        kind: '서류',
        title: slot ? slot.label : (d.name || '서류'),
        restore: `doc:${d.key}`,
        drop: `doc:${d.key}`,
      };
    }),
  ].sort((a, b) => b.at - a.at);

  if (!rows.length) {
    /* 🔴 목업에 없던 화면이라 이 문구는 이 세션이 지은 것이다 — 개발자 확인 대상. */
    /* 🔴 설명 한 줄은 뺐다 (2026-09-11 개발자 지시). 화면 맨 위 `.set-note` 가 이미
       '30일 뒤 사라진다'를 말하고 있어 같은 말이 두 번이었다. */
    el.innerHTML = `<div class="my-card trash-empty">
        <p class="trash-empty-title">휴지통이 비어 있어요</p>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="my-card">${rows.map((r) => `
      <div class="wallet-row">
        <div class="wallet-info">
          <p class="trash-title">${esc(r.title)}</p>
          <p class="wallet-status">${esc(r.kind)} · ${esc(trashWhen(r.at))}</p>
        </div>
        <div class="wallet-btns">
          <button class="wallet-btn primary" data-trash-back="${esc(r.restore)}">되살리기</button>
          <button class="wallet-btn danger" data-trash-drop="${esc(r.drop)}">완전 삭제</button>
        </div>
      </div>`).join('')}</div>`;

  $$('#trash-body [data-trash-back]').forEach((b) =>
    b.addEventListener('click', () => trashRestore(b.dataset.trashBack)));
  $$('#trash-body [data-trash-drop]').forEach((b) =>
    b.addEventListener('click', () => trashDrop(b.dataset.trashDrop)));
}

async function trashRestore(key) {
  const [kind, rest] = key.split(/:(.+)/);
  if (kind === 'app') {
    const t = state.trash[Number(rest)];
    if (!t) return;
    /* 지운 뒤 목록이 짧아졌을 수 있으므로 자리를 범위 안으로 눌러 넣는다.
       (splice 는 범위를 넘으면 맨 뒤에 붙이지만, 그 동작에 기대지 않고 분명히 적는다.) */
    const at = Math.min(Math.max(0, t.at | 0), state.applications.length);
    state.applications.splice(at, 0, t.app);
    state.trash.splice(Number(rest), 1);
    saveState();
    renderApplications();
    renderHome();
    /* 내려간 공고의 기록은 되살려도 신청 내역에 안 보인다(2026-10-02) — 보인다고 말하지 않는다 */
    toast(findSch(t.app.id) ? '신청내역으로 되살렸어요' : '되살렸어요 · 공고가 목록에 다시 올라오면 신청내역에 보여요');
  } else {
    let rec;
    try { rec = await trashTx('readonly', (st) => st.get(rest)); } catch (e) { rec = null; }
    if (!rec) { toast('그 파일을 찾지 못했어요'); return; }
    /* 🔴 그 자리에 다른 파일이 있으면 **덮어쓰지 않는다** — 되살리려다 멀쩡한 서류를
       잃는 것은 휴지통이 막으려던 바로 그 일이다. */
    if (walletCache[rec.slot]) { toast('그 칸에 이미 다른 서류가 있어요 · 먼저 지우거나 교체해 주세요'); return; }
    await walletTx('readwrite', (st) => st.put({
      slot: rec.slot, name: rec.name, type: rec.type, blob: rec.blob, savedAt: rec.savedAt,
      ...(rec.dataUrl ? { dataUrl: rec.dataUrl } : {}),
    }));
    await trashTx('readwrite', (st) => st.delete(rest));
    await walletRefresh();
    /* 프로필 사진을 되살렸으면 MY·홈·양식 문서가 바로 알아야 한다 — 안 그러면 다시 켤 때까지 첫 글자만 보인다 */
    if (rec.slot === PHOTO_SLOT) { await photoRefresh(); if (!$('#screen-home').hidden) renderHome(); }
    toast(rec.slot === PHOTO_SLOT ? '프로필 사진을 되살렸어요' : '서류 보관함으로 되살렸어요');
  }
  renderTrash();
}

async function trashDrop(key) {
  if (!confirm('완전히 지울까요?\n이 동작은 되돌릴 수 없습니다.')) return;
  const [kind, rest] = key.split(/:(.+)/);
  if (kind === 'app') {
    state.trash.splice(Number(rest), 1);
    saveState();
  } else {
    try { await trashTx('readwrite', (st) => st.delete(rest)); } catch (e) { /* 없으면 그만 */ }
  }
  toast('완전히 지웠어요');
  renderTrash();
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

/* 서류함 · 공고 보관함은 2026-10-10 에 MY 의 **안쪽 화면**(mydocs·mysaved)으로 옮겼다 — 같은 날 아침의 접기(<details>)는 걷었다.
   몇 건인지는 MY 메뉴 줄의 작은 글씨가 말한다(renderMyMenu). */
function renderWallet() {
  const el = $('#my-wallet');
  const have = DOC_SLOTS.filter((s) => walletCache[s.slot]).length;
  { const sub = $('#my-sub-docs'); if (sub) sub.textContent = `${DOC_SLOTS.length}개 중 ${have}개`; }
  el.innerHTML = (`
    ${DOC_SLOTS.map((s) => {
      const rec = walletCache[s.slot];
      return `
        <div class="wallet-row">
          <div class="wallet-info">
            ${/* 🔴 서류 이름은 **누를 수 있다** — 어디서 떼는지를 작은 창으로 알려 준다.
                 발급처를 줄마다 깔아 두면 여덟 줄이 설명으로 가득 차 정작 '있다/없다'가 안 보인다.
                 🔴 줄마다 붙던 「?」 동그라미는 뗐다(2026-10-06 사장님 지시 'AI 티' · 개선안 G) —
                    같은 장식이 여덟 번 반복됐다. 누를 수 있다는 표시는 이름의 점선 밑줄(style.css)이 한다. */ ''}
            <button class="wallet-label" data-issue="${s.slot}" aria-haspopup="dialog">
              ${esc(s.label)}
            </button>
            ${rec ? '' : '<p class="wallet-status">미등록</p>'}
          </div>
          <div class="wallet-btns">
            ${rec ? `<button class="wallet-btn" data-view="${s.slot}">보기</button>
                     <button class="wallet-btn danger" data-del="${s.slot}">삭제</button>` : ''}
            <label class="wallet-btn primary">${rec ? '교체' : '올리기'}
              <input type="file" data-slot="${s.slot}" accept="image/*,application/pdf" hidden />
            </label>
          </div>
        </div>`;
    }).join('')}`);

  /* 발급처 안내 창 — 시트를 열 만한 내용이 아니라서 **작은 창** 하나로 띄운다.
     🔴 발급처 글자는 data.js 의 DOC_SLOTS.issue 그대로다 — 여기서 지어내지 않는다. */
  {
    const pop = $('#wallet-pop');
    const bg = $('#wallet-pop-backdrop');
    const close = () => { if (!pop) return; pop.classList.remove('show'); if (bg) bg.classList.remove('show'); pop.hidden = true; };
    $$('#my-wallet [data-issue]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = DOC_SLOTS.find((d) => d.slot === btn.dataset.issue);
        if (!slot || !pop) return;
        pop.innerHTML = `
          <p class="wp-title">${esc(slot.label)}</p>
          <p class="wp-label">발급 방법</p>
          <p class="wp-issue">${esc(slot.issue)}</p>
          <button class="wp-close" type="button">닫기</button>`;
        pop.hidden = false;
        if (bg) bg.classList.add('show');
        requestAnimationFrame(() => pop.classList.add('show'));
        pop.querySelector('.wp-close').addEventListener('click', close);
      })
    );
    if (pop) {
      $('#wallet-pop-backdrop').addEventListener('click', close);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    }
  }

  $$('#my-wallet input[type=file]').forEach((inp) =>
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('10MB 이하 파일만 가능'); return; }
      await walletPut(inp.dataset.slot, file);
      toast('보관함 저장 완료');
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
