/* 「로봇·도구 점검 관문」 links 묶음 — 원문 링크 로봇 잔여 · 자동 등록 id (2026-10-05 대대적 점검)
   잰다:
     ① 자동 등록 id 겹침 (links-new-1): id 공식(정렬한 주소의 끝 24자)이 게시판 공통값을 잡는 게시판에서 그 게시판 글이 전부 같은 id 를 받아
        한 글이 등록되면 나머지가 '이미 등록(같은 id)', 사람이 한 글을 막으면 나머지가 '사람이 막아 둔 공고'로 **조용히** 빠졌다(9개교 70여 건) —
        공식은 그대로 두고 겹칠 때만 꼬리표 id(canon-url.mjs registerId 한 곳) · **진짜 auto-register.mjs·admin-apply.mjs 를 임시 폴더에서 돌린다**
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments } from './gate.mjs';
import { sandbox } from './bodies.mjs';
import { canonUrl, idFromUrl, idHash, registerId } from '../../collector/canon-url.mjs';
import { urlKey, noticeUrlRank, preferNotice } from '../../collector/url-key.mjs';
import { stripSessionId } from '../../collector/board-links.mjs';
import { rowDetailCandidates, cleanStoredUrl } from '../../collector/detail-url.mjs';
import { recordAttempt, escalationLines, pruneHuntState } from '../../collector/link-hunt-rules.mjs';

/* 경기대 eGov 게시판 꼴 — 글 번호(nttNo)는 가운데, 끝은 게시판 공통값(searchKrwd·sf.pnos) */
const KGU = (ntt, sess = '') => `https://www.kyonggi.ac.kr/www/selectBbsNttView.do${sess}?key=7520&bbsNo=1073&nttNo=${ntt}&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888`;
/* 서강대 꼴 — 끝이 namepage=ScholarshipNotice */
const SGU = (n) => `https://www.sogang.ac.kr/ko/detail/${n}?bbsConfigFk=141&namepage=ScholarshipNotice`;

/* 저장소 코드를 임시 폴더로 복사 — 자동 등록은 verify/*.cjs(등록 규칙)도 부른다 */
function repoSandbox(root, prefix) {
  const sb = sandbox(root, prefix);
  const vdir = fileURLToPath(new URL('verify/', root));
  for (const f of fs.readdirSync(vdir)) if (f.endsWith('.cjs')) sb.write(`verify/${f}`, fs.readFileSync(path.join(vdir, f), 'utf8'));
  return sb;
}

