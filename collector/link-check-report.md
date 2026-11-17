## 🔗 원문 링크 확인 리포트 (2026-11-18 04:49 KST · 기준일 2026-11-18)

앱이 보여 주는 원문 링크를 **학생처럼**(로그인·리퍼러 없는 새 탭) 열어, 그 공고가 실제로 뜨는지 봤습니다.
🔴 이 로봇은 주소를 고치지 않습니다 — 확정된 문제만 `data/link-check.json` 에 적고, 앱은 그 링크의 이름을 바꿔 정직하게 보여 줍니다(예: "게시판 목록에서 보기", "원문 공고(확인 필요)").

_이번 실행은 **원문 후보만** 확인했습니다(후보 파일을 고쳐 push 한 실행 · 앱의 링크는 매일 저녁 실행이 봅니다)._

이번 실행: **0건** 열어 봄 · 공고 확인 0 · 문제로 보임 0 · 판정 못 함 0
앱에 알린 확정 문제(지금 실린 링크): **27건** · 이번에 새로 확정: **0건**

### 새로 확정된 문제 링크 (다른 날 두 번 같은 것을 봤습니다) — 0건
- 없음

### 한 번 본 문제 (다른 날 한 번 더 보고 확정합니다 — 아직 앱 글자를 바꾸지 않습니다) — 0건
- 없음

### 원문 후보 확인 — 찾아 온 주소가 그 공고·그 회차인지 학생처럼 열어 봤습니다
이번에 판정한 후보 **11건** · ✅ 원문으로 올림 3 · 🟡 사람 확인 2 · ❌ 맞지 않음 1 · ⏳ 못 엶(다시 봄) 5
앱에 실린 로봇 바로잡기(`data/link-check.json` fix): **12건** — 앱은 그 링크를 원문으로 엽니다(지금 링크가 이미 원문이면 바꾸지 않습니다).
_후보는 `collector/link-candidates.json` 에 적거나(사람·세션), 로봇이 우리 기록에서 찾습니다(같은 사이트·같은 제목의 글 주소 · 층2 재단 장학금과 짝지은 재단 게시판 글)._

#### ✅ 원문으로 올린 것 (이번 실행)
- [층2 재단(바로잡은 원문)] (재)옹진군인재육성재단 인재장학금 — 그 재단·그 사업·이번 회차 공고로 확인
  https://www.ongjin.go.kr/open_content/main/bbs/bbsMsgDetail.do?msg_seq=26744&bcd=notice · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] (재)이월면장학회 장학생 — 그 재단·그 사업·이번 회차 공고로 확인
  https://www.jincheon.go.kr/home/sub.do?menukey=406&mode=view&no=1090368397 · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] 서울미래인재재단 서울선순환인재 장학금 — 그 재단·그 사업·이번 회차 공고로 확인
  https://www.seoulfuture.or.kr/home/kor/M025378985/board.do?idx=cb00d1a0008a85e71a41b8741facbffe9c92b5676b1d6934d9efe41731e60154&act=detail&board_code=XL50YTz5 · 후보: 로봇(층2 글 사냥꾼)

#### 🟡 사람 확인을 기다리는 후보 (전체 10건) — 열어 보고 맞으면 관리자 화면 「원문 링크」에 넣어 주세요
- [층2 재단(바로잡은 원문)] 재단법인 한독제석재단 대학장학생 — 처음 보는 사이트(med.hallym.ac.kr) — 기관 이름은 보임 · 사람 확인
  https://med.hallym.ac.kr/bbs/med/1274/392278/artclView.do · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ? · 제목 ✓ · 회차 ✓ · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 강원도 홍천군청 저소득주민자녀장학금 (일반) — 회차를 가릴 날짜가 안 보임
  https://www.hongcheon.go.kr/www/selectEminwonNewsView.do?key=283&news_epct_no=12167&ofr_pageSize=10 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 재단법인 안산인재육성재단 대학생 본인부담 등록금 반값 지원 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.ansanfys.or.kr/sub02/sub01.php?type=view&uid=1071 → 실제로 간 곳 https://ansanfys.or.kr/sub02/sub01.php?type=view&uid=1071 · 후보: 로봇(층2 글 사냥꾼)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 재단법인 안산인재육성재단 대학생 본인부담 등록금 반값 지원 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.ansanfys.or.kr/sub03/sub03.php → 실제로 간 곳 https://ansanfys.or.kr/sub03/sub03.php · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓ · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 배재장학재단 모범학생장학금(자립지원) — 제목 자리에서 우리 공고 제목을 통째로 찾지 못함(앞부분만 같을 수 있음)
  https://www.pcu.ac.kr/kor/article/scholarship/1926154031 · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓ · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 강북구 꿈나무키움 장학재단 재능장학생 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.gangbuk.go.kr:18000/portal/bbs/B0000145/view.do?menuNo=200081&nttId=186080 · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓ · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 일신문화재단 형남장학금 — 회차를 가릴 날짜가 안 보임
  http://www.ilshinfoundation.com/bbs/board.php?bo_table=notice&wr_id=14 · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ✓
