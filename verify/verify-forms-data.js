/* 데이터 주도 양식 검증: 앱 파일(app.js/forms.js)은 그대로 두고
   data/forms.json + data/registered.json에만 새 양식을 추가했을 때
   앱이 자동으로 양식 작성 플로우를 제공하는지 확인한다.
   사전 준비: 더미 양식(test-dummy)이 주입된 앱 복사본이 PORT에서 서빙 중이어야 함. */
const { chromium } = require('playwright-core');
const { nextUntil } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8124;

(async () => {
  const browser = await chromium.launch({ executablePath: (process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', async (d) => { await d.accept(); });

  /* 🔴 픽스처를 **드라이버가 직접 주입한다** (2026-08-29).
     예전에는 머리말에 "더미 양식이 주입된 앱 복사본이 서빙 중이어야 함"이라고만 적혀
     있었다. 그 준비를 아무도 안 했고(워크플로도 안 돌렸다), 그래서 이 검사는 돌리는
     족족 실패했다 — **사람이 기억해야 하는 준비 단계는 언젠가 반드시 빠진다.**
     이제 응답을 가로채 픽스처를 얹으므로 저장소 데이터가 어떻게 바뀌든 혼자 돈다. */
  await page.route('**/data/forms.json', async (route) => {
    const j = await (await route.fetch()).json();
    j.templates['test-dummy'] = {
      title: '테스트 더미 신청서', docName: '테스트더미', org: '검증용 귀하',
      sections: [{ heading: '1. 확인', fields: [{ id: 'memo', label: '메모', type: 'text' }] }],
    };
    await route.fulfill({ json: j });
  });
  await page.route('**/data/registered.json', async (route) => {
    const j = await (await route.fetch()).json();
    for (const it of j.items) it.formId = 'test-dummy';   // 어느 카드를 눌러도 더미 양식이 뜬다
    await route.fulfill({ json: j });
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  /* 🔴 **학교 이름을 박지 않는다** (2026-08-30). 서비스 학교를 둘로 좁히자 자동완성에
     안 떠서 이 드라이버가 통째로 죽었다 — '공고 id 를 박지 말 것'과 같은 계열이다. */
  await page.fill('#in-school', await page.evaluate(() => UNIVERSITIES[0]));
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', '소프트웨어학과');
  await page.fill('#in-name', '김성균');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.0');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 단계 번호를 박지 말 것 — 온보딩이 4단계에서 6단계가 되며 이 검사들이 죽어 있었다 */
  await nextUntil(page, '#in-sid');
  await page.fill('#in-sid', '2023310123');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@skku.edu');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1300);

  // 1) forms.json 의 양식이 FORM_TEMPLATES 에 병합됐는지 (위에서 주입한 픽스처로 확인)
  const merged = await page.evaluate(() => typeof FORM_TEMPLATES !== 'undefined' && !!FORM_TEMPLATES['test-dummy']);
  console.log('forms.json 병합(test-dummy 존재):', merged);

  // 2) 내장 2종도 유지되는지 (병합이 덮어쓰기가 아닌 추가인지)
  const builtins = await page.evaluate(() => ['kosaf-ai-mentor', 'jobyungdu-apply'].every((k) => !!FORM_TEMPLATES[k]));
  console.log('내장 양식 유지:', builtins);

  // 3) formId만 연결된 등록 공고에서 양식 질문 → 문서 생성까지 작동하는지
  // (특정 공고 하드코딩 금지 — 마감이 지나면 버튼이 비활성돼 검증이 깨진다.
  //  test-dummy가 연결된 항목을 동적으로 찾는다. 주입 시 마감 전 항목을 고를 것)
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  /* 🔴 **목록에 실제로 떠 있는** 양식 연결 공고를 고른다 (2026-08-29).
     예전에는 `formId === 'test-dummy'` 를 찾았는데 그 픽스처가 데이터에서 사라져
     `[data-detail="undefined"]` 를 30초 기다리다 죽었다. 마감이 지난 공고는 목록에서
     내려가므로 **화면에 있는 카드 중에서** 골라야 한다(공고 id를 박지 말 것과 같은 계열). */
  const targetId = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#explore-list [data-detail]')].map((e) => e.dataset.detail);
    const hit = ids.find((id) => {
      const s = registeredList.find((x) => x.id === id);
      return s && s.formId && typeof FORM_TEMPLATES !== 'undefined' && FORM_TEMPLATES[s.formId];
    });
    return hit || null;
  });
  console.log('양식 연결 공고:', targetId);
  if (!targetId) {
    console.log('건너뜀 — 목록에 양식 연결 공고가 하나도 없습니다(마감으로 전부 내려갔을 수 있음)');
    await browser.close();
    return;
  }
  await page.click(`#explore-list [data-detail="${targetId}"]`); // 홈 화면의 같은 카드와 겹치지 않게 탐색 목록으로 한정
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
