/* ============================================================
   신청서 원본 PDF — 쪽 그림 + 빈칸 자리 찾기 (양식 5단계 「원본 위에 답 얹기」의 재료 · 2026-10-31)
   ------------------------------------------------------------
   왜 — 앱이 양식을 다시 그리면 원본과 다른 문서가 된다(docs/designs/forms-links-cards.md 5단계). 그래서 원본 PDF 의 **쪽 그림** 위
        정해진 자리에 학생 답을 얹는다. 이 로봇은 그 두 재료를 만든다: ① 쪽 그림(WebP) ② 이름표 옆 빈칸의 자리(fields).
   무엇을 — data/forms-pdf/index.json 에 실린 PDF 사본 전부(form-pdf.mjs 가 마감 전 공고만 두고 마감 뒤 지운다 — 여기서는 그 목록을 따른다).
   어떻게 — 쪽 그림: pdftoppm(96dpi · PNG) → Pillow 로 WebP(없으면 PNG 그대로 · 리포트에 적는다). 파일당 MAX_PAGES 쪽까지.
            빈칸: pdftotext -bbox-layout 로 낱말 자리를 읽고, 이름표 사전(LABELS · 성명·대학·학과·학번·연락처…)에 맞는 **짧은 줄**의 오른쪽,
            같은 줄의 다음 낱말 앞까지를 빈칸으로 본다(표 칸의 오른쪽 칸). 🔴 사전에 있는 이름표가 셋 이상 나란한 줄은 표 머리글(가족 표 등)이라
            빈칸으로 보지 않는다 — 값이 아래 줄에 오는 표는 이번 판에선 못 읽는다(리포트에 '표 머리글' 수로 남긴다).
   어디에 — data/forms-pdf/<공고 id>/fields.json({ updatedAt, files: { "<n>-<이름>.pdf": { sha, pages:[{w,h,img,iw,ih}], fields:[{id,page,x,y,w,h,label,key}] } } })
            쪽 그림은 data/forms-pdf/<공고 id>/<n>-pages/<쪽>.webp. 좌표는 PDF 포인트(원본 크기) — 앱이 그림 크기에 맞춰 늘린다.
   🔴 원칙 — PDF 는 안 건드린다(form-pdf.mjs 의 사본 그대로) · 칸을 지어내지 않는다(못 찾으면 fields 가 빈 배열 · 학생은 원본을 받아 손으로 쓴다) ·
            key 는 앱 프로필 칸 이름 그대로(name·school·major·year·studentId·phone… · formfill.js ffAutoValue 가 읽는다) — 없는 칸은 null(학생이 적는다).
   🔴 FORM_FIELDS_AS_LIB=1 이면 본편을 건너뛴다(관문이 순수 함수만 부른다). FORM_FIELDS_ROOT 로 저장소를 바꿔 끼울 수 있다.
   실행: node collector/form-fields.mjs [--dry] [--force]
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const MAX_PAGES = 12;          // 파일당 쪽 그림 상한(37쪽 사업계획서가 있다 — 저장소가 자라지 않게)
export const DPI = 96;                // 쪽 그림 해상도 — A4 가 794×1123 · WebP 약 50KB
export const MIN_BOX_W = 36;          // 이보다 좁은 빈칸은 글자를 못 얹는다(이미 값이 적힌 칸 등)
export const MAX_LABEL_CHARS = 12;    // 이름표는 짧다 — 문장은 이름표가 아니다
export const HEADER_ROW_MIN = 3;      // 사전 이름표가 이만큼 나란하면 표 머리글

/* 이름표 사전 — 앞에서부터 처음 맞는 것. key 는 app.js 프로필 칸 이름(collectProfile) · null 은 프로필에 없는 칸(학생이 적는다). */
export const LABELS = [
  { re: /^(성명|이름|신청인|신청자|예금주|성명한글|한글성명)$/, key: 'name', label: '이름' },
  { re: /^(생년월일|생일)$/, key: 'birth', label: '생년월일' },
  { re: /^(소속대학|대학교|대학명|학교명|학교|대학|소속)$/, key: 'school', label: '학교' },
  { re: /^(캠퍼스)$/, key: 'campus', label: '캠퍼스' },
  { re: /^(학부과전공|학과전공|소속학과|학과|전공|학부|학부과|학과학부|전공학과)$/, key: 'major', label: '학과' },
  { re: /^(학년|학년학기|학년및학기)$/, key: 'year', label: '학년' },
  { re: /^(학번)$/, key: 'studentId', label: '학번' },
  { re: /^(연락처|휴대폰|핸드폰|휴대전화|전화번호|전화|휴대폰번호|핸드폰번호|휴대전화번호|연락처휴대폰|본인연락처)$/, key: 'phone', label: '연락처' },
  { re: /^(이메일|email|e-mail|전자우편|이메일주소)$/i, key: 'email', label: '이메일' },
  { re: /^(은행명|은행|거래은행|입금은행)$/, key: 'bank', label: '은행' },
  { re: /^(계좌번호|계좌|입금계좌|계좌번호은행명)$/, key: 'account', label: '계좌번호' },
  { re: /^(주소|현주소|자택주소|거주지|주민등록주소)$/, key: null, label: '주소' },
  { re: /^(학자금지원구간|소득분위|소득구간|지원구간)$/, key: 'bracket', label: '소득구간' },
  { re: /^(평점|평균평점|직전학기성적|성적|학점|직전학기평점)$/, key: 'gpa', label: '성적' },
];

