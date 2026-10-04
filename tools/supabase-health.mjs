/* ============================================================
   로그인 서버(Supabase) 매일 확인 — 응답하는가만 본다 (2026-10-04 로봇·도구 점검 · 묶음 servers)
   ------------------------------------------------------------
   왜 만들었나
     로그인·기기 간 이어쓰기는 켜져 있는데(supabase-config.js 에 주소·공개 열쇠가 채워져 있다),
     Supabase 가 살아 있는지 보는 로봇이 하나도 없었다. 푸시 서버(push-health)·관리자 잠금(admin-lock-check)은
     매일 보는데 로그인 서버가 멈추면 학생이 로그인·이어쓰기를 못 해도 아무도 모른다.

   하는 일
     supabase-config.js 를 읽어(주소를 여기 박지 않는다) `GET {url}/auth/v1/health` 에 공개 열쇠(apikey)를 실어 묻는다.
     한 번에 20초 시한 · 일시 장애로 경보가 울리지 않게 최대 3번 묻는다(사이 10초·30초 쉼).
       200       → ok
       401·403   → misconfig (열쇠를 거절했다 — 열쇠가 바뀌었거나 프로젝트 쪽 설정 문제일 수 있다)
       그 밖·연결 실패 → down (원인은 이 확인으로 알 수 없다 — 대시보드에서 프로젝트 상태부터 본다)
       설정이 비었음 → off (로그인이 꺼져 있다 — 조용히 끝낸다)
       🔴 설정 파일을 **못 읽음**(문법 오류·병합 충돌 표식·맨 위의 window 참조·SUPABASE_CONFIG 이름이 없음) → 'off' 가 아니다.
          종료 코드 1 로 끝내 워크플로의 확인 단계가 실패하고 robot-down 이 사람을 부른다.
          (2026-10-04 리뷰 — 예전엔 못 읽어도 null 을 돌려 'off' 로 판정했고, 워크플로는 그것을 정상·꺼짐으로 보아
           열린 경보 이슈를 resolve 로 닫았다: 감시가 조용히 무력해지는 길 · CLAUDE.md 매 세션 3)
   🔴 공개 열쇠(anonKey · 브라우저에 그대로 나가는 값)만 쓴다. service_role 열쇠는 쓰지 않는다(시크릿 불필요).
   ⚠️ 이 확인은 **감시(알림)**다. 이 요청이 Supabase 의 휴면(무활동 일시정지)을 막아 주는지는 확인하지 않았다 —
      그렇게 적지 말 것(CLAUDE.md 매 세션 5).

   실행: node tools/supabase-health.mjs  → 표준 출력에 판정 · GITHUB_OUTPUT 이 있으면 verdict·why 를 적는다.
         판정을 냈으면 종료 코드 0 — 실패 처리(경보·빨간불)는 워크플로(.github/workflows/supabase-health.yml)가 한다.
         설정 파일을 못 읽었으면 판정을 적지 않고 종료 코드 1(→ robot-down).
         SUPABASE_CONFIG_FILE 로 읽을 파일을 바꿀 수 있다(관문이 표본 파일로 명령줄 전체를 잰다 · 기본은 저장소의 supabase-config.js).
   관문: verify/health-gates/servers.mjs ⑨ (표본만)
   ============================================================ */
import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

/** supabase-config.js 글자 → { url, anonKey } · 주소나 열쇠가 비었으면 null(= 꺼짐)
    🔴 글자를 못 읽으면 **던진다** — '비어 있음(꺼짐)'과 '못 읽음(감시가 고장)'을 가른다(머리말). */
export function readSupabaseConfig(src) {
  const box = { module: { exports: {} } };
  try {
    vm.runInNewContext(`${String(src || '')}\n;globalThis.__cfg = (typeof SUPABASE_CONFIG !== 'undefined') ? SUPABASE_CONFIG : undefined;`, box, { timeout: 1000 });
  } catch (e) {
    throw new Error(`로그인 설정 파일(supabase-config.js)을 읽지 못했습니다 — ${(e && e.message) || e}`);
  }
  const c = box.__cfg;
  if (!c || typeof c !== 'object') throw new Error('로그인 설정 파일(supabase-config.js)에서 SUPABASE_CONFIG 를 찾지 못했습니다');
  const url = typeof c.url === 'string' ? c.url.trim().replace(/\/+$/, '') : '';
  const anonKey = typeof c.anonKey === 'string' ? c.anonKey.trim() : '';
  return url && anonKey ? { url, anonKey } : null;
}

