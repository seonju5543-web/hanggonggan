# 로봇·도구 점검 규칙 — 2026-10-04~05 대대적 점검에서 고친 것과 다시 깨지지 않게 하는 관문

> 개발자 지시(2026-10-04): *"모든 로봇과 앱 내에서 사용하는 툴들이 재기능을 하고 있는지 대대적으로 확인하고 수리할 부분을 수리해."*
> 여기엔 **규칙과 관문 위치**만 둔다. 무슨 일이 있었는지(실행 번호·건수·이슈 번호)는 `SESSIONS.md` 「2026-10-05 로봇·도구 대대적 점검」.
> 관문은 모두 `verify/test-collector.mjs` 「로봇·도구 점검 관문」 절이 부르는 `verify/health-gates/<묶음>.mjs` 다.
> 혼자 돌리기: `node verify/health-gates.mjs [묶음 …]`.

## 관문 자체의 규칙

- 🔴 **표본(고정 예시)만 잰다** — `data/`·`collector/` 장부의 내용을 단정하지 않는다. 실데이터 단정이 이번 점검의 사고 셋을 냈다
  (로봇이 데이터를 바꾸는 순간 관문이 빨개져 자동 등록분이 되돌려지고, 관문을 같이 쓰는 다른 로봇이 제 결과를 버렸다).
- 🔴 test-collector 의 실데이터 읽기는 파일별 톱니(`REAL_READ_ALLOW` · 도구가 대신 읽는 `TOOL_READS_ALLOW`)로 잠겼다 — 늘리지 말고
  항목 불변식은 `verify/audit-data.js`, 개수·'있어야 한다'는 표본 + ℹ 숫자로. 관문 gate ③.
- 🔴 워크플로·문서 **글자**를 재는 관문은 `softEq` 로 — 로봇 워크플로(데이터 관문)에선 경고만, 로컬과 `DOC_GATES=1`(verify-ui)에선 실패.
  다른 세션의 무해한 단계 하나로 모든 로봇 결과가 되돌려지면 안 된다. 순수 함수·진짜 명령 표본은 어디서나 엄격. 관문 alerts ⓪.
- 묶음 파일을 더하면 `verify/health-gates.mjs` 의 `PARTS` 에도 적는다(디렉터리를 훑지 않는다 — 지운 파일·오타가 조용히 빠진다).
  아무것도 재지 않는 묶음은 실패로 센다.
- 셸·스크립트 동작은 글자 대조가 아니라 **가짜 node·gh·github 로 실제로 돌려** 잰다 — 글자 대조는 `|| echo`·`ids.length &&` 같은 무력화를 못 잡았다.

## 데이터 관문 · 되돌리기 (gate)

- 🔴 데이터 관문이 빨가면 `collector/gate-guard.mjs` 가 **단계별로 되돌리고 매번 다시 잰다**(새 자동 등록분 → 정식 등록·양식·대기열을 직전 판으로) ·
  결과 `reverted-auto`·`reverted-files`·`still-failing`·`flaky` · 끝내 빨가면 실패 알림 뒤에서 이슈 + 종료 1 · 두 번 걸린 자동 등록은 3일 쉰다
  (`collector/auto-held.mjs` · 30일 넘은 줄은 지운다). 관문 gate ④.
- 관리자가 고치는 데이터·설정의 불변식은 test-collector 가 아니라 **감사 오류**로 — 출처 규칙 `verify/source-rules.cjs`(`auditSourceFiles`) ·
  '화면 문구 끝 날짜 = 마감'은 `verify/entry-rules.cjs` `checkEntry`(`lastDateIn` 은 entry-rules 한 곳) · `tools/admin-apply.mjs` 가 저장 전에 같은 함수로 거절.
  관문 gate ②(감사가 경고로 낮추지 않았는지 — 결과를 **어디에 넣는가**까지 잰다).
- 학위 줄: 학사·석사를 나란히 적은 '과정'(`및`·`또는`·`,`)은 학부도 받는다(`UNDERGRAD_TOO`) · '둘 다' 갈래도 남는 글자가 2자 넘으면 모름(`degreeRest`).
  틀린 미달·틀린 안심 둘 다 막는다. 관문 gate ①.
