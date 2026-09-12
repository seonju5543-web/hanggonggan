/* 한국장학재단(KOSAF) 포털과 말하는 곳 — **한 군데** (2026-09-12 분리)
 *
 * 왜 나눴나 — 이 세션 규칙(쿠키·csrf 토큰·form2)은 알아내는 데 오래 걸렸고 **틀리면
 * 조용히 껍데기가 온다**(200 인데 본문 없음). 로봇이 셋으로 늘면서(목록 수확 ·
 * 첨부 받기 · 정찰) 같은 코드를 베끼면 한쪽만 고쳐져 갈라진다 —
 * `canon-url.mjs`·`section-head.js` 를 따로 뗀 것과 같은 이유다.
 *
 * 🔴 재조사 금지 — 여기 적힌 것은 전부 실측으로 알아낸 것이다:
 *   · 목록: GET  /CO/jspAction.do?…getItgnSrchCstmDsgnGoodsList…  (쪽 넘김은 `no=`)
 *   · 상세: POST /CO/jspActionSafe.do — **form2 의 칸을 하나도 빠뜨리거나 덮어쓰지 말 것.**
 *           `inputVOName` 이 `…PTSMCstmDsgnGoodsDtlSVO` 인데 `Dtl` 을 빼면 200 인데
 *           **본문 없는 껍데기(67KB)** 가 온다. 바꿀 것은 `cstmDsgnGoodsCd` 하나뿐.
 *   · 토큰은 **응답마다 새로 온다** — 낡은 것을 들고 있으면 그 뒤가 전부 껍데기다.
 *   · 로그인은 필요 없다. "로그인이 필요한 서비스" 문구는 목록에도 있는 **숨은 모달**이다.
 *   · 첨부는 **Referer 만 있으면** 받아진다(쿠키는 있어도 무해). 리퍼러 없이는 "비정상적인 접근" —
 *     그래서 그 주소를 앱에 그대로 넣으면 안 되고, 로봇이 받아 우리 쪽에 둔다(kosaf-attach.mjs).
 */
import fs from 'node:fs';

export const BASE = 'https://portal.kosaf.go.kr';
export const LIST = `${BASE}/CO/jspAction.do?beanName=PTSMCstmDsgnGoodsSVC&methodName=getItgnSrchCstmDsgnGoodsList`
  + '&inputVOName=kr.go.kosaf.portal.pt.sm.cstmdsgngoods.svc.PTSMCstmDsgnGoodsSVO'
  + '&forwardOnlyFlag=N&ignoreSession=Y&forwardPage=pt/sm/cstmdsgngoods/PTSMCstmDsgnGoods_10M&naviParam=MK,05,02,01';

/* 태그는 두고 **글자 실체만** 되돌린다 — 주소를 읽을 때 쓴다.
   🔴 없으면 안 되는 이유(2026-09-12 정찰로 드러남): KOSAF 의 첨부 href 는
   `…?filename=…&FileNameDn=…&amp;path=KOSAF_COMMON&amp;encVal=…` 처럼
   **중간부터 `&amp;` 로 적혀 있다.** 그대로 부르면 칸 이름이 `amp;path`·`amp;encVal` 이 되어
   서버가 알아듣지 못한다(그리고 그 실패는 200 에 HTML 로 돌아온다 — 조용하다). */
export const unent = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

export const strip = (s) => String(s).replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();

/* 🔴 재단 서버가 한 번 안 받아 주면 **실행 전체가 죽었다** (2026-09-01 이슈 #227).
   ⚠️ **응답을 못 받은 요청만 다시 보낸다.** 응답이 왔으면 post() 가 토큰을 갱신하므로
      같은 몸통으로 다시 보내면 껍데기가 온다. 여기서 잡는 것은 fetch 자체가 던지는 경우뿐. */
export async function tryFetch(url, opts = {}, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      /* 30초 — 평소 목록은 2초, 상세(1.3MB)는 8초다(실측). 크게 잡으면 포털이 느릴 때
         작업 상한에 걸려 취소되고, 취소는 실패가 아니라 `if: failure()` 도 안 잡는다. */
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeoutMs || 30000) });
    } catch (e) {
      last = e;
      if (i < attempts) {
        console.log(`  · 재단 서버가 응답하지 않습니다 (${i}/${attempts}) — ${i * 5}초 뒤 다시 겁니다`);
        await new Promise((r) => setTimeout(r, i * 5000));
      }
    }
  }
  throw last;
}

