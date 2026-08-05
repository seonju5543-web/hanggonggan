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
     ② 하루 두 번(아래 WAKE_SLOTS_KST) 서버가 공고 데이터를 읽고
        "오늘 알릴 거리가 있는 학교"를 추려 그 학교 구독자만 깨운다
     ③ 폰의 서비스워커가 깨어나 알림 규칙을 돌리고 알림을 띄운다
     ④ 폰을 바꾸거나 앱을 지우면 푸시가 404/410으로 돌아온다 → 자동 삭제

   ⚠️ 왜 '한 번에' 하지 않고 조금씩 나눠 하나 (2026-08-05 — 무료 등급의 두 벽)
   Cloudflare 무료 등급은 **한 번 실행(invocation)마다** 두 가지를 제한한다.
     (a) 밖으로 나가는 요청 **50건** — 폰 하나 깨우기가 1건이라 한 번에 ~48대가 상한
     (b) 계산 시간 **10밀리초** — 공고 데이터(registered 약 300KB + notices 약 470KB)를
         읽어 해석하는 것만으로 6~9ms라, 예전 구조는 **사용자가 0명이어도 중간에 강제 종료**됐다
   그래서 이 서버는 일을 **작은 단계로 쪼개** 2분마다 한 걸음씩 진행한다(state:run).
     reg(정식 등록 읽기) → notices(실시간 공고 읽기) → plan(깨울 학교 정하기) → send(25대씩 발송)
   한 걸음이 강제 종료돼도 tries가 남아 다음 걸음에서 이어지고, 다섯 번 실패하면
   조용히 멈추지 않고 lastError에 사유를 남긴다(/health에서 보인다).
   **이 구조를 되돌리려면(예: 한 번에 처리) 위 (a)(b)를 먼저 해결해야 한다.**

   필요한 설정(자세한 절차는 같은 폴더 README.md)
     KV 네임스페이스 : SUBS
     시크릿          : VAPID_JWK (개인키 JWK), VAPID_PUBLIC (공개키), VAPID_SUBJECT (mailto:...)
     변수            : APP_ORIGIN (앱 주소), ALLOW_ORIGIN (앱 주소 — CORS 허용)
   ============================================================ */

const SEND_PER_TICK = 25;         // 한 걸음에 깨울 폰 수 (무료 등급 외부 요청 50건/실행 — 절반만 쓴다)
const MAX_SUBS_PER_WAKE = 2000;   // 한 번의 '알릴 거리'에 깨울 총 상한 (그 이상은 유료 등급 검토)
const STEP_MAX_TRIES = 5;         // 같은 걸음을 이만큼 실패하면 포기하고 사유를 남긴다
const SLOT_GRACE_MS = 2 * 3600 * 1000; // 예약 시각을 이보다 늦게 지나쳤으면 건너뛴다(한밤중 몰아보내기 방지)
const WAKE_SLOTS_KST = [[8, 10], [20, 10]]; // 깨우는 시각 (한국시간 08:10 · 20:10)
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

/* ---------------- VAPID 서명 (ES256 JWT) ----------------
   서명은 **푸시 서비스마다 하나**만 있으면 되고 12시간 유효하다(aud = 서비스 주소).
   폰마다 새로 서명하면 계산 시간 10ms 제한(무료 등급)에 금방 걸리므로,
   같은 서비스로 보내는 동안에는 만들어 둔 서명을 재사용한다. */
let vapidKeyCache = null;              // 개인키를 매번 다시 읽지 않는다
const vapidTokenCache = new Map();     // 푸시 서비스 주소 → { token, exp }

