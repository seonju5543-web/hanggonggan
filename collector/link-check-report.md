## 🔗 원문 링크 확인 리포트 (2026-11-21 02:07 KST · 기준일 2026-11-21)

앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.
🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").

_이번 실행은 **원문 후보만** 확인했습니다(후보 파일을 고쳐 push 한 실행 · 앱의 링크는 매일 저녁 실행이 봅니다)._

이번 실행: **0건** 열어 봄 · 공고 확인 0 · 문제로 보임 0 · 판정 못 함 0
앱에 알린 확정 문제(지금 실린 링크): **24건** · 이번에 새로 확정: **0건**

### 새로 확정된 문제 링크 (다른 날 두 번 같은 것을 봤습니다) — 0건
- 없음

### 한 번 본 문제 (다른 날 한 번 더 보고 확정합니다 — 아직 앱 글자를 바꾸지 않습니다) — 1건
- [대외활동·공모전] act-1nf7uh4 · [농림축산식품부] 농어촌 기본소득 연계 사회연대경제 활성화 공모전 지방정부 우수모델을… — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.mafra.go.kr/home/5109/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGaG9tZSUyRjc5MiUyRjU3OTMwMCUyRmFydGNsVmlldy5kbyUzRg%3D%3D

### 원문 후보 확인 — 찾아 온 주소가 그 공고·그 회차인지 학생처럼 열어 봤습니다
이번에 판정한 후보 **4건** · ✅ 원문으로 올림 0 · 🟡 사람 확인 0 · ❌ 맞지 않음 3 · ⏳ 못 엶(다시 봄) 1
앱에 실린 로봇 바로잡기(`data/link-check.json` fix): **11건** — 앱은 그 링크를 원문으로 엽니다(지금 링크가 이미 원문이면 바꾸지 않습니다).
_후보는 `collector/link-candidates.json` 에 적거나(사람·세션), 로봇이 우리 기록에서 찾습니다(같은 사이트·같은 제목의 글 주소 · 층2 재단 장학금과 짝지은 재단 게시판 글)._

#### ✅ 원문으로 올린 것 (이번 실행)
- 없음

#### 🟡 사람 확인을 기다리는 후보 (전체 1건) — 열어 보고 맞으면 관리자 화면 「원문 링크」에 넣어 주세요
- [실시간 공고] [기금-10/8] 2026학년도 2학기 푸른솔 사회정의 장학금 신청 안내 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.korea.ac.kr/ko/568/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjMlMkYwMDAxMDAwMDAwMDAwMDM4NjElMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓

#### ❌ 맞지 않은 후보 (이번 실행)
- [층2 재단(바로잡은 원문)] 재단법인 창암장학재단 창암장학생 — 다른 공고의 링크와 같은 주소([학부·대학원-교외장학] 2026학년도 창암장학생 지원 공고 안내)
  https://www.inha.ac.kr/bbs/kr/8/46061/artclView.do · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
- [층2 재단(바로잡은 원문)] 춘향장학재단 남원의 별 특별장학생 — 열리지 않음(HTTP 400)
  https://www.namwon.go.kr/board/post/view.do?boardUid=ff8080818ea1b850018ea1e3e9ad0081&menuUid=ff8080818e3beff0018e4075e410006e&postUid=9be51b0f9b7ccfee019be981374d2d74 · 후보: Claude 세션 (2026-11-20 · 남원시 사이트가 세션의 모든 접속 경로에서 400 — 로봇이 다…
- [층2 재단(바로잡은 원문)] 춘향장학재단 남원의 별 특별장학생 — 열리지 않음(HTTP 400)
  https://www.namwon.go.kr/board/post/view.do?boardUid=ff8080818ea1b850018ea1e3e9ad0081&menuUid=ff8080818e3beff0018e4075e410006e&postUid=9be51b0f9b7ccfee019be97eae942c8d · 후보: Claude 세션 (2026-11-20 · 남원시 사이트가 세션의 모든 접속 경로에서 400 — 로봇이 다…

#### ⏳ 못 엶 — 며칠 뒤 다시 봅니다 (이번 실행 · 거절이 아닙니다)
- [층2 재단(바로잡은 원문)] 춘향장학재단 남원의 별 특별장학생 — 게시판을 못 엶(응답 400) · 다음 2026-11-22
  https://www.namwon.go.kr/board/post/list.do?boardUid=ff8080818ea1b850018ea1e3e9ad0081&menuUid=ff8080818e3beff0018e4075e410006e · 후보: 로봇(층2 글 사냥꾼)

