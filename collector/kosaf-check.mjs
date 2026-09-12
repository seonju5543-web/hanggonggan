/* 한국장학재단 수확 관문 (2026-08-30 신설 — 저장 직전에 선다)
   ─────────────────────────────────────────────────────────────────────────
   🔴 이 로봇이 조용히 망가지는 길은 셋이고, 셋 다 **초록불로 보인다**:
     ① KOSAF 화면 구조가 바뀌어 목록 파싱이 깨진다 → 재단 수가 뚝 떨어진다
     ② 상세를 이어받지 못해 애써 모은 자격 20칸이 사라진다 → 새로 받은 몇 건만 남는다
     ③ 앱이 받는 파일이 비거나, 대출·마감 지난 것이 섞인다
   여기서 걸리면 워크플로가 **저장을 건너뛴다** — 이미 올라가 있는 멀쩡한 데이터가 이긴다.

   실행: node collector/kosaf-check.mjs   (실패하면 exit 1) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) console.log(`  ✓ ${label}`);
  else { fail += 1; console.log(`  ✕ ${label}${extra ? ` — ${extra}` : ''}`); }
};

const read = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url), 'utf8'));
const full = read('kosaf.json');
const open = read('kosaf-open.json');
const today = new Date().toISOString().slice(0, 10);

console.log('■ 목록을 제대로 받았나');
/* 실측 1,868곳. 화면 구조가 바뀌어 파싱이 깨지면 이 숫자가 뚝 떨어진다.
   ⚠️ 정확한 수를 박지 않는다 — 재단은 실제로 늘고 준다. 무너졌는지만 본다. */
ok(`재단 목록이 무너지지 않았다 (${full.count}곳)`, full.count >= 1000, `1,000곳 미만`);
ok('목록 항목에 이름·기관이 들어 있다',
  (full.items || []).slice(0, 50).every((i) => i.org && i.name));

console.log('\n■ 상세(자격 20칸)를 잃지 않았나');
/* 🔴 여기서 걸린 실제 사고: 목록은 매 실행 새로 받고 상세는 일부만 받으므로,
   이어받기를 빼면 205건이 2건이 된다(2026-08-30에 실측). 지난 회차 재단은 다시
   안 받으므로 한 번 잃으면 영영 못 되찾는다. */
