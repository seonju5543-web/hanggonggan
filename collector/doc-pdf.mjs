/* ============================================================
   공고문·안내문 원본 → PDF (첨부 문서 PDF 통일 · 2026-11-20 개발자 결정 · docs/designs/all-docs-pdf.md)
   ------------------------------------------------------------
   지시: *"한글이나 독스는 폰에서 바로 안열리니까 … 원본인 한글파일이나 독스는 그냥 맨 밑에 첨부파일에 원본 넣어놓고
          학생이 열 수 있는 공고들은 다 pdf 로"* — 앱은 PDF 줄을 위에, 올린 첨부 목록을 맨 밑에 그대로 둔다(app-live.js attachPdfRowsHtml).

   무엇을 — 마감 전 공고의 한글·워드(HWP·HWPX·DOC·DOCX) 첨부.
            · 층1 정식 등록·대외활동: 신청서(isApplicationForm — data.js 규칙)가 **아닌** 것만. 신청서는 form-pdf.mjs 몫이다(한 파일에 주인은 하나).
            · 층2 재단(data/kosaf-open.json): 전부. 층2는 form-pdf 가 안 본다. 원본은 저장소의 사본(data/kosaf-files/…)이다.
   어떻게 — 층1·활동은 첨부를 한 번 받아(임시 폴더) form-pdf 의 convertOne 으로 바꾸고 원본은 버린다(커밋 안 함).
            🔴 글자 대조(개발자 승인 11-20): 원본의 한글 음절·숫자가 PDF 에 KEEP_MIN 넘게 남았을 때만 사본을 둔다 — 학생은 원본 대신
               이 PDF 를 읽으므로 마감·자격 줄이 빠진 사본은 원본보다 나쁘다. 잴 수 없는 것(그림 문서·.doc·pdftotext 없음)은 사본을 두고 리포트에 센다.
   어디에 — data/docs-pdf/<공고 id>/<n>-<safeName(첨부 이름)>.pdf + data/docs-pdf/index.json
            { updatedAt, items: { <id>: [{ file, name, pages, bytes, fonts, kept, at }] }, tried: { "<id>|<첨부 이름>": { at, why } } }.
            🔴 registered.json 은 건드리지 않는다. 폴더를 form-pdf(data/forms-pdf)와 따로 둔다 — 그쪽 정리(prune)는 색인에 없는 폴더를 지운다.
   언제 — deep-fetch.yml 의 보강 단계(continue-on-error · 시한 · 경보 짝).

   🔴 한 번 바꾼 첨부는 다시 받지 않는다(같은 이름·파일·글꼴 도장이면 건너뜀) · 실패는 사흘 쉰다(같은 학교를 매일 두드리지 않는다).
   🔴 DOC_PDF_AS_LIB=1 이면 본편을 건너뛴다(관문이 함수만 부른다). DOC_PDF_ROOT 로 저장소를 바꿔 끼운다(관문 임시 폴더).
   🔴 글자가 빠지면(2026-11-20 첫 실행 — 표의 줄이 접혀 글자가 잘렸다) 표 줄 높이를 풀어 한 번 더 바꿔 더 많이 남은 쪽을 쓴다(convertChecked ·
      soffice.mjs sofficeToPdfRelaxed). 그래도 모자라면 버리고, 리포트에 **빠진 원본 줄**을 적는다(missingLines).
   실행: node collector/doc-pdf.mjs [--dry] [--today=YYYY-MM-DD]
   진단: node collector/doc-pdf.mjs --probe[=공고 id,…]  — 저장 없이 두 길의 결과를 찍는다(.github/workflows/doc-pdf-probe.yml)
   ============================================================ */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanAttachName, attachExt, loadFormRules } from './form-rules.mjs';
import { resolveJsDownload, isHtmlPayload } from './attachment-link.mjs';
import { FETCH_HEADERS } from './http-headers.mjs';
import { attachmentText } from './attachment-text.mjs';
import { SOFFICE_TIMEOUT_MS, sofficeToPdfRelaxed } from './soffice.mjs';   // 변환 한 곳의 시한·표 줄 높이를 풀어 다시 바꾸기(2026-11-20 soffice.mjs 로 모임)

