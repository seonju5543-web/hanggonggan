# 수리 명세 — 묶음 alerts

권장 순서: links/links-5 → ops/ops-07 → news/news-10 → servers/servers-F2 → links/links-1 → links/links-3 → links/links-4 → news/news-14 → news/news-6 → news/news-2 → ops/ops-06 → news/news-3 → ops/ops-04 → ops/ops-05 → app2/app2-F9 → app1/app1-10 → api/api-04 → ops/ops-08 → app1/app1-06 → app2/app2-F8 → api/api-07 → refresh/ESSAY-02 → refresh/ESSAY-01 → insta/insta-6 → insta/insta-3 → servers/servers-F9 → ops/ops-13 → admin/admin-F8
예상 손댈 파일: tools/alert-issue.mjs .github/actions/alert-issue/action.yml .github/actions/robot-down/action.yml collector/robot-heartbeat.mjs .github/workflows/robot-heartbeat.yml tools/report-retention.mjs tools/app-fetch-files.cjs insta/ready-issues.mjs .github/workflows/link-hunter.yml .github/workflows/audit-coverage.yml .github/workflows/collect-news.yml .github/workflows/close-old-reports.yml .github/workflows/push-health.yml .github/workflows/check-live.yml .github/workflows/verify-ui.yml .github/workflows/device-deploy.yml .github/workflows/open-api.yml .github/workflows/essay-playbook.yml .github/workflows/insta.yml .github/workflows/insta-stats.yml .github/workflows/insta-comments.yml .github/workflows/insta-samples.yml .github/workflows/insta-token-check.yml .github/workflows/push-check.yml .github/workflows/admin-lock-check.yml verify/health-gates/alerts.mjs verify/health-gates.mjs

