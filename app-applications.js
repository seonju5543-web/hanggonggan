/* app-applications.js — 신청 내역 화면 (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
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
const appsLogOpen = new Set();   // 펼쳐 둔 진행 기록 — 다시 그려도 닫히지 않게
let undoBuffer = null;          // 되돌리기용 — 지운 항목과 원래 자리

function appCard(app, sch) {
  const step = effectiveStep(app, sch);
  const stepLabel = step === 3 ? (app.result === 'won' ? '선정' : '결과 확인') : APP_STEPS[step];
  const checked = appsSelected.has(app.id) ? 'checked' : '';
  /* 🔴 진행 단계는 **막대에 붙인다** (2026-08-31 개발자 지시).
     위쪽 배지로 두면 분류 배지(교내/교외)와 같은 무게로 보여서 '단계'라는 것이 안 읽혔고,
     정작 그 아래 막대가 무엇을 재는 막대인지는 화면 어디에도 안 적혀 있었다.
     이제 이름과 'n/4'가 막대 바로 위에 붙어, 막대와 글자가 같은 것을 말한다. */
  const stepNow = app.pending ? '서류 작성 필요' : prepStateLabel(app, sch, stepLabel);
  const inPrep = /^준비 중/.test(stepNow);
  /* 🔴 마감된 공고는 여기가 **유일한 자리**다 (2026-09-05 — 목록은 마감 다음 날 내린다).
     진행 단계만 적으면 제출 안 한 채 마감된 건이 '신청 준비 완료'로만 보여 아직 낼 수 있다고
     오해한다. 판정을 새로 만들지 않고 dday() 가 이미 내린 cls 를 읽는다 — 목록·상세·알림과
     같은 함수다. 마감일이 없는 공고(상시 제도·기한 미확인)는 cls 가 비어 배지가 안 뜬다. */
  const isClosed = dday(sch.deadline).cls === 'closed';
  const closedBadge = isClosed ? '<span class="badge badge-dday closed">마감</span>' : '';
  /* 🔴 **마감된 건의 막대를 '진행 중'처럼 칠하지 않는다** (2026-09-20 개발자 지적).
     면학장학금이 마감인데 파란 막대가 1/4 만큼 차 있어, 훑으면 아직 진행 중으로 읽혔다
     (마감 표시는 오른쪽 위 작은 회색 배지뿐이었다).
     ⚠️ 제출을 기록한 건은 **빼지 않는다** — 그건 마감 뒤에도 진짜로 진행 중(심사)이다.
        결과를 기록한 건도 제 색(선정 빨강·미선정 회색)을 그대로 쓴다. */
  const deadPrep = isClosed && !app.submittedAt && !app.result;
  const stepCount = (app.pending || inPrep) ? '' : `${step + 1}/${APP_STEPS.length}`;
  /* 준비 중이면 첫 칸(25%) 안에서 체크 수만큼 찬다 — 완료 칸을 다 칠하지 않는다 */
  const pct = app.pending ? 6 : inPrep ? Math.max(8, (prepChecklist(app, sch).done / PREP_ITEMS.length) * 25) : ((step + 1) / APP_STEPS.length) * 100;
  return `
    <div class="swipe-row${appsLogOpen.has(app.id) ? ' log-open' : ''}" data-row="${esc(app.id)}">
      ${appsSelectMode ? `<input type="checkbox" class="row-check" data-pick="${esc(app.id)}" ${checked}
         aria-label="${esc(sch.name)} 선택" />` : ''}
      <button class="sch-card" data-detail="${sch.id}" tabindex="-1">
        <div class="sch-top">
          ${kindChipHtml(sch)}${closedBadge}${/* 갈래 칩 — 카드·시트·보관함 줄과 같은 「장학 · 교내」 · 활동이면 공모전·대외활동(2026-11-21) */ ''}
        </div>
        <p class="sch-name">${esc(sch.name)}</p>
        <div class="app-step app-step-s${step}${app.result === 'lost' ? ' app-step-lost' : ''}${app.pending ? ' app-step-wait' : ''}${deadPrep ? ' app-step-closed' : ''}">
          <div class="app-step-head"><span>${esc(stepNow)}</span>${stepCount ? `<em>${stepCount}</em>` : ''}</div>
          <div class="mini-progress"><div style="width:${pct}%"></div></div>
        </div>
      </button>
      <button class="app-toggle" data-log-toggle="${esc(app.id)}" aria-expanded="${appsLogOpen.has(app.id)}">
        ${/* 🔴 **없는 것을 약속하지 않는다** (2026-09-20 개발자 지적). 이 손잡이는 모든
             카드에 똑같이 '세부사항 입력하기'라고 붙어 있었는데, 결과를 기록한 건은
             펼쳐도 「기록 취소」 하나뿐이라 입력할 것이 없다(실측 5장 중 2장이 그랬다).
             할 일이 남았을 때만 '입력하기'라고 말한다. */ ''
        }${app.result ? '기록 보기' : '세부사항 입력하기'}<span class="app-caret" aria-hidden="true"></span>
      </button>
      ${appLogHtml(app, sch, step)}
    </div>`;
}

