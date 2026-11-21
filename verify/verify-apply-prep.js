/* 「신청 준비 시작」 버튼이 누르는 순간 신청내역에 담지 않는다 (2026-09-23 개발자 지적)

   *"공고 대부분이 공고양식을 읽지 못하고 신청 준비 시작 버튼을 눌렀을때 바로 신청내역으로 이동"*
   예전 `applyTo(sch)` 는 앱 양식(formTplIdFor)도 서류 도우미(essayDefsFor)도 없는 공고에서
   버튼을 누르는 **순간** `finalizeApply` 로 '신청 준비 완료'를 찍고 시트를 닫았다 — 학생은
   아무것도 준비하지 않았는데 신청내역에 '준비 완료'가 떴다(운영 원칙 1 정직한 신청 상태).
   실측으로 마감 전 공고 112건 중 100건(층1 32 · 층2 68)이 그 길이었다.
   2026-09-23: '신청 준비' 시트(`#apply-prep`)가 먼저 뜨고 확인(`#btn-prep-confirm`)을 눌러야 담겼다.
   2026-10-13(개발자 결정 "앱 자체 문서는 있는 게 맞다"): 양식 없는 등록 공고엔 **공고별 지원문서**가 붙어 질문 화면(`#btn-ff-generate`)이
   먼저 뜨고, 문서를 만들어 확인해야 담긴다. 준비 시트는 앱 문서가 없는 층2·상시 제도에만 남았다(⑤).

   🔴 **실제로 눌러서** 잰다 — 글자만 훑는 검사는 아무것도 안 하는 구현도 통과시킨다
      (2026-08-29 verify-sheet-back 이 그랬다). 핵심 항목은 ①의 '그 순간 신청내역에 없다'이고,
      applyTo 를 옛 모양(finalizeApply + closeSheet)으로 되돌리면 여기서 빨간불이 나야 한다
      (2026-09-23 red-green 으로 확인).
   🔴 **공고 id 를 박지 않는다** — 마감은 굴러가고 양식은 붙는다. 대상은 페이지 안에서 앱 함수
      (allScholarships · formTplIdFor · essayDefsFor · dday · applyLock · evaluateFor)로
      그때그때 고른다. 고를 것이 없으면 '이 검사는 무의미하다'를 **실패로** 찍는다 — 조용히
      건너뛰면 빈 목록을 상대로 초록불이 된다(verify-kosaf 선발공고문 절의 교훈).
   ⚠️ 쓸어 닫기는 **TouchEvent 로** 재현한다 — 마우스로는 이 유형이 재현되지 않는다.

   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         CHROME_PATH=... PORT=<포트> node verify/verify-apply-prep.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify, swipeDown } = require('./onboard-helper.js');
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
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {},
};

/* 서류 목록의 '원문에서 확인하라'는 **안내 줄** — 서류 이름이 아니다(층1 · 층2 두 꼴).
   ⚠️ 앱의 DOC_PLACEHOLDER 를 빌려 쓰지 않는다 — 그걸 쓰면 앱이 그 정규식을 무르게 고쳐도
      검사가 같이 물러진다. 여기는 실제 데이터에 있는 두 문장만 적는다. */
const PLACEHOLDER_RE = /(원문\s*공고에서\s*확인|공고문에서\s*확인)/;

/* 손가락으로 시트를 아래로 끄는 동작 (verify-sheet-back 과 같은 방식) */

