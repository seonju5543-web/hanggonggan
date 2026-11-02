## 🤖 장학공고 수집 리포트 (2026-11-02)

새로 발견한 공고: **11건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review
> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.
> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.

⏱ 게시판 89곳을 7분 13초에 다 돌았습니다(예산 8분).

🙋 연속 6회(약 이틀) 넘게 글이 안 들어오는 대외활동·재단 출처 13곳 — 대외활동은 관리자 「활동」 탭에서 보관하거나 주소를 고치고, 재단·지자체는 collector/external-sources.json 에서 고쳐 주세요: 한국외국어대학교 대외활동·공모전 「진로·취업」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 44회 연속) · 경희대학교 대외활동·공모전 「취업/경력」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 44회 연속) · 경희대학교 대외활동·공모전 「사회진출 프로그램 공지」(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 44회 연속) · 서울시 청년몽땅정보통 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 44회 연속) · KOICA 봉사단 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 44회 연속) · 서울문화포털 공모소식 대외활동·공모전(⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) · 36회 연속) · 광주청년통합플랫폼 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 43회 연속) · 경남청년정보플랫폼 대외활동·공모전(🟡 접속은 되지만 활동·공모전 글을 찾지 못함 · 22회 연속) · 재단법인 김해시미래인재장학재단(⚠️ 오류 (TimeoutError: 23) · 44회 연속) · 미래에셋박현주재단(⚠️ 접속 실패 (HTTP 503) · 44회 연속) · 롯데장학재단(🟡 접속은 되지만 장학 공고를 찾지 못함 · 44회 연속) · 일주학술문화재단(⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) · 26회 연속) · 재단법인 울산연구원(⛔ robots.txt 가 막아 둔 주소 · 37회 연속)

⚠️ 정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 539KB 를 받습니다(학교 46곳 · 전국분 265KB 은 모두가 받아야 합니다). 실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. 이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 (왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)

