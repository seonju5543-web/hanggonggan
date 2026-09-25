/* ============================================================
   ⚠️ **이 파일은 더 쓰지 않는다 (2026-09-25).** → `server/apply/` 를 쓸 것.

   왜 갈았나 — 이 워커는 클라이언트가 준 `to`·`subject`·`text` 를 **그대로 발송**한다.
   도메인 허용목록만 있어서, 변조된 클라이언트가 **아무 `.ac.kr` 주소로나** 우리 이름으로
   메일을 보낼 수 있고 자격을 조작한 신청서도 그대로 나간다(기술 고문 보고서 Q4).
   `server/apply/` 는 클라이언트에게서 **공고 id 와 프로필만** 받고, 받는 주소·마감·자격을
   앱과 **같은 엔진**으로 서버가 다시 판정한다(관문 `verify/verify-apply-guard.mjs`).

   🔴 지우지 않고 남겨 두는 이유: 이 꼴로 되돌아가지 않도록 **무엇이 문제였는지**를 남긴다.
   ============================================================ */
/* ============================================================
   한대장 — 완전 자동 접수 메일 서버 (Cloudflare Worker) — 옛 판
   앱의 [자동 접수] 버튼이 이 서버로 신청 내용을 보내면,
   서버가 사용자를 대신해 접수 메일을 발송한다.

   배포 절차 (개발자용, 총 10분):
   1. resend.com 무료 가입 → API 키 발급 (월 3,000통 무료)
   2. cloudflare.com 무료 가입 → Workers → 새 Worker 생성
   3. 이 파일 내용을 붙여넣고, 설정 → 환경변수에
      RESEND_KEY = (발급받은 키) 추가
   4. 배포된 주소(https://....workers.dev)를
      data.js 의 HANDAEJANG_CONFIG.mailEndpoint 에 입력
   ============================================================ */
export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': 'https://seonju5543-web.github.io',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });

    /* 남용 방지 ① — 앱에서 온 요청만 (Origin 검사: curl 등 직접 호출 차단) */
    const origin = req.headers.get('Origin') || '';
    if (origin !== 'https://seonju5543-web.github.io') {
      return new Response('forbidden', { status: 403, headers: cors });
    }

    const { to, subject, text, replyTo, attachments } = await req.json();
    if (!to || !subject || !text) return new Response('bad request', { status: 400, headers: cors });

    /* 남용 방지 ② — 수신자는 학교(.ac.kr)·장학재단 등 접수처 도메인만 (스팸 릴레이 차단).
       검사한 값(trim)과 실제 전송 값을 일치시켜 공백·개행이 낀 우회를 막는다. */
    const ALLOWED_TO = /^[^\s@]+@([a-z0-9-]+\.)*(ac\.kr|or\.kr|go\.kr|re\.kr)$/i;
    const toClean = typeof to === 'string' ? to.trim() : '';
    if (!ALLOWED_TO.test(toClean)) {
      return new Response('recipient not allowed', { status: 403, headers: cors });
    }

    /* 남용 방지 ③ — 크기 제한 (본문 100KB · 첨부 5개 각 5MB base64) */
    if (String(subject).length > 300 || String(text).length > 100_000) {
      return new Response('too large', { status: 413, headers: cors });
    }
    for (const a of (attachments || []).slice(0, 5)) {
      if (!a || typeof a.content !== 'string' || a.content.length > 7_000_000) {
        return new Response('attachment too large', { status: 413, headers: cors });
      }
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '한대장 접수대행 <apply@handaejang.app>', // Resend에서 발신 도메인 인증 필요
        to: [toClean],
        reply_to: replyTo,
        subject,
        text,
        attachments: (attachments || []).slice(0, 5), // [{filename, content(base64)}]
      }),
    });
    return new Response(await r.text(), { status: r.status, headers: cors });
  },
};
