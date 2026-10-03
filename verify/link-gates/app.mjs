/* 「원문 링크 정직성」 — app 갈래: 학생 화면의 **모든** 링크 자리가 source-link.js 한 곳에서 이름을 받는가 (2026-10-03)

   왜 있나 (2026-10-03 개발자 보고 · P0 *"원문 공고를 누르면 그 공고가 아니라 재단·장학금 페이지 전체가 열린다"*):
     화면 일곱 곳이 각자 주소 글자(`#n-`)만 보고 '원문'이라 불렀다. 층2(재단 홈페이지)를 아는 곳은 상세 시트 하나뿐이라
     같은 재단 홈페이지를 금액 상세는 '원문 공고 ↗', 신청 내역은 '공고 원문 보기 ↗', 제출처는 '원문 공고의 접수 방법'이라 했다.
     규칙(source-link.js)만 고치면 안 된다 — **자리 하나가 제 판정을 다시 들면** 같은 사고가 그 자리에서만 되살아난다.

   세 겹으로 잰다:
     (a) 글자 — app.js·chat.js·data.js 의 **코드**(주석 뺀 것)에 링크 이름 글자가 없다(이름은 source-link.js 에만 산다)
     (b) 배선 — index.html 이 source-link.js 를 먼저 싣고 · 서비스워커가 담고 · 앱이 장부(data/link-check.json)를 받아 넘긴다
     (c) 실데이터 — app.js 의 **진짜 함수**를 이름으로 떼어 실어(what-shows.mjs 와 같은 방식 · 베끼지 않는다)
         실제 데이터 전부를 그려 본다: 층2 재단 홈페이지 · 기관 첫 화면 주소에 '원문'이 안 붙고, 모든 href 에 HTML 기호가 없다.
   🔴 (c)는 **개수를 박지 않는다**(CLAUDE.md — 실데이터에 기댄 고정 검사를 관문에 두지 말 것). 성질만 본다.
      대신 빈 데이터로 헛돌지 않게 실측 꼴의 표본을 하나씩 덧붙여 함께 그린다(관문 3번 규칙 — 조용하면 무력해진 것부터 의심). */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/* ── 주석 걷기 — 문자열·템플릿·정규식 안의 `/*`·`//` 는 건드리지 않는다 ─────────────────────
   정규식 한 줄(`/\/\*[\s\S]*?\*\//g`)로 걷으면 정규식 글자 안의 `/*` 에서 시작해 수천 줄을 삼켜
   **그 사이의 이름 글자를 못 보고 통과**할 수 있다. 그래서 작은 글자 읽개로 걷고, 아래에서 걷은 결과가 멀쩡한지도 잰다. */
