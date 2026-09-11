/**
 * 인스타 토큰이 살아 있는지 · 얼마나 남았는지.
 *
 * 🔴 **`graph.instagram.com` 에는 `debug_token` 이 없다**(2026-09-11 문서 확인).
 *    그래서 만료일을 **물어볼 수가 없다.** 물어볼 수 있는 것은 '지금 살아 있나' 하나다.
 *    남은 날은 **우리가 이 토큰을 처음 본 날**에서 센다 — 그러니 이 숫자는 '만료까지'가
 *    아니라 '우리가 아는 한 만료까지'다. 문구도 그렇게만 말한다(원칙 8-1).
 *    ⚠️ 은서가 **새로 받은** 토큰을 넣어야 이 셈이 맞다. 두 달 묵은 토큰을 넣으면
 *       우리는 그걸 알 방법이 없다 — 그래서 살아 있는지를 매일 따로 확인한다.
 *
 * 🔴 토큰 자체를 파일에 적지 않는다. **지문(sha256 앞 8자리)만** 적어 바뀐 것만 알아챈다.
 *    공개 저장소라 토큰을 적으면 그 순간 남이 우리 계정에 글을 쓸 수 있다.
 *
 * 🔴 **못 물어본 것을 '괜찮다' 로 읽지 않는다.** 확인 실패는 `dead` 로 친다 —
 *    조용히 통과시키면 만료를 두 달 뒤에나 알게 된다.
 *
 * 찍는 것: `state=ok|expiring|dead|none` · `days=N` (워크플로가 $GITHUB_OUTPUT 으로 받는다)
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// 🔴 env 를 **모듈 맨 위에서** 읽지 말 것 — 불러오는 순간 값이 굳어서 시험도 못 하고
//    호출 순서에 따라 조용히 빈 값이 된다(실제로 시험이 전부 'none' 으로 나왔다).
const API = () => process.env.IG_API_BASE || 'https://graph.instagram.com';
const TOKEN = () => process.env.IG_ACCESS_TOKEN;
/** 이보다 짧아지면 사람을 부른다. 60일 토큰이라 2주면 갱신할 시간이 넉넉하다. */
export const WARN_DAYS = 14;
/** 장기 토큰의 수명 — Meta 문서상 60일. */
export const LIFE_DAYS = 60;

const SEEN = new URL('token-seen.json', import.meta.url);
/** 토큰의 지문. 되돌릴 수 없고, 바뀌었는지만 알 수 있을 만큼만 남긴다. */
export const fingerprint = (tok) => createHash('sha256').update(tok).digest('hex').slice(0, 8);

/** 🔴 로봇 기록장은 들여쓰기 1칸으로 쓴다 — 다르게 쓰면 파일 전체가 충돌한다(CLAUDE.md). */
export const fileStore = {
  read: () => (existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : {}),
  write: (v) => writeFileSync(SEEN, `${JSON.stringify(v, null, 1)}\n`),
};

/** KST 기준 오늘(YYYY-MM-DD). 🔴 UTC 로 재면 새벽에 어제가 된다. */
const kstDay = (ms = Date.now()) => new Date(ms + 9 * 36e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

export async function tokenState(fetchImpl = fetch, store = fileStore, now = Date.now()) {
  const tok = TOKEN();
  if (!tok) return { state: 'none', days: null };

  // ① 살아 있나 — 이것만이 **물어봐서 아는 것**이다.
  try {
    const r = await fetchImpl(`${API()}/me?fields=user_id&access_token=${encodeURIComponent(tok)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) return { state: 'dead', days: 0, why: j.error?.message || `HTTP ${r.status}` };
    if (!j.user_id && !j.id) return { state: 'dead', days: 0, why: '토큰이 계정을 못 가리킨다' };
  } catch (e) {
    // 🔴 못 물어본 것은 '괜찮다' 가 아니다.
    return { state: 'dead', days: 0, why: `물어보지 못함 — ${e.message}` };
  }

  // ② 며칠 남았나 — 이건 **우리가 세는 것**이다. 처음 보는 토큰이면 오늘이 1일째다.
  const fp = fingerprint(tok);
  const seen = store.read() || {};
  const today = kstDay(now);
  const fresh = seen.fp !== fp;
  const firstSeen = fresh ? today : (seen.firstSeen || today);
  if (fresh || seen.firstSeen !== firstSeen) store.write({ fp, firstSeen });

  const days = LIFE_DAYS - daysBetween(firstSeen, today);
  if (days <= 0) return { state: 'dead', days: 0, why: `우리가 본 지 ${LIFE_DAYS}일이 지났다` };
  return { state: days <= WARN_DAYS ? 'expiring' : 'ok', days, firstSeen };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const s = await tokenState();
  console.log(`state=${s.state}`);
  console.log(`days=${s.days ?? ''}`);
  console.error(s.why ? `⚠️  ${s.why}`
    : `살아 있음 · 우리가 아는 한 ${s.days}일 남음 (처음 본 날 ${s.firstSeen}) — ${s.state}`);
}
