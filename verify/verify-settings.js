/* 설정 화면 검증 — 2026-09-11 개발자 목업 승인분을 **그대로** 지킨다.
   승인받은 것: ① 뒤로 + '설정'  ② 계정(로그인·회원가입)  ③ 알림(상태줄 + 켜기 + 스위치 5개)
   같은 지시에서 말로 덧붙인 것: 휴지통 · 이용약관 · 탈퇴
   🔴 여기 적힌 문구·개수를 바꾸려면 **개발자에게 다시 보여 주고 승인받은 뒤** 이 검사도 같이 고친다.
      검사만 고치고 화면을 바꾸는 것은 2026-08-27 사고의 반복이다.
   실행: CHROME_PATH=... node verify/verify-settings.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;
const SHOT = process.env.SHOT_DIR || '/tmp/shots';


/* 🔴 진짜 손가락 끌기 — Playwright 의 마우스로는 touchstart/move/end 가 안 난다.
   이 저장소는 마우스로 재다가 손짓 사고를 세 번 놓쳤다(CLAUDE.md 13차 세션). */
async function swipe(page, { x, y, dx, dy = 0, steps = 10 }) {
  await page.evaluate(([x, y, dx, dy, steps]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) throw new Error('그 자리에 아무것도 없다: ' + x + ',' + y);
    const mk = (type, cx, cy) => {
      const t = new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
      el.dispatchEvent(new TouchEvent(type, {
        bubbles: true, cancelable: true,
        touches: type === 'touchend' ? [] : [t],
        targetTouches: type === 'touchend' ? [] : [t],
        changedTouches: [t],
      }));
    };
    mk('touchstart', x, y);
    for (let i = 1; i <= steps; i++) mk('touchmove', x + (dx * i) / steps, y + (dy * i) / steps);
    mk('touchend', x + dx, y + dy);
  }, [x, y, dx, dy, steps]);
  await page.waitForTimeout(320);
}

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  /* 🔴 목업과 나란히 두고 볼 수 있어야 하므로 **폰 크기**로 잰다.
     넓은 창으로 찍으면 글자가 작아져 읽을 수 없는 증거가 된다. */
  const ctx = await browser.newContext({ viewport: { width: 430, height: 940 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    /* 서버(Supabase)로 못 나가는 것은 샌드박스 사정이지 앱의 결함이 아니다 */
    if (/Failed to load resource|supabase|net::ERR/i.test(t)) return;
    errors.push('CONSOLE: ' + t);
  });

  await page.addInitScript(() => {
    localStorage.removeItem('handaejang.resume');
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
        year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
        nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} },
      applications: [
        { id: 'reg-hufs-myeonhak', appliedAt: '2026-08-01', step: 0 },
        { id: 'reg-hufs-alumni', appliedAt: '2026-08-02', step: 0 },
      ],
    }));
  });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await dismissNotify(page);
  await page.waitForTimeout(300);

  console.log('\n■ MY 화면 — 계정·알림은 여기 없고, 오른쪽 위에 설정이 있다');
  await page.click('.nav-item[data-nav="my"]');
  await page.waitForSelector('#screen-my:not([hidden])');
  await page.waitForTimeout(400);
  eq('오른쪽 위에 설정(톱니) 버튼이 있다', await page.$eval('#btn-open-settings', (e) => e.offsetParent !== null), true);
  eq('MY 안에서는 계정 절이 안 보인다', await page.$eval('#my-account', (e) => e.offsetParent !== null), false);
  eq('MY 안에서는 알림 절이 안 보인다', await page.$eval('#my-notify', (e) => e.offsetParent !== null), false);
  await page.screenshot({ path: `${SHOT}/my.png` });

  console.log('\n■ 설정 화면 — 승인받은 목업 그대로인가');
  await page.click('#btn-open-settings');
  await page.waitForSelector('#screen-settings:not([hidden])');
  await page.waitForTimeout(500);
  eq('제목이 "설정"', (await page.textContent('#screen-settings .sub-header h2')).trim(), '설정');
  eq('왼쪽 위에 뒤로 버튼이 있다', await page.$eval('#btn-settings-back', (e) => e.offsetParent !== null), true);
  eq('MY 탭이 켜진 채로 남는다 (여기가 MY 안쪽이라는 표시)',
    await page.$eval('.nav-item[data-nav="my"]', (e) => e.classList.contains('active')), true);

  eq('계정 절 제목', (await page.textContent('#my-account .acc-head')).trim(), '계정');
  eq('계정 버튼 둘 — 로그인 · 회원가입',
    await page.$$eval('#my-account .acc-actions .btn', (els) => els.map((e) => e.textContent.trim())),
    ['로그인', '회원가입']);
  eq('로그인이 채워진 버튼(primary)이다',
    await page.$eval('#btn-acc-in', (e) => e.classList.contains('btn-primary')), true);
  eq('회원가입이 테두리 버튼(outline)이다',
    await page.$eval('#btn-acc-up', (e) => e.classList.contains('btn-outline')), true);

  eq('알림 절 제목', (await page.textContent('#my-notify .wallet-title')).trim(), '알림');
  eq('알림 상태 줄이 있다', (await page.textContent('#my-notify .nf-status')).trim().length > 0, true);
  eq('오른쪽에 켜기 버튼', (await page.textContent('#btn-nf-toggle')).trim(), '켜기');
  /* 🔴 다섯 줄의 **문구와 순서**가 목업과 같아야 한다. 하나라도 달라지면 여기서 걸린다. */
  eq('알림 스위치 5줄이 목업과 같다',
    await page.$$eval('#my-notify .nf-pref-text strong', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim())),
    ['내 조건에 맞는 새 장학 공고', '마감 하루 전 · 마감 당일', '제출 기록 안 한 공고',
      '우리 학교 게시판 새 공고', '마감 지난 공고 결과 기록']);
  eq('스위치가 5개', await page.$$eval('#my-notify .nf-switch', (e) => e.length), 5);

  console.log('\n■ 덧붙인 세 줄 — 휴지통 · 이용약관 · 탈퇴');
  eq('메뉴 세 줄',
    await page.$$eval('.set-menu .my-menu-item', (els) => els.map((e) => e.textContent.trim())),
    ['휴지통', '이용약관 · 개인정보처리방침', '탈퇴']);
  eq('탈퇴는 빨간 줄이다', await page.$eval('#btn-withdraw', (e) => e.classList.contains('danger')), true);
  /* 🔴 '기타' 절 제목 — 제목 없이 목록만 두면 위 '알림' 절과의 빈칸이 벌어져 보인다 */
  eq("'기타' 절 제목이 있다", (await page.textContent('#set-etc .wallet-title')).trim(), '기타');
  /* 🔴 2026-09-11 개발자 지시 — '기타'와 '알림'의 절 제목은 **같은 모양**이어야 한다.
     이 검사가 없으면 한쪽에만 막대가 남는 오늘 같은 어긋남을 아무도 못 본다. */
  /* 🔴 절 제목 위 막대는 **어느 절에도 없다** (2026-09-01 판정 · 2026-09-11 재확인).
     지키는 것은 '없다'와 '넷이 서로 같다' 둘이다 — 새 절을 만들 때 제거 목록에
     이름을 빠뜨리면 그 절만 막대가 남는데, 오늘 '기타'가 실제로 그랬다. */
  eq('절 제목 위 막대는 어느 절에도 없다 (계정·알림·기타)',
    await page.evaluate(() => {
      const bar = (sel) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el, '::before').content : '없음';
      };
      return ['#my-account .acc-head', '#my-notify .wallet-title', '#set-etc .wallet-title']
        .map(bar).every((c) => c === 'none');
    }), true);
  /* 🔴 '기타' 제목과 첫 줄(휴지통) 사이에 선이 없어야 한다 (개발자 지시) */
  eq("'기타'와 '휴지통' 사이에 구분선이 없다",
    await page.evaluate(() => {
      const m = getComputedStyle(document.querySelector('.set-menu'));
      const f = getComputedStyle(document.querySelector('#btn-open-trash'));
      return parseFloat(m.borderTopWidth) === 0 && parseFloat(f.borderTopWidth) === 0;
    }), true);
  eq("'기타' 제목이 계정·알림과 같은 크기다 (같은 규칙을 쓴다)",
    await page.evaluate(() => {
      const a = getComputedStyle(document.querySelector('#my-notify .wallet-title')).fontSize;
      const b = getComputedStyle(document.querySelector('#set-etc .wallet-title')).fontSize;
      return a === b;
    }), true);
  /* 🔴 링크가 아니라 버튼 — 진짜 페이지 이동이면 되돌아올 때 앱이 처음부터 뜬다(부팅 화면) */
  eq('이용약관은 링크가 아니라 앱 안 화면 버튼이다',
    await page.$$eval('.set-menu a[href]', (e) => e.length), 0);
  await page.screenshot({ path: `${SHOT}/settings.png` });

  console.log('\n■ 휴지통 — 비어 있을 때');
  await page.click('#btn-open-trash');
  await page.waitForSelector('#screen-trash:not([hidden])');
  await page.waitForTimeout(400);
  eq('제목이 "휴지통"', (await page.textContent('#screen-trash .sub-header h2')).trim(), '휴지통');
  eq('빈 휴지통 안내가 뜬다', await page.$$eval('.trash-empty', (e) => e.length), 1);
  /* 🔴 설명 한 줄은 뺐다 (2026-09-11 개발자 지시) — 화면 맨 위가 이미 같은 말을 한다 */
  eq('빈 휴지통에 설명 줄을 덧붙이지 않는다', await page.$$eval('.trash-empty-sub', (e) => e.length), 0);
  await page.screenshot({ path: `${SHOT}/trash-empty.png` });
  await page.click('#btn-trash-back');
  await page.waitForSelector('#screen-settings:not([hidden])');
  eq('뒤로 누르면 설정으로 돌아온다', await page.$eval('#screen-settings', (e) => e.hidden), false);

  console.log('\n■ 지운 신청내역이 휴지통에 남고, 되살릴 수 있다');
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(400);
  const before = await page.$$eval('#apps-list .swipe-row', (e) => e.length);
  eq('신청내역 2건으로 시작', before, 2);
  await page.click('#apps-select-toggle');
  await page.waitForTimeout(200);
  await page.click('#apps-list .row-check');
  await page.waitForTimeout(200);
  await page.click('#apps-delete-selected');
  await page.waitForTimeout(500);
  eq('한 건 지워져 1건 남는다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 1);

  await page.click('.nav-item[data-nav="my"]');
  await page.click('#btn-open-settings');
  await page.waitForSelector('#screen-settings:not([hidden])');
  await page.click('#btn-open-trash');
  await page.waitForSelector('#screen-trash:not([hidden])');
  await page.waitForTimeout(400);
  eq('휴지통에 1건이 담겨 있다', await page.$$eval('#trash-body .wallet-row', (e) => e.length), 1);
  eq('무엇을 언제 지웠는지 적혀 있다',
    /신청내역 · (오늘|어제|\d+일 전에) 지움/.test(await page.textContent('#trash-body .wallet-status')), true);
  await page.screenshot({ path: `${SHOT}/trash-items.png` });

  await page.click('#trash-body [data-trash-back]');
  await page.waitForTimeout(600);
  eq('되살리면 휴지통이 빈다', await page.$$eval('#trash-body .wallet-row', (e) => e.length), 0);
  await page.click('.nav-item[data-nav="applications"]');
  await page.waitForTimeout(400);
  eq('신청내역이 2건으로 돌아왔다', await page.$$eval('#apps-list .swipe-row', (e) => e.length), 2);

  console.log('\n■ 화면이 오갈 때 — 방향 있는 움직임 · 파란 판 없음');
  {
    await page.click('.nav-item[data-nav="my"]');
    await page.click('#btn-open-settings');
    await page.waitForSelector('#screen-settings:not([hidden])');
    await page.click('#btn-open-trash');
    await page.waitForSelector('#screen-trash:not([hidden])');
    eq('들어갈 때는 오른쪽에서 들어온다',
      await page.$eval('#screen-trash', (e) => e.classList.contains('screen-in')), true);
    await page.click('#btn-trash-back');
    await page.waitForSelector('#screen-settings:not([hidden])');
    eq('되돌아올 때는 왼쪽에서 들어온다 (같은 방향이면 길을 잃는다)',
      await page.$eval('#screen-settings', (e) => e.classList.contains('screen-back')), true);
    /* 🔴 손끝이 스칠 때 브라우저 기본 파란 판이 뜨지 않아야 한다 (개발자 지적) */
    eq('메뉴 줄에 브라우저 기본 파란 판이 없다',
      await page.$eval('#btn-open-trash', (e) => getComputedStyle(e).webkitTapHighlightColor),
      'rgba(0, 0, 0, 0)');
    eq('누르는 효과(줄어들기)는 남아 있다',
      await page.evaluate(() => [...document.styleSheets].some((sh) => {
        try { return [...sh.cssRules].some((r) => r.selectorText && /\.my-menu-item:active/.test(r.selectorText)); }
        catch (e) { return false; }
      })), true);
  }

  console.log('\n■ 이용약관 왕복 — 앱을 떠나지 않고 화면만 바뀐다');
  {
    /* 🔴 여기서 지키는 것은 '페이지를 떠나지 않는다' 하나다 (2026-09-11 개발자 지적:
       "나가기 화살표 누르면 한대장 완전 첫페이지가 뜬다"). 진짜 페이지 이동이면
       되돌아올 때 앱이 처음부터 떠서 부팅 화면이 보인다. */
    const before = page.url();
    await page.click('#btn-open-terms');
    await page.waitForSelector('#screen-terms:not([hidden])', { timeout: 8000 });
    eq('주소가 그대로다 = 앱을 떠나지 않았다', page.url(), before);
    await page.waitForFunction(() => {
      const el = document.querySelector('#terms-body');
      return el && el.textContent.length > 500;
    }, { timeout: 8000 });
    eq('약관 본문이 실제로 들어왔다',
      await page.$eval('#terms-body', (e) => e.textContent.length > 1000), true);
    eq('본문을 베껴 두지 않고 terms.html 에서 읽어 온다',
      await page.$eval('#terms-body', (e) => /제1조/.test(e.textContent)), true);
    /* 따라다니는 머리줄 — 끝까지 내려도 나가기가 화면에 남아 있어야 한다 */
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(350);
    eq('맨 아래까지 내려도 나가기 화살표가 화면에 있다',
      await page.evaluate(() => {
        const r = document.querySelector('#btn-terms-back').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }), true);
    /* 🔴 머리줄은 **순백**이라 글이 밑으로 지나가도 비쳐 보이지 않는다 */
    eq('머리줄이 순백이고 화면 맨 위를 덮는다',
      await page.evaluate(() => {
        const el = document.elementFromPoint(Math.round(window.innerWidth / 2), 8);
        const h = el && el.closest('.sub-header-stick');
        return !!h && getComputedStyle(h).backgroundColor === 'rgb(255, 255, 255)';
      }), true);
    /* 🔴 제목과 화살표가 세로로 가운데 맞았나 (개발자 지적 "위아래가 올바르지 않다") */
    eq('제목과 화살표가 세로 가운데로 맞는다',
      await page.evaluate(() => {
        const t = document.querySelector('#screen-terms .sub-header-stick h2').getBoundingClientRect();
        const a = document.querySelector('#btn-terms-back').getBoundingClientRect();
        return Math.abs((t.top + t.height / 2) - (a.top + a.height / 2)) <= 2;
      }), true);
    await page.click('#btn-terms-back');
    await page.waitForSelector('#screen-settings:not([hidden])', { timeout: 8000 });
    eq('나가면 설정으로 돌아온다', await page.$eval('#screen-settings', (e) => e.hidden), false);
    eq('첫 화면(환영)이 뜨지 않는다', await page.$eval('#screen-onboarding', (e) => e.hidden), true);
  }

  console.log('\n■ 이용약관 화면 — 되돌아가기는 왼쪽 위, 제목이 화면 안에 든다');
  {
    /* 🔴 **좁은 폰(320px)까지 본다.** 개발자가 지적한 것이 '박스 안에 안 맞는다'였고,
       390px 에서는 아슬아슬하게 들어가 눈에 안 띄었다 — 좁은 쪽에서 재야 보인다. */
    const t = await ctx.newPage();
    await t.setViewportSize({ width: 320, height: 900 });
    await t.goto(`http://localhost:${PORT}/terms.html`, { waitUntil: 'domcontentloaded' });
    await t.waitForTimeout(300);
    eq('왼쪽 위에 되돌아가기 화살표가 있다', await t.$$eval('.legal-header .sub-back', (e) => e.length), 1);
    eq('그 화살표가 떠났던 자리(설정)로 간다 — 홈이 아니다',
      await t.$eval('.legal-header .sub-back', (e) => e.getAttribute('href')), './?screen=settings');
    /* 🔴 길게 내려도 나가기가 남아 있어야 한다 — 읽다 중간에 나갈 수 있게 (개발자 지시) */
    await t.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await t.waitForTimeout(300);
    eq('맨 아래까지 내려도 나가기 화살표가 화면에 남아 있다',
      await t.evaluate(() => {
        const r = document.querySelector('.legal-header .sub-back').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      }), true);
    await t.evaluate(() => window.scrollTo(0, 0));
    await t.waitForTimeout(200);
    eq('맨 아래 되돌아가기 버튼은 없앴다', await t.$$eval('.legal-actions', (e) => e.length), 0);
    eq('제목이 화면 밖으로 나가지 않는다',
      await t.evaluate(() => {
        const r = document.querySelector('.legal-header h2').getBoundingClientRect();
        return r.right <= document.documentElement.clientWidth && r.left >= 0;
      }), true);
    eq('페이지 전체가 가로로 넘치지 않는다',
      await t.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);

    /* 🔴 표는 좁은 화면에서 **펴진다** — 가로 스크롤로 숨기지 않는다.
       개인정보 고지는 끝까지 읽히는 것이 목적이라 옆으로 밀어 두면 안 된다. */
    eq('좁은 화면에서 표 머리글 줄이 숨는다 (각 칸이 이름표를 달기 때문)',
      await t.$$eval('.legal-table .legal-thead', (els) => els.every((e) => e.offsetParent === null)), true);
    eq('모든 칸이 이름표를 갖고 있다 (없으면 펴진 뒤 무슨 값인지 알 수 없다)',
      await t.$$eval('.legal-table td', (els) => els.filter((e) => !e.getAttribute('data-label')).length), 0);
    eq('펴진 칸이 한 줄을 통째로 쓴다 (셋·넷으로 눌리지 않는다)',
      await t.evaluate(() => {
        const td = document.querySelector('.legal-table tr:not(.legal-thead) td');
        const tr = td.closest('tr');
        return td.getBoundingClientRect().width > tr.getBoundingClientRect().width * 0.8;
      }), true);

    /* 넓은 화면에서는 표가 표 그대로여야 한다 — 펴는 것은 좁을 때만이다 */
    await t.setViewportSize({ width: 700, height: 900 });
    await t.waitForTimeout(200);
    eq('넓은 화면에서는 표 머리글이 다시 보인다',
      await t.$eval('.legal-table .legal-thead', (e) => e.offsetParent !== null), true);
    await t.close();
  }

  console.log('\n■ 오른쪽으로 쓸어 나가기 (손가락으로 재현)');
  {
    const open = async (btn, screen) => {
      await page.click('.nav-item[data-nav="my"]');
      await page.click('#btn-open-settings');
      await page.waitForSelector('#screen-settings:not([hidden])');
      if (btn) { await page.click(btn); await page.waitForSelector(screen); }
      await page.waitForTimeout(400);
    };

    await open('#btn-open-trash', '#screen-trash:not([hidden])');
    await swipe(page, { x: 200, y: 400, dx: 160 });
    eq('휴지통에서 오른쪽으로 쓸면 설정으로 나간다',
      await page.$eval('#screen-settings', (e) => e.hidden), false);

    await open('#btn-open-terms', '#screen-terms:not([hidden])');
    await page.waitForTimeout(500);
    await swipe(page, { x: 200, y: 500, dx: 160 });
    eq('약관에서 오른쪽으로 쓸면 설정으로 나간다',
      await page.$eval('#screen-settings', (e) => e.hidden), false);

    /* 🔴 짧고 빠르게 튕기는 것도 먹어야 한다 — 거리만 보면 가장 자연스러운 손짓이 무시된다 */
    await open('#btn-open-trash', '#screen-trash:not([hidden])');
    await swipe(page, { x: 200, y: 400, dx: 40, steps: 2 });
    eq('짧게 튕겨도 나간다 (거리만 보지 않는다)',
      await page.$eval('#screen-settings', (e) => e.hidden), false);

    /* 🔴 세로로 끄는 것은 목록을 읽으려는 것이다 — 뺏으면 안 된다 */
    await open('#btn-open-terms', '#screen-terms:not([hidden])');
    await page.waitForTimeout(500);
    await swipe(page, { x: 200, y: 500, dx: 20, dy: 180 });
    eq('세로로 끌면 나가지 않는다 (스크롤을 뺏지 않는다)',
      await page.$eval('#screen-terms', (e) => e.hidden), false);

    /* 🔴 왼쪽으로 끄는 것은 되돌아가기가 아니다 */
    await swipe(page, { x: 250, y: 500, dx: -160 });
    eq('왼쪽으로 끌면 나가지 않는다',
      await page.$eval('#screen-terms', (e) => e.hidden), false);

    /* ⚠️ 화면 왼쪽 끝은 iOS 제 뒤로가기 몫이라 우리가 잡지 않는다 */
    await swipe(page, { x: 10, y: 500, dx: 160 });
    eq('화면 왼쪽 끝에서 시작한 손짓은 우리가 잡지 않는다 (iOS 몫)',
      await page.$eval('#screen-terms', (e) => e.hidden), false);

    /* 끌다 만 화면에 자국이 남으면 안 된다 */
    eq('끌다 말면 화면이 제자리로 돌아온다',
      await page.$eval('#screen-terms', (e) => e.style.transform === '' && e.style.opacity === ''), true);

    await page.click('#btn-terms-back');
    await page.waitForSelector('#screen-settings:not([hidden])');

    /* 🔴 시트가 떠 있으면 그 안의 손짓을 뺏으면 안 된다 — 시트는 `#app` 안에 있어서
       막지 않으면 로그인 시트를 옆으로 쓸 때 설정 화면이 통째로 나가 버린다. */
    await page.click('#btn-acc-in');
    await page.waitForSelector('#detail-sheet:not([hidden])');
    await page.waitForTimeout(400);
    await swipe(page, { x: 200, y: 500, dx: 160 });
    eq('시트가 열려 있으면 화면이 나가지 않는다 (시트 손짓을 뺏지 않는다)',
      await page.$eval('#screen-settings', (e) => e.hidden), false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    await swipe(page, { x: 200, y: 400, dx: 160 });
    eq('설정에서 쓸면 MY 로 나간다', await page.$eval('#screen-my', (e) => e.hidden), false);
  }

  console.log(errors.length ? '\n❌ 오류:\n' + errors.join('\n') : '\n✓ 콘솔 오류 없음');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 설정 화면 검증 전부 통과');
  process.exit(fail ? 1 : 0);
})();
