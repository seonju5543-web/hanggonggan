/* ============================================================
   한대장 — 과팅 서버 (Cloudflare Worker · 무료 등급)
   ------------------------------------------------------------
   하는 일은 둘이다.
     ① **학교 이메일 인증** — 학생이 적은 ac.kr 주소로 6자리 번호를 보내고, 맞게 적으면
        Supabase 의 gating_profiles 에 "인증됐다"는 행을 만든다.
        행을 만드는 것은 **이 서버뿐**이다(학생 계정은 그 표에 insert 권한이 없다 —
        supabase/migrations/0003_gating.sql ②). 그래서 만능 열쇠(service_role)가 여기 있다.
     ② **매칭** — **매주 화·금 밤 9시(KST)** 에 '대기 중' 요청을 모아 짝을 고르고(pairRequests),
        확정은 SQL 함수 gating_commit_match 하나에 맡긴다(원자적 · 서버만 부를 수 있다).
        5분마다 도는 예약은 **만료 정리만** 한다. 정해진 시각에 한 번 공개하는 것은
        2026-09-21 개발자 결정이다(스탠퍼드 Date Drop·위밋 방식 — 대기열이 쌓여 짝의 질이 좋아지고
        기대감이 생긴다). 시각은 wrangler.toml 의 cron 과 아래 DROP_CRON 이 한 쌍이다.

   왜 이렇게 만들었나
   - 만능 열쇠는 **저장소에 절대 넣지 않는다.** `wrangler secret put` 으로만 넣는다.
   - 인증 번호는 **해시만** 저장한다(VERIFY_PEPPER 를 섞는다). 표를 통째로 읽어도 번호를
     모른다. 이메일 원문도 프로필에는 해시만 남긴다(같은 이메일로 계정 둘 인증 금지용).
   - 학교 **이름**은 data/school-domains.json 에 그 도메인이 있을 때만 적는다. 없으면
     null 로 두고 앱이 도메인을 그대로 보여 준다 — 지어내지 않는다(원칙 8-1).
     인증 자체는 ac.kr 이면 전부 된다(2026-09-21 개발자 결정). 그 표에 적힌 .edu
     (성균관·동국·인하)는 확인된 국내 대학이라 함께 받는다.
   - 짝 고르기는 **순수 함수**(pairRequests)다 — 검사가 그대로 불러 표로 잰다.

   받는 것
     POST /verify/send  { email }           Authorization: Bearer <학생 토큰>
     POST /verify/check { code }            Authorization: Bearer <학생 토큰>
     GET  /health
   예약: 5분마다 만료 정리 · 화·금 12:00 UTC(=21:00 KST) 에 매칭.

   필요한 설정(절차는 같은 폴더 README.md)
     변수  : APP_ORIGIN · ALLOW_ORIGIN · SUPABASE_URL · SUPABASE_ANON · MAIL_FROM
     시크릿: SUPABASE_SERVICE_ROLE · RESEND_KEY · VERIFY_PEPPER
   ============================================================ */

export const CODE_TTL_MS = 10 * 60 * 1000;   // 번호는 10분
export const CODE_MAX_ATTEMPTS = 5;            // 다섯 번 틀리면 새로 받아야 한다
export const SEND_PER_HOUR = 3;                // 한 시간에 세 번까지
export const SEND_GAP_MS = 60 * 1000;          // 연달아 보내기는 1분 간격
export const MATCH_PER_TICK = 20;              // 한 번 예약 실행에 확정하는 짝 수(무료 등급 외부 요청 50건/실행)
export const REMATCH_DAYS = 30;                // 같은 둘은 30일 안에 다시 짝짓지 않는다
/* 매칭을 맺는 예약 — wrangler.toml 의 둘째 cron 과 **글자까지 같아야** 한다(scheduled 가 이 문자열로 가른다) */
export const DROP_CRON = '0 12 * * 2,5';       // 화·금 12:00 UTC = 21:00 KST

/* ---------------- 유틸 ---------------- */
const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
  });

export function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOW_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.length === 0 || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? (origin || '*') : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* 여섯 자리 번호 — Math.random 이 아니라 암호학적 난수 */
export function makeCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}

/* ---------------- 학교 이메일 판정 ----------------
   돌려주는 것: { ok, domain, school } — school 은 표에 있을 때만, 없으면 null.
   ⚠️ 표에 없는 도메인을 학교 이름으로 **짐작하지 않는다.** */