export const norm = (s) => String(s || '').replace(/[\s:：·ㆍ()（）\[\]【】,./]/g, '').replace(/[*＊※]/g, '');

/* pdftotext -bbox-layout 의 XML → [{ w, h, lines: [{ x0, y0, x1, y1, text, words: [{x0,y0,x1,y1,t}] }] }] */
export function parseBbox(xml) {
  const pages = [];
  const unesc = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
  const num = (m, k) => Number((m.match(new RegExp(`${k}="([\\d.]+)"`)) || [])[1]);
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
  let pm;
  while ((pm = pageRe.exec(xml))) {
    const page = { w: Number(pm[1]), h: Number(pm[2]), lines: [] };
    const lineRe = /<line ([^>]*)>([\s\S]*?)<\/line>/g;
    let lm;
    while ((lm = lineRe.exec(pm[3]))) {
      const words = [];
      const wordRe = /<word ([^>]*)>([^<]*)<\/word>/g;
      let wm;
      while ((wm = wordRe.exec(lm[2]))) words.push({ x0: num(wm[1], 'xMin'), y0: num(wm[1], 'yMin'), x1: num(wm[1], 'xMax'), y1: num(wm[1], 'yMax'), t: unesc(wm[2]) });
      if (!words.length) continue;
      page.lines.push({ x0: num(lm[1], 'xMin'), y0: num(lm[1], 'yMin'), x1: num(lm[1], 'xMax'), y1: num(lm[1], 'yMax'), text: words.map((w) => w.t).join(' '), words });
    }
    pages.push(page);
  }
  return pages;
}

export function labelOf(text) {
  const n = norm(text);
  if (!n || n.length > MAX_LABEL_CHARS) return null;
  for (const L of LABELS) if (L.re.test(n)) return L;
  return null;
}

const overlapY = (a, b) => Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const sameRow = (a, b) => overlapY(a, b) >= 0.5 * Math.min(a.y1 - a.y0, b.y1 - b.y0);

/* 한 쪽의 줄들(+ 표의 선) → 빈칸 목록. 순수 함수 — 관문이 가짜 줄·선으로 잰다.
   rules = { h: [[y, x0, x1]…], v: [[x, y0, y1]…] } (PDF 포인트 · 쪽 그림에서 읽은 가로·세로 선). 없으면 낱말 자리로만 본다.
   표의 선이 있을 때(2026-10-31 · 3대 동문가족 실측으로 고침):
     · 이름표 칸의 **오른쪽 칸**이 비어 있으면 거기가 빈칸(key = 프로필 칸).
     · 오른쪽 칸에 글자가 있고 **아래 칸**이 비어 있으면 표 머리글이다 — 아래 칸이 빈칸이되 key 는 null(가족 표의 「성명」에 학생 이름을 넣으면 틀린 값).
   선이 없을 때: 같은 줄의 다음 낱말 앞까지. 사전 이름표가 셋 이상 나란한 줄은 머리글로 보고 건너뛴다. */
