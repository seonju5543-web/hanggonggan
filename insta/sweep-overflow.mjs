/** 전수 넘침 측정 — 공고 전수 × 템플릿 3벌을 한 브라우저로 훑는다(약 3분).
 *  🔴 렌더러의 CSS·카드·재료를 **import 해서** 쓴다 — 베끼면 판형을 고쳤을 때
 *     이 도구만 옛 판형을 재게 된다. 실행: node insta/sweep-overflow.mjs — 렌더러의 CSS·카드·재료를 그대로 가져다 쓴다(베끼지 않는다). */
import { chromium } from 'playwright';
import { shrinkToFit, overflowing } from './fit.mjs';
import { readFileSync } from 'node:fs';
import { TPL, context, SKINS, W, H } from './render.mjs';   // 🔴 베끼지 않고 그대로 쓴다
const j = JSON.parse(readFileSync(new URL('../data/kosaf-open.json', import.meta.url), 'utf8'));
const items = j.items || j;
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: W, height: H } });
let bad = 0;
for (const x of items) {
  const seed = [...(x.org + x.name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  for (const [name, t] of Object.entries(TPL)) {
    await page.setContent(`<style>${t.css(SKINS.blue)}</style>`
      + t.cards(context(x, new Date(), SKINS.blue, seed, x.school || null)).join(''));
    await page.waitForLoadState('networkidle');
    await page.evaluate(shrinkToFit);          // 🔴 렌더러와 **같은 파일**로 줄인다
    const over = await page.evaluate(overflowing);
    if (over.length) { bad++; console.log(`✗ ${name} ${over.join('·')}장 — ${x.org} ${x.name}`); }
  }
}
await b.close();
console.log(`\n${items.length}건 × 3벌 = ${items.length * 3}  ·  넘침 ${bad}`);
