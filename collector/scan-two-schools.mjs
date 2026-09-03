/* ============================================================
   두 학교(경희대·한국외대) 장학 공고 전수 조사 — 일회용 조사 도구
   2026-09-02 개발자 지시: "두 학교 장학 사이트에 직접 들어가 크롤링하고
   정확한 장학 공고 전체 데이터를 수집. 그 후 신청 채널을 분류해 제시."

   🔴 이 도구는 앱 데이터를 한 글자도 고치지 않는다.
      data/*.json 도, 앱 코드도 건드리지 않고 collector/extracted/two-school/ 에만 쓴다.
      (수집 로봇 browser-collect 는 registered.json·notices.json 을 자동으로 고치므로
       이번 지시에서는 쓸 수 없다.)

   무엇을 하는가
     ① 두 학교 장학 게시판 목록을 쪽 넘겨 가며 전수로 읽는다
     ② 각 공고 상세를 열어 본문과 첨부 이름을 받는다
     ③ 본문에서 **신청·접수 방법을 말하는 줄을 원문 그대로** 뽑는다 (추론 금지 원칙 8-1)
     ④ 그 원문 줄을 근거로 신청 채널을 분류한다 — 근거 없으면 '미확인'이라고 적는다

   되돌리지 말 것
     · 확인용 브라우저는 **하나만 재사용**한다. 주소마다 새로 만들면 학교가 연결을 끊는다.
     · 상세 사이에 간격을 둔다. 짧은 시간에 몰아치면 멀쩡한 주소가 404·빈 화면이 된다.
     · 넘어져도 그때까지 받은 것은 저장한다(saveAll). 예산을 넘기면 스스로 끝낸다.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyChannels, METHOD_LINE } from './apply-channel.mjs';

const OUT_DIR = path.join(process.cwd(), 'collector', 'extracted', 'two-school');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BUDGET_MS = Number(process.env.SCAN_BUDGET_MS || 17 * 60 * 1000);
const started = Date.now();
const left = () => BUDGET_MS - (Date.now() - started);

const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES || 6);   // 학교당 목록 쪽수
const MAX_DETAIL = Number(process.env.SCAN_MAX_DETAIL || 90); // 학교당 상세 열람 상한
const GAP_MS = 1200;                                          // 상세 사이 간격

export const SCHOOLS = [
  {
    key: 'khu',
    name: '경희대학교',
    listUrl: (n) => `https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318&pageIndex=${n}`,
    /* 🔴 1차 조사(2026-09-02)가 경희대에서 0건이 된 이유 — 되돌리지 말 것.
       ① `/view.do` 만 보면 학교 홈 메뉴(`/contents/view.do`, `/mapManager/view.do`)가
          전부 공고로 들어온다. 실제로 51건 모두 메뉴 페이지였다.
       ② 이 게시판의 행은 `<a href="javascript:...">` 라 **글 번호가 href 안에** 있다.
          onclick 만 보면 진짜 공고는 한 건도 못 찾는다. */
    detailFrom: (r) => {
      if (/\/bbs\/BMSR00040\/view\.do/.test(r.href) && /boardId=/.test(r.href)) return r.href;
      const src = `${r.href} ${r.onclick}`;
      if (/\/(contents|mapManager|greeting)\/view\.do/.test(r.href)) return '';   // 학교 홈 메뉴
      const clickRow = !r.href || /^#|javascript:/i.test(r.href);   // 주소 없이 눌러야 열리는 행
      const m = src.match(/boardId['"=:\s]*?(\d{5,})/)
        || src.match(/goView\D{0,6}(\d{5,})/)
        || (clickRow ? src.match(/(\d{5,})/) : null);               // 행일 때만 숫자 하나로 찾는다
      return m ? `https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=${m[1]}` : '';
    },
  },
  {
    key: 'hufs',
    name: '한국외국어대학교',
    listUrl: (n) => `https://dep.hufs.ac.kr/bbs/student/2431/artclList.do?page=${n}`,
    fallbackList: 'https://dep.hufs.ac.kr/student/12767/subview.do',
    detailFrom: (r) => (/\/artclView\.do/.test(r.href) ? r.href : ''),
  },
];

