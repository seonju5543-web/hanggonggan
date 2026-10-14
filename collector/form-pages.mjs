/* 공고문 뒷장의 신청서 서식 쪽 떼기 — 로봇 (2026-10-13 · 개발자 "남은 것 모두 진행" ②)

   🔴 왜 — 실측(2026-10-13): 신청서가 따로 첨부되지 않은 공고라도 **공고문 PDF 뒷장**에 「별지」「[서식 1]」 신청서가 붙어 있다
      (층1 공고문 첨부 17건 중 3건 · 층2 재단 공고문 사본 74개 재단 중 37곳). 양식 PDF 로봇(form-pdf.mjs)은 이름이 신청서인 **파일**만 보므로
      이 서식들은 아무도 꺼내지 않았고 앱은 '양식 없음'이라 불렀다.
   무엇을 — 마감 전 층1(등록) 공고문 첨부 PDF(collector/extracted/elig-*.pdf · 색인 elig-docs.json)와 층2 재단 공고문 사본 PDF(data/kosaf-files/<code>/)의
      쪽마다 글자를 읽어(pdftotext) 서식 쪽을 고르고, 그 쪽만 떼어(pdfseparate + pdfunite) `data/form-pages/<id>/` 에 둔다 + `index.json`.
      원문 글자·쪽 모양을 바꾸지 않는다(떼기만). 앱은 색인을 받아 질문 화면 머리에 「공고문 안 신청서 서식 (n~m쪽)」으로 보여 준다.
   🔴 서식 쪽 판정은 **쪽 글자의 표식**으로만(classifyPage · 순수 함수) — 「붙임 1. 신청서 1부」 같은 첨부 **목록 줄**은 서식이 아니다(표식만 든 짧은 줄만 센다).
      첫 쪽(공고 표지)은 더 엄격하다. 못 고르면 그 공고는 그대로 둔다(지어내지 않는다).
   🔴 양식 PDF 로봇과 **폴더·색인을 따로** 쓴다 — 그 로봇의 prune 이 제 색인에 없는 폴더를 지운다(data/forms-pdf 에 섞어 넣으면 다음 실행에 사라진다).
   🔴 마감 뒤 폴더를 지운다 · 같은 원본(크기 같음)은 다시 안 한다 · 예산(FORM_PAGES_BUDGET_SEC) 안에 끝낸다 · 넘어져도 색인은 파일마다 쓴다.
   🔴 FORM_PAGES_AS_LIB=1 이면 본편을 건너뛴다(관문이 순수 함수만 부른다). FORM_PAGES_ROOT 로 저장소를 바꿔 끼운다.
   필요한 도구: poppler-utils(pdfinfo·pdftotext·pdfseparate·pdfunite) — deep-fetch.yml 의 PDF 글자 단계가 이미 깐다. 없으면 리포트에 적고 0건. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const BUDGET_SEC = Number(process.env.FORM_PAGES_BUDGET_SEC || 240);
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PAGES = 60;   // 이보다 긴 PDF 는 공고문이 아니다(요강집) — 건너뛴다
export const CONVERTIBLE = /\.(pdf|hwp|hwpx|docx?)$/i;   // HWP·HWPX·DOC·DOCX 공고문은 LibreOffice(+H2Orestart)로 PDF 를 만들어 본다 — form-pdf.mjs 와 같은 길
export const SOFFICE_TIMEOUT_MS = 60000;

/* ── 쪽 판정 ─────────────────────────────────────────────────────────────────── */
/* 강한 표식: 표식만 든 짧은 줄(서식 머리) · 서명란 · 서식 제목 한 줄 */
const STRONG = [
  /^\s*[\[(【〔［]?\s*(별지|서식|별첨)\s*(제\s*)?\d*\s*(호)?\s*(서식|양식)?\s*[\])】〕］]?\s*(서식|양식)?\s*$/m,
  /^\s*붙임\s*\d*\s*(호\s*)?(서식|양식)\s*$/m,
  /\(\s*서명\s*(또는|\/|·)\s*(인|날인)\s*\)|\(\s*서명\s*\)|서명\s*\(\s*인\s*\)/,
  /* 맨 「(인)」 은 공고 끝의 직인 줄(「○○장학재단 이사장 (인)」)에도 있다 — 기관장 직함이 없는 줄에서만 서식 표식이다(리뷰) */
  /^(?!.*(이사장|총장|회장|원장|대표|장관|시장|군수|구청장|교육감|센터장|학장|처장|단장|위원장|조합장|재단장|사장)).*\(\s*인\s*\)\s*$/m,
  /^\s*(장학(생|금)\s*)?(신\s*청\s*서|지\s*원\s*서|추\s*천\s*서|동\s*의\s*서|서\s*약\s*서|자\s*기\s*소\s*개\s*서|학\s*업\s*계\s*획\s*서|활\s*동\s*계\s*획\s*서|확\s*인\s*서)\s*$/m,
  /위와\s*같이\s*(신청|지원|추천|동의|서약)합니다/,
];
/* 약한 표식: 인적사항 표·체크 칸·수신·날짜 빈칸 */
const WEAK = [
  /성\s*명[^\n]{0,40}(생년월일|주민등록번호|학\s*번|성\s*별)/,
  /신청인\s*[:：]?\s*$|신청인\s*\(/m,
  /연락처[^\n]{0,30}(이메일|e-?mail|휴대)/i,
  /[□☐]\s*[^\n□☐]{1,30}[□☐]/,
  /귀하\s*$/m,
  /\d{0,4}\s*년\s+\d{0,2}\s*월\s+\d{0,2}\s*일\s*$/m,
  /(개인정보|고유식별정보)[^\n]{0,20}(동의|제공)[^\n]{0,20}(함|하지)/,
  /(학\s*과|학\s*부)[^\n]{0,30}학\s*년[^\n]{0,30}학\s*번/,
];
export function pageSignals(text) {
  const t = String(text || '');
  return { strong: STRONG.filter((re) => re.test(t)).length, weak: WEAK.filter((re) => re.test(t)).length };
}
/** 'form' | 'notice' — 첫 쪽(공고 표지)은 강한 표식 1 + 약한 2 이상이어야 한다 */
export function classifyPage(text, index1) {
  const { strong, weak } = pageSignals(text);
  if (index1 === 1) return strong >= 1 && weak >= 2 ? 'form' : 'notice';
  if (strong >= 2) return 'form';
  if (strong >= 1 && weak >= 1) return 'form';
  if (weak >= 3) return 'form';
  return 'notice';
}
/** 서식 쪽 번호들(1부터) → 이어진 구간 [[a,b],…] */
export function groupRanges(pages) {
  const out = [];
  for (const p of [...pages].sort((a, b) => a - b)) {
    const last = out[out.length - 1];
    if (last && last[1] === p - 1) last[1] = p; else out.push([p, p]);
  }
  return out;
}
export const rangeLabel = (ranges) => ranges.map(([a, b]) => (a === b ? `${a}` : `${a}~${b}`)).join(', ');

/* ── 대상 고르기(순수) ──────────────────────────────────────────────────────── */
export const isOpen = (due, today) => !due || String(due) >= today;
/** 층1·층2에서 받을 공고문 PDF 목록 — [{ id, name, due, files:[{ src, name }] }] */
export function pickPageTargets({ registered = [], kosaf = [], eligIndex = {}, today, extractedDir, kosafDir, exists = fs.existsSync, readdir = fs.readdirSync }) {
  const out = [];
  for (const it of registered) {
    if (!it || !it.id || it.program || !isOpen(it.deadline, today)) continue;
    const files = ((eligIndex[it.id] || {}).files || []).filter((f) => CONVERTIBLE.test(f)).map((f) => ({ src: path.join(extractedDir, f), name: f }))
      .filter((f) => exists(f.src));
    if (files.length) out.push({ id: it.id, name: it.name || it.id, due: it.deadline || '', files });
  }
  for (const k of kosaf) {
    if (!k || !k.code || !isOpen(k.due, today)) continue;
    const dir = path.join(kosafDir, String(k.code));
    if (!exists(dir)) continue;
    const files = readdir(dir).filter((f) => CONVERTIBLE.test(f)).sort().map((f) => ({ src: path.join(dir, f), name: f }));
    if (files.length) out.push({ id: `kosaf-${k.code}`, name: `${k.org || ''} ${k.name || ''}`.trim(), due: k.due || '', files });
  }
  return out;
}

/* ── poppler 다리 ────────────────────────────────────────────────────────────── */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: opts.timeout || 60000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, why: r.error.code === 'ENOENT' ? `도구 없음(${cmd})` : (r.error.code || r.error.message) };
  if (r.status !== 0) return { ok: false, why: `${cmd} 실패(${r.status}) ${String(r.stderr || '').trim().slice(0, 120)}` };
  return { ok: true, out: r.stdout };
}
export function pdfPageCount(file) {
  const r = run('pdfinfo', [file]);
  if (!r.ok) return { ok: false, why: r.why };
  const m = r.out.match(/^Pages:\s*(\d+)/m);
  return m ? { ok: true, pages: Number(m[1]) } : { ok: false, why: '쪽 수 못 읽음' };
}
export function pdfPageText(file, n) {
  const r = run('pdftotext', ['-layout', '-f', String(n), '-l', String(n), file, '-']);
  return r.ok ? r.out : '';
}
/** 쪽 구간들을 떼어 한 PDF 로 — pdfseparate 로 쪽을 낸 뒤 pdfunite 로 잇는다 */
export function extractRanges(src, ranges, outPath) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'form-pages-'));
  try {
    const parts = [];
    for (const [a, b] of ranges) {
      const r = run('pdfseparate', ['-f', String(a), '-l', String(b), src, path.join(work, `p-%d.pdf`)]);
      if (!r.ok) return { ok: false, why: r.why };
      for (let p = a; p <= b; p += 1) parts.push(path.join(work, `p-${p}.pdf`));
    }
    if (!parts.every((p) => fs.existsSync(p))) return { ok: false, why: '쪽 떼기 결과 없음' };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (parts.length === 1) fs.copyFileSync(parts[0], outPath);
    else { const u = run('pdfunite', [...parts, outPath]); if (!u.ok) return { ok: false, why: u.why }; }
    const bytes = fs.statSync(outPath).size;
    if (bytes > MAX_PDF_BYTES) { fs.rmSync(outPath, { force: true }); return { ok: false, why: '너무 큼' }; }
    return { ok: true, bytes, pages: parts.length };
  } finally { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ } }
}

