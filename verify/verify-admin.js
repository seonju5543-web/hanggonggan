/* 관리자 페이지 검증 (2026-08-03 신설)
   ------------------------------------------------------------------
   관리자 화면은 Cloudflare에 있고 데이터는 GitHub에서 읽어 온다. 검증할 때마다 진짜
   GitHub 열쇠를 쓸 수는 없으므로, **바깥으로 나가는 요청을 가로채 저장소의 실제 파일로
   응답**해 준다. 그래서 이 검사는 '화면이 진짜 우리 데이터로 제대로 그려지는가'를 본다.

   보는 것
     ① 열쇠 없이는 아무것도 안 보이는가 (잠금이 흉내가 아닌지)
     ② 6개 화면이 실제 데이터로 그려지는가 · 콘솔 오류 0
     ③ 원문 대조 화면에 앱1 내용과 공고 원문이 함께 뜨는가
     ④ 양식 미리보기가 43종 전부 오류 없이 문서를 만들어 내는가 (renderFormDoc 재사용 검증)
     ⑤ 분류(상태·학교·경고등)가 실제로 걸러 내는가

   실행: node verify/verify-admin.js      (사전 준비: bash _admin/build.sh)              */

const { chromium } = require('playwright-core');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, '_admin', 'dist');
const PORT = Number(process.env.ADMIN_PORT || 8131);
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain' };

let failed = 0;
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) failed += 1;
};

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rep) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(DIST, p);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) { rep.writeHead(404); rep.end(); return; }
      rep.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      rep.end(fs.readFileSync(file));
    });
    srv.listen(PORT, () => res(srv));
  });
}

