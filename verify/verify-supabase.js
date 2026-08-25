/* 회원가입·로그인 — 앱(브라우저) 검증  (2026-08-25)
   ─────────────────────────────────────────────────────────────────────────
   이 검사의 존재 이유는 **terms.html 에 적은 문장을 증명하는 것**이다:
     "주민등록번호·계좌번호·증명서류는 서버로 보내지 않습니다."
   말로만 적으면 언젠가 조용히 거짓이 된다. 그래서 가짜 Supabase 서버를 세워
   앱이 보내는 **요청 본문을 전부 모아** 실제로 세어 본다.

   보는 것
     [1] 설정이 비어 있으면 로그인 기능이 화면에 아예 안 나온다 (지금 앱 그대로)
     [2] 설정되면 MY 에 계정 카드가 뜨고, 가입 → 프로필이 서버로 올라간다
     [3] 🔴 주민등록번호·계좌번호가 **단 한 번도** 안 나간다
     [4] 민감정보(특별자격)는 동의했을 때만 나간다
     [5] 새 기기 — 기기를 비우고 로그인하면 프로필이 되살아난다 (개발자가 겪던 문제)
     [6] 서버가 죽어 있어도 앱은 그대로 열린다 (기기 우선)

   실행: CHROME_PATH=... node verify/verify-supabase.js     (돈 0원 · 인터넷 불필요)
   ───────────────────────────────────────────────────────────────────────── */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..');
const APP_PORT = 8130;        // 설정된 앱
const OFF_PORT = 8132;        // 설정이 빈 앱
const SB_PORT = 8131;         // 가짜 Supabase

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* ───────── 가짜 Supabase — 앱이 무엇을 보내는지 그대로 받아 둔다 ───────── */
const received = [];     // { path, method, body, raw }
let storedRow = null;    // 서버에 저장된 프로필 행 (한 사람뿐인 시험이라 하나로 충분)

function startSupabase() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization, apikey, prefer',
      };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (e) { /* JSON이 아닐 수 있다 */ }
        received.push({ path: req.url, method: req.method, body, raw });
        const send = (code, obj) => {
          res.writeHead(code, Object.assign({ 'content-type': 'application/json' }, cors));
          res.end(obj === undefined ? '' : JSON.stringify(obj));
        };
        const token = (email) => ({
          access_token: 'access-test', refresh_token: 'refresh-test', expires_in: 3600,
          user: { id: '00000000-0000-4000-8000-000000000001', email },
        });

        if (req.url.startsWith('/auth/v1/signup')) return send(200, token((body && body.email) || ''));
        if (req.url.startsWith('/auth/v1/token')) return send(200, token((body && body.email) || 'test@example.com'));
        if (req.url.startsWith('/auth/v1/logout')) return send(204);
        if (req.url.startsWith('/rest/v1/profiles')) {
          if (req.method === 'POST') { storedRow = (body && body[0]) || null; return send(201); }
          if (req.method === 'DELETE') { storedRow = null; return send(204); }
          return send(200, storedRow ? [storedRow] : []);
        }
        return send(404, { msg: 'not found' });
      });
    });
    srv.listen(SB_PORT, () => resolve(srv));
  });
}

/* ───────── 앱 복사본 (원본 저장소는 절대 건드리지 않는다) ───────── */
/* ⚠️ 값을 **항상 덮어쓴다** — 저장소에 무엇이 적혀 있든 상관없게. 나중에 진짜 주소가
   채워졌을 때 검사가 진짜 서버로 요청을 보내는 사고를 막는다(푸시 검사에서 겪은 일). */
const setStr = (src, key, val) => src.replace(new RegExp(`(\\b${key}:\\s*)'[^']*'`), `$1'${val}'`);
const setNum = (src, key, val) => src.replace(new RegExp(`(\\b${key}:\\s*)\\d+`), `$1${val}`);

