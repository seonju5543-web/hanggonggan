/* ============================================================
   신청서 원본 → PDF (양식 원본 그대로 · 2026-10-12 개발자 지시)
   ------------------------------------------------------------
   지시: *"원본 신청양식문서를 스키마화하지 않고 그대로 가져오려고 하는데 이때 결과물 자체는 PDF로 표시"*.
   스키마화(앱이 양식을 다시 그리는 것)는 원본과 다른 문서(fabricated document)를 만들었다 — 원본과 나란히 대조한 6종 모두
   표가 낱칸으로 펼쳐지고 사진칸·서명란이 없었다(docs/designs/forms-links-cards.md 5단계). 이 로봇은 그 대안의 **1단계**다:
   공고 첨부의 신청서 원본(HWP·HWPX·DOC·DOCX·PDF)을 **한 글자도 바꾸지 않고** PDF 로 바꿔 앱이 받는 자리에 둔다.
   학생 답을 그 위에 얹는 편집기(5단계)·대장님과 나란히 고치는 화면은 다음 조각이다(시안 승인 뒤).

   무엇을 — data/registered.json 의 **마감 전** 공고 가운데 첨부 이름이 신청서(isApplicationForm · data.js 규칙을 불러 쓴다)인 것.
            원본은 collector/extracted/forms-index.txt(deepfetch 가 받아 둔 form-*.<ext> · 「파일 \t 공고 제목 \t 첨부 이름 \t 크기」)에서
            첨부 이름이 같고 공고 제목이 같은(sameTitle) 줄로 찾는다. 원본이 없으면 '아직 못 받음'으로 적고 지나간다(deepfetch 몫).
   어떻게 — pdf 는 그대로 복사 · 나머지는 LibreOffice(soffice --headless --convert-to pdf). HWP·HWPX 는 가져오기 확장(H2Orestart ·
            collector/install-h2orestart.sh)이 깔려 있어야 한다 — 없으면 '변환기가 못 읽음'으로 적는다(조용히 0건이 되지 않게 리포트가 센다).
   어디에 — data/forms-pdf/<공고 id>/<n>-<파일 이름>.pdf + data/forms-pdf/index.json({ updatedAt, items: { <id>: [{ file, name, pages, bytes, from, at }] } }).
            🔴 registered.json 은 건드리지 않는다(쓰는 로봇이 둘이면 그 파일은 자동 병합에서 빠져 있어 통째로 충돌한다).
            마감이 지난 공고의 폴더는 지운다(저장소가 자라지 않게 · 결정 1 "마감 전 것만") · 파일 하나 5MB 상한.
   언제 — deep-fetch.yml 의 보강 단계(continue-on-error · 시한) · 첨부를 받은 직후.

   🔴 원칙 — 글자를 고치지 않는다 · 양식을 만들어 내지 않는다(없으면 없다고 적는다) · 세는 숫자는 리포트에(선조치후보고).
   🔴 FORM_PDF_AS_LIB=1 이면 본편을 건너뛴다(관문이 순수 함수만 부른다). FORM_PDF_ROOT 로 저장소를 바꿔 끼울 수 있다(관문 임시 폴더).
   실행: node collector/form-pdf.mjs [--dry] [--today=YYYY-MM-DD]
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { sameTitle } from './detail-url.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const CONVERTIBLE = /\.(hwp|hwpx|doc|docx|pdf)$/i;
/* data.js 의 isApplicationForm 은 '학생이 내려받아 채우는 서식'이라 hwp·doc·zip 만 본다(앱의 접수 채널 분류와 한 벌). 이 로봇은 **PDF 로 올라온 신청서**도
   원본 그대로 두는 것이 일이라 pdf 꼴만 여기서 더한다(리뷰 2026-10-12 — 등록 3건이 조용히 빠져 있었다). 판정 낱말은 data.js 와 같은 세 개. */
