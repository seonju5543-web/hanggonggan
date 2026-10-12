/* ============================================================================
   서버 문지기 — 누가 부르는가 · 너무 자주 부르는가 (2026-10-12 · 백엔드 2 보안 점검 🟡 · docs/backend/서버-보안-점검-2026-10-10.md)

   🔴 왜 필요한가: 우리 서버는 요청에 적힌 출처 이름(Origin)을 보고 앱인지 가렸다. 그런데 스크립트는 그 이름을
      마음대로 적어 보낼 수 있다. AI 를 부르는 서버(초안·도우미)는 주소가 알려지면 누구나 우리 크레딧을 쓸 수 있었다.
   그래서 두 가지를 더 본다.
     ① 로그인 확인 — 학생의 Supabase 토큰을 **Supabase 에 물어** 확인한다(클라이언트 말을 믿지 않는다).
     ② 요청 횟수 제한 — Cloudflare Rate Limiting 바인딩(무료). 한 열쇠(학생 id 또는 접속 주소)당 1분에 N회.
        ⚠️ 이 바인딩은 **1분(또는 10초) 창**만 셀 수 있다. 하루 한도는 못 건다 — 마지막 방어선은
           Anthropic 콘솔의 월 사용 한도다(서버 README 에 적었다).
   서버마다 베끼지 않고 이 파일 하나를 쓴다 — 접수 대행(server/apply)도 여기서 resolveUser 를 가져간다.
   ========================================================================== */

/** 로그인 토큰 → 회원 id. 확인 못 하면 null (토큰 없음·만료·위조·Supabase 설정 없음). */
export async function resolveUser(env, authHeader) {
  const tok = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok || !env || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(String(env.SUPABASE_URL).replace(/\/+$/, '') + '/auth/v1/user', {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + tok },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return (u && u.id) || null;
  } catch { return null; }
}

/** 요청한 쪽의 접속 주소 — Cloudflare 가 붙여 준다(학생이 바꿀 수 없다). 로그인 없는 길의 횟수 제한 열쇠. */
export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || '';

/**
 * 횟수 제한에 걸렸는가.
 * @returns {Promise<'ok'|'limited'|'missing'>} missing = 바인딩이 없다(배포 설정 누락) — 어떻게 다룰지는 서버가 정한다
 *   (돈이 나가는 AI 서버는 막고, 이미 가동 중인 푸시 서버는 통과시킨다).
 */
export async function limitCheck(binding, key) {
  if (!binding || typeof binding.limit !== 'function') return 'missing';
  try {
    const r = await binding.limit({ key: String(key || 'anon') });
    return r && r.success === false ? 'limited' : 'ok';
  } catch { return 'ok'; }   // 제한 장치 자체가 잠깐 탈이 나면 학생을 막지 않는다(크레딧은 월 한도가 받친다)
}
