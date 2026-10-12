## 🤖 장학공고 수집 리포트 (2026-10-12)

새로 발견한 공고: **27건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 등록하는 곳 — 관리자 화면 → 컨펌 작업대: https://hanggonggan-admin.pages.dev/#review
> 「수집됐지만 아직 등록 안 한 공고」에서 원문 ↗ 으로 확인한 뒤 **등록하기**를 누르면 그 자리에서 등록됩니다(제목·구분·마감일·금액·주관·요약). 대출·대학원 전용처럼 규칙에 걸리는 것은 눌러도 막히니 안심하고 눌러도 됩니다.
> 다만 **첨부된 신청서 양식**과 **자격 요건 줄들**은 원문과 같은 구조로 옮겨야 해서 화면에서 못 합니다 — 그것까지 필요하면 채팅에 "이슈 #N 의 ○○ 양식·자격까지 등록해줘"라고 말씀해 주세요.

⏱ 게시판 82곳을 6분 30초에 다 돌았습니다(예산 8분).

🙋 서비스 학교인데 앱 실시간 공고 0건 1곳: 한양대학교(게시판 15건 감지 · 모두 전에 본 글)

⚠️ 정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 263KB 를 받습니다(학교 43곳 · 전국분 171KB 은 모두가 받아야 합니다). 실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. 이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 (왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)

### 경희대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 한국외국어대학교
상태: ✅ 정상 (실공고 12건 감지)

### 서울대학교
상태: ✅ 정상 (실공고 11건 감지)

### 연세대학교
상태: ✅ 정상 (실공고 25건 감지)

### 연세대학교 미래캠퍼스
상태: ✅ 정상 (실공고 41건 감지)

### 고려대학교
상태: ⚙️ 게시판 주소 미설정 (개발자가 준 장학금공지 주소(korea.ac.kr/ko/568/subview.do)는 목록 행이 href="#1" + jf_view() 클릭 스크립트라 일반 fetch로는 링크가 하나도 안 나온다(2026-08-02 확인 — 옛 주소 scholarship.korea.ac.kr도 안내 홈페이지라 0건이었다). 동국대·경희대와 같은 클릭형이라 browser-targets.json으로 옮겼다)

### 고려대학교 세종캠퍼스
상태: ✅ 정상 (실공고 11건 감지)

