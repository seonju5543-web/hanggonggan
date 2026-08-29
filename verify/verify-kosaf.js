/* 층2(한국장학재단 목록) 검증 (2026-08-30 — docs/designs/kosaf-and-narrowing.md ②)
   🔴 이 드라이버가 지키는 것은 **정직함**이다. 층2는 우리가 원문을 읽은 것이 아니라
      재단이 KOSAF 에 적어 둔 칸이라, 자격 진단·양식 작성을 붙이면 안 된다:
        ① 층1 카드와 섞이지 않는가 (#explore-list 는 그대로인가)
        ② 판정 배지(적합도·지원 가능)를 달지 않는가
        ③ '자격은 재단 홈페이지에서 확인'을 실제로 말하는가
        ④ 첨부(선발공고문) 주소가 화면에 없는가 — Referer 검사라 학생이 못 받는다
        ⑤ 마감이 지난 재단이 섞이지 않는가
   실행: node verify/verify-kosaf.js   (CHROME_PATH + PORT) */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

const PROFILE = {
  name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
  year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울',
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {},
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript((p) => localStorage.setItem('handaejang.v1',
    JSON.stringify({ profile: p, applications: [] })), PROFILE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {}); else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForSelector('#kosaf-list .sch-card', { timeout: 8000 });

  console.log('■ 층1과 층2가 섞이지 않는다');
  eq('층2 카드가 떴다', (await page.$$('#kosaf-list [data-kosaf]')).length > 0, true);
  eq('층2 카드는 층1 목록(#explore-list) 안에 없다',
    await page.$$eval('#explore-list [data-kosaf]', (e) => e.length), 0);
  eq('층1 카드는 층2 목록 안에 없다',
    await page.$$eval('#kosaf-list [data-detail]', (e) => e.length), 0);

  console.log('\n■ 판정을 지어내지 않는다 (원칙 8-1)');
  eq('층2 카드에 적합도 배지가 없다',
    await page.$$eval('#kosaf-list .badge-fit, #kosaf-list [class*="fit"]', (e) => e.length), 0);
  const head = await page.$eval('#kosaf-list', (e) => e.textContent);
  eq('「자격 진단·신청서 작성은 지원하지 않아요」를 말한다', /자격 진단.*지원하지 않아요/.test(head), true);
  eq('「재단 홈페이지에서 꼭 확인」을 말한다', /재단 홈페이지에서 꼭 확인/.test(head), true);

  console.log('\n■ 상세 시트');
  await page.click('#kosaf-list [data-kosaf]');
  await page.waitForSelector('#detail-sheet:not([hidden])', { timeout: 4000 });
  await page.waitForTimeout(300);
  const sheet = await page.$eval('#detail-sheet', (e) => e.textContent);
  eq('재단이 적어 둔 칸을 「그대로」 옮긴다고 밝힌다', /그대로/.test(sheet), true);
  eq('  자격 판정·신청서를 안 해 준다고 밝힌다', /자격을 판정하거나 신청서를 만들어 주지 않아요/.test(sheet), true);
  /* 🔴 시트 그릇은 층1과 같은 마크업이어야 쓸어 닫기·여백이 갈라지지 않는다 */
  eq('  층1과 같은 시트 마크업을 쓴다',
    await page.$$eval('#detail-sheet .sheet-handle, #detail-sheet .sheet-body', (e) => e.length), 2);
  eq('같은 금액 문단이 두 번 나오지 않는다', await page.$eval('#detail-sheet', (e) => {
    const a = e.querySelector('.sheet-amount');
    return a ? [...e.querySelectorAll('.doc-list li')].filter((li) => li.textContent.includes(a.textContent.trim())).length : 0;
  }), 0);
  eq('신청·양식 작성 버튼이 없다',
    await page.$$eval('#detail-sheet button', (b) => b.filter((x) => /신청|양식|작성/.test(x.textContent)).length), 0);
  /* 🔴 KOSAF 첨부는 Referer 검사가 있어 앱에서 누르면 "비정상적인 접근"이 뜬다 */
  eq('KOSAF 첨부 내려받기 주소가 화면에 없다',
    await page.$$eval('#detail-sheet a', (a) => a.filter((x) => /kosaf\.go\.kr.*(download|file|Attach)/i.test(x.href)).length), 0);
  eq('바깥으로 나가는 링크는 새 탭 + noopener 다',
    await page.$$eval('#detail-sheet a[target="_blank"]', (a) => a.every((x) => /noopener/.test(x.rel))), true);

  console.log('\n■ 데이터');
  const data = await page.evaluate(() => ({
    n: kosafList.length,
    past: kosafList.filter((i) => i.due < new Date().toISOString().slice(0, 10)).length,
    badHome: kosafList.filter((i) => i.home && !/^https?:\/\//.test(i.home)).length,
    loan: kosafList.filter((i) => /연\s?이율|상환기간|대여한도|대부/.test(i.fields['지원금액'] || '')).length,
    longAmount: [...document.querySelectorAll('#kosaf-list .sch-amount')]
      .filter((e) => e.textContent.length > 60).length,
    closedShown: [...document.querySelectorAll('#kosaf-list .badge-dday')]
      .filter((e) => /마감/.test(e.textContent)).length,
    noDue: kosafList.filter((i) => !i.due).length,
  }));
  eq(`마감 지난 재단이 섞이지 않았다 (${data.n}곳)`, data.past, 0);
  /* 🔴 갚아야 하는 돈을 '받을 수 있는 장학금'에 넣으면 기망이다 (운영 원칙 2) */
  eq('대여(대출) 상품이 섞이지 않았다', data.loan, 0);
  /* 🔴 받아 둔 파일은 며칠만 지나도 낡는다 — 마감 판정은 **그릴 때마다** 다시 해야 한다 */
  eq('화면에 「마감」 배지가 달린 층2 카드가 없다', data.closedShown, 0);
  /* 🔴 마감일 칸이 빈 재단을 버리면 **지금 모집 중인 것을 통째로 잃는다**
     (한국장학재단 푸른등대 4곳 — 해 없는 학기 일정이라 칸만 비어 있다) */
  eq('마감일 칸이 비어도 버리지 않는다', data.noDue > 0, true);
  /* 🔴 목록은 30장 상한이고 마감일 미상은 맨 뒤라 화면에 안 뜬다 — **화면만 보면 못 잰다.**
     그래서 진짜 렌더러에 마감일 미상만 넣어 그리고, 그 결과를 본다(층1 what-shows 와 같은 정신). */
  eq('  그 카드는 D-day 대신 「기간 원문 확인」이라고 적는다', await page.evaluate(() => {
    const all = kosafList;
    kosafList = all.filter((i) => !i.due);
    const n = kosafList.length;
    renderExplore();
    const badges = [...document.querySelectorAll('#kosaf-list .badge-dday')].map((e) => e.textContent.trim());
    kosafList = all; renderExplore();
    return badges.length === n && badges.every((t) => t === '기간 원문 확인');
  }), true);
  eq('  상세 시트도 같은 문구를 쓴다', await page.evaluate(() => {
    openKosafDetail(kosafList.find((i) => !i.due).code);
    const t = document.querySelector('#detail-sheet .badge-dday').textContent.trim();
    dismissSheet ? dismissSheet() : document.querySelector('#sheet-backdrop').click();
    return t;
  }), '기간 원문 확인');
  eq('카드의 금액 줄이 카드를 밀어낼 만큼 길지 않다', data.longAmount, 0);
  eq('주소가 http(s) 가 아닌 것이 없다 (콜론 빠진 원본을 그대로 넘기면 우리 사이트로 간다)', data.badHome, 0);

  console.log('\n■ 필터');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('.filter-chip[data-filter="교내"]');
  await page.waitForTimeout(400);
  eq('「교내」에서는 층2가 안 보인다', await page.$eval('#kosaf-list', (e) => e.innerHTML.trim()), '');
  await page.click('.filter-chip[data-filter="교외"]');
  await page.waitForTimeout(400);
  eq('「교외」에서는 보인다', (await page.$$('#kosaf-list [data-kosaf]')).length > 0, true);
  /* 층2는 자격을 판정하지 않으므로 '신청 가능만'에 들어가면 그 칩이 거짓말이 된다 */
  await page.click('.filter-chip[data-filter="eligible"]');
  await page.waitForTimeout(400);
  eq('「신청 가능만」에서는 안 보인다', await page.$eval('#kosaf-list', (e) => e.innerHTML.trim()), '');

  eq('콘솔 오류 없음', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 층2(한국장학재단) 검증 통과');
  process.exit(fail ? 1 : 0);
})();
