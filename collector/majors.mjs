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
   출력: data/majors.json — { updatedAt, source, bySchool: { '학교명': [학과…] } }
   앱(app.js)은 이 파일을 읽어 MAJORS_BY_SCHOOL에 합친다.
   ============================================================ */
import fs from 'node:fs';

const KEY = process.env.CAREERNET_API_KEY;
if (!KEY) { console.error('CAREERNET_API_KEY가 없습니다 — 아무것도 하지 않고 종료합니다.'); process.exit(0); }

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
let done = 0, failed = 0;
for (const seq of uniq) {
  try {
    const xml = await api({ svcCode: 'MAJOR_VIEW', majorSeq: seq });
    // 개설대학 블록: area → schoolURL → campus_nm → majorName → schoolName 순서로 온다(실측)
    const blocks = xml.matchAll(/<campus_nm>[\s\S]*?<majorName>([\s\S]*?)<\/majorName>\s*<schoolName>([\s\S]*?)<\/schoolName>/g);
    for (const [, majorRaw, schoolRaw] of blocks) {
      const school = normalizeSchool(schoolRaw);
      const major = majorRaw.replace(/\s+/g, ' ').trim();
      if (!school || !major) continue;
      if (!bySchool.has(school)) bySchool.set(school, new Set());
      bySchool.get(school).add(major);
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
      .map(([k, v]) => [k, [...v].sort((a, b) => a.localeCompare(b, 'ko'))]),
  ),
};
fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1) + '\n');
const majors = Object.values(out.bySchool).reduce((a, v) => a + v.length, 0);
console.log(`저장 완료: 학교 ${bySchool.size}곳 · 학과 항목 ${majors}건 · 상세 실패 ${failed}건 → data/majors.json`);
