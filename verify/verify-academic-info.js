/* 학적정보 테일러링 (2026-10-24 개발자 지시 1~4) — 진짜 브라우저로 누른다.
   무엇을 재나
     ① 계열 칩이 **그 학교에 있는 계열만, 많은 순으로** 뜨고 나머지는 「+n」 뒤에 접혀 있다(한국외대 — 인문·어문이 첫 칩)
     ② 학과 자동추천이 로봇 파일을 쓴다 — `Global Business & Technology학부` 가 뜬다(손검수 목록이 가리던 학과 · `&amp;` 되돌림)
     ③ 학과를 고르면 계열이 따라온다(GBT학부 → 상경·경영 · 수학과 → 자연과학) · 「+n」을 누르면 여덟 개 전부
     ④ 5단계는 「적합도 높이기」 — 처지 예/아니요 알약(ONBOARD_TRAITS 수만큼 · 명사형 이름표) + 출신 고교 지역 · 관심 대외활동 칸은 온보딩에 없다
     ⑤ 저장하면 누른 처지만 traits 에 남고(안 누른 것은 없다 · 켰다 끈 것도 없다) · 출신 지역이 남는다 · 관심은 null
     ⑥ 쓰다 만 온보딩을 되살릴 때 알약도 그대로다(새로고침)
     ⑦ 학적정보 수정으로 다시 저장해도 관심(대외활동 탭 관문이 적은 것)·처지가 안 지워진다
   🔴 **PORT= 를 반드시 준다** (8123 은 남의 워크트리일 수 있다 — CLAUDE.md 매 세션 2).
   실행: python3 -m http.server <포트> 를 띄운 뒤  CHROME_PATH=... PORT=<포트> node verify/verify-academic-info.js */
