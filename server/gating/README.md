# 과팅 서버 켜기 — 개발자가 할 일 (약 30분, 무료)

> **이걸 하고 나면**: 앱의 「과팅」 탭에서 학생이 학교 이메일로 인증하고, 글을 올리고,
> 앱이 짝을 맞춰 주고, 앱 안에서 1:1 로 대화할 수 있습니다.
> 이걸 하기 전까지 탭은 "준비 중" 카드만 보여 주고 서버에 아무것도 보내지 않습니다.

---

## 왜 서버가 하나 더 필요한가 (1분 설명)

과팅은 이 앱에서 **처음으로 학생끼리 서로를 보는 기능**입니다. 그래서 두 가지가 새로 필요합니다.

- **학교 이메일 인증** — "정말 그 학교 학생인가"를 확인해야 합니다. 인증 번호를 메일로 보내고
  맞게 적었는지 확인한 뒤 "인증됐다"고 표에 적는 일은 **만능 열쇠**가 있어야 하는데,
  만능 열쇠는 앱(브라우저)에 둘 수 없습니다. 그래서 작은 서버가 대신합니다.
- **짝 맞추기** — 매주 화·금 밤 9시에 대기 중인 요청을 모아 짝을 고릅니다(5분마다 도는 것은 만료 정리뿐). 사람이 없어도 돌아야 하니 서버의 몫입니다.

특징:
- **무료**입니다 (Cloudflare 무료 등급 · Resend 무료 등급 월 3,000통 · Supabase 무료 등급)
- **저장하는 것이 적습니다** — 인증 번호는 해시만, 학교 이메일도 해시만 남습니다.
  채팅은 Supabase 표에 남고 학생이 방을 나가거나 탈퇴하면 지워집니다.

---

## 준비물

- **Supabase** 프로젝트 (이미 있음 — 로그인이 쓰는 그 프로젝트)
- **Cloudflare 계정** (이미 있음 — 푸시 서버가 쓰는 그 계정)
- **Resend 계정** (새로 — https://resend.com · 무료)

---

## 1단계 — Supabase 에 표 만들기 (2분)

1. Supabase 대시보드 → 왼쪽 **SQL Editor** → **New query**
2. 저장소의 `supabase/migrations/0003_gating.sql` 파일 내용을 **통째로** 붙여넣고 **Run**
3. 아래에 "Success. No rows returned" 가 나오면 끝

> 🔴 이 파일이 만드는 규칙(RLS)이 남의 채팅을 못 보게 하는 **유일한** 장치입니다.
> 대시보드에서 표를 손으로 고치지 마세요. 고칠 일이 생기면 `0004_….sql` 을 새로 만듭니다.

## 2단계 — 만능 열쇠 복사 (1분)

Supabase 대시보드 → **Settings → API** → **service_role** 옆의 **Reveal** → 복사해 둡니다.

> 🔴 이 값은 **어디에도 적지 마세요** (GitHub · 노션 · 채팅 전부). 4단계에서 명령 한 줄로 서버에만 넣습니다.
> 실수로 올렸다면 같은 화면의 **Reset** 으로 새로 만들면 됩니다.

## 3단계 — Resend (메일 보내는 곳) (10분)

1. https://resend.com 가입
2. **Domains → Add Domain** 에 메일을 보낼 도메인을 넣습니다 (예: `handaejang.kr` — 도메인이 있어야 합니다).
   화면에 나오는 DNS 기록(TXT·MX·DKIM 3~4줄)을 도메인을 산 곳(가비아 등)에 그대로 붙여넣고 **Verify**
   - 도메인이 아직 없으면: Resend 는 **가입한 본인 이메일로만** 발송해 줍니다. 본인 폰으로
     시험해 보는 것까지는 되고, 다른 학생에게는 안 갑니다. 공개 전에 도메인을 붙이세요.
3. **API Keys → Create** → 복사해 둡니다
4. `server/gating/wrangler.toml` 의 `MAIL_FROM` 을 그 도메인 주소로 고칩니다 (예: `한대장 <noreply@handaejang.kr>`)

## 4단계 — 서버 올리기 (5분)

```bash
cd server/gating

# ① Cloudflare 로그인 (이미 돼 있으면 건너뜀)
npx wrangler login

# ② 올리기
npx wrangler deploy

# ③ 비밀값 셋 — 한 줄씩 실행하면 값을 물어봅니다 (화면에 안 보입니다)
npx wrangler secret put SUPABASE_SERVICE_ROLE     # 2단계 값
npx wrangler secret put RESEND_KEY                # 3단계 값
npx wrangler secret put VERIFY_PEPPER             # 아무 긴 무작위 문자열 — 아래 명령으로 만들어 붙여넣기
#   node -e "console.log(require('crypto').randomUUID()+require('crypto').randomUUID())"
```

②에서 나온 주소(예: `https://handaejang-gating.seonju5543.workers.dev`)를 복사해 둡니다.

## 5단계 — 확인 (1분)

브라우저에서 `그 주소/health` 를 엽니다 → `{"ok":true,…}` 가 나오면 서버가 살아 있는 것입니다.

## 6단계 — 앱에 주소 적기 (1분)

저장소의 `gating-config.js` 를 열어 `endpoint: ''` 의 따옴표 안에 4단계 주소를 넣고 배포합니다
(이 기기에서 배포: `deploy/run-deploy.txt` 의 `branch:` 줄). 그 순간부터 탭이 열립니다.

## 7단계 — 직접 해 보기

앱 → 과팅 탭 → 로그인 → 본인 학교 이메일(ac.kr)로 번호 받기 → 6자리 입력 → 닉네임·학과·성별.
메일이 안 오면 **스팸함**을 보고, 거기에도 없으면 3단계 DNS 기록(특히 DKIM)이 Verified 인지 봅니다.

---

## 자주 묻는 것

- **비용은?** 학생 1,000명이 하루 10번 앱을 열어도 Cloudflare 무료 한도(하루 10만 요청) 안입니다.
  인증 메일은 학생당 한 번이라 Resend 무료(월 3,000통)로 충분합니다.
- **무엇이 저장되나?** `docs/designs/gating.md` 와 `terms.html` 제2부 2번 표에 전부 적혀 있습니다.
- **신고가 들어오면?** Supabase 대시보드 → Table Editor → `gating_reports` 에서 봅니다.
  같은 글에 3명이 신고하면 글은 자동으로 감춰집니다(`status = hidden`).
- **끄고 싶으면?** `gating-config.js` 의 `endpoint` 를 다시 `''` 로 비우고 배포하면 탭이 "준비 중"으로 돌아갑니다.
  서버를 내리는 것은 `npx wrangler delete`.
