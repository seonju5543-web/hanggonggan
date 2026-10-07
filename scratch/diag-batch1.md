

######## GROUP browser

--- [B1] P1 (confirmed, code) 데이터 관문이 10-01부터 매 실행 같은 1건(DAAD 섬머코스)으로 실패해 자동 등록 8건이 매번 전부 되돌려지는 무한 고리
증상: 10-01 이후 브라우저 수집 6회 전부(그리고 일반 수집 로봇도) '🚨 데이터 감사 실패 — 이번 자동 등록분은 되돌렸습니다' 코멘트(#333·#340·#346·#366·#368·#381). 리포트는 '자동 등록 8건 등록'이라 쓰지만 실제로는 하나도 정식 등록되지 않는다. 같은 8건이 매번 다시 등록·되돌림되어 '⏭ 한 실행 상한(8건)에 걸려 26건은 보지 않았어요'의 26건은 영영 판정되지 않는다(하나금융나눔재단 10-06 마감, 이화 선원가족 10-23 마감 등 정상 7건도 장학금 탭에 못 들어감).
근거: 런 로그 4개에서 같은 줄 확인: 36803960541(10-01, 그때는 '정식 등록 나눌 때' 1건 추가로 2건 실패), 36990817962, 37087734875, 37111713944 — '✕ 등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다 / 받은 값: ["auto-notiphpcodes1301seq11193"] / 기대 값: []' 뒤 '이번 실행의 자동 등록 8건을 되돌렸습니다'. 36846369397·36954269434 도 되돌리기 단계가 실행됨(steps.audit.outcome=failure). 관문 위치 verify/test-collector.mjs L7972~7980. 원문(collector/extracted/notices-text.json seq=11193): '가 . 지원자격 : 유럽언어기준 B1 이상의 독일어 능력을 보유한 학사 및 석사과정 학생' · '※ … 학사 2 학년 이상을 마쳐야 하며'. 로컬 실측: PR.gradTarget(그 줄)='body', PR.mentionsUndergrad(그 줄)=false, ME.fitDetail(3학년 학부 프로필) → fails:['유럽언어기준 B1 … 학사 및 석사과정 학생']. HEAD 에서도 그대로(parse-requirements.js 10-01 이후 수정 없음).
원인: ① parse-requirements.js L334 UNDERGRAD_TOO = /학부|학사\s?과정|…/ 가 '학사 및 석사과정'처럼 '과정'을 뒤 낱말과 공유하는 병렬 표현을 학부로 인정하지 않아, 학부생도 받는 공고를 '대학원 전용'으로 판정한다(앱에 실렸다면 학부생에게 틀린 미달). ② auto-register 는 대학원 제외를 제목으로만 걸러 이 공고를 통과시키고, 자격 줄은 그 뒤 extract-excerpts 가 채운다. ③ revert-auto.mjs L27 은 문제 1건이 아니라 '이번 실행 새 auto 항목 전부'를 빼고, 되돌린 id 를 어디에도 기억하지 않으며, auto-register 상한 8(L274)이 같은 8건을 매번 맨 앞에 둔다 → 고리.
수리안: (1) UNDERGRAD_TOO 에 '학사(\s*및|\s*·|\s*,)?\s*석사' 병렬·'학사\s*\d\s*학년' 꼴을 넣어 '학사 및 석사과정'을 학부 포함으로 본다(관문에 이 줄을 red-green 표본으로 추가 — 되돌리면 빨간불). (2) revert-auto 가 관문이 지목한 id(받은 값)만 빼거나, 최소한 되돌린 id 를 장부(예: auto-register 의 보류 목록)에 적어 다음 실행이 같은 공고로 상한을 채우지 않게 한다. (3) 고치기 전 임시로 auto-notiphpcodes1301seq11193 을 auto-register-config.json blockIds 에 넣으면 다음 실행부터 나머지 7건이 등록된다(개발자 확인 후).
파일: parse-requirements.js, collector/revert-auto.mjs, collector/auto-register.mjs, collector/auto-register-config.json, verify/test-collector.mjs

--- [B2] P1 (confirmed, config) 홍익대학교 — 브라우저 전담(collector:"browser")인데 브라우저가 매번 링크 0개라 8월 29일 이후 새 공고가 하나도 안 들어온다
증상: 홍익대 학생의 실시간 공고가 0건. data/notices/index.json 에 홍익대 파일이 없고 data/notices.json 에도 홍익 공고 0건. 일반 로봇은 '🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀'으로 손을 떼 두 로봇 모두 수집하지 않는다.
근거: 브라우저 리포트 #327(09-30)·#333·#340·#346·#366·#368·#381·현재 browser-report.md 모두 '⚪ 링크 0 · 장학 공고 0 · https://www.hongik.ac.kr/kr/newscenter/notice.do' + '⚪ 링크 0 · … /index.do'(#333 은 index.do 'Target page … closed'). collector/report.md: '### 홍익대학교 / 상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀'. seen.json 의 hongik.ac.kr 마지막 기록 2026-08-29. match-engine.js L824 SERVED_SCHOOLS 에 '홍익대학교' 있음. schools.json _collector 주석은 '브라우저가 정상인 학교에 달았다(…홍익…)'고 적지만 09-30 첫 실행(#324)은 홍익을 예산으로 건너뛰었고 그 뒤 한 번도 정상이었던 적이 없다.
원인: 직접 원인: 두 후보 주소 모두 브라우저 화면에서 a[href] 가 0개(링크 0)다 — 차단 화면·빈 화면·다른 주소로 이동 중 무엇인지는 이 샌드박스에서 확인 불가(학교 사이트 차단). 구조 원인: collector:"browser" 지정 근거가 실측과 맞지 않았고, 링크 0 이어도 경보가 안 뜬다(B4).
수리안: 스킬 probe-run 으로 run-probe.txt 에 checkUrl: https://www.hongik.ac.kr/kr/newscenter/notice.do 를 넣어 Actions 에서 실화면(상태 코드·최종 주소·본 글자)을 본 뒤, 장학 공지 게시판 주소를 확정해 browser-targets.json·schools.json 을 고친다. 그때까지 schools.json 의 collector:"browser" 를 떼면 적어도 일반 로봇이 다시 시도한다(8월 29일까지는 일반 fetch 주소 꼴 notice.do?mode=view&articleNo= 로 수집됐다).
파일: collector/browser-targets.json, collector/schools.json

--- [B3] P1 (likely, config) 서울시립대학교 — FA1 이 장학 게시판이 아닌 것으로 보여 브라우저 전담인데 장학 공고가 거의 0건
증상: 8회 리포트 중 6회 FA1·FA2 모두 '장학 공고 0'(09-30 저녁·10-01 오전만 1건). 일반 로봇은 브라우저 담당이라 건너뛴다. 시립대 학교별 파일은 2건뿐(최신 10-01).
근거: 현재 browser-report.md 의 FA1 진단 '(본 링크) [전공설계융합지원센터] … 전공설계상담 …', '[인공지능혁신융합대학사업단] … 글로벌 프로그램 …', '[대학일자리플러스센터] 2026년 졸업생특화프로그램 참여 안내' — 센터·사업단 일반 안내다. FA2 는 '[교직] … 교육실습 신청 안내' 등 학사 공지. browser-targets.json _note 는 'FA1이 장학공지(수집 실적 전부 여기)'라 적었다. seen.json uos.ac.kr 9월 2건·10월 2건이고 그마저 '경영경제전문도서관 국가근로장학생 추가 모집' 같은 일반 공지 속 장학 낱말 글.
원인: FA1 이 지금은 일반공지(여러 부서 글)로 보이며, 장학 전용 게시판 주소는 따로 있을 가능성이 크다 — 이 샌드박스에서 학교 사이트를 열 수 없어 미확인.
수리안: probe-run 으로 uos.ac.kr korNotice 의 list_id 목록(장학 분류)을 정찰해 장학 전용 list_id 를 찾고 browser-targets.json·schools.json 의 FA1 을 교체한다. 일반 fetch 로 열리는 게시판이면 collector:"browser" 를 떼는 것도 검토.
파일: collector/browser-targets.json, collector/schools.json

--- [B4] P1 (confirmed, code) 연속 실패 경보 사각지대 — 링크 0·장학 0 게시판을 '성공'으로 적고, 일반 로봇이 같은 열쇠를 0으로 되돌려 '🚨 여러 번 연속 실패' 경보가 구조적으로 안 뜬다
증상: 홍익대(링크 0, 8회 연속)·서울시립대(장학 0)·서울대(브라우저 6회 연속 멈춤) 어느 것도 리포트에 '🚨 여러 번 연속 실패한 학교'가 뜬 적이 없다. health.json 은 41곳 전부 fails 0(충남대 1).
근거: browser-collect.mjs L406~411: 후보 주소가 열리기만 하면 loadedAny=true → harvestWithDeadline 이 '수집' 판정, L714 health 에서 stillFailed 가 아니면 fails=0·lastOk=오늘. 링크 수·장학 공고 수는 보지 않는다. collect.mjs L652 주석 '같은 health.json을 쓴다(학교 이름이 열쇠라 섞이지 않는다)'와 달리 서울대·서강·숙명·건국·명지·연세·외대 등 두 로봇이 같이 보는 학교는 일반 로봇이 성공하면 L666 에서 fails=0 으로 되돌린다(서울대: 브라우저 매 실행 ⛔ 인데 health.json {"fails":0,"lastOk":"2026-10-03"}).
원인: '페이지가 열렸다'와 '공고를 읽었다'를 구분하지 않는 성공 판정 + 두 로봇이 같은 열쇠의 연속 실패 수를 서로 덮어쓰는 장부 공유.
수리안: 브라우저 쪽 판정을 '장학 공고 1건 이상 또는 이미 아는 행(clickSkipped) 1건 이상'일 때만 성공으로 하고, 링크 0·장학 0 이 연속되면 별도 경보(예: '⚪ 연속 0건 n회')를 리포트·이슈 제목에 올린다. 장부 열쇠를 로봇별로 나누거나(예: 'browser:서울대학교') 브라우저 기록을 따로 둔다. red-green 관문: 링크 0 을 성공으로 되돌리면 빨간불.
파일: collector/browser-collect.mjs, collector/collect.mjs, collector/health.json, collector/prune-health.mjs

--- [B5] P2 (confirmed, config) 서울대학교 — 브라우저 대상이 매 실행 450초 강제 중단(6회 연속)되는데 일반 로봇은 정상 수집 중이라 순수 낭비
증상: 매 실행 수집 단계 8분 중 7분 30초를 서울대 한 곳이 붙든다(나머지 18곳은 2분 30초 안에 끝남). 리포트는 매번 '⚠️ 이번 실행에 접속 실패한 학교: 서울대학교 … 다음 실행(약 12시간 뒤)에 자동으로 다시 수집합니다'라고 적는다.
근거: 로그 4개 모두 '[480s] ◀ 서울대학교 — ⛔ 응답 멈춤(강제 중단) (450초)'(36803960541 [495s], 36990817962 [489s], 37087734875 [482s], 37111713944 [480s]); 리포트 #340·#346·#366·#368·#381 동일. 그 전 #327·#333 은 'page.goto: Target page, context or browser has been closed' + 두 번째 후보 '링크 1'. 리포트에 학교 줄이 ⛔ 한 줄뿐 → 첫 loadPage 가 450초 안에 돌아오지 않음. collector/report.md: '### 서울대학교 / 상태: ✅ 정상 (실공고 33건 감지)'. 리포트 L698 문구 '학교 서버가 연결만 열어 두고 답을 주지 않아'는 확인하지 않은 원인을 단정한다(CLAUDE.md 규칙 5).
원인: 브라우저 화면에서 서울대 학생지원 사이트가 어느 단계에서 멈추는지는 로그에 단서가 없어 미확인. 확실한 것은 일반 로봇이 같은 게시판을 정상으로 읽는다는 것 — schools.json _collector 주석의 규칙('브라우저가 0건·일반이 정상이면 browser-targets.json 에서 빼는 것이 답')에 해당한다.
수리안: browser-targets.json 의 서울대 항목을 _parked 로 옮긴다(지우지 말 것). 함께 L698·'접속 실패' 문구에서 단정한 원인 대신 '이 시한 안에 첫 화면을 다 읽지 못했다'처럼 관측 사실만 적는다.
파일: collector/browser-targets.json, collector/browser-collect.mjs

--- [B6] P2 (confirmed, code) 계명대 — 글 주소에 휘발성 pageRef 가 붙어 새 글이 올라올 때마다 목록 40건 전부가 '신규'로 다시 수집된다
증상: 10-02 오전 리포트 '신규 41건'(#366) 중 40건이 계명대 재수집. 같은 글의 수집일(foundAt)이 09-30 → 10-02 로 덮여 60일 수명이 늘고, 상세 방문 예산을 이미 아는 글에 쓴다. 이슈 제목의 신규 건수가 부풀려진다.
근거: seen.json: 계명대 parm_bod_uid 81개 중 75개가 pageRef 값만 다른 주소로 2~3번(예 '266407:269875,269918,269943'), kmu 날짜별 09-30 43키·10-02 78키. 로컬 실측 urlKey(…pageRef=269475&parm_bod_uid=269438…) === urlKey(…pageRef=269999…) → false. data/notices 계명대 파일 40건 중 39건 foundAt '2026-10-02'. browser-bodies.json 계명 75건이 pageRef=271152 주소로 중복 키. url-key.mjs L43 VOLATILE 에 pageRef·pagePrvNxt·pageOrder·pageNo 없음, canon-url.mjs L43 과도 목록이 다르다.
원인: 계명대 상세 주소(page.jsp?cmd=2&…&pageRef=<목록 첫 글 번호>&parm_bod_uid=<글 번호>)의 pageRef 는 목록 상태 값인데 urlKey 가 글 식별자로 취급한다. dedupeNotices 는 제목 열쇠로 합쳐 중복은 막지만 새로 받은 쪽(freshAll 먼저)이 남아 foundAt 이 갱신된다.
수리안: url-key.mjs VOLATILE 과 canon-url.mjs VOLATILE 에 pageRef·pagePrvNxt·pageOrder(그리고 url-key 에 pageNo·pageUnit) 를 넣어 두 목록을 한 벌로 맞추고(관문 대조 추가), 같은 글을 다시 만나면 기존 foundAt 을 이어받게 한다. seen.json 은 소급 정리 불필요(새 열쇠로 다시 맞춰짐) — 단 한 번은 '신규'가 0이 되는지 리포트로 확인.
파일: collector/url-key.mjs, collector/canon-url.mjs, collector/browser-collect.mjs

--- [B7] P2 (confirmed, code) 클릭형 게시판은 브라우저가 그린 상세 본문을 버린다 — 고려·부산·서울교대·가천 공고가 원문 없이 남는다
증상: 클릭으로 수집한 공고는 마감 단서·첨부만 남고 본문이 저장되지 않는다. 일반 fetch 로는 이 학교들 상세가 껍데기라 원문을 영영 못 얻고, 발췌·자격 판정이 '원문 미확보'로 남는다(발췌 단계 '원문 미확보라 손대지 않음 89건').
근거: browser-collect.mjs L332 클릭 경로는 clickDetails[title] = { deadlineHint, attachments } 만 만들고 dText(상세 글자)는 버린다. L454 cd 가 있으면 상세 방문·L475 bodies 저장을 건너뛴다. 실측 browser-bodies.json 호스트별: korea.ac.kr 0 · pusan 0 · gachon 0 · snue 2 (비클릭형 kmu 75). notices.json 중 needsFetch 142건, 그중 korea 9·snue 10·gachon 15·dongguk 10.
원인: 2026-08-20 에 '브라우저가 그린 본문을 버리지 말 것' 수리가 상세 방문 경로(L465~476)에만 들어가고 클릭 경로에는 들어가지 않았다.
수리안: 클릭 경로에서 한글 120자 이상이면 bodies[recUrl] 에 같은 꼴({title,text,at,via:'browser'})로 저장한다(recUrl 이 #n- 표식이어도 notice-source 가 같은 주소로 찾도록 indexTexts 열쇠 확인). 추가 페이지 열기가 없어 시간 예산 영향 없음. 관문: 클릭 경로 표본이 bodies 를 남기는지.
파일: collector/browser-collect.mjs, collector/notice-source.mjs

--- [B8] P2 (confirmed, code) 공고 원문 보충 수집(deepfetch --fill)이 매 실행 같은 117건을 다시 받으며 3분 단계 상한에 걸린다
증상: 단계가 매번 2분 20초~3분을 쓰고, 10-01 오전은 상한에 걸려 저장 전에 강제 종료(그날 받은 원문 폐기), 10-03 오전은 상한 직전에 저장. 상한 120건을 늘 같은 글이 차지해 그 뒤 22건은 순서가 안 온다.
근거: 36803960541: '##[error]The action '공고 원문 보충 수집 (빠진 것·잘린 것만)' has timed out after 3 minutes.'(done(fill) 줄 없음). 37087734875: 'done(fill): 452 texts' 직후 같은 timeout 오류. 'text ok' 목록 비교: 10-03 오전·오후 공통 117건, 10-02 오후·10-03 오후 공통 116건. 로컬 실측: notices.json 339건 중 needsFetch 142건 — 90건은 받아 둔 글이 bodyChars<100 이라 hasText=false(notice-source.mjs L160 looksLikeShell), 52건은 원문 없음.
원인: deepfetch.mjs L163 res.ok 이면 fails 를 올리지 않으므로, 받아도 껍데기(bodyChars<MIN_BODY)인 글은 GIVE_UP_AFTER(3회) 물러서기에 영영 안 걸리고 매 실행 다시 받는다. 쓰기는 마지막 한 번(L200)뿐이라 단계 상한에 걸리면 그 실행분이 통째로 사라진다. 이 껍데기 다수가 B7 의 클릭형·JS 게시판 글.
수리안: 성공 응답이어도 hasText 가 거짓이면 shellFails 를 올려 몇 회 뒤 물러서게 하고(브라우저 본문이 생기면 indexTexts 가 대신함), --fill 에 자체 예산(예: 150초)과 중간 저장을 둔다. B7 수리와 같이 하면 대상이 크게 준다.
파일: collector/deepfetch.mjs, collector/notice-source.mjs, .github/workflows/browser-collect.yml

--- [B9] P2 (confirmed, workflow-yaml) 리포트·알림이 실제 결과와 다르게 보인다 — 되돌린 등록을 '등록'으로, 다른 로봇의 실패를 브라우저 이슈에, 이슈는 쌓이기만 한다
증상: 이슈 #366·#368·#381 본문은 '🤖 자동 등록 — 8건 등록'인데 같은 실행에서 8건이 되돌려졌다. 브라우저 리포트 이슈 8개(#324·#327·#333·#340·#346·#366·#368·#381)가 전부 OPEN. #381 코멘트 5개 중 4개는 일반 수집 로봇·링크 사냥꾼의 실패 알림.
근거: browser-collect.yml L262 'gh issue create' 는 신규>0 이면 매번 새 이슈, 닫는 단계 없음. 알림 L276·L294 '--search \'"수집 리포트" in:title\' --state open --limit 1' 은 일반 로봇 리포트(🤖 장학공고 수집 리포트)와 브라우저 리포트를 구분하지 않는다. #381 코멘트: 37110095633·37121388488(장학공고 수집 로봇), 37112370475·37121988077(링크 사냥꾼). revert-auto.mjs 는 browser-report.md 를 고치지 않는다.
원인: auto-register 가 리포트를 쓴 뒤 관문이 돌고, 되돌리기 결과는 로그에만 남는다. 알림 대상 이슈를 제목 낱말 하나로 찾는다.
수리안: revert-auto 가 되돌린 id 목록을 리포트 파일(인자)에 '↩ 감사 실패로 되돌린 자동 등록 n건' 문단으로 덧붙이고, 리포트 이슈 단계가 그 뒤에 돈다(이미 그렇다). 알림 검색어를 '"브라우저형 수집 리포트" in:title' 로 좁힌다. 새 리포트 이슈를 열 때 이전 브라우저 리포트 이슈를 닫는다(또는 '새 공고 0건이면 코멘트' 관례처럼 한 이슈에 코멘트).
파일: .github/workflows/browser-collect.yml, collector/revert-auto.mjs

--- [B10] P3 (confirmed, config) 쓸모없거나 틀린 후보 주소 — 서강·숙명·가천·상명, 그리고 수집 뒤에도 남은 후보를 전부 다시 연다
증상: 서강대는 매번 0건(목록이 링크·onclick 이 아닌 SPA 라 클릭 시도 0), 숙명은 첫 주소가 링크 2개라 학교 첫 화면(index.do)에서 장학 낱말 글을 긁는다, 가천은 첫 후보가 학사 공지(475)·셋째가 첫 화면, 상명 scholarship.do 는 링크 0. 매 실행 리포트에 같은 진단 줄이 10줄씩 쌓인다.
근거: 리포트 #324~#381 의 서강 '⚪ 링크 199 · 장학 공고 0 … (클릭 시도 0건) (본 글자) [교외] 해동과학문화재단 …', 숙명 '⚪ 링크 2 … scholarship-notice.do' → '✅ 링크 619 · 장학 공고 7 · …/kr/index.do', 가천 475 '(본 링크) 2026-2학기 휴학 및 휴학연장 안내 …'. collector/report.md: 서강 '✅ 정상 (실공고 25건 감지)', 숙명 '✅ 정상 (실공고 9건 감지)'. browser-collect.mjs L406·L438: harvested=true 뒤에도 for 루프가 남은 후보를 loadPage·readMorePages 로 다시 연다(같은 학교 추가 요청).
원인: 9-29 복원 때 8월의 후보 목록을 그대로 되살렸고, 일반 로봇이 정상인 학교를 빼는 정리를 하지 않았다. 수집 루프가 첫 성공 뒤에도 멈추지 않는다.
수리안: 서강·숙명(그리고 B5 의 서울대)은 _parked 로 옮기고, 가천은 7986/subview.do 를 첫 후보로 두고 475·첫 화면 후보는 뺀다. harvestTarget 은 harvested 뒤 남은 후보를 열지 않게 한다(리포트에 '건너뜀' 한 줄).
파일: collector/browser-targets.json, collector/browser-collect.mjs

--- [B11] P3 (confirmed, workflow-yaml) 예약 실행이 2~7시간 늦게 시작되고, 리포트의 '약 12시간 뒤' 안내가 사실과 다르다
증상: cron '7 23 * * *'(08:07 KST)·'7 3 * * *'(12:07 KST)인데 실제 생성 시각은 01:20~02:33 UTC, 08:30~10:00 UTC. 두 실행 간격이 약 7시간·17시간으로 갈린다.
근거: actions_list: 10-03 01:52:21·09:02:38, 10-02 02:08:54·09:37:08, 10-01 02:02:45·10:00:25, 09-30 09:34:11 (event=schedule, created_at=run_started_at). 리포트 문구 '다음 실행(약 12시간 뒤)'(browser-collect.mjs L698 부근). 작업 경고 'Node.js 20 is deprecated … forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4', setup-node node-version: 20.
원인: GitHub 예약 지연(저장소 쪽에서 원인 확인 불가). 같은 대기줄 로봇과 겹쳐 생긴 지연은 아니다(created_at 자체가 늦다).
수리안: 리포트 문구를 '다음 예약 실행에'로 바꾸고, 지연이 문제면 robot-heartbeat 쪽 판단에 맡긴다. actions/checkout·setup-node 를 Node 24 대응 판으로, node-version 을 22 이상으로 올리는 것은 별도 확인 후.
파일: .github/workflows/browser-collect.yml, collector/browser-collect.mjs

--- [B12] P2 (confirmed, none-already-fixed) (이미 고쳐짐) 9-30 수동 실행 #198 이 저장 단계 rebase 충돌로 수집분 전량 폐기
증상: run 36649509008 '결과 저장' 단계 failure — 17분치 수집분 미저장.
근거: https://github.com/seonju5543-web/hanggonggan/actions/runs/36649509008 저장 단계 conclusion=failure. 워크플로 checkout 에 ref: ${{ github.ref_name }} 추가(주석 '2026-09-30 … 3회 실패 → 그 실행의 수집분이 통째로 버려졌다'). 이후 12회 저장 성공, 10-03 09:14 은 1차 거절 뒤 rebase·푸시 성공('Successfully rebased' → '41b5cce..2aed658').
원인: 대기줄에서 기다린 실행이 큐 진입 시점 SHA 에서 시작해 앞 로봇 커밋 위로 rebase 하다 충돌.
수리안: 조치 불필요 — 수정 후 실행으로 증명됨.
파일: .github/workflows/browser-collect.yml
이미수리: browser-collect.yml checkout ref: ${{ github.ref_name }} (2026-09-30)

--- [B13] P3 (confirmed, none-already-fixed) (이미 고쳐짐) 10-01 오전 관문의 두 번째 실패 — '정식 등록도 나눌 때' 고정 검사
증상: 36803960541 에서 관문 실패 2건 중 1건.
근거: 로그 '✕   지금은 아직 말하지 않는다 (선을 안 넘었다) / 받은 값: {"over":true,…}'. 그 뒤 실행(36990817962·37087734875·37111713944)은 '✕ 실패 1건'으로 이 줄이 사라짐. CLAUDE.md 「장학금 판정 자동화」 절에 '지금은 숫자만 보인다'로 기록.
원인: 실데이터에 기댄 고정 검사가 44개교 복원 뒤 선을 넘나듦.
수리안: 조치 불필요.
파일: verify/test-collector.mjs, verify/data-weight.cjs
이미수리: 관문의 '지금은 선 아래' 고정 줄 제거(10-01) — 이후 실행에서 재발 없음

NOTES: 점검 범위: browser-collect.yml 최근 20회 실행 목록, 실패·감사 실패 6회 중 4회의 전체 작업 로그(36803960541·36990817962·37087734875·37111713944 — 실패 테스트 줄과 학교별 소요 시간을 직접 grep), 브라우저 리포트 이슈 #324·#327·#333·#340·#346·#366·#368·#381 본문·코멘트, collector/ 장부(seen.json·health.json·browser-bodies.json·notices-text.json·browser-cursor.json·data/notices/index.json), 코드(browser-collect.mjs 전문·harvest-budget·url-key·revert-auto·auto-register 상한·notice-source·deepfetch --fill)를 확인했다. 오프라인 확인: node --check 통과, 순수 모듈로 parse-requirements(gradTarget/mentionsUndergrad)·match-engine fitDetail·urlKey·needsFetch 실측. 일회용 worktree 에서 auto-register 재현을 시도했으나 권한 분류기가 막아 실행하지 않았고(worktree 는 제거함), 대신 CI 로그의 실패 줄과 원문으로 원인을 확정했다.

가장 급한 것: B1(관문 실패 고리) — 브라우저·일반 수집 로봇 양쪽의 자동 등록이 10-01부터 사실상 멈춰 있다. 파서 수리 전이라도 DAAD 1건(auto-notiphpcodes1301seq11193)을 blockIds 에 넣으면 나머지 7건이 다음 실행에 들어간다(개발자 확인 필요). 다른 그룹(일반 수집·데이터 관문)과 원인이 같으니 한 번에 고칠 것.

학생 영향: 홍익대(B2)는 실시간 공고 0건(학교별 파일 없음) — 규칙상 P0 로 올려도 무방하다. 서울시립대(B3)는 2건뿐. 둘 다 학교 사이트를 이 샌드박스에서 열 수 없어 원인 주소는 probe-run 정찰로 확인해야 한다(규칙 5 — 단정하지 않음).

예산: 수집 단계 약 8분/예산 22분/단계 상한 26분/작업 상한 50분 — 안에 끝난다. 그 8분 중 7분 30초가 서울대 한 곳(B5)이다. 결과는 매번 저장·푸시되고 deploy-sync 대상이다.

schools.json collector:"browser" 5곳(경희·시립·동국·홍익·상명)은 전부 browser-targets.json 에 있다(대조 완료) — 다만 그중 홍익·시립 두 곳은 브라우저도 못 읽는다.

아직 증명 안 된 수정: 10-03 11:04 UTC 커밋 3bde4563(원문 확인을 judgeLanding 으로)이 browser-collect.mjs 에 들어갔지만 마지막 브라우저 실행은 09:02 UTC 라 실전 결과가 없다. 다음 실행 리포트의 '(원문 확인 탈락·판정 불가)' 줄과 #n- 표식 비율을 봐야 한다.

곁가지(다른 그룹 몫): collector/extracted/elig-* 원본 90개(그림·hwp·pdf)가 사람 커밋 247b89f9 로 저장소에 올라가 있다 — CLAUDE.md 의 activity-docs '받은 파일은 커밋 안 함'과 어긋난다. 브라우저 워크플로는 git add collector/extracted 를 하므로 같은 폴더에 원본이 생기면 같이 커밋된다. 양식 스키마화 단계는 매 실행 '무료 0 · API 0 · 보류 59'로 아무것도 바꾸지 않는다(apiEnabled:false — 사람 판단 사항).

스크래치: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/browser/ (r*.log 작업 로그 4개, issue-*.md 리포트 본문, nf.mjs needsFetch 실측 스크립트).


######## GROUP collect

--- [collect-01] P0 (confirmed, data) 09-30 병합기 잘림으로 실시간 공고 222건이 학생 화면에서 사라진 채 복구되지 않음
증상: 서울과기대·건국대·가천대·전남대·한국외대·영남대·연세대 등 16개교 학생의 '실시간 공고'(학교별 파일)에 09-30 수집분이 없다. 예: 건국대 '[교외] 2026학년도 고속도로 장학생 선발 안내(9. 14. ~ 10. 11.)', 연세대 '2027 독일정부초청장학생 (DAAD) — 마감 2026년 10월 30일', 영남대 '논산시장학회 학업장려 장학생 (~10.30)' 등 아직 열려 있는 공고가 피드에도 정식 등록에도 없다. 건국대는 게시판 25건 감지인데 피드 1건.
근거: run 36652803481(09-30 00:57 dispatch) 로그 217행 'collected: 10 new items; notices.json now has 470 items' → 4246행 push rejected → 4257행 '[merge-json-union] 자동 병합 완료: data/notices.json' → 커밋 ab897c3b 의 notices.json 200건(직전 27f38160 은 460건 · 충남 8/충북 6/방송통신대 4 → 0). 지금 notices.json·data/notices/*.json 과 27f38160 판을 urlKey·titleKey 로 대조: 222건 소실, 그중 179건은 registered.json 에도 없음(foundAt 2026-09-30 153건). 해당 URL 들은 seen.json 에 있어 수집기가 다시 담지 않는다(collect.mjs:408). b75c58b6(10-03 16:49)은 병합기 상한을 capNotices 로 고치고 10-03 의 339→200 잘림만 되살렸다(커밋 메시지 '사냥꾼 판(339) + …').
원인: tools/merge-json-union.mjs 의 mergeNotices 가 '전체 200건' 고정 상한을 갖고 있었고(b75c58b6 diff: `if (items.length > 200) items = items.slice(0, 200);`), 09-30 수집 로봇이 브라우저 수집 push 위로 rebase 하면서 이 병합기를 거쳐 470→200건으로 잘렸다. 잘린 글은 seen.json 에 '봤다'로 남아 영구 손실이 됐다. 병합기 코드는 10-03 에 고쳐졌지만 09-30 손실분 데이터는 되살리지 않았다.
수리안: ① 데이터 복구: 27f38160 판 notices.json(460건)과 현재 판을 dedupeNotices 로 합치고 60일·dropUnserved·isAttachmentEntry 를 다시 걸어 notices.json 을 재구성한 뒤 publishBySchool(전체 목록)로 학교별 파일을 다시 발행(b75c58b6 과 같은 방식). collector/candidates.json 에도 같은 글이 있어 교차 확인 가능. ② 재발 방지는 collect-05(자가 회복) 참조. 복구 뒤 auto-register 가 이 글들을 등록 후보로 다시 보게 된다.
파일: data/notices.json, data/notices/, tools/merge-json-union.mjs, collector/seen.json, collector/candidates.json

--- [collect-02] P1 (confirmed, code) 데이터 관문이 6회 연속 같은 테스트로 실패 → 자동 정식 등록이 2일째 전부 되돌려짐
증상: 10-02 01:47 이후 수집 로봇 6회 연속(10-02 ×3, 10-03 ×3) '감사 실패 시 자동 등록분 되돌리기'가 돌았다. 매번 같은 8건(하나금융나눔재단 국내 하나장학생 ~10/06, 세종대 학업수석총장장학금, 이화여대 선원가족장학금, 광운대 든든 학업지원금, 한국항공대 DAAD 등)을 등록했다가 버린다. maxPerRun 8 이라 뒤의 26건은 아예 검토되지 않는다 — 자동 등록이 사실상 멈췄다.
근거: 6개 실행 로그 모두 '✕ 등록 공고 전수 — 대학원 전용인데 점수가 매겨진 것이 없다 / 받은 값: ["auto-notiphpcodes1301seq11193"] / 기대 값: []' 한 건만 실패(job 111198029129 3504행, 110668647522, 110775104457, 110850404775, 111096054317, 111166147052). verify/test-collector.mjs:7972-7980 은 대학원 전용 줄이 있는 등록분 중 `!ME.fitDetail(it, prof).unread` 인 것을 bad 로 잡는데, 같은 절 7948-7951 의 ①은 '대학원 전용 공고는 미달이다' → `[!!gradOnlyFd.unread, fails.length] = [false, 1]` 을 요구한다. 로컬 재현: eligibilityLines ['독일 소재 대학 섬머코스 참가 희망 대학원 석사과정 재학생'] → gradTarget 'body', unread false, fails 1 → 데이터 테스트에 걸림. auto-register 의 NOT_UNDERGRAD 는 제목만 본다(auto-register.mjs classify) — DAAD 제목엔 '대학원'이 없고, 자격 줄은 뒤 단계(deepfetch --fill → extract-excerpts)가 채운다. 로컬 HEAD 에서 auto-register 만 돌리면 본문이 없어 재현되지 않는다(관문 통과).
원인: 관문 테스트가 09-12 의미 변경(대학원 전용 = '자격 미확인'이 아니라 '미달')을 따라가지 않아, 대학원 전용 공고가 하나라도 등록되면 무조건 실패하는 '실데이터에 기댄 고정 검사'가 됐다(CLAUDE.md 가 금지한 유형). 여기에 revert-auto.mjs 가 문제 id 가 아니라 '이번 실행 새 auto 항목 전부'를 빼고, 다음 실행이 같은 8건을 다시 고르는 구조라 무한 반복된다.
수리안: ① test-collector.mjs:7978 의 판정을 ①과 같게 — 대학원 전용 등록분은 `fitDetail(...).fails.length >= 1`(미달)인지 보도록 바꾸고 red-green(① 의미로 되돌리면 실패) 확인. ② 대학원 전용을 등록 자체에서 빼고 싶다면 그 규칙은 entry-rules.cjs checkEntry 경고/오류 + extract-excerpts 이후 단계(예: kind-classify 옆)에서 auto 항목을 '컨펌 대기'로 내리는 로봇 쪽에 둔다(관문의 고정 데이터 검사로 두지 않는다). ③ revert-auto 는 관문이 지목한 id 만 빼거나, 되돌린 id 를 auto-register 가 다음 실행에 건너뛰도록(blockIds 후보 기록) 해 같은 8건 무한 반복을 끊는다.
파일: verify/test-collector.mjs, collector/revert-auto.mjs, collector/auto-register.mjs, verify/entry-rules.cjs

--- [collect-03] P1 (confirmed, workflow-yaml) 감사 실패 경보가 브라우저 리포트 이슈로 가고, 수집 리포트에는 같은 시각 '정상 실행'이 붙는다
증상: 6회 연속 관문 실패·자동 등록 되돌림을 아무도 처리하지 않았다. 개발자가 보는 장학공고 수집 리포트(#380)에는 '🤖 … 수집 로봇 정상 실행 — 새 공고 0건' 코멘트만 달리고, 실패 경보는 '🖥 브라우저형 수집 리포트'(#381·#368)에 붙는다. 커밋된 collector/report.md 와 이슈 본문은 '자동 등록 — 8건 등록'이라고 적는다(실제로는 0건).
근거: collect-scholarships.yml:362-364 '🚨 데이터 감사 실패 알림'만 `--search '"수집 리포트" in:title'`(다른 알림 단계는 '"장학공고 수집 리포트"'). 이슈 #381 코멘트: 10-03 17:40·21:09 KST '데이터 감사 실패 — 이번 자동 등록분은 되돌렸습니다'(run 37110095633·37121388488) — 같은 분에 #380 에는 '수집 로봇 정상 실행'(job 로그 12:09:56 #380 / 12:09:57 #381). report.md 216행 '### 🤖 자동 등록 (선조치후보고) — 8건 등록'(커밋 909ce8a5) — revert-auto.mjs 는 report.md 를 고치지 않는다.
원인: 알림 단계마다 이슈 검색어가 달라 감사 실패 알림만 '수집 리포트' 부분 일치로 더 최근의 브라우저형 리포트를 집는다. 0건 알림은 관문 결과를 보지 않고 '정상'이라 쓴다. 되돌리기 로봇은 리포트를 갱신하지 않는다.
수리안: ① 감사 실패 알림의 검색어를 '"장학공고 수집 리포트" in:title' 로 통일. ② 0건 알림은 `steps.audit.outcome == 'success'` 일 때만 '정상 실행'이라 쓰고, 실패면 '수집은 정상 · 자동 등록 되돌림' 으로. ③ revert-auto.mjs 가 report.md 에 '되돌림 N건(이유: 관문 실패 테스트명)'을 덧붙이고 '8건 등록' 줄을 고친다. ④ 같은 테스트로 연속 N회(예: 2회) 되돌리면 새 이슈를 연다.
파일: .github/workflows/collect-scholarships.yml, collector/revert-auto.mjs, collector/report.md

--- [collect-04] P1 (confirmed, code) 한국항공대 공고 제목에 '부서·게시일·조회수'가 붙고, 19건 모두 다른 글의 접수기간 줄이 달린다
증상: 한국항공대 학생 화면의 실시간 공고 19건 제목이 '2026년 하반기 인재육성 성취(대) 장학생 선발 안내 학생지원팀 2026-09-28 142' 처럼 보이고, 카드 기간 줄은 전부 '접수기간 : 2026.10.15.(목) 13:30까지 2026 동계 어학연수 (Advanced Language Program)모집 안내 자세히' 로 같다(남의 글). 정식 등록 3건(auto-notiphpcodes1301seq11120·11234·11207)도 카드 제목에 같은 꼬리가 붙는다.
근거: data/notices/n1as48ix.json 19건 전부 동일 deadlineHint · 제목 꼬리 '학생지원팀 YYYY-MM-DD 조회수'. node verify/what-shows.mjs auto-notiphpcodes1301seq11234 --school=한국항공대학교 → '카드 제목 「2026년 하반기 인재육성 성취(대) 장학생 선발 안내 학생지원팀 2026-09-28 142」'. cleanTitle('독일 정부초청(DAAD) … 학생지원팀 2026-09-17 437') 이 입력 그대로 반환(로컬 실측) — clean-title.mjs 는 'YYYY.MM.DD. 조회 N'·'조회수 N' 꼴만 뗀다(62-64행). app.js:2923 noticeCardHtml 은 `esc(unent(n.title))` 를 그대로 그린다. 같은 현상은 08-17 감사 커밋 8d5f034 메시지에 '한국항공대 게시판은 제목·부서·작성일·조회수를 한 칸에 그린다'로 이미 기록됐으나 감사 지문에만 반영됐다.
원인: ① 항공대 목록은 <a> 안에 제목·부서·작성일·조회수를 함께 넣는데 cleanTitle 에 '부서명 + YYYY-MM-DD + 숫자' 꼬리 규칙이 없다. ② deadlineHintFrom 은 상세 페이지 전체 글자에서 이름표를 찾으므로, 본문에 기간 이름표가 없는 항공대 글은 사이드 배너('…모집 안내 자세히')의 접수기간을 집는다 — HINT_JUNK 에 '자세히'가 없고 사이트 공통 껍데기를 걷지 않는다.
수리안: ① clean-title.mjs 에 '(부서|팀|처|과)\s+20\d{2}-\d{2}-\d{2}\s+[\d,]+$' 꼬리 규칙 + 관문(항공대 실제 제목 표본). ② deadline-hint 는 같은 사이트 여러 글에 공통으로 나오는 문장을 걷어낸 본문(page-boilerplate.mjs makeStripperMulti — kind-classify 가 이미 씀)에서 찾거나, 한 학교 여러 글이 같은 힌트를 가지면 버리는 규칙. ③ 소급(원칙 7): notices.json·학교별 파일·registered.json 의 항공대 제목/힌트를 다시 정리(registered 는 tools/admin-apply.mjs).
파일: collector/clean-title.mjs, collector/deadline-hint.mjs, collector/collect.mjs, data/notices/n1as48ix.json, data/registered.json

--- [collect-05] P1 (confirmed, code) seen.json 이 '피드에서 빠진 글'까지 막아 재수집이 안 된다 — 잘림·학교 복원 뒤 자가 회복 없음
증상: 44개교 복원(09-29) 뒤에도 8월에 이미 본 글은 돌아오지 않았다. 한양대는 게시판 '실공고 15건 감지'인데 피드 0건·학교별 파일 없음, 홍익대 0건, 조선대 44건 감지에 1건, 영남대 17건에 1건, 부경대 17건에 1건. collect-01 같은 데이터 손실이 생기면 로봇이 스스로 되살리지 못한다.
근거: collect.mjs:408 `const fresh = items.filter((i) => !seen[i.url] && !seen[urlKey(i.url)])` — notices.json 에 있는지는 보지 않는다. notices.json 은 09-29 시점 61건(2개교) → 복원 첫 실행 0398c86a 에 한양대 0. seen.json 한양대 키 24개(날짜 2026-08-01~08-12), candidates.json 한양대 3건. 60일 창 안의 서비스 학교 후보(candidates.json, dedupe 후) 1562건 중 피드·학교별 파일에 없는 것 1207건(대부분 08-04~08-29 foundAt). publish-notices.mjs:101-103 주석 '되돌리기는 쉽다 — parked 에서 학교를 되살리고 … 그날 수집부터 다시 담긴다'는 seen 때문에 사실과 다르다.
원인: '이미 봤다'(seen)와 '학생에게 보이고 있다'(notices.json)를 하나로 취급한다. dropUnserved(08-30 축소)·병합기 잘림 등으로 피드에서 빠진 글이 seen 에 남아 영원히 재수집 대상에서 빠진다.
수리안: collect.mjs 발행 직전에 candidates.json 에서 '서비스 학교 · foundAt 60일 안 · 첨부/메뉴 아님 · notices.items 에 urlKey/titleKey 둘 다 없음'인 글을 다시 넣는 자가 회복 단계를 둔다(관문: 피드에서 지운 글이 다음 실행에 되돌아오는지 red-green). 8월분까지 되살릴지는 개발자 결정(대부분 마감 지남 — 마감 읽힌 것만 넣는 선택지). publish-notices.mjs 주석도 고친다.
파일: collector/collect.mjs, collector/publish-notices.mjs, collector/candidates.mjs, collector/seen.json

--- [collect-06] P1 (confirmed, human-decision) 서비스 학교 중 분교 3곳은 어느 로봇도 게시판을 안 읽어 실시간 공고 0건
증상: 연세대학교 미래캠퍼스·고려대학교 세종캠퍼스·동국대학교 WISE캠퍼스 학생은 SERVED_SCHOOLS 에 들어 있어 학교 선택은 되지만 실시간 공고가 하나도 없다. health.json 에도 안 들어가 연속 실패 경보가 안 뜬다.
근거: schools.json 44곳·browser-targets.json 19곳·match-engine.js SERVED_SCHOOLS 44곳은 서로 일치(학교 이름 차집합 0). 그러나 boardUrl 없는 7곳 중 고려대·중앙대·부산대·계명대는 브라우저 담당이고, 위 3곳은 browser-targets 에도 없다. report.md: '⚙️ 게시판 주소 미설정 (자동 탐색 실패…)' 3곳 · data/notices/index.json 에 세 학교 없음 · notices.json 0건. find-boards-report.md: '🟡 연세대학교 미래캠퍼스 — 홈페이지 못 엶 (HTTP 404)' · '🟡 고려대학교 세종캠퍼스 — 최고 0건' · '🟢 동국대학교 WISE캠퍼스 후보: https://wise.dongguk.ac.kr/main … → 관리자 「게시판 주소 추가」로 넣어 주세요'. collect.mjs:637 은 '게시판 주소 미설정'을 실패로 세지 않는다.
원인: 게시판 주소를 아직 못 찾은 분교를 서비스 학교로 열어 두었고, 주소 없음은 health 장부 밖이라 조용하다. 동국대 WISE 는 후보가 나왔지만 사람이 넣지 않았다. 연세대 미래캠퍼스는 씨앗 홈페이지 주소가 404.
수리안: ① 동국대 WISE 후보 주소를 원문 확인 뒤 schools.json boardUrl 로(관리자 「게시판 주소 추가」 또는 run-probe.txt checkUrl 정찰 후). ② 연세대 미래캠퍼스 school-board-seeds.json 씨앗 주소 교정. ③ 고려대 세종은 개발자에게 주소 요청. ④ 리포트 머리에 '서비스 중인데 게시판이 없는 학교 N곳'을 한 줄로 늘 보이게.
파일: collector/schools.json, collector/school-board-seeds.json, collector/find-boards-report.md, match-engine.js

--- [collect-07] P2 (likely, code) 항공대 5월 게시 글이 마감 근거 없이 자동 등록 대상으로 뽑힌다
증상: 되돌려진 8건 중 '2026년 2학기 청년창업농장학금 신청 안내 학생지원팀 2026-05-22 658', '2026학년도 산학협동재단 장학생 선발 안내 학생지원팀 2026-05-19 738', '세종연구원 … 2026-05-11' 은 5월 게시 글이다. collect-02 가 고쳐지면 마감 없이(listedAt+60일) 정식 등록돼 이미 끝난 공고가 열린 장학금처럼 보일 수 있다.
근거: job 111198029129 4476-4478행 · 110668647522 되돌림 목록. data/notices/n1as48ix.json 의 해당 글 foundAt 2026-09-30(복원 첫 수집 때 처음 봄) · 주소 일부는 목록 표식 '#n-'(auto-780ec9b90ed8c80202026052). auto-register.mjs parseDeadline 은 `${n.title} ${n.deadlineHint}` 에서 '~날짜'·'날짜까지/마감'만 읽고 게시일은 보지 않는다.
원인: 게시일이 제목 꼬리에 섞여 들어오는 게시판(항공대)에서 '오래된 글' 판정이 없고, foundAt 이 실제 게시일이 아니라 우리가 처음 본 날이다.
수리안: collect-04 의 제목 정리 때 게시일(postedAt)을 따로 떼어 저장하고, auto-register 가 postedAt 이 예컨대 90일 넘은 글은 '컨펌 대기(옛 글)'로 내린다 — external-clean.mjs dropReason 의 postedAt 규칙과 같은 방식.
파일: collector/auto-register.mjs, collector/clean-title.mjs

--- [collect-08] P2 (confirmed, config) 대외활동 출처 13/23곳·재단 게시판 4/20곳이 2주째 불통인데 경보가 없다
증상: 수집 리포트마다 같은 ⛔/⚠️/🟡 줄이 14회 연속 반복되지만 연속 실패 경보·이슈가 없다. 매 실행 robots.txt 조회·접속 시간을 쓴다.
근거: report.md 이력 19개(09-29~10-03) 집계: 한국외대 대외활동 「학생활동」「진로·취업」·정부24·한국콘텐츠진흥원·인천유스톡톡 ⛔ robots.txt ×14, 경희대 대외활동·청년재단 ⚠️ HTTP 404 ×14, 경희대 「취업/경력」「사회진출」·온통청년·서울시 청년몽땅·KOICA·문화포털·광주청년 🟡 0건 ×14 · 재단: 한국고등교육재단 ⛔ ×13, 한진해운장학재단 ⛔ ×12, 롯데장학재단·미래에셋박현주재단 🟡 ×13. collect.mjs:617-621 주석대로 활동·재단 게시판은 health.json 에 넣지 않는다.
원인: 활동·재단 게시판은 prune-health 가 지울까 봐 health 장부에서 일부러 뺐고, 대신 쓸 연속 실패 장부가 없다.
수리안: ① 지금 죽은 출처는 관리자 「활동」 탭 보관(activitySource)·external-sources parked 로 옮기거나 주소 교정(404 두 곳). ② 활동·재단용 별도 연속 실패 장부(예: source-health.json, 열쇠는 boardUrl)를 두고 3회 연속이면 리포트 머리에 올린다.
파일: collector/activity-sources.json, collector/external-sources.json, collector/collect.mjs

--- [collect-09] P2 (confirmed, code) '재단·지자체 새 공고'에 마감 지난 글 6건이 계속 실린다
증상: 홈의 '재단·지자체 새 공고'에 2026-05-29·06-24·07-31·09-18 마감 글(송파구인재육성 상반기·해외문화체험, 슬로바키아 정부초청, 군민평생 장학생 등)이 '마감' 배지를 달고 '새 공고'로 남아 있다.
근거: data/external.json 48건 중 deadline < 2026-10-04 인 것 6건. app.js:3193-3199 externalNoticesForMe 는 등록 여부만 거르고 마감을 보지 않는다. collect.mjs:575-579 dropReason(external-clean.mjs:72-)은 postedAt 나이·제목 연도만 본다.
원인: 외부 피드 발행·화면 어느 쪽에도 '마감 지난 글 빼기'가 없다(학교 피드는 제목+링크라 마감이 없지만 재단 글은 마감을 읽어 둔다).
수리안: external-clean.mjs dropReason 에 'deadline 이 오늘보다 앞이면 마감 지난 글' 규칙을 넣어 매 실행 소급(합집합 병합이 되살린 글도 걸러짐). 화면 쪽은 손대지 않아도 된다.
파일: collector/external-clean.mjs, collector/collect.mjs, app.js

--- [collect-10] P2 (confirmed, code) 누락 감사가 44개교로는 한 번도 안 돌았고, 돌아도 피드 손실을 못 본다
증상: 주 1회 누락 감사의 마지막 결과(09-29)는 2개교만 본 것이다. 또 '우리가 가진 공고'에 candidates.json 을 넣어, collect-01·05 처럼 학생 피드에서 사라진 글도 '가지고 있음'으로 센다 — 이 감사로는 그런 손실이 영영 안 드러난다.
근거: coverage-report.md '감사한 학교: 2곳' · run 36505890112(09-29 01:01 UTC, 3분). audit-coverage.mjs:75-84 `for (const n of [...notices, ...candidates])`. 워크플로 cron '23 21 * * 1' 주석 '매주 월요일 06:23 KST' — 실제는 UTC 월요일=KST 화요일(09-29 실행은 KST 화 10:01). 문서 주석 'AUDIT_BUDGET_MS(기본 20분)' ↔ 코드 35분.
원인: 감사의 대조 대상이 '학생이 보는 것'이 아니라 '로봇이 한 번이라도 주운 것'이다. 복원 뒤 예약이 아직 안 왔다.
수리안: ① '가진 것'을 notices.json + data/notices/*.json + registered.json 으로 바꾸고, candidates 에만 있는 글은 '수집했지만 피드에서 빠짐'이라는 별도 원인으로 센다. ② 주석의 요일·예산 수치 교정. ③ 수리 뒤 run-audit-coverage.txt push-to-run 으로 44개교 첫 결과를 확인.
파일: collector/audit-coverage.mjs, .github/workflows/audit-coverage.yml

--- [collect-11] P3 (confirmed, secret-or-external) 예약 실행이 2.7~7시간 늦게 시작한다
증상: '07:41 KST' 예약은 실제 10:23~10:47 KST, '11:41' 은 17:33~18:25 KST, '15:41' 은 20:59~22:51 KST 에 돈다. 오후 공고는 밤에야 앱에 실린다.
근거: list_workflow_runs: 10-03 created_at 01:23·08:33·11:59 UTC, 10-02 01:47·09:00·13:08, 10-01 01:31·09:25·13:51 — cron 22:41·02:41·06:41 UTC 대비. created_at 과 run_started_at 이 같아 대기줄(concurrency) 대기가 아니라 GitHub 예약기의 지연이다.
원인: GitHub Actions schedule 은 부하 시 지연·생략될 수 있다(워크플로 주석이 이미 인정). 원인은 GitHub 쪽이라 저장소 안에서 고칠 수 없다.
수리안: 정시성이 필요하면 외부 크론(예: Cloudflare Workers Cron)이 workflow_dispatch/repository_dispatch 를 부르게 하는 것을 개발자가 결정. 그 전까지는 주석의 KST 시각을 '예약 시각(실제는 수 시간 늦을 수 있음)'으로 고친다.
파일: .github/workflows/collect-scholarships.yml

--- [collect-12] P3 (confirmed, code) 색인에서 빠진 학교별 고아 파일 3개가 09-30 상태로 굳어 있다
증상: 충남대·충북대·방송통신대 학생은 09-30 에 모은 글(8·6·4건)을 계속 본다. 새 글이 생기면 파일이 통째로 갈려 그 글들은 사라진다. 앱은 나이 거르기가 없어 60일이 지나도 안 사라진다.
근거: data/notices/ 파일 39개 중 index.json 에 없는 것: n16l2078.json(충북대 6) · n1uf7bji.json(한국방송통신대 4) · nl1xm19.json(충남대 8), 모두 updatedAt 2026-09-30. publish-notices.mjs:57-59 '사라진 학교의 옛 파일은 지우지 않는다 … 60일 규칙으로 늙어 사라진다' — 파일은 다시 안 쓰이므로 늙지 않는다. app.js:2825 boardNoticesForMe 에 foundAt 거르기 없음.
원인: collect-01 잘림으로 세 학교가 notices.json 에서 0건이 되자 publishBySchool 이 색인에서만 뺐고 파일은 남겼다.
수리안: collect-01 복구로 세 학교 글을 notices.json 에 되살리면 정상 파일이 된다. 재발 방지로 publishBySchool 이 색인 밖 파일의 글에도 60일 규칙을 적용해 다시 쓰도록(지우지는 않음).
파일: collector/publish-notices.mjs, data/notices/n16l2078.json, data/notices/n1uf7bji.json, data/notices/nl1xm19.json

--- [collect-13] P3 (confirmed, code) 양식 대기열에 등록분이 없는 고아 64건 — 되돌린 자동 등록분도 남는다
증상: 스키마화 리포트가 매 실행 '건너뜀 64건 — registered.json에 항목 없음'을 적는다(2014·2016학년도 글 포함). 되돌린 auto-otice06doarticleno140331·auto-780ec9b90ed8c80202026051 도 대기열에 남아 있다.
근거: collector/report.md '**건너뜀 64건**' 절 · grep: 위 두 id 가 collector/pending-forms.json 에 1회씩, data/registered.json 에 0회. revert-auto.mjs 는 registered.json 만 고친다.
원인: auto-register 가 등록과 함께 대기열에 넣지만, 되돌리기·관리자 삭제·blockIds 제거 때 대기열을 정리하는 곳이 없다.
수리안: revert-auto 가 뺀 id 를 pending-forms.json 에서도 지우고, pending-targets.mjs·schematize 가 registered 에 없는 id 를 retired 로 표시해 대기열에서 내린다.
파일: collector/pending-forms.json, collector/revert-auto.mjs, collector/pending-targets.mjs

--- [collect-14] P3 (likely, code) 범위 승격이 '마감 전만'이라는 문서 규칙을 코드로 확인하지 않는다
증상: CLAUDE.md 는 '승격은 로봇 등록·교외·사람 미지정·마감 전만'이라 적었으나, 마감 지난 학교 한정 공고도 전국으로 풀릴 수 있다(풀리면 마감+30일 동안 모든 학생에게 '마감' 카드로 보임).
근거: collector/scope-promote.mjs isCandidate: `it.auto && it.type === '교외' && e.schoolOnly && !/^관리자/.test(it.scopeFrom || '')` — deadline 조건 없음. registered-merge.mjs 도 마감 비교 없음.
원인: 문서와 코드가 갈라졌다.
수리안: isCandidate/isNationalAbsorber 에 `!it.deadline || it.deadline >= TODAY` 를 더하고 관문 「장학금 판정 자동화 · 범위 승격」에 마감 지난 표본을 넣는다.
파일: collector/scope-promote.mjs

--- [collect-15] P3 (confirmed, none-already-fixed) 서강대 인증서 오류 3회 연속(10-01) — 이미 수리됨
증상: 09-30~10-01 서강대 게시판이 'TypeError: UNABLE_TO_VERIFY_LEAF_SIGNATURE' 로 8회 실패, 10-01 14:04 리포트에 3회 연속 경보.
근거: reports 이력 5e3bfba5.md '서강대학교 (3회 연속) — 오류 (TypeError: UNABLE_TO_VERIFY_LEAF_SIGNATURE)'. 워크플로 env NODE_EXTRA_CA_CERTS 가 sectigo-…pem(09-30 로그 54행) → collector/certs/bundle.pem 으로 바뀐 뒤 10-02 01:58 부터 6회 연속 '✅ 정상 (실공고 25건 감지)'. (각 로그 54행의 'Ignoring extra certs … No such file' 경고는 checkout 단계에서 파일이 아직 없을 때만 나며 무해.)
원인: 서버가 중간 인증서를 안 보내 Node 만 실패 — 번들로 해결.
수리안: 조치 불필요.
파일: collector/certs/bundle.pem, .github/workflows/collect-scholarships.yml
이미수리: NODE_EXTRA_CA_CERTS: collector/certs/bundle.pem (10-02 이후 실행 6회 정상)

--- [collect-16] P3 (likely, code) 브라우저 담당 4개교는 판정 로봇이 학교 도메인을 모른다 · 로봇 Node 20 은 지원 종료판
증상: kind-classify·scope-promote 는 학교 도메인을 schools.json boardUrl 에서만 읽어 고려대·중앙대·부산대·계명대(주소는 browser-targets 에 있음)는 '학교 도메인 이메일' 교내 증거를 못 쓴다. 워크플로가 setup-node node-version 20 을 쓴다(Node 20 은 2026-04 지원 종료 · 로그에 'Node.js 20 is deprecated' 경고).
근거: kind-classify.mjs/scope-promote.mjs `domainOf = (school) => { const row = schools.find((x) => x.school === school && x.boardUrl); …}` · schools.json 에서 위 4곳 boardUrl 없음. collect-scholarships.yml:58 `node-version: 20`, audit-coverage.yml:36 동일. job 로그 마지막 줄 '##[warning]Node.js 20 is deprecated'.
원인: 도메인 표를 schools.json 하나에서만 읽는다 · 런타임 버전 고정이 낡았다.
수리안: domainOf 가 browser-targets.json 의 주소도 보게 하고, 워크플로 node-version 을 22 로 올린 뒤 관문 통과 확인.
파일: collector/kind-classify.mjs, collector/scope-promote.mjs, .github/workflows/collect-scholarships.yml, .github/workflows/audit-coverage.yml

NOTES: 진단 전용 — 저장소 파일은 하나도 바꾸지 않았다. 재현용 작업 트리 둘(scratchpad/collect/wt · wt909)은 만들어 쓴 뒤 지웠다(본 체크아웃 git status 깨끗).

핵심 세 가지:
(1) P0 collect-01 — 09-30 01:31 수집 실행이 rebase 하며 합집합 병합기(당시 '전체 200건' 고정)에 notices.json 이 470→200건으로 잘렸고(run 36652803481 로그 '[merge-json-union] 자동 병합 완료'), seen.json 때문에 다시 수집되지 않아 지금도 16개교의 열린 공고 222건(정식 등록에도 없는 것 179건)이 학생 화면에 없다. 병합기는 10-03 b75c58b6 에서 고쳐졌지만 그 커밋은 10-03 잘림만 되살렸다.
(2) P1 collect-02 — 10-02 01:47 이후 수집 로봇 6회 연속 데이터 관문이 같은 한 줄(test-collector.mjs:7980 '대학원 전용인데 점수가 매겨진 것이 없다', 대상 auto-notiphpcodes1301seq11193 DAAD)로 실패해 매번 자동 등록 8건이 통째로 되돌려졌다. 이 테스트는 같은 절의 ①('대학원 전용은 미달 · unread=false')과 정반대를 요구해 대학원 전용 등록분이 하나만 생겨도 무조건 빨간불이다(로컬에서 확인). 로컬 HEAD 에서 auto-register 를 돌려도 재현되지 않는 이유는 자격 줄이 클라우드의 deepfetch --fill → extract-excerpts 뒤에야 채워지기 때문이다.
(3) P1 collect-03 — 그 실패 알림은 '"수집 리포트" in:title' 검색 때문에 브라우저형 리포트(#381)로 갔고, 장학공고 수집 리포트(#380)에는 같은 분에 '정상 실행' 코멘트가 달렸다.

질문별 답: 예산·회전 — 09-30 13:09 이후 14회 연속 87곳 전부 완주(3분44초~6분25초), 굶는 학교 없음. health.json — 충남대 1회 타임아웃뿐, 반복 실패 학교 없음(서강대 인증서 문제는 10-02 수리). auto-register·kind-classify·scope-promote — 셋 다 매 실행 오류 없이 돌지만 자동 등록분은 관문 실패로 매번 버려진다(kind-classify 0 flipped·2 candidates, scope-promote 0). data/external.json — 매일 갱신(updatedAt 10-03), 새 글은 10-02가 마지막, 마감 지난 글 6건. schools.json·browser-targets.json·SERVED_SCHOOLS — 이름은 44/19/44로 일치하나 분교 3곳(연세대 미래·고려대 세종·동국대 WISE)은 어느 로봇도 안 읽어 0건.

다른 그룹에 넘길 것: 링크 사냥꾼 run 37121988077(10-03 12:10)·37112370475 의 '감사 실패로 결과 전량 폐기'는 이 그룹 테스트가 아니라 '근거 없는 마감이 3건을 넘지 않는다 (지금 4건: auto-rnoticedoarticleno154473, auto-c839d20ec84a0ebb09c20202, auto-09c6eab8b020ec9ea5ed9599, reg-partner-foundation)' 문턱 테스트 실패다(job 111199754793) — 이것도 실데이터에 기댄 고정 문턱이라 같은 유형. 스키마화는 '무료 자동 0건 · API 0건 · 보류 59건 · 대기 83건'(apiEnabled:false)으로 사실상 멈춰 있다(양식 그룹 소관). 활동 첨부·포스터 단계는 '자격 0줄인 활동 글 101건 남음 (전체 188)'.

로그 원문 사본: /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/collect/ (job-121.log 등 · reports/<sha>.md 수집 리포트 이력 19개 · notices-27f3.json 잘리기 전 판 · lost.mjs·missing2.mjs 대조 스크립트).


######## GROUP bodies

--- [bodies-1] P0 (likely, code) 자격요건 로봇이 4번째 공고(서울대 학생처 글)에서 매번 멈춰 9-30부터 성과 0 — 공고 단위 시한도 중간 저장도 없음
증상: 9-30·10-01·10-02 예약 실행 3회가 모두 25분 시간 초과로 취소. 매번 앞 3건(제주 미래이음·코나아이·경희꿈도전)만 ✅ 찍고 4번째에서 23분 멈춘 뒤 강제 종료돼, 그 3건마저 저장되지 않았다('새로 확보한 본문이 없습니다'). 학생 화면: 등록 152건 중 61건이 자격 미확인이고 그중 50건은 아직 학생에게 보이는 공고다. 46건은 읽을 원문 자체가 없는데, 이걸 진짜 브라우저로 받아 오는 로봇은 이것 하나뿐이다.
근거: run 37079524380 로그: '2026-10-02T23:53:04Z [rescue] ✅ 공통 [공통] 2026학년도 2학기 경희꿈도전장학 신청' → '2026-10-03T00:16:49Z ##[error]The operation was canceled.' (run 36943510070·36793750306 도 같은 줄 다음에 멈춤). 같은 실행 시점 판(824bf4e4·0ebbe329)에서 pickTargets 를 재현하니 4번째 대상은 세 번 모두 auto-0ec82aced95admoddocument(서울대 학생처 '일운과학기술재단', 주소에 `&#038;` 이 남은 채)였다. 링크 확인 로봇의 10-04 판정에 고친 주소(…&uid=392)가 '열기 실패: 시한 45초 초과'로 남아 있다(collector/link-check-state.json) — 다른 서울대 두 건은 'page.goto: Timeout 20000ms'였는데 이 글만 goto 이후 단계에서 시한을 넘겼다. rescue-bodies.mjs 145~229행: goto(30초)·innerText(3초)에는 시한이 있으나 frame.$$eval('a[href]')·$$eval('img')·locator.evaluate(click)·page.close() 에는 시한이 없고, 공고 하나를 감싸는 절대 시한이 없다. 저장은 306행(정상 끝)과 120~121행(예외)뿐이다. 지금 HEAD 에서도 이 서울대 글은 4번째 대상이다(pickTargets 재현, 대상 54건).
원인: 공고 하나가 응답을 안 주면 로봇 전체가 그 자리에 선다. 예산(RESCUE_BUDGET_MS)은 공고와 공고 사이에서만 확인돼서, 공고 안에서 멈추면 아무도 끊지 못한다. 2026-08-17 브라우저 수집 사고(SESSIONS.md '예산은 물어보는 장치라 멈춘 학교를 못 끊는다')와 같은 유형인데, 그때 들인 withDeadline 이 이 로봇에는 안 들어갔다. 10-04 activity-docs.mjs 에는 '한 페이지 절대 시한 — goto 가 돌아와도 프레임 읽기가 멈출 수 있다(rescue-bodies.mjs 에서 배운 것)'를 넣었지만 rescue-bodies.mjs 는 그대로다. 정확히 어느 대기에서 멈췄는지는 로그에 없다(이 로봇은 공고를 시작할 때 줄을 안 찍는다). 서울대 글이 원인 공고라는 것은 세 번 모두 같은 순서·같은 자리였다는 점과 링크 확인 로봇의 45초 시한 초과로 강하게 뒷받침되지만, 멈춘 함수는 확인하지 못했다. 강제 종료는 프로세스를 죽여서 saveAll 이 안 돌고 장부가 그대로라, 다음 실행도 같은 순서로 같은 공고에서 다시 멈춘다.
수리안: ① rescue-bodies.mjs 의 공고 하나(열기~첨부 걷기~본문 판정)를 harvest-budget.mjs withDeadline(예: 60초)으로 감싼다. 시한에 걸리면 page.close() 를 기다리지 않고 버리고, 장부에 tries+1·hung:true 를 적어 그 공고가 쉬게 하며, 브라우저 연결이 이상하면 context 를 다시 만든다. ② 공고마다(또는 몇 건마다) saveAll 을 하고 SIGTERM/SIGINT 때도 saveAll 하게 해서, 단계 시한에 죽어도 해 놓은 것은 남게 한다. ③ 공고를 시작할 때 '▶ 이름' 줄을 찍어 다음에 어디서 섰는지 로그로 보이게 한다. ④ test-collector 에 'rescue-bodies 가 withDeadline 을 쓴다' 관문을 넣는다(다른 브라우저 로봇과 같은 규칙 · 되돌리면 실패하는지 red-green으로 확인).
파일: collector/rescue-bodies.mjs, collector/harvest-budget.mjs, verify/test-collector.mjs

--- [bodies-2] P1 (likely, workflow-yaml) 10-03 yml 변경 뒤에는 같은 멈춤이 '초록불'로 숨는다 — 실패 이슈도 하트비트 경보도 안 뜬다
증상: 새 판에서는 '본문 재수집' 단계에 timeout-minutes 11과 continue-on-error 가 함께 붙었다. 4번째 공고에서 또 멈추면 11분에 그 단계만 죽고 뒤 단계가 이어져 작업은 success 로 끝난다. 그러면 failure()||cancelled() 이슈가 안 생기고, 하트비트는 '마지막 성공'만 보므로 #385 경보가 스스로 닫힌다. 그런데 장학 본문 재수집은 하루 두 번씩 계속 0건이고, rescue-report.md 도 9-30 내용 그대로 남는다.
근거: rescue-bodies.yml 72~73행 `timeout-minutes: 11` + `continue-on-error: true      # 여기서 무슨 일이 생겨도 아래 저장·리포트는 나간다`, 149행 `if: failure() || cancelled()`. collector/robot-heartbeat.mjs 118·138행은 `status=success` 실행만 센다. 이 저장소의 기록 SESSIONS.md(2026-08-17 사고): '수집 단계에 continue-on-error가 붙어 있어 Actions에는 초록불(success)로 보인다'. 새 판으로는 아직 한 번도 안 돌았다(마지막 실행 #52 10-02).
원인: 단계 시한과 continue-on-error 를 함께 쓰면, 로봇이 스스로 끝내지 못하고 죽은 경우를 실패로 세지 않는다. 그런데 로봇은 시간 초과로 죽으면 리포트를 못 쓰고(bodies-1), 실패 알림 조건이 이 단계의 결과(steps.rescue.outcome)를 보지 않는다.
수리안: bodies-1 로 로봇이 스스로 끝나게 한 뒤에도 남는 구멍을 막는다. '본문 재수집' 다음에 `if: steps.rescue.outcome != 'success'` 단계를 두어 이슈를 만들거나 코멘트를 단다(리포트가 오늘 날짜가 아니면 '리포트 없음'이라고 적는다). 리포트 첫 줄은 시작할 때 바로 쓴다. 관문 test-collector 「일반 수집 예산」 류에 '보강 단계의 시간 초과를 알림이 본다'는 정적 검사를 더한다.
파일: .github/workflows/rescue-bodies.yml, collector/robot-heartbeat.mjs

--- [bodies-3] P1 (confirmed, code) 자격용 첨부 받기(deepfetch --elig-attach)가 매번 같은 첫 6건만 받는다 — 경희대 '공통' 등 18건의 공고문 첨부는 한 번도 안 받혀 무료·AI 어느 길로도 못 읽음
증상: #378 에 나온 경희대 '공통' 공고들(금신사랑·포항시장학회·선원가족·경희꿈도전·우정장학 2건·점프장학·논산시장학회 등)은 페이지에 제목과 첨부만 있고 내용은 첨부(HWP·PDF·그림)에 있다. 자격요건 로봇이 그 첨부 이름을 registered.json 에 잘 적어 두었는데도(📎) 첨부 파일 자체는 받히지 않아 자격이 계속 빈칸이다.
근거: deepfetch.mjs 302행 `const MAX_NOTICES = 6;` · 323~329행 등록 순서대로 돌다가 `if (targets.length >= MAX_NOTICES) break;`. 지금 데이터로 재현한 결과(scratchpad elig-targets.mjs): 자격 없음 61건 중 공고문 첨부가 있는 것 24건. 매번 뽑히는 6건(auto-rnoticedoarticleno154473 코나아이 · 마감 08-11 / auto-ent2431263956artclviewdo 울산연구원 · 마감 09-23 / 미래에셋 / 고속도로 / 문주 / 인천인재)은 모두 이미 elig-docs.json 에 있으나 무료로 못 읽는 것들이다. 7~24번째 18건은 elig-docs.json 에 없다(idx:null). eligibility-ai.mjs pickPdfTargets(302~304행)도 같은 색인만 보므로 AI 버튼을 눌러도 이 18건 첨부에는 닿지 않는다. 수집 로봇(collect-scholarships.yml 157~163행)과 AI 버튼이 둘 다 이 함수를 부른다.
원인: 대상을 고를 때 '이미 받아 봤는데 못 읽은 것', '마감이 지난 것'을 빼지 않고 순서를 돌리지도 않는다(rescue-bodies 가 '안 해 본 것부터'로 고친 함정 그대로). 첫 6건이 무료로는 영영 못 읽는 것들(포스터·여러 사업이 묶인 HWP·글자층 PDF)이라 자리를 계속 차지한다.
수리안: downloadEligDocs 에 장부(공고 id → 받은 날·횟수·파일 서명)를 두고 ① 안 받아 본 공고 먼저 ② 이미 받은 파일이 그대로면(첨부 목록이 안 바뀌었으면) 다시 받지 않기 ③ 마감이 지났거나 notStale 이 아닌 공고는 빼기를 한다. MAX_NOTICES 는 예산(150초) 안에서 그대로 둬도 된다. 관문: '앞 6건이 이미 받은 것이면 7번째가 뽑힌다' red-green 검사.
파일: collector/deepfetch.mjs, collector/extracted/elig-docs.json, collector/eligibility-ai.mjs

--- [bodies-4] P2 (confirmed, code) 본문은 받았는데 자격 줄이 안 나오는 공고를 매 실행 1순위로 다시 받는다 (제주 미래이음·코나아이는 9-04부터 매일) + 마감 지난 공고도 대상
증상: 자격요건 로봇 25건 한도의 맨 앞 3자리를 같은 공고(제주 미래이음·코나아이·경희꿈도전)가 매번 차지하고, 매번 '✅ 본문 확보'라고 적는다. 대상 61건 중 11건은 마감이 지났거나 학생 화면에서 이미 숨겨진 공고다.
근거: 이슈 #234(09-04)에도 '✅ 제주평생교육장학진흥원 미래이음 … (3508자)', '✅ [화성시] 2026년 코나아이 …(3381자)'가 있고, 9-30 리포트와 10-01~10-03 로그에도 같은 세 건이 맨 앞이다. browser-bodies.json 에는 세 건 모두 at:2026-09-30 via:rescue 로 이미 저장돼 있다. rescue-bodies.mjs 83행 대상 기준은 `requirementLines(it).length` 이고, 276행에서 성공하면 `delete ledger[key]` → tries 0 → 101행 정렬에서 다시 맨 앞이 된다. 마감 지남·숨김: reg-hi-jeju(listedAt 07-16, 마감 없음 → notStale false) · 코나아이(마감 08-11) 등 11건(scratchpad stale.mjs).
원인: '본문을 확보했다'(hasText)와 '대상이다'(자격 줄이 없다)의 기준이 다르다. 그래서 본문은 있지만 발췌기가 자격 절을 못 찾는 공고(홍익대 2건은 메뉴뿐, 커밋 b03397ad 이전 기록)는 성공과 재대상을 끝없이 오간다. 또 대상 고르기가 마감·노출 여부를 보지 않는다.
수리안: 성공해도 장부에 {ok:날짜}를 남겨 같은 본문을 이레 안에는 다시 안 열게 한다(본문이 있고 자격만 없는 공고는 발췌기·AI 몫). pickTargets 에서 마감이 지났거나 notStale(match-engine) 이 false 인 공고는 뺀다.
파일: collector/rescue-bodies.mjs

--- [bodies-5] P2 (confirmed, code) 수집 로봇에서는 PDF·그림(OCR) 첨부 글자가 발췌기에 닿지 않는다 — 첨부 받기가 파생 글자를 지우고, PDF·OCR 단계는 발췌 뒤에 돈다
증상: 아직 자격이 없어 첨부를 다시 받는 공고는, 매 실행마다 OCR 글자(.ocr.txt)가 지워진 상태로 발췌기가 돈다. 그래서 스캔 공고문이나 그림을 무료 OCR 로 읽어도 수집 로봇 경로에서는 자격으로 이어지지 않는다(수동 AI 버튼 경로만 순서가 맞다).
근거: deepfetch.mjs 335~339행: 다시 받는 공고의 `elig-<슬러그>-*` 파일을 파생 .txt 까지 지운다(eligibility-fill.yml 103~107행 주석도 같은 사실을 적었다). collect-scholarships.yml: 첨부 받기 + hwp-bodytext(157~163행) → 발췌 extract-excerpts(165~166행) → … → PDF 글자 뽑기(202~208행) → OCR(212~216행). OCR 장부는 ok 이고 파일이 없으면 다시 읽어서(ocr-text.py seen_enough 259행) 발췌 '뒤'에 되살아나고, 다음 실행 첫머리에 또 지워진다. 지금 남아 있는 elig-*.ocr.txt 는 AI 로 이미 자격을 얻어 대상에서 빠진 공고(179qgu·17xcgr) 것뿐이다.
원인: 단계 순서(이 yml 은 수집 그룹 담당)와, 받은 파일이 바뀌지 않았는데도 지우고 다시 받는 deepfetch 의 갈아끼우기 규칙이 겹쳤다. HWP 는 같은 단계 안에서 다시 뽑아서 영향이 없고, PDF·그림만 걸린다.
수리안: ① deepfetch --elig-attach 는 내려받은 바이트가 기존 파일과 같으면 파생 글자를 지우지 않는다(bodies-3 의 서명 장부와 한 벌). ② collect-scholarships.yml 에서 'PDF 글자 뽑기'·'OCR' 단계를 '공고 원문 발췌 갱신' 앞으로 옮기거나, 첨부 받기 단계 안에서 ocr-text.py 를 elig-* 에만 돌린다. 관문: '첨부를 받는 로봇이 전부 본문 추출기를 …' 절에 '발췌 앞에 OCR' 순서 검사를 더한다.
파일: collector/deepfetch.mjs, .github/workflows/collect-scholarships.yml, collector/ocr-text.py

--- [bodies-6] P2 (confirmed, human-decision) 글자층이 있는 PDF 공고문은 무료 자격 경로에서 아무도 못 읽는다 (자격용 PDF 11개 중 11개)
증상: 포항시장학회·선원가족·금신사랑·점프장학·문주장학재단처럼 공고문이 PDF 인 공고는, 첨부를 받아도 무료로는 자격이 절대 안 나온다. AI 버튼만 가능하다.
근거: attachment-text.mjs 153행 `if (lower.endsWith('.pdf')) return ocrText(filePath);` — .pdf.txt 는 '일부러 안 읽는다'(2026-08-20 결정: 옛 추출기가 `3년 이상`을 `년이상`으로 뽑음). ocr-text.py 239~240행 `if os.path.exists(path + '.txt'): continue  # 글자층이 있는 PDF 는 pdf-text.py 가 이미 뽑았다`. collector/extracted 실측: elig-*.pdf 11개 모두 .pdf.txt 있음(예: rs62se 6,495B, 1rz9dj 21,945B) · .pdf.ocr.txt 0개.
원인: 두 결정이 서로를 전제로 했다. 자격 경로는 'PDF 는 OCR 로'라고 정했고, OCR 은 '글자층 PDF 는 pdf-text 가 했다'고 건너뛴다. 그래서 글자층 PDF 는 어느 쪽에서도 자격 재료가 되지 않는다. 08-20 결정의 근거는 옛 JS 추출기 실측이었고, 09-05 부터는 poppler(pdf-text.py)를 쓰는데 다시 재지 않았다.
수리안: 개발자 결정이 필요하다. (가) 지금 poppler 결과(.pdf.txt)로 08-20 의 '숫자 빠짐' 실측을 다시 해 보고, 숫자 보존 관문(문턱 낱말 앞 숫자 확인 — ocr-text.py 줄 관문과 같은 규칙)을 통과한 줄만 자격 재료로 허용한다. 또는 (나) 자격용(elig-*) PDF 는 글자층이 있어도 OCR(tesseract 또는 PaddleOCR)로 쪽 그림을 읽게 한다. 어느 쪽이든 관문에 '자격용 PDF 가 무료 경로로 읽힐 길이 하나는 있다'는 검사를 둔다.
파일: collector/attachment-text.mjs, collector/ocr-text.py, collector/pdf-text.py

--- [bodies-7] P2 (confirmed, workflow-yaml) 실패 이슈가 옛 리포트를 붙여 넣어 진단을 엇나가게 하고, 성공해도 닫히지 않는다 (#234·#337·#361·#378 열린 채)
증상: #378(10-03 실패)의 본문은 10-03 실행이 아니라 9-30 성공 실행의 리포트('실행: 2026-09-30 · 대상 11건')다. 그래서 '경희대 공통 공고들이 4회째·7회째 본문 없음이라 막힌 것'처럼 읽히지만, 실제로 10-03 에는 그 공고들까지 가지도 못하고 4번째(서울대)에서 멈췄다. 같은 꼴의 이슈가 9-04부터 하나도 안 닫혔다.
근거: rescue-bodies.yml 155~157행: 실패 알림이 `fs.readFileSync('collector/rescue-report.md')` 를 그대로 붙인다. 시간 초과로 죽으면 그 파일은 저장소에 있던 옛 판이다. 이슈 #378 본문 첫머리 '실행: 2026-09-30'. 열린 rescue-bodies 라벨 이슈 4건: #234(09-04) · #337(10-01) · #361(10-02) · #378(10-03). 성공 때 닫는 단계가 yml 에 없다(하트비트에는 있다).
원인: 리포트를 실행 끝에만 쓰는데, 알림은 '지금 있는 리포트'를 이번 실행 것이라고 여긴다. 성공 시 정리 단계도 없다.
수리안: 알림이 리포트의 '실행:' 날짜를 보고 오늘이 아니면 '이번 실행은 리포트를 쓰기 전에 끊겼다 — 마지막 로그 줄: …'로 바꿔 적게 한다(bodies-1 의 공고 시작 줄과 함께). 성공 실행에서 rescue-bodies 라벨 이슈를 닫는 단계를 넣는다(robot-heartbeat.yml 의 '옛 경보를 닫는다'와 같은 방식). 고친 뒤 첫 성공을 확인하고 #234·#337·#361·#378 을 정리한다.
파일: .github/workflows/rescue-bodies.yml

--- [bodies-8] P2 (confirmed, human-decision) AI 자격 읽기 버튼이 9-17 이후 안 눌렸다 — 그사이 자격 미확보 6건 → 61건
증상: 9-17 확보율은 89%(53건 중 6건 미확보)였다. 44개교 복원 뒤 지금은 60%(152건 중 61건 미확보, 그중 50건이 학생에게 보이는 공고)다. 무료로 못 읽는 포스터·글자층 PDF 공고는 AI 버튼이 유일한 길이다.
근거: 이슈 #294(09-17) '등록 공고 53건 · 확보 47건 · 미확보 6건'. 지금 node verify/eligibility-report.mjs: '등록 공고 152건 · 확보 91건 (60%) · 미확보 61건 (40%) · 원문 자체가 없음 46건'. eligibility-ai-config.json enabled:false(설계 · 버튼에서만 켬). eligibility-fill 실행 목록: 09-17 뒤 workflow_dispatch 없음.
원인: 버튼(유료 API)은 사람이 눌러야 돈다. 잔액·비용 결정이 필요하다. 또 지금 누르면 bodies-3(첨부 굶김) 때문에 18건 첨부에는 닿지 않고, bodies-1(본문 없음 46건) 때문에 본문 경로 대상도 적다.
수리안: bodies-1·bodies-3 을 고치고 자격요건 로봇이 한두 번 돈 뒤, 「자격요건 매칭 · AI 자격 읽기」를 '미리보기만'으로 대상 수를 보고 '전부' 또는 '첨부만'으로 누른다(Anthropic API 잔액 확인 필요).
파일: collector/eligibility-ai-config.json, .github/workflows/eligibility-fill.yml

--- [bodies-9] P3 (confirmed, none-already-fixed) eligibility-fill.yml 이 9-30에 잠시 YAML 오류(checkout 의 with: 두 번)였다 — 지금은 고쳐짐
증상: 9-30 00:56~01:41Z push 6번이 모두 '작업 0개 failure'로 기록됐다. 그 사이 버튼을 눌렀다면 시작조차 안 됐을 것이다.
근거: run 36656324912 등 6건: event push, jobs total_count 0(이 워크플로에는 push 트리거가 없다 = 파일 오류 표지). 27f38160 판 checkout 단계에 `with: ref: ${{ github.ref_name }}` 와 `with: ref: 'claude/nice-heisenberg-WESq5'` 가 함께 있었다. 지금 판은 with: 하나(중복 키 검사 통과)이고, 9-30 01:41Z 뒤로는 push 실패 기록이 없다.
원인: 병합하면서 같은 키가 두 번 들어갔다. 이미 고쳐졌다.
수리안: 할 일 없음. 원하면 test-collector 에 워크플로 YAML 중복 키 검사를 더한다(파이썬 safe_load 는 중복 키를 조용히 받아 넘겨서 못 잡는다).
파일: .github/workflows/eligibility-fill.yml

--- [bodies-10] P3 (confirmed, workflow-yaml) eligibility-fill 의 '대상이 0건이면 여기서 끝' 단계는 실제로 아무것도 멈추지 않는다
증상: 대상이 0건이어도 첨부 받기·OCR·SDK 설치·감사·저장·리포트 이슈가 그대로 돈다. 또 대상 수는 장학 AI 의 첫 '대상 N건' 줄만 세어서, 대외활동 대상이 있어도 0으로 볼 수 있다.
근거: eligibility-fill.yml 88~92행 `if: steps.preview.outputs.count == '0'` → `exit 0` — 단계 안의 exit 0 은 그 단계를 성공으로 끝낼 뿐이고 작업은 이어진다. 82~85행 `sed -n 's/.*대상 \([0-9]*\)건.*/\1/p' | head -1`.
원인: 뒤 단계들에 count 조건이 없다.
수리안: 뒤 단계들의 if 에 `steps.preview.outputs.count != '0'` 을 더하거나 단계를 지운다. 대외활동 대상 수는 따로 센다.
파일: .github/workflows/eligibility-fill.yml

--- [bodies-11] P3 (likely, config) 자격요건 로봇 예약이 2~3.5시간씩 늦게 시작돼 수집 로봇들과 같은 시간대에 학교를 두드린다
증상: 05:23 KST(20:23Z)에 잡았지만 실제 시작은 22:21~23:57Z 였다. 일반 수집(07:41 KST = 22:41Z)·브라우저 수집(08:07 KST = 23:07Z)과 겹쳐, yml 주석이 피하려던 '같은 학교 연달아 두드리기'가 생길 수 있다.
근거: 실행 시작 시각: #43 23:00Z · #47 23:08Z · #49 23:47Z · #50 23:57Z · #51 23:57Z · #52 23:51Z (cron '23 20 * * *', rescue-bodies.yml 33행 주석 '충분히 떨어져 있다').
원인: GitHub 예약 지연. 이 저장소의 예약 대부분이 같은 영향을 받는다.
수리안: 시간을 바꾸기보다, 겹쳐도 문제가 없도록 학교별 간격 규칙을 두거나, 실제 시작 시각을 리포트에 남겨 겹침을 재 본 뒤 정한다. 급하지 않다.
파일: .github/workflows/rescue-bodies.yml

--- [bodies-12] P3 (confirmed, workflow-yaml) 자질구레한 것 — deep-fetch 동시 실행 대기줄·본편 예산 없음 · PaddleOCR 버전 미고정 · 관문 되돌리기가 장부는 안 되돌림
증상: ① deep-fetch.yml 에는 concurrency 가 없고, 본편(deepfetch.mjs 전체)에 전체 시간 예산이 없다(공고마다 20초 시한뿐). 수동 실행이라 위험은 작다. ② rescue-bodies.yml·collect 의 `pip install paddlepaddle paddleocr` 는 버전을 고정하지 않았고 `|| true` 라서, 큰 버전이 바뀌면 조용히 0건이 될 수 있다(paddle-ocr.py 는 3.x API rec_texts·predict 를 쓴다). ③ 자격요건 로봇의 '관문에 걸리면 되돌린다'는 browser-bodies.json·registered.json 만 되돌린다. 저장 단계(always)는 rescue-ledger.json·act-browser.json 을 그대로 커밋해서, 성공으로 지운 장부 칸과 되돌린 본문이 어긋날 수 있다.
근거: deep-fetch.yml(concurrency 키 없음 · 본 단계에 timeout-minutes 없음 · 작업 34분) · rescue-bodies.yml 89~95행 · 108~111행 · 115~127행.
원인: 보강 단계 관례가 몇 군데 덜 적용됐다.
수리안: deep-fetch 에 대기줄과 본편 예산을 둔다. paddleocr·paddlepaddle 버전을 고정하고 설치 실패는 경고로 남긴다(ocr-text 의 '|| true 금지' 규칙과 같게). 관문 실패 때는 장부 파일도 함께 되돌린다.
파일: .github/workflows/deep-fetch.yml, .github/workflows/rescue-bodies.yml, collector/paddle-ocr.py

NOTES: 질문 「#378 의 경희대 '공통' 공고(본문 없음 4회째·7회째)에 로봇이 영원히 매달려 25건 한도를 쓰는가? 첨부 글자는 자격에 쓰이는가? 왜 85.7시간 성공이 없는가?」에 대한 답:

1) 영원히 매달리지는 않는다. 장부(rescue-ledger.json)에 따라 3번 실패하면 7일 쉬고, 그 뒤로는 일주일에 한 번만 다시 연다(4회째=09-30, 다음 차례는 10-07 무렵). 한 번에 15초쯤이라 한도 낭비는 작다. 한도를 실제로 갉아먹는 것은 따로 있다. ① 본문은 ✅인데 자격 줄이 안 나오는 3건(제주 미래이음·코나아이·경희꿈도전)이 매 실행 맨 앞에서 다시 받힌다(bodies-4). ② 마감이 지났거나 숨겨진 공고 11건도 대상에 들어 있다.

2) 첨부 글자는 이 공고들의 자격에 쓰이지 않고 있다. 자격요건 로봇은 첨부 이름을 registered.json 에 잘 적었다(📎). 하지만 그 첨부를 내려받는 deepfetch --elig-attach 가 매번 같은 첫 6건만 고르고, 그 6건은 무료로는 영영 못 읽는 것들이다. 그래서 금신사랑·포항·선원가족·경희꿈도전·우정장학 2건·점프·논산 등 18건의 첨부는 한 번도 받힌 적이 없다(bodies-3). AI 버튼도 같은 색인을 보므로 닿지 않는다. 받힌다 해도 PDF 공고문은 글자층이 있으면 무료 경로가 일부러 안 읽고 OCR 도 건너뛰어 막힌다(bodies-6). OCR 글자는 수집 로봇의 단계 순서 때문에 발췌기에 닿지 않는다(bodies-5). 무료로 실제로 읽힐 길이 있는 것은 HWP/HWPX 공고문(경희꿈도전 .hwp · 논산 .hwpx · 인천인재 .hwp)뿐이다.

3) 85.7시간 동안 성공이 없던 이유는 경희대 공고가 아니다. 세 번 모두 4번째 대상인 서울대 학생처 글(auto-0ec82aced95admoddocument)을 여는 동안 23분 멈췄고, 작업 시한 25분에 취소됐다(bodies-1). #378 본문은 9-30 리포트를 그대로 붙인 것이라 원인을 잘못 가리킨다(bodies-7). 고친 주소로도 링크 확인 로봇이 이 글에서 '시한 45초 초과'를 기록했으므로, 10-03 판에서도 같은 자리에서 다시 멈출 가능성이 크다. 새 yml 에서는 그 멈춤이 초록불로 바뀌어 경보가 사라진다(bodies-2).

