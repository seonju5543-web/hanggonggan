
### gate
- 🔴 데이터 관문이 빨가면 `collector/gate-guard.mjs` 가 단계별로 되돌리고(새 자동 등록분 → 파일을 직전 판 바이트로) 매번 다시 잰다 · 끝내 빨가면 still-failing = 빨간불 + 이슈 · 두 번 걸린 공고는 3일 쉰다(`collector/auto-held.mjs`). 관문 `verify/health-gates/gate.mjs` ④ (「로봇 · 워크플로」의 '감사 실패면 결과가 하나도 안 남는다' 줄을 이것으로 바꾼다)
- 🔴 관리자가 고치는 데이터의 불변식은 test-collector 가 아니라 감사 **오류**로(`verify/source-rules.cjs` auditSourceFiles · `verify/entry-rules.cjs` checkEntry) — 관리자 저장소도 같은 함수로 먼저 거절한다. 관문 `verify/health-gates/gate.mjs` ②(감사가 경고로 낮추지 않았는지까지)
- 🔴 test-collector 의 실데이터 읽기는 톱니로 잠겼다(`REAL_READ_ALLOW` · 도구가 대신 읽는 `TOOL_READS_ALLOW`) — 늘리지 말고 감사 또는 표본 + ℹ 로. 관문 `verify/health-gates/gate.mjs` ③
- 알림 이슈 검색어는 제 리포트 이름 전체로('"장학공고 수집 리포트"' 등) — 맨 '"수집 리포트"' 는 부분 일치라 다른 로봇의 이슈를 집는다. 관문 `verify/health-gates/gate.mjs` ⑤(워크플로 전부)
- 학위 줄: 학사·석사를 나란히 적은 '과정'(`및`·`또는`·`,`)은 학부도 받는다(`UNDERGRAD_TOO`) · '둘 다' 갈래도 남는 글자가 2자 넘으면 모름(`degreeRest`) — 틀린 미달·틀린 안심 둘 다 막는다. 관문 `verify/health-gates/gate.mjs` ①
- 「로봇 · 워크플로」: 🔴 데이터 관문이 빨가면 `collector/gate-guard.mjs` 가 단계별로 되돌리고(새 자동 등록분 → 정식 등록·양식·대기열 HEAD 판) 그때마다 관문을 다시 잰다 · 끝내 빨가면 실패 알림 뒤에서 이슈 + exit 1 · 두 번 걸린 자동 등록은 3일 쉰다(`collector/auto-held.mjs`). 관문 `verify/health-gates/gate.mjs` ④.
- 「로봇 · 워크플로」: 관리자가 고치는 데이터·설정의 불변식은 test-collector 가 아니라 감사에 둔다 — 출처 `verify/source-rules.cjs` · 문구 끝 날짜 = 마감은 `checkEntry`(`lastDateIn` 은 entry-rules 한 곳) · `tools/admin-apply.mjs` 가 저장 전에 같은 함수로 거절. 관문 `verify/health-gates/gate.mjs` ②.
- 「훅 · 검사 운영」: test-collector 의 실데이터 읽기는 파일별 톱니(`REAL_READ_ALLOW`)로 잠겼다 — 늘리지 말고 항목 불변식은 audit-data, 개수·'있어야 한다'는 표본 + ℹ 숫자. 관문 `verify/health-gates/gate.mjs` ③.
- 「로봇 · 워크플로」: 로봇 알림은 제 리포트 이슈 제목 전체로 찾는다(`"장학공고 수집 리포트"`·`"브라우저형 수집 리포트"` — 맨 `"수집 리포트"` 는 다른 로봇 이슈를 집는다). ⚠️ CLAUDE.md 가 지금 400줄 상한이라 넣으려면 다른 줄을 줄여야 한다.

### feed
- ⚠️ CLAUDE.md 는 지금 400줄 상한에 딱 닿아 있다(split 400 · 59,044B — 관문 「CLAUDE.md 부피」). 아래는 새 줄이 아니라 기존 줄 끝에 이어 붙인다.
- [324행 '- 주소 같음 판정 `urlKey()`/`canonUrl` 한 곳 · … (`notStale`).' 끝에 이어 붙이기] 실시간 공고 피드는 매 수집 학교별 파일 → 후보 장부(`FEED_HEAL_SINCE` 뒤) 순으로 스스로 메운다(`healFromLedger` · 학교별 파일 상한 안만) — 피드에서 빼는 새 규칙은 메우기 거르기에도 걸고, 손으로 지울 땐 학교별 파일·`collector/candidates.json` 까지 · 장부 밖 유실은 `collector/heal-feed.mjs`(차례는 관문이 수집기와 대조) · 관문 「로봇·도구 점검 관문」 feed.
- [「폰은 `notices.json` 을 받지 않는다 …」 항목의 '… 관문 「학교별 공고 파일」.' 끝에 이어 붙이기] 글이 없는 학교의 옛 파일은 지우지 않고 빈 파일로(`publishBySchool` · 지우면 로봇끼리 수정/삭제 충돌) · 화면 0건 서비스 학교는 수집 리포트 머리 🙋 줄(`zeroFeedSchools`·`zeroFeedWhy` — 0건 날엔 코멘트에 붙는다).
- **실시간 공고 피드는 스스로 돌아온다** — 수집기는 seen 만 보고 '피드에 있나'는 안 물어, 빠진 글은 영영 안 돌아왔다(9-30 병합 사고 215건). 두 수집기가 `healFromLedger`(학교별 파일 먼저 → 후보 장부 · `FEED_HEAL_SINCE` 이후)로 메운다 · 지금 글은 바꾸지 않는다 · 사람용 복구는 `collector/heal-feed.mjs`. 관문 「로봇·도구 점검 관문」 feed.
- 글이 없는 학교의 학교별 파일은 지우지 않고 빈 파일로(`publishBySchool` · 지우면 병합기가 못 푸는 수정/삭제 충돌) · 화면 0건 학교는 수집 리포트 머리 한 줄(`zeroFeedSchools` · 까닭은 `zeroFeedWhy` — 브라우저 로봇 학교를 '주소 없음'이라 적지 않는다). 관문 같은 절 feed.
- 누락 감사의 '가진 것'은 학생이 보는 것(피드 + 학교별 파일 + 정식 등록)뿐이다 — 장부를 섞으면 피드에서 빠진 글이 안 보인다(`coverageSets` 한 곳 · 장부는 '수집했지만 피드에서 빠짐' 원인으로만). 관문 같은 절 feed ④.

