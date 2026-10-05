/* 공고문 첨부를 받으러 갈 등록 공고 고르기 — deepfetch --elig-attach 가 부른다 (2026-10-05 · 노션 UI-12)
   deepfetch.mjs 는 불러오는 순간 실행돼 관문이 못 부르므로 고르기만 여기 떼어 둔다(순수 함수).

   🔴 왜 고쳤나 — 실측(2026-10-05): 받을 공고 50건 중 본문·첨부가 하나도 없는 학생 화면 공고 27건.
     ① **줄이 안 돌았다.** 등록 순서 앞에서 N건(6 → 30)만 받는데, 받아 와도 자격을 못 읽는 공고(포스터뿐 등)는
        다음 실행에도 맨 앞에 남아 같은 파일을 또 받았다 — 31번째부터는 순서가 영영 안 왔다.
        → 시도한 날(`at`)을 색인에 적고, 안 해 본 것 → 오래전에 해 본 것 순으로, 최근 REST_DAYS 안에 해 본 것은 쉰다.
     ② **자격만 봤다.** 자격은 읽었는데 금액·마감이 빈 공고는 대상이 아니라 그 첨부를 아무도 안 열었다.
     ③ 학생에게 안 보이는 공고(마감 지남·오래됨)는 받지 않는다 — 예산을 살아 있는 공고에 쓴다. */
export const ELIG_REST_DAYS = 3;

const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

/** 아직 원문에서 읽을 것이 남은 공고인가 — 자격·금액·마감 중 하나라도 비었다 */
export function stillMissing(it, requirementLines) {
  const amountKnown = Number(it.amountValue) > 0 || (it.amountSpec && it.amountSpec.kind !== 'unknown');
  return !requirementLines(it).length || !amountKnown || !it.deadline;
}

/**
 * @param items   registered.json items
 * @param index   elig-docs.json — { [id]: { slug, files, at? } }
 * @param today   'YYYY-MM-DD'
 * @param o       { requirementLines, docAtts(it) → 받을 첨부 배열, live(it) → 학생에게 보이나, max }
 * @returns [{ it, atts }] — 받을 차례 순
 */
export function pickEligTargets(items, index, today, o) {
  const cands = [];
  for (const it of items) {
    if (it.program || !o.live(it) || !stillMissing(it, o.requirementLines)) continue;
    const atts = o.docAtts(it);
    if (!atts.length) continue;
    const at = (index[it.id] || {}).at || '';
    if (at && daysBetween(at, today) < ELIG_REST_DAYS) continue;   // 최근에 해 봤다 — 쉰다
    cands.push({ it, atts, at });
  }
  cands.sort((a, b) => (a.at || '').localeCompare(b.at || ''));    // 안 해 본 것('') → 오래된 것
  return cands.slice(0, o.max).map(({ it, atts }) => ({ it, atts }));
}