export function stripComments(src) {
  let i = 0;
  const n = src.length;
  const out = [];
  const push = (s) => { out.push(s); };
  /* 정규식이 올 수 있는 자리인가 — 바로 앞의 의미 있는 글자로 가른다 */
  let lastSig = '';
  let lastWord = '';
  const note = (s) => {
    for (let k = s.length - 1; k >= 0; k -= 1) {
      if (!/\s/.test(s[k])) { lastSig = s[k]; break; }
    }
    const m = s.match(/([A-Za-z_$][\w$]*)\s*$/);
    lastWord = m ? m[1] : (/\S/.test(s) ? '' : lastWord);
  };
  const emit = (s) => { push(s); note(s); };
  const regexOK = () => !lastSig || '(,=:[!&|?{};+-*%<>~^'.includes(lastSig)
    || /^(return|typeof|case|in|of|new|delete|void|throw|instanceof|yield|await)$/.test(lastWord);
  function str(q) {
    let s = q; i += 1;
    while (i < n) {
      const c = src[i]; s += c; i += 1;
      if (c === '\\') { s += src[i] || ''; i += 1; continue; }
      if (c === q || c === '\n') break;
    }
    emit(s);
  }
  function regex() {
    let s = '/'; i += 1; let cls = false;
    while (i < n) {
      const c = src[i]; s += c; i += 1;
      if (c === '\\') { s += src[i] || ''; i += 1; continue; }
      if (c === '[') cls = true;
      else if (c === ']') cls = false;
      else if ((c === '/' && !cls) || c === '\n') break;
    }
    while (i < n && /[a-z]/i.test(src[i])) { s += src[i]; i += 1; }
    emit(s);
  }
  function tpl() {
    let s = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { s += c + (src[i + 1] || ''); i += 2; continue; }
      if (c === '`') { s += c; i += 1; emit(s); return; }
      if (c === '$' && src[i + 1] === '{') { s += '${'; i += 2; emit(s); s = ''; code(true); emit('}'); i += 1; continue; }
      s += c; i += 1;
    }
    emit(s);
  }
  function code(inTpl) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; push(' '); continue; }
      if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
      if (c === '"' || c === "'") { str(c); continue; }
      if (c === '`') { emit('`'); i += 1; tpl(); continue; }
      if (c === '/' && regexOK()) { regex(); continue; }
      /* 낱말은 통째로 — `return /re/` 의 return 을 알아봐야 뒤의 / 를 정규식으로 읽는다 */
      if (/[A-Za-z_$]/.test(c)) { let w = ''; while (i < n && /[\w$]/.test(src[i])) { w += src[i]; i += 1; } emit(w); continue; }
      if (c === '{') depth += 1;
      if (c === '}') { if (inTpl && depth === 0) return; depth -= 1; }
      emit(c); i += 1;
    }
  }
  code(false);
  return out.join('');
}

/* ── app.js 함수를 **이름으로** 떼어 온다 (what-shows.mjs 와 같은 규칙 — 최상위 함수는 열 0 의 `function 이름(` ~ 열 0 의 `}`) */
function taker(src, file) {
  return {
    fn(name) {
      const m = src.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
      if (!m) throw new Error(`${file} 에서 ${name}() 을 못 찾았습니다 — 이름이 바뀌었으면 이 관문도 같이 옮기세요(못 가져오면 멈춘다).`);
      return m[0];
    },
    one(name) {
      const m = src.match(new RegExp(`^const ${name} = .*$`, 'm'));
      if (!m) throw new Error(`${file} 에서 ${name} 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.`);
      return m[0];
    },
  };
}

