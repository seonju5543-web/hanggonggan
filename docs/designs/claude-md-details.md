# CLAUDE.md 세부 — 줄인 항목의 원문 (2026-11-18~)

CLAUDE.md 가 60KB 천장 가까이 붙어 있어, 긴 항목은 거기에 🔴 규칙과 한 곳 이름만 남기고 **원문을 여기에 그대로** 옮겼다.
이 문서도 관문 「CLAUDE.md 가 가리키는 것이 실제로 있다」가 같이 잰다 — 이름을 바꾸면 여기도 고친다.

## 장학금 판정 자동화 (2026-09-30)

- **판정기 `collector/kind-evidence.mjs`**(`classifyKind` · 순수 함수): 제목 표식 → 학교 제도 표(`OWN_PROGRAMS` + 학습 `own-programs.json`) → 제목의 바깥 기관 낱말(`ORG_RE`) → 학교 이름표(`schoolTokens`) + 본문 증거(교비·장학팀 접수·학교 도메인 이메일) 순. 이름표 없이 본문 낱말만으로는 교내로 보지 않는다 (껍데기를 걷어낸 본문만 읽는다 `makeStripperMulti`). 증거 없음 = 교외.
- **소급 로봇 `collector/kind-classify.mjs`**(원문 도착 뒤 · 두 수집 워크플로의 데이터 관문 앞): 확신 high 면 구분을 고치고 `kindEvidence` 를 남기며 제도 이름을 학습 표에 적는다(다음 등록부터 `noticeKind(title, school, learned)` 셋째 인자로 잡힌다 · 앱 화면은 안 넘긴다). mid 는 `kind-candidates.json` 후보로만. 관리자가 교내→교외로 되돌린 이름은 `blocked` 로(다시 배우지 않는다).
- **범위 승격 `collector/scope-promote.mjs`**(F-5): 학교 한정·교외·로봇 등록분 중 ① 접수 이메일이 학교 밖 ② 본문 "재단에 직접 제출/재단 홈페이지 신청/우편 접수" ③ 타교 같은 사업(`programKey` · `entry-rules.cjs`)이면 전국으로(`scopeFrom` 에 근거) · 학교 창구(장학팀·포털) 문장이 있으면 안 푼다. 자동 등록도 타교 같은 사업이 오면 기존 것을 승격(`verdict: 'promote'`) · 합치기는 `collector/registered-merge.mjs` 한 곳.
- 그 밖(같은 지시): 브라우저 담당 게시판은 `schools.json` `collector:"browser"` 로 일반 로봇이 건너뛴다 · 못 읽는 학교는 `run-probe.txt` 정찰 · 분교 씨앗 `school-board-seeds.json` 은 `find-boards.mjs` 가 후보만 리포트 · 포털 표 후보 `collector/portal-candidates.mjs` · 정문 사진 44개교(`fetch-gate-photos.mjs`). 관문 「장학금 판정 자동화 · 범위 승격」.

## 학적정보 테일러링 (2026-10-24)

- 온보딩 5단계 「적합도 높이기」 = `elig-ask.js` `ONBOARD_TRAITS`(열린 공고 4곳 이상이 묻는 처지 · 저장은 `traits` · 안 누른 것은 저장 안 함) + 출신 고교 `originRegion`·`originCity`(엔진 `about:'origin'` 맞으면 ✓ · 아니면 모름). 관심 대외활동은 대외활동 탭 관문 `activityGateDone` 뒤에(`collectProfile` 은 관심을 물려받는다). 소재지는 학과 파일의 시·도를 `schoolRegion` 에 적어 `about:'school'` ✓/모름. 전수 집계 `verify/eligibility-coverage.mjs`. 관문 「학적정보 테일러링」·「못 읽던 자격 줄」 · `verify-academic-info.js` · 설계 `docs/designs/academic-info-tailoring.md`.

## 판정 · 자격

- **🔴 틀린 미달은 못 받는 것보다 나쁘다 · 판정 못 하는 축은 '틀린 안심'이다.** 확신 낮은 어긋남은 '모름'(`lineVerdict`). 배지·정렬은 `app.js fitVerdict` 한 곳. 범위(`3~4학년`·`0~8구간`)는 `이하`와 같은 확신 · 반대말(`1~3구간 불가`)·「또는」 줄은 '모름' · 출신 지역(`originPlaceIn`)은 맞으면 ✓ 아니면 '모름'(10-24) · 갈래 꼬리표 〔○○ 소재 대학〕 는 화면만의 것이라 판정은 `untag` 로 뗀다(관문 「자격을 찾는 곳 넓히기」).
  10-15 결정: 학적정보에 있으면 판정 — 백분위는 두 환산표의 안전한 쪽(`pctToGpa`) · 학년 하나면 그 학년 · 남은 학기는 학년으로 한쪽만 · 어학은 보유 체크 없으면 ✕(`parseCert`) · 가계곤란은 둔다.