export const PDF_FORM = (a) => /신청서|지원서|원서/.test((a && a.name) || '') && /\.pdf$/i.test((a && a.name) || '');
/* 변환 시간 예산(초) — deep-fetch 단계 시한(8분)보다 짧게 스스로 끝낸다 · 넘으면 남은 것을 리포트에 적고 다음 실행이 잇는다 */
export const BUDGET_SEC = Number(process.env.FORM_PDF_BUDGET_SEC || 300);
export const SOFFICE_TIMEOUT_MS = 60000;
/* 글꼴 표 도장 — collector/fonts/hwp-font-aliases.conf(한글 문서 글꼴 → 나눔·Noto) 가 바뀌면 올린다. 색인 항목에 적어 두고, 도장이 다른 옛 사본은
   '이미 있음'으로 건너뛰지 않고 다시 바꾼다(2026-10-12 첫 사본 14개 전부가 중국어 글꼴(WenQuanYi)로 그려져 표 칸이 넘쳤다 — 춘곡장학회 실측). */
export const FONT_STAMP = 'ko-nanum-1';

/* data.js 의 신청서 판정을 **불러 쓴다**(베끼면 앱과 로봇이 다른 첨부를 신청서라 부른다). data.js 는 브라우저 파일이라 함수를 이름으로 떼어 온다. */
function loadFormRules(root) {
  const src = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const take = (name) => {
    const m = src.match(new RegExp(`^function ${name}\\([\\s\\S]*?^\\}`, 'm'));
    if (!m) throw new Error(`data.js 에서 ${name} 을 못 찾았습니다 — 가져올 수 없으면 멈춥니다`);
    return m[0];
  };
  const ctx = vm.createContext({});
  vm.runInContext(`${take('isFormAttachment')}\n${take('isApplicationForm')}`, ctx, { filename: 'data.js(발췌)' });
  return { isApplicationForm: vm.runInContext('isApplicationForm', ctx) };
}

/* forms-index.txt 줄 → { file, title, attach, bytes } */
export function parseFormsIndex(text) {
  return String(text || '').split('\n').filter(Boolean).map((line) => {
    const [file, title, attach, bytes] = line.split('\t');
    return file && attach ? { file, title: title || '', attach, bytes: Number(bytes) || 0 } : null;
  }).filter(Boolean);
}

/* 마감 전인가 — 마감을 모르면 둔다(정직하게 '마감 전'이 아니라 '마감 모름'이지만, 지난 것을 지우는 쪽이 아니면 둔다) */
export const isOpen = (it, today) => !it.deadline || String(it.deadline) >= today;

/** 바꿀 대상 — 마감 전 공고의 신청서 첨부와 그 원본 파일. 원본이 없으면 missing 에 적는다 */
export function pickFormTargets(items, indexRows, { today, isApplicationForm }) {
  const out = []; const missing = [];
  for (const it of items || []) {
    if (!it || !it.id || it.program || !isOpen(it, today)) continue;
    const forms = (it.attachments || []).filter((a) => (isApplicationForm(a) || PDF_FORM(a)) && CONVERTIBLE.test(a.name || ''));
    if (!forms.length) continue;
    const titles = [it.boardTitle, it.name].filter(Boolean);
    const files = [];
    for (const a of forms) {
      const row = indexRows.find((r) => r.attach === a.name && titles.some((t) => sameTitle(t, r.title)));
      if (row) files.push({ src: row.file, name: a.name, srcBytes: row.bytes || 0 });
      else missing.push({ id: it.id, name: a.name });
    }
    if (files.length) out.push({ id: it.id, name: it.name || it.id, deadline: it.deadline || '', files });
  }
  return { targets: out, missing };
}

/* PDF 쪽 수 — 뷰어 없이 글자로 센다(`/Type /Page` · `/Pages` 는 뺀다). 객체 스트림(/ObjStm)에 든 PDF 는 글자로 안 보여 0 이 나온다 —
   0 은 '모름'이지 '빈 PDF'가 아니다(리뷰 2026-10-12: 받아 둔 원본 25개 중 7개가 0 으로 세어졌다 — 거절하면 멀쩡한 양식을 버린다) */