### bodies
- **자격요건 로봇(`collector/rescue-bodies.mjs`)은 단계 시한 전에 스스로 끝난다** — 한 공고 절대 시한 · 공고마다 저장 · 감시 타이머(예산+한 공고 시한+30초, 저장 후 종료 1) · 저장은 `writeFileAtomic`(임시 파일 → 이름 바꾸기). 대상·차례·장부 규칙은 `collector/rescue-plan.mjs` 한 곳(로봇은 불러오면 돌아 관문이 못 부른다). 관문 health-gates bodies ①.
- 🔴 `continue-on-error` 단계가 잘려도 작업은 초록이다 — 그런 핵심 단계는 저장 **뒤**에 `steps.<id>.outcome != 'success'` 로 실패를 남기고, 실패 알림은 **이번 실행** 리포트만 붙인다(옛 판을 붙이면 다른 날 일로 읽힌다). 관문 health-gates bodies ①ⓒ(스크립트를 가짜 github 로 진짜 돌린다).
- **자격용 공고문 첨부(`deepfetch --elig-attach`)는 받은 그대로면 다시 안 받는다**(첨부 목록 서명 `attSig` · 같은 바이트면 파생 글자 보존 · 마감 지난 공고 제외) — 규칙 `collector/elig-attach-plan.mjs` 한 곳. 관문 health-gates bodies ③.
- **증분 받기(`deepfetch --fill`)의 물러서기는 받기 실패와 껍데기를 둘 다 센다**(`fillRetired`·`fillCounts` · 지난 수는 notices-text.json 의 원래 항목에서) · 받기 전체에 예산. 관문 health-gates bodies ④.
- PaddleOCR 엔진이 통째로 고장 나면 `paddle-ocr.py` 가 종료 2 + `paddle-status.json` → `activity-docs.mjs --apply` 가 그 글의 무료 기회를 되돌린다(`rollbackOcrTries`) · 워크플로에서 `|| true` 로 삼키지 말 것(경고로 바꾼다). 관문 health-gates bodies ②.
- 브라우저 수집의 클릭형 게시판 본문은 `clickBodyEntry`(열렸나·이 행 제목이 있나·목록 화면 아닌가) · 저장하는 본문은 늘 `browserBodyEntry`(줄을 살린 것). 관문 health-gates bodies ⑦.

### browser
- **브라우저 수집 건강 장부**: 학교 결과는 `collector/browser-health.mjs` 한 곳(열렸지만 장학 0건 = 실패 · 예산 건너뜀 = 안 적음) · 브라우저 쪽 연속 횟수는 `browserFails`(일반 로봇이 같은 줄 `fails` 를 되돌린다) · 일반 로봇이 ✅ 인 학교는 `browser-targets.json` `parked` 로. 관문 「로봇·도구 점검 관문」 browser ②④ · 「수집망 복원」.
- **열쇠 규칙(urlKey·canonUrl 의 VOLATILE)을 바꾸면** 두 목록에 같은 이름 + 옛 열쇠 장부는 `rekeyLedger`(수집 장부 · 옛 열쇠 남김)·`rekeyKey`(썸네일 장부는 옮긴다)로 잇는다 · `idFromUrl` 공식은 그대로. 관문 「로봇·도구 점검 관문」 browser ①.
- **대외활동·재단 출처 연속 실패**는 `collector/source-health.json`(`collector/source-health.mjs` · 열쇠 = 게시판 주소 · 6회면 리포트 머리 🙋 한 줄 — 0건 날 코멘트에도 실린다). 관문 「로봇·도구 점검 관문」 browser ⑥.
- **학교 도메인**(판정 로봇의 학교 이메일 신호)은 `domainForSchool` 한 곳(`collector/kind-evidence.mjs` — schools.json 주소 → 없으면 브라우저 대상 첫 후보 · 보관은 안 본다).