- **'자격을 못 읽는다'의 원인은 대개 '본문을 못 받았다'** — 본문 판정은 실제 분량(한글 `MIN_BODY`)으로, 발췌기·AI와 같은 말뭉치로. 짐작 말고 `run-probe.txt` 에 `checkUrl:`. 본문이 두 줄뿐이면 첨부가 본문이다: 공고문류가 그림보다 먼저(`pickDocAttachments`) · zip 안 공고문류를 꺼낸다(`zipNoticeDocs`) · OCR 포스터는 80자면 읽는다(`readableDoc`) · 납작한 표·분야별 표 블록은 비운다 · 사이트 장식 그림(접근성 마크·SNS 로고·챗봇·띠)은 받기 전에 뺀다(`isDecorativeImage` 한 곳).
- **공고 카드 품질(10-15)**: 「○○의 경우」 줄은 범위 밖이면 '모름'(`lineVerdict`) · 열거 학년·이수 학기(`parseSemester`)·따옴표 구간·「3.0/4.5」 판정 · 자격 줄이 없으면 구조화 조건이 요건(`fitDetail`) · 조각·글 제목·※ 예외는 자격 줄 아님(`looksFragment`) · 중위소득 %는 구간 표(`parseIncomeBand`) · 단과대론 ✓ 안 줌 · ✕ 는 한 번만 · 「공고 안내」 `noticeSummaryHtml` · 활동 안내·시상표 거름 `eligLineOk` · 모르는 칸은 접는다. 관문 「공고 카드 품질」.

## 층2(KOSAF) · 접수 채널

- **층2는 층1과 섞지 않는다** — 자격 진단은 붙이지 않고 재단 칸을 그대로 보인다. `due` 가 빈 재단을 버리지 말 것(모집 중일 수 있다) ·
  수확 때 지난 상세를 이어받는다 · `goods:'학자금'`(대출)은 뺀다 · 첨부 원주소는 담지 않고 사본을 준다 · 첨부 칸을 낱말로 찾지 말 것 ·
  사본을 서비스워커가 가로채지 않게 · 앱 지원문서는 붙되(10-13) 머리말 `kosaf` — 접수는 선발 공고문이 정한다. 관문 「층2 첨부」·`verify-kosaf.js`.
- **재단·지자체 게시판(교외 확대)** (2026-09-26 · 노션 F-13): 링커리어류는 크롤링이 아니라 **주최사 직접 등록**이라 긁지 않는다 — 우리는 주최의 제 게시판을 읽는다.
  출처 `collector/external-sources.json` 은 `kosaf-open.json` 의 재단 홈페이지에서 왔고, `collector/find-boards.mjs` 가 게시판을 찾아 `autoFound` 로 적는다(잘못 찾으면 `parked`).
  글은 `data/external.json`(학교 피드와 따로) → 홈 「재단·지자체 새 공고」(`externalNoticesHtml` · 등록된 주소는 `registeredUrlMatcher` 로 뺀다). 링크 읽는 눈은 `collector/board-links.mjs` 한 곳. 관문 「재단·지자체 게시판」.

## 로봇 · 워크플로

- **폰은 `notices.json` 을 받지 않는다 — 학교별 파일뿐이다**(`noticeFilesForProfile`).
  옛 파일은 로봇 장부 + 물러나는 길로만 남았고,
  그 길도 색인(`data/notices/index.json`)으로 **알 때는 안 받는다**(`noticeFallbackNeeded` 한 곳 — 화면·알림 공용).
  프로필이 없으면 아무것도 안 받고, 학교가 정해지거나 바뀌면 다시 받는다(`loadNoticesIfSchoolChanged`). 관문 「학교별 공고 파일」.
- **학과 목록도 학교별 파일뿐이다**(2026-09-26 · `majorsFileFor` — 공고와 **같은 이름 규칙을 불러 쓴다**).
  `data/majors.json` 은 사람·도구용이고 앱은 안 받는다 · 발행 `collector/publish-majors.mjs`
  (majors.mjs 는 **불러오는 순간 API 를 두드려서** 발행만 떼어 놨다) · 앱은 첫 화면에서 안 받고 학교가 정해질 때 받는다.
  🔴 끊기면 **조용하다**(전국 공통 목록으로 물러난다).
  🔴 발행 열쇠는 **`UNIVERSITIES` 의 이름**이어야 한다 — 커리어넷 이름은 다르다(`한국과학기술원`↔`KAIST`).
  이어 주는 표를 새로 만들지 말고 `UNIV_ALIASES` 를 통과시킨다 · `'학교 캠퍼스'` 꼴은 로봇이 발행하지 않는다(부르면 404).
  관문 「분교 이름이 로봇과 앱에서 같은가」 · `verify-onboard-gaps.js`(경희대로 내용을 잰다 — 외대는 손검수 목록이 있어 헛돈다).
