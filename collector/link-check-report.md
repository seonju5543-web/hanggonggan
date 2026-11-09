## 🔗 원문 링크 확인 리포트 (2026-11-10 05:28 KST · 기준일 2026-11-10)

앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.
🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").

⏰ 예산(20분)이 다 돼 여기서 멈췄습니다 — 남은 130건은 다음 실행이 이어서 봅니다. 📱 폰 표본은 예산이 모자라 25건을 못 봤습니다.

이번 실행: **270건** 열어 봄 · 공고 확인 217 · 문제로 보임 21 · 판정 못 함 32
앱에 알린 확정 문제(지금 실린 링크): **27건** · 이번에 새로 확정: **0건**

### 새로 확정된 문제 링크 (다른 날 두 번 같은 것을 봤습니다) — 0건
- 없음

### 한 번 본 문제 (다른 날 한 번 더 보고 확정합니다 — 아직 앱 글자를 바꾸지 않습니다) — 1건
- [교내 소식] 2027학년도 예비대학(입학전교육) 신청 안내 — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://snuc.snu.ac.kr/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/?mod=document&uid=943

### 원문 후보 확인 — 찾아 온 주소가 그 공고·그 회차인지 학생처럼 열어 봤습니다
이번에 판정한 후보 **0건** · ✅ 원문으로 올림 0 · 🟡 사람 확인 0 · ❌ 맞지 않음 0 · ⏳ 못 엶(다시 봄) 0
앱에 실린 로봇 바로잡기(`data/link-check.json` fix): **4건** — 앱은 그 링크를 원문으로 엽니다(지금 링크가 이미 원문이면 바꾸지 않습니다).
_후보는 `collector/link-candidates.json` 에 적거나(사람·세션), 로봇이 우리 기록에서 찾습니다(같은 사이트·같은 제목의 글 주소 · 층2 재단 장학금과 짝지은 재단 게시판 글)._

#### ✅ 원문으로 올린 것 (이번 실행)
- 없음

#### 🟡 사람 확인을 기다리는 후보 (전체 6건) — 열어 보고 맞으면 관리자 화면 「원문 링크」에 넣어 주세요
- [층2 재단(바로잡은 원문)] 아산시미래장학회 우수봉사 장학금 — 제목이 제목 자리가 아니라 본문에만 보임
  https://asanmirae.or.kr:449/main/index.php?m_cd=32&b_id=20260714107548723 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 강진의료원 전남 공공 취약지 간호사 장학생 — 제목이 제목 자리가 아니라 본문에만 보임
  https://gjmed.or.kr/bbs/board.php?bo_table=notice3&wr_id=516 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 강진의료원 전남 공공 취약지 간호사 장학생 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.gjmed.or.kr/bbs/board.php?bo_table=notice3&wr_id=516 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 재단법인 석성장학회 석성장학생 — 회차를 가릴 날짜가 안 보임
  https://www.seoksung.co.kr/cms/bbs/board.php?bo_table=nanum&wr_id=522 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [실시간 공고] [기금-10/8] 2026학년도 2학기 푸른솔 사회정의 장학금 신청 안내 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.korea.ac.kr/ko/568/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjMlMkYwMDAxMDAwMDAwMDAwMDM4NjElMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓
- [실시간 공고] 일반공지 10/2(금) 교외장학재단 제출용 총장 직인 날인 불가 안내 신촌/국제 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.yonsei.ac.kr/bbs/sc/58/944246/artclView.do · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓

#### ❌ 맞지 않은 후보 (이번 실행)
- 없음

