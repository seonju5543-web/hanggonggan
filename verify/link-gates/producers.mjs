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
  /* 🔴 (2026-10-03 리뷰 G8) 예전엔 '템플릿 글자 안의 #n-'(`= \`…#n-…\``)만 찾았다 — `listUrl + '#n-' + …` 처럼 이어 붙이거나
     변수에 담아 넣으면 그대로 통과했다. 그래서 공고 주소 칸에 쓰는 자리를 **전부** 꺼내, 넣는 값이 '확인을 통과한 주소'
     변수인지 본다(원문 링크 복구의 ['found'] 와 같은 방식). 사냥꾼은 두 갈래다 — 목록 행을 눌러 찾은 후보(url = c) ·
     같은 학교 다른 게시판·사이트 검색(got = row.u · hit.u). 둘 다 verify(…).ok 를 받은 줄에서만 채워진다. */
  const LH_VERIFIED = ['got', 'url'];
  const lhWrites = [...lhc.matchAll(/\.ref(?:\[[^\]]+\]|\.(?:sourceUrl|url))\s*(=(?!=)|\+=|\|\|=|\?\?=|&&=)\s*([^;\n}]+)/g)]
    .map((m) => ({ op: m[1], rhs: m[2].trim() }));
  eq('  사냥꾼이 공고 주소 칸에 쓰는 자리는 전부 확인을 통과한 주소 변수(url·got)뿐 — 이어 붙인 표식(#n-)·다른 값이 못 끼어든다',
    [lhWrites.length >= 2, lhWrites.filter((w) => w.op !== '=' || !LH_VERIFIED.includes(w.rhs)).map((w) => `${w.op} ${w.rhs}`.slice(0, 80))], [true, []]);
  const lhVarSets = lhc.split('\n').flatMap((l) => [...l.matchAll(/(?:^|[^.\w$])(let |const |var )?(url|got)\s*(=(?![=>])|\+=|\|\|=|\?\?=|&&=)\s*([^;]+)/g)]
    .map((m) => ({ decl: (m[1] || '').trim(), rhs: m[4].trim(), line: l.trim() })));
  /* const 는 지금 칸 값을 읽는 것(`const url = String(t.ref[t.field] || '')` — 되써도 그대로)만 허락한다 */
  eq('  그 두 변수는 `let … = null` 로 시작해 verify(…).ok 를 받은 줄에서만 채워진다(이어 붙이기를 변수에 담아 넣는 길도 막는다)',
    [lhVarSets.filter((s) => !s.decl).length >= 3,
      lhVarSets.filter((s) => (s.decl === 'let' ? s.rhs !== 'null'
        : s.decl === 'const' ? !/^String\(t\.ref\[t\.field\] \|\| ''\)$/.test(s.rhs)
          : !/\bif \(v\.ok\) \{/.test(s.line))).map((s) => s.line.slice(0, 80))], [true, []]);
  eq('  공고 글을 통째로 덮는 길(Object.assign(t.ref, …))도 없다', /Object\.assign\(\s*[\w.]*\bref\b/.test(lhc), false);
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
  /* ⚠️ 뿌리 주소(`https://x.kr/`)는 여기 표본으로 쓰지 않는다 — 같은 날 core 갈래에서 '뿌리 = 첫 화면'을 꼴만으로 단정하지 않게
     바뀌는 중이다(학교 게시판이 그렇게 내보내는 멀쩡한 글이 있다). 뿌리의 뜻은 core 갈래가 잰다. */
  eq('⑤ specific() — 첫 화면 파일(제주 index.htm · 송파 main.jsp · 행안부 main.do)은 원문이 아니고, 그 공고 주소는 원문',
    ['https://www.jeju.go.kr/index.htm', 'http://janghak.songpa.go.kr/main.jsp', 'https://www.mois.go.kr/main.do',
      'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179246', 'https://www.youthcenter.go.kr/bbs03View/48/10811'].map(O.specific),
    [false, false, false, true, true]);

  /* ── ⑥ 실행 트리거의 고정 묶음(onlyBoard)이 아무것도 가리키지 않으면 실패 ─────────────────────
     `onlyBoard: cau.ac.kr` 가 2026-08-14 부터 남아 매주 예약 실행이 중앙대만 봤다 — 중앙대에 표식이 0건이라 '대상 4건 · 게시판 0곳'(09-29 리포트).
     🔴 (2026-10-03 리뷰 G2·G5) 이 절은 두 겹이다.
       · 규칙(pinProblems) — **가짜 자료로만** 잰다. 언제 어디서나 실패할 수 있다.
       · 지금 트리거 파일 ↔ 지금 데이터의 표식 — 실데이터에 기댄다. 표식은 사냥꾼이 원문을 찾을 때마다 줄고(그게 목표다),
         묶인 학교의 마지막 표식이 풀리거나 0건이 되는 날 이 관문이 빨간불이면 그 실행(수집 로봇도 이 관문을 돈다)의 결과가
         통째로 되돌려진다(CLAUDE.md 「합칠 때 마감은…」 2026-10-01 사고). 사람이 고칠 일(묶음 줄 지우기)이라
         **로컬·코드 검사(DOC_GATES — test-collector 의 문서 관문과 같은 잣대)에서만 실패**하고, 로봇 워크플로에서는 경고 한 줄만 남긴다.
         표식이 0건이면 대조할 것이 없다 — 목표에 닿은 상태라 실패가 아니라 건너뛴다고 한 줄 적는다. */
  const SYN = ['https://kau.ac.kr/kaulife/scholnoti.php#n-x', 'https://www.gachon.ac.kr/bbs/kor/475/artclList.do#n-y'];
  eq('⑥ 검사가 그 사고를 잡는다 — 옛 줄 `onlyBoard: cau.ac.kr` (표식은 다른 학교에만)', pinProblems('onlyBoard: cau.ac.kr\nrecheckOnly: false', SYN).length, 1);
  eq('  표식이 있는 곳에 묶은 것은 통과(사람이 일부러 한 학교만 돌릴 때)', pinProblems('onlyBoard: kau.ac.kr', SYN), []);
  eq('  주석 줄(# onlyBoard: …)은 묶음이 아니다', pinProblems('# onlyBoard:   게시판 하나만', []), []);
  eq('  표식이 하나도 없으면 어떤 묶음이든 헛돌기다', pinProblems('onlyBoard: kau.ac.kr', []).length, 1);

  const markers = [];
  const pushM = (u) => { if (D.isMarkerUrl(u)) markers.push(u); };
  const itemsOf = (u) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')).items || []; } catch { return []; } };
  for (const r of itemsOf(new URL('data/registered.json', root))) pushM(r.sourceUrl);
  for (const n of itemsOf(new URL('data/notices.json', root))) pushM(n.url);
  const nd = new URL('data/notices/', root);
  for (const f of fs.readdirSync(nd).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    for (const n of itemsOf(new URL(f, nd))) pushM(n.url);
  }
  const DOC_GATES = ctx.docGates ?? (!process.env.GITHUB_ACTIONS || process.env.DOC_GATES === '1');
  if (!markers.length) {
    console.log('  (지금 데이터에 목록 표식(#n-)이 0건 — 트리거 파일 대조를 건너뜀 · 사냥할 표식이 없는 목표 상태라 실패가 아니다)');
  } else {
    for (const f of ['collector/run-resolve-urls.txt', 'collector/run-link-hunt.txt']) {
      const probs = pinProblems(read(f), markers);
      const name = `  ${f} 의 onlyBoard 가 표식 0건인 곳에 묶여 있지 않다(7주짜리 헛돌기 · 지금 표식 ${markers.length}건과 대조)`;
      if (DOC_GATES || !probs.length) eq(name, probs, []);
      else console.log(`  ⚠ ${f} — ${probs.join(' · ')} · 그 줄을 지울 것 (로봇 워크플로라 경고만 — 로컬·verify-ui.yml 에서는 실패)`);
    }
  }

  /* 2026-10-03 실측(원문 링크 복구 로봇 첫 실행) — 사이트 메뉴 링크가 공고의 행으로 뽑혀 `…/detail/533` 이 실렸다 */
  {
    const DU = await import('../../collector/detail-url.mjs');
    const want = '(은평)삼천사 지역미래불자육성장학 장학생 선발 안내';
    eq('행 대조 — 메뉴 조각(`지역미래불자육성장학`)은 그 공고의 행이 아니다 · 제목+날짜 행 · 잘린 행은 맞다 · sameTitle 만으로는 메뉴를 행으로 뽑던 것(무력화 증거)',
      [DU.rowMatchesTitle(want, '지역미래불자육성장학'), DU.rowMatchesTitle(want, `${want} 2026.09.02 조회 2614`), DU.rowMatchesTitle(want, '(은평)삼천사 지역미래불자육성장학 장학생 선발'), DU.sameTitle(want, '지역미래불자육성장학')],
      [false, true, true, true]);
    eq('  알맹이 낱말 그것뿐인 행(메뉴)은 rowByCore 도 고르지 않는다', DU.rowByCore('지역미래불자육성장학 장학생 선발', [{ t: '지역미래불자육성장학' }]), null);
    const rz = fs.readFileSync(new URL('collector/resolve-detail-urls.mjs', ctx.root), 'utf8');
    const lh = fs.readFileSync(new URL('collector/link-hunter.mjs', ctx.root), 'utf8');
    eq('  두 복구 로봇이 행을 rowMatchesTitle 로 찾는다(sameTitle 로 행을 찾는 자리가 남지 않는다)',
      [/rows\.find\(\(r\) => rowMatchesTitle\(want, r\.t\)\)/.test(rz), /rows\.findIndex\(\(r\) => rowMatchesTitle\(want, r\.t\)\)/.test(lh), /rows\.(find|findIndex)\(\(r\) => sameTitle\(want, r\.t\)/.test(rz + lh)],
      [true, true, false]);
  }
  /* ⑨ 학교별 파일 고치기(patchUrlsBySchool)는 순위를 낮추지 않는다 (2026-10-03 배포 직후 실측 — 사냥꾼이 이 함수로
     복구 로봇이 학교별 파일에만 찾아 둔 항공대 진짜 주소 2건을 notices.json 의 옛 목록 표식으로 덮었다) */
  {
    const os = await import('node:os');
    const path = await import('node:path');
    const { patchUrlsBySchool } = await import('../../collector/publish-notices.mjs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-rank-'));
    const REAL = 'https://kau.ac.kr/kaulife/scholnoti.php?code=s1301&page=3&mode=read&seq=10681';
    const MARK = 'https://kau.ac.kr/kaulife/scholnoti.php#n-%EC%B2%AD%EB%85%84';
    const REAL2 = 'https://kau.ac.kr/kaulife/scholnoti.php?code=s1301&mode=read&seq=10900';
    fs.writeFileSync(path.join(dir, 'k.json'), JSON.stringify({ school: '한국항공대학교', items: [
      { school: '한국항공대학교', title: '2026년 2학기 청년창업농장학금 신청 안내', url: REAL },
      { school: '한국항공대학교', title: '2026학년도 산학협동재단 장학생 선발 안내', url: MARK },
    ] }, null, 1));
    const r = patchUrlsBySchool([
      { school: '한국항공대학교', title: '2026년 2학기 청년창업농장학금 신청 안내', url: MARK },
      { school: '한국항공대학교', title: '2026학년도 산학협동재단 장학생 선발 안내', url: REAL2 },
    ], { dir: new URL(`file://${dir}/`) });
    const got = JSON.parse(fs.readFileSync(path.join(dir, 'k.json'), 'utf8')).items.map((n) => n.url);
    fs.rmSync(dir, { recursive: true, force: true });
    eq('⑨ 학교별 파일 고치기는 진짜 주소를 목록 표식으로 덮지 않고(항공대 실측 꼴) · 표식은 진짜 주소로 고친다', [r.fixed, got], [1, [REAL, REAL2]]);
  }
}
