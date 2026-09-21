# 과팅 탭 — 게시판 · 매칭 · 1:1 대화 (2026-09-21)

개발자 지시: *"앱에 과팅 탭이라는 완전히 새로운 기능을 추가하고 싶어."* 노션 백로그 **UI-33**.

---

## 1. 왜 이것이 다른 화면과 다른가

이 앱은 지금까지 **학생 한 사람과 앱** 사이의 일만 했다 — 프로필은 기기 안에, 서버 표는 전부
"자기 행만"(RLS `auth.uid() = user_id`), 약관은 *"게시물·커뮤니티는 이 서비스에 없다"*.
과팅은 **학생끼리 서로를 보는 첫 기능**이라 그 셋이 전부 새로 필요했다:

| 없던 것 | 만든 것 |
|---|---|
| 남의 행을 읽는 표와 규칙 | `supabase/migrations/0003_gating.sql` — 표 10개 · RLS 전부 · 도우미 함수 · RPC 셋 |
| "정말 그 학교 학생인가" 확인 | `server/gating/` 워커 — 학교 이메일로 6자리 번호, 해시만 저장 |
| 약관의 그 몫 | `terms.html` 제10조의2 · 제2부 2번 ① 두 줄 · 4번 Resend 줄 |

## 2. 개발자 결정 (2026-09-21 · 다시 묻지 말 것)

| 물음 | 답 |
|---|---|
| 기능 모양 | **게시판 + 매칭형 둘 다** |
| 문턱 | **학교 이메일 인증**을 통과한 로그인 계정만 읽고 쓴다 |
| 인증 범위 | **모든 ac.kr**. 학교 *이름*은 `data/school-domains.json` 에 있는 도메인만 적고, 없으면 도메인을 그대로 보여 준다(원칙 8-1 — 지어내지 않는다). 표에 적힌 `.edu`(성균관·동국·인하)는 확인된 국내 대학이라 같이 받는다 |
| 보이는 범위 | 모든 학교 — 글마다 학교·학과가 붙고 학교 칩·학과 글자로 좁힌다 |
| 연락 | **앱 안 1:1 대화** |
| 성별 | 과팅 프로필에서 묻고, 자동 매칭은 **남↔여만** |

### 아직 안 정한 것 하나 — 개발자에게 물을 것
**신고 기록의 보관 기간.** 약관 표에 *"서비스 공개 전 확정해 이 자리에 적습니다"* 로 남겨 뒀다.
법적 근거를 지어내지 않으려고 숫자를 안 적었다. 정하면 `terms.html` 그 칸과 `gating_run_expiry()` 에
지우는 줄을 함께 넣는다.

## 3. 만드는 것 — 구조 한 줄

**인증·매칭은 워커, 접근 규칙은 RLS, 화면은 `gating.js` 한 파일, 알림은 폴링.**
만능 열쇠(service_role)는 저장소에 없다 — 워커 시크릿뿐이다.

### ① 서버 표 (`0003_gating.sql`)
- `gating_profiles` — 인증 행. **만드는 것은 워커뿐**, 학생은 `nickname·dept·gender` 세 칸만 UPDATE
  (컬럼 단위 grant). 학교 이메일은 해시만(`school_email_hash` unique — 같은 이메일로 계정 둘 금지).
- `school_verifications` — 번호 해시 · 만료 · 시도 횟수. **정책 0개** = 서버만.
- `gating_posts` · `gating_requests` — 닉네임·학교·학과·성별은 **트리거가 프로필에서 덮어쓴다.**
  앱이 보낸 값은 버린다(사칭 차단). 속도: 글 3/일 · 요청 동시 1건.
- `gating_rooms` · `gating_room_members` · `gating_messages` — 방 구성원만 읽고 쓴다
  (`is_room_member` security definer — 정책 재귀를 피하는 유일한 길). 메시지 30/분.
- `gating_matches` · `gating_reports` · `gating_blocks` — 신고 3명이면 글 `hidden`, 차단은 양방향으로 안 보인다.
- RPC: `gating_open_room`(학생) · `gating_commit_match`·`gating_run_expiry`(서버만).

### ② 워커 (`server/gating/worker.js`)
- `POST /verify/send {email}` → ac.kr 판정 · 시간당 3회 · 1분 간격 · Resend 로 발송 · 해시 저장.
- `POST /verify/check {code}` → 5회 · 10분 · 통과하면 `gating_profiles` upsert. 다른 계정이 쓴 이메일이면 409.
- 5분마다: 만료 정리 → `pairRequests()`(순수 함수) → `gating_commit_match` RPC 로 원자 확정.
  규칙: 성별 다름 · (학과 다름 or 학교 다름) · 인원 차 ≤1 · `want_school` 양방향 · 차단·30일 재매칭 제외 ·
  인원 같음 +2 · 같은 학교 +1 · 먼저 온 요청부터 결정적으로.

