/* 자격 판정 전수표 — '틀린 ✓'와 '틀린 ✗'를 사람이 찾는 도구 (2026-09-17 · 노션 UI-10)

   왜 만들었나: 기존 도구 둘은 판정이 **원문과 맞는지**를 재지 않는다.
     · eligibility-report — 자격 줄을 '읽었는가'와 자격 자리에 잡음이 섞였는가
     · fit-report          — 학생 한 명 기준으로 미달 사유를 나열
   개발자 지적(2026-09-16): "학생에게 해당하지 않는 지원자격이 충족 표시되거나, 해당함에도
   미충족 표시되는 문제"는 그 둘로는 안 보인다. 그 문제를 보려면 **서로 다른 학생 여럿**으로
   **자격 줄 하나하나**의 ✓·✗ 를 나란히 놓고 사람이 읽어야 한다. 이 도구는 그 표를 만든다.

   🔴 판정을 새로 만들지 않는다 — 화면이 쓰는 `requirementMatch`·`fitDetail` 을 그대로 부른다
      (베끼면 화면과 다른 표가 나온다 — what-shows.mjs 와 같은 원칙).
   🔴 정답은 여기 없다. 정답표는 `verify/fixtures/eligibility-gold.json` 에 사람이 읽고 적으며,
      test-collector 가 그 표로 엔진을 되돌림-검사한다(그게 '예방'이다).

   실행: node verify/verdict-table.mjs               (✓·✗ 가 하나라도 있는 줄만)
         node verify/verdict-table.mjs --all         (모름(·)뿐인 줄까지)
         node verify/verdict-table.mjs --json        (정답표용 JSON)
         node verify/verdict-table.mjs --write-gold  (사람이 표를 읽고 맞다고 본 뒤 정답표를 굳힌다)

   🔴 정답표(verify/fixtures/eligibility-gold.json)는 **읽고 나서** 굳힌다 — 규칙을 고쳤으면
      먼저 표를 다시 뽑아 바뀐 줄이 전부 의도한 것인지 보고, 그다음 --write-gold. 안 읽고
      굳히면 틀린 판정이 정답이 된다. test-collector 가 표와 엔진이 같은지 매번 잰다.
*/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../match-engine.js');
const d = require('../data/registered.json');

const ALL = process.argv.includes('--all');
const JSON_OUT = process.argv.includes('--json');

/* 학생 여섯 — 축마다 갈리도록 골랐다(학교·계열·학년·성적·소득구간·학적·지역·특별자격).
   🔴 이름표(id)는 정답표의 열쇠다 — 바꾸면 정답표가 통째로 안 맞는다. */
export const PROFILES = [
  { id: 'P1', label: '외대 인문 3학년 · 평점 3.5 · 5구간 · 서울', school: '한국외국어대학교', campus: '서울', gpa: 3.5, bracket: 5, year: 3, track: 'humanities', major: '영어학과', flags: [], status: '재학', credits: 15, nationality: 'korean', region: '서울', parentRegion: '서울', birthYear: 2004 },
  { id: 'P2', label: '경희 공학 2학년 · 평점 4.2 · 2구간 · 서울 · 기초수급', school: '경희대학교', campus: '서울', gpa: 4.2, bracket: 2, year: 2, track: 'engineering', major: '컴퓨터공학과', flags: ['basicLiving'], status: '재학', credits: 18, nationality: 'korean', region: '서울', parentRegion: '서울', birthYear: 2005 },
  { id: 'P3', label: '경희 인문 4학년 · 평점 2.8 · 8구간 · 경기', school: '경희대학교', campus: '서울', gpa: 2.8, bracket: 8, year: 4, track: 'humanities', major: '국어국문학과', flags: [], status: '재학', credits: 12, nationality: 'korean', region: '경기', parentRegion: '경기', birthYear: 2003 },
  { id: 'P4', label: '외대 자연 1학년 신입 · 성적 없음 · 4구간 · 부산', school: '한국외국어대학교', campus: '글로벌', gpa: null, bracket: 4, year: 1, track: 'science', major: '환경학과', flags: [], status: '신입학', credits: null, nationality: 'korean', region: '부산', parentRegion: '부산', birthYear: 2007 },
  { id: 'P5', label: '경희 예체능 3학년 · 평점 3.9 · 6구간 · 대구 · 다자녀', school: '경희대학교', campus: '서울', gpa: 3.9, bracket: 6, year: 3, track: 'arts', major: '시각디자인학과', flags: ['multiChild'], status: '재학', credits: 16, nationality: 'korean', region: '대구', parentRegion: '대구', birthYear: 2004 },
  { id: 'P6', label: '외대 사회 2학년 휴학 · 평점 3.2 · 1구간 · 전남 · 장애', school: '한국외국어대학교', campus: '서울', gpa: 3.2, bracket: 1, year: 2, track: 'social', major: '정치외교학과', flags: ['disabled'], status: '휴학', credits: 14, nationality: 'korean', region: '전남', parentRegion: '전남', birthYear: 2005 },
];

