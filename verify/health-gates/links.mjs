/* 「로봇·도구 점검 관문」 links 묶음 — 원문 링크 로봇 잔여 · 자동 등록 id (2026-10-05 대대적 점검)
   잰다:
     ① 자동 등록 id 겹침 (links-new-1): id 공식(정렬한 주소의 끝 24자)이 게시판 공통값을 잡는 게시판에서 그 게시판 글이 전부 같은 id 를 받아
        한 글이 등록되면 나머지가 '이미 등록(같은 id)', 사람이 한 글을 막으면 나머지가 '사람이 막아 둔 공고'로 **조용히** 빠졌다(9개교 70여 건) —
        공식은 그대로 두고 겹칠 때만 꼬리표 id(canon-url.mjs registerId 한 곳) · **진짜 auto-register.mjs·admin-apply.mjs 를 임시 폴더에서 돌린다** ·
        꼬리표 id 는 고정되지 않아 막음·쉬기는 두 꼴을 다 보고 · 옛 id 차단 풀기가 꼬리표 id 로 따로 막은 글을 풀지 않는다(리뷰 R1) · 같은 글 · 주소만 다름(리뷰 R2)
     ② 경로의 세션 표식 (links-7): 경기대 글이 `View.do;jsessionid=…` 째로 담겨 세션만 다른 같은 글이 다른 글이 됐다 — canonUrl·urlKey 가 떼고
        (원본 규칙 board-links.mjs stripSessionId 와 같은 답인지 대조) · 합칠 때 세션 없는 판이 남고 · 로봇들이 씻은 주소(detail-url.mjs cleanStoredUrl)로 확인·저장
     ③ 못 닿은 표적은 내일 (links-14): 시간 초과·게시판 안 열림이 nextTryAt 을 안 남겨 하루 다섯 번 같은 학교를 두드렸다(link-hunt-rules.mjs recordAttempt) ·
        게시판을 못 연 표적의 장부 문구가 관리자 「죽은 링크」에 걸리지 않는다(boardUnreachableWhy — 원인을 단정하지 않는다 · 리뷰 R3)
     ④ 사냥꾼 리포트 (links-2): 3단계가 찾은 공고도 '아직 못 찾음'에 남았다 · 이슈 본문에 어느 공고인지 없었다(escalationLines)
     ⑤ 사냥꾼 장부 정리 (links-9): link-hunt.json 1,404줄 중 956줄이 데이터에 없는 공고였다(pruneHuntState)
     ⑥ 복구 로봇 바깥 시계 · 예약 주석 요일 (links-15): 매달리면 고친 것을 잃는다 — **진짜 resolve-detail-urls.mjs 를 가짜 브라우저로 임시 폴더에서** ·
        'UTC 월 20시대'를 'KST 월요일'이라 적은 주석(실제 화요일) — 워크플로 예약 줄 전부를 cron 과 대조(cronCommentProblems)
     ⑦ 복구 로봇 소급 재검사 끔 (links-10 · 개발자 결정): 읽는 곳 없는 판정 기록 · 원문 링크 확인 로봇과 엇갈린 판정 — 되살아나지 않게
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
import { recordAttempt, escalationLines, pruneHuntState, boardUnreachableWhy } from '../../collector/link-hunt-rules.mjs';

/* 경기대 eGov 게시판 꼴 — 글 번호(nttNo)는 가운데, 끝은 게시판 공통값(searchKrwd·sf.pnos) */
const KGU = (ntt, sess = '') => `https://www.kyonggi.ac.kr/www/selectBbsNttView.do${sess}?key=7520&bbsNo=1073&nttNo=${ntt}&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888`;
/* 서강대 꼴 — 끝이 namepage=ScholarshipNotice */
const SGU = (n) => `https://www.sogang.ac.kr/ko/detail/${n}?bbsConfigFk=141&namepage=ScholarshipNotice`;
/* 강원대 꼴 — 끝이 searchGbn·searchOrder(옛 id 'auto-archgbn0searchordersort0') */
const KNU = (n) => `https://wwwk.kangwon.example.ac.kr/www/selectBbsNttView.do?bbsNo=81&nttNo=${n}&key=277&searchGbn=0&searchOrder=sort0`;
/* 게시판 공통값(category·slug)이 끝을 차지하는 꼴 — 글 번호(bbsidx)가 달라도 옛 id 가 같다 */
const SSU = (n) => `https://scatch.ssu.example.ac.kr/bbs/view?bbsidx=${n}&category=jang&slug=notice-board`;

