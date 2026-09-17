/* ============================================================
   학교 × 계열 등록금 수확 (2026-08-27 신설)

   무엇을 채우나:
     `data/tuition.json` 의 학교마다 있는 **`byField`** 칸.
     `parse-amount.js` 의 `tuitionFor` 가 학생입력 → **계열** → 학교평균 순으로 보므로,
     이 칸이 차면 `수업료 100%` 같은 비율형 공고의 환산이 계열 단위로 정확해진다.
     앱 코드는 고칠 것이 없다. `avg`(학교 평균)는 건드리지 않는다 —
     그건 공공데이터포털에서 받는 값이고 `collector/fetch-tuition.mjs` 의 몫이다.

   ── 레시피 (fetch-tuition.mjs 머리말의 실측 기록 + 이번에 밝힌 것) ────────────
   🔴 머리말 레시피에서 **틀린 것 셋을 바로잡았다** (전부 2026-08-27 실측):
     ① 쪽 넘김 파라미터는 `paging` 이 **아니라 `no`** 다. `paging` 은 폼 이름이고,
        화면의 `fn_page(val)` 이 `document.paging.no.value = val` 을 넣는다.
        `paging=2` 를 보내면 **1쪽이 그대로 다시 온다** — 같은 10줄을 영원히 긁는다.
     ② `dptNm` 은 필수지만 **`%` 를 받는다.** 서버가 LIKE 로 넣기 때문에 `dptNm=%` 면
        전량이 나온다. 학과명을 돌려 가며 긁을 필요가 없다(majors.json 의 7,221개를
        하나씩 두드릴 뻔했다). `_` 도 같은 결과.
     ③ 화면(HTML)이 아니라 **`/CO/jsonAction.do`** 로 같은 methodName 을 부르면
        **쿠키도 csrf 토큰도 필요 없고** 응답이 70KB 다(HTML 은 1.26MB — 18배).
        머리말이 경고한 `alert('보안상 문제가…')` 는 이 경로에선 아예 안 나온다.
   그대로 맞았던 것:
     · 금액 단위는 **천원**이다. 원으로 쓰려면 ×1000 (소수점이 붙어 온다 — `6355.7`).
     · 학교명이 `한국외국어대학교[본교]` 꼴이다.
   이번에 새로 확인한 것:
     · 한 쪽은 **10줄 고정**이다. listCnt·pageSize·rowSize·perPage 등 14가지를 다 넣어
       봤지만 전부 무시된다. 그래서 전량(2,711쪽)을 받는 수밖에 없다.
     · `univDivCd=10`(대학) 전량이 **27,108줄**. 마지막 쪽 다음은 0줄이라 거기서 멈춘다.
     · 분교 표기가 두 가지다 — `연세대학교(미래)[캠퍼스]` 와 `홍익대학교[제2캠퍼스]`.
       KOSAF 의 표기는 앱의 분교/이원화 구분과 **일치하지 않는다**(단국대도 [제2캠퍼스]
       인데 앱에선 이원화라 한 학교다). 그래서 아래 BRANCH 표가 필요하다.

   실행:  node collector/fetch-tuition-field.mjs            (미리보기 · 저장 안 함)
          node collector/fetch-tuition-field.mjs --write    (반영)
          node collector/fetch-tuition-field.mjs --pages=20 (맛보기 · 20쪽만)
   열쇠 필요 없음 — 공개 화면이라 누구나 받을 수 있다.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://portal.kosaf.go.kr/CO/jsonAction.do';
const PARAMS = {
  beanName: 'PTSMTtnAmtSttcSVC',
  inputVOName: 'kr.go.kosaf.portal.pt.sm.ttnamtsttc.svc.PTSMTtnAmtSttcSVO',
  methodName: 'getSchlDptTtnAmtList',
  forwardOnlyFlag: 'N', ignoreSession: 'Y',
  univDivCd: '10',   // 대학(=학부). 대학원은 **학기액** 기준이라 섞으면 안 된다.
  dptNm: '%',        // LIKE 와일드카드 — 비우면 "등록된 자료가 없습니다" 만 온다
};

/* 🔴 분교는 앱에서 **별개 학교**다(운영 원칙). 합치면 그 학교 학생이 남의 등록금으로
   환산된 금액을 '받을 수 있는 돈'으로 보게 된다. KOSAF 표기 → 앱 학교명(data.js UNIVERSITIES).
   ⚠️ `단국대학교[제2캠퍼스]`·`경기대학교[제2캠퍼스]` 처럼 여기 없는 캠퍼스 표기는
      **일부러** 본교로 합친다 — 앱에서 이원화는 한 학교이기 때문이다. */
