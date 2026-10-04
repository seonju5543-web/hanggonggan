/* 「원문 링크 정직성」 — admin 갈래 (2026-10-04 · 개발자 지시 *"정확하게 표시되지 않는 부분에 대해서는 관리자 페이지에 원문 공고를 추가할 수 있는 칸을 제작"*)
   관리자가 넣는 원문 주소가 ① 받아도 되는 꼴인지(collector/link-fix.mjs checkFixUrl — 화면·저장소 공용)
   ② 저장소(tools/admin-apply.mjs linkFix·linkUnfix)가 **장부 하나만** 고치는지 · 누가·회차를 요청이 아니라 저장소가 정하는지
   ③ 그 장부로 앱의 링크 이름 한 곳(source-link.js)이 '원문 공고'라고 부르는지 — 를 잰다.
   🔴 가짜 자료만 쓴다(수집 로봇도 이 관문을 돈다 — 실데이터 건수에 기대지 않는다). 화면 자체는 verify/verify-admin.js 가 브라우저로 잰다. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default async function gate(eq, ctx) {
  const SL = require('../../source-link.js');
  const { RULES } = require('../entry-rules.cjs');
  const LF = await import('../../collector/link-fix.mjs');
  const chk = (u, from = '') => LF.checkFixUrl(u, { from, L: SL, downloadRe: RULES.DOWNLOAD_URL });
  const errs = (u, from) => chk(u, from).errors.join(' | ');

  /* ① 받아도 되는 주소인가 — 원문이 아닌 꼴은 전부 막고, 보통 글 주소는 되푼 채로 받는다 */
  const good = chk('https://a.kr/bbs/view.do?mod=document&#038;uid=392', 'https://a.kr/bbs/list.do#n-x');
  eq('① 보통 글 주소는 받는다 — HTML 기호(&#038;)는 되푼 주소로 · 같은 사이트면 확인할 것 없음',
    [good.errors, good.url, good.warns], [[], 'https://a.kr/bbs/view.do?mod=document&uid=392', []]);
  eq('  막는 꼴 — 빈칸 · 공백 · http 아님 · 600자 넘음 · 점 없는 도메인 · 목록 표식 · 목록+번호 · 첫 화면 파일 · 첨부 내려받기 · 집계 사이트 · kosaf.go.kr · 지금 링크와 같음',
    [
      /비어/.test(errs('')),
      /빈칸/.test(errs('https://a.kr/view?id=1 https://b.kr')),
      /http/.test(errs('javascript:alert(1)')),
      /너무 깁니다/.test(errs(`https://a.kr/view?id=${'1'.repeat(620)}`)),
      /도메인/.test(errs('https://localhost/view?id=1')),
      /목록 표식/.test(errs('https://a.kr/bbs/list.do#n-%ED%91%9C')),
      /글 번호만/.test(errs('https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125842')),
      /첫 화면/.test(errs('https://found.or.kr/index.htm')),
      /내려받기/.test(errs('https://a.kr/bbs/view.do?mode=download&attachNo=3')),
      /집계 사이트/.test(errs('https://linkareer.com/activity/12345')),
      /kosaf\.go\.kr/.test(errs('https://www.kosaf.go.kr/ko/scholar.do?pg=x&id=3')),
      /같은 주소/.test(errs('https://a.kr/view.do?id=3', 'https://a.kr/view.do?id=3')),
    ], Array(12).fill(true));
  const other = chk('https://b.or.kr/notice/view?no=5', 'https://a.kr/bbs/list.do#n-x');
  const root = chk('https://maicon.kr/', 'https://a.kr/bbs/list.do#n-x');
  eq('  경고(받되 한 번 더 확인) — 지금 링크와 다른 사이트 · 맨 도메인(공모전 전용 사이트만)',
    [other.errors.length, /사이트가 다릅니다/.test(other.warns.join()), root.errors.length, /맨 도메인/.test(root.warns.join())], [0, true, 0, true]);
  eq('  주소 규칙(source-link.js)을 못 받으면 받지 않는다 — 규칙을 여기 베끼지 않았다',
    [LF.checkFixUrl('https://a.kr/view?id=1', {}).errors.length > 0, /HOME_FILE_RE|LIST_PLUS_ID_RE|#0\*38/.test(fs.readFileSync(new URL('collector/link-fix.mjs', ctx.root), 'utf8'))], [true, false]);

  /* ② 장부 열쇠 — source-link.js fixKeys 가 찾는 글자와 같다 */
  const feed = { title: '표본', url: 'https://a.kr/x.do?m=1&#038;id=2' };
  const kraw = { code: '0001', org: '표본재단', name: '표본 장학', due: '2026-11-30', home: 'https://found.or.kr' };
  eq('② 열쇠 — 정식 등록 id: · 층2 id:kosaf-<코드> · 피드는 u:<되푼 지금 주소> · 앱이 같은 열쇠로 찾는다',
    [LF.fixKeyFor('registered', { id: 'r1', sourceUrl: 'https://a.kr' }, SL), LF.fixKeyFor('kosaf', kraw, SL), LF.fixKeyFor('news', feed, SL),
      SL.fixKeys(LF.linkItemOf('kosaf', kraw)).includes(LF.fixKeyFor('kosaf', kraw, SL)), SL.fixKeys(feed).includes(LF.fixKeyFor('news', feed, SL))],
    ['id:r1', 'id:kosaf-0001', 'u:https://a.kr/x.do?m=1&id=2', true, true]);
  eq('  층2 모양은 앱(kosafAsScholarships)과 같은 칸 — id · sourceKind · 재단 홈 · 마감 = due',
    (({ id, sourceKind, sourceUrl, deadline }) => [id, sourceKind, sourceUrl, deadline])(LF.linkItemOf('kosaf', kraw)), ['kosaf-0001', 'kosaf', 'https://found.or.kr', '2026-11-30']);
  const appJs = fs.readFileSync(new URL('app.js', ctx.root), 'utf8');
  eq('  (앱이 정말 그 칸으로 만든다 — 모양이 갈라지면 바로잡기가 조용히 안 걸린다)',
    [/id: `kosaf-\$\{i\.code\}`/.test(appJs) || /`kosaf-\$\{i\.code\}`/.test(appJs), /deadline: i\.due \|\| null/.test(appJs), /sourceUrl: i\.home \|\| ''/.test(appJs), /sourceKind: 'kosaf'/.test(appJs)], [true, true, true, true]);

  /* ③ 집계 사이트 정규식은 한 곳 — 화면·저장소가 link-fix.mjs 의 것을 부른다 */
  const aa = fs.readFileSync(new URL('tools/admin-apply.mjs', ctx.root), 'utf8');
  const adminJs = fs.readFileSync(new URL('_admin/admin.js', ctx.root), 'utf8');
  eq('③ 집계 사이트 목록은 collector/link-fix.mjs 한 곳 — 저장소·관리자 화면이 불러 쓴다(베낀 정규식 없음)',
    [/AGGREGATOR_RE[^\n]*from '\.\.\/collector\/link-fix\.mjs'/.test(aa), /AGGREGATOR_RE[^\n]*from '\.\/vendor\/link-fix\.mjs'/.test(adminJs), /linkareer\|wevity/.test(aa), /linkareer\|wevity/.test(adminJs)],
    [true, true, false, false]);

  /* ④ 저장소(admin-apply linkFix·linkUnfix)를 진짜 자식 프로세스로 — 임시 폴더의 가짜 자료로 */
  const script = fileURLToPath(new URL('tools/admin-apply.mjs', ctx.root));
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const MARK = 'https://a.kr/bbs/list.do#n-%ED%91%9C%EB%B3%B8';
  const NMARK = 'https://n.ac.kr/bbs/list.do#n-%EC%86%8C%EC%8B%9D';
  const FEED = 'https://f.ac.kr/b/list.do?mode=view&#038;no=7';
  const seed = {
    'data/registered.json': { items: [{ id: 'reg-m', name: '표본 목록 공고', type: '교외', provider: '표본', sourceUrl: MARK, deadline: '2026-12-01' }] },
    'data/forms.json': { forms: {}, templates: {} },
    'data/admin-log.json': { items: [] },
    'data/kosaf-open.json': { items: [kraw, { code: '0002', org: '마감모름재단', name: '표본 2', due: '', home: 'https://nodue.or.kr' }] },
    'data/notices/index.json': { files: { 가대학교: { file: 'aaaa.json', count: 1 } } },
    'data/notices/aaaa.json': { school: '가대학교', items: [{ title: '표본 피드 공고', url: FEED, school: '가대학교', campus: '' }] },
    'data/news/index.json': { files: { 가대학교: { file: 'bbbb.json', count: 1 } } },
    'data/news/bbbb.json': { school: '가대학교', items: [{ title: '표본 소식', url: NMARK, school: '가대학교', campus: '', postId: '77' }] },
    'data/external.json': { items: [] },
    'data/activities.json': { items: [] },
    'data/link-fixes.json': { v: 1, note: '표본', updatedAt: '', fix: {} },
  };
  const run = (action, payload, pre = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linkfix-'));
    const files = { ...seed, ...pre };
    for (const [rel, doc] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), `${JSON.stringify(doc, null, 1)}\n`);
    }
    const before = Object.fromEntries(Object.keys(files).map((rel) => [rel, fs.readFileSync(path.join(dir, rel), 'utf8')]));
    const r = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8', env: { ...process.env, ACTION: action, ACTOR: 'gate-actor', PAYLOAD: JSON.stringify(payload) } });
    const text = fs.readFileSync(path.join(dir, 'data/link-fixes.json'), 'utf8');
    const changed = Object.keys(files).filter((rel) => fs.readFileSync(path.join(dir, rel), 'utf8') !== before[rel]).sort();
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`, text, doc: JSON.parse(text), changed };
  };
  const REAL = 'https://a.kr/bbs/view.do?id=55';
  const a = run('linkFix', { fixes: [{ ds: 'registered', id: 'reg-m', from: MARK, url: REAL, title: '표본 원문 제목', note: 'x'.repeat(300), by: '가짜 이름', at: '1999-01-01', round: '1999-01-01' }] });
  const ea = a.doc.fix['id:reg-m'] || {};
  eq('④ linkFix — 장부(data/link-fixes.json)와 변경 이력만 고친다 · 데이터 파일의 주소는 그대로(로봇이 다시 만든다)',
    [a.status, a.changed], [0, ['data/admin-log.json', 'data/link-fixes.json']]);
  eq('  누가 = 워크플로 ACTOR · 언제 = 오늘(한국 시간) · 회차는 층2만 · 메모 200자 상한 · 요청의 by·at·round 는 무시',
    [ea.url, ea.by, ea.at, 'round' in ea, ea.title, (ea.note || '').length], [REAL, 'gate-actor', today, false, '표본 원문 제목', 200]);
  eq('  파일 꼴 = 로봇과 같은 JSON.stringify(x, null, 1) · v·note 유지', [a.text === `${JSON.stringify(a.doc, null, 1)}\n`, a.doc.v, a.doc.note], [true, 1, '표본']);
  const rejected = [
    'https://a.kr/bbs/list.do#n-%EB%8B%A4%EB%A5%B8',
    'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125842',
    'https://found.or.kr/index.htm',
    'https://www.kosaf.go.kr/ko/notice.do?mode=view&seqNo=1',
    'https://a.kr/bbs/view.do?mode=download&attachNo=3',
  ].map((u) => run('linkFix', { fixes: [{ ds: 'registered', id: 'reg-m', from: MARK, url: u }] }));
  eq('  거절 — 목록 표식 · 목록+번호 · 첫 화면 파일 · kosaf.go.kr · 첨부 내려받기 (장부는 그대로)',
    rejected.map((r) => [r.status !== 0, r.changed.length]), Array(5).fill([true, 0]));
  const moved = run('linkFix', { fixes: [{ ds: 'registered', id: 'reg-m', from: 'https://a.kr/old.do#n-x', url: REAL }] });
  const forced = run('linkFix', { fixes: [{ ds: 'registered', id: 'reg-m', from: 'https://a.kr/old.do#n-x', url: REAL }], force: true });
  eq('  화면이 본 주소(from)가 지금 데이터와 다르면 멈춘다 — 현재 주소를 말한다 · force 면 받는다',
    [moved.status !== 0, moved.out.includes(`그 사이 로봇이 주소를 바꿨습니다: 현재 ${MARK}`), moved.changed.length, forced.status], [true, true, 0, 0]);
  const k = run('linkFix', { fixes: [{ ds: 'kosaf', code: '0001', from: 'https://found.or.kr', url: 'https://found.or.kr/bbs/view?no=5', round: '2020-01-01' }] });
  const kn = run('linkFix', { fixes: [{ ds: 'kosaf', code: '0002', from: 'https://nodue.or.kr', url: 'https://nodue.or.kr/bbs/view?no=1' }] });
  eq('  층2 — 열쇠 id:kosaf-<코드> · 회차 = 지금 데이터의 마감(요청의 round 무시) · 마감 모르는 재단은 거절(회차를 못 묶는다)',
    [k.status, (k.doc.fix['id:kosaf-0001'] || {}).round, kn.status !== 0, kn.changed.length], [0, '2026-11-30', true, 0]);
  const f = run('linkFix', { fixes: [{ ds: 'notices', from: FEED, url: 'https://f.ac.kr/b/view.do?no=7' }, { ds: 'news', from: NMARK, url: 'https://n.ac.kr/bbs/view.do?id=77' }] });
  eq('  피드(학교별 실시간 공고 · 소식) — 열쇠 u:<되푼 지금 주소> · 두 건을 한 번에',
    [f.status, Object.keys(f.doc.fix).sort()], [0, ['u:https://f.ac.kr/b/list.do?mode=view&no=7', `u:${NMARK}`].sort()]);
  eq('  모르는 묶음 · 없는 글은 거절',
    [run('linkFix', { fixes: [{ ds: 'notices.json', from: FEED, url: REAL }] }).status !== 0, run('linkFix', { fixes: [{ ds: 'news', from: 'https://n.ac.kr/none#n-x', url: REAL }] }).status !== 0],
    [true, true]);
  const pre = { 'data/link-fixes.json': { v: 1, note: '표본', updatedAt: '', fix: { 'id:reg-m': { url: REAL, by: 'x', at: '2026-10-04' }, 'u:https://z.kr/a#n-y': { url: 'https://z.kr/v?id=1', by: 'x', at: '2026-10-04' } } } };
  const un = run('linkUnfix', { keys: ['u:https://z.kr/a#n-y'] }, pre);
  eq('  linkUnfix — 열쇠만 뺀다 · 없는 열쇠면 거절',
    [un.status, Object.keys(un.doc.fix), un.changed, run('linkUnfix', { keys: ['id:none'] }, pre).status !== 0], [0, ['id:reg-m'], ['data/admin-log.json', 'data/link-fixes.json'], true]);

  /* ⑤ 그 장부로 앱의 링크 이름 한 곳이 '원문 공고'라고 부른다 — 층2는 회차가 바뀌면 다시 재단 홈페이지 */
  const reset = () => { SL.setLinkChecks(null); SL.setLinkFixes(null); };
  reset();
  SL.setLinkFixes(a.doc);
  const regLink = SL.sourceLink(seed['data/registered.json'].items[0], 'detail');
  SL.setLinkFixes(k.doc);
  const kosLink = SL.sourceLink(LF.linkItemOf('kosaf', kraw), 'detail');
  const kosNext = SL.sourceLink(LF.linkItemOf('kosaf', { ...kraw, due: '2027-11-30' }), 'detail');
  SL.setLinkFixes(f.doc);
  const feedCard = SL.sourceLink(seed['data/notices/aaaa.json'].items[0], 'card');
  reset();
  eq('⑤ 저장한 장부로 — 정식 등록 표식은 「원문 공고 ↗」(그 주소) · 층2 이번 회차는 원문 · 다음 회차는 다시 「재단 홈페이지 ↗」 · 피드 카드는 「원문 보기 ↗」',
    [[regLink.label, regLink.href], kosLink.label, kosNext.label, feedCard.label],
    [['원문 공고 ↗', REAL], '원문 공고 ↗', '재단 홈페이지 ↗', '원문 보기 ↗']);

  /* ⑥ 배선 — 워크플로가 장부를 저장하고 작업 이름을 안다 · 관리자 화면이 같은 규칙 파일을 vendor 로 받는다 */
  const ay = fs.readFileSync(new URL('.github/workflows/admin-apply.yml', ctx.root), 'utf8');
  const sh = fs.readFileSync(new URL('_admin/build.sh', ctx.root), 'utf8');
  const html = fs.readFileSync(new URL('_admin/index.html', ctx.root), 'utf8');
  const iSl = html.indexOf('src="vendor/source-link.js"');
  eq('⑥ 배선 — 관리자 워크플로가 data/link-fixes.json 을 저장 · build.sh 가 source-link.js·link-fix.mjs 를 옮김 · 화면이 admin.js 보다 먼저 source-link.js 를 싣는다(entry-rules 의 가짜 module 보다도 먼저)',
    [/git add data\/link-fixes\.json/.test(ay), /linkFix \/ linkUnfix/.test(ay), /cp source-link\.js "\$OUT\/vendor\/source-link\.js"/.test(sh), /cp collector\/link-fix\.mjs "\$OUT\/vendor\/link-fix\.mjs"/.test(sh),
      iSl > 0 && iSl < html.indexOf('src="admin.js"') && iSl < html.indexOf('src="vendor/entry-rules.js"')],
    [true, true, true, true, true]);
}
