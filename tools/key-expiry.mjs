/* ============================================================
   열쇠 만료 확인 — 열쇠 목록(docs/backend/keys.json)에서 14일 안에 만료되거나 이미 지난 열쇠를 찾는다
   (2026-11-11 · 은서 · 출시 전 백엔드 9번 — GitHub 관리자 열쇠가 아무도 모르게 11/7 에 만료됐다)
   ------------------------------------------------------------
   🔴 열쇠 **값**은 다루지 않는다 — 이름·두는 곳·만료일만. 목록에 값처럼 생긴 글자가 있으면 실패한다(looksLikeSecret).
   하는 일:
     node tools/key-expiry.mjs                 목록 표 + 다가오는 만료를 출력
     node tools/key-expiry.mjs --check --body <파일>   다가오는 만료가 있으면 경보 본문을 파일에 쓰고 GITHUB_OUTPUT 에 due=<개수>
     node tools/key-expiry.mjs --render        docs/backend/열쇠-목록.md 의 표를 keys.json 으로 다시 쓴다(사람이 읽는 사본 — 관문이 둘이 같은지 본다)
   만료일 칸: YYYY-MM-DD · '없음' · '확인 필요'(아직 모른다 — 경보는 안 하고 표에 적는다) · '자동 확인'(따로 재는 로봇이 있다 — 인스타 토큰)
   워크플로: .github/workflows/key-expiry.yml(매일) · 관문: verify/health-gates/ops.mjs 「⑥ 열쇠 목록 · 만료 알림」
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const WARN_DAYS = 14;
const ROOT = new URL('../', import.meta.url);
export const KEYS_PATH = 'docs/backend/keys.json';
export const DOC_PATH = 'docs/backend/열쇠-목록.md';
export const START = '<!-- KEYS:START — tools/key-expiry.mjs --render 가 쓴다. 손으로 고치지 말고 keys.json 을 고친다 -->';
export const END = '<!-- KEYS:END -->';

const DAY = 86400000;
const iso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

/** 값처럼 생긴 글자인가 — 열쇠 접두어 · JWT · 공백 없는 긴 영숫자 덩어리 */
export function looksLikeSecret(s) {
  const t = String(s || '');
  return /sk-ant-|ghp_|gho_|github_pat_|sb_secret_|sb_publishable_|xox[baprs]-|re_[A-Za-z0-9]{8}_|eyJ[A-Za-z0-9_-]{10,}\./.test(t)
    || /(?<![A-Za-z0-9_./-])[A-Za-z0-9_+/=-]{32,}(?![A-Za-z0-9_./-])/.test(t);
}

/** 한 열쇠의 상태 — { state: expired|soon|ok|none|unknown|auto, days? } */
export function keyState(k, today = kstToday()) {
  const e = String((k && k.expires) || '').trim();
  if (e === '없음') return { state: 'none' };
  if (e === '자동 확인') return { state: 'auto' };
  if (!iso(e)) return { state: 'unknown' };
  const days = Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days < 0) return { state: 'expired', days };
  if (days <= WARN_DAYS) return { state: 'soon', days };
  return { state: 'ok', days };
}

/** 목록 읽기 — 꼴이 틀리거나 값처럼 생긴 글자가 있으면 던진다(못 읽음을 '문제없음'으로 두지 않는다) */
export function loadKeys(text) {
  const j = JSON.parse(text);
  if (!j || !Array.isArray(j.keys)) throw new Error('keys.json 에 keys 목록이 없습니다');
  const names = new Set();
  for (const k of j.keys) {
    if (!k || !k.name || !k.where || !('expires' in k)) throw new Error(`꼴이 틀린 줄: ${JSON.stringify(k).slice(0, 80)}`);
    if (names.has(k.name)) throw new Error(`같은 이름이 두 번: ${k.name}`);
    names.add(k.name);
    for (const v of Object.values(k)) if (looksLikeSecret(v)) throw new Error(`🔴 값처럼 생긴 글자가 있습니다(${k.name}) — 열쇠 값은 목록에 적지 않습니다`);
    const e = String(k.expires);
    if (!(iso(e) || ['없음', '확인 필요', '자동 확인'].includes(e))) throw new Error(`만료일 꼴이 틀렸습니다(${k.name}: ${e})`);
  }
  return j.keys;
}