- 🔴 **학교가 늘면 정식 등록도 나누라고 데이터가 스스로 말한다**(09-26 지시).
  재는 곳은 `verify/data-weight.cjs` 의 `registeredSplitAdvice` **한 곳**(감사와 수집 리포트가 같이 쓴다 · 선을 베껴 적지 말 것) ·
  뜨는 곳은 수집 리포트 → GitHub 이슈· 경고다(오류로 두면 자동 등록이 멈춘다).
  관문 「학교가 늘면 「정식 등록도 나눌 때」라고 말하는가」.

## 아키텍처 표 (원문 행)

| 파일 | 역할 |
|---|---|
| `collector/collect-news.mjs` `find-news-boards.mjs` `news-kind.mjs` `collect-news-thumbs.mjs` `news-thumb.mjs` | 교내 소식 로봇(따로 돈다) · 공지 게시판 찾기(출처 `news-sources.json` · 후보는 웹 검색 + `evidence`) · 실을지·갈래 판정 한 곳 · 사진 썸네일 단계·고르기 한 곳 |
| `collector/activity-docs.mjs` | 대외활동 자격 **출처만** 늘리는 곳 — 본문 → 요강 페이지 → HWP·DOCX → 그림·PDF(PaddleOCR `collector/paddle-ocr.py`) → 유료 AI(꺼짐). 🔴 자격 줄 고르기는 늘 `activityDetails` 하나 · 남의 글 막기는 `ownsImageText` · 받은 파일은 커밋 안 함 · 관문 「대외활동·공모전 — 첨부·포스터 읽기」 |
| `collector/deepfetch.mjs` `rescue-bodies.mjs` | 본문·첨부 원본 받기 · **원문 받기 로봇**(`.github/workflows/rescue-bodies.yml` · 진짜 크롬 · 하루 두 번) — 장학 본문 재수집 + 대외활동 `activity-docs.mjs --browser`. 🔴 진짜 브라우저로 원문을 받는 로봇은 이것 하나(하나 더 만들면 같은 공고를 두 번 두드린다 · 자격 판정은 유료 확인 — 2026-11-20) · `data/activities.json` 은 안 쓰고 장부 act-browser.json 에만(수집 로봇이 합친다) |
| `collector/link-hunter.mjs` `probe-links.mjs` `resolve-detail-urls.mjs` `detail-url.mjs` `kosaf-hunt.mjs` | 원문 주소 찾기 · 정찰 · 주소 규칙 · 층2 → 재단 개별 공고 후보(재단 홈페이지를 뒤져 `kosaf-hunt.json` 에 · 확인은 link-check · 관문 「층2 재단 글 사냥꾼」) |

## 아키텍처 표 (원문 행 · 둘째 묶음)

| 파일 | 역할 |
|---|---|
| `data/news/` | 교내 소식(학교 공지 게시판 · 제목+링크+수집일 + 그 글의 사진 썸네일 `data/news/img/<해시>.webp` · **학교별 파일뿐** · 옛 통짜 파일 없음) — `docs/designs/news-feed.md` |
| `collector/collect.mjs` `browser-collect.mjs` | 게시판 수집(일반·진짜 Chromium) — 일반 수집기가 같은 행에서 대외활동·공모전도 갈라 담는다(`activity-kind.mjs` · 출처 `activity-sources.json`) |
| `collector/kind-evidence.mjs` `kind-classify.mjs` `scope-promote.mjs` `registered-merge.mjs` `docs-fill.mjs` | 교내·교외 증거 판정 · 원문 도착 뒤 소급 판정(학습 표 `own-programs.json`) · 학교 한정 → 전국 승격 · 합치기 한 곳 · 서류 칸 채우기 |
| `docs/designs/data-model.md` `docs/designs/data-flow.md` `docs/designs/security-rules.md` | **설계 문서 셋** (고문 보고서 Q12) — 저장소 다섯이 각각 무엇을 담는가 · 공고가 폰까지 가는 길과 어디서 끊기는가 · 권한·보안 약속과 그 관문. 사본이라 관문 「CLAUDE.md 가 가리키는 것이 실제로 있다」가 같이 잰다(11-18부터 `docs/designs/news-feed.md`·`docs/designs/activities-tab.md` 도) |

## 날짜에 묶였던 상태 줄 (원문 · 11-18 기준)

- 매 세션 8번의 괄호: (`card-read.yml` 은 11-15 지시로 만들었지만 스위치 `card-read-config.json` 은 리뷰 뒤 꺼 둠 — 켜는 것도 지시 때만)
- **노션에 없고 여기서만 사는 것**: ① 열쇠 만료일은 `docs/backend/keys.json` 한 곳(매일 `key-expiry.yml` 이 14일 전 경보 · 관리자 화면 열쇠는 11-11 재발급).
  🔴 인스타 토큰은 11-18 현재 **재발급 안 됨**(시크릿 `IG_ACCESS_TOKEN` 마지막 갱신 09-12 · 경보 이슈 #519 · 절차 `insta/README.md`) ② 재조사 금지: KOSAF 는 재단은 100% 알지만 **이번 회차는 19%만** 알고 신청서 양식 첨부가 없다(`collector/kosaf-fetch.mjs` 머리말).