const mark = (v) => (v === 'ok' ? '✓' : v === 'no' ? '✗' : '·');

export function verdictRows() {
  const rows = [];
  for (const sch of d.items) {
    if (sch.program) continue;
    const lines = sch.eligibilityLines || [];
    if (!lines.length) continue;
    const items = M.requirementLines(sch, lines, { withMeta: true, all: true });
    const fails = new Map(PROFILES.map((p) => [p.id, new Set(M.fitDetail(sch, p).fails || [])]));
    for (const it of items) {
      const v = {};
      for (const p of PROFILES) v[p.id] = M.requirementMatch(it.text, p, sch) || null;
      rows.push({ id: sch.id, name: sch.name, text: it.text, group: it.group || 0, verdict: v });
    }
    /* 제외 줄은 ✓ 표시가 없다 — fitDetail 의 fails 에 들어갔는지로 본다 */
    for (const ex of (sch.eligibilityExcludes || [])) {
      const v = {};
      for (const p of PROFILES) v[p.id] = fails.get(p.id).has(ex) ? 'no' : null;
      rows.push({ id: sch.id, name: sch.name, text: ex, group: 0, exclude: true, verdict: v });
    }
  }
  return rows;
}

export const GOLD_PATH = new URL('./fixtures/eligibility-gold.json', import.meta.url);
export function goldOf(rows) {
  /* 정답표는 ✓·✗ 가 하나라도 있는 줄만 담는다 — '모름'뿐인 줄은 규칙이 바뀌어 판정이 생기면
     그때 사람이 읽고 더한다(모름을 정답으로 굳히면 판정을 못 하게 되는 후퇴를 관문이 못 본다). */
  return {
    note: '자격 판정 정답표 — verify/verdict-table.mjs --write-gold 로 굳힌다. 사람이 표를 읽은 뒤에만.',
    profiles: PROFILES.map((p) => ({ id: p.id, label: p.label })),
    rows: rows.filter((r) => Object.values(r.verdict).some((v) => v === 'ok' || v === 'no'))
      .map((r) => ({ id: r.id, text: r.text, exclude: !!r.exclude, verdict: r.verdict })),
  };
}

if (process.env.VERDICT_AS_LIB) {
  /* 검사가 함수만 쓴다 — 본편은 돌지 않는다 */
} else if (process.argv.includes('--write-gold')) {
  const fs = await import('node:fs');
  const gold = goldOf(verdictRows());
  fs.writeFileSync(GOLD_PATH, JSON.stringify(gold, null, 1) + '\n');
  console.log(`정답표를 굳혔습니다 — ${gold.rows.length}줄 · verify/fixtures/eligibility-gold.json`);
} else if (JSON_OUT) {
  console.log(JSON.stringify({ profiles: PROFILES.map((p) => p.id), rows: verdictRows() }, null, 1));
} else {
  const rows = verdictRows();
  console.log(`■ 자격 판정 전수표 — 공고 ${new Set(rows.map((r) => r.id)).size}건 · 줄 ${rows.length}개`);
  PROFILES.forEach((p) => console.log(`   ${p.id}: ${p.label}`));
  console.log('   ✓ 충족  ✗ 미달  · 모름(표시 없음)  [제외] 제외 조항\n');
  let cur = '';
  let shown = 0;
  for (const r of rows) {
    const marks = PROFILES.map((p) => mark(r.verdict[p.id])).join(' ');
    if (!ALL && !/[✓✗]/.test(marks)) continue;
    if (r.id !== cur) { cur = r.id; console.log(`\n# ${r.id} — ${String(r.name).slice(0, 60)}`); }
    console.log(`  ${marks}  ${r.exclude ? '[제외] ' : ''}${r.group ? `(택${r.group}) ` : ''}${r.text}`);
    shown += 1;
  }
  console.log(`\n(표시된 줄 ${shown}개)`);
}
