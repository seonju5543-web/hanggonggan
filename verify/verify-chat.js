/* 장학금 도우미(챗봇) 브라우저 검증 (Playwright)
   확인 항목
   ① 홈에 진입점이 있고, '한 번에 모두 신청하기' 버튼을 가리지 않는다
   ② 떠 있는 버튼은 온보딩 중에는 안 보이고, 온보딩이 끝나면 보인다
   ③ 도우미가 열리고 추천 질문·직접 입력 둘 다 답한다
   ④ 🔴 **정직 검사** — 모르는 질문에 지어내지 않고 "못 찾았다"고 말한다
   ⑤ 🔴 **정직 검사** — 금액 답에 앱이 모르는 숫자가 섞이지 않는다(원문 확인 안내)
   ⑥ 답에 나온 공고 카드를 누르면 기존 상세 화면이 열리고 도우미는 닫힌다
   ⑦ 쓸어내려 닫기 — 대화가 중간이면 스크롤, 맨 위·머리말이면 닫기 (스크롤을 뺏지 않는다)
   ⑧ AI가 꺼져 있는 동안에는 바깥으로 나가는 요청이 **0건**이다
   ⑨ 질문에 스크립트를 넣어도 그대로 실행되지 않는다(XSS)
   실행: python3 -m http.server 8123 & 후 node verify/verify-chat.js */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
