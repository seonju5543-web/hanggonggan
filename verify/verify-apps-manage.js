/* 신청 내역 관리 검증 — 왼쪽으로 밀어 삭제 · 전체 선택 · 되돌리기 (2026-08-24)
   🔴 **반드시 TouchEvent로 '끌기'를 재현한다.** 마우스로는 이 유형이 한 번도 재현되지
      않는다(CLAUDE.md — 13차 세션 학교 검색 사고). 세로 스크롤이 살아 있는지도 함께 본다.
   실행: node verify/verify-apps-manage.js   (CHROME_PATH 필요) */
const { chromium } = require('playwright-core');

/* 진짜 손가락 끌기 — Playwright의 마우스로는 touchstart/move/end가 안 난다 */
async function drag(page, sel, dx, dy, steps = 8) {
  await page.$eval(sel, (el, [dx, dy, steps]) => {
    const r = el.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t],
      }));
    };
    mk('touchstart', x0, y0);
    for (let i = 1; i <= steps; i++) mk('touchmove', x0 + (dx * i) / steps, y0 + (dy * i) / steps);
    mk('touchend', x0 + dx, y0 + dy);
  }, [dx, dy, steps]);
  await page.waitForTimeout(320);
}

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  /* 프로필 + 신청 3건을 미리 넣어 둔다 — 온보딩을 매번 태우지 않으려고 */
  await page.addInitScript(() => {
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
        year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
        nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} },
      applications: [
        { id: 'reg-hufs-myeonhak', appliedAt: '2026-08-01', step: 0 },
        { id: 'reg-hufs-alumni', appliedAt: '2026-08-02', step: 0 },
        { id: 'reg-hufs-yuheungsu', appliedAt: '2026-08-03', step: 0 },
      ],
    }));
  });
  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  /* 알림 동의 시트가 뒤에서 클릭을 가로챈다 — 다른 드라이버와 같은 방식으로 닫는다 */
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(500);
  eq('신청 3건이 보인다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 3);
  /* 🔴 클래스의 display가 [hidden]을 이겨 선택 막대가 늘 떠 있었다 — 눈으로 봐야 잡히는 유형이라
     화면에서 실제로 안 보이는지(offsetParent)까지 확인한다 (CLAUDE.md CSS 함정). */
  eq('선택 모드가 아니면 선택 막대가 안 보인다',
    await page.$eval('#apps-bulkbar', (e) => e.offsetParent !== null), false);
  eq('밀기 전에는 삭제 버튼이 안 보인다',
    await page.$eval('#apps-list .swipe-del', (e) => getComputedStyle(e).opacity), '0');

  console.log('\n■ 왼쪽으로 밀기 (TouchEvent)');
  await drag(page, '#apps-list .swipe-row:first-child .sch-card', -110, 0);
  eq('민 카드가 열린다', await page.$eval('#apps-list .swipe-row:first-child', (e) => e.classList.contains('open')), true);
  eq('민 직후에 상세가 열리지 않는다', await page.$eval('#detail-sheet', (e) => e.hidden), true);

  console.log('\n■ 세로로 끌면 삭제가 열리지 않는다 (목록 스크롤을 뺏지 않는다)');
  await page.$eval('#apps-list .swipe-row.open', (e) => e.classList.remove('open'));
  await drag(page, '#apps-list .swipe-row:nth-child(2) .sch-card', 0, -120);
  eq('세로로 끌면 안 열린다', await page.$eval('#apps-list .swipe-row:nth-child(2)', (e) => e.classList.contains('open')), false);

  console.log('\n■ 삭제와 되돌리기');
  await drag(page, '#apps-list .swipe-row:first-child .sch-card', -110, 0);
  await page.click('#apps-list .swipe-row:first-child .swipe-del');
  await page.waitForTimeout(400);
  eq('한 건이 지워진다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 2);
  eq('되돌리기 단추가 뜬다', await page.$eval('#toast .toast-undo', (e) => e.textContent.trim()), '되돌리기');
  await page.click('#toast .toast-undo');
  await page.waitForTimeout(400);
  eq('되돌리면 3건으로 돌아온다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 3);
  eq('되돌린 항목이 원래 자리에 있다',
    await page.$eval('#apps-list .swipe-row:first-child', (e) => e.dataset.row), 'reg-hufs-yuheungsu');

  console.log('\n■ 선택 모드 · 전체 선택 · 일괄 삭제');
  await page.click('#apps-select-toggle');
  await page.waitForTimeout(300);
  eq('선택 막대가 나온다', await page.$eval('#apps-bulkbar', (e) => e.hidden), false);
  eq('선택 전에는 삭제가 잠겨 있다', await page.$eval('#apps-delete-selected', (e) => e.disabled), true);
  await page.click('#apps-check-all');
  await page.waitForTimeout(300);
  eq('전체 선택하면 3건', await page.$eval('#apps-delete-selected', (e) => e.textContent.trim()), '삭제 3건');
  /* 🔴 전역 appearance:none 때문에 체크박스가 빈 원으로만 보였다 — 체크 그림이 실제로
     그려지는지 본다. 그리고 체크박스가 카드 글자를 덮지 않는지도(들여쓰기) 함께 본다. */
  eq('체크 표시가 그려진다',
    await page.$eval('#apps-check-all', (e) => getComputedStyle(e).backgroundImage !== 'none'), true);
  eq('선택 모드에서 카드가 체크박스만큼 밀린다',
    await page.$eval('#apps-list .sch-card', (e) => parseInt(getComputedStyle(e).paddingLeft, 10) >= 44), true);
  await page.click('#apps-delete-selected');
  await page.waitForTimeout(400);
  eq('전부 지워진다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 0);
  eq('비면 선택 버튼이 사라진다', await page.$eval('#apps-select-toggle', (e) => e.hidden), true);
  await page.click('#toast .toast-undo');
  await page.waitForTimeout(400);
  eq('일괄 삭제도 되돌아온다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 3);

  console.log('\n■ 터치 타깃 (44px 이상)');
  const small = await page.$$eval('.swipe-del, #apps-delete-selected, .toast-undo, .bulk-all',
    (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); })
      .map((e) => e.className));
  eq('작은 터치 타깃이 없다', small, []);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 신청 내역 관리 전부 통과');
  process.exit(fail ? 1 : 0);
})();
