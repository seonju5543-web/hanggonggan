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
    { title: '2026 대학생 해외봉사단 모집', url: 'https://dep.hufs.ac.kr/bbs/x/1', kind: '대외활동', field: '봉사', school: '한국외국어대학교', campus: '', foundAt: '2026-09-25', attachments: [], deadlineHint: '신청기간 : 2026. 10. 1. ~ 10. 15.',
      deadline: iso(5), excerpts: [{ label: '모집기간', text: '2026. 10. 1. ~ 10. 15.' }, { label: '혜택', text: '항공료 전액 지원' }],
      /* 자격 줄 (2026-10-01) — 장학과 같은 엔진이 판정한다: 나이 범위 ✓ */
      eligibilityLines: ['만 19~34세 대한민국 국민'], noticeLines: ['봉사단은 5개국에 파견합니다.'] },
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
  onboarded: true, common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
};

async function fresh(browser, mode, ext = EXT_FIXTURE) {
  /* 🔴 서비스워커를 막는다 — 새로고침 뒤에는 워커가 data/*.json 을 받아 오므로 page.route 의 가짜
     응답이 **닿지 않는다**(실측: 픽스처 대신 저장소의 빈 파일이 왔다). 이 검사는 탭의 규칙을 재는
     것이지 워커를 재는 것이 아니다(워커는 verify-resume 등이 잰다). 프로필은 초기 스크립트로
     심어 새로고침 없이 한 번에 뜬다. */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem('handaejang.v1')) localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [], docs: {}, notify: {} }));
  }, PROFILE);
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
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await dismissNotify(page);
  return { page, errors };
}

