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
import { decodeEntities } from './clean-title.mjs';

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

export default htmlToLines;
