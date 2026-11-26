/* 이 공고가 이 학생 화면에 **실제로 어떻게 보이는가** (2026-08-29 신설)

   🔴 왜 만들었나 — 2026-08-29에 이런 실수를 했다:
      `requirementLines(it, lines)` 를 그냥 불러 5줄이 나온 것을 보고
      **"자격 줄 18건이 화면에 안 뜬다"**고 개발자에게 보고했다. 틀렸다.
      그건 **목록 카드용 5줄 미리보기**였고, 상세 시트는 `{all:true}` 로 전부 보여 주고
      있었다. 코드는 멀쩡했고 검사도 조용했다 — **틀린 것은 내가 잰 방법**이었다.

      이 저장소가 이미 배운 교훈과 같다: **사본을 재면 원본과 갈라진다.**
      그래서 화면에 대한 주장은 그 자리에서 짠 스크립트가 아니라 **이 도구로** 재고 말한다.

   어떻게 보장하나: `app.js`·`match-engine.js` 를 **파일 그대로** vm 에 실어
   앱이 쓰는 바로 그 함수(`fitVerdict`·`requirementLines`)를 부른다. 베낀 규칙이 없다.

   실행:
     node verify/what-shows.mjs 총동문회                 (이름 일부로 찾기)
     node verify/what-shows.mjs reg-hufs-samil --gpa=4.2 --credits=18 --bracket=2
     node verify/what-shows.mjs 면학 --school=한국외국어대학교 --track=humanities
     node verify/what-shows.mjs 면학 --traits=kosafApplied:1      (묻기 상자에 답한 처지 · 1=예 0=아니요 · 안 주면 안 답한 상태)
*/
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ME = require('../match-engine.js');
/* WHAT_SHOWS_REGISTERED — 관문 표본용(2026-10-04): 실데이터 대신 표본 정식 등록 파일로 돈다(test-collector 가 이 도구를 실제로 돌려 잴 때).
   평소에는 쓰지 않는다 — 화면 이야기는 진짜 데이터로 한다. */
/* 앱처럼 받은 데이터를 **받는 순간** 씻는다(깨진 글자 · app.js tidyData — 2026-11-17). 카드 읽기를 얹고 찾기 전에 — 앱도 두 파일을 씻은 뒤 applyCardRead 한다(리뷰).
   앱 소스의 그 줄들을 떼어 쓴다(베끼지 않는다 · 관문 「깨진 글자 씻기」와 같은 자르기) */
const tidyData = (() => {
  const src = require('./app-source.cjs').appSource();
  const line = (re) => (src.match(re) || [''])[0];
  const fn = (n) => { const a = src.indexOf(`function ${n}(`); return a < 0 ? '' : src.slice(a, src.indexOf('\n}\n', a) + 2); };
  return new Function([line(/const ENTITIES = \{[^\n]+\};/), line(/const ENTITY_RE = [^\n]+;/), fn('unent'), line(/const JUNK_CHARS = [^\n]+;/), line(/const OCR_URL_GARBLE = [^\n]+;/),
    line(/const TIDY_SKIP_KEY = [^\n]+;/), line(/const OCR_TEXT_KEY = [^\n]+;/), line(/const OCR_MARK = [^\n]+;/), fn('tidyOcr'), fn('tidyText'), fn('tidyData'), 'return tidyData;'].join('\n'))();
})();
const reg = tidyData(JSON.parse(fs.readFileSync(process.env.WHAT_SHOWS_REGISTERED || new URL('../data/registered.json', import.meta.url), 'utf8')));
/* 유료 카드 읽기 결과를 앱과 같은 함수로 얹는다(2026-11-15 · match-engine applyCardRead) — 안 얹으면 이 도구가 학생 화면과 다른 줄을 말한다.
   표본 파일로 돌 때(WHAT_SHOWS_REGISTERED)는 얹지 않는다 · 파일이 없으면 그대로(무료 길) */
if (!process.env.WHAT_SHOWS_REGISTERED) {
  let cr = null; try { cr = tidyData(JSON.parse(fs.readFileSync(new URL('../data/card-read.json', import.meta.url), 'utf8'))); } catch { /* 아직 없음 */ }
  let fx = null; try { fx = tidyData(JSON.parse(fs.readFileSync(new URL('../data/card-read-fixes.json', import.meta.url), 'utf8'))); } catch { /* 아직 없음 */ }
  reg.items = ME.publishedList(reg.items, cr, null, fx);   // 유료 확인 전 숨김분은 학생 화면에 없다(2026-11-20)
}

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const q = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!q) {
  console.log('쓰는 법: node verify/what-shows.mjs <공고 id 또는 이름 일부> [--gpa=3.2 --credits=14 --bracket=6 --parentRegion=서울 ...]');
  process.exit(1);   // 쓰는 법을 틀린 것은 성공이 아니다 (감싸는 스크립트가 통과로 읽으면 안 된다)
}

/* 숫자 칸에 숫자가 아닌 것이 오면 **멈춘다** — 이 도구의 답은 개발자에게 그대로 인용된다.
   `평점 NaN` 인 채로 그럴듯한 판정을 내놓는 것이 가장 나쁘다. */
const num = (k, d) => {
  const v = arg(k, String(d));
  if (!/^-?\d+(\.\d+)?$/.test(v)) { console.error(`--${k}=${v} 는 숫자가 아닙니다.`); process.exit(1); }
  return Number(v);
};
/* 처지(trait) 답 — 묻기 상자(elig-ask)가 `profile.traits` 에 적는 것과 같은 자리 · 안 주면 '아직 안 물음' (2026-10-15).
   숫자 칸과 같은 규칙으로 **틀린 입력이면 멈춘다** — 모르는 종류나 0·1 이 아닌 값을 조용히 '아니요'로 읽으면 그럴듯한 틀린 답이 된다. */
const TRAIT_KEYS = Object.keys(require('../elig-ask.js').TRAIT_LABEL);
const traits = Object.fromEntries(arg('traits', '').split(',').filter(Boolean).map((kv) => {
  const cut = kv.lastIndexOf(':');   // 단체 회원 열쇠(`member:<단체>:1`)는 가운데에도 쌍점이 있다
  const k = kv.slice(0, cut), val = kv.slice(cut + 1);
  if (!(TRAIT_KEYS.includes(k) || /^member:./.test(k)) || !['0', '1'].includes(val)) { console.error(`--traits=${kv} 는 읽을 수 없습니다 — <종류>:1 또는 <종류>:0 (종류: ${TRAIT_KEYS.join(' ')})`); process.exit(1); }
  return [k, val === '1'];
}));
const p = {
  school: arg('school', '한국외국어대학교'), campus: arg('campus', ''),
  track: arg('track', 'humanities'), major: arg('major', '영어학과'),
  year: num('year', 3), status: arg('status', '재학'),
  gpa: num('gpa', 3.2), bracket: num('bracket', 6),
  credits: num('credits', 14), region: arg('region', '서울'),
  parentRegion: arg('parentRegion', arg('region', '서울')), nationality: 'korean', birthYear: num('birthYear', 2004),
  /* 시·군 칸은 줄 때만(2026-11-11 · 층2 시·군 장학금을 재려고) — 안 주면 예전처럼 없는 칸이다 */
  ...(arg('regionCity', '') ? { regionCity: arg('regionCity', '') } : {}), ...(arg('parentRegionCity', '') ? { parentRegionCity: arg('parentRegionCity', '') } : {}),
  flags: [], common: {}, ...(Object.keys(traits).length ? { traits } : {}),
  /* 시·군과 「지금 주소에 산 지」(2026-11-13) — 안 주면 비워 둔다(온보딩에서 안 고른 학생). 거주 기간은 칸의 하한 개월(0·12·36·60·120) */
  ...(arg('regionCity') ? { regionCity: arg('regionCity') } : {}),
  ...(arg('parentRegionCity') ? { parentRegionCity: arg('parentRegionCity') } : {}),
  ...(arg('residenceMonths') != null ? { residenceMonths: num('residenceMonths', 0) } : {}),
};