(async () => {
  await assertOwnServer(PORT);   // 남의 워크트리를 재면 판정이 거짓이 된다
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript((p) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [] }));
    /* 이어보기 장부도 지운다 — 남겨 두면 앱이 앞 검사에서 보던 화면으로 돌아간다 (2026-09-09) */
    localStorage.removeItem('handaejang.resume');
  }, PROFILE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await dismissNotify(page);   // 규칙은 onboard-helper 한 곳 — 뒤늦게 떠서 클릭을 막는다
  /* 데이터가 다 올 때까지 — 층1·층2 목록과 양식 원본(forms.json)이 비동기로 온다.
     ⚠️ 양식이 늦게 오면 formTplIdFor 가 null 이라 양식 있는 공고가 '양식 없음'으로 골라진다. */
  await page.waitForFunction(() => registeredList.length > 0 && kosafList.length > 0
    && (!registeredList.some((s) => s.formId)
      || registeredList.some((s) => s.formId && typeof FORM_TEMPLATES !== 'undefined' && FORM_TEMPLATES[s.formId])),
  null, { timeout: 10000 }).catch(() => {});

  /* ── 페이지 안의 도우미 ── */
  const appsOf = (id) => page.evaluate((i) => ({
    mem: state.applications.filter((a) => a.id === i).map((a) => ({ pending: a.pending })),
    disk: ((JSON.parse(localStorage.getItem('handaejang.v1') || '{}').applications) || [])
      .filter((a) => a.id === i).map((a) => ({ pending: a.pending })),
  }), id);
  const sheetOpen = () => page.evaluate(() => {
    const s = document.querySelector('#detail-sheet');
    return !s.hidden && s.classList.contains('show');
  });
  const open = async (id) => {
    await page.evaluate((i) => openDetail(i), id);
    await page.waitForSelector('#detail-sheet.show', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(350);   // 올라오는 동작이 끝난 뒤에 누른다
  };
  /* 상세 시트의 '신청 준비 시작' 을 **진짜로** 누른다 → 신청 준비 시트가 떴는가 */
  const pressApply = async () => {
    const btn = await page.evaluate(() => {
      const b = document.querySelector('#btn-apply-one');
      return b ? { label: b.textContent.trim(), disabled: b.disabled } : null;
    });
    if (!btn || btn.disabled) return { btn, prep: false };
    await page.click('#btn-apply-one', { timeout: 4000 });
    const prep = await page.waitForSelector('#apply-prep', { state: 'visible', timeout: 3000 })
      .then(() => true).catch(() => false);
    return { btn, prep };
  };
  const closedAfter = async (ms) => { await page.waitForTimeout(ms); return !(await sheetOpen()); };

  /* ══ 대상 고르기 — id 를 박지 않는다 ══════════════════════════════════════ */
  const pick = await page.evaluate((phSrc) => {
    const PH = new RegExp(phSrc);
    const p = state.profile;
    const regIds = new Set(registeredList.map((s) => s.id));
    const applied = (s) => state.applications.some((a) => a.id === s.id);
    const can = (s) => applyLock(evaluateFor(s, p), state.applications.find((a) => a.id === s.id),
      dday(s.deadline), s).canApply;
    const live = allScholarships().filter((s) => !s.program && dday(s.deadline).days >= 0 && !applied(s) && can(s));
    /* 2026-10-13 개발자 결정 — 앱 양식(formId)이 없는 등록 공고에는 **앱 자체 지원문서**(prep:)가 붙는다.
       층1 대상은 그 문서가 붙은 공고다(formId 만 있고 템플릿이 안 온 공고는 섞지 않는다). */
    const plain = (s) => !s.formId && s.prepFormId && formTplIdFor(s) === s.prepFormId;
    const l1 = live.filter((s) => regIds.has(s.id) && s.sourceKind !== 'kosaf' && plain(s));
    /* 시트가 '신청서 양식'으로 부르는 규칙은 data.js isApplicationForm 한 곳 (2026-09-23 리뷰로 좁혔다) */
    const hasFormAtt = (s) => (s.attachments || []).some(isApplicationForm);
    /* A — 서류 목록에 안내 줄이 있고(③을 잴 수 있고) 원문 주소가 있는 것을 먼저 */
    const score = (s) => (s.documents.some((d) => PH.test(d)) ? 4 : 0) + (s.sourceUrl ? 2 : 0) + (hasFormAtt(s) ? 0 : 1);
    const A = l1.slice().sort((a, b) => score(b) - score(a))[0] || null;
    /* B 는 머리말이 **'첨부 신청서'(attached)** 인 공고 — 같은 첨부가 있어도 원문이 메일·포털 접수를 말하면 머리말은 그 접수 방법이다(forms.js prepKindFor 순서).
       데이터가 메일 접수 주소를 새로 읽자 영남대 다문화가정(신청서.hwp + 「이메일 접수」)이 B 로 골려 ② 의 둘째 줄 대조가 헛돌았다(2026-11-16) */
    /* 🔴 6-1 (2026-11-21 개발자 지시 — *"사본이 있는데도 불구하고 앱 자체 양식으로 띄우고 있어서"* · *"자체제작문서는 신청양식이 없는 경우에만"*):
          공고가 올린 신청서 원본이 있는 공고(app-live hasOriginalForm)는 앱 지원문서가 아니라 「신청 준비」 시트로 간다. B·P 는 그 공고에서 고른다
          (그 전에는 지원문서가 붙은 l1 에서 골랐다 — 이제 l1 에는 원본이 있는 공고가 없다) */
    const orig1 = live.filter((s) => regIds.has(s.id) && s.sourceKind !== 'kosaf' && !s.formId && hasOriginalForm(s));   // 🔴 formTplIdFor 로 거르지 않는다 — 앱이 지원문서를 띄우면 아래 🔴 검사가 잡아야 한다
    const B = orig1.find((s) => hasFormAtt(s)) || null;
    /* 층2도 2026-10-13 부터 앱 지원문서가 붙는다(① · 머리말 'kosaf') — 대상은 그 문서가 붙은 것 */
    const l2 = live.filter((s) => s.sourceKind === 'kosaf' && s.prepFormId && formTplIdFor(s) === s.prepFormId);
    const C = l2.find((s) => (s.attachments || []).length) || l2[0] || null;
    /* 🔴 F 는 **앱 양식(formId)이 있는** 공고다 — formTplIdFor 는 2026-10-13 부터 앱 지원문서(prep:)도 돌려주므로 그걸로 고르면
       A(지원문서 공고)와 같은 공고가 잡혀 ①에서 이미 '신청 준비'한 뒤 ⑦에서 「버튼이 열려 있다」가 거짓이 된다(2026-10-16 verify-ui 빨간불 실측). */
    const F = live.find((s) => s.formId && formTplIdFor(s) === s.formId) || null;
    /* P — 로봇이 원본 PDF 로 바꿔 둔 신청서가 있는 공고(승인 시안 A · 2026-10-14). 색인은 앱이 받은 formsPdfIndex 그대로 */
    const P = orig1.find((s) => hasFormAtt(s) && formPdfsFor(s).length) || null;
    const brief = (s) => s && ({ id: s.id, name: s.name.slice(0, 40), src: !!s.sourceUrl,
      atts: (s.attachments || []).length,
      formAtts: (s.attachments || []).filter(isApplicationForm).map((a) => ({ name: a.name, href: safeUrl(a.url) })),
      pdfs: formPdfsFor(s).map((f) => ({ href: new URL(`data/forms-pdf/${f.file}`, document.baseURI).href, pages: f.pages, bytes: f.bytes, name: unent(String(f.name || '')).replace(/\s+/g, ' ').trim() })),
      /* 맨 밑 원본 신청서 — 신청서 첨부 + PDF 로 올라온 신청서(사본과 이름이 같은 첨부 · 11-20 「원래 PDF 는 두 곳 다」) */
      origForms: (s.attachments || []).filter((a) => a && !a.bodyImage && (attIsForm(s, a) || formPdfsFor(s).some((f) => f.name === a.name))).map((a) => unent(String(a.name || '')).replace(/\s+/g, ' ').trim()),
      ph: s.documents.some((d) => PH.test(d)) });
    return { A: brief(A), B: brief(B), C: brief(C), F: brief(F), P: brief(P),
      counts: { l1: l1.length, orig1: orig1.length, l2: l2.length, pdf: Object.keys((formsPdfIndex && formsPdfIndex.items) || {}).length } };
  }, PLACEHOLDER_RE.source);
  console.log(`  · 후보 — 층1 양식 없음 ${pick.counts.l1}건 · 층2 ${pick.counts.l2}건 · 원본 PDF 색인 ${pick.counts.pdf}건`);

  /* ══ ① 층1 · 앱 양식 없음 → 앱 자체 지원문서 작성 화면이 먼저 뜬다 (2026-10-13 개발자 결정) ═══
     예전(9-23)엔 '신청 준비' 시트가 떴다 — 그런데 그 시트에는 학생이 할 일이 없어 버튼 한 번에 '준비 완료'가 됐다.
     이제 양식이 없는 등록 공고마다 공고에 맞춘 지원문서가 붙어, 버튼을 누르면 **질문 화면**(#btn-ff-generate)이 뜨고
     문서를 만들어 확인해야 담긴다. 핵심은 변함없다 — 누르는 순간 신청내역에 없다. */
  console.log('\n■ ① 층1 공고 — 「신청 준비 시작」 은 지원문서 작성 화면을 띄울 뿐 담지 않는다');
  eq('마감 전 · 앱 양식 없음(자체 지원문서 붙음) · 미신청인 층1 공고가 있다 (없으면 이 검사는 무의미하다)', !!pick.A, true);
  const pressApplyForm = async () => {
    const btn = await page.evaluate(() => {
      const b = document.querySelector('#btn-apply-one');
      return b ? { label: b.textContent.trim(), disabled: b.disabled } : null;
    });
    if (!btn || btn.disabled) return { btn, form: false };
    await page.click('#btn-apply-one', { timeout: 4000 });
    const form = await page.waitForSelector('#btn-ff-generate', { state: 'visible', timeout: 3000 })
      .then(() => true).catch(() => false);
    return { btn, form };
  };
  if (pick.A) {
    console.log(`  · 대상: ${pick.A.name} (${pick.A.id})`);
    /* ③을 잴 수 있게 — 안내 줄이 없는 공고가 골렸으면 한 줄 심는다(데이터에 기대지 않는다) */
    if (!pick.A.ph) {
      console.log('  · 서류 목록에 안내 줄이 없어 한 줄 심는다 (③ 픽스처)');
      await page.evaluate((id) => { const s = findSch(id); s.documents.push('지원 자격·제출 서류는 원문 공고에서 확인'); attachPrepTemplates([s]); }, pick.A.id);
    }
    await open(pick.A.id);
    const r = await pressApplyForm();
    eq('  버튼이 열려 있고 문구가 「신청 준비 시작」이다', r.btn && { label: r.btn.label, disabled: r.btn.disabled },
      { label: '신청 준비 시작', disabled: false });
    eq('  누르면 지원문서 작성 화면(#btn-ff-generate)이 뜬다 — 빈 준비 시트가 아니다', [r.form, !!(await page.$('#apply-prep'))], [true, false]);
    eq('  머리가 「지원문서 작성」 이고 둘째 줄이 그 문서의 성격(제출은 원본으로 · 포털에 붙여 넣기 · 원문 확인)을 말한다',
      await page.evaluate((id) => {
        const t = document.querySelector('#detail-sheet .sheet-title');
        const p = document.querySelector('#detail-sheet .sheet-provider');
        /* 🔴 문구를 여기 베껴 적지 않는다 — 그 공고의 갈래(prepKindFor)가 말하는 둘째 줄(forms.js PREP_LEADS)이 그대로 떠 있는가.
           2026-11-18: 손으로 적은 목록에 「메일 접수」 갈래 문구(「공고가 정한 서식에 옮겨 적을 내용」)가 없어, 대상이 메일 접수 공고로 바뀐 날 앱이 멀쩡한데 빨개졌다 */
        const lead = PREP_LEADS[prepKindFor(findSch(id))] || '';
        return [t && t.textContent.trim(), !!(p && lead && p.textContent.includes(lead) && !/원문에서 확인|원문 확인|확인 필요/.test(p.textContent))];   // 2026-11-15 — 모르는 공고의 둘째 줄은 「공고에 낼 내용을 정리합니다 — 제출은 공고가 정한 방법으로」(예전 「… 원문에서 확인」)
      }, pick.A.id), ['지원문서 작성', true]);
    /* 🔴 이게 핵심이다 — 예전 버그는 바로 이 순간 '신청 준비 완료'를 찍었다 */
    eq('  🔴 그 순간 신청내역(state.applications)에 없다', await appsOf(pick.A.id), { mem: [], disk: [] });
    await page.waitForTimeout(500);
    eq('  시트가 닫히지 않고 열려 있다 (#detail-sheet.show)', await sheetOpen(), true);

    /* ══ ② 질문 화면이 공고의 것을 보여 준다 ══ */
    console.log('\n■ ② 지원문서 질문 화면 — 공고에서 온 것만');
    if (!r.form) { fail++; console.log('  ✕ 질문 화면이 안 떠 ②③⑥ 을 잴 수 없다'); }
    else {
      const c = await page.evaluate(() => {
        const root = document.querySelector('#detail-sheet');
        return {
          text: root.innerText,
          boxed: [...root.querySelectorAll('li')].map((l) => l.textContent.trim()).filter((t) => t.startsWith('□')),
          questions: root.querySelectorAll('textarea, input[type="text"], input[type="checkbox"]').length,
        };
      });
      eq(`  채울 칸이 하나 이상이다 (${c.questions}칸)`, c.questions >= 1, true);
      /* ══ ③ 안내 줄이 체크리스트 항목이 되지 않는다 ══ */
      console.log('\n■ ③ 「원문에서 확인」 안내 줄을 챙길 서류(□ …)로 올리지 않는다');
      eq('  □ 항목 중 안내 줄이 하나도 없다', c.boxed.filter((t) => PLACEHOLDER_RE.test(t)), []);

      /* ══ ⑥-a 쓸어 닫으면 담기지 않는다 ══ */
      console.log('\n■ ⑥ 확인 없이 닫으면 담기지 않는다 — 아래로 쓸어 닫기');
      await swipeDown(page, '#detail-sheet');
      eq('  쓸어 내리면 시트가 닫힌다', await closedAfter(800), true);
      eq('  신청내역에 없다', await appsOf(pick.A.id), { mem: [], disk: [] });
    }

    /* ══ ④ 문서를 만들고 확인을 눌러야 담긴다 ══ */
    console.log('\n■ ④ 문서를 만들어 확인을 눌러야 담긴다');
    await open(pick.A.id);
    const r2 = await pressApplyForm();
    eq('  다시 열어 누르면 질문 화면이 또 뜬다', r2.form, true);
    if (r2.form) {
      await page.click('#btn-ff-generate', { timeout: 4000 });
      const prev = await page.waitForSelector('#btn-ff-confirm', { state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
      eq('  「양식 문서 만들기」 → 작성 내용 확인 화면(#btn-ff-confirm)', prev, true);
      eq('  아직 신청내역에 없다', await appsOf(pick.A.id), { mem: [], disk: [] });
      if (prev) {
        const doc = await page.evaluate(() => {
          const d = document.querySelector('#ff-doc');
          return { title: d && d.querySelector('.fd-title') && d.querySelector('.fd-title').textContent, tag: d && d.querySelector('.fd-tag') && d.querySelector('.fd-tag').textContent,
            boxedPh: [...(d ? d.querySelectorAll('td') : [])].map((t) => t.textContent).filter((t) => /^☐|^□/.test(t.trim()) && /원문 공고에서 확인/.test(t)).length };
        });
        eq('  문서 제목이 그 공고 이름을 담고 머리말이 문서의 성격을 밝힌다', [!!doc.title && doc.title.includes('지원문서'), !!doc.tag && /^※/.test(doc.tag.trim())], [true, true]);
        eq('  문서 안에도 안내 줄이 체크 항목으로 들어가지 않는다', doc.boxedPh, 0);
        await page.click('#btn-ff-confirm', { timeout: 4000 });
        eq('  확인을 누르면 신청내역에 pending:false 로 담긴다', await appsOf(pick.A.id),
          { mem: [{ pending: false }], disk: [{ pending: false }] });
        await closedAfter(500);
        await open(pick.A.id);
        eq('  다시 열면 버튼이 「신청 준비 완료됨」 으로 잠긴다', await page.evaluate(() => {
          const b = document.querySelector('#btn-apply-one');
          return b && { label: b.textContent.trim(), disabled: b.disabled };
        }), { label: '준비 중 1/4 — 아래 체크리스트', disabled: true });   /* 문서는 썼고(1/4) 서류·증명서·제출 방법 확인이 남았다 (2026-10-13 ③ 체크리스트) */
        eq('  준비 체크리스트가 보이고, 「확인했어요」를 누르면 2/4 가 된다', await page.evaluate(async () => {
          const li = document.querySelectorAll('#detail-sheet .prep-check li').length;
          const b = document.querySelector('#detail-sheet [data-prep-toggle="docs"]');
          if (!b) return { li, btn: 'no-toggle' };
          b.click(); await new Promise((r) => setTimeout(r, 300));
          return { li, btn: document.querySelector('#btn-apply-one').textContent.trim() };
        }), { li: 4, btn: '준비 중 2/4 — 아래 체크리스트' });
        await page.keyboard.press('Escape');
        await closedAfter(500);
      }
    } else { fail++; console.log('  ✕ 질문 화면이 안 떠 문서를 만들 수 없다'); }
  }

  /* ══ ② 이어서 — 첨부에 신청서 양식이 있는 공고 (6-1 · 2026-11-21: 앱 지원문서가 아니라 원본이 놓인 「신청 준비」 시트) ══ */
  console.log('\n■ ② 공고가 올린 신청서 원본이 있으면 앱 지원문서를 띄우지 않고 「신청 준비」 시트의 「신청서 양식」 아래 그 파일을 준다 (6-1)');
  eq('공고가 올린 신청서 첨부가 있고 마감 전인 층1 공고가 있다 (없으면 이 검사는 무의미하다)', !!pick.B, true);
  if (pick.B) {
    console.log(`  · 대상: ${pick.B.name} (${pick.B.id})`);
    await open(pick.B.id);
    const r = await pressApply();
    eq('🔴 누르면 「신청 준비」 시트(#apply-prep)가 뜬다 — 앱 지원문서 질문 화면(#btn-ff-generate)이 아니다', [r.prep, !!(await page.$('#btn-ff-generate'))], [true, false]);
    if (r.prep) {
      const got = await page.evaluate(() => {
        const h = [...document.querySelectorAll('#apply-prep h4')].find((x) => x.textContent.trim().startsWith('신청서 양식'));
        if (!h) return null;
        const ul = h.nextElementSibling;
        return ul && ul.matches('ul') ? [...ul.querySelectorAll('a')].map((a) => ({ name: a.textContent.trim(), href: a.href })) : [];
      });
      eq('  「신청서 양식」 머리가 있다 (승인 시안 A 의 머리 그대로)', got !== null, true);
      /* 로봇이 PDF 로 바꿔 둔 사본이 있으면 그 줄이 위에 서고 올린 원본은 맨 밑 — 이름은 어느 쪽이든 공고의 양식 파일 이름이어야 한다 */
      eq('  그 아래에 공고의 양식 파일(이름)이 그대로 있다', (got || []).length >= 1 && pick.B.formAtts.every((f) => (got || []).some((g) => g.name === f.name)), true);
      eq('  🔴 그 순간 신청내역에 없다 (확인을 눌러야 담긴다)', await appsOf(pick.B.id), { mem: [], disk: [] });
      await page.keyboard.press('Escape');
      eq('  ESC 로 닫힌다', await closedAfter(600), true);
      eq('  닫아도 신청내역에 없다', await appsOf(pick.B.id), { mem: [], disk: [] });
    }
  }

  /* ══ ②-A 승인 시안 A(2026-10-14) — 로봇이 바꿔 둔 「원본 양식 그대로 보기」 줄 ══════
     6-1(2026-11-21) 뒤로 원본 PDF 가 있는 공고는 「신청 준비」 시트가 뜬다 — 시안의 줄(PDF 줄 → 서식 쪽 → 올린 원본)은 그 시트의 「신청서 양식」 묶음에 선다
     (원본이 없는 공고의 지원문서 질문 화면 머리 prepOriginalsHtml 과 같은 줄 함수 attachPdfRowsHtml 한 곳). */
  console.log('\n■ ②-A 원본 PDF 가 있는 공고는 「신청 준비」 시트 「신청서 양식」 맨 위에 PDF 줄(첨부 이름 그대로)이 서고 원본 신청서는 맨 밑 (승인 시안 A → 2026-11-20 시안 · 6-1)');
  eq('로봇이 PDF 로 바꿔 둔 신청서가 있고 마감 전인 층1 공고가 있다 (없으면 이 검사는 무의미하다)', !!pick.P, true);
  if (pick.P) {
    console.log(`  · 대상: ${pick.P.name} (${pick.P.id}) · PDF ${pick.P.pdfs.length}건`);
    await open(pick.P.id);
    const r = await pressApply();
    eq('🔴 「신청 준비」 시트가 뜬다 — 사본이 있는데 앱 지원문서를 띄우지 않는다', [r.prep, !!(await page.$('#btn-ff-generate'))], [true, false]);
    if (r.prep) {
      const got = await page.evaluate(() => {
        const h = [...document.querySelectorAll('#apply-prep h4')].find((x) => x.textContent.trim().startsWith('신청서 양식'));
        const ul = h && h.nextElementSibling;
        const rows = ul ? [...ul.querySelectorAll('li.att')] : [];
        const row = (li) => ({ cls: li.className, icon: (li.querySelector('.att-ic') || {}).textContent, go: (li.querySelector('.att-go') || {}).textContent,
          link: li.querySelector('a') && { text: li.querySelector('a').textContent.trim(), href: li.querySelector('a').href, blank: li.querySelector('a').target === '_blank' },
          meta: (li.querySelector('.att-m') || {}).textContent || '', text: ((li.querySelector('.att-t') || li).textContent || '').replace(/\s+/g, ' ').trim() });
        const note = ul && ul.nextElementSibling && ul.nextElementSibling.matches('.dp-note') ? ul.nextElementSibling.textContent.trim() : null;
        return { n: rows.length, rows: rows.map(row), note };
      });
      const pdfRows = got.rows.slice(0, pick.P.pdfs.length);
      /* 2026-11-20 승인 시안(docs/designs/all-docs-pdf.md) — 줄 이름은 첨부 이름 그대로(「원본 양식 그대로 보기」 아님) · 이름 밑 작은 글씨 없음 ·
         원본 신청서 줄은 목록 맨 밑(서식 쪽 줄보다 아래) · 목록 밑 안내 문단 없음(개발자 "파일명은 그냥 원래대로 … 밑의 회색글씨는 다 지워" · "ㅇㅇ 지워") */
      eq('  첫 줄(들)이 원본 PDF 줄이다 — 첨부 이름 그대로 · 새 탭 · data/forms-pdf/ 주소', pdfRows.map((r) => r.link),
        pick.P.pdfs.map((p) => ({ text: p.name, href: p.href, blank: true })));
      eq('  그 줄은 PDF 아이콘 · 「열기 ›」 · 강조 꼴(att-row-new)', pdfRows.map((r) => [r.icon, r.go, /\batt-row-new\b/.test(r.cls)]),
        pick.P.pdfs.map(() => ['PDF', '열기 ›', true]));
      eq('  이름 밑 작은 회색 글씨가 없다', got.rows.map((r) => r.meta), got.rows.map(() => ''));
      eq('  원본 신청서 줄은 목록 맨 밑(내려받기 ↓) — 서식 쪽 줄이 있어도 그 밑', got.rows.slice(-pick.P.origForms.length).map((r, i) => [r.go, r.text.startsWith(pick.P.origForms[i])]),
        pick.P.origForms.map(() => ['↓', true]));
      eq('  PDF 줄 주소가 서로 다르다 (같은 사본을 두 번 늘어놓지 않는다)', new Set(pdfRows.map((r) => r.link && r.link.href)).size, pick.P.pdfs.length);
      eq('  목록 밑 회색 안내 문단이 없다', got.note, null);
      /* 새 탭 링크가 실제로 PDF 를 준다(서비스워커가 index.html 을 대신 주지 않는다) */
      const head = await page.evaluate(async (u) => { const r = await fetch(u, { cache: 'no-store' }); return { ok: r.ok, type: r.headers.get('content-type') || '' }; }, pick.P.pdfs[0].href);
      eq('  그 주소를 받으면 PDF 다 (서비스워커가 앱을 대신 주지 않는다)', head.ok && /pdf/i.test(head.type), true);
      eq('  아직 신청내역에 없다', await appsOf(pick.P.id), { mem: [], disk: [] });
      await page.screenshot({ path: process.env.SHOT_PATH || '/dev/null', fullPage: false }).catch(() => {});
      await page.keyboard.press('Escape');
      await closedAfter(600);
    }
  }

  /* ══ ②-B 6-1 — 쓰던 앱 지원문서가 남아 있는데 그 공고에 원본 신청서가 생겼다 (PDF 사본은 등록 다음 날 새벽에 생긴다 · 색인이 늦게 올 수도 있다) ══
     이어보기(app.js resumePlan)·히어로 「이어서 쓰기」(app-prep renderDraftSheet)·「다시 작성」이 모두 startFormFill 로 온다.
     🔴 리뷰 2026-11-22: **이미 쓴 글은 뺏지 않는다** — 새로 시작하는 길만 원본으로 가고(위 ②·②-A), 쓰던 글·다 쓴 문서는 그대로 열린다. 템플릿 없이 그려 화면이 멈춰도 안 된다 */
  console.log('\n■ ②-B 원본이 (나중에) 생긴 공고라도 쓰던 지원문서·다 쓴 문서는 그대로 열린다 — 이미 쓴 글을 뺏지 않는다 (6-1)');
  if (!pick.P) console.log('  · 원본 PDF 가 있는 층1 공고가 없어 건너뜀');
  else {
    const r2 = await page.evaluate((id) => {
      const sch = findSch(id);
      resumeSave({ sheet: { kind: 'form', id }, form: { schId: id, tplId: 'prep:' + id, stage: 'q', ans: {}, at: Date.now() } });
      const dr = resumeDraft();
      let threw = '';
      try { openSheetShell(); startFormFill(sch, dr && dr.prog); } catch (e) { threw = String(e && e.message); }
      return { before: !!dr, threw, q: !!document.querySelector('#btn-ff-generate'), prep: !!document.querySelector('#apply-prep'), after: !!resumeDraft(), tpl: formFill && formFill.tplId };
    }, pick.P.id);
    eq('🔴 쓰던 글이 있으면 쓰던 지원문서가 그대로 열린다(준비 시트로 보내 글을 잃게 하지 않는다) · 화면이 멈추지 않는다 · 쓰던 것 표시도 남는다',
      r2, { before: true, threw: '', q: true, prep: false, after: true, tpl: 'prep:' + pick.P.id });
    await page.evaluate(() => resumeSave({ form: null, sheet: null }));
    await page.keyboard.press('Escape');
    await closedAfter(600);
    const r3 = await page.evaluate(async (id) => {
      const sch = findSch(id);
      state.applications.push({ id, name: sch.name, appliedAt: nowStamp(), step: 0, docs: null, pending: false, prep: {}, formAns: {} });
      let threw = '';
      try { openDetail(id); } catch (e) { threw = String(e && e.message); }
      await new Promise((r) => setTimeout(r, 500));
      const has = ['#btn-form-save', '#btn-form-print', '#btn-form-edit'].map((q) => !!document.querySelector(q));
      const b = document.querySelector('#btn-form-edit');
      if (b) b.click();
      await new Promise((r) => setTimeout(r, 400));
      const edit = { stage: formFill && formFill.stage, tpl: formFill && formFill.tplId, sch: formFill && formFill.schId === id };
      state.applications = state.applications.filter((a) => a.id !== id);
      resumeSave({ form: null, sheet: null });
      return { threw, has, edit };
    }, pick.P.id);
    eq('  다 쓴 문서(작성한 양식 문서)는 원본이 생긴 뒤에도 저장·인쇄·다시 작성 단추가 있고, 「다시 작성」이 그 문서를 미리보기로 연다',
      r3, { threw: '', has: [true, true, true], edit: { stage: 'preview', tpl: 'prep:' + pick.P.id, sch: true } });
    await page.keyboard.press('Escape');
    await closedAfter(600);
  }

  /* ══ ⑤ 층2(한국장학재단 목록) — 질문 화면이 먼저 · 첨부는 「선발 공고문」 (2026-10-13 ① 층2 지원문서) ═════ */
  console.log('\n■ ⑤ 층2 공고도 지원문서 질문 화면을 먼저 띄운다 · 첨부는 「선발 공고문」 이다');
  eq('마감 전 · 미신청인 층2 공고(지원문서 붙음)가 있다 (없으면 이 검사는 무의미하다)', !!pick.C, true);
  if (pick.C) {
    console.log(`  · 대상: ${pick.C.name} (${pick.C.id})`);
    await open(pick.C.id);
    const r = await pressApplyForm();
    eq('  누르면 지원문서 질문 화면(#btn-ff-generate)이 뜬다 — 빈 준비 시트가 아니다', [r.form, !!(await page.$('#apply-prep'))], [true, false]);
    eq('  🔴 그 순간 신청내역에 없다', await appsOf(pick.C.id), { mem: [], disk: [] });
    if (r.form) {
      const c = await page.evaluate(() => {
        const root = document.querySelector('#detail-sheet');
        return {
          lead: root.querySelector('.sheet-provider').textContent,
          heads: [...root.querySelectorAll('h4')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
          /* KOSAF 첨부 원주소는 Referer 검사라 학생이 못 받는다 (verify-kosaf 와 같은 규칙) */
          kosafDl: [...root.querySelectorAll('a')].filter((a) => /kosaf\.go\.kr.*(download|fileDown|atchFile)/i.test(a.href)).length,
        };
      });
      eq('  둘째 줄이 재단 접수(선발 공고문의 서식·방법)를 말한다', /재단 접수|선발 공고문/.test(c.lead), true);
      /* 🔴 재단 첨부는 선발 공고문이다 — '신청서 양식'이라 부르면 학생이 그 안에서 빈칸을 찾는다 */
      eq('  「원본 신청서 양식」 이라고 부르지 않는다', c.heads.some((h) => h.startsWith('원본 신청서 양식')), false);
      if (pick.C.atts) eq('  첨부 머리가 「선발 공고문」 이다', c.heads.some((h) => h.startsWith('선발 공고문')), true);   // 이 화면(지원문서 작성 · prepOriginalsHtml)은 승인 시안 밖 — 머리말 그대로
      else console.log('  · 첨부가 있는 층2 공고가 지금 없어 머리 이름 항목은 건너뜀');
      eq('  KOSAF 첨부 내려받기 원주소가 없다', c.kosafDl, 0);

      /* ══ ⑥-b ESC 로 닫아도 담기지 않는다 ══ */
      console.log('\n■ ⑥ 확인 없이 닫으면 담기지 않는다 — ESC');
      await page.keyboard.press('Escape');
      eq('  ESC 로 닫힌다', await closedAfter(600), true);
      eq('  신청내역에 없다', await appsOf(pick.C.id), { mem: [], disk: [] });
    }
  }

  /* ══ ⑦ 회귀 — 앱 양식이 있는 공고는 여전히 양식 질문 화면으로 간다 ═══════════ */
  console.log('\n■ ⑦ 앱 양식이 있는 공고는 그대로 양식 질문 화면으로 간다');
  if (!pick.F) console.log('  · 마감 전 · 앱 양식 있는 공고가 지금 없어 건너뜀');
  else {
    console.log(`  · 대상: ${pick.F.name} (${pick.F.id})`);
    await open(pick.F.id);
    const btn = await page.evaluate(() => {
      const b = document.querySelector('#btn-apply-one');
      return b ? { label: b.textContent.trim(), disabled: b.disabled } : null;
    });
    eq('  버튼이 열려 있다', btn && btn.disabled, false);
    if (btn && !btn.disabled) {
      await page.click('#btn-apply-one', { timeout: 4000 });
      const ff = await page.waitForSelector('#btn-ff-generate', { state: 'visible', timeout: 3000 })
        .then(() => true).catch(() => false);
      eq('  양식 질문 화면(#btn-ff-generate)으로 간다', ff, true);
      eq('  신청 준비 시트(#apply-prep)로 새지 않는다', !!(await page.$('#apply-prep')), false);
      await page.keyboard.press('Escape');
      await closedAfter(500);
    }
  }

  console.log('\n■ 오류');
  eq('콘솔·페이지 오류 없음', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 신청 준비 시트 검증 통과');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
