/* 공고 저장(북마크) · 달력 보기 · 보관함 검증 (2026-09-07 · 노션 UI-21)

   무엇을 지키는 검사인가 — 설계서(docs/designs/calendar-and-save.md)의 약속 다섯이다:
     ① 저장은 신청과 **다른 칸**이다 → 저장해도 홈의 예상 수혜액 합계가 움직이지 않는다
     ② 달력에 상시로 찍히는 것은 **신청·저장한 공고뿐**이다
     ③ 마감이 지난 내 공고는 **사라지지 않고 '발표 대기'** 가 된다(개발자 지시 4-4)
     ④ 날짜를 누르면 그날 공고가 펼쳐지고, **층2(재단 목록)는 접혀** 있다
     ⑤ 공고를 누르면 **상세로 바로 간다**(개발자 지시 5번)

   🔴 공고 id 를 박지 않는다 — 마감된 공고는 목록에서 내려가 그때부터 검사가 죽는다.
      대상은 앱에서 그때그때 고른다(2026-07-30·08-24 에 같은 유형으로 두 번 죽었다).
   🔴 판정도 베끼지 않는다 — 달력이 쓰는 `calMarks` 를 그대로 불러 확인한다. */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');

const PORT = process.env.PORT || 8123;
const EXE = process.env.CHROME_PATH;

const PROFILE = {
  school: '한국외국어대학교', campus: null, track: 'humanities', major: '',
  year: 3, status: '재학', gpa: 3.5, bracket: 5, flags: [], nationality: 'korean',
  region: '서울', parentRegion: '서울', birthYear: 2004,
  common: { studentId: '', birth: '', phone: '', email: '', bank: '', account: '' },
};

let pass = 0; const fails = [];
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fails.push(name + (extra ? ` — ${extra}` : '')); console.log(`  ✕ ${name}${extra ? ` — ${extra}` : ''}`); }
};

