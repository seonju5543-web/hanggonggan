/* ============================================================
   학교별 학과 목록 수확기 (2026-08-06 — 커리어넷 오픈API)

   왜 있나 — 개발자 지적(2026-08-02): "경희대 국제캠을 고르고 '일'을 치면
   일어일문학과가 뜨는데 경희대엔 일본어학과만 있다." 학과 자동추천이
   전국 공통 목록을 쓰는 한 이 오류는 계속된다. 그 학교에 실제로 개설된
   학과만 보여 주려면 학교별 목록이 필요하고, 이 API가 그 원천이다.

   실측으로 확인한 API 사실 (2026-08-06 — 매뉴얼 openAPI이용매뉴얼_v4.1 + 직접 호출):
   · 목록: svcCode=MAJOR, gubun=univ_list — 501건이 perPage=1000 한 페이지에 다 온다.
   · 상세: svcCode=MAJOR_VIEW + majorSeq — **gubun=univ_list를 빼면 '결과 없음'(-7)이 온다.**
     (매뉴얼 예시엔 gubun이 없어서 처음에 이걸 몰라 헤맸다 — 빼지 말 것)
   · 상세 응답의 <university> 안에 개설대학이 온다: schoolName·campus_nm·majorName·area.
     campus_nm은 '국제캠퍼스' 같은 이름이 아니라 **제1/제2캠퍼스**라는 번호다.
     경희대 일본어학과 = "경희대학교 | 제2캠퍼스 | 경기도" (국제캠퍼스가 이렇게 온다).
   · 한글 파라미터는 반드시 URL 인코딩(여기선 URLSearchParams가 해 준다).

   키: 환경변수 CAREERNET_API_KEY (GitHub Secret과 같은 이름 — 코드에 넣지 않는다).
   실행: CAREERNET_API_KEY=... node collector/majors.mjs
   출력: ① data/majors.json — { updatedAt, source, bySchool: { '학교명': [학과…] } } (사람·도구용)
         ② data/majors/<열쇠>.json — **앱이 받는 것은 이쪽뿐이다** (학교 하나당 파일 하나)
   🔴 앱은 ①을 받지 않는다 (2026-09-26 · 고문 보고서) — 209개교 407KB 를 첫 화면에서
      통째로 받고 있었는데, 학생에게 필요한 것은 자기 학교 목록(gzip 1.5KB)뿐이다.
      발행은 `collector/publish-majors.mjs` · 이름 규칙은 `match-engine.js majorsFileFor`.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { publishMajorsBySchool, missingServed, campusNameSuspects, cleanMajorName, cleanMajors } from './publish-majors.mjs';
import { loadSchoolNames } from './school-names.mjs';

const KEY = process.env.CAREERNET_API_KEY;
/* 🔴 Actions 에서 열쇠가 없으면 빨간불이다 (2026-10-05 점검) — 옛 판은 어디서나 exit 0 이라 워크플로가 '변경 없음' 초록불로
   끝났고, 시크릿이 실제로 있는지는 실행으로 한 번도 증명되지 않았다. 로컬 실행만 조용히 끝낸다. 열쇠 값은 찍지 않는다.
   이 검사는 네트워크 호출보다 앞에 있어야 한다(관문이 열쇠 없이 이 파일을 실제로 돌려 본다). */
if (!KEY) {
  const ci = process.env.GITHUB_ACTIONS === 'true';
  console.error(ci ? '::error::CAREERNET_API_KEY 가 없습니다 — 저장소 Secret 을 확인하세요 (학과 목록을 갱신하지 못했습니다)'
    : 'CAREERNET_API_KEY가 없습니다 — 아무것도 하지 않고 종료합니다.');
  process.exit(ci ? 1 : 0);
}

const HERE = new URL('.', import.meta.url);
const OUT_PATH = new URL('../data/majors.json', HERE);
const BASE = 'https://www.career.go.kr/cnet/openapi/getOpenApi';

async function api(params) {
  const q = new URLSearchParams({ apiKey: KEY, svcType: 'api', contentType: 'xml', gubun: 'univ_list', ...params });
  const res = await fetch(`${BASE}?${q}`, { signal: AbortSignal.timeout(20000) });
  return res.text();
}

