/* 제안서 HTML → A4 PDF 렌더링 (참고 보고서와 같은 머리글/페이지 푸터 포함) */
const path = require('path');
const { chromium } = require('/home/user/hanggonggan/verify/node_modules/playwright-core');

const DOCS = [
  { html: 'janghak-proposal.html', pdf: '../한대장_장학팀_협력제안서.pdf', header: '한대장 장학 파일럿 협력 제안서', color: '#1f3560' },
  { html: 'grise-proposal.html', pdf: '../한대장_G-RISE_사업제안서.pdf', header: '한대장 G-RISE 사업 제안서', color: '#42511f' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage();
  for (const d of DOCS) {
    await page.goto('file://' + path.join(__dirname, d.html), { waitUntil: 'networkidle' });
    await page.pdf({
      path: path.join(__dirname, d.pdf),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '20mm', bottom: '16mm', left: '16mm', right: '16mm' },
      headerTemplate: `
        <div style="width:100%;font-size:7.5px;color:#666;padding:0 16mm;
                    font-family:'NanumGothic',sans-serif;text-align:right;
                    border-bottom:.5px solid ${d.color};padding-bottom:3px;">${d.header}</div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#333;text-align:center;
                    font-family:'NanumGothic',sans-serif;">
          p. <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    console.log('rendered:', d.pdf);
  }
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
