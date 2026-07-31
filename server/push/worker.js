/* ============================================================
   한대장 — 푸시 발송 서버 (Cloudflare Worker · 무료 등급)
   ------------------------------------------------------------
   이 서버가 하는 일은 딱 하나: **"확인해 봐"라고 폰을 깨우는 것.**

   왜 이렇게 만들었나 (중요 — 개인정보 원칙)
   - 이 서버는 **알림 내용을 만들지 않는다.** 내용 없는 빈 푸시만 보낸다.
     폰이 깨어나면 앱의 서비스워커가 **기기 안에 있는 프로필**로 판단해
     "○○장학금 내일 마감" 같은 정확한 문구를 스스로 만들어 띄운다.
   - 그래서 서버에 저장되는 것은 **① 폰 주소(엔드포인트) ② 학교 ③ 캠퍼스**뿐이다.
     이름·성적·소득구간·서류는 서버로 나가지 않는다(기존 원칙 그대로).
   - 빈 푸시는 암호화할 내용이 없어서 서버 코드도 작고 고장날 곳이 적다.

   흐름
     ① 앱이 POST /subscribe 로 "내 폰 주소는 이거, 나는 ○○대 학생" 등록
     ② 하루 두 번(예약 실행) 서버가 공고 데이터를 읽고
        "오늘 알릴 거리가 있는 학교"를 추려 그 학교 구독자만 깨운다
     ③ 폰의 서비스워커가 깨어나 알림 규칙을 돌리고 알림을 띄운다
     ④ 폰을 바꾸거나 앱을 지우면 푸시가 404/410으로 돌아온다 → 자동 삭제

   필요한 설정(자세한 절차는 같은 폴더 README.md)
     KV 네임스페이스 : SUBS
     시크릿          : VAPID_JWK (개인키 JWK), VAPID_PUBLIC (공개키), VAPID_SUBJECT (mailto:...)
     변수            : APP_ORIGIN (앱 주소), ALLOW_ORIGIN (앱 주소 — CORS 허용)
   ============================================================ */

const MAX_SUBS_PER_RUN = 800;   // 한 번 실행에 보낼 최대 건수 (무료 등급 보호)
const PUSH_TTL = 12 * 60 * 60;  // 폰이 꺼져 있으면 12시간까지 보관했다가 전달

/* ---------------- 유틸 ---------------- */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const json = (obj, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders },
  });

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  };
}

/* 엔드포인트가 진짜 브라우저 푸시 서비스인지 확인 — 아무 주소로나 요청을 쏘지 않게 */
const PUSH_HOSTS = [
  'fcm.googleapis.com',            // Chrome / Edge / Android
  'updates.push.services.mozilla.com', // Firefox
  'web.push.apple.com',            // Safari / iOS
  'wns2-*.notify.windows.com',     // Windows (와일드카드는 아래에서 처리)
];
function isPushEndpoint(url) {
  let u;
  try { u = new URL(url); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  return PUSH_HOSTS.some((h) => (h.includes('*')
    ? new RegExp('^' + h.replace(/\./g, '\\.').replace(/\*/g, '[a-z0-9-]+') + '$').test(u.hostname)
    : u.hostname === h));
}

/* ---------------- VAPID 서명 (ES256 JWT) ---------------- */
async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: env.VAPID_SUBJECT || 'mailto:seonju5543@gmail.com',
  })));
  const data = new TextEncoder().encode(`${header}.${payload}`);

  const jwk = JSON.parse(env.VAPID_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // Web Crypto의 ECDSA 서명은 이미 r||s 원시 형식이라 JWS(ES256)가 그대로 받는다
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
  return `vapid t=${header}.${payload}.${b64url(sig)}, k=${env.VAPID_PUBLIC}`;
}

/* 내용 없는 '깨우기' 푸시 — 암호화할 본문이 없으므로 헤더만 실어 보낸다 */
async function sendWake(env, endpoint) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(env, endpoint),
      TTL: String(PUSH_TTL),
      Urgency: 'normal',
      'Content-Length': '0',
    },
  });
  return res.status;
}

/* ---------------- 구독 저장소 (KV) ---------------- */
const subKey = (endpoint) => 'sub:' + b64url(new TextEncoder().encode(endpoint)).slice(0, 200);

async function saveSub(env, endpoint, school, campus) {
  await env.SUBS.put(subKey(endpoint), JSON.stringify({
    endpoint, school: school || '', campus: campus || '', at: Date.now(),
  }));
}
async function dropSub(env, endpoint) {
  await env.SUBS.delete(subKey(endpoint));
}

/* ---------------- 오늘 알릴 거리가 있는 학교 추리기 ---------------- */
/* 서버는 '누구에게 무엇을' 까지는 정하지 않는다. '어느 학교를 깨울지'만 고른다.
   정확한 문구는 폰이 자기 프로필로 만든다(개인정보가 서버로 오지 않는 이유). */
