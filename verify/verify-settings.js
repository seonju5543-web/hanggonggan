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

  /* 🔴 **학적정보 수정은 그 글자만 눌러야 간다** (2026-09-12 개발자 지시 — "전체 표를 눌러도
     수정하는 걸로 넘어가는데 학적정보수정 부분만 눌렀을 때 수정가능하게").
     전에는 카드 전체가 버튼이라, 학생이 제 성적·구간 표를 짚기만 해도 화면이 바뀌었다. */
  {
    eq('프로필 카드 자체는 버튼이 아니다 (보조기기가 "버튼"이라 읽지 않는다)',
      await page.$eval('#my-profile', (e) => e.getAttribute('role')), null);
    eq('  카드에 Tab 이 멈추지 않는다',
      await page.$eval('#my-profile', (e) => e.hasAttribute('tabindex')), false);
    eq('  「학적정보 수정」은 진짜 버튼이라 키보드로 닿는다',
      await page.$eval('.my-edit-hint', (e) => e.tagName + ':' + e.tabIndex), 'BUTTON:0');

    await page.click('#my-profile .my-grid div:nth-child(3)');   // 지원구간 칸
    await page.waitForTimeout(400);
    eq('🔴 표(지원구간 칸)를 눌러도 수정으로 넘어가지 않는다',
      await page.evaluate(() => currentScreen), 'my');
    await page.click('#my-profile .my-line');                    // 학교·학과 줄
    await page.waitForTimeout(400);
    eq('🔴 학교 줄을 눌러도 넘어가지 않는다',
      await page.evaluate(() => currentScreen), 'my');

    /* 🔴 사진 단추를 눌러도 수정으로 안 넘어간다 — 예전엔 카드가 버튼이라 파일 창과
       수정 화면이 **같이** 열렸고, 그걸 캡처 단계 가로채기로 막고 있었다. 그 장치를 걷은
       지금은 '카드가 버튼이 아니다'가 근거라, 실제 동작으로 한 번 확인해 둔다. */
    /* ⚠️ 없으면 **건너뛰지 않고 빨간불** — `if (photoBtn)` 로 감싸 두면 단추가 사라진 날
       이 줄이 조용히 초록이 된다(2026-09-12 코드 리뷰). 누르기 실패도 삼키지 않는다. */
    const photoBtn = await page.$('.my-photo-btns button, .my-photo-btns label');
    eq('사진 단추가 화면에 있다 (없으면 아래 줄이 헛돈다)', !!photoBtn, true);
    if (photoBtn) {
      await photoBtn.click();
      await page.waitForTimeout(400);
      eq('🔴 사진 단추를 눌러도 수정으로 넘어가지 않는다',
        await page.evaluate(() => currentScreen), 'my');
    }

    /* 🔴 **닿는 자리를 재 둔다** (2026-09-12 코드 리뷰) — 수정으로 가는 문이 이 글자 하나뿐인데
       글자 높이는 21px 밖에 안 된다. 여백으로 넓히고 음수 여백으로 되돌려 **보이는 자리는 그대로**
       두었으니, 여기서 재는 것은 **손가락이 닿는 크기**다(44px 권고에 닿는지). */
    const hint = await page.$eval('.my-edit-hint', (e) => {
      const r = e.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width) };
    });
    eq(`🔴 「학적정보 수정」이 손가락에 닿는 크기다 (지금 ${hint.h}px 높이)`, hint.h >= 44, true);

    await page.click('.my-edit-hint');
    await page.waitForTimeout(600);
    eq('🔴 「학적정보 수정」을 누르면 넘어간다',
      await page.evaluate(() => currentScreen), 'onboarding');
    /* 되돌아와서 다음 절이 MY 에서 시작하게 둔다.
       ⚠️ 온보딩에서는 **아래 탭이 숨는다** — 탭을 누르려 하면 30초를 기다리다 죽는다.
          보이는 '취소' 버튼을 누르고, 그래도 안 되면 화면을 직접 부른다. */
    const cancel = await page.$('[data-onboard-cancel]:not([hidden])');
    if (cancel) await cancel.click();
    await page.waitForTimeout(600);
    if (await page.$eval('#screen-my', (e) => e.hidden)) {
      await page.evaluate(() => showScreen('my'));
      await page.waitForSelector('#screen-my:not([hidden])');
    }
    await page.waitForTimeout(300);
  }

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

  /* 🔴 **절 사이 빈칸은 눈에 보이는 것끼리 재야 한다** (2026-09-12 개발자 지시 "알림과
     기타 사이 간격이 너무 커서 줄여"). 상자끼리 재면 둘 다 49px 로 **똑같아서 아무 문제가
     없어 보인다** — 실제로 그렇게 재고 한 번 헷갈렸다. 알림의 마지막 줄은 제 여백 11px 을
     이미 갖고 그 밑에 구분선도 없어서, 눈에는 62px 로 보였다(계정→알림 은 49px). */
  {
    const 빈칸 = await page.evaluate(() => {
      const btn = document.querySelector('#my-account .btn, #my-account button');
      const rows = [...document.querySelectorAll('#my-notify .nf-pref')];
      const sw = rows[rows.length - 1].querySelector('.nf-switch');
      const t1 = document.querySelector('#my-notify .wallet-title').getBoundingClientRect().top;
      const t2 = document.querySelector('#set-etc .wallet-title').getBoundingClientRect().top;
      return { 계정_알림: Math.round(t1 - btn.getBoundingClientRect().bottom),
        알림_기타: Math.round(t2 - sw.getBoundingClientRect().bottom) };
    });
    eq('  (검사가 무력하지 않은지 — 두 빈칸을 실제로 쟀다)',
      빈칸.계정_알림 > 20 && 빈칸.알림_기타 > 20, true);
    eq(`🔴 알림→기타 빈칸이 계정→알림과 같은 리듬이다 (${빈칸.계정_알림}px vs ${빈칸.알림_기타}px)`,
      Math.abs(빈칸.알림_기타 - 빈칸.계정_알림) <= 4, true);
  }

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

  /* ══ 뒤로 쓸기 — 손짓 인식 (2026-09-12 개발자 지시로 패럴랙스는 걷어냈다) ═══════
     *"패럴렉스 지금까지한거 전부 지워"* — 두 겹(뒤 화면을 미리 끌어다 놓는 것)은 없앴다.
     남은 것은 **손짓을 알아보는 것**이고, 아래 둘이 그걸 지킨다.
     🔴 그전 '쓸어 나가기' 절은 결과(나갔는가)만 봐서, 아래 두 경우를 못 잡았다. */
  console.log('\n■ 뒤로 쓸기 — 손짓 인식');
  {
    const go = async (btn, screen) => {
      await page.click('.nav-item[data-nav="my"]');
      await page.click('#btn-open-settings');
      await page.waitForSelector('#screen-settings:not([hidden])');
      await page.click(btn); await page.waitForSelector(screen);
      await page.waitForTimeout(450);
    };

    /* ① **엄지는 곧게 못 움직인다.** 엄지를 굴려 쓸면 첫 몇 px 이 세로로 먼저 나간다.
       예전 판은 8px 움직인 순간 `|가로| > |세로|` 하나로 정해서 그 손짓을 통째로
       버렸다 — 아래 점들은 그 손놀림을 **진짜 시간 간격으로** 재현한 것이고,
       고치기 전에는 여기서 화면이 안 나갔다(실측). */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    {
      const pts = [[2, -7], [6, -11], [18, -13], [45, -12], [80, -9], [120, -5], [150, 0]];
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

    /* ② 가로 손짓이 우리 것이라고 브라우저에 말해 둔다 — 이게 없으면 브라우저가 먼저
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
      return { ta: el ? getComputedStyle(el).touchAction : null };
    });
    eq('🔴 짧은 화면 아래 빈 자리에서 쓸어도 우리 것이다', 빈자리.ta, 'pan-y');
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForSelector('#screen-home:not([hidden])'); await page.waitForTimeout(300);
    eq('  홈으로 나가면 도로 풀린다 (옆으로 넘기는 칩 줄을 막지 않게)',
      await page.$eval('#app', (e) => getComputedStyle(e).touchAction), 'auto');

    /* ③ 🔴 **패럴랙스가 정말 사라졌는가** — 끄는 동안 뒤 화면이 딸려 나오면 안 된다.
       개발자가 "전부 지워"라고 했으므로 되살아나면 빨간불이어야 한다. */
    await go('#btn-open-terms', '#screen-terms:not([hidden])');
    await dragHold(page, { x: 200, y: 500, dx: 120 });
    const 겹 = await page.evaluate(() => {
      const t = document.querySelector('#screen-terms');
      const u = document.querySelector('#screen-settings');
      return { 앞: Math.round(t.getBoundingClientRect().left), 뒤숨김: u.hidden,
        자국: /swipe-(top|under|ease)/.test(t.className + ' ' + u.className),
        무대: getComputedStyle(t).position };
    });
    eq('끄는 동안 앞 화면은 손끝을 그대로 따라온다', 겹.앞, 120);
    eq('🔴 뒤 화면을 미리 끌어다 놓지 않는다 (패럴랙스 없음)', 겹.뒤숨김, true);
    eq('  무대를 세우지 않는다 (화면이 fixed 가 되지 않는다)', 겹.무대 !== 'fixed', true);
    eq('  swipe-top·under·ease 자국이 없다', 겹.자국, false);
    await dragRelease(page, { x: 200, y: 500, dx: 120, rest: 0 });

    /* ④ 🔴 **점이 전부 같은 밀리초에 몰린 빠른 튕김**도 알아본다 (2026-09-12).
       브라우저는 touchmove 를 묶어 보내고 `Date.now()` 는 1ms 눈금이라 실제로 생긴다.
       예전 판은 구간 길이가 0이면 '멈춤'으로 읽어 그 튕김을 버렸다 — 검사가 세 번에
       한 번 빨간불이던 것이 이 경합이었다.
       ⚠️ 경합에 기대면 red-green 이 안 되므로 **시계를 묶어** 반드시 그 조건이 되게 한다. */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    await page.evaluate(() => {
      const el = document.elementFromPoint(200, 400);
      const real = Date.now;
      const frozen = real();
      Date.now = () => frozen;                     // 손짓 내내 같은 밀리초
      const mk = (type, cx) => { const t = new Touch({ identifier: 1, target: el, clientX: cx, clientY: 400 });
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
          touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
      mk('touchstart', 200); mk('touchmove', 220); mk('touchmove', 240); mk('touchend', 240);
      Date.now = real;
    });
    await page.waitForTimeout(600);
    eq('🔴 점이 전부 같은 밀리초여도 빠른 튕김으로 본다 (멈춤이 아니다)',
      await page.$eval('#screen-settings', (e) => e.hidden), false);

    /* ⑤ 🔴 **남의 자국을 지우지 않는다** (2026-09-12 코드 리뷰 · 실측으로 잡았다).
       안쪽 화면에서 아래로 당기면 '당겨서 새로고침'이 화면에 translateY 를 걸어 두는데,
       우리 손짓 판정이 `#app` 에 붙어 document 보다 먼저 돌기 때문에, 놓는 순간 우리가
       먼저 그 자국을 지워 되돌아가는 움직임이 통째로 사라졌다. */
    /* ⚠️ '놓은 뒤에 자국이 남아 있나' 로 재면 안 된다 — 당겨서 새로고침은 **스스로**
       transition 을 걸고 transform 을 비워 되돌아간다(그게 그 움직임이다). 봐야 하는 것은
       **두 손 사이의 이음매**다: 손짓 판정은 `#app` 에, 당겨서 새로고침은 `document` 에
       달려 있으니 그 사이인 `body` 에서 한 번 들여다보면 우리가 지웠는지가 드러난다. */
    await go('#btn-open-trash', '#screen-trash:not([hidden])');
    const ptr = await page.evaluate(() => new Promise((done) => {
      const el = document.elementFromPoint(215, 300);
      const scr = document.querySelector('#screen-trash');
      let 이음매 = null;
      const spy = () => { 이음매 = scr.style.transform; };
      document.body.addEventListener('touchend', spy);
      const mk = (type, y) => { const t = new Touch({ identifier: 1, target: el, clientX: 215, clientY: y });
        el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true,
          touches: type === 'touchend' ? [] : [t], targetTouches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
      window.scrollTo(0, 0);
      mk('touchstart', 200); mk('touchmove', 240); mk('touchmove', 300);
      const 당기는중 = scr.style.transform;
      mk('touchend', 300);
      document.body.removeEventListener('touchend', spy);
      done({ 당기는중, 이음매, 되돌림전환: scr.style.transition });
    }));
    eq('  (검사가 무력하지 않은지 — 당길 때 실제로 자국이 생긴다)', /translateY/.test(ptr.당기는중), true);
    eq('🔴 아래로 당겼다 놓아도 우리가 먼저 그 자국을 지우지 않는다', /translateY/.test(ptr.이음매), true);
    eq('  그래서 당겨서 새로고침이 제 움직임으로 되돌아간다', /transform/.test(ptr.되돌림전환), true);
    await page.waitForTimeout(500);

    /* ⑥ 🔴 **시트가 떠 있으면 가로 손짓을 풀어 준다** — 시트는 `#app` 안에 있고
       touch-action 은 조상과의 교집합이라, 안 풀면 도우미 시트의 칩 줄(실측 517 > 430)이
       안쪽 화면에서 손으로 안 밀린다. */
    await page.click('.nav-item[data-nav="my"]'); await page.click('#btn-open-settings');
    await page.waitForSelector('#screen-settings:not([hidden])'); await page.waitForTimeout(300);
    await page.click('#btn-chat-fab');
    await page.waitForSelector('#chat-sheet:not([hidden])'); await page.waitForTimeout(700);
    const 시트 = await page.evaluate(() => ({
      칩줄_넘침: (() => { const c = document.querySelector('.chat-chips');
        return c ? c.scrollWidth > c.clientWidth + 2 : null; })(),
      app: getComputedStyle(document.querySelector('#app')).touchAction,
    }));
    eq('  (검사가 무력하지 않은지 — 칩 줄이 실제로 가로로 넘친다)', 시트.칩줄_넘침, true);
    eq('🔴 시트가 떠 있는 동안 가로 손짓을 막지 않는다', 시트.app, 'auto');
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    eq('  시트를 닫으면 도로 우리 것이 된다',
      await page.$eval('#app', (e) => getComputedStyle(e).touchAction), 'pan-y');

    /* ⑦ 조금만 끌다 놓으면 안 나간다 (손을 멈췄으면 툭 치기가 아니다) */
    await go('#btn-open-terms', '#screen-terms:not([hidden])');
    await dragHold(page, { x: 200, y: 500, dx: 40 });
    await dragRelease(page, { x: 200, y: 500, dx: 40, rest: 300 });
    const d = await page.evaluate(() => ({
      약관그대로: !document.querySelector('#screen-terms').hidden,
      자국: document.querySelector('#screen-terms').style.transform,
    }));
    eq('조금만 끌다 놓으면 안 나간다', d.약관그대로, true);
    eq('  끌던 자국이 남지 않는다', d.자국, '');
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
    /* 🔴 **9px 로 재면 헛검사다** (2026-09-12 코드 리뷰). 축을 잡는 데 가로 10px 이
       필요하므로 9px 은 시작도 안 되고, 그러면 문턱(W × 0.22)을 **한 번도 안 건드린다** —
       너비를 안 재는 버그(문턱이 0.22px 이 되는 것)를 넣어도 통과한다.
       축은 잡히되 문턱엔 못 미치는 **20px + 멈췄다 놓기**로 재야 그 버그가 드러난다. */
    await dragHold(p2, { x: 200, y: 400, dx: 20 });
    await dragRelease(p2, { x: 200, y: 400, dx: 20, rest: 300 });
    eq('🔴 살짝(20px) 끌다 놓으면 나가지 않는다 (문턱이 화면 너비를 알아야 한다)',
      await p2.$eval('#screen-trash', (e) => e.hidden), false);
    await swipe(p2, { x: 200, y: 400, dx: 200 });
    eq('  제대로 쓸면 움직임 없이도 나간다', await p2.$eval('#screen-settings', (e) => e.hidden), false);
    await c2.close();
  }

  /* ── 구분선 — 불필요한 것이 되돌아오지 않는다 (2026-09-12 개발자 지시) ──
     *"현재 불필요한 구분선 삭제 부탁해. 구분선이 너무 많은 느낌이 들어"*
     🔴 **눈으로 세지 말고 그려 놓고 센다** — 처음엔 CSS 를 읽고 짐작했는데, 실제로 그려
        보니 MY 한 화면에 가로줄이 21개였고 그중 다섯은 **다른 줄 바로 옆에 붙은 중복**이었다.
     🔴 이 절이 막는 것은 **세 가지 되돌림**이다: ① 학적정보 표에 칸마다 줄을 다시 긋는 것
        ② 빈 안내문이 이미 줄이 있는 자리에서 제 윗줄을 또 긋는 것 ③ 그 둘이 아니더라도
        MY 의 가로줄 수가 지금보다 **늘어나는 것**(톱니 — 지금 값이 천장이다).
     ⚠️ 알약·버튼의 테두리는 위아래가 같은 요소라 함께 세어진다. 천장은 그 상태로 잰 값이다. */
  console.log('\n■ 구분선 — 불필요한 줄이 되돌아오지 않는다');
  {
    const 가로줄 = (pg) => pg.evaluate(() => {
      let n = 0;
      const 보이는줄 = (cs, side) => parseFloat(cs[`border${side}Width`])
        && cs[`border${side}Style`] !== 'none'
        && cs[`border${side}Color`] !== 'rgba(0, 0, 0, 0)';
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        const cs = getComputedStyle(el);
        /* 🔴 **테두리와 구분선을 가른다** — 알약·동그라미·테두리 버튼은 네 면이 다 있고,
           구분선은 위나 아래 **한쪽뿐**이다. 안 가르면 사진 동그라미·적합도 알약·당겨서
           새로고침의 고리까지 '구분선'으로 세어져 이 숫자가 뜻을 잃는다(실측으로 드러났다). */
        if (보이는줄(cs, 'Left') && 보이는줄(cs, 'Right')) continue;
        for (const side of ['Top', 'Bottom']) {
          if (!parseFloat(cs[`border${side}Width`])) continue;
          if (cs[`border${side}Style`] === 'none') continue;
          if (cs[`border${side}Color`] === 'rgba(0, 0, 0, 0)') continue;
          n += 1;
        }
      }
      return n;
    });

    await page.click('.nav-item[data-nav="my"]');
    await page.waitForSelector('#screen-my:not([hidden])');
    await page.waitForTimeout(600);

    /* ① 학적정보 표 — 칸마다 긋던 줄이 없다(윗줄 하나는 남는다) */
    const 표 = await page.$$eval('.my-grid > div', (els) => els.map((e) =>
      parseFloat(getComputedStyle(e).borderBottomWidth)));
    eq(`  (검사가 무력하지 않은지 — 표의 칸을 실제로 찾았다: ${표.length}칸)`, 표.length >= 3, true);
    eq('🔴 학적정보 표에 칸마다 줄을 긋지 않는다', 표.every((w) => !w), true);
    eq('  다만 표를 윗블록과 가르는 줄 하나는 남는다',
      parseFloat(await page.$eval('.my-grid', (e) => getComputedStyle(e).borderTopWidth)) > 0, true);

    /* ② 빈 안내문이 이미 줄이 있는 자리에서 윗줄을 또 긋지 않는다 */
    const 빈안내 = await page.$$eval('.empty', (els) => els
      .filter((e) => e.offsetParent)
      .map((e) => ({
        첫자식: e.previousElementSibling === null,
        마이카드: !!e.closest('.my-card'),
        윗줄: parseFloat(getComputedStyle(e).borderTopWidth) || 0,
      })));
    eq(`  (검사가 무력하지 않은지 — 빈 안내문을 실제로 찾았다: ${빈안내.length}개)`, 빈안내.length > 0, true);
    eq('🔴 이미 줄이 있는 자리의 빈 안내문은 제 윗줄을 안 그린다',
      빈안내.filter((x) => (x.첫자식 || x.마이카드) && x.윗줄).length, 0);

    /* ②-b 🔴 **MY 만 보면 반쪽이다** (2026-09-12 코드 리뷰) — MY 에 보이는 빈 안내문은
       `.my-card` 안의 것 하나뿐이라, `.empty:first-child` 를 통째로 지워도 위 줄이 초록이다.
       그 쪽이 실제로 일하는 자리는 **홈**이다(빈 목록이 `.card-list` 의 첫 자식이고,
       바로 위 `.section-head` 가 이미 줄을 그었다). 그래서 홈까지 가서 본다. */
    await page.click('.nav-item[data-nav="home"]');
    await page.waitForSelector('#screen-home:not([hidden])');
    await page.waitForTimeout(600);
    /* ⚠️ 그 자리는 **목록이 비었을 때만** 생기므로 세션 상태에 기대면 안 된다(실측: 이
       드라이버의 홈에는 0개였다). 앱이 실제로 그리는 모양(`.section-head` + `.card-list`
       첫 자식 `.empty`)을 그대로 넣어 재고 바로 치운다 — 재는 것은 CSS 규칙 하나다. */
    const 홈빈안내 = await page.evaluate(() => {
      const host = document.createElement('div');
      host.innerHTML = '<div class="section-head"><h3>검사용</h3></div>'
        + '<div class="card-list"><p class="empty" id="__probe">비었어요</p></div>';
      document.querySelector('#screen-home').append(host);
      const probe = document.querySelector('#__probe');
      const got = {
        붙었나: !!probe.offsetParent && probe.previousElementSibling === null,
        윗줄: parseFloat(getComputedStyle(probe).borderTopWidth) || 0,
      };
      host.remove();
      return got;
    });
    eq('  (검사가 무력하지 않은지 — 홈에 빈 목록 모양을 실제로 넣어 쟀다)', 홈빈안내.붙었나, true);
    eq('🔴 홈에서도 첫 자식 빈 안내문은 제 윗줄을 안 그린다', 홈빈안내.윗줄, 0);
    await page.click('.nav-item[data-nav="my"]');
    await page.waitForSelector('#screen-my:not([hidden])');
    await page.waitForTimeout(600);

    /* ③ 톱니 — MY 의 가로줄이 지금보다 늘지 않는다 */
    const MY천장 = 10;   /* 톱니 — 줄이면 이 숫자도 같이 내린다. 이 세는 법(테두리 제외)으로
                            재면 고치기 전이 15개였다. ⚠️ 21 은 테두리까지 세던 옛 숫자다. */
    const my = await 가로줄(page);
    eq(`🔴 MY 의 가로줄이 ${MY천장}개를 넘지 않는다 (지금 ${my}개 · 줄이면 이 숫자도 같이 내린다)`,
      my <= MY천장, true);
  }

  console.log(errors.length ? '\n❌ 오류:\n' + errors.join('\n') : '\n✓ 콘솔 오류 없음');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n❌ ${fail}건 실패` : '\n✅ 설정 화면 검증 전부 통과');
  process.exit(fail ? 1 : 0);
})();
