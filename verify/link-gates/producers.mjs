/* 「원문 링크 정직성」 — producers 갈래 (2026-10-03): 원문 주소를 **만들고 고치는** 로봇들
   (링크 사냥꾼 · 원문 링크 복구 · 브라우저 수집 · 일반 수집 · 자동 등록 · 공공 API)
   🔴 여기 기대 값은 **실측 주소**다 — 가천·고려 `subview.do?nttId=`(번호를 무시하고 목록을 주는 서버 · 저장된 본문이 가천 18건 2가지 · 고려 9건 1가지) ·
      서울교대 `selectNttList.do?…&nttId=` · K2Web `…/<글>/artclView.do` · 충북 `selectBbsNttView.do?…nttNo=` · 계명 `parm_bod_uid` ·
      서울대 `&#038;` · 제주 `index.htm` · 송파 `main.jsp` · 2026-10-03 순찰이 멀쩡한 원문 5건을 목록 표식으로 덮어쓴 사고.
   로봇 파일(link-hunter·resolve-detail-urls·browser-collect·collect·auto-register)은 **불러오는 순간 실행**되므로 글자로만 잰다.
   그 대신 그 로봇들이 부르는 공용 함수(detail-url · board-links · open-api-map · link-landing)는 실제로 돌려 본다. */
import fs from 'node:fs';
import * as D from '../../collector/detail-url.mjs';
import * as B from '../../collector/board-links.mjs';
import * as O from '../../collector/open-api-map.mjs';
import { judgeLanding } from '../../collector/link-landing.mjs';

/* 주석을 걷어낸 코드 — 주석에 '예전엔 이렇게 했다'를 적어 두니 그 글자를 잡지 않게 */
const code = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1 ');
/* 함수 하나의 본문(다음 최상위 선언 전까지) */
const fnBody = (src, head) => {
  const a = src.indexOf(head);
  if (a < 0) return '';
  const rest = src.slice(a + head.length);
  const m = rest.search(/\n(?:async function |function |const |let |report\.push\(|for \(const \[)/);
  return head + (m < 0 ? rest : rest.slice(0, m));
};

/* ⑤ 고정 묶음(onlyBoard)이 아무것도 가리키지 않는가 — 실행 트리거 파일의 글자와 표식 주소 목록으로만 판단하는 순수 함수 */
export function pinProblems(text, markerUrls) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^\s*onlyBoard:\s*(\S.*?)\s*$/);
    if (!m) continue;
    const pin = m[1];
    const n = markerUrls.filter((u) => D.listUrlOf(u).includes(pin)).length;
    if (!n) out.push(`onlyBoard: ${pin} — 표식(#n-) 0건`);
  }
  return out;
}

