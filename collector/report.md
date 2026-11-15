## 🤖 장학공고 수집 리포트 (2026-11-15)

새로 발견한 공고: **0건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review
> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.
> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.

⏰ **시간 예산(8분)에 걸려 게시판 6곳을 이번 실행에서 못 봤습니다** — 한국항공대학교 대외활동·공모전 「행사공지」 · 가톨릭대학교 대외활동·공모전 「외부기관공지」 · 강원대학교 대외활동·공모전 「공모안내」 · 홍익대학교 대외활동·공모전 「행사/공모전공지」 · 충북대학교 대외활동·공모전 「모집/공모」 · 가천대학교 대외활동·공모전 「대외활동안내」
  → 이번에 본 게시판 96/102곳 · 다음 실행은 **한국항공대학교 대외활동·공모전 「행사공지」**부터 시작합니다.

🙋 연속 6회(약 이틀) 넘게 글이 안 들어오는 대외활동·재단 출처 13곳 — 대외활동은 관리자 「활동」 탭에서 보관하거나 주소를 고치고, 재단·지자체는 collector/external-sources.json 에서 고쳐 주세요: 한국외국어대학교 대외활동·공모전 「진로·취업」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · 경희대학교 대외활동·공모전 「취업/경력」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · 경희대학교 대외활동·공모전 「사회진출 프로그램 공지」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · 서울시 청년몽땅정보통 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · KOICA 봉사단 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · 서울문화포털 공모소식 대외활동·공모전(⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) · 74회 연속) · 광주청년통합플랫폼 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 82회 연속) · 경남청년정보플랫폼 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 61회 연속) · 재단법인 김해시미래인재장학재단(⚠️ 오류 (TimeoutError: 23) · 83회 연속) · 미래에셋박현주재단(⚠️ 접속 실패 (HTTP 503) · 82회 연속) · 롯데장학재단(🟡 접속은 되지만 장학 공고를 찾지 못함 · 82회 연속) · 재단법인 울산연구원(⛔ robots.txt 가 막아 둔 주소 · 76회 연속) · 재단법인 강서구장학회(서울)(⛔ robots.txt 가 막아 둔 주소 · 14회 연속)

⚠️ 정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 666KB 를 받습니다(학교 46곳 · 전국분 286KB 은 모두가 받아야 합니다). 실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. 이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 (왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)

### 경희대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 한국외국어대학교
상태: ✅ 정상 (실공고 11건 감지)

### 서울대학교
상태: ✅ 정상 (실공고 24건 감지)

### 연세대학교
상태: ✅ 정상 (실공고 25건 감지)

### 연세대학교 미래캠퍼스
상태: ✅ 정상 (실공고 43건 감지)

### 고려대학교
상태: ⚙️ 게시판 주소 미설정 (개발자가 준 장학금공지 주소(korea.ac.kr/ko/568/subview.do)는 목록 행이 href="#1" + jf_view() 클릭 스크립트라 일반 fetch로는 링크가 하나도 안 나온다(2026-08-02 확인 — 옛 주소 scholarship.korea.ac.kr도 안내 홈페이지라 0건이었다). 동국대·경희대와 같은 클릭형이라 browser-targets.json으로 옮겼다)

### 고려대학교 세종캠퍼스
상태: ✅ 정상 (실공고 7건 감지)

### 서강대학교
상태: ✅ 정상 (실공고 24건 감지)

### 성균관대학교
상태: ✅ 정상 (실공고 10건 감지)

### 한양대학교
상태: ⚠️ 접속 실패 (HTTP 403) — 주소 수정 필요

### 한양대학교 서울
상태: ✅ 정상 (실공고 9건 감지)

### 중앙대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — CAU Notice의 장학 탭(P_TAB_NO=5), 485건. 행이 클릭형(fn_goDetail)이라 browser-targets.json이 담당한다)

### 서울시립대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 건국대학교
상태: ✅ 정상 (실공고 26건 감지)

### 동국대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 동국대학교 WISE캠퍼스
상태: ✅ 정상 (실공고 3건 감지)

### 홍익대학교
상태: ✅ 정상 (실공고 7건 감지)

### 숙명여자대학교
상태: ✅ 정상 (실공고 9건 감지)

### 광운대학교
상태: ✅ 정상 (실공고 5건 감지)

### 명지대학교
상태: ✅ 정상 (실공고 9건 감지)

### 상명대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 가천대학교
상태: ✅ 정상 (실공고 154건 감지)

### 아주대학교
상태: ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 국민대학교
상태: ✅ 정상 (실공고 16건 감지)

### 숭실대학교
상태: ✅ 정상 (실공고 12건 감지)

### 세종대학교
상태: ✅ 정상 (실공고 9건 감지)

### 이화여자대학교
상태: ✅ 정상 (실공고 14건 감지)

### 인하대학교
상태: ✅ 정상 (실공고 44건 감지)

