/* 유료 카드 읽기 결과가 화면에 그대로 실리는가 (2026-11-15 · 설계 docs/designs/paid-card-reading.md)

   무엇을 재나: `data/card-read.json` 에 실린 공고는 **유료 결과만** 보이고(무료 길의 번호·끊긴 줄·자격 아닌 줄이 남지 않는다),
   그 파일에 없는 공고는 무료 길 값 그대로(비상망)인가. 판정(✓·✕)은 유료 줄에도 엔진이 그대로 붙이는가.

   🔴 표본은 여기 적은 가짜 공고다 — 실데이터·마감에 안 기댄다(공고 목록과 결과 파일을 page.route 로 넣는다).
   실행: 이 워크트리에서 `python3 -m http.server <포트>` 를 띄운 뒤
         CHROME_PATH=... PORT=<포트> node verify/verify-card-read.js */
const { chromium } = require('playwright-core');
const { assertOwnServer, dismissNotify } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;

let pass = 0; const fails = [];
const ok = (label, cond, got) => { if (cond) { pass += 1; console.log(`  ✓ ${label}`); } else { fails.push(label); console.log(`  ✕ ${label}${got !== undefined ? ` — ${typeof got === 'string' ? got : JSON.stringify(got)}` : ''}`); } };

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const PROFILE = { name: '김한장', school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과', year: 3, status: '재학', gpa: 3.5, bracket: 5, credits: 15,
  region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {} };
/* 무료 길이 읽은 모습 — 번호가 남고, 선발 인원이 자격 자리에 있고, 접수 시작일이 마감이다 */
/* ⚠️ 제목에 기관명을 넣지 않는다 — 앱은 제목에 이미 있는 기관명을 윗줄에서 뺀다(cardProviderLine) */
const ITEM = { id: 'zz-card-read', name: '[교외] 2026년 2학기 장학생 선발 안내', type: '교외', provider: '주관 기관 원문 확인', amount: '금액 원문 확인', amountValue: 0,
  deadline: day(3), period: `접수 ~${day(3)}`, summary: '', eligibility: { selective: true, schoolOnly: '한국외국어대학교' }, duplicable: true, note: '',
  documents: ['6) 지원서 접수방법 : 표본장학회 홈페이지 온라인신청'], attachments: [], sourceUrl: 'https://example.org/notice/1', sourceKind: 'official', listedAt: day(-2),
  eligibilityLines: ['대학생 200명 내외 (휴학생 제외)', '가. 직전 학기 평점 3.0 이상을 취득하고,'], excerpts: ['3) 장학금 지급 금액 : 연간 300만원'] };
const OTHER = { ...ITEM, id: 'zz-free-only', name: '[교외] 무료길장학회 장학생 선발 안내', sourceUrl: 'https://example.org/notice/2' };
const CR = { title: '2026년 2학기 장학생 선발 안내', host: '재단법인 표본장학회',
  eligibility: ['직전 학기 평점 3.0 이상을 취득한 자', '학자금 지원구간 3구간 이내인 자'], excludes: ['휴학생', '타 장학금 4회 이상 수혜자'], priority: [],
  amount: ['연간 300만원'], head: 3000000, deadline: { date: day(11), quote: '접수 기간' }, apply: ['표본장학회 홈페이지 온라인신청', '방문 접수는 받지 않음', '접수 후 접수 여부 확인 필요'],
  documents: ['장학금 지원서 1부', '성적증명서 1부'], notes: ['타 장학금과 중복수령 불가', '신청일시가 조회되는지 반드시 확인할 것. 미확인에 따른 불이익은 책임지지 않음'], multi: false, hash: 'x', readAt: day(0) };

