/* ============================================================
   한대장 — 회원가입·로그인 설정 (기기를 바꿔도 이어쓰기)
   ------------------------------------------------------------
   이 두 값이 비어 있으면 **로그인 기능이 화면에 아예 안 나온다.**
   지금까지처럼 게스트로 쓰는 앱 그대로다(아무것도 달라지지 않음).
   값을 채우면 그 순간부터 가입·로그인·기기 간 이어쓰기가 켜진다 — 앱 코드는 고칠 게 없다.
   (푸시 알림 push-config.js · 도우미 chat-config.js 와 똑같은 방식이다.)

   채우는 법 (10분):
     ① https://supabase.com 가입 → New project (지역은 Northeast Asia (Seoul) 권장)
     ② 프로젝트 → Settings → API 에서 두 값을 복사
          url     : Project URL      (예: https://abcdefgh.supabase.co)
          anonKey : anon public key  (eyJ… 로 시작하는 긴 글자)
     ③ SQL Editor 에 `supabase/migrations/0001_profiles.sql` 내용을 붙여넣고 실행
     ④ 아래 두 칸을 채우고 배포

   ⚠️ anonKey 는 **공개해도 되는 열쇠**다 — 브라우저에 그대로 나가는 값이라 숨길 수가 없다.
      진짜 방어선은 DB 쪽 접근 규칙(RLS)이다: '자기 행만' 정책이 걸려 있어서, 이 열쇠를
      들고 있어도 남의 프로필은 못 읽는다. 0001_profiles.sql 에 그 정책이 들어 있다.
   🔴 `service_role` 열쇠는 **절대** 이 파일이나 저장소에 넣지 말 것 — 그건 모든 규칙을
      무시하는 만능 열쇠라, 공개 저장소에 올리면 누구나 전체 회원 정보를 읽고 지울 수 있다.
   ============================================================ */
const SUPABASE_CONFIG = {
  url: '',
  anonKey: '',

  /* 저장을 서버로 보내기 전에 기다리는 시간(밀리초).
     온보딩에서 한 칸 고칠 때마다 서버를 두들기면 무료 등급이 금방 닳는다 — 묶어서 한 번 보낸다. */
  pushDelayMs: 2000,
  timeoutMs: 8000,
};

/* 로그인 기능을 쓸 수 있는 상태인가 — 앱 곳곳에서 이 함수로만 판단한다 */
function supabaseConfigured() {
  return !!(SUPABASE_CONFIG && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, supabaseConfigured };
}
