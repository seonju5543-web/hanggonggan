/* 층2(한국장학재단 목록) 검증 (2026-08-30 — docs/designs/kosaf-and-narrowing.md ②)
   🔴 개발자 지적 둘로 설계가 바뀌었다 (2026-08-30):
      ① "앱에 하나도 안 뜬다" — 전용 구역이 목록 맨 아래 5,745px 에 있었다
      ② "복붙 수준으로 못생기게 해놨네 · 그냥 교외에 포함시켜줘"
      → 지금은 **교외 공고와 같은 카드**로 나온다(schCard·openDetail 를 그대로 쓴다).
   🔴 그래도 정직함은 지켜야 한다 — KOSAF 는 재단이 적어 둔 칸이지 우리가 읽은 원문이 아니다:
        · 금액을 합계에 넣지 않는다(amountValue 0)
        · 양식 작성이 붙지 않는다
        · 상세 시트가 출처를 밝힌다
        · 첨부(선발공고문) 주소가 화면에 없다 — Referer 검사라 학생이 못 받는다
   실행: node verify/verify-kosaf.js   (CHROME_PATH + PORT) */
const { chromium } = require('playwright-core');
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

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.addInitScript((p) => localStorage.setItem('handaejang.v1',
    JSON.stringify({ profile: p, applications: [] })), PROFILE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 8000 });
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {}); else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(2000);

  console.log('■ 교외 공고와 같은 모양으로 나온다');
  const info = await page.evaluate(() => {
    const all = allScholarships().filter((s) => s.sourceKind === 'kosaf');
    const ids = [...document.querySelectorAll('#explore-list .sch-card')].map((e) => e.dataset.detail);
    const shown = ids.filter((id) => id.startsWith('kosaf-'));
    return {
      made: all.length,
      shown: shown.length,
      first: shown[0] || null,
      allExternal: all.every((s) => s.type === '교외'),
      hasSpec: all.filter((s) => s.amountSpec).length,
      /* 원문에 숫자가 없는데 값이 잡혔으면 지어낸 것이다 */
      inventedAmount: all.filter((s) => s.amountValue > 0 && !/\d/.test(s.amount)).length,
      withExcl: all.filter((s) => s.exclusivity && s.exclusivity.kind).length,
      amtRead: all.filter((s) => s.amountValue > 0).length,
      amtRatio: all.filter((s) => s.amountSpec && s.amountSpec.kind === 'ratio').length,
      noForm: all.every((s) => !s.formId && !s.prepFormId),
      withElig: all.filter((s) => (s.eligibilityLines || []).length).length,
      closedShown: shown.filter((id) => dday(allScholarships().find((s) => s.id === id).deadline).days < -7).length,
    };
  });
  eq(`한국장학재단 등록분이 카드로 만들어진다 (${info.made}곳)`, info.made > 0, true);
  eq('  전부 교외로 들어간다', info.allExternal, true);
  eq('  교외 목록에 실제로 섞여 나온다', info.shown > 0, true);
  eq('  같은 카드(.sch-card)를 쓴다 — 전용 마크업이 없다',
    await page.$$eval('#explore-list [data-kosaf], .filter-chip[data-filter="kosaf"]', (e) => e.length), 0);
  eq(`  자격 줄을 재단 글자 그대로 갖고 있다 (${info.withElig}곳)`, info.withElig > 0, true);
  eq('  마감 지난 것이 섞이지 않는다', info.closedShown, 0);

  console.log('\n■ 🔴 적합도는 판정한 만큼만 말한다');
  /* ⚠️ 한때 한국장학재단 등록분을 **무조건 '자격 미확인'** 으로 눌러 뒀다. 지역 요건(83곳)을
     판정할 수 없어 서울 학생에게 안양시 장학금이 95%로 뜨던 때의 임시 조치였다.
     시·군을 받은 뒤로는 그 눌림이 오히려 거짓말이라 걷어냈다 — 이제 셋으로 갈린다.
     🔴 지키는 것은 하나: **지역이 안 맞는데 '적합'이라고 말하지 않는다.** */
  const verdicts = await page.evaluate(() => {
    const ms = getMatches().filter((m) => m.sch.sourceKind === 'kosaf');
    const by = {}; ms.forEach((m) => { const v = fitVerdict(m.fit, m.fd); by[v] = (by[v] || 0) + 1; });
    const okWrongCity = ms.filter((m) => fitVerdict(m.fit, m.fd) === 'ok')
      .filter((m) => (m.sch.eligibilityLines || []).some((l) => {
        const c = (l.match(/([가-힣]{1,6}(?:시|군|구))[에의]\s?(주소|주민등록|거주)/) || [])[1];
        return c && c !== state.profile.regionCity && c !== state.profile.parentRegionCity;
      })).map((m) => m.sch.name.slice(0, 30));
    return { by, okWrongCity };
  });
  eq(`판정이 셋으로 갈린다 (${JSON.stringify(verdicts.by)})`,
    Object.keys(verdicts.by).length >= 2, true);
  eq('사는 시·군이 아닌 곳의 장학금을 「적합」이라고 하지 않는다', verdicts.okWrongCity, []);

  console.log('\n■ 🔴 「받을 수 있다」고 세지 않는다');
  /* 자격을 확인 안 한 것을 합계에 더하면 기망이다. evaluate 는 KOSAF 를 `selective`
     (선발형 = 신청 가능)로 읽어서, 실측 홈 합계가 **2억 2,420만원**으로 부풀고
     일괄 신청 준비 118건 중 **104건이 KOSAF** 였다(앱이 준비해 줄 수도 없는 것들). */
  const reach = await page.evaluate(() => ({
    bulk: bulkTargets().filter((s) => s.sourceKind === 'kosaf').length,
    applyable: getMatches().filter((m) => m.sch.sourceKind === 'kosaf'
      && ['eligible', 'selective'].includes(m.result.status)).length,
    stillListed: getMatches().filter((m) => m.sch.sourceKind === 'kosaf').length,
  }));
  eq('일괄 신청 준비에 안 들어간다', reach.bulk, 0);
  eq('  홈 합계가 세는 「신청 가능」에도 안 들어간다', reach.applyable, 0);
  eq('  그래도 탐색 목록에는 그대로 남는다 (숨기는 게 아니다)', reach.stillListed > 0, true);

  console.log('\n■ 상세 시트');
  await page.click(`#explore-list [data-detail="${info.first}"]`);
  await page.waitForSelector('#detail-sheet.show', { timeout: 4000 });
  await page.waitForTimeout(300);
  const sheet = await page.$eval('#detail-sheet', (e) => e.textContent);
  eq('출처를 밝힌다 (재단이 한국장학재단에 등록한 정보)', /한국장학재단에 등록한 정보/.test(sheet), true);
  eq('  자격 판정·신청서를 안 해 준다고 밝힌다', /자격 판정과 신청서 작성은 지원하지 않아요/.test(sheet), true);
  eq('  「앱에서 작성」 버튼이 없다',
    await page.$$eval('#detail-sheet button', (b) => b.filter((x) => /양식|작성하기/.test(x.textContent)).length), 0);
  /* 🔴 KOSAF 첨부는 Referer 검사가 있어 앱에서 누르면 "비정상적인 접근"이 뜬다 */
  eq('KOSAF 첨부 내려받기 주소가 화면에 없다',
    await page.$$eval('#detail-sheet a', (a) => a.filter((x) => /kosaf\.go\.kr.*(download|fileDown|atchFile)/i.test(x.href)).length), 0);

  console.log('\n■ 🔴 원문을 그대로 쏟아 붓지 않는다 (2026-08-30 개발자 지적)');
  /* 지적 넷: `💡 undefined` · `○` 머리 기호 · `특정자격:` 칸 이름 접두어 ·
     혜택 자리에 원문 문단 통째. 전부 "원문 그대로"를 게으름의 핑계로 쓴 것이었다. */
  const clean = await page.evaluate(() => {
    const t = document.querySelector('#detail-sheet').innerText;
    const ks = allScholarships().filter((s) => s.sourceKind === 'kosaf');
    return {
      undef: /undefined/.test(t),
      sym: /[○ㅇ※]/.test(t),
      labelPrefix: ks.filter((s) => (s.eligibilityLines || [])
        .some((l) => /^(특정자격|학년구분|학과구분|대학구분|성적기준|소득기준|지역거주구분)\s*:/.test(l))).length,
      longAmount: ks.filter((s) => s.amount.length > 42).length,
      dumpLine: ks.filter((s) => (s.eligibilityLines || []).some((l) => /대학\d학기 대학\d학기/.test(l))).length,
      contradiction: /앱에서 바로 작성할 수 있어요/.test(t),
    };
  });
  eq('💡 undefined 가 안 뜬다', clean.undef, false);
  eq('  ○ ㅇ ※ 머리 기호를 떼고 보여 준다', clean.sym, false);
  eq('  자격 요건에 칸 이름(`특정자격:`)을 붙이지 않는다', clean.labelPrefix, 0);
  eq('  요건 자리에 코드 나열(`대학2학기 대학3학기…`)을 넣지 않는다', clean.dumpLine, 0);
  eq('  혜택은 한 줄로 짧게 말한다 (원문 문단을 통째로 안 쓴다)', clean.longAmount, 0);
  /* 🔴 바로 위에서 "신청서 작성은 지원하지 않아요"라고 해 놓고 아래에서
     "앱에서 바로 작성할 수 있어요"가 같이 떠 있었다 — 한 시트 안에서 말이 엇갈렸다. */
  eq('  같은 시트 안에서 말이 엇갈리지 않는다', clean.contradiction, false);
  /* 🔴 카드와 시트가 **같은 글자**를 말해야 한다 — 한쪽만 고쳐 카드는 「자격 미확인」인데
     시트는 「적합도 25% · 요건 4개 중 1개 충족」이었다(개발자가 눌러 보고 잡았다).
     화면에 실제로 그려진 두 배지를 견준다 — 함수를 견주면 렌더가 갈라져도 못 잡는다. */
  /* 🔴 **글자가 같기를 요구하지 않는다** (2026-08-31 수리).
     2026-08-30 부터 카드는 짧게(`적합도 67%`), 상세는 전부(`… 요건 3개 중 2개 충족 ·
     확인 필요 1`) 보여 주도록 **일부러** 갈라 놓았다(fitBadgeHtml 의 `{full:true}`).
     그런데 이 검사는 두 글자가 똑같기를 요구해서 그날부터 **main 이 빨간불**이었다.
     지켜야 할 뜻은 그대로다 — 원래 잡으려던 사고는 "카드는 「자격 미확인」인데 상세는
     「적합도 25%」" 처럼 **판정이 갈라지는 것**이지 글자 수가 다른 것이 아니다.
     그래서 ①판정 갈래 ②퍼센트 숫자 둘만 견준다. */
  eq('카드와 상세가 같은 적합도를 말한다', await page.evaluate(async () => {
    const card = document.querySelector('#explore-list [data-detail^="kosaf-"]');
    if (!card) return 'no-card';
    const read = (root) => {
      const el = root.querySelector('.badge-fit, .badge-fit-unknown, .badge-fit-no');
      if (!el) return { kind: 'none', pct: null };
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      const kind = el.className.includes('badge-fit-no') ? 'no'
        : el.className.includes('badge-fit-unknown') ? 'unknown' : 'ok';
      return { kind, pct: (t.match(/적합도 (\d+)%/) || [])[1] || null };
    };
    const onCard = read(card);
    openDetail(card.dataset.detail);
    await new Promise((r) => setTimeout(r, 250));
    const onSheet = read(document.querySelector('#detail-sheet'));
    if (onCard.kind !== onSheet.kind) return `판정 갈림: ${onCard.kind} / ${onSheet.kind}`;
    if (onCard.pct !== onSheet.pct) return `퍼센트 갈림: ${onCard.pct} / ${onSheet.pct}`;
    return 'same';
  }), 'same');

  console.log('\n■ 데이터');
  const data = await page.evaluate(() => ({
    n: kosafList.length,
    loan: kosafList.filter((i) => /연\s?이율|상환기간|대여한도|대부/.test(i.fields['지원금액'] || '')).length,
    badHome: kosafList.filter((i) => i.home && !/^https?:\/\//.test(i.home)).length,
    noDue: kosafList.filter((i) => !i.due).length,
  }));
  eq(`대여(대출) 상품이 섞이지 않았다 (${data.n}곳)`, data.loan, 0);
  eq('주소가 http(s) 가 아닌 것이 없다 (콜론 빠진 원본을 그대로 넘기면 우리 사이트로 간다)', data.badHome, 0);
  eq('마감일 칸이 비어도 버리지 않는다', data.noDue > 0, true);

  eq('콘솔 오류 없음', errors, []);
  await browser.close();
  console.log(fail ? `\n✕ 실패 ${fail}건` : '\n✓ 한국장학재단 등록분 검증 통과');
  process.exit(fail ? 1 : 0);
})();