(async () => {
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const errors = [];
  async function open(withCardRead) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/data/registered.json*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updatedAt: day(0), items: [ITEM, OTHER] }) }));
    await page.route('**/data/card-read.json*', (r) => (withCardRead
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ updatedAt: day(0), items: { [ITEM.id]: CR } }) })
      : r.fulfill({ status: 404, body: 'not found' })));
    await page.addInitScript((p) => {
      localStorage.setItem('handaejang.v1', JSON.stringify({ profile: p, applications: [], consent: { sensitive: false } }));
      localStorage.removeItem('handaejang.resume');
    }, PROFILE);
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#bottom-nav:not([hidden])', { timeout: 10000 });
    await page.waitForFunction(() => typeof findSch === 'function' && !!findSch('zz-card-read'), null, { timeout: 10000 });
    await dismissNotify(page);
    return { ctx, page };
  }
  const sheet = (page, id) => page.evaluate((sid) => {
    openDetail(sid);
    const s = document.querySelector('#detail-sheet');
    const rows = (sel) => [...s.querySelectorAll(sel)].map((li) => li.textContent.trim());
    const applyRow = (k) => { const li = [...s.querySelectorAll('.apply-rows li')].find((x) => (x.querySelector('.ns-k') || {}).textContent === k); return li ? li.innerText.replace(k, '').trim() : null; };
    return { text: s.innerText, elig: rows('.reason-list .r-elig:not(.r-x)'), ex: rows('.reason-list .r-x'), period: applyRow('기간'), method: applyRow('방법'), docs: applyRow('서류'),
      amount: (s.querySelector('.sheet-amount, .sch-amount, .amount') || {}).textContent || '', ask: !!s.querySelector('.elig-ask'), sw: s.scrollWidth, cw: s.clientWidth };
  }, id);

  /* ① 유료 결과가 실린 공고 */
  let { ctx, page } = await open(true);
  const a = await sheet(page, ITEM.id);
  const mmdd = (d) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
  ok('자격 줄이 유료 결과 두 줄 그대로다 (번호·끊긴 끝말·선발 인원 줄이 없다)', a.elig.length === 2 && a.elig.every((t, i) => t.replace(/^[✓✕]\s*/, '') === CR.eligibility[i]), a.elig);
  ok('  줄마다 판정이 붙는다 — 평점 3.0 이상 ✓ · 3구간 이내 ✕ (5구간 학생)', /^✓/.test(a.elig[0] || '') && /^✕/.test(a.elig[1] || ''), a.elig);
  ok('  「받을 수 없는 경우」 두 줄이 ✗ 로 보인다 (무료 길의 거르기에 숨지 않는다)', a.ex.length === 2 && a.ex[0].includes('휴학생') && a.ex[1].includes('4회 이상 수혜자'), a.ex);
  ok('  무료 길 값이 남지 않는다 — 「200명 내외」·「가.」·「6)」·「3)」 가 시트 어디에도 없다', !/200명 내외|가\. 직전|6\)|3\) 장학금/.test(a.text), a.text.slice(0, 300));
  ok('마감이 유료 결과의 날짜다 (접수 시작일이 아니다)', (a.period || '').includes(mmdd(CR.deadline.date)) && !(a.period || '').includes(mmdd(ITEM.deadline)), a.period);
  ok('신청 방법이 유료 결과 두 줄이다 (「원문 확인」 이 아니다)', (a.method || '').includes('표본장학회 홈페이지 온라인신청') && (a.method || '').includes('방문 접수는 받지 않음'), a.method);
  ok('서류가 유료 결과의 서류 이름이다', (a.docs || '').includes('장학금 지원서 1부') && (a.docs || '').includes('성적증명서 1부') && !(a.docs || '').includes('접수방법'), a.docs);
  ok('맨 위 금액이 숫자만이다 (300만원)', /300만원/.test(a.text) && !/금액 원문 확인/.test(a.text));
  ok('주최가 윗줄에 붙고 유의사항이 「공고 안내」 에 있다', a.text.includes('재단법인 표본장학회') && a.text.includes('타 장학금과 중복수령 불가'));
  /* 2026-11-18 첫 본 실행 — 원문의 「…확인 필요」·「미확인에 따른 불이익…」 줄이 유의·방법에 실려 '모름'류 글자 검사(verify-no-unknown)가 빨개졌다.
     그 낱말이 든 줄은 통째로 뺀다(앱의 기존 규칙 knownValue 와 같다 — 잘라서 싣지 않는다) · 같은 칸의 다른 줄은 그대로 */
  ok("  '모름'류 낱말(확인 필요·미확인)이 든 원문 줄은 통째로 안 보인다 — 유의·방법 모두 · 다른 줄은 그대로", !/확인 필요|미확인/.test(a.text) && a.text.includes('타 장학금과 중복수령 불가') && (a.method || '').includes('방문 접수는 받지 않음'), a.text.split('\n').filter((l) => /확인 필요|미확인/.test(l)));
  ok('시트가 옆으로 넘치지 않는다', a.sw <= a.cw, { sw: a.sw, cw: a.cw });
  const card = await page.evaluate((id) => { const s = findSch(id); return { verdict: fitDetailFor(s, state.profile), paid: !!s.cardRead }; }, ITEM.id);
  ok('판정 근거가 유료 줄이다 — 미달 사유가 「3구간 이내」 줄', card.paid && (card.verdict.fails || []).some((f) => f.includes('3구간')), card.verdict);

  /* ② 같은 화면에서 결과 파일에 없는 공고 — 무료 길 그대로(비상망) */
  const b = await sheet(page, OTHER.id);
  ok('결과 파일에 없는 공고는 무료 길 값 그대로다 (방법 줄 없음 · 옛 마감 · 무료 길 서류)', b.method === null && (b.period || '').includes(mmdd(OTHER.deadline)) && (b.docs || '').includes('접수방법'), { method: b.method, period: b.period, docs: b.docs });
  await ctx.close();

  /* ③ 결과 파일을 못 받으면(404) 전부 무료 길 — 앱이 넘어지지 않는다 */
  ({ ctx, page } = await open(false));
  const c = await sheet(page, ITEM.id);
  ok('결과 파일을 못 받아도 공고가 뜨고 무료 길 값으로 보인다', c.method === null && (c.period || '').includes(mmdd(ITEM.deadline)) && c.elig.length > 0, { method: c.method, period: c.period, elig: c.elig });
  await ctx.close();

  ok('화면 오류 없음', errors.length === 0, errors.slice(0, 3));
  console.log(`\n${fails.length ? `✕ 실패 ${fails.length}건` : `✓ 유료 카드 읽기 화면 전부 통과 (${pass}항목)`}`);
  fails.forEach((f) => console.log(`   - ${f}`));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('드라이버가 넘어졌습니다:', e.message); process.exit(1); });