/* 공고를 누르면 그 아래에 펼쳐지는 진행 기록.
   🔴 앱이 **아는 것만** 적는다. 발표일은 공고 원문에 있을 수도 없을 수도 있는데 앱은
      그것을 읽지 않았으므로 '공고 원문 확인'이라고 말한다(원칙 8-1) — 지어낸 날짜는
      학생을 그날까지 기다리게 만든다.
   🔴 제출·선정 기록은 여기서 바로 남긴다. 앱은 학교 전산을 볼 수 없으므로 이 둘은
      언제나 학생이 적는 값이다(운영 원칙 8). */
/* 담아 둔 공고를 다시 누르는 학생이 궁금한 것은 공고 내용이 아니다(담을 때 이미 봤다).
   궁금한 것은 **"내가 지금 뭘 해야 하나"** 하나뿐이라, 그 한 줄을 패널 맨 위에 둔다.
   🔴 앱이 아는 사실(담김·제출 기록·마감 경과·결과 기록)로만 정한다 — 발표일·경쟁률처럼
      앱이 모르는 것은 여기 올리지 않는다(원칙 8-1).
   🔴 무거운 동작(양식 작성·제출처 열기)은 **상세 시트로 보낸다.** 여기에 같은 버튼을
      한 벌 더 만들면 제출 흐름이 두 곳으로 갈라진다. */
function nextAction(app, sch, step, d, closed) {
  const go = (label) => `<button class="app-next-btn" data-detail="${esc(sch.id)}">${label}</button>`;
  if (app.pending) return { text: '신청서 작성이 남았어요', btn: go('이어서 작성') };
  if (step === 0 && !closed) {
    /* 준비 체크리스트가 남았으면 그것이 다음 할 일이다 (2026-10-13 ③) — 체크는 상세 시트에서 */
    const pc = prepChecklist(app, sch);
    if (!pc.complete) return { text: `준비 중 ${pc.done}/${pc.total} · 남은 것: ${pc.items.filter((i) => !i.done).map((i) => i.label).join(' · ')}`, btn: go('준비 이어서') };
  }
  if (step === 0) {
    return closed
      ? { text: '접수가 마감됐어요. 제출하셨나요?',
          btn: `<button class="app-next-btn" data-mark-submit="${esc(app.id)}">제출했다고 기록</button>` }
      : { text: `아직 제출 기록이 없어요${sch.deadline ? ' · 마감 ' + esc(d.label) : ''}`,   // 마감을 모르면 말하지 않는다(2026-11-15)
          btn: go('제출하러 가기') };
  }
  if (step === 1) return { text: '결과가 나오면 아래에 기록해 주세요', btn: '' };   // 2026-11-21 개발자 지시로 줄임(학생이 읽지 않는 안내)
  if (step === 2) return { text: '결과가 나오면 아래에 기록해 주세요', btn: '' };
  return { text: app.result === 'won' ? '선정으로 기록됨' : '미선정으로 기록됨', btn: '' };
}

/* 제출 서류 체크리스트 — 학생이 제출 직전 가장 자주 막히는 자리.
   🔴 앱이 **이미 아는 것만** 쓴다: 공고가 적어 둔 요구 서류(sch.documents)와
      기기 안 보관함(walletCache). 지어낼 자리가 없다.
   🔴 판정은 상세 시트가 쓰는 docWalletStatus 를 그대로 쓴다 — 여기에 규칙을 한 벌
      더 두면 같은 서류를 두 화면이 다르게 말한다(이 저장소가 자격 판정에서 겪은 일).
   자소서·계획서 같은 작성물은 뺀다(certStatusListHtml 과 같은 기준) — 발급받는 것이 아니다.
   다 준비된 경우엔 접어 둔다: 할 일이 없는 목록이 자리를 먹으면 진짜 할 일이 밀린다. */
/* '서류 이름'인가, '아직 못 읽었다는 표시'인가.
   원문 공고를 가리키면서 구체적인 서류 이름이 하나도 없으면 후자다.
   `학자금대출 관련 증빙 (공고 확인)`·`논문 계획서 1부` 처럼 이름이 있는 것은 서류로 남는다. */
