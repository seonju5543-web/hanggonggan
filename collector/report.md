## 🤖 장학공고 수집 리포트 (2026-10-07)

새로 발견한 공고: **20건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review
> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.
> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.

⏱ 게시판 86곳을 4분 48초에 다 돌았습니다(예산 8분).

⚠️ 정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 278KB 를 받습니다(학교 41곳 · 전국분 151KB 은 모두가 받아야 합니다). 실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. 이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 (왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)

### 경희대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 한국외국어대학교
상태: ✅ 정상 (실공고 42건 감지)

### 서울대학교
상태: ✅ 정상 (실공고 11건 감지)

### 연세대학교
상태: ✅ 정상 (실공고 25건 감지)

### 연세대학교 미래캠퍼스
상태: ✅ 정상 (실공고 42건 감지)

### 고려대학교
상태: ⚙️ 게시판 주소 미설정 (개발자가 준 장학금공지 주소(korea.ac.kr/ko/568/subview.do)는 목록 행이 href="#1" + jf_view() 클릭 스크립트라 일반 fetch로는 링크가 하나도 안 나온다(2026-08-02 확인 — 옛 주소 scholarship.korea.ac.kr도 안내 홈페이지라 0건이었다). 동국대·경희대와 같은 클릭형이라 browser-targets.json으로 옮겼다)

