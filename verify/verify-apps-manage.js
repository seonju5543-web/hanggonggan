/* 신청 내역 관리 검증 — 왼쪽으로 밀어 삭제 · 전체 선택 · 되돌리기 (2026-08-24)
   🔴 **반드시 TouchEvent로 '끌기'를 재현한다.** 마우스로는 이 유형이 한 번도 재현되지
      않는다(CLAUDE.md — 13차 세션 학교 검색 사고). 세로 스크롤이 살아 있는지도 함께 본다.
   실행: node verify/verify-apps-manage.js   (CHROME_PATH 필요) */
const { chromium } = require('playwright-core');
const { assertOwnServer } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다

/* 진짜 손가락 끌기 — Playwright의 마우스로는 touchstart/move/end가 안 난다 */
async function drag(page, sel, dx, dy, steps = 8) {
  await page.$eval(sel, (el, [dx, dy, steps]) => {
    const r = el.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    const mk = (type, x, y) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t],
      }));
    };
    mk('touchstart', x0, y0);
    for (let i = 1; i <= steps; i++) mk('touchmove', x0 + (dx * i) / steps, y0 + (dy * i) / steps);
    mk('touchend', x0 + dx, y0 + dy);
  }, [dx, dy, steps]);
  await page.waitForTimeout(320);
}

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  /* 🔴 재기 전에 **이 서버가 내 앱인지** 확인한다 — 아니면 여기서 멈춘다.
     이 저장소는 작업 폴더를 여러 개 두고 쓰는데, 8123 에 다른 폴더의 서버가 떠 있으면
     그 옛 앱을 재고도 아무도 모른다(빨간불이든 **가짜 초록불이든**). 규칙은 onboard-helper 한 곳. */
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  /* 프로필 + 신청 3건을 미리 넣어 둔다 — 온보딩을 매번 태우지 않으려고 */
  await page.addInitScript(() => {
    /* 이어보기 장부도 지운다 — 남겨 두면 앱이 앞 검사에서 보던 화면으로 돌아간다 (2026-09-09) */
    localStorage.removeItem('handaejang.resume');
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
        year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
        nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} },
      applications: [
        { id: 'reg-hufs-myeonhak', appliedAt: '2026-08-01', step: 0 },
        { id: 'reg-hufs-alumni', appliedAt: '2026-08-02', step: 0 },
        { id: 'reg-hufs-yuheungsu', appliedAt: '2026-08-03', step: 0 },
        /* 목록에서 내려간 공고의 기록(선정까지 적어 둔 것) — 화면엔 안 보이고, 기기에서는 지워지지 않아야 한다(2026-10-02) */
        { id: 'reg-gone-for-test', name: '내려간 공고', appliedAt: '2026-07-01', step: 0, result: 'won' },
        /* 내려갔지만 결과를 아직 안 적은 기록 — 공고가 있을 때 떠 둔 사본으로 **남는다**(2026-10-02 개발자 결정 "결과를 적을 때까지는 남겨두자") */
        { id: 'reg-gone-kept', name: '사본으로 남은 공고', appliedAt: '2026-06-01', step: 0, submittedAt: '2026-06-10',
          snap: { id: 'reg-gone-kept', name: '사본으로 남은 공고', provider: '테스트 재단', type: '교외', deadline: '2026-06-20', amount: '100만원', amountValue: 1000000,
            documents: [], eligibility: {}, eligibilityLines: [], sourceUrl: 'https://example.org/n/1' } },
      ],
    }));
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  /* 알림 동의 시트가 뒤에서 클릭을 가로챈다 — 다른 드라이버와 같은 방식으로 닫는다 */
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(500);
  eq('신청 4건이 보인다(결과를 안 적은 내려간 공고 1건 포함)', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 4);
  eq('  결과를 안 적은 내려간 공고는 사본으로 남는다', await page.$eval('#apps-list [data-row="reg-gone-kept"] .sch-name', (e) => e.textContent.trim()), '사본으로 남은 공고');
  /* 🔴 2026-10-02 개발자 지시 — 내려간 공고는 '목록에서 내려감' 줄로 남기지 않고 아예 안 보인다 */
  eq('내려간 공고는 줄로 안 보인다', [await page.$('#apps-list [data-row="reg-gone-for-test"]'), await page.$$eval('#apps-list', (e) => e[0].textContent.includes('내려감'))], [null, false]);
  eq('  요약 카드도 안 센다(선정 0건 — 내려간 공고의 선정은 안 보인다)', await page.$eval('#apps-summary', (e) => /선정 \d+건/.test(e.textContent)), false);
  eq('  홈 「신청내역」 칸 숫자도 화면과 같다(4)', await page.$eval('.hero-tile[data-hero-go="applications"] .hero-badge', (e) => e.textContent.trim()), '4');
  /* 사본 줄에서 결과를 적으면 사라지고, 실행 취소로 돌아온다 */
  await page.click('#apps-list [data-row="reg-gone-kept"] [data-log-toggle]').catch(() => {});
  await page.waitForTimeout(300);
  const wonBtn = await page.$('#apps-list [data-row="reg-gone-kept"] [data-mark-won]');
  eq('  사본 줄에도 결과 기록 단추가 있다', !!wonBtn, true);
  if (wonBtn) {
    await wonBtn.click(); await page.waitForTimeout(400);
    eq('  선정을 적으면 줄이 정리된다(3건)', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 3);
    eq('  사라지는 줄이라 실행 취소를 준다', await page.$eval('#toast .toast-undo', (e) => e.textContent.trim()), '실행 취소');
    await page.click('#toast .toast-undo'); await page.waitForTimeout(400);
    eq('  실행 취소하면 돌아온다(4건)', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 4);
  }
  /* 🔴 클래스의 display가 [hidden]을 이겨 선택 막대가 늘 떠 있었다 — 눈으로 봐야 잡히는 유형이라
     화면에서 실제로 안 보이는지(offsetParent)까지 확인한다 (CLAUDE.md CSS 함정). */
  eq('선택 모드가 아니면 선택 막대가 안 보인다',
    await page.$eval('#apps-bulkbar', (e) => e.offsetParent !== null), false);
  /* 🔴 **'밀어서 삭제'는 2026-09-01 에 걷어냈다** (개발자 지시: "오류가 자꾸 먹어서").
     스칠 때 삭제가 뜨고, 빨간 판이 패널을 덮어 기록이 지워지고, 누름이 삼켜졌다 —
     세 번 고쳐도 재발해서 기능을 없앴다(커밋 33cdf22). 그런데 이 검사만 남아
     `.swipe-del` 을 찾다 죽고 있었다(그 클래스는 앱에 한 번도 안 나온다).
     🔴 **검사를 지우기만 하면 보장을 잃는다.** 삭제와 되돌리기는 여전히 있는 기능이라
        살아 있는 경로(선택 → 체크 → 삭제 n건)로 **옮겨서** 계속 지킨다. */

  console.log('\n■ 선택 모드 · 전체 선택 · 일괄 삭제');
  await page.click('#apps-select-toggle');
  await page.waitForTimeout(300);
  eq('선택 막대가 나온다', await page.$eval('#apps-bulkbar', (e) => e.hidden), false);
  eq('선택 전에는 삭제가 잠겨 있다', await page.$eval('#apps-delete-selected', (e) => e.disabled), true);

  /* 한 건만 골라 지우고 되돌린다 — 예전에 '밀어서 삭제'가 지키던 자리다 */
  await page.click('#apps-list .swipe-row:first-child .row-check');
  await page.waitForTimeout(200);
  await page.click('#apps-delete-selected');
  await page.waitForTimeout(400);
  eq('한 건이 지워진다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 3);
  /* 🔴 문구를 바꿀 때는 이 줄도 같이 바꾼다 — 2026-08-30 에 '되돌리기' → '실행 취소' 로
     바뀌었는데 여기가 안 따라와 main 이 빨간불이었다.
     ⚠️ 진짜 증명은 바로 아래 '되돌리면 3건' 이다 — 글자만 맞고 동작이 안 되면 소용없다. */
  eq('되돌리기 단추가 뜬다', await page.$eval('#toast .toast-undo', (e) => e.textContent.trim()), '실행 취소');
  await page.click('#toast .toast-undo');
  await page.waitForTimeout(400);
  eq('되돌리면 4건으로 돌아온다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 4);
  eq('되돌린 항목이 원래 자리에 있다',
    await page.$eval('#apps-list .swipe-row:first-child', (e) => e.dataset.row), 'reg-hufs-yuheungsu');

  /* ⚠️ 앱은 **삭제하면 선택 모드를 끈다**(app.js `appsSelectMode = false`) — 일부러 그렇게
     돼 있다(한 번 지우고 나면 보통 볼일이 끝난다). 그래서 일괄 삭제를 재려면 다시 켜야 한다.
     이걸 모르고 이어서 '전체 선택'을 누르면 안 보이는 체크박스를 30초 기다리다 죽는다. */
  await page.click('#apps-select-toggle');
  await page.waitForTimeout(300);
  eq('삭제 뒤 다시 선택 모드로 들어갈 수 있다', await page.$eval('#apps-bulkbar', (e) => e.hidden), false);
  await page.click('#apps-check-all');
  await page.waitForTimeout(300);
  eq('전체 선택하면 4건', await page.$eval('#apps-delete-selected', (e) => e.textContent.trim()), '삭제 4건');
  /* 🔴 전역 appearance:none 때문에 체크박스가 빈 원으로만 보였다 — 체크 그림이 실제로
     그려지는지 본다. 그리고 체크박스가 카드 글자를 덮지 않는지도(들여쓰기) 함께 본다. */
  eq('체크 표시가 그려진다',
    await page.$eval('#apps-check-all', (e) => getComputedStyle(e).backgroundImage !== 'none'), true);
  eq('선택 모드에서 카드가 체크박스만큼 밀린다',
    await page.$eval('#apps-list .sch-card', (e) => parseInt(getComputedStyle(e).paddingLeft, 10) >= 44), true);
  await page.click('#apps-delete-selected');
  await page.waitForTimeout(400);
  eq('전부 지워진다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 0);
  /* 🔴 되돌리기 **전에** 잰다 — 되돌리기는 지운 것을 다시 넣으므로 뒤에서 재면 지워졌어도 통과한다(2026-10-02 리뷰) */
  eq('  전체 선택·삭제는 보이지 않는 기록을 건드리지 않는다(기기에 그대로 · 공고가 돌아오면 선정 기록과 함께)',
    await page.evaluate(() => (state.applications || []).map((a) => a.id)), ['reg-gone-for-test']);
  eq('비면 선택 버튼이 사라진다', await page.$eval('#apps-select-toggle', (e) => e.hidden), true);
  await page.click('#toast .toast-undo');
  await page.waitForTimeout(400);
  eq('일괄 삭제도 되돌아온다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 4);


  /* ══ 신청 현황은 홈이 아니라 여기다 (2026-09-12 · 노션 UI-15) ═══════════════
     개발자 지시: "홈의 신청 현황을 지우고 신청 내역 칸에 반영한다."
     같은 카드(appCard)를 두 화면이 그리고 있었고 홈은 최근 2건만 보여 주는 사본이었다.
     🔴 **잃은 정보가 없어야** 옮긴 것이다 — 홈에서 뺐다면 이 화면이 그 건들을 다 보여 줘야 한다. */
  console.log('\n■ 신청 현황은 신청내역 화면에만 (UI-15)');
  const moved = await page.evaluate(() => {
    const home = document.querySelector('#screen-home');
    return {
      홈에구획: [...home.querySelectorAll('.section-head h3')].map((h) => h.textContent.trim()),
      홈에목록: !!document.querySelector('#home-apps'),
      /* 🔴 **보이는지까지 본다** — `hidden` 만 걸어도 innerHTML 은 남는다(달력 보기가 실제로
         그렇게 감춘다: renderApplications 의 `list.hidden = calMode`). 개수만 세면 화면이
         텅 빈 채로 초록불이다(2026-09-12 코드 리뷰 실측). 이 파일이 12줄 위에서 이미
         `offsetParent !== null` 로 재고 있었다 — 같은 잣대를 쓴다. */
      신청내역카드: [...document.querySelectorAll('#apps-list .sch-card')]
        .filter((e) => e.offsetParent !== null).length,
      요약있음: (() => { const el = document.querySelector('#apps-summary');
        return !!(el && el.offsetParent !== null && el.textContent.trim()); })(),
      /* 화면에 보일 기록 = 공고가 아직 있는 기록(2026-10-02 · shownAppRows) */
      담은건수: shownAppRows(state.applications, findSch).length,
    };
  });
  eq('담은 신청이 있다 (검사가 헛돌지 않는다)', moved.담은건수 > 0, true);
  eq('홈에는 「신청 현황」 구획이 없다', moved.홈에구획.includes('신청 현황'), false);
  eq('  홈에 그 목록 자리도 없다 (#home-apps)', moved.홈에목록, false);
  eq('신청내역 화면이 담은 건을 다 보여 준다', moved.신청내역카드, moved.담은건수);
  eq('  요약 카드도 함께 있다 (홈이 하던 말을 여기가 한다)', moved.요약있음, true);

  console.log('\n■ 터치 타깃 (44px 이상)');
  const small = await page.$$eval('#apps-delete-selected, .toast-undo, .bulk-all',
    (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); })
      .map((e) => e.className));
  eq('작은 터치 타깃이 없다', small, []);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 신청 내역 관리 전부 통과');
  process.exit(fail ? 1 : 0);
})();
