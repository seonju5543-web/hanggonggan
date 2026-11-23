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
   학교 창구로 내라는 말이 있으면(추천 배정·장학팀 제출·포털·우편 받는 곳이 학교 창구·국가근로) 건드리지 않는다 — 그건 그 학교 접수분이 맞다
   (CLAUDE.md 학교 범위 규칙 · 판정은 kind-evidence.mjs schoolWindowEvidence 한 곳).
   ⓪ 소급 (2026-11-23 · 원칙 7) — 예전 규칙으로 ①② 를 거쳐 전국으로 풀린 등록분도 매 실행 지금 규칙으로 다시 보고, 학교 창구 증거가 있으면
      게시 학교 한정으로 되돌린다(홍익 신용카드수수료장학 「우편제출 : … 학생처 장학팀」 · 과기대 국가근로 · 세종대 국가이공계 「추천대상자」 실측).
      되돌릴 대상 판정은 registered-merge.mjs revertTarget 한 곳 — 좁히는 쪽이라 마감이 지나도 본다.
   사람이 손댄 항목(scopeFrom 이 '관리자')은 건드리지 않는다. 결과는 항목의 scopeFrom 에 근거 문장으로 남기고 리포트에 적는다.
   ============================================================ */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { canonUrl } from './canon-url.mjs';
import { evidenceExcerpts } from './notice-source.mjs';   // 사람이 쓴 발췌는 원문 증거가 아니다(관리자 표식 줄을 뺀다 · 한 곳)
import { makeStripperMulti } from './page-boilerplate.mjs';   // 메뉴·푸터 껍데기를 걷어낸 본문만 읽는다 — 메뉴의 '발전기금'·'포털'이 증거로 세어졌다(첫 시험)
import { classifyKind, schoolWindowEvidence, domainForSchool } from './kind-evidence.mjs';
import { loadSchoolNames, schoolTokens } from './school-names.mjs';
import { promotableOn, absorbsOn, revertTarget, mergeSamePrograms } from './registered-merge.mjs';
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
/* 학교 도메인 — 규칙은 kind-evidence.mjs domainForSchool 한 곳(schools.json 주소 → 없으면 브라우저 대상 첫 후보 · 2026-10-05 점검 collect-16). 읽기만 한다 */
const browserTargets = (() => { try { return JSON.parse(fs.readFileSync(new URL('browser-targets.json', HERE), 'utf8')).targets || []; } catch { return []; } })();
const domainOf = (school) => domainForSchool(school, schools, browserTargets);

/* 이 항목이 '학교 한정 · 교외 · 로봇 등록 · 마감 전' 인가 — 승격 후보의 조건.
   🔴 마감 전만 (2026-10-05 점검 collect-14) — 지난 등록분을 풀면 44개교 모든 학생에게 '마감' 카드로 30일 보인다(부산대 희망사다리·동국대 파안 실례).
   합치는 두 쪽(③ 같은 사업) 모두 이 조건을 탄다. 판정은 registered-merge.mjs promotableOn 한 곳(이 파일은 불러오는 순간 실행되어 관문이 표본으로 못 잰다) */
export function isCandidate(it) {
  return promotableOn(it, TODAY);
}
/* 이미 전국인 로봇 등록분 — 같은 사업의 학교 한정 글을 **흡수**한다(범위는 그대로 · 게시 학교만 근거에 더한다 · 리뷰 3차 2026-09-30).
   여러 학교만 받는 공고(schoolsAny)는 그 학교가 목록에 있을 때만 — 판정은 registered-merge.mjs absorbsOn 한 곳 */
export function isNationalAbsorber(it, school) {
  return absorbsOn(it, school, TODAY);
}

/* 학교 창구로 받는다는 원문 증거 — 판정은 kind-evidence.mjs schoolWindowEvidence 한 곳(관문이 픽스처로 잰다) */
const schoolWindowOf = (it, body, school) => schoolWindowEvidence({ title: it.name, text: body, excerpts: evidenceExcerpts(it), school,
  applyPortal: it.applyPortal, applyEmail: it.applyEmail, domain: domainOf(school) });

/* 원문 증거로 전국인가. 학교 창구 문장이 있으면 절대 아니다. */
export function nationalEvidence(it, body) {
  const school = (it.eligibility || {}).schoolOnly;
  const k = classifyKind({ title: it.name, school, text: body, excerpts: evidenceExcerpts(it), applyEmail: it.applyEmail, applyPortal: it.applyPortal,
    tokens: schoolTokens(school, names), domain: domainOf(school), own: [] });
  if (!k.national || schoolWindowOf(it, body, school)) return null;
  return k.evidence.filter((e) => /학교 밖|본문/.test(e)).join(' · ') || null;
}