- 양식 대기열의 고아(등록에서 빠진 공고) 정리는 `collector/pending-queue.mjs` `pruneOrphans`.

## 실시간 공고 피드 (feed)

- **피드는 스스로 돌아온다** — 수집기는 seen 만 보고 '피드에 있나'는 안 물어, 빠진 글은 영영 안 돌아왔다(9-30 병합 사고).
  두 수집기가 `healFromLedger`(학교별 파일 먼저 → 후보 장부 · `FEED_HEAL_SINCE` 이후 · 학교별 파일 상한 안만 세고 싣는다)로 메운다 · 지금 글은 바꾸지 않는다.
  사람용 복구는 `collector/heal-feed.mjs`(차례는 관문이 두 수집기와 글자로 대조). 관문 feed ①.
- 🔴 피드에서 빼는 **새 규칙은 메우기 거르기에도** 건다 · 손으로 지울 땐 학교별 파일·`collector/candidates.json` 까지(안 그러면 메우기가 되살린다).
- 글이 없는 학교의 학교별 파일은 지우지 않고 빈 파일로(`publishBySchool` · 지우면 병합기가 못 푸는 수정/삭제 충돌) ·
  화면 0건 학교는 수집 리포트 머리 🙋 줄(`zeroFeedSchools` · 까닭 `zeroFeedWhy` — 0건 날엔 코멘트에 붙는다).
- 누락 감사의 '가진 것'은 학생이 보는 것(피드 + 학교별 파일 + 정식 등록)뿐 — 장부를 섞으면 피드에서 빠진 글이 안 보인다(`coverageSets` 한 곳). 관문 feed ④.

## 자격요건 로봇 · 본문 · 첨부 · OCR (bodies)

- **자격요건 로봇(`collector/rescue-bodies.mjs`)은 단계 시한 전에 스스로 끝난다** — 한 공고 절대 시한 · 공고마다 저장 · 감시 타이머(예산 + 한 공고 시한 + 30초 → 저장 후 종료 1) ·
  저장은 `collector/write-atomic.mjs`(임시 파일 → 이름 바꾸기). 대상·차례·장부 규칙은 `collector/rescue-plan.mjs` 한 곳(로봇은 불러오면 돌아 관문이 못 부른다). 관문 bodies ①.
- 🔴 `continue-on-error` 단계가 잘려도 작업은 초록이다 — 그런 핵심 단계는 저장 **뒤**에 `steps.<id>.outcome != 'success'` 로 실패를 남기고,
  실패 알림은 **이번 실행** 리포트만 붙인다(옛 판을 붙이면 다른 날 일로 읽힌다). 관문 bodies ①ⓒ.
- 증분 받기(`deepfetch --fill`)의 물러서기는 받기 실패와 껍데기를 둘 다 센다 · 받기 전체에 예산. 관문 bodies ④.
- PaddleOCR 엔진이 통째로 고장 나면 `paddle-ocr.py` 가 종료 2 + `paddle-status.json` → `activity-docs.mjs --apply` 가 그 글의 무료 기회를 되돌린다 ·
  워크플로에서 `|| true` 로 삼키지 말 것(경고로 바꾼다). 관문 bodies ②.
- 브라우저 수집의 클릭형 게시판 본문은 `clickBodyEntry`(열렸나·이 행 제목이 있나·목록 화면 아닌가) · 저장하는 본문은 줄을 살린 것. 관문 bodies ⑦.

## 브라우저 수집 · 열쇠 (browser)

- 브라우저 수집 건강 장부: 학교 결과는 `collector/browser-health.mjs` 한 곳(열렸지만 장학 0건 = 실패 · 예산 건너뜀 = 안 적음) ·
  브라우저 쪽 연속 횟수는 `browserFails` · 일반 로봇이 ✅ 인 학교는 `browser-targets.json` `parked` 로. 관문 browser ②④.