/* 학교 이름 정리 — API의 schoolName을 앱(data.js UNIVERSITIES)의 학교명에 맞춘다.
   · "명지대학교 인문캠퍼스" / "명지대학교 자연캠퍼스"처럼 이름에 캠퍼스가 붙은 것은
     학교명으로 합친다(이원화 — 앱에선 캠퍼스 칩이 따로 있다).
   · 분교는 앱에서 별개 학교이므로(운영 원칙) 합치면 안 된다 — 아래 BRANCH_MAP으로
     앱의 분교 이름에 정확히 맞춘다. 목록에 없는 새 표기가 나타나면 그대로 둔다
     (지어내서 본교로 합치는 것보다 원문 그대로가 안전하다).
   · 사이버대학·대학원대학은 대상이 아니라 버린다. */
const BRANCH_MAP = {
  '연세대학교 미래캠퍼스': '연세대학교 미래캠퍼스',
  '고려대학교 세종캠퍼스': '고려대학교 세종캠퍼스',
  '한양대학교 ERICA캠퍼스': '한양대학교 ERICA캠퍼스',
  '한양대학교(ERICA캠퍼스)': '한양대학교 ERICA캠퍼스',
  '건국대학교 글로컬캠퍼스': '건국대학교 글로컬캠퍼스',
  '건국대학교(글로컬캠퍼스)': '건국대학교 글로컬캠퍼스',
  '동국대학교 WISE캠퍼스': '동국대학교 WISE캠퍼스',
  '동국대학교(WISE캠퍼스)': '동국대학교 WISE캠퍼스',
  '홍익대학교 세종캠퍼스': '홍익대학교 세종캠퍼스',
  '상명대학교 천안캠퍼스': '상명대학교 천안캠퍼스',
};
/* ── 이원화 캠퍼스별 학과 목록 (2026-10-24 · 개발자 지시 "학과를 학교에 맞춰 — 한국외대 글로벌캠퍼스 GBT학부") ──
   커리어넷은 캠퍼스를 **이름이 아니라 번호(제1/제2캠퍼스)** 로 주고, 개설 지역(area · 시·도)을 함께 준다.
   번호가 어느 캠퍼스인지는 학교마다 다르고 확인한 적이 없어, **지역으로** 가른다 — 두 캠퍼스가 서로 다른 시·도에 있는
   학교만 적었다(앱 CAMPUSES_BY_SCHOOL 의 캠퍼스 이름과 글자가 같아야 한다 — 발행기가 다른 이름은 버린다).
   🔴 부산대(밀양·양산이 둘 다 경남)·국립한국교통대(충주·증평이 둘 다 충북)는 지역으로 못 가른다 — 적지 않는다(학교 전체 목록).
   ⚠️ 실제 area 값이 표와 안 맞아 캠퍼스가 둘이 안 나오면 발행기가 **싣지 않고** 리포트에 남긴다 — 짐작으로 가르지 않는다. */
const CAMPUS_BY_AREA = {
  '한국외국어대학교': { '서울': '서울캠퍼스', '경기': '글로벌캠퍼스(용인)' },
  '경희대학교': { '서울': '서울캠퍼스', '경기': '국제캠퍼스(용인)' },
  '성균관대학교': { '서울': '인문사회과학캠퍼스(서울)', '경기': '자연과학캠퍼스(수원)' },
  '중앙대학교': { '서울': '서울캠퍼스', '경기': '다빈치캠퍼스(안성)' },
  '단국대학교': { '경기': '죽전캠퍼스', '충남': '천안캠퍼스' },
  '명지대학교': { '서울': '인문캠퍼스(서울)', '경기': '자연캠퍼스(용인)' },
  '경북대학교': { '대구': '대구캠퍼스', '경북': '상주캠퍼스' },
};
/* 시·도 짧은 이름은 parse-requirements 의 `shortRegion` 한 곳 — 판정(거주지·출신)과 같은 규칙(베끼지 않는다) */
const { shortRegion } = createRequire(import.meta.url)('../parse-requirements.js');
function campusOf(school, area) {
  const table = CAMPUS_BY_AREA[school];
  return table ? (table[shortRegion(area)] || null) : null;
}

function normalizeSchool(raw) {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (/사이버대|디지털대|원격대|방송통신대.*원|대학원대학/.test(name)) {
    return /방송통신대/.test(name) && !/대학원/.test(name) ? name : null;
  }
  if (BRANCH_MAP[name]) return BRANCH_MAP[name];
  // "○○대학교 △△캠퍼스" — 분교 목록에 없는 캠퍼스 표기는 본교(이원화)로 합친다
  const m = name.match(/^(.+?대학교)[\s(]+(.+?캠퍼스)\)?$/);
  if (m) return BRANCH_MAP[`${m[1]} ${m[2]}`] || m[1];
  return name;
}