### qnotice
- **메일 접수 예외**: '오류 발생 시에만' 예비 메일·'신청은 다른 곳 · 메일은 서류만' 줄은 접수처가 아니다(`judgeLine`) · 이미 들어간 로봇 값도 매 실행 다시 묻는다(`staleApplyEmail` · 사람 값은 그대로). 관문 「로봇·도구 점검 관문」 qnotice ①.
- **기간 힌트·본문 마감은 껍데기를 걷고 읽는다**(`makeBodyReader` · `hintWithoutChrome`) — 껍데기를 모르는 호스트는 읽지 않는다(배너 날짜가 모든 글의 마감이 된다) · 칸은 `bodyDeadline`(앱 카드의 deadline 아님 · 폰 파일엔 안 싣는다). 관문 같은 절 ②③.
- 🔴 **등록 뒤 마감 경과 로봇 등록분은 자동 등록이 뺀다**(`registeredAfterDeadline`) · 뺀 사업은 지난 회차 장부(`collector/past-rounds.mjs` · 60일)가 같은 사업의 다른 학교 글을 컨펌 대기로 막는다 — 빼면 짝이 사라져 다른 학교 글이 등록·전국 승격됐다. 관문 같은 절 ③.
- **범위 승격·흡수는 마감 전 로봇 등록분끼리만** — 판정은 `collector/registered-merge.mjs` 의 `promotableOn`·`absorbsOn`·`openOn` 한 곳(승격 로봇·자동 등록 공용 · 관리자 merge 는 사람이 정해 예외). 관문 같은 절 ④.
- **포털 근거 낱말은 `hasPortalName` 한 곳**(시스템 표 + 포털·포탈·…정보시스템) — 표에 이름을 넣을 때 데이터 검사 목록을 따로 고치지 않는다 · 표에는 학교 고유 이름 + 근거 2건 이상만(`portalNameCandidates` 후보 리포트). 관문 같은 절 ⑦.
- **실린 글 제목 소급**: 장학·활동·재단은 `retitleItems`, 소식은 `retitleStored`(행 번호는 게시판 단위 80% · `dropRowNumbers`) — 제목만 고치고 주소·글 번호는 그대로. 관문 같은 절 ②⑤.
- **도우미 검색 재료**(`buildSearchIndex`)는 껍데기·남의 제목·이전글·목록 위젯 줄을 걷고 뽑는다 · 불러오기만 하면 파일을 안 쓴다. 관문 같은 절 ⑥.
- 카드 윗줄(`cardOrgLine`)은 기관명을 못 읽으면 「교외」만 — 앱 사정은 학생 화면에 안 적는다(2026-09-17 결정과 같은 규칙).
- 양식 로봇 리포트에 '양식이 붙은 열린 공고 n건'(0~1건이면 🚨) · 옛 양식 짝은 후보로만(`formReachReport` · 잇기는 개발자 결정) · `verify/verify-new-forms.js` 는 표본 공고를 응답에 심어 늘 돈다(실데이터가 비어도 '건너뜀'으로 조용하지 않게). 관문 같은 절 ⑧.
- **메일 접수 예외** — '오류 발생 시에만' 예비 메일·'신청은 다른 곳 · 메일은 서류만' 줄은 접수처가 아니다(`judgeLine` 은 앞 두 줄까지 본다) · 이미 들어간 로봇 값도 발췌기가 매 실행 다시 묻는다(`staleApplyEmail` · 사람 값은 그대로). 관문 「로봇·도구 점검 관문」 qnotice ①.
- **기간 힌트·본문 마감은 껍데기를 걷은 본문으로** — 같은 호스트 여러 쪽에 똑같이 나오는 줄(머리 배너)을 걷는다(`hintWithoutChrome`·`makeBodyReader` · 껍데기를 모르는 호스트는 본문 마감을 안 읽는다) · `bodyDeadline` 두 칸은 로봇 장부에만(`forPhone`). 관문 같은 절 qnotice ②③.
- **자동 등록은 본문 마감을 먼저 본다**(`collector/notice-deadline.mjs` `parseDeadline`) · 등록 뒤 지난 마감을 받은 로봇 등록분은 다음 실행이 뺀다(`registeredAfterDeadline` · 감사는 경고) · 범위 승격·흡수는 마감 전만(`openOn`). 관문 같은 절 qnotice ③④.
- **카드 윗줄에 '모름' 표시를 안 쓴다** — 주관 기관이 `주관 기관 원문 확인` 이면 `교외`만(`providerUnknown` · 지원서 초안과 한 곳 · 2026-09-17 지시). 관문 「카드 제목」.
- **양식 로봇 리포트는 '열린 공고 n건 중 양식 m건'을 매 실행 싣는다**(0~1건 🚨 · 옛 양식 후보는 자동으로 잇지 않는다 · `collector/form-reach.mjs`). 관문 같은 절 qnotice ⑧.
- **소식 행 번호는 게시판 단위로만 뗀다**(`dropRowNumbers` 80% — 한 제목만 보고 1~2자리를 떼지 말 것) · 실린 소식 제목도 발행 때 같은 청소(`retitleStored` · 주소·글 번호 그대로). 관문 같은 절 qnotice ⑤.

