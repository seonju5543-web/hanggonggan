/* 「로봇·도구 점검 관문」 browser 묶음 — 브라우저 수집 대상·건강 장부 (2026-10-05 대대적 점검)
   잰다:
     ① 열쇠(B6) — 계명 page.jsp 의 목록 상태 값(pageRef·pagePrvNxt·pageOrder)은 글이 아니다: 새 글이 올라올 때마다 pageRef 가 바뀌어
        목록 40건이 통째로 '새 글'로 다시 들어왔다. urlKey·canonUrl 두 목록이 같은 뜻 · idFromUrl 공식 불변(저장된 id·blockIds) ·
        옛 열쇠로 적힌 장부는 rekeyLedger 가 잇는다(세 수집 로봇) · 썸네일 장부는 옮긴다
     ② 건강 장부(B4) — 열렸지만 장학 0건은 실패 · 예산 건너뜀은 건드리지 않음 · 브라우저 쪽 연속 횟수는 제 칸(browserFails)이라
        일반 로봇이 fails 를 0 으로 되돌려도 3에 닿는다 · 0건 날에도 알림 · 병합기도 그 칸을 안다
        + **진짜 browser-collect.mjs 를 임시 폴더에서 가짜 브라우저로 돌린다**(B4·B10·B5·B11 — 글자 검사만으로는 '되돌려도 통과'가 쉽다)
     ③ 문구(B5·B11) — 확인 안 한 원인('연결만 열어 두고'·'응답하지 않아')과 틀린 간격('약 12시간')을 쓰지 않는다
     ④ 남은 후보(B10) — 읽힌 주소가 나오면 남은 후보를 열지 않는다
     ⑤ 학교 도메인(collect-16) — schools.json 주소가 없는 학교는 브라우저 대상 첫 후보에서 · 두 판정 로봇이 한 함수를 쓴다
     ⑥ 활동·재단 출처 연속 실패 장부(collect-08) — ✅ 만 성공 · ⏰·⚙️ 는 안 셈 · 빠진 출처는 지움 · 6회면 🙋(0건 날 코멘트에도 실리는 꼴) ·
        저장·병합 배선
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말).
      로봇을 돌릴 때는 저장소 코드를 임시 폴더로 **복사**해 그 안의 표본만 읽고 쓴다(bodies.mjs sandbox). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stripComments, stripYamlComments } from './gate.mjs';
import { sandbox } from './bodies.mjs';
import { urlKey, rekeyLedger, rekeyKey, clickRowKey } from '../../collector/url-key.mjs';
import { canonUrl, idFromUrl } from '../../collector/canon-url.mjs';
import { targetOutcome, applyBrowserHealth, chronicList, CHRONIC_AT } from '../../collector/browser-health.mjs';
import { domainForSchool } from '../../collector/kind-evidence.mjs';
import { updateSourceHealth, staleSourcesLine, STALE_AT } from '../../collector/source-health.mjs';
import { fileURLToPath } from 'node:url';

/* 계명대 목록 상태 값만 다른 같은 글 둘 (2026-09-30 · 10-02 실측 꼴) */
const KMU = (ref, uid = '271062') => `https://www.kmu.ac.kr/uni/main/page.jsp?pageNo=1&pagePrvNxt=1&pageRef=${ref}&pageOrder=0&cmd=2&parm_bod_uid=${uid}&srchVoteType=-1&srchEnable=1&srchBgpUid=-1&srchKeyword=&srchSDate=&srchColumn=&srchEDate=&mnu_uid=145&`;

/* 가짜 브라우저 — 주소에 든 낱말로 행동이 갈린다 (browser-collect.mjs 가 부르는 것만).
     ok-board    : 장학 공고 링크 셋(상세 주소 view.do) — 클릭 채집이 안 돈다(진짜 상세 링크 3개 이상)
     empty-board : 열리지만 메뉴 링크뿐(장학 공고 0건 · 클릭할 행도 없음)
     fail-board  : 열기 실패(페이지가 닫힌다 — 재시도 대기 없이 바로 실패)
     그 밖(상세) : 본문 글자만 준다
   연 주소는 FAKE_PW_LOG 에 한 줄씩. */
