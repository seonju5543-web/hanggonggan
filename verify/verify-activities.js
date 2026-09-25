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

const FIXTURE = {
  updatedAt: '2026-09-25',
  items: [
    { title: '2026 대학생 해외봉사단 모집', url: 'https://dep.hufs.ac.kr/bbs/x/1', kind: '대외활동', school: '한국외국어대학교', campus: '', foundAt: '2026-09-25', attachments: [], deadlineHint: '신청기간 : 2026. 10. 1. ~ 10. 15.' },
    { title: '제3회 장학수기 공모전 공고', url: 'https://dep.hufs.ac.kr/bbs/x/2', kind: '공모전', school: '한국외국어대학교', campus: '', foundAt: '2026-09-24', attachments: [] },
    { title: '경희 아이디어 경진대회', url: 'https://news.khu.ac.kr/x/3', kind: '공모전', school: '경희대학교', campus: '', foundAt: '2026-09-25', attachments: [] },
    { title: '전국 청년 서포터즈 모집', url: 'https://example.org/x/4', kind: '대외활동', school: '', host: '청년재단', foundAt: '2026-09-23', attachments: [] },
  ],
};

const PROFILE = {
  school: '한국외국어대학교', campus: '', track: 'humanities', major: '',
  year: 3, status: '재학', gpa: 3.5, bracket: 5, flags: [], nationality: 'korean',
  onboarded: true, common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
};

async function fresh(browser, mode) {
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
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await dismissNotify(page);
  return { page, errors };
}

const cards = (page) => page.$$eval('#activities-list .notice-card', (els) => els.map((e) => ({
  name: e.querySelector('.sch-name').textContent.trim(),
  org: e.querySelector('.sch-org').textContent.trim(),
})));

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });

  /* ── 정상 응답 ── */
  {
    const { page, errors } = await fresh(browser, 'ok');
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
    eq('④ 윗줄은 종류 · 학교 게시판', seen[0].org, '대외활동 · 한국외국어대학교 게시판');
    eq('④ 전국 글은 주최를 말한다', seen[2].org, '대외활동 · 청년재단');
    eq('④ 기간 한 줄은 원문 그대로', await page.$eval('#activities-list .notice-card .sch-provider', (e) => e.textContent.trim()), '신청기간 : 2026. 10. 1. ~ 10. 15.');
    eq('갱신 날짜', await page.$eval('#activities-updated', (e) => e.textContent.trim()), '2026-09-25 갱신');

    await page.click('#activities-filters .filter-chip[data-filter="공모전"]');
    await page.waitForTimeout(200);
    seen = await cards(page);
    eq('③ 공모전 칩', seen.map((c) => c.name), ['제3회 장학수기 공모전 공고']);
    eq('③ 칩 켜짐은 제 줄에서만 — 탐색 화면의 전체 칩은 그대로',
      await page.$eval('#explore-filters .filter-chip[data-filter="all"]', (c) => c.classList.contains('active')), true);
    await page.click('#activities-filters .filter-chip[data-filter="대외활동"]');
    await page.waitForTimeout(200);
    eq('③ 대외활동 칩', (await cards(page)).map((c) => c.name), ['2026 대학생 해외봉사단 모집', '전국 청년 서포터즈 모집']);
    await page.click('#activities-filters .filter-chip[data-filter="all"]');
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
    eq('페이지 오류 없음', errors, []);
    await page.context().close();
  }

  /* ── 받아오기 실패 ── */
  {
    const { page, errors } = await fresh(browser, 'fail');
    await page.click('.nav-item[data-nav="activities"]');
    await page.waitForTimeout(500);
    eq('⑤ 실패해도 뼈대가 아니라 "없어요"', await page.$eval('#activities-list', (e) => e.textContent.includes('없어요') && !e.querySelector('.skel, .skeleton')), true);
    eq('⑤ 갱신 날짜 자리는 기본 문구', await page.$eval('#activities-updated', (e) => e.textContent.trim()), '매일 아침 갱신');
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 대외활동·공모전 탭 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