### qfeeds
- 재단·지자체 글 거름은 `collector/external-clean.mjs` `dropReason` 한 곳 — 마감 다음 날까지만 · 제목 머리 [마감] · 마감 칸 없는 옛 글은 `fillDeadlineFromHint`(수집과 같은 판독기)로 채운다. 앱에서 따로 거르지 않고, 병합기도 합친 뒤 다시 건다(`mergeExternal`). 관문 `verify/health-gates/qfeeds.mjs` ②③.
- 소식 발행: 앞날 게시일은 비운다(`clearFuturePosted` · newsFloor 앞) · 출처에서 뺀 게시판의 글은 뺀다(src 열쇠 · `collector/news-board-rules.mjs` `dropRetiredBoards` — 열쇠 없는 옛 글은 짐작해 빼지 않는다) · 장부는 `pruneSeen`(90일 · 실린 글·다시 본 글·못 읽은 게시판의 열쇠는 남김). 관문 qfeeds ①⑤⑦.
- 활동 자격 줄 거름은 `collector/activity-excerpts.mjs` `eligLineOk` 한 곳(여러 갈래 나이·개인정보 안내문 — 틀린 미달). 실린 글 `sanitizeElig`·브라우저 장부 `mergeBrowserResults` 도 같은 함수를 쓴다. 관문 qfeeds ④.
- 활동 피드 60일·상한은 `collector/open-api-map.mjs` `actKeepDate` 한 날짜(`capActivities` — 순서는 foundAt 그대로). 공공 API 출처는 서버 묶음(host)끼리 동시에 받고(`runSourceGroups`) 결과는 API_SOURCES 순서로 채운다. 관문 qfeeds ⑨⑪.
- robots.txt: 대외활동·재단 출처는 학교 사이트라도 지키고, 학교 장학·소식 게시판은 묻지 않는다(`collector/robots.mjs` 머리말). 바꾸려면 머리말과 관문 qfeeds ⑫를 같이 고친다.
- 실린 재단·활동 글에 지금 발행 규칙을 바로 다시 걸 때: `node tools/refilter-feeds.mjs [--write]`(사이트를 두드리지 않는다 · 수집 로봇이 다음 실행에 같은 일을 한다).

### links
- **자동 등록 id 가 겹치면 꼬리표 id** — 공식 `idFromUrl`(정렬한 주소의 끝 24자)은 그대로 두고, 겹칠 때만 옛 id 뒤에 주소 꼬리표를 단다(`registerId` 한 곳 · 로봇과 관리자 등록이 같이 쓴다). 꼬리표 id 는 고정되지 않으므로 막음·쉬기·차단 풀기는 두 꼴을 다 본다(`blockedTagged`). 관문 「로봇·도구 점검 관문」 links ①.
- **주소 경로의 세션 표식(;jsessionid=)은 같은 글 판정에서 뗀다** — `canonUrl`·`urlKey` 가 떼고, 로봇이 담는 주소는 `cleanStoredUrl` 로 씻는다(원본 규칙 `stripSessionId` · 두 파일은 한 줄만 옮겨 두고 관문이 같은 답을 내는지 대조). 관문 「로봇·도구 점검 관문」 links ②.
- 링크 사냥꾼: 학교 서버에 못 닿은 표적은 횟수에 안 세고 내일로 미룬다(`recordAttempt` · 우리 시간 상한으로 못 본 것은 안 미룸). 게시판을 못 연 표적의 장부 문구는 관리자 「죽은 링크」에 걸리지 않게 `boardUnreachableWhy` 한 곳에서 만든다(원인 단정 금지). 관문 같은 절 links ③.
- 사냥꾼 장부 `collector/link-hunt.json` 은 저장 직전 `pruneHuntState` 가 데이터에 없는 열쇠를 걷어 낸다(합집합 병합으로 돌아와도 다음 실행이 다시 걷음). 이슈 본문 첫머리에는 이번에 처음 알리는 공고를 싣는다(`escalationLines`). 관문 같은 절 links ④⑤.
- 원문 링크 복구 로봇(`collector/resolve-detail-urls.mjs`)은 바깥 시계로 스스로 저장하고 끝내며, 소급 재검사는 하지 않는다(그 판정은 `collector/link-check.mjs` 몫). 워크플로 예약 주석의 요일은 KST 로 적는다 — UTC 월 20시대는 KST 화요일이다. 관문 같은 절 links ⑥⑦ 이 cron 줄 전부를 대조한다.
- **자동 등록 id 는 겹칠 때만 꼬리표** — 옛 공식(`idFromUrl` 끝 24자)은 그대로, 같은 id 를 다른 주소가 쥐었으면 `<옛 id>-<idHash>`(`registerId` 한 곳 · 자동 등록·관리자 등록 공용). 막은 id 를 여러 글이 받으면 막은 주소(blockUrls)만 막는다. 관문 「로봇·도구 점검 관문」 links ①.
- **저장하는 원문 주소는 씻는다** — HTML 기호·경로 세션 표식(`;jsessionid=`)을 `cleanStoredUrl`(detail-url.mjs)로 · canonUrl·urlKey 도 세션을 뗀다(옮긴 한 줄은 관문이 stripSessionId 와 대조). 관문 links ②.
- **링크 사냥꾼 장부**: 못 닿음(net)도 내일로 미룬다(우리 시간 상한만 `defer:false`) · 저장 직전 `pruneHuntState` 가 데이터에 없는 열쇠·꺼진 순찰 흔적을 걷는다 · 이번에 알리는 공고는 리포트 머리(`escalationLines`). 관문 links ③④⑤.
- **원문 링크 복구 로봇에 소급 재검사는 없다**(2026-10-05 개발자 결정 — 이미 고친 주소 확인은 link-check 몫) · 바깥 시계가 있다 · 예약 주석의 요일·시각은 관문이 cron 과 대조한다(UTC 월 20시대 = KST 화). 관문 links ⑥⑦.

