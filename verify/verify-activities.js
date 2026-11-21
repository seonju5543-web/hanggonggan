/* 대외활동·공모전 탭 (2026-09-25 · 노션 UI-34) — 진짜 브라우저로 누른다.
   무엇을 재나
     ① 아래 탭에 '대외활동'이 있고 누르면 그 화면이 뜬다(다른 탭은 숨는다)
     ② 학교 범위 — 내 학교 글과 전국 글만 보이고 다른 학교 글은 안 보인다(activityForProfile)
     ③ 칩(전체/대외활동/공모전)과 검색이 실제로 거른다 · 탐색 화면의 칩을 건드리지 않는다
     ④ 카드 윗줄이 '종류 · 학교 게시판' 을 말한다 · 전국 글은 host 를 말한다
     ⑤ 받아오기가 실패해도 뼈대가 아니라 '없어요' 로 내려앉는다
   데이터는 **가짜 응답**으로 준다(page.route) — 실제 activities.json 은 오늘 비어 있을 수 있고,
   화면 규칙은 데이터가 있을 때 재야 한다. 판정 함수는 app.js 것을 그대로 실행한다(베끼지 않는다).

   🔴 **PORT= 를 반드시 준다** (8123 은 남의 워크트리일 수 있다 — CLAUDE.md 매 세션 2).
   실행: python3 -m http.server <포트> 를 띄운 뒤  CHROME_PATH=... PORT=<포트> node verify/verify-activities.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.PORT || 8123;

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

/* 마감은 오늘 기준으로 만든다 — 날짜를 박아 두면 달이 바뀌는 순간 '마감' 이 되어 검사가 조용히 뒤집힌다 */
/* 마감 날짜는 **브라우저와 같은 시계**(이 컴퓨터의 현지 날짜)로 만든다 — 앱의 dday() 가 todayStart()(현지 자정)로 재기 때문.
   한국 시간(+9h)으로 만들면 UTC 15시 이후엔 하루가 어긋나 D-5 가 D-6 으로 뜬다(2026-09-29 15:19 UTC 에 실제로 났다). */
const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const FIXTURE = {
  updatedAt: '2026-09-25',
  items: [
    { id: 'act-fixture1', title: '2026 대학생 해외봉사단 모집', url: 'https://dep.hufs.ac.kr/bbs/x/1', kind: '대외활동', field: '봉사', school: '한국외국어대학교', campus: '', foundAt: '2026-09-25', attachments: [{ name: '참가신청서.hwp', url: 'https://dep.hufs.ac.kr/bbs/x/1/f1' }], deadlineHint: '신청기간 : 2026. 10. 1. ~ 10. 15.',
      deadline: iso(5), excerpts: [{ label: '모집기간', text: '2026. 10. 1. ~ 10. 15.' }, { label: '혜택', text: '항공료 전액 지원' }],
      /* 자격 줄 (2026-10-01) — 장학과 같은 엔진이 판정한다: 나이 범위 ✓ */
      eligibilityLines: ['만 19~34세 대한민국 국민'], noticeLines: ['봉사단은 5개국에 파견합니다.'],
      /* 제출 서류·신청서 원본 PDF (2026-10-30) — 로봇이 원문 「제출서류」 절에서 적은 목록 · forms-pdf 색인은 아래 가짜 응답(FORMS_PDF_FIXTURE)이 준다 */
      documents: ['참가신청서 1부', '개인정보 수집·이용 동의서 1부'] },
    /* 마감이 지난 글 — 파일에는 있지만 화면에는 없어야 한다 (2026-09-29) */
    { title: '지난 공모전 — 보이면 안 된다', url: 'https://dep.hufs.ac.kr/bbs/x/6', kind: '공모전', school: '한국외국어대학교', campus: '', foundAt: '2026-09-26', attachments: [], deadline: iso(-3) },
    /* 나이가 확실히 안 맞는 글 — 23살 학생에게 '지원 자격 미달' (적합도순에서 맨 아래).
       ⚠️ 지역 줄(`부산 거주`)로 만들지 말 것 — 엔진은 부모 거주지도 보므로 본인 지역만 달라서는 '모름'이다(틀린 미달 금지) */
    { title: '제3회 장학수기 공모전 공고', url: 'https://dep.hufs.ac.kr/bbs/x/2', kind: '공모전', school: '한국외국어대학교', campus: '', foundAt: '2026-09-24', attachments: [],
      eligibilityLines: ['참가자격 : 만 15세 ~ 만 19세'] },   // ⚠️ '청소년'·'아동' 을 붙이지 말 것 — 도움 받는 사람의 나이로 읽혀 판정하지 않는다(parseAge AGE_OF_OTHERS)
    { title: '경희 아이디어 경진대회', url: 'https://news.khu.ac.kr/x/3', kind: '공모전', school: '경희대학교', campus: '', foundAt: '2026-09-25', attachments: [] },
    { title: '전국 청년 서포터즈 모집', url: 'https://example.org/x/4', kind: '대외활동', school: '', host: '청년재단', foundAt: '2026-09-23', attachments: [] },
    /* 관리자가 숨긴 글 — 파일에는 있지만 화면에는 없어야 한다 (2026-09-29) */
    { title: '숨긴 글 — 보이면 안 된다', url: 'https://dep.hufs.ac.kr/bbs/x/5', kind: '대외활동', school: '한국외국어대학교', campus: '', foundAt: '2026-09-27', attachments: [], hidden: true },
  ],
};

/* 신청서 원본 PDF 색인(data/forms-pdf/index.json) — 활동 글의 열쇠는 글 id · 장학 등록분과 같은 로봇·같은 색인 */
const FORMS_PDF_FIXTURE = { updatedAt: '2026-10-30', items: { 'act-fixture1': [{ file: 'act-fixture1/1-form.pdf', name: '참가신청서.hwp', pages: 2, bytes: 20480, from: '원본 그대로 변환' }] } };
/* 그 PDF 의 빈칸 장부(collector/form-fields.mjs 가 만드는 꼴) — 활동 글도 같은 로봇·같은 장부(2026-10-31). 학교 칸은 학적정보로 먼저 채워진다 */
const FIELDS_FIXTURE = { updatedAt: '2026-10-31', files: { '1-form.pdf': { dir: '1-pages', pages: [{ n: 1, w: 595, h: 842, img: '1.webp' }],
  fields: [{ id: 'f1', page: 1, x: 100, y: 120, w: 220, h: 20, label: '소속 학교', key: 'school' }, { id: 'f2', page: 1, x: 100, y: 160, w: 220, h: 20, label: '참가 분야' }] } } };

const EXT_FIXTURE = {
  updatedAt: '2026-09-26',
  items: [
    { title: '2026년 하반기 장학생 선발 공고', url: 'https://www.uljinsf.kr/n/1', host: '울진군장학재단', school: '', foundAt: '2026-09-26', attachments: [], deadlineHint: '신청기간 : 2026. 10. 2. ~ 10. 20.' },
    { title: '2026 보훈 장학생 모집 안내', url: 'https://www.mpva.go.kr/n/2', host: '국가보훈부', school: '', foundAt: '2026-09-25', attachments: [] },
  ],
};

const PROFILE = {
  school: '한국외국어대학교', campus: '', track: 'humanities', major: '',
  year: 3, status: '재학', gpa: 3.5, bracket: 5, flags: [], nationality: 'korean',
  birthYear: new Date().getFullYear() - 23, region: '서울', regionCity: '동대문구',   // 나이·지역 — 활동 글 자격 판정(2026-10-01)
  interestKinds: ['대외활동', '공모전'],   // 관심 관문(2026-10-24 지시 4)을 지난 학생 — 안 고른 학생은 아래 ⑦ 이 따로 잰다
  onboarded: true, common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
};

