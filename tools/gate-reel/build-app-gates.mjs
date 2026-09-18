/* 앱이 읽는 사진 목록(assets/gates/gates.json)을 만든다 (2026-09-18 · 노션 UI-3).
   node tools/gate-reel/build-app-gates.mjs
   재료: docs/designs/assets/gates/manifest.json 의 picks(14개교 한 장씩) + reel.html 의 FOCUS(사진별 초점).
   🔴 사진 파일은 여기서 옮기지 않는다 — 앱용 사본은 가로 최대 1000px 로 다시 눌러 assets/gates/ 에 둔다:
      $FF -y -i docs/designs/assets/gates/<파일> -vf "scale='min(1000,iw)':-2" -q:v 4 assets/gates/<파일>   (FF 는 README 의 ffmpeg)
   🔴 출처 줄(credit)은 화면에 그대로 뜬다 — '정문' 이라고 적지 않는다(연세대 언더우드관·건국대 일감호처럼
      정문이 아닌 사진이 있다 · 확인 안 한 것을 단정하지 않는다). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/designs/assets/gates/manifest.json'), 'utf8'));
const reel = fs.readFileSync(path.join(ROOT, 'tools/gate-reel/reel.html'), 'utf8');
const focusSrc = (reel.match(/const FOCUS = (\{[^}]*\});/) || [])[1] || '{}';
const FOCUS = JSON.parse(focusSrc.replace(/'/g, '"'));

const picks = new Set(manifest.picks || []);
const out = [];
for (const s of manifest.schools) {
  const f = (s.files || []).find((x) => picks.has(x.file));
  if (!f) { console.error(`⚠️ ${s.name}: 고른 사진이 없다`); continue; }
  out.push({
    id: s.id, name: s.name, file: f.file, focus: FOCUS[f.file] || null,
    author: f.author || '', license: f.license || '', shareAlike: !!f.shareAlike, page: f.pageUrl || '',
    credit: `${s.name} · 사진 ${f.author || '작가 미상'} · ${f.license} · Wikimedia Commons`,
  });
}
fs.mkdirSync(path.join(ROOT, 'assets/gates'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/gates/gates.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`assets/gates/gates.json — ${out.length}개교 · 초점 있는 사진 ${out.filter((g) => g.focus).length}장`);
