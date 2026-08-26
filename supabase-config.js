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
  /* 🔴 카카오 — 설정은 다 됐는데 **켤 수 없다** (2026-08-26).
     한 줄 요약: 카카오는 이메일을 비즈 앱에만 주는데, Supabase 는 이메일을 반드시 요청한다.

     막힌 지점 (재조사 금지 — 실측으로 확인했다)
     · Supabase 의 카카오 provider 는 `account_email profile_image profile_nickname` 을
       **고정으로** 요청한다. authorize 에 `scopes=` 를 줘도 **덧붙기만 하고 빠지지 않는다**
       (직접 시험: scopes=profile_nickname → account_email+profile_image+profile_nickname+profile_nickname).
       즉 **앱 코드로는 이메일 요청을 뺄 수 없다.**
     · 카카오 동의항목에서 `account_email` 은 **권한 없음**(회색)이라 켤 수가 없다.
       비즈 앱 전환이 필요하고, 그건 보통 사업자 정보 등록을 요구한다.
       (제품 설정 → 비즈니스 인증 → '추가 기능 신청'이 그 문이다.)
     · 결과: 학생이 카카오를 누르면 "서비스 설정에 오류가 있어 이용할 수 없습니다"가 뜬다.
       그래서 providers 에서 'kakao' 를 뺐다 — 안 되는 버튼을 띄우지 않는다.

     🟢 카카오 쪽 설정은 **이미 다 되어 있다.** 비즈 앱이 되면 아래 한 줄만 고치면 끝난다.
        providers: ['google'] → ['google', 'kakao']
        · 앱: developers.kakao.com '한대장' (ID 1556646)
        · 카카오 로그인 사용 설정 ON · 리디렉션 URI 등록 완료 · 클라이언트 시크릿 활성화
        · 동의항목: 닉네임 필수 동의 · 프로필 사진 선택 동의 (이메일만 못 켠 상태)
        · Supabase Providers → Kakao 에 키 두 개 등록 완료 + Allow users without an email ON
        ⚠️ Supabase 칸에 키를 다시 넣을 일이 생기면, 브라우저 자동완성이 **구글 Client ID를
           카카오 칸에 몰래 채워 넣은 적이 있다.** 저장 뒤 /auth/v1/authorize?provider=kakao 를
           따라가 client_id 를 눈으로 확인할 것 — 실제로 첫 저장이 그렇게 조용히 잘못됐다.

     · 다른 길(안 해 봄): Supabase 커스텀 OIDC 제공자로 카카오를 직접 등록하면 scope 를
       우리가 정할 수 있어 이메일 없이도 될 수 있다(무료 등급 3개까지). 카카오 쪽
       'OpenID Connect' 를 켜야 한다. 비즈 앱 전환이 막히면 이 길을 검토할 것. */

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
