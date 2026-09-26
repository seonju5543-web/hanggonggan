# 한대장 — 프로젝트 인수인계 문서 (Claude 세션용)

> 새 세션은 이 문서를 먼저 읽는다. 개발자는 코드를 모른다 — **전문 용어 없이**, 인과를 분명히 설명한다.
> 여기엔 **규칙과 그 규칙을 지키는 관문 위치**만 둔다. 경위·실측·사고 기록은 `SESSIONS.md`
> (자동으로 안 읽힌다 — 필요할 때 제목으로 찾는다). 정리 직전 전문은 그 파일의
> **「2026-09-23 이관분」** 절에 통째로 있다.

## 🔴 매 세션 이것만은

전부 **실제로 놓쳐서 사고가 난 것**이다. 세션 시작 점검은 `Skill(skill="session-check")` 하나로 끝난다.

1. **화면 이야기는 `node verify/what-shows.mjs <공고 id 또는 이름> [--school= --campus= --major= …]` 로만 한다.**
   그 자리에서 짠 스크립트로 재면 틀린다(목록 5줄 상한 · 상세는 전부). 이 도구는 app.js 함수를 이름으로 떼어 실행한다.
2. **브라우저 검사는 `PORT=` 를 준다.** 8123은 다른 워크트리 서버일 수 있다(남의 코드로 두 번 통과한 적 있다).
3. **검사가 조용하면 통과가 아니라 무력해진 것부터 의심한다.** 새 검사는 고친 것을 되돌려 실패하는지(red-green) 본다.
4. **`data/registered.json`·`forms.json` 은 로봇과 같은 형식(`JSON.stringify(x, null, 1)`)으로 저장한다.**
   다르면 파일 전체가 충돌한다(자동 병합에서 뺀 파일). 끝 개행은 보지 말 것. 손으로 고치기보다 `tools/admin-apply.mjs` 를 쓴다(아래 명령).
5. **확인 안 한 원인을 단정하지 않는다** — 경고 문구에도 보고에도. 원문을 열어 보고 적는다.
6. **개발 업무 질문에는 답 끝에 `node tools/link-wanted.mjs` 결과를 붙여 링크를 요청한다**
   (학습 로봇은 검색을 못 해 사람이 새 링크를 줘야 넓어진다. 주소는 추천하지 않는다).

## 🔴 수집망은 두 곳 그대로 (2026-09-21 지시 — *"내가 말하기 전까지 넓힐 이유가 없어"*)

경희대·한국외대 2곳 확정. 뺀 학교는 `schools.json`·`browser-targets.json` 의 `parked`. 되돌리기는 개발자 지시 때만, **먼저 제안하지 말 것**
(온보딩이 213개교를 고를 수 있어 다른 학교 학생에게 앱이 비는 것은 알고 내린 결정). 기술 고문 요청서(`docs/advisor/`)도
이 전제를 따른다 — 관문 `test-collector.mjs` 「기술 고문 요청서」 · 건수는 `node docs/advisor/check-brief.mjs` · PDF `node docs/advisor/render.js`.

## 관리자 업무 = 노션 백로그 (정본은 노션 하나)

- 노션 Hangonggan › 프로젝트 › 한대장 › 「개발 업무」. 백로그 `data_source 60ac025f-edbd-4284-bb57-5e077bab1c3d` · 작업 현황 `2b015aa3-b2ed-444e-ae5b-bb30a8e14a23`.
  **저장소에 사본(목록·진척도 문서)을 만들지 말 것** — PROGRESS.md 는 2026-09-06 폐기.
- "남은 일/관리자 업무" 질문: `notion-query-data-sources` 로 `상태 != 완료·되돌림` 을 뽑아 **진행중 → 검토 → 예정** 순으로 번호·제목·메모 첫 줄.
  노션이 안 붙은 세션이면 **먼저 그렇게 말하고** 저장소로만 답한다(`audit-data` · `check-deploy-sync` · 최근 커밋).
- **백로그의 일을 했으면 끝내기 전에 노션을 고친다** — 상태 + 상태 메모(날짜·근거·커밋). 없는 일이면 행을 더한다.
  Stop 훅이 '고쳤는데 노션에 안 썼으면' 알린다(막지 않는다). 읽기·실패한 쓰기는 반영이 아니다.
- 「작업 현황」은 로봇(`tools/notion-status.mjs`)이 채운다 — 아래 기술 사실 참조.
- **노션에 없고 여기서만 사는 것**: ① 인스타 토큰 60일 — **2026-11-12 쯤 재발급**(`node insta/token-days.mjs` 의 `살아 있음 · n일` 문장을 본다)
  ② GitHub 관리자 열쇠 만료 2026-11-07(노션 F-4) ③ 재조사 금지: KOSAF 는 재단은 100% 알지만 **이번 회차는 19%만** 알고 신청서 양식 첨부가 없다(`collector/kosaf-fetch.mjs` 머리말).
- 시작 화면(정문 사진 투어링) 현황은 `docs/designs/start-screen.md` 한 장만 읽고 보고한다.

## 서비스 개요

**한대장(한국 대학교 장학금)**: 프로필 1회 등록으로 교내·교외 장학금을 매칭받고, 서류 준비와 **공고 원본 양식 작성**까지 끝내는 모바일 PWA.
배포 https://seonju5543-web.github.io/hanggonggan/ (main push → 자동 배포). 검색·추천·알림은 **영구 무료**, AI 지원서 초안만 소액 유료(`BUSINESS.md`).

