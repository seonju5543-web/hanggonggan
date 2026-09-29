# 접수 대행 서버 — 켜는 법 (2026-09-26)

> 지금은 **꺼져 있다.** 앱의 메일 버튼은 `mailto:` 라 학생 폰의 메일 앱이 열리고 학생이 직접 보낸다.
> 이 서버를 켜면 **우리가 보내는 주체가 된다** — 그래서 아래 순서를 건너뛰지 말 것.
>
> 🔴 순서가 규칙이다. ①DNS → ②시크릿 → ③표 → ④배포 → ⑤웹훅 → ⑥한 통 실측.
> 어느 하나라도 빠지면 **조용히 실패한다**(받는 쪽이 스팸으로 버리거나, 반송을 아무도 모른다).

---

## ⓪ 먼저 — **우리 도메인이 필요하다** (지금 없다)

🔴 저장소를 세어 보면 우리 것은 전부 **남의 도메인에 얹힌 주소**다 —
`seonju5543.github.io` · `hanggonggan-admin.pages.dev` · `handaejang-push.seonju5543.workers.dev`.
`handaejang.kr`·`handaejang.app` 은 이 문서와 옛 워커의 **예시**일 뿐 우리 것이 아니다.

**왜 필요한가**: ①의 세 레코드는 *"이 서버가 우리 도메인 대신 메일을 보내도 된다"* 를
적는 것이다. 그 도메인의 DNS 를 고칠 수 있어야 적을 수 있고, 고칠 수 있다는 것이
곧 **우리 도메인이라는 뜻**이다. `github.io`·`workers.dev` 는 남의 것이라 손댈 수 없다.

- 유료다(등록처마다 다르다 — 사기 전에 값을 확인할 것).
- ⚠️ **Cloudflare 에서 사거나 DNS 를 Cloudflare 로 옮기는 것을 권한다** — 푸시 서버·관리자
  화면이 이미 그 계정에 있어, ①의 레코드를 워커와 **같은 화면**에서 넣을 수 있다.
- 도메인이 정해지기 전에는 ① 이후를 할 수 없다. 이 서버는 그동안 꺼진 채로 둔다
  (앱은 `mailto:` 로 학생이 직접 보내는 길이 그대로 살아 있다).

## ① 발신 도메인 인증 — SPF · DKIM · DMARC

**왜 이게 먼저인가.** 인증 없이 보내면 학교·재단 메일 서버가 우리 메일을 **스팸으로 버리거나
통째로 반송**한다. 그리고 그 실패는 학생에게 조용하다 — 학생은 냈다고 믿고 마감을 넘긴다.

1. Resend → **Domains** → 쓸 도메인을 더한다(예: `handaejang.kr`).
   ⚠️ 우리가 **DNS 를 고칠 수 있는 도메인**이어야 한다. 남의 도메인은 안 된다.
2. Resend 가 보여 주는 레코드를 도메인 DNS 에 그대로 넣는다. 세 종류다:

   | 종류 | 무엇을 하는가 | 값 |
   |---|---|---|
   | **SPF** (TXT) | "이 서버가 우리 대신 보내도 된다" | Resend 화면의 값 그대로 |
   | **DKIM** (TXT/CNAME) | 메일에 서명을 붙여 **중간에 바뀌지 않았음**을 증명 | Resend 화면의 값 그대로 |
   | **DMARC** (TXT) | 위 둘이 안 맞을 때 **어떻게 할지** 받는 쪽에 알린다 | 아래 참고 |

   DMARC 는 Resend 가 안 만들어 주므로 직접 넣는다. `_dmarc.<도메인>` 에 TXT 로:
   ```
   v=DMARC1; p=none; rua=mailto:<받아 볼 주소>; adkim=s; aspf=s
   ```
   🔴 처음엔 **`p=none`** 으로 둔다 — 바로 `reject` 로 두면 설정이 조금 어긋나도 **우리 메일이
   전부 버려지고** 왜인지 모른다. `rua` 로 보고서를 며칠 받아 보고 문제가 없을 때 `quarantine`
   → `reject` 로 올린다.
3. Resend 화면에서 세 줄이 모두 **Verified** 인 것을 눈으로 확인한다.
   ⚠️ DNS 는 퍼지는 데 시간이 걸린다(보통 몇 분~한 시간). 초록불이 되기 전에 ④로 가지 말 것.

## ② 시크릿 (코드에 넣지 않는다 — 전부 `wrangler secret`)

```bash
cd server/apply
npx wrangler secret put RESEND_KEY              # Resend API 키
npx wrangler secret put APPLY_FROM              # 예: 한대장 접수대행 <apply@handaejang.kr>
npx wrangler secret put SUPABASE_URL            # https://xxxx.supabase.co
npx wrangler secret put SUPABASE_ANON_KEY       # 공개값 — 학생 토큰 확인용
npx wrangler secret put SUPABASE_SERVICE_KEY    # 🔴 service_role — 발송 기록을 넣는 용도
npx wrangler secret put RESEND_WEBHOOK_SECRET   # ⑤에서 받는 whsec_… 값
```

🔴 **`SUPABASE_SERVICE_KEY` 는 저장소에 절대 넣지 않는다.** 이 열쇠는 RLS 를 건너뛰므로
새면 전 회원 정보가 열린다. 워커 시크릿으로만 두고, 채팅에도 붙여넣지 않는다.
⚠️ `APPLY_FROM` 은 ①에서 **Verified 가 된 그 도메인**이어야 한다. 다른 도메인을 적으면 Resend 가 거절한다.