const { chromium } = require('playwright-core');
const { nextUntil, assertOwnServer, dismissNotify } = require('./onboard-helper');
const EXE = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = process.env.PORT || 8123;
let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};
const trackChips = (page) => page.$$eval('#in-track .chip', (els) => els.map((e) => e.dataset.value));
const activeTrack = (page) => page.$eval('#in-track', (box) => { const a = box.querySelector('.chip.active'); return a ? a.dataset.value : null; });
const pickMajor = async (page, typed, want) => {
  await page.fill('#in-major', typed);
  await page.waitForTimeout(300);
  const items = await page.$$eval('#in-major ~ .ac-list:not([hidden]) .ac-item', (els) => els.map((e) => e.textContent.trim()));
  const i = items.indexOf(want);
  if (i >= 0) await page.click(`#in-major ~ .ac-list:not([hidden]) .ac-item >> nth=${i}`);
  await page.waitForTimeout(150);
  return items;
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.waitForTimeout(300);

  console.log('\n■ ① 계열 칩 — 학교에 있는 계열만 · 많은 순 · 나머지는 접힘');
  eq('학교를 고르기 전에는 여덟 개 전부', (await trackChips(page)).length, 8);
  await page.fill('#in-school', '한국외국어대학교');
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.waitForTimeout(900);            // 학교별 파일이 도착할 시간
  const present = await page.evaluate(() => tracksOfMajors(majorPool('한국외국어대학교', getChip('#in-campus'))).map((t) => t.id));
  eq('(검사가 헛돌지 않는다 — 파일을 받았고 계열을 갈랐다)', present.length > 0 && present.length < 8, true);
  const chips = await trackChips(page);
  eq('🔴 그 학교에 있는 계열만 보인다 (많은 순 그대로)', chips, present);
  eq('  첫 칩은 그 학교에서 가장 많은 계열 (외대 — 인문·어문)', chips[0], 'humanities');
  eq('  나머지는 「+n」 뒤에', await page.$eval('#in-track .chip-more', (e) => e.textContent.trim()), `+${8 - present.length}`);
  eq('  처음 가입은 아무 계열도 안 켜져 있다 (옛 기본값 인문·어문 없음 — 학과를 고르면 따라온다)', await activeTrack(page), null);

  console.log('\n■ ② 학과 자동추천 — 로봇 파일 · 손검수 목록이 가리지 않는다');
  const gbt = await pickMajor(page, 'Global', 'Global Business & Technology학부');
  eq('🔴 글로벌캠퍼스 GBT학부가 뜬다 (손검수 목록이 가리고 `&amp;` 로 실려 안 뜨던 학과)', gbt.includes('Global Business & Technology학부'), true);
  eq('  `&amp;` 가 글자로 남은 항목이 없다', gbt.filter((m) => m.includes('&amp;')), []);

  console.log('\n■ ③ 학과를 고르면 계열이 따라온다 · 「+n」');
  eq('GBT학부 → 상경·경영', await activeTrack(page), 'business');
  await pickMajor(page, '수학', '수학과');
  eq('수학과 → 자연과학', await activeTrack(page), 'science');
  await page.click('#in-track .chip-more');
  await page.waitForTimeout(100);
  eq('「+n」을 누르면 여덟 개 전부 + 접기', [(await trackChips(page)).length, await page.$eval('#in-track .chip-more', (e) => e.textContent.trim())], [8, '접기']);
  eq('  펼쳐도 고른 계열은 그대로', await activeTrack(page), 'science');
  await page.click('#in-track .chip-more');
  await page.waitForTimeout(100);
  /* 고른 계열(수학과 → 자연과학)은 접혀 있어도 늘 보인다 — 캠퍼스 칩이 기본(서울)인 채 글로벌 학과를 골랐으면
     서울 목록 계열에 없는 자연과학이 하나 더 남는다(2026-10-30 · 캠퍼스별 목록이 실린 뒤 실측). 수를 박지 않고 그 규칙대로 센다. */
  eq('  접으면 학교 계열로 돌아온다 (고른 계열은 남는다)', (await trackChips(page)).length, present.length + (present.includes('science') ? 0 : 1));
  await page.click('#in-year .chip[data-value="3"]');

  console.log('\n■ ④ 5단계 — 적합도 높이기 (처지 예/아니요 + 출신 고교 지역) · 관심 대외활동은 온보딩에 없다');
  eq('온보딩 안에 관심 대외활동 칸이 없다 (대외활동 탭 관문으로 옮김)', await page.$('#screen-onboarding #in-act-kinds'), null);
  eq('처지 알약 단계가 온다', await nextUntil(page, '#in-traits'), true);
  const want = await page.evaluate(() => ONBOARD_TRAITS.map((k) => TRAIT_LABEL[k]));
  eq('🔴 질문은 ONBOARD_TRAITS 그대로 · 이름표는 TRAIT_LABEL(명사형)', await page.$$eval('#in-traits .elig-ask-row > span:first-child', (e) => e.map((x) => x.textContent.trim())), want);
  eq('  처음엔 아무것도 안 눌려 있다', await page.$$eval('#in-traits .elig-yn.on', (e) => e.length), 0);
  await page.click('#in-traits [data-trait="award"][data-val="1"]');
  await page.click('#in-traits [data-trait="military"][data-val="0"]');
  await page.click('#in-traits [data-trait="job"][data-val="1"]');
  await page.click('#in-traits [data-trait="job"][data-val="1"]');   // 켰다 다시 누르면 푼다
  eq('누른 것만 켜진다 · 다시 누르면 풀린다', await page.$$eval('#in-traits .elig-yn.on', (e) => e.map((x) => `${x.dataset.trait}=${x.dataset.val}`)), ['award=1', 'military=0']);
  await page.selectOption('#in-origin-region', '울산');
  await page.waitForTimeout(100);
  const cities = await page.$$eval('#in-origin-city option', (e) => e.map((x) => x.value).filter(Boolean));
  eq('출신 시·도를 고르면 시·군이 채워진다', cities.length > 0, true);
  await page.selectOption('#in-origin-city', cities[0]);

  console.log('\n■ ⑥ 쓰다 만 온보딩 — 새로고침해도 알약이 그대로');
  await page.waitForTimeout(700);   // 진행분 저장(0.5초 디바운스)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  eq('되살린 단계에 알약이 그대로다', await page.$$eval('#in-traits .elig-yn.on', (e) => e.map((x) => `${x.dataset.trait}=${x.dataset.val}`)), ['award=1', 'military=0']);
  eq('  출신 지역도 그대로', await page.evaluate(() => [document.querySelector('#in-origin-region').value, document.querySelector('#in-origin-city').value]), ['울산', cities[0]]);
  eq('  학교·학과·계열도 그대로', await page.evaluate(() => [document.querySelector('#in-school').value, document.querySelector('#in-major').value, getChip('#in-track')]), ['한국외국어대학교', '수학과', 'science']);

  console.log('\n■ ⑤ 저장 — 누른 처지만 · 출신 지역 · 관심은 아직 없음');
  eq('마지막 단계까지 간다', await nextUntil(page, '#btn-finish-onboard'), true);
  await page.click('#btn-finish-onboard');
  await page.waitForTimeout(400);
  await dismissNotify(page);
  /* 처지는 열쇠 순서가 뜻이 아니다 — 정렬해 비교한다 */
  const sortKeys = (o) => Object.fromEntries(Object.entries(o || {}).sort((a, b) => a[0].localeCompare(b[0])));
  const saved = () => page.evaluate(() => { const p = JSON.parse(localStorage.getItem('handaejang.v1')).profile; return { traits: p.traits, originRegion: p.originRegion, originCity: p.originCity, interestKinds: p.interestKinds, track: p.track, major: p.major }; })
    .then((r) => ({ ...r, traits: sortKeys(r.traits) }));
  const onPills = () => page.$$eval('#in-traits .elig-yn.on', (e) => e.map((x) => `${x.dataset.trait}=${x.dataset.val}`).sort());
  eq('🔴 프로필 — 처지는 누른 둘만(켰다 끈 job 은 없다) · 출신 지역 · 관심 null · 계열은 학과를 따라온 것', await saved(),
    { traits: { award: true, military: false }, originRegion: '울산', originCity: cities[0], interestKinds: null, track: 'science', major: '수학과' });

  console.log('\n■ ⑦ 학적정보 수정 — 관심·처지가 안 지워진다');
  await page.evaluate(() => { state.profile.interestKinds = ['공모전']; state.profile.traits.dorm = true; saveState(); showScreen('myinfo'); });
  await page.waitForTimeout(300);
  await page.click('.my-edit-hint');   // MY 의 「학적정보 수정 ›」 — 학생이 누르는 그 단추
  await page.waitForTimeout(500);
  eq('고치러 들어오면 알약이 답한 대로 켜져 있다', await onPills(), ['award=1', 'dorm=1', 'military=0']);
  eq('  그 학교 계열 칩으로 그려진다 (고른 계열 켜진 채)', [await activeTrack(page), (await trackChips(page)).length <= present.length + 1], ['science', true]);
  eq('마지막 단계까지 간다', await nextUntil(page, '#btn-finish-onboard'), true);
  await page.click('#btn-finish-onboard');
  await page.waitForTimeout(400);
  eq('🔴 저장해도 관심(관문이 적은 것)·처지가 그대로다', await saved(),
    { traits: { award: true, dorm: true, military: false }, originRegion: '울산', originCity: cities[0], interestKinds: ['공모전'], track: 'science', major: '수학과' });

  console.log('\nERRORS:', errors.length ? errors : 'none');
  if (errors.length) fail++;
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 학적정보 테일러링 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
