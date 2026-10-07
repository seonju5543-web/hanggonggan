

######## GROUP news
INVENTORY: .github/workflows/collect-news.yml=degraded; collector/collect-news.mjs=degraded; collector/find-news-boards.mjs=healthy; collector/news-kind.mjs=healthy; collector/news-board-rules.mjs=healthy; collector/collect-news-thumbs.mjs=healthy; collector/news-thumb.mjs=healthy; collector/news-sources.json=degraded; collector/news-health.json=healthy; collector/news-cursor.json=healthy; collector/news-config.json=healthy; collector/news-thumbs.json=healthy; collector/seen-news.json=healthy; collector/news-report.md=healthy; collector/news-thumbs-report.md=healthy; collector/find-news-boards-report.md=healthy; data/news/*.json=degraded; data/news/img/=healthy; .github/workflows/close-old-reports.yml=degraded; deploy-sync.yml (소식 부분)=healthy; check-live.yml (소식 부분)=healthy; robot-heartbeat (소식 감시)=healthy

--- [news-1] P1 (confirmed, code) 이미 실린 소식의 '미래 게시일'이 고쳐지지 않아 홈 맨 위에 '게시 2027-01-22' 같은 글이 뜬다
증상: 아주대 학생 홈 「우리 학교 소식」 첫 카드가 '[공지] [학부] 어학졸업인증… (~2027.1.22)'이고 '게시 2027-01-22'로 표시된다. 방송대 첫 카드는 '게시 2027-01-01', 성균관대 첫 카드는 '게시 2026-10-21'이다. 미래 게시일인 글은 7건(아주 3 · 방송대 1 · 성균관 1 · 강원 1 · 동국 WISE 1)이고, 수집일 + 30일(10-31~11-01)까지 맨 위에 머문다.
근거: data/news 실측 예: 아주대 n16dvfry.json '2027-01-22 (foundAt 2026-10-01) [공지] [학부] 어학졸업인증(2027년 2월 졸업)…(~2027.1.22)' · 한국방송통신대 '2027-01-01 [학적] 2027학년도 1학기 … (신청: 2027. 1. 1.~7.' · 성균관 '2026-10-21 사회과학대학 제40회 수선포럼 개최 안내: 2026.10.21.(수)'. 정렬은 app.js:3311 `.sort((a, b) => String(b.postedAt || b.foundAt …)` 로 게시일 내림차순이고, 표시는 app.js:3333 `excerpts: n.postedAt ? [{ label: '게시', text: n.postedAt }]`. 앱과 같은 비교식을 data/news 에 돌려 보니 세 학교 모두 이 글이 1위였다. '앞날은 비운다' 규칙은 247b89f9(2026-10-02 16:33 UTC · board-links.mjs:195·209)에 들어왔고, 해당 글들의 foundAt 은 10-01·10-02 로 그보다 앞선다. 발행 단계 collect-news.mjs:211-221 에는 게시일 하한 필터(`!n.postedAt || n.postedAt >= postedCutoff()`)만 있고 상한(오늘 이후) 검사나 재계산이 없다. verify/audit-data.js 에도 postedAt 검사가 없다(grep 0건).
원인: 게시일 규칙(제목 안 날짜·앞날 금지)을 고칠 때 새로 읽는 글에만 적용했다. 이미 실린 글은 발행 때 같은 잣대로 다시 거르지 않았다(원칙 7 소급 누락). 감사에도 '미래 게시일' 검사가 없어 관문을 그대로 통과한다.
수리안: collect-news.mjs 발행 단계(213행 근처)에 소급 한 줄을 넣는다: KST 오늘보다 뒤인 postedAt 은 지운다(delete n.postedAt). 이렇게 하면 수집일로 정렬되고 '게시' 줄도 사라진다. verify/audit-data.js 의 소식 검사에는 'postedAt > 오늘(KST)이면 오류'를 넣고, 관문 「교내 소식」에 red-green 표본(이미 실린 미래 게시일 글이 발행 뒤 비워지는지)을 더한다.
파일: collector/collect-news.mjs, verify/audit-data.js, verify/test-collector.mjs, app.js

--- [news-2] P2 (confirmed, workflow-yaml) 수동 실행마다 새 '교내 소식 수집 리포트' 이슈를 연다 — 새 글 0건이어도 연다 (19건이 열린 채 쌓임)
증상: 10-01에 리포트 이슈 9건, 10-02~03에 10건이 생겼다. 10-03(KST) 날짜로만 8건(#370~#377)이고 그중 6건(#372~#377)은 '새 글 0건'이다. 19건 모두 열린 채 개발자에게 배정(assignee)되어 있다.
근거: 이슈와 실행이 1:1로 맞는다. 수동 실행(event workflow_dispatch · actor seonju5543-web) run1~9 → #348·#351~#355·#358~#360. run12~19(10-02 15:45~20:24 UTC, 예: run19 https://github.com/seonju5543-web/hanggonggan/actions/runs/37060338461 이 20:29:31 에 끝나고 #377 이 20:29:25 생성) → #370~#377. 예약 run10·11 은 서강 🟡 때문에 needs_human=1 → #364·#369. 예약 run20·21·22 는 이슈를 만들지 않았다(step 13 skipped). 코드: collect-news.yml:156 `if: github.event_name == 'workflow_dispatch' || steps.run.outputs.needs_human == '1'` 이고, 163행은 항상 `gh issue create` 다(같은 날 이슈 찾기·댓글 경로 없음). 수동 실행 시각은 SESSIONS.md 「교내 소식 10~12차」·「사진 썸네일」 세션의 '첫·두 번째·세 번째 실제 실행' 기록과 겹친다(세션이 확인용으로 돌린 것으로 보인다 — actor 만으로는 사람과 세션을 구분할 수 없다).
원인: '수동 실행 때는 늘 만든다(첫 실행 확인용)'라는 첫날의 조건이 그대로 남았다. 이후 세션들이 확인할 때마다 수동 실행을 하면서 매번 새 이슈가 생겼다. CLAUDE.md 규칙 '새 공고 0건이면 이슈 대신 코멘트'가 이 로봇에는 구현되지 않았다.
수리안: collect-news.yml 리포트 단계를 바꾼다. ① 수동 실행이어도 needs_human=1 일 때만 새 이슈를 연다. 확인용 실행은 workflow_dispatch 입력값(report: true)으로 따로 켠다. ② 그 밖에는 열린 최신 '🗞 교내 소식 수집 리포트' 이슈에 요약 댓글만 단다. 같은 KST 날짜 제목의 이슈가 열려 있으면 그 이슈에 댓글을 단다. ③ 지금 열린 19건(#348~#377 중 소식 리포트)은 사람이 정리하거나, news-3 수정 뒤 close-old-reports 가 닫게 한다. 관문 「교내 소식」에 '수동 실행만으로 issue create 가 불리지 않는다'는 정적 검사를 더한다.
파일: .github/workflows/collect-news.yml, verify/test-collector.mjs

--- [news-3] P2 (confirmed, workflow-yaml) 오래된 리포트 닫기 로봇이 교내 소식 리포트를 고르지 않아 영영 닫히지 않는다
증상: 교내 소식 리포트 19건이 모두 열려 있다. 14일이 지나도 닫히지 않으며, 🚨·🔧 경보가 묻히는 상황(close-old-reports 를 만든 이유)이 다시 생긴다.
근거: .github/workflows/close-old-reports.yml:61 `select(.title | test("^(🤖 장학공고 수집 리포트|🖥 브라우저형 수집 리포트)"))` · group_by 도 general/browser 둘뿐이다. 마지막 실행은 2026-09-28 success(https://github.com/seonju5543-web/hanggonggan/actions/runs/36435735406)로 교내 소식 로봇(09-30 신설)보다 먼저였고, 신설 때 이 목록에 추가되지 않았다.
원인: 교내 소식 로봇을 새로 만들 때 리포트 정리 로봇의 제목 목록에 '🗞 교내 소식 수집 리포트'를 넣지 않았다.
수리안: close-old-reports.yml 정규식에 '🗞 교내 소식 수집 리포트'를 더하고 group_by 키에 news 를 더한다(유형별 최신 3건은 남겨 실패 알림 댓글이 달릴 자리를 둔다). 바로 정리하려면 dry_run 으로 목록을 본 뒤 실행한다(사람 판단).
파일: .github/workflows/close-old-reports.yml

--- [news-4] P2 (confirmed, code) 게시판 주소를 일부러 지운 경북대의 '포토뉴스' 5건이 계속 발행된다
증상: 경북대 학생 홈 「우리 학교 소식」에 '포토뉴스 대현119안전센터와 교내 어린이집에서 합동소방훈련 실시 경북대는 9월 30일 교내 어린이집에서…'처럼 본문이 붙은 제목의 사진 뉴스 5건이 공지로 뜬다. 개발자 요청으로 '포토뉴스 오탐 재발 방지'를 위해 주소를 비웠는데 데이터는 그대로이고, 10-31 무렵(수집일 + 30일)까지 남는다.
근거: data/news/nf097dk.json 경북대학교 5건 · foundAt 2026-10-01 · url viewBtin.action?bbs_cde=28… · 제목이 모두 '포토뉴스 …'로 시작. collector/news-sources.json 경북대학교: boardUrl null · home null · note '홈 메뉴 추적은 포토뉴스를 공지로 두 번 잡아 꺼 두었다'. run8 커밋 4b55e745 '경북 boardUrl·home 비움(포토뉴스 오탐 재발 방지 · 개발자 요청)'. 발행 코드 collect-news.mjs:210-221 의 필터(보관 기한·첨부·게시일·isNewsRow·중복·dropUnserved·숨김)에는 '설정에서 빠진 게시판의 글' 검사가 없다.
원인: 발행이 '지금 실린 글 + 새 글'을 합쳐 보관 기한으로만 걸러서, 출처 설정(news-sources.json)이 바뀌어도 그 학교의 옛 글이 30일 동안 남는다. 출처를 끌 때 데이터를 같이 정리하는 길이 없다.
수리안: collect-news.mjs 발행에서 news-sources.json 에 boardUrl 이 없는 학교의 글은 싣지 않는다(또는 hidden 표식을 단다). 게시판 주소가 바뀐 학교는 글 주소의 호스트·경로가 지금 boardUrl 과 다른 사이트면 뺄지를 개발자가 정한다. 관문에 '주소를 지운 학교의 글은 다음 발행에서 빠진다' 표본을 더한다.
파일: collector/collect-news.mjs, collector/news-sources.json, data/news/nf097dk.json

--- [news-5] P2 (guess, code) 서울대·고려 세종·건국 등 일부 게시판이 매번 같은 몇 건만 읽는데 '✅ 정상'으로 보고된다 — 고정 공지만 읽는 것으로 의심되나 미확인
증상: 서울대는 실행마다 '공지 글 2건 감지 · 새 글 0'이고, 실린 글 2건의 게시일이 08-07·08-20이다(10-04 기준 가장 새 글이 45일 전). 고려 세종은 3건(최신 09-22), 건국은 11건(최신 09-23)이고 10-01 이후 새 글이 0건이다. 학생에게는 낡은 공지 몇 건만 보인다.
근거: news-report.md 이력(2d46b08b · d70fabaa · ed9e58c8)의 '서울대학교 상태: ✅ 정상 (공지 글 2건 감지 · 새 글 0)'. data/news/nsgh1oi.json 2건(08-20 'AMP USA … 잠정 보류', 08-07 '등록금 납부 안내 첨부파일 있음'). news-sources.json autoFound.rows 가 서울대 5 · 고려 세종 5인 반면 연세 미래 24 · 건국 20이다. 서울대 표본에는 '2027년 서울대 대학원생 전기 SSBT 장학생 모집(~ 2026.09.27.)'(장학이라 빠짐)이 있다. collect-news.mjs:160 은 items.length > 0 이기만 하면 ✅ 이고, 게시일이 오래 멈춰 있는지 보는 신호는 없다. 작업 샌드박스에서는 학교 사이트에 닿지 않아 실제 목록과 대조하지 못했다.
원인: 확인되지 않음. 가능성은 둘이다. ① 서버 HTML 에는 고정(공지) 행만 있고 일반 행은 스크립트로 그려져 날짜 줄 눈(extractDatedRows)이 고정 행만 읽는다. ② 고른 게시판(건국·가천 학사공지, 영남 학사안내)이 원래 글이 드문 하위 게시판이다. 어느 쪽이든 로봇은 이것을 정상으로 보고해 아무도 모른다.
수리안: ① collect-news.mjs 리포트에 '정체' 신호를 더한다. 읽은 글의 가장 새 게시일이 N일(예: 14일) 넘게 그대로이거나, 글 줄이 5줄 이하이면 🟡 와 needs_human 으로 올린다. ② 서울대(snu.ac.kr/snunow/notice/genernal)와 고려 세종(7913/subview.do)은 스킬 probe-run 의 run-probe.txt checkUrl: 로 '서버 HTML 의 날짜 줄 수 vs 그려진 화면의 날짜 줄 수'를 잰 뒤에만 규칙을 정한다. ③ 건국·가천·영남은 대표 공지 게시판 후보로 바꿀지를 개발자가 정한다.
파일: collector/collect-news.mjs, collector/news-sources.json, collector/run-probe.txt

--- [news-6] P2 (confirmed, workflow-yaml) 실패 알림이 '열린 최신 리포트 이슈 댓글'뿐이라 이슈가 없으면 사라지고, 썸네일 단계 실패는 아예 알리지 않는다
증상: 지금은 실패 알림이 날짜 지난 수동 실행 이슈(#377 등)에 댓글로만 달린다. 리포트 이슈가 하나도 열려 있지 않으면(news-2·3을 고쳐 이슈가 줄면 그렇게 된다) 수집 실패·작업 실패·시간 초과 알림이 소리 없이 사라진다. 썸네일 단계(continue-on-error)가 실패하면 어떤 알림도 없고 하트비트도 job 성공으로 본다.
근거: collect-news.yml:81-92 '수집 단계 실패 알림'과 171-181 '실패·시간초과 알림'이 둘 다 `if [ -n "$last" ] && [ "$last" != "null" ]; then gh issue comment …` 이고, 이슈가 없을 때 갈 다른 길이 없다. 썸네일 단계(70-78행)의 outcome 을 보는 알림 단계가 없다. 다른 로봇들은 .github/actions/robot-down 을 쓰는데 collect-news.yml 에는 없다(grep). 예약 실행은 needs_human=0 이면 이슈를 만들지 않는다(run20~22 step13 skipped) — 따라서 댓글이 달릴 최신 이슈는 갈수록 오래된 것이 된다.
원인: 알림의 받는 곳을 '이 로봇이 만든 리포트 이슈'에 기대 설계했다. 그런데 그 이슈는 사람 손이 필요할 때만(또는 수동 실행 때만) 생기므로 받는 곳이 있다는 보장이 없다.
수리안: failure() || cancelled() 알림을 다른 로봇과 같은 composite(.github/actions/robot-down)로 바꿔 받는 곳이 없어도 이슈가 생기게 한다. '수집 단계 실패'도 열린 이슈가 없으면 새 이슈를 만든다. 썸네일 단계에 id 를 달고 outcome != success 일 때 같은 길로 알린다(이틀 연속일 때만 등으로 소음을 막는다).
파일: .github/workflows/collect-news.yml, .github/actions/robot-down/action.yml

--- [news-7] P3 (likely, code) 카드 제목에 행 꼬리·번호가 붙은 소식 28건 (항공대 전부 · 영남 전부)
증상: 항공대 소식 13건이 전부 '[의료지원실] 시험기간 비타민 데이 안내 학생지원팀 2026-10-02 26'처럼 부서·날짜·조회수가 제목에 붙어 있다. 영남대 6건은 '9 2026학년도 2학기 중간시험…'처럼 앞에 줄 번호가 붙어 있다. WISE 1건은 '… 2026.10.02. 이미영'(작성자) 꼬리, 경북 5건은 본문 꼬리가 붙어 있다.
근거: data/news 를 정규식으로 센 결과 565건 중 28건: 한국항공대 13 · 영남 6 · 경북 5 · 아주 1 · WISE 1 · 강원 1 · 서울대 1('첨부파일 있음'). 이슈 #369 본문에도 '[의료지원실] 시험기간 비타민 데이 안내 학생지원팀 2026-10-02 26'로 실렸다. 줄 꼬리 자르기(board-links.mjs cutRowTail)는 '꼬리가 짧고 기간 낱말 없을 때만' 자르고, 앞 번호 열은 다루지 않는다.
원인: 항공대·영남 게시판은 제목 링크가 줄(번호·부서·날짜·조회수) 전체를 감싸거나 번호 칸을 함께 담는 꼴인데, 자르기 규칙이 그 꼴을 덮지 못한다(정확한 HTML 은 미확인).
수리안: board-links.mjs 의 제목 정리에 '맨 앞 1~3자리 번호 + 공백' 떼기와 '부서명 + 게시일(행 날짜와 같은 값) + 숫자' 꼬리 떼기를 더한다(게시일과 같은 날짜일 때만). 발행 때 이미 실린 글에도 소급한다. 실제 HTML 은 정찰(checkUrl)로 받아 관문 표본으로 쓴다.
파일: collector/board-links.mjs, collector/collect-news.mjs, verify/test-collector.mjs

--- [news-8] P3 (confirmed, human-decision) '게시판 주소 미설정'(경북)은 사람 손이 필요한데 리포트 이슈 조건에 없다 — 경북 요청이 10-02 이후 묻혔다
증상: 경북대 학생에게는 곧(포토뉴스 만료 뒤) 소식이 0건이 되는데, 게시판 주소를 달라는 요청이 이슈로 다시 올라오지 않는다. 서강대도 ℹ️(60일 안 0건)라 학생 화면에는 '연결 전이거나 새 소식이 없어요'만 보인다.
근거: collect-news.yml:151-152 주석은 '리포트 이슈는 사람 손이 필요할 때만 만든다(연속 실패·글을 못 읽는 게시판·찾기 로봇이 못 찾은 학교)'인데, collect-news.mjs:281 은 `needs_human=${(chronic.length + noRows.length) ? '1' : '0'}` 로 unset(⚙️)을 넣지 않는다. 예약 run20~22 는 경북 ⚙️ 인데도 이슈 단계가 skipped 였다. news-sources.json 경북 note '🙋 개발자 요청: 학생이 로그인 없이 보는 경북대 공지 목록 주소가 필요하다'.
원인: 주석의 의도와 코드가 다르다. 미설정 학교가 needs_human 계산에서 빠져 있다.
수리안: needs_human 에 '찾기 로봇도 못 찾은(probe 표식) 미설정 학교'를 더한다(소음을 막으려면 주 1회 같은 이슈에 댓글). 경북대 공지 목록 주소는 개발자가 정한다(주소를 짐작해 넣지 않는다).
파일: collector/collect-news.mjs, .github/workflows/collect-news.yml, collector/news-sources.json

--- [news-9] P3 (likely, secret-or-external) 예약 실행이 매번 2.4~6.3시간 늦게 돈다 (07:19 KST 예정이 09:44~10:43 KST에 실행)
증상: 하루 2회 갱신이 실제로는 오전 10시 무렵과 저녁 7시 무렵에 일어난다. 오후 실행은 6시간 넘게 밀린 적도 있다.
근거: cron '19 22 * * *'·'19 4 * * *'(collect-news.yml:10-11) 대비 실제 시작: 10-02 01:43(+3h24m) · 10-02 10:34(+6h15m) · 10-03 01:14(+2h55m) · 10-03 09:55(+5h36m) · 10-04 00:44(+2h25m) — actions_list list_workflow_runs. 실행 누락은 없다. 하트비트(#385)는 '기대 간격 × 3' 문턱이라 경보하지 않는다.
원인: GitHub 예약 스케줄러의 지연으로 보인다(저장소 쪽에서 원인을 확인할 수 없다). 정각은 이미 피했다.
수리안: 코드로 고칠 일은 아니다. 지연이 계속 문제가 되면 다른 로봇의 workflow_run 에 이어 붙이거나 예약 시각을 지연을 감안해 앞당기는 안을 개발자가 정한다. 앱 머리글 '매일 갱신' 문구는 사실과 맞다.
파일: .github/workflows/collect-news.yml

--- [news-10] P3 (likely, workflow-yaml) close-old-reports.yml 의 실패 알림이 저장소를 받지 않은 채 로컬 액션을 부른다
증상: 리포트 정리 로봇이 넘어지면 '🚨 로봇이 넘어졌다' 단계도 액션 파일을 못 찾아 함께 실패할 것으로 보인다. 그러면 이 로봇의 넘어짐은 조용해진다(아직 실패한 적이 없어 실측은 없다).
근거: .github/workflows/close-old-reports.yml 의 steps 는 '오래된 리포트만 골라 닫는다'와 106행 `uses: ./.github/actions/robot-down` 둘뿐이고 actions/checkout 이 없다. 같은 꼴이 push-health.yml 에도 있다(grep -L actions/checkout).
원인: 로컬 composite 액션은 저장소를 받은 뒤에만 쓸 수 있는데, 저장소를 받지 않는 작업에 그 액션을 넣었다.
수리안: robot-down 단계 앞에 `- uses: actions/checkout@v4`(sparse-checkout: .github/actions)를 넣는다. push-health.yml 도 같이 고친다.
파일: .github/workflows/close-old-reports.yml, .github/workflows/push-health.yml

--- [news-11] P3 (guess, workflow-yaml) 썸네일 단계가 버전을 고정하지 않은 sharp 를 끝을 맞은 Node 20 위에 매번 새로 설치한다
증상: sharp 새 판이 Node 20 지원을 빼거나 설치가 깨지면 썸네일 단계가 실패한다. news-6 때문에 이 실패는 알림 없이 지나간다. 새 글에 사진이 붙지 않을 뿐 수집은 계속된다.
근거: collect-news.yml:45 `node-version: 20` · 77행 `npm i sharp --no-audit --no-fund --silent`(버전 고정 없음). run22 로그 끝에 '##[warning]Node.js 20 is deprecated'가 있다(액션 런타임 경고).
원인: 그림 도구를 이 단계에서만 그때그때 받는 설계에 버전 고정이 없다.
수리안: `npm i sharp@0.34.x`처럼 확인된 판으로 고정하고, node-version 을 22로 올릴지 다른 로봇과 함께 정한다.
파일: .github/workflows/collect-news.yml

--- [news-12] P3 (confirmed, code) 소식 판정의 작은 구멍 — 합격자·선발 결과 글이 실리고, 장학 성격의 '학업지원금'이 소식으로 간다
증상: '최종 합격자 알림'(서울과기대) · '최종 합격자 안내'(명지) · '서류전형 합격자 및 필기시험 일정 공고'(충북) · '선발 결과 안내'(항공대)가 소식으로 실린다. 'HY사회복지재단 취약계층 학비보조 지원사업 … 학업지원금 선발'(충북·중앙)은 장학 피드가 아니라 소식에만 뜬다.
근거: data/news 검색 결과. news-kind.mjs NOT_NEWS 는 `합격자\s*(?:발표|명단|공지|공고)` · `선정\s*(?:결과|자)\s*(?:발표|안내|공지)` 만 다룬다('알림'·'안내'·'선발 결과'는 안 걸린다). collect-news.mjs:33 KEYWORDS `/장학|학자금|등록금 감면|학업장려|근로장학/` 에 '학비보조·학업지원금'이 없다(장학 수집기와 같은 그물).
원인: 낱말 목록의 빈칸이다. 장학 그물은 collect.mjs 와 같아야 하므로 이 로봇만 따로 넓힐 수는 없다.
수리안: news-kind.mjs NOT_NEWS 에 '합격자 (알림|안내)'·'선발 결과'를 더한다(관문의 '싣는다' 예시와 red-green). '학비보조·학업지원금'을 장학 그물에 넣을지는 장학 수집기 그룹과 함께 정한다(그물은 한 벌).
파일: collector/news-kind.mjs, collector/collect-news.mjs, collector/collect.mjs, verify/test-collector.mjs

--- [news-13] P3 (confirmed, code) seen-news.json 이 정리되지 않고 계속 자란다
증상: 이미 본 글 장부가 3일 만에 727개 열쇠·85KB가 됐다. 하루 두 번 커밋과 합집합 병합 대상이라 해마다 수 MB로 커진다.
근거: collector/seen-news.json 열쇠 727 · 가장 오래된 값 2026-10-01. collect-news.mjs 에는 seen[...] 를 지우는 코드가 없다(152-154행에서 넣기만 한다).
원인: 게시일 상한(60일)·보관 기한(30일) 밖의 글은 다시 실릴 수 없는데도 그 열쇠를 지우지 않는다.
수리안: 저장 직전에 값(수집일)이 90일 넘은 열쇠를 지운다(NEWS_POSTED_MAX_DAYS 보다 길게 잡아 옛 글이 다시 새 글로 실리지 않게). 관문에 '90일 지난 열쇠는 지워지고 60일 안 열쇠는 남는다' 표본을 더한다.
파일: collector/collect-news.mjs

--- [news-14] P3 (confirmed, workflow-yaml) 데이터 감사 실패 알림이 실패할 때마다 새 이슈를 연다 (같은 날 중복 막기 없음)
증상: 관문이 빨간불로 남으면 하루 두 번(수동 실행 때는 그 이상) '🚨 교내 소식 데이터 감사 실패' 이슈가 새로 생긴다. 아직 일어난 적은 없다.
근거: collect-news.yml:113-122 `gh issue create --title "🚨 교내 소식 데이터 감사 실패 $(TZ=Asia/Seoul date +%Y-%m-%d) …"` — 같은 제목의 열린 이슈가 있는지 보지 않는다.
원인: '첫 실행엔 댓글 달 이슈가 없다'는 이유로 늘 새로 만들게 했다.
수리안: 같은 제목 접두사('🚨 교내 소식 데이터 감사 실패')의 열린 이슈가 있으면 거기에 댓글을 달고, 없을 때만 만든다.
파일: .github/workflows/collect-news.yml

NOTES: 진단 시점: HEAD 는 과제에 적힌 b71da694 가 아니라 ca94c76e(2026-10-04 02:44 UTC)로 바뀌어 있었다. git ls-remote 결과 main 과 기본 브랜치 모두 ca94c76e 이고, 소식 데이터(362b841f)는 main 까지 나가 있다.

질문별 답:
(1) 왜 이렇게 자주 돌았나 — push 트리거(run-news.txt)나 매 커밋 때문이 아니다. 22회 중 17회가 workflow_dispatch(actor seonju5543-web)이다. 10-01 run1~9 는 교내 소식 2~9차 수리 직후, 10-02 15:45~20:24 UTC run12~19 는 10~12차 배포와 썸네일 첫·두 번째·세 번째 실제 실행 시각과 겹친다(SESSIONS.md). 세션이 GitHub 연결로 사용자 이름을 달고 수동 실행한 것으로 보이지만, actor 만으로 사람과 세션을 구분할 수는 없다. 예약 실행은 하루 2회 그대로이고 누락은 없으며, 2.4~6.3시간 늦을 뿐이다.
(2) 왜 매번 새 이슈인가 — collect-news.yml:156 의 '수동 실행이면 무조건' 조건과 163행 gh issue create(news-2) 때문이다. 예약 실행은 서강이 🟡이던 10-02 두 번만 이슈를 만들었고, 10-03 이후 예약 3회는 만들지 않았다.
(3) 닫히나 — 닫히지 않는다(news-3).

학교별 상태: 44곳 중 41곳이 ✅(매 실행 1분40초~2분50초). 서울대 503 은 1회째, 서강 ℹ️ 은 SESSIONS 정찰로 확인된 '60일 안 새 글 없음', 경북은 게시판 주소가 없다. 0행이 반복되는 학교는 없다. 다만 '✅인데 몇 건이 계속 그대로인' 서울대·고려 세종·건국은 의심 대상이다(news-5 · 미확인).
썸네일: 565건 중 217건에 사진이 있다(41%). 단계 실패는 없었다.
관문: test-collector 「교내 소식」·「교내 소식 썸네일」 통과. audit-data 통과.

다른 그룹으로 넘길 것:
- 원문 링크 확인 로봇 리포트(collector/link-check-report.md)의 '교내 소식 556 · 아직 안 봄' — 소식 링크는 아직 한 번도 열어 확인하지 않았다(첫 실행 순서에서 뒤로 밀렸다).
- push-health.yml 도 robot-down 을 checkout 없이 쓴다(news-10).
- 장학 그물 KEYWORDS 에 '학비보조·학업지원금'이 없는 것은 장학 수집기와 같이 다뤄야 한다(news-12).

이번 진단은 읽기만 했다. 워크트리를 만들지 않았고, 파일 수정·실행 트리거·이슈 조작도 하지 않았다. 작업 공간 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/news/ 에는 빈 로그 파일(run22.log · gh 인증 실패) 하나만 있다.


######## GROUP api
INVENTORY: .github/workflows/open-api.yml (공공 API 로봇)=degraded; collector/open-api.mjs=healthy; collector/open-api-map.mjs=healthy; collector/open-api-report.md=healthy; collector/run-open-api.txt (push-to-run)=healthy; GitHub secrets DATA_GO_KR_KEY · YOUTHCENTER_KEY · YOUTHCENTER_CONTENT_KEY=healthy; collector/activity-kind.mjs=healthy; collector/activity-excerpts.mjs=degraded; collector/activity-sources.json=degraded; collector/activity-config.json=healthy; collector/seen-activities.json=healthy; data/activities.json=healthy; act-docs.json / act-browser.json 합치기 (activity-docs.mjs --apply · mergeBrowserResults)=degraded; collector/robots.mjs=degraded; collector/external-sources.json=degraded; collector/find-boards.mjs (+ find-boards-report.md)=healthy; collector/board-links.mjs=healthy; collector/external-clean.mjs=degraded; collector/seen-external.json=healthy; data/external.json=degraded; check-live.yml 의 활동·재단 파일 점검=broken; 이슈 #356 (🛰 공공 API 로봇 알림)=degraded

--- [api-01] P1 (confirmed, code) 재단·지자체 '새 공고'에 이미 마감됐거나 몇 기수 전인 글이 섞여 학생에게 보인다
증상: 앱 홈 「재단·지자체 새 공고」 48건 중 최소 19건이 신청할 수 없는 글이다. 제 신청기간 문구로 이미 마감된 글 7건(송파 상반기 6/24 마감·해외문화체험 5/29·김해 상반기 3/20·음성 군민평생 9/18·영동 9/18 등), 제목에 [마감] 이 붙은 고속도로장학재단 글 1건, 지헌·삼원장학재단 '제18기~제24기 전기' 지난 기수 공고 11건이다. 카드에 마감 표시도 없이 '새 공고'로 뜬다
근거: data/external.json 을 scratchpad/api/ext-dl.mjs 로 셌다(activityExcerpts 로 deadlineHint 의 끝 날짜를 읽음): closed 8 · open 8 · 모름 32 / 48. 지헌·삼원 12건(제18기 전기~제24기 후기, URL wr_id=10~36)은 모두 foundAt 2026-09-30 이다. 앱의 externalNoticesForMe(app.js 3233 부근)는 주소·주최·등록 여부만 거르고 마감으로는 거르지 않는다. 외부 글에는 deadline 칸이 아예 없다(collect.mjs:569-586 은 deadline 을 만들지 않는다). external-clean.mjs:14 주석은 '날짜가 없는 글은 옛 글인지 모른다 — 짐작해 빼지 않는다'이다
원인: 외부 게시판 글에는 마감(deadline)을 만들지 않는다. 그래서 행에서 읽은 신청기간(deadlineHint)이 이미 지나도 거를 근거가 없다. dropReason 은 게시일(postedAt)이나 제목 연도만 본다. 지헌·삼원 게시판은 행에 날짜가 없어 2페이지(page=2)까지 읽은 지난 기수가 모두 오늘 수집분(foundAt)으로 찍혔다
수리안: ① collect.mjs 가 외부 글을 발행할 때 deadlineHint(목록 행의 신청기간)에서 장학과 같은 extractDeadline(activityExcerpts)로 마감을 읽어 deadline 칸에 넣는다. 그러면 앱의 noticeCardHtml 이 D-day 를 그리고, externalNoticesForMe 에 activitiesForMe 와 같은 CLOSED_KEEP_DAYS 거름을 하나 넣는다(또는 dropReason 에서 '마감 지남'으로 뺀다 — 규칙은 external-clean.mjs 한 곳). ② 제목의 [마감] 표식은 dropReason 의 NOT_APPLY 에 넣는다. ③ 날짜 없는 기수 공고는 짐작하지 않는 원칙을 지킨다. 대신 처음 읽는 게시판의 2페이지 이후 행은 '새 공고'로 싣지 않거나, 같은 게시판에서 '제N기'가 여럿이면 가장 큰 N 만 남기는 규칙을 개발자와 정한다. 관문 「재단·지자체 게시판」에 지난 신청기간 행·[마감] 행이 빠지는지 red-green 을 추가한다
파일: collector/collect.mjs, collector/external-clean.mjs, app.js, data/external.json

--- [api-02] P1 (confirmed, code) [다른 묶음 · 수집/자동 등록] 실데이터에 기댄 관문이 빨간불이라 수집 로봇의 자동 등록이 매번 되돌려진다
증상: 10-04 01:57 UTC 수집 실행의 데이터 관문에서 test-collector 가 '✕ 실패 1건'으로 끝났다. 그래서 그 실행이 자동 등록한 8건(하나금융나눔재단·학업수석총장장학금·선원가족장학금 등)이 모두 되돌려졌다. 지금 HEAD 에서도 같은 검사가 실패하므로, 고치기 전까지는 다음 실행들도 자동 등록분을 되돌린다
근거: run https://github.com/seonju5543-web/hanggonggan/actions/runs/37169572702 로그: '✕ 실패 1건 — 수집기 중복 제거 규칙이 깨졌습니다' → '이번 실행의 자동 등록 8건을 되돌렸습니다'. 일회용 worktree 에서 a31a8538 과 ca94c76e(HEAD) 둘 다 node verify/test-collector.mjs 를 돌렸더니 exit 1, '✕ 등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다 / 받은 값: ["auto-202026091720eca1b0ed9a8c"]'(test-collector.mjs:7972-7981). 이 공고는 187b430a 까지는 eligibilityLines 가 없었고 a31a8538(10-04 수집)에서 생겼다. 그 줄 '첫째, 학사, 석사ㆍ박사과정에 재학 중인 …'에 대해 PR.gradTarget=body, PR.mentionsUndergrad=false 다. 오케스트레이터의 '전부 통과'는 b71da694(이 데이터가 들어오기 전) 기준이다
원인: ① parse-requirements 의 mentionsUndergrad 가 '학사'를 학부 언급으로 알아보지 못한다. 그래서 학부생도 받는 공고를 관문이 '대학원 전용'으로 오판한다(엔진이 점수를 매긴 것은 맞다). ② CLAUDE.md 가 금지한 '실데이터에 기댄 고정 검사'가 데이터 관문 안에 있다. 로봇이 새 자격 줄을 채운 순간 관문이 빨개지고 자동 등록이 멈춘다
수리안: mentionsUndergrad 에 '학사(과정)'를 넣는다. 그 줄을 쓴 red-green 단위 검사를 추가한다. 데이터 전수 검사(test-collector.mjs:7972-7981)는 관문에서 빼서 audit-data.js 의 경고(warns)로 옮긴다. 수집 묶음 담당에게 넘길 것
파일: verify/test-collector.mjs, parse-requirements.js, data/registered.json

--- [api-03] P2 (likely, none-already-fixed) 공공데이터포털(K-Startup·1365) 'fetch failed' 는 간헐적인 연결 시한 초과로 보인다 — 보강은 들어갔으나 실패 상황에서는 아직 증명 안 됨
증상: 10-01 13:48 UTC 와 10-02 23:02 UTC 실행에서 K-Startup·1365 가 함께 '요청 실패: fetch failed' 로 ❌ 였다. 같은 시각 온통청년(다른 호스트)은 성공했다. 그날 두 출처의 새 글이 빠졌다(지난 글은 지켜졌다)
근거: run 37075588410 로그 '- ❌ **K-Startup 사업공고** — 요청 실패: fetch failed · 지난 글 그대로 둠' / '- ❌ **1365 봉사참여정보** — 요청 실패: fetch failed'. run 36871386263 은 온통청년이 ⏸(열쇠 없음)라 공공데이터포털 두 출처만 돈 실행인데, '공공 API 받기' 단계가 13:48:39→13:50:00 으로 81초 걸렸다. 당시 코드는 REQ_MS 20000·시도 3회·쉼 3초+6초(0659348f:open-api.mjs)였다. 출처당 약 40초이므로 (40−9)/3 ≈ 시도당 10.3초다. AbortSignal 20초에 걸렸다면 'fetch failed'가 아니라 TimeoutError('응답 없음')가 찍혔을 것이다. 10초는 Node fetch(undici)의 기본 연결 시한과 같다. 러너는 Azure westus3. 성공한 실행: 37157526699(10-03 22:10)·10-02 12시대 수동 실행들
원인: 추정: apis.data.go.kr 에 대한 TCP·TLS 연결이 10초 안에 맺어지지 않았다(undici 연결 시한 초과 = UND_ERR_CONNECT_TIMEOUT 꼴). 이름을 못 찾았거나(즉시 실패) 인증서 오류(즉시 실패)였다면 시도당 10초가 걸리지 않는다. 늘 막히는 지역 차단이라면 같은 날 낮 실행이 성공할 수 없다. 원인 코드는 그때 로그에 없었으므로 확정이 아니다
수리안: 이미 ac930fb7 에 세 가지가 들어갔다. 다시 묻기 전 10초·40초 쉼(open-api.mjs:67), 실패 원인 코드 기록(open-api.mjs:71), 16:17 KST 백업 예약(open-api.yml:14). 다음 실패 때 리포트의 '(UND_ERR_CONNECT_TIMEOUT …)' 같은 원인 코드를 보고 확정한다. 인증서 사슬이 의심되면 run-probe.txt 에 'certHost: apis.data.go.kr' 를 적어 확인한다. 같은 원인이 반복되면 연결 시한을 늘린 undici Agent(dispatcher)를 쓰는 것을 검토한다
파일: .github/workflows/open-api.yml, collector/open-api.mjs
이미수리: ac930fb7 (2026-10-04 02:23 KST) — 그 뒤 run 37157526699 성공. 다만 그 실행은 포털이 멀쩡했던 날이라 '실패를 넘기는지'는 아직 증명되지 않았다

--- [api-04] P2 (confirmed, workflow-yaml) 앱 반영 점검(check-live)이 data/activities.json·data/external.json 을 보지 않는다
증상: 대외활동 탭과 홈 「재단·지자체 새 공고」가 받는 파일이 배포에서 빠지거나 낡아도 매일 점검이 초록불이다. CLAUDE.md 의 '새 데이터 파일을 앱이 받게 하면 이 점검에도 넣는다' 규칙을 어긴 상태다
근거: check-live.yml:42-79 의 EXTRA 목록은 notices 색인·학교별·학과 2·소식·소식 사진·link-check·학교 사진뿐이다. 'activities'·'external' grep 0건. app.js:2968 fetch('data/activities.json') · app.js:3223 fetch('data/external.json')
원인: 대외활동 탭(09-25)과 재단·지자체 피드(09-26)를 만들 때 check-live 의 대조 목록에 두 파일을 넣지 않았다. 대조 목록은 손으로 늘리는 구조다
수리안: check-live.yml EXTRA 에 data/activities.json·data/external.json 을 넣는다. count() 가 items 로 세므로 그대로 맞는다. test-collector 에 'app.js 가 fetch 하는 data/*.json 은 check-live 목록에 있다'는 정적 관문을 추가한다(kosaf-open.json 등 다른 누락도 같이 잡힌다)
파일: .github/workflows/check-live.yml, verify/test-collector.mjs

--- [api-05] P2 (likely, code) robots.txt 의 와일드카드 규칙을 '사이트 전체 금지'로 잘못 읽는다
증상: robots.txt 에 'Disallow: /*.pdf$'·'Disallow: /*?' 처럼 * 가 든 줄이 하나라도 있으면 그 사이트의 모든 게시판을 ⛔ 로 건너뛴다. 지금 ⛔ 출처는 대외활동 5곳(외대 2·정부24·한국콘텐츠진흥원·인천유스톡톡)과 재단 2곳(한진해운·한국고등교육재단)인데, 이 가운데 몇 곳이 오판인지는 모른다
근거: collector/robots.mjs:34 'list.filter((r) => p.startsWith(r.replace(/\*.*$/, '')))' — '*' 부터 끝까지 지워서 '/*.pdf$' 가 '/' 가 된다. 실험(scratchpad/api/robots-test.mjs): 'Disallow: /*.pdf$' + '/kocca/pims/list.do' → false, 'Disallow: /*?' + '/bbs/board.php' → false, 'Disallow: /*/print' + '/portal/cnstexhb' → false. collector/report.md(10-04) 의 ⛔ 줄 7개. 샌드박스에서는 해당 robots.txt 를 못 받아(프록시 403) 실제 내용은 확인하지 못했다
원인: allowedByRules 가 robots 와일드카드(*·$)를 패턴으로 해석하지 않고 접두사로 잘라 쓴다. 질의 문자열도 보지 않는다(u.pathname 만 본다)
수리안: robots.mjs 에 * → '.*', 끝의 $ → 끝 고정으로 바꾸는 정규식 매칭(구글 해석)을 넣고, 경로+질의(pathname+search)로 비교한다. 관문에 '/*.pdf$ 는 list.do 를 막지 않는다'·'/*? 는 질의 있는 주소만 막는다' red-green 을 추가한다. 그 뒤 ⛔ 7곳의 robots.txt 를 run-probe.txt checkUrl 로 떠서 실제로 막힌 곳만 parked 로 옮긴다
파일: collector/robots.mjs, verify/test-collector.mjs, collector/activity-sources.json, collector/external-sources.json

