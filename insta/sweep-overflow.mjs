/** 전수 넘침 측정 — 공고 전수 × 판형 전부를 한 브라우저로 훑는다(판형당 약 1분).
 *  🔴 렌더러의 CSS·카드·재료를 **import 해서** 쓴다 — 베끼면 판형을 고쳤을 때
 *     이 도구만 옛 판형을 재게 된다. 판형 목록도 렌더러와 같은 `loadTemplates()` 로 받는다 —
 *     바깥 판형 파일(insta/templates/)을 빠뜨리면 그 판형은 아무도 안 재는 것과 같다.
 *  실행: node insta/sweep-overflow.mjs [--tpl=번호|id]   (안 주면 전부) */
import { chromium } from 'playwright';
import { shrinkToFit, overflowing } from './fit.mjs';
import { loadTemplates, resolveTpl, tplLabel, KIT, context, SKINS, W, H } from './render.mjs';   // 🔴 베끼지 않고 그대로 쓴다
import { allNotices } from './notices.mjs';                 // 🔴 교외·교내를 같이 잰다
const { items } = allNotices();
const ALL = await loadTemplates();
const want = process.argv.find((a) => a.startsWith('--tpl='))?.slice(6);
const tpls = want ? [resolveTpl(ALL, want)].filter(Boolean) : Object.values(ALL).sort((a, b) => a.no - b.no);
if (!tpls.length) { console.error(`판형 '${want}' 없음`); process.exit(1); }
const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await b.newPage({ viewport: { width: W, height: H } });
// 개발용 중계 — render.mjs 와 같은 이유(샌드박스는 브라우저가 폰트를 못 받는다)
if (process.env.INSTA_DEV_FONT_RELAY) await page.route(/^https:\/\//, async (route, req) => {
  try { const r = await fetch(req.url()); route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || '' }, body: Buffer.from(await r.arrayBuffer()) }); }
  catch { route.abort(); }
});
let bad = 0;
for (const x of items) {
  const seed = [...(x.org + x.name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  for (const t of tpls) {
    await page.setContent(`<style>${t.css(SKINS.blue, KIT)}</style>`
      + t.cards(context(x, new Date(), SKINS.blue, seed, x.school || null), KIT).join(''));
    await page.waitForLoadState('networkidle');
    await page.evaluate(shrinkToFit);          // 🔴 렌더러와 **같은 파일**로 줄인다
    const over = await page.evaluate(overflowing);
    if (over.length) { bad++; console.log(`✗ ${tplLabel(t)} ${over.join('·')}장 — ${x.org} ${x.name}`); }
  }
}
await b.close();
console.log(`\n${items.length}건 × ${tpls.length}벌 = ${items.length * tpls.length}  ·  넘침 ${bad}`);
process.exit(bad ? 2 : 0);