export const BRANCH = {
  '연세대학교(미래)[캠퍼스]': '연세대학교 미래캠퍼스',
  '고려대학교(세종)[캠퍼스]': '고려대학교 세종캠퍼스',
  '한양대학교(ERICA)[캠퍼스]': '한양대학교 ERICA캠퍼스',
  '건국대학교(글로컬)[캠퍼스]': '건국대학교 글로컬캠퍼스',
  '동국대학교(경주)[캠퍼스]': '동국대학교 WISE캠퍼스',   // KOSAF 는 '경주', 앱은 'WISE'
  '홍익대학교[제2캠퍼스]': '홍익대학교 세종캠퍼스',
  '상명대학교[제2캠퍼스]': '상명대학교 천안캠퍼스',
};

/* 앱이 tuitionTable[학교명] 으로 **그대로** 찾으므로 열쇠는 앱 학교명이어야 한다.
   분교가 아닌 학교는 기존 tuition.json 의 관례(공백 제거)를 따른다. */
export function schoolKey(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (BRANCH[name]) return BRANCH[name];
  return name.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '').trim();
}

/* 응답은 따옴표 없는 키를 쓰는 자바스크립트 객체 리터럴이라 JSON.parse 가 안 된다.
   🔴 eval 로 풀지 않는다 — 남의 서버가 준 글자를 실행하는 짓이다(이 저장소 CSP 원칙).
   낱개 `{…}` 덩어리만 뜯어 쓴다. 같은 응답에 지역코드·설립구분 목록도 함께 오므로
   **학과명과 학교명이 둘 다 있는 덩어리만** 줄로 본다. */
const field = (block, key) => new RegExp('(?:^|, )' + key + ': "([^"]*)"').exec(block)?.[1] ?? '';
export function parseRows(text) {
  return [...String(text).matchAll(/\{([^{}]*)\}/g)].map((m) => m[1])
    .map((b) => ({
      school: field(b, 'univNm'), dept: field(b, 'dptNm'),
      track: field(b, 'afltNm'), degree: field(b, 'dgrDivNm'),
      amount: field(b, 'univTtnAmt'),
    }))
    .filter((r) => r.school && r.dept);
}

/* 천원 → 원. 🔴 소수점을 지우면 안 된다 — `6355.7` 에서 점을 지우면 63,557 천원이 되어
   **10배**가 된다(2026-08-27에 학교 평균 쪽에서 실제로 저장까지 갔던 사고). */
export const wonOf = (thousandWon) => {
  const n = Number(String(thousandWon ?? '').replace(/[^\d.]/g, ''));
  return n > 0 ? Math.round(n * 1000) : 0;
};

/* 같은 계열 안에서도 학과마다 몇만 원씩 다르다. 평균은 이상치 한 건에 끌려가므로
   가운뎃값을 쓴다(짝수면 아래쪽 — 매 실행 같은 값이 나와야 diff 가 안 흔들린다). */
export const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};

/* parse-amount.js 의 TRACK_TO_FIELD 가 쓰는 다섯 가지. 이름이 바뀌면 앱이 조용히
   학교 평균으로 되돌아가므로, 다섯 중 하나라도 통째로 안 보이면 저장을 막는다. */
export const KNOWN_TRACKS = ['인문사회', '자연과학', '공학', '예체능', '의학'];

/** 받은 줄들 → { 학교: { 계열: 원 } }. 0원(미공시)과 대학원은 빼고 센다. */
export function buildByField(rows) {
  const bucket = new Map();   // 학교 → 계열 → Map(학과 → 원)  ※ 쪽이 겹쳐 와도 학과로 합쳐진다
  for (const r of rows) {
    if (r.degree && r.degree !== '학사') continue;
    const won = wonOf(r.amount);
    if (!won) continue;                       // 공시 안 한 학과 — 0을 평균에 섞지 않는다
    const key = schoolKey(r.school);
    if (!key || !r.track) continue;
    if (!bucket.has(key)) bucket.set(key, new Map());
    const byTrack = bucket.get(key);
    if (!byTrack.has(r.track)) byTrack.set(r.track, new Map());
    byTrack.get(r.track).set(r.dept, won);
  }
  const out = {};
  for (const [school, byTrack] of bucket) {
    out[school] = {};
    for (const [track, depts] of byTrack) out[school][track] = median([...depts.values()]);
  }
  return out;
}