## 운영 원칙 (개발자와 합의 — 변경 금지)

1. **정직한 신청 상태** — 실제 접수가 없으면 "신청 완료"라 하지 않는다. 지금은 "신청 준비 완료" + 최종 제출처 안내. 이메일 접수 공고만 실제 전송.
2. **정식 등록은 개발자 컨펌 후** — 예외: `collector/auto-register.mjs` 가 보수적 규칙(개별 실공고·미등록·마감 전·대출/행사/고용/대학원 제외)을
   통과한 것만 자동 등록하고 리포트에 선조치후보고(끄기 `auto-register-config.json` `enabled:false` · 제거 `blockIds`). 애매한 건 '컨펌 대기'로
   리포트에만 — 컨펌은 채팅에서 개발자가 한다. 실시간 공고 피드(제목+링크)는 컨펌 없이 게재.
3. **선조치후보고** — 방향 결정이 필요하면 최적안으로 먼저 조치하고 "어떤 상황에서 어떤 조치"를 보고.
4. **양식 = 공고 첨부 신청서와 동일한 구조**의 문서. 자유 서식 대체 금지. 새 양식은 스키마화해 `data/forms.json` 에.
5. **정식 등록은 양식 등록까지 한 세트** — ① `collector/run-deepfetch.txt` 에 `targets: 키워드` 적어 기본 브랜치 push(첨부 원본+미리보기
   텍스트가 `collector/extracted/` 에 커밋됨) ② 원본 항목·문구 그대로 `forms.json` 에, registered 항목에 `formId` ③ `verify/verify-registered.js`·
   `verify-forms-data.js` 로 검증. 포털 입력형 등은 모든 수단(상세·첨부·재단 홈·fetch-page·정찰)을 쓴 뒤에만 개발자에게 묻는다.
   채울 양식이 없는 공고는 `noForm: "사유"`.
6. **가짜 공지 금지** — 임의 공지를 보여 주지 않는다. 실존 상시 제도는 임의 마감일 없이 '상시 제도' 배지.
7. **소급 적용** — 엔진·정책이 바뀌면 기존 데이터 전체에. 강제 장치 `node verify/audit-data.js`(바꾼 뒤 필수).
8. **진척도는 사용자가 기록**(제출했어요/선정·미선정). '심사'만 객관적 사실(제출 기록 + 마감 경과)로 자동.
8-1. **추론 금지 · 원문 발췌** — 신청 방법·서류는 원문 문장을 그대로 발췌(`collector/extract-excerpts.mjs` → `excerpts`)해 보이고,
   없으면 지어내지 않고 '원문 보기'만. 금액 미확인은 `amountValue 0`.
8-2. **앱이 만든 지원문서는 자유 형식 제출이 원문으로 확인된 공고(`prepDoc: true`)에만.**
9. 🔴 **학교 아이디·비밀번호를 받아 대신 로그인하지 않는다 (2026-09-25 개발자 지시 · 고문 보고서 Q2 · 변경 금지)** —
   스크래핑은 보안 사고 시 치명적이고, 학교가 알아채는 순간 IP 차단과 법적 문제가 된다.
   **어떤 수정 요구가 와도 이 줄은 바꾸지 않는다.** 대신 학생이 직접 로그인한 상태에서 앱은
   **정확한 딥링크만** 넘긴다(`findApplyPortal` · 길은 원문 인용). SSO 는 학교와 정식 협약 이후의 일이다.
10. 🔴 **우리가 대신 보내려면 서버가 다시 본다 (고문 보고서 Q4)** — 지금 메일 버튼은 `mailto:` 라 학생이 제 손으로 보낸다.
   `server/apply/` 의 Resend 발송을 켜는 순간 보내는 주체가 우리가 되므로, 받는 주소·마감·자격을
   **서버가 앱과 같은 엔진으로 다시 판정**하고 클라이언트가 준 주소는 쓰지 않는다. 관문 `verify/verify-apply-guard.mjs`.

## 명령

```bash
node verify/audit-data.js                 # 데이터 감사 — 데이터·엔진 바꾼 뒤 필수 (exit 0 = 통과)
node verify/test-collector.mjs            # 규칙 관문 전부 (인터넷 불필요) — 코드 바꾼 뒤 필수
node verify/check-deploy-sync.js          # 지금 작업이 main(앱)에 나가 있는가 — 끝내기 전
node verify/what-shows.mjs <공고>          # 학생 화면에 무엇이 보이는가
node verify/eligibility-report.mjs --bad  # 자격 줄 전수 재채점 (규칙 전후 숫자 비교가 작업 방식)
ACTION=edit ACTOR=<이름> PAYLOAD='{"edits":[{"id":"…","patch":{…}}]}' node tools/admin-apply.mjs   # 데이터 수정 — 관리자 버튼과 같은 길
ACTION=merge ACTOR=<이름> PAYLOAD='{"keepId":"…","dropId":"…"}' node tools/admin-apply.mjs       # 중복 합치기 (다른 학교끼리면 전국 승격)
bash tools/robot-run.sh node collector/<로봇>.mjs   # 로봇을 로컬에서 돌릴 때 (클라우드와 동시 실행 방지)
```
- 브라우저 드라이버(`verify/verify-*.js`)는 `.github/workflows/verify-ui.yml` 이 관문으로 돌린다(기본 브랜치·main). 로컬은 앱을 띄우고 `PORT=`.
  Mac 에선 `CHROME_PATH` 를 `ls ~/Library/Caches/ms-playwright/` 로 찾는다(버전 번호를 박지 말 것 · README 경로는 Linux용).