### ci
- 🔴 **화면 검사(verify-ui.yml)는 한 곳이 넘어져도 그물이 남고 스스로 끝낸다** — 드라이버 실패는 `||` 로 모아 끝에 한 번 · 브라우저 경로 뒤 경보 앞까지 모든 단계 `!cancelled()` · 루프 예산 20분(넘으면 남은 이름을 `unrun` 으로 넘기고 실패) · 전 여정 5분.
  경보는 화면 검사가 돌았는지·못 돈 것부터 가른다. 관문 `verify/health-gates/ci.mjs` ②(루프·경보 셸을 가짜 node·gh 로 실제로 돌린다 — 글자 대조는 `|| echo` 를 못 잡았다).
- **화면 검사 드라이버는 실데이터에 기대지 않는다** — 보이는 양식 공고가 없거나 전부 마감이면 표본(`verify/open-form-sample.cjs` `openFormSample` · 등록 목록에 없으면 앱 내장 양식)으로 같은 길을 몬다.
  관문 ci ①(`driveAnyLiveForm` 을 가짜 page·driveOneForm 으로 실제로 돌린다 — 조건을 `ids.length &&` 로 감싸는 10-04 꼴을 줄 세기로는 못 잡았다).
- 작업 브랜치 배포(`device-deploy.yml`) 뒤엔 화면 검사를 버튼 실행으로 깨운다(기본 열쇠의 push 는 다른 워크플로를 못 깨운다) · 배포를 막지는 않는다(개발자 결정 대기). 관문 ci ③.
- 종류를 모르는 자기소개서 칸은 데이터 감사가 **경고**한다(`verify/essay-unknown-fields.cjs` `unknownStoryFields` · 주간 검사와 같은 함수) — 'story' 는 세션이 단다(양식 로봇은 kind 를 안 단다). 관문 ci ④.
- **화면 검사(verify-ui)는 하나가 넘어져도 끝까지 돈다** — 드라이버 실패는 `||` 로 모아 끝에 한 번 · 뒤 관문 셋은 `!cancelled()` · 경보는 `failure()` 그대로(`set -e` 로 되돌리지 말 것 — 기본 셸이 bash -e). 관문 「로봇·도구 점검 관문」 ci ② (`verify/health-gates/ci.mjs`).
- **드라이버가 실데이터에서 대상을 못 찾으면 실제 항목을 복사한 표본으로 몬다** — 규칙은 `verify/open-form-sample.cjs` 한 곳(칸이 적은 가짜 항목 금지 · 마지막엔 앱 내장 양식). 관문 같은 곳 ci ①.
- **서술형 칸(kind 'story')은 세션이 단다** — 양식을 고쳤으면 감사의 '자기소개서 칸 … 종류를 모릅니다' 경고를 보고 essay-ask.js `ESSAY_KINDS` 에 더한다(규칙 `verify/essay-unknown-fields.cjs` · 경고만). 관문 ci ④.

### alerts
- **경보 이슈는 한 곳**(`tools/alert-issue.mjs` · 공용 액션 `.github/actions/alert-issue`) — 라벨이 아니라 제목으로 찾아 댓글·같은 초 중복 닫기, 회복하면 resolve. 실패 알림을 `::warning`·요약 한 줄로 두지 말 것(넘어짐은 robot-down). 관문 「로봇·도구 점검 관문」 alerts ⑥ S1~S4.
- 넘어짐 경보(robot-down)는 하트비트가 닫는다(`collector/robot-heartbeat.mjs` --close-recovered · 예약이 있으면 **예약 실행의 성공만**(`successEventFor`) · 경보 뒤 시작 또는 경보 낸 실행보다 뒤에 생겨 경보 뒤에 끝난 것만 · 못 읽으면 둔다 `mergeLastOk`). 로컬 액션 앞엔 체크아웃. 지난 리포트 정리 규칙은 `tools/report-retention.mjs` 한 곳.
- 실제 앱 반영 확인(check-live)은 앱 스크립트의 fetch·getDoc 글자에서 받는 파일을 뽑아 지문으로 대조한다(`tools/app-fetch-files.cjs` · 손 목록 금지) · 어긋나면 3분 뒤 main 을 다시 받아 한 번 더.
- 🔴 워크플로 **글자**를 재는 관문은 로봇 워크플로에선 경고만(`softEq` · `DOC_GATES` 와 같은 잣대 — 다른 세션의 무해한 단계 하나로 모든 로봇 결과가 되돌려지지 않게) · 엄격한 곳은 로컬과 verify-ui(`.github/workflows/**` 감시). 넘어짐 알림은 개수가 아니라 덮는가로 잰다(`coversDown`·`broadFailKinds` — && 로 좁힌 조건은 못 덮는다). 관문 「로봇·도구 점검 관문」 alerts ⓪⑧⑫.
- **경보 이슈는 한 곳**(`tools/alert-issue.mjs` · 공용 액션 `.github/actions/alert-issue`) — 라벨이 아니라 제목으로 찾아 댓글, 같은 초 중복은 닫고, 회복하면 resolve 로 닫는다. 넘어짐 경보(robot-down)는 하트비트가 닫는다(로봇의 마지막 성공이 경보 뒤에 시작했을 때만). 관문 「로봇·도구 점검 관문」 alerts.
- 🔴 **실패 알림은 이슈로 사람에게 닿는다** — failure()·cancelled() 단계가 요약 한 줄·::warning 뿐이면 관문이 빨갛다(뒤의 robot-down·alert-issue 가 같은 실패 갈래를 덮으면 통과) · 로컬 액션 앞에 checkout · gh 로 라벨을 붙이면 그 라벨을 먼저 만든다. 관문 「로봇·도구 점검 관문」 alerts ⑥.
- 지난 리포트 이슈 정리 규칙은 `tools/report-retention.mjs` 한 곳(유형별 최신 몇 건) — 경보·사냥꾼·인스타(🚨🔧📸🛰🎨)는 넣지 않는다(각자 닫는 길이 있다).
- 실제 앱 반영 확인이 대조하는 파일은 `tools/app-fetch-files.cjs` 가 앱 스크립트의 fetch·getDoc 글자에서 뽑는다(손 목록 금지) · 어긋나면 3분 뒤 main 을 다시 받아 한 번 더 본다.

