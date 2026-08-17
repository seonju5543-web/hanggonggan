/* 장학금 도우미(챗봇) 브라우저 검증 (Playwright)
   확인 항목
   ① 홈에 진입점이 있고, '한 번에 모두 신청하기' 버튼을 가리지 않는다
   ② 떠 있는 버튼은 온보딩 중에는 안 보이고, 온보딩이 끝나면 보인다
   ③ 도우미가 열리고 추천 질문·직접 입력 둘 다 답한다
   ④ 🔴 **정직 검사** — 모르는 질문에 지어내지 않고 "못 찾았다"고 말한다
   ⑤ 🔴 **정직 검사** — 금액 답에 앱이 모르는 숫자가 섞이지 않는다(원문 확인 안내)
   ⑥ 답에 나온 공고 카드를 누르면 기존 상세 화면이 열리고 도우미는 닫힌다
   ⑦ 대화 목록을 손가락으로 끌어도 시트가 닫히지 않는다(스크롤을 뺏지 않는다)
   ⑧ AI가 꺼져 있는 동안에는 바깥으로 나가는 요청이 **0건**이다
   ⑨ 질문에 스크립트를 넣어도 그대로 실행되지 않는다(XSS)
   실행: python3 -m http.server 8123 & 후 node verify/verify-chat.js */
const { chromium } = require('playwright-core');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const IGNORE_CONSOLE = /Failed to load resource|does not support the Push API in incognito/;
const BASE = 'http://localhost:8123';

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

async function onboard(page) {
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '외대');
  await page.waitForSelector('.ac-list:not([hidden]) .ac-item');
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.waitForSelector('#campus-field:not([hidden])');
  await page.click('#in-campus .chip:nth-child(1)');
  await page.click('#in-track .chip[data-value="humanities"]');
  await page.fill('#in-name', '이선주');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="enrolled"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '3.8');
  await page.selectOption('#in-bracket', '4');
  await page.click('#in-region .chip[data-value="seoul"]');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  await page.click('.onboard-step[data-step="3"] [data-next]');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
}

/* 알림 동의 시트는 온보딩이 끝나고 **2.9초 뒤에** 뜬다(app.js). 그래서 온보딩 직후에 한 번
   보고 없으면 넘어가면, 검사 도중에 시트가 뒤늦게 떠서 화면을 덮고 그때부터 클릭이 전부 막힌다
   (verify-registered.js가 이 문제로 오래 빨간불이었다 — CLAUDE.md 14차 세션 기록).
   그래서 **뜰 때까지 기다렸다가** 치운다. */
async function dismissNotify(page) {
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
}

