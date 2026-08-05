/* ============================================================
   한대장 — 진짜 푸시 설정 (앱을 켜지 않아도 폰에 오는 알림)
   ------------------------------------------------------------
   이 두 값이 비어 있으면 앱은 **지금까지처럼 로컬 알림만** 쓴다(아무것도 달라지지 않음).
   발송 서버(server/push/)를 배포하고 아래 두 값을 채우면, 그 순간부터
   "앱을 안 켜도 폰에 오는 알림"이 켜진다. 앱 코드는 더 고칠 것이 없다.

   채우는 방법은 `server/push/README.md`에 그림처럼 적어 뒀다(10~15분).
     endpoint  : 배포한 발송 서버 주소 (예: https://handaejang-push.○○○.workers.dev)
     publicKey : VAPID 공개키 (server/push/gen-vapid.mjs가 만들어 준다)

   ※ 공개키는 말 그대로 '공개'해도 되는 값이다. 짝이 되는 **비밀키는 서버에만** 두고
     절대 이 파일이나 저장소에 넣지 않는다.
   ============================================================ */
const PUSH_CONFIG = {
  /* 2026-08-06 켬 — Cloudflare Workers 무료 등급에 올린 발송 서버 (server/push/) */
  endpoint: 'https://handaejang-push.seonju5543.workers.dev',
  publicKey: 'BJMGCfswqdi9diGUsfOGyMTyi1bwNDt5uTh0i0OUeTGMiovXJpSvIRVHig7wxi_5ov3uviZtrAfbkrUckEHhpc4',
};

/* 설정이 끝났는지 — 앱 곳곳에서 이 함수로 판단한다 */
function pushConfigured() {
  return !!(PUSH_CONFIG.endpoint && PUSH_CONFIG.publicKey);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { PUSH_CONFIG, pushConfigured };