function isUnknownDoc(doc) {
  return /원문\s*공고|재공고\s*원문/.test(doc)
    && !/증명서|신청서|동의서|계획서|사본|확인서|의향서|성적|증빙/.test(doc);
}

function docChecklistHtml(sch) {
  const all = (sch.documents || []).filter((doc) => !ESSAY_DEFS.some((e) => e.match.test(doc)));
  if (!all.length) return '';
  /* 🔴 등록 데이터의 서류 칸 상당수는 서류 이름이 아니라 **'아직 못 읽었다'는 표시**다
     (`지원 자격·제출 서류는 원문 공고에서 확인` 이 실측 25건으로 최다). 이것을
     체크리스트 한 줄로 세면 "제출 서류 1개"라고 말하게 되는데, 앱은 그 공고에
     서류가 몇 개인지 모른다 — 모르는 것을 아는 것처럼 말하는 꼴이다(원칙 8-1).
     그래서 갈라서, 이런 항목은 세지 않고 '원문 확인' 한 줄로만 내놓는다. */
  const known = all.filter((doc) => !isUnknownDoc(doc));
  const unknown = all.length - known.length;
  /* 🔴 못 읽은 서류는 **아무 줄도 없다** (2026-11-15 · 개발자 결정 11-02 — 예전 「(이 밖의) 제출 서류는 공고 원문에서 확인」) — 세지도 않는다(위 주석 그대로) */
  void unknown;
  const note = '';
  if (!known.length) return '';
  const certDocs = known;
  const marks = certDocs.map((doc) => ({ doc, st: docWalletStatus(doc) }));
  const tracked = marks.filter((m) => m.st);
  const missing = tracked.filter((m) => !m.st.ok);
  const rows = marks.map(({ doc, st }) => {
    const name = esc(doc.replace(/(?:\s*[(（][^()（）]*[)）])+\s*$/, '') || doc);   // 끝 괄호만 뗀다 · 다 지워지면 원래 글자(리뷰 10차 · 증명서류 체크리스트와 같은 규칙)
    if (st && st.ok) return `<li class="dc-ok">${name}</li>`;
    if (st) return `<li class="dc-miss">${name}<em>${esc(st.slot.issue)}</em></li>`;
    /* 보관함에 칸이 없는 서류 — 앱이 있는지 모르므로 빈 네모만 둔다(「보관함에서 확인할 수 없는 서류」 글자는 2026-11-21 개발자 지시로 지움) */
    return `<li class="dc-etc">${esc(doc)}</li>`;
  }).join('');
  /* 머리글은 **학생이 할 일의 개수**를 말한다 — 분수(0/2)는 읽는 데 한 박자 걸린다.
     🔴 세는 것은 `known` 이다 (2026-09-10 코드 리뷰). `all` 로 세면 위에서 일부러 갈라낸
        '아직 못 읽었다' 표시까지 서류로 세어, **머리글은 3개인데 목록은 2줄**이 된다
        (실측 4건 — reg-hi-jeju 3→2 · reg-hufs-myeonhak 2→1 · reg-hufs-alumni 3→2 ·
        reg-khu-intern 2→1). 줄은 갈랐는데 숫자만 안 갈랐던 것이다.
        못 읽은 몫은 바로 아래 `note` 줄이 이미 말한다. */
  /* 2026-11-21 개발자 지시로 꼬리 「보관함에서 자동 첨부」를 지움(학생이 읽지 않는 안내 · ✓ 표시가 같은 말을 한다) */
  const head = `제출 서류 ${known.length}개`;
  return `
    <details class="doc-check"${missing.length ? ' open' : ''}>
      <summary>${esc(head)}${missing.length ? ` <b>${missing.length}개 준비 안 됨</b>` : ''}</summary>
      <ul>${rows}</ul>
      ${note}
    </details>`;
}

