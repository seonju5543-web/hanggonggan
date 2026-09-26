/* 온보딩 특별자격 — 칸 사이 간격이 고른가 (2026-08-26)
   개발자 지적: "다문화 가정이랑 공인 외국어성적 보유 칸 사이의 간격이 다른데보다 넓네."
   원인은 목록이 두 덩어리(#in-flags · #in-extra)로 나뉘어 있어 **그 경계만**
   margin-bottom(20px)을 타고, 칸 사이는 gap(10px)이었기 때문이다.
   눈에는 한 목록으로 보이므로 간격도 하나여야 한다.
   🔴 이건 **재 봐야 보이는 결함**이다 — 코드만 읽으면 두 값이 다른 줄 모른다.
   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         CHROME_PATH=... PORT=<포트> node verify/verify-onboard-gaps.js
   🔴 **PORT= 를 반드시 준다** — 8123 에는 다른 워크트리 서버가 떠 있을 수 있다. */
const { chromium } = require('playwright-core');
const { nextUntil, assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  /* 🔴 **무엇을 받아 왔는지 센다** (2026-09-26 · 고문 보고서). 공고는 학교별 파일에서
     오는데, 프로필이 없을 때 옛 `data/notices.json` 을 통째로 받던 자리가 있었다 —
     첫 실행 학생 전원이 그 낭비를 치렀고(실측 33.5KB → 0건), 그걸 없애면 이번에는
     **온보딩을 마쳐도 공고를 다시 받지 않아 화면이 비는** 반대쪽 사고가 난다.
     둘 다 재려면 '받은 주소 목록'이 필요하다. */
  const asked = [];
  page.on('request', (r) => { const u = r.url(); if (/\/data\//.test(u)) asked.push(u.replace(/^https?:\/\/[^/]+\//, '')); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '한국외국어'); await page.waitForTimeout(250);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-track .chip[data-value="humanities"]');
  await page.fill('#in-major', '영어학과'); await page.fill('#in-name', '김한장');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '3.5'); await page.fill('#in-credits', '15');
  await page.selectOption('#in-bracket', '5'); await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  await page.waitForTimeout(400);

  const gaps = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.onboard-step[data-step="3"] .check-item')]
      .filter((e) => e.offsetParent !== null);
    const out = [];
    for (let i = 1; i < items.length; i += 1) {
      const prev = items[i - 1].getBoundingClientRect();
      const cur = items[i].getBoundingClientRect();
      out.push({ after: items[i - 1].textContent.trim().slice(0, 14), gap: Math.round(cur.top - prev.bottom) });
    }
    return out;
  });

  console.log('■ 특별자격 칸 사이 간격');
  gaps.forEach((g) => console.log(`   ${String(g.gap).padStart(3)}px  ${g.after} 아래`));
  eq('보이는 칸이 8개보다 많다 (검사가 헛돌지 않는다)', gaps.length >= 8, true);
  eq('간격이 전부 같다', [...new Set(gaps.map((g) => g.gap))].length, 1);
  /* 덩어리 경계(다문화 가정 → 공인 외국어성적)가 나머지와 같은지 콕 집어 본다 */
  const edge = gaps.find((g) => g.after.includes('다문화'));
  eq('다문화 가정 아래 간격이 나머지와 같다', edge && edge.gap === gaps[0].gap, true);

  /* ── 뒤로가기 (노션 UI-2 · 2026-09-12) ──
     지금 3단계에 있다. 한 번 누르면 2단계로 가고, **친 값이 그대로 있어야** 한다
     (되돌리기가 아니라 자리 옮기기다). 1단계까지 내려가면 학교·학년도 남아 있어야 한다.
     🔴 0단계(환영 화면)에서는 버튼도 줄도 감춘다 — 안 그러면 위가 30px 밀려 내려간다. */
  /* 🔴 단계 번호를 박지 않는다 — '한 칸 줄었는가'만 본다(단계는 늘어난다). */
  const stepNow = () => page.$eval('.onboard-step:not([hidden])', (e) => Number(e.dataset.step));
  const here = await stepNow();
  eq('입력 단계에서는 뒤로가기가 보인다', await page.isVisible('#btn-onboard-back'), true);
  await page.click('#btn-onboard-back');
  eq('한 번 누르면 한 칸 뒤로', await stepNow(), here - 1);
  eq('친 평점이 그대로다 (되돌리기가 아니라 자리 옮기기다)', await page.inputValue('#in-gpa'), '3.5');
  await page.click('#btn-onboard-back');
  eq('두 번 누르면 두 칸 뒤로', await stepNow(), here - 2);
  eq('고른 학교도 그대로다', (await page.inputValue('#in-school')).includes('한국외국어'), true);
  while (await stepNow() > 0) await page.click('#btn-onboard-back');
  eq('끝까지 누르면 환영 화면', await stepNow(), 0);
  eq('환영 화면에서는 뒤로가기가 안 보인다', await page.isVisible('#btn-onboard-back'), false);
  /* 🔴 `isVisible` 로는 이 줄을 못 잡는다 — 0단계에서는 안쪽 둘이 다 숨어 줄이 350×0 이 되고,
     Playwright 는 넓이 0 을 '안 보임'으로 친다. 그래서 **줄만 남기는 회귀**(막대만 감추던 옛 방식)를
     그대로 통과시켰다(되돌려 재 보니 로고가 90 → 120px 로 밀리는데도 초록불). 계산된 값과
     로고 위치를 직접 본다. 2026-09-12 코드 리뷰가 잡은 자리다. */
  eq('환영 화면에서는 줄째로 display:none 이다',
    await page.$eval('.onboard-top', (e) => getComputedStyle(e).display), 'none');
  /* 2026-09-18 부터 0단계는 정문 투어링 시작 화면이다(노션 UI-3) — 로고 타일 대신 오른쪽 위 워드마크(62px)를 잰다 */
  eq('그래서 워드마크가 아래로 안 밀린다 (빈 줄의 여백 30px 이 안 남는다 · 시작 화면은 위 62px)',
    await page.$eval('.start-mark', (e) => Math.round(e.getBoundingClientRect().top)), 62);
  /* 다시 앞으로 가도 값이 남아 있다 — 되돌아온 길이 파괴적이지 않았다는 증거 */
  await page.click('.onboard-step[data-step="0"] [data-next]');
  eq('되돌아와도 학년 선택이 남아 있다',
    await page.$eval('#in-year .chip[data-value="3"]', (e) => e.classList.contains('active')), true);

  /* ── 고치러 들어온 사람에게는 1단계가 첫 칸이다 (노션 UI-2) ──
     그 사람의 0단계는 '시작하기' 인사말이라 돌아갈 곳이 아니고, 그 자리는 취소가 맡는다.
     🔴 온보딩 단계 번호를 박지 않는다 — nextUntil 이 '내 장학금 찾기' 가 보일 때까지 누른다. */
  await nextUntil(page, '#btn-finish-onboard');
  await page.click('#btn-finish-onboard');
  await dismissNotify(page);

  /* ───── 실시간 공고를 어디서 받아 오는가 (2026-09-26 · 고문 보고서) ─────
     고문 지적: "학교별로 JSON 을 쪼개 배포하라." 쪼개는 일은 2026-08-17에 이미 했고,
     남아 있던 낭비는 **옛 파일로 물러나는 길**이었다. 여기서 두 쪽을 다 잰다. */
  console.log('\n[공고 파일] 첫 실행 학생이 무엇을 받는가');
  {
    /* 🔴 프로필이 생기기 전에는 옛 파일을 받지 않아야 한다 — 받아도 한 줄도 못 쓴다
       (`boardNoticesForMe` 가 프로필 없으면 빈 배열로 끝난다). */
    eq('🔴 프로필이 없을 때 옛 파일을 통째로 받지 않았다',
      asked.filter((u) => u === 'data/notices.json'), []);
    /* 🔴 그 대신 **온보딩을 마친 뒤** 그 학교 파일을 받았어야 한다 — 이 짝이 없으면
       첫 실행 학생의 실시간 공고가 앱을 다시 열 때까지 비어 보인다. */
    const shards = asked.filter((u) => /^data\/notices\//.test(u) && !/index\.json$/.test(u));
    /* ⚠️ `eq` 는 인자가 셋이다 — 넷째를 주면 **조용히 버려져** 빨간불일 때 아무것도 안 보인다
       (코드 리뷰에서 잡았다). 그래서 받은 값을 **got 쪽에** 담는다. */
    eq('🔴 온보딩을 마친 뒤 그 학교 공고 파일을 받았다', shards.length > 0 ? true : asked, true);
    eq('색인도 나란히 받았다 (옛 파일을 받을지 판단하는 데 쓴다)',
      asked.some((u) => u === 'data/notices/index.json'), true);
    /* 그리고 화면에 실제로 공고가 보여야 한다 — 받아 온 것을 쓰고 있는가 */
    await page.waitForTimeout(600);
    const cards = await page.evaluate(() => ({
      뼈대: document.querySelectorAll('#screen-home #live-notices .skel-list').length,
      공고: document.querySelectorAll('#screen-home #live-notices .notice-card').length,
    }));
    eq('🔴 홈의 실시간 공고가 뼈대에 굳지 않았다', cards.뼈대, 0);
    eq('🔴 홈에 그 학교 공고가 보인다 (받아 온 것을 실제로 쓴다)', cards.공고 > 0 ? true : cards, true);
  }


  await page.click('.nav-item[data-nav="my"]');
  /* ⚠️ 2026-09-12 부터 **카드가 아니라 그 안의 버튼**을 눌러야 수정으로 간다
     (개발자 지시 — 표를 짚기만 해도 넘어가던 것을 막았다). */
  await page.click('.my-edit-hint');
  await page.waitForTimeout(300);
  eq('고치러 들어오면 1단계부터', await stepNow(), 1);
  eq('그 자리에는 취소가 있다', await page.isVisible('.onboard-step[data-step="1"] .btn-onboard-cancel'), true);
  eq('그리고 뒤로가기는 없다 (인사말로 돌아갈 일이 아니다)', await page.isVisible('#btn-onboard-back'), false);

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 온보딩 간격 통과');
  process.exit(fail ? 1 : 0);
})();