export function dueKeys(keys, today = kstToday()) {
  return keys.map((k) => ({ ...k, ...keyState(k, today) })).filter((k) => k.state === 'expired' || k.state === 'soon')
    .sort((a, b) => a.days - b.days);
}

const STATE_WORD = (s) => ({
  expired: (d) => `🔴 만료됨(${-d}일 지남)`, soon: (d) => `🟠 ${d}일 남음`, ok: (d) => `${d}일 남음`,
  none: () => '만료 없음', unknown: () => '❓ 확인 필요', auto: () => '자동 확인(로봇)',
}[s.state](s.days));
const cell = (v) => String(v || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderTable(keys, today = kstToday()) {
  const rows = keys.map((k) => `| ${cell(k.name)} | ${cell(k.where)} | ${cell(k.for)} | ${cell(k.owner)} | ${cell(k.expires)} | ${cell(k.renew)} |`);
  return ['| 열쇠 | 두는 곳 | 쓰는 곳 | 담당 | 만료일 | 바꾸는 법 |', '| --- | --- | --- | --- | --- | --- |', ...rows].join('\n');
}
export function renderDoc(doc, keys) {
  const i = doc.indexOf(START); const j = doc.indexOf(END);
  if (i < 0 || j < i) throw new Error(`${DOC_PATH} 에 표 자리 표식(KEYS:START·END)이 없습니다`);
  return `${doc.slice(0, i + START.length)}\n${renderTable(keys)}\n${doc.slice(j)}`;
}
export function alertBody(due, today = kstToday()) {
  return [
    `🔑 **${today} 기준 — 만료됐거나 ${WARN_DAYS}일 안에 만료되는 열쇠가 ${due.length}개 있습니다.**`, '',
    '| 열쇠 | 상태 | 두는 곳 | 담당 | 바꾸는 법 |', '| --- | --- | --- | --- | --- |',
    ...due.map((k) => `| ${cell(k.name)} | ${STATE_WORD(k)} | ${cell(k.where)} | ${cell(k.owner)} | ${cell(k.renew)} |`), '',
    '새 열쇠를 넣었으면 `docs/backend/keys.json` 의 만료일(expires)을 새 날짜로 고쳐 주세요(Claude 세션에 "열쇠 만료일 고쳐줘"라고 해도 됩니다). 고치면 다음 날 이 경보가 스스로 닫힙니다.',
    '🔴 열쇠 값은 채팅·이슈·저장소에 붙여넣지 말고 GitHub Secrets·관리자 화면·Cloudflare 에만 넣습니다.',
  ].join('\n');
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const keys = loadKeys(fs.readFileSync(new URL(KEYS_PATH, ROOT), 'utf8'));
  const today = env.KEY_TODAY || kstToday();
  if (argv.includes('--render')) {
    const p = new URL(DOC_PATH, ROOT);
    fs.writeFileSync(p, renderDoc(fs.readFileSync(p, 'utf8'), keys));
    console.log(`${DOC_PATH} 표를 다시 썼습니다 (${keys.length}개)`);
    return 0;
  }
  const due = dueKeys(keys, today);
  const unknown = keys.filter((k) => keyState(k, today).state === 'unknown').map((k) => k.name);
  console.log(`열쇠 ${keys.length}개 · 만료됐거나 ${WARN_DAYS}일 안 ${due.length}개 · 만료일 확인 필요 ${unknown.length}개`);
  for (const k of due) console.log(`  ${STATE_WORD(k)} — ${k.name} (${k.where})`);
  if (unknown.length) console.log(`  ❓ 확인 필요: ${unknown.join(' · ')}`);
  if (argv.includes('--check')) {
    const i = argv.indexOf('--body');
    if (i >= 0 && argv[i + 1]) fs.writeFileSync(argv[i + 1], `${alertBody(due, today)}\n`);
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `due=${due.length}\n`);
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${due.length ? alertBody(due, today) : `🔑 ${today} — 만료가 다가오는 열쇠 없음`}\n\n${unknown.length ? `❓ 만료일 확인 필요: ${unknown.join(' · ')}\n` : ''}`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main()); } catch (e) { console.error(`::error::열쇠 목록을 읽지 못했습니다 — ${e.message}`); process.exit(1); }
}
