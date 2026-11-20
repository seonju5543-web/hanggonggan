/* LibreOffice(soffice)로 한 파일을 PDF 로 — 신청서 원본 PDF 로봇(form-pdf.mjs)과 쪽 그림 로봇(form-pages.mjs)이 같이 쓴다 (2026-11-20 · 두 벌을 하나로)
   🔴 불러오는 순간 아무것도 하지 않는다(순수 모듈) — 두 로봇은 불러오면 돌 수 있지만 이 파일은 아니다.

   🔴 **전용 프로필 폴더**로 띄운다(2026-10-27) — 러너에서 확장을 root(sudo unopkg)로 깔면 /home/runner/.config/libreoffice 가 root 소유가 되어
      runner 의 soffice 가 '권한 없음'(종료 77)으로 시작조차 못 했다(10-12 부터 HWP 변환 0건 · 변환기 말을 리포트에 남겨 알았다).
      임시 폴더의 프로필은 실행마다 새로 만들어지고(파일마다가 아니라 실행마다 하나 · 첫 기동 2~4초), 공유 확장(--shared)은 어느 프로필에서나 보인다.
   🔴 **변환기가 한 말을 그대로 남긴다**(2026-10-24) — 10-16 부터 HWP 23건이 전부 '못 읽음'인데 이유를 아무도 못 봤다(원인 단정 금지 · CLAUDE.md 매 세션 5).
      예전엔 쪽 그림 로봇 쪽 사본에 이 줄이 없어 같은 실패가 그쪽에선 이유 없이 남았다 — 한 벌로 합쳐 둘 다 남긴다. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* 파일 하나의 최대 변환 시간 — 신청서 PDF 로봇의 예산 셈(form-pdf.mjs overBudget)·워크플로 단계 시한 관문이 이 숫자를 쓴다 */
export const SOFFICE_TIMEOUT_MS = 60000;

