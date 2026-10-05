/* ============================================================
   푸시 발송 서버 매일 확인 — 판정 한 곳 (2026-10-04 로봇·도구 점검 · 묶음 servers)
   ------------------------------------------------------------
   `.github/workflows/push-health.yml` 이 `/health` 를 읽은 뒤 이 파일로 판정한다.
   🔴 발송하지 않는다 — `/health` 응답만 본다(시험 발송은 사람이 push-check 를 누를 때만).

   왜 옮겼나
     예전 판정(워크플로 안 셸)은 ok·configured·subs·lastError 만 봤다. 그 칸들로는 **예약 회차가 돌았는지**를
     알 수 없어서, 예약이 멈추거나 KV 쓰기가 실패해도(state:slot 만 쓰고 결과는 버렸다) 매일 초록이었다.
     서버가 `lastSlot`(마지막으로 시작한 회차)·`lastRun`(마지막으로 끝까지 돈 회차)을 내게 고쳤고,
     그 칸을 읽는 규칙을 순수 함수로 두어 관문(verify/health-gates/servers.mjs ④)이 표본으로 잰다.

   판정 순서 (앞의 것이 이긴다)
     down      응답이 없음(curl 실패 · HTTP ≠ 200)
     misconfig 열쇠(VAPID)가 서버에 없음(configured ≠ true)
     error     포기 기록(lastError)이 남아 있음 · 등록 저장소를 못 읽음(subs = -1)
     outdated  `lastSlot` 칸이 아예 없음 — 새 서버 코드가 아직 배포되지 않았다
     stale     마지막으로 시작한 회차가 26시간보다 오래됨 — 두 회차(08:10·20:10) 연속 시작하지 않았다
               (06:17 확인의 정상 간격은 약 10시간 · 한 회차만 빠지면 약 22시간)
     error     깨우기를 보낸 마지막 회차(lastSentRun · 옛 서버면 lastRun)가 **살아 있는 구독에** 깨우기를 보냈는데(sent − dropped > 0)
               푸시 서비스가 한 대도 받지 않았다(woke = 0)
               — lastRun 만 보면 06:17 확인 때는 대개 전날 20:10 회차라, 그 회차가 '알릴 거리 없음'이면 08:10 회차의 기록이 덮여
                 그날 놓쳤다(2026-10-05 리뷰). 그래서 서버가 발송 회차를 따로 남긴다(state:lastSentRun)
               — woke 는 '푸시 서비스가 받아 준 수'이지 폰에 닿은 수가 아니다. 원인은 단정하지 않는다
               — 없어진 구독(404·410 → dropped)만 있던 회차는 경보가 아니다: 서버는 그런 구독을 sent 로 센 뒤 지우는데,
                 이것은 폰을 바꾸거나 앱을 지운 뒤의 평범한 정리다(2026-10-04 리뷰 — {sent:1, dropped:1, woke:0} 이 다음 날 'VAPID 의심' 경보가 됐다)
     ok        그 밖
   경고(판정은 ok 그대로 · 로그에만): 등록 0대 · lastSlot 이 null(새 저장소 — 아직 한 회차도 시작 전)

   실행: HEALTH_RC=<curl 종료 코드> HEALTH_CODE=<HTTP 코드> HEALTH_BODY=<응답 글> node tools/push-health-verdict.mjs
         → 표준 출력에 판정 · GITHUB_OUTPUT 이 있으면 verdict·why 를 적는다. 종료 코드는 늘 0(실패 처리는 워크플로가 한다).
   ============================================================ */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const STALE_HOURS = 26;

