/* ============================================================
   학과 목록을 **학교별 파일로** 발행한다 (2026-09-26 · 고문 보고서)

   왜 — `data/majors.json` 은 209개교 전부가 든 **407KB** 파일인데, 학생에게 필요한 것은
   자기 학교 목록 하나(2KB 안팎)다. 그런데 앱이 첫 화면에서 그걸 통째로 받고 있었다.
   실측(2026-09-26): 앱이 첫 화면에서 받는 것 중 **가장 큰 파일**이었다(gzip 65KB).
   쓰는 곳은 온보딩 학과 자동추천 한 곳뿐이다(`majorSuggestions`).

   🔴 **왜 majors.mjs 안에 두지 않았나** — 그 파일은 **불러오는 순간 실행된다**(API 키를
      확인하고 수확을 시작한다). 관문이 그것을 가져다 쓰면 검사가 커리어넷을 두드린다.
      그래서 발행만 여기로 뗐다(`publish-notices.mjs` 와 같은 이유·같은 모양).

   ⚠️ 이름 규칙은 **`match-engine.js majorsFileFor` 한 곳**이다 — 여기서 새로 만들지 말 것.
      2026-08-27에 로봇과 앱의 학교 이름이 갈라져 학과 추천이 **조용히 죽은** 적이 있다.
      조용한 이유는 폴백(전국 공통 목록)이 받아 주기 때문이다.
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadSchoolNames, loadCampuses } from './school-names.mjs';
import { decodeEntities } from './clean-title.mjs';
import { createRequire } from 'node:module';

const ME = createRequire(import.meta.url)('../match-engine.js');

/* ── 학과 이름 정리 (2026-10-24 · 개발자 지시 "학과를 학교에 맞춰") ──────────────────────
   🔴 커리어넷은 `&` 를 **`&amp;` 로 인코딩한 채** 준다 — 한국외대 `Global Business &amp; Technology학부` 가
      그대로 실려, 그 학부 학생이 'Global'·'비즈' 를 쳐도 제 학과를 못 골랐다(개발자 본인의 학과다).
      22개 파일에 같은 꼴이 있었다(실측). 발행 때 되돌린다 — 로봇 장부(data/majors.json)에도 되돌린 이름으로 적는다.
   🔴 `경상대학[통합모집]`·`기타모집단위(글로벌)` 은 **입시 모집단위**라 학생의 소속 학과가 아니다 — 뺀다.
      `공과계열`·`자유전공학부` 같은 계열·자유전공은 1학년의 실제 소속일 수 있어 남긴다(지어서 가르지 않는다). */