const listXml = await api({ svcCode: 'MAJOR', perPage: '1000' });
const seqs = [...listXml.matchAll(/<majorSeq>(\d+)<\/majorSeq>/g)].map((m) => m[1]);
const uniq = [...new Set(seqs)];
console.log(`학과 목록 ${uniq.length}건 — 상세를 하나씩 받습니다 (예상 4~6분)`);
if (uniq.length < 100) { console.error('목록이 비정상적으로 적습니다 — 저장하지 않고 종료'); process.exit(1); }

const bySchool = new Map();      // 학교명 → Set(학과명)
const byCampus = new Map();      // 학교명 → Map(캠퍼스 이름 → Set(학과명)) — CAMPUS_BY_AREA 에 있는 학교만
const areaSeen = new Map();      // 학교명 → Set(area 원문) — 캠퍼스를 못 가른 학교의 증거(리포트)
/* 진단용 — (커리어넷 원래 학교 이름, campus_nm) 짝마다 학과 이름들. 분교가 무슨 이름·번호로 오는지 리포트에 남긴다
   (2026-10-05 점검 · 연세 미래 학과 파일이 없는데 커리어넷 이름을 확인하지 못했다 — 짐작해 넣지 않고 증거를 모은다). */
const byRawCampus = new Map();   // '원래이름\t캠퍼스' → Set(학과명)
const squash = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/\s+/g, ' ').trim();
let done = 0, failed = 0;
for (const seq of uniq) {
  try {
    const xml = await api({ svcCode: 'MAJOR_VIEW', majorSeq: seq });
    // 개설대학 블록: area → schoolURL → campus_nm → majorName → schoolName 순서로 온다(실측)
    // campus_nm 값도 잡는다(진단용) — 학과·학교 짝을 잡는 범위는 옛 정규식과 같다(campus_nm 여는 꼬리표부터 schoolName 까지)
    /* 개설대학 묶음(<university>…</university>)을 하나씩 떼어 안의 칸을 따로 읽는다 — area 까지 쓰려면 칸 순서에 기대면 안 된다.
       그 묶음 꼬리표가 안 보이면(응답 꼴이 바뀌면) 옛 정규식으로 물러난다(area 없이 — 캠퍼스는 못 가르지만 학과는 잃지 않는다). */
    const tag = (blk, name) => { const m = blk.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? m[1] : ''; };
    const units = [...xml.matchAll(/<university>([\s\S]*?)<\/university>/g)].map((m) => m[1]);
    const blocks = units.length
      ? units.map((u) => [null, tag(u, 'campus_nm'), tag(u, 'majorName'), tag(u, 'schoolName'), tag(u, 'area')])
      : [...xml.matchAll(/<campus_nm>([\s\S]*?)<\/campus_nm>[\s\S]*?<majorName>([\s\S]*?)<\/majorName>\s*<schoolName>([\s\S]*?)<\/schoolName>/g)];
    for (const [, campusRaw, majorRaw, schoolRaw, areaRaw] of blocks) {
      const school = normalizeSchool(schoolRaw);
      /* 이름 정리는 발행기와 같은 함수 — `&amp;` 를 되돌린다(22개 파일에 그대로 실려 있었다) */
      const major = cleanMajorName(majorRaw);
      if (major) {
        const k = `${squash(schoolRaw)}\t${squash(campusRaw)}`;
        if (!byRawCampus.has(k)) byRawCampus.set(k, new Set());
        byRawCampus.get(k).add(major);
      }
      if (!school || !major) continue;
      if (!bySchool.has(school)) bySchool.set(school, new Set());
      bySchool.get(school).add(major);
      if (CAMPUS_BY_AREA[school]) {
        const area = squash(areaRaw || '');
        if (!areaSeen.has(school)) areaSeen.set(school, new Set());
        areaSeen.get(school).add(area || '(area 칸 없음)');
        const cname = campusOf(school, area);
        if (cname) {
          if (!byCampus.has(school)) byCampus.set(school, new Map());
          const cm = byCampus.get(school);
          if (!cm.has(cname)) cm.set(cname, new Set());
          cm.get(cname).add(major);
        }
      }
    }
  } catch { failed += 1; }
  done += 1;
  if (done % 50 === 0) console.log(`  ${done}/${uniq.length}…`);
  await new Promise((r) => setTimeout(r, 250));   // 공공 API 예의 — 몰아치지 않는다
}

