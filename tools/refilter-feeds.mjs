#!/usr/bin/env node
/* 재단·지자체 피드(data/external.json)와 대외활동 피드(data/activities.json)에 지금 발행 규칙을 한 번 다시 건다 —
   학교·재단 사이트를 두드리지 않는다 (2026-10-05 점검 qfeeds 소급 · 원칙 7).
   수집 로봇(collector/collect.mjs)이 발행할 때마다 **같은 규칙을 전체에** 다시 걸므로, 이 도구 없이도 다음 장학 수집 실행에
   스스로 정리된다. 규칙을 바꾼 날 바로 반영하고 싶을 때만 쓴다.
   규칙은 불러 쓴다 — external-clean.mjs(마감 채우기·다듬기·거름) · activity-excerpts.mjs(마감 판독기 = 수집 때와 같은 것 ·
   활동 자격 줄 거름 sanitizeElig — 여러 갈래 나이·개인정보 안내문).
   🔴 여기 규칙을 베끼지 말 것. 저장 꼴은 수집 로봇과 같다(JSON.stringify(x, null, 1) · 끝 줄바꿈 없음).
   사용: node tools/refilter-feeds.mjs          (무엇이 바뀌는지만 보인다)
         node tools/refilter-feeds.mjs --write  (저장) */
import fs from 'node:fs';
import { tidyExternal, dropReason, fillDeadlineFromHint } from '../collector/external-clean.mjs';
import { activityExcerpts, sanitizeElig } from '../collector/activity-excerpts.mjs';

const WRITE = process.argv.includes('--write');
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);   // KST — 수집 로봇의 notices.updatedAt 과 같은 시계
const readJson = (u) => JSON.parse(fs.readFileSync(u, 'utf8'));
const lines = [];

/* ── 재단·지자체 — 마감 칸 채우기 → 다듬기 → 거름 (collect.mjs 발행 순서와 같다) ── */
const extPath = new URL('../data/external.json', import.meta.url);
if (!fs.existsSync(extPath)) lines.push('재단·지자체 — data/external.json 없음, 건너뜀');
else {
  const p = extPath;
  const ext = readJson(p);
  const before = (ext.items || []).length;
  let filled = 0;
  const dropped = [];
  for (const n of ext.items || []) if (fillDeadlineFromHint(n, (t) => activityExcerpts(t).deadline)) filled++;
  ext.items = (ext.items || []).map(tidyExternal).filter((n) => {
    const why = dropReason(n, today);
    if (why) dropped.push(`${why} · ${String(n.title).slice(0, 40)}${n.deadline ? ` (마감 ${n.deadline})` : ''}`);
    return !why;
  });
  lines.push(`재단·지자체 ${before}건 → ${ext.items.length}건 (마감 채움 ${filled} · 뺌 ${dropped.length})`, ...dropped.map((d) => `  - ${d}`));
  if (WRITE && (filled || dropped.length)) fs.writeFileSync(p, JSON.stringify(ext, null, 1));
}

/* ── 대외활동 — 자격 줄 거름 (collect.mjs 발행의 acts.items.forEach(sanitizeElig) 와 같다) ── */
const actsPath = new URL('../data/activities.json', import.meta.url);
if (!fs.existsSync(actsPath)) lines.push('대외활동 — data/activities.json 없음, 건너뜀');
else {
  const p = actsPath;
  const acts = readJson(p);
  const changed = (acts.items || []).filter((n) => sanitizeElig(n));
  lines.push(`대외활동 ${(acts.items || []).length}건 중 자격 줄을 고친 글 ${changed.length}건`, ...changed.map((n) => `  - ${String(n.title).slice(0, 40)}`));
  if (WRITE && changed.length) fs.writeFileSync(p, JSON.stringify(acts, null, 1));
}

console.log(lines.join('\n'));
console.log(WRITE ? '저장했습니다.' : '(보기만 했습니다 — 저장하려면 --write)');
