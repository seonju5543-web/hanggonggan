/* 수집 건강 기록(health.json)에서 고아 키를 지운다 (2026-08-09 신설)
   ------------------------------------------------------------------
   무엇이 문제였나:
   `collector/health.json`은 학교 이름을 열쇠로 '마지막 성공일·연속 실패 횟수'를 적는다.
   그런데 **학교 이름이 바뀌면 옛 키가 그대로 남는다.** 2026-08-02에 분교·캠퍼스를 정리하며
   이름에서 캠퍼스를 뺐고(`연세대학교 신촌캠퍼스` → `연세대학교`), 그 순간부터 옛 키 4개가
   `lastOk: 2026-08-02`에 얼어붙었다.

   왜 나쁜가: 사람이 보면 **"이 학교는 8/2 이후 수집이 멈췄다"로 읽힌다.** 실제로는 잘 되고
   있었다(새 이름으로 매일 갱신 중). 이 세션에서 실제로 그렇게 잘못 진단했다 —
   '멈춘 학교 4곳'이라고 보고서에 적었다가 데이터를 다시 세어 보고 바로잡았다.
   **없는 고장을 쫓는 것은 있는 고장을 놓치는 것만큼 비싸다.**

   지우는 기준: 지금 수집 대상 목록(`schools.json` + `browser-targets.json`)에
   ⓐ `학교 캠퍼스` 로도 ⓑ `학교` 로도 걸리지 않는 키.
   ⓑ를 함께 보는 이유: 설정에는 캠퍼스가 '공통'인데 로봇은 학교 이름만으로 적는 경우가 있다
   (중앙·경희·성균관·명지). 그건 살아 있는 기록이므로 지우면 안 된다.
   — 이 두 갈래 판정은 관리자 화면의 `hEntry()`와 같은 규칙이다. 갈라지면 화면과 청소가 어긋난다.

   실행:  node collector/prune-health.mjs           (실제로 지운다)
          node collector/prune-health.mjs --dry     (지울 것만 보여준다)                    */

import fs from 'node:fs';

const HEALTH = 'collector/health.json';
const SCHOOLS = 'collector/schools.json';
const TARGETS = 'collector/browser-targets.json';
const dry = process.argv.includes('--dry');

const read = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } };

const health = read(HEALTH, null);
if (!health || typeof health !== 'object') {
  console.log('health.json을 읽지 못했습니다 — 아무것도 하지 않습니다.');
  process.exit(0);
}

const asArray = (v, key) => (Array.isArray(v) ? v : (v && v[key]) || []);
const schools = asArray(read(SCHOOLS, []), 'schools');
const targets = asArray(read(TARGETS, []), 'targets');

/* 수집 대상이 하나도 안 읽히면 **아무것도 지우지 않는다.**
   설정 파일을 못 읽은 것을 '대상이 없다'로 읽으면 기록을 통째로 날린다. */
if (!schools.length && !targets.length) {
  console.log('수집 대상 목록을 읽지 못했습니다 — 안전을 위해 아무것도 지우지 않습니다.');
  process.exit(0);
}

const live = new Set();
const add = (school, campus) => {
  const s = String(school || '').trim();
  if (!s) return;
  live.add(s);                                   // 학교 이름만으로 적는 로봇을 위해
  const c = String(campus || '').trim();
  if (c) live.add(`${s} ${c}`);
};
schools.forEach((x) => { if (x.boardUrl) add(x.school, x.campus); });
targets.forEach((x) => add(x.school || x.name, x.campus));

const orphans = Object.keys(health).filter((k) => !live.has(k));

console.log(`수집 대상 ${live.size}개 이름 · 건강 기록 ${Object.keys(health).length}개`);
if (!orphans.length) { console.log('고아 기록 없음 — 깨끗합니다.'); process.exit(0); }

console.log(`고아 기록 ${orphans.length}개${dry ? ' (목록만 보기)' : ' — 지웁니다'}:`);
orphans.forEach((k) => console.log(`  · ${k} (마지막 성공 ${health[k].lastOk || '기록 없음'})`));

if (dry) process.exit(0);
orphans.forEach((k) => { delete health[k]; });
fs.writeFileSync(HEALTH, `${JSON.stringify(health, null, 1)}\n`);
console.log(`\n정리 완료 — 건강 기록 ${Object.keys(health).length}개 남음`);
