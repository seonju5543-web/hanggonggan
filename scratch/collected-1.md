
### gate
BACKFILL:
- node verify/audit-data.js  ← Run on fresh robot data to confirm the newly moved invariants (activity/news source rules, period-end = deadline, no HTML entities in evidence sentences) produce no errors. Today they pass. If one fails, open the original notice and fix it through tools/admin-apply.mjs, not by hand.
- node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교  ← After main is deployed, confirm DAAD shows 「자격 미확인」 instead of 「지원 자격 미달」. Verdicts are recomputed by code, so there is no data to change.
- node verify/audit-data.js  ← 감사가 이제 활동 출처의 집계 사이트(link-fix.mjs AGGREGATOR_RE)까지 출처 규칙 전부를 '오류'로 본다(auditSourceFiles). 최신 데이터(collector/activity-sources.json·news-sources.json)에서도 exit 0 인지 확인한다. 걸리면 손으로 JSON 을 고치지 말고 관리자 화면 「활동」/「소식」 출처 보관(activitySource/newsSource park)으로 정리한다.
- node verify/what-shows.mjs auto-notiphpcodes1301seq11193 --school=한국항공대학교  ← B1 — DAAD 「학사 및 석사과정 학생」 이 학부 3학년에게 '지원 자격 미달'이 아니라 '자격 미확인'으로 보이는지 main 배포 뒤 확인한다. 판정은 앱이 코드로 매번 다시 하므로 데이터 소급은 없다.
- node verify/eligibility-report.mjs --bad  ← B1 규칙(UNDERGRAD_TOO 확장 · 'both' 갈래 남는 글자 잣대) 뒤 자격 줄 전수 재채점. 최신 데이터에서 전후 숫자가 같아야 한다(수리 시점 실측: 바뀐 조합은 DAAD 3건뿐).
- (실행 없음 — 자가 치유) 다음 장학공고 수집 실행의 스키마화 단계  ← collect-13 — collector/pending-forms.json 의 고아 대기 항목(점검 때 71건)은 schematize-forms.mjs 가 pruneOrphans 로 스스로 정리한다. 손으로 지우지 말 것. collector/auto-held.json 도 첫 되돌림 때 gate-guard 가 만든다(손으로 만들지 말 것).
CLAUDE.md:
- 「로봇 · 워크플로」: 🔴 데이터 관문이 빨가면 `collector/gate-guard.mjs` 가 단계별로 되돌리고(새 자동 등록분 → 정식 등록·양식·대기열 HEAD 판) 그때마다 관문을 다시 잰다 · 끝내 빨가면 실패 알림 뒤에서 이슈 + exit 1 · 두 번 걸린 자동 등록은 3일 쉰다(`collector/auto-held.mjs`). 관문 `verify/health-gates/gate.mjs` ④.
- 「로봇 · 워크플로」: 관리자가 고치는 데이터·설정의 불변식은 test-collector 가 아니라 감사에 둔다 — 출처 `verify/source-rules.cjs` · 문구 끝 날짜 = 마감은 `checkEntry`(`lastDateIn` 은 entry-rules 한 곳) · `tools/admin-apply.mjs` 가 저장 전에 같은 함수로 거절. 관문 `verify/health-gates/gate.mjs` ②.
- 「훅 · 검사 운영」: test-collector 의 실데이터 읽기는 파일별 톱니(`REAL_READ_ALLOW`)로 잠겼다 — 늘리지 말고 항목 불변식은 audit-data, 개수·'있어야 한다'는 표본 + ℹ 숫자. 관문 `verify/health-gates/gate.mjs` ③.
- 「로봇 · 워크플로」: 로봇 알림은 제 리포트 이슈 제목 전체로 찾는다(`"장학공고 수집 리포트"`·`"브라우저형 수집 리포트"` — 맨 `"수집 리포트"` 는 다른 로봇 이슈를 집는다). ⚠️ CLAUDE.md 가 지금 400줄 상한이라 넣으려면 다른 줄을 줄여야 한다.
- 🔴 데이터 관문이 빨가면 `collector/gate-guard.mjs` 가 단계별로 되돌리고(새 자동 등록분 → 파일을 직전 판 바이트로) 매번 다시 잰다 · 끝내 빨가면 still-failing = 빨간불 + 이슈 · 두 번 걸린 공고는 3일 쉰다(`collector/auto-held.mjs`). 관문 `verify/health-gates/gate.mjs` ④ (「로봇 · 워크플로」의 '감사 실패면 결과가 하나도 안 남는다' 줄을 이것으로 바꾼다)
- 🔴 관리자가 고치는 데이터의 불변식은 test-collector 가 아니라 감사 **오류**로(`verify/source-rules.cjs` auditSourceFiles · `verify/entry-rules.cjs` checkEntry) — 관리자 저장소도 같은 함수로 먼저 거절한다. 관문 `verify/health-gates/gate.mjs` ②(감사가 경고로 낮추지 않았는지까지)
- 🔴 test-collector 의 실데이터 읽기는 톱니로 잠겼다(`REAL_READ_ALLOW` · 도구가 대신 읽는 `TOOL_READS_ALLOW`) — 늘리지 말고 감사 또는 표본 + ℹ 로. 관문 `verify/health-gates/gate.mjs` ③
- 알림 이슈 검색어는 제 리포트 이름 전체로('"장학공고 수집 리포트"' 등) — 맨 '"수집 리포트"' 는 부분 일치라 다른 로봇의 이슈를 집는다. 관문 `verify/health-gates/gate.mjs` ⑤(워크플로 전부)
- 학위 줄: 학사·석사를 나란히 적은 '과정'(`및`·`또는`·`,`)은 학부도 받는다(`UNDERGRAD_TOO`) · '둘 다' 갈래도 남는 글자가 2자 넘으면 모름(`degreeRest`) — 틀린 미달·틀린 안심 둘 다 막는다. 관문 `verify/health-gates/gate.mjs` ①
HUMAN:
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
SESSIONS: ## 2026-10-04~05 데이터 관문 되돌리기 구조 (점검 묶음 gate · 리뷰 반영)

