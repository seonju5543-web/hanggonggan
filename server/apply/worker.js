/* ============================================================================
   한대장 — 접수 대행 메일 서버 (Cloudflare Worker · 배포 대기)

   `server/mail-worker.js` 를 대신한다. 달라진 것은 하나다 —
   🔴 **보낼지 말지를 서버가 다시 판단한다**(기술 고문 보고서 Q4).

   옛 워커는 클라이언트가 준 `to`·`subject`·`text` 를 그대로 보냈다. 도메인 허용목록만
   있어서, 변조된 클라이언트가 **아무 `.ac.kr` 주소로나** 우리 이름으로 메일을 보낼 수 있었고
   자격을 조작한 신청서도 그대로 나갔다.

   지금은 클라이언트가 **공고 id 와 프로필만** 준다. 받는 주소·마감·자격은 서버가
   우리 발행물(`data/registered.json`)과 앱과 **같은 엔진**으로 다시 본다(apply-guard.mjs).

   🔴 **열쇠가 없으면 아예 안 뜬다** — `RESEND_KEY` 가 없으면 503 이다. '보내는 척'을 하지 않는다.

   배포:
     npx wrangler deploy                      (server/apply 에서)
     npx wrangler secret put RESEND_KEY
   끄기: 그냥 배포하지 않으면 된다. 앱은 이 주소가 비면 버튼을 안 낸다.
   ========================================================================== */
import { validateSubmission } from './apply-guard.mjs';
import { recordSend, applyWebhook, verifySvix, logConfigured, resolveUser, loadProfile } from './send-log.mjs';

const APP_ORIGIN = 'https://seonju5543-web.github.io';
/* 발행물은 앱과 같은 곳에서 읽는다 — 사본을 서버에 두면 두 벌이 되어 갈라진다. */
const REGISTERED_URL = APP_ORIGIN + '/hanggonggan/data/registered.json';

/* 발행물을 매 요청마다 받지 않는다(하루 몇 번 바뀐다). ⚠️ 워커 인스턴스는 언제든 죽으므로
   이 캐시는 '있으면 빠르다' 일 뿐, 없다고 동작이 달라지면 안 된다. */
let cached = { at: 0, data: null };
const CACHE_MS = 5 * 60 * 1000;