- [층2 재단(바로잡은 원문)] 한국교육재단 한국사무소 장학생 — 회차를 가릴 날짜가 안 보임
  https://www.kref.or.jp/news/2026scholarshipkorea/ · 후보: Claude 세션 (2026-11-16 웹 검색 · 네이버 열쇠 없음 대신)
  잣대: 겹침 ✓ · 착지 ✓ · 사이트 ✓ · 제목 ✓ · 회차 ? · 기관 ✓ · 사업 ?
- [실시간 공고] [기금-10/8] 2026학년도 2학기 푸른솔 사회정의 장학금 신청 안내 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.korea.ac.kr/ko/568/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQlMkZrbyUyRjMlMkYwMDAxMDAwMDAwMDAwMDM4NjElMkZwb3J0YWxCb2FyZFZpZXcuZG8lM0ZzaXRlSWQlM0RrbyUyNnR5cGUlM0QlMjZpZCUzRCUyNmFydGljbGVJZCUzRCUyNnBhZ2UlM0QlMjZzdGFydERhdGUlM0QlMjZlbmREYXRlJTNEJTI2ZmluZFR5cGUlM0QlMjZmaW5kV29yZCUzRCUyNg%3D%3D · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓
- [실시간 공고] 일반공지 10/2(금) 교외장학재단 제출용 총장 직인 날인 불가 안내 신촌/국제 — 제목이 제목 자리가 아니라 본문에만 보임
  https://www.yonsei.ac.kr/bbs/sc/58/944246/artclView.do · 후보: 로봇(같은 사이트·같은 제목 — 수집 검수 후보)
  잣대: 겹침 ✓ · 착지 ? · 사이트 ✓ · 제목 ✓ · 회차 ✓

#### ❌ 맞지 않은 후보 (이번 실행)
- [층2 재단(바로잡은 원문)] 관정재단 학부장학생 — 다른 화면이 열림(다른 글이 열림(제목 불일치))
  https://www.ikef.or.kr/page.php?id=/kj/scholar_schedule_detail&wr_id=102&page=1 · 후보: 로봇(층2 글 사냥꾼)

#### ⏳ 못 엶 — 며칠 뒤 다시 봅니다 (이번 실행 · 거절이 아닙니다)
- [층2 재단(바로잡은 원문)] 재단법인 석성장학회 석성장학생 — 못 엶(HTTP 403) — 다시 봅니다 · 다음 2026-11-19
  https://www.seoksung.co.kr/cms/bbs/board.php?bo_table=nanum&wr_id=522 · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] 강원도 원주시청 다자녀가정 특별지원 장학금 — 게시판 목록(12줄)에서 그 글을 하나로 못 고름 · 다음 2026-11-19
  https://www.wonju.go.kr/www/index.do · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] 재단법인 석성장학회 특별장학생 — 게시판을 못 엶(응답 403) · 다음 2026-11-19
  http://www.seoksung.co.kr/cms/bbs/board.php?bo_table=nanum · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] (재)인제군장학회 대학생장학금 — 못 엶(열기 실패: page.goto: Download is starting) — 다시 봅니다 · 다음 2026-11-19
  https://www.inje.go.kr/egf/bp/board/article/download?fileSeq=120999 · 후보: 로봇(층2 글 사냥꾼)
