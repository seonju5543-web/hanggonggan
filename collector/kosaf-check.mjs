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
/* 🔴 '비었나'를 여기서 새로 판정하지 않는다 — 로봇과 **같은 함수**를 쓴다.
   베끼면 "로봇은 내렸는데 관문은 못 보는" 갈라짐이 생긴다. */
import { emptyVerdict, readChars } from './kosaf-empty.mjs';
import { loadBlock, blockKey } from './kosaf-open.mjs';

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

/* ── 속이 빈 공고문 (2026-09-13 — collector/kosaf-empty.mjs · kosaf-block.json) ──
   🔴 재단 일부가 '선발공고문' 자리에 **속이 빈 파일**을 올려 둔다(`공고문 없음.hwp`).
      학생이 층2의 유일한 공고 원문을 눌러 빈 문서를 받는 것은 안내가 아니라 헛걸음이다.
   🔴 여기서 '못 읽음'(스캔 PDF·포스터 JPG 10건)은 **비었다고 하지 않는다** — 학생은
      그림으로 읽는다. 판정은 emptyVerdict 한 곳에 있다. */
console.log('\n■ 속이 빈 공고문을 학생에게 주지 않는다');
const block = loadBlock();
const hiddenFiles = (block.hidden || []).filter((b) => b.file);
/* 🔴 **분모를 먼저 본다** — 첨부가 0건이면 아래 검사가 빈 목록을 상대로 조용히 통과한다
   (2026-09-12 '조용한 0건' 함정과 같은 자리). */
ok(`판정할 첨부가 있다 (앱 파일 ${allFiles.length}개 + 내려 둔 ${hiddenFiles.length}개)`,
  allFiles.length + hiddenFiles.length > 0, '첨부가 통째로 0건입니다 — 상세 파서부터 보세요');
/* 🔴 사람이 '자동 판정이 틀렸다'고 되살린 것(keep)은 여기서 빼고 센다.
   안 빼면 되살리기를 누르는 순간 이 관문이 **영영 빨간불**이 되어, 그날부터 층2
   수확이 통째로 저장되지 않는다(관문이 사람의 결정을 이겨 버린다). 이 관문이 잡는 것은
   '로봇이 거르지 못했다'이지 '사람이 틀렸다'가 아니다. */
const keptKeys = new Set((block.keep || []).map((b) => blockKey(b.code, b.file)));
const stillEmpty = mirrored.flatMap((i) => (i.files || [])
  .filter((f) => !keptKeys.has(blockKey(i.code, f.name)))
  .map((f) => ({ org: i.org, name: f.name, ...emptyVerdict({ name: f.name, chars: readChars(REPO, f.path) }) }))
  .filter((v) => v.empty));
ok(`앱 파일에 빈 공고문이 없다 (${allFiles.length}개 중 0개 · 사람이 되살린 ${keptKeys.size}개 제외)`,
  stillEmpty.length === 0,
  stillEmpty.slice(0, 3).map((v) => `${v.org} / ${v.name} — ${v.why}`).join(' · '));
/* 내린 것이 첨부의 3분의 1을 넘으면 판정이 망가진 것이다(글자 뽑기가 통째로 실패한 날 등) */
const total = allFiles.length + hiddenFiles.length;
ok(`내린 공고문이 지나치게 많지 않다 (${hiddenFiles.length}/${total}개)`,
  hiddenFiles.length * 3 <= total, '글자 뽑기 단계가 통째로 실패한 것부터 의심하세요');
/* 장부는 사람이 읽는 것이다 — '왜 내렸나'와 '누가 언제'가 없으면 되살릴 판단을 못 한다 */
const badRows = (block.hidden || []).concat(block.keep || [])
  .filter((b) => !(b.code && b.why && b.at && b.by));
ok('장부의 모든 줄에 코드·사유·날짜·주체가 있다', badRows.length === 0,
  badRows.slice(0, 3).map((b) => JSON.stringify(b)).join(' · '));
/* 🔴 로봇 기록장과 같은 모양(들여쓰기 1칸)이어야 한다 — 다르면 파일 전체가 충돌한다 */
{
  const raw = fs.readFileSync(path.join(REPO, 'collector', 'kosaf-block.json'), 'utf8');
  ok('장부가 들여쓰기 1칸으로 저장돼 있다', raw === `${JSON.stringify(JSON.parse(raw), null, 1)}\n`);
}
/* 같은 첨부를 hidden 과 keep 에 동시에 적어 두면 사람이 장부를 읽고도 결과를 못 맞힌다
   (규칙은 'keep 이 이긴다' — 그 규칙은 살리되, 이 상태를 오래 두지 않게 알린다) */
{
  const both = (block.hidden || []).filter((b) => keptKeys.has(blockKey(b.code, b.file)));
  ok('같은 첨부가 내림·되살림에 동시에 적혀 있지 않다', both.length === 0,
    both.map((b) => `${b.org || b.code} / ${b.file}`).join(' · '));
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 저장하지 않습니다` : '\n✓ 한국장학재단 수확 관문 통과');
process.exit(fail ? 1 : 0);