let LO_PROFILE = null;
export function loProfileArg() {
  if (!LO_PROFILE) { LO_PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-profile-')); }
  return `-env:UserInstallation=${pathToFileURL(LO_PROFILE).href}`;
}

/* 한 파일을 to 꼴로 — 띄우는 법·시한·실패 문구는 여기 한 곳(PDF 도 중간 꼴도 같은 말을 남긴다) */
function sofficeConvert(src, work, to, { soffice = 'soffice' } = {}) {
  const ext = (src.match(/\.(\w+)$/) || [, '?'])[1].toLowerCase();
  const r = spawnSync(soffice, ['--headless', '--norestore', loProfileArg(), '--convert-to', to, '--outdir', work, src], { encoding: 'utf8', timeout: SOFFICE_TIMEOUT_MS });
  if (r.error) return { ok: false, why: r.error.code === 'ETIMEDOUT' ? `변환 시간 초과(${SOFFICE_TIMEOUT_MS / 1000}초)` : `변환기 없음(${soffice})` };
  const made = path.join(work, `${path.basename(src).replace(/\.[^.]+$/, '')}.${to}`);
  if (!fs.existsSync(made)) {
    /* stdout·stderr 의 마지막 160자를 한 줄로(리포트 한 줄에 들어가게) · 종료 코드도 적는다 */
    const said = String((r.stdout || '') + ' ' + (r.stderr || '')).replace(/\s+/g, ' ').trim().slice(-160);
    return { ok: false, why: `변환기가 못 읽음(${ext})${/could not be loaded/.test(r.stdout + r.stderr) ? ' — 가져오기 확장(H2Orestart) 필요' : ''} · 종료 ${r.status}${said ? ` · 변환기 말: ${said}` : ' · 변환기 말 없음'}` };
  }
  return { ok: true, made };
}

/** src 를 work 폴더에 <이름>.pdf 로 — { ok: true, made } | { ok: false, why }. work 폴더 정리는 부른 쪽이 한다 */
export function sofficeToPdf(src, work, { soffice = 'soffice' } = {}) {
  return sofficeConvert(src, work, 'pdf', { soffice });
}

/* ── 높이가 고정된 글상자를 풀어 다시 바꾸기 (2026-11-20 · 공고문 PDF 로봇 첫 실행 — 「글자 빠짐」의 원인) ─────────────────────
   실측(진단 doc-pdf-probe · 중간 꼴을 열어 봄): 귀농인 자녀 학자금 시행지침(hwpx)의 PDF 9쪽에서 평가표 마지막 두 줄(「기타여건 15점」 · 원본 글자의 1.9%)이 사라졌다.
   가져오기 확장(H2Orestart)은 글자처럼 놓인 표·글상자를 **높이가 고정된 틀**(`<draw:frame … svg:height="7.589in"><draw:text-box>`)에 넣는데,
   우리 글꼴로 그리면 표가 그 높이보다 길어져 넘친 줄이 틀 밖으로 잘린다. 글자는 중간 꼴(fodt)까지 100% 있고 PDF 로 그릴 때만 빠졌다(통영시 저소득 공고 3곳 96%도 같은 꼴 —
   글자가 빠진 파일은 전부 이런 틀이 6~8개였다). 처음 세운 가설(표 줄 높이 고정 `style:row-height`)은 진단에서 0곳으로 나와 버렸다 — 줄은 이미 '적어도 이만큼'이었다.
   그래서 한 번 더 간다: 원본 → 한 장짜리 열린 문서(fodt · XML 한 파일이라 압축을 풀 일이 없다) → 틀의 '딱 이만큼'(frame 의 svg:height)을
   '적어도 이만큼'(text-box 의 fo:min-height — LibreOffice 가 자라는 틀을 저장하는 꼴 그대로)으로 → PDF. 글이 틀에 들어가는 문서는 모양이 안 바뀐다.
   🔴 평소 길을 바꾸지 않는다 — 부르는 쪽(doc-pdf)이 **글자가 빠졌을 때만** 이 길로 다시 가서 더 많이 남은 쪽을 쓴다(신청서·쪽 그림 로봇은 안 부른다).
   돌려주는 것: { ok: true, made, boxes } | { ok: false, why } — boxes 는 높이를 푼 틀의 수(0 이면 풀 것이 없어 다시 바꾸지 않는다) */
const FIXED_BOX = /<draw:frame\b([^>]*?)\s+svg:height="([^"]+)"([^>]*)>(\s*)<draw:text-box\b(?![^>]*\bfo:min-height=)([^>]*)>/g;
/* 둘째 원인 — 글자처럼 놓인 글상자를 품은 **문단의 줄 간격이 100% 아래**(통영시 저소득 공고의 「제출서류」 표: 문단 줄 간격 34%).
   한글은 줄에 놓인 표의 높이만큼 줄을 잡지만 LibreOffice 는 그 줄을 줄 간격 비율만큼 줄여, 틀을 풀어도 표의 위아래(머리 줄 · ⑤~⑦ 줄)가 줄 밖으로 잘렸다.
   진단한 틀 40여 개 가운데 글이 든 채 100% 아래인 문단은 그 하나(와 85% 하나)뿐이었고, 100% 이상인 문단의 틀은 풀자 다 살아났다(귀농인 217%).
   그런 문단에만 줄 간격 100% 인 **사본 모양**을 붙인다 — 같은 모양을 쓰는 글 문단은 건드리지 않는다 */