async function vapidHeader(env, endpoint) {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);

  const hit = vapidTokenCache.get(aud);
  if (hit && hit.exp > now + 600) return `vapid t=${hit.token}, k=${env.VAPID_PUBLIC}`;

  const exp = now + 12 * 3600;
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud,
    exp,
    sub: env.VAPID_SUBJECT || 'mailto:seonju5543@gmail.com',
  })));
  const data = new TextEncoder().encode(`${header}.${payload}`);

  if (!vapidKeyCache || vapidKeyCache.raw !== env.VAPID_JWK) {
    const jwk = JSON.parse(env.VAPID_JWK);
    vapidKeyCache = {
      raw: env.VAPID_JWK,
      key: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
    };
  }
  // Web Crypto의 ECDSA 서명은 이미 r||s 원시 형식이라 JWS(ES256)가 그대로 받는다
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapidKeyCache.key, data);
  const token = `${header}.${payload}.${b64url(sig)}`;
  vapidTokenCache.set(aud, { token, exp });
  return `vapid t=${token}, k=${env.VAPID_PUBLIC}`;
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

/* 공고 데이터에서 '깨울지 판단하는 데 필요한 것'만 남긴다.
   원본은 수십만 글자라 그대로 들고 다니면 계산 시간 제한에 걸린다(파일 첫머리 설명 참조). */
function summarize(reg, notices) {
  return {
    reg: ((reg && reg.items) || [])
      .filter((s) => s && s.id)
      .map((s) => ({ id: s.id, school: (s.eligibility || {}).schoolOnly || null, deadline: s.deadline || null })),
    notices: ((notices && notices.items) || [])
      .filter((n) => n && n.url && n.school)
      .map((n) => ({ url: n.url, school: n.school, title: n.title || '' })),
  };
}

