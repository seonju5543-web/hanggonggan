const { chromium } = require('playwright-core');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { console.log('DIALOG:', d.message().slice(0, 160).replace(/\n/g, ' | ')); await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  console.log('STEP title:', await page.title(), '| h1:', await page.textContent('.onboard-hero h1'));
  await page.click('.onboard-step[data-step="0"] [data-next]');

  // ── 자동추천: '외대' → 한국외국어대학교
  await page.fill('#in-school', '외대');
  await page.waitForSelector('#in-school ~ .ac-list .ac-item, .ac-wrap .ac-list:not([hidden]) .ac-item');
  const schoolSugg = await page.$$eval('.ac-list:not([hidden]) .ac-item', (els) => els.map((e) => e.textContent));
  console.log('STEP school suggestions for 외대:', schoolSugg.join(', '));
  await page.screenshot({ path: SHOT('11-ac-school') });
  await page.click('.ac-list:not([hidden]) .ac-item');
  console.log('STEP school picked:', await page.inputValue('#in-school'));

  // ── 자동추천: '서울' 케이스
  await page.fill('#in-school', '서울');
  await page.waitForTimeout(150);
  console.log('STEP school suggestions for 서울:', await page.$$eval('.ac-list:not([hidden]) .ac-item', (els) => els.map((e) => e.textContent).join(', ')));
  await page.fill('#in-school', '외대');
  await page.waitForTimeout(150);
  await page.click('.ac-list:not([hidden]) .ac-item');

  // ── 캠퍼스 선택 (이원화 캠퍼스 개인화)
  await page.waitForSelector('#campus-field:not([hidden])');
  console.log('STEP campus chips:', await page.$$eval('#in-campus .chip', (cs) => cs.map((c) => c.textContent).join(' | ')));
  await page.click('#in-campus .chip:nth-child(2)');
  await page.screenshot({ path: SHOT('20-campus') });

  // ── 학과 자동추천 (학교 반영: 외대 카탈로그)
  await page.click('#in-track .chip[data-value="humanities"]');
  await page.fill('#in-major', '스페인');
  await page.waitForTimeout(150);
  const majorSugg = await page.$$eval('.ac-list:not([hidden]) .ac-item', (els) => els.map((e) => e.textContent));
  console.log('STEP major suggestions for 스페인:', majorSugg.join(', '));
  await page.screenshot({ path: SHOT('12-ac-major') });
  await page.click('.ac-list:not([hidden]) .ac-item');
  console.log('STEP major picked:', await page.inputValue('#in-major'));

  await page.fill('#in-name', '이선주');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="enrolled"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');

  // ── Step 2
  await page.fill('#in-gpa', '3.8');
  await page.selectOption('#in-bracket', '4');
  await page.click('#in-region .chip[data-value="seoul"]');
  await page.click('.onboard-step[data-step="2"] [data-next]');

  // ── Step 3: 체크박스 체크 표시 확인
  await page.check('#in-flags input[value="multiChild"]');
  await page.check('#in-cert');
  const bg = await page.$eval('#in-flags input[value="multiChild"]', (el) => getComputedStyle(el).backgroundImage.slice(0, 30));
  console.log('STEP checkbox check visible (bg-image):', bg !== 'none' ? 'yes' : 'NO!');
  await page.screenshot({ path: SHOT('13-checkbox') });
  await page.click('.onboard-step[data-step="3"] [data-next]');

  // ── Step 4: 공통 서류 정보
  await page.fill('#in-sid', '202312345');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@hufs.ac.kr');
  await page.fill('#in-bank', '국민은행');
  await page.fill('#in-account', '12345678901234');
  await page.screenshot({ path: SHOT('14-step4') });
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1100);
  console.log('STEP home:', await page.textContent('#hero-amount'), '/', await page.textContent('#home-school'));
  console.log('STEP home campus shown:', (await page.textContent('#home-school')).includes('글로벌캠퍼스'));
  await page.screenshot({ path: SHOT('15-home') });

  // ── 서류 보관함: 성적증명서 업로드
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#my-wallet .wallet-row');
  await page.setInputFiles('#my-wallet input[data-slot="gradeCert"]', __dirname + '/grade-cert.png');
  await page.waitForTimeout(400);
  const walletStatus = await page.$eval('#my-wallet .wallet-row .wallet-status', (el) => el.textContent);
  console.log('STEP wallet saved:', walletStatus);
  await page.screenshot({ path: SHOT('21-wallet') });

  // ── 단건 신청: 서류 도우미 플로우 (관정 — 자기소개서 필요)
  await page.click('.nav-item[data-nav="explore"]');
  await page.click('[data-detail="kwanjeong"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(350);
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-dp-generate');
  console.log('STEP doc-prep questions shown, defaults preselected:', await page.locator('.dp-q .chip.active').count(), 'chips');
  await page.screenshot({ path: SHOT('16-docprep-q') });
  await page.fill('.dp-extra[data-def="0"]', '교내 스페인어 통번역 동아리에서 3년간 활동했습니다.');
  await page.click('#btn-dp-generate');
  await page.waitForSelector('#btn-dp-confirm');
  const draft = await page.inputValue('.dp-text[data-i="0"]');
  console.log('STEP draft preview (first 130 chars):', draft.slice(0, 130).replace(/\n/g, ' / '));
  const checklist = await page.$$eval('.doc-list li', (els) => els.map((e) => e.textContent.trim()).join(' || '));
  console.log('STEP cert checklist:', checklist.slice(0, 200));
  await page.screenshot({ path: SHOT('17-docprep-preview') });
  // 사용자 수정 가능 확인
  await page.fill('.dp-text[data-i="0"]', draft + '\n\n(수정 테스트 문장)');
  await page.click('#btn-dp-confirm');
  await page.waitForTimeout(400);
  console.log('STEP toast after confirm shows official channel');

  // 준비 완료된 신청 상세: 공식 제출처 링크 + 저장 서류
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(200);
  await page.click('#apps-list .sch-card');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(350);
  console.log('STEP applied detail official link:', await page.$eval('.applied-at', (el) => el.textContent.trim()));
  console.log('STEP saved docs section exists:', await page.locator('.dp-saved').count());
  console.log('STEP submit guide steps:', await page.locator('.guide-list li').count());
  await page.click('#btn-copy-docs');
  await page.waitForTimeout(300);
  console.log('STEP copy toast:', (await page.textContent('#toast')).slice(0, 40));
  console.log('STEP share button exists:', await page.locator('#btn-share-docs').count());
  await page.screenshot({ path: SHOT('18-applied-detail') });
  await page.mouse.click(195, 40);
  await page.waitForTimeout(400);

  // ── 일괄 신청: 서류 필요 건은 pending 처리
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForTimeout(1100);
  await page.click('#btn-apply-all');
  await page.waitForTimeout(500);
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(300);
  const pendingCnt = await page.locator('.badge-pending').count();
  const totalCnt = await page.locator('#apps-list .sch-card').count();
  console.log('STEP apps total:', totalCnt, '| pending(서류 작성 필요):', pendingCnt);
  console.log('STEP apps summary:', (await page.textContent('#apps-summary')).replace(/\s+/g, ' ').trim().slice(0, 120));
  await page.screenshot({ path: SHOT('19-apps') });

  // pending 건 이어서 완성
  if (pendingCnt > 0) {
    await page.click('#apps-list .sch-card:has(.badge-pending)');
    await page.waitForSelector('#detail-sheet.show');
    await page.waitForTimeout(350);
    console.log('STEP pending detail btn:', (await page.textContent('#btn-apply-one')).trim());
    await page.click('#btn-apply-one');
    await page.waitForSelector('#btn-dp-generate');
    await page.click('#btn-dp-generate');
    await page.waitForSelector('#btn-dp-confirm');
    await page.click('#btn-dp-confirm');
    await page.waitForTimeout(400);
    console.log('STEP pending resolved, remaining pending:', await page.locator('.badge-pending').count());
  }

  // ── 영속성/비정상 입력 프로브
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('PROBE reload lands on home:', await page.locator('#screen-home').isHidden() === false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('handaejang.v1')));
  console.log('PROBE storage key v1 has common info:', stored.profile.common.studentId === '202312345');
  await page.evaluate(() => localStorage.setItem('handaejang.v1', '{{{broken'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('PROBE corrupted storage -> onboarding, no crash:', await page.locator('#screen-onboarding').isHidden() === false);

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error('DRIVER FAIL:', e); process.exit(1); });