/* 신청 채널 판정 규칙은 collector/apply-channel.mjs 하나에만 있다 — 여기 베끼지 말 것 */

/* 🔴 지난 실행의 결과를 이어받는다 — 한 학교만 다시 돌릴 때 다른 학교를 지우면 안 된다
   (수집 로봇에서 이미 겪은 함정: 안 이어받으면 205건이 2건이 된다) */
const state = { startedAt: new Date().toISOString(), schools: {}, notes: [] };
try {
  const prev = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'scan.json'), 'utf8'));
  if (prev && prev.schools) { state.schools = prev.schools; state.previousRun = prev.startedAt; }
} catch { /* 첫 실행 */ }

function saveAll() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  state.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'scan.json'), JSON.stringify(state, null, 1));
  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), buildReport());
  console.log(`\n💾 저장: ${OUT_DIR}/scan.json · REPORT.md`);
}

const classify = classifyChannels;

function buildReport() {
  const L = [];
  L.push('# 경희대·한국외대 장학 공고 신청 채널 전수 조사');
  L.push('');
  L.push(`- 조사 시각: ${state.startedAt} → ${state.finishedAt || '(진행 중)'}`);
  L.push('- 근거: 각 공고 **원문 본문에서 신청·접수 방법을 말하는 줄**만 뽑아 분류했습니다(추론 없음).');
  L.push('');
  for (const s of SCHOOLS) {
    const st = state.schools[s.key];
    if (!st) { L.push(`## ${s.name} — 조사 못 함`); L.push(''); continue; }
    L.push(`## ${s.name}`);
    L.push(`- 목록에서 찾은 장학 공고: **${st.rows}건** · 상세를 연 것: **${st.items.length}건**`);
    if (st.error) L.push(`- ⚠️ ${st.error}`);
    const tally = {};
    st.items.forEach((it) => (it.channels || []).forEach((c) => { tally[c.kind] = (tally[c.kind] || 0) + 1; }));
    L.push('');
    L.push('| 신청 채널 | 건수 |');
    L.push('|---|---|');
    Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
    L.push('');
    // 🔴 개발자 요청 — 포털 입력형으로 분류된 공고의 링크를 그대로 제시
    const portal = st.items.filter((it) => (it.channels || []).some((c) => c.kind === '학교 시스템 입력형'));
    L.push(`### 포털(학교 시스템) 입력형으로 분류된 공고 — ${portal.length}건`);
    if (!portal.length) L.push('_해당 없음_');
    portal.forEach((it) => {
      L.push(`- **${it.title}**`);
      L.push(`  - ${it.url}`);
      const ev = (it.channels.find((c) => c.kind === '학교 시스템 입력형') || {}).evidence || '';
      L.push(`  - 원문 근거: \`${ev}\``);
    });
    L.push('');
    L.push('<details><summary>전체 목록</summary>');
    L.push('');
    st.items.forEach((it) => {
      L.push(`- [${(it.channels || []).map((c) => c.kind).join(' + ')}] ${it.title}`);
      L.push(`  - ${it.url}`);
      (it.methodLines || []).slice(0, 3).forEach((l) => L.push(`  - 원문: ${l}`));
    });
    L.push('');
    L.push('</details>');
    L.push('');
  }
  if (state.notes.length) { L.push('## 실행 기록'); state.notes.forEach((n) => L.push(`- ${n}`)); }
  return L.join('\n');
}

process.on('uncaughtException', (e) => { state.notes.push(`넘어짐: ${e.message}`); saveAll(); process.exit(1); });
process.on('unhandledRejection', (e) => { state.notes.push(`넘어짐(비동기): ${e}`); saveAll(); process.exit(1); });

