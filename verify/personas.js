/* 다양한 사용자 페르소나로 앱을 훑어 UX·엔진 이상을 찾는 탐색 드라이버.
   - 대표 페르소나 몇은 UI로 직접 온보딩(클릭) → UI 버그 포착
   - 넓은 매트릭스는 localStorage 주입 → 매칭 엔진·렌더·빈 상태 포착 */
const { chromium } = require('playwright-core');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const SCHOOLS = [
  '한국외국어대학교', '성균관대학교', '광운대학교', '경희대학교', '동국대학교',
  '중앙대학교', '명지대학교', '홍익대학교', '상명대학교', '숙명여자대학교',
  '서울시립대학교', '연세대학교', '서울대학교', '고려대학교', '한양대학교',
  'KAIST', '부산대학교', '가천대학교', '이화여자대학교', '내가만든대학교',
];
const CAMPUS = { '성균관대학교': '자연과학캠퍼스(수원)', '한국외국어대학교': '글로벌캠퍼스(용인)',
  '경희대학교': '국제캠퍼스(용인)', '동국대학교': 'WISE캠퍼스(경주)', '중앙대학교': '다빈치캠퍼스(안성)',
  '연세대학교': '미래캠퍼스(원주)', '고려대학교': '세종캠퍼스', '한양대학교': 'ERICA캠퍼스(안산)' };
const TRACKS = ['humanities','social','business','education','science','engineering','arts','medical'];
const STATUSES = ['enrolled','freshman','returning'];
const REGIONS = ['seoul','gyeonggi','etc'];
const FLAGSETS = [[], ['basicLiving'], ['multiChild'], ['disabled'], ['merit'], ['nearPoverty'],
  ['basicLiving','multiChild','disabled']];

function mkProfile(i) {
  const school = SCHOOLS[i % SCHOOLS.length];
  const campus = CAMPUS[school] || '';
  return {
    name: i % 4 === 0 ? '' : '학생' + i,
    school, campus,
    track: TRACKS[i % TRACKS.length],
    major: i % 3 === 0 ? '' : '컴퓨터공학과',
    year: (i % 4) + 1,
    status: STATUSES[i % STATUSES.length],
    gpa: [null, 0, 1.9, 2.75, 3.5, 4.0, 4.5][i % 7],
    bracket: [null, 1, 4, 8, 9, 10][i % 6],
    region: REGIONS[i % REGIONS.length],
    flags: FLAGSETS[i % FLAGSETS.length],
    cert: i % 2 === 0,
    exchange: i % 5 === 0,
    common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'networkidle' });

  const anomalies = [];
  const N = 120;
  let emptyExplore = 0, zeroHero = 0;
  const heroVals = [];

  for (let i = 0; i < N; i++) {
    const p = mkProfile(i);
    await page.evaluate((prof) => {
      localStorage.setItem('handaejang.v1', JSON.stringify({ profile: prof, applications: [] }));
    }, p);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(120);

    // 홈 히어로
    const hero = await page.textContent('#hero-amount').catch(() => 'ERR');
    const heroCount = await page.textContent('#hero-count').catch(() => 'ERR');
    if (/NaN|undefined|Infinity|-/.test(hero)) anomalies.push(`#${i} ${p.school}: bad hero "${hero}"`);
    if (/최대 0원/.test(hero)) zeroHero++;
    heroVals.push(hero);

    // 탐색
    await page.click('.nav-item[data-nav="explore"]');
    await page.waitForTimeout(80);
    const cardCount = await page.locator('#explore-list .sch-card').count();
    const emptyMsg = await page.locator('#explore-list .empty').count();
    if (cardCount === 0) { emptyExplore++; anomalies.push(`#${i} ${p.school}/${p.track}/${p.status}: explore EMPTY (${emptyMsg?'empty msg shown':'NO empty msg!'})`); }

    // 상세 시트 하나 열어보기
    if (cardCount > 0) {
      await page.locator('#explore-list .sch-card').first().click();
      await page.waitForTimeout(120);
      const sheetShown = await page.locator('#detail-sheet.show').count();
      if (!sheetShown) anomalies.push(`#${i} ${p.school}: detail sheet did not open`);
      const title = await page.locator('#detail-sheet .sheet-title').textContent().catch(()=>'');
      if (!title) anomalies.push(`#${i} ${p.school}: detail sheet empty title`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(80);
    }
    await page.click('.nav-item[data-nav="home"]').catch(()=>{});
    await page.waitForTimeout(40);
  }

  console.log('=== PERSONA SWEEP ===');
  console.log('personas run:', N);
  console.log('explore empty:', emptyExplore, '| zero hero (최대 0원):', zeroHero);
  console.log('distinct hero values sample:', [...new Set(heroVals)].slice(0, 12).join(' | '));
  console.log('=== ANOMALIES (' + anomalies.length + ') ===');
  anomalies.slice(0, 60).forEach((a) => console.log(a));
  console.log('=== PAGE/CONSOLE ERRORS (' + errors.length + ') ===');
  [...new Set(errors)].slice(0, 30).forEach((e) => console.log(e));
  await browser.close();
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
