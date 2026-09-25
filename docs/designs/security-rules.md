# 권한 · 보안 규칙 명세 (2026-09-25 신설)

> 기술 고문 보고서 **Q12** 가 요구한 것 셋째. 여기 적힌 것은 **약속**이고, 각 줄 끝의
> 관문이 그 약속을 코드로 증명한다. 🔴 **관문 없는 줄은 이 문서에 쓰지 않는다** —
> 지킨다고 적어 두기만 한 규칙은 반드시 되돌아간다.

## 1. 신뢰 경계 — 무엇을 믿고 무엇을 안 믿는가

```
 학생의 폰           │  우리 발행물        │  우리 서버        │  바깥
 ───────────────────┼────────────────────┼──────────────────┼──────────────
 프로필·서류·글      │ data/*.json        │ Supabase profiles│ 학교 게시판
 (원본 · 안 나감)    │ (읽기 전용)         │ (깎인 사본)       │ KOSAF · 재단
                    │                    │ 푸시 KV(주소·학교) │
 ───────────────────┴────────────────────┴──────────────────┴──────────────
 🔴 **바깥에서 들어온 글자는 전부 오염 가능**으로 본다. 공고 제목·본문·첨부는
    우리가 쓴 것이 아니다 → 렌더링에 반드시 `esc()`.
 🔴 **폰 안 값은 학생이 바꿀 수 있다**고 본다. 자동 발송을 켜는 순간 그것이 문제가 된다(6절).
```

## 2. 개인정보 — 나가지 않는 것

정의와 목록은 `docs/designs/data-model.md` 3절. **떼어내는 자리는 `syncSafeProfile()`·
`syncSafeApplications()` 두 곳뿐**이고, 다른 데서 profile 을 보내는 코드를 만들지 않는다.

- 관문 `verify/verify-supabase.js` — 가짜 Supabase 를 세워 **나가는 요청 본문을 전부 모아**
  주민번호·계좌가 한 번도 안 나가는지 센다. 방식(POST/PATCH)과 무관하게 마지막 쓰기를 본다.
- ⚠️ **새 칸을 만들면 목록에 이름을 더하는 것까지가 한 세트.** 2026-09-18 에 `traits`
  (종교·혼인·군복무·농어촌)가 목록에 없어 **동의와 무관하게 나가고 있었다.**
- 약관(`terms.html`)이 이 약속을 글로 적는다 — 코드와 글이 갈라지면 둘 다 고친다.

## 3. 서버 접근 권한 (Supabase)

🔴 **anonKey 는 공개값이다.** 브라우저에 그대로 나가므로 숨길 수가 없다.
남의 프로필을 못 읽게 막는 것은 **오직 행 단위 접근 규칙(RLS)** 이다 — **끄면 전 회원 정보가 열린다.**

```sql
alter table public.profiles enable row level security;
create policy "자기 행만 읽고 쓴다" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
`with check` 가 없으면 **남의 user_id 로 써 넣는 것**을 못 막는다. `login_events` 도 같은 꼴.

⚠️ 이 규칙은 **Supabase 대시보드에 붙여 넣어야** 적용된다(저장소를 보고 자동 배포되지 않는다).
파일은 `supabase/migrations/` — 표를 바꿀 일이 생기면 새 번호 파일을 더하고 그걸 붙여 넣는다.

## 4. 브라우저에서 코드가 실행되는 것 막기 (CSP)

```
default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net
font-src  'self' https://cdn.jsdelivr.net
img-src   'self' data: blob:
connect-src 'self' https://*.workers.dev https://*.supabase.co
```

- 🔴 **`script-src 'self'` 가 이 앱 보안의 근거 그 자체다** — 수집 데이터가 오염돼도 코드가 안 돈다.
  그래서 Supabase **SDK 를 안 쓰고** fetch 로 주소 4개만 부른다(의존성 0).
  ⚠️ 고문 Q8 은 "SDK 를 npm 으로 설치해 번들링하면 CSP 를 지키면서 쓸 수 있다"고 권한다 —
  맞는 말이지만 **빌드 단계가 생긴다**(지금은 빌드가 없다). 정해지지 않은 선택지다.
- 🔴 CSP 는 인라인 스크립트도 **`onclick=` 도** 조용히 막는다. 버튼 배선은 전부 별도 스크립트 파일에서 한다.
- `<meta name="referrer" content="no-referrer">` — 학교 게시판으로 나갈 때 우리 주소를 안 흘린다.
- 관문 `test-collector.mjs` — CSP 에 supabase 가 있는지, `script-src 'self'` 가 그대로인지 본다.

## 5. 화면에 글자를 넣을 때

- **모든 렌더링에 `esc()`.** 공고 제목·본문·첨부 이름은 전부 바깥에서 온 글자다.
- HTML 기호 되돌림(`&nbsp;` 등)은 **`esc()` 앞**에서 한다 — 뒤에서 하면 되살린 기호가 다시 escape 된다.
- 링크는 `safeUrl()` 을 거친다. ⚠️ 기준은 `document.baseURI` 다(origin 으로 하면 우리 파일이
  사이트 뿌리로 새서 404). KOSAF 원본에 **콜론 빠진 주소**(`http//…`)가 실제로 있다.