function appLogHtml(app, sch, step) {
  if (app.result) {
    return `
      <div class="app-log"${appsLogOpen.has(app.id) ? '' : ' hidden'}>
        <div class="app-done${app.result === 'won' ? ' app-done-won' : ''}">
          <p>${app.result === 'won' ? '선정으로 기록되었어요' : '미선정으로 기록되었어요'}${
            app.resultAt ? ' · ' + esc(app.resultAt) : ''}</p>
          ${/* 🔴 잘못 눌렀을 때 되돌아갈 길 — 없으면 오누름이 영영 남는다 */ ''}
          <button class="app-log-btn" data-undo-result="${esc(app.id)}">기록 취소</button>
        </div>
      </div>`;
  }
  const d = dday(sch.deadline);
  const row = (done, label, value) =>
    `<li class="${done ? 'done' : ''}"><b>${esc(label)}</b>${value ? `<span>${value}</span>` : ''}</li>`;
  const closed = sch.deadline && d.days < 0;
  const next = nextAction(app, sch, step, d, closed);
  return `
    <div class="app-log"${appsLogOpen.has(app.id) ? '' : ' hidden'}>
      <div class="app-next">
        <p>${esc(next.text)}</p>
        ${next.btn}
      </div>
      ${docChecklistHtml(sch)}
      <ul class="app-log-list">
        ${sch.deadline ? row(!!closed, '접수 마감', esc(sch.deadline) + (closed ? ' 지남' : ' · ' + esc(d.label))) : ''}
        ${row(step >= 2, '심사', app.submittedAt && closed ? '진행 중' : /* 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */ '')}
        ${row(!!app.result, '선정 발표',
          app.result ? (app.result === 'won' ? '선정 · ' : '미선정 · ') + esc(app.resultAt || '')
            : `<button class="app-log-btn" data-mark-won="${esc(app.id)}">선정</button>
               <button class="app-log-btn" data-mark-lost="${esc(app.id)}">미선정</button>`)}
      </ul>
      ${appLogLinkHtml(sch)}
    </div>`;
}

/* 신청 내역 줄의 맨 아래 단추 — 이름은 sourceLink(sch, 'applog') 한 곳 (2026-10-03 · 원문 링크 정직성).
   🔴 목록 주소밖에 못 찾은 공고는 '원문'이라고 말하지 않는다 — 눌러 보면 게시판 목록이 열리는데
      원문이라고 적어 두면 거짓말이 된다(원칙 8-1). 층2(재단 홈페이지)도 같다 — 예전엔 여기만
      `program`·`#n-` 둘만 보고 재단 홈페이지를 '공고 원문 보기'라 불렀다(상세 시트는 '재단 홈페이지').
   열 주소가 없으면(또는 안전하지 않으면) 앱 안의 공고 상세를 연다. */
function appLogLinkHtml(sch) {
  const link = sourceLink(sch, 'applog');
  const href = safeUrl(link.href);
  return href
    ? `<a class="app-log-more" href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a>`
    : `<button class="app-log-more" data-detail="${esc(sch.id)}">공고 상세 보기</button>`;
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
  /* 🔴 토스트의 '실행 취소'는 **한 번 지나가면 끝**이다 — 다른 화면으로 넘어가거나
     잠깐 한눈판 사이에 사라진다. 그래서 지운 기록을 휴지통에도 함께 담는다
     (2026-09-11 개발자 지시). 두 길은 서로를 대신하지 않는다:
       · 토스트  = 방금 잘못 눌렀을 때 그 자리에서 되돌리기
       · 휴지통  = 며칠 뒤에야 알아차렸을 때 찾아가 되살리기 */
  const when = Date.now();
  removed.forEach((r) => state.trash.push({ at: r.at, app: r.app, deletedAt: when }));
  saveState();
  /* 되돌릴 때 **원래 자리로** 넣는다 — 뒤에 붙이면 목록 순서가 바뀌어
     학생이 "지웠다 살렸더니 딴 데 가 있네" 하고 또 헷갈린다. */
  undoBuffer = removed.slice().sort((x, y) => x.at - y.at);
  renderApplications();
  renderHome();
  toast(`${removed.length}건 삭제`, {
    label: '실행 취소',
    run: () => {
      for (const r of undoBuffer) state.applications.splice(r.at, 0, r.app);
      /* 되살린 기록은 휴지통에서 뺀다 — 안 그러면 목록에도 있고 휴지통에도 있는
         같은 기록이 둘이 되어, 나중에 휴지통에서 또 되살리면 중복으로 들어간다. */
      const back = new Set(undoBuffer.map((r) => r.app && r.app.id));
      state.trash = state.trash.filter((t) => !(t.deletedAt === when && back.has(t.app && t.app.id)));
      undoBuffer = null;
      saveState();
      renderApplications();
      renderHome();
      toast('되살렸어요');
    },
  });
}

/* 🔴 밀어서 삭제는 걷어냈다 (2026-09-01 개발자 지시: "오류가 자꾸 먹어서").
   세 번을 고쳤는데도 계속 사고를 냈다 — 스칠 때 삭제가 뜨고, 빨간 판이 패널 위를
   덮어 신청 기록이 지워지고, 누름이 삼켜졌다. 원인이 손짓 판정 하나가 아니라
   "보이지 않는 것이 화면 위에 겹쳐 있다"는 구조라 고칠 때마다 다른 자리가 터졌다.
   지우는 길은 이미 하나 더 있다: 오른쪽 위 '선택' → 체크 → '삭제 n건'.
   그쪽은 눈에 보이고, 여러 건을 한 번에 지우고, 실행 취소도 같이 준다.
   되살리려면 이 자리에 enableRowSwipe 를 다시 두는 것이 아니라, 먼저
   '안 보이는 것이 위를 덮지 않는 구조'부터 만들 것. */