/* form-pdf.mjs 는 불러오는 순간 본편이 돈다 — 순수 함수만 쓰도록 표시를 먼저 세우고 동적으로 부른다(deepfetch 와 같은 길) */
process.env.FORM_PDF_AS_LIB = '1';
const FP = await import('./form-pdf.mjs');

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const OFFICE_DOC = /\.(hwp|hwpx|doc|docx)$/i;
export const KEEP_MIN = 0.98;        // 원본 글자 중 PDF 에 남아야 하는 몫(개수 기준) — 신청서 사본 51개 실측은 전부 1(11-20)
export const MIN_CHARS = 50;         // 이보다 원본 글자가 적으면 잴 수 없다(그림 문서) — 사본은 두고 리포트에 센다
export const REST_DAYS = 3;          // 받기·변환에 실패한 첨부는 사흘 쉰다
/* 만드는 법의 판 번호 — 올리면 **글자가 덜 남은 사본과 쉬고 있는 실패만** 다음 실행에 다시 만든다(다 남은 사본은 안 건드린다 · 학교를 다시 두드리지 않는다).
   2 = 글자가 빠지면 표 줄 높이를 풀어 다시 바꾼다 · `javascript:` 호출 속 절대 주소를 푼다(2026-11-20 — 첫 실행의 못 바꾼 7개) */
export const MAKER = 2;
export const FETCH_TIMEOUT_MS = 30000;
export const TEXT_TIMEOUT_MS = 20000;   // 글자 대조의 두 도구(hwp-bodytext.py · pdftotext) — 평소 1초 안에 끝난다
/* 파일 하나의 최대 시간(초) = 받기 + 변환 + 글자 뽑기 둘 — 예산 검사와 관문 「공고문 PDF 사본 — 배선」 ④가 같은 숫자를 쓴다 */
export const FILE_MAX_SEC = (FETCH_TIMEOUT_MS + SOFFICE_TIMEOUT_MS + 2 * TEXT_TIMEOUT_MS) / 1000;
/* 글자가 빠져 표 줄 높이를 풀어 다시 갈 때 더 드는 최대 시간(초) = 변환 둘(원본 → 중간 꼴 → PDF) + 글자 뽑기 하나.
   🔴 파일 하나의 시간에 더하지 않고 **따로 잰다**(mayRelax) — 더하면 파일 하나가 예산보다 길어져 아무것도 시작하지 못한다(관문이 잡았다).
      남은 예산이 이보다 적으면 다시 가지 않고 판 번호를 안 적어 다음 실행이 잇는다 */
export const RELAX_MAX_SEC = (2 * SOFFICE_TIMEOUT_MS + TEXT_TIMEOUT_MS) / 1000;
/* 변환 시간 예산(초) — deep-fetch 단계 시한 안에 스스로 끝낸다 · 넘으면 남은 것은 다음 실행이 잇는다(form-pdf 와 같은 셈) */
export const BUDGET_SEC = Number(process.env.DOC_PDF_BUDGET_SEC || 240);
const MAX_FETCH_BYTES = 15 * 1024 * 1024;

/* 한 공고의 첨부 가운데 한글·워드인 것 — 본문 사진은 첨부가 아니다 · 아이콘 꼬리를 뗀 이름으로 한 번만 */
function officeAtts(atts, { skipForm = false, isForm = () => false } = {}) {
  const seen = new Set();
  const out = [];
  for (const a of atts || []) {
    if (!a || a.bodyImage) continue;
    const nm = cleanAttachName(a.name);
    if (!nm || seen.has(nm) || !OFFICE_DOC.test(nm)) continue;
    seen.add(nm);
    if (skipForm && isForm(a)) continue;   // 신청서는 form-pdf 몫 — 두 로봇이 같은 판정을 써야 한 파일에 주인이 하나다
    out.push(a);
  }
  return out;
}

/** 바꿀 대상 — [{ id, pageUrl, files: [{ name, url } | { name, src }] }] (층1·활동은 받을 주소 · 층2는 저장소 사본).
 *  🔴 신청서인가는 form-pdf·앱(app-live attIsForm)과 **같은 판정** — 로봇이 원본 내용으로 가른 roles(data/forms-pdf/index.json · 2026-11-20
 *     attachment-text attachDecision)가 먼저, 없으면 이름 규칙(isApplicationForm). 속이 안내문인 「…신청서.hwp」(roles notice)는 여기서 바꾸고,
 *     이름에 '신청서'가 없는 진짜 서식(roles form)은 form-pdf 몫이라 건너뛴다. */
export function pickDocTargets({ registered = [], activities = [], kosaf = [] } = {}, { today, isApplicationForm, roles = {} }) {
  const out = [];
  for (const it of [...registered, ...activities]) {
    if (!it || !it.id || it.program || it.hidden || !FP.isOpen(it, today)) continue;
    const r = roles[it.id] || {};
    const isForm = (a) => (r[a.name] ? r[a.name] === 'form' : !!isApplicationForm(a));
    const files = officeAtts(it.attachments, { skipForm: true, isForm }).map((a) => ({ name: a.name, url: a.url || '' }));
    if (files.length) out.push({ id: it.id, pageUrl: it.sourceUrl || it.url || '', files });
  }
  for (const k of kosaf) {
    /* 층2는 due 가 마감 — 비어 있으면 모집 중일 수 있어 둔다(CLAUDE.md 「층2」) */
    if (!k || !k.code || !FP.isOpen({ deadline: k.due }, today)) continue;
    const files = officeAtts((k.files || []).map((f) => ({ name: f.name, path: f.path }))).map((a) => ({ name: a.name, src: a.path }));
    if (files.length) out.push({ id: `kosaf-${k.code}`, pageUrl: '', files });
  }
  return out;
}

