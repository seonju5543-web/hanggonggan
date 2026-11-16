/* 학생 화면에 '모름'류 글자가 없다 — 진짜 브라우저 전수 (2026-11-15 · 개발자 결정 11-02)
   개발자 결정(2026-11-02): *"'모름' 같은 말이 앱에 보이면 신뢰가 떨어진다"* → 학생 화면에서 모르는 것을 말하는 글자를 전부 뺀다.
   방법은 정해져 있다 — 원문에서 값을 채우고, 원문에 정말 없으면 **아무것도 그리지 않는다**(지어내지 않는다 · 틀린 미달을 만들지 않는다).

   무엇을 재나 — 열린 정식 등록 공고(층1) 전부 + 층2 재단 줄 전부를 **앱 함수 그대로** 그린다:
     ① 카드(schCard) ② 상세 시트(openDetail → #detail-sheet) ③ 신청 준비 문서 머리말(지원문서 lead·tag·제출 안내 — prepKindFor 가 고른다)
     ④ 카드·시트 밖의 자리(2026-11-16 리뷰) — 달력·MY 저장 줄(calRowHtml) · 금액 상세 한 줄(amountDetailRow) · 신청 내역 「선정」 줄과 제출처 줄(선정으로 적어 둔 시트) ·
        지원서 초안 학업 계획(generateEssay plan) · 그리고 링크 확인 장부(data/link-check.json)가 문제로 적은 주소의 이름(게시판·소식 카드 · 도우미 · 활동)
   그리고 그 글자에서 「모름 · 미확인 · 원문 확인 · 원문에서 확인 · 확인 필요 · 기한 확인 중 · 정보 입력 필요」 와
   맨 앞 「?」 판정 표시를 센다. 하나라도 있으면 빨간불(어느 공고의 어느 자리인지 찍는다).
   🔴 규칙을 베끼지 않는다 — 앱을 띄워 그 함수를 부른다(what-shows.mjs 와 같은 원칙). 학생은 그 공고 학교 학생으로 둔다(학교 한정 공고는 그 학교 학생에게만 보인다).
   🔴 **실데이터를 잰다** — 그래서 test-collector(관문 「학생 화면에 '모름'류 글자가 없다」)에는 표본만 두고 이것은 verify-ui.yml 에서 돈다.
   실행: python3 -m http.server <포트> 를 이 워크트리에서 띄운 뒤  CHROME_PATH=... PORT=<포트> node verify/verify-no-unknown.js [--json=<파일>] [--show=<n>] */
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { assertOwnServer } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;
const arg = (k) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : null; };

/* 셀 낱말 — 관문(test-collector)과 같은 목록을 쓴다(베끼지 않는다) */
const { unknownHits } = require('./no-unknown-words.cjs');