/* 저장 안전장치: 실패가 너무 많으면(서버 장애 등) 반쪽짜리 데이터로 덮어쓰지 않는다 */
if (failed > uniq.length * 0.2) {
  console.error(`상세 실패 ${failed}/${uniq.length} — 데이터가 불완전해 저장하지 않습니다`);
  process.exit(1);
}

/* 앱에 있는 학교만 발행한다 — 전체 377곳을 다 실으면 590KB인데 앱 학교는 67곳뿐이라
   80%가 죽은 데이터다(폰이 매번 받는 파일 크기 원칙 — notices.json 사례와 같은 이유).
   data.js는 브라우저 스크립트라 require할 수 없어, 학교명 문자열이 그 안에 있는지로 거른다
   (UNIVERSITIES가 '경희대학교' 같은 리터럴 목록이라 이 확인으로 충분하다).
   학교를 새로 추가하면 이 워크플로를 한 번 다시 돌리면 된다. */
const dataJs = fs.readFileSync(new URL('../data.js', HERE), 'utf8');
const inApp = (school) => dataJs.includes(`'${school}'`) || dataJs.includes(`"${school}"`);

const out = {
  updatedAt: new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10),
  source: '커리어넷 학과정보 오픈API (career.go.kr)',
  bySchool: Object.fromEntries(
    [...bySchool.entries()].filter(([k]) => inApp(k))
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([k, v]) => [k, cleanMajors([...v].sort((a, b) => a.localeCompare(b, 'ko')))]),   // 장부도 발행 파일과 같은 정리(모집단위 제거)
  ),
  /* 이원화 캠퍼스별 목록 — 지역(area)으로 가른 것만. 발행기(publishMajorsBySchool)가 앱 캠퍼스 이름과 맞춰 학교 파일에 싣는다 */
  campuses: Object.fromEntries(
    [...byCampus.entries()].filter(([k]) => inApp(k))
      .sort((a, b) => a[0].localeCompare(b[0], 'ko'))
      .map(([k, cm]) => [k, Object.fromEntries([...cm.entries()].map(([c, set]) => [c, cleanMajors([...set].sort((a, b) => a.localeCompare(b, 'ko')))]))]),
  ),
};
/* 캠퍼스를 가르기로 한 학교인데 둘이 안 나온 곳 — area 값이 표와 다른 것이다. 짐작해 고치지 말고 리포트의 원문 값을 보고 표를 고친다 */
const campusUnsplit = Object.keys(CAMPUS_BY_AREA).filter((k) => inApp(k) && bySchool.has(k) && Object.keys(out.campuses[k] || {}).length < 2)
  .map((k) => `${k} — area 값: ${[...(areaSeen.get(k) || [])].join(' · ') || '(없음)'} · 가른 캠퍼스: ${Object.keys(out.campuses[k] || {}).join(' · ') || '없음'}`);

/* ── 실행 진단 (2026-10-05 점검 · 리포트 + ::warning — 관문이 아니다) ── */
const ME = createRequire(import.meta.url)('../match-engine.js');
const names = loadSchoolNames(new URL('../data.js', HERE));
const pairs = [...byRawCampus.entries()].map(([k, set]) => { const [school, campus] = k.split('\t'); return { school, campus, n: set.size }; });
const suspects = campusNameSuspects(pairs, names.unis, { normalize: normalizeSchool, alias: names.alias });
const appSchools = Object.keys(out.bySchool).length;
const writeReport = (missing, skipped, verdict) => {
  const md = [
    `# 학과 목록 갱신 리포트 — ${out.updatedAt}`,
    '',
    `- 판정: ${verdict}`,
    `- 커리어넷 학교 ${bySchool.size}곳 · 앱 학교 ${appSchools}곳 · 학과 목록 ${uniq.length}건 · 상세 실패 ${failed}건`,
    '',
    '## 서비스 학교인데 이번에 학과 파일을 못 만들었다',
    '이 학교 학생은 학과 자동추천이 전국 공통 목록으로 물러난다(화면에는 아무 표시가 없다).',
    ...(missing ? (missing.length ? missing.map((s) => `- ${s}`) : ['- 없음']) : ['- (저장하지 않아 재지 않음)']),
    '',
    '## 분교 이름 후보 (사람이 확인 — 이름을 짐작해 넣지 말 것)',
    '원래 이름이 그 글자 그대로 분교면 collector/majors.mjs BRANCH_MAP 에 한 줄 · 캠퍼스 번호로 오면 근거 주석과 함께 번호 표를 둔다.',
    ...(suspects.length ? suspects.map((s) => `- ${s}`) : ['- 없음']),
    '',
    '## 앱 이름으로 못 맞춰 건너뛴 이름',
    ...(skipped && skipped.length ? skipped.map((s) => `- ${s}`) : ['- 없음']),
    '',
    '## 이원화 캠퍼스를 지역으로 못 가른 학교 (CAMPUS_BY_AREA 표와 area 값이 다르다 — 원문 값을 보고 표를 고친다)',
    ...(campusUnsplit.length ? campusUnsplit.map((s) => `- ${s}`) : ['- 없음']),
    '',
  ].join('\n');
  fs.writeFileSync(new URL('majors-report.md', HERE), md);
};
for (const s of suspects) console.log(`분교 이름 후보: ${s}`);

