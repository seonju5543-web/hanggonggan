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

/* ── 표 줄 높이를 풀어 다시 바꾸기 (2026-11-20 · 공고문 PDF 로봇 첫 실행 — 「글자 빠짐」 4개의 원인) ─────────────────────
   실측: 귀농인 자녀 학자금 시행지침(hwpx)의 PDF 9쪽에서 평가표 마지막 줄(「기타여건 15점」 · 원본 글자의 1.9%)이 높이 0 에 가깝게 접혀 글자가 표 밖으로 잘렸다.
   한글은 칸 높이를 '적어도 이만큼'으로 쓰고 글이 넘치면 칸이 자라는데, 가져오기 확장이 그 높이를 '딱 이만큼'으로 옮기면 넘친 글이 잘린다.
   그래서 한 번 더 간다: 원본 → 한 장짜리 열린 문서(fodt · XML 한 파일이라 압축을 풀 일이 없다) → 표 줄의 '딱 이만큼'(style:row-height)을
   '적어도 이만큼'(style:min-row-height)으로 → PDF. 글이 칸에 들어가는 줄은 높이가 그대로라 쪽 모양이 안 바뀐다.
   🔴 평소 길을 바꾸지 않는다 — 부르는 쪽(doc-pdf)이 **글자가 빠졌을 때만** 이 길로 다시 가서 더 많이 남은 쪽을 쓴다(신청서·쪽 그림 로봇은 안 부른다).
   돌려주는 것: { ok: true, made, rows } | { ok: false, why } — rows 는 높이를 푼 표 줄 모양의 수(0 이면 풀 것이 없어 다시 바꾸지 않는다) */
export const FIXED_ROW = /\bstyle:row-height="/g;
export const relaxRowHeights = (fodt) => String(fodt || '').replace(FIXED_ROW, 'style:min-row-height="');
export function sofficeToPdfRelaxed(src, work, { soffice = 'soffice' } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const flat = sofficeConvert(src, work, 'fodt', { soffice });
  if (!flat.ok) return flat;
  const xml = fs.readFileSync(flat.made, 'utf8');
  const rows = (xml.match(FIXED_ROW) || []).length;
  if (!rows) return { ok: false, why: '높이가 고정된 표 줄 없음' };
  const dir = path.join(work, 'relaxed');
  fs.mkdirSync(dir, { recursive: true });
  const loose = path.join(dir, path.basename(flat.made));
  fs.writeFileSync(loose, relaxRowHeights(xml));
  const pdf = sofficeConvert(loose, dir, 'pdf', { soffice });
  return pdf.ok ? { ok: true, made: pdf.made, rows } : pdf;
}