export function parseSchoolEmail(email, domains) {
  const m = String(email || '').trim().toLowerCase().match(/^[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!m) return { ok: false, reason: 'bad_email' };
  const domain = m[1];
  const map = (domains && domains.domains) || domains || {};
  /* 표는 뿌리 도메인으로 적혀 있다 — 하위 도메인(mail.khu.ac.kr)도 그 학교다 */
  const hit = Object.keys(map).filter((d) => domain === d || domain.endsWith('.' + d)).sort((a, b) => b.length - a.length)[0];
  const isAcKr = domain === 'ac.kr' ? false : domain.endsWith('.ac.kr');
  if (!isAcKr && !hit) return { ok: false, reason: 'not_school', domain };
  return { ok: true, domain: hit || domain, school: hit ? map[hit] : null };
}

/* ---------------- Supabase 와 말하기 ---------------- */
function sbUrl(env, path) { return String(env.SUPABASE_URL || '').replace(/\/+$/, '') + path; }

/* 학생 토큰이 진짜인지 — Supabase 에 물어본다. 돌려주는 것: { id, email } 또는 null */
export async function userFromToken(env, token) {
  if (!token) return null;
  const res = await fetch(sbUrl(env, '/auth/v1/user'), {
    headers: { apikey: env.SUPABASE_ANON, Authorization: 'Bearer ' + token },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u && u.id ? { id: u.id, email: u.email || '' } : null;
}

/* 만능 열쇠로 표를 읽고 쓴다 — **이 파일 밖으로 이 헤더가 나가면 안 된다** */
async function sbService(env, path, opts) {
  const o = opts || {};
  const res = await fetch(sbUrl(env, path), {
    method: o.method || 'GET',
    headers: Object.assign({
      apikey: env.SUPABASE_SERVICE_ROLE,
      Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE,
      'Content-Type': 'application/json',
    }, o.headers || {}),
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* 본문이 JSON 이 아닐 수 있다 */ }
  return { ok: res.ok, status: res.status, body, text };
}

/* ---------------- 학교 도메인 표 (앱에서 읽는다 · 1시간 캐시) ---------------- */
let domainCache = { at: 0, map: null };
export async function loadDomains(env) {
  if (domainCache.map && Date.now() - domainCache.at < 3600 * 1000) return domainCache.map;
  try {
    const res = await fetch(String(env.APP_ORIGIN || '').replace(/\/+$/, '') + '/data/school-domains.json');
    if (res.ok) {
      const j = await res.json();
      domainCache = { at: Date.now(), map: j };
      return j;
    }
  } catch { /* 못 읽으면 빈 표 — 인증은 되고 학교 이름만 비게 된다 */ }
  return domainCache.map || { domains: {} };
}

/* ---------------- 메일 (Resend) ---------------- */
async function sendMail(env, to, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || '한대장 <noreply@example.com>',
      to: [to],
      subject: '[한대장] 과팅 학교 인증 번호',
      text: `한대장 과팅 학교 인증 번호는 ${code} 입니다.\n\n10분 안에 앱에 입력해 주세요. 본인이 요청하지 않았다면 이 메일은 무시해도 됩니다.`,
    }),
  });
  return res.ok;
}

/* ---------------- 인증: 보내기 ---------------- */
async function verifySend(env, user, body) {
  const email = String((body && body.email) || '').trim().toLowerCase();
  const domains = await loadDomains(env);
  const parsed = parseSchoolEmail(email, domains);
  if (!parsed.ok) return json({ error: parsed.reason === 'not_school' ? 'not_school' : 'bad_email' }, 400);

  /* 속도 제한 — 최근 한 시간 안의 발송 */
  const recent = await sbService(env,
    `/rest/v1/school_verifications?user_id=eq.${encodeURIComponent(user.id)}&sent_at=gte.${encodeURIComponent(new Date(Date.now() - 3600 * 1000).toISOString())}&select=sent_at&order=sent_at.desc`);
  const rows = Array.isArray(recent.body) ? recent.body : [];
  if (rows.length >= SEND_PER_HOUR) return json({ error: 'rate' }, 429);
  if (rows[0] && Date.now() - new Date(rows[0].sent_at).getTime() < SEND_GAP_MS) return json({ error: 'rate' }, 429);

  const code = makeCode();
  const ins = await sbService(env, '/rest/v1/school_verifications', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: {
      user_id: user.id, email,
      code_hash: await sha256(code + '|' + (env.VERIFY_PEPPER || '')),
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    },
  });
  if (!ins.ok) return json({ error: 'server', detail: ins.status }, 502);
  const sent = await sendMail(env, email, code);
  if (!sent) return json({ error: 'mail' }, 502);
  return json({ ok: true, domain: parsed.domain, school: parsed.school });
}