/* 한글 음절·숫자의 개수 — 표 칸 차례·줄바꿈·띄어쓰기는 변환기마다 달라 보지 않는다 */
function tally(text) {
  const m = new Map();
  for (const ch of String(text || '').normalize('NFC')) if (/[가-힣0-9]/.test(ch)) m.set(ch, (m.get(ch) || 0) + 1);
  return m;
}
/** 원본 글자 중 PDF 에 남은 몫(0~1) — 원본 글자가 MIN_CHARS 보다 적거나 PDF 글자를 못 뽑았으면(null) null(잴 수 없다) */
export function keptRatio(origText, pdfText) {
  if (pdfText == null) return null;   // 🔴 '못 뽑음'은 '글자 0'이 아니다 — pdftotext 가 없는 날 사본이 전부 버려지지 않게(관문이 잰다)
  const o = tally(origText);
  let n = 0;
  for (const c of o.values()) n += c;
  if (n < MIN_CHARS) return null;
  const p = tally(pdfText);
  let kept = 0;
  for (const [ch, c] of o) kept += Math.min(c, p.get(ch) || 0);
  return kept / n;
}

/** 원본 줄 가운데 PDF 에 없는 줄(앞에서 max 개) — 리포트가 「무엇이 빠졌나」를 그대로 보인다(원인을 짐작하지 않게 · 2026-11-20 첫 실행은 %만 남겨 다시 캐야 했다).
 *  줄바꿈 자리는 변환기마다 달라 줄을 통째로 찾지 않는다 — 세 글자 묶음의 절반도 PDF 에 없을 때만 없는 줄로 친다 */
export function missingLines(origText, pdfText, max = 3) {
  if (pdfText == null) return [];
  const sq = (s) => String(s || '').normalize('NFC').replace(/[^가-힣0-9A-Za-z]/g, '');
  const hay = sq(pdfText);
  const grams = new Set();
  for (let i = 0; i + 3 <= hay.length; i += 1) grams.add(hay.slice(i, i + 3));
  const out = [];
  for (const line of String(origText || '').split('\n')) {
    const s = sq(line);
    if (s.length < 4) continue;
    let hit = 0;
    for (let i = 0; i + 3 <= s.length; i += 1) if (grams.has(s.slice(i, i + 3))) hit += 1;
    if (hit / (s.length - 2) < 0.5) { out.push(line.replace(/\s+/g, ' ').trim().slice(0, 60)); if (out.length >= max) break; }
  }
  return out;
}

const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
/** 실패 장부(tried)에서 아직 쉬는 중인가 */
export function resting(tried, key, today, restDays = REST_DAYS) {
  const at = tried && tried[key] && tried[key].at;
  if (!at) return false;
  const d = dayDiff(at, today);
  return Number.isFinite(d) && d < restDays;
}

/* ── 글자 뽑기 (글자 대조의 두 쪽) ───────────────────────────────────────────── */
/** 원본 글자 — HWP 는 hwp-bodytext.py 가 본문을 <파일>.body.txt 로 남기게 한 뒤 attachmentText 로 읽는다(그 함수가 .body.txt 를 먼저 본다).
 *  HWPX·DOCX 는 attachmentText 가 바로 읽는다 · 그 밖(.doc)은 '' — 잴 수 없다. 🔴 늘 임시 폴더의 사본에 부른다(저장소에 .body.txt 를 흘리지 않게) */
