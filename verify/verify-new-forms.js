/* 신규 등록 양식(삼일·보건2·산학·명지고시) 검증:
   ① data/forms.json 병합 확인 ② 각 스키마가 질문 화면·문서 렌더링에서 오류 없이 동작
   ③ 대표 1종(삼일)은 UI로 질문→문서 생성까지 ④ 명지 프로필로 고시장학금 양식 확인 */
const { chromium } = require('playwright-core');

const NEW_KEYS = ['samil-apply', 'bogun-study-apply', 'bogun-multi-apply', 'sanhak-foreign-apply', 'mju-gosi-apply'];

async function onboard(page, school, major) {
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', school);
  await page.waitForTimeout(250);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', major);
  await page.fill('#in-name', '김검증');
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
  await page.fill('#in-email', 'test@test.ac.kr');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await onboard(page, '성균관', '소프트웨어학과');

  // ① 병합 확인
  const keys = await page.evaluate((ks) => ks.filter((k) => typeof FORM_TEMPLATES !== 'undefined' && !!FORM_TEMPLATES[k]), NEW_KEYS);
  console.log('병합된 신규 양식:', keys.length, '/', NEW_KEYS.length, keys.join(', '));

  // ② 각 스키마: 질문 HTML + 문서 렌더링 스모크 (빈 답변으로)
  const smoke = await page.evaluate((ks) => {
    const out = {};
    for (const k of ks) {
      try {
        const tpl = FORM_TEMPLATES[k];
        const qs = formQuestionsHtml(tpl);
        const ans = {};
        tpl.sections.forEach((s) => (s.fields || []).forEach((f) => {
          if (f.type === 'checks' || f.type === 'checks+text') ans[f.id] = { checks: f.options.slice(0, 1), text: '테스트' };
          else if (f.type === 'schedule') ans[f.id] = { days: ['월'], time: '15:00 ~ 17:00' };
          else ans[f.id] = '테스트 값';
        }));
        const doc = renderFormDoc(tpl, state.profile, ans);
        out[k] = { q: qs.length, doc: doc.length, title: doc.includes(tpl.title.slice(0, 8)) };
      } catch (e) { out[k] = { error: e.message }; }
    }
    return out;
  }, NEW_KEYS);
  for (const [k, v] of Object.entries(smoke)) console.log(' ', k, JSON.stringify(v));

  // ③ 삼일장학회: UI로 질문→문서 생성
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.click('[data-detail="reg-skku-samil"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  const autoName = await page.inputValue('#fq-name');
  const autoPhone = await page.inputValue('#fq-phoneSelf');
  const autoEmail = await page.inputValue('#fq-email');
  console.log('삼일 자동 채움 — 성명:', autoName, '| 휴대전화:', autoPhone, '| 이메일:', autoEmail);
  await page.click('.fq-checks[data-f="field"] .chip:nth-child(2)'); // 희망
  await page.click('.fq-checks[data-f="ceremony"] .chip:first-child'); // 참석
  await page.fill('#fq-birth', '2004-03-15');
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  console.log('삼일 문서 — 제목:', doc.includes('재단법인 삼일장학회 장학금 지원 신청서'),
    '| ☑ 희망:', doc.includes('☑ 희망(希望)삼일장학생'),
    '| ☑ 참석:', doc.includes('☑ 참  석'),
    '| 서약문:', doc.includes('선발 취소 등 어떤 조치에도 이의를 제기치 않겠습니다'));
  await page.screenshot({ path: `${__dirname}/shot-40-samil-doc.png` });

  // ④ 명지 프로필 → 고시장학금 양식
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', (e) => errors.push('PAGEERROR2: ' + e.message));
  page2.on('dialog', async (d) => { await d.accept(); });
  await page2.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await onboard(page2, '명지', '융합소프트웨어학부');
  await page2.click('.nav-item[data-nav="explore"]');
  await page2.waitForTimeout(600);
  await page2.click('#explore-list [data-detail="reg-mj-gosi"]');
  await page2.waitForSelector('#detail-sheet.show');
  await page2.waitForTimeout(400);
  await page2.click('#btn-apply-one');
  await page2.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  await page2.fill('#fq-rrn', '040315-3000000');
  await page2.click('#btn-ff-generate');
  await page2.waitForSelector('.form-doc', { timeout: 8000 });
  const doc2 = await page2.$eval('.form-doc', (el) => el.textContent);
  console.log('명지 고시 문서 — 제목:', doc2.includes('고시장학금  신청서'),
    '| 제1호 서식:', doc2.includes('(제 1 호 서식)'),
    '| 제한기준 명시:', doc2.includes('직전학기 평균평점 2.5 이상'),
    '| 서약문:', doc2.includes('명지대학교 장학금규정에 따라'));
  await page2.screenshot({ path: `${__dirname}/shot-41-mjugosi-doc.png` });

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
  const bad = Object.values(smoke).some((v) => v.error) || keys.length !== NEW_KEYS.length;
  if (bad) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