/* ---------------- 인증: 확인 ---------------- */
async function verifyCheck(env, user, body) {
  const code = String((body && body.code) || '').replace(/\D/g, '');
  if (code.length !== 6) return json({ error: 'bad_code' }, 400);
  const latest = await sbService(env,
    `/rest/v1/school_verifications?user_id=eq.${encodeURIComponent(user.id)}&consumed_at=is.null&order=sent_at.desc&limit=1`);
  const row = Array.isArray(latest.body) ? latest.body[0] : null;
  if (!row) return json({ error: 'no_code' }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: 'expired' }, 410);
  if (row.attempts >= CODE_MAX_ATTEMPTS) return json({ error: 'too_many' }, 429);

  const hash = await sha256(code + '|' + (env.VERIFY_PEPPER || ''));
  if (hash !== row.code_hash) {
    await sbService(env, `/rest/v1/school_verifications?id=eq.${row.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { attempts: (row.attempts || 0) + 1 },
    });
    return json({ error: 'wrong_code', left: CODE_MAX_ATTEMPTS - (row.attempts || 0) - 1 }, 400);
  }

  const domains = await loadDomains(env);
  const parsed = parseSchoolEmail(row.email, domains);
  const up = await sbService(env, '/rest/v1/gating_profiles?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: {
      user_id: user.id,
      school: parsed.school,
      verified_domain: parsed.domain,
      verified_at: new Date().toISOString(),
      school_email_hash: await sha256(String(row.email).toLowerCase() + '|' + (env.VERIFY_PEPPER || '')),
    },
  });
  if (up.status === 409) return json({ error: 'email_taken' }, 409);
  if (!up.ok) return json({ error: 'server', detail: up.status }, 502);

  /* 이 사람의 인증 행을 **전부 지운다** — 이메일 주소 원문이 남는 곳은 이 표뿐이라, 통과한 순간
     지우는 것이 약관("인증 뒤 이메일 주소를 저장하지 않는다")을 참으로 만드는 길이다(코드 리뷰). */
  await sbService(env, `/rest/v1/school_verifications?user_id=eq.${encodeURIComponent(user.id)}`, {
    method: 'DELETE', headers: { Prefer: 'return=minimal' },
  });
  return json({ ok: true, domain: parsed.domain, school: parsed.school });
}

/* ---------------- 매칭: 짝 고르기 (순수 함수) ----------------
   requests : [{ id, user_id, school, dept, gender, headcount, want_school, created_at }]
   blocks   : [{ blocker, blocked }]
   recent   : [{ user_a, user_b }]  — 최근 30일 안에 이미 짝이 됐던 둘
   돌려주는 것: [[idA, idB], …]  (created_at 순 · 결정적)

   규칙 (docs/designs/gating.md 「개발자 결정」)
     · 성별이 다르다 (남↔여만 — 2026-09-21 개발자 결정)
     · 학과가 다르거나 학교가 다르다 (같은 학교 같은 과끼리는 과팅이 아니다)
     · 인원 차가 1 이하
     · 희망 범위 양방향: 'same' 이면 상대 학교가 내 학교와 같아야 한다
     · 서로 차단한 사이 · 최근 짝이었던 사이는 제외
     · 점수: 인원이 같으면 +2 · 학교가 같으면 +1 · 희망 시간대가 같으면 +1(둘 다 '협의' 는 0).
       먼저 온 요청부터 가장 점수 높은 짝을 고른다 */
export function pairRequests(requests, blocks, recent) {
  const list = (requests || []).filter((r) => r && r.status !== 'cancelled' && r.status !== 'matched' && r.status !== 'expired')
    .slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || (a.id - b.id));
  const pairKey = (a, b) => [a, b].sort().join('|');
  const blocked = new Set((blocks || []).map((b) => pairKey(b.blocker, b.blocked)));
  const seen = new Set((recent || []).map((m) => pairKey(m.user_a, m.user_b)));
  const used = new Set();
  const out = [];
  for (const a of list) {
    if (used.has(a.id)) continue;
    let best = null, bestScore = -1;
    for (const b of list) {
      if (b.id === a.id || used.has(b.id)) continue;
      if (!a.user_id || !b.user_id || a.user_id === b.user_id) continue;
      if (!a.gender || !b.gender || a.gender === b.gender) continue;
      const sameSchool = !!a.school && a.school === b.school;
      if (sameSchool && (a.dept || '') === (b.dept || '')) continue;
      if (Math.abs((a.headcount || 0) - (b.headcount || 0)) > 1) continue;
      if (a.want_school === 'same' && !sameSchool) continue;
      if (b.want_school === 'same' && !sameSchool) continue;
      const k = pairKey(a.user_id, b.user_id);
      if (blocked.has(k) || seen.has(k)) continue;
      const sameWhen = !!a.when_pref && a.when_pref !== 'any' && a.when_pref === b.when_pref;
      const score = ((a.headcount === b.headcount) ? 2 : 0) + (sameSchool ? 1 : 0) + (sameWhen ? 1 : 0);
      if (score > bestScore) { best = b; bestScore = score; }
    }
    if (best) { used.add(a.id); used.add(best.id); out.push([a.id, best.id]); }
  }
  return out;
}

/* ---------------- 예약 실행: 만료 정리 → (공개 시각이면) 매칭 ---------------- */
export async function runScheduled(env, opts) {
  const doMatch = !!(opts && opts.match);
  const result = { expired: false, matched: doMatch, proposed: 0, committed: 0, errors: [] };
  const ex = await sbService(env, '/rest/v1/rpc/gating_run_expiry', { method: 'POST', body: {} });
  result.expired = ex.ok;
  if (!ex.ok) result.errors.push('expiry:' + ex.status);
  if (!doMatch) { lastRun = { at: new Date().toISOString(), ...result }; return result; }

  const [reqs, blocks, recent] = await Promise.all([
    sbService(env, '/rest/v1/gating_requests?status=eq.waiting&select=id,user_id,school,dept,gender,headcount,want_school,when_pref,created_at,status&order=created_at.asc&limit=500'),
    sbService(env, '/rest/v1/gating_blocks?select=blocker,blocked&limit=2000'),
    sbService(env, `/rest/v1/gating_matches?select=user_a,user_b&created_at=gte.${encodeURIComponent(new Date(Date.now() - REMATCH_DAYS * 86400 * 1000).toISOString())}&limit=2000`),
  ]);
  if (!reqs.ok) { result.errors.push('requests:' + reqs.status); return result; }
  const pairs = pairRequests(reqs.body || [], blocks.body || [], recent.body || []).slice(0, MATCH_PER_TICK);
  result.proposed = pairs.length;
  for (const [a, b] of pairs) {
    const c = await sbService(env, '/rest/v1/rpc/gating_commit_match', { method: 'POST', body: { a, b } });
    if (c.ok) result.committed++;
    else if (!/already_matched/.test(c.text || '')) result.errors.push(`commit ${a}-${b}:${c.status}`);
  }
  lastRun = { at: new Date().toISOString(), ...result };
  return result;
}
let lastRun = null;

/* ---------------- 요청 처리 ---------------- */
export default {
  async fetch(request, env) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    /* 앱이 아닌 곳에서 온 요청은 받지 않는다 (푸시 서버와 같은 규칙) */
    if (cors['Access-Control-Allow-Origin'] === 'null' && request.headers.get('Origin')) {
      return json({ error: 'origin' }, 403, cors);
    }
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, lastRun }, 200, cors);
    }
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);

    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    const user = await userFromToken(env, token);
    if (!user) return json({ error: 'login' }, 401, cors);

    let body = null;
    try { body = await request.json(); } catch { body = null; }

    let res;
    if (url.pathname === '/verify/send') res = await verifySend(env, user, body);
    else if (url.pathname === '/verify/check') res = await verifyCheck(env, user, body);
    else return json({ error: 'not_found' }, 404, cors);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },

  async scheduled(event, env, ctx) {
    /* 화·금 21시(KST) 예약만 짝을 맺는다. 5분짜리는 정리만. */
    ctx.waitUntil(runScheduled(env, { match: (event && event.cron) === DROP_CRON }));
  },
};