- push-to-run(GitHub 연결 없는 세션): `collector/run-*.txt`·`tools/run-gate-photos.txt`·`insta/run-notify.txt`·`deploy/run-deploy.txt` 를 고쳐 기본 브랜치에 push.
- 라이브 앱 확인은 샌드박스에서 github.io 가 막혀 `.github/workflows/check-live.yml` 로그로만 한다.

## 브랜치 · 배포

- **기본 브랜치 `claude/nice-heisenberg-WESq5`** — 예약 워크플로는 여기서만 돈다(두 번째 '기본'을 만들면 로봇이 안 돌고 seen.json 이 갈라진다 · `COLLAB.md`).
  **Pages 배포는 main**. 관례: 작업 브랜치·기본 브랜치·main **세 곳에 같은 내용 push**(main push 전 `git fetch` — 봇이 커밋한다).
- 로봇은 **기본 브랜치에만** 저장하고 `deploy-sync.yml` 이 main 으로 옮긴다. `main-guard.yml` 은 main 직접 수정을 기본 브랜치로 되가져온다.
  워크플로에 `checkout -B main`·`push origin main` 이 들어오면 `check-deploy-sync.js` 가 잡는다.
- **작업 브랜치 하나만 쓰는 세션(휴대폰·웹 세션…)**: `.github/workflows/device-deploy.yml` — Actions 에서 실행하거나 `deploy/run-deploy.txt` 의
  `branch:` 줄에 브랜치 이름을 적어 push. 🔴 `branch:` 대조가 안전장치다(없으면 남의 덜 된 작업이 나간다) · 기본 브랜치를 건너뛰고 main 에만 올리지 말 것.
  다른 컴퓨터에만 있는 브랜치는 먼저 그 컴퓨터에서 `git push -u origin <브랜치>`.
- 🔴 **main 에 브랜치 보호("Require a pull request")를 켜지 말 것** — 로봇 push 가 막혀 배포가 멈춘다. 켠다면 force push·삭제 금지까지만.
- 🔴 **저장소를 비공개로 바꾸면 앱이 즉시 404** (무료 Pages 는 비공개 미지원). 앱을 Cloudflare 로 옮기고 확인한 뒤에만(노션 D-4).
- 🔴 뒤처진 브랜치에 '따라잡기' push 금지 — `paths:` 만 있는 로봇이 그 브랜치에서 돌아 기록장이 갈라진다. 남의 브랜치는 main 으로만 전달.
- 다른 워크트리가 쓰는 브랜치로 빨리 감기만 할 땐 `git push origin origin/main:refs/heads/<브랜치>`.
- 협업 충돌: 로봇 기록장은 `.gitattributes` + `tools/merge-json-union.mjs` 가 자동 합집합(클론마다 `bash tools/setup-collab.sh` — 세션 훅이 실행).
  `registered.json`·`forms.json` 은 **일부러 뺐다**('삭제'가 뜻을 가진다). 누가 한 작업인지는 작성자가 아니라 **브랜치**로 본다.

## 아키텍처 (정적 파일 · 빌드 없음)

화면·엔진 (브라우저·서비스워커·Node 겸용인 것은 **베끼지 말고 불러 쓴다** — 베끼면 화면·알림·감사가 갈라진다)
| 파일 | 역할 |
|---|---|
| `index.html` `style.css` `app.js` | 화면 · 서류보관함(기기 안) · 신청 플로우 · 진척도 · 실시간 공고 |
| `boot.js` `resume.js` | 첫 실행 화면(다른 스크립트보다 먼저) · 다시 열면 어디로 가는가(`docs/designs/first-run-and-resume.md`) |
| `match-engine.js` | 매칭·적합도·학교 범위(`scopedToProfile`)·교내 판정(`noticeKind`·`OWN_PROGRAMS`) — **화면과 알림이 같은 파일** |
| `parse-requirements.js` `section-head.js` | 자격 줄 → 조건 · 절 경계(자격/제외/선발) |
| `parse-amount.js` | 금액 종류·이중수혜·합산(고르기)·등록금 조회 |
| `notify-rules.js` `notify.js` `push-config.js` `sw.js` | 알림 규칙 · 알림 UI · 진짜 푸시 설정 · 서비스워커 |
| `form-plan.js` `forms.js` | 신청서 질문 설계(문서는 한 글자도 안 바뀜 — `verify/form-snapshot.mjs`) · 양식 엔진 |
| `essay.js` `essay-quality.js` `essay-submit-check.js` | AI 초안(유일하게 AI가 문장을 쓰는 곳 — 금지선은 '사실을 만드는 것') · 품질 검사 · 제출 전 점검 |
| `chat.js` | 도우미 — 앱이 아는 것만 답하고 못 찾으면 "못 찾았다". 프로필은 절대 안 보낸다 |
| `interactions.js` | 손짓·움직임(당겨서 새로고침·뼈대) — 판정을 새로 만들지 않는다 |
| `apply-channel.js` | 접수 채널 · 포털 시스템(`findApplyPortal`) |
| `supabase-client.js` `supabase-config.js` | 로그인 — 서버로 나가는 사본은 **`syncSafeProfile()` 한 곳**(주민번호·계좌 제거) |
| `data.js` | 상시 제도 · 대학/별칭/캠퍼스 · 포털 정보 |
| `*-config.js` | 기능 스위치 — 비어 있으면 그 기능이 화면에 안 나온다(push·chat·essay·support·supabase) |
| `terms.html` | 약관·개인정보 — 문의처는 `support-config.js` 와 한 세트(관문 「문의처」) |

