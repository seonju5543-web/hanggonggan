/* 공고문 첨부를 받으러 갈 등록 공고 고르기 — deepfetch --elig-attach 가 부른다 (2026-10-05 · 노션 UI-12)
   deepfetch.mjs 는 불러오는 순간 실행돼 관문이 못 부르므로 고르기만 여기 떼어 둔다(순수 함수).

   🔴 왜 고쳤나 — 실측(2026-10-05): 받을 공고 50건 중 본문·첨부가 하나도 없는 학생 화면 공고 27건.
     ① **줄이 안 돌았다.** 등록 순서 앞에서 N건(6 → 30)만 받는데, 받아 와도 자격을 못 읽는 공고(포스터뿐 등)는
        다음 실행에도 맨 앞에 남아 같은 파일을 또 받았다 — 31번째부터는 순서가 영영 안 왔다.
        → 시도한 날(`at`)을 색인에 적고, 안 해 본 것 → 오래전에 해 본 것 순으로, 최근 REST_DAYS 안에 해 본 것은 쉰다.
     ② **자격만 봤다.** 자격은 읽었는데 금액·마감이 빈 공고는 대상이 아니라 그 첨부를 아무도 안 열었다.
     ③ 학생에게 안 보이는 공고(마감 지남·오래됨)는 받지 않는다 — 예산을 살아 있는 공고에 쓴다. */
import { looksChrome } from './news-thumb.mjs';
export const ELIG_REST_DAYS = 3;

/* 받을 첨부 고르기 **한 곳** — deepfetch 의 자격용·밀린 첨부 두 자리가 같이 쓴다.
   🔴 공고문류(hwp·hwpx·docx·pdf·zip 묶음 · isNoticeDoc)가 **본문 그림보다 먼저**다 (2026-10-17 · 미래에셋 해외교환: 첨부 7개 중 앞 5개가 경희대
      본문 그림이라 상한 2개가 그림으로 차고 「선발 요강.pdf」는 한 번도 받히지 않았다 — 자격은 그 PDF 에만 있었다).
   `images: false` 면 그림은 빼고 공고문류만(밀린 첨부 자리). `repeated` 는 repeatedBodyImages() 가 준 공통 그림 주소 표(아래). */
export const DOC_EXT = /\.(hwp|hwpx|docx?|pdf|zip)$/i;
export const IMG_EXT = /\.(png|jpe?g|gif|webp)$/i;
export function pickDocAttachments(atts, { max = 2, images = true, isNoticeDoc, repeated } = {}) {
  const all = (atts || []).filter((a) => a && a.url);
  const docs = all.filter((a) => !a.bodyImage && DOC_EXT.test(a.name || '') && isNoticeDoc(a.name));
  const imgs = images ? all.filter((a) => a.bodyImage && IMG_EXT.test(a.name || '') && !isDecorativeImage(a, repeated)) : [];
  return [...docs, ...imgs].slice(0, max);
}

/* 🔴 본문 그림 가운데 **사이트 장식**은 받지 않는다 (2026-10-29 · 10-28 유료 자격 읽기 전수 #40754157899: 보낸 포스터 20장 중 9장이 웹 접근성 인증 마크(WA)·
   인스타그램 로고·챗봇 캐릭터·공원 풍경 띠 배너·기념 엠블럼이라 모델이 "공고문 내용이 없다"고 거절했고 장당 돈만 나갔다).
   재수집 로봇(rescue-bodies)은 300px 넘는 <img> 를 전부 `본문이미지-WxH` 로 적으므로 **받기 전 여기서** 가른다 — 판정 한 곳.
     ① 이름이 로고·아이콘·SNS 단추·접근성 마크·챗봇 꼴 — news-thumb looksChrome **한 곳**(베끼지 않는다 · 그쪽 낱말 표에 wa·webacc·footer 등을 더했다)
     ② 가로가 세로의 WIDE_RATIO 배 넘는 띠 — 이름의 WxH 로 잰다(받기 전이라 파일이 없다). 세로로 긴 웹 포스터(1190×5052)·가로 포스터(1192×808 · 실제로 8줄 읽었다)·
        정사각 카드뉴스(1024×1028)는 안 걸린다.
     ③ 같은 게시판(공고 주소의 호스트)의 두 공고 이상에 같은 그림 주소 — news-thumb 「두 글 이상에 같은 그림 = 그 학교의 공통 그림」과 같은 원리(repeatedBodyImages).
        충북대 챗봇 마스코트(ai_woowang_glass_new_nova.png)처럼 이름으로는 못 가르는 것을 잡는다. 다른 학교 둘이 재단 포스터 한 장을 끌어 쓴 것은 공통 그림이 아니다. */
export const WIDE_RATIO = 2.5;   // ponytail: 실측 123장 — 장식 띠 1800×700(2.57)·1920×300(6.4) / 진짜 가로 포스터는 1192×808(1.5)까지 · 2.5 넘는 진짜 포스터가 보이면 올린다
export function isDecorativeImage(a, repeated) {
  if (!a || !a.url) return false;
  if (repeated && repeated.has(a.url)) return true;
  if (looksChrome(a.url)) return true;
  const m = String(a.name || '').match(/(\d{2,5})x(\d{2,5})/);
  return !!(m && Number(m[1]) > Number(m[2]) * WIDE_RATIO);
}
/** registered.json items → 같은 게시판의 두 공고 이상에 적힌 본문 그림 주소 Set. 등록분에 학교 칸이 없어 공고 주소(sourceUrl)의 호스트로 묶는다 */
export function repeatedBodyImages(items) {
  const seen = new Map();   // '호스트 그림주소' → Set(공고 id)
  for (const it of items || []) {
    let site = String((it && it.school) || '');
    try { site = new URL(it.sourceUrl || it.url).host; } catch { /* 주소 없는 등록분은 학교 칸으로 */ }
    for (const a of (it && it.attachments) || []) {
      if (!a || !a.bodyImage || !a.url) continue;
      const k = `${site} ${a.url}`;
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(it.id);
    }
  }
  const out = new Set();
  for (const [k, ids] of seen) if (ids.size >= 2) out.add(k.slice(k.indexOf(' ') + 1));
  return out;
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
