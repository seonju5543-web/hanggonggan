/** 전수 넘침 측정 — 145건 × 템플릿 3벌 = 435장을 한 브라우저로 훑는다(약 3분).
 *  🔴 렌더러의 CSS·카드·재료를 **이름으로 떼어다** 쓴다 — 베끼면 판형을 고쳤을 때
 *     이 도구만 옛 판형을 재게 된다. 실행: node insta/sweep-overflow.mjs
 *  (예전 머리말) — 렌더러의 CSS·카드·재료를 그대로 가져다 쓴다(베끼지 않는다). */
import { chromium } from 'playwright';
import { shrinkToFit, overflowing } from './fit.mjs';
import { readFileSync } from 'node:fs';
import { writeFileSync, unlinkSync } from 'node:fs';
const src = readFileSync(new URL('render.mjs', import.meta.url), 'utf8')
  .replace(/^\/\/ ── 실행 ─+[\s\S]*$/m, 'export { TPL, context, SKINS, W, H };');
writeFileSync(new URL('_lib.mjs', import.meta.url), src);
const m = await import('./_lib.mjs');
unlinkSync(new URL('_lib.mjs', import.meta.url));
const j = JSON.parse(readFileSync(new URL('../data/kosaf-open.json', import.meta.url), 'utf8'));
const items = j.items || j;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: m.W, height: m.H } });
let bad = 0;
for (const x of items) {
  const seed = [...(x.org + x.name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  for (const [name, t] of Object.entries(m.TPL)) {
    await page.setContent(`<style>${t.css(m.SKINS.blue)}</style>`
      + t.cards(m.context(x, new Date(), m.SKINS.blue, seed, x.school || null)).join(''));
    await page.waitForLoadState('networkidle');
    await page.evaluate(shrinkToFit);          // 🔴 렌더러와 **같은 파일**로 줄인다
    const over = await page.evaluate(overflowing);
    if (over.length) { bad++; console.log(`✗ ${name} ${over.join('·')}장 — ${x.org} ${x.name}`); }
  }
}
await b.close();
console.log(`\n${items.length}건 × 3벌 = ${items.length * 3}  ·  넘침 ${bad}`);