export default async function gate(eq, ctx = {}) {
  const root = ctx.root || new URL('../../', import.meta.url);
  const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');

  /* ── ① 고치는 로봇은 멀쩡한 원문을 목록 표식으로 덮어쓰지 않는다 ───────────────────────── */
  const lh = read('collector/link-hunter.mjs');
  const lhc = code(lh);
  const patrol = fnBody(lhc, 'async function runPatrol(');
  eq('① 링크 사냥꾼 순찰(runPatrol)을 잘랐다 — 자르기가 깨지면 아래가 무의미하다', patrol.length > 300 && /verify\(/.test(patrol), true);
  eq('  순찰은 공고 주소 칸에 아무것도 쓰지 않는다 — 2026-10-03 멀쩡한 원문 5건(항공대 3·건국·부경)을 목록 표식으로 덮어썼다',
    /\.ref\[[^\]]+\]\s*=(?!=)/.test(patrol), false);
  eq('  순찰은 게시판 원제목도 덮어쓰지 않는다', /boardTitle\s*=(?!=)/.test(patrol), false);
  eq('  순찰에 목록 표식(#n-)을 만드는 자리가 없다', /#n-/.test(patrol), false);
  eq('  사냥꾼 어디에도 공고 주소에 #n- 표식을 대입하는 줄이 없다(사냥은 표식을 원문으로 바꾸기만 한다)',
    /\.ref\[[^\]]+\]\s*=\s*`[^`]*#n-/.test(lhc), false);
  eq('  순찰을 켜도 판정만 장부(link-hunt.json)에 남긴다', /st\.patrol\s*=\s*\{\s*v:/.test(patrol), true);
  /* 게시판 원제목(boardTitle)으로 **사람이 다듬은 앱 이름**을 저장하지 않는다 — 대조가 영영 빗나가고(2026-08-01 미아 8건),
     순찰 시절엔 그 이름과 상세 화면이 안 맞는다며 멀쩡한 링크를 덮어썼다 */
  const btAssign = [...lhc.matchAll(/\.boardTitle\s*=(?!=)\s*([^;\n]+)/g)].map((m) => m[1].trim());
  eq('  boardTitle 에 넣는 값은 둘뿐 — 게시판 글자를 다듬은 것(clean) · 같은 글 실시간 공고 제목(행 꼬리 뗌)',
    btAssign.sort(), ['clean', 'cleanTitle(stripRowTail(mate.title))'].sort());
  const remember = fnBody(lhc, 'function rememberBoardTitle(');
  eq('  앱 이름에서 온 제목이면 게시판에서 본 행 글자를 대신 적는다', /h\.from === 'name' \? \(boardText/.test(remember), true);

  const rd = read('collector/resolve-detail-urls.mjs');
  const rdc = code(rd);
  eq('  원문 링크 복구의 소급 재검사도 되돌리지 않는다(#n- 대입 없음)', /\.(?:ref|d\.ref)\[[^\]]+\]\s*=\s*`[^`]*#n-/.test(rdc), false);
  eq('  원문 링크 복구가 공고 주소 칸에 쓰는 곳은 확인된 원문(found) 하나뿐', [...rdc.matchAll(/\.ref\[[^\]]+\]\s*=(?!=)\s*([^;\n]+)/g)].map((m) => m[1].trim()), ['found']);

  /* ── ② 확인은 공용 판정(judgeLanding) — 다른 글 제목을 넘겨 목록을 알아본다 ─────────────────── */
  for (const [name, src, fn] of [['링크 사냥꾼', lhc, 'async function verify('], ['원문 링크 복구', rdc, 'async function verifyCandidate('], ['브라우저 수집', code(read('collector/browser-collect.mjs')), 'async function verifyDetailUrl(']]) {
    const body = fnBody(src, fn);
    eq(`② ${name} 의 확인 함수는 공용 판정에 다른 글 제목(otherTitles)을 넘긴다`,
      /judgeLanding\(\{[^}]*otherTitles/.test(body), true);
    eq(`  ${name} 는 judgeLanding 을 link-landing.mjs 에서 가져온다(베끼지 않는다)`,
      /import \{[^}]*\bjudgeLanding\b[^}]*\} from '\.\/link-landing\.mjs'/.test(src), true);
    eq(`  ${name} 에 제 로그인 벽·목록 판정 사본이 없다(제목보다 로그인 벽을 먼저 보던 규칙)`, /looksLikeLoginWall\(|looksLikeList\(/.test(src), false);
  }
  eq('  확인을 부를 때 다른 글 제목 자리에 빈 목록([])을 넘기지 않는다 — 순찰이 `verify(url, title, [])` 로 목록 41건을 통과시켰다',
    [lhc, rdc].map((s) => /\bverify(?:Candidate)?\([^;\n]*,\s*\[\]\s*\)/.test(s)), [false, false]);
  const bc = code(read('collector/browser-collect.mjs'));
  eq('  브라우저 수집은 그 게시판의 다른 행 제목을 넘긴다', /verifyDetailUrl\(c, title, others\)/.test(bc) && /const others = boardRowTitles\.filter/.test(bc), true);
  eq('  게시판 \'증명됨\'은 그 공고 화면(post)일 때만 — 목록 판정으로는 안 된다(가천·고려·서울교대 게시판 전체가 목록 주소가 된 길)',
    [/if \(j\.v === 'post'\) \{ patternOk\.set\(url, 'post'\)/.test(bc), [...bc.matchAll(/patternOk\.set\(([^)]*)\)/g)].map((m) => m[1]).sort()],
    [true, ["url, 'bad'", "url, 'post'"]]);
  eq('  판정 불가(망 오류)는 게시판 전체를 표식으로 만들지 않는다(그 행만 · 막힘이 쌓이면 그때 멈춤)',
    /patternOk\.set\(url, false\)/.test(bc) === false && /if \(j\.v === 'unread'\) \{[\s\S]{0,200}?break;/.test(bc) && /unreadCount\.set\(url/.test(bc), true);

  /* 판정 재료 걷기(observeLanding) — 제목 자리는 '화면에 하나뿐인 꼬리표'만 센다. 목록 화면은 행마다 h3 를 달아 둔다 */
  const fakePage = (fx) => ({
    url: () => fx.url, title: async () => fx.docTitle || '',
    evaluate: async (fn, arg) => {
      const prev = globalThis.document;
      globalThis.document = {
        querySelectorAll: (sel) => (fx.els[sel] || []).map((t) => ({ textContent: t })),
        querySelector: (sel) => (sel.startsWith('meta') ? (fx.og ? { getAttribute: () => fx.og } : null) : (sel.includes('password') && fx.password ? {} : null)),
        body: { innerText: fx.text },
      };
      try { return fn(arg); } finally { globalThis.document = prev; }
    },
  });
  const want = '2026학년도 2학기 하나금융나눔재단 하나장학생 선발 안내';
  const rowsK = ['2026 가송재단 장학생 선발 공고 안내', '2026학년도 2학기 국가근로장학생 모집 안내', '서울인재대학장학금 장학생 신청 안내 2026', '관정이종환교육재단 장학생 선발 안내문'];
  const listFx = { url: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125712', docTitle: '전체공지 | 가천대학교', els: { h3: [want, ...rowsK] }, text: `전체공지\n${[want, ...rowsK].join('\n')}\n${'메뉴 '.repeat(200)}` };
  const listObs = await D.observeLanding(fakePage(listFx), { status: () => 200 });
  eq('  재료 걷기: 행마다 달린 h3 는 제목 자리로 세지 않는다', listObs.headings.includes(want), false);
  eq('  목록에 번호만 붙인 주소(가천 subview.do?nttId=) — 다른 행 제목을 넘기면 목록으로 판정', judgeLanding({ ...listObs, requestedUrl: listFx.url, titles: [want], otherTitles: rowsK }).v, 'list');
  const postFx = { url: 'https://www.jbnu.ac.kr/web/Board/218081/detailView.do', docTitle: '전북대학교', og: '', els: { h1: [want], h3: ['로그인'] }, text: `로그인 아이디 비밀번호\n${want}\n작성일 2026.09.30\n${'본문 '.repeat(300)}`, password: true };
  const postObs = await D.observeLanding(fakePage(postFx), { status: () => 200 });
  eq('  머리의 회원 로그인 상자(비밀번호 칸)가 있어도 제목 자리에 그 공고면 원문(전북·부경 실측)', judgeLanding({ ...postObs, requestedUrl: postFx.url, titles: [want], otherTitles: rowsK }).v, 'post');

  /* ── ③ 상세 주소 규칙: 목록 파일에 번호만 붙인 주소는 만들지도, 원문이라 부르지도 않는다 ─────────── */
  const lists = ['https://www.gachon.ac.kr/kor/7986/subview.do', 'https://www.korea.ac.kr/ko/568/subview.do', 'https://www.konkuk.ac.kr/konkuk/2239/subview.do',
    'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083', 'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&pageNo=2',
    'https://kau.ac.kr/kaulife/scholnoti.php'];
  const samePath = (c, l) => { try { return new URL(c).pathname === new URL(l).pathname; } catch { return false; } };
  const guessed = lists.flatMap((l) => D.detailCandidates({ url: l, listUrl: l, rowIds: ['125712'], hiddenInputs: { nttId: '125311' }, forms: [{ action: '', fields: 'nttId=&articleNo=' }] })
    .filter((c) => samePath(c, l)).map((c) => c.slice(0, 80)));
  eq('③ 목록 경로 그대로에 번호만 붙인 후보를 만들지 않는다(가천·고려·건국 subview.do · 서울교대 selectNttList 1·2쪽 · 항공대 scholnoti.php)', guessed, []);
  eq('  대조군: 목록 파일이 view 로 바뀌는 게시판(경희 list.do)은 예전대로 조립 후보가 있다',
    D.detailCandidates({ url: 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318', listUrl: 'https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318', rowIds: ['322535'] })
      .includes('https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&nttId=322535'), true);
  const truth = [
    ['https://www.konkuk.ac.kr/bbs/konkuk/235/1202780/artclView.do', true],                       // K2Web 글 (2026-10-03 순찰이 덮어쓴 그 주소)
    ['https://dep.hufs.ac.kr/bbs/student/2431/259399/artclView.do', true],
    ['https://www.cbnu.ac.kr/www/selectBbsNttView.do?key=815&bbsNo=8&nttNo=170271&pageUnit=10&pageIndex=1', true],
    ['https://www.kyonggi.ac.kr/www/selectBbsNttView.do;jsessionid=B04808AE?key=7520&bbsNo=1073&nttNo=625019', true],
    ['https://www.kmu.ac.kr/uni/main/page.jsp?pageNo=1&pageRef=271062&cmd=2&parm_bod_uid=271062&mnu_uid=145', true],
    ['https://student.snu.ac.kr/x/?mod=document&#038;category1=%EC%9E%A5%ED%95%99&#038;uid=392', true],
    ['https://www.korea.ac.kr/ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa2RjYSUyRjUwJTJGMzEyNDY1JTJGYXJ0Y2xWaWV3LmRvJTNG', true],   // K2Web 프레임 + 글 주소 감싼 enc
    ['https://www.jbnu.ac.kr/web/Board/218081/detailView.do', true],
    ['https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&nttId=55323', false],    // 목록 + 번호
    ['https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&pageNo=2&nttId=54977', false],
    ['https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125659', false],
    ['https://www.gachon.ac.kr/kor/7986/subview.do?article.offset=10&nttId=125311', false],
    ['https://www.korea.ac.kr/ko/568/subview.do?nttId=000100000000003863', false],
    // 예전부터 맞던 것은 그대로
    ['https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=55323', true],
    ['https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322759', true],
    ['https://www.dongguk.edu/article/JANGHAKNOTICE/detail/26765595', true],
    ['https://kau.ac.kr/kaulife/scholnoti.php?searchkey=&searchvalue=&code=s1301&page=&mode=read&seq=11237', true],
    ['https://nano.pknu.ac.kr/nano/2432?action=view&no=9994682', true],
    ['https://www.dongguk.edu/page/533', false],
    ['https://www.gachon.ac.kr/bbs/kor/475/artclList.do', false],
    ['https://kau.ac.kr/kaulife/scholnoti.php#n-%EC%9E%A5%ED%95%99', false],
  ];
  eq('  isDetailUrl 실측 표 — 진짜 글 꼴은 원문, 목록 파일 + 번호는 아니다',
    truth.filter(([u, w]) => D.isDetailUrl(u) !== w).map(([u]) => u.slice(0, 90)), []);

  /* ── ④ 주소에 박힌 HTML 기호는 주소로 풀기 **전에** 되돌린다 ───────────────────────────────── */
  const wp = '<td><a href="https://student.snu.ac.kr/%ec%86%8c%ec%8b%9d/?mod=document&#038;category1=%EC%9E%A5%ED%95%99&#038;uid=392">2026학년도 2학기 관악장학생 선발 안내</a></td>'
    + '<td><a href="/kb/?mod=document&amp;#038;uid=77">두 겹으로 이스케이프된 장학 안내</a></td>';
  const got = B.extractLinks(wp, 'https://student.snu.ac.kr/');
  eq('④ extractLinks — 워드프레스 `&#038;` 링크의 글 번호(uid)가 주소에 남는다(서울대 3건이 메뉴 화면으로 열렸다)',
    got.map((l) => new URL(l.url).searchParams.get('uid')), ['392', '77']);
  eq('  되돌린 주소에 `#038;` 조각이 남지 않는다', got.some((l) => /#038|&#|&amp;/.test(l.url)), false);
  const cm = code(read('collector/collect.mjs'));
  eq('  일반 수집기의 첨부 주소도 같은 함수(hrefText)로 푼다 — `&amp;` 만 푸는 사본이 없다',
    /import \{[^}]*\bhrefText\b[^}]*\} from '\.\/board-links\.mjs'/.test(cm) && /new URL\(hrefText\(m\[1\]\), item\.url\)/.test(cm) && !/replace\(\/&amp;\/g, '&'\)/.test(cm), true);
  const ar = code(read('collector/auto-register.mjs'));
  eq('  자동 등록은 되돌린 주소를 담고(sourceUrl: nUrl) 같은 주소로 \'이미 등록\'을 가린다',
    /const nUrl = decodeUrlEntities\(n\.url\)/.test(ar) && /sourceUrl: nUrl,/.test(ar) && !/sourceUrl: n\.url/.test(ar)
      && /canonUrl\(decodeUrlEntities\(i\.sourceUrl/.test(ar), true);

  /* ── ⑤ 공공 API 의 '원문' 주소 — 기관 첫 화면은 그 공고가 아니다 ───────────────────────────── */
  eq('⑤ specific() — 첫 화면 파일(제주 index.htm · 송파 main.jsp)·뿌리는 원문이 아니고, 그 공고 주소는 원문',
    ['https://www.jeju.go.kr/index.htm', 'http://janghak.songpa.go.kr/main.jsp', 'https://www.mois.go.kr/',
      'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179246', 'https://www.youthcenter.go.kr/bbs03View/48/10811'].map(O.specific),
    [false, false, false, true, true]);

  /* ── ⑥ 실행 트리거의 고정 묶음(onlyBoard)이 아무것도 가리키지 않으면 실패 ─────────────────────
     `onlyBoard: cau.ac.kr` 가 2026-08-14 부터 남아 매주 예약 실행이 중앙대만 봤다 — 중앙대에 표식이 0건이라 '대상 4건 · 게시판 0곳'(09-29 리포트). */
  const markers = [];
  const pushM = (u) => { if (D.isMarkerUrl(u)) markers.push(u); };
  for (const r of JSON.parse(read('data/registered.json')).items || []) pushM(r.sourceUrl);
  for (const n of JSON.parse(read('data/notices.json')).items || []) pushM(n.url);
  const nd = new URL('data/notices/', root);
  for (const f of fs.readdirSync(nd).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    for (const n of JSON.parse(fs.readFileSync(new URL(f, nd), 'utf8')).items || []) pushM(n.url);
  }
  eq('⑥ 표식(#n-)을 모았다(0이면 아래가 무의미)', markers.length > 0, true);
  for (const f of ['collector/run-resolve-urls.txt', 'collector/run-link-hunt.txt']) {
    eq(`  ${f} 의 onlyBoard 가 표식 0건인 곳에 묶여 있지 않다(7주짜리 헛돌기)`, pinProblems(read(f), markers), []);
  }
  eq('  검사가 그 사고를 잡는다 — 옛 줄 `onlyBoard: cau.ac.kr`', pinProblems('onlyBoard: cau.ac.kr\nrecheckOnly: false', markers.filter((u) => !/cau\.ac\.kr/.test(u))).length, 1);
  eq('  표식이 있는 곳에 묶은 것은 통과(사람이 일부러 한 학교만 돌릴 때)', pinProblems('onlyBoard: kau.ac.kr', ['https://kau.ac.kr/kaulife/scholnoti.php#n-x']), []);
  eq('  주석 줄(# onlyBoard: …)은 묶음이 아니다', pinProblems('# onlyBoard:   게시판 하나만', []), []);
}