### servers
- **서버 워커가 공용 파일을 불러 쓸 때는 기본 가져오기로**(import ME from 꼴) — Workers 에는 node:module 이 없어 `createRequire` 꼴은 올리는 순간 넘어진다. 관문 「로봇·도구 점검 관문」 servers ①.
- 🔴 **푸시 서버는 공용 규칙의 사본을 둔다**(빌드 감시가 `server/push/*` 뿐) — `titleSeenKey`·`SHARED_BOARD_BRANCH`·`TITLE_CAMPUS`·`taggedSchool`·수집일 이틀을 바꾸면 `server/push/worker.js` 도 같이(servers ⑥⑧ 이 대조 · ⑥(e) 경계 표본). 기본 브랜치 push 즉시 배포라 `node verify/verify-push-server.mjs` 먼저.
- 🔴 **푸시 서버 plan 걸음은 장부만 다룬다** — 글자 일(제목 다듬기·수집일·분교)은 notices 걸음의 `noticeMini` 에서 끝낸다(무료 등급 한 걸음 10ms · 새로 뜬 실행 환경의 첫 부르기로 잰다). 장부는 줄 단위(state:seenLines)이고 옛 state:seen 은 읽기만 한다. 관문 servers ⑥(c)(d)(g).
- 푸시 서버 매일 확인은 상태 응답의 `lastSlot`·`lastRun`·`lastSentRun` 으로 '예약 회차가 돌았는가'와 '발송 회차가 받아졌는가'를 본다(판정 `tools/push-health-verdict.mjs` 한 곳 · 살아 있는 구독에 보냈는데 받아 준 수 0 일 때만 경보). 관문 servers ③④⑤.
- 로그인 서버 매일 확인 `.github/workflows/supabase-health.yml`(`tools/supabase-health.mjs` · 공개 열쇠로 health 만 묻는다) — 설정을 못 읽으면 '꺼짐'이 아니라 실패(robot-down) · '휴면 방지'라고 적지 말 것(확인 안 함). 관문 servers ⑨.
- 서비스워커 푸시 처리는 불러온 파일의 이름을 `typeof` 로 본다 — 공용 파일 하나가 안 실리면 그 자리에서 던져 알림 0건(iOS 는 되풀이되면 구독을 끊을 수 있다). 관문 servers ⑩.
- 관문 묶음 파일(verify/health-gates/)이 **문서 글자**를 재면 `softEq` 로 감싼다 — 로봇 워크플로에서는 경고만 하고, 로컬과 DOC_GATES=1 에서는 실패한다(test-collector 는 수집 로봇의 데이터 관문이라 빨간불이면 자동 등록분이 되돌려진다). 관문 servers ②⑨ · alerts.
- (개발자 확인 뒤) 아키텍처 표의 `server/mail-worker.js` '메일(배포 대기)'를 고친다: 푸시 가동 · 도우미·초안 꺼짐 · 접수 대행 `server/apply/` 꺼짐(우리 도메인 필요) · mail-worker 는 2026-09-25 폐기 — 현황은 `server/README.md` 한 장.
- **서버 워커(`server/*`)는 공용 파일을 기본 가져오기로**(`import ME from '../../match-engine.js'`) — `createRequire`·`node:` 모듈은 Workers 에 올리는 순간 넘어진다. 관문 `verify/health-gates/servers.mjs` ①.
- **푸시 서버는 공용 규칙의 사본을 둔다**(빌드 감시 경로가 `server/push/*` · `titleSeenKey`·`SHARED_BOARD_BRANCH`·`TITLE_CAMPUS`·`taggedSchool`) — 원본을 바꾸면 관문 servers ⑥⑧ 이 빨개지니 사본도 같이. '본 공고'는 폰과 같은 셋(주소·학교+제목·수집일) · 마감 깨우기는 공고마다 하루 한 번.
- 푸시 매일 확인 판정은 `tools/push-health-verdict.mjs` 한 곳(서버 /health 의 `lastSlot`·`lastRun` — 두 회차 연속 안 돎 stale · 새 코드 미배포 outdated) · 로그인 서버는 `supabase-health.yml`(공개 열쇠로 /auth/v1/health 만 · 감시이지 휴면 방지라고 쓰지 말 것). 관문 servers ③④⑨.
- (아키텍처 표 고칠 줄 · 개발자 확인 뒤) `server/mail-worker.js` '메일(배포 대기)' → 2026-09-25 폐기 · 접수 대행은 `server/apply/`(꺼짐 · 우리 도메인 필요 · 앱 메일 버튼은 mailto:) — 현황표는 `server/README.md`.
- 서비스워커의 공용 이름은 `typeof` 로 본다 — importScripts 하나가 실패해도 푸시를 받으면 알림 1건(관문 servers ⑩).