데이터
| 파일 | 역할 |
|---|---|
| `data/registered.json` | 정식 등록 공고(층1 · 원문을 읽은 것) |
| `data/forms.json` | 양식 스키마 원본 — 여기에만 추가하면 앱 무변경 반영 |
| `data/notices.json` | 실시간 공고 피드 |
| `data/activities.json` | 대외활동·공모전 피드(제목+링크 · 장학 피드와 **섞지 않는다**) — `docs/designs/activities-tab.md` |
| `data/external.json` | 재단·지자체 게시판 공고(교외 확대 · 학교 없는 전국 글 · 주최는 `host`) — `docs/designs/external-sources.md` |
| `data/kosaf-open.json` `data/kosaf-files/` | 층2 — 한국장학재단이 아는 재단 장학금(마감 전만) · 선발공고문 사본. 층1과 섞지 않는다 |
| `data/tuition.json` | 등록금(학교·계열) |

로봇 · 서버 · 관리자
| 파일 | 역할 |
|---|---|
| `collector/collect.mjs` `browser-collect.mjs` | 게시판 수집(일반·진짜 Chromium) — 일반 수집기가 같은 행에서 대외활동·공모전도 갈라 담는다(`activity-kind.mjs` · 출처 `activity-sources.json`) |
| `collector/auto-register.mjs` | 자동 정식 등록(원칙 2) |
| `collector/extract-excerpts.mjs` | 원문 발췌 · 마감일 · 메일 접수 주소(`apply-email.mjs`) |
| `collector/deepfetch.mjs` `rescue-bodies.mjs` | 본문·첨부 원본 받기 · 옛 공고 본문 메우기 |
| `collector/schematize-forms.mjs` `schema-from-text.mjs` | 양식 스키마화(무료 우선, 못 하는 것만 API) |
| `collector/link-hunter.mjs` `probe-links.mjs` `resolve-detail-urls.mjs` `detail-url.mjs` | 원문 주소 찾기 · 정찰 · 주소 규칙 |
| `collector/notice-source.mjs` `canon-url.mjs` `url-key.mjs` `clean-title.mjs` | '같은 공고인가'·'원문이 무엇인가' 규칙 한 곳 |
| `collector/kosaf-*.mjs` | 층2 수확 · 첨부 사본 |
| `collector/pdf-text.py` `ocr-text.py` `hwp-*.py` | 첨부 글자 뽑기(`.ocr.txt` 는 품질 관문 통과분만) |
| `verify/entry-rules.cjs` | 등록 규칙 한 곳 — 로봇(등록 전)과 감사(사후)가 같이 쓴다. **새 규칙은 여기에만** |
| `_admin/` `tools/admin-apply.mjs` `tools/edit-diff.mjs` | 관리자 화면(Cloudflare Pages + Access) · 저장 경로 · 칸 정리 |
| `server/push/` `server/chat/` `server/essay/` `server/mail-worker.js` | 푸시(가동) · 도우미 AI·초안·메일(배포 대기) |
| `insta/` | 인스타 카드뉴스(`insta/README.md` · 스킬 `insta-revise`·`insta-template`) |
| `tools/notion-status.mjs` | 노션 「작업 현황」 로봇 |
| `DESIGN.md` | 디자인 값의 사람용 사본 — 원본은 `style.css`, 관문 `verify/ui-tone.mjs` |
| `docs/designs/data-model.md` `docs/designs/data-flow.md` `docs/designs/security-rules.md` | **설계 문서 셋** (고문 보고서 Q12) — 저장소 다섯이 각각 무엇을 담는가 · 공고가 폰까지 가는 길과 어디서 끊기는가 · 권한·보안 약속과 그 관문. 사본이라 관문 「CLAUDE.md 가 가리키는 것이 실제로 있다」가 같이 잰다 |

## 중요한 기술 사실 (재발견에 시간 쓰지 말 것)

각 줄의 경위는 `SESSIONS.md`(특히 「2026-09-23 이관분」)에서 제목으로 찾는다.
"관문 「X」" 는 `verify/test-collector.mjs` 의 절이다 — `grep -n "■.*X" verify/test-collector.mjs` 로 찾는다.
파일 이름만 적힌 관문(`verify-*.js` 등)은 `verify/` 에 있다.

### 판정 · 자격

- **🔴 틀린 미달은 못 받는 것보다 나쁘다 · 판정 못 하는 축은 '틀린 안심'이다.** 확신 낮은 어긋남은 '모름'(`lineVerdict`). 배지·정렬은 `app.js fitVerdict` 한 곳.
- **🔴 퍼센트를 숫자로 비교하지 말 것** — 판정 근거는 `met/total`·`fails`. 규칙은 `verify/fit-consistency.cjs` 한 곳, `=== 'no'` 로 본다. 관문 「적합도 상수」.
- **🔴 자격/제외/선발은 낱말이 아니라 절 경계로** — `section-head.js`(베끼지 말 것 · `index.html`·`sw.js` 모두 match-engine 보다 먼저 싣는다).
  채점기(`eligibility-report.mjs`)는 **필터와 다른 축**으로 본다 — 같은 규칙을 쓰면 새 유형을 영영 못 본다.
