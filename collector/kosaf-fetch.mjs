/* 한국장학재단 학자금지원정보 통합검색 수확 (2026-08-29 신설)
 *
 * 왜 만드나 — 개발자 지시. 교외 장학금을 학교 게시판에서 줍는 것은 **대리 통로**라
 * "어느 대학이 올렸나"에 따라 꼬리표가 틀리게 붙는다(실측: 살아있는 교외 58건 중
 * 49건이 전국인데 학교 한정으로 붙어 있었다). 한국장학재단은 그 재단들을 **한곳에
 * 모아** 두고, 상세 화면에 자격·금액·신청기간을 **칸으로 나눠** 갖고 있다.
 *
 * 🔴 이 저장소가 원문에서 힘겹게 뽑던 것이 여기서는 이미 칸이다:
 *    성적기준 · 소득기준 · 학년구분 · 학과구분 · 지역거주구분 · 지원금액 · 신청기간 ·
 *    선발인원 · 자격제한 · 제출처 및 제출서류 · 선발공고문(다운로드)
 *
 * 🔴 받는 법 (재조사 금지 — 알아내는 데 시간이 걸렸다)
 *   · 목록: GET  /CO/jspAction.do?...getItgnSrchCstmDsgnGoodsList...   (쪽 넘김은 `no=`)
 *   · 상세: POST /CO/jspActionSafe.do — **form2 의 칸을 하나도 빠뜨리지 말 것.**
 *           몇 개만 보내면 200 인데 **본문 없는 껍데기(73KB)** 가 온다. 다 보내면 1.3MB.
 *           `csrfTokenPortal` 은 목록 HTML 의 `id="csrfTokenPortal" value=…` 에 있고,
 *           **같은 쿠키**로 이어서 보내야 한다.
 *   · ⚠️ 로그인은 필요 없다. "로그인이 필요한 서비스입니다" 문구는 **목록 페이지에도
 *        똑같이 들어 있는 숨은 모달**이라, 그걸 보고 로그인 벽이라 판단하면 안 된다
 *        (2026-08-29 에 실제로 그렇게 잘못 보고했다).
 *
 * 실행: node collector/kosaf-fetch.mjs [--list-only] [--max=N] [--write]
 * 결과: data/kosaf.json
 */
import fs from 'node:fs';
import { slimKosaf } from './kosaf-open.mjs';
/* 예산 시계는 수집 로봇과 같은 것을 쓴다 — 시간초과는 '넘어져도 저장'으로 못 막는다.
   GitHub 이 프로세스를 강제 종료하면 저장 단계까지 통째로 죽는다(2026-08-03 사고). */
import { makeBudget } from './harvest-budget.mjs';

const BASE = 'https://portal.kosaf.go.kr';
const LIST = `${BASE}/CO/jspAction.do?beanName=PTSMCstmDsgnGoodsSVC&methodName=getItgnSrchCstmDsgnGoodsList`
  + '&inputVOName=kr.go.kosaf.portal.pt.sm.cstmdsgngoods.svc.PTSMCstmDsgnGoodsSVO'
  + '&forwardOnlyFlag=N&ignoreSession=Y&forwardPage=pt/sm/cstmdsgngoods/PTSMCstmDsgnGoods_10M&naviParam=MK,05,02,01';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=')[1] : d;
};
const MAX = Number(arg('max', 0));
const WRITE = process.argv.includes('--write');
const LIST_ONLY = process.argv.includes('--list-only');

/* 쿠키를 손으로 이어 붙인다 — 의존성을 늘리지 않는다 */
const cookies = new Map();
function keep(res) {
  const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const c of set) {
    const kv = c.split(';')[0];
    const i = kv.indexOf('=');
    if (i > 0) cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1));
  }
}
const jar = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');

const strip = (s) => s.replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

let token = '';
let formFields = [];
function readForm(htmlText) {
  const t = htmlText.match(/id="csrfTokenPortal" value="([^"]*)"/);
  if (t) token = t[1];
  const f = htmlText.match(/<form[^>]*name="form2"[\s\S]*?<\/form>/);
  if (!f) return;
  formFields = [...f[0].matchAll(/<input[^>]*>/g)].map((m) => {
    const n = m[0].match(/name="([^"]+)"/);
    const v = m[0].match(/value="([^"]*)"/);
    return n ? [n[1], v ? v[1] : ''] : null;
  }).filter(Boolean);
}

