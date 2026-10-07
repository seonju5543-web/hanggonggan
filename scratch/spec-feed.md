# 수리 명세 — 묶음 feed

권장 순서: collect/collect-05 → app2/app2-F4 → collect/collect-12 → collect/collect-01 → app2/app2-F1 → app2/app2-F2 → collect/collect-10 → collect/collect-06
예상 손댈 파일: collector/publish-notices.mjs collector/collect.mjs collector/browser-collect.mjs collector/coverage-rules.mjs collector/audit-coverage.mjs .github/workflows/audit-coverage.yml verify/health-gates/feed.mjs verify/health-gates.mjs data/notices.json data/notices/*.json

검증 메모: The two diagnoses describe one incident (collect-01 = app2-F1, app2-F4 = collect-12), so the bundle has 8 findings but 5 distinct fixes.

What I checked:
- **The merger ran.** Run 36652803481 log line 4257 shows the merger touching data/notices.json, and ab897c3b has exactly 200 items. This removes the "could not confirm the merger ran" caveat in app2-F1.
- **The loss is real today.** At HEAD 46f08990, 215 items are missing from every per-school file, all 215 are still in candidates.json, and 190 are in seen.json. Today's 08:56 collector run also found 0 new items, so nothing is coming back on its own.
- **Exact restore source.** The pre-truncation per-school files at ab897c3b (35 files, 470 items) plus 60ce385a notices.json give the precise set to restore. A dry run at HEAD restores 242 items. All 61 items collected before 09-29 belong to 경희대 and 한국외대, which were never parked.

Three implementation traps, each reproduced on real data or fixtures:
1. **Do not restore with a plain merge.** `dedupeNotices(current + ledger)` lets preferNotice pick the older ledger version. It would put the 09-30 URLs back on 11 current items, including the three 서울교대 items that are now board-list markers. Fill gaps only: `dedupeNotices(A.concat(pool)).slice(A.length)`. This also avoids editing collector/url-key.mjs, which the other session changes inside dedupeNotices.
2. **Add the bridge guard.** When a ledger item bridges to a feed item through a shared URL with a different title, dedupe produces a duplicate that audit-data counts as an error. That error turns the data gate red and rolls back auto-registrations. The fixture reproduces it: auditDup is 1 without the guard and 0 with it.
3. **Keep the original foundAt.** notify-rules.js foundBeforeLastCheck only suppresses "새 공고" alerts when foundAt is the original date.

Constraints:
- The repo is shallow, but objects ab897c3b and 60ce385a are present locally.
- The source-text gate at test-collector.mjs line 975 looks for the literal `saveCandidates(mergeCandidates(loadCandidates().items, freshAll))` line. Do not edit that line; insert the heal call right after it.

Collision with the concurrent session:
- collector/browser-collect.mjs: their hunks are at lines 284-330 and 495 and their import change is line 13. Our edits are the line 9 import and around line 652. These are not adjacent, so a clean merge is expected.
- No collision in collect.mjs, publish-notices.mjs, coverage-rules.mjs, audit-coverage.mjs or audit-coverage.yml.
- verify/health-gates.mjs PARTS is shared with the other bundles, so the orchestrator needs to serialise that edit.

Severity:
- I lowered app2-F4 and collect-12 to P3. The heal step puts the 18 orphan-file items (충북/충남/방통) back into the feed on its first run, so the orphan issue becomes a future-proofing fix.
- 한양 0건 is not fixed by the heal: the 08-01 items would have aged out on 09-30 anyway. The real question is why no new 한양 posts have been seen since 08-12, which needs a probe. That question is in app2-F2's humanQuestion.

Housekeeping: nothing was modified in /home/user/hanggonggan and I created no worktree; verify-gate/wt is not mine. Scratch files are in /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/verify-feed/:
- restore-add.json: the 253-item restore candidate set.
- fixture.mjs: the heal and bridge fixtures.
- sim.mjs, sim2.mjs: dry runs on real data.


---
## [collect/collect-01] P0 · confirmed

이유: 지금 HEAD(46f08990)에서 다시 쟀다. 09-30 실행 36652803481 로그 217행 'notices.json now has 470 items' → 4246행 push rejected → 4257행 '[merge-json-union] 자동 병합 완료: data/notices.json' → 커밋 ab897c3b 의 notices.json 은 정확히 200건이고 전부 foundAt 2026-09-30 이다. 직전 60ce385a·27f38160 은 460건·33개교였다. 병합기가 실제로 돌았다는 로그가 있어 원인(옛 mergeNotices 의 slice(0,200))이 확정된다. 60ce 판과 비교하면 지금 notices.json 에 없는 것이 233건, 어느 학교별 파일에도 없는 것이 215건이다(가천 17 · 서울과기 22 · 영남 15 · 전북 10 · 전남 17 · 연세 17 · 건국 23 · 광운 7 · 명지 9 · 외대 36 · 경희 26 · 성균 7 · 조선 5 · 경북 3 · 계명 1). 215건 모두 collector/candidates.json 에 남아 있고, 190건은 seen.json 에 있어 다시 수집되지 않는다(collect.mjs:412). 오늘 08:56 실행(12035004)도 '새로 발견한 공고 0건'이라 스스로 돌아오지 않는다. 다만 한 군데는 증상을 과장했다. 고속도로·논산시장학회는 외대·경희 글이 전국 정식 등록(auto-ent2431266533artclviewdo · auto-oardid323199menuno200318, schoolOnly 없음)으로 올라 있어 건국대 학생도 카드로 본다. 그래서 '정식 등록에도 없다'는 일부 공고에만 맞는 말이다. 그래도 15개교 피드가 크게 비었고 10-11·10-30 마감 공고가 섞여 있어 시간이 급하다. P0 를 유지한다.

수리 명세: 데이터 복구는 손으로 하지 않는다. collect-05 의 healFromLedger 와 app2-F4 의 빈 파일 처리가 들어간 뒤, 수집기 끝부분과 같은 순서로 한 번만 돌린다.
(1) 되살릴 원천 = 잘리기 직전에 로봇이 발행한 것만 쓴다. ab897c3b 의 data/notices/*.json 35개(수집기가 자르기 전 목록으로 발행한 470건 · 강원 10건처럼 60ce 에 없던 글 포함)와 60ce385a 의 data/notices.json(460건)을 합친다. 저장소는 shallow 지만 두 커밋 객체는 로컬에 있다(git show 로 확인함). 스크래치에 JSON 으로 뽑는다.
(2) 커밋하지 않는 일회성 스크립트를 `bash tools/robot-run.sh node <스크립트>` 로 돌린다. 순서: data/notices.json 읽기 → `items = healFromLedger(notices.items, 원천, { since: '0000-00-00' })`(60일 규칙만 건다 — 경희·외대의 08-26~09-28 수집분 61건도 이 사고로 잘렸기 때문. 원천이 사고 직전 발행분뿐이라 8월에 파킹으로 뺀 글은 섞이지 않는다) → `dropUnserved` → `publishBySchool(items)` → `notices.items = capNotices(items)` · updatedAt(KST) → `JSON.stringify(notices, null, 1)`.
(3) 지금 HEAD 시뮬레이션 결과: 되살림 242건(나머지 11건은 같은 글의 다른 주소라 dedupe 가 지금 피드 글로 알아본다 — 서울교대 표식 등), 학교별 파일 36→39개교(충북·충남·방통이 다시 색인에 오른다), notices.json 588건 → capNotices 583건(5건은 학교별 파일에만 남는다).
(4) 확인: `node verify/audit-data.js` exit 0 · `node verify/test-collector.mjs` · `node verify/what-shows.mjs` 로 건국대(1→24)·한국외대(3→39)·경희(3→29). 60ce 대조 215건 중 어느 학교별 파일에도 없는 것이 0이어야 한다.
바꾸지 말 것: foundAt 은 원래 날짜 그대로 둔다(오늘로 바꾸면 notify-rules.js foundBeforeLastCheck 가 못 막아 '새 공고 n건' 알림이 울리고 60일 수명도 늘어난다). 지금 피드 글은 하나도 바꾸지 않는다 — 메우기만 한다(그냥 합치면 지금 글 11건의 주소가 09-30 판으로 되돌아간다 · 실측). registered.json 은 건드리지 않는다.

관문: 데이터라 고정 검사로 잠그지 않는다(CLAUDE.md 실데이터 금지). 재발 방지는 collect-05·app2-F4 관문이 맡는다(verify/health-gates/feed.mjs). 빨간불 증명: healFromLedger 를 `dedupeNotices(items.concat(pool))` 로 되돌리면 'A 를 바꾸지 않는다' 표본이 실패한다.

소급: 이 항목 자체가 소급이다. 9-29 이후 수집분(192건)은 collect-05 코드가 들어가면 다음 클라우드 수집 실행이 candidates.json 에서 스스로 메운다. 일회성 실행은 그 코드로 '사고 직전 발행분' 원천을 먹여 경희·외대 61건까지 정확히 되살리는 것이다. 위 순서대로 로컬에서 한 번 돌리고 data/notices.json·data/notices/ 를 커밋한다.

파일: data/notices.json data/notices/*.json collector/publish-notices.mjs

위험: ① auto-register 가 되살린 글을 후보로 다시 본다. 한 실행 8건 상한·마감 전만이라 몇 회에 나눠 들어가고, 원래 그 길이 목적이다. 그래도 개발자 보고에 적는다. ② 되살린 글의 주소는 09-30 판이라 10-03 원문 링크 정직성 일괄 정리를 거치지 않았다(실측: 진짜 주소 252·표식 1·목록+번호 0). link-check 로봇이 매일 다시 보고, 앱 sourceLink 가 이름을 정직하게 붙인다. ③ 클라우드 수집과 겹칠 수 있다 → robot-run.sh 를 쓴다(notices.json·학교별 파일은 합집합 병합이라 겹쳐도 잃지 않는다). ④ 고속도로(~10-11)·논산(~10-30) 마감 전에 내보내야 뜻이 있다.

---
## [app2/app2-F1] P0 · confirmed

이유: collect-01 과 같은 사건을 다른 진단이 따로 찾은 것이다. 숫자도 맞는다: 60ce 판 460건 → ab897c3b 200건·17개교, 학교별 파일에 없는 215건(경희 26·외대 36·건국 23·서울과기 22 …), 원인은 b75c58b6~1 의 tools/merge-json-union.mjs `slice(0,200)`. '병합기가 실제로 호출됐다는 로그는 확인 못 했다'는 단서는 이제 풀렸다 — 실행 36652803481 4257행에 '[merge-json-union] 자동 병합 완료: data/notices.json' 이 있다. 따로 고치지 않고 collect-01 과 한 번에 처리한다.

수리 명세: collect-01 의 fixSpec 과 같다(한 커밋). 진단이 낸 '이미 지난 글은 감사 규칙대로 거른다'는 따르지 않는다. 피드는 마감과 관계없이 수집일 60일 규칙이고(app.js boardNoticesForMe 에 마감 거르기 없음 · collect.mjs 476 행), 되살린 글에만 다른 잣대를 걸면 규칙이 갈라진다.

관문: collect-01·collect-05 와 같다(feed.mjs 표본).

소급: collect-01 과 같다.

파일: data/notices.json data/notices/*.json

위험: collect-01 과 같다.

---
## [collect/collect-05] P1 · confirmed

이유: collect.mjs:412(이하 browser-collect.mjs:441 도 같다)는 seen 만 보고 '피드에 있는가'는 보지 않는다. 그래서 병합기가 잘라 낸 글, 8월 30일 파킹 때 뺀 글처럼 피드에서 빠진 글은 영영 다시 들어오지 않는다. 실측: 60일 안·서비스 학교인 candidates 중 지금 피드에 없는 것이 1,542건이고, 같은 글 변형을 합치면 1,177건이다(그중 8월 수집분 947 · 9-29 이후 186). seen.json 은 지우는 곳이 없다(어떤 로봇도 정리하지 않는다). publish-notices.mjs:107-108 '되돌리기는 쉽다 — 그날 수집부터 다시 담긴다'는 새 글에만 맞는 말이다. 다만 진단의 범위를 하나 고친다. 60일 전부를 메우면 8월에 파킹으로 일부러 뺀 글 947건(마감 대부분 지남)까지 돌아온다. 그래서 기본값은 9-29 이후 수집분만 메우게 하고, 8월분은 개발자 결정으로 남긴다(humanQuestion). 한양대가 0건인 것은 이 수리로 풀리지 않는다(app2-F2 참조).

수리 명세: (1) collector/publish-notices.mjs 에 두 가지를 더한다.
`export const FEED_HEAL_SINCE = '2026-09-29';`(주석: 44개교 복원일 — 그 전 수집분은 파킹으로 뺀 것이라 메우지 않는다 · 11-28 이후에는 60일 경계가 이 값을 넘으므로 저절로 의미가 없어진다)
`export function healFromLedger(items, ledger, opts = {})`. 옵션은 today(Date) · since(기본 FEED_HEAL_SINCE) · keepDays(기본 candidates.mjs 의 KEEP_DAYS 를 import) · served(기본 SERVED_SCHOOLS).
동작:
· from = max(today−keepDays 의 YYYY-MM-DD, since).
· pool = ledger 가운데 다음을 모두 만족하는 글: n·n.url·n.school 이 있다 · served 학교다 · foundAt ≥ from · `!isAttachmentEntry(n)`(attachment-link.mjs). isMenuEntry·KEYWORDS 는 다시 걸지 않는다 — 피드에 남은 글에도 안 거는 규칙이라 되살린 글에만 걸면 갈라진다.
· 🔴 메우기만 하고 바꾸지 않는다: `const A = dedupeNotices(items); let gap = dedupeNotices(A.concat(pool)).slice(A.length);` — 앞 A.length 칸의 결과는 버리고 A 를 그대로 쓴다. 이유: preferNotice 는 첨부·힌트가 있는 장부의 옛 판을 고르므로, 그냥 합치면 링크 로봇이 고친 지금 글 11건(서울교대 표식 3건 등)의 주소가 09-30 판으로 되돌아간다(실측). dedupe 를 그대로 불러 쓰므로 url-key.mjs 는 고치지 않는다. 그러면 다른 세션이 dedupeNotices 에 넣는 markerPostIdKey 도 병합 뒤 그대로 따라온다.
· 🔴 다리 막기: A 의 `u:${urlKey}`·`t:${titleKey}` 집합을 만든다. gap 을 앞에서부터 보며 둘 중 하나라도 이미 있으면 버리고, 아니면 열쇠를 집합에 더한다. 이유: 장부 안 두 변형(같은 주소·다른 제목)이 피드 글과 이어지면 dedupe 가 audit-data.js:111-121 의 '실시간 공고에 중복'(오류)을 만든다. 표본으로 재현했다(guard 없음 auditDup 1 · 있음 0). 이 오류는 데이터 관문 빨간불 → 자동 등록 되돌림으로 이어진다.
· 반환: `A.concat(gap)` 을 foundAt 내림차순으로 안정 정렬한 새 배열(병합기 mergeNotices 와 같은 순서 — 앱은 파일 순서대로 그린다). 입력을 고치지 않고, foundAt 도 고치지 않는다.
(2) collect.mjs(487행 근처)와 browser-collect.mjs(652행 근처)에서, 기존 `saveCandidates(mergeCandidates(loadCandidates().items, freshAll));` 줄(test-collector 975가 글자 그대로 찾는다 — 바꾸지 말 것) 바로 다음, dropUnserved 블록 앞에 `notices.items = healFromLedger(notices.items, loadCandidates().items);` 를 넣는다. import 는 기존 `{ publishBySchool, dropUnserved }` 에 이름을 더한다. 🔴 두 로봇 모두에 넣는다 — 한쪽만 넣으면 두 로봇이 번갈아 학교별 파일을 다시 써서 되살린 글이 들쭉날쭉한다.
(3) collect.mjs 리포트에 'n건을 후보 장부에서 다시 실었습니다(피드에서 빠졌던 글)' 한 줄(heal 전후 길이 차).
(4) publish-notices.mjs 107-108 주석을 사실대로 고친다: 새 글만 담기고, 이미 본 글은 seen 때문에 안 돌아오며, healFromLedger 가 FEED_HEAL_SINCE 이후 수집분을 장부에서 메운다.
바꾸지 말 것: seen 규칙 · dedupeNotices·capNotices 본문 · `notices.items = dropUnserved(notices.items)` 의 꼴과 위치(관문 4237-4250) · `publishBySchool(beforeCap)` 이 capNotices 앞(관문 950·7044) · 링크 로봇은 publishBySchool 을 부르지 않는다(관문 4279).

관문: verify/health-gates/feed.mjs 를 새로 만들고 verify/health-gates.mjs 의 PARTS 에 'feed' 를 더한다. 모두 표본이다.
ⓐ healFromLedger(today=2026-10-04, since=2026-09-29, served=['경희대학교','건국대학교']):
· 피드 [A(경희 'x 장학생 선발' https://k.kr/view?id=1 · 10-01)]
· 장부 [A2(같은 제목·다른 진짜 주소 id=99 · 첨부와 읽히는 힌트 있음), B(건국 · 09-30), B'(B 주소에 sort=2), C(08-20 · since 앞), C0(07-01 · 60일 밖 · since='0000' 으로 따로 잼), D(첨부 내려받기 주소), E(서비스 밖 학교)]
· 기대: 결과 = [A, B] · A 는 같은 객체이고 url 그대로 · foundAt 내림차순 · 입력 배열 길이 변화 없음.
ⓑ 다리 표본: 피드 [A3(y · 제목2)] + 장부 [p1(x · 제목1), p2(x · 제목2 · 첨부)] → 결과에 audit-data 와 같은 u/t 중복 0.
ⓒ 배선: 두 수집기 원문에 `/notices\.items\s*=\s*healFromLedger\(notices\.items,\s*loadCandidates\(\)\.items/` 가 있고, saveCandidates 줄 뒤 · `notices.items = dropUnserved(notices.items)` 앞에 있다.
빨간불 증명:
· 본문을 `return dedupeNotices(items.concat(pool))` 로 바꾸면 ⓐ의 A 정체성이 실패한다(실측: naive 는 id=99 를 고름).
· 다리 막기를 지우면 ⓑ가 중복 1로 실패한다(실측 재현).
· foundAt 조건을 지우면 ⓐ에 C 가 들어온다.
· 한 수집기에서 호출을 지우면 ⓒ가 실패한다.

소급: 코드가 스스로 소급한다. 들어간 뒤 첫 수집 실행(일반이든 브라우저든)이 candidates.json 에서 9-29 이후 수집분을 메운다(실측 186건 — collect-01 의 192건 대부분과 충북·충남·방통 18건 포함). 9-29 이전에 잘린 경희·외대 61건은 collect-01 일회성 실행이 같은 함수로 메운다.

파일: collector/publish-notices.mjs collector/collect.mjs collector/browser-collect.mjs verify/health-gates/feed.mjs verify/health-gates.mjs

위험: ① browser-collect.mjs 는 다른 세션(origin/claude/source-link-integrity)도 고친다. 그쪽은 284-330·495행이고 우리는 import 9행과 652행 근처라 덩어리가 겹치지 않는다(9행과 그쪽 13행 사이에 세 줄이 있어 깨끗이 합쳐진다). url-key.mjs 는 일부러 안 고친다(그쪽이 dedupeNotices 의 열쇠 줄을 고친다). ② 학교별 파일이 학교당 PER_SCHOOL(60)까지 찰 수 있다. 원래 설계값이지만 계명대처럼 지금 40건에서 멈춰 있던 학교는 늘어난다. ③ capNotices 가 잘라 낸 글 가운데 FEED_HEAL_SINCE 이전 것은 여전히 다음 실행에 학교별 파일에서 빠진다(알려진 천장). ④ 11-28 뒤에는 파킹했다 되살린 학교의 60일 안 옛 글도 메운다 — 다시 파킹할 일이 생기면 그때 since 를 옮긴다.

---
## [app2/app2-F4] P3 · confirmed

이유: data/notices/ 에 색인에 없는 파일이 3개 있다: n16l2078(충북 6건)·n1uf7bji(방통 4건)·nl1xm19(충남 8건), 모두 updatedAt 2026-09-30. 앱은 색인을 거치지 않고 파일 이름으로 바로 받아(app.js loadNotices · noticeFallbackNeeded 는 받기에 실패했을 때만 본다) 그대로 보여 주고, 나이 거르기도 없다(boardNoticesForMe). publishBySchool(publish-notices.mjs:146)은 글이 있는 학교만 쓰고, 63-66행 주석은 '접속 실패했을 뿐일 수 있다'는 이유로 옛 파일을 남긴다. 그런데 넘겨받는 것은 60일치를 쌓은 전체 목록이라, 게시판 하나가 그날 실패해도 그 학교가 목록에서 빠지지 않는다. 그 이유는 틀렸다. 교내 소식 로봇은 같은 문제를 빈 파일로 다시 쓰는 방식으로 이미 막았다(collect-news.mjs:244-253). 심각도는 P3 로 내린다. 지금 세 파일의 글은 아직 60일 안의 맞는 글이고, collect-05 의 메우기가 그 18건을 장부에서 다시 실어 세 파일이 정상 파일로 돌아온다. 남는 것은 앞으로 생길 경우(학교의 글이 모두 60일을 넘기면 파일이 영영 굳는다)를 막는 일이다.

수리 명세: publishBySchool 이 학교별 파일을 다 쓴 뒤 dir 의 *.json 을 훑는다(index.json 과 이번에 쓴 파일은 뺀다). 각 파일은 JSON 을 읽어 보고, 못 읽으면 건너뛴다. `Array.isArray(doc.items) && doc.items.length` 이면 `{ school: doc.school, updatedAt, items: [] }` 로 다시 쓴다(JSON.stringify(…, null, 1)). 이미 비어 있으면 손대지 않는다 — 매 실행 날짜만 바뀐 커밋을 만들지 않게. 색인은 지금처럼 글이 있는 학교만 싣는다(noticeFallbackNeeded 뜻 유지). 반환값에 emptied 개수를 더한다.
🔴 파일을 지우지 말 것: 한 로봇이 지우고 다른 로봇이 같은 파일을 고치면 수정/삭제 충돌이 나는데, 이 충돌은 병합 드라이버(merge-json-union)가 부르지 않아 pull --rebase 가 실패한다.
63-66행 주석을 사실대로 고친다(넘겨받는 것이 누적 목록이라는 점).
collect-news.mjs 의 자체 빈 파일 처리는 같은 결과라 그대로 둔다(이 묶음에서 안 건드린다).

관문: feed.mjs 표본(임시 폴더):
· 미리 둘 파일: 고아 파일(충북대학교 · 1건) · 이미 빈 고아 파일 · 깨진 JSON 파일.
· `publishBySchool([{ school:'경희대학교', … }], { dir, today: new Date('2026-10-04T00:00:00Z') })` 을 부른다.
· 기대: 고아 파일이 items [] · updatedAt '2026-10-04' 로 바뀐다 · 이미 빈 파일은 바이트가 그대로다 · 깨진 파일도 그대로다 · 색인 files 에는 경희대학교만 있다.
빨간불 증명: 다시 쓰는 반복문을 지우면 고아 파일이 1건으로 남아 실패한다. '이미 빈 것은 손대지 않는다' 조건을 지우면 바이트 비교가 실패한다.

소급: 따로 할 것이 없다. collect-01 일회성 실행 또는 collect-05 의 첫 클라우드 실행이 충북·충남·방통 글을 장부에서 되살려 세 파일이 정상 파일이 된다. 그래서 이 코드가 먼저 돌아도 세 학교가 비지 않는다 — 메우기가 같은 실행 안에서 앞서 돈다.

파일: collector/publish-notices.mjs verify/health-gates/feed.mjs

위험: publishBySchool 은 교내 소식(data/news/)도 쓴다. 소식 로봇은 이미 같은 일을 하므로 결과가 같다(실행 순서상 두 번 써도 내용이 같다). 기존 관문 '학교 수만큼 파일이 생긴다'는 매번 새 임시 폴더라 영향이 없다.

---
## [collect/collect-12] P3 · confirmed

이유: app2-F4 와 같은 결함이다(고아 파일 3개 · publish-notices.mjs:57-59/63-66 주석의 '60일 규칙으로 늙어 사라진다'는 틀렸다 — 다시 쓰이지 않는 파일은 늙지 않는다 · app.js 에 나이 거르기 없음). 하나로 고친다.

수리 명세: app2-F4 의 fixSpec 과 같다(한 커밋).

관문: app2-F4 와 같다(feed.mjs 고아 파일 표본).

소급: app2-F4 와 같다.

파일: collector/publish-notices.mjs

위험: app2-F4 와 같다.

---
## [app2/app2-F2] P2 · confirmed

이유: 증상은 맞다. 서비스 44개교 가운데 한양·홍익·연세 미래·고려 세종·동국 WISE 다섯 곳(그리고 지금은 충북·충남·방통 셋도)이 data/notices/index.json 에 없고, 앞의 다섯 곳은 학교별 파일조차 없다. 그런데 한양의 원인 설명은 반쯤 틀렸다. seen.json 한양 24건 가운데 15건이 2026-08-01, 나머지가 07월·08-10·08-12 이다. 파킹이 없었어도 08-01 글은 60일 규칙으로 09-30 에 피드에서 빠졌을 것이다. 그러니 0건의 진짜 질문은 '9월 이후 한양 게시판에서 새 글이 왜 하나도 안 잡히나'다(옛 게시판이거나 고정 목록일 수 있다 — 원문을 열어 보지 않아 단정하지 않는다). collect-05 의 메우기로는 풀리지 않는다(장부의 한양 글은 3건 · 모두 08-10~12). 홍익은 browser-report.md 에 '링크 143 · 장학 공고 0 · notice.do' 로 나온다. 8월까지는 같은 notice.do 에서 분류(noCat) 29·35·501 글을 모았으니, 지금 전체 공지 첫 화면에 장학 제목이 없는 것으로 보인다(추정 — 정찰이 필요하다). 분교 셋은 collect-06 과 같은 문제다. 코드로 고칠 수 있는 것은 이 다섯 곳이 '조용하다'는 점이다. collect.mjs 리포트는 한양을 '✅ 정상 (실공고 15건 감지)'로만 적는다.

수리 명세: (1) publish-notices.mjs 에 `export function zeroFeedSchools(items, served = SERVED_SCHOOLS)` 를 둔다. served 가운데 items 에 그 학교 글이 하나도 없는 학교를 순서대로 돌려준다. SHARED_BOARD_BRANCH 분교(ERICA 등)는 SERVED 에 없어서 따로 처리할 것이 없다.
(2) collect.mjs 의 results 항목(정상·오류·예산 건너뜀·브라우저 담당·주소 미설정 모두)에 `school: s.school` 칸을 더한다. publishBySchool(beforeCap) 뒤에 `zeroFeedSchools(beforeCap)` 를 잰다. 리포트 머리(예산 줄 다음)에 '🙋 서비스 학교인데 앱 실시간 공고 0건 n곳: 학교(까닭) …' 한 줄을 넣는다. 까닭은 그 학교 results 상태에서 고른다: '게시판 주소 없음' / '브라우저 담당 — browser-report 참조' / '게시판 k건 감지 · 전부 이미 본 글' / 그 밖의 상태 줄 그대로.
(3) 0곳이면 줄을 넣지 않는다. 이슈가 되는 리포트라 한 줄로 끝낸다.
바꾸지 말 것: 학교별 상태 줄의 기존 꼴(다른 도구·관문이 '✅ 정상'·'⚙️ 게시판 주소 미설정'을 읽는다 — 문구를 바꾸지 말고 줄을 더한다).

관문: feed.mjs:
· zeroFeedSchools([{ school:'가' }, { school:'가' }], ['가','나','다']) 가 ['나','다'] 이다 · 빈 목록이면 served 전부다.
· collect.mjs 원문에 `zeroFeedSchools(beforeCap)` 가 있고 그 위치가 publishBySchool(beforeCap) 뒤다.
빨간불 증명: 함수가 [] 를 돌려주게 바꾸면 첫 표본이 실패한다. 호출을 지우면 배선 검사가 실패한다.

소급: 없다(보고만 하는 줄이다).

파일: collector/publish-notices.mjs collector/collect.mjs verify/health-gates/feed.mjs

위험: 리포트에 줄이 하나 늘 뿐이다. 수리 직후에도 한양·홍익·분교 셋이 계속 뜰 것이다 — 원인이 정찰·개발자 몫이라 그게 맞다.

---
## [collect/collect-10] P3 · confirmed

이유: collector/audit-coverage.mjs:80 은 '우리가 가진 공고'를 `[...notices, ...candidates]` 로 세어, 피드에서 사라졌지만 장부에는 남은 글(이번 215건 같은 것)을 '가진 것'으로 친다. 그래서 이 감사로는 이런 손실이 영영 안 보인다. coverage-report.md 는 '감사한 학교: 2곳'(2026-09-29 10:04 KST)이고 그 뒤 예약 실행은 아직 없다. .github/workflows/audit-coverage.yml:7 의 cron '23 21 * * 1' 은 UTC 월요일 21:23 = KST 화요일 06:23 인데, 주석은 '매주 월요일 06:23 KST'라고 적었다. audit-coverage.mjs:21 머리말은 'AUDIT_BUDGET_MS(기본 20분)'인데 40행 코드는 35분이다. 학교 회전은 이미 있으므로(rotateOrder · coverage-cursor) 44개교는 예약 실행이 돌면서 나눠 본다. 심각도는 P3 로 둔다. collect-05 의 메우기가 들어가면 이런 손실이 다음 실행에 저절로 메워지니, 이 감사는 보조 감지기다.

수리 명세: (1) coverage-rules.mjs classifyMiss 가 deps.inLedger(함수 · 없으면 지금과 똑같이 동작)를 받게 한다. 맨 앞에서 `if (deps.inLedger && deps.inLedger(t)) return '수집했지만 피드에서 빠짐';` — 장부 글은 수집 당시 수집기 규칙을 통과한 것이라 첨부·메뉴 판정보다 먼저 와도 된다.
(2) audit-coverage.mjs: oursBySchool 을 '학생이 보는 것' = data/notices.json + data/notices/*.json(index.json 제외 · 읽기만)으로 만들고, 기존처럼 regTitles 를 더한다. candidates 는 ledgerBySchool 로 따로 둔다. classifyMiss 에 `inLedger: (title) => findMissing([title], ledgerBySchool.get(t.school) || []).length === 0` 을 넘긴다(같은 제목 맞추기 규칙을 불러 쓴다).
(3) 고칠 주석 둘: 머리말 21행을 '기본 35분'으로, audit-coverage.yml 7행을 '매주 화요일 06:23 KST (UTC 월 21:23)'로. cron 값 자체는 바꾸지 않는다.
바꾸지 말 것: 감사는 아무것도 고치지 않는다(관문 '감사가 쓰는 파일이 셋뿐'·seen·notices 를 쓰지 않는다).

관문: feed.mjs:
· classifyMiss('2026학년도 2학기 성적우수장학금 선발 공고', { keywords:/장학/, isMenuEntry:()=>false, isAttachmentEntry:()=>false, page:1, inLedger:()=>true }) === '수집했지만 피드에서 빠짐'.
· inLedger 를 빼면 '원인 미상'(기존 동작 유지).
· audit-coverage.mjs 원문에 `[...notices, ...candidates]` 가 없고 `inLedger` 를 넘긴다.
빨간불 증명: 새 분기를 지우면 첫 표본이 실패한다.

소급: 없다. 수리 뒤 다음 예약(월 21:23 UTC)이 44개교를 회전하며 처음 본다. 급하면 개발자 승인 뒤 run-audit-coverage push-to-run 을 쓴다.

파일: collector/coverage-rules.mjs collector/audit-coverage.mjs .github/workflows/audit-coverage.yml verify/health-gates/feed.mjs

위험: 원인 분류가 하나 늘 뿐 감사의 쓰기 범위는 그대로다. 기존 test-collector 750-790 관문(쓰는 파일 셋 · seen/notices 안 씀 · 회전)과 충돌하지 않는다(읽기만 늘어난다).

---
## [collect/collect-06] P2 · needs-human
**결정: 보고만 — 분교 게시판 주소는 개발자에게 묻는다. 다만 수리 명세에 리포트 머리 한 줄(서비스 중인데 게시판 없는 학교 N곳)이 있으면 그것은 한다.**

이유: 확인했다. schools.json 28·40·88 행에서 연세대학교 미래캠퍼스·고려대학교 세종캠퍼스·동국대학교 WISE캠퍼스는 boardUrl null 이고, browser-targets.json 에도 없다. SERVED_SCHOOLS 에는 들어 있어 학교로 고를 수 있지만 실시간 공고는 늘 0건이다. 오늘 report.md 는 세 곳 모두 '⚙️ 게시판 주소 미설정'이다. find-boards-report.md 7-9 행: 연세 미래는 '홈페이지 못 엶 (HTTP 404)'(씨앗 주소 school-board-seeds.json 5행이 틀렸다), 고려 세종은 '최고 0건', 동국 WISE 는 홈페이지 https://wise.dongguk.ac.kr/main 의 공지 상자에서 장학 글 12건을 찾았다(게시판 자체가 아니라 홈 화면이다). 주소를 정하는 것은 원문 확인(정찰) 또는 개발자 몫이라 코드만으로 끝낼 수 없다. '조용하다'는 부분은 app2-F2 의 리포트 줄(서비스 학교인데 피드 0건 · 까닭 '게시판 주소 없음')이 함께 해결한다.

수리 명세: 주소가 정해진 뒤에 할 일: 원문으로 확인한 장학 공지 주소를 schools.json 그 학교의 boardUrl 에 넣는다(관리자 「게시판 주소 추가」와 같은 길). 연세 미래는 school-board-seeds.json 의 홈페이지 씨앗부터 고친다. 홈 화면 주소를 짐작으로 게시판 자리에 넣지 않는다(CLAUDE.md '주소를 유추하지 말고').

관문: 주소 데이터라 고정 검사를 두지 않는다. 감시는 app2-F2 의 리포트 줄(zeroFeedSchools 표본 관문)이 맡는다.

소급: 없다. 주소가 들어간 다음 수집부터 그 학교 글이 담긴다.

파일: collector/schools.json collector/school-board-seeds.json

위험: 동국 WISE 홈 화면 주소를 그대로 넣으면 메뉴·다른 공지가 섞일 수 있어, 정찰로 진짜 게시판을 확인하는 편이 안전하다.

---
## 정찰 결과 (2026-10-04 run 37199154224)

출처: GitHub Actions run 37199154224 「링크 정찰」 job 111427067133 로그의 `node collector/probe-links.mjs` 단계(리포트 머리 `## 🔎 링크 정찰 리포트 (2026-10-04 20:34 KST)`). 대상은 run-probe.txt 14행 `findBoard: https://wise.dongguk.ac.kr/main | 장학`. 아래 따옴표는 로그 원문 그대로다.

### 동국대 WISE캠퍼스 (collect-06)
- 누른 길: `- '장학' 이동 → https://wise.dongguk.ac.kr/page/123`
- `- 화면 제목: 동국대학교 WISE캠퍼스 - 학사/장학 - 장학 - 국가장학 - 유형 1·2 다자녀(셋째아이 이상)`
- 항목 이름: `Ⅰ유형, 다자녀(세 자녀 이상) · Ⅱ유형 · 분류 · 성적기준 · 구분 · 기초,차상위 · 1구간 · 2구간 …`. 국가장학금 안내 표 화면이고, 글 목록이 아니다.
- `- 이 화면의 장학 관련 줄: 4개`
  - `· 교내장학금 안내  →  https://wise.dongguk.ac.kr/page/127` (3번)
  - `· 푸른등대기부장학  →  https://wise.dongguk.ac.kr/page/124`
- `- 그중 **공고 원문으로 바로 가는 주소**: 0개`. 그래서 열어 본 상세 화면이 없다.
- 로그에 없는 것: HTTP 상태 코드, 로그인 요구 판정, 날짜가 붙은 목록 줄, 분류 '장학'·'장학공지' 목록. 이 findBoard 절은 그 줄들을 찍지 않았다. 봇 차단 화면은 아니다(제목과 화면 글자가 정상 안내 내용이다).
- 참고: 같은 실행의 `https://www.dongguk.edu/article/JANGHAKNOTICE/list`(`- 화면 제목: 동국대학교 - 대학안내 - 공지사항 - 장학공지`)는 다른 사이트(dongguk.edu)다. 그 머리 메뉴에 `동국대학교 WISE캠퍼스` 링크가 따로 있다. 이것을 WISE 의 장학 게시판으로 볼 근거는 로그에 없다.

**결론(동국 WISE): schools.json `boardUrl` 을 넣을 근거가 없다.**
- '장학'을 누르면 국가장학 안내 페이지(`/page/123`)로 간다. 날짜가 붙은 글 목록은 하나도 보이지 않았다.
- `/page/123` 은 화면 제목으로 보아 안내 페이지라 boardUrl 자리에 넣지 않는다.
- `/page/127`·`/page/124` 는 이번에 열지 않았다. 링크 이름만 '교내장학금 안내'·'푸른등대기부장학'으로 보였다. 이 둘도 확인 없이 넣지 않는다(collect-06 의 '홈·안내 화면을 짐작으로 게시판 자리에 넣지 않는다').
- 다음 정찰은 장학 **공지** 목록을 찾는 쪽이어야 한다. 예: `findBoard: https://wise.dongguk.ac.kr/main | 장학공지`, 또는 `findBoard: https://wise.dongguk.ac.kr/main | 공지사항`. 둘 다 가설이다.
- 찾지 못하면 명세대로 개발자에게 묻는다.

### 2차 (run 37210290585 · job 111459915962 · 커밋 b6fb9997 · 리포트 `## 🔎 링크 정찰 리포트 (2026-10-04 23:43 KST)`)

**동국대 WISE**: `findBoard: https://wise.dongguk.ac.kr/main | 공지사항` (run-probe.txt 10행)
- 누른 길: `- '공지사항' 이동 → https://wise.dongguk.ac.kr/article/generalnotice/list`
- `- 화면 제목: 동국대학교 WISE캠퍼스 - 커뮤니티 - 공지사항 - 일반`
- 화면 글자: `… 커뮤니티 홈 커뮤니티 공지사항 일반 인쇄 공유 일반 총 773 개의 게시물이 있습니다. 제목 내용 작성자 제목 + 내용 검색 …`
- 날짜 붙은 글 줄(화면 글자 원문 순서 그대로, 앞 10줄):
  1. `공지 [혁신] 2026학년도 2학기 교양융합교육원 제34회 WISIAN 글쓰기 공모전 신청 안내 2026.09.17.`
  2. `공지 [혁신] 2026학년도 2학기 교양융합교육원 ‘의사소통능력 향상 비교과 프로그램’ 수강 신청 안내 2026.09.17.`
  3. `공지 양산지역 학생통학버스 운행 시간표 변경 안내 2026.09.17.`
  4. `공지 2026-2학기 비교과 교육과정 안내 2026.09.02.`
  5. `773 [혁신] 2026학년 2학기 교양융합교육원 WISIAN AI ON! AI 크리에이터 공모전 신청 안내 2026.10.02.`
  6. `772 [혁신] 2026학년 2학기 교양융합교육원 WISIAN AI ON! AI 이노베이터 공모전 신청 안내 2026.10.02.`
  7. `771 [혁신] 2026학년도 대학혁신지원사업 우수 사례 공모전 개최 안내(~10월 7일) 2026.10.02.`
  8. `770 [정각원] 2026.10. 5.(월) 전 동국인 아침예불 미봉행 안내 2026.10.02.`
  9. `769 2026년 대학도서관 이용자 만족도 조사 참여 안내(~10/13) 2026.10.02.`
  10. `768 [혁신] 교수학습개발센터 2026-2학기 학습법 LXP 시행 안내 2026.10.01.`
- 각 줄의 href·onclick 은 로그에 없다(findBoard 절은 그 줄을 찍지 않는다). HTTP 상태 코드와 로그인 요구 판정도 없다. 봇 차단 화면은 아니다(제목과 글 목록이 정상으로 보인다).
- `- 이 화면의 장학 관련 줄: 2개`가 있지만 둘 다 메뉴 `· 교내장학금 안내  →  https://wise.dongguk.ac.kr/page/127` 이다. `- 그중 **공고 원문으로 바로 가는 주소**: 0개`
- 보이는 글 10줄 가운데 장학 글은 없다. 분류 '장학'이나 '장학공지' 이름도 로그에 없다. 제목 끝이 `공지사항 - 일반` 이라 공지사항 아래 다른 갈래가 있을 수도 있다. 하지만 다른 갈래 이름은 로그에 찍히지 않았다.

**결론(동국 WISE 2차): 장학 공고 게시판 주소는 여전히 정할 수 없다.** 확인된 것은 일반 공지 게시판 `https://wise.dongguk.ac.kr/article/generalnotice/list` 하나다(날짜 붙은 글 줄 있음 · 773건).
- 이 주소를 schools.json `boardUrl` 에 넣을 근거는 '장학 게시판이라서'가 아니다. 쓰려면 '일반 공지 게시판(장학 전용 아님)'이라는 사실을 note 에 그대로 적어야 한다. 넣을지는 개발자에게 묻는다. 이번에 보인 10줄에는 장학 글이 0건이었다.
- 서울 본교의 `/article/JANGHAKNOTICE/list` 와 같은 꼴의 WISE 주소를 짐작해 넣지 않는다.
- 다음 정찰 제안(가설): `findBoard: https://wise.dongguk.ac.kr/article/generalnotice/list | 장학`. 공지사항 안에 장학 갈래 탭이 있으면 눌러 최종 주소를 받으려는 것이다. 또는 `checkUrl: https://wise.dongguk.ac.kr/article/generalnotice/list` 로 글 줄의 href·onclick 과 메뉴의 다른 갈래 주소를 확인한다.

## 오케스트레이터 메모 (10-04 15:20Z)
- 동국대 WISE 캠퍼스는 **다른 세션이 이미 고쳤다**: collector/schools.json 의 boardUrl = https://wise.dongguk.ac.kr/article/servicenotice/list (메뉴 「장학/봉사」 · 교내·교외·국가장학 분류 · note 에 근거). 정찰 1·2차의 '장학 안내 표'·'일반 공지' 결과보다 이 근거가 정확하다. WISE 주소는 건드리지 말 것.
- collect-06 은 **이미 고쳐짐**: 커밋 3506962b(다른 세션 · 10-04 09:47Z)가 분교 셋(연세 미래 /bbs/wj/104/artclList.do?findClSeq=100 · 고려 세종 /koreaSejong/7906/subview.do · 동국 WISE servicenotice) 게시판을 모두 연결했다. 분교 주소는 건드리지 말 것. 리포트 머리 한 줄('서비스 중인데 게시판이 없는 학교 N곳')은 명세에 있으면 재발 방지로 한다.