let hits = reg.items.filter((x) => x.id === q || (x.name || '').includes(q));
/* 정식 등록에 없으면 실시간 공고·재단·지자체·대외활동·소식·층2에서 찾아 **원문 링크만** 보여 준다 (2026-10-03 · 맨 아래 showFeedLinks) */
const feedMode = !hits.length;
/* 넓게 찾으면 수백 줄이 쏟아져 정작 볼 것을 못 본다 — 세어 주고 앞쪽만 보여 준다 */
const CAP = 8;
if (hits.length > CAP) {
  console.log(`'${q}' 로 ${hits.length}건이 걸렸습니다 — 앞 ${CAP}건만 보여 줍니다. 좁혀서 다시 찾으세요.`);
  hits = hits.slice(0, CAP);
}

/* 🔴 앱 규칙을 **한 줄도 베끼지 않는다.** app.js 에서 필요한 함수를 **이름으로 떼어 내**
   그대로 실행한다. 배지 문구도, 신청 버튼 판정도 앱이 쓰는 그 함수가 낸 값이다.

   ⚠️ 첫 판에서는 배지 라벨과 신청 버튼 조건을 손으로 옮겨 적었다가 **8건이 틀렸다**
      (마감 지난 공고를 '신청 버튼 열림'이라고 말했다 — 앱은 `d.days >= 0` 도 본다).
      코드 리뷰가 잡았다. 규칙을 베끼면 갈라진다는 것을, 그걸 막으려고 만든 도구가
      스스로 다시 증명한 셈이다. 그래서 이제 **가져다 쓴다.**

   ⚠️ 두 함수 사이를 잘라 오지 않는다 — 순서가 바뀌거나 사이에 주석 한 줄만 들어가도
      엉뚱한 곳을 자른다(리뷰가 재현했다: 10만 자를 자르거나 0자를 자른다).
      이 파일의 최상위 함수는 열 0의 `function 이름(` 으로 시작해 열 0의 `}` 로 끝난다. */
const appSrc = require('./app-source.cjs').appSource();
function takeFn(name) {
  const re = new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm');
  const m = appSrc.match(re);
  if (!m) throw new Error(`app.js 에서 ${name}() 을 못 찾았습니다 — 이름이 바뀌었거나 최상위 함수가 아닙니다. `
    + `이 도구는 앱 규칙을 베끼지 않고 가져다 쓰므로, 못 가져오면 멈춥니다(틀린 답을 내느니 멈춘다).`);
  return m[0];
}
/* 카드 윗줄·제목 규칙은 한 줄짜리 const 를 쓴다 — 함수와 같은 이유로 **가져다 쓴다** */
function takeConst(name) {
  const m = appSrc.match(new RegExp(`^const ${name} = .*$`, 'm'));
  if (!m) throw new Error(`app.js 에서 ${name} 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.`);
  return m[0];
}
/* 의존 순서대로 — dday 는 todayStart 를, fitBadgeHtml 은 fitTone·fitVerdict 를,
   cardOrgLine 은 cardTitle·bareOrg·orgBase·providerUnknown 을 쓴다 */
const NEED = ['todayStart', 'dday', 'fitTone', 'fitToneNoFail', 'fitVerdict', 'fitBadgeHtml', 'applyLock',
  'cleanCardTitle', 'cardTitle', 'cardOrgLine', 'kindChip', 'cardProviderLine', 'splitTitleWho', 'cardTitleParts', 'amountLine'];   // 카드 시안 B(2026-11-02) — 칩·주최·제목 나누기·금액 줄
const ctx = vm.createContext({ Date, Math, Number, String, JSON, console });
vm.runInContext([...['bareOrg', 'orgBase', 'providerUnknown', 'TD_DAY', 'TD_DAY_RE', 'TD_DAY_G', 'isActivityItem', 'KIND_CHIP_CLS', 'ACT_CHIP_CLS', 'WHO_PAREN', 'NOT_WHO_PAREN', 'KOSAF_AMOUNT_UNKNOWN', 'BOARD_HEAD_ANY', 'BOARD_HEAD_BY_HOST'].map(takeConst), ...['isDateBit', 'splitTitleDates', 'trimStars', 'stripBoardHead'].map(takeFn), ...NEED.map(takeFn)].join('\n\n'),   // 카드 제목 날짜 규칙(2026-10-05) · 기관명 모름 판정(providerUnknown)
  ctx, { filename: 'app.js(발췌)' });
const appFn = (n) => vm.runInContext(n, ctx);
const stripTags = (h) => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* ── 원문 링크 — 누르면 무엇이 열리고, 화면은 그것을 뭐라고 부르는가 (2026-10-03) ─────────────
   🔴 원문 링크 이야기도 **이 도구로** 한다(CLAUDE.md 「매 세션 이것만은」 1번). 개발자 보고(P0)
      *"원문 공고를 누르면 그 공고가 아니라 재단·장학금 페이지 전체가 열린다"* 를 조사할 때 화면 일곱 곳이
      제각각 이름을 정하고 있었다 — 그 자리에서 짠 스크립트로 재면 어느 자리를 쟀는지부터 갈린다.
   여기서도 베끼지 않는다: source-link.js·data.js 를 파일째 싣고 app.js 의 링크 자리 함수를 이름으로 떼어 온다.
   로봇의 확인 장부(data/link-check.json)가 있으면 앱과 똑같이 넘긴다(없으면 앱처럼 조용히 주소 꼴만 본다). */