/** 순수 판정 — { ok: 요청이 응답을 받았나, code: HTTP 코드 } → { verdict, why } */
export function verdict({ ok, code } = {}) {
  const c = Number(code);
  if (ok && c === 200) return { verdict: 'ok', why: '' };
  if (ok && (c === 401 || c === 403)) {
    return { verdict: 'misconfig', why: `로그인 서버가 공개 열쇠를 거절했습니다 (HTTP ${c}) — supabase-config.js 의 열쇠가 바뀌었거나 프로젝트 설정에 문제가 있을 수 있습니다` };
  }
  if (!ok) return { verdict: 'down', why: '로그인 서버에 연결하지 못했습니다 (응답 없음)' };
  return { verdict: 'down', why: `로그인 서버가 정상 응답하지 않습니다 (HTTP ${code})` };
}

/** 한 번 묻기 — 연결 실패는 { ok:false } 로 돌려준다(던지지 않는다) */
export async function probeOnce(cfg, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  try {
    const r = await fetchImpl(`${cfg.url}/auth/v1/health`, {
      headers: { apikey: cfg.anonKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: true, code: r.status };
  } catch (e) {
    return { ok: false, code: 0, error: String((e && e.message) || e) };
  }
}

/** 최대 tries 번 — ok 가 나오면 멈춘다 */
export async function probe(cfg, { fetchImpl = fetch, tries = 3, waits = [10000, 30000], sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  let last = null;
  for (let i = 0; i < tries; i += 1) {
    const r = await probeOnce(cfg, { fetchImpl });
    const v = verdict(r);
    log(`  ${i + 1}번째: ${r.ok ? `HTTP ${r.code}` : `연결 실패 (${r.error || '?'})`} → ${v.verdict}`);
    last = v;
    if (v.verdict === 'ok') return v;
    if (i < tries - 1) await sleep(waits[Math.min(i, waits.length - 1)] || 0);
  }
  return last;
}

/** 명령줄 본체 — 설정 글자 → { verdict, why, exit }
    못 읽으면 { verdict: null, exit: 1 } (판정을 적지 않는다 — 'off' 로 두면 워크플로가 경보를 닫는다) */
export async function run(src, { probeImpl = probe, log = () => {} } = {}) {
  let cfg;
  try { cfg = readSupabaseConfig(src); } catch (e) { return { verdict: null, why: e.message, exit: 1 }; }
  if (!cfg) {
    log('로그인 설정(supabase-config.js)이 비어 있습니다 — 로그인이 꺼져 있어 확인하지 않습니다');
    return { verdict: 'off', why: '', exit: 0 };
  }
  log(`로그인 서버 확인: ${new URL(cfg.url).host}/auth/v1/health`);
  const v = await probeImpl(cfg, { log });
  return { verdict: v.verdict, why: v.why || '', exit: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.env.SUPABASE_CONFIG_FILE || new URL('../supabase-config.js', import.meta.url);
  let src = null;
  try { src = fs.readFileSync(file, 'utf8'); } catch (e) { src = null; }
  const v = src == null
    ? { verdict: null, why: `로그인 설정 파일을 열지 못했습니다 (${file})`, exit: 1 }
    : await run(src, { log: (s) => console.log(s) });
  if (v.exit) {
    console.error(`✕ ${v.why} — 판정하지 않고 실패로 끝냅니다(확인 도구가 고장이면 '꺼짐'으로 보지 않는다)`);
    process.exit(v.exit);
  }
  console.log(`판정: ${v.verdict}${v.why ? ` — ${v.why}` : ''}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${v.verdict}\nwhy=${v.why.replace(/\r?\n/g, ' ')}\n`);
}