function fetchData(env, path) {
  const origin = env.APP_ORIGIN || 'https://seonju5543-web.github.io/hanggonggan';
  return fetch(`${origin}/${path}`, { cf: { cacheTtl: 0 } })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/* mini를 주면 그것으로 판단하고(예약 실행 경로 — 데이터 해석은 앞 걸음에서 이미 끝났다),
   주지 않으면 직접 받아온다(시험·수동 실행 경로). */
async function schoolsToWake(env, mini) {
  if (!mini) {
    const [reg, notices] = await Promise.all([
      fetchData(env, 'data/registered.json'),
      fetchData(env, 'data/notices.json'),
    ]);
    mini = summarize(reg, notices);
  }

  const today = ymd(Date.now());
  const tomorrow = ymd(Date.now() + 86400000);
  const seenRaw = await env.SUBS.get('state:seen');
  const seen = new Set(seenRaw ? JSON.parse(seenRaw) : []);
  const nextSeen = new Set(seen);

  const wakeAll = { value: false };      // 전국 대상 사건이면 모두 깨운다
  const schools = new Set();
  const reasons = [];

  for (const s of (mini.reg || [])) {
    const school = s.school || null;
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

  for (const n of (mini.notices || [])) {
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

/* ---------------- 진행 상태 (KV) ----------------
   한 걸음씩 나눠 하기 때문에 '지금 어디까지 했는지'를 적어 둔다. */
const RUN_KEY = 'state:run';
const getRun = async (env) => {
  const raw = await env.SUBS.get(RUN_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
};
const putRun = (env, run) => env.SUBS.put(RUN_KEY, JSON.stringify(run));
const clearRun = async (env) => {
  await env.SUBS.delete(RUN_KEY);
  await env.SUBS.delete('state:mini');
};

/* 지금이 '깨울 시각'을 지났고 아직 안 깨웠으면 그 시각표를 돌려준다 */
function dueSlot(now) {
  const kst = new Date(now + 9 * 3600 * 1000);
  const day = ymd(now);
  const minutesNow = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  let best = null;
  for (const [h, m] of WAKE_SLOTS_KST) {
    const at = h * 60 + m;
    if (minutesNow < at) continue;
    if ((minutesNow - at) * 60000 > SLOT_GRACE_MS) continue; // 너무 늦게 지나친 시각은 건너뛴다
    if (!best || at > best.at) best = { at, key: `${day}#${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
  }
  return best;
}

/* ---------------- 한 걸음 진행 (2분마다 불린다) ---------------- */
async function tick(env, opts = {}) {
  let run = await getRun(env);

  /* 아무 일도 진행 중이 아니면 — 깨울 시각이 됐는지만 본다 (여기가 거의 모든 실행) */
  if (!run) {
    if (!opts.force) {
      const slot = dueSlot(Date.now());
      if (!slot) return { idle: true };
      const last = await env.SUBS.get('state:slot');
      if (last === slot.key) return { idle: true };
      await env.SUBS.put('state:slot', slot.key);
    }
    run = { step: 'reg', tries: 0, startedAt: Date.now(), woke: 0, dropped: 0, sent: 0 };
  }

  /* 같은 걸음을 계속 실패하면(예: 계산 시간 초과로 강제 종료) 조용히 멈추지 않고 사유를 남긴다.
     tries는 걸음을 시작하기 **전에** 적는다 — 실행이 통째로 죽어도 숫자는 남아야 하기 때문. */
  if (run.tries >= STEP_MAX_TRIES) {
    await clearRun(env);
    await env.SUBS.put('state:lastError', JSON.stringify({
      at: Date.now(), step: run.step, note: `같은 걸음을 ${STEP_MAX_TRIES}회 실패해 이번 회차를 포기함`,
    }));
    return { aborted: true, step: run.step };
  }
  run.tries++;
  await putRun(env, run);

  const nextStep = async (step, extra = {}) => {
    Object.assign(run, extra, { step, tries: 0 });
    await putRun(env, run);
  };

  /* ① 정식 등록 공고 읽기 */
  if (run.step === 'reg') {
    const reg = await fetchData(env, 'data/registered.json');
    if (!reg) return { step: 'reg', note: '데이터를 받지 못함 — 다음 걸음에서 다시 시도' };
    await env.SUBS.put('state:mini', JSON.stringify(summarize(reg, null)));
    await nextStep('notices');
    return { step: 'reg', done: true };
  }

  /* ② 실시간 공고 읽기 */
  if (run.step === 'notices') {
    const notices = await fetchData(env, 'data/notices.json');
    if (!notices) return { step: 'notices', note: '데이터를 받지 못함 — 다음 걸음에서 다시 시도' };
    const mini = JSON.parse((await env.SUBS.get('state:mini')) || '{}');
    mini.notices = summarize(null, notices).notices;
    await env.SUBS.put('state:mini', JSON.stringify(mini));
    await nextStep('plan');
    return { step: 'notices', done: true };
  }

  /* ③ 누구를 깨울지 정하기 */
  if (run.step === 'plan') {
    const mini = JSON.parse((await env.SUBS.get('state:mini')) || '{}');
    const { schools, wakeAll, reasons } = await schoolsToWake(env, mini);
    if (!wakeAll && schools.size === 0) {
      await clearRun(env);
      return { step: 'plan', woke: 0, note: '오늘 알릴 거리 없음 — 아무도 깨우지 않음' };
    }
    await nextStep('send', {
      schools: Array.from(schools), wakeAll, reasons: reasons.slice(0, 20), cursor: null,
    });
    return { step: 'plan', schools: run.schools, wakeAll };
  }

  /* ④ 발송 — 한 걸음에 한 묶음(최대 SEND_PER_TICK대)씩, 다 보낼 때까지 이어서.
     ⚠️ 묶음은 **반드시 끝까지** 처리한다. 묶음 중간에서 멈추면 다음 걸음이 그 묶음을
     처음부터 다시 받아 **이미 깨운 폰을 또 깨운다**(2026-08-05 검증에서 60명이 70번 깨워짐).
     그래서 한 묶음의 크기를 한 걸음의 발송 상한과 같게 잡는다. */
  if (run.step === 'send') {
    const schools = new Set(run.schools || []);
    const list = await env.SUBS.list({ prefix: 'sub:', cursor: run.cursor || undefined, limit: SEND_PER_TICK });

    for (const k of list.keys) {
      if (run.sent >= MAX_SUBS_PER_WAKE) break;
      const raw = await env.SUBS.get(k.name);
      if (!raw) continue;
      let sub;
      try { sub = JSON.parse(raw); } catch (e) { continue; }
      if (!run.wakeAll && !schools.has(sub.school)) continue;

      run.sent++;
      let status = 0;
      try { status = await sendWake(env, sub.endpoint); } catch (e) { status = 0; }
      if (status === 404 || status === 410) { await env.SUBS.delete(k.name); run.dropped++; continue; }
      if (status >= 200 && status < 300) run.woke++;
    }

    const cursor = list.list_complete ? null : list.cursor;
    const finished = cursor == null || run.sent >= MAX_SUBS_PER_WAKE;
    const result = {
      step: 'send', woke: run.woke, dropped: run.dropped, sent: run.sent,
      schools: run.schools, wakeAll: run.wakeAll, reasons: run.reasons, finished,
    };
    if (finished) await clearRun(env);
    else await nextStep('send', { cursor });
    return result;
  }

  await clearRun(env);
  return { note: '알 수 없는 단계 — 초기화함', step: run.step };
}

/* 지금 당장 전원(최대 SEND_PER_TICK대)을 깨운다 — 개발자가 "내 폰에 오나" 확인할 때만.
   공고 데이터를 읽지 않으므로 계산 시간이 거의 들지 않는다. */
async function sendTestWake(env) {
  const list = await env.SUBS.list({ prefix: 'sub:' });
  let woke = 0; let dropped = 0; let tried = 0;
  for (const k of list.keys) {
    if (tried >= SEND_PER_TICK) break;
    const raw = await env.SUBS.get(k.name);
    if (!raw) continue;
    let sub;
    try { sub = JSON.parse(raw); } catch (e) { continue; }
    tried++;
    let status = 0;
    try { status = await sendWake(env, sub.endpoint); } catch (e) { status = 0; }
    if (status === 404 || status === 410) { await env.SUBS.delete(k.name); dropped++; continue; }
    if (status >= 200 && status < 300) woke++;
  }
  return { tried, woke, dropped, note: '시험 발송 — 조건을 따지지 않고 등록된 폰을 깨웠습니다' };
}

/* ---------------- HTTP ---------------- */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const run = await getRun(env);
      let lastError = null;
      try { lastError = JSON.parse((await env.SUBS.get('state:lastError')) || 'null'); } catch (e) { lastError = null; }
      return json({
        ok: true,
        configured: !!(env.VAPID_JWK && env.VAPID_PUBLIC),
        step: run ? run.step : 'idle',      // 지금 어느 걸음인지 (idle = 할 일 없음 · 정상)
        sent: run ? run.sent : 0,
        lastError,                           // 다섯 번 실패해 포기한 적이 있으면 여기 남는다
      }, 200, cors);
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

    /* 아래 둘은 개발자용 (시크릿 ADMIN_KEY 필요) */
    const admin = env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY;

    /* 예약 시각을 기다리지 않고 이번 회차를 지금 시작한다.
       실제 발송은 2분마다의 걸음으로 이어진다(진행 상황은 /health). */
    if (url.pathname === '/run' && request.method === 'POST') {
      if (!admin) return json({ error: 'unauthorized' }, 401, cors);
      return json(await tick(env, { force: true }), 200, cors);
    }

    /* "내 폰에 알림이 오나" 확인용 — 조건을 따지지 않고 즉시 깨운다 */
    if (url.pathname === '/test' && request.method === 'POST') {
      if (!admin) return json({ error: 'unauthorized' }, 401, cors);
      return json(await sendTestWake(env), 200, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },

  /* 예약 실행 — wrangler.toml의 cron(2분마다)에 맞춰 한 걸음씩 진행한다.
     할 일이 없으면 곧바로 끝나므로 무료 한도에 거의 영향이 없다. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env).then((r) => {
      if (!r || !r.idle) console.log('push tick:', JSON.stringify(r));
    }));
  },
};

/* 테스트에서 부분만 떼어 쓰기 위한 내보내기 (Worker 동작에는 영향 없음) */
export { isPushEndpoint, schoolsToWake, ymd, subKey, tick, dueSlot, summarize };