- 🔴 **열쇠 규칙(`urlKey`·`canonUrl` 의 떼는 칸)을 바꾸면** 두 목록에 같은 이름 + 옛 열쇠 장부는 `rekeyLedger`·`rekeyKey` 로 잇는다 · `idFromUrl` 공식은 그대로. 관문 browser ①.
- 대외활동·재단 출처 연속 실패는 `collector/source-health.mjs`(열쇠 = 게시판 주소 · 6회면 리포트 머리 🙋). 관문 browser ⑥.
- 학교 도메인(판정 로봇의 학교 이메일 신호)은 `domainForSchool` 한 곳(`collector/kind-evidence.mjs`).

## 장학 공고 글 품질 · 양식 · 메일 접수 (qnotice)

- 메일 접수 예외: '오류 발생 시에만' 예비 메일 · '신청은 다른 곳 · 메일은 서류만' 줄은 접수처가 아니다(`judgeLine` 은 앞 두 줄까지) ·
  이미 들어간 로봇 값도 발췌기가 매 실행 다시 묻는다(`staleApplyEmail` · 사람 값은 그대로). 관문 qnotice ①.
- 기간 힌트·본문 마감은 껍데기를 걷은 본문으로(`hintWithoutChrome`·`makeBodyReader` · 껍데기를 모르는 호스트는 본문 마감을 안 읽는다 —
  배너 날짜가 모든 글의 마감이 된다) · `bodyDeadline` 칸은 로봇 장부에만. 관문 qnotice ②③.
- 🔴 자동 등록은 본문 마감을 먼저 본다(`collector/notice-deadline.mjs`) · 등록 뒤 지난 마감을 받은 로봇 등록분은 다음 실행이 뺀다(`registeredAfterDeadline`) ·
  뺀 사업은 지난 회차 장부(`collector/past-rounds.mjs` · 60일)가 같은 사업의 다른 학교 글을 컨펌 대기로 막는다(빼면 짝이 사라져 다른 학교 글이 등록·전국 승격됐다). 관문 qnotice ③.
- 범위 승격·흡수는 마감 전 로봇 등록분끼리만 — `collector/registered-merge.mjs` 의 `promotableOn`·`absorbsOn`·`openOn` 한 곳. 관문 qnotice ④.
- 포털 근거 낱말은 `hasPortalName` 한 곳 — 표에는 학교 고유 이름 + 근거 2건 이상만. 관문 qnotice ⑦.
- 실린 글 제목 소급: 장학·활동·재단은 `retitleItems`, 소식은 `retitleStored`(행 번호는 게시판 단위 80% `dropRowNumbers`) — 제목만 고치고 주소·글 번호는 그대로. 관문 qnotice ②⑤.
- 카드 윗줄은 주관 기관을 못 읽으면 「교외」만(`providerUnknown` · 2026-09-17 결정). 관문 「카드 제목」.
- 양식 로봇 리포트는 '열린 공고 n건 중 양식 m건'을 매 실행 싣는다(0~1건 🚨 · `collector/form-reach.mjs` · 옛 양식 짝은 후보로만).
  `verify/verify-new-forms.js` 는 표본 공고를 심어 늘 돈다(실데이터가 비어도 '건너뜀'으로 조용하지 않게). 관문 qnotice ⑧.
- 도우미 검색 재료(`collector/build-search-index.mjs`)는 껍데기·남의 제목·이전글 줄을 걷고 뽑는다 · 불러오기만 하면 파일을 안 쓴다. 관문 qnotice ⑥.

## 소식 · 재단 · 대외활동 (qfeeds)

- 재단·지자체 글 거름은 `collector/external-clean.mjs` `dropReason` 한 곳(마감 다음 날까지 · 제목 머리 [마감] · 옛 글은 `fillDeadlineFromHint`) —
  병합기도 합친 뒤 다시 건다(`mergeExternal`). 관문 qfeeds ②③.
- 소식 발행: 앞날 게시일은 비운다(`clearFuturePosted` · newsFloor 앞) · 출처에서 뺀 게시판의 글은 뺀다(`dropRetiredBoards` — 열쇠 없는 옛 글은 짐작해 빼지 않는다) ·
  장부 `pruneSeen`(90일). 관문 qfeeds ①⑤⑦.
