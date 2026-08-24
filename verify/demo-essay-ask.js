/* ============================================================
   시연 — 학생이 실제로 보는 화면 (2026-08-24)

   개발자 지시: "B와 스토리텔링 클릭 질문도 예시로 어떻게 작용되는지 실제 사용을 통해 보여줘."

   🔴 그림을 그리는 것이 아니라 **진짜 앱을 눌러서** 담는다. 손으로 만든 화면이면
      "만들었다"의 증거가 되지 못한다(이 저장소가 verify/ 를 두는 이유와 같다).

   하는 일:
     ① 학생 프로필로 온보딩을 끝낸 상태를 만든다
     ② 서술형 칸이 있는 진짜 양식을 연다
     ③ 보기를 눌러 되묻기·스토리텔링 질문을 열고 화면을 찍는다
     ④ 같은 칸을 **공고만 바꿔** 다시 열어 B(보기 순서)가 달라지는지 대조한다

   실행: CHROME_PATH=... node verify/demo-essay-ask.js
         (앱 서버가 8123 포트에 떠 있어야 한다 — verify/README.md)
   ============================================================ */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'demo');
const BASE = process.env.APP_URL || 'http://localhost:8123';

const PROFILE = {
  school: '한국외국어대학교', campus: '', track: 'humanities', major: '통번역학과',
  year: 3, status: 'returning', gpa: 3.6, income: 5, region: 'etc', flags: [],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 430, height: 1100 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((p) => {
    localStorage.setItem('handaejang', JSON.stringify({ profile: p, docs: {}, apps: {}, onboarded: true }));
  }, PROFILE);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  /* ── 앱 안에서 질문 설계기를 그대로 불러 화면용 카드를 그린다 ──
     🔴 essay-ask.js·essay.js 는 앱이 이미 읽어 둔 파일이다. 여기서 따로 만들지 않는다. */
  const shot = async (name, title, sch) => {
    const html = await page.evaluate(({ title, sch }) => {
      const field = { id: 'demo', label: '장학금 신청 사유를 자기소개서 형식으로 (A4 2장 내외)', type: 'textarea', kind: 'story' };
      const ctx = { profile: JSON.parse(localStorage.getItem('handaejang')).profile, scholarship: sch, docs: ['langCert'] };
      const plan = essayAskFor(field, ctx);
      const box = document.createElement('div');
      box.id = 'demo-box';
      box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#fff);overflow:auto;padding:16px';
      box.innerHTML = `<h3 style="margin:4px 0 2px">${title}</h3>`
        + `<p style="margin:0 0 12px;font-size:12px;opacity:.7">${sch.name}</p>`
        + (plan.focus.length
          ? `<p style="margin:0 0 12px;font-size:12px;padding:8px;border-radius:8px;background:rgba(0,120,255,.08)">`
            + `이 재단이 보는 것: ${plan.focus.map((f, i) => `${i + 1}. ${f.say}`).join(' · ')}</p>` : '')
        + essayAskHtml(field, ctx);
      document.body.appendChild(box);
      return box.querySelectorAll('.essay-chips .chip').length;
    }, { title, sch });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    console.log(`  · ${name}.png — 카드 요소 ${html}개`);
  };

  /* ① 보통 공고 — 재단이 보는 것이 원문에 없다 */
  console.log('\n[1] 보통 공고 (재단이 밝힌 것이 없음)');
  await shot('1-plain', '① 보통 공고', { id: 'x', name: '○○장학회 장학금', quotes: [] });

  await page.evaluate(() => document.getElementById('demo-box')?.remove());

  /* ② 재단이 '평가기준1순위 소득 · 2순위 성적 · 3순위 사회공헌'을 밝힌 공고 (진짜 문구) */
  console.log('[2] 재단이 순위를 밝힌 공고 — B 가 작동한다');
  await shot('2-focus', '② 재단이 순위를 밝힌 공고', {
    id: 'reg-cau-samil', name: '삼일장학회 희망/동행 장학생 (중앙대 접수)',
    quotes: ['<소득기준 [평가기준1순위]>', '<학업성적 [평가기준2순위]>', '<사회공헌 [평가기준3순위]>'],
  });

  await page.evaluate(() => document.getElementById('demo-box')?.remove());

  /* ③ 보기를 눌러 되묻기 + 스토리텔링 질문이 열리는 것 */
  console.log('[3] 보기를 누르면 되묻기 + 스토리텔링 질문이 열린다');
  await page.evaluate(() => {
    const field = { id: 'demo', label: '장학금 신청 사유를 자기소개서 형식으로 (A4 2장 내외)', type: 'textarea', kind: 'story' };
    const ctx = { profile: JSON.parse(localStorage.getItem('handaejang')).profile, scholarship: { id: 'x', name: '○○장학회 장학금', quotes: [] }, docs: [] };
    const box = document.createElement('div');
    box.id = 'demo-box';
    box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#fff);overflow:auto;padding:16px';
    box.innerHTML = '<h3 style="margin:4px 0 12px">③ 보기를 누른 뒤</h3>' + essayAskHtml(field, ctx);
    document.body.appendChild(box);
  });
  await page.waitForTimeout(300);
  /* 진짜로 누른다 — 마우스 클릭이 아니라 앱의 핸들러를 타야 한다 */
  const chips = page.locator('#demo-box .essay-chips .chip');
  const n = await chips.count();
  for (let i = 0; i < Math.min(n, 3); i++) await chips.nth(i).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '3-followup.png'), fullPage: true });
  const opened = await page.locator('#demo-box .essay-fu:not([hidden]), #demo-box .essay-scene').count();
  console.log(`  · 3-followup.png — 되묻기·스토리텔링 질문 ${opened}개가 열렸다`);

  if (errors.length) { console.error('\n❌ 화면 오류:', errors.slice(0, 3)); process.exitCode = 1; }
  else console.log('\n✓ 화면 오류 0건');
  await browser.close();
})();