const ENT_RE = /&(?:amp|#0*38|#x0*26);/i;
/* HTML 속성 값 → 브라우저가 실제로 여는 주소 (esc 가 감싼 `&amp;` 를 한 번 푼다) */
const attrUrl = (v) => String(v).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const hrefsOf = (html) => [...String(html).matchAll(/\shref="([^"]*)"/g)].map((m) => attrUrl(m[1]));
const textOf = (html) => String(html).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export default async function gate(eq, ctx) {
  const root = (ctx && ctx.root) || new URL('../../', import.meta.url);
  const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
  const L = require('../../source-link.js');
  const appSrc = read('app.js');
  const chatSrc = read('chat.js');
  const dataSrc = read('data.js');

  /* ── (a) 링크 이름 글자는 source-link.js 에만 ─────────────────────────────────────── */
  const code = { 'app.js': stripComments(appSrc), 'chat.js': stripComments(chatSrc), 'data.js': stripComments(dataSrc) };
  /* 걷기가 멀쩡한가 — 함수가 남아 있고(코드를 삼키지 않았다) 주석 글자는 사라졌다(주석을 남기지 않았다) */
  eq('(a) 주석 걷기가 코드를 삼키지 않는다 (함수 이름이 남는다 · 걷은 글자가 원본의 30% 이상)',
    ['function safeUrl(', 'function sourceLinkHtml(', 'function appLogLinkHtml(', 'function noticeCardHtml(', 'function activityLinkHtml(', 'function amountSourceLinkHtml(', 'function loadLinkChecks(']
      .filter((f) => !code['app.js'].includes(f)).concat(code['app.js'].length > appSrc.length * 0.3 ? [] : ['길이']), []);
  eq('  주석 글자는 걷힌다 (이 파일 머리말 문장이 코드 쪽에 안 남는다)', code['app.js'].includes('여기에 isBoardListLink 같은 판정을 다시 두지 말 것'), false);
  eq('  문자열 안의 `//`·`/*` 는 건드리지 않는다', stripComments("const u = 'https://a.kr/*x*/'; // 꼬리\nconst r = /\\/\\*/; /* 주석 */ const t = `a${/* 안 */ ''}b`;"),
    "const u = 'https://a.kr/*x*/'; \nconst r = /\\/\\*/;   const t = `a${  ''}b`;");
  /* 금지 글자 = source-link.js 의 화면 이름 전부(목록을 베껴 적지 않는다 — 이름이 바뀌면 같이 따라온다) + 작업 지시서의 여섯 */
  const labels = new Set(['원문 공고 ↗', '공고 원문 보기 ↗', '원문 보기 ↗', '원문에서 신청하기 ↗', '게시판 목록 ↗', '재단 홈페이지 ↗']);
  for (const s of Object.values(L.SURFACE_LABELS)) for (const v of Object.values(s)) if (v.length >= 5) labels.add(v);
  const found = [];
  for (const [f, c] of Object.entries(code)) for (const lb of labels) if (c.includes(lb)) found.push(`${f}: ${lb}`);
  eq('(a) app.js·chat.js·data.js 코드에 링크 이름 글자가 없다 — 이름은 source-link.js 한 곳에만 (자리마다 다시 정하면 그 자리만 거짓말한다)', found, []);
  eq('  `#n-` 로 목록을 가리는 두 번째 판정이 없다 (isBoardListLink 가 되살아나지 않는다)',
    Object.entries(code).filter(([, c]) => /#n-|isBoardListLink|boardListTitle/.test(c)).map(([f]) => f), []);
  /* 자리마다 맞는 화면 이름을 부른다 — 이름을 바꿔 부르면 승인된 글자가 다른 자리로 샌다 */
  const T = taker(appSrc, 'app.js');
  const calls = {
    sourceLinkHtml: /sourceLink\(sch, 'detail'\)/, amountSourceLinkHtml: /sourceLink\(sch, 'amount'\)/, appLogLinkHtml: /sourceLink\(sch, 'applog'\)/,
    noticeCardHtml: /sourceLink\(n, 'card'\)/, activityLinkHtml: /sourceLink\(n, 'activity'\)/,
  };
  eq('  링크 자리 다섯이 각자 제 화면 이름으로 sourceLink 를 부른다 (상세·금액·신청 내역·카드·활동)',
    Object.entries(calls).filter(([f, re]) => !re.test(stripComments(T.fn(f)))).map(([f]) => f), []);
  eq('  도우미(chat.js)·제출처(data.js officialChannel)도 같은 곳에서 받는다',
    [/sourceLink\(n, 'chat'\)/.test(code['chat.js']), /sourceLink\(sch, 'detail'\)\.cls/.test(stripComments(taker(dataSrc, 'data.js').fn('officialChannel')))], [true, true]);
  eq('  상세 시트·활동 시트·금액·신청 내역·첨부가 그 함수들을 실제로 쓴다',
    [/\$\{srcLink\}|srcLink,/.test(stripComments(T.fn('openDetail'))), /activityLinkHtml\(n\)/.test(stripComments(T.fn('openActivityDetail'))),
      /amountSourceLinkHtml\(sch\)/.test(stripComments(T.fn('amountDetailRow'))), /appLogLinkHtml\(sch\)/.test(code['app.js']),
      (code['app.js'].match(/attachmentLinkHtml\(a/g) || []).length >= 3], [true, true, true, true, true]);
  eq('  첨부를 `<a href="${esc(safeUrl(a.url))}"` 로 직접 그리는 자리가 남지 않았다 (빈 href 는 앱 자신을 연다)',
    /href="\$\{esc\(safeUrl\(a\.url\)\)\}"/.test(code['app.js']), false);

  /* ── (b) 배선 ───────────────────────────────────────────────────────────── */
  const html = read('index.html');
  const order = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  const at = (f) => order.indexOf(f);
  eq('(b) index.html 이 source-link.js 를 data.js·app.js·chat.js 보다 먼저 싣는다',
    [at('source-link.js') >= 0, at('source-link.js') < at('data.js'), at('source-link.js') < at('app.js'), at('source-link.js') < at('chat.js')], [true, true, true, true]);
  const sw = read('sw.js');
  const assets = stripComments((sw.match(/const ASSETS = \[([\s\S]*?)\];/) || [])[1] || '');
  eq('  서비스워커 ASSETS 에 source-link.js 가 있다 (없으면 오프라인에서 카드·시트가 넘어진다)', /'source-link\.js'/.test(assets), true);
  eq('  ASSETS 에 장부(data/link-check.json)는 없다 (없을 수 있는 파일 — addAll 이 통째로 실패한다)', /link-check/.test(assets), false);
  const ll = stripComments(T.fn('loadLinkChecks'));
  eq('  앱이 장부를 받아(no-store) setLinkChecks 로 넘긴다', /fetch\('data\/link-check\.json', \{ cache: 'no-store' \}\)/.test(ll) && /setLinkChecks\(/.test(ll), true);
  eq('  시작할 때·당겨서 새로고침할 때 둘 다 받는다', [/^loadLinkChecks\(\);/m.test(code['app.js']), /loadLinkChecks\(\)/.test(stripComments(T.fn('refreshAllData')))], [true, true]);
  eq('  정식 등록 그리기가 장부를 (잠깐) 기다린다 — 첫 그림부터 맞는 이름', /linkChecksWait\(\)/.test(stripComments(T.fn('loadRegistered'))), true);
  eq('  safeUrl 이 HTML 기호를 먼저 되돌린다 (원문·첨부·제출처가 한 자리에서 고쳐진다)', /u = decodeUrlEntities\(u\)/.test(stripComments(T.fn('safeUrl'))), true);

  /* ── (c) 실데이터 — 진짜 함수로 그려 본다 ─────────────────────────────────────────── */
  const box = vm.createContext({
    console, URL, Math, Date, JSON, Object, Array, String, Number, RegExp, Promise, encodeURIComponent, decodeURIComponent,
    document: { baseURI: 'https://seonju5543-web.github.io/hanggonggan/' },
    module: undefined,
  });
  const PA = require('../../parse-amount.js');
  Object.assign(box, { amountFrom: PA.amountFrom, exclusivityFrom: PA.exclusivityFrom });
  vm.runInContext(read('source-link.js'), box, { filename: 'source-link.js' });
  vm.runInContext(dataSrc, box, { filename: 'data.js' });
  /* app.js 발췌 — 링크를 그리는 자리 + 층2를 학생 화면 모양으로 바꾸는 함수(kosafAsScholarships) 그대로 */
  vm.runInContext([
    T.one('ENTITIES'), T.one('ENTITY_RE'), T.one('NEWS_THUMB_RE'), T.one('CLOSED_KEEP_DAYS'),
    T.one('KOSAF_ELIG'), T.one('kosafClean'), T.one('KOSAF_AMOUNT_UNKNOWN'),
    ...['esc', 'unent', 'safeUrl', 'won', 'todayStart', 'dday', 'kosafAmountLabel', 'kosafAsScholarships',
      'sourceLinkHintHtml', 'attachmentLinkHtml', 'sourceLinkHtml', 'sourceNoteHtml', 'amountSourceLinkHtml',
      'appLogLinkHtml', 'noticeCardHtml', 'activityLinkHtml'].map(T.fn),
    /* kosafAsScholarships 가 읽는 앱 상태 — 저장·신청 내역은 없다(마감 지난 것도 전부 그린다 · 아래 dday 덮어쓰기) */
    'var kosafList = []; var kosafUpdatedAt = ""; var state = { applications: [] }; function isSaved() { return false; }',
  ].join('\n\n'), box, { filename: 'app.js(발췌)' });
  const run = (s) => vm.runInContext(s, box);
  const F = (name) => run(name);

  /* 층2 — 실제 kosaf-open.json 전부 + 실측 꼴 표본(재단 홈페이지 뿌리 주소 · 2026-10-03 namgu.gwangju.kr) */
  const kosafDoc = JSON.parse(read('data/kosaf-open.json'));
  const kosafItems = (kosafDoc.items || []).concat([{ code: 'gate-sample', org: '관문표본장학회', name: '표본 장학금', due: '', home: 'https://namgu.gwangju.kr', fields: { 지원금액: '1인당 100만원' }, files: [] }]);
  box.kosafList = kosafItems;
  run('dday = function () { return { days: 0, label: "D-0", cls: "" }; };');   // 마감 지난 것까지 전부 — '열린 것'의 상위 집합
  const kosaf = F('kosafAsScholarships')();
  eq('(c) 층2를 앱 함수 그대로 바꿨다 — 모든 재단이 sourceKind kosaf 로 온다 (헛돌지 않는다)',
    [kosaf.length === kosafItems.length, kosaf.every((s) => s.sourceKind === 'kosaf')], [true, true]);
  const kosafSay = (s) => ({
    detail: textOf(F('sourceLinkHtml')(s)), note: textOf(F('sourceNoteHtml')(s)), amount: textOf(F('amountSourceLinkHtml')(s)),
    applog: textOf(F('appLogLinkHtml')(s)), channel: F('officialChannel')(s).label,
  });
  const kosafBad = kosaf.map((s) => [s.id, kosafSay(s)]).filter(([, t]) => Object.values(t).some((v) => /원문/.test(v)));
  eq('(c) 🔴 층2 재단 홈페이지를 상세·안내·금액·신청 내역·제출처 어디서도 「원문」이라 부르지 않는다 (실데이터 전부)',
    kosafBad.slice(0, 3).map(([id, t]) => `${id} ${JSON.stringify(t)}`), []);
  eq('  제출처 이름도 「공고의 접수 방법」이라 하지 않는다 (누르면 재단 공고가 아니라 홈페이지가 열린다)',
    kosaf.filter((s) => /공고의 접수 방법/.test(F('officialChannel')(s).label)).map((s) => s.id).slice(0, 3), []);
  const sample = kosafSay(kosaf[kosaf.length - 1]);
  eq('  표본(재단 홈페이지 뿌리 주소)은 어디서나 「재단 홈페이지」다',
    [sample.detail, sample.amount, sample.applog, sample.channel], ['재단 홈페이지 ↗', '재단 홈페이지 ↗', '재단 홈페이지 열기 ↗', '관문표본장학회 (재단 홈페이지)']);

  /* 층1·피드·활동·소식 — 앱이 실제로 받는 파일들(소식·공고는 학교별 파일) */
  const items = (p) => { try { return JSON.parse(read(p)).items || []; } catch (e) { return []; } };
  const dirItems = (dir) => fs.readdirSync(new URL(dir, root)).filter((f) => /\.json$/.test(f) && f !== 'index.json').flatMap((f) => items(`${dir}${f}`));
  /* 표본: 서울대 학생처 `&#038;` 주소(실측) · 기관 첫 화면(청년정책 API 실측 jeju index.htm) · 내려받기 스크립트 첨부(실측 50건 꼴) */
  const SNU = 'https://student.snu.ac.kr/%ec%86%8c%ec%8b%9d/?mod=document&#038;category1=%EC%9E%A5%ED%95%99&#038;uid=392';
  const regs = items('data/registered.json').concat([
    { id: 'gate-snu', name: '표본 서울대', provider: '서울대학교', sourceUrl: SNU, attachments: [{ name: '신청서.hwp', url: "javascript:downloadfile('/x')" }] },
    { id: 'gate-home', name: '표본 기관 첫 화면', provider: '제주특별자치도', sourceUrl: 'https://www.jeju.go.kr/index.htm' },
  ]);
  const feeds = {
    notices: dirItems('data/notices/'), external: items('data/external.json'), news: dirItems('data/news/'),
  };
  feeds.notices.push({ title: '표본 서울대', url: SNU, school: '서울대학교', foundAt: '2026-10-03' });
  feeds.external.push({ title: '표본 재단 공지', url: 'https://www.example-foundation.or.kr/', host: '표본재단', foundAt: '2026-10-03' });
  const acts = items('data/activities.json').concat([{ title: '청년 체인지메이커 아카데미 운영', url: 'https://www.jeju.go.kr/index.htm', kind: '대외활동' }]);

  const shown = [];   // [어디, id, 이름 글자, html, 데이터 글]
  for (const s of regs) {
    shown.push(['상세', s.id, textOf(F('sourceLinkHtml')(s)), F('sourceLinkHtml')(s) + F('sourceNoteHtml')(s), s]);
    shown.push(['금액', s.id, textOf(F('amountSourceLinkHtml')(s)), F('amountSourceLinkHtml')(s), s]);
    shown.push(['신청 내역', s.id, textOf(F('appLogLinkHtml')(s)), F('appLogLinkHtml')(s), s]);
    shown.push(['제출처', s.id, F('officialChannel')(s).label, '', s]);
    shown.push(['첨부', s.id, '', (s.attachments || []).map((a) => F('attachmentLinkHtml')(a)).join(''), null]);
  }
  for (const [k, list] of Object.entries(feeds)) {
    for (const n of list) {
      const h = F('noticeCardHtml')(n, {});
      const meta = (h.match(/<p class="sch-provider">([^<]*수집[^<]*)<\/p>/) || [])[1] || '';
      shown.push([`카드(${k})`, n.url, meta, h, n]);
    }
  }
  for (const n of acts) {
    const h = F('activityLinkHtml')(n);
    shown.push(['활동', n.url, textOf(h), h + (n.attachments || []).map((a) => F('attachmentLinkHtml')(a)).join(''), n]);
  }
  /* 그 공고로 가지 않는 주소(게시판 목록·기관 첫 화면)는 어느 자리에서도 '원문'이 아니다.
     ⚠️ 종류는 source-link.js 로 잰다(장부 없이 — 꼴만). 'page'·'trouble' 만 원문이라 부를 수 있다. */
  const NOT_POST = ['list', 'home', 'foundation-home', 'program'];
  const homeBad = shown.filter(([, , say, , it]) => it && NOT_POST.includes(L.linkKind(it)) && /원문/.test(say));
  eq('  그 갈래가 실제로 그려졌다 (헛돌지 않는다 — 목록·첫 화면을 카드·상세·활동에서 각각)',
    [['카드', 'list'], ['카드', 'home'], ['상세', 'list'], ['상세', 'home'], ['활동', 'home']]
      .map(([w, kd]) => shown.some(([x, , , , it]) => x.startsWith(w) && it && L.linkKind(it) === kd)), [true, true, true, true, true]);
  eq('(c) 🔴 게시판 목록·기관 첫 화면 주소는 상세·금액·신청 내역·제출처·카드·활동 어디서도 「원문」이 아니다 (실데이터 + 표본)',
    homeBad.slice(0, 3).map(([w, id, say]) => `${w} ${String(id).slice(0, 60)} 「${say}」`), []);
  eq('  표본 jeju index.htm — 활동 단추는 「주최 측 홈페이지」 · 「신청은 주최 측 원문 페이지에서」 안내가 없다',
    (() => { const h = F('activityLinkHtml')(acts[acts.length - 1]); return [textOf((h.match(/<a [^>]*>[^<]*<\/a>/) || [''])[0]), /원문 페이지/.test(h)]; })(),
    ['주최 측 홈페이지 ↗', false]);
  /* 모든 href 에 HTML 기호가 없다 · 빈 href 가 없다 */
  const allHrefs = shown.flatMap(([w, id, , h]) => hrefsOf(h).map((u) => [w, id, u]));
  eq('(c) 🔴 그려진 href 전부에 HTML 기호(`&#038;`·`&amp;`)가 없다 — 있으면 글 번호가 조각이 돼 메뉴 화면이 열린다',
    allHrefs.filter(([, , u]) => ENT_RE.test(u)).slice(0, 3).map(([w, id, u]) => `${w} ${String(id).slice(0, 40)} ${u.slice(0, 80)}`), []);
  eq('  빈 href(`href=""` — 앱 자신을 연다)가 하나도 없다', allHrefs.filter(([, , u]) => !u).slice(0, 3).map(([w, id]) => `${w} ${id}`), []);
  eq('  표본 서울대 — 상세 링크가 글 번호(uid=392)를 그대로 서버에 보낸다',
    new URL(hrefsOf(F('sourceLinkHtml')(regs.find((r) => r.id === 'gate-snu')))[0]).searchParams.get('uid'), '392');
  eq('  표본 내려받기 스크립트 첨부 — 링크 없이 이름 + 「원문 게시판에서 내려받기」',
    F('attachmentLinkHtml')({ name: '신청서.hwp', url: "javascript:downloadfile('/x')" }), '신청서.hwp <span class="doc-legend">(원문 게시판에서 내려받기)</span>');
  eq('(c) 그린 자리가 비지 않았다 (헛돌지 않는다 — 다섯 갈래 모두 그렸다)',
    ['상세', '금액', '신청 내역', '카드(notices)', '활동'].map((w) => shown.some(([x]) => x === w)), [true, true, true, true, true]);

  /* 목록·문제 주소 — 안내 줄이 따라온다(상세 시트 맨 아래 · 신청 준비 시트) */
  const listRegs = regs.filter((s) => L.linkKind(s) === 'list');
  eq('(c) 목록 주소 정식 등록은 신청 준비 시트에도 「목록에서 ○○을(를) 찾아 눌러 주세요」가 붙는다 (표식 주소 전부)',
    listRegs.filter((s) => !/목록에서 .+을\(를\) 찾아 눌러 주세요/.test(textOf(F('sourceNoteHtml')(s)))).map((s) => s.id).slice(0, 3), []);
  const real = regs.find((s) => L.linkKind(s) === 'page' && !/^gate-/.test(s.id)) || regs[regs.length - 2];
  F('setLinkChecks')({ updatedAt: 't', bad: { [L.decodeUrlEntities(real.sourceUrl)]: { v: 'list', at: '2026-10-04' }, [L.decodeUrlEntities(SNU)]: { v: 'gone', at: '2026-10-04' } } });
  const listNow = [textOf(F('sourceLinkHtml')(real)), /목록에서 .+을\(를\) 찾아 눌러 주세요/.test(textOf(F('sourceNoteHtml')(real))), F('officialChannel')(real).label.includes('게시판 목록')];
  const snuReg = regs.find((r) => r.id === 'gate-snu');
  const goneNow = [textOf(F('sourceLinkHtml')(snuReg)), textOf(F('sourceNoteHtml')(snuReg)).includes('이 주소가 열리지 않았어요 (2026-10-04 확인)'), textOf(F('appLogLinkHtml')(snuReg))];
  F('setLinkChecks')(null);
  eq('(c) 장부가 「목록」을 확정한 실제 등록 주소 — 이름·찾기 안내·제출처 이름이 함께 바뀐다(표식이 없어도)',
    listNow, ['게시판 목록 ↗', true, true]);
  eq('  장부가 「열리지 않음」을 확정한 주소 — (확인 필요) + 로봇이 본 것 한 줄', goneNow, ['원문 공고(확인 필요) ↗', true, '공고 원문 보기(확인 필요) ↗']);
  eq('  장부를 비우면 예전 글자 그대로 (승인된 화면 — 보통 주소는 「원문 공고 ↗」)', textOf(F('sourceLinkHtml')(real)), '원문 공고 ↗');
}
