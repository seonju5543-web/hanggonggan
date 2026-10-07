# 수리 명세 — 묶음 browser

권장 순서: browser/B6 → browser/B4 → browser/B5 → browser/B11 → browser/B10 → collect/collect-16 → collect/collect-08 → browser/B2 → browser/B3 → api/api-09 → collect/collect-11 → browser/B12 → collect/collect-15
예상 손댈 파일: collector/url-key.mjs collector/canon-url.mjs collector/browser-collect.mjs collector/collect.mjs collector/collect-news.mjs collector/browser-health.mjs collector/source-health.mjs collector/browser-targets.json collector/schools.json collector/run-probe.txt collector/kind-evidence.mjs collector/kind-classify.mjs collector/scope-promote.mjs .github/workflows/browser-collect.yml .github/workflows/collect-scholarships.yml .gitattributes tools/merge-json-union.mjs verify/health-gates/browser.mjs verify/health-gates.mjs verify/test-collector.mjs

검증 메모: 【묶음 밖 새 발견 — P1, 담당 묶음을 정해 주세요(links 또는 gate)】 자동 등록 id 공식 idFromUrl(collector/canon-url.mjs:75 — 정규화 주소의 '끝 24글자')이 서로 다른 공고를 한 id 로 뭉칩니다. 주소 꼬리가 같은 게시판에서 생깁니다. 한 번 등록되거나 한 번 막히면, 같은 게시판의 다른 글이 모두 auto-register.mjs:308 '이미 등록(같은 id)' 또는 :311 '사람이 막아 둔 공고'로 조용히 빠집니다. 실측(읽기만 했습니다):
- 계명대 주소 244개가 전부 'auto-srchenable1srchvotetype1' 입니다(정렬 뒤 srch* 가 끝에 옵니다). 09-30 대전청년내일재단 1건이 등록된 뒤로 계명 공고 40건이 막혀 있습니다.
- auto-register-config.json blockIds 의 'auto-amepagescholarshipnotice' 가 서강대 주소 32개 전부(&namepage=ScholarshipNotice 꼬리)와 같은 id 라서 서강대 자동 등록이 0건입니다(registered.json 서강 0건). 'auto-aaa8eca79120ec9588eb82b4'(목록 표식 제목 꼬리)도 5개를 막습니다.
- 지금 피드 공고 중 65건이 다른 공고의 id 에 가려 있습니다: 계명 40 · 숭실 10 · 중앙 7(예: 'CAU 미래설계장학금 장학생 모집 공고') · 강원 4 · 전북 2 · 과기대 1 · 서울교대 1. 브라우저 리포트의 '이미 등록(같은 id) · 17건'이 이 증상입니다.
고치는 길(제안): 공식은 그대로 둡니다(머리말 경고 — 이미 저장된 id 와 blockIds 무효). canon-url.mjs 에 `idFromUrlUnique(prefix, raw, taken)` 을 두어 같은 id 가 이미 '다른 정규화 주소'로 쓰였을 때만 짧은 해시를 붙입니다. auto-register(:306-311)와 admin-apply(register)가 같은 함수를 쓰게 합니다. 막기는 같은 id 라도 정규화 주소가 같을 때만 막도록 바꾸고 blockUrls 를 우선합니다. 관문은 표본 계명 두 주소와 서강 두 주소가 서로 다른 id 를 받는지, 기존 id 표본은 그대로인지 확인합니다.

【이 묶음에 접어 넣은 것】 브라우저 건강 장부가 '예산으로 건너뛴 학교'도 성공으로 적어 lastOk 를 오늘로 찍습니다(browser-collect.mjs:706-717 — collect.mjs 의 ⏰ 규칙과 반대). B4 의 targetOutcome 'skipped' 로 함께 고칩니다.

【겹침과 순서】
- 다른 세션(source-link-integrity)과 겹치는 파일: browser-collect.mjs(:284-336·:495 덩어리 — 우리 수리와 겹치는 덩어리는 없음), url-key.mjs(VOLATILE 바로 위 markerPostIdKey — 새 이름은 Set 마지막 줄 뒤에), .gitattributes, verify/test-collector.mjs. 그 브랜치는 이 묶음의 어느 항목도 고치지 않습니다(other-session 판정 없음). 그 브랜치의 1a33db59 는 links-6(서울교대 data-id 규칙)을 이미 다룹니다.
- 다른 묶음과 겹치는 파일: links(url-key·canon-url·browser-targets — links-7 도 열쇠를 바꾸니 rekeyLedger 를 같이 쓰면 이주가 한 번), feed(collect.mjs·browser-targets·schools·merge-json-union — app2-F2 가 홍익 공백을 같이 짚음, 홍익은 B2 가 맡는 것을 권함), qnotice·qfeeds(collect.mjs·collect-news.mjs·scope-promote·.gitattributes·merge-json-union·run-probe.txt), ops·ci·gate·bodies(두 워크플로 · Node 20 은 ops-14 소관).
- 기본 브랜치가 HEAD 보다 두 커밋 앞서 있습니다(30e214b4 가 collect-scholarships.yml·test-collector, 8610f25a 가 test-collector). 수리 전에 받을 것.
- verify/health-gates.mjs PARTS 는 모든 묶음이 한 줄씩 더하는 파일입니다.

【검증 방식】 저장소는 읽기만 했습니다. 모의 실행은 scratchpad/verify-browser/sim 에 url-key.mjs·canon-url.mjs 를 복사해서 했습니다: 새 휘발 이름 셋으로 seen.json 296·seen-news 20 키(전부 kmu.ac.kr)만 바뀌고, registered idFromUrl 변화 0, canonUrl 변화 1. 작업 트리는 만들지 않았습니다. 브라우저 로그: run 37171328367 job 111344696428(10-04). 건강 장부 이력: git show 12035004·b364d997·a31a8538·909ce8a5·2aed6584·c7e51c85·57162a6c:collector/health.json.


---
## [browser/B2] P1 · confirmed

이유: 사실이다. data/notices/index.json(10-04)에 홍익대 파일이 없고(36개교뿐), seen.json 의 hongik.ac.kr 마지막 기록은 2026-08-29다(…notice.do?…&noCat=501). 일반 로봇은 collector/report.md:58 에서 '🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀'이라 손을 뗀다. 브라우저 리포트를 보면 10-02 16:33·10-03 두 번은 두 후보 모두 '⚪ 링크 0'이었다. 10-04 02:43(b364d997)에는 notice.do 가 '⚪ 링크 143 · 장학 공고 0 · (클릭 시도 0건)'으로 바뀌었는데, (본 링크) 견본이 0줄이라 날짜·장학 낱말이 든 글 줄이 하나도 없다. 그래서 '링크 0'이라는 증상 표현은 오늘 기준으로는 낡았지만 '장학 0'은 그대로다. 원인은 아직 확인하지 않았다. 다만 SESSIONS.md:3506 의 2026-08-23 정찰에서 홍익 상세 화면이 봇 차단(cdn-botmanager.stclab.com 'Security Verification')이었다는 기록이 있다. 같은 홍익 공백을 feed 묶음 app2-F2 도 짚는다. 홍익의 정찰과 설정은 이 묶음이 맡는다.

