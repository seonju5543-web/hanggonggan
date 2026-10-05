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
import { hintWithoutChrome, isChromeHint } from './deadline-hint.mjs';
import { boilerMulti, boilerFor } from './page-boilerplate.mjs';
import { canonUrl } from './canon-url.mjs';

/* 🔴 달력에 없는 날은 마감이 아니다 — 못 믿으면 비운다 (2026-09-19 · `~ 26. 9. 10.` 이 `2026-26-09` 가 되어 카드에 D-NaN) */
export const okDate = (y, mo, d) => {
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === iso ? iso : null;
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 게시판 글 하나의 마감 — `{ date, text, from }` 또는 null.
 *   ① 본문 마감(bodyDeadline · 근거 문구 bodyDeadlineText 가 있을 때만) — from '공고 원문'
 *   ② 제목 + 게시판 요약의 명확한 날짜(YYYY.M.D · 한글 날짜 · `까지/마감`) — from '게시판 요약'
 *   ③ 연도 없는 `~7.03`·`~ 9. 18` — today 의 해로 읽는다(마감 경과 거르기용)
 * text 는 **실제로 맞춘 문구**다 — 등록할 때 `deadlineFrom: '<from> · <text>'` 로 남겨 감사(deadline-audit)가 근거로 센다.
 */
export function parseDeadline(n, today) {
  if (n && n.bodyDeadline && ISO.test(n.bodyDeadline) && n.bodyDeadlineText) {
    const [y, mo, d] = n.bodyDeadline.split('-');
    if (okDate(y, Number(mo), Number(d))) return { date: n.bodyDeadline, text: String(n.bodyDeadlineText).slice(0, 200), from: '공고 원문' };
  }
  const hay = `${(n && n.title) || ''} ${(n && n.deadlineHint) || ''}`;
  const m = hay.match(/~\s*(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/) ||
            // 한글 날짜 "~2026년 7월 31일" (도레이재단 공고가 이 형태라 마감이 비어 있었다 — 2026-07-30 추가)
            hay.match(/~\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/) ||
            hay.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*[^\d]{0,8}(까지|마감)/) ||
            hay.match(/(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})\s*[^\d]{0,6}(까지|마감)/);
  if (m) {
    const iso = okDate(m[1], m[2], m[3]);
    if (iso) return { date: iso, text: m[0].trim(), from: '게시판 요약' };
  }
  /* 연도 없는 "~7.03"·"~7/19" — 올해로 해석 (마감 경과 거르기용)
     🔴 점 뒤 빈칸을 받는다 — 게시판은 `(~ 9. 18)` 처럼 띄어 쓴다. 안 받으면 마감을 못 읽어
        **끝난 공고가 '접수 기간 원문 확인' 을 달고 60일 동안 탭에 남는다**(2026-09-19 실측 3건). */
  const m2 = hay.match(/~\s*(\d{1,2})\s*[.\/]\s*(\d{1,2})/);
  if (m2) {
    const iso = okDate(String(today || '').slice(0, 4), m2[1], m2[2]);
    if (iso) return { date: iso, text: m2[0].trim(), from: '게시판 요약' };
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
