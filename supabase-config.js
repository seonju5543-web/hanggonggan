/* ============================================================
   한대장 — 회원가입·로그인 설정 (기기를 바꿔도 이어쓰기)
   ------------------------------------------------------------
   이 두 값이 비어 있으면 **로그인 기능이 화면에 아예 안 나온다.**
   지금까지처럼 게스트로 쓰는 앱 그대로다(아무것도 달라지지 않음).
   값을 채우면 그 순간부터 가입·로그인·기기 간 이어쓰기가 켜진다 — 앱 코드는 고칠 게 없다.
   (푸시 알림 push-config.js · 도우미 chat-config.js 와 똑같은 방식이다.)

   채우는 법 (10분):
     ① https://supabase.com 가입 → New project (지역은 Northeast Asia (Seoul) 권장)
     ② 프로젝트 → Settings → API Keys 에서 두 값을 복사
          url     : Project URL  (예: https://abcdefgh.supabase.co)
          anonKey : **Publishable key** (`sb_publishable_…` 로 시작)
                    ⚠️ Supabase 가 2025년에 열쇠 이름을 바꿨다. 예전 이름은 'anon public'
                       (`eyJ…` 로 시작)이고 지금은 'Publishable key'다. **둘 다 동작한다** —
                       옛 열쇠는 'Legacy anon, service_role API keys' 탭에 아직 있다.
                       칸 이름을 anonKey 로 둔 것은 하는 일이 같아서다.
     ③ SQL Editor 에 `supabase/migrations/0001_profiles.sql` 내용을 붙여넣고 실행
     ④ 아래 두 칸을 채우고 배포

   ⚠️ anonKey 는 **공개해도 되는 열쇠**다 — 브라우저에 그대로 나가는 값이라 숨길 수가 없다.
      진짜 방어선은 DB 쪽 접근 규칙(RLS)이다: '자기 행만' 정책이 걸려 있어서, 이 열쇠를
      들고 있어도 남의 프로필은 못 읽는다. 0001_profiles.sql 에 그 정책이 들어 있다.
   🔴 `service_role` 열쇠는 **절대** 이 파일이나 저장소에 넣지 말 것 — 그건 모든 규칙을
      무시하는 만능 열쇠라, 공개 저장소에 올리면 누구나 전체 회원 정보를 읽고 지울 수 있다.
   ============================================================ */
const SUPABASE_CONFIG = {
  url: 'https://ffnzmiorcojbhpqwqgcy.supabase.co',
  anonKey: 'sb_publishable_kWvjVknBPO8V6ktPEHOlvA_-CTXhCAA',

  /* 소셜 로그인 — 여기 적은 것만 화면에 버튼으로 나온다. **비워 두면 소셜 버튼이 없다.**
     ⚠️ 여기에 적는 것만으로는 안 되고, Supabase 대시보드에서 그 제공자를 켜고
        구글/카카오 쪽에서 발급받은 열쇠를 넣어야 실제로 동작한다:
          Authentication → Providers → Google / Kakao → Enable + Client ID·Secret
        그리고 Authentication → URL Configuration 에 아래 두 곳을 등록해야 돌아온다:
          Site URL          https://seonju5543-web.github.io/hanggonggan/
          Redirect URLs     https://seonju5543-web.github.io/hanggonggan/
     쓸 수 있는 값: 'google' · 'kakao' (Supabase 가 공식 지원한다) */
  providers: ['google'],
  /* 🔴 카카오를 붙이려면 (2026-08-25 여기까지 해 둠 — 남은 것은 아래 넷뿐)
     ① developers.kakao.com 앱 '한대장'(ID 1556646)은 **이미 만들어져 있고**
        제품 설정 → 카카오 로그인 → 사용 설정 = ON 까지 되어 있다.
     ② 남은 것: 앱 설정 → 플랫폼 → Web 등록에 사이트 도메인
          https://ffnzmiorcojbhpqwqgcy.supabase.co
        ⚠️ 이걸 먼저 해야 Redirect URI 칸이 **나타난다**(안 하면 안 보인다 — 여기서 막혔다).
     ③ 그다음 카카오 로그인 → 일반 → Redirect URI 에
          https://ffnzmiorcojbhpqwqgcy.supabase.co/auth/v1/callback
        동의항목: profile_nickname · profile_image (이메일은 비즈 앱만 가능)
        보안 → Client Secret 생성하고 '사용함'으로
     ④ Supabase → Providers → Kakao 에 REST API 키(=Client ID)와 Client Secret 을 넣고,
        🔴 **'Allow users without an email' 을 켠다** — 카카오는 이메일을 안 주므로
           안 켜면 로그인이 실패한다(공식 문서 확인).
        마지막으로 위 providers 를 ['google', 'kakao'] 로 고친다.
     ⚠️ 앱 코드는 이미 카카오를 지원한다(동그란 아이콘 포함). 고칠 것은 위 한 줄뿐이다. */

  /* 저장을 서버로 보내기 전에 기다리는 시간(밀리초).
     온보딩에서 한 칸 고칠 때마다 서버를 두들기면 무료 등급이 금방 닳는다 — 묶어서 한 번 보낸다. */
  pushDelayMs: 2000,
  timeoutMs: 8000,
};

/* 🔴 비밀번호 재설정 메일에 대해 반드시 알아야 하는 것 (2026-08-25 공식 문서 확인)
   ------------------------------------------------------------------
   Supabase 가 기본으로 주는 메일 발송기는 **구경용**이다:
     · 시간당 **2통**
     · **프로젝트 팀원이 아닌 주소로는 아예 발송을 거부한다**
   즉 별도 메일 서버(SMTP)를 연결하기 전에는 **학생에게 재설정 메일이 가지 않는다.**
   개발자 본인 계정으로 시험해 보는 것까지만 된다.

   같은 이유로 **가입 확인 메일도 안 간다.** 베타 동안에는 대시보드에서
     Authentication → Sign In / Providers → Email → "Confirm email" 을 **꺼 두는 것**을
   권한다. 안 끄면 가입한 학생이 메일을 못 받아 로그인 자체를 못 한다.

   실제로 학생을 받기 전에 할 일: Authentication → Emails → SMTP Settings 에
   메일 서버(Resend·SendGrid·AWS SES 등)를 연결한다. 연결하면 위 두 제약이 사라진다.
   ------------------------------------------------------------------ */

/* 로그인 기능을 쓸 수 있는 상태인가 — 앱 곳곳에서 이 함수로만 판단한다 */
function supabaseConfigured() {
  return !!(SUPABASE_CONFIG && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPABASE_CONFIG, supabaseConfigured };
}
