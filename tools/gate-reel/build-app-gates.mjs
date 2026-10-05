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
/* 사진이 바뀌었는지 재는 규칙은 학교 사진 도구와 한 곳(startScreenChanged — 원본 제목 대조) · 그 파일은 불러도 실행되지 않는다 */
import { startScreenChanged } from '../build-school-photos.mjs';

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
/* 🔴 같은 파일 이름이 다시 받은 뒤 다른 사진이 됐으면 만들지 않는다 (2026-10-05 점검 · refresh GATE-02) —
   받는 도구가 후보 순서로 번호를 매겨, 사진 수집을 다시 돌리면 'snu-1.jpg' 가 승인받지 않은 사진이 될 수 있다.
   승인된 목록(assets/gates/gates.json)의 공용 페이지 주소와 대조한다. 새 사진이 맞으면 눈으로 본 뒤 `--accept=snu,cau` 로 받아들인다. */
const gatesPath = path.join(ROOT, 'assets/gates/gates.json');
const approved = fs.existsSync(gatesPath) ? JSON.parse(fs.readFileSync(gatesPath, 'utf8')) : null;
const accept = new Set(((process.argv.find((a) => a.startsWith('--accept=')) || '').split('=')[1] || '').split(',').map((x) => x.trim()).filter(Boolean));
const changed = startScreenChanged(out, approved, accept);
if (changed.length) {
  console.error(`❌ 시작 화면 사진이 다시 받은 뒤 다른 사진이 됐다 — 다시 골라야 한다 (만들지 않음):\n   ${changed.join('\n   ')}`);
  process.exit(1);
}
fs.mkdirSync(path.join(ROOT, 'assets/gates'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/gates/gates.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`assets/gates/gates.json — ${out.length}개교 · 초점 있는 사진 ${out.filter((g) => g.focus).length}장`);
