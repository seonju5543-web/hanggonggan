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
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const say = (code, obj) => new Response(JSON.stringify(obj),
      { status: code, headers: { ...cors, 'content-type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return say(405, { why: 'POST only' });
    if ((req.headers.get('Origin') || '') !== APP_ORIGIN) return say(403, { why: 'forbidden' });
    if (!env.RESEND_KEY) return say(503, { why: '아직 접수 대행이 켜지지 않았습니다' });

    let payload;
    try { payload = await req.json(); } catch { return say(400, { why: '읽을 수 없는 요청' }); }

    const registered = await loadRegistered();
    if (!registered) return say(503, { why: '공고 목록을 확인할 수 없어 보내지 않았습니다' });

    /* 🔴 여기가 관문이다. 통과 못 하면 **어떤 경로로도** 아래로 못 내려간다. */
    const v = validateSubmission(payload, registered);
    if (!v.ok) return say(422, { why: v.why, status: v.status || null });

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
        from: '한대장 접수대행 <apply@handaejang.app>',   // Resend 에서 발신 도메인 인증 필요
        to: [v.to],                                      // 🔴 서버가 고른 주소
        reply_to: payload.replyTo,
        subject, text, attachments,
      }),
    });
    return new Response(await r.text(), { status: r.status, headers: cors });
  },
};
