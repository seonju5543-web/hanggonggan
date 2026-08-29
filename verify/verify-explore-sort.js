/* 장학금 찾기 정렬 검증 (2026-08-26)
   개발자 요청: 우측 상단에 정렬 버튼(↑↓ + 지금 기준), 기준 3개.
   🔴 이 드라이버가 지키는 함정 둘 — 둘 다 코드로만 보면 안 보인다:
     ① `deadlineTs()`가 마감 없는 공고에 `Infinity`를 준다 → 마감 없는 131건이
        맨 위로 튀어나오는지 실제 순서로 확인한다
     ② `$$('.filter-chip')`가 문서 전역 선택이다 → 정렬을 바꿔도 위쪽 필터 칩의
        active가 안 흔들리는지 확인한다
   실행: node verify/verify-explore-sort.js   (CHROME_PATH + localhost:8123) */
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다

/* 길게 누르기 — 진짜 TouchEvent로 재현한다. 마우스로만 보면 터치 기기에서
   touchend 뒤에 오는 click까지 세는 함정을 못 잡는다(신청 내역 스와이프와 같은 계열). */
async function longPress(page, sel, ms = 700) {
  await page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: el, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
  });
  await page.waitForTimeout(ms);
  await page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: el, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
    el.click();   // 브라우저가 touchend 뒤에 보내는 click — 삼켜져야 한다
  });
  await page.waitForTimeout(300);
}

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
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript((p) => localStorage.setItem('handaejang.v1',
    JSON.stringify({ profile: p, applications: [] })), PROFILE);
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

  console.log('■ 기본 상태');
  eq('버튼 라벨이 적합도순이다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');
  const box = await page.$eval('#explore-sort-btn', (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
  eq(`정렬 버튼 터치 타깃 44px 이상 (${box.w}×${box.h})`, box.h >= 44, true);
  eq('아이콘은 하나뿐이다', await page.$$eval('#explore-sort-btn svg', (e) => e.length), 1);

  console.log('\n■ 눌러서 순환 (개발자 지시 2026-08-26)');
  eq('처음에는 목록이 안 보인다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), false);
  await page.click('#explore-sort-btn'); await page.waitForTimeout(500);
  eq('한 번 누르면 마감 임박순', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '마감 임박순');
  eq('눌렀다고 목록이 뜨지는 않는다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), false);
  await page.click('#explore-sort-btn'); await page.waitForTimeout(400);
  eq('두 번이면 등록 최신순', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '등록 최신순');
  await page.click('#explore-sort-btn'); await page.waitForTimeout(400);
  eq('세 번이면 적합도순으로 돌아온다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');

  console.log('\n■ 길게 눌러 목록 (아이콘 바로 아래)');
  await longPress(page, '#explore-sort-btn');
  eq('목록이 뜬다', await page.$eval('#explore-sort-menu', (e) => e.offsetParent !== null), true);
  eq('선택지가 3개다', await page.$$eval('#explore-sort-menu [data-sort]', (e) => e.map((x) => x.dataset.sort)), ['fit', 'deadline', 'listed']);
  eq('부연설명 없이 제목만 나온다',
    await page.$$eval('#explore-sort-menu [data-sort]', (e) => e.map((x) => x.textContent.trim())),
    ['적합도순', '마감 임박순', '등록 최신순']);
  /* 🔴 길게 눌러 목록을 연 뒤 오는 click을 안 삼키면 기준이 한 칸 넘어간다 */
  eq('길게 눌러도 기준이 넘어가지 않는다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '적합도순');
  const anchor = await page.evaluate(() => {
    const b = document.querySelector('#explore-sort-btn').getBoundingClientRect();
    const m = document.querySelector('#explore-sort-menu').getBoundingClientRect();
    return { below: m.top >= b.bottom - 1, rightAligned: Math.abs(m.right - b.right) <= 2, offscreen: m.right > innerWidth || m.left < 0 };
  });
  eq('목록이 아이콘 바로 아래에 뜬다', anchor.below, true);
  eq('오른쪽이 버튼과 맞는다', anchor.rightAligned, true);
  eq('화면 밖으로 안 나간다', anchor.offscreen, false);

  console.log('\n■ 마감 임박순');
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
  await longPress(page, '#explore-sort-btn');
  await page.click('#explore-sort-menu [data-sort="listed"]'); await page.waitForTimeout(600);
  eq('라벨이 바뀐다', await page.$eval('#explore-sort-label', (e) => e.textContent.trim()), '등록 최신순');
  rows = await orderKeys();
  const key = (r) => r.listedAt || r.deadline || '';
  const withK = rows.filter((r) => key(r)).length;
  eq('값 없는 카드가 앞으로 오지 않는다', rows.slice(0, withK).every((r) => key(r)), true);
  eq('등록일 내림차순이다',
    rows.slice(0, withK).every((r, i, arr) => i === 0 || key(arr[i - 1]) >= key(r)), true);

  console.log('\n■ 적합도순 — 미달은 맨 아래 (개발자 결정)');
  await longPress(page, '#explore-sort-btn');
  await page.click('#explore-sort-menu [data-sort="fit"]'); await page.waitForTimeout(600);
  const noIdx = await page.$$eval('#explore-list .sch-card',
    (els) => els.map((e, i) => (e.querySelector('.badge-fit-no') ? i : -1)).filter((i) => i >= 0));
  const total = await page.$$eval('#explore-list .sch-card', (e) => e.length);
  eq('미달 카드가 목록 끝에 모여 있다',
    noIdx.length === 0 || noIdx[0] + noIdx.length === total, true);

  console.log('\n■ 필터 칩과 서로 간섭하지 않는다 (.filter-chip 전역 선택 함정)');
  await page.click('.filter-chip[data-filter="교외"]'); await page.waitForTimeout(500);
  await longPress(page, '#explore-sort-btn');
  await page.click('#explore-sort-menu [data-sort="deadline"]'); await page.waitForTimeout(600);
  eq('정렬을 바꿔도 필터 칩 active가 그대로다',
    await page.$$eval('.filter-chip.active', (e) => e.map((x) => x.dataset.filter)), ['교외']);
  eq('필터도 그대로 걸려 있다',
    await page.$$eval('#explore-list .sch-card .badge-out, #explore-list .sch-card .badge-in',
      (e) => [...new Set(e.map((x) => x.textContent.trim()))]), ['교외']);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 정렬 전부 통과');
  process.exit(fail ? 1 : 0);
})();
