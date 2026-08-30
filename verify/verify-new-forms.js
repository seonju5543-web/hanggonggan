/* 신규 등록 양식(삼일·보건2·산학·명지고시) 검증:
   ① data/forms.json 병합 확인 ② 각 스키마가 질문 화면·문서 렌더링에서 오류 없이 동작
   ③ 대표 1종(삼일)은 UI로 질문→문서 생성까지 ④ 명지 프로필로 고시장학금 양식 확인 */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
const { nextUntil } = require('./onboard-helper.js');

const NEW_KEYS = ['samil-apply', 'bogun-study-apply', 'bogun-multi-apply', 'sanhak-foreign-apply', 'mju-gosi-apply'];

/* 구동 대상은 고정하지 않고 그때그때 고른다 — 공고는 마감되면 신청 버튼이 잠기므로,
   특정 공고 id를 박아두면 시간이 지나 검증이 저절로 깨진다(2026-07-30 실제 발생).
   같은 양식을 쓰면서 아직 마감되지 않은 접수분을 찾아 구동한다. */
const REG = require('../data/registered.json');
/* 🔴 KST 로 읽는다 — 그냥 toISOString 은 **UTC** 라 새벽에 하루 어긋나고,
   그날 마감인 공고가 '아직 안 지났다'로 분류된다(verify-explore-sort 가 그래서 빨간불이었다). */
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
function pickTarget(formId) {
  const live = REG.items.filter((i) => i.formId === formId && (!i.deadline || i.deadline >= TODAY));
  if (!live.length) return null;
  // 학교 한정 공고여야 온보딩 학교를 정해 구동할 수 있다
  return live.find((i) => (i.eligibility || {}).schoolOnly) || live[0];
}
const SCHOOL_ALIAS = { 한국외국어대학교: '외대', 서울시립대학교: '서울시립', 성균관대학교: '성균관', 중앙대학교: '중앙', 명지대학교: '명지', 광운대학교: '광운', 동국대학교: '동국', 경희대학교: '경희' };

/* 질문 최적화(2026-08-18) 이후: 앱이 아는 값은 **질문으로 안 나오고** 자동 채움 패널
   (.fq-auto-in[data-f=…])에 들어간다. 그래서 '#fq-<id> 입력칸이 있다'를 전제하면 안 된다.
   어느 쪽에 있든 값을 읽고/쓰는 헬퍼로 감싼다 — 이게 최적화가 실제로 먹었는지도 함께 검사한다. */
async function fqValue(page, id) {
  const auto = await page.$(`.fq-auto-in[data-f="${id}"]`);
  if (auto) return (await auto.inputValue()) + ' (자동 채움)';
  const el = await page.$(`#fq-${id}`);
  return el ? await el.inputValue() : '(칸 없음)';
}
async function fqFill(page, id, value) {
  const auto = await page.$(`.fq-auto-in[data-f="${id}"]`);
  if (auto) { await auto.fill(value); return 'auto'; }
  const el = await page.$(`#fq-${id}`);
  if (el) { await el.fill(value); return 'asked'; }
  return 'none';
}

