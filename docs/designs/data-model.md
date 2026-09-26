# 데이터 모델 — 무엇이 어디에 사는가 (2026-09-25 신설)

> 기술 고문 보고서 **Q12** 가 요구한 것 셋 중 첫째(ERD). 서버 표가 둘뿐이라 그림보다
> **'어느 값이 어느 저장소에 사는가'** 가 실제로 헷갈리는 자리다 — 저장소가 **다섯**이다.
>
> 🔴 이 문서는 사본이다. 원본은 코드이고, 값을 옮길 때는 **코드를 먼저 고친다.**
> 관문 `verify/test-collector.mjs` 「CLAUDE.md 가 가리키는 것이 실제로 있다」 — 이 문서도 함께 잰다
> (백틱 안의 파일 경로·함수·칸 이름이 코드에 없으면 실패한다).

## 1. 저장소 다섯 — 한눈에

```
┌─ 폰 안에만 (서버로 안 감) ─────────────────────────────────────┐
│  localStorage  handaejang.v1       프로필 · 신청내역 · 저장 · 휴지통   │
│                handaejang.auth     로그인 토큰                        │
│                handaejang.syncver  "서버에서 마지막으로 본 판"        │
│                handaejang.resume   다시 열면 어디로 · 쓰던 신청서      │
│                handaejang.remember 아이디 저장(이메일 한 줄)           │
│  IndexedDB     handaejang-docs     증명서류 파일 · 프로필 사진 · 휴지통 │
│                handaejang-notify   알림 설정 · 읽음 · 중복방지 · 알림함 │
└──────────────────────────────────────────────────────────────┘
┌─ 서버 ────────────────────────────────────────────────────────┐
│  Supabase      profiles            프로필·신청내역 **사본**(깎아서)    │
│                login_events        로그인 활동(시각·거친 기기 이름)    │
│  Cloudflare KV push 구독           폰 주소 · 학교 · 캠퍼스 셋뿐         │
└──────────────────────────────────────────────────────────────┘
┌─ 저장소가 아니라 '발행물' (읽기 전용 · 로봇이 만든다) ─────────┐
│  GitHub Pages  data/registered.json  data/notices.json               │
│                data/kosaf-open.json  data/forms.json  data/tuition.json │
└──────────────────────────────────────────────────────────────┘
```

**왜 다섯인가** — 이유가 저장소마다 다르다.
- `localStorage` 는 **기기 우선**의 원본이다. 화면은 언제나 여기서 즉시 뜬다(지하철·비행기모드).
- `IndexedDB` 는 **파일**(증명서류 스캔)을 담아야 해서다. localStorage 는 글자만 담는다.
- 알림 장부만 따로 IndexedDB 인 이유는 하나 — **서비스워커가 localStorage 를 못 읽는다.**
- Supabase 는 **기기를 바꿔도 이어지게** 하는 사본일 뿐이다. 원본이 아니다.
- 푸시 KV 는 '어느 폰을 깨울까'만 안다. 문구는 폰이 만든다.

## 2. 서버 표 (Supabase) — 전부다

```
auth.users (Supabase 가 관리)
   └─1:1─ profiles
            user_id      uuid   PK, auth.users 삭제 시 함께 삭제
            profile      jsonb  ← 깎인 사본 (아래 3절)
            applications jsonb  ← 깎인 사본
            sensitive_ok boolean
            updated_at   timestamptz   ← 🔴 덮어쓰기 판정에 쓴다
            ── 아래 열하나는 **DB 가 위 jsonb 에서 꺼내 채우는 칸**이다 (0004 · 앱은 안 보낸다)
            school · campus · major · track · enroll_status · gender      text
            grade · income_bracket · credits · birth_year   smallint      gpa  numeric
                         ↑ 이 칸들에 CHECK 가 걸려 **있을 수 없는 값은 쓰기가 거절된다**
   └─1:N─ login_events
            id bigint PK · user_id uuid · at timestamptz
            device text  ← '아이폰 · Safari' 정도의 거친 이름 (원문 UA 아님)
            client text  ← 이 설치본을 가리키는 **뜻 없는 난수**(기기 지문 아님)
          index (user_id, at desc)
```

