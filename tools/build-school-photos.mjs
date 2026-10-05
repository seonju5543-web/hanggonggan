#!/usr/bin/env node
/* 학교 대표 사진 — 소식 카드에 그 글의 사진이 없을 때 대신 보이는 학교 사진 (2026-10-03 개발자 지시:
   "썸네일이 없는 공고들에 대해서는 각 학교의 가장 예쁜 사진들(각 학교의 대표성을 띄울 수 있는 사진들)로 대체").

   재료: docs/designs/assets/gates/ — 위키미디어 공용의 열린 라이선스 사진(tools/fetch-gate-photos.mjs 가 받은 후보).
   고른 기록: docs/designs/assets/gates/school-photo-picks.json — 학교마다 눈으로 보고 고른 사진(최대 3장)과 자를 자리 ·
     🔴 원본 제목(title — manifest 의 그 파일 title 그대로)을 같이 적는다. 없거나 지금 manifest 와 다르면 만들지 않는다(pickProblems).
     시작 화면 14곳은 이미 승인받은 그 사진(manifest.picks)을 그대로 쓴다.
   만드는 것: assets/schools/<학교키>-<바이트 해시 8자>.webp (가로 640px) + assets/schools/photos.json (앱이 받는 목록·출처 줄).

   🔴 파일 이름에 바이트 해시를 넣는다 — 서비스워커가 그림을 캐시 우선으로 들어 같은 이름을 다시 쓰면 옛 그림이 남는다(소식 썸네일과 같은 규칙).
   🔴 라이선스는 CC0 · CC BY · CC BY-SA · 퍼블릭 도메인만(NC·ND 는 받는 로봇이 이미 버린다 — 여기서 한 번 더 막는다).
      BY·BY-SA 는 표기 의무라 photos.json 의 credit 을 앱이 앱 권한 · 오픈소스 라이선스 화면 「사진 출처」에 적는다(관문이 대조 · 2026-10-04 홈 구역 아래에서 옮김).
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
  /* 이름 뒤 괄호 설명(소속·학번 등)은 뗀다 — 60자에서 자르면 괄호 한가운데가 잘려 출처 줄에 남았다(세종대 사진 실측) */
  let bare = t.replace(/\s*[(（][^)）]*(?:[)）]|$)/g, ' ').replace(/\s+/g, ' ').trim();
  /* 'myself (User:Piotrus)' 처럼 이름 칸에 '나'만 적고 계정을 괄호에 둔 것 — 괄호 속 계정 이름이 작가다 */
  if (!bare || /^(myself|self|me|own work|본인|나)$/i.test(bare)) {
    const inner = (t.match(/[(（]([^)）]+)[)）]/) || [])[1] || bare;
    bare = inner.replace(/^\s*User\s*:\s*/i, '').trim();
  }
  return bare.length <= 40 ? bare : bare.slice(0, 40).replace(/\s+\S*$/, '');
}

/* 잘라 낼 자리 — 고른 기록의 crop [x, y, w, h](0~1 비율)를 그림 픽셀 상자로. 사람·번호판이 찍힌 쪽을 **파일에서** 덜어 낸다
   (72px 카드에선 안 보여도 640px 파일은 누구나 받을 수 있는 주소다 · 리뷰 10-03: 서강 번호판·경희 택시·한양 행인). 틀린 값이면 null(자르지 않음 → 빌드가 알린다) */
