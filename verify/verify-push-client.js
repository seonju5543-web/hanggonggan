/* 진짜 푸시 — 앱(받는 쪽) 브라우저 검증
   ① 발송 서버 미설정이면 앱이 예전 그대로 동작하고 '준비 중'으로 정직하게 안내
   ② 설정되면 '앱을 켜지 않아도 받기' 스위치가 나오고, 켜면 서버에 등록된다
   ③ 서버로 나가는 것은 폰 주소·학교뿐 (이름·성적·소득이 새지 않는지 실제 요청 본문을 검사)
   ④ 끄면 서버에서 해지된다 · 학교를 바꾸면 등록이 따라간다
   ⑤ 알림 동의 한 번으로 진짜 푸시까지 함께 켜진다
   실행: python3 -m http.server 8123 & 후 node verify/verify-push-client.js */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..');
const BASE = 'http://localhost:8126';
const PUSH_PORT = 8127;

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* 가짜 발송 서버 — 앱이 무엇을 보내는지 그대로 받아 본다 */
const received = [];
function startPushServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
      };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { /* 무시 */ }
        received.push({ path: req.url, body: parsed, raw: body });
        res.writeHead(200, Object.assign({ 'content-type': 'application/json' }, cors));
        res.end('{"ok":true}');
      });
    });
    srv.listen(PUSH_PORT, () => resolve(srv));
  });
}

/* 앱 복사본을 만들어 push-config.js만 채운다 (원본 저장소는 건드리지 않는다)

   ⚠️ 두 칸을 **항상 덮어쓴다** — 저장소에 무엇이 적혀 있든 상관없이.
   예전에는 빈 칸(`endpoint: ''`)을 찾아 바꿨는데, 2026-08-06에 진짜 발송 서버 주소가
   채워지자 그 문구가 사라져 ⓐ '설정됨' 검사는 가짜 서버 대신 **진짜 workers.dev로**
   등록을 보내 아무것도 못 받았고 ⓑ '미설정' 검사는 채워진 주소 때문에 설정된 상태로
   돌아, 멀쩡한 앱을 두고 검사만 실패했다. 검사 도구가 저장소의 현재 값에 흔들리면 안 된다. */
const setCfg = (src, key, val) =>
  src.replace(new RegExp(`(\\b${key}:\\s*)'[^']*'`), `$1'${val}'`);