- **`※` 자격 줄**은 증명한 꼴(`EXCLUDE_LINE`·`AFFIRM_ELIG`)만 통과 — 통째로 열면 잡음이 돌아온다. 줄의 주장은 끝에 있다(`ENDS_AFFIRM`).
- **학과·전공**: 포함 단어 목록은 미달까지 · 계열은 맞으면 ✓ 어긋나면 모름 · 학과 **이름**은 같은 글자로만(부분 일치 금지 — 국제학부↔국제통상) ·
  `○○ 관련 학과` 의 **분야 이름**(`field:true`)만 포함 대조(원자력공학과 ✓, 다른 학과는 모름 — 연계 전공 가능). 관문 「학과·전공·계열 요건」 · 「여러 대학만 받는 공고」.
- **「또는」 줄**: 처지(trait) 축에서만, 맞은 조건이 반대편 갈래에 있고 공통 꼬리가 없을 때만 푼다(`dropUnchosenOrTraits` 한 곳). 줄 전체를 OR 로 쪼개지 말 것. 관문 「또는 줄의 처지 판정」.
- **처지(trait) 넓히기**: 걸리는 줄을 전부 찍어 보고 「전부 예」·「전부 아니요」 프로필로 잰다. 제외 칸에선 결격(징계)만 미달. 넓히지 말 것 넷 —
  성별 · `\d자녀 이상` · 기숙사의 재사생/학숙 · 맨 `유공자`. 관문 「처지 요건」 · `docs/designs/eligibility-ask.md`.
- **'자격을 못 읽는다'의 원인은 대개 '본문을 못 받았다'** — 본문 판정은 실제 분량(한글 `MIN_BODY`)으로, 발췌기·AI와 같은 말뭉치로. 짐작 말고 `run-probe.txt` 에 `checkUrl:`.
- **'지원 자격'에 잡음이 섞이면** 규칙을 덧붙이지 말고 채점기를 본다. 우선 선발 기준은 버리지 않고 자리를 옮긴다. 발췌 칸은 14개.
- **학교 범위**: `eligibility.schoolOnly`(한 학교) · `campusOnly` · **`schoolsAny`**(여러 학교 — `"학교"` 또는 `"학교|캠퍼스"`, `inSchoolsAny`).
  자동 등록은 늘 게시한 학교로 `schoolOnly` 를 단다 — **재단·구청·KOSAF에 직접 내는 것은 전국**, 학교 창구(장학팀·포털·추천 배정)로 받는 것만 그 학교.
  새로 묶인 것은 관리자 「할 일」의 '교외인데 한 학교에만' 묶음에 뜬다. 칸을 새로 만들면 `admin-apply.mjs`·`edit-diff.mjs` 의 `ELIG_KEYS` 에도(안 하면 저장 때 조용히 버려진다).
- **분교 ≠ 이원화** — 분교는 `UNIVERSITIES` 에 별개 학교, 이원화는 `CAMPUSES_BY_SCHOOL`. 게시판 공유 분교 판정은 `noticeForProfile` 한 곳(data.js 금지 — sw 가 안 읽는다).
- **'오늘'을 상수로 굳히지 말 것** — `todayStart()` 가 부를 때마다 읽는다(PWA 는 며칠씩 떠 있다). 관문 「마감 판정이 앱을 켠 시각에 굳지 않는다」.

### 교내/교외 · 제목 · 금액 · 마감

- **🔴 교내/교외·주관 기관은 게시판이 아니라 '주는 곳'** — 판정은 `noticeKind` 한 곳. 교내는 제목 표식 또는 **`OWN_PROGRAMS`**(원문을 읽고 확인한 학교 자체 제도 ·
  근거는 `docs/designs/on-campus-programs.md` 에 인용과 함께). 등록 단계에서만 쓰고 앱 게시판 카드엔 안 쓴다. 낱말로 '교외'를 찾지 말 것 · `교내외` 는 교내 아님.
  소급은 `entry-rules.cjs checkEntry`(경고 — 오류로 두면 자동 등록이 멈춘다 · 판정 함수는 `opts.noticeKind` 로 받는다). ⚠️ 감사는 **id**로 출력한다 — 이름으로 grep 하면 못 찾는다.
- **카드 제목은 기관명을 담는다**(`cardTitle` = `cleanCardTitle` — 게시판 대괄호·꼬리 날짜만 뗀다) · 기관명은 윗줄에서 뺀다. 관문 「카드 제목」.
- **🔴 금액: 합산은 더하기가 아니라 고르기**(같은 장학금 한 번 · 배타 그룹 최대 하나) · 표 등록금은 1년치 → `tuitionFor` 에서 학기 환산 ·
  이중수혜 범위는 원문 한정어로(`external`/`narrow` — `all` 로 바꾸지 말 것) · 칸 이름은 `amountSpec` · 머리글은 콜론 앞 이름표로 · `유의사항` 절은 금액이 아니다.
  못 읽은 금액은 **홈 합계에서만** 중앙값으로 어림(`amountValue` 엔 안 적는다 — 감사가 막는다). 관문 금액 절.
- **🔴 마감일은 이름표(`신청기간 :` 등) 뒤 날짜만** — 게시일·조회수·다른 공고 날짜가 섞여 있다. 못 믿으면 비운다. 관문 「마감일」.
- **달력·저장은 '내 것'만 찍는다**(마감 파랑·발표 빨강 둘뿐) · `state.saved` 를 `applications` 와 합치지 말 것. `docs/designs/calendar-and-save.md`.
- **2026-09-17 결정 셋**: 홈 순서 = 적합도 − 남은 날(`byHomeOrder` · 마감 모르는 공고에 가짜 14 금지) · 앱 내부 사정은 학생 화면에 안 적는다
  (관리자로 옮김 · '자격 미확인' 배지는 남긴다) · 못 읽은 금액 어림은 `renderHome` 한 곳.