/* 목록 표에서 행을 읽는다. 상세 코드는 fn_goDtl('…') 에 들어 있다 */
function parseList(htmlText) {
  const tables = htmlText.match(/<table[\s\S]*?<\/table>/g) || [];
  const tb = tables.find((x) => x.includes('모집마감일'));
  if (!tb) return [];
  const body = tb.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
  if (!body) return [];
  const out = [];
  for (const tr of body[1].match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    const code = tr.match(/fn_goDtl\('(\d+)'\)/);
    const home = tr.match(/fn_goHome\('([^']*)'\)/);
    if (tds.length >= 7 && /^\d+$/.test(tds[0]) && code) {
      out.push({
        no: Number(tds[0]), code: code[1], org: tds[1], name: tds[2],
        kind: tds[3], goods: tds[4], tel: tds[5], due: tds[6], home: home ? home[1] : '',
      });
    }
  }
  return out;
}

function baseBody() {
  const body = new URLSearchParams();
  for (const [k, v] of formFields) body.set(k, v);
  body.set('csrfTokenPortal', token);
  body.set('beanName', 'PTSMCstmDsgnGoodsSVC');
  return body;
}
async function post(body) {
  const r = await fetch(`${BASE}/CO/jspActionSafe.do`, {
    method: 'POST',
    headers: { cookie: jar(), 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  keep(r);
  const t = await r.text();
  /* 🔴 토큰은 응답마다 새로 온다 — 처음 것만 들고 있으면 쪽을 넘기는 동안 낡아서
     그 뒤의 상세 요청이 전부 껍데기로 돌아온다(실제로 상세 0건이 나왔다).
     ⚠️ 토큰만 새로 읽는다. 폼 칸까지 덮으면 상세 화면의 폼이 들어와 다음 요청이 깨진다. */
  const nt = t.match(/id="csrfTokenPortal" value="([^"]*)"/);
  if (nt) token = nt[1];
  return t;
}

async function page(no) {
  const body = baseBody();
  body.set('methodName', 'getItgnSrchCstmDsgnGoodsList');
  body.set('inputVOName', 'kr.go.kosaf.portal.pt.sm.cstmdsgngoods.svc.PTSMCstmDsgnGoodsSVO');
  body.set('forwardPage', 'pt/sm/cstmdsgngoods/PTSMCstmDsgnGoods_10M');
  body.set('no', String(no));
  return post(body);
}

/* 🔴 상세는 form2 의 칸을 **전부, 그대로** 실어야 한다.
   ⚠️ **덮어쓰지 말 것.** form2 는 이미 상세용으로 채워져 있고, 특히
      `inputVOName` 이 `…PTSMCstmDsgnGoods` 가 아니라 **`…PTSMCstmDsgnGoodsDtlSVO`** 다.
      한 글자(`Dtl`) 차이로 200 이 오지만 **본문 없는 껍데기(67KB)** 가 온다 —
      실제로 이걸 몰라 상세 0건이 나왔고, 원인을 '토큰'·'헤더'로 두 번 잘못 짚었다.
      바꿀 것은 `cstmDsgnGoodsCd` 하나뿐이다. */
async function detail(code) {
  const body = baseBody();
  body.set('cstmDsgnGoodsCd', code);
  const t = await post(body);
  const tables = t.match(/<table[\s\S]*?<\/table>/g) || [];
  const tb = tables.find((x) => x.includes('성적기준') || x.includes('운영기관명'));
  if (!tb) return null;                                   // 껍데기가 왔다
  const f = {};
  for (const tr of tb.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    const cells = [...tr.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => strip(m[2]));
    for (let i = 0; i + 1 < cells.length; i += 2) {
      if (cells[i] && cells[i].length <= 14) f[cells[i]] = cells[i + 1];
    }
  }
  return Object.keys(f).length ? f : null;
}

const first = await fetch(LIST, { headers: { cookie: jar() } });
keep(first);
const firstHtml = await first.text();
readForm(firstHtml);
if (!token || !formFields.length) {
  console.error('✕ 토큰·폼을 못 읽었습니다 — 화면 구조가 바뀐 듯합니다');
  process.exit(1);
}

let rows = parseList(firstHtml);
const last = Math.max(...[...firstHtml.matchAll(/fn_page\('(\d+)'\)/g)].map((m) => Number(m[1])), 1);
console.log(`목록: 마지막 쪽 ${last} · 1쪽 ${rows.length}건`);
for (let p = 2; p <= last; p += 1) {
  rows = rows.concat(parseList(await page(p)));
  if (p % 40 === 0) console.log(`  …${p}/${last}쪽 (${rows.length}건)`);
  await new Promise((r) => setTimeout(r, 200));
}
const seen = new Set();
const list = [];
for (const r of rows) { if (seen.has(r.no)) continue; seen.add(r.no); list.push(r); }
list.sort((a, b) => a.no - b.no);
console.log(`목록 확보: ${list.length}건`);

let got = 0;
const today = new Date().toISOString().slice(0, 10);

/* 🔴 **지난 실행이 받아 둔 상세를 잃지 말 것** (2026-08-30).
   목록은 매 실행 새로 받는데 상세는 일부만 받는다. 그냥 덮어쓰면 예약 실행이 돌 때마다
   **애써 모은 자격 20칸이 통째로 사라진다** — 이번 회차가 아닌 재단은 다시는 안 받으므로
   영영 못 되찾는다. 코드(code)로 이어 붙인다. */
let prevDetail = new Map();
try {
  const prev = JSON.parse(fs.readFileSync(new URL('../data/kosaf.json', import.meta.url), 'utf8'));
  prevDetail = new Map((prev.items || []).filter((i) => i.detail).map((i) => [i.code, i.detail]));
  console.log(`지난 실행의 상세 ${prevDetail.size}건을 이어받습니다`);
} catch { /* 처음 실행 */ }

if (!LIST_ONLY) {
  /* 마감이 지난 것도 **자격은 그대로 쓸 수 있다**(자격은 잘 안 바뀐다). 다만 시간이 드니
     아직 유효한 것을 먼저 받고, --max 로 끊는다.
     ⚠️ 마감일 칸이 **빈 것도 앞에 둔다** — 한국장학재단 푸른등대가 그 꼴인데 칸만 비어
     있을 뿐 모집 중이다(2026-08-30). 빈 문자열은 어떤 날짜보다 작아 그냥 두면 맨 뒤로 간다. */
  const fresh = (r) => (!r.due || r.due >= today ? 1 : 0);
  const order = [...list].sort((a, b) => fresh(b) - fresh(a));
  /* 특정 기관만 받고 싶을 때 — 파일에 낱말을 줄마다 적는다(기관명·상품명 부분일치).
     전량(1,868건)은 응답이 건당 1.3MB라 시간이 오래 걸린다. */
  const pick = arg('only', '');
  let target = order;
  if (pick) {
    const words = fs.readFileSync(pick, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
    target = order.filter((r) => words.some((w) => r.org.includes(w) || r.name.includes(w))
      || r.due >= today);
    console.log(`대상 좁힘: ${target.length}건 (지정 낱말 ${words.length}개 + 마감 유효분)`);
  }
  if (MAX) target = target.slice(0, MAX);
  /* 예산 안에 스스로 끝낸다. 다 못 받아도 목록과 이어받은 상세는 저장된다 —
     상한을 넘겨 강제 종료되면 그 실행의 결과가 통째로 사라진다. */
  const budget = makeBudget(Number(arg('budget-min', 15)) * 60000);
  let ranOut = 0;
  for (const [i, r] of target.entries()) {
    if (budget.expired()) { ranOut = target.length - i; break; }
    try { r.detail = await detail(r.code); } catch { r.detail = null; }
    if (r.detail) got += 1;
    if ((i + 1) % 25 === 0) console.log(`  상세 ${i + 1}/${target.length} (성공 ${got})`);
    await new Promise((x) => setTimeout(x, 250));
  }
  if (ranOut) console.log(`⏱ 예산을 다 써 ${ranOut}건은 다음 실행으로 넘깁니다 (마감 임박순이라 급한 것부터 받았습니다)`);
}
/* 이번에 못 받은 것은 지난 실행 값을 그대로 쓴다 */
let carried = 0;
for (const r of list) {
  if (!r.detail && prevDetail.has(r.code)) { r.detail = prevDetail.get(r.code); carried += 1; }
}
console.log(`상세 확보: 새로 ${got}건 · 이어받음 ${carried}건 · 합계 ${list.filter((r) => r.detail).length}건`);

if (WRITE) {
  const out = {
    updatedAt: new Date().toISOString(),
    source: '한국장학재단 학자금지원정보 통합검색',
    sourceUrl: LIST,
    count: list.length,
    items: list,
  };
  fs.writeFileSync(new URL('../data/kosaf.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
  console.log('→ data/kosaf.json 저장');
  /* 앱이 받는 것은 이 큰 파일이 아니라 **마감 전만 추린 것**이다 — 같이 갱신하지 않으면
     앱의 층2가 낡은 채로 남는다(둘을 따로 돌리게 두면 반드시 잊는다). */
  const slim = slimKosaf(out, today);
  fs.writeFileSync(new URL('../data/kosaf-open.json', import.meta.url), `${JSON.stringify(slim, null, 1)}\n`);
  console.log(`→ data/kosaf-open.json 저장 (마감 전 ${slim.count}건)`);
} else {
  console.log('(미리보기 — 저장하려면 --write)');
}
