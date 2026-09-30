/* ============================================================
   범위 승격 로봇 — 학교 한정으로 묶인 전국 사업을 원문 증거로 풀어 준다 (2026-09-30 신설 · 노션 F-5 재발)
   ------------------------------------------------------------
   자동 등록은 제목만 보고 게시한 학교로 `schoolOnly` 를 단다. 재단·구청·공단에 직접 내는 전국 사업도 그렇게 묶여
   다른 학교 학생에게 안 보인다(2026-09-23 에 49건을 손으로 풀었고, 44개교 복원 첫날 새 등록 24건 중 14건이 다시 그랬다).
   원문 본문은 뒤 단계(deepfetch·발췌)가 받아 오므로, 그 **뒤**에 이 로봇이 돌아 증거를 읽는다.

   전국으로 푸는 증거 (전부 원문 글자 — 추론 금지)
     ① 접수 이메일 도메인이 학교 밖(ac.kr 아님)
     ② 본문이 "재단(공단·진흥원·장학회)에 직접 제출 / 재단 홈페이지에서 신청 / 우편 접수"를 말하고, 학교 창구(장학팀·포털)로 내라는 말이 없음
     ③ 다른 학교 게시판에 같은 사업(programKey)이 등록돼 있음 → 합쳐서 전국 (registered-merge.mjs)
   학교 창구로 내라는 말이 있으면(추천 배정·장학팀 제출·포털) 건드리지 않는다 — 그건 그 학교 접수분이 맞다(CLAUDE.md 학교 범위 규칙).
   사람이 손댄 항목(scopeFrom 이 '관리자')은 건드리지 않는다. 결과는 항목의 scopeFrom 에 근거 문장으로 남기고 리포트에 적는다.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { canonUrl } from './canon-url.mjs';
import { makeStripperMulti } from './page-boilerplate.mjs';   // 메뉴·푸터 껍데기를 걷어낸 본문만 읽는다 — 메뉴의 '발전기금'·'포털'이 증거로 세어졌다(첫 시험)
import { classifyKind, schoolDomain, SCHOOL_APPLY_RE, domainMatches } from './kind-evidence.mjs';
import { loadSchoolNames, schoolTokens } from './school-names.mjs';
import { mergeInto } from './registered-merge.mjs';
const { sameProgram } = createRequire(import.meta.url)('../verify/entry-rules.cjs');

const HERE = new URL('.', import.meta.url);
const REG = new URL('../data/registered.json', HERE);
const TEXT = new URL('extracted/notices-text.json', HERE);
/* 리포트 파일은 부르는 쪽이 준다 — 브라우저 수집은 browser-report.md 만 커밋한다(리뷰 3차 2026-09-30). 기본은 report.md */
const reportArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const REPORT = new URL(reportArg || 'report.md', reportArg && reportArg.includes('/') ? new URL('../', HERE) : HERE);
const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const WRITE = !process.argv.includes('--dry');

const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
let texts = [];
try { texts = JSON.parse(fs.readFileSync(TEXT, 'utf8')); } catch { /* 본문 말뭉치 없음 */ }
const strip = makeStripperMulti([texts]);
const bodyByKey = new Map(texts.map((x) => [canonUrl(x.url), strip(x.url, x.text || '', { fallback: false })]));
const schools = JSON.parse(fs.readFileSync(new URL('schools.json', HERE), 'utf8')).schools || [];
const names = loadSchoolNames(new URL('../data.js', HERE));
const domainOf = (school) => { const row = schools.find((x) => x.school === school && x.boardUrl); return row ? schoolDomain(row.boardUrl) : ''; };

/* 이 항목이 '학교 한정 · 교외 · 로봇 등록' 인가 — 승격 후보의 조건 */
export function isCandidate(it) {
  const e = it.eligibility || {};
  return !!(it.auto && it.type === '교외' && e.schoolOnly && !/^관리자/.test(it.scopeFrom || ''));
}
/* 이미 전국인 로봇 등록분 — 같은 사업의 학교 한정 글을 **흡수**한다(범위는 그대로 · 게시 학교만 근거에 더한다 · 리뷰 3차 2026-09-30) */
export function isNationalAbsorber(it, school) {
  const e = it.eligibility || {};
  if (!(it.auto && it.type === '교외' && !e.schoolOnly && !/^관리자/.test(it.scopeFrom || ''))) return false;
  /* 여러 학교만 받는 공고(schoolsAny · "학교" 또는 "학교|캠퍼스")는 그 학교가 목록에 있을 때만 — 푸른등대 K-원전(13개교) 이 이 꼴 */
  return !e.schoolsAny || !school || e.schoolsAny.some((x) => String(x).split('|')[0] === school);
}