### 서강대학교
상태: ✅ 정상 (실공고 25건 감지)
- [[교외] 김의기 장학생 선발 안내(11/6 마감, 학업장려금 200만원)](https://www.sogang.ac.kr/ko/detail/551574?bbsConfigFk=141&namepage=ScholarshipNotice)
- [[교외] 은평구민장학재단 장학생 선발 안내(10/28 마감, 등록금 200만원)](https://www.sogang.ac.kr/ko/detail/551573?bbsConfigFk=141&namepage=ScholarshipNotice)
  - ⏰ 신청기간: 2026년 10월 12일(월) ~ 10월 28일(수) 18:00까지 4. 신청방법: 등기우편 또는 방문 접수 신청서는 작성 후 지참하

### 성균관대학교
상태: ✅ 정상 (실공고 10건 감지)

### 한양대학교
상태: ✅ 정상 (실공고 15건 감지)

### 중앙대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — CAU Notice의 장학 탭(P_TAB_NO=5), 485건. 행이 클릭형(fn_goDetail)이라 browser-targets.json이 담당한다)

### 서울시립대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 건국대학교
상태: ✅ 정상 (실공고 21건 감지)
- [[교외][등록금] 2026학년도 2학기 은평구민장학재단 은평구민 장학생 선발 안내(10. 12.(월) ~ 10. 28.(수) 18:00)](https://www.konkuk.ac.kr/bbs/konkuk/235/1209629/artclView.do)
  - 📎 [공문_붙임) 공문_붙임) 2026. 하반기 은평구민 장학생 선발 공고_합본.pdf](https://www.konkuk.ac.kr/bbs/konkuk/235/1228457/download.do)

### 동국대학교
상태: 🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀

### 동국대학교 WISE캠퍼스
상태: ✅ 정상 (실공고 4건 감지)

### 홍익대학교
상태: ✅ 정상 (실공고 8건 감지)
- [[은평구] 2026 하반기 은평구민 장학생 선발](https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=159140&noCat=501)

### 숙명여자대학교
상태: ✅ 정상 (실공고 9건 감지)

### 광운대학교
상태: ✅ 정상 (실공고 5건 감지)
- [[등록/장학] 2026년 하반기 은평구민 장학생 선발 안내](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53463&tpage=1&searchKey=1&searchVal=&srCategoryId=)
  - ⏰ 신청기간 : 2026. 10. 12.( 월 )~ 10. 28.(수 ) 까지 ​ 4. 신청 자격 1) 공통요건 : 공고일 현재 은평구에 2 년 이
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

### 아주대학교
상태: ✅ 정상 (실공고 12건 감지)

### 국민대학교
상태: ✅ 정상 (실공고 19건 감지)

### 숭실대학교
상태: ✅ 정상 (실공고 14건 감지)
- [장학 ★2026학년도 2학기 인송문화재단 장학생 추천 공고(~10/21수 14시)](https://scatch.ssu.ac.kr/%ea%b3%b5%ec%a7%80%ec%82%ac%ed%95%ad/?f&category=%EC%9E%A5%ED%95%99&paged=1&slug=%E2%98%852025%ED%95%99%EB%85%84%EB%8F%84-2%ED%95%99%EA%B8%B0-%EC%9D%B8%EC%86%A1%EB%AC%B8%ED%99%94%EC%9E%AC%EB%8B%A8-%EC%9E%A5%ED%95%99%EC%83%9D-%EC%B6%94%EC%B2%9C-%EA%B3%B5%EA%B3%A010-21%EC%88%98-14&keyword=%EC%9E%A5%ED%95%99)
  - ⏰ 제출기간: 2026.10.21.( 수 ) 14:00 까지 나. 제출방법: 학생지원팀 방문 또는 등기우편, 이메일 중 한 가지 방법을 선택하여 제
  - 📎 [붙임1-‘仁松-일반장학생’-선발-지원서_2026_2.hwp](https://scatch.ssu.ac.kr/download.php?data=1iZBAEYP01G24N2v6wVl9s5jGa0smQ8%2B8HVba1YhOwKiKp0Ym%2FP%2FpR0dBOZOTbHzGy%2BTusAioC15PqvrQTvbs%2FJ53ESB1aG%2FohV1KJ1UyC76Bwa1GmXVIhou9BXPTIuCpH4ovsfXTYRG84oREXTfWH9tSrDoCDYahUx28iywSvF4UQ550PLFa12v13XtWdC%2BuafyGScpNZsJh7yn6xTkQpm6Uv9OqIXenbFc3%2FXlZQQxmG50THsHvr09vhPic8%2FMMFNmRsVWNcfWQx1d7D6I9g%3D%3D)
  - 📎 [붙임2-개인정보-수집·이용-및-제3자-제공-동의서_숭실대학생지원팀.hwp](https://scatch.ssu.ac.kr/download.php?data=1iZBAEYP01G24N2v6wVl9s5jGa0smQ8%2B8HVba1YhOwKiKp0Ym%2FP%2FpR0dBOZOTbHzGy%2BTusAioC15PqvrQTvbsxksGztFUny3zIQy0HIBWjz3Fc8vDi4WWBT49EaL3I62KACoO5oFZPKib0pmDclx%2FuOsq6ugK1fcFzy%2F2Vo%2BkcUkSaAfMOVqHZ%2F9V53zYFwd2KZyzGuITiuG1ny0MnwntjmR0nyYKmwOnNkeratG94MCZc8Zgz5wS252RvLhRH3iQmcbT1HU0DTCHx0x%2FmINp3ItqHBFfqQwj%2FktQzKcR0x668n9UzNChFNT8XsJLRHRMPA1PiLyV2wyrKKIugZSJScdkUOtQyL3l4QyfXvF88c%3D)
- [장학 은평구민장학재단 2026 하반기 은평구민 장학생 선발 안내(~10/28수 18시)](https://scatch.ssu.ac.kr/%ea%b3%b5%ec%a7%80%ec%82%ac%ed%95%ad/?f&category=%EC%9E%A5%ED%95%99&paged=1&slug=%EC%9D%80%ED%8F%89%EA%B5%AC%EB%AF%BC%EC%9E%A5%ED%95%99%EC%9E%AC%EB%8B%A8-2026-%ED%95%98%EB%B0%98%EA%B8%B0-%EC%9D%80%ED%8F%89%EA%B5%AC%EB%AF%BC-%EC%9E%A5%ED%95%99%EC%83%9D-%EC%84%A0%EB%B0%9C-%EC%95%88&keyword=%EC%9E%A5%ED%95%99)
  - 📎 [【붙임】-2026.-하반기-은평구민-장학생-선발-공고_합본.pdf](https://scatch.ssu.ac.kr/download.php?data=1iZBAEYP01G24N2v6wVl9s5jGa0smQ8%2B8HVba1YhOwKiKp0Ym%2FP%2FpR0dBOZOTbHzGy%2BTusAioC15PqvrQTvbswvzmKGAq7FUDDBjE4daSxA%2FMgccg3eTDo%2BkzCGctw3HMGZ%2Bj9W%2BreTwmaAUB027kT4fvUq1uKrIO7O%2BpVO21xghwQ0HmF3M2bJ3tF1budbjUAYsj91mJfo7wEqm90IDrwcLwEsuzHEVHy2B7d894NZV2QEseJ7rsapE%2FkQpdotQydfYT9q56Dc9WpGRGxLJb1zBlebbipk8%2FEPqaQ0NjiXtNB%2BUUaEyjsR6XOp%2BBHlD)
  - 📎 [★붙임2-신청서-및-개인정보-수집-이용-제공-및-조회-동의서.hwp](https://scatch.ssu.ac.kr/download.php?data=1iZBAEYP01G24N2v6wVl9s5jGa0smQ8%2B8HVba1YhOwKiKp0Ym%2FP%2FpR0dBOZOTbHzGy%2BTusAioC15PqvrQTvbs2MTc2ZP2A0VCWohNh6WUBAnPKAKGivpTALV1PKC6HrbkeQxCjboEUKFb5NJpMYrWjwfluf5wG3aATjnKOomTrmlyqNUAglGpcRoZHsFQxHPCKlE9gBkaVzPbZJ9Ykld4FOv8EtaX62Bf0dFArubX6P0iRkVQdA%2BebmIiuBEJ5QWRfYt4uUOQl253FPthgVbTf%2F%2FtKbe59owFnbgPed12P%2B43p%2FNZNFXYdGzQ77LTpK2A9QegMpzwg38FX%2BD7D%2FTqg%3D%3D)

### 세종대학교
상태: ✅ 정상 (실공고 9건 감지)

### 이화여자대학교
상태: ✅ 정상 (실공고 10건 감지)
- [[학부] 2026 우양재단 동행장학금 신청 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367351&article.offset=0&articleLimit=10)
  - ⏰ 마감: 2026. 10. 18(일) * 신청요건: 4년제 대학생으로 학지금지원구간 2분위 이하인 학생이며 가족돌봄청년에 해당하는 자 * 장학금액
- [[학부] 2027년도 해동장학생 선발 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367347&article.offset=0&articleLimit=10)
  - 📎 [2027 해동장학생 신규지원(ㅇㅇ대,ㅇ학년,이름).hwp](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367347&attachNo=353475)
- [[학부] 2027년도 의생명과학분야 대학 장학생 선발 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367344&article.offset=0&articleLimit=10)
  - 📎 [별첨1 _2027년 의생명과학분야 대학 장학생 선발안내.pdf](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367344&attachNo=353473)
- [[학부] 2026. 은평구민장학재단 하반기 선발 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367337&article.offset=0&articleLimit=10)
  - ⏰ 신청 기간 : 2026년 10월 12일(월) ~ 10월 28일(수) 18:00까지 - 공통 자격 : 공고일 현재 주민등록 기준 은평구 2년 이상
  - 📎 [【붙임】 2026. 하반기 은평구민 장학생 선발 공고_합본.pdf](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367337&attachNo=353471)
- [[학부] 2027년도 대산농촌재단 장학생 선발 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367334&article.offset=0&articleLimit=10)
  - 📎 [[붙임2] 2027 대산장학생 선발요강.pdf](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=download&articleNo=367334&attachNo=353469)

### 인하대학교
상태: ✅ 정상 (실공고 45건 감지)
- [[학부-교외장학] 2026학년도 인송문화재단 장학생 선발 안내](https://www.inha.ac.kr/bbs/kr/8/45782/artclView.do)
  - ⏰ 제출 기한 : ~ 26. 10. 23. (금) 17:00 9. 제출처 : 인하대학교 학생회관 3층 343호 장학복지팀 오프라인 방문 제출 10.
  - 📎 [(서식) ‘仁松 일반장학생’ 선발 지원서_2026_2(공지용).hwp](https://www.inha.ac.kr/bbs/kr/8/41490/download.do)

### 부산대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — onestop.pusan.ac.kr 장학 공지 511건. 목록을 자바스크립트가 그리고 행이 href="#popup"이라 browser-targets.json이 담당한다)

### 가톨릭대학교
상태: ✅ 정상 (실공고 11건 감지)
- [[학생지원팀] (한국장학재단) 2026-2학기 국가근로장학금 추가신청기간 안내(10/21~10/29)](https://www.catholic.ac.kr/ko/campuslife/notice.do?mode=view&articleNo=276686&article.offset=0&articleLimit=10&srCategoryId=22)

### 한국항공대학교
상태: ✅ 정상 (실공고 52건 감지)

### 경기대학교
상태: ✅ 정상 (실공고 9건 감지)

### 서울과학기술대학교
상태: ✅ 정상 (실공고 58건 감지)
- [서울과학기술대학교 중소기업 취업연계 장학사업 (희망사다리Ⅰ유형) 신규장학생 자체선발 기준 안내](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896418&qidx=5233&cate=0&allboard=true&nowpage=1)
  - 📎 [2026년도 2학기 중소기업 취업연계 장학사업(희망사다리1유형) 신규장학생 자체선발기준.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=B8B54AB92C784540A3CD32E9802F619C_.pdf&ogrfname=2026%EB%85%84%EB%8F%84+2%ED%95%99%EA%B8%B0+%EC%A4%91%EC%86%8C%EA%B8%B0%EC%97%85+%EC%B7%A8%EC%97%85%EC%97%B0%EA%B3%84+%EC%9E%A5%ED%95%99%EC%82%AC%EC%97%85%28%ED%9D%AC%EB%A7%9D%EC%82%AC%EB%8B%A4%EB%A6%AC1%EC%9C%A0%ED%98%95%29+%EC%8B%A0%EA%B7%9C%EC%9E%A5%ED%95%99%EC%83%9D+%EC%9E%90%EC%B2%B4%EC%84%A0%EB%B0%9C%EA%B8%B0%EC%A4%80.pdf)
- [(홍보) 2026년 하반기 은평구민장학생 선발 안내(~10/28(수)까지)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896404&qidx=5233&cate=0&allboard=true&nowpage=1)
  - ⏰ 신청기간 : 2026. 10. 12.(월) ~ 10. 28.( 수 ) 18:00 까지 (주말,공휴일, 점심시간 제외 12:00~13:00) 4.
  - 📎 [【붙임】 2026. 하반기 은평구민 장학생 선발 공고_합본.pdf](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=68B2403633204E7D99E69758E8F5E193_.pdf&ogrfname=%E3%80%90%EB%B6%99%EC%9E%84%E3%80%91+2026.+%ED%95%98%EB%B0%98%EA%B8%B0+%EC%9D%80%ED%8F%89%EA%B5%AC%EB%AF%BC+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C+%EA%B3%B5%EA%B3%A0_%ED%95%A9%EB%B3%B8.pdf)
- [[신문방송사] 2026학년도 2학기 국가근로장학생 모집](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=57138&bidx=895378&qidx=57138&cate=0&allboard=true&nowpage=2)
  - ⏰ 모집기간 : ~ 2026. 9. 16.(수) 오후 1시 (서류심사 후 1차 선발예정자는 개별연락하여 면접 실시) 4. 업무 : 행정보조업무(서류
  - 📎 [(서식1)국가근로장학생 지원서 및 자기소개서.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=67F273CCE5AD4D8FBFC09832AA94BD21_.hwp&ogrfname=%28%EC%84%9C%EC%8B%9D1%29%EA%B5%AD%EA%B0%80%EA%B7%BC%EB%A1%9C%EC%9E%A5%ED%95%99%EC%83%9D+%EC%A7%80%EC%9B%90%EC%84%9C+%EB%B0%8F+%EC%9E%90%EA%B8%B0%EC%86%8C%EA%B0%9C%EC%84%9C.hwp)
  - 📎 [(서식2)근무가능시간표.xlsx](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F57138&fname=C22AFA950EBB4D10A70D788610D0D21A_.xlsx&ogrfname=%28%EC%84%9C%EC%8B%9D2%29%EA%B7%BC%EB%AC%B4%EA%B0%80%EB%8A%A5%EC%8B%9C%EA%B0%84%ED%91%9C.xlsx)
- [2026년 2학기 (재)인송문화재단 인송장학생 선발 안내(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=5233&bidx=895290&qidx=5233&cate=0&allboard=true&nowpage=2)
  - ⏰ 신청기간 : ~2026. 9. 23.(수)까지 6. 신청방법 : 통합정보시스템 ‘인송장학금’ 신청 7. 제출 서류 (모든 서류 필수 제출,
  - 📎 [(서식) ‘仁松 일반장학생’ 선발 지원서_2026_2.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=04CE45F082B543E1A7C9793AFF46A31B_.hwp&ogrfname=%28%EC%84%9C%EC%8B%9D%29+%E2%80%98%E4%BB%81%E6%9D%BE+%EC%9D%BC%EB%B0%98%EC%9E%A5%ED%95%99%EC%83%9D%E2%80%99+%EC%84%A0%EB%B0%9C+%EC%A7%80%EC%9B%90%EC%84%9C_2026_2.hwp)
- [(홍보) 재단법인 울산연구원 장학생 선발 공고(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=3&bnum=5233&bidx=894772&qidx=5233&cate=0&allboard=true&nowpage=3)
  - 📎 [2026년 하반기 장학생 선발계획 공고.hwp](https://www.seoultech.ac.kr/hcm/bbs/bbs_download.jsp?fpath=%2Fstorage%2Fwww%2Fbbs%2F5233&fname=0D39A91B2B6A4C2B893FF8A421E48735_.hwp&ogrfname=2026%EB%85%84+%ED%95%98%EB%B0%98%EA%B8%B0+%EC%9E%A5%ED%95%99%EC%83%9D+%EC%84%A0%EB%B0%9C%EA%B3%84%ED%9A%8D+%EA%B3%B5%EA%B3%A0.hwp)
- [(홍보) "희망사다리 장학생 대상" 2026년 중견기업 일자리 박람회 안내](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=3&bnum=5233&bidx=894770&qidx=5233&cate=0&allboard=true&nowpage=3)

### 계명대학교
상태: ⚙️ 게시판 주소 미설정 (주소는 확보했다(2026-08-02) — kmu.ac.kr 장학 공고 23건 보임. 상세 링크가 HTML에 없어 browser-targets.json이 담당한다)

### 서울교육대학교
상태: ✅ 정상 (실공고 14건 감지)

### 한국방송통신대학교
상태: ✅ 정상 (실공고 30건 감지)

### 경북대학교
상태: ✅ 정상 (실공고 5건 감지)

### 영남대학교
상태: ✅ 정상 (실공고 13건 감지)

### 전북대학교
상태: ✅ 정상 (실공고 10건 감지)

### 충남대학교
상태: ✅ 정상 (실공고 7건 감지)
- [[대산농촌재단] 2027년도 대산농촌재단 장학생 선발 안내](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515697&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=)
  - 📎 [[붙임2] 2027 대산장학생 선발요강.pdf](https://plus.cnu.ac.kr/_prog/_board/common/download.php?code=sub07_0713&ntt_no=2515697&atch_no=2)
- [[은평구민장학재단] 2026학년도 하반기 은평구민 장학생 선발 안내](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515692&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=)
  - ⏰ 신청기간: 2026. 10. 12.(월) ~ 2026. 10. 28.(수) 4. 신청자격 1) 공통요건: 공고일 기준(2026. 10. 8.)
  - 📎 [【붙임】 2026. 하반기 은평구민 장학생 선발 공고_합본-복사.pdf](https://plus.cnu.ac.kr/_prog/_board/common/download.php?code=sub07_0713&ntt_no=2515692&atch_no=1)
- [[충남대학교총동창회장학재단] 2026학년도 2학기 장학생 선발 계획 안내(발전기금)](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515690&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=)
  - ⏰ 신청기간: 2026. 10. 26.(월) ~ 2026. 11. 3.(화) 5. 신청방법: [붙임] 공고문 내 제출서류 구비 후, cnuaa@cn
  - 📎 [붙임. 충남대학교총동창회 장학생선발공고+신청서식.hwp](https://plus.cnu.ac.kr/_prog/_board/common/download.php?code=sub07_0713&ntt_no=2515690&atch_no=1)

### 전남대학교
상태: ✅ 정상 (실공고 17건 감지)

### 조선대학교
상태: ✅ 정상 (실공고 47건 감지)
- [2026-2학기 국가근로장학금 학생 추가신청 안내(한국장학재단)](https://www3.chosun.ac.kr/bbs/scho/332/281932/artclView.do)
  - ⏰ 신청기간 : 2026. 10. 21.( 수 ) 9:00 ~ 10. 29.( 목 ) 18:00 3. 신청자격 : 대한민국 국적자 중 본교 재학생으
  - 📎 [붙임1. 2026년 2학기 국가근로장학금 일반유형(추가) 학생신청 매뉴얼.pdf](https://www3.chosun.ac.kr/bbs/scho/332/379295/download.do)
- [2026-2학기 국가근로장학금 학생 추가신청 안내(한국장학재단)](https://www3.chosun.ac.kr/bbs/scho/332/281932/artclView.do)
  - ⏰ 신청기간 : 2026. 10. 21.( 수 ) 9:00 ~ 10. 29.( 목 ) 18:00 3. 신청자격 : 대한민국 국적자 중 본교 재학생으
  - 📎 [붙임1. 2026년 2학기 국가근로장학금 일반유형(추가) 학생신청 매뉴얼.pdf](https://www3.chosun.ac.kr/bbs/scho/332/379295/download.do)
- [2026-2학기 국가근로장학금 학생 추가신청 안내(한국장학재단)](https://www3.chosun.ac.kr/bbs/scho/332/281932/artclView.do)
  - ⏰ 신청기간 : 2026. 10. 21.( 수 ) 9:00 ~ 10. 29.( 목 ) 18:00 3. 신청자격 : 대한민국 국적자 중 본교 재학생으
  - 📎 [붙임1. 2026년 2학기 국가근로장학금 일반유형(추가) 학생신청 매뉴얼.pdf](https://www3.chosun.ac.kr/bbs/scho/332/379295/download.do)

### 충북대학교
상태: ✅ 정상 (실공고 5건 감지)
- [(재)은평구민장학재단 2026년 하반기 장학생 선발](https://www.cbnu.ac.kr/www/selectBbsNttView.do?key=815&bbsNo=8&nttNo=170617&pageUnit=10&searchCtgry=%ed%95%99%ec%82%ac%2f%ec%9e%a5%ed%95%99&searchCnd=all&pageIndex=1)
  - ⏰ 접수기간: 2026. 10. 12.(월) ~ 10. 28.(수), 18:00까지 바. 접수방법: 방문 및 등기우편 접수 사. 문의처: (재)은평

### 부경대학교
상태: ✅ 정상 (실공고 17건 감지)

### 강원대학교
상태: ✅ 정상 (실공고 10건 감지)

### 🎯 대외활동·공모전 새 글 6건 → 앱 '대외활동' 탭 (data/activities.json · 200건 게재 중)
- **성균관대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[인공지능 부트캠프] 2026학년도 2학기(1차) 인공지능 모델링/인공지능 하드웨어/인공지능 소프트웨어-하드웨어 융합 마이크로디그리 신청 안내 (10/19(월)~10/23(금))](https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140507&article.offset=0&articleLimit=10) — ⏰ 신청 기간 2026년 10월 19일(월) ~ 10월 23일(금) ■ 신청 방법 1. 인공지능 부트캠프 참여 신청 「인공지능(AI) 부트캠프 참가
  - [대외활동] [[인권센터] 2026 성균관대학교 제5회 인권세미나 개최 안내](https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140501&article.offset=0&articleLimit=10)
  - [대외활동] [(성균인성교육센터) 2026-2 성균인의 자기이해 <인성함양 실천 특별프로그램 [성균]> 참가자 모집](https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140500&article.offset=0&articleLimit=10)
- **홍익대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [2026-2 자율전공 러닝메이트 프로그램 멘토멘티 모집](https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=159145&noCat=501) — ⏰ 모집 기간 : 공고시~2026.10.18. (적격자 없을 시 공고 기한 연장함) 6. 신청 방법 : 아래 구글폼으로 작성 https://docs
- **광운대학교 (장학 게시판에서 발견)** — ✅
  - [대외활동] [[국제교류] 노르웨이 크리스티아니아응용과학대 교환학생 설명회(Åshild Mongstad교수님)](https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53464&tpage=1&searchKey=1&searchVal=&srCategoryId=)
- **한국외국어대학교 대외활동·공모전 「학생활동」** — ✅ 정상 (활동·공모전 11건 감지)
- **한국외국어대학교 대외활동·공모전 「진로·취업」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「취업/경력」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경희대학교 대외활동·공모전 「사회진출 프로그램 공지」** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **서울시 청년몽땅정보통 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **창업진흥원 K-Startup 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
  - [대외활동] [[대전창조경제혁신센터] 2026 대전 제조파트너스 매칭데이 참가자 모집](https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=179482) — ⏰ 접수기간 2026-10-08 ~ 2026-10-20 23:59 주관기관명 대전창조경제혁신센터 대상 전체 창업업력 전체 연락처 042-385-42
- **대한민국 정책브리핑 이벤트·공모 대외활동·공모전** — ✅ 정상 (활동·공모전 21건 감지)
- **경기청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)
- **KOICA 봉사단 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **국립국제교육원 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **문화포털 문화지원사업 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **서울문화포털 공모소식 대외활동·공모전** — ✅ 정상 (활동·공모전 10건 감지)
- **부산청년플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 1건 감지)
- **인천유스톡톡 청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 7건 감지)
- **대전청년포털 대외활동·공모전** — ✅ 정상 (활동·공모전 6건 감지)
- **울산청년정책플랫폼 U-PAGE 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **광주청년통합플랫폼 대외활동·공모전** — 🟡 접속은 되지만 활동·공모전 글을 찾지 못함 — 게시판 종류 확인 필요
- **경남청년정보플랫폼 대외활동·공모전** — ✅ 정상 (활동·공모전 3건 감지)
- **청년재단 대외활동·공모전** — ✅ 정상 (활동·공모전 2건 감지)

### 🏛 재단·지자체 새 공고 1건 → 홈 '재단·지자체 새 공고' (data/external.json · 45건 게재 중 · 게시판 아는 곳 19/76)
- **영동군민장학회** — ✅ 정상 (장학 공고 8건 감지)
- **(재)음성군장학회** — ✅ 정상 (장학 공고 6건 감지)
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
- **한국장학재단 공지** — ✅ 정상 (장학 공고 14건 감지)
  - [2026년 2학기 중소기업 취업연계 장학금(희망사다리Ⅰ유형) 신규장학생 보증보험 개인정보 제공동의 기간 사전 안내](https://www.kosaf.go.kr/ko/notice.do?mode=view&searchStr=&searchType=&page=1&ctgrId1=&ctgrId2=&seqNo=21376)
- **국립국제교육원 공지** — ✅ 정상 (장학 공고 2건 감지)
- **롯데장학재단** — 🟡 접속은 되지만 장학 공고를 찾지 못함 — 게시판이 맞는지 확인 필요
- **일주학술문화재단** — ⚠️ 오류 (TypeError: UND_ERR_CONNECT_TIMEOUT) — 주소 확인 필요

### 📄 목록 2페이지 이후에서 더 읽은 게시판
1페이지만 읽던 시절에는 상단 고정 공지에 밀린 실공고가 영영 안 잡혔습니다.
- 재단법인 삼원장학재단: 2페이지 더 읽어 17행 추가
- (재)송파구 인재육성 장학재단: 2페이지 더 읽어 24행 추가
- 관정이종환교육재단: 2페이지 더 읽어 17행 추가
- 아산사회복지재단: 2페이지 더 읽어 50행 추가
- 연세대학교: 2페이지 더 읽어 22행 추가
- 연세대학교 미래캠퍼스: 2페이지 더 읽어 32행 추가
- 가천대학교: 2페이지 더 읽어 417행 추가
- 인하대학교: 2페이지 더 읽어 44행 추가
- 한국항공대학교: 2페이지 더 읽어 194행 추가
- 서울과학기술대학교: 2페이지 더 읽어 182행 추가
- 한국방송통신대학교: 2페이지 더 읽어 30행 추가
- 조선대학교: 2페이지 더 읽어 38행 추가
- 한국외국어대학교 대외활동·공모전 「학생활동」: 2페이지 더 읽어 70행 추가
- 서울문화포털 공모소식 대외활동·공모전: 2페이지 더 읽어 60행 추가

📄 페이지 넘기기가 안 되는 게시판 75곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · `collector/activity-sources.json` · `collector/external-sources.json` · 발행: `data/notices.json` · `data/activities.json` · `data/external.json` · 로봇: `collector/collect.mjs`
**🧩 양식 원본 자동 확보 예약 2건** — 원본은 이 실행에서 바로 내려받고, 같은 실행의 무료 변환기가 앱 양식으로 옮겨요(못 옮긴 것은 리포트 '보류'에 남아요).

**⏳ 스키마화 대기 중 42건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 8건 등록

자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.

- `auto-amepagescholarshipnotice-07qwoc3` [[교외] 김의기 장학생 선발 안내(11/6 마감, 학업장려금 200만원)](https://www.sogang.ac.kr/ko/detail/551574?bbsConfigFk=141&namepage=ScholarshipNotice) · 마감 2026-11-06 · 서강대학교
- `auto-pnoticedoarticleno367351` [[학부] 2026 우양재단 동행장학금 신청 안내](https://www.ewha.ac.kr/ewha/bachelor/scholarship-notice.do?mode=view&articleNo=367351&article.offset=0&articleLimit=10) · 마감 2026-10-18 · 이화여자대학교
- `auto-leno276686srcategoryid22` [[학생지원팀] (한국장학재단) 2026-2학기 국가근로장학금 추가신청기간 안내(10/21~10/29)](https://www.catholic.ac.kr/ko/campuslife/notice.do?mode=view&articleNo=276686&article.offset=0&articleLimit=10&srCategoryId=22) · 마감 2026-10-29 · 가톨릭대학교
- `auto-418bnum5233cate0qidx5233` [서울과학기술대학교 중소기업 취업연계 장학사업 (희망사다리Ⅰ유형) 신규장학생 자체선발 기준 안내](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=5233&bidx=896418&qidx=5233&cate=0&allboard=true&nowpage=1) · 서울과학기술대학교
- `auto-772bnum5233cate0qidx5233` [(홍보) 재단법인 울산연구원 장학생 선발 공고(마감)](https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=3&bnum=5233&bidx=894772&qidx=5233&cate=0&allboard=true&nowpage=3) · 서울과학기술대학교
- `auto-0713no2515690sitedvscdkr` [[충남대학교총동창회장학재단] 2026학년도 2학기 장학생 선발 계획 안내(발전기금)](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515690&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=) · 마감 2026-11-03 · 충남대학교
- `auto-scho332281932artclviewdo` [2026-2학기 국가근로장학금 학생 추가신청 안내(한국장학재단)](https://www3.chosun.ac.kr/bbs/scho/332/281932/artclView.do) · 마감 2026-10-29 · 조선대학교
- `auto-0713no2515412sitedvscdkr` [2026년도 대전광역시 서구인재육성장학재단 장학생 선발 안내](https://plus.cnu.ac.kr/_prog/_board/?mode=V&no=2515412&code=sub07_0713&site_dvs_cd=kr&menu_dvs_cd=0713&skey=&sval=&site_dvs=&ntt_tag=&GotoPage=) · 충남대학교

**전국으로 승격 1건** — 다른 학교 게시판에 같은 사업이 올라와 한 학교 한정을 풀었어요(합치는 규칙은 관리자 합침과 같아요 · 근거는 항목의 scopeFrom).
- `auto-archgbn0searchordersort0-0i8hia4` (한국장학재단) 해양수산부 청년창업어업인장학생 추가 모집 선발 안내 ← 전남대학교 게시판 [[장학안내] [한국농어촌의망재단]2026년 2학기 해양수산부 청년창업어업](https://www.jnu.ac.kr/WebApp/web/HOM/COM/Board/board.aspx?boardID=5&bbsMode=view&page=1&key=70580&cate=8)

**컨펌 대기 (자동 기준 미달 181건)** — 장학 신호는 있지만 선발·모집 신호가 약하거나 등록 규칙에 걸렸어요(괄호에 이유):
- 장학 ★2026학년도 2학기 인송문화재단 장학생 추천 공고(~10/21수 14시) (타교 등록분과 동일 사업([서울][교외] 2026-2 인송문화재단 장) — 접수분 여부 컨펌 대기)
- [학부] 2027년도 해동장학생 선발 안내 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- [학부] 2027년도 의생명과학분야 대학 장학생 선발 안내 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- [학부] 2027년도 대산농촌재단 장학생 선발 안내 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- [학부-교외장학] 2026학년도 인송문화재단 장학생 선발 안내 (타교 등록분과 동일 사업([서울][교외] 2026-2 인송문화재단 장) — 접수분 여부 컨펌 대기)
- 2026년 2학기 (재)인송문화재단 인송장학생 선발 안내(마감) (타교 등록분과 동일 사업([서울][교외] 2026-2 인송문화재단 장) — 접수분 여부 컨펌 대기)
- [대산농촌재단] 2027년도 대산농촌재단 장학생 선발 안내 (2027년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기)
- 공통 2026년도 하반기 은평구민 장학생 선발 공고 (타교 등록분과 동일 사업(2026년 하반기 은평구민 장학생 선발 공고) — 접수분 여부 컨펌 대기)
- 공통 [한국장학재단] 학자금지원구간 개편(2027학년도 1학기부터 적용) (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- 공통 [공통] 2026학년도 교내 장학제도 개편안내 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- … 외 171건

컨펌 대기 이유별: 같은 사업의 지난 회차 53건 · 타교 등록분과 동일 사업 35건 · 내년도 사업 · 마감 모름 33건 · 선발·모집·신청 신호 없음 30건 · 내년도 사업 · 같은 사업으로 보이는 다른 글 24건 · 타교 등록분과 동일 사업[우양재단] 2026년 동행 장학생 모집 5건 · 내년도 사업 · 마감이 오늘~올해 밖 1건

⚠️ 차단 id 하나가 여러 공고에 걸림 — 주소(blockUrls)로만 막음: `auto-amepagescholarshipnotice` 22건

**거른 공고 351건 — 이유별**

- 이미 등록(원문 동일) · 100건
- 이미 등록(동일 사업) · 74건
- 이미 전국(동일 사업) · 27건
- 마감 경과 · 27건
- 마감 경과(등록 뒤 원문에서 확인) · 24건
- 행정 안내(신청 공고 아님) · 20건
- 이미 등록(동일 사업)논산시장학회 ) · 13건
- 행사·연수·설명회(신청형 장학 아님) · 12건
- 학자금 대출·융자(장학금 아님) · 12건
- '장학' 신호 없음 · 12건
- 이미 등록(동일 사업)포항시장학회) · 9건
- 국가장학금 상시 제도 — 앱 내 카드로 이미 안내 · 8건
- 이미 등록(동일 사업)춘천인재육성장학) · 4건
- 학부생 대상 아님(대학원 등) · 3건
- 이미 등록(동일 사업)) · 2건
- 이미 등록(동일 사업)대전청년내) · 1건
- 이미 등록(동일 사업) ) · 1건
- 이미 등록(동일 사업)인천인재평생교육진흥원) · 1건
- 이미 등록(동일 사업) 김해시미래인재장학재단 2026 ) · 1건

⏭ 한 실행 상한(8건)에 걸려 **102건은 보지 않았어요** — 다음 수집에서 이어서 봅니다.


### 🚨 양식 원본을 못 받고 있는 공고 10건 (3회 이상 시도)

자동으로는 더 못 가져옵니다. 첨부 주소가 바뀌었거나 로그인이 필요한 경우예요.
이 공고들은 앱에서 양식 작성이 안 되고 원본 다운로드 안내만 나갑니다.

- [교내] 2026-2학기 장애대학생 지원 도우미 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-08-17) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 제36기 미레에셋 해외교환 장학생 선발 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 서울 (재) 김해시미래인재장학재단 2026 장학생 선발 공고 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 2026년 하반기 문주장학재단 AI·ICT 분야 인재 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 [공통] 2026학년도 2학기 반영장학 신청 안내 — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 [공통] 2026학년도 2학기 점프장학 신청 안내_09.22(화)~10.9(금) — 6회 실패 (마지막 시도 2026-09-26) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 2026년도 하반기 (재)논산시장학회 학업장려 장학생 선발 안내 — 6회 실패 (마지막 시도 2026-09-30) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 「2026 상반기 AI·ICT 인재 장학생 모집」 안내(대상: 서울시 서초구에 주소지를 둔 — 6회 실패 (마지막 시도 2026-10-06) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- [교내-10/22] 2026학년도 2학기 대학봉사장학금 신청 안내 — 6회 실패 (마지막 시도 2026-10-06) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요
- 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금)~10.25(일) — 6회 실패 (마지막 시도 2026-10-06) · **자동 재시도 중단**(매일 시간만 버려서). 다시 받으려면 pending-forms.json에서 retired를 지우세요

### 🧩 양식 스키마화 — 무료 자동 0건 · API 0건 · 보류 79건

**보류 79건** — 자동 변환기가 원본과 같은 문서를 장담하지 못한 것들이에요. 원본 다운로드 안내는 그대로 유지됩니다.

- 2026-2학기 남가주동문회 장학금 신청공고.hwp (남가주동문장학회 장학생 선발) · 자동 변환 보류: 공고문·안내문 파일(채울 칸이 있는 서식 아님)
- (서식) 개인정보수집이용동의서.hwp (남가주동문장학회 장학생 선발) · 원본에 있는 항목이 빠짐 — 주소·연락처·이메일·평점·소득분위. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 장학생 협조사항 안내.pdf (미래의동반자재단 장학생 선발 (주한미국상공회의소)) · 자동 변환 보류: 옮길 항목을 찾지 못함
- 미래의동반자재단 장학금 신청서(학생용) 2026-2 골드만삭스.docx, 미래의동반자재단 장학금 신청서(학생용) 2026-2.docx (미래의동반자재단 장학생 선발 (주한미국상공회의소)) · 무료 변환이 원본 표를 옮기지 못함 — 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 외 1건. 원본 첨부 안내를 유지합니다(API 경로 대상)
- [다우기술]장학생 신청서 및 자기소개서 (4).hwp, (서식) 개인정보수집이용동의서.hwp ([글로벌][교외] 2026-2학기 다우기술 SW장학생 모집안내 () · 무료 변환이 원본 표를 옮기지 못함 — "성적증명서 1부" — 제출서류 목록의 한 줄이 질문이 됨. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 2026-2학기 라성 정형기재단 장학금 신청서.hwp ([글로벌][교외][일시지원] 2026-2학기 라성정형기 재단 장학) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 뽑힌 글자가 너무 적음 — 항목이 빠졌을 수 있음
- (서식) 개인정보수집이용동의서.hwp ([글로벌][교외][일시지원] 2026-2학기 라성정형기 재단 장학) · 원본에 있는 항목이 빠짐 — 주소·연락처·이메일·평점·소득분위. 원본 첨부 안내를 유지합니다(API 경로 대상)
- (서식)2026학년도 2학기 국가근로(추가모집) 지원서.hwp ([서울][국가근로] 2026학년도 2학기 국가근로장학생 모집 안내) · 유료 경로 꺼짐(schematize-config apiEnabled:false) — 뽑힌 글자가 너무 적음 — 항목이 빠졌을 수 있음
- 가. (별첨) 부모 명의 개인정보 제공 및 활용 동의서.pdf (제36기 미래에셋 해외교환 장학생 선발 안내) · 자동 변환 보류: 옮길 항목을 찾지 못함
- 2026년도 하반기 재단법인 논산시장학회 장학생 신청 서식.hwpx (제36기 미래에셋 해외교환 장학생 선발 안내) · 무료 변환이 원본 표를 옮기지 못함 — 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 · 선택지 ")" (질문: 동의 여부) — 부스러기 외 3건. 원본 첨부 안내를 유지합니다(API 경로 대상)
- 1.2026년 국가유산진흥원 전통 기ㆍ예능분야 및 매장유산 분야 우수 장학생 선발 공고.hwp (2026년도 국가유산진흥원 전통 기·예능 분야 및 매장유산 관련 ) · 자동 변환 보류: 공고문·안내문 파일(채울 칸이 있는 서식 아님)
- 2.[별첨1]장학생 지원신청서 및 자기소개서(양식).hwp (2026년도 국가유산진흥원 전통 기·예능 분야 및 매장유산 관련 ) · 자동 변환 보류: 옮길 항목을 찾지 못함

**건너뜀 23건**

- 가. (공고) 제36기 미래에셋 해외교환 장학생 선발 요강.pdf — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 2026년도 하반기 재단법인 논산시장학회 장학생 선발 공고문(발췌본).hwpx — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 3.[별첨2]장학생 후보자 추천서(양식).hwp — 제3자 작성 서식 — 원본 다운로드 안내 유지
- [붙임1] 2026년 하반기 장학생 선발계획 공고.pdf — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- (붙임1)2026-2학기 KNU-SOS 장학생 선발 계획 안내(2차).hwp chevron — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 1. 2026년도 세종이도인재장학금 장학생 선발계획 공고.pdf — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 2. 2026년도 세종이도인재장학금 장학생 선발계획 공고 붙임자료.pdf — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 첨부3. 장학생 추천서 양식_송화재단.xlsx — 제3자 작성 서식 — 원본 다운로드 안내 유지
- 첨부3. 장학생 추천서 양식_송화재단.xlsx — 제3자 작성 서식 — 원본 다운로드 안내 유지
- [붙임1] 2026년 동행장학 홍보 포스터.jpg — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 2026년든든학업지원금연장공고문.pdf — 학생이 채우는 신청서가 아님(공고문·안내문·요건서) — 원본 다운로드 안내 유지
- 첨부3. 장학생 추천서 양식_송화재단.xlsx — 제3자 작성 서식 — 원본 다운로드 안내 유지

### 📝 앱에서 바로 쓰는 양식 — 열린 공고 97건 중 1건

🚨 **양식이 붙은 열린 공고가 1건뿐이에요.** 나머지 공고는 학생이 원문 신청서를 내려받아 직접 채워야 해요. 유료 변환(collector/schematize-config.json 의 apiEnabled)은 지금 꺼져 있어요 — 켤지는 개발자가 정합니다.

- `auto-ent2431266737artclviewdo`

**같은 사업의 옛 양식 후보 3건** — 어떤 공고에도 안 붙은 양식 중 이름이 같은 사업으로 보이는 것이에요. 양식은 해마다 바뀔 수 있어 자동으로 잇지 않아요. 원문 신청서와 같은지 확인한 뒤에만 관리자 화면에서 잇습니다(formId).

- `auto-oardid321881menuno200318` 공통 2026년도 세종연구원 세종이도인재장학금 장학생 모집 안내 ↔ 양식 `sejong-ido-apply` 「세종연구원 장학금 지원 신청서 외 3종」 (이름 낱말 세종연구원)
- `auto-0005009002000000seq31571` [빅데이터혁신융합대학사업단] 2026학년도 2학기 성과형 장학금(자격증) ↔ 양식 `uos-bigdata-cert-apply` 「성과형 장학금(자격증) 신청서」 (이름 낱말 성과형·자격증)
- `auto-notiphpcodes1301seq10610` 세종연구원 2026년도 세종이도인재장학금 장학생 선발 안내 ↔ 양식 `sejong-ido-apply` 「세종연구원 장학금 지원 신청서 외 3종」 (이름 낱말 세종연구원)


### 🌐 범위 승격 (학교 한정 → 전국) — 0건
원문(접수 이메일 도메인·"재단에 직접 제출"·다른 학교의 같은 사업)이 전국 사업이라고 말하는 것만 풀었어요. 학교 창구(장학팀·포털)로 내는 것은 그 학교 한정이 맞아 그대로 둡니다.
- 이번 실행에서 원문 증거로 풀 수 있는 학교 한정 공고가 없었어요.
### 🏫 교내·교외 원문 판정 — 바뀐 것 0건 · 후보 3건 · 학교 제도 새로 배움 0건
판정 근거는 항목의 kindEvidence(원문 글자)에 남아요. 후보는 관리자 화면에서 구분을 바꿔 주세요 — 되돌리면 그 이름은 다시 배우지 않아요.
- 뒤집힌 판정 없음
- 후보 교외 → 교내? `auto-oardid323225menuno200318` 공통 [공통] 2026학년도 2학기 경희목련장학 신청 안내_10.02(금 — 제목의 학교 이름표 「경희」 · 접수처 「포털 인포21」
- 후보 교외 → 교내? `auto-2445viewdocurrentpageno1` 2026학년도 국민대학교 교수회 제자사랑장학금 신청 안내 — 제목의 학교 이름표 「국민대학교」
- 후보 교외 → 교내? `auto-jong659273457artclviewdo` [기금]2026학년도 2학기 고려대학교 세종 CPTA장학금 신청 안내 — 제목의 학교 이름표 「고려대」
### 🏛 학교 신청 시스템 후보 — 1개교 (아직 표에 없는 이름)
정식 등록 공고 원문에서 학교별 신청 시스템 이름을 모았어요. ✅ 는 그 학교에만 나오고 근거가 2건 이상인 이름이에요 — 확인하고 apply-channel.js 시스템 표에 넣어 주세요(주소는 정찰로 확인한 것만).
- **건국대학교** → 학사정보시스템 (1건) — 예: "★ 서울캠퍼스 학부생이 있는 경우 : 서울캠퍼스 학부생이 학사정보시스템에서 신청"