export function defaultOrigText(src) {
  const ext = (String(src).match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
  if (ext === 'hwp') {
    spawnSync('python3', [path.join(HERE, 'hwp-bodytext.py'), path.dirname(src)], { encoding: 'utf8', timeout: TEXT_TIMEOUT_MS });
    return attachmentText(src);
  }
  return ext === 'hwpx' || ext === 'docx' ? attachmentText(src) : '';
}
/** PDF 글자 — poppler 의 pdftotext · 도구가 없거나 못 읽으면 null(잴 수 없다 · 사본은 둔다) */
export function defaultPdfText(pdfPath) {
  const r = spawnSync('pdftotext', ['-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', timeout: TEXT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  return r.error || r.status !== 0 ? null : (r.stdout || '');
}

/* ── 한 첨부 → PDF 한 장 ─────────────────────────────────────────────────────── */
/* 🔴 무엇이 넘어져도(본문을 받다 끊김 · 깨진 DOCX/HWPX 를 읽다 RangeError · 도구 오류) **이유를 돌려준다** — 던지면 그 공고에서 로봇이 통째로 멈추고
      실패 장부에도 안 적혀 **매일 밤 같은 파일에서** 다시 멈춘다(리뷰 2026-11-20 · deepfetch 의 파일마다 try 와 같은 규칙).
   🔴 변환은 임시 폴더에서 하고 **글자 대조를 통과한 것만** 결과 폴더로 복사한다 — 결과 폴더에 바로 쓰면 대조 전에 넘어진 사본이
      저장 단계에 실리고(보강 단계라 continue-on-error), 글꼴 도장만 다른 옛 사본은 덮인 뒤 지워져 색인이 없는 파일을 가리킨다. */
/* 원본을 작업 폴더에 — { src } | { why } (층2는 저장소 사본을 복사 · 층1·활동은 한 번 받는다) */
async function obtainSrc({ t, f, root, work, fetchImpl }) {
  if (f.src) {
    const from = path.join(root, f.src);
    if (!fs.existsSync(from)) return { why: '원본 사본 없음' };
    const src = path.join(work, `src.${(f.src.match(/\.(\w+)$/) || [, 'bin'])[1].toLowerCase()}`);
    fs.copyFileSync(from, src);
    return { src };
  }
  /* 게시판 내려받기 스크립트(javascript:…)는 진짜 주소로 푼다(attachment-link.mjs — 확인한 사이트 규칙 · 호출에 절대 주소가 적힌 꼴) — 못 풀면 짐작하지 않는다 */
  const url = /^javascript:/i.test(f.url || '') ? resolveJsDownload(f.url, t.pageUrl) : f.url;
  if (!url) return { why: /^javascript:/i.test(f.url || '') ? '주소 없음(모르는 내려받기 스크립트)' : '주소 없음' };
  const res = await fetchImpl(url, { redirect: 'follow', headers: FETCH_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return { why: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000 || buf.length > MAX_FETCH_BYTES) return { why: `크기 밖(${Math.round(buf.length / 1024)}KB)` };
  if (isHtmlPayload(buf)) return { why: '받은 것이 웹페이지(로그인·차단 화면일 수 있다)' };
  const ext = attachExt(f.name, buf);
  if (!/^(hwp|hwpx|doc|docx)$/.test(ext)) return { why: `한글·워드가 아님(${ext})` };
  const src = path.join(work, `src.${ext}`);
  fs.writeFileSync(src, buf);
  return { src };
}

/* 바꾸고 잰다 — 평소 길로 한 번, **글자가 빠졌으면** 표 줄 높이를 풀어 한 번 더 가서 더 많이 남은 쪽을 고른다(soffice.mjs sofficeToPdfRelaxed 머리말).
   글자가 다 남은 사본(대부분)은 평소 길 그대로다 — 쪽 모양이 바뀌지 않는다. 진단 모드(--probe)가 같은 함수를 부른다(두 길의 결과 tries 를 그대로 찍는다).
   돌려주는 것: { ok: false, why } | { ok: true, pdf, r, ratio, rows?, later?, orig, text, tries: [{ how, ratio?, pages?, miss?, why? }] }
     later — 글자가 빠졌는데 남은 예산이 모자라(mayRelax) 다시 가지 못했다. 부른 쪽이 판 번호(MAKER)를 안 적어 다음 실행이 잇는다 */
function convertChecked({ src, work, name, convert, relax, origText, pdfText, mayRelax = () => true }) {
  const soffice = process.env.DOC_PDF_SOFFICE || process.env.FORM_PDF_SOFFICE || 'soffice';
  const first = path.join(work, 'out.pdf');
  const r = convert(src, first, { soffice, name });
  if (!r || !r.ok) return { ok: false, why: (r && r.why) || '변환 실패' };
  const orig = origText(src);
  const text = pdfText(first);
  let best = { pdf: first, r, text, ratio: keptRatio(orig, text) };
  const tries = [{ how: '평소', ratio: best.ratio, pages: r.pages, miss: missingLines(orig, text, 6) }];
  if (best.ratio != null && best.ratio < 1 && !mayRelax()) {
    best.later = true;
    tries.push({ how: '표 줄 풂', why: '남은 예산이 모자라 다음 실행으로' });
  } else if (best.ratio != null && best.ratio < 1) {
    const loose = relax(src, path.join(work, 'loose'), { soffice });
    const second = path.join(work, 'out-relaxed.pdf');
    const r2 = loose && loose.ok ? convert(loose.made, second, { soffice, name }) : null;   // PDF 를 넘기면 convertOne 은 확인(진짜 PDF · 크기)하고 쪽 수만 센다
    if (r2 && r2.ok) {
      const text2 = pdfText(second);
      const ratio2 = keptRatio(orig, text2);
      tries.push({ how: `표 줄 ${loose.rows}곳 풂`, ratio: ratio2, pages: r2.pages, miss: missingLines(orig, text2, 6) });
      if (ratio2 != null && ratio2 > best.ratio) best = { pdf: second, r: r2, text: text2, ratio: ratio2, rows: loose.rows };
    } else tries.push({ how: '표 줄 풂', why: (loose && !loose.ok && loose.why) || (r2 && r2.why) || '못 함' });
  }
  return { ok: true, ...best, orig, tries };
}

async function makeOne({ t, f, file, root, outDir, today, fetchImpl, convert, relax, origText, pdfText, mayRelax }) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-pdf-'));   // 받은 원본·만든 PDF 는 여기에만 — 커밋하지 않는다
  try {
    const got = await obtainSrc({ t, f, root, work, fetchImpl });
    if (!got.src) return { ok: false, why: got.why };
    const c = convertChecked({ src: got.src, work, name: f.name, convert, relax, origText, pdfText, mayRelax });
    if (!c.ok) return { ok: false, why: c.why };
    if (c.ratio != null && c.ratio < KEEP_MIN) return { ok: false, why: `글자 빠짐(${Math.floor(c.ratio * 100)}%)`, miss: missingLines(c.orig, c.text), later: !!c.later };
    const out = path.join(outDir, file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(c.pdf, out);   // 임시 폴더와 저장소가 다른 디스크일 수 있어 옮기기(rename) 대신 복사
    /* 판 번호(mk)는 이 판의 길을 끝까지 간 사본에만 — 예산이 모자라 다시 가지 못한 사본(later)은 안 적어 다음 실행이 다시 만든다 */
    return { ok: true, entry: { file, name: f.name, pages: c.r.pages, bytes: c.r.bytes, fonts: FP.FONT_STAMP, kept: c.ratio == null ? null : Math.round(c.ratio * 1000) / 1000, ...(c.rows ? { rows: c.rows } : {}), ...(c.later ? {} : { mk: MAKER }), at: today } };
  } catch (e) {
    const why = [e && e.name, e && e.cause && (e.cause.code || e.cause.message), e && e.message].filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 100);
    return { ok: false, why: `오류(${why || '알 수 없음'})` };
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ }
  }
}

/** 실행 전체가 빨간불이어야 하나 — 변환기 자체가 깨진 날만(확장 없음 표식 · 또는 못 읽음이 둘 이상인데 하나도 못 바꿈).
 *  파일 하나가 영영 못 읽히는 꼴(보호된 HWP 등)로는 빨개지지 않는다 — 그 파일이 사흘마다 경보를 열고 닫지 않게(리뷰 2026-11-20 #7) */
export function systemicFailure({ failed = [], done = [] } = {}) {
  const office = failed.filter((f) => /변환기가 못 읽음/.test(f.why || ''));
  return !done.length && (office.some((f) => /H2Orestart/.test(f.why || '')) || office.length >= 2);
}

export function buildDocReport({ today, targets, done, failed, skipped, rested, unchecked, dropped, left, budgetSec, index = { items: {} } }) {
  const L = [];
  const files = targets.reduce((n, t) => n + t.files.length, 0);
  L.push(`## 📄 공고문 → PDF 리포트 (${today})`, '');
  L.push('마감 전 공고의 한글·워드 첨부(신청서 제외 · 층2 재단 공고문은 전부)를 글자 하나 안 바꾸고 PDF 로 바꿔 `data/docs-pdf/` 에 둡니다(마감 뒤 지움).');
  L.push(`🔴 원본 한글·숫자의 ${Math.round(KEEP_MIN * 100)}% 이상이 PDF 에 남은 것만 둡니다(글자 대조) — 못 바꾸거나 빠진 것은 앱에 원본만 보입니다.`, '');
  L.push(`대상 공고 ${targets.length}건 · 파일 ${files}개 — 이번에 바꿈 ${done.length} · 이미 있어 건너뜀 ${skipped} · 못 바꿈 ${failed.length} · 쉬는 중 ${rested} · 대조 안 함 ${unchecked.length} · 마감 지나 지움 ${dropped.length}건${left.length ? ` · ⏰ 예산(${budgetSec}초)이 다 돼 남김 ${left.length}개(다음 실행이 잇는다)` : ''}`, '');
  /* 지금 앱에 나가는 사본 전체의 대조 분포 — 기준(KEEP_MIN)을 실데이터로 맞출 근거(설계 7절) */
  const kept = Object.values(index.items || {}).flat().map((e) => e && e.kept);
  const bucket = new Map();
  for (const k of kept) { const b = k == null ? '대조 안 함' : `${Math.floor(k * 100)}%`; bucket.set(b, (bucket.get(b) || 0) + 1); }
  if (kept.length) L.push(`앱에 나가는 사본 ${kept.length}개의 글자 대조 — ${[...bucket].sort((a, b) => b[0].localeCompare(a[0], 'ko', { numeric: true })).map(([b, n]) => `${b} ${n}`).join(' · ')}`, '');
  /* 평소 길로는 글자가 빠져 표 줄 높이를 풀어 다시 바꾼 사본(soffice.mjs sofficeToPdfRelaxed) — 지금 앱에 나가는 것 전체에서 센다 */
  const loosened = Object.values(index.items || {}).flat().filter((e) => e && e.rows).length;
  if (loosened) L.push(`그중 표의 줄이 접혀 글자가 잘리던 것을 줄 높이를 풀어 다시 바꾼 사본 ${loosened}개`, '');
  if (failed.length) {
    const by = new Map();
    for (const f of failed) { const k = f.why.replace(/\(\d+%\)$/, '(…%)').replace(/\(\d+KB\)$/, '(…KB)'); by.set(k, (by.get(k) || 0) + 1); }
    L.push('### 못 바꾼 것 (이유별 · 사흘 쉬고 다시)');
    [...by].sort((a, b) => b[1] - a[1]).forEach(([w, n]) => L.push(`- ${w}: ${n}개`));
    /* 글자가 빠진 것은 **무엇이 빠졌는지**를 원본 줄 그대로 보인다 — %만으로는 원인을 다시 캐야 한다 */
    failed.slice(0, 30).forEach((f) => L.push(`  - ${f.id} · ${f.name} — ${f.why}${(f.miss || []).length ? ` · 빠진 줄: ${f.miss.map((m) => `「${m}」`).join(' ')}` : ''}`));
    L.push('');
  }
  if (unchecked.length) { L.push(`### 글자 대조를 못 한 사본 — ${unchecked.length}개 (그림 문서·.doc·PDF 글자 도구 없음 · 사본은 둠)`); unchecked.slice(0, 30).forEach((u) => L.push(`- ${u.id} · ${u.name}`)); L.push(''); }
  if (dropped.length) { L.push(`### 마감이 지나 지운 공고 — ${dropped.length}건`); dropped.slice(0, 30).forEach((d) => L.push(`- ${d}`)); L.push(''); }
  return L.join('\n');
}

/* ── 본편 ─────────────────────────────────────────────────────────────────── */
/* 저장소의 데이터로 대상을 고른다 — 본편과 진단 모드가 같은 눈으로 본다 */
function loadTargets({ root, today, isApplicationForm }) {
  const readJson = (rel, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fallback; } };
  const isApp = isApplicationForm || loadFormRules(root).isApplicationForm;
  const targets = pickDocTargets({
    registered: (readJson('data/registered.json', {}) || {}).items || [],
    activities: FP.loadActivities(root),
    kosaf: (readJson('data/kosaf-open.json', {}) || {}).items || [],
  }, { today, isApplicationForm: isApp, roles: (readJson('data/forms-pdf/index.json', {}) || {}).roles || {} });   // 같은 단계 앞에서 form-pdf 가 새로 쓴 판정
  return { targets, readJson };
}

export async function runDocPdf({ root, today, dry = false, budgetSec = BUDGET_SEC, fetchImpl = fetch, convert = FP.convertOne, relax = sofficeToPdfRelaxed,
  origText = defaultOrigText, pdfText = defaultPdfText, isApplicationForm = null, log = console.log } = {}) {
  const { targets, readJson } = loadTargets({ root, today, isApplicationForm });
  const outDir = path.join(root, 'data', 'docs-pdf');
  const indexPath = path.join(outDir, 'index.json');
  const prev = readJson('data/docs-pdf/index.json', null);
  const index = { updatedAt: today, items: {}, tried: {} };
  if (prev && prev.items && typeof prev.items === 'object') index.items = prev.items;
  if (prev && prev.tried && typeof prev.tried === 'object') index.tried = prev.tried;
  const live = new Set(targets.map((t) => t.id));
  const dropped = dry ? Object.keys(index.items).filter((id) => !live.has(id)) : FP.prune(index, live, outDir);
  if (!dry) for (const k of Object.keys(index.tried)) if (!live.has(k.slice(0, k.indexOf('|')))) delete index.tried[k];   // 대상에서 빠진 공고의 실패 장부도 지운다
  const done = []; const failed = []; const left = []; const unchecked = [];
  let skipped = 0; let rested = 0;
  const t0 = Date.now();
  /* 🔴 남은 예산이 파일 하나의 최대 시간(받기 + 변환)보다 적으면 시작하지 않는다 — 단계 시한에 끊기지 않게(form-pdf 11-19 사고와 같은 셈) */
  const overBudget = () => (Date.now() - t0) / 1000 + FILE_MAX_SEC > budgetSec;
  /* 표 줄을 풀어 다시 가는 길도 같은 예산 안에서 — 남은 시간이 그 길의 최대 시간보다 적으면 가지 않는다(다음 실행이 잇는다) */
  const mayRelax = () => (Date.now() - t0) / 1000 + RELAX_MAX_SEC <= budgetSec;
  /* 🔴 넘어져도 지금까지 바꾼 것은 남는다 — 색인은 파일 하나 끝날 때마다 쓴다 */
  const flush = () => { if (dry) return; fs.mkdirSync(outDir, { recursive: true }); index.updatedAt = today; fs.writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n'); };
  for (const t of targets) {
    const have = index.items[t.id] || [];
    const next = [];
    for (let i = 0; i < t.files.length; i += 1) {
      const f = t.files[i];
      const file = `${t.id}/${i + 1}-${FP.safeName(f.name)}.pdf`;
      const key = `${t.id}|${f.name}`;
      const exists = (h) => h.name === f.name && h.file === file && fs.existsSync(path.join(outDir, h.file));
      /* 글자가 덜 남은 옛 사본(kept < 1)은 만드는 법이 바뀌면(MAKER) 한 번 다시 만든다 — 다 남은 사본·잴 수 없던 사본은 그대로 */
      const same = have.find((h) => exists(h) && h.fonts === FP.FONT_STAMP && (h.kept == null || h.kept >= 1 || (h.mk || 1) === MAKER));
      if (same) { next.push(same); skipped += 1; continue; }
      const stale = have.find(exists);   // 글꼴 도장만 다르거나 글자가 덜 남은 옛 사본 — 새로 못 만들면 그대로 둔다(줄이 사라지지 않게)
      /* 쉼도 같은 판에서 실패한 것만 — 만드는 법이 바뀌면 쉬던 실패를 바로 다시 해 본다 */
      if (resting(index.tried, key, today) && (index.tried[key].mk || 1) === MAKER) { rested += 1; if (stale) next.push(stale); continue; }
      if (dry) { log(`[dry] ${t.id} · ${f.name}`); continue; }
      if (overBudget()) { left.push({ id: t.id, name: f.name }); if (stale) next.push(stale); continue; }
      let r;
      try { r = await makeOne({ t, f, file, root, outDir, today, fetchImpl, convert, relax, origText, pdfText, mayRelax }); }
      catch (e) { r = { ok: false, why: `오류(${String((e && e.message) || e).slice(0, 80)})` }; }   // makeOne 이 이유를 돌려주지만 한 겹 더 — 한 파일이 실행을 멈추지 않는다
      if (r.ok) {
        next.push(r.entry);
        delete index.tried[key];
        done.push({ id: t.id, name: f.name, rows: r.entry.rows || 0 });
        if (r.entry.kept == null) unchecked.push({ id: t.id, name: f.name });
      } else {
        index.tried[key] = { at: today, why: r.why, ...(r.later ? {} : { mk: MAKER }) };   // 예산이 모자라 다시 가지 못한 실패는 쉬지 않는다(다음 실행이 바로 잇는다)
        failed.push({ id: t.id, name: f.name, why: r.why, miss: r.miss || [] });
        if (stale) next.push(stale);
      }
      /* 아직 안 본 이 공고의 옛 줄도 남긴다 — 공고 중간에 단계가 끊겨도 그 줄들이 하루 사라졌다 다시 받히지 않게(리뷰 #6) */
      const later = new Set(t.files.slice(i + 1).map((x) => x.name));
      index.items[t.id] = [...next, ...have.filter((h) => later.has(h.name))];
      flush();
    }
    if (dry) continue;
    if (next.length) index.items[t.id] = next; else delete index.items[t.id];
    /* 그 공고 폴더에서 색인에 없는 파일(첨부가 빠지거나 차례가 바뀐 옛 결과)은 지운다 — 폴더째 지우는 prune 이 못 보는 고아 */
    const dir = path.join(outDir, t.id);
    if (fs.existsSync(dir)) {
      const keep = new Set(next.map((h) => path.basename(h.file)));
      for (const fn of fs.readdirSync(dir)) if (!keep.has(fn)) { try { fs.rmSync(path.join(dir, fn), { recursive: true, force: true }); } catch { /* 무시 */ } }
      if (!next.length) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 무시 */ } }
    }
    flush();
  }
  const report = buildDocReport({ today, targets, done, failed, skipped, rested, unchecked, dropped, left, budgetSec, index });
  if (!dry) {
    flush();
    fs.mkdirSync(path.join(root, 'collector'), { recursive: true });
    fs.writeFileSync(path.join(root, 'collector', 'doc-pdf-report.md'), report + '\n');
  }
  log(report);
  return { targets, done, failed, skipped, rested, unchecked, dropped, left, index };
}

/* ── 진단 모드 (--probe) ──────────────────────────────────────────────────────
   「이 파일은 왜 PDF 로 안 바뀌나 · 무엇이 빠지나」를 진짜 변환기로 본다(개발 컴퓨터에는 변환기가 없다 — doc-pdf-probe.yml 이 클라우드에서 돌린다).
   🔴 data/ 에 아무것도 쓰지 않는다 · 쉼도 건너뛴다 — 결과(원본 · 평소 사본 · 표 줄을 푼 사본 · 중간 꼴 fodt)는 keepDir 에만 남긴다(워크플로가 아티팩트로 올린다).
   대상: ids(공고 id) — 비우면 실패 장부의 「글자 빠짐」과, 글자가 덜 남은 채 나가 있는 사본. 본편과 같은 함수(obtainSrc · convertChecked)를 부른다 */
export async function runDocProbe({ root, today, ids = [], keepDir = '', fetchImpl = fetch, convert = FP.convertOne, relax = sofficeToPdfRelaxed,
  origText = defaultOrigText, pdfText = defaultPdfText, isApplicationForm = null, log = console.log } = {}) {
  const { targets, readJson } = loadTargets({ root, today, isApplicationForm });
  const index = readJson('data/docs-pdf/index.json', {}) || {};
  const want = new Set(ids);
  const pick = (t, f) => (want.size ? want.has(t.id)
    : /글자 빠짐/.test((((index.tried || {})[`${t.id}|${f.name}`]) || {}).why || '') || ((index.items || {})[t.id] || []).some((h) => h.name === f.name && h.kept != null && h.kept < 1));
  const pct = (x) => (x == null ? '잴 수 없음' : `${Math.floor(x * 1000) / 10}%`);
  const rows = [];
  for (const t of targets) for (let i = 0; i < t.files.length; i += 1) {
    const f = t.files[i];
    if (!pick(t, f)) continue;
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-probe-'));
    let row;
    try {
      const got = await obtainSrc({ t, f, root, work, fetchImpl });
      const c = got.src ? convertChecked({ src: got.src, work, name: f.name, convert, relax, origText, pdfText }) : { ok: false, why: got.why };
      row = { id: t.id, name: f.name, ok: !!c.ok, why: c.why || '', tries: c.tries || [], kept: c.ok ? c.ratio : null };
      if (keepDir) fs.cpSync(work, path.join(keepDir, `${t.id}-${i + 1}`), { recursive: true });
    } catch (e) {
      row = { id: t.id, name: f.name, ok: false, why: `오류(${String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 100)})`, tries: [], kept: null };
    } finally {
      try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ }
    }
    rows.push(row);
    log(`■ ${row.id} · ${row.name}${row.ok ? ` → 고른 사본 ${pct(row.kept)}` : ` — ${row.why}`}`);
    for (const x of row.tries) log(`   ${x.how}: ${x.why || `${pct(x.ratio)} · ${x.pages}쪽${(x.miss || []).length ? ` · 빠진 줄: ${x.miss.map((m) => `「${m}」`).join(' ')}` : ''}`}`);
  }
  if (!rows.length) log('진단할 파일이 없습니다 — 공고 id 를 주거나(--probe=id,id), 실패 장부에 「글자 빠짐」이 있어야 합니다.');
  return rows;
}

