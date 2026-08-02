/* 대기 큐에서 '원본이 실제로 내려온 항목'만 fetched로 표시한다.

   이전에는 deepfetch 직후 큐 전체를 fetched:true로 찍어서, 원본을 못 받은 항목까지
   확보 완료로 기록됐다 — 그 항목은 다시 시도되지 않고 영원히 스키마화 대기에 남았다
   (2026-07-30 발견: 큐 4건 중 3건이 이 상태였음). */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const queuePath = new URL('pending-forms.json', HERE);

let queue;
try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch { process.exit(0); }

let index = '';
try { index = fs.readFileSync(new URL('extracted/forms-index.txt', HERE), 'utf8'); } catch { /* 한 건도 못 받음 */ }

/* 못 받은 항목은 '몇 번째 실패인지'를 센다 (2026-08-02 추가).
   이 숫자가 없으면 원본을 영영 못 받는 공고가 **매 실행 조용히 재시도만 반복**한다 —
   감사는 이걸 경고로만 남기고 실패시키지 않으므로 아무도 모른 채 몇 주가 지날 수 있다.
   (2026-08-01 감사 실패와 같은 계열의 '조용한 정체'. 3회 이상은 스키마화가 리포트에 올린다) */
let marked = 0;
let missed = 0;
for (const item of queue.items || []) {
  if (item.fetched || !item.target) continue;
  if (index.includes(item.target.trim())) {
    item.fetched = true;
    delete item.tries;
    marked++;
  } else {
    item.tries = (item.tries || 0) + 1;
    item.lastTryAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    missed++;
  }
}
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');
console.log(`[mark-fetched] 원본 확보 ${marked}건${missed ? ` · 이번에 못 받음 ${missed}건` : ''}`);
