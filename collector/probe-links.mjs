/* 링크 정찰 — '이 주소가 학생에게 실제로 어떻게 보이는가'를 눈으로 확인하는 도구 (2026-08-01)

   왜 만들었나
   ─────────────────────────────────────────────────────────────
   경희대 원문 링크가 앱에서는 통과했는데 실제로는 '로그인하세요'가 떴다.
   확인 기준에 로그인 벽이 없었기 때문인데, 더 근본적으로는
   **'우리가 보고 있는 게시판이 학생이 보는 그 게시판이 맞는가'**를 한 번도 확인하지 않았다.
   (경희대는 news.khu.ac.kr을 수집하고 있었는데, 개발자는 대학생활→장학 탭에서 공고를 본다.)

   무엇을 하나
   ─────────────────────────────────────────────────────────────
   ① checkUrl: 주어진 주소를 **로그인 없는 새 탭**에서 열어 그대로 보고한다
      (최종 주소·상태·화면 제목·로그인 벽인지·화면 앞부분 글자).
   ② findBoard: 학교 홈에서 메뉴 글자(예: '대학생활', '장학')를 따라 들어가
      **학생이 실제로 보는 게시판 주소**와 그 안의 공고 링크 몇 개를 찾아 보고한다.

   설정은 collector/run-probe.txt 에 적는다 (push하면 probe-links.yml이 실행):
      checkUrl: https://…
      findBoard: https://www.khu.ac.kr/ | 대학생활 > 장학
   결과: collector/probe-report.md */
import fs from 'node:fs';
import { chromium } from 'playwright';
import { looksLikeLoginWall, isDetailUrl } from './detail-url.mjs';

const HERE = new URL('.', import.meta.url);
let cfg = '';
try { cfg = fs.readFileSync(new URL('run-probe.txt', HERE), 'utf8'); } catch { /* 없으면 빈 실행 */ }
const lines = (key) => cfg.split('\n').map((l) => l.trim())
  .filter((l) => l.startsWith(`${key}:`)).map((l) => l.slice(key.length + 1).trim()).filter(Boolean);

const report = [`## 🔎 링크 정찰 리포트 (${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} KST)`, ''];
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/* 확인용 브라우저는 **하나만 만들어 재사용**하고 쿠키만 비운다.
   주소마다 새로 만들면 학교 서버가 연결을 끊는다(ERR_CONNECTION_CLOSED) —
   저장소에 이미 적혀 있던 규칙인데 이 도구만 지키지 않고 있었다. 실제로 2026-08-01
   정찰에서 주소 3개를 연달아 열자 4번째가 그대로 끊겼다. */
let sharedCtx = null;
async function freshPage() {
  if (!sharedCtx) sharedCtx = await browser.newContext({ userAgent: UA, locale: 'ko-KR' });
  await sharedCtx.clearCookies().catch(() => {});
  return { page: await sharedCtx.newPage(), ctx: null };
}

/* ── ① 주소 하나를 학생 눈으로 열어 본다 ── */
async function checkUrl(url) {
  const { page, ctx } = await freshPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      title: document.title || '',
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 700),
      pw: !!document.querySelector('input[type=password]'),
      h: (document.querySelector('h1,h2,h3,.title,.subject,.view-title') || {}).textContent || '',
    })).catch(() => ({ title: '', text: '', pw: false, h: '' }));
    const wall = looksLikeLoginWall(info.text, info.pw);
    report.push(`### 🔗 ${url}`);
    report.push(`- 상태 ${res ? res.status() : '?'} · 최종 주소: ${page.url()}`);
    report.push(`- 화면 제목: ${info.title.trim().slice(0, 90)}`);
    report.push(`- 큰 제목: ${String(info.h).replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    report.push(`- **로그인 요구: ${wall ? '⛔ 예 — 학생이 못 봅니다' : '✅ 아니오'}**${info.pw ? ' (비밀번호 입력칸 있음)' : ''}`);
    report.push(`- 화면 글자: ${info.text.slice(0, 300)}`);
    report.push('');
  } catch (e) {
    report.push(`### 🔗 ${url}`);
    report.push(`- ❌ 열기 실패: ${(e.message || '').split('\n')[0].slice(0, 90)}`);
    report.push('');
  } finally { await page.close().catch(() => {}); await ctx?.close().catch(() => {}); }
}