const nowDetail = (full.items || []).filter((i) => i.detail).length;
let prevDetail = null;
try {
  const prev = JSON.parse(execFileSync('git', ['show', 'HEAD:data/kosaf.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  prevDetail = (prev.items || []).filter((i) => i.detail).length;
} catch { /* 처음 커밋 등 — 비교할 것이 없으면 건너뛴다 */ }
if (prevDetail === null) console.log('  · 비교할 이전 판이 없어 건너뜁니다');
else ok(`상세가 줄지 않았다 (${prevDetail} → ${nowDetail})`, nowDetail >= prevDetail,
  '이어받기(prevDetail)가 끊긴 것부터 의심하세요');

console.log('\n■ 앱이 받는 파일(층2)');
ok(`비어 있지 않다 (${open.count}곳)`, open.count > 0);
/* 갚아야 하는 돈을 '받을 수 있는 장학금'에 넣는 것은 기망이다 (운영 원칙 2) */
ok('대여(대출)가 섞이지 않았다',
  open.items.every((i) => !/연\s?이율|상환기간|대여한도|대부/.test(i.fields['지원금액'] || '')));
ok('마감이 지난 재단이 없다',
  open.items.every((i) => !i.due || i.due >= today));
/* 🔴 콜론 빠진 주소를 그냥 넘기면 앱의 safeUrl 이 **우리 사이트 안 경로**로 푼다 */
ok('주소가 전부 http(s) 다', open.items.every((i) => !i.home || /^https?:\/\//.test(i.home)));
/* 🔴 KOSAF 첨부는 Referer 검사가 있어 앱에서 누르면 "비정상적인 접근"이 뜬다 */
ok('KOSAF 첨부 내려받기 주소가 담기지 않았다',
  !/kosaf\.go\.kr[^"]*(download|fileDown|atchFile)/i.test(JSON.stringify(open.items)));
/* 마감일을 모르는 것도 담기지만, 그때는 신청기간 원문이 반드시 있어야 한다
   (없으면 학생이 언제 신청하는지 알 길이 아예 없다) */
ok('마감일을 모르는 재단은 신청기간 원문을 갖고 있다',
  open.items.filter((i) => !i.due).every((i) => (i.fields['신청기간'] || '').trim()));

/* ── 선발공고문 사본 (2026-09-12 — collector/kosaf-attach.mjs) ──────────────────
   🔴 층2가 학생에게 주던 것은 오랫동안 **재단 홈페이지 주소 하나**뿐이었다.
      사본이 그 구조를 고치는 유일한 물건이라, 조용히 사라지는 길을 여기서 막는다.
      (①·②는 학생 화면이 바로 깨지는 것, ③은 서서히 비는 것 — 층2 자체와 같은 유형이다.) */
console.log('\n■ 선발공고문 사본 (층2의 유일한 공고 원문)');
/* 🔴 **이 기능이 망가지는 길은 「조용한 0건」이다** (2026-09-12 코드 리뷰에서 실제로 잡혔다).
   상세 파서가 엉뚱한 칸을 집으면 첨부 링크가 0건이 되는데, 그러면 아래 검사 셋이 전부
   **빈 목록을 상대로** 통과한다(초록불). 그래서 '몇 곳이 [다운로드] 를 갖고 있다고
   적혀 있나'와 '몇 곳에서 실제로 링크를 읽었나'를 나란히 본다. */
const labelled = (full.items || []).filter((i) => /다운로드/.test(((i.detail || {})['선발공고문']) || '')).length;
const linked = (full.items || []).filter((i) => (i.files || []).length).length;
let prevLinked = null;
try {
  const prev = JSON.parse(execFileSync('git', ['show', 'HEAD:data/kosaf.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  prevLinked = (prev.items || []).filter((i) => (i.files || []).length).length;
} catch { /* 처음 커밋 등 */ }
if (labelled >= 50 && linked === 0) {
  /* 한 번이라도 읽은 적이 있으면 이건 **퇴행**이다 — 막는다.
     한 번도 없었으면(처음 붙이는 중) 막지 않되 눈에 띄게 알린다. 층2 목록 갱신은
     본업이고 첨부는 보강이라, 보강이 안 됐다고 본업까지 세우지 않는다. */
  if (prevLinked) ok(`첨부 링크가 통째로 사라지지 않았다 (${prevLinked} → 0곳)`, false, '상세 파서가 엉뚱한 칸을 집는 것부터 의심하세요');
  else console.log(`  ::warning::[다운로드] 가 적힌 재단이 ${labelled}곳인데 링크를 한 건도 못 읽었습니다 — 상세 파서(parseFiles)를 보세요`);
} else {
  ok(`첨부 링크를 읽고 있다 (${labelled}곳 중 ${linked}곳)`, labelled === 0 || linked > 0);
}
const mirrored = open.items.filter((i) => (i.files || []).length);
const allFiles = mirrored.flatMap((i) => i.files);
/* ① 앱이 여는 것은 **우리 쪽 경로**뿐이다 — KOSAF 원주소는 Referer 검사라 학생이 못 받는다 */
ok('사본 경로가 전부 data/kosaf-files/ 다',
  allFiles.every((f) => /^data\/kosaf-files\/[^./][^/]*\/[^/]+$/.test(f.path || '')),
  allFiles.map((f) => f.path).filter((p) => !/^data\/kosaf-files\/[^./][^/]*\/[^/]+$/.test(p || '')).slice(0, 3).join(' · '));
/* ② 장부에만 있고 디스크에 없는 파일은 **학생 화면의 죽은 링크**다 */
/* 경로는 path 로 다룬다 — URL 로 다루면 이름 속 `%`·`#` 에서 깨진다(kosaf-attach 머리말) */
const REPO = fileURLToPath(new URL('../', import.meta.url));
const missing = allFiles.filter((f) => !fs.existsSync(path.join(REPO, f.path)));
ok(`적어 둔 사본이 실제로 있다 (${allFiles.length}개)`, missing.length === 0,
  missing.map((f) => f.path).slice(0, 3).join(' · '));
/* ③ 이어받기가 끊기면 애써 받아 둔 사본이 한 실행에 통째로 사라진다(상세 20칸과 같은 유형) */
let prevMirrored = null;
try {
  const prev = JSON.parse(execFileSync('git', ['show', 'HEAD:data/kosaf-open.json'], { encoding: 'utf8', maxBuffer: 64 << 20 }));
  prevMirrored = (prev.items || []).filter((i) => (i.files || []).length).length;
} catch { /* 처음 커밋 등 */ }
if (prevMirrored === null) console.log('  · 비교할 이전 판이 없어 건너뜁니다');
else {
  /* 마감으로 빠지는 재단이 있으니 '한 건도 줄면 안 된다'로는 못 본다. **반토막**을 본다. */
  ok(`공고문을 가진 재단이 반토막 나지 않았다 (${prevMirrored} → ${mirrored.length}곳)`,
    mirrored.length * 2 >= prevMirrored, '이어받기(mirror)가 끊긴 것부터 의심하세요');
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 저장하지 않습니다` : '\n✓ 한국장학재단 수확 관문 통과');
process.exit(fail ? 1 : 0);