#### ⚠️ 후보 파일(collector/link-candidates.json)에서 쓰지 못한 줄
- 교내 소식 `경희대학교|국제 [교수학습개발원] 국제C 학부생을 위한 학습컨설팅 신청 안내(10월)`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [교수학습개발원] AI시대 대학생의 학습 경험과 인식 설문조사 참여 안내`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [INVENI] 대표이사 비서 정규직 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|국제 [(주)라엘코리아] 해외영업(일본) 전환형 인턴 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [피보탈시스템즈코리아(주)] 반도체 엔지니어&오퍼레이터 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [새솔다이아몬드공업(주)] 해외영업(중국), 해외영업(미국) 부문 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2700016004`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2000480007`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2703692001`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0571003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0596010`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0596010`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2000347003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2000347003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2704374001`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)

#### 확인했지만 지금은 앱에 싣지 않는 바로잡기
- [층2 재단(바로잡은 원문)] `2701096002` — 공고가 앱에서 내려감
  https://www.jincheon.go.kr/home/sub.do?menukey=406&mode=view&no=1090368397

### 우리를 막는 것으로 보이는 사이트 (이번 결과를 "판정 못 함"으로 돌렸습니다)
- 없음

### 전체 현황 (앱에 실린 링크 × 지금까지 본 결과)
| 묶음 | 아직 안 봄 | 공고 확인 | 판정 못 함 | 한 번 봄 | 목록 | 첫 화면 | 로그인 | 안 열림 | 다른 화면 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 정식 등록 | 1 | 342 | 15 | 0 | 0 | 0 | 0 | 1 | 1 |
| 실시간 공고 | 17 | 1374 | 97 | 0 | 2 | 0 | 0 | 4 | 1 |
| 재단·지자체 | 9 | 49 | 7 | 0 | 0 | 1 | 1 | 0 | 0 |
| 대외활동·공모전 | 30 | 95 | 13 | 1 | 0 | 1 | 0 | 0 | 1 |
| 교내 소식 | 164 | 993 | 87 | 0 | 0 | 0 | 2 | 2 | 9 |
| 층2 재단(바로잡은 원문) | 19 | 24 | 8 | 0 | 0 | 0 | 0 | 0 | 0 |

_한 링크가 두 묶음에 함께 실려 있으면 양쪽에 셉니다. 「한 번 봄」은 다른 날 한 번 더 같은 것을 보면 확정됩니다._

### 확정된 문제 전체 (앱이 받는 파일에 적힌 것) — 24건
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
- [교내 소식] 2027학년도 예비대학(입학전교육) 신청 안내 — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://snuc.snu.ac.kr/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/?mod=document&uid=943
- [교내 소식] [국제학생지원실(세종)] 충주에서 만나는 K-헬스케어와 지역문화 with 공명 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.hongik.ac.kr/kr/newscenter/notice.do?mode=view&articleNo=159777&noCat=32
- [교내 소식] [총무팀] 육아휴직 대체자 채용 공고 — **다른 화면이 열림** (본문이 안 그려짐(18자 — 판정 불가))
  https://www.inha.ac.kr/bbs/kr/8/46024/artclView.do
- [교내 소식] [전북국제개발협력센터] 제4회 전북 개발협력 포럼 개최 (11/16) - 참여자 선착… — **로그인을 요구함** (로그인 요구(제목이 안 보이고 비밀번호 칸))
  https://www.jbnu.ac.kr/web/Board/219645/detailView.do
- [교내 소식] [매주 수요일은 후원의 집 가는 날] 안내드립니다. — **다른 화면이 열림** (열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at https://www.ka…)
  https://www.kangwon.ac.kr/ko/bbs/504/detail.do?pstSn=11581&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0
- [교내 소식] 보건실 휴무 안내(2026.10.29.) — **다른 화면이 열림** (열기 실패: page.goto: net::ERR_EMPTY_RESPONSE at https://www.ka…)
  https://www.kangwon.ac.kr/ko/bbs/504/detail.do?pstSn=11585&pageIndex=1&pageItm=10&searchOrderSort=0&searchGbn=0
- [교내 소식] [학부대학 원격교육센터] 2026 고려대학교 MOOC DAY — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.korea.ac.kr/ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjElMkYwMDAwNjAwMDAwMDAwNjE1NjclMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D
- [교내 소식] [한국어센터] 입학식 단기근로학생 모집(12/3, 12/10) — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.korea.ac.kr/ko/566/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjElMkYwMDAwNjAwMDAwMDAwNjE2ODklMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D
- [교내 소식] [일반] [원격교육지원센터] 2026년 광운대학교 모집 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.kw.ac.kr/ko/life/notice.jsp?BoardMode=view&DUID=53682&tpage=1&searchKey=1&searchVal=&srCategoryId=
- [교내 소식] 일반공지 PHP 취약점 조치 안내 신촌/국제 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.yonsei.ac.kr/bbs/sc/58/944452/artclView.do
- [교내 소식] Node.js 취약점 조치 안내 — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.yonsei.ac.kr/bbs/sc/58/944486/artclView.do
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
- [실시간 공고] [기금-10/8] 2026학년도 2학기 푸른솔 사회정의 장학금 신청 안내 — **게시판 목록이 열림** (다른 공고 제목만 여럿 보임(목록))
  https://www.korea.ac.kr/ko/568/subview.do?article.offset=10&nttId=000100000000003861
- [정식 등록·실시간 공고] auto-larshipdoarticleno377067 · [국가근로] 2026학년도 2학기 국가근로장학생 추가 모집 안내(교수학습개발센터) — **열리지 않음(없는 주소)** (열기 실패: page.goto: Timeout 20000ms exceeded.)
  https://www.ajou.ac.kr/kr/ajou/notice_scholarship.do?mode=view&articleNo=377067&article.offset=0&articleLimit=10
- [정식 등록·실시간 공고] auto-amepagescholarshipnotice-00jgl50 · [교외] 해동과학문화재단 장학생 선발 안내(10/26 마감, 공학계열, 생활비 연 1… — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.sogang.ac.kr/ko/detail/551490?bbsConfigFk=141&namepage=ScholarshipNotice

### 열어 보지 않은 것 (세기만 했습니다)
- 게시판 목록 표식(#n-): 실시간 공고 1 — 원문 주소를 아직 못 찾은 글이라 앱이 이미 "게시판 목록"이라고 부릅니다
- 층2(한국장학재단에 등록된 재단 장학금): 3건 — 재단 홈페이지 주소뿐이라 앱이 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 2건) · 바로잡은 원문이 있어 연 것 63건은 따로
- 마감이 지나 앱이 더는 보여 주지 않는 대외활동: 60건
- 앱에 실린 링크 3090건 중 이번 순서에 든 것 0건 (사이트마다 최대 8건 · 학교 서버를 몰아치지 않으려고)
