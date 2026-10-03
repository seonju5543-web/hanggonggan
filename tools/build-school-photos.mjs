#!/usr/bin/env node
/* 학교 대표 사진 — 소식 카드에 그 글의 사진이 없을 때 대신 보이는 학교 사진 (2026-10-03 개발자 지시:
   "썸네일이 없는 공고들에 대해서는 각 학교의 가장 예쁜 사진들(각 학교의 대표성을 띄울 수 있는 사진들)로 대체").

   재료: docs/designs/assets/gates/ — 위키미디어 공용의 열린 라이선스 사진(tools/fetch-gate-photos.mjs 가 받은 후보).
   고른 기록: docs/designs/assets/gates/school-photo-picks.json — 학교마다 눈으로 보고 고른 사진(최대 3장)과 자를 자리.
     시작 화면 14곳은 이미 승인받은 그 사진(manifest.picks)을 그대로 쓴다.
   만드는 것: assets/schools/<학교키>-<바이트 해시 8자>.webp (가로 640px) + assets/schools/photos.json (앱이 받는 목록·출처 줄).

   🔴 파일 이름에 바이트 해시를 넣는다 — 서비스워커가 그림을 캐시 우선으로 들어 같은 이름을 다시 쓰면 옛 그림이 남는다(소식 썸네일과 같은 규칙).
   🔴 라이선스는 CC0 · CC BY · CC BY-SA · 퍼블릭 도메인만(NC·ND 는 받는 로봇이 이미 버린다 — 여기서 한 번 더 막는다).
      BY·BY-SA 는 표기 의무라 photos.json 의 credit 을 앱이 구역 아래에 적는다(관문이 대조).
   실행: node tools/build-school-photos.mjs   (sharp 가 필요하다 — npm i --no-save sharp) */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), '..');
const SRC = path.join(ROOT, 'docs/designs/assets/gates');
const OUT = path.join(ROOT, 'assets/schools');
const WIDTH = 640;          // 72px 정사각(×3 = 216)도, 시안의 큰 카드(폭 350 × 화면 밀도)도 견디는 폭
const QUALITY = 72;
const ME = createRequire(import.meta.url)(path.join(ROOT, 'match-engine.js'));

export const OK_LICENSE = /^(CC0|CC BY(?:-SA)? [0-9.]+(?: [a-z]{2})?|Public domain|CC-PD-Mark|PD)$/i;
export const FOCUS_RE = /^\d{1,3}% \d{1,3}%$/;

/* 위키미디어 Artist 칸은 HTML 조각이다(예: Pixabay 출처 문장) — 글자만 남긴다 */
export function cleanAuthor(s) {
  const t = String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const pix = t.match(/Pixabay로부터 입수된\s*(.+?)님의 이미지/);
  if (pix) return `${pix[1].trim()} (Pixabay)`;
  return t.slice(0, 60);
}

export function creditLine(f) {
  return `${cleanAuthor(f.author) || '작가 미상'} · ${f.license}`;
}

async function main() {
  const sharp = (await import('sharp')).default;
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  const picksPath = path.join(SRC, 'school-photo-picks.json');
  const chosen = JSON.parse(fs.readFileSync(picksPath, 'utf8')).schools || {};
  const files = new Map();
  for (const s of manifest.schools || []) for (const f of s.files || []) files.set(f.file, { ...f, school: s.name });
  const gatesApp = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/gates/gates.json'), 'utf8'));
  /* 시작 화면 14곳 — 승인받은 그 한 장(manifest.picks)을 쓴다. 고른 기록에 그 학교가 따로 있으면 그것이 이긴다 */
  for (const g of gatesApp) {
    if (chosen[g.name]) continue;
    chosen[g.name] = [{ file: g.file, focusSquare: g.focus || '50% 50%', what: '시작 화면 사진(승인)' }];
  }
  fs.mkdirSync(OUT, { recursive: true });
  const out = {
    note: '소식 카드에 그 글의 사진이 없을 때 대신 보이는 학교 대표 사진 (2026-10-03). 만드는 곳 tools/build-school-photos.mjs · 고른 기록 docs/designs/assets/gates/school-photo-picks.json · 사진은 위키미디어 공용의 열린 라이선스 — credit 을 구역 아래에 적는다.',
    schools: {},
  };
  const keep = new Set(['photos.json']);
  const problems = [];
  for (const [school, list] of Object.entries(chosen)) {
    if (!ME.SERVED_SCHOOLS.includes(school)) { problems.push(`${school}: 서비스 학교가 아니다`); continue; }
    const key = ME.noticeFileKey(school);
    const entries = [];
    for (const p of list.slice(0, 3)) {
      const meta = files.get(p.file);
      if (!meta) { problems.push(`${school}: ${p.file} 가 manifest 에 없다`); continue; }
      if (!OK_LICENSE.test(meta.license || '') || /NC|ND/.test(meta.license)) { problems.push(`${school}: ${p.file} 라이선스 ${meta.license}`); continue; }
      const src = path.join(SRC, p.file);
      if (!fs.existsSync(src)) { problems.push(`${school}: ${p.file} 파일 없음`); continue; }
      const buf = await sharp(src).rotate().resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
      const name = `${key}-${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)}.webp`;
      fs.writeFileSync(path.join(OUT, name), buf);
      keep.add(name);
      entries.push({
        src: `assets/schools/${name}`,
        focus: FOCUS_RE.test(p.focusSquare || '') ? p.focusSquare : '50% 50%',
        credit: creditLine(meta),
        page: meta.pageUrl || '',
        what: p.what || '',
      });
    }
    if (entries.length) out.schools[school] = entries;
  }
  for (const f of fs.readdirSync(OUT)) if (!keep.has(f)) fs.unlinkSync(path.join(OUT, f));   // 안 쓰는 그림은 지운다
  fs.writeFileSync(path.join(OUT, 'photos.json'), JSON.stringify(out, null, 1));
  const n = Object.values(out.schools).reduce((a, l) => a + l.length, 0);
  const none = ME.SERVED_SCHOOLS.filter((s) => !out.schools[s]);
  console.log(`학교 사진 ${Object.keys(out.schools).length}곳 · ${n}장 → assets/schools/`);
  if (none.length) console.log(`⚠️ 사진 없는 학교 ${none.length}곳 — ${none.join(' · ')} (그 학교 소식 카드는 글의 사진이 없으면 글자 카드로 남는다)`);
  if (problems.length) { console.log(`❌ ${problems.join('\n❌ ')}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === HERE) await main();