수리 명세: 정찰 먼저(CLAUDE.md '짐작 말고 run-probe.txt' · 스킬 probe-run). 1단계(이번 수리, 배포 때 기본 브랜치 push 로 실행): collector/run-probe.txt 맨 앞에 날짜 주석과 함께 checkUrl 두 줄을 넣는다. ① 지금 대상 https://www.hongik.ac.kr/kr/newscenter/notice.do 에서 최종 주소·제목·보안 확인 화면 여부·목록 줄·스크립트 요청을 본다. ② 8월에 실제로 잡힌 상세 주소의 분류 값으로 만든 가설 주소 https://www.hongik.ac.kr/kr/newscenter/notice.do?noCat=501 을 본다(주석에 '가설 — 정찰로 확인'이라고 적는다). 경보는 B4 가 맡는다. 2단계(정찰 결과가 나온 뒤, 결과에 근거해서만): 장학 목록이 보이는 주소로 browser-targets.json 홍익대 candidates 첫 줄과 schools.json 홍익대 boardUrl 을 함께 바꾸고 _note 에 정찰 날짜와 근거를 적는다. 학교 첫 화면 후보 https://www.hongik.ac.kr/index.do 는 B10 에서 뺀다. 정찰이 보안 확인 화면만 보이면 주소를 짐작해 채우지 말고 humanQuestion 으로 간다. 바꾸지 말 것: collector:"browser" 를 떼서 일반 로봇에 넘기지 않는다(09-30 일반 로봇도 🟡 0건이었고 같은 사이트를 두 번 두드리게 된다). parked 로 옮기지 않는다(44개교 복원 지시).

관문: 이 항목 자체는 설정 문제라 표본 관문이 없다. 탐지는 B4 관문(열렸지만 장학 0건이 3회 이어지면 🚨)이 맡는다. 주소를 바꾼 뒤의 확인은 다음 실행 브라우저 리포트의 홍익 줄 '✅ … 장학 공고 n'으로 한다.

소급: 주소가 고쳐지면 다음 브라우저 실행이 목록 1·2페이지를 새로 담는다(60일 창). 손으로 채울 데이터는 없다.

파일: collector/run-probe.txt collector/browser-targets.json collector/schools.json

위험: run-probe.txt 는 qfeeds·ops 묶음도 고친다. 맨 앞 블록만 더하고 기존 줄은 건드리지 말 것. 정찰 예산이 11분이라 앞에 둔 줄이 먼저 돈다.

---
## [browser/B3] P1 · confirmed

이유: 사실이고 원인 증거가 더 분명해졌다. collector/news-sources.json:360-375 의 2026-09-30 웹 검색 근거에 'list_id=FA1 = 일반공지 < UOS공지 < 캠퍼스생활', 'FA2 = 학사공지'로 적혀 있다. 그러니 browser-targets.json 시립대 _note 의 'FA1이 장학공지'와 schools.json note 의 'FA1=장학공지'는 틀린 기록이다. 근거는 셋이다. ① 10-04 browser-report 에서 FA1 '⚪ 링크 275 · 장학 공고 0'이고 본 링크가 전공설계센터·사업단 안내다. ② candidates.json 의 시립대 18건이 전부 FA1 이며 부서별 국가근로장학생 모집·성과형 장학금이다(장학 전용 게시판의 글이 아니다). ③ data/notices 시립대 파일은 2건뿐이다. 장학 전용 게시판이 따로 있는지는 아직 모른다. probe-candidates.json:55 의 list_id=SCHOLARSHIP 도 확인되지 않은 추측이다.

수리 명세: 1단계(이번 수리, 배포 때 실행): run-probe.txt 에 `findBoard: https://www.uos.ac.kr/ | 장학` 한 줄(시립대 장학 공지 메뉴를 실제로 눌러 들어간 최종 주소를 받는다)과 날짜 주석을 넣는다. 주소를 추측해서 넣지 않는다. 경보는 B4 가 맡는다. 2단계(정찰이 장학 전용 목록을 확인하면): browser-targets.json 시립대 candidates 를 [확인된 장학 주소, FA1] 순으로 바꾸고 _note 의 틀린 문장('FA1이 장학공지')을 정찰 근거로 고친다. schools.json 시립대 boardUrl·note 도 같은 주소로 고친다. 그 게시판이 일반 fetch 로 열리면(정찰의 '서버가 보낸 HTML 에 목록이 있다') collector:"browser" 를 떼는 것을 검토한다. 장학 전용 게시판이 없다고 나오면 humanQuestion 으로 간다. 바꾸지 말 것: FA2(학사공지)를 첫 후보로 올리지 않는다. 시립대를 parked 로 옮기지 않는다.

관문: 설정 문제라 표본 관문은 없다. 탐지는 B4 관문이 맡는다.

소급: 주소가 바뀌면 다음 실행이 새로 담는다. 기존 2건은 그대로 둔다(60일 규칙).

파일: collector/run-probe.txt collector/browser-targets.json collector/schools.json

위험: run-probe.txt 는 다른 묶음(qfeeds·ops)과 겹친다. schools.json 은 feed 묶음(app2-F2·collect-06)도 고친다(분교 주소). 서로 다른 학교 항목이라 같은 줄을 고치지는 않는다.

---
## [browser/B4] P1 · confirmed

이유: 코드와 데이터로 확인했다. 성공 판정: browser-collect.mjs:404-411 의 harvestTarget 은 후보 하나라도 열리면 loadedAny=true 이고, harvestWithDeadline(:540)이 이것을 ok 로 돌려준다. 건강 장부 루프(:705-718)는 stillFailed 가 아니면 fails=0·lastOk=오늘로 적는다. 링크 수와 장학 공고 수는 보지 않는다. 그래서 홍익(장학 0)·시립(장학 0)이 health.json 에서 {fails:0,lastOk:'2026-10-04'}다. 장부를 같이 쓰는 문제: health.json 이력을 보면 서울대는 브라우저 실행 뒤 fails 1(b364d997·2aed6584·57162a6c)이 되고, 다음 일반 로봇 실행이 0 으로 되돌린다(12035004·909ce8a5·c7e51c85 → 영영 3에 닿지 않는다). collect.mjs:653 주석 '학교 이름이 열쇠라 섞이지 않는다'는 사실과 다르다. 이번에 하나 더 찾았다: 예산으로 건너뛴 학교(skipped)도 health 루프에서 성공으로 적혀 lastOk 가 오늘로 찍힌다(collect.mjs 의 ⏰ 규칙과 다르다). 그리고 브라우저 리포트 이슈는 new_count>0 일 때만 생겨서(browser-collect.yml '리포트 이슈' if) 🚨 줄이 파일에만 남는다.

수리 명세: ① 새 순수 모듈 collector/browser-health.mjs(파일·망을 안 쓴다):
- `targetOutcome({loadedAny, worked, stalled, skipped})` → 'skipped'|'stalled'|'failed'|'empty'|'ok'.
- `applyBrowserHealth(health, rows, runDate)`: rows=[{name, outcome}], 돌려주는 값은 {health, chronic:[{name,n,why}]}.
- skipped 는 손대지 않는다(lastOk 를 오늘로 찍지 않는다).
- ok 이면 fails=0 · lastOk=runDate · browserFails=0 · browserWhy 삭제.
- stalled·failed·empty 이면 fails+=1(공용 칸의 의미는 그대로라 관리자 화면 fails>0 목록도 유지) · browserFails=(browserFails||0)+1 · browserWhy 는 '시한 안에 못 끝냄'|'게시판을 열지 못함'|'열렸지만 장학 공고 0건'.
- browserFails>=3 이면 chronic. 일반 로봇은 h 객체에서 fails·lastOk 만 고치므로(collect.mjs:661-668) browserFails 는 지워지지 않는다.

