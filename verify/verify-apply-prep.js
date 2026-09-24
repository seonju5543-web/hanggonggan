/* 「신청 준비 시작」 버튼이 누르는 순간 신청내역에 담지 않는다 (2026-09-23 개발자 지적)

   *"공고 대부분이 공고양식을 읽지 못하고 신청 준비 시작 버튼을 눌렀을때 바로 신청내역으로 이동"*
   예전 `applyTo(sch)` 는 앱 양식(formTplIdFor)도 서류 도우미(essayDefsFor)도 없는 공고에서
   버튼을 누르는 **순간** `finalizeApply` 로 '신청 준비 완료'를 찍고 시트를 닫았다 — 학생은
   아무것도 준비하지 않았는데 신청내역에 '준비 완료'가 떴다(운영 원칙 1 정직한 신청 상태).
   실측으로 마감 전 공고 112건 중 100건(층1 32 · 층2 68)이 그 길이었다.
   지금은 '신청 준비' 시트(`#apply-prep`)가 먼저 뜨고, 확인(`#btn-prep-confirm`)을 눌러야 담긴다.

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
  nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {},
};

/* 서류 목록의 '원문에서 확인하라'는 **안내 줄** — 서류 이름이 아니다(층1 · 층2 두 꼴).
   ⚠️ 앱의 DOC_PLACEHOLDER 를 빌려 쓰지 않는다 — 그걸 쓰면 앱이 그 정규식을 무르게 고쳐도
      검사가 같이 물러진다. 여기는 실제 데이터에 있는 두 문장만 적는다. */
const PLACEHOLDER_RE = /(원문\s*공고에서\s*확인|공고문에서\s*확인)/;

