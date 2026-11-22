/* app-events.js — 이벤트 연결(버튼·화면 전환·입력 묶기) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
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
      /* 🔴 화면에 적힌 주소를 그대로 그림 주소로 넣지 않는다 — 적는 쪽(homeNewsHtml)과 같은 규칙 SCHOOL_PHOTO_RE(우리 학교 사진 파일 꼴)만 통과
         (CodeQL 「DOM text reinterpreted as HTML」 high #63 · 2026-11-19 app.js 에서 떼어 올 때 새 경보) */
      if (fb && SCHOOL_PHOTO_RE.test(fb)) { if (ff && PHOTO_FOCUS_RE.test(ff)) img.style.objectPosition = ff; img.src = fb; } else img.remove();
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

  /* 히어로 안내 줄을 누르면 그 줄의 목록 — 수령 가능액 줄은 예전처럼 '금액 상세'. 배선은 app-mascot.js(줄·마스코트·저절로 넘어감이 같은 상태 하나를 쓴다) */

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
    if (go === 'postreq') { if (typeof openPostReq === 'function') openPostReq(); return; }
    if (go === 'adinq') { if (typeof openAdInquiry === 'function') openAdInquiry(); return; }
    if (go.startsWith('link:')) {
      /* 학교 사이트는 새 탭으로 — 로그인은 학생이 그 사이트에서 직접 한다(운영 원칙 9 · 우리는 주소만 넘긴다) */
      const url = typeof schoolLinkFor === 'function' && schoolLinkFor(state.profile, go.slice(5));
      if (url) window.open(url, '_blank', 'noopener');
      return;
    }
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
    const ck = e.target.closest('[data-cal-kind]');
    if (ck) {
      if (ck.dataset.calKind !== calKind) {
        calKind = ck.dataset.calKind;
        renderCalendar();
        /* 다시 그리면 누른 칩이 새로 만들어져 초점이 문서 맨 위로 간다 — 화면 낭독기 사용자가 자리를 잃는다(리뷰 2026-11-21) */
        const again = document.querySelector(`#apps-calendar [data-cal-kind="${calKind}"]`);
        if (again) again.focus();
      }
      return;
    }
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
  /* '교내' 칸의 게시판 글 카드 → 상세 시트 (2026-11-20 · 원문으로 바로 나가지 않는다) */
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-board]');
    if (card) openBoardDetail(card.dataset.board);
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
  });
  /* 쓰던 신청서를 치는 동안 적어 둔다 (2026-09-09 · 이어보기 3겹).
     🔴 시트 **하나에 위임**한다 — 시트는 innerHTML 이 계속 갈리므로 그릴 때마다 걸면
        리스너가 쌓여 새는 자리가 된다. */
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
    const again = $(`#my-saved [data-saved-kind="${savedKind}"]`);   // 누른 칩에 초점을 돌려준다(달력 칩과 같은 까닭 · 리뷰 2026-11-21)
    if (again) again.focus();
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