async function loadRegistered() {
  if (cached.data && Date.now() - cached.at < CACHE_MS) return cached.data;
  const r = await fetch(REGISTERED_URL, { cf: { cacheTtl: 300 } });
  if (!r.ok) return null;                      // 🔴 못 받으면 null → 아래에서 막는다(보내지 않는다)
  const data = await r.json();
  cached = { at: Date.now(), data };
  return data;
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': APP_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      /* 🔴 `Authorization` 이 없으면 브라우저가 **그 헤더를 아예 안 보낸다**(preflight 에서 걸린다)
         → 서버가 학생을 못 알아보고 늘 401 이 된다. 2026-09-26 에 로그인 확인을 붙이면서 같이 열었다. */
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const say = (code, obj) => new Response(JSON.stringify(obj),
      { status: code, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return say(405, { why: 'POST only' });

    /* ── 바운스·도착 알림 (Resend → 우리) ──────────────────────────────────
       🔴 앱이 부르는 곳과 **다른 경로**다. Origin 검사를 걸면 안 된다 — 브라우저가 아니라
          Resend 서버가 부르므로 Origin 이 없다. 대신 **서명**으로 확인한다.
       🔴 서명을 못 맞추면 401 이고 장부를 건드리지 않는다 — 아무나 '도착했다'로 바꿀 수
          있으면 증빙이 증빙이 아니다. */
    if (new URL(req.url).pathname.replace(/\/+$/, '').endsWith('/resend-hook')) {
      const raw = await req.text();
      if (!await verifySvix(env.RESEND_WEBHOOK_SECRET, req.headers, raw)) {
        return new Response('unauthorized', { status: 401 });
      }
      let ev; try { ev = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
      const r = await applyWebhook(env, ev);
      /* ⚠️ 우리 장부 사정으로 200 이 아니면 Resend 가 계속 되보낸다 — 알 수 없는 사건은
         '받았다'로 닫고(200), 우리가 못 적은 것만 500 으로 남겨 다시 받는다. */
      return new Response(r.ok ? 'ok' : (r.why || 'skip'),
        { status: r.ok || r.why === '모르는 사건' ? 200 : 500 });
    }
    if ((req.headers.get('Origin') || '') !== APP_ORIGIN) return say(403, { why: 'forbidden' });
    if (!env.RESEND_KEY) return say(503, { why: '아직 접수 대행이 켜지지 않았습니다' });
    /* 🔴 **발신 주소를 코드에 박지 않는다** (2026-09-26). 박아 두면 그 도메인의 SPF·DKIM·DMARC
       를 세워 두지 않은 채 배포하게 되고, 그러면 받는 쪽이 스팸으로 버리거나 통째로 반송한다
       — 그리고 그 실패는 **학생에게 조용하다.** 인증을 마친 도메인을 시크릿으로 넣는다.
       세우는 법은 server/apply/README.md. */
    if (!env.APPLY_FROM) return say(503, { why: '발신 도메인이 아직 준비되지 않았습니다' });

    /* 🔴 증빙을 남길 수 없으면 대신 보내지 않는다 — '보냈는지 모르는 발송'을 만들지 않는다. */
    if (!logConfigured(env)) return say(503, { why: '발송 기록을 남길 수 없어 보내지 않았습니다' });
    const userId = await resolveUser(env, req.headers.get('Authorization'));
    if (!userId) return say(401, { why: '로그인이 필요합니다 (누가 냈는지 기록해야 합니다)' });

    let payload;
    try { payload = await req.json(); } catch { return say(400, { why: '읽을 수 없는 요청' }); }

    const registered = await loadRegistered();
    if (!registered) return say(503, { why: '공고 목록을 확인할 수 없어 보내지 않았습니다' });

    /* 🔴 **프로필은 우리 사본을 읽는다** — 요청에 온 프로필은 쓰지 않는다(변조 가능).
       없으면 409 로 돌려보내 앱이 한 번 올리고 다시 부르게 한다(422 와 구분되는 신호다). */
    const held = await loadProfile(env, userId);
    if (!held) return say(409, { code: 'no_profile',
      why: '프로필이 서버에 올라와 있지 않습니다 (앱에서 저장한 뒤 다시 시도해 주세요)' });

    /* 🔴 여기가 관문이다. 통과 못 하면 **어떤 경로로도** 아래로 못 내려간다. */
    const v = validateSubmission(payload, registered, null, held);
    if (!v.ok) return say(v.code === 'no_profile' ? 409 : 422,
      { code: v.code || null, why: v.why, status: v.status || null });

    /* 본문은 클라이언트가 쓴다(학생이 쓴 글이라 서버가 지어낼 수 없다). 다만 크기는 막는다. */
    const subject = String(payload.subject || '').slice(0, 300);
    const text = String(payload.text || '');
    if (!subject || !text) return say(400, { why: '제목·본문이 비었습니다' });
    if (text.length > 100_000) return say(413, { why: '본문이 너무 큽니다' });
    const attachments = (payload.attachments || []).slice(0, 5);
    for (const a of attachments) {
      if (!a || typeof a.content !== 'string' || a.content.length > 7_000_000) {
        return say(413, { why: '첨부가 너무 큽니다' });
      }
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.APPLY_FROM,        // 🔴 SPF·DKIM·DMARC 를 세워 둔 도메인만 (README)
        to: [v.to],                  // 🔴 서버가 고른 주소 — 클라이언트가 준 값이 아니다
        reply_to: payload.replyTo,
        subject, text, attachments,
      }),
    });
    const body = await r.text();
    let sent = null; try { sent = JSON.parse(body); } catch { /* Resend 가 JSON 을 안 줄 수도 있다 */ }

    /* 🔴 **보낸 뒤에** 적는다 — 안 보낸 것을 보냈다고 적는 게 더 나쁘다.
       실패했으면 실패로 적는다(학생이 '냈다'고 착각하는 것을 막는 자리다). */
    const logged = await recordSend(env, {
      userId, noticeId: v.notice.id, to: v.to, subject,
      providerId: sent && sent.id, status: r.ok ? 'queued' : 'failed',
      detail: r.ok ? null : body.slice(0, 500),
    });

    /* ⚠️ 기록이 안 됐다고 발송을 되돌리지 않는다(되돌릴 수도 없다) — 조용히 넘기지 않고 알린다. */
    return say(r.status, r.ok
      ? { ok: true, id: sent && sent.id, logged }
      : { ok: false, why: '발송에 실패했습니다', logged });
  },
};
