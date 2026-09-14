/* 관리자 화면이 앱1과 **같은 모양**인가 — 2026-09-14 신설
   ═══════════════════════════════════════════════════════════════════════════
   개발자 지시 *"디자인 측면에서 전혀 바뀌지 않은 것 같아. 앱1의 디자인 체계를 따라줘"*.

   🔴 왜 관문이 하나 더 필요했나 (이 사고의 핵심):
      2026-09-13 에 `_admin/admin.css` 의 `:root` 를 앱1 실효값으로 옮겼고,
      `verify/ui-tone.mjs` ⑧ 이 **토큰 53개가 같다**고 초록불을 줬다.
      그런데 화면은 하나도 안 바뀌어 보였다 — 컴포넌트가 같은 토큰을 **다른 단계**로
      쓰고 있었기 때문이다(모서리 9px vs 앱1 13~19px · 으뜸 버튼 밝은 파랑 vs 잉크 남색 ·
      그림자 없음 vs --shadow-btn · 굵기 600 vs 700 · 목록이 테두리 친 상자 vs 앱1 은 상자 없음).
      **값이 같은 것과 모양이 같은 것은 다른 일이다.** ui-tone ⑧ 은 값만 세므로 이것을 못 본다.

   🔴 그래서 이 관문은 **글자를 읽지 않고 그려 놓고 잰다.**
      두 CSS 를 각각 최소 HTML 에 넣어 브라우저가 계산한 값을 받아, 짝지은 컴포넌트끼리 댄다.
      (앱1 은 `:root` 도 규칙도 여러 벌 겹쳐 쓴다 — 마지막에 이긴 값은 브라우저만 안다.
       실제로 `.sch-card` 는 앞쪽에 19px 모서리 규칙이 있지만 **실효값은 모서리 0 · 투명 ·
       아래 1px 선**이다. 글자만 읽으면 정반대로 읽는다.)

   ⚠️ 일부러 대지 않는 것: **글자 크기와 여백**. 관리자는 목록을 훑는 도구라 앱1 척도에서
      한 단 위를 쓰기로 개발자가 정했다(2026-09-13). 크기까지 같게 만들면 그 결정이 깨진다.

   실행: CHROME_PATH=... node verify/verify-admin-shape.js        (서버 · 포트 필요 없다) */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail += 1;
  console.log(`  ${ok ? '✓' : '✕'} ${name}${ok ? '' : `\n      받은 값 ${JSON.stringify(got)} / 앱1 ${JSON.stringify(want)}`}`);
};

/* 짝 — [관리자 표본 이름, 앱1 표본 이름, 볼 것들]
   ⚠️ `btn ↔ btn` 은 **모양만** 댄다 — 관리자의 기본 버튼은 흰 면 + 1px 테두리라
      앱1 `.btn-outline` 에 해당한다(앱1 `.btn` 은 면도 테두리도 없다). 일부러 면을 안 댄다.
   ⚠️ 글자 크기와 여백은 어디서도 대지 않는다 — 관리자는 앱1 척도에서 한 단 위를 쓰기로
      개발자가 정했다(2026-09-13). */
const PAIRS = [
  ['btn',       'btn',       ['borderRadius', 'fontWeight', 'fontFamily']],
  ['btnPrimary', 'btnPrimary', ['borderRadius', 'backgroundColor', 'boxShadow']],
  ['btnSm',     'btnSm',     ['borderRadius']],
  ['chip',      'chip',      ['borderRadius', 'borderTopWidth', 'fontWeight']],
  /* 🔴 **켜진 칩까지 댄다** — 2026-09-14 에 여기가 비어 있어서, 이 파일이 초록불인 채로
     개발자가 정한 값(Apple 7번 · style.css:4295)이 관리자에서만 옛 값으로 되돌아가 있었다.
     상태(:hover·:active·.on)를 안 대면 '모양 관문'이라는 이름이 절반만 참이 된다. */
  ['chipOn',    'chipOn',    ['borderRadius', 'backgroundColor', 'borderTopColor', 'color', 'boxShadow']],
  ['pill',      'badge',     ['borderRadius']],
  ['empty',     'empty',     ['borderRadius', 'backgroundColor', 'borderTopWidth']],
  ['row',       'schCard',   ['borderRadius', 'backgroundColor', 'borderBottomWidth', 'borderTopWidth']],
  ['input',     'input',     ['borderRadius']],
  ['textarea',  'textarea',  ['borderRadius']],
];

/* 누름 반응 — 같은 비율이어야 한다 (앱1 Apple 20번 · style.css:4306).
   🔴 **마우스로 재지 말 것** — page.hover() 는 :hover 를 같이 켜므로 :active 를 지워도
   초록불이 난다(CLAUDE.md 2026-09-12 '누를 때의 표시' 절과 같은 함정).
   CDP 로 :active 만 켜서 잰다. */
const PRESSED = [['btn', 'btn'], ['chip', 'chip']];

/* 표본 — 두 CSS 가 같은 뜻으로 쓰는 것끼리 짝짓는다 */
const ADMIN_HTML = `
  <button id="btn" class="btn">a</button>
  <button id="btnPrimary" class="btn btn-primary">a</button>
  <button id="btnSm" class="btn btn-sm">a</button>
  <button id="chip" class="chip">a</button>
  <button id="chipOn" class="chip on">a</button>
  <span id="pill" class="pill">a</span>
  <div id="empty" class="empty">a</div>
  <div class="rows"><div id="row" class="row">a</div><div class="row">b</div></div>
  <div id="rowsBox" class="rows"></div>
  <div id="card" class="card">a</div>
  <input id="input" type="text"><textarea id="textarea"></textarea>`;