/** 쿠키·토큰·form2 를 쥐고 있는 한 벌. 로봇마다 하나씩 연다. */
export function createSession() {
  const cookies = new Map();
  const state = { token: '', formFields: [] };

  function keep(res) {
    const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const c of set) {
      const kv = c.split(';')[0];
      const i = kv.indexOf('=');
      if (i > 0) cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }
  }
  const jar = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');

  function readForm(htmlText) {
    const t = htmlText.match(/id="csrfTokenPortal" value="([^"]*)"/);
    if (t) state.token = t[1];
    const f = htmlText.match(/<form[^>]*name="form2"[\s\S]*?<\/form>/);
    if (!f) return;
    state.formFields = [...f[0].matchAll(/<input[^>]*>/g)].map((m) => {
      const n = m[0].match(/name="([^"]+)"/);
      const v = m[0].match(/value="([^"]*)"/);
      return n ? [n[1], v ? v[1] : ''] : null;
    }).filter(Boolean);
  }

  function baseBody() {
    const body = new URLSearchParams();
    for (const [k, v] of state.formFields) body.set(k, v);
    body.set('csrfTokenPortal', state.token);
    body.set('beanName', 'PTSMCstmDsgnGoodsSVC');
    return body;
  }

  async function post(body) {
    const r = await tryFetch(`${BASE}/CO/jspActionSafe.do`, {
      method: 'POST',
      headers: { cookie: jar(), 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    keep(r);
    const t = await r.text();
    /* 토큰만 새로 읽는다 — 폼 칸까지 덮으면 상세 화면의 폼이 들어와 다음 요청이 깨진다 */
    const nt = t.match(/id="csrfTokenPortal" value="([^"]*)"/);
    if (nt) state.token = nt[1];
    return t;
  }

  /** 목록 첫 쪽을 받아 토큰·form2 를 쥔다. 실패하면 던진다(화면 구조가 바뀐 것이다). */
  async function open() {
    const first = await tryFetch(LIST, { headers: { cookie: jar() } });
    keep(first);
    const html = await first.text();
    readForm(html);
    if (!state.token || !state.formFields.length) {
      throw new Error('토큰·폼을 못 읽었습니다 — KOSAF 화면 구조가 바뀐 듯합니다');
    }
    return html;
  }

  async function page(no) {
    const body = baseBody();
    body.set('methodName', 'getItgnSrchCstmDsgnGoodsList');
    body.set('inputVOName', 'kr.go.kosaf.portal.pt.sm.cstmdsgngoods.svc.PTSMCstmDsgnGoodsSVO');
    body.set('forwardPage', 'pt/sm/cstmdsgngoods/PTSMCstmDsgnGoods_10M');
    body.set('no', String(no));
    return post(body);
  }

  /** 상세 화면 HTML **그대로**. 칸으로 나누는 것도, 첨부를 읽는 것도 아래 순수 함수가 한다. */
  async function detailHtml(code) {
    const body = baseBody();
    body.set('cstmDsgnGoodsCd', code);
    return post(body);
  }

  /** 첨부 한 개 받기 — 🔴 Referer 가 핵심이다(없으면 "비정상적인 접근" HTML 이 온다). */
  async function download(url) {
    const r = await tryFetch(url, {
      headers: { cookie: jar(), referer: `${BASE}/CO/jspActionSafe.do` },
      timeoutMs: 60000,
    });
    return r;
  }

  return { open, page, detailHtml, download, post, baseBody, keep, jar, readForm, state };
}

/* ── 여기부터는 순수 함수다(네트워크 없음) — 그래서 Node 검사로 재현할 수 있다 ── */

/** 목록 표에서 행을 읽는다. 상세 코드는 fn_goDtl('…') 에 들어 있다 */
export function parseList(htmlText) {
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

/** 상세 표를 이름표→내용 으로. 껍데기가 오면 null. */
export function parseDetailFields(htmlText) {
  const tables = htmlText.match(/<table[\s\S]*?<\/table>/g) || [];
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

/* 🔴 **첨부(선발공고문)를 글자로 뭉개지 말 것** — 이 저장소가 2026-08-29~2026-09-12 동안
   `선발공고문: "[다운로드]"` 라는 **아무 쓸모 없는 글자**만 갖고 있었던 이유가 이것이다.
   parseDetailFields 가 strip() 으로 태그를 통째로 지우는데, 그 태그 안에 유일한 원문
   공고(선발공고문 파일)로 가는 길이 들어 있었다. 그래서 여기서는 **태그를 먼저 읽는다.** */

/* 🔴 **줄을 낱말로 찾지 말고 이름표로 찾는다** (2026-09-12 코드 리뷰에서 잡힌 치명적 버그).
   처음엔 `첨부파일|공고문` 이 들어간 첫 `<tr>` 을 집었는데, 실측하니 **1,587곳 중 1,525곳
   (96%)이 엉뚱한 행**을 집었다: `선발공고문` 은 상세표의 **맨 마지막 칸**인데, 그보다 앞
   칸(`자격제한`·`제출처 및 제출서류`)에 `※ 자세한 사항은 첨부파일 또는 홈페이지 참고`
   라는 상투구가 거의 항상 들어 있다.
   더 나쁜 것은 **조용하다는 것**이다 — 첨부가 0건이 되고, 그러면 새 관문 셋이 전부
   빈 목록을 상대로 통과한다(초록불). 이 저장소가 이미 배운 것과 같다:
   「검사가 조용하면 통과가 아니라 무력해진 것부터 의심한다」(CLAUDE.md 매 세션 3번).
   그래서 이름표 칸(`<th>선발공고문</th>`)을 찾아 **그 바로 다음 칸만** 돌려준다. */
const FILE_LABEL = /^(선발\s*공고문|공고문|첨부\s*파일|첨부)$/;

/** 상세 HTML 에서 첨부 칸의 **날 것 그대로**를 돌려준다(정찰·회귀 검사용) */
export function fileCellHtml(htmlText) {
  for (const tr of htmlText.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    /* 한 줄에 이름표·내용이 두 쌍씩 오는 표라, 줄이 아니라 **칸 자리**로 짚어야 한다 */
    const cells = [...tr.matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/g)];
    for (let i = 0; i + 1 < cells.length; i += 1) {
      if (FILE_LABEL.test(strip(cells[i][2]))) return cells[i + 1][2];
    }
  }
  return '';
}

/** `fn_xxx('a','b')` 꼴 호출을 잡아 이름과 인자로 나눈다 */
export function parseCall(s) {
  const m = String(s || '').match(/([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/);
  if (!m) return null;
  const args = [...m[2].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => (x[1] !== undefined ? x[1] : x[2]));
  return { fn: m[1], args };
}

/** 상세 HTML 의 첨부 링크들. 주소를 만들 수 있으면 url 을, 아니면 call 을 남긴다. */
export function parseFiles(htmlText) {
  const cell = fileCellHtml(htmlText);
  if (!cell) return [];
  const out = [];
  for (const a of cell.match(/<a\b[\s\S]*?<\/a>/g) || []) {
    const href = unent((a.match(/href\s*=\s*"([^"]*)"/i) || a.match(/href\s*=\s*'([^']*)'/i) || [])[1] || '');
    const onclick = (a.match(/onclick\s*=\s*"([^"]*)"/i) || a.match(/onclick\s*=\s*'([^']*)'/i) || [])[1] || '';
    const text = strip(a);
    /* 진짜 주소인가 — `javascript:` 와 빈 앵커(`#`)는 주소가 아니다.
       ⚠️ 주소에 **공백과 한글이 날것으로** 들어 있다(실측: `…F_장학생 선발요강제24기 후기…pdf`).
          `new URL(...).href` 로 한 번 통과시켜 규격대로 인코딩한다 — 안 하면 fetch 가 던진다. */
    const raw0 = /^https?:\/\//i.test(href) ? href
      : (/^\/(?!\/)/.test(href) ? BASE + href : '');
    let real = '';
    if (raw0) { try { real = new URL(raw0).href; } catch { real = ''; } }
    /* ⚠️ `javascript:void(0)` 도 '호출'로 읽힌다 — 인자 없는 호출은 내려받기가 아니다.
       걸러 두지 않으면 빈 앵커 하나하나가 '주소를 못 만든 첨부'로 리포트에 쌓여,
       진짜 못 받은 것이 그 잡음에 묻힌다. */
    const hasArgs = (c) => c && c.args.length > 0;
    const cand = [parseCall(onclick), parseCall(href.replace(/^javascript:/i, ''))].find(hasArgs);
    const call = real ? null : (cand || null);
    if (!real && !call) continue;
    /* 날것은 **주소를 못 만들었을 때만** 남긴다 — 전부 담으면 재단 1,587곳 × 300자로
       data/kosaf.json 이 0.5MB 불어난다(읽을 사람도 없다). 리포트가 이것을 보여 준다. */
    out.push({ text, ...(real ? { url: real } : { raw: a.slice(0, 300) }), ...(call ? { call } : {}) });
  }
  return out;
}

/* 🔴 KOSAF 가 파일을 내려 줄 때 이름은 **본문이 아니라 헤더**에 있다(링크 글자는 `[다운로드]`
   하나뿐이라 이름이 없다). 한국 관공서 서버는 여기서 세 가지 꼴을 섞어 쓴다 —
   RFC5987(`filename*=UTF-8''…`) · 퍼센트 인코딩 · **EUC-KR 바이트를 latin1 로 실어 보내기**.
   마지막 것을 그냥 쓰면 이름이 `Ãªí` 꼴로 깨진다. */
/* 🔴 KOSAF 는 **주소 안에 보여 줄 이름을 같이 준다**(`FileNameDn=`) — 실측으로 확인.
   헤더(Content-Disposition)보다 이쪽을 먼저 쓴다: 헤더는 관공서 서버마다 인코딩이 제각각이라
   깨질 길이 셋인데, 이 칸은 KOSAF 가 링크를 만들 때 적어 둔 것이라 깨끗하다.
   ⚠️ 질의 문자열이라 `+` 는 공백이다 — URLSearchParams 가 알아서 푼다. */
export function nameFromUrl(u) {
  try {
    const q = new URL(u).searchParams;
    const n = q.get('FileNameDn') || q.get('filename') || '';
    return n.split('/').pop().trim();
  } catch { return ''; }
}

export function filenameFrom(disposition, fallback) {
  const d = String(disposition || '');
  const star = d.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
  if (star) { try { return decodeURIComponent(star[2].trim().replace(/^"|"$/g, '')); } catch { /* 아래로 */ } }
  const plain = d.match(/filename\s*=\s*"([^"]*)"/i) || d.match(/filename\s*=\s*([^;]+)/i);
  let name = plain ? plain[1].trim() : '';
  if (!name) return fallback;
  if (/%[0-9A-Fa-f]{2}/.test(name)) { try { name = decodeURIComponent(name); } catch { /* 그대로 */ } }
  /* latin1 로 실려 온 한글 바이트를 되살린다 — 되살려서 한글이 나올 때만 바꾼다 */
  if (/[-ÿ]/.test(name) && !/[가-힣]/.test(name)) {
    const bytes = Buffer.from(name, 'latin1');
    for (const enc of ['utf-8', 'euc-kr']) {
      try {
        const t = new TextDecoder(enc, { fatal: false }).decode(bytes);
        if (/[가-힣]/.test(t) && !t.includes('�')) { name = t; break; }
      } catch { /* 그 인코딩이 없는 런타임 — 다음 것 */ }
    }
  }
  return name || fallback;
}

/* 🔴 재단이 붙인 이름을 **그대로 파일 이름으로 쓰지 않는다** — 경로 구분자·상위 경로가
   들어오면 저장소 아무 데나 쓰게 된다(`../../.github/workflows/…`). 이름은 화면용으로
   따로 남기고, 디스크에는 안전한 이름만 쓴다. */
export function safeFileName(name, fallback = 'file') {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  /* ⚠️ `%`·`#` 도 뗀다 — 디스크에서는 멀쩡한 글자지만 **주소로 한 번이라도 다뤄지면**
     깨진다: `%` 는 퍼센트 escape 로 읽혀 `(등록금 100% 지원).hwp` 가 URIError 를 내고,
     `#` 뒤는 조각(fragment)으로 잘려 나간다. 실제 재단 공고문 이름에 둘 다 나온다.
     보여 주는 이름은 원문 그대로 따로 남기므로(mirror.files[].name) 잃는 것은 없다. */
  const cleaned = base.replace(/[ -<>:"|?*%#]/g, '').replace(/\s+/g, ' ').trim()
    .replace(/^\.+/, '');
  return (cleaned || fallback).slice(0, 120);
}

/** 받은 것이 진짜 파일인가 — KOSAF 는 막을 때 **200 에 HTML** 로 답한다 */
export function looksLikeHtml(buf) {
  const head = Buffer.from(buf.subarray(0, 400)).toString('latin1').toLowerCase();
  return /<!doctype html|<html|<head|<script/.test(head);
}

/** 앞 바이트로 무슨 파일인지 — 확장자를 믿지 않는다(`.bin` 으로 오는 PDF 가 있었다) */
export function sniffKind(buf) {
  const b = buf.subarray(0, 8);
  if (b.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (b.subarray(0, 2).toString('latin1') === 'PK') return 'zip';      // hwpx·docx·xlsx·zip
  if (b.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') return 'ole';  // hwp·doc·xls
  return '';
}

export const readJson = (rel, meta) => JSON.parse(fs.readFileSync(new URL(rel, meta), 'utf8'));
