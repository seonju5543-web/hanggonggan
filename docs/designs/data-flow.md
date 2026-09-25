# 데이터 흐름 — 공고가 학생 폰까지 가는 길 (2026-09-25 신설)

> 기술 고문 보고서 **Q12** 가 요구한 것 둘째. 로봇이 서른 개가 넘어 **어디서 무엇이 끊기는지**
> 가 실제로 안 보인다. 그래서 '무엇이 무엇을 만드는가'만 그린다.
>
> 🔴 예약 시각·건수는 여기 적지 않는다(사본은 낡는다). 시각은 `.github/workflows/*.yml` 의
> `cron`, 건수는 `node docs/advisor/check-brief.mjs`.

## 1. 큰 그림 — 네 구간

```
 ① 모으기            ② 읽기·판정            ③ 내보내기           ④ 폰
 게시판·KOSAF   →   원문·첨부·발췌   →   기본 브랜치→main   →   앱·알림
 (로봇)              (로봇)                 (배포 로봇)          (학생)
```

🔴 **구간 ③이 없어서 사고가 났었다** — 로봇은 **기본 브랜치에만** 저장하는데 앱은 **main** 만
배포한다. `deploy-sync.yml` 이 옮겨 주기 전까지 수집분이 앱에 하루도 안 보였다.

## 2. ① 모으기

```
학교 게시판 ──┬─ collector/collect.mjs          (일반 · 빠르게 훑는다)
              └─ collector/browser-collect.mjs  (진짜 Chromium · 봇차단·클릭형 게시판)
                          │
                          ├→ data/notices.json   실시간 공고 피드 (제목+링크)
                          └→ collector/seen.json 이미 본 글 장부

한국장학재단 ── collector/kosaf-*.mjs ──→ data/kosaf-open.json (층2)
                                        └→ data/kosaf-files/   선발공고문 사본
```

- 🔴 **같은 글인가**는 `url-key.mjs urlKey()` 한 곳이 정한다(정렬 순번 같은 휘발성 값을 뗀다).
  안 떼면 어제 본 글이 매일 '신규'가 되어 진짜 새 공고를 밀어낸다.
- 🔴 학교 한 곳이 답을 안 주면 **그 자리에서 멈춘다** → `withDeadline()` 절대 시한 + 전역
  예산(`harvest-budget.mjs`) 안에 스스로 끝내고 **저장까지 간다.** 상한을 올리는 건 해법이 아니다.
- 학교 순서는 회전한다(`browser-cursor.json`) — 안 하면 잘리는 학교가 뒤쪽으로 고정된다.

## 3. ② 읽기·판정

```
notices.json 의 새 공고
   │
   ├─ collector/auto-register.mjs   보수적 규칙 통과분만 자동 정식 등록
   │     └ 규칙은 verify/entry-rules.cjs 한 곳 (로봇이 등록 전 · 감사가 사후)
   │
   ├─ collector/deepfetch.mjs       본문 전문 + 첨부 원본
   │     └ pdf-text.py · ocr-text.py · hwp-*.py  → 첨부에서 글자 뽑기
   │
   ├─ collector/extract-excerpts.mjs
   │     ├ excerpts        원문 문장 그대로 (🔴 추론 금지 — 원칙 8-1)
   │     ├ 마감일          이름표(`신청기간 :`) 뒤 날짜만
   │     ├ applyEmail      메일 접수처 (apply-email.mjs)
   │     └ applyPortal     포털 시스템 (apply-channel.js findApplyPortal)
   │
   ├─ collector/schematize-forms.mjs  첨부 신청서 → data/forms.json 스키마
   │     └ 무료 경로(schema-from-text) 우선, 못 하는 것만 API
   │
   └─ collector/link-hunter.mjs      원문 주소를 못 찾은 것 전담 (느려도 정확하게)
```

🔴 **저장 직전에 데이터 관문**(`verify/audit-data.js`)이 선다. 통과 못 하면 **그 실행이 새로
등록한 것만 골라 되돌리고**(`revert-auto.mjs`) 리포트에 🚨 를 남긴다. 잘못된 공고가 앱에 하루도 못 나간다.