### 어느 마이그레이션이 **실제 DB에 들어가 있는가**

🔴 Supabase 는 저장소를 보고 자동 배포하지 않는다. 파일이 여기 있다는 것은
**아직 붙여넣지 않았을 수도 있다는 뜻**이다 — 세션에서는 DB 를 볼 수 없으니 여기에 적어 둔다.

| 파일 | 라이브에 들어갔나 | 근거 |
|---|---|---|
| `0001_profiles.sql` | ✅ 들어갔다 | 로그인·기기 간 이어쓰기가 실제로 동작한다(`profiles` 를 읽고 쓴다) |
| `0002_login_events.sql` | ❓ **확인한 적 없다** | 확인 안 한 것을 들어갔다고 적지 않는다. 필요하면 대시보드에서 표가 있는지 본다 |
| `0003_apply_sends.sql` | ⛔ 아직 | 접수 대행 발송을 켤 때 한다(`server/apply/README.md` ③-1) |
| `0004_profile_columns.sql` | ✅ **2026-09-26 개발자가 붙여넣고 확인** | 칸 열하나 · 검사 제약 여섯을 대시보드에서 눈으로 확인 |

⚠️ 새 마이그레이션을 만들면 이 표에 줄을 더한다. ⚠️ 그래도 **서버는 이 표를 전제하지 않는다** —
`server/apply/apply-guard.mjs` 가 같은 범위를 한 번 더 보는 이유가 그것이다(붙여넣기 전에도 막혀야 한다).

### 개별 컬럼 — 무엇을 위해 쪼갰고, 무엇을 위해 안 쪼갰는가 (2026-09-26)

고문 보고서 Q6 은 두 가지를 한 문장에 담았다. **둘은 서로 다른 일이라 따로 답했다.**

| 보고서가 말한 것 | 우리 답 |
|---|---|
| "통째 덮어쓰기(Last-write-wins)로 데이터가 증발한다" | 맞다. 그런데 **쪼개는 것으로는 안 고쳐진다** — 옛 기기가 쪼갠 칸을 제 옛 값으로 똑같이 덮는다. 고친 것은 모양이 아니라 **조건부 수정**이다 (`docs/designs/sync-overwrite.md`) |
| "핵심 정보를 개별 컬럼으로 분리하고, 검증은 클라이언트가 아닌 DB CHECK 혹은 서버에서" | 그대로 했다 — `0004_profile_columns.sql` |

🔴 쪼개는 방법을 **DB 가 꺼내 채우는 칸**(`generated always as … stored`)으로 골랐다.
앱이 jsonb 와 개별 칸을 **둘 다** 쓰게 하면 두 곳이 갈라지고(프로필 구조가 이미 두 번
바뀌었다 — `migrateBranchCampus`·`migrateFitFields`), **안 고치면 조용히 값이 사라진다.**
꺼내 채우면 쓰는 길이 하나라 갈라질 수가 없고, CHECK 는 꺼낸 칸에 걸리므로
**이상한 값이면 jsonb 쓰기 자체가 거절된다** = 보고서가 원한 'DB 검증'이 그대로 선다.

🔴 **CHECK 가 잡는 것은 '있을 수 없는 값'이고, '거짓말'은 아니다.** 성적 999 는 막지만
성적 2.0 인 학생이 4.1 이라 적는 것은 못 막는다(4.1 은 정상 범위다). 학교 학사정보와
연동되기 전까지 그것을 확인할 방법은 없다 — 없는 방어를 있다고 적지 않는다.
그래서 서버도 같은 범위를 한 번 더 본다(`apply-guard.mjs profileOutOfRange` ·
0004 를 아직 붙여넣지 않았을 수 있고, 서버는 DB 설정을 전제하지 않는다).

🔴 **'모른다'와 '읽을 수 없다'는 다르다.** 안 적은 값은 통과시켜 엔진이 `unknown` 으로 두게
하고, 숫자로 읽을 수 없는 값(`gpa: "사점일"`)은 **거절한다** — 실측하니 엔진은 그것을
미달이 아니라 *"성적 요건 충족"* 으로 읽는다(`else if (p.gpa < min) 미달; else 충족`).
🔴 `gpa`·`credits`·`birthYear` 의 범위는 **`index.html` 입력칸의 min/max 와 같은 숫자다.**
입력칸만 넓히면 정상 학생의 저장이 조용히 막히므로, 관문이 세 곳(HTML·SQL·서버)을 대조한다.

