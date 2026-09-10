/**
 * 인스타 토큰에게 "얼마나 남았니" 를 직접 물어본다.
 *
 * 🔴 설정 화면을 보는 것으로는 증명이 안 된다 — 물어봐야 안다
 *    (관리자 화면 잠금 확인과 같은 계열).
 * 🔴 **못 물어본 것을 '괜찮다' 로 읽지 않는다.** 확인 실패는 `dead` 로 친다 —
 *    조용히 통과시키면 만료를 두 달 뒤에나 알게 된다.
 *
 * 찍는 것: `state=ok|expiring|dead` · `days=N` (워크플로가 $GITHUB_OUTPUT 으로 받는다)
 */
// 🔴 env 를 **모듈 맨 위에서** 읽지 말 것 — 불러오는 순간 값이 굳어서 시험도 못 하고
//    호출 순서에 따라 조용히 빈 값이 된다(실제로 시험이 전부 'none' 으로 나왔다).
const API = () => process.env.IG_API_BASE || 'https://graph.facebook.com/v21.0';
const TOKEN = () => process.env.IG_ACCESS_TOKEN;
/** 이보다 짧아지면 사람을 부른다. 60일 토큰이라 2주면 갱신할 시간이 넉넉하다. */
export const WARN_DAYS = 14;

export async function tokenState(fetchImpl = fetch) {
  const tok = TOKEN();
  if (!tok) return { state: 'none', days: null };
  try {
    const u = `${API()}/debug_token?input_token=${encodeURIComponent(tok)}`
      + `&access_token=${encodeURIComponent(tok)}`;
    const r = await fetchImpl(u);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) return { state: 'dead', days: 0, why: j.error?.message || `HTTP ${r.status}` };
    const d = j.data || {};
    if (d.is_valid === false) return { state: 'dead', days: 0, why: d.error?.message || '토큰이 유효하지 않음' };
    // expires_at 이 0 이면 만료가 없는 토큰이다(시스템 사용자 토큰 등).
    if (!d.expires_at) return { state: 'ok', days: 9999 };
    const days = Math.round((d.expires_at * 1000 - Date.now()) / 864e5);
    if (days <= 0) return { state: 'dead', days: 0, why: '이미 만료됨' };
    return { state: days <= WARN_DAYS ? 'expiring' : 'ok', days };
  } catch (e) {
    // 🔴 못 물어본 것은 '괜찮다' 가 아니다.
    return { state: 'dead', days: 0, why: `물어보지 못함 — ${e.message}` };
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const s = await tokenState();
  console.log(`state=${s.state}`);
  console.log(`days=${s.days ?? ''}`);
  console.error(s.why ? `⚠️  ${s.why}` : `토큰 남은 수명 ${s.days}일 (${s.state})`);
}
