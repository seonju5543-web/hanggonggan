/* 온보딩 특별자격 — 칸 사이 간격이 고른가 (2026-08-26)
   개발자 지적: "다문화 가정이랑 공인 외국어성적 보유 칸 사이의 간격이 다른데보다 넓네."
   원인은 목록이 두 덩어리(#in-flags · #in-extra)로 나뉘어 있어 **그 경계만**
   margin-bottom(20px)을 타고, 칸 사이는 gap(10px)이었기 때문이다.
   눈에는 한 목록으로 보이므로 간격도 하나여야 한다.
   🔴 이건 **재 봐야 보이는 결함**이다 — 코드만 읽으면 두 값이 다른 줄 모른다.
   실행: node verify/verify-onboard-gaps.js   (CHROME_PATH + localhost:8123) */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '한국외국어'); await page.waitForTimeout(250);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-track .chip[data-value="humanities"]');
  await page.fill('#in-major', '영어학과'); await page.fill('#in-name', '김한장');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '3.5'); await page.fill('#in-credits', '15');
  await page.selectOption('#in-bracket', '5'); await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  await page.waitForTimeout(400);

  const gaps = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.onboard-step[data-step="3"] .check-item')]
      .filter((e) => e.offsetParent !== null);
    const out = [];
    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1].getBoundingClientRect();
      const cur = items[i].getBoundingClientRect();
      out.push({ after: items[i - 1].textContent.trim().slice(0, 14), gap: Math.round(cur.top - prev.bottom) });
    }
    return out;
  });

  console.log('■ 특별자격 칸 사이 간격');
  gaps.forEach((g) => console.log(`   ${String(g.gap).padStart(3)}px  ${g.after} 아래`));
  eq('보이는 칸이 8개보다 많다 (검사가 헛돌지 않는다)', gaps.length >= 8, true);
  eq('간격이 전부 같다', [...new Set(gaps.map((g) => g.gap))].length, 1);
  /* 덩어리 경계(다문화 가정 → 공인 외국어성적)가 나머지와 같은지 콕 집어 본다 */
  const edge = gaps.find((g) => g.after.includes('다문화'));
  eq('다문화 가정 아래 간격이 나머지와 같다', edge && edge.gap === gaps[0].gap, true);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 온보딩 간격 통과');
  process.exit(fail ? 1 : 0);
})();
