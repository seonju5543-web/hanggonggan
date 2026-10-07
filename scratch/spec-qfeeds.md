# 수리 명세 — 묶음 qfeeds

권장 순서: news-1 → collect-09 → api-01 → app2-F6 → app2-F7 → api-06 → news-4 → news-12 → news-13 → api-10 → api-11 → news-11 → api-08 → news-9 → api-13 → news-5 → news-8 → api-03 → api-05 → api-12
예상 손댈 파일: collector/news-kind.mjs collector/collect-news.mjs collector/news-config.json data/news/nf097dk.json data/admin-log.json collector/external-clean.mjs collector/collect.mjs data/external.json tools/merge-json-union.mjs collector/activity-excerpts.mjs collector/activity-docs.mjs data/activities.json collector/open-api-map.mjs collector/open-api.mjs collector/find-boards.mjs .github/workflows/collect-news.yml verify/health-gates/qfeeds.mjs verify/health-gates.mjs

검증 메모: 검증 기준: 기본 브랜치 최신 f33987da(2026-10-04 10:03Z). 작업 브랜치 46f08990 은 그보다 25커밋 뒤처져 있고, 동시 세션(source-link-integrity)은 08f663d7 한 커밋만 빼고 이미 기본 브랜치에 합쳐졌다. 수리 담당은 손대기 전에 origin/claude/nice-heisenberg-WESq5 를 먼저 합쳐야 한다. 이 묶음이 고칠 collect.mjs·robots.mjs·open-api*.mjs·activity-excerpts.mjs·find-boards.mjs·news-sources.json 이 그 사이에 바뀌었다.
새로 지은 커밋이 처리한 것: api-05(1a09466c robots 별표 해석), news-5·news-8(b444b603 둘째 게시판·경북 학사공지·소식 0건 이슈 조건), api-03(ac930fb7).
🔴 수리 전에 꼭 알 것 ①: test-collector.mjs 1906행 「저장된 data/external.json 이 이미 걸러져 있다」는 실데이터 검사다. dropReason 에 규칙을 더하는 순간 지금 데이터(마감 지난 6~9건) 때문에 빨개진다. 그래서 collect-09 수리 커밋에 data/external.json 백필을 반드시 같이 넣는다. 안 넣으면 소식 로봇의 데이터 관문(test-collector)이 실패해 소식 발행이 되돌려진다. 이 줄을 audit-data.js 경고로 옮기는 일(CLAUDE.md '실데이터 관문 금지')은 별도 후속으로 권한다. 이 묶음에서는 test-collector.mjs 를 고치지 않는다.
🔴 ②: app2-F7 로 external.json 이 합집합 병합되면 병합이 버린 글을 되살려 같은 1906행이 빨개질 수 있다. 그래서 external 병합 규칙은 합친 뒤 tidyExternal·dropReason 을 다시 건다.
③: news-4 백필은 tools/admin-apply.mjs 를 써서 data/admin-log.json 에 줄을 남긴다. 미합류 커밋 08f663d7 도 같은 파일을 고치므로 줄 충돌이 날 수 있다(합집합 병합 대상이 아님).
④: eligibility-fill.yml 도 sharp 를 버전 없이 설치한다(141행). 이 묶음 범위 밖이라 손대지 않았다. 고정하려면 그 파일을 맡은 묶음과 맞춘다.
관문은 전부 새 파일 verify/health-gates/qfeeds.mjs 에 둔다(표본만 쓴다). verify/health-gates.mjs 의 PARTS 에 'qfeeds' 를 더한다.


---
## [news-1] P1 · confirmed

이유: 오늘(10-04) 실측으로 미래 게시일 글은 7건이다(아주 3 · 방송대 1 · 성균관 1 · 강원 1 · 동국 WISE 1). 앱과 같은 정렬(app.js:3341 postedAt||foundAt 내림차순)로 홈 띠 첫 카드를 뽑아 보니 아주대 '어학졸업인증 …(~2027.1.22)'·게시 2027-01-22, 방송대 2027-01-01, 성균관 2026-10-21 이다. 진단 뒤에 상황이 더 나빠졌다. b444b603 의 newsFloor(news-kind.mjs:71)는 학교마다 postedAt||foundAt 기준 최근 4건을 기한과 상관없이 남긴다. 그래서 미래 날짜 글은 30일 뒤에도 빠지지 않고 2027-01까지 맨 위에 남는다. 원인은 둘이다. ① 발행(collect-news.mjs:229-239)이 하한만 보고 상한(오늘 이후) 검사가 없다. ② board-links.mjs:140-143·209 의 '앞날은 비운다' 규칙(247b89f9)은 새로 읽는 줄에만 걸리고, 규칙형 게시판·옛 글에는 소급되지 않는다.

수리 명세: ① news-kind.mjs 에 순수 함수 `export function clearFuturePosted(items, today)` 를 둔다. postedAt 이 today(KST 'YYYY-MM-DD')보다 뒤인 글은 postedAt 칸을 지우고, 지운 개수를 돌려준다. 글자는 바꾸지 않는다. ② collect-news.mjs 발행 단계에서 `const floor = newsFloor(all, NEWS_MIN_KEEP)`(237행) **바로 앞**에서 `clearFuturePosted(all, todayStr())` 를 부른다. todayStr 는 이미 있는 KST 시계다. newsFloor·보관 기한·학교별 파일이 모두 정리된 값을 보게 하고, 새 글·실린 글 구분 없이 한 곳에서 다 거른다. ③ 바꾸지 말 것: 앱(app.js) 정렬·표시, board-links 의 수집 규칙(이미 맞다), 60일 하한. ④ verify/audit-data.js 에 오류를 더하지 않는다. 병합으로 되살아난 미래 날짜 하나가 장학 수집 로봇의 감사까지 빨갛게 만들어 자동 등록분이 되돌려질 수 있다(CLAUDE.md 2026-10-01 사고와 같은 꼴). 강제는 로봇의 발행 한 곳으로 충분하다.

관문: health-gates/qfeeds.mjs 「미래 게시일」. 표본: [{postedAt:'2027-01-22',foundAt:'2026-10-01'},{postedAt:'2026-10-04',foundAt:'2026-10-02'},{foundAt:'2026-10-03'}], today='2026-10-04'. clearFuturePosted 뒤 첫 글만 postedAt 이 없고 둘째·셋째는 그대로인지 본다. 같은 학교 글 5건 표본에 newsFloor(…,4)를 돌려 미래 날짜 글이 더는 '게시일 1위'로 남지 않는지 본다. 정적 검사: collect-news.mjs 에서 `clearFuturePosted(all` 이 `newsFloor(all` 보다 앞에 있다. 빨간불 확인: 함수 몸통을 비우거나 호출 줄을 지우면 셋 다 빨개진다.

