/* ============================================================
   AI 초안 UI 검증 — 진짜 앱을 눌러서 확인한다

   실행:
     python3 -m http.server 8123 &
     CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node verify/verify-essay-ui.js

   가짜 서버로 돌린다(window.fetch 를 가로챈다) — **돈이 들지 않는다.**
   verify-chat.js 가 도우미 AI를 가짜 서버로 검증한 것과 같은 방식이다.

   무엇을 눈으로 확인하는가
     ① endpoint 가 비어 있으면 버튼이 아예 없다 (지금 배포 상태)
     ② 🔴 서술형 칸에 **빈 A4 2장을 던지지 않는다** — 키워드 질문이 그 자리에 있다
     ③ 실제로 나간 요청 본문에 이름·학번·연락처·계좌·성적·소득분위가 없다
        + 학생이 고른 키워드와 목표 분량이 실려 간다
     ④ 글이 칸에 들어가고 '초안입니다' 표시가 붙는다
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
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.1');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 🔴 단계 번호를 박지 않는다 (2026-08-24) — 공동개발자가 4단계(이중수혜)를 새로 끼우자
     서류 정보가 4→5단계로 밀려 이 드라이버가 '#in-sid 가 안 보인다'로 죽었다.
     앞으로 단계가 더 늘어도 깨지지 않게 **서류 칸이 보일 때까지 '다음'을 누른다**
     (검증 드라이버에 공고 id 를 박지 말라는 이 저장소의 규칙과 같은 계열). */
  for (let i = 0; i < 4; i++) {
    if (await page.isVisible('#in-sid').catch(() => false)) break;
    const next = await page.$('.onboard-step:not([hidden]) [data-next]');
    if (!next) break;
    await next.click().catch(() => {});
    await page.waitForTimeout(250);
  }
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
  {
    /* endpoint 가 비면 **네트워크로 나가는 것이 없다.** 버튼은 남되 앱이 옮겨만 준다 —
       키워드를 골라 놓고 아무 일도 안 일어나면 그 카드는 학생을 놀린 셈이 되기 때문이다. */
    const b = await page.$('#btn-essay-ai');
    ok(b !== null, '① 꺼져 있어도 버튼은 있다 (앱이 키워드를 옮겨 준다)');
    const t = b ? await b.textContent() : '';
    ok(/옮기기/.test(t), '① 꺼져 있을 때는 "옮기기"라고만 말한다 — 못 하는 일을 한다고 하지 않는다', t);
    const lead = await page.$eval('.essay-ask-lead', (el) => el.textContent).catch(() => '');
    ok(!/앱이 씁니다/.test(lead), '① 꺼져 있을 때 "앱이 씁니다"라고 하지 않는다', lead);
    /* 실제로 눌러서 네트워크가 안 나가는지 본다 */
    await page.evaluate(() => { window.__off = 0; const r = window.fetch; window.fetch = (...a) => { window.__off++; return r(...a); }; });
    await page.evaluate(() => { const c = document.querySelector('.essay-ask .essay-chips .chip'); if (c) c.click(); });
    await page.click('#btn-essay-ai');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => window.__off) === 0, '① 꺼져 있을 때 바깥으로 나가는 요청이 0건이다');
    const moved = await page.evaluate(() => {
      const t2 = [...document.querySelectorAll('.sheet-body textarea')].find((x) => x.id.startsWith('fq-'));
      return t2 ? t2.value : '';
    });
    ok(moved.includes('·'), '① 고른 키워드가 칸에 옮겨진다', moved.slice(0, 50));
  }
  await page.screenshot({ path: SHOT('1-off') });

  console.log('\n[2) 서술형 칸에 키워드 질문이 있는가]');
  /* 🔴 개발자 지적(2026-08-23): "장학 신청 사유를 자기소개서로 (A4 2장 내외)"라고 적힌
     빈 칸을 학생에게 던지면 안 된다. 그 자리에 키워드 질문이 있어야 한다. */
  const askBox = await page.$('.essay-ask');
  ok(askBox !== null, '② 서술형 칸 안에 키워드 질문 카드가 있다 (AI가 꺼져 있어도)');
  if (askBox) {
    const askText = await askBox.textContent();
    ok(/키워드만 골라/.test(askText), '② "키워드만 골라 주세요"가 그 자리에 있다');
    ok(/목표 약 \d+자/.test(askText), '② 목표 분량을 원본에서 읽어 보여 준다', askText.slice(0, 60));
    const chips = await page.$$('.essay-ask .essay-chips .chip');
    const frees = await page.$$('.essay-ask .essay-ask-free');
    ok(chips.length >= 4, `② 눌러서 고르는 보기가 있다 (${chips.length}개)`);
    console.log(`      키워드 질문: 고르기 ${chips.length}개 · 직접입력 ${frees.length}칸`);
  }

  console.log('\n[3) 켜면 버튼이 나오고, 키워드가 실려 가는가]');
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
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (typeof formInvalidatePlan === 'function') formInvalidatePlan(); });
  ok(await openForm(), '양식 화면을 다시 연다');
  ok(await page.$('#btn-essay-ai') !== null, '③ 켜면 글 만들기 버튼이 나온다');
  const fine = await page.$('.essay-fine');
  ok(fine !== null, '③ 버튼 아래 한 줄로 무엇이 나가는지 밝힌다 (긴 확인 상자는 없앴다)');
  ok(await page.$('#essay-confirm') === null, '③ 옛 "이 내용을 보낼게요" 상자는 없다');

  /* 학생이 키워드를 고른다 — 이것이 이 서비스가 요구하는 전부여야 한다 */
  const picked = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.essay-ask .essay-chips').forEach((g) => {
      const c = g.querySelector('.chip');
      if (c) { c.click(); out.push(c.dataset.value); }
    });
    return out;
  });
  await page.waitForTimeout(200);
  console.log('      학생이 고른 키워드:', picked.join(' / ') || '(없음)');
  ok(picked.length >= 1, '③ 키워드를 눌러서 고를 수 있다');

  /* 🔴 되묻기 — 보기를 누르면 그 보기에 대해서만 좁게 묻는 칸이 열려야 한다 */
  const fu = await page.$('.essay-fu:not([hidden])');
  ok(fu !== null, '③ 보기를 누르면 되묻기 칸이 열린다 (백지가 아니라 좁은 질문)');
  if (fu) {
    const t = await fu.textContent();
    ok(/차별점/.test(t), '③ 왜 써야 하는지 알려 준다 (지원서의 차별점)');
    ok(/어떻게 해 왔는지/.test(t), '③ 재단이 무엇을 보는지 알려 준다');
    ok((await page.$$('.essay-fu:not([hidden]) .essay-eg')).length >= 1,
      '③ 눌러서 시작할 예시 문장이 있다');
    ok(/'/.test(t), '③ 방금 누른 보기를 되비춰 준다', t.slice(0, 40));
  }

  /* 아직 직접 쓴 한 줄이 없으므로 한 번 세워야 한다 (막지는 않는다) */
  await page.click('#btn-essay-ai');
  await page.waitForTimeout(600);
  ok(await page.$('#essay-nudge') !== null, '③ 직접 쓴 한 줄이 없으면 한 번 세운다');
  const nudge = await page.$eval('#essay-nudge', (el) => el.textContent).catch(() => '');
  ok(!/같은 글이 나와요|비슷한 사정/.test(nudge), '③ 앱의 부족함이 아니라 학생이 얻을 것을 말한다', nudge.slice(0, 60));
  ok((await page.evaluate(() => window.__sent.length)) === 0, '③ 세우는 동안에는 보내지 않는다');

  /* 예시를 눌러 시작점을 넣고 — 이것이 '직접 쓴 한 줄'이 된다 */
  await page.click('.essay-fu:not([hidden]) .essay-eg');
  await page.waitForTimeout(200);
  const own = await page.$eval('.essay-fu:not([hidden]) .essay-fu-in', (el) => el.value);
  ok(own.length > 5, '③ 예시를 누르면 칸이 채워져 고칠 수 있다', own);
  await page.evaluate(() => document.querySelector('.essay-fu:not([hidden])').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: SHOT('2-followup') });

  await page.click('#btn-essay-ai');
  await page.waitForTimeout(1000);
  const sent = await page.evaluate(() => window.__sent);
  ok(sent.length === 1, `요청이 한 번 나갔다 (${sent.length}회)`);
  const body = JSON.stringify(sent[0] || {});
  const leaks = ['이선주', '202312345', '010-1234-5678', 'test@hufs.ac.kr', '4.1', '4구간', 'gpa', 'bracket']
    .filter((w) => body.includes(w));
  ok(leaks.length === 0, '③ 이름·학번·연락처·이메일·성적·소득분위가 나가지 않았다', leaks.join(', '));
  ok(!/fallbacks/.test(body), '③ fallbacks 를 붙이지 않는다');
  ok((sent[0].fields || []).every((f) => f.kind === 'story'),
    '③ story 칸만 보낸다 — 사실 나열형은 요청에 없다');
  const f0 = (sent[0].fields || [])[0] || {};
  ok((f0.asks || []).length >= 1, '③ 학생이 고른 키워드가 요청에 실려 간다', JSON.stringify(f0.asks || []));
  ok((f0.asks || []).some((a) => a.own), '③ 직접 쓴 한 줄이 own 으로 구분돼 실려 간다');
  ok(Number(f0.target) >= 200, `③ 목표 분량이 실려 간다 (${f0.target}자)`);
  console.log('    보낸 것:', JSON.stringify({
    profile: sent[0].profile,
    target: f0.target,
    asks: (f0.asks || []).map((a) => `${a.q}=${a.a}`),
  }));

  console.log('\n[4) 초안이 칸에 들어가는가]');
  const key = sent[0].fields[0].key;
  await page.evaluate((k) => {
    window.__reply = { drafts: [{ key: k, text: '가계 사정으로 등록금 마련이 어려워 학업에 전념하기 힘든 상황입니다.\n\n그래서 학기 중에도 아르바이트를 이어 왔습니다.' }], skipped: [] };
  }, key);
  await page.click('#btn-essay-ai');
  await page.waitForTimeout(1000);
  const filled = await page.$eval(`#fq-${key}`, (el) => el.value);
  ok(filled.includes('가계 사정'), '④ 초안이 칸에 들어간다');
  ok(await page.$('.essay-flag') !== null, '④ 그 칸에 초안 표시가 붙는다');
  const flag = await page.$eval('.essay-flag', (el) => el.textContent);
  ok(/초안/.test(flag) && /고쳐/.test(flag), '④ "초안 — 읽고 고치세요"라고 말한다', flag);
  await page.screenshot({ path: SHOT('3-drafted') });

  console.log('\n[4-2) 완성 문서 수정 돕기 — 되돌리기·바뀐 곳·빠진 팁 (서버 없이)]');
  /* 초안(목표 1800자인데 약 60자)이라 '분량' 팁이 뜬다 — 서버 응답이 아니라
     화면에서 essay-quality.js 로 다시 계산한 것이다(단일 출처). */
  ok(await page.$('.essay-tips') !== null, '④-2 "이렇게 하면 더 좋아져요" 팁 카드가 뜬다');
  ok(await page.$('.essay-undo') !== null, '④-2 "되돌리기" 버튼이 생긴다');
  ok(await page.$('.essay-diff-toggle') !== null, '④-2 "바뀐 곳 보기" 버튼이 생긴다');
  /* 바뀐 곳 보기 → 새로 들어온 부분이 표시된다 */
  await page.click('.essay-diff-toggle');
  await page.waitForTimeout(150);
  ok(await page.$('.essay-diff .essay-add') !== null, '④-2 바뀐 곳을 열면 새로 들어온 부분이 표시된다');
  await page.screenshot({ path: SHOT('4-aids') });
  /* 되돌리기 → AI가 만들기 전(빈 칸)으로 돌아가고 초안 표시도 사라진다 */
  await page.click('.essay-undo');
  await page.waitForTimeout(200);
  ok(await page.$eval(`#fq-${key}`, (el) => el.value) === '', '④-2 되돌리면 AI 초안 전으로 돌아간다');
  ok(await page.$('.essay-flag') === null, '④-2 되돌리면 초안 표시도 사라진다');

  console.log('\n[5) 실패해도 학생 글을 덮지 않는가]');
  await page.fill(`#fq-${key}`, '제가 직접 쓴 문장입니다');
  await page.evaluate(() => {
    window.fetch = async () => { throw new Error('서버 죽음'); };
  });
  await page.click('#btn-essay-ai');
  await page.waitForTimeout(1200);
  ok(await page.$eval(`#fq-${key}`, (el) => el.value) === '제가 직접 쓴 문장입니다',
    '⑤ 서버가 죽어도 학생이 쓴 글이 그대로 남는다');
  ok(await page.$eval('#btn-essay-ai', (el) => !el.disabled), '⑤ 실패해도 버튼이 다시 눌린다');

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
