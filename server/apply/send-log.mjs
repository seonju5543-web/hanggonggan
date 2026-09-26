/* ============================================================================
   발송 기록 · 바운스 (2026-09-26 · 기술 고문 보고서 Q5 D+30)

   하는 일 둘.
   ① 보낼 때 `apply_sends` 에 한 줄 적는다(증빙).
   ② Resend 가 보내는 바운스·도착 알림을 받아 그 줄의 상태를 고친다.

   🔴 **학생이 쓴 글을 담지 않는다** — 신청서 답·자기소개서·첨부는 여기 오지 않는다.
      담는 것은 '언제 · 어느 공고 · 어디로 · 어떻게 됐나' 뿐이다(0003_apply_sends.sql).
   🔴 **기록이 실패해도 발송은 막지 않는다** — 학생의 신청이 우리 장부 사정으로 멈추면 안 된다.
      대신 조용히 넘기지 않고 응답에 `logged: false` 로 알린다.
      ⚠️ 반대로 **발송 전에** 기록하지도 않는다 — 안 보낸 것을 보냈다고 적는 게 더 나쁘다.
   🔴 **웹훅은 서명을 확인한 것만 받는다** — 아무나 POST 해서 '도착했다'로 바꿀 수 있으면
      증빙이 증빙이 아니다. Resend 는 Svix 서명을 쓴다(`svix-id`·`svix-timestamp`·`svix-signature`).
   ========================================================================== */

/** Supabase 에 `service_role` 로 쓴다 — RLS 를 건너뛴다(학생은 못 넣는 표다). */
async function sbWrite(env, path, opts) {
  const o = opts || {};
  return fetch(String(env.SUPABASE_URL).replace(/\/+$/, '') + path, {
    method: o.method || 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: o.prefer || 'return=minimal',
    },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
}

export const logConfigured = (env) => !!(env && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);

/* 🔴 **누가 보냈는지를 클라이언트 말로 믿지 않는다** (2026-09-26).
   증빙 장부의 `user_id` 를 요청 본문에서 받으면, 변조된 클라이언트가 **남의 이름으로**
   발송 기록을 남길 수 있다 — 그건 증빙이 아니라 흠집이다.
   그래서 학생의 로그인 토큰을 **Supabase 에 물어** 확인하고 그 답에 적힌 id 만 쓴다.
   ⚠️ 그래서 접수 대행은 **로그인한 학생만** 쓸 수 있다. 우리가 대신 보내는 일에는
      나중에 "내가 냈다"를 가릴 상대가 있어야 하므로, 이건 제약이 아니라 조건이다. */
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

/**
 * 보낸 뒤 한 줄 적는다.
 * @returns {Promise<boolean>} 적었는가 (못 적어도 발송을 되돌리지 않는다)
 */
export async function recordSend(env, row) {
  if (!logConfigured(env)) return false;
  try {
    const r = await sbWrite(env, '/rest/v1/apply_sends', {
      body: [{
        user_id: row.userId,
        notice_id: row.noticeId,
        to_email: row.to,
        subject: (row.subject || '').slice(0, 300),
        provider_id: row.providerId || null,
        status: row.status || 'queued',
        detail: row.detail || null,
      }],
    });
    return r.ok;
  } catch { return false; }
}

/* ── Svix 서명 확인 ───────────────────────────────────────────────────────
   서명 대상은 `{svix-id}.{svix-timestamp}.{본문}` 이고, 열쇠는 `whsec_` 뒤의 base64 다.
   헤더에는 서명이 **여럿** 올 수 있다(`v1,xxx v1,yyy`) — 열쇠를 돌릴 때 겹쳐 보내기 때문이다.
   ⚠️ 하나라도 맞으면 통과다. '첫 번째만' 보면 열쇠 교체 중에 조용히 다 막힌다. */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function verifySvix(secret, headers, body) {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigHeader = headers.get('svix-signature');
  if (!secret || !id || !ts || !sigHeader) return false;

  /* 오래된 요청을 되받아치는 것(replay)을 막는다 — 5분 */
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;

  /* ⚠️ 열쇠가 base64 가 아니면 `atob` 이 **던진다** — 그러면 워커가 500 이고 Resend 가
     계속 되보낸다. 못 맞춘 것과 같이 취급해 조용히 false 로 닫는다. */
  let mine;
  try {
    const key = await crypto.subtle.importKey(
      'raw', b64(String(secret).replace(/^whsec_/, '')),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
    mine = btoa(String.fromCharCode(...new Uint8Array(mac)));
  } catch { return false; }

  for (const part of String(sigHeader).split(/\s+/)) {
    const [ver, val] = part.split(',');
    if (ver === 'v1' && val === mine) return true;
  }
  return false;
}

/* Resend 사건 이름 → 우리 상태. 모르는 사건은 **바꾸지 않는다**(지어내지 않는다).
   🔴 **`__proto__` 를 없앤 객체**이고 아래에서 `in` 이 아니라 `hasOwn` 으로 본다 —
      보통 객체면 `'constructor' in EVENT_STATUS` 가 **참**이라(프로토타입을 타고 간다)
      `{type:'constructor'}` 를 보내는 것만으로 상태 칸에 함수가 들어간다(실측). */
export const EVENT_STATUS = {
  __proto__: null,
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': null,          // 아직 실패가 아니다 — 그대로 둔다
  'email.sent': null,
};

/** 웹훅 한 건을 반영한다. @returns {Promise<{ok:boolean, why?:string}>} */
export async function applyWebhook(env, event) {
  const type = event && event.type;
  if (!Object.prototype.hasOwnProperty.call(EVENT_STATUS, type)) return { ok: false, why: '모르는 사건' };
  const status = EVENT_STATUS[type];
  if (!status) return { ok: true };                       // 상태를 바꿀 사건이 아니다

  const pid = event && event.data && event.data.email_id;
  if (!pid) return { ok: false, why: '메시지 id 가 없다' };
  if (!logConfigured(env)) return { ok: false, why: '장부가 꺼져 있다' };

  /* 반송 사유는 Resend 가 준 문구를 그대로 적는다 — 우리가 지어내지 않는다(원칙 8-1). */
  const detail = (event.data.bounce && (event.data.bounce.message || event.data.bounce.subType))
    || event.data.reason || null;
  const r = await sbWrite(env, `/rest/v1/apply_sends?provider_id=eq.${encodeURIComponent(pid)}`, {
    method: 'PATCH',
    body: { status, detail: detail ? String(detail).slice(0, 500) : null, updated_at: new Date().toISOString() },
  });
  return r.ok ? { ok: true } : { ok: false, why: '장부에 못 적었다' };
}
