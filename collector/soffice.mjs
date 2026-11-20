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

/** src 를 work 폴더에 <이름>.pdf 로 — { ok: true, made } | { ok: false, why }. work 폴더 정리는 부른 쪽이 한다 */
export function sofficeToPdf(src, work, { soffice = 'soffice' } = {}) {
  const ext = (src.match(/\.(\w+)$/) || [, '?'])[1].toLowerCase();
  const r = spawnSync(soffice, ['--headless', '--norestore', loProfileArg(), '--convert-to', 'pdf', '--outdir', work, src], { encoding: 'utf8', timeout: SOFFICE_TIMEOUT_MS });
  if (r.error) return { ok: false, why: r.error.code === 'ETIMEDOUT' ? `변환 시간 초과(${SOFFICE_TIMEOUT_MS / 1000}초)` : `변환기 없음(${soffice})` };
  const made = path.join(work, `${path.basename(src).replace(/\.[^.]+$/, '')}.pdf`);
  if (!fs.existsSync(made)) {
    /* stdout·stderr 의 마지막 160자를 한 줄로(리포트 한 줄에 들어가게) · 종료 코드도 적는다 */
    const said = String((r.stdout || '') + ' ' + (r.stderr || '')).replace(/\s+/g, ' ').trim().slice(-160);
    return { ok: false, why: `변환기가 못 읽음(${ext})${/could not be loaded/.test(r.stdout + r.stderr) ? ' — 가져오기 확장(H2Orestart) 필요' : ''} · 종료 ${r.status}${said ? ` · 변환기 말: ${said}` : ' · 변환기 말 없음'}` };
  }
  return { ok: true, made };
}
