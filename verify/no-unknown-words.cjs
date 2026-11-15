/* 학생 화면에 나오면 안 되는 '모름'류 글자 — 한 곳 (2026-11-15 · 개발자 결정 11-02 "'모름' 같은 말이 보이면 앱 신뢰가 떨어진다")
   쓰는 곳: 관문 test-collector 「학생 화면에 '모름'류 글자가 없다」(표본 + app.js·index.html·match-engine.js 글자 훑기) ·
   브라우저 전수 verify/verify-no-unknown.js(실데이터). 낱말을 베껴 적지 말고 이것을 불러 쓴다. */
const UNKNOWN_WORDS = ['모름', '미확인', '원문 확인', '원문에서 확인', '확인 필요', '확인필요', '기한 확인 중', '정보 입력 필요'];
/* 글자 하나에서 몇 번 나오는가 — 「?」 판정 표시(줄 맨 앞 「? 」)도 센다 */
function unknownHits(text) {
  const t = String(text || '');
  const h = {};
  for (const w of UNKNOWN_WORDS) { const n = t.split(w).length - 1; if (n) h[w] = n; }
  const q = (t.match(/(^|\n|>)\s*\?\s/g) || []).length;
  if (q) h['?'] = q;
  return h;
}
module.exports = { UNKNOWN_WORDS, unknownHits };
