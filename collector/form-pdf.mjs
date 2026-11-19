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
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sameTitle } from './detail-url.mjs';
import { loadFormRules, cleanAttachName, sameAttach, attachExt } from './form-rules.mjs';
import { attachDecision, roleText, isNoticeDoc } from './attachment-text.mjs';

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

/* data.js 의 신청서 판정을 **불러 쓴다**(베끼면 앱과 로봇이 다른 첨부를 신청서라 부른다) — 떼어 오는 규칙은 form-rules.mjs 한 곳(card-coverage 도 같이 쓴다 · 2026-11-15) */
export { loadFormRules };

/* 활동 피드(data/activities.json)의 글 — id 있는 것만(수집 로봇이 idFromUrl('act-') 로 준다 · API 글은 제 id) · 없으면 빈 배열 */
export function loadActivities(root) {
  try { const j = JSON.parse(fs.readFileSync(path.join(root, 'data', 'activities.json'), 'utf8')); return (j.items || []).filter((it) => it && it.id && it.url); } catch { return []; }
}

/* forms-index.txt 줄 → { file, title, attach, bytes, id } — 다섯째 칸 id 는 밀린 목록이 받은 줄에만 있다(2026-10-30 리뷰: 같은 제목의 두 학교 글이 한 원본을 나눠 쓰던 것) */
export function parseFormsIndex(text) {
  return String(text || '').split('\n').filter(Boolean).map((line) => {
    const [file, title, attach, bytes, id] = line.split('\t');
    if (!file || !attach) return null;
    const row = { file, title: title || '', attach, bytes: Number(bytes) || 0 };
    if (id && id.trim()) row.id = id.trim();   // 옛 줄(넷째 칸까지)은 모양 그대로 — id 칸은 있을 때만
    return row;
  }).filter(Boolean);
}

/* 마감 전인가 — 마감을 모르면 둔다(정직하게 '마감 전'이 아니라 '마감 모름'이지만, 지난 것을 지우는 쪽이 아니면 둔다) */
export const isOpen = (it, today) => !it.deadline || String(it.deadline) >= today;

/* 받은 원본의 글자로 신청서인가를 가른다(2026-11-20 · attachment-text attachDecision 한 곳) — 글자를 못 읽으면 이름 규칙 그대로 */
/* paid — 유료 첨부 판정(collector/attach-role-read.mjs)의 결과 { items: { '<id>|<첨부 이름>': { file, role } } } · 글자가 없어 무료 판정이 '모름'인 파일에만 쓴다 */
export const contentDecide = (extractedDir, paid = {}) => (a, row, nameForm, it) => {
  const file = path.join(extractedDir, row.file);
  const p = ((paid && paid.items) || {})[`${it && it.id}|${a.name}`];
  /* 🔴 같은 이름에 다른 바이트가 덮였으면 옛 답을 안 쓴다(바이트 해시 · attach-role-read 와 같은 셈 · 리뷰) */
  const same = p && p.role && p.file === row.file && p.hash === fileHash16(file);
  return attachDecision(a.name, roleText(file), nameForm, same ? p.role : null);
};
const fileHash16 = (f) => { try { return crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 16); } catch { return ''; } };
/** 공고 첨부 하나의 원본 줄(forms-index) — 🔴 id 가 적힌 줄은 **그 공고 것만** 쓴다(제목이 같은 다른 학교 글에 넘기지 않는다) · id 없는 옛 줄(사람 표적)은 제목으로.
 *  양식 PDF 로봇과 유료 첨부 판정이 같이 쓴다(베끼면 둘이 다른 원본을 본다) */
export function findRow(it, a, indexRows, titles = [it.boardTitle, it.name, it.title].filter(Boolean)) {
  return indexRows.find((r) => sameAttach(r.attach, a.name) && r.id && r.id === it.id)
    || indexRows.find((r) => sameAttach(r.attach, a.name) && !r.id && titles.some((t) => sameTitle(t, r.title)));
}
const nameDecide = (a, row, nameForm) => ({ form: nameForm, notice: false, role: null, by: 'name' });

