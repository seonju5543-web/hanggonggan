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

/* 🔴 **손을 떼지 않고** 끌어 둔 채로 재는 도구 (2026-09-11 패럴랙스).
   swipe() 는 끝까지 하고 손을 떼므로 **끄는 도중**을 볼 수 없다 — 패럴랙스는
   바로 그 도중에만 보이는 것이라, 그것만으로는 효과를 통째로 빼도 검사가 조용하다. */
async function dragHold(page, { x, y, dx, steps = 6 }) {
  await page.evaluate(([x, y, dx, steps]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) throw new Error('그 자리에 아무것도 없다: ' + x + ',' + y);
    window.__dragEl = el;
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
    for (let i = 1; i <= steps; i++) mk('touchmove', x + (dx * i) / steps, y);
  }, [x, y, dx, steps]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/* ⚠️ `rest` 는 **놓기 전에 손을 멈춰 세우는 시간**이다. 합성 이벤트는 시작과 끝이
   같은 틱에 붙어 버려 무엇을 끌든 속도가 튀고, 앱은 그걸 '툭 치기'로 읽어 전부 나간다
   (그래서 '조금만 끌다 놓으면 안 나간다' 가 사람 손과 달리 빨간불이었다). */
async function dragRelease(page, { x, y, dx, rest = 260, wait = 520 }) {
  if (rest) await page.waitForTimeout(rest);
  await page.evaluate(([x, y, dx]) => {
    const el = window.__dragEl;
    const t = new Touch({ identifier: 1, target: el, clientX: x + dx, clientY: y });
    el.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t],
    }));
  }, [x, y, dx]);
  if (wait) await page.waitForTimeout(wait);
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
  eq('기타 메뉴 줄 (2026-09-11 개발자 지시 순서대로)',
    await page.$$eval('.set-menu .my-menu-item', (els) => els.map((e) => e.textContent.trim())),
    ['로그인 활동', '자주 묻는 질문', '휴지통', '이용약관 · 개인정보처리방침',
      '앱 권한 · 오픈소스 라이선스', '탈퇴']);
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

  console.log('\n■ 로그인 활동 · FAQ · 앱 권한 (2026-09-11 신설)');
  {
    const open = async (btn, screen) => {
      await page.click('.nav-item[data-nav="my"]');
      await page.click('#btn-open-settings');
      await page.waitForSelector('#screen-settings:not([hidden])');
      await page.click(btn);
      await page.waitForSelector(screen);
      await page.waitForTimeout(500);
    };

    /* 🔴 로그인 안 한 상태에서 **죽지 않고** 무슨 상태인지 말해야 한다 */
    await open('#btn-open-logins', '#screen-logins:not([hidden])');
    eq('로그인 안 했으면 그렇게 말한다',
      /로그인한 계정이 없어요/.test(await page.textContent('#logins-body')), true);
    eq("'기록이 없다'고 단정하지 않는다 (없는 것과 못 읽은 것은 다르다)",
      /아직 기록이 없어요|불러오지 못했어요/.test(await page.textContent('#logins-body')), false);

    await open('#btn-open-faq', '#screen-faq:not([hidden])');
    eq('FAQ 가 열 줄이다', await page.$$eval('.faq-item', (e) => e.length), 10);
    eq('첫 질문은 신청이 앱에서 끝나는지 (운영 원칙 1을 맨 앞에 둔다)',
      (await page.textContent('.faq-item summary')).includes('신청까지 끝나나요'), true);
    /* 접혀 있다가 눌러야 펼쳐진다 — <details> 기본 동작 */
    eq('처음엔 접혀 있다', await page.$eval('.faq-item', (e) => e.open), false);
    await page.click('.faq-item summary');
    await page.waitForTimeout(200);
    eq('누르면 펼쳐진다', await page.$eval('.faq-item', (e) => e.open), true);

    await open('#btn-open-perms', '#screen-perms:not([hidden])');
    const perms = await page.textContent('#perms-body');
    eq('알림 권한 상태를 말한다', /허용됨|차단됨|아직 묻지 않음|지원하지 않아요/.test(perms), true);
    /* 🔴 웹앱은 폰 설정을 못 연다 — 눌러도 아무 일 없는 가짜 버튼을 두지 않는다 */
    eq('폰 설정을 여는 가짜 버튼이 없다',
      await page.$$eval('#perms-body a, #perms-body button', (els) =>
        els.filter((e) => /설정 앱|폰 설정으로|권한 관리/.test(e.textContent)).length), 0);
    eq('오픈소스 라이선스가 실제로 싣는 것만 적혀 있다',
      /Pretendard/.test(perms) && /Open Font License/.test(perms), true);
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

  /* ══ 패럴랙스 — 개발자 지시 "내 손이 움직이는 대로 페이지가 나가질 수 있도록" (2026-09-11) ══
     🔴 여기 있는 것은 **끄는 도중**에만 보인다. 위 절은 '결국 나갔는가'만 보므로
        패럴랙스를 통째로 빼도 전부 초록이다(실제로 그랬다) — 그래서 이 절이 따로 있다.
     🔴 red-green 확인함: PARALLAX 를 1.0 으로 두면 '느리게'가, mount() 를 끄면
        '뒤 화면이 보인다'가 빨간불이 된다. */
  console.log('\n■ 패럴랙스 — 뒤 화면이 손보다 느리게 따라온다');
  {
    const go = async (btn, screen) => {
      await page.click('.nav-item[data-nav="my"]');
      await page.click('#btn-open-settings');
      await page.waitForSelector('#screen-settings:not([hidden])');
      await page.click(btn); await page.waitForSelector(screen);
      await page.waitForTimeout(450);
    };
    const read = () => page.evaluate(() => {
      const t = document.querySelector('#screen-terms');
      const u = document.querySelector('#screen-settings');
      const nav = document.querySelector('.bottom-nav');
      return {
        앞: Math.round(t.getBoundingClientRect().left),
        뒤: Math.round(u.getBoundingClientRect().left),
        뒤숨김: u.hidden,
        뒤옅기: Number(getComputedStyle(u).opacity),
        폭: Math.round(t.getBoundingClientRect().width),
        탭: Math.round(nav.getBoundingClientRect().left),
        머리줄: Math.round(t.querySelector('.sub-header').getBoundingClientRect().top),
        앞스크롤: t.scrollTop,
      };
    });

    await go('#btn-open-terms', '#screen-terms:not([hidden])');
    /* 약관을 한참 내려 둔다 — 끌기 시작할 때 보던 자리를 잃지 않는지 봐야 한다 */
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1600); });
    await page.waitForTimeout(300);
    const sy = await page.evaluate(() => window.scrollY);

    const navBefore = (await read()).탭;
    await dragHold(page, { x: 200, y: 500, dx: 120 });
    const a = await read();
    eq('끄는 동안 뒤 화면이 함께 보인다 (한 장이 아니라 두 겹)', a.뒤숨김, false);
    eq('앞 화면은 손끝을 그대로 따라온다 (120px 끌면 120px)', a.앞, 120);
    eq('뒤 화면은 아직 왼쪽에 물러나 있다', a.뒤 < 0, true);
    /* 🔴 **이 한 줄이 패럴랙스 그 자체다.** 뒤 화면이 제자리에서 얼마나 왔는지를
       앞 화면이 온 거리로 나눈다 — 1 이면 두 장이 한 장처럼 붙어 가고(효과 없음),
       0 이면 뒤가 멈춰 있다(깊이 없음). 그 사이여야 두 겹으로 읽힌다. */
    const 뒤가온거리 = a.뒤 - (-a.폭 * 0.28);
    const 비율 = 뒤가온거리 / a.앞;
    eq('🔴 뒤 화면이 앞 화면보다 느리게 따라온다 (이게 패럴랙스다)', 비율 > 0.15 && 비율 < 0.45, true);
    eq('뒤 화면은 아직 옅다 (멀리 있는 것처럼)', a.뒤옅기 < 1, true);
    eq('아래 탭은 따라 움직이지 않는다', a.탭, navBefore);
    eq('끌기 시작해도 보던 자리를 잃지 않는다 (따라다니는 머리줄도 그대로)', a.앞스크롤, sy);
    eq('  그래서 머리줄이 화면 위에 그대로 있다', a.머리줄 < 60, true);

    /* 더 끌면 뒤 화면이 제자리에 가까워진다 — 값 하나만 재면 '멈춰 있는 뒤 화면'도 통과한다 */
    await dragHold(page, { x: 200, y: 500, dx: 300 });
    const b = await read();
    eq('더 끌수록 뒤 화면이 제자리로 다가온다', b.뒤 > a.뒤 && b.뒤 <= 0, true);
    eq('  옅던 것도 함께 진해진다', b.뒤옅기 > a.뒤옅기, true);

    await dragRelease(page, { x: 200, y: 500, dx: 300 });
    const c = await page.evaluate(() => {
      const t = document.querySelector('#screen-terms');
      const u = document.querySelector('#screen-settings');
      return {
        떠난화면숨김: t.hidden, 온화면숨김: u.hidden,
        자국: (t.className + ' ' + u.className).includes('swipe') ||
              t.style.transform !== '' || u.style.transform !== '',
        뒤왼쪽: Math.round(u.getBoundingClientRect().left),
        문서스크롤: window.scrollY,
      };
    });
    eq('손을 떼면 가던 방향 그대로 끝까지 간다', [c.떠난화면숨김, c.온화면숨김], [true, false]);
    eq('무대를 걷는다 (클래스·인라인 자국이 남지 않는다)', c.자국, false);
    eq('온 화면이 제자리에 선다', c.뒤왼쪽 <= 1, true);

    /* 🔴 **세로로 살짝 당겼다가 곧바로 옆으로 쓴다** — 폰에서 아주 흔한 손놀림이고,
       여기서 실제 버그가 나왔다. 당겨서 새로고침(`interactions.js` release)이 손을 뗀
       화면에 `transition: transform 0.28s` 를 **인라인으로** 남기는데, 인라인은 클래스
       규칙을 이기므로 그대로 두면 화면이 손보다 0.28초 늦게 따라온다.
       ⚠️ 이 검사를 지우면 그 버그가 조용히 되살아난다 — 다른 항목들은 못 잡는다
          (실측: transition 끄는 줄만 되돌렸더니 이 절이 통째로 초록이었다). */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await swipe(page, { x: 200, y: 400, dx: 0, dy: 30 });   // 세로로 살짝 당겼다 놓는다
    await dragHold(page, { x: 200, y: 400, dx: 120 });
    const e = await page.evaluate(() => ({
      앞: Math.round(document.querySelector('#screen-trash').getBoundingClientRect().left),
      인라인전환: document.querySelector('#screen-trash').style.transition,
    }));
    eq('🔴 세로로 당겼다 옆으로 쓸어도 손끝을 그대로 따라온다 (남이 건 전환을 끈다)', e.앞, 120);
    eq('  끄는 동안에는 전환이 꺼져 있다', e.인라인전환, 'none');
    await dragRelease(page, { x: 200, y: 400, dx: 120, rest: 0 });

    /* ── 2026-09-11 코드 리뷰가 잡은 셋 (전부 실제로 화면이 굳거나 튀는 것들) ── */

    /* ① 끄는 도중 **두 번째 손가락**이 닿으면 우리 손을 떠난다 — 그때 무대를 안 걷으면
       두 화면이 fixed 인 채 얼어붙고 학생은 아무것도 누를 수 없다. */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    await dragHold(page, { x: 200, y: 400, dx: 80 });
    await page.evaluate(() => {
      const el = window.__dragEl;
      const a = new Touch({ identifier: 1, target: el, clientX: 280, clientY: 400 });
      const b = new Touch({ identifier: 2, target: el, clientX: 120, clientY: 600 });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true,
        touches: [a, b], targetTouches: [a, b], changedTouches: [b] }));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true,
        touches: [], targetTouches: [], changedTouches: [a] }));
    });
    await page.waitForTimeout(450);
    const f = await page.evaluate(() => {
      const t = document.querySelector('#screen-trash');
      return { 굳었나: getComputedStyle(t).position === 'fixed',
        자국: t.className.includes('swipe'), 문서스크롤가능: document.documentElement.scrollHeight > 0 };
    });
    eq('🔴 끄는 도중 두 번째 손가락이 닿아도 화면이 얼어붙지 않는다', [f.굳었나, f.자국], [false, false]);

    /* ② `transitionend` 는 거슬러 올라온다 — 화면 **안쪽** 요소의 전환이 끝났다고
       미끄러지던 무대를 걷으면 화면이 중간에서 뚝 끊긴다.
       🔴 손을 **뗀 뒤**에 봐야 한다 — 그 신호를 듣는 자리가 그때 생긴다(끄는 동안에는
          듣는 사람이 없어, 여기서 재면 무엇을 해도 초록인 헛검사가 된다). */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    await dragHold(page, { x: 200, y: 400, dx: 200 });
    await dragRelease(page, { x: 200, y: 400, dx: 200, rest: 0, wait: 0 });
    const g = await page.evaluate(() => {
      const t = document.querySelector('#screen-trash');
      const 미끄러지는중 = t.classList.contains('swipe-ease');
      const kid = t.querySelector('.sub-back') || t.firstElementChild;
      kid.dispatchEvent(new TransitionEvent('transitionend', { bubbles: true, propertyName: 'transform' }));
      return { 미끄러지는중, 무대살아있나: t.classList.contains('swipe-top') };
    });
    eq('  (검사가 무력하지 않은지 — 이때 화면이 실제로 미끄러지는 중이다)', g.미끄러지는중, true);
    eq('🔴 화면 안쪽 요소의 전환 신호로 무대를 걷지 않는다', g.무대살아있나, true);
    await page.waitForTimeout(600);

    /* ══ 2026-09-12 개발자 지적: "잘 인식도 안되고 화면도 부자연스러워" ══════════
       ③ **엄지는 곧게 못 움직인다.** 엄지를 굴려 쓸면 첫 몇 px 이 세로로 먼저 나간다.
          예전 판은 8px 움직인 순간 `|가로| > |세로|` 하나로 정해서 그 손짓을 통째로
          버렸다 — 아래 점들은 그 손놀림을 **진짜 시간 간격으로** 재현한 것이고,
          고치기 전에는 여기서 화면이 안 나갔다(실측). */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    {
      const pts = [[2,-7],[6,-11],[18,-13],[45,-12],[80,-9],[120,-5],[150,0]];
      await page.evaluate(() => { const el = document.elementFromPoint(200, 500); window.__el = el;
        const t = new Touch({ identifier: 1, target: el, clientX: 200, clientY: 500 });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] })); });
      for (const [dx, dy] of pts) {
        await page.evaluate(([dx, dy]) => { const el = window.__el;
          const t = new Touch({ identifier: 1, target: el, clientX: 200 + dx, clientY: 500 + dy });
          el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] })); }, [dx, dy]);
        await page.waitForTimeout(16);           // 진짜 프레임 간격 — 한 틱에 몰면 전부 '툭 치기'가 된다
      }
      await page.evaluate(() => { const el = window.__el;
        const t = new Touch({ identifier: 1, target: el, clientX: 350, clientY: 500 });
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] })); });
      await page.waitForTimeout(650);
      eq('🔴 엄지를 굴려 세로가 먼저 나간 손짓도 알아본다', await page.$eval('#screen-settings', (e) => e.hidden), false);
    }

    /* ④ 가로 손짓이 우리 것이라고 브라우저에 말해 둔다 — 이게 없으면 브라우저가 먼저
       세로 스크롤로 판정해 그 뒤 움직임이 우리에게 오지 않는다(합성 이벤트로는 재현이
       안 되는 자리라, 선언이 살아 있는지를 본다). */
    const ta = await page.evaluate(() => ['settings', 'trash', 'terms', 'logins', 'faq', 'perms']
      .map((n) => getComputedStyle(document.querySelector('#screen-' + n)).touchAction));
    eq('🔴 안쪽 화면 여섯 모두 가로 손짓을 우리가 맡는다 (touch-action: pan-y)',
      ta.every((v) => v === 'pan-y'), true);
    /* 🔴 짧은 화면(앱 권한·빈 휴지통)은 아래쪽이 통째로 비고 그 자리는 `#app` 이다 —
       화면에만 주면 거기서 시작한 손짓을 브라우저가 가져간다(실측으로 잡았다). */
    await page.click('.nav-item[data-nav="my"]'); await page.click('#btn-open-settings');
    await page.waitForSelector('#screen-settings:not([hidden])');
    await page.click('#btn-open-perms'); await page.waitForSelector('#screen-perms:not([hidden])');
    await page.waitForTimeout(400);
    const 빈자리 = await page.evaluate(() => {
      const el = document.elementFromPoint(215, 800);
      return { 무엇: el ? el.id || el.tagName : null, ta: el ? getComputedStyle(el).touchAction : null };
    });
    eq('🔴 짧은 화면 아래 빈 자리에서 쓸어도 우리 것이다', 빈자리.ta, 'pan-y');
    /* 바깥 탭(홈·탐색)으로 나가면 도로 풀린다 — 거기엔 옆으로 넘기는 칩 줄이 있다 */
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForSelector('#screen-home:not([hidden])'); await page.waitForTimeout(300);
    eq('  홈으로 나가면 도로 풀린다 (옆으로 넘기는 칩 줄을 막지 않게)',
      await page.$eval('#app', (e) => getComputedStyle(e).touchAction), 'auto');

    /* ⑤ 뒤 화면이 **너무 옅으면** 깊이가 아니라 '흐려졌다 나타나는 것'으로 보인다 */
    await go('#btn-open-terms', '#screen-terms:not([hidden])');
    await dragHold(page, { x: 200, y: 500, dx: 60 });
    const dim = await page.evaluate(() => ({
      옅기: Number(getComputedStyle(document.querySelector('#screen-settings')).opacity),
      그림자: getComputedStyle(document.querySelector('#screen-terms')).boxShadow,
    }));
    eq('🔴 끌기 시작할 때 뒤 화면이 너무 옅지 않다 (0.55 는 흐릿해 보였다)', dim.옅기 >= 0.75, true);
    eq('🔴 떠나는 면의 그늘이 **왼쪽**으로 진다 (위로 지던 시트 그림자를 쓰면 안 된다)',
      /^rgba?\([^)]*\)\s+-\d/.test(dim.그림자) || /\s-\d+px 0px/.test(dim.그림자), true);
    await dragRelease(page, { x: 200, y: 500, dx: 60, rest: 300 });

    /* 끌다 말면 — 문서 스크롤이 보던 자리로 돌아와야 한다 (fixed 로 올렸다 내리므로) */
    await go('#btn-open-terms', '#screen-terms:not([hidden])');
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 1600); });
    await page.waitForTimeout(300);
    const sy2 = await page.evaluate(() => window.scrollY);
    await dragHold(page, { x: 200, y: 500, dx: 40 });
    await dragRelease(page, { x: 200, y: 500, dx: 40, rest: 300 });
    const d = await page.evaluate(() => ({
      약관그대로: !document.querySelector('#screen-terms').hidden,
      설정숨김: document.querySelector('#screen-settings').hidden,
      문서스크롤: window.scrollY,
    }));
    eq('조금만 끌다 놓으면 안 나간다', d.약관그대로, true);
    eq('  뒤 화면은 도로 숨는다', d.설정숨김, true);
    eq('🔴 보던 자리로 문서가 되돌아온다 (맨 위로 튀지 않는다)', Math.abs(d.문서스크롤 - sy2) < 4, true);
  }

  /* ══ 누를 때의 표시 (2026-09-12 개발자 지적) ═══════════════════════════════════
     *"자주묻는 질문에서 클릭하면 클릭한 부분이 회색으로 변하는데 이 효과 없애줘 …
       알림과 기타도 마찬가지로 회색박스로 채워지는 효과 없애주고 알림은 기타처럼
       누를때 파랗게 표시되게해줘"*
     🔴 회색은 두 갈래였다 — 알림·FAQ 는 **브라우저 기본 판**(rgba(0,0,0,0.18))이 그대로
        칠해졌고(그 목록에 안 들어 있었다), 기타는 우리가 :active 에 칠하던 면이었다.
     ⚠️ 누른 뒤 **전환이 끝나기를 기다려야** 한다 — 색에 전환이 걸려 있어서 바로 재면
        중간값(먹색과 남색 사이)이 나온다. 실제로 그걸 보고 "기타는 안 파래진다"고
        잘못 읽었다. */
  console.log('\n■ 누를 때의 표시 — 회색 판 없이 글자만 남색');
  {
    /* 🔴 손가락 대신 **`:active` 만 켜서** 잰다 (2026-09-12 코드 리뷰가 잡았다).
       마우스를 눌러 재면 `:hover` 도 같이 켜지는데, 이 앱에는 `.my-menu-item:hover` 가
       이미 같은 남색을 준다 — 그래서 우리가 새로 넣은 `:active` 규칙을 **통째로 지워도
       검사가 초록이었다**(실측). 폰에는 hover 가 없으니 그때 학생이 보는 것은 `:active`
       쪽이고, 그것을 재야 진짜 검사다. CDP 로 그 상태만 켠다. */
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const press = async (sel) => {
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
      if (!nodeId) return { 없음: true };
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      await page.waitForTimeout(420);            // 색 전환이 끝나기를 기다린다
      const r = await page.evaluate((s) => {
        const el = document.querySelector(s); const cs = getComputedStyle(el);
        return { 눌렸나: el.matches(':active'), 바탕: cs.backgroundColor,
          글자: cs.color, 기본판: cs.webkitTapHighlightColor };
      }, sel);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await page.waitForTimeout(120);
      return r;
    };
    const 투명 = (c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c);
    const ACCENT = 'rgb(39, 80, 143)';           // --accent (남색)

    await page.click('.nav-item[data-nav="my"]');
    await page.click('#btn-open-settings');
    await page.waitForSelector('#screen-settings:not([hidden])');
    await page.waitForTimeout(400);

    for (const [name, sel] of [['알림 줄', '#my-notify .nf-pref'], ['기타 줄', '#set-etc .my-menu-item']]) {
      const r = await press(sel);
      eq(`${name} — 정말 눌린 상태로 쟀다 (아니면 이 절이 통째로 헛검사다)`, r.눌렸나, true);
      eq(`${name} — 브라우저 기본 회색 판이 꺼져 있다`, 투명(r.기본판), true);
      eq(`${name} — 누를 때 바탕을 칠하지 않는다 (회색 박스 없음)`, 투명(r.바탕), true);
      eq(`🔴 ${name} — 누르면 글자가 남색이 된다`, r.글자, ACCENT);
    }

    /* 🔴 탈퇴만은 빨강 그대로 — 빨강이 '되돌릴 수 없는 일'이라는 표시다 */
    const 탈퇴 = await press('#btn-withdraw');
    const RED = await page.evaluate(() => {
      const d = document.createElement('span'); d.style.color = 'var(--red)';
      document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v;
    });
    /* ⚠️ '남색이 아니다' 로 재면 무슨 색이 되든 통과한다 — **빨강인지**를 본다 */
    eq('🔴 탈퇴는 눌러도 빨강 그대로다 (경고가 사라지면 안 된다)', 탈퇴.글자, RED);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.click('#btn-open-faq');
    await page.waitForSelector('#screen-faq:not([hidden])');
    await page.waitForTimeout(400);
    const faq = await press('.faq-item summary');
    eq('자주 묻는 질문 — 정말 눌린 상태로 쟀다', faq.눌렸나, true);
    eq('🔴 자주 묻는 질문 — 회색으로 변하지 않는다', 투명(faq.기본판) && 투명(faq.바탕), true);
    eq('  대신 글자가 남색이 된다 (다른 줄과 같은 말투)', faq.글자, ACCENT);
  }

  /* ③ 움직임을 줄여 둔 기기 — 무대를 안 세우므로 **너비를 모르는 채** 문턱을 재기 쉽다.
     예전엔 W 가 1로 남아 문턱이 0.32px 이 되어 9px 만 스쳐도 화면이 나갔다. */
  console.log('\n■ 움직임을 줄여 둔 기기 (prefers-reduced-motion)');
  {
    const c2 = await browser.newContext({ viewport: { width: 430, height: 940 }, hasTouch: true, reducedMotion: 'reduce' });
    const p2 = await c2.newPage();
    /* ⚠️ 프로필 열쇠는 `handaejang.v1` 이다 — 위 본 검사와 **같은 방식**으로 넣는다
       (다른 이름으로 넣었다가 온보딩에 갇혀 '화면이 안 보인다'로 죽었다). */
    await p2.addInitScript(() => {
      localStorage.removeItem('handaejang.resume');
      localStorage.setItem('handaejang.v1', JSON.stringify({
        profile: { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
          year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15, region: '서울', parentRegion: '서울',
          nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {} },
        applications: [],
      }));
    });
    await p2.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
    await dismissNotify(p2).catch(() => {});
    await p2.waitForTimeout(300);
    await p2.click('.nav-item[data-nav="my"]');
    await p2.click('#btn-open-settings');
    await p2.waitForSelector('#screen-settings:not([hidden])');
    await p2.click('#btn-open-trash');
    await p2.waitForSelector('#screen-trash:not([hidden])');
    await p2.waitForTimeout(400);
    await swipe(p2, { x: 200, y: 400, dx: 9, steps: 3 });
    eq('🔴 살짝 스친 것(9px)으로는 나가지 않는다 (문턱이 너비를 알아야 한다)',
      await p2.$eval('#screen-trash', (e) => e.hidden), false);
    await swipe(p2, { x: 200, y: 400, dx: 200 });
    eq('  제대로 쓸면 움직임 없이도 나간다', await p2.$eval('#screen-settings', (e) => e.hidden), false);
    await c2.close();
  }

  console.log(errors.length ? '\n❌ 오류:\n' + errors.join('\n') : '\n✓ 콘솔 오류 없음');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 설정 화면 검증 전부 통과');
  process.exit(fail ? 1 : 0);
})();