export function pdfPages(buf) {
  const s = buf.toString('latin1');
  const n = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  return n;
}

export const safeName = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/[^0-9A-Za-z가-힣._-]+/g, '_').slice(0, 60) || 'form';

/** 한 파일을 PDF 로 — pdf 는 복사 · 나머지는 soffice. { ok, out, pages, bytes, why } */
export function convertOne(src, outPath, { soffice = 'soffice', tmpDir } = {}) {
  if (!fs.existsSync(src)) return { ok: false, why: '원본 파일 없음' };
  const ext = (src.match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
  let pdfBuf = null;
  if (ext === 'pdf') pdfBuf = fs.readFileSync(src);
  else {
    /* 작업 폴더는 시스템 임시 폴더에 — 결과 폴더 안에 두면 단계가 시한에 죽을 때 찌꺼기가 git add 에 실린다(리뷰 2026-10-12) */
    const work = tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'form-pdf-'));
    const done = () => { if (!tmpDir) { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ } } };
    const r = spawnSync(soffice, ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', work, src], { encoding: 'utf8', timeout: SOFFICE_TIMEOUT_MS });
    if (r.error) { done(); return { ok: false, why: r.error.code === 'ETIMEDOUT' ? `변환 시간 초과(${SOFFICE_TIMEOUT_MS / 1000}초)` : `변환기 없음(${soffice})` }; }
    const made = path.join(work, `${path.basename(src).replace(/\.[^.]+$/, '')}.pdf`);
    if (!fs.existsSync(made)) {
      done();
      /* 🔴 변환기가 한 말을 그대로 남긴다(2026-10-24) — 10-16 부터 HWP 23건이 전부 '못 읽음'인데 이유를 아무도 못 봤다(원인 단정 금지 · CLAUDE.md 매 세션 5).
         stdout·stderr 의 마지막 160자를 한 줄로(리포트 한 줄에 들어가게). 종료 코드도 적는다. */
      const said = String((r.stdout || '') + ' ' + (r.stderr || '')).replace(/\s+/g, ' ').trim().slice(-160);
      return { ok: false, why: `변환기가 못 읽음(${ext})${/could not be loaded/.test(r.stdout + r.stderr) ? ' — 가져오기 확장(H2Orestart) 필요' : ''} · 종료 ${r.status}${said ? ` · 변환기 말: ${said}` : ' · 변환기 말 없음'}` };
    }
    pdfBuf = fs.readFileSync(made);
    done();
  }
  if (!/^%PDF/.test(pdfBuf.subarray(0, 5).toString('latin1'))) return { ok: false, why: 'PDF 가 아님' };
  if (pdfBuf.length > MAX_PDF_BYTES) return { ok: false, why: `너무 큼(${Math.round(pdfBuf.length / 1024)}KB > ${MAX_PDF_BYTES / 1024 / 1024}MB)` };
  if (pdfBuf.length < 100) return { ok: false, why: '빈 PDF' };
  const pages = pdfPages(pdfBuf);   // 0 = 쪽 수 모름(객체 스트림) — 거절하지 않는다
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, pdfBuf);
  return { ok: true, out: outPath, pages, bytes: pdfBuf.length };
}

/** 색인에서 마감 지난(또는 사라진) 공고를 지우고 그 폴더도 지운다 — 되돌림 목록을 준다 */
export function prune(index, liveIds, dir) {
  const items = (index && index.items) || {};
  const dropped = [];
  for (const id of Object.keys(items)) {
    if (liveIds.has(id)) continue;
    dropped.push(id);
    delete items[id];
    try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); } catch { /* 무시 */ }
  }
  /* 색인에 없는 폴더(옛 실행의 찌꺼기)도 지운다 */
  if (fs.existsSync(dir)) for (const d of fs.readdirSync(dir)) {
    if (d === 'index.json' || d.startsWith('.')) continue;
    if (!items[d]) { try { fs.rmSync(path.join(dir, d), { recursive: true, force: true }); } catch { /* 무시 */ } }
  }
  return dropped;
}

