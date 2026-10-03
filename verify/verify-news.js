/* 교내 소식 — 홈 「우리 학교 소식」 구역 (2026-09-30 · 개발자 지시 "사용자들 학교에 맞춘 교내 뉴스") — 진짜 브라우저로 누른다.
   무엇을 재나
     ① 홈에 「우리 학교 소식」 구역이 학교 게시판 구역 아래·재단 구역 위에 뜬다
     ② 학교 범위 — 내 학교 글만 (본교 파일에 섞인 다른 캠퍼스 표식 글은 안 보인다) · 숨긴 글은 안 보인다 · 최근 수집 순
     ③ 카드 윗줄이 「학교 공지 · 갈래」를 말한다 · 갈래 없는 글은 「학교 공지」만 · 메타 줄은 수집일 + 원문 보기
     ④ 앞 다섯 장 + 더보기(남은 수) → 누르면 전부 → 접기
     ⑤ 받아오기가 실패해도 뼈대가 아니라 '없어요' 로 내려앉는다 · 페이지 오류 없음
     ⑥ 썸네일 (2026-10-03) — 사진이 있는 글만 오른쪽에 72px 정사각 사진 · 제목과 겹치지 않는다 · 못 받은 사진은 빼고 글자 카드로 ·
        로봇 이름 꼴이 아닌 값(바깥 주소)은 그리지 않는다 · 사진 없는 카드는 예전 그대로(그림 없음)
   데이터는 **가짜 응답**으로 준다(page.route) — 실제 data/news/ 는 첫 수집 전 비어 있을 수 있고, 화면 규칙은 데이터가 있을 때 재야 한다.
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

const cards = (page) => page.$$eval('#school-news .notice-card', (els) => els.map((e) => ({
  name: e.querySelector('.sch-name').textContent.trim(),
  org: e.querySelector('.sch-org').textContent.trim(),
  meta: [...e.querySelectorAll('.sch-provider')].pop().textContent.trim(),
})));

/* 카드마다 썸네일 자리 — 글의 사진은 img.notice-thumb, 학교 사진은 감싼 칸(.notice-thumb-school) 안의 img */
const thumbs = (page) => page.$$eval('#school-news .notice-card', (els) => els.slice(0, 5).map((e) => {
  const box = e.querySelector('.notice-thumb'); const img = box && (box.tagName === 'IMG' ? box : box.querySelector('img'));
  const name = e.querySelector('.sch-name').getBoundingClientRect();
  const r = box && box.getBoundingClientRect();
  const tag = e.querySelector('.thumb-tag');
  return { has: e.classList.contains('has-thumb'), img: !!img, loaded: !!(img && img.complete && img.naturalWidth > 0), w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
    right: !!(r && r.left >= name.right - 1), alt: img ? img.getAttribute('alt') : null, tag: tag ? tag.textContent.trim() : '' };
}));
const settle = async (page) => { await page.$eval('#school-news', (e) => e.scrollIntoView()); await page.waitForTimeout(1200); };

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });

  /* ── 정상 응답 ── */
  {
    const { page, errors } = await fresh(browser, 'ok');
    eq('① 구역 제목', await page.$eval('#school-news h3', (h) => h.textContent.trim()), '우리 학교 소식');
    eq('① 자리 — 학교 게시판 구역 아래 · 재단 구역 위', await page.$$eval('#live-notices, #school-news, #external-notices', (els) => els.map((e) => e.id)), ['live-notices', 'school-news', 'external-notices']);
    eq('① 갱신 날짜를 말한다', await page.$eval('#school-news .section-head .link-btn', (e) => e.textContent.trim()), '2026-09-30 갱신');
    let seen = await cards(page);
    eq('④ 앞 다섯 장만', seen.length, 5);
    eq('② 내 학교 글만 · 숨긴 글 제외 · 최근 수집 순', seen.map((c) => c.name), ['2026학년도 2학기 수강정정 안내', '도서관 열람실 운영시간 변경', '총장 담화문', '2026 외대 가을 축제 안내', '학생지원팀 조교 모집']);
    eq('③ 윗줄은 「학교 공지 · 갈래」', seen[0].org, '한국외국어대학교 공지 · 학사');
    eq('③ 갈래 없는 글은 「학교 공지」만', seen[2].org, '한국외국어대학교 공지');
    eq('③ 메타 줄은 수집일 + 원문 보기 (첨부·마감 없음)', seen[0].meta, '2026-09-30 수집 · 원문 보기 ↗');
    eq('④ 더보기 단추에 남은 수', await page.$eval('#school-news [data-news-more]', (b) => b.textContent.trim()), '더보기 (2)');
    await page.click('#school-news [data-news-more]'); await page.waitForTimeout(200);
    seen = await cards(page);
    eq('④ 누르면 전부 (숨긴 글·남의 학교 글은 여전히 없다)', seen.map((c) => c.name).slice(5), ['기숙사 동계 입사 안내', '졸업 사정 결과 확인 안내']);
    eq('④ 단추는 「접기」', await page.$eval('#school-news [data-news-more]', (b) => b.textContent.trim()), '접기');
    await page.click('#school-news [data-news-more]'); await page.waitForTimeout(200);
    eq('④ 접으면 다시 다섯', (await cards(page)).length, 5);
    /* ⑥ 썸네일 — 구역을 화면에 들인 뒤(늦게 싣기 loading=lazy) 잰다 */
    await page.$eval('#school-news', (e) => e.scrollIntoView());
    await page.waitForTimeout(1200);
    const shot = await thumbs(page);
    eq('⑥ 사진 있는 글 — 오른쪽 72px 정사각 · 실제로 그려짐 · 제목과 안 겹침 · alt 비움 · 「학교 사진」 아님', shot[0], { has: true, img: true, loaded: true, w: 72, h: 72, right: true, alt: '', tag: '' });
    eq('⑥ 사진 파일을 못 받은 글은 그림을 빼고 글자 카드로', shot[1], { has: false, img: false, loaded: false, w: 0, h: 0, right: false, alt: null, tag: '' });
    /* ⑦ 학교 대표 사진 — 글의 사진이 없는 글(바깥 주소였던 글 포함)은 학교 사진 · 같은 자리·같은 크기 · 「학교 사진」 표시 */
    eq('⑦ 사진 없는 글 — 학교 사진이 같은 자리에 72px · 실제로 그려짐 · 「학교 사진」 표시', shot.slice(2), Array(3).fill({ has: true, img: true, loaded: true, w: 72, h: 72, right: true, alt: '', tag: '학교 사진' }));
    eq('⑦ 구역 아래 출처 한 줄 (공용 페이지 링크)', await page.$eval('#school-news .news-photo-credit', (e) => [e.textContent.trim(), e.querySelector('a') && e.querySelector('a').href]), ['학교 사진 · 테스트 작가 · CC BY 3.0 · 위키미디어 공용', 'https://commons.wikimedia.org/wiki/File:Test.jpg']);
    eq('⑥ 바깥 주소로 그림을 부르지 않았다', await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /evil\.example/.test(r.name))), false);
    if (process.env.SHOT) await page.$eval('#school-news', (e) => e.scrollIntoView()).then(() => page.locator('#school-news').screenshot({ path: process.env.SHOT }));
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  /* ── 학교 사진 목록을 못 받음 / 그림을 못 받음 — 글자 카드로 돌아가고 「학교 사진」 표시·출처 줄이 홀로 남지 않는다 ── */
  for (const mode of ['nophotos', 'photo404']) {
    const { page, errors } = await fresh(browser, mode);
    await settle(page);
    const shot = await thumbs(page);
    eq(`⑦ ${mode === 'nophotos' ? '목록을 못 받으면' : '그림을 못 받으면'} 사진 없는 글은 글자 카드 (표시만 남지 않는다)`, shot.slice(2).map((c) => [c.has, c.img, c.tag]), Array(3).fill([false, false, '']));
    eq(`⑦ ${mode} — 글의 사진은 그대로`, [shot[0].img, shot[0].loaded], [true, true]);
    if (mode === 'nophotos') eq('⑦ 목록이 없으면 출처 줄도 없다', await page.$('#school-news .news-photo-credit'), null);
    eq(`⑦ ${mode} — 페이지 오류 없음`, errors, []);
    await page.context().close();
  }

  /* ── 받아오기 실패 ── */
  {
    const { page, errors } = await fresh(browser, 'fail');
    await page.waitForTimeout(500);
    eq('⑤ 실패해도 뼈대가 아니라 "없어요"', await page.$eval('#school-news', (e) => e.textContent.includes('없어요') && !e.querySelector('.skel, .skeleton')), true);
    eq('⑤ 페이지 오류 없음', errors, []);
    await page.context().close();
  }

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 교내 소식 구역 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
