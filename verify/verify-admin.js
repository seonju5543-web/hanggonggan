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

   실행: node verify/verify-admin.js      (준비 필요 없음 — 관리자 화면을 스스로 빌드한다)  */

const { chromium } = require('playwright-core');
const { spawnSync } = require('node:child_process');
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
/* 🔴 **화면을 찾아가는 주소는 '모양'이 아니라 '표식'으로 쓴다** (2026-09-13).
   이 검사 124개가 지키는 것은 대부분 *뜻*이다 — "확인하지 않은 금액은 보내지 않는다",
   "시트를 닫으면 초점이 원래 줄로 돌아온다" 처럼 화면이 어떻게 생겼든 성립해야 하는 것들이다.
   그런데 그 뜻에 닿는 주소를 `.row`·`.card`·`.group-head` 같은 **클래스 이름**으로 적어 두면,
   화면을 다시 짜는 순간 검사가 통째로 깨진다(전면 교체 전 실측: 모양에 묶인 주소 35곳).
   그래서 admin.js 가 뜻을 가진 표식을 내보내고 여기서는 그것만 쓴다:
     [data-row] 공고 한 줄 · [data-row-title] 그 줄의 이름 · [data-rows] 줄 묶음
     [data-group] 구획 · [data-group-head] 구획 제목 · [data-selbar] 선택 바
     [data-pane="app"|"source"] 대조 두 칸 · [data-stat] 숫자 카드
     (이미 있던 것) [data-id] [data-pick] [data-sort] [data-f] [data-act]
   ⚠️ 표식을 새로 만들 때는 **화면이 바뀌어도 남을 이름**인지 먼저 묻는다.
      `data-blue-card` 같은 건 모양이라 또 깨진다. */

/* 🔴 **화면이 줄어도 검사가 지키는 '뜻' 은 그대로다** (2026-09-13 · 탭 8개 → 5개).
   양식은 「목록」의 보기 전환으로, 수집망은 「로봇」 안으로, 데이터 품질은 「할 일」 안으로
   들어갔다. 그래서 아래 검사들은 **주장 문장을 한 글자도 안 바꾸고** 가는 길만 바꾼다.
   ⚠️ 검사를 지우지 않았다 — 지우면 그만큼 덜 보는 것이다. */
async function openList(page) {
  await page.click('.tab[data-tab="list"]');
  await page.waitForSelector('#screen-list:not([hidden])');
}
async function gotoForms(page) {
  await openList(page);
  await page.click('[data-lview="forms"]');
  await page.waitForSelector('#screen-list tr[data-form]', { timeout: 5000 }).catch(() => {});
}
/* 🔴 보기 전환('공고'/'양식')은 화면을 옮겨도 남는다 — 앞선 검사가 '양식' 으로 두고 갔으면
   목록 탭만 눌러서는 공고 줄이 없다(실제로 여기서 멈췄다). 공고 보기까지 확실히 간다. */