⚠️ 거절은 **조용하면 안 된다.** 올리기 실패는 `app.js` 가 통째로 삼키고 있었으므로
(`syncSchedulePush` 의 `.catch`), 거절만 따로 가려(`syncRejectText` — Postgres 23514)
화면이 **한 번** 알린다. 관문 `verify/verify-supabase.js` [13] 절 · `verify/test-collector.mjs`
「프로필 개별 칸 · DB 검증」 · `verify/verify-apply-guard.mjs`.
🔴 서버가 준 `details` 에는 실패한 행이 통째로(주민등록번호까지) 들어 있어 **화면에 옮기지 않는다.**

## 3. 🔴 서버로 나가지 않는 것 — 이 목록이 약속의 전부다

떼어내는 자리는 **`supabase-client.js` 의 `syncSafeProfile()`·`syncSafeApplications()` 두 곳뿐**이다.
다른 데서 profile 을 보내는 코드를 만들지 말 것.

| 안 나가는 것 | 왜 | 코드 |
|---|---|---|
| 주민등록번호 · 계좌번호 | 신청서를 채우다 앱이 배운 값이다. 학생이 올리겠다고 한 적이 없다 | `SYNC_OMIT_COMMON` |
| 특별자격 · 처지(종교·혼인·군복무·농어촌) | **민감정보**(개인정보 보호법 제23조). 동의했을 때만 나간다 | `SYNC_SENSITIVE_KEYS` |
| 신청서에 쓴 답 · 자기소개서 | 위 둘이 그 안에 들어 있고, 학생이 쓴 글이다 | `SYNC_OMIT_APP` |
| 증명서류 파일 · 프로필 사진 | 애초에 IndexedDB 에만 있고 올리는 코드가 없다 | — |

⚠️ **프로필에 민감한 칸을 새로 만들면 이 목록에 이름을 더하는 것까지가 한 세트다.**
2026-09-18 에 `traits` 가 새로 생겼는데 목록에 없어 **동의와 무관하게 나가고 있었다.**
관문 `verify/verify-supabase.js` 가 나가는 요청 본문을 전부 모아 실제로 안 나가는지 센다.

## 4. 발행물 (로봇이 만들고 앱이 읽기만)

| 파일 | 무엇 | 층 |
|---|---|---|
| `data/registered.json` | 우리가 **원문을 읽은** 공고. 자격 진단·양식이 붙는다 | 층1 |
| `data/kosaf-open.json` | 한국장학재단이 아는 재단. 재단 칸을 **그대로** 보인다 | 층2 |
| `data/notices.json` | 게시판 제목+링크 피드. 주최를 모른다 | — |
| `data/forms.json` | 양식 스키마 원본 — 여기에만 더하면 앱 무변경 반영 | — |
| `data/tuition.json` | 등록금(학교·계열) — 비율형 금액 환산에 쓴다 | — |

🔴 **층1과 층2를 섞지 않는다.** 층2는 자격 진단도 양식도 붙이지 않는다.
🔴 폰은 `notices.json` 을 **통째로** 받는다 — 학교가 40곳쯤 넘으면 학교별 파일로 나눈다(미리 하지 말 것).

## 5. 같은 것을 가리키는 열쇠

- 공고 하나를 가리키는 것은 **주소**다. '같은 글인가' 판정은 `collector/url-key.mjs` 의
  `urlKey()` 와 `collector/canon-url.mjs` **두 곳뿐**이고, 베끼면 같은 공고가 두 번 등록된다.
- 신청내역은 **공고 id** 로 묶인다(`applications[].id`). 서버와 기기를 합칠 때도 이 id 로 짝짓는다.
- 서류는 **슬롯 이름**(`files` 의 `slot`)으로 자리를 잡는다 — 되살릴 칸에 다른 서류가 있으면 덮지 않는다.
