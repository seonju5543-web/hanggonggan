/* ============================================================
   학교별 등록금 받아오기 (2026-08-27 신설)

   왜 필요한가:
     등록 공고 중 15건이 금액을 `수업료 100%`·`등록금의 50%` 처럼 **등록금 비율**로만
     적는다. 학생 등록금을 모르면 원으로 바꿀 수 없어 영영 0원으로 남는다.
     그런데 이 15건이 홈 합계의 32%를 차지한다 — 빼 두면 합계가 크게 축소된다.

   어디서 받나 (2026-08-27 실측으로 확인한 것만 적는다):
     ✅ 학교 평균  — 공공데이터포털 `한국장학재단_대학별 평균등록금` (odcloud)
                     https://api.odcloud.kr/api/3071171/v1/uddi:97d765e1-… (20260519판)
                     ⚠️ 같은 공시를 낸 판이 둘이다 — 표준데이터
                     `tn_pubr_public_univ_reg_amt_api`(data 15107738)도 살아 있지만
                     **활용신청이 서로 별개**다. 개발자가 승인받은 쪽은 odcloud라
                     이 로봇은 odcloud를 본다. 둘은 같은 숫자이므로 둘 다 신청할
                     이유가 없다(2026-08-27 확인).
                     엔드포인트는 **연도별로 따로** 있고 위 uddi 가 최신(20260519)이다.
     ✅ 학교 × 계열 × 학과 — **한국장학재단 포털 '학과별 등록금 검색'에 다 있다.**
                     🔴 2026-08-27 정정: 아래 두 줄은 **틀린 기록이었다.** 예전에 여기에
                     "계열은 오퍼레이션명을 못 찾았다 / 학과 단위는 공시 항목 자체가 없다"고
                     적혀 있었는데, 개발자가 실제 제공처를 찾아내 실측으로 뒤집혔다.
                     그 기록을 믿고 다음 세션이 또 포기하지 않도록 레시피를 아래에 남긴다.

   ── KOSAF 학과별 등록금 수확 레시피 (2026-08-27 실측 · 아직 로봇은 안 만들었다) ──
     화면:  https://portal.kosaf.go.kr/CO/jspActionSafe.do
              ?beanName=PTSMTtnAmtSttcSVC&methodName=getSchlDptTtnAmtList
              &inputVOName=kr.go.kosaf.portal.pt.sm.ttnamtsttc.svc.PTSMTtnAmtSttcSVO
              &forwardPage=pt/sm/ttnamtsttc/PTSMTtnAmtSttc_06M
              &forwardOnlyFlag=N&ignoreSession=Y&innerFlag=1
     호출:  같은 주소로 **POST**. 위 GET 을 먼저 불러 **쿠키를 받고**, 그 HTML 의
            `csrfTokenPortal` 값을 같이 보내야 한다.
            🔴 쿠키 없이 토큰만 보내면 176바이트짜리
               `alert('보안상 문제가 생겨 전송이 취소 되었습니다..')` 가 온다.
     파라미터: yr=2026 · univDivCd=10(대학=학부) · dptNm=<학과명, **필수**>
               univFndnDivCd(설립: 1공립/2국립/3사립) · areaCd(시도) · paging=<쪽>
               ⚠️ dptNm 이 비면 "등록된 자료가 없습니다" 만 온다 — 전량 덤프가 안 된다.
                  학과명을 돌려 가며 긁고 (학교, 계열) 로 집계해야 한다.
     응답표: 학과명 | 학위구분 | 계열 | 학교명 | 본교/분교 | 대학구분 | 지역 | 입학금 | 등록금
             예) 경영학과 | 학사 | 인문사회 | 동의대학교[본교] | 본교 | 대학 | 부산 | 0 | 6,358
     🔴 **금액 단위가 천원이다** (6,358 = 635.8만원). 이 파일의 원 단위와 다르다.
     🔴 학교명이 `동서대학교[본교]` 꼴이라 `[본교]`·`[제2캠퍼스]` 를 떼고 앱 학교명에 맞춰야
        한다. 분교는 앱에서 별개 학교이므로 합치면 안 된다(운영 원칙 · normSchool 참조).
     아직 안 본 것: 페이징 규칙(총 건수 표기를 못 찾았다) · 학과명 부분일치 범위.
     ─────────────────────────────────────────────────────────────

   그래서 이 로봇은 **학교 평균까지** 받아 온다. 계열 값은 위 레시피로 채우면 되고,
   같은 파일의 `byField` 칸에 넣기만 하면 앱은 고칠 것이 없다(parse-amount.js 의
   tuitionFor 가 학생입력 → 계열 → 학교평균 순으로 이미 본다).

   실행:  DATA_GO_KR_KEY=<키> node collector/fetch-tuition.mjs          (미리보기)
          DATA_GO_KR_KEY=<키> node collector/fetch-tuition.mjs --write  (반영)
   키는 공공데이터포털에서 발급받아 GitHub Secret `DATA_GO_KR_KEY` 에 넣는다.
   ⚠️ 키를 채팅이나 저장소에 붙여넣지 말 것.
   ============================================================ */