function makeAppCopy(configured) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handaejang-sb-'));
  for (const f of fs.readdirSync(ROOT)) {
    if (['.git', 'node_modules', 'verify', 'proposals', 'collector', 'supabase', '_admin', 'server', 'docs'].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  const cfgPath = path.join(dir, 'supabase-config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = setStr(cfg, 'url', configured ? `http://localhost:${SB_PORT}` : '');
  cfg = setStr(cfg, 'anonKey', configured ? 'anon-test-key' : '');
  cfg = setNum(cfg, 'pushDelayMs', 60);      // 검사에서 2초를 기다릴 이유가 없다
  fs.writeFileSync(cfgPath, cfg);

  const want = configured ? `http://localhost:${SB_PORT}` : '';
  if (!new RegExp(`url:\\s*'${want}'`).test(cfg)) {
    throw new Error(`supabase-config.js의 url을 '${want}'로 바꾸지 못했습니다 — 파일 모양이 바뀐 것 같습니다`);
  }

  if (configured) {
    /* 시험 서버는 *.supabase.co 가 아니므로 CSP에 시험 주소만 더해 준다(실서비스 CSP는 그대로) */
    let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    html = html.replace('https://*.supabase.co', `https://*.supabase.co http://localhost:${SB_PORT}`);
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
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(fs.readFileSync(file));
    });
    srv.listen(port, () => resolve(srv));
  });
}

/* 시험용 프로필 — 🔴 주민등록번호·계좌번호·특별자격을 **일부러** 넣는다.
   이게 안 나가는 것을 증명하는 것이 이 검사의 목적이다. */