### 층2(KOSAF) · 접수 채널 · 인스타

- **층2는 층1과 섞지 않는다** — 자격 진단·양식을 붙이지 않고 재단 칸을 그대로 보인다. `due` 가 빈 재단을 버리지 말 것(모집 중일 수 있다) ·
  수확 때 지난 상세를 이어받는다 · `goods:'학자금'`(대출)은 뺀다 · 첨부 원주소는 담지 않고 사본을 준다 · 첨부 칸을 낱말로 찾지 말 것 ·
  사본을 서비스워커가 가로채지 않게 · 신청 양식은 아직 안 붙인다(사본 대부분이 공고문 → 가짜 양식이 된다). 관문 「층2 첨부」·`verify-kosaf.js`.
- **메일 접수**(`collector/apply-email.mjs`): 문의처는 접수처가 아니다 · 남(교수)이 내는 것은 학생이 내는 것이 아니다 · 근거 문장(`applyEmailSource`) 없이 주소만 넣지 말 것 ·
  버튼은 `mailto:` 라 서버가 필요 없다. 관문 「메일 접수 주소」.
- **포털 신청**(`findApplyPortal`): 한 학교가 시스템을 둘 쓴다 · 양식 받는 곳·결과 보는 곳·계좌 등록은 접수처가 아니다 · 길은 원문 그대로 인용 ·
  주소를 짐작해 채우지 말 것 · 열쇠 글자는 `PORTAL_SYSTEMS`↔`PORTAL_SYSTEM_INFO` 같게. 관문 「포털 신청 시스템」.
- **대외활동·공모전 탭** (2026-09-25 · 노션 UI-34): 판정은 `collector/activity-kind.mjs` `activityKind` 한 곳(장학 제도는 장학 쪽 · 공모전은 장학 낱말이 있어도 공모전) ·
  파일·장부는 장학 피드와 **따로**(`data/activities.json` · 섞으면 알림이 활동 글로 운다) · 학교 범위는 `activityForProfile` · 카드는 `noticeCardHtml` 한 벌 ·
  전용 게시판 주소는 **개발자가** `activity-sources.json` 에 적는다(null = 리포트에 '주소 미설정'). 관문 「대외활동·공모전」 · `verify-activities.js`(서비스워커를 막고 잰다).
- **재단·지자체 게시판(교외 확대)** (2026-09-26 · 노션 F-13): 링커리어류는 크롤링이 아니라 **주최사 직접 등록**이라 긁지 않는다 — 우리는 주최의 제 게시판을 읽는다.
  출처 `collector/external-sources.json` 은 `kosaf-open.json` 의 재단 홈페이지에서 왔고, `collector/find-boards.mjs` 가 게시판을 찾아 `autoFound` 로 적는다(잘못 찾으면 `parked`).
  글은 `data/external.json`(학교 피드와 따로) → 홈 「재단·지자체 새 공고」(`externalNoticesHtml` · 등록된 주소는 `registeredUrlMatcher` 로 뺀다). 링크 읽는 눈은 `collector/board-links.mjs` 한 곳. 관문 「재단·지자체 게시판」.
- **학자금대출**은 정식 등록 제외(대출 원금·이자를 지원하는 장학금은 제외 대상 아님 — `LOAN_EXCEPT`) · 피드에선 빼지 않고 장학 공고 뒤로 보낸다(`boardNoticesForMe`).
- **인스타**: 🔴 게시는 사람만 누른다 · 토큰은 워크플로에만 · 한 실행 최대 6건 · 수정은 다시 그려 **보여 주고 메일 보낼지 물은 뒤** push-to-run(스킬 `insta-revise`).
  관문 `verify-insta.js` · `docs/designs/instagram-pipeline.md`.

### 화면

- **화면을 바꾸면 검사 드라이버도 같이 옮긴다 — 검사만 고쳐 통과시키지 말 것.** 승인 화면은 드라이버가 문구·개수까지 잠근다(스킬 `approved-design`).
- **드라이버에 온보딩 단계 번호·공고 id·브라우저 경로·포트를 박지 말 것** — `verify/onboard-helper.js`(`nextUntil`·`dismissNotify`) · `pickTarget`.
  알림 동의 시트는 2.9초 뒤 떠서 클릭을 막는다 → `dismissNotify(page)`. 관문 test-collector 정적 검사.
- **그려 놓고 센다** — 카드는 함수가 여럿이다(`schCard`·`liveNoticesHtml`). 값이 같아도 모양이 다를 수 있다(관리자 화면 · `verify-admin-shape.js`).
- **서체 Pretendard 한 벌 · 작은 척도**(09-11 되돌림). 다시 바꾸자는 제안은 화면을 보여 주고 정한다. 파일 끝 카드 블록이 앞 규칙을 덮는다.
- **디자인 토큰**: 원본 `style.css`, 관문 `ui-tone.mjs`(토큰 이탈 톱니 · 괄호 짝 · 병합 충돌 표식). 🔴 CSS 에 남은 충돌 표식·짝 없는 `}` 는 조용히 규칙을 삼킨다.
- **시트는 전부 아래로 쓸어 닫는다** — `enableSheetSwipe` 한 곳 · 판정은 `scrollableAtTop` · 회귀는 TouchEvent 로.
- **설정 화면**: `#my-account`·`#my-notify` id 는 자리만 옮겼다(이름 바꾸지 말 것) · 약관은 앱 안 화면(`renderTerms` 가 `terms.html` 을 읽는다) · 휴지통 30일.
- **첫 화면**: 감추지 않은 화면이 하나면 그게 첫 화면이 된다 · CSP 가 인라인·`onclick=` 을 막는다 · 저장은 `visibilitychange` 로(`beforeunload` 금지) ·
  부팅 화면 바닥값 1초(`performance.now()` 금지) · 알림 딥링크는 목록을 기다렸다 연다. 관문 `verify-resume.js`.
