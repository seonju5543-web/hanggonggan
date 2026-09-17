/* CTO 인수인계 문서 HTML → A4 PDF 렌더링
   준비: npm i playwright-core  (Claude 원격 환경에는 크로미움이 이미 있다)
   실행: node docs/cto-onboarding/src/render-pdf.js
   한글 글꼴: Pretendard가 시스템에 없으면 npm i pretendard 후
             dist/public/static/Pretendard-{Regular,Medium,SemiBold,Bold}.otf 를
             /usr/share/fonts/opentype/pretendard/ 에 복사하고 fc-cache -f */
const path = require('path');
const CANDIDATES = [
  'playwright-core',
  path.join(__dirname, 'node_modules/playwright-core'),
  path.join(__dirname, '../../../verify/node_modules/playwright-core'),
];
let chromium;
for (const c of CANDIDATES) { try { ({ chromium } = require(c)); break; } catch { /* 다음 후보 */ } }
if (!chromium) { console.error('playwright-core를 찾지 못했습니다 — npm i playwright-core'); process.exit(1); }

const OUT = path.join(__dirname, '..');
const DOCS = [
  { html: 'doc1.html', pdf: '한대장_CTO_1_제품전체개요.pdf', header: '한대장 — 제품 전체 개요 (CTO 인수인계 1/2)' },
  { html: 'doc2.html', pdf: '한대장_CTO_2_코드아키텍처상세.pdf', header: '한대장 — 코드·아키텍처 상세 (CTO 인수인계 2/2)' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  for (const d of DOCS) {
    await page.goto('file://' + path.join(__dirname, d.html), { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.join(OUT, d.pdf), format: 'A4', printBackground: true, displayHeaderFooter: true,
      margin: { top: '15mm', bottom: '14mm', left: '15mm', right: '15mm' },
      headerTemplate: `<div style="width:100%;font-size:7px;color:#8b93a3;padding:0 15mm;font-family:Pretendard,sans-serif;text-align:right;">${d.header}</div>`,
      footerTemplate: `<div style="width:100%;font-size:7.5px;color:#6b7686;text-align:center;font-family:Pretendard,sans-serif;">
        <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    console.log('rendered:', d.pdf);
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