/* 🔴 불러오는 것만으로 크롤이 돌면 검사도 못 만든다 — 직접 실행할 때만 돈다 */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isMain) { /* 규칙만 가져다 쓰는 호출 — 크롤하지 않는다 */ }
else {
const { chromium } = await import('playwright');   // 크롤할 때만 부른다 (검사에서 못 부르는 짐이 되지 않게)
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ userAgent: UA, locale: 'ko-KR' });

async function collectList(school) {
  const page = await ctx.newPage();
  const rows = new Map();
  try {
    for (let n = 1; n <= MAX_PAGES; n += 1) {
      if (left() < 60_000) { state.notes.push(`${school.name}: 예산이 모자라 ${n - 1}쪽에서 목록 중단`); break; }
      const url = school.listUrl(n);
      let ok = false;
      for (const target of [url, n === 1 && school.fallbackList].filter(Boolean)) {
        try {
          const res = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
          if (res && res.status() < 400) { ok = true; break; }
        } catch { /* 다음 후보 */ }
      }
      if (!ok) { state.notes.push(`${school.name} ${n}쪽: 열지 못함`); break; }
      await page.waitForTimeout(1800);
      const found = await page.$$eval('a, [onclick]', (els) => els.map((e) => ({
        text: (e.textContent || '').replace(/\s+/g, ' ').trim(),
        href: e.tagName === 'A' ? (e.href || '') : '',
        onclick: e.getAttribute('onclick') || '',
      }))).catch(() => []);
      let added = 0;
      for (const r of found) {
        if (r.text.length < 6 || r.text.length > 160) continue;
        const detail = school.detailFrom(r);
        if (!detail || rows.has(detail)) continue;
        rows.set(detail, { title: r.text, url: detail });
        added += 1;
      }
      console.log(`  ${school.name} ${n}쪽 → 새 공고 ${added}건 (누적 ${rows.size}, 화면 링크 ${found.length}개)`);
      if (n === 1 && !added) state.notes.push(`🚨 ${school.name} 1쪽에서 공고 행을 하나도 못 찾음 — 행 판정을 봐야 한다`);
      if (!added) break;               // 더 넘겨도 새 글이 없으면 끝
      await page.waitForTimeout(GAP_MS);
    }
  } finally { await page.close().catch(() => {}); }
  return [...rows.values()];
}

/* 첨부 원본을 collector/extracted/ 에 내려받는다.
   그 폴더에 두는 이유: 저장소가 이미 갖고 있는 hwp-prvtext.py·hwp-bodytext.py 가
   그 폴더만 훑어 글자를 뽑는다. 규칙을 새로 만들지 않고 있는 길을 쓴다.
   ⚠️ PDF·이미지는 받지 않는다 — attachment-text.mjs 가 PDF 글자를 일부러 안 쓴다
      (숫자가 빠진 채 뽑혀 원문보다 나쁜 안내가 된 적이 있다). */
const WANT_ATTACH = process.argv.includes('--attach');
const ATT_DIR = path.join(process.cwd(), 'collector', 'extracted');
let attSeq = 0;

