/* 자격 확인 도우미 — 눌러서 실제로 되는가 (2026-09-17 · 노션 AI-1)
   짝은 elig-ask.js · app.js(reqRow·openEligAsk) · style.css 끝 묶음

   🔴 글자만 보는 검사(test-collector 「자격 묻기」 절)는 **무엇을 물을 수 있나**까지만 안다.
      값이 저장되고 줄 색이 바뀌는지는 브라우저로만 잴 수 있다.

   이 검사가 정말로 막는 것 넷:
     · 적어도 안 풀리는 줄에 **단추가 붙는 것** — 학생이 적었는데 화면이 그대로다
     · 미확인 줄을 **여기 다시 나열하는 것** — 위 자격 블록이 이미 보여 준다(두 번 그려 화면이 배로 길어졌다)
     · 저장해도 **위 자격 블록이 안 바뀌는 것** — 눈금은 거기 있다
     · 적은 값이 **그 공고에만 남는 것** — 프로필에 저장돼 다른 공고에도 쓰여야 한다
     · 공고 팝업을 **갈아치우는 것** — 적는 동안에도 보던 공고가 그대로 있어야 한다

   🔴 공고 id 를 박지 않는다 — 마감되면 목록에서 내려가 그때부터 검사가 죽는다.
      `askableForSch` 가 비지 않은 공고를 그때그때 고르고, 하나도 없으면 건너뛴다고 알린다.
   🔴 판정을 베끼지 않는다 — 앱의 `requirementMatch`·`askableForSch` 를 그대로 불러 쓴다.
   🔴 PORT 를 반드시 준다 — 8123 은 다른 워크트리 서버일 수 있다. */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');

const PORT = process.env.PORT || 8123;
const EXE = process.env.CHROME_PATH;