const AS_CHAR_BOX = /<draw:frame\b[^>]*\btext:anchor-type="as-char"[^>]*>\s*<draw:text-box\b/g;
export const MAX_FLAT_BYTES = 64 * 1024 * 1024;   // 중간 꼴(fodt) 크기 상한 — sofficeToPdfRelaxed
const LOOSE_LINE = '_hdj100';
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function loosenLineSpacing(xml) {
  const paras = new Map();   // 문단 여는 태그의 자리 → { open, name }
  for (const m of xml.matchAll(AS_CHAR_BOX)) {
    let p = m.index;
    do { p = xml.lastIndexOf('<text:p', p - 1); } while (p >= 0 && !/^<text:p[\s>]/.test(xml.slice(p, p + 8)));   // <text:page-number 같은 이웃 이름은 문단이 아니다
    if (p < 0) continue;
    const open = xml.slice(p, xml.indexOf('>', p) + 1);
    if (xml.slice(p + open.length, m.index).includes('</text:p>')) continue;   // 그 문단은 틀 앞에서 닫혔다 — 이 틀을 품은 문단이 아니다
    const name = (open.match(/\btext:style-name="([^"]+)"/) || [])[1];
    if (name && !name.endsWith(LOOSE_LINE)) paras.set(p, { open, name });
  }
  const clones = new Map();   // 모양 이름 → { block, clone } (줄 간격이 100% 아래인 것만)
  for (const { name } of paras.values()) {
    if (clones.has(name)) continue;
    const block = (xml.match(new RegExp(`<style:style\\b[^>]*\\bstyle:name="${escRe(name)}"[^>]*[^/]>[\\s\\S]*?</style:style>`)) || [])[0];
    const pct = block && (block.match(/\bfo:line-height="(\d+(?:\.\d+)?)%"/) || [])[1];
    clones.set(name, block && pct && Number(pct) < 100
      ? { block, clone: block.replace(`style:name="${name}"`, `style:name="${name}${LOOSE_LINE}"`).replace(/\bfo:line-height="[^"]+"/, 'fo:line-height="100%"') }
      : null);
  }
  let out = xml;
  let lines = 0;
  for (const p of [...paras.keys()].sort((a, b) => b - a)) {   // 뒤에서부터 — 앞 자리가 안 밀린다
    const { open, name } = paras.get(p);
    if (!clones.get(name)) continue;
    out = out.slice(0, p) + open.replace(`text:style-name="${name}"`, `text:style-name="${name}${LOOSE_LINE}"`) + out.slice(p + open.length);
    lines += 1;
  }
  for (const c of clones.values()) if (c) out = out.replace(c.block, () => c.block + c.clone);   // 모양 사본은 원래 모양 바로 뒤에(함수로 — `$` 가 든 글자를 바꿈표로 읽지 않게)
  return { xml: out, lines };
}
/** 중간 꼴(fodt)에서 글자가 잘리는 두 자리를 푼다 — { xml, boxes }: 높이가 고정된 글상자 틀은 자라는 틀로 · 그런 틀을 품은 문단의 줄 간격이 100% 아래면 100% 로.
    boxes 는 푼 곳의 수(틀 + 문단). 그림 틀·이미 자라는 틀·다른 글자는 그대로 */
export function relaxFrameHeights(fodt) {
  let boxes = 0;
  const grown = String(fodt || '').replace(FIXED_BOX, (m, a, h, b, ws, c) => { boxes += 1; return `<draw:frame${a}${b}>${ws}<draw:text-box fo:min-height="${h}"${c}>`; });
  const { xml, lines } = loosenLineSpacing(grown);
  return { xml, boxes: boxes + lines };
}
export function sofficeToPdfRelaxed(src, work, { soffice = 'soffice', maxBytes = MAX_FLAT_BYTES } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const flat = sofficeConvert(src, work, 'fodt', { soffice });
  if (!flat.ok) return flat;
  /* 중간 꼴은 그림을 글자(base64)로 품어 원본보다 크다 — 통째로 읽어 고치므로 너무 크면 가지 않는다(메모리가 모자라 죽으면 잡을 수 없고 실패 장부에도 안 남아 매 실행 같은 파일에서 죽는다 · 리뷰 11-20) */
  const size = fs.statSync(flat.made).size;
  if (size > maxBytes) return { ok: false, why: `중간 꼴이 너무 큼(${Math.round(size / 1024 / 1024)}MB)` };
  const { xml, boxes } = relaxFrameHeights(fs.readFileSync(flat.made, 'utf8'));
  if (!boxes) return { ok: false, why: '높이가 고정된 글상자 없음' };
  const dir = path.join(work, 'relaxed');
  fs.mkdirSync(dir, { recursive: true });
  const loose = path.join(dir, path.basename(flat.made));
  fs.writeFileSync(loose, xml);
  const pdf = sofficeConvert(loose, dir, 'pdf', { soffice });
  return pdf.ok ? { ok: true, made: pdf.made, boxes } : pdf;
}