--- [api-06] P2 (confirmed, code) 브라우저·첨부 경로가 K-Startup 활동에 개인정보 안내문과 '여러 갈래 나이' 줄을 자격으로 넣는다 — 40세 이상에게 틀린 미달
증상: 대외활동 「2026년 SaaS 전환지원센터xAWS SaaS 현대화 교육 4회차」의 지원 자격이 '신청 시 요청하는 정보(개인정보포함)는 … 유의하여 주시기 바랍니다.'와 '대상연령 : 만 20세 이상 ~ 만 39세 이하, 만 40세 이상' 두 줄이다. 판정 엔진(fitDetail)은 45세 프로필에 이 나이 줄을 미달로 낸다. 원문은 40세 이상도 받는다(틀린 미달)
근거: collector/act-browser.json: pbancSn=179371 → lines 3줄, from '브라우저 본문'. data/activities.json 의 같은 글 eligibilityFrom '브라우저 본문'. node 로 ME.fitDetail 을 돌렸다: age 45 → fails ['대상연령 : 만 20세 이상 ~ 만 39세 이하, 만 40세 이상'], age 25 → met 1. 앱은 activityFit → fitDetailFor 로 같은 엔진을 쓴다(app.js:3111-3114). API 매퍼는 같은 칸이 여러 갈래면 자격 줄로 쓰지 않는다(open-api-map.mjs:142-143 'biz_trgt_age && !/,/.test(...)'). 그런데 activity-excerpts.mjs:75·101 의 '납작해진 표' 규칙은 '대상연령 ↵ 만 20세 이상 …'을 그대로 이어 자격 줄로 만든다. 현재 같은 꼴은 이 1건이다
원인: '여러 갈래 나이는 자격 줄로 쓰지 않는다'는 규칙이 API 매퍼에만 있고, 본문·브라우저·첨부 경로가 쓰는 activityDetails(한 곳 규칙)에는 없다. 개인정보 처리 안내문을 자격이 아닌 줄로 거르는 규칙도 없다
수리안: activityDetails(activity-excerpts.mjs) 안에서 '대상연령' 값에 쉼표로 갈래가 여럿이면 자격 줄에서 뺀다(API 규칙을 이쪽으로 옮겨 한 곳으로 둔다). '개인정보…유의' 같은 안내 문장은 자격 후보에서 뺀다. 관문 「대외활동 — 남은 글 표본」에 이 두 줄 red-green 을 추가한다. 이미 실린 글은 수집 로봇 발행 때 소급되게 하고, act-browser.json 의 해당 줄도 다시 고른다
파일: collector/activity-excerpts.mjs, collector/open-api-map.mjs, collector/act-browser.json, data/activities.json

--- [api-07] P2 (confirmed, workflow-yaml) 공공 API 알림 이슈 #356 이 회복돼도 닫히지 않고 ❌ 상태로 남는다
증상: 10-03 22:10 실행이 출처 넷 모두 ✅ 였는데, 이슈 #356 은 열린 채 마지막 코멘트가 'K-Startup·1365 ❌'다. 보는 사람은 지금도 고장 난 줄 안다
근거: 이슈 #356 코멘트 3개(마지막 10-02 23:06 UTC = 10-03 08:06 KST, ❌ 둘). run 37157526699 의 '🚨 출처 실패 알림' 단계는 0초에 끝났다(❌ 없음 → exit 0). open-api.yml:80-99 에는 ❌ 가 없을 때 회복 코멘트를 달거나 이슈를 닫는 단계가 없다
원인: 알림 단계가 실패 때만 쓰고, 회복을 알리거나 닫는 길이 없다
수리안: 알림 단계에서 ❌·job 실패가 없고 열린 '공공 API 로봇' 이슈가 있으면 '✅ 회복 — 출처 넷 정상(실행 링크)' 코멘트를 달고 gh issue close --reason completed 로 닫는다. 지금 #356 은 사람이 닫거나, 이 수정 뒤 첫 성공 실행이 닫는다
파일: .github/workflows/open-api.yml

--- [api-08] P3 (likely, code) 공공데이터포털이 연결 시한으로 늘어지면 늘어난 재시도가 6분 예산을 먹어 온통청년 출처까지 ❌ 가 될 수 있다
증상: 포털 장애일에는 K-Startup·1365 가 먼저 돌며 재시도로 시간을 쓴다. 뒤에 도는 청년콘텐츠·청년정책(32쪽, 쪽 사이 2.5초)이 '전체 시간 예산(6분) 초과'로 ❌ 가 되어, 멀쩡한 출처의 새 글까지 빠질 수 있다
근거: 출처 순서 kstartup→vol1365→youthContent→youthPolicy(open-api-map.mjs:33-37). 예산 BUDGET_MS 6분(open-api.mjs:36). 위 api-03 의 실측(시도당 약 10.3초)에 새 쉼 10초+40초를 더하면 출처당 약 81초, 둘이면 약 162초다. 정상 실행 37157526699 의 받기 단계가 182초였으니, 온통청년 몫 약 140초를 더해 약 300초가 된다. 청년정책이 403/400 으로 30초씩 쉬는 날(open-api.mjs 청년정책 블록)이나 AbortSignal 20초 꼴의 장애(출처당 110초)면 360초를 넘는다
원인: 호스트가 다른 두 묶음(apis.data.go.kr · youthcenter.go.kr)을 한 줄로 차례대로 돌며 예산 하나를 나눠 쓴다
수리안: 호스트별 두 묶음을 Promise.all 로 함께 돌리거나(서로 다른 서버라 속도 제한과 무관), 출처마다 제 몫 예산을 준다. 또는 공공데이터포털 묶음을 맨 뒤로 보낸다. 관문 「공공 API 로봇」에 '포털 실패가 온통청년 예산을 먹지 않는다'를 가짜 fetch 로 잰다
파일: collector/open-api.mjs, collector/open-api-map.mjs

--- [api-09] P3 (confirmed, human-decision) 대외활동 출처 23곳 중 14곳이 글을 하나도 못 내는데 알림·건강 기록이 없다
증상: 수집 리포트마다 같은 ⚠️·⛔·🟡 줄이 반복되지만, 학교 게시판처럼 연속 실패를 세서 알리는 장치가 없어 그대로 방치된다. 청년재단·경희대 대외활동은 주소가 404 다
근거: collector/report.md 247b89f9(10-02)~a31a8538(10-04) 다섯 판에서 같은 상태: '경희대학교 대외활동·공모전 — ⚠️ 접속 실패 (HTTP 404)' · '청년재단 대외활동·공모전 — ⚠️ 접속 실패 (HTTP 404)' · 🟡 7곳 · ⛔ 5곳. collector/health.json 키 41개 중 활동·재단 출처는 0개. 재단 쪽도 미래에셋박현주·롯데장학 🟡 가 계속된다. '온통청년 청년참여 프로그램' 게시판(bbs03List/48)은 이제 공공 API 청년콘텐츠가 같은 게시판 48을 받아 중복이다
원인: health.json 의 연속 실패 장부·알림이 장학 게시판만 센다. 활동·재단 출처는 리포트 한 줄로만 남는다
수리안: 404 두 곳은 주소를 고치거나 activity-sources.json parked 로 옮긴다. 온통청년 게시판 48은 API 와 겹치니 parked 로 옮긴다. 🟡 곳은 run-probe.txt checkUrl 로 정찰해 규칙을 붙이거나 보관할지 개발자가 정한다. 활동·재단 출처도 연속 실패 n회면 리포트 상단 '개발자에게 요청'에 올리는 장치를 health.json 과 같은 방식으로 붙인다
파일: collector/activity-sources.json, collector/external-sources.json, collector/collect.mjs, collector/health.json

--- [api-10] P3 (likely, code) 정식 재단 77곳 중 57곳은 게시판을 못 찾았고, 'fetch failed' 21곳은 원인을 적지 않는다
증상: 교외 확대(재단·지자체) 범위가 20곳에 머문다. 홈페이지를 못 연 21곳은 원인(이름·인증서·연결 시한)을 몰라 사람이 손을 못 댄다. 다음 재시도는 10-14 다
근거: external-sources.json probe.why 집계: '최고 0건 ((홈))' 29 · '홈페이지 못 엶 (fetch failed)' 21 · timeout 2 · HTTP 5. find-boards.mjs:102·136 은 e.message 만 적는다('fetch failed'). find-boards-report.md(10-04) '대상 0곳 중 이번에 0곳 · 게시판 아는 곳 20곳 / 전체 77곳'. 14일 규칙 RETRY_DAYS(find-boards.mjs:31·79)
원인: 재단 홈페이지 상당수는 메뉴가 스크립트로 그려지거나 http·옛 인증서다. 일반 fetch 로는 메뉴 링크를 못 본다. 실패 원인 코드(e.cause.code)를 기록하지 않는다
수리안: find-boards 도 open-api.mjs:71 처럼 e.cause.code 를 probe.why 에 남긴다. 'fetch failed' 곳 중 인증서(UNABLE_TO_VERIFY…)면 certs/ 묶음에 중간 인증서를 넣고, 스크립트 메뉴(최고 0건)는 자격요건 로봇과 같은 진짜 브라우저 정찰로 넘길지 개발자가 정한다
파일: collector/find-boards.mjs, collector/external-sources.json

--- [api-11] P3 (likely, code) 활동 파일 상한(200)이 foundAt 순으로 잘라 오래 열린 API 글이 밀려났다가 다음 날 '새 글'로 되돌아올 수 있다
증상: 지금은 184/200 이라 일어나지 않았다. 게시판 글이 늘어 상한에 닿으면, 오래 열린 청년정책(상시 등)이 수집 로봇의 상한에 잘린다. 다음 공공 API 실행에서는 지난 기록이 없으니 foundAt=오늘로 맨 위 '새 글'에 다시 올라온다. 60일 규칙에서 막은 깜빡임(리뷰 I3)이 상한에서 다시 생긴다
근거: collect.mjs:540-541 'acts.items.sort(… b.foundAt …); acts.items = acts.items.slice(0, ACT_CAP)' — API 글도 처음 본 날(foundAt)로 줄을 선다. open-api-map.mjs mergeApi 의 firstSeen 은 prev(파일에 남은 글)에서만 찾는다. data/activities.json 184건
원인: 60일 삭제에는 API 글을 seenAt 으로 재는 예외를 두었지만, 상한 자르기에는 같은 예외가 없다
수리안: 상한 자르기 정렬에 '(n.api && n.seenAt) || n.foundAt'(60일 규칙과 같은 값)을 쓰거나, API 글(최대 55건)을 상한 계산에서 따로 보장한다. 관문에 '상한에 닿아도 오늘 API 가 준 글은 안 잘린다'를 추가한다
파일: collector/collect.mjs

--- [api-12] P3 (guess, code) 1365 목록이 5쪽 상한(500행)에 닿아 그 뒤의 글을 못 볼 수 있다
증상: 1365 는 매번 '받은 행 500'으로, 정확히 5쪽×100 상한이다. 전체가 몇 건인지 적지 않아 뒤쪽에 대학생 글이 남았는지 모른다
근거: open-api-report.md: '1365 봉사참여정보 — 받은 행 500'(10-02·10-04 모두). open-api.mjs vol1365: for pageNo 1..5, numOfRows 100. totalCount 를 읽거나 리포트에 적지 않는다
원인: 쪽 상한을 고정값으로 두고 응답의 전체 건수를 보지 않는다
수리안: 응답의 <totalCount> 를 리포트에 적어 상한에 잘리는지 먼저 본다. 잘린다면 쪽 수를 늘리거나 정렬·기간 조건(최근 등록순)을 붙여 새 글이 앞쪽에 오게 한다
파일: collector/open-api.mjs

--- [api-13] P3 (confirmed, human-decision) 학교 대외활동 게시판(외대)은 robots.txt 를 묻고, 같은 학교의 장학·소식 게시판은 묻지 않는다 — 정책이 갈라져 있다
증상: 외대 학생활동·진로취업 게시판은 ⛔ 로 매번 건너뛴다. 같은 학교 사이트의 장학·소식 게시판은 robots 를 묻지 않고 읽는다
근거: collect.mjs:306-308 주석 '학교 게시판(role scholarship)은 지금까지처럼 읽는다' — 실제 조건은 (isAct || isExt) 라 학교 소속 활동 출처도 검사한다. robots.mjs 머리말 '학교 게시판은 계약 관계가 있어 지금까지처럼 읽고'. CLAUDE.md 교내 소식: '학교 게시판은 robots.txt 를 묻지 않는다(장학 수집기와 같은 정책)'
원인: robots 검사 조건을 '출처 역할'로 걸었다. '학교 사이트인가'로 걸지 않았다
수리안: 개발자가 정한다. 학교 소속 활동 출처(school 칸이 있는 것)도 장학·소식과 같은 정책으로 둘지, 반대로 학교 사이트 전부 robots 를 존중할지 정하고 그 결정을 robots.mjs 머리말과 관문에 적는다
파일: collector/collect.mjs, collector/robots.mjs

NOTES: 요약: 공공 API 로봇은 지금 정상이다. 최신 예약 실행 https://github.com/seonju5543-web/hanggonggan/actions/runs/37157526699 에서 K-Startup·1365·청년콘텐츠·청년정책 넷 모두 ✅ 였고, data/activities.json 의 API 글 52건이 10-04 자로 갱신됐다. 이슈 #356 의 '온통청년 열쇠 없음'은 사람이 10-02 에 시크릿을 넣어 이미 풀렸다(로그 env 에 세 열쇠가 *** 로 찍힘 · 이후 ✅). 'fetch failed' 는 10-01·10-02 두 번, 공공데이터포털(apis.data.go.kr) 두 출처에만 함께 났다. 같은 시각 온통청년은 성공했다. 실패 실행의 단계 시간을 역산하면 시도당 약 10초로, Node fetch 의 연결 시한(10초)과 맞는다. 그래서 '연결이 맺어지지 않은 간헐 장애'로 추정한다(DNS·인증서·상시 지역 차단은 시간·간헐성과 맞지 않는다). 확정은 다음 실패의 원인 코드(ac930fb7 부터 기록)로 한다.

관찰(결함 아님): ① 예약이 3~4시간 늦게 뜬다(19:17 UTC 예약 → 실제 22:10~23:14 UTC). 수집 로봇·브라우저 수집도 2~3시간 늦게 뜬다. 같은 대기줄 'collector' 에서 실제로 취소된 실행은 최근 목록에 없다. ② 대외활동·재단 '새 글 0건'이 10-02 밤부터 5회 연속인데, 모두 금요일 밤~일요일 실행이라 정상일 가능성이 크다. 월요일 실행에서도 0이면 다시 본다. ③ K-Startup 은 마감 가까운 순으로 15건을 고르므로 오늘·내일 마감 글이 자리를 먼저 차지한다(설계상 선택 · 개발자 판단 거리).

다른 묶음으로 넘길 것: api-02(test-collector 의 실데이터 전수 검사가 HEAD 에서 실패 → 수집 로봇 자동 등록 8건이 10-04 01:57 실행에서 되돌려졌고, 고치기 전까지 매 실행 되돌린다). 일회용 worktree 에서 a31a8538·ca94c76e 두 곳에서 재현했고 worktree 는 지웠다. 오케스트레이터의 '전부 통과'는 b71da694 기준이라 그 뒤 데이터 변화를 못 본 것이다. 앱 화면 검사 빨간불 이슈 #389·#390 도 같은 원인일 수 있으나 확인하지 않았다.

만든 임시 파일: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/api/robots-test.mjs · ext-dl.mjs · tc-a31.log · tc-head.log. 본 checkout 은 건드리지 않았다(git fetch 로 원격 참조만 갱신 · 작업 트리 깨끗함).


######## GROUP refresh
INVENTORY: .github/workflows/kosaf-fetch.yml (한국장학재단 수확 로봇)=degraded; collector/kosaf-fetch.mjs=healthy; collector/kosaf-attach.mjs=degraded; collector/kosaf-open.mjs=healthy; collector/kosaf-check.mjs=healthy; collector/kosaf-session.mjs=healthy; collector/kosaf-empty.mjs=healthy; collector/kosaf-detail-loss.mjs=healthy; collector/kosaf-block.json=healthy; data/kosaf-open.json=healthy; data/kosaf-files/=healthy; .github/workflows/refresh-majors.yml (학과 목록 갱신)=unknown; collector/majors.mjs=unknown; collector/publish-majors.mjs=healthy; data/majors/=degraded; .github/workflows/refresh-tuition.yml (대학별·계열별 등록금 갱신)=unknown; collector/fetch-tuition.mjs=healthy; collector/fetch-tuition-field.mjs=unknown; data/tuition.json=healthy; .github/workflows/search-index.yml (검색용 요약 만들기)=healthy; collector/build-search-index.mjs=healthy; collector/run-search-index.txt=healthy; .github/workflows/essay-playbook.yml (작성 규칙 학습)=degraded; collector/essay-playbook-learn.mjs=healthy; collector/essay-house-mine.mjs=healthy; collector/essay-rule-line.mjs=healthy; .github/workflows/gate-photos.yml (정문 사진 수집)=healthy; tools/fetch-gate-photos.mjs=degraded; tools/run-gate-photos.txt=healthy; tools/build-school-photos.mjs=healthy; .github/workflows/two-school-scan.yml (두 학교 전수 조사 · 일회용)=retired; collector/scan-two-schools.mjs · classify-two-schools.mjs=retired

--- [KOSAF-01] P2 (confirmed, code) 한국장학재단 첨부 사본이 매 실행 전부 다시 받아진다 — '이미 받았다' 판정이 죽어 있고 40MB 상한에 다가간다
증상: 수확(full) 실행마다 첨부 리포트가 '이미 있던 곳 0곳'이고 열린 재단 공고문 67~79개(21~34MB)를 통째로 다시 받는다. 같은 파일을 상품 코드마다 또 받는다(광주남구 890KB×5, 순천 1MB×5, 춘천 434KB×7). 09-17 실행은 34,241KB 로 한 실행 상한 40MB(MAX_RUN)의 86%였다. 상한을 넘으면 매번 앞에서부터 다시 받으므로 목록 뒤쪽의 새 재단은 영영 사본을 못 받는다(학생 화면에 공고문 없음).
근거: collector/kosaf-attach-report.md 이력: e6981a30(09-14) '새로 69개(33424KB) · 이미 있던 곳 0', 1358c133(09-17) '73개(34241KB) · 0', 2467ccfb(09-30) '79개(28858KB) · 0', 10-02 run 36945129700 '새로 67개(21508KB) · 이미 있던 곳 0'. 반면 attach 모드(수확 생략) 실행 6492bd27 은 '이미 있던 것 70곳'. 09-30 과 10-02 의 data/kosaf.json 을 비교하면 mirror 가 있는 64곳 전부 mirror.from 이 다르다 — 예: filename=…_2026091617231400.hwpx 는 같고 '&encVal=ce068c…' → '&encVal=9008d0…' 만 바뀜. 판정 코드 collector/kosaf-attach.mjs:117-118 `const now = (it.files||[]).map(f=>f.url||'')…join('|'); return !now || now === (m.from||'')` 와 134행 keep() 의 from 이 encVal 을 포함한 전체 주소. MAX_RUN 은 51행 `40 << 20`.
원인: KOSAF 첨부 주소의 encVal 값이 세션(실행)마다 새로 발급되는데, '같은 공고문인가'를 주소 문자열 전체로 비교한다. 수확 단계가 상세를 새로 받으면 주소가 늘 달라 보여 mirrorAlive 가 항상 false 가 된다. 그래서 kosaf-fetch.mjs 의 '받아 둔 사본(mirror)은 이어받는다' 장치와 attach 의 '이미 받은 것은 다시 안 받습니다' 문구가 실제로는 동작하지 않는다.
수리안: 비교 열쇠에서 encVal 을 뺀다 — 주소의 filename(또는 FileNameDn) 칸만 정렬해 이어 붙인 것을 mirror.from 과 mirrorAlive 양쪽에 쓴다(한 함수로). 같은 실행 안에서는 filename 이 같은 파일을 한 번만 받고 다른 상품 코드에는 복사(또는 같은 경로 공유)한다. 관문(test-collector 「층2 첨부」)에 'encVal 만 다른 주소 → 이미 받음' red-green 사례를 넣는다.
파일: collector/kosaf-attach.mjs, collector/kosaf-fetch.mjs, collector/kosaf-session.mjs

--- [KOSAF-02] P2 (likely, code) 한국장학재단 수확 단계가 상한 20분 중 17분을 쓴다 — 예산 시계가 목록 받기 시간을 빼고 잰다
증상: 수확 단계가 매번 약 17분 걸린다(상한 20분). 재단 서버가 조금만 느려도 단계 시한초과 → 이후 단계(사본·관문·저장)가 건너뛰어져 그날 수확분 전체가 버려진다(저장 단계에 always() 가 없다 — 의도된 설계지만 시한초과에도 똑같이 버려진다).
근거: run 36945129700 로그: 00:16:28 단계 시작 → 00:18:28 '목록 확보: 1847건'(185쪽, 약 2분) → 00:33:28 '⏱ 예산을 다 써 365건은 다음 실행으로' → 단계 종료 00:33:28(17분 0초). run 36073387957 도 16분51초. kosaf-fetch.yml:75-76 `timeout-minutes: 20` · `--budget-min=15`. collector/kosaf-fetch.mjs:123 `const budget = makeBudget(...)` 가 58~70행 목록 쪽 넘김 뒤에 만들어진다. 상세 요청 한 건은 tryFetch 30초×3회+대기 15초로 최대 약 105초까지 늘 수 있다(kosaf-session.mjs:42-52). 또 15분 대부분을 마감 지난 재단 상세 재수집에 쓴다('상세 새로 1482건' 중 열린 재단은 91곳).
원인: 예산(15분)이 목록 받기(약 2분, 서버 속도에 비례)와 마지막 요청의 재시도 꼬리를 포함하지 않아 단계 상한과의 여유가 3분뿐이다. 목록 185쪽을 받는 시간이 서버 상태에 따라 늘면 바로 상한에 닿는다.
수리안: makeBudget 을 프로세스 시작 시점(S.open 앞)으로 옮겨 목록 시간까지 15분에 넣거나, 예산을 13분으로 줄인다. 함께 열린 재단(마감 전·마감 빈칸)과 상세가 없는 재단만 매번 받고, 이미 상세가 있는 마감 지난 재단은 며칠에 한 번(또는 남는 예산에서만) 받게 하면 단계가 5분 안팎으로 준다. 관문: 'step timeout > budget + 목록 상한 + 마지막 요청 꼬리'를 test-collector 에서 수로 대조(일반 수집 예산 관문과 같은 방식).
파일: collector/kosaf-fetch.mjs, .github/workflows/kosaf-fetch.yml

--- [MAJORS-01] P2 (confirmed, code) 44개 수집교 중 연세대학교 미래캠퍼스에 학과 파일이 없다 — 학과 추천이 전국 공통 목록으로 조용히 물러난다
증상: 연세대 미래캠퍼스 학생이 온보딩에서 학과를 치면 그 학교에 실제로 있는 학과 대신 전국 공통 목록이 뜬다(2026-08-02 '경희대에 일어일문학과' 사고와 같은 유형). 학교가 정해질 때 data/majors/n1if6uwu.json 을 받으려다 404 가 나고 MAJORS_COMMON 으로 물러난다.
근거: node 로 SERVED_SCHOOLS(44곳) 각각 majorsFileFor 파일 존재 확인 → 'missing 1 연세대학교 미래캠퍼스 -> data/majors/n1if6uwu.json'. data/majors.json bySchool 에 '연세대학교 미래캠퍼스' 없음(고려대 세종 69 · ERICA 84 · 글로컬 117 · WISE 109 는 있음), '연세대학교' 119개 목록에 미래캠 특유 학과(작업치료·물리치료·임상병리·방사선·치위생) 없음. app.js:1019-1020 `const own = MAJORS_BY_SCHOOL[...] || MAJORS_BY_SCHOOL[school]; const pool = own || MAJORS_COMMON;`. data/majors.json 은 2026-08-05 개발자 맥북 수확(15c9cbc)이 마지막이고 refresh-majors.yml 은 Actions 에서 한 번도 수확하지 않았다(6회 전부 09-30 워크플로 파일 거절 push 잡음). test-collector 의 학과 관문은 KAIST·한국외대만 잰다(6275·6314행) — '서비스 학교 전부 파일이 있다'는 검사가 없어 이 빈자리가 초록불이다.
원인: 원인 확인 안 됨. 커리어넷이 미래캠퍼스를 BRANCH_MAP(collector/majors.mjs:49-60)에 없는 표기(예: 괄호·'원주' 표기)로 주면 normalizeSchool 이 본교로 합치거나 inApp 필터에서 버린다 — 이 가능성이 높지만 원본 API 응답을 보지 못했다(샌드박스 차단 · Actions 실행 0회).
수리안: ① refresh-majors 를 한 번 수동 실행하되 majors.mjs 가 '연세'가 들어간 커리어넷 schoolName 원문을 리포트에 찍게 해 표기를 확인한 뒤 BRANCH_MAP 에 추가(지어내지 말고 원문 표기로). ② test-collector 학과 관문에 'SERVED_SCHOOLS 전부 majorsFileFor 파일이 있다'를 추가(지금 상태에서 빨간불이 나야 함 — red-green). ③ CAREERNET_API_KEY 시크릿이 저장소에 있는지 사람이 확인.
파일: collector/majors.mjs, data/majors/, verify/test-collector.mjs, app.js

--- [QUEUE-01] P2 (likely, workflow-yaml) 학과·등록금 갱신이 수집 로봇·관리자 버튼과 같은 대기줄(collector)을 쓴다 — 최대 55분 동안 뒤 대기 실행이 서로 취소된다
증상: 등록금 갱신(작업 상한 55분, 계열 단계 약 25분)이나 학과 갱신을 누르면 그동안 collector 대기줄이 막힌다. 그 사이 예약 수집(collect-scholarships·browser-collect·open-api)과 관리자 버튼(admin-apply)이 대기에 서는데 GitHub 은 한 대기줄에 대기 실행을 하나만 남기고 앞의 대기분을 취소한다 → 관리자 수정 버튼이나 예약 수집 한 회차가 조용히 사라질 수 있다.
근거: refresh-majors.yml:15 · refresh-tuition.yml:16 `group: collector`(cancel-in-progress: false). 같은 줄: admin-apply.yml:36 · browser-collect.yml:19 · collect-scholarships.yml:25 · open-api.yml:32. refresh-tuition.yml:23 `timeout-minutes: 55`, 44행 계열 단계 45분. CLAUDE.md 로봇·워크플로 절 '대기줄(concurrency)을 하나로 합치지 말 것(대기 실행이 취소된다)'. 아직 실제 피해 기록은 없다(두 워크플로 모두 09-30 이후 실행 0회). 덧붙여 두 워크플로는 `ref: ${{ github.ref_name }}` 로 체크아웃한 뒤 `git pull --rebase origin claude/nice-heisenberg-WESq5 && git push origin HEAD:claude/nice-heisenberg-WESq5`(refresh-majors.yml:49, refresh-tuition.yml:55) 라 작업 브랜치에서 누르면 그 브랜치 기준으로 돌다 실패하거나 엉뚱한 커밋을 기본 브랜치로 옮길 수 있다(얕은 체크아웃이라 대개 충돌로 실패할 것으로 보이나 확인 안 함).
원인: 2026-09-30 '옛 커밋에서 시작하지 않는다' 수리 때 collector 대기줄 워크플로에 ref_name 을 일괄 적용하면서, 데이터 파일이 겹치지 않는 수동 갱신 로봇 둘도 그 대기줄에 남겨 두었다. 이 둘은 다른 로봇과 같은 파일을 쓰지 않아 같은 줄에 설 이유가 없다.
수리안: 두 워크플로에 각자 대기줄(group: refresh-majors / refresh-tuition)을 준다(저장 push 는 이미 pull --rebase 재시도가 있다). 체크아웃은 기본 브랜치로 고정하거나 `if: github.ref_name == 'claude/nice-heisenberg-WESq5'` 로 다른 브랜치에서 누르면 멈추게 한다. test-collector 「로봇 대기줄」 절은 collector 줄만 보므로 그대로 통과한다.
파일: .github/workflows/refresh-majors.yml, .github/workflows/refresh-tuition.yml