async function gotoNotices(page) {
  await openList(page);
  await page.click('[data-lview="notices"]');
  await page.waitForSelector('#screen-list [data-row]', { timeout: 5000 }).catch(() => {});
}

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
  /* 🔴 **사람이 미리 준비해야 하는 검사는 관문이 못 된다.** 예전엔 dist 가 없으면 여기서 멈춰,
     이 드라이버를 어떤 워크플로에도 걸 수 없었다 — 그래서 실제로 3항목이 빨간불인 채
     아무도 모르고 방치돼 있었다(2026-09-09 발견). 지금은 **스스로 빌드한다.**
     ⚠️ 늘 새로 빌드한다 — 남아 있는 옛 dist 로 돌면 지금 코드가 아니라 옛 화면을 검사한다. */
  {
    const r = spawnSync('bash', [path.join(ROOT, '_admin/build.sh')], { cwd: ROOT, encoding: 'utf8' });
    if (r.status !== 0) {
      console.error('관리자 화면 빌드 실패 — _admin/build.sh 를 보세요.');
      console.error((r.stderr || '') + (r.stdout || ''));
      process.exit(1);
    }
  }
  if (!fs.existsSync(DIST)) {
    console.error('빌드는 끝났는데 _admin/dist 가 없습니다 — build.sh 의 출력 경로를 보세요.');
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
  let PAGE_ITEMS = null;   // 화면이 실제로 받은 목록 (아래 raw 가로채기가 채운다)
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
    /* 검사용 준비 카드(아래)의 그림은 저장소에 없다 — 404 가 콘솔 오류로 남지 않게 빈 그림으로 답한다 */
    if (rel.startsWith('insta/pub/verify-insta-1/')) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: '' });
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: '' });
    let body = fs.readFileSync(f, 'utf8');
    /* 🔴 검수 대기가 0건이면 '컨펌 작업대'와 '다중 선택' 검사가 **조용히 사라진다**
       (2026-08-14에 실제로 그렇게 됐다 — 밀린 105건을 전부 검수하자 두 항목이 실패했다).
       검수 대기 0건은 우리가 바라는 상태이므로, 그때도 그 기능이 살아 있는지는 확인해야 한다.
       그래서 **검사용 대기 공고 2건을 끼워 넣는다.** 저장소 데이터는 건드리지 않는다. */
    if (rel === 'data/registered.json') {
      const db = JSON.parse(body);
      if (!db.items.some((x) => x.auto)) {
        for (const n of [1, 2]) db.items.push({
          id: `verify-pending-${n}`, name: `검사용 대기 공고 ${n}`, type: '교외',
          provider: '검사용', amount: '금액 원문 확인', amountValue: 0,
          /* 마감을 가깝게 둔다 — '마감 임박만 고르기'가 실제로 여러 건을 잡는지 봐야 하므로 */
          deadline: new Date(Date.now() + 9 * 3600e3 + n * 86400e3).toISOString().slice(0, 10),
          period: '접수 기간 원문 확인',
          summary: '검사 드라이버가 끼워 넣은 항목입니다(저장소에는 없습니다).',
          documents: ['원문 공고에서 확인'], eligibility: { selective: true },
          noForm: '검사용', auto: true, attachments: [],
          sourceUrl: `https://example.ac.kr/view.do?seq=${900 + n}`,
          sourceKind: 'auto', listedAt: '2026-08-14',
        });
        body = JSON.stringify(db);
      }
      PAGE_ITEMS = JSON.parse(body).items;   // 화면이 실제로 받은 목록 — 아래 건수 비교는 전부 이걸 기준으로 한다
    }
    /* 인스타 — 게시 대기가 0건이면 '게시·카드 보기' 검사가 조용히 사라진다(위 검수 대기와 같은 유형).
       검사용 준비 카드를 끼워 넣는다. 저장소 장부는 건드리지 않는다. */
    if (rel === 'insta/seen.json') {
      const db = JSON.parse(body);
      db.prepared = db.prepared || [];
      if (!db.prepared.some((x) => x.status === 'prepared')) db.prepared.push({
        status: 'prepared', code: 'verify-insta-1', org: '검사용', name: '검사용 카드', due: new Date(Date.now() + 9 * 3600e3 + 5 * 86400e3).toISOString().slice(0, 10),
        tplNo: 1, dir: 'insta/pub/verify-insta-1', at: '2026-09-12', cards: 4 });
      body = JSON.stringify(db);
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body });
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

  const regFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
  /* 화면이 받은 목록으로 비교한다 — 검사용 대기 공고를 끼워 넣었을 수 있다(위 참조).
     파일로 비교하면 끼워 넣은 만큼 건수가 어긋나 멀쩡한 화면이 실패로 읽힌다. */
  const reg = { ...regFile, items: PAGE_ITEMS || regFile.items };
  const forms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/forms.json'), 'utf8'));
  const total = reg.items.length;
  /* '검수 전'은 자동 등록분 중 **아직 마감되지 않은 것**이다.
     마감이 지난 것은 이미 학생에게 의미가 없으므로 '마감·종료'로 간다 (화면의 statusOf와 같은 기준). */
  const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  /* 🔴 화면의 statusOf 와 **같은 기준**으로 센다 — 마감이 지난 자동 등록분은 '검수 전'이 아니라
     '마감·종료'다. 예전엔 가로채기 안에서 `.filter((x) => x.auto)` 로만 세어 마감분까지 넣었고,
     그 값이 늘 채워져 아래 마감 조건은 **한 번도 실행되지 않는 죽은 줄**이었다. 그래서 마감된
     자동 등록분이 하나라도 생기는 날 이 검사가 앱을 탓하며 빨간불이 됐다(실제로 4건이 되자 그랬다). */
  const autoN = reg.items.filter((x) => x.auto && !(x.deadline && x.deadline < TODAY)).length;

  /* ③ 6개 화면 */
  const todoText = await page.textContent('#screen-todo');
  ok(/오늘 할 일/.test(todoText), '① 오늘 할 일 화면이 그려진다');
  ok(todoText.includes(String(autoN)), '① 검수 전 건수가 실제 데이터와 같다', `검수 전 ${autoN}건`);

  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  const rows = await page.locator('#screen-list [data-row]').count();
  ok(rows === total, '② 공고 전체가 조건 없이 전부 보인다', `${rows}/${total}건`);

  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  const revRows = await page.locator('#screen-review [data-row]').count();
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

  await gotoForms(page);
  const formRows = await page.locator('#screen-list tr[data-form]').count();
  ok(formRows === Object.keys(forms.templates).length, '④ 양식 목록이 전부 보인다', `${formRows}종`);

  await page.click('.tab[data-tab="robots"]');
  await page.waitForSelector('#screen-robots:not([hidden])');
  ok(/수집망/.test(await page.textContent('#screen-robots')), '⑤ 수집망 화면이 그려진다');

  await page.click('.tab[data-tab="todo"]');
  await page.waitForSelector('#screen-todo:not([hidden])');
  ok(/데이터 품질/.test(await page.textContent('#screen-todo')), '⑥ 데이터 품질 화면이 그려진다');

  /* 줄마다 같은 말을 되풀이하지 않는다 (2026-09-13)
     🔴 실측: 「컨펌 작업대」 14줄이 전부 '검수 전' 이었고, 10줄이 '마감일 없음' 을
     배지와 오른쪽 칸에 **두 번** 달고 있었다. 줄마다 다른 것은 제목뿐인데 같은 말이
     줄 수만큼 반복돼 정작 제목이 묻혔다. */
  {
    await page.click('.tab[data-tab="review"]');
    await page.waitForSelector('#screen-review:not([hidden])');
    const rep = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#screen-review [data-row]')];
      const n = rows.length;
      const withStatus = rows.filter((r) => /검수 전/.test(r.textContent)).length;
      const twice = rows.filter((r) => (r.textContent.match(/마감일 없음/g) || []).length > 1).length;
      return { n, withStatus, twice };
    });
    ok(rep.n >= 3 && rep.withStatus === 0,
      '전부 같은 상태면 줄마다 되풀이하지 않는다', `${rep.n}줄 중 상태를 되풀이한 줄 ${rep.withStatus}`);
    ok(/이 목록은 전부/.test(await page.textContent('#screen-review')),
      '대신 머리줄에 한 번 적는다');
    ok(rep.twice === 0, "한 줄 안에서 '마감일 없음' 을 두 번 말하지 않는다", `${rep.twice}줄`);
  }

  /* ⑥-2 같은 원인을 한 줄로 묶는다 (2026-09-13)
     🔴 실측으로 경고 11건 = 서로 다른 원인 2개였고, 그중 하나가 10건이었다.
     예전에는 한 글자도 안 다른 같은 문장이 열 줄을 채웠다. */
  {
    const q = await page.textContent('#screen-todo');
    const groups = await page.locator('#screen-todo [data-pgroup]').count();
    /* 규칙을 베끼지 않고 원본을 불러 센다 — 화면이 쓰는 것과 같은 파일이다 */
    const { checkEntry } = require('./entry-rules.cjs');
    const formIdSet = new Set(Object.keys(forms.templates));
    const warnN = reg.items.reduce((n, it) => n + (checkEntry(it, { formIds: formIdSet }) || []).length, 0);
    ok(groups > 0 && groups < warnN,
      '같은 원인은 한 줄로 묶는다', `원인 ${groups}가지 / 지적 ${warnN}건`);
    ok(await page.locator('#screen-todo [data-fixrun]').count() >= 1,
      '로봇이 고칠 수 있는 원인에는 그 자리에 버튼이 있다');
    /* 🔴 코드 지식이 없는 개발자가 읽는 화면이다 — 파일 이름과 push 를 시키지 않는다 */
    ok(!/run-[a-z-]+\.txt|수정 후 push|git |커밋/.test(q),
      "화면이 '파일을 고쳐서 push 하라'고 시키지 않는다");
    /* 0건은 카드로 자리를 먹지 않는다 — 두 화면에 같은 규칙이 적용되는지 본다 */
    for (const [tab, name] of [['todo', '오늘 할 일'], ['todo', '할 일(데이터 품질 포함)']]) {
      await page.click(`.tab[data-tab="${tab}"]`);
      await page.waitForSelector(`#screen-${tab}:not([hidden])`);
      const zero = await page.evaluate((t) => [...document.querySelectorAll(`#screen-${t} [data-stat] .v`)]
        .filter((el) => el.textContent.trim() === '0').length, tab);
      ok(zero === 0, `${name} — 0건은 카드로 자리를 먹지 않는다`);
    }
    await page.click('.tab[data-tab="todo"]');
  await page.waitForSelector('#screen-todo:not([hidden])');
  }

  /* ⑦ 인스타 (2026-09-12) — 게시 대기 · 판형 번호 · 트랙션 · 댓글이 한 화면에 */
  await page.click('.tab[data-tab="insta"]');
  await page.waitForSelector('#screen-insta:not([hidden])');
  const igText = await page.textContent('#screen-insta');
  ok(/게시 대기/.test(igText) && /트랙션/.test(igText) && /댓글/.test(igText) && /판형/.test(igText),
    '⑦ 인스타 화면에 게시 대기·판형·트랙션·댓글 구획이 다 있다');
  const igTpls = JSON.parse(fs.readFileSync(path.join(ROOT, 'insta/templates.json'), 'utf8')).templates;
  const igTplCards = await page.locator('#screen-insta .ig-tpl-card').count();
  ok(igTplCards === igTpls.length, '⑦ 판형이 번호 전부 보인다', `${igTplCards}/${igTpls.length}벌`);
  for (const t of igTpls) ok(igText.includes(`${t.no}번 ${t.name}`), `⑦ ${t.no}번 ${t.name} 이 번호와 함께 적힌다`);
  const igRows = await page.locator('#screen-insta [data-ig-publish]').count();
  ok(igRows >= 1, '⑦ 게시 대기 카드에 게시 버튼이 있다', `${igRows}건`);
  /* 게시 버튼은 바로 쏘지 않고 **한 번 더 묻는다** — 되돌릴 수 없는 일이다 */
  const apiBefore = apiCalls;
  await page.locator('#screen-insta [data-ig-publish]').first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  ok(/인스타에 게시/.test(await page.textContent('#sheet')), '⑦ 게시 버튼이 먼저 확인 시트를 연다');
  ok(apiCalls === apiBefore, '⑦ 확인 전에는 워크플로를 깨우지 않는다');
  await page.click('#sheet [data-close]');
  await page.waitForSelector('#sheet', { state: 'hidden' });
  /* 카드 보기 시트 — 그림 줄 + 캡션 자리 */
  await page.locator('#screen-insta [data-ig-view]').first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  ok(await page.locator('#sheet .ig-strip').count() === 1 && await page.locator('#sheet #ig-caption').count() === 1,
    '⑦ 카드 보기 시트에 그림 줄과 캡션이 있다');
  await page.click('#sheet [data-close]');
  await page.waitForSelector('#sheet', { state: 'hidden' });
  /* 판형 고르기 — 관리자 화면의 step 글자가 워크플로 선택지와 같은가는 verify-insta C11 이 본다 */
  const igSel = await page.locator('#screen-insta select.ig-tpl').first().locator('option').count();
  ok(igSel === igTpls.length, '⑦ 판형 고르기에 번호가 전부 있다', `${igSel}개`);

  /* 지원 자격 미확보 — 고치는 자리는 상세에 있었는데 **몇 건인지 세는 자리가 없어서**
     76건이 밀려 있어도 화면이 조용했다(2026-08-12). 학생 앱과 같은 칸으로 센다. */
  const noEligN = reg.items.filter((x) => !(x.eligibilityLines || []).length && !x.eligibilityVerified).length;
  const eligCard = await page.locator('#screen-todo [data-stat]', { hasText: '지원 자격 미확보' }).first().textContent();
  ok(/지원 자격 미확보/.test(eligCard || ''), '⑥ 지원 자격 미확보 건수를 센다');
  ok((eligCard || '').includes(String(noEligN)), '⑥ 그 건수가 실제 데이터와 같다', `${noEligN}건`);

  /* ④ 원문 대조 */
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  const withExcerpt = reg.items.find((x) => (x.excerpts || []).length);
  if (withExcerpt) {
    /* 🔴 **화면을 정해서 집는다.** 「할 일」이 데이터 품질을 품으면서 같은 공고 줄이
       접힌 <details> 안에도 생겼고, 화면을 안 정하면 그 **안 보이는 줄**을 집어 멈춘다
       (실제로 여기서 멈췄다). 보고 있는 화면 안에서 찾는다. */
    await page.click(`#screen-list [data-row][data-id="${withExcerpt.id}"]`);
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

  /* ④-1a 코드 리뷰가 잡은 일곱 (2026-09-13) — 전부 내가 전면 교체하며 만든 것이다.
     되돌아오면 빨간불이 뜨게 못 박는다. */
  {
    /* ① 화면이 사라진 곳을 가리키는 버튼 → 누르면 **빈 화면**(오류도 안 난다) */
    await page.click('.tab[data-tab="todo"]');
    await page.waitForSelector('#screen-todo:not([hidden])');
    const goTargets = await page.evaluate(() => [...document.querySelectorAll('#app [data-go]')]
      .map((b) => b.dataset.go));
    const known = ['todo', 'review', 'list', 'robots', 'insta'];
    ok(goTargets.every((g) => known.includes(g)),
      '화면으로 보내는 버튼이 전부 살아 있는 화면을 가리킨다', goTargets.join(',') || '없음');
    /* 그리고 모르는 이름이 와도 갇히지 않는다 */
    const survived = await page.evaluate(() => {
      const el = document.createElement('button');
      el.dataset.go = '없는화면';
      document.getElementById('screen-todo').appendChild(el);
      el.click();
      const v = [...document.querySelectorAll('section.screen')].filter((x) => !x.hidden).length;
      el.remove();
      return v;
    });
    ok(survived >= 1, '모르는 화면 이름을 눌러도 빈 화면에 갇히지 않는다', `보이는 화면 ${survived}개`);

    /* ② 같은 id 가 둘이면 byId 가 첫 번째만 집어, 누른 버튼 아래는 빈 채로 남는다 */
    await page.click('.tab[data-tab="robots"]');
    await page.waitForSelector('#screen-robots:not([hidden])');
    const dupIds = await page.evaluate(() => {
      const seen = {}, dup = [];
      document.querySelectorAll('#app [id]').forEach((el) => {
        if (seen[el.id]) dup.push(el.id); else seen[el.id] = 1;
      });
      return [...new Set(dup)];
    });
    ok(dupIds.length === 0, '화면 안에 같은 id 가 두 번 나오지 않는다', dupIds.join(',') || '없음');

    /* ⑦ 성공이 '못 읽음' 과 같은 색으로 보이면 안 된다 */
    const pillGood = await page.evaluate(() => {
      const el = document.createElement('span');
      el.className = 'pill good'; el.textContent = 'x';
      document.body.appendChild(el);
      const c = getComputedStyle(el).backgroundColor;
      el.remove();
      const p2 = document.createElement('span');
      p2.className = 'pill'; p2.textContent = 'x';
      document.body.appendChild(p2);
      const base = getComputedStyle(p2).backgroundColor;
      p2.remove();
      return { c, base };
    });
    ok(pillGood.c !== pillGood.base, "'성공' 알약이 보통 알약과 다른 색이다", pillGood.c);

    /* ⑤ 모아 둔 수정을 시트가 보여 준다 — 안 보이면 다음 저장이 옛 값으로 덮어쓴다 */
    await gotoNotices(page);
    const tid = await page.evaluate(() => window.__admin.D.reg[0].id);
    await page.click(`#screen-list [data-row][data-id="${tid}"]`);
    await page.waitForSelector('#sheet:not([hidden])');
    await page.fill('#sheet [data-ed="note"]', '리뷰 확인용 메모');
    await page.click('#sheet [data-act="save"]');
    await page.waitForTimeout(300);
    await page.click(`#screen-list [data-row][data-id="${tid}"]`);
    await page.waitForSelector('#sheet:not([hidden])');
    const shown = await page.inputValue('#sheet [data-ed="note"]');
    ok(shown === '리뷰 확인용 메모', '다시 열면 모아 둔 수정이 그대로 보인다', shown.slice(0, 20));
    await page.click('#sheet [data-close]');
    await page.click('[data-act="flush-drop"]');
    await page.waitForTimeout(200);
  }

  /* ④-1b 작업대 — 대조 폭 · 이어서 처리 · 모르는 칸 (2026-09-13) */
  {
    await gotoNotices(page);
    /* 비어 있는 칸이 있는 공고를 고른다 — 없으면 이 검사가 헛돈다 */
    const missId = await page.evaluate(() => {
      const A = window.__admin;
      const hit = A.D.reg.find((x) => !x.deadline || !x.amountValue);
      return hit ? hit.id : null;
    });
    if (missId) {
      await page.click(`#screen-list [data-row][data-id="${missId}"]`);
      await page.waitForSelector('#sheet:not([hidden])');
      ok(await page.locator('#sheet .field-first').count() === 1,
        '모르는 칸이 맨 위에 선다 (배지로 알리지 않고 그 자리를 준다)');
      const order = await page.evaluate(() => {
        const first = document.querySelector('#sheet .field-first');
        const eds = [...document.querySelectorAll('#sheet [data-ed]')];
        return { top: eds.findIndex((e) => first && first.contains(e)), total: eds.length };
      });
      ok(order.top === 0, '그 칸이 다른 칸보다 먼저 온다', `${order.total}칸 중 ${order.top + 1}번째`);
      /* 🔴 대조 폭 — 이 도구의 본업이 '원문과 등록 내용을 나란히 보는 것' 이다.
         예전에는 760px 서랍 안 2단이라 한 칸이 약 355px 이었다. */
      const w = await page.evaluate(() => {
        const p2 = document.querySelector('#sheet [data-pane="source"]');
        return p2 ? Math.round(p2.getBoundingClientRect().width) : 0;
      });
      ok(w >= 480, '넓은 화면에서 원문 읽는 폭이 넉넉하다', `${w}px`);
      /* 이어서 처리 — 시트를 닫고 목록에서 같은 줄을 다시 찾지 않아도 된다 */
      const hasNext = await page.locator('#sheet [data-act="next"]').count();
      if (hasNext) {
        const before = await page.textContent('#sheet .sheet-head h3');
        await page.click('#sheet [data-act="next"]');
        await page.waitForTimeout(400);
        const after = await page.textContent('#sheet .sheet-head h3');
        ok(before !== after, '다음 공고로 바로 넘어간다');
        ok(!(await page.isHidden('#sheet')), '넘어갈 때 시트가 닫히지 않는다');
      } else {
        ok(false, '다음 공고 버튼이 없다');
      }
      await page.click('#sheet [data-close]');
    } else {
      ok(false, '비어 있는 칸이 있는 공고를 찾지 못함 (검사가 헛돈다)');
    }
  }

  /* ④-2 저장해 둔 공고 원문 (2026-09-13)
     🔴 **집에 있는 원문을 두고 새 탭으로 학교 게시판을 다시 찾아가고 있었다.**
     `collector/extracted/notices-text.json` 에 공고 전문이 있는데 화면이 안 읽고 있었다.
     ⚠️ 여기서 **건수를 센다** — '원문 칸이 있다' 만 보면 한 건도 안 뜨는 상태로 통과한다
        (이 저장소가 여러 번 당한 '조용한 실패'). 최소 건수를 못 박는다. */
  const srcCount = await page.evaluate(async () => {
    const A = window.__admin;
    if (!A || !A.ensureSources) return null;
    const st = await A.ensureSources();
    if (st !== 'ready') return { state: st };
    const reg2 = A.D.reg;
    const noExc = reg2.filter((x) => !(x.excerpts || []).length);
    return {
      state: st,
      all: reg2.length,
      withSrc: reg2.filter((x) => !!A.storedSource(x)).length,
      noExc: noExc.length,
      noExcWithSrc: noExc.filter((x) => !!A.storedSource(x)).length,
    };
  });
  ok(srcCount && srcCount.state === 'ready', '저장해 둔 공고 원문을 읽어 온다', JSON.stringify(srcCount));
  if (srcCount && srcCount.state === 'ready') {
    ok(srcCount.withSrc >= 20,
      '등록 공고 상당수에 저장해 둔 원문이 붙는다', `${srcCount.withSrc}/${srcCount.all}건`);
    ok(srcCount.noExcWithSrc >= 10,
      '발췌가 없던 공고에도 읽을 원문이 생긴다 (새 탭 왕복이 사라지는 자리)',
      `${srcCount.noExcWithSrc}/${srcCount.noExc}건`);
    /* 원문이 붙는 공고를 실제로 열어 화면에 글자가 보이는지 본다 — 숫자만 맞고 화면은 빈 경우를 막는다 */
    const someId = await page.evaluate(() => {
      const A = window.__admin;
      const hit = A.D.reg.find((x) => !(x.excerpts || []).length && !!A.storedSource(x));
      return hit ? hit.id : null;
    });
    if (someId) {
      await page.click(`[data-row][data-id="${someId}"]`);
      await page.waitForSelector('#sheet:not([hidden])');
      await page.waitForSelector('#sheet .src-body', { timeout: 5000 }).catch(() => {});
      const bodyLen = await page.evaluate(() => (document.querySelector('#sheet .src-body')?.textContent || '').length);
      ok(bodyLen > 100, '그 공고를 열면 원문 글자가 실제로 보인다', `${bodyLen}자`);
      await page.click('#sheet [data-close]');
    } else {
      ok(false, '원문이 붙는 발췌 없는 공고를 찾지 못함');
    }
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
  await gotoForms(page);

  /* 미리보기는 '눈에 보이는 버튼'이어야 한다 — 줄 클릭만으로는 개발자가 찾지 못했다(2026-08-14) */
  const previewBtns = await page.locator('#screen-list [data-form-preview]').count();
  const rowsForPreview = await page.locator('#screen-list tr[data-form]').count();
  ok(previewBtns === rowsForPreview && rowsForPreview > 0,
    '양식 목록 줄마다 미리보기 버튼이 보인다', `버튼 ${previewBtns} / 줄 ${rowsForPreview}`);

  /* 🔴 **맨 앞 양식을 그냥 누르지 말 것.** 원문 링크는 그 양식을 쓰는 공고가 있을 때만 그려지는데,
     지금 등록된 양식의 대부분은 연결된 공고가 없다(학교를 둘로 좁히면서 공고만 줄었다).
     맨 앞을 누르면 '주인 없는 양식'이 걸려 링크가 0개가 되고, 멀쩡한 화면이 실패로 읽힌다.
     '공고 id를 박지 말 것'(CLAUDE.md)과 같은 유형이라 **그때그때 고른다.** */
  const pick = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#screen-list tr[data-form]')].map((tr) => tr.dataset.form);
    const owned = [];
    for (const id of rows) {
      const owner = window.__admin.D.reg.find((it) => it.formId === id);
      if (!owner) continue;
      owned.push(id);
      if (window.safeUrl(owner.sourceUrl)) return { id, linked: true, owned: owned.length };
    }
    return { id: owned[0] || rows[0] || null, linked: false, owned: owned.length };
  });
  ok(pick.id != null, '미리보기를 열 양식을 골랐다', pick.id || '양식이 하나도 없다');

  /* ⚠️ 양식이 하나도 없으면 여기서 **멈춘다** — `[data-form-preview="null"]` 을 누르려다
     시간초과로 죽으면 뒤 항목이 통째로 안 돌고, 진짜 원인('양식이 0종')이 묻힌다. */
  if (pick.id == null) {
    await browser.close(); srv.close();
    console.log(`\n❌ ${failed}개 항목 실패 — 양식이 하나도 없어 나머지를 재지 못했습니다`);
    process.exit(1);
  }

  await page.click(`#screen-list [data-form-preview="${pick.id}"]`);
  await page.waitForSelector('#sheet:not([hidden])');
  const docLen = await page.locator('#sheet .doc-preview').innerText();
  ok(docLen.length > 80, '양식 화면에서 생성 문서 미리보기가 뜬다', `${docLen.length}자`);

  /* 원본과 대조하려면 원문 주소가 같은 화면에 있어야 한다.
     ⚠️ 링크를 걸 수 있는 양식이 하나도 없으면 **조용히 건너뛰지 않고** 실패시킨다 —
        그건 화면이 아니라 데이터가 무너진 것이고, 그때야말로 알아야 한다. */
  const sheetLinks = await page.evaluate(() =>
    [...document.querySelectorAll('#sheet a[href^="http"]')].map((a) => a.href));
  ok(pick.linked && sheetLinks.length > 0,
    '양식 미리보기 시트에 원본 링크가 있다',
    `${sheetLinks.length}개 · 공고가 연결된 양식 ${pick.owned}종`);
  await page.click('#sheet [data-close]');

  /* 목록에도 원문 링크가 있어야 한다(시트를 열지 않고 대조 시작) */
  const rowLinks = await page.locator('#screen-list tr[data-form] a[href^="http"]').count();
  ok(rowLinks > 0, '양식 목록 줄에 원문·첨부 링크가 있다', `${rowLinks}개`);

  /* ⑥ 분류가 실제로 걸러 내는가 */
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  await page.click('[data-f="status"][data-v="unreviewed"]');
  await page.waitForTimeout(200);
  const filtered = await page.locator('#screen-list [data-row]').count();
  ok(filtered === autoN, '상태 분류가 실제로 걸러 낸다', `검수 전 ${filtered}건`);

  await page.click('[data-f="status"][data-v="all"]');
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
    const n = await page.locator('#screen-list [data-row]').count();
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
    ok(await page.locator('#screen-list [data-row]').count() === reg.items.length,
      '태그를 누르면 그 필터가 풀린다');
  }

  /* ⑦ 다중 선택 (B3) — 87건을 한 줄씩 누르는 것을 끝내는 기능이라 여기서 실제로 눌러 본다 */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');

  ok(await page.locator('#screen-review [data-row] input[data-pick]').count() > 0,
    '컨펌 작업대의 줄마다 선택 네모가 있다');
  ok(await page.locator('[data-selbar]').count() === 0, '아무것도 안 골랐을 땐 선택 바가 없다');

  await page.locator('#screen-review input[data-pick]').first().check();
  await page.waitForTimeout(120);
  ok(await page.locator('[data-selbar]').count() === 1, '하나 고르면 선택 바가 나타난다');
  ok(!(await page.locator('#sheet').isVisible()), '네모를 눌러도 상세 시트가 열리지 않는다');

  await page.click('[data-sel="urgent"]');
  await page.waitForTimeout(200);
  const urgentN = Number((await page.locator('[data-selbar-n]').innerText()).replace(/\D/g, ''));
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
  const listedN = await page.locator('#sheet [data-rows] [data-row]').count();
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
  ok(await page.locator('#sheet [data-pane]').count() === 2, '왼쪽 앱1 내용 · 오른쪽 공고 원문 두 칸으로 대조한다');
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
    const before = await page.locator('#screen-review [data-rows] [data-row]').count();
    await page.locator('#screen-review [data-more]').first().click();
    await page.waitForTimeout(250);
    const after = await page.locator('#screen-review [data-rows] [data-row]').count();
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
  ok(await page.locator('#screen-robots [data-run]').count() >= 16, '로봇 16종 이상에 실행 버튼이 있다');

  /* 로봇이 마지막에 언제 돌았나 (2026-09-13)
     🔴 예전에는 '지금 실행'·'기록 ↗' 두 버튼뿐이라 **"어제 수집 잘 됐나"를 알려면
     GitHub 으로 나가야 했다.** 이제 줄마다 마지막 실행이 적힌다.
     ⚠️ 이 검사 환경은 바깥 통신이 막혀 있어 '읽지 못했습니다' 가 뜨는 것이 정상이다 —
        그래서 **'정상으로 보이지 않는가'** 를 본다(못 읽은 것을 성공으로 위장하지 않는지). */
  {
    /* ⚠️ 로봇 줄만 센다 — 수집망이 이 화면으로 들어와 `.row` 가 그것 말고도 있다.
       로봇 줄의 표식은 '실행 버튼을 가진 줄' 이다. */
    const counts = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#screen-robots [data-rows] [data-row]')]
        .filter((r) => r.querySelector('[data-run]'));
      const said = rows.filter((r) => /마지막 실행|도는 중|실행 기록 없음/.test(r.textContent));
      return { rows: rows.length, said: said.length };
    });
    ok(counts.rows >= 16 && counts.said === counts.rows,
      '로봇 줄마다 마지막 실행이 적힌다', `${counts.said}/${counts.rows}줄`);
    const t = await page.textContent('#screen-robots');
    /* 🔴 이 검사 환경은 바깥 통신이 막혀 있다. 그래서 **'못 읽었다고 말하는가'** 를 본다 —
       못 읽은 것을 성공으로 위장하면(초록으로 보이면) 그게 가장 나쁘다. */
    const said = /마지막 실행을 읽지 못했습니다|실행 기록 없음|마지막 실행 (성공|실패|취소됨)|도는 중/.test(t);
    ok(said, '마지막 실행을 글자로 말한다 (색만으로 말하지 않는다)');
    ok(!(/읽지 못했습니다/.test(t) && /마지막 실행 성공/.test(t)),
      "못 읽었을 때 '성공'으로 위장하지 않는다");
    /* 수집망을 로봇 화면으로 흡수했다 — 학교가 둘로 줄어 탭 하나를 차지할 이유가 없어졌다 */
    ok(/수집망/.test(t) && /게시판 주소가 없는 학교/.test(t),
      '수집망 내용이 로봇 화면 안에 있다');
  }

  /* 🔴 버튼 **개수**만 세던 검사가 2026-08-12까지 진짜 결함을 놓쳤다 — 리포트 버튼 5개 중
     2개(일반 수집·심층 수집)가 저장소에 없는 파일을 가리켜 **영원히 빈 화면**이었는데,
     개수는 5였으므로 통과했다. 이제 **가리키는 파일이 실제로 있는지**를 본다. */
  const reportPaths = await page.locator('#screen-robots [data-report]')
    .evaluateAll((els) => els.map((e) => e.dataset.report));
  ok(reportPaths.length >= 4, `리포트 버튼이 있다 — ${reportPaths.length}종`);
  /* 판정 기준은 '지금 파일이 있는가'가 아니라 **'로봇이 그 파일을 저장하는가'** 다.
     갓 고친 리포트는 다음 실행 전까지 저장소에 없을 수 있지만, 워크플로의 `git add`에
     들어 있으면 반드시 생긴다. 반대로 아무도 저장하지 않는 리포트는 영원히 빈 화면이다. */
  const wfDir = path.join(ROOT, '.github', 'workflows');
  const wfAll = fs.readdirSync(wfDir).filter((f) => f.endsWith('.yml'))
    .map((f) => fs.readFileSync(path.join(wfDir, f), 'utf8')).join('\n');
  const dead = reportPaths.filter((p) => !fs.existsSync(path.join(ROOT, p))
    && !new RegExp(`git add[^\\n]*${p.replace(/[.]/g, '\\.')}`).test(wfAll));
  ok(dead.length === 0,
    `리포트 버튼이 가리키는 파일을 로봇이 실제로 저장한다${dead.length ? ` — 아무도 안 만드는 것: ${dead.join(', ')}` : ''}`);

  /* 입력이 필요한 로봇은 빈 값으로 던지면 GitHub이 422로 거부한다 — 화면이 먼저 막아야 한다.
     ⚠️ **누르는 검사는 맨 끝에서 한다** — 아래 관리자 조정 검사들이 '앞 작업이 끝났나'를
     알림 띠(#job-text)의 문구로 판단하기 때문에, 여기서 띠 문구를 덮어쓰면 그 판단이
     빗나가 뒤 항목이 줄줄이 실패한다(실제로 겪음). 여기서는 **붙어 있는지만** 본다. */
  ok(await page.locator('#screen-robots [data-run-input-name]').count() === 1,
    '입력이 필요한 로봇에 입력칸이 붙어 있다');

  /* 양식 변환 API가 멈춘 것을 화면이 말하는가 (2026-08-12 신설).
     8/11에 잔액이 떨어져 유료 변환이 멈췄는데 실패가 리포트 '건너뜀'에 한 줄로 섞여
     화면은 아무 말도 하지 않았다. **리포트에 실패가 있는데 '정상'이라고 말하면 실패**. */
  await page.waitForFunction(() => !/확인하는 중/.test(document.querySelector('#api-health')?.textContent || ''),
    null, { timeout: 10000 });
  const apiText = await page.textContent('#api-health');
  const reportHasFail = /API 호출 실패/.test(
    fs.existsSync(path.join(ROOT, 'collector/browser-report.md'))
      ? fs.readFileSync(path.join(ROOT, 'collector/browser-report.md'), 'utf8') : '');
  ok(reportHasFail ? /호출 실패/.test(apiText) : /정상|읽지 못/.test(apiText),
    '양식 변환 API가 멈추면 화면이 알린다 (리포트와 화면이 어긋나지 않는다)',
    reportHasFail ? '리포트에 실패 있음' : '리포트에 실패 없음');

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
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */

  const openedByKey = await page.evaluate(() => {
    const row = document.querySelector('#screen-list [data-row]');
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
    return !!(a && a.matches && a.matches('#screen-list [data-row]'));
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
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  ok(await page.locator('[data-sort]').count() >= 4, '정렬 버튼이 있다');

  const firstBy = async () => (await page.locator('#screen-list [data-row] [data-row-title]').first().innerText()).trim();
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
  await page.click('#screen-review [data-row]');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.click('#sheet [data-act="revert"]');
  await page.waitForTimeout(400);

  const askText = await page.textContent('#sheet');
  const usedConfirm = await page.evaluate(() => { window.confirm = window.__origConfirm; return window.__confirmUsed; });
  ok(usedConfirm === 0, '되돌리기에 브라우저 기본 confirm을 쓰지 않는다');
  ok(/차단/.test(askText) && /되돌리기/.test(askText),
    '되돌리기 확인 화면이 무엇을 하는지 보여 준다');
  ok(await page.locator('#sheet [data-rows] [data-row]').count() >= 1, '어느 공고인지 목록으로 보여 준다');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  /* ⑭ 밝게/어둡게 — 🔴 **검사를 지웠다. 고장이 아니라 결정의 결과다** (2026-09-13).
     개발자 지시 *"디자인 측면에서도 앱1과 같은 체계를 맞춰줘"* 에 따라 관리자 화면의
     어두운 화면을 없앴다. 앱1이 밝은 한 벌뿐이기 때문이고(style.css 2067 — "다크모드 규칙을
     넣지 말 것"), 관리자만 어두운 화면을 두니 실제로 어긋남이 있었다 — `--shadow` 가 어두운
     정의 두 벌 중 한 벌에만 있어 밝은 OS 에서 어둡게 바꾸면 밝은 화면용 그림자가 남았다.
     그래서 여기 있던 검사 둘('테마 버튼이 실제로 화면 밝기를 바꾼다' · '고른 밝기를 기억한다')이
     가리키던 `#btn-theme` 가 더는 없다.
     ⚠️ 되살리려면 **앱1과 함께** 해야 한다. 관리자만 되살리면 같은 어긋남이 돌아온다.
     그 대신 지금 지켜야 하는 것은 '어두운 화면이 다시 생기지 않는 것' 이라, 아래에서 그것을 센다. */
  ok(await page.locator('#btn-theme').count() === 0,
    '밝기 전환 버튼이 없다 (앱1과 같은 밝은 화면 한 벌)');
  ok(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === null,
    '화면에 밝기 속성이 붙지 않는다');

  /* ⑮ 시트가 끝까지 스크롤되는가 (2026-08-09 개발자 제보)
     flex 세로 배치는 내용이 넘치면 **자식을 눌러 줄인다**. 그래서 안쪽 스크롤 상자만
     스크롤되고 시트는 넘치지 않아 **맨 아래 칸이 납작하게 눌려 보이지 않았다.** */
  await gotoForms(page);
  const withUse = Object.keys(forms.templates).find((id) => reg.items.some((x) => x.formId === id));
  if (withUse) {
    await page.click(`#screen-list tr[data-form="${withUse}"]`);
    await page.waitForSelector('#sheet:not([hidden])');
    const geom = await page.evaluate(() => {
      const sh = document.querySelector('#sheet');
      const last = sh.querySelector('[data-rows]:last-of-type');
      return {
        scrollable: sh.scrollHeight > sh.clientHeight + 4,
        lastH: last ? Math.round(last.getBoundingClientRect().height) : -1,
      };
    });
    ok(geom.scrollable, '시트 내용이 넘치면 시트가 실제로 스크롤된다');
    ok(geom.lastH > 20, '맨 아래 칸이 눌리지 않는다 (이 양식을 쓰는 공고)', `높이 ${geom.lastH}px`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } else {
    ok(true, '시트 스크롤 — 연결된 공고가 있는 양식이 없어 건너뜀');
  }

  /* ⑯ 선택 바가 헤더 뒤로 숨지 않는가 — 위에 붙이면 sticky 헤더에 가려진다 */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  await page.click('[data-sel="urgent"]');
  await page.waitForTimeout(250);
  const barGeom = await page.evaluate(() => {
    const bar = document.querySelector('[data-selbar]');
    if (!bar) return null;
    const top = document.querySelector('.topbar').getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { pos: getComputedStyle(bar).position, overlapsHeader: b.top < top.bottom, inView: b.bottom <= window.innerHeight + 2 };
  });
  ok(barGeom && barGeom.pos === 'fixed', '선택 바가 화면에 고정된다');
  ok(barGeom && !barGeom.overlapsHeader, '선택 바가 헤더 뒤로 숨지 않는다');
  ok(barGeom && barGeom.inView, '선택 바가 화면 안에 보인다');
  /* 화면 안내 문구와 실제 위치가 어긋나면 안 된다 (예전엔 '아래'라 적고 위에 붙였다) */
  ok(/화면 아래/.test(await page.textContent('#screen-review')), '안내 문구가 실제 위치와 맞다');
  await page.click('[data-sel="none"]');
  await page.waitForTimeout(200);

  /* ⑰ 자격 요건 편집 (D1) — 예전엔 화면에서 **읽기 전용**이라 못 읽은 자격을 채울 수 없었다.
     🔴 기계 판정용(eligibility)과 사람이 읽는 문장(eligibilityLines)이 섞이면
     매칭·알림·홈 합계가 조용히 망가진다. 보내는 내용에서 그 분리를 확인한다. */
  await page.click('.tab[data-tab="review"]');
  await page.waitForSelector('#screen-review:not([hidden])');
  await page.click('#screen-review [data-row]');
  await page.waitForSelector('#sheet:not([hidden])');

  ok(await page.locator('#sheet [data-eg]').count() >= 6, '자격을 화면에서 고칠 수 있다 (읽기 전용이 아니다)');
  ok(await page.locator('#sheet #eg-verified').count() === 1, "'제한 없음을 확인했다' 체크칸이 있다");

  await page.fill('#sheet #eg-minGpa', '3.5');
  await page.fill('#sheet #eg-years', '1,2');
  await page.fill('#sheet #eg-lines', '1) 본교 재학생\n2) 직전 학기 성적 3.5 이상');
  const picks = await page.locator('#sheet [data-eline]').count();
  if (picks) await page.locator('#sheet [data-eline]').first().check();

  /* 앞선 검사(등록)가 결과를 기다리며 `jobBusy` 잠금을 6분간 붙들고 있으면
     이 저장 요청이 "앞선 작업이 아직 끝나지 않았어요"로 막힌다(제품이 옳다).
     그래서 '실행 결과'도 함께 흉내 내 앞 작업이 끝나게 한다. */
  await page.route('**/actions/workflows/**/runs**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      workflow_runs: [{
        id: 2, status: 'completed', conclusion: 'success',
        created_at: new Date(Date.now() + 5000).toISOString(),
        html_url: 'https://example.invalid/run',
      }],
    }),
  }));
  await page.waitForFunction(() => {
    const t = document.querySelector('#job-text')?.textContent || '';
    return !/요청을 보냈어요|반영 중/.test(t);
  }, null, { timeout: 25000 }).catch(() => {});

  let editSent = null;
  await page.route('**/actions/workflows/**/dispatches', (route) => {
    try { editSent = JSON.parse(route.request().postData() || '{}'); } catch { editSent = 'parse-fail'; }
    route.fulfill({ status: 204, body: '' });
  });
  /* 🔴 저장은 이제 **바로 보내지 않는다** (2026-09-13) — 장부에 모았다가
     '한꺼번에 반영' 한 번으로 나간다. 한 건마다 GitHub 작업이 끝나기를 기다리던 것이
     하루치 대기의 대부분이었기 때문이다(건당 30~60초 × 13건).
     그래서 검사도 저장 → 한꺼번에 반영 두 걸음으로 간다. **보는 것은 그대로다** —
     어떤 값이 어느 칸으로 나가는가. */
  await page.click('#sheet [data-act="save"]');
  await page.waitForTimeout(300);
  ok(editSent === null, '저장을 눌러도 아직 보내지 않는다 (모아 뒀다가 한 번에)');
  ok(await page.locator('#pending-bar:not([hidden])').count() === 1,
    '모아 둔 수정이 있다고 화면이 말한다');
  await page.click('[data-act="flush"]');
  await page.waitForTimeout(700);
  const sentPayload = (() => { try { return JSON.parse(editSent?.inputs?.payload || '{}'); } catch { return {}; } })();
  ok(Array.isArray(sentPayload.edits) && sentPayload.edits.length >= 1,
    '여러 건을 한 번에 보낼 수 있는 모양으로 나간다', `${(sentPayload.edits || []).length}건`);
  const ep = (sentPayload.edits && sentPayload.edits[0] && sentPayload.edits[0].patch) || {};

  ok(ep.eligibility && ep.eligibility.minGpa === '3.5' && ep.eligibility.years === '1,2',
    '기계 판정용 값이 eligibility로 간다');
  ok(Array.isArray(ep.eligibilityLines) && ep.eligibilityLines.length >= 2,
    '사람이 읽는 문장은 eligibilityLines로 따로 간다', `${(ep.eligibilityLines || []).length}줄`);
  ok(!Object.values(ep.eligibility || {}).some((v) => typeof v === 'string' && v.length > 40),
    '기계 판정칸에 긴 자유 문장이 섞이지 않는다');
  ok('eligibilityVerified' in ep, "'제한 없음 확인' 여부를 함께 보낸다");
  await page.unroute('**/actions/workflows/**/dispatches');
  await page.unroute('**/actions/workflows/**/runs**');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  /* ⑱ 양식 큐 조작 (D2) — 예전엔 알려만 주고 못 고쳤다 */
  await gotoForms(page);
  const pend = JSON.parse(fs.readFileSync(path.join(ROOT, 'collector/pending-forms.json'), 'utf8')).items || [];
  const waiting = pend.filter((q) => q.fetched && !q.schematized && !q.retired).length;
  if (waiting) {
    ok(await page.locator('[data-fq="retire"]').count() === waiting,
      '스키마화 대기 줄마다 그만 시도 버튼이 있다', `${waiting}건`);
    await page.locator('[data-fq="retire"]').first().click();
    await page.waitForSelector('#sheet:not([hidden])');
    const t = await page.textContent('#sheet');
    ok(/자동 재시도 멈추기/.test(t) && /리포트에는 계속 표시/.test(t),
      '멈추기 전에 무슨 일이 생기는지 알려 준다');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } else {
    ok(true, '양식 큐 — 대기 건이 없어 건너뜀');
  }
  /* 스키마 자체는 화면에서 만들지 않는다 — 원본과 같은 구조여야 하므로(운영 원칙 4) */
  ok(/스키마 자체는 화면에서 만들지 않습니다/.test(await page.textContent('#screen-list')),
    '스키마를 화면에서 만들지 않는 이유를 밝힌다');

  /* ⑲ 다시 그릴 때 잃는 것 (B7) — 필터를 누르면 스크롤·입력 중이던 값이 날아갔다.
        166줄을 훑다가 칩 하나 눌렀는데 맨 위로 튀면 훑던 자리를 다시 찾아야 한다. */
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  await page.setViewportSize({ width: 420, height: 720 });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(60);
  const beforeY = await page.evaluate(() => window.scrollY);
  /* 🔴 Playwright의 click()은 누르기 전에 그 요소를 화면 안으로 **끌어온다** —
     그러면 우리가 재려는 스크롤 위치를 검사 도구가 먼저 망가뜨린다.
     실제 사용자는 이미 보이는 칩을 누르므로, 여기서는 끌어오지 않고 그대로 누른다. */
  await page.evaluate(() => document.querySelector('#screen-list [data-sort="listed"]').click());
  await page.waitForTimeout(120);
  const afterY = await page.evaluate(() => window.scrollY);
  ok(beforeY > 300 && Math.abs(afterY - beforeY) < 60,
    '정렬을 바꿔도 훑던 자리를 잃지 않는다', `${beforeY} → ${afterY}`);

  /* 검색칸은 글자를 칠 때마다 다시 그려진다 — 초점과 커서 자리까지 지켜야 이어서 칠 수 있다 */
  await page.fill('#f-q', '장학');
  await page.waitForTimeout(400);
  const caret = await page.evaluate(() => {
    const el = document.querySelector('#f-q');
    return { focused: document.activeElement === el, v: el.value, pos: el.selectionStart };
  });
  ok(caret.focused && caret.v === '장학' && caret.pos === 2,
    '검색 중에 초점과 커서 자리가 유지된다', JSON.stringify(caret));
  await page.fill('#f-q', '');
  await page.waitForTimeout(400);

  /* ⑳ 스캔 지점 (B0-6) — 마감 임박순일 때만 구획으로 나눈다 */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.querySelector('#screen-list [data-sort="deadline"]').click());
  await page.waitForTimeout(150);
  if (await page.locator('#screen-list [data-sort="deadline"].on .c').textContent() !== '↑') {
    await page.evaluate(() => document.querySelector('#screen-list [data-sort="deadline"]').click());
    await page.waitForTimeout(150);
  }
  const groups = await page.locator('#screen-list [data-group-head]').count();
  ok(groups >= 2, '마감 임박순에서는 기한 구획으로 나뉜다', `${groups}구획`);
  /* 🔴 **끝난 공고가 첫 화면을 차지하지 않는다** (2026-09-13).
     실측으로 48건 중 28건이 마감 지난 것이었고, 기본 정렬(마감 임박순)의 첫 구획이
     「마감 지남 28건」이었다 — 정작 봐야 할 검수 전 14건은 한참 스크롤해야 나왔다.
     ⚠️ 숨긴 것이 아니다. 자리만 뒤로 옮겼는지 본다(건수는 위 검사가 48/48로 지킨다). */
  {
    const heads = await page.evaluate(() => [...document.querySelectorAll('#screen-list [data-group-head]')]
      .map((h) => h.textContent.trim()));
    const over = heads.findIndex((h) => /마감 지남/.test(h));
    ok(over !== 0, '마감 임박순에서 끝난 공고가 맨 위에 오지 않는다',
      heads.length ? heads.map((h) => h.split(' ')[0]).join(' → ') : '구획 없음');
    if (over >= 0) {
      ok(over === heads.length - 1 || /기한 미확인/.test(heads[heads.length - 1] || ''),
        "'마감 지남' 은 맨 아래 구획이다");
    }
  }
  const grouped = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#screen-list [data-group-head]')];
    const sum = [...document.querySelectorAll('#screen-list [data-group] [data-rows]')]
      .reduce((a, b) => a + b.children.length, 0);
    const all = document.querySelectorAll('#screen-list [data-row]').length;
    const sticky = heads[0] && getComputedStyle(heads[0]).position;
    return { sum, all, sticky, labels: heads.map((h) => h.firstChild.textContent.trim()) };
  });
  ok(grouped.sum === grouped.all, '구획으로 나눠도 공고가 한 건도 사라지지 않는다',
    `${grouped.sum}/${grouped.all}건`);
  ok(grouped.sticky === 'sticky', '구획 제목은 스크롤 중에도 화면에 남는다', grouped.sticky);
  await page.evaluate(() => document.querySelector('#screen-list [data-sort="name"]').click());
  await page.waitForTimeout(150);
  ok(await page.locator('#screen-list [data-group-head]').count() === 0,
    '제목순에서는 구획을 만들지 않는다 (기한 구획이 뜻을 잃으므로)');

  /* ㉑ 밀도 (B0-7) — 글자를 줄이지 않고 줄 간격만 줄인다 */
  const dens = await page.evaluate(() => {
    const row = document.querySelector('#screen-list [data-row]');
    const before = { pad: getComputedStyle(row).paddingTop,
      font: getComputedStyle(row.querySelector('.t')).fontSize };
    document.querySelector('#btn-density').click();
    const after = { pad: getComputedStyle(row).paddingTop,
      font: getComputedStyle(row.querySelector('.t')).fontSize,
      saved: localStorage.getItem('handaejang.admin.density'),
      attr: document.documentElement.getAttribute('data-density') };
    return { before, after };
  });
  ok(parseFloat(dens.after.pad) < parseFloat(dens.before.pad),
    '촘촘하게를 켜면 줄 간격이 실제로 줄어든다', `${dens.before.pad} → ${dens.after.pad}`);
  ok(dens.after.font === dens.before.font,
    '촘촘하게가 글자를 작게 만들지는 않는다 (대비·치수 규칙 유지)', dens.after.font);
  ok(dens.after.saved === 'compact' && dens.after.attr === 'compact',
    '고른 밀도가 기기에 남는다');
  await page.evaluate(() => document.querySelector('#btn-density').click());
  await page.waitForTimeout(100);

  /* ㉒ 좁은 화면의 표 (B0-10) — 넘칠 때만 안내가 붙는다.
        전 화면을 돌며 재는 이유: 한 화면만 보면 그 화면의 표가 안 넘칠 때
        **안내가 한 번도 안 뜨는데도 검사는 통과**한다(뜻 없는 검사가 된다). */
  const hints = {};
  /* ⚠️ 화면이 다섯으로 줄었다 — 양식은 「목록」의 보기 전환이라 따로 한 번 더 돈다.
     그래야 예전에 보던 표(양식 표)를 계속 본다. */
  for (const n of ['todo', 'list', 'listForms', 'review', 'robots']) {
    if (n === 'listForms') await gotoForms(page);
    else await page.click(`.tab[data-tab="${n}"]`);
    await page.waitForTimeout(200);
    hints[n] = await page.evaluate((s2) => [...document.querySelectorAll(`#screen-${s2} .scroller`)]
      .map((sc) => ({ over: sc.scrollWidth > sc.clientWidth + 4,
        hint: sc.nextElementSibling?.classList.contains('scroll-hint') || false })),
    n === 'listForms' ? 'list' : n);
  }
  const flat = Object.values(hints).flat();
  ok(flat.some((x) => x.over), '좁은 화면에서 실제로 넘치는 표가 있다 (검사가 헛돌지 않는다)',
    `${flat.filter((x) => x.over).length}/${flat.length}개`);
  ok(flat.length > 0 && flat.every((x) => x.over === x.hint),
    '표가 넘칠 때만 옆으로 밀라고 안내한다 (안 넘치면 안 붙는다)',
    JSON.stringify(hints));

  /* ㉓ 시트 하단 바 (B0-11) — 저장 버튼이 스크롤에 묻히면 안 된다 */
  await gotoNotices(page);   /* 🔴 보기 전환이 '양식' 으로 남아 있을 수 있다 — 공고 보기까지 확실히 간다 */
  await page.locator('#screen-list [data-row]').first().click();
  await page.waitForSelector('#sheet:not([hidden])');
  const foot = await page.evaluate(() => {
    const f = document.querySelector('#sheet .sheet-foot');
    if (!f) return null;
    const sheet = document.querySelector('#sheet');
    sheet.scrollTop = sheet.scrollHeight;      // 맨 아래
    const atEnd = f.getBoundingClientRect();
    sheet.scrollTop = 0;                        // 맨 위
    const atTop = f.getBoundingClientRect();
    return { pos: getComputedStyle(f).position, atTop: atTop.height,
      visibleAtTop: atTop.bottom <= window.innerHeight + 1 && atTop.height > 0,
      atEnd: atEnd.height };
  });
  ok(foot && foot.pos === 'sticky', '시트 아래 버튼 줄이 화면에 붙어 있다', foot?.pos);
  ok(foot && foot.visibleAtTop && foot.atTop > 20,
    '시트를 맨 위로 올려도 저장 버튼이 보인다', JSON.stringify(foot));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.setViewportSize({ width: 1280, height: 900 });

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

  /* 입력이 필요한 로봇 — 실제로 눌러 본다 (알림 띠를 덮어쓰므로 맨 끝에서) */
  await page.click('.tab[data-tab="robots"]');
  await page.waitForSelector('#screen-robots:not([hidden])');
  await page.locator('#screen-robots [data-run-input-name]').first().click();
  ok(/주소를 입력/.test(await page.textContent('#job') || ''),
    '주소 없이 누르면 실행하지 않고 알려 준다');

  /* 화면 이름이 주소에 남는가 — "로봇 탭 보세요"를 링크로 전할 수 있어야 한다 */
  ok(/#robots$/.test(page.url()), '지금 보는 화면이 주소에 남는다', page.url().split('/').pop());
  await page.evaluate(() => { location.hash = '#list'; });
  await page.waitForTimeout(300);
  ok(await page.isVisible('#screen-list'), '주소의 화면 이름으로 그 화면이 열린다');
  /* 🔴 없어진 화면 이름으로 들어와도 **갇히지 않는다** — 예전 링크('#quality')를
     아직 쓰는 사람이 있다. 모르는 이름이면 기본 화면이 열려야 한다. */
  await page.evaluate(() => { location.hash = '#quality'; });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => [...document.querySelectorAll('section.screen')]
    .some((el) => !el.hidden)), '없어진 옛 화면 이름으로 들어와도 빈 화면에 갇히지 않는다');

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
