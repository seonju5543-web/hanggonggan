/* 공고문 뒷장의 신청서 서식 쪽 떼기 — 로봇 (2026-10-13 · 개발자 "남은 것 모두 진행" ②)

   🔴 왜 — 실측(2026-10-13): 신청서가 따로 첨부되지 않은 공고라도 **공고문 PDF 뒷장**에 「별지」「[서식 1]」 신청서가 붙어 있다
      (층1 공고문 첨부 17건 중 3건 · 층2 재단 공고문 사본 74개 재단 중 37곳). 양식 PDF 로봇(form-pdf.mjs)은 이름이 신청서인 **파일**만 보므로
      이 서식들은 아무도 꺼내지 않았고 앱은 '양식 없음'이라 불렀다.
   무엇을 — 마감 전 층1(등록) 공고문 첨부 PDF(collector/extracted/elig-*.pdf · 색인 elig-docs.json)와 층2 재단 공고문 사본 PDF(data/kosaf-files/<code>/)의
      쪽마다 글자를 읽어(pdftotext) 서식 쪽을 고르고, 그 쪽만 떼어(pdfseparate + pdfunite) `data/form-pages/<id>/` 에 둔다 + `index.json`.
      원문 글자·쪽 모양을 바꾸지 않는다(떼기만). 앱은 색인을 받아 질문 화면 머리에 「공고문 안 신청서 서식 (n~m쪽)」으로 보여 준다.
   🔴 서식 쪽 판정은 **쪽 글자의 표식**으로만(classifyPage · 순수 함수) — 「붙임 1. 신청서 1부」 같은 첨부 **목록 줄**은 서식이 아니다(표식만 든 짧은 줄만 센다).
      첫 쪽(공고 표지)은 더 엄격하다. 못 고르면 그 공고는 그대로 둔다(지어내지 않는다).
   🔴 AI 가 갈래를 정한 파일(2026-11-21 · 4번 카드 읽기·6번 최종 검토 · collector/attach-role-ai.mjs)은 그 답이 먼저다 — 붙은 문서(mixed)는 AI 가 짚은 「서식이 시작되는 줄」이 든 쪽부터
      끝까지를 떼고(aiFormRange · formStartPage — 줄 머리에서 찾고 그 쪽이 서식 쪽일 때만 · 그 앞쪽은 공고문 PDF 로봇 doc-pdf 가 읽는 글 사본으로 남긴다), 내용 문서·이 공고 문서가 아닌 파일에서는 떼지 않는다.
      통째로 신청 양식이라 한 파일은 양식 PDF 로봇이 맡으면 안 떼고, 그 로봇이 못 보는 파일(자격 색인에만 있는 것)이면 전부를 서식 쪽으로 낸다(formPdfHandles).
      AI 의 답이 없는 파일(옛 공고 · 층2 재단 사본)과 그 줄을 쪽에서 못 찾은 파일만 위의 쪽 글자 표식으로 고른다.
   🔴 양식 PDF 로봇과 **폴더·색인을 따로** 쓴다 — 그 로봇의 prune 이 제 색인에 없는 폴더를 지운다(data/forms-pdf 에 섞어 넣으면 다음 실행에 사라진다).
   🔴 마감 뒤 폴더를 지운다 · 같은 원본(크기 같음)은 다시 안 한다 · 예산(FORM_PAGES_BUDGET_SEC) 안에 끝낸다 · 넘어져도 색인은 파일마다 쓴다.
   🔴 FORM_PAGES_AS_LIB=1 이면 본편을 건너뛴다(관문이 순수 함수만 부른다). FORM_PAGES_ROOT 로 저장소를 바꿔 끼운다.
   필요한 도구: poppler-utils(pdfinfo·pdftotext·pdfseparate·pdfunite) — deep-fetch.yml 의 PDF 글자 단계가 이미 깐다. 없으면 리포트에 적고 0건. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { noticeDocFiles, noticeFormRows, loadNoticeDocIndex } from './attachment-text.mjs';
import { sameTitle } from './detail-url.mjs';
import { sofficeToPdf } from './soffice.mjs';   // LibreOffice 변환 한 곳(전용 프로필 · 시한 · 변환기 말) — 신청서 PDF 로봇과 같이 쓴다
import { loadAiRoles, aiRoleFor, toDecisionRole, aiSig, fileHash16 } from './attach-role-ai.mjs';   // AI 가 정한 첨부 갈래(4번 · 6번) — 붙은 문서(mixed)의 서식 쪽은 AI 가 짚은 줄부터 뗀다
import { applyPdfVerdicts, loadPdfVerdicts } from './pdf-verdicts.mjs';               // 6번이 ok 가 아니라고 본 사본을 내린다(시작할 때 한 번 더)

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const BUDGET_SEC = Number(process.env.FORM_PAGES_BUDGET_SEC || 240);
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_PAGES = 60;   // 이보다 긴 PDF 는 공고문이 아니다(요강집) — 건너뛴다
export const CONVERTIBLE = /\.(pdf|hwp|hwpx|docx?)$/i;   // HWP·HWPX·DOC·DOCX 공고문은 LibreOffice(+H2Orestart)로 PDF 를 만들어 본다 — form-pdf.mjs 와 같은 길

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
/** 층1·활동 글·층2에서 받을 공고문 PDF 목록 — [{ id, name, due, files:[{ src, name }] }]
    activities(2026-11-25 · 대외활동 유료 관문 5-5) — 받아 둔 원본이 있는 열린 활동 글(관리자가 숨긴 글은 아니다). 활동 글의 원본은 신청서 받기가 받은 것뿐이라 filesFor 가 골라 준다 */
