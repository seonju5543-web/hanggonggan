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
    const shot = await page.$$eval('#school-news .notice-card', (els) => els.slice(0, 5).map((e) => {
      const img = e.querySelector('img.notice-thumb'); const name = e.querySelector('.sch-name').getBoundingClientRect();
      const r = img && img.getBoundingClientRect();
      return { has: e.classList.contains('has-thumb'), img: !!img, loaded: !!(img && img.complete && img.naturalWidth > 0), w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0,
        right: !!(r && r.left >= name.right - 1), alt: img ? img.getAttribute('alt') : null };
    }));
    eq('⑥ 사진 있는 글 — 오른쪽 72px 정사각 · 실제로 그려짐 · 제목과 안 겹침 · alt 비움', shot[0], { has: true, img: true, loaded: true, w: 72, h: 72, right: true, alt: '' });
    eq('⑥ 사진 파일을 못 받은 글은 그림을 빼고 글자 카드로', shot[1], { has: false, img: false, loaded: false, w: 0, h: 0, right: false, alt: null });
    eq('⑥ 로봇 이름 꼴이 아닌 값(바깥 주소)은 그리지 않는다 · 사진 없는 글은 그림 없음', shot.slice(2).map((c) => c.img || c.has), [false, false, false]);
    eq('⑥ 바깥 주소로 그림을 부르지 않았다', await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /evil\.example/.test(r.name))), false);
    if (process.env.SHOT) await page.$eval('#school-news', (e) => e.scrollIntoView()).then(() => page.locator('#school-news').screenshot({ path: process.env.SHOT }));
    eq('⑤ 페이지 오류 없음', errors, []);
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