/* ============================================================
   달력 보기 · 보관함 (2026-09-07 · 노션 UI-21)

   설계 근거는 `docs/designs/calendar-and-save.md`. 요약하면 세 가지다:
   ① **맞춤이 없으면 달력은 그릴 수가 없다.** 전체 공고를 다 찍으면 9월 11일 한 칸에
      28건이 몰려 무너진다. 그래서 상시로 찍는 것은 **신청·저장한 공고뿐**이고,
      나머지는 날짜를 눌렀을 때만 펼친다(개발자 지시 4번).
   ② **층1과 층2를 섞지 않는다.** 그날 마감되는 28건 중 26건은 한국장학재단 목록이라
      자격 판정이 없다. 한 목록에 쏟으면 학생이 그것도 앱이 추천한 것으로 읽는다.
   ③ **없는 날짜를 지어내지 않는다.** 발표일은 원문에 있을 때만 찍고, 없으면
      '발표 대기'라고 상태로만 말한다.
   🔴 판정은 새로 만들지 않는다 — 마감은 `dday`, 자격은 `evaluateFor`·`fitDetailFor`
      그대로다. 여기에 규칙을 한 벌 더 두면 달력과 알림이 다른 날을 말한다.
   ============================================================ */

let calMode = false;      // 신청 내역이 목록/달력 중 무엇을 보이는가
let calCursor = null;     // 보고 있는 달 (그 달 1일 · null이면 이번 달)
let calPicked = null;     // 눌러서 펼친 날짜 'YYYY-MM-DD'

/* 🔴 `toISOString()` 을 쓰지 말 것 — 그것은 UTC라 한국 시간 아침에 **하루 전 날짜**가 된다.
   달력은 날짜가 전부인 화면이라 하루가 밀리면 통째로 틀린다. */
