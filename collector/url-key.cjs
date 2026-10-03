/* url-key.mjs(수집기용 ESM)의 규칙을 CommonJS 도구(verify/audit-data.js)에서도 쓰기 위한 다리.
   규칙 본체는 url-key.mjs 한 곳에만 있고, 여기서는 소스를 읽어 그대로 평가한다 —
   두 벌로 베껴 쓰면 언젠가 서로 달라지기 때문.
   🔴 url-key.mjs 가 **다른 모듈을 import 하면** 여기서 터진다(`new Function` 은 import 를 모른다).
      2026-09-12 에 `deadline-hint.mjs` 를 들여오면서 실제로 `audit-data.js` 가 통째로 죽었다.
      그래서 **딸린 모듈도 함께 읽어 앞에 붙인다** — 새 import 를 더하면 여기 목록에도 더할 것.
      (2026-10-03 — `../source-link.js` 를 더했다: 병합 순위의 '목록 주소+번호' 규칙) */
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8')
  .replace(/^export default .*$/m, '')
  .replace(/^import .*$/gm, '')          /* 의존은 아래에서 미리 붙인다 */
  .replace(/^export /gm, '');
/* source-link.js 는 겸용 파일(브라우저·Node)이라 끝의 `module.exports` 가 `typeof module` 로 감싸여 있어
   여기(new Function 안 — module 이 없다)서는 그냥 건너뛴다. 함수 선언만 앞에 붙는다. */
const SOURCE_LINK = fs.readFileSync(path.join(__dirname, '..', 'source-link.js'), 'utf8');
const src = `${SOURCE_LINK}\n${read('deadline-hint.mjs')}\n${read('url-key.mjs')}`;
const factory = new Function(`${src}\nreturn { urlKey, titleKey, preferNotice, dedupeNotices, deadlineHintFrom, looksLikeHint };`);
module.exports = factory();