export default async function links(eq, ctx) {
  const root = ctx.root;

  /* ── ① 자동 등록 id 겹침 ── */
  {
    eq('① id 공식은 그대로 — 저장된 id·blockIds 가 안 바뀐다 (항공대 · 서강대 · 경기대 표본)',
      [idFromUrl('auto-', 'https://kau.ac.kr/kaulife/scholnoti.php?code=s1301&page=3&mode=read&seq=10681'), idFromUrl('auto-', SGU(550536)), idFromUrl('auto-', KGU(626271))],
      ['auto-notiphpcodes1301seq10681', 'auto-amepagescholarshipnotice', 'auto-hkrwdsfpnos1073sfpnos888']);
    const A = KGU(626271); const B = KGU(626377);
    const holder = (l) => (l === idFromUrl('auto-', A) ? canonUrl(A) : null);
    const rB = registerId('auto-', B, { holderCanon: holder });
    const rA = registerId('auto-', A, { holderCanon: holder });
    eq('① 같은 게시판의 다른 글(경기대 626377)은 옛 id 가 같아도 꼬리표 id — 같은 주소(626271)는 옛 id 그대로 · 두 번 불러도 같다',
      [idFromUrl('auto-', A) === idFromUrl('auto-', B), rB.id === rB.legacy, rB.id.startsWith(`${rB.legacy}-`), rB.id === rA.id, rA.id, registerId('auto-', B, { holderCanon: holder }).id === rB.id,
        rB.id === `${rB.legacy}-${idHash(canonUrl(B))}`, /^[0-9a-z]{7}$/.test(idHash(canonUrl(B)))],
      [true, false, true, false, 'auto-hkrwdsfpnos1073sfpnos888', true, true, true]);
    eq('① 그 id 를 아무도 안 쓰면 옛 id 그대로 · 주소 없는 등록분이 쥐고 있어도 겹친 것으로 본다',
      [registerId('auto-', B).id, registerId('auto-', B, { holderCanon: () => '' }).id === registerId('auto-', B).id], ['auto-hkrwdsfpnos1073sfpnos888', false]);
    const blockedIds = new Set(['auto-amepagescholarshipnotice']);
    const blockedCanons = new Set([canonUrl(SGU(550536))]);
    const amb = registerId('auto-', SGU(551052), { blockedIds, blockedCanons, ambiguous: () => true });
    const ambBlocked = registerId('auto-', SGU(550536), { blockedIds, blockedCanons, ambiguous: () => true });
    const single = registerId('auto-', SGU(551052), { blockedIds, blockedCanons, ambiguous: () => false });
    eq('① 막힌 id 를 여러 글이 받으면 막은 주소만 막는다(서강대 551052 는 풀림 · 550536 은 옛 id 그대로 → 주소·id 로 막힘) · 글이 하나뿐이면 예전처럼 막는다',
      [amb.blockedByLegacy, amb.id !== amb.legacy, blockedIds.has(amb.id), ambBlocked.id, ambBlocked.blockedByLegacy, single.blockedByLegacy, single.id],
      [false, true, false, 'auto-amepagescholarshipnotice', false, true, 'auto-amepagescholarshipnotice']);

    /* 진짜 자동 등록을 사본 저장소에서 — 불러오는 순간 실행되는 파일이라 import 하지 않는다 */
    const sb = repoSandbox(root, 'hdj-links-areg-');
    try {
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const shift = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
      const KMU = (uid) => `https://www.kmu.example.ac.kr/uni/main/page.jsp?pageNo=1&cmd=2&parm_bod_uid=${uid}&srchVoteType=-1&srchEnable=1&mnu_uid=145&`;
      const ID_ONLY = 'auto-' + canonUrl(KMU(1)).replace(/[^a-z0-9]/gi, '').slice(-24).toLowerCase();
      sb.write('collector/auto-register-config.json', { enabled: true, schools: [], maxPerRun: 8, blockIds: ['auto-amepagescholarshipnotice', ID_ONLY, 'auto-notiphpcodes1301seq10871'], blockUrls: [SGU(550536)] });
      const N = (title, url, school) => ({ title, url, school, foundAt: today, bodyDeadline: shift(20), bodyDeadlineText: `신청기간 : ~ ${shift(20)}` });
      sb.write('data/notices.json', { items: [
        N('2026학년도 2학기 표본재단 장학생 선발 안내', A, '경기대학교'),
        N('[(재)표본인재진흥원] 2026년 하반기 장학생 선발 안내', B, '경기대학교'),
        N('[교외] 해동표본재단 장학생 선발 안내', SGU(551490), '서강대학교'),
        N('[교외] 미래표본장학회 장학생 선발 안내', SGU(551052), '서강대학교'),
        N('[교외] 사람이 막은 표본 장학생 선발 안내', SGU(550536), '서강대학교'),
        N('[교내] 2026학년도 2학기 표본 외국어성적장학금 신청 안내', KMU(270851), '계명대학교'),
        N('[교외] 2026학년도 2학기 표본시민장학재단 장학생 선발', KMU(270575), '계명대학교'),
        N('2026학년도 산학표본재단 장학생 선발 안내', 'https://kau.example.ac.kr/kaulife/scholnoti.php?code=s1301&mode=read&seq=10871', '한국항공대학교'),
        N('[국가근로] 2026학년도 2학기 국가근로장학생 최종선발자 공지', 'https://dsu.example.ac.kr/bbs/view.do?seq=90001', '표본대학교'),
      ] });
      sb.write('data/registered.json', { items: [
        { id: idFromUrl('auto-', A), name: '2026학년도 2학기 표본재단 장학생 선발 안내', boardTitle: '2026학년도 2학기 표본재단 장학생 선발 안내', type: '교외', provider: '주관 기관 원문 확인',
          amount: '금액 원문 확인', amountValue: 0, auto: true, deadline: shift(20), period: `접수 ~${shift(20)}`, sourceUrl: A, eligibility: { selective: true, schoolOnly: '경기대학교' },
          summary: '표본', documents: ['원문 확인'], noForm: '표본' },
      ] });
      sb.write('data/forms.json', { templates: {} });
      sb.write('collector/report.md', '');
      const run = sb.run('collector/auto-register.mjs');
      const reg = sb.json('data/registered.json') || { items: [] };
      const report = sb.read('collector/report.md') || '';
      const byUrl = Object.fromEntries(reg.items.map((i) => [i.sourceUrl, i.id]));
      eq('① [자동 등록 실행] 끝까지 돈다', [run.status, run.status ? run.out.slice(-400) : ''], [0, '']);
      eq('① [자동 등록 실행] 경기대 둘째 글은 꼬리표 id 로 등록 · 첫 글 id 는 그대로 · id 가 하나도 안 겹친다 · \'이미 등록(같은 id)\' 갈래가 없다',
        [byUrl[A], byUrl[B] === `${idFromUrl('auto-', B)}-${idHash(canonUrl(B))}`, new Set(reg.items.map((i) => i.id)).size === reg.items.length, /같은 id\)/.test(report)],
        ['auto-hkrwdsfpnos1073sfpnos888', true, true, false]);
      eq('① [자동 등록 실행] 서강대 — 사람이 막은 550536 만 막고 같은 id 의 다른 두 글은 등록 · 리포트에 \'주소로만 막음\' 한 줄',
        [!!byUrl[SGU(551490)], !!byUrl[SGU(551052)], !!byUrl[SGU(550536)], /차단 id 하나가 여러 공고에 걸림 — 주소\(blockUrls\)로만 막음: `auto-amepagescholarshipnotice` 3건/.test(report)],
        [true, true, false, true]);
      eq('① [자동 등록 실행] 막은 주소 기록 없이 id 로만 막힌 겹친 id(계명)는 예전처럼 전부 막고 리포트로 사람에게 · 글 하나뿐인 막힌 id(항공대)도 그대로 막는다',
        [!!byUrl[KMU(270851)], !!byUrl[KMU(270575)], /막은 주소 기록이 없어 전부 막았어요[^\n]*`[^`]+` 2건/.test(report),
          reg.items.some((i) => /seq=10871/.test(i.sourceUrl || ''))],
        [false, false, true, false]);
      eq('① [자동 등록 실행] 뽑고 난 뒤의 공지(「최종선발자 공지」)는 등록하지 않는다 — id 가 풀리며 드러난 계명대 실례',
        reg.items.some((i) => /최종선발자/.test(i.name || '')), false);
    } finally { sb.done(); }

    /* 관리자 등록 — 같은 게시판의 둘째 글도 등록된다(예전엔 '같은 id가 이미 있습니다') · 꼬리표 id 로 막은 것도 id 로 풀린다 */
    const ab = repoSandbox(root, 'hdj-links-admin-');
    try {
      const vdir = fileURLToPath(new URL('tools/', root));
      for (const f of fs.readdirSync(vdir)) if (/\.(mjs|cjs|js)$/.test(f)) ab.write(`tools/${f}`, fs.readFileSync(path.join(vdir, f), 'utf8'));
      const admA = idFromUrl('adm-', A);
      ab.write('data/registered.json', { items: [
        { id: admA, name: '2026학년도 2학기 표본재단 장학생 선발 안내', type: '교외', provider: '표본재단', amount: '금액 원문 확인', amountValue: 0, deadline: '2026-12-31', period: '접수 ~2026-12-31',
          summary: '표본', eligibility: { selective: true, schoolOnly: '경기대학교' }, documents: ['원문 확인'], duplicable: true, sourceUrl: A, sourceKind: 'admin', noForm: '표본' },
      ] });
      ab.write('data/forms.json', { templates: {} });
      const tagged = `${idFromUrl('adm-', B)}-${idHash(canonUrl(B))}`;
      ab.write('collector/auto-register-config.json', { enabled: true, blockIds: [tagged], blockUrls: [] });
      const r1 = ab.run('tools/admin-apply.mjs', [], { ACTION: 'register', ACTOR: 'gate', PAYLOAD: JSON.stringify({ notice: { url: B, title: '[(재)표본인재진흥원] 2026년 하반기 장학생 선발 안내', school: '경기대학교' } }) });
      const ids = ((ab.json('data/registered.json') || {}).items || []).map((i) => i.id);
      const r2 = ab.run('tools/admin-apply.mjs', [], { ACTION: 'unblock', ACTOR: 'gate', PAYLOAD: JSON.stringify({ ids: [tagged] }) });
      eq('① [관리자 등록] 같은 게시판의 둘째 글이 꼬리표 id 로 등록된다 · 첫 글 id 는 그대로 · 꼬리표 id 차단도 풀린다',
        [r1.status, ids.includes(admA), ids.includes(tagged), r2.status, (ab.json('collector/auto-register-config.json') || {}).blockIds],
        [0, true, true, 0, []]);
    } finally { ab.done(); }

    const ar = stripComments(fs.readFileSync(new URL('collector/auto-register.mjs', root), 'utf8'));
    const aa = stripComments(fs.readFileSync(new URL('tools/admin-apply.mjs', root), 'utf8'));
    eq('① 배선 — 자동 등록·관리자 등록이 같은 registerId 를 부른다 · id 하나만 보고 거르는 옛 판정이 없다',
      [/registerId\('auto-'/.test(ar), /registered\.items\.some\(\(i\) => i\.id === id\)/.test(ar), /canon\.registerId\('adm-'/.test(aa)], [true, false, true]);
  }

  /* ── ② 경로의 세션 표식 ── */
  {
    const S1 = KGU(626377, ';jsessionid=AAA111.node1'); const S2 = KGU(626377, ';jsessionid=BBB222'); const S0 = KGU(626377);
    const UC = createRequire(import.meta.url)('../../collector/url-key.cjs');
    eq('② 세션만 다른 두 주소와 세션 없는 주소는 같은 글 — canonUrl · urlKey(ESM·cjs 다리) 모두',
      [new Set([S1, S2, S0].map(canonUrl)).size, new Set([S1, S2, S0].map(urlKey)).size, new Set([S1, S2, S0].map((u) => UC.urlKey(u))).size, urlKey(S1) === UC.urlKey(S1)],
      [1, 1, 1, true]);
    const samples = [S1, 'https://cbnu.example.ac.kr/board/view.do;JSESSIONID=x9?seq=12', 'https://a.example.ac.kr/bbs/read.jsp;jsessionid=Q', `https://a.example.ac.kr/list.do;jsessionid=Z?menu=1#n-${encodeURIComponent('장학 공고')}`];
    eq('② 옮겨 둔 두 줄(canon-url·url-key)이 원본 규칙(board-links.mjs stripSessionId)과 같은 답을 낸다',
      samples.map((u) => [canonUrl(u) === canonUrl(stripSessionId(u)), urlKey(u) === urlKey(stripSessionId(u)), /jsessionid/i.test(canonUrl(u) + urlKey(u))]),
      samples.map(() => [true, true, false]));
    eq('② 세션 판은 순위가 낮다 — 합칠 때 세션 없는 판이 남는다(순서를 바꿔도) · 목록 표식보다는 앞',
      [noticeUrlRank(S1) > noticeUrlRank(S0), noticeUrlRank(S1) < noticeUrlRank(`${S0}#n-x`), preferNotice({ url: S1 }, { url: S0 }).url, preferNotice({ url: S0 }, { url: S1 }).url],
      [true, true, S0, S0]);
    const cands = rowDetailCandidates({ row: { abs: S1, t: '표본', src: '' }, listUrl: 'https://www.kyonggi.ac.kr/www/selectBbsNttList.do?key=7520&bbsNo=1073' });
    eq('② 사냥꾼·복구·브라우저 수집의 후보는 씻은 주소다 — 새 탭 확인도 학생이 여는 주소로',
      [cands.length > 0, cands.some((c) => /jsessionid/i.test(c)), cleanStoredUrl(`${S0.replace(/&/g, '&amp;')}`) === S0, cleanStoredUrl(S1)], [true, false, true, S0]);
    eq('② id 공식은 세션이 있어도 그대로(경기대 표본)', [idFromUrl('auto-', S1), idFromUrl('auto-', S0)], ['auto-hkrwdsfpnos1073sfpnos888', 'auto-hkrwdsfpnos1073sfpnos888']);
    const lh = stripComments(fs.readFileSync(new URL('collector/link-hunter.mjs', root), 'utf8'));
    const rs = stripComments(fs.readFileSync(new URL('collector/resolve-detail-urls.mjs', root), 'utf8'));
    const bc = stripComments(fs.readFileSync(new URL('collector/browser-collect.mjs', root), 'utf8'));
    /* 저장 줄 자체는 '확인을 통과한 변수'(url·got·found)만 받는다(관문 「원문 링크 정직성」 producers ①) — 그 변수가 **씻은 주소에서만** 채워지는지 본다:
       1단계 url = 후보(rowDetailCandidates — 위에서 씻은 것을 확인) · 3단계 got = cleanStoredUrl 로 씻어 확인한 cu · 복구 found = 후보 또는 클릭 뒤 more(씻음) */
    const gotSets = [...lh.matchAll(/\bgot = ([^;]+);/g)].map((m) => m[1].trim());
    const cuSets = [...lh.matchAll(/const cu = ([^;]+);/g)].map((m) => m[1].trim());
    eq('② 사냥꾼 3단계는 씻은 주소(cu)로 확인하고 그것을 담는다 · 복구 로봇의 클릭 뒤 후보도 씻는다 · 브라우저 수집은 행 주소를 씻어 담는다',
      [gotSets.length >= 2 && gotSets.every((x) => x === 'cu' || x === 'null'), cuSets.length >= 2 && cuSets.every((x) => /^cleanStoredUrl\((row|hit)\.u\)$/.test(x)),
        /detailCandidates\(\{[^}]*\}\)\s*\.map\(cleanStoredUrl\)/.test(rs),
        /allLinks\s*\.map\(\(l\) => \(\{ \.\.\.l, url: cleanStoredUrl\(l\.url\) \}\)\)/.test(bc)],
      [true, true, true, true]);
  }

  /* ── ③ 학교 서버에 못 닿은 표적은 내일 다시 ── */
  {
    const day = { today: '2026-10-04', nowMs: Date.parse('2026-10-04T03:00:00Z') };
    const net = recordAttempt({ attempts: 2 }, 'net', 'Timeout', day);
    eq('③ 못 닿음(net)은 횟수에 안 세고 내일(KST)로 미룬다 · 우리 시간 상한(defer:false)은 미루지 않는다 · 더 늦은 날은 줄이지 않는다 · 지난 날은 내일로',
      [net.attempts, net.nextTryAt, recordAttempt({ attempts: 2 }, 'net', '시간 상한', { ...day, defer: false }).nextTryAt,
        recordAttempt({ attempts: 2, nextTryAt: '2026-10-03' }, 'net', '시간 상한', { ...day, defer: false }).nextTryAt,
        recordAttempt({ attempts: 2, nextTryAt: '2026-10-10' }, 'net', 'Timeout', day).nextTryAt, recordAttempt({ attempts: 1, nextTryAt: '2026-09-04' }, 'net', 'Timeout', day).nextTryAt,
        recordAttempt({ attempts: 0 }, 'net', 'Timeout', { today: '2026-10-04', nowMs: Date.parse('2026-10-04T16:00:00Z') }).nextTryAt],
      [2, '2026-10-05', undefined, '2026-10-03', '2026-10-10', '2026-10-05', '2026-10-06']);
    const lh = stripComments(fs.readFileSync(new URL('collector/link-hunter.mjs', root), 'utf8'));
    const failBranch = (lh.match(/if \(!opened\) \{[\s\S]{0,400}/) || [''])[0];
    eq('③ 배선 — 게시판이 안 열리면 그 게시판 대상 전부를 net 으로 적는다(미룸) · 시간 상한 줄은 defer:false · record 가 opts 를 넘긴다',
      [/for \(const t of group\) record\(t, 'net'/.test(failBranch), /record\(t, 'net', '시간 상한[^']*', undefined, \{ defer: false \}\)/.test(lh),
        /recordAttempt\(st, outcome, why, \{[^}]*\.\.\.opts \}\)/.test(lh)],
      [true, true, true]);
  }

  /* ── ④ 사냥꾼 리포트 — 아직 못 찾은 수 · 이번에 알리는 공고 ── */
  {
    const two = [
      { title: '2026학년도 2학기 표본재단 장학생 선발 안내', key: 'n:https://a.example.ac.kr/list.do#n-x', attempts: 3, lastWhy: '목록에서 못 찾음', likelyGone: true },
      { title: '표본시민장학회 장학생 모집', key: 'r:auto-sample', attempts: 4, lastWhy: 'HTTP 404' },
    ];
    const lines = escalationLines(two);
    eq('④ 이번에 처음 알리는 공고 절 — 머리 한 줄 + 공고마다 한 줄(제목·횟수·열쇠) · 없으면 절을 안 찍는다',
      [lines[0], lines.filter((l) => /^- /.test(l)).length, two.every((x) => lines.some((l) => l.includes(x.title) && l.includes(x.key))), escalationLines([]), escalationLines()],
      ['### 🙋 사람 확인 필요 — 이번에 처음 알리는 공고 2건', 2, true, [], []]);
    const lh = stripComments(fs.readFileSync(new URL('collector/link-hunter.mjs', root), 'utf8'));
    const got = (lh.match(/extraFound \+= 1[\s\S]{0,400}/) || [''])[0];
    const save = (lh.match(/function saveAll\([\s\S]*?\n\}\n/) || [''])[0];
    eq('④ 배선 — 3단계가 찾으면 \'못 찾음\'에서 뺀다 · 끝줄·출력은 묶음 크기 · 리포트 머리에 이번 알림 절',
      [/failedKeys\.delete\(t\.key\)/.test(got), /\bfailed \+= 1/.test(lh), /아직 못 찾음 \$\{failedKeys\.size\}건/.test(save), /failed=\$\{failedKeys\.size\}/.test(save),
        /report\.splice\(2, 0, \.\.\.escalationLines\(escalatedNow\)\)/.test(save), /escalatedNow\.push\(/.test(lh)],
      [true, false, true, true, true, true]);
  }

  /* ── ⑤ 사냥꾼 장부 정리 ── */
  {
    const today = '2026-10-05';
    const ago = (n) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
    const items = {
      'n:live-next': { attempts: 2, lastTried: ago(1), lastWhy: '목록에서 못 찾음', nextTryAt: '2026-10-08', patrolledAt: ago(3), escalated: true, likelyGone: true, title: 't' },
      'n:dead-patrol': { patrolledAt: ago(5), lastWhy: 'HTTP 404' },
      'r:dead-resolved-10': { attempts: 0, status: 'resolved', lastTried: ago(10), lastWhy: '', resolvedUrl: 'https://a.example.ac.kr/view.do?seq=1' },
      'r:dead-resolved-40': { attempts: 0, status: 'resolved', lastTried: ago(40), lastWhy: '' },
      'n:dead-escalated-5': { attempts: 3, escalated: true, lastTried: ago(5), lastWhy: '목록에서 못 찾음', nextTryAt: '2026-10-20' },
      'n:dead-trying': { attempts: 1, lastTried: ago(2), lastWhy: 'HTTP 404', nextTryAt: '2026-10-06' },
      'r:live-patrol-only': { patrolledAt: ago(2), lastWhy: '' },
    };
    const frozen = JSON.stringify(items);
    const live = new Set(['n:live-next', 'r:live-patrol-only']);
    const out = pruneHuntState(items, live, today);
    const { patrolledAt, ...rest } = items['n:live-next'];
    eq('⑤ 데이터에 있는 열쇠는 남고(순찰이 꺼져 있으면 순찰 흔적만 뗀다 · 다른 칸 그대로) · 순찰 흔적뿐인 줄은 버린다',
      [out['n:live-next'], 'r:live-patrol-only' in out], [rest, false]);
    eq('⑤ 데이터에 없는 열쇠 — 순찰 흔적·시도 중인 것은 버리고 · 찾은 것(10일 전)·알린 것(5일 전)은 남기고 · 40일 지난 찾은 것은 버린다',
      [Object.keys(out).sort()], [['n:dead-escalated-5', 'n:live-next', 'r:dead-resolved-10']]);
    eq('⑤ 넘겨받은 장부는 안 고친다 · 순찰을 켜면 순찰 흔적을 남긴다',
      [JSON.stringify(items) === frozen, pruneHuntState(items, live, today, 30, { patrolOn: true })['n:live-next'].patrolledAt, 'r:live-patrol-only' in pruneHuntState(items, live, today, 30, { patrolOn: true })],
      [true, ago(3), true]);
    const lh = stripComments(fs.readFileSync(new URL('collector/link-hunter.mjs', root), 'utf8'));
    const save = (lh.match(/function saveAll\([\s\S]*?\n\}\n/) || [''])[0];
    const iPrune = save.indexOf('pruneHuntState('); const iWrite = save.indexOf('writeFileSync(statePath');
    eq('⑤ 배선 — 사냥꾼이 장부를 쓰기 바로 전에 정리한다 · 리포트에 걷어 낸 수',
      [iPrune > 0 && iWrite > iPrune, /장부 정리: \$\{prunedKeys\}건/.test(save)], [true, true]);
  }
}