### ③ 화면 (`gating.js` · app.js 뒤에 실린다)
`renderGating()` 의 갈래: 미설정 → 준비 중 / 미로그인 → 로그인 버튼 / 미인증 → 이메일·번호 /
닉네임 없음 → 프로필 / 그 외 → 게시판·매칭·대화 칩. 시트(작성·대화방·신고)는 `#detail-sheet` 그대로.
- 대화방 폴링: 4초 → 새 말 없으면 분마다 8 → 16 → 30초 · 숨으면 정지 · 시트가 닫히면 스스로 끝난다.
- 알림: 탭을 한 번 연 뒤 30초마다 방·요청을 보고 아래 탭에 점(`.nav-dot`). **부팅 때는 요청 0건.**
- 연락처(전화·카톡·인스타): 공개 글은 **막고**(DB CHECK 도), 대화에서는 한 번 멈춰 세우기만.

## 4. 검증

| 관문 | 무엇을 |
|---|---|
| `verify/verify-gating-server.mjs` (verify-ui.yml) | 짝 고르기 18항목 · 이메일 판정 9 · 인증 요청 처리(만능 열쇠가 Supabase 밖으로 안 나감 · 해시만 저장 · 5회 잠금 · 만료) · 예약 실행 |
| `verify/verify-gating.js` (verify-ui.yml) | 가짜 Supabase + 가짜 워커로 앱 사본을 띄워 **요청 본문 전부**를 센다 — 준비 중이면 0건 · 부팅 때 0건 · 보내는 칸이 셋/둘/둘뿐 · esc · 전화번호 차단 · 폴링은 그 방만·닫으면 0건 · 차단·신고 · 이름·학번·전화·주민번호·계좌 0회 · 탈퇴 순서 |
| `verify/test-collector.mjs` 「과팅 탭」 절 | 뼈대 38항목 — 화면 hidden · 탭 · 목록 · 스크립트 순서 · sw ASSETS · CSP 에 wss 없음 · 표 10개 전부 RLS · 인증 표 정책 0 · security definer 에 search_path · 컬럼 grant · cascade · 탈퇴 순서 · 워크플로 등록 · 도메인 표 · 약관 다섯 |

red-green: 글에 학교를 끼워 보내기 · 닫아도 폴링하기 · 탈퇴 순서 뒤집기 — 셋 다 빨간불 확인(2026-09-21).

## 5. 되돌리지 말 것

1. **만능 열쇠를 저장소에 넣지 말 것.** `wrangler secret put` 뿐. `supabase-config.js` 머리말과 같은 규칙.
2. **글·요청에 학교·학과·성별·닉네임을 앱이 보내지 말 것** — 트리거가 채운다. 보내는 코드가 생기는 순간
   사칭 경로가 생긴다(관문이 본문 키를 센다).
3. **`gating_profiles` 의 컬럼 grant 를 풀지 말 것** — 풀면 `verified_at` 을 학생이 스스로 켠다.
4. **security definer 에는 `set search_path = public`** — 없으면 권한 상승 구멍. 정책 안에서 같은 표를
   다시 읽으면 재귀로 표 전체가 안 읽힌다 — 그래서 도우미 함수다.
5. **학교 이름을 짐작하지 말 것** — 표에 없는 도메인은 도메인 그대로. 표는 확인한 것만 넣는다.
6. **Realtime(웹소켓)로 바꾸지 말 것** — SDK 없이는 프로토콜을 손으로 짜야 하고 CSP 에 wss 를 열어야 한다.
   폴링 상수는 `GT_ROOM_POLL_MS` 한 곳.
7. **푸시 워커로 알리려 하지 말 것** — 그 워커는 내용 없는 깨우기라 방을 못 본다(sw.js 는 로그인을 모른다).

## 6. 하지 않는 것
결제·광고 · 인증 없는 열람 · 성별 외 처지 매칭 · 푸시 발송 · 관리자 화면의 신고 처리 UI(Supabase 대시보드
`gating_reports` 에서 본다 — 후속) · 수집망 확대(2026-09-21 지시 그대로 두 곳).

## 7. 개발자가 손으로 할 일
`server/gating/README.md` 일곱 단계 — Supabase SQL 실행 · service_role 복사 · Resend 도메인·키 ·
`wrangler deploy` + 시크릿 셋 · `/health` 확인 · `gating-config.js` 채우고 배포 · 본인 이메일로 시험.
