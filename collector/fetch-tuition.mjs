/* ============================================================
   학교별 등록금 받아오기 (2026-08-27 신설)

   왜 필요한가:
     등록 공고 중 15건이 금액을 `수업료 100%`·`등록금의 50%` 처럼 **등록금 비율**로만
     적는다. 학생 등록금을 모르면 원으로 바꿀 수 없어 영영 0원으로 남는다.
     그런데 이 15건이 홈 합계의 32%를 차지한다 — 빼 두면 합계가 크게 축소된다.

   어디서 받나 (2026-08-27 실측으로 확인한 것만 적는다):
     ✅ 학교 평균  — 공공데이터포털 `전국대학별평균등록금정보` 표준데이터
                     https://api.data.go.kr/openapi/tn_pubr_public_univ_reg_amt_api
                     (한국장학재단 공시연계 · 살아 있음. 키 없이 부르면
                      `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 가 온다)
     ❔ 학교 × 계열 — 대학알리미가 계열별 등록금을 공시하지만 **오픈API 오퍼레이션명을
                     찾지 못했다.** `openapi.academyinfo.go.kr` 은 살아 있고
                     BasicInformationService·SchoolMajorInfoService 는 응답하지만,
                     등록금 쪽 이름은 문서 없이 맞히지 못했다(빈 응답 = 없는 오퍼레이션).
     ❌ 학과 단위  — **공시 항목 자체가 없다.** 학교가 개별 공지하는 값이라 공개
                     데이터로는 닿지 않는다. 계열이 실질 상한이다.

   그래서 이 로봇은 **학교 평균까지** 받아 온다. 계열 값이 생기면 같은 파일의
   `byField` 칸에 넣기만 하면 앱은 고칠 것이 없다(parse-amount.js 의 tuitionFor 가
   계열 → 학교평균 순으로 이미 본다).

   실행:  DATA_GO_KR_KEY=<키> node collector/fetch-tuition.mjs          (미리보기)
          DATA_GO_KR_KEY=<키> node collector/fetch-tuition.mjs --write  (반영)
   키는 공공데이터포털에서 발급받아 GitHub Secret `DATA_GO_KR_KEY` 에 넣는다.
   ⚠️ 키를 채팅이나 저장소에 붙여넣지 말 것.
   ============================================================ */
import fs from 'node:fs';

const WRITE = process.argv.includes('--write');
const KEY = process.env.DATA_GO_KR_KEY || '';
const OUT = new URL('../data/tuition.json', import.meta.url);
const API = 'https://api.data.go.kr/openapi/tn_pubr_public_univ_reg_amt_api';

if (!KEY) {
  console.log('DATA_GO_KR_KEY 가 없습니다 — 아무것도 하지 않고 끝냅니다.');
  console.log('공공데이터포털에서 `전국대학별평균등록금정보` 활용신청 후 키를 넣어 주세요.');
  console.log('  https://www.data.go.kr/data/15107738/standard.do');
  process.exit(0);
}

/* 학교 이름을 앱과 같은 꼴로 — data.js 의 UNIVERSITIES 가 정식 명칭을 쓴다.
   ⚠️ 이름을 줄이면 안 된다(기관명 축약 금지). 괄호 안 캠퍼스 표기만 떼어 낸다. */
const normSchool = (s) => String(s || '')
  .replace(/\([^)]*\)/g, '')
  .replace(/\s+/g, '')
  .trim();

async function pull() {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${API}?serviceKey=${encodeURIComponent(KEY)}&type=json&numOfRows=200&pageNo=${page}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const text = await res.text();
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR|LIMITED/.test(text)) {
      throw new Error('공공데이터포털이 키를 거절했습니다: ' + text.slice(0, 160));
    }
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('JSON 이 아닙니다: ' + text.slice(0, 160)); }
    const body = json.response?.body || json.body || {};
    const list = body.items || [];
    if (!list.length) break;
    rows.push(...list);
    const total = Number(body.totalCount || 0);
    if (rows.length >= total) break;
  }
  return rows;
}

const rows = await pull();
console.log(`받아온 줄 ${rows.length}건`);

const schools = {};
let skipped = 0;
for (const r of rows) {
  /* 표준데이터 칸 이름이 배포마다 조금씩 다르다 — 있는 것을 쓴다 */
  const name = normSchool(r.univNm || r.schoolNm || r.univName || r.대학교명);
  const avg = Number(String(r.avrgRegAmt || r.avgRegAmt || r.평균등록금액 || '').replace(/[^\d]/g, '')) || 0;
  if (!name || !avg) { skipped++; continue; }
  /* 같은 학교가 여러 줄이면 큰 값을 쓰지 않는다 — 먼저 온 값을 지킨다(임의 선택 금지) */
  if (schools[name]) continue;
  schools[name] = { avg, byField: {} };
}

console.log(`학교 ${Object.keys(schools).length}곳 · 건너뜀 ${skipped}건`);
const vals = Object.values(schools).map((s) => s.avg).sort((a, b) => a - b);
if (vals.length) {
  const man = (n) => (n / 10000).toLocaleString('ko-KR') + '만원';
  console.log(`  최저 ${man(vals[0])} · 중앙값 ${man(vals[Math.floor(vals.length / 2)])} · 최고 ${man(vals[vals.length - 1])}`);
}

/* 🔴 반토막 난 결과를 저장하지 않는다 — 학교가 갑자기 확 줄면 앱의 비율형 환산이
   통째로 0원이 된다(수집 로봇들의 '20% 실패 시 저장 거부'와 같은 방어). */
let prev = { schools: {} };
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { /* 처음 실행 */ }
const had = Object.keys(prev.schools || {}).length;
const now = Object.keys(schools).length;
if (had && now < had * 0.8) {
  console.error(`✕ 학교 수가 ${had} → ${now} 로 줄었습니다. 저장하지 않습니다.`);
  process.exit(1);
}

if (!WRITE) {
  console.log('\n(미리보기입니다 — 저장하려면 --write)');
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: '공공데이터포털 전국대학별평균등록금정보 (한국장학재단 공시연계)',
  sourceUrl: 'https://www.data.go.kr/data/15107738/standard.do',
  note: 'avg = 그 학교 평균 등록금. byField = 계열별(있으면 우선). 학과 단위는 공시 항목이 없다.',
  schools
}, null, 1) + '\n');
console.log(`\ndata/tuition.json 저장 완료 — 학교 ${now}곳`);