/* ── ② 학교 홈에서 메뉴를 따라 들어가 '학생이 보는 게시판'을 찾는다 ── */
async function findBoard(spec) {
  const [home, path] = spec.split('|').map((x) => x.trim());
  const steps = (path || '').split('>').map((x) => x.trim()).filter(Boolean);
  report.push(`### 🧭 ${home} → ${steps.join(' > ')}`);
  const { page, ctx } = await freshPage();
  try {
    await page.goto(home, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    for (const step of steps) {
      // 메뉴 글자가 정확히 일치하는 링크를 우선 누른다 (부분일치는 엉뚱한 데로 간다)
      const moved = await page.evaluate((label) => {
        const all = [...document.querySelectorAll('a, button, [onclick]')];
        const exact = all.find((e) => (e.textContent || '').trim() === label);
        const partial = all.find((e) => (e.textContent || '').trim().includes(label));
        const el = exact || partial;
        if (!el) return null;
        const href = el.getAttribute('href') || '';
        if (href && !href.startsWith('javascript') && !href.startsWith('#')) return el.href;
        el.click();
        return 'clicked';
      }, step).catch(() => null);
      if (!moved) { report.push(`- ⚠️ '${step}' 메뉴를 못 찾음 — 여기서 멈춤 (현재: ${page.url()})`); break; }
      if (moved !== 'clicked') await page.goto(moved, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(3000);
      report.push(`- '${step}' 이동 → ${page.url()}`);
    }
    /* 🔴 눌러 들어간 **그 화면의 글자**를 그대로 찍는다 (2026-08-29).
       이 도구의 목적이 '학생 눈에 어떻게 보이는가'인데 여태 링크만 세고 있었다.
       KOSAF 상세처럼 **클릭으로만 닿는 화면**은 checkUrl(GET)로는 영영 못 본다. */
    const seen = await page.evaluate(() => ({
      title: document.title || '',
      text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1600),
      labels: [...document.querySelectorAll('th, dt, .tit, .label, caption')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t && t.length <= 24).slice(0, 40),
    })).catch(() => ({ title: '', text: '', labels: [] }));
    report.push(`- 화면 제목: ${seen.title.slice(0, 90)}`);
    if (seen.labels.length) report.push(`- **이 화면의 항목 이름들**: ${seen.labels.join(' · ')}`);
    report.push(`- 화면 글자: ${seen.text.slice(0, 900)}`);

    const listUrl = page.url();
    // 이 화면의 공고 링크들을 보고한다 — 진짜 게시판이면 상세 주소가 보인다
    const rows = await page.$$eval('a[href], [onclick]', (els) => els.map((e) => ({
      t: (e.textContent || '').replace(/\s+/g, ' ').trim(),
      abs: e.tagName === 'A' ? (e.href || '') : '',
      src: (e.getAttribute('onclick') || '') + '|' + (e.getAttribute('href') || ''),
    })).filter((x) => x.t.length >= 8 && x.t.length <= 140)).catch(() => []);
    const scholar = rows.filter((r) => /장학|학자금/.test(r.t));
    report.push(`- 이 화면의 장학 관련 줄: ${scholar.length}개`);
    scholar.slice(0, 8).forEach((r) => report.push(`    · ${r.t.slice(0, 56)}  →  ${(r.abs || r.src).slice(0, 110)}`));
    const detail = scholar.filter((r) => isDetailUrl(r.abs, listUrl));
    report.push(`- 그중 **공고 원문으로 바로 가는 주소**: ${detail.length}개`);
    detail.slice(0, 5).forEach((r) => report.push(`    ✅ ${r.t.slice(0, 46)} → ${r.abs}`));
    if (detail.length) {
      report.push('- 이 주소들이 로그인 없이 열리는지 바로 확인합니다:');
      for (const d of detail.slice(0, 2)) { await checkUrl(d.abs); }
    }
    report.push('');
  } catch (e) {
    report.push(`- ❌ 실패: ${(e.message || '').split('\n')[0].slice(0, 90)}`);
    report.push('');
  } finally { await page.close().catch(() => {}); await ctx?.close().catch(() => {}); }
}

// 같은 학교를 몰아치지 않는다 — 사이를 두고 하나씩 연다
for (const u of lines('checkUrl')) { await checkUrl(u); await new Promise((r) => setTimeout(r, 2500)); }
for (const s of lines('findBoard')) await findBoard(s);

await browser.close();
if (report.length <= 2) report.push('_(run-probe.txt에 checkUrl / findBoard 줄이 없어 할 일이 없었습니다)_');
fs.writeFileSync(new URL('probe-report.md', HERE), report.join('\n'));
console.log(report.join('\n'));