/** 바꿀 대상 — 마감 전 공고의 신청서 첨부와 그 원본 파일.
 *  🔴 2026-11-20 — 신청서인지는 **받은 원본의 내용**이 정한다(decide · 기본은 옛 이름 규칙 — 관문이 순수하게 부른다).
 *     그래서 문서 첨부(HWP·HWPX·DOC·DOCX·PDF)는 이름과 상관없이 전부 본다: `[서식] 1~3.hwp`·`공적활동확인서.hwp` 처럼 이름에 '신청서'가 없는
 *     진짜 서식이 앱에 안 올라왔다(마감 전 등록 실측). 원본이 없으면 이름이 신청서인 것은 missing, 그 밖은 unread(받아서 읽어 볼 것)에 적는다.
 *  roles — 내용 판정이 이름 규칙과 **다른** 첨부만 { [공고 id]: { [첨부 이름]: 'form'|'notice' } } — 앱 신청서 칸이 이것을 먼저 본다(app-live attIsForm) */
export function pickFormTargets(items, indexRows, { today, isApplicationForm, decide = nameDecide }) {
  const out = []; const missing = []; const unread = []; const roles = {};
  for (const it of items || []) {
    if (!it || !it.id || it.program || it.hidden || !isOpen(it, today)) continue;
    /* 🔴 아이콘 꼬리(`… .hwp chevron_forward`)를 뗀 이름으로 본다 · 같은 첨부가 꼬리 있는 것·없는 것 두 줄로 실린 공고는 하나로 (2026-11-15 · 강원대 도전장학금) */
    const seenNames = new Set();
    const docs = (it.attachments || []).filter((a) => {
      const nm = cleanAttachName(a && a.name);
      if (!nm || seenNames.has(nm) || a.bodyImage || /부속기관|부설/.test(nm)) return false;
      const ok = CONVERTIBLE.test(nm);
      if (ok) seenNames.add(nm);
      return ok;
    });
    if (!docs.length) continue;
    const titles = [it.boardTitle, it.name, it.title].filter(Boolean);   // 활동 글(data/activities.json)은 title 하나 — 같은 줄 꼴로 색인에 적혀 있다(2026-10-30)
    const files = [];
    for (const a of docs) {
      const nameForm = !!(isApplicationForm(a) || PDF_FORM(a));
      const row = findRow(it, a, indexRows, titles);
      /* 안 받은 것 — 이름이 신청서면 missing · 이름이 공고문이면 자격 로봇(--elig-attach)이 받는다 · **어느 쪽도 아닌 이름**(「붙임1.hwp」·「[Form]…」)은
         아무도 안 받았다 → unread(밀린 목록이 받아 내용으로 가른다) */
      /* .doc(옛 워드)는 글자를 못 뽑아(attachmentText) 받아도 내용으로 못 가른다 — unread 에 넣지 않는다(리뷰) */
      if (!row) { if (nameForm) missing.push({ id: it.id, name: a.name }); else if (!isNoticeDoc(a.name) && !/\.doc$/i.test(cleanAttachName(a.name))) unread.push({ id: it.id, name: a.name }); continue; }
      const d = decide(a, row, nameForm, it);
      if (d.form !== nameForm && d.by !== 'name') (roles[it.id] ||= {})[a.name] = d.form ? 'form' : 'notice';
      if (d.form) files.push({ src: row.file, name: a.name, srcBytes: row.bytes || 0 });
    }
    if (files.length) out.push({ id: it.id, name: it.name || it.title || it.id, deadline: it.deadline || '', files });
  }
  return { targets: out, missing, unread, roles };
}