async function grabAttachments(school, d) {
  const saved = [];
  for (const a of d.attachUrls.slice(0, 3)) {
    if (left() < 40_000) break;
    const ext = ((a.name.match(/\.(hwpx?|docx?)$/i) || [])[1] || 'hwp').toLowerCase();
    try {
      const res = await ctx.request.get(a.url, { timeout: 25000 });
      if (!res.ok()) { saved.push({ name: a.name, error: `상태 ${res.status()}` }); continue; }
      const buf = await res.body();
      if (!buf || buf.length < 400) { saved.push({ name: a.name, error: '내용이 거의 없음' }); continue; }
      attSeq += 1;
      const file = path.join(ATT_DIR, `ts-${school.key}-${attSeq}.${ext}`);
      fs.mkdirSync(ATT_DIR, { recursive: true });
      fs.writeFileSync(file, buf);
      saved.push({ name: a.name, file: path.relative(process.cwd(), file), bytes: buf.length });
    } catch (e) {
      saved.push({ name: a.name, error: (e.message || '').split('\n')[0].slice(0, 60) });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return saved;
}

async function readDetail(url) {
  const page = await ctx.newPage();
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const got = await page.evaluate(() => {
      const pick = (sel) => (document.querySelector(sel) || {}).textContent || '';
      return {
        title: (pick('.view-title') || pick('.artclViewTitle') || pick('h1,h2,h3') || document.title || '').replace(/\s+/g, ' ').trim(),
        body: (document.body.innerText || '').slice(0, 30000),
        atts: [...document.querySelectorAll('a')]
          .map((a) => ({ t: (a.textContent || '').replace(/\s+/g, ' ').trim(), h: a.href || '' }))
          .filter((a) => /download|fileDown|\.hwpx?|\.pdf|\.docx?|\.zip|\.jpe?g|\.png/i.test(a.h + a.t))
          .filter((a) => a.t).slice(0, 12),
        pw: !!document.querySelector('input[type=password]'),
        imgs: document.querySelectorAll('img').length,
      };
    }).catch(() => null);
    if (!got) return { url, error: '화면을 읽지 못함' };
    const lines = got.body.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return {
      url,
      status: res ? res.status() : 0,
      title: got.title.slice(0, 140),
      loginWall: got.pw,
      bodyLen: got.body.length,
      imgCount: got.imgs,
      /* 글자가 거의 없는데 그림이 있으면 '본문이 이미지'다 — '미확인'과 구분해 말해야 한다 */
      imageOnly: got.body.length < 300 && got.imgs > 0,
      body: got.body,
      attachments: got.atts.map((a) => a.t),
      /* 🔴 경희대는 본문에 신청 방법을 안 적고 '첨부파일 확인 바랍니다'로 끝낸다(2026-09-02 실측).
         첨부를 못 읽으면 그 학교는 통째로 '미확인'이 된다 — 그래서 주소까지 받아 둔다. */
      attachUrls: got.atts.filter((a) => /\.(hwpx?|docx?)$/i.test(a.t) || /\.(hwpx?|docx?)/i.test(a.h))
        .map((a) => ({ name: a.t, url: a.h })).slice(0, 4),
      lines,
      methodLines: lines.filter((l) => METHOD_LINE.test(l)).slice(0, 12),
    };
  } catch (e) {
    return { url, error: (e.message || '').split('\n')[0].slice(0, 90) };
  } finally { await page.close().catch(() => {}); }
}

const ONLY = (process.env.SCAN_ONLY || '').trim();
for (const school of SCHOOLS) {
  if (ONLY && ONLY !== school.key) { console.log(`(건너뜀: ${school.name} — SCAN_ONLY=${ONLY})`); continue; }
  console.log(`\n═══ ${school.name} ═══`);
  state.schools[school.key] = { name: school.name, rows: 0, items: [] };
  const st = state.schools[school.key];
  const rows = await collectList(school);
  st.rows = rows.length;
  console.log(`  목록 확보: ${rows.length}건 — 상세 열람 시작`);
  for (const r of rows.slice(0, MAX_DETAIL)) {
    if (left() < 45_000) { st.error = `예산이 모자라 ${st.items.length}건에서 중단`; break; }
    const d = await readDetail(r.url);
    if (WANT_ATTACH && d.attachUrls && d.attachUrls.length) d.attachFiles = await grabAttachments(school, d);
    d.listTitle = r.title;
    if (!d.title) d.title = r.title;
    d.channels = d.error ? [{ kind: '읽기 실패', evidence: d.error }] : classify(d);
    delete d.lines;                    // 저장 크기 — 근거 줄(methodLines)은 남긴다
    st.items.push(d);
    process.stdout.write(`    · ${(d.title || '').slice(0, 34)} → ${d.channels.map((c) => c.kind).join('+')}\n`);
    await new Promise((r2) => setTimeout(r2, GAP_MS));
  }
  saveAll();                           // 학교 한 곳 끝날 때마다 저장
}

await browser.close();
saveAll();
console.log('\n완료');
process.exit(0);
}
