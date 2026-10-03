/* 「원문 링크 정직성」 — robot 갈래: 원문 링크 확인 로봇 (collector/link-check-plan.mjs · link-check.mjs · link-check.yml)
   (2026-10-03 · 원문 대신 재단 홈페이지·게시판 목록이 열리던 사고 — 학생처럼 열어 보고 기록한 곳이 없었다)
   잰다:
     ⓐ 모으기 — 앱이 받는 파일 다섯 묶음을 **전부** 보는가(표식·층2·숨긴 글은 세기만) · 열쇠는 되돌린 주소 · 제목이 있다
     ⓑ 순서 — 처음 보는 것 먼저 · 한 번 본 문제는 다른 날 다시 · 사이트마다 상한 · 같은 사이트 간격
     ⓒ 끝에서 끝까지 — 가짜 관측으로 로봇을 **실제로 돌려** 첫날은 안 알리고 둘째 날 확정되며, 공고가 뜨면 풀리고,
        세 출력 말고는 **한 바이트도 안 바뀌는지**(이 로봇은 주소를 고치지 않는다 — 2026-10-03 순찰 사고)
        · ⓒ-2 한 사이트에 한 번 본 문제가 넷 이상이어도 둘째 날 확정되는지(막힘 판정이 그것들을 지우지 않는다 · 리뷰 G6)
     ⓓ 걸려 있는가 — 워크플로(시한·홀수 분 예약·세 파일 저장·넘어짐 알림) · 배포 동기화 · 라이브 점검 · 쓰기 자리
   🔴 실데이터 숫자를 박지 않는다(CLAUDE.md — 2026-10-01 관문이 선을 넘나들며 자동 등록을 되돌린 사고).
      ⓐ는 '데이터에 글이 있는 묶음은 대상에도 있다'를 **같은 파일을 따로 읽어** 대조한다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as P from '../../collector/link-check-plan.mjs';

const ENT = /&(?:amp|#0*38|#x0*26);/i;

/* 같은 파일을 로봇과 **다른 길로** 읽어 묶음별 '열어 볼 주소'를 센다 — 로봇의 눈으로 로봇을 채점하지 않게.
   🔴 (2026-10-03 리뷰 G4) **뜻은 로봇과 같아야** 한다 — 다르게 읽으면 데이터에 그런 글이 하나 들어오는 날 ⓐ가 거짓 빨간불이 되고,
      수집 로봇이 이 관문을 돌리므로 그날 결과가 되돌려진다. 예전 되풀기는 두 번만 풀어 `&amp;#038;`(서울대 워드프레스 실측 꼴)이
      `&#038;` 로 남았고, `http://` 처럼 주소로 못 푸는 글자를 '주소'로 셌다(로봇은 둘 다 다르게 본다).
      그래서 로봇(source-link.js decodeUrlEntities·linkShape)과 같은 약속을 **따로 적는다**: 기호가 안 남을 때까지 세 번까지 풀고,
      new URL 이 못 읽는 글자는 '주소 없음'. 함수를 불러 쓰지 않는 것이 이 함수의 존재 이유다. */
function independentCount(root) {
  const R = (rel) => path.join(root, rel);
  const j = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
  const dirFiles = (d) => { try { return fs.readdirSync(R(d)).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => path.join(R(d), f)); } catch { return []; } };
  const dec = (u) => {
    let s = String(u == null ? '' : u).trim();
    for (let i = 0; i < 3 && ENT.test(s); i += 1) s = s.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    return s;
  };
  const parses = (u) => { try { return !!new URL(u); } catch { return false; } };
  const out = {}; const markers = {};
  const add = (ds, list, urlKey) => {
    const s = new Set();
    for (const it of list) {
      if (it.hidden) continue;
      const u = dec(it[urlKey]);
      if (!/^https?:\/\//i.test(u)) continue;
      if (/#n-/.test(u)) { markers[ds] = (markers[ds] || 0) + 1; continue; }
      if (!parses(u)) continue;
      s.add(u);
    }
    out[ds] = s;
  };
  add('registered', (j(R('data/registered.json')).items || []).filter((x) => x.sourceKind !== 'kosaf'), 'sourceUrl');
  add('notices', dirFiles('data/notices').flatMap((f) => j(f).items || []), 'url');
  add('external', j(R('data/external.json')).items || [], 'url');
  add('activities', j(R('data/activities.json')).items || [], 'url');
  add('news', dirFiles('data/news').flatMap((f) => j(f).items || []), 'url');
  const kosaf = j(R('data/kosaf-open.json')).items || [];
  return { out, markers, kosaf: [kosaf.length, kosaf.filter((i) => (i.files || []).length).length] };
}

/* 폴더 아래 파일 전부의 지문 — 로봇이 무엇을 바꿨는지 바이트로 잰다 */
function hashTree(dir, skip = () => false) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      const rel = path.relative(dir, f).split(path.sep).join('/');
      if (skip(rel)) continue;
      if (e.isDirectory()) walk(f);
      else out[rel] = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
    }
  };
  walk(dir);
  return out;
}
const changed = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();

