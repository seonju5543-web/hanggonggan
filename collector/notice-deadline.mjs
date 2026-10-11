/* 실시간 공고(게시판 글)의 마감 — 자동 등록이 '마감 경과'를 거르고 마감을 담을 때 보는 규칙 **한 곳** (2026-10-05 점검 collect-07)

   왜 옮겼나 — 이 규칙(parseDeadline)이 불러오는 순간 실행되는 auto-register.mjs 안에 있어서 관문이 표본으로 잴 수 없었다.
   🔴 이 파일에는 실행 코드가 없다(불러도 아무것도 읽고 쓰지 않는다) — 관문이 불러 쓴다.

   무엇이 틀렸나 — 자동 등록은 **제목 + 게시판 요약(deadlineHint)** 만 보고 마감을 정했고, 본문 마감은 그 뒤 발췌기(extract-excerpts)가
   채웠다(워크플로 순서). 그래서 본문에만 기간이 적힌 글은 마감 없이 등록되고, 몇 분 뒤 **이미 지난 마감**을 받았다
   (10-04 항공대 「청년창업농장학금」 5월 게시 · 마감 7/6 — 등록하는 순간 이미 끝나 있었다 · 등록 뒤 마감 경과 20건).
   그래서 수집기가 상세 화면을 읽을 때 **껍데기를 걷은 본문**에서 장학과 같은 판독기(extractDeadline)로 읽은 날을
   `bodyDeadline`(+ 그 날짜를 내는 원문 한 줄 `bodyDeadlineText`)으로 남기고, 여기서 그것을 먼저 본다.
   🔴 칸 이름을 `deadline` 으로 하지 말 것 — 앱 카드(app.js)가 n.deadline 으로 카드를 숨기고 D-day 를 그려 승인된 화면이 바뀐다.
   🔴 껍데기를 걷지 않은 본문으로 읽지 말 것 — 항공대 머리 배너(교수 채용 `접수기간 : 2026.10.15.(목) 13:30까지`)가 모든 글의 마감이 된다.
      그 호스트의 껍데기를 모르면(저장된 쪽이 3쪽 미만) 읽지 않는다(bodyDeadlineFrom 이 null). */
import { hintWithoutChrome, isChromeHint, HINT_HEAD } from './deadline-hint.mjs';
import { boilerMulti, boilerFor } from './page-boilerplate.mjs';
import { canonUrl } from './canon-url.mjs';
import { decodeEntities } from './clean-title.mjs';