무슨 일이 있었나: 10-03~04 에 같은 자동 등록 8건이 실행마다 '등록 → 데이터 관문 빨간불 → 되돌림'을 되풀이했다. 원인은 test-collector 의 실데이터 단정이었다(06a34cc7 이 고쳤다). 옛 되돌리기(revert-auto)는 새 자동 등록분만 빼고 관문을 다시 재지 않았다. 그래서 원인이 기존 항목이면 관문이 실패한 상태 그대로 저장됐다(a31a8538 · b364d997). 링크 사냥꾼은 결과를 버리고도 초록불이었고, 알림은 '"수집 리포트"' 부분 일치로 다른 로봇 이슈(#381)에 붙었다. 같은 묶음의 DAAD 「학사 및 석사과정 학생」은 학부생에게 틀린 미달로 보였다.

고친 것(fix/gate): collector/gate-guard.mjs(단계별 되돌리기 + 다시 재기 · reverted-auto/reverted-files/still-failing/flaky · 리포트 단락) · auto-held.mjs(두 번 걸리면 3일 쉼) · source-rules.cjs(출처 규칙 한 곳 · 감사 오류 · 관리자 저장 전 거절) · entry-rules checkEntry '화면 문구 끝 날짜 = 마감' · 실데이터 단정 톱니 · 등록금·학과 갱신 로봇 저장 전 관문 · 알림 검색어 · 양식 대기열 고아 정리 · UNDERGRAD_TOO/degreeRest.

리뷰에서 나온 것(10-05 반영): ① 관문이 감사가 `SR.…Problems(` 를 부르는지만 봐서 errors.push → warns.push 로 바꿔도 초록이었다 — 감사의 일을 auditSourceFiles 하나로 모으고 '오류에만 넣는가'를 주석 걷은 소스로 잰다. ② 리포트에 지난 실행 제목이 남으면 첫 제목을 '되돌림'으로 고쳤다 → 마지막 제목. ③ 집계 사이트 규칙이 감사에서 안 돌았다 → 감사가 link-fix.mjs 의 정규식을 require(esm)로 받는다(정규식은 브라우저가 바로 import 하는 파일이라 그 자리 그대로). ④ deep-fetch.yml 에 맨 '"수집 리포트"' 검색이 남아 있었다 → 관문이 워크플로 전부를 본다. ⑤ 톱니가 path.join(ROOT, 'data/…') 꼴과 도구가 대신 읽는 곳을 못 셌다 → 꼴 추가 + TOOL_READS_ALLOW. ⑥ 쉬기 장부에 끝내 등록되지 않는 id 가 영영 남았다 → 30일 넘은 줄은 지운다 · 리포트에 '데이터 관문 쉬기' 묶음을 따로 둔다(원인을 단정하지 않는 문구). ⑦ 닿지 않는 갈래를 정리했다. ⑧ 낡은 주석을 고쳤다.

교훈: '함수를 부르는가'만 보는 정적 관문은 '결과를 어디에 넣는가'를 놓친다 — 결과의 행선지(errors)까지 잰다. 고친 뒤에는 리뷰어의 변형(warns.push)을 그대로 넣어 빨간불을 확인한다. 관문 위치: verify/health-gates/gate.mjs ①~⑥.

### feed
BACKFILL:
- bash tools/robot-run.sh node collector/heal-feed.mjs --dry --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json  ← collect-01·app2-F1 복구 미리 보기다. 9-30 병합기가 잘라 낸 15개교 글을 사고 직전 로봇 발행분에서 몇 건 메울지 숫자만 본다. 2026-10-05 기본 브랜치 사본 기준으로 242건이 나왔다. 반드시 이 브랜치가 통합된 뒤 fresh 데이터에서 돌린다.
- bash tools/robot-run.sh node collector/heal-feed.mjs --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json  ← 실제 복구다. 9-29 이전에 모은 경희·외대 61건은 로봇의 자동 메우기 범위(FEED_HEAL_SINCE) 밖이라 이 일회성 실행만 되살린다. 9-29 이후 분은 다음 수집 실행이 스스로 메운다. 지금 글은 바꾸지 않고, foundAt 은 원래 날짜로 둔다. registered.json 은 건드리지 않는다. 클라우드 수집과 겹치지 않게 robot-run.sh 로 감싼다. 두 커밋 객체(ab897c3b·60ce385a)가 로컬에 있어야 한다(지금 있음 확인).
- node verify/audit-data.js  ← 복구 뒤 exit 0 을 확인한다. 모의에서는 exit 0 이었다. 다만 javascript: 첨부 경고가 5→22건으로 는다 — 되살린 9-30 판 글이 10-05 첨부 정리(8cb1f746) 전의 모양이기 때문이다. 확인한 뒤 data/notices.json · data/notices/ 를 커밋한다.
- bash tools/robot-run.sh node collector/heal-feed.mjs --dry  ← 복구 뒤 로봇 쪽 메우기에 남은 몫을 본다(모의 6건: 서울과기 3 · 서울대 2 · 계명 1). 이것은 다음 수집 실행이 스스로 메우므로 따로 쓸 필요가 없다.
- bash tools/robot-run.sh node collector/heal-feed.mjs --dry --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json  ← Preview the 9-30 merger-truncation restore (collect-01 · app2-F1). Run it only after the bundle is integrated with the default branch AND heal-feed.mjs calls stripSiteChrome where the collectors do (feed ⑤ stays red until then). Simulated on today's default-branch data: 242 rows to fill (224 also missing from the school files, 18 missing only from notices.json), in 19 schools (외대 36 · 경희 26 · 건국 23 · 서울과기 22 · …).
- bash tools/robot-run.sh node collector/heal-feed.mjs --since=0000-00-00 git:ab897c3b:data/notices/ git:60ce385a:data/notices.json  ← The actual restore. It uses the robots' own function and order (60일·첨부 → dedupe → healFromLedger, which only adds rows, keeps the original foundAt, prefers the current school-file version and only adds what fits under the per-school cap → dropUnserved → publishBySchool → capNotices) and saves with JSON.stringify(x,null,1). Simulated: notices.json 402→643, school files 43. Known leftover after the restore: rows with javascript: attachments in school files go from 5 to 22 (서울과기 17, all truncated 'javascript:downloadfile(' from the old collector; plus 동국 WISE). resolveJsDownload cannot fix these (0/25 resolvable, simulated with the default branch's attachment-link.mjs). The fix is to re-read those originals the way 8cb1f746 did. Students see the attachment name with '원문 게시판에서 내려받기'; this is not a regression, because these rows were missing before.
- node verify/audit-data.js  ← Must exit 0 before committing data/notices.json and data/notices/ (expect only the javascript: attachment warning to grow, not errors).
CLAUDE.md:
- - **실시간 공고 피드는 스스로 돌아온다** — 수집기는 seen 만 보고 '피드에 있나'는 안 물어, 빠진 글은 영영 안 돌아왔다(9-30 병합 사고 215건). 두 수집기가 `healFromLedger`(학교별 파일 먼저 → 후보 장부 · `FEED_HEAL_SINCE` 이후)로 메운다 · 지금 글은 바꾸지 않는다 · 사람용 복구는 `collector/heal-feed.mjs`. 관문 「로봇·도구 점검 관문」 feed.
- - 글이 없는 학교의 학교별 파일은 지우지 않고 빈 파일로(`publishBySchool` · 지우면 병합기가 못 푸는 수정/삭제 충돌) · 화면 0건 학교는 수집 리포트 머리 한 줄(`zeroFeedSchools` · 까닭은 `zeroFeedWhy` — 브라우저 로봇 학교를 '주소 없음'이라 적지 않는다). 관문 같은 절 feed.
- - 누락 감사의 '가진 것'은 학생이 보는 것(피드 + 학교별 파일 + 정식 등록)뿐이다 — 장부를 섞으면 피드에서 빠진 글이 안 보인다(`coverageSets` 한 곳 · 장부는 '수집했지만 피드에서 빠짐' 원인으로만). 관문 같은 절 feed ④.
- ⚠️ CLAUDE.md 는 지금 400줄 상한에 딱 닿아 있다(split 400 · 59,044B — 관문 「CLAUDE.md 부피」). 아래는 새 줄이 아니라 기존 줄 끝에 이어 붙인다.
- [324행 '- 주소 같음 판정 `urlKey()`/`canonUrl` 한 곳 · … (`notStale`).' 끝에 이어 붙이기] 실시간 공고 피드는 매 수집 학교별 파일 → 후보 장부(`FEED_HEAL_SINCE` 뒤) 순으로 스스로 메운다(`healFromLedger` · 학교별 파일 상한 안만) — 피드에서 빼는 새 규칙은 메우기 거르기에도 걸고, 손으로 지울 땐 학교별 파일·`collector/candidates.json` 까지 · 장부 밖 유실은 `collector/heal-feed.mjs`(차례는 관문이 수집기와 대조) · 관문 「로봇·도구 점검 관문」 feed.
- [「폰은 `notices.json` 을 받지 않는다 …」 항목의 '… 관문 「학교별 공고 파일」.' 끝에 이어 붙이기] 글이 없는 학교의 옛 파일은 지우지 않고 빈 파일로(`publishBySchool` · 지우면 로봇끼리 수정/삭제 충돌) · 화면 0건 서비스 학교는 수집 리포트 머리 🙋 줄(`zeroFeedSchools`·`zeroFeedWhy` — 0건 날엔 코멘트에 붙는다).
HUMAN:
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
SESSIONS: 2026-10-05 · 피드 메우기 리뷰 2차(묶음 feed). ① 메우기의 🔁 숫자가 학교별 파일 상한을 몰랐다. healFromLedger 는 메운 글을 자르기 전에 셌고, 발행(splitBySchool)은 학교당 60건에서 자른다. 그래서 60일 안 장부 글이 60건을 넘는 학교(계명 246 · 가천 215 · 서울과기 165)에서는 같은 글이 매 실행 '다시 실었다'로 세였다. 기본 브랜치 데이터를 FEED_HEAL_SINCE 가 안 걸리는 11-28 뒤 모양으로 돌리면 매 실행 152건이고, 학교별 파일 변화는 0이었다. 지금은 정렬한 뒤 같은 함수로 미리 잘라 보고, 파일에 들어가는 새 칸만 싣고 센다. 관문 feed ① ⓖ. ② 정렬 단언이 무력했다. 표본의 장부가 이미 최신순이라 정렬을 지워도 초록이었다. 오래된 글이 먼저인 표본을 더했다. ③ heal-feed.mjs 는 '수집기와 같은 차례'라고 적었지만 60일·첨부 거르기를 빼먹었다. 이제 같은 거르기를 걸고, 관문이 두 수집기 '앱 발행' 단락의 공통 함수 차례와 글자로 대조한다. 기본 브랜치와 합치면 stripSiteChrome 때문에 일부러 빨개진다. ④ 0건 날에는 🔁·🙋 줄이 report.md 에만 남았다. 이제 0건 코멘트에 붙는다(장학 수집만 · 브라우저형은 0건 코멘트 단계 자체가 없다). ⑤ 메운 글의 javascript: 첨부는 resolveJsDownload 로 못 푼다. 서울과기 17건은 옛 수집기가 'javascript:downloadfile(' 에서 자른 것이고, 동국 WISE 는 호스트(wise.dongguk.ac.kr)가 규칙에 없다. 모의로 25건 중 0건이 풀렸다. 푸는 길은 원문을 다시 읽는 것(8cb1f746 방식)뿐이다.

### bodies
BACKFILL:

CLAUDE.md:
- - **자격요건 로봇(`collector/rescue-bodies.mjs`)은 단계 시한 전에 스스로 끝난다** — 한 공고 절대 시한 · 공고마다 저장 · 감시 타이머(예산+한 공고 시한+30초, 저장 후 종료 1) · 저장은 `writeFileAtomic`(임시 파일 → 이름 바꾸기). 대상·차례·장부 규칙은 `collector/rescue-plan.mjs` 한 곳(로봇은 불러오면 돌아 관문이 못 부른다). 관문 health-gates bodies ①.
- - 🔴 `continue-on-error` 단계가 잘려도 작업은 초록이다 — 그런 핵심 단계는 저장 **뒤**에 `steps.<id>.outcome != 'success'` 로 실패를 남기고, 실패 알림은 **이번 실행** 리포트만 붙인다(옛 판을 붙이면 다른 날 일로 읽힌다). 관문 health-gates bodies ①ⓒ(스크립트를 가짜 github 로 진짜 돌린다).
- - **자격용 공고문 첨부(`deepfetch --elig-attach`)는 받은 그대로면 다시 안 받는다**(첨부 목록 서명 `attSig` · 같은 바이트면 파생 글자 보존 · 마감 지난 공고 제외) — 규칙 `collector/elig-attach-plan.mjs` 한 곳. 관문 health-gates bodies ③.
- - **증분 받기(`deepfetch --fill`)의 물러서기는 받기 실패와 껍데기를 둘 다 센다**(`fillRetired`·`fillCounts` · 지난 수는 notices-text.json 의 원래 항목에서) · 받기 전체에 예산. 관문 health-gates bodies ④.
- - PaddleOCR 엔진이 통째로 고장 나면 `paddle-ocr.py` 가 종료 2 + `paddle-status.json` → `activity-docs.mjs --apply` 가 그 글의 무료 기회를 되돌린다(`rollbackOcrTries`) · 워크플로에서 `|| true` 로 삼키지 말 것(경고로 바꾼다). 관문 health-gates bodies ②.
- - 브라우저 수집의 클릭형 게시판 본문은 `clickBodyEntry`(열렸나·이 행 제목이 있나·목록 화면 아닌가) · 저장하는 본문은 늘 `browserBodyEntry`(줄을 살린 것). 관문 health-gates bodies ⑦.
HUMAN:
- bodies-8(유료 · 개발자 결정): 이 묶음이 기본 브랜치에 나가고 수집 로봇·자격요건 로봇이 하루쯤 돈 뒤, 관리자 화면 또는 Actions 의 「자격요건 매칭 · AI 자격 읽기」를 먼저 '미리보기만'으로 눌러 대상 수(장학 본문 · 공고문 첨부 · 대외활동 세 줄)를 보고, 그다음 '첨부만' 또는 '전부'를 정해 누른다. Anthropic API 잔액이 모자라면 실패 이슈가 생기고 데이터는 되돌아간다.
- 수리 뒤 첫 예약 자격요건 로봇(05:23·18:23 KST) 로그 확인: '▶ n/m' 줄 · 공고마다 저장 · '⏱' 처리 · 끝까지 돌면 열린 rescue-bodies 실패 이슈(#234·#337·#361·#378 등)가 '다음 실행이 끝까지 돌아 닫습니다' 코멘트와 함께 스스로 닫히는지. 이슈를 손으로 닫지 않는다.
- PaddleOCR: 샌드박스는 모델 서버에 못 닿아 엔진을 실제로 돌려 보지 못했다. 첫 수집 실행 로그에서 '✓ <파일> — N줄'이 나오는지 본다. 판 고정 뒤에도 같은 오류로 '::warning::PaddleOCR 엔진 오류'가 뜨면 그때 paddle-ocr.py 의 PaddleOCR(…)에 enable_mkldnn=False 를 더하는 것을 검토한다(기회는 되돌려지므로 그 사이 깎이지 않는다).
- CLAUDE.md·SESSIONS.md 반영(위 claudeMd·sessionsNote 제안) 과 노션 백로그 상태 갱신은 이 묶음을 기본 브랜치·main 에 올리는 쪽(계획 4)에서 한다.
SESSIONS: 2026-10-05 로봇·도구 점검 bodies 묶음(자격요건 로봇·본문·첨부·OCR) — 사고 기록. ① 자격요건 로봇 run 37160846656(#53, 10-03 23:09Z)은 넷째 공고(서울대)에서 브라우저 호출 하나가 돌아오지 않아 '본문 재수집' 단계가 11분 시한에 잘렸다. 끝에서 한 번만 저장하던 탓에 이미 받은 3건까지 잃었고, 저장 커밋은 act-browser.json 한 파일뿐이었다(장학 쪽 #50~#53 4회 연속 0건). 그런데 그 단계가 continue-on-error 라 작업은 success → 실패 알림이 안 갔고 하트비트도 성공으로 셌다. 잡 정리 로그의 'Terminate orphan process (node)'로 보아 단계 시한 뒤에도 node 가 살아 있었다 — 신호 처리기로는 저장을 못 살린다. 수리: 한 공고 절대 시한 · 공고마다 저장 · 감시 타이머(10분 30초에 스스로 저장 후 종료 1) · 원자적 저장 · 저장 뒤 '끝까지 못 갔으면 실패' 단계. ② 실패 이슈 #378 에 9-30 판 리포트가 붙어 '경희대 공고 4회째 본문 없음'처럼 읽혔다(실제로는 넷째 공고에서 멈춤) → 알림은 이번 실행 리포트만 붙이고, 성공하면 옛 실패 이슈를 닫는다. ③ 같은 세 건이 매 실행 맨 앞을 차지했다(성공하면 장부 칸을 지워 tries 0 으로 돌아감) → 확보 날짜를 남기고 이레 쉰다 · 마감 지난 공고 제외. ④ 자격용 첨부 받기는 앞 6건을 매 실행 다시 받으며 파생 글자를 지웠고 뒤의 18건은 한 번도 안 받혔다 → 서명으로 받은 그대로 건너뛰기. ⑤ 증분 받기에서 '받았지만 껍데기' 110건이 실패로 안 세어져 매 실행 앞자리를 차지해 브라우저 수집 단계(3분)가 잘렸다 → 껍데기도 센다 + 받기 예산. ⑥ PaddleOCR 이 클라우드(x86)에서 모든 그림에 ConvertPirAttribute2RuntimeAttribute 오류로 0장인데 `|| true` 가 삼켜 초록불이었고 글마다 두 번뿐인 무료 기회가 깎였다 → 판 고정(다른 세션 30e214b4) + 종료 2·경고·기회 되돌리기·장부 판 이동. ⑦ 관문 교훈: 워크플로 스크립트를 글자로만 재면 핵심 조건(옛 판 리포트 안 붙이기)을 지워도 통과했다 — github-script 는 가짜 github/context 로 진짜 돌려 잰다. 이 관문은 수집 로봇의 데이터 관문(test-collector) 안에서도 돌므로 시간에 기대는 표본은 넉넉한 여유를 둔다.

### browser
BACKFILL:
- ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.gov.kr/portal/cnstexhb"}' node tools/admin-apply.mjs  ← api-09 결정 — robots.txt 가 사이트 전체를 막은(Disallow: /) 정부24 공모전 출처를 지우지 않고 보관. 관리자 버튼과 같은 길이라 data/admin-log.json 에도 기록된다(그래서 브랜치에서 손으로 안 함). 저장소 뿌리에서 · 최신 기본 브랜치에서 실행. 임시 복사본에서 exit 0 확인.
- ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.kocca.kr/kocca/pims/list.do?menuNo=204104"}' node tools/admin-apply.mjs  ← api-09 결정 — robots.txt 가 /kocca/*/list.do 를 막은 한국콘텐츠진흥원 출처 보관(1a09466c 가 별표 해석을 고친 뒤에도 ⛔). 임시 복사본에서 exit 0 확인.
- ACTION=activitySource ACTOR=claude-health-sweep PAYLOAD='{"op":"park","boardUrl":"https://www.youthcenter.go.kr/bbs03List/48"}' node tools/admin-apply.mjs  ← api-09 결정 — 온통청년 청년참여 게시판(48)은 공공 API 청년콘텐츠가 같은 게시판을 받는다(open-api-map.mjs bbs03View/48) · 일반 수집은 10-05 에도 🟡 0건이라 중복 출처를 보관. 임시 복사본에서 exit 0 확인. 세 명령 모두 collector/activity-sources.json 과 data/admin-log.json 을 쓴다 — 커밋할 때 둘 다 add.
CLAUDE.md:
- - **브라우저 수집 건강 장부**: 학교 결과는 `collector/browser-health.mjs` 한 곳(열렸지만 장학 0건 = 실패 · 예산 건너뜀 = 안 적음) · 브라우저 쪽 연속 횟수는 `browserFails`(일반 로봇이 같은 줄 `fails` 를 되돌린다) · 일반 로봇이 ✅ 인 학교는 `browser-targets.json` `parked` 로. 관문 「로봇·도구 점검 관문」 browser ②④ · 「수집망 복원」.
- - **열쇠 규칙(urlKey·canonUrl 의 VOLATILE)을 바꾸면** 두 목록에 같은 이름 + 옛 열쇠 장부는 `rekeyLedger`(수집 장부 · 옛 열쇠 남김)·`rekeyKey`(썸네일 장부는 옮긴다)로 잇는다 · `idFromUrl` 공식은 그대로. 관문 「로봇·도구 점검 관문」 browser ①.
- - **대외활동·재단 출처 연속 실패**는 `collector/source-health.json`(`collector/source-health.mjs` · 열쇠 = 게시판 주소 · 6회면 리포트 머리 🙋 한 줄 — 0건 날 코멘트에도 실린다). 관문 「로봇·도구 점검 관문」 browser ⑥.
- - **학교 도메인**(판정 로봇의 학교 이메일 신호)은 `domainForSchool` 한 곳(`collector/kind-evidence.mjs` — schools.json 주소 → 없으면 브라우저 대상 첫 후보 · 보관은 안 본다).
HUMAN:
- 묶음 밖 P1(명세 검증 메모 · 담당 묶음 미정): 자동 등록 id 공식 idFromUrl(끝 24글자)이 꼬리가 같은 게시판의 다른 글을 한 id 로 뭉친다 — 계명 주소 전부 'auto-srchenable1srchvotetype1'(이번 수리 뒤에도 그대로 · 공식을 일부러 안 바꿨다), 서강은 blockIds 의 'auto-amepagescholarshipnotice' 에 전부 막혀 자동 등록 0건. links 또는 gate 묶음에 배정 필요(제안: canon-url.mjs idFromUrlUnique + blockUrls 우선).
- api-09 backfill 세 명령(정부24·콘텐츠진흥원·온통청년 청년참여 보관)은 관리자 기록을 같이 쓰므로 오케스트레이터가 최신 기본 브랜치에서 실행·커밋해야 한다(admin-log.json 포함). 원하면 관리자 화면 「활동」 탭 보관 버튼으로 같은 일을 해도 된다.
- 배포 뒤 첫 브라우저 리포트로 확인: 대상 14곳 · 서울대 멈춤 없이 수집 단계가 짧아졌는지 · '⏭ 남은 후보' 줄 · 🚨 줄이 진짜 문제 학교에만 뜨는지(첫 3회는 장부가 비어 뜨지 않는다). 10-05 리포트의 동국·고려·가천 'Target page, context or browser has been closed' 오류가 서울대 멈춤과 관련 있는지는 확인하지 않았다 — 서울대를 뺀 뒤에도 나오면 따로 볼 것.
- 10-05 브라우저 리포트에서 시립(새 사이트 첫 실행)의 [수집] 목록에 같은 제목이 두 번씩 보였다 — 2페이지가 1페이지 글을 다른 표식 주소로 돌려준 것으로 보이나 확인하지 않았다(피드는 제목 열쇠로 합쳐져 화면 중복은 없을 것). 다음 리포트에서 반복되면 별도 점검.
- pageNo·pageUnit 휘발 처리는 명세대로 후속 과제로 남김(중앙·서울교대·경기·충북 장부 키 수백 개가 바뀜) — 계명은 1페이지→2페이지로 밀린 글이 한 번 더 들어올 수 있다(새 글 하나당 최대 1건).
- 기본 브랜치(1680232b)와 합칠 때 collect-scholarships.yml·auto-register.mjs·deepfetch.mjs 충돌은 이 묶음이 아니라 앞 체인(fix/bodies)부터 있던 것이다. browser-collect.mjs 는 기본 브랜치의 첨부 링크 수정(8daf7d06·8cb1f746)과 자동 병합됐다(merge-tree 확인).
SESSIONS: 2026-10-05 로봇·도구 점검 3단계 browser 묶음 — ① 브라우저 수집 건강 장부가 '후보 하나라도 열렸나'만 봐서 장학 0건 학교(홍익·시립 10-02~04)와 예산으로 건너뛴 학교도 매일 lastOk=오늘이었고, 장부를 일반 로봇과 같은 줄(학교 이름)로 쓰는데 일반 로봇이 매 실행 fails 를 0 으로 되돌려 서울대가 10-01~05 매 실행 7분 30초 멈춰도 연속 실패 경보가 한 번도 안 떴다(collect.mjs 주석 '섞이지 않는다'는 틀렸다) → browser-health.mjs 한 곳 + 제 칸 browserFails · 0건 날에도 코멘트. ② 계명 page.jsp 의 pageRef(목록 첫 글 번호)가 새 글마다 바뀌어 목록 40건이 통째로 '새 글'로 다시 들어옴 → VOLATILE 두 목록 + rekeyLedger(장부 잇기). 소식 썸네일 장부도 같은 열쇠라 옮기지 않으면 같은 사진이 '두 글의 공통 그림'으로 막힐 뻔했다(명세 밖에서 찾음). ③ 후보를 다 열고 읽은 것을 버리던 harvestTarget 이 숙명 둘째 후보(학교 첫 화면)의 수상 소식을 장학으로 실었다 → 읽히면 멈춤 · 일반 로봇이 ✅ 인 서울대·서강·숙명·가천·홍익을 보관. ④ 활동·재단 출처는 health.json 에 못 넣어 연속 실패 장부가 아예 없었다 → source-health.json. ⑤ 명세 B2·B3(홍익·시립 주소)는 같은 날 다른 세션 1a09466c 가 이미 고쳤고, 명세의 ⛔ 다섯은 robots.mjs 별표 해석 수정 뒤 둘(+재단 하나)로 줄어 있었다 — 명세 숫자를 그대로 믿지 말고 최신 리포트로 다시 잴 것. ⑥ red-green 에서 병합기 표본(최근 성공 쪽이 횟수도 작은 꼴)이 '작은 쪽' 규칙을 지워도 통과해 표본을 바꿨다. ⑦ 작업 중 실수: 첫 커밋에서 중간 판 파일 복사가 샌드박스에 막힌 걸 모르고 최종 판을 묶어 커밋했다 → soft reset 으로 되돌리고 다시 나눔(푸시 전).

### ci
BACKFILL:

CLAUDE.md:
- - **화면 검사(verify-ui)는 하나가 넘어져도 끝까지 돈다** — 드라이버 실패는 `||` 로 모아 끝에 한 번 · 뒤 관문 셋은 `!cancelled()` · 경보는 `failure()` 그대로(`set -e` 로 되돌리지 말 것 — 기본 셸이 bash -e). 관문 「로봇·도구 점검 관문」 ci ② (`verify/health-gates/ci.mjs`).
- - **드라이버가 실데이터에서 대상을 못 찾으면 실제 항목을 복사한 표본으로 몬다** — 규칙은 `verify/open-form-sample.cjs` 한 곳(칸이 적은 가짜 항목 금지 · 마지막엔 앱 내장 양식). 관문 같은 곳 ci ①.
- - **서술형 칸(kind 'story')은 세션이 단다** — 양식을 고쳤으면 감사의 '자기소개서 칸 … 종류를 모릅니다' 경고를 보고 essay-ask.js `ESSAY_KINDS` 에 더한다(규칙 `verify/essay-unknown-fields.cjs` · 경고만). 관문 ci ④.
- - 🔴 **화면 검사(verify-ui.yml)는 한 곳이 넘어져도 그물이 남고 스스로 끝낸다** — 드라이버 실패는 `||` 로 모아 끝에 한 번 · 브라우저 경로 뒤 경보 앞까지 모든 단계 `!cancelled()` · 루프 예산 20분(넘으면 남은 이름을 `unrun` 으로 넘기고 실패) · 전 여정 5분.
  경보는 화면 검사가 돌았는지·못 돈 것부터 가른다. 관문 `verify/health-gates/ci.mjs` ②(루프·경보 셸을 가짜 node·gh 로 실제로 돌린다 — 글자 대조는 `|| echo` 를 못 잡았다).
- - **화면 검사 드라이버는 실데이터에 기대지 않는다** — 보이는 양식 공고가 없거나 전부 마감이면 표본(`verify/open-form-sample.cjs` `openFormSample` · 등록 목록에 없으면 앱 내장 양식)으로 같은 길을 몬다.
  관문 ci ①(`driveAnyLiveForm` 을 가짜 page·driveOneForm 으로 실제로 돌린다 — 조건을 `ids.length &&` 로 감싸는 10-04 꼴을 줄 세기로는 못 잡았다).
- - 작업 브랜치 배포(`device-deploy.yml`) 뒤엔 화면 검사를 버튼 실행으로 깨운다(기본 열쇠의 push 는 다른 워크플로를 못 깨운다) · 배포를 막지는 않는다(개발자 결정 대기). 관문 ci ③.
- - 종류를 모르는 자기소개서 칸은 데이터 감사가 **경고**한다(`verify/essay-unknown-fields.cjs` `unknownStoryFields` · 주간 검사와 같은 함수) — 'story' 는 세션이 단다(양식 로봇은 kind 를 안 단다). 관문 ci ④.
HUMAN:
- Decide whether verify problems should block a deploy from a single work branch (device-deploy). Right now only audit-data blocks it; the new step wakes the screen check after the deploy and blocks nothing. If you want blocking, add `node verify/test-collector.mjs` without DOC_GATES next to the audit, and on failure reset and set state=auditfail (spec ops-03 ①).
- After these commits are pushed, check that the next verify-ui run is green and that open ui-gate issues #389 and #390 close by themselves (the close step runs only on the default branch). Only GitHub can show this.
- Optional (P3): duplicate ui-gate issues open when the default-branch run and the main run fail at the same moment (#389 and #390 were created in the same second). Opening alerts from any branch was a deliberate choice, so changing it is your call.
- When merging with fix/gate, resolve verify/health-gates.mjs to `export const PARTS = ['gate', 'ci'];`. This branch has ['ci'] only. Dropping either side silently drops that bundle's gates.
- After push, check on the default branch that the next verify-ui run is green and that ui-gate issues #389 and #390 close by themselves (the close step runs only on the default branch). Also note how long the '화면 검사 (관문)' step took. It must stay well under the new 20-minute budget (13m34s in run 37227739276).
- If the alarm starts reporting '시간 예산을 다 써서 돌리지 못한 드라이버', first find the slow driver: compare the times on the `──` log lines. Do not raise the budget first. The job cap is 30, and the gate requires 30 > budget + drive.js cap + 3.
- Developer decision needed (spec ops-03): should device-deploy block the deploy when the tests fail? Right now it only wakes verify-ui afterwards.
- Optional (P3): duplicate ui-gate issues can open when the default-branch run and the main run fail at the same moment (#389 and #390 were created in the same second). Opening alerts from any branch is deliberate, so changing it is your call.
- Behaviour change: a red run now goes to the end like a green one (about 15 minutes), but it is bounded: drivers ≤ 20 min, drive.js ≤ 5 min.
SESSIONS: 2026-10-04~05 · 화면 검사(verify-ui) 그물 걷힘 — ci 묶음 (수리 1차 + 리뷰 2회)
· 사고: 10-03~10-04 verify-ui 연속 빨간불(#383 → #389·#390). 원인 둘이 겹쳤다 — ① verify-registered.js 가 '이 학생에게 보이는 마감 전 양식 공고'를 실데이터에서 못 찾으면 빨개졌다(데이터 탓) ② 화면 검사 단계가 `set -e` + 맨몸 node 라 하나가 넘어지면 뒤 드라이버 22개와 말투·토큰·수집기 규칙·전 여정이 통째로 건너뛰어졌다(run 37193935701) — 그 사이 들어온 토큰 위반(ui-tone 76/75)이 CI 에 한 번도 안 보였다.
· 수리 1차: 표본 고르기를 순수 함수(verify/open-form-sample.cjs · 앱 내장 양식 폴백)로 · 실패를 모아 끝에 한 번 · 뒤 단계 !cancelled() · device-deploy 뒤 verify-ui 깨우기 · 모르는 자기소개서 칸은 데이터 감사 경고(양식 로봇은 kind 를 안 달아 리포트에 걸면 영영 안 울린다 — 09-29 를 멈춘 칸도 세션이 손으로 옮긴 f4438304 의 칸).
· 리뷰 1차: 같은 구멍이 한 단계 위에 남아 있었다(앞의 값싼 관문 하나가 넘어지면 드라이버 전부 건너뜀 · 경보가 '실패한 드라이버: 없음'이라고 0개 돈 것을 다 통과한 것처럼 적음) → 구간 전체 !cancelled() · 경보 세 갈래 · 경보 셸을 가짜 gh 로 실제로 돌려 잰다.
· 리뷰 2차(이번): ⓐ 관문이 드라이버 루프를 **글자로만** 봐서, 루프 줄을 `|| echo "❌ $f"` 로 바꿔 화면 검사가 영구 초록불이 되어도 통과했다(실측 재현) → 루프 셸도 bash -eo pipefail 로 실제로 돌린다(가짜 node·timeout · 빈 임시 폴더 · 임시 GITHUB_OUTPUT). ⓑ 표본 배선 검사가 return 줄만 세서 `if (ids.length && shouldPlantSample(…))`(10-04 사고 그대로)를 못 잡았다 → driveAnyLiveForm 을 가짜 page(vm)·driveOneForm 으로 실제로 돌린다. ⓒ 드라이버마다 5분만 있고 루프 예산이 없어 26×5분이 30분 그릇을 넘으면 '취소'로 끝나 경보가 안 뜰 수 있었다 → 루프 예산 20분(넘으면 남은 이름 `unrun` + 실패 · 드라이버 시한 ≤ 남은 예산 · 경보가 '돌리지 못한 드라이버'를 따로 적는다) · 전 여정 5분 · 작업 상한 30 > 20+5+3 을 관문이 잰다. 근거: 마지막 성공 실행의 화면 검사 단계 13분 34초(run 37227739276).
· 교훈: 셸·워크플로 동작을 지키는 관문은 **글자 대조가 아니라 실행**이어야 한다 — 막으려는 최악(조용한 초록불·조건 감싸기)은 글자를 그대로 남긴 채 들어온다. 그리고 작업 상한은 '모든 단계 시한의 합'을 담아야 한다(드라이버별 시한만으로는 합이 안 잡힌다).

### alerts
BACKFILL:

CLAUDE.md:
- - **경보 이슈는 한 곳**(`tools/alert-issue.mjs` · 공용 액션 `.github/actions/alert-issue`) — 라벨이 아니라 제목으로 찾아 댓글, 같은 초 중복은 닫고, 회복하면 resolve 로 닫는다. 넘어짐 경보(robot-down)는 하트비트가 닫는다(로봇의 마지막 성공이 경보 뒤에 시작했을 때만). 관문 「로봇·도구 점검 관문」 alerts.
- - 🔴 **실패 알림은 이슈로 사람에게 닿는다** — failure()·cancelled() 단계가 요약 한 줄·::warning 뿐이면 관문이 빨갛다(뒤의 robot-down·alert-issue 가 같은 실패 갈래를 덮으면 통과) · 로컬 액션 앞에 checkout · gh 로 라벨을 붙이면 그 라벨을 먼저 만든다. 관문 「로봇·도구 점검 관문」 alerts ⑥.
- - 지난 리포트 이슈 정리 규칙은 `tools/report-retention.mjs` 한 곳(유형별 최신 몇 건) — 경보·사냥꾼·인스타(🚨🔧📸🛰🎨)는 넣지 않는다(각자 닫는 길이 있다).
- - 실제 앱 반영 확인이 대조하는 파일은 `tools/app-fetch-files.cjs` 가 앱 스크립트의 fetch·getDoc 글자에서 뽑는다(손 목록 금지) · 어긋나면 3분 뒤 main 을 다시 받아 한 번 더 본다.
- - **경보 이슈는 한 곳**(`tools/alert-issue.mjs` · 공용 액션 `.github/actions/alert-issue`) — 라벨이 아니라 제목으로 찾아 댓글·같은 초 중복 닫기, 회복하면 resolve. 실패 알림을 `::warning`·요약 한 줄로 두지 말 것(넘어짐은 robot-down). 관문 「로봇·도구 점검 관문」 alerts ⑥ S1~S4.
- - 넘어짐 경보(robot-down)는 하트비트가 닫는다(`collector/robot-heartbeat.mjs` --close-recovered · 예약이 있으면 **예약 실행의 성공만**(`successEventFor`) · 경보 뒤 시작 또는 경보 낸 실행보다 뒤에 생겨 경보 뒤에 끝난 것만 · 못 읽으면 둔다 `mergeLastOk`). 로컬 액션 앞엔 체크아웃. 지난 리포트 정리 규칙은 `tools/report-retention.mjs` 한 곳.
- - 실제 앱 반영 확인(check-live)은 앱 스크립트의 fetch·getDoc 글자에서 받는 파일을 뽑아 지문으로 대조한다(`tools/app-fetch-files.cjs` · 손 목록 금지) · 어긋나면 3분 뒤 main 을 다시 받아 한 번 더.
- - 🔴 워크플로 **글자**를 재는 관문은 로봇 워크플로에선 경고만(`softEq` · `DOC_GATES` 와 같은 잣대 — 다른 세션의 무해한 단계 하나로 모든 로봇 결과가 되돌려지지 않게) · 엄격한 곳은 로컬과 verify-ui(`.github/workflows/**` 감시). 넘어짐 알림은 개수가 아니라 덮는가로 잰다(`coversDown`·`broadFailKinds` — && 로 좁힌 조건은 못 덮는다). 관문 「로봇·도구 점검 관문」 alerts ⓪⑧⑫.
HUMAN:
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
SESSIONS: 2026-10-05 로봇·도구 점검 alerts 묶음 — 코드 리뷰 3차 재수리. ① 직전 수리(b0170322)는 S3 의 '조건 글자가 같아야 한다'만 풀었다. 같은 결함이 ⑧(collect-news)·⑫(link-hunter·audit-coverage)·⑩ 의 '실패 단계는 robot-down 하나뿐'(개수 판정)에 남아 있었다. 다른 세션이 '못 넣은 수집분 보관(if: failure() · upload-artifact)' 단계 하나만 더해도 ✕ 가 났고, test-collector 는 모든 수집 로봇의 데이터 관문에서 돌아 모든 로봇 결과가 되돌려질 뻔했다. 고침: '실패·취소를 좁히지 않고 덮는 robot-down 이 있는가'(coversDown · broadFailKinds)로 잰다. 진짜 파일에 그 단계를 끼운 표본도 함께 잰다. ② 더 근본적으로, 워크플로 글자 관문 전부(S1~S4·각 로봇 절)는 로봇 워크플로에선 경고만 하고 로컬·verify-ui(DOC_GATES=1)에서만 실패한다(softEq — 문서 관문과 같은 잣대). verify-ui 감시 경로에 .github/workflows/** 를 더해 워크플로만 고친 커밋에도 엄격한 관문이 돈다. ③ S3 는 덮는 알림의 조건에 글자가 '들어 있기만' 하면 통과시켜, `failure() && …schedule` 처럼 좁힌 알림을 잡지 못했다. 이제 && 로 좁힌 갈래는 세지 않는다. ④ 교내 소식 로봇의 경보 여는 단계(continue-on-error 없음)가 관문·저장 앞에 있었다. 이슈 API 가 흔들린 날 그 실행의 소식이 저장되지 않을 수 있어 저장·리포트 뒤로 옮겼다. ⑤ 관문이 순수 함수만 재고 그 함수를 실제로 묶는 워크플로 줄은 안 재서, 변이 일곱이 초록이었다(device-deploy 모름=둠, check-live 출력 옮기기·조건부 break, insta LIVE 기본값, robot-down exit 0, admin-lock 미리보기 제외, 하트비트 못 읽음=모름). 줄마다 검사를 더했다. ⑥ 하트비트 닫기는 '번호가 더 크면' 경보 전에 이미 끝난 성공으로도 닫았고(가짜 API 재현), 수동 모의·부분 실행의 성공도 회복으로 셌다. 이제 경보 뒤에 끝난 성공만 세고, 예약이 있으면 예약 실행만 묻는다(event=schedule). 닫는 글은 확인한 만큼만 쓴다. 교훈: 관문이 개수·글자 포함으로 재면 무해한 편집에 헛빨간불이 나거나 좁힌 조건을 놓친다. 데이터 관문에서 도는 워크플로 글자 검사는 로봇 결과를 되돌리지 않게 경고로 두고, 엄격한 검사는 워크플로를 감시하는 코드 검사에 둔다.

### servers
BACKFILL:

CLAUDE.md:
- - **서버 워커(`server/*`)는 공용 파일을 기본 가져오기로**(`import ME from '../../match-engine.js'`) — `createRequire`·`node:` 모듈은 Workers 에 올리는 순간 넘어진다. 관문 `verify/health-gates/servers.mjs` ①.
- - **푸시 서버는 공용 규칙의 사본을 둔다**(빌드 감시 경로가 `server/push/*` · `titleSeenKey`·`SHARED_BOARD_BRANCH`·`TITLE_CAMPUS`·`taggedSchool`) — 원본을 바꾸면 관문 servers ⑥⑧ 이 빨개지니 사본도 같이. '본 공고'는 폰과 같은 셋(주소·학교+제목·수집일) · 마감 깨우기는 공고마다 하루 한 번.
- - 푸시 매일 확인 판정은 `tools/push-health-verdict.mjs` 한 곳(서버 /health 의 `lastSlot`·`lastRun` — 두 회차 연속 안 돎 stale · 새 코드 미배포 outdated) · 로그인 서버는 `supabase-health.yml`(공개 열쇠로 /auth/v1/health 만 · 감시이지 휴면 방지라고 쓰지 말 것). 관문 servers ③④⑨.
- - (아키텍처 표 고칠 줄 · 개발자 확인 뒤) `server/mail-worker.js` '메일(배포 대기)' → 2026-09-25 폐기 · 접수 대행은 `server/apply/`(꺼짐 · 우리 도메인 필요 · 앱 메일 버튼은 mailto:) — 현황표는 `server/README.md`.
- - 서비스워커의 공용 이름은 `typeof` 로 본다 — importScripts 하나가 실패해도 푸시를 받으면 알림 1건(관문 servers ⑩).
- - **서버 워커가 공용 파일을 불러 쓸 때는 기본 가져오기로**(import ME from 꼴) — Workers 에는 node:module 이 없어 `createRequire` 꼴은 올리는 순간 넘어진다. 관문 「로봇·도구 점검 관문」 servers ①.
- - 🔴 **푸시 서버는 공용 규칙의 사본을 둔다**(빌드 감시가 `server/push/*` 뿐) — `titleSeenKey`·`SHARED_BOARD_BRANCH`·`TITLE_CAMPUS`·`taggedSchool`·수집일 이틀을 바꾸면 `server/push/worker.js` 도 같이(servers ⑥⑧ 이 대조 · ⑥(e) 경계 표본). 기본 브랜치 push 즉시 배포라 `node verify/verify-push-server.mjs` 먼저.
- - 🔴 **푸시 서버 plan 걸음은 장부만 다룬다** — 글자 일(제목 다듬기·수집일·분교)은 notices 걸음의 `noticeMini` 에서 끝낸다(무료 등급 한 걸음 10ms · 새로 뜬 실행 환경의 첫 부르기로 잰다). 장부는 줄 단위(state:seenLines)이고 옛 state:seen 은 읽기만 한다. 관문 servers ⑥(c)(d)(g).
- - 푸시 서버 매일 확인은 상태 응답의 `lastSlot`·`lastRun`·`lastSentRun` 으로 '예약 회차가 돌았는가'와 '발송 회차가 받아졌는가'를 본다(판정 `tools/push-health-verdict.mjs` 한 곳 · 살아 있는 구독에 보냈는데 받아 준 수 0 일 때만 경보). 관문 servers ③④⑤.
- - 로그인 서버 매일 확인 `.github/workflows/supabase-health.yml`(`tools/supabase-health.mjs` · 공개 열쇠로 health 만 묻는다) — 설정을 못 읽으면 '꺼짐'이 아니라 실패(robot-down) · '휴면 방지'라고 적지 말 것(확인 안 함). 관문 servers ⑨.
- - 서비스워커 푸시 처리는 불러온 파일의 이름을 `typeof` 로 본다 — 공용 파일 하나가 안 실리면 그 자리에서 던져 알림 0건(iOS 는 되풀이되면 구독을 끊을 수 있다). 관문 servers ⑩.
- - 관문 묶음 파일(verify/health-gates/)이 **문서 글자**를 재면 `softEq` 로 감싼다 — 로봇 워크플로에서는 경고만 하고, 로컬과 DOC_GATES=1 에서는 실패한다(test-collector 는 수집 로봇의 데이터 관문이라 빨간불이면 자동 등록분이 되돌려진다). 관문 servers ②⑨ · alerts.
- - (개발자 확인 뒤) 아키텍처 표의 `server/mail-worker.js` '메일(배포 대기)'를 고친다: 푸시 가동 · 도우미·초안 꺼짐 · 접수 대행 `server/apply/` 꺼짐(우리 도메인 필요) · mail-worker 는 2026-09-25 폐기 — 현황은 `server/README.md` 한 장.
HUMAN:
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
SESSIONS: 2026-10-04~05 로봇·도구 점검 — 묶음 servers(푸시·접수·로그인 서버).
1차 수리:
- 접수 대행 워커를 기본 가져오기로 바꿨다(createRequire 꼴은 Workers 에서 넘어진다).
- server/README 를 현황표로 다시 쓰고, apply/wrangler.toml 의 증빙 위치를 Supabase apply_sends 로 바로잡았다.
- 푸시 /health 에 lastSlot·lastRun·pastError 를 더하고 판정을 tools/push-health-verdict.mjs 한 곳으로 옮겼다.
- '본 공고'를 주소·학교+제목·수집일 셋으로 본다. 10-04 08:10 회차는 깨운 9개교 전부가 주소만 바뀐 글 46건이었다.
- 마감 사유는 공고마다 하루 한 번만 깨운다. 여러 학교만 받는 공고(schoolsAny)는 그 학교만, 게시판을 같이 쓰는 분교도 깨운다.
- supabase-health.yml 을 만들고, sw.js 는 typeof 로 본다.
2차 리뷰(10-05)에서 막은 구멍 다섯:
① 1차 수리로 plan 걸음이 무거워졌다. 새로 뜬 실행 환경의 첫 부르기가 Node 실측 중앙값 약 9ms 로 10ms 한도에 닿았다(옛 판 약 5ms). 수리 보고에 7.8–11ms 를 적고도 조치하지 않았다. → 글자 일은 notices 걸음(noticeMini)으로 옮겼다. 제목 열쇠는 보통 빈칸만 있을 때 정규식 없이 만들고, 사본과 같은 답인지 \s 의 모든 글자로 잰다. 장부는 줄 단위 새 열쇠(state:seenLines)에 두고 옛 열쇠는 읽기만 한다(되돌려도 안 넘어짐). 자르기는 한 번 훑기로 바꿨다. 결과 plan 4.96ms · notices 5.21ms · reg 그대로 약 7.4–8.1ms(가장 무거운 걸음).
② 문서 글자를 재는 관문 줄이 수집 로봇의 데이터 관문에서도 돌아, 문서 낱말 하나로 자동 등록분이 되돌려질 수 있었다(10-01 사고와 같은 길). → softEq(로봇 모드에서는 경고만).
③ 수집일 '이틀'이 폰과 대조되지 않았다(하루·이틀 반이어도 초록). → 경계 표본을 폰과 서버에 함께 돌린다.
④ 배포 직후 첫 회차는 옛 장부라 주소만 바뀐 글로 학교를 깨울 수 있었다. → planAt 이 없으면 그 회차만 새 글 사유를 세지 않는다.
⑤ 매일 확인이 lastRun 하나만 봐서 08:10 발송의 '한 대도 안 받음'이 20:10 '없음' 회차에 가려졌다. → lastSentRun.
교훈:
- 계산 시간 한도가 있는 코드는 '처음 한 번(새 프로세스)'으로 잰다. 같은 프로세스에서 되풀이해 재면 정규식·함수가 데워져 절반으로 보인다. 일을 옮길 때는 옮겨 받는 걸음도 같이 잰다.
- 관문이 문서 글자를 재면 그 관문을 같이 쓰는 로봇의 결과를 되돌릴 수 있다. 문서는 softEq 로 감싼다.
- 서버 상태를 바꾸는 배포는 '배포 직후 첫 회차'와 '옛 코드로 되돌리기'를 표본으로 둔다.

### insta
BACKFILL:
- node insta/ledger.mjs expire  ← 선택 사항(앞 수리의 소급 · 그대로 유효). 다음 인스타 준비 실행(수집 로봇이 끝날 때마다 · 늦어도 매일 09:13 KST)의 '마감 지난 카드 정리' 단계가 스스로 한다. 마감 지난 준비·건너뜀·실패 카드를 expired 로 바꾸고(이번 수리로 expiredFrom 도 남긴다) 폴더를 지운다. 올린 것과 폴더 이름 꼴이 아닌 코드는 지우지 않는다. 바로 줄이려면 최신 기본 브랜치에서 `bash tools/robot-run.sh node insta/ledger.mjs expire` 로 돌리고 insta/seen.json·insta/pub 을 커밋한다. 이번 수리에는 따로 고칠 데이터가 없다 — 병합 규칙·장부 줄 모양·주소 시한은 다음 실행부터 저절로 적용된다.
CLAUDE.md:
- - **인스타 카드에 상대 날짜 금지 · 게시 거절은 `publishRefusal` 한 곳**(마감 지남 · 2026-10-04 전에 그린 2·3·4번 옛 「마감 D-N」 카드) — 화면 `instaPublishBlock` 은 짝(같은 시각 잣대). 관문 `verify/health-gates/insta.mjs` ①.
- - **인스타 장부 `insta/seen.json` 은 `mergeInstaSeen`**(올림 기록 절대 안 버림 · 일반 seen.json 규칙보다 앞) · 대기줄은 작업별(같은 공고끼리만 한 줄) · 게시 작업은 main 에 안 올린다 · 올린 뒤의 멈춤은 「다시 게시하지 마세요」. 관문 같은 파일 ②④.
- - 마감 지난 준비 카드는 준비 실행마다 `insta/ledger.mjs` expire(규칙 `expireRows`)가 만료·폴더 삭제(올린 것 제외). 관문 같은 파일 ⑦.
- - **인스타 카드 그림에 상대 날짜(`마감 D-N`·`오늘 마감`)를 박지 않는다**(그림은 굳는다 · `ddText` 는 'M월 D일 마감'). 마감 지난 카드·옛 D-N 카드(2026-10-04 전 2·3·4번)는 게시 거절 — `publishRefusal`↔관리자 `instaPublishBlock` 짝. 관문 「로봇·도구 점검 관문」 `verify/health-gates/insta.mjs` ①.
- - **인스타 대기줄은 작업마다**(같은 공고끼리만 `insta-code-<코드>` · 워크플로 단위로 되돌리지 말 것). 장부 `insta/seen.json` 은 `mergeInstaSeen`(일반 seen.json 규칙보다 앞 · 올림 기록은 code·media 로 · 안 버린다) · 게시 작업은 main 에 안 올린다. 관문 같은 파일 ②④.
- - **인스타 장부 줄·정리·올림 기록은 `insta/pick.mjs` 한 곳**(`preparedRow`·`expireAndClean`·`recordPosted`) — ledger·revise·publish 가 불러 쓴다. 관문은 그 명령을 임시 폴더에 복사해 실제로 돌린다(글자로 재지 말 것). 같은 파일 ①-e·②-e·⑦-d.
- - **마감 지난 인스타 카드는 준비 실행마다 '만료'로 바꾸고 폴더를 지운다**(`node insta/ledger.mjs expire` · 올린 것은 안 지운다 · 사람이 건너뛴 카드는 마감이 미뤄져도 다시 안 그린다 `expiredFrom`). 「이 기기에서 배포」 가 run-notify.txt 를 올리면 알림까지 깨운다. 관문 같은 파일 ⑦⑨.
- - **데이터 관문에서 도는 health-gates 묶음은 워크플로·문서 글자를 `softEq` 로 잰다**(로봇에선 경고만 · 로컬·verify-ui 는 실패 · 단계는 id 로 찾는다). 순수 함수·진짜 명령 표본은 어디서나 엄격. 관문 「로봇·도구 점검 관문」 alerts ⓪.
HUMAN:
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
SESSIONS: 2026-10-05 로봇·도구 점검 — 묶음 insta 리뷰 수리 (fix/insta-2 · 12ffd5b1 · 21f7b252).

리뷰가 찾은 것:
- 관문이 수집 로봇의 데이터 관문 안에서 도는데도, 스킬 문서 글자와 워크플로 단계 이름을 엄격하게 쟀다. 그래서 문구 하나만 바뀌어도 그 실행의 자동 등록분이 되돌려질 수 있었다(servers R2 와 같은 결함).
- 장부 줄의 dates 배선·정리의 폴더 지우기·장부 저장·before= 순서는 글자 검사이거나 표본에 기대고 있었다. 변이 M4~M8 이 전부 초록이었다. 특히 dates 가 빠지면 새로 그린 2·3·4번 카드 전부(준비 줄의 약 68%)가 관리자 화면에서 '옛 카드'로 영구히 막힌다.
- 사람이 건너뛴 카드도 마감이 지나면 만료되고, 재단이 마감을 미루면 다시 그려져 담당자 셋에게 알림이 다시 간다.
- 게시물 주소 묻기에 시한이 없었다. 올린 뒤 거기서 멈추면 장부에 올림 기록이 안 남는다.
- 준비 실패 이슈가 열려 있으면 이번 실패의 NOTE(알림이 못 간 카드)가 사라졌다.
- 올림 기록 병합이 공고 코드 하나로 줄여, code 없는 줄과 한쪽 안의 이중 게시 기록을 버릴 수 있었다.
- 실패 알림 문구 둘이 확인하지 않은 원인을 단정했다('첫 🚨 줄이 이유' · '시한에 끊겨').

고친 것:
- 워크플로·문서 글자 줄은 softEq(eqWf·eqDoc)로 잰다. 단계는 id 로 찾는다.
- 장부 규칙을 pick.mjs 한 곳(preparedRow · expireAndClean · recordPosted)으로 모았다. 관문은 ledger.mjs·revise.mjs 를 임시 폴더에 복사해 진짜로 돌린다(revise 는 가짜 render).
- 만료 줄에 expiredFrom 을 남기고, 건너뛴 카드는 다시 뽑지 않는다.
- device-deploy 는 before 가 비면 조용히 넘기지 않고 실패로 끝내 경보를 낸다.
- 주소 묻기에 30초 시한을 두었다. 「올린 기록 저장」 이 media 번호로 ledger.mjs posted 를 부른다.
- 준비 실패는 열린 이슈에 댓글로 남긴다.
- 올림 병합 열쇠는 code·media 다.
- 문구 둘을 사실대로 고쳤다.

red-green: 24건.
남은 것(계획 4): #263 닫기 · 첫 준비 실행 뒤 정리 건수와 닫은 이슈 번호 보고 · insta-5 결정.

### admin
BACKFILL:

CLAUDE.md:
- - **관리자 버튼으로 많이 지울 때**(5건 초과 또는 목록 10% 초과) 지울 건수를 숫자로 한 번 더 받는다 — 문턱은 `tools/edit-diff.mjs` `needsBulkExpect` 한 곳(화면·저장소 공용 · 숫자를 화면이 미리 채우지 말 것). 관문 「로봇·도구 점검 관문」(admin) · `verify-admin.js`.
- - 🔴 **관리자 조정·수집 로봇 「지금 실행」은 수집 대기줄(group: collector)에 기다리는 실행이 있으면 보내지 않는다** — 새 실행이 기다리던 실행을 시작 전에 취소한다. 목록 `COLLECTOR_QUEUE` 는 관문이 워크플로와 대조 · 줄을 떼지 말 것(registered.json 은 병합 규칙이 없다).
- - 관리자 조정 실패 문구는 실행의 단계 결과와 거절 문장(`관리자 조정 실패 — …`)으로만 말한다(`runFailureText` · 단계 이름은 admin-apply.yml `name:` 과 글자까지 같게 · 관문 대조). 저장 여부를 모르면 '확인하지 못했습니다'.
- - 🔴 `node --check _admin/admin.js` 는 모듈로 재지 않아 같은 이름 두 번 선언도 통과시킨다 — 관문 「로봇·도구 점검 관문」(admin)이 .mjs 사본으로 잰다. 시험 실행은 admin-apply.yml `dry_run`(적용+감사까지만 · 저장·이슈 없음).
HUMAN:
- Cloudflare Pages → hanggonggan-admin → Settings → Build → Build watch paths 의 Include paths 를 _admin/README.md 「빌드 감시 경로」 16줄로 갱신(빠져 있던 일곱: form-plan.js · collector/deadline-hint.mjs · collector/notice-source.mjs · collector/canon-url.mjs · collector/page-boilerplate.mjs · collector/news-kind.mjs · tools/edit-diff.mjs). 이 샌드박스에서는 실제 Cloudflare 설정을 확인할 수 없었다.
- 관리자 GitHub 열쇠(fine-grained)가 2026-11-07 에 만료된다(노션 F-4) — 그 전에 새로 만들어 관리자 화면 입장 때 넣고, 만료일 칸도 적어 두면 14일 전에 「할 일」에 뜬다. 학생 앱·로봇은 이 열쇠를 쓰지 않는다.
- admin-F10 시험 실행(오케스트레이터 몫): 이 묶음이 기본 브랜치에 올라간 뒤, 수집 줄에 기다리는 실행이 없는지 먼저 보고(`gh api 'repos/seonju5543-web/hanggonggan/actions/runs?status=pending' --jq '.workflow_runs[].path'` 와 status=queued 가 collect-scholarships·browser-collect·open-api·refresh-majors·refresh-tuition·admin-apply 를 하나도 안 보일 때) `gh workflow run admin-apply.yml --repo seonju5543-web/hanggonggan --ref claude/nice-heisenberg-WESq5 -f action=confirm -f payload='{"ids":["<검수 전 공고 id 하나>"]}' -f dry_run=true` — 기대: 요청 내용 적용·데이터 감사 성공 · 「시험 실행」 단계가 바뀔 파일(data/registered.json·data/admin-log.json)을 보이고 저장·이슈 없음. ⚠️ 시험 실행도 같은 수집 줄에 서므로 줄에 기다리는 로봇이 있을 때 누르면 그 실행을 취소시킨다.
- 관리자 화면에서 실제로 6건 이상 되돌리기를 한 번 눌러 숫자 칸 → 반영 완료까지 확인(버튼 길은 08-09 이후 Actions 에서 돈 적이 없다 · 이번 검증은 가짜 응답의 브라우저 드라이버까지).
SESSIONS: 2026-10-05 로봇·도구 점검 admin 묶음 재시도 — 앞 시도가 사용 한도로 끊겨 작업 트리에 남긴 변경을 salvage/admin(WIP 미검증)으로 보관해 두었고, 이번 회차가 fix/admin-2 에서 합쳐 검증했다. 사고 하나를 막았다: WIP 의 실패 문구 표 `const STEP = {…}` 이 같은 파일 1917행의 `const STEP = 50`(목록 한 번에 보일 줄 수)과 이름이 겹쳐, 관리자 화면이 '이미 선언됨' 오류로 열쇠를 넣어도 본 화면이 아예 뜨지 않았다. 관문(정규식 대조 11줄)은 전부 초록이었고 `node --check _admin/admin.js` 도 exit 0 이었다 — .js 확장자라 Node 가 모듈로 재지 않고 넘어간다(.mjs 사본이나 --experimental-default-type=module 로 재면 SyntaxError). 브라우저 드라이버(verify-admin.js)가 입장 단계에서 시한 초과로 잡았다. → APPLY_STEP 으로 이름을 바꾸고 관문에 '모듈 문법' 줄을 더했다(red-green 확인). 교훈: 글자 대조 관문이 초록이어도 화면은 죽어 있을 수 있다 — 화면 파일을 고치면 드라이버를 반드시 돌린다. 함께 고친 것: 실패 문구가 확인하지 않은 원인을 단정하던 두 곳(거절 문장 없이 '요청을 받지 않았다' · 단계 목록 없이 '데이터는 바뀌지 않았다'), 로봇 탭 「지금 실행」도 수집 대기줄을 보게(같은 원인), 관리자 도구 파일 대조를 로봇 워크플로에서 건너뛰지 않고 경고만(softEq — 다른 묶음과 같은 잣대).
