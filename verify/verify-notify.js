/* 앱 알림 시스템 브라우저 검증 (Playwright)
   확인 항목
   ① 최초 1회 알림 동의 시트가 온보딩 직후 뜬다 · '나중에'를 누르면 다시 자동으로 뜨지 않는다
   ② '알림 받기'를 누르면 실제 브라우저 권한을 요청하고 휴대폰 알림이 나간다
   ③ 조건 1 — 내 조건에 맞는 새 공고가 등록되면 알림
   ④ 조건 2 — 마감 하루 전 알림
   ⑤ 알림함(앱 내) · 배지 · 읽음 처리 · 알림 눌러 공고 상세로 이동
   ⑥ 항목별 켜기/끄기가 저장되고 실제로 발송을 막는다
   ⑦ 알림 클릭으로 앱이 열렸을 때(?sch=) 해당 공고가 열린다
   실행: python3 -m http.server 8123 & 후 node verify/verify-notify.js */
const { chromium } = require('playwright-core');
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* 우리 코드의 잘못이 아닌 콘솔 메시지는 빼고 센다.
   · Failed to load resource — 드라이버가 일부러 없는 파일을 부르는 경우
   · Push API in incognito — 검사용 브라우저가 시크릿 모드라 크롬이 남기는 안내다.
     크롬 문서가 "웹사이트가 알아챌 수 없게 하려고 일부러 감지 수단을 주지 않는다"고
     밝히고 있어 앱이 피할 방법이 없다(2026-08-07 확인 — 이 줄이 없으면 이 검사는 영영 빨간불).
     진짜 푸시 동작은 verify-push-client.js가 가짜 푸시 서비스로 따로 검증한다. */
const IGNORE_CONSOLE = /Failed to load resource|does not support the Push API in incognito/;

