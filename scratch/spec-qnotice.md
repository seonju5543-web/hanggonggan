# 수리 명세 — 묶음 qnotice

권장 순서: app1/app1-04 → collect/collect-04 → news/news-7 → collect/collect-07 → collect/collect-14 → app1/app1-05 → app1/app1-11 → app1/app1-09 → app1/app1-03 → app1/app1-08
예상 손댈 파일: collector/apply-email.mjs collector/extract-excerpts.mjs app.js collector/clean-title.mjs collector/deadline-hint.mjs collector/collect.mjs collector/board-links.mjs collector/collect-news.mjs collector/auto-register.mjs collector/notice-deadline.mjs verify/entry-rules.cjs collector/registered-merge.mjs collector/scope-promote.mjs collector/build-search-index.mjs collector/notice-source.mjs collector/portal-candidates.mjs apply-channel.js data.js data/registered.json data/search-index.json verify/health-gates.mjs verify/health-gates/qnotice.mjs

검증 메모: 핵심 요약(읽기만 했고 저장소는 고치지 않았다).
1) 기본 브랜치가 진단 이후 더 나아갔다(f33987da). 다른 세션 브랜치 claude/source-link-integrity(fb91a3fc)는 이미 기본 브랜치에 합쳐졌지만 이 작업 브랜치(46f08990)에는 아직 없다. 이 묶음의 어느 항목도 다른 세션이 고치지 않았다. 다만 app.js·data.js·chat.js·collect.mjs·test-collector.mjs 가 기본 브랜치에서 바뀌었으니, 수리는 최신 기본 브랜치를 합친 뒤 시작할 것.
2) 🔴 collect-04 수리의 함정: test-collector.mjs:4174 「저장된 boardTitle 에도 부스러기가 없다」가 실데이터를 읽는 관문이다. cleanTitle 에 꼬리 규칙만 넣고 registered.json 항공대 6건의 boardTitle 을 같은 커밋에서 안 고치면, 다음 수집 로봇의 데이터 관문이 빨개져 그날 자동 등록이 되돌려진다(이번 점검 사고 셋과 같은 꼴). admin-apply 는 boardTitle 을 고칠 수 없다(ALLOWED 밖). 그러니 자가 치유 함수를 작업 사본에서 한 번 돌려 저장할 것. 이 관문 자체를 경고로 옮길지는 gate 묶음에 알릴 것.
3) 🔴 deadline-hint.mjs 에 import 를 더하면 url-key.cjs(new Function 평가)와 관리자 vendor 복사가 깨진다(2026-09-12 audit-data 전멸). 껍데기 걷기는 부르는 쪽(collect.mjs)에서 하고, deadline-hint 에는 Set 을 인자로 받는 순수 함수만 둔다.
4) collect-07 은 진단보다 넓다. 자동 등록이 제목·게시판 요약으로만 마감을 보고, 본문 마감은 그 뒤 발췌기가 채운다. 그래서 '등록 뒤 마감 경과'가 19건(10-04 에만 항공대 2건). 게시일 90일 규칙으로는 1건만 막는다. 본문 마감(bodyDeadline · 껍데기 걷은 뒤)을 먼저 보게 하고 19건은 자가 치유로 되돌리는 안을 냈다. 칸 이름을 deadline 으로 하면 앱 카드가 바뀌므로(app.js:2994) bodyDeadline 으로 한다.
5) 불러오는 순간 실행되는 파일: auto-register.mjs·scope-promote.mjs·portal-candidates.mjs·build-search-index.mjs(데이터 파일을 덮어쓴다)·extract-excerpts.mjs(EXCERPTS_AS_LIB=1 이면 안전). 관문에서 재야 하는 규칙은 registered-merge.mjs·entry-rules.cjs·새 notice-deadline.mjs·apply-email.mjs 처럼 실행 코드 없는 곳에 두거나, 본편을 '직접 실행할 때만'으로 감쌀 것.
6) 파일 겹침: collect.mjs(feed·gate 묶음), board-links.mjs·collect-news.mjs(qfeeds news-1·news-4), notice-source.mjs·extract-excerpts.mjs(bodies 묶음), verify/health-gates.mjs PARTS(모든 묶음). news-7 의 WISE 1건은 qfeeds news-1, 경북 5건은 qfeeds news-4 몫이고, 아주·강원은 꼬리가 아니다.
7) app1-04 는 마감이 10-12·10-13 인 두 공고에 걸려 있어 이 묶음에서 가장 먼저 고칠 것.
검증에 쓴 임시 스크립트는 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/verify-qnotice/si.mjs 와 si2.mjs 이다. 작업 사본(worktree)은 만들지 않았다.


---
## [app1/app1-04] P1 · confirmed

이유: 오늘 데이터에서 그대로 확인했다. ① 고려대 송화재단(auto-onttid000100000000003863 · 마감 10-12)의 원문 6항은 '신청방법: 방문 제출 또는 온라인 신청'이고, 메일 줄은 '※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출'이라 오류가 났을 때만 쓰는 길이다(collector/extracted/notices-text.json 본문에서 확인). ② 연세대 신문고장학금(auto-bbssc58944123artclviewdo · 마감 10-13)의 근거 문장은 "'새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨) 관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다"라서 메일로는 서류만 받는다. collector/apply-email.mjs:49-57 judgeLine 에는 조건부 예외나 '서류만 메일' 거르기가 없다. data.js:506 은 `if (sch.applyEmail) return 'email'` 이라 다른 판정보다 먼저 이긴다. app.js:4311 에 큰 '접수 메일 열기' 버튼이 뜨고, applyEmailSource 는 앱 어디에도 나오지 않는다(grep 0건). extract-excerpts.mjs:800 은 이미 있는 applyEmail 을 다시 판정하지 않는다(`if (it.applyEmail …) return`). 그래서 규칙만 고치면 이미 들어간 두 건은 스스로 고쳐지지 않는다. 시험한 규칙 두 개를 등록 11건과 말뭉치에서 통과한 메일 줄 32개에 대 보니 걸린 것은 이 두 건뿐이었다. 두 공고 모두 마감이 8~9일 남아 시간이 급하다. 다른 세션 브랜치(지금은 기본 브랜치에 합쳐짐)는 apply-email.mjs 를 건드리지 않았다.