### 경희대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 한국외국어대학교
상태: ✅ 정상 (실공고 14건 감지)
- [[글로벌][교내] 2026-2학기 글로벌캠퍼스 HUFS Dream 장학금 신청 안내 (11](https://dep.hufs.ac.kr/bbs/student/2431/270591/artclView.do)
  - ⏰ 신청기간 : 2026. 11. 3.( 화 ) ~ 2026. 11. 27.( 금 ) 16:00 6. 신청방법 : 온라인 신청 (HUFS Abili
  - 📎 [2026학년도 2학기 HUFS Dream 장학금 신청서(공고용).hwp](https://dep.hufs.ac.kr/bbs/student/2431/152739/download.do)

### 서울대학교
상태: ✅ 정상 (실공고 24건 감지)

### 연세대학교
상태: ✅ 정상 (실공고 27건 감지)

### 연세대학교 미래캠퍼스
상태: ✅ 정상 (실공고 44건 감지)

### 고려대학교
상태: ⚙️ 게시판 주소 미설정 (개발자가 준 장학금공지 주소(korea.ac.kr/ko/568/subview.do)는 목록 행이 href="#1" + jf_view() 클릭 스크립트라 일반 fetch로는 링크가 하나도 안 나온다(2026-08-02 확인 — 옛 주소 scholarship.korea.ac.kr도 안내 홈페이지라 0건이었다). 동국대·경희대와 같은 클릭형이라 browser-targets.json으로 옮겼다)

### 고려대학교 세종캠퍼스
상태: ✅ 정상 (실공고 7건 감지)

### 서강대학교
상태: ✅ 정상 (실공고 24건 감지)

### 성균관대학교
상태: ✅ 정상 (실공고 9건 감지)

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
상태: ✅ 정상 (실공고 2건 감지)

### 홍익대학교
상태: ✅ 정상 (실공고 5건 감지)
- [[한국장학재단] 청년지원정보 통합제공 플랫폼 '통학로' 홍보](https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=view&articleNo=159936&article.offset=0&articleLimit=10&srCategoryId=24&srSearchKey=article_title&noCat=24)
  - ⏰ 제출 기간 변경 안내) 2026.10.21 2026년 동계 전공연계 <독일> 해외파견 프로그램 선발 안내 < 베를린 현지 대면수업 계절학기 >
  - 📎 [통학로 포스터.jpg](https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=download&articleNo=159936&attachNo=93742)
  - 📎 [통학로 카드(리플렛_PDF.pdf](https://www.hongik.ac.kr/kr/education/notice-undergrad.do?mode=download&articleNo=159936&attachNo=93743)
- [[전기공사공제조합장학회] 2027년도 제22기 장학생 선발공고](https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=159923&noCat=501)

### 숙명여자대학교
상태: ✅ 정상 (실공고 9건 감지)

### 광운대학교
상태: ✅ 정상 (실공고 7건 감지)
- [[등록/장학] 대한주택건설협회 서울특별시회 2026학년도 장학생 선발 안내(생활비성)](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53596&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - ⏰ 접수기간 : 2026 년 11 월 3 일 ( 화 ) ~ 6 일 ( 금 ) 17 시까지 나 . 제출장소 : 학생복지팀 ( 복지관 202 호 ) 5
  - 📎 [부설기관](https://www.kw.ac.kr/ko/department/attach01.jsp)
  - 📎 [연구지원팀](https://www.kw.ac.kr/ko/department/attach03.jsp)
  - 📎 [연구진흥팀](https://www.kw.ac.kr/ko/department/attach04.jsp)
  - 📎 [경영관리팀](https://www.kw.ac.kr/ko/department/attach02.jsp)
  - 📎 [기술지주회사](https://www.kw.ac.kr/ko/department/attach05.jsp)

### 명지대학교
상태: ✅ 정상 (실공고 9건 감지)

### 상명대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 가천대학교
상태: ✅ 정상 (실공고 145건 감지)

### 아주대학교
상태: ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 국민대학교
상태: ✅ 정상 (실공고 18건 감지)

### 숭실대학교
상태: ✅ 정상 (실공고 14건 감지)

### 세종대학교
상태: ✅ 정상 (실공고 9건 감지)

### 이화여자대학교
상태: ✅ 정상 (실공고 15건 감지)
- [[대학원] 2027-1학기 일반대학원 신입생 ‘최우수이화인 장학금’ 신청 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367754&article.offset=0&articleLimit=10)
  - ⏰ 신청기간: 2026. 11. 23.( 월 ) 09:00 ~ 11. 27.( 금 ) 13:00 4. 제출서류 제출서류 유의사항 제출형태 장학금 신
  - 📎 [[붙임]_타교_교원용_장학금_추천서_양식.hwp](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367754&attachNo=353780)
- [[장학] 2026년도 통영시 저소득 대학생 장학금 지원대상자 선발 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367738&article.offset=0&articleLimit=10)
  - ⏰ 신청기간: 2026. 11. 2.(월) ~ 11. 23.(월) - 신청방법: 방문 또는 우편접수(제출처: 통영시 평생교육과 평생학습팀) - 제출
  - 📎 [2026년 통영시 저소득 대학생 장학금 지원대상자 선발 공고.hwpx](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367738&attachNo=353769)

### 인하대학교
상태: ✅ 정상 (실공고 45건 감지)
- [[학부-교외장학] 2026학년도 (재)농와장인재육성장학재단 장학생 선발 안내](https://www.inha.ac.kr/bbs/kr/8/46019/artclView.do)
  - ⏰ 접수기한 : 26. 10. 29.(목) 09:00 ~ 26. 11. 10.(화) 18:00 (토·일·공휴일 제외) 8. 접수처 : 고창군청 1층
  - 📎 [(재)농와장인재육성장학재단_2026년장학생선발공고문.hwp](https://www.inha.ac.kr/bbs/kr/8/41690/download.do)

### 부산대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — onestop.pusan.ac.kr 장학 공지 511건. 목록을 자바스크립트가 그리고 행이 href="#popup"이라 browser-targets.json이 담당한다)

### 가톨릭대학교
상태: ✅ 정상 (실공고 6건 감지)

### 한국항공대학교
상태: ✅ 정상 (실공고 54건 감지)

### 경기대학교
상태: ✅ 정상 (실공고 7건 감지)

### 서울과학기술대학교
상태: ⚠️ 오류 (TypeError: UNABLE_TO_VERIFY_LEAF_SIGNATURE) — 주소 확인 필요

### 계명대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — kmu.ac.kr 장학 공고 23건 보임. 상세 링크가 HTML에 없어 browser-targets.json이 담당한다)

### 서울교육대학교
상태: ✅ 정상 (실공고 12건 감지)

### 한국방송통신대학교
상태: ✅ 정상 (실공고 30건 감지)

### 경북대학교
상태: ✅ 정상 (실공고 6건 감지)
- [2027학년도 해동과학문화재단 장학생 모집 기간 재연장 안내(~11..](https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxNzEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZjb2RlPU11NlN4bjZQMUlRYyZzZWFyY2hfaXRlbT0mc2VhcmNoX29yZGVyPSZvcmRlcl9saXN0PSZsaXN0X3NjYWxlPSZ2aWV3X2xldmVsPSZ2aWV3X2NhdGU9JnZpZXdfY2F0ZTI9JnNpdGVfY29kZT1rbnVzc3c=)
  - ⏰ 모집 기간 재연장 안내(~11. 3.(화) 오후2시까지) 2026-11-02 9 2027학년도 해동과학문화재단 장학생을 아래와 같이 모집하오니,
  - 📎 [2027 해동장학생 모집요강.pdf](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=0)
  - 📎 [2027 해동장학금 운영규정.pdf](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=1)
  - 📎 [2027 해동장학생 신규지원(ㅇㅇ대;;ㅇ학년;;이름).hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=2)
- [2026학년도 2학기 경북대학교총동창회 학업장려금 장학생 선발 ..](https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZjb2RlPU11NlN4bjZQMUlRYyZzZWFyY2hfaXRlbT0mc2VhcmNoX29yZGVyPSZvcmRlcl9saXN0PSZsaXN0X3NjYWxlPSZ2aWV3X2xldmVsPSZ2aWV3X2NhdGU9JnZpZXdfY2F0ZTI9JnNpdGVfY29kZT1rbnVzc3c=)
  - ⏰ 신청 기간: 2026. 11. 2.(월) ~ 11. 13.(금) 2. 지원 금액: 학업장려금 200만원 3. 지원 대상: 애교심이 투철한 경북대
  - 📎 [붙임1. 장학생 선발 모집요강.hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=0)
  - 📎 [붙임2. 학업장려장학금 안내 포스터.png](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=1)
  - 📎 [붙임3. 경북대학교총동창회_장학금 지원서.hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=2)
  - 📎 [붙임4. 경북대학교총동창회_자기소개서_및_학업발전 계획서.hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=3)
  - 📎 [붙임5. 경북대학교총동창회_개인정보활용 동의서.hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=4)

### 영남대학교
상태: ✅ 정상 (실공고 12건 감지)

### 전북대학교
상태: ✅ 정상 (실공고 9건 감지)
- [2026년 국가근로장학금 동계방학 집중근로 프로그램 희망근로지 신청 안내(10. 30.(금) 09:00 ~ 11. 12.(목) 18:00)](https://www.jbnu.ac.kr/web/Board/219326/detailView.do?category=6)
  - ⏰ 신청기간: 2026. 10. 30.(금) 09:00 ~ 11. 12.(목) 18:00까지 2. 신청자격 : 2026 학년도 2 학기 국가근로장학

### 충남대학교
상태: ✅ 정상 (실공고 7건 감지)

### 전남대학교
상태: ✅ 정상 (실공고 19건 감지)

### 조선대학교
상태: ✅ 정상 (실공고 55건 감지)

### 충북대학교
상태: ✅ 정상 (실공고 4건 감지)

### 부경대학교
상태: ✅ 정상 (실공고 17건 감지)

### 강원대학교
상태: ✅ 정상 (실공고 10건 감지)
- ['2026.2학기 주거안정장학금' 지급요청서(10월분) 제출 안내](https://kangwon.ac.kr/ko/bbs/750/detail.do?pstSn=2538&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0)
  - 📎 [(한국장학재단)장학생 지급요청서 작성 매뉴얼.pdf](https://kangwon.ac.kr/ko/cmmn/download.do?dn=20261102045029430.pdf&path=/bbs/34&fn=(%ED%95%9C%EA%B5%AD%EC%9E%A5%ED%95%99%EC%9E%AC%EB%8B%A8)%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%A7%80%EA%B8%89%EC%9A%94%EC%B2%AD%EC%84%9C%20%EC%9E%91%EC%84%B1%20%EB%A7%A4%EB%89%B4%EC%96%BC.pdf)
  - 📎 [[주거안정장학금 지급요청서]지원범위 및 기준.hwp](https://kangwon.ac.kr/ko/cmmn/download.do?dn=20261102050127521.hwp&path=/bbs/34&fn=[%EC%A3%BC%EA%B1%B0%EC%95%88%EC%A0%95%EC%9E%A5%ED%95%99%EA%B8%88%20%EC%A7%80%EA%B8%89%EC%9A%94%EC%B2%AD%EC%84%9C]%EC%A7%80%EC%9B%90%EB%B2%94%EC%9C%84%20%EB%B0%8F%20%EA%B8%B0%EC%A4%80.hwp)
  - 📎 [(학생) 포기 및 반환 매뉴얼.pdf](https://kangwon.ac.kr/ko/cmmn/download.do?dn=20261102050135023.pdf&path=/bbs/34&fn=(%ED%95%99%EC%83%9D)%20%ED%8F%AC%EA%B8%B0%20%EB%B0%8F%20%EB%B0%98%ED%99%98%20%EB%A7%A4%EB%89%B4%EC%96%BC.pdf)

### 🚨 연속 실패 — 게시판 주소 확인 필요
한 번은 일시 장애지만 3회 연속이면 주소가 바뀐 것입니다. 해당 학교 학생 화면에 새 공고가 안 들어옵니다.
- 한양대학교 (19회 연속) — 접속 실패 (HTTP 403) — 주소 수정 필요
- 아주대학교 (28회 연속) — 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 🎯 대외활동·공모전 새 글 8건 → 앱 '대외활동' 탭 (data/activities.json · 200건 게재 중)
- **대전청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 10건 감지)
- **울산청년정책플랫폼 U-PAGE 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **광주청년통합플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경남청년정보플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **청년재단 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **성균관대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[창업지원단/실험실창업혁신단] 2026 SKKU UNITE 프리 텍스코어(11/28~29) 참가자 모집(이비스 앰배서더 수원, 총상금 350만원)](https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=141498&article.offset=0&articleLimit=10) — ⏰ 신청기간: 2026.11.02.(월) ~ 2026.11.23.(월)까지 ■ 행사일정: 2026.11.28.(토) 11시 ~ 2026.11.29.
- **동국대학교 WISE캠퍼스 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[교외봉사] 경주시종합자원봉사센터 - 11월 봉사자 모집 관련 안내](https://wise.dongguk.ac.kr/article/servicenotice/detail/521049)
- **홍익대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[서울캠퍼스]2026년도 2학기 사회봉사활동 실적 등록 안내](https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=159899&noCat=501) — ⏰ 제출기한 : 2026. 11.2( 월 ) ~ 12.4( 금 ) 17 시까지 가 . 제출장소 : 각 학과 사무실 나 . 제출서류 1) 사회봉사활동
- **광운대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[일반] [Anchor사업 전문가 초청 특강] AI 시대를 움직이는 슈퍼컴퓨터의 세계 – 국가 슈퍼컴퓨터 '한강’](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53595&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - [공모전] [[일반] [HUSS-글로벌공생] 2026년 인문사회 융합인재양성사업(HUSS) 융합 교육과정 수기 공모전 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53593&tpage=1&searchKey=1&searchVal=&srCategoryId=)
- **전북대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [제27기 학생홍보대사 모집 안내](https://www.jbnu.ac.kr/web/Board/219309/detailView.do?category=6) — ⏰ 접수 기간 : 2026. 11. 16.(월) ~ 2026. 12. 2.(수) 14:00까지 ○ 서류심사 결과 발표 : 2026. 12. 7.(월
- **한국외국어대학교 대외활동·공모전 「학생활동」** — ✅ 정상 (활동·공모전 14건 감지)
- **한국외국어대학교 대외활동·공모전 「진로·취업」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「취업/경력」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「사회진출 프로그램 공지」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울시 청년몽땅정보통 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **창업진흥원 K-Startup 대외활동·공모전** — ✅ 정상 (활동·공모전 4건 감지)
  - [대외활동] [<2026년 AI 활용 온라인 플랫폼 제작 교육> 참여자 모집](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179680) — ⏰ 접수기간 2026-10-30 ~ 2026-11-18 10:00 주관기관명 충북대학교 충북Pro메이커센터 대상 전체 창업업력 전체 연락처 043-
  - [대외활동] [대학생 예비 창업가의 아이디어를 검증할 실전 무대, 2026 『신한 스퀘어브릿지』 HERO IR 참가자 모집(~11/2)](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179413) — ⏰ 접수기간 2026-10-01 ~ 2026-11-02 23:59 주관기관명 신한금융희망재단 대상 대학생 창업업력 예비창업자 연락처 032-710-
- **대한민국 정책브리핑 이벤트·공모 대외활동·공모전** — ✅ 정상 (활동·공모전 17건 감지)
- **경기청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **KOICA 봉사단 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **국립국제교육원 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **문화포털 문화지원사업 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울문화포털 공모소식 대외활동·공모전** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요
- **부산청년플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **인천유스톡톡 청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 5건 감지)

### 🏛 재단·지자체 새 공고 3건 → 홈 '재단·지자체 새 공고' (data/external.json · 61건 게재 중 · 게시판 아는 곳 25/80)
> 걸러 낸 글: 결과·행정 글 2건 (collector/external-clean.mjs)
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
- **(재)고속도로장학재단** — ✅ 정상 (장학 공고 4건 감지)
- **아산시미래장학회** — ✅ 정상 (장학 공고 9건 감지)
- **관정이종환교육재단** — ✅ 정상 (장학 공고 27건 감지)
- **두산연강재단** — ✅ 정상 (장학 공고 3건 감지)
- **미래에셋박현주재단** — ⚠️ 접속 실패 (HTTP 503) — 주소 수정 필요
- **아산사회복지재단** — ✅ 정상 (장학 공고 10건 감지)
- **한국장학재단 공지** — ✅ 정상 (장학 공고 15건 감지)
  - [2026년 복권기금 꿈사다리 우수 장학사업(SOS장학금) 신규장학생 최종 선발결과 안내](https://www.kosaf.go.kr/ko/notice.do?mode=view&searchStr=&searchType=&page=1&ctgrId1=&ctgrId2=&seqNo=21470)
  - [2026년 푸른등대 한국수력원자력 K-원전 장학금 신규장학생 선발 결과 및 장학금 지급 관련 안내](https://www.kosaf.go.kr/ko/notice.do?mode=view&searchStr=&searchType=&page=1&ctgrId1=&ctgrId2=&seqNo=21466)
- **국립국제교육원 공지** — ✅ 정상 (장학 공고 2건 감지)
- **롯데장학재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **일주학술문화재단** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요
- **백운장학회(광양)** — ✅ 정상 (장학 공고 4건 감지)
  - [2026년 하반기 대학생 생활비 장학금 지급 계획 공고 2026년 (재)백운장학회에서 시행하는 하반기 대학생 생활비 장학..](https://gwangyang.go.kr/fund/board.es?mid=a60401000000&bid=0156&list_no=310478&act=view)
- **재단법인 거창군장학회** — ✅ 정상 (장학 공고 10건 감지)
- **(재)진천군장학회** — ✅ 정상 (장학 공고 7건 감지)
- **대산농촌재단** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 📄 목록 2페이지 이후에서 더 읽은 게시판
1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.
- 재단법인 삼원장학재단: 2페이지 더 읽어 18행 추가
- (재)송파구 인재육성 장학재단: 2페이지 더 읽어 26행 추가
- 관정이종환교육재단: 2페이지 더 읽어 17행 추가
- 아산사회복지재단: 2페이지 더 읽어 50행 추가
- 서울대학교: 2페이지 더 읽어 118행 추가
- 연세대학교: 2페이지 더 읽어 22행 추가
- 연세대학교 미래캠퍼스: 2페이지 더 읽어 35행 추가
- 가천대학교: 2페이지 더 읽어 419행 추가
- 인하대학교: 2페이지 더 읽어 50행 추가
- 한국항공대학교: 2페이지 더 읽어 194행 추가
- 한국방송통신대학교: 2페이지 더 읽어 30행 추가
- 조선대학교: 2페이지 더 읽어 42행 추가
- 한국외국어대학교 대외활동·공모전 「학생활동」: 2페이지 더 읽어 70행 추가

📄 페이지 넘기기가 안 되는 게시판 77곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`
**🧩 양식 원본 자동 확보 예약 3건** — 원본은 이 실행에서 바로 내려받고, 같은 실행의 무료 변환기가 앱 양식으로 옮겨요(못 옮긴 것은 리포트 '보류'에 남아요).

**⏳ 스키마화 대기 중 79건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 4건 등록

자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.

- `auto-ent2431270591artclviewdo` [[글로벌][교내] 2026-2학기 글로벌캠퍼스 HUFS Dream 장학금 신청 안내 (11](https://dep.hufs.ac.kr/bbs/student/2431/270591/artclView.do) · 마감 2026-11-27 · 한국외국어대학교
- `auto-dmodeviewduid53596tpage1` [[등록/장학] 대한주택건설협회 서울특별시회 2026학년도 장학생 선발 안내(생활비성)](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53596&tpage=1&searchKey=1&searchVal=&srCategoryId=) · 마감 2026-11-06 · 광운대학교
- `auto-krbbskr846019artclviewdo` [[학부-교외장학] 2026학년도 (재)농와장인재육성장학재단 장학생 선발 안내](https://www.inha.ac.kr/bbs/kr/8/46019/artclView.do) · 마감 2026-11-10 · 인하대학교
- `auto-zc3cnavcodeknu1619416593-08xvigz` [2026학년도 2학기 경북대학교총동창회 학업장려금 장학생 선발 ..](https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxNzAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZjb2RlPU11NlN4bjZQMUlRYyZzZWFyY2hfaXRlbT0mc2VhcmNoX29yZGVyPSZvcmRlcl9saXN0PSZsaXN0X3NjYWxlPSZ2aWV3X2xldmVsPSZ2aWV3X2NhdGU9JnZpZXdfY2F0ZTI9JnNpdGVfY29kZT1rbnVzc3c=) · 마감 2026-11-13 · 경북대학교

**컨펌 대기 (자동 기준 미달 213건)** — 장학 신호는 있지만 선발·모집 신호가 약하거나 등록 규칙에 걸렸어요(괄호에 이유):
- [한국장학재단] 청년지원정보 통합제공 플랫폼 '통학로' 홍보 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- [전기공사공제조합장학회] 2027년도 제22기 장학생 선발공고 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- '2026.2학기 주거안정장학금' 지급요청서(10월분) 제출 안내 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- 2026학년도 2학기 주거안정장학금 10월분 지급요청서 제출 안내 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- [장학안내] 2026학년도 국가근로장학금 동계방학 집중근로 프로그램 희망근... (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- [학부] 2027년도 두산연강재단 장학생 선발 안내 (타교 등록분과 동일 사업([교외-11/13]2027학년도 두산연강재단) — 접수분 여부 컨펌 대기)
- 2026-2학기 주거안정장학금 지급요청서(10월분) 제출 안내(~11/8(일)까지) (같은 사업의 지난 회차(서울시립대학교 등록분 · 마감 2026-09-09) — 새 회차인지 컨펌 대기)
- [교내/국가] (외국인) 2027-1 교내장학금(글로벌) 신청 안내(11/30 마감) (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(인하대학교 · [학부-교외장학] 2026년 2학기 벽담재단)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- 2026-2학기 주거안정장학금 10월분 지급요청서 제출 안내 (같은 사업의 지난 회차(서울시립대학교 등록분 · 마감 2026-09-09) — 새 회차인지 컨펌 대기)
- [교외][등록금] 2027학년도 전기공사공제조합 제22기 전기공사공제조합장학회 장학생 선발 안내(11. 2. (2027년(내년도) 사업 · 같은 사업으로 보이는 다른 글(홍익대학교 · [전기공사공제조합장학회] 2027년도 제22)이 있어 학교마다 따로 등록되지 않게 컨펌 대기)
- … 외 203건

컨펌 대기 이유별: 같은 사업의 지난 회차 61건 · 타교 등록분과 동일 사업 57건 · 선발·모집·신청 신호 없음 31건 · 내년도 사업 · 마감 모름 25건 · 내년도 사업 · 같은 사업으로 보이는 다른 글 25건 · 타교 등록분과 동일 사업[교외] STX장학재단 장학생 선발 안내 7건 · 타교 등록분과 동일 사업[우양재단] 2026년 동행 장학생 모집 3건 · 내년도 사업 · 마감이 오늘~올해 밖 3건 · 타교 등록분과 동일 사업2026-2학기 창암장학재단 장학생 선발 1건

⚠️ 차단 id 하나가 여러 공고에 걸림 — 주소(blockUrls)로만 막음: `auto-amepagescholarshipnotice` 16건

**거른 공고 423건 — 이유별**

- 이미 등록(원문 동일) · 146건
- 이미 등록(동일 사업) · 93건
- 이미 전국(동일 사업) · 63건
- 마감 경과 · 29건
- 행정 안내(신청 공고 아님) · 27건
- 행사·연수·설명회(신청형 장학 아님) · 15건
- 국가장학금 상시 제도 — 앱 내 카드로 이미 안내 · 11건
- 학자금 대출·융자(장학금 아님) · 9건
- 마감 경과(등록 뒤 원문에서 확인) · 8건
- '장학' 신호 없음 · 5건
- 이미 등록(동일 사업)논산시장학회 ) · 4건
- 학부생 대상 아님(대학원 등) · 3건
- 이미 등록(동일 사업)춘천인재육성장학) · 3건
- 이미 등록(동일 사업)포항시장학회) · 2건
- 이미 등록(동일 사업)대전청년내) · 1건
- 사람이 막아 둔 공고(blockIds/blockUrls) · 1건
- 이미 등록(동일 사업)거창군장학회 거창군) · 1건
- 이미 등록(동일 사업)인천인재평생교육진흥원) · 1건
- 이미 등록(동일 사업)) · 1건

## 🔎 읽지 못한 공고 현황 (마감 전 정식 등록 117건 · 상시 제도 제외)

### 💰 금액 모름 — 37건
- 원문에 금액 없음·첨부 없음: 18건
- 원문 없음·첨부 있음: 6건
- 글자 있는데 못 읽음: 6건
    - [교내/선발] 2026학년도 2학기 학부 교내장학 선발완료 안내 `auto-q1brddate20260807brdseq2`
    - 2026-2학기 천마가족장학금 신청 안내 `auto-ticedoarticleno231554923`
    - 2026학년도 2학기 그린나래장학금 신청 안내 `auto-2542viewdocurrentpageno1`
    - 2026학년도 2학기 가온누리장학금 신청 안내 `auto-2540viewdocurrentpageno1`
    - 2026학년도 2학기 외국인재학생장학금 신청 안내(~11/18) `auto-bswj104944500artclviewdo`
    - 제6회 글로벌 여성리더 장학생 선발 안내[학부생/대학원생] `auto-2570viewdocurrentpageno1`
- 원문에 금액 없음·첨부 있음: 5건
- 지금 규칙으로는 읽힘(다음 실행이 채움): 1건
- 원문 없음·첨부 없음: 1건

### 📅 마감 없음 — 33건
- 날짜만 있음(이름표 없음): 15건
- 원문 없음: 12건
- 글자 있는데 못 읽음: 3건
    - 2026년도 대전광역시 서구인재육성장학재단 장학생 선발 안내 `auto-0713no2515412sitedvscdkr`
    - 2026-2학기 한국장학재단 국가근로장학금 추가신청기간(3차) 안내 `auto-ticedoarticleno232062825`
    - 엔지니어링인재육성재단 장학생 선발 공고 `auto-4srsearchkeyarticletitle`
- 원문에 날짜 없음: 2건
- 지금 규칙으로는 읽힘(다음 실행이 채움): 1건

### 📋 자격 줄 없음 — 12건
- 원문 있는데 자격 절 없음: 9건
- 원문 없음: 3건

> 「글자 있는데 못 읽음」은 규칙이 고칠 목록(parse-amount · extract-excerpts) · 「원문 없음」은 자격요건 로봇(rescue-bodies)이 다시 받는다 · 「원문에 없음」은 첨부 로봇 몫이거나 정직한 빈 칸.
- 자격 줄 전수: 공고 117/87/163 · 조건을 하나도 못 읽는 줄 90/147/68 (등록/재단/활동 · 합 305) · 처지 상위 kosafApplied 13, discipline 11, award 10, volunteer 7, job 6 · ⚠️ 온보딩 질문 목록 손볼 때 — 4곳 미만인데 묻는 것: 없음 · 4곳 이상인데 안 묻는 것: careLeaver 4


### 🌐 범위 승격 (학교 한정 → 전국) — 0건
원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.
- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.
### 🏫 교내·교외 원문 판정 — 바뀐 것 0건 · 후보 6건 · 학교 제도 새로 배움 0건
판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.
- 뒤집힌 판정 없음
- 후보 교외 → 교내? `auto-oardid323225menuno200318` 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금 — 제목의 학교 이름표 「경희」 · 접수처 「포털 인포21」
- 후보 교외 → 교내? `auto-2445viewdocurrentpageno1` 2026학년도 국민대학교 교수회 제자사랑장학금 신청 안내 — 제목의 학교 이름표 「국민대학교」 · 접수처 「학생지원팀 신청」
- 후보 교외 → 교내? `auto-jong659273457artclviewdo` [기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내 — 제목의 학교 이름표 「고려대」
- 후보 교외 → 교내? `auto-bbssc58944362artclviewdo` 2026학년도 연세 월든장학금 신청 안내(생활비) — 제목의 학교 이름표 「연세」 · 접수 이메일 도메인 yonsei.ac.kr (학교)
- 후보 교외 → 교내? `auto-rykeywordpaged1slug20262-0mvhb0o` 장학 ★ 2026학년도 2학기 특별장학금(주거비, 교통비, 근면숭실, 공 — 제목의 학교 이름표 「숭실」 · 접수처 「SAINT ‘장학금 종류 및 신청」
- 후보 교외 → 교내? `auto-amepagescholarshipnotice-0he48mo` [발전기금] 서강 나눔의터(여교수회) 장학생 선발 안내(11/5 마감,  — 제목의 학교 이름표 「서강」

### 📄 제출 서류 채우기 (원문 「제출서류」 절) — 0건 · 아직 자리표시뿐 125건
원문 본문의 `제출서류·구비서류` 절 아래 서류 이름 줄만 담았어요(설명 문장·곁말·제출 방법은 뺌). 원문이 없거나 절이 없는 글은 그대로 둡니다.
- 이번 실행에서 원문에서 읽은 서류가 없었어요.

### 🏛 학교 신청 시스템 후보 — 2개교 (아직 표에 없는 이름)
정식 등록 공고 원문에서 학교별 신청 시스템 이름을 모았어요. ✅ 는 그 학교에만 나오고 근거가 2건 이상인 이름이에요 — 확인하고 apply-channel.js 시스템 표에 넣어 주세요(주소는 정찰로 확인한 것만).
- **건국대학교** → 학사정보시스템 (1건) — 예: "★ 서울캠퍼스 학부생이 있는 경우 : 서울캠퍼스 학부생이 학사정보시스템에서 신청"
- **국민대학교** → ON 국민 (1건) — 예: "ㅇ 신청방법 : ON 국민 - 포털 - 학생서비스 - 장학정보 - 장학신청"