/* 🔴 달력에 없는 날은 마감이 아니다 — 못 믿으면 비운다 (2026-09-19 · `~ 26. 9. 10.` 이 `2026-26-09` 가 되어 카드에 D-NaN) */
export const okDate = (y, mo, d) => {
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* 날짜를 읽기 전에 HTML 기호를 글자로 · 빈칸을 하나로 (2026-10-11 점검 gap-bf-3) — 게시판 요약은 본문 글자를 그대로 잘라 와
   `2026 년 &nbsp;09 월 &nbsp;30 일까지`(방송대)처럼 기호가 섞여 있어 날짜 꼴이 깨졌다. 두 번 싼 것(&amp;nbsp;)도 있어 두 번 푼다. */
const plain = (s) => decodeEntities(decodeEntities(String(s || ''))).replace(/\s+/g, ' ').trim();   // \s 는 &nbsp;(U+00A0)도 받는다
/* 날짜 뒤 `까지·마감` 앞에 요일·시각이 끼어도 받는다 — `2026. 10. 8.(목) 18:00까지` · `10월 15일(목) 17시까지` (2026-10-11 · 충남대·건국대·서울시립대 요약).
   예전엔 그 사이 숫자 없는 6~8자만 받아 시각이 끼면 못 읽었다 — 끝난 공고가 마감 없이 등록됐다.
   🔴 사이에 범위 기호(`~`)나 `부터` 가 있으면 그 날짜는 **시작**이다 — `2026. 8. 24.(월) 10:00~ 마감시`(선착순 마감)·`(8/24부터 접수) 까지` 를 마감으로 읽지 않는다. */
const GAP = '(?:(?!부터)[^\\d~∼〜～–—])';
const DUE = `(?:${GAP}{0,8}|${GAP}{0,8}\\d{1,2}\\s*(?::\\s*\\d{2}|시)(?:\\s*\\d{1,2}\\s*분)?${GAP}{0,4})(까지|마감)`;
const DUE_KR = new RegExp(`(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일\\s*${DUE}`);
const DUE_DOT = new RegExp(`(\\d{4})[.\\-\\/\\s]+(\\d{1,2})[.\\-\\/\\s]+(\\d{1,2})\\s*${DUE}`);
/* 해 없는 `10/8 마감`·`10월 15일(목) 17시까지` (서강대 제목 `(10/8 마감, 생활비 150만원)` · 서울시립대 요약) — 성적 소수(`평점 3.5 이상 … 까지`)는 날짜가 아니다 */
const BARE_DUE = new RegExp(`(?<![\\d.\\/~])(\\d{1,2})\\s*(?:\\/|\\.|월)\\s*(\\d{1,2})(?!\\d)\\s*일?\\.?\\s*(?:\\([^)]{0,6}\\)\\s*)?${DUE}`, 'g');
const GRADE_NEAR = /평점|성적|학점|점수|GPA/i;
function bareDue(hay) {
  for (const m of hay.matchAll(BARE_DUE)) {
    const date = m[0].match(/^\d{1,2}\s*(?:\/|\.|월)\s*\d{1,2}/)[0];
    if (GRADE_NEAR.test(hay.slice(Math.max(0, m.index - 10), m.index)) || /^\s*(점|이상|이하|만점|배|%)/.test(hay.slice(m.index + date.length))) continue;
    return m;
  }
  return null;
}
/* 해 없는 날짜의 해 — 오늘의 해. 해가 바뀌는 길목만 가까운 쪽(11·12월에 읽은 1·2월 날짜는 다음 해 · 1·2월에 읽은 11·12월 날짜는 지난해).
   🔴 그 밖은 늘 오늘의 해다 — '가까운 쪽'으로 넓히면 3월에 올라온 `~3/31` 이 10월엔 다음 해로 읽혀 끝난 공고가 열린 공고가 된다. */
function bareYear(mo, today) {
  const y = Number(String(today || '').slice(0, 4));
  const tm = Number(String(today || '').slice(5, 7));
  if (!y) return '';
  if (tm >= 11 && Number(mo) <= 2) return String(y + 1);
  if (tm && tm <= 2 && Number(mo) >= 11) return String(y - 1);
  return String(y);
}
/* 게시판 요약(deadlineHint)은 **이름표에서 시작하는 본문 한 토막**이다(deadline-hint.mjs deadlineHintFrom — `제출기한: 2026. 9. 11.(금) ※ …`).
   그 이름표 뒤 날짜는 장학과 **같은 판독기**(extract-excerpts.mjs extractDeadline — 이름표 뒤 날짜만 · 범위면 끝 · 못 믿으면 null)로 읽는다.
   판독기는 부르는 쪽이 넘긴다(불러오는 순간 원문 파일을 읽는 파일이라 여기서 import 하지 않는다 — 아래 bodyDeadlineFrom 과 같은 방식).
   넘기지 않으면 이 갈래는 건너뛴다(예전처럼 `~`·`까지/마감` 꼴만). */
function labeledHint(n, extract) {
  if (typeof extract !== 'function' || !n || !n.deadlineHint) return null;
  const hint = plain(n.deadlineHint);
  /* 콜론 없는 머리 이름표(`제출기한 2026. 11. 11.(수) 6. 제출처 …` — 힌트를 자른 이름표 규칙은 앞말 붙은 이름표를 콜론 없이도 받는다)는
     판독기가 첫 콜론으로 이름표를 가르므로 이름표 뒤에 콜론을 넣어 넘긴다 — **이름표 바로 뒤가 날짜일 때만**.
     🔴 `신청기간 안내(~9/9) 작성일 2026.08.12 …`(게시판 머리 줄)에 콜론을 넣으면 게시일이 마감이 된다(만들면서 실측 4건). 그 밖은 그대로 넘긴다. */
  const head = hint.match(HINT_HEAD);
  const rest = head ? hint.slice(head[0].length) : '';
  const labeled = head && !/[:：]/.test(head[0]) && /^[~∼〜～]?\s*\d/.test(rest) ? `${head[0].trim()} : ${rest}` : hint;
  const got = extract(labeled);
  if (!got || !ISO.test(got)) return null;
  const [y, mo, d] = got.split('-');
  return [hint.slice(0, 200), y, mo, d];
}

/**
 * 게시판 글 하나의 마감 — `{ date, text, from }` 또는 null.
 *   ① 본문 마감(bodyDeadline · 근거 문구 bodyDeadlineText 가 있을 때만) — from '공고 원문'
 *   ② 제목 + 게시판 요약의 명확한 날짜(YYYY.M.D · 한글 날짜 · `까지/마감` · 요약 머리 이름표 뒤 날짜) — from '게시판 요약'
 *   ③ 연도 없는 `~7.03`·`~ 9. 18`·`~ 9 월 28 일`·`10/8 마감` — today 의 해로 읽는다(마감 경과 거르기용 · 해 바뀌는 길목은 bareYear)
 *   opts.extract — 이름표 판독기(장학과 같은 extractDeadline · 부르는 쪽이 넘긴다). 없으면 요약 머리 이름표 갈래를 건너뛴다.
 * text 는 **실제로 맞춘 문구**다 — 등록할 때 `deadlineFrom: '<from> · <text>'` 로 남겨 감사(deadline-audit)가 근거로 센다.
 */
export function parseDeadline(n, today, opts = {}) {
  if (n && n.bodyDeadline && ISO.test(n.bodyDeadline) && n.bodyDeadlineText) {
    const [y, mo, d] = n.bodyDeadline.split('-');
    if (okDate(y, Number(mo), Number(d))) return { date: n.bodyDeadline, text: String(n.bodyDeadlineText).slice(0, 200), from: '공고 원문' };
  }
  const hay = plain(`${(n && n.title) || ''} ${(n && n.deadlineHint) || ''}`);
  const m = hay.match(/~\s*(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/) ||
            // 한글 날짜 "~2026년 7월 31일" (도레이재단 공고가 이 형태라 마감이 비어 있었다 — 2026-07-30 추가) · 숫자와 년·월·일 사이 빈칸도(2026-10-11)
            hay.match(/~\s*(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ||
            hay.match(DUE_KR) ||
            hay.match(DUE_DOT) ||
            labeledHint(n, opts.extract);
  if (m) {
    const iso = okDate(m[1], m[2], m[3]);
    if (iso) return { date: iso, text: m[0].trim(), from: '게시판 요약' };
  }
  /* 연도 없는 "~7.03"·"~7/19"·"~ 9 월 28 일" — 올해로 해석 (마감 경과 거르기용)
     🔴 점 뒤 빈칸을 받는다 — 게시판은 `(~ 9. 18)` 처럼 띄어 쓴다. 안 받으면 마감을 못 읽어
        **끝난 공고가 '접수 기간 원문 확인' 을 달고 60일 동안 탭에 남는다**(2026-09-19 실측 3건). */
  const m2 = hay.match(/~\s*(\d{1,2})\s*[.\/월]\s*(\d{1,2})/);
  const m3 = m2 || bareDue(hay);
  if (m3) {
    const iso = okDate(bareYear(m3[1], today), m3[1], m3[2]);
    if (iso) return { date: iso, text: m3[0].trim(), from: '게시판 요약' };
  }
  return null;
}

/**
 * 상세 화면 줄 글자 → 본문 마감 `{ date, text }` 또는 null.
 *   lines   : 상세 화면 줄 글자(html-text.mjs htmlToLines)
 *   boiler  : 그 호스트의 껍데기 줄 Set(page-boilerplate.mjs boilerMulti) — **없거나 비면 읽지 않는다**
 *   extract : 날짜 판독기(장학과 같은 extractDeadline — 부르는 쪽이 넘긴다 · 새 판독기를 만들지 말 것)
 *   lastDateIn : 한 줄의 마지막 날짜(verify/entry-rules.cjs 한 곳) — 근거 줄 고르기에 쓴다
 * 근거 줄(그 날짜를 내는 원문 한 줄)을 못 고르면 null — 감사가 근거를 못 찾는 마감은 담지 않는다(2026-10-01 데이터 관문 사고).
 */
export function bodyDeadlineFrom(lines, boiler, extract, lastDateIn) {
  if (!boiler || !boiler.size || typeof extract !== 'function') return null;
  const kept = (Array.isArray(lines) ? lines : String(lines || '').split(/\n+/)).map((l) => String(l).trim()).filter((l) => l && !boiler.has(l));
  if (!kept.length) return null;
  const date = extract(kept.join('\n'));
  if (!date || !ISO.test(date)) return null;
  const year = date.slice(0, 4);
  /* 근거 줄 — 한 줄에서 같은 날이 나오는 줄 · 이름표와 날짜가 다른 줄이면 두 줄을 잇는다 */
  for (let i = 0; i < kept.length; i += 1) {
    const one = kept[i];
    if (one.length <= 200 && ((lastDateIn && lastDateIn(one, year) === date) || extract(one) === date)) return { date, text: one };
    const two = `${one} ${kept[i + 1] || ''}`.trim();
    if (kept[i + 1] && two.length <= 200 && extract(`${one}\n${kept[i + 1]}`) === date && lastDateIn && lastDateIn(two, year) === date) return { date, text: two };
  }
  return null;
}

/** 저장된 두 원문 파일(notices-text.json · browser-bodies.json 의 내용) → makeBodyReader 의 stored·browser.
 *  수집기와 자동 등록이 같은 모양으로 넘기게 한 곳에 둔다(파일은 부르는 쪽이 읽는다 — 이 파일은 읽고 쓰지 않는다). */
export function corporaFrom(noticesText, browserBodies) {
  return {
    stored: Object.values(noticesText || {}),
    browser: Object.entries(browserBodies || {}).map(([url, v]) => (v && v.text ? { url, text: v.text } : null)).filter(Boolean),
  };
}

/**
 * 수집기 발행 단계가 쓰는 '껍데기를 걷은 본문' 읽개 — 저장된 원문(notices-text.json) · 브라우저 원문(browser-bodies.json) ·
 * 이번 실행에 받은 상세 화면(run: 글 객체 → 줄 글자)으로 호스트별 껍데기 줄을 배운다(말뭉치별로 따로 배워 합친다 · page-boilerplate).
 * 이번 실행 글은 저장된 같은 주소를 갈음한다(한 쪽을 두 번 세면 그 쪽 본문이 껍데기로 잡힐 수 있다).
 *   heal(n, fresh) — 기간 힌트(deadlineHint): 이번 실행 글은 껍데기를 걷고 다시 읽는다 · 실린 글은 힌트가 껍데기에서 시작했을 때만
 *                    저장된 원문으로 다시 읽고, 원문이 없으면 비운다(지어내지 않는다). 그 호스트의 껍데기를 모르면 손대지 않는다.
 *   fill(n)        — 본문 마감(bodyDeadline · bodyDeadlineText) — 이미 있으면 그대로.
 * 돌려준 값: 고친 수 { hints, bodyDeadlines }.
 */
export function makeBodyReader({ stored = [], browser = [], run = new Map(), extract, lastDateIn } = {}) {
  const byKey = new Map();
  for (const v of stored) if (v && v.url && typeof v.text === 'string' && !/^FETCH_/.test(v.text)) byKey.set(canonUrl(v.url), v);
  for (const [n, text] of run) if (n && n.url && text) byKey.set(canonUrl(n.url), { url: n.url, text });
  const browserByKey = new Map();
  for (const v of browser) if (v && v.url && v.text) browserByKey.set(canonUrl(v.url), v);
  const chrome = boilerMulti([[...byKey.values()], [...browserByKey.values()]]);
  const bodyOf = (n) => run.get(n) || (byKey.get(canonUrl(n.url || '')) || {}).text || (browserByKey.get(canonUrl(n.url || '')) || {}).text || null;
  const counts = { hints: 0, bodyDeadlines: 0 };
  return {
    chrome,
    counts,
    heal(n, fresh = false) {
      const set = boilerFor(chrome, n.url);
      if (!set) return;
      const own = run.get(n);
      if (fresh && own) { const h = hintWithoutChrome(own, set); if (h !== n.deadlineHint) counts.hints += 1; n.deadlineHint = h; return; }
      if (!isChromeHint(n.deadlineHint, set)) return;
      const t = bodyOf(n);
      n.deadlineHint = t ? hintWithoutChrome(t, set) : null;
      counts.hints += 1;
    },
    fill(n) {
      if (n.bodyDeadline) return;
      const set = boilerFor(chrome, n.url);
      const t = set && bodyOf(n);
      if (!t) return;
      const got = bodyDeadlineFrom(t, set, extract, lastDateIn);
      if (got) { n.bodyDeadline = got.date; n.bodyDeadlineText = got.text; counts.bodyDeadlines += 1; }
    },
  };
}