수리 명세: ① collector/apply-email.mjs judgeLine 의 문의처·제3자 검사 바로 뒤에 두 규칙을 더한다. (a) 예외 경로: `/(오류|장애|불가피|부득이|문제|접속\s*불가|시스템\s*점검)\s*(가|이)?\s*(발생\s*)?(시|할\s*경우|한\s*경우|하는\s*경우|되는\s*경우|경우에?(만|는)?)(?![가-힣])/` 에 맞으면 `{ok:false, why:'예외 경로(오류·불가피 시)'}`. (b) 다른 경로에서 신청이 끝나고 메일은 서류만 받는 줄: 같은 줄에 '메일 아닌 곳에서 끝나는 행위'(`저장해야|작성\s*후\s*저장|새글|(홈페이지|포털|포탈|시스템|사이트)에서\s*(신청|작성)`)가 있고, 메일 부분이 서류를 말하면(`서류[^@\n]{0,20}[A-Za-z0-9._%+-]+@` 또는 주소 앞 20자 안에 '서류') `{ok:false, why:'신청은 다른 경로 — 메일은 서류만'}`. 🔴 '…로 제출하면 신청이 완료됩니다' 같은 진짜 메일 접수 줄은 계속 받아야 한다. '신청 완료'라는 낱말 하나만으로 거르지 말 것. ② 같은 파일에 순수 함수 `staleApplyEmail(it)` 를 내보낸다. `it.applyEmail` 이 있고, `humanOwnedEmail(it.applyEmailFrom)` 이 거짓이고, `judgeLine(it.applyEmailSource)` 가 ok 가 아니면 true. ③ collector/extract-excerpts.mjs main() 의 항목 순회 맨 앞(본문 유무와 상관없이 모든 항목)에서 `staleApplyEmail(it)` 이 참이면 applyEmail·applyEmailSource·applyEmailFrom 세 칸을 지우고(--write 일 때만) 리포트 줄을 남긴다. 그 뒤 fillApplyEmail 이 새 규칙으로 다시 찾는다. 바꾸지 말 것: 사람(관리자·AI)이 넣은 값, 기존 받아야/버려야 고정 예시 전부, 근거 문장과 함께 저장하는 규칙(entry-rules.cjs:115-122). ④ (권장 · 화면 변경이라 approved-design 스킬로 승인 여부부터 확인) app.js 메일 버튼(4311) 아래에 포털 안내(app.js:3960-3962)와 같은 `<p class="r-quote">공고 원문 그대로 — 「…」</p>` 로 applyEmailSource 를 보인다. esc() 를 쓴다. 기본 브랜치가 app.js 4368 근처(openDetail)를 고쳤으니 최신 기본 브랜치 위에서 고칠 것.

관문: verify/health-gates/qnotice.mjs 「메일 접수 — 예외·서류 전용」. judgeLine 에 실제 원문 두 줄을 넣는다: '※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출' → ok:false·why 예외 경로, 연세 근거 문장 전문 → ok:false. 계속 받아야 하는 줄도 넣는다: test-collector 「메일 접수 주소」의 받는 줄 4개(경희 관재팀 · 518 · uri.re.kr · hufs 멘토) + 합성 1줄 '신청서를 작성하여 이메일(a@b.ac.kr)로 제출하면 신청이 완료됩니다' → 모두 ok:true. staleApplyEmail 표본: 로봇 값 + 예외 줄 → true, '관리자 2026-10-04' 값 → false, 정상 근거 → false. 배선은 extract-excerpts.mjs 에 `staleApplyEmail(` 이 있고 apply-email.mjs 에서 가져오는지 정규식으로 본다. 빨간불 증명: 규칙 (a)·(b) 를 빼면 처음 두 줄이 ok:true 가 되어 ✕, 배선 줄을 지우면 ✕.

소급: 코드가 스스로 고친다. 다음 수집 로봇의 '공고 원문 발췌 갱신'(extract-excerpts --write)이 두 건의 applyEmail 세 칸을 지운다. 마감이 10-12·10-13 이라 수리 커밋에서도 한 번 돌린다: 작업 사본에서 `node collector/extract-excerpts.mjs --write` 를 실행하면 같은 코드가 registered.json 을 JSON.stringify(x,null,1) 형식으로 고쳐 쓴다. 손으로 고치지 않는다. admin-apply 로 applyEmail 만 비우면 applyEmailSource 가 남는다. 뒤의 등록분은 메일 버튼 대신 '🖥 접수 방법은 원문 공고에서 확인'으로 바뀐다.

파일: collector/apply-email.mjs collector/extract-excerpts.mjs app.js data/registered.json

위험: (b) 규칙이 넓으면 진짜 메일 접수를 버린다. 그래도 그때 학생은 버튼 대신 '원문 확인'을 보므로, 엉뚱한 곳으로 신청서가 가는 쪽보다 싸다. 고칠 파일 셋 중 app.js 는 다른 세션의 작업(기본 브랜치에 합쳐짐)과 같은 함수 근처라 최신 기본 브랜치에서 시작할 것. extract-excerpts.mjs 는 bodies 묶음도 고칠 수 있다. server/apply(Resend)를 켜면 applyEmail 로 실제 메일을 보내므로, 이 수리는 그 전에 끝나야 한다.

---
## [collect/collect-04] P1 · confirmed

이유: 오늘 그대로 재현된다. data/notices/n1as48ix.json 19건 모두 deadlineHint 가 '접수기간 : 2026.10.15.(목) 13:30까지 2026 동계 어학연수 (Advanced Language Program)모집 안내 자세히'로 같다. 이 줄은 남의 글이고, 원문 확인 결과 머리 배너 '2027학년도 1학기 전임교원 채용 · 모집대상 : 정년 및 비정년트랙 / 접수기간 : 2026.10.15.(목) 13:30까지'(교수 채용 공고)다. 각 글의 진짜 기간 줄은 그 아래에 있다(예: seq11234 '신청기간 : 2026. 9. 1.( 화 ) ~ 10. 8.( 목 ) 17:00 까지'). deadline-hint.mjs:58-66 은 날짜가 붙은 첫 이름표를 고르는데 배너가 먼저 나온다. 제목 꼬리: 같은 꼴(부서 낱말 + YYYY-MM-DD + 조회수)을 실린 데이터 1,366개 제목에 대 보니 40건이 걸렸고 전부 항공대였다(공고 18 · 소식 13 · 대외활동 3 · 정식 등록 6). clean-title.mjs:58-73 에 이 꼬리 규칙이 없다. 정식 등록은 진단 때 3건에서 오늘 6건으로 늘었다(10-04 08:56 커밋 12035004 로 11193·11156·10681 추가). what-shows 로 보면 카드 제목이 「… 학생지원팀 2026-09-28 142」다. 앱 카드는 app.js:2926 에서 deadlineHint 를 그대로 보인다. 다른 세션이 link-landing.mjs 에 stripRowTail 을 만들었지만, 원문 확인 로봇이 제목을 대조할 때만 쓰고 저장하는 제목·힌트는 고치지 않는다. 그러니 다른 세션 몫이 아니다.