/* 손가락으로 시트를 아래로 끄는 동작 (verify-sheet-back 과 같은 방식) */
async function swipeDown(page, sel) {
  const at = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; });
  await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const mk = (t, cy) => new TouchEvent(t, { bubbles: true, cancelable: true,
      touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })],
      changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: cy })] });
    el.dispatchEvent(mk('touchstart', y));
    el.dispatchEvent(mk('touchmove', y + 140));
    el.dispatchEvent(mk('touchend', y + 140));
  }, at);
}

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
      dday(s.deadline)).canApply;
    const live = allScholarships().filter((s) => !s.program && dday(s.deadline).days >= 0 && !applied(s) && can(s));
    /* 앱 양식이 **아예 없는** 공고만 — formId 만 있고 템플릿이 안 온 공고는 섞지 않는다 */
    const plain = (s) => !s.formId && !s.prepFormId && !formTplIdFor(s) && !essayDefsFor(s).length;
    const l1 = live.filter((s) => regIds.has(s.id) && s.sourceKind !== 'kosaf' && plain(s));
    /* 시트가 '신청서 양식'으로 부르는 규칙은 data.js isApplicationForm 한 곳 (2026-09-23 리뷰로 좁혔다) */
    const hasFormAtt = (s) => (s.attachments || []).some(isApplicationForm);
    /* A — 서류 목록에 안내 줄이 있고(③을 잴 수 있고) 원문 주소가 있는 것을 먼저 */
    const score = (s) => (s.documents.some((d) => PH.test(d)) ? 4 : 0) + (s.sourceUrl ? 2 : 0) + (hasFormAtt(s) ? 0 : 1);
    const A = l1.slice().sort((a, b) => score(b) - score(a))[0] || null;
    const B = l1.find((s) => s !== A && hasFormAtt(s)) || null;
    const l2 = live.filter((s) => s.sourceKind === 'kosaf' && !formTplIdFor(s) && !essayDefsFor(s).length);
    const C = l2.find((s) => (s.attachments || []).length) || l2[0] || null;
    const F = live.find((s) => formTplIdFor(s)) || null;
    const brief = (s) => s && ({ id: s.id, name: s.name.slice(0, 40), src: !!s.sourceUrl,
      atts: (s.attachments || []).length,
      formAtts: (s.attachments || []).filter(isApplicationForm).map((a) => ({ name: a.name, href: safeUrl(a.url) })),
      ph: s.documents.some((d) => PH.test(d)) });
    return { A: brief(A), B: brief(B), C: brief(C), F: brief(F), counts: { l1: l1.length, l2: l2.length } };
  }, PLACEHOLDER_RE.source);
  console.log(`  · 후보 — 층1 양식 없음 ${pick.counts.l1}건 · 층2 ${pick.counts.l2}건`);

  /* ══ ① 층1 · 앱 양식 없음 — 버튼을 눌러도 아직 담기지 않는다 ═══════════════ */
  console.log('\n■ ① 층1 공고 — 「신청 준비 시작」 은 시트를 띄울 뿐 담지 않는다');
  eq('마감 전 · 앱 양식 없음 · 서류 도우미 없음 · 미신청인 층1 공고가 있다 (없으면 이 검사는 무의미하다)', !!pick.A, true);
  let prepOk = false;
  if (pick.A) {
    console.log(`  · 대상: ${pick.A.name} (${pick.A.id})`);
    /* ③을 잴 수 있게 — 안내 줄이 없는 공고가 골렸으면 한 줄 심는다(데이터에 기대지 않는다) */
    if (!pick.A.ph) {
      console.log('  · 서류 목록에 안내 줄이 없어 한 줄 심는다 (③ 픽스처)');
      await page.evaluate((id) => { findSch(id).documents.push('지원 자격·제출 서류는 원문 공고에서 확인'); }, pick.A.id);
    }
    await open(pick.A.id);
    const r = await pressApply();
    eq('  버튼이 열려 있고 문구가 「신청 준비 시작」이다', r.btn && { label: r.btn.label, disabled: r.btn.disabled },
      { label: '신청 준비 시작', disabled: false });
    prepOk = r.prep;
    eq('  누르면 신청 준비 시트(#apply-prep)가 뜬다', r.prep, true);
    eq('  확인 버튼(#btn-prep-confirm)이 있다', !!(await page.$('#btn-prep-confirm')), true);
    /* 🔴 이게 핵심이다 — 예전 버그는 바로 이 순간 '신청 준비 완료'를 찍었다 */
    eq('  🔴 그 순간 신청내역(state.applications)에 없다', await appsOf(pick.A.id), { mem: [], disk: [] });
    /* 옛 closeSheet 는 250ms 뒤에 시트를 숨겼다 — 그보다 오래 기다려 본다 */
    await page.waitForTimeout(500);
    eq('  시트가 닫히지 않고 열려 있다 (#detail-sheet.show)', await sheetOpen(), true);

    /* ══ ② 시트 내용 ══ */
    console.log('\n■ ② 신청 준비 시트가 무엇을 해야 하는지 말한다');
    if (!prepOk) { fail++; console.log('  ✕ 신청 준비 시트가 안 떠 ②③⑥ 을 잴 수 없다'); }
    else {
      const c = await page.evaluate(() => {
        const root = document.querySelector('#apply-prep');
        const heads = [...root.querySelectorAll('h4')].map((h) => h.textContent.replace(/\s+/g, ' ').trim());
        const src = [...root.querySelectorAll('.doc-legend a')].map((a) => ({ href: a.href, text: a.textContent.trim() }));
        return { heads, guide: root.querySelectorAll('.guide-list li').length, src,
          text: root.innerText, boxed: [...root.querySelectorAll('li')].map((l) => l.textContent.trim()).filter((t) => t.startsWith('□')) };
      });
      eq('  「최종 제출 방법」 머리가 있다', c.heads.some((h) => h.startsWith('최종 제출 방법')), true);
      eq(`  제출 방법 안내 줄이 1개 이상이다 (${c.guide}줄)`, c.guide >= 1, true);
      if (pick.A.src) {
        const want = await page.evaluate((id) => safeUrl(findSch(id).sourceUrl), pick.A.id);
        eq('  원문 링크 한 줄(.doc-legend a)이 그 공고의 원문 주소를 가리킨다',
          c.src.length === 1 && c.src[0].href === want, true);
      } else console.log('  · 원문 주소가 없는 공고라 링크 항목은 건너뜀');

      /* ══ ③ 안내 줄이 체크리스트 항목이 되지 않는다 ══ */
      console.log('\n■ ③ 「원문에서 확인」 안내 줄을 챙길 서류(□ …)로 올리지 않는다');
      eq('  「□ 지원 자격·제출 서류는 원문 공고에서 확인」 이 없다',
        c.text.includes('□ 지원 자격·제출 서류는 원문 공고에서 확인'), false);
      eq('  □ 항목 중 안내 줄이 하나도 없다', c.boxed.filter((t) => PLACEHOLDER_RE.test(t)), []);
      eq('  그래도 제출 서류 이야기는 한다 (자리가 통째로 비지 않는다)', /제출 서류/.test(c.text), true);

      /* ══ ⑥-a 쓸어 닫으면 담기지 않는다 ══ */
      console.log('\n■ ⑥ 확인 없이 닫으면 담기지 않는다 — 아래로 쓸어 닫기');
      await swipeDown(page, '#detail-sheet');
      eq('  쓸어 내리면 시트가 닫힌다', await closedAfter(800), true);
      eq('  신청내역에 없다', await appsOf(pick.A.id), { mem: [], disk: [] });
    }

    /* ══ ④ 확인을 누르면 담긴다 ══ */
    console.log('\n■ ④ 확인을 눌러야 담긴다');
    await open(pick.A.id);
    const r2 = await pressApply();
    eq('  다시 열어 누르면 신청 준비 시트가 또 뜬다', r2.prep, true);
    if (r2.prep) {
      await page.click('#btn-prep-confirm', { timeout: 4000 });
      eq('  확인을 누르면 신청내역에 pending:false 로 담긴다', await appsOf(pick.A.id),
        { mem: [{ pending: false }], disk: [{ pending: false }] });
      /* 확인하면 닫지 않고 **그 공고의 준비 완료 화면**을 연다 (2026-09-23 리뷰 — 메일 접수 버튼·
         제출처·'공식 제출 완료로 기록'이 거기 있다. 닫으면 학생이 공고를 다시 찾아 열어야 했다) */
      await page.waitForTimeout(500);
      eq('  시트가 닫히지 않고 그 공고의 준비 완료 화면이 된다 (다음 할 일이 보인다)', await page.evaluate(() => {
        const b = document.querySelector('#btn-apply-one');
        return {
          open: document.querySelector('#detail-sheet').classList.contains('show'),
          prep: !!document.querySelector('#apply-prep'),
          applied: !!document.querySelector('#detail-sheet .applied-at'),
          btn: b && { label: b.textContent.trim(), disabled: b.disabled },
        };
      }), { open: true, prep: false, applied: true, btn: { label: '신청 준비 완료됨', disabled: true } });
      await page.keyboard.press('Escape');
      await closedAfter(500);
    } else { fail++; console.log('  ✕ 신청 준비 시트가 안 떠 확인 버튼을 누를 수 없다'); }
  }

  /* ══ ② 이어서 — 첨부에 신청서 양식이 있는 공고 ══════════════════════════ */
  console.log('\n■ ② 첨부에 신청서 양식이 있으면 「신청서 양식」 머리 아래 그 파일을 준다');
  if (!pick.B) console.log('  · 첨부에 신청서 양식이 있는 양식 없음 층1 공고가 지금 없어 건너뜀');
  else {
    console.log(`  · 대상: ${pick.B.name} (${pick.B.id})`);
    await open(pick.B.id);
    const r = await pressApply();
    eq('  신청 준비 시트가 뜬다', r.prep, true);
    if (r.prep) {
      const got = await page.evaluate(() => {
        const h = [...document.querySelectorAll('#apply-prep h4')].find((x) => x.textContent.trim().startsWith('신청서 양식'));
        if (!h) return null;
        const ul = h.nextElementSibling;
        return ul && ul.matches('ul') ? [...ul.querySelectorAll('a')].map((a) => ({ name: a.textContent.trim(), href: a.href })) : [];
      });
      eq('  「신청서 양식」 머리가 있다', got !== null, true);
      eq('  그 아래에 공고의 양식 파일 링크가 그대로 있다', got, pick.B.formAtts);
      eq('  아직 신청내역에 없다', await appsOf(pick.B.id), { mem: [], disk: [] });
      await page.keyboard.press('Escape');
      eq('  ESC 로 닫힌다', await closedAfter(600), true);
      eq('  닫아도 신청내역에 없다', await appsOf(pick.B.id), { mem: [], disk: [] });
    }
  }

  /* ══ ⑤ 층2(한국장학재단 목록) — 같은 흐름 ═════════════════════════════════ */
  console.log('\n■ ⑤ 층2 공고도 시트를 먼저 띄운다 · 첨부는 「선발 공고문」 이다');
  eq('마감 전 · 서류 도우미 없음 · 미신청인 층2 공고가 있다 (없으면 이 검사는 무의미하다)', !!pick.C, true);
  if (pick.C) {
    console.log(`  · 대상: ${pick.C.name} (${pick.C.id})`);
    await open(pick.C.id);
    const r = await pressApply();
    eq('  누르면 신청 준비 시트(#apply-prep)가 뜬다', r.prep, true);
    eq('  🔴 그 순간 신청내역에 없다', await appsOf(pick.C.id), { mem: [], disk: [] });
    if (r.prep) {
      const c = await page.evaluate(() => {
        const root = document.querySelector('#apply-prep');
        return {
          heads: [...root.querySelectorAll('h4')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
          boxed: [...root.querySelectorAll('li')].map((l) => l.textContent.trim()).filter((t) => t.startsWith('□')),
          /* KOSAF 첨부 원주소는 Referer 검사라 학생이 못 받는다 (verify-kosaf 와 같은 규칙) */
          kosafDl: [...root.querySelectorAll('a')].filter((a) => /kosaf\.go\.kr.*(download|fileDown|atchFile)/i.test(a.href)).length,
          guide: root.querySelectorAll('.guide-list li').length,
        };
      });
      /* 🔴 재단 첨부는 선발 공고문이다 — '신청서 양식'이라 부르면 학생이 그 안에서 빈칸을 찾는다 */
      eq('  「신청서 양식」 이라고 부르지 않는다', c.heads.some((h) => h.startsWith('신청서 양식')), false);
      if (pick.C.atts) eq('  첨부 머리가 「선발 공고문」 이다', c.heads.some((h) => h.startsWith('선발 공고문')), true);
      else console.log('  · 첨부가 있는 층2 공고가 지금 없어 머리 이름 항목은 건너뜀');
      eq('  「최종 제출 방법」 과 안내 줄이 있다', c.heads.some((h) => h.startsWith('최종 제출 방법')) && c.guide >= 1, true);
      eq('  「재단 공고문에서 확인」 안내 줄을 □ 항목으로 올리지 않는다', c.boxed.filter((t) => PLACEHOLDER_RE.test(t)), []);
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
