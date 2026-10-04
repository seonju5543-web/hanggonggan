/* 교내 소식 — 홈 첫 화면 「우리 학교 소식」 사진 카드 띠 (2026-10-04 개발자 승인 시안 1안) + 「전체 보기」 시트 — 진짜 브라우저로 누른다.
   (2026-09-30 첫 구역은 홈 아래쪽 목록이었다 — 2026-10-04 띠로 옮기며 그 구역 #school-news 는 뺐다)
   무엇을 재나
     ① 자리 — 아이콘 네 칸(히어로) 바로 밑 · 「나에게 맞는 장학금」 위 · 제목 「우리 학교 소식」 · 「전체 보기」
     ② 학교 범위 — 내 학교 글만 · 숨긴 글은 안 보인다 · 최근 순 · 띠에는 네 장
     ③ 카드 윗줄은 「갈래 · MM.DD」(갈래 없으면 날짜만) · 제목은 두 줄까지 · 누르면 그 글(새 탭)
     ④ 크기 — 카드 148px · 사진 148×104 · 띠만 옆으로 넘어가고 페이지는 옆으로 안 밀린다
     ⑤ 받아오기가 실패하면 구역째 숨는다(뼈대가 굳지 않는다) · 페이지 오류 없음
     ⑥ 사진 — 글의 사진 → 없거나 못 받으면 학교 대표 사진 → 그것도 없으면 바탕색 칸 · 바깥 주소는 그리지 않는다
        · 사진 위 「학교 사진」 글자도, 홈의 출처 줄도 없다(10-03·10-04 개발자 지시) · 출처는 앱 권한 · 오픈소스 라이선스 화면의 「사진 출처」
     ⑦ 「전체 보기」 — 시트에 전부(숨긴 글·남의 학교 글 제외) · 카드는 옛 소식 카드 그대로(72px 썸네일) · 출처 줄 없음
   데이터는 **가짜 응답**으로 준다(page.route) — 실제 data/news/ 는 비어 있을 수 있고, 화면 규칙은 데이터가 있을 때 재야 한다.
   파일 이름은 app.js 가 쓰는 규칙(match-engine newsFilesForProfile)으로 만든다(베끼지 않는다).

   🔴 **PORT= 를 반드시 준다** (8123 은 남의 워크트리일 수 있다 — CLAUDE.md 매 세션 2).
   실행: python3 -m http.server <포트> 를 띄운 뒤  CHROME_PATH=... PORT=<포트> node verify/verify-news.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper');
const ME = require('../match-engine.js');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.PORT || 8123;

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

const PROFILE = {
  school: '한국외국어대학교', campus: '', track: 'humanities', major: '',
  year: 3, status: '재학', gpa: 3.5, bracket: 5, flags: [], nationality: 'korean',
  onboarded: true, common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
};
const MY_FILE = ME.newsFilesForProfile(PROFILE)[0];   // data/news/<학교키>.json — 앱이 받는 그 이름
const S = '한국외국어대학교';
const FIXTURE = {
  school: S, updatedAt: '2026-09-30',
  items: [
    { title: '2026학년도 2학기 수강정정 안내', url: 'https://www.hufs.ac.kr/n/1', kind: '학사', school: S, campus: '', foundAt: '2026-09-30', thumb: 'data/news/img/aaaaaaaaaaaaaaaa.webp' },
    /* 사진 파일을 못 받는 글(404) — 그림을 빼고 글자 카드로 돌아가야 한다 */
    { title: '도서관 열람실 운영시간 변경', url: 'https://www.hufs.ac.kr/n/2', kind: '생활', school: S, campus: '', foundAt: '2026-09-30', thumb: 'data/news/img/bbbbbbbbbbbbbbbb.webp' },
    /* 로봇 이름 꼴이 아닌 값 — 그리지 않는다 */
    { title: '총장 담화문', url: 'https://www.hufs.ac.kr/n/3', school: S, campus: '', foundAt: '2026-09-29', thumb: 'https://evil.example/x.jpg' },
    { title: '2026 외대 가을 축제 안내', url: 'https://www.hufs.ac.kr/n/4', kind: '행사', school: S, campus: '', foundAt: '2026-09-29' },
    { title: '학생지원팀 조교 모집', url: 'https://www.hufs.ac.kr/n/5', kind: '채용', school: S, campus: '', foundAt: '2026-09-28' },
    { title: '기숙사 동계 입사 안내', url: 'https://www.hufs.ac.kr/n/6', kind: '생활', school: S, campus: '', foundAt: '2026-09-28' },
    { title: '졸업 사정 결과 확인 안내', url: 'https://www.hufs.ac.kr/n/7', kind: '학사', school: S, campus: '', foundAt: '2026-09-27' },
    /* 숨긴 글 — 파일에는 있지만 화면에는 없어야 한다 */
    { title: '숨긴 글 — 보이면 안 된다', url: 'https://www.hufs.ac.kr/n/8', kind: '학사', school: S, campus: '', foundAt: '2026-09-30', hidden: true },
    /* 다른 캠퍼스 글 — 서울 학생(campus 빈 값)에게는 보인다(캠퍼스를 안 적은 학생은 다 본다) — 그래서 다른 학교 글로 잰다 */
    { title: '다른 학교 글 — 보이면 안 된다', url: 'https://www.khu.ac.kr/n/9', kind: '학사', school: '경희대학교', campus: '', foundAt: '2026-09-30' },
  ],
};