⚠️ 관문이 실패 상태면 **로봇 결과가 하나도 안 남는다** — 세션 시작에 `audit-data.js` 를 먼저 돌리는 이유다.

## 4. ③ 내보내기

```
로봇 커밋 → 기본 브랜치(claude/nice-heisenberg-WESq5)
                │
                ├─ deploy-sync.yml   (수집 로봇이 끝날 때마다 + push 마다 + 하루 1회)
                │        └→ main → GitHub Pages 자동 배포
                │
                └─ device-deploy.yml (사람이 누를 때 · 작업 브랜치 → 기본 → main)
                         🔴 deploy/run-deploy.txt 의 `branch:` 대조가 안전장치
                            (없으면 남이 기본 브랜치를 병합하는 것만으로 덜 된 작업이 나간다)

main → 사람이 직접 고치면 main-guard.yml 이 기본 브랜치로 되가져온다 (반대 방향 짝)
```

⚠️ **로봇 push 는 다른 워크플로를 못 깨운다.** 그래서 device-deploy 는 main 까지 **직접** 민다
(deploy-sync 에 맡기면 보정까지 기다린다).

## 5. ④ 폰 — 받기와 알림

```
앱 실행
  ├ boot.js            첫 화면을 세운다 (다른 스크립트보다 먼저)
  ├ sw.js              데이터·코드 모두 **네트워크 우선** + no-cache 재확인 + 3.5초 폴백
  │                     → 재설치 없이 자동 반영 / 오프라인도 보장
  ├ data/*.json 읽기   registered · notices · kosaf-open · forms · tuition
  ├ match-engine.js    매칭·적합도  ← 🔴 화면과 알림이 **같은 파일**
  └ resume.js          다시 열면 어디로 가는가

알림 — 두 경로가 함께 돈다
  (가) 로컬: 앱을 열 때 · 열어 둔 동안 주기적으로 · 화면 복귀 · (안드로이드 설치형) periodicsync
  (나) 진짜 푸시: 발송 서버가 **내용 없는 깨우기**만 보냄
         → 깨어난 sw.js 가 **기기 안 프로필**로 문구를 만든다
         → 그래서 서버에 저장되는 건 폰 주소·학교·캠퍼스 셋뿐
```

🔴 `sw.js` 의 `importScripts` 에 **로그인 코드(supabase-client.js)를 넣지 않는다** —
서비스워커는 로그인을 모른다. 넣으면 개인정보 경계가 흐려진다.
🔴 판정 규칙을 알림 쪽에 한 벌 더 두지 않는다 — 화면에서 숨긴 공고를 알림이 알리는 모순이 생긴다.

## 6. 로그인 이어쓰기 (켜져 있을 때만)

```
저장할 때마다  saveState() → syncSchedulePush() → (묶어서) syncPushMerging()
                                   │
                                   └ syncPush: 🔴 **내가 본 판이 아직 서버에 있을 때만** 고친다
                                        0행이면 conflict → syncApplyRemote(quiet) 로 합치고 한 번 재시도
앱을 열 때      syncAfterLoad() → syncPull() → 최신이 이긴다
```

경위와 함정은 `docs/designs/sync-overwrite.md`. 나가는 값이 깎이는 자리는 `syncSafeProfile()` 하나(`docs/designs/data-model.md` 3절).

## 7. 어디가 끊기면 무엇이 멈추는가

| 끊긴 곳 | 증상 | 먼저 볼 것 |
|---|---|---|
| ① 수집 | 며칠째 새 공고 0건 | Actions 의 conclusion(취소는 '실패'가 아니다) · 리포트 이슈의 학교별 진단 |
| ② 관문 | 로봇이 도는데 결과가 안 남는다 | `node verify/audit-data.js` — 실패 상태면 저장을 건너뛴다 |
| ③ 배포 | 저장소엔 있는데 앱에 없다 | `node verify/check-deploy-sync.js` · device-deploy 의 `branch:` 줄 |
| ④ 폰 | 앱에 옛 데이터 | sw 는 네트워크 우선이라 보통 아님 → 실제 배포를 `check-live.yml` 로그로 확인 |
| 알림 | 안 온다 | KV 의 등록 수는 '살아 있는 폰 수'가 아니다 — `push-check.yml` 발송만이 증명 |
