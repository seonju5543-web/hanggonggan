/* 「로봇·도구 점검 관문」 gate 묶음 — 데이터 관문 · 되돌리기 구조 (2026-10-04 대대적 점검)
   잰다:
     ① 학사·석사 나란히 적은 줄 — DAAD `… 학사 및 석사과정 학생` 이 학부생에게 '지원 자격 미달'로 보였다(틀린 미달).
        고치면서 'both' 갈래에 남는 글자 잣대를 같이 넣었다(안 넣으면 독일어 요건을 묻지도 않고 95% = 틀린 안심).
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default async function gate(eq) {
  /* ── ① 학사·석사 나란히 적은 줄 ── */
  {
    const PR = require('../../parse-requirements.js');
    const ME = require('../../match-engine.js');
    const DAAD = '유럽언어기준 B1 이상의 독일어 능력을 보유한 학사 및 석사과정 학생';
    const lines = [DAAD, '학사 또는 석사과정 재학생', '학사, 석사ㆍ박사과정에 재학 중인 학생',
      '학사 및 석사 학위 소지자', '학사 학위 소지자로서 대학원 진학 예정자', '국내 대학원 석사과정 재학생'];
    eq('① 학사를 석사와 나란히 적은 과정 이름은 학부도 받는다 (`및`·`또는`·`,` · 학위 소지자·대학원 과정은 아님)',
      lines.map((l) => PR.mentionsUndergrad(l)), [true, true, true, false, false, false]);
    const prof = { school: '한국항공대학교', campus: '', track: 'humanities', major: '영어학과', year: 3, status: '재학',
      gpa: 3.2, bracket: 6, credits: 14, region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {} };
    const d = ME.fitDetail({ id: 't', name: 't', eligibilityLines: [DAAD], eligibility: {} }, prof);
    eq('① DAAD 줄은 학부 3학년에게 미달도 ✓ 도 아니다 — [미달 수, 자격 미확인] (독일어 요건을 묻지 않았다)',
      [(d.fails || []).length, !!d.unread], [0, true]);
    const both = (t) => PR.parseLine(t, false).conds.filter((c) => c.kind === 'degree').map((c) => c.want);
    eq('① 학위 이야기뿐인 줄은 여전히 학부·대학원 둘 다 ✓ (잣대가 ✓ 길을 죽이지 않았다)',
      [both('대학생 및 대학원 재학생'), both('대학생 또는 대학원 학·석·박사 과정 재학생')], [['both'], ['both']]);
  }
}