const SCHOOL_PHOTOS = { schools: { [S]: [{ src: 'assets/schools/n19cz03g-0123abcd.webp', focus: '50% 40%', credit: '테스트 작가 · CC BY 3.0', page: 'https://commons.wikimedia.org/wiki/File:Test.jpg' }] } };

async function fresh(browser, mode) {
  /* 서비스워커를 막는다 — 워커가 data/*.json 을 받아 오면 page.route 의 가짜 응답이 닿지 않는다(verify-activities 와 같은 이유) */
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem('handaejang.v1')) localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [], docs: {}, notify: {} }));
  }, PROFILE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(`**/${MY_FILE}*`, (route) => (mode === 'fail'
    ? route.abort()
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) })));
  /* 썸네일 — 하나는 진짜 사진 바이트(정문 사진)로, 하나는 404 로 */
  await page.route('**/data/news/img/aaaaaaaaaaaaaaaa.webp', (route) => route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(__dirname, '..', 'assets/gates/hanyang-1.jpg')) }));
  await page.route('**/data/news/img/bbbbbbbbbbbbbbbb.webp', (route) => route.fulfill({ status: 404, body: 'no' }));
  /* 학교 대표 사진 (2026-10-03) — 목록은 가짜로(진짜 목록이 바뀌어도 검사가 흔들리지 않게), 그림은 진짜 사진 바이트로.
     mode 'nophotos' = 목록을 못 받음 · 'photo404' = 목록은 받았는데 그림을 못 받음 */
  await page.route('**/assets/schools/photos.json*', (route) => (mode === 'nophotos'
    ? route.fulfill({ status: 404, body: 'no' })
    : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SCHOOL_PHOTOS) })));
  await page.route('**/assets/schools/n19cz03g-0123abcd.webp', (route) => (mode === 'photo404'
    ? route.fulfill({ status: 404, body: 'no' })
    : route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(__dirname, '..', 'assets/gates/hufs-3.jpg')) })));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await dismissNotify(page);
  return { page, errors };
}

