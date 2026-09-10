# 인스타 카드뉴스 — 쓰는 법

> 규격은 `SCRIPT.md`, 판형은 `DESIGN.md`, 설계 경위는 `../docs/designs/instagram-pipeline.md`.
> 사실 관문은 `../verify/verify-insta.js` (C1~C10) — 워크플로가 돌린다.

## 관리자: 게시

Actions → **「인스타 카드뉴스 게시」** → Run workflow. **버튼을 두 번** 누른다.

| | 고르는 것 | 하는 일 |
|---|---|---|
| ① | `준비만 (그리고 커밋)` | 오늘 올릴 공고를 고르고 · 카드와 캡션을 그리고 · 커밋한다 |
| ② | `게시 (준비된 것을 올린다)` | **①이 커밋한 그 폴더를 그대로** 인스타로 올린다 |

①이 끝나면 실행 요약에 캡션·공고가 뜨고 카드가 아티팩트로 붙는다. **눈으로 보고** ②를 누른다.
🔴 ②는 **다시 그리지 않는다** — 다시 그리면 그새 데이터가 바뀌었을 때 본 것과 다른 게 올라간다.
🔴 ① 뒤에 Pages 배포가 끝나야 ②가 된다(실측 약 2분). 인스타는 파일 업로드를 안 받고
   **공개 주소**를 요구해서, 우리가 먼저 그 주소를 열어 보고 기다린다.

공고를 직접 고르려면 `notice` 칸에 이름 일부를, 판형을 고정하려면 `tpl` 을 준다(기본은 씨앗이 정한다).

## 처음 한 번: 계정 붙이기

1. 인스타를 **프로 계정**(비즈니스/크리에이터)으로 바꾸고 **페이스북 페이지**에 연결한다
2. Meta 앱을 만들고 그 계정을 **Instagram Tester** 로 넣는다
   🔴 자기 계정에만 올리면 **앱 심사는 필요 없다**(조사로 확정 · 재조사 금지)
3. 저장소 Settings → Secrets → Actions 에 둘을 넣는다
   · `IG_USER_ID` — 인스타 비즈니스 계정 ID
   · `IG_ACCESS_TOKEN` — **장기** 액세스 토큰(60일)
4. 「인스타 토큰 수명 확인」 을 수동 실행해 초록불을 본다

토큰은 60일이면 만료된다. 매일 03:17 KST 에 확인해서 **14일 안이면 🚨 이슈**로 부르고,
갱신하면 그 이슈가 자동으로 닫힌다. 🔴 갱신은 사람이 한다 — 자동 갱신을 하려면 앱 시크릿과
시크릿 쓰기 열쇠를 저장소에 둬야 하는데, 그게 새면 남이 우리 계정에 글을 올릴 수 있다.

## 손으로 돌려 보기

```bash
node insta/pick.mjs --list                     # 오늘 후보를 점수·근거와 함께
node insta/render.mjs <공고이름> --tpl=all      # 카드 15장 + 캡션 (insta/out/)
node insta/render.mjs <공고이름> --caption      # 캡션만
node insta/preview.mjs photo                   # 피드 크기 미리보기 한 장으로
node insta/school.mjs                          # 교내 공고(경희대·한국외대) 목록
node insta/sweep-overflow.mjs                  # 전수 넘침 측정 (약 3분)
node verify/verify-insta.js                    # 사실 관문
```

## 파일

| 파일 | 하는 일 |
|---|---|
| `notices.mjs` | **무엇을 올릴 수 있나** — 교외(KOSAF) + 교내. 다른 파일은 다 이걸 본다 |
| `school.mjs` | 교내 공고를 카드 재료로. 자격/제외 가르기는 `section-head.js`·`match-engine.js` 를 쓴다 |
| `pick.mjs` | 오늘 올릴 공고 + `seen.json` |
| `render.mjs` | 카드 5장 · 판형 3벌 · 캡션 호출 · `--pub` 으로 게시용 내보내기 |
| `caption.mjs` | 캡션 (`ctx` 만 받는 순수 함수 — 🔴 CLI 를 두면 순환 import 로 멈춘다) |
| `fit.mjs` | 글자를 카드에 맞추는 **한 곳** — 렌더러와 스윕이 같이 쓴다 |
| `publish.mjs` | Graph API 캐러셀 2단계 · 기본은 예행연습 |
| `token-days.mjs` | 토큰 남은 수명 |
| `photos.json` · `find-photos.mjs` | 표지 사진(위키미디어 공용) |
| `pub/<날짜>/` | 🔴 **일부러 커밋한다** — Pages 가 서빙해야 인스타가 가져간다 |
| `out/` | 작업용. `.gitignore` |
