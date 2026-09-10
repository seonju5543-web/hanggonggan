/* 손짓과 움직임 검증 (2026-09-09) — 짝은 interactions.js · style.css 끝 묶음

   개발자 지적에서 시작한 작업이다: *"인스타그램과 달리 사람냄새가 안나 … 정적이고 ai스럽다."*
   넣은 것 넷을 여기서 지킨다:
     ① 당겨서 새로고침   ② 저장할 때 튕김과 진동
     ③ 마감까지 남은 시간 막대(컨텍스트 바)   ④ 기다리는 동안의 뼈대

   이 검사가 **정말로 막는 것**은 겉모습이 아니라 아래 넷이다:
     · 막대가 **모르는 것을 그리는 것** — 마감을 못 읽은 공고·상시 제도·마감된 공고
     · 뼈대가 **굳는 것** — 못 받아 왔을 때 '불러오는 중'만 영영 보이는 상태
     · 당겨서 새로고침이 **시트를 뚫는 것** — 알림 동의 시트는 검사를 세 번 넘어뜨린 자리다
     · `.app` 에 transform 이 걸려 **하단 탭이 함께 밀리는 것** (fixed 가 죽는다)

   🔴 공고 id 를 박지 않는다 — 마감된 공고는 목록에서 내려가 그때부터 검사가 죽는다.
   🔴 판정을 베끼지 않는다 — 앱의 `dday`·`deadlineMeter` 를 그대로 불러 확인한다. */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const { deadlineMeter, DEADLINE_WINDOW_DAYS } = require('../interactions.js');

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

async function seed(page) {
  await page.evaluate((prof) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false }, applications: [], saved: [],
    }));
    localStorage.removeItem('handaejang.resume');
  }, PROFILE);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#bottom-nav:not([hidden])');
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(250);
  await dismissNotify(page);
}

