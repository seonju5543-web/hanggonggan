/* 데이터 관문이 실패했을 때, 이번 실행이 '새로 자동 등록한 공고만' 골라서 되돌린다.

   왜 파일 전체를 되돌리지 않는가:
   같은 실행에서 원문 발췌 갱신(extract-excerpts) 같은 정상적인 개선도 함께 일어난다.
   파일을 통째로 되돌리면 멀쩡한 작업까지 버려지고, 다음 실행에서 또 하느라
   같은 일이 매일 반복된다. 그래서 '이번에 새로 들어온 auto:true 항목'만 뺀다.

   실행: node collector/revert-auto.mjs   (워크플로의 감사 실패 시에만 호출) */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const path = 'data/registered.json';
const cur = JSON.parse(fs.readFileSync(path, 'utf8'));

let before;
try {
  before = JSON.parse(execSync(`git show HEAD:${path}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
} catch {
  console.log('직전 버전을 읽지 못해 되돌리지 않았습니다 (수동 확인 필요)');
  process.exit(0);
}

const knownIds = new Set((before.items || []).map((i) => i.id));
const removed = [];
cur.items = (cur.items || []).filter((i) => {
  // 이번 실행에서 새로 들어온 자동 등록분만 대상 — 사람이 등록한 것과 기존 항목은 건드리지 않는다
  if (i.auto && !knownIds.has(i.id)) { removed.push(i); return false; }
  return true;
});

if (!removed.length) {
  console.log('되돌릴 자동 등록분이 없습니다 — 감사 실패는 기존 데이터 쪽 문제입니다(사람 확인 필요)');
  process.exit(0);
}

fs.writeFileSync(path, JSON.stringify(cur, null, 1) + '\n');
console.log(`이번 실행의 자동 등록 ${removed.length}건을 되돌렸습니다:`);
removed.forEach((i) => console.log(`  - ${i.id} | ${(i.name || '').slice(0, 50)}`));
console.log('(수집된 공고 자체는 실시간 피드에 그대로 남아 있습니다)');
