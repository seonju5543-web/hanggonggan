/* 금액 상세 ↔ 공고 카드 되돌아가기 (2026-08-29 개발자 요청)
   "금액 상세에서 공고를 누르면 그 카드가 뜨는데, 내리면 그냥 닫혀서 금액 상세를
    처음부터 다시 열어야 한다"는 귀찮음을 없앤 동작을 **실제로 눌러서** 확인한다.

   🔴 글자만 훑는 검사로는 안 된다 — 같은 날 그렇게 만든 검사가 **아무것도 안 하는
      한 줄짜리 파일도 통과**시켰다(코드 리뷰가 잡았다). 그래서 진짜 브라우저로 민다.
   ⚠️ 쓸어 내리기는 **반드시 TouchEvent 로** 재현할 것 — 마우스로는 이 유형이 한 번도
      재현되지 않는다(13차 세션 학교 검색 사고).

   실행: CHROME_PATH=... node verify/verify-sheet-back.js   (localhost:8123 서빙 중이어야 함) */
const { chromium } = require('playwright-core');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.PORT || 8123;

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

/* 손가락으로 시트를 아래로 끄는 동작 */
async function swipeDown(page, sel) {
  const at = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; });
  await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const mk = (t, cy) => new TouchEvent(t, { bubbles: true, cancelable: true,
      touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })],
      changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })] });
    el.dispatchEvent(mk('touchstart', y));
    el.dispatchEvent(mk('touchmove', y + 140));
    el.dispatchEvent(mk('touchend', y + 140));
  }, at);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.setItem('handaejang.v1', JSON.stringify({
    profile: { school: '한국외국어대학교', campus: '', track: 'engineering', major: '컴퓨터공학과',
      year: 3, gpa: 3.8, bracket: 5, flags: [], onboarded: true, sid: '', phone: '', account: '' },
    applications: [], docs: {}, notify: {} })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 알림 동의 시트가 홈을 덮는다 — 먼저 치운다
  await page.evaluate(() => { for (const id of ['#notify-sheet', '#notify-backdrop']) {
    const e = document.querySelector(id); if (e) { e.classList.remove('show'); e.hidden = true; } } });

  const head = () => page.$eval('#detail-sheet .sheet-body', (e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 30));
  const isOpen = () => page.evaluate(() => !document.querySelector('#detail-sheet').hidden);

  console.log('■ 금액 상세 → 공고 카드 → 내리면 되돌아온다');
  await page.click('#hero-amount');
  await page.waitForTimeout(600);
  eq('금액 상세가 열린다', (await head()).startsWith('금액 상세'), true);

  const rows = await page.$$('#detail-sheet [data-goto]');
  eq('금액 상세에 공고 줄이 있다', rows.length > 0, true);

  /* 🔴 금액 상세를 **내려서** 본 다음 공고를 누른다 (2026-08-29 개발자 지적:
     "공고를 누르면 해당 공고의 아랫부분이 나온다"). 스크롤되는 것은 `.sheet` 자신인데
     내용만 갈아끼우므로 앞 내용에서 내려 둔 위치가 그대로 남아 있었다.
     ⚠️ 맨 위에서 누르면 이 버그가 **재현되지 않는다** — 반드시 내려 두고 눌러야 한다. */
  const scrolled = await page.evaluate(() => {
    const s = document.querySelector('#detail-sheet');
    s.scrollTop = 240;
    return s.scrollTop;
  });
  eq('금액 상세를 내려서 볼 수 있다 (내용이 충분히 길다)', scrolled > 0, true);

  /* ⚠️ 내려 둔 상태라 Playwright 의 실제 클릭은 위치 검사에 걸린다(배경이 가로챈다).
     이 저장소가 쓰는 방식대로 **요소에게 직접** 누르게 한다 — 이벤트는 그대로 버블링되어
     위임 리스너가 받는다(CLAUDE.md 동국대 팝업 항목과 같은 수법). */
  await rows[0].evaluate((e) => e.click());
  await page.waitForTimeout(700);
  eq('공고 카드로 바뀐다', (await head()).startsWith('금액 상세'), false);
  /* 🔴 이 한 줄이 개발자가 지적한 그 증상이다 */
  eq('  공고 카드는 맨 위(제목)부터 보인다',
     await page.$eval('#detail-sheet', (e) => e.scrollTop), 0);
  eq('  그래서 제목이 화면 안에 있다',
     await page.$eval('#detail-sheet .sheet-title', (e) => {
       const r = e.getBoundingClientRect();
       return r.top >= 0 && r.top < window.innerHeight;
     }), true);

  /* 🔴 되돌아갈 때 **바로 튀어나오지 않는다** (개발자 지적: "너무 빠르게 나와서 헷갈린다").
     내려가는 동작이 끝난 뒤에 이전 화면이 올라와야 한다. 손을 뗀 **직후**를 확인한다. */
  await swipeDown(page, '#detail-sheet');
  await page.waitForTimeout(60);
  eq('손을 떼자마자 금액 상세가 튀어나오지 않는다', (await head()).startsWith('금액 상세'), false);
  eq('  시트가 내려가는 중이다 (.show 가 빠져 있다)',
     await page.$eval('#detail-sheet', (e) => e.classList.contains('show')), false);

  await page.waitForTimeout(800);
  eq('내리면 시트가 닫히지 않는다', await isOpen(), true);
  eq('  보던 금액 상세로 돌아온다', (await head()).startsWith('금액 상세'), true);
  eq('  다시 올라와 있다 (.show 가 돌아온다)',
     await page.$eval('#detail-sheet', (e) => e.classList.contains('show')), true);
  /* 되돌아오면 **보던 자리**여야 한다 — 맨 위로 튕기면 처음부터 다시 찾아야 한다 */
  eq('  내려서 보던 자리로 돌아온다',
     await page.$eval('#detail-sheet', (e) => e.scrollTop > 0), true);

  /* 🔴 되돌아오면 **내려 둔 자리**라 `scrollTop > 0` 이다. 그 상태의 쓸어내림은
     닫기가 아니라 **스크롤**이어야 맞다(`scrollableAtTop` 이 그렇게 가른다 — 이 확인을
     지우면 대화 목록을 위로 올릴 때마다 시트가 닫히는 그 사고가 되살아난다).
     그래서 실제 사용자처럼 **맨 위로 올린 뒤** 내린다. */
  eq('내려 둔 자리에서는 쓸어내려도 안 닫힌다 (스크롤이 먼저다)', await (async () => {
    await swipeDown(page, '#detail-sheet');
    await page.waitForTimeout(500);
    return await isOpen();
  })(), true);

  await page.evaluate(() => { document.querySelector('#detail-sheet').scrollTop = 0; });
  await swipeDown(page, '#detail-sheet');
  await page.waitForTimeout(800);
  eq('맨 위에서 한 번 더 내리면 닫힌다 (한 단계만 되돌아간다)', await isOpen(), false);

  /* 🔴 코드 리뷰가 지목한 자리 — 되돌아갈 곳이 **그릴 수 없는 상태**면 어떻게 되나.
     `renderAmountDetail()` 은 `lastBill` 이 없으면 아무것도 안 그리고 돌아온다.
     그때 그냥 return 하면 시트가 **열린 채 멈춘다** — 학생이 내려도 아무 일이 안 생긴다.
     지금은 못 그렸다는 것을 알고 닫는다. */
  console.log('\n■ 되돌아갈 곳을 그릴 수 없으면 멈추지 않고 닫는다');
  await page.click('#hero-amount');
  await page.waitForTimeout(600);
  const rows2 = await page.$$('#detail-sheet [data-goto]');
  await rows2[0].click();
  await page.waitForTimeout(700);
  await page.evaluate(() => { lastBill = null; });   // 그릴 수 없는 상태로 만든다
  await swipeDown(page, '#detail-sheet');
  await page.waitForTimeout(800);
  eq('그릴 수 없으면 시트가 멈추지 않고 닫힌다', await isOpen(), false);

  console.log('\n■ 금액 상세를 거치지 않은 공고 카드는 그냥 닫힌다');
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(700);
  const card = await page.$('#explore-list [data-detail]');
  if (card) {
    await card.click();
    await page.waitForTimeout(600);
    await swipeDown(page, '#detail-sheet');
    await page.waitForTimeout(800);
    eq('탐색 목록에서 연 카드는 한 번에 닫힌다', await isOpen(), false);
  } else console.log('  · 탐색 목록에 카드가 없어 건너뜀');

  eq('JS 오류 0건', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 시트 되돌아가기 전부 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
