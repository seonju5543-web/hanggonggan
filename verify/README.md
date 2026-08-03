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
node verify-source-links.js # 원문 링크 검증: '원문 공고 ↗'가 정말 그 공고로 가는지 (아래 설명)
node verify-notify-rules.js # 알림 규칙 단위 검증 (서버·브라우저 불필요 — 언제 알림이 가고 안 가는지 고정)
node verify-notify.js       # 알림 시스템 브라우저 검증: 최초 1회 동의 → 조건별 발송 → 알림함 → 설정 → 딥링크
node verify-push-server.mjs # 진짜 푸시 서버 검증: VAPID 서명을 실제로 검증 · 깨울 학교 판정 · 구독 저장 (서버 불필요)
node verify-push-client.js  # 진짜 푸시 앱 검증: 미설정/설정 두 상태 · 개인정보가 서버로 새지 않는지 요청 본문 전수 검사
node verify-admin.js        # 관리자 페이지 검증 (아래 설명 — 서버 불필요, 스스로 띄운다)
```

`verify-admin.js` — 2026-08-03 신설. 관리자 페이지(`_admin/`)를 검사한다.
관리자 화면은 Cloudflare에 있고 데이터는 GitHub에서 읽어 오므로, 검사할 때마다 진짜 열쇠를
쓸 수 없다. 그래서 **바깥으로 나가는 요청을 가로채 저장소의 실제 파일로 응답**해 준다
(= 진짜 우리 데이터로 화면이 그려지는지를 본다). 보는 것:
① 열쇠 전에는 운영 현황이 한 글자도 안 보이는가 · 틀린 열쇠로는 못 들어가는가
② 6개 화면이 실제 건수대로 그려지는가 · 콘솔 오류 0
③ 원문 대조 화면에 앱1 내용과 공고 원문 발췌가 함께 뜨는가
④ **등록된 양식 전부가 오류 없이 문서를 만들어 내는가** (앱1의 renderFormDoc 재사용 검증 —
   양식을 새로 넣었을 때 앱1보다 여기서 먼저 깨진다)
⑤ 상태·학교 분류가 실제로 걸러 내는가
사전 준비는 `bash _admin/build.sh` 하나뿐이다(서버는 드라이버가 스스로 띄운다).

> 쓰기 경로(`tools/admin-apply.mjs`)는 브라우저 없이 확인한다:
> `ACTION=confirm PAYLOAD='{"ids":["…"]}' ACTOR=me node tools/admin-apply.mjs` 뒤
> `node verify/audit-data.js`로 관문이 도는지 보고 `git checkout -- data collector`로 되돌린다.

`verify-source-links.js` — 2026-07-31 신설. 앱에서 장학 공고를 열고 원문 링크를 눌렀을 때
**학교 장학 공지 목록 전체가 아니라 그 장학금 공고**로 가는지 본다. 3단으로 검사한다:
① 데이터 전수 — registered.json·notices.json에 목록 주소(`#n-` 표식)가 몇 건 남아 있나
② 브라우저 — 학교 학생으로 온보딩해 실제 카드를 열고 링크 href를 읽는다(LINKCHECK_SCHOOL로 학교 지정)
③ 정직성 — 아직 원문 주소를 못 찾은 공고는 '게시판 목록 ↗'으로 표기되고 안내가 붙는가
(라벨과 실제 링크가 어긋나면 실패한다. 목록 주소가 남아 있는 것 자체는 실패가 아니다 —
 원문 주소를 못 찾는 게시판이 있을 수 있고, 그때는 정직하게 표기하는 것이 맞는 동작이다.)

목록 주소가 남아 있으면 링크 사냥꾼 로봇이 처리한다 — `collector/run-link-hunt.txt`를 고쳐 push
(→ `.github/workflows/link-hunter.yml`). 자세한 것은 아래 '링크 사냥꾼' 절.

`verify-notify.js`는 브라우저 두 개(권한 거절 사용자 / 허용 사용자)를 각각 돌린다.
헤드리스에선 휴대폰 알림 UI가 보이지 않으므로 `Notification`·`showNotification`을
가로채(스파이) **실제로 호출됐는지**를 확인한다. 알림 종류·문구를 바꾸면 이 드라이버의
기대 문구도 함께 손볼 것.

## 개발자 도우미 (서버 불필요 — data/*.json만 읽음)

```bash
node verify/check-deploy-sync.js         # 배포 반영 확인: 지금 작업분이 실제로 앱(main)에 나가 있는지 대조
node verify/check-collab.js              # 협업 겹침 점검: 상대 작업과 부딪힐 곳이 있는지 (규칙: COLLAB.md)
node verify/check-collab.js --brief      #   └ 문제가 있을 때만 짧게 (세션 시작 훅이 쓰는 모드)
node verify/list-unregistered.js         # 수집됐지만 미등록인 공고를 학교별로 추림 (컨펌 대상 후보)
node verify/list-unregistered.js --all    # 제외분(중복·메뉴·대출·행사·마감경과) 사유까지 전부 표시
```
정식 등록 컨펌 작업을 시작할 때 먼저 실행하면, 124건 피드에서 실제 등록 후보만 골라준다.

`verify-forms-data.js` 사전 준비: 저장소를 스크래치 폴더에 복사 → 복사본의 data/forms.json에
더미 양식(test-dummy, **필드 id는 반드시 'memo'**) 추가 + registered.json에서 **마감이 지나지 않은** 항목에
formId 연결(마감 지난 항목이면 신청 버튼이 비활성이라 검증이 깨짐) → 복사본 루트에서 8124 포트로 서빙.
드라이버는 test-dummy가 연결된 항목을 동적으로 찾아 구동한다(2026-07-15).

**마감된 공고를 대상으로 삼지 말 것**: 마감 공고는 신청 버튼이 비활성이라 클릭이 30초 타임아웃으로
깨진다. `verify-new-forms.js`의 삼일·명지 구간이 이 이유로 깨져 있던 것을 2026-07-31에 고쳤다 —
마감 여부를 먼저 확인하고, 마감이면 **`driveAnyLiveForm()`이 앱에서 마감 전 양식 공고를 스스로 찾아
같은 UI 경로(질문 → 문서 생성)를 대신 구동**한다. 그래서 공고가 마감돼도 **검사가 사라지지 않는다**.
새 드라이버를 쓸 때도 대상은 하드코딩하지 말고 이렇게 앱에서 마감 전 항목을 찾아 쓸 것.

- 크로미움 경로: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (드라이버 안에 하드코딩됨)
- 파일 업로드 테스트는 한글 파일명이 실패하므로 `grade-cert.png`(ASCII)를 쓴다.
- 스크린샷은 이 폴더에 shot-*.png로 저장된다 (커밋하지 않아도 됨).