소급: 코드만으로 다음 소식 로봇 실행(하루 2회 · 늦어도 12시간 안)이 실린 글 전부에 소급한다. 바로 반영하려면 기본 브랜치에서 collector/run-news.txt 를 고쳐 push 한다(push-to-run). 손으로 data/news 를 고치지 않는다.

파일: collector/news-kind.mjs collector/collect-news.mjs verify/health-gates/qfeeds.mjs

위험: 낮음. postedAt 이 오늘인 글은 지우지 않는다(같은 날은 남김). 로봇이 UTC 시계를 쓰면 KST 00~09시에 오늘 글을 미래로 오판하므로 반드시 todayStr()(KST)를 쓴다.

---
## [collect-09] P2 · confirmed

이유: data/external.json(updatedAt 10-04) 48건 가운데 deadline 이 오늘보다 앞인 글이 6건이다. 음성군장학회 09-18 둘, 송파 상반기 06-24, 해외문화체험 05-29, 슬로바키아 07-31, 송파 하반기 10-02. 재단 글도 수집 때 deadline 을 만든다(collect.mjs:402-404 activityExcerpts · 247b89f9 이후 · 15건에 있음). 그런데 발행의 dropReason(external-clean.mjs:72)은 게시일 나이·제목 연도만 보고 마감을 보지 않는다. external-clean.mjs 머리말은 '앱에서 따로 거르지 않는다(규칙이 두 벌)'라고 정해 두었으니, 수리 자리는 로봇의 dropReason 한 곳이 맞다.

수리 명세: ① external-clean.mjs 의 dropReason(n, today) 에 '마감 지남' 규칙을 넣는다. n.deadline 이 있고 `n.deadline < today−1일` 이면 문자열 '마감 지남'을 돌려준다. 이유 문자열에 숫자를 넣지 않는다. collect.mjs 의 extDropped 집계가 숫자가 든 이유를 '옛 글'로 뭉치기 때문이다. 하루 여유는 앱의 CLOSED_KEEP_DAYS(=1, 장학·활동 목록 '마감 다음 날까지')와 같은 뜻이고, 주석에 그 이름을 적는다. 이 규칙은 NOT_APPLY·SITE_MENU 검사 뒤, 게시일 나이 검사 앞에 둔다. ② 마감 표식(api-01 ②)도 같은 자리에 넣는다. 제목 맨 앞의 `[마감]`·`(마감)`·`[모집마감]` 이면 '마감 표식'. 정규식은 `^\s*[\[［(（]\s*(?:모집\s*)?마감\s*[\]］)）]`. '[마감임박]'은 남긴다. ③ 마감 칸이 없는 옛 글 소급(api-01 ①). external-clean.mjs 에 `export function fillDeadlineFromHint(n, deadlineOf)` 를 둔다. n.deadline 이 없고 n.deadlineHint 가 있으면 deadlineOf(n.deadlineHint) 결과를 n.deadline 에 넣는다. external-clean.mjs 는 지금처럼 아무것도 import 하지 않는다. collect.mjs 597행 `ext.items = ext.items.map(tidyExternal).filter(…)` **바로 앞 줄**에 `ext.items.forEach((n) => fillDeadlineFromHint(n, (t) => activityExcerpts(t).deadline));` 를 넣는다. 수집 때와 같은 함수다. 597행 모양은 그대로 둔다(test-collector 1903행 정적 정규식이 그 모양을 잰다). ④ 바꾸지 말 것: app.js(externalNoticesForMe), 날짜 없는 글은 짐작해 빼지 않는다는 규칙(원칙 8-1 · 삼원·지헌 기수 글은 api-01 질문), 60일·EXT_CAP.

관문: health-gates/qfeeds.mjs 「재단 새 공고 — 마감 지난 글」. today='2026-10-04' 로 dropReason({title:'2026년 군민평생 장학생 선발 공고',deadline:'2026-09-18'}) === '마감 지남'. deadline '2026-10-03' 이면 null(다음 날까지 남김). '2026-10-10' 이면 null. deadline 이 없으면 null. dropReason({title:"[마감] '원거리 진학 대학생 주거 장학금' 대상자 모집"}) 은 참. '[마감임박] 2026 장학생 모집 공고' 는 null. fillDeadlineFromHint({deadlineHint:'신청기간 : 2026. 8. 31.(월) ～ 9. 18.(금)'}, 가짜 deadlineOf) 가 deadline 을 채우고, 이미 deadline 이 있는 글은 건드리지 않는다. 정적 검사: collect.mjs 에서 fillDeadlineFromHint 호출이 `ext.items.map(tidyExternal)` 줄보다 앞에 있다. 빨간불 확인: 마감 규칙·표식 규칙·호출 줄을 하나씩 되돌리면 해당 항목이 빨개진다.

소급: 🔴 같은 커밋에 data/external.json 을 다시 거른다. test-collector 1906행이 저장된 파일에 새 dropReason 을 걸어 보므로, 백필이 없으면 다른 로봇(소식)의 데이터 관문이 실패한다. 방법: 한 번만 돌리는 node 스크립트로 external-clean.mjs·activity-excerpts.mjs 를 불러 ext.items 에 fillDeadlineFromHint → tidyExternal → `!dropReason(n, ext.updatedAt)` 순으로 건다. 저장은 collect.mjs 와 같은 `JSON.stringify(ext, null, 1)`(끝 줄바꿈 없음)이다. collect.mjs 전체를 돌리지 않는다(학교 사이트를 두드린다). 예상 제거는 마감 6 + 마감 문구에서 읽은 2(영동 09-18·김해 03-20) + [마감] 1(고속도로장학재단) = 9건 안팎이다. 그 뒤 node verify/test-collector.mjs 와 node verify/audit-data.js 로 확인한다.

파일: collector/external-clean.mjs collector/collect.mjs data/external.json verify/health-gates/qfeeds.mjs