- 관문 `verify/ui-tone.mjs` 의 '수집한 글의 HTML 기호를 글자로 띄우지 않는다' 절.

## 6. 🔴 아직 없는 방어 — 자동 발송을 켜기 전에 해야 할 것

지금 메일 버튼은 `mailto:` 라 **학생 폰의 메일 앱이 열리고 학생이 직접 보낸다.**
프로필을 변조해도 그건 학생이 제 손으로 보내는 것이라 우리가 중계하는 게 아니다.

🔴 **Resend 자동 발송(`server/mail-worker.js`)을 켜는 순간 보내는 주체가 우리가 된다.**
그때 고문 Q4 의 지적이 그대로 현실이 된다 — 기기에서 값을 바꾼 신청서가 **검증 없이** 학교·재단으로 간다.

켜기 전에 반드시:
1. 최종 제출 내용을 서버로 보내 **자격 요건을 서버에서 한 번 재검증**한다.
   (이때 `profile` 의 매칭 핵심 칸이 컬럼으로 필요해진다 — 고문 Q6 의 진짜 쓸모가 여기다.)
2. 발신 도메인 인증(SPF·DKIM·DMARC)과 바운스 처리.
3. 발송 로그(증빙)를 남긴다.

이미 있는 방어: Origin 검사 · 수신 도메인 허용목록(`ac.kr`/`or.kr`/`go.kr`/`re.kr`) · 크기 제한.

## 7. 열쇠와 비밀

| 무엇 | 어디 | 규칙 |
|---|---|---|
| `NOTION_TOKEN` · `IG_ACCESS_TOKEN` · `PUSH_ADMIN_KEY` 등 | GitHub Secrets | 🔴 **워크플로에만.** 화면은 파일만 읽는다 |
| Supabase `anonKey` | `supabase-config.js` (저장소) | 공개값 — 숨길 수 없다. 방어선은 RLS |
| Supabase `service_role` | **어디에도 없다** | 🔴 저장소에 절대 넣지 않는다 |
| 관리자 GitHub 열쇠 | 관리자 화면 | Actions 쓰기 + Contents **읽기만** — 새어도 정해진 워크플로를 한 번 돌리는 것뿐 |
| 인스타 토큰 | GitHub Secrets | 60일 — 만료 전 재발급(`node insta/token-days.mjs`) |

⚠️ 열쇠를 채팅에 붙여넣지 않는다.

## 8. 관리자 화면

- 도메인이 달라 앱과 **브라우저 저장 공간이 분리**된다. Cloudflare Access 로 잠근다
  (Subdomain 칸에 `*` 를 넣어야 운영 주소까지 잠긴다 — 빼면 미리보기 주소만 잠긴다).
- 🔴 **버튼이 저장소를 직접 고치지 않는다.** `admin-apply.yml` 을 깨우고 그 안에서
  `audit-data.js` 를 통과해야만 저장된다(실패 시 되돌림).
- 학생 주소에 안 뜨는 근거는 **Jekyll 이 `_admin/` 을 배포에서 빼는 것 하나뿐**이다 —
  🔴 `.nojekyll` 이나 `_config.yml` 을 추가하면 **즉시 노출**된다. `check-live.yml` 이 매일 확인.
- 잠금은 `admin-lock-check.yml` 이 매일 로그인 없이 열어 보고 확인한다.
  ⚠️ **설정 화면을 보는 것으로는 잠금이 증명되지 않는다**(호스트 이름이 어긋나면 실제 주소는 열린 채 남는다).

## 9. 이 문서를 고칠 때

- 규칙을 더하면 **관문 위치를 같이 적는다.** 관문이 없으면 그 줄은 곧 거짓이 된다.
- 값(목록·칸 이름)은 **코드를 먼저 고치고** 여기를 따라 고친다.