export function detectFields(page, pageNo, rules) {
  const out = [];
  let headerRows = 0, below = 0;
  const margin = Math.min(40, page.w * 0.07);
  const labeled = page.lines.map((ln) => ({ ln, L: labelOf(ln.text) }));
  const H = (rules && rules.h) || []; const V = (rules && rules.v) || [];
  const hasRules = H.length >= 2 && V.length >= 2;
  const spansY = (v, y0, y1) => v[1] <= y0 + 2 && v[2] >= y1 - 2;
  const spansX = (h, x0, x1) => h[1] <= x0 + 2 && h[2] >= x1 - 2;
  const textIn = (x0, y0, x1, y1) => page.lines.some((o) => o.x0 < x1 - 1 && o.x1 > x0 + 1 && o.y0 < y1 - 1 && o.y1 > y0 + 1);
  const push = (L, box, key, pageNo) => out.push({ id: `p${pageNo}-${out.length + 1}`, page: pageNo, x: r1(box.x0), y: r1(box.y0), w: r1(box.x1 - box.x0), h: r1(box.y1 - box.y0), label: L.label, key });
  for (const { ln, L } of labeled) {
    if (!L) continue;
    const lh = ln.y1 - ln.y0;
    if (hasRules) {
      const vs = V.filter((v) => spansY(v, ln.y0, ln.y1)).map((v) => v[0]).sort((a, b) => a - b);
      const vL = vs.filter((x) => x < ln.x0 - 1).pop(); const vR = vs.find((x) => x > ln.x1 + 1);
      if (vL != null && vR != null) {
        const hs = H.filter((h) => spansX(h, vL, vR)).map((h) => h[0]).sort((a, b) => a - b);
        const hT = hs.filter((y) => y < ln.y0 + 1).pop(); const hB = hs.find((y) => y > ln.y1 - 1);
        /* 이름표 칸에 다른 글자가 같이 있으면(「은행명 : / 계좌번호 :」 두 줄 · 큰 칸 안의 「신청인 : (인)」) 칸 규칙이 아니라 낱말 규칙으로 */
        const otherText = page.lines.some((o) => o !== ln && o.x0 < vR - 1 && o.x1 > vL + 1 && o.y0 < (hB == null ? ln.y1 : hB) - 1 && o.y1 > (hT == null ? ln.y0 : hT) + 1);
        if (hT != null && hB != null && !otherText) {
          const vR2 = vs.find((x) => x > vR + 1);
          const rightCell = vR2 != null ? { x0: vR + 3, y0: hT + 2, x1: vR2 - 3, y1: hB - 2 } : null;
          if (rightCell && rightCell.x1 - rightCell.x0 >= MIN_BOX_W && !textIn(rightCell.x0, rightCell.y0, rightCell.x1, rightCell.y1)) { push(L, rightCell, L.key, pageNo); continue; }
          /* 오른쪽 칸에 글자가 있다 → 머리글인가: 아래 칸이 비어 있으면 그 칸이 빈칸(학생이 적는다) */
          const hsCol = H.filter((h) => spansX(h, vL, vR)).map((h) => h[0]).sort((a, b) => a - b);
          const hB2 = hsCol.find((y) => y > hB + 4);
          const vsBelow = V.filter((v) => hB2 != null && spansY(v, hB, hB2)).map((v) => v[0]);
          const belowCell = hB2 != null && vsBelow.some((x) => Math.abs(x - vL) < 3) && vsBelow.some((x) => Math.abs(x - vR) < 3)
            ? { x0: vL + 3, y0: hB + 2, x1: vR - 3, y1: hB2 - 2 } : null;
          if (belowCell && belowCell.x1 - belowCell.x0 >= MIN_BOX_W && belowCell.y1 - belowCell.y0 >= lh * 0.8 && !textIn(belowCell.x0, belowCell.y0, belowCell.x1, belowCell.y1)) { push(L, belowCell, null, pageNo); below++; continue; }
          continue;   // 칸 안에 있는데 오른쪽도 아래도 빈 칸이 아니다 — 이미 값이 적힌 꼴
        }
      }
      /* 표 밖의 이름표(「신청인 : ____ (인)」 등)는 아래 낱말 규칙으로 */
    }
    const row = labeled.filter((o) => o.ln !== ln && sameRow(o.ln, ln));
    if (!hasRules && row.filter((o) => o.L).length + 1 >= HEADER_ROW_MIN) { headerRows++; continue; }
    const right = row.filter((o) => o.ln.x0 > ln.x1).sort((a, b) => a.ln.x0 - b.ln.x0)[0];
    const x0 = ln.x1 + 4;
    const x1 = (right ? right.ln.x0 - 4 : page.w - margin);
    if (x1 - x0 < MIN_BOX_W) continue;
    push(L, { x0, y0: ln.y0 - lh * 0.15, x1, y1: ln.y1 + lh * 0.15 }, L.key, pageNo);
  }
  return { fields: out, headerRows, below };
}
const r1 = (n) => Math.round(n * 10) / 10;