/* ── 아직 못 받은 신청서 원본을 로봇이 스스로 고른다 (2026-10-30) ───────────────────────────
   🔴 왜: 신청서 원본을 받는 로봇(deepfetch --forms-only · 매일 03:33)은 사람이 run-deepfetch.txt 에 적은 제목만 받았다.
      그래서 10-23 부터 매일 돌아도 새 공고는 한 건도 안 받았고, 마감 전 등록 공고 136건 중 16건이 '신청서 첨부는 있는데 원본은 없음'으로
      남아 학생은 앱 지원문서만 봤다(2026-10-30 실측 · 설계 문서 §5 누수 ③). 사람이 적는 표적은 그대로 두고, 남는 자리를 이 목록이 채운다.
   무엇을: pickFormTargets 가 「아직 못 받음」으로 센 공고(= 마감 전 · 신청서 첨부 있음 · 색인에 원본 없음)를 공고 단위로 묶는다.
   순서: 마감이 가까운 것부터(마감 모름은 뒤) · 같은 날이면 id 순(실행마다 같은 순서 — 예산에 잘려도 다음 실행이 이어 받는다).
   쉼: 받아 보려 했는데 못 받은 공고(tried[id] = 날짜)는 restDays 동안 다시 안 두드린다(로그인 벽·깨진 주소를 매일 두드리지 않는다).
   돌려주는 것: [{ it, atts }] — atts 는 그 공고의 **신청서 첨부만**(공고문·결과보고서는 자격 로봇 몫 · 받는 로봇이 이 목록만 받는다). */
export function pickFormBacklog(items, indexRows, { today, isApplicationForm, tried = {}, restDays = 3, max = 12, exclude = new Set() } = {}) {
  const { missing, unread } = pickFormTargets(items, indexRows, { today, isApplicationForm });
  /* 🔴 2026-11-20 — 이름이 신청서도 공고문도 아닌 문서 첨부(unread)도 받는다: 받아서 읽어야 신청서인지 공고문인지 안다(attachDecision).
     이름이 신청서인 것(missing)이 있는 공고가 먼저다 — 상한(max)에 잘려도 확실한 신청서부터 받는다 */
  const byId = new Map(); const sure = new Set(missing.map((m) => m.id));
  for (const m of [...missing, ...unread]) { if (!byId.has(m.id)) byId.set(m.id, new Set()); byId.get(m.id).add(m.name); }
  const days = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const out = [];
  for (const it of items || []) {
    if (!it || !byId.has(it.id) || exclude.has(it.id)) continue;
    const at = tried[it.id];
    if (at && Number.isFinite(days(at, today)) && days(at, today) < restDays) continue;
    const names = byId.get(it.id);
    const atts = (it.attachments || []).filter((a) => a && a.url && names.has(a.name));
    if (atts.length) out.push({ it, atts });
  }
  out.sort((a, b) => (sure.has(b.it.id) - sure.has(a.it.id)) || (a.it.deadline || '9999').localeCompare(b.it.deadline || '9999') || String(a.it.id).localeCompare(String(b.it.id)));
  return out.slice(0, Math.max(0, max | 0));
}

/* 표적 공고 갈아끼우기에서 지울 옛 색인 줄 (2026-11-12 리뷰 확정 둘 · deepfetch downloadForms 가 부른다 · 순수 함수라 관문이 직접 잰다).
   지우는 것은 **제목이 그 공고와 똑같고 id 칸이 없는** 옛 줄 가운데, 첨부 이름이 이번에 새로 저장한 것(written)과 같은 줄뿐이다.
   ① 파일 이름 머리(form-<제목 지문>-)로 지우면 같은 제목의 다른 학교 글·밀린 목록이 id 를 달아 받은 원본까지 지운다.
   ② 예산에 잘렸거나(budgetHit) 하나도 못 받았으면 아무것도 안 지운다 · 못 받은 첨부의 옛 원본은 남긴다. */
export function staleFormRows(indexLines, { title, written, budgetHit = false } = {}) {
  const w = written instanceof Set ? written : new Set(written || []);
  if (budgetHit || !w.size) return [];
  const cols = (line) => String(line).split('\t');
  const savedAttach = new Set(indexLines.filter((l) => w.has(cols(l)[0])).map((l) => cols(l)[2]));
  return indexLines.filter((l) => {
    const [file, t, attach, , id] = cols(l);
    return !w.has(file) && t === title && !(id || '').trim() && savedAttach.has(attach);
  });
}

/* PDF 쪽 수 — 뷰어 없이 글자로 센다(`/Type /Page` · `/Pages` 는 뺀다). 객체 스트림(/ObjStm)에 든 PDF 는 글자로 안 보여 0 이 나온다 —
   0 은 '모름'이지 '빈 PDF'가 아니다(리뷰 2026-10-12: 받아 둔 원본 25개 중 7개가 0 으로 세어졌다 — 거절하면 멀쩡한 양식을 버린다) */
