/* 한국장학재단 수확 관문 (2026-08-30 신설 — 저장 직전에 선다)
   ─────────────────────────────────────────────────────────────────────────
   🔴 이 로봇이 조용히 망가지는 길은 셋이고, 셋 다 **초록불로 보인다**:
     ① KOSAF 화면 구조가 바뀌어 목록 파싱이 깨진다 → 재단 수가 뚝 떨어진다
     ② 상세를 이어받지 못해 애써 모은 자격 20칸이 사라진다 → 새로 받은 몇 건만 남는다
     ③ 앱이 받는 파일이 비거나, 대출·마감 지난 것이 섞인다
   여기서 걸리면 워크플로가 **저장을 건너뛴다** — 이미 올라가 있는 멀쩡한 데이터가 이긴다.

   실행: node collector/kosaf-check.mjs   (실패하면 exit 1) */
import fs from 'node:fs';
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

console.log(fail ? `\n✕ 실패 ${fail}건 — 저장하지 않습니다` : '\n✓ 한국장학재단 수확 관문 통과');
process.exit(fail ? 1 : 0);