export function cropBox(width, height, crop) {
  if (!Array.isArray(crop) || crop.length !== 4 || !crop.every((v) => typeof v === 'number' && v >= 0 && v <= 1)) return null;
  const [x, y, w, h] = crop;
  if (w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  const left = Math.round(width * x), top = Math.round(height * y);
  return { left, top, width: Math.min(width - left, Math.round(width * w)), height: Math.min(height - top, Math.round(height * h)) };
}

export function creditLine(f) {
  return `${cleanAuthor(f.author) || '작가 미상'} · ${f.license}`;
}

/* ── 고른 사진이 아직 그 사진인가 (2026-10-05 점검 · refresh GATE-02) ─────────────────────────
   🔴 파일 이름(<학교키>-<번호>.jpg)은 **다시 받으면 다른 사진이 된다** — 받는 도구가 후보를 받은 순서로 번호를 매긴다.
      실측(10-03 재수집 #6→#7): n1mo5fbn-2.jpg 가 '광나루안전체험관 유학생 안전교육' → 'Sejong University Gate' 로 바뀌는 등 9개 이름의 뜻이 바뀌었다.
      이름만 보고 만들면 사람이 고른 적 없는 사진(사람·번호판을 덜어 내려던 crop 이 엉뚱한 사진에)이 공개 주소(640px)로 나간다.
   그래서 고른 기록에 **원본 제목(title)** 을 같이 적고, 만들 때 지금 manifest 의 제목과 대조한다. 틀리면 그 사진을 내보내지 않는다
   (틀린 사진보다 빠진 사진이 낫다 — 빠지면 그 학교 소식 카드는 글자 카드로 남는다). */
/** 위키미디어 공용 페이지 주소 → 원본 제목 ('…/wiki/File%3AX_Y.jpg' → 'File:X Y.jpg') · 주소가 아니면 '' */
export function titleFromPage(url) {
  const m = /\/wiki\/([^?#]+)/.exec(String(url || ''));
  if (!m) return '';
  let t;
  try { t = decodeURIComponent(m[1]); } catch { t = m[1]; }
  return t.replace(/_/g, ' ');
}
/** 고른 기록의 문제 문장들 — chosen = {학교: [pick…]} · files = Map(파일 이름 → manifest 항목) */
export function pickProblems(chosen, files) {
  const out = [];
  for (const [school, list] of Object.entries(chosen || {})) {
    for (const p of list || []) {
      const meta = files.get(p.file);
      if (!meta) { out.push(`${school}: ${p.file} 가 manifest 에 없다`); continue; }
      if (!p.title) { out.push(`${school}: ${p.file} 고른 기록에 원본 제목(title)이 없다`); continue; }
      if (meta.title !== p.title) out.push(`${school}: ${p.file} 가 지금은 다른 사진이다 (고른 것 ${p.title} · 지금 ${meta.title}) — 다시 받은 뒤 다시 골라야 한다`);
    }
  }
  return out;
}
/** 시작 화면 사진(tools/gate-reel/build-app-gates.mjs)의 같은 대조 — 승인된 목록(assets/gates/gates.json)과 **같은 파일 이름**인데
    공용 페이지 주소가 달라졌으면 다시 받은 뒤 다른 사진이 된 것이다. 파일 이름이 바뀐 것은 사람이 새로 고른 것이라 묻지 않는다.
    rows = [{id, name, file, page}] (이번에 만들 줄) · prev = 승인된 목록(없으면 첫 빌드) · accept = 사람이 새 사진을 받아들인 학교 id */
export function startScreenChanged(rows, prev, accept = new Set()) {
  if (!Array.isArray(prev)) return [];
  const out = [];
  for (const r of rows || []) {
    const old = prev.find((g) => g.id === r.id);
    if (!old || old.file !== r.file || !old.page || old.page === r.page || accept.has(r.id)) continue;
    out.push(`${r.name}: ${r.file} (승인 ${titleFromPage(old.page) || old.page} · 지금 ${titleFromPage(r.page) || r.page || '주소 없음'})`);
  }
  return out;
}

async function main() {
  const sharp = (await import('sharp')).default;
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
  const picksPath = path.join(SRC, 'school-photo-picks.json');
  const chosen = JSON.parse(fs.readFileSync(picksPath, 'utf8')).schools || {};
  const files = new Map();
  for (const s of manifest.schools || []) for (const f of s.files || []) files.set(f.file, { ...f, school: s.name });
  const gatesApp = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/gates/gates.json'), 'utf8'));
  /* 시작 화면 14곳 — 승인받은 그 한 장(manifest.picks)을 쓴다. 고른 기록에 그 학교가 따로 있으면 그것이 이긴다.
     원본 제목은 assets/gates/gates.json 의 page(승인 당시 공용 페이지 주소)에서 읽는다 — 다시 받아 다른 사진이 됐으면 대조에서 걸린다 */
  for (const g of gatesApp) {
    if (chosen[g.name]) continue;
    chosen[g.name] = [{ file: g.file, focusSquare: g.focus || '50% 50%', what: '시작 화면 사진(승인)', title: titleFromPage(g.page) }];
  }
  fs.mkdirSync(OUT, { recursive: true });
  const out = {
    note: '소식 카드에 그 글의 사진이 없을 때 대신 보이는 학교 대표 사진 (2026-10-03). 만드는 곳 tools/build-school-photos.mjs · 고른 기록 docs/designs/assets/gates/school-photo-picks.json · 사진은 위키미디어 공용의 열린 라이선스 — credit 은 앱 권한 · 오픈소스 라이선스 화면 「사진 출처」에 적는다.',
    schools: {},
  };
  const keep = new Set(['photos.json']);
  const problems = [];
  for (const [school, list] of Object.entries(chosen)) {
    if (!ME.SERVED_SCHOOLS.includes(school)) { problems.push(`${school}: 서비스 학교가 아니다`); continue; }
    const key = ME.noticeFileKey(school);
    const entries = [];
    for (const p of list.slice(0, 3)) {
      /* 🔴 원본 제목 대조 — 고른 뒤 다시 받아 다른 사진이 된 이름은 만들지 않는다(문제로 알리고 끝에 실패) */
      const why = pickProblems({ [school]: [p] }, files);
      if (why.length) { problems.push(...why); continue; }
      const meta = files.get(p.file);
      if (!OK_LICENSE.test(meta.license || '') || /NC|ND/.test(meta.license)) { problems.push(`${school}: ${p.file} 라이선스 ${meta.license}`); continue; }
      const src = path.join(SRC, p.file);
      if (!fs.existsSync(src)) { problems.push(`${school}: ${p.file} 파일 없음`); continue; }
      let img = sharp(src).rotate();
      if (p.crop) {
        const { width, height } = await sharp(await img.toBuffer()).metadata();
        const box = cropBox(width, height, p.crop);
        if (!box) { problems.push(`${school}: ${p.file} 의 crop 값이 틀렸다 ${JSON.stringify(p.crop)}`); continue; }
        img = sharp(await img.extract(box).toBuffer());
      }
      const buf = await img.resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toBuffer();
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