② collector/browser-collect.mjs:
- harvestTarget 이 후보마다 `worked ||= uniq.length > 0 || r.clickSkipped > 0` 를 모아 {loadedAny, worked} 를 돌려준다.
- harvestWithDeadline 은 {ok: loadedAny, worked, stalled} 를 돌려준다.
- 풀과 재시도는 이렇게 나눈다: stalled→hung, !ok→failedTargets(재시도), ok&&!worked→새 emptyTargets(재시도 안 함), 예산 건너뜀→skipped.
- :705-718 루프를 applyBrowserHealth 호출로 바꾼다.
- chronic 이 있으면 report 머리(제목 줄 바로 아래)에 `🚨 **여러 번 연속 공고를 못 읽은 학교**: 이름(n회 · 이유) … — 게시판 주소 확인이 필요해요(정찰: run-probe.txt)` 를 넣고, GITHUB_OUTPUT 에 `chronic=<한 줄, 줄바꿈 없음>` 을 쓴다.
- 요약에 '⚪ 열렸지만 장학 공고를 하나도 못 알아본 학교 n곳: …' 줄을 더한다. 원인은 단정하지 않는다.

③ .github/workflows/browser-collect.yml: '리포트 이슈' 다음에 단계 '🚨 연속으로 공고를 못 읽은 학교 알림 (최근 리포트 이슈에 코멘트)'를 더한다.
- if: steps.run.outcome == 'success' && steps.run.outputs.chronic != '' && steps.run.outputs.new_count == '0'
- env: GH_TOKEN, CHRONIC: ${{ steps.run.outputs.chronic }} — 본문에는 "$CHRONIC" 만 쓴다(${{ }} 를 셸에 직접 넣지 않는다).
- 기존 알림 단계처럼 gh issue list --search '"수집 리포트" in:title' 의 최신 1건에 코멘트한다.

④ collect.mjs:648-653 주석을 사실대로 고친다(두 로봇이 같이 보는 학교는 fails 를 같이 쓰고, 브라우저 쪽 연속 횟수는 browserFails).

바꾸지 말 것: collect.mjs:660·662 의 health 두 줄(관문 test-collector:1420 이 정규식으로 잠갔다) · MIN_PER_TARGET_MS/TARGET_HARD_MS · 재시도 상한 · '.parked' 를 코드에서 읽지 않는다(관문 「수집망 복원」) · 학교마다 남기는 진단 줄(프레임·클릭·본 링크).

