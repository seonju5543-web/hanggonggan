/* 원문 링크 검증 드라이버 (2026-07-31)

   확인하는 것: 앱에서 장학 공고를 열고 '원문 공고 ↗'를 눌렀을 때 **그 장학금 공고**로 가는가.
   예전에는 클릭형 게시판(경희·동국) 공고의 주소가 게시판 목록 주소라서, 눌러도 학교 장학
   공지 목록 전체가 열렸다.

   검사 3단:
   ① 데이터 전수 — registered.json·notices.json에 목록 주소(#n- 표식)가 몇 건 남아 있나
   ② 브라우저 — 경희대 학생으로 온보딩해 실제 카드를 열고 링크 href와 라벨을 읽는다
   ③ 정직성 — 아직 원문 주소를 못 찾은 공고는 '게시판 목록 ↗'으로 표기되고 안내가 붙는가

   실행: (python3 -m http.server 8123 &) 후 node verify/verify-source-links.js */
const { chromium } = require('playwright-core');
const { nextUntil } = require('./onboard-helper.js');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;
const isMarker = (u) => /#n-/.test(String(u || ''));
// 검사할 학교 — 기본 경희대(문제가 처음 보고된 학교). LINKCHECK_SCHOOL로 바꿀 수 있다.
const SCHOOL = process.env.LINKCHECK_SCHOOL || '경희';

(async () => {
  let fail = 0;
  const bad = (m) => { fail += 1; console.log('  ✕ ' + m); };
  const ok = (m) => console.log('  ✓ ' + m);

  /* ── ① 데이터 전수 검사 ─────────────────────────────── */
  console.log('■ 데이터 전수 — 목록 주소로 남아 있는 공고');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8')).items;
  const nots = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8')).items;
  const regMarkers = reg.filter((r) => isMarker(r.sourceUrl));
  const notMarkers = nots.filter((n) => isMarker(n.url));
  console.log(`  정식 등록 ${reg.length}건 중 목록 주소 ${regMarkers.length}건 · 실시간 공고 ${nots.length}건 중 ${notMarkers.length}건`);
  regMarkers.forEach((r) => console.log(`    - [남음] ${r.id} · ${r.name.slice(0, 40)}`));

  // 원문 주소가 첨부 내려받기 주소로 잘못 들어간 것도 함께 본다
  const dl = reg.filter((r) => /mode=download|attachNo=|fileDown/i.test(r.sourceUrl || ''));
  if (dl.length) bad(`sourceUrl이 첨부 내려받기 주소인 항목 ${dl.length}건: ${dl.map((d) => d.id).join(', ')}`);
  else ok('sourceUrl이 첨부 내려받기 주소인 항목 없음');

  /* ── ② 브라우저 검사 ─────────────────────────────── */
  console.log(`■ 브라우저 — ${SCHOOL} 학생으로 실제 카드를 열어 링크 확인`);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);   // 없는 요소를 30초씩 기다리다 검사가 멈추지 않게
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', SCHOOL);
  await page.waitForTimeout(300);
  await page.click('.ac-list:not([hidden]) .ac-item');
  // 경희대는 이원화 캠퍼스라 캠퍼스 선택이 뜰 수 있다
  const campusChip = await page.$('#in-campus .chip');
  if (campusChip) await campusChip.click();
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', '컴퓨터공학과');
  await page.fill('#in-name', '홍길동');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.0');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 단계 번호를 박지 말 것 — 온보딩이 4단계에서 6단계가 되며 이 검사들이 죽어 있었다 */
  await nextUntil(page, '#in-sid');
  await page.fill('#in-sid', '2023100123');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@univ.ac.kr');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1500);
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(800);

  /* 그 학교 학생에게 보이는 카드를 하나씩 열어 '원문 공고' 링크의 실제 href를 읽는다.
     학교 판정은 매칭 엔진이 쓰는 것과 같은 필드(eligibility.schoolOnly)로 — 제목에 학교 이름이
     안 들어간 교내 공고('복지장학2(면학) 지급 안내')를 놓치지 않기 위해. */
  const khuIds = reg
    .filter((r) => new RegExp(SCHOOL).test((r.eligibility && r.eligibility.schoolOnly) || ''))
    .map((r) => r.id);
  const checked = [];
  for (const id of khuIds) {
    const cardSel = `#explore-list [data-detail="${id}"]`;
    if (!(await page.$(cardSel))) continue;   // 마감돼 목록에서 빠진 공고는 건너뛴다
    await page.click(cardSel);
    await page.waitForSelector('#detail-sheet.show');
    await page.waitForTimeout(300);
    const link = await page.$$eval('#detail-sheet .sheet-deadline a', (els) =>
      els.map((e) => ({ href: e.href, text: e.textContent.trim() }))).catch(() => []);
    const legend = await page.$$eval('#detail-sheet .doc-legend', (els) => els.map((e) => e.textContent)).catch(() => []);
    if (link.length) {
      const l = link[link.length - 1];
      checked.push({ id, href: l.href, label: l.text, hasGuide: legend.some((t) => /목록에서/.test(t)) });
    }
    // 상세 시트는 Escape 또는 배경 클릭으로 닫힌다 (닫기 버튼 요소는 없다 — app.js closeSheet)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
  console.log(`  ${SCHOOL} 카드 ${checked.length}건의 링크를 실제로 읽음`);
  for (const c of checked) {
    const marker = isMarker(c.href);
    const labelOk = marker ? /게시판 목록/.test(c.label) : /원문 공고/.test(c.label);
    const line = `${c.id} · ${c.label} · ${c.href.slice(0, 92)}`;
    if (!labelOk) bad(`라벨이 실제 링크와 다릅니다 — ${line}`);
    else if (marker && !c.hasGuide) bad(`목록 링크인데 '목록에서 찾으세요' 안내가 없습니다 — ${line}`);
    else ok(line);
  }
  if (!checked.length) bad(`${SCHOOL} 카드를 한 건도 열지 못했습니다 (온보딩·매칭 확인 필요)`);

  /* 실시간 공고 피드의 라벨도 같은 규칙인지 */
  const feed = await page.$$eval('#explore-list .notice-card', (els) => els.map((e) => ({
    href: e.href, tail: (e.querySelector('.sch-provider:last-of-type') || {}).textContent || '',
  }))).catch(() => []);
  const feedWrong = feed.filter((f) => /#n-/.test(f.href) !== /게시판 목록에서 보기/.test(f.tail));
  if (feed.length && feedWrong.length) bad(`실시간 공고 피드 라벨 불일치 ${feedWrong.length}건`);
  else ok(`실시간 공고 피드 라벨 일치 (${feed.length}건 검사)`);

  await page.screenshot({ path: SHOT('60-source-links'), fullPage: false });
  if (errors.length) bad('콘솔 오류: ' + errors.slice(0, 3).join(' | '));
  else ok('콘솔 오류 없음');
  await browser.close();

  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 원문 링크 검사 전부 통과');
  process.exit(fail ? 1 : 0);
})();
