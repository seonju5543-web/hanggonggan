/* ============================================================
   AI 초안 UI 검증 — 진짜 앱을 눌러서 확인한다

   실행:
     python3 -m http.server 8123 &
     CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node verify/verify-essay-ui.js

   가짜 서버로 돌린다(window.fetch 를 가로챈다) — **돈이 들지 않는다.**
   verify-chat.js 가 도우미 AI를 가짜 서버로 검증한 것과 같은 방식이다.

   무엇을 눈으로 확인하는가
     ① endpoint 가 비어 있으면 버튼이 아예 없다 (지금 배포 상태)
     ② 켜면 버튼이 나오고, 누르면 **무엇이 나가는지 한 줄씩** 보인다
     ③ 실제로 나간 요청 본문에 이름·학번·연락처·계좌·성적·소득분위가 없다
     ④ 초안이 칸에 들어가고 '초안입니다' 표시가 붙는다
     ⑤ 서버가 실패하면 학생이 쓴 글이 그대로 남는다
   ============================================================ */
const { chromium } = require('playwright-core');
const SHOT = (n) => `${__dirname}/shot-essay-${n}.png`;

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '\n      ' + extra : ''}`); }
};

async function dismissNotify(page) {
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto('http://localhost:8123/', { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');
  await page.fill('#in-school', '한국외국어대학교');
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item').catch(() => {});
  await page.click('#in-track .chip[data-value="humanities"]').catch(() => {});
  await page.fill('#in-major', '스페인어과');
  await page.fill('#in-name', '이선주');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="enrolled"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.1');
  await page.selectOption('#in-bracket', '4');
  await page.click('#in-region .chip[data-value="seoul"]');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  await page.click('.onboard-step[data-step="3"] [data-next]');
  await page.fill('#in-sid', '202312345');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@hufs.ac.kr');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await dismissNotify(page);

  /* 서술형 story 칸이 있는, 아직 마감 안 된 양식 공고를 앱에서 스스로 고른다.
     공고 id 를 박아 두면 그 공고가 마감되는 순간 검사가 깨진다(README 규칙). */
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  const target = await page.evaluate(() => {
    /* 🔴 화면에 실제로 뜬 카드 중에서 고른다. registeredList 전체에서 고르면
       '이 학생에게 안 보이는 학교한정 공고'를 집어 검사가 열리지도 않는다
       (첫 시도에 중앙대 공고를 집어 그렇게 됐다). */
    for (const el of document.querySelectorAll('#explore-list [data-detail]')) {
      const id = el.dataset.detail;
      const s = (typeof registeredList !== 'undefined' ? registeredList : []).find((x) => x.id === id);
      if (!s || !s.formId || !FORM_TEMPLATES[s.formId]) continue;
      const tpl = FORM_TEMPLATES[s.formId];
      const story = (tpl.sections || []).flatMap((x) => x.fields || [])
        .filter((f) => f.type === 'textarea' && f.kind === 'story');
      if (story.length) return { id: s.id, name: s.name, formId: s.formId, story: story.length };
    }
    return null;
  });
  console.log(`\n대상 공고: ${target ? `${target.name} (${target.formId} · story ${target.story}칸)` : '없음'}`);
  if (!target) { console.log('마감 전 + story 칸이 있는 양식 공고가 없습니다 — 건너뜁니다.'); await browser.close(); process.exit(0); }

  const openForm = async () => {
    await page.click('.nav-item[data-nav="explore"]');
    await page.waitForTimeout(500);
    await page.evaluate((id) => { const c = document.querySelector(`#explore-list [data-detail="${id}"]`); if (c) c.scrollIntoView(); }, target.id);
    const card = await page.$(`#explore-list [data-detail="${target.id}"]`);
    if (!card) return false;
    await card.click();
    await page.waitForSelector('#detail-sheet.show');
    await page.waitForTimeout(300);
    if (await page.$eval('#btn-apply-one', (el) => el.disabled)) return false;
    await page.click('#btn-apply-one');
    await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
    return true;
  };

  console.log('\n[1) 꺼져 있을 때 — 지금 배포 상태]');
  ok(await openForm(), '양식 작성 화면이 열린다');
  ok(await page.$('#btn-essay-ai') === null,
    '① endpoint 가 비어 있으면 AI 초안 버튼이 없다 — 기능이 완전히 꺼져 있다');
  await page.screenshot({ path: SHOT('1-off') });

  console.log('\n[2) 켰을 때 — 가짜 서버로]');
  /* 서버를 켠 셈 치고, fetch 를 가로채 무엇이 나갔는지 그대로 받아 적는다 */
  await page.evaluate(() => {
    ESSAY_CONFIG.endpoint = 'https://fake.workers.dev';
    window.__sent = [];
    window.__reply = { drafts: [], skipped: [] };
    const real = window.fetch;
    window.fetch = async (url, init) => {
      if (String(url).includes('fake.workers.dev')) {
        window.__sent.push(JSON.parse(init.body));
        return new Response(JSON.stringify(window.__reply), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return real(url, init);
    };
  });
  await page.click('#btn-ff-back').catch(() => {});
  await page.evaluate(() => { if (typeof formInvalidatePlan === 'function') formInvalidatePlan(); });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok(await openForm(), '양식 화면을 다시 연다');
  ok(await page.$('#btn-essay-ai') !== null, '② 켜면 AI 초안 버튼이 나온다');

  /* 학생이 몇 칸 적어 둔 상태를 만든다 — 이것이 '재료'다 */
  const firstStory = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.sheet-body textarea')].find((t) => t.id.startsWith('fq-'));
    return el ? el.id : null;
  });
  await page.fill(`#${firstStory}`, '등록금이 부담돼서');
  await page.click('#btn-essay-ai');
  await page.waitForSelector('#essay-confirm', { timeout: 4000 });
  await page.screenshot({ path: SHOT('2-confirm') });

  const confirmText = await page.$eval('#essay-confirm', (el) => el.textContent);
  ok(/보낼게요/.test(confirmText), '② 무엇을 보내는지 화면에 밝힌다');
  ok(/Cloudflare/.test(confirmText) && /Anthropic/.test(confirmText) && /해외/.test(confirmText),
    '② 어디로 나가는지(우리 서버 → Anthropic · 해외)를 그대로 적는다');
  ok(/주민등록번호/.test(confirmText) && /보내지 않아요/.test(confirmText),
    '② 무엇을 안 보내는지도 적는다');
  ok((await page.$$('#essay-confirm .essay-send')).length >= 2, '② 줄마다 끌 수 있다');

  console.log('\n[3) 실제로 나간 요청 본문]');
  await page.evaluate(() => {
    window.__reply = { drafts: [], skipped: [] };
  });
  await page.click('#btn-essay-send');
  await page.waitForTimeout(800);
  const sent = await page.evaluate(() => window.__sent);
  ok(sent.length === 1, `요청이 한 번 나갔다 (${sent.length}회)`);
  const body = JSON.stringify(sent[0] || {});
  const leaks = ['이선주', '202312345', '010-1234-5678', 'test@hufs.ac.kr', '4.1', '4구간', 'gpa', 'bracket']
    .filter((w) => body.includes(w));
  ok(leaks.length === 0, '③ 이름·학번·연락처·이메일·성적·소득분위가 나가지 않았다', leaks.join(', '));
  ok(!/fallbacks/.test(body), '③ fallbacks 를 붙이지 않는다');
  ok((sent[0].fields || []).every((f) => f.kind === 'story'),
    '③ story 칸만 보낸다 — 사실 나열형은 요청에 없다');
  console.log('    보낸 것:', JSON.stringify({
    profile: sent[0].profile,
    materials: (sent[0].materials || []).map((m) => m.label || '(무제)'),
    fields: (sent[0].fields || []).map((f) => f.label),
  }));

  console.log('\n[4) 초안이 칸에 들어가는가]');
  const key = sent[0].fields[0].key;
  await page.evaluate((k) => {
    window.__reply = { drafts: [{ key: k, text: '가계 사정으로 등록금 마련이 어려워 학업에 전념하기 힘든 상황입니다.' }], skipped: [] };
  }, key);
  await page.click('#btn-essay-ai');
  await page.waitForSelector('#btn-essay-send', { timeout: 4000 });
  await page.click('#btn-essay-send');
  await page.waitForTimeout(800);
  const filled = await page.$eval(`#fq-${key}`, (el) => el.value);
  ok(filled.includes('가계 사정'), '④ 초안이 칸에 들어간다');
  ok(await page.$('.essay-flag') !== null, '④ 그 칸에 초안 표시가 붙는다');
  const flag = await page.$eval('.essay-flag', (el) => el.textContent);
  ok(/초안/.test(flag) && /고쳐/.test(flag), '④ "초안 — 읽고 고치세요"라고 말한다', flag);
  await page.screenshot({ path: SHOT('3-drafted') });

  console.log('\n[5) 실패해도 학생 글을 덮지 않는가]');
  await page.fill(`#fq-${key}`, '제가 직접 쓴 문장입니다');
  await page.evaluate(() => {
    window.fetch = async () => { throw new Error('서버 죽음'); };
  });
  await page.click('#btn-essay-ai');
  await page.waitForSelector('#btn-essay-send', { timeout: 4000 });
  await page.click('#btn-essay-send');
  await page.waitForTimeout(800);
  ok(await page.$eval(`#fq-${key}`, (el) => el.value) === '제가 직접 쓴 문장입니다',
    '⑤ 서버가 죽어도 학생이 쓴 글이 그대로 남는다');
  ok(await page.$('#essay-confirm') === null, '⑤ 실패해도 화면이 원래대로 돌아온다');

  console.log('\n[6) 문서는 그대로인가]');
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  ok(doc.includes('제가 직접 쓴 문장입니다'), '학생이 쓴 글이 문서에 그대로 나간다');
  ok(!doc.includes('AI 초안') && !doc.includes('✨'), '초안 표시가 문서에는 섞이지 않는다');
  await page.screenshot({ path: SHOT('4-doc') });

  console.log(`\nERRORS: ${errors.length ? errors.join(' ; ') : 'none'}`);
  console.log(`${fail || errors.length ? '✗' : '✓'} AI 초안 UI — 통과 ${pass} · 실패 ${fail}`);
  await browser.close();
  process.exit(fail || errors.length ? 1 : 0);
})();