const FAKE_PLAYWRIGHT = `import fs from 'node:fs';
const note = (m) => { if (process.env.FAKE_PW_LOG) fs.appendFileSync(process.env.FAKE_PW_LOG, m + '\\n'); };
const LINKS = {
  ok: [1, 2, 3].map((n) => ({ title: '2026학년도 2학기 표본재단 장학생 선발 공고 ' + n, url: 'https://fake.example/ok-board/view.do?id=' + n })),
  empty: [{ title: '학교소개', url: 'https://fake.example/about' }, { title: '입학안내', url: 'https://fake.example/admission' }, { title: '오시는 길', url: 'https://fake.example/map' },
    { title: '개인정보처리방침', url: 'https://fake.example/privacy' }, { title: '사이트맵', url: 'https://fake.example/sitemap' }, { title: '대학생활', url: 'https://fake.example/life' }],
};
function makePage() {
  let url = 'about:blank'; let closed = false;
  const kind = () => (/ok-board(?!\\/view)/.test(url) ? 'ok' : /empty-board/.test(url) ? 'empty' : 'detail');
  const frame = { $$eval: (sel) => Promise.resolve(sel === 'a[href]' ? (LINKS[kind()] || []) : []) };
  return {
    goto: async (u) => { url = u; note('goto ' + u); if (/fail-board/.test(u)) { closed = true; throw new Error('net::ERR_NAME_NOT_RESOLVED at ' + u); } },
    isClosed: () => closed,
    waitForTimeout: () => Promise.resolve(),
    url: () => url,
    frames: () => [frame],
    $$eval: () => Promise.resolve([]),
    $$: () => Promise.resolve([]),
    content: () => Promise.resolve('<html><body><h1>2026학년도 2학기 표본재단 장학생 선발 공고</h1><p>지원 대상은 국내 대학 재학생이며 신청 기간은 2026. 10. 20.까지입니다.</p></body></html>'),
    evaluate: () => Promise.resolve([]),
    close: async () => { closed = true; },
  };
}
export const chromium = {
  launch: async () => ({ newContext: async () => ({ newPage: async () => makePage(), waitForEvent: () => new Promise(() => {}), close: async () => {} }), close: async () => {} }),
};
`;

