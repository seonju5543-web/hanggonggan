/* tech-advisor-brief.html → A4 PDF (머리글·쪽번호 포함)
   ------------------------------------------------------------------
   실행:  node docs/advisor/render.js
   준비:  playwright-core 가 필요하다 (npm i playwright-core).
          한글 폰트는 이 스크립트가 fonts/ 에 자동으로 내려받는다(약 40MB).
          fonts/ 는 저장소에 넣지 않는다 — 용량이 코드보다 크다.
   🔴 크롬 경로를 박아 두지 말 것 — CHROME_PATH 를 먼저 보고, 없으면 찾는다
      (verify 드라이버가 같은 이유로 한 번에 죽은 적이 있다). */
const path = require('path');
const fs = require('fs');
const https = require('https');

const DIR = __dirname;
const OUT = process.argv[2] || path.join(DIR, '한대장_기술고문_요청서.pdf');

/* Google Fonts 가 주는 전체 TTF (서브셋이 아니라 한 벌짜리 파일이다) */
const FONTS = {
  'NotoSansKR-300.ttf': 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzrQyeLQ.ttf',
  'NotoSansKR-400.ttf': 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf',
  'NotoSansKR-500.ttf': 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzztgyeLQ.ttf',
  'NotoSansKR-700.ttf': 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf',
  'GowunBatang-400.ttf': 'https://fonts.gstatic.com/s/gowunbatang/v12/ijwSs5nhRMIjYsdSgcMa3wRhXA.ttf',
  'GowunBatang-700.ttf': 'https://fonts.gstatic.com/s/gowunbatang/v12/ijwNs5nhRMIjYsdSgcMa3wRZ4J7awg.ttf',
  'IBMPlexMono-400.ttf': 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5ig.ttf',
  'IBMPlexMono-500.ttf': 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJ8lc.ttf',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${res.statusCode} ${url}`));
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = ['/opt/pw-browsers', path.join(process.env.HOME || '', 'Library/Caches/ms-playwright')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root)) {
      for (const rel of ['chrome-linux/chrome',
        'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  throw new Error('크롬을 찾지 못했습니다 — CHROME_PATH 를 지정하세요');
}

(async () => {
  const fontDir = path.join(DIR, 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  for (const [name, url] of Object.entries(FONTS)) {
    const dest = path.join(fontDir, name);
    if (fs.existsSync(dest)) continue;
    process.stdout.write(`폰트 내려받는 중: ${name}\n`);
    await download(url, dest);
  }

  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: chromePath() });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(DIR, 'tech-advisor-brief.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '18mm', bottom: '15mm', left: '15mm', right: '15mm' },
    headerTemplate: `<div style="width:100%;font-size:7px;color:#7C8A94;padding:0 15mm;
        font-family:sans-serif;display:flex;justify-content:space-between;">
        <span>한대장 · 기술 고문 요청서</span><span>2026.09.03</span></div>`,
    footerTemplate: `<div style="width:100%;font-size:7.5px;color:#465661;text-align:center;
        font-family:sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  console.log('rendered:', OUT);
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
