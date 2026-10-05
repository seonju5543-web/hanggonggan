/* ============================================================
   학교 포털 표 후보 (2026-09-30 신설 — 개발자 지시 "해결책 전체 시행" ⑤)
   ------------------------------------------------------------
   data.js 의 SCHOOL_PORTALS(학교별 장학 신청 포털)는 경희대·한국외대 둘뿐이다(노션 UI-20). 44개교를 사람이 하나씩
   찾아 채울 수는 없다. 그래서 정식 등록 공고의 **원문**에서 학교별 신청 시스템 이름을 모아 후보와 근거를 낸다.
   🔴 표에 넣는 것은 사람이다 — 여기서는 후보와 근거만 적는다(주소를 짐작해 채우지 않는다 · CLAUDE.md 포털 신청 규칙).

   🔴 2026-10-05 점검 app1-11 — 예전엔 등록 항목의 applyPortal 만 모았는데, 그 칸은 이미 아는 시스템(apply-channel.js
      PORTAL_SYSTEMS · HUFS Ability·종합정보시스템·인포21)만 채워지므로 **새 시스템을 영영 못 찾았다**(결과 items: []).
      이제 원문 줄에서 이름 꼴을 직접 읽는다 — `포털(KUPID) → … → 장학금 신청` · `ON 국민 - 포털 - … - 장학신청` ·
      `학사정보시스템에서 신청`. 신청을 말하는 줄만(apply-channel.js 의 판정을 불러 쓴다 · 출력·다운로드 줄은 버림).
   출력: collector/portal-candidates.json + 리포트 절. 불러오기만 하면 아무것도 쓰지 않는다(관문이 portalNameCandidates 를 표본으로 잰다).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { indexTexts, sourceFor, hasText } from './notice-source.mjs';

/* '내는 줄' 판정은 앱과 같은 apply-channel.js 한 곳 — 베끼지 않는다 */
const AC = createRequire(import.meta.url)('../apply-channel.js');
const PORTAL_SUBMIT = AC.PORTAL_SUBMIT;
const PORTAL_NOT_SUBMIT = AC.PORTAL_NOT_SUBMIT;
const NOT_EVIDENCE = AC.NOT_EVIDENCE;

/* 이름 꼴 셋 — 괄호 안 영문 포털 이름 · 영문 대문자/ON+한글 이름 뒤 화살표·줄표로 이어지는 포털 · '…포털·포탈·정보시스템에서 신청' 의 앞 낱말 */
const NAME_FORMS = [
  /포[털탈]\s*\(\s*([A-Za-z][A-Za-z0-9 ]{1,15}?)\s*\)/,
  /((?:[A-Z]{2,}[A-Za-z0-9]*)|ON\s?[가-힣]{2,4})\s*[-–>→]\s*포[털탈]/,
  /([가-힣A-Za-z0-9]{2,12}(?:포털|포탈|정보시스템))(?:\s*시스템)?\s*(?:에서|을\s*통해|를\s*통해)\s*(?:온라인\s*)?(?:신청|접수)/,
];
/* 여러 학교에 흔한 이름은 열쇠로 쓰지 않는다 — 학교 고유 이름이 아니다 */
export const GENERIC_PORTAL = /^(포털|포탈|학교\s*포털|학생\s*포털|통합\s*포털|종합정보시스템|학사정보시스템|정보시스템|학사\s*시스템)$/;

/** 원문 줄들 → 신청 시스템 이름 후보 [{ name, line }] — 신청을 말하는 줄에서만. 출력·다운로드·문의 줄은 버린다. */
export function portalNameCandidates(lines) {
  const out = [];
  for (const raw of Array.isArray(lines) ? lines : String(lines || '').split('\n')) {
    const line = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!line || line.length > 300) continue;
    if (NOT_EVIDENCE.test(line) || PORTAL_NOT_SUBMIT.test(line) || /출력|다운로드|내려받/.test(line)) continue;
    if (!PORTAL_SUBMIT.test(line)) continue;
    for (const re of NAME_FORMS) {
      const m = line.match(re);
      if (!m) continue;
      const name = m[1].replace(/\s+/g, ' ').trim();
      if (name && !out.some((o) => o.name === name)) out.push({ name, line: line.slice(0, 200) });
      break;
    }
  }
  return out;
}