export default async function browser(eq, ctx) {
  const root = ctx.root;
  const readText = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');

  /* ── ① 열쇠 (B6) ── */
  {
    eq('① 계명 목록 상태 값(pageRef·pagePrvNxt·pageOrder)만 다른 같은 글 — urlKey 같다 · canonUrl 같다',
      [urlKey(KMU('271062')) === urlKey(KMU('271152')), canonUrl(KMU('271062')) === canonUrl(KMU('271152'))], [true, true]);
    eq('  글 번호(parm_bod_uid)가 다르면 다른 열쇠', urlKey(KMU('271062', '271062')) === urlKey(KMU('271062', '270261')), false);
    /* 공식 불변 — 이미 저장된 id·blockIds 가 그대로 맞아야 한다(canon-url.mjs 머리말). 기대값은 고치기 전 공식으로 뽑은 것 */
    eq('  idFromUrl 공식은 그대로 (성균관·서강·가천·계명 표본 — 고치기 전 값)',
      [idFromUrl('auto-', 'https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140331&article.offset=0&articleLimit=10'),
        idFromUrl('auto-', 'https://www.sogang.ac.kr/ko/detail/551052?bbsConfigFk=141&namepage=ScholarshipNotice'),
        idFromUrl('auto-', 'https://www.gachon.ac.kr/bbs/kor/478/121041/artclView.do'),
        idFromUrl('auto-', KMU('271062'))],
      ['auto-otice06doarticleno140331', 'auto-amepagescholarshipnotice', 'auto-skor478121041artclviewdo', 'auto-srchenable1srchvotetype1']);
    /* 두 목록 같은 뜻 — url-key.mjs VOLATILE 의 이름마다 canonUrl 도 그 값을 버린다 */
    const uk = stripComments(readText('collector/url-key.mjs'));
    const vol = ((uk.match(/const VOLATILE = new Set\(\[([\s\S]*?)\]\)/) || [])[1] || '').match(/'([^']+)'/g) || [];
    const names = vol.map((s) => s.slice(1, -1));
    eq('  url-key.mjs VOLATILE 을 읽었다 (계명 셋 포함)', ['pageRef', 'pagePrvNxt', 'pageOrder'].every((n) => names.includes(n)) && names.length >= 20, true);
    eq('  그 이름마다 canonUrl 도 버린다 (두 목록 같은 뜻 — 갈라지면 수집 열쇠와 등록 열쇠가 어긋난다)',
      names.filter((n) => canonUrl(`https://ex.ac.kr/b/view.do?id=9&${n}=7`).toLowerCase().includes(`${n.toLowerCase()}=`)), []);
    /* 장부 잇기 */
    const oldKey = `https://www.kmu.ac.kr/uni/main/page.jsp?cmd=2&mnu_uid=145&pageNo=1&pageOrder=0&pagePrvNxt=1&pageRef=271062&parm_bod_uid=271062&srchBgpUid=-1&srchEnable=1&srchVoteType=-1`;
    const oldKey2 = oldKey.replace('pageRef=271062', 'pageRef=271152');
    const clickOld = `click:${oldKey}|2026학년도장학생선발`;
    const L = { [oldKey]: '2026-09-30', [oldKey2]: '2026-10-02', [clickOld]: '2026-09-30', 'post:계명대학교:1': '2026-09-01', 'https://ex.ac.kr/a?id=1': '2026-09-03' };
    const added = rekeyLedger(L);
    const newKey = urlKey(oldKey);
    eq('  rekeyLedger — 새 열쇠가 생기고 여럿이 모이면 가장 이른 날짜 · click 열쇠는 목록 쪽만 · 옛 열쇠는 남긴다 · post: 는 그대로',
      [added, L[newKey], L[`click:${newKey}|2026학년도장학생선발`], L[oldKey], L['post:계명대학교:1'], Object.keys(L).length], [2, '2026-09-30', '2026-09-30', '2026-09-30', '2026-09-01', 7]);
    eq('  두 번 불러도 같다 (더한 수 0)', rekeyLedger(L), 0);
    eq('  click 열쇠 꼴은 clickRowKey 와 같다 (새 열쇠로 적는 쪽과 잇는 쪽이 같은 글자)', rekeyKey(clickOld), clickRowKey(oldKey, '2026학년도 장학생 선발'));
    eq('  썸네일 장부 열쇠(url:)도 같은 규칙', rekeyKey(`url:${oldKey}`), `url:${newKey}`);
    /* 배선 — 장부를 읽은 바로 다음 줄에서 잇는다 (안 하면 첫 실행에 그 게시판 글이 통째로 다시 '새 글') */
    const after = (src, v) => new RegExp(String.raw`try \{ ${v} = JSON\.parse\(fs\.readFileSync\(${v}Path, 'utf8'\)\); \} catch \{[^}]*\}\s*\nrekeyLedger\(${v}\);`).test(src);
    const bc = readText('collector/browser-collect.mjs'); const cm = readText('collector/collect.mjs'); const cn = readText('collector/collect-news.mjs');
    eq('  세 수집 로봇이 장부를 읽자마자 잇는다 (browser-collect·collect seen · collect seenAct·seenExt · collect-news seen-news)',
      [after(bc, 'seen'), after(cm, 'seen'), after(cm, 'seenAct'), after(cm, 'seenExt'), after(cn, 'seen')], [true, true, true, true, true]);
    const th = stripComments(readText('collector/collect-news-thumbs.mjs'));
    eq('  썸네일 로봇은 옛 열쇠를 새 열쇠로 옮긴다(옛 열쇠를 남기면 같은 사진의 다른 글로 보여 공통 그림이 된다) · 그림 주소 셈도',
      /const nk = rekeyKey\(k\);[\s\S]{0,120}delete ledger\.posts\[k\];/.test(th) && /\.map\(rekeyKey\)/.test(th), true);
  }

  /* ── ② 건강 장부 (B4) — 순수 함수 ── */
  {
    eq('② 학교 결과 — 열렸지만 장학 0건 empty · 읽음 ok · 시한 stalled · 예산 건너뜀 skipped · 못 엶 failed',
      [targetOutcome({ loadedAny: true, worked: false }), targetOutcome({ loadedAny: true, worked: true }), targetOutcome({ stalled: true }),
        targetOutcome({ skipped: true }), targetOutcome({ loadedAny: false })],
      ['empty', 'ok', 'stalled', 'skipped', 'failed']);
    /* 일반 로봇이 사이마다 같은 학교의 fails 를 0 으로 되돌려도(collect.mjs 는 fails·lastOk 만 고친다) 세 번째에 🚨 */
    const h = {};
    let chronic = [];
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      ({ chronic } = applyBrowserHealth(h, [{ name: 'X', outcome: 'empty' }], day));
      h.X.fails = 0; h.X.lastOk = day;   // 일반 로봇 흉내
    }
    eq(`  일반 로봇이 fails 를 되돌려도 ${CHRONIC_AT}회째에 연속으로 잡힌다 (브라우저 쪽 칸 browserFails)`,
      [chronic.map((c) => [c.name, c.n, c.why]), h.X.browserFails], [[['X', 3, '열렸지만 장학 공고 0건']], 3]);
    const s = { Y: { fails: 1, lastOk: '2026-09-01', browserFails: 1, browserWhy: '게시판을 열지 못함' } };
    applyBrowserHealth(s, [{ name: 'Y', outcome: 'skipped' }], '2026-10-05');
    eq('  예산으로 건너뛴 학교는 건드리지 않는다 (lastOk 를 오늘로 찍지 않는다)', s.Y, { fails: 1, lastOk: '2026-09-01', browserFails: 1, browserWhy: '게시판을 열지 못함' });
    applyBrowserHealth(s, [{ name: 'Y', outcome: 'ok' }], '2026-10-05');
    eq('  한 번 읽으면 0 부터 (이유 칸은 지운다)', s.Y, { fails: 0, lastOk: '2026-10-05', browserFails: 0 });
    const p = { P: { fails: 0, lastOk: '2026-10-05', browserFails: 4, browserWhy: '시한 안에 못 끝냄' }, Q: { fails: 0, lastOk: '2026-10-05' } };
    applyBrowserHealth(p, [{ name: 'Z', outcome: 'stalled' }], '2026-10-05');
    eq('  브라우저 대상에서 빠진 학교(보관)의 브라우저 칸은 지운다 · 다른 칸은 그대로 · 시한은 실패로 센다',
      [p.P, p.Q, p.Z], [{ fails: 0, lastOk: '2026-10-05' }, { fails: 0, lastOk: '2026-10-05' }, { fails: 1, lastOk: null, browserFails: 1, browserWhy: '시한 안에 못 끝냄' }]);
    eq('  알림·리포트 한 줄', chronicList([{ name: '홍', n: 3, why: '열렸지만 장학 공고 0건' }]), '홍(3회 연속 · 열렸지만 장학 공고 0건)');

    /* 병합기 — 브라우저 쪽 횟수도 작은 쪽(연속 실패 수를 큰 쪽으로 남기면 멀쩡한 학교에 🚨) */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-browser-merge-'));
    try {
      const w = (n, body) => { const f = path.join(tmp, n); fs.writeFileSync(f, `${JSON.stringify(body, null, 1)}\n`); return f; };
      /* 최근 성공(lastOk) 쪽 판이 브라우저 횟수는 더 크다 — 그 판을 통째로 고르면 3, 작은 쪽이면 1 */
      const ours = w('ours.json', { A: { fails: 0, lastOk: '2026-10-04', browserFails: 3, browserWhy: '게시판을 열지 못함' }, B: { fails: 0, lastOk: '2026-10-04' } });
      const theirs = w('theirs.json', { A: { fails: 1, lastOk: '2026-10-01', browserFails: 1 }, B: { fails: 0, lastOk: '2026-10-01', browserFails: 2 } });
      const r = spawnSync(process.execPath, [fileURLToPath(new URL('tools/merge-json-union.mjs', root)), w('base.json', {}), ours, theirs, 'collector/health.json'], { encoding: 'utf8' });
      const m = JSON.parse(fs.readFileSync(ours, 'utf8'));
      eq('  병합기(health.json) — browserFails 도 작은 쪽 · 한쪽 판에만 있으면 그 값',
        [r.status, m.A.fails, m.A.browserFails, m.A.lastOk, m.B.browserFails], [0, 0, 1, '2026-10-04', 2]);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

    /* 배선(글자) — 로봇이 규칙 한 곳을 부르고, 옛 판정 줄이 없고, 0건 날 알림이 있다 */
    const bc = stripComments(readText('collector/browser-collect.mjs'));
    eq('  browser-collect 가 browser-health.mjs 를 불러 applyBrowserHealth 로 적는다 · 옛 줄(stillFailed 만 보던 판정)은 없다',
      [/from '\.\/browser-health\.mjs'/.test(bc), /applyBrowserHealth\(health,/.test(bc), /if \(stillFailed\.includes\(name\)\) \{/.test(bc)], [true, true, false]);
    eq('  harvestTarget 이 읽힘(worked)을 돌려준다 — 이미 아는 공고만 있어 0건인 것도 읽은 것', /const read = uniq\.length > 0 \|\| r\.clickSkipped > 0;/.test(bc) && /return \{ loadedAny, worked \};/.test(bc), true);
    eq('  연속 실패를 리포트 머리에 · 워크플로 출력(chronic)으로', /report\.splice\(2, 0, `🚨/.test(bc) && /chronic=\$\{chronicList\(chronic\)/.test(bc), true);
    const yml = stripYamlComments(readText('.github/workflows/browser-collect.yml'));
    const step = yml.slice(yml.indexOf('name: 🚨 연속으로 공고를 못 읽은 학교 알림'), yml.indexOf('name: 🚨 데이터 감사 실패 알림'));
    eq('  워크플로 — 0건 날(리포트 이슈가 안 생기는 날)에만 최근 제 리포트 이슈에 코멘트 · 학교 이름은 env 로만',
      [/if: steps\.run\.outcome == 'success' && steps\.run\.outputs\.chronic != '' && steps\.run\.outputs\.new_count == '0' && github\.event_name != 'workflow_dispatch'/.test(step),
        /CHRONIC: \$\{\{ steps\.run\.outputs\.chronic \}\}/.test(step), /\$CHRONIC/.test(step), /run: \|[\s\S]*\$\{\{ steps\.run\.outputs\.chronic/.test(step),
        /--search '"브라우저형 수집 리포트" in:title'/.test(step), /continue-on-error: true/.test(step)],
      [true, true, true, false, true, true]);
  }

  /* ── ② ③ ④ 진짜 로봇을 임시 폴더에서 가짜 브라우저로 ── */
  {
    const sb = sandbox(root, 'hdj-browser-');
    try {
      sb.module('playwright', { 'package.json': '{"name":"playwright","type":"module","main":"index.js"}', 'index.js': FAKE_PLAYWRIGHT });
      sb.write('collector/browser-targets.json', { targets: [
        { school: '표본읽음대학교', campus: '', candidates: ['https://fake.example/ok-board/list.do', 'https://fake.example/second-board/list.do'] },
        { school: '표본빈대학교', campus: '', candidates: ['https://fake.example/empty-board/list.do'] },
        { school: '표본못엶대학교', campus: '', candidates: ['https://fake.example/fail-board/list.do'] },
      ], parked: [] });
      const health0 = {
        표본읽음대학교: { fails: 2, lastOk: '2026-09-01', browserFails: 2, browserWhy: '열렸지만 장학 공고 0건' },
        표본빈대학교: { fails: 0, lastOk: '2026-10-01', browserFails: 2, browserWhy: '열렸지만 장학 공고 0건' },
        보관된대학교: { fails: 0, lastOk: '2026-10-01', browserFails: 5, browserWhy: '시한 안에 못 끝냄' },
      };
      sb.write('collector/health.json', health0);
      const log = sb.abs('pw.log'); const out = sb.abs('gh-output.txt');
      const env = { FAKE_PW_LOG: log, GITHUB_OUTPUT: out, BROWSER_BOARD_PAGES: '1', BROWSER_PARALLEL: '1', HARVEST_BUDGET_MS: '600000', MIN_PER_TARGET_MS: '1000', TARGET_HARD_MS: '30000', DETAIL_BUDGET_MS: '60000' };   // 못 여는 주소는 재시도 대기 3초(gotoWithRetry)라 시한을 넉넉히
      const r = sb.run('collector/browser-collect.mjs', [], env, 60000);
      const rep = sb.read('collector/browser-report.md') || '';
      const h = sb.json('collector/health.json') || {};
      const visited = (sb.read('pw.log') || '').split('\n');
      eq('②④ 가짜 브라우저로 진짜 로봇 — 끝까지 돈다', [r.status, /browser-collect: 3 new items/.test(r.out)], [0, true]);
      eq('  ④ 읽힌 주소가 나오면 남은 후보는 열지 않는다 (둘째 후보를 한 번도 안 연다 · 리포트 한 줄)',
        [visited.some((l) => /second-board/.test(l)), /⏭ 남은 후보 1곳은 열지 않음/.test(rep)], [false, true]);
      eq('  ② 읽은 학교 0 · 열렸지만 장학 0건 학교는 브라우저 쪽 3회째 · 못 연 학교는 1회 · 보관된 학교는 브라우저 칸을 지운다',
        [[h.표본읽음대학교.fails, h.표본읽음대학교.browserFails, 'browserWhy' in h.표본읽음대학교, h.표본읽음대학교.lastOk !== '2026-09-01'],
          [h.표본빈대학교.browserFails, h.표본빈대학교.browserWhy, h.표본빈대학교.lastOk], [h.표본못엶대학교.browserFails, h.표본못엶대학교.browserWhy], h.보관된대학교],
        [[0, 0, false, true], [3, '열렸지만 장학 공고 0건', '2026-10-01'], [1, '게시판을 열지 못함'], { fails: 0, lastOk: '2026-10-01' }]);
      eq('  리포트 머리(제목 바로 아래)에 🚨 · 열렸지만 0건 요약 줄 · 워크플로 출력 chronic 한 줄',
        [/^## 🖥[^\n]*\n\n🚨 \*\*여러 번 연속 공고를 못 읽은 학교\*\*: 표본빈대학교\(3회 연속 · 열렸지만 장학 공고 0건\)/.test(rep),
          /⚪ \*\*열렸지만 장학 공고를 하나도 못 알아본 학교 1곳\*\*: 표본빈대학교/.test(rep),
          (sb.read('gh-output.txt') || '').split('\n').filter((l) => l.startsWith('chronic=')),
          /⚠️ \*\*이번 실행에 접속 실패한 학교: 표본못엶대학교\*\* — 게시판을 열지 못했어요/.test(rep)],
        [true, true, ['chronic=표본빈대학교(3회 연속 · 열렸지만 장학 공고 0건)'], true]);
      eq('  ③ 리포트에 확인 안 한 원인·틀린 간격이 없다', /연결만 열어 두고|학교 서버가 응답하지 않아|약 12시간/.test(rep), false);

      /* 예산에 걸려 모두 건너뛴 실행 — 장부를 건드리지 않는다(예전엔 안 본 학교를 '오늘 성공'으로 적었다) */
      const before = sb.json('collector/health.json');
      const r2 = sb.run('collector/browser-collect.mjs', [], { ...env, HARVEST_BUDGET_MS: '1000', MIN_PER_TARGET_MS: '999999', GITHUB_OUTPUT: sb.abs('gh-output2.txt') }, 60000);
      eq('  ② 예산으로 모두 건너뛴 실행은 건강 장부를 그대로 둔다 · 출력 chronic 은 빈 줄',
        [r2.status, JSON.stringify(sb.json('collector/health.json')) === JSON.stringify(before), (sb.read('gh-output2.txt') || '').split('\n').filter((l) => l.startsWith('chronic='))],
        [0, true, ['chronic=']]);
    } finally { sb.done(); }
  }

  /* ── ③ 문구 (B5·B11) — 확인 안 한 원인 · 틀린 간격 ── */
  {
    const bc = stripComments(readText('collector/browser-collect.mjs'));
    eq('③ 브라우저 리포트 문구에 확인 안 한 원인(연결만 열어 두고 · 학교 서버가 응답하지 않아)과 틀린 간격(약 12시간)이 없다',
      ['연결만 열어 두고', '학교 서버가 응답하지 않아', '약 12시간'].filter((w) => bc.includes(w)), []);
  }

  /* ── ④ 남은 후보 (B10) — 글자 ── */
  {
    const bc = stripComments(readText('collector/browser-collect.mjs'));
    const fn = bc.slice(bc.indexOf('async function harvestTarget('), bc.indexOf('const PARALLEL ='));
    eq('④ harvestTarget — 읽힌 뒤 남은 후보를 열던 줄(|| harvested) continue)이 없고, 남은 후보 줄과 break 가 있다',
      [/\|\| harvested\) continue;/.test(fn), /남은 후보 \$\{left\}곳은 열지 않음/.test(fn), (fn.match(/\bbreak;/g) || []).length >= 2], [false, true, true]);
  }

  /* ── ⑤ 학교 도메인 (collect-16) ── */
  {
    eq('⑤ schools.json 주소가 없는 학교는 브라우저 대상 첫 후보에서 · 있으면 그쪽 · 어디에도 없으면 빈 값 · 보관은 안 본다',
      [domainForSchool('고려대학교', [{ school: '고려대학교', boardUrl: null }], [{ school: '고려대학교', candidates: ['https://www.korea.ac.kr/ko/568/subview.do'] }]),
        domainForSchool('경희대학교', [{ school: '경희대학교', boardUrl: 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do' }], [{ school: '경희대학교', candidates: ['https://other.ac.kr/x'] }]),
        domainForSchool('없는대학교', [{ school: '고려대학교', boardUrl: null }], []),
        domainForSchool('부산대학교', [], [{ school: '부산대학교', candidates: [] }])],
      ['korea.ac.kr', 'khu.ac.kr', '', '']);
    for (const f of ['collector/kind-classify.mjs', 'collector/scope-promote.mjs']) {
      const src = stripComments(readText(f));
      eq(`  ${f} — 제 사본(domainOf = schools.find …)이 없고 domainForSchool 을 불러 쓴다`,
        [/const domainOf = \(school\) => \{ const row = schools\.find\(/.test(src), /import \{[^}]*domainForSchool[^}]*\} from '\.\/kind-evidence\.mjs'/.test(src), /domainForSchool\(school, schools, browserTargets\)/.test(src)],
        [false, true, true]);
    }
  }

  /* ── ⑥ 활동·재단 출처 연속 실패 장부 (collect-08) ── */
  {
    const A = 'https://a.example/board'; const B = 'https://b.example/board'; const C = 'https://c.example/board';
    const L = {};
    let stale = [];
    for (let i = 0; i < STALE_AT; i++) ({ stale } = updateSourceHealth(L, [{ key: A, name: '가', status: '⚠️ 접속 실패 (HTTP 404) — 주소 수정 필요' }, { key: B, name: '나', status: '🟡 접속은 되지만 활동·공모전 글을 찾지 못함' }], '2026-10-05', { live: [A, B, C] }));
    eq(`⑥ ${STALE_AT}회 연속 못 내면 🙋 대상 — ⚠️ 도 🟡 도 실패로 센다`, stale.map((s) => [s.name, s.n]), [['가', STALE_AT], ['나', STALE_AT]]);
    updateSourceHealth(L, [{ key: A, name: '가', status: '✅ 정상 (활동·공모전 3건 감지)' }, { key: B, name: '나', status: '⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀' }], '2026-10-06', { live: [A, B] });
    eq('  ✅ 한 번이면 0 · ⏰ 는 그대로(성공도 실패도 아니다) · 출처 목록에서 빠진 주소는 지운다', [L[A], L[B].fails, C in L], [{ name: '가', fails: 0, lastOk: '2026-10-06' }, STALE_AT, false]);
    updateSourceHealth(L, [{ key: A, name: '가', status: '⛔ robots.txt 가 막아 둔 주소' }, { key: A, name: '가2', status: '✅' }], '2026-10-07', { live: [A] });
    eq('  같은 주소를 두 출처가 쓰면 한 실행에 한 번만 — 하나라도 ✅ 면 성공 · 목록에서 빠진 B 는 지운다', [L[A].fails, B in L], [0, false]);
    const line = staleSourcesLine([{ name: '정부24 공모전', why: '⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다', n: 6 }]);
    const yml = readText('.github/workflows/collect-scholarships.yml');
    const grepRe = ((yml.match(/feedlines=\$\(grep -E '([^']+)'/) || [])[1] || '').replace(/^\^/, '^');
    eq('  🙋 한 줄 — 0건 날 코멘트(collect-scholarships.yml 의 grep)에도 실린다 · 상태는 앞부분만',
      [grepRe ? new RegExp(grepRe, 'u').test(line) : 'grep 줄을 못 찾음', line.includes('정부24 공모전(⛔ robots.txt 가 막아 둔 주소 · 6회 연속)'), staleSourcesLine([])], [true, true, '']);
    const cm = stripComments(readText('collector/collect.mjs'));
    eq('  수집 로봇이 장부를 쓰고(저장 목록 검사가 찾는 꼴) 규칙 한 곳을 부르며 리포트 머리에 싣는다 · 활동·재단 상태 줄에 주소 열쇠',
      [/fs\.writeFileSync\(new URL\('source-health\.json', HERE\), JSON\.stringify\(sourceHealth, null, 1\)\)/.test(cm), /from '\.\/source-health\.mjs'/.test(cm),
        /if \(staleSources\.length\) lines\.push\(staleSourcesLine\(staleSources\), ''\);/.test(cm), (cm.match(/key: s\.boardUrl/g) || []).length >= 6],
      [true, true, true, true]);
    eq('  저장 목록 · 병합 규칙(.gitattributes 와 병합기 둘 다)',
      [/git add collector\/source-health\.json/.test(stripYamlComments(yml)), /collector\/source-health\.json\s+merge=jsonunion/.test(readText('.gitattributes')),
        /\{ match: \/\(\^\|\\\/\)source-health\\\.json\$\/, merge: mergeHealth \}/.test(readText('tools/merge-json-union.mjs'))],
      [true, true, true]);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-source-merge-'));
    try {
      const w = (n, body) => { const f = path.join(tmp, n); fs.writeFileSync(f, `${JSON.stringify(body, null, 1)}\n`); return f; };
      const ours = w('ours.json', { [A]: { name: '가', fails: 7, lastOk: '2026-09-28', why: '🟡' } });
      const theirs = w('theirs.json', { [A]: { name: '가', fails: 0, lastOk: '2026-10-04' }, [B]: { name: '나', fails: 2, lastOk: null } });
      const r = spawnSync(process.execPath, [fileURLToPath(new URL('tools/merge-json-union.mjs', root)), w('base.json', {}), ours, theirs, 'collector/source-health.json'], { encoding: 'utf8' });
      const m = JSON.parse(fs.readFileSync(ours, 'utf8'));
      eq('  병합기가 이 장부를 안다 — 최근 성공 쪽 · 실패 수는 작은 쪽 · 합집합', [r.status, m[A].fails, m[A].lastOk, !!m[B]], [0, 0, '2026-10-04', true]);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
}
