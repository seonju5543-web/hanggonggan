/* 첫 실행 화면 · 이어보기 검증 (2026-09-09 · 노션 원문 목록 4번)

   무엇을 지키는 검사인가 — 설계서(docs/designs/first-run-and-resume.md)의 약속이다.
   전부 2026-09-09에 앱을 띄워 **실측한 결함**이라, 되돌리면 여기서 빨간불이 난다:
     ① 프로필이 있는 학생이 다시 켜면 **어느 시점에도 환영 화면이 안 보인다**
        (예전엔 app.js 가 올 때까지 그게 화면이었다 — 2.5초 늦추자 2.5초 내내 '시작하기')
     ② 탐색 탭에서 나갔다 오면 **탐색 탭**이다 (예전엔 늘 홈)
     ③ 그때 **스크롤이 남의 화면에 안 붙는다** (예전엔 홈인데 282px 내려가 있었다)
     ④ 창(4시간)을 넘기면 홈이지만 **쓰던 신청서는 안 버린다** → 홈에 '신청서 마저 쓰기' 줄
     ⑤ 쓰던 신청서를 열면 **답이 그대로** 돌아온다 (크레딧을 낸 AI 초안도 같은 칸이다)
     ⑥ 알림(`?sch=`)으로 열면 이어보기가 **손을 뗀다**
     ⑦ 학생이 쓴 글이 **기기 밖으로 안 나간다**
     ⑧ 시작 중에 오류가 나도 부팅 화면이 **스스로 걷힌다** (예전엔 '시작하기'에 갇혔다)

   🔴 공고 id 를 박지 않는다 — 마감되면 그때부터 검사가 죽는다. 앱이 아는 것에서 고른다.
   🔴 온보딩 단계 번호·포트·브라우저 경로도 박지 않는다(onboard-helper 를 쓴다). */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');

const PORT = process.env.PORT || 8123;
const EXE = process.env.CHROME_PATH;
const URLBASE = `http://localhost:${PORT}/index.html`;

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
const shown = (page) => page.evaluate(() => ['onboarding', 'home', 'explore', 'applications', 'my']
  .filter((n) => { const el = document.getElementById('screen-' + n); return el && !el.hidden; }).join(',') || '(없음)');

/* 프로필을 심고 다시 연다 — 온보딩을 매번 밟지 않으려고. `resume` 은 이어보기 장부다. */
async function seed(page, resume) {
  await page.evaluate(([prof, rs]) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false }, applications: [], saved: [],
    }));
    if (rs) localStorage.setItem('handaejang.resume', JSON.stringify(rs));
    else localStorage.removeItem('handaejang.resume');
  }, [PROFILE, resume || null]);
}

/* 🔴 **살아 있는 탭에서 장부를 심고 새로고침하면 안 된다** (2026-09-09 이 검사를 짜며 겪음):
   앱은 나갈 때(`pagehide`) '마지막으로 본 시각'을 지금으로 찍는데 — 그게 맞는 동작이다 —
   새로고침도 그 경로를 타므로 **심어 둔 옛 시각이 지금으로 덮인다.** 그래서 '5시간 전'을
   심어도 늘 '방금'이 되어 창 판정을 영영 못 잰다.
   대신 **새 탭**에 넣고 연다: 덮어쓸 앱이 아직 없다. */
