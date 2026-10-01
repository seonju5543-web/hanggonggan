/* ============================================================
   학교 포털 표 후보 (2026-09-30 신설 — 개발자 지시 "해결책 전체 시행" ⑤)
   ------------------------------------------------------------
   data.js 의 SCHOOL_PORTALS(학교별 장학 신청 포털)는 경희대·한국외대 둘뿐이다(노션 UI-20). 44개교를 사람이 하나씩
   찾아 채울 수는 없다. 그런데 정식 등록 항목마다 발췌기가 원문에서 **접수 시스템**(applyPortal · findApplyPortal)을
   이미 읽어 둔다. 학교별로 그 값을 모아 가장 많이 나온 시스템과 근거 문장을 후보로 낸다.
   🔴 표에 넣는 것은 사람이다 — 여기서는 후보와 근거만 적는다(주소를 짐작해 채우지 않는다 · CLAUDE.md 포털 신청 규칙).
   출력: collector/portal-candidates.json + 리포트 절.
   ============================================================ */
import fs from 'node:fs';
const HERE = new URL('.', import.meta.url);
const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8'));
const dataJs = fs.readFileSync(new URL('../data.js', HERE), 'utf8');
const portalBlock = (() => { const a = dataJs.indexOf('const SCHOOL_PORTALS = {'); return a < 0 ? '' : dataJs.slice(a, dataJs.indexOf('\n};', a)); })();
const known = new Set([...portalBlock.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((m) => m[1]));
const TODAY = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

export function portalCandidates(items, knownSchools = new Set()) {
  const by = new Map();
  for (const it of items || []) {
    const school = (it.eligibility || {}).schoolOnly;
    if (!school || !it.applyPortal || knownSchools.has(school)) continue;
    const m = by.get(school) || new Map();
    const row = m.get(it.applyPortal) || { system: it.applyPortal, count: 0, evidence: [] };
    row.count += 1;
    if (row.evidence.length < 2 && it.applyPortalSource) row.evidence.push({ id: it.id, text: String(it.applyPortalSource).slice(0, 160) });
    m.set(it.applyPortal, row); by.set(school, m);
  }
  return [...by.entries()].map(([school, m]) => {
    const rows = [...m.values()].sort((a, b) => b.count - a.count);
    return { school, best: rows[0], others: rows.slice(1) };
  }).sort((a, b) => b.best.count - a.best.count);
}

const out = portalCandidates(reg.items, known);
fs.writeFileSync(new URL('portal-candidates.json', HERE), JSON.stringify({ updatedAt: TODAY, note: '학교별 접수 시스템 후보 — 정식 등록 항목의 applyPortal 을 모은 것. 사람이 확인해 data.js SCHOOL_PORTALS 에 넣는다(주소는 원문·정찰로 확인한 것만).', items: out }, null, 1) + '\n');
/* 리포트 파일은 부르는 쪽이 준다(브라우저 수집은 browser-report.md · 리뷰 3차 2026-09-30) · 기본 report.md */
const reportArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const REPORT = new URL(reportArg || 'report.md', reportArg && reportArg.includes('/') ? new URL('../', HERE) : HERE);
if (fs.existsSync(REPORT) && out.length) {
  fs.appendFileSync(REPORT, ['', `### 🏛 학교 포털 표 후보 — ${out.length}개교 (표에 없는 학교만)`,
    '정식 등록 공고의 접수 시스템을 학교별로 모았어요. 확인하고 data.js SCHOOL_PORTALS 에 넣어 주세요(주소는 원문·정찰로 확인한 것만).',
    ...out.slice(0, 12).map((c) => `- **${c.school}** → ${c.best.system} (${c.best.count}건${c.others.length ? ` · 그 밖 ${c.others.map((o) => o.system).join('/')}` : ''}) — 예: ${c.best.evidence[0] ? `"${c.best.evidence[0].text.slice(0, 80)}"` : '근거 문장 없음'}`)].join('\n'));
}
console.log(`portal-candidates: ${out.length} schools`);
