/* 양식 채우기 — 원본 쪽 그림 위에 답 얹기 (양식 5단계 · 시안 B/C · 2026-10-31 · formfill.js)

   재는 것: ① 빈칸을 찾은 PDF 에만 「양식 채우기」 단추가 선다(찾지 못한 파일은 단추가 없다 — 칸을 지어내지 않는다)
           ② 화면: 쪽 그림 수·칸 수가 로봇 장부(fields.json)와 같다 · 학적정보 칸이 먼저 채워진다 · 아래 탭이 숨는다
           ③ 목록에서 고치면 그림 위도 같이 바뀌고 되돌리기가 뜨며 기기 장부(state.formFills)에 남는다 · 되돌리면 학적정보 값으로
           ④ 남은 칸 알약이 빈 칸 수를 말한다 · 폰에선 서랍(손잡이로 펼침) · 넓은 폭에선 사이드바 · 인쇄 CSS 가 쪽 그림만 남긴다
   🔴 공고 id 를 박지 않는다 — 로봇 장부(data/forms-pdf/index.json + fields.json)에서 빈칸 있는 공고를 그때그때 고른다.
      고를 것이 없으면 **실패로** 찍는다(조용히 건너뛰면 빈 화면을 상대로 초록불 — verify-kosaf 선발공고문 절의 교훈).
   🔴 학적정보 자동 채움은 **지어내지 않는다** — 프로필에 없는 칸(주소 등)은 빈 채로 남아 '남은 칸'에 들어간다.
   실행: 앱을 띄우고(python3 -m http.server <포트>) CHROME_PATH=... PORT=<포트> node verify/verify-formfill.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');
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
  regionCity: '강서구', parentRegionCity: '강서구',
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false,
  common: { studentId: '202412345', phone: '010-1234-5678', birth: '2004-03-01', email: 'kim@example.com', bank: '국민은행', account: '123-45-67890' },
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  await page.addInitScript((p) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [] }));
    localStorage.removeItem('handaejang.resume');
  }, PROFILE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await dismissNotify(page);
  await page.waitForTimeout(1500);

  console.log('■ ① 빈칸을 찾은 PDF 에만 「양식 채우기」 단추');
  /* 대상은 로봇 장부에서 고른다 — 앱이 아는 공고(allScholarships) 가운데 fields.json 에 빈칸이 있는 첫 파일 */
  const target = await page.evaluate(async () => {
    const idx = await (await fetch('data/forms-pdf/index.json', { cache: 'no-store' })).json();
    let noField = null;
    for (const id of Object.keys(idx.items || {})) {
      const s = allScholarships().find((x) => x.id === id);
      if (!s) continue;
      const r = await fetch(`data/forms-pdf/${id}/fields.json`, { cache: 'no-store' });
      if (!r.ok) { noField = noField || { id }; continue; }
      const fj = await r.json();
      const rel = Object.keys(fj.files).find((k) => fj.files[k].fields.length);
      if (!rel) { noField = noField || { id }; continue; }
      const F = fj.files[rel];
      const auto = F.fields.filter((f) => f.key);
      return { id, rel, pages: F.pages.length, n: F.fields.length, keyed: auto.length, keys: auto.map((f) => f.key), labels: F.fields.map((f) => f.label), noField };
    }
    return null;
  });
  eq('검사할 공고가 있다 (빈칸을 찾은 신청서 PDF — 없으면 이 검사는 무의미하다)', !!target, true);
  if (!target) { await browser.close(); process.exit(1); }
  console.log(`   · ${target.id} · ${target.rel} · ${target.pages}쪽 · 빈칸 ${target.n}(학적정보 ${target.keyed})`);
  await page.evaluate((id) => openDetail(id), target.id);
  await page.waitForSelector('#detail-sheet.show', { timeout: 4000 });
  await page.waitForTimeout(400);
  const applyBtn = await page.$('#detail-sheet .btn-primary');
  eq('상세 시트에 「신청 준비 시작」 단추가 있다', /신청 준비/.test(applyBtn ? await applyBtn.textContent() : ''), true);
  await applyBtn.click();
  await page.waitForSelector('.ff-slot', { timeout: 4000 });
  await page.waitForTimeout(1200);   // fields.json 도착
  const slots = await page.$$eval('.ff-slot', (e) => e.map((x) => ({ file: x.dataset.file, hidden: x.hidden, btn: !!x.querySelector('.ff-open') })));
  eq('「원본 양식 그대로 보기」 줄마다 단추 자리가 있다', slots.length > 0, true);
  eq('🔴 빈칸을 찾은 파일에만 단추가 선다 (못 찾은 파일은 자리가 숨는다 — 칸을 지어내지 않는다)',
    slots.every((s) => (s.file.endsWith(target.rel) ? (!s.hidden && s.btn) : true)) && slots.filter((s) => !s.hidden).every((s) => s.btn), true);
  const btnText = await page.$eval(`.ff-slot[data-file$="${target.rel}"] .ff-open`, (b) => b.textContent);
  eq('  단추가 빈칸 수와 학적정보로 채울 수를 말한다', [new RegExp(`빈칸 ${target.n}개`).test(btnText), target.keyed ? new RegExp(`${target.keyed}개 먼저`).test(btnText) : true], [true, true]);

  console.log('\n■ ② 화면 — 쪽 그림 위 칸 · 학적정보로 먼저 채움');
  await page.click(`.ff-slot[data-file$="${target.rel}"] .ff-open`);
  await page.waitForSelector('#screen-formfill:not([hidden])', { timeout: 4000 });
  await page.waitForTimeout(600);
  const scr = await page.evaluate(() => ({
    pages: document.querySelectorAll('#ff-pages .ffp-page').length,
    fields: document.querySelectorAll('#ff-pages .ffp-field').length,
    list: document.querySelectorAll('#ff-list li').length,
    imgs: [...document.querySelectorAll('#ff-pages img')].map((i) => i.getAttribute('src')),
    navHidden: document.querySelector('#bottom-nav').hidden,
    sheetOpen: document.querySelector('#detail-sheet').classList.contains('show'),
    scale: getComputedStyle(document.querySelector('#ff-pages .ffp-page')).getPropertyValue('--ffpt').trim(),
    byLabel: [...document.querySelectorAll('#ff-pages .ffp-field')].map((e) => [e.getAttribute('aria-label'), e.value]),
    left: document.querySelector('#ff-left').textContent,
    title: document.querySelector('#ff-title').textContent,
  }));
  eq('쪽 그림 수가 장부와 같다', scr.pages, target.pages);
  eq('칸 수가 장부와 같다 (그림 위 · 목록 둘 다)', [scr.fields, scr.list], [target.n, target.n]);
  eq('  쪽 그림은 그 공고 폴더의 WebP 다', scr.imgs.every((s) => s.startsWith(`data/forms-pdf/${target.id}/`) && /\.(webp|png)$/.test(s)), true);
  eq('  아래 탭이 숨고 시트는 닫혀 있다', [scr.navHidden, scr.sheetOpen], [true, false]);
  eq('  글자 크기는 쪽 그림 폭을 따라간다 (--ffpt 가 쪽마다 계산돼 있다)', /^\d*\.?\d+px$/.test(scr.scale) && scr.scale !== '1px', true);
  eq('  화면 머리에 공고 이름이 있다', scr.title.length > 0, true);
  const nameVals = scr.byLabel.filter(([l]) => l === '이름').map(([, v]) => v);
  if (target.labels.includes('이름')) eq('🔴 이름 칸은 학적정보 이름으로 먼저 채워진다', nameVals.every((v) => v === PROFILE.name), true);
  const emptyKeyed = await page.evaluate(() => [...document.querySelectorAll('#ff-pages .ffp-field')].filter((e) => !e.value).length);
  const leftN = Number((scr.left.match(/\d+/) || [0])[0]);
  eq('「남은 칸」 알약이 빈 칸 수를 말한다', scr.left.startsWith('남은 칸') ? leftN : (scr.left === '다 채웠어요' ? 0 : -1), emptyKeyed);
  eq('  학적정보에 없는 칸은 비워 둔다 — 지어내지 않는다', scr.byLabel.filter(([l]) => l === '주소').every(([, v]) => v === ''), true);

  console.log('\n■ ③ 목록에서 고치면 그림 위도 바뀐다 · 되돌리기 · 기기 장부');
  const fid = await page.$eval('#ff-list .ff-pin', (e) => e.dataset.fid);
  const before = await page.$eval(`#ff-pages .ffp-field[data-fid="${fid}"]`, (e) => e.value);
  await page.fill('#ff-list .ff-pin', '홍길동');
  await page.waitForTimeout(400);
  const after = await page.evaluate((fid) => ({
    over: document.querySelector(`#ff-pages .ffp-field[data-fid="${fid}"]`).value,
    undo: !document.querySelector(`#ff-list .ff-undo[data-fid="${fid}"]`).hidden,
    saved: (JSON.parse(localStorage.getItem('handaejang.v1')).formFills || {}),
  }), fid);
  eq('목록 칸을 고치면 그림 위 칸이 같은 값이 된다', after.over, '홍길동');
  eq('  자동으로 채운 값과 다르면 「되돌리기」가 뜬다', after.undo, true);
  eq('  기기 장부(state.formFills)에 공고·파일·칸으로 남는다', Object.values(after.saved).some((f) => f[fid] === '홍길동'), true);
  await page.click(`#ff-list .ff-undo[data-fid="${fid}"]`);
  await page.waitForTimeout(300);
  eq('  되돌리면 학적정보 값으로 돌아오고 단추가 숨는다',
    await page.evaluate((fid) => [document.querySelector(`#ff-pages .ffp-field[data-fid="${fid}"]`).value, document.querySelector(`#ff-list .ff-undo[data-fid="${fid}"]`).hidden], fid), [before, true]);
  /* 그림 위에서 고쳐도 목록이 따라온다 */
  await page.fill(`#ff-pages .ffp-field[data-fid="${fid}"]`, '이한장');
  await page.waitForTimeout(300);
  eq('그림 위 칸을 고치면 목록 칸이 같은 값이 된다', await page.$eval(`#ff-list .ff-pin[data-fid="${fid}"]`, (e) => e.value), '이한장');

  console.log('\n■ ④ 폰은 서랍 · 넓은 폭은 사이드바 · 인쇄는 쪽 그림만');
  const drawer = await page.evaluate(() => { const p = document.querySelector('#ff-panel'); const r = p.getBoundingClientRect(); return { pos: getComputedStyle(p).position, open: p.classList.contains('open'), top: Math.round(r.top), vh: window.innerHeight, handle: getComputedStyle(document.querySelector('#ff-handle')).display }; });
  eq('폰(390px)에서 칸 목록은 아래 서랍이다 (접힌 채 · 손잡이만 보인다)', [drawer.pos, drawer.open, drawer.handle !== 'none', drawer.top > drawer.vh * 0.8], ['fixed', false, true, true]);
  await page.click('#ff-handle');
  await page.waitForTimeout(400);
  eq('  손잡이를 누르면 펼쳐진다', await page.evaluate(() => { const p = document.querySelector('#ff-panel'); return [p.classList.contains('open'), Math.round(p.getBoundingClientRect().top) < window.innerHeight * 0.6]; }), [true, true]);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(400);
  const wide = await page.evaluate(() => { const p = document.querySelector('#ff-panel').getBoundingClientRect(); const g = document.querySelector('#ff-pages').getBoundingClientRect(); return { side: p.left > g.left + g.width - 2, pos: getComputedStyle(document.querySelector('#ff-panel')).position, handle: getComputedStyle(document.querySelector('#ff-handle')).display }; });
  eq('넓은 폭(1024px)에서는 오른쪽 사이드바다 (손잡이 없음)', [wide.side, wide.pos, wide.handle], [true, 'sticky', 'none']);
  const css = await page.evaluate(async () => (await (await fetch('style.css', { cache: 'no-store' })).text()));
  const printBlock = (css.match(/@media print \{[\s\S]*?\n\}/) || [''])[0];
  eq('인쇄 CSS 가 쪽 그림만 남기고 쪽마다 넘긴다 (결정 4 · 브라우저 인쇄 → PDF)', [/ff-pages/.test(printBlock), /break-after: page/.test(printBlock), /#bottom-nav/.test(printBlock)], [true, true, true]);
  eq('  「인쇄 · PDF 저장」 단추가 있다', await page.$eval('#btn-ff-print', (b) => b.textContent.trim()), '인쇄 · PDF 저장');
  eq('  화면 어디에도 「신청 완료」라 적지 않는다 (운영 원칙 1)', /신청 완료|제출 완료/.test(await page.$eval('#screen-formfill', (e) => e.innerText)), false);
  await page.click('#btn-ff-back');
  await page.waitForTimeout(400);
  eq('뒤로 가면 양식 화면이 닫히고 아래 탭이 돌아온다', await page.evaluate(() => [document.querySelector('#screen-formfill').hidden, document.querySelector('#bottom-nav').hidden]), [true, false]);

  eq('콘솔 오류 없음', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 양식 채우기 검증 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
