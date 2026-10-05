/* ============================================================
   지난 리포트 이슈 정리 규칙 한 곳 (2026-10-04 로봇·도구 점검 · 묶음 alerts)
   ------------------------------------------------------------
   .github/workflows/close-old-reports.yml 이 부른다. 옛 판은 워크플로 안 jq 에 '🤖 장학공고'·'🖥 브라우저형' 두 종류만
   적혀 있어, 그 뒤에 생긴 리포트(🗞 교내 소식 · 📘 작성 규칙 학습 · ✅ 자격 · 🔍 누락 감사 · 🔍 게시판 정찰 — 그 도구는 2026-10-05 지웠다)는
   **영영 안 닫혔다**(10-04 열린 이슈 186건).
   규칙: 유형마다 최신 keep 건은 남기고, 나머지 가운데 days 일보다 오래된 것만 고른다.
     · 수집 리포트 셋은 3건을 남긴다 — 수집 로봇의 '새 공고 0건' 알림이 댓글을 달 열린 리포트가 필요하다.
     · 사람 댓글이 있는 리포트는 워크플로가 한 번 더 걸러 남긴다(컨펌 지시가 적혀 있을 수 있다).
   🔴 경보·사냥꾼·인스타(🚨 · 🔧 · 📸 · 🛰 · 🎨)는 **규칙에 아예 없다** — 각자 회복하면 닫는 길이 따로 있다
      (tools/alert-issue.mjs resolve · 하트비트 · insta/ready-issues.mjs). 여기에 넣지 말 것(관문 alerts ②).
   실행:  node tools/report-retention.mjs /tmp/open.json [--days 14]
          (open.json = gh issue list --json number,title,createdAt) → '번호<TAB>제목' 줄
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REPORT_RULES = [
  { kind: 'general', re: /^🤖 장학공고 수집 리포트/, keep: 3 },
  { kind: 'browser', re: /^🖥 브라우저형 수집 리포트/, keep: 3 },
  { kind: 'news', re: /^🗞 교내 소식 수집 리포트/, keep: 3 },
  { kind: 'essay', re: /^📘 작성 규칙 학습/, keep: 1 },
  { kind: 'elig', re: /^✅ 자격/, keep: 1 },
  { kind: 'coverage', re: /^🔍 공고 누락 감사/, keep: 1 },
  /* '🔍 게시판 후보 정찰 리포트'는 뺐다 — 그 도구(probe-boards.yml · collector/probe.mjs)를 2026-10-05 지웠다(같은 일은 find-boards·probe-links 가 한다) */
];

export const ruleFor = (title) => REPORT_RULES.find((r) => r.re.test(String(title ?? '').trim())) || null;

/** 닫을 리포트 고르기 (순수 함수) — issues: [{ number, title, createdAt }] → [{ number, title, kind }] (번호 순) */
export function pickToClose(issues, { now = Date.now(), days = 14 } = {}) {
  const cut = now - Number(days) * 864e5;
  const groups = new Map();
  for (const i of issues || []) {
    const r = ruleFor(i && i.title);
    if (!r) continue;
    if (!groups.has(r.kind)) groups.set(r.kind, { rule: r, list: [] });
    groups.get(r.kind).list.push(i);
  }
  const out = [];
  for (const { rule, list } of groups.values()) {
    list.sort((a, b) => (Date.parse(b.createdAt) - Date.parse(a.createdAt)) || (b.number - a.number));
    for (const i of list.slice(rule.keep)) {
      const at = Date.parse(i.createdAt);
      if (Number.isFinite(at) && at < cut) out.push({ number: i.number, title: i.title, kind: rule.kind });
    }
  }
  return out.sort((a, b) => a.number - b.number);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const di = args.indexOf('--days');
  const days = Number(di >= 0 ? args[di + 1] : (process.env.DAYS || 14));
  if (!file || !Number.isFinite(days) || days < 0) { console.error('쓰는 법: node tools/report-retention.mjs <open.json> [--days 14]'); process.exit(1); }
  const issues = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const c of pickToClose(issues, { days })) console.log(`${c.number}\t${c.title}`);
}
