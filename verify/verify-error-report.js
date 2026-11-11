/* ─────────────────────────────────────────────────────────────────────────
   앱 오류 수집 창구 검사 (2026-11-10 · 은서 · 출시 전 백엔드 7번 · error-report.js)

   이 검사의 존재 이유는 **terms.html 에 적은 문장을 증명하는 것**이다:
     "계정·이름·프로필은 담지 않으며, 오류 문구 속 주소·메일·전화번호·긴 숫자는 지운 뒤 보냅니다."
   가짜 Supabase 서버를 세워 앱이 보내는 **요청 본문을 전부 모아** 실제로 센다.

   보는 것
     [1] 스위치(errorReport)가 꺼져 있으면 오류가 나도 한 건도 안 나간다
     [2] 켜져 있으면 오류가 표(client_errors)로 간다 — 화면 이름·앱 판·기기 이름과 함께
     [3] 🔴 문구 속 토큰 붙은 주소·메일·전화·긴 숫자는 지워서 나간다 · 칸은 정해진 일곱 개뿐 · 프로필 글자가 없다
     [4] 같은 오류는 한 번만 · 한 페이지 5건까지 · 문구 없는 남의 스크립트 오류('Script error.')는 안 보낸다
     [5] 처리 안 된 약속 거절(unhandledrejection)도 보낸다
     [6] 서버가 거절(500)해도 앱에 새 오류가 생기지 않는다(보고가 앱을 망가뜨리지 않는다)

   실행: PORT 불필요(자체 서버) · CHROME_PATH=... node verify/verify-error-report.js   (돈 0원 · 인터넷 불필요)
   ───────────────────────────────────────────────────────────────────────── */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { bootGone } = require('./onboard-helper.js');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..');
const ON_PORT = 8150;      // 스위치 켠 앱
const OFF_PORT = 8152;     // 스위치 끈 앱
const SB_PORT = 8151;      // 가짜 Supabase
const NOLOCAL_PORT = 8153; // 켰지만 localhost 허락이 없는 앱(= 검사 환경에서 진짜 설정 그대로)

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

const got = [];            // client_errors 로 온 본문
let refuse = false;        // [6] 에서 500 을 돌려준다
function startSupabase() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        if (req.url.startsWith('/rest/v1/client_errors') && req.method === 'POST') {
          let body = null; try { body = JSON.parse(raw); } catch (e) { body = { _raw: raw }; }
          got.push({ body, raw, headers: req.headers });
          res.writeHead(refuse ? 500 : 201, { ...cors, 'content-type': 'application/json' }); res.end(refuse ? '{"message":"x"}' : '');
          return;
        }
        res.writeHead(200, { ...cors, 'content-type': 'application/json' }); res.end('[]');
      });
    });
    srv.listen(SB_PORT, () => resolve(srv));
  });
}

