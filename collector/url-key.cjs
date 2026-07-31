/* url-key.mjs(수집기용 ESM)의 규칙을 CommonJS 도구(verify/audit-data.js)에서도 쓰기 위한 다리.
   규칙 본체는 url-key.mjs 한 곳에만 있고, 여기서는 소스를 읽어 그대로 평가한다 —
   두 벌로 베껴 쓰면 언젠가 서로 달라지기 때문. */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'url-key.mjs'), 'utf8')
  .replace(/^export default .*$/m, '')
  .replace(/^export /gm, '');
const factory = new Function(`${src}\nreturn { urlKey, titleKey, preferNotice, dedupeNotices };`);
module.exports = factory();