위험: ① 여러 회차 공고에서 첫 회차 마감만 읽으면, 아직 열린 다음 회차 글이 빠질 수 있다. 활동 탭과 같은 extractDeadline 을 쓰므로 위험은 활동 탭과 같은 수준이다. ② 백필을 빠뜨리면 1906행이 빨개진다(위 참조). ③ collect.mjs 는 api-06·api-11 도 같은 파일을 고친다. 한 수리 담당이 차례로 고친다.

---
## [api-01] P2 · confirmed

이유: 증상은 맞다. 마감 지난 글 6건(+마감 문구로만 확인되는 영동·김해 2건), 제목에 [마감]이 붙은 고속도로장학재단 1건, 삼원·지헌 기수 공고 12건(foundAt 09-30, 날짜 없음)이 '새 공고'로 뜬다. 진단에서 틀린 곳이 둘 있다. ① '외부 글에는 deadline 칸이 아예 없다'는 틀렸다. 15/48건에 있고 collect.mjs:402-404 가 만든다. ② '카드에 마감 표시도 없다'도 마감 칸이 있는 글에는 틀렸다. externalNoticesHtml 이 dday 이름표로 '마감'을 그린다. 그래서 P1 이 아니라 P2 다. 이름표가 있는 소음일 뿐 잘못된 판정은 아니다. ①·②는 collect-09 와 한 수리다. ③ 날짜 없는 지난 기수 공고는 external-clean.mjs:14 의 '짐작해 빼지 않는다'(원칙 8-1)와 부딪혀 개발자 결정이 필요하다.

수리 명세: ①(마감 문구에서 마감 소급)과 ②([마감] 표식)는 collect-09 의 fixSpec ②·③ 그대로다. 같은 커밋, 같은 관문. ③ 기수 공고는 개발자 답을 받기 전에는 고치지 않는다. 답이 ①(가장 큰 기수만)이면 external-clean.mjs 에 `export function latestCohortOnly(items)` 를 둔다. 같은 host 이고 제목에 '제\s*(\d+)\s*기'가 있으며 날짜(postedAt·deadline)가 없는 글을 제목의 재단 이름 꼴('(재)○○장학재단')별로 묶어, 가장 큰 N(같은 N이면 '후기' > '전기')만 남긴다. 발행에서 dropReason 다음에 건다. 날짜가 있는 글에는 걸지 않는다.

관문: collect-09 관문과 같다. ③을 고르면 표본에 '제 24기 후기 (재)삼원장학재단'·'제 24기 전기 (재)삼원'·'제 23기 전기 (재)지헌'·'제 22기 후기 (재)지헌'을 넣고 삼원 24기 후기·지헌 23기 전기만 남는지 본다. 빨간불 확인: 함수 호출을 빼면 넷 다 남는다.

소급: collect-09 백필과 한 번에 한다. ③을 고르면 같은 한 번짜리 스크립트에 latestCohortOnly 를 더한다.

파일: collector/external-clean.mjs collector/collect.mjs data/external.json

위험: ③은 삼원·지헌이 지금 몇 기를 모집하는지 원문으로 확인하지 못했다(샌드박스에서 막힘). 가장 큰 기수도 지난 공고일 수 있다.

---
## [app2-F6] P2 · confirmed

이유: 증상(홈 재단 구역의 마감 지난 6건)은 collect-09 와 같고 오늘도 그대로다(app.js:3263-3270 externalNoticesForMe 는 마감을 안 본다). 다만 제안한 수리(앱에 CLOSED_KEEP_DAYS 거름 추가)는 external-clean.mjs 머리말의 확정 규칙 '앱에서 따로 거르지 않는다(규칙이 두 벌이 된다)'와 부딪힌다. 그래서 수리 자리를 로봇의 dropReason 으로 옮긴다. 그 수리 안에 마감 다음 날까지 남기는 하루 여유를 넣어, 활동 탭의 CLOSED_KEEP_DAYS 와 뜻을 맞춘다.

수리 명세: collect-09 와 한 수리(그쪽 fixSpec·백필·관문). app.js 와 verify-activities.js 는 건드리지 않는다.

관문: collect-09 와 같다(따로 만들지 않는다).

소급: collect-09 와 같다.

파일: collector/external-clean.mjs collector/collect.mjs data/external.json

위험: 로봇이 멈추면 앱은 마감 지난 글을 '마감' 이름표로 계속 보인다. 정직한 표시라 받아들일 수 있다.

---
## [app2-F7] P2 · confirmed

이유: .gitattributes 의 merge=jsonunion 18줄마다 병합기(tools/merge-json-union.mjs)에 {} 표본을 넣어 돌려 보았다. data/activities.json·collector/seen-activities.json·data/external.json·collector/seen-external.json 넷만 '규칙 없는 파일이라 자동 병합하지 않음'으로 종료코드 1 이었다(RULES 213-235행에 해당 정규식이 없고, `(^|/)seen\.json$` 는 seen-activities 를 못 잡는다). activities.json 은 대기줄이 다른 eligibility-fill(eligibility-ai)과 collector 줄(collect·open-api·admin-apply)이 같이 쓰고, 사람 세션의 기본 브랜치 병합에서도 이 병합기가 불린다. 실제 손실 사례는 못 찾았다(잠재 위험). 그래도 고장 경로(pull --rebase 3회 실패 → 그 실행 결과 버림)는 이슈 #85·#86과 같은 꼴이다.

수리 명세: ① RULES 에 넷을 더한다. ⓐ `(^|\/)data\/activities\.json$` → 새 함수 mergeFeed(o,t). 두 쪽 items 를 합쳐 foundAt 내림차순으로 정렬하고 dedupeNotices(url-key.mjs · 수집기와 같은 함수)만 건다. 🔴 capNotices 는 쓰지 않는다. 학교 없는 전국 글이 열쇠 하나('|')로 묶여 40건으로 잘린다. 상한은 다음 수집 실행의 ACT_CAP 이 다시 건다. updatedAt 은 두 쪽 중 큰 값. ⓑ `(^|\/)data\/external\.json$` → mergeFeed 뒤에 external-clean.mjs 의 tidyExternal 과 `!dropReason(n, updatedAt)` 을 다시 건다. 병합이 로봇이 버린 글을 되살리지 않게 해서, 실데이터 검사 test-collector 1906행이 병합 직후 빨개지지 않게 한다. external-clean.mjs 는 순수 모듈이라 불러도 된다. ⓒ `(^|\/)seen-(?:activities|external)\.json$` → 기존 mergeSeen(이른 날짜를 남긴다). ② 바꾸지 말 것: registered.json·forms.json 은 계속 대상 밖(삭제가 뜻을 가진다), 기존 규칙의 순서와 동작, .gitattributes(이미 맞다).