const lines = [];
let changed = 0;
let reverted = 0;
const items = reg.items;
/* ⓪ 소급 — 원문 증거로 풀었던 것을 지금 규칙으로 다시 본다. 학교 창구 증거가 있으면 게시 학교 한정으로 되돌린다(머리말 ⓪) */
for (const it of items) {
  const back = revertTarget(it);
  if (!back) continue;
  const body = bodyByKey.get(canonUrl(it.sourceUrl || '')) || '';
  if (!body && !evidenceExcerpts(it).length && !it.applyEmail) continue;   // 읽을 원문이 없으면 판단하지 않는다
  const why = schoolWindowOf(it, body, back.school);
  if (!why) continue;
  const was = String(it.scopeFrom).replace(/^로봇 \S+ · 원문 증거로 전국 — /, '').replace(/\s*\(게시: [^()]+\)\s*$/, '');
  it.eligibility = { ...(it.eligibility || {}), schoolOnly: back.school, ...(back.campus ? { campusOnly: back.campus } : {}) };
  it.scopeFrom = `로봇 ${TODAY} · 원문 재판정으로 학교 한정 — ${why} (전국으로 풀었던 근거: ${was})`;
  lines.push(`- 🏫 \`${it.id}\` ${(it.name || '').slice(0, 40)} — 전국 → ${back.school} 한정으로 되돌림 · ${why}`);
  changed++; reverted++;
}
/* ③ 다른 학교의 같은 사업 — 먼저 합친다(둘 다 후보일 때 한 건으로) · 짝짓기는 registered-merge.mjs mergeSamePrograms 한 곳 */
for (const m of mergeSamePrograms(items, TODAY, sameProgram, { reason: '다른 학교 게시판에도 같은 사업(자동 승격)' })) {
  lines.push(m.promoted
    ? `- 🌐 \`${m.keep.id}\` ${(m.keep.name || '').slice(0, 40)} ← \`${m.drop.id}\`(${m.dropSchool}) 와 같은 사업이라 합쳐 전국으로`
    : `- 🌐 \`${m.keep.id}\` ${(m.keep.name || '').slice(0, 40)} (이미 전국) ← \`${m.drop.id}\`(${m.dropSchool}) 같은 사업이라 흡수`);
  changed++;
}
/* ①② 원문 증거 */
for (const it of items) {
  if (!isCandidate(it)) continue;
  const body = bodyByKey.get(canonUrl(it.sourceUrl || '')) || '';
  if (!body && !evidenceExcerpts(it).length && !it.applyEmail) continue;   // 읽을 원문이 없으면 판단하지 않는다
  const why = nationalEvidence(it, body);
  if (!why) continue;
  const e = it.eligibility;
  const was = e.schoolOnly;
  const wasCampus = e.campusOnly;
  delete e.schoolOnly; delete e.campusOnly;
  /* 게시 학교(·캠퍼스)를 표식에 남긴다 — 규칙이 바뀌면 ⓪ 이 이 자리를 읽어 되돌린다(revertTarget) */
  it.scopeFrom = `로봇 ${TODAY} · 원문 증거로 전국 — ${why} (게시: ${was}${wasCampus ? ` · ${wasCampus}` : ''})`;
  lines.push(`- 🌐 \`${it.id}\` ${(it.name || '').slice(0, 40)} — ${why} (게시 ${was})`);
  changed++;
}
if (changed && WRITE) {
  reg.updatedAt = TODAY;
  fs.writeFileSync(REG, JSON.stringify(reg, null, 1) + '\n');
}
const head = `\n### 🌐 범위 승격 (학교 한정 → 전국) — ${changed - reverted}건${reverted ? ` · 🏫 학교 한정으로 되돌림 ${reverted}건` : ''}`;
const body = changed ? lines : ['- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.'];
if (WRITE && fs.existsSync(REPORT)) fs.appendFileSync(REPORT, ['', head, '원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털·우편 받는 곳·학교 추천·국가근로)로 내는 것은 그 학교 한정이 맞아 그대로 두고, 예전에 풀었던 것도 되돌립니다.', ...body].join('\n'));
console.log(`scope-promote: ${changed - reverted} promoted, ${reverted} reverted` + (WRITE ? '' : ' (dry)'));