- 활동 자격 줄 거름은 `collector/activity-excerpts.mjs` `eligLineOk` 한 곳. 관문 qfeeds ④.
- 활동 피드 60일·상한은 `collector/open-api-map.mjs` `actKeepDate` 한 날짜 · 공공 API 출처는 서버 묶음끼리 동시에 받는다(`runSourceGroups`). 관문 qfeeds ⑨⑪.
- robots.txt: 대외활동·재단 출처는 학교 사이트라도 지키고, 학교 장학·소식 게시판은 묻지 않는다(`collector/robots.mjs` 머리말 · 관문 qfeeds ⑫).
- 실린 재단·활동 글에 지금 규칙을 바로 다시 걸 때: `node tools/refilter-feeds.mjs [--write]`(사이트를 두드리지 않는다).

## 원문 링크 로봇 (links)

- 자동 등록 id 가 겹치면 꼬리표 id — 공식 `idFromUrl` 은 그대로, 같은 id 를 다른 주소가 쥐었을 때만 `<옛 id>-<꼬리표>`(`registerId` 한 곳 · 로봇·관리자 공용).
  막음·쉬기·차단 풀기는 두 꼴을 다 본다(`blockedTagged`). 관문 links ①.
- 저장하는 원문 주소는 씻는다 — HTML 기호·경로 세션 표식(`;jsessionid=`)을 `cleanStoredUrl` 로 · `canonUrl`·`urlKey` 도 세션을 뗀다(옮긴 한 줄은 관문이 `stripSessionId` 와 대조). 관문 links ②.
- 링크 사냥꾼: 학교 서버에 못 닿은 표적은 횟수에 안 세고 내일로 미룬다 · 장부는 저장 직전 `pruneHuntState` 가 데이터에 없는 열쇠를 걷는다 ·
  이번에 처음 알리는 공고는 리포트 머리(`escalationLines`) · 게시판을 못 연 문구는 `boardUnreachableWhy` 한 곳(원인 단정 금지). 관문 links ③④⑤.
- 원문 링크 복구 로봇(`collector/resolve-detail-urls.mjs`)은 바깥 시계로 스스로 저장하고 끝내며, 소급 재검사는 없다(그 판정은 `collector/link-check.mjs` 몫 · 2026-10-05 결정).
  예약 주석의 요일·시각은 관문이 cron 과 대조한다(UTC 월 20시대 = KST 화). 관문 links ⑥⑦.

## 화면 검사 CI (ci)

- 🔴 화면 검사(`.github/workflows/verify-ui.yml`)는 하나가 넘어져도 끝까지 돈다 — 드라이버 실패는 `||` 로 모아 끝에 한 번 · 뒤 단계는 `!cancelled()` ·
  루프 예산을 넘으면 남은 이름을 '못 돎'으로 넘기고 실패 · 경보는 화면 검사가 돌았는지부터 가른다(`set -e` 로 되돌리지 말 것). 관문 ci ②.
- 드라이버가 실데이터에서 대상을 못 찾으면 실제 항목을 복사한 표본으로 몬다(`verify/open-form-sample.cjs` · 칸이 적은 가짜 항목 금지 · 마지막엔 앱 내장 양식). 관문 ci ①.
- 작업 브랜치 배포(`device-deploy.yml`) 뒤엔 화면 검사를 버튼 실행으로 깨운다(기본 열쇠의 push 는 다른 워크플로를 못 깨운다) · 배포를 막지는 않는다(개발자 결정 대기). 관문 ci ③.
- 종류를 모르는 자기소개서 칸은 감사가 경고한다(`verify/essay-unknown-fields.cjs` · 서술형 'story' 는 세션이 단다 — 양식을 고쳤으면 `essay-ask.js` 에 더한다). 관문 ci ④.

## 경보 · 리포트 이슈 (alerts)