### insta
- **인스타 카드 그림에 상대 날짜(`마감 D-N`·`오늘 마감`)를 박지 않는다**(그림은 굳는다 · `ddText` 는 'M월 D일 마감'). 마감 지난 카드·옛 D-N 카드(2026-10-04 전 2·3·4번)는 게시 거절 — `publishRefusal`↔관리자 `instaPublishBlock` 짝. 관문 「로봇·도구 점검 관문」 `verify/health-gates/insta.mjs` ①.
- **인스타 대기줄은 작업마다**(같은 공고끼리만 `insta-code-<코드>` · 워크플로 단위로 되돌리지 말 것). 장부 `insta/seen.json` 은 `mergeInstaSeen`(일반 seen.json 규칙보다 앞 · 올림 기록은 code·media 로 · 안 버린다) · 게시 작업은 main 에 안 올린다. 관문 같은 파일 ②④.
- **인스타 장부 줄·정리·올림 기록은 `insta/pick.mjs` 한 곳**(`preparedRow`·`expireAndClean`·`recordPosted`) — ledger·revise·publish 가 불러 쓴다. 관문은 그 명령을 임시 폴더에 복사해 실제로 돌린다(글자로 재지 말 것). 같은 파일 ①-e·②-e·⑦-d.
- **마감 지난 인스타 카드는 준비 실행마다 '만료'로 바꾸고 폴더를 지운다**(`node insta/ledger.mjs expire` · 올린 것은 안 지운다 · 사람이 건너뛴 카드는 마감이 미뤄져도 다시 안 그린다 `expiredFrom`). 「이 기기에서 배포」 가 run-notify.txt 를 올리면 알림까지 깨운다. 관문 같은 파일 ⑦⑨.
- **데이터 관문에서 도는 health-gates 묶음은 워크플로·문서 글자를 `softEq` 로 잰다**(로봇에선 경고만 · 로컬·verify-ui 는 실패 · 단계는 id 로 찾는다). 순수 함수·진짜 명령 표본은 어디서나 엄격. 관문 「로봇·도구 점검 관문」 alerts ⓪.
- **인스타 카드에 상대 날짜 금지 · 게시 거절은 `publishRefusal` 한 곳**(마감 지남 · 2026-10-04 전에 그린 2·3·4번 옛 「마감 D-N」 카드) — 화면 `instaPublishBlock` 은 짝(같은 시각 잣대). 관문 `verify/health-gates/insta.mjs` ①.
- **인스타 장부 `insta/seen.json` 은 `mergeInstaSeen`**(올림 기록 절대 안 버림 · 일반 seen.json 규칙보다 앞) · 대기줄은 작업별(같은 공고끼리만 한 줄) · 게시 작업은 main 에 안 올린다 · 올린 뒤의 멈춤은 「다시 게시하지 마세요」. 관문 같은 파일 ②④.
- 마감 지난 준비 카드는 준비 실행마다 `insta/ledger.mjs` expire(규칙 `expireRows`)가 만료·폴더 삭제(올린 것 제외). 관문 같은 파일 ⑦.

### admin
- **관리자 버튼으로 많이 지울 때**(5건 초과 또는 목록 10% 초과) 지울 건수를 숫자로 한 번 더 받는다 — 문턱은 `tools/edit-diff.mjs` `needsBulkExpect` 한 곳(화면·저장소 공용 · 숫자를 화면이 미리 채우지 말 것). 관문 「로봇·도구 점검 관문」(admin) · `verify-admin.js`.
- 🔴 **관리자 조정·수집 로봇 「지금 실행」은 수집 대기줄(group: collector)에 기다리는 실행이 있으면 보내지 않는다** — 새 실행이 기다리던 실행을 시작 전에 취소한다. 목록 `COLLECTOR_QUEUE` 는 관문이 워크플로와 대조 · 줄을 떼지 말 것(registered.json 은 병합 규칙이 없다).
- 관리자 조정 실패 문구는 실행의 단계 결과와 거절 문장(`관리자 조정 실패 — …`)으로만 말한다(`runFailureText` · 단계 이름은 admin-apply.yml `name:` 과 글자까지 같게 · 관문 대조). 저장 여부를 모르면 '확인하지 못했습니다'.
- 🔴 `node --check _admin/admin.js` 는 모듈로 재지 않아 같은 이름 두 번 선언도 통과시킨다 — 관문 「로봇·도구 점검 관문」(admin)이 .mjs 사본으로 잰다. 시험 실행은 admin-apply.yml `dry_run`(적용+감사까지만 · 저장·이슈 없음).

