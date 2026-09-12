# 인스타 카드뉴스 — 쓰는 법

> 규격은 `SCRIPT.md`, 판형은 `DESIGN.md`, 설계 경위는 `../docs/designs/instagram-pipeline.md`.
> 사실 관문은 `../verify/verify-insta.js` (C1~C11) — 워크플로가 돌린다.
> 채팅에서 고치는 절차는 `.claude/skills/insta-revise/SKILL.md`, 판형을 더하는 절차는 `insta-template`.

## 2026-09-12 개발자 지시 여섯 — 지금 구조

| # | 지시 | 어디에 |
|---|---|---|
| ① | 공고당 게시물 하나 | `insta/pub/<공고 코드>/` — 폴더 하나가 게시물 하나. 장부는 `seen.json` (`prepared` 준비 · `posted` 올림) |
| ② | 생기면 바로 · 개발자 셋에게 메일 | `insta.yml` 이 수집 로봇 셋이 끝날 때마다(`workflow_run`) 새 공고를 그려 **이슈 담당자 셋**(GitHub 이 메일을 보낸다) + SMTP 메일. 명단 `team.json` |
| ③ | 채팅에서 수정 · 그림 제시 · 발송 전 물음 | `revise.mjs` 가 다시 그리고 미리보기를 만든다. 보내는 것은 `run-notify.txt` push-to-run. 순서는 스킬 `insta-revise` |
| ④ | 번호 고정 판형 | `templates.json` — 1 사진 · 2 카톡 · 3 굿노트 · 4 포스터. `--tpl=번호`. 번호는 안 바뀐다 |
| ⑤ | 예시 붙여넣고 판형 추가 | `new-template.mjs` 가 다음 번호로 시작 파일(`templates/<번호>-<id>.mjs`)을 만든다. 절차는 스킬 `insta-template` |
| ⑥ | 관리자 페이지에서 전부 | `_admin` 「인스타」 탭 — 게시 대기·게시·판형 바꿔 다시 그리기·건너뛰기·판형 견본·트랙션·댓글 답글/숨기기/삭제 |

## 하루가 어떻게 흐르나

```
수집 로봇(07:41·08:07·11:41·12:07 · 목 05:23 KOSAF) 끝남
  → 「인스타 카드뉴스 게시」 prepare: 준비 안 한 새 공고를 점수순 최대 6건 그린다(공고마다 폴더)
  → 커밋 → Pages 공개 확인 → 이슈(담당자 셋) + 메일(시크릿 있으면)
  → 개발자가 본다 —
       괜찮다  → 관리자 화면 › 인스타 › 「게시」            (Actions 「게시」 도 된다)
       고치고 싶다 → Claude Code 채팅에 말한다 (스킬 insta-revise: 고침 → 그림 → 묻고 → 메일)
       안 올린다 → 「건너뛰기」 (또는 그냥 둔다 — 아무것도 안 올라간다)
매일 09:13 보정 실행(수집이 없던 날) · 06:53 트랙션 수확 · 3시간마다 댓글 받아오기 · 03:17 토큰 확인
```

🔴 **게시는 사람만 누른다.** 예약·수집 뒤 실행은 inputs 가 비어 `prepare` 만 켜진다(관문 C9).
🔴 **게시는 다시 그리지 않는다** — 개발자가 본 그 폴더를 그대로 올린다. 판형을 바꾸려면 「다시 그리기」 로
   새로 그려 다시 보고 게시한다.
🔴 한 실행에 최대 6건(`max`) — 첫 실행에 98건을 다 그리면 시간 상한에 걸려 통째로 죽는다. 남은 것은
   다음 실행 몫이다(장부에 안 적혔으니 다시 뜬다).
🔴 이슈에 박은 `<!-- insta-code: … -->` 가 게시 단계의 대조 표식이다 — 지우지 말 것.

## 관리자 화면 「인스타」 탭이 하는 일

| 구획 | 버튼 → 깨우는 워크플로 |
|---|---|
| 게시 대기 | **게시**(insta.yml 게시) · 카드 보기(시트) · 판형 고르고 **다시 그리기**(insta.yml 준비 + code + tpl) · **건너뛰기**(insta.yml 건너뛰기) |
| 올린 게시물 | 인스타 링크 · 반응(stats.json) |
| 판형 | 번호·이름·견본(`samples/<번호>-1.jpg` — 「인스타 판형 견본」이 그린다) |
| 트랙션 | 팔로워 추이 · 게시물별 저장 · 표 (insta-stats.yml 이 매일 `stats.json` 에 적는다) |
| 댓글 | 답글·숨기기·삭제 (insta-comments.yml · `comments.json`) · 답한 댓글은 '처리됨' 으로 접힌다 |

