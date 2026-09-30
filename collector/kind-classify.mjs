/* ============================================================
   교내·교외 소급 판정 로봇 (2026-09-30 신설 — 개발자 지시 "장학금 판정을 자동화")
   ------------------------------------------------------------
   자동 등록은 제목만 보고 구분(type)을 정한다. 이 로봇은 원문 본문·발췌·접수처가 도착한 **뒤**에 돌아
   증거 판정기(kind-evidence.mjs classifyKind)로 다시 보고,
     · 확신 high 로 판정이 뒤집히면 → 구분을 고치고 근거(kindEvidence)를 남긴다. 교내로 뒤집힌 제도 이름은
       학습 표(own-programs.json)에 적어 다음 등록부터 제목만으로도 잡는다(match-engine noticeKind 의 셋째 인자).
     · 확신 mid 면 → 고치지 않고 후보(kind-candidates.json)에 적어 리포트·관리자에게 보인다.
   사람이 정한 구분(kindFrom 이 '관리자')은 건드리지 않는다. 학습 표의 blocked 에 있는 이름은 배우지 않는다.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { canonUrl } from './canon-url.mjs';
import { makeStripperMulti } from './page-boilerplate.mjs';   // 메뉴·푸터 껍데기를 걷어낸 본문만 읽는다 — 메뉴의 '발전기금'·'포털'이 증거로 세어졌다(첫 시험)
import { classifyKind, schoolDomain, programNameForTable } from './kind-evidence.mjs';
import { loadSchoolNames, schoolTokens } from './school-names.mjs';
const ME = createRequire(import.meta.url)('../match-engine.js');
const NOTICE_CAMPUS_MARK = ME.NOTICE_CAMPUS_MARK;
const OWN_PROGRAMS = ME.OWN_PROGRAMS || {};

const HERE = new URL('.', import.meta.url);
const REG = new URL('../data/registered.json', HERE);
const TEXT = new URL('extracted/notices-text.json', HERE);
const OWN = new URL('own-programs.json', HERE);
const CAND = new URL('kind-candidates.json', HERE);
const REPORT = new URL('report.md', HERE);
const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const WRITE = !process.argv.includes('--dry');

const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
let texts = [];
try { texts = JSON.parse(fs.readFileSync(TEXT, 'utf8')); } catch { /* 없음 */ }
const strip = makeStripperMulti([texts]);
const bodyByKey = new Map(texts.map((x) => [canonUrl(x.url), strip(x.url, x.text || '', { fallback: false })]));
const schools = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8')).schools || [];
const names = loadSchoolNames(new URL('../data.js', HERE));
const domainOf = (school) => { const row = schools.find((x) => x.school === school && x.boardUrl); return row ? schoolDomain(row.boardUrl) : ''; };
let own = { programs: {}, blocked: {} };
try { own = { programs: {}, blocked: {}, ...JSON.parse(fs.readFileSync(OWN, 'utf8')) }; } catch { /* 첫 실행 */ }

/* 어느 학교의 공고인가 — 학교 한정이면 그 학교, 아니면 게시판을 적은 요약에서 읽는다(없으면 판정 안 함) */
export function schoolOf(it) {
  const e = it.eligibility || {};
  if (e.schoolOnly) return e.schoolOnly;
  const m = String(it.summary || '').match(/^(.+?대학교(?:\s\S+캠퍼스)?) 게시판/);
  return m ? m[1] : null;
}

const flipped = []; const cands = []; let learned = 0;
for (const it of reg.items) {
  if (!it.auto || /^관리자/.test(it.kindFrom || '')) continue;
  const school = schoolOf(it); if (!school) continue;
  const body = bodyByKey.get(canonUrl(it.sourceUrl || '')) || '';
  if (!body && !(it.excerpts || []).length) continue;   // 읽을 원문이 없으면 제목 판정을 그대로 둔다
  const ownNames = [...(OWN_PROGRAMS[school] || []), ...((own.programs[school] || []).map((p) => p.name))];
  const k = classifyKind({ title: it.name, school, provider: it.provider, text: body, excerpts: it.excerpts, applyEmail: it.applyEmail, applyPortal: it.applyPortal,
    tokens: schoolTokens(school, names), domain: domainOf(school), campusMark: NOTICE_CAMPUS_MARK, own: ownNames });
  if (k.kind !== it.type) {
    if (k.confidence === 'high') {
      const was = it.type;
      it.type = k.kind;
      it.kindEvidence = k.evidence.slice(0, 4);
      it.kindConfidence = 'high';
      it.kindFrom = `로봇(원문) ${TODAY}`;
      flipped.push(`- ${was} → **${k.kind}** \`${it.id}\` ${(it.name || '').slice(0, 40)} — ${k.evidence.slice(0, 2).join(' · ')}`);
      if (k.kind === '교내') {
        const pname = programNameForTable(it.name, schoolTokens(school, names));
        const blocked = new Set((own.blocked[school] || []).map((p) => p.name || p));
        if (pname && !ownNames.includes(pname) && !blocked.has(pname)) {
          (own.programs[school] ||= []).push({ name: pname, evidence: k.evidence.slice(0, 2).join(' · '), from: it.id, at: TODAY });
          learned++;
        }
      }
    } else if (k.confidence === 'mid') {
      cands.push({ id: it.id, school, name: it.name, now: it.type, suggest: k.kind, evidence: k.evidence.slice(0, 3), at: TODAY });
    }
  } else if (!it.kindEvidence || it.kindFrom === '로봇(제목)') {
    /* 판정은 같아도 원문 증거를 남긴다 — 관리자가 "왜 교외인가"를 볼 수 있게 */
    it.kindEvidence = k.evidence.slice(0, 3); it.kindConfidence = k.confidence; it.kindFrom = `로봇(원문) ${TODAY}`;
  }
}
if (WRITE) {
  if (flipped.length || reg.items.some((i) => i.kindFrom && i.kindFrom.startsWith('로봇(원문)'))) { reg.updatedAt = reg.updatedAt || TODAY; fs.writeFileSync(REG, JSON.stringify(reg, null, 1) + '\n'); }
  if (learned) fs.writeFileSync(OWN, JSON.stringify(own, null, 1) + '\n');
  fs.writeFileSync(CAND, JSON.stringify({ updatedAt: TODAY, items: cands }, null, 1) + '\n');
  if (fs.existsSync(REPORT)) {
    const out = ['', `### 🏫 교내·교외 원문 판정 — 바뀐 것 ${flipped.length}건 · 후보 ${cands.length}건 · 학교 제도 새로 배움 ${learned}건`,
      '판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.',
      ...(flipped.length ? flipped : ['- 뒤집힌 판정 없음']),
      ...cands.slice(0, 12).map((c) => `- 후보 ${c.now} → ${c.suggest}? \`${c.id}\` ${c.name.slice(0, 40)} — ${c.evidence.join(' · ')}`)];
    fs.appendFileSync(REPORT, out.join('\n'));
  }
}
console.log(`kind-classify: ${flipped.length} flipped, ${cands.length} candidates, ${learned} learned` + (WRITE ? '' : ' (dry)'));