### refresh
- 한국장학재단 공고문 사본의 '같은 파일' 판정은 `attachKey`(서버 저장 이름 filename) 한 곳 — 주소 전체로 비교하지 말 것(끝의 encVal 이 받을 때마다 바뀌어 매 실행 전부 다시 받았다). 관문 `verify/health-gates/refresh.mjs` ⓐ.
- 학교·시작 화면 사진을 고르면 원본 제목(`title`)도 같이 적는다 — 다시 받으면 같은 파일 이름이 다른 사진이 된다. 빌드가 `pickProblems`·`startScreenChanged` 로 멈춘다(새 사진이 맞으면 build-app-gates `--accept=id`). 관문 refresh ⓕ.
- 학과 로봇은 서비스 학교 파일이 빠지면 관문이 아니라 리포트(collector/majors-report.md · 첫 실행에 생긴다)와 ::warning 으로만 알린다 · BRANCH_MAP 에는 리포트의 원래 이름을 그 글자 그대로만. 관문 refresh ⓓ.
- 수집 대기줄(group: collector)에는 registered.json 을 쓰는 로봇만 세운다 — 학과·등록금 갱신은 제 줄. 줄을 바꾸면 관리자 `COLLECTOR_QUEUE` 도 같이(관문 admin F4 · refresh ⓔ).

### ops
- **배포 감시**(`verify/check-deploy-sync.js`)의 ❌ 는 갈라진 뒤 내 쪽에만 있는 앱 변경뿐이다(세 점 비교 · assets/ 포함 · main 만 앞선 것은 (참고)). 해결은 ⓪ 기본 브랜치·main 을 먼저 합치고 같은 HEAD 를 세 곳에 올린다. 관문 「로봇·도구 점검 관문」 ops ①.
- **예약 시각은 목표일 뿐이다** — 수 시간 늦고 일부는 걸러진다. 순서가 필요한 일은 workflow_run 으로 잇고, 확인 로봇은 배포 완료를 기다린다. 하트비트 문턱은 간격×3(최소 `STALE_MIN_HOURS`)이고 기본 브랜치(와 main)의 성공만 센다(`BASE_BRANCH` · 이벤트로 거르지 말 것). 관문 ops ②③.
- 노션 「작업 현황」 '브랜치' 칸은 이 push 가 올린 커밋(첫 부모 줄)을 가리키는 작업 브랜치다(`pushBranchLabel`). 노션 쓰기는 `patchWithRetry` 를 거친다. 관문 ops ④.
- `tools/robot-run.sh` 의 데이터 로봇 목록은 손으로 적지 않는다. `tools/data-robots.mjs` 가 워크플로의 git add data/·collector/ 줄에서 읽는다. gh 를 못 물으면 멈추고 gh 문구를 그대로 보인다('없음 ✅' 금지). 관문 ops ⑤(가짜 gh 로 실제 실행).
- 링크 정찰은 push 로 깨면 그 push 가 새로 넣은 줄만 연다(`pickDirectives` · `collector/probe-lines.mjs`). 다시 보려면 그 줄을 지웠다 다시 넣거나 수동으로 실행한다. 답 받은 줄은 `# (답 받음 …)` 으로 막는다. 관문 ops ⑥.
- (ops-14 마지막 커밋이 들어간 뒤에만) 워크플로 액션은 Node 24 판(checkout·setup-node v5 · github-script v8 · node 22)을 쓴다. upload-artifact 는 릴리스 노트를 확인한 뒤에 올린다. 관문 ops ⑦.
- 배포 감시(`verify/check-deploy-sync.js`)의 ❌ 는 **갈라진 뒤 내 쪽에만 있는 앱 변경**(세 점 비교)만 뜻한다 — main 만 앞선 것은 (참고) · 해결은 세 곳 push(main 하나만 권하지 않는다). 관문 「로봇·도구 점검 관문」 ops ①.
- 예약 시각은 목표일 뿐 수 시간 늦고 일부는 걸러진다 — 순서가 필요한 일은 workflow_run 으로 잇고, 하트비트 문턱은 간격 × 3 최소 12시간(`staleAfterHours`) · 기본 브랜치·main 의 성공만 센다. 관문 ops ②③.
- 로컬 로봇 겉옷(`tools/robot-run.sh`)의 데이터 로봇 목록은 워크플로에서 읽는다(`tools/data-robots.mjs` · 손 목록 금지) · gh 를 못 물으면 멈춘다. 관문 ops ⑤.
- 링크 정찰은 push 로 깨면 **이번 push 가 넣은 줄만** 연다(`collector/probe-lines.mjs`) — 다시 보려면 줄을 지웠다 넣거나 수동 실행 · 답 받은 줄은 '# (답 받음 …)' 로 막는다. 관문 ops ⑥.
- 워크플로 액션은 Node 24 판(checkout·setup-node v5 · github-script v8 · node-version 22) — 새 워크플로도 같은 판으로. 관문 ops ⑦(로컬·verify-ui 에서만 실패).