🔴 화면은 **파일만 읽는다** — 토큰은 워크플로에만 있다. 화면에 토큰을 주면 여는 사람 전부가 계정에 글을 쓸 수 있다.
🔴 화면의 `INSTA_STEP` 글자는 `insta.yml` 의 선택지와 **한 글자도** 다르면 안 된다(관문 C11) — 다르면 422 로 조용히 죽는다.

## 처음 한 번: 계정 붙이기

**페이스북 계정도 페이지도 필요 없다.** 인스타 하나로 끝난다
(Instagram API with **Instagram Login** · 2026-09-11 문서 확인).

1. 인스타를 **프로 계정**(비즈니스/크리에이터)으로 바꾼다
2. [developers.facebook.com](https://developers.facebook.com) 에서 앱을 만들고
   **Instagram** 제품을 넣은 뒤, 그 계정을 앱 **역할(테스터)** 로 넣는다
   🔴 자기 계정에만 올리면 **앱 심사는 필요 없다** — 기본값인 Standard Access 로 된다
   (조사로 확정 · 재조사 금지)
3. **Instagram 으로 로그인**해 권한 둘을 준다 —
   `instagram_business_basic` · `instagram_business_content_publish`
   받은 1시간짜리 토큰을 **장기 토큰(60일)** 으로 바꾼다
4. 저장소 Settings → Secrets → Actions 에 둘을 넣는다
   · `IG_USER_ID` — 인스타 계정 ID
   · `IG_ACCESS_TOKEN` — **장기** 액세스 토큰(60일)
5. 「인스타 토큰 수명 확인」 을 수동 실행해 초록불을 본다 — **이 단계를 건너뛰지 말 것**
   (시크릿 화면이 채워져 있는 건 증명이 아니다. 물어봐야 안다)

🔴 **왜 Instagram Login 인가** — Facebook Login 경로는 페이스북 페이지를 요구하고, 토큰이
   페이스북 사용자 토큰이라 페이지를 거쳐야 인스타 계정을 가리킬 수 있다. Instagram Login 은
   그게 없다. 엔드포인트 경로·캐러셀·JPEG·공개 주소 요구는 **똑같고 호스트만 다르다**
   (`graph.instagram.com`). 빠지는 기능은 해시태그 검색·제품 태깅·파트너십 광고 셋인데
   우리는 셋 다 안 쓴다. 하루 상한만 100건 → 50건인데 우리 속도로는 닿지 않는다.

### 토큰 수명을 우리가 세는 이유

🔴 `graph.instagram.com` 에는 **`debug_token` 이 없다.** 만료일을 물어볼 길이 없다.
그래서 매일 03:17 KST 에 두 가지를 따로 한다 —

| | 어떻게 아나 |
|---|---|
| 살아 있나 | `GET /me` 로 **물어본다**(못 물어보면 `dead` 로 친다) |
| 며칠 남았나 | **우리가 이 토큰을 처음 본 날**에서 센다(`insta/token-seen.json`) |

그러니 이 숫자는 '만료까지'가 아니라 **'우리가 아는 한 만료까지'** 다. 문구도 그렇게만 말한다.
⚠️ 그래서 **새로 받은 토큰을 넣어야** 셈이 맞다 — 묵은 토큰을 넣으면 알 길이 없다.
🔴 기록장에 적히는 것은 토큰이 아니라 **지문 8자리**다(공개 저장소다).
🔴 갱신은 사람이 한다. Instagram Login 의 갱신 자체는 앱 시크릿 없이 되지만, 새 토큰을
   **시크릿에 써 넣으려면** 시크릿 쓰기 열쇠가 저장소에 있어야 하고, 그게 새면 남이
   우리 계정에 글을 올릴 수 있다.

## 손으로 돌려 보기

```bash
node insta/pick.mjs --new --max=6                # 아직 준비 안 한 새 공고 (워크플로가 쓰는 것)
node insta/pick.mjs --list                       # 후보를 점수·근거와 함께
node insta/render.mjs <공고이름·코드> --tpl=2     # 2번 판형으로 카드 + 캡션 (insta/out/)
node insta/render.mjs <공고> --tpl=all           # 판형 전부
node insta/render.mjs <공고> --tpl=3 --pub       # 게시용 폴더 insta/pub/<코드>/ 로
node insta/revise.mjs <코드> --tpl=4 --font="Gaegu"   # 준비된 것을 고쳐 다시 그리고 미리보기
node insta/preview.mjs --dir=insta/pub/<코드>    # 피드 크기 미리보기 한 장
node insta/ledger.mjs show                       # 준비·건너뜀·올림 장부
node insta/new-template.mjs <id> "<이름>" "<베낀 것>"   # 새 판형 시작 파일 (다음 번호)
node insta/samples.mjs                           # 판형 견본
node insta/sweep-overflow.mjs [--tpl=번호]       # 전수 넘침 측정 (판형당 약 1분)
node verify/verify-insta.js                      # 사실 관문
```

🔴 이 저장소의 Claude 샌드박스에서는 브라우저가 구글 폰트를 못 받는다(프록시가 TLS 를 자른다).
   `INSTA_DEV_FONT_RELAY=1 NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` 를 앞에 붙이면
   Node 가 대신 받아 넘긴다. `npm i playwright@1.56.1`(미리 깔린 크로미움 1194 와 맞는 판)이 먼저 —
   루트 `node_modules`·`package.json` 은 커밋하지 않는다. 워크플로에는 이 환경변수를 두지 않는다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `notices.mjs` | **무엇을 올릴 수 있나** — 교외(KOSAF) + 교내. 다른 파일은 다 이걸 본다 |
| `school.mjs` | 교내 공고를 카드 재료로. 자격/제외 가르기는 `section-head.js`·`match-engine.js` 를 쓴다 |
| `pick.mjs` | 후보·점수 · `--new` 준비 안 한 공고 전부 · `seen.json` 읽고 쓰기(`markPrepared`) |
| `ledger.mjs` | 워크플로가 장부를 고치는 명령줄 껍데기(prepared · skip · show) |
| `templates.json` | **판형 번호표** — 번호 고정 · 내장 3벌 + `templates/<번호>-<id>.mjs` |
| `templates/4-poster.mjs` | 바깥 판형 파일의 본보기 — 새 판형은 이 꼴 |
| `new-template.mjs` | 다음 번호로 시작 파일을 만든다 |
| `render.mjs` | 카드 · 판형 번호 해석(`loadTemplates`) · `--font` 글꼴 바꿔 끼우기 · `--pub` 공고별 폴더 |
| `revise.mjs` | 준비된 게시물을 채팅에서 고쳐 다시 그리고 미리보기(메일은 안 보낸다) |
| `run-notify.txt` | 고친 카드를 다시 알리는 push-to-run 표식 |
| `caption.mjs` | 캡션 (`ctx` 만 받는 순수 함수 — 🔴 CLI 를 두면 순환 import 로 멈춘다) |
| `fit.mjs` | 글자를 카드에 맞추는 **한 곳** — 위아래·**옆** 넘침 둘 다 본다. 렌더러와 스윕이 같이 쓴다 |
| `publish.mjs` | Graph API 캐러셀 2단계 · `--code` 로 폴더 지정 · 기본은 예행연습 |
| `mail.mjs` | 여러 게시물을 한 통에 · 받는 사람은 `team.json` 셋 |
| `team.json` | 알림 받는 개발자 셋(github 담당자 · email) |
| `stats.mjs` · `stats.json` | 트랙션 수확(팔로워 이력 · 게시물별 반응 · 못 받은 것은 error 칸) |
| `comments.mjs` · `comments.json` | 댓글 받아 적기 · 답글/숨김/삭제(`--do` 없이는 예행연습) · 우리 표식 `handledAt` |
| `samples.mjs` · `samples/` | 판형 견본(같은 공고로 판형 전부) |
| `token-days.mjs` · `token-seen.json` | 토큰 남은 수명(지문만 적는다) |
| `photos.json` · `find-photos.mjs` | 표지 사진(위키미디어 공용) |
| `pub/<코드>/` | 🔴 **일부러 커밋한다** — Pages 가 서빙해야 인스타가 가져간다. 공고 하나에 폴더 하나 |
| `out/` | 작업용. `.gitignore` |