async function fresh(browser, mode, ext = EXT_FIXTURE, profile = PROFILE) {
  /* 🔴 서비스워커를 막는다 — 새로고침 뒤에는 워커가 data/*.json 을 받아 오므로 page.route 의 가짜
     응답이 **닿지 않는다**(실측: 픽스처 대신 저장소의 빈 파일이 왔다). 이 검사는 탭의 규칙을 재는
     것이지 워커를 재는 것이 아니다(워커는 verify-resume 등이 잰다). 프로필은 초기 스크립트로
     심어 새로고침 없이 한 번에 뜬다. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem('handaejang.v1')) localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [], docs: {}, notify: {} }));
  }, profile);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/data/activities.json*', (route) => (mode === 'fail'
    ? route.abort()
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) })));
  /* 재단·지자체 새 공고 (2026-09-26 · 교외 확대) — 같은 검사에서 홈 구역도 잰다 */
  await page.route('**/data/external.json*', (route) => (mode === 'fail'
    ? route.abort()
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ext) })));
  await page.route('**/data/forms-pdf/index.json*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORMS_PDF_FIXTURE) }));
  await page.route('**/data/forms-pdf/act-fixture1/fields.json*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIELDS_FIXTURE) }));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await dismissNotify(page);
  return { page, errors };
}

/* 🔴 2026-10-01 — 카드는 장학 카드와 같은 그림(cardShellHtml · button.sch-card[data-activity])이고 누르면 같은 시트가 열린다 */
const cards = (page) => page.$$eval('#activities-list [data-activity]', (els) => els.map((e) => ({
  name: e.querySelector('.sch-name').textContent.trim(),
  org: (e.querySelector('.sch-org') || {}).textContent || '',   // 시안 B(2026-11-02) — 주최는 알 때만 · 갈래는 칩(.badge-kind)
  chip: (e.querySelector('.sch-top .badge-kind') || {}).textContent || '',
})).map((c) => ({ ...c, org: c.org.trim(), chip: c.chip.trim() })));

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });

  /* ── 정상 응답 ── */
  {
    const { page, errors } = await fresh(browser, 'ok');
    /* ── 홈: 재단·지자체 새 공고 구역 ── */
    eq('홈 — 재단·지자체 새 공고 구역이 학교 게시판 구역 아래에 뜬다',
      await page.$eval('#external-notices', (e) => e.querySelector('h3') && e.querySelector('h3').textContent.trim()), '재단·지자체 새 공고');
    eq('홈 — 카드 윗줄이 주최를 말한다 · 최근 수집 순',
      await page.$$eval('#external-notices .notice-card .sch-org', (els) => els.map((e) => e.textContent.trim())), ['울진군장학재단', '국가보훈부']);   // 2026-10-04 — 구역 제목이 「…새 공고」라 「공고」를 겹쳐 적지 않는다
    eq('홈 — 재단 글이 석 장 이하면 더보기 단추가 없다', await page.$('#external-more'), null);
    eq('홈 — 기간 한 줄은 원문 그대로',
      await page.$eval('#external-notices .notice-card .sch-provider', (e) => e.textContent.trim()), '신청기간 : 2026. 10. 2. ~ 10. 20.');
    /* 2026-10-04 개발자 지시 — 회색 기간 줄은 첫 항목만(뒤 「ㅇ 접수방법」·「2. 신청방법」 은 떼고 · 날짜 「10. 7.」 은 항목 번호가 아니다) · 날짜 없으면 안 보인다 */
    eq('홈 — 기간 줄은 첫 항목까지만 · 짝 잃은 괄호 이름표를 편다 · 날짜 없으면 비운다',
      await page.evaluate(() => [hintShort('접수기한 ) ~ 10. 7.(수) 18시 ㅇ ( 접수방법 ) 모바일 설문조사 네이버폼 응'), hintShort('신청기간: 2026. 10. 6.(화) ~ 10. 23.(금) 2. 신청방법: 홈페이지 3. 접'), hintShort('마감 안내 공고문 참고')]),
      ['접수기한 ~ 10. 7.(수) 18시', '신청기간: 2026. 10. 6.(화) ~ 10. 23.(금)', '']);
    /* 홈 「나에게 맞는 대외활동·공모전」 — 장학금 구역 바로 밑 · 대외활동 탭과 같은 글 고르기 · 미달은 싣지 않는다 */
    eq('홈 — 「나에게 맞는 대외활동·공모전」 이 「나에게 맞는 장학금」 바로 밑에 있다',
      await page.evaluate(() => { const a = document.getElementById('home-activities'); let e = document.getElementById('home-deadline-more').nextElementSibling; return [a && a.querySelector('h3') && a.querySelector('h3').textContent.trim(), e === a]; }),
      ['나에게 맞는 대외활동·공모전', true]);
    eq('  대외활동 탭과 같은 판정으로 고른 글이고 미달은 없다',
      await page.evaluate(() => { const mine = new Set(activitiesForMe().map((n) => n.url)); const cs = [...document.querySelectorAll('#home-activity-list [data-activity]')]; return [cs.length > 0, cs.every((c) => mine.has(c.dataset.activity)), cs.some((c) => /지원 자격 미달/.test(c.textContent))]; }),
      [true, true, false]);
    /* 프로필 관심 분야 칸 — 목록은 data/activities.json fields(수집기 ACTIVITY_FIELDS 원본)에서 · 고른 것은 다시 그려도 지킨다 */
    eq('온보딩 관심 분야 칸은 데이터의 분야 목록으로 그리고 고른 것을 지킨다',
      await page.evaluate(() => { const bak = liveActivities.fields; liveActivities.fields = { 공모전: ['영상·사진'], 대외활동: ['봉사'] }; fillInterestFields(['봉사']); fillInterestFields(); const r = [...document.querySelectorAll('#in-act-fields input')].map((c) => `${c.value}${c.checked ? '✓' : ''}`); liveActivities.fields = bak; return r; }),
      ['영상·사진', '봉사✓']);
    const navs = await page.$$eval('#bottom-nav .nav-item', (b) => b.map((x) => x.dataset.nav));
    eq('① 아래 탭 다섯 — 대외활동은 장학금 다음', navs, ['home', 'explore', 'activities', 'applications', 'my']);
    await page.click('.nav-item[data-nav="activities"]');
    await page.waitForTimeout(400);
    eq('① 누르면 그 화면만 보인다', await page.$$eval('.screen', (s) => s.filter((x) => !x.hidden).map((x) => x.id)), ['screen-activities']);
    eq('① 제목', await page.$eval('#screen-activities h2', (h) => h.textContent.trim()), '대외활동·공모전');
    eq('① 탭이 켜져 있다', await page.$eval('.nav-item[data-nav="activities"]', (b) => b.classList.contains('active')), true);

    let seen = await cards(page);
    eq('② 내 학교 글 + 전국 글만 (경희대 글은 안 보인다) · 최근 수집 순', seen.map((c) => c.name),
      ['2026 대학생 해외봉사단 모집', '제3회 장학수기 공모전 공고', '전국 청년 서포터즈 모집']);
    /* 2026-11-02 승인 시안 B — 윗줄은 갈래 칩(봉사·대외활동·공모전·청년정책) + 주최 · 아랫줄 왼쪽은 「대상 · …」 · 마감은 아랫줄 오른쪽 그대로(개발자 결정) */
    /* 2026-11-02 개발자 결정 — 학교 게시판에서 주운 글은 「○○대학교 게시판」을 학생 화면에 적지 않는다(주최가 아니다) · 칩만 */
    eq('④ 윗줄은 갈래 칩만 (칩은 분야로 「봉사」 · 학교 게시판 글은 주최 글자 없음)', [seen[0].chip, seen[0].org], ['봉사', '']);
    eq('④ 마감을 읽은 글은 아랫줄 오른쪽 D-5 (장학 카드와 같은 자리·같은 글자)', await page.$eval('#activities-list [data-activity] .sch-foot .sch-due', (e) => e.textContent.trim()), 'D-5');
    /* 2026-11-15 개발자 결정("밑에 대상은 아예 빼버리고 시안 1로") — 카드 아랫줄에 「대상 · …」 줄이 없다 · 칩에 갈래 색 · 원문 아이콘은 마감 옆(오른쪽 끝) */
    eq('④ 아랫줄 왼쪽은 빈칸 — 「대상 · …」 줄이 없다 (대상은 시트가 말한다)', await page.$$eval('#activities-list [data-activity] .sch-foot .sch-amount', (e) => e.map((x) => x.textContent.trim())), ['', '', '']);
    eq('④ 칩에 갈래 색 — 봉사 · 공모전 · 대외활동이 제 색 클래스를 단다', await page.$$eval('#activities-list .sch-top .badge-kind', (e) => e.map((x) => x.className.replace('badge badge-kind ', ''))), ['badge-vol', 'badge-contest', 'badge-act']);
    eq('④ 원문 아이콘은 마감 옆 — 카드 오른쪽 끝 · 마감 글자와 같은 줄', await page.evaluate(() => {
      const w = document.querySelector('#activities-list .sch-card-wrap.has-link');
      const l = w.querySelector('.card-src-link').getBoundingClientRect(), d = w.querySelector('.sch-due').getBoundingClientRect(), c = w.getBoundingClientRect();
      return [l.left > d.right, c.right - l.right <= 24, Math.abs((l.top + l.bottom) / 2 - (d.top + d.bottom) / 2) <= 6];
    }), [true, true, true]);
    /* 판정 하나 — 장학 카드와 같은 cardBadgeHtml (2026-10-01) */
    /* 자격 줄 없음 → 배지 없음 (2026-10-03 개발자 결정 — 활동 카드에 '자격 미확인' 을 안 단다 · 장학 카드는 그대로) */
    eq('④ 카드 맨 윗줄 판정 — 나이 맞음 → 적합도 % · 나이 넘음 → 미달 · 자격 줄 없음 → 배지 없음',
      await page.$$eval('#activities-list .sch-card .sch-top', (e) => e.map((x) => (x.querySelector('.sch-fit, .badge:not(.badge-kind)') || {}).textContent || '').map((t) => t.trim().replace(/\d+%/, 'N%'))),   // 갈래 칩(.badge-kind)은 판정이 아니다(시안 B 2026-11-02)
      ['적합도 N%', '지원 자격 미달', '']);
    eq('④ 카드에 발췌 줄을 쌓지 않는다 (장학 카드처럼 석 줄)', await page.$$eval('#activities-list .sch-provider', (e) => e.length), 0);
    eq('④ 장학 카드와 같은 그릇 (.sch-card-wrap > button.sch-card)', await page.$$eval('#activities-list .sch-card-wrap > button.sch-card[data-activity]', (e) => e.length), 3);
    /* 누르면 앱을 떠나지 않고 장학과 같은 상세 시트(#detail-sheet)가 열린다 */
    await page.click('#activities-list [data-activity]'); await page.waitForTimeout(500);
    eq('⑤ 누르면 상세 시트가 열린다(앱을 떠나지 않는다)', await page.$eval('#detail-sheet', (e) => !e.hidden && e.classList.contains('show')), true);
    /* 2026-11-02 승인 시안 — 머리줄 = 칩 · 주최 · D-day · 저장 (카드와 같은 줄) · 짧은 혜택은 금액 자리 */
    eq('⑤ 시트 — 제목 · 혜택(금액 자리) · 머리줄 칩/D-day (학교 게시판 글은 주최 없음)', await page.$eval('#detail-sheet', (e) => [
      e.querySelector('.sheet-title').textContent.trim(), e.querySelector('.sheet-amount').textContent.trim(),
      e.querySelector('.sheet-top .badge-kind').textContent.trim(), !!e.querySelector('.sheet-top .sch-org'), e.querySelector('.sheet-top .badge-dday').textContent.trim(), !!e.querySelector('.sheet-provider')]),
      ['2026 대학생 해외봉사단 모집', '항공료 전액 지원', '봉사', false, 'D-5', false]);   // 학교 게시판 글 — 머리줄에 주최 글자 없음(2026-11-02 개발자 결정)
    /* 기간은 발췌 「모집기간」 원문 그대로(리뷰 2026-11-02 — 마감만 적으면 시작일이 사라진다) · 없을 때만 ~마감 */
    /* 2026-11-15 개발자 결정 11-02 — 모르는 방법 줄은 안 그린다(예전 「방법 원문 확인」) */
    eq('⑤ 「접수」 절 — 기간은 발췌 모집기간 원문 그대로 · 방법을 모르면 줄 없음 · 서류는 원문에서 읽은 제출 서류(11-11 · activityDocuments)', await page.$$eval('#detail-sheet .apply-rows li', (li) => li.map((x) => x.textContent.trim().replace(/\s+/g, ' '))), ['기간2026. 10. 1. ~ 10. 15.', '서류참가신청서 1부 · 개인정보 수집·이용 동의서 1부']);
    eq('⑤ 지원 자격 — 장학 시트와 같은 머리(적합도 · 맞는 요건 n개 · 어긋난 요건 없음 — 2026-11-15)와 ✓ 줄',
      await page.$eval('#detail-sheet', (e) => [e.querySelector('.sheet-verdict h4').textContent.trim(), /맞는 요건 1개 · 어긋난 요건 없음/.test(e.querySelector('.sheet-verdict').textContent),
        [...e.querySelectorAll('.reason-list li')].map((li) => li.textContent.trim())]),
      ['지원 자격', true, ['✓ 만 19~34세 대한민국 국민']]);
    eq('⑤ 지원 가능 알약은 없다(활동 글엔 구조화 조건이 없어 늘 가능 — 거짓 안심)', await page.$$eval('#detail-sheet .status-pill', (e) => e.length), 0);
    eq('⑤ 공고 원문 안내 — 원문 문장 그대로', await page.$$eval('#detail-sheet .doc-list', (u) => u.map((x) => x.textContent.trim()).some((t) => t.includes('봉사단은 5개국에 파견합니다.'))), true);
    /* 제출 서류 · 신청서 원본 PDF · 양식 채우기 (2026-10-30~31 공동개발자 "공모전 신청 양식이 매우 미흡") — 승인 시트(11-02)의 자리 둘: 「접수 · 서류」 줄 · 「첨부」 맨 위 */
    eq('⑤ 접수 · 서류 — 활동 글이 원문 「제출서류」 절에서 읽은 서류를 장학 시트와 같은 줄에 (점으로 잇는다)', await page.$eval('#detail-sheet', (e) => {
      const li = [...e.querySelectorAll('.apply-rows li')].find((x) => (x.querySelector('.ns-k') || {}).textContent === '서류');
      return li ? li.textContent.replace(/^서류/, '').trim() : null;
    }), '참가신청서 1부 · 개인정보 수집·이용 동의서 1부');
    /* 2026-11-20 승인 시안(docs/designs/all-docs-pdf.md) — 위: PDF 줄(첨부 이름 그대로 · 작은 글씨 없음) · 맨 밑: 올린 첨부 목록 그대로 */
    eq('⑤ 첨부 위 — 로봇이 바꿔 둔 원본 PDF 줄(첨부 이름 그대로 · 새 탭 · data/forms-pdf/ 주소 · 작은 글씨 없음) · 맨 밑에 올린 원본 첨부 줄', await page.$eval('#detail-sheet', (e) => {
      const h = [...e.querySelectorAll('h4')].find((x) => /^첨부/.test(x.textContent.trim()));
      if (!h) return null;
      const ul = h.nextElementSibling; const a = ul.querySelector('li a');
      const orig = ul.nextElementSibling && ul.nextElementSibling.matches('ul.doc-list') ? ul.nextElementSibling : null;
      return [a.textContent.trim(), a.target, a.getAttribute('href'), ul.querySelectorAll('.att-m').length, orig ? orig.querySelectorAll('li.att:not(.att-row)').length : 0];
    }), ['참가신청서.hwp', '_blank', 'data/forms-pdf/act-fixture1/1-form.pdf', 0, 1]);
    /* 「양식 채우기」(2026-10-31) — 빈칸 장부가 있는 활동 글 PDF 에도 장학과 같은 단추가 서고, 누르면 같은 화면(formfill.js)이 그 글 이름으로 열린다 */
    await page.waitForSelector('#detail-sheet .fill-open', { timeout: 4000 }).catch(() => {});
    eq('⑤ 양식 채우기 — 빈칸을 찾은 활동 글 PDF 밑에 단추 · 글자는 「양식 채우기」 한 마디(작은 글씨 없음 · 11-20 개발자 "ㅇㅇ 지워")', await page.$eval('#detail-sheet', (e) => {
      const b = e.querySelector('.fill-open');
      return b ? [b.dataset.id, b.textContent.trim(), b.querySelectorAll('.fill-open-m').length] : null;
    }), ['act-fixture1', '양식 채우기', 0]);
    await page.click('#detail-sheet .fill-open'); await page.waitForTimeout(600);
    eq('⑤ 누르면 양식 채우기 화면이 그 글 이름으로 열리고 · 학교 칸이 학적정보로 채워져 있고 · 남은 칸 1',
      await page.evaluate(() => [!document.querySelector('#screen-formfill').hidden, document.querySelector('#fill-title').textContent.trim(),
        (document.querySelector('#fill-pages .fillp-field[data-fid="f1"]') || {}).value, document.querySelector('#fill-left').textContent.trim()]),
      [true, '2026 대학생 해외봉사단 모집', '한국외국어대학교', '남은 칸 1']);
    await page.click('#btn-fill-back'); await page.waitForTimeout(500);
    eq('⑤ 돌아가기는 대외활동 화면으로', await page.$$eval('.screen', (sc) => sc.filter((x) => !x.hidden).map((x) => x.id)), ['screen-activities']);
    /* 아래 줄들은 시트를 다시 연 상태에서 잰다 — 양식 채우기가 시트를 닫았다 */
    await page.click('#activities-list [data-activity]'); await page.waitForTimeout(500);
    eq('⑤ 원문 단추는 그 글 주소를 새 탭으로 — 글 하나로 가는 주소라 「원문에서 신청하기 ↗」(시안 2026-11-02)', await page.$eval('#detail-sheet a.btn-primary', (a) => [a.getAttribute('href'), a.target, a.textContent.trim()]), ['https://dep.hufs.ac.kr/bbs/x/1', '_blank', '원문에서 신청하기 ↗']);   // 2026-10-19 개발자: "자세한 공고는 원문 공고에서 확인하라 하면서 … 원문공고 하이퍼링크"
    eq('⑤ 단추 글자에 밑줄이 없다', await page.$eval('#detail-sheet a.btn-primary', (a) => getComputedStyle(a).textDecorationLine), 'none');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    eq('⑤ ESC 로 닫힌다 (장학 시트와 같은 그릇)', await page.$eval('#detail-sheet', (e) => e.hidden || !e.classList.contains('show')), true);
    eq('④ 마감 지난 글은 보이지 않는다', seen.some((c) => /지난 공모전/.test(c.name)), false);
    eq('④ 전국 글은 주최를 말한다 (칩은 종류 · 주최는 host)', [seen[2].chip, seen[2].org], ['대외활동', '청년재단']);
    /* 정렬 — 마감 임박순은 마감을 읽은 글이 앞, 못 읽은 글은 뒤 */
    /* 🔴 정렬은 **탐색 화면과 같은 단추·같은 자리·같은 동작**이다 (2026-09-30 개발자 지시) —
       누르면 기준 목록이 뜨고, 골라야 바뀐다. 머리줄 오른쪽 끝에 선다(갱신 날짜 칸이 없어서). */
    const menuShown = () => page.$eval('#activities-sort-menu', (e) => e.offsetParent !== null);
    eq('③ 처음에는 정렬 목록이 안 보인다', await menuShown(), false);
    await page.click('#activities-sort-btn'); await page.waitForTimeout(200);
    eq('③ 누르면 정렬 목록이 열린다 (탐색 화면과 같은 동작)', await menuShown(), true);
    eq('③   선택지는 셋 — 등록 최신순 · 마감 임박순 · 적합도순(장학 탐색과 같은 잣대 · 2026-10-01)',
      await page.$$eval('#activities-sort-menu [data-sort]', (e) => e.map((x) => x.textContent.trim())), ['등록 최신순', '마감 임박순', '적합도순']);
    eq('③   지금 기준에 표시가 있다',
      await page.$eval('#activities-sort-menu [aria-checked="true"]', (e) => e.dataset.sort), 'recent');
    await page.click('#activities-sort-menu [data-sort="deadline"]'); await page.waitForTimeout(200);
    eq('③ 마감 임박순 — 마감 읽은 글이 앞', (await cards(page)).map((c) => c.name)[0], '2026 대학생 해외봉사단 모집');
    eq('③ 정렬 단추 글자', await page.$eval('#activities-sort-label', (e) => e.textContent.trim()), '마감 임박순');
    eq('③   고르고 나면 목록이 닫힌다', await menuShown(), false);
    await page.click('#activities-sort-btn'); await page.waitForTimeout(200);
    await page.click('#activities-sort-menu [data-sort="fit"]'); await page.waitForTimeout(200);
    eq('③ 적합도순 — 맞음 → 미확인 → 미달(장학 탐색의 fitRank 와 같은 순서)', (await cards(page)).map((c) => c.name),
      ['2026 대학생 해외봉사단 모집', '전국 청년 서포터즈 모집', '제3회 장학수기 공모전 공고']);
    await page.click('#activities-sort-btn'); await page.waitForTimeout(200);
    await page.click('#activities-sort-menu [data-sort="recent"]'); await page.waitForTimeout(200);
    eq('③ 다시 골라 등록 최신순', await page.$eval('#activities-sort-label', (e) => e.textContent.trim()), '등록 최신순');
    await page.click('#activities-sort-btn'); await page.waitForTimeout(200);
    /* '바깥'은 화면 제목 — 목록 한가운데를 누르면 이제 카드가 눌려 상세 시트가 열린다(2026-10-01 카드가 시트를 연다) */
    await page.click('#screen-activities h2'); await page.waitForTimeout(150);
    eq('③   바깥을 누르면 목록이 닫힌다', await menuShown(), false);
    eq('③ 갱신 날짜를 보이지 않는다 (머리줄 셋째 칸이 단추를 가운데로 밀었다)',
      await page.$('#activities-updated'), null);
    /* 자리 — 탐색 화면의 정렬 단추와 오른쪽 끝이 같다(화면 폭 기준) */
    const rightOf = (sel) => page.$eval(sel, (e) => Math.round(e.getBoundingClientRect().right));
    const actRight = await rightOf('#activities-sort-btn');
    const headRight = await page.$eval('#screen-activities .page-header', (e) => Math.round(e.getBoundingClientRect().right
      - parseFloat(getComputedStyle(e).paddingRight)));
    eq('③ 정렬 단추가 머리줄 오른쪽 끝에 붙는다', Math.abs(actRight - headRight) <= 1, true);
    await page.click('.nav-item[data-nav="explore"]'); await page.waitForTimeout(300);
    eq('③   탐색 화면의 정렬 단추와 같은 자리다', Math.abs(await rightOf('#explore-sort-btn') - actRight) <= 1, true);
    await page.click('.nav-item[data-nav="activities"]'); await page.waitForTimeout(300);

    await page.click('#activities-filters .filter-chip[data-filter="공모전"]');
    await page.waitForTimeout(200);
    seen = await cards(page);
    eq('③ 공모전 칩', seen.map((c) => c.name), ['제3회 장학수기 공모전 공고']);
    eq('③ 칩 켜짐은 제 줄에서만 — 탐색 화면의 전체 칩은 그대로',
      await page.$eval('#explore-filters .filter-chip[data-filter="all"]', (c) => c.classList.contains('active')), true);
    await page.click('#activities-filters .filter-chip[data-filter="대외활동"]');
    await page.waitForTimeout(200);
    eq('③ 대외활동 칩', (await cards(page)).map((c) => c.name), ['2026 대학생 해외봉사단 모집', '전국 청년 서포터즈 모집']);
    /* ── 분야 칩 줄 (2026-10-03 개발자 지시 "제목 아래 회색 분류를 위에 버튼으로") ──
       픽스처에서 field 가 있는 글은 '봉사' 하나뿐 — 나머지는 비어 있어 '기타'로 모인다.
       🔴 칩은 **데이터에서** 만들므로, 칩 목록 자체가 '세는 길이 살아 있는가'를 말해 준다. */
    await page.click('#activities-filters .filter-chip[data-filter="all"]');
    await page.waitForTimeout(200);
    const fchips = () => page.$$eval('#activities-field-filters .filter-chip', (els) => els.map((e) => e.dataset.filter));
    eq('③ 분야 칩은 데이터에서 만든다 (있는 분야 + 기타)', await fchips(), ['all', '봉사', '기타']);
    await page.click('#activities-field-filters .filter-chip[data-filter="봉사"]');
    await page.waitForTimeout(200);
    eq('③   봉사 칩', (await cards(page)).map((c) => c.name), ['2026 대학생 해외봉사단 모집']);
    eq('③   칩 켜짐은 제 줄에서만 — 종류 칩의 전체는 그대로',
      await page.$eval('#activities-filters .filter-chip[data-filter="all"]', (c) => c.classList.contains('active')), true);
    await page.click('#activities-field-filters .filter-chip[data-filter="기타"]');
    await page.waitForTimeout(200);
    eq('③   기타 칩 — 분야를 못 읽은 글만 (데이터는 그대로 비어 있다 · 기타는 화면 이름일 뿐)',
      (await cards(page)).map((c) => c.name), ['제3회 장학수기 공모전 공고', '전국 청년 서포터즈 모집']);
    /* 🔴 종류를 바꾸면 분야가 풀린다 — 안 풀면 '봉사'를 고른 채 공모전으로 가서 0건 화면이 된다 */
    await page.click('#activities-field-filters .filter-chip[data-filter="봉사"]');
    await page.waitForTimeout(200);
    await page.click('#activities-filters .filter-chip[data-filter="공모전"]');
    await page.waitForTimeout(200);
    eq('③   종류를 바꾸면 분야가 풀린다', await page.$eval('#activities-field-filters .filter-chip.active', (c) => c.dataset.filter), 'all');
    eq('③   그 종류에 있는 분야만 뜬다 (공모전 글엔 field 가 없다)', await fchips(), ['all', '기타']);
    eq('③   그래서 목록이 비지 않는다', (await cards(page)).length > 0, true);
    /* 🔴 **분야 줄이 세로로 스크롤되면 안 된다** (2026-10-03 개발자 신고: "오른쪽으로 넘길 때
       위아래 칸이 넘어간다"). `.filter-row` 는 `overflow-x: auto` 인데 CSS 규칙상 다른 축도
       auto 가 되어, 29px 알약에 얹은 44px 손가락 덧판이 줄 밖으로 나가자 줄이 세로로 3px
       스크롤됐다 — 옆으로 미는 손짓에 위아래로도 밀렸다. 안쪽 여백으로 자리를 만들어 고쳤다.
       ⚠️ 덧판을 키우거나 여백을 줄이면 **바로 되살아난다.** 가로 넘침은 그대로 있어야 한다. */
    /* 🔴 2026-10-04 개발자 지시 "분야가 너무 길어 옆으로 넘겨야 해서 불편" — 옆으로 미는 줄을 걷고
       **줄바꿈 + 접기**로 바꿨다. 그래서 이제 재는 성질은 '스크롤 상자가 아니다'이다. */
    const rowBox = await page.$eval('#activities-field-filters', (e) => ({
      세로: e.scrollHeight - e.clientHeight, 가로: e.scrollWidth - e.clientWidth, 줄바꿈: getComputedStyle(e).flexWrap }));
    eq('③   분야 줄은 세로로 안 넘친다 (위아래로 안 밀린다)', rowBox.세로, 0);
    eq('③   분야 줄은 옆으로 밀지 않고 줄바꿈한다', [rowBox.가로, rowBox.줄바꿈], [0, 'wrap']);
    /* 접기 — 픽스처는 분야가 둘뿐이라 칩 그리는 함수에 분야 열 개짜리 목록을 직접 준다 */
    const fold = await page.evaluate(() => {
      const fs = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차'];
      const list = fs.flatMap((f, i) => Array(10 - i).fill({ field: f }));
      const row = document.querySelector('#activities-field-filters');
      const names = () => [...row.querySelectorAll('.filter-chip')].map((c) => c.textContent);
      renderActivityFieldChips(list); const shut = names();
      activitiesField = '차'; renderActivityFieldChips(list); const picked = names();
      activitiesField = 'all'; activitiesFieldOpen = true; renderActivityFieldChips(list); const open = names();
      activitiesFieldOpen = false; renderActivities();
      return { shut, picked, open };
    });
    eq('③   분야가 많으면 많은 순 여섯 + 「+n」', fold.shut, ['분야 전체', '가', '나', '다', '라', '마', '바', '+4']);
    eq('③   고른 분야는 접혀도 보인다', fold.picked, ['분야 전체', '가', '나', '다', '라', '마', '바', '차', '+3']);
    eq('③   펼치면 전부 + 접기', fold.open, ['분야 전체', ...'가나다라마바사아자차'.split(''), '접기']);
    /* 알약은 작아도 **손가락 표적은 그대로** — 알약 위아래 바깥을 짚어도 그 칩이 잡혀야 한다 */
    eq('③   알약은 작지만 손가락 표적은 작아지지 않았다 (안 보이는 덧판)',
      await page.$eval('#activities-field-filters', (row) => {
        const chip = row.querySelectorAll('.filter-chip')[1];
        const r = chip.getBoundingClientRect();
        const hit = (dy) => { const el = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2 + dy)); return !!(el && el.closest('.filter-chip') === chip); };
        return [Math.round(r.height) < 34, hit(-7), hit(7)];
      }), [true, true, true]);
    await page.click('#activities-filters .filter-chip[data-filter="all"]');
    await page.waitForTimeout(200);
    await page.fill('#activities-search', '서포터즈');
    await page.waitForTimeout(200);
    eq('③ 검색은 제목 글자로', (await cards(page)).map((c) => c.name), ['전국 청년 서포터즈 모집']);
    await page.fill('#activities-search', '없는말');
    await page.waitForTimeout(200);
    eq('③ 검색 결과 없음 문구', await page.$eval('#activities-list .empty', (e) => e.textContent.includes("'없는말'")), true);
    await page.click('#activities-search-clear');
    await page.waitForTimeout(200);
    eq('③ 지우기 버튼이 검색을 되돌린다', (await cards(page)).length, 3);

    /* 다른 탭으로 갔다 돌아와도 그대로 */
    await page.click('.nav-item[data-nav="explore"]'); await page.waitForTimeout(200);
    await page.click('.nav-item[data-nav="activities"]'); await page.waitForTimeout(300);
    eq('돌아와도 목록이 있다', (await cards(page)).length, 3);

    /* ── ⑥ 북마크 · 보관함 · 달력 (2026-10-02 개발자 지시 "대외활동도 북마크랑 달력 연결해줘") ── */
    const ACT1 = 'https://dep.hufs.ac.kr/bbs/x/1';   // 마감 D-5 픽스처
    eq('⑥ 활동 카드에 장학 카드와 같은 북마크(카드 바깥)', await page.$$eval('#activities-list .sch-card-wrap > .save-btn', (e) => e.length), 3);
    await page.click(`#activities-list .save-btn[data-save="act:${ACT1}"]`); await page.waitForTimeout(300);
    eq('⑥ 누르면 담긴다 · 글 사본도 함께(피드에서 빠져도 남게)', await page.evaluate((u) => { const s = state.saved.find((x) => x.id === `act:${u}`); return [!!s, !!(s && s.snap && s.snap.title)]; }, ACT1), [true, true]);
    eq('⑥ 단추가 켜진다', await page.$eval(`#activities-list .save-btn[data-save="act:${ACT1}"]`, (b) => b.classList.contains('on')), true);
    /* 2026-11-21 선주 「공고보관함과 신청내역에서 대외활동과 장학금이 구분되게」 — 종류는 윗줄 갈래 칩이 말하고 둘째 줄은 주최만(학교 게시판 글은 주최 없음 → 둘째 줄 없음) */
    eq('⑥ 보관함에 장학과 같은 줄로(윗줄 갈래 칩 — 활동 카드와 같은 「봉사」 · 학교 게시판 글은 둘째 줄 없음 — 2026-11-02 개발자 결정)', await page.evaluate(() => { showScreen('my'); return [...document.querySelectorAll('#my-saved .cal-row')].map((r) => [(r.querySelector('.cal-row-top .badge-kind') || {}).textContent, r.querySelector('.cal-row-name').textContent.trim(), !!r.querySelector('.cal-row-sub')]); }),
      [['봉사', '2026 대학생 해외봉사단 모집', false]]);
    eq('⑥ 달력에 마감 점(파랑) — 내 공고로 센다', await page.evaluate((u) => { const ctx = calContext(); const d = ctx.mine.find((x) => x.id === `act:${u}`); if (!d) return null;
      const [y, m] = d.deadline.split('-').map(Number); const mk = calMarks(new Date(y, m - 1, 1), ctx.mine)[d.deadline] || []; return mk.filter((k) => k.id === `act:${u}`).map((k) => k.kind); }, ACT1), ['mine']);
    await page.evaluate(() => document.querySelector('#my-saved .cal-row').click()); await page.waitForTimeout(500);
    eq('⑥ 보관함 줄을 누르면 활동 시트가 열린다', await page.$eval('#detail-sheet .sheet-title', (e) => e.textContent.trim()), '2026 대학생 해외봉사단 모집');
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    /* 피드에서 빠져도(60일·마감) 사본으로 남는다 */
    eq('⑥ 피드에서 빠져도 보관함·달력·시트가 사본으로 남는다', await page.evaluate((u) => {
      const keep = liveActivities.items; liveActivities.items = keep.filter((x) => x.url !== u);
      /* ⚠️ 시트는 닫아도 내용이 남는다 — 비우고 연 뒤 '보이는가 + 제목'을 함께 잰다(앞 시트의 제목으로 헛통과하던 것 · red-green 으로 잡음) */
      closeSheet(); document.querySelector('#detail-sheet').innerHTML = '';
      const out = [savedScholarships().some((x) => x.id === `act:${u}`), calContext().mine.some((x) => x.id === `act:${u}`),
        (openDetail(`act:${u}`), document.querySelector('#detail-sheet').classList.contains('show') && (document.querySelector('#detail-sheet .sheet-title') || {}).textContent === '2026 대학생 해외봉사단 모집')];
      closeSheet(); liveActivities.items = keep; return out; }, ACT1), [true, true, true]);
    /* 빼고 되돌리기 — 피드에서 빠진 활동도 사본째 제자리로 */
    eq('⑥ 빼고 되돌리면 사본째 돌아온다(피드에서 빠졌어도)', await page.evaluate(async (u) => {
      const keep = liveActivities.items; liveActivities.items = keep.filter((x) => x.url !== u);
      toggleSave(`act:${u}`); const gone = !isSaved(`act:${u}`);
      document.querySelector('#toast .toast-undo').click(); await new Promise((r) => setTimeout(r, 50));
      const s = state.saved.find((x) => x.id === `act:${u}`); liveActivities.items = keep; return [gone, !!(s && s.snap)]; }, ACT1), [true, true]);
    /* 달력 날짜를 열었을 때 '내 공고' 줄로 나오는가 — 점만 재면 줄이 깨져도 모른다(리뷰) */
    eq('⑥ 달력 날짜를 열면 「내 공고」에 활동 줄(갈래 칩 · 학교 게시판 글은 주최 없음)', await page.evaluate((u) => { const d = calContext().mine.find((x) => x.id === `act:${u}`); const box = document.createElement('div'); box.innerHTML = calDayHtml(d.deadline);
      const row = box.querySelector(`.cal-row[data-detail="act:${u}"]`); return row ? [(row.querySelector('.cal-row-top .badge-kind') || {}).textContent, row.querySelector('.cal-row-name').textContent.trim(), !!row.querySelector('.cal-row-sub'), /내 공고/.test(box.textContent)] : null; }, ACT1),
      ['봉사', '2026 대학생 해외봉사단 모집', false, true]);
    eq('⑥ 피드가 새로 오면 담아 둔 사본도 새 글로(옛 마감을 말하지 않게)', await page.evaluate((u) => { const s = state.saved.find((x) => x.id === `act:${u}`); s.snap = { ...s.snap, deadline: '2000-01-01' }; refreshActivitySnaps(); return s.snap.deadline !== '2000-01-01'; }, ACT1), true);
    /* ── ⑥-2 보관함 장학금·대외활동 칩 (2026-11-16 은서 「공고보관함에서 대외활동과 장학금이 구분되게」) ── */
    eq('⑥-2 한쪽만 담겼으면 칩이 없다', await page.evaluate(() => { showScreen('mysaved'); return document.querySelectorAll('#my-saved [data-saved-kind]').length; }), 0);
    const SCH1 = await page.evaluate(() => { const s = allScholarships().find((x) => !isActivityId(x.id) && x.deadline) || allScholarships().find((x) => !isActivityId(x.id)); toggleSave(s.id); return s.id; });
    const kindView = () => page.evaluate(() => [[...document.querySelectorAll('#my-saved [data-saved-kind]')].map((c) => (c.classList.contains('active') ? '*' : '') + c.textContent.trim()),
      [...document.querySelectorAll('#my-saved .cal-row')].map((r) => (isActivityId(r.dataset.detail) ? 'act' : 'sch')).sort()]);
    eq('⑥-2 둘 다 담기면 칩 셋 · 처음엔 전체', await page.evaluate(() => { showScreen('mysaved'); return 0; }).then(kindView), [['*전체 2', '장학금 1', '대외활동 1'], ['act', 'sch']]);
    await page.click('#my-saved [data-saved-kind="act"]'); await page.waitForTimeout(150);
    eq('⑥-2 「대외활동」을 누르면 활동만', await kindView(), [['전체 2', '장학금 1', '*대외활동 1'], ['act']]);
    await page.click('#my-saved [data-saved-kind="sch"]'); await page.waitForTimeout(150);
    eq('⑥-2 「장학금」을 누르면 장학만', await kindView(), [['전체 2', '*장학금 1', '대외활동 1'], ['sch']]);
    eq('⑥-2 MY 메뉴 숫자는 늘 전체', await page.$eval('#my-sub-saved', (e) => e.textContent.trim().startsWith('2개')), true);
    eq('⑥-2 장학 줄은 「장학」 갈래 칩(활동 줄과 갈린다)', await page.evaluate((id) => { savedKind = 'all'; renderSaved(); const r = document.querySelector(`#my-saved .cal-row[data-detail="${CSS.escape(id)}"]`); return r ? /^장학/.test(r.querySelector('.cal-row-top .badge-kind').textContent) : null; }, SCH1), true);
    /* ── ⑥-3 신청 내역 달력 장학금·대외활동 칩 (2026-11-21 선주 「…신청내역에서 대외활동과 장학금이 구분되게」) — 보관함과 같은 kindFilter · 숫자 없이 ── */
    const calView = () => page.evaluate(() => [[...document.querySelectorAll('#apps-calendar [data-cal-kind]')].map((c) => (c.classList.contains('active') ? '*' : '') + c.textContent.trim()),
      calMineKind(calContext()).list.map((s) => (isActivityId(s.id) ? 'act' : 'sch')).sort()]);
    await page.evaluate(() => { calKind = 'all'; calCursor = null; showScreen('applications'); calMode = true; renderApplications(); renderCalendar(); });
    eq('⑥-3 달력에 칩 셋(숫자 없음) · 처음엔 전체', await calView(), [['*전체', '장학금', '대외활동'], ['act', 'sch']]);
    await page.evaluate(() => document.querySelector('#apps-calendar [data-cal-kind="act"]').click()); await page.waitForTimeout(150);
    eq('⑥-3 「대외활동」을 누르면 활동만', await calView(), [['전체', '장학금', '*대외활동'], ['act']]);
    /* 담아 둔 장학의 마감일을 연다 — 거르지 않으면 그 줄이 「내 공고」에 뜬다(거르기를 꺼서 빨간불 확인 · 리뷰 2026-11-21) */
    eq('⑥-3 대외활동만 볼 때 날짜 목록에 장학 줄이 없다(내 공고·이날 마감 모두)', await page.evaluate((id) => { const d = calContext().mine.find((x) => x.id === id); if (!d || !d.deadline) return 'no-deadline'; const box = document.createElement('div'); box.innerHTML = calDayHtml(d.deadline);
      return [...box.querySelectorAll('.cal-row')].every((r) => isActivityId(r.dataset.detail)); }, SCH1), true);
    await page.evaluate(() => document.querySelector('#apps-calendar [data-cal-kind="sch"]').click()); await page.waitForTimeout(150);
    eq('⑥-3 「장학금」을 누르면 장학만', await calView(), [['전체', '*장학금', '대외활동'], ['sch']]);
    await page.evaluate(() => { calKind = 'all'; calMode = false; renderApplications(); showScreen('mysaved'); });
    eq('⑥-2 한쪽을 다 빼면 칩이 사라지고 전체로 돌아간다', await page.evaluate((id) => { toggleSave(id); renderSaved(); return [document.querySelectorAll('#my-saved [data-saved-kind]').length, document.querySelectorAll('#my-saved .cal-row').length]; }, SCH1), [0, 1]);
    eq('페이지 오류 없음', errors, []);
    await page.context().close();
  }

  /* ── 받아오기 실패 ── */
  /* ── 홈: 재단·지자체 새 공고가 많을 때 — 석 장만 보이고 '더보기'로 편다 (2026-10-01 개발자 지시
        "나에게 맞는 장학금 부분처럼") · 실데이터가 156건이라 홈이 끝없이 길어졌다 ── */
  {
    const many = { updatedAt: '2026-10-01', items: Array.from({ length: 25 }, (_, i) => ({
      title: `재단 공고 ${i + 1}`, url: `https://example.org/f/${i + 1}`, host: `재단${i + 1}`, school: '',
      foundAt: `2026-09-${String(30 - i).padStart(2, '0')}`, attachments: [] })) };
    const { page, errors } = await fresh(browser, 'ok', many);
    const n = () => page.$$eval('#external-notices .notice-card', (e) => e.length);
    const btn = () => page.$eval('#external-more', (e) => (e.hidden ? '' : e.textContent.trim())).catch(() => null);
    eq('홈 — 재단 공고가 많아도 처음엔 석 장만 보인다 ("나에게 맞는 장학금"과 같은 수)', await n(), 3);
    eq('  아래에 더보기 단추가 있다', await btn(), '더보기');
    eq('  최근 수집 순 그대로 (앞 석 장)', await page.$$eval('#external-notices .notice-card .sch-org', (e) => e.map((x) => x.textContent.trim())),
      ['재단1', '재단2', '재단3']);
    await page.click('#external-more'); await page.waitForTimeout(200);
    eq('  한 번 누르면 열 장까지 편다', await n(), 10);
    await page.click('#external-more'); await page.waitForTimeout(200);
    eq('  또 누르면 열 장 더', await n(), 20);
    await page.click('#external-more'); await page.waitForTimeout(200);
    eq('  🔴 끝까지 편다 — 따로 볼 화면이 없으니 열 장에서 멈추면 글이 사라진다', await n(), 25);
    eq('  다 펴면 단추가 접기로 바뀐다', await btn(), '접기');
    await page.click('#external-more'); await page.waitForTimeout(200);
    eq('  접으면 석 장으로 돌아간다', await n(), 3);
    eq('  페이지 오류 없음', errors, []);
    await page.context().close();
  }
  /* 글이 석 장 이하면 단추가 없다 — 위 정상 응답(2건)에서 잰다 */

  {
    const { page, errors } = await fresh(browser, 'fail');
    await page.click('.nav-item[data-nav="activities"]');
    await page.waitForTimeout(500);
    eq('⑤ 실패해도 뼈대가 아니라 "없어요"', await page.$eval('#activities-list', (e) => e.textContent.includes('없어요') && !e.querySelector('.skel, .skeleton')), true);
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForTimeout(400);
    eq('⑤ 홈 — 재단 글을 못 받아 왔으면 구역이 비어 있다 (뼈대·빈 문구 없음)', await page.$eval('#external-notices', (e) => e.innerHTML.trim()), '');
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  /* ⑦ 관심 관문 (2026-10-24 개발자 지시 4) — 관심 종류를 안 고른 학생은 탭·홈 추천이 닫혀 있고, 고르면 열린다 */
  {
    const { page, errors } = await fresh(browser, 'ok', EXT_FIXTURE, { ...PROFILE, interestKinds: null, interestFields: null });
    eq('⑦ 홈 — 관문 전에는 추천 목록 대신 관문으로 가는 단추', await page.evaluate(() => [!!document.querySelector('#home-activity-list'), !!document.querySelector('.act-gate-cta[data-go="activities"]')]), [false, true]);
    await page.click('.act-gate-cta');
    await page.waitForTimeout(400);
    eq('⑦ 단추가 대외활동 탭을 연다', await page.isVisible('#screen-activities'), true);
    eq('⑦ 탭은 관문만 보이고 목록·칩·검색은 닫혀 있다', await page.evaluate(() => [
      !document.querySelector('#activities-gate').hidden, document.querySelector('#activities-list').hidden,
      document.querySelector('#activities-filters').hidden, document.querySelector('#screen-activities .search-box').hidden]), [true, true, true, true]);
    eq('⑦ 분야 칸은 데이터의 분야로 채워진다 (빈 그릇)', await page.$$eval('#in-act-fields input', (e) => e.length > 0), true);
    await page.click('#act-gate-save');
    await page.waitForTimeout(200);
    eq('⑦ 종류 없이 저장하면 관문이 그대로다', await page.evaluate(() => !document.querySelector('#activities-gate').hidden && !state.profile.interestKinds), true);
    await page.check('#in-act-kinds input[value="대외활동"]');
    await page.click('#act-gate-save');
    await page.waitForTimeout(400);
    eq('⑦ 종류를 고르고 저장하면 목록이 열리고 프로필에 남는다', await page.evaluate(() => [
      document.querySelector('#activities-gate').hidden, !document.querySelector('#activities-list').hidden,
      JSON.parse(localStorage.getItem('handaejang.v1')).profile.interestKinds]), [true, true, ['대외활동']]);
    eq('⑦ 목록은 관문 전과 같은 글들', (await cards(page)).length, 3);
    eq('⑦ 지난 뒤에는 고른 관심 한 줄 + 바꾸기', await page.$eval('#act-gate-summary', (e) => e.textContent.trim()), '관심 대외활동');
    await page.click('#act-gate-edit');
    await page.waitForTimeout(200);
    eq('⑦ 바꾸기는 관문을 다시 열되 취소가 있다(고른 것은 켜진 채)', await page.evaluate(() => [
      !document.querySelector('#activities-gate').hidden, !document.querySelector('#act-gate-cancel').hidden,
      document.querySelector('#in-act-kinds input[value="대외활동"]').checked]), [true, true, true]);
    /* 「내 정보」 (2026-11-15 개발자 지시 — 장학금 학적정보와 연동 · 입력 다각화): 활동 글의 자격 줄이 실제로 쓰는 칸만 묻고(픽스처 두 글이 나이를 묻는다 →
       태어난 해 · 한 글만 묻는 국적은 안 묻는다), 값은 장학금과 같은 프로필 칸에서 오고 같은 칸에 저장된다 */
    eq('⑦ 내 정보 — 학적정보에서 온 한 줄(학교 · 학년 · 학적)', await page.$eval('#act-gate-me', (e) => e.textContent.trim()), '한국외국어대학교 · 3학년 · 재학');
    eq('⑦ 내 정보 — 활동 글 두 곳 이상이 묻는 칸만 · 프로필 값으로 채워져 있다', await page.$$eval('#act-gate-ask [data-elig-field]', (els) => els.map((e) => [e.dataset.eligField, e.value])), [['birthYear', String(new Date().getFullYear() - 23)]]);
    eq('⑦ 내 정보 — 버튼 줄: 취소는 좁고 저장이 넓다(한 줄 · 같은 높이)', await page.evaluate(() => {
      const c = document.querySelector('#act-gate-cancel').getBoundingClientRect(), v = document.querySelector('#act-gate-save').getBoundingClientRect();
      return [c.width < v.width, Math.round(c.height) === Math.round(v.height), v.height < 70];
    }), [true, true, true]);
    /* 🔴 **안 건드린 칸은 저장이 건드리지 않는다** (2026-11-15 리뷰) — 관문은 이미 답한 칸도 채워 보이므로, 보인 값을 되적으면 그 사이 다른 화면에서 고친 값을 덮는다.
       관문을 그려 둔 채 프로필의 태어난 해를 바꾸고(학적정보에서 고친 셈) 아무것도 안 건드리고 저장 → 바꾼 값이 남아야 한다 */
    await page.evaluate(() => { state.profile.birthYear = 1999; state.profile.gpa = 3.5; });
    await page.click('#act-gate-save');
    await page.waitForTimeout(300);
    eq('⑦ 내 정보 — 안 건드린 칸은 그대로 (그려 둔 옛 값으로 덮지 않는다)', await page.evaluate(() => JSON.parse(localStorage.getItem('handaejang.v1')).profile.birthYear), 1999);
    await page.evaluate(() => { state.profile.birthYear = new Date().getFullYear() - 23; });
    await page.click('#act-gate-edit');
    await page.waitForTimeout(200);
    await page.fill('#act-gate-ask [data-elig-field="birthYear"]', String(new Date().getFullYear() - 17));   // 17살 — 「만 19~34세」 글에 미달
    await page.click('#act-gate-save');
    await page.waitForTimeout(400);
    eq('⑦ 내 정보 — 관문에서 고친 값이 장학금과 같은 프로필 칸에 저장된다', await page.evaluate(() => JSON.parse(localStorage.getItem('handaejang.v1')).profile.birthYear), new Date().getFullYear() - 17);
    eq('⑦ 내 정보 — 그 값으로 활동 카드 판정이 바뀐다(해외봉사단 미달)', await page.evaluate(() => {
      const c = [...document.querySelectorAll('#activities-list .sch-card')].find((x) => x.textContent.includes('해외봉사단'));
      return !!c && /미달/.test(c.querySelector('.sch-top').textContent);
    }), true);
    await page.click('#act-gate-edit');
    await page.waitForTimeout(200);
    await page.fill('#act-gate-ask [data-elig-field="birthYear"]', String(new Date().getFullYear() - 23));
    await page.click('#act-gate-save');
    await page.waitForTimeout(300);
    await page.click('#act-gate-edit');
    await page.waitForTimeout(200);
    await page.click('#act-gate-cancel');
    await page.waitForTimeout(200);
    eq('⑦ 취소하면 목록으로 돌아온다', await page.evaluate(() => document.querySelector('#activities-gate').hidden && !document.querySelector('#activities-list').hidden), true);
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForTimeout(400);
    eq('⑦ 홈 추천이 열렸다', await page.evaluate(() => !!document.querySelector('#home-activity-list') && !document.querySelector('.act-gate-cta')), true);
    eq('⑦ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 대외활동·공모전 탭 · 재단·지자체 새 공고 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