/** PDF 가 아닌 공고문 → 임시 PDF (soffice). 돌려주는 경로는 부른 쪽이 지운다 */
export function toPdf(src, { soffice = process.env.FORM_PAGES_SOFFICE || 'soffice' } = {}) {
  if (/\.pdf$/i.test(src)) return { ok: true, pdf: src, temp: false };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'form-pages-conv-'));
  const r = spawnSync(soffice, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', work, src], { encoding: 'utf8', timeout: SOFFICE_TIMEOUT_MS });
  if (r.error) { fs.rmSync(work, { recursive: true, force: true }); return { ok: false, why: r.error.code === 'ETIMEDOUT' ? '변환 시간 초과' : `변환기 없음(${soffice})` }; }
  const made = path.join(work, `${path.basename(src).replace(/\.[^.]+$/, '')}.pdf`);
  if (!fs.existsSync(made)) { fs.rmSync(work, { recursive: true, force: true }); return { ok: false, why: `변환기가 못 읽음(${(src.match(/\.(\w+)$/) || [, '?'])[1]})${/could not be loaded/.test(r.stdout + r.stderr) ? ' — 가져오기 확장(H2Orestart) 필요' : ''}` }; }
  return { ok: true, pdf: made, temp: true, work };
}
export const safeName = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/[^0-9A-Za-z가-힣._-]+/g, '_').slice(0, 50) || 'doc';