/* 원문 증거로 전국인가 — 순수 함수(관문이 픽스처로 돈다). 학교 창구 문장이 있으면 절대 아니다. */
export function nationalEvidence(it, body) {
  const school = (it.eligibility || {}).schoolOnly;
  const k = classifyKind({ title: it.name, school, text: body, excerpts: it.excerpts, applyEmail: it.applyEmail, applyPortal: it.applyPortal,
    tokens: schoolTokens(school, names), domain: domainOf(school), own: [] });
  const schoolWindow = SCHOOL_APPLY_RE.test(body || '') || !!it.applyPortal || domainMatches((it.applyEmail || '').split('@')[1], domainOf(school));
  if (!k.national || schoolWindow) return null;
  return k.evidence.filter((e) => /학교 밖|본문/.test(e)).join(' · ') || null;
}

const lines = [];
let changed = 0;
const items = reg.items;
/* ③ 다른 학교의 같은 사업 — 먼저 합친다(둘 다 후보일 때 한 건으로) */
for (let i = 0; i < items.length; i++) {
  const a = items[i];
  if (!isCandidate(a) && !isNationalAbsorber(a)) continue;
  for (let j = items.length - 1; j > i; j--) {
    const b = items[j];
    if (!isCandidate(b) || (b.eligibility || {}).schoolOnly === (a.eligibility || {}).schoolOnly) continue;
    if (!isCandidate(a) && !isNationalAbsorber(a, (b.eligibility || {}).schoolOnly)) continue;
    if (!sameProgram(a, b)) continue;
    const { promoted, absorbed } = mergeInto(a, b, { reason: '다른 학교 게시판에도 같은 사업(자동 승격)' });
    if (promoted) { lines.push(`- 🌐 \`${a.id}\` ${(a.name || '').slice(0, 40)} ← \`${b.id}\`(${(b.eligibility || {}).schoolOnly}) 와 같은 사업이라 합쳐 전국으로`); items.splice(j, 1); changed++; }
    else if (absorbed) { lines.push(`- 🌐 \`${a.id}\` ${(a.name || '').slice(0, 40)} (이미 전국) ← \`${b.id}\`(${(b.eligibility || {}).schoolOnly}) 같은 사업이라 흡수`); items.splice(j, 1); changed++; }
  }
}
/* ①② 원문 증거 */
for (const it of items) {
  if (!isCandidate(it)) continue;
  const body = bodyByKey.get(canonUrl(it.sourceUrl || '')) || '';
  if (!body && !(it.excerpts || []).length && !it.applyEmail) continue;   // 읽을 원문이 없으면 판단하지 않는다
  const why = nationalEvidence(it, body);
  if (!why) continue;
  const e = it.eligibility;
  const was = e.schoolOnly;
  delete e.schoolOnly; delete e.campusOnly;
  it.scopeFrom = `로봇 ${TODAY} · 원문 증거로 전국 — ${why} (게시: ${was})`;
  lines.push(`- 🌐 \`${it.id}\` ${(it.name || '').slice(0, 40)} — ${why} (게시 ${was})`);
  changed++;
}
if (changed && WRITE) {
  reg.updatedAt = TODAY;
  fs.writeFileSync(REG, JSON.stringify(reg, null, 1) + '\n');
}
const head = `\n### 🌐 범위 승격 (학교 한정 → 전국) — ${changed}건`;
const body = changed ? lines : ['- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.'];
if (WRITE && fs.existsSync(REPORT)) fs.appendFileSync(REPORT, ['', head, '원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.', ...body].join('\n'));
console.log(`scope-promote: ${changed} promoted` + (WRITE ? '' : ' (dry)'));
