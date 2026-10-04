/* 관리자가 넣은 원문(data/link-fixes.json)을 **고치는 로봇이 읽는** 곳 하나 (2026-10-04)
   ─────────────────────────────────────────────────────────────────────────────
   왜 있나: 관리자 화면 「원문 링크」는 바로잡은 원문을 데이터 파일이 아니라 data/link-fixes.json 에 적고,
   앱은 그것을 링크 이름 규칙 한 곳(source-link.js linkFixFor)이 읽는다. 열쇠는 `id:<공고 id>` 또는 `u:<지금 주소>`.
   그런데 링크 사냥꾼·원문 링크 복구가 그 공고의 표식(#n-)을 다른 주소로 바꾸면 `u:<표식>` 열쇠가 더는 안 맞아,
   **관리자가 넣은 주소가 화면에서 소리 없이 사라진다.** 그래서 두 로봇은 사람이 이미 바로잡은 공고를 건너뛴다.
   🔴 판정은 앱과 같은 함수(source-link.js fixKeys·linkFixFor)로 한다 — 앱이 쓰지 않는 바로잡기(목록 꼴 주소·지난 회차)는
      사람 것으로 치지 않는다(그런 공고는 로봇이 계속 찾는 편이 낫다). 베끼면 앱과 로봇이 '바로잡았다'를 다르게 센다.
   🔴 파일이 없거나 깨져 있어도 던지지 않는다 — '사람이 바로잡은 것 없음'으로 본다(로봇 하루치를 파일 하나로 멈추지 않는다).
   쓰는 곳은 tools/admin-apply.mjs 하나다. 여기서는 읽기만 한다. */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const SL = createRequire(import.meta.url)('../source-link.js');

/* 파일 → { fix: {…} } (못 읽으면 빈 장부) */
export function readLinkFixes(fileUrl) {
  try {
    const doc = JSON.parse(fs.readFileSync(fileUrl, 'utf8'));
    const fix = doc && doc.fix;
    return fix && typeof fix === 'object' && !Array.isArray(fix) ? { fix } : { fix: {} };
  } catch {
    return { fix: {} };
  }
}

/* 장부 → (공고) => 관리자가 바로잡은 공고인가.
   source-link.js 는 모듈 안에 장부를 하나 들고 있어(화면용) 부를 때만 넣고 바로 비운다 — 다른 판정에 새지 않게. */
export function humanFixedBy(doc) {
  const fix = (doc && doc.fix) || {};
  if (!Object.keys(fix).length) return () => false;
  return (item) => {
    SL.setLinkFixes({ fix });
    try {
      const f = SL.linkFixFor(item || {});
      return !!(f && f.src === 'admin');
    } finally {
      SL.setLinkFixes(null);
    }
  };
}