/**
 * 정식 등록 항목 + 원문 → 학교별 후보 [{ school, best:{ system, count, evidence[] }, others[], unique }].
 * 이미 표에 있는 학교도 센다(표에 없는 '새 시스템'이 나올 수 있다) — 표의 열쇠(knownSystems)와 같은 이름은 뺀다.
 * unique: 학교 고유 이름(흔한 이름 아님 · 다른 학교 후보에 같은 이름이 없음)이고 근거가 2건 이상인가 — 표에 더할 후보.
 */
export function portalCandidates(items, sourceText, { knownSystems = new Set() } = {}) {
  const by = new Map();
  for (const it of items || []) {
    const school = (it.eligibility || {}).schoolOnly;
    if (!school || it.program) continue;
    const text = sourceText(it);
    if (!text) continue;
    const m = by.get(school) || new Map();
    for (const c of portalNameCandidates(text)) {
      if (knownSystems.has(c.name)) continue;
      const row = m.get(c.name) || { system: c.name, count: 0, evidence: [] };
      if (row.evidence.some((e) => e.id === it.id)) continue;
      row.count += 1;
      if (row.evidence.length < 2) row.evidence.push({ id: it.id, text: c.line.slice(0, 160) });
      m.set(c.name, row);
    }
    if (m.size) by.set(school, m);
  }
  const schoolsOf = new Map();
  for (const [school, m] of by) for (const name of m.keys()) schoolsOf.set(name, (schoolsOf.get(name) || new Set()).add(school));
  return [...by.entries()].map(([school, m]) => {
    const rows = [...m.values()].sort((a, b) => b.count - a.count);
    const best = rows[0];
    const unique = !GENERIC_PORTAL.test(best.system) && (schoolsOf.get(best.system) || new Set()).size === 1 && best.count >= 2;
    return { school, best, others: rows.slice(1), unique };
  }).sort((a, b) => b.best.count - a.best.count);
}

function main() {
  const HERE = new URL('.', import.meta.url);
  const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8'));
  const readOr = (u, d) => { try { return JSON.parse(fs.readFileSync(u, 'utf8')); } catch { return d; } };
  const idx = indexTexts(readOr(new URL('extracted/notices-text.json', HERE), {}), readOr(new URL('extracted/browser-bodies.json', HERE), {}));
  const sourceText = (it) => { const src = sourceFor(it, idx); return hasText(src) ? src.text : null; };
  const out = portalCandidates(reg.items, sourceText, { knownSystems: new Set(AC.PORTAL_SYSTEMS.map(([k]) => k)) });
  const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  fs.writeFileSync(new URL('portal-candidates.json', HERE), JSON.stringify({ updatedAt: TODAY, note: '학교별 신청 시스템 이름 후보 — 정식 등록 공고 원문에서 읽은 것(apply-channel.js PORTAL_SYSTEMS 에 없는 이름만). unique=학교 고유 이름 · 근거 2건 이상. 사람이 확인해 apply-channel.js PORTAL_SYSTEMS·data.js PORTAL_SYSTEM_INFO 에 같은 열쇠로 넣는다(주소는 정찰로 확인한 것만).', items: out }, null, 1) + '\n');
  /* 리포트 파일은 부르는 쪽이 준다(브라우저 수집은 browser-report.md · 리뷰 3차 2026-09-30) · 기본 report.md */
  const reportArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const REPORT = new URL(reportArg || 'report.md', reportArg && reportArg.includes('/') ? new URL('../', HERE) : HERE);
  if (fs.existsSync(REPORT) && out.length) {
    fs.appendFileSync(REPORT, ['', `### 🏛 학교 신청 시스템 후보 — ${out.length}개교 (아직 표에 없는 이름)`,
      '정식 등록 공고 원문에서 학교별 신청 시스템 이름을 모았어요. ✅ 는 그 학교에만 나오고 근거가 2건 이상인 이름이에요 — 확인하고 apply-channel.js 시스템 표에 넣어 주세요(주소는 정찰로 확인한 것만).',
      ...out.slice(0, 12).map((c) => `- ${c.unique ? '✅ ' : ''}**${c.school}** → ${c.best.system} (${c.best.count}건${c.others.length ? ` · 그 밖 ${c.others.map((o) => o.system).join('/')}` : ''}) — 예: ${c.best.evidence[0] ? `"${c.best.evidence[0].text.slice(0, 80)}"` : '근거 문장 없음'}`)].join('\n'));
  }
  console.log(`portal-candidates: ${out.length} schools`);
}

/* 직접 실행할 때만 쓴다(두 수집 워크플로의 `node collector/portal-candidates.mjs [리포트]`) — 불러오는 순간 파일을 쓰던 것을 막는다 */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