/** 'YYYY-MM-DD#HH:MM'(KST) → 밀리초 · 못 읽으면 NaN */
export function slotTime(slot) {
  const m = /^(\d{4}-\d{2}-\d{2})#(\d{2}):(\d{2})$/.exec(String(slot || ''));
  return m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:00+09:00`) : NaN;
}

/** 순수 판정 — { curlOk, code, json, now } → { verdict, why, warnings[] } */
export function verdict({ curlOk, code, json, now = Date.now() } = {}) {
  const warnings = [];
  const out = (v, why) => ({ verdict: v, why, warnings });
  if (!curlOk || Number(code) !== 200) return out('down', `서버가 응답하지 않습니다 (HTTP ${code || '없음'})`);
  const j = json && typeof json === 'object' ? json : null;
  if (!j) return out('down', '서버 응답을 읽지 못했습니다 (JSON 아님)');
  if (j.configured !== true) return out('misconfig', 'VAPID 키가 서버에 없습니다 (configured=false) — 푸시가 실제로는 안 나갑니다');
  if (j.lastError) return out('error', `서버에 마지막 오류 기록이 남아 있습니다: ${JSON.stringify(j.lastError)}`);
  if (String(j.subs) === '-1') return out('error', '등록 저장소(KV)를 읽지 못했습니다 (subs=-1)');
  if (String(j.subs) === '0') warnings.push('등록된 폰이 0대입니다 (오류는 아니지만 알림이 갈 곳이 없습니다)');
  if (!Object.prototype.hasOwnProperty.call(j, 'lastSlot')) {
    return out('outdated', '서버 응답에 lastSlot 칸이 없습니다 — 새 서버 코드(server/push/worker.js)가 아직 배포되지 않은 것으로 보입니다. Cloudflare → Workers → handaejang-push 의 배포 기록을 확인하세요');
  }
  if (j.lastSlot == null) {
    warnings.push('lastSlot 이 비어 있습니다 — 새 저장소라 아직 한 회차도 시작하지 않았을 수 있습니다');
  } else {
    const t = slotTime(j.lastSlot);
    if (isNaN(t)) return out('error', `lastSlot 을 읽지 못했습니다: ${JSON.stringify(j.lastSlot)}`);
    const hours = (now - t) / 36e5;
    if (hours > STALE_HOURS) {
      return out('stale', `마지막으로 시작한 예약 회차가 ${j.lastSlot} (KST · 약 ${Math.floor(hours)}시간 전)입니다 — 두 회차 연속 시작하지 않았습니다(예약 실행이 멈췄거나 저장소 쓰기가 실패했을 수 있습니다)`);
    }
  }
  // 깨우기를 보낸 마지막 회차 — 뒤에 '알릴 거리 없음' 회차가 와도 덮이지 않는다. 옛 서버 코드(칸 없음)는 lastRun 으로
  const r = j.lastSentRun || j.lastRun;
  // 없어진 구독(dropped)은 sent 에 들어 있지만 받을 폰이 없었던 것이다 — 그것만 있던 회차는 정리 작업이지 경보가 아니다
  const live = r ? Number(r.sent) - Number(r.dropped || 0) : 0;
  if (r && live > 0 && Number(r.woke) === 0) {
    return out('error', `깨우기를 보낸 마지막 회차(${r.slot || '수동'})가 등록된 폰 ${live}대에 깨우기를 보냈는데 푸시 서비스가 한 건도 받아 주지 않았습니다(woke=0 · 폰 도착 수가 아니라 푸시 서비스가 받은 수 · 없어진 구독 ${Number(r.dropped || 0)}건은 빼고 셈) — 서버 열쇠(VAPID)가 어긋났을 수 있으니 확인이 필요합니다`);
  }
  return out('ok', '');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rc = String(process.env.HEALTH_RC ?? '');
  const code = String(process.env.HEALTH_CODE ?? '');
  const body = String(process.env.HEALTH_BODY ?? '');
  let json = null;
  try { json = JSON.parse(body); } catch (e) { json = null; }
  const v = verdict({ curlOk: rc === '0', code, json, now: Date.now() });
  for (const w of v.warnings) console.log(`⚠️ ${w}`);
  console.log(`판정: ${v.verdict}${v.why ? ` — ${v.why}` : ''}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${v.verdict}\nwhy=${v.why.replace(/\r?\n/g, ' ')}\n`);
  }
}