/* 온보딩 **선택 칸을 비워 둔** 학생 — 이 기능이 있는 이유가 이 상태다 */
const PROFILE = {
  school: '한국외국어대학교', campus: '서울', track: 'humanities', major: '경영학과',
  year: 3, status: '재학',
  gpa: null, credits: null, bracket: null, birthYear: null,
  nationality: null, region: null, regionCity: null,
  flags: [], scholarships: [],
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
  await dismissNotify(page);
}

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle' });
  await seed(page);

  console.log('\n■ 자격 확인 도우미');

  /* ── 대상 고르기 — 물을 칸이 둘 이상인 공고를 쓴다(칸 하나짜리는 저장 뒤
     단추가 사라지는 것만 보게 돼 '남은 칸' 경로를 못 잰다) ── */
  const target = await page.evaluate(() => {
    const hit = allScholarships()
      .map((s) => ({ id: s.id, ask: askableForSch(s, state.profile) }))
      .filter((x) => x.ask.length >= 1);
    return hit.length ? hit[0] : null;
  });
  if (!target) {
    console.log('  ⓘ 물을 칸이 있는 공고가 하나도 없어 건너뜁니다 (마감으로 목록이 비었을 수 있습니다)');
    await browser.close();
    process.exit(0);
  }

  await page.evaluate((id) => openDetail(id), target.id);
  await page.waitForSelector('#detail-sheet:not([hidden])');

  /* ① 입구는 **자격 블록 아래 한 줄** 하나다 (2026-09-18 개발자 지시).
     🔴 줄마다 단추를 달지 않는다 — 아래 한 줄이 같은 일을 해서 중복이었다. */
  const entry = await page.evaluate(() => ({
    one: document.querySelectorAll('#detail-sheet [data-elig-open]').length,
    perLine: document.querySelectorAll('#detail-sheet .r-elig [data-elig-ask]').length,
    label: (document.querySelector('[data-elig-open]') || {}).textContent || '',
  }));
  ok('입구는 자격 블록 아래 한 줄이다', entry.one === 1, `${entry.one}개`);
  ok('  줄마다 단추를 달지 않는다 (중복)', entry.perLine === 0, `${entry.perLine}개`);
  ok('  미확인 자격 수를 말한다', /미확인 자격/.test(entry.label), entry.label.trim());

  /* ② 누르면 공고 팝업 **안에서** 펼쳐진다 (팝업을 갈아치우지 않는다) */
  const titleBefore = await page.evaluate(() =>
    (document.querySelector('#detail-sheet .sheet-title') || {}).textContent || '');
  await page.click('#detail-sheet [data-elig-open]');
  await page.waitForSelector('#detail-sheet .elig-ask-on');
  const stillThere = await page.evaluate(() =>
    (document.querySelector('#detail-sheet .sheet-title') || {}).textContent || '');
  ok('펼쳐도 보던 공고가 그대로 있다 (팝업을 갈아치우지 않는다)',
    !!titleBefore && stillThere === titleBefore, `${titleBefore} → ${stillThere}`);
  const opened = await page.evaluate(() => ({
    head: (document.querySelector('.elig-ask-head') || {}).textContent || '',
    lines: document.querySelectorAll('.elig-ask-lines li').length,
    inputs: document.querySelectorAll('[data-elig-field]').length,
    save: !!document.querySelector('[data-elig-save]'),
  }));
  ok('  펼친 머리줄도 같은 것을 말한다', /미확인 자격/.test(opened.head), opened.head.trim());
  ok('  미확인 줄을 여기 다시 나열하지 않는다 (위 자격 블록이 이미 보여 준다)',
    opened.lines === 0, `${opened.lines}줄`);
  ok('  물을 칸이 그려져 있다', opened.inputs > 0, `${opened.inputs}칸`);
  ok('  저장 단추가 있다', opened.save);
  /* 🔴 닫는 길이 둘이다 (2026-09-18 개발자 지시) — 머리줄 화살표와 「나중에 하기」 */
  const ways = await page.evaluate(() => ({
    later: !!document.querySelector('.elig-ask-later'),
    chev: document.querySelectorAll('.elig-ask .elig-chev').length,
  }));
  ok('  「나중에 하기」 로도 접을 수 있다', ways.later);
  ok('  화살표 아이콘이 있다 (글자 아님)', ways.chev === 1, `${ways.chev}개`);

  /* 「나중에 하기」 를 눌러도 접힌다 — 그리고 다시 펼 수 있어야 한다 */
  await page.click('.elig-ask-later');
  await page.waitForTimeout(400);
  const byLater = await page.evaluate(() => ({
    on: !!document.querySelector('.elig-ask-on'),
    one: !!document.querySelector('[data-elig-open]'),
  }));
  ok('  「나중에 하기」 를 누르면 접힌다', !byLater.on && byLater.one);
  await page.click('#detail-sheet [data-elig-open]');
  await page.waitForSelector('#detail-sheet .elig-ask-on');

  /* 🔴 앱이 하는 말을 늘리지 않는다 — 시트에 설명·약속 문장이 없어야 한다 */
  const sheetText = await page.evaluate(() => document.querySelector('.elig-ask').innerText);
  ok('  장담하는 문장이 없다 (받을 수 있는지 / 알 수 있어요)',
    !/받을 수 있는지|알 수 있어요|정확해져/.test(sheetText));
  ok('  다른 공고에 적용된다는 안내를 넣지 않았다 (2026-09-17 개발자 결정)',
    !/다른 공고/.test(sheetText));

  /* 눈금은 **위 자격 블록**이다 — 저장하면 거기 줄이 ✓·✕ 로 바뀌어야 한다 */
  const eligRows = () => page.evaluate(() => [...document.querySelectorAll('#detail-sheet .r-elig')]
    .map((li) => ({ t: li.textContent.trim(), cls: li.className })));
  const before = { rows: await eligRows(),
    n: await page.evaluate(() => (document.querySelector('.elig-ask-head b') || {}).textContent) };
  ok('  숫자와 판정 없는 줄 수가 같다',
    String(before.rows.filter((r) => /r-req/.test(r.cls)).length) === String(before.n),
    `숫자 ${before.n} · 판정 없는 줄 ${before.rows.filter((r) => /r-req/.test(r.cls)).length}`);

  /* ④ 적고 저장하면 그 줄이 **자리를 지키며 색만** 바뀐다 */
  const filled = await page.evaluate(() => {
    const VAL = { gpa: '4.0', credits: '18', bracket: '3', birthYear: '2003',
      nationality: '대한민국', major: '경영학과', regionCity: '동대문구' };
    const els = [...document.querySelectorAll('[data-elig-field]')];
    els.forEach((el) => { el.value = VAL[el.dataset.eligField] || '1'; });
    return els.map((el) => el.dataset.eligField);
  });
  await page.click('[data-elig-save]');
  await page.waitForTimeout(400);

  const after = { rows: await eligRows(),
    n: await page.evaluate(() => (document.querySelector('.elig-ask-head b') || {}).textContent),
    saveBtn: await page.evaluate(() => !!document.querySelector('[data-elig-save]')),
    later: await page.evaluate(() => !!document.querySelector('.elig-ask-later')),
    inputs: await page.evaluate(() => document.querySelectorAll('[data-elig-field]').length) };
  ok('저장하면 위 자격 블록의 그 줄이 판정된다 (눈금은 거기 있다)',
    after.rows.filter((r) => /r-ok|r-bad/.test(r.cls)).length
      > before.rows.filter((r) => /r-ok|r-bad/.test(r.cls)).length,
    `판정된 줄 ${before.rows.filter((r) => /r-ok|r-bad/.test(r.cls)).length} → ${after.rows.filter((r) => /r-ok|r-bad/.test(r.cls)).length}`);
  ok('  줄의 차례가 그대로다',
    after.rows.map((r) => r.t.replace(/^[✓✕]\s*/, '')).join('|')
      === before.rows.map((r) => r.t.replace(/^[✓✕]\s*/, '')).join('|'));
  ok('  미확인 숫자가 줄었다', Number(after.n) < Number(before.n), `${before.n} → ${after.n}`);
  ok('  물을 칸이 없으면 아래 줄을 통째로 없앤다 (「나중에 하기」만 남으면 안 된다)',
    after.inputs > 0 ? (after.saveBtn && after.later) : (!after.saveBtn && !after.later),
    `남은 칸 ${after.inputs} · 저장 ${after.saveBtn} · 나중에 ${after.later}`);

  /* ⑤ 적은 값은 **프로필에** 남는다 — 그래서 다른 공고에도 쓰인다 */
  const saved = await page.evaluate((keys) => {
    const p = JSON.parse(localStorage.getItem('handaejang.v1')).profile;
    return keys.map((k) => [k, p[k]]);
  }, filled);
  ok('적은 값이 프로필에 저장된다', saved.every(([, v]) => v !== null && v !== undefined && v !== ''),
    saved.map(([k, v]) => `${k}=${v}`).join(' '));
  ok('  숫자 칸은 숫자로 저장된다 (글자로 넣으면 판정이 안 된다)',
    saved.filter(([k]) => ['gpa', 'credits', 'bracket', 'birthYear'].includes(k))
      .every(([, v]) => typeof v === 'number'),
    saved.map(([k, v]) => `${k}:${typeof v}`).join(' '));

  /* ⑥ 다시 열면 그 칸은 안 묻는다 — 같은 값을 두 번 묻지 않는다 */
  const again = await page.evaluate((id) => {
    const sch = allScholarships().find((s) => s.id === id);
    return askableForSch(sch, state.profile);
  }, target.id);
  ok('이미 적은 칸은 다시 묻지 않는다', again.every((k) => !filled.includes(k)),
    `다시 묻는 칸: ${JSON.stringify(again)}`);

  /* ⑦ 접으면 공고는 그대로 있고 한 줄로 돌아간다 */
  await page.click('[data-elig-close]');
  await page.waitForTimeout(400);
  const closed = await page.evaluate(() => ({
    on: !!document.querySelector('.elig-ask-on'),
    one: !!document.querySelector('[data-elig-open]'),
    title: (document.querySelector('#detail-sheet .sheet-title') || {}).textContent || '',
  }));
  /* 🔴 물을 것이 남았으면 한 줄로, 다 적었으면 **자리를 없앤다** — 눌러도 빈 칸만
     나오는 단추를 남기지 않는다. 위에서 칸을 다 채웠으므로 여기서는 사라지는 쪽이다. */
  ok('접으면 펼침이 닫힌다', !closed.on);
  ok('  다 적었으면 단추 자리도 없앤다 (눌러도 빈 칸뿐인 단추를 남기지 않는다)',
    after.inputs > 0 ? closed.one : !closed.one,
    `남은 칸 ${after.inputs} · 단추 ${closed.one}`);
  ok('  그래도 공고는 그대로다', closed.title === titleBefore, closed.title);

  console.log(`\n${fails.length ? `✕ 실패 ${fails.length}건` : `✓ 전부 통과 (${pass}항목)`}`);
  fails.forEach((f) => console.log(`   - ${f}`));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('드라이버가 넘어졌습니다:', e.message); process.exit(1); });
