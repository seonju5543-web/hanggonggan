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
import { createRequire } from 'node:module';

const ME = createRequire(import.meta.url)('../match-engine.js');

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
function loadSchoolNames(dataJsUrl) {
  const src = fs.readFileSync(dataJsUrl, 'utf8');
  const block = (head) => {
    const i = src.indexOf(head);
    if (i < 0) return '';
    return src.slice(i, src.indexOf(head.endsWith('[') ? '\n];' : '\n};', i));
  };
  const unis = new Set([...block('const UNIVERSITIES = [').matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const alias = new Map();
  for (const m of block('const UNIV_ALIASES = {').matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
    alias.set(m[1], m[2]);
  }
  if (!unis.size) throw new Error('data.js 에서 UNIVERSITIES 를 못 읽었습니다 — 파일 모양이 바뀐 것 같습니다');
  return { unis, alias };
}

/**
 * @param {Record<string, string[]>} bySchool  열쇠는 `'학교'` 또는 `'학교 캠퍼스'`
 * @param {{dir?: URL, updatedAt?: string}} opts
 */
export function publishMajorsBySchool(bySchool, opts = {}) {
  const dir = opts.dir || new URL('../data/majors/', import.meta.url);
  const updatedAt = opts.updatedAt
    || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  fs.mkdirSync(dir, { recursive: true });

  const { unis, alias } = loadSchoolNames(opts.dataJs || new URL('../data.js', import.meta.url));
  const index = {};
  const skipped = [];
  for (const [raw, majors] of Object.entries(bySchool || {})) {
    if (!raw || !Array.isArray(majors) || !majors.length) continue;
    /* 앱 이름으로 맞춘다 — 이미 앱 이름이면 그대로 */
    const key = unis.has(raw) ? raw : (alias.get(raw) || raw);
    if (!unis.has(key)) { skipped.push(raw); continue; }
    /* 🔴 파일 이름은 앱이 찾아갈 그 이름이어야 한다 — `majorsFileFor` 가 경로를 주므로
       폴더 부분만 떼어 쓴다(이름 규칙을 여기서 다시 쓰지 않는다). */
    const file = ME.majorsFileFor(key).split('/').pop();
    index[key] = { file, count: majors.length };
    fs.writeFileSync(new URL(file, dir), JSON.stringify({ school: key, updatedAt, majors }, null, 1) + '\n');
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
  return { schools: Object.keys(index).length, updatedAt, skipped };
}
