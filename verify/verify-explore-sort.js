/* 장학금 찾기 정렬 검증 (2026-08-26)
   개발자 요청: 우측 상단에 정렬 버튼(↑↓ + 지금 기준), 기준 3개.
   🔴 이 드라이버가 지키는 함정 둘 — 둘 다 코드로만 보면 안 보인다:
     ① `deadlineTs()`가 마감 없는 공고에 `Infinity`를 준다 → 마감 없는 131건이
        맨 위로 튀어나오는지 실제 순서로 확인한다
     ② `$$('.filter-chip')`가 문서 전역 선택이다 → 정렬을 바꿔도 위쪽 필터 칩의
        active가 안 흔들리는지 확인한다
   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         CHROME_PATH=... PORT=<포트> node verify/verify-explore-sort.js
   🔴 **PORT= 를 반드시 준다** — 8123 에는 다른 워크트리 서버가 떠 있을 수 있고,
      그러면 남의 코드를 재게 된다(2026-09-02에 실제로 겪었다). */
const { chromium } = require('playwright-core');
const { assertOwnServer, webfontBanner } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다


let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

const PROFILE = {
  name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
  year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울',
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {},
};

(async () => {
  /* 🔴 재기 전에 **이 서버가 내 앱인지** 확인한다 — 아니면 여기서 멈춘다.
     이 저장소는 작업 폴더를 여러 개 두고 쓰는데, 8123 에 다른 폴더의 서버가 떠 있으면
     그 옛 앱을 재고도 아무도 모른다(빨간불이든 **가짜 초록불이든**). 규칙은 onboard-helper 한 곳. */
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript((p) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [] }));
    /* 이어보기 장부도 지운다 — 남겨 두면 앱이 앞 검사에서 보던 화면으로 돌아간다 (2026-09-09) */
    localStorage.removeItem('handaejang.resume');
  }, PROFILE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {}); else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(800);

  /* 목록의 순서를 '무엇으로 정렬됐는지 검증 가능한 값'으로 뽑는다 — 카드에는 마감·등록일이
     글자로 안 나오므로 앱이 실제로 쓰는 데이터에서 id 순서를 받아 대조한다. */
  const orderKeys = () => page.evaluate(() => {
    const ids = [...document.querySelectorAll('#explore-list .sch-card')].map((e) => e.dataset.detail);
    const find = (id) => (typeof allScholarships === 'function' ? allScholarships() : []).find((s) => s.id === id) || {};
    /* 🔴 마감이 지났는지는 **앱의 dday 로 판정한다** (2026-08-30). 검사에서 따로
       `new Date().toISOString()` 으로 오늘을 만들면 그건 **UTC** 라 KST 와 하루 어긋나고,
       그날 마감인 공고가 '미래'로 분류돼 멀쩡한 정렬이 빨간불이 된다(실제로 그랬다).
       이 저장소의 규칙 그대로 — 판정을 베끼지 말고 앱 함수를 그대로 쓴다. */
    return ids.map((id) => { const s = find(id);
      return { id, deadline: s.deadline || null, listedAt: s.listedAt || null,
        days: s.deadline ? dday(s.deadline).days : null }; });
  });

  /* 🔴 **구획은 2026-09-12 개발자 지시로 없앴다** ("오늘 내일 마감 이번 주 마감 이번 달 마감
     삭제 후 하나로 통합, 적합도 순 마감 임박순 이런 거 하나도 안 지켜짐").
     2026-09-10 페이스리프트가 마감으로 7구획을 나눈 뒤, 구획 순서가 마감으로 고정이라
     고른 정렬은 구획 **안에서만** 살아 있었다 — 화면에서는 정렬이 통째로 안 먹는 것으로 보였다.
     그래서 이 드라이버도 **목록 전체의 DOM 순서**로 되돌아간다(2026-09-10 이전 방식).
     ⚠️ 구획을 다시 만들려거든 정렬을 어떻게 살릴지부터 정할 것 — 둘은 같은 자리를 다툰다. */
  const cardRows = () => page.evaluate(() => {
    const find = (id) => (typeof allScholarships === 'function' ? allScholarships() : []).find((s) => s.id === id) || {};
    return [...document.querySelectorAll('#explore-list .sch-card')].map((e) => {
      const s = find(e.dataset.detail);
      return { id: e.dataset.detail, deadline: s.deadline || null, listedAt: s.listedAt || null,
        no: !!e.querySelector('.badge-fit-no') };
    });
  });
  eq('목록에 구획이 없다 (한 목록이다)',
    await page.$$eval('#explore-list .list-group', (e) => e.length), 0);

  console.log('■ 기본 상태');
  eq('버튼 라벨이 적합도순이다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');
  const box = await page.$eval('#explore-sort-btn', (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  eq(`정렬 버튼 터치 타깃 44px 이상 (${box.w}×${box.h})`, box.h >= 44, true);
  eq('아이콘은 하나뿐이다', await page.$$eval('#explore-sort-btn svg', (e) => e.length), 1);

  /* 🔴 **동작이 바뀌었다 — 검사가 옛 설계를 붙들고 있었다** (2026-09-02).
     2026-08-26 판은 '눌러서 순환 · 길게 눌러 목록' 이었는데, app.js 가 그걸 **일부러**
     걷어냈다(주석 그대로: "지금 무슨 기준인지 눌러 보기 전에는 알 수 없고, 길게 누르기는
     아무도 발견하지 못하는 동작이다. 한 번 눌러 목록에서 고르는 쪽이 짧다").
     그 뒤로 이 절 6항목이 죽어 있었다 — 앱은 멀쩡한데 검사만 빨간불이었다.
     지금 지키는 것: **한 번 누르면 목록이 열리고, 골라야 기준이 바뀐다.** */
  console.log('\n■ 눌러서 목록 · 골라서 바뀐다');
  eq('처음에는 목록이 안 보인다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), false);
  await page.click('#explore-sort-btn'); await page.waitForTimeout(400);
  eq('한 번 누르면 목록이 열린다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), true);
  /* 🔴 열기만 해서는 기준이 바뀌면 안 된다 — 옛 '순환' 이 남아 있으면 여기서 걸린다 */
  eq('  열기만 해서는 기준이 안 바뀐다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');
  eq('선택지가 3개다', await page.$$eval('#explore-sort-menu [data-sort]', (e) => e.map((x) => x.dataset.sort)), ['fit', 'deadline', 'listed']);
  eq('부연설명 없이 제목만 나온다',
    await page.$$eval('#explore-sort-menu [data-sort]', (e) => e.map((x) => x.textContent.trim())),
    ['적합도순', '마감 임박순', '등록 최신순']);
  const anchor = await page.evaluate(() => {
    const b = document.querySelector('#explore-sort-btn').getBoundingClientRect();
    const m = document.querySelector('#explore-sort-menu').getBoundingClientRect();
    return { below: m.top >= b.bottom - 1, rightAligned: Math.abs(m.right - b.right) <= 2, offscreen: m.right > innerWidth || m.left < 0 };
  });
  eq('목록이 아이콘 바로 아래에 뜬다', anchor.below, true);
  eq('오른쪽이 버튼과 맞는다', anchor.rightAligned, true);
  eq('화면 밖으로 안 나간다', anchor.offscreen, false);

  await page.click('#explore-sort-menu [data-sort="deadline"]'); await page.waitForTimeout(400);
  eq('고르면 그 기준으로 바뀐다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '마감 임박순');
  eq('  고르고 나면 목록이 닫힌다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), false);
  await page.click('#explore-sort-btn'); await page.waitForTimeout(300);
  await page.click('#explore-sort-menu [data-sort="fit"]'); await page.waitForTimeout(400);
  eq('  다시 적합도순으로 돌아온다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');

  console.log('\n■ 마감 임박순');
  /* ⚠️ 앞 절이 목록을 **닫고** 끝난다(골랐으니까). 옛 판은 열어 둔 채 끝나서 이 줄이
     바로 고를 수 있었다 — 절 사이에 상태를 넘기지 말고 여기서 연다. */
  await page.click('#explore-sort-btn'); await page.waitForTimeout(300);
  await page.click('#explore-sort-menu [data-sort="deadline"]');
  await page.waitForTimeout(600);
  eq('고르면 목록이 닫힌다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), false);
  eq('라벨이 바뀐다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '마감 임박순');
  let rows = await orderKeys();
  /* 순서는 세 덩어리다: ① 앞으로 다가올 마감(빠른 순) ② 기한 미확정 ③ 이미 지난 마감.
     🔴 ②가 ①보다 앞에 오면 `deadlineTs()`의 Infinity 함정에 빠진 것이다.
     🔴 ③이 앞에 오면 '임박순'인데 지나간 게 위에 오는 것이다(2026-08-26 스크린샷으로 발견). */
  const bucket = (r) => (!r.deadline ? 1 : r.days >= 0 ? 0 : 2);
  eq('앞으로 올 마감 → 기한 미확정 → 지난 마감 순으로 묶인다',
    rows.every((r, i, arr) => i === 0 || bucket(arr[i - 1]) <= bucket(r)), true);
  const withD = rows.filter((r) => bucket(r) === 0).length;
  /* 🔴 이미 마감된 공고가 '마감 임박순' 맨 위에 오면 안 된다 — 마감 7일까지 남기는 규칙 때문에
     그냥 날짜 오름차순으로 두면 지나간 것이 앞에 온다(2026-08-26 스크린샷으로 발견). */
  const future = rows.slice(0, withD);
  eq(`앞으로 올 마감 ${future.length}건이 빠른 순이다`,
    future.every((r, i, arr) => i === 0 || arr[i - 1].deadline <= r.deadline), true);
  eq('이미 지난 마감은 목록 끝에 있다',
    rows.filter((r) => bucket(r) === 2)
        .every((r) => rows.indexOf(r) >= rows.length - rows.filter((x) => bucket(x) === 2).length), true);

  console.log('\n■ 등록 최신순');
  await page.click('#explore-sort-btn'); await page.waitForTimeout(300);
  await page.click('#explore-sort-menu [data-sort="listed"]'); await page.waitForTimeout(600);
  eq('라벨이 바뀐다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '등록 최신순');
  const listedRows = await cardRows();
  const key = (r) => r.listedAt || r.deadline || '';
  const withKey = listedRows.filter((r) => key(r)).length;
  eq('값 없는 카드가 앞으로 오지 않는다', listedRows.slice(0, withKey).every((r) => key(r)), true);
  eq('등록일 내림차순이다 (목록 전체에서)',
    listedRows.slice(0, withKey).every((r, i, arr) => i === 0 || key(arr[i - 1]) >= key(r)), true);

  console.log('\n■ 적합도순 — 미달은 맨 아래 (개발자 결정)');
  await page.click('#explore-sort-btn'); await page.waitForTimeout(300);
  await page.click('#explore-sort-menu [data-sort="fit"]'); await page.waitForTimeout(600);
  /* 미달은 **목록 맨 아래**로 모인다 — 2026-08-26 개발자 결정("적합도를 기준으로 했을 때는
     맨 아래에 두는 게 맞지") 그대로다. 구획이 없어졌으니 재는 자리도 목록 전체로 돌아왔다. */
  const fitRows = await cardRows();
  const noIdx = fitRows.map((r, i) => (r.no ? i : -1)).filter((i) => i >= 0);
  eq('미달 카드가 목록 끝에 모여 있다',
    noIdx.length === 0 || noIdx[0] + noIdx.length === fitRows.length, true);
  /* 🔴 **고른 정렬이 목록 전체에 걸리는가** — 2026-09-12 지적의 본체다("정렬 이런 거
     하나도 안 지켜짐"). 구획이 있을 때는 이 성질이 성립할 수 없었다.
     기대값은 앱의 정렬 함수 그대로 만든다(규칙을 여기 베끼면 갈라진다). */
  const fitOrder = await page.evaluate(() => {
    const shown = [...document.querySelectorAll('#explore-list .sch-card')].map((e) => e.dataset.detail);
    const ms = getMatches().filter((m) => shown.includes(m.sch.id));
    const want = ms.slice().sort((a, b) => fitRank(a) - fitRank(b) || EXPLORE_SORTS.fit.cmp(a, b))
      .map((m) => m.sch.id);
    return { shown, want };
  });
  eq('적합도순이 목록 전체에 그대로 걸린다', fitOrder.shown, fitOrder.want);

  console.log('\n■ 필터 칩과 서로 간섭하지 않는다 (.filter-chip 전역 선택 함정)');
  await page.click('.filter-chip[data-filter="교외"]'); await page.waitForTimeout(500);
  await page.click('#explore-sort-btn'); await page.waitForTimeout(300);
  await page.click('#explore-sort-menu [data-sort="deadline"]'); await page.waitForTimeout(600);
  eq('정렬을 바꿔도 필터 칩 active가 그대로다',
    await page.$$eval('.filter-chip.active', (e) => e.map((x) => x.dataset.filter)), ['교외']);
  /* 🔴 2026-09-10 페이스리프트로 교내·교외가 **배지에서 기관명 줄의 글자**로 옮겨졌다
     (한 카드에 배지가 최대 5개 붙던 것을 1개로 줄이면서). 뜻은 그대로라 재는 곳만 바꾼다. */
  eq('필터도 그대로 걸려 있다',
    await page.$$eval('#explore-list .sch-card .sch-org',
      (e) => [...new Set(e.map((x) => x.textContent.split('·')[0].trim()))]), ['교외']);

  /* ══ 홈 '마감 임박' 차례 (2026-09-12 · 노션 UI-14) ═══════════════════════════
     개발자 지적: "적합도가 낮아도 마감이 임박하면 홈에 뜬다 — 학생 입장에서는 '굳이…' 다."
     옛 규칙은 마감 오름차순뿐이라 실측(한국외대)에서 맨 위 둘이 **적합도 15%** 였다.
     🔴 기대 순서를 여기서 **손으로 적지 않는다** — 앱의 getMatches·fitRank·dday·byDeadline 을
        그대로 불러 만든다. 검사가 규칙을 한 벌 더 가지면 앱이 바뀔 때 조용히 갈라진다. */
  /* ══ '교내' 칸 = 등록 공고 + 학교 게시판 글 (2026-09-17 개발자 지시) ══════════
     "교내와 우리학교 탭에서 같은 공고가 계속 발견되고 있는데 우리학교 탭을 없애 교내로 합병."
     2026-09-12(노션 UI-16)에 뺐던 '우리 학교' 칸을 '교내'에 합쳤다 — 칸만 합치고
     **구역은 남긴다**(게시판 글은 적합도·마감 판정이 없어 같은 목록으로 정렬할 수 없다). */
  /* 🔴 **필터 칩은 한 줄이다** (2026-09-12 개발자 지시: "신청가능만 밑으로 내리지 말고 일렬로").
     칩이 다섯이던 시절 줄바꿈으로 접혔다. 다시 스크롤로 돌리지 않고 **들어가게** 만들었고
     (여백 14 → 10 · 칩 사이 8 → 6 · 좌우 화면 끝까지), 2026-09-17 에 둘을 없애 셋이 됐다.
     ⚠️ 글자 크기는 재지 않는다 — 2026-09-11 개발자 지시로 크기 조정은 전부 되돌린 상태다. */
  console.log('\n■ 필터 칩 한 줄 (2026-09-12)');
  /* 🔴 **320px 도 잰다** — 거기서는 한 줄을 요구하지 않고 **잘리지 않는 것**만 요구한다.
     처음엔 360·390 만 재서, 320px 에서 마지막 칩이 35px 잘린 채 초록불이었다(코드 리뷰 실측).
     '잘린 칩이 없다' 가 이 절의 본뜻이고 '한 줄' 은 개발자가 정한 목표 폭에서의 요구다. */
  for (const w of [320, 360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    const row = await page.evaluate(() => {
      const rects = [...document.querySelectorAll('#explore-filters .filter-chip')]
        .map((c) => c.getBoundingClientRect());
      return { n: rects.length, 줄수: new Set(rects.map((r) => Math.round(r.top))).size,
        전부보임: rects.every((r) => r.left >= 0 && r.right <= window.innerWidth) };
    });
    if (w >= 360) eq(`${w}px — 칩 ${row.n}개가 한 줄이다`, row.줄수, 1);
    else eq(`${w}px — 여기서는 접는다 (한 줄을 요구하지 않는다)`, row.줄수 >= 1, true);
    eq(`  ${w}px — 잘린 칩이 없다 (2026-08-30 에 스크롤로 반쯤 잘렸던 자리)`, row.전부보임, true);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(250);

  /* 🔴 **없앤 칩 둘이 되돌아오면 빨간불** (2026-09-17 개발자 지시 · 관문).
     '우리 학교'는 '교내'에 합쳤고, '신청 가능만'은 `applyLock` 이 자격으로 신청을 막지
     않게 된 뒤(2026-09-13) 뜻이 어긋나 없앴다. 조사로 되살리지 말 것. */
  console.log('\n■ 칩은 셋 — 없앤 둘이 돌아오지 않는다 (2026-09-17)');
  eq('전체·교내·교외 셋뿐이다', await page.$$eval('#explore-filters .filter-chip',
    (els) => els.map((e) => e.dataset.filter)), ['all', '교내', '교외']);

  console.log('\n■ 교내 칸 — 등록 공고와 게시판 글이 한 자리 (2026-09-17)');
  /* 🔴 **오늘 수집분에 기대지 않는다** — 실시간 공고는 60일이 지나면 지워지고(collect.mjs),
     한 학교의 수집이 며칠 멈추면 0건이 된다. 그러면 앱은 멀쩡한데 이 절이 빨간불이 되고,
     이 저장소는 그런 관문이 통째로 꺼진 적이 있다. 그래서 한 건을 심어 둔다. */
  await page.evaluate(() => {
    const p = state.profile;
    liveNotices = { updatedAt: '2026-09-12', items: (liveNotices && liveNotices.items || []).concat([{
      title: '검사용 우리 학교 공고', school: p.school, campus: p.campus || '',
      url: 'https://example.ac.kr/notice/1', attachments: [], foundAt: '2026-09-12',
    }]) };
    renderHome();
  });
  /* 🔴 **게시판 글은 이제 홈에 있다** (2026-09-18 개발자 지시 · 아래 단언들이 그것을 못 박는다).
     2026-09-17 에 '교내' 칸에 합쳤더니 **교내 칸에 외부 장학금이 섞여** 보였다 —
     *"교내 장학금만 볼 수 있는 창을 누르면 교내에서 주최하는 … 것만 올라왔으면 좋겠어 …
       어디에 게시되느냐가 아니라 어떤 재단이 주최하는가가 기준이 되어야 돼."*
     게시판 글은 제목·링크뿐이라 주최를 모르므로 '교내' 라고 부를 수 없다. */
  await page.click('.filter-chip[data-filter="교내"]'); await page.waitForTimeout(500);
  const nt = await page.evaluate(() => ({
    교외섞임: [...document.querySelectorAll('#explore-list .sch-card:not(.notice-card)')]
      .map((e) => e.dataset.detail)
      .filter((id) => ((allScholarships() || []).find((s) => s.id === id) || {}).type === '교외').length,
    /* 🔴 **화면을 한정해 센다** — `#live-notices` 는 이제 홈에 있고, 화면이 숨어 있어도
       querySelectorAll 은 찾아낸다. 한정하지 않으면 '교내 칸에 없다'가 영영 거짓이 된다. */
    탐색안_공고: document.querySelectorAll('#screen-explore .notice-card').length,
    홈안_공고: document.querySelectorAll('#screen-home #live-notices .notice-card').length,
    정렬버튼: !document.querySelector('#explore-sort-btn').hidden,
    /* 🔴 '마감 임박' 배지는 여기 없어야 한다 — 우리는 이 글의 마감일을 모른다(원칙 8-1) */
    임박배지: document.querySelectorAll('#live-notices .badge-dday').length,
    /* 🔴 교내/교외를 말하지 않는다 — 주최를 모르므로(같은 지시) */
    종류말함: [...document.querySelectorAll('#live-notices .notice-card .sch-org')]
      .filter((e) => /교내|교외/.test(e.textContent)).length,
  }));
  eq('🔴 게시판 글이 교내 칸에 나오지 않는다 (주최를 모르므로)', nt.탐색안_공고, 0);
  eq('  대신 홈에 나온다 (사라지지 않는다)', nt.홈안_공고 > 0, true);
  eq('  등록 공고 자리에 교외가 섞이지 않는다', nt.교외섞임, 0);
  eq('  정렬 버튼은 보인다 (등록 공고가 함께 있으므로)', nt.정렬버튼, true);
  eq('  마감일을 모르므로 「마감 임박」이라고 하지 않는다', nt.임박배지, 0);
  eq('  카드가 교내/교외를 말하지 않는다', nt.종류말함, 0);
  /* 🔴 교내 등록분이 0건일 때 **'없어요' 로만 끝내지 않는다** — 학교에 교내 장학금이 없다는
     뜻으로 읽힌다. 우리가 아직 안 읽었을 뿐이므로 어디를 보면 되는지(홈) 말한다.
     🔴 **등록분을 실제로 0건으로 만들어 재야 한다** — 이 프로필에는 교내 등록 공고가
        있어서, 그냥 재면 빈 상태가 아예 안 일어나 되돌려도 초록불이 된다(실측으로 걸렸다). */
  eq('  교내 등록분이 0건이면 홈을 가리킨다', await page.evaluate(() => {
    const keep = registeredList;
    registeredList = registeredList.filter((s) => s.type !== '교내');
    renderExplore();
    const el = document.querySelector('#explore-list .empty');
    const got = {
      등록카드: document.querySelectorAll('#explore-list .sch-card').length,
      홈안내: !!(el && /홈/.test(el.textContent)),
    };
    registeredList = keep; renderExplore();
    return got;
  }), { 등록카드: 0, 홈안내: true });
  /* 🔴 탐색 검색이 **홈의 게시판 글을 건드리지 않는다** — 다른 화면의 목록이다.
     예전엔 이 목록이 탐색에 있어 검색을 걸어야 했다(2026-09-12 UI-16). 자리가 바뀌면
     그 이유도 같이 사라진다 — 남겨 두면 홈 목록이 탐색 검색어로 조용히 비어 버린다. */
  await page.fill('#explore-search', 'ㅁㄴㅇㄹ'); await page.waitForTimeout(400);
  /* 🔴 **홈을 다시 그려 놓고 재야 한다** (2026-09-18 코드 리뷰). 검색은 탐색 화면만 다시
     그리므로, 그냥 세면 앞서 그려 둔 카드가 그대로 있어 **되돌려도 초록불**이다
     (검색이 이 목록에 다시 걸려도 못 잡는다). 홈을 그 검색어가 살아 있는 채로 다시 그린다. */
  eq('  탐색 검색이 홈의 게시판 글을 비우지 않는다', await page.evaluate(() => {
    renderHome();
    return document.querySelectorAll('#screen-home #live-notices .notice-card').length > 0;
  }), true);
  await page.fill('#explore-search', ''); await page.waitForTimeout(300);
  /* 🔴 도우미·알림이 '전체 보기'라고 적어 놓고 걸린 칸을 그대로 두면 약속을 안 지킨다
     (2026-09-12 코드 리뷰가 '우리 학교' 칸에서 실측으로 잡았다: 카드 0장짜리 화면). */
  eq('「전체 보기」로 오면 칸이 전체로 돌아온다', await page.evaluate(() => {
    exploreShowAll();
    return { 칩: (document.querySelector('.filter-chip.active') || {}).dataset.filter,
      카드: document.querySelectorAll('#explore-list .sch-card').length > 0 };
  }), { 칩: 'all', 카드: true });
  await page.click('.filter-chip[data-filter="all"]'); await page.waitForTimeout(500);
  eq('전체 칸에도 붙지 않는다 (탐색 화면 어디에도 없다)',
    await page.$$eval('#screen-explore .notice-card', (e) => e.length), 0);

  console.log('\n■ 홈 차례 — 적합도와 마감일을 한 점수로 (2026-09-17 개발자 지시)');
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(1500);            // 히어로 countUp(900ms)이 멈출 때까지
  /* 🔴 **오늘 데이터에 기대지 않는다** (2026-09-12 코드 리뷰). 지금은 마감 7일 안쪽 공고가
     27건이지만 한가한 주에는 0이 될 수 있고, 그러면 이 절이 앱은 멀쩡한데 빨간불이 된다
     (조용히 건너뛰는 것도 나쁘다 — 그물이 걷힌 줄 아무도 모른다). verify-interactions 가
     쓰는 방식 그대로 임박 공고를 심어 둔다. 심어도 규칙은 그대로라 아래 대조는 유효하다. */
  await page.evaluate(() => {
    const iso = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('sv-SE');
    registeredList = registeredList.concat([1, 2, 3, 4].map((n) => ({
      id: `fixture-home-d${n}`, name: `검사용 마감 임박 ${n}`, provider: '검사', type: '교외',
      amount: '검사', amountValue: 0, deadline: iso(n),
    })));
    renderHome();
  });
  await page.waitForTimeout(1200);
  const home = await page.evaluate(() => {
    const cand = getMatches().filter((m) => m.result.status !== 'ineligible'
      && dday(m.sch.deadline).days >= 0 && notStale(m.sch));
    /* 🔴 기대 차례는 **앱의 비교 함수 그대로** 만든다 — 예전엔 여기에 정렬식을 베껴 뒀는데,
       그러면 앱이 바뀔 때 검사가 조용히 갈라진다(2026-09-17 에 실제로 같이 고쳐야 했다).
       이 절이 지키는 것은 '그린 차례가 앱의 규칙과 같은가'이고, 규칙 **자체**의 뜻은
       test-collector 의 '홈 차례' 절이 픽스처로 못 박는다(둘의 역할이 다르다). */
    const want = cand.slice().sort(byHomeOrder);
    const shown = [...document.querySelectorAll('#home-deadline-list > *')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => (e.querySelector('[data-detail]') || {}).dataset?.detail || null);
    return {
      후보: cand.length,
      임박: cand.filter((m) => dday(m.sch.deadline).cls === 'urgent').length,
      보임: shown,
      그려둠: document.querySelectorAll('#home-deadline-list > *').length,
      기대: want.slice(0, HOME_DEADLINE_TOP).map((m) => m.sch.id),
      제목: (document.querySelector('#screen-home .section-head h3') || {}).textContent,
      금액: (document.querySelector('#hero-amount') || {}).textContent,
      펴는장수: HOME_DEADLINE_TOP,   /* '셋'을 여기 박지 않는다 — 앱이 쓰는 상수를 그대로 읽는다 */
    };
  });
  /* ⚠️ 이 줄은 **픽스처를 심은 뒤**라 사실상 늘 참이다 — 실제 데이터의 양을 말하지 않는다.
     뜻은 '아래 대조가 빈 목록을 보고 통과하지는 않는다' 하나뿐이다(2026-09-12 코드 리뷰). */
  eq('홈에 띄울 후보가 있다 (아래 대조가 빈 목록을 보고 통과하지 않는다)',
    home.후보 > home.펴는장수 && home.임박 > home.펴는장수, true);
  eq('상수가 말하는 장수만 편다', home.보임.length, home.펴는장수);
  eq('나머지는 그려 두고 가린다 (다시 그리지 않으려고)', home.그려둠 > home.펴는장수, true);
  /* 🔴 차례는 **앱의 규칙으로 만든 기대값**과 통째로 대조한다. 예전엔 여기에 '오른 카드의
     적합도가 못 오른 임박 카드보다 낮지 않다'를 덧붙였는데, 그건 앱이 `fitRank` 를 먼저 보는
     것을 무시한 규칙이라 **앱이 맞는 날에도 빨간불**이 될 수 있었다(자격 미확인 35점이
     확인된 33점보다 위로 가는 날). 이 한 줄이 이미 순서 전체를 지킨다. */
  eq('편 카드가 앱의 규칙과 같은 차례다', home.보임, home.기대);
  /* 🔴 개발자 지시의 앞 절반 — "마감임박이라는 수치를 지우고" (2026-09-17).
     칸 이름이 '마감 임박'인데 안쪽 차례는 적합도라 화면이 제 제목과 다른 말을 했다.
     되돌아오면 여기서 잡는다. 마감은 카드마다 붙는 D-n 글자가 그대로 전한다. */
  eq('구획 제목이 더 이상 「마감 임박」이 아니다', /마감\s*임박/.test(home.제목 || ''), false);
  eq('  그래도 이름이 있다 (빈 제목으로 지우지 않았다)', (home.제목 || '').trim().length > 1, true);
  /* 🔴 지시의 뒷 절반 — 마감일이 **동점 처리로만** 쓰이지 않는가. 같은 적합도의 카드 둘을
     마감만 다르게 심어, 가까운 쪽이 위로 오는지 본다(여기까지는 옛 규칙도 통과한다).
     ⚠️ 규칙의 뜻 전체(적합도가 앞서면 마감이 멀어도 위)는 test-collector 가 잰다 —
        여기서는 실제 데이터에 그런 짝이 있으리라 보장할 수 없다. */
  eq('같은 적합도면 마감이 가까운 쪽이 위다', await page.evaluate(() => {
    const mk = (id, d) => ({ sch: { id, deadline: new Date(Date.now() + d * 86400000)
      .toLocaleDateString('sv-SE') }, fit: 40, fd: { unread: false, fails: [] } });
    return [mk('먼', 9), mk('가까운', 2)].sort(byHomeOrder).map((m) => m.sch.id);
  }), ['가까운', '먼']);

  /* 더보기 — **다시 그리지 않고 편다**(히어로 금액이 또 세어 올라가면 안 된다).
     🔴 클릭을 page.click 으로 하면 Playwright 가 버튼을 화면 안으로 스크롤해서
        '스크롤이 튀었다'로 잘못 읽힌다. 눌리는 것만 보려면 요소에 직접 건다. */
  const before = await page.evaluate(() => ({ y: window.scrollY, won: $('#hero-amount').textContent }));
  await page.$eval('#home-deadline-more', (b) => b.click());
  await page.waitForTimeout(250);
  const open = await page.evaluate(() => ({
    보임: [...document.querySelectorAll('#home-deadline-list > *')].filter((e) => e.offsetParent !== null).length,
    글자: $('#home-deadline-more').textContent.trim(),
    aria: $('#home-deadline-more').getAttribute('aria-expanded'),
    y: window.scrollY, won: $('#hero-amount').textContent,
  }));
  eq('더보기를 누르면 나머지가 펴진다', open.보임 > 3, true);
  eq('그때 버튼은 접기가 된다', [open.글자, open.aria], ['접기', 'true']);
  eq('히어로 금액은 다시 세지 않는다 (목록을 다시 그리지 않는다)', open.won, before.won);
  eq('스크롤도 그대로다', open.y, before.y);
  await page.$eval('#home-deadline-more', (b) => b.click());
  await page.waitForTimeout(250);
  eq('다시 누르면 상수가 말하는 장수로 접힌다',
    await page.$$eval('#home-deadline-list > *', (e) => e.filter((x) => x.offsetParent !== null).length),
    home.펴는장수);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  /* 폭에 민감한 항목이 있다 — 글꼴이 안 실린 환경이면 그 사실을 먼저 말한다.
     🔴 browser.close() **앞**이어야 한다 — 닫은 뒤에는 page 가 죽어 조용히 빈 문자열이 된다
        (처음에 뒤에 뒀다가 아무 말도 안 해서 잡았다). */
  const wfBanner = fail ? await webfontBanner(page) : '';
  await browser.close();
  if (wfBanner) console.log(wfBanner);
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 정렬 전부 통과');
  process.exit(fail ? 1 : 0);
})();
