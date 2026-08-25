/* 적합도 배지 검증 — 숫자와 배지가 같은 말을 하는가 (2026-08-24)
   🔴 왜 따로 만들었나: 0%를 안 쓰기로 바꾸면서 `pct === 0`으로 판정하던
   '지원 자격 미달' 배지가 **통째로 사라진 적이 있다**. 배지 로직은 app.js에 있어
   test-collector(순수 모듈 검사)가 닿지 못하므로 진짜 앱을 띄워서 본다.
   개발자 지시(2026-08-24): "숫자는 0을 안 띄우되 지원 자격 미달 배지는 넣어야 돼."
   실행: node verify/verify-fit-badge.js   (CHROME_PATH + localhost:8123 필요) */
const { chromium } = require('playwright-core');

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

const PROFILE = (over) => ({
  name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
  year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {}, ...over,
});

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const errors = [];

  async function open(profileOver) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    await page.addInitScript((p) => localStorage.setItem('handaejang.v1',
      JSON.stringify({ profile: p, applications: [] })), PROFILE(profileOver));
    await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
    await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
    const later = await page.$('#btn-nf-later');
    if (later) await later.click().catch(() => {}); else await page.keyboard.press('Escape');
    await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
    await page.click('.nav-item[data-nav="explore"]');
    await page.waitForTimeout(800);
    return page;
  }

  const badges = (page) => page.$$eval('#explore-list .sch-card', (els) => els.map((e) => {
    const b = e.querySelector('.badge-fit, .badge-fit-unknown, .badge-fit-no');
    return { cls: b ? b.className : '', text: b ? b.innerText.replace(/\s+/g, ' ') : '' };
  }));

  console.log('■ 자격이 안 되는 학생 (휴학 · 평점 2.1 · 9구간)');
  let page = await open({ status: '휴학', gpa: 2.1, bracket: 9, credits: 9 });
  let bs = await badges(page);
  const no = bs.filter((b) => b.cls.includes('badge-fit-no'));
  eq('지원 자격 미달 배지가 뜬다', no.length > 0, true);
  eq('미달 배지 문구', [...new Set(no.map((b) => b.text))], ['지원 자격 미달']);
  eq('미달 배지에는 숫자가 없다', no.some((b) => /\d/.test(b.text)), false);

  console.log('\n■ 100%·0%는 화면에 나오지 않는다 (개발자 지시 2026-08-24)');
  const shown = bs.map((b) => b.text);
  eq('0%가 안 뜬다', shown.some((t) => /적합도 0%/.test(t)), false);
  eq('100%가 안 뜬다', shown.some((t) => /적합도 100%/.test(t)), false);

  console.log('\n■ 자격이 되는 학생');
  await page.context().close();
  page = await open({});
  bs = await badges(page);
  const okBadges = bs.filter((b) => b.cls.includes('badge-fit') && !b.cls.includes('unknown') && !b.cls.includes('-no'));
  eq('적합도 배지에 근거가 함께 붙는다', okBadges.every((b) => /요건 \d+개 중 \d+개 충족/.test(b.text)), true);
  eq('여기서도 100%는 안 뜬다', bs.some((b) => /적합도 100%/.test(b.text)), false);

  /* 🔴 배지가 말하는 것과 상세가 보여 주는 것이 같아야 한다 — 배지가 '요건 9개'라는데
     시트에 5줄만 뜨면 학생이 세어 봤을 때 숫자가 안 맞는다(화면 5줄 상한 사고). */
  console.log('\n■ 배지의 요건 개수 = 상세 시트의 줄 수');
  const idx = await page.$$eval('#explore-list .sch-card',
    (els) => els.findIndex((e) => /요건 \d+개/.test((e.querySelector('.badge-fit') || {}).innerText || '')));
  if (idx >= 0) {
    const cards = await page.$$('#explore-list .sch-card');
    const txt = await cards[idx].$eval('.badge-fit', (e) => e.innerText.replace(/\s+/g, ' '));
    const total = Number((txt.match(/요건 (\d+)개/) || [])[1]);
    await cards[idx].click();
    await page.waitForTimeout(700);
    const lines = await page.$$eval('#detail-sheet li.r-ok, #detail-sheet li.r-bad, #detail-sheet li.r-req', (e) => e.length);
    eq(`배지 '${txt}' 의 요건 수와 상세 줄 수가 같다`, lines, total);
  } else console.log('  (요건 개수를 띄운 카드가 없어 건너뜀)');

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 적합도 배지 전부 통과');
  process.exit(fail ? 1 : 0);
})();