import fs from 'node:fs';

const WRITE = process.argv.includes('--write');
const KEY = process.env.DATA_GO_KR_KEY || '';
const OUT = new URL('../data/tuition.json', import.meta.url);
const API = 'https://api.odcloud.kr/api/3071171/v1/uddi:97d765e1-4b57-4c8c-a179-d76d7ec5ce94';

if (!KEY) {
  console.log('DATA_GO_KR_KEY 가 없습니다 — 아무것도 하지 않고 끝냅니다.');
  console.log('공공데이터포털에서 `한국장학재단_대학별 평균등록금` 활용신청 후 키를 넣어 주세요.');
  console.log('  https://www.data.go.kr/data/15116893/openapi.do');
  console.log('  ⚠️ 인증키는 Decoding 키를 쓴다 — Encoding 키는 이중 인코딩돼 인증에 실패한다.');
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
    /* odcloud 는 serviceKey·page·perPage 를 쓰고 { data:[…], totalCount } 로 답한다.
       serviceKey 는 Decoding 키라 여기서 한 번만 인코딩한다(두 번 하면 인증 실패). */
    const url = `${API}?serviceKey=${encodeURIComponent(KEY)}&page=${page}&perPage=1000&returnType=JSON`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const text = await res.text();
    if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR|LIMITED|NOT_REGISTERED/.test(text)) {
      throw new Error('공공데이터포털이 키를 거절했습니다: ' + text.slice(0, 160));
    }
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('JSON 이 아닙니다: ' + text.slice(0, 160)); }
    const list = Array.isArray(json.data) ? json.data : [];
    if (!list.length) break;
    rows.push(...list);
    const total = Number(json.totalCount || 0);
    if (total && rows.length >= total) break;
    if (list.length < 1000) break;
  }
  return rows;
}

const rows = await pull();
console.log(`받아온 줄 ${rows.length}건`);
if (!rows.length) {
  console.error('✕ 응답에 줄이 하나도 없습니다 — 키·엔드포인트를 확인하세요. 저장하지 않습니다.');
  process.exit(1);
}

/* 칸 이름이 판(연도·배포)마다 다르다. 아는 이름을 먼저 보고, 없으면 **찾아서** 쓴다.
   🔴 못 찾으면 조용히 0건을 저장하지 않고 칸 목록을 찍고 세운다 —
   빈 파일을 발행하면 앱이 비율형 공고를 전부 '금액 미확인'으로 되돌린다. */
const findKey = (row, names, re) => names.find((n) => row[n] !== undefined)
  || Object.keys(row).find((k) => re.test(k));