/* 저장소 코드를 임시 폴더로 복사 — 자동 등록은 verify/*.cjs(등록 규칙)도 부른다 */
function repoSandbox(root, prefix) {
  const sb = sandbox(root, prefix);
  const vdir = fileURLToPath(new URL('verify/', root));
  for (const f of fs.readdirSync(vdir)) if (f.endsWith('.cjs')) sb.write(`verify/${f}`, fs.readFileSync(path.join(vdir, f), 'utf8'));
  return sb;
}

/* cron 줄의 주석 요일·시각이 cron 과 맞나 (links-15) — 문제 목록을 돌려준다(빈 배열 = 맞음).
   주석을 '=' 로 나눠 조각마다 시간대를 정한다(조각에 UTC 가 있으면 UTC · 없으면 KST — 이 저장소 주석은 KST 가 기본).
   요일은 'X요일' 또는 'X·Y' 꼴만 읽는다('수집'의 '수'·홑글자 '월'은 요일로 안 읽는다) · 시각은 'HH:MM KST|UTC' 꼴만. */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export function cronCommentProblems(line) {
  const m = String(line || '').match(/cron:\s*'([^']+)'\s*(?:#\s*(.*))?$/);
  if (!m || !m[2]) return [];
  const [mi, hr, , , dw] = m[1].trim().split(/\s+/);
  const fixedTime = /^\d+$/.test(mi) && /^\d+$/.test(hr);
  const days = (field) => {
    if (!field || field === '*') return null;
    const out = new Set();
    for (const part of field.split(',')) {
      const r = part.match(/^(\d)-(\d)$/);
      if (r) for (let d = +r[1]; d <= +r[2]; d += 1) out.add(d % 7);
      else if (/^\d$/.test(part)) out.add(+part % 7);
      else return null;
    }
    return out;
  };
  const utcDays = days(dw);
  const shift = fixedTime && +hr + 9 >= 24 ? 1 : 0;
  const kstDays = utcDays && fixedTime ? new Set([...utcDays].map((d) => (d + shift) % 7)) : null;
  const pad = (n) => String(n).padStart(2, '0');
  const problems = [];
  for (const seg of m[2].split('=')) {
    const tz = /UTC/.test(seg) ? 'UTC' : 'KST';
    const want = tz === 'UTC' ? utcDays : kstDays;
    const said = new Set();
    for (const x of seg.matchAll(/([일월화수목금토])요일/g)) said.add(DOW.indexOf(x[1]));
    for (const x of seg.matchAll(/[일월화수목금토](?:·[일월화수목금토])+/g)) for (const ch of x[0].split('·')) said.add(DOW.indexOf(ch));
    if (said.size && want && [...said].sort().join() !== [...want].sort().join()) {
      problems.push(`${tz} 요일 '${[...said].map((d) => DOW[d]).join('·')}' ≠ cron '${[...want].sort().map((d) => DOW[d]).join('·')}'`);
    }
    if (fixedTime) {
      const at = tz === 'UTC' ? `${pad(+hr)}:${pad(+mi)}` : `${pad((+hr + 9) % 24)}:${pad(+mi)}`;
      for (const x of seg.matchAll(new RegExp(`(\\d{1,2}):(\\d{2})\\s*${tz}`, 'g'))) {
        if (`${pad(+x[1])}:${x[2]}` !== at) problems.push(`${tz} 시각 ${x[1]}:${x[2]} ≠ cron ${at}`);
      }
    }
  }
  return problems;
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
    /* 꼬리표 id 는 '그 옛 id 를 쥔 등록분이 있을 때만' 붙어 고정되지 않는다 — 꼬리표 꼴로 막은 글이 다음 실행에 옛 id 를 받아도 막혀야 한다(리뷰 R1) */
    const tagOnly = new Set([`${idFromUrl('auto-', SGU(551052))}-${idHash(canonUrl(SGU(551052)))}`]);
    const tb = registerId('auto-', SGU(551052), { blockedIds: tagOnly });
    eq('① 꼬리표 꼴로 막은 글은 옛 id 를 받는 날에도 막힌다(blockedTagged) · 같은 게시판의 다른 글은 안 막힌다 · 꼬리표 값을 돌려준다',
      [tb.id, tb.blockedTagged, tb.tagged === [...tagOnly][0], registerId('auto-', SGU(551490), { blockedIds: tagOnly }).blockedTagged],
      ['auto-amepagescholarshipnotice', true, true, false]);

    /* 진짜 자동 등록을 사본 저장소에서 — 불러오는 순간 실행되는 파일이라 import 하지 않는다 */
    const sb = repoSandbox(root, 'hdj-links-areg-');
    try {
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const shift = (n) => new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
      const KMU = (uid) => `https://www.kmu.example.ac.kr/uni/main/page.jsp?pageNo=1&cmd=2&parm_bod_uid=${uid}&srchVoteType=-1&srchEnable=1&mnu_uid=145&`;
      const ID_ONLY = 'auto-' + canonUrl(KMU(1)).replace(/[^a-z0-9]/gi, '').slice(-24).toLowerCase();
      const tagKnu = (n) => `${idFromUrl('auto-', KNU(n))}-${idHash(canonUrl(KNU(n)))}`;
      sb.write('collector/auto-register-config.json', { enabled: true, schools: [], maxPerRun: 8, blockIds: ['auto-amepagescholarshipnotice', ID_ONLY, 'auto-notiphpcodes1301seq10871', tagKnu(9101)], blockUrls: [SGU(550536)] });
      /* 꼬리표 꼴로 쉬는 글(데이터 관문 쉬기) — 이번 실행엔 옛 id 를 받는다(그 옛 id 를 쥔 등록분이 없다) */
      sb.write('collector/auto-held.json', { items: [{ id: tagKnu(9103), reverts: 2, lastAt: today }] });
      const T_SSU = '[교외] 2026학년도 2학기 표본별빛장학회 장학생 선발 안내';
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
        N('[교외] 표본달빛장학재단 2026년 장학생 선발 안내', KNU(9103), '강원대학교'),
        N('[교외] 표본꽃길장학재단 2026년 장학생 선발 안내', KNU(9101), '강원대학교'),
        N('[교외] 표본들녘장학회 2026년 장학생 선발 안내', KNU(9102), '강원대학교'),
        N(T_SSU, SSU(302), '숭실대학교'),
      ] });
      sb.write('data/registered.json', { items: [
        { id: idFromUrl('auto-', A), name: '2026학년도 2학기 표본재단 장학생 선발 안내', boardTitle: '2026학년도 2학기 표본재단 장학생 선발 안내', type: '교외', provider: '주관 기관 원문 확인',
          amount: '금액 원문 확인', amountValue: 0, auto: true, deadline: shift(20), period: `접수 ~${shift(20)}`, sourceUrl: A, eligibility: { selective: true, schoolOnly: '경기대학교' },
          summary: '표본', documents: ['원문 확인'], noForm: '표본' },
        /* 같은 글이 다른 주소로 다시 온다(표식이 진짜 주소로 풀린 것 등) — 등록명은 원제목과 딴판이라 이름 대조(isDuplicatePair)는 못 잡는다 */
        { id: idFromUrl('auto-', SSU(301)), name: '표본 학업 지원 사업', boardTitle: T_SSU, type: '교외', provider: '주관 기관 원문 확인',
          amount: '금액 원문 확인', amountValue: 0, auto: true, deadline: shift(20), period: `접수 ~${shift(20)}`, sourceUrl: SSU(301), eligibility: { selective: true, schoolOnly: '숭실대학교' },
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
      eq('① [자동 등록 실행] 꼬리표 꼴로 막은 글(강원 9101)·쉬는 글(9103)은 옛 id 를 받는 날에도 막히고 쉰다 · 같은 게시판의 다른 글(9102)은 등록 (리뷰 R1)',
        [!!byUrl[KNU(9101)], !!byUrl[KNU(9103)], !!byUrl[KNU(9102)], /데이터 관문 쉬기 1건/.test(report)], [false, false, true, true]);
      eq('① [자동 등록 실행] 같은 학교·같은 원제목의 등록분이 쥔 id 를 주소만 다른 글이 받으면 다시 등록하지 않는다(숭실 표본) · 리포트에 \'같은 글 · 주소만 다름\' (리뷰 R2)',
        [idFromUrl('auto-', SSU(301)) === idFromUrl('auto-', SSU(302)), !!byUrl[SSU(302)], reg.items.filter((i) => i.boardTitle === T_SSU).length, /- 이미 등록\(같은 글 · 주소만 다름\) · 1건/.test(report)],
        [true, false, 1, true]);
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

    /* 차단 풀기와 꼬리표 id (리뷰 R1) — 옛 id 를 풀 때 그 옛 id 로 계산되는 막은 주소를 전부 지우면, 같은 게시판에서 꼬리표 id 로 따로 막은 글의 주소까지
       지워진다. 꼬리표 id 는 고정되지 않아(그 옛 id 를 쥔 등록분이 없으면 옛 id) 그 글이 다시 등록됐다 — 사람이 막은 공고는 다시 등록하지 않는다(원칙 2) */
    const qb = repoSandbox(root, 'hdj-links-unblock-');
    try {
      const vdir = fileURLToPath(new URL('tools/', root));
      for (const f of fs.readdirSync(vdir)) if (/\.(mjs|cjs|js)$/.test(f)) qb.write(`tools/${f}`, fs.readFileSync(path.join(vdir, f), 'utf8'));
      const X = SGU(551052); const L = idFromUrl('auto-', X); const tagX = `${L}-${idHash(canonUrl(X))}`;
      const CFGP = 'collector/auto-register-config.json';
      const admin = (ACTION, payload) => qb.run('tools/admin-apply.mjs', [], { ACTION, ACTOR: 'gate', PAYLOAD: JSON.stringify(payload) });
      qb.write('data/forms.json', { templates: {} });
      /* (ㄱ) 짝 기록(blockPairs) 없는 설정 — 지금 실데이터 꼴 */
      qb.write('data/registered.json', { items: [] });
      qb.write(CFGP, { enabled: true, schools: [], maxPerRun: 8, blockIds: [L, tagX], blockUrls: [SGU(550536), X] });
      const u1 = admin('unblock', { ids: [L] });
      const c1 = qb.json(CFGP) || {};
      eq('① [관리자 차단 풀기] 옛 id 를 풀어도 꼬리표 id 로 따로 막은 글의 주소는 남는다 · 옛 id 로 막았던 주소는 풀린다 (짝 기록 없는 설정)',
        [u1.status, c1.blockIds, c1.blockUrls], [0, [tagX], [X]]);
      /* 남은 차단 id 의 짝(blockPairs) 주소도 남긴다 — 손 큐레이션 id(reg-)처럼 주소에서 계산되지 않는 id 가 같은 게시판 글을 막고 있을 때 */
      qb.write(CFGP, { enabled: true, schools: [], maxPerRun: 8, blockIds: [L, 'reg-sample-sogang'], blockUrls: [SGU(550536), SGU(551777)], blockPairs: { 'reg-sample-sogang': SGU(551777) } });
      const u0 = admin('unblock', { ids: [L] });
      const c0 = qb.json(CFGP) || {};
      eq('① [관리자 차단 풀기] 옛 id 를 풀어도 남은 차단 id 의 짝으로 적힌 주소는 남는다',
        [u0.status, c0.blockIds, c0.blockUrls, c0.blockPairs], [0, ['reg-sample-sogang'], [SGU(551777)], { 'reg-sample-sogang': SGU(551777) }]);
      /* (ㄴ) 관리자 길 그대로 — 꼬리표 등록분을 되돌림 → 옛 id 차단 풀기 → 자동 등록 실행 */
      qb.write('data/registered.json', { items: [
        { id: tagX, name: '[교외] 미래표본장학회 장학생 선발 안내', boardTitle: '[교외] 미래표본장학회 장학생 선발 안내', type: '교외', provider: '주관 기관 원문 확인',
          amount: '금액 원문 확인', amountValue: 0, auto: true, deadline: '2026-12-31', period: '접수 ~2026-12-31', sourceUrl: X, eligibility: { selective: true, schoolOnly: '서강대학교' },
          summary: '표본', documents: ['원문 확인'], noForm: '표본' },
      ] });
      qb.write(CFGP, { enabled: true, schools: [], maxPerRun: 8, blockIds: [L], blockUrls: [SGU(550536)] });
      const rv = admin('revert', { ids: [tagX], expect: 1 });
      const ub = admin('unblock', { ids: [L] });
      const c2 = qb.json(CFGP) || {};
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const due = new Date(Date.parse(today) + 20 * 86400000).toISOString().slice(0, 10);
      const N = (title, url) => ({ title, url, school: '서강대학교', foundAt: today, bodyDeadline: due, bodyDeadlineText: `신청기간 : ~ ${due}` });
      qb.write('data/notices.json', { items: [
        N('[교외] 미래표본장학회 장학생 선발 안내', X),
        N('[교외] 해동표본재단 장학생 선발 안내', SGU(551490)),
        N('[교외] 다시 열린 표본 장학생 선발 안내', SGU(550536)),
      ] });
      qb.write('collector/report.md', '');
      const run = qb.run('collector/auto-register.mjs');
      const urls = new Set(((qb.json('data/registered.json') || {}).items || []).map((i) => i.sourceUrl));
      eq('① [되돌림 → 옛 id 차단 풀기 → 자동 등록] 꼬리표 등록분으로 되돌린 글(551052)은 다시 등록되지 않는다 · 사람이 푼 글(550536)과 다른 글(551490)은 등록',
        [rv.status, ub.status, c2.blockIds, (c2.blockUrls || []).map(canonUrl), run.status, urls.has(X), urls.has(SGU(550536)), urls.has(SGU(551490)), run.status ? run.out.slice(-300) : ''],
        [0, 0, [tagX], [canonUrl(X)], 0, false, true, true, '']);
    } finally { qb.done(); }

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
    /* 관리자 화면 「죽은 링크」의 거름(_admin/admin.js deadLinks)을 그 파일에서 읽어 와 대조한다 — 브라우저 파일이라 불러올 수 없다(리뷰 R3) */
    const adm = fs.readFileSync(new URL('_admin/admin.js', root), 'utf8');
    const deadSrc = (adm.match(/function deadLinks\(\) \{[\s\S]*?\.filter\(\(\[, v\]\) => v && v\.lastWhy && \/(.+?)\/\.test\(v\.lastWhy\)\)/) || [])[1];
    const deadRe = deadSrc ? new RegExp(deadSrc) : null;
    const errs = ['page.goto: Timeout 30000ms exceeded.', 'page.goto: net::ERR_CONNECTION_REFUSED at https://a.example.ac.kr/list.do', 'page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at https://a.example.ac.kr/', ''];
    eq('③ 게시판을 못 연 표적의 장부 문구는 관리자 「죽은 링크」 거름에 안 걸린다(원인을 단정하지 않는다) · 거름은 살아 있다(HTTP 404·옛 문구 \'게시판 열기 실패\'는 걸린다) · 사냥꾼이 그 문구를 쓴다',
      [!!deadRe, errs.map((e) => !!deadRe && deadRe.test(boardUnreachableWhy(e))), !!deadRe && deadRe.test('HTTP 404'), !!deadRe && deadRe.test('게시판 열기 실패: Timeout'),
        /record\(t, 'net', boardUnreachableWhy\(openErr\)\)/.test(failBranch), boardUnreachableWhy('a\nb'), boardUnreachableWhy('')],
      [true, errs.map(() => false), true, true, true, '게시판을 못 엶 — 내일 다시 봄 (a)', '게시판을 못 엶 — 내일 다시 봄']);
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

  /* ── ⑥ 원문 링크 복구 로봇 — 바깥 시계 · 예약 주석의 요일 ── */
  {
    eq('⑥ 예약 주석 요일 대조 표본 — 월 20:13 UTC 는 KST 화요일 · \'=\' 로 나눈 조각마다 시간대 · \'수집\'의 \'수\'는 요일이 아니다',
      [cronCommentProblems("    - cron: '13 20 * * 1'   # 매주 월요일 05:13 KST").length, cronCommentProblems("    - cron: '13 20 * * 1'   # 매주 화요일 05:13 KST").length,
        cronCommentProblems("    - cron: '53 20 * * 1,4'   # 월·목 05:53 KST (홀수 분").length, cronCommentProblems("    - cron: '37 20 * * 1'   # 매주 월 20:37 UTC = 화 05:37 KST").length,
        cronCommentProblems("    - cron: '23 21 * * 1'    # 매주 화요일 06:23 KST = UTC 월요일 21:23 (수집 예약과 겹치지 않는 홀수 분)").length,
        cronCommentProblems("    - cron: '40 6 * * 1'   # 월요일 15:40 KST").length, cronCommentProblems("    - cron: '7 23 * * *'   # 매일 08:07 KST").length,
        cronCommentProblems("    - cron: '7 23 * * *'   # 매일 07:07 KST").length, cronCommentProblems("    - cron: '29 */3 * * *'     # 3시간마다").length],
      [1, 0, 1, 0, 0, 0, 0, 1, 0]);
    const wfDir = fileURLToPath(new URL('.github/workflows/', root));
    const bad = [];
    for (const f of fs.readdirSync(wfDir).filter((x) => /\.ya?ml$/.test(x))) {
      fs.readFileSync(path.join(wfDir, f), 'utf8').split('\n').forEach((l, i) => { if (/^\s*-\s*cron:/.test(l)) for (const p of cronCommentProblems(l)) bad.push(`${f}:${i + 1} ${p}`); });
    }
    eq('⑥ 워크플로 예약 줄 전부 — 주석의 요일·시각이 cron 과 맞다(UTC 월 20시대 = KST 화 새벽)', bad, []);
    const adm = fs.readFileSync(new URL('_admin/admin.js', root), 'utf8');
    eq('⑥ 관리자 화면 로봇 목록 — 한국장학재단 수확은 화·금(KST)', /f: 'kosaf-fetch\.yml'[\s\S]{0,600}?when: '화·금 05:53'/.test(adm), true);
    const rs = stripComments(fs.readFileSync(new URL('collector/resolve-detail-urls.mjs', root), 'utf8'));
    eq('⑥ 복구 로봇에 바깥 시계가 있다 — 예산 + 유예 뒤 저장(saveAll)하고 끝낸다 · 정상 종료를 붙들지 않는다(unref)',
      [/setTimeout\(\(\) => \{[\s\S]{0,600}?saveAll\(/.test(rs), /watchdog\.unref\(\)/.test(rs), /RESOLVE_WATCHDOG_GRACE_MS/.test(rs)], [true, true, true]);
    /* 진짜 복구 로봇을 임시 폴더에서 — 가짜 브라우저의 게시판 열기가 영영 안 끝나게(진짜 브라우저처럼 일거리를 붙든 채) 두고 예산을 짧게 준다 */
    const FAKE_PW = [
      "import fs from 'node:fs';",
      "const log = (s) => fs.appendFileSync('pw-calls.log', s + '\\n');",
      "const page = { goto: (u) => { log('goto ' + u); return new Promise(() => { setInterval(() => {}, 1000); }); }, close: async () => {}, waitForTimeout: async () => {},",
      "  evaluate: async () => null, $$eval: async () => [], $$: async () => [], url: () => 'about:blank', content: async () => '' };",
      'const ctx = { newPage: async () => page, close: async () => {}, clearCookies: async () => {}, waitForEvent: async () => null };',
      'export const chromium = { launch: async () => ({ newContext: async () => ctx, close: async () => {} }) };',
    ].join('\n');
    const runResolver = (trigger) => {
      const sb = repoSandbox(root, 'hdj-links-resolve-');
      try {
        sb.module('playwright', { 'package.json': JSON.stringify({ name: 'playwright', type: 'module', main: 'index.js' }), 'index.js': FAKE_PW });
        const t = '2026학년도 2학기 표본재단 장학생 선발 안내';
        sb.write('data/notices.json', { items: [{ title: t, url: `https://board.example.ac.kr/bbs/list.do?menu=7#n-${encodeURIComponent(t)}`, school: '표본대학교', foundAt: '2026-10-01' }] });
        sb.write('data/registered.json', { items: [] });
        if (trigger) sb.write('collector/run-resolve-urls.txt', trigger);
        const r = sb.run('collector/resolve-detail-urls.mjs', [], { RESOLVE_BUDGET_MS: '300', RESOLVE_WATCHDOG_GRACE_MS: '300', RESOLVE_ONLY_BOARD: '' }, 15000);
        return { status: r.status, signal: r.signal, out: r.out, report: sb.read('collector/resolve-report.md') || '', calls: sb.read('pw-calls.log') || '', resolved: sb.json('collector/resolved-urls.json') };
      } finally { sb.done(); }
    };
    const hung = runResolver('');
    eq('⑥ [복구 로봇 실행] 게시판 열기가 매달려도 예산 + 유예 뒤 스스로 저장하고 0 으로 끝난다(리포트에 ⏰ · 넘어짐 메모 없음)',
      [hung.status, hung.signal, /⏰ \*\*예산\(\d+분\)을 넘겨 스스로 멈췄습니다/.test(hung.report), /넘어졌습니다/.test(hung.report), /^goto /m.test(hung.calls), hung.status === 0 ? '' : hung.out.slice(-300)],
      [0, null, true, false, true, '']);

    /* ── ⑦ 복구 로봇의 소급 재검사를 뺐다 (links-10 · 개발자 결정) ── */
    const ro = runResolver('recheckOnly: true\n');
    eq('⑦ [복구 로봇 실행] 재검사 기록(recheck)을 쓰지 않는다 · 옛 설정 recheckOnly 는 게시판을 열지 않고 그 사실만 적고 끝난다',
      [!!hung.resolved && 'recheck' in hung.resolved, ro.status, ro.calls, /recheckOnly 는 이제 하는 일이 없습니다/.test(ro.report), /소급 재검사/.test(ro.report)],
      [false, 0, '', true, false]);
    eq('⑦ 재검사 고리가 되살아나지 않았다 — 이미 고친 주소를 다시 여는 루프·판정 기록이 없다(그 일은 원문 링크 확인 로봇 link-check 몫)',
      [/verifyCandidate\(url, titles, 0, live/.test(rs), /recheckLog/.test(rs), /rechecked/.test(rs)], [false, false, false]);
  }
}