- **시작 화면**(정문 투어링): `docs/designs/start-screen.md` · `.onboard-step[data-step="0"]` 의 `flex: none` 을 빼면 높이 0 · 사진은 위키미디어 열린 라이선스만.
- **개발자가 정한 화면 결정 (되돌리지 말 것)**: 카드 마감은 `D-3` 글자 하나(빨간 막대 삭제) · 적합도는 알약 · 누르면 회색 판이 아니라
  글자색이 바뀐다(탈퇴 제외 · `:active` 는 마우스가 아니라 CDP 로 잰다) · 패럴랙스 없음 · MY 프로필 카드는 통째 버튼이 아니다(`.my-edit-hint` 만) ·
  여백은 상자 사이가 아니라 **글자와 글자 사이**로 잰다 · 화면 제목 밑줄은 글자 폭 · 구분선은 목록에만. 관문 `verify-settings.js`.
- 일괄 신청 준비는 `confirm()` 이 아니라 앱 목록(`renderBulkPrep`) · 시트 그릇은 `#detail-sheet` · 체크해도 다시 그리지 않는다.
- 기다림이 보이는 곳은 실시간 공고 구역 하나(`allScholarships` 가 상시 제도를 먼저 준다). 못 받아 왔을 때 `null` 로 두지 말 것(뼈대가 굳는다).

### 로봇 · 워크플로

- **🔴 로봇이 고친 파일은 전부 `git add` 에** · 없을 수 있는 파일은 `[ -f … ] && git add` · 데이터 관문(감사)은 저장 직전 · 감사 실패면 결과가 하나도 안 남는다.
- **🔴 모든 워크플로에 `timeout-minutes`** · 보강 단계는 `timeout-minutes` + `continue-on-error: true` · 실패 알림은 `if: failure() || cancelled()` ·
  학교마다 `withDeadline()` 절대 시한 · 전역 예산(`harvest-budget.mjs`) 안에 스스로 끝낸다(상한을 올리는 건 해법 아님) · 넘어져도 `saveAll()`.
- 대기줄(concurrency)을 하나로 합치지 말 것(대기 실행이 취소된다) · 예약은 정각·UTC 자정을 피한다(지연·누락이 실제로 났다 · 관례는 홀수 분) · 새 공고 0건이면 이슈 대신 코멘트.
- 문법 검사는 `node --check` — `import('./x.mjs')` 는 **실행된다**. 불러오는 순간 실행되는 파일(auto-register·schematize)은 가져다 쓰지 말 것.
- **원문 링크는 그 공고 하나로** — 주소를 유추하지 말고 게시판 폼을 그대로 · 세션 없는 새 탭에서 열어 확인 · '못 읽음'과 '다른 글'을 구분 ·
  같은 학교를 하루에 여러 번 두드리지 말 것 · 못 찾으면 `#n-` 표식(앱이 '게시판 목록 ↗'). 사냥꾼이 못 찾는 이유는 대개 `boardTitle` 이 없어서.
- 주소 같음 판정 `urlKey()`/`canonUrl` 한 곳 · 공고 상한 `capNotices()` · 실시간 공고 60일 · 정식 등록은 마감+30일, 마감 없으면 `listedAt`+60일(`notStale`).
- 폰은 `notices.json` 을 통째로 받는다 — 실질 한계 50~100개교, 40곳쯤에서 학교별 파일로 나눈다(미리 하지 말 것).
- 브라우저 수집 게시판 연결이 안 되면 리포트의 진단(프레임·클릭·본 글자)부터 본다. 짐작 말고 스킬 `probe-run`.

### 알림 · 업데이트 · 보안

- 진짜 푸시 가동 중(`server/push/` · 내용 없는 깨우기 → 폰이 기기 안 프로필로 문구를 만든다). 푸시를 받으면 보이는 알림 1건 필수. iOS 는 홈 화면 설치 후만.
- **푸시 등록**: 브라우저의 실제 구독을 본다 · '껐다'와 '못 읽었다'를 구분(`shouldSelfUnsubscribe`) · 옛 주소는 서버에서도 지운다. 살아 있는지는 `push-check.yml` 발송만이 증명.
- 장부는 IndexedDB(`handaejang-notify` — sw 는 localStorage 를 못 읽는다). "폰이 꺼져 있어도 즉시"라고 쓰지 말 것.
- 서비스워커는 코드·데이터 모두 네트워크 우선 + `cache:'no-cache'` + 3.5초 폴백. 버전 인상은 옛 캐시 청소용 관례.
- CSP(`script-src 'self'`) · 모든 렌더링 `esc()`(HTML 기호 되돌림은 `esc()` 앞) · 개인정보는 기기 안에만(로그인 사본은 `syncSafeProfile`).
- 로그인 토큰 갱신은 탭 간 Web Locks + 다시 읽기 + `waitForOtherTabRefresh` 세 개가 한 세트('서버 한 번만'을 관문으로 세우지 말 것). 관문 `verify-supabase.js`.
- 🔴 **기기 사이 덮어쓰기**: push 는 **내가 본 판이 아직 서버에 있을 때만** 고친다(조건부 PATCH · 0행이면 `conflict`). 안 그러면 폰 A 가 올린 신청서가 폰 B 의 저장 한 번에 사라진다(실측). 🔴 **고문 보고서 Q6 의 '칸을 쪼개라'로는 안 고쳐진다** — 옛 기기가 쪼갠 칸을 제 옛 값으로 똑같이 덮는다. 합치는 규칙은 `syncApplyRemote` 한 곳이고 충돌 때는 방향이 반대라 `{quiet:true}`(프로필은 이 기기 것 · 신청내역은 합침 · 화면 안 그림). ⚠️ 진짜 Postgres 의 시각 비교는 아직 안 눌러 봤다. `docs/designs/sync-overwrite.md` · 관문 `verify-supabase.js` [9].