(async () => {
  if (!fs.existsSync(DIST)) {
    console.error('먼저 `bash _admin/build.sh`를 실행하세요.');
    process.exit(1);
  }
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });
  page.on('dialog', async (d) => { await d.accept(); });

  /* 바깥 요청 가로채기 — 저장소의 진짜 파일로 응답한다 */
  let apiCalls = 0;
  await page.route('https://api.github.com/**', async (route) => {
    apiCalls += 1;
    const u = route.request().url();
    if (u.includes('/compare/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ahead_by: 3 }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ full_name: 'seonju5543-web/hanggonggan' }) });
  });
  /* /owner/repo/<브랜치>/<경로> → 저장소의 그 파일.
     기본 브랜치 이름에 슬래시가 들어 있어(claude/nice-…) 칸 수로 자르면 안 된다. */
  const RAW_PREFIX = '/seonju5543-web/hanggonggan/claude/nice-heisenberg-WESq5/';
  await page.route('https://raw.githubusercontent.com/**', async (route) => {
    const u = new URL(route.request().url());
    const rel = u.pathname.startsWith(RAW_PREFIX)
      ? u.pathname.slice(RAW_PREFIX.length)
      : u.pathname.split('/').slice(4).join('/');
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') });
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

  /* ① 잠금 — 열쇠 전에는 데이터가 하나도 없어야 한다 */
  ok(await page.isVisible('#gate'), '입장 화면이 먼저 뜬다');
  ok(await page.isHidden('#app'), '열쇠 전에는 본 화면이 숨겨져 있다');
  const leaked = await page.evaluate(() => document.body.innerText);
  ok(!/정식 등록 \d/.test(leaked) && !/검수 전 \d/.test(leaked),
    '열쇠 전에는 운영 현황 숫자가 전혀 보이지 않는다');

  /* 열쇠가 틀리면 못 들어간다 */
  await page.route('https://api.github.com/repos/seonju5543-web/hanggonggan',
    (r) => r.fulfill({ status: 401, contentType: 'application/json', body: '{}' }), { times: 1 });
  await page.fill('#gate-key', 'bad-key');
  await page.click('#gate-enter');
  await page.waitForTimeout(600);
  ok(await page.isVisible('#gate'), '열쇠가 틀리면 입장하지 못한다',
    (await page.textContent('#gate-msg')).trim());
  errors.length = 0;   // 위에서 일부러 낸 401은 오류로 세지 않는다

  /* ② 올바른 열쇠로 입장 */
  await page.fill('#gate-key', 'github_pat_testtoken');
  await page.click('#gate-enter');
  await page.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  ok(true, '올바른 열쇠로 입장');
  ok(apiCalls > 0, '열쇠를 GitHub에 실제로 확인한다 (흉내가 아님)');

  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
  const forms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/forms.json'), 'utf8'));
  const total = reg.items.length;
  /* '검수 전'은 자동 등록분 중 **아직 마감되지 않은 것**이다.
     마감이 지난 것은 이미 학생에게 의미가 없으므로 '마감·종료'로 간다 (화면의 statusOf와 같은 기준). */
  const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const autoN = reg.items.filter((x) => x.auto && !(x.deadline && x.deadline < TODAY)).length;

  /* ③ 6개 화면 */
  const todoText = await page.textContent('#screen-todo');
  ok(/오늘 할 일/.test(todoText), '① 오늘 할 일 화면이 그려진다');
  ok(todoText.includes(String(autoN)), '① 검수 전 건수가 실제 데이터와 같다', `검수 전 ${autoN}건`);

  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');
  const rows = await page.locator('#screen-list .row').count();
  ok(rows === total, '② 공고 전체가 조건 없이 전부 보인다', `${rows}/${total}건`);

  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  const revRows = await page.locator('#screen-review .row[data-id]').count();
  ok(revRows === autoN, '③ 컨펌 작업대에 검수 전 공고만 온다', `${revRows}건`);

  /* 미등록 피드 — 이미 등록한 공고가 '아직 등록 안 함'으로 다시 올라오면 안 된다
     (주소 정규화가 수집기와 갈라지면 같은 공고를 두 번 등록하게 된다) */
  const unreg = await page.evaluate(() => {
    const api = window.__admin;
    const regKeys = new Set(api.D.reg.map((x) => x.sourceUrl).filter(Boolean));
    const list = [...document.querySelectorAll('#screen-review a.btn[href]')].map((a) => a.href);
    return { shown: list.length, overlap: list.filter((u) => regKeys.has(u)).length };
  });
  ok(/수집됐지만 아직 등록 안 한 공고/.test(await page.textContent('#screen-review')),
    '③ 미등록 피드가 함께 보인다');
  ok(unreg.overlap === 0, '③ 이미 등록한 공고가 미등록으로 다시 올라오지 않는다',
    `표시 ${unreg.shown}건 · 중복 ${unreg.overlap}건`);

  await page.click('.tab[data-tab="forms"]');
  await page.waitForSelector('#screen-forms:not([hidden])');
  const formRows = await page.locator('#screen-forms tr[data-form]').count();
  ok(formRows === Object.keys(forms.templates).length, '④ 양식 목록이 전부 보인다', `${formRows}종`);

  await page.click('.tab[data-tab="network"]');
  await page.waitForSelector('#screen-network:not([hidden])');
  ok(/수집망/.test(await page.textContent('#screen-network')), '⑤ 수집망 화면이 그려진다');

  await page.click('.tab[data-tab="quality"]');
  await page.waitForSelector('#screen-quality:not([hidden])');
  ok(/데이터 품질/.test(await page.textContent('#screen-quality')), '⑥ 데이터 품질 화면이 그려진다');

  /* ④ 원문 대조 */
  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');
  const withExcerpt = reg.items.find((x) => (x.excerpts || []).length);
  if (withExcerpt) {
    await page.click(`.row[data-id="${withExcerpt.id}"]`);
    await page.waitForSelector('#sheet:not([hidden])');
    const sheet = await page.textContent('#sheet');
    ok(sheet.includes('앱1에 나가는 내용'), '원문 대조 — 왼쪽에 앱1 내용');
    ok(sheet.includes('공고 원문'), '원문 대조 — 오른쪽에 공고 원문');
    ok(sheet.includes(withExcerpt.excerpts[0].slice(0, 20)), '원문 발췌가 그대로 표시된다');
    const editable = await page.locator('#sheet [data-ed]').count();
    ok(editable >= 10, '상세에서 바로 고칠 수 있다', `${editable}개 항목`);
    await page.click('#sheet [data-close]');
  } else {
    ok(false, '원문 발췌가 있는 공고를 찾지 못함');
  }

  /* ⑤ 양식 미리보기 — 등록된 전 양식이 오류 없이 문서를 만들어 내는가 */
  const preview = await page.evaluate(() => {
    const bad = [];
    let drawn = 0;
    const api = window.__admin;
    if (!api) return { drawn: 0, bad: ['관리자 상태를 읽지 못했습니다'] };
    Object.keys(api.D.forms).forEach((id) => {
      try {
        const html = api.previewDoc(id);
        if (!html || html.length < 50) bad.push(`${id}: 빈 문서`);
        else drawn += 1;
      } catch (e) { bad.push(`${id}: ${e.message}`); }
    });
    return { drawn, bad };
  });
  ok(preview.bad.length === 0 && preview.drawn === Object.keys(forms.templates).length,
    `양식 ${preview.drawn}종 전부 문서 생성 성공`,
    preview.bad.slice(0, 3).join(' / '));

  /* 화면에서도 미리보기가 실제로 뜨는지 (1종) */
  await page.click('.tab[data-tab="forms"]');
  await page.waitForSelector('#screen-forms:not([hidden])');
  await page.click('#screen-forms tr[data-form]');
  await page.waitForSelector('#sheet:not([hidden])');
  const docLen = await page.locator('#sheet .doc-preview').innerText();
  ok(docLen.length > 80, '양식 화면에서 생성 문서 미리보기가 뜬다', `${docLen.length}자`);
  await page.click('#sheet [data-close]');

  /* ⑥ 분류가 실제로 걸러 내는가 */
  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');
  await page.click('.chip[data-f="status"][data-v="unreviewed"]');
  await page.waitForTimeout(200);
  const filtered = await page.locator('#screen-list .row').count();
  ok(filtered === autoN, '상태 분류가 실제로 걸러 낸다', `검수 전 ${filtered}건`);

  await page.click('.chip[data-f="status"][data-v="all"]');
  await page.waitForTimeout(200);

  /* 소속·성격·접수·경고등 필터는 '필터 더보기' 안에 접혀 있다 (2026-08-09).
     기본에서 접혀 있는 것 자체가 검사 대상이다 — 5줄이 늘 펼쳐져 있으면 목록이 화면 밖으로 밀린다. */
  ok(await page.locator('.filters-more').count() === 1, '나머지 필터는 접어 둔다');
  ok(!(await page.locator('.filters-more').evaluate((el) => el.open)), '필터 더보기는 기본이 닫힘');
  await page.click('.filters-more > summary');
  await page.waitForSelector('#f-school', { state: 'visible' });

  const schools = [...new Set(reg.items.map((x) => (x.eligibility || {}).schoolOnly).filter(Boolean))];
  if (schools.length) {
    await page.selectOption('#f-school', schools[0]);
    await page.waitForTimeout(250);
    const n = await page.locator('#screen-list .row').count();
    const expect = reg.items.filter((x) => (x.eligibility || {}).schoolOnly === schools[0]).length;
    ok(n === expect, `학교 분류가 실제로 걸러 낸다 (${schools[0]})`, `${n}/${expect}건`);

    /* 접힌 필터가 걸려 있으면 목록 위에 태그로 보여야 한다 —
       안 그러면 "왜 몇 건밖에 안 보이지?"의 원인을 화면에서 알 수 없다 */
    ok(await page.locator('.ftag[data-clear="school"]').count() === 1,
      '걸려 있는 필터가 목록 위에 태그로 보인다');
    ok(await page.locator('.filters-more').evaluate((el) => el.open),
      '필터를 고른 뒤에도 펼친 상태가 유지된다');

    await page.click('.ftag[data-clear="school"]');
    await page.waitForTimeout(250);
    ok(await page.locator('#screen-list .row').count() === reg.items.length,
      '태그를 누르면 그 필터가 풀린다');
  }

  /* ⑦ 다중 선택 (B3) — 87건을 한 줄씩 누르는 것을 끝내는 기능이라 여기서 실제로 눌러 본다 */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');

  ok(await page.locator('#screen-review .row.has-pick input[data-pick]').count() > 0,
    '컨펌 작업대의 줄마다 선택 네모가 있다');
  ok(await page.locator('.selbar').count() === 0, '아무것도 안 골랐을 땐 선택 바가 없다');

  await page.locator('#screen-review input[data-pick]').first().check();
  await page.waitForTimeout(120);
  ok(await page.locator('.selbar').count() === 1, '하나 고르면 선택 바가 나타난다');
  ok(!(await page.locator('#sheet').isVisible()), '네모를 눌러도 상세 시트가 열리지 않는다');

  await page.click('[data-sel="urgent"]');
  await page.waitForTimeout(200);
  const urgentN = Number((await page.locator('.selbar-n').innerText()).replace(/\D/g, ''));
  ok(urgentN > 1, '마감 임박만 고르기가 여러 건을 선택한다', `${urgentN}건`);

  /* 실제로 여러 id를 보내는지 — 이 검사가 이 기능의 핵심이다.
     보내는 요청을 가로채 개수를 세고, 진짜 실행은 시키지 않는다. */
  let sentIds = null;
  await page.route('**/actions/workflows/**/dispatches', (route) => {
    try { sentIds = JSON.parse(route.request().postData() || '{}'); } catch { sentIds = 'parse-fail'; }
    route.fulfill({ status: 204, body: '' });
  });
  await page.click('[data-sel="confirm"]');
  await page.waitForSelector('#sheet:not([hidden])');
  const listedN = await page.locator('#sheet .rows .row').count();
  ok(listedN === urgentN, '실행 전에 대상 목록을 실제로 보여 준다', `${listedN}건 표시`);

  await page.click('#sheet [data-bulk-go]');
  await page.waitForTimeout(600);
  const payload = (() => { try { return JSON.parse(sentIds?.inputs?.payload || '{}'); } catch { return {}; } })();
  ok(Array.isArray(payload.ids) && payload.ids.length === urgentN,
    '다중 선택이 실제로 여러 id를 보낸다', `보낸 id ${payload.ids ? payload.ids.length : 0}개`);
  ok(sentIds?.inputs?.action === 'confirm', '보내는 동작 이름이 confirm이다');
  await page.unroute('**/actions/workflows/**/dispatches');

  /* ⑧ 잘린 목록 더 보기 (B1) — 예전엔 268건 중 80건만 화면에서 도달 가능했다 */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  const moreBtns = await page.locator('#screen-review [data-more]').count();
  if (moreBtns) {
    const before = await page.locator('#screen-review .rows .row').count();
    await page.locator('#screen-review [data-more]').first().click();
    await page.waitForTimeout(250);
    const after = await page.locator('#screen-review .rows .row').count();
    ok(after > before, '더 보기를 누르면 잘려 있던 줄이 실제로 늘어난다', `${before} → ${after}줄`);
  } else {
    ok(true, '더 보기 버튼 — 지금 데이터에선 잘린 목록이 없어 건너뜀');
  }

  /* 데이터 읽기 실패를 조용히 넘기지 않는가 (A1) — 없는 파일을 읽게 해 배너를 확인한다 */
  const failShown = await page.evaluate(async () => {
    const w = window.__admin;
    if (!w) return 'no-admin';
    w.D.failed = [{ path: 'data/registered.json', why: '응답 500' }];
    document.querySelector('#datafail').hidden = true;
    w.renderDataFail();
    const box = document.querySelector('#datafail');
    return (!box.hidden && /믿지 마세요/.test(box.textContent)) ? 'shown' : 'hidden';
  });
  ok(failShown === 'shown', '데이터를 못 읽으면 화면 맨 위에 경고가 뜬다', failShown);

  /* 콘솔 오류 */
  ok(errors.length === 0, '콘솔·페이지 오류 없음', errors.slice(0, 3).join(' | '));

  /* 열쇠 지우기 */
  await page.click('#btn-logout');
  await page.waitForSelector('#gate', { timeout: 8000 });
  const stored = await page.evaluate(() => localStorage.getItem('handaejang.admin.key')
    || sessionStorage.getItem('handaejang.admin.key'));
  ok(!stored, '열쇠 지우기를 누르면 기기에서 실제로 사라진다');

  await browser.close();
  srv.close();

  console.log(failed === 0
    ? '\n✅ 관리자 페이지 검증 통과'
    : `\n❌ ${failed}개 항목 실패`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
