/* ============================================================
   한대장 — 완전 자동 접수 메일 서버 (Cloudflare Worker)
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

    const { to, subject, text, replyTo, attachments } = await req.json();
    if (!to || !subject || !text) return new Response('bad request', { status: 400, headers: cors });

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: '한대장 접수대행 <apply@handaejang.app>', // Resend에서 발신 도메인 인증 필요
        to: [to],
        reply_to: replyTo,
        subject,
        text,
        attachments: (attachments || []).slice(0, 5), // [{filename, content(base64)}]
      }),
    });
    return new Response(await r.text(), { status: r.status, headers: cors });
  },
};