--- [ESSAY-01] P2 (confirmed, workflow-yaml) 작성 규칙 학습 로봇이 매번 새 이슈를 열고 닫지 않는다 — 열린 리포트 이슈 13개
증상: essay-playbook 라벨 열린 이슈가 13개 쌓였다(#192~#342). 08-24 의 🚨 실패 이슈 #194 도 그대로 열려 있어, 지금 실패 중인지 지난 일인지 이슈 목록만으로 알 수 없다.
근거: list_issues label=essay-playbook: OPEN #342(10-01) #305 #284 #241 #237 #236 #226 #200 #199 #198 #195 #194(🚨 08-24) #192 · CLOSED #317 만(사람이 닫음). essay-playbook.yml:119-128 결과 리포트 단계는 `github.rest.issues.create` 만 하고 이전 이슈를 닫거나 코멘트로 잇는 코드가 없다.
원인: 리포트를 매 실행 새 이슈로 만들고(설계상 '바뀐 게 있을 때만'), 성공 실행이 이전 리포트·실패 이슈를 정리하는 단계가 없다.
수리안: 새 리포트를 열기 전 같은 라벨의 열린 📘 이슈를 닫고(또는 고정 이슈 하나에 코멘트), 성공한 실행이면 열린 🚨 이슈도 닫는다. 지금 쌓인 12개는 사람이 정리(#342 만 남김).
파일: .github/workflows/essay-playbook.yml

--- [ESSAY-02] P2 (confirmed, workflow-yaml) 작성 규칙 학습 예약 실행이 시간초과로 취소되면 아무 알림도 없다
증상: 예약(월요일) 실행이 15분 상한에 걸려 '취소'로 끝나면 이슈가 안 열리고 로그에 ::error 한 줄만 남는다 — 아무도 모른 채 그 주 학습이 빠진다.
근거: essay-playbook.yml:120 `if: always() && (github.event_name == 'workflow_dispatch' || failure() || steps.save.outputs.changed == '1')` — 예약 실행이 취소되면 failure() 는 거짓이라 이슈를 안 연다. 139-140 '실패·취소 알림' 단계는 `if: failure() || cancelled()` 이지만 내용이 `echo "::error::..."` 뿐. 실제 취소 사례는 아직 없다(최근 실행 1분 안팎).
원인: CLAUDE.md 의 '실패 알림은 if: failure() || cancelled()' 규칙을 조건에는 적었지만 알림 단계가 사람에게 닿는 수단(이슈·robot-down 액션)이 아니다.
수리안: 리포트 이슈 조건에 `|| cancelled()` 를 더하거나 search-index.yml 처럼 `./.github/actions/robot-down` 을 실패·취소 단계에서 부른다.
파일: .github/workflows/essay-playbook.yml

--- [GATE-01] P3 (confirmed, code) 정문 사진 3차 출처 둘이 사실상 0건 — Openverse 는 전부 401, 위키데이터 분류 조회는 주소가 너무 길어 414
증상: 10-03 실행에서 Openverse 후보가 9개교 모두 0건, 강원대는 위키데이터 분류(61장)를 통째로 놓쳐 1장만 받았다. '사진이 없는 학교가 없도록'(10-03 지시) 넣은 출처가 기대만큼 일하지 않는다. 고려대 세종캠퍼스는 여전히 0장.
근거: run 37146558541 로그: '! 연세대학교 미래캠퍼스 Openverse: 401 https://api.openverse.org/v1/images/?q=...' 같은 줄이 9개교 전부. '! 강원대학교 위키데이터: api 414 https://commons.wikimedia.org/w/api.php?...titles=File%3AKangwonUniv+Mirae.jpg%7C...'(제목 40개 묶음). '⚠️ 사진이 한 장도 없는 학교 1곳 — 고려대학교 세종캠퍼스'. 코드 tools/fetch-gate-photos.mjs:176-177 `for (let i = 0; i < titles.length; i += 40) ... titles.slice(i, i + 40).join('|')` (GET), 207행 Openverse 익명 GET. 분류에서 온 후보 중엔 정문·건물이 아닌 사진도 많다(국민대 '두부1·경상댁1·치즈1' 등, 가톨릭대 'Footbridge Sapyeong-daero') — 사람이 고르므로 해는 없으나 잡음.
원인: ① 한글 파일 제목 40개를 URL 인코딩해 한 GET 주소에 넣으면 위키미디어 주소 길이 한도를 넘는다(로그의 414). ② Openverse 401 의 원인은 확인 못 함 — 익명 요청 거절(인증 필요) 또는 GitHub Actions IP 차단 가능성. 샌드박스에서는 api.openverse.org 자체가 막혀 재현 불가.
수리안: commonsFiles 를 주소 길이 기준(예: 6,000자)으로 잘라 묶거나 POST 로 보낸다. Openverse 는 인증 열쇠(OAuth client)를 시크릿으로 받아 쓰거나, 쓰지 않을 거면 sources 에서 빼고 '401 이면 출처가 꺼져 있다'고 한 줄로 알린다. 고려대 세종은 사람이 직접 고르거나 '사진 없음' 그대로(가짜 사진 금지).
파일: tools/fetch-gate-photos.mjs, tools/run-gate-photos.txt

--- [GATE-02] P3 (likely, code) 정문 사진 파일 이름이 후보 순번이라, 같은 학교를 다시 받으면 '고른 기록'이 다른 사진을 가리킨다
증상: school-photo-picks.json(24개교)과 manifest.picks(시작 화면 14장)는 'nmljo8t-4.jpg' 처럼 순번 파일 이름으로 고른 사진을 가리킨다. 그 학교를 FRESH=1 로 다시 받으면 후보 순서가 바뀌어 같은 이름이 다른 사진이 되고, 다음 build-school-photos 실행 때 사람·번호판을 덜어 내려고 적은 자를 자리(crop)·설명이 엉뚱한 사진에 적용된다. 지금은 피해 없음 — 10-03 에 다시 받은 9개교에는 고른 기록이 없었다.
근거: tools/fetch-gate-photos.mjs:275 `const file = `${s.id}-${i + 1}.${ext}`;` · 240행 FRESH=1 이면 그 학교 jpg 를 먼저 지움 · 245행 picks/pruned 는 이어 붙이기만 하고 파일 내용 대조는 없음. picks 항목 칸은 file·focusSquare·what·by 뿐(원본 제목·해시 없음). 10-03 재수집 9곳(n1if6uwu 등)과 picks 파일 이름 대조 결과 겹침 0.
원인: 파일 이름이 내용(위키미디어 제목·바이트)이 아니라 이번 실행의 후보 순서에서 나온다.
수리안: 파일 이름을 위키미디어 제목 해시로 바꾸거나, picks 에 원본 title 을 함께 적고 build-school-photos 가 manifest 의 title 과 대조해 다르면 멈추게 한다. 최소한 fetch-gate-photos 가 picks 에 있는 학교를 FRESH 로 지우려 하면 경고하고 멈춘다.
파일: tools/fetch-gate-photos.mjs, tools/build-school-photos.mjs, docs/designs/assets/gates/school-photo-picks.json

--- [MAJORS-02] P3 (confirmed, secret-or-external) 학과 갱신 로봇은 열쇠가 없으면 초록불로 '변경 없음'이 된다 — CAREERNET_API_KEY 존재 미확인
증상: refresh-majors 를 눌렀을 때 시크릿이 없으면 아무것도 안 받고 성공으로 끝나 '학과 목록을 갱신했다'고 착각하게 된다.
근거: collector/majors.mjs:30 `if (!KEY) { console.error('CAREERNET_API_KEY가 없습니다 — 아무것도 하지 않고 종료합니다.'); process.exit(0); }` → refresh-majors.yml 저장 단계 `git diff --cached --quiet && { echo "변경 없음"; exit 0; }`. Actions 에서 이 워크플로가 수확까지 간 실행은 0회라 시크릿 존재를 실행으로 확인한 적 없음. (등록금 쪽 DATA_GO_KR_KEY 는 open-api 리포트 '✅ K-Startup · ✅ 1365' 로 살아 있음 확인.) 학과 키는 2028-08-03 만료(커밋 15c9cbc).
원인: 로컬 실행 편의를 위해 열쇠 없음을 정상 종료로 처리했다 — CI 에서는 조용한 무력화가 된다(CLAUDE.md 매 세션 3번).
수리안: CI(GITHUB_ACTIONS=true)에서는 열쇠가 없으면 exit 1 + ::error. 사람이 Settings › Secrets 에서 CAREERNET_API_KEY 존재를 확인.
파일: collector/majors.mjs, .github/workflows/refresh-majors.yml

--- [TUITION-01] P3 (confirmed, human-decision) 계열별 등록금 단계는 Actions 에서 한 번도 돈 적이 없다 · 실패 알림도 없다
증상: data/tuition.json 의 byField(학교×계열)는 개발자 맥북에서 만든 것이고, 워크플로의 '계열별 등록금 수확'(약 25분, 상한 45분)은 실행으로 증명된 적이 없다. 다음 공시(연 1회) 때 처음 돌게 되는데 실패해도 이슈 알림이 없다.
근거: refresh-tuition 성공 실행 2회는 08-27 08:31·08:33(33054402176·33054553008), 각 약 20초 — 계열 단계가 생기기 전. byField 는 fieldUpdatedAt '2026-08-27T09:22:54Z' · 커밋 d25852c(작성자 조세현, 맥북). 워크플로에 if: failure() || cancelled() 알림 단계 없음. 현재 데이터는 서비스 44곳 전부 avg·byField 보유라 지금 화면 영향 없음.
원인: 연 1회 수동 도구라 시운전 없이 단계만 붙였다.
수리안: 다음 등록금 공시 전에 사람이 한 번 시운전(collector 대기줄 문제 QUEUE-01 을 먼저 고친 뒤). 실패·취소 알림 단계(robot-down 액션) 추가.
파일: .github/workflows/refresh-tuition.yml, collector/fetch-tuition-field.mjs

--- [ESSAY-03] P3 (confirmed, human-decision) 작성 규칙 학습 — 시든 출처 2곳이 5회째 사람 확인 대기
증상: 인크루트 뉴스 두 글이 5회 연속 규칙 0종인데 자동 삭제를 안 하는 설계라 매주 다시 읽힌다.
근거: #342 '🩺 seed 건강 … 시든 seed — 3회 연속 규칙 0종 … (5회) https://news.incruit.com/news/newsview.asp?newsno=436538 · (5회) …newsno=436729'.
원인: 설계상 seed 삭제는 사람이 한다(자동 삭제 안 함).
수리안: 개발자가 확인 후 collector/essay-sources.json 에서 두 seed 를 뺀다.
파일: collector/essay-sources.json

--- [TWO-01] P3 (confirmed, human-decision) 일회용 '두 학교 전수 조사' 워크플로가 남아 있다
증상: 09-03 이후 쓰이지 않는 워크플로가 Actions 목록에 남아 있고, 오래된 작업 브랜치(claude/external-expert-consultation-questions-o8bik7)를 체크아웃하도록 박혀 있다.
근거: two-school-scan 실행 3회(09-02~09-03, 마지막 33712780669) 이후 0회. 예약 없음. 결과 collector/extracted/two-school/REPORT.md·scan.json 이 이미 기본 브랜치에 있다. 대상 브랜치는 아직 존재(git ls-remote d0da898). test-collector:9048-9064 가 '일회용 로봇'으로 감시 목록에서 일부러 뺐다.
원인: 일회용 조사 도구를 끝난 뒤 정리하지 않았다.
수리안: 개발자 결정: 지우거나(결과물은 남김) 그대로 둔다. 지운다면 test-collector 의 예외 목록(two-school-scan.yml)도 같이 정리.
파일: .github/workflows/two-school-scan.yml, collector/scan-two-schools.mjs, collector/classify-two-schools.mjs

--- [FIXED-01] P2 (confirmed, none-already-fixed) (이미 수리) 09-30 워크플로 파일 중복 with: — 작성 규칙 학습·학과·등록금 워크플로가 GitHub 에 거절됐다
증상: 09-30 00:56~01:41 push 마다 essay-playbook·refresh-majors·refresh-tuition 이 '작업 0개 failure' 실행을 6개씩 남겼다(그 시간 동안 세 워크플로는 실행 불가 상태).
근거: 예: essay-playbook 36655322788 · refresh-majors 36655320392 · refresh-tuition 36655321857 — list_workflow_jobs total_count 0. 27f38160 판 essay-playbook.yml 에 checkout 단계 with: 가 두 번(`ref: ${{ github.ref_name }}` 와 `ref: 'claude/nice-heisenberg-WESq5'`). 지금 HEAD 에서는 중복 제거됨(직접 중복 키 검사 통과) · test-collector 「로봇 대기줄」에 '어느 단계에도 with: 가 둘 이상 없다' 관문 추가. 수리 뒤 essay-playbook 10-01 dispatch 성공(36820808592).
원인: 대기줄 수리 때 ref 줄을 더하면서 기존 with: 블록을 지우지 않았다.
수리안: 없음 — 수리·관문 완료. refresh-majors·refresh-tuition 은 수리 뒤 실행이 없어 실행으로는 아직 증명 안 됨.
파일: .github/workflows/essay-playbook.yml, .github/workflows/refresh-majors.yml, .github/workflows/refresh-tuition.yml
이미수리: 관문 test-collector 「로봇 대기줄 — 옛 커밋에서 시작하지 않는다」 dupWith 검사 + 워크플로 수정(HEAD 반영) · 10-01 essay-playbook 성공

--- [FIXED-02] P1 (confirmed, none-already-fixed) (이미 수리) 한국장학재단 관문이 '목록에서 내려간 재단'을 '상세 유실'로 읽어 세 번 연속 저장을 막았다(#227)
증상: 09-22·09-25·09-29 예약 실행이 관문에서 실패해 층2가 13일간 갱신되지 않았다.
근거: run 36504001395 로그 '✕ 실패 1건 — 저장하지 않습니다'. 수리 커밋 ccf29411(kosaf-detail-loss.mjs, 재단 코드로 대조). 이후 09-30 dispatch 36663155157 성공 · 10-02 예약 36945129700 성공('목록에 남은 재단의 상세를 잃지 않았다 (지난 1647건 → 지금 1650건)'). 이슈 #227 09-30 닫힘.
원인: 상세 개수만 비교해 목록에서 빠진 재단 2곳을 유실로 셌다.
수리안: 없음. (참고: 실패 이슈가 성공 실행에서 자동으로 닫히지 않아 사람이 닫았다 — 자동 닫기 단계를 두면 좋다.)
파일: collector/kosaf-check.mjs, collector/kosaf-detail-loss.mjs
이미수리: ccf29411 + 09-30·10-02 성공 실행

--- [FIXED-03] P2 (confirmed, none-already-fixed) (이미 수리) 작성 규칙 학습 09-29 예약 실행이 새 양식 칸 종류 미분류로 멈췄다(#317)
증상: 9/29 예약 실행이 학습 전 검사 verify-essay-ask 'generic 0' 에서 실패.
근거: run 36503460813 failure · 수리 커밋 2b4d99a('환경 요인과 본인의 노력' 칸을 growth 로) · 10-01 dispatch 36820808592 success · 지금 로컬 verify-essay-ask 117/0 통과. #317 10-01 닫힘.
원인: 자동 스키마화로 들어온 새 서술형 칸이 ESSAY_KINDS 어느 갈래에도 안 걸렸다. 같은 유형은 양식이 늘 때마다 재발할 수 있다(학습 로봇이 앱 검사에 묶여 있음).
수리안: 없음. 다음 예약(10-05 20:37 UTC)에서 재확인.
파일: essay-ask.js, verify/verify-essay-ask.mjs
이미수리: 2b4d99a + 10-01 성공 실행

--- [FIXED-04] P3 (confirmed, none-already-fixed) (이미 수리) 정문 사진 로봇이 다른 로봇과 동시에 저장하다 push 거절로 115장을 버렸다
증상: 10-01 실행이 사진을 받고도 'fetch first' 로 push 실패.
근거: run 36848598024 failure(10-01). 재시도 루프 추가(f8961035, 10-03). 10-03 run 37146558541 로그 '! [rejected] … (fetch first)' → 'Successfully rebased' → 'f94d94b5..56a2f5a7' 저장 성공 — 재시도 경로가 실제로 동작함을 확인.
원인: push 실패 시 받아서 다시 올리는 단계가 없었다.
수리안: 없음.
파일: .github/workflows/gate-photos.yml
이미수리: f8961035 + 10-03 성공 실행

NOTES: 진단만 수행했다(파일 수정·실행 트리거·이슈 조작 없음, 워크트리 사용 안 함 — 로봇 재현이 필요 없었다). 저장소가 얕은 클론(161커밋)이라 오래된 이력은 GitHub list_commits 로 확인했다.

요약
- 지금 학생 화면을 틀리게 하는 것은 MAJORS-01 하나: 연세대 미래캠퍼스(수집 44곳 중 하나)는 학과 파일이 없어 학과 추천이 전국 공통 목록으로 물러난다. 원인(커리어넷 표기)은 확인 못 함.
- 한국장학재단 로봇은 돌고 있고 데이터도 10-02 기준 최신이다(91곳 · 사본 62개). 다만 사본 '이미 받음' 판정이 encVal 때문에 늘 꺼져 있어 매번 전량을 다시 받고(KOSAF-01 · 40MB 상한의 86%까지 갔었다), 수확 단계는 상한 20분에 17분을 쓴다(KOSAF-02). 둘 다 다음 학기 초처럼 열린 재단이 늘면 실제로 터질 수 있다.
- 학과·등록금 갱신은 dispatch 전용이며 Actions 에서 수확까지 간 실행이 사실상 없다(학과 0회 · 등록금 계열 단계 0회). 두 워크플로가 수집·관리자 버튼과 같은 collector 대기줄에 있어, 누르면 최대 55분 동안 뒤 대기 실행을 취소시킬 수 있다(QUEUE-01).
- search-index 는 건강하다(최근 30회 성공 · 원문이 있는 92/92건 색인). 빠진 60건은 원문 본문이 없어서인데, 이건 상류(rescue-bodies) 문제다.
- 작성 규칙 학습은 10-01 성공. 남은 것은 이슈 소음(열린 13개)과 취소 시 알림 공백.
- 정문 사진: push 재시도는 실제로 동작함을 확인. 새 출처 둘(Openverse 401 9/9 · 위키데이터 414)은 사실상 0건이다.
- two-school-scan 은 일회용으로 끝났다(retired) — 지울지는 개발자가 정한다.

확인 못 한 것(규칙 5): Openverse 401 의 정확한 원인, 커리어넷의 미래캠퍼스 표기, CAREERNET_API_KEY 시크릿 존재 여부, 작업 브랜치에서 dispatch 했을 때 refresh 두 로봇의 실제 동작. 예약 실행이 매번 2.7~3.7시간 늦게 시작하는 것(kosaf 20:53 → 23:34~00:37, essay 20:37 → 00:30)은 GitHub 쪽 지연으로 보이며 고칠 대상은 아니다. 참고로 이 그룹 워크플로들은 아직 node-version 20(2026-04 지원 종료)을 쓰고 있어 정리 대상이다.


######## GROUP ops
INVENTORY: deploy-sync.yml (배포 동기화 기본→main)=healthy; main-guard.yml (main 직접 수정 되가져오기)=healthy; device-deploy.yml (이 기기에서 배포)=degraded; check-live.yml (실제 앱 반영 확인)=degraded; robot-heartbeat.yml + collector/robot-heartbeat.mjs=healthy; close-old-reports.yml (오래된 수집 리포트 닫기)=degraded; update-progress.yml + tools/notion-status.mjs=degraded; admin-lock-check.yml (관리자 화면 잠금 확인)=healthy; verify-ui.yml (앱 화면 검사 — CI 관문)=broken; pages-build-deployment (dynamic)=healthy; verify/check-deploy-sync.js=degraded; verify/check-collab.js --brief=healthy; .github/actions/robot-down (공용 넘어짐 알림)=degraded; verify/verify-registered.js=broken

--- [ops-01] P1 (confirmed, code) CI 관문(verify-ui)이 기본 브랜치·main 모두 빨간불 — verify-registered.js 가 아직도 실데이터(마감 전 양식 공고)에 기댄다
증상: 10-04 03:55Z 이후 verify-ui 3회(run 420·421·422) 연속 실패, 이슈 #389·#390. 지난 100회 중 37회 실패. 10-03 에도 08:06Z~17:52Z 20회 연속 빨간불(#383, 코멘트 24)이었고, 수리 뒤 하루 만에 다시 빨개졌다.
근거: run 37175482635·37175886336 로그: 'explore total cards: 105 | SKKU registered visible: 0' → '대체 구동(마감 전 양식 공고): 없음 | 문서 생성: false' → 'ERRORS: 마감 전 양식 공고를 하나도 구동하지 못했습니다'. '없음'은 verify/verify-registered.js:40 `if (!ids.length) return { id: null, ok: false };` 에서만 나온다(후보 0개). 표본 주입은 :58 `if (ids.length && tried.every(… 신청 버튼 잠김))` 일 때만 돈다(c1ac018f, 10-03 17:53Z). 10-03 17:52Z run 37141949532 는 'reg-dongsan(신청 버튼 잠김)'이었다 → 그날은 표본으로 통과. app.js:331 `CLOSED_KEEP_DAYS = 1`, :1910 마감 다음 날까지만 탐색 목록에 남김 → reg-dongsan(마감 10-02)이 러너 시간(UTC) 10-04 부터 목록에서 빠짐. data/registered.json 의 formId 공고 19건 중 학교 제한 없는 것(reg-dongsan 10-02, auto-oardid322850 09-30, auto-ent2431264952 09-28, auto-9d20… 09-23, reg-sejong-didim 08-31, reg-khu-uiam 09-11, reg-hi-jeju·jeongeup 마감 없음·listedAt 07-16)은 모두 지났고, 마감 전인 것(auto-ent2431266737 10-30)은 한국외대 한정.
원인: 드라이버가 '성균관대 프로필 탐색 화면에 양식이 붙은 공고 카드가 적어도 하나 보인다'는 실데이터에 기댄다(CLAUDE.md '실데이터에 기댄 고정 검사를 관문에 두지 말 것' 위반이 남음). 10-03 수리는 '후보가 전부 잠김'만 덮었고 하루가 더 지나 '후보가 하나도 안 보임'이 되자 같은 자리에서 다시 넘어졌다.
수리안: 후보가 0개여도 표본을 심는다: registeredList 에서 formId 가 있고 FORM_TEMPLATES 에 양식이 있는 공고를 **보이든 안 보이든** 하나 골라 복사, eligibility 의 학교 범위(schoolOnly·schoolsAny·campusOnly)를 비우고 마감을 +20일로 바꿔 넣은 뒤 같은 driveOneForm 으로 몬다(실제 후보가 열려 있으면 지금처럼 실제 것을 먼저). red-green: 오늘 데이터로 수정 전 실패·수정 후 통과, 그리고 FORM_TEMPLATES 를 비운 픽스처에서는 여전히 실패하는지 확인.
파일: verify/verify-registered.js, app.js, data/registered.json

--- [ops-02] P2 (confirmed, workflow-yaml) verify-ui 한 드라이버가 넘어지면 뒤의 드라이버 22개와 값싼 관문 3개(말투·토큰·수집기 규칙 DOC_GATES·drive.js)가 통째로 건너뛰어진다
증상: 지금처럼 verify-registered.js 하나가 실패하면 CI 에서 verify-chat … verify-region-city(22개)와 ui-tone·test-collector(DOC_GATES=1)·drive.js 가 한 번도 안 돈다. 최근 100회 중 37회가 이 상태 — 그동안 CLAUDE.md 문서 관문·관리자 규칙 관문의 CI 확인이 꺼져 있었다.
근거: run 37175886336 단계: 15 '화면 검사 (관문)' failure → 16 '말투·토큰 관문' skipped · 17 '수집기·관리자 규칙 관문' skipped · 18 '전 여정 회귀 (drive.js)' skipped. verify-ui.yml:145 `set -e` 로 for 루프가 첫 실패에서 멈춤. verify-ui.yml:164~170·185~186 주석은 '맨 뒤에 두면 결과도 함께 보인다'고 적었지만 뒤 단계에 `if: ${{ !cancelled() }}` 가 없어 앞 단계 실패 시 GitHub 이 건너뛴다(주석이 말하는 보호는 ui-tone 자신이 실패할 때만 성립).
원인: 단계 실행 조건 누락(기본값 success())과 드라이버 루프의 set -e.
수리안: 말투·토큰·수집기 규칙·drive.js 단계에 `if: ${{ !cancelled() }}` 를 단다. 드라이버 루프는 set -e 대신 실패를 모아(fail=1; failed+=…) 끝까지 돌리고 마지막에 실패 목록을 찍고 exit 1. 경보 단계 조건은 failure() 그대로 두면 된다. 관문: test-collector 'CI 감시 범위' 절에 '뒤 단계에 !cancelled() 가 있다'를 추가하고 되돌려 빨간불 확인.
파일: .github/workflows/verify-ui.yml

--- [ops-03] P2 (confirmed, workflow-yaml) 이 기기에서 배포(device-deploy)로 나간 코드는 CI 관문(verify-ui·test-collector)을 한 번도 안 거친다
증상: 작업 브랜치 하나만 쓰는 세션이 device-deploy 로 앱에 내보내면 verify-ui 가 그 내용으로 돌지 않는다. 다음 사람이 main/기본 브랜치에 직접 push 할 때까지(10-02 사례: 약 12시간) 화면 검사 없이 학생에게 나가 있다.
근거: device-deploy run 145~148(10-02 19:36~20:16Z, claude/sweet-brown-td5a5o → 기본 → main, 예: 37059435990 '배포 — 소식 썸네일 켜기') 뒤 verify-ui 실행이 10-02T15:12Z 다음 10-03T08:06Z 까지 하나도 없다(gh api verify-ui runs created 범위 조회). device-deploy.yml 은 actions/checkout 기본 GITHUB_TOKEN 으로 push 하고, 워크플로 주석(15~19행)이 스스로 적었듯 '로봇이 올린 push 는 다른 워크플로를 깨우지 못한다'. 병합 때 검사는 device-deploy.yml:123 `node verify/audit-data.js` 하나뿐이고 test-collector 는 없다. 같은 이유로 deploy-sync 의 main push 도 verify-ui 를 깨우지 않는다(데이터만이라 영향 작음).
원인: GitHub 규칙(GITHUB_TOKEN push 는 push 트리거를 못 깨움)과, device-deploy 가 배포 전후로 화면·규칙 관문을 부르지 않는 설계.
수리안: device-deploy 의 병합 직후(기본 브랜치 push 전)에 `DOC_GATES=1 node verify/test-collector.mjs` 를 audit 와 함께 돌리고, 배포 성공 뒤 `gh workflow run verify-ui.yml --ref main`(workflow_dispatch 는 GITHUB_TOKEN 으로도 깨울 수 있음 · permissions 에 actions: write 추가)으로 화면 검사를 깨운다. 빨간 관문이 배포를 막을지(지금은 어떤 배포 길도 verify-ui 를 기다리지 않는다 — 10-04 06a34cc7·3cb8e936·86f42b84 는 verify-ui 빨간불인 채 main 에 나감)는 개발자가 정한다.
파일: .github/workflows/device-deploy.yml, .github/workflows/verify-ui.yml

--- [ops-04] P2 (confirmed, workflow-yaml) 실제 앱 반영 확인(check-live)이 배포 직후 경합으로 헛경보를 내고, 그 경보는 다음에 통과해도 닫히지 않으며 매번 새 이슈를 만든다
증상: #350 '🚨 앱 반영 점검 실패' 가 10-01 부터 열려 있지만 실제로는 해소됐다. 같은 꼴의 #384(10-03)·#310(09-25)은 사람이 몇 분 뒤 손으로 닫았다.
근거: run 36851872513(10-01 10:52Z 예약) 로그: 'last-modified: Thu, 01 Oct 2026 10:49:21 GMT' 인데 저장소 main 은 그 뒤 것 → '실시간 공고(옛) 288/287 ❌ · 정식 등록 144/136 ❌ · 공고(학교별) ntyl0r5.json 1/9 ❌' → 이슈 #350. 다음 예약 run 36995503117(10-02)·37114286104(10-03)는 '🚨 어긋남 알림' 단계 skipped(=bad 0, 통과). #384 는 device-deploy(10-03 11:06Z) 1분 뒤 수동 실행 37118628465 에서 났고 5분 뒤 재실행 37118916356 은 통과. check-live.yml:199~214 는 라벨·중복 확인·닫기 없이 `gh issue create` 만 한다(다른 감시 로봇 admin-lock-check·robot-heartbeat·verify-ui 는 라벨+자동 닫기를 한다).
원인: 점검이 Pages 빌드 완료를 기다리지 않고 main 체크아웃과 라이브를 바로 비교한다. 경보 이슈에 수명 관리(라벨·중복 방지·통과 시 닫기)가 없다.
수리안: ① 비교 전에 main HEAD SHA 의 pages-build-deployment 실행이 completed 인지 확인(최대 5분 대기)하거나, 어긋나면 3~5분 쉬고 한 번 더 받아 그래도 다를 때만 경보 ② 라벨(예: live-check)로 열린 이슈가 있으면 코멘트만 ③ bad=0 이면 열린 live-check 이슈를 닫는다(admin-lock-check 와 같은 방식). 지금 열린 #350 은 닫아도 된다.
파일: .github/workflows/check-live.yml

--- [ops-05] P2 (confirmed, workflow-yaml) check-live 가 앱이 실제로 받는 파일 9종을 대조하지 않는다 (CLAUDE.md '새 데이터 파일을 앱이 받게 하면 이 점검에도 넣는다' 위반)
증상: 대외활동 탭·재단 공고·층2(KOSAF)·등록금·검색 요약·양식 규칙·시작 화면 정문 사진 목록이 배포에서 빠지거나 404 여도 이 점검은 초록불이다.
근거: 앱의 fetch 대상: app.js `fetch('data/activities.json')`·`'data/external.json'`·`'data/kosaf-open.json'`·`'data/tuition.json'`·`'assets/gates/gates.json'`·`'terms.html'`, essay.js:54 `'data/essay-form-rules.json'`·essay.js `'data/essay-playbook.json'`, chat.js:212 `'data/search-index.json'`. check-live.yml:42~82 의 대조 목록(sw.js·app.js·notices·registered·forms·공고/소식 색인과 학교별·학과 2곳·소식 사진 3장·link-check·학교 사진)에 이 9개가 없다. 관문은 기능별 정규식만 있다(test-collector.mjs:2260 소식, :2524 소식 사진, :2612 학교 사진) — 앱 fetch 목록과 점검 목록을 맞대는 일반 관문은 없다. 덧붙여 색인 파일(data/notices/index.json·data/news/index.json)은 칸 수(4 대 4)로만 세어 404 외의 내용 차이는 못 본다(로그 '공고 색인 index.json 4 4'), 목록 파일도 건수만 같으면 주소·마감이 달라도 통과.
원인: 대조 목록을 기능이 생길 때마다 손으로 덧붙여 왔고, 09-25(activities)·09-26(external) 등 이후 추가분이 빠졌다.
수리안: check-live 의 EXTRA 를 앱 스크립트(index.html 이 싣는 *.js)의 `fetch('…')` 문자열 리터럴에서 뽑아 만든다(check-deploy-sync.js 가 index.html 을 읽는 것과 같은 방식) + test-collector 에 '앱이 fetch 하는 정적 파일 ⊆ check-live 대조 목록' 관문(되돌려 빨간불 확인). 비교는 건수 대신 바이트 수나 sha1 로(색인·목록 내용 변화도 잡게).
파일: .github/workflows/check-live.yml, verify/test-collector.mjs, app.js, essay.js, chat.js

--- [ops-06] P2 (confirmed, workflow-yaml) 오래된 리포트 닫기 로봇이 두 종류만 닫아 열린 이슈가 6일 만에 118 → 185 건으로 불었다
증상: 열린 이슈 185건. 진짜 경보(🚨)가 리포트 더미에 묻히는, 이 로봇을 만든 이유(2026-08-09 '102건에 경보가 묻혔다')가 되살아났다.
근거: close-old-reports.yml:61 `select(.title | test("^(🤖 장학공고 수집 리포트|🖥 브라우저형 수집 리포트)"))` 만 대상. 09-28 run 36435735406 로그 '닫음 8건 … 남은 열린 이슈: 118건'. 지금 열린 185건 분류(REST 집계): 🤖 장학공고 23·🖥 브라우저형 15(이 둘만 대상) / 대상 밖: 📸 인스타 카드 준비 34(09-12~) · ✅/🚨 자격요건 AI·자격 요건 채우기 32(08-23~09-17) · 🔧 링크 사냥꾼 못 찾음 25(07-31~) · 🗞 교내 소식 리포트 19(10-01~02, '새 글 0건' 리포트만 10-03 하루에 6건 #372~#377) · 📘 작성 규칙 학습 13(08-23~) · 🔍 공고 누락 감사 9(08-17~) · 🚨 본문 재수집 실패 4(09-04~) · 기타(#4 07-03 정찰 리포트, #70 07-28 알림 테스트, #232). `--limit 300` 도 머지않아 넘는다.
원인: 8월 이후 새로 생긴 로봇들(교내 소식·인스타·자격요건 AI·작성 규칙·누락 감사)이 각자 이슈를 만들지만 정리 규칙은 처음 두 종류에서 넓혀지지 않았다.
수리안: 종류별 보존 규칙 표로 바꾼다 — 예: 🗞 교내 소식 리포트·📘 작성 규칙 학습·✅ 자격요건 결과·🔍 누락 감사는 최신 N건 남기고 7~14일 지난 것 닫기, 🔧 링크 사냥꾼은 더 새 사냥꾼 이슈가 있으면 옛것 닫기(로봇이 계속 찾으므로), 📸 insta-ready 는 그 공고 마감이 지난 것만(인스타 그룹과 합의). 🚨 로 시작하는 것은 여전히 건드리지 않는다. 덧붙여 collect-news 가 '새 글 0건'에도 새 이슈를 여는 것은 그 그룹에서 코멘트로 바꾸는 게 맞다. --limit 을 페이지 넘김으로.
파일: .github/workflows/close-old-reports.yml, .github/workflows/collect-news.yml

--- [ops-07] P2 (confirmed, workflow-yaml) 해소된 경보 이슈가 스스로 닫히지 않는다 — device-deploy #274·robot-down #386 (check-live #350 은 ops-04)
증상: #274 '🚨 이 기기에서 배포 실패' 가 09-14 부터 열려 '배포 안 된 작업이 있다'처럼 보이지만 실제로는 다 나갔다. #386 '🚨 로봇이 넘어졌어요 — 원문 링크 복구 로봇' 도 22분 뒤 같은 로봇이 성공했는데 열려 있다.
근거: #274 코멘트 6개의 충돌 브랜치 4개를 GitHub compare(main...브랜치)로 재면 모두 ahead_by 0(admin-page-interface-redesign-ylgfrz behind 812 · handaejang-revenue-model-akd2gl behind 642 · job-posting-form-read-error-98ck8a behind 457 · sweet-brown-td5a5o 는 로컬에서도 main 에 포함). 마지막 코멘트 10-01 11:07 이후 device-deploy 100회 전부 success. device-deploy.yml:225~244 는 열거나 코멘트만 하고 닫는 단계가 없다. .github/actions/robot-down/action.yml:52~57 도 열거나 코멘트만 한다 — #386(10-03 17:36Z) 뒤 resolve-detail-urls 가 17:58Z 성공(그 커밋 '원문 링크 복구 — 목록 주소를 공고 원문 주소로 (8건)'이 deploy-sync run 37142455476 을 깨움).
원인: 알림 쪽에만 '라벨로 중복 방지'를 만들고, 성공 시 닫는 짝(admin-lock-check·robot-heartbeat·verify-ui 가 가진 것)을 두지 않았다.
수리안: robot-down 에 짝이 되는 '로봇이 다시 섰다' 단계(성공 시 같은 로봇 이름의 열린 robot-down 이슈를 닫음)를 공용 액션으로 만들어 이 액션을 쓰는 워크플로에 함께 건다. device-deploy 는 state 가 deployed/uptodate 일 때 열린 device-deploy 이슈의 코멘트에 적힌 브랜치들이 모두 main 에 들어갔는지(git merge-base --is-ancestor) 보고 닫는다. 지금 열린 #274·#386 은 닫아도 된다.
파일: .github/actions/robot-down/action.yml, .github/workflows/device-deploy.yml

--- [ops-08] P2 (confirmed, workflow-yaml) 화면 검사 경보가 같은 초에 두 번 열린다 (기본 브랜치·main 동시 실패의 경합)
증상: 빨간불 한 번에 이슈가 둘 생긴다 — 알림 메일도 두 통.
근거: #389(2026-10-04T03:57:53Z)·#390(03:57:54Z) = run 421(main)·420(기본) / #321(09-30T00:55:43Z)·#322(00:55:47Z). verify-ui.yml:252~259 는 '열린 ui-gate 이슈를 찾고 없으면 만든다'인데, 세 브랜치 push 관례로 두 실행이 같은 커밋을 동시에 돌다 같은 순간 실패하면 둘 다 '없음'을 보고 각자 만든다.
원인: 목록 조회 → 생성 사이의 경합(원자적이지 않음). concurrency 그룹이 ref 별(verify-ui-${{ github.ref }})이라 두 실행이 나란히 돈다.
수리안: 경보 생성은 한 브랜치(예: 기본 브랜치)에서만 하고 main 실행은 열린 이슈가 있을 때 코멘트만 하게 하거나, 생성 뒤 다시 조회해 번호가 더 큰 중복을 닫는다. 같은 패턴을 쓰는 robot-down·robot-heartbeat 에도 같은 처방.
파일: .github/workflows/verify-ui.yml

--- [ops-09] P2 (confirmed, code) check-deploy-sync.js 가 '작업본이 main 보다 뒤처진 것'을 '배포 안 된 변경'으로 잘못 알린다 (+ assets/ 를 안 본다)
증상: 세션 점검(session-check 스킬 2단계)과 '끝내기 전' 확인에서 거짓 ❌ 와 exit 1, 그리고 거절될 `git push origin HEAD:main` 을 권한다.
근거: 지금 실행: 작업본 ca94c76e, origin/main 3cb8e936 · `git log origin/main..HEAD` 0개 · `git log HEAD..origin/main` 3개(06a34cc7 데이터 관문 수리 등) → 출력 '❌ 아직 앱에 배포되지 않은 변경이 있습니다 … parse-requirements.js | 4 +---' exit=1. 원인 줄 verify/check-deploy-sync.js:99 `git diff --stat origin/main..HEAD` — 두 점 diff 는 '두 나무의 차이'라 방향을 모른다. 또 :81 APP_PATHS 고정 목록에 'assets' 가 없어 b444b603 처럼 assets/schools/*.webp 13장·photos.json(앱이 받는 학교 사진)과 assets/gates/gates.json 변경은 배포 누락이어도 못 잡는다.
원인: diff 범위 표기를 '내 쪽에만 있는 변경'(세 점·log)이 아닌 두 점으로 썼다. APP_PATHS 에 학교 사진 기능(10-03) 이후 앱 경로가 추가되지 않았다.
수리안: `git diff --stat origin/main...HEAD -- …`(세 점 = merge-base 이후 내 변경) 또는 `git log --oneline origin/main..HEAD -- …` 로 바꾸고, 뒤처짐만 있을 때는 '(참고) main 이 앞서 있음 — git merge origin/main' 안내로. APP_PATHS 에 'assets' 추가. red-green: 뒤처진 작업본에서 초록, 앞선 미배포 커밋에서 빨강.
파일: verify/check-deploy-sync.js, .claude/skills/session-check/SKILL.md

--- [ops-10] P2 (likely, human-decision) 예약 실행이 매일 3~7시간 늦게 돌고 일부는 아예 걸러진다 — 워크플로마다 적힌 시각표 전제가 깨져 있다
증상: '07:41 KST 수집 → 12:23 KST 보정 → 13:11 KST 라이브 점검' 같은 순서 설계가 실제로는 오후~저녁으로 밀리고, 3시간마다 도는 인스타 댓글은 하루 8회가 아니라 3~5회만 돈다.
근거: 예약(event=schedule) 실제 시작 시각(UTC): deploy-sync 03:23→09:17~10:00, 07:23→12:38~15:40 / check-live 04:11→09:15~10:52 / admin-lock-check 05:23→09:57~11:48 / main-guard 05:37→10:33~11:57, 13:37→17:35~20:12 / robot-heartbeat 08:29→13:31~16:51 / collect-scholarships 22:41→01:23~01:57, 02:41→08:33~09:00, 06:41→11:59~13:51 / close-old-reports 월 06:40→08월 중순 1~1.5시간 지연이던 것이 08-31 부터 6~7.7시간. insta-comments(`29 */3 * * *`) 성공 횟수 09-12~10-03 하루 3~5회, 최대 간격 9.7시간(10-01 00:40Z 이후) — 하트비트 문턱 9시간(3시간×3)을 이미 한 번 넘었다(하트비트가 그 시간대에 안 돌아 경보는 안 났음).
원인: GitHub Actions 예약 이벤트의 지연·누락(플랫폼 쪽). 정각·자정을 피한 홀수 분 정책으로는 줄지 않았다. 정확한 원인은 GitHub 쪽이라 확인 불가.
수리안: 시각에 기대는 순서는 workflow_run 사슬로 바꾸고(이미 deploy-sync 는 그렇게 동작), 주석의 KST 시각표를 '목표 시각(실제는 수 시간 늦을 수 있음)'으로 고친다. 하트비트는 3시간 간격 로봇에 최소 문턱(예: 12시간)을 둔다. 정시성이 필요하면 외부 깨우미(cron-job.org 등 → workflow_dispatch/repository_dispatch)를 쓸지 개발자가 정한다.
파일: .github/workflows/deploy-sync.yml, .github/workflows/check-live.yml, .github/workflows/insta-comments.yml, collector/robot-heartbeat.mjs

--- [ops-11] P3 (confirmed, code) 하트비트가 '어떤 이벤트든·어느 브랜치든' 성공 한 번이면 정상으로 본다 — 예약이 걸러져도 못 보는 로봇이 여럿
증상: 예약이 통째로 빠져도 push·수동 실행·workflow_run 성공이 있으면 조용하다. 하트비트의 목적('예약이 걸러진 것을 잡는다')과 어긋난다.
근거: collector/robot-heartbeat.mjs:116~126 `…/runs?status=success&per_page=1` — event·branch 거름 없음. 지금 각 로봇의 '마지막 성공'의 출처(REST 재측정): deploy-sync=push, main-guard=push(main), check-live=workflow_dispatch(main), insta·link-hunter·search-index=workflow_run, essay-playbook·resolve-detail-urls=workflow_dispatch.
원인: 성공 기록만 묻고 그것이 예약에서 왔는지를 묻지 않는다.
수리안: 예약 판정에는 `event=schedule&branch=claude/nice-heisenberg-WESq5` 로 묻고, 다른 이벤트 성공은 리포트에 참고로만 적는다(예약이 빠졌지만 로봇은 다른 길로 돌았다 → 경보 등급 낮춤). 관문 표본으로 red-green.
파일: collector/robot-heartbeat.mjs

--- [ops-12] P3 (confirmed, code) 노션 「작업 현황」의 '브랜치' 칸이 작업 브랜치 대신 main 으로 적힌다 · 노션 일시 장애에 재시도 없음
증상: 누가 어느 주제 브랜치에서 일하는지 보이게 하려던 칸이 대개 'main' 이나 기본 브랜치 이름이다.
근거: 06a34cc7 push: run 782(claude/source-link-integrity) cancelled · 783(기본) cancelled · 784(main) success → 로그 '✓ 이선주 — main'(run 37175483966). 같은 꼴: 772·769·766·763·760 모두 main 이 살아남음. update-progress.yml:52 `group: notion-status-${{ github.actor }}` + cancel-in-progress: true, tools/notion-status.mjs:113·254 가 GITHUB_REF_NAME 을 그대로 씀. 재시도: run 36856161345(10-01 11:34Z) '✕ 이선주: 500 … Cross-cell memcached access is not allowed' 한 번에 실패(재시도 없음).
원인: 세 브랜치 동시 push 관례 + 사람별 대기줄에서 마지막 실행만 살아남는데, 마지막이 보통 main 이다.
수리안: ref 가 main·기본 브랜치이면 '브랜치' 칸을 덮지 않거나(작업 브랜치 실행이 쓴 값 유지), push 된 커밋을 담은 다른 원격 브랜치 이름(git branch -r --contains)을 찾아 적는다. 노션 5xx 는 몇 초 쉬고 1~2회 재시도.
파일: tools/notion-status.mjs, .github/workflows/update-progress.yml

--- [ops-13] P3 (confirmed, workflow-yaml) 관리자 화면 잠금 확인이 '판정 불가'를 며칠 내리 내도 아무 경보가 없다
증상: Cloudflare 가 GitHub 러너를 막거나 응답 꼴이 바뀌어 매일 '판정 불가'가 되면 잠금 감시가 조용히 꺼진 상태가 된다(작업은 초록, 하트비트도 성공으로 셈).
근거: .github/workflows/admin-lock-check.yml:101 `verdict=unknown` → 이슈 단계(open=='1')·닫기 단계(locked) 둘 다 안 돌고 작업은 success. 현재는 정상: 10-03 run 37116530106 에서 '잠겨 있으면 옛 경보 이슈를 닫는다' 단계가 실행됨(=locked).
원인: '못 읽음'을 '괜찮음'으로 단정하지 않으려 한 설계가, 반대로 '못 읽음의 지속'도 알리지 않는다.
수리안: unknown 이 연속 N회(예: 3일)면 admin-lock 라벨 이슈를 '판정 불가 지속'으로 연다(최근 실행 결과는 actions API 로 확인하거나 출력을 저장소 밖 아티팩트로).
파일: .github/workflows/admin-lock-check.yml

--- [ops-14] P3 (confirmed, workflow-yaml) actions/checkout@v4·setup-node@v4 와 node-version 20 — 매 실행 'Node.js 20 is deprecated' 경고
증상: 지금은 GitHub 이 Node 24 로 강제 실행해 동작하지만, 경고가 모든 로그 끝에 붙고 Node 20 런타임(스크립트용 node-version: 20)은 지원 종료된 판이다.
근거: run 37175482635·36851872513 등 로그 '##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4'. main-guard.yml:57~59·device-deploy.yml:62~64·robot-heartbeat.yml:34~36·verify-ui.yml:81~83 `node-version: 20`.
원인: 액션·런타임 판 올림이 밀려 있음.
수리안: actions/checkout·setup-node 를 Node 24 대응 판으로 올리고 node-version 을 22(LTS)로 맞춘 뒤 verify-ui·test-collector 로 확인. 서두를 일은 아니다.
파일: .github/workflows/main-guard.yml, .github/workflows/device-deploy.yml, .github/workflows/robot-heartbeat.yml, .github/workflows/verify-ui.yml

NOTES: 읽기 전용으로만 점검했다(파일 수정·커밋·워크플로 실행·이슈 조작 없음, 작업 트리 미사용). 시키신 대로 node verify/check-deploy-sync.js 와 node verify/check-collab.js --brief 를 돌렸는데, 둘 다 git fetch 를 해서 원격 추적 ref 만 바뀌었다. 메모 파일은 scratchpad/ops/ 에만 썼다.

지금 상태:
- 로컬 작업본은 ca94c76e 이다. 원격 main 은 그 뒤 86f42b84 까지 나갔고, 원격 기본 브랜치는 main 보다 로봇 커밋 하나(8986661a, 정문 사진 수집 · docs/ 만 바뀜) 앞서 있다.
- 배포 길은 정상이다: deploy-sync 100/100, main-guard 100/100, device-deploy 100/100, Pages 빌드 최신 success.
- 지금 빨간불은 CI 관문(verify-ui) 하나다. 원인은 학생 화면이 아니라 검사 드라이버가 실데이터에 기대는 것이다(ops-01).
- 하트비트 경보 #385 는 당시엔 정당했다(자격요건 로봇 3일 실패). 지금 REST 로 다시 재면 23대 모두 문턱 안이라 다음 하트비트 실행(10-04 오후 UTC)에서 스스로 닫힐 것으로 보인다.
- check-live #350 과 device-deploy #274 는 둘 다 이미 해소된 낡은 경보다. 닫는 장치가 없어서 열려 있을 뿐이다(ops-04, ops-07).

곁가지로 알게 된 것(다른 그룹 몫):
- 학교 제한 없이 '양식이 붙은 마감 전 정식 등록 공고'가 지금 0건이다. 남은 마감 전 양식 공고는 한국외대 한정 auto-ent2431266737(10-30) 하나라, 한국외대 밖 학생에게는 양식 작성 길이 보이지 않는다.
- collect-news 는 '새 글 0건'에도 새 이슈를 연다(10-03 하루 6건, #372~#377).

관련 경로:
/home/user/hanggonggan/.github/workflows/verify-ui.yml
/home/user/hanggonggan/verify/verify-registered.js
/home/user/hanggonggan/.github/workflows/check-live.yml
/home/user/hanggonggan/.github/workflows/close-old-reports.yml
/home/user/hanggonggan/.github/workflows/device-deploy.yml
/home/user/hanggonggan/.github/actions/robot-down/action.yml
/home/user/hanggonggan/verify/check-deploy-sync.js
/home/user/hanggonggan/collector/robot-heartbeat.mjs
/home/user/hanggonggan/tools/notion-status.mjs
/home/user/hanggonggan/.github/workflows/admin-lock-check.yml


######## GROUP insta
INVENTORY: insta.yml (인스타 카드뉴스 게시 — 준비·게시·건너뛰기)=degraded; insta-comments.yml (인스타 댓글 관리 · 3시간마다)=degraded; insta-samples.yml (인스타 판형 견본)=healthy; insta-stats.yml (인스타 트랙션 수확 · 매일)=degraded; insta-token-check.yml (인스타 토큰 수명 확인 · 매일)=healthy; insta/publish.mjs (게시 — Graph API 캐러셀)=degraded; insta/render.mjs + insta/templates/4-poster.mjs (카드·캡션 그리기)=degraded; insta/pick.mjs + insta/notices.mjs (무엇을 올릴지 고르기)=healthy; insta/school.mjs (교내 공고 → 카드 재료)=degraded; insta/ledger.mjs (준비 장부 seen.json 고치기)=healthy; insta/caption.mjs=healthy; insta/stats.mjs · insta/comments.mjs · insta/graph.mjs=healthy; insta/token-days.mjs=healthy; insta/mail.mjs · insta/mail-urls.mjs (선택 SMTP 메일)=unknown; insta/sweep-overflow.mjs · samples.mjs · revise.mjs · preview.mjs · new-template.mjs · find-photos.mjs · fit.mjs=healthy; insta/run-notify.txt (다시 알리기 push-to-run)=unknown; verify/verify-insta.js (사실 관문)=healthy; insta/README.md · docs/designs/instagram-pipeline.md · insta/SCRIPT.md=degraded

--- [insta-1] P1 (confirmed, code) 게시 버튼이 마감 지난 카드와 날짜가 낡은 'D-N' 카드를 그대로 브랜드 계정에 올린다
증상: 관리자 화면 「인스타 › 게시 대기」 167건 중 88건은 이미 마감이 지났는데(줄에 '마감 지남' 표시), 그 줄에도 「게시」 버튼이 살아 있다. 누르면 '마감은 9월 19일까지 · #장학금마감임박' 캡션과 '마감 D-7' 그림이 그대로 올라간다. 마감 전 카드도 그린 날 기준 D-N 이 그림에 박혀 있어, 이틀 뒤에 누르면 D-21 이 실제 D-19 인 채로 올라간다. 게시는 되돌릴 수 없다.
근거: seen.json: prepared 167 중 due < 2026-10-04 가 88건(파이썬 집계). _admin/admin.js 2243행 — kind==='prepared' 면 마감과 상관없이 data-ig-publish 버튼, 2792~2795행 핸들러는 마감을 안 보고 insta.yml 게시를 부른다. insta.yml 341~345행 publish 작업은 'node insta/publish.mjs --code=… --publish' 하나, 앞 단계(315~325행)는 폴더 유무·이미 올림만 본다. publish.mjs 183~228행에 due 검사 없음. 캡션의 마감 거부는 그릴 때만(caption.mjs 78행). 그림 속 날짜: render.mjs 125~126행 ddayText → 511행(chat)·613행(note)·templates/4-poster.mjs 71행. 실물 insta/pub/0776003/1.jpg(그린 날 10-02, 마감 10-23)에 '마감 D-21'. insta/pub/2704055001/caption.txt(마감 9-19)에 '마감은 9월 19일까지' + '#장학금마감임박'. verify-insta.js 는 이 길을 재지 않는다(전부 통과).
원인: '게시는 다시 그리지 않는다 — 개발자가 본 그대로 올린다'(insta.yml 15~16행) 원칙 때문에 게시 단계가 아무것도 다시 판단하지 않는데, 그림·캡션에는 그린 날 기준의 상대 날짜(D-N)가 박히고 마감 판정도 그릴 때 한 번뿐이다. 준비와 게시 사이가 며칠~몇 주로 벌어지면서(게시 대기 최장 3주) 둘이 어긋났다.
수리안: ① publish.mjs(또는 insta.yml 게시 앞 단계)에서 meta.due 를 KST 오늘과 비교해 지났으면 거부하고, meta.at(그린 날)이 오늘이 아니면 '다시 그리고 다시 보라'고 거부하거나 경고한다. ② 판형의 ddayText 를 상대 날짜 대신 절대 날짜('10월 23일 마감')로 바꾸면 '다시 안 그린다' 원칙을 지키면서 낡지 않는다. ③ 관리자 화면은 마감 지난 줄의 「게시」 버튼을 감추고 「건너뛰기」만 남긴다. ④ verify-insta.js C9 에 '마감 지난 폴더로 게시하면 거부' red-green 검사를 더한다.
파일: insta/publish.mjs, insta/render.mjs, insta/templates/4-poster.mjs, _admin/admin.js, .github/workflows/insta.yml, verify/verify-insta.js

--- [insta-2] P2 (confirmed, workflow-yaml) 게시 성공 뒤 main 직접 push 가 재시도 없이 실패해 거짓 '게시 실패' 이슈 #263 이 3주째 열려 있다
증상: 9-12 마지막 게시(LG디스플레이 LGenius)는 인스타에 올라갔는데 실행은 빨간불이고 '🚨 인스타 게시가 실패했습니다' 이슈 #263 이 아직 열려 있다. 같은 꼴의 push 가 준비 작업에도 있어서, 그쪽이 실패하면 장부엔 '준비됨'으로 적혔는데 준비 이슈(알림)는 안 만들어지는 카드가 생긴다.
근거: run 34709674360 로그: '✅ 게시 완료 18624158749041013 — https://www.instagram.com/p/DdMkqOelTfI/' → 'seen.json 에 기록 — 지금까지 3건' → 기본 브랜치 push 성공 'f1bd524..4026014' → 'git push origin HEAD:main' 에서 '! [rejected] HEAD -> main (fetch first)' · '##[error]Process completed with exit code 1' → #263 생성. insta.yml 373행(게시)·174행(준비) 둘 다 재시도 없는 'git push origin HEAD:main'(바로 위 기본 브랜치 push 에는 3회 재시도가 있다). 준비 작업의 '그림이 공개될 때까지'(178행)·'개발자 셋에게 알린다'(186행)는 always() 가 없어 커밋 단계가 실패하면 건너뛴다. #263 은 라벨 insta-fail, 댓글 0, 2026-09-12 이후 그대로.
원인: main 은 사람 세션·device-deploy·deploy-sync 도 미는 브랜치라, 로봇이 체크아웃한 뒤 main 이 앞서 나가면 fast-forward 가 안 된다. 기본 브랜치 push 에만 재시도를 두고 main push 는 한 줄로 둬서, 이미 끝난 게시까지 '실패'로 보고된다.
수리안: 게시 작업에서는 main push 를 빼고(seen.json 은 Pages 가 필요 없다 — 관리자 화면은 기본 브랜치 raw 를 읽고, deploy-sync 하루 두 번 보정이 옮긴다) 준비 작업은 'git fetch origin main && git merge --ff-only 또는 재시도 3회'로 감싼다. 실패 문구는 '게시는 됐고 기록 저장만 실패'를 구별한다. 거짓 경보 #263 은 사람이 닫는다.
파일: .github/workflows/insta.yml

--- [insta-3] P2 (confirmed, workflow-yaml) 준비 이슈(insta-ready)가 닫히지 않고 34개 쌓였다 — 여러 장 이슈는 게시해도 안 닫히고, 마감이 지나도 안 닫힌다
증상: 열린 insta-ready 이슈 34개(담당자 셋에게 매번 GitHub 메일). 이슈 본문은 '올리거나 건너뛰면 이 이슈는 저절로 닫힙니다'라고 약속하지만, 6건짜리 이슈는 게시해도 코멘트만 달리고 닫히지 않는다. 담긴 카드가 전부 마감 지난 이슈(#262 6건 전부 9-16~9-18 마감)도 열려 있다. 쌓이는 이유 자체는 고장이 아니라 9-13 이후 아무도 「게시」를 누르지 않은 것(설계상 사람만 누른다)이다.
근거: REST 로 열린 insta-ready 34개 본문의 '<!-- insta-code: … -->' 169개를 seen.json 과 대조: 살아 있는 카드가 하나도 없는 이슈 8개, 이미 올린 코드가 든 열린 이슈 2개(#256: auto-ent2431265883…=posted, 나머지 둘 마감 9-19·9-30 · #262: 2700787001=posted, 나머지 다섯 마감 9-16~9-18). insta.yml 354~357행·424~427행 — 이슈 안 코드 수(CNT)가 1 이하일 때만 close, 아니면 comment. 220행 본문 '저절로 닫힙니다'. 마감 경과로 닫는 단계는 어디에도 없다. workflow_dispatch 게시 실행은 2026-09-12 이후 0회(실행 목록 141회 집계).
원인: 이슈 하나에 카드 여러 장을 묶어 놓고(6건 단위), 닫기 규칙은 '이 이슈에 그 코드 하나뿐일 때'만 본다. 그리고 카드가 쓸모없어지는 사건(마감 경과)에는 아무 로봇도 반응하지 않는다. 그 결과 알림 피로가 쌓여 사람이 이슈를 안 보게 되는 유형이다.
수리안: ① 게시·건너뛰기 뒤에 '이 이슈의 코드가 전부 posted/skipped/마감지남이면 닫는다'로 바꾼다. ② 준비 작업(또는 매일 예약)에 '열린 insta-ready 이슈 중 살아 있는 카드가 없는 것은 마감 경과로 닫는다' 단계를 둔다. ③ 마감 지난 준비 카드는 장부에서 'expired' 로 넘겨 관리자 화면 「게시 대기」 숫자에서 뺀다. 게시 여부(누를지 말지)는 개발자 결정이다.
파일: .github/workflows/insta.yml, insta/ledger.mjs, _admin/admin.js

--- [insta-4] P2 (likely, workflow-yaml) 사람의 「게시」·「건너뛰기」가 자동 준비 실행과 같은 대기줄이라 대기 중에 조용히 취소될 수 있다
증상: 자동 준비(수집 로봇이 끝날 때마다)가 도는 중에 관리자가 「게시」를 누르면 그 실행은 대기에 들어가고, 그 사이 다른 수집 로봇이 끝나 새 준비 실행이 대기에 들어오면 GitHub 이 먼저 대기하던 게시 실행을 취소한다. 작업이 시작도 안 해 실패 알림 단계도 안 돌고, 관리자 화면은 '로봇이 돌기 시작했습니다'라고만 했으니 아무도 모른다.
근거: insta.yml 59~61행 'concurrency: group: insta-publish, cancel-in-progress: false' 가 워크플로 전체(준비·게시·건너뛰기 세 작업)에 걸려 있다. 트리거는 workflow_run(수집 로봇 셋, 하루 5~6회 · 예: 10-03 08:41·09:14, 10-04 02:11·02:44 처럼 30분 안에 연달아) + schedule + 사람 dispatch. GitHub 동시성 규칙상 그룹당 '실행 1 + 대기 1'이고 새 대기가 오면 이전 대기는 취소된다(cancel-in-progress:false 는 실행 중인 것만 지킨다). CLAUDE.md '대기줄(concurrency)을 하나로 합치지 말 것(대기 실행이 취소된다)'. 실제 취소 사례는 아직 없다(게시를 누른 것이 9-12 몇 번뿐).
원인: 자동으로 자주 깨어나는 준비와, 사람이 드물게 누르는 되돌릴 수 없는 게시를 한 동시성 그룹에 넣었다(seen.json 을 같이 쓰므로 묶은 것으로 보인다).
수리안: 게시·건너뛰기 작업은 별도 그룹(예: insta-human)으로 빼고, seen.json 충돌은 지금처럼 'pull --rebase 재시도'로 막는다. 또는 job 단위 concurrency 로 준비만 묶는다. 관리자 화면은 dispatch 뒤 해당 실행이 cancelled 인지 한 번 확인해 알린다.
파일: .github/workflows/insta.yml, _admin/admin.js

--- [insta-5] P2 (confirmed, human-decision) 교내 카드가 아직 2개교(경희대·한국외대)만 — 44개교 복원 뒤 다른 학교 교내 공고 7건이 조용히 빠진다
증상: 건국대 '건국가족장학생'(10-20 마감), 고려대 '소망장학금'(10-30)·'대학봉사장학금', 동국대 '동국리더장학'(10-14), 인하대 '장애학생/형제자매장학금'(10-15) 등 정식 등록된 교내 공고가 인스타 카드 후보에 아예 안 들어간다. 교내 +4점이 계정의 차별점이라고 적어 둔 바로 그 몫이다.
근거: insta/school.mjs 23~26행 SCHOOLS = [경희대, 한국외대] 고정, 87행 'if (!school) return null'. 작업 트리에서 schoolNotices() 대조: registered.json 교내 19건 중 12건만 받음, 빠짐 7건 — auto-kuk2351208222artclviewdo(건국대) · auto-onttid000100000000003856·…3862(고려대) · auto-5bnum57138cate0qidx57138(서울과기대) · auto-ec9588eb82b4202026091720(동국대) · auto-krbbskr845644artclviewdo(인하대) · auto-notiphpcodes1301seq11120(한국항공대). verify-insta '103 건 (교외 91 · 교내 12)'. CLAUDE.md 「수집망 44개교 복원」(2026-09-29) 은 schools.json·browser-targets.json·SERVED_SCHOOLS 를 한 세트로 적고 insta 는 언급하지 않는다. insta/photos.json 열쇠도 경희대·한국외대·교외 셋뿐.
원인: 인스타 파이프라인(2026-09-10)은 당시 서비스 범위 2개교에 맞춰 학교 목록을 따로 박아 두었고, 44개교 복원 때 이 사본이 함께 넓혀지지 않았다(CLAUDE.md 가 경계하는 '베낀 목록이 갈라지는' 유형). 학교 사진 풀도 2개교뿐이라 넓히려면 사진 결정이 같이 필요하다.
수리안: school.mjs 가 eligibility.schoolOnly 를 그대로 학교로 쓰고(목록 고정 제거), 사진 풀에 없는 학교는 교외 사진이 아니라 학교가 드러나지 않는 중립 사진 + 학교 이름으로 그리게 한다. 학교 표기·사진·해시태그(#경희대장학금 #한국외대장학금 고정)를 어떻게 할지는 개발자 결정. 넓힐지 말지 자체가 결정이면 SCRIPT.md·school.mjs 머리말에 '의도적으로 2개교'라고 적어 둔다.
파일: insta/school.mjs, insta/photos.json, insta/caption.mjs, insta/SCRIPT.md

--- [insta-6] P2 (confirmed, workflow-yaml) 트랙션·댓글 수확이 실패해도 초록불 — tee 파이프가 종료코드를 삼키고, 실패 알림은 요약 한 줄뿐
증상: 인스타 API 가 거부하거나 네트워크가 끊겨 stats.mjs 가 '🚨 수확 실패'로 죽어도 「인스타 트랙션 수확」은 성공으로 끝나고 stats.json 은 옛 값 그대로 남는다. 댓글 받기도 같은 꼴이다. 넷 중 셋(stats·comments·samples)은 실패해도 이슈를 안 만든다.
근거: insta-stats.yml 38행 'node insta/stats.mjs | tee /tmp/out.txt; grep -q ^state=none … || echo state=ok', insta-comments.yml 57행 'node insta/comments.mjs fetch | tee /tmp/out.txt'. 로그상 셸은 'shell: /usr/bin/bash -e {0}'(pipefail 없음). 작업 트리 재현: IG_ACCESS_TOKEN=x IG_API_BASE=http://127.0.0.1:9 로 같은 줄을 bash -e 로 돌리니 '🚨 수확 실패 — fetch failed' 출력 · 단계 종료코드 0 · state=ok. 실패 단계는 insta-stats.yml 52~54행·insta-comments.yml 77~79행·insta-samples.yml 51~53행 모두 GITHUB_STEP_SUMMARY 에 한 줄만 쓴다(insta.yml 은 '실패를 요약에만 적으면 아무도 안 본다 — 이슈로 부른다'라고 스스로 적어 두었다). 토큰이 죽는 경우는 insta-token-check 가 이슈를 만들어 덮는다.
원인: 출력 확인용 tee 파이프를 쓰면서 pipefail 을 켜지 않았고, 보조 로봇의 실패 알림을 이슈가 아닌 요약으로만 남겼다.
수리안: 두 단계에 'set -o pipefail'(또는 shell: bash 명시 — 그때 기본이 -eo pipefail)을 넣는다. 실패 단계는 insta-fail 라벨로 중복 없이 이슈를 만들거나 기존 이슈에 코멘트한다. 관문(verify-insta.js 또는 test-collector)에 '파이프 뒤에 종료코드를 잃지 않는가' 검사를 둔다.
파일: .github/workflows/insta-stats.yml, .github/workflows/insta-comments.yml, .github/workflows/insta-samples.yml

--- [insta-7] P3 (confirmed, workflow-yaml) insta/pub 가 지워지지 않고 계속 자란다(100MB·170폴더, 88폴더는 마감 지남) — 매 준비 실행은 그 전체 85MB 를 artifact 로 다시 올린다
증상: 게시용 그림이 공고마다 4~5장씩 저장소와 GitHub Pages(main)에 영구히 쌓인다. 3주 만에 100MB. 카드를 그리는 실행마다 새 카드 몇 장이 아니라 insta/pub 전체(1163파일)를 압축해 올린다.
근거: du -sh insta/pub → 100M, ls insta/pub | wc -l → 170. 저장소 크기 310,725KB(gh api repos … .size). 10-02 run 36946829775 로그 'With the provided path, there will be 1163 files uploaded … Final size is 85234875 bytes'. insta.yml 153~158행 upload-artifact path: insta/pub/. 마감 지난 폴더를 지우는 단계는 어디에도 없다(seen.json prepared 중 마감 지남 88).
원인: 인스타가 공개 주소에서 그림을 가져가야 해서 커밋하는 설계인데, 게시가 끝났거나 쓸모가 없어진(마감 지난) 폴더를 치우는 쪽이 설계에 없다. artifact 경로도 '이번에 그린 것'이 아니라 폴더 전체로 적혀 있다.
수리안: artifact path 를 이번 실행의 코드 폴더로 좁힌다. 준비 실행(또는 주 1회)에 '마감 지남 + 게시 안 함' 폴더를 지우고 장부를 expired 로 바꾸는 단계를 둔다(올린 것은 인스타가 이미 사본을 가지므로 지워도 된다 — 지울지 여부는 개발자 확인). 과거 이력의 무게는 그대로 남는다.
파일: .github/workflows/insta.yml, insta/ledger.mjs

--- [insta-8] P3 (confirmed, code) 댓글 로봇이 댓글 0건인데도 매 실행 시각만 바뀐 커밋을 만든다
증상: 기본 브랜치에 '인스타: 댓글 fetch' 커밋이 하루 3~5개씩 생긴다(내용은 updatedAt 한 줄). 다른 로봇의 push 와 부딪힐 기회만 늘린다.
근거: comments.json = {updatedAt: 2026-10-03T21:39:14Z, items: []}. 로컬 이력에 10-02 17:57 ~ 10-03 21:39 사이 '인스타: 댓글 fetch' 6커밋. comments.mjs 58행이 항상 updatedAt 을 새로 써서 insta-comments.yml 71행 'git diff --cached --quiet' 가 늘 '바뀜'이 된다.
원인: '받아 온 시각'을 보여 주려고 매번 파일에 시각을 적는데, 그 시각만 바뀐 경우를 '변화 없음'으로 거르지 않는다.
수리안: items 가 이전과 같으면 쓰지 않거나(관리자 화면의 '받아 온 시각'은 실행 기록으로 대신) 커밋 전에 updatedAt 을 뺀 내용으로 비교한다.
파일: insta/comments.mjs, .github/workflows/insta-comments.yml

--- [insta-9] P3 (likely, config) 작업 브랜치 세션이 device-deploy 로 run-notify.txt 를 올리면 '다시 알리기'가 안 깨어난다
증상: 스킬 insta-revise 5-3 단계는 '작업 브랜치만 쓰는 세션이면 deploy/run-deploy.txt 로 「이 기기에서 배포」를 태운다'고 안내하지만, 그렇게 기본 브랜치에 들어간 run-notify.txt 변경은 insta.yml 의 push 트리거를 깨우지 못해 수정본 알림이 조용히 안 간다.
근거: .claude/skills/insta-revise/SKILL.md 52~53행. insta.yml 30~32행 push: branches 기본 브랜치 · paths insta/run-notify.txt. device-deploy.yml 은 체크아웃 기본 토큰(github.token)으로 'git push origin HEAD:$BASE' 하고, 스스로 머리말에 '로봇이 올린 push 는 다른 워크플로를 깨우지 못한다'고 적어 두었다. run-notify.txt 는 9-12 f1838369 이후 한 번도 안 고쳐졌고 insta.yml push 실행 0회라 실제로 당한 적은 아직 없다.
원인: push-to-run 표식이 GITHUB_TOKEN 으로 들어오는 길(device-deploy)을 고려하지 않았다.
수리안: 스킬 안내를 'Actions 에서 「인스타 카드뉴스 게시」 → 알림 단계 + code 로 실행' 또는 관리자 화면 버튼으로 바꾸거나, device-deploy 가 run-notify.txt 변경을 보면 insta.yml 을 workflow_dispatch(step=알림, code=…)로 직접 부르게 한다(dispatch 는 GITHUB_TOKEN 으로도 깨어난다).
파일: .claude/skills/insta-revise/SKILL.md, .github/workflows/device-deploy.yml

NOTES: 결론: 인스타 로봇 다섯은 '돌고 있다'. 토큰은 살아 있다(10-03 실행 '살아 있음 · 39일 남음 (처음 본 날 2026-09-13)' → 만료 2026-11-12 추정, 14일 경고는 10-29 무렵). 준비 로봇은 10-02 까지 새 공고를 전부 그렸고(장부 prepared 167 · posted 3) 지금은 그릴 것이 0건이라 1분 안에 조용히 끝나는 것이 정상이다. insta-ready 이슈가 쌓이는 직접 이유는 고장이 아니라 2026-09-13 이후 아무도 「게시」를 누르지 않은 것이다(workflow_dispatch 게시 실행 0회 · 설계상 사람만 누른다). 누르면 올라가는가: 게시 코드(publish.mjs)는 9-12 고친 판 그대로이고 그 판으로 3건이 실제로 올라갔으며 토큰도 살아 있어 '올라갈 가능성이 높다'(IG_USER_ID 시크릿이 아직 있는지는 누르기 전엔 확인 불가). 다만 지금 누르면 위험하다 — 대기 카드 167건 중 88건은 마감이 지났고, 나머지도 그림 속 'D-N'이 그린 날 기준이라 틀린 날짜가 올라간다(findings insta-1, P1). 누르기 전에 「이 판형으로 다시 그리기」로 오늘 날짜로 다시 그리는 것이 지금 쓸 수 있는 우회로다. 사람이 할 일: 거짓 경보 #263 닫기, 마감 지난 준비 이슈 정리, 교내 44개교로 넓힐지 결정. 덧붙임(별도 finding 으로 안 올림): ① 예약 지연·누락은 GitHub 쪽 — insta.yml cron 00:13 UTC 가 실제 04:36~05:50 UTC, insta-comments 하루 8회 예정이 실제 3~5회. ② 모든 인스타 워크플로가 setup-node node-version 20(2026-04 지원 종료)과 Node 20 대상 액션 v4 를 써서 'Node.js 20 is deprecated … forced to run on Node.js 24' 경고가 난다 — 저장소 전체 문제. ③ 매 준비 실행이 새 공고가 없어도 playwright+chromium 을 먼저 설치한다(약 30초 낭비 · pick 을 먼저 보면 줄어든다). ④ 교외 카드는 kosaf-open.json(층2)만 쓰고 registered.json 의 교외 133건은 안 쓴다 — 설계로 보이며 고장은 아니다. ⑤ docs/designs/instagram-pipeline.md 259행 '게시 대기 4건' 같은 현황 숫자가 낡았다. 작업: 읽기 전용, 스크립트 실행은 스크래치 작업 트리(/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/insta/wt)에서만 했고 끝에 지웠다. 메인 체크아웃 git status 는 깨끗하다. 실행 목록 원본: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/insta/runs-*.txt, 열린 준비 이슈 원본: …/scratchpad/insta/ready.json.


######## GROUP servers
INVENTORY: .github/workflows/push-health.yml (푸시 서버 상태 확인 · 매일)=degraded; .github/workflows/push-check.yml (상태 + 시험 발송 · 수동)=healthy; .github/workflows/essay-smoke.yml (초안 서버 실물 확인 · 수동)=healthy; server/push/worker.js (handaejang-push · Cloudflare 무료 등급 · 가동 중)=degraded; server/push/wrangler.toml · gen-vapid.mjs · README.md=healthy; sw.js push 수신부 (backgroundCheck · push · notificationclick)=healthy; notify.js (pushSubscribe·pushEnsure·pushUnsubscribe)=healthy; notify-rules.js · verify/verify-notify-rules.js=healthy; push-config.js=healthy; server/chat/worker.js · chat-config.js (도우미 AI)=retired; server/essay/worker.js · draft-guard.mjs · smoke.mjs · essay-config.js (AI 초안)=retired; server/apply/ (worker.js · apply-guard.mjs · send-log.mjs) 접수 대행=broken; server/mail-worker.js=retired; server/README.md=degraded; supabase-config.js (로그인 · 이어쓰기)=unknown; support-config.js=healthy; verify/verify-push-server.mjs=healthy; verify/verify-apply-guard.mjs=degraded; verify/verify-essay-submit.mjs=healthy; verify/verify-essay-guard.mjs=healthy

--- [servers-F1] P2 (confirmed, code) 접수 대행 서버(server/apply)는 Cloudflare 에서 시작조차 못 한다 — Node 관문은 초록불
증상: server/apply/README.md ④ 배포 단계대로 올리면 워커가 기동하지 못한다(모든 요청 실패). 지금은 기능이 꺼져 있어(앱은 mailto:) 학생 영향 없음 — 켜는 날 바로 터진다.
근거: server/apply/apply-guard.mjs:27-28 `import { createRequire as _cr } from 'node:module'; const ME = _cr(import.meta.url)('../../match-engine.js');` · 일회용 worktree 에서 wrangler 4.147.0 `deploy --dry-run`: 번들 14.77KiB(126KB 짜리 match-engine.js 가 안 들어감, 번들 안에 `var ME = _cr(import.meta.url)("../../match-engine.js")` 그대로) + 경고 'The package "node:module" wasn't found ... enable the "nodejs_compat" compatibility flag' · `wrangler dev`(workerd): '✘ [ERROR] service core:user:handaejang-apply: Uncaught Error: No such module "node:module". imported from "worker.js"' → 'The Workers runtime failed to start' · nodejs_compat 를 켜도: 'Uncaught TypeError: The argument 'path' ... Received 'undefined' at node:module:34:15 in createRequire'. 같은 함정을 essay 쪽은 이미 피했다 — 커밋 cf3df58a(2026-08-24) 메시지 'wrangler nodejs_compat 없어 createRequire 대신 esbuild/Node CJS named import 로 재수출 — 실증'. 비교: push 15.18KiB·essay 57.53KiB·chat 6KiB 는 dry-run·로컬 기동 모두 정상. verify/verify-apply-guard.mjs 는 Node 에서만 돌아 exit 0.
원인: apply-guard.mjs 가 match-engine.js 를 Node 전용 방식(createRequire + import.meta.url 파일 경로)으로 불러 와, Workers 번들러(esbuild)가 그 파일을 묶지 않고 workerd 에는 node:module(및 파일 경로 import.meta.url)이 없다. 관문은 Node 에서만 실행돼 런타임 차이를 보지 못한다.
수리안: apply-guard.mjs 를 essay 와 같은 방식으로 바꾼다 — `import ME from '../../match-engine.js'`(CJS 기본 import, esbuild 가 section-head·parse-requirements 의 정적 require 까지 묶는다). 관문 추가: server/*/ 각 워커를 `wrangler deploy --dry-run` 로 묶어 보거나, 최소한 server 워커가 불러 오는 모듈 그래프에 'node:module'·createRequire 가 없는지 test-collector 정적 검사로 막는다(red-green: 지금 코드로 빨간불 확인). 같이: server/apply/wrangler.toml:5 의 '저장할 것이 없다 … KV 없음' 주석은 send-log.mjs 가 Supabase apply_sends 에 쓰는 현재 설계와 어긋나므로 고친다.
파일: server/apply/apply-guard.mjs, server/apply/wrangler.toml, verify/verify-apply-guard.mjs, verify/test-collector.mjs

--- [servers-F2] P2 (likely, workflow-yaml) push-health 의 '로봇이 넘어졌다' 알림이 checkout 없이 로컬 action 을 불러 실제로는 못 울린다
증상: push-health 가 시간 초과·접속 단계 오류로 넘어지면 robot-down 이슈가 만들어져야 하는데, 알림 단계 자체가 'action.yml 을 찾을 수 없음'으로 실패할 것이다. 남는 그물은 하트비트(기대 간격 3배 ≈ 3일)뿐.
근거: .github/workflows/push-health.yml:145 `uses: ./.github/actions/robot-down` — 같은 job 에 actions/checkout 단계가 없다(단계: /health 읽기 → 이슈 → 닫기 → 실패 → robot-down). run 37162895315 job 111319829026 의 steps 목록에도 checkout 없음, robot-down 은 33회 내내 skipped 라 한 번도 실제로 돈 적이 없다. GitHub 문서: './경로' 로컬 action 은 저장소를 먼저 checkout 해야 한다(안 하면 "Can't find 'action.yml' ... Did you forget to run actions/checkout"). 다른 묶음이지만 close-old-reports.yml:106 도 같은 꼴(checkout 0개). robot-down 을 쓰는 나머지 7개 워크플로는 checkout 이 있다.
원인: 2026-09-06 커밋 9aa1a554 가 예약 로봇 7대에 공용 로컬 action 을 붙일 때, 원래 checkout 이 필요 없던 push-health·close-old-reports 에는 checkout 을 넣지 않았다. 당시 검사('없는 action 참조 0')는 파일 존재만 봤다.
수리안: push-health.yml 첫 단계에 `- uses: actions/checkout@v4` (sparse-checkout: .github/actions 로 가볍게) 추가. close-old-reports.yml 도 같이. 관문: test-collector 에 '`uses: ./` 로컬 action 을 쓰는 job 은 그보다 앞에 actions/checkout 이 있다' 검사 추가(지금 두 파일로 빨간불 확인).
파일: .github/workflows/push-health.yml, .github/workflows/close-old-reports.yml, .github/actions/robot-down/action.yml, verify/test-collector.mjs

--- [servers-F3] P2 (likely, code) 푸시 상태 확인은 '하루 두 번 깨우기가 멈췄다'를 볼 수 없다 — 멈춰도 초록불
증상: Cloudflare 예약(cron)이 사라지거나 회차가 시작되지 않아도 /health 는 계속 {step:idle, lastError:null} 이라 push-health 가 매일 '정상'이라 한다. 실제 도달 증명은 2026-09-02 시험 발송(3/3)이 마지막 — 32일째 없음.
근거: server/push/worker.js:387-406 /health 가 주는 칸은 ok·configured·step·sent(진행 중일 때만)·subs·lastError 뿐. 마지막으로 처리한 회차 열쇠 state:slot 은 265행에서 쓰기만 하고 내보내지 않으며, 끝난 회차의 woke·dropped 기록은 어디에도 저장하지 않는다(clearRun 이 state:run 을 지움, 234-237행). push-health.yml 판정도 이 칸들로만(64~78행). push-check run 33575249245 (2026-09-02): {"tried":3,"woke":3,"dropped":0} 이후 실발송 기록 없음. 지금 멈췄다는 증거는 없다(Cloudflare 로그를 이 세션에서 볼 수 없음).
원인: 상태 확인이 '서버가 응답하는가·열쇠가 있는가'만 보고, 정작 하는 일(정해진 시각에 회차를 돌았는가·몇 대를 깨웠는가)의 흔적을 서버가 남기지도 내보이지도 않는다.
수리안: worker.js: 회차를 끝낼 때 state:lastRun {slot, finishedAt, woke, dropped, sent, schools 수, wakeAll} 를 적고 /health 에 lastSlot·lastRunAt·lastWoke 로 내보낸다(발송 없이 읽기만). push-health.yml: lastSlot 이 두 회차+여유(약 14시간)보다 오래됐으면 경보. 워커 재배포(Workers Builds) 필요 — verify-push-server.mjs 에 그 칸 검사 추가.
파일: server/push/worker.js, .github/workflows/push-health.yml, verify/verify-push-server.mjs

--- [servers-F4] P2 (confirmed, code) 푸시 서버의 lastError 는 한 번 적히면 영영 지워지지 않는다 — 일시 장애 하나로 경보가 영구 빨간불
증상: github.io 가 10분쯤 응답하지 않아 한 회차가 다섯 번 실패하면, 그 뒤 깨우기가 정상으로 돌아와도 push-health 가 매일 빨간불이고 경보 이슈가 자동으로 닫히지 않는다. 그 사이 새 장애가 나도 같은 빨간불에 묻힌다.
근거: server/push/worker.js:274 `await env.SUBS.put('state:lastError', …)` — 저장소 전체에서 이 키를 지우는 코드가 없다(grep: 274·390행뿐). /health 가 그대로 내보내고(390행), push-health.yml 은 lastError 가 비어 있지 않으면 error 판정 → '정상이면 옛 경보 이슈를 닫는다' 단계가 영영 안 돈다. server/push/README.md:137 'lastError가 보이면 — Claude에게 그대로 보여주세요'에 지우는 방법(대시보드 KV 삭제)이 없다. 지금까지 33회 모두 lastError null 이라 아직 발생한 적은 없다.
원인: lastError 를 '마지막 오류'가 아니라 '오류가 있었던 적이 있다'로 남기는 구조이고, 회복(이후 성공한 회차)을 기록하지 않는다.
수리안: 회차가 끝까지 성공하면 state:lastOkAt 을 적고, /health 는 lastError.at 이 lastOkAt 보다 나중일 때만 lastError 를 내보내거나(또는 성공 회차에서 lastError 삭제), push-health 가 그 비교로 판정한다. README 에 수동 해소 방법도 적는다. verify-push-server.mjs 에 '실패 뒤 성공 회차 → lastError 해소' 검사 추가.
파일: server/push/worker.js, server/push/README.md, .github/workflows/push-health.yml, verify/verify-push-server.mjs

--- [servers-F5] P2 (likely, code) 원문 링크를 고칠 때마다 서버가 그 학교 폰을 '새 공고'로 깨우고, 폰은 내용 없는 알림만 띄운다
증상: 링크 사냥꾼·복구 로봇이 같은 공고의 주소를 바꾸면 발송 서버는 새 공고로 보고 그 학교 구독자를 깨운다. 폰은 2026-10-03 수리(F3)로 같은 공고임을 알아 알릴 것이 없으니, 규칙상 '한대장 · 새 장학 소식' 이라는 내용 없는 알림을 띄운다.
근거: server/push/worker.js:210-218 `const k = 'n:' + n.url; if (seen.has(k)) {…continue;} … schools.add(n.school)` — 주소 하나로만 '본 공고'를 판단. 폰은 notify-rules.js:278-292 에서 학교+제목 열쇠(titleSeenKey)와 foundAt 으로 '본 것'을 판단 → feed 이벤트 0 → sw.js:345 기본 알림. data/notices.json 이력 실측: 2026-10-03 01:33(046b2b28)→10-04 02:11(a31a8538) 사이 같은 학교+같은 제목인데 주소만 바뀐 글 54건·10개교(가천 16·서울교대 10·고려 9·동국 7·경기 3·전북 3·서울 2·항공 2·성균관 1·부경 1). 커밋별로 76e3f19e 38건, e78ea901 29건, 9f6d533a 10건. 그 학교 구독자는 다음 회차(10-03 20:10 또는 10-04 08:10 KST)에 깨워졌을 것(Cloudflare 로그 미확인).
원인: 10-03 '원문 링크 정직성' 리뷰 F3 에서 폰 쪽 '본 공고' 판정만 학교+제목으로 넓히고, 같은 판단을 하는 발송 서버(worker.js schoolsToWake)는 옛 주소 기준 그대로 남았다 — 판단이 두 벌로 갈라졌다.
수리안: worker.js 의 notices 판정에 notify-rules 와 같은 열쇠 't:'+school+'|'+제목(공백 제거)을 함께 적고 둘 중 하나라도 본 것이면 깨우지 않는다(가능하면 열쇠 함수를 한 곳에서 불러 쓴다). verify-push-server.mjs 에 '주소만 바뀐 같은 공고는 깨우지 않는다' 검사 추가(지금 코드로 빨간불 확인). 워커 재배포 필요.
파일: server/push/worker.js, notify-rules.js, verify/verify-push-server.mjs

--- [servers-F6] P2 (likely, code) 마감 임박 공고 하나로 하루 두 번 전원을 깨워, 두 번째는 늘 내용 없는 알림이 된다
증상: 학교 한정이 아닌 정식 등록 공고가 오늘·내일 마감이면 08:10·20:10 두 회차 모두 모든 구독자를 깨운다. 폰은 같은 마감 알림을 한 번만 보내므로(중복 방지) 나머지 회차엔 '한대장 · 새 장학 소식' 빈 알림이 뜬다. 자격 미달 학생은 두 번 다 빈 알림.
근거: server/push/worker.js:195-207 — 회차마다 dueSoon(마감 == 오늘·내일)을 다시 세고 '이미 이 공고로 깨웠다'를 기억하지 않는다. schoolOnly 가 없으면(schoolsAny 다교 공고 포함, summarize 160행이 schoolOnly 만 봄) wakeAll. 폰은 notify-rules.js 마감 절에서 'dl:'+id+':'+d 열쇠를 ledger.sent 로 한 번만 보냄(already()) → sw.js:345 빈 알림. 현재 data/registered.json(152건, 학교 한정 없는 것 49건)으로 모의: 2026-10-04~10-24 21일 중 10일이 wakeAll → 구독자 1인당 이 원인만으로 약 10회 이상의 빈 알림(추정).
원인: 서버의 깨우기 판단이 폰의 알림 중복 방지 단위(공고×남은 날)를 모른다 — 서버는 '알릴 거리가 있을 수 있는 날'마다 회차 단위로 깨운다.
수리안: worker.js 에서 마감 사유를 'due:'+id+':'+d 로 state:seen 에 적어 같은 (공고, 남은 날)로는 한 번만 깨운다. schoolsAny 공고는 그 학교들만 깨운다. 사람 결정이 필요한 부분: 빈 알림을 줄이려 08:10 회차만 마감 사유로 깨울지. verify-push-server.mjs 에 '같은 날 두 번째 회차는 같은 마감으로 다시 깨우지 않는다' 검사.
파일: server/push/worker.js, verify/verify-push-server.mjs

--- [servers-F7] P3 (likely, code) 분교(게시판 공유) 학생은 새 공고로 깨워지지 않고, 캠퍼스 표시 글은 엉뚱한 학교를 깨운다
증상: 한양대 ERICA·건국대 글로컬·홍익대 세종 학생 화면에는 본교 게시판 공고가 뜨지만 발송 서버는 그 학생들을 '새 공고'로 깨우지 않는다. 반대로 [ERICA] 표시 글은 서울캠퍼스 학생을 깨워 빈 알림을 띄운다.
근거: match-engine.js:777-781 SHARED_BOARD_BRANCH('한양대학교 ERICA캠퍼스'→'한양대학교' 등 3곳)·TITLE_CAMPUS/taggedSchool(785-796행) 로 noticeForProfile(891-900행)이 화면·알림을 정한다. 발송 서버는 worker.js:216 `schools.add(n.school)` · 335행 `schools.has(sub.school)` 로 이름이 같을 때만 깨운다(구독 때 보내는 school 은 프로필 학교 그대로, notify.js:508).
원인: 발송 서버가 match-engine 의 분교·캠퍼스 규칙을 쓰지 않고 학교 이름 일치만 본다(서버는 match-engine 을 싣지 않는다).
수리안: 서버에서 같은 규칙을 쓴다 — 워커가 match-engine 의 taggedSchool·SHARED_BOARD_BRANCH 를 번들로 불러(F1 의 ESM import 방식) '깨울 학교'에 분교를 함께 넣고 캠퍼스 표시 글은 표시된 학교만 깨운다. 또는 구독 때 앱이 noticeForProfile 기준의 '피드 학교' 목록을 보내게 한다. 검사 추가.
파일: server/push/worker.js, match-engine.js, notify.js

--- [servers-F8] P2 (likely, workflow-yaml) 로그인 서버(Supabase)를 매일 보는 감시가 없다 — 무료 등급 7일 휴면 위험이 문서에만 있다
증상: Supabase 프로젝트가 멈추거나(무료 등급이면 7일 무활동 시 일시정지) 키가 바뀌면 로그인·이어쓰기가 실패하는데, 푸시 서버와 달리 이를 알릴 로봇이 없다. 개인정보를 받는 기능인데 문의처(support-config)만 있고 생존 확인은 없다.
근거: supabase-config.js:28-29 url·anonKey 채워짐(support-config.js 주석: 2026-09-23 '로그인이 실제로 켜져 배포된 뒤'). grep: .github·collector·tools 어디에도 supabase.co 를 부르는 곳 없음(verify-ui.yml:24 주석뿐). SESSIONS.md:2924 '⚠️ 무료 등급은 7일간 활동이 없으면 프로젝트가 일시정지된다(대시보드에서 되살림). 사용자가 없는 초기에 실제로 걸린다.' docs/designs/data-flow.md §7 '어디가 끊기면' 표에 로그인 행 없음. 샌드박스에서는 *.supabase.co 가 403 이라 지금 살아 있는지 확인 불가(사실 단정 안 함). 요금 등급은 저장소에 기록 없음.
원인: push-health 를 만들 때(2026-08-31) 로그인 서버는 아직 꺼져 있었고, 9-23 에 켤 때 같은 계열의 매일 확인을 붙이지 않았다.
수리안: push-health 와 같은 모양의 supabase-health.yml(매일 홀수 분 · /auth/v1/health 를 공개 anonKey 로 GET · 실패 시 라벨 이슈 · 회복 시 자동 닫기 · robot-down 은 checkout 뒤에)을 추가하고 deploy/heartbeat 대상에 넣는다. 사람 확인: 프로젝트 요금 등급(무료면 휴면 정책과 이 확인 호출이 '활동'으로 쳐지는지 공식 문서로 확인).
파일: supabase-config.js, docs/designs/data-flow.md, .github/workflows/push-health.yml

--- [servers-F9] P3 (confirmed, workflow-yaml) push-check(시험 발송)는 열쇠가 틀리거나 한 대도 못 깨워도 초록불로 끝난다
증상: PUSH_ADMIN_KEY 가 서버 ADMIN_KEY 와 어긋나 {"error":"unauthorized"} 가 와도, woke 가 0이어도 실행이 success 로 남아 '버튼을 눌렀더니 초록'으로 오해할 수 있다.
근거: .github/workflows/push-check.yml:40-43 `curl -sS --max-time 30 -X POST … /test` — -f 없음·응답 판정 없음, ① 단계도 `|| echo "(접속 실패)"` 로 실패를 삼킴. 판정은 사람이 로그를 읽는 데 맡김('위 tried/woke가 등록된 폰 수와 같으면 정상입니다').
원인: 수동 확인 도구로 만들어 결과 판정을 넣지 않았다.
수리안: 응답 JSON 을 jq 로 읽어 error 가 있거나 woke == 0(tried>0) 이면 exit 1, 결과를 $GITHUB_STEP_SUMMARY 에 한 줄로 남긴다.
파일: .github/workflows/push-check.yml

--- [servers-F10] P3 (confirmed, code) 서비스워커 push 수신부가 NOTIFY_RULES 를 typeof 없이 참조 — 규칙 파일이 못 실리면 알림 없이 끝난다
증상: importScripts 다섯 파일 중 하나라도 실을 때 예외가 나면(뒤의 notify-rules.js 가 안 실림) 푸시를 받을 때마다 ReferenceError 로 아무 알림도 안 띄운다 → 크롬은 제 문구로, iOS 는 반복되면 구독을 끊을 수 있다.
근거: sw.js:96 `try { importScripts('section-head.js', …, 'match-engine.js', 'notify-rules.js'); } catch (e) { /* 못 읽으면 알림만 비활성 */ }` · backgroundCheck 는 222행에서 typeof 로 지키지만 push 핸들러 332행 `if (NOTIFY_RULES && NOTIFY_RULES.shouldSelfUnsubscribe(…))` 는 선언 안 된 이름이면 그 자리에서 던진다(빈 알림 345행까지 못 감). 지금은 정상: vm 에 다섯 파일을 서비스워커처럼 실어 실데이터로 돌려 예외 0. test-collector 의 vm 검사(4873-4878행)는 section-head·parse-requirements·match-engine 셋만 싣고 notify-rules·sw 순서는 안 본다.
원인: '못 읽으면 알림만 비활성'이라는 설계가 push 핸들러 한 줄에서 지켜지지 않았다.
수리안: 332행을 `typeof NOTIFY_RULES !== 'undefined' && …` 로. test-collector 에 sw.js 의 importScripts 목록을 읽어 그 순서대로 vm 에 실어 보는 검사 추가(파일이 하나 던지면 빨간불).
파일: sw.js, verify/test-collector.mjs

--- [servers-F11] P3 (confirmed, code) server/README.md 가 폐기된 메일 워커를 '배포 대기'로, 없는 설정 칸을 스위치로 안내한다
증상: 서버 폴더 첫 문서를 읽은 사람(또는 새 세션)이 2026-09-25 에 폐기된 mail-worker.js 를 배포하려 하거나, 앱에 없는 HANDAEJANG_CONFIG.mailEndpoint 를 찾는다.
근거: server/README.md: '서버 코드(mail-worker.js) 완성 — 배포 대기', '앱은 HANDAEJANG_CONFIG.mailEndpoint가 설정되는 순간 자동 접수 버튼이 활성화' — grep 결과 HANDAEJANG_CONFIG 는 mail-worker.js:23 주석에만 있고 앱 코드엔 없음. mail-worker.js 머리말: '이 파일은 더 쓰지 않는다 (2026-09-25) → server/apply/'. server/apply/wrangler.toml:5 '보낸 기록도 여기 남기지 않는다(KV 없음)'도 send-log.mjs 의 Supabase apply_sends 기록과 어긋남.
원인: server/apply 를 새로 만들 때 상위 README 와 wrangler 주석을 함께 고치지 않았다.
수리안: server/README.md 를 네 서버(push 가동 · chat/essay 꺼짐 · apply 꺼짐·도메인 대기 · mail-worker 폐기) 현황표로 바꾸고 각 README 를 가리키게 한다. apply/wrangler.toml 주석 정정.
파일: server/README.md, server/apply/wrangler.toml, server/mail-worker.js

NOTES: 요약(개발자용): 서버 넷 중 실제로 켜져 있는 것은 푸시 발송 서버 하나다. 매일 상태 확인 33회가 전부 정상이었고(최근 2026-10-03 23:47Z: configured true · lastError null · 등록 폰 4대), 앱이 읽는 데이터도 최신이다. 도우미(chat)·AI 초안(essay)은 주소 칸이 비어 설계대로 꺼져 있다. 둘 다 일회용 worktree 에서 wrangler 4.147.0 으로 묶고 로컬 workerd 로 띄워 보니 정상 기동했다. 접수 대행(apply)도 설계상 꺼져 있다(도메인 없음). 다만 이건 켜는 순간 시작 자체가 안 된다는 것을 로컬 런타임으로 확인했다(F1, 확정). Node 관문은 이 결함을 못 본다.

핵심 위험은 세 가지다. ① 감시 장치의 빈틈: 넘어짐 알림이 checkout 없이 돌고(F2), 깨우기가 멈춰도 초록불이며(F3), 오류 기록은 영구 빨간불이 된다(F4). ② 발송 서버와 폰의 판단이 갈라져 '내용 없는 알림'이 생긴다. 10-03 링크 수리 54건이 10개교를 깨웠을 것이고(F5), 마감 임박 공고는 하루 두 번 전원을 깨운다(F6). F5·F6 은 코드와 데이터 실측에서 나온 추정이다. Cloudflare 로그를 볼 수 없어 실제 발송 횟수는 확인하지 않았다. ③ 로그인 서버(Supabase)는 매일 보는 로봇이 없다(F8).

실도달 증명은 2026-09-02 시험 발송(3/3)이 마지막이다. 시험 발송은 학생 폰 전부에 실제 알림이 가므로 이 진단에서는 누르지 않았다.

검증 방법과 사실:
- 다섯 관문 실행 결과: verify-push-server, verify-apply-guard, verify-essay-submit 63/0, verify-essay-guard 108/0, verify-notify-rules 모두 exit 0.
- 서비스워커 push 경로를 vm 으로 모의했다(다섯 importScripts + 실데이터 5개교). 예외 0.
- 모델 id(claude-sonnet-5·claude-opus-5·claude-haiku-4-5-20251001)는 claude-api 스킬 모델 표 기준으로 모두 Active 다.
- push-health 예약은 21:17 UTC 인데 실제 실행은 2~4시간 늦다(GitHub 예약 지연). 날짜 누락은 없었다.
- 샌드박스에서는 workers.dev·supabase.co 가 프록시 403 이라 직접 확인하지 못했다. 이것은 고장의 증거가 아니다.

정리 상태: 일회용 worktree(scratchpad/servers/wt)는 제거했고 본 checkout 은 건드리지 않았다(git status 깨끗). wrangler 는 scratchpad/servers/wr 에만 설치했다. 남은 scratch 파일은 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/servers/ 아래에 있다(sw-sim.cjs, wake-sim.mjs, urlchurn.sh, 관문 로그, apply-dev*.log).

수리 시 주의: 푸시 워커를 고치면 Cloudflare Workers Builds 재배포까지 끝나야 효과가 난다. 고친 뒤에는 push-check 로 실도달을 확인하는 것이 맞다(사람이 누름).


######## GROUP app1
INVENTORY: .github/workflows/verify-ui.yml (앱 화면 검사 관문)=broken; verify/verify-registered.js=broken; verify/verify-chat.js=healthy; verify/verify-apps-manage.js=healthy; verify/verify-essay-ui.js=healthy; verify/verify-forms-data.js=healthy; verify/verify-new-forms.js=degraded; verify/verify-source-links.js=healthy; verify/verify-elig-ask.js=healthy; verify/verify-apply-prep.js=healthy; verify/verify-sheet-back.js=healthy; verify/verify-kosaf.js=healthy; verify/verify-fit-badge.js=healthy; verify/verify-explore-sort.js=healthy; verify/drive.js (전 여정 회귀 — 일괄 신청 준비 포함)=healthy; verify/form-snapshot.mjs=healthy; verify/verify-essay-ask.mjs=healthy; verify/verify-essay-submit.mjs · verify-essay-guard.mjs · verify-apply-guard.mjs=healthy; .github/workflows/essay-playbook.yml (작성 규칙 학습 로봇)=healthy; .github/workflows/essay-smoke.yml=unknown; apply-channel.js (classifyChannels · findApplyPortal 포털 딥링크)=healthy; 메일 접수 (app.js #btn-mail-apply mailto + collector/apply-email.mjs)=degraded; forms.js · form-plan.js (양식 엔진·질문 설계)=healthy; data/forms.json (양식 데이터)=degraded; essay.js · essay-ask.js · essay-quality.js · essay-submit-check.js (AI 초안)=healthy; chat.js (도우미)=degraded; collector/build-search-index.mjs → data/search-index.json=degraded; elig-ask.js (자격 묻기)=healthy; source-link.js (원문 링크 이름)=healthy; 일괄 신청 준비 (app.js renderBulkPrep)=healthy; 적합도 배지 (fitVerdict) · 탐색 정렬=healthy; 층2(KOSAF) 카드=healthy; verify/what-shows.mjs=healthy; 기능 스위치 (essay-config · chat-config · support-config)=healthy

--- [app1-01] P1 (confirmed, code) verify-registered.js 가 실데이터에 기대어 빨간불 — 화면 검사 관문 전체가 10-04 부터 멈춤
증상: verify-ui.yml 이 10-04 03:55Z 부터 연속 실패(#420·#421·#422). '마감 전 양식 공고를 하나도 구동하지 못했습니다'. set -e 때문에 뒤의 드라이버 22개(chat·essay-ui·forms-data·source-links·kosaf·elig-ask·apply-prep·news·admin…)와 ui-tone·test-collector(DOC_GATES)·drive.js 가 CI 에서 하나도 안 돈다. 그 사이 06a34cc7(parse-requirements)·b444b603(소식) 커밋이 화면 검사 없이 나갔다.
근거: https://github.com/seonju5543-web/hanggonggan/actions/runs/37175886336 로그: '조병두 구간 건너뜀 … 대체 구동(마감 전 양식 공고): 없음 | 문서 생성: false / ERRORS: 마감 전 양식 공고를 하나도 구동하지 못했습니다'. 10-03 실패(#407·#408) 로그는 'reg-dongsan(신청 버튼 잠김)' 이었고 c1ac018f(17:53Z) 가 '잠긴 후보뿐이면 표본을 심는다'를 넣어 #411~#419 는 통과. 로컬 워크트리(ca94c76e, PORT=8781)에서 같은 출력으로 재현(rc=1). 코드: verify/verify-registered.js:46 `if (!ids.length) return { id: null, ok: false };` 와 :67 `if (ids.length && tried.every(...잠김...))` — 후보가 0장이면 표본 심기에 도달하지 못한다. 데이터: 양식이 붙은 열린 공고는 reg-hi-jeju·reg-hi-jeongeup(listedAt 2026-07-16 → notStale false, 60일 지나 숨김)·auto-ent2431266737artclviewdo(한국외대 한정)뿐. reg-dongsan(마감 10-02)은 CLOSED_KEEP_DAYS=1(app.js:331·1910)로 CI 날짜(UTC) 10-04 부터 목록에서 빠졌다.
원인: 10-03 수리(c1ac018f)가 '후보가 있는데 전부 잠김'인 경우만 막았다. 같은 유형의 다음 단계인 '이 학생에게 보이는 양식 공고가 아예 없음'(ids 빈 배열)은 그대로 실패로 간다. CLAUDE.md 가 금지한 '실데이터에 기댄 고정 검사'가 아직 남아 있다. 데이터 쪽 배경은 app1-03(열린 공고 중 양식이 붙은 것이 1건뿐).
수리안: driveAnyLiveForm 이 ids 가 비었을 때도 표본을 심게 한다. registeredList 에서 formId 가 있고 FORM_TEMPLATES 에 있는 항목을 하나 골라 복사한다(화면에 보이는지는 묻지 않는다). 복사본은 schoolOnly·campusOnly·schoolsAny 를 지우고, 마감은 오늘+20일, listedAt 은 오늘로 둔다. 그 뒤 renderExplore 를 다시 불러 같은 driveOneForm 으로 몬다(verify-forms-data.js 의 test-dummy 방식과 같다). 그래도 0이면 forms.json 템플릿 하나로 가짜 등록 항목을 만든다. red-green: 날짜를 2026-10-04 로 고정하거나 registeredList 의 formId 를 모두 지운 상태에서 실패하던 것이 통과하는지 확인한다.
파일: verify/verify-registered.js, .github/workflows/verify-ui.yml

--- [app1-02] P2 (confirmed, workflow-yaml) 화면 검사 관문이 set -e 한 줄이라 드라이버 하나가 넘어지면 나머지 그물이 통째로 걷힌다
증상: 이번처럼 4번째 드라이버(verify-registered)가 데이터 탓으로 넘어지면 뒤의 22개 드라이버 결과와 값싼 관문 셋(ui-tone·test-collector·drive.js)이 몇 시간~며칠 동안 아무것도 안 잰다. 이슈 #383(10-03) → #389·#390(10-04)으로 이틀 연속 같은 꼴이다.
근거: .github/workflows/verify-ui.yml '화면 검사 (관문)' 단계: `set -e` + for 루프(140~158줄 부근). 같은 파일 경보 본문이 스스로 '한 드라이버가 넘어지면 set -e 로 그 뒤 드라이버는 안 돕니다'라고 적고 있다. ui-tone·test-collector·drive.js 는 별도 단계지만 앞 단계 실패로 건너뛰어진다(run 37175886336 에 그 단계들의 출력이 없음).
원인: 루프가 첫 실패에서 멈추고, 뒤 단계에 if: always() 가 없다. 알고 남긴 설계지만 그 결과 실데이터 하나 때문에 그물 전체가 걷힌 일이 반복된다.
수리안: 루프는 실패를 모아 끝까지 돌리고(`fails=""; for f …; do node verify/$f || fails="$fails $f"; done; [ -z "$fails" ] || { echo "❌ $fails"; exit 1; }`) 실패 목록을 경보 본문에 싣는다. 말투·토큰 관문, 수집기 규칙 관문, drive.js 단계에는 `if: always() && steps.<setup>.outcome == 'success'` 를 단다. 그러면 한 드라이버가 빨개도 나머지 결과가 같은 실행에서 보인다.
파일: .github/workflows/verify-ui.yml

--- [app1-03] P1 (confirmed, human-decision) 양식 작성 기능이 사실상 한 공고에만 닿는다 — 열린 정식 등록 78건 중 양식이 붙은 것 1건
증상: '앱에서 원본 양식 작성'(운영 원칙 4·5의 핵심 기능)이 지금 한국외대 학생의 1건(AI 교육지원 멘토 계획서)에서만 열린다. 다른 43개교 학생은 양식 화면에 들어갈 길이 없다. app1-01 의 데이터 쪽 원인이기도 하다.
근거: data/registered.json 집계(2026-10-04 기준): 열린 공고 78건 = formId 1 · noForm 77. noForm 문구는 '자동 등록(검수 전) 2026-09-30 — 양식 스키마화는 검수 후 진행' 42건, 10-01 15건, 09-20 9건 등. collector/report.md:308 '### 🧩 양식 스키마화 — 무료 자동 0건 · API 0건 · 보류 57건'. 보류 사유는 '유료 경로 꺼짐(schematize-config apiEnabled:false)'과 '무료 변환이 원본 표를 옮기지 못함 … (API 경로 대상)'. collector/pending-forms.json: 받기 끝 111 · 스키마화 28 · 대기(받기 끝·미변환) 83. collector/schematize-config.json: apiEnabled false(2026-08-20 크레딧 누수 조사 뒤로 꺼짐).
원인: 자동 등록이 44개교로 넓어져 공고는 빨리 들어오는데, 양식으로 바꾸는 단계는 무료 변환기가 품질 관문에 걸려 매번 0건이다. 유료 경로는 꺼져 있고 세션이 손으로 옮기는 일(원칙 5 ②)도 쌓여 있다. 그래서 양식이 붙은 공고가 마감되면서 줄기만 한다.
수리안: 개발자 결정이 필요하다. ① schematize-config apiEnabled 를 켜고 회당 상한(maxApiCallsPerRun)·잔액을 정하기(리포트의 'API 경로 대상' 목록이 진짜 신청서인지 먼저 한 번 보기 — config 주석 권고) ② 또는 마감이 가까운 공고부터 세션이 손으로 스키마화하는 순번 정하기. 어느 쪽이든 '양식 붙은 열린 공고 수'를 수집 리포트에 숫자로 띄워 0~1로 떨어지면 보이게 한다.
파일: collector/schematize-config.json, collector/schematize-forms.mjs, collector/pending-forms.json, data/registered.json, data/forms.json

--- [app1-04] P1 (confirmed, code) 예외용·서류용 메일 주소를 주 접수처로 띄움 — '📧 이메일 접수' + 큰 '접수 메일 열기' 버튼
증상: 고려대 「송화재단 장학생 선발(학교지원)」(마감 10-12)의 원문은 '온라인 신청'이 기본이고 메일은 '오류 발생 시'에만 쓰는 길이다. 그런데 신청 준비 시트 머리말이 '📧 이메일 접수 — 앱에서 메일 자동 완성'이고 큰 '접수 메일 열기' 버튼이 뜬다. 연세대 「신문고장학금(재난)」(마감 10-13)은 게시판 '새글' 작성·저장이 신청이고 메일은 서류만 받는데, 같은 머리말과 버튼이 뜬다. 학생이 메일만 보내고 본 신청을 빠뜨릴 수 있다.
근거: registered auto-onttid000100000000003863 applyEmailSource: '※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출'. auto-bbssc58944123artclviewdo applyEmailSource: "… '새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨) 관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다". collector/apply-email.mjs judgeLine(49~58줄)에는 조건문·예외 경로 거르기가 없다. 실행 결과: judgeLine('※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출') → ok:true. data.js:505-506 `if (sch.applyEmail) return 'email';` 이 다른 근거보다 먼저 이긴다. app.js:4263 메일 버튼. applyEmailSource 는 앱 어디에도 표시되지 않는다(포털은 app.js:3912 에서 원문 인용을 보여 준다).
원인: 메일 접수 판정이 '제출 동사 + 주소'만 보고, 그 줄이 조건부 예외 경로(오류·불가피 시)인지 서류만 메일로 받는지는 가르지 않는다. 앱은 applyEmail 이 있으면 무조건 이메일 접수로 분류하고, 학생에게 근거 문장을 보여 주지 않는다.
수리안: ① collector/apply-email.mjs judgeLine 에서 `(오류|장애|불가피|부득이|문제)\s*(가\s*)?(발생\s*)?(시|할\s*경우|한\s*경우)` 가 든 줄은 ok:false(why '예외 경로')로 둔다. 같은 공고에 '신청/작성 … 완료' 같은 다른 주 경로가 있고 메일 줄이 '서류'만 말하면 applyEmailRole:'docs' 로 갈라 둔다. 관문에 두 실례 문장을 red-green 으로 넣는다. ② app.js 메일 버튼 아래에 applyPortalSource 처럼 `공고 원문 그대로 — 「applyEmailSource」` 인용을 보여 준다. ③ 소급: 두 건은 admin-apply 로 applyEmail 을 지우거나(예외 경로) 역할을 표시한다.
파일: collector/apply-email.mjs, data.js, app.js, data/registered.json

--- [app1-05] P2 (likely, code) 도우미 원문 검색 재료(search-index.json)에 사이트 메뉴·다른 공고 제목이 섞임
증상: 도우미가 '원문 전문'으로 쓰는 낱말 자루 92건 중 10건이 공고 내용이 아니라 학교 사이트 메뉴나 목록 화면의 다른 글 제목이다. '취업'·'학생포탈'·'eclass'·'포스코' 같은 질문에 엉뚱한 공고가 '찾은 공고'로 섞일 수 있다.
근거: data/search-index.json(10-04): reg-hi-jeju(제주 미래이음)='홍익대학교 hongik 대학과정 대학학사안내 대학공지 … 입학도우미'. auto-rnoticedoarticleno154473(화성시 코나아이)=같은 홍익 메뉴. reg-hi-jeongeup='공고문을 우수인재 포스코청암재단 포스코비전장학생 자생한방병원'. reg-sejong-didim='관련분야 불광장학회'. auto-094bnum5233cate0qidx5233(서울과기대 조형도동문)='민원서비스 서울과기대 홍보관 … 학생포탈 eclass epic'. auto-0ec82aced95admoddocument(서울대 일운)='학생처 서울대포털 입학포털 … 포스코스포츠센터'. 부산대 2건='스킵네비게이션 주메뉴바로가기 pnu 로그아웃'. chat.js:184 는 deep 에 낱말이 맞으면 +1 이고, :192 `filter((m) => m.score > 0)` 라 그것만으로 결과에 들어간다.
원인: collector/build-search-index.mjs 는 껍데기 낱말을 '정식 등록 3건 이상에 나오는 낱말'(tooCommon=2)로만 거른다. 그런데 44개교로 퍼지고 8-30 정리 뒤 학교마다 등록 공고가 1~2건뿐이라 메뉴 낱말이 그대로 남는다. 또 목록 주소(#n-) 공고는 sourceFor 가 목록 화면 글자를 돌려줘 다른 글 제목이 담긴다. 껍데기 걷기(page-boilerplate·makeStripperMulti)는 쓰지 않는다.
수리안: build-search-index.mjs 가 words() 전에 kind-evidence 와 같은 껍데기 걷기(collector/page-boilerplate.mjs · makeStripperMulti)를 쓰게 한다. 문서 빈도는 등록 공고만이 아니라 같은 호스트의 extracted 원문 전부로 센다. 목록 표식·listid 주소(source-link.js linkShape 'marker'/'listid')는 담지 않는다. 관문: 위 실례 id 들에 '대학공지·스킵네비게이션·로그아웃' 같은 메뉴 낱말이 없을 것(red-green). 데이터 오염은 확인했고, 도우미 화면에 실제로 엉뚱한 결과가 뜨는지는 브라우저로 안 눌러 봤다.
파일: collector/build-search-index.mjs, data/search-index.json, chat.js

--- [app1-06] P2 (confirmed, workflow-yaml) 화면 검사 빨간불 경보가 같은 초에 두 번 열림(#389 main · #390 기본 브랜치)
증상: 같은 원인으로 열린 ui-gate 이슈가 둘이다. 관례상 기본 브랜치와 main 에 같은 내용을 동시에 push 하므로, 둘 다 빨간불이면 매번 이슈가 두 개 생길 수 있다.
근거: #389 created_at 2026-10-04T03:57:53Z 본문 '브랜치: `main`' (run 37175484003). #390 created_at 03:57:54Z '브랜치: `claude/nice-heisenberg-WESq5`' (run 37175482635). verify-ui.yml 경보 단계는 `gh issue list --label ui-gate --state open` 로 확인한 뒤 만든다. 두 실행이 동시에 확인하면 둘 다 '없음'을 본다.
원인: 라벨로 중복을 막는 확인과 만들기가 원자적이지 않다. concurrency 는 ref 마다 따로라 두 브랜치 실행이 나란히 돈다.
수리안: 이슈 만들기는 기본 브랜치 실행만 한다(main 실행은 열린 이슈가 있으면 코멘트만 단다). 또는 만든 뒤 다시 목록을 보고 번호가 작은 것 하나만 남기고 나머지를 닫는다. 닫기 단계는 이미 기본 브랜치에서 라벨 전체를 닫으므로 둘 다 닫히긴 한다.
파일: .github/workflows/verify-ui.yml

--- [app1-07] P2 (confirmed, workflow-yaml) 키워드 질문 검사(verify-essay-ask)가 주 1회 학습 로봇에만 걸려 있다 — 새 양식이 그 로봇을 넘어뜨려야 안다
증상: 수집 로봇의 스키마화가 forms.json 에 새 서술형 칸을 넣으면 '종류를 못 알아본 칸(generic)'이 생길 수 있다. 그래도 push CI·데이터 관문은 통과하고, 월요일 학습 로봇이 통째로 실패하고 나서야 안다. 9-29 에 실제로 그랬다(#317 → 2b4d99a 로 고침).
근거: .github/workflows/essay-playbook.yml:60-62 에서만 `node verify/verify-essay-ask.mjs`·`verify-essay-guard.mjs` 실행. verify-ui.yml 에는 verify-essay-submit.mjs(94줄)만 있다. collect-scholarships.yml:131·browser-collect.yml:97 이 schematize-forms.mjs 로 forms.json 을 쓰지만, 데이터 관문(236-237줄·171-172줄)은 test-collector·audit 뿐이다. test-collector·audit-data 에는 essayAskFor·generic 검사가 없다(grep 0건). 예약 실행 #13(09-29) 실패, 수동 #20(10-01) 성공 https://github.com/seonju5543-web/hanggonggan/actions/runs/36820808592. 지금 로컬 실행은 117/0 통과.
원인: 순수 모듈 검사라 몇 초면 끝나는데 push CI 에도, 양식을 쓰는 로봇의 데이터 관문에도 안 걸려 있다.
수리안: verify-ui.yml 의 순수 모듈 단계에 `node verify/verify-essay-ask.mjs` 와 `node verify/verify-essay-guard.mjs` 를 더한다(paths 의 '*.js' 가 essay-ask.js·form-plan.js 를 잡는다). 스키마화 로봇의 데이터 관문에서는 generic 칸을 경고로 리포트에 올린다. 오류로 두면 그날 자동 등록분이 되돌려지므로 경고로 둔다.
파일: .github/workflows/verify-ui.yml, .github/workflows/collect-scholarships.yml, .github/workflows/browser-collect.yml, verify/verify-essay-ask.mjs

--- [app1-08] P3 (likely, human-decision) 고아 양식 37종 — 어떤 공고도 안 쓰는 템플릿이 forms.json 의 60%, 되돌아온 같은 사업과도 안 이어짐
증상: forms.json 56종 중 37종(약 68KB)을 어떤 정식 등록 공고도 안 쓴다(samil·mju-gosi·sejong-ido·harim·inha-byeonhosan·skku-merit-plan 등). 모든 학생 폰이 첫 화면에서 받는다(forms.js:154). 그중 세종이도인재장학금은 같은 사업 공고가 다시 등록돼 있는데(auto-oardid321881menuno200318, auto-notiphpcodes1301seq10610 는 대기열) 기존 sejong-ido-apply 와 안 이어지고 다시 변환 대기에 들어가 있다. verify-new-forms 의 UI 구간은 이 때문에 영구히 건너뛰어진다.
근거: 집계: templates 56 · 참조 19 · 미참조 37(사용 43,850B / 미참조 68,743B). auto-oardid321881menuno200318 noForm '자동 등록(검수 전) 2026-08-30 — 양식 스키마화는 검수 후 진행'. pending-forms.json 에 auto-eknuackrhomeknusswsubhtm·auto-otice06doarticleno139106·auto-notiphpcodes1301seq10610(세종이도) schematized:false. verify-new-forms 로그 '삼일 UI 구동 건너뜀 … 명지 고시 UI 구동 건너뜀'. (저장소가 얕은 복제라 각 템플릿이 원래 어느 공고용이었는지는 확인 못 함)
원인: 2026-08-30 정식 등록 211건 삭제 때 양식은 남았다. 새로 수집된 같은 사업은 새 id 로 들어와 기존 템플릿을 찾아 잇는 길이 없다.
수리안: 개발자 결정이 필요하다. ① programKey(entry-rules.cjs)로 '같은 사업의 기존 템플릿' 후보를 리포트에 띄우고, 컨펌을 받아 formId 를 잇는다(양식은 해마다 바뀔 수 있으니 자동 연결은 하지 않는다). ② 1년 넘게 안 쓴 템플릿은 보관 파일로 옮겨 앱이 받는 크기를 줄인다. ③ verify-new-forms 는 verify-forms-data 처럼 표본 공고를 심어 UI 를 늘 돌린다.
파일: data/forms.json, collector/pending-forms.json, verify/verify-new-forms.js, forms.js

--- [app1-09] P3 (confirmed, human-decision) 카드 윗줄에 '교외 · 주관 기관 원문 확인' — 앱 내부 표식이 정식 등록 132건 카드에 보인다
증상: 기관명을 못 읽은 공고의 학생 카드 윗줄에 로봇의 자리표시 글자가 그대로 나온다. 제출처 이름(data.js officialChannel)과 지원서 문장(app.js:2087-2092)과 도우미(chat.js:169)는 같은 글자를 '앱 내부 사정'이라며 이미 숨긴다.
근거: what-shows: auto-ent2431266737artclviewdo·auto-onttid000100000000003863 의 '카드 윗줄 「교외 · 주관 기관 원문 확인」'. app.js:401-410 cardOrgLine 이 `${sch.type} · ${prov}` 를 그대로 잇는다(387줄 주석이 '예전처럼 그대로 뜬다'라고 적고 있음). registered provider '주관 기관 원문 확인' 132/152건.
원인: 2026-09-17·18 결정('앱 내부 사정은 학생 화면에 안 적는다')이 제출처·지원서·도우미에는 적용됐는데, 카드 윗줄에는 안 적용됐다.
수리안: 카드 윗줄 표기는 승인된 화면이라 개발자 확인이 먼저다. 안은 cardOrgLine 이 /원문 확인|미확인/ 인 기관명이면 type 만 돌려주는 것이다(officialChannel 의 knownProvider 와 같은 규칙을 한 곳에서 부르기). 바꾸면 드라이버·what-shows 의 기대 글자도 같이 옮긴다.
파일: app.js

--- [app1-10] P3 (confirmed, workflow-yaml) 앱 반영 점검(check-live)이 층2 카드·도우미가 받는 파일을 안 본다
증상: 앱이 받는 data/kosaf-open.json(app.js:2633)과 data/search-index.json(chat.js:212)이 Pages 에서 404 이거나 낡아도 점검이 모른다. 앱은 둘 다 없으면 조용히 물러난다(층2 카드 0장 · 원문 검색 없음).
근거: .github/workflows/check-live.yml 비교 목록은 sw.js·app.js·notices.json·registered.json·forms.json 과 EXTRA(공고·학과·소식·썸네일·link-check·학교 사진)뿐이다. 두 파일 이름은 없다. CLAUDE.md '새 데이터 파일을 앱이 받게 하면 이 점검에도 넣는다'. (tuition·activities·external·essay-*·gates.json 도 같은 처지지만 다른 묶음 몫)
원인: 파일이 앱에 붙을 때 check-live 목록을 같이 고치지 않았다.
수리안: check-live.yml 의 EXTRA 에 data/kosaf-open.json(items 개수)과 data/search-index.json(items 열쇠 수)을 더한다. 더 나아가 app.js·chat.js·essay.js 의 fetch('data/…') 목록을 관문이 뽑아 check-live 목록과 대조하게 한다.
파일: .github/workflows/check-live.yml

--- [app1-11] P3 (confirmed, human-decision) 포털 신청 시스템 표가 3개뿐 — 44개교 중 41개교의 포털 공고는 길 안내 없이 '원문 확인'
증상: findApplyPortal 이 아는 시스템은 HUFS Ability·종합정보시스템(주소 미확인)·인포21 셋뿐이다. 수집 학교가 44개교로 늘었지만 나머지 학교의 포털 신청 공고는 시스템 이름·딥링크·원문 길 인용 없이 머리말 '🖥 접수 방법은 원문 공고에서 확인' 또는 일반 포털 안내로 남는다.
근거: apply-channel.js:136-140 PORTAL_SYSTEMS 3개. data.js:412-418 PORTAL_SYSTEM_INFO('종합정보시스템' url ''). registered applyPortal 18건 전부 한국외대·경희대·고려대 계열. 원칙 9 대로 '정확한 딥링크만' 넘기는 것이 이 표의 일이다.
원인: 학교를 넓힌 뒤 포털 시스템 이름을 원문으로 확인해 넣는 일(파일 주석: '학교를 늘릴 때 이 목록부터 채울 것')이 안 됐다.
수리안: 포털 신청 공고 원문(collector/extracted)에서 '…에서 신청/로 신청' 꼴의 시스템 이름 후보를 학교별로 세는 리포트를 만든다(collector/portal-candidates.mjs 확장). 개발자 확인을 거쳐 PORTAL_SYSTEMS·PORTAL_SYSTEM_INFO 에 같은 열쇠로 넣는다. 주소는 열어서 제목을 확인한 것만 넣는다(verifiedTitle·verifiedAt).
파일: apply-channel.js, data.js, collector/portal-candidates.mjs

NOTES: 점검 방법: 브라우저 드라이버 13개와 drive.js 는 내 전용 워크트리(HEAD ca94c76e)에서 python 서버 PORT=8781 로 돌렸다. 본 작업 폴더는 건드리지 않았고(git status 깨끗), 워크트리는 끝에 지웠다. 결과는 verify-registered.js 만 rc=1 이고 나머지 12개와 drive.js 는 통과했다. 순수 검사(form-snapshot · verify-essay-ask · verify-essay-submit · verify-essay-guard · verify-apply-guard)도 모두 통과했다. verify-essay-ask.mjs 는 서버가 필요 없다. ⚠️ 원격 최신(06a34cc7·b444b603·3cb8e936)은 내 워크트리보다 뒤 커밋이다. 이 묶음 파일 가운데 바뀐 것은 parse-requirements.js 4줄뿐이라 결론은 같다고 보지만, 그 커밋은 CI 에서도 화면 검사를 못 받았다(app1-01). 정적 점검: index.html 이 싣는 스크립트의 click 처리기가 부르는 함수는 전부 정의돼 있다. 서비스워커 ASSETS 에 앱 스크립트 전부가 있다. 등록 공고의 formId 19종은 전부 forms.json 에 있다. applyEmail 11건은 모두 근거 문장이 있다. applyPortal 18건의 열쇠는 PORTAL_SYSTEM_INFO 와 맞는다. 기능 스위치: AI 초안·AI 도우미는 endpoint 가 비어 설계대로 꺼져 있다. 사소한 것(별도 항목 아님): verify-ui.yml 의 Node 20 사용 경고(actions v4 가 Node 24 로 강제 실행) · drive.js:237 정규식 /s+/ 오타 · 아주대 '바르게장학 …_10.26.(월)까지' 공고(auto-larshipdoarticleno376668)의 deadline 이 null(제목에 마감이 있음 — 마감 추출 묶음 몫). 우선순위 제안: app1-01(관문 복구)을 먼저 고친다. 그러면 멈춰 있던 22개 드라이버가 최신 커밋을 다시 잰다. app1-04(메일 오판 2건, 마감 10-12·10-13)는 마감 전에 데이터를 소급한다. app1-03 은 개발자 결정(유료 변환 켜기 또는 손 변환 순번)이 필요하다.


######## GROUP app2
INVENTORY: .github/workflows/verify-ui.yml (앱 화면 검사)=broken; verify/verify-push-client.js=healthy; verify/verify-notify.js + notify.js=healthy; verify/verify-notify-rules.js + notify-rules.js=healthy; sw.js (서비스워커 · 백그라운드 확인)=degraded; verify/verify-calendar.js (달력·저장)=healthy; verify/verify-supabase.js + supabase-client.js (로그인·기기 동기화)=healthy; verify/verify-settings.js (설정·휴지통·약관)=healthy; verify/verify-resume.js + boot.js·resume.js (첫 실행·이어보기)=healthy; verify/verify-interactions.js + interactions.js (손짓)=healthy; verify/verify-activities.js (대외활동 탭·재단 구역)=healthy; verify/verify-news.js (교내 소식 띠·시트)=healthy; verify/verify-region-city.js (지역 시·군)=healthy; verify/verify-onboard-gaps.js (온보딩·학과 파일)=healthy; verify/ui-tone.mjs=healthy; match-engine.js noticeFilesForProfile / data/notices/*.json (학교별 실시간 공고 받기)=broken; match-engine.js majorsFileFor / data/majors/*.json (학과 목록 받기)=degraded; match-engine.js newsFileFor / data/news/*.json=healthy; assets/schools/photos.json (학교 대표 사진)=healthy; data/activities.json · data/external.json · data/link-check.json · assets/gates/gates.json 등 앱이 받는 단일 파일=degraded; app.js externalNoticesForMe (재단·지자체 새 공고 화면)=degraded; collector/publish-notices.mjs publishBySchool=degraded; tools/merge-json-union.mjs (로봇 장부 병합기)=degraded; .github/workflows/check-live.yml (라이브 점검)=degraded; .github/workflows/push-health.yml=healthy; .github/workflows/push-check.yml (시험 발송)=unknown; .github/workflows/refresh-majors.yml=degraded

--- [app2-F1] P0 (likely, data) 09-30 병합기 200건 상한 사고로 실시간 공고 215건(15개교)이 학생 피드에서 영구 실종 — 10-03 수리는 그날 것만 복구
증상: 경희대 학생 실시간 공고가 3건뿐(09-30 에는 29건) 등, 15개교 학생 화면에서 수집일 08-26~09-30 공고 215건이 사라졌다. 같은 글은 seen.json 에 '봤다'로 남아 다시 수집되지도 않는다.
근거: git: 60ce385a(09-30 01:18 browser-collector) notices.json 460건·33개교 → ab897c3b(09-30 01:31 'collector: seen state update') 정확히 200건·17개교, 200건 전부 foundAt 2026-09-30(= foundAt 내림차순 정렬 뒤 앞 200). 그 시점 병합기 코드 b75c58b6~1:tools/merge-json-union.mjs:67 `if (items.length > 200) items = items.slice(0, 200);`. 다음 발행 17d686370d 에서 data/notices/index.json 학교 34 → 18. 지금(722791c2) 대조 스크립트: 60ce 판 중 262건이 그때 잘렸고 246건이 아직 notices.json 에 없음, 그중 215건은 어떤 학교별 파일에도 없음(가천17·서울과기22·영남15·전북10·전남17·연세17·건국23·광운7·명지9·한국외대36·경희26 …), 전부 수집일 08-26 이후라 60일 규칙 대상이 아님. 10-03 수리 커밋 b75c58b6 메시지: '학교별 파일에 있고 장부에 없는 글은 … 18건(충북대 등 원래 있던 것)' — 09-30 손실은 추적되지 않았다. collect.mjs:412 `fresh = items.filter((i) => !seen[i.url] && !seen[urlKey(i.url)])` 라 다시 안 들어온다.
원인: 합집합 병합기 mergeNotices 가 10-03 전까지 '전체 200건'을 박아 두어, 09-30 01:31 수집 로봇이 pull --rebase 로 브라우저 수집 커밋(01:18)과 notices.json 을 합칠 때 460건이 200건으로 잘렸다(정확히 200·전부 같은 날짜라는 흔적이 slice(0,200) 와 맞다 — 병합기가 실제로 호출됐다는 실행 로그는 확인 못 했다). 그 장부로 학교별 파일이 다시 발행되며 학생 화면에서도 빠졌고, seen.json(별도 합집합)은 그 주소들을 '봤다'로 들고 있어 영영 재수집되지 않는다. 상한 자체는 b75c58b6(10-03)에서 고쳤지만 09-30 데이터는 복구되지 않았다.
수리안: 데이터 복구: 60ce385a 판 notices.json 에서 지금 장부에 없는 글을 dedupeNotices·isAttachmentEntry·dropUnserved·60일 규칙을 그대로 거쳐 되살리고 publishBySchool 로 학교별 파일 재발행(로봇과 같은 길 — 손으로 쓰지 말고 수집기 함수를 불러 쓰는 일회성 스크립트). 원문 제목의 '~9/30까지' 처럼 이미 지난 글은 감사 규칙대로 거른다. 재발 방지 관문: '병합 전후로 학교별 파일 글 수가 줄면 경고'(이미 data ③ 이 300건 표본으로 상한만 잠금).
파일: data/notices.json, data/notices/, tools/merge-json-union.mjs, collector/collect.mjs
이미수리: 원인(200 상한)은 b75c58b6(2026-10-03)로 수리됨 — 09-30 손실분 데이터 복구는 안 됨

--- [app2-F2] P1 (likely, code) 서비스 44개교 중 5곳(한양·홍익·연세 미래·고려 세종·동국 WISE)은 학생 실시간 공고가 0건 — 한양은 리포트가 '정상 15건'이라 조용하다
증상: 그 학교 학생 홈의 실시간 공고 구역이 비어 있다. 브라우저 실측(722791c2): 한양 got 0 · 홍익 0 · 연세 미래 0.
근거: 정적 점검: data/notices/n1b3og5n.json(한양)·nv8pha4(홍익)·n1if6uwu(연세 미래)·n1ch7t87(고려 세종)·n2we95k(동국 WISE) 없음, data/notices/index.json 36개교에 없음 → noticeFallbackNeeded=false(match-engine.js:1543) 라 옛 파일도 안 받고 빈 목록. collector/report.md(10-04): '### 한양대학교 상태: ✅ 정상 (실공고 15건 감지)' 인데 notices.json 의 한양 0건 — seen.json 의 hanyang.ac.kr 24건이 전부 2026-07~08-12(파킹 전)라 15건이 모두 '이미 본 글'로 걸러짐(collect.mjs:412). 홍익: browser-report '⚪ 링크 143 · 장학 공고 0 · https://www.hongik.ac.kr/kr/newscenter/notice.do', seen 마지막 08-29. 나머지 셋: schools.json boardUrl null('개발자가 장학공지 주소 제공 필요').
원인: ① 한양: 08-30 파킹 때 피드에서 빠진 글의 주소가 seen.json 에 남아, 09-29 복원 뒤 게시판 첫 화면의 글이 전부 '이미 본 글' 취급 — 새 글이 올라올 때까지 0건(리포트는 '감지 수'만 세서 정상으로 보인다). ② 홍익: 브라우저 수집기가 일반 공지 게시판에서 장학 글을 0건으로 읽음(키워드·게시판 선택 문제 추정 — 원문 미확인). ③ 분교 셋: 게시판 주소 미설정(알려진 공백).
수리안: 수집기(다른 그룹과 대조): 복원 학교처럼 '피드에 없는데 seen 에만 있는' 글은 60일 창 안이면 다시 들이는 규칙(또는 복원 시 그 학교 seen 항목 정리) + 리포트 상태 줄을 '감지 n · 새로 실음 m · 피드 k'로. 홍익은 probe-run 으로 장학 게시판 확인. 분교 셋은 개발자에게 주소 요청(리포트 「개발자에게 요청」). 관문: 서비스 학교인데 학교별 파일도 '주소 없음' 표시도 없는 학교를 감사 경고로.
파일: collector/collect.mjs, collector/seen.json, collector/schools.json, collector/browser-targets.json

--- [app2-F3] P1 (confirmed, code) verify-ui 가 실데이터 의존 드라이버 하나 때문에 4회 연속 빨간불 — 이 그룹 드라이버 10개가 CI 에서 안 돌고 있다
증상: 화면 검사 관문이 10-04 03:55 부터 계속 실패. set -e 라 4번째(verify-registered.js) 뒤의 드라이버 22개·ui-tone·test-collector(DOC_GATES)·drive.js 가 전부 건너뛰어진다. 그 사이 홈 첫 화면 '교내 소식 띠'(98cc4bbc·722791c2)가 배포됐는데 CI 로는 한 번도 검증되지 않았다.
근거: runs 420 https://github.com/seonju5543-web/hanggonggan/actions/runs/37175482635 · 421 .../37175484003 · 422 .../37175886336 · 423 .../37177486534 — 로그 '조병두 구간 건너뜀 … 대체 구동(마감 전 양식 공고): 없음 | 문서 생성: false' → 'ERRORS: 마감 전 양식 공고를 하나도 구동하지 못했습니다'(verify/verify-registered.js:227). 실데이터: formId 있는 등록 공고 19건 중 마감 전·성균관대 학생에게 보이는 것이 없다(hufs-ai-mentor 10-30 은 schoolOnly 한국외대, reg-dongsan 10-02 마감). verify-ui.yml:145 `set -e`. 같은 실패가 10-03 17:35~17:52(403~408)에도 있었고 18:03~19:28 은 성공(데이터 경계에서 흔들림). 로컬(722791c2, PORT=8791)에서 이 그룹 11개 드라이버·ui-tone·notify-rules 전부 exit 0.
원인: verify-registered.js 의 대체 구동이 '지금 실데이터에 마감 전 양식 공고가 있어야 한다'에 기대는 관문이다(CLAUDE.md '실데이터에 기댄 고정 검사를 관문에 두지 말 것'). 마감이 지나 후보가 0이 되자 영구 빨간불이 됐고, 한 드라이버 실패가 set -e 로 나머지 그물을 통째로 걷었다.
수리안: ① verify-registered.js 대체 구동을 픽스처 주입식으로(중복 제거 블록처럼 마감을 오늘+30일로 바꾼 등록 공고 사본을 page.evaluate 로 심어 구동) — 데이터가 바뀌어도 안 깨지게, red-green 확인. ② verify-ui.yml '화면 검사' 루프를 set -e 대신 실패를 모아 끝에서 exit 1 로 — 한 드라이버가 넘어져도 나머지 결과가 보이게(이슈 본문의 '그 뒤 드라이버는 안 돕니다' 문구도 갱신).
파일: verify/verify-registered.js, .github/workflows/verify-ui.yml

--- [app2-F4] P2 (confirmed, code) 학교별 공고 발행기가 0건이 된 학교의 옛 파일을 안 지워, 충북·충남·방통 학생은 09-30 에 굳은 공고를 본다
증상: 충북대·충남대·한국방송통신대 학생 실시간 공고가 '갱신 2026-09-30' 의 6·8·4건으로 굳어 있다(색인에는 없음). 새 글이 하나 오면 파일이 그 한 건으로 덮여 지금 보이는 글들이 한꺼번에 사라진다.
근거: 고아 파일: data/notices/n16l2078.json(충북 updatedAt 2026-09-30 · 6건) · n1uf7bji(방통 4건) · nl1xm19(충남 8건) — index.json 36개교에 없음, notices.json 에도 그 학교 글 0건. 브라우저 실측(722791c2): 충북대학교 {got 6, upd 2026-09-30} · 충남 8 · 방통 4. 코드: collector/publish-notices.mjs:146 publishBySchool 은 글이 있는 학교 파일만 쓰고 폴더의 다른 파일을 지우지 않는다(index.json 만 새로 씀). 09-05 커밋 92c02463 은 '학교별 파일 41 → 2개' 를 손으로 정리했다(자동 정리 없음).
원인: publishBySchool 이 '이번 발행에 없는 학교 파일 삭제' 단계를 갖고 있지 않다. 09-30 병합 손실(app2-F1)로 세 학교가 장부에서 0건이 되자 마지막 판 파일이 그대로 남아 계속 서빙된다.
수리안: publishBySchool 이 발행 뒤 폴더의 *.json 중 이번 색인에 없는 파일을 지우게(또는 빈 items 로 덮어 updatedAt 을 갱신) + 워크플로 git add 가 삭제도 담는지 확인(`git add data/notices` 는 삭제를 담는다). 관문: 'data/notices/ 파일 집합 == 색인 파일 집합'. F1 데이터 복구와 같은 커밋에서 처리하면 세 학교 글이 장부로 돌아온다.
파일: collector/publish-notices.mjs, data/notices/n16l2078.json, data/notices/n1uf7bji.json, data/notices/nl1xm19.json

--- [app2-F5] P2 (likely, code) 연세대학교 미래캠퍼스(서비스 학교)·상명 천안·경찰대학은 학과 파일이 없어 학과 추천이 전국 공통 목록으로 조용히 물러난다
증상: 연세 미래 학생이 온보딩에서 학과를 치면 그 학교에 없는 학과가 추천된다(2026-08-02 '경희대에 일→일어일문학과' 사고와 같은 유형). 상명 서울 학생 추천에는 천안캠퍼스 학과(만화ㆍ애니메이션학과·무대미술학과·가구조형전공 등)가 섞여 있다.
근거: 정적 점검: data/majors/n1if6uwu.json(연세 미래) 없음, data/majors/index.json 209곳에 연세 미래·상명 천안·경찰대학 없음, data/majors.json bySchool 에도 없음(updatedAt 2026-08-06). app.js:1004 majorSuggestions `const pool = own || MAJORS_COMMON` · data.js MAJORS_BY_SCHOOL 손 목록은 한국외대뿐. 상명대학교 파일 120과에 천안 학과 포함. collector/majors.mjs BRANCH_MAP 은 '연세대학교 미래캠퍼스'·'상명대학교 천안캠퍼스' 표기만 앎. refresh-majors.yml 은 지금까지 정상 실행 0회(6회 전부 09-30 push 0초 실패).
원인: 커리어넷이 두 분교를 BRANCH_MAP 이 모르는 이름으로 주는 것으로 보인다 — 정규식이 '○○캠퍼스' 꼴이면 본교로 합치고(상명 천안 학과가 서울로 합쳐진 흔적), 아예 다른 꼴이면 UNIVERSITIES 에 없어 발행에서 빠진다(publish-majors 의 skipped). 커리어넷 원래 이름은 이 샌드박스에서 확인 못 했다. 관문 「분교 이름이 로봇과 앱에서 같은가」·verify-onboard-gaps 는 경희대만 재서 못 잡는다.
수리안: refresh-majors 를 한 번 실행해 로그의 skipped·커리어넷 원래 이름을 보고 BRANCH_MAP/UNIV_ALIASES 에 이어 준다(새 표를 만들지 말 것). 관문: SERVED_SCHOOLS 전부에 학과 파일이 있는지(없으면 경고 + 리포트). 실행에 CAREERNET_API_KEY 시크릿이 필요하면 사람 확인.
파일: collector/majors.mjs, collector/publish-majors.mjs, data/majors/, .github/workflows/refresh-majors.yml

--- [app2-F6] P2 (confirmed, code) 홈 「재단·지자체 새 공고」가 마감 지난 글(최대 4개월 전 마감)을 그대로 보인다
증상: 모든 학생 홈의 재단 구역 '더보기' 안에 2026-05-29·06-24·07-31·09-18·10-02 마감 글 6건이 '마감' 딱지로 섞여 있다. 대외활동 탭은 같은 경우를 마감 다음 날 숨긴다.
근거: app.js:3238 externalNoticesForMe 의 filter 는 `n.url && n.host && !n.school && !isRegistered(n.url)` 뿐 — 마감 조건 없음. 반면 activitiesForMe 는 `(!n.deadline || dday(n.deadline).days >= -CLOSED_KEEP_DAYS)`(CLOSED_KEEP_DAYS=1, app.js:331). data/external.json 48건 중 deadline < 2026-10-04 인 것 6건(송파구 상반기 06-24·해외문화체험 05-29·슬로바키아 정부초청 07-31·음성군 09-18 둘·송파 하반기 10-02), 정렬상 8·9·13·14·15·48번째.
원인: 재단 구역은 '로봇이 60일 뒤 지운다'에만 기대고 앱이 마감 규칙을 적용하지 않는다. 재단 게시판은 지난 공고도 목록에 남아 수집일(09-30)이 새로 찍힌다.
수리안: externalNoticesForMe 에 activitiesForMe 와 같은 마감 규칙(CLOSED_KEEP_DAYS) 한 줄 — 규칙은 베끼지 말고 같은 상수·dday 를 쓴다. verify-activities.js ⑤ 에 '마감 지난 재단 글은 안 보인다' 항목 추가(red-green).
파일: app.js, verify/verify-activities.js

--- [app2-F7] P2 (confirmed, code) 합집합 병합기에 대외활동·재단 장부 규칙이 없다 — .gitattributes 는 jsonunion 이라 적혀 있지만 실제로는 충돌로 끝난다
증상: data/activities.json 을 서로 다른 대기줄 로봇(collector 줄의 수집·공공 API·관리자 vs eligibility-ai 줄의 eligibility-fill)이 동시에 저장하면 병합기가 '규칙 없음'으로 손을 떼 rebase 3회 실패 → 그 실행 결과가 통째로 버려질 수 있다(external·seen-activities·seen-external 도 같음).
근거: 재현(스크래치): `node tools/merge-json-union.mjs b.json o.json t.json data/activities.json` → '[merge-json-union] 규칙 없는 파일이라 자동 병합하지 않음: data/activities.json' exit=1. tools/merge-json-union.mjs:213 RULES 에 activities/external 정규식 없음(`(^|\/)notices\.json$`·`(^|\/)seen\.json$` 은 이 이름들에 안 걸린다). .gitattributes: 'data/activities.json merge=jsonunion' 등 넷. 쓰는 워크플로: collect-scholarships·open-api·admin-apply(concurrency collector) · eligibility-fill(concurrency eligibility-ai, 232행 git add data/activities.json). 실제 실패 사례는 이번에 찾지 못했다(잠재 위험).
원인: 09-25·09-26 에 .gitattributes 줄만 넣고 병합기 RULES 에 대응 규칙을 안 넣었다.
수리안: RULES 에 activities/external 은 mergeNotices 계열(단 capNotices 를 그대로 쓰면 학교 없는 전국 글이 한 열쇠로 묶여 40건으로 잘리므로 상한 없이 dedupe 만, 또는 수집기의 활동 상한 함수를 불러 쓰기), seen-activities/seen-external 은 mergeSeen 을 붙인다. 관문: .gitattributes 의 jsonunion 파일마다 RULES 가 있는지 대조.
파일: tools/merge-json-union.mjs, .gitattributes

--- [app2-F8] P2 (confirmed, workflow-yaml) 화면 검사 경보가 기본 브랜치·main 동시 실패 때 이슈를 두 개 만든다 (#389·#390)
증상: 같은 실패에 🚨 이슈가 둘 열려 있다 — 알림을 무시하게 만드는 유형.
근거: #389(branch main, run 37175484003)와 #390(branch 기본, run 37175482635) 둘 다 2026-10-04T03:57:53~54Z 생성. verify-ui.yml:243~ '열린 ui-gate 이슈가 있으면 코멘트, 없으면 생성' — 두 실행이 거의 같은 초에 '없음'을 보고 각자 생성. 같은 커밋이 늘 두 브랜치에 같이 올라가므로(CLAUDE.md 세 곳 push 관례) 반복될 구조.
원인: 라벨 확인과 생성 사이 경쟁 상태(두 브랜치 실행이 서로 다른 concurrency 그룹 verify-ui-${{ github.ref }}).
수리안: 이슈를 여는 것은 기본 브랜치 실행만(닫기와 같은 조건) 하거나, main 실행은 몇 초 늦춰 다시 조회 후 코멘트만. 지금 열린 #389·#390 은 다음 기본 브랜치 초록불에 같이 닫힌다(닫기 루프가 전부 닫음).
파일: .github/workflows/verify-ui.yml

--- [app2-F9] P3 (confirmed, workflow-yaml) 라이브 점검이 앱이 받는 대외활동·재단 파일을 안 보고, 어긋남 이슈를 스스로 닫지 않는다
증상: data/activities.json·data/external.json 이 배포에서 빠지거나 404 여도 check-live 는 초록불(앱은 조용히 빈 구역). 10-01 어긋남 이슈 #350 이 이후 성공 실행(10-02·10-03·10-04)에도 열려 있다.
근거: .github/workflows/check-live.yml:82 `for f in sw.js app.js data/notices.json data/registered.json data/forms.json $EXTRA` + EXTRA(학교별 공고·학과 2·소식·사진·link-check) — activities/external 없음. CLAUDE.md '새 데이터 파일을 앱이 받게 하면 이 점검에도 넣는다'. 어긋남 알림 단계는 gh issue create 만 있고 라벨·닫기 단계 없음(#350 열린 채, run 36851872513 이후 81번까지 성공).
원인: 대외활동(09-25)·재단(09-26) 파일을 앱에 붙일 때 점검 목록을 같이 안 늘렸다 · 경보에 라벨/자동 닫기를 안 붙였다(verify-ui·push-health 와 다름).
수리안: EXTRA 에 data/activities.json·data/external.json(그리고 index.html·style.css)을 추가하고 count() 가 items 를 세는지 확인 · 어긋남 이슈에 라벨(live-mismatch)을 달아 열린 것이 있으면 코멘트, 성공이면 닫기.
파일: .github/workflows/check-live.yml

--- [app2-F10] P3 (confirmed, code) 서비스워커 캐시 번호(v221)를 CSS·화면 변경 뒤에 안 올렸다
증상: 네트워크가 3.5초를 넘는 환경에서 설치된 앱이 옛 style.css 와 새 app.js(교내 소식 띠 등)를 섞어 낼 수 있다.
근거: sw.js:26 `const CACHE = 'handaejang-v221'`(마지막 변경 5f58a228) 이후 style.css·app.js·index.html 변경 f22df5b1·bfa8a660·98cc4bbc·722791c2. sw.js 머리말 '🔴 v105 — style.css 를 고쳤으면 여기도 올려야 한다'. test-collector 에 번호 인상 관문 없음.
원인: 번호 인상이 사람 기억에 맡겨진 관례이고 관문이 없다.
수리안: 다음 화면 배포 때 번호 인상 + (선택) 관문: 마지막 sw.js 변경 이후 style.css/app.js/index.html 이 바뀌었으면 경고.
파일: sw.js

NOTES: 점검 기준: 로컬 HEAD 는 ca94c76e 였으나 원격 기본 브랜치가 4111b998·98cc4bbc·722791c2(교내 소식 띠 화면) 등으로 앞서 있어, `git fetch origin claude/nice-heisenberg-WESq5` 로 원격 참조만 갱신하고(작업 트리·브랜치는 손대지 않음) 스크래치 워크트리를 722791c2 에 두고 드라이버를 돌렸다. 워크트리는 끝에 지웠고 메인 체크아웃 상태는 깨끗하다. 이 그룹의 드라이버 11개(push-client·notify·calendar·resume·interactions·settings·supabase·activities·news·region-city·onboard-gaps)와 ui-tone·verify-notify-rules 는 8986661a·722791c2 두 판 모두 로컬에서 exit 0 이었다. push-client·supabase 는 고정 포트(8126/8127·8130~8132)를 쓰므로 워크트리 사본에서만 8792~8796 으로 바꿔 돌렸다. 다만 CI 에서는 10-04 03:55 부터 verify-registered.js(다른 그룹 드라이버) 때문에 이 드라이버들이 돌지 않는다(F3). 앱 화면 쪽 기능에서 깨진 것은 못 찾았다. 문제는 거의 다 앱이 받는 데이터 쪽이다. F1(09-30 손실)·F2(5개교 0건)·F4(고아 파일)는 원인이 수집 로봇과 병합기에 있어 수집 그룹 보고와 겹칠 수 있다. 여기서는 학생 화면 쪽 증거(브라우저 실측: probe-live.cjs 로 학교마다 loadNotices 결과)를 붙였다. 스크래치 스크립트는 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/app2/ 에 있다(check-files.cjs·lost.mjs·lost2.mjs·probe-live.cjs, 로그는 logs/·logs2/). Supabase 의 진짜 Postgres 조건부 PATCH 는 여전히 실서버로 검증한 적이 없다. 코드상 클라이언트가 updated_at 을 쓰고 트리거가 없으므로 시각 비교가 어긋날 근거는 찾지 못했다. push-check(시험 발송)는 2026-09-02 이후 한 번도 실행되지 않았다. push-health 는 매일 초록불이다. 열린 이슈 가운데 이 그룹과 관련된 것은 #389·#390(ui-gate 중복)과 #350(라이브 점검이 자동으로 안 닫힘)이다.


######## GROUP admin
INVENTORY: .github/workflows/admin-apply.yml (관리자 조정 — 버튼의 뒷단)=degraded; .github/workflows/admin-lock-check.yml (관리자 화면 잠금 확인 · 매일)=healthy; tools/admin-apply.mjs=degraded; tools/edit-diff.mjs=degraded; tools/build-admin-preview.mjs=broken; _admin/admin.js=degraded; _admin/index.html · _admin/admin.css · _admin/_headers=healthy; _admin/build.sh=healthy; _admin/README.md (Cloudflare 설정 안내)=degraded; verify/verify-admin.js=degraded; verify/verify-admin-shape.js=healthy; verify/verify-admin-vendor.js=healthy; Cloudflare Pages 관리자 배포 (hanggonggan-admin.pages.dev)=unknown

--- [admin-F1] P1 (confirmed, code) 화면의 일괄 「되돌리기」·「등록 삭제」가 6건 이상이면 항상 실패한다 — 화면이 지울 건수(expect)를 보내지 않는다
증상: 작업대에서 공고를 6건 이상 골라 '되돌리기' 또는 '등록 삭제'를 누르면 Actions 실행이 실패하고, 화면은 '검사를 통과하지 못해 되돌렸습니다'라고 말하며 🚨 관리자 조정 실패 이슈가 열린다. 화면에는 건수를 넣을 칸이 없어 이 기능은 길이 막혀 있다(5건 이하만 된다).
근거: 저장소 쪽: tools/admin-apply.mjs:270-282 guardBulkRemove — 지울 건수가 BULK_MIN(5)을 넘거나 목록의 10%를 넘으면 payload.expect 가 실제 건수와 같아야 통과. revert(307행)·remove(390행)가 부른다. 화면 쪽: _admin/admin.js:1440-1458 bulkAction 시트에 숫자 입력 칸 없음 · 4268행 `await applyAction(kind, { ids }, …)` — expect 를 안 보낸다. `grep -n expect _admin/admin.js` 0건, 2026-09-10 이후 이력에서도 `git log -S expect -- _admin/admin.js` 0건. 작업트리 재현(등록 152건): ACTION=revert ids 6개 → '::error::관리자 조정 실패 — 한 번에 6건을 지우는 요청입니다(지금 152건). … 받은 값: 없음' exit 1 · remove 6개도 같은 문구 exit 1 · remove 5개는 '152 → 147건' exit 0. 관문: verify/verify-admin.js:800-816 은 일괄 confirm 만 재고, test-collector.mjs:9264-9276 은 저장소 쪽만 잰다(expect:6 을 직접 넣어서) — 화면↔저장소 계약을 아무도 안 잰다. 4b9f2528(2026-09-13) 커밋 메시지는 '② 많이 지울 때 건수 직접 입력'이라 적었지만 화면 쪽 구현은 들어가지 않았다.
원인: 2026-09-13 에 '많이 지울 때 건수를 손으로 한 번 더 받는다' 관문을 저장소(admin-apply.mjs)에만 넣고, 그 숫자를 받아 보내는 칸을 화면(bulkAction 시트)에 만들지 않았다. 두 쪽을 함께 재는 검사가 없어 3주간 드러나지 않았다(버튼 경로 자체가 08-09 이후 실행 0회라 실사용으로도 안 걸렸다).
수리안: ① admin.js bulkAction: kind 가 revert/remove 이고 건수가 문턱(5건 초과 또는 등록 수의 10% 초과 — 숫자는 저장소와 한 곳에서 읽게 vendor 로 내보내기)을 넘으면 시트에 '지울 건수를 숫자로 적으세요' 칸을 그리고, 같은 숫자일 때만 실행 버튼을 풀어 payload 에 expect 를 싣는다. ② verify-admin.js 에 '6건 되돌리기 → 보낸 payload.expect === 6' 과 '숫자를 안 적으면 버튼이 잠겨 있다'를 더하고 red-green 확인. ③ 실패 문구는 F10 과 함께 실제 사유를 보이게.
파일: _admin/admin.js, tools/admin-apply.mjs, verify/verify-admin.js

--- [admin-F2] P1 (confirmed, code) 관리자 저장 관문(감사만)이 로봇 데이터 관문(test-collector+감사)보다 약해, 정상적인 관리자 조정 한 번이 이후 모든 수집 로봇의 데이터 관문을 빨간불로 만든다
증상: 관리자 화면에서 ⓐ 대외활동 출처를 짧은 근거(10자 이하)로 추가하거나 ⓑ 소식 출처를 보관→새 주소 추가→옛 주소 되살리기 하거나 ⓒ 날짜가 적힌 접수 문구가 있는 공고의 마감을 고치면, 그 조정은 감사를 통과해 저장된다. 그 뒤 test-collector 를 데이터 관문으로 쓰는 로봇 10개(collect-scholarships·browser-collect·collect-news 등)가 매 실행 빨간불 → 일반 수집은 그 실행의 자동 등록분을 되돌리고(revert-auto), 소식 로봇은 발행분을 되돌린다. 사람이 고칠 때까지 매 실행 반복된다. ⓒ는 학생 카드에 '~8.31' 문구와 다른 D-day 가 함께 뜨는 불일치이기도 하다.
근거: 관리자 관문: .github/workflows/admin-apply.yml:67-71 '데이터 감사' 단계는 `node verify/audit-data.js` 하나. 로봇 관문: collect-scholarships.yml:232-243 `node verify/test-collector.mjs` + `node verify/audit-data.js` 실패 시 `node collector/revert-auto.mjs` · collect-news.yml 같은 꼴(실패 시 data/news 되돌림+이슈). test-collector 를 부르는 워크플로: browser-collect·collect-news·collect-scholarships·deep-fetch·eligibility-fill·kosaf-fetch·link-hunter·rescue-bodies·update-progress·verify-ui. 작업트리 재현(깨끗한 HEAD 는 이미 있던 1건 '대학원 전용' ✕ 만): ⓐ ACTION=activitySource op:add evidence '학교 공지 확인'(8자) → 저장값 evidence '학교 공지 확인' 그대로(admin-apply.mjs:857 `String(s.evidence||'').trim() || …`) · audit exit 0 · test-collector '✕ 주소가 있는 항목은 확인한 근거(evidence)를 적는다'(test-collector.mjs:1666, `x.evidence.length > 10`). 같은 문제를 newsSource 는 이미 날짜 도장을 붙여 막았다(admin-apply.mjs 1000행대 '짧은 근거에도 날짜 도장' · test-collector 2323행). ⓑ newsSource park(경희대 BMSR00040) → add(https://example.ac.kr/new-notice) → unpark → 경희대 boardUrl 2줄 · audit 0 · '✕ 출처 학교는 전부 서비스 학교 · 게시판이 있는 줄은 학교 하나에 하나'(test-collector.mjs:2018) — unpark(admin-apply.mjs:1005-1015)는 이 조건을 안 본다. ⓒ edit reg-sejong-didim deadline 2026-08-31→2026-12-30 → period '신청 2026.7.6(월) ~ 8.31(월) 18:00' 그대로(edit-diff.mjs:237-246 periodAfterDeadline 은 '원문 확인'만 바꾼다) · audit 0 · '✕ 화면 문구의 끝 날짜와 마감이 어긋난 공고가 없다'(test-collector.mjs:9904).
원인: test-collector.mjs 에 실데이터를 읽는 검사(출처 근거 길이·학교당 게시판 하나·문구↔마감 일치·근거 없는 마감 톱니 등)가 남아 있고, 관리자 저장 경로는 그 파일을 돌리지 않는다. CLAUDE.md 가 '실데이터에 기댄 고정 검사를 관문에 두지 말 것'이라 했지만 이 검사들은 로봇 관문 안에 있어, 관리자가 넣은 데이터의 잘못을 관리자 시점이 아니라 다음 로봇 실행이 떠안는다. 그리고 admin-apply.mjs 의 개별 동작(activitySource 근거·newsSource 되살리기·마감 수정의 문구 동기화)이 그 검사들과 같은 조건을 스스로 지키지 않는다.
수리안: ① 근본: 관리자가 고치는 파일에 대한 실데이터 검사(test-collector.mjs:1666·2018·9904 와 같은 절의 실데이터 줄)를 audit-data.js 로 옮겨(오류로) 두 관문이 같은 것을 보게 한다 — 그러면 관리자 저장 시점에 거절되고 화면이 사유를 말한다, 로봇은 남의 잘못으로 되돌리지 않는다. ② 즉시: admin-apply.mjs activitySource add 에 newsSource 와 같은 '· 관리자 화면에서 등록 (날짜 KST)' 도장 · newsSource unpark 에 '그 학교에 이미 boardUrl 이 있으면 거절' · edit 의 마감 변경은 문구의 끝 날짜가 새 마감과 어긋나면 문구도 함께 받거나 거절(edit-diff diffPatch 에 block 표시 — 화면 전후 대조가 미리 막는다). ③ test-collector 에 세 경로를 고정 픽스처로 재는 red-green 관문.
파일: .github/workflows/admin-apply.yml, tools/admin-apply.mjs, tools/edit-diff.mjs, verify/test-collector.mjs, verify/audit-data.js

--- [admin-F3] P2 (confirmed, code) 관리자 화면 미리보기 도구(build-admin-preview)가 2026-09-29부터 깨져 있다
증상: `node tools/build-admin-preview.mjs`(CLAUDE.md '화면만 보려면')가 미리보기 파일을 만들지 못하고 종료 코드 1로 끝난다.
근거: 작업트리 실행: '✕ admin.js 가 가져오는 vendor 모듈을 미리보기가 모릅니다: activity-kind.mjs, news-kind.mjs · tools/build-admin-preview.mjs 의 VENDOR_SRC 에 더해 주세요' · node exit 1 · _admin/preview.html 없음. tools/build-admin-preview.mjs:134-141 VENDOR_SRC 에 url-key·deadline-hint·notice-source·canon-url·page-boilerplate·edit-diff 여섯뿐 — _admin/build.sh:51·53 은 activity-kind.mjs·news-kind.mjs 도 복사한다. admin.js 13-27행이 두 모듈을 import(93299b0 2026-09-29 · 활동 탭, 2026-09-30 소식 탭). `grep -rn build-admin-preview verify/ .github/workflows/` 0건 — 어떤 관문도 이 도구를 안 돌린다.
원인: 활동·소식 탭을 더하며 build.sh 의 vendor 복사에는 넣고 미리보기 도구의 VENDOR_SRC 표에는 넣지 않았다. 표가 두 벌(build.sh cp 줄 · VENDOR_SRC)이고 둘을 대조하는 관문이 없다.
수리안: VENDOR_SRC 에 'activity-kind.mjs': 'collector/activity-kind.mjs', 'news-kind.mjs': 'collector/news-kind.mjs' 추가. 재발 방지: verify-admin-vendor.js(또는 test-collector)에 'build.sh 가 vendor 로 복사하는 .mjs 목록 ⊆ VENDOR_SRC' 대조를 넣거나, 미리보기 도구가 build.sh 의 cp 줄을 읽어 표를 만들게(한 곳).
파일: tools/build-admin-preview.mjs, _admin/build.sh, verify/verify-admin-vendor.js

--- [admin-F4] P2 (likely, human-decision) 관리자 조정이 수집 로봇과 같은 대기줄(collector)에 있어, 기다리는 버튼 요청이 조용히 취소될 수 있고 반대로 버튼이 기다리던 수집 실행을 취소할 수 있다
증상: 수집 로봇(최대 50~56분)이 도는 동안 버튼을 누르면 요청이 대기하고, 그 사이 다른 예약 로봇이 같은 줄에 들어오면 기다리던 관리자 실행이 시작도 못 하고 취소된다. 시작 전 취소라 🚨 실패 알림 단계도 안 돈다. 화면은 6분 뒤 '아직 끝나지 않았어요'만 말하고 결과를 모른다. 거꾸로 버튼 한 번이 대기 중이던 수집 로봇 실행을 밀어내 취소시킬 수 있다.
근거: admin-apply.yml:35-37 `concurrency: group: collector · cancel-in-progress: false`. 같은 그룹: browser-collect.yml:19 · collect-scholarships.yml:25 · open-api.yml:32 · refresh-majors.yml:15 · refresh-tuition.yml:16. 예약: collect-scholarships 22:41·02:41·06:41 UTC(상한 56분) · browser-collect 23:07·03:07(상한 50분) · open-api 19:17·07:17 — 예약은 실제로 수 시간 늦게 돈다(lock-check 05:23 예약 → 10:28 실행). GitHub 동시성 규칙상 같은 그룹에 대기 실행은 하나만 남고 새로 들어온 것이 기존 대기 실행을 취소한다. _admin/admin.js:461-475 waitForRun 은 최대 약 6분(90회)만 기다린다 · 494행 이후 'cancelled' 를 따로 다루지 않는다. CLAUDE.md '대기줄(concurrency)을 하나로 합치지 말 것(대기 실행이 취소된다)'. 별도: 교내 소식 로봇은 다른 줄(collect-news.yml:24 collector-news)인데 collector/news-sources.json 을 저장(collect-news.yml:134)하고, 그 파일은 .gitattributes 병합 규칙이 없어 관리자 newsSource 저장과 동시면 rebase 충돌 가능. 실제 발생 기록은 없다 — 버튼 실행 자체가 08-09 이후 0회.
원인: 데이터 파일 동시 수정을 피하려고 관리자 조정을 수집 로봇 대기줄에 넣었는데, GitHub 대기줄은 '대기 하나'만 허용해 사람 요청과 로봇 실행이 서로를 지울 수 있다. 화면은 취소를 감지·재시도하지 않는다.
수리안: 사람이 정할 일: (가) 관리자 조정을 자체 대기줄(admin-apply)로 빼고 저장 단계의 push 재시도+rebase(이미 있음)로 충돌을 처리 — registered.json 은 병합 규칙이 없으니 충돌 시 '최신 끝에서 admin-apply.mjs 다시 적용'으로 재시도 루프를 바꾼다, 또는 (나) 지금 줄을 유지하되 화면이 run 결론 'cancelled'를 감지하면 '로봇 대기로 취소됨 — 다시 보냄'을 알리고 재요청. 어느 쪽이든 waitForRun 은 'queued/waiting' 상태를 보여 주고 시한을 늘린다.
파일: .github/workflows/admin-apply.yml, _admin/admin.js, .github/workflows/collect-news.yml, .gitattributes

--- [admin-F5] P2 (likely, secret-or-external) 관리자 GitHub 열쇠 만료(2026-11-07)를 미리 알리는 장치가 없다 — 만료되면 모든 버튼이 멈춘다
증상: 열쇠가 만료되면 dispatch 요청이 401 로 거부돼 관리자 화면의 모든 조정·로봇 실행 버튼이 동작하지 않는다. 화면은 사람이 열쇠를 넣을 때 만료일을 '적어 둔' 경우에만 남은 날을 센다.
근거: CLAUDE.md 「노션에 없고 여기서만 사는 것」 ② 'GitHub 관리자 열쇠 만료 2026-11-07(노션 F-4)' — 오늘(2026-10-04 KST)부터 34일. _admin/admin.js:103-120 주석: '화면이 만료일을 스스로 알아낼 방법이 없다 … 안 적어 두었으면 모른다고 말한다' — 만료일은 브라우저 저장소(handaejang.admin.key.expires)에만 있다. 이 날짜를 보고 이슈를 여는 워크플로는 찾지 못했다(admin-lock-check·robot-heartbeat 는 열쇠를 안 본다).
원인: fine-grained 열쇠의 만료일을 브라우저도 Actions 도 읽을 수 없고, 날짜가 사람 기억(CLAUDE.md·노션)에만 있다.
수리안: 사람: 11-07 전에 같은 권한(Actions 쓰기 + Contents 읽기)으로 열쇠를 다시 만들어 화면에 넣고 만료일을 적는다. 자동화: 만료일을 저장소 상수(예: 설정 파일)로 두고 robot-heartbeat 나 admin-lock-check 가 14일 전부터 이슈를 열게 한다.
파일: _admin/admin.js, .github/workflows/admin-lock-check.yml

--- [admin-F6] P2 (likely, config) README 의 Cloudflare 빌드 감시 경로 목록이 build.sh 가 복사하는 원본보다 7개 적다 — 그 원본만 바뀐 날 관리자 화면이 옛 규칙을 쓴다
증상: Cloudflare 가 README 목록대로 설정돼 있다면, edit-diff.mjs·notice-source.mjs·canon-url.mjs·news-kind.mjs 등만 고친 커밋은 관리자 화면을 다시 빌드하지 않는다. 그러면 화면의 vendor 사본이 저장소(admin-apply.mjs)와 다른 규칙을 쓴다 — admin.js 주석이 '같은 파일로 계산해야 전후 대조가 거짓말을 안 한다'고 한 바로 그 어긋남.
근거: _admin/README.md:43-53 '아래 여섯 줄' 목록: _admin/* · data.js · apply-channel.js · forms.js · verify/entry-rules.cjs · collector/url-key.mjs · collector/activity-kind.mjs(일곱 줄). _admin/build.sh 복사 원본: apply-channel.js·data.js·forms.js·form-plan.js·url-key·deadline-hint·notice-source·canon-url·page-boilerplate·tools/edit-diff.mjs·activity-kind·news-kind — README 에 없는 것: form-plan.js, collector/deadline-hint.mjs, collector/notice-source.mjs, collector/canon-url.mjs, collector/page-boilerplate.mjs, tools/edit-diff.mjs, collector/news-kind.mjs. verify-admin-vendor.js 는 verify-ui.yml 감시 범위만 대조하고 README 목록은 안 본다. 지금 실제 피해: collector/news-kind.mjs 가 2026-10-04 04:03(b444b60)에 바뀌었고 마지막 _admin/ 변경은 10-03 17:33(b217b31)이지만, 바뀐 것은 내보내는 NEWS_KINDS 가 아니라 판정 줄이라 지금은 무해. 실제 Cloudflare 설정은 이 세션에서 확인 불가(pages.dev 프록시 403).
원인: vendor 원본이 늘 때 build.sh·verify-ui.yml 감시 목록은 고쳤지만 사람이 Cloudflare 에 옮겨 적는 README 목록은 고치지 않았고, 그 목록을 재는 관문이 없다.
수리안: README 목록을 build.sh 의 cp 원본 전부로 고치고(또는 'collector/*.mjs'처럼 넓혀 적고), verify-admin-vendor.js 에 'build.sh 원본 ⊆ README 감시 목록' 대조를 더한다. 사람: Cloudflare Settings → Build watch paths 를 새 목록으로 갱신.
파일: _admin/README.md, _admin/build.sh, verify/verify-admin-vendor.js

--- [admin-F7] P3 (confirmed, workflow-yaml) CI 에서 관리자 화면 드라이버가 앞 드라이버 하나만 넘어져도 통째로 건너뛰어진다 — 지금 그 상태다
증상: verify-ui.yml 의 화면 검사 반복문이 `set -e` 라 앞의 드라이버(지금은 verify-registered.js)가 실패하면 verify-admin.js·verify-admin-shape.js 를 포함한 뒤 드라이버 9개가 돌지 않는다. 관리자 화면이 깨져도 이 동안은 CI 가 모른다.
근거: .github/workflows/verify-ui.yml:143-158 `set -e; for f in … verify-registered.js … verify-admin.js verify-settings.js verify-admin-shape.js …` · 기본 브랜치 run 37175482635(2026-10-04 03:55)·37175886336(04:03) 로그: '── verify-registered.js … ERRORS: 마감 전 양식 공고를 하나도 구동하지 못했습니다 ##[error]Process completed with exit code 1' 뒤 다음 드라이버 없음(이슈 #390 에 댓글). 같은 문제를 ui-tone 단계에서 이미 겪고 '맨 뒤로' 옮긴 기록이 같은 파일 160-170행 주석에 있다. 로컬(작업트리)에서는 verify-admin ✅249·❌0, verify-admin-shape 통과.
원인: 한 단계 안에서 드라이버를 순서대로 돌리며 첫 실패에서 멈춘다 — 실패 원인은 다른 묶음(verify-registered 의 실데이터 의존)인데 관리자 검사까지 가린다.
수리안: 반복문을 '전부 돌리고 실패 목록을 모아 끝에서 exit 1' 꼴로 바꾼다(실패 드라이버 이름을 이슈 본문에 함께). verify-registered 의 실데이터 의존은 해당 묶음에서 따로 고친다.
파일: .github/workflows/verify-ui.yml

--- [admin-F8] P3 (confirmed, workflow-yaml) 잠금 확인 로봇은 운영 주소 하나만 보고, '판정 불가'가 며칠 이어져도 아무 알림이 없다
증상: ① README·이슈 본문이 '미리보기 주소(*.hanggonggan-admin.pages.dev)는 다른 호스트라 따로 잠가야 한다'고 경고하지만 로봇은 운영 호스트만 연다. ② 접속 불가·예상 밖 응답이면 verdict=unknown 으로 초록불이 되고 이슈도 안 열려, 그 상태가 계속돼도 아무도 모른다.
근거: .github/workflows/admin-lock-check.yml:49 `BASE="${IN_URL:-https://hanggonggan-admin.pages.dev}"` 한 곳만 · 58행 경로 3개. 93-105행: open 이 아니면 locked 또는 unknown — unknown 은 로그만 남기고 성공. 110행 이슈는 open==1 일 때만. _admin/README.md:67·72 '운영 주소와 미리보기 주소는 서로 다른 호스트 이름' · 'Subdomain * …'. 최근 실행(37116530106·36856921356)은 locked 라 지금 문제는 없다.
원인: 검사가 '운영 주소가 열렸는가' 하나에 맞춰져 있고, 미리보기 별칭(예: main.hanggonggan-admin.pages.dev — 운영 브랜치가 claude/nice-heisenberg-WESq5 라 main 은 미리보기)과 연속 unknown 을 다루지 않는다.
수리안: 확인 대상에 미리보기 브랜치 별칭(main.hanggonggan-admin.pages.dev)을 더하고(200+관리자 HTML 이면 open), unknown 이 연속 N일이면 이슈를 연다(장부는 이슈 라벨이나 작은 상태 파일).
파일: .github/workflows/admin-lock-check.yml

--- [admin-F9] P3 (confirmed, code) 화면이 실패 사유를 늘 '검사를 통과하지 못해 되돌렸습니다'로 말한다 — 입력 거절·취소도 같은 문구
증상: admin-apply.mjs 가 입력을 거절한 경우(F1 의 건수 요구, '이미 그 갈래입니다', '그 주소의 글이 소식 파일에 없습니다' 등)나 실행이 취소된 경우에도 화면은 '검사를 통과하지 못해 되돌렸습니다'라고 말한다. 사람이 감사 문제로 오해하고 실행 로그를 열어야만 진짜 사유를 안다(CLAUDE.md 5번 '확인 안 한 원인을 단정하지 않는다'와 어긋남).
근거: _admin/admin.js:490-499 — `if (run.conclusion === 'success') … ; jobShow(`${label} — 검사를 통과하지 못해 되돌렸습니다. …`)` 결론 종류를 가르지 않는다. admin-apply.mjs 의 fail() 은 '::error::관리자 조정 실패 — …' 주석(annotation)을 남기므로 API 로 읽을 수 있다. admin-apply.yml:126-155 실패 알림 이슈 본문도 '감사를 통과하지 못하면 되돌리도록'으로 감사 탓을 기본으로 적는다.
원인: 버튼 뒷단이 처음엔 '감사 실패'만 실패 경로였는데, 이후 admin-apply.mjs 에 입력 거절 관문이 많이 늘었고 화면 문구는 그대로다.
수리안: waitForRun 뒤 run 의 check-run annotations(또는 job 의 실패 단계 이름 — '요청 내용 적용' vs '감사 실패를 실패로 끝낸다')를 읽어 사유를 그대로 보여 주고, conclusion 'cancelled' 는 '대기 중 취소됨'으로 따로 말한다. 이슈 본문도 실패 단계 이름을 적게.
파일: _admin/admin.js, .github/workflows/admin-apply.yml

--- [admin-F10] P3 (confirmed, human-decision) 버튼 경로(Actions 의 관리자 조정)는 08-09 이후 실전 실행 0회 — 그 사이 동작 14종 추가·워크플로 수정은 실행으로 증명되지 않았다
증상: 관리자 화면 버튼으로 돈 실행은 2026-08-09 한 번뿐이다. 그 뒤 활동·소식·사진 동작 14종과 워크플로 변경(ref: github.ref_name · 저장 파일 목록 확장 · 중복 with: 수리)이 들어갔지만 Actions 에서 실제로 돈 적이 없다.
근거: actions_list admin-apply.yml: total_count 7 — dispatch 1회(31318681754 · 2026-08-09 success) + push 실패 6회(09-30, jobs 0 = 잘못된 워크플로 파일). data/admin-log.json 11건 중 08-09 1건만 버튼, 나머지 10건(09-23 josehyeon 18건 수정·합치기 4건, 09-24·09-25 이선주-세션, 10-03 Claude)은 세션의 로컬 실행. 이 세션의 작업트리에서 21개 동작 대부분을 돌려 exit 0·감사 0 은 확인했다(Actions 환경·권한·push 재시도는 미확인).
원인: 관리자 작업이 화면 버튼이 아니라 채팅 세션의 로컬 실행으로 처리되어 왔다(4b9f2528 커밋도 '관리자 조정은 평생 1회 쓰였고'라고 적음).
수리안: 사람이 정할 일: 해가 없는 동작 하나(예: autoRegister 를 현재 값 그대로 — 단 '아무것도 바뀌지 않았습니다'로 실패하니, 또는 newsKind 를 같은 갈래로 되돌리는 짝 두 번)를 화면에서 한 번 눌러 Actions 경로·저장·deploy-sync 연결을 실측하거나, admin-apply.yml 에 dry_run 입력을 두어 저장 직전까지 돌려 보는 점검 버튼을 만든다.
파일: .github/workflows/admin-apply.yml, data/admin-log.json

--- [admin-F11] P3 (confirmed, none-already-fixed) 2026-09-30 관리자 조정 워크플로 파일이 1시간 동안 무효였다(중복 with:) — 이미 고쳐짐
증상: 09-30 00:56~01:56 UTC 사이 push 마다 '.github/workflows/admin-apply.yml' 이름의 실패 실행이 6번 생겼다. 그 시간에 버튼을 눌렀다면 dispatch 가 거부됐을 것이다.
근거: runs 36652725658·36652729517·36652729679(00:56)·36655321046(01:29)·36655768143(01:34)·36656324138(01:41) — event push, conclusion failure, jobs 0개. 원인 커밋 5e69767c(00:56 '로봇 대기줄 — 옛 커밋에서 시작하지 않는다' · ref: github.ref_name 추가) · 수리 b3414caf(01:56 '워크플로 5개의 중복 with: (GitHub 이 파일을 거절하던 차단급) … 관리자 버튼 포함' + 관문 '어느 단계에도 with: 둘 이상 없다'). 그 뒤 실패 실행 없음 · 현재 파일 44-49행 with: 하나.
원인: 체크아웃 단계에 with: 블록을 하나 더 붙여 YAML 키가 중복됐다.
수리안: 없음 — 수정과 관문이 들어갔다. 다만 버튼(dispatch) 실행이 그 뒤 없어 '수정은 들어갔으나 아직 실행으로 증명 안 됨'(F10 참조).
파일: .github/workflows/admin-apply.yml
이미수리: b3414cafb5d9c89d14f04cf82ce4246e03e37dde

--- [admin-F12] P3 (confirmed, workflow-yaml) 워크플로 입력 설명에 소식 동작 6종이 빠져 있다
증상: Actions 화면의 '작업' 입력 설명이 실제로 받는 동작 목록과 다르다(사람이 손으로 돌릴 때 소식 동작을 모른다).
근거: .github/workflows/admin-apply.yml:19-22 주석 '새 동작을 만들면 여기에도 더한다' · 설명 문자열은 confirm…activitySource 까지 15종. tools/admin-apply.mjs 의 case 는 newsKind(880)·newsHide/newsUnhide(904-905)·newsThumbOff/newsThumbOn(945-946)·newsSource(983) 까지 21종.
원인: 소식 탭(09-30)·사진 빼기(10-03)를 더할 때 설명 줄을 안 고쳤다.
수리안: 설명 문자열에 newsKind / newsHide / newsUnhide / newsThumbOff / newsThumbOn / newsSource 를 더한다. 가능하면 test-collector 의 '비등록 동작 목록' 절이 이 설명과 case 목록을 대조하게.
파일: .github/workflows/admin-apply.yml

NOTES: 점검 범위: _admin/ 전부, tools/admin-apply.mjs·edit-diff.mjs·build-admin-preview.mjs, 워크플로 admin-apply.yml·admin-lock-check.yml, 드라이버 verify-admin(.js/-shape/-vendor). 로봇·드라이버 실행은 모두 버림 작업트리(scratchpad/admin/wt, HEAD ca94c76e)에서 했고, 끝난 뒤 지웠다. 본 작업트리는 건드리지 않았다(git status 깨끗). 이력 확인용 bare 복제본도 scratchpad 에 만들었다가 지웠다.

동작 대조 결과: 저장소(admin-apply.mjs)가 아는 동작 21종과 화면(admin.js)이 보내는 동작 21종이 정확히 같다. 모르는 동작을 보내는 버튼은 없다. ELIG_KEYS 는 admin-apply.mjs 와 edit-diff.mjs 가 같은 8개 키로 일치하고, 실제 데이터의 자격 키도 전부 그 안에 있다. 화면이 부르는 워크플로 38개는 전부 있고 workflow_dispatch 도 있다(gate-photos.yml 은 dispatch 가 없어 원래 대상이 아니다). loadAll 이 읽는 파일 22개도 전부 있다. 저장 단계의 git add 목록은 21개 동작이 쓰는 파일(registered·admin-log·auto-register-config·schools·pending-forms·forms·own-programs·activities·activity-sources·activity-config·data/news·news-sources·news-config)을 모두 덮고, deploy-sync 의 workflows 목록에도 '관리자 조정'이 있다.

작업트리 실측: 드라이버 셋은 모두 통과했다(verify-admin ✅249/❌0 · ADMIN_PORT=8801, shape 통과, vendor 통과). build.sh 는 exit 0. 동작 시뮬레이션은 activitySource·newsSource 정상 경로까지 전부 exit 0 이고 감사도 0 이다. 그런데 일괄 revert/remove 6건은 거부된다(F1). 짧은 근거·출처 되살리기·날짜가 적힌 문구가 있는 공고의 마감 수정은 감사를 통과한 뒤 test-collector 를 빨간불로 만든다(F2).

교차 사항 두 가지(다른 묶음):
① 이 HEAD(ca94c76e)에서 깨끗한 test-collector 가 '✕ 등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다' 1건으로 실패한다. 원격의 06a34cc7(10-04 '데이터 관문 빨간불 수리')이 고친 것으로 보인다. 오케스트레이터가 b71da694 에서 ALL PASS 를 본 것과 다른 HEAD 다.
② verify-ui 최근 2회는 verify-registered.js 에서 실패했다('마감 전 양식 공고를 하나도 구동하지 못했습니다' · 실데이터 의존 · 이슈 #390). 이 때문에 관리자 드라이버가 CI 에서 안 돌았다(F7).

그 밖에 확인했지만 문제가 아니었던 것:
- 예약 지연: admin-lock-check 는 예약보다 4~6시간 늦게 돈다. GitHub 예약 지연이며 결과는 매일 locked 다.
- 교내→교외 수정 때 학습 표(own-programs.json) blocked: 손으로 큐레이션한 이름(예: '면학장학금 (한국외대 교내)')에서는 programNameForTable 이 null 이라 기록되지 않는다. 설계상 로봇이 배우는 꼴의 이름만 막는 것이고, 그 공고 자체는 kindFrom '관리자' 표식으로 보호된다.
- edit payload 크기: 등록 152건 기준 중앙값 831자다. 65,535자 한도를 넘으려면 약 65건을 한꺼번에 보내야 해서 실위험은 낮다.

수정 우선순위 제안:
1. F2 의 즉시 수리 셋. activitySource 근거에 날짜 도장, newsSource 되살리기에 학교당 게시판 하나 확인, 마감 수정 때 문구 동기화 또는 거절이다. 그 뒤 실데이터 검사를 audit-data 로 옮긴다.
2. F1 의 건수 입력 칸.
3. F3 의 VENDOR_SRC 두 줄.

F4·F5·F10 은 사람이 정하거나 손으로 해야 할 일이다(대기줄 설계, 11-07 전 열쇠 재발급, 버튼 경로 실측).


######## GROUP gaps
INVENTORY: 데이터 관문 실패 처리 (collect-scholarships.yml L238-245 · browser-collect.yml L174-178 · collector/revert-auto.mjs)=broken; verify/test-collector.mjs (로봇 7종이 함께 쓰는 데이터 관문)=degraded; collector/paddle-ocr.py (포스터·PDF 무료 OCR)=broken; collector/activity-docs.mjs (--fetch/--apply 무료 · --browser)=degraded; collector/act-browser.json (자격요건 로봇 → 수집 로봇 대외활동 장부)=degraded; collector/act-docs.json=healthy; .github/workflows/refresh-majors.yml (학과 목록 갱신)=degraded; collector/majors.mjs=unknown; .github/workflows/refresh-tuition.yml (등록금 갱신)=degraded; .github/workflows/essay-smoke.yml=retired; .github/workflows/push-check.yml (시험 발송)=healthy; insta/mail.mjs · insta/mail-urls.mjs (선택 SMTP 메일)=retired; insta/run-notify.txt (다시 알리기 push-to-run)=healthy; supabase-config.js (로그인·이어쓰기)=unknown; tools/robot-run.sh (로컬 로봇 실행 겉옷)=degraded; tools/link-wanted.mjs=healthy; tools/setup-collab.sh (합집합 병합기 등록)=healthy; collector/recover-candidates.mjs=retired; collector/run-probe.txt + .github/workflows/probe-links.yml=degraded; collector/certs/ (중간 인증서 묶음)=healthy; deploy-sync.yml 의 workflow_run 목록 · insta/link-hunter/search-index 의 workflow_run 목록=healthy; collector 대기줄(collect·browser·open-api·admin-apply·refresh 2종)=healthy; 앱 루트 스크립트 (app.js·match-engine.js·sw.js 등 29개)=healthy; data/kosaf.json (5MB)=healthy; .claude/hooks (세션 훅)=healthy

--- [gaps-01] P1 (confirmed, workflow-yaml) 데이터 관문이 실패해도 '새 자동 등록분'만 빼고 관문을 깬 수정은 그대로 저장한다 — 그 뒤 관문을 같이 쓰는 다른 로봇이 제 결과를 통째로 버린다
증상: 10-04 02:11 수집 실행과 02:31 브라우저 실행이 둘 다 관문에 걸렸는데도 그 실행이 기존 공고 2건(파안장학·일운과학기술재단)에 새로 채운 자격 줄을 저장하고 main 으로 배포했다(02:45 deploy-sync). 학부생에게 파안장학이 '미달(5%)'로 보였다. 이어 02:44 링크 사냥꾼은 이미 커밋된 그 데이터 때문에 관문이 빨개져 '사냥 결과를 통째로 되돌렸습니다'로 끝났는데 실행은 초록불이었다. 사람이 03:55 에 고치기 전까지 관문을 쓰는 모든 로봇이 같은 상태였다.
근거: ① 수집 37169572702 로그: `✕ 등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다 / 받은 값: ["auto-202026091720eca1b0ed9a8c","auto-notiphpcodes1301seq11193"]` → revert-auto 가 DAAD 등 6건만 빼고 '수집 상태 저장' 실행 → 커밋 a31a853. git show 대조: 직전 8f4bb49 에서 파안장학(auto-202026091720eca1b0ed9a8c) 자격 줄 0줄 → a31a853 에서 8줄. ② 브라우저 37171328367: '감사 실패 시 자동 등록분 되돌리기'·'🚨 데이터 감사 실패 알림' 실행 후 '결과 저장' 실행 → b364d99 에서 일운(auto-0ec82aced95admoddocument) 자격 줄 0→6줄. ③ 링크 사냥꾼 37171951136(02:44): `받은 값: ["auto-0ec82aced95admoddocument","auto-202026091720eca1b0ed9a8c"]` · `git checkout -- data/registered.json data/notices.json` · `::error::데이터 감사에 걸려 이번 사냥 결과를 통째로 되돌렸습니다` · 결론 success. ④ ca94c76e 데이터로 같은 단정을 스크래치 스크립트로 재현하면 bad=[일운, 파안]. ⑤ 사람 수리 06a34cc7(03:55): '파안장학 … 학부생이 미달(5%)'. ⑥ 코드: collector/revert-auto.mjs L24-29(auto:true 이면서 직전에 없던 항목만 뺀다) · L31-33 '되돌릴 자동 등록분이 없습니다 — 감사 실패는 기존 데이터 쪽 문제입니다' 라고만 하고 끝 · collect-scholarships.yml L238-245 · browser-collect.yml L174-178 — 되돌린 뒤 관문을 다시 돌리지 않고 저장한다.
원인: 관문 실패 처리가 '실패 원인 = 새 자동 등록분'이라고 가정한다. 같은 실행의 발췌 갱신·deepfetch --fill·kind-classify 가 기존 공고를 고쳐 관문을 깨면 그 수정은 되돌림 대상이 아니고, 저장 단계도 관문 결과와 상관없이 돈다. 그래서 나쁜 데이터가 기본 브랜치·main 에 들어가고, 같은 test-collector·audit 를 쓰는 링크 사냥꾼·교내 소식·자격요건 로봇은 '되돌리기'가 통째 git checkout 이라 제 결과를 모두 버린다(그러면서 초록불). collect-02·B1 은 '자동 등록이 되돌려진다'까지만 보고, 저장된 원인 수정과 다른 로봇 피해는 다루지 않았다. 이번 원인 단정은 06a34cc7 로 경고로 옮겨졌지만 구조는 그대로라, 다음에 다른 실데이터 단정이나 감사 오류가 걸리면 똑같이 반복된다.
수리안: ① revert-auto 뒤에 test-collector·audit 를 한 번 더 돌린다. 그래도 실패하면 data/registered.json·data/forms.json 을 HEAD 로 되돌리고 장부(seen·health·커서)만 저장한다. ② 이 경우 실행을 빨간불로 끝내고 이슈를 연다(지금은 '자동 등록분 되돌림' 코멘트뿐). ③ 링크 사냥꾼·교내 소식·자격요건 로봇의 '관문에 걸려 결과 폐기' 경로도 job 을 실패로 끝내 하트비트·실패 알림에 잡히게 한다. ④ 관문 「데이터 관문」에 '기존 항목 수정이 관문을 깨면 저장되지 않는다' red-green 검사를 더한다.
파일: collector/revert-auto.mjs, .github/workflows/collect-scholarships.yml, .github/workflows/browser-collect.yml, .github/workflows/link-hunter.yml, .github/workflows/collect-news.yml, .github/workflows/rescue-bodies.yml
이미수리: 이번 원인(대학원 전용 실데이터 단정)만 06a34cc7(10-04 03:55 UTC)이 고쳤다 — 04:04 collect-news 37175911167 관문 통과로 증명. 구조 결함은 그대로.

--- [gaps-02] P2 (confirmed, code) 포스터 OCR(PaddleOCR)이 Actions 에서 매번 첫 그림에서 죽어 0장인데 초록불 — 실패한 시도가 글마다 2번뿐인 무료 기회를 깎는다
증상: 대외활동 글의 포스터·PDF 공고문에서 자격을 읽는 무료 경로가 운영에서 한 번도 결과를 내지 못했다(data/activities.json 의 eligibilityFrom '공고문 첨부(OCR)' 0건). 수집 로봇과 자격요건 로봇 모두 단계는 초록불이다.
근거: 수집 37169572702(10-04 02:11) 로그: `✕ 6c454347f6f4-0.jpg — (Unimplemented) ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]` → `끝 — 0장`. 자격요건 로봇 37160846656(10-03 23:24) 로그: `✕ 5986232f991b-1i.png — (Unimplemented) ConvertPirAttribute2RuntimeAttribute not support …` → `끝 — 0장`. 워크플로: collect-scholarships.yml L229-230 `pip install --quiet paddlepaddle paddleocr` · `python3 collector/paddle-ocr.py … || true`, rescue-bodies.yml L95-96 같은 꼴. paddle-ocr.py 머리말: '활동 글 24건 중 11건 … (2026-10-03 로컬 실측)'. activity-docs.mjs L54-55 MAX_TRIES=2 · RETRY_DAYS=7, L287 시도마다 tries+1 — 장부 act-docs.json 24건·act-browser.json 10건이 tries 1.
원인: 확인된 것: PaddleOCR 의 추론 단계가 Actions(Ubuntu x86) 에서 그림마다 예외를 던지고, paddle-ocr.py 는 예외를 잡아 '0장'으로 정상 종료하며, 워크플로가 `|| true` 로 한 번 더 삼킨다. 개발자 확인은 로컬에서만 했다. 원인으로 가장 유력한 것(미확인): 버전을 고정하지 않은 paddlepaddle 3.x 를 x86 CPU 에서 돌릴 때 oneDNN(MKLDNN) 경로가 이 속성 변환을 지원하지 않는 알려진 비호환. 로컬(맥)은 그 경로를 타지 않았을 수 있다. bodies-12 는 '버전 미고정'을 위험으로만 적었고, 실제로 이미 고장 났다는 것과 기회 소모는 다루지 않았다.
수리안: ① paddlepaddle·paddleocr 버전을 Actions 에서 실제로 도는 판으로 고정하거나, PaddleOCR(…) 에 CPU oneDNN 끄기 옵션을 준다. 고정은 Actions 수동 실행 한 번으로 증명한다. ② paddle-ocr.py 는 읽을 그림이 있었는데 0장이면 exit 1 로 끝내고 `|| true` 를 뗀다(같은 파일 OCR 단계의 '설치 실패를 삼키지 말 것' 규칙과 맞춘다). ③ OCR 이 아예 못 돈 시도는 tries 로 세지 않는다. 고친 뒤에는 act-docs.json·act-browser.json 의 tries 를 한 번 초기화한다(10-10 쯤 두 번째 시도가 돌면 그 글들은 영영 포기된다).
파일: collector/paddle-ocr.py, collector/activity-docs.mjs, .github/workflows/collect-scholarships.yml, .github/workflows/rescue-bodies.yml, collector/act-docs.json, collector/act-browser.json

--- [gaps-03] P2 (confirmed, code) 등록금 갱신 한 번이 모든 로봇의 데이터 관문을 깬다 — test-collector 가 실제 등록금 값(7269500)을 고정으로 재는데, 갱신 로봇은 관문 없이 저장한다
증상: 지금은 조용하다. 다음에 누군가 「대학별·계열별 등록금 갱신」을 눌러 외대 인문사회 등록금이 한 원이라도 바뀌면, 그 뒤 수집·브라우저·링크 사냥꾼·자격요건 로봇·교내 소식·한국장학재단·심층 수집이 모두 관문에서 빨개진다. 자동 등록이 되돌려지고 다른 로봇은 결과를 버린다(gaps-01 과 같은 연쇄). 학과 목록 갱신도 같은 자리에 있다.
근거: verify/test-collector.mjs L5962-5965: `const T = req('../data/tuition.json').schools; … eq('표에는 1년치가 들어 있다 (외대 인문사회)', yearly, 7269500);`. refresh-tuition.yml·refresh-majors.yml 은 audit-data·test-collector 를 한 번도 부르지 않는다(grep 0) — 저장 단계(refresh-tuition.yml L48-58)만 있다. 같은 test-collector 를 저장 전 관문으로 쓰는 워크플로: collect-scholarships·browser-collect·link-hunter(L106-110)·rescue-bodies(L104-108)·collect-news(L97-101)·kosaf-fetch·deep-fetch. 같은 꼴의 실데이터 단정이 더 있다 — L1605 run-probe.txt 내용, L2815 주관 기관, L4122 boardTitle 부스러기, L7901 학교 이름, L8287·L10524 등(로봇이 쓰는 데이터를 그대로 잰다). 06a34cc7 은 이 중 한 줄('대학원 전용')만 경고로 옮겼다.
원인: CLAUDE.md 가 금지한 '실데이터에 기댄 고정 검사'가 공용 관문에 남아 있다. 그 데이터를 바꾸는 로봇(등록금·학과 갱신)은 저장 전에 그 관문을 돌리지 않아, 깨진 상태가 기본 브랜치에 들어간 뒤 다른 로봇의 실행에서야 터진다(admin-F2 와 같은 구조 — 관리자 쪽은 이미 보고됨, 갱신 로봇 쪽은 아무도 안 봤다). 발생 시점은 원천(대학알리미·한국장학재단 포털)이 다음 해 값을 낼 때로 보이나 확인하지 않았다.
수리안: ① L5965 를 실제 값이 아니라 성질로 바꾼다(예: '1년치는 한 학기분의 두 배' · 표본 고정 데이터로 tuitionFor 를 잰다). ② test-collector 의 실데이터 전수 단정을 하나씩 audit-data.js 경고로 옮기거나 표본 데이터로 바꾸고, 공용 관문에는 코드 규칙만 남긴다. ③ refresh-tuition.yml·refresh-majors.yml 에도 저장 전 관문(test-collector + audit)과 실패 시 되돌리기를 붙인다.
파일: verify/test-collector.mjs, .github/workflows/refresh-tuition.yml, .github/workflows/refresh-majors.yml, verify/audit-data.js

--- [gaps-04] P3 (confirmed, code) 로컬 로봇 실행 겉옷(robot-run.sh)의 '돌고 있으면 막을 로봇' 목록이 손으로 적은 옛 사본이라 데이터 로봇 9개가 빠졌다
증상: 개발자가 `bash tools/robot-run.sh node collector/…` 로 로봇을 돌리면, 클라우드에서 자격요건 로봇·AI 자격 읽기가 data/registered.json 을 고치고 있어도 '비어 있음 ✅'이라며 시작한다. 이 겉옷이 막으려던 것(registered.json 이 손으로 풀어야 하는 충돌을 내는 것)이 다시 열려 있다.
근거: tools/robot-run.sh L39: `DATA_ROBOTS='장학공고 수집 로봇|브라우저형 수집 로봇|링크 사냥꾼|원문 링크 복구 로봇|공고 원문 심층 수집|검색용 요약 만들기|관리자 조정|학과 목록 갱신'`. 빠진 것(실제 name:): '자격요건 로봇 (진짜 브라우저)'(registered.json), '자격요건 매칭 · AI 자격 읽기'(registered.json·activities.json), '공공 API 로봇', '교내 소식 수집 로봇', '원문 링크 확인 로봇', '한국장학재단 수확 로봇', '대학별·계열별 등록금 갱신', '양식 자동작성 · 작성 규칙 학습', '인스타 카드뉴스 게시'. 이 목록을 대조하는 관문이 없다(test-collector 에 DATA_ROBOTS 검사 0건). 또 `gh run list --limit 30` 은 저장소 전체 최근 30개만 봐서, push 가 몰리는 날(10-03 17:35~10-04 05:06 사이 100개)에는 오래 도는 로봇이 창 밖으로 밀려날 수 있다.
원인: 08-21 에 만든 뒤 로봇이 늘 때마다 고치는 장치가 없는 사본이다. deploy-sync.yml 목록이 같은 이유로 넷을 놓친 적이 있다(CLAUDE.md '배포 감시').
수리안: 목록을 손으로 적지 말고 .github/workflows/*.yml 중 `git add data/`·`git add collector/` 를 하는 워크플로의 name: 을 읽어 만든다(check-deploy-sync.js 와 같은 방식). 아니면 test-collector 에 'DATA_ROBOTS 가 데이터 쓰는 워크플로 이름을 전부 포함한다' 관문을 더한다. gh run list 는 --status in_progress·queued 로 따로 묻는다.
파일: tools/robot-run.sh, verify/test-collector.mjs

--- [gaps-05] P3 (confirmed, code) 링크 정찰이 08-29·09-17·09-30 에 적은 옛 정찰 줄 15개를 매번 다시 연다 — 정찰 시간의 절반 이상이 들고 같은 학교를 하루 여러 번 두드린다
증상: 새 주소 열 개를 보려고 정찰을 한 번 돌리면, 답을 받았는지 표시되지 않은 옛 줄(동국 상세 2·건국·홍익·서강 2·서울대·동국 목록·상명 2·서강 행사·경북·서울대 학부대학·고려 세종 + 한국장학재단 포털 '상세보기' 찾기)도 같이 다시 연다. 10-03 하루에만 정찰이 4번(18:06·18:20·18:31·19:04) 돌아 같은 학교 페이지를 매번 다시 열었다.
근거: run 37176295018(10-04 04:11, 정찰 단계 9분 26초) 로그: 새 주소 10개는 04:12:51~04:16:03, 옛 checkUrl 14개는 04:16:25~04:20:34(약 4분), 이어서 08-29 KOSAF findBoard. collector/run-probe.txt 의 주석이 아닌 줄: findBoard 1 + checkUrl 14(09-17 넷 · 09-30 여섯 · 10-03 넷). probe-links.mjs L293 예산 11분(PROBE_BUDGET_MS), L295 위에서부터 차례로 연다 — 새 줄이 파일 아래에 붙으면 예산이 모자라 '이번엔 못 봄'이 될 수 있는 구조. test-collector L1605 는 이 파일에 sogang·student.snu·dongguk·smu 글자가 있기를 요구한다(주석 안에 있어도 통과).
원인: run-probe.txt 가 쌓이는 일지인데, 답을 받은 줄은 사람이 '# (답 받음 …)' 로 손수 막아야 한다. 08-29·09-17·09-30 줄은 막지 않은 채 남았다. 정찰 도구에는 '이미 본 주소는 건너뛴다' 장치가 없다. 답을 받았는지는 사람이 정할 일이라 이 진단은 '다시 열린다'까지만 단정한다.
수리안: ① 지금 줄들 중 답을 받은 것은 '# (답 받음 날짜)' 로 막는다(사람 확인). ② 정찰 도구가 이번 push 에서 새로 생긴 줄만 열게 한다(git diff 로 바뀐 줄만 · 또는 줄마다 날짜 꼬리표). ③ L1605 처럼 지시 파일 내용을 재는 관문은 지시 파일 대신 문서·코드를 재게 옮긴다.
파일: collector/run-probe.txt, collector/probe-links.mjs, verify/test-collector.mjs

--- [gaps-06] P3 (confirmed, human-decision) 학과 목록 갱신 로봇은 만든 지 두 달 동안 Actions 에서 한 번도 실제로 돈 적이 없다 — 학생이 받는 학과 파일은 08-05 로컬 실행본 그대로
증상: 학과 자동추천 파일(data/majors/*.json 209개)이 08-05 커리어넷 수확 그대로다. 갱신 로봇은 예약이 없고 수동으로만 도는데 아무도 누른 적이 없어, 열쇠·발행·저장 경로가 Actions 에서 동작하는지 한 번도 증명되지 않았다. 09-26 커밋 메시지는 '다음 예약 실행(주 1회)'을 전제했지만 그런 예약은 없다.
근거: refresh-majors.yml 실행 이력 총 6건 — 전부 09-30 push 이벤트·failure(워크플로 파일 오류 시기 · 예: 36656322579 · 36655320392), workflow_dispatch 0건. data/majors.json updatedAt '2026-08-06', 마지막 커밋 15c9cbc2(2026-08-05, 조세현 로컬). data/majors/ 는 7e3d8fab(09-26) 하나뿐 — 메시지 '지금 있는 407KB 파일로 209개 파일을 미리 발행해 커밋했다 — 로봇만 고치면 다음 예약 실행(주 1회)까지 …'. refresh-majors.yml 머리말 '예약 실행은 두지 않았다 — 학기 시작 무렵 Actions에서 수동 실행'. 이 워크플로는 저장 전 관문도 없다(gaps-03).
원인: '학기 시작 무렵 수동 실행'이 사람의 기억에만 기대고, 알려 주는 장치(하트비트는 예약이 있는 로봇만 본다)가 없다. 그 사이 학교 범위가 44개교로 바뀌었지만 데이터는 옛 판이다(연세 미래 등 빠진 학교는 MAJORS-01·app2-F5 가 다룸 · 열쇠 유무는 MAJORS-02).
수리안: ① 지금 한 번 수동 실행해 경로를 증명한다(열쇠가 없으면 '변경 없음'으로 초록이 되므로 로그에서 '열쇠 없음' 문구를 확인). ② 학기 시작 전(2월·8월)에 한 번 도는 예약을 두거나, robot-heartbeat 가 이 워크플로의 '마지막 성공'이 180일을 넘으면 알리게 한다. ③ 저장 전 관문을 붙인다(gaps-03).
파일: .github/workflows/refresh-majors.yml, collector/majors.mjs, collector/robot-heartbeat.mjs, data/majors.json

NOTES: 진단 중 알게 된 것(다른 묶음 결과의 갱신):
1) 로컬 체크아웃(HEAD ca94c76e)은 origin 보다 뒤처져 있다 — origin 기본 브랜치 끝은 d80c750f(10-04 04:54 UTC)다. 그 사이 06a34cc7(03:55 UTC) '데이터 관문 빨간불 수리'가 들어갔다. 이 수리로 collect-02·B1·api-02 의 직접 원인('대학원 전용' 실데이터 단정)이 경고로 옮겨졌고, parse-requirements 의 '학사, 석사ㆍ박사과정' 오판(browser 묶음의 parse-requirements=broken)도 고쳐졌다. 수리 뒤 collect-news 04:04 실행 37175911167 의 데이터 관문이 통과해 증명됐다. 수집·브라우저 로봇 자체 실행으로는 아직 증명되지 않았다. 다만 오케스트레이터가 받은 'test-collector ALL PASS'(10-03 18:45)는 10-04 02:11~03:55 사이에는 맞지 않았다. 그 시간대 커밋된 데이터(a31a853·b364d99)로는 해당 단정이 실패한다(스크래치 재현 bad=[일운, 파안]).
2) 39개 워크플로는 다른 묶음 인벤토리에 모두 있다. 'unknown'이던 것 중 activity-docs·paddle-ocr·act-browser·refresh-majors·refresh-tuition·essay-smoke·push-check·insta mail·run-notify 는 위에서 판정했다. 남은 unknown: supabase 마이그레이션 적용 여부(운영 DB 를 읽는 확인이 이 세션 권한에서 막혀 사람이 대시보드로 확인해야 함) · majors.mjs(실행 기록 없음) · Cloudflare 관리자 배포(저장소 밖이라 확인 못 함).
3) 교차 점검 중 문제없음으로 판정한 것: deploy-sync·insta·link-hunter·search-index 의 workflow_run 이름 15개가 실제 이름과 모두 일치 · collector 대기줄에서 대기 실행이 취소된 기록 0건(collect 40·browser 30·open-api 14회) · push-to-run .txt 15개 모두 기본 브랜치 필터 있음(device-deploy 는 branch: 대조로 의도된 예외, two-school-scan 은 은퇴) · 인증서 묶음 2036년 만료 · sw.js 오프라인 목록 정상.
4) 실행하지 않은 것: 워크트리를 만들지 않았고, 로봇·test-collector 를 다시 돌리지 않았다. Actions 의 전체 로그 zip 은 샌드박스에서 403 이라 tail 로그(최대 4000줄)로만 봤다.
5) 관련 파일 경로: /home/user/hanggonggan/collector/revert-auto.mjs, /home/user/hanggonggan/.github/workflows/collect-scholarships.yml, /home/user/hanggonggan/collector/paddle-ocr.py, /home/user/hanggonggan/collector/activity-docs.mjs, /home/user/hanggonggan/verify/test-collector.mjs, /home/user/hanggonggan/tools/robot-run.sh, /home/user/hanggonggan/collector/run-probe.txt, /home/user/hanggonggan/.github/workflows/refresh-majors.yml, /home/user/hanggonggan/.github/workflows/refresh-tuition.yml. 스크래치 재현 스크립트: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/gaps/grad.cjs