const RRN = '990101-1234567';
const ACCOUNT = '110-222-333444';
const SEED = {
  profile: {
    name: '검사용', school: '한국외국어대학교', track: 'humanities', major: '영어통번역학과',
    year: 3, status: 'enrolled', gpa: 3.6, bracket: 5, campus: '서울캠퍼스',
    region: 'seoul', parentRegion: null, nationality: 'korean', credits: 15, birthYear: 2003,
    flags: ['basicLiving', 'disabled'], cert: false, exchange: false,
    common: { studentId: '202312345', phone: '010-1234-5678', rrn: RRN, account: ACCOUNT },
  },
  applications: [],
  consent: { sensitive: false },
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const seedScript = (seed) => `localStorage.setItem('handaejang.v1', ${JSON.stringify(JSON.stringify(seed))})`;

(async () => {
  const sb = await startSupabase();
  const onDir = makeAppCopy(true);
  const offDir = makeAppCopy(false);
  const onSrv = await serve(onDir, APP_PORT);
  const offSrv = await serve(offDir, OFF_PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const errors = [];

  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => {
      const t = m.text();
      if (m.type() === 'error' && !/Failed to load resource|favicon/.test(t)) errors.push('CONSOLE: ' + t);
    });
    return { ctx, page };
  };

  /* 앱을 열면 알림 동의 시트가 떠서 뒤 화면 클릭을 가로막는다.
     검사하려는 것은 로그인이지 알림이 아니므로 먼저 닫는다. */
  const settle = async (page, ms) => {
    await page.waitForTimeout(ms || 900);
    /* 동의 시트는 2.9초 뒤에 **한 번 더** 뜬다(notifyMaybeAskConsent) — 한 번만 닫으면
       그다음 클릭에서 다시 가로막힌다. 그 시점을 지나서까지 몇 번 닫아 준다. */
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        if (typeof notifyMaybeAskConsent === 'function') window.notifyMaybeAskConsent = () => {};
        if (typeof closeNotifyPanel === 'function') closeNotifyPanel();
      }).catch(() => {});
      await page.waitForTimeout(700);
    }
  };

  /* ───────────── [1] 설정이 비면 로그인 기능이 없다 ───────────── */
  console.log('\n[1] 설정이 비어 있으면 앱은 지금 그대로다');
  {
    const { ctx, page } = await newPage();
    await page.goto(`http://localhost:${OFF_PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(seedScript(SEED));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('.nav-item[data-nav="my"]');
    await page.waitForTimeout(300);
    ok(await page.locator('#my-account').isHidden(), '계정 카드가 안 나온다');
    ok(await page.evaluate(() => supabaseConfigured() === false), 'supabaseConfigured()가 false');
    await ctx.close();
  }

  /* ───────────── [2][3][4] 가입하면 무엇이 나가는가 ───────────── */
  console.log('\n[2] 가입하면 프로필이 서버로 올라간다');
  let firstPage = null;
  {
    const { ctx, page } = await newPage();
    firstPage = { ctx, page };
    await page.goto(`http://localhost:${APP_PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(seedScript(SEED));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.click('.nav-item[data-nav="my"]');
    await page.waitForTimeout(300);
    ok(await page.locator('#my-account').isVisible(), 'MY에 계정 카드가 뜬다');
    ok(await page.locator('#btn-acc-up').count() === 1, '회원가입 버튼이 있다');

    await page.click('#btn-acc-up');
    await page.waitForSelector('#btn-auth-go');
    ok(await page.locator('#in-auth-email').count() === 1
      && await page.locator('#in-auth-pw').count() === 1, '가입 칸은 이메일·비밀번호 둘뿐');
    /* 🔴 가입 화면에 민감정보 칸이 없다 — 개발자 지시 */
    const sheetText = await page.textContent('#detail-sheet');
    ok(!/기초생활|장애|주민등록/.test(sheetText.replace('주민등록번호·계좌번호·증명서류는 서버로 보내지 않고 이 기기에만 남아요.', '')),
      '가입 화면에 민감정보 입력 칸이 없다');

    await page.fill('#in-auth-email', 'test@example.com');
    await page.fill('#in-auth-pw', 'test-password-1234');
    await page.click('#btn-auth-go');
    await page.waitForTimeout(400);
    ok(await page.locator('#auth-err').isVisible(), '약관에 동의하지 않으면 가입되지 않는다');

    await page.check('#in-auth-agree');
    await page.click('#btn-auth-go');
    await page.waitForTimeout(1200);
    ok(await page.locator('#detail-sheet.show').count() === 0, '가입되면 시트가 닫힌다');
    ok(received.some((r) => r.path.startsWith('/auth/v1/signup')), '서버에 가입 요청이 갔다');
    ok(received.some((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/profiles')), '프로필이 서버로 올라갔다');
  }

  console.log('\n[3] 🔴 주민등록번호·계좌번호는 한 번도 안 나간다 (terms.html 의 약속)');
  {
    const all = received.map((r) => r.raw).join('\n');
    ok(!all.includes(RRN), '주민등록번호가 요청 본문에 없다');
    ok(!all.includes(ACCOUNT), '계좌번호가 요청 본문에 없다');
    ok(!/"rrn"/.test(all), "'rrn' 이라는 칸 자체가 안 나간다");
    ok(!/"account"/.test(all), "'account' 라는 칸 자체가 안 나간다");
    const row = (received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/profiles')).pop() || {}).body;
    const keys = row && row[0] ? Object.keys(row[0]).sort() : [];
    ok(JSON.stringify(keys) === JSON.stringify(['applications', 'profile', 'sensitive_ok', 'updated_at', 'user_id']),
      '올라가는 칸은 정해진 다섯 개뿐이다', keys);
    /* 학교·학년 같은 것은 **올라가야** 한다 — 안 올라가면 기기 간 이어쓰기가 안 된다 */
    ok(row && row[0].profile && row[0].profile.school === '한국외국어대학교', '학교는 올라간다(이어쓰기의 핵심)');
    ok(row && row[0].profile && row[0].profile.common && row[0].profile.common.studentId === '202312345',
      '학번처럼 민감하지 않은 서류 정보는 올라간다');
  }

  console.log('\n[4] 민감정보(특별자격)는 동의했을 때만 나간다');
  {
    const { page } = firstPage;
    const before = (received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/profiles')).pop() || {}).body;
    ok(before && before[0].profile && before[0].profile.flags === undefined,
      '동의 전에는 특별자격이 안 나간다', before && before[0].profile && before[0].profile.flags);
    ok(before && before[0].sensitive_ok === false, '동의 여부가 false로 기록된다');
    /* 기기에는 그대로 남아 있어야 한다 — 매칭이 달라지면 안 된다 */
    ok(await page.evaluate(() => state.profile.flags.length) === 2, '동의와 무관하게 기기에는 남아 있다');

    await page.evaluate(() => { state.consent.sensitive = true; saveState(); });
    await page.waitForTimeout(800);
    const after = (received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/profiles')).pop() || {}).body;
    ok(after && after[0].profile && Array.isArray(after[0].profile.flags)
      && after[0].profile.flags.includes('basicLiving'), '동의하면 특별자격이 올라간다');
    ok(after && after[0].sensitive_ok === true, '동의 여부가 true로 기록된다');
    await firstPage.ctx.close();
  }

  /* ───────────── [5] 새 기기 ───────────── */
  console.log('\n[5] 새 기기 — 기기를 비우고 로그인하면 프로필이 되살아난다');
  {
    const { ctx, page } = await newPage();
    await page.goto(`http://localhost:${APP_PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    ok(await page.locator('#screen-onboarding').isVisible(), '새 기기에서는 온보딩이 뜬다');

    /* 온보딩 도중에도 MY로 갈 수 없으므로, 로그인 시트를 직접 연다 (앱의 진짜 함수를 부른다) */
    await page.evaluate(() => openAuthSheet('in'));
    await page.waitForSelector('#btn-auth-go');
    await page.fill('#in-auth-email', 'test@example.com');
    await page.fill('#in-auth-pw', 'test-password-1234');
    await page.click('#btn-auth-go');
    await page.waitForTimeout(1500);

    const restored = await page.evaluate(() => (state.profile ? {
      school: state.profile.school, year: state.profile.year, flags: state.profile.flags,
      rrn: (state.profile.common || {}).rrn || null,
    } : null));
    ok(restored && restored.school === '한국외국어대학교', '🎉 새 기기에 학교가 되살아났다', restored);
    ok(restored && restored.year === 3, '학년도 되살아났다');
    ok(restored && Array.isArray(restored.flags) && restored.flags.includes('disabled'),
      '동의한 특별자격도 되살아났다');
    ok(restored && restored.rrn === null, '주민등록번호는 새 기기에 없다(서버에 없었으므로)');
    ok(await page.locator('#screen-home').isVisible(), '온보딩이 아니라 홈이 뜬다');
    await ctx.close();
  }

  /* ───────────── [6] 서버가 죽어도 앱은 열린다 ───────────── */
  console.log('\n[6] 서버가 죽어 있어도 앱은 그대로 열린다 (기기 우선)');
  {
    await new Promise((r) => sb.close(r));
    const { ctx, page } = await newPage();
    await page.goto(`http://localhost:${APP_PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(seedScript(SEED));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    ok(await page.locator('#screen-home').isVisible(), '홈이 정상으로 뜬다');
    ok(await page.evaluate(() => state.profile && state.profile.school) === '한국외국어대학교',
      '프로필이 기기 것 그대로다');
    ok(await page.locator('.sch-card').count() > 0, '장학금 카드도 그대로 보인다');
    await ctx.close();
  }

  console.log('\n[7] 콘솔 오류');
  ok(errors.length === 0, '콘솔·페이지 오류 없음', errors.slice(0, 4));

  await browser.close();
  await new Promise((r) => onSrv.close(r));
  await new Promise((r) => offSrv.close(r));
  fs.rmSync(onDir, { recursive: true, force: true });
  fs.rmSync(offDir, { recursive: true, force: true });

  console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 회원가입·로그인 검증 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('DRIVER FAIL:', e); process.exit(1); });
