/* 양식 원본을 아직 못 받은 대기 항목의 '표적'(제목 앞부분)을 쉼표로 이어 출력한다.
   수집 워크플로가 이 값을 FORM_TARGETS로 넘겨 deepfetch --forms-only 를 돌린다.

   워크플로 안에 node -e 한 줄로 박혀 있던 것을 파일로 옮긴 것이다(2026-08-04).
   ① 로봇 2종(일반·브라우저)이 같은 규칙을 쓰게 하고
   ② retired(더 못 받는다고 판정된 항목)를 빼는 규칙을 한 곳에서만 고치면 되게 하려고.

   출력이 비면 워크플로는 원본 확보 단계를 통째로 건너뛴다. */
import fs from 'node:fs';

let queue = { items: [] };
try {
  queue = JSON.parse(fs.readFileSync(new URL('pending-forms.json', import.meta.url), 'utf8'));
} catch { /* 큐가 없으면 받을 것도 없다 */ }

const targets = (queue.items || [])
  .filter((i) => !i.fetched && !i.retired && i.target)
  .map((i) => i.target.trim())
  .filter(Boolean);

console.log([...new Set(targets)].join(','));
