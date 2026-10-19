## 🔗 원문 링크 확인 리포트 (2026-10-20 01:58 KST · 기준일 2026-10-20)

앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.
🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").

⏰ 예산(20분)이 다 돼 여기서 멈췄습니다 — 남은 115건은 다음 실행이 이어서 봅니다. 📱 폰 표본은 예산이 모자라 25건을 못 봤습니다.

이번 실행: **285건** 열어 봄 · 공고 확인 252 · 문제로 보임 25 · 판정 못 함 8
앱에 알린 확정 문제(지금 실린 링크): **23건** · 이번에 새로 확정: **2건**

### 새로 확정된 문제 링크 (다른 날 두 번 같은 것을 봤습니다) — 2건
- [교내 소식] [신청] 26-2 (2~4학년) 대면 그룹 컨설팅/온라인 셀프 학습 컨설팅 프로그램 … — **다른 화면이 열림** (공고 화면이 아님(작성일·조회·첨부 표지가 없음))
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=894275&article.offset=0&articleLimit=10
- [실시간 공고] [한국장학재단] 2026년 2학기 국가장학금 신청자 가구원 동의 안내(~9/16(수까… — **게시판 목록이 열림** (제목은 보이나 다른 공고 제목이 여럿 함께 보임(목록))
  https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=5233&bidx=894871&qidx=5233&cate=0&allboard=true&nowpage=2

### 한 번 본 문제 (다른 날 한 번 더 보고 확정합니다 — 아직 앱 글자를 바꾸지 않습니다) — 2건
- [교내 소식] [생명윤리위원회] 연구자 교육 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.kmu.ac.kr/uni/main/page.jsp?pageNo=1&pagePrvNxt=1&pageRef=271444&pageOrder=0&cmd=2&parm_bod_uid=271443&srchVoteType=-1&srchEnable=1&srchBgpUid=-1&srchKeyword=&srchSDate=&srchColumn=&srchEDate=&mnu_uid=143& → 실제로 간 곳 https://www.kmu.ac.kr/uni/main/page.jsp?cmd=2&hasToken=1&srchEnable=1&srchKeyword=&srchSD…
- [교내 소식] 🔎 26년 가을학기 멘탈Check↗ 학생상담센터 '내 마음의 보고서' (매달참여가능) — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.korea.ac.kr/ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjElMkYwMDAwNjAwMDAwMDAwNjE0ODIlMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D

### 원문 후보 확인 — 찾아 온 주소가 그 공고·그 회차인지 학생처럼 열어 봤습니다
이번에 판정한 후보 **0건** · ✅ 원문으로 올림 0 · 🟡 사람 확인 0 · ❌ 맞지 않음 0 · ⏳ 못 엶(다시 봄) 0
앱에 실린 로봇 바로잡기(`data/link-check.json` fix): **12건** — 앱은 그 링크를 원문으로 엽니다(지금 링크가 이미 원문이면 바꾸지 않습니다).
_후보는 `collector/link-candidates.json` 에 적거나(사람·세션), 로봇이 우리 기록에서 찾습니다(같은 사이트·같은 제목의 글 주소 · 층2 재단 장학금과 짝지은 재단 게시판 글)._

#### ✅ 원문으로 올린 것 (이번 실행)
- 없음

#### 🟡 사람 확인을 기다리는 후보 (전체 4건) — 열어 보고 맞으면 관리자 화면 「원문 링크」에 넣어 주세요
- [층2 재단(바로잡은 원문)] 순천시인재육성장학회 성적우수장학금 — 회차를 가릴 날짜가 안 보임
  https://www.scij.kr/kr/sub_comm_01.do?mode=view&boardIdx=928 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 아산시미래장학회 우수봉사 장학금 — 제목이 제목 자리가 아니라 본문에만 보임
  https://asanmirae.or.kr:449/main/index.php?m_cd=32&b_id=20260714107548723 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 재단법인 석성장학회 석성장학생 — 회차를 가릴 날짜가 안 보임
  https://www.seoksung.co.kr/cms/bbs/board.php?bo_table=nanum&wr_id=522 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [실시간 공고] 일반공지 10/2(금) 교외장학재단 제출용 총장 직인 날인 불가 안내 신촌/국제 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.yonsei.ac.kr/bbs/sc/58/944246/artclView.do · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓

#### ❌ 맞지 않은 후보 (이번 실행)
- 없음

#### 확인했지만 지금은 앱에 싣지 않는 바로잡기
- [층2 재단(바로잡은 원문)] `2701009001` — 공고가 앱에서 내려감
  https://www.mariners.or.kr/business/view.php?bd_code=notice&bd_idx=7603
- [실시간 공고] `https://www.kookmin.ac.kr/user/kmuNews/notice/7/i…` — 공고가 앱에서 내려감
  https://www.kookmin.ac.kr/user/kmuNews/notice/7/12307/view.do?currentPageNo=1
- [실시간 공고] `https://www.snue.ac.kr/snue/na/ntt/selectNttList.…` — 공고가 앱에서 내려감
  https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54815
- [실시간 공고] `https://www.snue.ac.kr/snue/na/ntt/selectNttList.…` — 공고가 앱에서 내려감
  https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54775
- [실시간 공고] `https://www.snue.ac.kr/snue/na/ntt/selectNttList.…` — 공고가 앱에서 내려감
  https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54747
- [실시간 공고] `https://www.snue.ac.kr/snue/na/ntt/selectNttList.…` — 공고가 앱에서 내려감
  https://www.snue.ac.kr/snue/na/ntt/selectNttInfo.do?mi=3004&bbsId=1083&nttSn=54793

### 우리를 막는 것으로 보이는 사이트 (이번 결과를 "판정 못 함"으로 돌렸습니다)
- 없음

### 판정 못 한 링크 (이번 실행 · 사이트별 · 문제로 세지 않습니다)
- www.hongik.ac.kr — 4건 · 가장 많은 이유: 본문이 안 그려짐(0자 — 판정 불가) (3건)
- www.jnu.ac.kr — 1건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded.
- www.yonsei.ac.kr — 1건 · 가장 많은 이유: 본문이 안 그려짐(13자 — 판정 불가)
- www.hanyang.ac.kr — 1건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded.
- www.gachon.ac.kr — 1건 · 가장 많은 이유: 다른 글로 보이나 기대 제목이 앱 이름뿐(판정 보류)

### 전체 현황 (앱에 실린 링크 × 지금까지 본 결과)
| 묶음 | 아직 안 봄 | 공고 확인 | 판정 못 함 | 한 번 봄 | 목록 | 첫 화면 | 로그인 | 안 열림 | 다른 화면 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 정식 등록 | 0 | 219 | 10 | 0 | 0 | 0 | 0 | 1 | 0 |
| 실시간 공고 | 0 | 872 | 49 | 0 | 2 | 0 | 0 | 4 | 0 |
| 재단·지자체 | 0 | 47 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 대외활동·공모전 | 0 | 135 | 17 | 0 | 0 | 1 | 2 | 1 | 5 |
| 교내 소식 | 31 | 1065 | 45 | 2 | 0 | 0 | 0 | 3 | 4 |
| 층2 재단(바로잡은 원문) | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

_한 링크가 두 묶음에 함께 실려 있으면 양쪽에 셉니다. 「한 번 봄」은 다른 날 한 번 더 같은 것을 보면 확정됩니다._

### 확정된 문제 전체 (앱이 받는 파일에 적힌 것) — 23건
- [대외활동·공모전] [국토교통부] 제6회 그린리모델링 챌린지 공모전 — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://2026grchallenge.com/
- [대외활동·공모전] [행정안전부] 2026 재난안전 분야 논문 공모전 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://blog.naver.com/mopaspr/224399694473?trackingCode=blog_bloghome_searchlist → 실제로 간 곳 https://blog.naver.com/mopaspr/224399694473?
- [대외활동·공모전] [해양수산부] 제1회 대한민국 국가어항·어촌 사진공모전 — **다른 화면이 열림** (공고 화면이 아님(작성일·조회·첨부 표지가 없음))
  https://naraport.mof.go.kr/info/contest/contestIntroduce.do?subMenu1Nm=%EA%B3%B5%EB%AA%A8%EC%A0%84
- [대외활동·공모전] [국무조정실] 2026 청년정책 공모전 요즘 청년에게 필요한 정책, 정답은 청년이 아… — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://nysc.or.kr/nysc/pages/notice_view.php?id=288 → 실제로 간 곳 https://nysc.or.kr/nysc/pages/notice_view.php?id=288&ckattempt=1
- [대외활동·공모전] [과학기술정보통신부] 생활 속 전자파 바로 알기 동영상 및 포스터 공모전 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.msit.go.kr/bbs/view.do?sCode=user&mId=307&mPid=208&bbsSeqNo=94&nttSeqNo=3187433
- [대외활동·공모전] api-youthPolicy-20260326005400212290 · 2026년 평택시 청년창업도전 아카데미 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.pyeongtaek.go.kr/pyeongtaek/board/post/view.do?idx=344708&bcIdx=41&mid=0401010000
- [대외활동·공모전] [스포츠재활 연구실] 만성 발목 불안정성 대상 감각-인지 기반 발목 재활운동 연구 참… — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.skku.edu/skku/campus/skk_comm/notice06.do?mode=view&articleNo=140267&article.offset=0&articleLimit=10
- [대외활동·공모전] api-youthPolicy-20260410005400212677 · 청년 생명사랑 서포터즈 운영 — **사이트 첫 화면이 열림** (사이트 첫 화면(제목이 안 보임))
  https://www.usspc.or.kr/
- [대외활동·공모전] [농림축산식품부] 대국민 농촌관광 홍보영상 경진대회 — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://www.welchon.com/web/lay1/program/S1T31C447/eventNewView.do?menuIdx=&cIdx=evpr&bbsIdx=2214028
- [재단·지자체] 후원신청 지역발전은 지역장학생 후원에서 시작됩니다. [전북은행] 520-13-0354… — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://www.jinjae.kr/main/?gc=877EUFQ
- [교내 소식] [생활협동조합] 백록관식당 주간식단표(2026.10.05.~09) — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.kangwon.ac.kr/ko/bbs/504/detail.do?pstSn=11495&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0
- [교내 소식] [에너지환경대학원(그린스쿨)] 2027학년도 전기 신입생 모집 안내 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.korea.ac.kr/ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjElMkYwMDAwNjAwMDAwMDAwNjExODYlMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D
- [교내 소식] 2026학년도 학부교육실태조사(K-NSSE) 참여 안내(10월 7일까지 연장 / 기프… — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=892640&article.offset=0&articleLimit=10
- [교내 소식] 2027-1학기 교수초빙(9월공고_정년제 전임교원) 안내 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=893444&article.offset=0&articleLimit=10
- [교내 소식] 학술정보원 이용자 만족도 조사 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=894138&article.offset=0&articleLimit=10
- [교내 소식] [신청] 26-2 (2~4학년) 대면 그룹 컨설팅/온라인 셀프 학습 컨설팅 프로그램 … — **다른 화면이 열림** (공고 화면이 아님(작성일·조회·첨부 표지가 없음))
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=894275&article.offset=0&articleLimit=10
- [교내 소식] 2027학년도 전기 일반대학원 신·편입생 모집 안내 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.sookmyung.ac.kr/kr/news/important-notice.do?mode=view&articleNo=95279&article.offset=0&articleLimit=10
- [실시간 공고] [홍보] 2026년 대전청년내일재단 하반기 인재육성(성취) 장학생 선발 안내(기간 연… — **게시판 목록이 열림** (다른 공고 제목만 여럿 보임(목록))
  https://www.dongguk.edu/article/JANGHAKNOTICE/list?pageNo=2#none
- [실시간 공고] 2026-2학기 윤영문화재단 신규장학생 선발(1인당 200만원/~10.11(일)까지) — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766512
- [실시간 공고] 2026-2학기 DHC(Dongguk Honors Club) 후배사랑 장학생 신청 안… — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766513
- [실시간 공고] 2026학년도 2학기 동진나눔복지재단 장학생 선발(~10/23(금)까지) — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766521
- [실시간 공고] [한국장학재단] 2026년 2학기 국가장학금 신청자 가구원 동의 안내(~9/16(수까… — **게시판 목록이 열림** (제목은 보이나 다른 공고 제목이 여럿 함께 보임(목록))
  https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=2&bnum=5233&bidx=894871&qidx=5233&cate=0&allboard=true&nowpage=2
- [정식 등록·실시간 공고] auto-larshipdoarticleno377067 · [국가근로] 2026학년도 2학기 국가근로장학생 추가 모집 안내(교수학습개발센터) — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=view&articleNo=377067&article.offset=0&articleLimit=10

### 열어 보지 않은 것 (세기만 했습니다)
- 게시판 목록 표식(#n-): 교내 소식 1 — 원문 주소를 아직 못 찾은 글이라 앱이 이미 "게시판 목록"이라고 부릅니다
- 층2(한국장학재단에 등록된 재단 장학금): 122건 — 재단 홈페이지 주소뿐이라 앱이 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 94건) · 바로잡은 원문이 있어 연 것 3건은 따로
- 마감이 지나 앱이 더는 보여 주지 않는 대외활동: 36건
- 숨긴 글: 6건
- 이번 순서에 들었지만 시간이 모자라 못 본 것: 115건 (다음 실행이 이어서 봅니다)
- 앱에 실린 링크 2364건 중 이번 순서에 든 것 400건 (사이트마다 최대 8건 · 학교 서버를 몰아치지 않으려고)
