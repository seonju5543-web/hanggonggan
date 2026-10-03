/* 시·군 표가 화면과 판정에 한 벌로 살아 있는가 (2026-10-03 개발자 지시 "완벽하게")
   표(REGION_CITIES)를 data.js 에서 parse-requirements.js 로 옮겼다 — 서비스워커(알림)도 그 파일을 읽어
   `구리시 거주` 를 시·군을 안 고른 학생에게도 판정하려고. 옮기면 깨질 수 있는 곳이 둘이다:
     ① 온보딩의 시·군 고르기(app.js fillRegionCities)가 빈 목록이 된다 — Node 검사로는 안 보인다
     ② 엔진의 **브라우저 목록**(match-engine 의 PR 전역 묶음)에 provincesOfCity 를 빠뜨리면 Node 는 통과하고 앱은 죽는다
   그래서 실제 브라우저 순서로 실어 잰다.
   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         CHROME_PATH=... PORT=<포트> node verify/verify-region-city.js
   🔴 **PORT= 를 반드시 준다** — 8123 에는 다른 워크트리 서버가 떠 있을 수 있다. */
const { chromium } = require('playwright-core');
const { assertOwnServer } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  /* ① 온보딩의 시·군 목록 — 시·도를 고르면 그 시·도의 시·군이 채워진다 */
  const cities = await page.evaluate(() => {
    const prov = document.querySelector('#in-region');
    const city = document.querySelector('#in-region-city');
    if (!prov || !city) return null;
    prov.value = '경기';
    prov.dispatchEvent(new Event('change', { bubbles: true }));
    return [...city.options].map((o) => o.value).filter(Boolean);
  });
  eq('① 시·도(경기)를 고르면 시·군 목록이 채워진다(구리시 포함 · 31곳)', cities && [cities.includes('구리시'), cities.length], [true, 31]);

  /* ② 판정 — 브라우저에 실린 엔진이 시·군 → 시·도 표를 쓴다 */
  const verdicts = await page.evaluate(() => {
    const p = { region: '서울', parentRegion: '서울', regionCity: '', parentRegionCity: '' };
    return [requirementMatch('구리시 거주 청년', p, {}), requirementMatch('구리시 거주 청년', { ...p, region: '경기', regionCity: '구리시' }, {})];
  });
  eq('② 브라우저 엔진 — 시·군 안 고른 서울 학생에게 `구리시 거주` 는 미달 · 구리시 학생은 충족', verdicts, ['no', 'ok']);
  eq('  페이지 오류 없음', errors, []);

  await browser.close();
  console.log(fail ? `\n✕ ${fail}건 실패` : '\n✓ 시·군 표 검사 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