const NAME_KEY = findKey(rows[0], ['univNm', 'schoolNm', 'univName', '대학교명'], /대학교?명|학교명/);
const AVG_KEY  = findKey(rows[0], ['avrgRegAmt', 'avgRegAmt', '평균등록금액'], /평균\s*등록금|등록금/);
if (!NAME_KEY || !AVG_KEY) {
  console.error('✕ 학교명·등록금 칸을 못 찾았습니다 — 응답 형식이 바뀐 듯합니다.');
  console.error('  칸 목록:', Object.keys(rows[0]).join(', '));
  process.exit(1);
}
console.log(`칸 인식: 학교명="${NAME_KEY}" · 등록금="${AVG_KEY}"`);

const schools = {};
let skipped = 0;
for (const r of rows) {
  const name = normSchool(r[NAME_KEY]);
  /* 🔴 소수점을 지우면 안 된다 — 이 API 는 `7791804.0` 처럼 소수점을 붙여 준다.
     숫자만 남기면 `77918040` 이 되어 **정확히 10배**가 되고, 등록금 비율형 공고의
     환산액이 그대로 10배로 나간다(2026-08-27 실제로 저장까지 갔다가 되돌린 사고).
     쉼표는 버리고 소수점은 남긴 뒤 반올림한다. */
  const avg = Math.round(Number(String(r[AVG_KEY] ?? '').replace(/[^\d.]/g, '')) || 0);
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

/* 🔴 자릿수 관문 — 등록금이 있을 수 없는 값이면 저장하지 않는다.
   2026-08-27 에 소수점을 지우는 파싱 실수로 값이 **10배**가 된 채 저장까지 갔다.
   앱은 이 값에 비율을 곱해 '받을 수 있는 금액'이라고 말하므로, 자릿수가 틀리면
   그대로 사용자 기망이 된다. 리포트가 아니라 관문이어야 재발이 끝난다.
   범위는 넉넉하게 잡았다 — 국내 4년제 연간 등록금은 200만~1,500만원 사이다. */
/* 한 줄에 둘을 선언하지 말 것 — test-collector 의 '선언 없는 대문자 이름' 검사가
   `const A = 1, B = 2;` 에서 뒤엣것을 못 읽어 실패한다(2026-08-27 실제로 걸렸다). */
const MIN_TUITION = 2_000_000;
const MAX_TUITION = 15_000_000;
const all = Object.values(schools).map((s) => s.avg).sort((a, b) => a - b);
const median = all[Math.floor(all.length / 2)] || 0;
if (median < MIN_TUITION || median > MAX_TUITION) {
  console.error(`✕ 등록금 중앙값이 ${median.toLocaleString()}원 입니다 — 있을 수 없는 자릿수라 저장하지 않습니다.`);
  console.error(`  (기대 범위 ${MIN_TUITION.toLocaleString()}~${MAX_TUITION.toLocaleString()}원. 소수점 처리·단위(원/천원)를 확인하세요.)`);
  process.exit(1);
}
const outOfRange = all.filter((v) => v < MIN_TUITION || v > MAX_TUITION).length;
if (outOfRange > all.length * 0.1) {
  console.error(`✕ 범위 밖 학교가 ${outOfRange}/${all.length}곳 입니다 — 저장하지 않습니다.`);
  process.exit(1);
}
if (outOfRange) console.log(`⚠ 범위 밖 ${outOfRange}곳 (그대로 저장 — 소수 학교의 실제 특수값일 수 있다)`);

if (!WRITE) {
  console.log('\n(미리보기입니다 — 저장하려면 --write)');
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: '공공데이터포털 전국대학별평균등록금정보 (한국장학재단 공시연계)',
  sourceUrl: 'https://www.data.go.kr/data/15107738/standard.do',
  note: 'avg = 그 학교 평균 등록금(원). byField = 계열별(있으면 우선 — 아직 비어 있다). 계열·학과별은 한국장학재단 포털에 있고 수확 레시피가 collector/fetch-tuition.mjs 머리말에 있다.',
  schools
}, null, 1) + '\n');
console.log(`\ndata/tuition.json 저장 완료 — 학교 ${now}곳`);