수리 명세: [제목] ① clean-title.mjs 에 좁은 꼬리 규칙 `dropBoardRowTail(t)` 를 내보내고 cleanTitle 의 마지막 정리 앞에서 부른다: `/\s+[가-힣A-Za-z·]{2,20}\s+20\d{2}-\d{2}-\d{2}\s+[\d,]{1,9}\s*$/` → ''. 이 꼴로 실데이터 1,366개 제목 중 오탐 0건이었다. 같은 자리에서 `\s*첨부파일\s*있음\s*$`(서울대 소식)과 폭 없는 공백(U+200B·FEFF)도 뗀다. 🔴 link-landing.mjs stripRowTail 의 넓은 규칙(날짜만 있는 꼬리도 뗀다)을 화면 제목에 쓰지 말 것. 그 규칙은 대조 전용이다. 🔴 cleanTitle 전체를 저장된 제목에 다시 돌리지 말 것. `^\d{3,5}\s+` 규칙 때문에 '2026 동계…'의 연도가 날아가 같은 결과가 나오지 않는다. 소급에는 dropBoardRowTail 만 쓴다. ② collect.mjs 발행 단계(478-484 notices · 531-538 acts · 570- ext)에서 실려 있는 글 전부의 title 에 dropBoardRowTail 을 입힌다(원칙 7 소급). 주소는 바꾸지 않는다. ③ auto-register.mjs 는 이미 name·boardTitle 을 cleanTitle(n.title) 로 담으므로 새 등록은 저절로 깨끗해진다. 기존 auto 항목의 name·boardTitle 에 dropBoardRowTail 을 입히는 자가 치유 한 줄을 실행 앞부분(blockIds 거르기 옆)에 둔다. [기간 힌트] ④ deadline-hint.mjs 는 import 를 하나도 더하지 말 것. url-key.cjs 가 이 파일 소스를 new Function 으로 평가하고, _admin/build.sh 가 관리자 화면용으로 복사한다(2026-09-12 audit-data 전멸 사고 자리). 순수 함수 둘만 더한다. `hintWithoutChrome(lines, boiler)`: 줄 배열에서 boiler(Set)에 든 줄을 뺀 뒤 deadlineHintFrom(남은 줄.join(' ')). `isChromeHint(hint, boiler)`: 힌트 앞 30자가 boiler 의 어느 줄 안에 들어 있으면 true. ⑤ collect.mjs 시작할 때 collector/extracted/notices-text.json(+browser-bodies.json)으로 page-boilerplate.mjs buildBoilerplate 를 만든다(scope-promote 와 같은 makeStripperMulti 방식 · 말뭉치 둘을 따로 배워 합친다). fetchDetail 은 htmlToLines 줄을 돌려주고, 힌트는 이번 실행에 받은 같은 호스트 글들까지 말뭉치에 더한 뒤 마지막에 한 번에 계산한다. 학교·활동·재단 세 갈래 모두, 시한 초과 때 saveAll 경로도 포함한다. 그 호스트의 boiler 를 모르면(3쪽 미만) 지금처럼 계산한다. ⑥ 발행 단계 자가 치유: 실려 있는 글 중 `isChromeHint(n.deadlineHint, boiler(host))` 이면, 말뭉치 본문이 있을 때는 hintWithoutChrome 으로 다시 계산하고 없으면 null 로 둔다. 🔴 '여러 글이 같은 힌트를 가지면 버린다'는 빈도 규칙은 쓰지 말 것. 실측으로 국민(2건)·서강(3건)은 진짜로 같은 기간을 가진 다른 공고였다. 바꾸지 말 것: deadlineHintFrom 의 기존 동작과 HINT_LABEL 이름표 규칙(관문 「마감 단서」), looksLikeHint 의미, browser-collect.mjs 호출 모양(인자 하나 그대로).

관문: verify/health-gates/qnotice.mjs 「게시판 행 꼬리 · 배너 기간」. (a) cleanTitle/dropBoardRowTail 표본: '2026년 하반기 인재육성 성취(대) 장학생 선발 안내 학생지원팀 2026-09-28 142' → 꼬리 없음, '2026학년도 2학기 교내장학금 신청 안내 학생지원팀 2026-09-02 1,076' → 꼬리 없음, '2026-2 전공페스타 한마당행사 운영 안내 드림디자인칼리지 2026-09-22 2,065' → 꼬리 없음, '2026학년도 2학기 등록금 납부 안내 첨부파일 있음' → '첨부파일 있음' 뗌. 남겨야 할 것: '셔틀 운행 2026-10-05 중단 안내', '서류 마감 2026-10-02 18시', '리포트 집중지도(1차) 참가자 발표(*첨부파일 필독)', '제 36기 미래에셋 해외교환 장학생 선발 안내 2026.09.01.(화)~2026.10.06.(화)'. 앞의 표본에 dropBoardRowTail 을 두 번 입혀도 결과가 같다. (b) 가짜 항공대 3쪽(같은 배너 줄 + 서로 다른 '신청기간 : 2026. 9. 1.( 화 ) ~ 10. 8.( 목 ) 17:00 까지' 류 본문)으로 page-boilerplate buildBoilerplate → hintWithoutChrome 이 각 쪽의 본문 기간을 돌려주고, isChromeHint(배너 힌트) === true, 본문 힌트 === false. (c) 배선: collect.mjs 가 hintWithoutChrome·isChromeHint·dropBoardRowTail 을 쓰는지 정규식으로 본다. deadline-hint.mjs 에 `^import ` 줄이 없는지도 본다(url-key.cjs 보호). 빨간불 증명: cleanTitle 에서 dropBoardRowTail 호출을 빼면 (a) ✕, hintWithoutChrome 이 boiler 를 무시하게 바꾸면 (b) 첫 쪽 힌트가 배너가 되어 ✕.