/* 앱 복사본 — 원본 저장소는 건드리지 않는다. 값을 **항상 덮어쓴다**(저장소에 무엇이 적혀 있든 검사가 진짜 서버로 보내지 않게) */
const setStr = (src, key, val) => src.replace(new RegExp(`(\\b${key}:\\s*)'[^']*'`), `$1'${val}'`);
function makeAppCopy(on, local = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handaejang-err-'));
  for (const f of fs.readdirSync(ROOT)) {
    if (['.git', 'node_modules', 'verify', 'proposals', 'collector', 'supabase', '_admin', 'server', 'docs', 'insta'].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  const cfgPath = path.join(dir, 'supabase-config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  cfg = setStr(cfg, 'url', `http://localhost:${SB_PORT}`);
  cfg = setStr(cfg, 'anonKey', 'anon-test-key');
  cfg = cfg.replace(/\berrorReport:\s*(true|false),?/, `errorReport: ${on}, errorReportLocal: ${local},`);
  if (!new RegExp(`errorReport: ${on}, errorReportLocal: ${local},`).test(cfg) || !/url:\s*'http:\/\/localhost/.test(cfg)) {
    throw new Error('supabase-config.js 의 url·errorReport 를 바꾸지 못했습니다 — 파일 모양이 바뀐 것 같습니다');
  }
  fs.writeFileSync(cfgPath, cfg);
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  html = html.replace('https://*.supabase.co', `https://*.supabase.co http://localhost:${SB_PORT}`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return dir;
}
function serve(dir, port) {
  return new Promise((resolve) => {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
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

/* 프로필 — 이 글자들이 오류 보고에 **한 글자도** 나가면 안 된다 */
const SEED = { profile: { name: '검사용이름', school: '한국외국어대학교', track: 'humanities', major: '영어통번역학과', year: 3, status: 'enrolled', gpa: 3.6, bracket: 5,
  campus: '서울캠퍼스', region: 'seoul', nationality: 'korean', credits: 15, birthYear: 2003, flags: [], common: { studentId: '202312345', phone: '010-9999-8888' } },
applications: [], updatedAt: '2026-11-10T00:00:00.000Z' };
const throwLater = (msg) => `setTimeout(() => { throw new Error(${JSON.stringify(msg)}); }, 0)`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ALLOWED = ['col', 'device', 'line', 'message', 'screen', 'source', 'version'];

(async () => {
  const sb = await startSupabase();
  const onDir = makeAppCopy(true);
  const offDir = makeAppCopy(false);
  const onSrv = await serve(onDir, ON_PORT);
  const offSrv = await serve(offDir, OFF_PORT);
  const nlDir = makeAppCopy(true, false);
  const nlSrv = await serve(nlDir, NOLOCAL_PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const open = async (port) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await ctx.newPage();
    const extra = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) extra.push(m.text()); });
    await page.addInitScript((s) => { try { localStorage.setItem('handaejang.v1', s); } catch (e) { /* */ } }, JSON.stringify(SEED));
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await bootGone(page);
    await page.waitForTimeout(800);
    return { ctx, page, extra };
  };

  console.log('\n[1] 스위치가 꺼져 있으면 한 건도 안 나간다');
  {
    const { ctx, page } = await open(OFF_PORT);
    await page.evaluate(throwLater('꺼진 판의 오류'));
    await wait(800);
    ok(got.length === 0, '오류가 나도 client_errors 로 간 요청 0건', got.length);
    await ctx.close();
  }

  console.log('\n[1-2] 켜져 있어도 검사 주소(localhost)에서는 안 보낸다 — 검사 중 오류가 진짜 표에 섞이지 않게');
  {
    const { ctx, page } = await open(NOLOCAL_PORT);
    await page.evaluate(throwLater('검사 환경의 오류'));
    await wait(800);
    ok(got.length === 0, '스위치를 켠 진짜 설정 그대로여도 localhost 에서는 0건', got.length);
    await ctx.close();
  }

  console.log('\n[2]·[3] 켜져 있으면 지운 꼴로 나간다');
  {
    const { ctx, page } = await open(ON_PORT);
    const dirty = '불러오기 실패 https://ffnz.supabase.co/auth/v1/callback?access_token=SECRETTOKEN123#refresh_token=RRR kim.student@hufs.ac.kr 010-1234-5678 9901011234567 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abcdefghij';
    await page.evaluate(throwLater(dirty));
    await wait(1000);
    const b = (got[0] || {}).body || {};
    const raw = (got[0] || {}).raw || '';
    ok(got.length === 1, '오류 한 건이 client_errors 로 갔다', got.length);
    ok(Object.keys(b).sort().join(',') === ALLOWED.join(','), '칸은 정해진 일곱 개뿐(계정·프로필 칸 없음)', Object.keys(b));
    ok(/불러오기 실패/.test(b.message || ''), '오류 문구의 뜻은 남는다', b.message);
    ok(!/SECRETTOKEN123|RRR|access_token=S/.test(raw), '🔴 주소의 토큰(물음표·# 뒤)은 안 나간다', b.message);
    ok(/https:\/\/ffnz\.supabase\.co\/auth\/v1\/callback/.test(b.message || ''), '  주소는 어느 곳인지만 남는다(호스트·경로)', b.message);
    ok(!/kim\.student|@hufs/.test(raw) && /\[메일\]/.test(b.message || ''), '🔴 메일 주소는 지운다', b.message);
    ok(!/010-1234-5678/.test(raw) && /\[전화\]/.test(b.message || ''), '🔴 전화번호는 지운다', b.message);
    ok(!/9901011234567/.test(raw) && /\[숫자\]/.test(b.message || ''), '🔴 긴 숫자(주민등록번호·계좌·학번)는 지운다', b.message);
    ok(!/eyJhbGciOiJIUzI1NiJ9\.eyJ/.test(raw), '🔴 로그인 토큰 꼴(eyJ…)은 지운다', b.message);
    ok(!/검사용이름|202312345|010-9999-8888|영어통번역학과/.test(raw), '🔴 프로필 글자(이름·학번·연락처·전공)가 한 글자도 없다');
    ok(/^screen-/.test(b.screen || ''), '그때 보던 화면 이름이 간다', b.screen);
    ok(!!b.version, '앱 판이 간다', b.version);
    ok(typeof b.device === 'string', '기기 이름은 거친 이름(문자열)', b.device);
    const h = (got[0] || {}).headers || {};
    ok(h.apikey === 'anon-test-key' && !/eyJ/.test(h.authorization || ''), '공개 열쇠로만 보낸다(로그인 토큰을 싣지 않는다 — 누구인지 안 남는다)', h.authorization);

    console.log('\n[4] 같은 오류는 한 번 · 한 페이지 5건까지 · Script error 는 안 보냄');
    await page.evaluate(throwLater(dirty));
    await wait(500);
    ok(got.length === 1, '같은 오류를 또 내도 더 안 보낸다', got.length);
    await page.evaluate(() => { window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' })); });
    await wait(300);
    ok(got.length === 1, "'Script error.'(문구 없는 남의 스크립트 오류)는 안 보낸다", got.length);
    for (let i = 0; i < 8; i++) await page.evaluate(throwLater(`다른 오류 ${i}번`));
    await wait(1200);
    ok(got.length === 5, '한 페이지에서 5건까지만', got.length);
    await ctx.close();
  }

  console.log('\n[5] 처리 안 된 약속 거절도 보낸다');
  {
    got.length = 0;
    const { ctx, page } = await open(ON_PORT);
    await page.evaluate(() => { Promise.reject(new Error('약속 거절 표본')); });
    await wait(900);
    ok(got.some((g) => /약속 거절 표본/.test((g.body || {}).message || '')), 'unhandledrejection 이 client_errors 로 갔다', got.map((g) => (g.body || {}).message));
    await ctx.close();
  }

  console.log('\n[6] 서버가 거절해도 앱에 새 오류가 생기지 않는다');
  {
    got.length = 0; refuse = true;
    const { ctx, page, extra } = await open(ON_PORT);
    const before = extra.length;
    await page.evaluate(throwLater('거절당할 오류'));
    await wait(1000);
    ok(got.length === 1, '보내기는 했다(서버가 500)', got.length);
    ok(extra.length === before, '보고 실패가 콘솔 오류를 새로 만들지 않는다', extra.slice(before));
    ok(await page.evaluate(() => document.querySelectorAll('.nav-item').length > 0), '앱은 그대로 돈다');
    refuse = false;
    await ctx.close();
  }

  await browser.close();
  await new Promise((r) => onSrv.close(r));
  await new Promise((r) => offSrv.close(r));
  await new Promise((r) => nlSrv.close(r));
  fs.rmSync(nlDir, { recursive: true, force: true });
  await new Promise((r) => sb.close(r));
  fs.rmSync(onDir, { recursive: true, force: true });
  fs.rmSync(offDir, { recursive: true, force: true });
  console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 앱 오류 수집 창구 검증 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('DRIVER FAIL:', e); process.exit(1); });
