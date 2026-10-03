/* 원문 링크 검증 드라이버 (2026-07-31)

   확인하는 것: 앱에서 장학 공고를 열고 '원문 공고 ↗'를 눌렀을 때 **그 장학금 공고**로 가는가.
   예전에는 클릭형 게시판(경희·동국) 공고의 주소가 게시판 목록 주소라서, 눌러도 학교 장학
   공지 목록 전체가 열렸다.

   검사 3단:
   ① 데이터 전수 — registered.json·notices.json에 목록 주소(#n- 표식)가 몇 건 남아 있나
   ② 브라우저 — 경희대 학생으로 온보딩해 실제 카드를 열고 링크 href와 라벨을 읽는다
   ③ 정직성 — 아직 원문 주소를 못 찾은 공고는 '게시판 목록 ↗'으로 표기되고 안내가 붙는가

   🔴 2026-10-03 (원문 링크 정직성 · 개발자 보고 P0): 라벨 기대 값을 `#n-` 글자로 정하지 않는다 — 앱이 쓰는
      규칙 그대로(source-link.js 의 sourceLink + 로봇 확인 장부 data/link-check.json)로 정한다. 그리고 게시판 글 카드는
      2026-09-18 에 홈으로 옮겼는데 이 검사는 탐색 목록에서 읽고 있어 **늘 0건으로 통과**했다 — 이제 홈에서 읽고, 0건이면 실패다.
   🔴 같은 날(리뷰 G9): ③은 오늘 데이터의 경희 카드가 전부 보통 주소라 목록·문제 갈래를 **한 번도 안 지나고** 통과했다.
      이제 앱이 받는 장부를 page.route 로 바꿔(보이는 카드 하나는 '목록', 하나는 '열리지 않음') 앱을 다시 열고 그 두 시트를 읽는다.
      목록·문제 갈래를 한 장도 못 재면 실패다. 장부를 바꿔 주려면 서비스워커를 막아야 한다(서비스워커가 받으면 route 가 못 본다).

   실행: (python3 -m http.server 8123 &) 후 node verify/verify-source-links.js */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