function isoOf(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function calMonthStart() {
  if (calCursor) return calCursor;
  const t = todayStart();
  return new Date(t.getFullYear(), t.getMonth(), 1);
}

/* 🔴 **한 번 그릴 때 목록은 한 번만 만든다** (2026-09-07 코드 리뷰).
   `findSch` 는 부를 때마다 `allScholarships()` 를 새로 만들고, 그 안에서 재단 112곳의
   원문 칸을 매번 다시 읽는다. 달력 한 번에 그것이 160번 돌고 있었다.
   그리는 함수들이 이 꾸러미를 만들어 **서로 넘겨 쓴다.** */
function calContext() {
  const all = allScholarships();
  const byId = new Map(all.map((s) => [s.id, s]));
  const ids = new Set();
  state.applications.forEach((a) => ids.add(a.id));
  state.saved.forEach((s) => ids.add(s.id));
  const mine = [...ids].map((id) => byId.get(id) || (isActivityId(id) ? findSaveTarget(id) : null)).filter(Boolean);   // 저장한 대외활동도 '내 공고'(2026-10-02)
  return { all, byId, mine };
}
/** 내 공고 = 신청한 것 + 저장한 것. 달력에 상시로 찍히는 것은 이것뿐이다. */
function myCalendarScholarships() {
  return calContext().mine;
}

/** 결과를 기다리는 중인가 — **신청한 공고만** 발표를 기다린다.
    🔴 저장만 해 둔 공고를 '발표 대기'로 두면 안 된다 (2026-09-07 코드 리뷰).
       신청한 적이 없으니 발표될 결과도 없는데, 마감이 지나는 순간 영영
       '발표 대기'로 남아 보관함의 '이미 마감된 저장 공고'와 서로 다른 말을 한다.
    결과를 기록하면(선정/미선정) 기다림이 끝난다 — 개발자 지시 4-4 재검토 그대로. */
function calAwaiting(id) {
  const app = state.applications.find((a) => a.id === id);
  return !!app && !app.result;
}

/* 점의 종류는 **둘뿐**이다 — 마감(파랑) · 발표(빨강).
   ⚠️ 2026-09-07 개발자 지시로 발표를 반달에서 **마감과 같은 모양의 빨간 점**으로 바꿨다.
      그래서 이 둘은 **색으로만 갈린다** — 색각 이상이 있는 학생에게는 같아 보인다.
      메우는 자리는 둘이다: 범례, 그리고 날짜를 열었을 때 줄이 말하는 상태
      ('발표 예정' · '접수 마감 · 결과 대기'). 점만으로 다 말하려 하지 말 것. */
/* 보관함이 '마감 임박 n건'을 셀 때 쓰는 기준. 달력은 이제 이것으로 색을 가르지 않는다. */
const CAL_SOON_DAYS = 3;

/** 한 달치 점을 모은다 → { 'YYYY-MM-DD': [{ kind, id }] }
    `mine` 을 받으면 목록을 다시 만들지 않는다(위 calContext 주석). */
function calMarks(monthStart, mine) {
  const ym = isoOf(monthStart).slice(0, 7);
  const marks = {};
  const put = (date, kind, id) => {
    if (!date || String(date).slice(0, 7) !== ym) return;
    (marks[date] = marks[date] || []).push({ kind, id });
  };
  for (const sch of (mine || myCalendarScholarships())) {
    const waiting = calAwaiting(sch.id);
    if (sch.deadline) {
      const d = dday(sch.deadline);
      /* 🔴 마감일 자리에는 **늘 '마감' 점**이다 (2026-09-07 개발자 지적:
         "발표대기는 뭐야? 그냥 발표일로 고정하면 안돼?"). 맞는 지적이다 —
         그날은 마감일이지 발표일이 아닌데 거기에 발표 뜻의 점을 찍으면 헷갈린다.
         🔴 그래도 **지우지는 않는다**(개발자 지시 4-4): 신청한 공고는 마감 뒤가
            진짜 시작이라, 마감이 지나도 점은 그대로 남아 학생이 찾아올 자리가 된다.
         🔴 마감 임박(D-3)도 색으로 가르지 않는다 — 홈에서 이미 확인할 수 있다. */
      put(sch.deadline, 'mine', sch.id);
    }
    /* 발표는 **원문에서 읽은 진짜 발표일에만** 찍는다 (실측 45건 중 4건).
       🔴 모르는 발표일을 마감일 자리로 옮겨 적지 않는다 — 그것이 '발표 대기' 였고,
          학생에게는 마감일에 발표 점이 찍힌 것으로 보였다.
       결과를 이미 기록했으면 기다릴 것이 없으므로 찍지 않는다. */
    if (sch.announceDate && waiting) put(sch.announceDate, 'wait', sch.id);
    /* 🔴 접수 시작일은 **달력에 찍지 않는다** (2026-09-07 개발자 지시 — 표시를 둘로 줄임).
       달력에 남는 것은 '내가 무엇을 해야 하는 날'뿐이다: 마감과 발표.
       접수 시작은 그날 학생이 할 일이 없고(마감 전에 내면 된다), 아직 안 열린 공고라는
       사실은 상세 시트의 「접수 · 기간」 줄(applySectionHtml)이 그대로 말한다. */
  }
  return marks;
}

/** 그날 마감되는 공고 전부 (내 공고는 뺀다 — 위에 이미 따로 나온다) */
function calOthersOn(iso, ctx) {
  const c = ctx || calContext();
  const mine = new Set(c.mine.map((s) => s.id));
  return c.all.filter((s) => s.deadline === iso && !mine.has(s.id));
}

const CAL_DOW = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_KIND_ORDER = { wait: 0, mine: 1 };
const CAL_DOTS_MAX = 3;

/* 달력 장학금 · 대외활동 칩 (2026-11-21 개발자 「신청내역에서 대외활동과 장학금이 구분되게」) — 보관함과 같은 kindFilter ·
   점·이 달 숫자·날짜 목록이 고른 쪽만 · 대외활동만 볼 때는 「이날 마감되는 공고」(장학)도 뺀다 · 고른 칩은 앱을 닫을 때까지(기기에 저장하지 않는다 — 보관함 칩과 같다) */
let calKind = 'all';
const CAL_KIND_NOUN = { all: '공고', sch: '장학금', act: '대외활동' };   // 「이 달에는 내 ○○이 없어요」 — 셋 다 받침이 있어 「이」
function calMineKind(ctx) {
  const kf = kindFilter(ctx.mine, calKind, 'cal-kind', { counts: false });
  calKind = kf.kind;
  return kf;
}
function renderCalendar() {
  const box = $('#apps-calendar');
  if (!box) return;
  const ms = calMonthStart();
  const ctx = calContext();
  const kf = calMineKind(ctx);
  const marks = calMarks(ms, kf.list);
  const today = isoOf(todayStart());
  const days = new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate();
  const lead = new Date(ms.getFullYear(), ms.getMonth(), 1).getDay();

  /* 🔴 **점이 아니라 공고를 센다** (2026-09-07 코드 리뷰). 한 공고가 마감일과 발표일에
     각각 점을 가지면 '내 공고 2건'이 된다 — 학생은 하나만 담았는데 둘이라고 말하는 셈이다. */
  const idsOf = (pick) => new Set(Object.values(marks)
    .flatMap((list) => list.filter(pick).map((m) => m.id)));
  const mineCount = idsOf(() => true).size;
  const waitCount = idsOf((m) => m.kind === 'wait').size;

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell cal-pad" aria-hidden="true"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = isoOf(new Date(ms.getFullYear(), ms.getMonth(), d));
    const list = (marks[iso] || []).slice()
      .sort((a, b) => CAL_KIND_ORDER[a.kind] - CAL_KIND_ORDER[b.kind]);
    const shown = list.slice(0, CAL_DOTS_MAX);
    const more = list.length - shown.length;
    const dayIds = new Set(list.map((m) => m.id)).size;   // 안내 문구도 공고 수로 센다
    /* 셀은 늘 누를 수 있다 — 점이 없어도 '그날 마감되는 공고'를 볼 수 있어야 한다 */
    cells += `<button class="cal-cell${iso === today ? ' cal-today' : ''}${iso === calPicked ? ' cal-picked' : ''}"
        data-cal-day="${iso}" aria-pressed="${iso === calPicked}"
        aria-label="${ms.getMonth() + 1}월 ${d}일${dayIds ? ` · 내 공고 ${dayIds}건` : ''}">
        <span class="cal-num">${d}</span>
        <span class="cal-dots">${shown.map((m) => `<i class="cal-dot cal-dot-${m.kind}"></i>`).join('')}${more > 0 ? `<em class="cal-more">+${more}</em>` : ''}</span>
      </button>`;
  }

  box.innerHTML = `${kf.row}
    <div class="cal-head">
      <button class="cal-nav" data-cal-move="-1" aria-label="이전 달">‹</button>
      <span class="cal-month">${ms.getFullYear()}년 ${ms.getMonth() + 1}월</span>
      <button class="cal-nav" data-cal-move="1" aria-label="다음 달">›</button>
    </div>
    ${/* 칩으로 거른 때는 이름도 그쪽으로 — 「이 달에는 내 공고가 없어요」는 거른 다른 쪽이 있으면 틀린 말이 된다(리뷰 2026-11-21) */ ''}
    <p class="cal-sum">${mineCount ? `내 ${CAL_KIND_NOUN[kf.kind]} ${mineCount}건${waitCount ? ` · 발표 ${waitCount}건` : ''}` : `이 달에는 내 ${CAL_KIND_NOUN[kf.kind]}이 없어요`}</p>
    <div class="cal-dow">${CAL_DOW.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    ${/* 🔴 범례는 **두 종류**다 (2026-09-07 개발자 지시: "간단하고 명확히").
         접수 시작과 마감 임박을 차례로 뺐다 — 전자는 그날 할 일이 없고, 후자는
         홈에서 이미 확인할 수 있다. 여기에 종류를 다시 늘리지 말 것. */ ''}
    <div class="cal-legend">
      <span><i class="cal-dot cal-dot-mine"></i>마감</span>
      <span><i class="cal-dot cal-dot-wait"></i>발표</span>
    </div>
    <div id="cal-day" class="cal-day">${calPicked ? calDayHtml(calPicked) : ''}</div>`;
}