export function cleanMajorName(raw) {
  /* 엔티티 표는 clean-title.mjs `decodeEntities` 한 곳(베끼지 않는다) · 두 번 인코딩된 `&amp;amp;` 도 있을 수 있어 두 번 되돌린다 */
  return decodeEntities(decodeEntities(String(raw || ''))).replace(/\s+/g, ' ').trim();
}
const NOT_A_MAJOR = /\[통합모집\]|^기타\s*모집\s*단위/;
export function isMajorName(name) {
  return !!name && !NOT_A_MAJOR.test(name);
}
/** 이름을 되돌리고 모집단위를 뺀 뒤 같은 이름을 하나로 — 순서는 들어온 대로 */
export function cleanMajors(list) {
  const out = [];
  const seen = new Set();
  for (const raw of list || []) {
    const n = cleanMajorName(raw);
    if (!isMajorName(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/* 🔴 **커리어넷 이름을 앱의 학교 이름으로 맞춘다** (2026-09-26 관문이 잡았다).
   커리어넷은 `한국과학기술원`·`포항공과대학교`·`한국에너지공과대학교` 로 주는데 앱의
   `UNIVERSITIES` 는 `KAIST`·`POSTECH`·`한국에너지공과대학교(KENTECH)` 다. 맞추지 않으면
   그 7곳 학생은 **자기 학과 파일을 영영 못 받고** 전국 공통 목록으로 조용히 물러난다
   (2026-08-27 분교 사고와 같은 종류다 — 폴백이 받아 주니 아무도 모른다).
   ⚠️ 이어 주는 표를 **새로 만들지 않는다** — `data.js` 의 `UNIV_ALIASES` 가 이미 전부
      가지고 있다. 다만 data.js 는 브라우저 스크립트라 `require` 할 수 없어 글자로 읽는다
      (`collector/majors.mjs` 의 `inApp` 이 같은 이유로 같은 방식을 쓴다).
   ⚠️ `UNIVERSITIES` 에 아예 없는 학교는 **파일을 만들지 않는다** — 앱이 고를 수 없는
      학교라 받아 갈 사람이 없다(209곳 중 몇 곳이 그렇다). */
/* 학교 이름·별칭 읽기는 collector/school-names.mjs 한 곳 (2026-09-30 — 교내·교외 판정기도 같은 것을 쓴다) */

/**
 * @param {Record<string, string[]>} bySchool  열쇠는 `'학교'` 또는 `'학교 캠퍼스'`
 * @param {{dir?: URL, updatedAt?: string}} opts
 */
export function publishMajorsBySchool(bySchool, opts = {}) {
  const dir = opts.dir || new URL('../data/majors/', import.meta.url);
  const updatedAt = opts.updatedAt
    || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  fs.mkdirSync(dir, { recursive: true });

  const dataJs = opts.dataJs || new URL('../data.js', import.meta.url);
  const { unis, alias } = loadSchoolNames(dataJs);
  /* 캠퍼스 이름은 앱의 칩(CAMPUSES_BY_SCHOOL)과 **글자가 같아야** 한다 — 다르면 앱이 그 캠퍼스 목록을 못 찾아 학교 전체 목록으로 물러난다 */
  const appCampuses = loadCampuses(dataJs);
  const index = {};
  const skipped = [];
  const campusSkipped = [];
  for (const [raw, val] of Object.entries(bySchool || {})) {
    /* 값은 배열(옛 꼴) 또는 { majors, campuses } (2026-10-24 — 이원화 캠퍼스별 목록) */
    const majors = cleanMajors(Array.isArray(val) ? val : (val && val.majors));
    if (!raw || !majors.length) continue;
    /* 앱 이름으로 맞춘다 — 이미 앱 이름이면 그대로 */
    const key = unis.has(raw) ? raw : (alias.get(raw) || raw);
    if (!unis.has(key)) { skipped.push(raw); continue; }
    /* 🔴 파일 이름은 앱이 찾아갈 그 이름이어야 한다 — `majorsFileFor` 가 경로를 주므로
       폴더 부분만 떼어 쓴다(이름 규칙을 여기서 다시 쓰지 않는다). */
    const file = ME.majorsFileFor(key).split('/').pop();
    const doc = { school: key, updatedAt, majors };
    /* 캠퍼스별 목록 — 앱이 아는 캠퍼스 이름만 · 그 학교 학과 목록 안에 있는 이름만 · 둘 이상일 때만 싣는다
       (하나뿐이면 학교 전체 목록과 같은 말이라 자리를 안 만든다 — 앱은 없으면 전체 목록을 쓴다) */
    const camps = !Array.isArray(val) && val && val.campuses ? val.campuses : null;
    if (camps) {
      const allowed = new Set(appCampuses.get(key) || []);
      const kept = {};
      for (const [cname, list] of Object.entries(camps)) {
        if (!allowed.has(cname)) { campusSkipped.push(`${key} · ${cname}`); continue; }
        const l = cleanMajors(list).filter((m) => majors.includes(m));
        if (l.length) kept[cname] = l;
      }
      if (Object.keys(kept).length >= 2) doc.campuses = kept;
    }
    index[key] = { file, count: majors.length, ...(doc.campuses ? { campuses: Object.keys(doc.campuses).length } : {}) };
    fs.writeFileSync(new URL(file, dir), JSON.stringify(doc, null, 1) + '\n');
  }
  /* 색인은 **앱이 읽지 않는다** — 앱은 이름 규칙으로 바로 찾아가고, 없으면 404 를 받아
     전국 공통 목록으로 물러난다(그 폴백은 원래 있던 것이다). 사람과 도구용이다.
     ⚠️ 공고 색인(`data/notices/index.json`)과 다른 점이다 — 거기서는 '받을 것이 없다'와
        '배포가 엇갈렸다'를 갈라야 해서 앱이 읽는다. 여기는 폴백이 무해해서 그럴 필요가 없다. */
  fs.writeFileSync(new URL('index.json', dir), JSON.stringify({
    note: '학교별 학과 목록 파일 색인. 앱은 match-engine.js 의 majorsFileFor 로 파일을 직접 찾으므로 이 파일을 읽지 않는다 — 사람이 보기 위한 것.',
    updatedAt,
    schools: Object.keys(index).length,
    files: index,
  }, null, 1) + '\n');
  /* published = 이번에 파일을 쓴 **앱 이름** 목록 — 서비스 학교가 빠졌는지 로봇이 이것으로 잰다(missingServed) */
  return { schools: Object.keys(index).length, updatedAt, skipped, campusSkipped, published: Object.keys(index) };
}

/* 장부(data/majors.json)에서 학교별 파일을 **다시 발행**한다 — 커리어넷을 두드리지 않는다.
   이름 정리 규칙(엔티티·모집단위)이나 파일 꼴이 바뀌었을 때 쓴다: node collector/publish-majors.mjs
   장부의 `campuses`(로봇이 area 로 가른 캠퍼스별 목록 · 2026-10-24)가 있으면 같이 싣는다. */
export function republishFromLedger(ledgerUrl = new URL('../data/majors.json', import.meta.url), opts = {}) {
  const ledger = JSON.parse(fs.readFileSync(ledgerUrl, 'utf8'));
  const bySchool = {};
  for (const [school, majors] of Object.entries(ledger.bySchool || {})) {
    bySchool[school] = { majors, campuses: (ledger.campuses || {})[school] || null };
  }
  const pub = publishMajorsBySchool(bySchool, { updatedAt: ledger.updatedAt, ...opts });
  /* 장부의 이름도 같은 규칙으로 정리해 둔다 — 장부와 파일이 다른 이름을 갖지 않게 */
  if (!opts.dryLedger) {
    for (const k of Object.keys(ledger.bySchool || {})) ledger.bySchool[k] = cleanMajors(ledger.bySchool[k]);
    for (const k of Object.keys(ledger.campuses || {})) for (const c of Object.keys(ledger.campuses[k])) ledger.campuses[k][c] = cleanMajors(ledger.campuses[k][c]);
    fs.writeFileSync(ledgerUrl, JSON.stringify(ledger, null, 1) + '\n');
  }
  return pub;
}

/* 직접 실행했을 때만 다시 발행한다 — 불러오기(관문·로봇)만으로는 아무것도 하지 않는다 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pub = republishFromLedger();
  console.log(`다시 발행: 학교 ${pub.schools}곳 · 이름 못 맞춘 학교 ${pub.skipped.length} · 앱에 없는 캠퍼스 이름 ${pub.campusSkipped.length}`);
  for (const c of pub.campusSkipped) console.log(`  캠퍼스 이름이 앱 칩과 다르다: ${c}`);
}

/* ── 실행 진단 (2026-10-05 점검 · refresh MAJORS-01) ───────────────────────────────────
   연세대학교 미래캠퍼스(서비스 학교)의 학과 파일이 없어 그 학생은 전국 공통 목록으로 **조용히** 물러나 있었다
   (2026-08-02 사고와 같은 꼴). 커리어넷이 그 분교를 무슨 이름으로 주는지는 확인하지 못했다 —
   그래서 이름을 짐작해 BRANCH_MAP 에 넣지 않고, 다음 실행이 **증거**(원래 이름·캠퍼스 번호·학과 수)를 리포트에 남기게 한다.
   🔴 '서비스 학교 전부 파일이 있다'를 관문(test-collector)으로 두지 말 것 — 실데이터라 지금 빨간불이고, 관문을 같이 쓰는
      수집 로봇이 제 결과를 버린다. 로봇 리포트와 ::warning 으로만 알린다. 둘 다 순수 함수(불러와도 아무것도 안 한다). */

/** 서비스 학교 중 이번에 학과 파일이 발행되지 않은 학교 (served 순서 그대로) */
export function missingServed(published, served) {
  const have = new Set(published || []);
  return (served || []).filter((s) => !have.has(s));
}

/* 분교를 가진 앱 학교 — UNIVERSITIES 에 '<학교> …캠퍼스' 가 따로 있는 본교 이름(연세대학교·상명대학교…).
   이원화 학교(경희·외대 — 캠퍼스가 CAMPUSES_BY_SCHOOL 칩일 뿐 별개 학교가 아닌 곳)는 여기 안 든다. */
const BRANCH_NAME = /^(.+?대학교)\s+\S+캠퍼스$/;
const stemOf = (name) => (/^(.+?대학교)/.exec(String(name || '')) || [])[1] || null;

/**
 * 분교 이름 후보 — 사람이 BRANCH_MAP(또는 캠퍼스 번호 표)을 고칠 증거 줄.
 * @param {{school: string, campus: string, n: number}[]} pairs  커리어넷 원래 학교 이름·campus_nm 짝마다 학과 수
 * @param {Set<string>|string[]} unis  앱 학교 이름(UNIVERSITIES)
 * @param {{normalize?: (raw: string) => string|null, alias?: Map<string,string>}} opts  로봇의 이름 정리(BRANCH_MAP 포함)와 별칭
 * @returns {string[]} '연세대학교(원주) | 제1캠퍼스 | 학과 38 — 까닭' 꼴
 *   (a) 원래 이름이 정리·별칭 뒤에도 앱 이름이 아닌데 '…대학교' 밑동이 분교를 가진 학교인 줄 — 버려진 분교일 수 있다
 *       · 캠퍼스가 붙은 원래 이름이 본교로 합쳐진 줄도 같이 적는다(분교 학과가 본교에 섞였을 수 있다)
 *   (b) 분교를 가진 학교가 campus_nm 을 두 가지 이상으로 받은 줄 — 캠퍼스 번호로 분교가 오는 꼴일 수 있다
 */
export function campusNameSuspects(pairs, unis, opts = {}) {
  const U = unis instanceof Set ? unis : new Set(unis || []);
  const alias = opts.alias || new Map();
  const normalize = opts.normalize || ((s) => s);
  const parents = new Set([...U].map((u) => (BRANCH_NAME.exec(u) || [])[1]).filter(Boolean));
  const appName = (raw) => {
    const n = normalize(raw);
    if (!n) return null;
    return U.has(n) ? n : (U.has(alias.get(n)) ? alias.get(n) : null);
  };
  const out = new Map();            // 줄 머리 → 까닭 (같은 줄을 두 번 적지 않는다)
  const line = (p) => `${p.school} | ${p.campus || '(캠퍼스 칸 없음)'} | 학과 ${p.n}`;
  const campusesOf = new Map();     // 분교를 가진 본교 이름 → [짝…]
  for (const p of pairs || []) {
    const stem = stemOf(p.school);
    if (!stem || !parents.has(stem)) continue;
    const app = appName(p.school);
    if (!app) out.set(line(p), '앱 학교 이름과 안 맞아 버려짐 — 분교 이름이면 BRANCH_MAP 에 그 글자 그대로 한 줄');
    else if (app === stem && p.school.replace(/\s+/g, ' ').trim() !== stem) out.set(line(p), `본교(${stem})로 합쳐짐 — 분교라면 BRANCH_MAP 에 한 줄`);
    if (app === stem) (campusesOf.get(stem) || campusesOf.set(stem, []).get(stem)).push(p);
  }
  for (const list of campusesOf.values()) {
    if (new Set(list.map((p) => p.campus || '')).size < 2) continue;
    for (const p of list) if (!out.has(line(p))) out.set(line(p), '분교가 있는 학교가 캠퍼스 번호를 둘 이상 받음 — 번호로 분교가 오는지 확인');
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ko')).map(([k, why]) => `${k} — ${why}`);
}