관문: verify/health-gates/browser.mjs 를 새로 만들고 verify/health-gates.mjs 의 PARTS 에 'browser' 를 더한다. 표본만 쓴다.
ⓐ targetOutcome({loadedAny:true,worked:false})==='empty' · ({loadedAny:true,worked:true})==='ok' · ({stalled:true})==='stalled' · ({skipped:true})==='skipped' · ({loadedAny:false})==='failed'.
ⓑ h={} 에서 'X' 를 empty 로 3회 돌리되, 사이마다 일반 로봇처럼 h.X.fails=0·lastOk='2026-10-0n' 으로 덮는다 → 3회째 chronic 에 X 가 있고 browserFails===3 이다.
ⓒ skipped 는 lastOk·fails 를 바꾸지 않는다.
ⓓ ok 한 번이면 browserFails 0.
ⓔ 정적 검사: browser-collect.mjs 가 './browser-health.mjs' 를 import 하고 applyBrowserHealth( 를 부른다 · 옛 줄 `if (stillFailed.includes(name)) {` 가 없다 · browser-collect.yml 에 `steps.run.outputs.chronic` 을 env 로 받는 단계가 있다.
빨간불 증명: targetOutcome 을 loadedAny 만 보게 되돌리면 ⓐ·ⓑ 가 빨개진다. 일반 로봇 흉내가 지우는 fails 로 chronic 을 판정하게 되돌리면 ⓑ 가 빨개진다.

소급: 코드가 다음 실행부터 스스로 센다. 홍익·시립은 3회 뒤(약 1.5일) 🚨 이 뜬다. 원하면 health.json 의 홍익대학교 lastOk 를 seen.json 의 마지막 실제 수집일 2026-08-29 로 한 줄 되돌린다(로봇 장부, JSON.stringify(x,null,1)). 이것은 선택이다.

파일: collector/browser-health.mjs collector/browser-collect.mjs .github/workflows/browser-collect.yml collector/collect.mjs verify/health-gates/browser.mjs verify/health-gates.mjs

위험: browser-collect.mjs 는 다른 세션(source-link-integrity)이 :284-336(클릭 채집)과 :495(rec 에 postId)를 고친다. 이 수리는 :404-446·:540-560·:690-730 이라 겹치는 덩어리는 없지만 harvestTarget 근처라 병합 때 눈으로 확인할 것. 이 yml 은 ops-14(node-version)·ci·gate·bodies 묶음도 고친다. 같은 파일을 차례로 고칠 것.

---
## [browser/B5] P2 · confirmed

이유: 오늘도 그대로다. run 37171328367(10-04)의 job 로그 473행에 '[478s] ◀ 서울대학교 — ⛔ 응답 멈춤(강제 중단) (450초)'가 있고, 나머지 18곳은 149초 안에 끝났다(로그 436-472행). 수집 단계 8분 중 7분 30초를 서울대가 쓴다. 같은 시각 일반 로봇은 collector/report.md:20 '서울대학교 상태: ✅ 정상 (실공고 11건 감지)'이고, data/notices/nsgh1oi.json 9건 foundAt 10-04 다. 그래서 브라우저 대상은 순수 낭비이고, schools.json _collector 규칙('브라우저가 0건·일반이 정상이면 browser-targets.json 에서 빼는 것이 답')에 그대로 해당한다. 리포트 문구 browser-collect.mjs:698 '학교 서버가 연결만 열어 두고 답을 주지 않아'와 :726 '학교 서버가 응답하지 않아'는 확인하지 않은 원인을 단정한다(CLAUDE.md 매 세션 5).

수리 명세: ① collector/browser-targets.json: 서울대학교 항목을 targets 에서 parked 배열로 옮긴다. 지우지 않고 candidates·_note 는 그대로 둔다. `_why`: '2026-10-04 점검 — 브라우저는 10-01~10-04 매 실행 7분 30초 멈춤, 일반 로봇은 같은 게시판을 ✅ 정상 수집(report.md) → schools.json _collector 규칙'.
② browser-collect.mjs:698·:726 문구를 관측 사실로 바꾼다(B11 과 함께):
- 멈춘 학교: '정한 시한(7분 30초) 안에 이 학교를 다 읽지 못해 끊었어요(어디서 멈췄는지는 실행 로그 ▶/◀ 줄)'.
- 접속 실패: '게시판을 열지 못했어요(오류 문구는 위 학교 줄)'.
- '다음 실행(약 12시간 뒤)'은 '다음 예약 실행에'로 바꾼다.
③ verify/test-collector.mjs 「수집망 복원」 :1381 `bt.targets.length >= 19` 를 `bt.targets.length + bt.parked.length >= 19` 로 바꾼다('되살린 19곳을 버리지 않았다'는 뜻은 유지). 바로 아래에 새 줄을 둔다: 'browser-targets 의 parked 학교는 schools.json 에 boardUrl 이 있고 collector:"browser" 가 아니다(일반 로봇이 읽는다)'.
바꾸지 말 것: schools.json 의 서울대 행(일반 로봇 담당) · 멈춤 장치(withDeadline·TARGET_HARD_MS) · parked 를 코드가 읽지 않는 규칙.

관문: 「수집망 복원」 절(설정 규칙이라 그 절이 맞다)에 줄을 넣는다: parked 학교 ⊂ (schools.json boardUrl 있음 ∧ collector≠'browser'). verify/health-gates/browser.mjs 에는 정적 검사를 둔다: browser-collect.mjs 원문에 '연결만 열어 두고'·'학교 서버가 응답하지 않아'·'약 12시간' 이 없다. 빨간불 증명: 문구를 되돌리면 빨개진다. 서울대를 parked 로 둔 채 schools.json 서울대 boardUrl 을 null 로 바꾸면 빨개진다.

소급: 없다. 다음 실행부터 수집 단계가 약 2분 30초로 줄고 대기줄(collector)도 그만큼 빨리 풀린다.

파일: collector/browser-targets.json collector/browser-collect.mjs verify/test-collector.mjs verify/health-gates/browser.mjs

위험: verify/test-collector.mjs 는 다른 세션과 여러 묶음(gate·bodies·alerts·qnotice…)이 함께 고친다. :1381 한 줄과 바로 아래 한 줄만 고칠 것. browser-targets.json 은 links 묶음(links-6 서울교대 규칙)과 feed 묶음도 고친다. 서울대 항목만 옮긴다.

---
## [browser/B6] P2 · confirmed

이유: 실측했다. seen.json 의 계명대 키 중 09-30 39개는 pageRef=271062 이고, 10-02 39개는 pageRef=271152 로 같은 parm_bod_uid 를 다시 적었다(click 키 39개도 10-02 로 덮였다). data/notices/n1nel147.json 40건 중 39건이 foundAt 2026-10-02 다. 지금 urlKey 는 pageRef 만 다른 두 주소를 다르게 보고(로컬 실행 결과 false), canonUrl 도 같다. 고친 사본(pageRef·pagePrvNxt·pageOrder 를 휘발 값으로)으로 모의하면 seen.json 296개·seen-news.json 20개 키만 바뀌고(전부 kmu.ac.kr), registered 의 idFromUrl 변화는 0건, canonUrl 변화는 1건이다. 10-03·10-04 실행은 '장학 공고 41'이지만 신규가 0이다. 그러니 매번이 아니라 계명 게시판에 새 글이 올라올 때마다(목록 첫 글 번호가 pageRef) 목록 전부가 다시 들어온다. 알림은 제목 열쇠도 보므로(notify-rules.js:276-293) 헛알림은 없다. 대신 앱 목록이 수집일(foundAt) 순이라 옛 글이 '방금 수집'처럼 위로 올라오고, 상세 방문 예산을 아는 글에 쓰며, seen·browser-bodies 가 부푼다.

수리 명세: ① collector/url-key.mjs 의 VOLATILE 마지막 줄 다음에 새 줄 `'pageRef', 'pagePrvNxt', 'pageOrder',` 를 더한다. 계명 page.jsp 의 목록 상태 값이고, 실측상 이 셋을 쓰는 호스트는 kmu.ac.kr 뿐이다. pageNo·pageUnit 은 이번에 넣지 않는다(중앙·서울교대·경기·충북 장부 키 수백 개가 바뀐다 — 후속 과제).
② collector/canon-url.mjs 의 VOLATILE 정규식에 pageref|pageprvnxt|pageorder 를 더한다(머리말 '두 목록 같은 뜻' 유지).
③ url-key.mjs 에 `export function rekeyLedger(obj)` 를 더한다.
- 키가 http(s) 주소면 urlKey(키), 'click:<목록>|<제목>' 꼴이면 목록 부분만 urlKey 로 다시 만든다.
- 새 키가 없을 때만 같은 값을 넣는다. 여러 옛 키가 한 새 키로 모이면 가장 이른 날짜를 쓴다.
- 옛 키는 지우지 않는다(합집합 병합기가 어차피 되살린다). 더한 수를 돌려준다. 멱등이다.
- 새 import 를 더하지 말 것(url-key.cjs 다리가 소스를 그대로 평가한다).
④ 장부를 읽은 바로 다음 줄에서 부른다: browser-collect.mjs(seen.json) · collect.mjs(seen.json) · collect-news.mjs(seen-news.json). 안 하면 첫 실행에 계명 40건과 소식 20건이 한 번 더 '신규'가 된다.
바꾸지 말 것: idFromUrl 공식(canon-url.mjs 머리말 — 이미 저장된 id·blockIds 가 무효가 된다) · urlKey 의 다른 이름(mode 등) · 다른 세션이 url-key.mjs 의 VOLATILE 바로 위에 넣는 markerPostIdKey 덩어리. 새 줄은 Set 의 마지막 항목 뒤에 둬서 덩어리가 겹치지 않게 한다.

관문: verify/health-gates/browser.mjs:
ⓐ 고정 표본 계명 주소 둘(pageRef 271062/271152, 나머지 같음) → urlKey 같고 canonUrl 같다.
ⓑ parm_bod_uid 가 다르면 urlKey 가 다르다.
ⓒ 비계명 표본 셋의 idFromUrl 이 고정 문자열과 같다(공식 불변): 성균관 notice06.do?mode=view&articleNo=140331&article.offset=0&articleLimit=10 → 'auto-otice06doarticleno140331', 그리고 서강 detail·가천 artclView 표본.
ⓓ rekeyLedger({옛 계명 키:'2026-09-30', 'click:<목록>|제목':'2026-09-30'}) → 새 키가 생기고 날짜가 같다. 두 번째 호출은 0.
ⓔ url-key.mjs VOLATILE 의 이름은 canonUrl 도 버린다(표본 주소로 이름마다 확인).
빨간불 증명: VOLATILE 새 줄을 빼면 ⓐ 가 빨개진다. canon-url 쪽만 빼면 ⓐ의 canonUrl 과 ⓔ 가 빨개진다.

소급: 장부는 다음 실행이 rekeyLedger 로 스스로 고친다. 일회 로컬 실행은 필요 없다. 이미 피드에 있는 계명 39건의 foundAt(10-02 로 덮인 것)은 되돌리지 않는다. 되돌리면 60일 수명이 짧아져 학생 화면에서 일찍 빠진다. browser-bodies.json 의 계명 중복 본문은 60일 뒤 저절로 빠진다. 남는 것: 1페이지에서 2페이지로 밀린 글 하나는 pageNo 가 바뀌어 다시 들어올 수 있다(새 글 하나당 최대 1건).

파일: collector/url-key.mjs collector/canon-url.mjs collector/browser-collect.mjs collector/collect.mjs collector/collect-news.mjs verify/health-gates/browser.mjs

위험: url-key.mjs·canon-url.mjs 는 links 묶음(links-7 jsessionid)도 고치고, 다른 세션도 url-key.mjs 를 고친다(markerPostIdKey·dedupeNotices). 두 묶음은 같은 파일을 차례로 고칠 것. links-7 도 열쇠를 바꾸므로 같은 rekeyLedger 를 함께 쓰게 하면 이주가 한 번으로 끝난다. collect.mjs 는 feed·qnotice·qfeeds, collect-news.mjs 는 qnotice·qfeeds 묶음과 겹친다(한 줄 추가뿐).

---
## [browser/B10] P3 · confirmed

이유: 코드와 데이터로 확인했다. browser-collect.mjs:446 `if (!uniq.length || harvested) continue;` 때문에 첫 후보에서 수집한 뒤에도 남은 후보를 loadPage·readMorePages 로 연다(연세·상명·가천·숙명·중앙·시립·홍익·서울대). 그런데 거기서 읽은 것은 버린다. 10-04 리포트로 본 학교별 상태: 서강 '⚪ 링크 199 · 장학 0 (클릭 시도 0건)'이고 일반 로봇은 ✅ 25건. 숙명은 첫 주소가 '링크 2', 둘째는 학교 첫 화면 index.do 에서 '장학 7'을 긁었고, 피드에 수상 소식 'AWARDS 숙명여대 … 일본 문부과학성 장학생 선정'이 실제로 들어가 있다(data/notices/n1a4mxa4.json). 일반 로봇은 ✅ 9건. 가천은 475 가 학사공지(휴학·수강 안내), 7986 은 일반 로봇 게시판 478 과 같은 제목의 클릭 행이며(seen click 키 대조), 첫 화면은 0이다. 일반 로봇은 ✅ 146건이고, 브라우저 쪽 subview.do 표식 88키가 중복을 만든다. 하나 더: link-hunter.mjs:239 는 browser-targets 후보를 먼저 게시판 힌트로 쓰는데, 가천의 첫 힌트가 학사공지 475 다.

수리 명세: ① collector/browser-targets.json:
- 서강대학교·숙명여자대학교·가천대학교 항목을 parked 로 옮긴다(삭제 금지 · 학교마다 `_why`: '2026-10-04 점검 — 일반 로봇 ✅ n건(report.md) · 브라우저 0건/첫 화면 긁기/학사공지·중복 표식 → schools.json _collector 규칙').
- 홍익대학교 candidates 에서 학교 첫 화면 https://www.hongik.ac.kr/index.do 를 빼고 _note 에 이유를 남긴다.
- 상명 scholarship.do 는 아래 ② 때문에 첫 후보가 읽히면 열리지 않으므로 그대로 둔다.
② browser-collect.mjs harvestTarget:
- 후보가 '읽혔으면'(uniq.length>0 또는 r.clickSkipped>0 — B4 의 worked 와 같은 조건) 남은 후보를 열지 않고 break 한다.
- 남은 후보가 있으면 `  - ⏭ 남은 후보 n곳은 열지 않음(앞 주소에서 읽었다)` 한 줄을 남긴다.
- 읽히지 않은 후보(0건·오류)만 다음 후보로 넘어간다.
바꾸지 말 것: readMorePages(첫 후보의 2페이지) · 클릭 장부 규칙(관문 test-collector:625·:591 이 정규식으로 잠근 줄) · '.parked' 를 코드에서 읽지 않는다 · 일반 로봇 schools.json 의 서강·숙명·가천 행.

관문: 「수집망 복원」 절(설정 규칙): 후보 주소는 학교 첫 화면이 아니다(pathname 이 '/', '/index.do', '/kr/index.do' 이면 빨간불). B5 의 parked 규칙도 같은 절이다. verify/health-gates/browser.mjs 정적 검사: harvestTarget 원문에 `|| harvested) continue;` 가 없고 '남은 후보' 문구와 break 가 있다. 빨간불 증명: 홍익 index.do 를 되돌리거나 continue 로 되돌리면 빨개진다.

소급: 숙명 첫 화면에서 들어간 수상 소식 1건은 60일 규칙으로 2026-11-29 에 빠진다. 손으로 지우지 않는다(data/notices.json 은 합집합 병합 장부라 다른 브랜치에서 되살아난다). 가천의 중복 표식은 다른 세션의 markerPostIdKey 가 합친다. 새 중복은 이 수리로 더 생기지 않는다.

파일: collector/browser-targets.json collector/browser-collect.mjs verify/test-collector.mjs verify/health-gates/browser.mjs

위험: browser-targets.json 은 links·feed 묶음과 겹친다(서로 다른 학교 항목). harvestTarget 의 :446 근처는 다른 세션이 고친 :495 와 50줄 떨어져 있다. parked 로 옮기면 「수집망 복원」 :1381 줄이 빨개지므로 B5 의 ③과 반드시 같이 고칠 것.

---
## [browser/B11] P3 · confirmed

이유: 문구 부분은 사실이다. 예약은 '7 23 * * *'와 '7 3 * * *'(UTC)로 원래도 4시간·20시간 간격이다. 실제 생성 시각은 10-04 02:31, 10-03 01:52·09:02, 10-02 02:08·09:37, 10-01 02:02·10:00 이라 약 7시간·17시간 간격이다. 그런데 browser-collect.mjs:698·:726 은 '다음 실행(약 12시간 뒤)'이라고 쓴다. 지연은 created_at==run_started_at 이므로 GitHub 예약기 쪽 원인이다. Node 20 경고는 같은 로그 끝(2000행)에서 확인했지만 ops-14(ops 묶음)가 모든 워크플로를 한꺼번에 맡는다.

수리 명세: browser-collect.mjs:698·:726 의 '다음 실행(약 12시간 뒤)'를 '다음 예약 실행에'로 바꾼다(B5 문구 수리와 한 번에). setup-node/node-version 은 이 묶음에서 고치지 않는다(ops-14). 바꾸지 말 것: cron 값(홀수 분 관례·하트비트 간격 계산 관문).

관문: B5 와 같은 정적 검사를 쓴다: browser-collect.mjs 에 '약 12시간'이 없다. 빨간불 증명: 문구를 되돌리면 빨개진다.

소급: 없다.

파일: collector/browser-collect.mjs

위험: 없음(문구 두 줄).

---
## [collect/collect-08] P3 · confirmed

이유: 사실이다. 10-04 report.md:147-169 기준 대외활동 출처 23곳 중 ⛔ robots 5·⚠️ HTTP 404 2·🟡 0건 7 = 14곳이 글을 못 낸다. 재단 출처는 :176-189 기준 ⛔ 2(한진해운·한국고등교육재단)·🟡 2(미래에셋박현주·롯데)다. collect.mjs:272·:276 주석대로 활동·재단 게시판은 health.json 에 넣지 않으므로(prune-health 가 학교 이름이 아닌 키를 지운다) 연속 실패를 세는 장부가 없다. 그래서 '🚨 연속 실패' 경보가 구조적으로 없다. api-09 와 같은 사실이다. 이 항목은 '장치(코드)', api-09 는 '어느 출처를 보관할지(결정)'로 나눈다.

수리 명세: ① 새 순수 모듈 collector/source-health.mjs: `updateSourceHealth(ledger, rows, today)`.
- rows=[{key: boardUrl, name, status}].
- status 가 ✅ 로 시작하면 fails=0, lastOk=today.
- ⏰(예산으로 안 봄)·⚙️(주소 없음)이면 손대지 않는다.
- ⚠️·⛔·🟡 이면 fails+=1, why=상태 문구 앞부분.
- 지금 출처 목록에 없는 키는 지운다.
- 돌려주는 값은 {ledger, stale:[…]}이고, stale 문턱은 fails>=6(하루 3회 실행이라 약 이틀).
② collector/collect.mjs:
- actResults/extResults 를 채울 때 boardUrl 을 함께 담는다(지금은 name·status·items 뿐이다. harvestBoard 의 bucket.push 들).
- 리포트를 쓰기 전에 `fs.writeFileSync(new URL('source-health.json', HERE), JSON.stringify(x, null, 1))` 로 저장한다. 이 리터럴 꼴이어야 관문 test-collector:511-531 이 장부를 찾는다.
- stale 이 있으면 리포트 머리(시간 예산 줄 다음, 60,000바이트 자르기 전에 보이게)에 '### 🙋 이틀 넘게 글이 안 들어오는 대외활동·재단 출처 n곳 — 관리자 「활동」 탭에서 보관하거나 주소를 고쳐 주세요'와 줄마다 '이름 — 상태 — n회 연속'을 넣는다.
③ .github/workflows/collect-scholarships.yml 저장 단계에 `[ -f collector/source-health.json ] && git add collector/source-health.json` 를 더한다.
④ .gitattributes 에 `collector/source-health.json merge=jsonunion` 를 더한다. tools/merge-json-union.mjs 에 규칙 `{ match: /(^|\/)source-health\.json$/, merge: mergeHealth }` 를 더한다.
바꾸지 말 것: health.json 에 활동·재단을 넣지 않는다 · 관문 :1420 이 잠근 collect.mjs 의 health 두 줄 · robots.txt 가 막은 길을 읽게 하지 않는다(2026-09-29 법률 리서치 결정).

관문: verify/health-gates/browser.mjs:
ⓐ updateSourceHealth 표본 시퀀스: '⚠️ 접속 실패' 6회면 stale · ✅ 한 번이면 0 · '⏰' 는 그대로 · '🟡 …' 은 실패로 센다 · 출처 목록에서 빠진 키는 지운다.
ⓑ 정적 검사: collect.mjs 가 'source-health.json' 을 writeFileSync 하고 './source-health.mjs' 를 import 한다 · collect-scholarships.yml 에 git add 줄이 있다 · .gitattributes 줄과 merge-json-union 규칙이 있다.
빨간불 증명: ✅ 판정을 '⛔ 아님'으로 바꾸면 🟡 가 성공으로 세져 ⓐ 가 빨개진다. git add 줄을 빼면 기존 관문 「장부가 저장 목록에 다 있다」도 빨개진다.

소급: 첫 실행부터 센다. 과거 14회는 장부에 없으므로 이틀(6회) 뒤 첫 🙋 이 뜬다. 리포트 이력에서 거꾸로 채우지 않는다(실데이터 손편집 금지).

파일: collector/source-health.mjs collector/collect.mjs .github/workflows/collect-scholarships.yml .gitattributes tools/merge-json-union.mjs verify/health-gates/browser.mjs

위험: collect.mjs 는 feed·qnotice·qfeeds 묶음과 겹친다. collect-scholarships.yml 은 ops-14·ci·gate·bodies 와 겹치고, 기본 브랜치의 30e214b4 도 고쳤다(우리 HEAD 뒤에 있다 — 수리 전에 기본 브랜치를 받을 것). .gitattributes 는 다른 세션과 admin·qfeeds 묶음이, merge-json-union.mjs 는 feed·qfeeds 묶음이 고친다. 줄 하나씩 더하는 것뿐이다.

---
## [api/api-09] P3 · needs-human
**결정(선조치후보고 · 추천안 ①): robots.txt 정책은 그대로 지킨다. ⛔ robots 5곳 + 온통청년 청년참여 게시판(공공 API 와 겹침)은 activity-sources.json 에서 지우지 말고 보관(park — 그 파일의 기존 보관 방식 그대로)한다. 404 두 곳·🟡 일곱 곳은 그대로 두되, 연속 실패 장부/리포트 경보가 명세에 있으면 그것으로 보이게 한다.**

이유: 사실이다(collect-08 과 같은 근거: report.md:147-169). ⚠️ 404 두 곳(경희대 khu.ac.kr/kor/notice/list.do?…category=GENERAL · 청년재단 kyf.or.kr …BBSMSTR_000000000367), ⛔ robots 다섯 곳, 🟡 일곱 곳이다. '온통청년 청년참여 프로그램'(youthcenter.go.kr/bbs03List/48)은 공공 API 청년콘텐츠가 같은 게시판 48 을 받는다(collector/open-api-map.mjs:225-229 — bbs03View/48/{pstSn}). 그래서 중복이다. 장치 부분은 collect-08 이 맡는다. 남은 것은 출처마다 보관할지·고칠지의 결정이다. 하나 더: 한국외대 두 곳은 학교 게시판인데 활동 출처라서 robots.txt 를 묻는 규칙(collect.mjs:306-310)에 막힌다. 반면 같은 학교의 장학 게시판은 묻지 않고 읽는다. 이것은 정책 결정이다.

수리 명세: 결정이 나면: 보관은 관리자 화면 「활동」 탭의 출처 보관 버튼(activitySource → tools/admin-apply.mjs) 한 길로 한다. 재단 ⛔ 2곳은 collector/external-sources.json 의 parked 로 옮긴다(삭제 금지). 404·🟡 는 run-probe.txt checkUrl 정찰 결과로만 주소를 고친다(activity-sources.json 의 evidence 칸에 확인한 곳을 적는다).

관문: (없음)

소급: (없음)

파일: collector/activity-sources.json collector/external-sources.json

위험: activity-sources.json 은 관리자 버튼이 쓰는 파일이다. 손으로 고치지 말고 admin-apply 길로 할 것.

---
## [collect/collect-16] P3 · confirmed

이유: 도메인 부분은 사실이다. collector/kind-classify.mjs:39 와 collector/scope-promote.mjs:40 은 같은 꼴로 `domainOf = (school) => schools.find(x => x.school===school && x.boardUrl)` 를 쓴다. 그래서 schools.json 의 boardUrl 이 null 인 고려대·중앙대·부산대·계명대는 ''가 되어, kind-evidence.mjs:78 emailIsSchool(학교 이메일 신호)을 영영 못 쓴다. 영향은 작다: emailIsOutside 가 .ac.kr 을 이미 빼므로(kind-evidence.mjs:79) 잘못된 전국 승격은 없다. 교내 판정이 high 대신 mid 에 머물러 학습 표에 안 들어가는 정도다. 'likely'를 코드 확인으로 올렸다. Node 20 부분은 같은 경고가 모든 로봇 로그에 있고 ops-14(ops 묶음)가 맡는다.

수리 명세: ① collector/kind-evidence.mjs 에 순수 함수 `domainForSchool(school, schools, targets)` 를 더한다. schools.json 에 그 학교 boardUrl 이 있으면 schoolDomain(boardUrl)(지금과 같다), 없으면 browser-targets targets 의 같은 학교 첫 후보 주소로 schoolDomain 한다. 둘 다 없으면 ''. parked 는 보지 않는다.
② kind-classify.mjs·scope-promote.mjs 의 각자 domainOf 를 이 함수로 바꾸고, browser-targets.json 을 읽기 전용으로 읽어 넘긴다(두 벌 사본 제거).
③ 워크플로 node-version 은 이 묶음에서 고치지 않는다(ops-14).
바꾸지 말 것: auto-register.mjs(관문 :2993 '등록 로봇이 수집 설정을 건드리지 않는다' — browser-targets 글자를 넣지 말 것 · 지금도 schoolDomain(n.url) 을 쓰니 고칠 필요 없음) · emailIsOutside 의 .ac.kr 제외 규칙.

관문: verify/health-gates/browser.mjs:
ⓐ domainForSchool('고려대학교', [{school:'고려대학교',boardUrl:null}], [{school:'고려대학교',candidates:['https://www.korea.ac.kr/ko/568/subview.do']}]) === 'korea.ac.kr'.
ⓑ boardUrl 이 있으면 그쪽(표본 news.khu.ac.kr → khu.ac.kr).
ⓒ 어디에도 없으면 ''.
ⓓ 정적 검사: 두 파일에 `const domainOf = (school) => { const row = schools.find(` 가 없고 domainForSchool 을 import 한다.
빨간불 증명: 대체 경로(targets)를 빼면 ⓐ 가 ''가 되어 빨개진다.

소급: 두 로봇이 매 실행 등록분 전체를 다시 판정하므로 다음 실행이 스스로 소급한다(kind-classify 는 high 만 고친다). 일회 실행은 필요 없다.

파일: collector/kind-evidence.mjs collector/kind-classify.mjs collector/scope-promote.mjs verify/health-gates/browser.mjs

위험: scope-promote.mjs 는 qnotice 묶음과 겹친다. kind-classify.mjs·scope-promote.mjs 는 불러오는 순간 실행되므로 관문은 kind-evidence.mjs 의 순수 함수만 부를 것.

---
## [collect/collect-11] P3 · needs-human
**결정(추천안 ①): 예약은 그대로, 주석·리포트 문구만 '예약 시각(실제는 몇 시간 늦을 수 있음)'으로 바로잡는다.**

이유: 사실이다. collect-scholarships.yml:8-13 의 cron 22:41·02:41·06:41(UTC)에 비해 실제 생성 시각이 늦다. 10-04 01:57·08:47, 10-03 01:23·08:33·11:59, 10-02 01:47·09:00·13:08 로 +2.7~6.5시간이다. created_at==run_started_at 이므로 대기줄 탓이 아니라 GitHub 예약기 지연이다(저장소 안에서 고칠 수 없다). 정시성이 필요한지는 개발자가 정할 일이다. 브라우저 리포트의 '약 12시간 뒤' 문구는 B11 이 고친다.

수리 명세: ①이면 이 묶음에서는 브라우저 리포트 문구(B11)만 고친다. 워크플로 주석의 KST 시각 표기는 ops 묶음이 그 파일을 고칠 때 함께 '예약 시각'으로 바꾼다. ②이면 별도 과제다(외부 크론 → workflow_dispatch · 시크릿 필요).

관문: (없음)

소급: (없음)

파일: .github/workflows/collect-scholarships.yml

위험: collect-scholarships.yml 은 여러 묶음이 고치는 파일이다. 주석 한 줄 때문에 따로 손대지 말 것.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [browser/B12] already-fixed: 이미 고쳐졌다. browser-collect.yml 의 checkout 에 `ref: ${{ github.ref_name }}`(2026-09-30 주석)가 있고, 그 뒤 예약 실행 #200~#208 이 모두 conclusion=success 다(actions_list). 10-04 run 37171328367 의 '결과 저장' 단계도 success 다. 조치할 것 없다.
- [collect/collect-15] already-fixed: 이미 고쳐졌다. 모든 수집 워크플로가 NODE_EXTRA_CA_CERTS: collector/certs/bundle.pem 을 쓴다(collect-scholarships.yml:35 등). collector/report.md:35 에 '서강대학교 상태: ✅ 정상 (실공고 25건 감지)'가 있다. 로그 54행의 'Ignoring extra certs … No such file'은 checkout 전에 도는 node 에서만 나고 무해하다(10-04 로그에서 같은 줄을 확인했고, 그 뒤 수집은 정상).

---
## 정찰 결과 (2026-10-04 run 37199154224)

출처: GitHub Actions run 37199154224 「링크 정찰」 job 111427067133 로그의 `node collector/probe-links.mjs` 단계(리포트 머리 `## 🔎 링크 정찰 리포트 (2026-10-04 20:34 KST)`). 대상은 run-probe.txt 11-14행(커밋 5dedc0ad). 아래 따옴표는 로그 원문 그대로다.

### 홍익대 (B2)
① `checkUrl: https://www.hongik.ac.kr/kr/newscenter/notice.do`
- `- 상태 200 · 최종 주소: https://cdn-botmanager.stclab.com/sample/challenge/index.html`
- `- 화면 제목: Security Verification` (큰 제목·화면 글자 모두 빈칸)
- `- **로그인 요구: ✅ 아니오**` · `- 서버가 보낸 HTML: 못 읽음`
- `- 날짜 줄: 없음 (머리·메뉴·바닥 밖에 날짜가 든 줄이 없거나 목록이 안 그려짐)` → 글 줄 0개, href·onclick 없음.
- 요청 7개는 첫 GET 하나 말고 전부 봇 관리 서비스다: `· GET https://botmanager.stclab.com/api/v1/macro/detect?tenantId=TN250401-F7476465&domainName=www.hongik.ac.kr…`, `· GET https://cdn-botmanager.stclab.com/sample/challenge/index.html?…`, `· GET https://botmanager.stclab.com/api/v1/macro/screen-urls?…`, `· POST https://botmanager.stclab.com/api/v1/macro/release` ×3. 응답 칸은 `칸: code,blockType,detectionType,secondVerifyType,message,actionType,screenUrl`이고, `JSON (글 배열 없음)`. 글 목록 응답은 하나도 없다.

② `checkUrl: …/notice.do?noCat=501` (가설 주소)
- `- 상태 200 · 최종 주소: https://cdn-botmanager.stclab.com/sample/challenge/index.html` · `- 화면 제목: Security Verification` · `- **로그인 요구: ✅ 아니오**` · `- 날짜 줄: 없음 (…)`
- `macro/release` POST 8회, 응답은 `→ 400 · application/json · 51자`, 그다음 `→ 200 · application/json · 60자`. 글 배열 응답은 없다.

③ 참고: 같은 실행의 45행 `…notice.do?mode=view&articleNo=154473&article.offset=0&articleLimit=10&noCat=501` 도 결과가 같다(`최종 주소: https://cdn-botmanager.stclab.com/sample/challenge/index.html` · `Security Verification`).

**결론(홍익): 이 정찰로는 장학 게시판 주소를 정할 수 없다.** 세 주소 모두 봇 차단 화면(stclab BotManager 'Security Verification')으로 넘어갔다. 목록은 한 줄도 보이지 않았고, `noCat=501`이 장학 분류인지도 확인하지 못했다.
- browser-targets.json `candidates` 와 schools.json `boardUrl` 의 주소를 바꿀 근거는 **없다**. B2 의 2단계는 하지 않는다. 명세대로 '보안 확인 화면만 보이면 humanQuestion'으로 간다.
- 근거가 있는 변경은 하나다. 홍익 `_note` 에 "2026-10-04 정찰(run 37199154224): notice.do·noCat=501·상세 모두 cdn-botmanager.stclab.com 'Security Verification'으로 넘어감" 한 줄을 적는다.
- 로그로 알 수 없는 것: 10-04 02:43 브라우저 수집기의 '⚪ 링크 143'이 이번 정찰과 왜 다른지. 그 143개가 무슨 링크였는지는 이 로그에 없다.

### 서울시립대 (B3)
`findBoard: https://www.uos.ac.kr/ | 장학`
- 누른 길: `- '장학' 이동 → https://www.uos.ac.kr/main.do?identified=anonymous&`. 장학 게시판이 아니라 학교 첫 화면으로 돌아왔다. `- 화면 제목: 서울시립대학교`
- 첫 화면의 상태 코드·로그인 판정 줄은 로그에 없다(findBoard 절은 그 줄을 찍지 않는다).
- `- 이 화면의 장학 관련 줄: 2개`
  - `· 장학/학자금대출  →  https://www.uos.ac.kr/kor/html/life/support/scholarship.do?menuid=2000005003002000000`
  - `· 경영경제전문도서관 국가근로장학생 추가 모집  →  https://www.uos.ac.kr/korNotice/view.do?list_id=FA1&seq=31569&menuid=2000005009002000000`
- `- 그중 **공고 원문으로 바로 가는 주소**: 1개` → 그 FA1 글을 열었다.
  - `- 상태 200 · 최종 주소: https://www.uos.ac.kr/korNotice/view.do?list_id=FA1&seq=31569&menuid=2000005009002000000&identified=anonymous&`
  - `- 화면 제목: 상세내용 < 일반공지 < UOS공지 < 캠퍼스생활 < 서울시립대학교`
  - `- **로그인 요구: ✅ 아니오**`. 요청에는 SSO 왕복이 있었다(`· POST https://www.uos.ac.kr/exsignon/sso/sso_identify.jsp · 본문: RelayState=%2Fcommon%2Ferror.jsp&failureCause=unauthorized&status=failure`). 그 뒤 `identified=anonymous` 로 본문이 열렸다. 봇 차단 화면은 없었다(제목·본문 정상).
  - 날짜 줄은 상세 화면의 글 머리 하나뿐이다: `· 「신명진 사서과 (등록일 : 2026-09-30)」 2026-10-01 → (링크 없음) · 줄: <div class="da">`. `- 화면의 '목록' 링크: <a href="#n" onclick="fnList();">`
  - 연관 글 JSON(`/search/relation-list.do`)의 `칸 5개: reg_date,list_id,linkurl,title,seq`. 앞 5개는 `list_id:FA34` 2건과 `list_id:FA1` 3건이다(모두 국가근로 글).
- 목록 화면은 열지 않았다. 그래서 목록 줄 8개(제목·날짜·href)는 없다. `scholarship.do?menuid=2000005003002000000` 도 열지 않았다(그 주소의 🔗 절이 없다). 그 주소가 안내 페이지인지 게시판인지 모른다.

**결론(시립): 이 정찰로는 장학 전용 게시판을 정할 수 없다.**
- 근거가 있는 변경은 문구 하나다. browser-targets.json 시립대 `_note` 의 'FA1이 장학공지'와 schools.json note 의 'FA1=장학공지'를 "FA1 = 일반공지"로 고친다. 근거는 2026-10-04 정찰 화면 제목 `상세내용 < 일반공지 < UOS공지 < 캠퍼스생활`이다.
- `candidates`·`boardUrl` 의 주소는 바꾸지 않는다. 장학 주소를 확인하지 못했다.
- 다음 정찰 후보는 로그에 실제로 있는 메뉴 주소다: `checkUrl: https://www.uos.ac.kr/kor/html/life/support/scholarship.do?menuid=2000005003002000000`. 무엇인지 확인하려는 것이고, 게시판이라는 가정은 하지 않는다.
- 장학 전용 게시판이 끝내 없으면 명세대로 humanQuestion 으로 간다.

### 2차 (run 37210290585 · job 111459915962 · 커밋 b6fb9997 · 리포트 `## 🔎 링크 정찰 리포트 (2026-10-04 23:43 KST)`)

**서울시립대**: `checkUrl: https://www.uos.ac.kr/kor/html/life/support/scholarship.do?menuid=2000005003002000000` (run-probe.txt 9행)
- `- 상태 200 · 최종 주소: https://www.uos.ac.kr/kor/html/life/support/scholarship.do?menuid=2000005003002000000&identified=anonymous&`
- `- 화면 제목: 장학/학자금대출 < 학생지원 < 캠퍼스생활 < 서울시립대학교` · `- 큰 제목: 서울시립대학교`
- `- **로그인 요구: ✅ 아니오**`. 1차의 FA1 상세와 같은 SSO 왕복이 있었다(`sso_identify.jsp · 본문: RelayState=%2Fcommon%2Ferror.jsp&failureCause=unauthorized&status=failure`). 그 뒤 `identified=anonymous` 로 열렸다. 봇 차단 화면은 없었다.
- 화면 글자의 본문 부분: `장학/학자금대출 장학/학자금대출 장학 장학 바로가기 학자금대출 학자금대출 바로가기 #장학 #학자금대출 홈페이지 내용수정 및 개선의견 등록 …`
- `- 서버가 보낸 HTML: 못 읽음` · `- 날짜 줄: 없음 (머리·메뉴·바닥 밖에 날짜가 든 줄이 없거나 목록이 안 그려짐)`. 목록 요소로 잡힌 것은 사이트 메뉴(`날짜 0개 · 링크 169개 든 <ul class="depth1">`)뿐이다.
- 화면이 부른 요청 5개는 이 페이지와 SSO 요청뿐이다. 목록 API 는 없었다.
- '장학 바로가기'가 어느 주소로 가는지는 로그에 찍히지 않았다(href 줄이 없다).

**결론(시립 2차): 이 주소는 장학 공고 게시판이 아니다.** '장학'·'학자금대출' 두 갈래로 보내는 바로가기 안내 화면이다. 날짜 붙은 글 줄도 글 링크도 없다.
- `candidates`·`boardUrl` 로 쓸 근거가 없다. 장학 게시판 주소는 여전히 **정할 수 없음**이다.
- 1차 결론(문구 'FA1 = 일반공지'만 고친다)은 그대로다.
- 다음 정찰 제안: `findBoard: https://www.uos.ac.kr/kor/html/life/support/scholarship.do?menuid=2000005003002000000 | 장학 바로가기`. '장학 바로가기'를 실제로 눌러 최종 주소를 받으려는 것이다. 그 주소가 학교 밖(포털·다른 사이트)일 수도 있어서 미리 짐작하지 않는다.

참고(홍익): 같은 2차 실행의 51행 `…notice.do?mode=view&articleNo=154473…&noCat=501` 도 `- 상태 200 · 최종 주소: https://cdn-botmanager.stclab.com/sample/challenge/index.html` 이다(이번에는 `- 화면 제목: ` 빈칸). 1차 결론(봇 차단 · 주소를 정할 수 없음)은 그대로다.