export function pdfPages(buf) {
  const s = buf.toString('latin1');
  const n = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  return n;
}

export const safeName = (name) => String(name || '').replace(/\.[^.]+$/, '').replace(/[^0-9A-Za-z가-힣._-]+/g, '_').slice(0, 60) || 'form';

/* 🔴 LibreOffice 는 **전용 프로필 폴더**로 띄운다(2026-10-27) — 러너에서 확장을 root(sudo unopkg)로 깔면 /home/runner/.config/libreoffice 가 root 소유가 되어
   runner 의 soffice 가 '권한 없음'(종료 77)으로 시작조차 못 했다(10-12 부터 HWP 변환 0건 · 변환기 말을 리포트에 남겨 알았다).
   임시 폴더의 프로필은 실행마다 새로 만들어지고(파일마다가 아니라 실행마다 하나 · 첫 기동 2~4초), 공유 확장(--shared)은 어느 프로필에서나 보인다. */
let LO_PROFILE = null;
export function loProfileArg() {
  if (!LO_PROFILE) { LO_PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-profile-')); }
  return `-env:UserInstallation=${pathToFileURL(LO_PROFILE).href}`;
}
/** 한 파일을 PDF 로 — pdf 는 복사 · 나머지는 soffice. { ok, out, pages, bytes, why } */
export function convertOne(src, outPath, { soffice = 'soffice', tmpDir, name = '' } = {}) {
  if (!fs.existsSync(src)) return { ok: false, why: '원본 파일 없음' };
  let ext = (src.match(/\.(\w+)$/) || [, ''])[1].toLowerCase();
  /* `.bin` 으로 저장된 옛 원본(이름 꼬리 때문 · form-rules attachExt 주석)은 첨부 이름 → 파일 머리로 진짜 꼴을 찾아, 그 확장자의 임시 사본으로 바꾼다 */
  if (ext === 'bin') {
    const real = attachExt(name, fs.readFileSync(src));
    if (real === 'bin' || !/^(hwp|hwpx|doc|docx|pdf)$/.test(real)) return { ok: false, why: '파일 꼴을 모름(.bin)' };
    const work = tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'form-bin-'));
    const copy = path.join(work, `${path.basename(src, '.bin')}.${real}`);
    fs.copyFileSync(src, copy);
    const r = convertOne(copy, outPath, { soffice, tmpDir: work, name });
    if (!tmpDir) { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ } }
    return r;
  }
  let pdfBuf = null;
  if (ext === 'pdf') pdfBuf = fs.readFileSync(src);
  else {
    /* 작업 폴더는 시스템 임시 폴더에 — 결과 폴더 안에 두면 단계가 시한에 죽을 때 찌꺼기가 git add 에 실린다(리뷰 2026-10-12) */
    const work = tmpDir || fs.mkdtempSync(path.join(os.tmpdir(), 'form-pdf-'));
    const done = () => { if (!tmpDir) { try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* 무시 */ } } };
    const r = spawnSync(soffice, ['--headless', '--norestore', loProfileArg(), '--convert-to', 'pdf', '--outdir', work, src], { encoding: 'utf8', timeout: SOFFICE_TIMEOUT_MS });
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

