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
   └─1:N─ login_events
            id bigint PK · user_id uuid · at timestamptz
            device text  ← '아이폰 · Safari' 정도의 거친 이름 (원문 UA 아님)
            client text  ← 이 설치본을 가리키는 **뜻 없는 난수**(기기 지문 아님)
          index (user_id, at desc)
```

🔴 **`profile` 을 개별 컬럼으로 쪼개자는 제안이 두 번 있었다**(마이그레이션 주석 · 고문 Q6).
쪼개지 않은 이유와, 쪼개도 덮어쓰기 사고가 안 고쳐지는 이유는 **`docs/designs/sync-overwrite.md`**.
요약: 앱의 프로필 구조가 이미 두 번 바뀌었고(`migrateBranchCampus`·`migrateFitFields`),
쪼개면 앱을 고칠 때마다 DB 도 같이 고쳐야 하며 **안 고치면 조용히 값이 사라진다.**
쪼개는 이득은 따로 있다 — **서버에서 자격을 재검증**하려면 필요하다(고문 Q4). 그건
자동 발송을 켤 때의 일이다.

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
