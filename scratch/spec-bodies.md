# 수리 명세 — 묶음 bodies

권장 순서: bodies/bodies-1 → bodies/bodies-4 → bodies/bodies-2 → bodies/bodies-7 → bodies/bodies-12 → gaps/gaps-02 → bodies/bodies-3 → bodies/bodies-5 → browser/B8 → bodies/bodies-6 → bodies/bodies-10 → browser/B7 → bodies/bodies-8
예상 손댈 파일: collector/rescue-bodies.mjs collector/rescue-plan.mjs .github/workflows/rescue-bodies.yml collector/paddle-ocr.py collector/activity-docs.mjs .github/workflows/collect-scholarships.yml collector/deepfetch.mjs collector/elig-attach-plan.mjs collector/notice-source.mjs .github/workflows/deep-fetch.yml collector/ocr-text.py .github/workflows/eligibility-fill.yml collector/browser-collect.mjs collector/html-text.mjs verify/health-gates/bodies.mjs verify/health-gates.mjs

검증 메모: 새로 확인한 핵심(진단 뒤 생긴 증거):
(1) 새 yml 로 처음 돈 run 37160846656(#53 · 10-03 23:09Z)도 4번째 서울대 공고에서 멈췄다. '본문 재수집' 단계는 11분 12초에 시한으로 죽었지만, 작업은 success 였고 이슈가 생기지 않았다. 커밋 187b430 은 act-browser.json 한 파일뿐이다. 이것으로 bodies-1·2·7 이 오늘 기준으로 증명된다. 잡 정리에서 'Terminate orphan process (node)'가 찍혔으므로 신호로 저장하는 방식은 쓸모없다.
(2) 지금 HEAD 에서는 서울대 공고가 일반 수집(10-04 02:11Z)으로 자격 줄을 얻어 대상에서 빠졌다. 다음 실행의 4번째는 건국대다. 같은 자리에서 다시 멈춘다는 보장은 없지만 구조적 결함은 그대로다.
(3) PaddleOCR 고장은 paddleocr 3.7.0 의 enable_mkldnn 기본값 True 와 맞아떨어진다. 다만 샌드박스는 모델 서버가 막혀 실행으로 증명하지 못했다. 수리 뒤 첫 실행 로그로 확인해야 한다.
(4) 자격 확보 현황(오늘): 160건 중 확보 102건 · 미확보 58건 · 원문 없음 41건.

충돌 주의: B7(browser-collect.mjs)은 other-session(source-link-integrity)이 바로 위 클릭 경로를 바꾸므로 맨 마지막에 하거나, 그 브랜치가 들어간 뒤 그 위에서 한다. verify/test-collector.mjs 는 손대지 않는다(다른 세션이 고치는 중). 관문은 verify/health-gates/bodies.mjs 와 PARTS 한 줄로만 더한다.

관문 파일 주의: deepfetch.mjs·rescue-bodies.mjs·browser-collect.mjs·auto-register 계열은 불러오는 순간 실행되므로 관문에서 import 하지 말 것. 그래서 순수 모듈(rescue-plan.mjs·elig-attach-plan.mjs)과 notice-source.mjs·html-text.mjs 의 순수 함수로 뺀다. activity-docs.mjs 는 ACTIVITY_DOCS_AS_LIB=1 을 먼저 둔다.

이번 작업에서 저장소는 고치지 않았다. 일회용 worktree(wt53)와 venv 는 지웠다. 기록은 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/verify-bodies/ 에 있다(pick.mjs · ptest*.log · pip.log).


---
## [bodies/bodies-1] P1 · confirmed

이유: 오늘 새 증거로 다시 확인했다. 새 워크플로로 처음 돈 run 37160846656(#53 · 10-03 23:09Z)도 똑같이 멈췄다. 로그 77~79행에서 같은 세 건(제주 미래이음·코나아이·경희꿈도전)에 ✅를 찍은 뒤 23:11:05 부터 아무 줄도 없다가 '##[error]The action '본문 재수집' has timed out after 11 minutes.'(23:21:28)로 끝났다. 저장 커밋 187b430 은 act-browser.json 한 파일뿐이라 장학 쪽은 4회 연속(#50~#53) 0건이다. 그 실행 판(5a3323dc)에서 pickTargets 를 다시 돌려 보니 4번째는 서울대 auto-0ec82aced95admoddocument 였고 주소는 이미 &uid=392 로 고쳐진 상태였다. 그러니 '&#038;' 은 원인이 아니고, 서울대 페이지 자체가 goto 뒤 어딘가에서 멈춘다. 잡 정리 로그의 'Terminate orphan process: pid (3060) (node)' 와 '(3071) (chrome-headless-shell)'은 단계 시한 뒤에도 node 가 살아 있었다는 뜻이다. 신호 처리기로는 저장을 못 살린다는 증거이기도 하다. 반박 시도: 지금 HEAD 에서는 일반 수집(10-04 02:11Z)이 서울대 본문을 얻어 그 공고에 자격 줄이 1개 생겼고 대상에서 빠졌다. 그래서 다음 실행의 4번째는 건국대 auto-kuk2351206961 이다(대상 51건). 바로 다음 실행이 같은 자리에서 멈춘다는 보장은 없다. 하지만 공고 하나에 걸린 절대 시한도 중간 저장도 없는 구조(rescue-bodies.mjs 138~301행 · 저장은 306행과 120~121행뿐)는 그대로다. link-check 판정으로 보면 다른 서울대 글도 느리거나 멈추므로, 서울대 자동 등록분이 대상이 되는 순간 다시 난다. 그래서 P0 대신 P1로 둔다.

수리 명세: [새 파일] collector/rescue-plan.mjs — 부르는 순간 아무것도 하지 않는 순수 모듈로 만든다. playwright 는 들이지 않는다(관문은 playwright 없이 돈다).
  · pickTargets(items, { ledger, today, now }): rescue-bodies.mjs 71~103행을 옮기고 장부와 오늘 날짜를 인자로 받는다. bodies-4 규칙도 여기에 넣는다.
  · NOTICE_MS = Number(process.env.RESCUE_NOTICE_MS || 60000)
  · async visitNotice(page, t, { noticeMs }): 지금 145~224행의 일(goto 30초 → 6초 대기 → 팝업 닫기 → 프레임 innerText → 첨부 링크와 큰 그림 걷기)을 한 덩어리로 묶는다. 덩어리 전체를 harvest-budget.mjs 의 withDeadline 으로 감싼다. 돌려주는 값은 { status:'ok'|'hung'|'error', text, finalUrl, found:[…], error }다. 🔴 t.it(등록 항목)은 여기서 고치지 않는다. 첨부 추가와 regDirty 는 부른 쪽이 status==='ok' 일 때만 한다. 그래야 시한 뒤 늦게 끝난 작업이 registered.json 을 몰래 바꾸지 못한다.
  · ledgerEntry(prev, outcome, { today, minBody, name }): 순수 함수. ok → { ok: today, at: today, tries: 0, name } · hung → { tries: prev.tries+1, at, minBody, hung: true, name } · miss → 지금(282행)과 같다 · gone → 지금(255행)과 같다.
[collector/rescue-bodies.mjs]
  · 공고를 시작할 때 log(`▶ ${이름}`)을 찍는다.
  · visitNotice 결과가 hung 이면 page.close().catch(()=>{})를 기다리지 않는다. 리포트에 '- ⏱ 이름 — 60초 안에 끝나지 않아 건너뜀 (n회째)'를 적고 장부에 hung 을 남긴다. 그다음 context 를 새로 만든다: withDeadline(ctx.close(), 5000) 뒤 browser.newContext(지금과 같은 UA·locale). !browser.isConnected() 면 다시 띄운다(activity-docs.mjs openBrowser 와 같은 꼴). 본문 판정을 건너뛰고 다음 공고로 간다.
  · 공고 하나가 끝날 때마다(성공·실패·삭제·멈춤 모두) saveAll()을 부른다. 리포트에는 그때까지의 줄과 '(진행 중 n/m)' 꼬리를 쓰고, 마지막 저장에서 합계 줄로 바꾼다. 🔴 SIGTERM 처리기로 대신하지 말 것. #53 에서 node 가 시한 뒤에도 고아로 살아 있었다 = 신호가 node 에 가지 않는다.
  · 예산 확인은 공고를 시작하기 전에 한다. harvest-budget.mjs makeBudget(BUDGET_MS).hasRoom(NOTICE_MS + 5000)이 거짓이면 멈춘다. 9분 + 공고 하나 최악 60초 + 저장 < 단계 시한 11분.
  · 끝의 browser.close()도 withDeadline(…, 10000)으로 감싼다. process.exit(0)은 유지한다.
  · 바꾸지 말 것: 대상 기준(requirementLines 가 비었을 때), 본문 판정은 notice-source.mjs 의 indexTexts·hasText 한 곳, 봇 차단 때 fetch 로 물러서기(20초 시한), 삭제된 공고 처리, REST_AFTER·REST_DAYS·minBody 재시도 규칙, registered.json 저장 형식(JSON.stringify(reg,null,1)+'\n' — 지금과 같게 · CLAUDE.md 매 세션 4), 워크플로 파일 이름(관리자 버튼이 부른다).

관문: verify/health-gates/bodies.mjs(새 파일) + verify/health-gates.mjs 의 PARTS 에 'bodies' 추가.
① 가짜 page 표본: goto 는 바로 끝나고, frames()는 가짜 프레임 하나다. locator('body').innerText 는 바로 끝나고 $$eval 은 영원히 끝나지 않는 Promise 다. withDeadline(visitNotice(page, t, { noticeMs: 50 }), 2000)을 부르면 결과가 TIMED_OUT 이 아니고 status==='hung' 이어야 한다. 그 뒤 100ms 를 더 기다려도 t.it.attachments 가 그대로여야 한다.
② 글자 검사: rescue-bodies.mjs 의 `for (const t of targets)` 본문 안에 visitNotice(·saveAll(·'▶' 가 있다.
빨간불 증명: visitNotice 안의 withDeadline 을 걷으면 ①의 바깥 2초 시한이 TIMED_OUT → ✕. 루프 안 saveAll 을 지우면 ② ✕. 실데이터(registered.json·장부)는 읽지 않는다.

소급: 데이터 손질은 필요 없다. 장부는 다음 실행에서 스스로 채워진다. 수리 뒤 첫 예약 실행(05:23·18:23 KST) 로그에서 '▶' 줄과 공고마다 저장되는지, '⏱' 처리를 확인한다.

파일: collector/rescue-bodies.mjs collector/rescue-plan.mjs

위험: other-session 브랜치는 rescue-bodies.mjs 를 건드리지 않는다(충돌 없음). 공고마다 saveAll 이 registered.json(약 수백 KB)을 최대 25번 다시 쓴다. 비용은 작다. 시한에 걸려 버린 페이지의 크롬 렌더러는 남을 수 있어 context 재생성은 꼭 해야 한다. 다른 세션의 실행 중인 브라우저 로봇과는 파일을 공유하지 않는다.

---
## [bodies/bodies-2] P1 · confirmed

이유: 예측이 아니라 이미 일어났다. 새 yml 로 처음 돈 run 37160846656(#53)에서 '본문 재수집' 단계는 23:10:16→23:21:28(11분 12초)에 시한으로 죽었다(로그 80행 ##[error] …timed out after 11 minutes). 그런데 continue-on-error 때문에 단계 결론도 작업 결론도 success 였다. '실패하면 이슈로 알린다'는 skipped 였고 10-04 이슈는 없다(rescue-bodies 라벨 열린 이슈는 #234·#337·#361·#378 뿐). robot-heartbeat.mjs 118·138행은 success 만 세므로, 열린 경보 #385('자격요건 매칭 … 85.7시간 전')는 다음 하트비트에서 스스로 닫히게 된다. 장학 본문 재수집은 0건인데 초록불이다. 이 저장소에는 같은 함정의 선례도 있다(browser-collect.yml 285~289행 · collect-scholarships.yml 81~86행은 steps.run.outcome 을 따로 본다).

수리 명세: .github/workflows/rescue-bodies.yml: '저장' 단계 뒤, '실패하면 이슈로 알린다' 앞에 단계 하나를 넣는다.
  - name: 본문 재수집 단계가 끝까지 못 갔으면 실패로 남긴다
    if: steps.rescue.outcome != 'success'
    run: |
      echo "::error::본문 재수집 단계가 ${{ steps.rescue.outcome }} 로 끝났습니다(단계 시한 11분에 잘렸거나 로봇이 넘어짐). 저장은 위에서 끝났습니다."
      exit 1
→ 작업 결론이 failure 가 된다. 그러면 바로 아래 failure() 알림이 이슈를 만들고, 하트비트도 이 실행을 성공으로 세지 않는다. robot-heartbeat.mjs 는 고치지 않는다. 바꾸지 말 것: '본문 재수집'의 continue-on-error(아래 대외활동·관문·저장이 돌아야 한다), 단계 시한 11분과 작업 시한 50분(test-collector 「자격요건 로봇」 ② 가 '작업 시한 > 단계 합 + 3'을 잰다 — 새 단계에 timeout-minutes 를 달면 그 합에 더해진다. 단다면 1 로 둔다), 대기줄 rescue-bodies.

관문: health-gates/bodies.mjs 글자 검사: rescue-bodies.yml 에 `if: steps.rescue.outcome != 'success'` 이고 `exit 1` 을 하는 단계가 있어야 한다. 그 위치는 '- name: 저장' 뒤이고 '- name: 실패하면 이슈로 알린다' 앞이어야 한다(indexOf 로 순서를 잰다). 빨간불: 단계를 지우거나 저장 앞으로 옮기면 ✕.

소급: 없다. 수리 뒤 시한에 잘리는 실행이 생기면 그때부터 이슈가 생긴다.

파일: .github/workflows/rescue-bodies.yml

위험: rescue-bodies.mjs(bodies-1)를 고치기 전에 이것만 먼저 나가면, 서울대 같은 공고가 다시 대상이 될 때마다 하루 두 번 실패 이슈가 생긴다. bodies-1 과 같은 커밋으로 낸다. other-session 은 이 파일을 안 건드린다.

---
## [bodies/bodies-3] P1 · confirmed

이유: HEAD 에서 재현했다. deepfetch.mjs 302행 MAX_NOTICES=6 이고, 323~329행이 등록 순서대로 돌다 6건에서 멈춘다. 자격 없는 공고 58건 중 공고문 첨부가 있는 것이 24건이다. 매번 뽑히는 1~6번(코나아이 auto-rnoticedoarticleno154473 · 울산연구원 · 미래에셋 · 고속도로 · 문주 · 인천인재)은 모두 이미 elig-docs.json 에 있다. 7~24번 18건(금신사랑·포항시장학회·선원가족·경희꿈도전·우정장학 2건·점프장학·논산시장학회·대전청년내일재단 성취 hwpx 7건 등)은 색인에 없다(idx:null). 1~6번 그림은 tesseract 장부가 모두 ok:false 다(17wt5c 0.78 · 1o1955 0.11/0.37 · 1pog8d 0.83/0.89). 그러니 매번 다시 받아도 얻는 것이 없다. eligibility-ai.mjs pickPdfTargets(302~304행)도 같은 색인만 보고, 버튼 워크플로(eligibility-fill.yml 101행)도 같은 --elig-attach 를 먼저 부른다. 그래서 AI 로도 18건에 닿지 않는다. 대전청년내일재단 hwpx 7건은 받기만 하면 그 실행에서 무료로 읽힐 수 있는 것들이다(attachmentText 가 hwpx 를 바로 푼다).

수리 명세: [새 파일] collector/elig-attach-plan.mjs — 순수 모듈이다(deepfetch.mjs 는 불러오는 순간 수집을 시작하므로 관문이 부를 수 없다).
  · attSig(atts) = 고른 첨부의 (name|url) 목록 sha1 앞 12자
  · pickEligDocTargets(items, index, { today, now, fileExists, requirementLines, notStale, isNoticeDoc, max = 6 }) → { targets:[{it, atts, sig}], sigOnly:[{id, sig}] }
    – 후보 규칙은 지금 그대로다(program 아님 · 자격 줄 없음 · 공고문 첨부(OK_EXT+isNoticeDoc) 또는 bodyImage 그림 · 앞 2개). 여기에 더해 마감이 오늘(KST) 전이거나 match-engine notStale(it, now)이 거짓인 공고는 뺀다.
    – '이미 받음' = index[id]가 있고 files 가 전부 디스크에 있는 것. sig 가 같으면 건너뛴다. sig 칸이 없는 옛 항목(지금 6건 등)은 같은 것으로 보고 sigOnly 로만 돌려준다 → sig 만 채우고 다시 받지 않는다.
    – 순서: 한 번도 안 받은 것 → 첨부 목록이 바뀐 것(sig 다름). 묶음 안은 등록 순서. 앞에서 max 건.
[collector/deepfetch.mjs downloadEligDocs]
  · 323~329행의 break 루프를 위 함수로 바꾼다.
  · 지우기(333~337·342행 refreshing)는 이번에 실제로 받는 targets 의 slug 만 대상으로 한다.
  · 받은 공고는 index[id] = { slug, files, sig, at: today } 로 적는다. sigOnly 는 sig 만 채운다.
  · 새로 받은 바이트가 지울 기존 파일과 같으면 파생 글자(.txt·.body.txt·.ocr.txt)를 지우지 않는다(bodies-5).
  · 바꾸지 말 것: OK_EXT·IMG_EXT 정규식과 `const ext = (a.name.match(/\.(…)$/i)` 목록의 모양(test-collector 「공고문 첨부에서 자격 읽기」가 정규식으로 잰다), 파일 이름 elig-<slug>-<n>.<ext>, 예산 ELIG_BUDGET_MS 150초, 요청 시한 20초, MAX_BYTES 8MB, isHtmlPayload 거름, 색인의 slug·files 칸(extract-excerpts 744·846행 · extract-amounts 57·118행 · eligibility-ai 304행 · deadline-audit 59행이 읽는다 — 칸은 더하기만 한다), elig-docs.json 저장 형식(JSON.stringify(index,null,1)).

관문: health-gates/bodies.mjs: elig-attach-plan.mjs 만 불러 표본 10건으로 잰다.
  · 표본 구성: 1~6 은 색인·파일 있고 sig 같음 · 7·8 은 색인 없음 · 9 는 마감 어제 · 10 은 색인 있으나 첨부 이름이 바뀜 · 11 은 sig 칸 없는 옛 색인이고 파일 있음. fileExists 는 가짜 함수, requirementLines·notStale 은 표본용 함수로 넣는다.
  · 기대: targets id 순서가 [7, 8, 10]이다. 9 는 없다. 11 은 sigOnly 에만 있다. 1~6 은 없다.
  · '안 바뀐 공고의 파생 글자 보존'도 잰다: refresh 대상 slug 집합에 1~6·11 의 slug 가 없어야 한다.
빨간불: '이미 받음 건너뛰기'를 빼면 1~6 이 앞에 와서 ✕. 마감 거름을 빼면 9 가 들어와 ✕.

소급: 코드가 스스로 고친다. 다음 수집 실행(하루 세 번)부터 7~24번째를 6건씩 받으므로 하루 안에 18건이 모두 색인에 오른다. 같은 실행의 hwp-bodytext 와 extract-excerpts 가 HWP·HWPX 를 바로 읽는다. PDF·그림은 bodies-6·gaps-02 수리 뒤 OCR 로 읽힌다. 손으로 고치는 일은 없다.

파일: collector/deepfetch.mjs collector/elig-attach-plan.mjs

위험: other-session 은 deepfetch.mjs 를 안 건드린다. 같은 묶음의 B8(--fill)도 deepfetch.mjs 를 고치므로 한 사람이 차례로 고친다. 실데이터 관문 test-collector 9550~9560행(첨부 마감 다시 읽기)은 색인이 늘어도 deadlineFromDocs 가 같은 파일을 읽으므로 그대로 통과해야 한다. 수리 뒤 첫 실행 로그로 확인한다.

---
## [bodies/bodies-4] P2 · confirmed

이유: run #53 에서도 25건 한도의 첫 세 자리를 같은 세 건(제주 미래이음·코나아이·경희꿈도전)이 다시 차지하고 ✅를 찍었다(로그 77~79행). 이 세 건은 browser-bodies.json 에 이미 via:rescue 로 있다. 원인은 rescue-bodies.mjs 276행이 성공하면 `delete ledger[key]` 로 tries 를 0 으로 되돌리는 것이다. 대상 기준(83행 requirementLines)과 성공 기준(hasText)이 다르니, 다음 실행에서 다시 맨 앞(101행 정렬)에 온다. HEAD 에서 다시 세어 보니 대상 58건 중 12건이 마감이 지났거나 학생 화면에서 숨겨진 공고다(reg-hi-jeju listedAt 07-16·notStale 거짓 · 코나아이 마감 08-11 · 아주대 2건 마감 10-02 등).

수리 명세: collector/rescue-plan.mjs pickTargets (bodies-1 과 같은 파일·같은 함수):
  ① 장부에 ok 기록이 있고 오늘과 7일 안이면 건너뛴다. 본문은 이미 있고 자격 절만 없는 공고는 발췌기·AI 의 몫이다.
  ② 마감이 오늘(KST) 전이거나 match-engine notStale(it, now)이 거짓이면 건너뛴다. 마감도 listedAt 도 없으면 notStale 이 true 라 대상에 남는다.
  ③ 정렬은 tries 오름차순 그대로 하되, tries 가 같으면 ok 기록이 없는 것(한 번도 성공 못 한 것)을 먼저 둔다.
  ④ 성공 때 `delete ledger[key]` 대신 ledgerEntry(…,'ok')를 쓴다.
함께 고칠 곳: .github/workflows/rescue-bodies.yml '관문에 걸리면 되돌린다'의 git checkout 목록에 collector/rescue-ledger.json 을 더한다(bodies-12 ③). 안 그러면 본문은 되돌려지고 ok 기록만 남아 그 공고를 7일 동안 아무도 안 연다.
바꾸지 말 것: '#n-' 표식 건너뛰기, minBody(staleJudgment) 재시도 규칙, REST_AFTER=3·REST_DAYS=7.

관문: health-gates/bodies.mjs 표본(today '2026-10-04'):
  · A 는 자격 없음 + ok 3일 전 → 빠진다
  · B 는 ok 8일 전 → 들어간다
  · C 는 마감 10-03 → 빠진다
  · D 는 마감 없음 + listedAt 70일 전 → 빠진다
  · E 는 처음 보는 것 → 맨 앞
  · F 는 자격 줄 있음 → 빠진다
기대 id 순서는 [E, B]. 글자 검사로 rescue-bodies.yml 되돌리기 줄에 rescue-ledger.json 이 있어야 한다.
빨간불: ok 건너뛰기를 빼면 A 가 들어와 ✕. 마감 거름을 빼면 C·D 가 들어와 ✕.

소급: 없다. 장부의 ok 기록은 다음 실행부터 쌓인다. 첫 실행에서 세 건은 한 번 더 열리고, 그 뒤 7일은 열리지 않는다.

파일: collector/rescue-plan.mjs collector/rescue-bodies.mjs .github/workflows/rescue-bodies.yml

위험: rescue-bodies.yml 은 bodies-2·7·12 와 같은 파일이라 한 번에 고친다. other-session 과는 충돌 없다.

---
## [bodies/bodies-5] P3 · confirmed

이유: 구조는 맞다. deepfetch.mjs 333~337행은 다시 받는 공고의 elig-<slug>-* 를 파생 글자까지 지운다. collect-scholarships.yml 은 발췌(165~166행)를 PDF(202~208행)·OCR(212~216행)보다 먼저 돌린다. ocr-text.py seen_enough 는 ok 인데 파일이 없으면 다시 읽는다(259행). 다만 지금 실제 피해는 없다. 매번 다시 받는 6건의 그림은 tesseract 장부가 모두 ok:false 다(17wt5c·1o1955·1pog8d 등 비율 0.11~0.89). PDF 는 bodies-6 대로 원래 자격 경로에 안 들어간다. 그래서 지워져서 잃는 OCR 글자가 오늘은 없다. 문제는 bodies-3 의 '매번 같은 것을 다시 받기' 때문에 생기므로, bodies-3 을 고치면 거의 사라진다. 남는 것은 처음 받는 실행에서 OCR 이 발췌보다 늦어 한 실행(약 8시간) 늦게 읽히는 것뿐이다. 그래서 P2 를 P3 로 낮춘다.

수리 명세: 따로 할 일은 없다. bodies-3 수리(바뀐 공고만 다시 받기 + 받은 바이트가 같으면 파생 글자를 지우지 않기)에 포함된다. collect-scholarships.yml 의 단계 순서는 바꾸지 않는다. 처음 받은 실행에서만 한 실행 늦어지고, 수집 워크플로 순서를 건드리는 위험이 더 크다(금액 로봇은 '발췌 뒤에 둔다'는 규칙이 있다).

관문: bodies-3 관문의 '안 바뀐 공고의 slug 는 refresh 집합에 없다' 항목이 이것을 잰다.

소급: 없다.

파일: collector/deepfetch.mjs

위험: 없다(bodies-3 과 한 벌).

---
## [bodies/bodies-6] P2 · confirmed

이유: 확인했다. attachment-text.mjs 153행은 .pdf 를 ocrText(.pdf.ocr.txt)로만 읽는다. ocr-text.py 239~240행은 .txt 가 있는 PDF 를 건너뛴다. pdf-text.py 가 OCR 단계보다 먼저 .pdf.txt 를 만들므로, 자격용 PDF 11개는 무료 경로 어디에서도 읽히지 않는다(.pdf.ocr.txt 0개). 개발자 결정이 필요하다는 진단에는 반박한다. 2026-08-20 결정은 '글자층(.pdf.txt)을 자격 재료로 쓰지 않는다'이고, OCR 은 그 결정이 스스로 대안으로 적은 길이다(attachment-text.mjs 165~168행 주석). OCR 쪽의 '글자층이 있으면 pdf-text 가 이미 했다'는 양식용 가정일 뿐이다. 자격용 PDF 만 OCR 하게 하면 두 결정을 모두 지키면서 구멍만 메운다. 진단의 (가)안(poppler 글자층 허용)은 쓰면 안 된다. 지금 poppler 결과에도 숫자가 빠진 공고문이 있다: collector/extracted/elig-rtcxm5-1.pdf.txt 32행 '공고일 현재 부 또는 모가 년 이상 계속하여 정읍시에…'(같은 파일 elig-wn0grj-1.pdf.txt).

수리 명세: collector/ocr-text.py candidates() 239~240행을 바꾼다: `if os.path.exists(path + '.txt') and not os.path.basename(path).startswith('elig-'): continue`. 그러면 자격용(elig-*) PDF 는 글자층이 있어도 쪽 그림으로 tesseract 를 탄다. 기존 품질 관문은 그대로 쓴다(ACCEPT_RATIO 0.9 · ACCEPT_HANGUL 200 · 줄 관문의 '숫자 없는 문턱 버림' · MAX_PAGES 10 · MIN_PDF_SEC · 장부 서명으로 한 번만 읽기). 결과는 .pdf.ocr.txt 로만 남긴다. 바꾸지 말 것: attachment-text.mjs 는 .pdf.txt 를 계속 안 읽는다(2026-08-20 결정 유지 · test-collector 'PDF는 자격 경로에서 쓰지 않는다' 관문), 양식(form-*)·kosaf PDF 는 지금처럼 건너뛴다, OCR 단계 예산 150초·단계 시한 4분.

관문: health-gates/bodies.mjs: 먼저 python3 가 실제로 도는지 잰다(test-collector OCR 절과 같은 꼴 — 윈도우 스토어 껍데기 대비). 돌면 spawnSync('python3', ['-c', …]) 로 importlib 를 써서 collector/ocr-text.py 를 불러온다. 임시 폴더에 elig-a-1.pdf + elig-a-1.pdf.txt, form-b-1.pdf + form-b-1.pdf.txt 를 만든다(둘 다 '%PDF-1.4' 머리). candidates(tmp)가 elig-a-1.pdf 하나만 내야 한다. python 이 없으면 '건너뜀'을 소리 내어 찍는다. 빨간불: 조건을 되돌리면 elig 가 빠져 ✕.

소급: 코드가 스스로 고친다. 다음 수집·버튼 실행의 OCR 단계가 장부에 없는 자격용 PDF 를 예산 안에서 차례로 읽는다(11개 · 쪽당 5~10초). 손으로 고칠 것은 없다.

파일: collector/ocr-text.py

위험: 표가 많은 공고문은 tesseract 가 0.9 비율을 못 넘어 계속 0 일 수 있다. 그건 정직한 '못 읽음'이고 AI 버튼의 몫이다. OCR 단계 시간이 늘어나지만 예산·장부가 묶는다. 같은 OCR 단계는 eligibility-fill.yml·deep-fetch.yml 에서도 돌지만 코드 한 곳이라 같이 고쳐진다.

---
## [bodies/bodies-7] P2 · confirmed

이유: #378 본문 첫머리가 '실행: 2026-09-30 · 대상 11건'이다. 9-30 성공 실행의 리포트를 10-03 실패 이슈에 붙인 것이다. 그래서 '경희대 공고들이 4회째·7회째 본문 없음'처럼 읽히지만, 실제로 10-03 실행은 4번째(서울대)에서 멈췄다. 저장소의 rescue-report.md 도 아직 9-30 판이다(git log 마지막 변경 247b89f9 10-02 병합). rescue-bodies.yml 155~157행은 파일을 그대로 붙이고, 성공 때 닫는 단계는 없다. 열린 이슈 #234(09-04)·#337·#361·#378 이 모두 열려 있다.

수리 명세: .github/workflows/rescue-bodies.yml
① '실패하면 이슈로 알린다' 스크립트: 리포트의 '실행: YYYY-MM-DD'를 KST 오늘과 비교한다. 다르면 리포트를 붙이지 않고 '이번 실행은 리포트를 쓰기 전에 끊겼습니다(저장소의 리포트는 YYYY-MM-DD 판이라 붙이지 않았습니다)'를 적는다. 어느 경우든 실행 로그 주소(`${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`)를 넣는다. bodies-1 수리 뒤에는 공고마다 저장되므로 보통은 오늘 날짜다.
② 성공 정리 단계를 넣는다. `if: success()` · continue-on-error: true · github-script. labels:'rescue-bodies' 이고 state:'open' 인 이슈마다 '다음 실행(<로그 주소>)이 끝까지 돌아 닫습니다' 코멘트를 달고 state:'closed', state_reason:'completed' 로 닫는다(robot-heartbeat.yml 의 '옛 경보를 닫는다'와 같은 방식). 위치는 알림 단계 뒤.
바꾸지 말 것: 라벨 이름 rescue-bodies, 이슈 제목 꼴.

관문: health-gates/bodies.mjs 글자 검사: 알림 스크립트에 '실행:' 날짜 비교와 runId(실행 로그 주소)가 있다. `if: success()` 단계가 rescue-bodies 라벨 이슈를 state 'closed' 로 바꾼다. 빨간불: 둘 중 하나를 지우면 ✕.

소급: 수리 뒤 첫 성공 실행이 #234·#337·#361·#378(과 그사이 생긴 실패 이슈)을 스스로 닫는다. 손으로 닫지 않는다(이번 점검 규칙: 이슈 코멘트·닫기 금지).

파일: .github/workflows/rescue-bodies.yml

위험: 성공 정리가 bodies-2 의 실패 단계보다 앞에 있으면 실패 실행에서도 닫을 수 있다. 반드시 success() 조건이어야 한다. other-session 과는 충돌 없다.

---
## [bodies/bodies-8] P2 · needs-human
**결정: 보고만(유료 버튼 — 개발자가 누른다). 코드 변경 없음.**

이유: 사실이다. 마지막 수동 실행은 run 35281417754(09-17)이고 그 뒤 workflow_dispatch 가 없다. 지금 node verify/eligibility-report.mjs 로는 등록 160건 중 확보 102건(64%) · 미확보 58건 · 그중 원문 자체가 없음 41건이다. 진단 때 숫자(152·91·61·46)와 조금 다르지만 같은 그림이다. 유료 API 이고 eligibility-ai-config.json enabled:false 가 설계상 버튼에서만 켜지므로 사람이 정해야 한다. 지금 누르면 bodies-3 때문에 18건 첨부에 닿지 않으므로, 수리 뒤에 눌러야 값어치가 있다.

수리 명세: 코드 수리는 없다. bodies-1·3·6 과 gaps-02 가 나가고 수집 로봇·자격요건 로봇이 한두 번(약 하루) 돈 뒤, 개발자가 관리자 화면 또는 Actions 에서 「자격요건 매칭 · AI 자격 읽기」를 '미리보기만'으로 먼저 눌러 대상 수를 본다. 그다음 결정에 따라 '첨부만' 또는 '전부'로 누른다.

관문: 없다(사람 결정).

소급: 버튼 실행 결과가 registered.json 에 'AI가 읽음 · 검수 전' 표식으로 들어간다(기존 경로 · 감사가 막는다).

파일: 

위험: Anthropic API 잔액이 모자라면 실행이 실패한다. 결과 이슈가 생기고 데이터는 되돌아간다.

---
## [bodies/bodies-10] P3 · confirmed

이유: eligibility-fill.yml 88~92행 '대상이 0건이면 여기서 끝'은 단계 안의 exit 0 일 뿐이다. 뒤 단계(97~268행) 어디에도 count 조건이 없다. 또 85행 sed … | head -1 은 장학 텍스트 대상('대상 N건 — 전수')의 첫 줄만 센다. 첨부 대상(eligibility-ai.mjs 441행 '첨부로 읽을 수 있는 공고 N건')과 대외활동 대상(activity-docs.mjs 376행 'AI 대상 N건')은 세지 않는다. 피해는 버튼을 누를 때 몇 분 헛도는 것과 '바뀐 것 없음' 이슈 정도다.

수리 명세: .github/workflows/eligibility-fill.yml '대상 미리보기':
  · count 를 세 숫자의 합으로 만든다: 장학 '대상 N건' + '첨부로 읽을 수 있는 공고 N건' + 활동 'AI 대상 N건'. 줄마다 따로 sed 로 뽑아 더하고, 셋을 각각 출력에도 남긴다.
  · '대상이 0건이면 여기서 끝'은 이름을 '대상이 0건이면 유료 단계는 건너뛴다'로 바꾸고 notice 만 남긴다.
  · 돈이 드는 단계(SDK 설치 · 첨부만 · 공고 하나만 · 시범 3건 · 전수 169건 · 대외활동 AI)의 if 에 `&& steps.preview.outputs.count != '0'` 을 더한다.
바꾸지 말 것: 무료 단계(첨부 받기·글자 뽑기·OCR·발췌)는 count 와 상관없이 돈다. 이것들이 새 대상을 만들 수 있고, 미리보기 시점의 0 은 받기 전 숫자다. 관문·저장·리포트 단계의 always() 조건도 그대로 둔다.

관문: health-gates/bodies.mjs 글자 검사: 미리보기 단계가 세 낱말('대상 ', '첨부로 읽을 수 있는 공고', 'AI 대상')을 모두 센다. 유료 단계 다섯(eligibility-ai.mjs --docs-only|--only|--write|--all --write · activity-docs.mjs --ai --write)의 if 에 count != '0' 이 있다. 빨간불: 하나를 지우면 ✕.

소급: 없다.

파일: .github/workflows/eligibility-fill.yml

위험: 작다. other-session 은 이 파일을 안 건드린다. 진단의 원래 제안(뒤 단계 전부에 조건)은 받기 전 0 때문에 '첨부만' 모드를 잘못 멈출 수 있어 고쳐 적었다.

---
## [bodies/bodies-12] P3 · confirmed

이유: ① deep-fetch.yml 에는 concurrency 가 없고 본 단계(43행)에 timeout-minutes 가 없다. deepfetch.mjs 본편(--fill 아님)은 요청마다 20초 시한만 있고 전체 예산과 중간 저장이 없다(쓰기는 199행 한 번). 공고 340여 건 × 최악 20초면 작업 시한 34분을 넘겨 통째로 버려질 수 있다. 수동·push-to-run 이라 드물다(마지막 실행 09-04). ② paddle 버전 미고정은 위험이 아니라 이미 고장이다 → gaps-02 로 옮긴다. ③ 'rescue-bodies.yml 되돌리기'는 browser-bodies.json·registered.json 만 되돌리고, 저장(always)은 rescue-ledger.json 을 그대로 커밋한다. 지금은 해가 작지만, bodies-4 수리로 장부에 ok 를 적기 시작하면 본문은 되돌려지고 ok 만 남아 7일 동안 그 공고를 아무도 안 연다. 그래서 같이 고쳐야 한다.

수리 명세: ① .github/workflows/deep-fetch.yml 에 `concurrency: { group: deep-fetch, cancel-in-progress: false }`를 단다. 🔴 수집 대기줄 collector 와 합치지 말 것(CLAUDE.md: 대기 실행이 취소된다). collector/deepfetch.mjs 본편 루프에 예산을 둔다(DEEPFETCH_BUDGET_MS 기본 18분 · 매 요청 전에 확인 · 넘으면 멈추고 지금까지를 저장한 뒤 첨부 단계로). 이 작업은 B8 의 --fill 예산과 같은 자리·같은 코드로 한다(FILL 이면 FILL_BUDGET_MS, 아니면 DEEPFETCH_BUDGET_MS).
② gaps-02 에서 처리한다.
③ .github/workflows/rescue-bodies.yml '관문에 걸리면 되돌린다'의 git checkout 목록에 collector/rescue-ledger.json 을 더한다(bodies-4 와 같은 커밋). act-browser.json·rescue-report.md 는 되돌리지 않는다(장부의 '해 봤다'와 진단 기록은 남긴다).

관문: health-gates/bodies.mjs 글자 검사:
  · deep-fetch.yml 에 `group: deep-fetch` 가 있고 `group: collector` 는 없다.
  · deepfetch.mjs 의 본문 받기 루프 안에 예산 확인(DEEPFETCH_BUDGET_MS 또는 FILL_BUDGET_MS)이 있다.
  · rescue-bodies.yml 되돌리기 줄에 rescue-ledger.json 이 있다(bodies-4 관문과 같은 항목).
빨간불: 각각을 되돌리면 ✕.

소급: 없다.

파일: .github/workflows/deep-fetch.yml collector/deepfetch.mjs .github/workflows/rescue-bodies.yml

위험: other-session 은 이 파일들을 안 건드린다. deepfetch.mjs 는 bodies-3·B8 과 같은 파일이라 한 사람이 차례로 고친다.

---
## [gaps/gaps-02] P1 · confirmed

이유: 두 로그로 다시 확인했다. 수집 run 37169572702(10-04 02:11Z) 로그 159~160행에 '✕ 6c454347f6f4-0.jpg — (Unimplemented) ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]' 다음 '끝 — 0장'이 있다. 자격요건 로봇 run 37160846656 로그 165~166행도 같은 오류에 0장이다. 단계는 모두 success 다(워크플로 `|| true` + continue-on-error). 원인 가설은 더 강해졌다. paddleocr 3.7.0 의 paddleocr/_constants.py 는 DEFAULT_ENABLE_MKLDNN = True 이고, _common_args.py 는 cpu 이고 enable_mkldnn 이면 oneDNN 경로를 탄다(아니면 run_mode 'paddle'). x86 리눅스인 Actions 만 oneDNN 을 타고 맥(arm)은 안 탄다는 것이 '로컬 실측 11건 성공 · Actions 0장'과 맞는다. 샌드박스에서는 PyPI 설치까지 됐지만 모델 내려받기(paddle-model-ecology.bj.bcebos.com)가 막혀 실행으로는 증명하지 못했다. 피해는 시간 제한이 있다. 장부 act-docs.json 38건 중 37건과 act-browser.json 11건 중 10건이 tries 1 이고(MAX_TRIES 2 · 이레 간격 — activity-docs.mjs 54~55·263·287행), 10-10 무렵 두 번째 시도도 엔진 고장으로 날아가면 그 글들은 무료 경로에서 영영 빠진다. 그래서 P1 로 올린다.

수리 명세: ① collector/paddle-ocr.py 71~72행 PaddleOCR(...)에 `enable_mkldnn=False` 를 더한다(CPU oneDNN 경로를 끈다). 두 워크플로의 설치를 버전 고정한다: `pip install --quiet paddlepaddle==3.3.1 paddleocr==3.7.0`(오늘 PyPI 최신 = 10-03·04 Actions 가 받은 판으로 추정). 대상은 collect-scholarships.yml 229행과 rescue-bodies.yml 95행.
② paddle-ocr.py: 읽을 파일이 있었는데 성공 0이고 실패(✕)가 하나라도 있으면 `::warning::PaddleOCR 엔진 오류 — n개 모두 실패: <첫 오류 80자>` 를 찍고 sys.exit(2) 한다. 또 collector/act-files/paddle-status.json 에 { engineFailed, ok:[파일], failed:[파일] } 을 쓴다. 워크플로의 `paddle-ocr.py … || true` 는 `|| echo "::warning::PaddleOCR 실패 — 자격 읽기는 HWP·본문으로만 계속"` 으로 바꾼다. 🔴 `|| true` 를 그냥 떼면 안 된다 — 같은 단계의 `activity-docs.mjs --apply` 가 bash -e 에 끊겨 HWP 로 읽은 자격까지 버려진다.
③ collector/activity-docs.mjs:
  · applyPhase 가 paddle-status.json 을 읽는다. 이번 실행에 받은 글 가운데 자격을 못 찾았고 그 글의 그림·PDF 가 failed 에 있으면 장부 tries 를 1 되돌리고 LEDGER 를 저장한다. 무료 모드는 act-docs.json, 브라우저 모드는 act-browser.json — applyPhase 는 지금 브라우저 장부만 쓰므로 무료 모드 저장을 더한다.
  · 소급: 순수 함수 migrateOcrTries(ledger, OCR_V='paddle-nomkldnn-1')를 export 한다. ledger._ocrV 가 다르면 lines 가 없는 항목을 지운다(_common 은 남긴다). 그러면 dueFree(undefined)=true 라 다음 실행에 바로 다시 해 본다. 그 뒤 _ocrV 를 적는다. fetchPhase 시작 때 두 모드 모두 부른다.
  · 바꾸지 말 것: dueFree 와 MAX_TRIES=2·RETRY_DAYS=7(test-collector 11281행 관문), ownsImageText 제목 낱말 검사, korean_PP-OCRv5_mobile_rec 이름 지정·MIN_SCORE 0.8·MAX_SIDE 2000(test-collector 11287~11289행 관문 — `pip install[^\n]*paddleocr` 정규식은 버전 고정 뒤에도 맞는다), 받은 파일은 커밋하지 않음.

관문: health-gates/bodies.mjs (activity-docs 를 불러오기 전에 process.env.ACTIVITY_DOCS_AS_LIB='1' — 안 하면 본편이 돈다):
  · 글자 검사: paddle-ocr.py 에 enable_mkldnn=False · sys.exit(2) · '::warning::PaddleOCR' 가 있다. 두 워크플로에 paddlepaddle==숫자와 paddleocr==숫자가 있다. `paddle-ocr.py[^\n]*\|\| true` 가 없다.
  · 표본: migrateOcrTries({ a:{at:'2026-10-03',tries:1}, b:{at:'2026-10-03',tries:1,lines:['x']}, _common:['h'] }) → a 없음 · b 그대로 · _common 그대로 · _ocrV 적힘. 두 번째 부름은 변화 없음.
  · 표본: 되돌리기 함수(applyPhase 에서 뗀 순수 함수 rollbackOcrTries)에 failed 에 든 글 → tries 1→0, 자격을 찾은 글·failed 아닌 글 → 그대로.
빨간불: 각각을 되돌리면 ✕.
엔진 수리 자체는 표본으로 못 잰다. 수리 뒤 첫 수집 실행 로그의 '✓ <파일> — N줄'로 확인한다(샌드박스는 모델 서버가 막혀 못 돌린다).

소급: migrateOcrTries 가 다음 실행에서 두 장부의 '자격 못 찾은' 항목을 한 번 비운다. 그러면 무료 모드가 한 실행에 15건씩 다시 받아 OCR 한다(대외활동 미확보 약 80~98건 → 이틀 안팎). 손으로 장부를 고치지 않는다.

파일: collector/paddle-ocr.py collector/activity-docs.mjs .github/workflows/collect-scholarships.yml .github/workflows/rescue-bodies.yml

위험: enable_mkldnn=False 는 CPU 추론을 느리게 한다(그림당 몇 초 더). 그래도 예산(180·240초)과 그림 수(실행당 1~11장)로 보면 들어간다. 가설이 틀리면(oneDNN 이 원인이 아니면) ②의 경고와 ③의 되돌리기 덕에 기회는 더 깎이지 않고 경고로 드러난다. collect-scholarships.yml 은 다른 묶음도 고칠 수 있는 파일이다. 이 묶음은 229~230행 두 줄만 바꾼다. other-session 은 이 파일들을 안 건드린다.

---
## [browser/B7] P2 · confirmed

이유: 확인했다. browser-collect.mjs 332행 클릭 경로는 clickDetails[title] = { deadlineHint, attachments } 만 남기고, 259~261행에서 만든 상세 글자(dHtml/dText)를 버린다. 454~458행은 cd 가 있으면 상세 방문을 건너뛰므로 465~476행의 bodies 저장에 닿지 않는다. 지금 browser-bodies.json 을 호스트별로 세어 보면 korea.ac.kr·pusan·gachon 0건, snue 2건(browser), kmu 74건이다. needsFetch 112건 중 110건이 껍데기다. canonUrl 은 '#n-' 표식을 남기므로(canon-url.mjs 58~59행) 표식 주소로 저장해도 indexTexts 가 그 공고로 찾는다. 함께 발견한 것: 상세 방문 경로가 저장하는 본문은 한 줄로 뭉갠 글자다(browser-bodies 169건 중 93건이 한 줄). CLAUDE.md 「발췌기에 넘기는 상세 글자는 줄을 살린 것(htmlToLines)」 규칙과 어긋나므로 같이 고친다. other-session 브랜치는 이 결함을 고치지 않았다. 그쪽 diff 는 같은 클릭 경로(행 후보 rowDetailCandidates·postId · 284~336행)만 바꾼다.

수리 명세: [collector/html-text.mjs] 순수 함수 browserBodyEntry({ title, html, at, via = 'browser' })를 더한다. htmlToLines(html)로 줄을 살린 글자를 만들고, 한글 120자 미만이면 null 이다. 맞으면 { title, text: text.slice(0, 15000), at, via }.
[collector/browser-collect.mjs]
  ① 클릭 경로 332행: 아래 조건을 모두 만족할 때만 clickDetails[title].body = browserBodyEntry({ title, html: dHtml, at: todayStr })를 넣는다.
    · 상세가 실제로 열렸다(popup 이거나, page.url() !== url 이거나, dHtml 이 클릭 전 목록 html 과 다르다).
    · dText 에 이 행 제목이 있다(normTitle 포함 비교).
    · 다른 행 제목(others · 이미 계산돼 있다)이 3개 이상 보이지 않는다(= 아직 목록 화면이면 저장 안 함 — 남의 글을 본문으로 붙이는 사고 방지).
  ② 상세 루프 454~458행 `if (cd) { … }` 안에서 `if (cd.body) bodies[it.url] = cd.body;` 로 저장한다.
  ③ 상세 방문 경로 474~476행도 같은 함수로 바꾼다: bodies[it.url] = browserBodyEntry({ title: it.title, html: d.html, at: todayStr }). deadlineHintFrom 에는 지금처럼 뭉갠 text 를 넘긴다.
바꾸지 말 것: 시간 예산·클릭 예산(180초)·전역 예산, 원문 주소 정하기(verifyDetailUrl·judgeLanding), '#n-' 표식 규칙, 추가 페이지 열기 0회.

관문: health-gates/bodies.mjs:
  · 표본 html(<nav>메뉴</nav><h3>제목</h3><p>한글 150자…</p><p>둘째 줄</p>) → browserBodyEntry 의 text 가 2줄 이상이고 via 가 'browser' 다. 한글 50자 표본은 null 이다.
  · 글자 검사: browser-collect.mjs 에서 browserBodyEntry( 를 두 번 이상 부른다(클릭 경로·상세 방문). `if (cd` 블록 안에 bodies[it.url] 대입이 있다.
빨간불: 클릭 경로 저장을 되돌리면 호출 수 1 → ✕. htmlToLines 대신 뭉갠 글자를 쓰면 줄 수 1 → ✕.

소급: 새로 수집하는 클릭형 글부터 본문이 쌓인다. 이미 seen 인 옛 글은 브라우저 수집이 다시 누르지 않으므로, 등록된 옛 공고는 자격요건 로봇(rescue-bodies)이 대상이면 받는다. 손으로 고칠 것은 없다.

파일: collector/browser-collect.mjs collector/html-text.mjs

위험: 🔴 other-session(origin/claude/source-link-integrity)이 같은 파일의 바로 위 줄들(284~336행 · links.push·postId)을 바꾸므로 병합 충돌 가능성이 높다. 그 브랜치가 기본 브랜치에 들어간 뒤 그 위에서 고치거나, 손대는 줄을 332행 한 줄과 454~476행으로 좁힌다. 이 묶음에서는 맨 마지막에 한다. 목록 화면을 본문으로 저장하는 사고는 ①의 세 조건으로 막는다.

---
## [browser/B8] P2 · confirmed

이유: 오늘도 그대로다. 브라우저 수집 run 37171328367(10-04)의 '공고 원문 보충 수집' 단계가 02:40:26→02:43:29(3분 3초)로 단계 시한 3분(browser-collect.yml 103행)에 걸렸다. 앞선 로그들도 있다: 36803960541 은 'timed out after 3 minutes'에 done(fill) 줄이 없다(그날 받은 것 폐기). 37087734875 는 저장 직후 시한에 걸렸다. 수집 run 37190037848(10-04)도 2분 45초다. HEAD 로 다시 세면 수집 목록 346건 중 needsFetch 112건이고, 그중 110건이 '받았지만 껍데기'다. 원인은 deepfetch.mjs 163행이 res.ok 면 fails 를 안 올리는 것이다. 그래서 껍데기(bodyChars<MIN_BODY)는 GIVE_UP_AFTER 물러서기(113~114행)에 영영 안 걸리고, FILL_CAP 120 자리를 매번 같은 글이 차지한다. 쓰기는 199행 한 번뿐이다.

수리 명세: [collector/notice-source.mjs] 순수 함수 둘을 export 한다(deepfetch.mjs 는 불러오면 실행되므로 관문이 부를 수 없다).
  · fillRetired(src, giveUp = 3) = (src?.fails ?? 0) >= giveUp || (src?.shells ?? 0) >= giveUp
  · nextShells(prevSrc, nowSrc) = 지금 받은 것이 FETCH_ 실패가 아니고 hasText(nowSrc)가 거짓이면 (prevSrc?.shells ?? 0) + 1, 아니면 0
[collector/deepfetch.mjs --fill]
  ① tooManyFails 를 fillRetired 로 바꾼다. retired 정렬 기준은 (fails||0)+(shells||0)이다. RETRY_SLOTS 회전은 그대로다 — 영구 포기는 없다.
  ② 루프가 끝난 뒤 indexTexts(texts, browserBodies)를 한 번 더 잰다(실측 372ms). 이번에 받은 항목마다 shells = nextShells(prev, idx.byUrl.get(k))를 적는다(0 이면 칸을 지운다).
  ③ 예산 FILL_BUDGET_MS(기본 120000)를 요청을 시작하기 전마다 확인한다. 넘으면 멈추고 그때까지를 저장한다. 120초 + 마지막 요청 최대 20초 + 재기·쓰기 < 브라우저 수집 단계 시한 3분 · 수집 단계 시한 5분.
  ④ 본편(--fill 아님)에도 같은 자리에 DEEPFETCH_BUDGET_MS 를 둔다(bodies-12 ①).
바꾸지 말 것: FILL_CAP 120, LIMIT 15000·cut 규칙(needsFetch), '#n-' 건너뛰기, 브라우저 본문이 이기면 다시 안 받는 것(indexTexts better), 저장 형식, 보존 규칙(liveKeys·liveTitles).

관문: health-gates/bodies.mjs:
  · 표본: fillRetired({fails:3})=true · fillRetired({shells:3})=true · fillRetired({shells:2})=false.
  · 표본: nextShells({shells:2}, { text: '메뉴', bodyChars: 10 })=3 · nextShells({shells:2}, { text: '본문…', bodyChars: 300 })=0 · nextShells({}, { text: 'FETCH_FAIL HTTP 500' })=0.
  · 글자 검사: deepfetch.mjs 가 fillRetired·nextShells 를 쓰고, 받기 루프 안에 FILL_BUDGET_MS 확인이 있다.
빨간불: shells 조건을 빼면 { shells:3 } 이 false → ✕. 예산 확인을 지우면 ✕.

소급: 코드가 스스로 고친다. 껍데기 110건은 세 번 더 받은 뒤 물러서기 회전(실행당 4자리)으로 넘어간다. 손으로 고칠 것은 없다. B7 이 나가면 클릭형 학교 글은 브라우저 본문이 생겨 대상에서 저절로 빠진다.

파일: collector/deepfetch.mjs collector/notice-source.mjs

위험: other-session 은 deepfetch.mjs·notice-source.mjs 를 안 건드린다. notice-source.mjs 는 발췌기·재수집·채점기가 같이 쓰므로 함수 추가만 한다(기존 함수 동작은 그대로). deepfetch.mjs 는 bodies-3·12 와 같은 파일이라 한 사람이 차례로 고친다.

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [bodies/bodies-9] already-fixed: 그때 일은 사실이다. eligibility-fill 의 push 실행 #34~#39(09-30 00:56~01:41Z)가 모두 failure 였다. 지금 판은 checkout 단계에 with: 가 하나다(65~69행). 중복 키를 잡는 파이썬 로더로 eligibility-fill.yml·rescue-bodies.yml·deep-fetch.yml·collect-scholarships.yml·browser-collect.yml 을 모두 읽어 보니 오류가 없다. 09-30 01:41Z 뒤로는 push 실행 기록이 없다(이 워크플로에는 p
- [bodies/bodies-11] refuted: 예약 지연 자체는 사실이다(#53 은 cron 20:23Z 인데 23:09Z 에 시작). 하지만 '수집 로봇과 같은 학교를 연달아 두드린다'는 피해 근거가 없다. 10-04 기준으로 자격요건 로봇은 23:09~23:25Z, 일반 수집은 01:57Z, 브라우저 수집은 02:31Z 에 돌아 겹치지 않았다. 자격요건 로봇은 여러 학교에 흩어진 공고 최대 25건을 2.5초 간격으로 여는 정도다. 지연 때문에 막혔다는 학교 기록도 없다. 진단도 '급하지 않다 · 재 본 뒤 정한다'고 적었다. 고칠 결함이 아니다.