const BASE = 'http://localhost:8123';
const SHOT = (n) => `${__dirname}/shot-nf-${n}.png`;

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* 휴대폰 알림이 실제로 호출됐는지 잡아내는 스파이 (헤드리스에선 알림 UI가 안 보이므로) */
const SPY = () => {
  window.__notifs = [];
  const rec = (title, opts) => window.__notifs.push({ title, body: (opts || {}).body, tag: (opts || {}).tag, data: (opts || {}).data });
  if (window.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype.showNotification) {
    const orig = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, opts) {
      rec(title, opts);
      try { return orig.call(this, title, opts); } catch (e) { return Promise.resolve(); }
    };
  }
  if (window.Notification) {
    const Orig = window.Notification;
    const Patched = function (title, opts) { rec(title, opts); try { return new Orig(title, opts); } catch (e) { return {}; } };
    Patched.requestPermission = Orig.requestPermission.bind(Orig);
    Object.defineProperty(Patched, 'permission', { get: () => Orig.permission });
    window.Notification = Patched;
  }
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
  await page.click('.onboard-step[data-step="3"] [data-next]');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  /* ============ A. 알림 권한을 주지 않은 사용자 ============ */
  console.log('\n[A] 알림을 허용하지 않은 사용자 — 앱이 정상 동작하고 알림함으로 대체된다');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.clearPermissions();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
    await page.addInitScript(SPY);

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await onboard(page);

    // ① 최초 1회 동의 시트
    await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 });
    const consentTitle = await page.textContent('#notify-sheet .sheet-title');
    ok(/알림을 받으시겠어요/.test(consentTitle), '온보딩 직후 알림 동의 시트가 뜸', consentTitle);
    const typeCount = await page.$$eval('#notify-sheet .nf-type-list li', (els) => els.length);
    ok(typeCount === 5, '알림 종류 5가지를 미리 안내', typeCount);
    const honesty = await page.textContent('#notify-sheet .sheet-note');
    // 발송 서버가 붙기 전/후로 문구가 달라진다 — 어느 쪽이든 '전달 시점'을 정직하게 밝혀야 한다
    ok(/발송 서버가 없어요|앱을 켜지 않아도/.test(honesty), '전달 방식을 정직하게 안내', honesty.slice(0, 40));
    await page.screenshot({ path: SHOT('01-consent') });

    await page.click('#btn-nf-later');
    await page.waitForSelector('#notify-sheet', { state: 'hidden', timeout: 3000 });
    ok(true, "'나중에'를 누르면 시트가 닫힘");

    // 최초 1회 — 새로고침해도 다시 뜨지 않아야 한다
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3200);
    ok(await page.isHidden('#notify-sheet'), '새로고침해도 동의 시트가 다시 뜨지 않음 (최초 1회)');

    // MY 화면 설정
    await page.click('.nav-item[data-nav="my"]');
    await page.waitForSelector('#my-notify:not([hidden])');
    const status = await page.textContent('#my-notify .nf-status');
    ok(/켜지 않았어요|차단|지원하지/.test(status), 'MY에 알림 상태가 정직하게 표시됨', status);
    ok((await page.textContent('#btn-nf-toggle')).trim() === '켜기', 'MY에서 언제든 켤 수 있는 버튼 제공');
    await page.screenshot({ path: SHOT('02-my-settings') });

    // 알림을 안 켰어도 앱 내 알림함에는 쌓인다
    await page.evaluate(async () => { notifyLedger.inbox = []; await notifySaveLedger(); notifyRenderBadge(); window.__notifs = []; });
    await page.click('#btn-nf-test');
    await page.waitForTimeout(400);
    const osCount = await page.evaluate(() => window.__notifs.length);
    ok(osCount === 0, '권한 없으면 휴대폰 알림은 나가지 않음', osCount);
    const badge = await page.textContent('#notify-badge');
    ok(badge === '1', '휴대폰 알림 대신 앱 안 알림함에 1건 쌓임', badge);

    ok(errors.length === 0, '콘솔 오류 없음', errors);
    await ctx.close();
  }

  /* ============ B. 알림을 허용한 사용자 — 실제 발송 경로 ============ */
  console.log('\n[B] 알림을 허용한 사용자 — 조건별 발송 · 알림함 · 설정');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.grantPermissions(['notifications'], { origin: BASE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });
  await page.addInitScript(SPY);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await onboard(page);
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 });
  await page.click('#btn-nf-allow');
  await page.waitForSelector('#notify-sheet', { state: 'hidden', timeout: 3000 });

  const enabled = await page.evaluate(() => ({ enabled: notifyLedger.enabled, perm: Notification.permission, asked: !!notifyLedger.askedAt }));
  ok(enabled.enabled === true && enabled.perm === 'granted', "'알림 받기'로 권한 획득 · 앱 스위치 ON", enabled);
  ok(enabled.asked, '동의 여부를 기록해 다시 묻지 않음');

  // 서비스워커 등록 확인 (백그라운드 알림 경로)
  const swOk = await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r).catch(() => false));
  ok(swOk, '서비스워커 등록됨 (알림 클릭·백그라운드 확인 경로)');

  // 기존 공고로 이미 쌓인 알림은 비우고 시작
  await page.evaluate(async () => {
    notifyLedger.inbox = [];
    await notifySaveLedger();
    notifyRenderBadge();
    window.__notifs = [];
  });

  // ③ 조건 1 — 새 공고 + ④ 조건 2 — 마감 하루 전
  console.log('\n  [조건 1·2] 새 공고 등록 / 마감 하루 전');
  const injected = await page.evaluate(async () => {
    const iso = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    // 수집 로봇이 새 공고를 올린 상황 재현 (내 학교·내 조건에 맞는 공고)
    registeredList.push({
      id: 'test-new-fit', name: '테스트 신규 장학금', type: '교내', provider: '검증용',
      amount: '200만원', amountValue: 2000000, period: '상시', summary: '검증용 공고',
      documents: ['재학증명서'], note: '검증용', deadline: iso(9),
      eligibility: { schoolOnly: '한국외국어대학교' },
    });
    // 내일 마감인 공고 — 며칠 전에 등록돼 앱이 이미 알고 있던 공고가 D-1에 도달한 상황
    registeredList.push({
      id: 'test-deadline-1', name: '테스트 내일마감 장학금', type: '교내', provider: '검증용',
      amount: '100만원', amountValue: 1000000, period: '상시', summary: '검증용 공고',
      documents: ['재학증명서'], note: '검증용', deadline: iso(1),
      eligibility: { schoolOnly: '한국외국어대학교' },
    });
    notifyLedger.seenSch.push('test-deadline-1');
    // 자격이 안 되는 공고는 알림이 가면 안 된다
    registeredList.push({
      id: 'test-not-fit', name: '테스트 요건미달 장학금', type: '교내', provider: '검증용',
      amount: '100만원', amountValue: 1000000, period: '상시', summary: '검증용 공고',
      documents: ['재학증명서'], note: '검증용', deadline: iso(5),
      eligibility: { schoolOnly: '한국외국어대학교', minGpa: 4.45 },
    });
    const n = await notifyCheck({ quiet: true });
    return { delivered: n, os: window.__notifs, inbox: notifyLedger.inbox.map((i) => ({ type: i.type, title: i.title })) };
  });

  const types = injected.inbox.map((i) => i.type);
  ok(types.includes('newMatch'), '조건 1 — 새 공고 알림 발생', injected.inbox.map((i) => i.title));
  ok(types.includes('deadline'), '조건 2 — 마감 하루 전 알림 발생', injected.inbox.map((i) => i.title));
  ok(injected.inbox.some((i) => /내일 마감/.test(i.title) && /내일마감/.test(i.title)), '마감 알림 제목에 공고 이름과 "내일 마감" 표기');
  ok(!injected.inbox.some((i) => /요건미달/.test(i.title)), '자격 미달 공고는 알리지 않음', injected.inbox.map((i) => i.title));
  ok(injected.os.length > 0, `휴대폰 알림이 실제로 호출됨 (${injected.os.length}건)`, injected.os.map((o) => o.title));
  ok(injected.os.every((o) => o.data && o.data.url), '알림에 열 화면 주소가 담김', injected.os[0]);
  ok(injected.inbox.filter((i) => /내일마감 장학금/.test(i.title)).length === 1,
    '같은 공고로 알림이 두 번 가지 않음 (새 공고 알림에 마감일이 이미 담겨 있으면 마감 알림 생략)',
    injected.inbox.filter((i) => /내일마감 장학금/.test(i.title)).map((i) => i.title));

  // ⑤ 배지 · 알림함
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForTimeout(300);
  const badgeText = await page.textContent('#notify-badge');
  ok(Number(badgeText) >= 2, `홈 종 아이콘 배지에 읽지 않음 ${badgeText}건 표시`, badgeText);
  await page.screenshot({ path: SHOT('03-home-badge') });

  await page.click('#btn-notify');
  await page.waitForSelector('#notify-sheet:not([hidden])');
  const inboxRows = await page.$$eval('.nf-item', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(inboxRows.length >= 2, `알림함에 ${inboxRows.length}건 표시`, inboxRows.slice(0, 2));
  ok(await page.$('.nf-item.nf-unread') !== null, '읽지 않은 알림이 강조 표시됨');
  const dupIcon = await page.$$eval('.nf-item', (els) => els.some((e) => {
    const ico = e.querySelector('.nf-ico').textContent.trim();
    return e.querySelector('.nf-title').textContent.trim().startsWith(ico);
  }));
  ok(!dupIcon, '알림함 제목에 종류 아이콘이 중복으로 찍히지 않음');
  await page.screenshot({ path: SHOT('04-inbox') });

  // 알림 누르면 해당 공고 상세로
  const targetIdx = await page.$$eval('.nf-item', (els) => els.findIndex((e) => /내일마감/.test(e.textContent)));
  await page.$$eval('.nf-item', (els, i) => els[i].click(), targetIdx);
  await page.waitForSelector('#detail-sheet:not([hidden])', { timeout: 4000 });
  const detailTitle = await page.textContent('#detail-sheet .sheet-title');
  ok(/내일마감/.test(detailTitle), '알림을 누르면 그 공고 상세가 열림', detailTitle);
  await page.screenshot({ path: SHOT('05-detail-from-notif') });
  await page.click('#detail-sheet .sheet-handle');
  await page.waitForTimeout(400);

  // 모두 읽음
  await page.click('#btn-notify');
  await page.waitForSelector('#notify-sheet:not([hidden])');
  await page.click('#btn-nf-readall');
  await page.waitForTimeout(400);
  ok(await page.isHidden('#notify-badge'), "'모두 읽음' 후 배지가 사라짐");
  await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet', { state: 'hidden', timeout: 3000 });
  ok(true, 'Esc로 알림함 닫힘');

  // ⑥ 항목별 설정 저장 · 실제 차단
  console.log('\n  [설정] 항목별 켜기/끄기');
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#my-notify:not([hidden])');
  const prefCount = await page.$$eval('.nf-switch', (els) => els.length);
  ok(prefCount === 5, '알림 종류 5가지를 개별로 켜고 끌 수 있음', prefCount);
  const onText = await page.textContent('.nf-status');
  ok(/켜짐/.test(onText), 'MY 상태가 "켜짐"으로 바뀜', onText);
  await page.screenshot({ path: SHOT('06-my-on') });

  await page.uncheck('[data-nf-pref="deadline"]');
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#my-notify:not([hidden])');
  const persisted = await page.isChecked('[data-nf-pref="deadline"]');
  ok(persisted === false, '끈 설정이 새로고침 후에도 유지됨');

  const blocked = await page.evaluate(async () => {
    const iso = (n) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    registeredList.push({
      id: 'test-deadline-2', name: '테스트 내일마감2', type: '교내', provider: '검증용',
      amount: '100만원', amountValue: 1000000, period: '상시', summary: '검증용',
      documents: ['재학증명서'], note: '검증용', deadline: iso(1),
      eligibility: { schoolOnly: '한국외국어대학교' },
    });
    await notifyCheck({ quiet: true });
    return notifyLedger.inbox.filter((i) => i.type === 'deadline' && /내일마감2/.test(i.title)).length;
  });
  ok(blocked === 0, '마감 알림을 끄면 실제로 발송되지 않음', blocked);

  // ⑦ 알림 클릭으로 앱이 열리는 경로 (?sch=)
  console.log('\n  [딥링크] 알림 클릭 → 해당 공고 열기');
  await page.goto(BASE + '/?sch=test-deadline-1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const deep = await page.evaluate(() => location.search);
  ok(deep === '', '주소창이 원래대로 정리됨 (새로고침 때 재실행 방지)', deep);
  // 주입한 테스트 공고는 새로고침하면 사라지므로 실제 등록 공고로 확인
  const realId = await page.evaluate(() => {
    const mine = allScholarships().filter((s) => !s.program);
    return mine.length ? mine[0].id : '';
  });
  ok(!!realId, '내 프로필에 매칭된 실제 등록 공고가 있음', realId);
  await page.goto(BASE + '/?sch=' + encodeURIComponent(realId), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#detail-sheet:not([hidden])', { timeout: 6000 });
  const deepTitle = await page.textContent('#detail-sheet .sheet-title');
  ok(deepTitle.length > 0, '알림 주소로 열면 해당 공고 상세가 뜸', deepTitle);
  await page.screenshot({ path: SHOT('07-deeplink') });

  ok(errors.length === 0, '콘솔 오류 없음', errors);
  await ctx.close();
  await browser.close();

  console.log(fail ? `\n❌ 실패 ${fail}건\n` : '\n✅ 알림 시스템 브라우저 검증 전부 통과\n');
  process.exit(fail ? 1 : 0);
})();