관문: health-gates/qfeeds.mjs 「합집합 병합기가 jsonunion 파일을 전부 안다」. .gitattributes 의 `merge=jsonunion` 줄을 모두 읽어 경로의 *를 'x'로 바꾼 뒤, 임시 폴더(os.tmpdir)에 {} 세 개를 써서 spawnSync(node tools/merge-json-union.mjs base ours theirs <경로>) 를 돌린다. 하나도 '규칙 없는 파일'을 내지 않고 종료코드가 0 이어야 한다. 저장소 설정 파일만 읽고 데이터는 안 읽는다. 추가 표본 셋: ① activities — 두 쪽에 학교 없는 서로 다른 글 60건씩을 넣으면 합친 결과가 120건(40건으로 잘리지 않음). ② external — 상대 쪽에만 있는 deadline '2026-09-18' 글이 updatedAt '2026-10-04' 로 합치면 사라진다. ③ seen-activities — 같은 열쇠의 이른 날짜가 남는다. 빨간불 확인: 넷 중 아무 규칙이나 지우면 첫 항목이 빨개지고, capNotices 로 바꾸면 ①이 빨개진다.

소급: 없음. 저장된 데이터는 바뀌지 않는다.

파일: tools/merge-json-union.mjs verify/health-gates/qfeeds.mjs

위험: tools/merge-json-union.mjs 를 다른 묶음(협업·병합)도 고칠 수 있다. 병합기를 부르는 모든 경로(로봇 rebase·사람 merge)에 영향이 있다. 규칙이 더해질 뿐 기존 파일의 동작은 그대로다.

---
## [api-06] P2 · confirmed

이유: 오늘 data/activities.json 의 K-Startup pbancSn=179371 '2026년 SaaS 전환지원센터xAWS SaaS 현대화 교육 4회차'를 확인했다. eligibilityFrom '브라우저 본문', 자격 줄 셋 가운데 '신청 시 요청하는 정보(개인정보포함)는 … 유의하여 주시기 바랍니다.'와 '대상연령 : 만 20세 이상 ~ 만 39세 이하, 만 40세 이상'이 들어 있다. collector/act-browser.json 장부에도 같은 세 줄이 있다. match-engine.fitDetail 을 직접 돌리니 45세는 fails 에 그 나이 줄(pct 5), 25세는 met 1/1 이었다. 원문은 40세 이상도 받으므로 틀린 미달이다. API 매퍼는 여러 갈래 나이를 자격으로 안 쓰는데(open-api-map.mjs:195 `!/,/.test(r.biz_trgt_age)`), 본문·첨부·브라우저 경로가 쓰는 activityDetails 의 납작한 표 잇기(activity-excerpts.mjs:78 TABLE_LABEL '대상 연령' · joinTablePairs)에는 그 규칙이 없다. 8610f25a('해당없음' 거름)는 이 경우를 다루지 않는다.

수리 명세: ① activity-excerpts.mjs 에 순수 함수 `export function eligLineOk(line)` 를 둔다. 거짓을 돌려주는 경우는 둘이다. (a) 나이 줄: 이름표가 (대상)?연령·나이이고, 콜론 뒤 값을 쉼표로 나누면 '세'가 든 조각이 둘 이상인 줄. 'API 매퍼와 같은 뜻 — 여러 갈래 나이는 자격 줄로 쓰지 않는다'라고 주석에 적는다. (b) 개인정보 처리 안내문: '개인정보'가 있고 (유의|관리되|처리|수집|이용|동의)가 있으며, `(대상|자격|요건)\s*[:：]` 이름표가 없는 줄. ② activityDetails 반환 직전에 eligibilityLines·eligibilityExcludes 를 `.filter(eligLineOk)` 한다(noContact 와 같은 자리). 본문·요강·첨부·브라우저 네 경로가 다 이 함수를 지난다. ③ activity-docs.mjs 의 mergeBrowserResults(357행)도 r.lines 를 eligLineOk 로 거른 뒤, 남은 것이 없으면 합치지 않는다. 장부에 이미 적힌 옛 줄이 되돌아오지 않게 하고, 자격 칸이 비었다 찼다 하는 것도 막는다. ④ 소급: activity-excerpts.mjs 에 `export function sanitizeElig(it)` 를 둔다(eligibilityLines 를 거르고 비면 칸을 지운다 · 바뀌면 true). collect.mjs 554행 `acts.items.forEach(sanitizeBenefit)` 바로 다음 줄에서 `acts.items.forEach(sanitizeElig)` 로 모든 글에 매번 건다. ⑤ 바꾸지 말 것: 자격 줄 고르기는 activityDetails 하나(새 판독기 금지 · CLAUDE.md), 엔진(parse-requirements·match-engine), 나이 갈래가 하나인 줄('만 19세 이상 ~ 만 34세 이하'), API 매퍼. API 매퍼까지 eligLineOk 로 바꾸는 것은 선택이고, 바꾸면 open-api-map.mjs 195행만 고친다.

관문: health-gates/qfeeds.mjs 「활동 자격 — 여러 갈래 나이·개인정보 안내문」. ① activityDetails 표본 본문을 '2026년 테스트 교육 참가자 모집 공고\n대상\n대학생, 일반인\n대상연령\n만 20세 이상 ~ 만 39세 이하, 만 40세 이상' 으로 두면 eligibilityLines 에 '대상연령' 줄이 없고 '대상 : 대학생, 일반인'은 있다. 같은 본문에서 나이만 '만 19세 이상 ~ 만 34세 이하'로 바꾸면 그 줄은 남는다(대조군). ② eligLineOk('신청 시 요청하는 정보(개인정보포함)는 사업운영기관에서 관리되오니 이점 반드시 유의하여 주시기 바랍니다.') === false, eligLineOk('참가자격 : 만 19~34세 대한민국 국민') === true. ③ mergeBrowserResults({items:[{url:'u',title:'t'}]}, {u:{lines:[개인정보 줄, 여러 갈래 나이 줄, '대상 : 대학생'],from:'브라우저 본문'}}) 뒤 eligibilityLines 가 ['대상 : 대학생'] 이다. activity-docs.mjs 는 ACTIVITY_DOCS_AS_LIB=1 을 먼저 세운 뒤 동적으로 불러온다. ④ 정적 검사: collect.mjs 에 `forEach(sanitizeElig)` 가 있다. 빨간불 확인: eligLineOk 가 늘 true 를 돌려주게 하면 ①②③이 빨개진다.