- 🔴 **경보 이슈는 한 곳**(`tools/alert-issue.mjs` · 공용 액션 `.github/actions/alert-issue`) — 제목으로 찾아 댓글 · 같은 초 중복은 닫고 · 회복하면 resolve 로 닫는다.
  여는 단계와 닫는 단계의 제목·찾는 방식(`--match prefix`)이 같아야 닫힌다.
- 🔴 실패 알림은 이슈로 사람에게 닿는다 — `failure()`·`cancelled()` 단계가 요약 한 줄·`::warning` 뿐이면 관문이 빨갛다(뒤의 robot-down·alert-issue 가 같은 갈래를 덮으면 통과) ·
  로컬 액션 앞에 checkout · gh 로 라벨을 붙이면 그 라벨을 먼저 만든다. 넘어짐 알림은 개수가 아니라 덮는가로 잰다(`coversDown`). 관문 alerts ⑥⑧⑫.
- 로봇 알림은 제 리포트 이슈 제목 **전체**로 찾는다(`"장학공고 수집 리포트"` — 맨 `"수집 리포트"` 는 다른 로봇 이슈를 집는다). 관문 gate ⑤(워크플로 전부).
- 넘어짐 경보(robot-down)는 하트비트가 닫는다(`collector/robot-heartbeat.mjs` · 예약이 있으면 예약 실행의 성공만 · 경보 뒤에 시작한 성공만 · 못 읽으면 둔다).
- 지난 리포트 이슈 정리는 `tools/report-retention.mjs` 한 곳(유형별 최신 몇 건) — 경보·사냥꾼·인스타(🚨🔧📸🛰🎨)는 넣지 않는다(각자 닫는 길이 있다).
- 실제 앱 반영 확인(check-live)이 대조하는 파일은 `tools/app-fetch-files.cjs` 가 앱 스크립트에서 뽑는다(손 목록 금지) · 어긋나면 3분 뒤 한 번 더.

## 푸시 · 서버 (servers)

- 서버 워커(`server/*`)는 공용 파일을 기본 가져오기로(`import ME from '../../match-engine.js'`) — `createRequire`·`node:` 모듈은 Workers 에 올리는 순간 넘어진다. 관문 servers ①.
- 🔴 **푸시 서버는 공용 규칙의 사본을 둔다**(빌드 감시가 `server/push/*` 뿐) — `titleSeenKey`·`SHARED_BOARD_BRANCH`·`TITLE_CAMPUS`·`taggedSchool`·수집일 이틀을 바꾸면
  `server/push/worker.js` 도 같이(관문 servers ⑥⑧ 이 대조). 기본 브랜치 push 즉시 배포라 `node verify/verify-push-server.mjs` 먼저.
- 푸시 서버 plan 걸음은 장부만 다룬다 — 글자 일은 notices 걸음에서 끝낸다(무료 등급 한 걸음 10ms). 관문 servers ⑥.
- 푸시 매일 확인 판정은 `tools/push-health-verdict.mjs` 한 곳(예약 회차가 돌았나 · 발송 회차가 받아졌나 · 살아 있는 구독에 보냈는데 0 일 때만 경보). 관문 servers ③④⑤.
- 로그인 서버 매일 확인 `.github/workflows/supabase-health.yml`(`tools/supabase-health.mjs` · 공개 열쇠로 health 만) — 설정을 못 읽으면 '꺼짐'이 아니라 실패 ·
  '휴면 방지'라고 적지 말 것(확인 안 함). 관문 servers ⑨.
- 서비스워커 푸시 처리는 불러온 파일의 이름을 `typeof` 로 본다 — 공용 파일 하나가 안 실려도 알림 1건. 관문 servers ⑩.

## 인스타 (insta)

- 🔴 카드 그림에 상대 날짜(`마감 D-N`·`오늘 마감`)를 박지 않는다(그림은 굳는다 · 'M월 D일 마감') · 마감 지난 카드·2026-10-04 전에 그린 옛 D-N 카드는 게시 거절 —
  `publishRefusal` ↔ 관리자 `instaPublishBlock` 짝. 관문 insta ①.