async function seed(page, saved, applied = []) {
  await page.evaluate(([prof, sv, ap]) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false },
      applications: ap.map((id) => ({ id, appliedAt: '2026-09-01 00:00', step: 0, pending: false })),
      saved: sv.map((id) => ({ id, savedAt: '2026-09-01 00:00' })),
    }));
  }, [PROFILE, saved, applied]);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(250);
  await dismissNotify(page);
}

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await seed(page, []);

  /* ── ① 저장 단추 ─────────────────────────────────────── */
  console.log('\n■ 공고 저장(북마크)');
  /* 🔴 홈 합계는 **숫자가 올라가는 애니메이션**(countUp · 900ms)을 거친다.
     그 전에 읽으면 중간값이 잡혀 저장과 아무 상관 없이 값이 달라진다
     (2026-09-07에 이 검사가 실제로 그 중간값을 '결함'으로 잡았다).
     그래서 재기 전에 반드시 멈출 때까지 기다린다. */
  await page.waitForTimeout(1400);
  const heroBefore = await page.textContent('#hero-amount').catch(() => '');
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(300);
  const btnCount = await page.locator('#explore-list .save-btn').count();
  ok('탐색 카드마다 저장 단추가 있다', btnCount > 0, `${btnCount}개`);

  /* 🔴 단추가 카드 **바깥**에 있어야 한다 — 안에 넣으면 단추 안의 단추가 되어
     브라우저마다 다르게 깨지고, 누르면 상세까지 함께 열린다. */
  const nested = await page.$$eval('#explore-list .save-btn',
    (els) => els.filter((e) => e.closest('.sch-card')).length);
  ok('저장 단추가 카드 단추 안에 들어 있지 않다', nested === 0, `${nested}개가 안쪽`);

  const firstId = await page.$eval('#explore-list .save-btn', (e) => e.dataset.save);
  await page.click(`#explore-list .save-btn[data-save="${firstId}"]`);
  await page.waitForTimeout(200);
  ok('누르면 저장 상태가 된다',
    await page.$eval(`#explore-list .save-btn[data-save="${firstId}"]`, (e) => e.getAttribute('aria-pressed') === 'true'));
  ok('저장해도 상세 시트가 열리지 않는다', await page.$eval('#detail-sheet', (e) => e.hidden));
  ok('장부에 남는다', await page.evaluate((id) => isSaved(id), firstId));

  /* ① 저장은 신청이 아니다 — 홈 합계가 움직이면 안 된다 */
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForTimeout(1600);                     // 애니메이션이 멈춘 뒤에 읽는다(위 주석)
  const heroAfter = await page.textContent('#hero-amount').catch(() => '');
  ok('저장해도 홈의 예상 수혜액이 바뀌지 않는다', heroBefore === heroAfter, `${heroBefore} → ${heroAfter}`);

  /* ── ② 보관함 ────────────────────────────────────────── */
  console.log('\n■ 보관함');
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForTimeout(300);
  ok('MY 화면에 보관함이 있다', await page.locator('#my-saved').count() === 1);
  ok('저장한 공고가 보관함에 보인다', await page.locator(`#my-saved .cal-row[data-detail="${firstId}"]`).count() === 1);

  /* 🔴 보관함에서 **바로 해제**할 수 있어야 한다 — 담는 곳과 빼는 곳이 다르면 학생이
     뺄 방법을 못 찾는다. 2026-09-07 코드 리뷰 전에는 이 줄에 단추가 아예 없었고,
     검사도 확인 없이 지나가고 있었다(조용히 아무것도 안 재던 자리다). */
  ok('보관함 줄에도 해제 단추가 있다',
    await page.locator(`#my-saved .save-btn[data-save="${firstId}"]`).count() === 1);
  await page.click(`#my-saved .save-btn[data-save="${firstId}"]`).catch(() => {});
  await page.waitForTimeout(250);
  ok('해제하면 보관함에서 빠진다', !(await page.evaluate((id) => isSaved(id), firstId)));
  ok('해제해도 상세 시트가 열리지 않는다', await page.$eval('#detail-sheet', (e) => e.hidden));

  /* ── ③ 달력 ──────────────────────────────────────────── */
  console.log('\n■ 달력 보기');
  /* 이번 달에 마감하는 공고를 **앱에서 골라** 저장한다 — id 를 박지 않는다 */
  const pick = await page.evaluate(() => {
    const t = new Date();
    const ym = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
    const now = allScholarships().find((s) => s.deadline && s.deadline.startsWith(ym) && dday(s.deadline).days >= 0);
    const gone = allScholarships().filter((s) => s.deadline && dday(s.deadline).days < 0);
    /* 🔴 **마감이 코앞인 공고를 반드시 하나 담는다.** 없으면 '점은 두 가지뿐' 검사가
       잴 것이 없어 조용히 통과한다 — 실제로 그래서 빨간 점을 되살려도 초록불이었다
       (2026-09-07 red-green 확인에서 잡았다). */
    const soon = allScholarships().find((s) => s.deadline
      && dday(s.deadline).days >= 0 && dday(s.deadline).days <= 3);
    /* 발표일을 **원문에서 읽은** 공고 — 발표 점이 찍히는 유일한 경우다(실측 45건 중 4건) */
    const ann = allScholarships().find((s) => s.announceDate);
    return { now: now ? now.id : null, nowDate: now ? now.deadline : null,
             soon: soon ? soon.id : null,
             ann: ann ? ann.id : null, annDate: ann ? ann.announceDate : null,
             past: gone[0] ? gone[0].id : null, past2: gone[1] ? gone[1].id : null };
  });
  if (!pick.now) {
    console.log('  … 이번 달 마감 공고가 없어 달력 구동을 건너뜁니다(데이터 사정 — 실패 아님)');
  }

  /* 마감이 지난 공고를 **신청분으로** 넣는다 — 발표를 기다리는 것은 신청한 공고뿐이다 */
  /* 발표일을 아는 공고도 **신청분으로** 넣는다 — 발표 점은 신청한 공고에만 찍힌다 */
  await seed(page, [pick.now, pick.soon, pick.past2].filter(Boolean),
                   [pick.past, pick.ann].filter(Boolean));
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(250);

  ok('신청 내역에 달력 토글이 있다', await page.locator('#apps-view-toggle').count() === 1);
  ok('처음에는 목록이 보인다', await page.$eval('#apps-calendar', (e) => e.hidden));
  await page.click('#apps-view-toggle');
  await page.waitForTimeout(250);
  ok('달력을 켜면 달력이 보이고 목록이 숨는다',
    !(await page.$eval('#apps-calendar', (e) => e.hidden)) && await page.$eval('#apps-list', (e) => e.hidden));
  ok('달 이름이 보인다', /\d{4}년 \d{1,2}월/.test(await page.textContent('.cal-month')));

  /* 🔴 달력에서는 수혜액 카드를 숨긴다 (2026-09-07 개발자 지시) — 지우는 게 아니라 숨기는 것이라
     목록으로 돌아오면 다시 나와야 한다. 둘 다 확인한다. */
  ok('달력에서는 수혜액 카드가 안 보인다', await page.$eval('#apps-summary', (e) => e.hidden));

  /* 🔴 범례는 **두 줄**이다 (마감 · 발표 대기). 임박은 마감의 급함이라 같은 줄에서 설명한다 —
     따로 세우면 학생이 외워야 할 종류가 넷이 된다. */
  ok('범례는 두 종류다', await page.locator('.cal-legend > span').count() === 2,
    `${await page.locator('.cal-legend > span').count()}종`);

  /* 🔴 격자에 찍히는 점도 **두 가지뿐**이어야 한다 — 마감(●) · 발표 대기(◐).
     접수 시작과 마감 임박(빨강)을 차례로 뺐다(2026-09-07 개발자 지시). 범례만 줄이고
     점을 그대로 두면 학생은 범례에 없는 점을 보게 된다. */
  const kinds = await page.$$eval('.cal-grid .cal-dot', (els) => [...new Set(
    els.flatMap((e) => [...e.classList].filter((c) => c.startsWith('cal-dot-'))))].sort());
  /* ⚠️ **점이 하나도 없으면 이 검사는 아무것도 재지 않는다**(빈 배열은 every 가 늘 참이다).
     그래서 '적어도 한 종류는 있어야 한다'를 함께 요구한다 — 안 그러면 달력이 통째로
     비어도 초록불이다(이 저장소가 여러 번 겪은 '조용히 무력해진 검사'). */
  ok('격자의 점은 마감·발표 두 가지뿐이다',
    kinds.length > 0 && kinds.every((k) => k === 'cal-dot-mine' || k === 'cal-dot-wait'),
    kinds.length ? kinds.join(' ') : '점이 하나도 없다');
  /* 잴 거리가 실제로 있었는지 함께 밝힌다 — 없으면 위 검사는 아무 말도 안 한 것이다 */
  ok('마감 임박 공고를 담은 채로 쟀다', !!pick.soon,
    '이번 달에 D-3 이내 공고가 없어 위 검사가 헐거워졌다');

  if (pick.now) {
    /* ② 저장한 공고가 점으로 찍힌다 */
    const dots = await page.$$eval(`.cal-cell[data-cal-day="${pick.nowDate}"] .cal-dot`, (e) => e.length);
    ok('저장한 공고의 마감일에 점이 찍힌다', dots > 0, `${dots}개`);

    /* ④ 날짜를 누르면 그 자리에서 펼쳐진다 (시트가 아니다) */
    await page.click(`.cal-cell[data-cal-day="${pick.nowDate}"]`);
    await page.waitForTimeout(200);
    const dayLen = await page.$eval('#cal-day', (e) => e.innerHTML.length);
    ok('날짜를 누르면 아래에 목록이 펼쳐진다', dayLen > 0);
    ok('시트로 뜨지 않는다', await page.$eval('#detail-sheet', (e) => e.hidden));
    ok('그 공고가 목록에 있다', await page.locator(`#cal-day .cal-row[data-detail="${pick.now}"]`).count() >= 1);

    /* 층2는 접혀 있어야 한다 — 하루 26건까지 쏟아지는 데다 자격 판정이 없다 */
    const kosafOpen = await page.$$eval('#cal-day details.cal-kosaf', (els) => els.filter((e) => e.open).length);
    ok('한국장학재단 목록은 접혀 있다', kosafOpen === 0);

    /* ⑤ 공고를 누르면 상세로 바로 간다 */
    await page.click(`#cal-day .cal-row[data-detail="${pick.now}"]`);
    await page.waitForSelector('#detail-sheet.show', { timeout: 4000 });
    ok('공고를 누르면 상세 시트가 열린다', true);
    ok('상세 시트에도 저장 단추가 있다', await page.locator('#detail-sheet .save-btn').count() === 1);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  /* 목록으로 돌아오면 수혜액 카드가 **다시** 나와야 한다(숨김이지 삭제가 아니다) */
  await page.click('#apps-view-toggle');
  await page.waitForTimeout(250);
  ok('목록으로 돌아오면 수혜액 카드가 다시 보인다', !(await page.$eval('#apps-summary', (e) => e.hidden)));
  await page.click('#apps-view-toggle');
  await page.waitForTimeout(250);

  /* ③ 마감이 지나도 사라지지 않는다 — 다만 '발표 대기'는 **신청한 것**에만 붙는다 */
  const kindOf = (id) => page.evaluate((x) => {
    const sch = findSch(x);
    if (!sch) return 'notfound';
    const [y, m] = sch.deadline.split('-').map(Number);
    const mk = (calMarks(new Date(y, m - 1, 1))[sch.deadline] || []).find((k) => k.id === x);
    return mk ? mk.kind : 'none';
  }, id);
  if (pick.past) {
    /* 🔴 마감이 지나도 **사라지지 않는다**(개발자 지시 4-4). 다만 마감일 자리는 늘
       '마감' 점이다 — 그날은 마감일이지 발표일이 아니다(2026-09-07 개발자 지적). */
    const v = await kindOf(pick.past);
    ok('마감이 지나도 신청한 공고는 달력에 남는다', v === 'mine', `판정=${v}`);
  }
  if (pick.past2) {
    const v = await kindOf(pick.past2);
    ok('저장만 한 공고도 마감일 자리에 그대로 남는다', v === 'mine', `판정=${v}`);
  }

  /* 🔴 발표 점(◐)은 **원문에서 읽은 발표일에만** 찍힌다.
     예전에는 발표일을 모르는 공고의 **마감일 자리**에 찍혀서, 학생 눈에는
     마감일에 발표 점이 붙은 것으로 보였다. 그것을 없앤 것이 이 검사의 요지다. */
  if (pick.ann) {
    const onAnn = await page.evaluate(([id, date]) => {
      const [y, m] = date.split('-').map(Number);
      const mk = (calMarks(new Date(y, m - 1, 1))[date] || []).find((k) => k.id === id);
      return mk ? mk.kind : 'none';
    }, [pick.ann, pick.annDate]);
    ok('발표일을 아는 공고는 그 날짜에 발표 점이 찍힌다', onAnn === 'wait', `판정=${onAnn}`);
  } else {
    ok('발표일을 아는 공고가 있어 발표 점을 쟀다', false, '원문 발표일을 가진 공고가 없다');
  }

  /* 발표일을 모르는 공고에는 발표 점이 **어디에도** 없어야 한다 */
  const strayWait = await page.evaluate(() => {
    const t = new Date();
    let bad = 0;
    for (let i = -2; i <= 2; i++) {
      const marks = calMarks(new Date(t.getFullYear(), t.getMonth() + i, 1));
      for (const [date, list] of Object.entries(marks)) {
        for (const k of list) {
          if (k.kind !== 'wait') continue;
          const s = findSch(k.id);
          if (!s || s.announceDate !== date) bad++;
        }
      }
    }
    return bad;
  });
  ok('발표 점은 원문 발표일 아닌 곳에는 찍히지 않는다', strayWait === 0, `${strayWait}건`);

  /* 없는 날짜를 지어내지 않는다 — 발표일이 없는 공고에 발표 날짜를 찍으면 안 된다 */
  const invented = await page.evaluate(() => {
    const t = new Date();
    const marks = calMarks(new Date(t.getFullYear(), t.getMonth(), 1));
    let bad = 0;
    for (const [date, list] of Object.entries(marks)) {
      for (const k of list) {
        const s = findSch(k.id);
        if (!s) continue;
        /* 점이 찍힌 날은 마감일이거나 발표일이어야 한다.
           🔴 접수 시작일은 2026-09-07부터 **찍지 않는다** — 여기 openDate 를 허용해 두면
              그 결정이 조용히 되돌아와도 검사가 통과한다. */
        if (date !== s.deadline && date !== s.announceDate) bad++;
      }
    }
    return bad;
  });
  ok('공고에 없는 날짜에는 점을 찍지 않는다', invented === 0, `${invented}건`);

  console.log(`\nERRORS: ${errors.length ? errors.join(' | ') : 'none'}`);
  if (errors.length) fails.push('콘솔·페이지 오류 ' + errors.length + '건');
  await browser.close();

  console.log(`\n${fails.length ? '✕' : '✓'} 달력·저장 — 통과 ${pass} · 실패 ${fails.length}`);
  if (fails.length) { fails.forEach((f) => console.log('   - ' + f)); process.exit(1); }
})();