async function onboard(page, school, major) {
  await page.click('.onboard-step[data-step="0"] [data-next]');
  /* 🔴 **학교 이름을 박거나 데이터에서 온 값을 그대로 믿지 않는다** (2026-08-30).
     전국 공고(schoolOnly 없음)가 골라지면 school 이 undefined 로 들어오고, 서비스 학교를
     둘로 좁힌 뒤로는 뺀 학교 이름도 자동완성에 안 떠서 이 드라이버가 통째로 죽었다.
     앱이 지금 서비스하는 학교로 물러난다 — 이 검사가 보는 것은 **양식 작성**이지 학교가 아니다. */
  const served = await page.evaluate(() => UNIVERSITIES.slice());
  const ok = school && served.some((u) => u.includes(school) || school.includes(u)
    || u.replace('한국외국어', '외').includes(school));
  await page.fill('#in-school', ok ? school : served[0]);
  await page.waitForTimeout(250);
  await page.click('.ac-list:not([hidden]) .ac-item');
  // 이원화 캠퍼스 학교면 첫 캠퍼스 선택 (외대 등)
  const campusVisible = await page.$('#campus-field:not([hidden])');
  if (campusVisible) await page.click('#in-campus .chip:first-child');
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', major);
  await page.fill('#in-name', '김검증');
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
  await page.fill('#in-email', 'test@test.ac.kr');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: (process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
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

  // ③ 삼일장학회: UI로 질문→문서 생성 (마감 안 지난 접수분을 자동으로 골라 구동)
  const samilTarget = pickTarget('samil-apply');
  if (!samilTarget) {
    console.log('삼일 UI 구동 건너뜀 — samil-apply를 쓰는 공고가 전부 마감됨 (양식 자체는 ②에서 검증됨)');
  } else {
  console.log('삼일 UI 구동 대상:', samilTarget.id, '|', samilTarget.name.slice(0, 40));
  const samilPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  samilPage.on('pageerror', (e) => errors.push('PAGEERROR-SAMIL: ' + e.message));
  samilPage.on('dialog', async (d) => { await d.accept(); });
  await samilPage.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await onboard(samilPage, SCHOOL_ALIAS[samilTarget.eligibility.schoolOnly] || samilTarget.eligibility.schoolOnly, '컴퓨터공학부');
  {
    const page = samilPage; // 아래 단언들은 기존 그대로 재사용
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.click(`#explore-list [data-detail="${samilTarget.id}"]`);
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  const autoName = await fqValue(page, 'name');
  const autoPhone = await fqValue(page, 'phoneSelf');
  const autoEmail = await fqValue(page, 'email');
  console.log('삼일 자동 채움 — 성명:', autoName, '| 휴대전화:', autoPhone, '| 이메일:', autoEmail);
  /* 지원 분야·참석 여부는 보기가 2~3개인 단일 선택이라 choice로 승격된다(.fq-choice).
     다중 선택(.fq-checks)으로 남는 것도 있어 두 자리를 모두 본다 */
  await page.click('.fq-choice[data-f="field"] .chip:nth-child(2), .fq-checks[data-f="field"] .chip:nth-child(2)');
  await page.click('.fq-choice[data-f="ceremony"] .chip:first-child, .fq-checks[data-f="ceremony"] .chip:first-child');
  console.log('삼일 생년월일 입력 위치:', await fqFill(page, 'birth', '2004-03-15'));
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  console.log('삼일 문서 — 제목:', doc.includes('재단법인 삼일장학회 장학금 지원 신청서'),
    '| ☑ 희망:', doc.includes('☑ 희망(希望)삼일장학생'),
    '| ☑ 참석:', doc.includes('☑ 참  석'),
    '| 서약문:', doc.includes('선발 취소 등 어떤 조치에도 이의를 제기치 않겠습니다'));
  await page.screenshot({ path: `${__dirname}/shot-40-samil-doc.png` });
  }
  }

  // ④ 명지 프로필 → 고시장학금 양식 (마감 안 지난 접수분이 있을 때만)
  const gosiTarget = pickTarget('mju-gosi-apply');
  if (!gosiTarget) {
    console.log('명지 고시 UI 구동 건너뜀 — mju-gosi-apply를 쓰는 공고가 마감됨 (양식 자체는 ②에서 검증됨)');
  } else {
  const page2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page2.on('pageerror', (e) => errors.push('PAGEERROR2: ' + e.message));
  page2.on('dialog', async (d) => { await d.accept(); });
  await page2.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await onboard(page2, SCHOOL_ALIAS[gosiTarget.eligibility.schoolOnly] || gosiTarget.eligibility.schoolOnly, '융합소프트웨어학부');
  await page2.click('.nav-item[data-nav="explore"]');
  await page2.waitForTimeout(600);
  await page2.click(`#explore-list [data-detail="${gosiTarget.id}"]`);
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
  const bad = Object.values(smoke).some((v) => v.error) || keys.length !== NEW_KEYS.length;
  if (bad) process.exit(1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
