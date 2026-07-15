# 검증 드라이버 (Playwright 자동 테스트)

앱을 바꾼 뒤에는 반드시 아래 절차로 사람 대신 로봇이 앱을 눌러보게 해서 확인한다.

```bash
# 1) 저장소 루트에서 앱 서버 켜기
python3 -m http.server 8123 &

# 2) playwright-core 설치 (Claude 원격 환경엔 크로미움이 이미 있음)
cd verify && npm init -y >/dev/null && npm i playwright-core --no-audit --no-fund

# 3) 실행
node drive.js               # 전체 회귀: 외대 프로필 온보딩→매칭→보관함→신청 플로우
node verify-registered.js   # 정식 등록 검증: 성균관 프로필→등록 공고 노출→조병두 양식 생성
node verify-new-forms.js    # 신규 양식 5종: 스키마 렌더링 + 삼일·명지 UI 문서 생성
node verify-forms-data.js   # 데이터 주도 양식: forms.json에만 더미 양식을 넣은 앱 복사본(8124 포트)으로 검증
node audit-data.js          # 소급 감사: 기존 데이터 전체가 현재 엔진 기준을 충족하는지 (엔진 변경 후 필수)
node personas.js            # 페르소나 스윕: 120종 사용자 조합으로 홈·탐색·상세를 훑어 크래시·빈 상태·콘솔 오류 탐지
```

## 개발자 도우미 (서버 불필요 — data/*.json만 읽음)

```bash
node verify/list-unregistered.js         # 수집됐지만 미등록인 공고를 학교별로 추림 (컨펌 대상 후보)
node verify/list-unregistered.js --all    # 제외분(중복·메뉴·대출·행사·마감경과) 사유까지 전부 표시
```
정식 등록 컨펌 작업을 시작할 때 먼저 실행하면, 124건 피드에서 실제 등록 후보만 골라준다.

`verify-forms-data.js` 사전 준비: 저장소를 스크래치 폴더에 복사 → 복사본의 data/forms.json에
더미 양식(test-dummy, **필드 id는 반드시 'memo'**) 추가 + registered.json에서 **마감이 지나지 않은** 항목에
formId 연결(마감 지난 항목이면 신청 버튼이 비활성이라 검증이 깨짐) → 복사본 루트에서 8124 포트로 서빙.
드라이버는 test-dummy가 연결된 항목을 동적으로 찾아 구동한다(2026-07-15).

- 크로미움 경로: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (드라이버 안에 하드코딩됨)
- 파일 업로드 테스트는 한글 파일명이 실패하므로 `grade-cert.png`(ASCII)를 쓴다.
- 스크린샷은 이 폴더에 shot-*.png로 저장된다 (커밋하지 않아도 됨).
