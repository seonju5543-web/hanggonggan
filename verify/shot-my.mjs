/* MY 화면의 '공통 서류정보' 아래 ~ '서류 보관함' 사이 빈칸을 재는 스크립트 (2026-09-17) */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
const { assertOwnServer } = createRequire(import.meta.url)('./onboard-helper.js');

const EXE = process.env.CHROME_PATH;
/* 🔴 포트를 박지 않는다 — 이 저장소는 작업 폴더를 여럿 두고 써서 8123 에 **남의 워크트리
   서버**가 떠 있을 수 있다(CLAUDE.md 「매 세션 이것만은」 2번). 내 코드를 재고 있는지는
   drive.js 와 같은 `assertOwnServer` 로 확인한다 — 안 하면 '실측했다'는 근거가 남의 화면이 된다. */
const PORT = process.env.PORT || 8123;
const BASE = `http://localhost:${PORT}`;
await assertOwnServer(PORT);
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.addInitScript(() => {
  localStorage.setItem('handaejang.v1', JSON.stringify({
    profile: {
      school: '한국외국어대학교', campus: '서울캠퍼스', major: '경영학과',
      year: 3, gpa: 3.8, income: 5, bracket: 5, status: '재학', flags: [], name: '이선주',
    },
    apps: [], docs: {}, onboarded: true,
  }));
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
/* 알림 동의 시트가 뜨면 먼저 닫는다 — 안 닫으면 탭 클릭이 막힌다 */
await page.click('#btn-nf-later').catch(() => {});
await page.waitForTimeout(800);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(600);
await page.click('[data-nav="my"]').catch(() => {});
await page.waitForTimeout(1500);

/* #my-profile 안의 마지막 요소들과 그다음 형제들의 위치를 잰다 */
const boxes = await page.evaluate(() => {
  const out = [];
  const prof = document.querySelector('#my-profile');
  const push = (label, el) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    out.push({
      label,
      tag: el.tagName.toLowerCase(),
      cls: el.className || '',
      top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
      mt: cs.marginTop, mb: cs.marginBottom, pt: cs.paddingTop, pb: cs.paddingBottom,
      empty: el.textContent.trim() === '',
    });
  };
  if (prof) {
    push('#my-profile', prof);
    [...prof.children].forEach((el, i) => push(`  └ prof child ${i}`, el));
    let n = prof.nextElementSibling;
    let i = 0;
    while (n && i < 6) { push(`다음 형제 ${i}`, n); n = n.nextElementSibling; i++; }
  }
  push('.wallet-title 부모', document.querySelector('.wallet-title')?.parentElement);
  return out;
});
console.log(JSON.stringify(boxes, null, 1));

const card = await page.$('#screen-my');
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: `${import.meta.dirname}/shot-my.png`, clip: { x: 0, y: 0, width: 390, height: 560 } });
await browser.close();
console.log('촬영 완료');