소급: 다음 장학 수집 실행이 ④로 data/activities.json 전부에 소급한다. 바로 반영하려면 같은 커밋에서 한 번짜리 node 스크립트로 sanitizeElig 를 data/activities.json 전 글에 걸고 `JSON.stringify(acts, null, 1)`(collect.mjs 와 같은 형식)로 저장한다. act-browser.json 은 고치지 않는다(③이 합칠 때 거른다).

파일: collector/activity-excerpts.mjs collector/activity-docs.mjs collector/collect.mjs data/activities.json verify/health-gates/qfeeds.mjs

위험: (b)는 낱말 규칙이라 '개인정보 수집·이용에 동의한 자' 같은 형식 조건도 빠진다. 판정이 원래 못 재는 줄이라 손해가 없다. 엔진 쪽 근본 수리(쉼표로 나뉜 나이 갈래를 '또는'으로 읽기)는 판정 묶음의 몫이라 여기서 하지 않는다. collect.mjs 는 collect-09·api-11 과 같은 파일이다.

---
## [news-4] P2 · confirmed

이유: 오늘 data/news/nf097dk.json(경북대)에 '포토뉴스 …'로 시작하는 본문 붙은 제목 5건이 그대로 있다(foundAt 10-01, viewBtin.action?bbs_cde=28). 경북의 boardUrl 은 b444b603 에서 학사공지(stdList.action?menu_idx=42)로 바뀌었다. 앱 정렬로 경북 홈 띠 4장을 뽑으면 2·3번째가 포토뉴스다. newsFloor 는 최근 4건을 기한과 상관없이 남기므로, 학사공지에 새 글이 쌓일 때까지 포토뉴스가 띠에 남는다. 발행(collect-news.mjs:226-239)은 그 글이 어느 게시판에서 왔는지 모르기 때문에, 출처 설정이 바뀌어도 옛 글을 걸러낼 수 없다.

수리 명세: 최소안은 백필 하나다(아래). 권장안은 다시 생기지 않게 막는 것까지다. ① collect-news.mjs harvestBoard 의 새 글 루프(it.foundAt 을 다는 자리)에서 `it.src = boardKey(s.boardUrl)` 를 단다. boardKey 는 news-kind.mjs 에 둘 canonUrl 기반 8자 해시다(폰이 받는 파일을 키우지 않게 주소 전체는 적지 않는다). 이미 본 줄(items 가운데 fresh 가 아닌 것)도 `srcByUrl.set(urlKey(i.url), boardKey(s.boardUrl))` 로 이번에 본 게시판을 적어 둔다. ② news-kind.mjs 에 `export function dropRetiredBoards(items, liveBySchool, srcByUrl)` 를 둔다. srcByUrl 에 있는 글은 src 를 새 값으로 바꾼다(같은 게시판의 주소만 바뀐 경우를 살린다). src 가 있는데 그 학교의 지금 게시판(boardUrl + extraBoards 의 boardKey 집합)에 없으면 뺀다. src 가 없는 옛 글은 판단하지 않고 남긴다. ③ 발행에서 dropUnserved 다음, newsFloor 앞에 건다(빠진 글이 바닥 4건 자리를 차지하지 않게). ④ 바꾸지 말 것: 숨김(newsHidden)·글 번호 규칙, 30일·60일 기한, 썸네일 열쇠(thumbKey). src 칸은 앱이 안 읽는다.

관문: health-gates/qfeeds.mjs 「출처에서 뺀 게시판의 글은 다음 발행에서 빠진다」. 표본 학교 '가대학교'의 지금 게시판 B 하나에 대해 글 넷을 둔다: {src:key(A)}(옛 게시판) → 빠짐, {src:key(B)} → 남음, {src 없음} → 남음, {src:key(A), url 이 이번 실행 B 목록에도 있음} → 남고 src 가 key(B)로 바뀜. 정적 검사: collect-news.mjs 새 글 루프에 `it.src =` 가 있고, dropRetiredBoards 호출이 newsFloor 앞에 있다. 빨간불 확인: dropRetiredBoards 가 그대로 돌려주게 하면 첫 항목이 빨개지고, 다시 달기를 빼면 넷째가 빨개진다.

소급: src 가 없는 옛 글 5건은 ②로 판단할 수 없으므로 관리자 버튼과 같은 길로 숨긴다. `ACTION=newsHide ACTOR=<이름> PAYLOAD='{"urls":[<nf097dk.json 의 포토뉴스 5건 url — viewBtin.action?bbs_cde=28…doc_no=1338474·1338469·1338438·1338436·1338432>]}' node tools/admin-apply.mjs`. 결과로 nf097dk.json 의 hidden 표식, news-config.json 의 hideUrls, admin-log 한 줄이 남는다. 숨긴 글은 newsFloor 가 세지 않고 30일 뒤 기한으로 빠진다. 손으로 고치지 않는다.

파일: collector/news-kind.mjs collector/collect-news.mjs collector/news-config.json data/news/nf097dk.json data/admin-log.json verify/health-gates/qfeeds.mjs

위험: ① 게시판 주소만 바뀌고(예: 메뉴 번호) 글 주소도 바뀐 경우 옛 글이 한꺼번에 빠진다. 같은 실행에서 새 주소의 글이 실리므로 0건이 되지는 않고, 0건이면 zeroSchools 이슈가 뜬다. ② admin-apply 백필은 data/admin-log.json 을 고친다. 미합류 커밋 08f663d7 도 같은 파일을 고쳐 병합 충돌이 날 수 있다.

---
## [news-12] P3 · confirmed

이유: 결과 발표 글이 지금 6건 실려 있다. 서울과기대 '최종 합격자 알림', 명지 '최종 합격자 안내', 항공대 '선발 결과 안내', 한양 '최종 결과 발표', 부경 '선정 결과' 둘. news-kind.mjs:31 NOT_NEWS 의 설계 의도('결과는 학생에게 뉴스가 아니다')에 비해 낱말 칸이 비어 있다. 새 정규식을 데이터 전체에 돌려 보니 정확히 이 6건만 걸렸다. 광운 '경기 일정 및 결과 안내'·경북 '인성검사 결과 안내'·충북 채용 '서류전형 합격자 및 필기시험 일정 공고'는 걸리지 않는다. 진단의 둘째 부분('학비보조·학업지원금'은 장학 피드로)은 장학 수집기와 함께 쓰는 그물(collect.mjs:65 KEYWORDS — 관문이 두 파일을 대조한다)을 넓히는 일이라 개발자 결정으로 넘긴다.

