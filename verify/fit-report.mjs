/* 적합도 전수 리포트 — 특히 **0% 판정이 맞는지** 사람이 눈으로 확인하는 도구 (2026-08-24)
   설계: docs/designs/fit-score.md
   0%는 학생에게서 장학금을 뺏는 판정이라, 오탐이 1건이라도 나오면 그 규칙의 확신을 낮춘다.
   실행: node verify/fit-report.mjs [--zero]  */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../match-engine.js');
const d = require('../data/registered.json');

const ZERO = process.argv.includes('--zero');
/* 대표 학생 — 아주 평범한 프로필로 잡는다(극단값이면 0%가 과하게 나온다) */
const p = { school: '한국외국어대학교', gpa: 3.5, bracket: 5, year: 3, track: '인문', flags: [],
            status: '재학', credits: 15, nationality: 'korean', region: '서울', parentRegion: '서울', birthYear: 2004 };

const rows = d.items.map((s) => ({ s, f: M.fitDetail(s, p) }));
const bucket = {};
for (const { f } of rows) { const k = f.unread ? '자격 미확인' : f.pct === 0 ? '0% (미달)' : `${f.pct}%`; bucket[k] = (bucket[k] || 0) + 1; }
console.log(`■ 적합도 분포 — 등록 ${d.items.length}건 (기준 학생: 외대 3학년·평점 3.5·5구간·재학)`);
Object.entries(bucket).sort((a, b) => (parseInt(b[0]) || -1) - (parseInt(a[0]) || -1))
  .forEach(([k, n]) => console.log(`   ${k.padStart(12)} : ${n}건`));

const zeros = rows.filter((r) => !r.f.unread && r.f.pct === 0);
console.log(`\n■ 0% 판정 ${zeros.length}건 — 사유가 원문과 맞는지 확인할 것`);
for (const { s, f } of zeros) {
  console.log(`\n  ✕ ${s.id} | ${(s.name || '').slice(0, 46)}`);
  f.fails.forEach((l) => console.log(`      사유: ${l.slice(0, 88)}`));
  if (ZERO) (s.eligibilityLines || []).forEach((l) => console.log(`      원문| ${l.slice(0, 88)}`));
}
/* 사유를 못 쓰는 0%는 파싱이 틀렸다는 뜻이다 — 설계에 못박아 둔 규칙 */
const mute = zeros.filter((r) => !r.f.fails.length);
if (mute.length) { console.log(`\n🚨 사유 없는 0%가 ${mute.length}건 — 설계 위반입니다`); process.exit(1); }