/** 색인에서 살아 있지 않은 공고를 지우고 폴더도 지운다 */
export function prune(index, liveIds, dir) {
  const items = index.items || (index.items = {});
  const dropped = [];
  for (const id of Object.keys(items)) if (!liveIds.has(id)) { dropped.push(id); delete items[id]; try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); } catch { /* 무시 */ } }
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) {
    if (d === 'index.json' || d.startsWith('.')) continue;
    if (!items[d]) { try { fs.rmSync(path.join(dir, d), { recursive: true, force: true }); } catch { /* 무시 */ } }
  }
  return dropped;
}

export function buildReport({ today, targets, done, none, failed, dropped, skipped, left, budgetSec }) {
  const L = [`# 공고문 서식 쪽 떼기 — ${today}`, '',
    `대상 ${targets.length}건 · 서식 쪽 찾아 뗀 것 ${done.length}건 · 서식 쪽 없음 ${none.length}건 · 못 함 ${failed.length}건 · 그대로(바뀜 없음) ${skipped}건 · 예산에 남은 것 ${left.length}건 · 마감 지나 지운 것 ${dropped.length}건 (예산 ${budgetSec}초)`, ''];
  if (done.length) { L.push('## 뗀 것'); done.forEach((d) => L.push(`- ${d.id} · ${d.name} — ${d.src} 의 ${d.ranges}쪽 (${d.pages}쪽)`)); L.push(''); }
  if (failed.length) { L.push('## 못 함'); failed.forEach((f) => L.push(`- ${f.id} · ${f.name} — ${f.why}`)); L.push(''); }
  if (none.length) { L.push('## 서식 쪽이 없는 공고문 (그대로 둠)'); none.slice(0, 40).forEach((n) => L.push(`- ${n.id} · ${n.name}`)); if (none.length > 40) L.push(`- … 외 ${none.length - 40}건`); L.push(''); }
  if (left.length) { L.push('## 예산에 밀린 것 (다음 실행)'); left.forEach((l) => L.push(`- ${l.id} · ${l.name}`)); L.push(''); }
  return L.join('\n');
}