async function openWith(ctx, resume) {
  const p = await ctx.newPage();
  await p.addInitScript(([prof, rs]) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false }, applications: [], saved: [],
    }));
    if (rs) localStorage.setItem('handaejang.resume', JSON.stringify(rs));
    else localStorage.removeItem('handaejang.resume');
  }, [PROFILE, resume || null]);
  await p.goto(URLBASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1600);
  return p;
}

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));

  await page.goto(URLBASE, { waitUntil: 'networkidle' });
  await seed(page);

  /* ── ① 다시 켤 때 환영 화면이 스치지도 않는다 ─────────────────────────
     app.js 를 늦춰 **앱 코드가 오기 전의 화면**을 본다. 이게 실측된 원래 증상이다. */
  console.log('\n■ ① 다시 켜도 환영 화면이 안 보인다');
  {
    /* 🔴 **서비스워커를 막은 새 판**에서 잰다 (2026-09-09 · CI 가 잡아냈다).
       이 블록은 app.js 를 늦춰 '앱 코드가 오기 전의 화면'을 보는 것이 전부인데, 앞 판이
       등록해 둔 서비스워커가 살아 있으면 **캐시에서 app.js 를 즉시 내주어 늦추기가 무시된다.**
       그러면 앱은 곧바로 뜨고 '환영 화면이 안 뜬다'는 아무것도 안 재고 통과한다 —
       빨간불보다 나쁜 **거짓 초록불**이다. ⑧번이 같은 함정에 걸렸던 것과 같은 자리다. */
    const slowCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await slowCtx.addInitScript((prof) => localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false }, applications: [], saved: [],
    })), PROFILE);
    const slow = await slowCtx.newPage();
    await slow.route('**/app.js', async (r) => { await new Promise((x) => setTimeout(x, 1800)); await r.continue(); });
    await slow.goto(URLBASE, { waitUntil: 'commit' }).catch(() => {});
    /* DOM 이 생기기 전에 재면 전부 '안 보임'이라 아무것도 못 잰다 — 부팅 화면이 붙기를 기다린다 */
    await slow.waitForSelector('#boot', { state: 'attached', timeout: 5000 }).catch(() => {});
    /* 🔴 부팅 화면이 떠 있는지도 **이 안에서** 본다 — 반복이 끝난 뒤에 재면 그새 app.js 가
       도착해 걷혀 있어, 멀쩡한 앱에서도 빨간불이 난다(짜면서 실제로 그랬다). */
    let sawOnboarding = false;
    let sawBoot = false;
    for (let i = 0; i < 6; i++) {
      await slow.waitForTimeout(200);
      const s = await shown(slow).catch(() => '');
      if (s.includes('onboarding')) sawOnboarding = true;
      if (await slow.isVisible('#boot').catch(() => false)) sawBoot = true;
    }
    /* 🔴 부팅 화면을 한 번도 못 봤다면 **늦추기가 안 먹은 것**이다 — 그 판에서는 위의
       '환영 화면이 안 뜬다'도 아무것도 안 잰 셈이라, 통과로 넘기면 거짓 초록불이 된다. */
    ok('그 사이 부팅 화면이 떠 있다 (안 보이면 늦추기가 안 먹은 것)', sawBoot);
    ok('앱 코드가 오기 전에 환영 화면이 안 뜬다', sawBoot && !sawOnboarding);
    await slow.waitForTimeout(2500);
    ok('앱 코드가 오면 부팅 화면이 걷힌다', await slow.isHidden('#boot').catch(() => false));
    ok('그리고 홈이다', (await shown(slow)) === 'home');
    await slow.close();
    await slowCtx.close();
  }

  /* ── ②③ 하던 탭과 스크롤로 돌아온다 ─────────────────────────────── */
  console.log('\n■ ②③ 하던 탭·스크롤 그대로');
  await page.goto(URLBASE, { waitUntil: 'networkidle' });
  await dismissNotify(page);
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(400);
  /* 🔴 **`visibilitychange` 를 그냥 쏘면 아무 일도 안 난다** (2026-09-09 코드 리뷰):
     앱의 처리는 `document.visibilityState === 'hidden'` 일 때만 도는데, 이벤트만 쏘면
     그 값은 여전히 'visible' 이라 곧바로 돌아간다. 그러면 이 검사는 새로고침 때의
     `pagehide` 덕에 **통과하는 것처럼 보이고, 정작 휴대폰에서만 쓰이는 경로는 한 번도
     안 재게 된다.** 값을 바꿔 두고 쏜다. */
  const savedOnHide = await page.evaluate(async () => {
    localStorage.removeItem('handaejang.resume');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 200));
    const book = localStorage.getItem('handaejang.resume');
    delete document.visibilityState;   // 원래대로
    return book;
  });
  ok('앱이 숨는 순간에 장부가 적힌다 (휴대폰 경로)',
    !!savedOnHide && JSON.parse(savedOnHide).screen === 'explore', String(savedOnHide).slice(0, 60));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  ok('탐색 탭에서 나갔다 오면 탐색 탭이다', (await shown(page)) === 'explore', await shown(page));
  const y = await page.evaluate(() => window.scrollY);
  ok('보던 자리로 돌아온다 (0이 아니다)', y > 50, `scrollY=${y}`);

  /* 홈으로 옮겨 두고 다시 열면 홈이어야 한다 — 스크롤이 남의 화면에 안 붙는지 함께 본다 */
  await page.click('.nav-item[data-nav="home"]');
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  ok('홈으로 옮겨 두면 홈이다', (await shown(page)) === 'home', await shown(page));
  ok('홈의 스크롤이 탐색 탭 것을 물려받지 않는다', (await page.evaluate(() => window.scrollY)) < 50);

  /* ── ④⑤ 창을 넘겨도 쓰던 신청서는 안 버린다 ───────────────────────
     실제 공고 id 를 앱에서 고른다(박지 않는다). 양식이 붙은 등록 공고 하나면 된다. */
  console.log('\n■ ④⑤ 쓰던 신청서는 창을 넘겨도 남는다');
  /* 🔴 양식이 붙었다고 다 되는 게 아니다 — **글자를 칠 칸이 있는** 공고를 골라야 한다.
     처음엔 그냥 첫 번째를 집었는데 제주 동의서는 체크만 있는 양식이라 칠 칸이 0개였고,
     '친 글이 돌아온다'가 조용히 건너뛰어졌다(검사가 아무 말 없이 무력해지는 자리다). */
  const target = await page.evaluate(() => {
    const hasTyping = (tpl) => (tpl && tpl.sections || []).some((sec) =>
      (sec.fields || []).some((f) => !f.type || f.type === 'text' || f.type === 'textarea'));
    const list = (typeof registeredList !== 'undefined' ? registeredList : []).filter((s) => s.formId);
    const hit = list.find((s) => hasTyping(FORM_TEMPLATES[s.formId]));
    return hit ? { id: hit.id, name: hit.name } : null;
  });
  if (!target) {
    console.log('  · 글자를 칠 칸이 있는 등록 양식이 없어 ④⑤를 건너뜁니다');
  } else {
    const FIVE_H = 5 * 3600e3;
    const stale = await openWith(ctx, {
      v: 1, at: Date.now() - FIVE_H, screen: 'explore', scroll: {},
      form: { schId: target.id, ans: {}, stage: 'q', at: Date.now() - FIVE_H },
    });
    await dismissNotify(stale);
    ok('5시간 만에 열면 홈으로 간다', (await shown(stale)) === 'home', await shown(stale));
    ok("홈에 '신청서 마저 쓰기' 줄이 있다", await stale.isVisible('#home-resume').catch(() => false));
    const sub = await stale.textContent('#home-resume').catch(() => '');
    ok('그 줄이 어느 공고인지 말한다', String(sub).includes(target.name.slice(0, 6)), sub && String(sub).slice(0, 40));

    await stale.click('#home-resume');
    await stale.waitForTimeout(1400);
    ok('눌러서 신청서로 들어간다', await stale.isVisible('#btn-ff-generate').catch(() => false));

    /* 학생이 친 글이 실제로 장부에 남는지 — 그리고 창 안(5분)이면 그 신청서가 바로 열리는지.
       🔴 장부는 앱이 스스로 적은 것을 읽는다(우리가 심지 않는다) — 심으면 '적는 쪽'이 죽어도 통과한다. */
    const typed = await stale.evaluate(() => {
      const el = document.querySelector('#detail-sheet textarea, #detail-sheet input[type="text"]');
      if (!el) return false;
      el.value = '이어보기 검사가 친 글';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    });
    ok('신청서에 칠 칸이 있다 (없으면 아래 검사가 조용히 건너뛴다)', typed);
    if (typed) {
      await stale.waitForTimeout(1400);   // 디바운스(700ms)보다 길게
      const book = await stale.evaluate(() => localStorage.getItem('handaejang.resume'));
      ok('치는 동안 장부에 적힌다 (아무것도 안 눌러도)', String(book).includes('이어보기 검사가 친 글'));

      const fresh = await openWith(ctx, JSON.parse(book));
      await dismissNotify(fresh);
      ok('5분 안에 오면 쓰던 신청서가 바로 열린다', await fresh.isVisible('#btn-ff-generate').catch(() => false));
      const back = await fresh.evaluate(() => [...document.querySelectorAll('#detail-sheet textarea, #detail-sheet input[type="text"]')]
        .some((e) => e.value === '이어보기 검사가 친 글'));
      ok('친 글이 그대로 돌아와 있다', back);
      await fresh.close();
    }
    await stale.close();
  }

  /* ── ⑥ 알림으로 열면 이어보기가 손을 뗀다 ─────────────────────────── */
  console.log('\n■ ⑥ 알림이 이어보기를 이긴다');
  if (target) {
    await seed(page, { v: 1, at: Date.now() - 60e3, screen: 'my', scroll: {} });
    await page.goto(`${URLBASE}?sch=${encodeURIComponent(target.id)}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2600);   // notifyHandleLaunch 는 1.6초 뒤에 돈다
    const s = await shown(page);
    ok('마지막 탭(MY)으로 가지 않는다', s !== 'my', s);
    ok('그 공고가 열린다', await page.isVisible('#detail-sheet').catch(() => false));
  }

  /* ── ⑦ 학생이 쓴 글은 기기 밖으로 안 나간다 ──────────────────────── */
  console.log('\n■ ⑦ 쓴 글이 기기 밖으로 안 나간다');
  {
    const bodies = [];
    await page.route('**/*', async (route) => {
      const r = route.request();
      const host = new URL(r.url()).host;
      if (!host.startsWith('localhost')) bodies.push(r.postData() || r.url());
      await route.continue().catch(() => {});
    });
    await seed(page, {
      v: 1, at: Date.now() - 60e3, screen: 'home', scroll: {},
      form: { schId: (target && target.id) || 'x', ans: { secret: '주민등록번호 900101-1234567' }, stage: 'q', at: Date.now() },
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    ok('바깥으로 나간 요청에 쓴 글이 없다', !bodies.some((b) => String(b).includes('900101')), `요청 ${bodies.length}건`);
    await page.unroute('**/*');
  }

  /* ── ⑧ 시작 중에 오류가 나도 부팅 화면이 걷힌다 ───────────────────── */
  console.log('\n■ ⑧ 오류가 나도 갇히지 않는다');
  {
    /* 🔴 **서비스워커를 막은 새 판**에서 잰다. 이 검사는 app.js 를 가로채 일부러 던지게
       하는데, 앞선 검사들이 등록해 둔 서비스워커가 살아 있으면 캐시에서 멀쩡한 app.js 를
       내주어 가로채기가 통째로 무시된다 — 앱은 정상으로 뜨고 검사만 조용히 거짓이 된다. */
    const brokeCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await brokeCtx.addInitScript((prof) => localStorage.setItem('handaejang.v1', JSON.stringify({
      profile: prof, consent: { sensitive: false }, applications: [], saved: [],
    })), PROFILE);
    const broke = await brokeCtx.newPage();
    await broke.route('**/app.js', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("일부러 낸 오류");' }));
    await broke.goto(URLBASE, { waitUntil: 'commit' }).catch(() => {});
    /* 고정 시간으로 재지 않는다 — 시한(6초)을 고치면 검사가 조용히 어긋난다 */
    const failShown = await broke.waitForSelector('#boot-fail:not([hidden])', { timeout: 12000 })
      .then(() => true).catch(() => false);
    ok('환영 화면에 갇히지 않는다', !(await shown(broke)).includes('onboarding'), await shown(broke));
    ok('무슨 일인지 말하고 다시 시도하게 한다', failShown);
    await broke.close();
    await brokeCtx.close();
  }

  ok('콘솔 오류 없음', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n${fails.length ? '✕' : '✓'} 통과 ${pass} · 실패 ${fails.length}`);
  if (fails.length) { fails.forEach((f) => console.log(`   - ${f}`)); process.exit(1); }
})();
