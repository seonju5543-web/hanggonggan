/** 카드 미리보기 — 렌더된 PNG 를 피드에서 보이는 크기(360px)로 한 장에 붙인다.
 *  실행: node insta/preview.mjs <파일이름앞부분>   (사람이 눈으로 확인하는 용도) */
import { chromium } from 'playwright';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const dir = join(ROOT, 'insta/out');   // 🔴 cwd 기준이면 다른 데서 돌릴 때 엉뚱한 곳을 본다
const set = process.argv[2] || '';
const files = readdirSync(dir).filter((f) => f.startsWith(set) && f.endsWith('.png') && !f.startsWith('_')).sort();
if (!files.length) { console.error('맞는 PNG 가 없습니다.'); process.exit(1); }

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 2000, height: 760 } });
await p.goto('file://' + dir + '/');
await p.setContent(`<style>
body{margin:0;background:#2b2926;padding:36px;width:max-content;
  font-family:-apple-system,'Apple SD Gothic Neo',sans-serif}
h2{color:#e8e4dc;font-size:23px;margin:0 0 20px;font-weight:700}
.row{display:flex;gap:16px}
figure{margin:0} img{width:360px;display:block;border-radius:12px}
figcaption{color:#9b968c;font-size:15px;margin-top:10px;text-align:center}
</style>
<h2>인스타 캐러셀 미리보기 — 피드에서 보이는 크기 (360px)</h2>
<div class="row">${files.map((f, i) => `<figure><img src="${f}"><figcaption>${i + 1}장</figcaption></figure>`).join('')}</div>`);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: `${dir}/_preview.png`, fullPage: true });
await b.close();
console.log(`${dir}/_preview.png — ${files.length}장`);