/* 🔴 2026-10-01 — 카드는 장학 카드와 같은 그림(cardShellHtml · button.sch-card[data-activity])이고 누르면 같은 시트가 열린다 */
const cards = (page) => page.$$eval('#activities-list [data-activity]', (els) => els.map((e) => ({
  name: e.querySelector('.sch-name').textContent.trim(),
  org: e.querySelector('.sch-org').textContent.trim(),
})));

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
      await page.$$eval('#external-notices .notice-card .sch-org', (els) => els.map((e) => e.textContent.trim())), ['울진군장학재단 공고', '국가보훈부 공고']);
    eq('홈 — 재단 글이 석 장 이하면 더보기 단추가 없다', await page.$('#external-more'), null);
    eq('홈 — 기간 한 줄은 원문 그대로',
      await page.$eval('#external-notices .notice-card .sch-provider', (e) => e.textContent.trim()), '신청기간 : 2026. 10. 2. ~ 10. 20.');
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
    eq('④ 윗줄은 종류 · 학교 게시판 (장학 카드의 기관 자리)', seen[0].org, '대외활동 · 한국외국어대학교 게시판');
    eq('④ 마감을 읽은 글은 아랫줄 오른쪽 D-5 (장학 카드와 같은 자리·같은 글자)', await page.$eval('#activities-list [data-activity] .sch-foot .sch-due', (e) => e.textContent.trim()), 'D-5');
    eq('④ 아랫줄 왼쪽(장학 카드의 금액 자리)은 짧은 혜택', await page.$eval('#activities-list [data-activity] .sch-foot .sch-amount', (e) => e.textContent.trim()), '항공료 전액 지원');
    /* 판정 하나 — 장학 카드와 같은 cardBadgeHtml (2026-10-01) */
    eq('④ 카드 맨 윗줄 판정 — 나이 맞음 → 적합도 % · 나이 넘음 → 미달 · 자격 줄 없음 → 자격 미확인',
      await page.$$eval('#activities-list .sch-card .sch-top', (e) => e.map((x) => (x.querySelector('.sch-fit, .badge') || {}).textContent || '').map((t) => t.trim().replace(/\d+%/, 'N%'))),
      ['적합도 N%', '지원 자격 미달', '자격 미확인']);
    eq('④ 혜택이 없으면 분야를 옅게 — 없으면 빈칸(지어내지 않는다)', await page.$$eval('#activities-list [data-activity] .sch-amount', (e) => e.map((x) => [x.textContent.trim(), x.classList.contains('unknown')])), [['항공료 전액 지원', false], ['', true], ['', true]]);
    eq('④ 카드에 발췌 줄을 쌓지 않는다 (장학 카드처럼 석 줄)', await page.$$eval('#activities-list .sch-provider', (e) => e.length), 0);
    eq('④ 장학 카드와 같은 그릇 (.sch-card-wrap > button.sch-card)', await page.$$eval('#activities-list .sch-card-wrap > button.sch-card[data-activity]', (e) => e.length), 3);
    /* 누르면 앱을 떠나지 않고 장학과 같은 상세 시트(#detail-sheet)가 열린다 */
    await page.click('#activities-list [data-activity]'); await page.waitForTimeout(500);
    eq('⑤ 누르면 상세 시트가 열린다(앱을 떠나지 않는다)', await page.$eval('#detail-sheet', (e) => !e.hidden && e.classList.contains('show')), true);
    eq('⑤ 시트 — 제목 · 혜택 · 주최/분야 · D-day · 종류', await page.$eval('#detail-sheet', (e) => [
      e.querySelector('.sheet-title').textContent.trim(), e.querySelector('.sheet-amount').textContent.trim(),
      e.querySelector('.sheet-provider').textContent.trim(), e.querySelector('.badge-dday').textContent.trim(), e.querySelector('.badge-kind').textContent.trim()]),
      ['2026 대학생 해외봉사단 모집', '항공료 전액 지원', '한국외국어대학교 게시판 · 봉사', 'D-5', '대외활동']);
    eq('⑤ 모집 안내는 원문 발췌 그대로 (혜택은 위에 한 번만)', await page.$$eval('#detail-sheet .doc-list', (u) => u[0].querySelectorAll('li').length && [...u[0].querySelectorAll('li')].map((x) => x.textContent.trim())), ['모집기간 · 2026. 10. 1. ~ 10. 15.']);
    eq('⑤ 지원 자격 — 장학 시트와 같은 머리(적합도 · 요건 n개 중 n개 충족)와 ✓ 줄',
      await page.$eval('#detail-sheet', (e) => [e.querySelector('.sheet-verdict h4').textContent.trim(), /요건 1개 중 1개 충족/.test(e.querySelector('.sheet-verdict').textContent),
        [...e.querySelectorAll('.reason-list li')].map((li) => li.textContent.trim())]),
      ['지원 자격', true, ['✓ 만 19~34세 대한민국 국민']]);
    eq('⑤ 지원 가능 알약은 없다(활동 글엔 구조화 조건이 없어 늘 가능 — 거짓 안심)', await page.$$eval('#detail-sheet .status-pill', (e) => e.length), 0);
    eq('⑤ 공고 원문 안내 — 원문 문장 그대로', await page.$$eval('#detail-sheet .doc-list', (u) => u.map((x) => x.textContent.trim()).some((t) => t.includes('봉사단은 5개국에 파견합니다.'))), true);
    eq('⑤ 원문 단추는 그 글 주소를 새 탭으로', await page.$eval('#detail-sheet a.btn-primary', (a) => [a.getAttribute('href'), a.target, a.textContent.trim()]), ['https://dep.hufs.ac.kr/bbs/x/1', '_blank', '원문에서 신청하기 ↗']);
    eq('⑤ 단추 글자에 밑줄이 없다', await page.$eval('#detail-sheet a.btn-primary', (a) => getComputedStyle(a).textDecorationLine), 'none');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    eq('⑤ ESC 로 닫힌다 (장학 시트와 같은 그릇)', await page.$eval('#detail-sheet', (e) => e.hidden || !e.classList.contains('show')), true);
    eq('④ 마감 지난 글은 보이지 않는다', seen.some((c) => /지난 공모전/.test(c.name)), false);
    eq('④ 전국 글은 주최를 말한다', seen[2].org, '대외활동 · 청년재단');
    /* 정렬 — 마감 임박순은 마감을 읽은 글이 앞, 못 읽은 글은 뒤 */
    /* 🔴 정렬은 **탐색 화면과 같은 단추·같은 자리·같은 동작**이다 (2026-09-30 개발자 지시) —
       누르면 기준 목록이 뜨고, 골라야 바뀐다. 머리줄 오른쪽 끝에 선다(갱신 날짜 칸이 없어서). */
    const menuShown = () => page.$eval('#activities-sort-menu', (e) => e.offsetParent !== null);
    eq('③ 처음에는 정렬 목록이 안 보인다', await menuShown(), false);
    await page.click('#activities-sort-btn'); await page.waitForTimeout(200);
    eq('③ 누르면 정렬 목록이 열린다 (탐색 화면과 같은 동작)', await menuShown(), true);
    eq('③   선택지는 셋 — 최근 수집순 · 마감 임박순 · 적합도순(장학 탐색과 같은 잣대 · 2026-10-01)',
      await page.$$eval('#activities-sort-menu [data-sort]', (e) => e.map((x) => x.textContent.trim())), ['최근 수집순', '마감 임박순', '적합도순']);
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
    eq('③ 다시 골라 최근 수집순', await page.$eval('#activities-sort-label', (e) => e.textContent.trim()), '최근 수집순');
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
    eq('⑥ 보관함에 장학과 같은 줄로(둘째 줄은 종류·주최)', await page.evaluate(() => { showScreen('my'); return [...document.querySelectorAll('#my-saved .cal-row')].map((r) => [r.querySelector('.cal-row-name').textContent.trim(), r.querySelector('.cal-row-sub').textContent.trim()]); }),
      [['2026 대학생 해외봉사단 모집', '대외활동 · 한국외국어대학교 게시판']]);
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
    eq('⑥ 달력 날짜를 열면 「내 공고」에 활동 줄(종류·주최 둘째 줄)', await page.evaluate((u) => { const d = calContext().mine.find((x) => x.id === `act:${u}`); const box = document.createElement('div'); box.innerHTML = calDayHtml(d.deadline);
      const row = box.querySelector(`.cal-row[data-detail="act:${u}"]`); return row ? [row.querySelector('.cal-row-name').textContent.trim(), row.querySelector('.cal-row-sub').textContent.trim(), /내 공고/.test(box.textContent)] : null; }, ACT1),
      ['2026 대학생 해외봉사단 모집', '대외활동 · 한국외국어대학교 게시판', true]);
    eq('⑥ 피드가 새로 오면 담아 둔 사본도 새 글로(옛 마감을 말하지 않게)', await page.evaluate((u) => { const s = state.saved.find((x) => x.id === `act:${u}`); s.snap = { ...s.snap, deadline: '2000-01-01' }; refreshActivitySnaps(); return s.snap.deadline !== '2000-01-01'; }, ACT1), true);
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
      ['재단1 공고', '재단2 공고', '재단3 공고']);
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

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 대외활동·공모전 탭 · 재단·지자체 새 공고 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