### 부산대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — onestop.pusan.ac.kr 장학 공지 511건. 목록을 자바스크립트가 그리고 행이 href="#popup"이라 browser-targets.json이 담당한다)

### 가톨릭대학교
상태: ✅ 정상 (실공고 6건 감지)

### 한국항공대학교
상태: ✅ 정상 (실공고 52건 감지)

### 경기대학교
상태: ✅ 정상 (실공고 5건 감지)

### 서울과학기술대학교
상태: ✅ 정상 (실공고 55건 감지)

### 계명대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — kmu.ac.kr 장학 공고 23건 보임. 상세 링크가 HTML에 없어 browser-targets.json이 담당한다)

### 서울교육대학교
상태: ✅ 정상 (실공고 12건 감지)

### 한국방송통신대학교
상태: ✅ 정상 (실공고 30건 감지)

### 경북대학교
상태: ✅ 정상 (실공고 6건 감지)

### 영남대학교
상태: ✅ 정상 (실공고 9건 감지)

### 전북대학교
상태: ✅ 정상 (실공고 9건 감지)

### 충남대학교
상태: ✅ 정상 (실공고 6건 감지)

### 전남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 조선대학교
상태: ✅ 정상 (실공고 46건 감지)

### 충북대학교
상태: ✅ 정상 (실공고 1건 감지)

### 부경대학교
상태: ✅ 정상 (실공고 17건 감지)

### 강원대학교
상태: ⚠️ 오류 (TypeError: UND_ERR_SOCKET) — 주소 확인 필요

### 🚨 연속 실패 — 게시판 주소 확인 필요
한 번은 일시 장애지만 3회 연속이면 주소가 바뀐 것입니다. 해당 학교 학생 화면에 새 공고가 안 들어옵니다.
- 한양대학교 (57회 연속) — 접속 실패 (HTTP 403) — 주소 수정 필요
- 아주대학교 (66회 연속) — 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요
- 강원대학교 (36회 연속) — 오류 (TypeError: UND_ERR_SOCKET) — 주소 확인 필요

