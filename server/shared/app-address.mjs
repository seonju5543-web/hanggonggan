/* ============================================================
   앱 주소 — 한 곳 (2026-11-14 · 은서 · 출시 준비: 앱 주소 옮기기 3단계)
   ------------------------------------------------------------
   서버(push·chat·essay·apply)와 인스타 게시 로봇·실제 앱 점검 로봇이 모두 이 값을 쓴다.
   예전엔 여덟 군데에 글자로 박혀 있어, 도메인을 옮길 때 하나만 빠져도 그 기능이 조용히 깨질 구조였다.

   🔴 도메인을 옮길 때 — 아래 두 줄을 바꾸고, 같은 커밋에서:
     ① server/push/wrangler.toml 의 APP_ORIGIN·ALLOW_ORIGIN (설정 파일이라 이 파일을 못 불러온다 — 관문이 같은지 대조)
     ② Supabase › Authentication › URL Configuration 의 Site URL·Redirect URLs 에 새 주소 추가(옛 주소는 옮긴 뒤 한동안 둔다)
     ③ 서버 다시 배포(push-deploy.yml) · 옛 주소에 '새 주소로 이동' 안내
     → 사람이 할 일 전체는 docs/backend/사고-대응.md 가 아니라 출시 준비 목록(도메인 단계)을 따른다.
   관문: verify/health-gates/ops.mjs 「⑪ 앱 주소 한 곳」 — 이 파일 밖 실행 코드에 앱 주소 글자가 다시 생기면 실패
   ============================================================ */
export const APP_ORIGIN = 'https://seonju5543-web.github.io';   // 브라우저가 보내는 Origin(CORS 대조)
export const APP_BASE = `${APP_ORIGIN}/hanggonggan`;             // 앱이 열리는 주소(링크·알림 클릭)