const { nextUntil, assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const fs = require('fs');
const path = require('path');
/* 라벨 규칙은 앱과 **같은 파일** — 여기서 다시 적으면 검사와 앱이 갈라진다 */
const SL = require('../source-link.js');

const ROOT = path.join(__dirname, '..');
const SHOT = (n) => `${__dirname}/shot-${n}.png`;
const isMarker = (u) => SL.linkShape(u) === 'marker';
/* 앱이 받는 확인 장부를 그대로 넘긴다(없으면 앱처럼 주소 꼴만 본다) */
const LEDGER = path.join(ROOT, 'data/link-check.json');
SL.setLinkChecks(fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : null);
/* 화면의 href(브라우저가 푼 주소)와 데이터 주소를 같은 꼴로 맞춘다 */
const normUrl = (u) => { try { return new URL(SL.decodeUrlEntities(u)).href; } catch (e) { return String(u || ''); } };
// 검사할 학교 — 기본 경희대(문제가 처음 보고된 학교). LINKCHECK_SCHOOL로 바꿀 수 있다.
const SCHOOL = process.env.LINKCHECK_SCHOOL || '경희';

(async () => {
  /* 🔴 재기 전에 **이 서버가 내 앱인지** 확인한다 — 아니면 여기서 멈춘다.
     이 저장소는 작업 폴더를 여러 개 두고 쓰는데, 8123 에 다른 폴더의 서버가 떠 있으면
     그 옛 앱을 재고도 아무도 모른다(빨간불이든 **가짜 초록불이든**). 규칙은 onboard-helper 한 곳. */
  await assertOwnServer(PORT);
  let fail = 0;
  const bad = (m) => { fail += 1; console.log('  ✕ ' + m); };
  const ok = (m) => console.log('  ✓ ' + m);

  /* ── ① 데이터 전수 검사 ─────────────────────────────── */
  console.log('■ 데이터 전수 — 목록 주소로 남아 있는 공고');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8')).items;
  const nots = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8')).items;
  const regMarkers = reg.filter((r) => isMarker(r.sourceUrl));
  const notMarkers = nots.filter((n) => isMarker(n.url));
  console.log(`  정식 등록 ${reg.length}건 중 목록 주소 ${regMarkers.length}건 · 실시간 공고 ${nots.length}건 중 ${notMarkers.length}건`);
  regMarkers.forEach((r) => console.log(`    - [남음] ${r.id} · ${r.name.slice(0, 40)}`));

  // 원문 주소가 첨부 내려받기 주소로 잘못 들어간 것도 함께 본다
  const dl = reg.filter((r) => /mode=download|attachNo=|fileDown/i.test(r.sourceUrl || ''));
  if (dl.length) bad(`sourceUrl이 첨부 내려받기 주소인 항목 ${dl.length}건: ${dl.map((d) => d.id).join(', ')}`);
  else ok('sourceUrl이 첨부 내려받기 주소인 항목 없음');

  /* ── ② 브라우저 검사 ─────────────────────────────── */
  console.log(`■ 브라우저 — ${SCHOOL} 학생으로 실제 카드를 열어 링크 확인`);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  /* 서비스워커를 막는다 — ③에서 장부를 page.route 로 바꿔 주는데, 서비스워커가 받아 가면 route 가 그 요청을 못 본다
     (verify-activities.js 와 같은 방식). 막지 않으면 바꿔 준 장부가 앱에 안 닿고 ③이 헛돈다. */
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);   // 없는 요소를 30초씩 기다리다 검사가 멈추지 않게
  /* 앱이 받는 장부 — null 이면 저장소 파일 그대로 넘긴다(①·②는 실제 장부로 잰다) */
  let ledgerOverride = null;
  await page.route('**/data/link-check.json*', (route) => (ledgerOverride
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ledgerOverride) })
    : route.continue()));
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', SCHOOL);
  await page.waitForTimeout(300);
  await page.click('.ac-list:not([hidden]) .ac-item');
  // 경희대는 이원화 캠퍼스라 캠퍼스 선택이 뜰 수 있다
  const campusChip = await page.$('#in-campus .chip');
  if (campusChip) await campusChip.click();
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', '컴퓨터공학과');
  await page.fill('#in-name', '홍길동');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.0');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 단계 번호를 박지 말 것 — 온보딩이 4단계에서 6단계가 되며 이 검사들이 죽어 있었다 */
  await nextUntil(page, '#in-sid');
  await page.fill('#in-sid', '2023100123');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@univ.ac.kr');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  /* 🔴 알림 동의 시트를 **뜰 때까지 기다렸다가** 치운다 (2026-09-07).
     전에는 1.5초만 기다리고 곧장 카드를 눌렀는데, 시트는 2.9초 뒤에 떠서 그 뒤의
     클릭을 전부 막았다 — 세 번에 한 번 빨간불이었다(깨끗한 트리에서 실측).
     기다림·치우기 규칙은 onboard-helper 한 곳이다. */
  await dismissNotify(page);
  await page.waitForTimeout(300);
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(800);

  /* 그 학교 학생에게 보이는 카드를 하나씩 열어 '원문 공고' 링크의 실제 href를 읽는다.
     학교 판정은 매칭 엔진이 쓰는 것과 같은 필드(eligibility.schoolOnly)로 — 제목에 학교 이름이
     안 들어간 교내 공고('복지장학2(면학) 지급 안내')를 놓치지 않기 위해. */
  const khuIds = reg
    .filter((r) => new RegExp(SCHOOL).test((r.eligibility && r.eligibility.schoolOnly) || ''))
    .map((r) => r.id);
  /* 탐색 목록에서 카드를 열어 시트 맨 아래 원문 링크를 읽는다 — ②와 ③이 같은 손으로 읽는다 */
  async function readSheets(ids) {
    const got = [];
    let n = 0;   // 실제로 연 카드 수 — '링크를 읽은 수'와 구분한다
    for (const id of ids) {
      const cardSel = `#explore-list [data-detail="${id}"]`;
      if (!(await page.$(cardSel))) continue;   // 마감돼 목록에서 빠진 공고는 건너뛴다
      await page.click(cardSel);
      await page.waitForSelector('#detail-sheet.show');
      await page.waitForTimeout(300);
      /* 🔴 **원문 링크는 `.doc-legend` 안에 있다** — `.sheet-deadline` 이 아니다 (2026-09-03).
         `.sheet-deadline` 은 `마감일 … · 중복 수혜 제한 있음` 한 줄일 뿐 링크가 없다(app.js:2118).
         옛 자리를 읽고 있어 **늘 0건**이었고, 그래서 "카드를 한 건도 열지 못했다"고 보고했다 —
         카드는 멀쩡히 열렸다. 자리가 바뀐 것을 검사가 못 따라간 것이다. */
      const link = await page.$$eval('#detail-sheet .doc-legend a', (els) =>
        els.map((e) => ({ href: e.href, text: e.textContent.trim() }))).catch(() => []);
      const legend = await page.$$eval('#detail-sheet .doc-legend', (els) => els.map((e) => e.textContent)).catch(() => []);
      n += 1;
      if (link.length) {
        const l = link[link.length - 1];
        got.push({ id, href: l.href, label: l.text, legend: legend.join('\n') });
      }
      // 상세 시트는 Escape 또는 배경 클릭으로 닫힌다 (닫기 버튼 요소는 없다 — app.js closeSheet)
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
    }
    return { got, opened: n };
  }
  /* 화면이 읽은 것을 규칙(SL — 지금 넘긴 장부 기준)과 대조한다. 갈래(cls)마다 센다 — 한 갈래만 재고 통과하지 않게 */
  const seenCls = {};
  function judge(c) {
    const item = reg.find((r) => r.id === c.id);
    const want = SL.sourceLink(item, 'detail');
    seenCls[want.cls] = (seenCls[want.cls] || 0) + 1;
    const line = `${c.id} · ${c.label} · ${c.href.slice(0, 92)}`;
    if (c.label !== want.label) bad(`라벨이 규칙(${want.kind})과 다릅니다 — 기대 「${want.label}」 — ${line}`);
    else if (c.href !== normUrl(want.href)) bad(`href 가 데이터 주소(HTML 기호를 푼 것)와 다릅니다 — 기대 ${normUrl(want.href).slice(0, 92)} — ${line}`);
    else if (want.cls === 'list' && !/목록에서 .+을\(를\) 찾아 눌러 주세요/.test(c.legend)) bad(`목록 링크인데 '목록에서 찾으세요' 안내가 없습니다 — ${line}`);
    else if (want.cls === 'trouble' && !c.legend.includes(want.caution)) bad(`확인 필요 링크인데 로봇이 본 것 한 줄(${want.caution})이 없습니다 — ${line}`);
    else ok(line);
    return want;
  }
  const { got: checked, opened } = await readSheets(khuIds);
  console.log(`  ${SCHOOL} 카드 ${opened}건을 열어 링크 ${checked.length}건을 실제로 읽음`);
  /* ⚠️ 한국장학재단(층2) 공고의 라벨('한국장학재단 ↗')은 **여기서 보지 않는다.**
     층2 항목은 실행 중에 만들어져 `registered.json` 에 없고, 이 드라이버는 그 파일을
     읽으므로 애초에 집히지 않는다(실측 0건). 그 규칙은 `verify-kosaf` 가 갖고 있다 —
     두 곳에 같은 규칙을 두면 한쪽만 고쳐져 갈라진다. */
  for (const c of checked) judge(c);
  /* ⚠️ '연 카드'와 '링크를 읽은 카드'를 구분해 말한다 — 뭉뚱그리면 원인을 엉뚱한 데서 찾는다 */
  if (!opened) bad(`${SCHOOL} 카드를 한 건도 열지 못했습니다 (온보딩·매칭 확인 필요)`);
  else if (!checked.length) bad(`${SCHOOL} 카드 ${opened}건을 열었지만 원문 링크를 한 건도 못 읽었습니다 (.doc-legend a 위치 확인)`);

  /* 게시판 글 카드(학교 게시판 새 공고 · 재단·지자체 · 우리 학교 소식)의 라벨도 같은 규칙인지.
     🔴 이 카드들은 2026-09-18 에 **홈으로** 옮겼다 — 예전처럼 `#explore-list .notice-card` 를 읽으면 늘 0건이고,
        0건이면 '불일치 0건'이라 **조용히 통과**했다(2026-10-03 에 발견). 홈에서 읽고, 0건이면 실패로 센다. */
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForSelector('#screen-home .notice-card', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  const feed = await page.$$eval('#screen-home .notice-card', (els) => els.map((e) => ({
    href: e.href || '', title: (e.querySelector('.sch-name') || {}).textContent || '',
    tail: [...e.querySelectorAll('.sch-provider')].map((p) => p.textContent.trim()).find((t) => / 수집/.test(t)) || '',
  }))).catch(() => []);
  /* 카드 → 데이터 글 (앱이 받는 파일들 · 주소로 맞춘다) */
  const readItems = (p) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')).items || []; } catch (e) { return []; } };
  const dirItems = (d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => /\.json$/.test(f) && f !== 'index.json').flatMap((f) => readItems(`${d}/${f}`));
  const byUrl = new Map();
  for (const n of [...dirItems('data/notices'), ...readItems('data/external.json'), ...dirItems('data/news')]) if (n && n.url) byUrl.set(normUrl(n.url), n);
  let feedChecked = 0;
  let feedWrong = 0;
  for (const f of feed) {
    const n = byUrl.get(f.href);
    if (!n) { feedWrong += 1; bad(`홈 카드의 글을 데이터에서 못 찾았습니다 — ${f.title.slice(0, 40)} · ${f.href.slice(0, 80)}`); continue; }
    const want = SL.sourceLink(n, 'card').label;
    feedChecked += 1;
    if (!(want ? f.tail.endsWith(` · ${want}`) : !/↗/.test(f.tail))) { feedWrong += 1; bad(`게시판 글 카드 라벨이 규칙과 다릅니다 — 기대 「${want}」 · 화면 「${f.tail}」 · ${f.href.slice(0, 80)}`); }
  }
  if (!feed.length) bad(`홈에 게시판 글 카드가 한 장도 없습니다 — 0건 통과는 통과가 아닙니다(${SCHOOL} 학교 파일·홈 구역 확인)`);
  else if (!feedWrong) ok(`홈 게시판 글 카드 라벨이 규칙(source-link.js)과 같다 (${feedChecked}/${feed.length}장 검사)`);

  await page.screenshot({ path: SHOT('60-source-links'), fullPage: false });

  /* ── ③ 정직성 — 로봇 장부가 '목록'·'열리지 않음'을 확정한 카드 ─────────────────
     🔴 (2026-10-03 리뷰 G9) 오늘 데이터의 경희 카드는 전부 보통 주소라 ②가 목록·문제 갈래를 한 번도 안 지났는데 통과였다.
     그래서 앱이 받는 장부(data/link-check.json)를 바꿔 준다 — ②에서 본 보통 주소 카드 하나는 'list', 다른 하나는 'gone'
     (2026-10-04 확인). 앱은 시작할 때 장부를 받으므로 다시 열고, 그 두 시트의 이름·「목록에서 … 찾아 눌러 주세요」·
     로봇이 본 것 한 줄을 읽는다. 기대 이름은 승인된 글자 그대로 적는다(규칙 파일과 앱이 같이 틀려도 잡히게). */
  console.log('■ 정직성 — 로봇 장부가 확정한 목록·열리지 않음 (장부를 바꿔 주고 앱을 다시 연다)');
  const realLedger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { updatedAt: '', v: 1, bad: {} };
  const keyOf = (id) => SL.decodeUrlEntities(reg.find((r) => r.id === id).sourceUrl);
  /* 장부로 갈래가 바뀌는 카드 — 주소 꼴이 표식·목록+번호면 장부와 상관없이 늘 '목록'이라 시험이 안 된다 */
  const posts = checked.filter((c) => !['marker', 'listid', 'none'].includes(SL.linkShape(reg.find((r) => r.id === c.id).sourceUrl))).map((c) => c.id);
  /* 그런 카드가 하나뿐이면 같은 카드로 두 번(목록 → 열리지 않음) 연다 */
  const rounds = posts.length >= 2 ? [[[posts[0], 'list'], [posts[1], 'gone']]]
    : posts.length === 1 ? [[[posts[0], 'list']], [[posts[0], 'gone']]] : [];
  if (!rounds.length) bad(`장부 시험에 쓸 보통 주소 ${SCHOOL} 카드가 없습니다 — ②에서 연 카드 ${checked.length}건`);
  const WANT = {
    list: { label: '게시판 목록 ↗', check: (c) => /목록에서 .+을\(를\) 찾아 눌러 주세요/.test(c.legend), say: '「목록에서 … 찾아 눌러 주세요」 안내', josa: '가' },
    gone: { label: '원문 공고(확인 필요) ↗', check: (c) => c.legend.includes('이 주소가 열리지 않았어요 (2026-10-04 확인)'), say: '「이 주소가 열리지 않았어요 (2026-10-04 확인)」 한 줄', josa: '이' },
  };
  for (const marks of rounds) {
    ledgerOverride = { ...realLedger, updatedAt: '2026-10-04T00:00:00.000Z', bad: { ...(realLedger.bad || {}), ...Object.fromEntries(marks.map(([id, v]) => [keyOf(id), { v, at: '2026-10-04' }])) } };
    SL.setLinkChecks(ledgerOverride);
    /* 홈에서 다시 연다 — 다시 열면 마지막 화면으로 돌아가므로(resume.js) 탐색 화면에서 열면 홈을 기다리다 멈춘다 */
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForTimeout(300);
    const served = page.waitForResponse((r) => /\/data\/link-check\.json/.test(r.url()), { timeout: 10000 }).then(() => true).catch(() => false);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#screen-home:not([hidden])');
    if (!(await served)) bad('앱을 다시 열었는데 장부(data/link-check.json)를 받지 않았습니다 — 바꿔 준 장부가 앱에 안 닿았다');
    await dismissNotify(page);
    await page.click('.nav-item[data-nav="explore"]');
    await page.waitForSelector(`#explore-list [data-detail="${marks[0][0]}"]`, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    const { got } = await readSheets(marks.map(([id]) => id));
    for (const [id, v] of marks) {
      const c = got.find((x) => x.id === id);
      if (!c) { bad(`장부로 「${v}」를 준 카드 ${id} 의 시트에서 원문 링크를 못 읽었습니다`); continue; }
      const want = judge(c);
      const w = WANT[v];
      const line = `${id} · 장부 ${v} · ${c.label}`;
      if (want.cls !== (v === 'list' ? 'list' : 'trouble')) bad(`규칙이 바꿔 준 장부를 안 읽었습니다(갈래 ${want.cls}) — ${line}`);
      else if (c.label !== w.label) bad(`장부 「${v}」인데 이름이 「${w.label}」이 아닙니다 — ${line}`);
      else if (!w.check(c)) bad(`장부 「${v}」인데 시트 맨 아래에 ${w.say}${w.josa} 없습니다 — ${line} · 화면 「${c.legend.replace(/\s+/g, ' ').slice(-120)}」`);
      else ok(`장부 「${v}」 — 「${c.label}」 + ${w.say}`);
    }
  }
  ledgerOverride = null;
  SL.setLinkChecks(realLedger);
  /* 갈래별로 센다 — 목록·문제를 한 장도 안 쟀으면 ③은 아무것도 증명하지 않았다(조용한 통과 금지) */
  const clsLine = Object.entries(seenCls).map(([k, n]) => `${k} ${n}`).join(' · ');
  if (!(seenCls.list || 0) || !(seenCls.trouble || 0)) bad(`목록·문제 갈래를 각각 한 장 이상 재지 못했습니다 — 잰 갈래: ${clsLine || '없음'}`);
  else ok(`잰 갈래: ${clsLine}`);

  if (errors.length) bad('콘솔 오류: ' + errors.slice(0, 3).join(' | '));
  else ok('콘솔 오류 없음');
  await browser.close();

  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 원문 링크 검사 전부 통과');
  process.exit(fail ? 1 : 0);
})();