수리 명세: news-kind.mjs NOT_NEWS 에서 셋을 고친다. ① `합격자\s*(?:발표|명단|공지|공고)` → `합격자\s*(?:발표|명단|공지|공고|알림|안내)`. ② `(?:선발|선정)\s*결과` 를 더한다(뒤 동사가 없어도 된다). ③ `최종\s*(?:합격|선정)\s*발표` → `최종\s*(?:합격|선정|결과)\s*발표`. 머리말 규칙대로 관문의 '아니다' 예시부터 늘린다. 바꾸지 말 것: '결과 안내' 전반(경기·검사 결과는 학생 소식이다), KEYWORDS(장학 그물).

관문: health-gates/qfeeds.mjs 「소식 — 합격·선발 결과 글은 안 싣는다」. 위 6개 제목은 isNewsRow 가 false 이고, '[체육지원팀] 아이스하키부 경기 일정 및 결과 안내'·'2026학년도 2학기 교직 적성 및 인성검사(1차) 결과 안내'·'총장 담화문'은 true 다(opts 는 test-collector 「교내 소식」처럼 collect.mjs 의 KEYWORDS 를 읽어 쓴다). 빨간불 확인: NOT_NEWS 를 되돌리면 앞의 6개가 빨개진다.

소급: 발행 단계의 isNewsRow 소급(collect-news.mjs '소급(원칙 7)' 줄)이 다음 실행에 6건을 걷는다. 따로 백필하지 않는다. 바로 반영하려면 collector/run-news.txt 를 push 한다(push-to-run).

파일: collector/news-kind.mjs verify/health-gates/qfeeds.mjs

위험: 낮음. 다른 학교의 '선정 결과에 따른 …' 같은 행정 안내도 빠질 수 있으나 결과 성격이라 의도와 맞다.

---
## [news-13] P3 · confirmed

이유: collector/seen-news.json 은 오늘 열쇠 794개·92KB 다. 하루 증가는 10-03 72·10-04 82 로, 한 해면 약 2.9만 열쇠·3MB 가 된다. collect-news.mjs 에는 지우는 코드가 없다(새 글 루프에서 넣기만 하고 222행에서 저장). 이 파일은 하루 두 번 커밋되고 합집합 병합 대상이라 커질수록 커밋·병합 비용이 는다. 장학 쪽 seen.json(540KB)도 같은 설계지만 이 묶음 밖이다.

수리 명세: ① news-kind.mjs 에 `export function pruneSeen(seen, today, { keepDays = 90, keep = new Set() } = {})` 를 둔다. 값(수집일, KST)이 today−keepDays 보다 앞이고 keep 에 없는 열쇠만 지우고, 지운 수를 돌려준다. keepDays 는 NEWS_POSTED_MAX_DAYS(60)보다 길게 둔다(옛 글이 새 글로 다시 실리지 않게). ② collect-news.mjs 에서 seen 저장(222행)을 발행 블록 뒤로 옮긴다. 저장 직전에 keep = 최종 all 의 urlKey(n.url)와 `post:${school}:${postId}` 열쇠로 pruneSeen 을 부른다. newsFloor 로 오래 남는 글의 열쇠를 지우면 그 글이 '새 글'로 다시 올라오기 때문이다. ③ 리포트에 '정리한 장부 n개' 한 줄을 남긴다(선택). 바꾸지 말 것: 열쇠 모양, mergeSeen.

관문: health-gates/qfeeds.mjs 「소식 장부 정리」. seen={a:'2026-06-01', b:'2026-06-01', c:'2026-09-30'}, today='2026-10-04', keep={b} 이면 a 만 지워진다. keepDays 가 60 보다 큰지도 본다. 빨간불 확인: 함수가 아무것도 안 지우게 하면 빨개진다.

소급: 없음. 지금 열쇠는 모두 10-01 이후라 12월 말부터 지워지기 시작한다.

파일: collector/news-kind.mjs collector/collect-news.mjs verify/health-gates/qfeeds.mjs

위험: 저장을 발행 뒤로 옮기므로, 발행 중에 넘어지면 이번 장부가 저장되지 않는다. 다음 실행이 같은 글을 새 글로 보지만 발행의 중복 제거가 합친다. 지금도 발행 실패 땐 발행분이 안 남으므로 결과는 같다.

---
## [api-10] P3 · confirmed

이유: 오늘 external-sources.json 의 probe.why 는 '홈페이지 못 엶' 28곳(진단 때 21곳에서 늘었다), '최고 0건' 25곳, 게시판 아는 곳 20/77 이다. find-boards.mjs:111·145 는 `e.message || e.name` 만 적어 모두 'fetch failed'다. 이름 못 찾음·인증서·연결 시한 가운데 무엇인지 몰라 사람이 손을 댈 수 없다. 원인 풀이는 collector/fetch-board.mjs 의 netReason 한 곳에 이미 있다(CLAUDE.md '베끼지 말 것').

수리 명세: find-boards.mjs 에 `import { netReason } from './fetch-board.mjs'` 를 더하고, 111·145행의 `홈페이지 못 엶 (${e.message || e.name})` 를 `홈페이지 못 엶 (${netReason(e)})` 로 바꾼다. 같은 파일에 같은 꼴이 더 있으면 같이 바꾼다. 바꾸지 말 것: RETRY_DAYS(14일), probe 칸 모양, 스크립트 메뉴 사이트의 브라우저 정찰 여부(개발자 결정이고 이 수리 범위 밖).

관문: health-gates/qfeeds.mjs 「찾기 로봇은 실패 원인 코드를 적는다」. 정적 검사: find-boards.mjs 가 fetch-board.mjs 의 netReason 을 불러오고, '홈페이지 못 엶 (${e.message' 꼴이 0건이다. 표본: `const e = new TypeError('fetch failed'); e.cause = { code: 'UND_ERR_CONNECT_TIMEOUT' }` 이면 netReason(e) 에 'UND_ERR_CONNECT_TIMEOUT' 이 들어 있다. 빨간불 확인: 옛 꼴로 되돌리면 정적 검사가 빨개진다.

소급: 없음. 다음 찾기 실행(각 재단 14일 주기 · 10-14 무렵)이 원인 코드로 다시 적는다.

