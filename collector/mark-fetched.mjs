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

let marked = 0;
for (const item of queue.items || []) {
  if (item.fetched || !item.target) continue;
  if (index.includes(item.target.trim())) { item.fetched = true; marked++; }
}
fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');
console.log(`[mark-fetched] 원본 확보 ${marked}건`);