function makeAppCopy(configured) {
  const dir = fs.mkdtempSync('/tmp/handaejang-push-');
  for (const f of fs.readdirSync(ROOT)) {
    if (['.git', 'node_modules', 'verify', 'proposals', 'collector'].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  const cfgPath = path.join(dir, 'push-config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = setCfg(cfg, 'endpoint', configured ? `http://localhost:${PUSH_PORT}` : '');
  cfg = setCfg(cfg, 'publicKey', configured
    ? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
    : '');
  fs.writeFileSync(cfgPath, cfg);

  /* 바꿔 넣은 값이 실제로 들어갔는지 확인한다 — 이 검사가 없어서 위 사고를 못 잡았다 */
  const want = configured ? `http://localhost:${PUSH_PORT}` : '';
  if (!new RegExp(`endpoint:\\s*'${want}'`).test(cfg)) {
    throw new Error(`push-config.js의 endpoint를 '${want}'로 바꾸지 못했습니다 — 파일 모양이 바뀐 것 같습니다`);
  }

  if (configured) {
    // 로컬 시험 서버는 .workers.dev가 아니므로 CSP에 시험 주소를 허용해 준다(실서비스는 CSP 그대로)
    let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    html = html.replace('https://*.workers.dev', `https://*.workers.dev http://localhost:${PUSH_PORT}`);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
  return dir;
}

function serve(dir, port) {
  return new Promise((resolve) => {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(dir, p);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(port, () => resolve(srv));
  });
}

/* 헤드리스 크로미움에는 진짜 푸시 서비스가 없으므로 PushManager를 흉내 낸다.
   (앱이 구독을 요청하고 서버에 등록하는 경로가 정확한지를 본다) */
const PUSH_STUB = () => {
  const FAKE_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/TEST-ENDPOINT-1';
  let current = null;
  const fakeSub = {
    endpoint: FAKE_ENDPOINT,
    unsubscribe: async () => { current = null; window.__pushUnsubscribed = true; return true; },
    toJSON() { return { endpoint: FAKE_ENDPOINT }; },
  };
  window.__pushUnsubscribed = false;
  window.__subscribeCalls = [];
  // 어느 경로로 registration을 얻든(swReg / serviceWorker.ready) 같은 가짜가 붙도록 프로토타입에 심는다
  Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', {
    configurable: true,
    get: () => ({
      getSubscription: async () => current,
      subscribe: async (opts) => {
        window.__subscribeCalls.push({
          userVisibleOnly: opts && opts.userVisibleOnly,
          keyLength: opts && opts.applicationServerKey ? opts.applicationServerKey.length : 0,
        });
        current = fakeSub;
        return fakeSub;
      },
    }),
  });
};

async function onboard(page, school = '외대') {
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', school);
  await page.waitForSelector('.ac-list:not([hidden]) .ac-item');
  await page.click('.ac-list:not([hidden]) .ac-item');
  const campus = await page.$('#campus-field:not([hidden])');
  if (campus) await page.click('#in-campus .chip:nth-child(1)');
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
  const pushSrv = await startPushServer();
  const browser = await chromium.launch({ executablePath: EXE });

  /* ============ A. 발송 서버 미설정 (지금 배포된 상태) ============ */
  console.log('\n[A] 발송 서버가 없을 때 — 앱은 예전 그대로 동작해야 한다');
  {
    const dir = makeAppCopy(false);
    const srv = await serve(dir, 8126);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await ctx.grantPermissions(['notifications'], { origin: BASE });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
    await page.addInitScript(PUSH_STUB);

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await onboard(page);
    await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 8000 });
    const note = await page.textContent('#notify-sheet .sheet-note');
    ok(/발송 서버가 없어요/.test(note), '동의 시트가 "아직 서버 없음"으로 정직하게 안내', note.slice(0, 30));
    await page.click('#btn-nf-allow');
    await page.waitForSelector('#notify-sheet', { state: 'hidden', timeout: 4000 });

    await page.click('.nav-item[data-nav="my"]');
    await page.waitForSelector('#my-notify:not([hidden])');
    const pushTitle = await page.textContent('.nf-push-title');
    ok(/준비 중/.test(pushTitle), 'MY에 "앱을 켜지 않아도 받기 — 준비 중"으로 표시', pushTitle);
    ok(await page.$('#btn-nf-push') === null, '설정 전에는 켜기 버튼이 없음 (헛된 기대를 주지 않음)');
    ok(received.length === 0, '서버로 아무것도 보내지 않음', received);
    ok(errors.length === 0, '콘솔 오류 없음', errors);
    await page.screenshot({ path: `${__dirname}/shot-push-01-unconfigured.png` });
    await ctx.close();
    srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ============ B. 발송 서버 설정됨 ============ */
  console.log('\n[B] 발송 서버가 연결됐을 때 — 앱을 켜지 않아도 받기');
  const dir = makeAppCopy(true);
  const srv = await serve(dir, 8126);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.grantPermissions(['notifications'], { origin: BASE });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript(PUSH_STUB);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await onboard(page);
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 8000 });
  const note2 = await page.textContent('#notify-sheet .sheet-note');
  ok(/앱을 켜지 않아도/.test(note2), '동의 시트가 "앱을 켜지 않아도 도착"으로 안내', note2.slice(0, 30));
  await page.screenshot({ path: `${__dirname}/shot-push-02-consent.png` });

  /* ⑤ 동의 한 번으로 진짜 푸시까지 켜진다 */
  received.length = 0;
  await page.click('#btn-nf-allow');
  await page.waitForSelector('#notify-sheet', { state: 'hidden', timeout: 4000 });
  await page.waitForTimeout(900);

  ok(received.some((r) => r.path === '/subscribe'), '동의 한 번으로 발송 서버에 자동 등록됨', received.map((r) => r.path));
  const subCall = received.find((r) => r.path === '/subscribe');
  ok(subCall && subCall.body.endpoint === 'https://fcm.googleapis.com/fcm/send/TEST-ENDPOINT-1', '폰 주소가 전달됨', subCall && subCall.body.endpoint);
  ok(subCall && subCall.body.school === '한국외국어대학교', '학교가 전달됨', subCall && subCall.body.school);

  /* ③ 개인정보가 새지 않는지 — 실제 요청 본문 전수 검사 */
  const keys = Object.keys(subCall.body).sort();
  ok(JSON.stringify(keys) === JSON.stringify(['campus', 'endpoint', 'school']),
    '서버로 나가는 항목은 endpoint·school·campus 3개뿐', keys);
  ok(!/이선주|3\.8|gpa|bracket|202312345|010-/.test(subCall.raw),
    '이름·성적·소득구간·학번·연락처가 요청 본문에 없음', subCall.raw.slice(0, 120));

  const subOpts = await page.evaluate(() => window.__subscribeCalls);
  ok(subOpts.length === 1 && subOpts[0].userVisibleOnly === true,
    'userVisibleOnly로 구독 (받은 푸시는 반드시 눈에 보이게)', subOpts);
  ok(subOpts[0].keyLength === 65, 'VAPID 공개키가 규격 길이(65바이트)로 전달됨', subOpts[0].keyLength);

  /* ② MY 화면 표시 */
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#my-notify:not([hidden])');
  const onTitle = await page.textContent('.nf-push-title');
  ok(/받는 중/.test(onTitle), 'MY에 "앱을 켜지 않아도 받는 중"으로 표시', onTitle);
  ok(await page.$('.nf-push.nf-push-on') !== null, '켜진 상태가 눈에 띄게 표시됨');
  const privacyNote = await page.textContent('.nf-push');
  ok(/폰 주소와 학교/.test(privacyNote), '무엇이 서버로 가는지 화면에 밝힘');
  await page.screenshot({ path: `${__dirname}/shot-push-03-on.png` });

  /* ④ 별도 스위치는 없앴다 (2026-08-06 개발자 지시) — 알림을 켜면 곧 기본값 */
  ok(await page.$('#btn-nf-push') === null,
    "'앱을 켜지 않아도 받기' 스위치가 사라짐 — 알림을 켜면 자동으로 켜진다");

  /* ⑤ 회귀 — 이미 알림을 켜 둔 사람도 앱을 다시 열면 자동으로 등록된다.
     예전에는 등록이 '최초 1회 동의 시트'에서만 일어나, 그 시트를 이미 지나친 사용자는
     영영 등록되지 않았다. 실제로 이것 때문에 등록된 폰이 0대였다(2026-08-06).
     이 검사를 지우면 그 상태로 되돌아간다. */
  received.length = 0;
  await page.evaluate(async () => { notifyLedger.pushEndpoint = null; await notifySaveLedger(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  ok(received.some((r) => r.path === '/subscribe'),
    '등록이 비어 있으면 앱을 열 때 자동으로 등록됨 (pushEnsure)', received.map((r) => r.path));

  /* ⑤-2 회귀 — **메모는 남아 있는데 브라우저 구독이 사라진 폰**도 되살아난다 (2026-08-07)
     구독은 앱이 모르는 사이에 사라진다(iPhone이 안 쓰는 앱을 정리 · 저장 공간 삭제 · 주소 변경).
     예전 pushEnsure는 장부의 메모만 보고 "이미 등록됨"으로 통과시켜서, 그런 폰은 앱을 아무리
     열어도 영영 다시 등록되지 않았다 — 공동개발자 폰이 실제로 이 상태였다(앱을 켤 때만 알림).
     아래는 하루 재동기화 경로와 헷갈리지 않게 pushSyncedAt을 방금으로 두고 검사한다.
     이 검사를 지우면 '죽은 메모를 믿는' 상태로 되돌아간다. */
  received.length = 0;
  await page.evaluate(async () => {
    notifyLedger.pushEndpoint = 'https://fcm.googleapis.com/fcm/send/DEAD-ENDPOINT';
    notifyLedger.pushSyncedAt = Date.now();
    await notifySaveLedger();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  ok(received.some((r) => r.path === '/subscribe'),
    '브라우저 구독이 사라지면 다시 등록한다 (죽은 메모를 믿지 않음)', received.map((r) => r.path));
  const healed = await page.evaluate(() => notifyLedger.pushEndpoint);
  ok(healed && !/DEAD-ENDPOINT/.test(healed),
    '죽은 주소가 살아 있는 주소로 교체된다', healed);
  /* ⑤-3 회귀 — 갈아탈 때 **옛 주소를 서버에서도 지운다** (2026-08-07)
     안 지우면 서버 KV에 죽은 등록이 산 것처럼 쌓인다. 실제로 KV에 2개가 보이는데 받는
     폰은 1대뿐인 상태가 이렇게 생겼다. 사용자가 늘면 죽은 등록이 발송 예산(실행당
     바깥 요청 50건)을 갉아먹으므로 갈아타는 즉시 치워야 한다. */
  const unsubs = received.filter((r) => r.path === '/unsubscribe').map((r) => r.body && r.body.endpoint);
  ok(unsubs.some((e) => /DEAD-ENDPOINT/.test(e)),
    '갈아탄 옛 주소를 서버에서 지운다 (죽은 등록이 쌓이지 않음)', unsubs);

  // 새로고침으로 홈으로 돌아왔으므로 아래 검사를 위해 MY 화면으로 다시 들어간다
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#my-notify:not([hidden])');

  /* ④ 학교를 바꾸면 서버 등록도 따라간다 */
  received.length = 0;
  await page.evaluate(async () => {
    state.profile.school = '성균관대학교';
    saveState();
    await pushSyncSchool();
  });
  await page.waitForTimeout(600);
  const resub = received.find((r) => r.path === '/subscribe');
  ok(resub && resub.body.school === '성균관대학교', '학교를 바꾸면 서버 등록도 갱신됨', resub && resub.body.school);

  /* 알림 전체를 끄면 푸시도 함께 해지 */
  received.length = 0;
  await page.click('#btn-nf-toggle');
  await page.waitForTimeout(900);
  ok(received.some((r) => r.path === '/unsubscribe'), '알림을 통째로 끄면 푸시도 자동 해지', received.map((r) => r.path));

  ok(errors.length === 0, '콘솔 오류 없음', errors);
  await ctx.close();
  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  await browser.close();
  pushSrv.close();

  console.log(fail ? `\n❌ 실패 ${fail}건\n` : '\n✅ 진짜 푸시 · 앱(받는 쪽) 검증 전부 통과\n');
  process.exit(fail ? 1 : 0);
})();
