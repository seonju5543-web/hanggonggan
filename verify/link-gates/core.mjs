/* 「원문 링크 정직성」 — core 갈래: 앱이 쓰는 규칙(source-link.js)과 로봇이 쓰는 판정(collector/link-landing.mjs)
   (2026-10-03 · 원문 대신 재단 홈페이지·게시판 목록이 열리던 사고)
   🔴 여기 기대 값은 **실측 사례**다 — 서울대 `&#038;` · 층2 재단 홈페이지 · 가천 목록+번호 · 전북 로그인 상자 · 동국 껍데기. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as J from '../../collector/link-landing.mjs';

const require = createRequire(import.meta.url);
const L = require('../../source-link.js');

export default async function gate(eq, ctx) {
  /* ① 주소에 박힌 HTML 기호 — 서울대 학생처 실측 주소 */
  const snu = 'https://student.snu.ac.kr/%ec%86%8c%ec%8b%9d/?mod=document&#038;category1=%EC%9E%A5%ED%95%99&#038;uid=392';
  eq('① `&#038;` 을 되돌린다 — 안 하면 `#` 뒤가 조각이 돼 글 번호(uid)가 서버에 안 간다',
    new URL(L.decodeUrlEntities(snu)).searchParams.get('uid'), '392');
  eq('  되돌리기 전에는 정말로 글 번호가 사라진다(이 관문이 무력하지 않다는 증거)', new URL(snu).searchParams.get('uid'), null);
  eq('  `&amp;` · 두 겹 `&amp;amp;` · `&#x26;` 도', ['https://a.kr/v?a=1&amp;b=2', 'https://a.kr/v?a=1&amp;amp;b=2', 'https://a.kr/v?a=1&#x26;b=2'].map(L.decodeUrlEntities),
    ['https://a.kr/v?a=1&b=2', 'https://a.kr/v?a=1&b=2', 'https://a.kr/v?a=1&b=2']);

  /* ② 주소 꼴 — 확실한 홈페이지만 'home' (행사 전용 폴더는 로봇이 열어 보고 정한다) */
  eq('② 꼴: 뿌리·index·main 은 홈페이지 · 한 칸 폴더는 단정하지 않음 · 표식·스크립트',
    ['https://namgu.gwangju.kr', 'https://www.jeju.go.kr/index.htm', 'http://janghak.songpa.go.kr/main.jsp', 'https://nysc.or.kr/nysc/', 'https://a.kr/list.do#n-%EC%A0%9C', 'javascript:void(0)', '', 'https://a.kr/view.do?id=3'].map(L.linkShape),
    ['home', 'home', 'home', 'page', 'marker', 'none', 'none', 'page']);

  eq('  목록 주소에 글 번호만 붙인 꼴(가천·고려 subview.do?nttId · 서울교대 selectNttList?nttId · 오프셋 붙은 꼴)은 listid — 진짜 상세는 아님',
    ['https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125659', 'https://www.gachon.ac.kr/kor/7986/subview.do?article.offset=10&nttId=125311',
      'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&pageNo=2&nttId=54977', 'https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=55323',
      'https://www.gachon.ac.kr/bbs/kor/478/125842/artclView.do'].map(L.linkShape),
    ['listid', 'listid', 'listid', 'page', 'page']);
  eq('  listid 는 화면에서 「게시판 목록」 — 병합으로 데이터가 되돌아와도 「원문」이라 하지 않는다',
    L.sourceLink({ url: 'https://www.korea.ac.kr/ko/568/subview.do?nttId=000100000000003863', title: '[교외-10/12] 송화재단' }, 'card'),
    { href: 'https://www.korea.ac.kr/ko/568/subview.do?nttId=000100000000003863', kind: 'list', cls: 'list', label: '게시판 목록에서 보기 ↗', hint: '[교외-10/12] 송화재단', caution: '' });

  /* ③ 종류와 이름 — 층2(재단 홈페이지)를 **모든 화면**이 같은 이름으로 부른다 */
  const kosaf = { sourceUrl: 'https://namgu.gwangju.kr', sourceKind: 'kosaf' };
  eq('③ 층2 재단 홈페이지 — 상세·금액·신청 내역·활동 어디서도 「원문」이라 부르지 않는다',
    ['detail', 'amount', 'applog'].map((s) => L.sourceLink(kosaf, s).label), ['재단 홈페이지 ↗', '재단 홈페이지 ↗', '재단 홈페이지 열기 ↗']);
  eq('  상시 제도(program)는 한국장학재단', L.sourceLink({ sourceUrl: 'https://www.kosaf.go.kr', program: true }, 'applog').label, '한국장학재단에서 보기 ↗');
  eq('  목록 표식 — 이름은 게시판 목록 · 찾을 제목을 함께', L.sourceLink({ sourceUrl: 'https://a.kr/list.do#n-%EC%A0%9C%EB%AA%A9' }, 'detail'),
    { href: 'https://a.kr/list.do#n-%EC%A0%9C%EB%AA%A9', kind: 'list', cls: 'list', label: '게시판 목록 ↗', hint: '제목', caution: '' });
  eq('  보통 주소는 예전 글자 그대로(승인받은 화면을 바꾸지 않는다)',
    ['detail', 'amount', 'applog', 'card', 'activity'].map((s) => L.sourceLink({ url: 'https://dep.hufs.ac.kr/bbs/x/1' }, s).label),
    ['원문 공고 ↗', '원문 공고 ↗', '공고 원문 보기 ↗', '원문 보기 ↗', '원문에서 신청하기 ↗']);
  eq('  기관 홈페이지 주소(청년정책 API 실측 jeju index.htm)는 활동 시트에서 「신청하기」라 하지 않는다',
    L.sourceLink({ url: 'https://www.jeju.go.kr/index.htm' }, 'activity').label, '주최 측 홈페이지 ↗');
  L.setLinkChecks({ updatedAt: 't', bad: { 'https://s.kr/x?a=1&b=2': { v: 'list', at: '2026-10-04' }, 'https://s.kr/y?id=9': { v: 'gone', at: '2026-10-04' } } });
  eq('  로봇이 확정한 목록 — 이스케이프된 채 저장된 주소도 같은 열쇠로 찾는다', L.sourceLink({ url: 'https://s.kr/x?a=1&amp;b=2', title: 'T' }, 'card').label, '게시판 목록에서 보기 ↗');
  eq('  로봇이 확정한 404 — 이름에 (확인 필요) + 본 것을 그대로 한 줄',
    [L.sourceLink({ url: 'https://s.kr/y?id=9' }, 'detail').label, L.sourceLink({ url: 'https://s.kr/y?id=9' }, 'detail').caution],
    ['원문 공고(확인 필요) ↗', '이 주소가 열리지 않았어요 (2026-10-04 확인) — 게시판에서 제목으로 찾아 주세요.']);
  L.setLinkChecks(null);
  eq('  장부를 비우면 다시 보통 주소', L.sourceLink({ url: 'https://s.kr/y?id=9' }, 'detail').kind, 'page');

  /* ④ 로봇 판정 — 실측에서 틀렸던 경우들 */
  eq('④ 게시판 행 꼬리(작성 부서·날짜·조회수)를 뗀다 — 이 꼬리로 멀쩡한 항공대 3건이 목록으로 덮였다',
    J.stripRowTail('2026학년도 2학기 교내장학금 신청 안내 학생지원팀 2026-09-02 1,076'), '2026학년도 2학기 교내장학금 신청 안내');
  const others = ['2026 가송재단 장학생 선발 공고', '2026학년도 2학기 국가근로장학생 모집', '서울인재대학장학금 신청 안내 2026', '관정이종환교육재단 장학생 선발', '2026 미래에셋 해외교환 장학생 모집'];
  const want = ['2026학년도 2학기 교내장학금 신청 안내'];
  const listText = `${others.join('\n')}\n${want[0]}\n${'x'.repeat(500)}`;
  eq('  목록에 번호만 붙인 주소(가천·고려 subview.do?nttId=) — 제목은 보여도 목록', J.judgeLanding({ status: 200, requestedUrl: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=1', docTitle: '전체공지', text: listText, titles: want, otherTitles: others }).v, 'list');
  eq('  다른 글 제목을 안 넘기면 목록을 못 알아본다 — 그래서 순찰이 목록 41건을 통과시켰다(무력화 증거)', J.judgeLanding({ status: 200, requestedUrl: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=1', docTitle: '전체공지', text: listText, titles: want, otherTitles: [] }).v, 'post');
  eq('  제목 먼저 — 머리의 회원 로그인 상자(비밀번호 칸)로 멀쩡한 공고를 로그인 벽이라 하지 않는다(전북·부경 실측)',
    J.judgeLanding({ status: 200, requestedUrl: 'https://www.jbnu.ac.kr/a?nttId=1', docTitle: `${want[0]} | 전북대`, text: `로그인 아이디 비밀번호 ${'y'.repeat(600)}`, hasPassword: true, titles: want, otherTitles: others }).v, 'post');
  eq('  이전글·다음글이 있는 상세는 목록이 아니다(중앙대 — 상세에 목록이 함께 그려진다)',
    J.judgeLanding({ status: 200, requestedUrl: 'https://c.kr/v?id=1', docTitle: '중앙대', text: `${want[0]} 작성일 2026.09.01 이전글 다음글 ${listText}`, titles: want, otherTitles: others }).v, 'post');
  eq('  껍데기 화면은 판정 불가(동국대 — 막혔을 때 오는 화면을 「다른 글」로 몰지 않는다)', J.judgeLanding({ status: 200, requestedUrl: 'https://d.kr/v?id=1', text: '메뉴 홈', titles: want }).v, 'unread');
  eq('  첫 화면으로 돌려보내짐 · 기관 홈페이지 · 메뉴 페이지(파안 sub04_01.php) · 404 · 503',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://d.kr/v?id=1', finalUrl: 'https://d.kr/', text: 'z'.repeat(800), titles: want }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://www.jeju.go.kr/index.htm', text: `제주특별자치도 ${'z'.repeat(2000)}`, titles: ['청년 체인지메이커 아카데미 운영'] }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://paan.or.kr/sub/sub04_01.php', text: `장학사업 소개 ${'z'.repeat(2000)}`, titles: ['장학생 신청/자선기금 수혜자 모집 및 발표 2026'] }).v,
      J.judgeLanding({ status: 404, requestedUrl: 'https://x.kr/a?id=1' }).v,
      J.judgeLanding({ status: 503, requestedUrl: 'https://x.kr/a?id=1' }).v],
    ['home', 'home', 'other', 'gone', 'unread']);

  /* ⑤ 확정 — 한 번 본 것으로 앱 글자를 바꾸지 않는다 */
  let s = J.nextState(undefined, { v: 'list', why: 'a' }, '2026-10-04');
  const s1 = [s.n, s.confirmed];
  s = J.nextState(s, { v: 'list', why: 'a' }, '2026-10-04');
  const s2 = [s.n, s.confirmed];
  s = J.nextState(s, { v: 'unread', why: 'x' }, '2026-10-05');
  const s3 = [s.v, s.confirmed];
  s = J.nextState(s, { v: 'list', why: 'a' }, '2026-10-06');
  const s4 = [s.n, s.confirmed];
  s = J.nextState(s, { v: 'post', why: 'ok' }, '2026-10-07');
  eq('⑤ 다른 날 두 번이어야 확정 · 같은 날 두 번은 한 번 · 모름은 판정을 지우지 않음 · 공고가 뜨면 풀림',
    [s1, s2, s3, s4, [s.v, s.confirmed]], [[1, false], [1, false], ['list', false], [2, true], ['post', false]]);
  eq('  한 사이트에서 제목 없는 문제가 절반을 넘으면 막힘 의심(판정 불가) — 단 「제목은 보이는 목록」은 그대로',
    [J.hostGuard([0, 1, 2].map(() => ({ host: 'h', v: 'other', why: '다른 글' })).concat([{ host: 'h', v: 'post', why: '' }])).map((x) => x.v),
      J.hostGuard([0, 1, 2, 3].map(() => ({ host: 'g', v: 'list', why: '제목은 보이나 다른 공고 제목이 여럿 함께 보임(목록)' }))).map((x) => x.v)],
    [['unread', 'unread', 'unread', 'post'], ['list', 'list', 'list', 'list']]);
  eq('  앱이 받는 파일에는 확정된 문제 + 지금 실린 주소만(열쇠는 되돌린 주소)',
    J.publishBad({ 'https://a/x?a=1&b=2': { v: 'list', at: 'd', confirmed: true }, 'https://a/y': { v: 'list', at: 'd', confirmed: false }, 'https://a/z': { v: 'list', at: 'd', confirmed: true } }, ['https://a/x?a=1&amp;b=2']),
    { 'https://a/x?a=1&b=2': { v: 'list', at: 'd' } });
  eq('  앱과 로봇의 문제 종류는 한 벌', J.BAD, L.LINK_BAD);

  /* ⑦ 2026-10-03 리뷰(로봇 갈래) 여섯 — 실측 재현 사례 그대로 */
  const fdn = '관정이종환교육재단';
  const ftitle = [`2026학년도 ${fdn} 장학생 선발 공고`];
  eq('⑦ LC-2 머리글이 공고 제목 **안에 든 짧은 이름**(재단 이름)이면 제목 자리가 아니다 · 잘린 제목·제목을 품은 머리글은 맞다',
    [J.headMatches(ftitle[0], fdn), J.headMatches(ftitle[0], `${ftitle[0]} | 공지사항`), J.headMatches(ftitle[0], `2026학년도 ${fdn} 장학생 선발`)], [false, true, true]);
  eq('  LC-2 첫 화면으로 돌려보내지면 첫 화면 띠에 그 제목이 있어도 home · 재단 이름이 창 제목인 없는 글(soft-404)은 post 가 아니다',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://www.ikjf.or.kr/board/view?id=1', finalUrl: 'https://www.ikjf.or.kr/', docTitle: fdn, headings: [`공지 ${ftitle[0]}`], text: `${ftitle[0]} ${'z'.repeat(800)}`, titles: ftitle }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://www.ikjf.or.kr/board/view?id=11', docTitle: fdn, headings: [fdn], text: `요청하신 게시물이 존재하지 않습니다 ${'z'.repeat(1600)}`, titles: ftitle }).v !== 'post'],
    ['home', true]);
  eq('  LC-5 짧은 로그인 화면(비밀번호 칸)은 판정 불가가 아니라 login · HTTP 401 은 gone 이 아니라 login',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://s.kr/view?id=5', finalUrl: 'https://s.kr/sso/login', text: '통합 로그인 아이디 비밀번호', hasPassword: true, titles: ftitle }).v,
      J.judgeLanding({ status: 401, requestedUrl: 'https://s.kr/view?id=5', titles: ftitle }).v], ['login', 'login']);
  const g404 = J.hostGuard([1, 2, 3, 4, 5].map((i) => ({ host: 'big', v: 'gone', why: 'HTTP 404', decisive: true, wasBad: true }))
    .concat([1, 2, 3].map(() => ({ host: 'big', v: 'post', why: '' }))));
  const gPend = J.hostGuard([1, 2, 3, 4, 5].map(() => ({ host: 'b2', v: 'other', why: '다른 글', wasBad: true }))
    .concat([1, 2, 3].map(() => ({ host: 'b2', v: 'post', why: '' }))));
  const gHome = J.hostGuard([1, 2, 3, 4].map(() => ({ host: 'b3', v: 'home', why: '사이트 첫 화면으로 돌려보내짐', decisive: true })));
  const gBlock = J.hostGuard([1, 2, 3, 4, 5, 6, 7, 8].map(() => ({ host: 'b4', v: 'other', why: '다른 글' })));
  eq('  LC-1 막힘 의심은 처음 보는 제목 없는 문제로만 잰다 — 404·첫 화면 돌려보냄은 결정적 · 다시 연 문제 다섯 + 공고 셋은 막힘 아님 · 처음 보는 여덟이 다 제목 없으면 막힘',
    [g404.filter((r) => r.v === 'gone').length, gPend.filter((r) => r.v === 'other').length, gHome.filter((r) => r.v === 'home').length, gBlock.every((r) => r.v === 'unread')],
    [5, 5, 4, true]);
  let s6 = J.nextState(undefined, { v: 'list', why: 'a' }, '2026-10-04');
  s6 = J.nextState(s6, { v: 'other', why: 'b' }, '2026-10-05');
  const c1 = [s6.v, s6.n, s6.confirmed];
  s6 = J.nextState(s6, { v: 'list', why: 'a' }, '2026-10-06');
  eq('  LC-6 문제의 종류가 날마다 바뀌어도(목록 ↔ 다른 화면) 다른 날 두 번이면 확정 · 확정은 공고가 뜰 때까지 유지', [c1, [s6.v, s6.confirmed]], [['other', 2, true], ['list', true]]);
  const lcSrc = fs.readFileSync(new URL('collector/link-check.mjs', ctx.root), 'utf8');
  eq('  LC-3 확인 로봇은 판정 재료를 observeLanding 한 벌로 읽는다(h1~h3 를 전부 제목 자리로 세는 사본 없음)',
    [/import \{ observeLanding \} from '\.\/detail-url\.mjs'/.test(lcSrc), /querySelectorAll\('h1,h2,h3'\)/.test(lcSrc), /await observeLanding\(page, res\)/.test(lcSrc)], [true, false, true]);
  eq('  LC-1 확인 로봇은 hostGuard 에 decisive·wasBad 를 넘긴다', /decisive: !!verdict\.decisive, wasBad/.test(lcSrc), true);

  /* ⑥ 병합 순위 — 합집합 병합기·발행 중복 정리가 고르는 쪽 (2026-10-03 · 사람이 고친 표식이 병합 때마다 되돌려지던 길) */
  const U = await import('../../collector/url-key.mjs');
  const UC = require('../../collector/url-key.cjs');
  const real = { url: 'https://www.gachon.ac.kr/bbs/kor/478/125842/artclView.do' };
  const mk = { url: 'https://www.gachon.ac.kr/bbs/kor/475/artclList.do#n-x' };
  const li = { url: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125842' };
  const order = (P) => [P(li, mk) === mk, P(mk, li) === mk, P(li, real) === real, P(mk, real) === real, P(real, mk) === real];
  const reOf = (src) => (src.match(/const LIST_PLUS_ID_RE = (\/.*\/i);/) || [])[1] || '';
  const slSrc = fs.readFileSync(new URL('source-link.js', ctx.root), 'utf8');
  const ukSrc = fs.readFileSync(new URL('collector/url-key.mjs', ctx.root), 'utf8');
  eq('⑥ url-key.mjs 의 「목록 주소+번호」 정규식은 source-link.js 원본과 글자까지 같다(관리자 화면 때문에 둔 사본) · url-key.mjs 는 source-link.js 를 import 하지 않는다',
    [reOf(ukSrc).length > 20 && reOf(ukSrc) === reOf(slSrc), /from '\.\.\/source-link\.js'/.test(ukSrc)], [true, false]);
  eq('  진짜 주소 > 목록 표식 > 목록 주소+번호 — ESM(수집기·병합기)과 CJS 다리(감사)가 같은 답',
    [order(U.preferNotice), order(UC.preferNotice)], [[true, true, true, true, true], [true, true, true, true, true]]);
}
