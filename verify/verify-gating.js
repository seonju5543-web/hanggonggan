/* 과팅 탭 — 앱(브라우저) 검증 (2026-09-21)
   ─────────────────────────────────────────────────────────────────────────
   이 검사의 존재 이유는 **학생끼리 서로를 보는 첫 화면이 약속을 지키는가**를 증명하는 것이다:
     "학교 이메일 인증을 통과한 계정만 본다 · 서버로 가는 것은 닉네임·학과·성별·글·요청·메시지뿐 ·
      이름·학번·전화·주민등록번호는 한 번도 안 나간다"
   verify-supabase.js 처럼 가짜 Supabase + 가짜 과팅 서버를 세워 **앱이 보내는 요청 본문을 전부
   모아** 센다.

   보는 것
     [1] 서버 설정이 비면 탭은 '준비 중'뿐이고 요청 0건 (지금 앱 그대로)
     [2] 로그인 안 했으면 문 — 로그인 버튼이 로그인 시트를 연다
     [3] 인증 흐름 — 번호 보내기(본문은 이메일뿐) → 확인 → 학교 이름을 지어내지 않는다 → 프로필(칸 셋)
     [4] 게시판 — 남의 글이 글자로만 그려진다(esc) · 전화번호 글은 막힌다 · 보내는 칸은 셋
     [5] 대화방 — 방 열기 RPC · 폴링은 그 방만 · 보내기 본문 · 새 말이 5초 안에 뜬다 · 닫으면 폴링 정지
     [6] 매칭 — 신청 본문은 둘 · 짝이 되면 카드
     [7] 차단 — 그 사람 글이 사라진다
     [8] 🔴 이름·학번·전화·주민등록번호·계좌가 과팅 경로로 **한 번도** 안 나간다
     [9] 탈퇴 — 과팅 프로필을 프로필보다 먼저 지운다
   실행: CHROME_PATH=... node verify/verify-gating.js     (돈 0원 · 인터넷 불필요)
   ───────────────────────────────────────────────────────────────────────── */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.join(__dirname, '..');
const APP_PORT = 8133;        // 설정된 앱
const OFF_PORT = 8134;        // 과팅 서버 주소가 빈 앱
const SB_PORT = 8135;         // 가짜 Supabase
const GW_PORT = 8136;         // 가짜 과팅 서버(워커)
const ME = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';

let fail = 0;
const ok = (cond, label, extra) => {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
};