검증 메모: 검증 결과: 28건 중 27건 맞음(confirmed), 1건(links-4 #386)은 근본 원인이 0f8d91f4 로 이미 고쳐져 열린 이슈만 남았다(already-fixed). 다른 세션이 이미 고친 것은 없다. 등급은 경보 위생 성격에 맞게 몇 건 낮췄다: ops-08 계열 셋, api-07, ESSAY-01, insta-6, news-6 은 P2→P3. 지금 열린 이슈는 186건이다(REST 집계 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/verify-alerts/open.tsv).

🔴 시작 전 확인할 것: 다른 세션(claude/source-link-integrity)이 2026-10-04 09:43Z 에 기본 브랜치와 main 에 합쳐졌다(e5db6911). 우리 브랜치 46f08990 은 그보다 뒤다. 그 사이 check-live.yml·verify-ui.yml·link-check.yml·admin-apply.yml·collect-scholarships.yml·rescue-bodies.yml·test-collector.mjs 가 바뀌었으므로 origin/claude/nice-heisenberg-WESq5 를 먼저 병합하고 시작한다. check-live.yml 의 다음 줄들은 관문이 글자 그대로 잡고 있다. verify/link-gates/robot.mjs:402-405(다른 세션의 관문)와 test-collector 의 소식 사진·학교 사진 절이다. 해당 줄은 out.push('data/link-check.json'·'data/link-fixes.json'), const measure = …, const count = …, const m = …, m(f), m('live/' + f) 이고 하나도 바꾸지 말고 새 줄만 더한다.

공용 설계(묶음 전체가 기대는 것, 한 번만 만든다):
- A. 경보 이슈 한 곳: tools/alert-issue.mjs(순수 함수 planAlert + REST 실행부) 와 .github/actions/alert-issue. 이슈는 라벨이 아니라 제목(exact/prefix)으로 찾는다. 라벨 없는 옛 이슈(#350·#356)도 잡히고 다른 로봇 이슈와 섞이지 않게 하려는 것이다. open 은 '댓글 아니면 하나 만들고, 같은 초에 생긴 중복은 닫기', resolve 는 닫기다. robot-down 은 입력과 문구를 그대로 두고 내부만 이 도구를 쓰며, 도구가 실패하면 옛 gh 경로로 물러난다.
- B. 해소된 robot-down 경보 닫기: 하트비트(collector/robot-heartbeat.mjs 의 robotNamesOf·robotDownVerdicts, --close-recovered)가 맡는다. 워크플로 9곳마다 성공 단계를 붙이지 않으므로 다른 세션 파일인 link-check.yml 을 건드릴 필요가 없다.
- 같은 결함인데 찾은 목록에 없던 것도 함께 고친다. audit-coverage.yml 의 coverage-audit 라벨이 없어서 🚨 감사 실패 이슈가 아예 안 만들어진다. insta-token-check.yml·insta.yml(skip 작업)은 실패를 요약 한 줄로만 남긴다. 전역 관문 S1·S3 이 이것들까지 잡도록 넣었다.

관문 파일 verify/health-gates/alerts.mjs 절 구성(① planAlert ② pickToClose ③ robotDownVerdicts ④ fetchPathsIn·check-live ⑤ closableReadyIssues ⑥ 전역 S1 라벨·S2 체크아웃·S3 실패가 사람에게 닿음 ⑦ 인스타 tee·pipefail ⑧ collect-news ⑨ verify-ui ⑩ open-api·device-deploy·essay ⑪ push-check·admin-lock ⑫ link-hunter). 순수 함수는 표본으로만 재고, 워크플로는 글자(코드)로 잰다. data/·collector/ 장부는 읽지 않는다. S1·S2·S3 은 지금 HEAD 에서 이미 빨강이 나야 하며, 그것이 red 증명이다. verify/health-gates.mjs 의 PARTS 에 'alerts' 를 더한다. PARTS 줄은 모든 묶음이 고치는 자리라 오케스트레이터가 합칠 것.

🔴 수집 로봇들도 데이터 관문에서 test-collector 를 돌린다. 새 관문이 러너에서 빨개지면 모든 로봇 결과가 되돌려지므로 push 전에 로컬에서 node verify/test-collector.mjs 와 node verify/health-gates.mjs alerts 를 반드시 초록으로 확인한다. collect-news.yml 은 「교내 소식」 ⑤ 의 '작업 상한 > 단계 상한 합 + 3' 을 지켜야 한다(새 단계 수만큼 job 상한을 올린다).

묶음 밖으로 넘길 것: eligibility-fill.yml 에도 `| tee` 8곳이 있어 같은 결함(실패가 초록으로 묻힘)이다. rescue-bodies.yml 은 실패마다 날짜 붙은 🚨 이슈를 새로 만든다(4건 열림). 둘 다 다른 묶음 몫이다. CLAUDE.md 에 한 줄(경보 이슈는 .github/actions/alert-issue 한 곳 · 관문 「로봇·도구 점검 관문」 alerts)을 넣을지는 오케스트레이터가 모아서 정한다. 이 묶음의 filesTouched 에는 넣지 않았다.

사람 결정이 필요한 것은 하나다. 라벨 없이 쌓인 옛 🔧 링크 사냥꾼 이슈 25건을 닫을지다(links-1 humanQuestion · 추천은 일괄 닫기 + 새 이슈 안내). 나머지 옛 이슈(#274·#350·#356·#386·📘·✅·🔍·죽은 📸 8건)는 수리 뒤 로봇이 스스로 닫는다.

읽기만 했다. 임시 작업 트리는 지웠다.


---
## [links/links-5] P3 · confirmed

이유: 맞음(일부만 손볼 가치). ① run 37141078600(기본 브랜치·대기줄 취소): checkout 단계 cancelled → '🚨 로봇이 넘어졌다' failure(Can't find action.yml). 다만 체크아웃 전에 취소되는 것은 거의 늘 대기줄·사람 취소라서 실제 손해는 '체크아웃 단계가 아예 없는' 두 워크플로(close-old-reports·push-health — news-10·servers-F2)뿐이다. ② 취소 사유는 if: 로 못 가른다 — 정책을 바꾸지 않고 ③(성공하면 닫기)로 헛경보가 하루 안에 사라지게 하는 것이 안전하다. ③ robot-down/action.yml:52-57 은 열기·댓글만 하고 닫는 길이 없다 — #386 은 22분 뒤 같은 로봇이 성공(run 37141332557)했는데 지금도 열려 있다. 덧붙여 robot-down 은 `--search "$ROBOT in:title"`(한글 검색 — 저장소가 이미 '놓친다'고 적은 방식)로 찾는다.

수리 명세: [공용 부품 A — 경보 이슈 한 곳] 새 파일 tools/alert-issue.mjs: ⓐ 순수 함수 `planAlert({mode:'open'|'resolve', title, match:'exact'|'prefix'}, openIssues)` → `{comment:번호|null, create:bool, close:[번호…]}` — open: 제목이 같은(prefix 면 title 로 시작하는) 열린 이슈 중 번호가 가장 작은 것에 댓글, 없으면 만들기, 맞는 것이 둘 이상이면 가장 작은 것만 남기고 나머지 close(같은 초 경합 정리). resolve: 맞는 열린 이슈 전부 close. 🔴 찾을 때는 라벨이 아니라 **제목**으로 찾는다(라벨 없는 옛 이슈 #350·#356 도 잡히게 · 다른 로봇의 robot-down 이슈와 섞이지 않게). 라벨은 만들 때 붙이기만 한다. ⓑ 실행부(불러오는 순간 실행하지 않게 main 가드): GH_TOKEN·GITHUB_REPOSITORY 로 REST — 열린 이슈 전부(per_page=100 페이지 넘김 · pull_request 제외) → planAlert → POST /issues {title, body, labels:[label], assignees}(담당자 때문에 실패하면 담당자만 빼고 다시 · 라벨은 유지 — REST 는 없는 라벨을 스스로 만든다: rescue-bodies·essay-playbook 라벨이 그렇게 생겼다) / 댓글 / PATCH state=closed,state_reason=completed + 닫는 이유 댓글. 만든 뒤 3초 쉬고 목록을 다시 받아 close 를 한 번 더 적용. 인자: --mode --title --match --label --body-file|--body --assignee. 새 composite .github/actions/alert-issue/action.yml(inputs token·mode·title·match·label·body·body-file·assignee → `node tools/alert-issue.mjs …` · 러너 기본 node 사용). robot-down/action.yml: 입력·문구 그대로, 찾기·만들기만 `node tools/alert-issue.mjs --mode open --match exact --title "🚨 로봇이 넘어졌어요 — $ROBOT" --label robot-down` 로 바꾸고, node 가 실패하면 지금의 gh 경로로 물러난다. [③ 성공하면 닫기 — 공용 부품 B] collector/robot-heartbeat.mjs 에 순수 함수 `robotNamesOf(ymlText)`(`uses: ./.github/actions/robot-down` 뒤 with 의 `robot:` 값 목록) · `robotDownVerdicts(issues, lastOkByRobot)`(issue={number,title,createdAt,lastBotCommentAt} · 제목 '🚨 로봇이 넘어졌어요 — X' 의 X · lastOk 가 max(createdAt, lastBotCommentAt) 보다 늦으면 close, lastOk 없음·조회 실패면 keep — '못 읽음을 괜찮음으로 읽지 않는다') + `--close-recovered` 모드(워크플로 파일마다 robotNamesOf → lastSuccessAt(파일) 재사용 → 열린 robot-down 이슈와 댓글을 REST 로 받아 닫기, 닫는 댓글에 성공 시각·로봇 이름). robot-heartbeat.yml 에 단계 '다시 선 로봇의 넘어짐 경보를 닫는다'(timeout-minutes 2 · continue-on-error true · 권한 이미 issues: write·actions: read). ①은 체크아웃이 아예 없는 두 곳만 고친다(news-10). ②(취소 사유 구분)는 하지 않는다. 바꾸면 안 되는 것: robot-down 의 입력 이름·이슈 제목 꼴(옛 이슈와 이어져야 한다) · 하트비트의 '경보감일 때 두 번째 길' 줄(test-collector 「하트비트 간격 계산」 정규식) · link-check.yml(다른 세션 파일)은 손대지 않는다 — 하트비트가 닫으므로 손댈 필요가 없다.

관문: verify/health-gates/alerts.mjs ① planAlert 표본: (a) 열린 것 없음 → create (b) 같은 제목 하나 → 그 번호에 comment (c) 같은 제목 둘(#389·#390 꼴) → 작은 번호에 comment·큰 번호 close (d) 같은 라벨의 다른 로봇 제목('— 실제 앱 반영 확인')만 있음 → create(섞지 않음) (e) prefix 모드에서 시각 붙은 옛 제목 '🚨 앱 반영 점검 실패 (2026-10-01 19:53 KST)' → 그것에 comment / resolve 면 close · 맞지 않는 🚨 는 안 닫음. ③ robotNamesOf(표본 yml 두 robot-down 블록) → 두 이름 · robotDownVerdicts: 경보 17:36·성공 17:58 → close / 성공 17:00 → keep / 성공 17:58 뒤 17:59 봇 댓글(다시 넘어짐) → keep / 성공 정보 없음 → keep. ⑥ 전역: robot-down 액션이 제목 정확 비교 도구를 부른다. 빨간불 증명: planAlert 를 '라벨만 보고 첫 이슈'로 되돌리면 (d) 빨강, robotDownVerdicts 비교를 createdAt 만 보게 바꾸면 '다시 넘어짐' 표본 빨강.

소급: #386 은 수리가 기본 브랜치에 올라간 뒤 첫 하트비트(매일 17:29 KST)가 스스로 닫는다(원문 링크 복구 로봇 성공 17:58Z > 경보 17:36Z). 손으로 닫을 필요 없음.

파일: tools/alert-issue.mjs /.github/actions/alert-issue/action.yml .github/actions/robot-down/action.yml collector/robot-heartbeat.mjs .github/workflows/robot-heartbeat.yml

위험: robot-down 은 9개 워크플로가 같이 쓴다 — 도구가 틀리면 모든 넘어짐 알림이 조용해진다. 그래서 node 실패 시 옛 gh 경로로 물러나는 줄을 꼭 둔다. check-live·admin-lock-check 는 `ref: main` 으로 체크아웃하므로 tools/alert-issue.mjs 가 main 에도 있어야 한다(배포 순서: 기본 브랜치·main 동시 push). 우리 브랜치(46f08990)는 기본 브랜치보다 뒤다 — 다른 세션의 원문 링크 작업이 09:43Z 에 기본·main 에 합쳐졌으므로 먼저 origin/claude/nice-heisenberg-WESq5 를 병합하고 시작할 것.

---
## [ops/ops-07] P2 · confirmed

이유: 맞음. #274 의 본문·댓글 브랜치 5개(notion-check-task-planning-w3e5ln·admin-page-interface-redesign-ylgfrz·handaejang-revenue-model-akd2gl·job-posting-form-read-error-98ck8a·sweet-brown-td5a5o)를 GitHub compare(main...브랜치)로 재니 전부 ahead_by 0 — 다 나갔는데 🚨 가 09-14 부터 열려 있다. device-deploy.yml:225-244 는 열기·댓글만 한다. #386(robot-down)도 성공 뒤 열린 채 — 닫는 짝이 없다(admin-lock-check·robot-heartbeat·verify-ui 는 있다).

수리 명세: ① robot-down 쪽은 links-5 의 공용 부품 B(하트비트가 성공한 로봇의 경보를 닫음)로 끝난다 — 워크플로마다 '성공 단계'를 붙이지 않는다(9곳 손대기·다른 세션의 link-check.yml 피함). ② device-deploy.yml: 새 단계 '배포가 됐으면 옛 배포 실패 경보를 닫는다' — if: steps.run.outputs.state == 'deployed' || steps.run.outputs.state == 'uptodate' · timeout-minutes 2 · continue-on-error true. 열린 device-deploy 라벨 이슈마다 본문+댓글에서 "작업 브랜치 `X`" 의 X 를 모두 뽑아 `gh api repos/$REPO/compare/main...X --jq .ahead_by` 가 전부 0 이면 닫는다(닫는 댓글에 브랜치별 결과). 404(브랜치 지워짐)·조회 실패는 '모름' → 그 이슈는 닫지 않는다. 바꾸면 안 되는 것: 실패 알림 단계(conflict/auditfail 가지 문구 — test-collector ④ '화면으로 부르지 않는다' 검사) · branch: 대조 안전장치.

관문: alerts.mjs ⑩ 정적: device-deploy.yml 에 state deployed|uptodate 조건의 닫기 단계가 있고 그 안에 `compare/main...` 과 ahead_by 판정이 있다 + ③(links-5 표본). 빨간불: 닫기 단계를 지우면 빨강.

소급: #274 는 다음 device-deploy 성공 실행(하루 수십 번 돈다)이 스스로 닫는다. #386 은 하트비트가 닫는다. 손댈 것 없음.

파일: .github/workflows/device-deploy.yml collector/robot-heartbeat.mjs .github/workflows/robot-heartbeat.yml

위험: device-deploy 는 push 트리거가 모든 브랜치라 어느 브랜치에서든 돈다 — 닫기는 '모든 브랜치가 main 에 들어감'이라는 사실로만 판정하므로 어느 브랜치에서 돌아도 안전하다.

---
## [news/news-10] P3 · confirmed

이유: 맞음. close-old-reports.yml 의 steps 는 '오래된 리포트만 골라 닫는다'와 106행 `uses: ./.github/actions/robot-down` 둘뿐, actions/checkout 이 없다. 같은 꼴이 push-health.yml:145. 로컬 액션은 체크아웃이 있어야 불린다 — 체크아웃이 취소된 run 37141078600 에서 robot-down 이 'Can't find action.yml' 로 실패한 것이 같은 원리의 실측이다. 둘 다 아직 넘어진 적이 없어 증상은 잠복.

수리 명세: close-old-reports.yml 맨 앞에 `- uses: actions/checkout@v4`(fetch-depth 1) — ops-06 에서 tools/report-retention.mjs 를 부르려면 어차피 필요하다. push-health.yml 맨 앞에 `- uses: actions/checkout@v4` (with: sparse-checkout: | .github/actions  tools — alert-issue 도구까지). 다른 단계·판정은 그대로.

관문: alerts.mjs ⑥ 전역 S2: 모든 워크플로·job 에서 `uses: ./.github/actions/` 를 쓰는 단계보다 앞에 `actions/checkout` 이 있다(job 경계로 나눠서 잰다). 빨간불: close-old-reports.yml 의 checkout 을 빼면 빨강(지금 HEAD 에서 두 파일로 빨강 확인 가능).

소급: 없음(잠복 결함).

파일: .github/workflows/close-old-reports.yml .github/workflows/push-health.yml

위험: 없음.

---
## [servers/servers-F2] P3 · confirmed

이유: 맞음 — news-10 과 같은 결함(push-health.yml:145 robot-down · 체크아웃 0개 · run 37162895315 단계 목록에도 checkout 없음 · robot-down 은 지금까지 늘 skipped 라 실제로 터진 적은 없다).

수리 명세: news-10 과 한 수리(push-health.yml 맨 앞 sparse checkout).

관문: news-10 과 같은 S2.

소급: 없음.

파일: .github/workflows/push-health.yml

위험: 없음.

---
## [links/links-1] P2 · confirmed

이유: 맞음. 라벨 목록(REST)에 link-hunter 가 없다. run 37141078602 로그 17:41:54 'could not add label: 'link-hunter' not found' → 예비 명령이 라벨·담당자 없는 #387 을 만들었다. 지금 열린 🔧 25건(#81~#387, 10-03 하루에 #379·#382·#387). 같은 결함이 audit-coverage.yml 에도 있다: `--label "coverage-audit"`(라벨 없음) → 결과 이슈는 라벨 없이 새로 쌓이고(열린 🔍 10건), 🚨 실패 이슈는 `--label coverage-audit || true` 라 **아예 안 만들어진다**(조용한 실패). 다른 세션(1a33db59)은 link-hunter.mjs 의 '알릴 건' 세기(#387 거짓 알림)를 고쳤을 뿐 워크플로의 라벨·모으기는 안 고쳤다.

수리 명세: link-hunter.yml '🔧 사람 확인 필요 건 알림' 단계(if 그대로): 리포트 앞에 "🔧 <KST 시각> — 새로 사람 확인이 필요한 공고 N건 · 실행 링크" 한 줄을 붙여 /tmp/hunt.md(60000바이트 자름)로 쓰고 `uses: ./.github/actions/alert-issue` (mode open · match exact · title '🔧 원문 주소를 3회 못 찾은 공고 (링크 사냥꾼 — 로봇은 계속 찾습니다)' · label link-hunter · assignee 저장소 주인 · body-file /tmp/hunt.md) — 열린 것이 있으면 댓글, 없으면 하나 만든다. 제목에 건수를 넣지 않는다(한 이슈에 모으려면 제목이 같아야 한다). continue-on-error: true · timeout-minutes 2. ③(다 풀리면 닫기)은 이번엔 하지 않는다 — '아직 표식으로 남은 escalated 건수'를 내려면 collector/link-hunter.mjs 를 고쳐야 하는데 다른 세션이 막 고친 파일이다. audit-coverage.yml 두 단계: 결과 이슈는 alert-issue(mode open · match prefix · title '🔍 공고 누락 감사' · label coverage-audit · 본문 첫 줄에 날짜·원인 미상 N건) — 담당자 둘은 지금처럼; 🚨 실패 단계는 robot-down(robot: 공고 누락 감사)로. 바꾸면 안 되는 것: link-hunter push 트리거의 branches 거르개(관문 robot ⓩ) · git add 목록(test-collector 4299) · close-old-reports 가 🔧 를 건드리지 않는 원칙.

관문: alerts.mjs ⑥ 전역 S1: 워크플로·액션에서 `gh issue create … --label X` 를 쓰는 곳은 같은 파일에 `gh label create X` 가 있다(또는 alert-issue/REST 를 쓴다) — 지금 HEAD 에서 link-hunter.yml·audit-coverage.yml 로 빨강 확인. ⑫ 정적: link-hunter.yml 🔧 단계가 alert-issue 를 label link-hunter·고정 제목으로 부르고 제목에 steps.hunt.outputs.stuck 이 없다. 빨간불: 🔧 단계를 옛 `gh issue create … || gh issue create` 로 되돌리면 빨강.

소급: 새로 생기는 🔧 는 라벨 붙은 이슈 하나로 모인다. 이미 열린 옛 🔧 25건(라벨 없음)은 이 수리로 건드리지 않는다 — 닫을지는 개발자 결정(아래 질문). 🔍 옛 10건은 ops-06 의 보존 규칙(최신 1건)이 정리한다.

파일: .github/workflows/link-hunter.yml .github/workflows/audit-coverage.yml

위험: link-hunter.yml 자체는 다른 세션 변경 목록에 없다(그쪽은 link-hunter.mjs 만). audit-coverage.yml 은 다른 묶음(수집 감사)이 손댈 수 있으니 오케스트레이터가 겹침을 확인할 것.

---
## [links/links-3] P2 · confirmed

이유: 맞음. link-hunter.yml:191-198 '🚨 실패 알림'은 `echo "::warning::…"` 한 줄뿐이다(사람에게 안 닿는다). 103행 주석 '🚨 실패 알림이 그대로 뜬다'와 다르다. robot-down 을 쓰는 9개 워크플로에 link-hunter 는 없다. 하트비트 문턱은 예약 간격(하루)×3 = 72시간이라 최대 3일 늦게 안다 — 08-29~09-02 의 40분 시간초과 5연속(같은 파일 주석)이 바로 그 유형이다.

수리 명세: link-hunter.yml '🚨 실패 알림' 단계를 `uses: ./.github/actions/robot-down`(with robot: 링크 사냥꾼, token: github.token)으로 바꾼다. if: failure() || cancelled() 그대로(체크아웃이 맨 앞에 있다). 103행 주석은 그대로 참이 된다. 대기줄이 cancel-in-progress: false 라 대기줄 취소 헛경보는 없다. 성공하면 하트비트가 닫는다(links-5 공용 부품 B).

관문: alerts.mjs ⑥ 전역 S3: `if:` 에 failure() 또는 cancelled() 가 있는 모든 단계는 robot-down·alert-issue·gh issue create/comment·issues.create 중 하나로 사람에게 닿는다(::warning·::error·GITHUB_STEP_SUMMARY 만 쓰면 실패) — 지금 HEAD 에서 link-hunter·essay-playbook·insta-stats·insta-comments·insta-samples·insta-token-check·insta.yml(skip job) 7곳이 빨강. 빨간불: link-hunter 단계를 echo 로 되돌리면 빨강.

소급: 없음.

파일: .github/workflows/link-hunter.yml

위험: 없음 — link-hunter.yml 은 다른 세션 파일이 아니다.

---
## [news/news-14] P3 · confirmed

이유: 맞음(아직 안 터짐). collect-news.yml:113-122 는 감사가 떨어질 때마다 `gh issue create --title "🚨 교내 소식 데이터 감사 실패 <날짜> …"` — 같은 이슈가 열려 있는지 보지 않는다. 하루 2회 예약 + 수동 실행이면 하루에 여러 개.

수리 명세: 그 단계를 alert-issue(mode open · match exact · title '🚨 교내 소식 데이터 감사 실패 — 이번 발행분을 되돌렸습니다' · label news-audit · assignee 주인 · 본문 첫 줄에 KST 시각·실행 링크)로. if: steps.audit.outcome == 'failure' 그대로. 짝 단계 '감사가 다시 통과하면 옛 경보를 닫는다' — if: steps.audit.outcome == 'success' · alert-issue mode resolve 같은 제목. 바꾸면 안 되는 것: 제목 안의 '교내 소식 데이터 감사 실패' 글자와 `if: steps.audit.outcome == 'failure'` 두 번 이상(test-collector 「교내 소식」 ⑤ '감사 실패를 조용히 넘기지 않는다' 정규식) · 작업 상한 > 단계 상한 합 + 3(새 단계마다 timeout-minutes 1 을 달고 job timeout-minutes 를 같이 올린다 — news-2·6 과 합쳐 계산).

관문: alerts.mjs ⑧ 정적: collect-news.yml 감사 실패 단계가 alert-issue 를 쓰고(날짜 붙은 제목으로 매번 gh issue create 하지 않음) resolve 짝이 있다. 빨간불: 옛 gh issue create 로 되돌리면 빨강. test-collector 「교내 소식」 ⑤ 가 그대로 초록인지도 같이 본다.

소급: 없음.

파일: .github/workflows/collect-news.yml

위험: collect-news.yml 은 news-2·news-6 과 같은 파일 — 한 수리에서 함께 고칠 것.

---
## [news/news-6] P3 · confirmed

이유: 맞음, 다만 P2→P3. collect-news.yml:80-92 '수집 단계 실패'와 169-181 '실패·시간초과'는 둘 다 '열린 최신 소식 리포트'에 댓글만 단다 — 받을 이슈가 없으면 조용하다. 지금은 소식 리포트가 20개 열려 있어(최신 #391) 알림이 어딘가에는 달리므로 오늘 터진 문제는 아니고, news-2·3 을 고쳐 리포트가 줄어드는 순간 드러난다. 썸네일 단계(70-78행)는 id 가 없고 결과를 보는 알림이 없다(최근 리포트는 정상: 10-04 사진 228건).

수리 명세: ① 169-181 단계를 `uses: ./.github/actions/robot-down`(robot: 교내 소식 수집 로봇 · if: failure() || cancelled()). ② 80-92 단계(if: steps.run.outcome != 'success' 그대로 — test-collector 정규식)를 alert-issue(mode open · exact · title '🚨 교내 소식 로봇 — 수집 단계가 끝까지 못 갔어요' · label news-step)로, 짝으로 if: steps.run.outcome == 'success' 인 resolve 단계. 🔴 단계 실패는 작업이 초록이라 하트비트가 닫으면 안 되므로 robot-down 이 아니라 따로 라벨·제목을 쓴다. ③ 썸네일 단계에 id: thumbs, 같은 꼴로 '🚨 교내 소식 로봇 — 사진(썸네일) 단계 실패' open(if: steps.thumbs.outcome == 'failure')/resolve(if: steps.thumbs.outcome == 'success'). 새 단계마다 timeout-minutes 1, job timeout-minutes 는 '단계 상한 합 + 여유 3 초과'가 유지되게 올린다(지금 31+3 < 35 — 새 단계 수만큼 더한다). 머리 주석의 상한 셈 줄도 고친다.

관문: alerts.mjs ⑧ 정적: collect-news.yml 의 failure()||cancelled() 단계가 robot-down · `steps.run.outcome != 'success'` 단계가 alert-issue · `id: thumbs` 와 그 결과를 보는 단계가 있다. ⑥ S3 도 같이 잰다. 빨간불: 옛 '최근 리포트 이슈에 코멘트' 단계로 되돌리면 빨강.

소급: 없음.

파일: .github/workflows/collect-news.yml

위험: test-collector 「교내 소식」 ⑤ 의 상한 대소관계를 깨지 않게 job 상한을 함께 올릴 것(안 하면 모든 로봇의 데이터 관문이 빨개져 결과가 되돌려진다).

---
## [news/news-2] P2 · confirmed

이유: 맞음. collect-news.yml:156 `if: github.event_name == 'workflow_dispatch' || steps.run.outputs.needs_human == '1'` · 163행은 늘 새 gh issue create. 실행 목록과 1:1: 수동 run12~19 → #370~#377(그중 #372~#377 '새 글 0건'), 오늘도 수동 run23(04:04Z) → #391. 예약 run20~22 는 안 만들었다. 지금 열린 소식 리포트 20개, 전부 담당자 지정(메일). CLAUDE.md '새 공고 0건이면 이슈 대신 코멘트'가 이 로봇엔 없다.

수리 명세: ① on.workflow_dispatch 에 inputs.report(boolean · 기본 false · '리포트 이슈를 남긴다(확인용)')를 더하고 리포트 단계 if 를 `steps.run.outputs.needs_human == '1' || inputs.report` 로 — 수동 실행만으로는 열지 않는다(세션 확인은 실행 로그·collector/news-report.md 로). ② 리포트 단계는 alert-issue(mode open · match exact · title '🗞 교내 소식 수집 리포트 <KST 날짜>' · label news-report · assignee 주인 · body-file 은 지금의 /tmp/news-issue.md 앞에 '새 글 N건 · 사람 손 필요: …' 한 줄) — 같은 날 열린 리포트가 있으면 댓글. 제목에서 '(새 글 N건)'을 뺀다(같은 날 하나로 모으려면 제목이 같아야 한다 · close-old-reports 의 '^🗞 교내 소식 수집 리포트' 와는 그대로 맞는다). 바꾸면 안 되는 것: '사람 손이 필요할 때만' 원칙(needs_human=1 이면 반드시 알림) · 60000바이트 자르기.

관문: alerts.mjs ⑧ 정적: collect-news.yml 리포트 단계의 if 가 `github.event_name == 'workflow_dispatch'` 하나만으로 참이 되지 않는다(정규식으로 그 꼴 금지 + needs_human 또는 inputs.report 필요) · 그 단계가 alert-issue 를 부른다 · 제목에 new_count 가 없다. 빨간불: 156행을 되돌리면 빨강.

소급: 열린 20건은 ops-06 의 보존 규칙(소식 최신 3건 · 14일)이 차례로 닫는다(10-15 부터). 지금 바로 줄이려면 수리 배포 뒤 Actions 「오래된 수집 리포트 닫기」를 dry_run=true·days=1 로 목록 확인 → 실행(사람이 누름).

파일: .github/workflows/collect-news.yml

위험: news-6·14 와 같은 파일.

---
## [ops/ops-06] P2 · confirmed

이유: 맞음. close-old-reports.yml:61 은 '^(🤖 장학공고 수집 리포트|🖥 브라우저형 수집 리포트)' 두 종류만 본다. 지금 열린 이슈 186건(REST 집계): 📸 34·✅ 30·🔧 25·🤖 23·🗞 20·🚨 15·🖥 15·📘 12·🔍 10·🛰 1·🎨 1. 대상 밖 리포트(🗞·📘·✅ 자격·🔍 누락 감사·🔍 정찰)는 영영 안 닫힌다. 마지막 실행 09-28(run 36435735406) 뒤 다음 예약은 10-05(월) 06:40Z. `--limit 300` 도 곧 찬다.

수리 명세: ① 새 파일 tools/report-retention.mjs: 순수 함수 `pickToClose(issues, {now, days})` + 규칙 표 `REPORT_RULES` — general '^🤖 장학공고 수집 리포트' keep 3 · browser '^🖥 브라우저형 수집 리포트' keep 3 · news '^🗞 교내 소식 수집 리포트' keep 3 · essay '^📘 작성 규칙 학습' keep 1 · elig '^✅ 자격' keep 1 · coverage '^🔍 공고 누락 감사' keep 1 · probe '^🔍 게시판 후보 정찰 리포트' keep 1. 유형별 최신 keep 건은 남기고, 나머지 중 createdAt < now−days 인 것만 고른다. 🔴 🚨·🔧·📸·🛰·🎨 로 시작하는 것은 규칙에 아예 없다(경보·사냥꾼·인스타는 각자 수리가 맡는다 — 원칙 '절대 건드리지 않는 것' 유지). CLI: `node tools/report-retention.mjs /tmp/open.json` → '번호\t제목' 줄. ② close-old-reports.yml: 맨 앞 checkout(news-10) · 목록을 `--limit 1000` · jq 선택을 그 CLI 로 교체 · 사람 코멘트가 있으면 남기는 확인·dry_run·닫는 문구는 그대로. 머리 주석의 '절대 건드리지 않는 것'에 규칙 표가 tools/report-retention.mjs 에 있다고 적는다.

관문: alerts.mjs ② pickToClose 표본: 14일 지난 🗞 리포트 5건 → 최신 3건 빼고 2건만 · 14일 안 된 것 0 · 📘 셋 → 최신 1 남김 · 같은 날짜의 🚨 작성 규칙 학습·🚨 자격 요건 채우기·🔧 원문 주소·📸 인스타 카드·🛰 공공 API 는 아무리 오래돼도 안 고름 · days 를 바꾸면 기준이 따라감. ⑥ S2(체크아웃). 정적: close-old-reports.yml 이 report-retention.mjs 를 부르고 jq 의 두 종류 정규식이 남아 있지 않다. 빨간불: news 규칙을 표에서 빼면 첫 표본 빨강, 🚨 를 고르는 규칙을 넣으면 '안 고름' 표본 빨강.

소급: 코드가 스스로 고친다 — 10-05 예약 실행부터 14일 지난 ✅ 자격(08-23~09-17)·🔍 누락 감사·📘 작성 규칙·🗞(10-15 부터)이 유형별 최신 건만 남기고 닫힌다(사람 코멘트 있는 것은 남음). 더 빨리 하려면 사람이 dry_run 으로 목록을 본 뒤 실행.

파일: tools/report-retention.mjs .github/workflows/close-old-reports.yml

위험: 없음(다른 세션 파일 아님).

---
## [news/news-3] P2 · confirmed

이유: 맞음 — ops-06 의 일부. close-old-reports.yml:61·62 정규식·group_by 에 '🗞 교내 소식 수집 리포트'가 없다(소식 로봇은 09-30 신설, 마지막 정리 실행 09-28).

수리 명세: ops-06 과 한 수리(REPORT_RULES 의 news 규칙 keep 3).

관문: ops-06 의 ② 첫 표본.

소급: ops-06 과 같음.

파일: tools/report-retention.mjs .github/workflows/close-old-reports.yml

위험: 없음.

---
## [ops/ops-04] P2 · confirmed

이유: 맞음. run 36851872513(10-01 10:52Z) 로그: 'last-modified: Thu, 01 Oct 2026 10:49:21 GMT' · 실시간 공고(옛) 288/287 · 정식 등록 144/136 · 공고(학교별) ntyl0r5.json 1/9 ❌ → #350. 다음 예약 run 36995503117·37114286104 는 통과했는데 #350 은 열린 채. #384 는 device-deploy 1분 뒤 수동 실행에서 났다가 5분 뒤 재실행 통과. check-live.yml(현재 기본 브랜치판 204-219)은 라벨·중복 확인·닫기 없이 gh issue create 만 한다.

수리 명세: ① '배포된 앱과 저장소(main) 대조' 단계를 최대 2회 시도로 감싼다: 매 회 `git fetch -q origin main && git checkout -q --detach FETCH_HEAD` → EXTRA 를 다시 계산 → 받기 → 대조(대조 스크립트에는 GITHUB_OUTPUT=/tmp/try.out 를 줘서 회차마다 따로 받고, 끝에 마지막 회차 값만 진짜 GITHUB_OUTPUT 에 적는다). 1회차가 어긋나면 'Pages 배포가 진행 중일 수 있어 3분 뒤 다시 봅니다'를 찍고 sleep 180. 2회 모두 어긋날 때만 bad>0. job timeout-minutes 10 은 그대로 충분(실측 한 회 25초). ② '🚨 어긋남 알림'을 alert-issue(mode open · match prefix · title '🚨 앱 반영 점검 실패' · label live-check · assignee 주인 · 본문은 지금 문구 + 어긋난 줄)로. ③ 짝 단계 if: steps.check.outputs.bad == '0' → alert-issue mode resolve 같은 제목 prefix(옛 시각 붙은 #350 도 잡힌다). 바꾸면 안 되는 것(관문이 글자로 잡고 있다): `const measure = f.endsWith('.webp') ? bytes : count;`(test-collector 「교내 소식 사진」) · `const count = (p) => {…};` 함수 통째(test-collector 학교 사진 절이 떼어 돌린다) · `out.push('data/link-check.json')`·`out.push('data/link-fixes.json')`·`const m = f === 'data/link-check.json' ? linkCheck : f === 'data/link-fixes.json' ? linkFixes : measure;`·`m(f), m('live/' + f)`(verify/link-gates/robot.mjs:402-405 — 다른 세션 관문) · 관리자 노출 알림 단계(🔴 매번 새 이슈 — 그대로 시끄럽게 둔다).

관문: alerts.mjs ④ 정적: check-live.yml 에 2회 시도 고리(sleep 180 · origin main 다시 받기)와 alert-issue open(label live-check)·resolve(bad == '0') 짝이 있고 '🚨 어긋남 알림'에 맨몸 gh issue create 가 없다 + ① planAlert (e) 표본(시각 붙은 옛 제목 prefix 일치). 빨간불: 재시도 고리나 resolve 단계를 지우면 빨강.

소급: #350 은 수리 뒤 첫 초록 실행(매일 예약)이 prefix 일치로 스스로 닫는다.

파일: .github/workflows/check-live.yml

위험: 🔴 check-live.yml 은 다른 세션이 막 고쳐 기본·main 에 합친 파일이다(link-fixes.json · linkFixes) — 우리 브랜치를 먼저 기본 브랜치에 맞추고, 위 '바꾸면 안 되는 것' 줄을 글자 그대로 둘 것. ops-05 와 같은 파일 — 한 수리로.

---
## [ops/ops-05] P2 · confirmed

이유: 맞음. 앱이 실제로 받는 정적 파일(현재 기본 브랜치에서 fetch/getDoc 글자 그대로): assets/gates/gates.json(app.js:1168) · data/tuition.json(2565) · data/registered.json · data/kosaf-open.json(2649) · data/activities.json(2991) · data/external.json(3254) · assets/schools/photos.json(6170) · terms.html(6210) · data/search-index.json(chat.js:212) · data/essay-form-rules.json(essay.js:54) · data/essay-playbook.json(essay.js:76) · data/forms.json(forms.js:154) · data/link-check.json·link-fixes.json(getDoc). check-live 의 대조 목록에는 activities·external·kosaf-open·tuition·search-index·essay 둘·gates.json·terms.html 9개가 없다(404 여도 초록). 색인 파일은 칸 수(4 대 4)만 센다.

수리 명세: ① 새 파일 tools/app-fetch-files.cjs(CommonJS — check-live 의 node -e 에서 require): `appFetchFiles(rootDir)` = index.html 의 `<script src>` 목록을 읽어 각 파일에서 `(fetch|getDoc)\(\s*['"]([^'"]+)['"]` 의 상대 경로 글자만 모은다(http·변수·템플릿 문자열은 뺀다 · 중복 제거 · 정렬). 순수 함수 `fetchPathsIn(text)` 를 따로 내보낸다. ② check-live.yml: 새 env APP_FILES = appFetchFiles('.') 중 기본 목록(sw.js app.js notices registered forms)·EXTRA 에 없는 것. 받기 고리에 $APP_FILES 를 더하고, 대조 스크립트에 **새 함수 `hash`(바이트 수 + sha1 앞 8자 · 못 읽으면 '읽기실패')와 새 고리** `for (const f of appFiles) rows.push(['앱이 받는 파일 ' + f, hash(f), hash('live/' + f)])` 를 더한다 — 위 ops-04 의 '바꾸면 안 되는 줄'은 건드리지 않는다. Pages 는 머리말 없는 파일을 바이트 그대로 내보내므로(_config.yml·.nojekyll 없음 · terms.html·index.html 머리말 없음 확인) sha1 이 같아야 정상. ③ 색인 두 개(data/notices/index.json·data/news/index.json)도 같은 hash 줄을 하나씩 더한다(기존 count 줄은 그대로 두고 추가). 바꾸면 안 되는 것: CLAUDE.md '파일 이름은 match-engine.js 규칙으로 뽑는다(박아 두지 말 것)' — 새 목록도 손으로 박지 않고 앱 스크립트에서 뽑는다.

관문: alerts.mjs ④ 표본: fetchPathsIn("fetch('data/a.json',{}) getDoc('data/b.json') fetch(u) fetch(`x${y}`) fetch('https://x/y.json')") → ['data/a.json','data/b.json'] · 정적: check-live.yml 이 app-fetch-files.cjs 를 require 하고 hash 대조 고리가 있다. 빨간불: getDoc 갈래를 정규식에서 빼면 표본 빨강, check-live 에서 require 를 지우면 정적 빨강. (앱 스크립트 실물 ↔ check-live 대조는 코드끼리라 로봇 데이터로 흔들리지 않지만, 위 방식은 목록을 실행 때 뽑으므로 그런 대조 자체가 필요 없다.)

소급: 없음(점검 범위 확대). 첫 실행에서 9개 파일이 실제로 같은지 처음으로 드러난다 — 어긋나면 그건 진짜 배포 문제다.

파일: tools/app-fetch-files.cjs .github/workflows/check-live.yml

위험: check-live.yml 은 다른 세션이 막 고친 파일 — 먼저 기본 브랜치에 맞출 것. 앱이 새 파일을 받게 되면 자동으로 따라오므로 손 목록이 갈라질 일이 없다.

---
## [app2/app2-F9] P3 · confirmed

이유: 맞음 — ops-05(activities·external 누락)와 ops-04(#350 이 이후 성공 실행에도 열림)를 합친 것. 현재 기본 브랜치 check-live.yml 84행 목록·EXTRA 에 activities/external 없음, 어긋남 단계는 gh issue create 뿐.

수리 명세: ops-05 + ops-04 와 한 수리.

관문: ops-05 ④ · ops-04 ④.

소급: ops-04 와 같음(#350 자동 닫힘).

파일: .github/workflows/check-live.yml tools/app-fetch-files.cjs

위험: ops-04 와 같음.

---
## [app1/app1-10] P3 · confirmed

이유: 맞음 — data/kosaf-open.json(app.js:2649)·data/search-index.json(chat.js:212)이 check-live 목록에 없다. ops-05 의 부분집합.

수리 명세: ops-05 와 한 수리(앱 스크립트에서 뽑으므로 두 파일이 자동으로 들어간다).

관문: ops-05 ④.

소급: 없음.

파일: .github/workflows/check-live.yml tools/app-fetch-files.cjs

위험: ops-05 와 같음.

---
## [api/api-04] P2 · confirmed

이유: 맞음 — check-live 에 'activities'·'external' 이 0건(현재 기본 브랜치판 확인). ops-05 의 부분집합.

수리 명세: ops-05 와 한 수리.

관문: ops-05 ④.

소급: 없음.

파일: .github/workflows/check-live.yml tools/app-fetch-files.cjs

위험: ops-05 와 같음.

---
## [ops/ops-08] P3 · confirmed

이유: 맞음, 다만 P2→P3. #389(03:57:53Z · main · run 37175484003)·#390(03:57:54Z · 기본 · run 37175482635) — verify-ui.yml 경보 단계는 '라벨로 열린 것 찾기 → 없으면 만들기'라 두 브랜치 실행(대기줄이 ref 마다 따로)이 같은 초에 둘 다 '없음'을 본다. #321·#322(09-30)도 같다. 영향은 메일 두 통·이슈 둘이고, 기본 브랜치 초록불의 닫기 고리가 라벨 전체를 닫으므로 둘 다 함께 닫힌다(지금도 빨간불이라 둘 다 열려 있음 — 10-04 09:43Z run 432/433 도 실패).

수리 명세: verify-ui.yml '🚨 화면 검사가 빨간불이다' 단계의 찾기·만들기 부분을 alert-issue(mode open · match prefix · title '🚨 앱 화면 검사가 빨간불입니다' · label ui-gate · 본문은 지금 그대로)로 — 만든 뒤 다시 보고 번호 큰 중복을 닫는 것이 도구 안에 있다(옛 시각 붙은 제목도 prefix 로 잡힌다). '여는 것은 아무 브랜치에서나'(놓치는 쪽이 더 나쁘다 — 2026-09-13 리뷰) 원칙과 '닫는 것은 기본 브랜치 success 에서만' 단계는 그대로 둔다. if: failure()(cancelled 를 일부러 안 봄) 그대로. verify-ui.yml paths 에 'tools/alert-issue.mjs'·'tools/report-retention.mjs'·'tools/app-fetch-files.cjs'·'.github/actions/**' 를 더해 그 파일만 고친 커밋에서도 관문이 돈다.

관문: alerts.mjs ① (c) 표본(같은 제목 둘 → 큰 번호 close) + ⑨ 정적: verify-ui 경보 단계가 alert-issue 를 label ui-gate 로 부르고 닫기 단계의 `github.ref_name == 'claude/nice-heisenberg-WESq5'` 조건이 남아 있다. 빨간불: 경보 단계를 옛 '목록 → 없으면 create'로 되돌리면 빨강.

소급: #389·#390 은 기존 닫기 고리가 다음 기본 브랜치 초록불에 함께 닫는다.

파일: .github/workflows/verify-ui.yml

위험: verify-ui.yml 은 다른 세션이 paths 한 줄을 더한 파일(이미 기본 브랜치에 합쳐짐) — 맞춘 뒤 고칠 것. test-collector 가 verify-ui.yml 을 여러 곳(1739·2332·6159·7029·8199)에서 글자로 보므로 그 줄들을 건드리지 말 것.

---
## [app1/app1-06] P3 · confirmed

이유: ops-08 과 같은 사건(#389·#390)·같은 원인.

수리 명세: ops-08 과 한 수리.

관문: ops-08 과 같음.

소급: ops-08 과 같음.

파일: .github/workflows/verify-ui.yml

위험: ops-08 과 같음.

---
## [app2/app2-F8] P3 · confirmed

이유: ops-08 과 같은 사건·같은 원인.

수리 명세: ops-08 과 한 수리.

관문: ops-08 과 같음.

소급: ops-08 과 같음.

파일: .github/workflows/verify-ui.yml

위험: ops-08 과 같음.

---
## [api/api-07] P3 · confirmed

이유: 맞음, P2→P3(오해를 부르는 열린 이슈). #356 마지막 댓글 10-02 23:06Z 'K-Startup·1365 ❌ fetch failed'. 지금 collector/open-api-report.md(10-03 22:13Z 커밋)는 출처 넷 모두 ✅. open-api.yml:80-99 는 ❌ 가 없으면 exit 0 — 회복 댓글·닫기가 없다.

수리 명세: open-api.yml '🚨 출처 실패 알림' 단계의 찾기·댓글·만들기를 alert-issue(mode open · match exact · title '🛰 공공 API 로봇 알림' · label open-api · 본문 지금 그대로)로. 새 단계 '모든 출처가 다시 받아지면 알림을 닫는다' — if: success() && inputs.probe != true, 리포트에 ❌ 가 없을 때만(`! grep -q '❌' collector/open-api-report.md`) alert-issue mode resolve 같은 제목, 닫는 댓글에 ✅ 줄들과 실행 링크. timeout-minutes 1. 바꾸면 안 되는 것: test-collector 「공공 API 로봇」 C2 정규식 `open-api-report\.md 2>\/dev\/null \|\| true\)` (본문 만들기 줄 그대로) · 정찰 실행은 알림·닫기 안 함 · 지난 글을 지우지 않는 규칙.

관문: alerts.mjs ⑩ 정적: open-api.yml 에 resolve 단계가 있고 조건에 success()·❌ 없음·probe 아님이 들어 있다 + ① resolve 표본. 빨간불: resolve 단계를 지우면 빨강.

소급: #356 은 수리 뒤 첫 초록 실행(매일 04:17·16:17 KST)이 제목 일치로 스스로 닫는다(라벨이 없어도 제목으로 찾는다).

파일: .github/workflows/open-api.yml

위험: open-api.yml 은 다른 세션 변경 목록에 없다(그쪽은 open-api.mjs·open-api-map.mjs). 같은 대기줄 collector — 단계 추가는 1분 안.

---
## [refresh/ESSAY-02] P3 · confirmed

이유: 맞음(아직 안 터짐 — 최근 실행 1분 안팎). essay-playbook.yml:120 리포트 조건 `always() && (dispatch || failure() || changed)` — 예약 실행이 시간초과로 취소되면 failure() 가 거짓이라 이슈가 없고, 139-141 '실패·취소 알림'은 `echo "::error::…"` 뿐.

수리 명세: ① 리포트 단계 if 에 `|| cancelled()` 를 더한다(job.status 가 cancelled 면 제목이 🚨 가 된다 — 지금 코드 그대로). ② '실패·취소 알림' 단계는 robot-down(robot: 작성 규칙 학습)으로 바꾼다(체크아웃 50행 있음).

관문: ⑥ S3(지금 HEAD 에서 이 파일로 빨강) + ⑩ 정적: 리포트 단계 if 에 cancelled() 가 있다. 빨간불: 둘 중 하나 되돌리면 빨강.

소급: 없음.

파일: .github/workflows/essay-playbook.yml

위험: ESSAY-01 과 같은 파일.

---
## [refresh/ESSAY-01] P3 · confirmed

이유: 맞음, P2→P3(주 1회 로봇의 소음). 열린 essay-playbook 라벨 13건(📘 12 + 🚨 #194 08-24). essay-playbook.yml:119-133 은 `github.rest.issues.create` 만 하고 앞 리포트를 닫거나 성공 때 🚨 를 닫는 코드가 없다.

수리 명세: 리포트 github-script 안에서 새 이슈를 만든 뒤: 같은 라벨의 열린 이슈 중 제목이 '📘 작성 규칙 학습'으로 시작하고 사람(user.type != 'Bot') 댓글이 없는 옛 것을 '새 리포트 #N 으로 넘어갑니다' 댓글과 함께 닫는다. 이번 실행이 성공(RESULT == 'success')이면 '🚨 작성 규칙 학습'으로 시작하는 열린 것도 '#N 실행이 성공했습니다'로 닫는다. 실패 실행은 아무것도 닫지 않는다. ops-06 의 보존 규칙(📘 최신 1건)이 안전망.

관문: alerts.mjs ⑩ 정적: essay-playbook.yml 리포트 스크립트에 issues.update(state closed) 또는 같은 뜻의 닫기와 '🚨 작성 규칙 학습' 성공 조건 닫기가 있다. 빨간불: 닫기 줄을 지우면 빨강.

소급: 다음 실행(매주 화 05:37 KST 예약 또는 사람이 누름)이 옛 📘 11건과 🚨 #194 를 닫는다. ops-06 이 먼저 돌면 그쪽이 📘 를 닫는다.

파일: .github/workflows/essay-playbook.yml

위험: 없음.

---
## [insta/insta-6] P3 · confirmed

이유: 맞음, P2→P3(지금은 정상 — stats.json 10-04 00:08Z 갱신 · 토큰 죽음은 insta-token-check 가 따로 잡는다). insta-stats.yml:38 `node insta/stats.mjs | tee /tmp/out.txt; grep …` · insta-comments.yml:57 `node insta/comments.mjs fetch | tee /tmp/out.txt` — 셸이 bash -e(pipefail 없음). 작업 트리에서 IG_ACCESS_TOKEN=x IG_API_BASE=http://127.0.0.1:9 로 같은 줄을 bash -e 로 돌리니 '🚨 수확 실패 — fetch failed' 뒤 rc=0. 실패 단계는 insta-stats·comments·samples 모두 GITHUB_STEP_SUMMARY 한 줄뿐. 같은 결함: insta-token-check.yml:117 '확인 자체가 실패하면'·insta.yml skip 작업 429행도 요약 한 줄뿐. 세 보조 워크플로는 permissions 에 issues: write 가 없다.

수리 명세: ① insta-stats '수확' 단계와 insta-comments 작업 단계에 `shell: bash`(GitHub 의 bash = -eo pipefail)를 단다 — node 가 실패하면 단계가 실패한다. ② insta-stats·insta-comments·insta-samples·insta-token-check 의 '실패하면 시끄럽게/확인 자체가 실패하면' 단계와 insta.yml skip 작업의 같은 단계를 robot-down(robot: 인스타 트랙션 수확 / 인스타 댓글 / 인스타 판형 견본 / 인스타 토큰 확인 / 인스타 건너뛰기 기록)으로 바꾸고 요약 한 줄은 그대로 둔다. ③ insta-stats·insta-comments·insta-samples 의 permissions 에 `issues: write` 를 더한다. 성공하면 하트비트가 닫는다(insta-comments 는 3시간마다라 같은 이슈에 댓글만 쌓인다 — 새 이슈는 안 생긴다). 바꾸면 안 되는 것: 토큰이 없으면 state=none 으로 조용히 0 종료(계정 연결 전 정상) · 🔴 게시는 사람만 누른다.

관문: ⑥ S3(지금 HEAD 에서 insta 넷·insta.yml 로 빨강) + ⑦ 정적: insta-stats.yml·insta-comments.yml 에서 `| tee` 가 있는 단계는 `shell: bash` 또는 `set -o pipefail` 을 갖는다. 빨간불: shell: bash 를 빼면 빨강. (eligibility-fill.yml 에도 `| tee` 8곳이 같은 결함 — 이 묶음 밖이라 ⑦ 은 인스타 두 파일로 한정하고 notes 에 넘긴다.)

소급: 없음.

파일: .github/workflows/insta-stats.yml .github/workflows/insta-comments.yml .github/workflows/insta-samples.yml .github/workflows/insta-token-check.yml .github/workflows/insta.yml

위험: insta.yml 은 insta-3 과 같은 파일 — 함께 고칠 것.

---
## [insta/insta-3] P2 · confirmed

이유: 맞음. 열린 insta-ready 34건 본문의 insta-code 169개를 insta/seen.json(현재 기본 브랜치)과 대조: 살아 있는 카드(준비됨 · 마감 전 · 안 올림)가 0인 이슈 8건(#256·#262·#264·#265·#270·#271·#272·#273), #256·#262 는 올린 코드도 들어 있다. insta.yml 354-357·424-427 은 이슈 안 코드 수가 1 이하일 때만 닫고, 마감 지난 카드를 보는 단계는 없다. 220행 본문은 '올리거나 건너뛰면 저절로 닫힙니다'라고 약속한다. 쌓이는 근본 이유는 9-13 이후 아무도 게시를 안 누른 것(설계상 사람만 누른다)이라 게시 여부는 개발자 몫.

수리 명세: ① 새 파일 insta/ready-issues.mjs: 순수 함수 `codesIn(body)`(<!-- insta-code: X --> 목록) · `liveCodes(codes, seen, today)`(seen.prepared 에서 status 'prepared' 이고 seen.posted 에 없고 due 가 비었거나 due >= today 인 것) · `closableReadyIssues(issues, seen, today)` → [{number, reason}] (살아 있는 카드 0). CLI: `node insta/ready-issues.mjs closable /tmp/ready.json`(gh issue list --label insta-ready --json number,body 결과) → '번호\t이유' · `node insta/ready-issues.mjs live-in-body < body` → 살아 있는 개수. today 는 insta/graph.mjs 의 kstDay(). ② insta.yml publish·skip 의 '준비 이슈 정리': 장부를 고친 뒤(publish 는 publish.mjs 가, skip 은 ledger.mjs skip 이 seen.json 을 쓴 뒤) CNT 대신 살아 있는 개수를 세어 0 이면 '올렸습니다/건너뛰기 — 남은 카드가 없어 닫습니다', 아니면 '… (남은 카드 N건)' 댓글. ③ prepare 작업 끝에 '쓸모없어진 준비 이슈 닫기' 단계(if: always() · continue-on-error · timeout 2) — closable 목록을 '담긴 카드가 모두 올렸거나 건너뛰었거나 마감이 지났습니다 — 게시할 것이 없어 닫습니다' 댓글로 닫는다. 바꾸면 안 되는 것: 🔴 게시는 사람만 누른다(닫기만 하고 아무것도 올리지 않는다) · 이슈 표식 형식 · 관리자 화면(_admin/admin.js 「게시 대기」 숫자에서 마감 지난 카드를 빼는 것은 화면 변경이라 이번 범위에서 뺀다 — 원하면 따로).

관문: alerts.mjs ⑤ 표본: seen = {prepared:[A due 09-16 prepared, B due 12-31 prepared, C skipped, D due 09-18 prepared], posted:[E]} · today 10-04 → 이슈(A,D,E) closable · 이슈(A,B) 아님 · 이슈(C) closable · due 빈 카드는 살아 있음. 빨간불: 판정을 옛 '코드 1개 이하만' 규칙으로 바꾸면 (A,D,E) 표본 빨강.

소급: 코드가 스스로 고친다 — 수리 뒤 첫 prepare 예약(매일 09:13 KST)이 지금 죽은 8건을 닫고, 그 뒤로 마감이 지나는 이슈를 날마다 닫는다. 장부(seen.json)는 고치지 않는다.

파일: insta/ready-issues.mjs .github/workflows/insta.yml

위험: insta.yml 은 insta-6 과 같은 파일. _admin/admin.js 는 다른 세션이 고친 파일이라 이번엔 손대지 않는다.

---
## [servers/servers-F9] P3 · confirmed

이유: 맞음(수동 도구). push-check.yml:40-43 `curl -sS … /test` — -f 없음·응답 판정 없음, ① 단계는 `|| echo "(접속 실패)"`. server/push/worker.js:441 은 열쇠가 틀리면 {error:'unauthorized'} 401, :376 은 {tried, woke, dropped} — 둘 다 초록으로 끝난다. CLAUDE.md '살아 있는지는 push-check.yml 발송만이 증명'인데 그 증명이 초록이면 오해한다.

수리 명세: ② 단계: 응답을 변수에 받고(-w 로 HTTP 코드 따로) jq 로 읽는다 — HTTP 200 아님 또는 .error 있음 → ::error + exit 1 · tried > 0 이고 woke == 0 → ::error '한 대도 못 깨웠습니다' + exit 1 · tried == 0 → ::warning '등록된 폰이 없습니다'(초록) · 결과 한 줄을 $GITHUB_STEP_SUMMARY 에. ① 단계의 접속 실패도 ::warning 으로. 시크릿이 없으면 건너뛰는 지금 동작은 그대로.

관문: alerts.mjs ⑪ 정적: push-check.yml 이 /test 응답의 woke·error 를 보고 exit 1 하는 줄이 있다. 빨간불: 판정 줄을 지우면 빨강.

소급: 없음.

파일: .github/workflows/push-check.yml

위험: 없음 — 사람이 누르는 버튼이라 예약 영향 없음.

---
## [ops/ops-13] P3 · confirmed

이유: 맞음(지금은 정상 — 10-03 run 37116530106 locked). admin-lock-check.yml:100-105 unknown 은 로그만 남기고 작업은 success, 이슈·닫기 단계 둘 다 안 돈다 → 하트비트도 성공으로 센다. 며칠 이어져도 아무도 모른다.

수리 명세: 새 단계 '판정 불가면 실패로 남긴다' — if: steps.probe.outputs.verdict == 'unknown' · `echo "::warning::관리자 화면 잠금을 판정하지 못했습니다 — 잠겼다는 뜻이 아닙니다"; exit 1`. 그러면 그날 실행은 빨강이고(robot-down 조건 `failure() && steps.probe.outcome != 'success'` 이라 넘어짐 이슈는 안 생긴다), 사흘(예약 하루 × 3) 넘게 성공이 없으면 하트비트가 '🚨 예약 로봇이 조용합니다'로 알린다 — 새 장부가 필요 없다. 바꾸면 안 되는 것: '판정 불가일 때는 닫지 않는다' · open 일 때의 이슈·exit 1 · 관리자 주소가 박힌 파일 수(test-collector ⑤ PINNED — 같은 파일 안 추가는 수가 안 바뀐다).

관문: alerts.mjs ⑪ 정적: admin-lock-check.yml 에 verdict == 'unknown' 조건의 exit 1 단계가 있다. 빨간불: 그 단계를 지우면 빨강.

소급: 없음.

파일: .github/workflows/admin-lock-check.yml

위험: admin-F8 과 같은 파일.

---
## [admin/admin-F8] P3 · confirmed

이유: 맞음(② 는 ops-13 과 같음). ① 로봇은 운영 호스트 하나만 연다(49행 BASE · 58행 경로 3개)인데 _admin/README.md 는 운영·미리보기 주소가 서로 다른 호스트라 둘 다 덮어야 한다고 적는다. 운영 브랜치가 claude/nice-heisenberg-WESq5 라 main 은 미리보기(main.hanggonggan-admin.pages.dev)가 될 수 있다 — 그 주소가 실제로 있는지·잠겼는지는 샌드박스에서 pages.dev 가 막혀 못 쟀다(그래서 로봇이 재야 한다). 데이터는 공개 저장소 내용이라 피해는 작다.

수리 명세: ① 입력 url 이 비었을 때만 미리보기 주소 https://main.hanggonggan-admin.pages.dev 의 '/' 를 같은 방식으로 한 번 더 연다: 200 + 관리자 화면 표식 → open=1(같은 이슈 · 본문에 '미리보기 주소'라고 적음) · Access 로 3xx → '✅ 미리보기도 잠김' · 404/000/그 밖 → '미리보기 주소 없음 — 판정에서 제외'(verdict 를 unknown 으로 만들지 않는다 — 없는 미리보기가 매일 빨간불을 내면 안 된다). ② 는 ops-13 수리.

관문: ⑪ 정적: admin-lock-check.yml 에 미리보기 주소 확인과 '판정에서 제외' 가지가 있다. 빨간불: 미리보기 확인을 지우면 빨강.

소급: 없음.

파일: .github/workflows/admin-lock-check.yml

위험: ops-13 과 같은 파일. 미리보기가 실제로 열려 있으면 첫 실행에서 🚨 이슈가 바로 선다 — 그건 진짜 경보다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [links/links-4] already-fixed: 근본 원인은 이미 고쳐졌다. run 37141082198(main · push · 17:35:39Z)은 시작 42초 만에 사람이 취소했고(커밋 0f8d91f4 메시지 'main 쪽 둘은 취소함') robot-down 이 #386 을 열었다. 0f8d91f4 가 push 트리거에 branches: ['claude/nice-heisenberg-WESq5'] 를 걸었고(현재 resolve-detail-urls.yml:23-28 확인) 직후 dispatch run 37141332557 이 성공(17:40~17:58). 남은 것은 열린 #3
