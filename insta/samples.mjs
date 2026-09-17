/**
 * 판형 견본 — 판형마다 **같은 공고**의 카드 전부를 그려 `insta/samples/<번호>-<장>.jpg` 로 남긴다.
 * 관리자 화면·메일이 "3번은 이렇게 생겼다" 를 보여 주는 그림. 공고는 판형끼리 비교되게 하나로 고정한다
 * (자격·제한·금액이 다 있는 공고를 고른다 — 없으면 점수 1등).
 * 🔴 렌더러를 **그대로 부른다**(spawn) — 판형·폰트·넘침 규칙을 여기 베끼지 않는다.
 * 실행: node insta/samples.mjs [--notice=이름일부]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allNotices } from './notices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'insta', 'out');
const DIR = join(ROOT, 'insta', 'samples');
const want = process.argv.find((a) => a.startsWith('--notice='))?.slice(9);
const today = Date.now();
const { items } = allNotices();
const full = (x) => { const f = x.fields || {}; return f['특정자격'] && f['자격제한'] && /[0-9]/.test(f['지원금액'] || '') && x.due && new Date(`${x.due}T23:59:59+09:00`) > today; };
const pick = want ? items.find((x) => (x.org + x.name).includes(want)) : items.filter(full).sort((a, b) => (a.org + a.name).localeCompare(b.org + b.name))[0];
if (!pick) { console.error('견본으로 쓸 공고가 없습니다.'); process.exit(1); }
console.log(`■ 견본 공고 — ${pick.org} · ${pick.name}`);

const r = spawnSync('node', [join(ROOT, 'insta/render.mjs'), pick.code, '--tpl=all'], { stdio: 'inherit', cwd: ROOT, env: process.env });
if (r.status !== 0) { console.error(`🚨 렌더 실패 (${r.status})`); process.exit(r.status || 1); }

const tpls = JSON.parse(readFileSync(join(ROOT, 'insta/templates.json'), 'utf8')).templates;
rmSync(DIR, { recursive: true, force: true }); mkdirSync(DIR, { recursive: true });
const index = [];
for (const t of tpls) {
  const files = readdirSync(OUT).filter((f) => f.startsWith(`${t.id}-`) && f.endsWith('.jpg')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  files.forEach((f, i) => copyFileSync(join(OUT, f), join(DIR, `${t.no}-${i + 1}.jpg`)));
  index.push({ no: t.no, id: t.id, name: t.name, cards: files.length });
  console.log(`  ${t.no}번 ${t.name} — ${files.length}장`);
}
writeFileSync(join(DIR, 'index.json'), `${JSON.stringify({ notice: { code: pick.code, org: pick.org, name: pick.name }, at: new Date(today + 9 * 36e5).toISOString().slice(0, 10), templates: index }, null, 1)}\n`);
console.log(`  → insta/samples/ (${index.length}판형)`);