yml 변경(ac930fb7, 10-03 17:23Z) 뒤 실행은 아직 없다. 다음 예약은 20:23Z(지연되면 23시대)다. 고칠 때 순서를 권한다: bodies-1(공고 시한·중간 저장) → bodies-2(단계 결과 알림) → bodies-3·4·5 → AI 버튼(bodies-8).

이 그룹 밖에서 본 것(참고): 수집 로봇 run 37121388488(10-03 12:09Z)에서 데이터 관문 test-collector 가 '✕ 실패 1건 — 수집기 중복 제거 규칙이 깨졌습니다'로 걸려 자동 등록 8건이 되돌려졌다. 지금 HEAD 에서 test-collector 는 전부 통과라니 그 뒤에 고쳐졌을 수 있다 — 수집 그룹에서 확인할 것.

작업 흔적: 임시 worktree(scratchpad/bodies/wt)는 지웠다. 문법 확인 중 py_compile 이 만든 collector/__pycache__ 는 바로 지웠다(git status 깨끗함). 재현 스크립트는 /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/bodies/ 아래 pick-head.mjs · elig-targets.mjs · stale.mjs · missing.mjs · idx-time.mjs 에 있다.


######## GROUP 원문 링크 로봇들 (links)

--- [links-1] P2 (confirmed, workflow-yaml) 링크 사냥꾼 🔧 이슈가 매번 새로 생겨 25건 쌓임 — 라벨이 없어서 묶이지도 닫히지도 않는다
증상: 원문 주소를 3회 못 찾은 공고가 생길 때마다 🔧 이슈가 새로 열린다. 지금 열린 것이 25건이다(#81 2026-07-31 … #379·#382·#387 은 10-03 하루에만 셋). 담당자 지정도 없다. 사람이 볼 알림이 묻히고, 이미 풀린 건도 열린 채로 남는다.
근거: run 37141078602 로그(17:41:54): `gh issue create ... --label "link-hunter" --assignee "seonju5543-web" || gh issue create ...` → "could not add label: 'link-hunter' not found" → 라벨·담당자 없는 #387 이 생겼다. list_issues labels=[link-hunter] → 0건. 열린 🔧 이슈: #387 #382 #379 #363 #302 #275 #268 #248 #243 #235 #231 #221 #216 #213 #201 #193 #191 #159 #130 #125 #111 #100 #91 #84 #81. close-old-reports.yml 은 🔧 를 일부러 건너뛴다('🚨 경보 · 🔧 링크 사냥꾼 … 절대 건드리지 않는 것'). .github/workflows/link-hunter.yml:166-184.
원인: link-hunter.yml 의 알림 단계가 존재하지 않는 라벨로 이슈를 만들려다 실패하고, 예비 명령으로 라벨 없는 새 이슈를 만든다. robot-down·link-check 알림은 라벨을 먼저 만들고(`gh label create … || true`) 열린 이슈가 있으면 코멘트만 단다. 이 단계에는 그 '하나에 모으기' 규칙이 없고, 다 풀리면 닫는 장치도 없다.
수리안: ① 알림 단계 앞에 `gh label create link-hunter … || true` 를 둔다. ② 라벨 붙은 열린 이슈가 있으면 코멘트로 덧붙이고, 없을 때만 새로 만든다(link-check.yml 의 🔗 단계와 같은 모양). ③ escalated 상태로 남은 표식이 0건이 되면 그 이슈를 닫는다. ④ 지금 열린 🔧 25건은 한 번에 정리한다(최신 하나만 남기고 닫기 — 사람 승인 뒤).
파일: .github/workflows/link-hunter.yml, .github/workflows/close-old-reports.yml

--- [links-2] P2 (confirmed, code) '사람에게 알릴 건' 집계가 거짓 경보를 낸다 — 같은 실행 3단계에서 찾은 건도 센다
증상: #387 은 '원문 주소를 3회 못 찾은 공고 1건'이라고 알렸다. 그런데 그 1건(가천 '외국인 유학생 다자녀장학금')은 같은 실행의 3단계에서 이미 찾아 저장됐다. 본문에는 어느 공고가 '알릴 건'인지 표시도 없다. 머리말의 '포기 처리된 건 13건'은 실제로는 '이번 회차 쉬는 건'(재시도 간격)이라, 끝줄 '포기하는 건 없습니다'와 모순된다.
근거: #387 본문: '⚠️ 목록에서 못 찾음 (3회째 …): [장학공지] 2026-2학기 외국인 유학생 다자녀장학금 신청 안내' → '✅ 다른 경로에서 찾음: … → https://www.gachon.ac.kr/bbs/kor/478/125413/artclView.do' → '원문 주소 확보 8건 · 아직 못 찾음 6건 · 사람에게 알릴 건 1건'. collector/link-hunter.mjs:520 `if (st.attempts === ESCALATE_AT) { st.escalated = true; stuck += 1; }` · 768행 `extraFound += 1; found += 1;`(stuck·failed 를 되돌리지 않는다) · 338행 '포기 처리된 건 ${skipped.length}건'.
원인: stuck·failed 를 1단계 실패 시점에 올리고, 3단계에서 찾아도 내리지 않는다. 리포트에도 escalated 된 항목을 따로 모은 목록이 없다.
수리안: stuck 은 저장 직전에 '이번 실행에서 escalated 가 되었고 아직 표식인 항목'으로 다시 센다(failed 도 같은 방식). 리포트에 '사람 확인 필요' 절을 따로 두어 그 항목들만 이름·이유와 함께 적고, 이슈 본문은 그 절로 만든다. '포기 처리된 건' 문구는 '이번 회차 쉬는 건'으로 바꾼다.
파일: collector/link-hunter.mjs

--- [links-3] P2 (confirmed, workflow-yaml) 링크 사냥꾼이 실패해도 이슈가 안 생긴다 — '🚨 실패 알림' 이 ::warning 한 줄뿐
증상: 사냥꾼이 넘어지거나 시간 초과로 취소되거나 push 3회 실패로 exit 1 이 되어도 Actions 화면의 빨간불만 남는다. 사람에게 가는 알림이 없다. 하트비트는 '72시간 성공 없음'일 때만 잡으므로 최대 3일 늦게 안다.
근거: .github/workflows/link-hunter.yml:191-198 — `name: 🚨 실패 알림 · if: failure() || cancelled() · run: echo "::warning::링크 사냥꾼 실행 실패 — …"`. grep 결과 robot-down 을 쓰는 워크플로 9개(admin-lock-check·check-live·close-old-reports·link-check·push-health·resolve-detail-urls·robot-heartbeat·search-index·verify-ui)에 link-hunter 는 없다. 저장 단계 주석은 '🚨 실패 알림이 그대로 뜬다'고 적었으나 실제로는 경고 한 줄이다(103행).
원인: 2026-09-06 에 공용 robot-down 알림을 만들었는데, 링크 사냥꾼의 옛 '실패 알림' 단계는 교체되지 않았다.
수리안: 그 단계를 `uses: ./.github/actions/robot-down`(robot: 링크 사냥꾼 (까다로운 원문 주소 전담))으로 바꾼다. 같은 묶음의 다른 로봇과 같은 공용 알림이다.
파일: .github/workflows/link-hunter.yml

--- [links-4] P3 (confirmed, none-already-fixed) 이슈 #386(원문 링크 복구 로봇 넘어짐)은 사람의 취소가 낳은 오경보 — 근본 원인은 고쳐졌고 이슈만 남았다
증상: 🚨 '원문 링크 복구 로봇이 넘어졌어요'가 열려 있다. 실제로는 로봇 고장이 아니다. 배포 push 로 main 브랜치에서도 뜬 실행을 사람이 취소한 것이다.
근거: run 37141082198(head_branch main · push · 17:35:39Z 시작): 'npx playwright install' 단계가 17:36:21 에 cancelled(시작 42초 만 · 작업 시한 40분과 무관) → '🚨 로봇이 넘어졌다' 단계 success → #386(17:36:29). 커밋 0f8d91f4(17:39:37) 메시지: "트리거 파일을 고친 커밋을 main 에 올리자 사냥꾼·복구 로봇이 main 에서도 떴고 … 기본 브랜치 쪽이 취소되고 main 쪽이 남았다(main 쪽 둘은 취소함)" → push 트리거에 branches: ['claude/nice-heisenberg-WESq5'] 추가 + 관문 robot ⓩ. 직후 dispatch run 37141332557 success(17:40~17:58, 복구 8건 · 커밋 19a5ad04).
원인: push-to-run 트리거에 branches 거르개가 없어 main 에서도 로봇이 떴고, 사람이 그 실행을 취소했다. robot-down 은 취소 사유를 가리지 않고(시간 초과/사람/대기줄) 모두 '넘어졌다'로 이슈를 연다. 다음 성공 때 닫는 장치도 없다.
수리안: 근본 원인(branches 누락)은 이미 고쳐졌고 그 뒤 성공 실행으로 증명됐다. 남은 일: #386 을 '사람 취소로 인한 오경보 · 0f8d91f4 로 수리 · 37141332557 성공' 코멘트와 함께 닫는다. 재발을 막으려면 links-5 의 robot-down 개선을 한다.
파일: .github/workflows/resolve-detail-urls.yml
이미수리: 0f8d91f4 (push 트리거 branches 거르개 + 관문 robot ⓩ) — 이후 run 37141332557 success

--- [links-5] P3 (confirmed, workflow-yaml) 공용 넘어짐 알림(robot-down)의 약점 셋 — 체크아웃 전 취소면 알림이 실패, 사람·대기줄 취소도 경보, 성공해도 안 닫힘
증상: ① 체크아웃 전에 취소되거나 실패하면 알림 단계 자체가 오류로 끝난다(무음). ② cancel-in-progress 대기줄이나 사람이 취소한 실행도 '로봇이 넘어졌어요' 이슈가 된다(#386). ③ 다음 실행이 성공해도 이슈가 그대로 남는다.
근거: run 37141078600(기본 브랜치, 대기줄 취소, checkout 단계 cancelled) 로그: "##[error]Can't find 'action.yml', 'action.yaml' or 'Dockerfile' under '/home/runner/work/hanggonggan/hanggonggan/.github/actions/robot-down'. Did you forget to run actions/checkout before running your local action?". resolve-detail-urls.yml:41 `cancel-in-progress: true` + 106행 robot-down(`if: failure() || cancelled()`). (묶음 밖 관찰) close-old-reports.yml 에는 actions/checkout 단계가 아예 없는데 `uses: ./.github/actions/robot-down` 을 쓴다 → 그 로봇의 넘어짐 알림은 늘 실패한다.
원인: 로컬 액션(./.github/actions/…)은 저장소가 체크아웃돼 있어야 불러올 수 있다. 알림 조건 `failure() || cancelled()` 는 취소 사유를 구분하지 않는다. 성공 경로에 이슈를 닫는 단계가 없다.
수리안: 알림 단계 직전에 `if: failure() || cancelled()` 로 sparse checkout(.github/actions 만)을 한 번 더 하거나, 알림을 인라인 gh 스크립트로 바꾼다. close-old-reports.yml 에도 checkout 을 넣는다. 성공 끝에 '열린 robot-down 이슈(이 로봇 이름)가 있으면 성공 링크를 달고 닫기' 단계를 공용 액션에 더한다. 취소 사유 구분(사람 취소 제외)은 사람이 정할 일이다.
파일: .github/actions/robot-down/action.yml, .github/workflows/resolve-detail-urls.yml, .github/workflows/close-old-reports.yml

--- [links-6] P2 (likely, code) 서울교대 공고 4건은 두 로봇이 영영 못 고친다 — 이미 아는 상세 주소 규칙(data-id → selectNttInfo.do?nttSn=)을 안 쓴다
증상: 서울교대 실시간 공고 4건(통영시 학자금 이자 지원 · 국가근로 희망근로지 2차 · 익산시 학자금 이자 · 국가근로 선발 결과)은 학생이 '원문'을 누르면 게시판 목록이 열린다. 사냥꾼·복구 로봇 둘 다 매번 '주소를 못 만듦'으로 실패한다. 10-05 에 3회째가 되면 🔧 이슈가 또 생긴다.
근거: run 37141078602 리포트: '### https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083 — ⚠️ 실패(주소를 못 만듦)' ×4(탈락 줄 없음 = 후보 0개). 복구 로봇 37141332557 진단: '후보 주소 0개 생성 · 목록 행 생김새: <a href="javascript:" data-id="54165" class="nttInfoBtn">'. link-hunt.json: 4건 attempts 2 · nextTryAt 2026-10-05. 규칙은 이미 적혀 있다 — collector/browser-targets.json:124 _note "상세 주소 규칙은 실제로 열어서 확인해 뒀다: /snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=<data-id> (nttSn이 맞고 nttNo는 안 된다)". 정식 등록에도 그 꼴로 저장된 실례가 있다(auto-bsid1083mi3004nttid55323).
원인: (코드로 확인, 실행 재현은 안 함) 행을 눌러도 주소가 안 바뀌는 게시판이다. 이때 쓰는 rowDetailCandidates/detailCandidates 는 목록 파일 이름(selectNttList.do)에서 상세 주소를 유추한다. 그런데 서울교대의 상세 이름(selectNttInfo.do)과 글 번호 이름(nttSn)은 유추할 수 없어 후보가 하나도 안 나온다. 브라우저 수집기가 쓰는 게시판별 규칙은 두 로봇에 전달되지 않는다.
수리안: 게시판별 상세 규칙(browser-targets.json 의 서울교대 규칙 또는 news-board-rules 같은 규칙 한 곳)을 detail-url.mjs 후보 만들기에 넘겨, data-id 로 selectNttInfo.do?mi=3004&bbsId=1083&nttSn=<id> 를 후보에 넣는다. 최종 판정은 지금처럼 새 탭 확인(judgeLanding)이 한다. 관문에 서울교대 행 → 후보 1개 생성 red-green 을 더한다.
파일: collector/detail-url.mjs, collector/link-hunter.mjs, collector/resolve-detail-urls.mjs, collector/browser-targets.json

--- [links-7] P3 (confirmed, code) 로봇 세션 번호(;jsessionid=…)가 붙은 원문 주소가 학생 파일에 저장된다 — 주소 열쇠도 그것을 떼지 않는다
증상: 경기대 공고 2건의 원문 링크에 로봇의 세션 번호가 박혀 있다. 같은 글이 세션 번호만 달리해 들어오면 다른 글로 취급되어(중복 판정·자동 등록 열쇠·확인 장부) 갈라질 수 있다.
근거: data/notices/ntxxf09.json · data/notices.json: 'https://www.kyonggi.ac.kr/www/selectBbsNttView.do;jsessionid=369F3939369AECB846B945E2D38E1967?…nttNo=626377…' · ';jsessionid=3C71C54E330DDE56AC526288ABDAD27C?…nttNo=626271…'. 출처는 사냥꾼(run 37141078602 '✅ … → …;jsessionid=369F…')과 복구 로봇(37141332557 '✅ … → …;jsessionid=3C71…')이다. scratch 실측: canonUrl(a)===canonUrl(b) false · urlKey(a)===urlKey(b) false · 세션 없는 주소와도 false. collector/canon-url.mjs:60 은 u.pathname 을 그대로 쓴다(VOLATILE 의 jsessionid 는 쿼리 이름일 때만 걸린다). collector/detail-url.mjs:81·108 은 판정 안에서만 떼고, 457-458행 add(landed)·add(row.abs) 는 원본을 저장 후보로 쓴다. board-links.mjs:22-26 과 news-thumb.mjs:49 는 이미 떼고 있다.
원인: 쿠키 없는 로봇에게 JSP 서버가 링크마다 ;jsessionid 를 붙인다. 두 로봇의 후보 만들기와 공용 주소 열쇠(canonUrl·urlKey)에는 이것을 떼는 규칙이 없다(대외 게시판·소식 쪽에만 있다).
수리안: rowDetailCandidates 의 add() 에서 SESSION_IN_PATH 를 뗀 주소를 쓴다(새 탭 확인도 뗀 주소로 한다). canonUrl·urlKey 의 pathname 에서도 ;jsessionid=… 를 뗀다. 열쇠가 바뀌면 idFromUrl 이 바뀌는지 먼저 잰다. 이미 저장된 경기대 2건은 세션 없는 주소로 바꾼다(관리자 경로 · link-check 가 그 주소로 post 인지 확인).
파일: collector/detail-url.mjs, collector/canon-url.mjs, collector/url-key.mjs, data/notices/ntxxf09.json

--- [links-8] P3 (likely, data) 경희 정식 등록 3건은 boardTitle 이 앱 이름(사람이 다듬은 것)이라 사냥꾼이 영영 못 찾는다 — 미아 감지기도 못 잡는다
증상: reg-khu-uiam · reg-hi-jeongeup · reg-khu-intern 이 5회째 '목록에서 못 찾음 · 게시판에서 내려간 듯'(다음 시도 10-14)으로 돈다. 학생 화면은 '게시판 목록'이 열린다. 사냥꾼의 미아 경고는 boardTitle 이 비었을 때만 울려서 이 셋은 경고도 안 뜬다.
근거: data/registered.json: reg-khu-uiam name='의암 손병희 우수논문 장학생 (2026)' = boardTitle(같음) · reg-hi-jeongeup · reg-khu-intern 도 name == boardTitle. sourceUrl 은 모두 news.khu.ac.kr …list.do?menuNo=200318#n-. link-hunt.json: attempts 5 · escalated · nextTryAt 2026-10-14. audit 경고: '⚠ registered:reg-khu-uiam — … 게시판 목록이 열립니다'. link-hunter.mjs:303 orphans 는 `!(t.ref.boardTitle || '').trim()` 일 때만 센다. (같은 꼴: auto-kuk2351202780artclviewdo 의 boardTitle '충북인재평생교육진흥원 장학생 (2026 하반기)'은 02ee20a3(순찰)이 앱 이름으로 채운 것. 주소는 복원됐다.)
원인: 10-03 이전 코드가 앱 이름을 게시판 원제목 칸에 저장했다(현재 rememberBoardTitle 주석이 그 경위를 적고 있다). reg-khu-* 셋이 언제 채워졌는지는 확인하지 못했다. 미아 감지는 '비었는가'만 봐서 '앱 이름과 같은가'는 놓친다.
수리안: orphans 판정에 'boardTitle === name(정식 등록)'도 넣어 리포트의 '🚨 원제목이 없어 찾을 수 없는 공고'에 올린다. 오염된 boardTitle 4건은 비우거나(사냥꾼이 행 글자로 다시 채운다) 원문 제목으로 고친다. reg-khu-intern(마감 08-09)·reg-khu-uiam(09-11)은 마감이 지났으니 정리 대상인지도 본다(관리자 판단).
파일: collector/link-hunter.mjs, data/registered.json

--- [links-9] P3 (confirmed, code) link-hunt.json 이 정리 없이 자란다 — 1404항목 중 956개는 없는 공고, 1174개는 꺼진 순찰의 흔적
증상: 354KB 장부를 하루 약 5회 커밋한다. 실제로 쓰는 항목은 수십 개다.
근거: 분석: entries 1404 · 데이터에 없는 열쇠 956 · ('lastWhy','patrolledAt')만 가진 옛 순찰 항목 741 + ('attempts','lastWhy','patrolledAt') 386 · patrolledAt 최댓값 2026-10-03(순찰 끈 날). ls: collector/link-hunt.json 353883 바이트. 링크 사냥꾼 커밋은 실행마다 이 파일을 포함한다(git add … collector/link-hunt.json).
원인: saveAll 이 state.items 를 그대로 쓰고, 사라진 공고·순찰 흔적을 걷어 내는 단계가 없다. 순찰을 끈 뒤에도 옛 patrolledAt 항목이 남았다.
수리안: saveAll 에서 지금 데이터(notices·registered)에 없는 열쇠와 순찰 흔적(patrolledAt·patrol 만 있는 항목)을 걷어 낸다. 단, 'resolved'·escalated 항목은 30일 유예한다. jsonunion 병합기가 지운 항목을 되살리지 않는지도 같이 확인한다.
파일: collector/link-hunter.mjs, collector/link-hunt.json

--- [links-10] P3 (confirmed, human-decision) 원문 링크 복구 로봇과 링크 사냥꾼이 같은 일을 겹쳐 한다 — 같은 학교 게시판을 동시에 두드리고, 재검사 판정은 확인 로봇과 엇갈린다
증상: 10-03 17:35~17:58 에 두 로봇이 같은 11개 게시판을 동시에 열었다(경기·전북·성균·가천·국민·연세·서울교대·동국·항공·경희·고려). 둘 다 data/registered.json 을 고치는데 대기줄이 다르다. 복구 로봇의 '소급 재검사'(168건)는 원문 링크 확인 로봇과 같은 일을 하면서 판정이 다르게 나오고, 그 기록은 아무도 읽지 않는다.
근거: 사냥꾼 run 37141078602(17:35-17:42)과 복구 run 37141332557(17:39-17:58) 리포트의 게시판 목록이 겹친다. 복구 로봇은 17:41 사냥꾼 push 뒤 rebase 해서 저장했다(경기대 626377 은 사냥꾼 판, 626271 은 복구 판 jsessionid). 판정 불일치 — resolved-urls.json recheck: 고려 subview.do?enc= 9건 'list'(제목은 보이나 다른 공고 제목이 여럿) vs link-check-state.json 같은 꼴 'post'(본문에 그 공고 제목). 국민대 12349·12385·12387 은 recheck 'list' vs link-check 'other'. .gitattributes 는 data/registered.json 을 병합 규칙에서 일부러 뺐다 → 두 로봇이 가까운 줄을 고치면 rebase 충돌 → push 3회 실패가 가능하다(최근 40회에는 실제로 난 적 없다).
원인: 복구 로봇(7/31)과 사냥꾼(8/1)이 같은 목적(표식 → 원문)으로 따로 자랐다. 10-03 에 원문 링크 확인 로봇이 생기면서 재검사도 세 번째 사본이 됐다. 판정 함수는 하나(judgeLanding)인데, 넘기는 '다른 글 제목' 재료가 로봇마다 달라 결과가 갈린다.
수리안: 사람이 정할 일: (가) 복구 로봇의 소급 재검사를 없애고 그 일을 확인 로봇에 맡긴다. (나) 복구 로봇과 사냥꾼을 하나로 합치거나, 둘이 같은 대기줄(예: link-fixers)을 쓰게 해 동시에 돌지 않게 한다. 고려 enc 화면이 목록인지 글인지는 정찰(run-probe.txt checkUrl:)로 확정한다.
파일: .github/workflows/resolve-detail-urls.yml, .github/workflows/link-hunter.yml, collector/resolve-detail-urls.mjs

--- [links-11] P2 (confirmed, none-already-fixed) 복구 로봇의 매주 예약이 7주 동안 아무 일도 안 했다(onlyBoard: cau.ac.kr 고정) — 10-03 수리, 수동 실행으로 증명됨
증상: 8/14~9/29 매주 예약 실행이 1분 안팎에 '성공'으로 끝났다. 그동안 다른 학교 표식(정식 등록 14 · 학교별 공고 22)은 아무도 보지 않았다.
근거: collector/run-resolve-urls.txt 기록: "2026-08-14 에 중앙대 1건을 보려고 묶은 줄이 그대로 남아, 매주 예약 실행이 중앙대만 봤다. 마지막 리포트(2026-09-29)가 그 결과다: '고칠 대상 4건 · 게시판 0곳 · 재검사 0건'". 예약 실행 시간: 09-29 49초 · 09-21 48초 · 09-14 55초 · 09-07 39초. 수리 뒤 dispatch 37141332557 → 고칠 대상 26건 · 게시판 11곳 · 복구 8건.
원인: push-to-run 파일의 onlyBoard 줄이 예약 실행에도 적용되었고, 쓰고 난 뒤 지우지 않았다.
수리안: 이미 고쳐졌다(줄 삭제 + 관문 producers 가 '표식 0건 학교에 묶인 onlyBoard' 를 실패로 잡는다고 파일에 적혀 있음). 다음 예약(화 05:13 KST)이 전체 학교로 도는지만 확인한다.
파일: collector/run-resolve-urls.txt
이미수리: 2026-10-03 run-resolve-urls.txt 의 onlyBoard 삭제 + 관문 「원문 링크 정직성」 producers — 이후 run 37141332557 success(복구 8건)

--- [links-12] P3 (confirmed, none-already-fixed) 순찰이 덮어쓴 멀쩡한 원문 주소는 모두 되살아났고 순찰은 모든 곳에서 꺼져 있다
증상: (확인 결과) 10-03 순찰이 목록 표식으로 바꾼 정식 등록 주소 8건(항공대 3 · 건국대 1 · 부경대 1 · 고려 3)이 지금은 진짜 원문이거나 그 공고의 enc 주소다. 주소를 고치는 순찰 코드는 남아 있지 않다.
근거: 덮어쓴 커밋 e5f6de7b(부경 2432?action=view&no=9994682 · 고려 nttId 3건) · aa195bf8(항공대 scholnoti seq=11120/11234/11207) · 02ee20a3(건국 1202780/artclView.do). 현재 data/registered.json: 항공대 셋·부경·건국은 원래 주소로 복원(f261edc8 '항공대 진짜 주소 2건 되살림' 등). 고려 3건은 subview.do?enc=…(사냥꾼 37141078602 ✅, link-check 'post'). 학교별 파일에도 같은 주소가 있다. run-link-hunt.txt 'patrol: 0' · HUNT_PATROL 을 주는 워크플로 없음 · runPatrol 은 st.patrol 만 적고 t.ref 는 안 건드린다(link-hunter.mjs runPatrol). resolve 재검사도 recheckLog 만 쓴다(434행). link-check 는 data/link-check.json·장부·리포트만 git add 한다.
원인: 순찰이 판정과 수리를 함께 했다(행 꼬리 달린 제목 · 로그인 상자 오판 · 빈 다른 글 목록). 10-03 에 '판정은 기록만'으로 갈랐다.
수리안: 할 일 없음. 다만 순찰 흔적이 장부에 남아 있다(links-9). 건국 1건의 앱 이름 boardTitle 은 links-8 에서 정리한다.
파일: collector/link-hunter.mjs, collector/resolve-detail-urls.mjs, collector/run-link-hunt.txt, data/registered.json
이미수리: 3bde4563·21691567(순찰·재검사 기록만) · f261edc8 외(주소 복원) · patrol: 0

--- [links-13] P3 (likely, human-decision) 원문 링크 확인 로봇 첫 실행의 오판 수리가 아직 실행으로 증명되지 않았다 — 다음 확인은 빨라야 10-05
증상: 첫 실행이 '한 번 본 문제'로 남긴 13건 가운데 국민대 3건·서울과기대 1건·정책명·잘린 제목 류는 오판으로 보고 코드를 고쳤다. 고친 코드가 실제 화면에서 맞게 도는지는 아직 아무도 안 봤다. 이 13건은 다음 날 다시 보면 확정되어 앱 링크 이름이 '(확인 필요)'로 바뀐다.
근거: collector/link-check-report.md: '이번 실행: 301건 … 문제로 보임 13 · 판정 못 함 22 · 확정 0'. 수리 커밋 fc44f85c(18:20Z) · b71da694(18:31Z)는 첫 실행(17:35Z) 뒤다. link-check-plan.mjs planQueue: `.filter((r) => r.s.lastAt !== today)` + tierOf 2 는 `s.at < today`. 첫 실행 날짜(KST) 2026-10-04 = 다음 예약(10-04 09:47Z = 18:47 KST)과 같은 날이라, 그 실행은 이 13건을 다시 열지 않는다. 고려 enc 꼴은 link-check 'post' / 복구 재검사 'list' 로 판정이 갈린다(links-10).
원인: 신설 로봇이고 확정 규칙이 '다른 한국 날짜에 두 번'이다. 오판 수리는 정찰로 근거를 댔지만 로봇 실행으로는 아직 확인 전이다.
수리안: 10-05 실행 뒤 link-check-report.md 의 '새로 확정' 목록에 국민대 12349/12385/12387 · 서울과기대 bnum=57138 이 들어갔는지 본다. 들어갔으면 앱이 그 링크를 '(확인 필요)'로 부르기 전에 정찰로 확인한다. 필요하면 수리 직후 push-to-run(run-link-check.txt only: kookmin.ac.kr)으로 하루 앞당겨 본다.
파일: collector/link-landing.mjs, collector/link-check-plan.mjs, collector/link-check-report.md

--- [links-14] P3 (likely, code) 링크 사냥꾼이 '못 읽음'(시간 초과·5xx) 표적은 재시도 간격 없이 매 실행(하루 약 5회) 다시 두드린다
증상: 학교 서버가 느려 시간 초과가 나는 표적은 횟수에도 안 세고 nextTryAt 도 안 생긴다. 그래서 수집 뒤 workflow_run 까지 하루 약 5번 같은 학교를 다시 연다. '같은 학교를 하루에 여러 번 두드리지 말 것' 규칙과 어긋난다.
근거: collector/link-hunter.mjs record(): `else if (outcome === 'net') { st.lastWhy = why; }` — nextTryAt 을 정하지 않는다. #379(00:59Z) 리포트: 전북 3건 '실패(page.goto: Timeout 20000ms exceeded.)'. 같은 날 사냥꾼은 01:33Z · 02:05Z · 08:41Z · 09:14Z · 12:10Z 에 다시 돌았다(run 37086544984 · 37088532071 · 37110523852 · 37112370475 · 37121988077).
원인: '못 읽음은 공고 잘못이 아니니 횟수에 안 센다'는 규칙이 '다시 볼 날'까지 지웠다. 트리거가 하루 1회에서 수집 뒤마다(2026-09-05)로 늘면서 효과가 커졌다.
수리안: 'net' 이면 횟수는 그대로 두고 nextTryAt 만 다음 날(KST)로 미룬다. 학교 단위로 '오늘 이미 연 게시판'을 기록해 같은 날 다시 열지 않게 하는 것도 방법이다.
파일: collector/link-hunter.mjs

--- [links-15] P3 (confirmed, code) 복구 로봇에만 바깥 시계(워치독)가 없다 + 예약 주석의 요일이 틀렸다
증상: 사냥꾼·확인 로봇은 어디서 멈춰도 예산이 끝나면 스스로 저장하고 끝낸다. 복구 로봇은 게시판 사이에서만 예산을 본다. 한 곳에서 매달리면 40분 시한 취소로 그때까지 고친 것을 잃고 넘어짐 경보가 뜬다(최근 실행에서 실제로 난 적은 없다). 예약 주석 '매주 월요일 05:13 KST' 는 실제로 화요일 05:13 KST 다.
근거: grep: resolve-detail-urls.mjs 에 watchdog/바깥 setTimeout 없음(outOfTime() 은 게시판·재검사 루프 머리에서만 확인). link-hunter.mjs:141 watchdog · link-check.mjs:108 watchdog. resolve-detail-urls.yml:31 `cron: '13 20 * * 1'   # 매주 월요일 05:13 KST` — UTC 월 20:13 = KST 화 05:13. 실제 예약 실행: 2026-09-29T00:20Z(화).
원인: 사냥꾼이 2026-09-05 에 배운 '시간 초과는 저장도 못 하게 죽인다'를 복구 로봇에 옮기지 않았다.
수리안: link-hunter.mjs 와 같은 unref() 워치독(BUDGET_MS + 90초 → saveAll(null) · exit 0)을 넣는다. 주석을 '매주 화요일 05:13 KST(월 20:13 UTC)'로 고친다.
파일: collector/resolve-detail-urls.mjs, .github/workflows/resolve-detail-urls.yml

--- [links-16] P3 (confirmed, human-decision) 게시판 후보 정찰(probe-boards.yml · probe.mjs)은 3개월째 안 쓰는 옛 도구 — 7월 리포트 이슈 #4 가 열려 있다
증상: 수동 실행 전용 도구가 7/3 에 한 번 돈 뒤 쓰이지 않는다. 같은 일은 find-boards·probe-links 가 한다. #4 '🔍 게시판 후보 정찰 리포트 2026-07-04' 가 열린 채다.
근거: actions_list probe-boards.yml: total_count 1(28673950032 · 2026-07-03). probe.mjs 는 collector/probe-candidates.json(20여 개교 7월 후보)만 읽고, run-probe.txt 와는 관계없다. probe-links.mjs·probe.mjs 둘 다 collector/probe-report.md 라는 같은 이름으로 쓴다(둘 다 저장소엔 안 쓴다).
원인: 초기 도구가 은퇴 처리 없이 남았다.
수리안: 사람이 정할 일: 은퇴(워크플로·probe.mjs·probe-candidates.json 삭제 또는 보관 표시)하고 #4 를 닫는다. 남긴다면 리포트 파일 이름을 probe-links 와 갈라 둔다.
파일: .github/workflows/probe-boards.yml, collector/probe.mjs, collector/probe-candidates.json

NOTES: 진단만 했다. 저장소 파일은 고치지 않았고, 로봇은 실행하지 않았으며 워크트리도 만들지 않았다. 쓴 것은 scratch 스크립트 2개뿐이다(/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/links/js.mjs · sl.cjs · audit.txt). 이 스크립트로 순수 모듈(canon-url·url-key·source-link)을 불러 jsessionid 가설을 쟀다. node verify/audit-data.js 는 exit 0 이고 git status 도 깨끗하다.

요점:
① #386 의 '진짜 원인': 로봇 고장이 아니다. 배포 push 로 main 에서도 뜬 실행을 사람이 설치 단계(42초 만)에서 취소한 것이다. main 에서 뜬 이유(push 트리거 branches 누락)는 0f8d91f4 로 고쳐졌고, 직후 수동 실행 37141332557 이 성공(8건 복구)했다. 남은 것은 이슈 닫기와 robot-down 의 약점(links-5)이다.
② 순찰은 정말 꺼져 있다: patrol: 0, HUNT_PATROL 을 주는 곳 없음. 순찰·재검사 코드는 판정만 적는다. 덮어쓴 8건은 모두 복원됐다.
③ '3회 못 찾음' 🔧 이슈는 실제로 쌓이고 있다. 'link-hunter' 라벨이 없어 묶이지 않고 매번 새로 생기며, 열린 것이 25건이다. #387 은 같은 실행에서 이미 찾은 건을 센 거짓 경보다.
④ push-to-run 로봇의 branches 거르개: resolve-detail-urls·link-hunter·link-check·probe-links 모두 기본 브랜치에만 건다. probe-boards·fetch-page 는 수동 실행 전용이다.

묶음 밖 관찰(다른 묶음 담당에게):
· close-old-reports.yml 에 actions/checkout 이 없다. 그래서 그 로봇의 robot-down 단계는 늘 'Can't find action.yml' 로 실패한다.
· 정식 등록 reg-khu-intern(마감 08-09)이 마감+30일이 지났는데도 registered.json 에 남아 있다. 'reg-' 항목이 오래된 공고 정리 대상에서 빠지는지 확인이 필요하다.
· 원문 링크 확인 로봇 첫 실행 기준 앱 링크는 1215건이다. 교내 소식 556건은 아직 한 번도 열리지 않았다. 순서상 며칠 뒤에 돈다.
