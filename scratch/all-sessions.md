
### gate
## 2026-10-04~05 데이터 관문 되돌리기 구조 (점검 묶음 gate · 리뷰 반영)

무슨 일이 있었나: 10-03~04 에 같은 자동 등록 8건이 실행마다 '등록 → 데이터 관문 빨간불 → 되돌림'을 되풀이했다. 원인은 test-collector 의 실데이터 단정이었다(06a34cc7 이 고쳤다). 옛 되돌리기(revert-auto)는 새 자동 등록분만 빼고 관문을 다시 재지 않았다. 그래서 원인이 기존 항목이면 관문이 실패한 상태 그대로 저장됐다(a31a8538 · b364d997). 링크 사냥꾼은 결과를 버리고도 초록불이었고, 알림은 '"수집 리포트"' 부분 일치로 다른 로봇 이슈(#381)에 붙었다. 같은 묶음의 DAAD 「학사 및 석사과정 학생」은 학부생에게 틀린 미달로 보였다.

고친 것(fix/gate): collector/gate-guard.mjs(단계별 되돌리기 + 다시 재기 · reverted-auto/reverted-files/still-failing/flaky · 리포트 단락) · auto-held.mjs(두 번 걸리면 3일 쉼) · source-rules.cjs(출처 규칙 한 곳 · 감사 오류 · 관리자 저장 전 거절) · entry-rules checkEntry '화면 문구 끝 날짜 = 마감' · 실데이터 단정 톱니 · 등록금·학과 갱신 로봇 저장 전 관문 · 알림 검색어 · 양식 대기열 고아 정리 · UNDERGRAD_TOO/degreeRest.

리뷰에서 나온 것(10-05 반영): ① 관문이 감사가 `SR.…Problems(` 를 부르는지만 봐서 errors.push → warns.push 로 바꿔도 초록이었다 — 감사의 일을 auditSourceFiles 하나로 모으고 '오류에만 넣는가'를 주석 걷은 소스로 잰다. ② 리포트에 지난 실행 제목이 남으면 첫 제목을 '되돌림'으로 고쳤다 → 마지막 제목. ③ 집계 사이트 규칙이 감사에서 안 돌았다 → 감사가 link-fix.mjs 의 정규식을 require(esm)로 받는다(정규식은 브라우저가 바로 import 하는 파일이라 그 자리 그대로). ④ deep-fetch.yml 에 맨 '"수집 리포트"' 검색이 남아 있었다 → 관문이 워크플로 전부를 본다. ⑤ 톱니가 path.join(ROOT, 'data/…') 꼴과 도구가 대신 읽는 곳을 못 셌다 → 꼴 추가 + TOOL_READS_ALLOW. ⑥ 쉬기 장부에 끝내 등록되지 않는 id 가 영영 남았다 → 30일 넘은 줄은 지운다 · 리포트에 '데이터 관문 쉬기' 묶음을 따로 둔다(원인을 단정하지 않는 문구). ⑦ 닿지 않는 갈래를 정리했다. ⑧ 낡은 주석을 고쳤다.

교훈: '함수를 부르는가'만 보는 정적 관문은 '결과를 어디에 넣는가'를 놓친다 — 결과의 행선지(errors)까지 잰다. 고친 뒤에는 리뷰어의 변형(warns.push)을 그대로 넣어 빨간불을 확인한다. 관문 위치: verify/health-gates/gate.mjs ①~⑥.

### feed
2026-10-05 · 피드 메우기 리뷰 2차(묶음 feed). ① 메우기의 🔁 숫자가 학교별 파일 상한을 몰랐다. healFromLedger 는 메운 글을 자르기 전에 셌고, 발행(splitBySchool)은 학교당 60건에서 자른다. 그래서 60일 안 장부 글이 60건을 넘는 학교(계명 246 · 가천 215 · 서울과기 165)에서는 같은 글이 매 실행 '다시 실었다'로 세였다. 기본 브랜치 데이터를 FEED_HEAL_SINCE 가 안 걸리는 11-28 뒤 모양으로 돌리면 매 실행 152건이고, 학교별 파일 변화는 0이었다. 지금은 정렬한 뒤 같은 함수로 미리 잘라 보고, 파일에 들어가는 새 칸만 싣고 센다. 관문 feed ① ⓖ. ② 정렬 단언이 무력했다. 표본의 장부가 이미 최신순이라 정렬을 지워도 초록이었다. 오래된 글이 먼저인 표본을 더했다. ③ heal-feed.mjs 는 '수집기와 같은 차례'라고 적었지만 60일·첨부 거르기를 빼먹었다. 이제 같은 거르기를 걸고, 관문이 두 수집기 '앱 발행' 단락의 공통 함수 차례와 글자로 대조한다. 기본 브랜치와 합치면 stripSiteChrome 때문에 일부러 빨개진다. ④ 0건 날에는 🔁·🙋 줄이 report.md 에만 남았다. 이제 0건 코멘트에 붙는다(장학 수집만 · 브라우저형은 0건 코멘트 단계 자체가 없다). ⑤ 메운 글의 javascript: 첨부는 resolveJsDownload 로 못 푼다. 서울과기 17건은 옛 수집기가 'javascript:downloadfile(' 에서 자른 것이고, 동국 WISE 는 호스트(wise.dongguk.ac.kr)가 규칙에 없다. 모의로 25건 중 0건이 풀렸다. 푸는 길은 원문을 다시 읽는 것(8cb1f746 방식)뿐이다.

### bodies
2026-10-05 로봇·도구 점검 bodies 묶음(자격요건 로봇·본문·첨부·OCR) — 사고 기록. ① 자격요건 로봇 run 37160846656(#53, 10-03 23:09Z)은 넷째 공고(서울대)에서 브라우저 호출 하나가 돌아오지 않아 '본문 재수집' 단계가 11분 시한에 잘렸다. 끝에서 한 번만 저장하던 탓에 이미 받은 3건까지 잃었고, 저장 커밋은 act-browser.json 한 파일뿐이었다(장학 쪽 #50~#53 4회 연속 0건). 그런데 그 단계가 continue-on-error 라 작업은 success → 실패 알림이 안 갔고 하트비트도 성공으로 셌다. 잡 정리 로그의 'Terminate orphan process (node)'로 보아 단계 시한 뒤에도 node 가 살아 있었다 — 신호 처리기로는 저장을 못 살린다. 수리: 한 공고 절대 시한 · 공고마다 저장 · 감시 타이머(10분 30초에 스스로 저장 후 종료 1) · 원자적 저장 · 저장 뒤 '끝까지 못 갔으면 실패' 단계. ② 실패 이슈 #378 에 9-30 판 리포트가 붙어 '경희대 공고 4회째 본문 없음'처럼 읽혔다(실제로는 넷째 공고에서 멈춤) → 알림은 이번 실행 리포트만 붙이고, 성공하면 옛 실패 이슈를 닫는다. ③ 같은 세 건이 매 실행 맨 앞을 차지했다(성공하면 장부 칸을 지워 tries 0 으로 돌아감) → 확보 날짜를 남기고 이레 쉰다 · 마감 지난 공고 제외. ④ 자격용 첨부 받기는 앞 6건을 매 실행 다시 받으며 파생 글자를 지웠고 뒤의 18건은 한 번도 안 받혔다 → 서명으로 받은 그대로 건너뛰기. ⑤ 증분 받기에서 '받았지만 껍데기' 110건이 실패로 안 세어져 매 실행 앞자리를 차지해 브라우저 수집 단계(3분)가 잘렸다 → 껍데기도 센다 + 받기 예산. ⑥ PaddleOCR 이 클라우드(x86)에서 모든 그림에 ConvertPirAttribute2RuntimeAttribute 오류로 0장인데 `|| true` 가 삼켜 초록불이었고 글마다 두 번뿐인 무료 기회가 깎였다 → 판 고정(다른 세션 30e214b4) + 종료 2·경고·기회 되돌리기·장부 판 이동. ⑦ 관문 교훈: 워크플로 스크립트를 글자로만 재면 핵심 조건(옛 판 리포트 안 붙이기)을 지워도 통과했다 — github-script 는 가짜 github/context 로 진짜 돌려 잰다. 이 관문은 수집 로봇의 데이터 관문(test-collector) 안에서도 돌므로 시간에 기대는 표본은 넉넉한 여유를 둔다.

### browser
2026-10-05 로봇·도구 점검 3단계 browser 묶음 — ① 브라우저 수집 건강 장부가 '후보 하나라도 열렸나'만 봐서 장학 0건 학교(홍익·시립 10-02~04)와 예산으로 건너뛴 학교도 매일 lastOk=오늘이었고, 장부를 일반 로봇과 같은 줄(학교 이름)로 쓰는데 일반 로봇이 매 실행 fails 를 0 으로 되돌려 서울대가 10-01~05 매 실행 7분 30초 멈춰도 연속 실패 경보가 한 번도 안 떴다(collect.mjs 주석 '섞이지 않는다'는 틀렸다) → browser-health.mjs 한 곳 + 제 칸 browserFails · 0건 날에도 코멘트. ② 계명 page.jsp 의 pageRef(목록 첫 글 번호)가 새 글마다 바뀌어 목록 40건이 통째로 '새 글'로 다시 들어옴 → VOLATILE 두 목록 + rekeyLedger(장부 잇기). 소식 썸네일 장부도 같은 열쇠라 옮기지 않으면 같은 사진이 '두 글의 공통 그림'으로 막힐 뻔했다(명세 밖에서 찾음). ③ 후보를 다 열고 읽은 것을 버리던 harvestTarget 이 숙명 둘째 후보(학교 첫 화면)의 수상 소식을 장학으로 실었다 → 읽히면 멈춤 · 일반 로봇이 ✅ 인 서울대·서강·숙명·가천·홍익을 보관. ④ 활동·재단 출처는 health.json 에 못 넣어 연속 실패 장부가 아예 없었다 → source-health.json. ⑤ 명세 B2·B3(홍익·시립 주소)는 같은 날 다른 세션 1a09466c 가 이미 고쳤고, 명세의 ⛔ 다섯은 robots.mjs 별표 해석 수정 뒤 둘(+재단 하나)로 줄어 있었다 — 명세 숫자를 그대로 믿지 말고 최신 리포트로 다시 잴 것. ⑥ red-green 에서 병합기 표본(최근 성공 쪽이 횟수도 작은 꼴)이 '작은 쪽' 규칙을 지워도 통과해 표본을 바꿨다. ⑦ 작업 중 실수: 첫 커밋에서 중간 판 파일 복사가 샌드박스에 막힌 걸 모르고 최종 판을 묶어 커밋했다 → soft reset 으로 되돌리고 다시 나눔(푸시 전).

### qnotice
2026-10-05 qnotice 리뷰 수리 (fix/qnotice-2). The reviewer found two blockers that would have turned the next robot run's data gate red or let past rounds spread nationally. Both were reproduced on a temp copy of real data before fixing.
(1) PORTAL_SYSTEMS gained KUPID. test-collector 「등록 데이터에 근거 없는 포털 단정이 없다」 used a hand-written word list containing only '포털'. So the 「포탈(KUPID) - 학사행정 - …」 that extract-excerpts would fill on the next run counted as having no evidence. Running extract-excerpts --write and then test-collector gave ✕. In the data gate, gate-guard would have restored registered.json to its previous version on every run, so the backup-email cleanup for the 10-12·10-13 deadlines, the late-drop removal and new auto registrations would never have been saved. Fix: the evidence words live in one place, apply-channel.js hasPortalName (system table plus common names), and test-collector calls it.
(2) Removing items 'registered after the deadline had passed' also removed the twin that had been holding the same program's posts at other schools. On real data: dropping 세종대 K-원전 (deadline 9/28) registered 부산대's post for the same program (seq700) with no deadline. 동국대's post then promoted it to national, and alsoPostedAt kept it from ever being removed again, leaving a '마감' card for 30 days at all 44 schools. Fix: past-round ledger collector/past-rounds.json (60 days). Same-program matching uses the same three tests as classify, because 세종↔부산 have different programKeys and match only by name. Those posts go to hold for confirmation.
Lesson: when you add an entry to a table, check every check that reads the same concept from its own hand-written list. When you remove items, remember the job they were doing as a twin.

### qfeeds
2026-10-05 qfeeds 묶음(소식·재단·대외활동 글 품질) — 경위.
① 재단 '마감 지남' 거름을 넣자 test-collector 의 실데이터 관문 「저장된 data/external.json 이 이미 걸러져 있다」가 지금 데이터(7~9건) 때문에 빨개질 참이었다. 이 관문을 데이터 관문으로 쓰는 소식·장학 로봇이 제 결과를 버리는 그 꼴이다. 명세는 같은 커밋에 데이터 백필을 넣으라 했지만, 이 점검은 로봇 데이터 손편집이 금지라 06a34cc7 처럼 audit-data.js 경고로 옮겼다(실데이터 읽기 톱니 external 2→1). 백필은 tools/refilter-feeds.mjs.
② 「뺀 게시판의 소식」 열쇠(boardKey)는 news-kind.mjs 가 아니라 news-board-rules.mjs 에 뒀다. news-kind.mjs 는 관리자 화면이 브라우저 vendor 로 불러, node:crypto 를 넣으면 관리자 화면이 통째로 죽는다(2026-09-13 '빠진 이웃' 사고와 같은 꼴).
③ api-11 명세 표본은 옛 slice 로도 통과했다. red-green 이 잡아 표본을 고쳤다(검사가 조용하면 무력부터 의심).
④ news-13 장부 정리에 명세에 없던 막기를 더했다. 이번에 목록을 못 읽은 게시판의 열쇠는 지우지 않는다. 날짜 없는 고정 글이 그 게시판이 한 번 실패한 날 '새 글'로 다시 실릴 수 있어서다.
⑤ 관문이 진짜 로봇을 돌린다: collect-news 는 예산 0 과 127.0.0.1 가짜 게시판, find-boards 는 닫힌 포트, open-api 는 열쇠 없이 --dry-run, 병합기는 .gitattributes 전부. 밖으로는 나가지 않는다.
⑥ 작업 트리가 기본 브랜치 끝(d6fd00f6)에서 만들어져 있었다. fix/qfeeds 는 명시적으로 6f2a7c40 에서 만들고 fix/qnotice-2 로 빨리 감기했다.

### links
2026-10-05 links 묶음 리뷰 3건 (fix/links · 6d39bd3a · 45489820 · efa2fb1a)
① 퇴행(major): 같은 게시판 글이 한 id 를 받던 문제를 links-new-1 에서 꼬리표 id 로 풀었다. 그런데 꼬리표 id 는 '그 옛 id 를 쥔 등록분이 있을 때만' 붙어 고정되지 않는다. 관리자 「차단 풀기」로 옛 id(예: 서강대 'auto-amepagescholarshipnotice')를 풀면, 그 옛 id 로 계산되는 막은 주소가 전부 지워졌다. 이때 같은 게시판에서 꼬리표 id 로 따로 되돌린 글의 주소도 함께 지워졌고, 그 글은 다음 실행에 옛 id 를 받아 다시 등록됐다(사본 저장소에서 재현 · 원칙 2 위반). 고친 것: registerId 가 꼬리표 꼴 차단(blockedTagged)을 함께 알려 주고, 자동 등록은 막음·쉬기에서 두 꼴을 다 본다. 차단 풀기는 남은 차단 id 가 그 주소의 꼬리표 꼴이거나 남은 차단 id 의 짝(blockPairs)이면 주소를 남긴다.
교훈: 열쇠가 상황에 따라 바뀌면, 그 열쇠로 하는 막음·풀기·쉬기는 열쇠의 모든 꼴을 봐야 한다. 관문은 '되돌림 → 풀기 → 다시 실행' 처럼 사람의 실제 순서로 잰다.
② 관문 공백(minor): '같은 글 · 주소만 다름' 갈래를 if (false) 로 꺼도 관문이 초록이었다. 자동 등록 사본 실행에 숭실 꼴 표본을 더했다.
③ 원인 단정(minor): 게시판이 안 열린 표적의 장부 문구 '게시판 열기 실패: …' 가 관리자 「죽은 링크」 거름('실패')에 걸렸다. 그대로 두면 학교 서버가 잠깐 안 열린 것만으로 그 게시판의 표적 전부가 죽은 링크로 보였을 것이다(실행 전에 리뷰에서 잡음). 문구를 boardUnreachableWhy 한 곳('게시판을 못 엶 — 내일 다시 봄 (오류)')으로 옮기고, 관문이 admin.js 의 거름을 읽어 와 대조한다.

### ci
2026-10-04~05 · 화면 검사(verify-ui) 그물 걷힘 — ci 묶음 (수리 1차 + 리뷰 2회)
· 사고: 10-03~10-04 verify-ui 연속 빨간불(#383 → #389·#390). 원인 둘이 겹쳤다 — ① verify-registered.js 가 '이 학생에게 보이는 마감 전 양식 공고'를 실데이터에서 못 찾으면 빨개졌다(데이터 탓) ② 화면 검사 단계가 `set -e` + 맨몸 node 라 하나가 넘어지면 뒤 드라이버 22개와 말투·토큰·수집기 규칙·전 여정이 통째로 건너뛰어졌다(run 37193935701) — 그 사이 들어온 토큰 위반(ui-tone 76/75)이 CI 에 한 번도 안 보였다.
· 수리 1차: 표본 고르기를 순수 함수(verify/open-form-sample.cjs · 앱 내장 양식 폴백)로 · 실패를 모아 끝에 한 번 · 뒤 단계 !cancelled() · device-deploy 뒤 verify-ui 깨우기 · 모르는 자기소개서 칸은 데이터 감사 경고(양식 로봇은 kind 를 안 달아 리포트에 걸면 영영 안 울린다 — 09-29 를 멈춘 칸도 세션이 손으로 옮긴 f4438304 의 칸).
· 리뷰 1차: 같은 구멍이 한 단계 위에 남아 있었다(앞의 값싼 관문 하나가 넘어지면 드라이버 전부 건너뜀 · 경보가 '실패한 드라이버: 없음'이라고 0개 돈 것을 다 통과한 것처럼 적음) → 구간 전체 !cancelled() · 경보 세 갈래 · 경보 셸을 가짜 gh 로 실제로 돌려 잰다.
· 리뷰 2차(이번): ⓐ 관문이 드라이버 루프를 **글자로만** 봐서, 루프 줄을 `|| echo "❌ $f"` 로 바꿔 화면 검사가 영구 초록불이 되어도 통과했다(실측 재현) → 루프 셸도 bash -eo pipefail 로 실제로 돌린다(가짜 node·timeout · 빈 임시 폴더 · 임시 GITHUB_OUTPUT). ⓑ 표본 배선 검사가 return 줄만 세서 `if (ids.length && shouldPlantSample(…))`(10-04 사고 그대로)를 못 잡았다 → driveAnyLiveForm 을 가짜 page(vm)·driveOneForm 으로 실제로 돌린다. ⓒ 드라이버마다 5분만 있고 루프 예산이 없어 26×5분이 30분 그릇을 넘으면 '취소'로 끝나 경보가 안 뜰 수 있었다 → 루프 예산 20분(넘으면 남은 이름 `unrun` + 실패 · 드라이버 시한 ≤ 남은 예산 · 경보가 '돌리지 못한 드라이버'를 따로 적는다) · 전 여정 5분 · 작업 상한 30 > 20+5+3 을 관문이 잰다. 근거: 마지막 성공 실행의 화면 검사 단계 13분 34초(run 37227739276).
· 교훈: 셸·워크플로 동작을 지키는 관문은 **글자 대조가 아니라 실행**이어야 한다 — 막으려는 최악(조용한 초록불·조건 감싸기)은 글자를 그대로 남긴 채 들어온다. 그리고 작업 상한은 '모든 단계 시한의 합'을 담아야 한다(드라이버별 시한만으로는 합이 안 잡힌다).

### alerts
2026-10-05 로봇·도구 점검 alerts 묶음 — 코드 리뷰 3차 재수리. ① 직전 수리(b0170322)는 S3 의 '조건 글자가 같아야 한다'만 풀었다. 같은 결함이 ⑧(collect-news)·⑫(link-hunter·audit-coverage)·⑩ 의 '실패 단계는 robot-down 하나뿐'(개수 판정)에 남아 있었다. 다른 세션이 '못 넣은 수집분 보관(if: failure() · upload-artifact)' 단계 하나만 더해도 ✕ 가 났고, test-collector 는 모든 수집 로봇의 데이터 관문에서 돌아 모든 로봇 결과가 되돌려질 뻔했다. 고침: '실패·취소를 좁히지 않고 덮는 robot-down 이 있는가'(coversDown · broadFailKinds)로 잰다. 진짜 파일에 그 단계를 끼운 표본도 함께 잰다. ② 더 근본적으로, 워크플로 글자 관문 전부(S1~S4·각 로봇 절)는 로봇 워크플로에선 경고만 하고 로컬·verify-ui(DOC_GATES=1)에서만 실패한다(softEq — 문서 관문과 같은 잣대). verify-ui 감시 경로에 .github/workflows/** 를 더해 워크플로만 고친 커밋에도 엄격한 관문이 돈다. ③ S3 는 덮는 알림의 조건에 글자가 '들어 있기만' 하면 통과시켜, `failure() && …schedule` 처럼 좁힌 알림을 잡지 못했다. 이제 && 로 좁힌 갈래는 세지 않는다. ④ 교내 소식 로봇의 경보 여는 단계(continue-on-error 없음)가 관문·저장 앞에 있었다. 이슈 API 가 흔들린 날 그 실행의 소식이 저장되지 않을 수 있어 저장·리포트 뒤로 옮겼다. ⑤ 관문이 순수 함수만 재고 그 함수를 실제로 묶는 워크플로 줄은 안 재서, 변이 일곱이 초록이었다(device-deploy 모름=둠, check-live 출력 옮기기·조건부 break, insta LIVE 기본값, robot-down exit 0, admin-lock 미리보기 제외, 하트비트 못 읽음=모름). 줄마다 검사를 더했다. ⑥ 하트비트 닫기는 '번호가 더 크면' 경보 전에 이미 끝난 성공으로도 닫았고(가짜 API 재현), 수동 모의·부분 실행의 성공도 회복으로 셌다. 이제 경보 뒤에 끝난 성공만 세고, 예약이 있으면 예약 실행만 묻는다(event=schedule). 닫는 글은 확인한 만큼만 쓴다. 교훈: 관문이 개수·글자 포함으로 재면 무해한 편집에 헛빨간불이 나거나 좁힌 조건을 놓친다. 데이터 관문에서 도는 워크플로 글자 검사는 로봇 결과를 되돌리지 않게 경고로 두고, 엄격한 검사는 워크플로를 감시하는 코드 검사에 둔다.

### servers
2026-10-04~05 로봇·도구 점검 — 묶음 servers(푸시·접수·로그인 서버).
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
2026-10-05 로봇·도구 점검 — 묶음 insta 리뷰 수리 (fix/insta-2 · 12ffd5b1 · 21f7b252).

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
2026-10-05 로봇·도구 점검 admin 묶음 재시도 — 앞 시도가 사용 한도로 끊겨 작업 트리에 남긴 변경을 salvage/admin(WIP 미검증)으로 보관해 두었고, 이번 회차가 fix/admin-2 에서 합쳐 검증했다. 사고 하나를 막았다: WIP 의 실패 문구 표 `const STEP = {…}` 이 같은 파일 1917행의 `const STEP = 50`(목록 한 번에 보일 줄 수)과 이름이 겹쳐, 관리자 화면이 '이미 선언됨' 오류로 열쇠를 넣어도 본 화면이 아예 뜨지 않았다. 관문(정규식 대조 11줄)은 전부 초록이었고 `node --check _admin/admin.js` 도 exit 0 이었다 — .js 확장자라 Node 가 모듈로 재지 않고 넘어간다(.mjs 사본이나 --experimental-default-type=module 로 재면 SyntaxError). 브라우저 드라이버(verify-admin.js)가 입장 단계에서 시한 초과로 잡았다. → APPLY_STEP 으로 이름을 바꾸고 관문에 '모듈 문법' 줄을 더했다(red-green 확인). 교훈: 글자 대조 관문이 초록이어도 화면은 죽어 있을 수 있다 — 화면 파일을 고치면 드라이버를 반드시 돌린다. 함께 고친 것: 실패 문구가 확인하지 않은 원인을 단정하던 두 곳(거절 문장 없이 '요청을 받지 않았다' · 단계 목록 없이 '데이터는 바뀌지 않았다'), 로봇 탭 「지금 실행」도 수집 대기줄을 보게(같은 원인), 관리자 도구 파일 대조를 로봇 워크플로에서 건너뛰지 않고 경고만(softEq — 다른 묶음과 같은 잣대).

### refresh
2026-10-05 로봇·도구 점검 refresh 묶음(데이터 갱신 로봇) — ① 한국장학재단 공고문 사본: 첨부 주소 끝 encVal 이 상세를 받을 때마다 바뀌는데, 주소 전체로 '같은 파일인가'를 쟀다. 그래서 매 실행 사본 79곳을 전부 다시 받았다(첨부 리포트 네 번 연속 '이미 있던 것 0곳'). 열쇠를 서버 저장 이름(filename · 올린 시각 꼬리 포함)으로 바꿨다(kosaf-session attachKey). 옛 장부는 from 을 풀어 비교하므로 첫 실행부터 다시 받지 않는다. ② 수확 예산 시계가 목록 185쪽(2분) 뒤에 켜져 단계 상한까지 여유가 3분뿐이었다. 시계를 목록 앞에서 켜고, 새 상세는 최악 2분이 남을 때만 시작한다. ③ 학과·등록금 로봇이 수집 대기줄(collector)에 서 있어 예약 수집·관리자 조정을 취소시킬 수 있었고 넘어짐 알림도 없었다. 각자 줄로 옮기고 기본 브랜치 고정 체크아웃과 robot-down 을 붙였다. 관리자 COLLECTOR_QUEUE 도 같이 고쳤다. ④ 학과 로봇은 예약이 없어 08-06 로컬 실행 뒤로 한 번도 안 돌았고, 열쇠가 없어도 exit 0(초록)이었다. 2·8월 20일 06:29 KST 예약을 넣고, Actions 에서 열쇠가 없으면 ::error + exit 1 로 바꿨다. 달 칸 예약만 있는 워크플로는 하트비트가 판정하지 않으므로, 경보 닫기는 수동 성공도 회복으로 센다(successEventFor). ⑤ 연세 미래캠퍼스(서비스 학교)는 학과 파일이 없어 학생이 전국 공통 목록으로 조용히 물러나 있었다. 커리어넷 이름은 확인하지 못해 짐작해 넣지 않았다. 다음 실행이 campus_nm 까지 읽어 분교 이름 후보와 서비스 학교 빠짐을 collector/majors-report.md·::warning 으로 남긴다(실데이터라 관문이 아니다). 앱 학교 150곳 미만이면 저장하지 않는 바닥 검사도 넣었다. ⑥ 학교 사진 파일 이름(<학교키>-<번호>.jpg)은 다시 받으면 다른 사진이 된다(10-03 #6→#7 에 9개). 빌드가 이름만 봤으므로 고른 기록에 원본 title 을 적고 대조하게 했다. pick 46개에 소급했고, git 판 대조로 46개 모두 마지막 재수집 뒤에 골라졌음을 확인했다. 빌드 결과는 바이트까지 같았다. ⑦ 사진 수집 도구가 불러오기만 해도 위키미디어를 두드렸다. 한글 제목 40개 묶음이 414 를 냈고, Openverse 401 을 학교마다 다시 물었다(원인 미확인). main 가드 · 글자 6000 묶음 · 401/403 끄기로 고쳤다. ⑧ 작성 규칙의 시든 출처 둘(인크루트)은 seeds 에서 tried 로 보관했다. 관문 verify/health-gates/refresh.mjs ⓐ~ⓖ 는 표본만 쓰고, 21가지 되돌림 모두 ✕ 를 확인했다.

### ops
## 예약 지연 실측 (2026-10-04)
event=schedule 실행의 생성 시각을 gh api 로 다시 쟀다(로봇·도구 점검 ops-10).
- robot-heartbeat: 예약 08:29Z → 실제 12:15~16:51Z
- check-live: 04:11Z → 08:35~10:52Z
- deploy-sync: 03:23Z → 08:36~10:00Z · 07:23Z → 12:17~15:40Z
- collect-scholarships: 02:41Z → 08:33~09:02Z · 06:41Z → 11:59~13:51Z
- insta-comments(3시간마다): 09-12 이후 91회, 하루 약 4회(예정 8회). 최대 간격 9.7시간(10-01 00:40Z→10:21Z)으로 하트비트 문턱 9시간(3h×3)을 넘었다.
- 원인은 플랫폼 쪽이라 저장소가 줄일 수 없다. 수집→배포는 이미 workflow_run 사슬이라 늦어도 데이터 흐름은 안 깨진다.
- 실제 피해는 둘이다. ① 라이브 점검이 배포 직후에 돌아 헛경보를 냈다(#310·#384 는 사람이 닫음 · #350 열림 · run 36851872513 은 deploy-sync push 10:51:59Z → 점검 10:52:56Z, Pages last-modified 10:49:21). 이것은 alerts 묶음 ops-04 몫이다. ② 3시간 로봇의 하트비트 헛경보 → 문턱 바닥값 12시간(STALE_MIN_HOURS).
- 외부 깨우미(cron-job.org → workflow_dispatch)는 권하지 않는다. 열쇠 관리만 늘고 피해는 위 둘로 덮인다.

## ops 묶음 리뷰 (2026-10-05) — 관문이 글자만 보던 것 넷
- 노션 '브랜치' 칸은 HEAD 를 그대로 가리키는 브랜치만 봐서, 병합 커밋을 main 에 올린 push 에서 다시 main·기본 브랜치를 적었다(임시 저장소 재현). 이제 첫 부모 줄을 따라간다. 배포 감시 안내도 'push 마다 따로 합치기'에서 '⓪ 둘 다 합친 뒤 같은 HEAD 를 세 곳에'로 바꿨다.
- 겉옷(robot-run.sh)·정찰(probe-links.mjs)·노션 재시도의 관문은 글자가 있는지만 봤다. 변이 셋(`gh … || true` · lines 를 directives(cfg) 로 · 맨 fetch()이 모두 초록이었다. 이제 가짜 gh 로 실제로 돌려 보고, 줄 고르기를 순수 함수 하나로 옮기고, 배선을 대조한다.
- ops-14(액션 판 올리기)를 묶음 안에서 했다가 되돌렸다. 다른 사슬 셋이 github-script@v7 줄을 새로 더해, 합치면 엄격 관문이 반드시 빨개진다. 모든 묶음을 합친 뒤 마지막 한 커밋으로 한다.
