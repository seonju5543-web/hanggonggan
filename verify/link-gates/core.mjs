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
  eq('② 꼴: index·main 은 홈페이지 · 맨 도메인은 root(화면에선 보통 주소 — 공모전 전용 사이트 · 리뷰 APP-2) · 한 칸 폴더는 단정하지 않음 · 표식·스크립트',
    ['https://namgu.gwangju.kr', 'https://www.jeju.go.kr/index.htm', 'http://janghak.songpa.go.kr/main.jsp', 'https://nysc.or.kr/nysc/', 'https://a.kr/list.do#n-%EC%A0%9C', 'javascript:void(0)', '', 'https://a.kr/view.do?id=3'].map(L.linkShape),
    ['root', 'home', 'home', 'page', 'marker', 'none', 'none', 'page']);
  eq('  맨 도메인 공모전 사이트(maicon.kr)는 활동 시트에서 그대로 「원문에서 신청하기」 · 로봇이 첫 화면으로 확정하면 그때 홈페이지',
    [L.sourceLink({ url: 'https://maicon.kr/' }, 'activity').label, (() => { L.setLinkChecks({ bad: { 'https://maicon.kr/': { v: 'home', at: '2026-10-05' } } }); const x = L.sourceLink({ url: 'https://maicon.kr/' }, 'activity').label; L.setLinkChecks(null); return x; })()],
    ['원문에서 신청하기 ↗', '주최 측 홈페이지 ↗']);
  eq('  판정기는 맨 도메인도 첫 화면으로 본다 — 돌려보내짐 · 제목 없는 뿌리 주소',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://d.kr/v?id=1', finalUrl: 'https://d.kr/', text: 'z'.repeat(800), titles: ['어떤 공고 제목 테스트 2026'] }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://namgu.gwangju.kr/', text: `남구청 ${'z'.repeat(2000)}`, titles: ['행복나눔 장학생 선발 2026'] }).v], ['home', 'home']);
  eq('  (리뷰 F2) 제목에 날짜가 든 공고도 본문에서 찾는다 · 기대 제목이 앱 이름뿐이면 「다른 글」을 단정하지 않는다',
    [J.judgeLanding({ status: 200, requestedUrl: 'https://k.kr/v?id=1', docTitle: '통합 공지사항', text: `공지 [춘천인재육성장학재단] 2026년 하반기 봄내장학생 선발 안내 (2026.09.28.(월) ~ 2026.10.07.(수)) 작성일 첨부 ${'z'.repeat(400)}`, titles: ['[춘천인재육성장학재단] 2026년 하반기 봄내장학생 선발 안내 (2026.09.28.(월) ~ 2026.10.07.(수))'] }).v,
      J.judgeLanding({ status: 200, requestedUrl: 'https://g.kr/bbs/kor/478/122594/artclView.do', docTitle: '가천대', headings: ['[공통] 2026년도 하반기 동산장학회 장학생 선발 안내(이공계 전공 새터민 대상) N'], text: `작성일 2026.09.01 첨부 ${'z'.repeat(600)}`, titles: ['동산장학회 장학생 (이공계 새터민 대상)'], titlesFromNameOnly: true }).v],
    ['post', 'unread']);

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
  const ent = { url: 'https://student.snu.ac.kr/x/?mod=document&#038;uid=361' };
  const dec = { url: 'https://student.snu.ac.kr/x/?mod=document&uid=361' };
  eq('  (리뷰 F4) 기호가 남은 주소는 되돌린 같은 주소에 진다(어느 쪽이 먼저 와도) — ESM·CJS', [U.preferNotice(ent, dec) === dec, U.preferNotice(dec, ent) === dec, UC.preferNotice(ent, dec) === dec], [true, true, true]);
  const twinA = { school: '가천대학교', title: '[장학공지] 2026년 우양재단 동행 장학생 모집', url: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125843', foundAt: '2026-10-01' };
  const twinB = { school: '가천대학교', title: '[공통] 2026년 우양재단 동행 장학생 모집 N', url: 'https://www.gachon.ac.kr/bbs/kor/478/125843/artclView.do', foundAt: '2026-10-01' };
  eq('  (리뷰 F4) 제목 머리말이 다른 쌍둥이(목록+번호 ↔ 같은 글 번호의 진짜 주소)는 한 장으로 합쳐지고 진짜 주소가 남는다 · 다른 글은 안 합친다',
    [U.dedupeNotices([twinA, twinB]).map((n) => n.url), UC.dedupeNotices([twinB, twinA]).map((n) => n.url),
      U.dedupeNotices([{ ...twinB, url: 'https://www.gachon.ac.kr/bbs/kor/478/1/artclView.do' }, { ...twinB, title: '다른 공고 2026 장학', url: 'https://www.gachon.ac.kr/bbs/kor/478/2/artclView.do' }]).length],
    [[twinB.url], [twinB.url], 2]);
  eq('  진짜 주소 > 목록 표식 > 목록 주소+번호 — ESM(수집기·병합기)과 CJS 다리(감사)가 같은 답',
    [order(U.preferNotice), order(UC.preferNotice)], [[true, true, true, true, true], [true, true, true, true, true]]);
  /* ⑧ 화면 확인 도구(what-shows.mjs)가 떼어 오는 앱 함수가 쓰는 한 줄 const 를 전부 같이 떼어 온다 (리뷰 G3 —
     기간 한 줄이 달린 게시판 글에서 `hintText is not defined` 로 넘어졌다 · 그 꼴의 글이 없는 날엔 조용하다).
     실데이터 없이 글자로만 잰다: 떼어 오는 함수 몸에 나오는 app.js 최상위 const 이름이 목록에 없으면 실패. */
  {
    const appSrc = fs.readFileSync(new URL('app.js', ctx.root), 'utf8');
    const ws = fs.readFileSync(new URL('verify/what-shows.mjs', ctx.root), 'utf8');
    const linkBlock = ws.slice(ws.indexOf('vm.runInContext([', ws.indexOf('const linkCtx')), ws.indexOf("'app.js(링크 자리)'"));
    const listOf = (re) => [...linkBlock.matchAll(re)].flatMap((m) => [...m[1].matchAll(/'([A-Za-z_$][\w$]*)'/g)].map((x) => x[1]));
    const consts = listOf(/\.\.\.\[([^\]]*)\]\.map\(takeConst\)/g);
    const fns = listOf(/\.\.\.\[([^\]]*)\]\.map\(takeFn\)/g);
    const topConst = [...appSrc.matchAll(/^const ([A-Za-z_$][\w$]*) = .*$/gm)].map((m) => m[1]);
    const body = (n) => (appSrc.match(new RegExp(`^function ${n}\\([\\s\\S]*?^\\}`, 'm')) || [''])[0];
    const constLine = (n) => (appSrc.match(new RegExp(`^const ${n} = .*$`, 'm')) || [''])[0];
    const used = new Set();
    for (const src of [...fns.map(body), ...consts.map(constLine)]) {
      for (const c of topConst) if (new RegExp(`\\b${c.replace(/\$/g, '\\$')}\\b`).test(src)) used.add(c);
    }
    const missing = [...used].filter((c) => !consts.includes(c));
    eq('⑧ what-shows.mjs 링크 자리 — 떼어 오는 앱 함수가 쓰는 한 줄 const 가 빠짐없이 같이 온다(빠지면 그 꼴의 글에서만 넘어진다)',
      [fns.length > 10, consts.includes('hintText'), missing], [true, true, []]);
  }
  /* ⑨ 주소가 고쳐진 옛 공고가 '새 공고'로 다시 울리지 않는다 (리뷰 F3 — 사냥꾼이 표식을 진짜 주소로 고치면 같은 공고의 주소가 바뀐다) */
  {
    const NR = require('../../notify-rules.js');
    const day = 864e5;
    const t0 = Date.parse('2026-10-03T03:00:00Z');
    const profile = { school: '가천대학교' };
    const mine = () => true;
    const base = { profile, scholarships: [], applications: [], noticeForProfile: mine, notStale: () => true };
    /* 날짜를 하루씩 넘긴다 — 같은 날 같은 건수의 알림은 원래 한 번만이라(sent 열쇠) 같은 날로 재면 되돌려도 통과한다(헛돈다) */
    const old = { school: '가천대학교', title: '[장학공지] 2026 동행 장학생 모집', url: 'https://www.gachon.ac.kr/bbs/kor/475/artclList.do#n-x', foundAt: '2026-10-03' };
    const r1 = NR.evaluate({ ...base, now: t0, notices: [old], ledger: { baseline: true, enabled: true, lastCheck: t0 - day, prefs: { feed: true } } });
    const fixed = { ...old, url: 'https://www.gachon.ac.kr/bbs/kor/478/125843/artclView.do' };
    const r2 = NR.evaluate({ ...base, now: t0 + day * 1.25, notices: [fixed], ledger: r1.ledger });   // 수집일이 가까워 제목 열쇠만 막는다
    const legacy = NR.evaluate({ ...base, now: t0 + 3 * day, notices: [{ ...fixed, foundAt: '2026-10-01' }], ledger: { baseline: true, enabled: true, lastCheck: t0 + 2 * day, seenNotice: [old.url], prefs: { feed: true } } });
    const fresh = { school: '가천대학교', title: '2026 새 재단 장학생 모집', url: 'https://www.gachon.ac.kr/bbs/kor/478/125900/artclView.do', foundAt: '2026-10-03' };
    const r3 = NR.evaluate({ ...base, now: t0 + day * 1.25, notices: [fixed, fresh], ledger: r1.ledger });   // 다음 날 — 같은 날 같은 건수 알림은 원래 한 번만(sent 열쇠)
    const feedN = (r) => r.events.filter((e) => e.type === 'feed').map((e) => e.title);
    eq('⑨ 같은 공고의 주소가 고쳐져도 새 공고로 다시 울리지 않는다(제목 열쇠) · 열쇠 없던 옛 장부도(수집일이 지난 확인보다 이틀 앞) · 진짜 새 공고는 운다',
      [feedN(r1).length, feedN(r2), feedN(legacy), feedN(r3)],
      [1, [], [], ['가천대학교 새 공고 1건']]);
  }
  /* ⑩ 확인 로봇 첫 실행(2026-10-04 02:55)의 오판 둘 — 정찰(run-probe 2026-10-03 · run 37142940191)이 연 진짜 화면 글자로 잰다.
     ⓐ 서울과기대 상세(do=commonview): 제목이 머리글이 아니라 표의 「제목」 칸에 있고 화면에 다른 글 제목이 여럿 → 'list' 로 오판했다.
        「제목」 이름표 바로 뒤가 그 공고 제목이면 그 글 화면이다(목록의 「제목」은 머리 칸이라 뒤에 「작성자」가 온다).
     ⓑ 국민대: 게시판 줄 통째(분류 「등록금외지원」 + 제목 + 날짜·부서·담당자)가 기대 제목이라 'other' 로 오판했다 —
        줄 꼬리(날짜 뒤 이름 몇 개)를 떼고, 제목의 대부분(60% · 12자 이상)이 이어서 보이면 본문 증거로 본다. */
  {
    const others = ['2026학년도 2학기 국가장학금 2차 신청 안내', '2026년 하반기 인천인재평생교육진흥원 장학생 선발 안내', '2026학년도 2학기 교내장학금 신청 안내'];
    const ST = '장학공지 대학공지사항 학사공지 장학공지 대학원공지 장학금 신청 주요 일정 장학제도안내 바로가기 제목 [보건진료소] 2026학년도 2학기 국가근로장학생 모집 안내 작성자 학생지원과 조회수 1588 날짜 2026-08-20 첨부파일 모집공고.hwp 본문 근로장학생을 모집합니다 '
      + others.join(' 학생지원과 2026-08-19 ') + ' '.repeat(10) + '가'.repeat(400);
    const st = J.judgeLanding({ status: 200, requestedUrl: 'https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&bidx=894195', docTitle: '서울과학기술대학교 - 정보·민원서비스 - 대학정보알림 - 장학공지 - 상세내용', headings: [], text: ST,
      titles: ['[보건진료소] 2026학년도 2학기 국가근로장학생 모집 안내'], otherTitles: others });
    const LIST = '번호 제목 작성자 날짜 조회수 1 [보건진료소] 2026학년도 2학기 국가근로장학생 모집 안내 학생지원과 2026-08-20 1588 ' + others.map((t, i) => `${i + 2} ${t} 학생지원과 2026-08-1${i} 99`).join(' ') + '가'.repeat(400);
    const lst = J.judgeLanding({ status: 200, requestedUrl: 'https://www.seoultech.ac.kr/service/info/janghak/?do=list', docTitle: '장학공지', headings: [], text: LIST,
      titles: ['[보건진료소] 2026학년도 2학기 국가근로장학생 모집 안내'], otherTitles: others });
    const KM = '국민대학교 대학소개 입학안내 KMU 소식 공지사항 장학공지 장학공지 2026년 하반기 인재육성 장학생 선발 계획 공고 작성일 2026.09.08 담당부서 대전청년내일재단 담당자 대전청년내일재단 ☎ 0427198451 조회수 12285 첨부파일 2026년 성취(대) 장학생 선발계획 공고.hwpx ' + '나'.repeat(1600);
    const row = '등록금외지원 2026년 하반기 인재육성 장학생 선발 계획 공고 2026.09.08 대전청년내일재단 황새롬';
    const km = J.judgeLanding({ status: 200, requestedUrl: 'https://www.kookmin.ac.kr/user/kmuNews/notice/7/12349/view.do?currentPageNo=1', docTitle: '장학공지:국민대학교', headings: ['국민대학교'], text: KM,
      titles: J.expectTitles({ boardTitle: row, name: row }), otherTitles: [] });
    const kmOther = J.judgeLanding({ status: 200, requestedUrl: 'https://www.kookmin.ac.kr/user/kmuNews/notice/7/12350/view.do', docTitle: '장학공지:국민대학교', headings: ['국민대학교'],
      text: KM.replace('2026년 하반기 인재육성 장학생 선발 계획 공고', '2026학년도 2학기 국가근로장학생 모집 안내'), titles: J.expectTitles({ boardTitle: row, name: row }), otherTitles: [] });
    eq('⑩ 정찰 실화면 — 서울과기대 「제목」 칸의 상세는 post · 같은 학교 목록 화면은 그대로 list · 국민대 줄 통째 제목도 post · 다른 글은 그대로 other',
      [st.v, lst.v, km.v, kmOther.v, J.stripRowTail(row)], ['post', 'list', 'post', 'other', '등록금외지원 2026년 하반기 인재육성 장학생 선발 계획 공고']);
  }
  /* ⑪ 정찰 2차(run 37143828149)의 실화면 — ⓐ 충남청년포털: 짧은 정책 이름(`창업어가 멘토링` · 7자)이 「정책명」 이름표 뒤와 길잡이에 거듭 보이는 그 글 화면
     ⓑ 영동군민장학회: 피드 제목이 잘려 `…` 로 끝나(`… 신청 마…`) 「제목」 칸의 온전한 제목과 못 맞췄다 ⓒ 아르코: 정말 다른 공지가 열린다(그대로 other) */
  {
    const CN = '본문 바로가기 영농ㆍ정착 HOME 영농ㆍ정착 + 청년정착지원 + 창업어가 멘토링 청년정착지원 창업어가와 후견인을 1:1 매칭하여, 후견인의 교육 및 지도에 필요한 비용 지원 사업개요 정책명 창업어가 멘토링 정책 소개 창업어가와 후견인을 1:1 매칭하여 주관기관 충청남도 주관부서 수산자원연구소 등록일 2026-03-09 ' + '다'.repeat(1600);
    const cn = J.judgeLanding({ status: 200, requestedUrl: 'https://youth.chungnam.go.kr/web/main/customSupp/M050-08/view?bizId=A20260309CT000000000003017', docTitle: '상세내용 | 청년정착지원 | 영농ㆍ정착 | 충남청년포털', headings: [], text: CN,
      titles: J.expectTitles({ title: '창업어가 멘토링' }), otherTitles: [] });
    const cnOther = J.judgeLanding({ status: 200, requestedUrl: 'https://youth.chungnam.go.kr/web/main/customSupp/M050-08/view?bizId=X', docTitle: '상세내용 | 충남청년포털', headings: [], text: CN.replace(/창업어가 멘토링/g, '청년 귀어 정착 지원'),
      titles: J.expectTitles({ title: '창업어가 멘토링' }), otherTitles: [] });
    const YD = '(재)영동군민장학회 열린마당 공지사항 HOME 열린마당 공지사항 인쇄 공유 제목 2026년도 향토장학금 지원 신청 마감 (~ 8.31.) 안내 작성자 관** 조회수 398 등록일 2026-07-30 16:23:48.0 첨부파일 1 : 2026년 향토장학금 안내문 및 신청서 ' + '라'.repeat(1600);
    const yd = J.judgeLanding({ status: 200, requestedUrl: 'https://ydjh.yd21.go.kr/zboard/read.do?lmCode=notice&pd_pkid=240', docTitle: '영동군민장학회', headings: ['(재)영동군민장학회'], text: YD,
      titles: J.expectTitles({ title: '2026년도 향토장학금 지원 신청 마…' }), otherTitles: [] });
    const AR = '한국문화예술위원회 소식 공지사항 공지사항 2027 문화예술진흥기금 공모사업 사전 안내 조회수 10443 등록일 2026.09.23 담당부서 지원총괄팀 담당자 신연주 첨부파일 2027년 문화예술진흥기금 공모사업 사전 안내.hwp ' + '마'.repeat(1600);
    const ar = J.judgeLanding({ status: 200, requestedUrl: 'https://arko.or.kr/board/view/4053?cid=1811182', docTitle: '한국문화예술위원회 > 소식 > 공지사항 > 공지사항(상세)', headings: ['글자·화면 표시 설정'], text: AR,
      titles: J.expectTitles({ title: '무대기술인턴십 지원' }), otherTitles: [] });
    eq('⑪ 정찰 2차 실화면 — 충남 짧은 정책 이름(정책명 칸·거듭 보임)은 post · 다른 정책이면 other · 영동 잘린 제목(…)은 post · 아르코 다른 공지는 그대로 other',
      [cn.v, cnOther.v, yd.v, ar.v], ['post', 'other', 'post', 'other']);
  }
}
