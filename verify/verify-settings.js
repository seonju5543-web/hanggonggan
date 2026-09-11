/* 설정 화면 검증 — 2026-09-11 개발자 목업 승인분을 **그대로** 지킨다.
   승인받은 것: ① 뒤로 + '설정'  ② 계정(로그인·회원가입)  ③ 알림(상태줄 + 켜기 + 스위치 5개)
   같은 지시에서 말로 덧붙인 것: 휴지통 · 이용약관 · 탈퇴
   🔴 여기 적힌 문구·개수를 바꾸려면 **개발자에게 다시 보여 주고 승인받은 뒤** 이 검사도 같이 고친다.
      검사만 고치고 화면을 바꾸는 것은 2026-08-27 사고의 반복이다.
   실행: CHROME_PATH=... node verify/verify-settings.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;
const SHOT = process.env.SHOT_DIR || '/tmp/shots';

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  /* 🔴 목업과 나란히 두고 볼 수 있어야 하므로 **폰 크기**로 잰다.
     넓은 창으로 찍으면 글자가 작아져 읽을 수 없는 증거가 된다. */
  const ctx = await browser.newContext({ viewport: { width: 430, height: 940 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    /* 서버(Supabase)로 못 나가는 것은 샌드박스 사정이지 앱의 결함이 아니다 */
    if (/Failed to load resource|supabase|net::ERR/i.test(t)) return;
    errors.push('CONSOLE: ' + t);
  });

  await page.addInitScript(() => {
    localStorage.removeItem('handaejang.resume');
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
        year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
        nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} },
      applications: [
        { id: 'reg-hufs-myeonhak', appliedAt: '2026-08-01', step: 0 },
        { id: 'reg-hufs-alumni', appliedAt: '2026-08-02', step: 0 },
      ],
    }));
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await dismissNotify(page);
  await page.waitForTimeout(300);

  console.log('\n■ MY 화면 — 계정·알림은 여기 없고, 오른쪽 위에 설정이 있다');
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#screen-my:not([hidden])');
  await page.waitForTimeout(400);
  eq('오른쪽 위에 설정(톱니) 버튼이 있다', await page.$eval('#btn-open-settings', (e) => e.offsetParent !== null), true);
  eq('MY 안에서는 계정 절이 안 보인다', await page.$eval('#my-account', (e) => e.offsetParent !== null), false);
  eq('MY 안에서는 알림 절이 안 보인다', await page.$eval('#my-notify', (e) => e.offsetParent !== null), false);
  await page.screenshot({ path: `${SHOT}/my.png` });

  console.log('\n■ 설정 화면 — 승인받은 목업 그대로인가');
  await page.click('#btn-open-settings');
  await page.waitForSelector('#screen-settings:not([hidden])');
  await page.waitForTimeout(500);
  eq('제목이 "설정"', (await page.textContent('#screen-settings .sub-header h2')).trim(), '설정');
  eq('왼쪽 위에 뒤로 버튼이 있다', await page.$eval('#btn-settings-back', (e) => e.offsetParent !== null), true);
  eq('MY 탭이 켜진 채로 남는다 (여기가 MY 안쪽이라는 표시)',
    await page.$eval('.nav-item[data-nav="my"]', (e) => e.classList.contains('active')), true);

  eq('계정 절 제목', (await page.textContent('#my-account .acc-head')).trim(), '계정');
  eq('계정 버튼 둘 — 로그인 · 회원가입',
    await page.$$eval('#my-account .acc-actions .btn', (els) => els.map((e) => e.textContent.trim())),
    ['로그인', '회원가입']);
  eq('로그인이 채워진 버튼(primary)이다',
    await page.$eval('#btn-acc-in', (e) => e.classList.contains('btn-primary')), true);
  eq('회원가입이 테두리 버튼(outline)이다',
    await page.$eval('#btn-acc-up', (e) => e.classList.contains('btn-outline')), true);

  eq('알림 절 제목', (await page.textContent('#my-notify .wallet-title')).trim(), '알림');
  eq('알림 상태 줄이 있다', (await page.textContent('#my-notify .nf-status')).trim().length > 0, true);
  eq('오른쪽에 켜기 버튼', (await page.textContent('#btn-nf-toggle')).trim(), '켜기');
  /* 🔴 다섯 줄의 **문구와 순서**가 목업과 같아야 한다. 하나라도 달라지면 여기서 걸린다. */
  eq('알림 스위치 5줄이 목업과 같다',
    await page.$$eval('#my-notify .nf-pref-text strong', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())),
    ['내 조건에 맞는 새 장학 공고', '마감 하루 전 · 마감 당일', '제출 기록 안 한 공고',
      '우리 학교 게시판 새 공고', '마감 지난 공고 결과 기록']);
  eq('스위치가 5개', await page.$$eval('#my-notify .nf-switch', (e) => e.length), 5);

  console.log('\n■ 덧붙인 세 줄 — 휴지통 · 이용약관 · 탈퇴');
  eq('메뉴 세 줄',
    await page.$$eval('.set-menu .my-menu-item', (els) => els.map((e) => e.textContent.trim())),
    ['휴지통', '이용약관 · 개인정보처리방침', '탈퇴']);
  eq('탈퇴는 빨간 줄이다', await page.$eval('#btn-withdraw', (e) => e.classList.contains('danger')), true);
  eq('이용약관은 terms.html 로 간다',
    await page.$eval('.set-menu a.my-menu-item', (e) => e.getAttribute('href')), 'terms.html');
  await page.screenshot({ path: `${SHOT}/settings.png` });

  console.log('\n■ 휴지통 — 비어 있을 때');
  await page.click('#btn-open-trash');
  await page.waitForSelector('#screen-trash:not([hidden])');
  await page.waitForTimeout(400);
  eq('제목이 "휴지통"', (await page.textContent('#screen-trash .sub-header h2')).trim(), '휴지통');
  eq('빈 휴지통 안내가 뜬다', await page.$$eval('.trash-empty', (e) => e.length), 1);
  await page.screenshot({ path: `${SHOT}/trash-empty.png` });
  await page.click('#btn-trash-back');
  await page.waitForSelector('#screen-settings:not([hidden])');
  eq('뒤로 누르면 설정으로 돌아온다', await page.$eval('#screen-settings', (e) => e.hidden), false);

  console.log('\n■ 지운 신청내역이 휴지통에 남고, 되살릴 수 있다');
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(400);
  const before = await page.$$eval('#apps-list .swipe-row', (e) => e.length);
  eq('신청내역 2건으로 시작', before, 2);
  await page.click('#apps-select-toggle');
  await page.waitForTimeout(200);
  await page.click('#apps-list .row-check');
  await page.waitForTimeout(200);
  await page.click('#apps-delete-selected');
  await page.waitForTimeout(500);
  eq('한 건 지워져 1건 남는다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 1);

  await page.click('.nav-item[data-nav="my"]');
  await page.click('#btn-open-settings');
  await page.waitForSelector('#screen-settings:not([hidden])');
  await page.click('#btn-open-trash');
  await page.waitForSelector('#screen-trash:not([hidden])');
  await page.waitForTimeout(400);
  eq('휴지통에 1건이 담겨 있다', await page.$$eval('#trash-body .wallet-row', (e) => e.length), 1);
  eq('무엇을 언제 지웠는지 적혀 있다',
    /신청내역 · (오늘|어제|\d+일 전에) 지움/.test(await page.textContent('#trash-body .wallet-status')), true);
  await page.screenshot({ path: `${SHOT}/trash-items.png` });

  await page.click('#trash-body [data-trash-back]');
  await page.waitForTimeout(600);
  eq('되살리면 휴지통이 빈다', await page.$$eval('#trash-body .wallet-row', (e) => e.length), 0);
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(400);
  eq('신청내역이 2건으로 돌아왔다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 2);

  console.log('\n■ 이용약관 화면 — 되돌아가기는 왼쪽 위, 제목이 화면 안에 든다');
  {
    /* 🔴 **좁은 폰(320px)까지 본다.** 개발자가 지적한 것이 '박스 안에 안 맞는다'였고,
       390px 에서는 아슬아슬하게 들어가 눈에 안 띄었다 — 좁은 쪽에서 재야 보인다. */
    const t = await ctx.newPage();
    await t.setViewportSize({ width: 320, height: 900 });
    await t.goto(`http://localhost:${PORT}/terms.html`, { waitUntil: 'domcontentloaded' });
    await t.waitForTimeout(300);
    eq('왼쪽 위에 되돌아가기 화살표가 있다', await t.$$eval('.legal-header .sub-back', (e) => e.length), 1);
    eq('그 화살표가 앱으로 간다', await t.$eval('.legal-header .sub-back', (e) => e.getAttribute('href')), './');
    eq('맨 아래 되돌아가기 버튼은 없앴다', await t.$$eval('.legal-actions', (e) => e.length), 0);
    eq('제목이 화면 밖으로 나가지 않는다',
      await t.evaluate(() => {
        const r = document.querySelector('.legal-header h2').getBoundingClientRect();
        return r.right <= document.documentElement.clientWidth && r.left >= 0;
      }), true);
    eq('페이지 전체가 가로로 넘치지 않는다',
      await t.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await t.close();
  }

  console.log(errors.length ? '\n❌ 오류:\n' + errors.join('\n') : '\n✓ 콘솔 오류 없음');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 설정 화면 검증 전부 통과');
  process.exit(fail ? 1 : 0);
})();