파일: collector/find-boards.mjs verify/health-gates/qfeeds.mjs

위험: 낮음. find-boards.mjs 는 기본 브랜치에서 3506962b 가 고쳤으니 합친 뒤에 고친다.

---
## [api-11] P3 · confirmed

이유: 코드상 사실이다. collect.mjs:556-558 은 상한(ACT_CAP=200)을 자를 때 foundAt 내림차순으로 정렬한다. 그런데 바로 위 551행 60일 규칙은 API 글을 `(n.api && n.seenAt) || n.foundAt` 로 잰다. 오래 열린 API 글이 상한에서 잘리면, open-api-map.mjs mergeApi 의 firstSeen 이 이전 파일에서만 찾기 때문에 다음 API 실행에서 foundAt=오늘인 새 글로 다시 올라온다(리뷰 I3 의 깜빡임). 오늘은 184/200(API 글 52)이라 아직 일어나지 않았다. 잠재 위험이다.

수리 명세: ① open-api-map.mjs 에 `export const actKeepDate = (n) => (n.api && n.seenAt) || n.foundAt || ''` 와 `export function capActivities(items, cap)` 를 둔다. capActivities 는 actKeepDate 내림차순으로 고른 cap 개만 남기되, 돌려주는 순서는 넘겨받은 순서(foundAt 정렬)를 지킨다. 화면의 '새 글' 순서는 바꾸지 않는다. ② collect.mjs 551행의 60일 거름은 `(actKeepDate(n) || '9999') >= cutoff` 로 바꾸고(같은 값을 한 곳에서), 558행 `acts.items = acts.items.slice(0, ACT_CAP)` 은 `acts.items = capActivities(acts.items, ACT_CAP)` 로 바꾼다. 바꾸지 말 것: 557행 foundAt 정렬, ACT_CAP 값.

관문: health-gates/qfeeds.mjs 「활동 상한은 오늘 API 가 준 글을 자르지 않는다」. 표본은 {api:'youthPolicy', foundAt:'2026-08-01', seenAt:'2026-10-04'}, {foundAt:'2026-10-03'}, {foundAt:'2026-07-01'}, cap 2. 결과는 [10-03 글, API 글]이고 07-01 글이 빠진다. 순서는 foundAt 내림차순 그대로다. 정적 검사: collect.mjs 가 capActivities 와 actKeepDate 를 쓴다. 빨간불 확인: capActivities 를 slice 로 되돌리면 API 글이 빠져 빨개진다.

소급: 없음.

파일: collector/open-api-map.mjs collector/collect.mjs verify/health-gates/qfeeds.mjs

위험: 낮음. collect.mjs 가 open-api-map.mjs 를 새로 불러온다(순수 모듈 · source-link.js 를 require 한다).

---
## [news-11] P3 · confirmed

이유: collect-news.yml:77 이 `npm i sharp` 를 버전 없이 실행한다. 지금 npm 의 sharp 0.35.5 는 engines node>=20.9.0 이라 Node 20 에서 돌고, 최근 실행(37175911167)에서도 썸네일 단계가 성공했다. 지금 고장은 아니다. 다만 Node 20 은 2026-04 에 지원이 끝났고, 새 판이 Node 20 을 빼면 아무 변경 없이 썸네일 단계가 깨진다. 이 단계는 continue-on-error 라 실패가 조용히 지나간다. 같은 저장소의 gate-photos.yml 은 sharp@0.33 으로, PaddleOCR 은 판을 고정한 선례가 있다.

수리 명세: collect-news.yml 77행을 `npm i sharp@0.35 --no-audit --no-fund --silent` 로 바꾼다(0.x 에서는 ^0.35 = 0.35.x 만 받는다). 주석에 '판 고정 — 새 판이 Node 20 을 빼면 썸네일이 조용히 멈춘다 · node-version 을 올릴 때 같이 올린다'를 적는다. node-version 은 바꾸지 않는다(모든 로봇 공통 결정).

관문: health-gates/qfeeds.mjs 「소식 썸네일 단계의 sharp 판 고정」. 정적 검사: collect-news.yml 에 `npm i sharp@\d` 가 있고 `npm i sharp ` (판 없음)이 없다. 빨간불 확인: @0.35 를 지우면 빨개진다.

소급: 없음.

파일: .github/workflows/collect-news.yml verify/health-gates/qfeeds.mjs

위험: 0.35.x 가 깨지는 패치를 내면 그때 판을 다시 정해야 한다. eligibility-fill.yml:141 도 판이 고정돼 있지 않지만 이 묶음 밖이다(notes).

---
## [api-08] P3 · confirmed

이유: 출처는 차례대로 돈다. kstartup→vol1365→youthContent→youthPolicy(open-api-map.mjs:32-38)를 open-api.mjs:233 이 한 줄로 돌리고, 6분 예산 하나(BUDGET_MS)를 나눠 쓴다. 공공데이터포털이 실패했던 10-02 23:02 실행(37075588410)에서 받기 단계는 234초였다(그때 재시도 쉼은 3·6초). ac930fb7 이 쉼을 10·40초로 늘려 실패 출처마다 약 41초씩 더 걸리므로 약 316초/360초가 된다. 청년정책이 403 으로 30초 쉬는 날이나 20초 시한 꼴 장애면 예산을 넘어, 멀쩡한 온통청년 출처까지 ❌ 가 된다. 실제로 일어난 적은 없다. 여유가 적다는 문제다.

수리 명세: ① open-api-map.mjs 의 API_SOURCES 항목마다 `host: 'data.go.kr' | 'youthcenter'` 칸을 더한다. 순수 함수 `export async function runSourceGroups(order, hostOf, run)` 을 둔다. host 별 묶음은 동시에(Promise.all) 돌리고 묶음 안은 차례대로 돈다. 돌려주는 것은 order 순서의 결과 배열이다. ② open-api.mjs 233행 루프 몸통을 `async function runSource(src)` 로 떼어 { result, lines } 를 돌려주게 한다. 리포트 줄은 공유 배열에 바로 넣지 않는다. 결과를 받은 뒤 🔴 API_SOURCES 순서대로 `results[src]` 를 채우고 lines 를 붙인다. mergeApi 는 Object.entries(results) 의 넣은 순서로 '먼저 온 출처가 이긴다'를 정하므로, 끝난 순서대로 넣으면 같은 글의 승자가 실행마다 달라진다. ③ 바꾸지 말 것: 출처 순서, 재시도 간격(10·40초), 예산 값, HAS_KEY·hideKeys(정적 관문이 잰다), vol1365Details 는 포털 묶음 안.

