/* ============================================================
   HTML → 줄 글자 — **한 곳** (2026-09-30)
   왜 있나 — 수집 로봇(collect.mjs fetchDetail)이 상세 페이지 글자를 **한 줄로 뭉개서** 발췌기에 넘겼다.
   발췌기(extract-excerpts.mjs eachLabeledValue)는 줄 단위로 읽고 200자 넘는 줄은 문장으로 보고 건너뛰므로,
   2026-09-30 첫 실행에서 활동 글 26건 전부 마감일·발췌가 0건이었다(신청기간 문장은 본문에 있었다).
   deepfetch.mjs·rescue-bodies.mjs 에 같은 변환이 각각 있었다 — 여기 하나로 모았다(베끼지 말고 불러 쓴다).

   규칙: <br>·문단·표 행·목록·제목 닫힘은 줄바꿈 · 스크립트·스타일은 버린다 · HTML 기호는 글자로 되돌린다
   (clean-title.mjs decodeEntities — `&nbsp;` 가 남으면 이름표 `신청기간&nbsp;:` 를 못 알아본다) · 줄 안 공백은 하나로 · 빈 줄은 뺀다.
   관문: verify/test-collector.mjs 「대외활동·공모전」 ⑥ (뭉갠 글자로는 아무것도 못 읽고, 이 함수를 거치면 읽는다).
   ============================================================ */
import { decodeEntities, cleanTitle } from './clean-title.mjs';
import { normTitle } from './notice-source.mjs';

export function htmlToLines(html) {
  return decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|td|th|dd|dt|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\u00a0　]+/g, ' ')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

/* ── 브라우저가 그린 상세 화면 → 본문 장부(extracted/browser-bodies.json) 한 칸 (2026-10-04 점검 B7) ──
   브라우저 수집기(browser-collect.mjs)의 두 길이 같은 함수를 쓴다:
     · 상세 방문 — 예전엔 글자를 **한 줄로 뭉개** 저장했다(본문 169건 중 93건이 한 줄) → 발췌기가 200자 넘는 줄을 문장으로 보고 건너뛴다(위 머리말).
     · 클릭형 게시판(행에 주소가 없어 눌러서 여는 곳 — 고려·부산·가천…) — 상세 화면을 열어 마감·첨부만 뽑고 글자는 버려,
       그 학교들의 본문이 한 번도 저장되지 않았다(0건). 남의 글을 본문으로 붙이지 않게 clickBodyEntry 가 세 가지를 본다. */
/** 줄을 살린 본문 한 칸 — 한글 120자 미만이면 본문으로 치지 않는다(null) */
export function browserBodyEntry({ title, html, at, via = 'browser' }) {
  const text = htmlToLines(html);
  if (text.replace(/[^가-힣]/g, '').length < 120) return null;
  return { title, text: text.slice(0, 15000), at, via };
}
/* 제목이 그 화면에 있나 — 가운데 16자로 본다(앞의 분류 낱말 `장학`·꼬리가 화면 제목과 달라도 맞게). 10자보다 짧으면 못 가린다('') */
const titleKey = (t) => {
  const n = normTitle(cleanTitle(t));
  if (n.length < 10) return '';
  const at = Math.max(0, Math.floor((n.length - 16) / 2));
  return n.slice(at, at + 16);
};
/** 클릭으로 연 상세 화면을 이 행의 본문으로 남겨도 되나 — ① 상세가 실제로 열렸다(새 창 · 주소가 바뀜 · 화면이 바뀜)
    ② 이 행 제목이 화면에 있다 ③ 다른 행 제목이 셋 이상 보이지 않는다(= 아직 목록 화면이 아니다 · 이전글·다음글 둘은 괜찮다).
    셋 중 하나라도 아니면 null — 남의 글을 본문으로 붙이는 것이 못 받는 것보다 나쁘다. */
export function clickBodyEntry({ title, html, otherTitles = [], opened, at }) {
  if (!opened || !html) return null;
  const flat = normTitle(htmlToLines(html));
  const own = titleKey(title);
  if (!own || !flat.includes(own)) return null;
  const seen = new Set(otherTitles.map(titleKey).filter((k) => k && k !== own && flat.includes(k)));
  if (seen.size >= 3) return null;
  return browserBodyEntry({ title: cleanTitle(title), html, at });
}

export default htmlToLines;
