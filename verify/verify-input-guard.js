/* 입력 안전장치 — 진짜 앱을 눌러서 확인한다 (2026-11-17 · 업무 요청서 HDJ-요청-2026-001 후속)

   요청: "성적 999 같은 값은 입력조차 안 되게." 규칙은 input-guard.js, 배선은 app.js bindInputGuards.
   🔴 **키보드로 한 글자씩 친다**(page.type). page.fill 은 값을 통째로 넣어 '붙여넣기'에 가깝다 —
      둘 다 본다. 입력칸의 min/max 만으로는 브라우저가 타이핑을 막지 않으므로, 이 검사가
      "막는다"를 증명하는 유일한 자리다.

   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         PORT=<포트> node verify/verify-input-guard.js   (Mac 이면 CHROME_PATH 도 — verify/README.md) */
let pw;
try { pw = require('playwright-core'); } catch (e) { pw = require('playwright'); }
const { chromium } = pw;
const { nextUntil, assertOwnServer } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✕ ${label}\n      받은 값: ${JSON.stringify(got)}\n      기대 값: ${JSON.stringify(want)}`); }
  else console.log(`  ✓ ${label}`);
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  const typeInto = async (sel, text) => { await page.fill(sel, ''); await page.focus(sel); await page.keyboard.type(text, { delay: 15 }); return page.inputValue(sel); };
  const toastText = () => page.textContent('#toast');
  const visibleStep = () => page.$eval('.onboard-step:not([hidden])', (el) => el.dataset.step);

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '한국외국어'); await page.waitForTimeout(250);
  await page.click('.ac-list:not([hidden]) .ac-item');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.waitForSelector('#in-gpa', { state: 'visible' });

  console.log('■ ① 칠 때 막는다');
  eq('평점 999 를 치면 한 글자도 안 들어간다', await typeInto('#in-gpa', '999'), '');
  eq('  막을 때 이유를 알린다', /평점은\(는\) 0~4\.5 사이만/.test(await toastText()), true);
  eq('  4.6 을 치면 4. 까지만', await typeInto('#in-gpa', '4.6'), '4.');
  eq('  3.855 를 치면 3.85 까지만', await typeInto('#in-gpa', '3.855'), '3.85');
  eq('  글자 e 는 안 들어간다', await typeInto('#in-gpa', '3e'), '3');
  await typeInto('#in-gpa', '3.85');
  /* 붙여넣기 — 통째로 들어온 값은 직전 값으로 되돌린다 */
  await page.fill('#in-gpa', '999');
  eq('붙여넣은 999 는 직전 값(3.85)으로 되돌아간다', await page.inputValue('#in-gpa'), '3.85');
  eq('이수학점 999 → 9 (30 상한)', await typeInto('#in-credits', '999'), '9');
  await typeInto('#in-credits', '15');
  eq('정상 학점 15 는 그대로', await page.inputValue('#in-credits'), '15');

  console.log('■ ② 넘어갈 때 막는다 — 다 못 친 값');
  /* 출생연도 칸은 같은 단계(성적·소득) 아래쪽에 있다 */
  eq('출생연도 3000 은 첫 3 부터 안 들어간다', await typeInto('#in-birth-year', '3000'), '');
  await typeInto('#in-birth-year', '19');
  const stepBefore = await visibleStep();
  await page.click('.onboard-step:not([hidden]) [data-next]');
  await page.waitForTimeout(200);
  eq('출생연도를 19 까지만 치고 다음을 누르면 넘어가지 않는다', await visibleStep(), stepBefore);
  eq('  이유를 알린다', /태어난 해/.test(await toastText()), true);
  await typeInto('#in-birth-year', '2004');
  await page.click('.onboard-step:not([hidden]) [data-next]');
  await page.waitForTimeout(200);
  eq('2004 로 고치면 넘어간다', (await visibleStep()) !== stepBefore, true);

  console.log('■ 서류 정보 칸 — 글자 종류 · 있을 수 없는 날짜');
  await nextUntil(page, '#in-phone');
  eq('휴대폰 칸에 글자는 안 들어간다', await typeInto('#in-phone', '010abc1234'), '0101234');
  /* 계좌 칸은 처음 가입할 때는 감춰져 있다(프로필을 고치러 왔을 때만 보인다) — 펼쳐서 진짜 칸에 친다 */
  await page.$eval('#in-account-field', (el) => { el.hidden = false; });
  eq('계좌 칸에 한글·기호는 안 들어간다', await typeInto('#in-account', '123-45@가6'), '123-456');
  eq('학번 칸에 한글은 안 들어간다', await typeInto('#in-sid', '2025학번12'), '202512');
  /* 안전장치 전에 저장된 형식 밖 값('2005년 3월') — 덧붙이기는 막고 지우기는 받는다(한 글자에 칸이 통째로 비면 안 된다) */
  await page.$eval('#in-birth', (el) => { el.value = '2005년 3월'; });
  await page.focus('#in-birth');
  await page.keyboard.press('End');
  await page.keyboard.type('1');
  eq('형식 밖 옛 값에 덧붙이기는 막는다 (칸을 비우지 않는다)', await page.inputValue('#in-birth'), '2005년 3월');
  await page.keyboard.press('Backspace');
  eq('  지우기는 받는다', await page.inputValue('#in-birth'), '2005년 3');
  await typeInto('#in-birth', '2005.13.01');
  await page.click('#btn-finish-onboard');
  await page.waitForTimeout(200);
  eq('생년월일 13월이면 저장하지 않는다', await page.evaluate(() => !!(JSON.parse(localStorage.getItem('handaejang.v1') || '{}').profile)), false);
  eq('  이유를 알린다', /있을 수 없는 생년월일/.test(await toastText()), true);
  await typeInto('#in-birth', '2005.03.14');
  await page.click('#btn-finish-onboard');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => (JSON.parse(localStorage.getItem('handaejang.v1') || '{}').profile) || {});
  eq('고치면 저장된다 — 친 값 그대로 (평점 3.85 · 학점 15 · 2004년)', [saved.gpa, saved.credits, saved.birthYear], [3.85, 15, 2004]);

  console.log('■ 나중에 그려지는 칸에도 걸린다 (공고 「미확인 자격」·대외활동 관문과 같은 길)');
  await page.evaluate(() => {
    const i = document.createElement('input');
    i.id = 'late-gpa'; i.type = 'text'; i.dataset.guard = 'gpa';
    document.body.appendChild(i);
  });
  eq('나중에 붙인 data-guard 칸도 999 를 안 받는다', await typeInto('#late-gpa', '999'), '');

  console.log('■ ③ 예전에 저장된 값 — 그 칸만 비운다');
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('handaejang.v1'));
    st.profile.gpa = 999; st.profile.birthYear = 3000;
    localStorage.setItem('handaejang.v1', JSON.stringify(st));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const after = await page.evaluate(() => (JSON.parse(localStorage.getItem('handaejang.v1') || '{}').profile) || {});
  eq('🔴 999 는 4.5 가 아니라 비운다 · 3000 도 비운다 · 정상 학점은 그대로', [after.gpa, after.birthYear, after.credits], [null, null, 15]);
  eq('  학생에게 한 번 알린다', /평점·태어난 해 값이 범위를 벗어나 비웠어요/.test(await toastText()), true);

  eq('페이지 오류 없음', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 입력 안전장치 전부 통과');
  process.exit(fail ? 1 : 0);
})();