관문: health-gates/qfeeds.mjs 「포털 장애가 온통청년 예산을 먹지 않는다」. 가짜 run 을 쓴다. 'data.go.kr' 묶음 둘은 각각 150ms 뒤 실패하고, 'youthcenter' 묶음 둘은 각각 10ms 뒤 성공한다. 온통청년 둘이 끝난 시각이 포털 첫째가 끝나기 전이어야 하고(동시성), 돌려준 결과 순서는 order(kstartup, vol1365, youthContent, youthPolicy)와 같아야 한다. 빨간불 확인: runSourceGroups 를 차례 루프로 바꾸면 첫 조건이 빨개진다.

소급: 없음.

파일: collector/open-api-map.mjs collector/open-api.mjs verify/health-gates/qfeeds.mjs

위험: open-api.mjs 의 구조를 바꾸는 중간 크기 수리다. 기존 「공공 API 로봇」 정적 관문(test-collector 11137-11150, 11541-11545의 정규식: HAS_KEY[src]·hideKeys(·sleep([10000, 40000][i])·last?.cause)이 계속 맞는지 확인한다. 우선순위가 가장 낮아 마지막에 하거나 미뤄도 된다.

---
## [news-9] P3 · needs-human
**결정(추천안 ①): 그대로 둔다 — 코드 변경 없음.**

이유: actions_list 로 확인했다. 예약 실행 시작이 cron 19 22 / 19 4 보다 10-03 01:14(+2h55m), 10-03 09:55(+5h36m), 10-04 00:44(+2h25m) 늦었다. 빠진 날은 없다. GitHub 예약 스케줄러 쪽 지연이라 저장소 코드로 원인을 고칠 수 없고, 정각은 이미 피했다. 학생에게는 하루 두 번 갱신이 실제로 지켜진다.

수리 명세: (없음)

관문: (없음)

소급: (없음)

파일: 

위험: (없음)

---
## [api-13] P3 · needs-human
**결정(추천안 ①): 지금 정책 유지 — robots.mjs 머리말과 관문에 '대외활동 출처는 학교 사이트라도 robots.txt 를 지키고, 학교 장학·소식 게시판은 묻지 않는다'를 적는다.**

이유: 정책이 갈라져 있는 것은 사실이다. collect.mjs 의 robots 검사는 `(isAct || isExt)` 조건이라, 학교 사이트에 있는 대외활동 출처도 robots.txt 를 묻는다. 같은 학교의 장학(role scholarship)·소식(collect-news.mjs)은 묻지 않는다. 다만 진단의 증상(외대 두 게시판 ⛔)은 1a09466c 의 별표 해석 수정으로 이미 풀렸다('인천유스톡톡·한국외대 두 게시판이 열린다'). 정책 선택은 법적 위험 판단이라 개발자가 정한다.

수리 명세: (없음)

관문: (없음)

소급: (없음)

파일: 

위험: (없음)

---
## 손대지 않는 것 (이미 고쳐짐·오진·다른 세션·사람 결정 대기)
- [news-5] already-fixed: b444b603(10-04 04:03Z '소식 0건 학교 없애기')이 서울대 '학부대학 공지'와 고려 세종 '학사공지'를 둘째 게시판(extraBoards)으로 더했다. 오늘 리포트는 서울대 학부대학 공지 18건 새 글, 고려 세종 학사공지 5건 새 글이고, 서울대 파일은 2건에서 20건이 됐다. 서울대 일반공지가 2건뿐인 이유도 그 커밋이 '장학 글이 많아 소식 2건'으로 밝혀 두었다. 고정 공지만 읽는다는 원인 가설과는 다르다. 남은 건국(11건 · 최신 게시일 09-23, 11일 전)은 정체라고 단정할 근거가 없다. 의심되면 
- [news-8] already-fixed: b444b603 이 경북대 boardUrl 을 학사공지(stdList.action?menu_idx=42 · 정찰 6차 확인)로 채웠다. 오늘 news-sources.json 에 주소 미설정 학교는 0곳이다. 같은 커밋이 `needs_human` 에 zeroSchools(서비스 학교인데 발행 글이 0건)를 넣어, 학생에게 소식이 0건이 되는 경우는 이제 이슈로 뜬다(collect-news.mjs 마지막 줄). news-4 의 출처 표식 수리가 들어가면, 주소를 비운 학교의 글이 빠져 0건이 되고 같은 이슈 조건으로 올라온다.
- [api-03] already-fixed: ac930fb7 이 이미 들어가 있다. open-api.mjs:84 다시 묻기 전 10초·40초 쉼, :88 실패 원인 코드(last.cause.code) 기록, open-api.yml 16:17 KST 백업 예약('17 7 * * *'). test-collector 11541-11545 관문이 셋을 잰다. 그 뒤 예약 실행 37157526699(10-03 22:10Z)는 성공했다. 실패를 실제로 넘기는지는 다음 포털 장애 때 리포트의 원인 코드로 확인할 일이고, 지금 고칠 코드는 없다.
- [api-05] already-fixed: 기본 브랜치의 1a09466c(10-04 18:59 KST)가 robots.mjs 를 고쳤다. 별표(*)는 정규식 '.*', 끝의 $ 는 끝 고정으로 읽고(ruleRe), 경로에 질의 문자열까지 붙여 비교한다(robotsAllows 의 u.pathname + u.search). test-collector 에 red-green 도 더했다. 그 커밋은 ⛔ 출처도 다시 확인했다. 인천유스톡톡·한국외대 둘은 열렸고, 정부24(Disallow: /)·콘텐츠진흥원(/kocca/*/list.do)은 실제로 막힌 곳이라 그대로 두었다.
- [api-12] refuted: 1365 가 5쪽×100=500행에서 멈추는 것은 사실이다. 하지만 학생에게 보이는 손해가 없다. 오늘 open-api-report.md 기준으로 500행에서 대학생·청년 대상이 57건 나와 상한 15건을 넘쳤다('상한 15건 초과 42'). mapRows 는 마감이 가까운 순으로 15건을 고르는데(open-api-map.mjs:361), 실린 글이 이미 내일(10-05) 마감 글들이다. 뒤쪽 행을 더 읽어도 실리는 글 수와 질은 그대로이고 요청만 는다. 고칠 일이 아니다.