/* ───────── 가짜 Supabase — 표 몇 개를 메모리에 두고 PostgREST 흉내 ───────── */
const received = [];     // { path, method, body, raw, headers }
const db = {
  me: null,
  posts: [
    { id: 11, author: U2, nickname: '연영이', school: '한국외국어대학교', dept: '영어학과', gender: '여', headcount: 3, want_school: 'any',
      body: '<img src=x onerror="window.__xss=1"> 3:3 과팅 구해요', status: 'open', created_at: '2026-09-20T10:00:00Z', expires_at: '2026-10-04T10:00:00Z' },
    { id: 12, author: U3, nickname: '경희사학', school: '경희대학교', dept: '사학과', gender: '여', headcount: 4, want_school: 'same',
      body: '4:4 이번 주말 어때요', status: 'open', created_at: '2026-09-19T10:00:00Z', expires_at: '2026-10-03T10:00:00Z' },
  ],
  rooms: [], members: [], messages: [], requests: [], matches: [], blocks: [], reports: [],
  nextId: 100,
};
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, prefer',
};
function serveJson(handler, port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (e) { /* JSON이 아닐 수 있다 */ }
        const send = (code, obj) => {
          res.writeHead(code, Object.assign({ 'content-type': 'application/json' }, cors));
          res.end(obj === undefined ? '' : JSON.stringify(obj));
        };
        handler({ url: req.url, method: req.method, body, raw, headers: req.headers, send });
      });
    });
    srv.listen(port, () => resolve(srv));
  });
}
const qs = (url) => new URL('http://x' + url).searchParams;
const eqv = (p, k) => { const v = p.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
const inv = (p, k) => { const v = p.get(k); return v && v.startsWith('in.(') ? v.slice(4, -1).split(',') : null; };

function supabase(r) {
  received.push({ path: r.url, method: r.method, body: r.body, raw: r.raw, headers: r.headers, to: 'sb' });
  const p = qs(r.url);
  const u = r.url;
  const now = () => new Date().toISOString();
  if (u.startsWith('/auth/v1/user')) return r.send(200, { id: ME, email: 'test@example.com' });
  if (u.startsWith('/auth/v1/token')) return r.send(200, { access_token: 'access-test', refresh_token: 'r', expires_in: 3600, user: { id: ME, email: 'test@example.com' } });
  if (u.startsWith('/auth/v1/logout')) return r.send(204);
  if (u.startsWith('/rest/v1/profiles')) { if (r.method === 'DELETE') return r.send(204); if (r.method === 'POST') return r.send(201); return r.send(200, []); }
  if (u.startsWith('/rest/v1/login_events')) return r.send(r.method === 'POST' ? 201 : 200, r.method === 'POST' ? undefined : []);
  if (u.startsWith('/rest/v1/gating_profiles')) {
    if (r.method === 'DELETE') { db.me = null; return r.send(204); }
    if (r.method === 'PATCH') { db.me = Object.assign({}, db.me, r.body); return r.send(200, [db.me]); }
    return r.send(200, db.me ? [db.me] : []);
  }
  if (u.startsWith('/rest/v1/gating_posts')) {
    if (r.method === 'POST') {
      if (!db.me || !db.me.nickname) return r.send(403, { message: 'not_verified' });
      const row = Object.assign({ id: db.nextId++, author: ME, nickname: db.me.nickname, school: db.me.school, dept: db.me.dept, gender: db.me.gender,
        status: 'open', created_at: now(), expires_at: now() }, r.body);
      db.posts.unshift(row);
      return r.send(201, [row]);
    }
    if (r.method === 'PATCH') { const id = Number(eqv(p, 'id')); const row = db.posts.find((x) => x.id === id); if (row) Object.assign(row, r.body); return r.send(204); }
    const blocked = new Set(db.blocks.map((b) => b.blocked));
    return r.send(200, db.posts.filter((x) => x.status === 'open' && !blocked.has(x.author)));
  }
  if (u.startsWith('/rest/v1/rpc/gating_forget_me')) { db.me = null; db.posts = db.posts.filter((x) => x.author !== ME); return r.send(204); }
  if (u.startsWith('/rest/v1/rpc/gating_open_room')) {
    const post = db.posts.find((x) => x.id === Number(r.body && r.body.p_post));
    if (!post) return r.send(400, { message: 'post_closed' });
    const id = db.nextId++;
    db.rooms.push({ id, kind: 'post', post_id: post.id, opened_by: ME, created_at: now(), closed_at: null });
    db.members.push({ room_id: id, user_id: ME, nickname: db.me.nickname, last_read_at: now(), left_at: null });
    db.members.push({ room_id: id, user_id: post.author, nickname: post.nickname, last_read_at: now(), left_at: null });
    return r.send(200, id);
  }
  if (u.startsWith('/rest/v1/gating_room_members')) {
    if (r.method === 'PATCH') {
      const rid = Number(eqv(p, 'room_id')); const uid = eqv(p, 'user_id');
      const m = db.members.find((x) => x.room_id === rid && x.user_id === uid); if (m) Object.assign(m, r.body);
      return r.send(204);
    }
    let rows = db.members;
    const uid = eqv(p, 'user_id'); if (uid) rows = rows.filter((x) => x.user_id === uid);
    const neq = p.get('user_id'); if (neq && neq.startsWith('neq.')) rows = rows.filter((x) => x.user_id !== neq.slice(4));
    const ids = inv(p, 'room_id'); if (ids) rows = rows.filter((x) => ids.includes(String(x.room_id)));
    if (p.get('left_at') === 'is.null') rows = rows.filter((x) => !x.left_at);
    return r.send(200, rows);
  }
  if (u.startsWith('/rest/v1/gating_room_last')) {
    const ids = inv(p, 'room_id') || [];
    return r.send(200, db.rooms.filter((x) => ids.includes(String(x.id))).map((x) => {
      const last = db.messages.filter((m) => m.room_id === x.id).slice(-1)[0];
      return { room_id: x.id, kind: x.kind, post_id: x.post_id, closed_at: x.closed_at, created_at: x.created_at,
        last_body: last ? last.body : null, last_at: last ? last.created_at : null, last_sender: last ? last.sender : null, last_id: last ? last.id : null };
    }));
  }
  if (u.startsWith('/rest/v1/gating_messages')) {
    if (r.method === 'POST') {
      const row = Object.assign({ id: db.nextId++, sender: ME, created_at: now() }, r.body);
      db.messages.push(row);
      return r.send(201, [row]);
    }
    const rid = Number(eqv(p, 'room_id'));
    const gt = p.get('id'); const after = gt && gt.startsWith('gt.') ? Number(gt.slice(3)) : 0;
    return r.send(200, db.messages.filter((m) => m.room_id === rid && m.id > after));
  }
  if (u.startsWith('/rest/v1/gating_requests')) {
    if (r.method === 'POST') { const row = Object.assign({ id: db.nextId++, user_id: ME, status: 'waiting', created_at: now(), expires_at: now() }, r.body); db.requests.unshift(row); return r.send(201, [row]); }
    if (r.method === 'PATCH') { const id = Number(eqv(p, 'id')); const row = db.requests.find((x) => x.id === id); if (row) Object.assign(row, r.body); return r.send(204); }
    return r.send(200, db.requests);
  }
  if (u.startsWith('/rest/v1/gating_matches')) return r.send(200, db.matches);
  if (u.startsWith('/rest/v1/gating_reports')) { db.reports.push(r.body); return r.send(201); }
  if (u.startsWith('/rest/v1/gating_blocks')) {
    if (r.method === 'DELETE') { const b = p.get('blocked'); db.blocks = db.blocks.filter((x) => 'eq.' + x.blocked !== b); return r.send(204); }
    db.blocks.push(Object.assign({ blocker: ME }, r.body)); return r.send(201);
  }
  return r.send(404, { msg: 'not found' });
}

/* ───────── 가짜 과팅 서버(워커) ───────── */
function gateway(r) {
  received.push({ path: r.url, method: r.method, body: r.body, raw: r.raw, headers: r.headers, to: 'gw' });
  if (r.url === '/verify/send') {
    const email = String((r.body || {}).email || '');
    if (!/\.ac\.kr$/i.test(email)) return r.send(400, { error: 'not_school' });
    db.sentTo = email;
    return r.send(200, { ok: true, domain: email.split('@')[1].toLowerCase(), school: null });
  }
  if (r.url === '/verify/check') {
    if (String((r.body || {}).code) !== '123456') return r.send(400, { error: 'wrong_code', left: 4 });
    /* 실제 서버처럼 — 학교 이름은 표에 없으니 null, 도메인만 */
    db.me = { user_id: ME, nickname: null, school: null, dept: null, gender: null, verified_domain: db.sentTo.split('@')[1].toLowerCase(), verified_at: new Date().toISOString() };
    return r.send(200, { ok: true, domain: db.me.verified_domain, school: null });
  }
  return r.send(404, { error: 'not_found' });
}

/* ───────── 앱 복사본 (원본 저장소는 절대 건드리지 않는다) ───────── */
const setStr = (src, key, val) => src.replace(new RegExp(`(\\b${key}:\\s*)'[^']*'`), `$1'${val}'`);
const setNum = (src, key, val) => src.replace(new RegExp(`(\\b${key}:\\s*)\\d+`), `$1${val}`);

function makeAppCopy(gatingOn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handaejang-gt-'));
  for (const f of fs.readdirSync(ROOT)) {
    if (['.git', 'node_modules', 'verify', 'proposals', 'collector', 'supabase', '_admin', 'server', 'docs', 'insta', 'tools'].includes(f)) continue;
    fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  }
  /* 🔴 **항상 덮어쓴다** — 저장소에 무엇이 적혀 있든 검사가 진짜 서버로 가면 안 된다 */
  const sbPath = path.join(dir, 'supabase-config.js');
  let cfg = fs.readFileSync(sbPath, 'utf8');
  cfg = setStr(cfg, 'url', `http://localhost:${SB_PORT}`);
  cfg = setStr(cfg, 'anonKey', 'anon-test-key');
  cfg = setNum(cfg, 'pushDelayMs', 60);
  if (!cfg.includes(`url: 'http://localhost:${SB_PORT}'`)) throw new Error('supabase-config.js 의 url 을 바꾸지 못했습니다');
  fs.writeFileSync(sbPath, cfg);
  const gwPath = path.join(dir, 'gating-config.js');
  let gw = fs.readFileSync(gwPath, 'utf8');
  gw = setStr(gw, 'endpoint', gatingOn ? `http://localhost:${GW_PORT}` : '');
  if (!gw.includes(`endpoint: '${gatingOn ? `http://localhost:${GW_PORT}` : ''}'`)) throw new Error('gating-config.js 의 endpoint 를 바꾸지 못했습니다');
  fs.writeFileSync(gwPath, gw);
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  html = html.replace('https://*.supabase.co', `https://*.supabase.co http://localhost:${SB_PORT} http://localhost:${GW_PORT}`);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
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

/* 시험용 프로필 — 🔴 이름·학번·전화·주민등록번호·계좌를 **일부러** 넣는다. 이게 과팅 경로로
   안 나가는 것을 증명하는 것이 이 검사의 목적이다. */
const RRN = '990101-1234567';
const ACCOUNT = '110-222-333444';
const PHONE = '010-9876-5432';
const NAME = '검사용이름';
const SEED = {
  profile: {
    name: NAME, school: '한국외국어대학교', track: 'humanities', major: '영어통번역학과',
    year: 3, status: 'enrolled', gpa: 3.6, bracket: 5, campus: '서울캠퍼스',
    region: 'seoul', parentRegion: null, nationality: 'korean', credits: 15, birthYear: 2003,
    flags: [], cert: false, exchange: false,
    common: { studentId: '202312345', phone: PHONE, rrn: RRN, account: ACCOUNT },
  },
  applications: [], consent: { sensitive: false }, updatedAt: '2026-09-20T00:00:00.000Z',
};
const AUTH = { accessToken: 'access-test', refreshToken: 'refresh-test', expiresAt: Date.now() + 3600e3, userId: ME, email: 'test@example.com' };
const seedScript = (seed, auth) => `localStorage.setItem('handaejang.v1', ${JSON.stringify(JSON.stringify(seed))});`
  + (auth ? `localStorage.setItem('handaejang.auth', ${JSON.stringify(JSON.stringify(auth))});` : `localStorage.removeItem('handaejang.auth');`);

const gatingReqs = () => received.filter((r) => r.to === 'gw' || /\/rest\/v1\/(gating_|rpc\/gating)/.test(r.path));

(async () => {
  const sb = await serveJson(supabase, SB_PORT);
  const gw = await serveJson(gateway, GW_PORT);
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
  /* 알림 동의 시트가 뒤 화면 클릭을 가로막는다 — verify-supabase.js 와 같은 방식으로 치운다 */
  const settle = async (page, ms) => {
    await page.waitForTimeout(ms || 900);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        if (typeof notifyMaybeAskConsent === 'function') window.notifyMaybeAskConsent = () => {};
        if (typeof closeNotifyPanel === 'function') closeNotifyPanel();
      }).catch(() => {});
      await page.waitForTimeout(700);
    }
  };
  const boot = async (page, port, auth) => {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(seedScript(SEED, auth));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
  };

  /* ───────────── [1] 설정이 비면 '준비 중' ───────────── */
  console.log('\n[1] 과팅 서버 주소가 비어 있으면 탭은 준비 중이고 요청이 없다');
  {
    const { ctx, page } = await newPage();
    await boot(page, OFF_PORT, AUTH);
    ok(await page.locator('.nav-item').count() === 5, '아래 탭이 다섯이다');
    const order = await page.$$eval('.nav-item', (els) => els.map((e) => e.dataset.nav));
    ok(order.indexOf('gating') === 3 && order[4] === 'my', '과팅은 넷째, MY 는 마지막', order);
    await page.click('.nav-item[data-nav="gating"]');
    await page.waitForTimeout(400);
    ok(await page.locator('#screen-gating').isVisible(), '과팅 화면이 열린다');
    ok(/준비 중/.test(await page.textContent('#gating-body')), "'준비 중' 카드만 있다");
    ok(await page.evaluate(() => gatingConfigured() === false), 'gatingConfigured() 가 false');
    ok(gatingReqs().length === 0, '🔴 과팅 요청이 한 건도 안 나간다', gatingReqs().map((r) => r.path));
    await ctx.close();
  }

  /* ───────────── [2] 로그인 안 했으면 문 ───────────── */
  console.log('\n[2] 로그인 안 했으면 문 — 로그인 버튼이 로그인 시트를 연다');
  {
    const { ctx, page } = await newPage();
    await boot(page, APP_PORT, null);
    await page.click('.nav-item[data-nav="gating"]');
    await page.waitForTimeout(400);
    ok(/로그인/.test(await page.textContent('#gating-body')), '로그인 안내가 뜬다');
    ok(gatingReqs().length === 0, '로그인 전에는 과팅 요청이 없다', gatingReqs().map((r) => r.path));
    await page.click('#gating-body [data-gt="login"]');
    await page.waitForSelector('#btn-auth-go');
    ok(await page.locator('#in-auth-email').count() === 1, '로그인 시트가 열린다 (앱의 진짜 시트)');
    await ctx.close();
  }

  /* ───────────── [3] 인증 흐름 ───────────── */
  console.log('\n[3] 학교 이메일 인증 → 과팅 프로필');
  const { ctx, page } = await newPage();
  {
    await boot(page, APP_PORT, AUTH);
    ok(gatingReqs().length === 0, '🔴 탭을 열기 전에는 과팅 요청이 없다 (부팅 때 조용하다)', gatingReqs().map((r) => r.path));
    await page.click('.nav-item[data-nav="gating"]');
    await page.waitForTimeout(600);
    ok(await page.locator('#gt-email').count() === 1, '인증 안 됐으면 이메일 칸이 뜬다');

    await page.fill('#gt-email', 'me@gmail.com');
    await page.click('[data-gt="send"]');
    await page.waitForTimeout(500);
    ok(/학교 이메일/.test(await page.textContent('#gt-err')), '학교 이메일이 아니면 그렇게 말한다', await page.textContent('#gt-err'));

    await page.fill('#gt-email', 'Stu@abc.ac.kr');
    await page.click('[data-gt="send"]');
    await page.waitForTimeout(500);
    const sendReq = received.filter((r) => r.to === 'gw' && r.path === '/verify/send').pop();
    ok(!!sendReq && JSON.stringify(Object.keys(sendReq.body)) === '["email"]', '🔴 보내는 본문은 이메일 하나뿐', sendReq && sendReq.body);
    ok(sendReq && sendReq.headers.authorization === 'Bearer access-test', '학생 토큰이 붙는다');
    ok(await page.locator('#gt-code').count() === 1, '번호 칸이 뜬다');

    await page.fill('#gt-code', '000000');
    await page.click('[data-gt="check"]');
    await page.waitForTimeout(500);
    ok(/맞지 않아요/.test(await page.textContent('#gt-err')), '틀린 번호는 그렇게 말한다');
    await page.fill('#gt-code', '123456');
    await page.click('[data-gt="check"]');
    await page.waitForTimeout(800);
    const checkReq = received.filter((r) => r.to === 'gw' && r.path === '/verify/check').pop();
    ok(!!checkReq && JSON.stringify(Object.keys(checkReq.body)) === '["code"]', '확인 본문은 번호 하나뿐');
    ok(await page.locator('#gt-nick').count() === 1, '인증되면 프로필 칸이 뜬다');
    const profText = await page.textContent('#gating-body');
    ok(/abc\.ac\.kr/.test(profText), '🔴 표에 없는 학교는 이름을 지어내지 않고 도메인을 그대로 보여 준다');
    ok(await page.inputValue('#gt-dept') === '영어통번역학과', '학과는 프로필 전공이 미리 채워진다');

    await page.fill('#gt-nick', '운영자님');
    await page.click('[data-gt="save-profile"]');
    await page.waitForTimeout(300);
    ok(/쓸 수 없어요/.test(await page.textContent('#gt-err')), "'운영자' 가 든 닉네임은 막는다");
    await page.fill('#gt-nick', '테스터');
    await page.click('[data-gt="gender"][data-v="남"]');
    await page.click('[data-gt="save-profile"]');
    await page.waitForTimeout(600);
    const patch = received.filter((r) => r.method === 'PATCH' && r.path.startsWith('/rest/v1/gating_profiles')).pop();
    ok(!!patch && JSON.stringify(Object.keys(patch.body).sort()) === '["dept","gender","nickname"]', '🔴 프로필로 보내는 칸은 닉네임·학과·성별 셋뿐', patch && patch.body);
    ok(await page.locator('.gt-tabs .chip').count() === 3, '게시판·매칭·대화 칩 셋이 뜬다');
    ok(/테스터 · abc\.ac\.kr · 영어통번역학과/.test(await page.textContent('.gt-me')), '내 줄이 닉네임·도메인·학과다', await page.textContent('.gt-me'));
  }

  /* ───────────── [4] 게시판 ───────────── */
  console.log('\n[4] 게시판 — 글자로만 그린다 · 전화번호는 막는다 · 보내는 칸은 셋');
  {
    await page.waitForSelector('.gt-post');
    ok(await page.locator('.gt-post').count() === 2, '남의 글 둘이 보인다');
    ok(await page.locator('#gt-pane img').count() === 0 && (await page.evaluate(() => window.__xss)) === undefined, '🔴 글 속 HTML 은 글자로만 그려진다 (esc)');
    ok(/<img/.test(await page.textContent('#gt-pane')), '  그 글자가 화면에 그대로 보인다');
    ok(await page.locator('.gt-schools .chip').count() === 3, '학교 칩은 전체 + 글에 나온 학교들', await page.locator('.gt-schools .chip').count());
    await page.click('.gt-schools .chip[data-v="경희대학교"]');
    await page.waitForTimeout(200);
    ok(await page.locator('.gt-post').count() === 1, '학교 칩으로 좁힌다');
    await page.click('.gt-schools .chip[data-v=""]');
    await page.waitForTimeout(200);

    await page.click('[data-gt="compose"]');
    await page.waitForSelector('#gt-compose');
    await page.fill('#gt-body', '3:3 구해요 연락은 010-1234-5678');
    await page.click('[data-gt="post"]');
    await page.waitForTimeout(300);
    ok(/전화번호/.test(await page.textContent('#gt-compose #gt-err')), '전화번호가 든 글은 막는다');
    ok(!received.some((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_posts')), '  그 글은 서버로 안 갔다');
    await page.fill('#gt-body', '오픈채팅으로 오세요 https://open.kakao.com/o/abc');
    await page.click('[data-gt="post"]');
    await page.waitForTimeout(300);
    ok(/링크/.test(await page.textContent('#gt-compose #gt-err')), '링크가 든 글은 막는다 (에브리타임 오픈채팅 유도 유형)');
    await page.fill('#gt-body', '3:3 과팅 구해요. 주말 저녁 좋아요.');
    await page.click('#gt-hc .chip[data-v="4"]');
    await page.click('#gt-when .chip[data-v="weekend_eve"]');
    await page.fill('#gt-area', '회기역 근처');
    await page.click('[data-gt="post"]');
    await page.waitForTimeout(800);
    const post = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_posts')).pop();
    ok(!!post && JSON.stringify(Object.keys(post.body).sort()) === '["area","body","headcount","want_school","when_pref"]', '🔴 글로 보내는 칸은 본문·인원·범위·시간대·지역 (학교·학과·성별·닉네임은 서버가 채운다)', post && post.body);
    ok(post && post.body.headcount === 4 && post.body.when_pref === 'weekend_eve' && post.body.area === '회기역 근처', '  고른 인원·시간대·지역이 간다');
    ok(/주말 저녁 · 회기역 근처/.test(await page.textContent('.gt-post[data-post="100"]')), '  카드에 시간대·지역이 글자로 뜬다');
    ok(await page.locator('.gt-post .gt-verified').count() === 3, "글마다 '인증' 배지가 붙는다");
    ok(await page.locator('#detail-sheet.show').count() === 0, '올리면 시트가 닫힌다');
    ok(await page.locator('.gt-post').count() === 3, '목록이 새로 그려진다');
    ok(await page.locator('.gt-post[data-post="100"] [data-gt="close-post"]').count() === 1, '내 글에는 마감 버튼만 있다');
    ok(await page.locator('.gt-post[data-post="100"] [data-gt="open-room"]').count() === 0, '  내 글에는 대화하기가 없다');
  }

  /* ───────────── [5] 대화방 ───────────── */
  console.log('\n[5] 대화방 — 방 열기 · 폴링은 그 방만 · 보내기 · 새 말 · 닫으면 정지');
  {
    await page.click('.gt-post[data-post="11"] [data-gt="open-room"]');
    await page.waitForSelector('#gt-room');
    const rpc = received.find((r) => r.path.startsWith('/rest/v1/rpc/gating_open_room'));
    ok(!!rpc && rpc.body.p_post === 11, '방 열기는 RPC 하나로 (앱이 방·구성원을 직접 안 만든다)', rpc && rpc.body);
    const roomId = Number(await page.getAttribute('#gt-room', 'data-room'));
    ok(roomId > 0, '방 번호를 받았다', roomId);
    ok(/연영이/.test(await page.textContent('#gt-room .sheet-title')), '상대 닉네임이 제목이다');
    ok(await page.locator('#gt-msgs [data-gt="ice"]').count() === 3, '빈 방에는 첫 인사 질문 셋이 뜬다');
    const iceQ = await page.getAttribute('#gt-msgs [data-gt="ice"]', 'data-q');
    await page.click('#gt-msgs [data-gt="ice"]');
    ok(await page.inputValue('#gt-msg-in') === iceQ, '  누르면 입력칸에 들어간다 (보내지는 않는다)');
    ok(!received.some((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_messages')), '  그 자체로 서버에 가지 않는다');
    ok(await page.locator('#gt-room .gt-safety [data-gt="share-plan"]').count() === 1, "'만나기 전에 확인할 것' 과 친구에게 보내기 버튼이 있다");

    await page.fill('#gt-msg-in', '안녕하세요 3:3 가능해요');
    await page.press('#gt-msg-in', 'Enter');
    await page.waitForTimeout(600);
    const sent = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_messages')).pop();
    ok(!!sent && JSON.stringify(Object.keys(sent.body).sort()) === '["body","room_id"]' && sent.body.room_id === roomId, '보내는 본문은 방 번호·글 둘뿐', sent && sent.body);
    ok(await page.locator('.gt-msg.me').count() === 1, '내 말풍선이 붙는다');

    /* 상대가 말한다 — 폴링이 5초 안에 가져와야 한다 */
    db.messages.push({ id: db.nextId++, room_id: roomId, sender: U2, body: '네 좋아요 언제가 편하세요', created_at: new Date().toISOString() });
    await page.waitForSelector('.gt-msg:not(.me)', { timeout: 6000 }).catch(() => {});
    ok(await page.locator('.gt-msg:not(.me)').count() === 1, '상대의 새 말이 5초 안에 뜬다');
    const polls = received.filter((r) => r.method === 'GET' && r.path.startsWith('/rest/v1/gating_messages'));
    ok(polls.length > 0 && polls.every((r) => r.path.includes(`room_id=eq.${roomId}`)), '🔴 폴링은 이 방만 묻는다', polls.map((r) => r.path).slice(-2));
    await page.waitForTimeout(4500);   /* 다음 폴링까지 — 그때는 받은 마지막 번호 뒤만 물어야 한다 */
    const later = received.filter((r) => r.method === 'GET' && r.path.startsWith('/rest/v1/gating_messages')).slice(-1)[0];
    ok(/id=gt\.[1-9]\d*/.test(later.path), '  말을 받은 뒤에는 마지막 번호 뒤만 묻는다', later.path);
    ok(received.some((r) => r.method === 'PATCH' && r.path.startsWith('/rest/v1/gating_room_members') && r.body.last_read_at), '읽음 시각을 적는다');

    /* 🔴 동시에 말해도 상대 말이 안 사라진다 (코드 리뷰 2) — 상대가 먼저 넣고(작은 번호) 내가 보낸 뒤 폴링 */
    db.messages.push({ id: db.nextId++, room_id: roomId, sender: U2, body: '토요일 7시 어때요', created_at: new Date().toISOString() });
    await page.fill('#gt-msg-in', '좋아요 토요일');
    await page.press('#gt-msg-in', 'Enter');
    await page.waitForTimeout(5500);
    ok((await page.textContent('#gt-msgs')).includes('토요일 7시 어때요'), '🔴 내가 보내는 사이에 온 상대 말도 뜬다');
    ok(await page.locator('.gt-msg').count() === 4, '  말풍선이 겹치지 않는다 (넷)', await page.locator('.gt-msg').count());
    /* 상대가 마지막으로 말한 상태로 둔다 — 아래 '내 차례' 검사의 전제 */
    db.messages.push({ id: db.nextId++, room_id: roomId, sender: U2, body: '그럼 그때 봐요', created_at: new Date().toISOString() });

    /* 연락처는 경고 한 번 */
    await page.fill('#gt-msg-in', '카톡 아이디 알려줄게요');
    await page.press('#gt-msg-in', 'Enter');
    await page.waitForTimeout(300);
    ok(await page.locator('.gt-msg.me').count() === 2, '연락처가 든 말은 한 번 멈춰 세운다 (막지는 않는다)', await page.locator('.gt-msg.me').count());

    /* 닫으면 폴링이 멈춘다 */
    const before = received.filter((r) => r.method === 'GET' && r.path.startsWith('/rest/v1/gating_messages')).length;
    await page.evaluate(() => closeSheet());
    await page.waitForTimeout(6500);
    const after = received.filter((r) => r.method === 'GET' && r.path.startsWith('/rest/v1/gating_messages')).length;
    ok(after === before, '🔴 시트를 닫으면 6초 동안 폴링이 0건', after - before);

    await page.click('.gt-tabs .chip[data-v="chat"]');
    await page.waitForSelector('.gt-room-row');
    ok(await page.locator('.gt-room-row').count() === 1 && /연영이/.test(await page.textContent('.gt-room-row')), '대화 목록에 그 방이 있다');
    ok(await page.locator('.gt-room-row .gt-turn').count() === 1, "상대가 마지막으로 말했으면 '내 차례' 가 붙는다");
  }

  /* ───────────── [6] 매칭 ───────────── */
  console.log('\n[6] 매칭 — 신청 본문은 둘 · 짝이 되면 카드');
  {
    await page.click('.gt-tabs .chip[data-v="match"]');
    await page.waitForSelector('[data-gt="request"]');
    await page.click('#gt-rws .chip[data-v="same"]');
    await page.click('[data-gt="request"]');
    await page.waitForTimeout(700);
    const req = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_requests')).pop();
    ok(!!req && JSON.stringify(Object.keys(req.body).sort()) === '["headcount","want_school","when_pref"]' && req.body.want_school === 'same', '🔴 신청으로 보내는 칸은 인원·범위·시간대 셋뿐', req && req.body);
    ok(await page.locator('[data-gt="cancel-request"]').count() === 1, "'짝을 찾는 중' 카드와 취소 버튼");
    /* 서버가 짝을 맺었다 */
    const reqId = db.requests[0].id;
    db.requests[0].status = 'matched';
    const rid = db.nextId++;
    db.rooms.push({ id: rid, kind: 'match', post_id: null, opened_by: null, created_at: new Date().toISOString(), closed_at: null });
    db.members.push({ room_id: rid, user_id: ME, nickname: '테스터', last_read_at: new Date().toISOString(), left_at: null });
    db.members.push({ room_id: rid, user_id: U3, nickname: '경희사학', last_read_at: new Date().toISOString(), left_at: null });
    db.matches.push({ req_a: reqId, req_b: 77, room_id: rid, created_at: new Date().toISOString() });
    await page.evaluate(() => { gt.requests = null; });
    await page.click('.gt-tabs .chip[data-v="board"]');
    await page.click('.gt-tabs .chip[data-v="match"]');
    await page.waitForSelector('[data-gt="open-room-id"]');
    ok(/짝이 맺어졌어요/.test(await page.textContent('#gt-pane')), '짝이 되면 카드가 뜬다');
    await page.click('[data-gt="open-room-id"]');
    await page.waitForSelector('#gt-room');
    ok(Number(await page.getAttribute('#gt-room', 'data-room')) === rid && /경희사학/.test(await page.textContent('#gt-room .sheet-title')), '그 카드가 매칭 방을 연다');
    await page.evaluate(() => closeSheet());
    await page.waitForTimeout(300);
  }

  /* ───────────── [7] 차단 ───────────── */
  console.log('\n[7] 차단하면 그 사람 글이 사라진다');
  {
    await page.click('.gt-tabs .chip[data-v="board"]');
    await page.waitForSelector('.gt-post[data-post="12"]');
    await page.click('.gt-post[data-post="12"] [data-gt="block"]');
    await page.waitForTimeout(800);
    const blk = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_blocks')).pop();
    ok(!!blk && blk.body.blocked === U3, '차단 요청이 간다', blk && blk.body);
    ok(await page.locator('.gt-post[data-post="12"]').count() === 0, '그 글이 목록에서 사라진다');
    ok(await page.locator('.toast-undo').count() === 1, '되돌리기 단추가 있다');

    await page.click('.gt-post[data-post="11"] [data-gt="report"]');
    await page.waitForSelector('#gt-report');
    await page.click('#gt-reason .chip[data-v="광고"]');
    await page.fill('#gt-report-detail', '광고 글이에요');
    await page.click('[data-gt="report-send"]');
    await page.waitForTimeout(500);
    const rep = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_reports')).pop();
    ok(!!rep && rep.body.reason === '광고' && rep.body.post_id === 11 && rep.body.target_user === U2, '신고 본문은 사유·대상·글 번호', rep && rep.body);
    /* 대화방에서 신고하면 방 번호가 실린다 (운영자가 그 방을 찾는다 — 코드 리뷰) */
    await page.click('.gt-post[data-post="11"] [data-gt="open-room"]');
    await page.waitForSelector('#gt-room');
    const roomIdR = Number(await page.getAttribute('#gt-room', 'data-room'));
    await page.click('#gt-room [data-gt="report"]');
    await page.waitForSelector('#gt-report');
    await page.click('[data-gt="report-send"]');
    await page.waitForTimeout(500);
    const rep2 = received.filter((r) => r.method === 'POST' && r.path.startsWith('/rest/v1/gating_reports')).pop();
    ok(!!rep2 && rep2.body.room_id === roomIdR && rep2.body.target_user === U2, '대화방 신고에는 방 번호가 실린다', rep2 && rep2.body);
  }

  /* ───────────── [8] 🔴 개인정보 ───────────── */
  console.log('\n[8] 🔴 이름·학번·전화·주민등록번호·계좌가 과팅 경로로 한 번도 안 나간다');
  {
    const all = gatingReqs().map((r) => r.raw + ' ' + r.path).join('\n');
    ok(gatingReqs().length > 15, '  (준비) 과팅 요청을 실제로 여럿 모았다', gatingReqs().length);
    ok(!all.includes(RRN) && !/"rrn"/.test(all), '주민등록번호가 없다');
    ok(!all.includes(ACCOUNT) && !/"account"/.test(all), '계좌번호가 없다');
    ok(!all.includes(PHONE) && !/"phone"/.test(all), '전화번호가 없다');
    ok(!all.includes(NAME) && !/"name"/.test(all), '이름이 없다');
    ok(!all.includes('202312345') && !/studentId/.test(all), '학번이 없다');
    ok(!/"school"|"gender"|"nickname"/.test(gatingReqs().filter((r) => r.method === 'POST' && /gating_(posts|requests|messages)/.test(r.path)).map((r) => r.raw).join('\n')),
      '글·요청·메시지 본문에 학교·성별·닉네임을 넣지 않는다 (서버가 채운다)');
  }

  /* ───────────── [9] 탈퇴 ───────────── */
  console.log('\n[9] 탈퇴 — 과팅 프로필을 프로필보다 먼저 지운다');
  {
    const r = await page.evaluate(() => authDeleteData());
    ok(r && r.ok === true, '탈퇴가 된다', r);
    const gi = received.findIndex((x) => x.method === 'POST' && x.path.startsWith('/rest/v1/rpc/gating_forget_me'));
    const pi = received.findIndex((x) => x.method === 'DELETE' && x.path.startsWith('/rest/v1/profiles'));
    ok(gi >= 0 && pi >= 0 && gi < pi, '🔴 gating_forget_me(글·대화·차단·프로필 전부) 가 profiles DELETE 보다 먼저다', [gi, pi]);
    await ctx.close();
  }

  console.log('\n[10] 콘솔 오류');
  ok(errors.length === 0, '콘솔·페이지 오류 없음', errors.slice(0, 4));

  await browser.close();
  await new Promise((r) => sb.close(r));
  await new Promise((r) => gw.close(r));
  await new Promise((r) => onSrv.close(r));
  await new Promise((r) => offSrv.close(r));
  fs.rmSync(onDir, { recursive: true, force: true });
  fs.rmSync(offDir, { recursive: true, force: true });

  console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 과팅 탭 검증 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('DRIVER FAIL:', e); process.exit(1); });