/** 공고 한 줄 — 달력 아래 목록에 쓴다. 누르면 상세 시트로 간다(개발자 지시 5번). */
function calRowHtml(sch, { badge = true, save = false } = {}) {
  const d = sch.deadline ? dday(sch.deadline) : null;
  let mark = '';
  if (badge) {
    /* 🔴 판정을 새로 만들지 않는다 — 카드·상세와 **같은 함수**를 쓴다.
       층2(KOSAF)는 evaluateFor 가 이미 '아직 못 읽음'으로 돌려주므로 여기서
       따로 막을 필요가 없다(그 정직함이 한 곳에 있다는 뜻이다). */
    const result = evaluateFor(sch, state.profile);
    mark = fitBadgeHtml(fitScore(sch, result, state.profile), fitDetailFor(sch, state.profile));
  }
  /* 갈래 칩 (2026-11-21 개발자 「공고보관함과 신청내역에서 대외활동과 장학금이 구분되게」) — 카드와 같은 kindChipHtml 한 곳 ·
     활동은 피드 모양 원본(activityItem)으로 갈래를 읽는다(act: 줄은 늘 활동 칩 — 글에 kind 가 없어도 「장학」으로 안 읽히게) · 칩이 종류를 말하므로 활동 둘째 줄은 주최만(종류를 두 번 적지 않는다) */
  const act = isActivityId(sch.id) ? (activityItem(sch.id.slice(4)) || null) : null;
  const sub = isActivityId(sch.id) ? (act ? activityHostLine(act) : '')
    : [amountLine(sch).text.replace(/^금액 · /, ''), knownValue(sch.headcount)].filter(Boolean).join(' · ');
  const row = `<button class="cal-row" data-detail="${esc(sch.id)}">
      <span class="cal-row-top">${kindChipHtml(act ? { ...act, activity: true } : sch)}${mark}${d ? `<span class="badge badge-dday ${d.cls}">${d.label}</span>` : ''}${sch.formId ? '<span class="badge badge-form">앱에서 작성</span>' : ''}</span>
      <span class="cal-row-name">${esc(sch.name)}</span>
      ${sub ? `<span class="cal-row-sub">${esc(sub)}</span>` : ''}
    </button>`;
  /* 보관함에서는 **여기서 바로 해제**할 수 있어야 한다 — 담는 곳과 빼는 곳이 다르면
     학생이 뺄 방법을 못 찾는다. 카드와 같은 이유로 단추는 줄 **바깥**에 둔다. */
  return save ? `<div class="cal-row-wrap">${saveBtnHtml(sch.id)}${row}</div>` : row;
}