### 🎯 대외활동·공모전 새 글 64건 → 앱 '대외활동' 탭 (data/activities.json · 200건 게재 중)
- **숙명여자대학교 대외활동·공모전 「주요 행사」** — ✅ 정상 (활동·공모전 3건 감지)
  - [대외활동] [「숙명사랑 김장나눔봉사」 참여자 모집](https://www.sookmyung.ac.kr/kr/news/event.do?mode=view&articleNo=95995&article.offset=0&articleLimit=12)
  - [공모전] [숙대신보 창간 71주년·숙명타임즈 54주년 기념 시 공모전](https://www.sookmyung.ac.kr/kr/news/event.do?mode=view&articleNo=95912&article.offset=0&articleLimit=12) — ⏰ 접수 기간: 2026. 10. 30.(금) ~ 11. 18.(수) - 제출 방법: 1. 본교 비교과통합관리시스템(SNOWISE) 해당 공모전 게
  - [공모전] [2026 SNOWCHAT AI 서비스 경진대회 참가 신청 기간 연장 안내](https://www.sookmyung.ac.kr/kr/news/event.do?mode=view&articleNo=95682&article.offset=0&articleLimit=12) — ⏰ 신청 기간 연장 안내 379 관리자 2026 - 11 - 03 2026_SNOWCHAT_AI_서비스_경진대회_참가신청서_예시포함.pdf SNOW
- **충남청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 4건 감지)
  - [대외활동] [충청남도 청년 정신건강 서포터즈 「마음·잇길」 활동보고회](https://youth.chungnam.go.kr/web/main/bbs/cnyouth_notice/791?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&bcId=cnyouth_notice&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true) — ⏰ 접수기간 : ~2026. 11. 1.(일)까지 ▪ 신청방법 : 충남광역정신건강복지센터 홈페이지 자세한 내용과 참가 신청은 포스터 내 QR코드를
  - [공모전] [우리동네 청년 사장님을 소개합니다 공모전 응원 댓글 이벤트](https://youth.chungnam.go.kr/web/main/bbs/cnyouth_notice/790?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&bcId=cnyouth_notice&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true)
  - [대외활동] [2026 공주 크리에이티브 IP 캠프 참여자 모집!](https://youth.chungnam.go.kr/web/main/bbs/cnyouth_notice/783?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&bcId=cnyouth_notice&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true) — ⏰ 모집기간 : 2026. 10. 12.(월) ~ 11. 6.(금) 모집대상 : 공주·백제 자원을 활용해 창작·창업하고 싶은 18~45세 청년 20
  - [대외활동] [2026 미래내일 일경험 기업 실무 프로젝트 참여자 모집](https://youth.chungnam.go.kr/web/main/bbs/cnyouth_notice/782?cp=1&sortOrder=BA_REGDATE&sortDirection=DESC&bcId=cnyouth_notice&baNotice=false&baCommSelec=false&baOpenDay=false&baUse=true) — ⏰ 모집기간 : 2026. 10. 22.(목) ~ 11. 10.(화) 모집대상 : 만 15~34세 미취업 청년 참여방법 : 개인 또는 팀 단위 신청
- **한국대학사회봉사협의회 대외활동·공모전** — ✅ 정상 (활동·공모전 19건 감지)
  - [대외활동] [[대외협력사업팀] 제21기 씨티-경희대 NGO 인터십 프로그램 인턴 모집(~11/23)](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=991)
  - [대외활동] [[사무국] 2026년 대학 사회봉사 업무 연수 안내](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=982)
  - [대외활동] [[대외협력사업팀] SK Telecom과 한국대학사회봉사협의회의 스마트 라이프 교육 대학생 봉사팀 모집](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=980)
  - [대외활동] [[대외협력사업팀] 농협중앙회 × 한국대학사회봉사협의회 대학생 농촌 봉사활동 '농심천심'](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=978)
  - [대외활동] [[해외2팀] 51기 WFK 청년봉사단 단장 및 단원 모집 공고](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=975&page=2) — ⏰ 지원기간 : 2026.09.04.(금) ~ 대학별 마감일 상이 *지원서 제출 마감일은 대학마다 다르므로, 1차 심사 관련 상세 내용은 반드시 소
  - [공모전] [[해외1팀] 2025-2027 KOICA 청년중기봉사단(아프리카 중남미) 1차 파견 단원 활동공모전(디지털어…](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=971&page=2)
  - [대외활동] [[해외2팀] 2026년 동계 대학 자체개발 해외봉사 프로그램 공모](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=970&page=2)
  - [대외활동] [[해외1팀] 2025-2027 KOICA-청년중기봉사단(아프리카,중남미) 2차 파견단원 최종합격 및 국내교육…](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=969&page=2)
  - [공모전] [[코이카]WFK 해외봉사단 영상/사진 공모전 : 내 인생의 한 페이지](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=960&page=3)
  - [대외활동] [[해외1팀](!기한연장!) 2025-2027 KOICA-청년중기봉사단(아프리카,중남미) 2차 파견 단원 모집…](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=959&page=3) — ⏰ 접수 기한을 5.13.(수)까지 연장합니다! 관심있는 지원자분들의 많은 지원 바랍니다. *기존 서류심사 및 발표 일정은 이전과 동일하오니, 아래
  - [대외활동] [[해외1팀] (모집설명회) KOICA 청년중기봉사단(아프리카,중남미) 2차 파견 단원 모집](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=957&page=3)
  - [대외활동] [농심천심 대학생 봉사단 사업 12개교 선정](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=956&page=3)
  - [대외활동] [[해외2팀] 2026년 WFK 청년봉사단 귀국단원 온기나눔 네트워킹 활동 모집 공고(~4.24(금) 17:0…](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=955&page=3)
  - [대외활동] [[해외2팀] 50기 WFK 청년봉사단 단장 및 단원 모집 공고](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=954&page=3)
  - [대외활동] [[해외1팀](본공고) 2025-2027 KOICA-청년중기봉사단(아프리카,중남미) 2차 파견 단원 모집 안내](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=953&page=3) — ⏰ 모집기간 · 사전공고 2026.04.07.~04.19. · 신청접수 2026.04.20.~05.10. * 지원 방법 · 4월 20일부터 5월 1
  - [대외활동] [[해외1팀] (사전공고) 2025-2027 KOICA-청년중기봉사단(아프리카,중남미) 2차 파견 단원 모집 …](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=950&page=3)
  - [대외활동] [[해외2팀] 2026년 하계 대학 자체개발 해외봉사 프로그램 공모](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=945&page=3)
  - [대외활동] [[해외2팀]2026년 WFK 청년봉사단 전문기관 프로그램 공모(정정_국가 변경)](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=944&page=3)
  - [대외활동] [[해외2팀] 2025년 대학 자체개발 해외봉사 프로그램 성과공유회 개최](https://kucss.or.kr/dpbbs/board.php?bo_table=dp_notice&wr_id=943&page=3)
- **한국외국어대학교 대외활동·공모전 「학생활동」** — ✅ 정상 (활동·공모전 10건 감지)
- **한국외국어대학교 대외활동·공모전 「진로·취업」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「취업/경력」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「사회진출 프로그램 공지」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울시 청년몽땅정보통 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **창업진흥원 K-Startup 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **대한민국 정책브리핑 이벤트·공모 대외활동·공모전** — ✅ 정상 (활동·공모전 8건 감지)
- **경기청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **KOICA 봉사단 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **국립국제교육원 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **문화포털 문화지원사업 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울문화포털 공모소식 대외활동·공모전** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요
- **부산청년플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **인천유스톡톡 청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 5건 감지)
- **대전청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 10건 감지)
- **울산청년정책플랫폼 U-PAGE 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **광주청년통합플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경남청년정보플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **청년재단 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **서울과학기술대학교 대외활동·공모전 「공모/외부행사」** — ✅ 정상 (활동·공모전 38건 감지)
  - [공모전] [대학 공식 마스코트 '테크뇽' 세계관 고도화 아이디어 공모전](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893642&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [대외활동] [[한양대 실험실창업혁신단] Pre-TeX-Corps 참가자 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=897682&qidx=6302&cate=10&allboard=false&nowpage=1) — ⏰ 신청 기간 2026년 11월 19일(목)까지 선착순 50팀 내외 모집 � 참가 신청 https://forms.gle/kqbCX8bhFJpfYwX
  - [대외활동] [[문화체육관광부] 문화체육관광부 대학생기자단 울림 22기 모집 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=897276&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[한국어촌어항공단] 2026 청년 어촌 창업 아이디어 공모전](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=896358&qidx=6302&cate=10&allboard=false&nowpage=1) — ⏰ 접수기간: 2026.11.08 자정까지 접수방법: 포스터 내의 QR 코드 스캔 후 페이지 내의 파일 다운로드 후 작성 및 이메일 접수( co-v
  - [공모전] [[ D4D x EDTH 해커톤] 🚀 KOREAN DEFENSE TECH HACKATHON | D4D x EDTH 참가자 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=895849&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[부산광역시상수도사업본부] 부산의 수돗물 홍보디자인 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=895824&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [대외활동] [[노원구청] 노원맑음돌봄단 참여자 모집 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=894511&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[국민연금공단] 2026년 AI 활용 기초연금 홍보 콘텐츠 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893582&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [대외활동] [[재단법인 한국청년기업가정신재단] 2026 한난 온랩(On-Lab) 참가팀 모집 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893358&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[시립인터넷중독예방상담센터] 청소년 디지털 윤리의식 On&On 인스타툰/숏폼 공모전 신청 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893357&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[행정안전부/한국지역정보개발원] 청년들이 만드는 첨단 공공서비스 AI 영상 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893356&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[금융감독원] 제21회 금융공모전 참여 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=893354&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[사단법인 한일문화산업교류협회] 한일축제한마당 2026 숏폼 영상 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=892667&qidx=6302&cate=10&allboard=false&nowpage=1) — ⏰ 접수 기간 2026년 6월 5일(금) ~ 7월 24일(금) 5. 결과 발표 2026년 8월 4일(화) 6. 시상식 2026년 10월 10일(토)
  - [공모전] [[국립농업박물관] 2026년 국립농업박물관 문화상품(굿즈) 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=892382&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [[경찰청] 제14회 과학수사 아이디어 공모전 개최 안내](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=892360&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [대외활동] [[국립조선왕조실록박물관] 2026 국립조선왕조실록박물관 청년 국제 교류프로그램 참가자 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=6302&bidx=892202&qidx=6302&cate=10&allboard=false&nowpage=1)
  - [공모전] [대학 공식 마스코트 '테크뇽' 세계관 고도화 아이디어 공모전](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=6302&bidx=893642&qidx=6302&cate=10&allboard=false&nowpage=2)
  - [대외활동] [[외교부] 국립외교원 국민외교아카데미 제9기 대학생 외교 연수 과정 참가자 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=6302&bidx=891781&qidx=6302&cate=10&allboard=false&nowpage=2) — ⏰ 제출기한 : 2026. 7. 10.(금) 14:00 까지 - 제출서류 : (첨부2) 참가신청서 및 (첨부3) 개인정보수집이용동의서 - 제출방법:
  - [대외활동] [NH농협은행 재능봉사캠프 대학생 멘토 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=6302&bidx=890051&qidx=6302&cate=10&allboard=false&nowpage=2)
  - [대외활동] [2026년 서울 동아리ON(대학생 동아리 지원) 참여 동아리 모집](https://www.seoultech.ac.kr/service/board/rec?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=6302&bidx=889065&qidx=6302&cate=10&allboard=false&nowpage=2)
- **성균관대학교 대외활동·공모전 「채용/모집」** — ✅ 정상 (활동·공모전 9건 감지)
  - [대외활동] [[인공지능혁신융합대학사업단] 2026 AICOSS 11월 전문가 특강 안내 사전신청안내](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141810&article.offset=0&articleLimit=10)
  - [대외활동] [[창업지원단/실험실창업혁신단] 2026 SKKU UNITE 프리 텍스코어(11/28~29) 참가자 모집(이비스 앰배서더 수원, 총상금 350만원)](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141498&article.offset=0&articleLimit=10) — ⏰ 신청기간: 2026.11.02.(월) ~ 2026.11.23.(월)까지 ■ 행사일정: 2026.11.28.(토) 11시 ~ 2026.11.29.
  - [대외활동] [2026학년도 동계 의료인공지능 체험형 인턴십 프로그램 참가자 모집(~11/27)](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141980&article.offset=0&articleLimit=10) — ⏰ 모집기간 : 2026. 11. 27. 까지 ○ 전형절차 : 지원서 접수 > 면접 > 최종합격 *기업에 따라 코딩테스트, 인성검사, 기술면접 PT
  - [대외활동] [[대학혁신과공유센터] 2026학년도 해외융합프로젝트 참가자 모집(스위스 제네바 국제기구 탐방)](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141930&article.offset=0&articleLimit=10) — ⏰ 신청 기간: 2026년 11월 13일(금) ~ 11월 18일(수) 오후 3시까지 (마감 시간은 담당자 이메일로 메일이 수신된 시간을 기준으로 함
  - [공모전] [제7회 크리에이티브 브릿지 페스티벌 작품 공모](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141687&article.offset=0&articleLimit=10)
  - [대외활동] [[뇌과학이미징연구단] (fMRI) 얼굴-장면-물체 지각 실험 참여자 모집](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141929&article.offset=0&articleLimit=10)
  - [대외활동] [2026학년도 겨울학기 현장실습 학생 지원 신청 안내(~11/29)](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141926&article.offset=0&articleLimit=10) — ⏰ 신청 기간: 2026. 11. 9.(월) ~ 11. 29.(일) 2) 실습 기간: 2026. 12. 21.(월) ~ 2027. 2. 28.(일)
  - [대외활동] [[연구 참여자 모집] AI면접 경험에 관한 연구](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141886&article.offset=0&articleLimit=10)
  - [대외활동] [겨울방학 중 특수교육 종일반 대학생 자원봉사자 모집](https://www.skku.edu/skku/campus/skk_comm/notice05.do?mode=view&articleNo=141880&article.offset=0&articleLimit=10) — ⏰ 신청 기간 : 2026. 11. 2.(월) ~ 11. 27.(금) 나. 접수 방법 : 이메일 접수(wnsjun0897@korea.kr) 다. 제
- **국민대학교 대외활동·공모전 「공모∙행사」** — ✅ 정상 (활동·공모전 9건 감지)
  - [대외활동] [[성북구] 2027년 상반기 청년 행정체험단 모집(~11/27)](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12607/view.do?currentPageNo=1)
  - [대외활동] [[창조산업 인재양성] 2026학년도 동계방학 「Connect 실전콘텐츠 제작」 캠프 참여자 모집 안내 (~12/21, 11/18까지 우선 선발)](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12601/view.do?currentPageNo=1) — ⏰ 신청 기간 및 방법 ○ 신청 기간: 공지일 ~ 2026. 12. 21.(월) 23:59 ※ 2026. 11. 18.(수)까지 신청 시 우선 선발
  - [대외활동] [[글로벌공생사업단] 2026 HUSS 동계 공동융합캠프 "지산학 리더십 아카데미" 참가 학생 모집 안내](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12589/view.do?currentPageNo=1) — ⏰ 신청기간: 2026.11.09.(월) ~ 2026.11.22.(일)까지 / ★ 신청링크: https://forms.gle/5EYWRK62iYDx
  - [대외활동] [[서울특별시] 2026년 청년인생설계학교 스타터코스 참여자 모집(~11/16)](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12531/view.do?currentPageNo=1)
  - [대외활동] [활동 [기후변화대응사업단] 2026 HUSS 미래융합 아카데미 참가자 모집 (~11/20(금) 14:00) 2026.11.13 기후변화대응사업단 김동윤](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12622/view.do?currentPageNo=1) — ⏰ 신청기간 : 2026.11.10.(화) 14:00 ~ 11.20.(금) 14:00 2) 신청방법 : 환경컨소시엄 통합시스템을 통한 온라인 신청
  - [대외활동] [활동 [글로벌공생사업단] (영남대 주관) 2026 동계 글로벌공생 HUSS 사업단 해외프로그램(글로벌 자원 활용-베트남) 참가자 모집 안내 2026.11.03 글로벌공생사업단 신보람](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12584/view.do?currentPageNo=1) — ⏰ 신청기간: ~ 2026.11.11.(수) 17:00까지 / ★ 신청링크: https://forms.gle/Neiih8KDxaepLQr5A ★ 사
  - [공모전] [기타 [행정안전부] 2026년 재난안전 AI 데이터 활용 해커톤 공고 안내 2026.10.30 행정안전부 김주현](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12575/view.do?currentPageNo=1)
  - [대외활동] [[문화체육관광부] 대학생 기자단 울림 22기 모집(~11/9) 2026.10.30 문화체육관광부 김효선](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12569/view.do?currentPageNo=1)
  - [공모전] [[차세대통신사업단] 2026 차세대통신 X 융합 창업 아이디어 경진대회 안내 2026.10.28 차세대통신사업단 이지우](https://www.kookmin.ac.kr/user/kmuNews/notice/9/12560/view.do?currentPageNo=1)
- **한국항공대학교 대외활동·공모전 「행사공지」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다
- **가톨릭대학교 대외활동·공모전 「외부기관공지」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다
- **강원대학교 대외활동·공모전 「공모안내」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다
- **홍익대학교 대외활동·공모전 「행사/공모전공지」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다
- **충북대학교 대외활동·공모전 「모집/공모」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다
- **가천대학교 대외활동·공모전 「대외활동안내」** — ⏰ 시간 예산(8분) 소진 — 이번 실행은 건너뜀, 다음 실행이 여기부터 이어서 봅니다

### 🏛 재단·지자체 새 공고 0건 → 홈 '재단·지자체 새 공고' (data/external.json · 61건 게재 중 · 게시판 아는 곳 26/81)
- **영동군민장학회** — ✅ 정상 (장학 공고 8건 감지)
- **(재)음성군장학회** — ✅ 정상 (장학 공고 6건 감지)
- **재단법인 김해시미래인재장학재단** — ⚠️ 오류 (TimeoutError: 23) — 주소 확인 필요
- **전주인재육성재단** — ✅ 정상 (장학 공고 5건 감지)
- **재단법인 상주시장학회** — ✅ 정상 (장학 공고 3건 감지)
- **재단법인 울산연구원** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **재단법인 삼원장학재단** — ✅ 정상 (장학 공고 25건 감지)
- **한진해운장학재단** — ✅ 정상 (장학 공고 5건 감지)
- **(재)송파구 인재육성 장학재단** — ✅ 정상 (장학 공고 18건 감지)
- **파안장학문화재단법인** — ✅ 정상 (장학 공고 25건 감지)
- **메디힐장학재단** — ✅ 정상 (장학 공고 9건 감지)
- **(재)고속도로장학재단** — ✅ 정상 (장학 공고 3건 감지)
- **아산시미래장학회** — ✅ 정상 (장학 공고 7건 감지)
- **관정이종환교육재단** — ✅ 정상 (장학 공고 27건 감지)
- **두산연강재단** — ✅ 정상 (장학 공고 4건 감지)
- **미래에셋박현주재단** — ⚠️ 접속 실패 (HTTP 503) — 주소 수정 필요
- **아산사회복지재단** — ✅ 정상 (장학 공고 10건 감지)
- **한국장학재단 공지** — ✅ 정상 (장학 공고 14건 감지)
- **국립국제교육원 공지** — ✅ 정상 (장학 공고 2건 감지)
- **롯데장학재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **일주학술문화재단** — ✅ 정상 (장학 공고 5건 감지)
- **백운장학회(광양)** — ✅ 정상 (장학 공고 4건 감지)
- **재단법인 거창군장학회** — ✅ 정상 (장학 공고 10건 감지)
- **(재)진천군장학회** — ✅ 정상 (장학 공고 7건 감지)
- **대산농촌재단** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요
- **재단법인 강서구장학회(서울)** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)

### 📄 목록 2페이지 이후에서 더 읽은 게시판
1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.
- 한국대학사회봉사협의회 대외활동·공모전: 2페이지 더 읽어 52행 추가
- 재단법인 삼원장학재단: 2페이지 더 읽어 18행 추가
- (재)송파구 인재육성 장학재단: 2페이지 더 읽어 26행 추가
- 관정이종환교육재단: 2페이지 더 읽어 17행 추가
- 아산사회복지재단: 2페이지 더 읽어 50행 추가
- 서울대학교: 2페이지 더 읽어 118행 추가
- 연세대학교: 2페이지 더 읽어 22행 추가
- 연세대학교 미래캠퍼스: 2페이지 더 읽어 35행 추가
- 가천대학교: 2페이지 더 읽어 427행 추가
- 인하대학교: 2페이지 더 읽어 52행 추가
- 한국항공대학교: 2페이지 더 읽어 192행 추가
- 서울과학기술대학교: 2페이지 더 읽어 182행 추가
- 한국방송통신대학교: 2페이지 더 읽어 30행 추가
- 조선대학교: 2페이지 더 읽어 34행 추가
- 한국외국어대학교 대외활동·공모전 「학생활동」: 2페이지 더 읽어 70행 추가
- 서울과학기술대학교 대외활동·공모전 「공모/외부행사」: 2페이지 더 읽어 172행 추가

📄 페이지 넘기기가 안 되는 게시판 83곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`
**⏳ 스키마화 대기 중 98건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 0건 등록

이번 실행에서 자동 등록 기준(개별 실공고·미등록·마감 전)을 전부 통과한 공고가 없어요.

**컨펌 대기 (자동 기준 미달 213건)** — 장학 신호는 있지만 선발·모집 신호가 약하거나 등록 규칙에 걸렸어요(괄호에 이유):
- 2026학년도 AX미래장학금 장학생 선발 공고 (같은 사업의 지난 회차(중앙대학교 등록분 · 마감 2026-09-21) — 새 회차인지 컨펌 대기)
- [교외] 2026학년도 미래 건설교통기술인 장학사업 안내 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- [홍보] 2027학년도 강남장학회 장학생 선발 안내 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- 2027학년도 강남장학회 장학생 모집 안내 (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(동국대학교 · [홍보] 2027학년도 강남장학회 장학생 선)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- [교외][등록금 + 생활비] 2027년도 유하푸른재단 제10기 장학생 선발 안내( ~ 11. 20. 23:5 (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(홍익대학교 · [유하푸른재단] 2027년도 제 10기 유하)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- 2027학년도 강남장학회 장학생 선발 공고 (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(동국대학교 · [홍보] 2027학년도 강남장학회 장학생 선)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- 미래 건설교통신기술인 장학사업 안내 (타교 등록분과 동일 사업(미래 건설교통신기술인 장학사업 신청 안내(대) — 접수분 여부 컨펌 대기)
- [글로벌] 2027학년도 대학수학능력시험 관련 일반 교내 국가근로장학생 근로 시작시간 조정 안내 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- 장학 ★ 2027학년도 재단법인 관정재단 장학생 선발 공고(~11/24 화 15시) (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(이화여자대학교 · [학부] 관정재단 2027년도 국내대학 장학)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- [유하푸른재단] 2027년도 제 10기 유하푸른재단 장학생 선발 (타교 등록분과 동일 사업([교외] 유하푸른재단 장학생 선발 안내(11) — 접수분 여부 컨펌 대기)
- … 외 203건

컨펌 대기 이유별: 같은 사업의 지난 회차 64건 · 타교 등록분과 동일 사업 48건 · 선발·모집·신청 신호 없음 39건 · 내년도 사업 · 같은 사업으로 보이는 다른 글 22건 · 내년도 사업 · 마감 모름 21건 · 내년도 사업 · 마감이 오늘~올해 밖 6건 · 타교 등록분과 동일 사업[교외] 유하푸른재단 장학생 선발 안내 5건 · 타교 등록분과 동일 사업[교외] STX장학재단 장학생 선발 안내 5건 · 타교 등록분과 동일 사업미래 건설교통신기술인 장학사업 신청 안내 1건 · 타교 등록분과 동일 사업2026-2학기 창암장학재단 장학생 선발 1건 · 타교 등록분과 동일 사업[우양재단] 2026년 동행 장학생 모집 1건

⚠️ 차단 id 하나가 여러 공고에 걸림 — 주소(blockUrls)로만 막음: `auto-amepagescholarshipnotice` 16건

**거른 공고 434건 — 이유별**

- 이미 등록(원문 동일) · 159건
- 이미 등록(동일 사업) · 86건
- 마감 경과 · 49건
- 이미 전국(동일 사업) · 45건
- 행정 안내(신청 공고 아님) · 36건
- 국가장학금 상시 제도 — 앱 내 카드로 이미 안내 · 12건
- 행사·연수·설명회(신청형 장학 아님) · 11건
- 마감 경과(등록 뒤 원문에서 확인) · 8건
- 학자금 대출·융자(장학금 아님) · 6건
- '장학' 신호 없음 · 5건
- 이미 등록(동일 사업)춘천인재육성장학) · 3건
- 이미 등록(동일 사업)논산시장학회 ) · 3건
- 학부생 대상 아님(대학원 등) · 2건
- 이미 등록(동일 사업)포항시장학회) · 2건
- 차년도 계획·신입학(현 재학생 신청 대상 아님) · 1건
- 채용·고용성 · 1건
- 이미 등록(동일 사업) 2026학년도 2학기 교) · 1건
- 메뉴·안내 페이지 · 1건
- 게시판에 마감 표시됨 · 1건
- 이미 등록(동일 사업)대전청년내) · 1건
- 이미 등록(동일 사업)인천인재평생교육진흥원) · 1건

## 🔎 읽지 못한 공고 현황 (마감 전 정식 등록 99건 · 상시 제도 제외)

### 💰 금액 모름 — 36건
- 원문에 금액 없음·첨부 없음: 14건
- 원문 없음·첨부 있음: 7건
- 글자 있는데 못 읽음: 7건
    - [교내/선발] 2026학년도 2학기 학부 교내장학 선발완료 안내 `auto-q1brddate20260807brdseq2`
    - 2026-2학기 천마가족장학금 신청 안내 `auto-ticedoarticleno231554923`
    - 2026학년도 2학기 외국인재학생장학금 신청 안내(~11/18) `auto-bswj104944500artclviewdo`
    - 제6회 글로벌 여성리더 장학생 선발 안내[학부생/대학원생] `auto-2570viewdocurrentpageno1`
    - [메디컬] (등록금 전액) 2027학년도 한독제석재단 장학생 후보 선발 안내 `auto-skor478126688artclviewdo`
    - 제21회 차세대 여성리더 장학생 선발 안내 `auto-2582viewdocurrentpageno1`
    - 2026-2학기 국가근로장학생 모집(교체선발)_한국전시산업융합연구원 `auto-4bnum57138cate0qidx57138-1duciyc`
- 원문에 금액 없음·첨부 있음: 7건
- 원문 없음·첨부 없음: 1건

### 📅 마감 없음 — 34건
- 날짜만 있음(이름표 없음): 17건
- 원문 없음: 14건
- 원문에 날짜 없음: 2건
- 글자 있는데 못 읽음: 1건
    - 엔지니어링인재육성재단 장학생 선발 공고 `auto-4srsearchkeyarticletitle`

### 📋 자격 줄 없음 — 6건
- 원문 있는데 자격 절 없음: 4건
- 원문 없음: 2건

> 「글자 있는데 못 읽음」은 규칙이 고칠 목록(parse-amount · extract-excerpts) · 「원문 없음」은 자격요건 로봇(rescue-bodies)이 다시 받는다 · 「원문에 없음」은 첨부 로봇 몫이거나 정직한 빈 칸.
- 자격 줄 전수: 공고 99/93/163 · 조건을 하나도 못 읽는 줄 66/140/53 (등록/재단/활동 · 합 259) · 처지 상위 job 12, award 9, kosafApplied 7, member 6, military 6 · ⚠️ 온보딩 질문 목록 손볼 때 — 4곳 미만인데 묻는 것: 없음 · 4곳 이상인데 안 묻는 것: member 6
- 가상 학생 판정(마감 전 등록 99건 · 완전(외대3)/약한(경희1)/이과(연세2)): 자격미확인 31/31/32 · 미달 17/48/27 · 전부충족 14/5/10 · 일부/모름 37/15/30 · 자격 줄 286개 중 모름 157/164/159 (55%/57%/56%) · 조건 못 집음 67/67/67


### 🌐 범위 승격 (학교 한정 → 전국) — 0건
원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.
- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.
### 🏫 교내·교외 원문 판정 — 바뀐 것 0건 · 후보 9건 · 학교 제도 새로 배움 0건
판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.
- 뒤집힌 판정 없음
- 후보 교외 → 교내? `auto-oardid323225menuno200318` 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금 — 제목의 학교 이름표 「경희」 · 접수처 「포털 인포21」
- 후보 교외 → 교내? `auto-2445viewdocurrentpageno1` 2026학년도 국민대학교 교수회 제자사랑장학금 신청 안내 — 제목의 학교 이름표 「국민대학교」 · 접수처 「학생지원팀 신청」
- 후보 교외 → 교내? `auto-jong659273457artclviewdo` [기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내 — 제목의 학교 이름표 「고려대」
- 후보 교외 → 교내? `auto-bbssc58944362artclviewdo` 2026학년도 연세 월든장학금 신청 안내(생활비) — 제목의 학교 이름표 「연세」 · 접수 이메일 도메인 yonsei.ac.kr (학교)
- 후보 교외 → 교내? `auto-rykeywordpaged1slug20262-0mvhb0o` 장학 ★ 2026학년도 2학기 특별장학금(주거비, 교통비, 근면숭실, 공 — 제목의 학교 이름표 「숭실」 · 접수처 「SAINT ‘장학금 종류 및 신청」
- 후보 교외 → 교내? `auto-amepagescholarshipnotice-0he48mo` [발전기금] 서강 나눔의터(여교수회) 장학생 선발 안내(11/5 마감,  — 제목의 학교 이름표 「서강」
- 후보 교외 → 교내? `auto-ghaknoticedetail26766866` 2026-2학기 동국사랑1.1.1 장학 신청 안내(~11.20.(금) 1 — 제목의 학교 이름표 「동국」
- 후보 교외 → 교내? `auto-orykeywordpaged1slug2026-0ezoyxo` 장학 2026년 숭실대학교 직원 추천 장학생 선발 공고 — 제목의 학교 이름표 「숭실대학교」
- 후보 교외 → 교내? `auto-0713no2516266sitedvscdkr` 2026학년도 충남대학교 백마봉사단「사회 재환원 장학금」대상자 추천 안내 — 제목의 학교 이름표 「충남대학교」

### 📄 제출 서류 채우기 (원문 「제출서류」 절) — 0건 · 아직 자리표시뿐 138건
원문 본문의 `제출서류·구비서류` 절 아래 서류 이름 줄만 담았어요(설명 문장·곁말·제출 방법은 뺌). 원문이 없거나 절이 없는 글은 그대로 둡니다.
- 이번 실행에서 원문에서 읽은 서류가 없었어요.

### 🏛 학교 신청 시스템 후보 — 2개교 (아직 표에 없는 이름)
정식 등록 공고 원문에서 학교별 신청 시스템 이름을 모았어요. ✅ 는 그 학교에만 나오고 근거가 2건 이상인 이름이에요 — 확인하고 apply-channel.js 시스템 표에 넣어 주세요(주소는 정찰로 확인한 것만).
- ✅ **국민대학교** → ON 국민 (2건) — 예: "ㅇ 신청방법 : ON 국민 - 포털 - 학생서비스 - 장학정보 - 장학신청"
- **건국대학교** → 학사정보시스템 (1건) — 예: "★ 서울캠퍼스 학부생이 있는 경우 : 서울캠퍼스 학부생이 학사정보시스템에서 신청"