export function buildReport({ today, targets, missing, done, failed, dropped, skippedSame, left = [], budgetSec = BUDGET_SEC, roles = {}, unread = [] }) {
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
  /* 내용 판정(attachDecision)이 이름 규칙을 뒤집은 것 — 선조치후보고 */
  const flips = Object.entries(roles).flatMap(([id, m]) => Object.entries(m).map(([name, r]) => ({ id, name, r })));
  if (flips.length) {
    L.push(`### 원본 내용을 읽고 이름과 다르게 가른 첨부 — ${flips.length}개`);
    flips.slice(0, 40).forEach((f) => L.push(`- ${f.r === 'form' ? '➕ 신청서로 올림(빈칸·서명란이 있는 서식)' : '➖ 신청서 칸에서 뺌(속이 안내문)'} · ${f.id} · ${f.name}`));
    L.push('');
  }
  if (unread.length) L.push(`(이름만으로는 신청서인지 모르는 문서 첨부 ${unread.length}개 — 원본을 받는 대로 내용으로 가른다 · deepfetch 밀린 목록)`);
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
  /* 대외활동·공모전 글도 같은 로봇이 바꾼다(2026-10-30 · 공동개발자 "공모전 신청 양식이 매우 미흡") — 열쇠는 수집 로봇이 준 id('act-…' · api-…) · 숨긴 글은 뺀다 */
  const items = [...(reg.items || []), ...loadActivities(root)];
  const rows = fs.existsSync(idxPath) ? parseFormsIndex(fs.readFileSync(idxPath, 'utf8')) : [];
  const { isApplicationForm } = loadFormRules(root);
  /* 유료 첨부 판정 결과(없으면 빈 것) — 글자 없는 PDF·그림의 신청서/공고문 답(모델 둘이 같은 답일 때만 실린다 · attach-role-read.mjs) */
  let paid = {};
  try { paid = JSON.parse(fs.readFileSync(path.join(root, 'collector', 'attach-role-paid.json'), 'utf8')); } catch { /* 아직 없음 */ }
  const { targets, missing, unread, roles } = pickFormTargets(items, rows, { today, isApplicationForm, decide: contentDecide(path.join(root, 'collector', 'extracted'), paid) });
  let index = { updatedAt: today, items: {} };
  try { const j = JSON.parse(fs.readFileSync(indexPath, 'utf8')); if (j && j.items && typeof j.items === 'object') index = { ...j, items: j.items }; } catch { /* 첫 실행 */ }
  /* 내용 판정이 이름과 다른 첨부 — 앱 신청서 칸이 먼저 본다(app-live attIsForm) · 마감 전 공고만(pickFormTargets 가 거른다) · 매 실행 새로 쓴다 */
  index.roles = roles;
  const live = new Set(items.filter((it) => it && it.id && !it.hidden && isOpen(it, today)).map((it) => it.id));
  const dropped = dry ? Object.keys(index.items).filter((id) => !live.has(id)) : prune(index, live, outDir);
  const done = []; const failed = []; const left = []; let skippedSame = 0;
  const t0 = Date.now();
  /* 🔴 파일 하나는 최대 SOFFICE_TIMEOUT_MS 까지 돈다 — 「예산을 넘었나」만 보면 4분 59초에 시작한 파일이 1분 더 돌아
     단계 시한(워크플로 timeout-minutes)에 강제로 끊긴다(2026-11-19 · 8분 13초에 끊겨 경보 #668 · 끊긴 설치의 잠금으로 다음 단계도 0초 실패 #669).
     그래서 **남은 예산이 파일 하나의 최대 시간보다 적으면 시작하지 않는다** — 남은 것은 다음 실행이 잇는다. */
  const overBudget = () => (Date.now() - t0) / 1000 + SOFFICE_TIMEOUT_MS / 1000 > budgetSec;
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
      const r = convertOne(path.join(root, 'collector', 'extracted', f.src), path.join(outDir, file), { soffice, name: f.name });
      if (r.ok) { next.push({ file, name: f.name, pages: r.pages, bytes: r.bytes, srcBytes: f.srcBytes || 0, from: '원본 그대로 변환', fonts: FONT_STAMP, at: today }); done.push({ id: t.id, name: f.name, pages: r.pages }); flush(); }
      else { failed.push({ id: t.id, name: f.name, why: r.why }); if (stale) next.push(stale); }
    });
    if (next.length) index.items[t.id] = next;
    else if (!dry) delete index.items[t.id];
    /* 그 공고 폴더에서 색인에 없는 파일(첨부가 빠지거나 순서가 바뀐 옛 결과)은 지운다 — 폴더째 지우는 prune 이 못 보는 고아.
       🔴 뒤 단계(form-fields.mjs)의 결과물은 고아가 아니다 — fields.json 과 살아 있는 PDF 의 「<이름>-pages」 폴더는 둔다.
          여기서 지우면 그 로봇이 **매일 26개 전부를 다시 그린다**(2026-11-09 실측 · 리포트 「그대로 0」) · 죽은 PDF 의 쪽 폴더는 그 로봇이 스스로 지운다. */
    if (!dry && fs.existsSync(path.join(outDir, t.id))) {
      const keep = new Set(next.flatMap((h) => [path.basename(h.file), `${path.basename(h.file).replace(/\.pdf$/i, '')}-pages`]).concat(['fields.json', 'fields-fix.json']));   // fields-fix.json = 사람이 지정한 칸 장부(tools/admin-apply fieldFix · 2026-11-18) — 지우면 관리자 칸이 밤마다 사라진다
      for (const fn of fs.readdirSync(path.join(outDir, t.id))) if (!keep.has(fn)) { try { fs.rmSync(path.join(outDir, t.id, fn), { recursive: true, force: true }); } catch { /* 무시 */ } }
      if (!next.length) { try { fs.rmSync(path.join(outDir, t.id), { recursive: true, force: true }); } catch { /* 무시 */ } }
    }
  }
  /* 🔴 내용 판정이 신청서 칸에서 뺀 첨부(roles 'notice')의 옛 PDF 는 지운다 — 공고의 신청서가 전부 빠지면 그 공고는 targets 에 없어 위 고리가 안 돌고,
     살아 있는 공고라 prune 도 안 지워 「원본 양식 그대로 보기」에 안내문이 마감까지 남는다(리뷰) */
  if (!dry) for (const [id, m] of Object.entries(roles)) {
    const have = index.items[id];
    if (!have) continue;
    const gone = have.filter((h) => m[h.name] === 'notice');
    if (!gone.length) continue;
    for (const h of gone) { try { fs.rmSync(path.join(outDir, h.file), { force: true }); fs.rmSync(path.join(outDir, h.file.replace(/\.pdf$/i, '-pages')), { recursive: true, force: true }); } catch { /* 무시 */ } }
    const keep = have.filter((h) => m[h.name] !== 'notice');
    if (keep.length) index.items[id] = keep;
    else { delete index.items[id]; try { fs.rmSync(path.join(outDir, id), { recursive: true, force: true }); } catch { /* 무시 */ } }
  }   // 뺀 것은 리포트 「원본 내용을 읽고 이름과 다르게 가른 첨부」 ➖ 줄이 알린다
  index.updatedAt = today;
  const report = buildReport({ today, targets, missing, done, failed, dropped, skippedSame, left, budgetSec, roles, unread });
  if (!dry) { flush(); fs.writeFileSync(reportPath, report + '\n'); }
  log(report);
  return { targets, missing, done, failed, dropped, left, index };
}