export function buildReport({ today, targets, missing, done, failed, dropped, skippedSame, left = [], budgetSec = BUDGET_SEC }) {
  const L = [];
  L.push(`## 📄 신청서 원본 → PDF 리포트 (${today})`);
  L.push('');
  L.push('공고 첨부의 신청서 원본(HWP·HWPX·DOC·DOCX·PDF)을 글자 하나 안 바꾸고 PDF 로 바꿔 `data/forms-pdf/` 에 둡니다(마감 전 공고만 · 마감 뒤 지움).');
  L.push('🔴 양식을 만들어 내지 않습니다 — 못 바꾼 것은 아래에 이유와 함께 남깁니다.');
  L.push('');
  L.push(`대상 공고 ${targets.length}건 · 파일 ${targets.reduce((n, t) => n + t.files.length, 0)}개 — 이번에 바꿈 ${done.length} · 이미 있어 건너뜀 ${skippedSame} · 못 바꿈 ${failed.length} · 원본을 아직 못 받음 ${missing.length} · 마감 지나 지움 ${dropped.length}건${left.length ? ` · ⏰ 예산(${budgetSec}초)이 다 돼 남김 ${left.length}개(다음 실행이 잇는다)` : ''}`);
  const unknownPages = done.filter((d) => !d.pages).length;
  if (unknownPages) L.push(`(쪽 수를 못 센 PDF ${unknownPages}개 — 객체 스트림 꼴이라 글자로 안 세어진다 · 파일은 멀쩡하다)`);
  L.push('');
  if (failed.length) {
    const by = new Map();
    for (const f of failed) by.set(f.why, (by.get(f.why) || 0) + 1);
    L.push('### 못 바꾼 것 (이유별)');
    [...by].sort((a, b) => b[1] - a[1]).forEach(([w, n]) => L.push(`- ${w}: ${n}개`));
    failed.slice(0, 30).forEach((f) => L.push(`  - ${f.id} · ${f.name} — ${f.why}`));
    L.push('');
  }
  if (missing.length) {
    L.push(`### 원본을 아직 못 받은 신청서 — ${missing.length}개 (deepfetch 가 받는 몫 · collector/run-deepfetch.txt targets:)`);
    missing.slice(0, 30).forEach((m) => L.push(`- ${m.id} · ${m.name}`));
    if (missing.length > 30) L.push(`- …외 ${missing.length - 30}개`);
    L.push('');
  }
  if (dropped.length) { L.push(`### 마감이 지나 지운 공고 — ${dropped.length}건`); dropped.slice(0, 30).forEach((d) => L.push(`- ${d}`)); L.push(''); }
  return L.join('\n');
}

