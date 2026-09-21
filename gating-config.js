/* ============================================================
   한대장 — 과팅 서버 설정 (2026-09-21)
   ------------------------------------------------------------
   이 값이 비어 있으면 「과팅」 탭은 **"준비 중" 카드만** 보여 주고 서버에 아무것도 보내지
   않는다. server/gating/ 을 배포하고 그 주소를 채우면 그 순간부터 탭이 열린다.
   앱 코드는 더 고칠 것이 없다 (push-config.js · chat-config.js 와 같은 방식).

   채우는 방법은 `server/gating/README.md` (약 30분 · 무료).
     endpoint : 배포한 과팅 서버 주소 (예: https://handaejang-gating.○○○.workers.dev)

   ※ 여기에는 비밀값이 없다. 만능 열쇠(service_role)·메일 열쇠는 서버에만 둔다.
   ============================================================ */
const GATING_CONFIG = {
  endpoint: '',
};

/* 설정이 끝났는지 — gating.js 가 이 함수 하나로 판단한다 */
function gatingConfigured() {
  return !!(GATING_CONFIG.endpoint);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { GATING_CONFIG, gatingConfigured };