const BASE = {
  name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
  year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울',
  regionCity: '강서구', parentRegionCity: '강서구', nationality: 'korean', birthYear: 2004, flags: [], cert: false, exchange: false, common: {},
};

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.addInitScript((p) => {
    localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [] }));
    localStorage.removeItem('handaejang.resume');
  }, BASE);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-home:not([hidden])', { timeout: 10000 });
  await page.waitForFunction(() => appsData.registered === 'ok' && appsData.kosaf !== 'wait', null, { timeout: 20000 });

  const out = await page.evaluate(({ base }) => {
    const textOf = (html) => { const d = document.createElement('div'); d.innerHTML = html; d.querySelectorAll('li, p, h3, h4, span.badge, .sch-amount, .sch-due').forEach((e) => e.insertAdjacentText('afterbegin', '\n')); return d.innerText || d.textContent; };
    const open = (s) => !s.deadline || dday(s.deadline).days >= 0;
    const rows = [];
    const keep = state.profile;
    const one = (s, p, where) => {
      state.profile = p;
      const result = evaluateFor(s, p), fit = fitScore(s, result, p), fd = fitDetailFor(s, p);
      const parts = {};
      /* ① 카드 — 홈·탐색이 실제로 그리는 공고만(결정 1: 기한·자격을 다 모르는 정식 공고는 카드가 아니라 게시판 글로 간다) */
      const listed = getMatches().some((m) => m.sch.id === s.id);
      /* 결정 1 — 카드에서 빠진 정식 공고는 게시판 새 공고(제목+링크)에 있어야 한다(사라지면 안 된다) */
      parts.inFeed = !listed && where === 'registered' ? boardNoticesForMe().some((n) => n.url === s.sourceUrl || String(n.url).startsWith(s.sourceUrl) || String(s.sourceUrl).startsWith(n.url)) : null;
      parts.card = listed ? textOf(schCard(s, result, { fit, fd })) : '';
      /* ② 상세 시트 */
      openDetail(s.id);
      const sh = document.querySelector('#detail-sheet');
      sh.querySelectorAll('li, p, h3, h4, span.badge').forEach((e) => e.insertAdjacentText('afterbegin', '\n'));
      parts.sheet = sh ? sh.innerText : '';
      try { closeSheet(); } catch (e) { /* 시트가 안 열렸으면 닫을 것도 없다 */ }
      /* ③ 신청 준비 문서 머리말 — 앱 지원문서를 붙이는 그 함수로(attachPrepTemplate) */
      try {
        const c = JSON.parse(JSON.stringify(s));
        attachPrepTemplates([c]);
        const id = formTplIdFor(c);
        const tpl = id && FORM_TEMPLATES[id];
        parts.prep = tpl && tpl.unofficial ? [tpl.lead, tpl.tag, ...(tpl.sections || []).map((x) => x.note || '')].filter(Boolean).join('\n') : '';
      } catch (e) { parts.prep = ''; }
      /* ④ 달력 하루 목록·MY 저장 줄은 같은 calRowHtml 이다(저장 단추까지) · 금액 상세 한 줄 · 초안 학업 계획 */
      parts.cal = textOf(calRowHtml(s, { save: true }));
      parts.amount = textOf(amountDetailRow({ ref: s, won: s.amountValue || 0, mergedFrom: [] }, {}));
      try { parts.essay = generateEssay({ kind: 'plan' }, s, p, { goal: '전공 공부를 이어가겠습니다', career: '연구자' }, {}); } catch (e) { parts.essay = ''; }
      /* 신청 내역 — 선정으로 적어 둔 시트(「선정 · 금액」 줄 · 「최종 제출처」 줄) */
      const keepApps = state.applications;
      state.applications = [{ id: s.id, appliedAt: '2026-11-01', submittedAt: '2026-11-02', result: 'won', resultAt: '2026-12-10' }];
      try {
        openDetail(s.id);
        const w = document.querySelector('#detail-sheet');
        parts.won = w ? [...w.querySelectorAll('.progress-note, .applied-at')].map((e) => e.innerText).join('\n') : '';
        parts.wonSeen = /2026-12-10 선정/.test(parts.won);
        try { closeSheet(); } catch (e) { /* 안 열렸으면 닫을 것도 없다 */ }
      } catch (e) { parts.won = ''; }
      state.applications = keepApps;
      rows.push({ id: s.id, name: s.name, where, listed, parts });
    };
    const reg = registeredList.filter((s) => open(s) && notStale(s));
    for (const s of reg) {
      const e = s.eligibility || {};
      const sch = e.schoolOnly || (e.schoolsAny && String(e.schoolsAny[0]).split('|')[0]) || base.school;
      one(s, { ...base, school: sch, campus: e.campusOnly || '' }, 'registered');
    }
    state.profile = base;
    const kos = kosafAsScholarships().filter(open);
    for (const s of kos) one(s, base, 'kosaf');
    /* data.js 의 상시 제도·국가 공고도 같은 카드·시트로 나온다 */
    const nat = NATIONAL_SCHOLARSHIPS.filter(open);
    for (const s of nat) one(s, base, 'national');
    /* 링크 확인 장부가 문제로 적은 주소(trouble) — 이름이 보이는 자리(게시판·소식 카드 · 도우미 · 활동 시트 단추)를 그 주소로 그린다.
       장부에 문제 주소가 하나도 없는 날도 갈래가 그려지게 표본 한 줄을 장부에 더했다가 되돌린다(헛돌지 않게) */
    const SAMPLE = 'https://www.example.ac.kr/bbs/view.do?id=verify-no-unknown';
    const realChecks = typeof LINK_CHECKS === 'object' ? { ...LINK_CHECKS } : {};
    setLinkChecks({ updatedAt: 't', bad: { ...realChecks, [SAMPLE]: { v: 'gone', at: '2026-11-16' } } });
    const troubleUrls = Object.keys(realChecks).filter((u) => ['login', 'gone', 'other'].includes(realChecks[u].v)).concat(SAMPLE);
    for (const u of troubleUrls) {
      const n = { title: '표본 글', url: u, school: base.school, foundAt: '2026-11-16' };
      const parts = { card: textOf(noticeCardHtml(n, {})), chat: ['chat', 'activity', 'activityButton', 'detail', 'amount', 'applog'].map((w) => sourceLink(n, w).label).join('\n') };
      rows.push({ id: u, name: '문제 주소', where: 'trouble', listed: false, parts });
    }
    setLinkChecks({ updatedAt: 't', bad: realChecks });
    state.profile = keep;
    return { rows, reg: reg.length, kosaf: kos.length, nat: nat.length, trouble: troubleUrls.length, wonSeen: rows.filter((r) => r.parts.wonSeen).length };
  }, { base: BASE });
  for (const r of out.rows) {
    r.hit = {}; r.sample = {};
    for (const k of ['card', 'sheet', 'prep', 'cal', 'amount', 'essay', 'won', 'chat']) {
      const h = unknownHits(r.parts[k]);
      if (Object.keys(h).length) { r.hit[k] = h; r.sample[k] = String(r.parts[k]).split('\n').filter((l) => Object.keys(unknownHits('\n' + l)).length).slice(0, 4); }
    }
  }

  const tally = {};
  const bad = out.rows.filter((r) => Object.keys(r.hit).length);
  for (const r of bad) for (const [k, h] of Object.entries(r.hit)) for (const [w, n] of Object.entries(h)) {
    const key = `${r.where}·${k}·${w}`; tally[key] = (tally[key] || 0) + n;
  }
  const listed = out.rows.filter((r) => r.where === 'registered' && r.listed).length;
  /* 결정 1 — 카드에서 뺀 공고가 게시판 새 공고에도 없으면 학생은 그 공고를 영영 못 본다 */
  const lost = out.rows.filter((r) => r.where === 'registered' && !r.listed && r.parts.inFeed === false);
  for (const r of lost) console.log(`   ✕ 카드에서 뺐는데 게시판 새 공고에도 없다 — ${r.id} ${String(r.name).slice(0, 40)}`);
  console.log(`■ 학생 화면 '모름'류 글자 전수 — 열린 정식 등록 ${out.reg}건(카드로 뜨는 것 ${listed} · 게시판 글로 가는 것 ${out.reg - listed}) · 층2 ${out.kosaf}줄 · 상시 제도·국가 ${out.nat}건 · 문제 주소 ${out.trouble}곳`);
  console.log(`   (카드·시트 밖) 달력·저장 줄 · 금액 상세 · 초안 학업 계획 · 신청 내역 선정 줄(그려진 것 ${out.wonSeen}건) · 문제 주소 이름(카드·도우미·활동)`);
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`   ${k}  ${n}`);
  const show = Number(arg('show') || 6);
  for (const r of bad.slice(0, show)) console.log(`   ✕ ${r.id} ${String(r.name).slice(0, 40)} — ${JSON.stringify(r.sample).slice(0, 300)}`);
  if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(out, null, 1));
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  /* 헛돌지 않는다 — 선정 줄을 하나도 못 그렸으면(시트 모양이 바뀌었다) 이 자리는 재지 못한 것이다 */
  if (!out.wonSeen) console.log('   ✕ 신청 내역 「선정」 줄을 한 건도 못 그렸다 — 시트 모양이 바뀌었는지 볼 것(무력해진 검사)');
  const ok = bad.length === 0 && !lost.length && !errors.length && out.reg > 0 && out.wonSeen > 0;
  console.log(ok ? `  ✓ 공고 ${out.rows.length}건 화면 어디에도 '모름'류 글자가 없다` : `  ✕ '모름'류 글자가 남은 공고 ${bad.length}건${errors.length ? ` · 페이지 오류 ${errors.length}` : ''}${out.reg ? '' : ' · 정식 등록을 하나도 못 읽었다(무력해진 검사)'}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
