/* 시작 화면 컷 녹화 — 정문 사진을 학교당 2.5초씩 '걸어 들어가듯' 밀고 들어가며 이어 붙인다 (2026-09-18).
   node tools/gate-reel/cut.mjs <list> <out.webm> [dur=2500] [hold=1200]
     list = docs/designs/assets/gates/ 의 파일명을 쉼표로 (예: khu-1.jpg,hufs-3.jpg,snu-1.jpg)
     dur  = 학교 한 곳이 보이는 시간(ms) · hold = 마지막 장면을 멈춘 채 더 녹화하는 시간(ms)
   결과는 webm(VP8) — H.264 mp4 로 바꾸는 줄은 README.md. 화면 구성은 reel.html 이 정한다(사진별 초점 FOCUS 포함).
   브라우저는 CHROME_PATH 를 먼저 본다(없으면 샌드박스 경로). playwright-core 는 `npm i --no-save playwright-core`. */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const [LIST, OUT, DUR = '2500', HOLD = '1200'] = process.argv.slice(2);
if (!LIST || !OUT) { console.error('usage: node tools/gate-reel/cut.mjs <list> <out.webm> [dur] [hold]'); process.exit(1); }
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
/* 저장소 뿌리를 그대로 내준다 — reel.html 이 ../../docs/designs/assets/gates/ 를 읽는다 */
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
const recDir = fs.mkdtempSync(path.join(path.dirname(path.resolve(OUT)), '.rec-'));
const b = await chromium.launch({ executablePath: EXE });
const total = LIST.split(',').filter(Boolean).length * Number(DUR);
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, recordVideo: { dir: recDir, size: { width: 390, height: 844 } } });
const p = await ctx.newPage();
await p.goto(`${base}/tools/gate-reel/reel.html?list=${encodeURIComponent(LIST)}&dur=${DUR}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(total + Number(HOLD));
const v = await p.video().path();
await ctx.close();
fs.copyFileSync(v, path.resolve(OUT));
fs.rmSync(recDir, { recursive: true, force: true });
await b.close(); server.close();
console.log('cut:', OUT, `(${((total + Number(HOLD)) / 1000).toFixed(1)}s · ${LIST})`);