#### ⚠️ 후보 파일(collector/link-candidates.json)에서 쓰지 못한 줄
- 교내 소식 `경희대학교|국제 [교수학습개발원] 국제C 학부생을 위한 학습컨설팅 신청 안내(10월)`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [교수학습개발원] AI시대 대학생의 학습 경험과 인식 설문조사 참여 안내`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [INVENI] 대표이사 비서 정규직 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|국제 [(주)라엘코리아] 해외영업(일본) 전환형 인턴 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [피보탈시스템즈코리아(주)] 반도체 엔지니어&오퍼레이터 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [새솔다이아몬드공업(주)] 해외영업(중국), 해외영업(미국) 부문 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)

#### 확인했지만 지금은 앱에 싣지 않는 바로잡기
- [층2 재단(바로잡은 원문)] `2701009001` — 공고가 앱에서 내려감
  https://www.mariners.or.kr/business/view.php?bd_code=notice&bd_idx=7603
- [층2 재단(바로잡은 원문)] `2704211001` — 공고가 앱에서 내려감
  https://myungfoundation.or.kr/modules/bbs/bbsView.php?id=28&page=1&&code=bbs_notice&xid=1

### 우리를 막는 것으로 보이는 사이트 (이번 결과를 "판정 못 함"으로 돌렸습니다)
- 없음

### 판정 못 한 링크 (이번 실행 · 사이트별 · 문제로 세지 않습니다)
- www.hongik.ac.kr — 8건 · 가장 많은 이유: 본문이 안 그려짐(179자 — 판정 불가) (5건)
- www.cbnu.ac.kr — 5건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded. (5건)
- www.kmu.ac.kr — 4건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded. (2건)
- www.kangwon.ac.kr — 4건 · 가장 많은 이유: 열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at http… (4건)
- www.ajou.ac.kr — 3건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded. (3건)
- www.hanyang.ac.kr — 3건 · 가장 많은 이유: HTTP 403 (3건)
- www.dsa.or.kr — 2건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded. (2건)
- www.jnu.ac.kr — 1건 · 가장 많은 이유: 열기 실패: page.goto: Timeout 20000ms exceeded.
- kangwon.ac.kr — 1건 · 가장 많은 이유: 열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at http…
- www.hufs.ac.kr — 1건 · 가장 많은 이유: 본문이 안 그려짐(18자 — 판정 불가)

### 전체 현황 (앱에 실린 링크 × 지금까지 본 결과)
| 묶음 | 아직 안 봄 | 공고 확인 | 판정 못 함 | 한 번 봄 | 목록 | 첫 화면 | 로그인 | 안 열림 | 다른 화면 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 정식 등록 | 0 | 320 | 13 | 0 | 0 | 0 | 0 | 1 | 0 |
| 실시간 공고 | 0 | 1231 | 83 | 0 | 1 | 0 | 0 | 4 | 0 |
| 재단·지자체 | 0 | 53 | 9 | 0 | 0 | 1 | 1 | 0 | 0 |
| 대외활동·공모전 | 0 | 148 | 9 | 0 | 0 | 1 | 0 | 0 | 5 |
| 교내 소식 | 13 | 1120 | 79 | 1 | 0 | 2 | 0 | 3 | 9 |
| 층2 재단(바로잡은 원문) | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

_한 링크가 두 묶음에 함께 실려 있으면 양쪽에 셉니다. 「한 번 봄」은 다른 날 한 번 더 같은 것을 보면 확정됩니다._

### 확정된 문제 전체 (앱이 받는 파일에 적힌 것) — 27건
- [대외활동·공모전] [식품의약품안전처] 식품의약품안전처 누리소통기자단 15기 모집 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://blog.naver.com/kfdazzang/224463652864
- [대외활동·공모전] [국무조정실] 2026 청년정책 공모전 요즘 청년에게 필요한 정책, 정답은 청년이 아… — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://nysc.or.kr/nysc/pages/notice_view.php?id=288 → 실제로 간 곳 https://nysc.or.kr/nysc/pages/notice_view.php?id=288&ckattempt=1
- [대외활동·공모전] [한국도로공사] 한국도로공사 AI 활용 아이디어 공모전 국민의 상상, AI를 타고 달… — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.epeople.go.kr/idea/ex/1AE-2610-0000546/detail.npaid
- [대외활동·공모전] [산업통산부] 5극3특 AI영상 공모전 성장엔진 미래지도 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.motir.go.kr/kor/article/ATCL8764a1224/155119233/view
- [대외활동·공모전] api-youthPolicy-20260326005400212290 · 2026년 평택시 청년창업도전 아카데미 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.pyeongtaek.go.kr/pyeongtaek/board/post/view.do?idx=344708&bcIdx=41&mid=0401010000
- [대외활동·공모전] api-youthPolicy-20260410005400212677 · 청년 생명사랑 서포터즈 운영 — **사이트 첫 화면이 열림** (사이트 첫 화면(제목이 안 보임))
  https://www.usspc.or.kr/
- [재단·지자체] 후원신청 지역발전은 지역장학생 후원에서 시작됩니다. [전북은행] 520-13-0354… — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://www.jinjae.kr/main/?gc=877EUFQ
- [재단·지자체] 대학등록금은 국가장학금으로! 국가장학금 신청 — **사이트 첫 화면이 열림** (사이트 첫 화면(제목이 안 보임))
  https://www.kosaf.go.kr/ko/main.do
- [교내 소식] [2026학년도 동계] 겨울 계절학기 실시 안내 — **열리지 않음(없는 주소)** (알림창 「삭제된 게시물입니다.」)
  https://kau.ac.kr/kaulife/notice.php?code=s1101&page=&mode=read&seq=11401 → 실제로 간 곳 about:blank
- [교내 소식] [학생지원팀] 2026학년도 2학기 동계방학 집중근로 희망근로지 신청 안내 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.catholic.ac.kr/ko/campuslife/notice.do?mode=view&articleNo=277033&article.offset=0&articleLimit=10
- [교내 소식] [카운슬링센터][집단상담 홍보]심리극으로 알아보는 나의 연애와 관계, "연애할때 나는… — **사이트 첫 화면이 열림** (사이트 첫 화면으로 돌려보내짐)
  https://www.dongguk.edu/article/GENERALNOTICES/detail/26766573 → 실제로 간 곳 https://www.dongguk.edu/main
- [교내 소식] 예술대학장 양윤호 감독 「삼춘, 어디 감수광?」 동국인 특별 시사회(11.4.(수),… — **사이트 첫 화면이 열림** (사이트 첫 화면으로 돌려보내짐)
  https://www.dongguk.edu/article/GENERALNOTICES/detail/26766596 → 실제로 간 곳 https://www.dongguk.edu/main
- [교내 소식] [이화인의 나눔가게] 할인 이벤트! — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.ewha.ac.kr/ewha/news/notice.do?mode=view&articleNo=367718&article.offset=0&articleLimit=10&no=343
- [교내 소식] [총무팀] 육아휴직 대체자 채용 공고 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.inha.ac.kr/bbs/kr/8/46024/artclView.do
- [교내 소식] [매주 수요일은 후원의 집 가는 날] 안내드립니다. — **다른 화면이 열림** (열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at https://www.ka…)
  https://www.kangwon.ac.kr/ko/bbs/504/detail.do?pstSn=11581&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0
- [교내 소식] 보건실 휴무 안내(2026.10.29.) — **다른 화면이 열림** (열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at https://www.ka…)
  https://www.kangwon.ac.kr/ko/bbs/504/detail.do?pstSn=11585&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0
- [교내 소식] [생명윤리위원회] 연구자 교육 — **다른 화면이 열림** (글 표지도 제목도 없음(판정 불가))
  https://www.kmu.ac.kr/uni/main/page.jsp?pageNo=1&pagePrvNxt=1&pageRef=271444&pageOrder=0&cmd=2&parm_bod_uid=271443&srchVoteType=-1&srchEnable=1&srchBgpUid=-1&srchKeyword=&srchSDate=&srchColumn=&srchEDate=&mnu_uid=143&
- [교내 소식] [국제처] 2026 동계 KNU in the World Pro... — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.pusan.ac.kr/kor/CMS/Board/Board.do?mCode=MN095&mode=view&mgr_seq=3&board_seq=1511959
- [교내 소식] 세종대학교 정규직 채용 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=894982&article.offset=0&articleLimit=10
- [교내 소식] 2026 교양대학 연속강좌 3강 (11/3 화) — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.seoultech.ac.kr/service/info/notice/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=4691&bidx=896780&qidx=4691&cate=10&allboard=false&nowpage=1
- [교내 소식] 일반공지 PHP 취약점 조치 안내 신촌/국제 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.yonsei.ac.kr/bbs/sc/58/944452/artclView.do
- [교내 소식] 제26회 윤동주 시문학상 모집 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.yonsei.ac.kr/bbs/sc/58/944542/artclView.do
- [실시간 공고] [홍보] 2026년 대전청년내일재단 하반기 인재육성(성취) 장학생 선발 안내(기간 연… — **게시판 목록이 열림** (다른 공고 제목만 여럿 보임(목록))
  https://www.dongguk.edu/article/JANGHAKNOTICE/list?pageNo=2#none
- [실시간 공고] 2026-2학기 윤영문화재단 신규장학생 선발(1인당 200만원/~10.11(일)까지) — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766512
- [실시간 공고] 2026-2학기 DHC(Dongguk Honors Club) 후배사랑 장학생 신청 안… — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766513
- [실시간 공고] 2026학년도 2학기 동진나눔복지재단 장학생 선발(~10/23(금)까지) — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.dongguk.edu/article/JANGHAKNOTICE/view?pageNo=2&nttId=26766521
- [정식 등록·실시간 공고] auto-larshipdoarticleno377067 · [국가근로] 2026학년도 2학기 국가근로장학생 추가 모집 안내(교수학습개발센터) — **열리지 않음(없는 주소)** (열기 실패: page.goto: Timeout 20000ms exceeded.)
  https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=view&articleNo=377067&article.offset=0&articleLimit=10

### 열어 보지 않은 것 (세기만 했습니다)
- 게시판 목록 표식(#n-): 없음 — 원문 주소를 아직 못 찾은 글이라 앱이 이미 "게시판 목록"이라고 부릅니다
- 층2(한국장학재단에 등록된 재단 장학금): 86건 — 재단 홈페이지 주소뿐이라 앱이 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 72건) · 바로잡은 원문이 있어 연 것 1건은 따로
- 마감이 지나 앱이 더는 보여 주지 않는 대외활동: 37건
- 이번 순서에 들었지만 시간이 모자라 못 본 것: 130건 (다음 실행이 이어서 봅니다)
- 앱에 실린 링크 2854건 중 이번 순서에 든 것 400건 (사이트마다 최대 8건 · 학교 서버를 몰아치지 않으려고)
