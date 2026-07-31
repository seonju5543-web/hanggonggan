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
  // 이원화 캠퍼스 학교면 첫 캠퍼스 선택 (외대 등)
  const campusVisible = await page.$('#campus-field:not([hidden])');
  if (campusVisible) await page.click('#in-campus .chip:first-child');
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


/* 마감 전 양식 공고를 앱에서 직접 찾아 "질문 → 문서 생성"까지 UI로 구동한다.
   하드코딩한 공고는 마감되면 신청 버튼이 비활성이라 드라이버가 깨지므로,
   특정 공고가 마감이면 이 함수로 **다른 살아 있는 양식 공고**를 대신 눌러 UI 경로를 계속 지킨다.
   (양식 스키마 자체의 정확성은 ②의 전수 렌더링 검사가 담당) */
async function driveAnyLiveForm(page, label, errors) {
  const target = await page.evaluate(() => {
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const hit = allScholarships().find((s) => {
      if (!s.formId || !s.deadline || s.deadline < today) return false;
      if (state.applications.some((a) => a.id === s.id)) return false;
      const st = evaluate(s, state.profile).status;
      return st === 'eligible' || st === 'selective';
    });
    return hit ? { id: hit.id, name: hit.name, formId: hit.formId } : null;
  });
  if (!target) { console.log(`  ${label}: 이 프로필에 마감 전 양식 공고가 없어 UI 구동 생략`); return; }

  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.click(`#explore-list [data-detail="${target.id}"]`);
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  const qCount = await page.$$eval('#detail-sheet input, #detail-sheet textarea, #detail-sheet .fq-checks', (els) => els.length);
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  const okDoc = doc.length > 200;
  console.log(`  ${label}: ${target.name} (${target.formId}) — 질문칸 ${qCount}개 · 문서 ${doc.length}자 생성 ${okDoc ? 'OK' : 'FAIL'}`);
  if (!okDoc) errors.push(`${label}: 문서가 비정상적으로 짧음(${doc.length}자)`);
  await page.click('.sheet-handle');
  await page.waitForTimeout(400);
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
  // 접수분(성균관·외대·경희·중앙)은 해마다 마감된다. 마감된 공고는 신청 버튼이 비활성이라
  // 하드코딩한 대상으로는 드라이버가 깨진다 → **마감 전 접수분을 앱에서 직접 찾아** 구동하고,
  // 전부 마감이면 이 UI 구간만 건너뛴다(양식 스키마 검사는 위 ②에서 이미 끝났다).
  const samilPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  samilPage.on('pageerror', (e) => errors.push('PAGEERROR-SAMIL: ' + e.message));
  samilPage.on('dialog', async (d) => { await d.accept(); });
  await samilPage.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await onboard(samilPage, '외대', '컴퓨터공학부');
  const samilLive = await samilPage.evaluate(() => {
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const hit = allScholarships().find((s) => s.formId === 'samil-apply' && s.deadline && s.deadline >= today);
    return hit ? hit.id : null;
  });
  if (!samilLive) {
    console.log('삼일 UI 구동 불가 — 외대 프로필에 마감 전 삼일 접수분이 없음(접수분 전체 마감)');
    console.log('→ 대신 마감 전 양식 공고로 같은 UI 경로(질문→문서 생성)를 구동한다');
    await driveAnyLiveForm(samilPage, '외대 프로필 대체 구동', errors);
  }
  if (samilLive) {
    const page = samilPage; // 아래 단언들은 기존 그대로 재사용
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.click(`#explore-list [data-detail="${samilLive}"]`);
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
  }

  // ④ 명지 프로필 → 고시장학금 양식
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', (e) => errors.push('PAGEERROR2: ' + e.message));
  page2.on('dialog', async (d) => { await d.accept(); });
  await page2.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await onboard(page2, '명지', '융합소프트웨어학부');
  // 삼일과 같은 이유로 마감 여부를 먼저 확인한다 (마감되면 신청 버튼이 비활성이라 클릭이 실패)
  const gosiLive = await page2.evaluate(() => {
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const s = allScholarships().find((x) => x.id === 'reg-mj-gosi');
    return !!(s && s.deadline && s.deadline >= today);
  });
  if (!gosiLive) {
    console.log('명지 고시 UI 구동 불가 — reg-mj-gosi 접수 마감');
    console.log('→ 대신 마감 전 양식 공고로 같은 UI 경로(질문→문서 생성)를 구동한다');
    await driveAnyLiveForm(page2, '명지 프로필 대체 구동', errors);
  } else {
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
  }

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
  const bad = Object.values(smoke).some((v) => v.error) || keys.length !== NEW_KEYS.length || errors.length > 0;
  if (bad) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