export default async function gate(eq, ctx) {
  const root = (ctx && ctx.root) || new URL('../../', import.meta.url);
  const ROOT = fileURLToPath(root);

  /* ── ⓐ 모으기 — 진짜 저장소 ─────────────────────────────────────── */
  const mineOf = (gt) => Object.fromEntries(P.DATASETS.map((d) => [d, new Set(gt.targets.filter((t) => t.ds.includes(d)).map((t) => t.url))]));
  /* 따로 읽은 주소 중 로봇이 안 연 것은 「제목이 없어 못 여는 것」뿐이어야 한다(그 수만큼만 빈다) */
  const gapOf = (gt, id) => {
    const m = mineOf(gt);
    return P.DATASETS.filter((d) => {
      const missing = [...id.out[d]].filter((u) => !m[d].has(u)).length;
      const extra = [...m[d]].filter((u) => !id.out[d].has(u)).length;
      return extra > 0 || missing > (gt.skipped.noTitle[d] || 0);
    });
  };
  const g = P.gatherTargets(root);
  const ind = independentCount(ROOT);
  const mine = mineOf(g);
  eq('ⓐ 앱이 받는 다섯 묶음(정식 등록·학교별 공고·재단·활동·학교별 소식)을 따로 읽은 주소를 로봇이 전부 연다(제목 없는 것만 뺀다)', gapOf(g, ind), []);
  /* 따로 읽기가 로봇과 같은 뜻인지 — 까다로운 꼴을 가짜 자료로 (리뷰 G4 · 실데이터에 그런 글이 들어오는 날을 미리) */
  {
    const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'link-check-gather-'));
    try {
      fs.mkdirSync(path.join(tmpA, 'data'), { recursive: true });
      fs.writeFileSync(path.join(tmpA, 'data/registered.json'), JSON.stringify({ items: [
        { id: 'r1', name: '한 겹 기호 표본 2026 장학생 선발', sourceUrl: 'https://x.test.kr/kb/?mod=document&#038;uid=79' },
      ] }));
      fs.writeFileSync(path.join(tmpA, 'data/external.json'), JSON.stringify({ items: [
        { title: '두 겹 기호 표본 2026 장학생 선발 안내', url: 'https://x.test.kr/kb/?mod=document&amp;#038;uid=77' },   // 워드프레스 두 겹(실측 꼴)
        { title: '세 겹 기호 표본 2026 장학생 선발 안내', url: 'https://x.test.kr/kb/?mod=document&amp;amp;amp;uid=78' },
        { title: '못 푸는 주소 표본 2026 장학 안내', url: 'http://' },
        { title: '빈칸 든 주소 표본 2026 장학 안내', url: 'https://exa mple.kr/x' },
      ] }));
      const gA = P.gatherTargets(tmpA);
      const iA = independentCount(tmpA);
      eq('  따로 읽기와 로봇 읽기가 까다로운 주소에서도 같은 뜻 — 두·세 겹 기호(`&amp;#038;`·`&amp;amp;amp;`)는 끝까지 풀고 · 못 푸는 주소는 「주소 없음」',
        [gapOf(gA, iA), [...iA.out.external].sort(), gA.skipped.noUrl.external || 0, [...iA.out.registered]],
        [[], ['https://x.test.kr/kb/?mod=document&uid=77', 'https://x.test.kr/kb/?mod=document&uid=78'], 2, ['https://x.test.kr/kb/?mod=document&uid=79']]);
    } finally {
      fs.rmSync(tmpA, { recursive: true, force: true });
    }
  }
  eq('  다섯 묶음 모두 지금 열어 볼 링크가 있다 — 글이 있는 묶음은 하나도 빠지지 않는다(개수를 박지 않고 「모두 본다」를 잰다)',
    P.DATASETS.filter((d) => ind.out[d].size > 0 && !(mine[d].size > 0)), []);
  eq('  목록 표식(#n-)은 열지 않고 센다 — 앱이 이미 「게시판 목록」이라 부른다', [g.targets.filter((t) => /#n-/.test(t.raw)).length, P.DATASETS.map((d) => g.skipped.marker[d] || 0)], [0, P.DATASETS.map((d) => ind.markers[d] || 0)]);
  eq('  층2 재단 홈페이지는 열지 않고 센다(공고문 사본 수와 함께 · 열지 않는 것은 ⓒ가 잰다)', [g.skipped.kosaf.items, g.skipped.kosaf.withFiles], ind.kosaf);
  eq('  대상 주소에 HTML 기호(&amp;·&#038;)가 남아 있지 않다 — 장부 열쇠 = 앱이 찾는 열쇠', g.targets.filter((t) => ENT.test(t.url)).map((t) => t.url), []);
  eq('  대상마다 찾을 제목이 하나 이상 — 제목 없이 열면 「다른 화면」으로 몰린다', g.targets.filter((t) => !t.titles.length || !t.titles[0]).map((t) => t.url), []);
  eq('  같은 주소는 한 번만 연다(묶음만 합친다)', g.targets.length, new Set(g.targets.map((t) => t.url)).size);

  /* ── ⓑ 순서 ───────────────────────────────────────────────────── */
  const T = (url, ds, title) => ({ url, raw: url, ds: [ds], id: '', title, titles: [title], host: new URL(url).host, origin: new URL(url).origin, refs: [] });
  const tg = [
    T('https://h1.kr/v?id=1', 'notices', '공고 하나 2026 장학생 선발 안내'),
    T('https://h1.kr/v?id=2', 'registered', '공고 둘 2026 장학생 선발 안내'),
    T('https://h2.kr/v?id=3', 'news', '공고 셋 2026 학사 일정 안내'),
    T('https://h2.kr/v?id=4', 'notices', '공고 넷 2026 장학생 모집 안내'),
    T('https://h3.kr/v?id=5', 'registered', '공고 다섯 2026 장학생 선발'),
    T('https://h3.kr/v?id=6', 'external', '공고 여섯 2026 장학생 선발'),
  ];
  const today = '2026-10-05';
  const st = {
    'https://h1.kr/v?id=2': { v: 'post', at: '2026-10-01', lastAt: '2026-10-01', lastV: 'post' },
    'https://h2.kr/v?id=3': { v: 'list', at: '2026-10-04', n: 1, confirmed: false, lastAt: '2026-10-04', lastV: 'list' },
    'https://h2.kr/v?id=4': { v: 'gone', at: '2026-10-02', n: 2, confirmed: true, lastAt: '2026-10-02', lastV: 'gone' },
    'https://h3.kr/v?id=6': { v: 'other', at: today, n: 1, confirmed: false, lastAt: today, lastV: 'other' },
  };
  const q = P.planQueue(tg, st, today, {}).map((t) => t.url.split('=')[1]);
  eq('ⓑ 한 번 본 문제(앞선 날 — 다시 보면 확정) → 처음 보는 정식 등록 → 처음 보는 나머지 → 확정 문제 → 나머지 · 오늘 이미 본 것은 다시 안 연다(리뷰 LC-4)', q, ['3', '5', '1', '4', '2']);
  eq('  한 번 본 문제를 다른 날 다시 열어야 확정된다 — 같은 날 본 것(id=6)은 오늘 순서에 없다', [q.includes('3'), q.includes('6')], [true, false]);
  const many = Array.from({ length: 12 }, (_, i) => T(`https://same.kr/v?id=${i}`, 'news', `같은 사이트 글 ${i}번 안내 공고`));
  eq('  사이트마다 상한(기본 8 · 학교 서버를 몰아치지 않는다) · 전체 상한', [P.planQueue(many, {}, today, {}).length, P.planQueue(many, {}, today, { perHost: 3 }).length, P.planQueue(tg, {}, today, { max: 2 }).length], [8, 3, 2]);
  const lastHit = new Map([['h1.kr', 1000], ['h2.kr', 1000]]);
  eq('  같은 사이트는 간격을 두고 연다 — 막힌 사이트를 건너 다음 사이트를 고른다 · 다 막혔으면 기다린다',
    [P.pickNext(tg, lastHit, 2000, 1500).index, P.pickNext(tg.slice(0, 4), lastHit, 2000, 1500)], [4, { index: -1, wait: 500 }]);
  const others = P.otherTitlesFor(tg[0], tg.concat([T('https://h1.kr/v?id=9', 'news', '공고 하나 2026 장학생 선발 안내')]), [{ origin: 'https://h1.kr', dir: '/', title: '표식으로 남은 다른 글 2026 장학 안내' }, { origin: 'https://h2.kr', dir: '/', title: '다른 사이트 후보 글 2026 장학 안내' }]);
  eq('  같은 사이트의 다른 글 제목만 · 같은 제목은 빼고 · 표식 글 제목도 재료로 — 빈 목록이면 목록을 못 알아본다(순찰 41건)',
    others.sort(), ['공고 둘 2026 장학생 선발 안내', '표식으로 남은 다른 글 2026 장학 안내'].sort());

  /* ── ⓒ 끝에서 끝까지 — 가짜 관측으로 로봇을 실제로 돌린다 ───────────── */
  /* 로봇 한 번 — dir 을 저장소로 · obs 를 그날 본 화면으로 · day 를 오늘로. env 로 사이트 상한 등을 그 실행에만 준다 */
  const runRobot = (dir, obs, day, { args = [], env = {} } = {}) => {
    const fakeFile = path.join(dir, 'fake.json');
    const outFile = path.join(dir, 'gh-output.txt');
    fs.writeFileSync(fakeFile, JSON.stringify(obs));
    fs.writeFileSync(outFile, '');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'collector/link-check.mjs'), ...args], {
      encoding: 'utf8',
      env: { ...process.env, LINK_CHECK_ROOT: dir, LINK_CHECK_FAKE: fakeFile, LINK_CHECK_TODAY: day, GITHUB_OUTPUT: outFile,
        LINK_CHECK_TXT: '', LINK_CHECK_ONLY: '', LINK_CHECK_MAX: '', LINK_CHECK_PER_HOST: '', LINK_CHECK_BUDGET_MS: '', LINK_CHECK_SPACING_MS: '', ...env },
    });
    const out = Object.fromEntries(fs.readFileSync(outFile, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=')));
    return { code: r.status, out, err: (r.stderr || '').slice(0, 300) };
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'link-check-'));
  try {
    const W = (rel, obj) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1)); };
    const A = 'https://a.test.kr/bbs/list.do?nttId=1';
    const aTitle = '2026학년도 2학기 가송재단 장학생 선발 안내';
    const aOthers = ['2026 미래에셋 해외교환 장학생 모집 공고', '관정이종환교육재단 2026 장학생 선발 공고', '서울인재대학장학금 2026 신청 안내 공고'];
    const Eraw = 'https://b.test.kr/notice/view?seq=7&amp;page=1';
    const E = 'https://b.test.kr/notice/view?seq=7&page=1';
    const C = 'https://c.test.kr/event/42';
    const N = 'https://d.test.kr/news/view?id=5';
    /* 앱에 실린 글이 하나뿐인 사이트(서울대 4건 같은 곳) — 다른 글 제목은 수집 검수 후보에서 온다 */
    const F = 'https://e.test.kr/board/list.do?articleNo=9';
    const fTitle = '2026 이재단 장학생 선발 공고';
    const fOthers = ['2026학년도 2학기 국가근로장학생 모집 안내', '2026 해외교환 장학생 추가 모집 공고', '2026 동문회 장학금 신청 안내 공고'];
    const Z = [1, 2, 3, 4].map((i) => `https://z.test.kr/view?id=${i}`);
    W('data/registered.json', { updatedAt: 'x', items: [
      { id: 'reg-a', name: aTitle, sourceUrl: A, sourceKind: 'auto' },
      { id: 'reg-f', name: fTitle, sourceUrl: F, sourceKind: 'auto' },
      { id: 'reg-marker', name: '표식 글 2026 장학생 선발', sourceUrl: 'https://a.test.kr/bbs/list.do#n-%ED%91%9C%EC%8B%9D', sourceKind: 'auto' },
    ] });
    W('data/notices/index.json', { files: {} });
    W('data/notices/nfake.json', { school: '가대학교', items: aOthers.map((t, i) => ({ title: t, url: `https://a.test.kr/bbs/view.do?id=1${i + 1}`, school: '가대학교' }))
      .concat(Z.map((u, i) => ({ title: `제트대학교 2026 장학 공고 ${i + 1}번 안내`, url: u, school: '제트대학교' }))) });
    W('data/external.json', { updatedAt: 'x', items: [{ title: '2026 비재단 장학생 선발 공고', url: Eraw, host: '비재단' }] });
    W('data/activities.json', { updatedAt: 'x', items: [
      { title: '2026 씨씨 청년 서포터즈 모집', url: C, kind: '대외활동' },
      { title: '숨긴 활동 2026 공모전 안내', url: 'https://c.test.kr/event/43', kind: '공모전', hidden: true },
    ] });
    W('data/news/index.json', { files: {} });
    W('data/news/nfake.json', { school: '라대학교', items: [
      { title: '2026학년도 2학기 중간시험 실시 안내', url: N, school: '라대학교' },
      { title: '주소 없는 소식 2026 안내', url: 'javascript:void(0)', school: '라대학교' },
      { title: '', url: 'https://d.test.kr/news/view?id=6', school: '라대학교' },   // 제목 없음 — 판정 재료가 없어 열지 않는다
    ] });
    W('data/news/img/x.webp', 'not-json');
    W('data/kosaf-open.json', { items: [{ code: '1', name: '재단 장학', home: 'https://kosaf-home.test.kr', files: [{ path: 'data/kosaf-files/1.pdf' }] }, { code: '2', name: '재단 둘', home: 'https://kosaf-home2.test.kr' }] });
    W('data/forms.json', { templates: [] });
    W('collector/candidates.json', { items: fOthers.map((t, i) => ({ title: t, url: `https://e.test.kr/board/view.do?articleNo=${i + 1}` })) });
    W('data/link-check.json', { updatedAt: null, v: 1, bad: {} });
    W('collector/link-check-state.json', {});

    const listText = `${aOthers.join('\n')}\n${aTitle}\n${'x'.repeat(500)}`;
    const obsDay = (aIsPost) => ({
      [A]: aIsPost ? { status: 200, finalUrl: A, docTitle: `${aTitle} | 가대학교`, headings: [aTitle], text: `${aTitle} 작성일 2026.09.01 ${'y'.repeat(400)}` }
        : { status: 200, finalUrl: A, docTitle: '전체공지', headings: [], text: listText },
      ...Object.fromEntries(aOthers.map((t, i) => [`https://a.test.kr/bbs/view.do?id=1${i + 1}`, { status: 200, docTitle: t, headings: [t], text: `${t} 작성일 ${'y'.repeat(400)}` }])),
      [E]: { status: 404 },
      [F]: { status: 200, finalUrl: F, docTitle: '장학공지', headings: ['장학공지'], text: `${fOthers.join('\n')}\n${fTitle}\n${'v'.repeat(500)}` },
      [C]: { status: 200, finalUrl: 'https://c.test.kr/', docTitle: '씨씨재단', text: 'z'.repeat(800) },
      ...Object.fromEntries(Z.map((u) => [u, { status: 200, docTitle: '제트대학교', text: `작성일 다른 글 ${'w'.repeat(2000)}` }])),
    });
    const run = (day, aIsPost, extra = []) => runRobot(tmp, obsDay(aIsPost), day, { args: extra });
    const ledger = () => JSON.parse(fs.readFileSync(path.join(tmp, 'data/link-check.json'), 'utf8'));
    const ledgerRaw = () => fs.readFileSync(path.join(tmp, 'data/link-check.json'), 'utf8');
    const state = () => JSON.parse(fs.readFileSync(path.join(tmp, 'collector/link-check-state.json'), 'utf8'));
    const notOutputs = (rel) => rel === 'data/link-check.json' || rel === 'collector/link-check-state.json' || rel === 'collector/link-check-report.md' || rel === 'fake.json' || rel === 'gh-output.txt';
    const before = hashTree(tmp, notOutputs);

    const d1 = run('2026-10-04', false);
    eq('ⓒ 첫날 — 로봇이 끝까지 돈다(가짜 관측 · 인터넷 없이)', [d1.code, d1.err], [0, '']);
    eq('  첫날 본 문제(목록·404·첫 화면)는 앱에 알리지 않는다 — 한 번 본 것으로 앱 글자를 바꾸지 않는다', ledger().bad, {});
    const s1 = state();
    eq('  장부에는 「한 번 봄」으로 남는다 · 열쇠는 되돌린 주소(&amp; → &)', [s1[A] && [s1[A].v, s1[A].n, s1[A].confirmed], s1[E] && s1[E].v, s1[C] && s1[C].v, Object.keys(s1).some((k) => ENT.test(k))], [['list', 1, false], 'gone', 'home', false]);
    eq('  한 사이트에서 제목 없는 화면이 절반을 넘으면 막힘 의심 — 「다른 화면」으로 세지 않는다', Z.map((u) => [s1[u] && s1[u].lastV, s1[u] && s1[u].v]), Z.map(() => ['unread', undefined]));
    eq('  앱에 글이 하나뿐인 사이트도 목록을 알아본다 — 다른 글 제목을 수집 검수 후보에서 가져온다', s1[F] && s1[F].v, 'list');
    eq('  관측이 없으면(망 오류) 판정 못 함 — 문제로 세지 않는다', [s1[N] && s1[N].lastV, s1[N] && s1[N].v], ['unread', undefined]);
    eq('  표식·숨긴 글·주소 없는 글·제목 없는 글·층2·검수 후보(제목 재료일 뿐)는 열지 않는다', Object.keys(s1).filter((k) => /#n-|event\/43|javascript|news\/view\?id=6|kosaf-home|board\/view\.do/.test(k)), []);

    const again = run('2026-10-04', false);
    eq('  같은 날 다시 돌려도 확정되지 않는다(오늘 본 것은 다시 열지 않는다)', [again.code, again.out.checked, ledger().bad], [0, '0', {}]);

    const d2 = run('2026-10-05', false);
    eq('  둘째 날 같은 것을 보면 확정 → 앱이 받는 파일에 적힌다(열쇠 = 되돌린 주소 · 날짜 = 확정한 날)', [d2.code, ledger().bad],
      [0, Object.fromEntries([[A, { v: 'list', at: '2026-10-05' }], [C, { v: 'home', at: '2026-10-05' }], [E, { v: 'gone', at: '2026-10-05' }], [F, { v: 'list', at: '2026-10-05' }]].sort(([a], [b]) => (a < b ? -1 : 1)))]);
    eq('  워크플로가 읽는 숫자 — 새로 확정 4 · 확정 4', [d2.out.new_bad, d2.out.confirmed], ['4', '4']);
    eq('  앱 파일은 로봇과 같은 모양으로 저장한다(JSON.stringify(x, null, 1))', ledgerRaw(), JSON.stringify(ledger(), null, 1));
    const rep = fs.readFileSync(path.join(tmp, 'collector/link-check-report.md'), 'utf8');
    eq('  리포트 — 새로 확정된 것을 먼저, 건너뛴 표식·층2를 센다', [/새로 확정된 문제 링크[^\n]*4건/.test(rep), rep.indexOf('새로 확정된 문제') < rep.indexOf('전체 현황'), /층2[^\n]*2건[^\n]*사본이 있는 것 1건/.test(rep), /목록 표식[^\n]*정식 등록 1/.test(rep)], [true, true, true, true]);

    const snapDry = hashTree(tmp, (rel) => rel === 'fake.json' || rel === 'gh-output.txt');
    const dry = run('2026-10-06', true, ['--dry']);
    eq('  --dry 는 아무 파일도 쓰지 않는다', [dry.code, changed(snapDry, hashTree(tmp, (rel) => rel === 'fake.json' || rel === 'gh-output.txt'))], [0, []]);

    const d3 = run('2026-10-06', true);
    eq('  공고가 뜨면 풀린다 — 앱 파일에서 빠진다(나머지는 그대로)', [d3.code, Object.keys(ledger().bad)], [0, [C, E, F].sort()]);
    eq('🔴 세 출력(data/link-check.json · 로봇 장부 · 리포트) 말고는 한 바이트도 안 바뀐다 — 이 로봇은 주소를 고치지 않는다', changed(before, hashTree(tmp, notOutputs)), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  /* ⓒ-2 (2026-10-03 리뷰 G6) 한 사이트에 '제목 없는 다른 화면'이 넷 — 둘째 날 다시 열면 **확정**된다(막힘으로 지워지지 않는다).
     순서(planQueue)는 한 번 본 문제를 일부러 맨 앞에 모아 다시 연다. 그날 막힘 판정(hostGuard)이 그것들까지 '처음 보는 문제'로 세면
     그 사이트의 거의 전부가 제목 없는 문제라 '막힘 의심'이 되고, 진짜 문제 넷이 날마다 「판정 못 함」으로 지워져 영영 확정되지 않는다
     (리뷰 LC-1 — 로봇이 넘기는 wasBad 표시). 순수 함수(hostGuard)만 재면 로봇이 그 표시를 안 넘기는 사고를 못 본다 — 그래서 로봇을 돌린다.
     첫날은 같은 사이트에 공고 여섯이 함께 열려 제목 없는 것이 절반 미만(4/10)이라 막힘이 아니고 「한 번 봄」으로 남는다.
     둘째 날은 사이트 상한 6 — 한 번 본 문제 넷이 먼저, 공고는 둘만 다시 열린다(표시가 없으면 4/6 로 막힘이 되는 꼴). */
  const tmpH = fs.mkdtempSync(path.join(os.tmpdir(), 'link-check-host-'));
  try {
    const Y = (i) => `https://y.test.kr/bbs/view.do?id=${i}`;
    const blindU = [1, 2, 3, 4].map(Y);
    const postU = [11, 12, 13, 14, 15, 16].map(Y);
    const blindT = (i) => `와이대학교 2026학년도 장학 공고 ${i}번 선발 안내`;
    const postT = (i) => `와이대학교 2026학년도 학사 공지 ${i}번 안내`;
    fs.mkdirSync(path.join(tmpH, 'data/notices'), { recursive: true });
    fs.writeFileSync(path.join(tmpH, 'data/notices/yfake.json'), JSON.stringify({ school: '와이대학교', items: [
      ...blindU.map((u, i) => ({ title: blindT(i + 1), url: u, school: '와이대학교' })),
      ...postU.map((u, i) => ({ title: postT(i + 1), url: u, school: '와이대학교' })),
    ] }, null, 1));
    const obsH = {
      ...Object.fromEntries(blindU.map((u) => [u, { status: 200, docTitle: '와이대학교', text: `작성일 다른 글 ${'w'.repeat(2000)}` }])),
      ...Object.fromEntries(postU.map((u, i) => [u, { status: 200, docTitle: postT(i + 1), headings: [postT(i + 1)], text: `${postT(i + 1)} 작성일 ${'y'.repeat(400)}` }])),
    };
    const ledgerH = () => { try { return JSON.parse(fs.readFileSync(path.join(tmpH, 'data/link-check.json'), 'utf8')).bad; } catch { return null; } };
    const stateH = () => JSON.parse(fs.readFileSync(path.join(tmpH, 'collector/link-check-state.json'), 'utf8'));
    const h1 = runRobot(tmpH, obsH, '2026-10-04', { env: { LINK_CHECK_PER_HOST: '10' } });
    const sh1 = stateH();
    eq('ⓒ-2 첫날 — 한 사이트에 제목 없는 다른 화면 넷 + 공고 여섯: 막힘이 아니라 넷 다 「한 번 봄」(other · 1회 · 미확정) · 앱엔 아직 안 알린다',
      [h1.code, h1.err, h1.out.checked, blindU.map((u) => sh1[u] && [sh1[u].v, sh1[u].n, sh1[u].confirmed]), ledgerH()],
      [0, '', '10', blindU.map(() => ['other', 1, false]), {}]);
    const h2 = runRobot(tmpH, obsH, '2026-10-05', { env: { LINK_CHECK_PER_HOST: '6' } });
    const sh2 = stateH();
    eq('  둘째 날 — 한 번 본 문제 넷이 공고 둘과 함께 다시 열린다(사이트 상한 6)',
      [h2.code, h2.err, h2.out.checked, blindU.every((u) => sh2[u].lastAt === '2026-10-05'), postU.filter((u) => sh2[u].lastAt === '2026-10-05').length], [0, '', '6', true, 2]);
    eq('  🔴 그 넷이 확정돼 data/link-check.json 에 실린다 — 막힘 의심(판정 못 함)으로 지워지지 않는다(앞선 날 이미 문제였다는 표시를 로봇이 넘긴다)',
      [ledgerH(), h2.out.new_bad, blindU.map((u) => sh2[u].lastV)],
      [Object.fromEntries(blindU.map((u) => [u, { v: 'other', at: '2026-10-05' }])), '4', blindU.map(() => 'other')]);
  } finally {
    fs.rmSync(tmpH, { recursive: true, force: true });
  }

  /* ── ⓓ 걸려 있는가 ────────────────────────────────────────────── */
  const read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
  const noYmlComments = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const wf = noYmlComments(read('.github/workflows/link-check.yml'));
  const wfName = (wf.match(/^name:\s*(.+)$/m) || [])[1] || '';
  const cron = (wf.match(/cron:\s*'(\d+)\s+\d+/) || [])[1];
  const adds = wf.split('\n').filter((l) => /git add /.test(l)).join('\n');
  eq('ⓓ 워크플로 — 이름 · 시한 · 홀수 분 예약 · 제 대기줄 · 인증서 묶음',
    [wfName.trim(), /timeout-minutes:\s*\d+/.test(wf), cron != null && Number(cron) % 2 === 1, /group:\s*link-check\s*$/m.test(wf), /NODE_EXTRA_CA_CERTS:\s*collector\/certs\/bundle\.pem/.test(wf)],
    ['원문 링크 확인 로봇', true, true, true, true]);
  eq('  로봇이 쓰는 세 파일을 전부 저장한다(빠뜨리면 다음 재시도가 unstaged 로 죽는다 — 이슈 #79)',
    ['data/link-check.json', 'collector/link-check-state.json', 'collector/link-check-report.md'].filter((f) => !adds.includes(f)), []);
  eq('  저장 직전 감사 · 실패하면 되돌림 · push 재시도는 --autostash · 넘어짐 알림은 failure()와 cancelled() 둘 다',
    [/node verify\/audit-data\.js/.test(wf), /git checkout -- data\/link-check\.json/.test(wf), /git pull --rebase --autostash/.test(wf) && !/git pull --rebase(?! --autostash)/.test(wf), /if: failure\(\) \|\| cancelled\(\)\n\s+uses: \.\/\.github\/actions\/robot-down/.test(wf)],
    [true, true, true, true]);
  eq('  push-to-run 파일을 보고 돈다', /paths:\n\s+- 'collector\/run-link-check\.txt'/.test(wf) && fs.existsSync(path.join(ROOT, 'collector/run-link-check.txt')), true);
  const sync = read('.github/workflows/deploy-sync.yml');
  const watched = (sync.match(/workflows:\s*\[([\s\S]*?)\]/) || [])[1] || '';
  eq('  배포 동기화가 이 로봇을 안다 — 모르면 확정 결과가 최대 12시간 앱에 안 나간다', !!wfName && watched.includes(`'${wfName.trim()}'`), true);
  const live = read('.github/workflows/check-live.yml');
  eq('  라이브 점검이 앱이 받는 data/link-check.json 을 본다(칸 셋이라 개수가 아니라 건수·시각으로)', [/out\.push\('data\/link-check\.json'\)/.test(live), /const m = f === 'data\/link-check\.json' \? linkCheck : measure;/.test(live) && /m\(f\), m\('live\/' \+ f\)/.test(live)], [true, true]);

  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const runner = strip(read('collector/link-check.mjs'));
  const plan = strip(read('collector/link-check-plan.mjs'));
  eq('  🔴 로봇의 쓰기 자리는 save() 하나 · 세 파일만 허락 · 데이터 파일 이름이 코드에 없다',
    [(runner.match(/writeFileSync\(/g) || []).length, /function save\(file, text\) \{\n\s+if \(!OUTPUTS\.has\(file\)\) throw/.test(runner),
      /const OUTPUTS = new Set\(\[STATE_FILE, LEDGER_FILE, REPORT_FILE\]\)/.test(runner),
      /registered\.json|data\/notices|external\.json|activities\.json|data\/news|kosaf-open/.test(runner),
      /renameSync|copyFileSync|unlinkSync|rmSync|appendFileSync\((?!process\.env\.GITHUB_OUTPUT)/.test(runner)],
    [1, true, true, false, false]);
  eq('  모으기·순서 파일은 불러와도 아무것도 쓰지 않는다(관문이 불러 잰다)', /writeFileSync|appendFileSync|renameSync|unlinkSync|rmSync|mkdirSync/.test(plan), false);
  eq('  브라우저는 진짜로 열 때만 들여온다 — 가짜 관측·관문은 playwright 없이 돈다', [/await import\('playwright'\)/.test(runner), /from 'playwright'/.test(runner)], [true, false]);
}
