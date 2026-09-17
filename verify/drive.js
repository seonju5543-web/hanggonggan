const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
const { nextUntil, assertOwnServer } = require('./onboard-helper.js');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;

(async () => {
  /* 🔴 재기 전에 **이 서버가 내 앱인지** 확인한다 — 아니면 여기서 멈춘다.
     이 저장소는 작업 폴더를 여러 개 두고 쓰는데, 8123 에 다른 폴더의 서버가 떠 있으면
     그 옛 앱을 재고도 아무도 모른다(빨간불이든 **가짜 초록불이든**). 규칙은 onboard-helper 한 곳. */
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: (process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { console.log('DIALOG:', d.message().slice(0, 160).replace(/\n/g, ' | ')); await d.accept(); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
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
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');

  // ── Step 2
  await page.fill('#in-gpa', '3.8');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');

  // ── Step 3: 체크박스 체크 표시 확인
  await page.check('#in-flags input[value="multiChild"]');
  await page.check('#in-cert');
  const bg = await page.$eval('#in-flags input[value="multiChild"]', (el) => getComputedStyle(el).backgroundImage.slice(0, 30));
  console.log('STEP checkbox check visible (bg-image):', bg !== 'none' ? 'yes' : 'NO!');
  await page.screenshot({ path: SHOT('13-checkbox') });
  /* 단계 번호를 박지 말 것 — 온보딩이 4단계에서 6단계가 되며 이 검사들이 죽어 있었다 */
  await nextUntil(page, '#in-sid');

  // ── Step 4: 공통 서류 정보
  await page.fill('#in-sid', '202312345');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@hufs.ac.kr');
  /* 🔴 **계좌 칸은 온보딩에서 일부러 숨겼다** (2026-08-31 UI 정리 · index.html 주석).
     "아직 아무 가치도 받지 못한 학생에게 계좌번호를 요구하는 것은 가장 흔한 이탈·불신
     지점"이라 가입 때는 안 묻고, **프로필 수정으로 들어올 때만** 보인다.
     그런데 이 검사만 남아 안 보이는 칸을 30초 채우려다 죽고 있었다.
     ⚠️ 되살리지 말 것 — 값이 필요해지는 때는 신청서에 그 칸이 있을 때뿐이고,
        그때는 form-plan.js 가 질문으로 띄운다(설계 그대로). */
  await page.screenshot({ path: SHOT('14-step4') });
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  /* 🔴 온보딩을 마치면 2.9초 뒤에 알림 동의 시트가 뜬다(notifyMaybeAskConsent).
     그게 뒤 화면을 덮어 그 뒤의 클릭이 전부 시간초과로 죽는다 — 실제로 이 드라이버가
     '#explore-list 카드 클릭'에서 그렇게 실패했다(기기가 느리면 재현된다).
     이 드라이버가 보는 것은 알림이 아니라 매칭·신청 플로우이므로 여기서 꺼 둔다
     (알림은 verify-notify.js 가 따로 본다). */
  /* ⚠️ 함수를 바꿔치기해도 소용없다 — 완료를 누른 순간 이미 예약(setTimeout)이 걸린다.
     그 시각(2.9초)을 **지나서** 닫아야 확실히 사라진다. */
  await page.waitForTimeout(3300);
  await page.evaluate(() => { if (typeof closeNotifyPanel === 'function') closeNotifyPanel(); });
  await page.waitForTimeout(400);
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

  // ── 단건 신청: 서류 도우미 플로우 (인문100년 — 자기소개서·학업계획서 필요)
  await page.click('.nav-item[data-nav="explore"]');
  await page.click('#explore-list [data-detail="kosaf-humanities"]');
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

  // ── 일괄 신청 준비: 목록에서 한 건을 빼고 나머지만 담긴다 (2026-08-25 재설계)
  //    🔴 예전엔 브라우저 confirm 창이라 위 page.on('dialog') 가 대신 눌러 줬다.
  //       목록 창으로 바뀐 지금 그 자동 수락은 아무 일도 안 한다 — 여기서 직접 눌러야 하고,
  //       안 그러면 이 검사가 0건으로 조용히 통과한다.
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForTimeout(1100);
  const heroLabel = (await page.textContent('#btn-apply-all')).trim();
  const heroN = Number((heroLabel.match(/(\d+)건/) || [])[1] || 0);
  await page.click('#btn-apply-all');
  await page.waitForSelector('#btn-bulk-go');
  await page.waitForTimeout(350);
  const listN = await page.locator('#detail-sheet [data-bulk]').count();
  console.log('STEP bulk list rows:', listN, '| 홈 버튼이 말한 건수:', heroN, listN === heroN ? '(일치)' : '(❌ 불일치)');
  console.log('STEP bulk summary:', (await page.textContent('#bulk-sum')).trim());

  // 더보기 — 배지·마감·제출처·자격 원문이 들어 있어야 한다
  await page.locator('#detail-sheet .bulk-more > summary').first().click();
  await page.waitForTimeout(200);
  const firstMore = page.locator('#detail-sheet .bulk-more').first();
  console.log('STEP bulk more badges:', await firstMore.locator('.bulk-badges .badge').count(),
    '| meta 줄:', await firstMore.locator('.bulk-meta').count(),
    '| 자격 원문 줄:', await firstMore.locator('.bulk-reqs li').count());
  await page.screenshot({ path: SHOT('19a-bulk-sheet') });

  // 한 건 빼기 — 버튼 문구가 N-1 로 줄고, 그 공고는 신청내역에 없어야 한다
  const dropId = await page.locator('#detail-sheet [data-bulk]').first().getAttribute('data-bulk');
  await page.locator('#detail-sheet [data-bulk]').first().uncheck();
  await page.waitForTimeout(200);
  console.log('STEP bulk after uncheck:', (await page.textContent('#btn-bulk-go')).trim(),
    '| 뺀 줄 흐려짐:', await page.locator('#detail-sheet .bulk-row.off').count());
  await page.click('#btn-bulk-go');
  await page.waitForTimeout(500);
  const droppedIn = await page.evaluate((id) => state.applications.some((a) => a.id === id), dropId);
  console.log('STEP 뺀 공고가 신청내역에 담겼나 (false 여야 정상):', droppedIn);

  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(300);
  /* 🔴 **신청내역의 '작성 중' 표시는 `.badge-pending` 이 아니다** (2026-09-03).
     그 배지는 *일괄 준비 목록*(app.js `bulk-name`)에만 있다. 신청내역은 카드 안 진행 막대에
     `.app-step-wait` 를 붙인다(app.js:2368). 게다가 이 줄은 화면 **전체**에서 세고 있어
     일괄 준비 목록의 배지까지 함께 세었고, 그래서 `pendingCnt > 0` 인데 정작
     `#apps-list` 안에는 없어 30초를 기다리다 죽었다. 세는 곳과 누르는 곳을 맞춘다. */
  const pendingCnt = await page.locator('#apps-list .swipe-row:has(.app-step-wait)').count();
  const totalCnt = await page.locator('#apps-list .sch-card').count();
  console.log('STEP apps total:', totalCnt, '| pending(서류 작성 필요):', pendingCnt);
  console.log('STEP apps summary:', (await page.textContent('#apps-summary')).replace(/\s+/g, ' ').trim().slice(0, 120));
  await page.screenshot({ path: SHOT('19-apps') });

  // pending 건 이어서 완성
  if (pendingCnt > 0) {
    await page.click('#apps-list .swipe-row:has(.app-step-wait) .sch-card');
    await page.waitForSelector('#detail-sheet.show');
    await page.waitForTimeout(350);
    console.log('STEP pending detail btn:', (await page.textContent('#btn-apply-one')).trim());
    await page.click('#btn-apply-one');
    // 서류 도우미(dp) 또는 양식 엔진(ff) 중 어느 쪽이 떠도 완주
    const gen = await Promise.race([
      page.waitForSelector('#btn-dp-generate', { timeout: 8000 }).then(() => 'dp').catch(() => null),
      page.waitForSelector('#btn-ff-generate', { timeout: 8000 }).then(() => 'ff').catch(() => null),
    ]);
    console.log('STEP pending flow kind:', gen);
    if (gen === 'dp') {
      await page.click('#btn-dp-generate');
      await page.waitForSelector('#btn-dp-confirm');
      await page.click('#btn-dp-confirm');
    } else if (gen === 'ff') {
      await page.click('#btn-ff-generate');
      await page.waitForSelector('#btn-ff-confirm', { timeout: 8000 });
      await page.click('#btn-ff-confirm');
    }
    await page.waitForTimeout(400);
    console.log('STEP pending resolved, remaining pending:', await page.locator('.badge-pending').count());
  }

  // ── 영속성/비정상 입력 프로브
  await page.reload({ waitUntil: 'domcontentloaded' });
  // MY 화면에 값이 안 채워진 자리가 없는가 (2026-08-25 '(undefined)' 사고로 추가)
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForTimeout(400);
  const myText = (await page.textContent('#my-profile')).replace(/s+/g, ' ').trim();
  console.log('STEP my profile:', myText.slice(0, 90));
  console.log('STEP my has undefined/NaN (없어야 정상):', /undefined|NaN/.test(myText));

  console.log('PROBE reload lands on home:', await page.locator('#screen-home').isHidden() === false);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('handaejang.v1')));
  console.log('PROBE storage key v1 has common info:', stored.profile.common.studentId === '202312345');
  await page.evaluate(() => localStorage.setItem('handaejang.v1', '{{{broken'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  console.log('PROBE corrupted storage -> onboarding, no crash:', await page.locator('#screen-onboarding').isHidden() === false);

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error('DRIVER FAIL:', e); process.exit(1); });