export function pickPageTargets({ registered = [], activities = [], kosaf = [], eligIndex = {}, today, extractedDir, kosafDir, exists = fs.existsSync, readdir = fs.readdirSync, filesFor = null }) {
  const out = [];
  for (const it of registered) {
    if (!it || !it.id || it.program || !isOpen(it.deadline, today)) continue;
    /* filesFor — 공고문 첨부 고르기(attachment-text noticeDocFiles · 2026-11-20): 신청서 쪽으로 받았지만 속이 공고문(+뒷장 서식)인 원본도 본다 */
    const files = (filesFor ? filesFor(it) : ((eligIndex[it.id] || {}).files || [])).filter((f) => CONVERTIBLE.test(f)).map((f) => ({ src: path.join(extractedDir, f), name: f }))
      .filter((f) => exists(f.src));
    if (files.length) out.push({ id: it.id, name: it.name || it.id, due: it.deadline || '', files });
  }
  for (const it of activities) {
    if (!it || !it.id || it.hidden || !isOpen(it.deadline, today)) continue;
    const files = (filesFor ? filesFor(it) : []).filter((f) => CONVERTIBLE.test(f)).map((f) => ({ src: path.join(extractedDir, f), name: f })).filter((f) => exists(f.src));
    if (files.length) out.push({ id: it.id, name: it.title || it.id, due: it.deadline || '', files });
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
/* ── AI 가 짚은 서식 쪽 (2026-11-21 개발자 지시 — *"한 문서에 신청양식이랑 내용문서가 동시에 들어있는 경우 -> 분리해서 2개의 pdf 로"*) ─────────────────
   4번·6번 AI 는 붙은 문서(mixed)마다 **서식이 시작되는 줄**(formStart)을 원문 글자 그대로 한 줄 낸다. 그 줄이 든 쪽부터 끝까지가 서식 쪽이다(이 로봇이 뗀다) ·
   그 앞쪽이 읽는 글이다(공고문 PDF 로봇 doc-pdf 가 그 쪽까지만 남긴다 — 같은 함수 formStartPage 로 같은 쪽을 찾는다). */
/** 서식이 시작되는 줄이 든 첫 쪽(1부터) — 못 찾았거나 찾은 쪽이 서식 쪽이 아니면 null.
    🔴 빈칸을 전부 걷고 견준다 — 그 줄은 HWP·DOCX 에서 뽑은 글자이고 PDF 글자(pdftotext)는 표를 다르게 편다(글자 사이를 벌리고 줄을 다른 자리에서 꺾는다).
    🔴 **줄 머리에서만** 찾는다(리뷰 2026-11-23) — 공고 본문은 제출 서류 목록에서 그 서식을 이름으로 부른다(「가. 장학금 신청서 1부([별지 제1호 서식])」).
       쪽 글자 아무 데서나 찾으면 그 앞쪽에서 잘려 공고문 사본은 제출·일정 쪽을 잃고, 서식 쪽 사본에는 공고문 쪽이 든다.
    찾는 차례: ① 그 줄로 **시작하는** 줄이 있는 첫 쪽(오른쪽에 붙은 「(앞쪽)」·「접수번호」 칸 글자는 넘긴다) ② 줄 머리부터 이어지는 줄들이 그 줄을 차례로 덮는 첫 쪽
                 (머리글과 제목을 한 줄로 적은 답 — PDF 글자는 두 줄로 꺾는다 · 줄마다 끝에 남은 칸 글자는 넘긴다) ③ 그 줄의 앞 12자로 ②.
    🔴 찾은 쪽이 쪽 글자 표식(classifyPage)으로도 서식 쪽일 때만 그 쪽이다 — 아니면 못 찾은 것으로 친다(서식 쪽 떼기는 쪽 글자 표식으로 고르는 예전 길 · 공고문 PDF 는 자르지 않는다).
       두 로봇이 이 함수 하나를 부른다(같은 쪽에서 가른다).
    4자 못 되는 줄로는 찾지 않는다(아무 쪽에나 걸린다). pageText·pages 는 관문이 가짜를 넘긴다(poppler 없이 잰다) ·
    pages 를 안 주면 쪽 수를 읽고, 🔴 못 읽으면 던진다 — 「쪽을 못 읽음」을 「서식 쪽 없음」으로 적으면 공고문 PDF 가 그 답으로 끝났다고 보고 다시 자르지 않는다 */
export function formStartPage(pdf, formStart, { pageText = pdfPageText, pages } = {}) {
  const squeeze = (s) => String(s || '').normalize('NFC').replace(/\s+/g, '');
  const line = squeeze(formStart);
  if (line.length < 4) return null;
  const count = pages ?? ((pc) => { if (!pc.ok) throw new Error(pc.why); return pc.pages; })(pdfPageCount(pdf));
  const raw = [];
  for (let p = 1; p <= count; p += 1) raw.push(String(pageText(pdf, p) || ''));
  const lines = raw.map((t) => t.split(/\n|\f/).map(squeeze).filter(Boolean));
  /* i 째 줄부터 이어지는 줄들이 want 를 앞에서부터 덮는가 — 줄마다 남은 want 의 앞부분과 같은 만큼 먹고(그 줄 끝의 나머지는 넘긴다) · 한 글자도 못 먹는 줄에서 멈춘다 */
  const covers = (ls, i, want) => {
    for (let j = i, rest = want; j < ls.length; j += 1) {
      let k = 0;
      while (k < rest.length && ls[j][k] === rest[k]) k += 1;
      if (k === rest.length) return true;
      if (!k) return false;
      rest = rest.slice(k);
    }
    return false;
  };
  /* 그 줄이 걸리고 **서식 쪽이기도 한**(classifyPage) 첫 쪽 (2026-11-23) — 앞쪽 공고문의 붙임 목록·차례가 줄 머리에서 서식 이름으로 시작해도 그 쪽은 건너뛰고
     뒤의 진짜 서식 쪽을 고른다(첫 번째로 걸린 쪽만 보고 포기하면 AI 의 답을 버리고 예전 길로 간다) */
  const isForm = (at) => classifyPage(raw[at], at + 1) === 'form';
  const first = (hit) => { const at = lines.findIndex((ls, idx) => ls.some((l, i) => hit(ls, l, i)) && isForm(idx)); return at >= 0 ? at + 1 : null; };
  return first((ls, l) => l.startsWith(line)) || first((ls, l, i) => covers(ls, i, line)) || first((ls, l, i) => covers(ls, i, line.slice(0, 12)));
}
/** AI 의 답으로 서식 쪽 구간을 정한다 — [[시작 쪽, 끝 쪽]] | 'none'(이 파일에서는 떼지 않는다) | null(AI 의 답이 없거나 그 줄을 못 찾음 → 쪽 글자 표식으로 고르는 예전 길).
    ai = 그 파일의 답({ role, formStart }) · pages = 쪽 수 · find(formStart) = 그 줄이 든 첫 쪽 | null · formPdfHas = 그 파일을 양식 PDF 로봇이 맡는가(formPdfHandles).
    🔴 AI 가 답한 파일에서는 쪽 글자 표식이 쪽을 떼지 않는다: 내용 문서(content)에는 서식이 없고 · 이 공고 문서가 아닌 것(other)은 뗄 것이 없다.
    🔴 통째로 신청 양식(form)은 양식 PDF 로봇이 맡는 파일이면 여기서 안 뗀다(같은 서식이 두 번 보인다) — 그 로봇이 못 보는 파일(자격 색인에만 있는 순수 서식 · 「붙임2.hwp」)이면
       여기서 **전부**를 서식 쪽으로 낸다(2026-11-22). 안 내면 AI 가 신청 양식이라 한 파일이 앱 신청서 칸 어디에도 안 선다 */
export function aiFormRange(ai, pages, find, formPdfHas = true) {
  if (!ai || !ai.role) return null;
  if (ai.role === 'form') return formPdfHas ? 'none' : [[1, pages]];
  if (ai.role !== 'mixed') return 'none';
  const p0 = find(ai.formStart);
  return p0 ? [[p0, pages]] : null;
}
/** 그 원본을 양식 PDF 로봇(form-pdf)이 맡는가 — 그 공고의 신청서 쪽 색인 줄(forms-index · attachment-text noticeFormRows) 가운데 그 파일이 있거나(이름) 바이트가 같은 파일이 있다.
    rows = 그 공고의 색인 줄 · name = 원본 이름(extracted/ 기준) · hash = 그 원본의 바이트 해시 · hashOf(file) = 색인 줄 파일의 해시 */
export const formPdfHandles = (rows, name, hash, hashOf) => (rows || []).some((r) => r.file === name || (!!hash && hashOf(r.file) === hash));
const AI_NONE = { content: 'AI: 서식 없는 내용 문서', form: 'AI: 통째로 신청 양식(양식 PDF 로봇 몫)', other: 'AI: 이 공고의 문서가 아님' };
/** 지난 색인 줄이 지금 원본·지금 AI 답으로 만든 것인가 — 같으면 다시 하지 않는다. 「서식 쪽 없음」(none) 줄도 같은 셈이다:
    🔴 최종 검토가 내린 사본(collector/pdf-verdicts.mjs)이 none 줄로 남아, 원본이 바뀌거나(srcBytes) AI 의 답이 바뀔 때까지 같은 쪽을 다시 떼지 않는다(다시 떼면 6번이 돈 내고 또 내린다) */
export const sameSource = (h, name, srcBytes, ai = '') => !!h && h.src === name && (h.srcBytes || 0) === srcBytes && (h.ai || '') === ai;

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
  const conv = sofficeToPdf(src, work, { soffice });   // 실패 문구는 soffice.mjs 한 곳(신청서 PDF 로봇과 같은 말 · 변환기가 한 말까지)
  if (!conv.ok) { fs.rmSync(work, { recursive: true, force: true }); return { ok: false, why: conv.why }; }
  const made = conv.made;
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
  /* 최종 검토(6번)가 ok 가 아니라고 본 사본을 내린다 — 색인이 옛 판으로 되돌려졌을 때를 위해 시작할 때 한 번 더(색인을 읽기 전에 · form-pdf 와 같은 줄) */
  if (!dry) applyPdfVerdicts({ root, verdicts: loadPdfVerdicts(root), today });
  const reg = JSON.parse(fs.readFileSync(path.join(root, 'data', 'registered.json'), 'utf8')).items || [];
  let kosaf = [];
  try { kosaf = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kosaf-open.json'), 'utf8')).items || []; } catch { /* 층2 없음 */ }
  let acts = [];   // 활동 글(id 있는 것만) — 받아 둔 원본이 있으면 서식 쪽을 뗀다(2026-11-25 · 대외활동 유료 관문)
  try { acts = (JSON.parse(fs.readFileSync(path.join(root, 'data', 'activities.json'), 'utf8')).items || []).filter((it) => it && it.id && it.url); } catch { /* 활동 피드 없음 */ }
  let eligIndex = {};
  try { eligIndex = JSON.parse(fs.readFileSync(path.join(root, 'collector', 'extracted', 'elig-docs.json'), 'utf8')); } catch { /* 첫 실행 */ }
  const outDir = path.join(root, 'data', 'form-pages');
  const indexPath = path.join(outDir, 'index.json');
  const reportPath = path.join(root, 'collector', 'form-pages-report.md');
  let index = { updatedAt: today, items: {} };
  try { const j = JSON.parse(fs.readFileSync(indexPath, 'utf8')); if (j && j.items) index = j; } catch { /* 첫 실행 */ }
  const extractedDir = path.join(root, 'collector', 'extracted');
  /* 공고문 고르기는 attachment-text noticeDocFiles 한 곳 — 자격 색인 + 신청서 쪽에서 속이 공고문인 것(내용 판정 · 2026-11-20) */
  const noticeIndex = loadNoticeDocIndex(extractedDir);
  /* AI 가 정한 첨부 갈래(4번 · 6번 — 없으면 빈 표) — 이름이 신청서여도 붙은 문서(mixed)면 여기서 서식 쪽을 떼고, 통째로 신청 양식·이 공고 문서 아님은 안 본다(층2 재단 사본에는 답이 없다) */
  const aiRoles = loadAiRoles(path.join(root, 'collector'));
  const filesFor = (it) => noticeDocFiles(it, { index: noticeIndex, sameTitle, aiRoles: (id, file, abs) => toDecisionRole((aiRoleFor(aiRoles, id, file, abs) || {}).role) });
  const targets = pickPageTargets({ registered: reg, activities: acts, kosaf, eligIndex, today, extractedDir, kosafDir: path.join(root, 'data', 'kosaf-files'), filesFor });
  const regById = new Map([...reg, ...acts].map((it) => [it && it.id, it]));
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
    const formRows = noticeFormRows(regById.get(t.id), noticeIndex, sameTitle);   // 이 공고의 신청서 쪽 색인 줄 — 양식 PDF 로봇이 맡는 파일들(층2 재단 공고에는 없다)
    t.files.forEach((f, i) => {
      const srcBytes = fs.statSync(f.src).size;
      /* 이 파일에 AI 가 정한 갈래 — 색인 줄에 그 답(ai)을 적어 두고, 답이 바뀌면(4번이 새로 읽음 · 6번이 고침) 그대로 쓰지 않고 다시 한다 */
      const ai = aiRoleFor(aiRoles, t.id, f.name, f.src);
      /* 통째로 신청 양식이라 한 파일 — 양식 PDF 로봇이 맡는 파일이면 여기서 안 떼고(handled), 자격 색인에만 있는 파일이면 여기서 전부를 서식 쪽으로 낸다.
         그 갈림도 표시에 적는다(+whole) — 나중에 그 파일을 신청서 로봇이 받아 양식 PDF 로봇 몫이 되면 표시가 달라져 여기 것을 거둔다(거꾸로도) */
      const handled = !!ai && ai.role === 'form' && formPdfHandles(formRows, f.name, fileHash16(f.src), (file) => fileHash16(path.join(extractedDir, file)));
      const sig = aiSig(ai) + (ai && ai.role === 'form' && !handled ? '+whole' : '');
      /* 🔴 '서식 쪽 없음'(none) 항목은 file 이 없다 — path.join(undefined) 로 넘어진다(2026-10-24 첫 예약 실행 · 색인이 처음 생긴 뒤 두 번째 실행부터 매번). file 있는 항목만 본다 */
      const prev = have.find((h) => h.src === f.name && h.file && !h.none && sameSource(h, f.name, srcBytes, sig) && fs.existsSync(path.join(outDir, h.file)));
      if (prev) { next.push(prev); skipped += 1; any = true; return; }
      const prevNone = have.find((h) => h.none && sameSource(h, f.name, srcBytes, sig));
      if (prevNone) { next.push(prevNone); skipped += 1; return; }
      /* AI 가 「이 파일에서 뗄 서식 쪽이 없다」고 한 것(내용 문서 · 양식 PDF 로봇이 맡는 신청 양식 · 이 공고 문서 아님) — 바꾸지도 떼지도 않고 그렇게 적는다 */
      if (aiFormRange(ai, 0, () => null, handled) === 'none') { next.push({ src: f.name, srcBytes, none: true, at: today, why: AI_NONE[ai.role], ai: sig }); return; }
      const mark = sig ? { ai: sig } : {};
      if (srcBytes > MAX_PDF_BYTES) { failed.push({ id: t.id, name: f.name, why: '너무 큼' }); return; }
      const conv = toPdf(f.src);
      if (!conv.ok) { failed.push({ id: t.id, name: f.name, why: conv.why }); return; }
      const cleanup = () => { if (conv.temp) { try { fs.rmSync(conv.work, { recursive: true, force: true }); } catch { /* 무시 */ } } };
      try {
        const pc = pdfPageCount(conv.pdf);
        if (!pc.ok) { failed.push({ id: t.id, name: f.name, why: pc.why }); return; }
        if (pc.pages > MAX_PAGES) { next.push({ src: f.name, srcBytes, none: true, at: today, why: `쪽 수 ${pc.pages}`, ...mark }); return; }
        /* 🔴 붙은 문서(AI: mixed)는 AI 가 짚은 「서식이 시작되는 줄」이 든 쪽부터 끝까지가 서식 쪽이다 — 쪽 글자 표식(classifyPage)으로 고르지 않는다.
           양식 PDF 로봇이 못 보는 신청 양식(AI: form · 자격 색인에만 있는 파일)은 전부가 서식 쪽이다.
           그 줄을 쪽에서 못 찾았거나 AI 의 답이 없는 파일(옛 공고 · 층2 재단 사본)만 예전처럼 쪽 글자 표식으로 고른다 */
        let ranges = aiFormRange(ai, pc.pages, (line) => formStartPage(conv.pdf, line, { pages: pc.pages }), handled);
        if (!Array.isArray(ranges)) {
          const formPages = [];
          for (let p = 1; p <= pc.pages; p += 1) if (classifyPage(pdfPageText(conv.pdf, p), p) === 'form') formPages.push(p);
          if (!formPages.length) { next.push({ src: f.name, srcBytes, none: true, at: today, ...mark }); return; }
          ranges = groupRanges(formPages);
        }
        const file = `${t.id}/${i + 1}-${safeName(f.name)}_p${ranges[0][0]}-${ranges[ranges.length - 1][1]}.pdf`;
        if (dry) { log(`[dry] ${t.id} · ${f.name} → ${rangeLabel(ranges)}쪽`); return; }
        const r = extractRanges(conv.pdf, ranges, path.join(outDir, file));
        if (!r.ok) { failed.push({ id: t.id, name: f.name, why: r.why }); return; }
        next.push({ file, name: `공고문 안 신청서 서식 (${rangeLabel(ranges)}쪽)`, pages: r.pages, bytes: r.bytes, src: f.name, srcBytes, srcPages: rangeLabel(ranges), from: '공고문 서식 쪽 떼기', at: today, ...mark });
        done.push({ id: t.id, name: t.name, src: f.name, ranges: rangeLabel(ranges), pages: r.pages });
        any = true;
        flush();
      } finally { cleanup(); }
    });
    if (!next.some((h) => h.file)) none.push({ id: t.id, name: t.name });
    if (next.length) index.items[t.id] = next; else if (!dry) delete index.items[t.id];
    if (!dry && fs.existsSync(path.join(outDir, t.id))) {
      /* 🔴 뒤 단계(form-fields.mjs)의 결과물·사람 장부는 고아가 아니다 — fields.json · fields-fix.json(관리자 칸 지정) · 살아 있는 PDF 의 「<이름>-pages」 쪽 그림 폴더는 둔다
         (2026-11-18 리뷰 — 서식 쪽도 「양식 채우기」가 열리게 한 뒤 이 정리가 매일 그 파일을 지워 앱에 한 번도 안 닿을 뻔했다 · form-pdf.mjs 의 같은 정리와 같은 목록) */
      const keep = new Set(next.filter((h) => h.file).flatMap((h) => [path.basename(h.file), `${path.basename(h.file).replace(/\.pdf$/i, '')}-pages`]).concat(['fields.json', 'fields-fix.json']));
      for (const fn of fs.readdirSync(path.join(outDir, t.id))) if (!keep.has(fn)) { try { fs.rmSync(path.join(outDir, t.id, fn), { recursive: true, force: true }); } catch { /* 무시 */ } }
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
