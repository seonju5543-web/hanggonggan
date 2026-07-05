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
```

`verify-forms-data.js` 사전 준비: 저장소를 스크래치 폴더에 복사 → 복사본의 data/forms.json에
더미 양식(test-dummy) 추가 + registered.json 한 항목에 formId 연결 → 복사본 루트에서 8124 포트로 서빙.

- 크로미움 경로: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (드라이버 안에 하드코딩됨)
- 파일 업로드 테스트는 한글 파일명이 실패하므로 `grade-cert.png`(ASCII)를 쓴다.
- 스크린샷은 이 폴더에 shot-*.png로 저장된다 (커밋하지 않아도 됨).