/* 띠 카드 — 사진 칸·사진·윗줄·제목·크기 */
const tiles = (page) => page.$$eval('#home-news .news-tile', (els) => els.map((e) => {
  const box = e.querySelector('.news-tile-photo').getBoundingClientRect();
  const img = e.querySelector('img.news-tile-img');
  const t = e.querySelector('.news-tile-title');
  return {
    title: t.textContent.trim(), meta: e.querySelector('.news-tile-meta').textContent.trim(), href: e.getAttribute('href'), target: e.getAttribute('target'),
    w: Math.round(e.getBoundingClientRect().width), box: [Math.round(box.width), Math.round(box.height)],
    img: img ? (img.getAttribute('src').match(/[^/]+$/) || [''])[0] : null, loaded: !!(img && img.complete && img.naturalWidth > 0),
    lines: Math.round(t.getBoundingClientRect().height / 19), label: /학교\s*사진/.test(e.textContent), pos: img ? img.style.objectPosition : null,
  };
}));
/* 띠를 화면에 들이고 끝까지 넘겨 늦게 싣기(lazy) 사진까지 부른다 */
const settle = async (page) => {
  await page.$eval('#home-news', (e) => e.scrollIntoView());
  await page.$eval('#home-news .news-strip', (e) => { e.scrollLeft = e.scrollWidth; });
  await page.waitForTimeout(1200);
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });

  /* ── 정상 응답 ── */
  {
    const { page, errors } = await fresh(browser, 'ok');
    eq('① 구역 제목 · 전체 보기', await page.$eval('#home-news', (e) => [e.querySelector('h3').textContent.trim(), e.querySelector('[data-news-all]').textContent.trim(), e.hidden]), ['우리 학교 소식', '전체 보기', false]);
    eq('① 자리 — 히어로(아이콘 네 칸) 다음 · 「나에게 맞는 장학금」 앞 · 옛 아래 구역(#school-news)은 없다', await page.evaluate(() => {
      const hero = document.querySelector('.hero-card'); const news = document.querySelector('#home-news'); const list = document.querySelector('#home-deadline-list');
      return [!!(hero.compareDocumentPosition(news) & Node.DOCUMENT_POSITION_FOLLOWING), !!(news.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING), !!document.querySelector('#school-news')];
    }), [true, true, false]);
    await settle(page);
    const t = await tiles(page);
    eq('② 띠에는 네 장 · 내 학교 글만 · 숨긴 글 제외 · 최근 순', t.map((x) => x.title), ['2026학년도 2학기 수강정정 안내', '도서관 열람실 운영시간 변경', '총장 담화문', '2026 외대 가을 축제 안내']);
    eq('③ 윗줄은 「갈래 · MM.DD」 · 갈래 없으면 날짜만', t.map((x) => x.meta), ['학사 · 09.30', '생활 · 09.30', '09.29', '행사 · 09.29']);
    eq('③ 누르면 그 글 (새 탭)', [t[0].href, t[0].target], ['https://www.hufs.ac.kr/n/1', '_blank']);
    eq('④ 카드 148px · 사진 칸 148×104 · 제목은 두 줄까지', t.map((x) => [x.w, x.box, x.lines <= 2]), Array(4).fill([148, [148, 104], true]));
    eq('⑥ 사진 — 글의 사진 / 못 받은 글의 사진은 학교 사진으로 / 바깥 주소 글·사진 없는 글은 학교 사진 · 모두 그려짐 · 「학교 사진」 글자 없음',
      t.map((x) => [x.img, x.loaded, x.label]), [['aaaaaaaaaaaaaaaa.webp', true, false], ['n19cz03g-0123abcd.webp', true, false], ['n19cz03g-0123abcd.webp', true, false], ['n19cz03g-0123abcd.webp', true, false]]);
    eq('⑥ 학교 사진은 고른 초점으로 — 글의 사진이 깨져 갈아 끼운 카드도 (리뷰 10-04)', t.map((x) => x.pos), ['', '50% 40%', '50% 40%', '50% 40%']);
    eq('⑥ 바깥 주소로 그림을 부르지 않았다', await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /evil\.example/.test(r.name))), false);
    eq('⑥ 홈에 사진 출처 줄이 없다 (설명 글 빼기 · 10-04)', await page.evaluate(() => [!!document.querySelector('#screen-home .news-photo-credit'), /위키미디어/.test(document.querySelector('#screen-home').textContent)]), [false, false]);
    eq('④ 페이지는 옆으로 밀리지 않는다 (띠만 넘어간다)', await page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth), true);
    if (process.env.SHOT) { await page.$eval('#home-news .news-strip', (e) => { e.scrollLeft = 0; }); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: process.env.SHOT }); }
    /* ⑦ 전체 보기 — 시트 */
    await page.click('#home-news [data-news-all]'); await page.waitForTimeout(500);
    const sheet = await page.$eval('#detail-sheet', (e) => ({
      open: !e.hidden, title: e.querySelector('.sheet-title').textContent.trim(),
      names: [...e.querySelectorAll('.notice-card .sch-name')].map((x) => x.textContent.trim()),
      org: e.querySelector('.notice-card .sch-org').textContent.trim(),
      thumbs: [...e.querySelectorAll('.notice-card')].slice(0, 5).map((c) => !!c.querySelector('img.notice-thumb')),
      credit: !!e.querySelector('.news-photo-credit') || /위키미디어/.test(e.textContent),
    }));
    eq('⑦ 시트 — 제목 · 전부(숨긴 글·남의 학교 글 제외) · 윗줄 「학교 공지 · 갈래」 · 출처 줄 없음', [sheet.open, sheet.title, sheet.names, sheet.org, sheet.credit],
      [true, '우리 학교 소식', ['2026학년도 2학기 수강정정 안내', '도서관 열람실 운영시간 변경', '총장 담화문', '2026 외대 가을 축제 안내', '학생지원팀 조교 모집', '기숙사 동계 입사 안내', '졸업 사정 결과 확인 안내'], '한국외국어대학교 공지 · 학사', false]);
    await page.waitForTimeout(1200);
    eq('⑦ 시트 카드 사진 — 글의 사진 · (못 받은 것은 빠짐) · 학교 사진', await page.$$eval('#detail-sheet .notice-card', (els) => els.slice(0, 4).map((c) => { const i = c.querySelector('img.notice-thumb'); return i ? [Math.round(i.getBoundingClientRect().width), i.classList.contains('notice-thumb-school')] : null; })),
      [[72, false], null, [72, true], [72, true]]);
    /* 사진 출처 — 앱 권한 · 오픈소스 라이선스 화면 */
    await page.evaluate(() => { closeSheet(); showScreen('perms'); }); await page.waitForTimeout(800);
    eq('⑥ 사진 출처는 앱 권한 · 오픈소스 라이선스 화면에 (작가·라이선스 · 공용 페이지 링크)', await page.$$eval('#perms-body .perm-sec', (secs) => {
      const sec = secs.find((x) => x.querySelector('.perm-title').textContent.trim() === '사진 출처');
      return sec ? [sec.querySelector('.perm-value').textContent.trim(), sec.querySelector('a').href] : null;
    }), ['테스트 작가 · CC BY 3.0 · 위키미디어 공용', 'https://commons.wikimedia.org/wiki/File:Test.jpg']);
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  /* ── 학교 사진 목록을 못 받음 / 그림을 못 받음 — 사진 칸은 바탕색으로 남고 글의 사진은 그대로 ── */
  for (const mode of ['nophotos', 'photo404']) {
    const { page, errors } = await fresh(browser, mode);
    await settle(page);
    const t = await tiles(page);
    eq(`⑥ ${mode === 'nophotos' ? '목록을 못 받으면' : '그림을 못 받으면'} — 글의 사진은 그대로 · 나머지는 사진 없이 같은 크기 칸`, t.map((x) => [x.img, x.box]), [['aaaaaaaaaaaaaaaa.webp', [148, 104]], [null, [148, 104]], [null, [148, 104]], [null, [148, 104]]]);
    eq(`⑥ ${mode} — 페이지 오류 없음`, errors, []);
    await page.context().close();
  }

  /* ── 받아오기 실패 ── */
  {
    const { page, errors } = await fresh(browser, 'fail');
    await page.waitForTimeout(500);
    eq('⑤ 실패하면 구역째 숨는다 (뼈대가 굳지 않는다)', await page.$eval('#home-news', (e) => [e.hidden, !!e.querySelector('.is-skel')]), [true, false]);
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 교내 소식 띠 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