function ymd(ts) {
  const d = new Date(ts + 9 * 3600 * 1000); // KST 기준 날짜
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function schoolsToWake(env) {
  const origin = env.APP_ORIGIN || 'https://seonju5543-web.github.io/hanggonggan';
  const get = (path) => fetch(`${origin}/${path}`, { cf: { cacheTtl: 0 } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [reg, notices] = await Promise.all([get('data/registered.json'), get('data/notices.json')]);

  const today = ymd(Date.now());
  const tomorrow = ymd(Date.now() + 86400000);
  const seenRaw = await env.SUBS.get('state:seen');
  const seen = new Set(seenRaw ? JSON.parse(seenRaw) : []);
  const nextSeen = new Set(seen);

  const wakeAll = { value: false };      // 전국 대상 사건이면 모두 깨운다
  const schools = new Set();
  const reasons = [];

  for (const s of ((reg && reg.items) || [])) {
    if (!s || !s.id) continue;
    const school = (s.eligibility || {}).schoolOnly || null;
    const isNew = !seen.has(s.id);
    nextSeen.add(s.id);

    const dl = s.deadline;
    const dueSoon = dl === today || dl === tomorrow;
    // 첫 실행(장부가 비어 있음)은 '전부 새 공고'가 되므로 새 공고 사유는 세지 않는다
    const countNew = seen.size > 0 && isNew && (!dl || dl >= today);

    if (!countNew && !dueSoon) continue;
    if (school) { schools.add(school); } else { wakeAll.value = true; }
    reasons.push(`${s.id}:${countNew ? 'new' : ''}${dueSoon ? 'due' : ''}`);
  }

  for (const n of ((notices && notices.items) || [])) {
    if (!n || !n.url || !n.school) continue;
    const k = 'n:' + n.url;
    if (seen.has(k)) { nextSeen.add(k); continue; }
    nextSeen.add(k);
    if (seen.size === 0) continue;                 // 첫 실행은 조용히 장부만 채운다
    if (/대출|융자/.test(n.title || '')) continue;  // 장학금이 아닌 것은 깨우지 않는다
    schools.add(n.school);
    reasons.push(`notice:${n.school}`);
  }

  // 장부가 무한정 커지지 않게 최근 것만 남긴다
  await env.SUBS.put('state:seen', JSON.stringify(Array.from(nextSeen).slice(-4000)));
  return { schools, wakeAll: wakeAll.value, reasons };
}

/* ---------------- 예약 실행: 깨우기 ---------------- */
async function runWake(env) {
  const { schools, wakeAll, reasons } = await schoolsToWake(env);
  if (!wakeAll && schools.size === 0) {
    return { woke: 0, dropped: 0, note: '오늘 알릴 거리 없음 — 아무도 깨우지 않음' };
  }

  let cursor;
  let woke = 0;
  let dropped = 0;
  do {
    const list = await env.SUBS.list({ prefix: 'sub:', cursor });
    cursor = list.list_complete ? null : list.cursor;
    for (const k of list.keys) {
      if (woke >= MAX_SUBS_PER_RUN) { cursor = null; break; }
      const raw = await env.SUBS.get(k.name);
      if (!raw) continue;
      let sub;
      try { sub = JSON.parse(raw); } catch (e) { continue; }
      if (!wakeAll && !schools.has(sub.school)) continue;

      let status = 0;
      try { status = await sendWake(env, sub.endpoint); } catch (e) { status = 0; }
      if (status === 404 || status === 410) { await env.SUBS.delete(k.name); dropped++; continue; }
      if (status >= 200 && status < 300) woke++;
    }
  } while (cursor);

  return { woke, dropped, schools: Array.from(schools), wakeAll, reasons: reasons.slice(0, 20) };
}

/* ---------------- HTTP ---------------- */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, configured: !!(env.VAPID_JWK && env.VAPID_PUBLIC) }, 200, cors);
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors); }
      const endpoint = body && body.endpoint;
      if (!endpoint || !isPushEndpoint(endpoint)) return json({ error: 'bad endpoint' }, 400, cors);
      if (String(body.school || '').length > 40 || String(body.campus || '').length > 40) {
        return json({ error: 'too long' }, 400, cors);
      }
      await saveSub(env, endpoint, body.school, body.campus);
      return json({ ok: true }, 200, cors);
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, cors); }
      if (!body || !body.endpoint) return json({ error: 'bad endpoint' }, 400, cors);
      await dropSub(env, body.endpoint);
      return json({ ok: true }, 200, cors);
    }

    /* 개발자가 손으로 한 번 깨워보고 싶을 때 (시크릿 ADMIN_KEY 필요) */
    if (url.pathname === '/run' && request.method === 'POST') {
      if (!env.ADMIN_KEY || request.headers.get('x-admin-key') !== env.ADMIN_KEY) {
        return json({ error: 'unauthorized' }, 401, cors);
      }
      return json(await runWake(env), 200, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },

  /* 예약 실행 — wrangler.toml의 cron 시간표대로 자동으로 불린다 */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWake(env).then((r) => console.log('wake:', JSON.stringify(r))));
  },
};

/* 테스트에서 부분만 떼어 쓰기 위한 내보내기 (Worker 동작에는 영향 없음) */
export { isPushEndpoint, schoolsToWake, ymd, subKey };
