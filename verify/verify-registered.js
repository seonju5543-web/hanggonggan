const { chromium } = require('playwright-core');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');

  // 성균관대 프로필 (3학년 — 조병두 자격)
  await page.fill('#in-school', '성균관');
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item');
  console.log('school:', await page.inputValue('#in-school'));
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

  // 탐색 탭: 정식 등록 공고 (성균관 6건) 노출 확인
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  const cards = await page.$$eval('#explore-list .sch-card .sch-name', (els) => els.map((e) => e.textContent));
  const regCards = cards.filter((c) => /조병두|삼일|보건|산학협동|청년창업농/.test(c));
  console.log('explore total cards:', cards.length, '| SKKU registered visible:', regCards.length);
  regCards.forEach((c) => console.log('  •', c));
  // 광운대 '학교한정' 공고가 새어나오지 않는지 검사 (호반은 전국 승격돼 정상 노출 → 카나리에서 제외)
  const kwLeak = cards.filter((c) => /보훈장학금 신청|종근당고촌|화도·동해/.test(c));
  console.log('타 학교(광운 학교한정) 공고 미노출 확인:', kwLeak.length === 0 ? 'OK' : 'LEAK! ' + kwLeak);
  await page.screenshot({ path: SHOT('30-explore-registered') });

  // 조병두 상세: 첨부 양식 링크 + 마감 배지 (홈 마감임박 목록에도 같은 카드가 있어 explore로 범위 한정)
  await page.click('#explore-list [data-detail="reg-skku-jobyungdu"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  const badge = await page.$eval('#detail-sheet .badge-dday', (el) => el.textContent);
  const atts = await page.$$eval('#detail-sheet .doc-list a', (els) => els.map((e) => e.textContent.slice(0, 40)));
  console.log('조병두 D-day:', badge, '| 원본 첨부 링크:', atts.length);
  atts.forEach((a) => console.log('  📎', a));
  await page.screenshot({ path: SHOT('31-jobyungdu-detail') });

  // 원클릭 신청 준비 → 양식 질문 화면
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  const autoName = await page.inputValue('#fq-nameLine');
  const autoSid = await page.inputValue('#fq-studentId');
  const autoBracket = await page.inputValue('#fq-bracket');
  console.log('양식 자동 채움 — 성명:', autoName, '| 학번:', autoSid, '| 소득분위:', autoBracket);
  await page.fill('#fq-birth', '2004. 3. 15.');
  await page.click('.fq-checks[data-f="gender"] .chip:first-child');
  await page.click('.fq-checks[data-f="renew"] .chip:first-child');
  await page.click('.fq-checks[data-f="applyType"] .chip:first-child');
  await page.screenshot({ path: SHOT('32-jobyungdu-questions') });
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  console.log('문서 제목 포함:', doc.includes('조병두 장학금 신청서'));
  console.log('체크 표시(☑ 신규):', doc.includes('☑ 신규'));
  console.log('신청유형 체크:', doc.includes('☑ ① 등록금 전액'));
  console.log('자필 서약문 포함:', doc.includes('받은 만큼 후배들에게 돌려주라'));
  console.log('학생처장 귀하:', doc.includes('학생처장 귀하'));
  console.log('별첨 확인서 포함:', doc.includes('타장학금 수혜 여부 확인서'));
  await page.screenshot({ path: SHOT('33-jobyungdu-doc'), fullPage: false });

  // 실시간 피드에서 등록 공고 중복 제거 확인
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const feed = await page.$$eval('#live-notices .notice-card .sch-name', (els) => els.map((e) => e.textContent)).catch(() => []);
  console.log('피드 항목:', feed.length, '| 조병두 중복:', feed.some((f) => f.includes('조병두')) ? 'DUP!' : '제거됨 OK');

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