/* 저장 안전장치 둘째 — 정규식·응답 꼴이 바뀌어 학교 짝이 틀어지면 학과 목록 전체가 엉뚱해진다.
   08-06판은 앱 학교 209곳이었다. 크게 모자라면 덮어쓰지 않는다(바닥값 — 실제로 줄었다면 사람이 확인하고 낮춘다). */
const MIN_APP_SCHOOLS = 150;
if (appSchools < MIN_APP_SCHOOLS) {
  writeReport(null, null, `저장 안 함 — 앱 학교가 ${appSchools}곳뿐 (바닥 ${MIN_APP_SCHOOLS})`);
  console.error(`::error::앱 학교가 ${appSchools}곳뿐입니다(바닥 ${MIN_APP_SCHOOLS}) — 응답 꼴이 바뀌었을 수 있어 저장하지 않습니다`);
  process.exit(1);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');
/* 🔴 **앱이 받는 것은 이쪽이다** — 이 줄을 빼면 앱은 새 학과를 영영 못 본다(그리고 조용하다:
   파일이 없으면 전국 공통 목록으로 물러나므로 화면상 아무 일도 안 일어난 것처럼 보인다). */
const pub = publishMajorsBySchool(
  Object.fromEntries(Object.entries(out.bySchool).map(([k, majors]) => [k, { majors, campuses: out.campuses[k] || null }])),
  { updatedAt: out.updatedAt },
);
for (const c of pub.campusSkipped) console.log(`::warning::캠퍼스 이름이 앱 칩(CAMPUSES_BY_SCHOOL)과 달라 싣지 않음 — ${c}`);
for (const u of campusUnsplit) console.log(`::warning::이원화 캠퍼스를 지역으로 못 가름 — ${u}`);
const majors = Object.values(out.bySchool).reduce((a, v) => a + v.length, 0);
console.log(`저장 완료: 학교 ${bySchool.size}곳 · 학과 항목 ${majors}건 · 상세 실패 ${failed}건`);
console.log(`  → data/majors.json (사람용) · data/majors/ 학교별 ${pub.schools}개 파일 (앱이 받는 것)`);
/* 🔴 서비스 학교가 빠지면 소리를 낸다 — 관문이 아니라 경고다(실데이터를 관문에 두면 수집 로봇이 결과를 버린다) */
/* 발행은 옛 파일을 지우지 않으므로 '이번에 못 만들었다'와 '파일이 아예 없다'를 갈라 적는다(확인한 것만 말한다) */
const missing = missingServed(pub.published, ME.SERVED_SCHOOLS)
  .map((s) => `${s} (${fs.existsSync(new URL(`../${ME.majorsFileFor(s)}`, HERE)) ? '이번에 못 만듦 · 옛 파일이 남아 있다' : '파일 없음 — 학생 화면은 전국 공통 목록'})`);
for (const s of missing) console.log(`::warning::서비스 학교인데 이번 실행에서 학과 파일을 못 만들었다 — ${s}`);
writeReport(missing, pub.skipped, missing.length ? `저장함 · 서비스 학교 ${missing.length}곳 학과 파일 못 만듦` : '저장함');
console.log(`  → collector/majors-report.md (서비스 학교 빠짐 ${missing.length}곳 · 분교 이름 후보 ${suspects.length}줄)`);