if (!process.env.FORM_PDF_AS_LIB) {
  const argv = process.argv.slice(2);
  const flag = (k) => { const a = argv.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a ? (a.includes('=') ? a.slice(a.indexOf('=') + 1) : true) : null; };
  const root = process.env.FORM_PDF_ROOT ? path.resolve(process.env.FORM_PDF_ROOT) : path.resolve(HERE, '..');
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const r = runFormPdf({ root, today: String(flag('today') || kst), dry: flag('dry') === true });
  /* 🔴 변환기가 HWP·HWPX·DOC 를 하나도 못 바꿨는데 못 읽은 것이 있으면 빨간불로 끝낸다(2026-10-24 리뷰) — 보강 단계라 경보 짝이 이슈를 연다.
     그전엔 '0건 + 초록불'이라 10-12 부터 변환이 한 번도 안 된 것을 아무도 몰랐다. dry 는 제외. */
  const officeFails = (r.failed || []).filter((f) => /변환기가 못 읽음\((hwpx?|docx?)\)/.test(f.why || '')).length;
  if (flag('dry') !== true && officeFails > 0 && !(r.done || []).length) {
    console.error(`::error::신청서 원본 → PDF — 변환기(LibreOffice+H2Orestart)가 HWP·HWPX·DOC 를 ${officeFails}개 못 읽고 한 개도 못 바꿨습니다. 리포트의 '변환기 말' 줄을 보세요.`);
    process.exit(3);
  }
}