const { nextUntil } = require('./onboard-helper.js');
const EXE = (process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const IGNORE_CONSOLE = /Failed to load resource|does not support the Push API in incognito/;
const BASE = `http://localhost:${PORT}`;

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
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '3.8');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 단계 번호를 박지 말 것 — 온보딩이 4단계에서 6단계가 되며 이 검사가 죽어 있었다 */
  await nextUntil(page, '#btn-finish-onboard');
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
  ok(await page.isVisible('#btn-chat-fab'), '온보딩이 끝나면 마스코트가 보인다');
  /* 도우미로 들어가는 길은 마스코트 하나뿐이다 — 홈의 진입줄은 2026-08-17에 없앴다 */
  ok(await page.locator('#home-ask').count() === 0, '홈 진입줄은 없앴다(길은 마스코트 하나)');

  /* 히어로의 '한 번에 신청' 버튼을 가리지 않는가 — 두 요소의 자리를 실제로 재서 확인 */
  const applyBox = await page.locator('#btn-apply-all').boundingBox();
  const fabBox = await page.locator('#btn-chat-fab').boundingBox();
  const overlaps = fabBox.y < applyBox.y + applyBox.height && fabBox.y + fabBox.height > applyBox.y;
  ok(!overlaps, '떠 있는 버튼이 신청 버튼과 겹치지 않는다');
  const navBox = await page.locator('#bottom-nav').boundingBox();
  ok(fabBox.y + fabBox.height <= navBox.y + 1, '떠 있는 버튼이 하단 탭을 가리지 않는다', { fab: fabBox.y + fabBox.height, nav: navBox.y });

  console.log('\n[2] 열고 묻기');
  await page.click('#btn-chat-fab');
  await page.waitForSelector('#chat-sheet:not([hidden])');
  ok(true, '마스코트를 누르면 도우미가 열린다');
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

  console.log('\n[3-1] 말귀 — 같은 뜻 다른 말 · 초성 · 오타 · 앞 대화 기억');
  /* 규칙 자체를 직접 재는 편이 화면 글자로 재는 것보다 정확하다 */
  const lang = await page.evaluate(() => ({
    /* ① 같은 뜻 다른 말 — '기숙사비'를 물으면 '생활관'까지 함께 찾는다 */
    synonym: chatExpandWords(['기숙사비']).includes('생활관'),
    /* ③ 초성 — 'ㅎㄱㅈㅎㅈㄷ'이 '한국장학재단'의 초성과 같은가 */
    chosung: chatChosung('한국장학재단') === 'ㅎㄱㅈㅎㅈㄷ',
    /* ③ 오타 하나는 봐주고, 두 개는 안 봐준다 */
    typo1: chatNear('장학재단', '장학제단'),
    typo2: chatNear('장학재단', '장확제단'),
    /* 너무 짧은 낱말에는 오타 봐주기를 쓰지 않는다(엉뚱한 게 걸린다) */
    typoShort: chatNear('국장', '국정'),
  }));
  ok(lang.synonym, "'기숙사비'를 물으면 '생활관'도 함께 찾는다");
  ok(lang.chosung, '초성으로도 찾을 수 있다 (한국장학재단 → ㅎㄱㅈㅎㅈㄷ)');
  ok(lang.typo1 && !lang.typo2, '오타 하나는 봐주고 두 개는 안 봐준다', lang);
  ok(!lang.typoShort, '짧은 낱말에는 오타 봐주기를 쓰지 않는다');

  /* ② 되묻기 — 못 찾으면 비슷한 후보를 눌러 볼 수 있게 준다 */
  const clarified = await ask(page, '조병두 장학');
  const askChips = await page.locator('#chat-log .chat-asks .chat-chip').count();
  ok(/이 중 하나인가요|찾았어요/.test(clarified) || askChips > 0,
    '딱 안 맞아도 비슷한 후보를 되묻는다', clarified.slice(0, 60));

  /* ④ 앞 대화 기억 — 공고 하나를 물은 뒤 "그거 서류 뭐야?"가 통하는가 */
  const one = await page.evaluate(() => {
    const m = chatApplyable()[0];
    return m ? m.sch.name : null;
  });
  if (one) {
    await ask(page, one);
    const follow = await ask(page, '그거 서류 뭐야?');
    ok(follow.includes(one.slice(0, 6)) || /서류/.test(follow),
      '"그거 서류 뭐야?"가 앞에서 말한 공고를 가리킨다', follow.slice(0, 70));
  } else {
    ok(false, '앞 대화 기억을 시험할 공고가 있다');
  }

  /* ⑥ 답에서 바로 다음 행동 */
  await ask(page, '서류 뭐 준비해?');
  /* ⚠️ 대화에는 앞선 답들의 버튼도 남아 있다 — **마지막 답의** 버튼을 눌러야 한다.
     (`#chat-log .chat-act:last-child`는 앞 답의 버튼도 함께 걸린다) */
  const lastBot = page.locator('#chat-log .chat-row.bot').last();
  const acts = await lastBot.locator('.chat-act').count();
  ok(acts > 0, '답에서 바로 다음 행동으로 갈 수 있다', { acts });
  const wallet = lastBot.locator('.chat-act[data-act="wallet"]');
  ok(await wallet.count() > 0, "서류 답에는 '보관함 열기'가 붙는다");
  await wallet.click();
  await page.waitForTimeout(700);
  ok(await page.isVisible('#screen-my'), '행동 버튼을 누르면 그 화면으로 간다');
  await page.click('#btn-chat-fab');
  await page.waitForSelector('#chat-sheet:not([hidden])');

  /* ⑦ 못 알아들은 질문을 기기 안에 세어 둔다 (밖으로는 안 보낸다) */
  await ask(page, 'ㅁㄴㅇㄹ 쿼카 사육');
  const missed = await page.evaluate(() => Object.keys(chatMissReport()).length);
  ok(missed > 0, '못 알아들은 질문을 기기 안에 세어 둔다', { missed });

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
  /* 아래로 끄는 동작 한 번. sel = 손가락이 닿는 곳, top = 대화 목록을 맨 위에 둘지 */
  const dragDown = (sel, top) => page.evaluate(({ sel, top }) => {
    const log = document.querySelector('#chat-log');
    log.scrollTop = top ? 0 : Math.max(1, Math.floor(log.scrollHeight - log.clientHeight));
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const fire = (type, y) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    fire('touchstart', r.top + 20);
    fire('touchmove', r.top + 160);           // 아래로 140px 끌기
    fire('touchend', r.top + 160);
    return log.scrollTop;
  }, { sel, top });

  /* 🔴 진짜 지켜야 하는 것 — 대화가 중간에 있을 때 끌면 **스크롤이지 닫기가 아니다.**
     예전에 도우미에 쓸어내려 닫기를 안 붙였던 이유가 이것이었다(시트의 scrollTop이 늘 0이라
     대화를 올려 보려 할 때마다 닫혔다). 지금은 손가락 아래 스크롤 영역까지 보고 판단한다. */
  const midScroll = await dragDown('#chat-log', false);
  ok(midScroll > 0, '대화 목록이 실제로 스크롤된 상태를 만들었다', { midScroll });
  await page.waitForTimeout(400);
  ok(await sheetEl.isVisible(), '대화가 중간일 때 아래로 끌어도 닫히지 않는다(스크롤을 뺏지 않는다)');

  /* 그리고 개발자 지시(2026-08-21) — ✕ 말고 쓸어내려서도 닫혀야 한다 */
  await dragDown('#chat-log', true);
  await page.waitForTimeout(500);
  ok(!(await sheetEl.isVisible()), '대화가 맨 위일 때 아래로 끌면 닫힌다');

  await page.click('#btn-chat-fab');
  await page.waitForSelector('#chat-sheet:not([hidden])');
  await dragDown('.chat-head', false);        // 머리말은 스크롤 영역이 아니다 — 언제나 닫혀야 한다
  await page.waitForTimeout(500);
  ok(!(await sheetEl.isVisible()), '머리말을 아래로 끌면 대화 위치와 무관하게 닫힌다');
  await page.click('#btn-chat-fab');
  await page.waitForSelector('#chat-sheet:not([hidden])');

  console.log('\n[5-1] 🔴 마스코트 — 짧게 누르면 열리고, 꾹 눌러야 옮겨진다');
  await page.evaluate(() => { const s = document.querySelector('#chat-sheet'); if (s && !s.hidden) chatClose(); });
  await page.waitForTimeout(350);
  ok(await page.locator('#btn-chat-fab .mascot').count() > 0, '떠 있는 버튼이 마스코트로 바뀌었다');
  /* 마스코트 이름은 개발자가 정한 것이라 코드가 마음대로 바꾸면 안 된다 */
  const mascotName = (await page.textContent('#chat-title, .chat-title')) || '';
  ok(mascotName.trim() === '대장님', "마스코트 이름이 '대장님'이다", mascotName.trim());
  /* 인사말 문구는 개발자가 직접 고른 것이라 코드가 바꾸면 안 된다 (2026-08-17) */
  const greet = await page.textContent('#chat-log .chat-row.bot');
  ok(greet.includes('저는 대장님이에요'), '인사말에서 이름을 말한다(개발자 지정 문구)', greet.slice(0, 40));

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

  /* ============================================================
     [6-1] 🔴 AI를 켰을 때 — 지어낸 답이 화면에 못 올라오는가
     진짜 API 없이 **가짜 AI 서버**를 세워, 일부러 지어낸 응답을 돌려주고
     앱의 검사(chatVerifyAI)가 그걸 막는지 본다. 이게 이 앱의 정직 원칙을
     AI를 켠 뒤에도 지키는 마지막 관문이다.
     ============================================================ */
  console.log('\n[6-1] 🔴 AI 켠 상태 — 지어낸 답 차단 (가짜 서버)');
  const FAKE = 'https://fake-chat-test.workers.dev/ask';
  let sent = null;
  let reply = { picks: [], needSource: true };
  await page.route('https://fake-chat-test.workers.dev/**', async (route) => {
    try { sent = JSON.parse(route.request().postData() || '{}'); } catch (e) { sent = null; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reply) });
  });
  await page.evaluate((url) => { CHAT_CONFIG.endpoint = url; }, FAKE);
  await page.evaluate(() => { if (document.querySelector('#chat-sheet').hidden) chatOpen(); });
  await page.waitForSelector('#chat-sheet:not([hidden])');
  ok(await page.evaluate(() => chatAiConfigured()), '가짜 서버로 AI를 켰다');

  /* ⓐ 서버가 '근거 없다'고 하면 안내봇 답으로 되돌아간다 */
  const a1 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(/못 알아들었|찾지 못|이 중 하나인가요/.test(a1), 'needSource면 AI 답을 버리고 안내봇 답을 낸다', a1.slice(0, 60));

  /* 🔴 프로필이 서버로 새지 않는가.
     ⚠️ **본문을 문자열로 훑으면 안 된다** (2026-08-24 교정). 예전 검사는
     `body.includes('한국외국어대학교')`로 판정해서, **장학금 이름·주관기관에 들어 있는 학교명**을
     학생의 학교로 잘못 셌다(`유흥수 장학금 (한국외대 융합일본지역학부)`, provider `한국외국어대학교`).
     그건 공고의 공개 정보라 당연히 나가야 하는 값이고, 그걸 누수로 세면 **영영 빨간불**이 된다.
     늘 실패하는 검사는 나중에 진짜 실패를 가린다.
     그래서 '무엇이 들어 있나'가 아니라 **'어떤 칸이 나가나'**를 본다 — 나가도 되는 칸을 못박고
     그 밖의 칸이 하나라도 붙으면 실패한다. 프로필 칸이 새로 붙는 순간 여기서 잡힌다. */
  ok(sent !== null, 'AI가 실제로 불렸다(요청이 나갔다)');
  const ALLOWED_TOP = ['q', 'items'];
  const ALLOWED_ITEM = ['id', 'name', 'provider', 'amount', 'period', 'summary',
                        'deadline', 'sourceUrl', 'quotes'];
  const topExtra = Object.keys(sent || {}).filter((k) => !ALLOWED_TOP.includes(k));
  const itemExtra = [...new Set((sent && sent.items || [])
    .flatMap((it) => Object.keys(it)).filter((k) => !ALLOWED_ITEM.includes(k)))];
  ok(topExtra.length === 0, '🔴 요청에 정해진 칸(질문·공고) 말고는 아무것도 없다', topExtra);
  ok(itemExtra.length === 0, '🔴 공고 칸에 공개 정보 말고는 아무것도 없다', itemExtra);
  /* 프로필 값 자체가 어딘가에 실려 나가지 않는지도 본다 — 칸 이름을 바꿔 숨겨도 잡힌다.
     학교명은 공고의 공개 정보라 여기서 뺀다(위 주석). */
  const body = JSON.stringify(sent || {});
  const leaked = ['이선주', '3.8', 'gpa', 'bracket', 'flags', 'account', 'resident']
    .filter((k) => body.includes(k));
  ok(leaked.length === 0, '🔴 이름·성적·소득·계좌가 서버로 나가지 않는다', leaked);
  ok(Array.isArray(sent && sent.items) && sent.items.every((i) => i.id && Array.isArray(i.quotes)),
    '보내는 것은 공고 공개 정보와 인용 문장뿐이다');

  /* ⓑ 앱에 없는 공고를 지어내면 통째로 막는다 */
  reply = { picks: [{ id: 'reg-존재하지-않는-공고', quotes: [0] }], lead: '찾았어요!', needSource: false };
  const a2 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(!/찾았어요!/.test(a2), '앱에 없는 공고를 고르면 AI 답을 버린다', a2.slice(0, 60));

  /* ⓒ 진짜 공고를 골랐지만 **없는 금액을 지어낸** 경우 — 그 줄만 버린다
     🔴 인용을 검사하려면 **원문이 실제로 있는 후보**를 골라야 한다. items[0]을 그냥 쓰면
     원문 없는 공고가 걸려 인용이 0개로 나오고, 그걸 '앱이 막았다'로 오해하게 된다
     (2026-08-21에 실제로 이 항목이 오래 빨간불이었던 원인). 후보에 원문 있는 것이 하나도
     없으면 그건 앱 쪽 문제이므로 **여기서 실패로 잡는다.** */
  const quoted = sent.items.find((i) => i.quotes.length);
  ok(!!quoted, '원문 인용이 있는 후보를 AI에게 보낸다', { 후보: sent.items.length, 원문있음: sent.items.filter((i) => i.quotes.length).length });
  ok(sent.items[0].quotes.length > 0, '원문 있는 후보가 목록 앞쪽에 온다(AI가 고를 것이 있다)');
  const realId = (quoted || sent.items[0]).id;
  reply = { picks: [{ id: realId, quotes: [0] }], lead: '최대 987654원을 받을 수 있어요', needSource: false };
  const a3 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(!/987654/.test(a3), '🔴 앱이 모르는 금액이 들어간 문장은 화면에 안 나간다', a3.slice(0, 80));
  ok(/원문/.test(a3), '대신 원문 인용으로 답한다', a3.slice(0, 80));

  /* ⓓ 인용 번호를 범위 밖으로 지어내도 그 인용만 사라진다 */
  reply = { picks: [{ id: realId, quotes: [99] }], lead: '', needSource: false };
  const a4 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(a4.length > 5, '인용 번호가 엉뚱해도 답은 나온다(근거 카드는 진짜)');

  /* ⓔ 정상 응답 — AI 표시와 원문 인용이 함께 나온다 */
  reply = { picks: [{ id: realId, quotes: [0] }], lead: '이 공고가 가장 가까워요', needSource: false };
  const a5 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(/이 공고가 가장 가까워요/.test(a5), '숫자가 없는 요약은 그대로 쓴다');
  ok(await page.locator('#chat-log .chat-ai-tag').count() > 0, 'AI가 만든 답이라고 표시한다');
  ok(await page.locator('#chat-log .chat-quote').count() > 0, '원문 인용 블록이 함께 나온다');

  /* 서버가 통째로 죽어도 앱은 멀쩡해야 한다 */
  await page.route('https://fake-chat-test.workers.dev/**', (route) => route.abort());
  const a6 = await ask(page, '쿼카 사육 지원금 있어?');
  ok(a6.length > 5, 'AI 서버가 죽어도 안내봇 답이 나간다', a6.slice(0, 50));
  await page.evaluate(() => { CHAT_CONFIG.endpoint = ''; });   // 다시 꺼 둔다

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
