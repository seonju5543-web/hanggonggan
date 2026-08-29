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
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
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

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
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
    const storyOf = (s) => (!s || !s.formId || !FORM_TEMPLATES[s.formId] ? []
      : (FORM_TEMPLATES[s.formId].sections || []).flatMap((x) => x.fields || [])
        .filter((f) => f.type === 'textarea' && f.kind === 'story'));
    /* 🔴 신청 버튼이 **실제로 열리는** 공고만 집는다 (2026-08-30).
       위 주석은 늘 '마감 안 된'이라고 말했지만 코드는 아무것도 안 보고 있었다.
       앱이 신청을 여는 조건은 둘이다 — 마감 전이고, 자격 판정이 unknown·미달이 아닐 것.
       🔴 조건을 베끼지 말고 **앱의 함수를 그대로 쓴다**(evaluate·dday) — 베끼면
       앱이 조건을 바꿔도 이 검사만 옛 조건으로 남는다. */
    const usable = (s) => dday(s.deadline).days >= 0
      && ['eligible', 'selective'].includes(evaluate(s, state.profile).status);
    /* 🔴 화면에 실제로 뜬 카드 중에서 고른다. registeredList 전체에서 고르면
       '이 학생에게 안 보이는 학교한정 공고'를 집어 검사가 열리지도 않는다
       (첫 시도에 중앙대 공고를 집어 그렇게 됐다). */
    const visible = [...document.querySelectorAll('#explore-list [data-detail]')]
      .map((el) => registeredList.find((x) => x.id === el.dataset.detail)).filter(Boolean);
    for (const s of visible) if (usable(s) && storyOf(s).length) {
      return { id: s.id, name: s.name, formId: s.formId, story: storyOf(s).length, injected: false };
    }
    /* 🔴 하나도 없으면 **조용히 건너뛰지 않는다** — 그러면 44항목이 통째로 안 돌고
       초록불만 남는다(2026-08-30 실제로 그랬다: 마감일 파서를 고쳐 진짜 마감이 채워지자
       마감 전 + 자격 통과 + 서술형 양식인 공고가 이 학생에게 0건이 됐다).
       이 검사가 보는 것은 **서류 도우미 화면**이지 마감·자격 판정이 아니므로,
       자격은 통과하는 공고의 마감만 앞당겨 픽스처로 쓴다(README ③ — 드라이버가 스스로 주입). */
    /* '이 학생에게 보이는가'는 앱의 scopedToProfile 이 정한다 — 여기 베끼면 갈라진다 */
    const relaxable = scopedToProfile(registeredList, state.profile).find((s) => storyOf(s).length
      && ['eligible', 'selective'].includes(evaluate(s, state.profile).status));
    if (!relaxable) return null;
    const d = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    relaxable.deadline = d;
    renderExplore();
    return { id: relaxable.id, name: relaxable.name, formId: relaxable.formId,
      story: storyOf(relaxable).length, injected: true };
  });
  console.log(`\n대상 공고: ${target ? `${target.name} (${target.formId} · story ${target.story}칸)${target.injected ? ' ⚠️ 마감 전인 공고가 없어 이 공고의 마감만 앞당겨 씁니다(픽스처)' : ''}` : '없음'}`);
  if (!target) { console.log('서술형 양식 + 자격 통과 공고가 하나도 없습니다 — 건너뜁니다.'); await browser.close(); process.exit(0); }

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

  /* ── 7) 제출 전 점검표 + 빈칸 관문 · 재료 충분도 게이지 (2026-08-29, 고도화 1·2순위) ──
     🔴 이 두 장치는 순수 모듈 검사(verify-essay-submit.mjs)가 판정을 지키지만,
        **화면에 실제로 뜨는지**는 그 검사가 알 수 없다. 붙이는 것을 빠뜨려도 순수 검사는
        조용히 통과한다 — 이 저장소가 여러 번 겪은 '검사가 조용해서 못 봤다' 유형이라
        여기서 진짜 앱을 눌러 확인한다. */
  console.log('\n[7) 제출 전 점검표 + 재료 게이지 — 화면에 실제로 뜨는가]');
  /* 🔴 openForm 은 아래 내비게이션을 누르는데, 지금은 양식 시트가 그 위를 덮고 있다.
     먼저 시트를 닫아야 한다(안 닫으면 클릭이 가로채여 시간초과로 죽는다). */
  await page.keyboard.press('Escape');
  await page.waitForSelector('#detail-sheet:not(.show)', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
  ok(await openForm(), '양식 화면을 다시 연다');
  const askBox7 = await page.$('.essay-ask');
  const fid = askBox7 ? await askBox7.evaluate((e) => e.dataset.for) : null;
  ok(!!fid, '서술형 칸을 찾았다');

  /* 게이지 — 아무것도 안 골랐을 때는 '부족'이어야 한다 */
  const gaugeText = async () => page.$eval('.essay-gauge, [class*="gauge"]', (e) => e.innerText).catch(() => '');
  ok((await gaugeText()).includes('부족'), '② 재료를 안 줬을 때 게이지가 "부족"이라고 말한다');

  /* 키워드를 고르면 게이지가 실제로 움직인다 */
  /* 🔴 눈금은 일부러 세 단계(부족/조금더/충분)라 키워드 하나로는 글자가 안 바뀐다.
     그래서 **막대 길이**를 본다 — 그게 재료가 실제로 늘었다는 표시다.
     🔴 page.click 을 쓰지 않는다 — 시트 안의 안내문이 위에 겹쳐 클릭이 가로채인다.
        이 드라이버가 위(③)에서 이미 쓰는 방식대로 요소에게 직접 누르라고 한다. */
  const barPct = async () => page.$eval('.essay-gauge-bar span',
    (e) => parseFloat(e.style.width) || 0).catch(() => -1);
  const before = await barPct();
  await page.evaluate(() => {
    document.querySelectorAll('.essay-ask .essay-chips').forEach((g) => {
      const c = g.querySelector('.chip');
      if (c) c.click();
    });
  });
  await page.waitForTimeout(500);
  const after = await barPct();
  ok(after > before, `② 키워드를 고르면 게이지가 움직인다 (${before}% → ${after}%)`);

  /* 직접 쓴 한 줄은 고른 보기보다 무겁게 센다 — 게이지가 그만큼 더 올라간다 */
  const fu7 = await page.$('.essay-fu:not([hidden]) .essay-fu-in');
  if (fu7) {
    await fu7.fill('등록금을 벌면서도 전공 수업은 한 번도 빠지지 않았고 새벽에 공부하는 습관을 들였어요');
    await page.waitForTimeout(500);
    ok(await barPct() > after, '② 직접 쓴 한 줄이 게이지를 더 올린다');
  } else {
    ok(false, '② 되묻기 칸이 열려 있어야 한다');
  }

  /* 점검표 — 이름 붙은 자리 표시를 막는가 (관문의 핵심) */
  await page.fill(`#fq-${fid}`, '[봉사 기관명]에서 꾸준히 활동하며 배운 것이 많습니다. '.repeat(3));
  await page.waitForTimeout(900);
  const checkText = await page.$eval('[class*="submit-check"], [class*="checklist"]', (e) => e.innerText).catch(() => '');
  ok(checkText.includes('빈칸'), '① 제출 전 점검표가 화면에 뜬다');
  /* 🔴 이 한 줄이 이 관문의 존재 이유다 — 초안 서버가 실제로 만드는 것은 `[ ]` 가 아니라
     `[봉사 기관명]` 처럼 **이름 붙은 자리**다(worker.js 프롬프트의 예시 자체가 그것). */
  ok(checkText.includes('[봉사 기관명]'),
    '① 이름 붙은 자리 표시를 잡아 무엇을 채울지 짚어 준다');

  /* 다 지우면 그 줄이 통과로 바뀐다 — 관문이 굳어 있지 않다 */
  await page.fill(`#fq-${fid}`, '가정 형편이 어려운 가운데에도 학업을 이어 왔습니다. '.repeat(4));
  await page.waitForTimeout(900);
  const cleared = await page.$eval('[class*="submit-check"], [class*="checklist"]', (e) => e.innerText).catch(() => '');
  ok(!cleared.includes('[봉사 기관명]'), '① 자리 표시를 지우면 그 줄이 풀린다');

  /* 🔴 관문이 '한 번 세우고 영영 잠들지' 않는가 (코드 리뷰가 잡은 버그의 회귀).
     예전에는 forced 를 한 번 켜면 안 꺼서, 그 뒤에 **새로 생긴** 빈칸을 그냥 통과시켰다.
     ⚠️ '← 질문 다시'로 돌아가면 화면을 다시 그려 버튼이 새로 만들어지므로 래치가 저절로
        풀린다 — 그 길로 시험하면 버그가 있어도 검사가 통과한다(실제로 처음에 그렇게 짰다가
        고친 코드를 되돌려도 초록불이 나와서 알았다). 그래서 **화면을 다시 그리지 않고
        그 자리에서 글만 바꿔** 시험한다. */
  await page.fill(`#fq-${fid}`, '[봉사 기관명]에서 활동했습니다. '.repeat(4));
  await page.waitForTimeout(700);
  await page.click('#btn-ff-generate');                 // 1) 한 번 세운다
  await page.waitForTimeout(500);
  ok(await page.$('.form-doc') === null, '① 빈칸이 있으면 문서로 넘어가지 않고 세운다');

  /* 2) 옛 빈칸을 고치고 **다른** 빈칸을 새로 만든다 — 화면은 그대로다(같은 버튼 그대로) */
  await page.fill(`#fq-${fid}`, '[활동 시간]을 이렇게 썼습니다. '.repeat(4));
  await page.waitForTimeout(700);
  await page.click('#btn-ff-generate');
  await page.waitForTimeout(600);
  ok(await page.$('.form-doc') === null,
    '① 새로 생긴 빈칸에는 다시 세운다 (관문이 한 번 쓰고 잠들지 않는다)');

  /* 3) 같은 빈칸이면 다시 눌러 진행된다 — 가두지 않는다 */
  await page.click('#btn-ff-generate');
  await page.waitForTimeout(700);
  ok(await page.$('.form-doc') !== null, '① 같은 것이면 다시 눌러 진행된다 (학생을 가두지 않는다)');
  await page.click('#btn-ff-back');
  await page.waitForTimeout(500);

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
