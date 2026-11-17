/* ============================================================
   게시판 껍데기(메뉴·푸터) 걷어내기 (2026-08-20 신설)

   왜 만들었나 — 자격 요건을 못 읽는 공고를 세어 보니, 원문이 없어서가 아니라
   **메뉴에 파묻혀 있어서**였다. 저장된 원문 중 자격을 못 뽑은 61건 가운데 **40건**이
   '본문다운 줄이 8% 미만'인 상태였다(광운 국가고시장학금: 713줄 중 긴 줄 38개).
   학교 홈페이지는 공고 본문 앞뒤로 전체 메뉴·조직도·푸터를 통째로 붙이는데,
   HTML 태그만 벗기면 그게 전부 글자로 남는다.

   어떻게 가리나 — **학교 구조를 알 필요가 없는 방법**을 쓴다.
   컨테이너 이름(`.board_view` 등)으로 잡으려 했으나 학교마다 전부 달라 못 쓴다
   (광운 `article.contents-box` · 경희 `div.board02` · 동국 `div.view_cont` — 실측).
   대신 **같은 학교의 여러 공고에 똑같이 나오는 줄은 메뉴**라는 사실을 쓴다.
   이 저장소가 검색 요약(`build-search-index.mjs`)에서 이미 쓰는 원리와 같다.
   실측: 광운 713→23줄 · 동국 305→22줄 · 경희 299→9줄, 본문은 그대로 남았다.

   ⚠️ **수집(fetch) 단계에 넣지 않았다.** 이건 이미 저장된 원문에 적용하는 뒷처리라
   수집 로봇의 시간 예산을 한 톨도 쓰지 않는다(이 저장소가 시간초과로 세 번 데인 자리).
   덤으로 **옛 원문까지 소급 적용**된다 — 다시 받을 필요가 없다.
   ============================================================ */

const hostOf = (u) => { try { return new URL(u).host; } catch { return ''; } };
const linesOf = (t) => String(t || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);

/* 저장된 원문 전체를 훑어 호스트별 '메뉴 줄' 목록을 만든다.
   minPages: 이만큼도 안 모인 학교는 판단하지 않는다(적은 표본으로 지우면 본문을 지운다).
   ratio: 그 학교 공고의 이 비율 이상에 나오면 메뉴로 본다. */
/* keyOf(쪽) — 주면 **같은 글은 한 번만** 센다(같은 공고가 주소 꼴만 달리해 여럿 저장된다 — 부산 원스톱 한 글이 4벌).
   발췌기의 사이트 띠 판정(extract-excerpts.mjs siteChrome)이 '서로 다른 글 셋 이상'을 셀 때 쓴다 · 안 주면 예전 그대로 쪽마다 센다 */
export function buildBoilerplate(texts, { minPages = 3, ratio = 0.4, keyOf = null } = {}) {
  const stat = new Map();
  for (const v of texts || []) {
    if (!v || !v.text || /^FETCH_/.test(v.text)) continue;
    const h = hostOf(v.url);
    if (!h) continue;
    if (!stat.has(h)) stat.set(h, { pages: 0, freq: new Map(), seen: new Set() });
    const e = stat.get(h);
    const key = keyOf ? keyOf(v) : null;
    if (key != null) {
      if (e.seen.has(key)) continue;
      e.seen.add(key);
    }
    e.pages += 1;
    // 한 공고 안에서 여러 번 나와도 1번으로 센다 — 반복되는 배너가 한 페이지를 지배하지 않게
    for (const l of new Set(linesOf(v.text))) e.freq.set(l, (e.freq.get(l) || 0) + 1);
  }
  const out = new Map();
  for (const [h, e] of stat) {
    if (e.pages < minPages) continue;
    const set = new Set();
    for (const [l, n] of e.freq) if (n >= minPages && n / e.pages >= ratio) set.add(l);
    if (set.size) out.set(h, set);
  }
  return out;
}

/* 한 공고에서 메뉴 줄을 걷어낸다.
   🔴 걷어낸 결과가 너무 앙상하면 **원문을 그대로 돌려준다.** 게시판 서식이 바뀌거나
   표본이 치우쳐 본문까지 지워 버리는 경우가 있을 수 있는데, 그때 '조금 지저분한 원문'은
   고쳐 읽을 수 있지만 '내용이 사라진 원문'은 손쓸 수가 없다.
   실패는 안심되는 쪽으로 틀리면 안 된다(이 저장소의 되풀이되는 원칙). */
export function stripBoilerplate(text, boiler, { fallback = true } = {}) {
  if (!text || !boiler || !boiler.size) return text;
  const all = linesOf(text);
  const kept = all.filter((l) => !boiler.has(l));
  /* 🔴 안전판은 **읽을 때**의 것이다 — **잴 때** 쓰면 빈 본문이 '있음'이 된다 (2026-09-15).
     경희대 게시판은 본문이 그림이라 메뉴를 걷어내면 제목·첨부 이름만 남는데, 그게 120자가
     안 돼 안전판이 **메뉴째 원문을 되돌려 줬고**, 그 메뉴 1,400자를 본문 분량으로 세어
     두을장학재단·익산사랑·서울인재대학 3건이 '본문 확보 ✅'로 통과했다(실측).
     읽는 쪽은 그대로 안전판을 쓰고, 분량을 재는 쪽(notice-source `measure`)만 끈다. */
  if (fallback && (kept.length < 3 || kept.join('\n').length < 120)) return text;
  return kept.join('\n');
}

/* 편의: 저장된 원문 배열로 '주소 하나를 넣으면 걷어낸 글자를 주는' 함수를 만든다 */
export function makeStripper(texts, opts) {
  const boiler = buildBoilerplate(texts, opts);
  return (url, text, stripOpts) => stripBoilerplate(text, boiler.get(hostOf(url)), stripOpts);
}

