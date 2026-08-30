## 🤖 장학공고 수집 리포트 (2026-08-30)

새로 발견한 공고: **0건** — 앱의 '실시간 공고'에는 즉시 표시되며(링크 연결만), 맞춤 매칭·양식 작성 지원 등록은 아래에서 컨펌해 주세요.

> 컨펌 방법: 채팅에 "이슈 #N에서 ○○ 정식 등록해줘"라고 말씀해 주시면 자격요건·금액·마감일·첨부 양식을 스키마로 정리해 등록합니다.

### 경희대학교
상태: 🟡 접속은 되지만 실공고를 찾지 못함 — 공지 목록 페이지인지 확인 필요

### 한국외국어대학교
상태: ✅ 정상 (실공고 14건 감지)

📄 페이지 넘기기가 안 되는 게시판 40곳 (14일 뒤 다시 시도합니다)

---
⚙️ 설정: `collector/schools.json` · 발행: `data/notices.json` · 로봇: `collector/collect.mjs`
**🧩 양식 원본 자동 확보 예약 2건** — 원본은 이 실행에서 바로 내려받고, 스키마화(앱 내 작성 전환)는 다음 Claude 세션이 처리해요.

**⏳ 스키마화 대기 중 51건** (원본 확보됨 — collector/pending-forms.json)

### 🤖 자동 등록 (선조치후보고) — 8건 등록

등록 대상 학교: 경희대학교 · 한국외국어대학교 (설정 `schools`) — 다른 학교 공고 467건은 등록하지 않고 실시간 피드로만 나갔어요.

자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.

- `auto-84a0ebb09c20ec9588eb82b4` [공통 2026년도 익산사랑 장학생 선발 안내](https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318#n-%EA%B3%B5%ED%86%B5%202026%EB%85%84%EB%8F%84%20%EC%9D%B5%EC%82%B0%EC%82%AC%EB%9E%91%20%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%84%A0%EB%B0%9C%20%EC%95%88%EB%82%B4) · 경희대학교
- `auto-ent2431264135artclviewdo` [[서울][국가근로] 2026학년도 2학기 국가근로장학생 모집 안내(추가)](https://dep.hufs.ac.kr/bbs/student/2431/264135/artclView.do) · 한국외국어대학교
- `auto-ent2431264146artclviewdo` [[공통][국가]2026-2 중소기업취업연계장학금 신규장학생 신청안내(~9/18)](https://dep.hufs.ac.kr/bbs/student/2431/264146/artclView.do) · 마감 2026-09-18 · 한국외국어대학교
- `auto-cb2ad20ec9588eb82b482f26` [공통 2026-2학기 푸른등대 기부장학금 신규장학생 신청 안내(8/26~9/10)](https://news.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318#n-%EA%B3%B5%ED%86%B5%202026-2%ED%95%99%EA%B8%B0%20%ED%91%B8%EB%A5%B8%EB%93%B1%EB%8C%80%20%EA%B8%B0%EB%B6%80%EC%9E%A5%ED%95%99%EA%B8%88%20%EC%8B%A0%EA%B7%9C%EC%9E%A5%ED%95%99%EC%83%9D%20%EC%8B%A0%EC%B2%AD%20%EC%95%88%EB%82%B4(8%2F26~) · 마감 2026-09-10 · 경희대학교
- `auto-ent2431263952artclviewdo` [[공통][국가]2026년 2학기 고졸 후학습자 장학금 신청안내](https://dep.hufs.ac.kr/bbs/student/2431/263952/artclView.do) · 한국외국어대학교
- `auto-ent2431263956artclviewdo` [[공통][교외]2026년 하반기 울산연구원 장학생 선발공고](https://dep.hufs.ac.kr/bbs/student/2431/263956/artclView.do) · 한국외국어대학교
- `auto-oardid322850menuno200318` [공통 2026년 2학기 제24기 후기 삼원장학생 선발 안내](https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=322850) · 경희대학교
- `auto-oardid321881menuno200318` [공통 2026년도 세종연구원 세종이도인재장학금 장학생 모집 안내](https://news.khu.ac.kr/kor/user/bbs/BMSR00040/view.do?menuNo=200318&boardId=321881) · 경희대학교

**컨펌 대기 (자동 기준 미달 2건)** — 장학 신호는 있지만 선발·모집 신호가 약해요:
- [공통][국가] 장학금 부정청구 자진신고 안내 새글 (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
- 공통 2026년 장학금 부정수급 자진신고 캠페인 안내(2026.8.10.(월) ~ 10.9.(금)) (선발·모집·신청 신호 없음 — 개발자 컨펌 대기)