/* ── 본편 ─────────────────────────────────────────────────────── */
function sh(cmd, args, opts = {}) { return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }); }
const sha = (p) => createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16);

export function renderPages(pdfPath, outDir, { dpi = DPI, maxPages = MAX_PAGES } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ffp-'));
  const r = sh('pdftoppm', ['-r', String(dpi), '-f', '1', '-l', String(maxPages), '-png', pdfPath, path.join(tmp, 'p')]);
  if (r.status !== 0) { fs.rmSync(tmp, { recursive: true, force: true }); return { ok: false, why: `pdftoppm 실패: ${String(r.stderr || '').slice(0, 120)}` }; }
  const pngs = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  /* Pillow 로 WebP — 없으면 PNG 그대로(두 배 무겁지만 멈추지 않는다 · 리포트가 센다) */
  const py = sh('python3', ['-I', path.join(fileURLToPath(new URL('.', import.meta.url)), 'form-page-images.py'), tmp, outDir, String(dpi)]);
  const pages = [];
  if (/^nopil/.test(py.stdout || '')) {
    for (const f of pngs) {
      const n = Number(f.split('-').pop().split('.')[0]);
      fs.copyFileSync(path.join(tmp, f), path.join(outDir, `${n}.png`));
      pages.push({ n, img: `${n}.png`, iw: 0, ih: 0 });
    }
  } else {
    for (const line of String(py.stdout || '').trim().split('\n').filter(Boolean)) {
      const [n, iw, ih, ...rest] = line.split(' ');
      let rules = { h: [], v: [] };
      try { rules = JSON.parse(rest.join(' ') || '{}'); } catch { /* 선 못 읽음 — 낱말 자리로만 */ }
      pages.push({ n: Number(n), img: `${n}.webp`, iw: Number(iw), ih: Number(ih), rules });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { ok: true, pages: pages.sort((a, b) => a.n - b.n), webp: !/^nopil/.test(py.stdout || '') };
}

export function runFormFields({ root, today, dry = false, force = false, log = console.log } = {}) {
  const outDir = path.join(root, 'data', 'forms-pdf');
  const indexPath = path.join(outDir, 'index.json');
  const reportPath = path.join(root, 'collector', 'form-fields-report.md');
  let index = { items: {} };
  try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch { /* 사본이 아직 없다 */ }
  const items = (index && index.items) || {};
  const stats = { files: 0, done: 0, same: 0, failed: [], fields: 0, keyed: 0, noField: [], headerRows: 0, below: 0, png: 0, capped: [] };
  const byLabel = new Map();
  for (const [id, files] of Object.entries(items)) {
    const dir = path.join(outDir, id);
    const fjPath = path.join(dir, 'fields.json');
    let fj = { updatedAt: today, files: {} };
    try { const j = JSON.parse(fs.readFileSync(fjPath, 'utf8')); if (j && j.files) fj = { ...j, files: j.files }; } catch { /* 첫 실행 */ }
    const keep = new Set();
    for (const f of files || []) {
      const rel = path.basename(f.file);
      const pdfPath = path.join(outDir, f.file);
      if (!fs.existsSync(pdfPath)) continue;
      stats.files++;
      keep.add(rel);
      const h = sha(pdfPath);
      const prev = fj.files[rel];
      if (!force && prev && prev.sha === h && prev.pages && prev.pages.every((p) => fs.existsSync(path.join(dir, prev.dir || '', p.img)))) { stats.same++; stats.fields += prev.fields.length; stats.keyed += prev.fields.filter((x) => x.key).length; continue; }
      if (dry) { log(`· ${id} · ${rel} — 만들 것`); continue; }
      const xml = sh('pdftotext', ['-bbox-layout', pdfPath, '-']);
      if (xml.status !== 0) { stats.failed.push({ id, name: rel, why: `pdftotext 실패: ${String(xml.stderr || '').slice(0, 100)}` }); continue; }
      const pages = parseBbox(xml.stdout || '');
      const pagesDir = `${rel.replace(/\.pdf$/i, '')}-pages`;
      const rp = renderPages(pdfPath, path.join(dir, pagesDir));
      if (!rp.ok) { stats.failed.push({ id, name: rel, why: rp.why }); continue; }
      if (!rp.webp) stats.png++;
      if (pages.length > MAX_PAGES) stats.capped.push(`${id} · ${rel} (${pages.length}쪽 → ${MAX_PAGES})`);
      const fields = []; let headerRows = 0;
      pages.slice(0, MAX_PAGES).forEach((pg, i) => { const rp1 = rp.pages.find((p) => p.n === i + 1); const d = detectFields(pg, i + 1, rp1 && rp1.rules); fields.push(...d.fields); headerRows += d.headerRows; stats.below += d.below; });
      for (const x of fields) byLabel.set(x.label, (byLabel.get(x.label) || 0) + 1);
      fj.files[rel] = {
        sha: h, dir: pagesDir, at: today,
        pages: rp.pages.map((p) => ({ n: p.n, w: r1((pages[p.n - 1] || {}).w || 0), h: r1((pages[p.n - 1] || {}).h || 0), img: p.img, iw: p.iw, ih: p.ih, rules: p.rules ? { h: p.rules.h.length, v: p.rules.v.length } : undefined })),
        fields: fields.map(({ text, ...rest }) => rest),
      };
      stats.done++; stats.fields += fields.length; stats.keyed += fields.filter((x) => x.key).length; stats.headerRows += headerRows;
      if (!fields.length) stats.noField.push(`${id} · ${rel}`);
      log(`✓ ${id} · ${rel} — ${rp.pages.length}쪽 · 빈칸 ${fields.length}(프로필로 채울 수 있는 것 ${fields.filter((x) => x.key).length})`);
    }
    if (dry) continue;
    /* 색인에서 빠진 파일의 장부·그림은 지운다 */
    for (const rel of Object.keys(fj.files)) if (!keep.has(rel)) { const d = fj.files[rel].dir; delete fj.files[rel]; if (d) fs.rmSync(path.join(dir, d), { recursive: true, force: true }); }
    if (Object.keys(fj.files).length) { fj.updatedAt = today; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(fjPath, JSON.stringify(fj, null, 1)); }
  }
  const L = [];
  L.push(`## 🧾 신청서 쪽 그림 · 빈칸 자리 리포트 (${today})`);
  L.push('');
  L.push('원본 PDF 사본(data/forms-pdf)의 쪽 그림(WebP)과 이름표 옆 빈칸 자리(fields.json)를 만듭니다 — 앱의 「양식 채우기」가 그 위에 학생 답을 얹습니다. 🔴 칸을 지어내지 않습니다(못 찾은 파일은 빈 배열).');
  L.push('');
  const pngNote = stats.png ? ' · ⚠️ Pillow 없어 PNG 로 둔 파일 ' + stats.png : '';          // 템플릿 안에 템플릿을 넣지 않는다(관문 「선언 없는 이름」이 못 읽는다)
  const capNote = stats.capped.length ? ' · 쪽 상한으로 자른 파일 ' + stats.capped.length : '';
  L.push(`파일 ${stats.files}개 — 이번에 만듦 ${stats.done} · 그대로 ${stats.same} · 실패 ${stats.failed.length} · 빈칸 합 ${stats.fields}(프로필로 채울 수 있는 것 ${stats.keyed}) · 빈칸 0개 파일 ${stats.noField.length} · 표 머리글 아래 칸(학생이 적는 칸) ${stats.below} · 선 없는 쪽에서 머리글로 건너뛴 줄 ${stats.headerRows}${pngNote}${capNote}`);
  if (byLabel.size) L.push(`이름표별: ${[...byLabel].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  if (stats.failed.length) { L.push(''); L.push('### 실패'); stats.failed.forEach((f) => L.push(`- ${f.id} · ${f.name} — ${f.why}`)); }
  if (stats.noField.length) { L.push(''); L.push('### 빈칸을 하나도 못 찾은 파일 (학생은 원본을 받아 손으로 쓴다 · 관리자가 칸을 지정하는 길은 다음 조각)'); stats.noField.forEach((s) => L.push(`- ${s}`)); }
  if (stats.capped.length) { L.push(''); L.push('### 쪽 상한으로 자른 파일'); stats.capped.forEach((s) => L.push(`- ${s}`)); }
  if (!dry) fs.writeFileSync(reportPath, L.join('\n') + '\n');
  log(L.join('\n'));
  return stats;
}

if (!process.env.FORM_FIELDS_AS_LIB) {
  const root = process.env.FORM_FIELDS_ROOT || path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);   // KST
  runFormFields({ root, today, dry: process.argv.includes('--dry'), force: process.argv.includes('--force') });
}