## ③ 표 두 개 (SQL Editor 에 붙여넣고 Run)

**③-1 발송 기록 표** — `supabase/migrations/0003_apply_sends.sql`

🔴 그 파일이 **넣기·고치기·지우기 정책을 일부러 만들지 않는다** — 학생은 자기 기록을 읽을
수만 있다. 증빙이라 학생이 고칠 수 있으면 증빙이 아니다. 정책을 더하지 말 것.

**③-2 프로필 값 검사** — `supabase/migrations/0004_profile_columns.sql`

🟢 **이건 도메인·발송과 상관없이 지금 해도 된다** (오히려 먼저 하는 게 좋다).
프로필의 학교·학과·학년·성별·성적·소득구간을 개별 칸으로 꺼내고 **DB 가 값을 검사**하게 한다.
왜 필요한가: 변조한 앱이 학생 본인 열쇠로 `성적 999` 를 올리면, 자격 요건을 뭐라고
적어 둬도 **전부 통과한다.** 이 표가 그 쓰기를 거절한다.
⚠️ 앱은 고칠 것이 없다 — DB 가 jsonb 에서 스스로 꺼내 채운다.

## ④ 배포

```bash
cd server/apply && npx wrangler deploy
```
열쇠나 발신 도메인이 없으면 워커가 **503 으로 거절한다**(보내는 척하지 않는다).

## ⑤ 바운스·도착 알림 (웹훅)

1. Resend → **Webhooks** → 주소: `https://handaejang-apply.<계정>.workers.dev/resend-hook`
2. 받을 사건: `email.delivered` · `email.bounced` · `email.complained`
   (`email.delivery_delayed` 는 받아도 되지만 **아직 실패가 아니라** 상태를 바꾸지 않는다)
3. Resend 가 주는 **Signing secret**(`whsec_…`)을 ②의 `RESEND_WEBHOOK_SECRET` 에 넣는다.

🔴 서명이 안 맞으면 워커가 **401** 이고 장부를 건드리지 않는다 — 아무나 '도착했다'로
바꿀 수 있으면 증빙이 아니다.

## ⑥ 켜기 전 마지막 — 한 통 실측

🔴 **우리가 받을 수 있는 주소로 한 통 보내 눈으로 본다.** 켜는 것은 그다음이다.
- 받은 메일의 헤더에서 `SPF=pass` · `DKIM=pass` · `DMARC=pass` 셋을 확인한다
  (Gmail 이면 메일 → 점 세 개 → '원본 보기').
- `apply_sends` 에 줄이 생겼고 `status` 가 잠시 뒤 `delivered` 로 바뀌는지 본다
  → 바뀌면 ⑤까지 제대로 붙은 것이다.
- 일부러 없는 주소로 한 통 보내 `bounced` 로 바뀌는지도 본다(반송 경로 확인).

## 끄는 법

배포를 지우거나, 앱에서 이 주소를 비운다. 앱은 주소가 비면 버튼을 내지 않는다
(`push-config`·`chat-config` 와 같은 방식).

---

## 무엇이 어디서 막히는가

| 증상 | 원인 | 볼 곳 |
|---|---|---|
| 503 "아직 접수 대행이 켜지지 않았습니다" | `RESEND_KEY` 없음 | ② |
| 503 "발신 도메인이 아직 준비되지 않았습니다" | `APPLY_FROM` 없음 | ①② |
| 503 "발송 기록을 남길 수 없어…" | Supabase 시크릿 없음 | ② |
| 401 "로그인이 필요합니다" | 학생 토큰이 없거나 만료 | 정상 동작(증빙 때문에 로그인 필요) |
| 422 "지원 자격을 충족하지 않습니다" | 서버 재검증이 막았다 | 정상 동작(`apply-guard.mjs`) |
| 409 "프로필이 서버에 올라와 있지 않습니다" | 우리 사본이 없다(로그인 후 한 번 저장하면 생긴다) | 앱이 한 번 올리고 다시 부르면 된다 |
| 422 "특별자격을 서버가 확인할 수 없습니다" | 민감정보 동의가 꺼져 있어 **우리 사본에 특별자격이 없다** | 정상 동작 — '없다'가 아니라 '모른다'다 |
| 422 "프로필의 … 값이 올바르지 않습니다" | 있을 수 없는 값(성적 999 등)이 사본에 있다 | 정상 동작(`profileOutOfRange`) · ③-2 를 붙여넣으면 애초에 안 올라간다 |
| 앱에 "성적(학점) 값이 올바르지 않아 서버에 저장하지 못했어요" | ③-2 의 CHECK 가 쓰기를 거절했다 | 정상 동작 — 프로필에서 그 칸을 고치면 다음 저장이 성공한다 |
| 메일이 스팸함으로 간다 | DKIM/SPF 미인증 또는 DMARC 정렬 실패 | ① · ⑥의 헤더 확인 |
| `status` 가 `queued` 에서 안 바뀐다 | 웹훅이 안 붙었거나 서명 불일치 | ⑤ |

관문: `verify/verify-apply-guard.mjs`(`verify-ui.yml` 에 걸려 있다) · 설계 `docs/designs/security-rules.md` 6절.