(async () => {
  /* ── ⓪ 브라우저가 필요 없는 것부터 — 막대 수치는 순수 계산이다 ────────── */
  console.log('\n■ 마감 막대 수치 (브라우저 없이)');
  ok('마감된 공고에는 안 그린다', deadlineMeter(-1).show === false);
  ok('창 밖(8일 뒤)에는 안 그린다', deadlineMeter(DEADLINE_WINDOW_DAYS + 1).show === false);
  ok('마감을 못 읽은 공고에는 안 그린다 (dday 가 내는 14)', deadlineMeter(14).show === false);
  ok('숫자가 아니면 안 그린다', deadlineMeter(null).show === false && deadlineMeter(NaN).show === false);
  ok('D-DAY 는 가득 찬다', deadlineMeter(0).pct === 100);
  ok('창 끝(D-7)에도 눈에 보이는 폭이 남는다', deadlineMeter(DEADLINE_WINDOW_DAYS).pct > 0);
  ok('가까울수록 길어진다', deadlineMeter(1).pct > deadlineMeter(3).pct
    && deadlineMeter(3).pct > deadlineMeter(6).pct);
  ok('폭이 100%를 넘지 않는다', [0, 1, 3, 7].every((d) => deadlineMeter(d).pct <= 100));
  ok('눈이 아닌 사람에게도 글로 말한다', /마감/.test(deadlineMeter(3).label));

  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,           // 손짓 검사라 터치가 있는 기기여야 한다
    isMobile: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text());
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await seed(page);
  await page.waitForTimeout(1400);          // 홈 합계의 countUp(900ms)이 멈출 때까지

  /* ── ① 컨텍스트 바가 화면에 실제로 나오는가 ───────────────────────── */
  console.log('\n■ 마감 막대 — 화면');
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(400);

  /* 🔴 앱의 `dday` 를 그대로 불러 '막대가 나와야 하는 카드'를 센다 — 검사가 규칙을
     따로 갖고 있으면 앱이 바뀔 때 조용히 갈라진다. */
  const meterAudit = await page.evaluate((win) => {
    const cards = [...document.querySelectorAll('#explore-list .sch-card')];
    let expected = 0, drawn = 0, wrong = [];
    for (const c of cards) {
      const sch = findSch(c.dataset.detail);
      if (!sch) continue;
      const d = dday(sch.deadline);
      const should = !sch.program && d.days >= 0 && d.days <= win;
      const has = !!c.querySelector('.dl-meter');
      if (should) expected++;
      if (has) drawn++;
      if (should !== has) wrong.push(`${sch.id} 기대=${should} 실제=${has} days=${d.days} program=${!!sch.program}`);
    }
    return { cards: cards.length, expected, drawn, wrong };
  }, DEADLINE_WINDOW_DAYS);

  ok('탐색에 카드가 있다', meterAudit.cards > 0, `${meterAudit.cards}장`);
  ok('막대는 마감이 가까운 카드에만 붙는다 (앱의 dday 와 한 글자도 안 어긋난다)',
    meterAudit.wrong.length === 0, meterAudit.wrong.slice(0, 3).join(' · '));

  /* 🔴 상시 제도에 막대가 붙으면 한 카드가 "상시로 받는다"와 "3일 뒤 마감"을 같이 말한다.
     🔴 **픽스처를 주입해서 잰다.** 지금 데이터에는 마감일이 있는 상시 제도가 하나도 없어
        (실측: registered 0건 · data.js 의 상시 제도 7종 전부 마감일 없음) 그냥 세면
        **가드를 없애도 이 검사가 통과한다** — 실제로 그랬다(red-green 확인 중 발견).
        조용한 검사는 통과가 아니라 무력해진 것이다. */
  const programWithMeter = await page.evaluate(() => {
    const keep = registeredList.slice();
    registeredList = keep.concat([{
      id: 'fixture-program-with-deadline',
      name: '검사용 상시 제도 (마감일 있음)', provider: '검사', type: '교외',
      amount: '검사', amountValue: 0, program: true,
      deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    }]);
    renderExplore();
    const card = document.querySelector('.sch-card[data-detail="fixture-program-with-deadline"]');
    const out = { rendered: !!card, meter: !!(card && card.querySelector('.dl-meter')) };
    registeredList = keep; renderExplore();
    return out;
  });
  ok('검사용 상시 제도가 실제로 그려졌다 (그래야 다음 줄이 뜻을 가진다)', programWithMeter.rendered);
  ok('상시 제도 카드에는 막대가 없다 (마감일이 3일 뒤여도)', programWithMeter.meter === false);

  /* 마감된 공고에도 없어야 한다 — 다 지난 기한을 빨간 막대로 재촉하면 안 된다 */
  const closedWithMeter = await page.evaluate(() =>
    [...document.querySelectorAll('.sch-card')].filter((c) =>
      c.querySelector('.badge-dday.closed') && c.querySelector('.dl-meter')).length);
  ok('마감된 카드에는 막대가 없다', closedWithMeter === 0, `${closedWithMeter}장에 붙음`);

  if (meterAudit.drawn > 0) {
    const shape = await page.evaluate(() => {
      const m = document.querySelector('.dl-meter');
      const fill = m.querySelector('.dl-meter-fill');
      return {
        label: m.getAttribute('aria-label') || '',
        width: fill ? fill.style.width : '',
        color: getComputedStyle(fill).backgroundColor,
      };
    });
    ok('막대에 글로 된 설명이 붙는다', /마감/.test(shape.label), shape.label);
    ok('폭이 실제로 정해져 있다', /^\d+%$/.test(shape.width), shape.width);
    /* 개발자 지시: "밑에 **빨간색**으로 마감 기간 알려주는 것" — --red(#8f3a2e) */
    ok('빨간색이다 (--red)', shape.color === 'rgb(143, 58, 46)', shape.color);
  } else {
    console.log('  · 지금 데이터에 7일 안쪽 공고가 없어 화면 모양 검사는 건너뜁니다');
  }

  /* ── ② 저장할 때 튕김 ─────────────────────────────────────────────── */
  console.log('\n■ 저장 튕김');
  /* 🔴 목록이 비어 있으면 `$eval` 이 **그대로 예외를 던져** browser.close() 도 통과/실패
     요약도 안 나온다 — CLAUDE.md 가 verify-essay-ui 사례로 이미 경고한 유형이다.
     없으면 건너뛴다고 말하고 넘어간다(조용히 통과하지 않는다). */
  const saveId = await page.$eval('#explore-list .save-btn', (e) => e.dataset.save).catch(() => null);
  if (!saveId) {
    fails.push('탐색에 저장 단추가 없어 튕김을 재지 못했다 — 데이터나 화면을 확인할 것');
    console.log('  ✕ 저장 단추를 못 찾아 이 절을 재지 못했습니다');
  } else {
  const sel = `#explore-list .save-btn[data-save="${saveId}"]`;
  await page.click(sel);
  await page.waitForTimeout(60);
  ok('담으면 튕김 표시가 붙는다', await page.$eval(sel, (e) => e.classList.contains('pop')));
  ok('담긴 상태가 된다', await page.$eval(sel, (e) => e.getAttribute('aria-pressed') === 'true'));

  /* 🔴 해제까지 축하하듯 튕기면 무슨 일이 일어났는지 흐려진다 — 담을 때만 튕긴다 */
  await page.click(sel);
  await page.waitForTimeout(60);
  ok('해제할 때는 튕기지 않는다', await page.$eval(sel, (e) => !e.classList.contains('pop')));

  /* 연달아 두 번 담아도 두 번 다 튕겨야 한다(클래스를 한 번만 붙이면 두 번째가 조용하다) */
  await page.click(sel); await page.waitForTimeout(500);   // 애니메이션이 끝날 만큼
  await page.click(sel); await page.waitForTimeout(60);    // 해제
  await page.click(sel); await page.waitForTimeout(60);    // 다시 담기
  ok('연달아 담아도 매번 튕긴다', await page.$eval(sel, (e) => e.classList.contains('pop')));
  }

  /* ── ③ 뼈대 ───────────────────────────────────────────────────────────
     🔴 **정식 등록 목록에는 뼈대를 두지 않는다** — 2026-09-09 실측: `allScholarships()` 가
        data.js 의 상시 제도 6종을 동기로 먼저 내주므로 그 목록은 받아오기 중에도 비지 않는다.
        (처음에 "공고 오기 전 홈이 '없음'이라고 말한다"고 보고 뼈대를 넣었다가, 재 보고 걷어냈다.)
        기다림이 실제로 보이는 곳은 실시간 공고 구역 하나다 — 거기를 지킨다. */
  console.log('\n■ 기다리는 동안의 뼈대 (실시간 공고 구역)');
  const skel = await page.evaluate(() => {
    const keep = liveNotices;
    const read = () => document.querySelector('#live-notices');

    liveNotices = null; renderExplore();                    // 아직 안 온 상태
    const during = {
      skeleton: !!read().querySelector('.skel-list'),
      head: /실시간 공고/.test(read().textContent),
      lie: /없음/.test(read().textContent),
      reader: read().querySelector('.sr-only')?.textContent || '',
    };

    liveNotices = { items: [], updatedAt: null }; renderExplore();   // 받았는데 빈손
    const after = {
      skeleton: !!read().querySelector('.skel-list'),
      empty: /없음/.test(read().textContent),
    };

    liveNotices = keep; renderExplore();
    return { during, after };
  });
  ok('공고가 오기 전에는 뼈대를 보여 준다', skel.during.skeleton);
  ok('그때도 구역 머리말은 자리를 지킨다 (없다가 갑자기 나타나지 않는다)', skel.during.head);
  ok('그때 "없음" 이라고 말하지 않는다 (없는 게 아니라 안 온 것이다)', !skel.during.lie);
  ok('낭독기에도 상태를 말한다', /불러오는/.test(skel.during.reader), skel.during.reader);
  ok('받아오기가 끝나면 뼈대가 걷힌다', !skel.after.skeleton);
  ok('빈손으로 끝났으면 "없음" 이 맞는 답이다 (뼈대가 굳지 않는다)', skel.after.empty);

  /* 🔴 못 받아 와도 뼈대가 굳으면 안 된다 — loadNotices 가 실패해도 빈 문서를 넣는지 본다 */
  const failClears = await page.evaluate(async () => {
    const keep = liveNotices;
    liveNotices = null;
    const realFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('오프라인 흉내'));
    await loadNotices();
    window.fetch = realFetch;
    const stuck = !!document.querySelector('#live-notices .skel-list');
    liveNotices = keep; renderExplore();
    return stuck;
  });
  ok('받아오기가 실패해도 뼈대가 굳지 않는다', failClears === false);

  /* ── ④ 당겨서 새로고침 ────────────────────────────────────────────── */
  console.log('\n■ 당겨서 새로고침');
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForSelector('#screen-home:not([hidden])');
  await page.waitForTimeout(300);

  ok('설치돼 있다', await page.evaluate(() => typeof installPullToRefresh === 'function'));

  /* 🔴 `.app` 에 transform 이 걸리면 그 안의 `position: fixed`(하단 탭·시트·도우미 단추)가
     화면이 아니라 `.app` 을 기준으로 자리를 잡아 함께 밀린다. 옮기는 것은 보이는 화면 하나뿐. */
  const navBefore = await page.$eval('#bottom-nav', (e) => e.getBoundingClientRect().top);
  /* 🔴 여기서 화면을 탭하지 말 것 — 카드를 눌러 **상세 시트가 열리고**, 그러면
     당겨서 새로고침이 (올바르게) 막혀 검사가 스스로 빨간불을 만든다. 실제로 그랬다. */
  await page.evaluate(() => window.scrollTo(0, 0));
  await dismissNotify(page);                       // 그새 다시 떴을 수 있다
  const dragged = await page.evaluate(async () => {
    const send = (type, y) => {
      const t = new Touch({ identifier: 1, target: document.body, clientX: 195, clientY: y });
      document.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    send('touchstart', 120);
    await new Promise((r) => setTimeout(r, 30));
    send('touchmove', 200);
    await new Promise((r) => setTimeout(r, 30));
    const screen = document.querySelector('.screen:not([hidden])');
    const out = {
      screenMoved: /translateY\(/.test(screen.style.transform),
      appUntouched: !document.querySelector('.app').style.transform,
      spinner: !!document.querySelector('.ptr'),
      spinnerOutsideApp: !document.querySelector('.app .ptr'),
    };
    send('touchend', 200);
    return out;
  });
  ok('당기면 보이는 화면이 따라 내려온다', dragged.screenMoved);
  ok('.app 에는 transform 을 걸지 않는다 (하단 탭·시트가 fixed 다)', dragged.appUntouched);
  ok('뱅뱅이가 생긴다', dragged.spinner);
  ok('뱅뱅이는 #app 바깥에 있다', dragged.spinnerOutsideApp);
  await page.waitForTimeout(900);                  // 되돌아올 시간
  const navAfter = await page.$eval('#bottom-nav', (e) => e.getBoundingClientRect().top);
  ok('하단 탭은 제자리에 있었다', Math.abs(navAfter - navBefore) < 2, `${navBefore} → ${navAfter}`);

  /* 🔴 **300ms 안에 두 번 당겨도 화면이 굳지 않는다** (2026-09-09 코드 리뷰가 재현한 버그).
     되돌리기 타이머가 조건 없이 화면 참조를 놓아 버려서, 두 번째 당김이 참조를 잃고
     `.screen` 이 내려간 채 영영 굳었다 — 탭을 옮겼다 와도 그대로였다. */
  const doublePull = await page.evaluate(async () => {
    const send = (type, y, id) => {
      const t = new Touch({ identifier: id, target: document.body, clientX: 195, clientY: y });
      document.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    window.scrollTo(0, 0);
    /* 🔴 순서가 이 검사의 전부다 — 되돌리기 타이머(300ms)가 **두 번째 당김이 아직 손가락을
       붙이고 있는 동안** 터져야 버그가 드러난다. 두 번째를 먼저 끝내 버리면 아무 일도
       안 일어나서 검사가 조용히 통과한다(처음에 그렇게 만들었다가 red-green 에서 걸렸다). */
    send('touchstart', 120, 11); await new Promise((r) => setTimeout(r, 20));
    send('touchmove', 180, 11);  await new Promise((r) => setTimeout(r, 20));
    send('touchend', 180, 11);   await new Promise((r) => setTimeout(r, 60));   // 타이머 예약됨
    send('touchstart', 120, 12); await new Promise((r) => setTimeout(r, 20));
    send('touchmove', 180, 12);
    await new Promise((r) => setTimeout(r, 400));   // ← 여기서 앞 타이머가 터진다 (손가락은 아직 위에)
    send('touchend', 180, 12);
    await new Promise((r) => setTimeout(r, 900));
    const screen = document.querySelector('.screen:not([hidden])');
    return screen.style.transform || '';
  });
  ok('연달아 두 번 당겨도 화면이 내려간 채 굳지 않는다', doublePull === '', `남은 값: "${doublePull}"`);

  /* 🔴 **끌어서 옮기는 마스코트에서 시작한 손짓은 우리 것이 아니다** (같은 리뷰가 재현).
     그 단추를 아래로 끌면 화면 전체가 같이 내려왔고, 더 끌면 새로고침까지 갔다. */
  const fabDrag = await page.evaluate(async () => {
    const fab = document.querySelector('.chat-fab, #btn-chat-fab');
    if (!fab) return { skipped: true };
    window.scrollTo(0, 0);
    const send = (type, y) => {
      const t = new Touch({ identifier: 13, target: fab, clientX: 320, clientY: y });
      fab.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    send('touchstart', 600); await new Promise((r) => setTimeout(r, 20));
    send('touchmove', 680);  await new Promise((r) => setTimeout(r, 20));
    const screen = document.querySelector('.screen:not([hidden])');
    const moved = /translateY\(/.test(screen.style.transform);
    send('touchend', 680);
    await new Promise((r) => setTimeout(r, 600));
    return { skipped: false, moved };
  });
  if (fabDrag.skipped) console.log('  · 도우미 단추가 없어 건너뜁니다');
  else ok('도우미 단추를 끌어도 화면이 따라 내려오지 않는다', fabDrag.moved === false);

  /* 뱅뱅이가 화면 한가운데에 있는가 — 두 번 가운데 맞춤하면 15px 치우친다 */
  const centered = await page.evaluate(() => {
    const s = document.querySelector('.ptr');
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return Math.abs((r.left + r.width / 2) - window.innerWidth / 2);
  });
  ok('뱅뱅이가 화면 한가운데에 있다', centered !== null && centered < 2, `중심에서 ${centered}px`);

  /* 🔴 시트가 떠 있으면 시작조차 하지 않는다 — 알림 동의 시트는 브라우저 검사를
     세 번 넘어뜨린 자리다(2026-09-07). 그 위에서 당기면 시트 뒤 목록이 움직여 보인다. */
  const blockedBySheet = await page.evaluate(async () => {
    const sheet = document.querySelector('#detail-sheet');
    const back = document.querySelector('#sheet-backdrop');
    sheet.hidden = false; back.hidden = false;
    window.scrollTo(0, 0);
    const send = (type, y) => {
      const t = new Touch({ identifier: 2, target: document.body, clientX: 195, clientY: y });
      document.dispatchEvent(new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [t],
        changedTouches: [t], bubbles: true, cancelable: true,
      }));
    };
    send('touchstart', 120);
    await new Promise((r) => setTimeout(r, 30));
    send('touchmove', 220);
    await new Promise((r) => setTimeout(r, 30));
    const screen = document.querySelector('.screen:not([hidden])');
    const moved = /translateY\(/.test(screen.style.transform);
    send('touchend', 220);
    sheet.hidden = true; back.hidden = true;
    return moved;
  });
  ok('시트가 떠 있으면 당겨도 화면이 안 움직인다', blockedBySheet === false);

  /* 새로고침이 실제로 데이터를 다시 받는가 — 화면 복귀와 **같은 함수**를 쓴다 */
  ok('새로고침 함수가 하나로 모여 있다 (화면 복귀와 공용)',
    await page.evaluate(() => typeof refreshAllData === 'function'));
  const refreshed = await page.evaluate(async () => {
    const before = registeredList.length;
    registeredList = [];
    await refreshAllData();
    return { before, after: registeredList.length };
  });
  ok('새로고침하면 공고를 다시 받아 온다',
    refreshed.after > 0 && refreshed.after === refreshed.before,
    `${refreshed.before} → ${refreshed.after}`);

  /* ── ⑤ 움직임을 줄인 학생 ─────────────────────────────────────────── */
  console.log('\n■ 움직임 줄이기를 켠 학생');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#screen-home:not([hidden])');
  await dismissNotify(page);
  await page.waitForTimeout(300);
  const reduced = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'skel';
    document.body.appendChild(el);
    const dur = getComputedStyle(el).animationDuration;
    el.remove();
    return dur;
  });
  ok('뼈대 반짝임이 꺼진다', /^0(\.0+)?0?1?m?s$/.test(reduced) || parseFloat(reduced) < 0.01, reduced);

  console.log('\n' + (errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ERRORS: none'));
  await browser.close();

  console.log(`\n통과 ${pass} · 실패 ${fails.length}`);
  if (fails.length || errors.length) {
    if (fails.length) console.log('실패:\n - ' + fails.join('\n - '));
    process.exit(1);
  }
  console.log('✓ 손짓과 움직임 전부 통과');
})();
