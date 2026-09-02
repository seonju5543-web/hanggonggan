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
import { chromium } from 'playwright';

const OUT_DIR = path.join(process.cwd(), 'collector', 'extracted', 'two-school');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BUDGET_MS = Number(process.env.SCAN_BUDGET_MS || 17 * 60 * 1000);
const started = Date.now();
const left = () => BUDGET_MS - (Date.now() - started);

const MAX_PAGES = Number(process.env.SCAN_MAX_PAGES || 6);   // 학교당 목록 쪽수
const MAX_DETAIL = Number(process.env.SCAN_MAX_DETAIL || 90); // 학교당 상세 열람 상한
const GAP_MS = 1200;                                          // 상세 사이 간격

const SCHOOLS = [
  {
    key: 'khu',
    name: '경희대학교',
    listUrl: (n) => `https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318&pageIndex=${n}`,
    /* 행이 진짜 링크가 아니라 클릭 스크립트인 게시판도 있어 onclick 에서 글 번호를 꺼낸다 */
    detailFrom: (r) => {
      if (/\/view\.do/.test(r.href)) return r.href;
      const m = (r.onclick || '').match(/(\d{5,})/);
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

/* ── 신청 채널 판정 — 전부 **본문 원문 줄**을 근거로만 정한다 ──
   순서가 곧 우선순위다. 근거 줄을 함께 남겨 사람이 검증할 수 있게 한다. */
const CHANNEL_RULES = [
  { kind: '한국장학재단', re: /한국장학재단|kosaf\.go\.kr|www\.kosaf|국가장학금\s*신청|국가근로장학|한국장학재단\s*홈페이지/ },
  { kind: '학교 시스템 입력형', re: /종합정보시스템|HUFS\s?Ability|학사행정|학사정보시스템|통합정보시스템|학생지원시스템|학교\s*포털|포털\s*(에서|로|을)?\s*신청/ },
  { kind: '이메일 접수', re: /이메일\s*(로)?\s*(접수|제출|송부|발송)|메일\s*(로)?\s*(접수|제출|송부)|전자우편\s*(접수|제출)|[\w.+-]+@[\w-]+\.[\w.]{2,}/ },
  { kind: '방문·우편 접수', re: /방문\s*(접수|제출)|우편\s*(접수|제출)|직접\s*(제출|접수)|제출\s*처\s*[:：]|접수\s*처\s*[:：]|사무실\s*(로|에)\s*제출/ },
  { kind: '재단·외부 사이트 신청', re: /재단\s*홈페이지|재단\s*누리집|홈페이지\s*(에서|를 통해)\s*(온라인)?\s*신청|온라인\s*접수\s*[:：]?\s*https?:\/\// },
  { kind: '구글폼·설문 접수', re: /구글\s*폼|google\.com\/forms|forms\.gle|네이버\s*폼|설문\s*링크/ },
];

/* 신청·접수 방법을 말하는 줄만 고른다 — 아무 줄이나 주우면 잡음이 근거가 된다 */
const METHOD_LINE = /(신청\s*방법|접수\s*방법|제출\s*방법|지원\s*방법|신청\s*절차|접수\s*처|제출\s*처|제출\s*서류|접수\s*기간|신청\s*방식|어떻게\s*신청|문의)/;

const state = { startedAt: new Date().toISOString(), schools: {}, notes: [] };

function saveAll() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  state.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'scan.json'), JSON.stringify(state, null, 1));
  fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), buildReport());
  console.log(`\n💾 저장: ${OUT_DIR}/scan.json · REPORT.md`);
}

function classify(item) {
  const hay = [item.body || '', (item.attachments || []).join(' ')].join('\n');
  const hits = [];
  for (const rule of CHANNEL_RULES) {
    if (!rule.re.test(hay)) continue;
    // 근거 줄 — 규칙이 실제로 걸린 그 줄을 찾아 원문 그대로 남긴다
    const line = (item.lines || []).find((l) => rule.re.test(l))
      || (hay.split('\n').find((l) => rule.re.test(l)) || '').trim();
    hits.push({ kind: rule.kind, evidence: line.replace(/\s+/g, ' ').slice(0, 180) });
  }
  if (!hits.length && (item.attachments || []).some((a) => /신청서|지원서|양식|서식|원서/.test(a))) {
    hits.push({ kind: '첨부 양식만 있음(제출처 미확인)', evidence: `첨부: ${(item.attachments || []).join(', ').slice(0, 140)}` });
  }
  return hits.length ? hits : [{ kind: '미확인', evidence: '' }];
}

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
      console.log(`  ${school.name} ${n}쪽 → 새 공고 ${added}건 (누적 ${rows.size})`);
      if (!added) break;               // 더 넘겨도 새 글이 없으면 끝
      await page.waitForTimeout(GAP_MS);
    }
  } finally { await page.close().catch(() => {}); }
  return [...rows.values()];
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
          .map((a) => ({ t: (a.textContent || '').replace(/\s+/g, ' ').trim(), h: a.getAttribute('href') || '' }))
          .filter((a) => /download|fileDown|\.hwpx?|\.pdf|\.docx?|\.zip|\.jpe?g|\.png/i.test(a.h + a.t))
          .map((a) => a.t).filter(Boolean).slice(0, 12),
        pw: !!document.querySelector('input[type=password]'),
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
      body: got.body,
      attachments: got.atts,
      lines,
      methodLines: lines.filter((l) => METHOD_LINE.test(l)).slice(0, 12),
    };
  } catch (e) {
    return { url, error: (e.message || '').split('\n')[0].slice(0, 90) };
  } finally { await page.close().catch(() => {}); }
}

for (const school of SCHOOLS) {
  console.log(`\n═══ ${school.name} ═══`);
  state.schools[school.key] = { name: school.name, rows: 0, items: [] };
  const st = state.schools[school.key];
  const rows = await collectList(school);
  st.rows = rows.length;
  console.log(`  목록 확보: ${rows.length}건 — 상세 열람 시작`);
  for (const r of rows.slice(0, MAX_DETAIL)) {
    if (left() < 45_000) { st.error = `예산이 모자라 ${st.items.length}건에서 중단`; break; }
    const d = await readDetail(r.url);
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