- 대기줄은 작업마다(같은 공고끼리만) · 장부 `insta/seen.json` 은 `mergeInstaSeen`(올림 기록은 절대 안 버린다) · 게시 작업은 main 에 안 올린다. 관문 insta ②④.
- 장부 줄·정리·올림 기록은 `insta/pick.mjs` 한 곳 — ledger·revise·publish 가 불러 쓴다. 관문은 그 명령을 임시 폴더에서 실제로 돌린다.
- 마감 지난 준비 카드는 준비 실행마다 `insta/ledger.mjs` expire 가 만료·폴더 삭제(올린 것 제외 · 사람이 건너뛴 카드는 다시 안 그린다). 관문 insta ⑦⑨.

## 관리자 (admin)

- 관리자 버튼으로 많이 지울 때(5건 초과 또는 목록 10% 초과) 지울 건수를 숫자로 한 번 더 받는다 — 문턱 `tools/edit-diff.mjs` `needsBulkExpect` 한 곳(숫자를 화면이 미리 채우지 말 것).
- 🔴 관리자 조정·수집 로봇 「지금 실행」은 수집 대기줄(group: collector)에 기다리는 실행이 있으면 보내지 않는다(새 실행이 기다리던 실행을 취소한다) — 목록 `COLLECTOR_QUEUE` 는 관문이 워크플로와 대조.
- 실패 문구는 실행의 단계 결과와 거절 문장으로만 말한다(`runFailureText` · 단계 이름은 admin-apply.yml `name:` 과 글자까지 같게) · 저장 여부를 모르면 '확인하지 못했습니다'.
- `node --check _admin/admin.js` 는 같은 이름 두 번 선언을 통과시킨다 — 관문이 .mjs 사본으로 잰다. 시험 실행은 admin-apply.yml `dry_run`(적용 + 감사까지 · 저장·이슈 없음).

## 데이터 갱신 로봇 (refresh)

- 한국장학재단 공고문 사본의 '같은 파일' 판정은 `attachKey`(서버 저장 이름) 한 곳 — 주소 전체로 비교하지 말 것(끝 값이 받을 때마다 바뀐다). 관문 refresh ⓐ.
- 학교·시작 화면 사진을 고르면 원본 제목(`title`)도 같이 적는다 — 빌드가 `pickProblems`·`startScreenChanged` 로 멈춘다. 관문 refresh ⓕ.
- 학과 로봇은 서비스 학교 파일이 빠지면 관문이 아니라 리포트와 `::warning` 으로 알린다 · BRANCH_MAP 에는 리포트의 원래 이름을 그 글자 그대로만. 관문 refresh ⓓ.
- 수집 대기줄(group: collector)에는 registered.json 을 쓰는 로봇만 세운다 — 학과·등록금 갱신은 제 줄. 관문 admin · refresh ⓔ.

## 운영 감시 (ops)

- 배포 감시(`verify/check-deploy-sync.js`)의 ❌ 는 갈라진 뒤 **내 쪽에만** 있는 앱 변경뿐(세 점 비교 · assets/ 포함 · main 만 앞선 것은 참고) — 해결은 세 곳 push. 관문 ops ①.
- 예약 시각은 목표일 뿐 수 시간 늦고 일부는 걸러진다 — 순서가 필요한 일은 workflow_run 으로 잇는다 · 하트비트 문턱은 간격 × 3(최소 12시간) · 기본 브랜치·main 의 성공만 센다. 관문 ops ②③.
- 노션 「작업 현황」 '브랜치' 칸은 이 push 가 올린 커밋을 가리키는 작업 브랜치(`tools/notion-branch.mjs`) · 노션 쓰기는 재시도를 거친다. 관문 ops ④.
- `tools/robot-run.sh` 의 데이터 로봇 목록은 손으로 적지 않는다 — `tools/data-robots.mjs` 가 워크플로에서 읽는다 · gh 를 못 물으면 멈춘다. 관문 ops ⑤.
- 링크 정찰은 push 로 깨면 **이번 push 가 넣은 줄만** 연다(`collector/probe-lines.mjs`) — 다시 보려면 줄을 지웠다 넣거나 수동 실행 · 답 받은 줄은 `# (답 받음 …)`. 관문 ops ⑥.
