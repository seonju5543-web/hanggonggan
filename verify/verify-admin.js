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

  /* 푸시 발송 서버 — 이 샌드박스는 workers.dev에 닿지 못한다(프록시 차단).
     흉내 내 주지 않으면 콘솔에 연결 실패가 찍혀 '오류 없음' 검사가 깨진다.
     제품은 못 닿을 때 정직한 안내를 띄우므로 결함이 아니다(그 경로도 아래에서 확인한다). */
  await page.route('https://handaejang-push.seonju5543.workers.dev/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, configured: true, step: 'idle', lastError: null, subs: 2 }),
  }));

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
  /* 요청을 가로챈다. 보내기(dispatches)는 내용을 받아 적고, 그 뒤 '결과 기다리기'(runs)는
     **성공한 실행 하나**를 돌려준다 — 안 그러면 화면이 6분간 결과를 기다리며 `jobBusy` 잠금을
     붙들고 있어서, 이어지는 검사가 "앞선 작업이 아직 끝나지 않았어요"로 막힌다.
     (이 잠금은 제품이 옳게 동작하는 것이다. 검사가 그 사정을 몰랐던 것이 문제였다.) */
  const fakeRun = () => ({
    workflow_runs: [{
      id: 1, status: 'completed', conclusion: 'success',
      created_at: new Date(Date.now() + 5000).toISOString(),
      html_url: 'https://example.invalid/run',
    }],
  });
  await page.route('**/actions/workflows/**/runs**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(fakeRun()),
  }));

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
  /* 앞선 작업이 끝나야(jobBusy 해제) 다음 요청이 나간다 — 화면이 '반영 완료'라고 말할 때까지 기다린다 */
  await page.waitForFunction(() => /반영 완료/.test(document.querySelector('#job-text')?.textContent || ''),
    null, { timeout: 20000 });
  await page.unroute('**/actions/workflows/**/dispatches');

  /* ⑨ 화면에서 직접 등록 (C) — 관리자 화면의 목적 절반이 여기 있었다.
     예전 코드에는 "등록 버튼은 다음 단계에 붙습니다"라고 적혀 있었다. */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  ok(await page.locator('[data-reg-open]').count() > 0, '미등록 공고 줄에 등록 버튼이 있다');

  await page.locator('[data-reg-open]').first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  ok((await page.locator('#sheet #rg-name').inputValue()).length > 5,
    '등록 시트에 수집된 제목이 미리 채워진다');
  ok(await page.locator('#sheet .pane').count() === 2, '왼쪽 앱1 내용 · 오른쪽 공고 원문 두 칸으로 대조한다');
  ok(await page.locator('#sheet #rg-amountValue').inputValue() === '',
    '금액은 비워 둔다 (지어내지 않는다)');

  let regSent = null;
  await page.route('**/actions/workflows/**/dispatches', (route) => {
    try { regSent = JSON.parse(route.request().postData() || '{}'); } catch { regSent = 'parse-fail'; }
    route.fulfill({ status: 204, body: '' });
  });
  await page.click('#sheet [data-reg-go]');
  await page.waitForTimeout(600);
  const regPayload = (() => { try { return JSON.parse(regSent?.inputs?.payload || '{}'); } catch { return {}; } })();
  ok(regSent?.inputs?.action === 'register', '등록 동작을 보낸다');
  ok(!!(regPayload.notice && regPayload.notice.url), '보내는 내용에 공고 원문 주소가 들어 있다');
  ok(!!(regPayload.patch && regPayload.patch.name), '보내는 내용에 제목이 들어 있다');
  ok(!regPayload.patch?.amountValue, '확인하지 않은 금액은 보내지 않는다');
  await page.unroute('**/actions/workflows/**/dispatches');
  await page.unroute('**/actions/workflows/**/runs**');

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

  /* ⑩ 로봇 통제판 (E) — 로봇이 뭐라고 하는지 화면이 말해 주는가 */
  await page.route('**/api.github.com/repos/*/*/issues?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([
      { number: 9001, title: '🚨 관리자 화면이 잠기지 않았습니다', html_url: 'https://example.invalid/1', created_at: '2026-08-09T00:00:00Z', comments: 0 },
      { number: 9002, title: '🔧 원문 주소를 3회 못 찾은 공고 1건', html_url: 'https://example.invalid/2', created_at: '2026-08-05T00:00:00Z', comments: 0 },
      { number: 9003, title: '🤖 장학공고 수집 리포트 2026-08-08 (새 공고 14건)', html_url: 'https://example.invalid/3', created_at: '2026-08-08T00:00:00Z', comments: 3 },
    ]),
  }));
  await page.click('.tab[data-tab="robots"]');
  await page.waitForSelector('#screen-robots:not([hidden])');
  await page.waitForFunction(() => !/불러오는 중/.test(document.querySelector('#robot-issues')?.textContent || ''),
    null, { timeout: 10000 });

  const issueText = await page.textContent('#robot-issues');
  ok(/잠기지 않았습니다/.test(issueText), '🚨 경보를 맨 위에 보여 준다');
  ok(/원문 주소를 3회/.test(issueText), '🔧 조치 요청도 함께 보여 준다');
  ok(/수집 리포트 1건/.test(issueText), '수집 리포트는 접어 둔다 (경보가 묻히지 않게)');
  ok(await page.locator('#n-robots').textContent() === '2', '탭 배지가 경보 건수를 센다 (리포트는 안 센다)');
  ok(await page.locator('#screen-robots [data-run]').count() >= 12, '로봇 12종 이상에 실행 버튼이 있다');
  ok(await page.locator('#screen-robots [data-report]').count() === 5, '리포트 5종을 볼 수 있다');

  await page.waitForFunction(() => !/확인하는 중/.test(document.querySelector('#push-health')?.textContent || ''),
    null, { timeout: 10000 });
  const bare = (t) => (t || '').replace(/['’‘"“”]/g, '');   // 화면 문구의 따옴표는 무시하고 본다
  const pushText = bare(await page.textContent('#push-health'));
  ok(/등록된 폰/.test(pushText) && /살아 있는 폰 수가 아닙니다/.test(pushText),
    '푸시 서버 상태와 그 한계를 함께 보여 준다');

  /* 못 닿을 때 '정상'으로 보이면 안 된다 — 이 화면 전체의 규칙 */
  const pushFail = await page.evaluate(async () => {
    const box = document.querySelector('#push-health');
    const orig = window.fetch;
    window.fetch = () => Promise.reject(new Error('연결 실패'));
    await window.__admin.loadPushHealth();
    window.fetch = orig;
    return box.textContent;
  });
  ok(/읽지 못했습니다/.test(bare(pushFail)) && /정상으로 보지 마세요/.test(bare(pushFail)),
    '푸시 상태를 못 읽으면 정상으로 보지 말라고 말한다');

  /* 🔴 이 화면의 존재 이유가 '로봇이 뭐라고 하는지'다 —
     못 읽었을 때 '아무 말 없음'으로 보이면 화면이 거짓말하는 것이다 */
  const failText = await page.evaluate(async () => {
    const box = document.querySelector('#robot-issues');
    box.innerHTML = '<p class="muted">불러오는 중…</p>';
    const orig = window.fetch;
    window.fetch = () => Promise.reject(new Error('네트워크 끊김'));
    await window.__admin.loadRobotIssues();
    window.fetch = orig;
    return box.textContent;
  });
  ok(/읽지 못했습니다/.test(failText) && /아무 말 없음이 아닙니다/.test(failText.replace(/[''"]/g, '')),
    '로봇 소식을 못 읽으면 그렇다고 말한다 (조용히 비우지 않는다)');
  await page.unroute('**/api.github.com/repos/*/*/issues?**');

  /* ⑪ 키보드·읽어 주기 (B6) — 예전엔 상세를 **마우스로만** 열 수 있었다.
     마우스를 한 번도 쓰지 않고 조작되는지 실제로 눌러 본다. */
  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');

  const openedByKey = await page.evaluate(() => {
    const row = document.querySelector('#screen-list .row[data-id]');
    if (!row) return 'no-row';
    row.focus();
    if (document.activeElement !== row) return 'not-focusable';
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return 'sent';
  });
  await page.waitForTimeout(300);
  ok(openedByKey === 'sent' && await page.isVisible('#sheet'),
    '목록 줄에 초점이 가고 Enter로 상세가 열린다', openedByKey);

  ok(await page.locator('#sheet').getAttribute('aria-modal') === 'true',
    '시트가 대화상자로 알려진다 (aria-modal)');
  ok(await page.evaluate(() => document.querySelector('#sheet').contains(document.activeElement)),
    '시트를 열면 초점이 시트 안으로 들어간다');

  /* 초점 가두기 — Tab이 뒤 화면으로 새 나가면 키보드 사용자가 길을 잃는다 */
  const trapped = await page.evaluate(() => {
    const sheet = document.querySelector('#sheet');
    const f = [...sheet.querySelectorAll('input, select, textarea, button, [href]')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return 'no-focusable';
    f[f.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    return sheet.contains(document.activeElement) ? 'kept' : 'escaped';
  });
  ok(trapped === 'kept', '시트 안에서 Tab이 뒤 화면으로 새지 않는다', trapped);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => {
    const a = document.activeElement;
    return !!(a && a.matches && a.matches('#screen-list .row[data-id]'));
  }), '시트를 닫으면 초점이 원래 줄로 돌아온다');

  /* 탭 줄 — 좌우 화살표와 aria-selected */
  ok(await page.locator('.tab[data-tab="list"]').getAttribute('aria-selected') === 'true',
    '지금 보고 있는 탭이 aria-selected로 표시된다');
  await page.evaluate(() => {
    const t = document.querySelector('.tab[data-tab="list"]');
    t.focus();
    document.querySelector('#tabs').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(250);
  ok(await page.locator('.tab[data-tab="review"]').getAttribute('aria-selected') === 'true',
    '좌우 화살표로 탭을 넘길 수 있다');

  ok(await page.locator('#job').getAttribute('aria-live') === 'polite'
    && await page.locator('#toast').getAttribute('aria-live') === 'polite',
    '진행·알림 표시가 읽어 주기에 잡힌다 (aria-live)');

  /* ⑫ 정렬 (B2) — 예전엔 어디에도 사용자 정렬이 없었다 */
  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');
  ok(await page.locator('[data-sort]').count() >= 4, '정렬 버튼이 있다');

  const firstBy = async () => (await page.locator('#screen-list .row .t').first().innerText()).trim();
  await page.click('[data-sort="name"]');
  await page.waitForTimeout(250);
  const asc = await firstBy();
  await page.click('[data-sort="name"]');           // 같은 것을 다시 누르면 방향이 뒤집힌다
  await page.waitForTimeout(250);
  const desc = await firstBy();
  ok(asc !== desc, '같은 정렬을 다시 누르면 방향이 뒤집힌다', `${asc.slice(0, 14)} ↔ ${desc.slice(0, 14)}`);

  /* 마감 없는 공고가 맨 위를 차지하면 급한 것이 안 보인다 */
  await page.click('[data-sort="deadline"]');
  await page.waitForTimeout(250);
  ok(!/기한|미확인/.test(await firstBy()) , '마감 임박순에서 기한 미확인이 맨 위에 오지 않는다');

  /* ⑬ 되돌릴 수 없는 동작의 확인 (B5) — window.confirm이 아니라 대상을 보여 주는 시트 */
  /* '되돌리기'는 **검수 전 공고에만** 붙는다 — 아무 줄이나 고르면 그 버튼이 없다.
     그래서 컨펌 작업대(전부 검수 전)에서 연다. */
  await page.evaluate(() => { window.__confirmUsed = 0; const o = window.confirm;
    window.confirm = () => { window.__confirmUsed += 1; return false; }; window.__origConfirm = o; });
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  await page.click('#screen-review .row[data-id]');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.click('#sheet [data-act="revert"]');
  await page.waitForTimeout(400);

  const askText = await page.textContent('#sheet');
  const usedConfirm = await page.evaluate(() => { window.confirm = window.__origConfirm; return window.__confirmUsed; });
  ok(usedConfirm === 0, '되돌리기에 브라우저 기본 confirm을 쓰지 않는다');
  ok(/차단/.test(askText) && /되돌리기/.test(askText),
    '되돌리기 확인 화면이 무엇을 하는지 보여 준다');
  ok(await page.locator('#sheet .rows .row').count() >= 1, '어느 공고인지 목록으로 보여 준다');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  /* ⑭ 밝게/어둡게 (B8) — CSS 훅은 있었는데 아무도 값을 안 넣어 죽어 있었다 */
  const themeStart = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.click('#btn-theme');
  await page.waitForTimeout(200);
  const themeNext = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  ok(themeStart !== themeNext, '테마 버튼이 실제로 화면 밝기를 바꾼다', `${themeStart} → ${themeNext}`);
  ok(await page.evaluate(() => localStorage.getItem('handaejang.admin.theme')) === themeNext,
    '고른 밝기를 기억한다');

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