const APP1_HTML = `
  <div class="app"><div class="screen">
  <button id="btn" class="btn">a</button>
  <button id="btnPrimary" class="btn btn-primary">a</button>
  <button id="btnSm" class="btn btn-sm">a</button>
  <button id="chip" class="chip">a</button>
  <button id="chipOn" class="chip active">a</button>
  <span id="badge" class="badge">a</span>
  <div id="empty" class="empty">a</div>
  <button id="schCard" class="sch-card">a</button>
  <div id="cardList" class="card-list"></div>
  <input id="input" type="text"><textarea id="textarea"></textarea>
  </div></div>`;

/* ⚠️ `fontFamily` 는 **글꼴 스택이 갈라지지 않았는가**만 본다 — 그 글꼴이 실제로 내려받아졌는지는
   여기서 못 잰다(두 표본 다 링크 없이 그리고, 이 샌드박스는 그 CDN 이 막혀 있다).
   '같은 주소로 싣는가 · CSP 가 허용하는가'는 `verify/ui-tone.mjs` ④ 가 본다. */
const PROPS = ['borderRadius', 'backgroundColor', 'color', 'fontWeight', 'fontFamily', 'boxShadow',
  'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderTopColor'];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const read = async (css, html) => {
    const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${html}`);
    const out = await page.evaluate((props) => {
      const r = {};
      for (const el of document.querySelectorAll('[id]')) {
        const c = getComputedStyle(el);
        const o = {};
        for (const p of props) o[p] = c[p];
        r[el.id] = o;
      }
      /* 🔴 모서리 토큰은 **글자로 읽지 않는다** — 이 파일 머리말이 그렇게 적어 놓고
         예전엔 여기서만 정규식으로 첫 선언을 집었다(겹쳐 쓰는 집에서는 언제든 깨진다). */
      const rs = getComputedStyle(document.documentElement);
      r.__radii = Object.fromEntries(['--radius-xs', '--radius-sm', '--radius', '--radius-lg', '--radius-pill']
        .map((k) => [k, rs.getPropertyValue(k).trim()]));
      return r;
    }, PROPS);

    /* 누름(:active) 은 CDP 로만 켠다 */
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    for (const [, id] of [['', 'btn'], ['', 'chip']]) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#${id}` });
      if (!nodeId) continue;
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      await page.waitForTimeout(250);   // 전환이 끝난 뒤에 잰다
      out[`${id}:active`] = { transform: await page.evaluate((x) => getComputedStyle(document.querySelector(`#${x}`)).transform, id) };
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      await page.waitForTimeout(250);
    }
    await page.close();
    return out;
  };
  const adm = await read(R('_admin/admin.css'), ADMIN_HTML);
  const app = await read(R('style.css'), APP1_HTML);
  await browser.close();

  console.log('■ 관리자 화면이 앱1과 **같은 모양**인가 (그려 놓고 잰다 · 2026-09-14)');
  /* 🔴 표본을 못 찾으면 조용히 통과하지 않는다 — 이 저장소가 겪은 '무력해진 검사' 유형이다 */
  for (const [a, b] of PAIRS) {
    if (!adm[a]) { console.log(`  ✕ 관리자 표본 없음: ${a}`); fail += 1; }
    if (!app[b]) { console.log(`  ✕ 앱1 표본 없음: ${b}`); fail += 1; }
  }
  if (fail) { console.log(`\n✕ 실패 ${fail}건 — 표본을 못 읽었습니다`); process.exit(1); }

  for (const [a, b, props] of PAIRS) {
    const got = Object.fromEntries(props.map((p) => [p, adm[a][p]]));
    const want = Object.fromEntries(props.map((p) => [p, app[b][p]]));
    eq(`${a} ↔ 앱1 ${b}`, got, want);
  }

  /* 목록 **상자**가 되살아나지 않았는가 — 앱1 의 목록 그릇(.card-list)은 테두리도 모서리도 없다 */
  console.log('\n■ 목록에 상자를 두르지 않는다 (앱1 은 줄 사이 1px 선 하나로 가른다)');
  eq('목록 그릇에 테두리가 없다', adm.rowsBox.borderTopWidth, app.cardList.borderTopWidth);
  eq('목록 그릇에 모서리가 없다', adm.rowsBox.borderRadius, app.cardList.borderRadius);

  /* 누름 반응 — 앱1과 같은 비율인가 */
  console.log('\n■ 누르면 앱1과 같은 비율로 들어간다 (:active · CDP 로만 켠다)');
  for (const [a, b] of PRESSED) {
    eq(`${a}:active 의 transform`, adm[`${a}:active`], app[`${b}:active`]);
  }

  /* 관리자만의 확장은 값을 대지 않고 **앱1 어휘 안인지**만 본다 */
  console.log('\n■ 관리자 확장(요약 카드)도 앱1 어휘 안에 있다');
  eq('요약 카드 모서리가 앱1 모서리 여섯 단 안에 있다',
    Object.values(app.__radii).includes(adm.card.borderRadius), true);
  eq('요약 카드에 테두리를 두르지 않는다 (앱1 은 면으로 세운다)', adm.card.borderLeftWidth, '0px');

  console.log(fail ? `\n✕ 실패 ${fail}건 — 앱1과 모양이 갈라졌습니다` : '\n✓ 모양 관문 전부 통과');
  process.exit(fail ? 1 : 0);
})();
