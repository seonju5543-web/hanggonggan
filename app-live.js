/* app-live.js — 실시간 공고 구역(공고 파일 받기·학과·등록금·원문 링크·층2·학교 사진) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
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
/* 여러 줄로 둔다 — verify/what-shows.mjs 의 takeFn 은 줄 머리의 `}` 까지 가져간다(formPdfsFor 와 같은 이유) */
function formPagesFor(sch) {
  return ((sch && formPagesIndex[sch.id]) || []).filter((f) => f && f.file);
}
/* 서식 쪽도 빈칸을 찾았으면 「양식 채우기」(formfill.js · 2026-11-18) — 줄 꼴은 PDF 줄 한 벌(pdfRowHtml) · 이름은 로봇이 붙인 「공고문 안 신청서 서식 (n~m쪽)」(떼어 낸 쪽이라 원래 파일 이름이 없다) */
function formPageRowsHtml(sch) {
  return formPagesFor(sch).map((f) => pdfRowHtml({ href: `data/form-pages/${f.file}`, name: f.name || '공고문 안 신청서 서식', slot: f.file })).join('');
}
/* 지원문서 작성 화면 머리 — 층1은 신청서 첨부(isApplicationForm · data.js 한 곳 + PDF 로 올라온 신청서), 층2(10-13 ①)는 첨부 전부를 **선발 공고문**이라 부른다(CLAUDE.md 「층2」).
   🔴 줄 순서는 2026-11-20 승인 시안(docs/designs/all-docs-pdf.md): PDF 줄(첨부 차례 · attachPdfRowsHtml) → 공고문에서 뗀 서식 쪽 → 올린 원본(맨 밑).
      목록 밑 회색 안내 문단은 없다(개발자 "ㅇㅇ 지워") · 신청 준비 시트·상세 시트가 같은 함수로 그린다(베끼면 한쪽만 PDF 를 모른다). */
function prepOriginalsHtml(sch) {
  const kosaf = sch.sourceKind === 'kosaf';
  const formNames = new Set(formPdfsFor(sch).map((f) => f.name));
  /* 신청서인가는 attIsForm 한 곳(로봇이 원본 내용으로 가른 roles 가 먼저 · 2026-11-20) + PDF 로 올라온 신청서(사본과 이름이 같은 첨부 — 「원래 PDF 는 두 곳 다」) */
  const atts = (sch.attachments || []).filter((a) => a && !a.bodyImage && (kosaf || attIsForm(sch, a) || formNames.has(a.name)));
  const pdfRows = attachPdfRowsHtml(sch, atts);
  const pageRows = formPageRowsHtml(sch);
  if (!atts.length && !pdfRows && !pageRows) return '';
  const head = kosaf ? '선발 공고문 <span class="channel-tag">재단 원문</span>' : '신청서 양식 <span class="channel-tag">공고 원본</span>';
  return `<h4>${head}</h4>
      <ul class="doc-list">${pdfRows}${pageRows}${atts.map((a) => attachRowHtml(a)).join('')}</ul>`;
}

/* 이 공고에 **공고가 올린 신청서 원본**이 있는가 (2026-11-21 개발자 지시 6-1 — *"사본이 있는데도 불구하고 앱 자체 양식으로 띄우고 있어서"* ·
   *"자체제작문서는 신청양식이 없는 경우에만"*). 신청서 PDF 사본(forms-pdf) · 공고문에서 뗀 서식 쪽(form-pages) · 신청서 첨부(attIsForm — 로봇이 원본 내용으로 가른 것이 먼저)
   가운데 하나라도 있으면 원본이 있는 것이다. 층2 첨부는 재단이 올린 **선발 공고문**이라 신청서로 세지 않는다(서식 쪽을 뗀 것만 센다).
   🔴 「원본이 있다」를 다른 곳에서 새로 세지 말 것 — 신청 버튼(applyTo)·지원문서 연결(formTplIdFor)·what-shows 가 이 한 함수를 쓴다 */