/** 하루를 눌렀을 때 아래에 펼치는 목록. 🔴 시트를 띄우지 않는다 — 닫을 때 스크롤이 튄다. */
function calDayHtml(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const ctx = calContext();
  const mineAll = calMineKind(ctx).list;
  const marks = (calMarks(new Date(y, m - 1, 1), mineAll)[iso] || []);
  const seen = new Set();
  const mineRows = marks.map((k) => {
    if (seen.has(k.id)) return '';
    seen.add(k.id);
    const sch = mineAll.find((s) => s.id === k.id);
    if (!sch) return '';
    /* 🔴 달력에서 뺀 '결과 기다리는 중'을 **여기서** 말한다 (2026-09-07).
       점의 종류를 줄이는 것과 정보를 없애는 것은 다르다 — 점은 둘로 두되,
       날짜를 열었을 때는 그 공고가 지금 어떤 상태인지 한 줄로 밝힌다. */
    const why = k.kind === 'wait' ? '발표 예정'
      : (calAwaiting(sch.id) && sch.deadline && dday(sch.deadline).days < 0)
        ? '접수 마감 · 결과 대기'   // 발표일을 모르면 말하지 않는다(2026-11-15 · 예전 「(발표일은 원문 확인)」)
        : '접수 마감';
    return `<p class="cal-why">${why}</p>` + calRowHtml(sch, { badge: false });
  }).join('');

  const others = calKind === 'act' ? [] : calOthersOn(iso, ctx);   // 대외활동만 볼 때는 장학 공고 목록을 안 붙인다
  const layer1 = others.filter((s) => s.sourceKind !== 'kosaf');
  const layer2 = others.filter((s) => s.sourceKind === 'kosaf');

  return `
    <div class="cal-day-head">
      <h4>${m}월 ${d}일</h4>
      <button class="cal-day-close" data-cal-day="">닫기</button>
    </div>
    ${mineRows ? `<h5 class="cal-sec">내 공고</h5>${mineRows}` : ''}
    ${layer1.length ? `<h5 class="cal-sec">이날 마감되는 공고 ${layer1.length}건</h5>${layer1.map((s) => calRowHtml(s)).join('')}` : ''}
    ${/* 🔴 층2는 **접어 둔다.** 하루에 26건까지 들어오는 데다 자격 판정이 없어,
         층1과 한 목록에 쏟으면 학생이 그것도 앱이 추천한 것으로 읽는다. */ ''}
    ${layer2.length ? `<details class="cal-kosaf">
        <summary>한국장학재단 목록 ${layer2.length}건</summary>
        <p class="cal-note">${/* 2026-11-21 개발자 지시로 줄임(학생이 읽지 않는 안내) */ ''}자격은 재단 홈페이지에서 확인하세요.</p>
        ${layer2.map((s) => calRowHtml(s, { badge: false })).join('')}
      </details>` : ''}
    ${/* 거른 때는 거른 쪽만 말한다 — 대외활동만 볼 때는 장학 목록을 안 붙이므로 「내 대외활동」(리뷰 2026-11-21) */ ''}
    ${!mineRows && !layer1.length && !layer2.length ? `<p class="empty">${calKind === 'act' ? '이날 마감되는 내 대외활동이 없어요' : calKind === 'sch' ? '이날 마감되는 장학금이 없어요' : '이날 마감되는 공고가 없어요'}</p>` : ''}`;
}
