
### gate
- B9 ④ needs your decision. A new browser report issue (🖥 브라우저형 수집 리포트) opens on every run, so 8 are open now. Options: ① close the previous report when a new one opens (risk: confirmation-waiting items you haven't seen yet get hidden), ② keep as now (recommended, since you confirm in chat and the issues are only a log), ③ comment on a single issue instead.
- Still-failing case (decided by the spec): when the gate stays red after reverting, the save step still commits this run's other files (seen.json, activities, notices…). The run then ends red with an issue. CLAUDE.md says '감사 실패면 결과가 하나도 안 남는다', which is not literally true in that case. Decide whether still-failing should skip saving entirely.
- Outside this bundle: .github/workflows/deep-fetch.yml still searches the bare '"수집 리포트" in:title', so its alerts can land on the wrong robot's report issue. It is a one-line fix in another bundle.
- refresh-tuition and refresh-majors (manual runs) now stop without saving if test-collector or audit-data is red. If a manual refresh ends red, read the 데이터 관문 step log before re-running.
- The admin edit sheet has no up-front warning for a deadline change without a matching period change. admin-apply now refuses the save with the reason ('화면 문구의 끝 날짜(…)와 마감(…)이 다릅니다 — 문구(period)도 같이 고치세요'). A preview warning in _admin (checkEntry is already vendored) would be a small UI follow-up.
- CLAUDE.md is at its 400-line limit; adding the proposed lines requires trimming others.
- B9 개발자 결정: 브라우저형 수집 리포트 이슈가 실행마다 새로 열려 쌓인다(#324·#327·#333·#340·#346·#366·#368·#381). ① 새 리포트를 열 때 지난 것을 닫기(컨펌 대기가 숨을 수 있음) ② 지금처럼 두기 ③ 한 이슈에 코멘트로 — 추천은 ②(컨펌은 채팅에서 한다).
- CLAUDE.md 가 400줄 한도라, claudeMd 의 줄을 넣으려면 계획 4 에서 다른 줄을 줄여야 한다. 특히 「로봇 · 워크플로」의 '감사 실패면 결과가 하나도 안 남는다'는 이제 사실과 다르다(단계별 되돌리기·still-failing).
- 감사(verify/audit-data.js)가 이제 collector/link-fix.mjs 를 require(esm)로 부른다 — Node 20.19 이상이 필요하다. 더 낮은 Node 를 쓰는 로컬 컴퓨터(개발자 Mac 등)에서는 감사가 '집계 사이트 규칙을 받지 못해 그 검사를 못 했습니다' 오류로 빨개진다. 그때는 Node 를 올리면 된다. CI 는 이미 같은 길(essay-house-mine.mjs)이 동작한다.
- main 배포 뒤 `node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교` 로 DAAD 가 '자격 미확인'인지 확인한다(로컬 worktree 에서는 이미 그렇다).
- 노션 백로그에 이 묶음(gate)의 상태와 상태 메모(날짜·커밋 174a4b92~e63a3103 포함)를 반영한다(계획 4).

### feed
- 한양대학교: 서비스 학교인데 실시간 공고가 0건이고, 메우기로도 풀리지 않는다(장부의 한양 글은 8월 것뿐이다). 9월 이후 한양 게시판에서 새 글이 왜 하나도 안 잡히는지 정찰이 필요하다 — run-probe.txt 에 checkUrl: 로 그 학교 게시판 주소를 적어 기본 브랜치에 push 하는 것은 개발자 승인 뒤에 한다. 원인은 원문을 열어 보지 않아 단정하지 않았다.
- 홍익대 0건(browser-report '장학 공고 0 · notice.do')도 정찰 대상이다. 분류(noCat) 목록 주소가 바뀌었는지는 추정일 뿐이다.
- 8월 30일 파킹 때 빠진 8월 수집분(장부 947건 · 마감 대부분 지남)은 일부러 메우지 않는다(FEED_HEAL_SINCE=2026-09-29). 되살리려면 개발자가 결정해야 한다.
- 복구 뒤 자동 등록 로봇이 되살린 글을 다시 후보로 본다. 한 실행 8건 상한이고 마감 전 글만이라 며칠에 나눠 들어간다. 개발자 보고에 적을 것.
- 통합 뒤 후속(오케스트레이터 몫): 기본 브랜치의 8cb1f746(resolveJsDownload)·8daf7d06(stripSiteChrome)이 들어오면 두 가지를 맞춰야 한다. ① healFromLedger 의 take 에서 되살린 글 첨부에도 javascript: 주소 풀기를 걸 것 — 장부(candidates.json)는 그 소급을 받지 않았다. ② heal-feed.mjs 에도 수집기와 같은 자리(dropUnserved 뒤 · publishBySchool 앞)에 stripSiteChrome 을 걸 것. 이 브랜치의 기준(6f2a7c40)에는 두 함수가 없어 여기서는 넣지 않았다.
- 통합 시험 병합에서 feed 와 무관한 충돌 2곳이 나왔다: collect-scholarships.yml 의 timeout-minutes(59 vs 63)와 auto-register.mjs import(auto-held vs stripSiteChrome) — fix/gate 몫이다. 단계 합을 다시 세서 상한을 정해야 한다.
- When integrating with the default branch (claude/nice-heisenberg-WESq5 has 8daf7d06 and 8cb1f746, which this whole sweep lacks), feed ⑤ will go red ('도구의 차례 = 두 수집기 공통 차례', expected list containing stripSiteChrome). Fix it by calling stripSiteChrome in collector/heal-feed.mjs at the same place as the collectors: after dropUnserved and before publishBySchool, on [beforeCap, registered.json items]. Do this before running the heal-feed backfill.
- javascript: attachments on rows the backfill restores (simulated 25: 서울과기 17 truncated 'javascript:downloadfile(' · 동국 WISE 8 on wise.dongguk.ac.kr): resolveJsDownload cannot recover them. They need a re-read of the originals from a machine or Actions runner that can reach school sites (as 8cb1f746 did). A WISE rule should only be added after confirming the download function on the original page (do not guess from the dongguk.edu rule).
- browser-collect.yml has no 0-count comment step, so on 0-new days the browser report's 🔁 line stays only in collector/browser-report.md. Adding such a step was left out of scope.
- Developer decisions carried from the spec: whether to also restore the 8월 parked rows (947, mostly past deadline; FEED_HEAL_SINCE stays 2026-09-29 and goes stale on its own after 11-28), and a probe for why 한양 has produced no new rows since 08-12 (the heal does not fix 한양 0건).
- CLAUDE.md is exactly at the 400-line cap. Any bundle's proposed lines must be appended to existing lines or offset by trimming.

### bodies
- bodies-8(유료 · 개발자 결정): 이 묶음이 기본 브랜치에 나가고 수집 로봇·자격요건 로봇이 하루쯤 돈 뒤, 관리자 화면 또는 Actions 의 「자격요건 매칭 · AI 자격 읽기」를 먼저 '미리보기만'으로 눌러 대상 수(장학 본문 · 공고문 첨부 · 대외활동 세 줄)를 보고, 그다음 '첨부만' 또는 '전부'를 정해 누른다. Anthropic API 잔액이 모자라면 실패 이슈가 생기고 데이터는 되돌아간다.
- 수리 뒤 첫 예약 자격요건 로봇(05:23·18:23 KST) 로그 확인: '▶ n/m' 줄 · 공고마다 저장 · '⏱' 처리 · 끝까지 돌면 열린 rescue-bodies 실패 이슈(#234·#337·#361·#378 등)가 '다음 실행이 끝까지 돌아 닫습니다' 코멘트와 함께 스스로 닫히는지. 이슈를 손으로 닫지 않는다.
- PaddleOCR: 샌드박스는 모델 서버에 못 닿아 엔진을 실제로 돌려 보지 못했다. 첫 수집 실행 로그에서 '✓ <파일> — N줄'이 나오는지 본다. 판 고정 뒤에도 같은 오류로 '::warning::PaddleOCR 엔진 오류'가 뜨면 그때 paddle-ocr.py 의 PaddleOCR(…)에 enable_mkldnn=False 를 더하는 것을 검토한다(기회는 되돌려지므로 그 사이 깎이지 않는다).
- CLAUDE.md·SESSIONS.md 반영(위 claudeMd·sessionsNote 제안) 과 노션 백로그 상태 갱신은 이 묶음을 기본 브랜치·main 에 올리는 쪽(계획 4)에서 한다.

### browser
- 묶음 밖 P1(명세 검증 메모 · 담당 묶음 미정): 자동 등록 id 공식 idFromUrl(끝 24글자)이 꼬리가 같은 게시판의 다른 글을 한 id 로 뭉친다 — 계명 주소 전부 'auto-srchenable1srchvotetype1'(이번 수리 뒤에도 그대로 · 공식을 일부러 안 바꿨다), 서강은 blockIds 의 'auto-amepagescholarshipnotice' 에 전부 막혀 자동 등록 0건. links 또는 gate 묶음에 배정 필요(제안: canon-url.mjs idFromUrlUnique + blockUrls 우선).
- api-09 backfill 세 명령(정부24·콘텐츠진흥원·온통청년 청년참여 보관)은 관리자 기록을 같이 쓰므로 오케스트레이터가 최신 기본 브랜치에서 실행·커밋해야 한다(admin-log.json 포함). 원하면 관리자 화면 「활동」 탭 보관 버튼으로 같은 일을 해도 된다.
- 배포 뒤 첫 브라우저 리포트로 확인: 대상 14곳 · 서울대 멈춤 없이 수집 단계가 짧아졌는지 · '⏭ 남은 후보' 줄 · 🚨 줄이 진짜 문제 학교에만 뜨는지(첫 3회는 장부가 비어 뜨지 않는다). 10-05 리포트의 동국·고려·가천 'Target page, context or browser has been closed' 오류가 서울대 멈춤과 관련 있는지는 확인하지 않았다 — 서울대를 뺀 뒤에도 나오면 따로 볼 것.
- 10-05 브라우저 리포트에서 시립(새 사이트 첫 실행)의 [수집] 목록에 같은 제목이 두 번씩 보였다 — 2페이지가 1페이지 글을 다른 표식 주소로 돌려준 것으로 보이나 확인하지 않았다(피드는 제목 열쇠로 합쳐져 화면 중복은 없을 것). 다음 리포트에서 반복되면 별도 점검.
- pageNo·pageUnit 휘발 처리는 명세대로 후속 과제로 남김(중앙·서울교대·경기·충북 장부 키 수백 개가 바뀜) — 계명은 1페이지→2페이지로 밀린 글이 한 번 더 들어올 수 있다(새 글 하나당 최대 1건).
- 기본 브랜치(1680232b)와 합칠 때 collect-scholarships.yml·auto-register.mjs·deepfetch.mjs 충돌은 이 묶음이 아니라 앞 체인(fix/bodies)부터 있던 것이다. browser-collect.mjs 는 기본 브랜치의 첨부 링크 수정(8daf7d06·8cb1f746)과 자동 병합됐다(merge-tree 확인).

### qnotice
- Urgent, before 10-12: the 고려대 송화재단 and 연세 신문고 mail buttons go away only after an extract-excerpts --write run on the default branch. Either the next collect-scholarships run does it, or run backfill #1.
- app1-04 ④: should the 공고 원문 sentence (applyEmailSource) appear under the '접수 메일 열기' button, the same way the portal note shows it? This adds an element to an approved screen, so it needs your OK. Not implemented.
- app1-03: turn on paid form conversion? collector/schematize-config.json apiEnabled:true (maxApiCallsPerRun stays 2). It costs money. The report now shows '열린 공고 87건 중 양식 1건'.
- app1-08: compare the 3 old-form candidates against each notice's attached application form. 세종이도인재장학금 ×2 ↔ sejong-ido-apply; 시립대 성과형 장학금(자격증) ↔ uos-bigdata-cert-apply. Link a pair only if it matches, via the admin edit formId.
- app1-09: please look at the before/after card screenshots: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/qn2/before-2.png and explore-2.png. The change applies your 2026-09-17 rule ('앱 내부 사정은 학생 화면에 안 적는다') to the card top line.
- app1-11: the KUPID (고려대) and ON 국민 (국민대) entries have no URL yet. Add one only after confirming the page title with a probe (run-probe.txt checkUrl:).
- Optional: make verify/verify-new-forms.js seed its own sample notices (like verify-forms-data.js does) so its UI section stops being silently skipped. It changes a CI browser driver, so not done here.
- app1-03: whether to turn the paid AI form conversion back on (collector/schematize-config.json apiEnabled) is the developer's decision. The form robot report now shows the count of open notices with a form attached (🚨 when 0–1).
- app1-08: linking old-form candidates in the report to notices is the developer's decision. To link one, use ACTION=edit with formId through tools/admin-apply.mjs. Nothing is linked automatically.
- R2: for 60 days, other schools' posts of the same program as the dropped past rounds (e.g. 부산·동국 푸른등대 K-원전) are held as '같은 사업의 지난 회차 — 새 회차인지 컨펌 대기'. The developer should confirm in chat any that are really a new round. On today's data this added 5 holds (74 → 79).
- app1-11: 국민대 「ON 국민」 goes into PORTAL_SYSTEMS and PORTAL_SYSTEM_INFO only once it has 2 or more pieces of evidence after the late-drop, using the same key text. KUPID's address should be added only after a recon run (run-probe.txt checkUrl:) confirms the page title, together with verifiedTitle and verifiedAt.
- For the gate bundle: test-collector 「등록 데이터에 근거 없는 포털 단정이 없다」 is still a fixed check that reads live data inside the data gate. Its word list is fixed now, but consider moving the check to an audit-data warning (the same pattern as this week's three incidents).

### qfeeds
- api-01 ③ needs a decision: 삼원·지헌 cohort posts '제 N기 (재)○○장학재단' (12, no dates) still show as new. Should only the highest cohort per foundation be kept (spec's latestCohortOnly, recommended), or should they stay (원칙 8-1: no guessing)? Nobody has checked against the source which cohort is open now.
- news-12 second part: should '학비보조·학업지원금' posts go to the scholarship feed? That widens the KEYWORDS net shared by collect.mjs and collect-news.mjs, so it is the developer's call.
- api-13: the robots.txt split (activity sources on school sites obey it; school scholarship and news boards do not) is a legal-risk choice. It is kept as is and documented; changing it is the developer's call.
- api-10: after the next find-boards run (about 10-14, 14-day cycle), look at the cause codes on the 28 '홈페이지 못 엶' foundations and decide what to do. Also decide whether script-menu sites should get a browser probe (outside this fix).
- eligibility-fill.yml still installs sharp without a version (line ~148). Pin it together with whichever bundle owns that workflow; when node-version is raised, raise collect-news.yml sharp@0.35 with it.
- api-03: on the next 공공데이터포털 outage, check that open-api-report.md shows the cause code and that the 10s/40s retries got through (nothing to change in code now).
- news-9: GitHub scheduled runs started 2h25m to 5h36m late. This is GitHub's scheduler and cannot be fixed in the repo; left as is.

### links
- After the next auto-register runs: check the reports. Several 계명·경기·서강·숭실 posts will be registered (8 per run). Some are probably 전국 사업 that get tied to one school (schoolOnly, 노션 F-5), so expect more items under 관리자 「할 일」 '교외인데 한 학교에만'. If an unwanted one appears, remove it via revert; that writes both the id and the URL to the block list.
- A report line '⚠️ 차단 id 하나가 여러 공고에 걸렸는데 막은 주소 기록이 없어 전부 막았어요' means an old id-only block still covers several posts. Add the URL of the post you actually meant to block to blockUrls (via revert or unblock) so the other posts get through.
- links-13 (결정: 기다린다): check the 10-05 18:47 KST link-check verdict for the 3 국민대 posts. If they are confirmed as a problem, run a probe (run-probe.txt checkUrl:) before deciding anything.
- Issue #387 is still open. With this commit the issue body names the escalated posts and the 'still not found' count is corrected. Whether to close the issue is your call.
- collector/run-resolve-urls.txt still documents recheckOnly, which now does nothing. Remove that line the next time you edit the file for another reason (editing and pushing it starts the robot).
- 배포 뒤 첫 자동 등록 리포트에서 '이미 등록(같은 id)' 이 0 근처로 내려갔는지 본다. '사람이 막아 둔 공고' 건수와 '⚠️ 차단 id 하나가 여러 공고에 걸림' 줄도 함께 본다. 그 뒤 며칠 동안 9개교 공고가 실행당 8건씩 몰려 들어와, 관리자 「할 일」의 '교외인데 한 학교에만' 묶음이 커질 수 있다(노션 F-5).
- 배포 뒤 첫 링크 사냥꾼 리포트의 '장부 정리 n건' 이 950 근처인지 본다(links-9).
- links-10(복구 로봇 소급 재검사 끄기)은 명세의 추천안 (가)대로 구현돼 있다. 개발자가 그 결정을 직접 확인했는지는 이 작업에서 보지 못했다 — 확인이 필요하다.
- links-13: 10-05 18:47 KST 원문 링크 확인 실행에서 국민대 3건(12349·12385·12387)이 어떻게 판정됐는지 본다. 확정되면 정찰(run-probe.txt checkUrl:)로 진짜 화면을 본 뒤 판단한다.
- 이슈 #387 은 열린 채로 뒀다 — 수리 커밋을 알린 뒤 닫을지 사람이 정한다.
- 이번 수리 전부터 있던 일(손대지 않음): 사냥꾼 1단계에서 '클릭 실패: …' 로 적힌 못 닿음 줄도 관리자 「죽은 링크」 거름('실패')에 걸린다. 원하면 같은 꼴(boardUnreachableWhy 처럼 원인을 단정하지 않는 문구)로 바꿀 수 있다.

### ci
- Decide whether verify problems should block a deploy from a single work branch (device-deploy). Right now only audit-data blocks it; the new step wakes the screen check after the deploy and blocks nothing. If you want blocking, add `node verify/test-collector.mjs` without DOC_GATES next to the audit, and on failure reset and set state=auditfail (spec ops-03 ①).
- After these commits are pushed, check that the next verify-ui run is green and that open ui-gate issues #389 and #390 close by themselves (the close step runs only on the default branch). Only GitHub can show this.
- Optional (P3): duplicate ui-gate issues open when the default-branch run and the main run fail at the same moment (#389 and #390 were created in the same second). Opening alerts from any branch was a deliberate choice, so changing it is your call.
- When merging with fix/gate, resolve verify/health-gates.mjs to `export const PARTS = ['gate', 'ci'];`. This branch has ['ci'] only. Dropping either side silently drops that bundle's gates.
- After push, check on the default branch that the next verify-ui run is green and that ui-gate issues #389 and #390 close by themselves (the close step runs only on the default branch). Also note how long the '화면 검사 (관문)' step took. It must stay well under the new 20-minute budget (13m34s in run 37227739276).
- If the alarm starts reporting '시간 예산을 다 써서 돌리지 못한 드라이버', first find the slow driver: compare the times on the `──` log lines. Do not raise the budget first. The job cap is 30, and the gate requires 30 > budget + drive.js cap + 3.
- Developer decision needed (spec ops-03): should device-deploy block the deploy when the tests fail? Right now it only wakes verify-ui afterwards.
- Optional (P3): duplicate ui-gate issues can open when the default-branch run and the main run fail at the same moment (#389 and #390 were created in the same second). Opening alerts from any branch is deliberate, so changing it is your call.
- Behaviour change: a red run now goes to the end like a green one (about 15 minutes), but it is bounded: drivers ≤ 20 min, drive.js ≤ 5 min.

### alerts
- Decide whether to close the ~25 old unlabeled 🔧 링크 사냥꾼 issues (#81~#387). Recommendation from the spec: close them in one go with a note pointing to the new single fixed-title issue (label link-hunter). This fix does not touch them; no one closed any issue in this session.
- Deploy order: check-live and admin-lock-check check out ref: main, so tools/alert-issue.mjs, tools/app-fetch-files.cjs and .github/actions/alert-issue must reach main together with the default branch (the usual push to all three places). If main lags, check-live's step fails loudly (robot-down) instead of passing.
- After deploy, the first runs close stale issues on their own (#350 check-live, #356 open-api, #386 heartbeat, #274 device-deploy, 📘/🚨#194 next essay run, old 🗞/✅/🔍 by the Monday retention run, dead 📸 by the next insta prepare). To preview the retention list first, a person can press 「오래된 수집 리포트 닫기」 with dry_run=true.
- admin-lock-check now also opens https://main.hanggonggan-admin.pages.dev/ — if that preview host is open without login, the first run raises 🚨 immediately; that is a real alarm (cover that host with Cloudflare Access).
- push-check (manual button) now goes red on a wrong key (401) or when 0 phones woke — that is intended.
- Observed during the integration simulation (not this bundle): merging integ/health-sweep with the current default tip conflicts in .github/workflows/collect-scholarships.yml, collector/auto-register.mjs and sw.js — the orchestrator has to resolve those.
- 라벨 없이 쌓인 옛 🔧 링크 사냥꾼 이슈 25건(#81~#387)을 닫을지 결정해야 한다. 명세 추천은 일괄 닫기와 함께, 앞으로는 라벨 link-hunter 가 붙은 고정 제목 이슈 하나에 모인다고 안내하는 것이다. 이 수리는 옛 25건을 건드리지 않는다.
- 배포 순서: check-live·admin-lock-check 는 `ref: main` 으로 체크아웃한다. 그래서 tools/alert-issue.mjs·tools/app-fetch-files.cjs·.github/actions/alert-issue 가 main 에도 같이 올라가야 한다(기본 브랜치와 main 에 동시 push).
- 배포 뒤 저절로 닫히는 것(손댈 필요 없음): #386 등 robot-down 은 하트비트가 닫는다. 이제 예약 실행이 경보 뒤에 성공해야 닫으므로, 수동으로 다시 돌려 성공해도 다음 예약 실행까지는 열려 있다. #350·#384 는 다음 초록 check-live, #356 은 다음 초록 open-api, #274 는 다음 device-deploy 성공, 죽은 📸 8건은 다음 인스타 준비, 옛 📘·🚨 는 다음 작성 규칙 학습 때 닫힌다. 지난 리포트는 리포트 정리가 닫는다.
- verify-ui(화면 검사)가 이제 워크플로 파일만 고친 커밋에도 돈다(25분 안팎). 워크플로 위생 관문이 빨개지면 수집 로봇은 경고만 하고 결과를 지키며, 🚨 화면 검사 경보 하나가 사람에게 간다.
- 묶음 밖(그대로 둠): verify/health-gates/ci.mjs 와 test-collector 의 다른 절에도 워크플로 글자를 엄격하게 재는 검사가 많다. 그쪽도 로봇 데이터 관문에서 빨개지면 결과를 되돌린다. 같은 softEq 잣대를 적용할지는 그 묶음·오케스트레이터가 정할 일이다. 또 eligibility-fill.yml 의 `| tee` 8곳(pipefail 없음)과 rescue-bodies.yml 의 날짜 붙은 🚨 새 이슈 문제도 남아 있다.

### servers
- 🔴 기본 브랜치에 server/push/* 가 올라가면 Cloudflare Workers Builds 가 곧바로 배포한다(가동 중 서버) — push 뒤 Cloudflare → Workers → handaejang-push 의 배포 성공을 확인하고, 다음 날 06:17 push-health 로그에서 lastSlot·lastRun 이 보이는지 본다. 배포가 06:17 보다 늦으면 첫날 'outdated' 경보가 한 번 뜰 수 있다(다음 정상 판정에 닫힘).
- 계산 시간: 계획 단계가 샌드박스 실측 중앙값 약 1ms 늘었다(2.1–2.9 → 3.1–4.3ms · 처음 한 번은 최대 약 8–11ms · 무료 한도 10ms). 한도를 넘으면 같은 걸음 5회 실패 → /health lastError → push-health 경보로 드러난다 — 배포 뒤 며칠은 경보 이슈를 눈여겨본다.
- Supabase 요금 등급(무료 등급이면 7일 무활동 일시정지 정책이 있다고 SESSIONS.md 에 경고만 있음)을 대시보드에서 확인 — 새 매일 확인은 감시(알림)이지 휴면을 막는다고 확인된 것이 아니다.
- CLAUDE.md 아키텍처 표의 `server/mail-worker.js` '메일(배포 대기)' 문구가 낡았다(지금은 server/apply/ · 꺼짐) — 고칠지 개발자 확인(claudeMd 제안 넷째 줄).
- 노션 백로그 반영(이 묶음 아홉 건의 상태·메모·커밋) — 계획 4 단계.
- server/push/* 를 기본 브랜치에 push 하면 Cloudflare Workers Builds 가 곧바로 배포한다. push 뒤 Cloudflare → Workers → handaejang-push 배포 기록이 성공인지 본다. 배포가 다음 06:17 확인보다 늦으면 그날 push-health 가 outdated 이슈를 하나 낼 수 있다(다음 날 저절로 닫힌다).
- 배포 뒤 Cloudflare 대시보드 → handaejang-push 의 CPU 시간(p99)을 본다. 이번 측정은 Node 기준뿐이다(plan 4.96ms · notices 5.21ms · reg 7.35–8.14ms). reg 걸음은 이번에 고치지 않았는데 가장 무겁다. p99 가 10ms 에 가까우면 server/push/README.md 의 '작은 요약 파일을 미리 만들어 두는' 길을 검토한다.
- 배포 뒤 첫 08:10/20:10 회차가 지나면 push-health 로그에서 lastSlot·lastRun 이 찍히는지 본다. 발송한 회차가 있으면 lastSentRun 도 본다. 샌드박스에서는 workers.dev 가 막혀 있어 여기서는 확인할 수 없다.
- 배포 직후 첫 회차는 일부러 실시간 공고의 '새 글' 사유를 한 번 세지 않는다(옛 장부라 주소만 바뀐 글로 깨우지 않게). 그 사이 올라온 진짜 새 글은 그 회차에는 서버가 깨우지 않는다. 마감 알림과 정식 등록 새 공고는 그대로 깨운다.
- 푸시 워커를 옛 코드로 되돌릴 일이 생기면, 먼저 Cloudflare 대시보드 → Workers KV → SUBS 에서 state:seen 을 지운다. 그러면 옛 코드가 첫 실행처럼 조용히 다시 채운다. 지우지 않으면 낡은 장부로 한 번 여러 학교를 깨울 수 있다(server/push/README.md 에 적음).
- 배포 순서: feed 묶음이 잃어버린 공고(약 215건)를 되살리기 전에 이 서버 수정이 먼저 배포돼야 한다. 지금 가동 중인 옛 코드는 주소 하나로만 '본 공고'를 알아봐서, 되살린 글로 여러 학교를 깨울 수 있다. 새 코드는 배포 직후 첫 회차(옛 장부)와 수집일 규칙이 이를 막는다. 다만 되살린 글의 foundAt 이 원래 수집일이어야 한다.
- supabase-health.yml 을 Actions 에서 한 번 손으로 돌려 첫 판정을 본다(샌드박스에서는 *.supabase.co 가 막혀 살아 있는지 확인하지 못했다). Supabase 요금 등급(무료 등급의 7일 무활동 일시정지 대상인지)은 개발자가 확인해야 한다.
- CLAUDE.md 아키텍처 표의 server/mail-worker.js '메일(배포 대기)' 문구가 낡았다. 개발자 확인 뒤 고친다(claudeMd 마지막 줄 제안).
- 합칠 때 sw.js CACHE 줄이 부딪히면 이 갈래(v225 · 시작 화면 v224 문구 포함)를 쓴다. ci 묶음도 sw.js 를 고치므로 합치는 쪽이 가장 큰 번호보다 위로 올린다.
- feed 묶음에 넘길 발견 둘. (1) [ERICA] 제목 표시 글은 tagged 학교 '한양대학교 ERICA캠퍼스' 가 SERVED_SCHOOLS 에 없어 누구에게도 안 보인다(match-engine noticeForProfile). (2) 발송 서버는 옛 통짜 data/notices.json 을, 폰은 학교별 파일을 읽어 '새 공고'의 출처가 갈라져 있다.

### insta
- insta-5 (개발자 결정 필요): 인스타 교내 공고를 경희대·한국외대 밖으로 넓힐까요? 지금은 다른 학교 교내 공고가 카드로 안 그려집니다. 명세 시점에 그릴 수 있던 것은 4건이었습니다(건국대 10-20 · 고려대 10-30 · 동국대 10-14 · 인하대 10-15). 넓히면 캡션 고정 문구 '경희대·한국외대는 교내 장학금도 올라와요', 학교 해시태그, 사진 풀(insta/photos.json)도 같이 바뀝니다. 추천은 ①(넓힘 · 사진은 assets/schools/photos.json 의 위키미디어 원본을 출처 표기와 함께)입니다.
- 판형 2·3·4 의 카드 글자가 바뀝니다('마감 D-21' → '10월 23일 마감'). 고치기 전과 뒤를 나란히 놓은 그림을 개발자에게 보여 주세요: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/insta/preview/before-after-tpl234.png
- 병합·배포 뒤 거짓 경보 이슈 #263 을 근거와 함께 닫기: '게시는 성공(https://www.instagram.com/p/DdMkqOelTfI/) · main push 거절만 실패 — 수리 커밋 ea62683e · 8e0c73c3'. 이 세션은 이슈를 건드리지 않았습니다.
- 병합 뒤 첫 준비 실행(수집 로봇이 끝날 때마다, 늦어도 매일 09:13 KST)이 마감 지난 카드를 만료로 바꾸고 폴더를 지우며(명세 시점 약 88건 · 약 50MB · git 이력에는 남음) 다 끝난 준비 이슈를 닫습니다. 그 실행의 지운 건수와 닫힌 이슈 번호를 선조치후보고로 확인하세요.
- 2026-10-04 전에 그린 2·3·4번 판형 카드(명세 시점 열린 것 약 54건)는 이제 게시가 거절됩니다. 올리고 싶은 카드는 관리자 화면 「이 판형으로 다시 그리기」 → 새 준비 이슈에서 확인 → 게시 순서로 진행하세요.
- salvage/admin(fdd3fa23): 이 작업 트리에 남아 있던 admin 묶음 미완성 작업(커밋 안 된 8개 파일)입니다. admin 재시도가 병합하고 다시 검증해야 합니다.
- 노션 백로그에 insta 묶음 반영(계획 4 단계).
- [계획 4 · insta-2 소급] 이 묶음이 main 에 들어간 뒤 거짓 경보 #263 을 근거와 함께 닫는다. 예: gh issue close 263 --repo seonju5543-web/hanggonggan --comment '게시는 성공했습니다(https://www.instagram.com/p/DdMkqOelTfI/ · run 34709674360). 실패한 것은 기본 브랜치 저장 뒤 main push 거절(fetch first)뿐입니다. 수리 커밋 ea62683e(게시 작업의 main push 제거) · 21f7b252(올린 뒤 멈춤도 기록 단계가 media 로 장부에 적음).' — 이 세션은 규칙대로 이슈를 건드리지 않았다.
- [계획 4 · insta-7 소급 · 선조치후보고] 병합 뒤 첫 인스타 준비 실행에서 '마감 지난 카드 정리' 단계의 '마감 지나 정리 N건'(expired=N)과 '쓸모없어진 준비 이슈 닫기' 단계의 '닫음 #n' 줄을 읽어 개발자에게 보고한다. 예: gh run list --repo seonju5543-web/hanggonggan --workflow insta.yml --branch claude/nice-heisenberg-WESq5 --limit 5 → gh run view <id> --repo … --log | grep -E 'expired=|마감 지나 정리|닫음 #'.
- [insta-5 · 개발자 결정 대기 · 그대로] 인스타 교내 공고를 경희대·한국외대 두 곳에서 44개교로 넓힐지 정해야 한다(추천 ① 넓힘 — schoolOnly + data.js 별칭 · 사진은 assets/schools/photos.json · 캡션 문구와 해시태그를 학교 중립으로).
- [보고 때 보여 줄 것 · 앞 수리분] 판형 2·3·4 고치기 전/뒤 미리보기(「마감 D-N」 → 「M월 D일 마감」): scratchpad/insta/preview/before-after-tpl234.png

### admin
- Cloudflare Pages → hanggonggan-admin → Settings → Build → Build watch paths 의 Include paths 를 _admin/README.md 「빌드 감시 경로」 16줄로 갱신(빠져 있던 일곱: form-plan.js · collector/deadline-hint.mjs · collector/notice-source.mjs · collector/canon-url.mjs · collector/page-boilerplate.mjs · collector/news-kind.mjs · tools/edit-diff.mjs). 이 샌드박스에서는 실제 Cloudflare 설정을 확인할 수 없었다.
- 관리자 GitHub 열쇠(fine-grained)가 2026-11-07 에 만료된다(노션 F-4) — 그 전에 새로 만들어 관리자 화면 입장 때 넣고, 만료일 칸도 적어 두면 14일 전에 「할 일」에 뜬다. 학생 앱·로봇은 이 열쇠를 쓰지 않는다.
- admin-F10 시험 실행(오케스트레이터 몫): 이 묶음이 기본 브랜치에 올라간 뒤, 수집 줄에 기다리는 실행이 없는지 먼저 보고(`gh api 'repos/seonju5543-web/hanggonggan/actions/runs?status=pending' --jq '.workflow_runs[].path'` 와 status=queued 가 collect-scholarships·browser-collect·open-api·refresh-majors·refresh-tuition·admin-apply 를 하나도 안 보일 때) `gh workflow run admin-apply.yml --repo seonju5543-web/hanggonggan --ref claude/nice-heisenberg-WESq5 -f action=confirm -f payload='{"ids":["<검수 전 공고 id 하나>"]}' -f dry_run=true` — 기대: 요청 내용 적용·데이터 감사 성공 · 「시험 실행」 단계가 바뀔 파일(data/registered.json·data/admin-log.json)을 보이고 저장·이슈 없음. ⚠️ 시험 실행도 같은 수집 줄에 서므로 줄에 기다리는 로봇이 있을 때 누르면 그 실행을 취소시킨다.
- 관리자 화면에서 실제로 6건 이상 되돌리기를 한 번 눌러 숫자 칸 → 반영 완료까지 확인(버튼 길은 08-09 이후 Actions 에서 돈 적이 없다 · 이번 검증은 가짜 응답의 브라우저 드라이버까지).

### refresh
- 학과 목록: 관리자 화면 「학과 목록 갱신」을 한 번 누른다. 로그에 '::error::CAREERNET_API_KEY' 가 없는지(시크릿 실재 증명), collector/majors-report.md 의 「분교 이름 후보」에 연세 미래·상명 천안이 어떤 원래 이름·캠퍼스 번호로 왔는지 본다. 그 글자 그대로 collector/majors.mjs BRANCH_MAP(또는 캠퍼스 번호 표, 근거 주석과 함께)에 한 줄 더한 뒤 다시 눌러 data/majors/n1if6uwu.json 이 생기는지 확인한다(gaps-06 (가) · MAJORS-01 ④ · app2-F5).
- 등록금 갱신(refresh-tuition) 시운전 시점을 정한다(TUITION-01). 한국장학재단 포털 약 2,711쪽(25분)을 두드리므로 월·목 05:53 KST 한국장학재단 수확과 겹치지 않게 누른다. 이제 넘어지면 「🚨 로봇이 넘어졌어요 — 등록금 갱신」 이슈가 뜬다.
- Openverse 401 의 원인은 확인하지 못했다(익명 요청 거절인지 Actions 주소 차단인지 모름). 인증 열쇠(OAuth)를 붙일지 정한다. 지금은 401·403 이면 그 실행에서 Openverse 를 끄고 한 줄만 남긴다.
- 다음 한국장학재단 수확(월·목) 뒤 collector/kosaf-attach-report.md 의 '이미 있던 것' 이 60곳 안팎인지 본다(KOSAF-01 효과 확인).
- 학과 로봇 예약(2·8월)은 달 칸이 있어 하트비트가 '너무 오래 조용함'을 판정하지 않는다(알려진 한계 · 넘어짐 알림만 있다).
- two-school-scan.yml 은 결정 ① 대로 그대로 두었다. 지우려면 ②(admin.js ROBOT_NOT_LISTED · test-collector 기대값 함께).

### ops
- Check whether actions/upload-artifact has a Node 24 release (v5+) in its release notes and, if so, bump the 9 `actions/upload-artifact@v4` lines. The sandbox blocks the GitHub API for actions/* repos, so I left them; gate ⑦ does not cover upload-artifact.
- Close issue #4 (🔍 게시판 후보 정찰 리포트) as not_planned, with a comment pointing to the replacement tools find-boards.mjs and probe-links. This is the orchestrator's job per decision ①; I did not touch issues.
- After the next probe-links push, confirm the report starts with '이번 push 가 새로 넣은 줄만 열었다 — checkUrl 0 · findBoard 0' (my run-probe.txt edit only comments lines out, so that run should be empty and short).
- After the next human push, confirm the Notion 「작업 현황」 '브랜치' column shows the topic branch rather than 'main'. If the three pushes are different commits (for example main got a merge commit), it will show the default branch or main, as the spec accepted.
- The probe lines for 국민 12307, 온통청년 정책, 1365 (two) and 대전 청년포털 have no recorded answer. If they are no longer needed, mark them '# (답 받음 …)' or delete them; otherwise they are only opened on a manual run.
- 모든 묶음을 합친 뒤 마지막 한 커밋으로(ops-14): 합친 작업본에서 `bash /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/ops-14-final.sh` → 남은 옛 판 '없음' 과 health-gates ops ⑦ ✓ 를 확인 → test-collector·verify-ui 가 초록인지 본 뒤 커밋한다. git cherry-pick 14a5dc94 는 ops.mjs 에서 충돌하므로 권하지 않는다.
- actions/upload-artifact 의 Node 24 판(v5 이상) 릴리스 노트를 확인한다(이 세션은 그 저장소를 못 읽었다). 확인되면 9곳을 올리고 ops ⑦ OLD 에 `actions/upload-artifact@v[1-4]\b` 를 더한다.
- 이슈 #4(게시판 후보 정찰 리포트)를 닫는다. state_reason not_planned, 코멘트에 대체 도구 find-boards·probe-links 를 적는다(links-16 결정 ①).
- SESSIONS.md 에 sessionsNote 의 「예약 지연 실측 (2026-10-04)」 절을 옮긴다(숫자 그대로). CLAUDE.md 에는 claudeMd 의 줄을 넣는다. ops-14 줄은 마지막 커밋이 들어간 뒤에만 넣는다.
- 노션 백로그에서 ops-09·ops-10·ops-11·ops-12·gaps-04·gaps-05·links-16 상태 메모를 갱신한다. ops-14 는 '마지막 커밋 대기'로 둔다.
