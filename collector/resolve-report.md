## 🔗 원문 링크 복구 리포트 (2026-11-24 13:44 KST)

판: 7차(게시판 폼으로 원문 주소 조립) · 커밋 61e3af2
고칠 대상: **2건** (실시간 공고 2 · 정식 등록 0) · 게시판 2곳
- 관리자가 원문 주소를 넣은 공고 3건은 건드리지 않았습니다(관리자 화면 「원문 링크」)

### https://scholarship.uos.ac.kr/scholarship/notice/notice/list.do?brdBbsseq=1&pageIndex=2
- 대상 1건
- 목록 1페이지에서 행 3개
  - ⚠️ 목록에서 못 찾음(내려갔거나 제목 변경): [국가/신청] ★2027-1학기 국가장학금 1차 ..
  - (진단) 후보 주소 0개 생성 · 목록 행 생김새:
      (클릭 함수) fnView = function fnView (brdDate, brdSeq) { $("#brdDate").val(brdDate); $("#brdSeq").val(brdSeq); $("#sendForm").attr("action", "/scholarship/notice/notice/view.do").submit(); }
      (폼) action= method=get · return_url=
      (폼) action= method= · uid=&pwd=&return_url=&return_gubun=

### https://scholarship.uos.ac.kr/scholarship/notice/notice/list.do?brdBbsseq=1
- 대상 1건
- 목록 6페이지에서 행 94개
    · 탈락(본문이 안 그려짐(64자 — 판정 불가)) https://scholarship.uos.ac.kr/scholarship/notice/notice/view.do?brdBbsseq=1&nttId=20261116
    · 탈락(HTTP 404) https://scholarship.uos.ac.kr/scholarship/notice/notice/detail/20261116
    · 탈락(열기 실패: page.goto: Timeout 20000ms exceeded.) https://scholarship.uos.ac.kr/scholarship/notice/notice/view.do?brdDate=20260713&brdSeq=1&filSeq=&pa
  - ⚠️ 원문 주소 확인 실패(표식 유지): [교외] 문우림 제6기 장학생 모집
  - (진단) 후보 주소 3개 생성 · 목록 행 생김새:
      <a href="/scholarship/scholarship/college/record/record.do?x=2&amp;y=1&amp;w=1" class="top_2d"><span class="ml70">학부교내장학</span></a>
      <a href="/scholarship/scholarship/graduate/graduate/graduate.do?x=3&amp;y=1&amp;w=1" class="top_2d"><span class="ml70">대학원교내장학</span></a>
      <a href="/scholarship/notice/search/search.do" class="top_2d"><span class="ml35">내게 맞는 장학찾기</span></a>
      (클릭 함수) fnView = function fnView (brdDate, brdSeq) { $("#brdDate").val(brdDate); $("#brdSeq").val(brdSeq); $("#sendForm").attr("action", "/scholarship/notice/notice/view.do").submit(); }
      (폼) action= method=get · return_url=
      (폼) action= method= · uid=&pwd=&return_url=&return_gubun=

---
복구 **0건** · 실패 2건
실패분은 목록 주소를 그대로 두었습니다 — 앱은 이 경우 "게시판 목록이 열려요"라고 정직하게 알립니다.