/* ── 본편 ─────────────────────────────────────────────────────── */
export function runFormPdf({ root, today, dry = false, soffice = process.env.FORM_PDF_SOFFICE || 'soffice', budgetSec = BUDGET_SEC, log = console.log } = {}) {
  const regPath = path.join(root, 'data', 'registered.json');
  const idxPath = path.join(root, 'collector', 'extracted', 'forms-index.txt');
  const outDir = path.join(root, 'data', 'forms-pdf');
  const indexPath = path.join(outDir, 'index.json');
  const reportPath = path.join(root, 'collector', 'form-pdf-report.md');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  const rows = fs.existsSync(idxPath) ? parseFormsIndex(fs.readFileSync(idxPath, 'utf8')) : [];
  const { isApplicationForm } = loadFormRules(root);
  const { targets, missing } = pickFormTargets(reg.items || [], rows, { today, isApplicationForm });
  let index = { updatedAt: today, items: {} };
  try { const j = JSON.parse(fs.readFileSync(indexPath, 'utf8')); if (j && j.items && typeof j.items === 'object') index = { ...j, items: j.items }; } catch { /* 첫 실행 */ }
  const live = new Set((reg.items || []).filter((it) => it && it.id && isOpen(it, today)).map((it) => it.id));
  const dropped = dry ? Object.keys(index.items).filter((id) => !live.has(id)) : prune(index, live, outDir);
  const done = []; const failed = []; const left = []; let skippedSame = 0;
  const t0 = Date.now();
  const overBudget = () => (Date.now() - t0) / 1000 >= budgetSec;
  /* 🔴 넘어져도 지금까지 바꾼 것은 남는다 — 색인은 파일 하나 끝날 때마다 쓴다(단계 시한에 죽으면 끝에 한 번 쓰는 색인은 통째로 사라진다 · 리뷰 2026-10-12) */
  const flush = () => { if (dry) return; fs.mkdirSync(outDir, { recursive: true }); index.updatedAt = today; fs.writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n'); };
  for (const t of targets) {
    const have = index.items[t.id] || [];
    const next = [];
    t.files.forEach((f, i) => {
      const file = `${t.id}/${i + 1}-${safeName(f.name)}.pdf`;
      /* 같은 이름·같은 자리·같은 원본 크기면 건너뛴다 — 학교가 같은 이름으로 다시 올리면(크기가 다르면) 다시 바꾼다 */
      const prev = have.find((h) => h.name === f.name && h.file === file && (h.srcBytes || 0) === (f.srcBytes || 0) && (h.fonts || '') === FONT_STAMP && fs.existsSync(path.join(outDir, h.file)));
      if (prev) { next.push(prev); skippedSame += 1; return; }
      /* 글꼴 도장만 다른 옛 사본 — 다시 그리되, 예산이 다 되거나 변환이 넘어지면 **옛 사본을 그대로 둔다**(지우면 다음 실행까지 앱에서 줄이 사라진다 · 리뷰 2026-10-14) */
      const stale = have.find((h) => h.name === f.name && h.file === file && (h.srcBytes || 0) === (f.srcBytes || 0) && fs.existsSync(path.join(outDir, h.file)));
      if (dry) { log(`[dry] ${t.id} · ${f.name} ← ${f.src}`); return; }
      if (overBudget()) { left.push({ id: t.id, name: f.name }); if (stale) next.push(stale); return; }
      const r = convertOne(path.join(root, 'collector', 'extracted', f.src), path.join(outDir, file), { soffice });
      if (r.ok) { next.push({ file, name: f.name, pages: r.pages, bytes: r.bytes, srcBytes: f.srcBytes || 0, from: '원본 그대로 변환', fonts: FONT_STAMP, at: today }); done.push({ id: t.id, name: f.name, pages: r.pages }); flush(); }
      else { failed.push({ id: t.id, name: f.name, why: r.why }); if (stale) next.push(stale); }
    });
    if (next.length) index.items[t.id] = next;
    else if (!dry) delete index.items[t.id];
    /* 그 공고 폴더에서 색인에 없는 파일(첨부가 빠지거나 순서가 바뀐 옛 결과)은 지운다 — 폴더째 지우는 prune 이 못 보는 고아 */
    if (!dry && fs.existsSync(path.join(outDir, t.id))) {
      const keep = new Set(next.map((h) => path.basename(h.file)));
      for (const fn of fs.readdirSync(path.join(outDir, t.id))) if (!keep.has(fn)) { try { fs.rmSync(path.join(outDir, t.id, fn), { recursive: true, force: true }); } catch { /* 무시 */ } }
      if (!next.length) { try { fs.rmSync(path.join(outDir, t.id), { recursive: true, force: true }); } catch { /* 무시 */ } }
    }
  }
  index.updatedAt = today;
  const report = buildReport({ today, targets, missing, done, failed, dropped, skippedSame, left, budgetSec });
  if (!dry) { flush(); fs.writeFileSync(reportPath, report + '\n'); }
  log(report);
  return { targets, missing, done, failed, dropped, left, index };
}

if (!process.env.FORM_PDF_AS_LIB) {
  const argv = process.argv.slice(2);
  const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
  const root = process.env.FORM_PDF_ROOT ? path.resolve(process.env.FORM_PDF_ROOT) : path.resolve(HERE, '..');
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  runFormPdf({ root, today: String(flag('today') || kst), dry: flag('dry') === true });
}
