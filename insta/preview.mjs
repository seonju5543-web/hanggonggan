/** 카드 미리보기 — 렌더된 카드를 피드에서 보이는 크기(360px)로 한 장에 붙인다.
 *  실행: node insta/preview.mjs <파일이름앞부분>          insta/out/ 의 PNG (작업용)
 *        node insta/preview.mjs --dir=insta/pub/<코드>    게시용 폴더의 JPG (개발자에게 보여 줄 때)
 *  결과: insta/out/_preview.png (또는 _preview-<코드>.png) — 사람이 눈으로 확인하는 용도.
 *  🔴 개발자에게 "고쳤다" 고 말하기 전에 **이 그림을 보여 준다**(2026-09-12 지시 · 스킬 insta-revise). */
import { chromium } from 'playwright';
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const dir = dirArg ? join(ROOT, dirArg.slice(6)) : join(ROOT, 'insta/out');   // 🔴 cwd 기준이면 다른 데서 돌릴 때 엉뚱한 곳을 본다
if (!existsSync(dir)) { console.error(`${dir} 가 없습니다.`); process.exit(1); }
const set = dirArg ? '' : (process.argv[2] || '');
const ext = dirArg ? '.jpg' : '.png';
const files = readdirSync(dir).filter((f) => f.startsWith(set) && f.endsWith(ext) && !f.startsWith('_'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (!files.length) { console.error('맞는 그림이 없습니다.'); process.exit(1); }
const out = dirArg ? join(ROOT, 'insta/out', `_preview-${basename(dir)}.png`) : join(dir, '_preview.png');

const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
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
<h2>인스타 캐러셀 미리보기 — 피드에서 보이는 크기 (360px)${dirArg ? ` · ${basename(dir)}` : ''}</h2>
<div class="row">${files.map((f, i) => `<figure><img src="${f}"><figcaption>${i + 1}장</figcaption></figure>`).join('')}</div>`);
await p.waitForLoadState('networkidle');
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log(`${out} — ${files.length}장`);
