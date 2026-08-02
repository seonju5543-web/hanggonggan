const { chromium } = require('playwright-core');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;

/* 앱에서 '아직 마감되지 않은 + 양식이 연결된' 공고를 스스로 찾아 질문 → 문서 생성까지 구동한다.
   대상 공고를 코드에 박아두면 그 공고가 마감되는 순간 검증이 저절로 깨지므로(2026-08-01 조병두),
   양식 종류와 무관하게 굴러가도록 만들었다: 빈 칸은 아무 값으로 채우고 체크는 첫 항목을 고른다. */
async function driveAnyLiveForm(page) {
  const id = await page.evaluate(() => {
    const today = new Date().toISOString().slice(0, 10);
    const live = (typeof registeredList !== 'undefined' ? registeredList : [])
      .filter((s) => s.formId && FORM_TEMPLATES[s.formId] && (!s.deadline || s.deadline >= today));
    return live.length ? live[0].id : null;
  });
  if (!id) return { id: null, ok: false };
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(500);
  const card = await page.$(`#explore-list [data-detail="${id}"]`);
  if (!card) return { id, ok: false };
  await card.click();
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(300);
  if (await page.$eval('#btn-apply-one', (el) => el.disabled)) return { id, ok: false };
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  /* 빈 칸 채우기 — 자동 채움된 칸은 건드리지 않는다 */
  for (const inp of await page.$$('.form-q input[type="text"], .form-q textarea')) {
    if (!(await inp.inputValue())) await inp.fill('검증 입력');
  }
  for (const grp of await page.$$('.fq-checks')) {
    const chip = await grp.$('.chip');
    if (chip) await chip.click();
  }
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  return { id, ok: doc.includes('검증 입력') || doc.length > 200 };
}

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
  // 마감이 한참 지난 공고는 목록에서 지워지므로(2026-08-02 마감 36건 정리 때 실제로 사라졌다)
  // 카드가 없으면 이 구간을 통째로 건너뛰고 마감 전 양식 공고로 같은 경로를 구동한다.
  // 검증 대상을 코드에 박아 두면 데이터가 정리될 때마다 검사가 깨진다 — README의 규칙과 같은 이유다.
  if (!(await page.$('#explore-list [data-detail="reg-skku-jobyungdu"]'))) {
    console.log('조병두 구간 건너뜀 — 마감돼 목록에서 내려간 공고입니다. 마감 전 양식 공고로 대체 구동합니다.');
    const drove = await driveAnyLiveForm(page);
    console.log('대체 구동(마감 전 양식 공고):', drove.id || '없음', '| 문서 생성:', drove.ok);
    if (!drove.ok) errors.push('마감 전 양식 공고를 하나도 구동하지 못했습니다');
    await page.screenshot({ path: SHOT('32-live-form-doc') });
    console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
    await browser.close();
    process.exit(errors.length ? 1 : 0);
  }
  await page.click('#explore-list [data-detail="reg-skku-jobyungdu"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  const badge = await page.$eval('#detail-sheet .badge-dday', (el) => el.textContent);
  const atts = await page.$$eval('#detail-sheet .doc-list a', (els) => els.map((e) => e.textContent.slice(0, 40)));
  console.log('조병두 D-day:', badge, '| 원본 첨부 링크:', atts.length);
  atts.forEach((a) => console.log('  📎', a));
  await page.screenshot({ path: SHOT('31-jobyungdu-detail') });

  // 원클릭 신청 준비 → 양식 질문 화면
  // 마감된 공고는 신청 버튼이 잠겨 있어 클릭하면 30초 타임아웃으로 깨진다 (README '마감된 공고를
  // 대상으로 삼지 말 것'). 조병두는 2026-07-31 마감 — 마감이면 이 구간은 정직하게 건너뛰고,
  // 대신 아직 마감 전인 양식 공고를 앱에서 스스로 찾아 같은 경로(질문 → 문서 생성)를 구동한다.
  // 그래서 공고가 마감돼도 '양식 작성이 되는가'라는 검사 자체는 사라지지 않는다. (2026-08-01)
  const applyLocked = await page.$eval('#btn-apply-one', (el) => el.disabled);
  if (applyLocked) {
    console.log('조병두 양식 UI 구동 건너뜀 — 이 공고는 마감됨(신청 버튼 잠김). 마감 전 양식 공고로 대체 구동합니다.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const drove = await driveAnyLiveForm(page);
    console.log('대체 구동(마감 전 양식 공고):', drove.id || '없음', '| 문서 생성:', drove.ok);
    if (!drove.ok) errors.push('마감 전 양식 공고를 하나도 구동하지 못했습니다');
    await page.screenshot({ path: SHOT('32-live-form-doc') });
  } else {
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
  }

  // 실시간 피드에서 등록 공고 중복 제거 확인
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const feed = await page.$$eval('#live-notices .notice-card .sch-name', (els) => els.map((e) => e.textContent)).catch(() => []);
  console.log('피드 항목:', feed.length, '| 조병두 중복:', feed.some((f) => f.includes('조병두')) ? 'DUP!' : '제거됨 OK');

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