- [층2 재단(바로잡은 원문)] 영천시장학회 SOS 장학금 — 못 엶(열기 실패: page.goto: Download is starting) — 다시 봅니다 · 다음 2026-11-19
  https://www.ycsf.or.kr/open/notice/dn.php?idx=342&step=A&num=1 · 후보: 로봇(층2 글 사냥꾼)

#### ⚠️ 후보 파일(collector/link-candidates.json)에서 쓰지 못한 줄
- 교내 소식 `경희대학교|국제 [교수학습개발원] 국제C 학부생을 위한 학습컨설팅 신청 안내(10월)`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [교수학습개발원] AI시대 대학생의 학습 경험과 인식 설문조사 참여 안내`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [INVENI] 대표이사 비서 정규직 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|국제 [(주)라엘코리아] 해외영업(일본) 전환형 인턴 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [피보탈시스템즈코리아(주)] 반도체 엔지니어&오퍼레이터 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 교내 소식 `경희대학교|공통 [추천채용] [새솔다이아몬드공업(주)] 해외영업(중국), 해외영업(미국) 부문 추천채용`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2700016004`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2703692001`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0571003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0596010`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `0596010`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2000347003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)
- 층2 재단(바로잡은 원문) `2000347003`: 앱에서 그 공고를 못 찾음(지금 보이는 주소·id·층2 코드인지 확인)

### 우리를 막는 것으로 보이는 사이트 (이번 결과를 "판정 못 함"으로 돌렸습니다)
- 없음

### 전체 현황 (앱에 실린 링크 × 지금까지 본 결과)
| 묶음 | 아직 안 봄 | 공고 확인 | 판정 못 함 | 한 번 봄 | 목록 | 첫 화면 | 로그인 | 안 열림 | 다른 화면 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 정식 등록 | 0 | 334 | 15 | 0 | 0 | 0 | 0 | 1 | 1 |
| 실시간 공고 | 2 | 1334 | 89 | 0 | 2 | 0 | 0 | 4 | 1 |
| 재단·지자체 | 0 | 53 | 8 | 0 | 0 | 1 | 1 | 0 | 0 |
| 대외활동·공모전 | 13 | 111 | 18 | 0 | 0 | 1 | 0 | 0 | 1 |
| 교내 소식 | 65 | 1054 | 83 | 0 | 0 | 0 | 2 | 3 | 11 |
| 층2 재단(바로잡은 원문) | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

_한 링크가 두 묶음에 함께 실려 있으면 양쪽에 셉니다. 「한 번 봄」은 다른 날 한 번 더 같은 것을 보면 확정됩니다._

### 확정된 문제 전체 (앱이 받는 파일에 적힌 것) — 27건
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
- [교내 소식] [국제처] 2026 동계 KNU in the World Pro... — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.pusan.ac.kr/kor/CMS/Board/Board.do?mCode=MN095&mode=view&mgr_seq=3&board_seq=1511959
- [교내 소식] 세종대학교 정규직 채용 — **열리지 않음(없는 주소)** (HTTP 404)
  https://www.sejong.ac.kr/kor/intro/notice1.do?mode=view&articleNo=894982&article.offset=0&articleLimit=10
- [교내 소식] 2026 교양대학 연속강좌 3강 (11/3 화) — **다른 화면이 열림** (다른 글이 열림(제목 불일치))
  https://www.seoultech.ac.kr/service/info/notice/?do=commonview&searchtext=&searchtype=-1&nowpage=1&bnum=4691&bidx=896780&qidx=4691&cate=10&allboard=false&nowpage=1
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
- 층2(한국장학재단에 등록된 재단 장학금): 62건 — 재단 홈페이지 주소뿐이라 앱이 "재단 홈페이지"라고 부릅니다(그중 공고문 사본이 있는 것 51건) · 바로잡은 원문이 있어 연 것 3건은 따로
- 마감이 지나 앱이 더는 보여 주지 않는 대외활동: 60건
- 앱에 실린 링크 2938건 중 이번 순서에 든 것 0건 (사이트마다 최대 8건 · 학교 서버를 몰아치지 않으려고)
