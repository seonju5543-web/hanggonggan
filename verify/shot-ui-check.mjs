/* 이번 화면 수정 두 가지를 눈으로 확인하는 촬영 스크립트 (2026-09-17)
   ① 알림함 — 안 읽은 알림이 흰색, 읽은 알림이 회색인가
   ② 장학금 상세 — 제출 서류 목록에서 왼쪽 점이 사라졌고 '자동/직접' 배지가 그 자리를 대신하는가
   실행: CHROME_PATH=... node verify/shot-ui-check.mjs   (앱 서버 8123 필요) */
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';
const { assertOwnServer } = createRequire(import.meta.url)('./onboard-helper.js');

const EXE = process.env.CHROME_PATH;
/* 🔴 포트를 박지 않는다 — 이 저장소는 작업 폴더를 여럿 두고 써서 8123 에 **남의 워크트리
   서버**가 떠 있을 수 있다(CLAUDE.md 「매 세션 이것만은」 2번). 내 코드를 재고 있는지는
   drive.js 와 같은 `assertOwnServer` 로 확인한다 — 안 하면 '실측했다'는 근거가 남의 화면이 된다. */
const PORT = process.env.PORT || 8123;
const BASE = `http://localhost:${PORT}`;

await assertOwnServer(PORT);
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

/* 온보딩을 건너뛰고 바로 프로필이 있는 상태로 연다 */
await page.addInitScript(() => {
  localStorage.setItem('handaejang.v1', JSON.stringify({
    profile: {
      school: '한국외국어대학교', campus: '서울캠퍼스', major: '경영학과',
      year: 3, gpa: 3.8, income: 5, flags: [], name: '이선주',
    },
    apps: [], docs: {}, onboarded: true,
  }));
});
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

/* ① 알림함 — 읽은 것과 안 읽은 것을 섞어 넣는다 */
await page.evaluate(async () => {
  if (!notifyLedger) await notifyLoadLedger();
  const now = Date.now();
  notifyLedger.enabled = true;
  notifyLedger.inbox = [
    { key: 'a', type: 'deadline', title: '내일 마감 · 재단법인 김해시미래인재장학재단', body: '아직 신청 준비 전 · 지금 준비하면 내일 제출 가능.', ts: now - 3600e3, read: false },
    { key: 'b', type: 'newMatch', title: '새 맞춤 공고 · 한국외대 면학장학금', body: '내 조건에 맞는 공고가 새로 등록됐어요.', ts: now - 7200e3, read: false },
    { key: 'c', type: 'deadline', title: '오늘 마감 · 대관령꿈나무장학회 생활지원장학금', body: '오늘 안에 제출해야 접수돼요.', ts: now - 86400e3, read: true },
    { key: 'd', type: 'remind', title: '제출 리마인드 · 삼일장학회', body: '신청 준비만 해 두고 아직 제출하지 않았어요.', ts: now - 172800e3, read: true },
  ];
  await notifySaveLedger();
  notifyRenderBadge();
  openNotifyInbox();
});
await page.waitForSelector('.nf-item', { timeout: 5000 });
await page.waitForTimeout(600);
const states = await page.$$eval('.nf-item', (els) => els.map((e) => ({
  unread: e.classList.contains('nf-unread'),
  bg: getComputedStyle(e).backgroundColor,
})));
console.log('알림함 상태:', JSON.stringify(states, null, 0));
await page.screenshot({ path: `${import.meta.dirname}/shot-ui-inbox.png` });

/* ② 장학금 상세 — 제출 서류 목록 */
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.evaluate(() => { location.hash = ''; });
await page.click('[data-tab="explore"]').catch(() => {});
await page.waitForTimeout(1200);
const card = await page.$('.sch-card');
if (card) { await card.click(); await page.waitForTimeout(1200); }
const docInfo = await page.$$eval('#detail-sheet .doc-list.doc-badged li', (els) => els.map((e) => ({
  text: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
  dot: getComputedStyle(e, '::before').display,
  padLeft: getComputedStyle(e).paddingLeft,
})));
console.log('제출 서류 줄:', JSON.stringify(docInfo, null, 0));
const box = await page.$('#detail-sheet');
if (box) await box.screenshot({ path: `${import.meta.dirname}/shot-ui-docs.png` }).catch(async () => {
  await page.screenshot({ path: `${import.meta.dirname}/shot-ui-docs.png` });
});
await browser.close();
console.log('촬영 완료');
