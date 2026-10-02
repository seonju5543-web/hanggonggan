## 🤖 장학공고 수집 리포트 (2026-10-02)

새로 발견한 공고: **31건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review
> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.
> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.

⏱ 게시판 87곳을 6분 25초에 다 돌았습니다(예산 8분).

⚠️ 정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 154KB 를 받습니다(학교 35곳 · 전국분 123KB 은 모두가 받아야 합니다). 실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. 이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 (왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)

### 경희대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 한국외국어대학교
상태: ✅ 정상 (실공고 41건 감지)

### 서울대학교
상태: ✅ 정상 (실공고 33건 감지)

### 연세대학교
상태: ✅ 정상 (실공고 28건 감지)

### 연세대학교 미래캠퍼스
상태: ⚙️ 게시판 주소 미설정 (자동 탐색 실패(봇 차단·동적 페이지 추정) — 개발자가 장학공지 주소 제공 필요)

### 고려대학교
상태: ⚙️ 게시판 주소 미설정 (개발자가 준 장학금공지 주소(korea.ac.kr/ko/568/subview.do)는 목록 행이 href="#1" + jf_view() 클릭 스크립트라 일반 fetch로는 링크가 하나도 안 나온다(2026-08-02 확인 — 옛 주소 scholarship.korea.ac.kr도 안내 홈페이지라 0건이었다). 동국대·경희대와 같은 클릭형이라 browser-targets.json으로 옮겼다)

### 고려대학교 세종캠퍼스
상태: ⚙️ 게시판 주소 미설정 (자동 탐색 실패(봇 차단·동적 페이지 추정) — 개발자가 장학공지 주소 제공 필요)