/* ── 여기부터는 실제로 서버를 두드리는 부분 ───────────────────────────── */

const MIN_TUITION = 2_000_000;
const MAX_TUITION = 15_000_000;
const PAGE_CAP = 4000;        // 폭주 방지 — 실측 2,711쪽이라 넉넉하다
/* 🔴 동시 접속을 올려도 **빨라지지 않는다** — 서버가 클라이언트당 초당 ~1.9쪽으로 막는다
   (2026-08-27 실측: 동시 3/6/10 전부 전량 예상 24.5~25.8분으로 같았다).
   그러니 남의 서버를 더 두드릴 이유가 없다. 3을 올리지 말 것. */
const CONCURRENCY = 3;
const BUDGET_MS = 40 * 60 * 1000;   // 전량 약 25분 — 느려질 여지를 두고 40분

async function page(no, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: new URLSearchParams({ ...PARAMS, yr: String(new Date().getFullYear()), no: String(no) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return parseRows(await res.text());
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
  return [];
}

async function harvest(maxPages) {
  const started = Date.now();
  const rows = [];
  let next = 1;
  let done = false;
  let stoppedEarly = '';
  const worker = async () => {
    while (!done) {
      const no = next++;
      if (no > maxPages) { done = true; stoppedEarly = `${maxPages}쪽 상한`; break; }
      if (Date.now() - started > BUDGET_MS) { done = true; stoppedEarly = '시간 예산(25분)'; break; }
      const got = await page(no);
      if (!got.length) { done = true; break; }   // 마지막 쪽 다음은 0줄이다
      rows.push(...got);
      if (no % 100 === 0) console.log(`  … ${no}쪽 · ${rows.length}줄 (${Math.round((Date.now() - started) / 1000)}초)`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { rows, stoppedEarly, secs: Math.round((Date.now() - started) / 1000) };
}

async function main() {
  const WRITE = process.argv.includes('--write');
  const capArg = process.argv.find((a) => a.startsWith('--pages='));
  const maxPages = capArg ? Number(capArg.slice(8)) : PAGE_CAP;
  const OUT = new URL('../data/tuition.json', import.meta.url);

  console.log(`한국장학재단 포털에서 학과별 등록금을 받습니다 (최대 ${maxPages}쪽 · 동시 ${CONCURRENCY})`);
  const { rows, stoppedEarly, secs } = await harvest(maxPages);
  console.log(`받아온 줄 ${rows.length}건 · ${secs}초${stoppedEarly ? ` (${stoppedEarly}에 걸려 중단)` : ''}`);
  const floor = capArg ? Math.floor(maxPages * 8) : 20_000;   // 맛보기(--pages)는 그만큼만 기대한다
  if (rows.length < floor) {
    console.error(`✕ 줄이 ${rows.length}건뿐입니다(기대 ${floor}건 이상) — 응답 형식이 바뀌었거나 막혔습니다. 저장하지 않습니다.`);
    process.exit(1);
  }

  /* 표기가 바뀌어 분교가 조용히 본교로 합쳐지는 것을 막는다.
     🔴 이건 리포트가 아니라 관문이다 — 합쳐지면 분교 학생이 남의 등록금으로 환산된
        금액을 보게 되고, 화면은 아무 이상도 없어 보인다. */
  const seenNames = new Set(rows.map((r) => r.school));
  const lostBranch = Object.keys(BRANCH).filter((n) => !seenNames.has(n));
  const unknownCampus = [...seenNames].filter((n) => /\[캠퍼스\]|\[제2캠퍼스\]/.test(n) && !BRANCH[n]);
  if (unknownCampus.length) console.log(`ℹ 본교로 합친 캠퍼스 표기 ${unknownCampus.length}건 (이원화라 정상): ${unknownCampus.slice(0, 8).join(', ')}`);

  const byField = buildByField(rows);
  const tracks = new Set();
  for (const t of Object.values(byField)) for (const k of Object.keys(t)) tracks.add(k);
  const missingTrack = KNOWN_TRACKS.filter((t) => !tracks.has(t));
  const extraTrack = [...tracks].filter((t) => !KNOWN_TRACKS.includes(t));
  console.log(`학교 ${Object.keys(byField).length}곳 · 계열 ${[...tracks].join('/')}`);

  /* 🔴 자릿수 관문 — 앱은 이 값에 비율을 곱해 '받을 수 있는 금액'이라고 말한다.
     단위(원/천원)를 틀리면 그대로 사용자 기망이 된다. */
  const all = Object.values(byField).flatMap((t) => Object.values(t));
  const mid = median(all);
  const outOfRange = all.filter((v) => v < MIN_TUITION || v > MAX_TUITION).length;
  console.log(`  중앙값 ${(mid / 10000).toLocaleString('ko-KR')}만원 · 값 ${all.length}개 · 범위 밖 ${outOfRange}개`);

  const blockers = [];
  if (mid < MIN_TUITION || mid > MAX_TUITION) blockers.push(`등록금 중앙값이 ${mid.toLocaleString()}원 — 있을 수 없는 자릿수입니다(천원→원 변환을 확인하세요)`);
  if (outOfRange > all.length * 0.1) blockers.push(`범위 밖 값이 ${outOfRange}/${all.length}개입니다`);
  if (missingTrack.length && !stoppedEarly) blockers.push(`계열 ${missingTrack.join('·')} 이(가) 하나도 없습니다 — 포털이 이름을 바꿨다면 parse-amount.js 의 TRACK_TO_FIELD 도 같이 고쳐야 합니다`);
  if (lostBranch.length && !stoppedEarly) blockers.push(`분교 표기 ${lostBranch.join(', ')} 을(를) 못 봤습니다 — 표기가 바뀌면 분교가 본교로 합쳐집니다. BRANCH 표를 고치세요`);
  if (extraTrack.length) console.log(`⚠ 모르는 계열 ${extraTrack.join('·')} — 저장은 하되 앱은 아직 안 씁니다(TRACK_TO_FIELD 확인)`);
  if (blockers.length) {
    for (const b of blockers) console.error('✕ ' + b);
    process.exit(1);
  }

  const file = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const schools = file.schools || {};
  const hadFilled = Object.values(schools).filter((s) => Object.keys(s.byField || {}).length).length;
  let filled = 0;
  let added = 0;
  for (const [name, tracksOf] of Object.entries(byField)) {
    if (!schools[name]) { schools[name] = { avg: 0, byField: {} }; added++; }  // 분교처럼 평균이 없던 학교
    schools[name].byField = tracksOf;   // avg 는 건드리지 않는다
    filled++;
  }
  console.log(`byField 를 채운 학교 ${filled}곳 (새로 만든 항목 ${added}곳 · 지난번 ${hadFilled}곳)`);
  if (hadFilled && filled < hadFilled * 0.8) {
    console.error(`✕ 채운 학교가 ${hadFilled} → ${filled} 로 줄었습니다. 저장하지 않습니다.`);
    process.exit(1);
  }

  const sample = Object.entries(byField).find(([n]) => n === '한국외국어대학교') || Object.entries(byField)[0];
  console.log(`  예) ${sample[0]}: ${Object.entries(sample[1]).map(([t, v]) => `${t} ${(v / 10000).toLocaleString('ko-KR')}만원`).join(' · ')}`);

  if (!WRITE) { console.log('\n(미리보기입니다 — 저장하려면 --write)'); return; }

  file.schools = Object.fromEntries(Object.entries(schools).sort(([a], [b]) => a.localeCompare(b, 'ko')));
  file.fieldUpdatedAt = new Date().toISOString();
  file.fieldSource = '한국장학재단 포털 학과별 등록금 검색 (portal.kosaf.go.kr)';
  file.note = 'avg = 그 학교 평균 등록금(원). byField = 학교×계열 등록금(원) — 같은 계열 학과들의 가운뎃값. 학과 단위는 공시가 없다.';
  fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log(`\ndata/tuition.json 저장 완료 — byField ${filled}곳`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