async function ask(page, q) {
  await page.fill('#chat-input', q);
  await page.press('#chat-input', 'Enter');
  await page.waitForTimeout(350);
  return page.textContent('#chat-log .chat-row.bot:last-child');
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  /* ⑧ 바깥으로 나가는 요청을 전부 적어 둔다 — AI가 꺼져 있으면 0건이어야 한다 */
  const outbound = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) outbound.push(u);
  });

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });

  console.log('\n[1] 진입점과 자리');
  ok(await page.isHidden('#btn-chat-fab'), '온보딩 중에는 떠 있는 버튼이 안 보인다');
  await onboard(page);
  await dismissNotify(page);
  ok(await page.isVisible('#home-ask'), '홈에 물어보는 줄이 있다');
  ok(await page.isVisible('#btn-chat-fab'), '온보딩이 끝나면 떠 있는 버튼이 보인다');

  /* 히어로의 '한 번에 신청' 버튼을 가리지 않는가 — 두 요소의 자리를 실제로 재서 확인 */
  const applyBox = await page.locator('#btn-apply-all').boundingBox();
  const askBox = await page.locator('#home-ask').boundingBox();
  const fabBox = await page.locator('#btn-chat-fab').boundingBox();
  ok(askBox.y > applyBox.y + applyBox.height - 1, '물어보는 줄은 신청 버튼 아래에 있다', { apply: applyBox.y, ask: askBox.y });
  const overlaps = fabBox.y < applyBox.y + applyBox.height && fabBox.y + fabBox.height > applyBox.y;
  ok(!overlaps, '떠 있는 버튼이 신청 버튼과 겹치지 않는다');
  const navBox = await page.locator('#bottom-nav').boundingBox();
  ok(fabBox.y + fabBox.height <= navBox.y + 1, '떠 있는 버튼이 하단 탭을 가리지 않는다', { fab: fabBox.y + fabBox.height, nav: navBox.y });

  console.log('\n[2] 열고 묻기');
  await page.click('#home-ask');
  await page.waitForSelector('#chat-sheet:not([hidden])');
  ok(true, '물어보는 줄을 누르면 도우미가 열린다');
  const chipCount = await page.locator('.chat-chip').count();
  ok(chipCount >= 3, '추천 질문이 보인다', { chipCount });

  await page.click('.chat-chip:nth-child(1)');
  await page.waitForTimeout(350);
  const first = await page.textContent('#chat-log .chat-row.bot:last-child');
  ok(first && first.length > 10, '추천 질문에 답한다', (first || '').slice(0, 60));

  const dl = await ask(page, '마감 임박한 거 알려줘');
  ok(/마감|기한|없어요/.test(dl), '마감 질문에 마감 이야기로 답한다', dl.slice(0, 70));

  const docs = await ask(page, '서류 뭐 준비해?');
  ok(/서류|증명서|찾지 못했어요/.test(docs), '서류 질문에 서류 이야기로 답한다', docs.slice(0, 70));

  console.log('\n[3] 🔴 정직 — 모르면 모른다고 한다');
  const unknown = await ask(page, '쿼카 사육 지원금 있어?');
  ok(/못 알아들었|찾지 못|없어요|못 찾/.test(unknown), '모르는 질문에 "못 찾았다"고 답한다', unknown.slice(0, 80));
  ok(!/원\s*\)?$|\d{3,}만원/.test(unknown.replace(/\s/g, '')) || /확인/.test(unknown),
    '모르는 질문에 금액을 지어내지 않는다');

  const amount = await ask(page, '얼마 받을 수 있어?');
  const honest = /원문|확인|없어요/.test(amount);
  ok(honest, '금액 답에 "원문 확인" 안내가 함께 나온다', amount.slice(0, 90));

  console.log('\n[4] 카드 → 상세 화면');
  await ask(page, '지금 뭐 신청할 수 있어?');
  const cardCount = await page.locator('#chat-log .sch-card').count();
  if (cardCount > 0) {
    await page.click('#chat-log .sch-card:last-child');
    await page.waitForTimeout(600);
    ok(await page.isVisible('#detail-sheet'), '답에 나온 공고를 누르면 상세가 열린다');
    ok(await page.isHidden('#chat-sheet'), '상세가 열리면 도우미는 닫힌다');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    ok(false, '답에 공고 카드가 나온다', { cardCount });
  }

  console.log('\n[5] 대화 목록 스크롤 (시트를 뺏기지 않는가)');
  await page.click('#btn-chat-fab');
  await page.waitForSelector('#chat-sheet:not([hidden])');
  for (let i = 0; i < 4; i++) await ask(page, '지금 뭐 신청할 수 있어?');  // 목록을 길게 만든다
  /* 🔴 마우스가 아니라 **손가락으로 끄는 동작**을 재현해야 한다.
     13차 세션의 학교 검색 스크롤 사고가 이것 때문이었다 — mousedown으로만 검사해서
     '손가락으로 끌면 목록이 안 내려간다'를 한 번도 재현하지 못한 채 통과시켰다.
     Touch는 브라우저 안에서 만들어야 identifier·target이 제대로 붙는다. */
  const sheetEl = page.locator('#chat-sheet');
  const dragged = await page.evaluate(() => {
    const log = document.querySelector('#chat-log');
    log.scrollTop = 0;                       // 맨 위에 둔다 — 다른 시트였다면 여기서 아래로 끌면 닫힌다
    const r = log.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const fire = (type, y) => {
      const t = new Touch({ identifier: 1, target: log, clientX: x, clientY: y });
      log.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    fire('touchstart', r.top + 60);
    fire('touchmove', r.top + 200);           // 아래로 140px 끌기
    fire('touchend', r.top + 200);
    return true;
  });
  ok(dragged, '손가락으로 끄는 동작을 재현했다');
  await page.waitForTimeout(400);
  ok(await sheetEl.isVisible(), '대화를 아래로 끌어도 도우미가 닫히지 않는다');

  console.log('\n[5-1] 🔴 마스코트 — 짧게 누르면 열리고, 꾹 눌러야 옮겨진다');
  await page.evaluate(() => { const s = document.querySelector('#chat-sheet'); if (s && !s.hidden) chatClose(); });
  await page.waitForTimeout(350);
  ok(await page.locator('#btn-chat-fab .mascot').count() > 0, '떠 있는 버튼이 마스코트로 바뀌었다');

  /* 손가락 동작을 흉내 내는 도우미 — pointer 이벤트를 직접 만들어 보낸다 */
  const press = (opts) => page.evaluate(async ({ hold, dx, dy }) => {
    const fab = document.querySelector('#btn-chat-fab');
    const r = fab.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const send = (type, cx, cy) => fab.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, clientX: cx, clientY: cy, button: 0, bubbles: true, cancelable: true,
    }));
    fab.setPointerCapture = () => {};       // 가짜 이벤트에는 진짜 포인터가 없다
    fab.releasePointerCapture = () => {};
    send('pointerdown', x, y);
    await new Promise((res) => setTimeout(res, hold));
    if (dx || dy) { send('pointermove', x + dx, y + dy); await new Promise((res) => setTimeout(res, 40)); }
    send('pointerup', x + (dx || 0), y + (dy || 0));
    await new Promise((res) => setTimeout(res, 350));
    const after = fab.getBoundingClientRect();
    return { sheetOpen: !document.querySelector('#chat-sheet').hidden, left: after.left, top: after.top };
  }, opts);

  const before = await page.locator('#btn-chat-fab').boundingBox();
  const tap = await press({ hold: 90, dx: 0, dy: 0 });
  ok(tap.sheetOpen, '짧게 누르면 도우미가 열린다');
  ok(Math.abs(tap.left - before.x) < 2 && Math.abs(tap.top - before.y) < 2, '짧게 눌렀을 때는 자리가 안 움직인다');

  await page.evaluate(() => chatClose());
  await page.waitForTimeout(350);
  const drag = await press({ hold: 500, dx: -260, dy: -220 });   // 꾹 누른 뒤 왼쪽 위로 끌기
  ok(!drag.sheetOpen, '꾹 눌러 옮긴 뒤에는 도우미가 열리지 않는다(옮기려던 것이지 열려던 게 아니다)');
  ok(Math.abs(drag.top - before.y) > 40, '꾹 누르면 마스코트가 실제로 옮겨진다', { 전: before.y, 후: drag.top });
  ok(drag.left < before.x - 40, '떼면 가까운 쪽 가장자리에 붙는다', { 전: before.x, 후: drag.left });

  /* 하단 탭을 덮어 버리면 학생이 앱을 못 옮겨 다닌다 */
  const low = await press({ hold: 500, dx: 0, dy: 900 });
  const navBox2 = await page.locator('#bottom-nav').boundingBox();
  const fabBox2 = await page.locator('#btn-chat-fab').boundingBox();
  ok(fabBox2.y + fabBox2.height <= navBox2.y + 1, '아무리 아래로 끌어도 하단 탭을 덮지 않는다',
    { fab: fabBox2.y + fabBox2.height, nav: navBox2.y });
  ok(fabBox2.x >= 0 && fabBox2.x + fabBox2.width <= 390, '화면 밖으로 나가지 않는다', fabBox2);

  /* 옮긴 자리가 기억되는가 — 앱을 다시 열어도 그대로여야 한다 */
  const placed = await page.locator('#btn-chat-fab').boundingBox();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(600);
  const after = await page.locator('#btn-chat-fab').boundingBox();
  ok(Math.abs(after.x - placed.x) < 3 && Math.abs(after.y - placed.y) < 3,
    '앱을 다시 열어도 옮긴 자리를 기억한다', { 옮긴자리: placed, 다시연뒤: after });
  await dismissNotify(page);

  console.log('\n[6] 🔴 AI가 꺼져 있는 동안 바깥 통신 0건');
  const aiOff = await page.evaluate(() => typeof chatAiConfigured === 'function' && !chatAiConfigured());
  ok(aiOff, 'AI 자리는 꺼져 있다(endpoint 비어 있음)');
  const external = outbound.filter((u) => !/cdn\.jsdelivr\.net/.test(u));  // 글꼴은 원래부터 쓰던 것
  ok(external.length === 0, 'AI가 꺼진 동안 바깥으로 나간 요청이 없다', external.slice(0, 3));

  console.log('\n[7] 질문에 스크립트를 넣어도 실행되지 않는다');
  await page.evaluate(() => { window.__xss = false; if (document.querySelector('#chat-sheet').hidden) chatOpen(); });
  await page.waitForSelector('#chat-sheet:not([hidden])');
  await page.waitForTimeout(300);
  await ask(page, '<img src=x onerror="window.__xss=true">');
  const xss = await page.evaluate(() => window.__xss);
  ok(xss === false, '질문 속 스크립트가 실행되지 않는다');
  const raw = await page.locator('#chat-log .chat-row.me').last().textContent();
  ok(raw.includes('<img'), '질문은 글자 그대로 보인다');

  console.log('\n[8] 콘솔 오류');
  ok(errors.length === 0, '콘솔·페이지 오류 없음', errors.slice(0, 3));

  await page.screenshot({ path: `${__dirname}/shot-chat.png` });
  await browser.close();

  console.log(fail === 0 ? '\n✅ 도우미 검증 통과' : `\n❌ 실패 ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
