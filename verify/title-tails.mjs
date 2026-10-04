/* 저장된 제목에 목록 꼬리(부서·작성자·게시일·조회수·행 번호·새글)가 남았는가 — 감사(audit-data.js)가 부른다 (2026-10-04)
   개발자 지적 "세종이도만 봐도 이름·날짜·원인 모를 숫자가 제목에 붙어 있네 · 다 수정하고 재발 방지".
   🔴 규칙을 여기 적지 않는다 — 저장하는 로봇들이 쓰는 collector/clean-title.mjs cleanTitle 을 그대로 돌려 **바뀌는 제목**을 센다.
   새 로봇·새 게시판이 청소를 건너뛰고 저장하면 여기 뜬다. 출력: 줄마다 `✕ 파일 | 제목 → 청소 결과` */
import fs from 'node:fs';
import { cleanTitle } from '../collector/clean-title.mjs';

const root = new URL('../', import.meta.url);
const rel = (p) => new URL(p, root);
const files = ['data/registered.json', 'data/notices.json', 'data/activities.json', 'data/external.json',
  ...fs.readdirSync(rel('data/notices')).filter((f) => f !== 'index.json' && f.endsWith('.json')).map((f) => `data/notices/${f}`)];
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(rel(f), 'utf8')); } catch { continue; }
  const items = Array.isArray(d) ? d : (d.items || d.notices || []);
  const key = f.endsWith('registered.json') ? 'name' : 'title';
  for (const it of items) {
    const t = it && it[key];
    if (t && cleanTitle(t) !== t) console.log(`✕ ${f} | ${t.slice(0, 70)} → ${cleanTitle(t).slice(0, 70)}`);
  }
}