### 서강대학교
상태: ✅ 정상 (실공고 25건 감지)
- [[교외] 논산시장학회 장학생 선발 안내(10/30 마감, 생활비 150만원)](https://www.sogang.ac.kr/ko/detail/551451?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 9월 28일(월) 9:00 ~ 10월 30일(금) 18:00 4. 신청방법: 방문 또는 등기우편 접수 접수처: 충남 논산시
- [[교외] 서초구 문주장학재단 주관 AI, ICT 분야 장학생 모집 안내(10/8 마감, 등록금 전액)](https://www.sogang.ac.kr/ko/detail/551379?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[발전기금] 2026-2학기 발전기금 장학생 선발 안내(10/5 마감)](https://www.sogang.ac.kr/ko/detail/551306?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간 및 방법 1) 신청기간: 2026년 9월 18일(금)~10월 5일(월) 2) 신청방법: 발전기금 장학금 신청 매뉴얼(첨부) 참조하여 S
- [[발전기금] 박성욱 장학금 장학생 선발 안내(10/5 마감, 인문학부, 등록금 250만원)](https://www.sogang.ac.kr/ko/detail/551305?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 18일(금)~10월 5일(월) 오후 11시(마감시한 준수) 5. 지원방법: 장학금 신청서(첨부)를 작성하여 학생지원팀
- [[발전기금] 최응호 장학금 장학생 선발 안내(9/30 마감, 1학년, 등록금 전액)](https://www.sogang.ac.kr/ko/detail/551303?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 18일(금)~9월 30일(수) 오후 11시(마감시한 준수) 5. 지원방법: 장학금 신청서(첨부)를 A4 2페이지 내외
- [[발전기금] 서강영문교수 장학생 선발 안내(10/5 마감, 학업보조비 100만원)](https://www.sogang.ac.kr/ko/detail/551302?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 18일(금)~10월 5일(월) 오후 11시(마감시한 준수) 5. 지원방법: 장학금 신청서(첨부)를 작성하여 학생지원팀
- [[발전기금] 故장영희교수 장학금 장학생 선발 안내(10/5 마감, 영문 및 인문사회계열, 등록금 2/3)](https://www.sogang.ac.kr/ko/detail/551301?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 18일(금)~10월 5일(월) 오후 11시(마감시한 준수) 5. 지원방법: 장학금 신청서(첨부)를 작성하여 학생지원팀
- [[교외] 춘천인재육성장학재단 봄내장학생 선발 안내(10/7 마감, 등록금 최대 100만원)](https://www.sogang.ac.kr/ko/detail/551299?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 9월 28일(월) ~ 10월 7일(수) 4. 신청방법: 온라인신청 필수 &amp; 방문 또는 우편(등기) 접수 온라인신청
- [[교외] 마포인재육성장학재단 장학생 선발 안내(10/7 마감, 등록금 최대 300만원)](https://www.sogang.ac.kr/ko/detail/551280?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 30일(수)~10월 7일(수) 4. 제출서류: 첨부의 공고문 반드시 참조 장학생 신청서, 추천서, 개인정보 동의서(첨
- [[교외] 인송문화재단 장학생 선발 안내(10/9 마감, 생활비 200만원)](https://www.sogang.ac.kr/ko/detail/551273?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 10월 9일(금) 17시까지 5. 신청방법: 학생지원팀으로 원본서류 직접 또는 등기우편 제출 주소: 서울특별시 마포구 백범
- [[교외] 고속도로장학재단 장학생 선발 안내(10/11 마감, 생활비 500만원)](https://www.sogang.ac.kr/ko/detail/551215?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[교외] 인천인재평생교육진흥원 장학생 선발 안내(10/8 마감, 생활비 100만원)](https://www.sogang.ac.kr/ko/detail/551199?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[교외] *기간연장*대전청년내일재단 인재육성장학생 선발 안내(10/8 마감, 생활비 150만원)](https://www.sogang.ac.kr/ko/detail/551198?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[교외] 2027년 봄학기 미래에셋 해외교환 장학생 선발 안내(10/6 마감, 교환학생 생활비)](https://www.sogang.ac.kr/ko/detail/551038?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2027년 봄학기(한 학기 지원) 중복수혜 가능 및 불가능 장학금에 대해서는 첨부 선발요강 참조 3. 지원자격 대한민국 국적으로 4년
- [[교외] 한국선원복지고용센터 선원가족 장학생 선발 안내(10/23 마감, 등록금 최대 350만원)](https://www.sogang.ac.kr/ko/detail/550981?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[교외] 포항시장학회 장학생 선발 안내(9/22 마감, 등록금 최대 200만원)](https://www.sogang.ac.kr/ko/detail/551197?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 8월 24일(월)~9월 22일(목) 18시 5. 접수방법: 포항시장학회 홈페이지에서 온라인 신청 http://www.phs
- [[발전기금] 경영대학 최운열 교수 장학생 선발 안내(9/21 마감, 등록금 전액)](https://www.sogang.ac.kr/ko/detail/551195?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 9월 7일(월)~9월 21일(월) 오후 11시 59분(마감기한 준수) 5. 신청방법: 모든 서류를 하나의 PDF 파일로 통
- [[발전기금] [법인] 경영대학 인본장학금 장학생 선발 안내(9/21 마감, 등록금 전액)](https://www.sogang.ac.kr/ko/detail/551193?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 9월 7일(월) ~ 9월 21일(월) 오후 11시 59분까지(마감기한 준수) 5. 신청방법: 모든 서류를 하나의 PDF 파
- [[발전기금] 가톨릭 우수 인재 장학금 장학생 선발 안내(9/18 마감, 학업보조비 200만원)](https://www.sogang.ac.kr/ko/detail/551074?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 지원기간: 2026년 9월 9일(수)~9월 18일(금) 오후 11시(마감시한 준수) 5. 지원방법: 장학금 신청서(첨부)를 A4 2페이지 내외
- [[학자금대출] 2026년 상반기분 통영시 대학생 학자금 이자 지원 공고 (9/23 마감)](https://www.sogang.ac.kr/ko/detail/551072?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간 : 2026. 9. 2.(수) ~ 9. 23.(수) 17:00 나. 신청방법 : 전자 우편, 방문, 우편 접수 (팩스 불가) 1) 전자

### 성균관대학교
상태: ✅ 정상 (실공고 8건 감지)

### 한양대학교
상태: ✅ 정상 (실공고 15건 감지)

### 중앙대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — CAU Notice의 장학 탭(P_TAB_NO=5), 485건. 행이 클릭형(fn_goDetail)이라 browser-targets.json이 담당한다)

### 서울시립대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 건국대학교
상태: ✅ 정상 (실공고 26건 감지)

### 동국대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 동국대학교 WISE캠퍼스
상태: ⚙️ 게시판 주소 미설정 (자동 탐색 실패(봇 차단·동적 페이지 추정) — 개발자가 장학공지 주소 제공 필요)

### 홍익대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 숙명여자대학교
상태: ✅ 정상 (실공고 9건 감지)

### 광운대학교
상태: ✅ 정상 (실공고 8건 감지)
- [[등록/장학] 2026년 든든 학업지원금 선발 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53420&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - 📎 [부설기관](https://www.kw.ac.kr/ko/department/attach01.jsp)
  - 📎 [부설연구기관](https://www.kw.ac.kr/ko/department/research_attach.jsp)
  - 📎 [연구지원팀](https://www.kw.ac.kr/ko/department/attach03.jsp)
  - 📎 [연구진흥팀](https://www.kw.ac.kr/ko/department/attach04.jsp)
  - 📎 [경영관리팀](https://www.kw.ac.kr/ko/department/attach02.jsp)
- [[등록/장학] 2026년 우양재단 동행 장학생 모집 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53419&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - 📎 [부설기관](https://www.kw.ac.kr/ko/department/attach01.jsp)
  - 📎 [부설연구기관](https://www.kw.ac.kr/ko/department/research_attach.jsp)
  - 📎 [연구지원팀](https://www.kw.ac.kr/ko/department/attach03.jsp)
  - 📎 [연구진흥팀](https://www.kw.ac.kr/ko/department/attach04.jsp)
  - 📎 [경영관리팀](https://www.kw.ac.kr/ko/department/attach02.jsp)
- [[등록/장학] 2027년도 대산장학생 선발 공고](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53418&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - 📎 [부설기관](https://www.kw.ac.kr/ko/department/attach01.jsp)
  - 📎 [부설연구기관](https://www.kw.ac.kr/ko/department/research_attach.jsp)
  - 📎 [연구지원팀](https://www.kw.ac.kr/ko/department/attach03.jsp)
  - 📎 [연구진흥팀](https://www.kw.ac.kr/ko/department/attach04.jsp)
  - 📎 [경영관리팀](https://www.kw.ac.kr/ko/department/attach02.jsp)

### 명지대학교
상태: ✅ 정상 (실공고 10건 감지)

### 상명대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 가천대학교
상태: ✅ 정상 (실공고 146건 감지)
- [[공통] (긴급-생활비)2026-2학기 (재)효림장학재단 장학생 추가 선발 안내(화공생명, 바이오, 식품생명, 생명과 N](https://www.gachon.ac.kr/bbs/kor/478/125845/artclView.do)
  - ⏰ 신청 기한 및 방법 : 2026.10.6(화).12시까지&nbsp;장학복지팀 또는 학생복지팀에 직접 제출(메일제출 불가) 6. 기타사항 :&nb
  - 📎 [효림장학재단추천서.hwp](https://www.gachon.ac.kr/bbs/kor/478/156322/download.do)
  - 📎 [효림장학재단-개인정보수집이용동의서.hwp](https://www.gachon.ac.kr/bbs/kor/478/156323/download.do)
- [[공통] 2026년 우양재단 동행 장학생 모집 안내(가족 돌봄 청년 대상) N](https://www.gachon.ac.kr/bbs/kor/478/125843/artclView.do)
  - ⏰ 신청기간 : 2026. 10. 1.(목) ~ 10. 18.(일) 2. 대상 : 국내 4년제 대학 또는 2~3년제 전문대학 재학생 중 학자금지원구
  - 📎 [우양재단2026-2동행장학생-장학모집공문.pdf](https://www.gachon.ac.kr/bbs/kor/478/156319/download.do)
  - 📎 [우양재단2026-2동행장학생-신청서식.hwp](https://www.gachon.ac.kr/bbs/kor/478/156320/download.do)
  - 📎 [우양재단2026-2동행장학생-포스터.jpg](https://www.gachon.ac.kr/bbs/kor/478/156321/download.do)
- [[공통] 2027년도 대산농촌재단 장학생 선발 안내 N](https://www.gachon.ac.kr/bbs/kor/478/125842/artclView.do)
  - 📎 [붙임12027대산장학생선발공지.jpg](https://www.gachon.ac.kr/bbs/kor/478/156317/download.do)
  - 📎 [붙임22027대산장학생선발요강.pdf](https://www.gachon.ac.kr/bbs/kor/478/156318/download.do)

### 아주대학교
상태: ✅ 정상 (실공고 13건 감지)

### 국민대학교
상태: ✅ 정상 (실공고 16건 감지)
- [2026-2학기 인송문화재단 일반장학생 선발 안내](https://www.kookmin.ac.kr/user/kmuNews/notice/7/12449/view.do?currentPageNo=1)
  - ⏰ 마감 : 2026 년 &nbsp;10 월 &nbsp;11 일 (22:59 까지 ) ㅇ 신청방법 : ON 국민 &nbsp;-&nbsp; 포털 &n
  - 📎 [' + fileItem.fileNm + '](https://kep.kookmin.ac.kr/com/cmsv/FileCtr/fileDefaultDownload.do?fileNo=)

### 숭실대학교
상태: ✅ 정상 (실공고 14건 감지)

### 세종대학교
상태: ✅ 정상 (실공고 10건 감지)

### 이화여자대학교
상태: ✅ 정상 (실공고 12건 감지)

### 인하대학교
상태: ✅ 정상 (실공고 45건 감지)
- [[한국장학재단] 희망사다리 장학생 대상 대전 일자리박람회 개최](https://www.inha.ac.kr/bbs/kr/8/45693/artclView.do)
  - 📎 [(IBK ver)- 2026 대전 일자리박람회.png](https://www.inha.ac.kr/bbs/kr/8/41443/download.do)

### 부산대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — onestop.pusan.ac.kr 장학 공지 511건. 목록을 자바스크립트가 그리고 행이 href="#popup"이라 browser-targets.json이 담당한다)

### 가톨릭대학교
상태: ✅ 정상 (실공고 8건 감지)

### 한국항공대학교
상태: ✅ 정상 (실공고 55건 감지)

### 경기대학교
상태: ✅ 정상 (실공고 10건 감지)

### 서울과학기술대학교
상태: ✅ 정상 (실공고 58건 감지)

### 계명대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — kmu.ac.kr 장학 공고 23건 보임. 상세 링크가 HTML에 없어 browser-targets.json이 담당한다)

### 서울교육대학교
상태: ✅ 정상 (실공고 13건 감지)

### 한국방송통신대학교
상태: ✅ 정상 (실공고 30건 감지)

### 경북대학교
상태: ✅ 정상 (실공고 6건 감지)
- [2026학년도 우양재단 동행 장학생 모집 안내](https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxNTEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZjb2RlPU11NlN4bjZQMUlRYyZzZWFyY2hfaXRlbT0mc2VhcmNoX29yZGVyPSZvcmRlcl9saXN0PSZsaXN0X3NjYWxlPSZ2aWV3X2xldmVsPSZ2aWV3X2NhdGU9JnZpZXdfY2F0ZTI9JnNpdGVfY29kZT1rbnVzc3c=)
  - ⏰ 신청 기한: ~2026. 10. 18.(일)까지 2. 지급 금액: 학업장려금 100만원 3. 접수 방법: 우양재단 홈페이지 모집 공고문을 통한
  - 📎 [[붙임2] 2026년 우양재단 동행장학 신청서 서식.hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNTEmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=1)
- [2027학년도 해동과학문화재단 장학생 모집 안내](https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593&mode=view&mv_data=aWR4PTIxNTAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZjb2RlPU11NlN4bjZQMUlRYyZzZWFyY2hfaXRlbT0mc2VhcmNoX29yZGVyPSZvcmRlcl9saXN0PSZsaXN0X3NjYWxlPSZ2aWV3X2xldmVsPSZ2aWV3X2NhdGU9JnZpZXdfY2F0ZTI9JnNpdGVfY29kZT1rbnVzc3c=)
  - ⏰ 제출기한 및 제출처: 2026. 10. 27.(화) 오후 3시까지 / ricjtls@knu.ac.kr&nbsp; &nbsp;&nbsp; ※ 기한
  - 📎 [2027 해동장학생 모집요강.pdf](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNTAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=0)
  - 📎 [2027 해동장학금 운영규정.pdf](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNTAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=1)
  - 📎 [2027 해동장학생 신규지원(ㅇㅇ대;;ㅇ학년;;이름).hwp](https://home.knu.ac.kr/HOME/bbs/bbs_download.php?mv_data=aWR4PTIxNTAmc3RhcnRQYWdlPSZsaXN0Tm89JnRhYmxlPWV4X2Jic19kYXRhX2tudXNzdyZuYXZfY29kZT1rbnUxNjE5NDE2NTkzJnNpdGVfY29kZT1rbnVzc3cmY29kZT1NdTZTeG42UDFJUWMmc2VhcmNoX2l0ZW09JnNlYXJjaF9vcmRlcj0mb3JkZXJfbGlzdD0mbGlzdF9zY2FsZT0=&download=h&seq=2)

### 영남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 전북대학교
상태: ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 충남대학교
상태: ✅ 정상 (실공고 7건 감지)

### 전남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 조선대학교
상태: ✅ 정상 (실공고 44건 감지)

### 충북대학교
상태: ✅ 정상 (실공고 6건 감지)

### 부경대학교
상태: ✅ 정상 (실공고 17건 감지)

### 강원대학교
상태: ✅ 정상 (실공고 13건 감지)
- [2026학년도 2학기 중소기업 취업연계 장학금 선발계획 알림 및 심사서류 제출 요청](https://kangwon.ac.kr/ko/bbs/750/detail.do?pstSn=2510&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0)
  - 📎 [붙임 1 - 2026학년도 2학기 중소기업취업연계장학사업 신규장학생 선발 계획(안).hwp chevron_forward](https://kangwon.ac.kr/ko/cmmn/download.do?dn=20261002101840868.hwp&path=/bbs/34&fn=%EB%B6%99%EC%9E%84%201%20-%202026%ED%95%99%EB%85%84%EB%8F%84%202%ED%95%99%EA%B8%B0%20%EC%A4%91%EC%86%8C%EA%B8%B0%EC%97%85%EC%B7%A8%EC%97%85%EC%97%B0%EA%B3%84%EC%9E%A5%ED%95%99%EC%82%AC%EC%97%85%20%EC%8B%A0%EA%B7%9C%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%84%A0%EB%B0%9C%20%EA%B3%84%ED%9A%8D(%EC%95%88).hwp)

### 🎯 대외활동·공모전 새 글 5건 → 앱 '대외활동' 탭 (data/activities.json · 161건 게재 중)
- 🔁 전에 실린 글 40건의 원문을 다시 읽어 마감·발췌를 채웠습니다 (남은 0건은 다음 실행에)
- **광운대학교 (장학 게시판에서 발견)** — ✅
  - [공모전] [[외부] [서울특별시] 2026 서울영상공모전 '서울밤로그' 참여 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53417&tpage=1&searchKey=1&searchVal=&srCategoryId=)
- **한국방송통신대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[일반] [국립대학 육성사업] 감정 및 스트레스 관리 심리특강](https://www.knou.ac.kr/bbs/knou/51/816545/artclView.do) — ⏰ 신청 기간 특강 제목 1 차 2026.10.23.( 금 ) 13:00~15:30 2026.10.02.( 금 ) 10:00 ~ 2026.10.22
  - [대외활동] [[일반] [국립대학 육성사업] 감정 및 스트레스 관리 심리특강](https://www.knou.ac.kr/bbs/knou/51/816545/artclView.do) — ⏰ 신청 기간 특강 제목 1 차 2026.10.23.( 금 ) 13:00~15:30 2026.10.02.( 금 ) 10:00 ~ 2026.10.22
  - [대외활동] [[일반] [국립대학 육성사업] 감정 및 스트레스 관리 심리특강](https://www.knou.ac.kr/bbs/knou/51/816545/artclView.do) — ⏰ 신청 기간 특강 제목 1 차 2026.10.23.( 금 ) 13:00~15:30 2026.10.02.( 금 ) 10:00 ~ 2026.10.22
- **한국외국어대학교 대외활동·공모전 「학생활동」** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **한국외국어대학교 대외활동·공모전 「진로·취업」** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **경희대학교 대외활동·공모전** — ⚠️ 접속 실패 (HTTP 404) — 주소 수정 필요
- **경희대학교 대외활동·공모전 「취업/경력」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「사회진출 프로그램 공지」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **정부24 공모전 대외활동·공모전** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **온통청년 청년참여 프로그램 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울시 청년몽땅정보통 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **창업진흥원 K-Startup 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
  - [공모전] [2026년 초기창업패키지 로켓십 IR 경진대회 참가기업 모집 (2회차: 콘텐츠·플랫폼)](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179246) — ⏰ 접수기간 2026-09-14 ~ 2026-10-02&nbsp;18:00 주관기관명 씨엔티테크(주) 대상 전체 창업업력 7년미만 연락처 02-31
- **대한민국 정책브리핑 이벤트·공모 대외활동·공모전** — ✅ 정상 (활동·공모전 34건 감지)
- **경기청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **KOICA 봉사단 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **국립국제교육원 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **한국콘텐츠진흥원 대외활동·공모전** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **문화포털 문화지원사업 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울문화포털 공모소식 대외활동·공모전** — ✅ 정상 (활동·공모전 13건 감지)
- **청년재단 대외활동·공모전** — ⚠️ 접속 실패 (HTTP 404) — 주소 수정 필요
- **부산청년플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **인천유스톡톡 청년포털 대외활동·공모전** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **대전청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 8건 감지)
- **울산청년정책플랫폼 U-PAGE 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **광주청년통합플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경남청년정보플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)

### 🏛 재단·지자체 새 공고 1건 → 홈 '재단·지자체 새 공고' (data/external.json · 47건 게재 중 · 게시판 아는 곳 20/77)
- **(재)음성군장학회** — ✅ 정상 (장학 공고 6건 감지)
  - [2026년 한국가스안전공사 지역상생 특별장학생 선발 공고](https://scholarship.eumseong.go.kr/www/selectBbsNttView.do?key=33&bbsNo=3&nttNo=838) — ⏰ 신청기간: 2026. 10. 6.(화) ~ 10. 23.(금) 2. 신청방법: 음성군장학회 홈페이지 온라인 신청 후 구비서류 별도 제출 3. 접
- **재단법인 김해시미래인재장학재단** — ✅ 정상 (장학 공고 11건 감지)
- **재단법인 상주시장학회** — ✅ 정상 (장학 공고 3건 감지)
- **재단법인 삼원장학재단** — ✅ 정상 (장학 공고 24건 감지)
- **한진해운장학재단** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **(재)송파구 인재육성 장학재단** — ✅ 정상 (장학 공고 16건 감지)
- **파안장학문화재단법인** — ✅ 정상 (장학 공고 24건 감지)
- **메디힐장학재단** — ✅ 정상 (장학 공고 9건 감지)
- **(재)고속도로장학재단** — ✅ 정상 (장학 공고 4건 감지)
- **아산시미래장학회** — ✅ 정상 (장학 공고 10건 감지)
- **관정이종환교육재단** — ✅ 정상 (장학 공고 27건 감지)
- **두산연강재단** — ✅ 정상 (장학 공고 5건 감지)
- **미래에셋박현주재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **아산사회복지재단** — ✅ 정상 (장학 공고 10건 감지)
- **한국고등교육재단** — ⛔ robots.txt 가 막아 둔 주소 — 읽지 않았습니다 (출처를 바꾸거나 보관하세요)
- **한국장학재단 공지** — ✅ 정상 (장학 공고 14건 감지)
- **국립국제교육원 공지** — ✅ 정상 (장학 공고 3건 감지)
- **롯데장학재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **일주학술문화재단** — ✅ 정상 (장학 공고 5건 감지)
- **영동군민장학회** — ✅ 정상 (장학 공고 8건 감지)

### 📄 목록 2페이지 이후에서 더 읽은 게시판
1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.
- 재단법인 삼원장학재단: 2페이지 더 읽어 17행 추가
- (재)송파구 인재육성 장학재단: 2페이지 더 읽어 24행 추가
- 관정이종환교육재단: 2페이지 더 읽어 17행 추가
- 아산사회복지재단: 2페이지 더 읽어 50행 추가
- 한국외국어대학교: 2페이지 더 읽어 82행 추가
- 서울대학교: 2페이지 더 읽어 118행 추가
- 연세대학교: 2페이지 더 읽어 24행 추가
- 가천대학교: 2페이지 더 읽어 419행 추가
- 인하대학교: 2페이지 더 읽어 40행 추가
- 한국항공대학교: 2페이지 더 읽어 186행 추가
- 서울과학기술대학교: 2페이지 더 읽어 182행 추가
- 한국방송통신대학교: 2페이지 더 읽어 30행 추가
- 조선대학교: 2페이지 더 읽어 34행 추가
- 대한민국 정책브리핑 이벤트·공모 대외활동·공모전: 2페이지 더 읽어 64행 추가
- 서울문화포털 공모소식 대외활동·공모전: 2페이지 더 읽어 60행 추가

📄 페이지 넘기기가 안 되는 게시판 65곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`
**🧩 양식 원본 자동 확보 예약 1건** — 원본은 이 실행에서 바로 내려받고, 같은 실행의 무료 변환기가 앱 양식으로 옮겨요(못 옮긴 것은 리포트 '보류'에 남아요).

**⏳ 스키마화 대기 중 81건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 8건 등록

자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.

- `auto-dmodeviewduid53420tpage1` [[등록/장학] 2026년 든든 학업지원금 선발 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53420&tpage=1&searchKey=1&searchVal=&srCategoryId=) · 광운대학교
- `auto-notiphpcodes1301seq11193` [독일 정부초청(DAAD) 섬머코스 장학생 선발 안내 학생지원팀 2026-09-17 437](https://kau.ac.kr/kaulife/scholnoti.php?searchkey=&searchvalue=&code=s1301&page=&mode=read&seq=11193) · 한국항공대학교
- `auto-notiphpcodes1301seq11156` [2026년 하반기 인재육성(성취) 장학생 선발 안내 학생지원팀 2026-09-08 505](https://kau.ac.kr/kaulife/scholnoti.php?searchkey=&searchvalue=&code=s1301&page=&mode=read&seq=11156) · 한국항공대학교
- `auto-780ec9b90ed8c80202026052` [2026년 2학기 청년창업농장학금 신청 안내 학생지원팀 2026-05-22 658](https://kau.ac.kr/kaulife/scholnoti.php#n-2026%EB%85%84%202%ED%95%99%EA%B8%B0%20%EC%B2%AD%EB%85%84%EC%B0%BD%EC%97%85%EB%86%8D%EC%9E%A5%ED%95%99%EA%B8%88%20%EC%8B%A0%EC%B2%AD%20%EC%95%88%EB%82%B4%20%ED%95%99%EC%83%9D%EC%A7%80%EC%9B%90%ED%8C%80%202026-05-2) · 한국항공대학교
- `auto-780ec9b90ed8c80202026051` [2026학년도 산학협동재단 장학생 선발 안내 학생지원팀 2026-05-19 738](https://kau.ac.kr/kaulife/scholnoti.php#n-2026%ED%95%99%EB%85%84%EB%8F%84%20%EC%82%B0%ED%95%99%ED%98%91%EB%8F%99%EC%9E%AC%EB%8B%A8%20%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%84%A0%EB%B0%9C%20%EC%95%88%EB%82%B4%20%ED%95%99%EC%83%9D%EC%A7%80%EC%9B%90%ED%8C%80%202026-05-1) · 한국항공대학교
- `auto-notiphpcodes1301seq10610` [세종연구원 2026년도 세종이도인재장학금 장학생 선발 안내 학생지원팀 2026-05-11 1,664](https://kau.ac.kr/kaulife/scholnoti.php?searchkey=&searchvalue=&code=s1301&page=3&mode=read&seq=10610) · 한국항공대학교
- `auto-9ea5ed9599ec839d20ec84a0` [[입학에서 취업까지] [대전청년내일재단] 2026년 성취(대) 장학생 선발 안내 ( ~ 2026.10.08.(목) 17:00)](https://www.kyonggi.ac.kr/www/selectBbsNttList.do?key=7520&bbsNo=1073&pageUnit=10&sf.pnos=1073&sf.pnos=888&searchCnd=WRTER&searchKrwd=%EC%9E%A5%ED%95%99#n-%5B%EC%9E%85%ED%95%99%EC%97%90%EC%84%9C%20%EC%B7%A8%EC%97%85%EA%B9%8C%EC%A7%80%5D%20%5B%EB%8C%80%EC%A0%84%EC%B2%AD%EB%85%84%EB%82%B4%EC%9D%BC%EC%9E%AC%EB%8B%A8%5D%202026%EB%85%84%20%EC%84%B1%EC%B7%A8(%EB%8C%80)%20%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%84%A0) · 마감 2026-10-08 · 경기대학교
- `auto-hkrwdsfpnos1073sfpnos888` [[입학에서 취업까지] 2026-2학기 2차 교내장학금 신청 안내[가족, 문화예술, 고시, 챌린지]](https://www.kyonggi.ac.kr/www/selectBbsNttView.do?key=7520&bbsNo=1073&nttNo=626253&pageUnit=10&searchCnd=WRTER&searchKrwd=%ec%9e%a5%ed%95%99&sf.pnos=1073&sf.pnos=888) · 경기대학교

**전국으로 승격 1건** — 다른 학교 게시판에 같은 사업이 올라와 한 학교 한정을 풀었어요(합치는 규칙은 관리자 합침과 같아요 · 근거는 항목의 scopeFrom).
- `auto-kuk2351208039artclviewdo` [교외][장학금] 2026학년도 2학기 마포인재육성장학재단 장학생 선발  ← 서강대학교 게시판 [[교외] 마포인재육성장학재단 장학생 선발 안내(10/7 마감, 등록금 최](https://www.sogang.ac.kr/ko/detail/551280?bbsConfigFk=141&namepage=ScholarshipNotice)

**컨펌 대기 (자동 기준 미달 60건)** — 장학 신호는 있지만 선발·모집 신호가 약해요:
- [교외] 인송문화재단 장학생 선발 안내(10/9 마감, 생활비 200만원) (타교 등록분과 동일 사업([서울][교외] 2026-2 인송문화재단 장) — 접수분 여부 컨펌 대기)
- [교외] 2027년 봄학기 미래에셋 해외교환 장학생 선발 안내(10/6 마감, 교환학생 생활비) (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- [등록/장학] 2026년 우양재단 동행 장학생 모집 안내 (타교 등록분과 동일 사업(2026년 우양재단 동행장학생 모집 안내) — 접수분 여부 컨펌 대기)
- [등록/장학] 2027년도 대산장학생 선발 공고 (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- [공통] (긴급-생활비)2026-2학기 (재)효림장학재단 장학생 추가 선발 안내(화공생명, 바이오, 식품생명 (타교 등록분과 동일 사업([글로벌][교외] 2026년 효림장학재단 장) — 접수분 여부 컨펌 대기)
- [공통] 2026년 우양재단 동행 장학생 모집 안내(가족 돌봄 청년 대상) N (타교 등록분과 동일 사업(2026년 우양재단 동행장학생 모집 안내) — 접수분 여부 컨펌 대기)
- [공통] 2027년도 대산농촌재단 장학생 선발 안내 N (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)
- 2026-2학기 인송문화재단 일반장학생 선발 안내 (타교 등록분과 동일 사업([서울][교외] 2026-2 인송문화재단 장) — 접수분 여부 컨펌 대기)
- 2026학년도 우양재단 동행 장학생 모집 안내 (타교 등록분과 동일 사업([학부-교외장학] 2026학년도 우양재단 동) — 접수분 여부 컨펌 대기)
- 2027학년도 해동과학문화재단 장학생 모집 안내 (2027년 이후 사업으로 보임 — 개발자 컨펌 대기)

**거른 공고 229건 — 이유별**

- 이미 등록(원문 동일) · 65건
- 이미 등록(동일 사업) · 37건
- 이미 전국(동일 사업) · 33건
- 이미 등록(같은 id) · 17건
- 사람이 막아 둔 공고(blockIds/blockUrls) · 10건
- 행정 안내(신청 공고 아님) · 9건
- 이미 등록(동일 사업)논산시장학회 ) · 8건
- 이미 등록(동일 사업)포항시장학회) · 8건
- 학자금 대출·융자(장학금 아님) · 8건
- 마감 경과 · 8건
- 행사·연수·설명회(신청형 장학 아님) · 6건
- '장학' 신호 없음 · 5건
- 국가장학금 상시 제도 — 앱 내 카드로 이미 안내 · 5건
- 이미 등록(동일 사업)춘천인재육성장학) · 3건
- 이미 등록(동일 사업)인천인재평생교육진흥원) · 2건
- 이미 등록(동일 사업)) · 1건
- 이미 등록(동일 사업)대전청년내) · 1건
- 이미 등록(동일 사업)경주시장학회 장학생 선) · 1건
- 이미 등록(동일 사업) 김해시미래인재장학재단 2026 ) · 1건
- 학부생 대상 아님(대학원 등) · 1건

⏭ 한 실행 상한(8건)에 걸려 **22건은 보지 않았어요** — 다음 수집에서 이어서 봅니다.


### 🚨 양식 원본을 못 받고 있는 공고 12건 (3회 이상 시도)

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

### 🧩 양식 스키마화 — 무료 자동 0건 · API 0건 · 보류 58건

**보류 58건** — 자동 변환기가 원본과 같은 문서를 장담하지 못한 것들이에요. 원본 다운로드 안내는 그대로 유지됩니다.

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

**건너뜀 65건**

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


### 🌐 범위 승격 (학교 한정 → 전국) — 1건
원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.
- 🌐 `auto-notiphpcodes1301seq10610` 세종연구원 2026년도 세종이도인재장학금 장학생 선발 안내 학생지원팀 2 — 접수 이메일 도메인 sri.re.kr (학교 밖) (게시 한국항공대학교)
### 🏫 교내·교외 원문 판정 — 바뀐 것 0건 · 후보 2건 · 학교 제도 새로 배움 0건
판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.
- 뒤집힌 판정 없음
- 후보 교외 → 교내? `auto-oardid323225menuno200318` 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금 — 제목의 학교 이름표 「경희」
- 후보 교외 → 교내? `auto-2445viewdocurrentpageno1` 2026학년도 국민대학교 교수회 제자사랑장학금 신청 안내 — 제목의 학교 이름표 「국민대학교」 · 접수처 「학생지원팀 신청」