소급: 🔴 같은 커밋에서 data/registered.json 을 꼭 고친다. test-collector 「링크 사냥꾼의 제목 대조」(4174행)가 실데이터를 읽어 'cleanTitle(boardTitle) !== boardTitle' 이 0건이어야 한다고 본다. 새 규칙이 들어가면 항공대 6건(auto-notiphpcodes1301seq11120·11234·11207·11193·11156·10681)이 걸려 다음 로봇 실행의 데이터 관문이 빨개지고, 그날 자동 등록이 통째로 되돌려진다. admin-apply 의 ALLOWED 에 boardTitle 이 없으므로 ③의 자가 치유 함수를 작업 사본에서 한 번 돌려(같은 코드) name·boardTitle 을 고치고 JSON.stringify(x,null,1) 로 저장한다. 실시간 공고·소식·활동 파일(data/notices/*, notices.json, activities.json)은 손대지 않는다. 다음 수집 실행의 발행 단계(②⑥)가 고친다. 지금 보이는 배너 힌트 19건은 말뭉치에 항공대 본문 20쪽이 있어 다시 계산된다.

파일: collector/clean-title.mjs collector/deadline-hint.mjs collector/collect.mjs collector/auto-register.mjs data/registered.json

위험: collect.mjs 는 feed 묶음(collect-01·05)과 gate 묶음도 고칠 가능성이 크다. 같은 함수(발행 단계)를 건드리니 순서대로 고칠 것. 다른 세션의 기본 브랜치 변경(collect.mjs 청년재단·WISE 규칙 · titleIn)은 행 규칙 자리라 겹치지 않는다. 말뭉치 4MB 를 collect.mjs 가 한 번 더 읽는 비용은 작다. 회전 배너가 바뀐 날 그 호스트 글이 이번 실행에 하나뿐이면 그날은 배너가 걸러지지 않는다. 다음 실행의 ⑥이 고친다.

---
## [collect/collect-07] P2 · confirmed

이유: 걱정하던 일이 오늘 실제로 났다. 10-04 08:56 수집 실행(커밋 12035004 · collector/report.md:224-226)이 항공대 seq10681 '청년창업농장학금'(5월 22일 게시)과 seq11156 을 자동 등록했다. 이어 같은 실행의 발췌 단계가 본문에서 마감을 읽어 각각 2026-07-06·2026-09-23 을 넣었다. 둘 다 등록하는 순간 이미 마감이 지나 있었다. 원인은 진단보다 넓다. auto-register.mjs:135-155 parseDeadline 은 `제목 + deadlineHint` 만 보고, 마감은 워크플로 순서상 그 뒤의 extract-excerpts 가 본문에서 채운다(collect-scholarships.yml: 99행 자동 등록 → 166행 발췌). 그래서 본문에만 기간이 있는 글은 마감 없이(listedAt 을 달고) 등록되고 나중에 지난 마감을 받는다. 항공대만의 일이 아니다. 지금 registered.json 에서 `auto && listedAt && deadline < listedAt` 인 항목이 19건이다(부산·서울대·국민·인하·가톨릭·서울과기대·동국 등). 모두 로봇 값이고 사람이 고친 표식도 합친 기록(alsoPostedAt)도 없다. 진단이 제안한 게시일 90일 규칙으로는 10681 하나만 막고 11156(게시 09-08, 마감 09-23)은 못 막는다. 앱은 마감+30일 동안 '마감' 카드로 보인다(notStale).

수리 명세: ① 새 순수 모듈 collector/notice-deadline.mjs(실행 코드 없음 · 관문이 불러 쓴다): 지금의 parseDeadline(n, today)을 auto-register.mjs 에서 옮기고, `n.bodyDeadline` 이 있으면 그것을 먼저 쓴다(text: '공고 원문'). auto-register 는 이 모듈을 불러 쓰고, 등록할 때 bodyDeadline 에서 온 마감에는 deadlineFrom '공고 원문'을 단다(extract-excerpts putDeadline 과 같은 표식). ② bodyDeadline 을 얻는 두 길. (a) collect.mjs 새 글: collect-04 ⑤의 껍데기 걷은 줄에 activity-excerpts.mjs 의 activityExcerpts(줄).deadline 을 쓴다(장학과 같은 extractDeadline · 새 판독기 금지). 🔴 그 호스트의 boiler 를 모를 때는 계산하지 않는다. 항공대 배너 '접수기간 : 2026.10.15.(목) 13:30까지'가 모든 글의 마감 10-15 로 읽히는 사고를 막기 위해서다. 칸 이름은 `deadline` 이 아니라 `bodyDeadline` 이다. app.js:2994·3135 가 n.deadline 으로 카드를 숨기고 D-day 를 그리므로, deadline 을 쓰면 승인된 화면이 바뀐다. (b) 이미 실린 글(밀린 것): auto-register 가 classify 전에 notices-text.json(+browser-bodies)에서 canonUrl 로 본문을 찾아 같은 방식(껍데기 걷기 → extractDeadline)으로 bodyDeadline 을 채운다. ③ verify/entry-rules.cjs 에 `registeredAfterDeadline(it)` 를 더한다: `it.auto && it.listedAt && it.deadline && it.deadline < it.listedAt && !/^(AI|관리자)/.test(it.deadlineFrom||'') && !it.formId && !(it.alsoPostedAt||[]).length`. checkEntry 에서는 warn 까지만이다(오류로 두면 자동 등록이 멈춘다). auto-register 실행 앞부분(blockIds 되돌리기 옆)에서 이 항목들을 빼고, 리포트에 '등록 뒤 원문에서 마감 경과 확인 — 되돌림 n건'(id 목록)으로 적는다. ②(b) 덕분에 다음 실행의 classify 가 '마감 경과'로 건너뛰므로 다시 등록되지 않는다. ④ (선택) 게시일이 제목 꼬리로 오는 게시판은 dropBoardRowTail 이 뗀 날짜를 postedAt 으로 담고, 마감을 모르는 글이 게시 120일을 넘으면 hold '옛 글 — 컨펌 대기'로 내린다(external-clean.mjs dropReason 과 같은 방식). 바꾸지 말 것: maxPerRun·blockIds/blockUrls·LOAN/EVENT 등 기존 거르기, deadlineQuote 규칙(registered-merge.mjs).

관문: verify/health-gates/qnotice.mjs 「자동 등록 — 원문 마감을 먼저 본다」. notice-deadline.mjs 표본: {title:'청년창업농장학금 신청 안내', deadlineHint:null, bodyDeadline:'2026-07-06'}, today '2026-10-04' → date '2026-07-06'(< today). bodyDeadline 이 없으면 예전처럼 제목 '(~9/17)'에서 읽는다. entry-rules registeredAfterDeadline 표본: 로봇·listedAt 10-04·deadline 07-06 → true. deadlineFrom '관리자 …' → false. formId 있음 → false. alsoPostedAt 있음 → false. deadline ≥ listedAt → false. 배선: auto-register.mjs 가 notice-deadline.mjs 와 registeredAfterDeadline 을 가져다 쓰는지, collect.mjs 가 `bodyDeadline` 을 담는지 정규식으로 본다. 🔴 실데이터의 19건을 세는 고정 검사는 두지 않는다. 그 수는 감사(audit-data.js)의 경고로만 싣는다. 빨간불 증명: parseDeadline 이 bodyDeadline 을 무시하게 되돌리면 첫 표본이 null 이 되어 ✕, registeredAfterDeadline 의 사람 표식 조건을 빼면 '관리자' 표본이 ✕.

소급: 19건(auto-oardid322606menuno200318 … auto-notiphpcodes1301seq10681). 코드가 스스로 고친다: 다음 수집 실행의 auto-register 가 ③으로 뺀다. 수리 커밋에서 하려면 ③의 함수만 작업 사본에서 한 번 적용해 registered.json 을 JSON.stringify(x,null,1) 로 저장한다(auto-register.mjs 는 불러오는 순간 실행되니 import 하지 말 것). collector/pending-forms.json 에 남는 고아 대기열은 gate 묶음 collect-13 이 다룬다. collect-14 의 두 건(seq698·…eca1b0ed9a8c)도 이 19건에 들어 있어 따로 되돌릴 필요가 없다.

파일: collector/auto-register.mjs collector/collect.mjs verify/entry-rules.cjs collector/notice-deadline.mjs data/registered.json

위험: auto-register.mjs·collect.mjs 는 gate·feed 묶음과 겹칠 수 있다. 껍데기를 걷지 않은 본문으로 마감을 읽으면 배너 날짜가 모든 글의 마감이 된다(항공대 실례). 이는 '마감이 지난 것을 열린 것처럼'보다 더 나쁜 '없는 마감'이다. boiler 를 모를 때 계산하지 않는다는 조건을 빼지 말 것. 19건을 지우면 실데이터에 기댄 다른 test-collector 절(예: 「메일 접수 주소」⑥ 메일 등록 0건 아님)이 영향을 받는지 test-collector 를 돌려 볼 것. 지금 메일 등록 11건에서 5bnum57138·leno275925 가 빠지고 app1-04 로 2건이 더 빠져 7건이 남는다.

---
## [collect/collect-14] P3 · confirmed

이유: 코드와 실데이터 둘 다로 확인했다. scope-promote.mjs:43-46 isCandidate·:48-54 isNationalAbsorber 에 마감 조건이 없다. 로봇이 승격한 4건 중 2건이 이미 마감이 지난 뒤 전국으로 풀렸다: auto-ucd000000000000062seq698(부산대 희망사다리Ⅰ · 마감 09-18 · 10-01 승격), auto-202026091720eca1b0ed9a8c(동국대 파안장학 · 마감 09-28 · 10-04 승격). 둘 다 마감+30일 동안 44개교 모든 학생에게 '마감' 카드로 보인다. auto-register.mjs:219 promote 경로에는 마감 검사가 있지만, 바로 위 absorb 경로(211-216)에는 없다. 이미 전국인 지난 회차 등록분이 다음 학기 같은 사업 글을 흡수해 새 회차가 등록되지 않을 수 있다. programKey 가 연도를 떼기 때문이다(entry-rules.cjs:185). 피해가 '마감' 카드에 그쳐 P3 를 유지한다.

수리 명세: ① collector/registered-merge.mjs(실행 코드 없음 · 관리자 merge 와 로봇이 같이 쓰는 곳)에 `openOn(it, today)` = `!it.deadline || it.deadline >= today` 를 내보낸다. ② scope-promote.mjs isCandidate·isNationalAbsorber 에 `openOn(it, TODAY)` 조건을 더한다. ③ 루프(③ 같은 사업 합치기 · ①② 원문 증거) 양쪽 모두 b(합쳐질 쪽)도 마감 전일 때만 합친다. ④ auto-register.mjs:219 의 인라인 `!(twin.deadline && twin.deadline < TODAY)` 를 openOn 으로 바꾸고, absorb 경로(211-216)에도 같은 조건을 건다. 마감이 지난 전국 등록분이 twin 이면 absorb 대신 `{verdict:'hold', why:'같은 사업의 지난 회차(마감 YYYY-MM-DD) — 새 회차인지 컨펌 대기'}`. 바꾸지 말 것: 관리자 merge(tools/admin-apply.mjs)는 사람이 정하므로 마감과 상관없이 그대로 합친다. scope-promote.mjs·auto-register.mjs 는 불러오는 순간 실행되므로 규칙을 그 안에 두지 말고 registered-merge.mjs 에 둔다.

관문: verify/health-gates/qnotice.mjs 「범위 승격은 마감 전만」. registered-merge.mjs 를 불러 openOn 표본을 잰다(마감 없음 → true, 09-18 vs today 10-04 → false, 10-30 → true). 배선: scope-promote.mjs 의 isCandidate·isNationalAbsorber 본문과 auto-register.mjs 의 absorb·promote 두 갈래에 `openOn(` 이 있는지 정규식으로 본다. auto-register.mjs·scope-promote.mjs 는 글자로만 읽고 import 하지 않는다. 빨간불 증명: isCandidate 에서 openOn 조건을 지우면 배선 줄이 ✕, openOn 을 `() => true` 로 바꾸면 표본이 ✕.

소급: 따로 할 것 없다. 지난 채 승격된 2건은 collect-07 의 '등록 뒤 마감 경과' 19건에 들어 있어 거기서 되돌려진다. collect-07 을 고치지 않는다면 admin-apply edit 로 eligibility.schoolOnly 를 되돌린다(부산대학교·동국대학교 · scopeFrom 은 '관리자 …' 표식).

파일: collector/registered-merge.mjs collector/scope-promote.mjs collector/auto-register.mjs

위험: 작다. registered-merge.mjs 는 관리자 merge 도 부르지만, openOn 은 새 함수라 mergeInto 동작은 바뀌지 않는다. auto-register.mjs 는 collect-07 과 같은 파일이라 한 사람이 이어서 고칠 것.

---
## [news/news-7] P3 · confirmed

이유: 꼬리가 붙은 것은 맞지만 진단의 28건에는 원인이 다른 것이 섞여 있다. 실제 행 꼬리는 셋이다. 항공대 소식 13건('… 학생지원팀 2026-10-02 26' · 링크가 행 전체를 감싸 extractLinks→cleanTitle 경로라 cutRowTail 이 닿지 않는다. cutRowTail 은 클릭형 규칙에서만 돌고, 날짜 뒤 '26' 처럼 '조회' 없는 숫자는 받지 않는다: board-links.mjs:148-161). 영남 6건(앞 행 번호 '9 '~'4 ' · clean-title.mjs:61 은 3~5자리 번호만 뗀다). 서울대 1건('… 첨부파일 있음' 꼬리). WISE 1건('… 2026.10.02. 이미영')은 게시일이 10-05 로 잘못 잡혀 cutRowTail 이 날짜를 못 맞춘 것이라 qfeeds 묶음 news-1(미래 게시일) 몫이다. 경북 5건(포토뉴스 본문 꼬리)은 qfeeds 묶음 news-4 몫이다. 아주·강원 2건은 제목 안에 원래 들어 있는 날짜라 꼬리가 아니다. 항공대 몫은 collect-04 의 제목 규칙과 같은 원인·같은 수리다.

수리 명세: ① 항공대·서울대 꼬리는 collect-04 ①의 dropBoardRowTail·'첨부파일 있음' 규칙으로 함께 고쳐진다. 소식 로봇은 extractLinks/resolvedLinks 가 cleanTitle 을 부르므로 새 글은 저절로 깨끗해진다. ② 앞 행 번호: board-links.mjs extractDatedRows 마지막(out 을 돌려주기 직전)에 게시판 단위 규칙을 둔다. 돌려줄 행이 3개 이상이고 그중 80% 이상이 `^\d{1,4}\s+\S` 로 시작하면 그 행들에서만 번호를 뗀다. 한 제목만 보고 1~2자리 숫자를 떼지 말 것('3 대 3 농구대회' 같은 제목이 깨진다). ③ collect-news.mjs 발행 단계(229-232행 · collapseSamePost 앞)에서 실려 있는 글에 소급한다. 제목에 dropBoardRowTail 을 입히고, 학교별로 ②와 같은 함수(번호 떼기 · 순수 함수로 내보내기)를 적용한다. 🔴 주소·postId 는 건드리지 않는다. 목록 표식(#n-제목) 주소는 제목으로 만들어지므로 다시 만들지 말 것(같은 글이 두 번 실린 2026-10-02 사고 · collapseSamePost 주석). 바꾸지 말 것: cutRowTail 의 '게시일과 같은 날짜일 때만' 규칙, 분류 꼬리표를 떼지 않는 규칙(board-links.mjs:162-163).

관문: verify/health-gates/qnotice.mjs 「소식 제목의 행 꼬리·번호」. 가짜 목록 HTML(같은 꼴 주소 4행, 제목 앞에 '9 '·'8 '·'7 '·'6 ' + 행 날짜)로 extractDatedRows → 번호가 없는 제목 4개. 번호가 한 행에만 있는 가짜 목록 → 그 행 제목('3 대 3 농구대회 안내') 그대로. 항공대 꼴(<a> 안에 제목·부서·날짜·조회수) 4행 → 제목만. 발행 소급 함수 표본: 실린 영남 글 6개 꼴 → 번호 없음. 빨간불 증명: extractDatedRows 의 번호 떼기를 빼면 첫 표본이 ✕, 80% 조건을 '한 행이라도'로 바꾸면 둘째 표본이 ✕.

소급: 코드가 스스로 고친다. 다음 교내 소식 실행의 발행 단계(③)가 data/news/<학교>.json 의 항공대 13·영남 6·서울대 1건을 고친다. 소식 파일은 손으로 고치지 않는다.

파일: collector/clean-title.mjs collector/board-links.mjs collector/collect-news.mjs

위험: board-links.mjs·collect-news.mjs 는 qfeeds 묶음(news-1 게시일 · news-4 경북)이 같이 고칠 파일이다. 특히 rowPostedAt·발행 단계라 qfeeds 와 한 사람이 이어서 고칠 것. find-news-boards.mjs 도 extractDatedRows 를 쓰니 찾기 리포트 제목도 같이 바뀐다(무해).

---
## [app1/app1-05] P3 · confirmed

이유: 데이터 오염을 확인했다. data/search-index.json(10-04 · 98건)에서 메뉴 낱말('스킵네비게이션·주메뉴바로가기·로그아웃·학생포탈·eclass·입학도우미·대학공지')을 담은 항목이 7건이다(reg-hi-jeju · auto-rnoticedoarticleno154473 · 서울과기대 2건 · 부산대 2건 · 부경대 1건). chat.js:184 는 원문 요약에 낱말이 있으면 +1 이고 :192 는 점수가 0보다 크면 결과에 넣으므로, '취업'·'학생포탈' 같은 질문에 엉뚱한 공고가 섞인다. 진단의 원인 일부는 고쳐 적는다. reg-hi-jeongeup 의 '포스코비전장학생·자생한방병원'은 목록 표식 때문이 아니다. sourceFor 가 제목으로 제 글을 바르게 찾았고, 그 글의 '이전글·다음글' 줄(다른 공고 제목)이 들어간 것이다. 홍익 2건은 글 화면 옆 '다른 글 목록'(제목 + 날짜 줄) 때문이다. build-search-index.mjs 는 껍데기 걷기(page-boilerplate)를 쓰지 않고, 등록 2건 넘게 나오는 낱말만 뺀다(73-89행). 시험 삼아 껍데기 걷기 + 이전글·다음글 다음 줄 + '날짜만 있는 줄'의 앞줄을 빼 보니 메뉴 낱말 항목이 7→0 이 되었다(홍익 일부 위젯 줄은 남음). 목록 표식 공고를 통째로 빼자는 제안은 맞는 원문까지 잃으므로 하지 않는다. 도우미 화면을 실제로 눌러 보지는 않았다. 문장을 지어내는 것이 아니라 엉뚱한 후보가 섞이는 품질 문제라 P3 로 낮춘다.

수리 명세: ① build-search-index.mjs 를 순수 함수 `buildSearchIndex(items, texts, browserBodies)` 로 내보내고, main() 은 직접 실행할 때만 돌린다(`import.meta.url === pathToFileURL(process.argv[1]).href` · search-index.yml 의 `node collector/build-search-index.mjs` 가 그대로 돌아야 한다). 지금은 불러오는 순간 data/search-index.json 을 덮어쓴다. ② indexTexts(texts, browserBodies) 로 브라우저 본문도 넘긴다. 낱말을 뽑기 전에 본문을 정리한다: (a) notice-source.mjs indexTexts 와 같은 makeStripperMulti([일반 원문, 브라우저 원문])로 껍데기 줄을 걷는다. (b) 말뭉치의 다른 글 제목을 담은 줄을 뺀다. indexTexts 안의 isTitleLine 을 notice-source.mjs 에서 내보내 쓰고, 베끼지 않는다. (c) '이전글|다음글|이전 글|다음 글' 줄과 그 다음 두 줄을 뺀다. (d) 바로 다음 줄이 날짜만 있는 줄(`^20\d{2}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2}\.?$`)이면 그 줄과 날짜 줄을 뺀다(목록 위젯). ③ 문서 빈도(tooCommon=2)·PER_ITEM·TOTAL_BUDGET 은 그대로다. chat.js 는 바꾸지 않는다. 바꾸지 말 것: '문장을 만들지 않는다 · 앱이 가진 낱말은 뺀다' 두 원칙(파일 머리말), notice-source.mjs 의 import 목록. 관리자 화면이 이 파일을 vendor 로 복사하므로(_admin/build.sh:42) 새 import 를 더하지 말 것.

관문: verify/health-gates/qnotice.mjs 「도우미 검색 재료에 메뉴·남의 제목이 없다」. 같은 호스트 가짜 원문 4쪽. 공통 줄은 '스킵네비게이션'·'주메뉴바로가기'·'로그아웃'·'학생포탈'이고, 쪽마다 고유 낱말이 하나씩(예: '도토리장학회') 있다. 한 쪽에는 '이전글' + 다른 쪽 제목 줄, '다른 글 제목' + '2026.08.03' 줄 쌍을 둔다. buildSearchIndex 결과의 각 항목에 메뉴 낱말과 남의 제목 낱말이 없고, 제 고유 낱말은 있다. 함수가 파일을 쓰지 않는지(불러도 data/search-index.json 수정 시각이 그대로인지 또는 fs 쓰기 없음) 정규식으로 본다. 빨간불 증명: 껍데기 걷기를 빼면 '로그아웃'이 들어와 ✕, 이전글 처리를 빼면 남의 제목 낱말이 들어와 ✕.

소급: 코드가 스스로 고친다. search-index.yml 이 수집 로봇 뒤(workflow_run)에 돌며 다시 만든다. 수리 커밋에서 `node collector/build-search-index.mjs` 를 한 번 돌려 data/search-index.json 을 같이 올려도 된다. 이 파일은 학생 폰이 받으니 크기 출력(120KB 예산)을 확인한다.

파일: collector/build-search-index.mjs collector/notice-source.mjs data/search-index.json

위험: notice-source.mjs 는 bodies 묶음(본문 판정)이 고칠 수 있다. isTitleLine 을 내보내는 정도로 좁혀 고칠 것. 위젯 줄 규칙(d)이 본문의 '접수 마감일 / 2026.10.12' 같은 짝도 빼지만, 검색 낱말 자루라 손해가 작다.

---
## [app1/app1-11] P3 · confirmed

이유: 표가 3개뿐인 것도 맞고, 표를 채우라고 만든 도구가 구조적으로 아무것도 못 찾는다는 것이 핵심이다. collector/portal-candidates.mjs:18-31 은 등록 항목의 applyPortal 만 모은다. 그런데 applyPortal 은 findApplyPortal 이 PORTAL_SYSTEMS(apply-channel.js:136-140 · HUFS Ability·종합정보시스템·인포21)에 있는 이름만 채운다. 게다가 이미 표에 있는 학교(경희·외대)는 뺀다. 그래서 새 시스템을 영영 못 찾고 오늘 결과는 `items: []` 다(collector/portal-candidates.json). 원문에는 시스템 이름이 실제로 있다. 열린 등록분에서 확인한 것: 고려대 3건 '포털(KUPID) → 학사 → 등록·장학 → … → 장학금 신청', 국민대 'ON 국민 - 포털 - 학생서비스 - 장학정보 - 장학신청', 중앙대 '중앙대학교 포탈 신청 / 경로 : 포탈 > 학사마당 > 교내외장학신청', 건국대 '학사정보시스템에서 신청'. 시스템 이름은 원문 인용으로만 넣고 주소는 확인한 것만 넣는다는 규칙(원칙 9 · data.js:417 '종합정보시스템' url '')이 이미 있어서, 이름만 넣는 것은 개발자 결정 없이도 규칙 안이다.

수리 명세: ① portal-candidates.mjs 의 본편을 직접 실행할 때만 돌게 감싸고(지금은 불러오는 순간 portal-candidates.json 을 쓴다), 순수 함수 `portalNameCandidates(lines)` 를 내보낸다. 신청을 말하는 줄(apply-channel.js 의 PORTAL_SUBMIT 과 같은 판정 · PORTAL_NOT_SUBMIT·NOT_EVIDENCE 에 걸리면 버림 · '출력'·'다운로드' 줄도 버림)에서 `포털\s*\(([A-Za-z][A-Za-z0-9 ]{1,15})\)`·`([A-Z]{2,}[A-Za-z0-9]*|ON\s?[가-힣]{2,4})\s*[-–>→]\s*포[털탈]` 같은 고유 이름 꼴과 '…(포털|포탈|정보시스템)에서 신청'의 앞 낱말을 뽑는다. 본편은 registered 항목 원문(notices-text.json · sourceFor)에서 학교별로 세어, 이름·건수·근거 문장 두 줄을 portal-candidates.json 과 리포트에 싣는다. ② (선조치후보고) 학교 고유 이름이고 원문 근거가 2건 이상인 것만 PORTAL_SYSTEMS·PORTAL_SYSTEM_INFO 에 **같은 열쇠 글자**로, url '' 인 '이름만' 항목으로 더한다. 지금 기준으로는 'KUPID'(고려대 3건)가 해당한다. 'ON 국민'은 1건이라 리포트 후보에만 둔다. '포탈'·'학사정보시스템'처럼 여러 학교에 흔한 이름은 열쇠로 쓰지 않는다. 주소는 정찰(run-probe.txt checkUrl:)로 제목을 확인한 뒤에만 verifiedTitle·verifiedAt 과 함께 넣는다. 바꾸지 말 것: 길은 원문 인용 그대로 보이는 규칙(app.js schoolPortalNote), 열쇠 대조 관문 「포털 신청 시스템」.

관문: verify/health-gates/qnotice.mjs 「포털 후보는 원문에서 이름을 찾는다」. portalNameCandidates 표본(실제 원문 줄): '가. 포털(KUPID) → 학사 → 등록·장학 → 장학(일반) → 장학금 신청' → 'KUPID'. 'ㅇ 신청방법 : ON 국민 - 포털 - 학생서비스 - 장학정보 - 장학신청' → 'ON 국민'. '가. 장학금수혜신청서 ( 인하대학교 포털시스템에서 출력 ) 1 부' → 없음(출력). '문의: 학생지원팀 KUPID 공지 참고' → 없음(내는 행위 없음). 불러도 파일을 쓰지 않는지 portal-candidates.mjs 글자로 본다(직접 실행 감싸기). ②를 했다면 기존 test-collector 「포털 신청 시스템」 절이 PORTAL_SYSTEMS↔PORTAL_SYSTEM_INFO 열쇠를 대조하므로 그것도 초록이어야 한다. 빨간불 증명: 함수를 applyPortal 모으기로 되돌리면 첫 표본이 ✕.

소급: ② 를 하면 다음 수집 실행의 extract-excerpts(fillApplyPortal)가 applyPortal 이 비어 있는 등록분에 새 이름을 채운다. 이미 채워진 값은 덮지 않으므로 고려대 3건이 그렇게 채워진다. 손으로 고칠 데이터는 없다.

파일: collector/portal-candidates.mjs apply-channel.js data.js

위험: apply-channel.js·data.js 는 앱·관리자 화면·서비스워커가 같이 싣는 파일이다(data.js 는 다른 세션이 officialChannel 을 고침 · 기본 브랜치에 합쳐짐). 다른 함수라 충돌은 적지만 최신 기본 브랜치에서 시작할 것. 흔한 이름을 열쇠로 넣으면 다른 학교 공고까지 그 시스템으로 묶이니 ②의 '고유 이름 · 2건 이상' 조건을 지킬 것.

---
## [app1/app1-09] P3 · needs-human
**결정(추천안 ① — 2026-09-17 개발자 결정 "앱 사정은 학생 화면에 적지 않는다"와 같은 규칙): 카드 윗줄에서 '주관 기관 원문 확인'을 빼고 '교외'만 보인다. 이 모습을 잠그던 검사 줄도 같이 고친다(검사만 고쳐 통과시키지 말고 화면을 바꾼 뒤 드라이버를 옮긴다).**

이유: 사실은 맞다. app.js:398-409 cardOrgLine 은 기관명이 '주관 기관 원문 확인'이어도 `${type} · ${prov}` 를 그대로 잇는다. 정식 등록 160건 중 140건이 그 값이다. 같은 글자를 제출처(data.js:541 knownProvider)·지원서(app.js:2087-2092)·도우미(chat.js:167)는 '앱 내부 사정'이라며 숨기고, test-collector 2880행 주석도 같은 말을 한다. 그런데 test-collector 7792행 「카드 제목」 관문은 '기관명을 못 읽은 공고도 예전 그대로 → 교외 · 주관 기관 원문 확인'으로 지금 모습을 잠가 두었다. app.js:387 주석도 '예전처럼 그대로 뜬다'고 적었다. 승인된 카드 화면이라 바꿀지 말지는 개발자가 정한다.

수리 명세: (①을 고를 경우) app.js cardOrgLine 첫머리에서 `/원문 확인|미확인/.test(prov)` 이면 `String(sch.type || '')` 를 돌려준다. 규칙은 data.js officialChannel 의 knownProvider 와 같은 정규식이다. 한 곳에서 부르도록 match-engine.js 나 data.js 의 작은 함수로 내보낼 수도 있다. 같은 커밋에서 test-collector.mjs 7791-7793 기대값을 '교외'로 옮기고, verify/what-shows.mjs 출력(카드 윗줄)을 다시 확인한다.

관문: (없음)

소급: (없음)

파일: app.js verify/test-collector.mjs

위험: 승인된 화면이라 approved-design 스킬을 거칠 것. test-collector.mjs 는 다른 세션 변경이 합쳐진 파일이라 최신 기본 브랜치에서 고칠 것.

---
## [app1/app1-03] P1 · needs-human
**결정: 비용이 드는 AI 변환 재개는 개발자에게 묻는다. 결정 없이 할 수 있는 ③(수집 리포트에 '양식이 붙은 열린 공고 수'를 숫자로 띄우고 0~1이면 눈에 띄게)은 한다.**

이유: 사실이다. 오늘 기준 열린 정식 등록(마감 없음 또는 마감 ≥ 10-04)은 86건이고 그중 formId 가 있는 것은 3건이다. reg-hi-jeju·reg-hi-jeongeup 은 마감이 없고 listedAt 이 07-16 이라 notStale(60일)로 이미 화면에서 사라졌다. 그래서 학생이 실제로 양식을 열 수 있는 것은 auto-ent2431266737artclviewdo(한국외대 AI 멘토 계획서) 1건이다. collector/schematize-config.json 은 apiEnabled:false(08-20 비용 누수 조사 뒤 꺼짐)이고, 같은 파일 주석대로 무료 변환기는 품질 관문 때문에 0건이 정상 결과다. 남은 길은 유료 경로를 켜거나 세션이 손으로 옮기는 것(원칙 5 ②)인데, 둘 다 돈이나 사람 시간이 드는 결정이다. 다만 '양식 붙은 열린 공고 수'를 리포트에 숫자로 띄우는 일은 결정 없이 할 수 있다.

수리 명세: (결정과 상관없이 할 수 있는 것) 수집 리포트(collector/report.md · schematize 단계 절)에 '양식 붙은 열린 공고 n건 / 열린 공고 m건'을 싣는다. 계산은 notStale 과 같은 기준이어야 하므로 match-engine.js notStale 을 Node 에서 불러 쓴다(베끼지 말 것). ① 을 고르면 schematize-config.json apiEnabled:true · maxApiCallsPerRun 그대로 2로 둔다. 켜기 전 리포트의 'API 경로 대상' 목록을 개발자에게 보인다.

관문: (없음)

소급: (없음)

파일: collector/schematize-config.json collector/schematize-forms.mjs data/registered.json data/forms.json

위험: ①은 유료다. 08-20 누수(같은 파일 재전송)는 6회 실패 중단·신청서 아닌 첨부 차단으로 막혀 있지만, 켠 뒤 첫 리포트를 꼭 확인할 것. schematize-forms.mjs 는 불러오는 순간 실행되니 관문에서 import 하지 말 것.

---
## [app1/app1-08] P3 · needs-human
**결정(추천안 ①): 같은 사업의 옛 양식 후보를 리포트에만 띄운다(자동으로 잇지 않는다).**

이유: 숫자를 확인했다. data/forms.json templates 56종 중 정식 등록이 formId 로 쓰는 것은 19종이고 37종은 어떤 등록도 쓰지 않는다. forms.js:152-159 loadFormTemplates 가 앱에서 이 파일 전체(244KB · 들여쓰기 포함)를 받는다. 8-30 정식 등록 211건 삭제 때 양식만 남았다. 새로 수집된 같은 사업(예: 세종이도인재장학금)은 새 id 로 들어와 옛 템플릿과 이어지지 않는다. 양식은 해마다 바뀔 수 있어 자동으로 잇는 것은 위험하다. 그래서 잇기·보관은 개발자 결정이다.

수리 명세: (①) 리포트 생성 단계에서 programKey(verify/entry-rules.cjs)로 '열린 등록분 ↔ 안 쓰는 템플릿(템플릿 이름·대상 이름)' 짝 후보를 뽑아 리포트에 싣는다. 잇기는 tools/admin-apply.mjs edit 로 formId 만 넣는다(ALLOWED 에 formId 있음). (결정 없이 가능) verify/verify-new-forms.js 가 verify-forms-data 처럼 표본 공고를 심어 UI 구간을 늘 돌린다. 지금은 '삼일·명지 고시 UI 구동 건너뜀'이 영구히 조용하다.

관문: (없음)

소급: (없음)

파일: data/forms.json collector/pending-forms.json verify/verify-new-forms.js forms.js

위험: ② 를 하면 앱이 forms.json 대신 보관 파일을 안 받으므로, 옛 신청 내역(app.formAns)이 그 양식을 참조하는 학생의 '작성한 양식 문서' 화면이 깨질 수 있다. 신청 내역이 참조하는 formId 는 남겨야 한다.