const PA = require('../parse-amount.js');
const linkCtx = vm.createContext({
  console, URL, Math, Date, JSON, Object, Array, String, Number, RegExp, encodeURIComponent, decodeURIComponent,
  document: { baseURI: 'https://seonju5543-web.github.io/hanggonggan/' }, module: undefined,
  amountFrom: PA.amountFrom, exclusivityFrom: PA.exclusivityFrom,
});
vm.runInContext(fs.readFileSync(new URL('../source-link.js', import.meta.url), 'utf8'), linkCtx, { filename: 'source-link.js' });
vm.runInContext(fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8'), linkCtx, { filename: 'data.js' });
vm.runInContext([
  /* 카드가 쓰는 한 줄 const 는 **전부** 여기에 — 하나라도 빠지면 그 꼴의 카드(기간 한 줄·학교 사진)에서만 이 도구가 넘어진다
     (리뷰 G3 · 기간 한 줄 달린 게시판 글에서 `hintText is not defined`). 관문 「원문 링크 정직성」 app 갈래가 실제 글 꼴로 돌려 본다. */
  ...['ENTITIES', 'ENTITY_RE', 'PARTIAL_ENTITY_END', 'hintText', 'NEWS_THUMB_RE', 'SCHOOL_PHOTO_RE', 'PHOTO_FOCUS_RE',
    'CLOSED_KEEP_DAYS', 'KOSAF_ELIG', 'KOSAF_CORE', 'kosafClean', 'KOSAF_NOISE', 'SAYS_UNKNOWN', 'kosafSplit', 'KOSAF_AMOUNT_UNKNOWN', 'TD_DAY', 'TD_DAY_RE', 'TD_DAY_G', 'BOARD_HEAD_ANY', 'BOARD_HEAD_BY_HOST', 'JUNK_CHARS', 'OCR_URL_GARBLE', 'TIDY_SKIP_KEY', 'OCR_TEXT_KEY', 'OCR_MARK',
    'ACT_TAG', 'activityBenefit', 'WHO_PAREN', 'NOT_WHO_PAREN'].map(takeConst),   // 활동 시트 「공고 안내」 줄(activitySheetNotices · 2026-11-26)이 쓴다
  ...['isDateBit', 'splitTitleDates', 'trimStars', 'stripBoardHead', 'hintShort', 'shortDay', 'splitTitleWho', 'activityTitle', 'activitySheetNotices'].map(takeFn),   // 카드 제목 날짜·회색 기간 줄(2026-10-04·05) · 카드 윗줄 날짜(10-10)
  ...['esc', 'unent', 'tidyOcr', 'tidyText', 'tidyData', 'safeUrl', 'won', 'todayStart', 'dday', 'kosafAmountLabel', 'knownValue', 'kosafNoticeValue', 'attachPrepTemplate', 'kosafAsScholarships', 'sourceLinkHintHtml',   // knownValue: 층2 공고 안내 칸 값이 부른다 · attachPrepTemplate: 층2 항목마다 지원문서를 붙인다(2026-10-13 ① · FORM_TEMPLATES 가 없는 자리에선 그대로 돌려준다)
    'attachmentLinkHtml', 'sourceLinkHtml', 'sourceNoteHtml', 'amountSourceLinkHtml', 'appLogLinkHtml', 'noticeCardHtml', 'activityLinkWhy',
    'formPdfsFor', 'docPdfsFor', 'pdfRowHtml', 'attachPdfRowsHtml', 'sheetAttachments'].map(takeFn),   // 「첨부」 칸 — 위 PDF 줄 · 맨 밑 올린 목록(2026-11-20 승인 시안)
  /* 층2 바꾸기가 읽는 앱 상태 — 이 도구는 저장·신청 내역을 모른다(없음) */
  'var kosafList = []; var kosafUpdatedAt = ""; var state = { applications: [] }; function isSaved() { return false; }',
  'var formsPdfIndex = { items: {} }; var docsPdfIndex = { items: {} };',   // 아래에서 앱이 받는 색인 그대로 넣는다
  /* 「공고 안내」 블록(NS_LABELS … noticeSummaryHtml) — 활동 시트의 셋째 칸을 앱 함수 그대로 그린다(test-collector 「공고 카드 품질」과 같은 자르기) */
  appSrc.slice(appSrc.indexOf('const NS_LABELS = ['), appSrc.indexOf('\nfunction sourceNoteHtml(')),
].join('\n\n'), linkCtx, { filename: 'app.js(링크 자리)' });
linkCtx.joinSpacedSyllables = ME.joinSpacedSyllables;   // noticeSummaryHtml 의 tidyChars 가 쓴다(match-engine)
linkCtx.stripListNumber = ME.stripListNumber;   // noticeSummaryRows 의 번호 떼기도 match-engine 한 곳(2026-11-17)
const linkFn = (n) => vm.runInContext(n, linkCtx);
/* 「첨부」 칸 (2026-11-20 승인 시안 · docs/designs/all-docs-pdf.md) — 앱이 받는 두 사본 색인을 넣고 앱 함수(attachPdfRowsHtml · sheetAttachments)로 그대로 센다 */
for (const [k, rel] of [['formsPdfIndex', '../data/forms-pdf/index.json'], ['docsPdfIndex', '../data/docs-pdf/index.json']]) {
  try { linkCtx[k] = linkFn('tidyData')(JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'))); } catch { /* 없으면 빈 색인 — 앱도 그때 PDF 줄이 없다 */ }   // 앱처럼 다듬는다
}
function attachLines(it) {
  const atts = linkFn('sheetAttachments')(it.attachments);
  const rows = [...String(linkFn('attachPdfRowsHtml')(it, atts)).matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => `${htmlText(m[2])}${/data\/(forms|docs)-pdf\//.test(m[1]) ? ' (사본)' : ''}`);
  return [`   ─ 첨부 — 위 PDF 줄 ${rows.length}개${rows.length ? ` · ${rows.join(' · ').slice(0, 90)}` : ''} · 맨 밑 올린 목록 ${atts.length}개`];
}
const LEDGER = new URL('../data/link-check.json', import.meta.url);
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : null;
linkFn('setLinkChecks')(ledger);
/* 관리자가 넣은 원문(source-link.js ⑥) — 앱처럼 함께 넘긴다 */
const FIXES = new URL('../data/link-fixes.json', import.meta.url);
linkFn('setLinkFixes')(fs.existsSync(FIXES) ? JSON.parse(fs.readFileSync(FIXES, 'utf8')) : null);
const htmlText = (h) => stripTags(h).replace(/&amp;/g, '&');
const hrefIn = (h) => ((String(h).match(/\shref="([^"]*)"/) || [])[1] || '').replace(/&amp;/g, '&');
const CLS_WORD = { post: '그 공고 하나로 가는 주소', list: '게시판 목록이 열린다', home: '사이트 첫 화면이 열린다', trouble: '로봇이 「그 공고가 아니었다」를 확정', none: '열 주소가 없다' };
/* 화면 자리마다 실제로 찍히는 이름 — 정식 등록·층2(sch) · 게시판 글 카드(card) · 활동 시트(activity) */
/* ── 신청서 양식 칸 — 양식 작성 화면 머리·신청 준비 시트가 그리는 줄 (2026-11-20) ─────────────
   로봇이 원본을 PDF 로 바꾼 줄(data/forms-pdf · 「원본 양식 그대로 보기」) + 공고문에서 뗀 서식 쪽(data/form-pages) + 신청서로 보이는 첨부.
   첨부가 신청서인가는 앱의 attIsForm 을 **가져다 쓴다**(로봇이 원본 내용으로 가른 색인 roles 가 먼저 · 없으면 data.js isApplicationForm) */
const formsIdx = (() => { try { return JSON.parse(fs.readFileSync(new URL('../data/forms-pdf/index.json', import.meta.url), 'utf8')); } catch { return { items: {} }; } })();
const pagesIdx = (() => { try { return JSON.parse(fs.readFileSync(new URL('../data/form-pages/index.json', import.meta.url), 'utf8')).items || {}; } catch { return {}; } })();
const appIsForm = (() => {
  const ds = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
  const take = (n) => { const m = ds.match(new RegExp(`^function ${n}\\([\\s\\S]*?^\\}`, 'm')); if (!m) throw new Error(`data.js 에서 ${n}() 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.`); return m[0]; };
  return new Function('formsPdfIndex', `${take('isFormAttachment')}\n${take('isApplicationForm')}\n${takeFn('attIsForm')}\nreturn attIsForm;`)(formsIdx);
})();
function formSlotLines(sch) {
  if (sch.sourceKind === 'kosaf') return [];
  const pdfs = (formsIdx.items || {})[sch.id] || [];
  const pages = (pagesIdx[sch.id] || []).filter((f) => f && f.file);
  const pdfNames = new Set(pdfs.map((f) => f.name));
  const atts = (sch.attachments || []).filter((a) => a && !a.bodyImage && appIsForm(sch, a) && !pdfNames.has(a.name));
  const roles = (formsIdx.roles || {})[sch.id] || {};
  const n = pdfs.length + pages.length + atts.length;
  const out = [`   ─ 신청서 양식 칸 (${n}줄${n ? '' : ' · 칸 없음'})`];
  for (const f of pdfs) out.push(`       · 원본 양식 그대로 보기 — ${String(f.name).slice(0, 70)}${roles[f.name] ? ' (원본 내용으로 신청서라 봄)' : ''}`);
  for (const f of pages) out.push(`       · ${String(f.name || '공고문 안 신청서 서식').slice(0, 70)}`);
  for (const a of atts) out.push(`       · 첨부 — ${String(a.name).slice(0, 70)} (PDF 사본 아직 없음)`);
  const out2 = Object.entries(roles).filter(([, r]) => r === 'notice').map(([nm]) => nm);
  if (out2.length) out.push(`       (칸에서 뺀 첨부 — 속이 안내문: ${out2.join(' · ').slice(0, 80)})`);
  return out;
}

function linkLines(it, where) {
  const L = linkFn('sourceLink')(it, 'detail');
  const out = [`   ─ 원문 링크 — ${L.kind} (${CLS_WORD[L.cls] || L.cls})${ledger ? '' : ' · 확인 장부 없음(주소 꼴만 봄)'}`];
  if (where === 'sch') {
    const d = linkFn('sourceLinkHtml')(it);
    out.push(`       상세 시트 「${htmlText(d) || '(없음)'}」 · 금액 상세 「${htmlText(linkFn('amountSourceLinkHtml')(it)) || '(없음)'}」 · 신청 내역 「${htmlText(linkFn('appLogLinkHtml')(it))}」`);
    out.push(`       제출처 「${linkFn('officialChannel')(it).label}」 · 신청 준비 시트 「${htmlText(linkFn('sourceNoteHtml')(it))}」`);
    out.push(`       누르면 → ${hrefIn(d) || '(링크 없음)'}`);
  } else if (where === 'card') {
    const h = linkFn('noticeCardHtml')(it, {});
    out.push(`       카드 아랫줄 「${htmlText(([...h.matchAll(/<p class="sch-provider">([^<]*)<\/p>/g)].pop() || [])[1] || '')}」 · 도우미 「${it.title || ''} ${linkFn('sourceLink')(it, 'chat').label}」`);
    out.push(`       누르면 → ${hrefIn(h) || '(링크 없음)'}`);
  } else if (where === 'activity') {
    /* 활동 시트 단추 — 이름은 source-link.js activityButton 자리(승인 시안 2026-11-02 · openActivityDetail 과 같은 규칙) */
    const aL = linkFn('sourceLink')(it, 'activityButton');   // 단추 이름은 source-link.js 한 곳(activityButton)
    out.push(`       활동 시트 단추 「${aL.href ? aL.label : '(없음)'}」 · 안내 「${htmlText(linkFn('activityLinkWhy')(it, aL)) || '(없음)'}」`);
    out.push(`       누르면 → ${aL.href || '(링크 없음)'}`);
    /* 시트의 칸들이 무엇을 그리는가(2026-10-19 개발자 "자격요건이 공고 안내에 들어가 있다") — 자격·모집 안내·공고 안내는 이 세 칸의 글자를 그대로 그린다(없으면 칸을 접는다) */
    const raw = it.eligibilityLines || [], ex = it.excerpts || [], nl = it.noticeLines || [];
    /* 시트는 저장된 줄을 그대로 찍지 않고 match-engine 이 절(자격/제외)로 가른 것을 그린다 — 같은 함수로 가른 결과를 보인다(2026-10-27 「라참여배제자」) */
    const el = ME.requirementLines(it, raw, { all: true });
    /* 제외·우선 — 앱 시트(eligibilityRowsHtml)와 같이 **두 목록을 따로** 거르고 자격 칸에 이미 보인 줄은 뺀다. 카드가 얹힌 글은 제외·우대를 따로 칸으로 낸다(최종 리뷰 2026-11-26 —
       자격 줄에서만 세면 카드 글의 ✗ 줄이 늘 0줄이었다 · 정식 등록 갈래와 같은 블록) */
    const shownReq = new Set(el);
    const exl = [...new Set([...ME.requirementLines(it, it.eligibilityExcludes || [], { onlyExclude: true }), ...ME.requirementLines(it, raw, { onlyExclude: true })])].filter((t) => !shownReq.has(t));
    const pri = [...new Set([...ME.requirementLines(it, it.eligibilityPriority || [], { keepPriority: true }), ...ME.requirementLines(it, raw, { keepPriority: true, onlyPriority: true })])].filter((t) => !shownReq.has(t));
    out.push(`   ─ 지원 자격 (${el.length}줄${el.length ? '' : ' · 「원문에서 확인 — 공고가 자격을 따로 적지 않았어요」 한 줄'} · 저장된 줄 ${raw.length})`);   // 칸은 늘 있다(승인 시안 2026-11-02)
    for (const l of el) out.push(`       · ${String(l).slice(0, 84)}`);
    out.push(`   ─ 제외 줄 ✗ — 「지원 자격」 칸 안 (${exl.length}줄)`);
    for (const l of exl) out.push(`       ✗ ${String(l).slice(0, 84)}`);
    out.push(`   ─ 우선 선발 기준 (${pri.length}줄${pri.length ? '' : ' · 칸 없음'} · 판정하지 않는다)`);
    for (const l of pri) out.push(`       · ${String(l).slice(0, 84)}`);
    out.push(`   ─ 발췌 이름표 (${ex.length}줄 · 모집기간은 「접수 · 기간」 · 나머지는 「공고 안내」 줄)`);
    for (const x of ex) out.push(`       · ${x.label} · ${String(x.text).slice(0, 70)}`);
    /* 「공고 안내」는 저장된 줄 그대로가 아니다 — 시트(openActivityDetail)가 모집 안내·자격에 이미 나온 문장을 빼고 noticeSummaryHtml 이 조각·머리글을 거른다.
       그 두 단계를 **앱 함수로** 다시 밟는다(2026-10-28 개발자 "자격요건이 공고 안내에 들어가고 있는데" — 이 도구가 저장된 줄을 찍어 화면과 다르게 말했다) */
    /* 시트가 「공고 안내」에 넘기는 줄은 앱의 activitySheetNotices 하나(긴 혜택 → 제목 괄호 대상 → 발췌 → 원문 안내 · 2026-11-26) — 같은 함수를 부른다(베끼지 않는다) */
    const noticeHtml = linkFn('noticeSummaryHtml')(linkFn('activitySheetNotices')(it));
    const nrows = [...String(noticeHtml).matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1].replace(/<b class="ns-k">([^<]*)<\/b>/, '$1 · ')));
    out.push(`   ─ 공고 안내 (${nrows.length}줄${nrows.length ? '' : ' · 칸 접힘'} · 저장된 줄 ${nl.length})`);
    for (const l of nrows.slice(0, 8)) out.push(`       · ${String(l).slice(0, 84)}`);
    /* 제출 서류·신청서 원본 PDF(2026-10-30) — 시트가 그리는 칸 둘 · PDF 는 앱이 받는 색인(data/forms-pdf/index.json)을 글 id 로 본다 */
    const fpi = (() => { try { return JSON.parse(fs.readFileSync(new URL('../data/forms-pdf/index.json', import.meta.url), 'utf8')).items || {}; } catch { return {}; } })();
    const pdfs = (it.id && fpi[it.id]) || [];
    out.push(`   ─ 제출 서류 (${(it.documents || []).length}줄${(it.documents || []).length ? '' : ' · 칸 접힘'})`);
    for (const d of it.documents || []) out.push(`       · ${String(d).slice(0, 84)}`);
    out.push(`   ─ 신청서 양식 PDF ${pdfs.length}개${pdfs.length ? ` (${pdfs.map((f) => f.name).join(' · ').slice(0, 80)})` : ' · 칸 접힘'} · 첨부 ${(it.attachments || []).length}개 · 마감 ${it.deadline || '(없음)'}`);
    out.push(...attachLines(it));
  }
  return out;
}

/* 층2 카드·시트의 적합도 배지 (2026-11-11 · 6차 — 「셋 중 하나」 줄의 분모를 재려고) — 앱처럼 evaluateFor(층2는 미달이 아니면 '모름')·fitScore·fitDetail 을 부르고
   배지는 fitBadgeHtml 이 낸 그대로다. 줄마다 ✓ ✕ ? 는 requirementMatch(화면 줄 표시와 같은 판정) · 「택1 n」 은 한 요건으로 세는 묶음(requirementLines withMeta) */
vm.runInContext(takeFn('evaluateFor'), Object.assign(ctx, { evaluate: ME.evaluate }), { filename: 'app.js(evaluateFor)' });
function kosafFitLines(sch) {
  const result = appFn('evaluateFor')(sch, p);
  const fd = ME.fitDetail(sch, p);
  const badge = stripTags(appFn('fitBadgeHtml')(ME.fitScore(sch, result, p), fd)) || '(배지 없음)';
  const out = [`   학생: ${p.school} ${p.year}학년 ${p.status} · 평점 ${p.gpa} · ${p.credits}학점 · ${p.bracket}구간 · ${p.birthYear}년생 · 거주 ${p.region}${p.regionCity ? ' ' + p.regionCity : ''} · 부모 ${p.parentRegion || '-'}${p.parentRegionCity ? ' ' + p.parentRegionCity : ''}`,
    `   판정 ${result.status}  ·  배지 「${badge}」  ·  요건 ${fd.met}/${fd.total} 충족${fd.unknown ? ` · 모름 ${fd.unknown}` : ''}${fd.unread ? ' · 자격 미확인' : ''}`,
    '   ─ 상세 시트 자격 줄'];
  for (const { text, group, head } of ME.requirementLines(sch, null, { all: true, withMeta: true })) {
    if (head) out.push(`       ┄ 「${String(head).slice(0, 80)}」 (택1 묶음 이름표 · 요건 줄 아님)`);
    const v = ME.requirementMatch(text, p, sch);
    out.push(`       ${v === 'ok' ? '✓' : v === 'no' ? '✕' : '?'} ${group ? `[택1 ${group}] ` : ''}${String(text).slice(0, 84)}`);
  }
  out.push(...attachLines(sch));   // 「첨부」 칸 — 위 PDF 줄 · 맨 밑 올린 목록(2026-11-20)
  return out;
}

/* 정식 등록에 없는 이름 — 앱이 실제로 받는 파일에서 찾는다(공고·소식은 학교별 파일 · 층2는 앱 함수로 바꾼 모양) */
function showFeedLinks(query) {
  const read = (p) => { try { return linkFn('tidyData')(JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'))).items || []; } catch (e) { return []; } };   // 앱처럼 씻는다(2026-11-17)
  const dir = (p) => fs.readdirSync(new URL(p, import.meta.url)).filter((f) => /\.json$/.test(f) && f !== 'index.json').flatMap((f) => read(`${p}${f}`));
  linkCtx.kosafList = read('../data/kosaf-open.json');
  /* 대외활동·공모전은 앱과 같은 함수(match-engine publishedActivities)로 거르고 AI 카드를 얹는다(2026-11-25 · 유료 관문 · 설계 docs/designs/paid-gate-activities.md 5-4) —
     학생 화면에 없는 글을 물으면 「없다」가 아니라 **왜 없는지**(카드를 기다림 · 사람에게 넘김 · 결과 파일을 못 읽음)를 말한다. 찾기는 날것 목록에서 한다(숨긴 글도 찾아야 말할 수 있다) */
  /* WHAT_SHOWS_ACTIVITIES · WHAT_SHOWS_ACT_READ — 관문 표본용(2026-11-26 · WHAT_SHOWS_REGISTERED 와 같은 뜻): 실데이터 대신 표본 활동 목록·결과 파일로 돈다. 평소에는 쓰지 않는다 */
  const actRaw = read(process.env.WHAT_SHOWS_ACTIVITIES || '../data/activities.json');
  let actDoc = null; try { actDoc = linkFn('tidyData')(JSON.parse(fs.readFileSync(new URL(process.env.WHAT_SHOWS_ACT_READ || '../data/act-read.json', import.meta.url), 'utf8'))); } catch (e) { /* 못 읽음 — 앱도 숨김 표시가 달린 글을 감춘다 */ }
  const actShown = new Map(ME.publishedActivities(actRaw, actDoc, undefined, { dropRe: linkFn('SAYS_UNKNOWN'), flat: linkFn('noticeFlat'), label: linkFn('nsLabel') }).map((x) => [x.url, x]));
  const HELD_KO = { 'no-source': '읽을 원문이 없다', unreadable: 'AI 가 읽었는데 실을 내용이 없었다', 'grad-only': '대학원생만 받는 글이다' };
  const actGateLines = (it) => {
    const on = actShown.get(it.url);
    if (!on) {
      if (it.paidGate && !actDoc) return ['   🔒 학생 화면에 없음 — 유료 확인 결과 파일(data/act-read.json)을 못 읽었다(숨김 표시가 달린 글은 전부 감춘다)'];
      const held = it.paidGate && actDoc && actDoc.gateHeld && actDoc.gateHeld[it.id];
      if (held) return [`   🔒 학생 화면에 없음 — 유료 확인에서 사람에게 넘긴 글이다(${HELD_KO[held] || held}) · 관리자 「할 일」에서 올리거나 숨긴다`];
      if (it.paidGate) return [`   🔒 학생 화면에 없음 — 유료 확인 전이다(AI 카드를 기다리는 중 · 숨김 표시 ${it.paidGate} · 사흘이 지나도 카드가 없으면 무료 값으로 오른다)`];
      return [];
    }
    if (!on.cardRead) return it.paidGate ? [`   ⏱ 유료 확인 없이 무료 값으로 보인다 — ${it.paidOpen ? `${/^관리자/.test(String(it.paidOpen)) ? '관리자가 올렸다' : '수집 로봇이 열어 두었다'}(${it.paidOpen})` : `숨김 표시(${it.paidGate}) 뒤 사흘이 지났다`}`] : [];
    /* 얹힌 값(자격·발췌·안내·서류·마감)은 아래 시트 줄들이 그대로 말한다(얹은 뒤의 글을 넘긴다) — 여기서는 통과 사실과, 시트에 새로 보이는 「접수 · 방법」 줄만 */
    const how = Array.isArray(on.cardRead.apply) ? on.cardRead.apply.filter((l) => typeof l === 'string' && linkFn('knownValue')(l)) : [];   // 앱 시트와 같이 '모름'류 낱말이 든 줄은 통째로 뺀다(applySectionHtml)
    return ['   🧾 AI 카드가 얹혔다(유료 확인 통과) — 아래 칸들은 얹은 뒤의 값이다', ...how.map((l) => `       접수 · 방법 ${String(l).slice(0, 84)}`)];
  };
  const sets = [
    ['층2(한국장학재단 등록 재단)', linkFn('kosafAsScholarships')(), 'sch', (x) => x.name],
    ['학교 게시판 새 공고', dir('../data/notices/'), 'card', (x) => x.title],
    ['재단·지자체 새 공고', read('../data/external.json'), 'card', (x) => x.title],
    ['대외활동·공모전', actRaw, 'activity', (x) => x.title],
    ['우리 학교 소식', dir('../data/news/'), 'card', (x) => x.title],
  ];
  let shown = 0;
  for (const [label, list, where, nameOf] of sets) {
    const found = list.filter((x) => x.id === query || x.url === query || String(nameOf(x) || '').includes(query));
    for (const it of found.slice(0, CAP)) {
      console.log(`\n■ [${label}] ${String(nameOf(it) || '').slice(0, 80)}`);
      if (where === 'sch') for (const l of kosafFitLines(it)) console.log(l);
      if (where === 'activity') { for (const l of actGateLines(it)) console.log(l); if (!actShown.has(it.url)) { shown += 1; continue; } }   // 학생 화면에 없는 글 — 까닭만 말한다(링크 줄은 그릴 것이 없다)
      for (const l of linkLines(where === 'activity' ? actShown.get(it.url) : it, where)) console.log(l);
      shown += 1;
    }
    if (found.length > CAP) console.log(`   … ${label}에서 ${found.length}건이 걸렸습니다 — 앞 ${CAP}건만 보여 줍니다.`);
  }
  return shown;
}

/* ── 신청 버튼을 **누르면** 무엇이 뜨는가 (2026-09-23) ─────────────────────────────
   개발자 지적 *"신청 준비 시작 버튼을 눌렀을때 바로 신청내역으로 이동"* — 이 도구는 '버튼이
   열려 있다'까지만 말해서, 누르는 순간 곧장 '준비 완료'로 새는 공고 100건을 못 봤다.
   🔴 여기서도 **베끼지 않는다**: app.js 의 applyTo 와 그 이웃(formTplIdFor·essayDefsFor·
      attachPrepTemplates)을 이름으로 떼어 오고, 양식은 forms.js + data/forms.json 그대로 싣는다.
      applyTo 가 부르는 화면 함수만 '무엇을 불렀나'를 적는 가짜로 둔다. */
const takeBlockConst = (name) => {
  const m = appSrc.match(new RegExp(`^const ${name} = \\[[\\s\\S]*?^\\];`, 'm'));
  if (!m) throw new Error(`app.js 에서 ${name} 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.`);
  return m[0];
};
const pressCtx = vm.createContext({ Date, Math, Number, String, JSON, Object, Array, RegExp, console });
vm.runInContext(fs.readFileSync(new URL('../forms.js', import.meta.url), 'utf8'), pressCtx, { filename: 'forms.js' });
vm.runInContext(`Object.assign(FORM_TEMPLATES, ${JSON.stringify(JSON.parse(fs.readFileSync(new URL('../data/forms.json', import.meta.url), 'utf8')).templates || {})});`, pressCtx);
{
  const dataSrc = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
  const isForm = dataSrc.match(/^function isFormAttachment\([\s\S]*?^\}/m);
  if (!isForm) throw new Error('data.js 에서 isFormAttachment() 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.');
  const isApp = dataSrc.match(/^function isApplicationForm\([\s\S]*?^\}/m);
  if (!isApp) throw new Error('data.js 에서 isApplicationForm() 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.');
  const shortName = dataSrc.match(/^function docShortName\([\s\S]*?^\}/m);   // 서류 이름 짧게 — 서류 도우미(essayDefsFor)·양식 엔진(prepWriteDocs)이 부른다(리뷰 11차)
  if (!shortName) throw new Error('data.js 에서 docShortName() 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다.');
  /* 6-1 (2026-11-21) — 신청 버튼은 「공고가 올린 신청서 원본이 있는가」(app-live hasOriginalForm)를 본다. 앱이 받는 두 색인을 그대로 싣고 그 이웃도 이름으로 떼어 온다 */
  vm.runInContext(`let formsPdfIndex = ${JSON.stringify(formsIdx)}; let formPagesIndex = ${JSON.stringify(pagesIdx)};`, pressCtx);
  vm.runInContext([isForm[0], isApp[0], shortName[0], takeBlockConst('ESSAY_DEFS'),
    ...['essayDefsFor', 'formPdfsFor', 'formPagesFor', 'attIsForm', 'hasOriginalForm', 'formTplIdFor', 'attachPrepTemplate', 'attachPrepTemplates', 'applyTo'].map(takeFn)].join('\n\n'),
    pressCtx, { filename: 'app.js(신청 버튼)' });
}
function pressRoute(sch) {
  const s = JSON.parse(JSON.stringify(sch));
  const got = [];
  Object.assign(pressCtx, {
    startFormFill: () => got.push('form'), startDocPrep: () => got.push('doc'),
    renderApplyPrep: () => got.push('prep'), finalizeApply: () => got.push('finalize'), closeSheet: () => {},
  });
  const run = (n) => vm.runInContext(n, pressCtx);
  run('attachPrepTemplates')([s]);
  run('applyTo')(s);
  if (got.includes('finalize')) return "🚨 확인 화면 없이 곧장 '신청 준비 완료'로 담긴다";
  if (got[0] === 'form') {
    const id = run('formTplIdFor')(s);
    /* 앱 지원문서(unofficial)는 공고마다 성격이 다르다(forms.js prepKindFor) — 문서의 lead 를 그대로 옮긴다(2026-10-13 · '자유 형식'이라 뭉뚱그리지 않는다) */
    const tplNow = run('FORM_TEMPLATES')[id];
    return `양식 작성 화면 (${id}${tplNow.unofficial ? ` · 앱 지원문서 — ${tplNow.lead || '자유 형식 지원문서'}` : ''})`;
  }
  if (got[0] === 'doc') return `서류 도우미 (${run('essayDefsFor')(s).map((d) => d.doc).join(' · ')})`;
  if (got[0] === 'prep') {
    /* 앱 신청서 칸과 같은 셈 — 로봇이 원본 내용을 읽고 이름과 다르게 가른 것(forms-pdf 색인 roles · app-live attIsForm)이 먼저 (2026-11-20) */
    const roles = (() => { try { return (JSON.parse(fs.readFileSync(new URL('../data/forms-pdf/index.json', import.meta.url), 'utf8')).roles || {})[s.id] || {}; } catch { return {}; } })();
    const isForm = run('isFormAttachment');
    const n = (s.attachments || []).filter((a) => (roles[a.name] ? roles[a.name] === 'form' : isForm(a))).length;
    /* 6-1 — 공고가 올린 신청서 원본이 있어서 이 시트로 온 것인지 밝힌다(앱 지원문서는 원본이 없을 때만) */
    const orig = run('hasOriginalForm')(s);
    const copies = run('formPdfsFor')(s).length, pages = run('formPagesFor')(s).length;
    return `신청 준비 시트 — 확인을 눌러야 담긴다 (${orig ? `공고 원본 신청서가 있어 앱 지원문서는 안 띄운다 · PDF 사본 ${copies}개 · 공고문에서 뗀 서식 ${pages}개 · ` : ''}내려받을 신청서 양식 첨부 ${n}개)`;
  }
  return `(알 수 없음: ${got.join(',') || '아무것도 안 부름'})`;
}

/* ── 카드로 안 그리는 정식 공고 (2026-11-16 · 리뷰 — 이 도구만 카드·판정·신청 버튼을 말했다) ─────────────
   앱의 getMatches 는 match-engine feedOnlyFormal(기한도 자격도 못 읽은 정식 공고)을 카드에서 빼고,
   boardNoticesForMe 가 그 공고를 「우리 학교 게시판 공고」의 게시판 새 공고 한 줄(제목 + 링크)로 싣는다(feedOnlyBoardRows).
   🔴 여기서도 베끼지 않는다 — 같은 두 함수를 부르고, 이 학생의 학교 게시판 글은 앱이 받는 학교별 파일(noticeFilesForProfile)을
      앱과 같은 잣대(noticeForProfile)로 거른다. 그 글에 같은 주소가 있으면 그 글이 그 자리다(feedOnlyBoardRows 가 줄을 안 만든다). */
function myBoardFeed() {
  return ME.noticeFilesForProfile(p).flatMap((f) => {
    try { return JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).items || []; } catch { return []; }
  }).filter((n) => ME.noticeForProfile(n, p));
}
function feedOnlyLines(sch) {
  const feed = myBoardFeed();
  const own = ME.feedOnlyBoardRows([sch], feed, p)[0];
  const inFeed = own ? null : feed.find((n) => !ME.feedOnlyBoardRows([sch], [n], p).length);
  const out = ['   🔴 카드 없음 — 홈·탐색에 이 공고의 카드를 그리지 않는다 (기한도 자격도 못 읽은 정식 공고 · match-engine feedOnlyFormal)'];
  const row = own || inFeed;
  if (row) {
    out.push(`   대신 「우리 학교 게시판 공고」에 게시판 새 공고 한 줄(제목 + 링크)로 보인다 — 「${row.title}」${own ? '' : ' (학교 게시판 글 그대로)'}`);
    out.push(...linkLines(row, 'card').map((l) => l.replace('─ 원문 링크', '─ 게시판 새 공고 줄 링크')));
  } else {
    out.push('   게시판 새 공고 줄도 없다 (등록이 오래됐다 — notStale · 또는 이 학생 학교가 아니다)');
  }
  return out;
}

for (const sch of hits) {
  const result = ME.evaluate(sch, p);
  const fit = ME.fitScore(sch, result, p);
  const fd = ME.fitDetail(sch, p);
  if (ME.feedOnlyFormal(sch, p, { status: result.status, fd })) {
    console.log(`\n■ ${sch.name || sch.id}`);
    console.log(`   학생: ${p.school} ${p.track} ${p.year}학년 · 평점 ${p.gpa} · ${p.credits}학점 · ${p.bracket}구간`);
    for (const l of feedOnlyLines(sch)) console.log(l);
    for (const l of linkLines(sch, 'sch')) console.log(l);
    continue;
  }
  /* 배지는 앱의 fitBadgeHtml 이 낸 그대로 (문구·'확인 필요 N' 까지 같다) */
  const badge = stripTags(appFn('fitBadgeHtml')(fit, fd)) || '(배지 없음)';
  const d = appFn('dday')(sch.deadline);
  /* 🔴 신청 버튼 판정은 **앱의 applyLock 을 그대로 부른다** (2026-09-13).
     여기에 조건을 손으로 적어 두었더니, 자격 잠금을 푼 뒤에도 이 도구만 계속
     '잠김'이라고 보고했다 — 이 파일 머리말이 경고한 바로 그 갈라짐이다.
     `app` 은 '이미 신청한 기록'인데 이 도구는 저장소 데이터만 보므로 항상 없다(null). */
  const { canApply, caution, noApply } = appFn('applyLock')(result, null, d, sch, fd);

  const listLines = ME.requirementLines(sch, null);                    // 목록 카드 — 5줄 상한
  const allLines = ME.requirementLines(sch, null, { all: true });      // 상세 시트 — 전부
  /* 택1 묶음 머리 줄(이름표 · 2026-11-17) — 앱(eligibilityRowsHtml)이 그 묶음 첫 줄 위에 작게 그리는 원문 글자. 요건 줄이 아니라 줄 수에 안 든다.
     표 공고(requirementStruct)는 시트가 「공통 요건 / 다음 중 하나」 로 따로 그려 이 이름표를 안 쓴다 */
  const headsOf = (items) => new Map(items.filter((x) => x.head).map((x) => [x.text, x.head]));
  const listHeads = headsOf(ME.requirementLines(sch, null, { withMeta: true }));
  const allHeads = ME.requirementStruct(sch) ? new Map() : headsOf(ME.requirementLines(sch, null, { all: true, withMeta: true }));
  const capLine = (heads, l) => (heads.has(l) ? `       ┄ 「${String(heads.get(l)).slice(0, 80)}」 (택1 묶음 이름표 · 요건 줄 아님)\n` : '');
  /* 앱(eligibilityRowsHtml · 2026-10-15)과 같이 **두 목록을 따로** 거르고 자격 블록에 이미 보인 줄은 뺀다 — 이어 붙이면 제외 목록의 머리말
     (`지원 불가 대상:`)이 뒤따르는 자격 줄을 제외 절로 끌어들여 이 도구만 자격 1줄을 '제외'로 보고했다(2026-10-17 미래에셋 해외교환 실측) */
  const shownReq = new Set(allLines);
  const exLines = [...new Set([
    ...ME.requirementLines(sch, sch.eligibilityExcludes || [], { onlyExclude: true }),
    ...ME.requirementLines(sch, sch.eligibilityLines || [], { onlyExclude: true }),
  ])].filter((t) => !shownReq.has(t));

  console.log(`\n■ ${sch.name || sch.id}`);
  /* 🔴 **카드에 실제로 찍히는 두 줄**을 앱 함수 그대로 보여 준다 (2026-09-21 코드 리뷰가 잡았다).
     그전까지 이 도구는 `sch.name` 원본만 찍어서, 제목을 다듬는 규칙과 윗줄에서 기관명을 빼는
     규칙을 **둘 다 못 봤다.** 「매 세션 이것만은」 1번이 화면 이야기를 이 도구로만 하라고
     하는데 정작 카드 윗줄을 몰랐던 것이다. */
  /* 카드 시안 B(2026-11-02) — 윗줄은 칩(kindChip) + 주최(cardProviderLine) · 제목은 cardTitleParts(지우고 나누기만) · 아랫줄 왼쪽은 amountLine */
  const chip = appFn('kindChip')(sch), prov = appFn('cardProviderLine')(sch), tp = appFn('cardTitleParts')(sch), amt = appFn('amountLine')(sch);
  console.log(`   카드 윗줄 「${chip.label}${prov ? ' · ' + prov : ''}」  ·  카드 제목 「${tp.title}」${tp.who.length ? `  ·  제목에서 뗀 대상 「${tp.who.join(' · ')}」` : ''}`);
  console.log(`   카드 아랫줄 왼쪽 (비어 있음 — 2026-11-15 개발자 지시 · 금액은 시트 머리 「${amt.text.replace(/^금액 · /, '') || '줄 없음'}」${amt.text && !amt.known ? ' (옅게)' : ''})`);
  console.log(`   학생: ${p.school} ${p.track} ${p.year}학년 · 평점 ${p.gpa} · ${p.credits}학점 · ${p.bracket}구간`);
  console.log(`   판정 ${result.status}  ·  배지 「${badge}」`);
  console.log(`   신청 버튼 ${canApply ? '열림' : '잠김'}  (마감: ${d.label || '없음'})`);
  if (noApply) console.log(`   신청 절차 없음 — 원문 「${sch.noApply}」 (버튼 잠김 · 홈 바로 신청·일괄 준비·지원문서에서 뺌)`);
  /* 막지 않는 대신 무엇을 알리는가 — 이것까지 보여야 '화면에 무엇이 보이는가'가 완성된다 */
  if (caution) {
    /* 🔴 문구를 **베끼지 않는다** — app.js 에서 그 자리의 두 갈래를 읽어 온다.
       2026-09-17 에 개발자 지시로 문구가 바뀌었을 때, 여기 베껴 둔 사본은 그대로 남아
       이 도구가 **화면에 없는 문장**을 '화면에 보인다'고 보고하고 있었다. 이 파일의 첫머리
       규칙(앱 규칙을 한 줄도 베끼지 않는다)이 글자에도 그대로 적용된다. */
    console.log(`   ⚠️ 버튼 위 안내: ${cautionText(caution)}`);
  }
  if (canApply) console.log(`   누르면 → ${pressRoute(sch)}`);
  console.log(`   ─ 목록 카드에 보이는 자격 줄 (${listLines.length}줄 · 5줄 상한)`);
  for (const l of listLines) console.log(`${capLine(listHeads, l)}       · ${String(l).slice(0, 84)}`);
  /* 자격 0줄이면 시트의 「지원 자격」 칸이 아예 없을 수 있다(2026-11-07 개발자 지시 · app.js sheetSectionsHtml). 칸이 남는 경우(우선 선발 기준·발췌 대체 줄·
     「별도 자격 제한 없음」·판정 근거·빠진 정보·물을 것)는 app.js 의 eligibilityRowsHtml 이 정하고 프로필에 달려 여기서 되풀이하지 않는다 — 유무는 브라우저로 본다(리뷰) */
  console.log(`   ─ 상세 시트에 보이는 자격 줄 (${allLines.length}줄 · 전부${allLines.length ? '' : ' · 0줄이면 「지원 자격」 칸이 아예 없을 수 있음 — 유무는 app.js eligibilityRowsHtml·브라우저로'})`);
  for (const l of allLines) console.log(`${capLine(allHeads, l)}       · ${String(l).slice(0, 84)}`);
  if (allLines.length > listLines.length) console.log(`     ⚠️ 목록에는 ${allLines.length - listLines.length}줄이 안 보인다 — 그건 '숨겨진 것'이 아니라 미리보기 상한이다`);
  console.log(`   ─ 제외 줄 ✗ — 「지원 자격」 칸 안 (${exLines.length}줄)`);
  for (const l of exLines) console.log(`       ✗ ${String(l).slice(0, 84)}`);
  const why = (result.reasons || []).filter((r) => /미달|없어|불가/.test(r));
  if (why.length) console.log(`   ─ 미달 사유\n       ${why.map((w) => w.slice(0, 90)).join('\n       ')}`);
  for (const l of attachLines(sch)) console.log(l);
  for (const l of linkLines(sch, 'sch')) console.log(l);
  for (const l of formSlotLines(sch)) console.log(l);
}

if (feedMode && !showFeedLinks(q)) {
  console.log(`'${q}' 로 찾은 공고가 없습니다 (정식 등록·실시간 공고·재단·지자체·대외활동·소식·층2 모두).`);
  process.exit(1);
}

/* 버튼 위 안내 문구를 **app.js 에서 그대로** 읽어 온다 (2026-09-17).
   app.js 의 그 자리는 삼항 하나다:
       ${applyCaution === 'unknown' ? '…' : '…'}
   🔴 못 찾으면 **지어내지 않고 그렇게 말한다** — 이 도구의 존재 이유가 '화면에 실제로
      무엇이 보이는가'를 틀리지 않게 답하는 것이라, 모르면서 아는 척하면 도구가 해롭다. */
function cautionText(kind) {
  const src = require('./app-source.cjs').appSource();
  const from = src.indexOf('dp-note dp-caution');
  const to = from < 0 ? -1 : src.indexOf('id="btn-apply-one"', from);
  const seg = from >= 0 && to > from ? src.slice(from, to) : '';
  const unk = (seg.match(/\?\s*'([^']+)'/) || [])[1];
  const bad = (seg.match(/:\s*'([^']+)'/) || [])[1];
  if (!unk || !bad) return '(app.js 에서 안내 문구를 못 찾았습니다 — 이 도구를 고쳐 주세요)';
  return kind === 'unknown' ? unk : bad;
}
