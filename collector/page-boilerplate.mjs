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
export function buildBoilerplate(texts, { minPages = 3, ratio = 0.4 } = {}) {
  const stat = new Map();
  for (const v of texts || []) {
    if (!v || !v.text || /^FETCH_/.test(v.text)) continue;
    const h = hostOf(v.url);
    if (!h) continue;
    if (!stat.has(h)) stat.set(h, { pages: 0, freq: new Map() });
    const e = stat.get(h);
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
export function stripBoilerplate(text, boiler) {
  if (!text || !boiler || !boiler.size) return text;
  const all = linesOf(text);
  const kept = all.filter((l) => !boiler.has(l));
  if (kept.length < 3 || kept.join('\n').length < 120) return text;
  return kept.join('\n');
}

/* 편의: 저장된 원문 배열로 '주소 하나를 넣으면 걷어낸 글자를 주는' 함수를 만든다 */
export function makeStripper(texts, opts) {
  const boiler = buildBoilerplate(texts, opts);
  return (url, text) => stripBoilerplate(text, boiler.get(hostOf(url)));
}