/* 🔴 말뭉치가 둘이면 **따로 배워서 합친다** — 섞어서 배우면 둘 다 못 배운다 (2026-09-15).
   같은 게시판이라도 일반 수집이 받은 글자와 브라우저(재수집)가 그린 글자는 모양이 다르다.
   경희대 news 게시판은 일반 수집분 36쪽에는 없는 탭 줄·주소 꼬리말이 브라우저분 11쪽 전부에
   있는데, 47쪽을 한 통에 넣으면 11/47 = 23% 라 문턱(40%)에 못 미쳐 메뉴로 안 잡히고,
   그 두 줄(한글 60자)이 본문 분량에 들어가 껍데기가 '본문 있음'으로 통과했다.
   말뭉치별로 배운 메뉴 목록을 호스트마다 합집합으로 합친다 — 어느 쪽 모양이든 걷어낸다. */
export function boilerMulti(corpora, opts) {
  const merged = new Map();
  for (const texts of corpora || []) {
    for (const [h, set] of buildBoilerplate(texts, opts)) {
      if (!merged.has(h)) merged.set(h, new Set());
      for (const l of set) merged.get(h).add(l);
    }
  }
  return merged;
}
export function makeStripperMulti(corpora, opts) {
  const merged = boilerMulti(corpora, opts);
  return (url, text, stripOpts) => stripBoilerplate(text, merged.get(hostOf(url)), stripOpts);
}
/* 주소 → 그 호스트의 껍데기 줄 Set (모르면 undefined) — 줄 목록을 직접 쓰는 곳(수집기의 기간 힌트 · deadline-hint.mjs hintWithoutChrome)이 쓴다 */
export const boilerFor = (boiler, url) => (boiler && boiler.get(hostOf(url))) || undefined;

/* ── 공고 제목 줄 · 사이트 띠 줄 (2026-11-16 extract-excerpts.mjs 에서 신설 · 2026-11-17 이리 옮김) ──
   발췌기(extract-excerpts)와 자동 등록 앞의 본문 마감(notice-deadline.mjs bodyDeadlineFrom)이 같이 쓴다 — 발췌기는 불러오는 순간 원문 파일을 읽어
   notice-deadline 이 가져다 쓸 수 없었다 — 그래서 자동 등록이 보는 본문 마감은 띠를 걷지 않았다(11-17 실측: 실린 가천 글 9건의 bodyDeadline 이 전부 FGD 띠 줄의 11-18). 이 파일은 읽고 쓰는 것이 없다. */
/* 공고 제목 줄의 자리 — 본문 줄 중 제목 몸통(말머리 뗀 앞 20자)을 담은 첫 줄. 못 찾으면 -1 (제목이 짧으면 찾지 않는다) */
export function titleLineAt(lines, it) {
  const core = String((it && it.name) || '').replace(/^(?:\[[^\]]*\]\s*|공통\s+)+/, '').replace(/\s+/g, '');
  if (core.length < 10) return -1;
  return (lines || []).findIndex((l) => String(l).replace(/\s+/g, '').includes(core.slice(0, 20)));
}
/* ── 사이트 띠(배너) 줄 — 마감 근거에서 뺀다 (2026-11-16 · 가천 FGD 띠 · 리뷰) ─────────────────────────────
   가천 장학공지는 매 쪽 머리에 **다른 글의 띠**(「2026년 가천대학교 재학생 심층면접토론(FGD) 참여학생 모집」 ↵ 「○ 신청기간: 2026.11.05.(목) ~ 11.18.(수)」)를
   싣는다. 그 줄이 글 본문보다 먼저 나와 첫 이름표로 잡혀, 11-11·11-12·11-15·11-16 에 끝나는 네 공고가 모두 11-18 마감이 됐다(닫힌 공고가 열림으로 보였다).
   메뉴 걷기(page-boilerplate · 그 학교 쪽의 40%)는 띠가 26쪽 중 10쪽에만 있어 못 걷었다 — 띠는 몇 주마다 바뀐다.
   🔴 띠 줄 = **같은 호스트의 서로 다른 글 셋 이상**에 글자 그대로 나오는 줄(buildBoilerplate keyOf · 같은 글의 주소 여벌은 한 번)이면서
      **이 글의 제목 줄보다 앞에** 있는 줄. 둘 다여야 한다 — 영남대 다문화·3대 동문·천마가족 세 공고는 진짜로 같은 신청기간 줄을 **제목 뒤에** 싣는다
      (deadline-hint.mjs 의 '같은 힌트 빈도 규칙을 쓰지 말 것' 과 같은 사정). 제목 줄을 못 찾으면 아무것도 걷지 않는다(예전 그대로). */
const SITE_CHROME_MIN = 3;
export const squashWs = (s) => String(s || '').replace(/\s+/g, '');
export function siteChromeFrom(pages) {
  return buildBoilerplate(pages, { minPages: SITE_CHROME_MIN, ratio: 0, keyOf: (v) => squashWs(v.title) || String(v.url || '') });
}
/** 본문에서 제목 앞의 띠 줄을 걷은 글 — `{ text, chrome: [걷은 줄] }`. 띠를 모르거나 제목을 못 찾으면 본문 그대로 */
export function ownBody(body, it, chromeSet) {
  const text = String(body || '');
  if (!chromeSet || !chromeSet.size) return { text, chrome: [] };
  const lines = text.split('\n');
  const at = titleLineAt(lines, it);
  if (at <= 0) return { text, chrome: [] };
  const chrome = [];
  const kept = lines.filter((l, i) => !(i < at && chromeSet.has(l.trim()) && chrome.push(l.trim())));
  return { text: kept.join('\n'), chrome };
}