function hasOriginalForm(sch) {
  if (!sch) return false;
  if (formPdfsFor(sch).length || formPagesFor(sch).length) return true;
  return sch.sourceKind !== 'kosaf' && (sch.attachments || []).some((a) => a && !a.bodyImage && attIsForm(sch, a));
}
/* 이 공고에서 쓸 양식 템플릿 id — 공식 양식이 우선, 없으면 준비용 문서.
   🔴 준비용 문서(앱이 만든 지원문서)는 **원본 신청서가 없을 때만**(6-1) — 원본이 있으면 null 이라 신청 버튼이 원본이 놓인 「신청 준비」 시트로 간다.
   🔴 **이미 쓴 글은 뺏지 않는다**(written — 리뷰 2026-11-22): 그 문서로 쓰던 글·다 쓴 문서가 있으면 원본이 (나중에) 생겼어도 그 문서를 돌려준다.
      PDF 사본은 등록 다음 날 새벽에 생긴다 — 첫날 쓰기 시작한 학생의 글이 이튿날 사라지거나 「작성한 양식 문서」가 열리지 않으면 안 된다. 새로 시작하는 길(applyTo)은 written 없이 부른다 */
function formTplIdFor(sch, written) {
  if (typeof FORM_TEMPLATES === 'undefined') return null;
  if (sch.formId && FORM_TEMPLATES[sch.formId]) return sch.formId;
  if (sch.prepFormId && FORM_TEMPLATES[sch.prepFormId] && (written || !hasOriginalForm(sch))) return sch.prepFormId;
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
  /* 아래 칸들 (2026-11-21 개발자 지시 "게시요청 탭, 학교 홈 탭(학교 홈페이지 연결), 종정시 탭, e class 탭, 도서관 탭을 추가").
     게시 요청 = 기관 담당자 화면(post-request.js · 담당자 로그인 따로) · 나머지 넷 = 그 학교 사이트를 새 탭으로(school-links.js 표 · 확인한 주소만).
     🔴 주소가 없는 학교는 그 칸을 **안 그린다**(renderHome) — 지어낸 주소로 보내지 않는다 · 로그인은 학생이 그 사이트에서 직접 한다(운영 원칙 9). */
  { go: 'postreq', name: '게시 요청', tone: 'violet',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="18" height="24" rx="2.5" fill="#fff" stroke="#cfc6b6" stroke-width="1.2"/><path d="M9 10h10M9 14.5h10M9 19h6" stroke="#b9a9e0" stroke-width="2" stroke-linecap="round"/><circle cx="23.5" cy="23.5" r="6" fill="#7a5cc4"/><path d="M23.5 20.5v6M20.5 23.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>' },
  /* 광고 문의 (2026-11-21 개발자 지시 "광고 문의 탭도 함께 추가") — 회사·기관용 · 적은 내용을 담아 메일 앱을 연다(ad-inquiry.js) */
  { go: 'adinq', name: '광고 문의', tone: 'gold',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="7" width="25" height="18" rx="2.5" fill="#fff" stroke="#cfc6b6" stroke-width="1.2"/><path d="M4.5 8.5L16 17l11.5-8.5" fill="none" stroke="#d9952a" stroke-width="2" stroke-linejoin="round"/><circle cx="24.5" cy="23.5" r="5.5" fill="#f1b03b"/><path d="M24.5 20.8v3.4M24.5 26.1v.2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>' },
  { go: 'link:home', name: '학교 홈', tone: 'green', link: 'home',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15L16 5l12 10" fill="none" stroke="#c4553f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 13.5V27h18V13.5L16 6z" fill="#f1c56c"/><rect x="13" y="19" width="6" height="8" rx="1" fill="#8a5a2b"/><circle cx="16" cy="13.5" r="2.2" fill="#fff"/></svg>' },
  { go: 'link:portal', name: '종정시', tone: 'navy', link: 'portal',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="6" width="25" height="17" rx="2.5" fill="#55709f"/><rect x="6" y="8.5" width="20" height="12" rx="1" fill="#e9eef7"/><path d="M9 12h8M9 15.5h12M9 18h5" stroke="#6f87ba" stroke-width="1.6" stroke-linecap="round"/><path d="M12 27h8M16 23v4" stroke="#3f5788" stroke-width="2.2" stroke-linecap="round"/></svg>' },
  { go: 'link:eclass', name: 'e-class', tone: 'orange', link: 'eclass',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 6L2.5 12.5 16 19l13.5-6.5z" fill="#f08a3c"/><path d="M8 15.5v6c0 2 3.6 3.8 8 3.8s8-1.8 8-3.8v-6L16 19z" fill="#c4651f"/><path d="M27 13.5v7" stroke="#8a4a1f" stroke-width="1.8" stroke-linecap="round"/><circle cx="27" cy="21.5" r="1.6" fill="#f1c56c"/></svg>' },
  { go: 'link:library', name: '도서관', tone: 'red', link: 'library',
    svg: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="5" height="21" rx="1" fill="#dd5d4b"/><rect x="10" y="9" width="5" height="18" rx="1" fill="#f1c56c"/><rect x="16" y="6" width="5" height="21" rx="1" fill="#6f87ba"/><path d="M22.5 9.5l4.6-1.2 4 17.2-4.6 1.2z" fill="#7a5cc4" transform="translate(-2 0)"/><path d="M3 27.5h26" stroke="#5a2a22" stroke-width="2" stroke-linecap="round"/></svg>' },
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
/* 목록을 받아 왔는가 — 못 받았을 때만 홈 맨 아래에 알린다. dataFetchedAt 은 **이 폰이 받아 온 시각**이다.
   (받은 시각·로봇 발행일을 적던 두 줄은 2026-11-21 개발자 지시로 지웠다) */
let dataFetchedAt = null;

function renderHomeUpdated() {
  const el = $('#home-updated');
  if (!el) return;
  if (!dataFetchedAt) {
    /* 받아 온 적이 없다 — 저장된 목록을 최신인 것처럼 보이면 안 된다 */
    el.textContent = '장학금 목록을 아직 받지 못했어요 · 인터넷 연결을 확인해 주세요';
    return;
  }
  /* 🔴 받아 왔으면 아무것도 적지 않는다 — 「장학금 목록 마지막 확인 …」「공고 갱신 …」 두 줄은 2026-11-21 개발자 지시로 없앴다
     ('학생이 읽지 않는 앱 사정'). 못 받았을 때의 안내(위)만 남긴다 — 그건 학생이 할 일(연결 확인)이 있다 */
  el.textContent = '';
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
    .then((j) => { tidyData(j); if (j && j.items && typeof j.items === 'object') formsPdfIndex = j; })   // 이름을 공고 첨부와 같은 다듬기로(엔터티·겹친 띄어쓰기 · file 은 안 건드린다) — 줄 짝짓기가 이름으로 한다
    .catch(() => {});
}
/* 여러 줄로 둔다 — verify/what-shows.mjs 의 takeFn 은 줄 머리의 `}` 까지 가져가서, 한 줄 함수면 뒤의 선언까지 끌고 간다 */
function formPdfsFor(sch) {
  return (sch && formsPdfIndex.items && formsPdfIndex.items[sch.id]) || [];
}
/* 공고문·안내문 PDF 사본 색인 (2026-11-20 · collector/doc-pdf.mjs · docs/designs/all-docs-pdf.md) — 신청서가 아닌 한글·워드 첨부(층2 재단 공고문은 전부)를
   로봇이 글자를 대조해 PDF 로 바꿔 둔 것. { items: { <공고 id>: [{ file, name, pages, bytes }] } }. 못 받으면 빈 채로 — PDF 줄만 없고 맨 밑 원본 목록은 그대로다. */
let docsPdfIndex = { items: {} };
function loadDocsPdfIndex() {
  return fetch('data/docs-pdf/index.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { tidyData(j); if (j && j.items && typeof j.items === 'object') docsPdfIndex = j; })   // 신청서 색인과 같은 다듬기
    .catch(() => {});
}
function docPdfsFor(sch) {
  return (sch && docsPdfIndex.items && docsPdfIndex.items[sch.id]) || [];
}
/* 첨부가 신청서 칸에 서는가 — 로봇이 **원본 내용**을 읽고 이름과 다르게 가른 것(색인 roles · collector/attachment-text attachDecision)이 먼저,
   없으면 이름 규칙(data.js isApplicationForm). 2026-11-20 — 이름만 보면 속이 안내문인 「…신청서.hwp」가 양식 칸에 서고 「[서식] 1~3.hwp」는 안 섰다 */
function attIsForm(sch, a) {
  const r = sch && formsPdfIndex.roles && formsPdfIndex.roles[sch.id];
  const v = r && a && r[a.name];
  return v ? v === 'form' : isApplicationForm(a);
}
/* 첨부 한 줄 — 아이콘(확장자) · 이름 · 오른쪽 동작. 이름 밑 작은 글씨(출처·크기)는 2026-11-20 승인 시안에서 뺐다(meta 를 주는 곳이 없다) */
function attachRowHtml(a, { meta = '', go = '↓' } = {}) {
  const ext = (String((a && a.name) || '').match(/\.(\w{2,5})$/) || [, ''])[1].toUpperCase();
  return `<li class="att att-row"><span class="att-ic att-ic-${esc(ext.toLowerCase())}">${esc(ext || '파일')}</span><span class="att-t">${attachmentLinkHtml(a)}${meta ? `<span class="att-m">${esc(meta)}</span>` : ''}</span><span class="att-go">${esc(go)}</span></li>`;
}
/* PDF 줄 한 벌 (2026-11-20 승인 시안 · docs/designs/all-docs-pdf.md) — 신청서 사본·공고문 사본·원래 PDF·공고문에서 뗀 서식 쪽이 모두 이 꼴이다.
   🔴 이름은 첨부 이름 그대로(엔터티·공백만 — attachmentLinkHtml 과 같은 다듬기) · 이름 밑 작은 글씨 없음(개발자 "파일명은 그냥 원래대로 냅두고 밑의 회색글씨는 다 지워") ·
      「열기 ›」 · 새 탭(폰의 PDF 보기 — (가) 결정). slot 이 있으면 밑에 「양식 채우기」 자리(li.fill-slot — formfill.js attachFormFillButtons 가 빈칸을 찾은 파일에만 채운다) */
function pdfRowHtml({ href, name, slot = '' }) {
  const nm = unent(String(name || '')).replace(/\s+/g, ' ').trim() || '첨부 파일';
  return `<li class="att att-row att-row-new"><span class="att-ic att-ic-pdf">PDF</span><span class="att-t"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(nm)}</a></span><span class="att-go">열기 ›</span></li>${slot ? `<li class="fill-slot" data-file="${esc(slot)}" hidden></li>` : ''}`;
}
/* 첨부 목록의 PDF 줄 — **첨부 차례대로**: 신청서 사본(data/forms-pdf · 「양식 채우기」 자리) · 공고문 사본(data/docs-pdf) · 원래 PDF(원래 주소 · 안전한 주소만).
   🔴 짝은 첨부 이름으로만 짓는다(다른 첨부의 PDF 를 붙이지 않는다) · 같은 이름이 두 줄로 실린 첨부는 PDF 줄 하나 · 사본이 없으면 줄이 없다(지어내지 않는다).
   상세 시트(장학·재단·활동)·지원문서 머리·신청 준비 시트가 이 한 함수를 쓴다 — 올린 원본 목록은 각자 맨 밑에 그대로 둔다(원래 PDF 도 두 곳 다 · 개발자 11-20). */
function attachPdfRowsHtml(sch, atts) {
  const forms = formPdfsFor(sch);
  const docs = docPdfsFor(sch);
  const seen = new Set();
  return (atts || []).filter((a) => a && !a.bodyImage).map((a) => {
    const name = String(a.name || '');
    if (seen.has(name)) return '';
    seen.add(name);
    const f = forms.find((x) => x.name === name);
    if (f) return pdfRowHtml({ href: `data/forms-pdf/${f.file}`, name, slot: f.file });
    const d = docs.find((x) => x.name === name);
    if (d) return pdfRowHtml({ href: `data/docs-pdf/${d.file}`, name });
    const href = /\.pdf(?:\s|$)/i.test(name.trim()) ? safeUrl(a.url) : '';
    return href ? pdfRowHtml({ href, name }) : '';
  }).join('');
}

function loadRegistered() {
  return Promise.all([
    fetch('data/registered.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
    linkChecksWait(),
    /* 유료 카드 읽기 결과(2026-11-15) — 못 받으면 null 이고 그때는 무료 길 값 그대로다(비상망). 받기 실패가 공고 목록을 막지 않는다 */
    fetch('data/card-read.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    /* 관리자가 유료 확인에서 잡힌 줄을 살린 것(2026-11-20) — 못 받으면 유료 결과 그대로 */
    fetch('data/card-read-fixes.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])
    .then(([d, , cardRead, cardFixes]) => {
      tidyData(d); tidyData(cardRead); tidyData(cardFixes);   // 깨진 글자 씻기(2026-11-17) — 받는 순간 한 번
      if (!d) { if (appsData.registered !== 'ok') appsData.registered = 'fail'; return; }   // 한 번 받았으면 다시 받기 실패에도 'ok'(목록은 메모리에 그대로)
      appsData.registered = 'ok';
      /* match-engine publishedList — 유료 확인 전 숨김분을 거르고 유료 결과를 얹는다(알림·서비스워커도 같은 함수 · 2026-11-20).
         옛 엔진이 캐시에서 오면 숨김분은 통째로 안 보인다(안전한 쪽) */
      registeredList = typeof publishedList === 'function' ? publishedList(d.items || [], cardRead, null, cardFixes) : (d.items || []).filter((s) => !s.paidGate);
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
  jobs.push(loadDocsPdfIndex());    // 공고문·안내문 PDF 사본 색인 (2026-11-20)
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
        ...(knownValue(kosafClean(f['문의처'])) ? { contact: knownValue(kosafClean(f['문의처'])) } : {}),   // 재단이 적어 둔 「※ 기관확인필요」는 문의처가 아니다 — 읽는 곳 셋(시트·신청 준비·도우미)을 여기 한 곳에서(2026-11-20 티앤씨재단)
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
function liveNoticesHead() {
  /* ⚠️ 두 토막이 한 줄에 들어가야 한다 — 그려 놓고 재 보니 제목이 한 글자 길어지고 오른쪽
     글이 길어서 **둘 다 두 줄로 꺾였다**(390px). 제목은 옛 길이(11자)로, 오른쪽은 날짜만. */
  /* ⚠️ 제목 아래 설명 한 줄(`.section-sub`)을 2026-10-03 에 붙였다가 **같은 날 개발자 지시로
     걷었다** — 홈 아래 세 구역(학교 게시판 공고 · 우리 학교 소식 · 재단·지자체 새 공고)에
     전부 있었다. 다시 붙이지 말 것. */
  /* 🔴 머리줄 오른쪽 「MM.DD 갱신」·「매일 아침 갱신」은 없앴다(2026-11-21 개발자 지시 — 학생이 읽지 않는 앱 사정). 카드마다 날짜가 있다. 되살리지 말 것 */
  return `<div class="section-head" style="margin-top:4px"><h3>우리 학교 게시판 공고</h3></div>`;
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
    return liveNoticesHead() + (typeof skeletonRows === 'function' ? skeletonRows(3) : '');
  }
  /* 🔴 **상한을 걷었다** (2026-09-12 · UI-16). 8+2 는 이 목록이 '전체' 카드 **아래에**
     얹혀 있던 시절의 자리 다툼 때문이었다 — 제 칸이 생겼으니 학생이 보러 온 것을 잘라서
     보여 줄 이유가 없다(실측: 한국외국어대학교 22건 · 경희대학교 17건). */
  const mine = boardNoticesForMe();
  const head = liveNoticesHead();
  if (!mine.length) {
    return head + `<p class="empty" style="margin-bottom:16px">아직 ${esc(p.school)} 게시판 연결 전이거나 새 공고가 없어요${/* 2026-11-21 개발자 지시로 둘째 줄 지움(학생이 읽지 않는 안내) */ ''}</p>`;
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
  /* o.sheet — 누르면 원문으로 나가지 않고 상세 시트(openBoardDetail)를 연다 (2026-11-20 개발자 지적: 장학금 찾기 '교내' 칸에서
     "카드가 안 열리고 그대로 원문 링크로 들어가지는" 것 — 그 칸의 다른 카드는 전부 시트를 연다). 원문은 시트 맨 아래 「원문」 절이 준다 */
  const tag = o.sheet ? 'button' : 'a';
  const open = o.sheet ? ` type="button" data-board="${esc(n.url || '')}"` : (href ? ` href="${esc(href)}" target="_blank" rel="noopener"` : '');
  return `
    <${tag} class="sch-card notice-card${thumb || sp ? ' has-thumb' : ''}"${open}>
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
      ${/* 2026-11-21 개발자 지시로 「○○ 수집」 날짜를 지움(학생이 읽지 않는 안내) · 남는 글자가 없으면 빈 줄을 그리지 않는다 */ ''}
      ${(() => { const tail = [(n.attachments || []).length ? `첨부 ${(n.attachments || []).length}개` : '', link.label && !o.sheet ? esc(link.label) : ''].filter(Boolean).join(' · '); return tail ? `<p class="sch-provider">${tail}</p>` : ''; })()}
      ${/* 그 글의 사진 썸네일 (2026-10-03 개발자 지시 — 학교 글의 실제 사진). 소식 카드만 opts.thumb 로 넘긴다 · 제목이 이미 글자로 있어 alt 는 비운다(읽기 도구가 두 번 읽지 않게).
           못 받으면(404·오프라인) 그림을 빼고 글자 카드로 돌아간다 — bindEvents 의 error 잡이 · CSP 가 onerror= 를 막는다 */ ''}
      ${thumb ? `<img class="notice-thumb" src="${esc(thumb)}" alt="" loading="lazy" decoding="async" width="72" height="72" />` : ''}
      ${/* 글에 사진이 없으면 학교 대표 사진 (2026-10-03 개발자 지시) — 글의 사진과 같은 자리·같은 모양(같은 img 한 장).
           🔴 사진 위 「학교 사진」 표시는 **개발자 지시로 뺐다**(같은 날 *"학교사진에 '학교사진' 이라는 디스크립션 빼"*) — 다시 붙이지 말 것(관문이 잠근다).
           출처 줄(작가·라이선스 — 열린 라이선스의 표기 의무)은 구역 아래 한 번(schoolNewsHtml) · 학교 사진인지는 클래스(notice-thumb-school)로만 안다 */ ''}
      ${sp ? `<img class="notice-thumb notice-thumb-school" src="${esc(sp.src)}" alt="" loading="lazy" decoding="async" width="72" height="72"${PHOTO_FOCUS_RE.test(sp.focus || '') ? ` style="object-position:${esc(sp.focus)}"` : ''} />` : ''}
    </${tag}>`;
}

/* 게시판 글 상세 시트 — 장학 시트와 같은 머리줄·절(sheetSectionsHtml). 우리가 읽은 것은 제목·기간 토막·첨부·주소뿐이라
   그것만 적는다(원칙 8-1 · 자격 줄이 없으면 「지원 자격」 칸은 안 그린다). 주최를 모르므로 칩은 「장학」 하나 · 윗줄은 카드와 같은 「○○ 게시판」.
   주소는 sourceUrl 로 넘겨 원문 링크 이름·바로잡기가 sourceLink 한 곳을 거친다 */
function openBoardDetail(url) {
  const n = boardNoticesForMe().find((x) => x.url === url);
  if (!n) return;
  if (typeof trackUse === 'function') trackUse('detail', url);
  { const dsh = document.getElementById('detail-sheet'); if (dsh) dsh.dataset.useItem = url; }
  const tSplit = splitTitleDates(unent(n.title));
  const full = n.deadlineHint && !/window\.|dataLayer|function|\)\s*\)/.test(n.deadlineHint) ? hintShort(n.deadlineHint, Infinity) : '';   // 카드와 같은 기간 한 줄(다음 항목 앞에서 끊는다) · 카드의 44자 상한은 풀어 마감 날짜까지 보인다
  /* 다음 한글 항목(「나. 신청방법 …」) 앞에서도 끊는다 — 끊고도 날짜가 남을 때만(「신청 기간 및 방법 가. 신청 기간: …」 은 앞토막에 날짜가 없어 통째로 둔다 · 실데이터 853줄 비교 2026-11-20) */
  const cut = full.split(/\s(?=[가나다라마바사아자차카타파하]\s?\.\s*[가-힣])/)[0];
  const hint = /\d/.test(cut) ? cut : full;
  const sch = {
    id: `board:${url}`, name: tSplit.title, type: '', provider: `${n.school}${n.campus ? ' ' + n.campus : ''} 게시판`,
    eligibility: {}, documents: [], deadline: n.deadline || null, period: hint || tSplit.dates.join(' · '),
    attachments: n.attachments || [], sourceUrl: n.url,
    title: n.title, boardTitle: n.boardTitle,   // 링크가 목록일 때 「목록에서 찾을 제목」은 게시판에 적힌 그대로(sourceLink hint)
  };
  const d = n.deadline ? dday(n.deadline) : null;
  sheetBack = null;   // 돌아갈 곳이 없다 — 내리면 닫힌다
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      ${sheetHeadHtml({ x: sch, d, save: '' })}
      <h3 class="sheet-title">${esc(sch.name)}</h3>
      ${sheetSectionsHtml({ sch, result: evaluateFor(sch, state.profile), fit: 0, fd: null })}
    </div>`;
  openSheetShell();
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
