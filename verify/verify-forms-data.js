/* 데이터 주도 양식 검증: 앱 파일(app.js/forms.js)은 그대로 두고
   data/forms.json + data/registered.json에만 새 양식을 추가했을 때
   앱이 자동으로 양식 작성 플로우를 제공하는지 확인한다.
   사전 준비: 더미 양식(test-dummy)이 주입된 앱 복사본이 PORT에서 서빙 중이어야 함. */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8124;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '성균관');
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', '소프트웨어학과');
  await page.fill('#in-name', '김성균');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="enrolled"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.0');
  await page.selectOption('#in-bracket', '4');
  await page.click('#in-region .chip[data-value="seoul"]');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  await page.click('.onboard-step[data-step="3"] [data-next]');
  await page.fill('#in-sid', '2023310123');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@skku.edu');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1300);

  // 1) forms.json의 더미 양식이 FORM_TEMPLATES에 병합됐는지
  const merged = await page.evaluate(() => typeof FORM_TEMPLATES !== 'undefined' && !!FORM_TEMPLATES['test-dummy']);
  console.log('forms.json 병합(test-dummy 존재):', merged);

  // 2) 내장 2종도 유지되는지 (병합이 덮어쓰기가 아닌 추가인지)
  const builtins = await page.evaluate(() => ['kosaf-ai-mentor', 'jobyungdu-apply'].every((k) => !!FORM_TEMPLATES[k]));
  console.log('내장 양식 유지:', builtins);

  // 3) formId만 연결된 등록 공고에서 양식 질문 → 문서 생성까지 작동하는지
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.click('[data-detail="reg-skku-samil"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  await page.fill('#fq-memo', '자동 반영 확인');
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  console.log('더미 양식 문서 생성:', doc.includes('테스트 더미 신청서') && doc.includes('자동 반영 확인'));

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
  if (!merged || !builtins) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