### 관리자 화면 · 외부 서비스

- 주소 https://hanggonggan-admin.pages.dev (Cloudflare Access 잠금 · 매일 `admin-lock-check.yml`). 학생 주소에 안 뜨는 근거는 Jekyll 이 `_admin/` 을 빼는 것 하나 —
  **`.nojekyll`·`_config.yml` 을 추가하면 즉시 노출**(`check-live.yml` 이 확인).
- 버튼은 저장소를 직접 고치지 않는다 — `admin-apply.yml` 을 깨우고 감사를 통과해야 저장. 이 워크플로는 **기본 브랜치에 있어야** 버튼이 동작한다.
- 공용 코드는 `_admin/build.sh` 가 `dist/vendor/` 로 복사한다 — 베끼지 말고, 부르는 이웃까지 옮긴다(관문 `verify-admin-vendor.js`). Cloudflare 빌드 감시 경로에 그 원본들만.
- 디자인은 앱1 한 벌(`admin.css :root` = style.css 실효값) · 서체 링크와 CSP 는 `index.html`·`_admin/index.html` 두 곳 한 세트 · `[hidden]{display:none!important}`.
- 관리자 열쇠는 Actions 쓰기 + Contents 읽기만(fine-grained · 공동작업자는 classic `repo`+`workflow`). 화면만 보려면 `node tools/build-admin-preview.mjs`.
- Oracle 자체 러너는 쓰지 않기로 결정(08-03) · 브라우저 로봇은 Cloudflare 로 못 옮긴다 · 앱 주소가 박힌 곳 8군데는 옮길 때 한 상수로.
- 노션 「작업 현황」 로봇: push 한 사람 줄에 **이 push 가 올린 커밋**으로 적는다(`--author` 아님 · `noreply@anthropic.com` 을 emails 에 넣지 말 것) ·
  커밋 개수는 적지 않는다 · push 트리거에서 브랜치를 거르지 않는다 · 통합에 페이지 '연결' 안 하면 404. 관문 「노션 「작업 현황」」.

### 훅 · 검사 운영

- 검사는 '돌리라고 적어 두면' 안 돈다 — 워크플로·훅에 걸어야 돈다. 새 사고는 **먼저 관문을 만들고** 여기엔 그 위치만 적는다.
- 훅은 스킬 호출을 장부(`.claude/hooks/skill-ledger.sh`)에 적는다. Stop 훅이 **막는 것은 디버깅 빚뿐**(verify 빨간불 뒤 `systematic-debugging` 미호출), 리뷰는 알림.
  빚 관문·노션 표식은 조기 종료보다 **위**에 둔다. 리뷰 스킬이 서브에이전트를 못 쓰면 diff 를 직접 보되 항목을 하나씩 짚는다.

## 제안서 → 진짜 원클릭 (개발자에게 설명할 때)

마지막 제출은 학교 시스템이라 앱이 못 누른다. 장학팀 제안서가 문을 연다 — ①정보 연계(공고 직접 제공) ②표준화 접수 파일럿(이메일 접수 공식 인정 →
그때부터 "신청 완료"를 정직하게 쓸 수 있다) ③학사 연동(증명서 발급 소멸). PDF 는 `proposals/`.

## 앞으로 여기에 쓸 때의 규칙

- **한 항목은 규칙 한두 줄 + 관문 위치.** 경위·실측·사고는 `SESSIONS.md` 로.
- **현황 숫자를 적지 않는다**(사본은 반드시 낡는다) — 필요하면 그때 센다.
- 🔴 관문: `test-collector.mjs` 「CLAUDE.md 부피」 — **60KB · 400줄 · 한 항목 20줄**을 넘으면 실패한다
  (줄 수만 세던 시절 한 줄에 3,600자를 몰아 써서 153KB 까지 불었다).
- 🔴 관문: 같은 파일 「CLAUDE.md 가 가리키는 것이 실제로 있다」 — 백틱·명령 블록의 **파일 경로**, 백틱의 **함수·칸 이름**,
  「관문 「X」」의 **절 이름**이 코드에 없으면 실패한다. 이름을 바꾸면 이 문서도 같이 고친다. 코드에 없는 이름(MCP 도구 등)은 그 절의 예외 목록에.
  두 문서 관문은 로컬·`verify-ui.yml`(`DOC_GATES=1`)에서만 실패하고 **수집 로봇에선 건너뛴다**(문서 오타로 자동 등록분이 되돌려지면 안 된다).

## 커밋 규칙

- 커밋 끝에 Claude-Session 링크 관례 유지. PR 은 요청 시에만.
