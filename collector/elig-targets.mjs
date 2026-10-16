/* 공고문 첨부를 받으러 갈 등록 공고 고르기 — deepfetch --elig-attach 가 부른다 (2026-10-05 · 노션 UI-12)
   deepfetch.mjs 는 불러오는 순간 실행돼 관문이 못 부르므로 고르기만 여기 떼어 둔다(순수 함수).

   🔴 왜 고쳤나 — 실측(2026-10-05): 받을 공고 50건 중 본문·첨부가 하나도 없는 학생 화면 공고 27건.
     ① **줄이 안 돌았다.** 등록 순서 앞에서 N건(6 → 30)만 받는데, 받아 와도 자격을 못 읽는 공고(포스터뿐 등)는
        다음 실행에도 맨 앞에 남아 같은 파일을 또 받았다 — 31번째부터는 순서가 영영 안 왔다.
        → 시도한 날(`at`)을 색인에 적고, 안 해 본 것 → 오래전에 해 본 것 순으로, 최근 REST_DAYS 안에 해 본 것은 쉰다.
     ② **자격만 봤다.** 자격은 읽었는데 금액·마감이 빈 공고는 대상이 아니라 그 첨부를 아무도 안 열었다.
     ③ 학생에게 안 보이는 공고(마감 지남·오래됨)는 받지 않는다 — 예산을 살아 있는 공고에 쓴다. */
export const ELIG_REST_DAYS = 3;

/* 받을 첨부 고르기 **한 곳** — deepfetch 의 자격용·밀린 첨부 두 자리가 같이 쓴다.
   🔴 공고문류(hwp·hwpx·docx·pdf·zip 묶음 · isNoticeDoc)가 **본문 그림보다 먼저**다 (2026-10-17 · 미래에셋 해외교환: 첨부 7개 중 앞 5개가 경희대
      본문 그림이라 상한 2개가 그림으로 차고 「선발 요강.pdf」는 한 번도 받히지 않았다 — 자격은 그 PDF 에만 있었다).
   `images: false` 면 그림은 빼고 공고문류만(밀린 첨부 자리). */
export const DOC_EXT = /\.(hwp|hwpx|docx?|pdf|zip)$/i;
export const IMG_EXT = /\.(png|jpe?g|gif|webp)$/i;
export function pickDocAttachments(atts, { max = 2, images = true, isNoticeDoc } = {}) {
  const all = (atts || []).filter((a) => a && a.url);
  const docs = all.filter((a) => !a.bodyImage && DOC_EXT.test(a.name || '') && isNoticeDoc(a.name));
  const imgs = images ? all.filter((a) => a.bodyImage && IMG_EXT.test(a.name || '')) : [];
  return [...docs, ...imgs].slice(0, max);
}

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

/* 첨부 **밀린 것** 받기 (2026-10-13 · 개발자 "실제 양식을 늘리는 길")
   🔴 왜 — 실측(마감 전 등록 109건): 자격·금액·마감을 다 읽은 공고는 위 고르기의 대상이 아니라 그 첨부를 아무도 안 받았다.
      첨부 목록은 있는데 파일이 없는 마감 전 공고 13건 — 그 안의 신청서 서식·공고문을 앱이 모른다.
   그래서 자격용 대상이 상한에 못 미치면 남는 자리를 **학생에게 보이는데 아직 한 번도 받지 않은 공고**로 채운다.
   받아 둔 글자는 같은 색인(elig-docs.json)에 들어가 발췌·서식 쪽 찾기가 함께 쓴다.
   ⚠️ 한 번 받은 공고는 다시 받지 않는다(색인에 files 가 있으면 끝) — 자격용 줄과 달리 '다시 읽을 것'이 없다.
   ⚠️ `exclude` 에 든 공고(이번에 자격용으로 이미 고른 것)는 뺀다. */
export function pickAttachBacklog(items, index, today, o) {
  const taken = new Set((o.exclude || []).map((t) => (t.it || t).id));
  const cands = [];
  for (const it of items) {
    if (it.program || !o.live(it) || taken.has(it.id)) continue;
    const row = index[it.id];
    if (row && Array.isArray(row.files) && row.files.length) continue;      // 이미 받았다
    const at = (row || {}).at || '';
    if (at && daysBetween(at, today) < ELIG_REST_DAYS) continue;            // 최근에 해 봤는데 못 받았다 — 쉰다
    const atts = o.docAtts(it);
    if (!atts.length) continue;
    cands.push({ it, atts, at });
  }
  cands.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return cands.slice(0, Math.max(0, o.max | 0)).map(({ it, atts }) => ({ it, atts }));
}