if (!process.env.DOC_PDF_AS_LIB) {
  const argv = process.argv.slice(2);
  const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
  const root = process.env.DOC_PDF_ROOT ? path.resolve(process.env.DOC_PDF_ROOT) : path.resolve(HERE, '..');
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  if (flag('probe') != null) {
    const ids = String(flag('probe') === true ? '' : flag('probe')).split(',').map((s) => s.trim()).filter(Boolean);
    await runDocProbe({ root, today: String(flag('today') || kst), ids, keepDir: process.env.DOC_PDF_PROBE_DIR || '' });
    process.exit(0);
  }
  const r = await runDocPdf({ root, today: String(flag('today') || kst), dry: flag('dry') === true });
  /* 🔴 변환기 자체가 깨진 날만 빨간불(systemicFailure) — 보강 단계라 경보 짝이 이슈를 연다 · 파일 하나가 영영 못 읽히는 꼴로는 경보가 흔들리지 않는다 */
  const officeFails = r.failed.filter((f) => /변환기가 못 읽음/.test(f.why || '')).length;
  if (flag('dry') !== true && systemicFailure(r)) {
    console.error(`::error::공고문 → PDF — 변환기(LibreOffice+H2Orestart)가 ${officeFails}개를 못 읽고 한 개도 못 바꿨습니다. 리포트의 '변환기가 못 읽음' 줄을 보세요.`);
    process.exit(3);
  }
}