export function runFormPages({ root, today, dry = false, budgetSec = BUDGET_SEC, log = console.log } = {}) {
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'registered.json'), 'utf8')).items || [];
  let kosaf = [];
  try { kosaf = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kosaf-open.json'), 'utf8')).items || []; } catch { /* 층2 없음 */ }
  let eligIndex = {};
  try { eligIndex = JSON.parse(fs.readFileSync(path.join(root, 'collector', 'extracted', 'elig-docs.json'), 'utf8')); } catch { /* 첫 실행 */ }
  const outDir = path.join(root, 'data', 'form-pages');
  const indexPath = path.join(outDir, 'index.json');
  const reportPath = path.join(root, 'collector', 'form-pages-report.md');
  let index = { updatedAt: today, items: {} };
  try { const j = JSON.parse(fs.readFileSync(indexPath, 'utf8')); if (j && j.items) index = j; } catch { /* 첫 실행 */ }
  const targets = pickPageTargets({ registered: reg, kosaf, eligIndex, today, extractedDir: path.join(root, 'collector', 'extracted'), kosafDir: path.join(root, 'data', 'kosaf-files') });
  const live = new Set(targets.map((t) => t.id));
  /* 🔴 대상이 하나도 없는데 색인에 공고가 있으면 지우지 않는다 — 색인(elig-docs.json)·사본 폴더를 못 읽은 실행(얕은 체크아웃 등)이 결과를 통째로 지우고 커밋한다(리뷰) */
  const skipPrune = !targets.length && Object.keys(index.items).length > 0;
  if (skipPrune) log('⚠️ 대상 0건 — 색인·사본을 못 읽은 실행으로 보고 지우기를 건너뛴다');
  const dropped = (dry || skipPrune) ? Object.keys(index.items).filter((id) => !live.has(id)) : prune(index, live, outDir);
  const done = []; const none = []; const failed = []; const left = []; let skipped = 0;
  const t0 = Date.now();
  const overBudget = () => (Date.now() - t0) / 1000 >= budgetSec;
  const flush = () => { if (dry) return; fs.mkdirSync(outDir, { recursive: true }); index.updatedAt = today; fs.writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n'); };
  /* 도구 확인 — pdfinfo -v 는 판에 따라 0 아닌 종료코드로 버전을 stderr 에 적는다(그때 why 에 'pdfinfo version' 이 든다) */
  const tools = run('pdfinfo', ['-v']);
  const havePoppler = tools.ok || /pdfinfo version/.test(String(tools.why || ''));
  if (!havePoppler) { const why = tools.why; targets.forEach((t) => failed.push({ id: t.id, name: t.name, why })); }
  else for (const t of targets) {
    if (overBudget()) { left.push({ id: t.id, name: t.name }); continue; }
    const have = index.items[t.id] || [];
    const next = [];
    let any = false;
    t.files.forEach((f, i) => {
      const srcBytes = fs.statSync(f.src).size;
      const prev = have.find((h) => h.src === f.name && (h.srcBytes || 0) === srcBytes && fs.existsSync(path.join(outDir, h.file)));
      if (prev) { next.push(prev); skipped += 1; any = true; return; }
      const prevNone = have.find((h) => h.src === f.name && h.none && (h.srcBytes || 0) === srcBytes);
      if (prevNone) { next.push(prevNone); skipped += 1; return; }
      if (srcBytes > MAX_PDF_BYTES) { failed.push({ id: t.id, name: f.name, why: '너무 큼' }); return; }
      const conv = toPdf(f.src);
      if (!conv.ok) { failed.push({ id: t.id, name: f.name, why: conv.why }); return; }
      const cleanup = () => { if (conv.temp) { try { fs.rmSync(conv.work, { recursive: true, force: true }); } catch { /* 무시 */ } } };
      try {
        const pc = pdfPageCount(conv.pdf);
        if (!pc.ok) { failed.push({ id: t.id, name: f.name, why: pc.why }); return; }
        if (pc.pages > MAX_PAGES) { next.push({ src: f.name, srcBytes, none: true, at: today, why: `쪽 수 ${pc.pages}` }); return; }
        const formPages = [];
        for (let p = 1; p <= pc.pages; p += 1) if (classifyPage(pdfPageText(conv.pdf, p), p) === 'form') formPages.push(p);
        if (!formPages.length) { next.push({ src: f.name, srcBytes, none: true, at: today }); return; }
        const ranges = groupRanges(formPages);
        const file = `${t.id}/${i + 1}-${safeName(f.name)}_p${formPages[0]}-${formPages[formPages.length - 1]}.pdf`;
        if (dry) { log(`[dry] ${t.id} · ${f.name} → ${rangeLabel(ranges)}쪽`); return; }
        const r = extractRanges(conv.pdf, ranges, path.join(outDir, file));
        if (!r.ok) { failed.push({ id: t.id, name: f.name, why: r.why }); return; }
        next.push({ file, name: `공고문 안 신청서 서식 (${rangeLabel(ranges)}쪽)`, pages: r.pages, bytes: r.bytes, src: f.name, srcBytes, srcPages: rangeLabel(ranges), from: '공고문 서식 쪽 떼기', at: today });
        done.push({ id: t.id, name: t.name, src: f.name, ranges: rangeLabel(ranges), pages: r.pages });
        any = true;
        flush();
      } finally { cleanup(); }
    });
    if (!next.some((h) => h.file)) none.push({ id: t.id, name: t.name });
    if (next.length) index.items[t.id] = next; else if (!dry) delete index.items[t.id];
    if (!dry && fs.existsSync(path.join(outDir, t.id))) {
      const keep = new Set(next.filter((h) => h.file).map((h) => path.basename(h.file)));
      for (const fn of fs.readdirSync(path.join(outDir, t.id))) if (!keep.has(fn)) { try { fs.rmSync(path.join(outDir, t.id, fn), { force: true }); } catch { /* 무시 */ } }
      if (!keep.size) { try { fs.rmSync(path.join(outDir, t.id), { recursive: true, force: true }); } catch { /* 무시 */ } }
    }
    void any;
  }
  const report = buildReport({ today, targets, done, none, failed, dropped, skipped, left, budgetSec });
  if (!dry) { flush(); fs.writeFileSync(reportPath, report + '\n'); }
  log(report);
  return { targets, done, none, failed, dropped, left, index };
}

if (!process.env.FORM_PAGES_AS_LIB) {
  const argv = process.argv.slice(2);
  const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
  const root = process.env.FORM_PAGES_ROOT ? path.resolve(process.env.FORM_PAGES_ROOT) : path.resolve(HERE, '..');
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  runFormPages({ root, today: String(flag('today') || kst), dry: flag('dry') === true });
}