### 고려대학교 세종캠퍼스
상태: ✅ 정상 (실공고 11건 감지)
- [[기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내](https://sejong.korea.ac.kr/bbs/koreaSejong/659/273457/artclView.do)
  - ⏰ 신청 기간 : 2026년 11월 9일(월) 15시까지 ● 제출처 : 자유관 1층 학생생활지원팀 * 상기 자격증에 대한 1인당 장학금 지급액 규모
  - 📎 [2026학년도 2학기 세종 CPTA장학금 신청서(소정양식).hwp](https://sejong.korea.ac.kr/bbs/koreaSejong/659/183024/download.do)
- [[기금]2026년 2학기 KUPC장학금 공지](https://sejong.korea.ac.kr/bbs/koreaSejong/659/273456/artclView.do)
  - 📎 [KUPC 장학금 신청서(2026).hwp](https://sejong.korea.ac.kr/bbs/koreaSejong/659/183023/download.do)

### 서강대학교
상태: ✅ 정상 (실공고 25건 감지)

### 성균관대학교
상태: ✅ 정상 (실공고 10건 감지)

### 한양대학교
상태: ✅ 정상 (실공고 15건 감지)

### 중앙대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — CAU Notice의 장학 탭(P_TAB_NO=5), 485건. 행이 클릭형(fn_goDetail)이라 browser-targets.json이 담당한다)

### 서울시립대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 건국대학교
상태: ✅ 정상 (실공고 23건 감지)
- [[교외][생활비] 2027학년도 아산사회복지재단 의생명과학분야 대학 장학생 선발 안내(10. 6. ~ 10. 26.)](https://www.konkuk.ac.kr/bbs/konkuk/235/1209343/artclView.do)
  - 📎 [별첨1 _2027년 의생명과학분야 대학 장학생 선발안내.pdf](https://www.konkuk.ac.kr/bbs/konkuk/235/1228154/download.do)
  - 📎 [별첨2 _2027년 의생명과학분야 대학 장학생 선발안내 포스터.pdf](https://www.konkuk.ac.kr/bbs/konkuk/235/1228155/download.do)
- [[교외[생활비] 2027학년도 아산사회복지재단 북한이탈청소년 장학생 선발 안내(10. 6. ~ 10. 26.)](https://www.konkuk.ac.kr/bbs/konkuk/235/1209342/artclView.do)
  - 📎 [별첨1_ 2027년 아산북한이탈청소년장학생 선발안내.pdf](https://www.konkuk.ac.kr/bbs/konkuk/235/1228152/download.do)
  - 📎 [별첨2_ 2027년 북한이탈청소년 장학생 선발 안내 포스터.pdf](https://www.konkuk.ac.kr/bbs/konkuk/235/1228153/download.do)
- [[교외][생활비] 2026학년도 우양재단 동행 장학생 모집(~ 10. 18.)](https://www.konkuk.ac.kr/bbs/konkuk/235/1209336/artclView.do)
  - 📎 [[붙임2] 2026년 우양재단 동행장학 신청서 서식.hwp](https://www.konkuk.ac.kr/bbs/konkuk/235/1228146/download.do)
  - 📎 [[붙임1] 2026년 동행장학 홍보 포스터.jpg](https://www.konkuk.ac.kr/bbs/konkuk/235/1228147/download.do)

### 동국대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 동국대학교 WISE캠퍼스
상태: ✅ 정상 (실공고 4건 감지)

### 홍익대학교
상태: ✅ 정상 (실공고 7건 감지)

### 숙명여자대학교
상태: ✅ 정상 (실공고 9건 감지)

### 광운대학교
상태: ✅ 정상 (실공고 7건 감지)

### 명지대학교
상태: ✅ 정상 (실공고 10건 감지)

### 상명대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 가천대학교
상태: ✅ 정상 (실공고 146건 감지)

### 아주대학교
상태: ✅ 정상 (실공고 11건 감지)
- [[근로장학] 10월 출근부 입력 마감일 및 장학금 지급 예정일 안내](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=view&articleNo=377176&article.offset=0&articleLimit=10)
- [[학자금대출] 2026-2 구제등록 기간 한국장학재단 학자금대출 신청 및 실행 안내(학부생)](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=view&articleNo=377120&article.offset=0&articleLimit=10)
  - 📎 [2026년_2학기_학자금대출_모바일 신청매뉴얼.pdf](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=file-download&articleNo=377120&attachNo=334686)
  - 📎 [2026년_2학기_학자금대출_모바일_실행매뉴얼.pdf](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=file-download&articleNo=377120&attachNo=334687)
  - 📎 [2026년_2학기_학자금대출_홈페이지_신청매뉴얼.pdf](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=file-download&articleNo=377120&attachNo=334688)
  - 📎 [2026년_2학기_학자금대출_홈페이지_실행매뉴얼.pdf](https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=file-download&articleNo=377120&attachNo=334689)

### 국민대학교
상태: ✅ 정상 (실공고 18건 감지)

### 숭실대학교
상태: ✅ 정상 (실공고 14건 감지)

### 세종대학교
상태: ✅ 정상 (실공고 10건 감지)

### 이화여자대학교
상태: ✅ 정상 (실공고 10건 감지)
- [[대학원] 2026학년도 2학기 일반대학원 ‘우수연구 장학금’ 신청 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367276&article.offset=0&articleLimit=10)
  - ⏰ 신청기간 2026.10.19 ~ 2026.10.23 조회 28 2026 학년도 2 학기 일반대학원 ‘ 우수연구 장학금 ’ 신청 안내 본교 대학원

### 인하대학교
상태: ✅ 정상 (실공고 45건 감지)

### 부산대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — onestop.pusan.ac.kr 장학 공지 511건. 목록을 자바스크립트가 그리고 행이 href="#popup"이라 browser-targets.json이 담당한다)

### 가톨릭대학교
상태: ✅ 정상 (실공고 9건 감지)

### 한국항공대학교
상태: ✅ 정상 (실공고 54건 감지)

### 경기대학교
상태: ✅ 정상 (실공고 9건 감지)
- [[입학에서 취업까지] [아산사회복지재단] 2027년도 북한이탈청소년 장학생 선발 안내 ( ~ 2026.10.26.(월))](https://www.kyonggi.ac.kr/www/selectBbsNttView.do?key=7520&bbsNo=1073&nttNo=626468&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888)

### 서울과학기술대학교
상태: ✅ 정상 (실공고 58건 감지)
- [(홍보) 대산농촌재단 2027년도 장학생 선발 안내(~11/11(수)까지)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896321&qidx=5233&cate=0&allboard=true&nowpage=1)
  - 📎 [[붙임2] 2027 대산장학생 선발요강.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=D8AE50AB6B284AE4B891AD89B83B87D8_.pdf&ogrfname=%5B%EB%B6%99%EC%9E%842%5D+2027+%EB%8C%80%EC%82%B0%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EC%9A%94%EA%B0%95.pdf)
- [(홍보) 우양재단 2026년 동행 장학생 모집 안내(~10/18(일)까지)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896304&qidx=5233&cate=0&allboard=true&nowpage=1)
  - 📎 [[붙임2] 2026년 우양재단 동행장학 신청서 서식.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=E764D798BAEE4F02B94B0EBE26DB2962_.hwp&ogrfname=%5B%EB%B6%99%EC%9E%842%5D+2026%EB%85%84+%EC%9A%B0%EC%96%91%EC%9E%AC%EB%8B%A8+%EB%8F%99%ED%96%89%EC%9E%A5%ED%95%99+%EC%8B%A0%EC%B2%AD%EC%84%9C+%EC%84%9C%EC%8B%9D.hwp)
- [(홍보) [아산사회복지재단] 2027년도 북한이탈청소년·의생명과학분야 대학 장학생 선발 안내(~10/26(월)까지)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896300&qidx=5233&cate=0&allboard=true&nowpage=1)
  - ⏰ 접수 기간 : 2026년 10월 6일(화) ~ 10월 26일(월) 23시 59분 - 접수 방법: 아산재단 지원신청 서비스( https://wel
  - 📎 [별첨2_ 2027년 북한이탈청소년 장학생 선발 안내 포스터.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=C4A13A68B1C248829FC2DAB4D8C19C68_.pdf&ogrfname=%EB%B3%84%EC%B2%A82_+2027%EB%85%84+%EB%B6%81%ED%95%9C%EC%9D%B4%ED%83%88%EC%B2%AD%EC%86%8C%EB%85%84+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C+%EC%95%88%EB%82%B4+%ED%8F%AC%EC%8A%A4%ED%84%B0.pdf)
  - 📎 [별첨1_ 2027년 아산북한이탈청소년장학생 선발안내.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=12EBE86420444835B887502D8C0529F0_.pdf&ogrfname=%EB%B3%84%EC%B2%A81_+2027%EB%85%84+%EC%95%84%EC%82%B0%EB%B6%81%ED%95%9C%EC%9D%B4%ED%83%88%EC%B2%AD%EC%86%8C%EB%85%84%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EC%95%88%EB%82%B4.pdf)
  - 📎 [별첨2 _2027년 의생명과학분야 대학 장학생 선발안내 포스터.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=214D9BD4E77E4412AB90FD293963E6E5_.pdf&ogrfname=%EB%B3%84%EC%B2%A82+_2027%EB%85%84+%EC%9D%98%EC%83%9D%EB%AA%85%EA%B3%BC%ED%95%99%EB%B6%84%EC%95%BC+%EB%8C%80%ED%95%99+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EC%95%88%EB%82%B4+%ED%8F%AC%EC%8A%A4%ED%84%B0.pdf)
  - 📎 [별첨1 _2027년 의생명과학분야 대학 장학생 선발안내.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=CAEDB37F3CDC4FC7AFDABA5D54F57A01_.pdf&ogrfname=%EB%B3%84%EC%B2%A81+_2027%EB%85%84+%EC%9D%98%EC%83%9D%EB%AA%85%EA%B3%BC%ED%95%99%EB%B6%84%EC%95%BC+%EB%8C%80%ED%95%99+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EC%95%88%EB%82%B4.pdf)
- [(홍보) 2026년도 (재)포항시장학회 장학생 선발 안내(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=5233&bidx=895250&qidx=5233&cate=0&allboard=true&nowpage=2)
  - ⏰ 신청기간 연장) 대전청년내일재단 2026년 하반기 인재육성장학생 선발 안내(~10/8(목)까지) (홍보) 2026년 상반기분 통영시 대학생 학자
- [[장애학생지원센터] 2026학년도 2학기 장애학생 봉사유형 국가근로장학생 모집 (마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=57138&bidx=895170&qidx=57138&cate=0&allboard=true&nowpage=2)
  - ⏰ 모집기간: ~2026. 9. 11.(금) 16:00까지 ※지원자가 많을 시 조기 마감될 수 있음 ※지원서 제출 후 1차 선발예정자에 한하여 개별
  - 📎 [국가근로장학생 지원서.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=C342D767C44145AE96E308816FECB617_.hwp&ogrfname=%EA%B5%AD%EA%B0%80%EA%B7%BC%EB%A1%9C%EC%9E%A5%ED%95%99%EC%83%9D+%EC%A7%80%EC%9B%90%EC%84%9C.hwp)
- [(홍보) 2026년 상반기분 통영시 대학생 학자금 이자 지원 신청안내(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=5233&bidx=894876&qidx=5233&cate=0&allboard=true&nowpage=2)
  - ⏰ 신청기간: 2026. 9. 2.(수) ~ 9. 23.(수) 17:00 2) 신청장소: 통영시 평생교육과 교육지원팀 3) 신청방법: 방문, 등기우
  - 📎 [2026년 상반기분 통영시 대학생 학자금 이자 지원 공고(안).hwpx](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=A51D9A6A81BC49E09CF55C4964A690D1_.hwpx&ogrfname=2026%EB%85%84+%EC%83%81%EB%B0%98%EA%B8%B0%EB%B6%84+%ED%86%B5%EC%98%81%EC%8B%9C+%EB%8C%80%ED%95%99%EC%83%9D+%ED%95%99%EC%9E%90%EA%B8%88+%EC%9D%B4%EC%9E%90+%EC%A7%80%EC%9B%90+%EA%B3%B5%EA%B3%A0%28%EC%95%88%29.hwpx)
- [(홍보) 2026년도 하반기 (재)달서인재육성장학재단 장학생 선발 공고(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=3&bnum=5233&bidx=894350&qidx=5233&cate=0&allboard=true&nowpage=3)
  - 📎 [2026년도 하반기 장학생 선발 신청서식.hwpx](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=F71C7FABDAE1421598128E35F19D94CF_.hwpx&ogrfname=2026%EB%85%84%EB%8F%84+%ED%95%98%EB%B0%98%EA%B8%B0+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C+%EC%8B%A0%EC%B2%AD%EC%84%9C%EC%8B%9D.hwpx)
  - 📎 [2026년도 하반기 장학생 선발계획 공고문.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=99D7FC974DE7476C93940C7C2361B6EE_.pdf&ogrfname=2026%EB%85%84%EB%8F%84+%ED%95%98%EB%B0%98%EA%B8%B0+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EA%B3%84%ED%9A%8D+%EA%B3%B5%EA%B3%A0%EB%AC%B8.pdf)
- [(공동실험실습관)26학년도 2학기 국가근로장학생 모집(지원마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=3&bnum=57138&bidx=894270&qidx=57138&cate=0&allboard=true&nowpage=3)
  - ⏰ 모집기간: 2026. 8. 24.(월) 09:00 ~ 15:00 까지 *제출서류 검토 후 적합자 개별 연락 유선 면접 실시 예정 / 선발 완료시
  - 📎 [서식3. 근무가능시간표.xlsx](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=EF70BB03CCC3445BA1DE05EE33EF6690_.xlsx&ogrfname=%EC%84%9C%EC%8B%9D3.+%EA%B7%BC%EB%AC%B4%EA%B0%80%EB%8A%A5%EC%8B%9C%EA%B0%84%ED%91%9C.xlsx)
  - 📎 [서식1. 국가근로장학생 지원서.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=96DA1EF3BBE549E885DA41ABABBD688E_.hwp&ogrfname=%EC%84%9C%EC%8B%9D1.+%EA%B5%AD%EA%B0%80%EA%B7%BC%EB%A1%9C%EC%9E%A5%ED%95%99%EC%83%9D+%EC%A7%80%EC%9B%90%EC%84%9C.hwp)
  - 📎 [서식2. 근로학생 자기소개서.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=8B419A2143C04818941454206746F5CD_.hwp&ogrfname=%EC%84%9C%EC%8B%9D2.+%EA%B7%BC%EB%A1%9C%ED%95%99%EC%83%9D+%EC%9E%90%EA%B8%B0%EC%86%8C%EA%B0%9C%EC%84%9C.hwp)

### 계명대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — kmu.ac.kr 장학 공고 23건 보임. 상세 링크가 HTML에 없어 browser-targets.json이 담당한다)

### 서울교육대학교
상태: ✅ 정상 (실공고 14건 감지)

### 한국방송통신대학교
상태: ✅ 정상 (실공고 30건 감지)

### 경북대학교
상태: ✅ 정상 (실공고 5건 감지)

### 영남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 전북대학교
상태: ✅ 정상 (실공고 10건 감지)

### 충남대학교
상태: ✅ 정상 (실공고 7건 감지)
- [2026년도 2학기 중소기업 취업연계 장학사업(희망사다리 1유형) 신규장학생 추천자 선발 수정 공고](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515636&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=)
  - 📎 [대학(원)별 훈련일정](https://plus.cnu.ac.kr/Upl/kr/20200818_2.hwp)
  - 📎 [마이크로디그리과정](https://plus.cnu.ac.kr/html/kr/26file/2026_di_2010.pdf)
  - 📎 [(붙임1) 26-2학기 희망사다리(1유형) 신규장학생 추천자 선발계획(안).hwp](https://plus.cnu.ac.kr/_prog/_board/common/download.php?code=sub07_0713&ntt_no=2515636&atch_no=1)
  - 📎 [학교홈페이지관리규정](https://plus.cnu.ac.kr/Upl/kr/2025_homepage_3020.hwp)

### 전남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 조선대학교
상태: ✅ 정상 (실공고 45건 감지)

### 충북대학교
상태: ✅ 정상 (실공고 7건 감지)
- [(재)아산사회복지재단 2026년 의생명과학분야 장학생 선발 안내](https://www.cbnu.ac.kr/www/selectBbsNttView.do?key=815&bbsNo=8&nttNo=170504&pageUnit=10&searchCtgry=%ed%95%99%ec%82%ac%2f%ec%9e%a5%ed%95%99&searchCnd=all&pageIndex=1)
  - ⏰ 접수기간: ~ 2026. 10. 26.(월) 23시 59분까지 마. 접수방법: 온라인 접수( https://welfare.asanfoundati
- [대산농촌재단 2027년도 대산농촌재단 장학생 선발 안내](https://www.cbnu.ac.kr/www/selectBbsNttView.do?key=815&bbsNo=8&nttNo=170503&pageUnit=10&searchCtgry=%ed%95%99%ec%82%ac%2f%ec%9e%a5%ed%95%99&searchCnd=all&pageIndex=1)
  - ⏰ 모집기한: ~ 2026. 11. 11.(수)까지 5. 선발일정: (1단계) 서류심사 (2단계) 면접심사 6. 신청방법: 이메일 신청(dsa@ds

### 부경대학교
상태: ✅ 정상 (실공고 17건 감지)

### 강원대학교
상태: ✅ 정상 (실공고 11건 감지)

### 🎯 대외활동·공모전 새 글 11건 → 앱 '대외활동' 탭 (data/activities.json · 200건 게재 중)
- **성균관대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[성균관대학교]2026 청년도약 인재양성 부트캠프 교육생 모집 안내](https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140417&article.offset=0&articleLimit=10)
- **광운대학교 (장학 게시판에서 발견)** — ✅
  - [공모전] [[일반] 2026 「신한 스퀘어브릿지」 대학생 창업 공모전 HERO IR](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53446&tpage=1&searchKey=1&searchVal=&srCategoryId=) — ⏰ 모집기간: 2026. 10. 1.(목) ~ 11. 2.(월) 23:59까지 * 지원대상: 만 34세 이하 대학(원)생 개인 또는 팀 * 신청방법
  - [대외활동] [[국제교류] 2026 프랑스 교육박람회 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53445&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - [대외활동] [[일반] [HUSS-글로벌공생] 2026 공공기관 ESG 경영 현장 탐방 학생 모집(한국무역보험공사)](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53441&tpage=1&searchKey=1&searchVal=&srCategoryId=) — ⏰ 모집 기간 : 2026.10.06.(화) ~ 2026.10.23(금) 모집 인원 : 20명(선착순 마감) 모집 대상 : 글로벌 공생 HUSS사업
  - [공모전] [[외부] [기후에너지환경부] 제13회 대학생 물환경 정책·기술 공모전](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53442&tpage=1&searchKey=1&searchVal=&srCategoryId=) — ⏰ 접수기간 : 2026. 9. 28.( 월 )~ 10. 25.( 일 ) 마 . 공모분야 : 수질 · 오염원 관리 , 스마트물관리 , 기후위기 대응
- **한국외국어대학교 대외활동·공모전 「학생활동」** — ✅ 정상 (활동·공모전 9건 감지)
  - [공모전] [[소상공인시장진흥공단] 전통시장 AI 홍보영상 콘텐츠 공모전](https://dep.hufs.ac.kr/bbs/student/2436/268648/artclView.do)
- **한국외국어대학교 대외활동·공모전 「진로·취업」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「취업/경력」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「사회진출 프로그램 공지」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **정부24 공모전 대외활동·공모전** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **온통청년 청년참여 프로그램 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울시 청년몽땅정보통 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **창업진흥원 K-Startup 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
  - [대외활동] [스타트업 원스톱 지원센터 아카데미 일정 안내(10월)](https://www.k-startup.go.kr/web/contents/webNOTICE_MATR.do?page=1&viewCount=18&id=176443&schBdcode=&schGroupCode=&schM=view)
  - [대외활동] [2026 대전로컬창업포럼 참가자 모집](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179436) — ⏰ 접수기간 2026-10-05 ~ 2026-10-09 16:00 주관기관명 온랩 대상 대학생, 일반인, 대학, 연구기관, 1인 창조기업 창업업력
  - [대외활동] [ANTLER | 2026 앤틀러 글로벌 리쿠르팅데이 참가자 모집(10.24.)](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179423) — ⏰ 접수기간 2026-10-03 ~ 2026-10-24 10:00 주관기관명 앤틀러코리아 대상 전체 창업업력 전체 연락처 070-8648-2203
- **대한민국 정책브리핑 이벤트·공모 대외활동·공모전** — ✅ 정상 (활동·공모전 23건 감지)
- **경기청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **KOICA 봉사단 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **국립국제교육원 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **한국콘텐츠진흥원 대외활동·공모전** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **문화포털 문화지원사업 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울문화포털 공모소식 대외활동·공모전** — ✅ 정상 (활동·공모전 11건 감지)
- **부산청년플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **인천유스톡톡 청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 7건 감지)
- **대전청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 7건 감지)
  - [대외활동] [[한남대학교] 2026 청년도약 인재양성 AX 디자인팩토리 부트캠프 교육생 모집 2026.10 . 6](https://www.daejeonyouthportal.kr/board/BBSMSTR_000000000251/articleView.do?searchSeq=17034&commonMenuNo=180_35) — ⏰ 신청기간 상시 진행일정 2026-11-07~2027.02.19 장소 한남대학교 대상 구직 담당기관 교육부, 한국산업기술진흥원, 한남대학교 바로가
- **울산청년정책플랫폼 U-PAGE 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **광주청년통합플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경남청년정보플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
  - [대외활동] [“청년의 꿈을 잇고, 경남의 미래를 열다” 경남 청년 꿈 아카데미 센터 개소](https://youth.gyeongnam.go.kr/youth/board.es?mid=a10501020000&bid=0006&list_no=6911&act=view)
- **청년재단 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)

### 🏛 재단·지자체 새 공고 0건 → 홈 '재단·지자체 새 공고' (data/external.json · 54건 게재 중 · 게시판 아는 곳 20/77)
- **재단법인 김해시미래인재장학재단** — ⚠️ 오류 (TimeoutError: 23) — 주소 확인 필요
- **재단법인 상주시장학회** — ✅ 정상 (장학 공고 3건 감지)
- **재단법인 삼원장학재단** — ✅ 정상 (장학 공고 24건 감지)
- **한진해운장학재단** — ✅ 정상 (장학 공고 5건 감지)
- **(재)송파구 인재육성 장학재단** — ✅ 정상 (장학 공고 16건 감지)
- **파안장학문화재단법인** — ✅ 정상 (장학 공고 25건 감지)
- **메디힐장학재단** — ✅ 정상 (장학 공고 9건 감지)
- **(재)고속도로장학재단** — ✅ 정상 (장학 공고 4건 감지)
- **아산시미래장학회** — ✅ 정상 (장학 공고 10건 감지)
- **관정이종환교육재단** — ✅ 정상 (장학 공고 27건 감지)
- **두산연강재단** — ✅ 정상 (장학 공고 5건 감지)
- **미래에셋박현주재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **아산사회복지재단** — ✅ 정상 (장학 공고 10건 감지)
- **한국고등교육재단** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **한국장학재단 공지** — ✅ 정상 (장학 공고 15건 감지)
- **국립국제교육원 공지** — ✅ 정상 (장학 공고 3건 감지)
- **롯데장학재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **일주학술문화재단** — ✅ 정상 (장학 공고 5건 감지)
- **영동군민장학회** — ✅ 정상 (장학 공고 8건 감지)
- **(재)음성군장학회** — ✅ 정상 (장학 공고 6건 감지)

### 📄 목록 2페이지 이후에서 더 읽은 게시판
1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.
- 재단법인 삼원장학재단: 2페이지 더 읽어 17행 추가
- (재)송파구 인재육성 장학재단: 2페이지 더 읽어 24행 추가
- 관정이종환교육재단: 2페이지 더 읽어 17행 추가
- 아산사회복지재단: 2페이지 더 읽어 50행 추가
- 한국외국어대학교: 2페이지 더 읽어 84행 추가
- 연세대학교: 2페이지 더 읽어 22행 추가
- 연세대학교 미래캠퍼스: 2페이지 더 읽어 32행 추가
- 가천대학교: 2페이지 더 읽어 417행 추가
- 인하대학교: 2페이지 더 읽어 42행 추가
- 한국항공대학교: 2페이지 더 읽어 196행 추가
- 서울과학기술대학교: 2페이지 더 읽어 182행 추가
- 한국방송통신대학교: 2페이지 더 읽어 30행 추가
- 조선대학교: 2페이지 더 읽어 36행 추가
- 한국외국어대학교 대외활동·공모전 「학생활동」: 2페이지 더 읽어 69행 추가
- 서울문화포털 공모소식 대외활동·공모전: 2페이지 더 읽어 60행 추가

📄 페이지 넘기기가 안 되는 게시판 74곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`
**🧩 양식 원본 자동 확보 예약 1건** — 원본은 이 실행에서 바로 내려받고, 같은 실행의 무료 변환기가 앱 양식으로 옮겨요(못 옮긴 것은 리포트 '보류'에 남아요).

**⏳ 스키마화 대기 중 91건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 2건 등록

자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.

- `auto-jong659273457artclviewdo` [[기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내](https://sejong.korea.ac.kr/bbs/koreaSejong/659/273457/artclView.do) · 고려대학교 세종캠퍼스
- `auto-15nttno170504searchctgry` [(재)아산사회복지재단 2026년 의생명과학분야 장학생 선발 안내](https://www.cbnu.ac.kr/www/selectBbsNttView.do?key=815&bbsNo=8&nttNo=170504&pageUnit=10&searchCtgry=%ed%95%99%ec%82%ac%2f%ec%9e%a5%ed%95%99&searchCnd=all&pageIndex=1) · 마감 2026-10-26 · 

**전국으로 승격 1건** — 다른 학교 게시판에 같은 사업이 올라와 한 학교 한정을 풀었어요(합치는 규칙은 관리자 합침과 같아요 · 근거는 항목의 scopeFrom).
- `auto-15nttno170504searchctgry` (재)아산사회복지재단 2026년 의생명과학분야 장학생 선발 안내 ← 서강대학교 게시판 [[교외] 아산사회복지재단 의생명과학분야 장학생 선발 안내(10/26 마감](https://www.sogang.ac.kr/ko/detail/551534?bbsConfigFk=141&namepage=ScholarshipNotice)

**컨펌 대기 (자동 기준 미달 158건)** — 장학 신호는 있지만 선발·모집 신호가 약해요:
- [기금]2026년 2학기 KUPC장학금 공지 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- [교외][생활비] 2027학년도 아산사회복지재단 의생명과학분야 대학 장학생 선발 안내(10. 6. ~ 10. (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- [교외[생활비] 2027학년도 아산사회복지재단 북한이탈청소년 장학생 선발 안내(10. 6. ~ 10. 26. (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- [교외][생활비] 2026학년도 우양재단 동행 장학생 모집(~ 10. 18.) (타교 등록분과 동일 사업([학부-교외장학] 2026학년도 우양재단 동) — 접수분 여부 컨펌 대기)
- [입학에서 취업까지] [아산사회복지재단] 2027년도 북한이탈청소년 장학생 선발 안내 ( ~ 2026.10. (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- (홍보) 대산농촌재단 2027년도 장학생 선발 안내(~11/11(수)까지) (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- (홍보) 우양재단 2026년 동행 장학생 모집 안내(~10/18(일)까지) (타교 등록분과 동일 사업([우양재단] 2026년 동행 장학생 모집 () — 접수분 여부 컨펌 대기)
- (홍보) [아산사회복지재단] 2027년도 북한이탈청소년·의생명과학분야 대학 장학생 선발 안내(~10/26(월 (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- 대산농촌재단 2027년도 대산농촌재단 장학생 선발 안내 (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- 아산사회복지재단 2027년 의생명과학분야 대학 장학생 선발 공고 (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)

**거른 공고 361건 — 이유별**

- 이미 등록(원문 동일) · 102건
- 이미 등록(동일 사업) · 53건
- 이미 전국(동일 사업) · 52건
- 마감 경과 · 21건
- 이미 등록(같은 id) · 21건
- 행정 안내(신청 공고 아님) · 15건
- 사람이 막아 둔 공고(blockIds/blockUrls) · 15건
- 학자금 대출·융자(장학금 아님) · 13건
- '장학' 신호 없음 · 13건
- 이미 등록(동일 사업)논산시장학회 ) · 13건
- 이미 등록(동일 사업)포항시장학회) · 11건
- 행사·연수·설명회(신청형 장학 아님) · 10건
- 국가장학금 상시 제도 — 앱 내 카드로 이미 안내 · 7건
- 이미 등록(동일 사업)춘천인재육성장학) · 4건
- 학부생 대상 아님(대학원 등) · 3건
- 이미 등록(동일 사업)대전청년내) · 2건
- 이미 등록(동일 사업)) · 2건
- 이미 등록(동일 사업) ) · 1건
- 이미 등록(동일 사업)경주시장학회 장학생 선) · 1건
- 이미 등록(동일 사업)인천인재평생교육진흥원) · 1건
- 이미 등록(동일 사업) 김해시미래인재장학재단 2026 ) · 1건


### 🚨 양식 원본을 못 받고 있는 공고 16건 (3회 이상 시도)

자동으로는 더 못 가져옵니다. 첨부 주소가 바뀌었거나 로그인이 필요한 경우예요.
이 공고들은 앱에서 양식 작성이 안 되고 원본 다운로드 안내만 나갑니다.

- ★[국가근로] 2026-1학기 국가근로장학생 선발자 관련 안내 — 6회 실패 (마지막 시도 2026-08-05) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 의암 손병희 우수논문 장학생 (건국대, 2026) — 6회 실패 (마지막 시도 2026-08-05) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 성적향상 장학금 신청 (가천대, 2026-1학기) — 6회 실패 (마지막 시도 2026-08-05) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 성적향상장학금 신청 (세종대, 2026-1학기) — 6회 실패 (마지막 시도 2026-08-05) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 동문장학금 신청 (가톨릭대, 2026-2학기) — 6회 실패 (마지막 시도 2026-08-05) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- [교내] 2026-2학기 장애대학생 지원 도우미 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-08-17) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 제36기 미레에셋 해외교환 장학생 선발 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 서울 (재) 김해시미래인재장학재단 2026 장학생 선발 공고 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 2026년 하반기 문주장학재단 AI·ICT 분야 인재 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 [공통] 2026학년도 2학기 반영장학 신청 안내 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 [공통] 2026학년도 2학기 점프장학 신청 안내_09.22(화)~10.9(금) — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 2026년도 하반기 (재)논산시장학회 학업장려 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-09-30) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요

### 🧩 양식 스키마화 — 무료 자동 0건 · API 0건 · 보류 76건

**보류 76건** — 자동 변환기가 원본과 같은 문서를 장담하지 못한 것들이에요. 원본 다운로드 안내는 그대로 유지됩니다.

- 2026-2학기 남가주동문회 장학금 신청공고.hwp (남가주동문장학회 장학생 선발) · 자동 변환 보류: 공고문·안내문 파일(채울 칸이 있는 서식 아님)
- (서식) 개인정보수집이용동의서.hwp (남가주동문장학회 장학생 선발) · 원본에 있는 항목이 빠짐 — 주소·연락처·이메일·평점·소득분위. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 장학생 협조사항 안내.pdf (미래의동반자재단 장학생 선발 (주한미국상공회의소)) · 자동 변환 보류: 옮길 항목을 찾지 못함
- 미래의동반자재단 장학금 신청서(학생용) 2026-2 골드만삭스.docx, 미래의동반자재단 장학금 신청서(학생용) 2026-2.docx (미래의동반자재단 장학생 선발 (주한미국상공회의소)) · 무료 변환이 원본 표를 옮기지 못함 — 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 외 1건. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 바로바로론 사랑나눔 장학생 모집 공고.docx (공통 2026년 상반기 사랑나눔장학생 모집 공고) · 자동 변환 보류: 공고문·안내문 파일(채울 칸이 있는 서식 아님)
- 장학생 자기소개서.docx (공통 2026년 상반기 사랑나눔장학생 모집 공고) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 뽑힌 글자가 너무 적음 — 항목이 빠졌을 수 있음
- 개인정보 수집·이용·제공·조회 동의서.docx (공통 2026년 상반기 사랑나눔장학생 모집 공고) · 무료 변환이 원본 표를 옮기지 못함 — "목적 및 항목" — 공고문 본문 제목이 질문이 됨. 원본 첨부 안내를 유지합니다(API 경로 대상)
- [다우기술]장학생 신청서 및 자기소개서 (4).hwp, (서식) 개인정보수집이용동의서.hwp ([글로벌][교외] 2026-2학기 다우기술 SW장학생 모집안내 () · 무료 변환이 원본 표를 옮기지 못함 — "성적증명서 1부" — 제출서류 목록의 한 줄이 질문이 됨. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 장학금 신청 주요 일정 ([재난안전관리본부] 2026학년도 2학기 근로장학생(국가,교내) ) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 원본에서 글자를 읽지 못함 — 원본을 직접 봐야 함
- 장학금 규정 전문(2021. 10. 1.) ([재난안전관리본부] 2026학년도 2학기 근로장학생(국가,교내) ) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 원본에서 글자를 읽지 못함 — 원본을 직접 봐야 함
- 2026-2학기 라성 정형기재단 장학금 신청서.hwp ([글로벌][교외][일시지원] 2026-2학기 라성정형기 재단 장학) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 뽑힌 글자가 너무 적음 — 항목이 빠졌을 수 있음
- (서식) 개인정보수집이용동의서.hwp ([글로벌][교외][일시지원] 2026-2학기 라성정형기 재단 장학) · 원본에 있는 항목이 빠짐 — 주소·연락처·이메일·평점·소득분위. 원본 첨부 안내를 유지합니다(API 경로 대상)

**건너뜀 70건**

- 2026년 서울사회복지공동모금회 상반기 바로바로론 사랑나눔장학생 모집 안내 — registered.json에 항목 없음
- [글로벌] 긴급-등록금전액)2026-2학기 (재)봉은재단 장학생 추가선발 안내(화공생명,  — registered.json에 항목 없음
- 불가리아 정부초청 장학생 (건국대, 2026-2027) — registered.json에 항목 없음
- 새문안교회 장학생 (숭실대, 2026-2학기) — registered.json에 항목 없음
- 장학 2026년 서울미래인재재단 서울인재대학장학금 선발 안내(1학년 대상, 8.3.월 10 — registered.json에 항목 없음
- 2026-2 교내장학금 신청 안내(신/편입생, 재학생) — registered.json에 항목 없음
- [장학금 접수] 2026학년도 국가우수장학금(이공계) 신규장학생 선발 공고 — registered.json에 항목 없음
- 2026학년도 (재)운해장학재단 장학생 신청 안내 — registered.json에 항목 없음
- 2016학년도 (재)동원학술연구재단‘내 자서전 미리 쓰고 받는’섬김의 리더십 장학생 선발  — registered.json에 항목 없음
- 2014-2학기 사랑드림장학사업(삼성) 장학금 신청 안내 — registered.json에 항목 없음
- 5.18 기념재단-5.18 희망장학생 모집 공고 — registered.json에 항목 없음
- [학생지원팀] 2026년도 산학협동재단 국내 외국인 근로자 자녀 장학생 선발 신청 안내 ( — registered.json에 항목 없음


### 🌐 범위 승격 (학교 한정 → 전국) — 0건
원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.
- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.
### 🏫 교내·교외 원문 판정 — 바뀐 것 0건 · 후보 3건 · 학교 제도 새로 배움 0건
판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.
- 뒤집힌 판정 없음
- 후보 교외 → 교내? `auto-oardid323225menuno200318` 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금 — 제목의 학교 이름표 「경희」 · 접수처 「포털 인포21」
- 후보 교외 → 교내? `auto-2445viewdocurrentpageno1` 2026학년도 국민대학교 교수회 제자사랑장학금 신청 안내 — 제목의 학교 이름표 「국민대학교」 · 접수처 「학생지원팀 신청」
- 후보 교외 → 교내? `auto-jong659273457artclviewdo` [기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내 — 제목의 학교 이름표 「고려대」