---
name: insta-revise
description: Use when a developer asks in chat to change an Instagram card that was mailed to them (판형·글꼴·색·문구·배치 — "이 공고 3번으로", "글꼴 바꿔", "2장 줄여") in this repo (hanggonggan/한대장). Fixes the order of work the developer set on 2026-09-12 — redraw, SHOW the picture, ASK before mailing, then mail via push-to-run.
---

# 인스타 카드 채팅 수정 (2026-09-12 개발자 지시 ③)

> "메일로 발송된 게시물 초안은 개발자 셋 모두 즉시 Claude Code 채팅으로 디자인·폰트 등 모든 부분에서
> 수정이 가능해야 함. 수정 시 실제 수정본 카드뉴스 사진을 개발자에게 제시하고, 완성된 수정본은
> 개발자에게 메일로 발송할까요? 물어보고 발송."

순서가 규칙이다. **고친다 → 보여 준다 → 묻는다 → (답을 듣고) 보낸다.** 하나라도 건너뛰면 사고다.

## 1. 어느 게시물인가

- 개발자가 준 것: 공고 이름 일부·코드·메일 제목. 코드가 없으면 `node insta/ledger.mjs show` 로 준비 장부에서 찾는다.
- `insta/pub/<코드>/meta.json` 이 지난 값(판형 번호 `tplNo`·`skin`·`font`·`seed`)이다. **안 바꾸라고 한 것은 그대로** 둔다.

## 2. 고친다 — 두 갈래

| 요청 | 하는 일 |
|---|---|
| 판형·글꼴·색·씨앗만 | `node insta/revise.mjs <코드> [--tpl=번호] [--font="구글 폰트 이름"] [--skin=blue\|marker\|folder\|minimal] [--seed=N]` — 안 준 값은 지난 값 그대로 |
| 문구·배치·크기 (판형 코드 자체) | `insta/render.mjs` 의 내장 판형(1~3번) 또는 `insta/templates/<번호>-<id>.mjs` 를 고친 뒤 **같은 명령으로 다시 그린다** |

- 🔴 사실 문장은 **원문(ctx)에서 온 것만**(원칙 8-1). "문구 바꿔" 가 우리 말(후킹·안내·앱 전환)이면 바꾸고,
  공고의 자격·금액·기간이면 **바꾸지 않고 왜 못 바꾸는지** 말한다.
- 🔴 판형 번호는 `insta/templates.json` — "3번" 은 늘 같은 판형이다. 번호를 바꾸거나 끼우지 않는다.
- 🔴 이 샌드박스에서 그리려면 폰트 중계가 필요하다:
  `INSTA_DEV_FONT_RELAY=1 NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node insta/revise.mjs …`
  (`npm i playwright@1.56.1` 이 먼저 — 미리 깔린 크로미움 1194 와 맞는 판. 루트 `node_modules`·`package.json` 은 커밋하지 않는다.)
- 판형 코드를 고쳤으면 관문 둘: `node verify/verify-insta.js` · `node insta/sweep-overflow.mjs --tpl=<번호>`.

## 3. 보여 준다 — 말로 하지 않는다

`insta/out/_preview-<코드>.png` (revise.mjs 가 만든다) 를 **개발자에게 그림으로** 보낸다(`SendUserFile`, 없으면 `Read` 로 열어 확인한 뒤 경로를 준다).
무엇을 바꿨는지 한 줄(판형 2번→4번 · 글꼴 Gaegu). 안 바뀐 것을 바뀌었다고 하지 않는다.

## 4. 묻는다 — 답을 듣기 전에 보내지 않는다

> "이 수정본을 개발자 세 분께 메일로 보낼까요?"

- 이 질문은 **AskUserQuestion 이 아니라 그냥 채팅으로** 묻는다(자율 세션에서도 이 물음은 건너뛸 수 없다 — 개발자가 정한 절차다).
- "아니" 면 거기서 끝. 카드 폴더는 고쳐진 채 남고(관리자 화면에도 그 판이 보인다), 메일은 안 간다.
- 더 고쳐 달라고 하면 2로 돌아간다.

## 5. 보낸다 — 워크플로가 보낸다, 세션이 직접 보내지 않는다

1. `insta/run-notify.txt` 의 `code:` 줄에 코드, `at:` 줄에 지금 시각(같은 코드를 다시 보낼 때 push 가 '변경' 이 되게).
2. 커밋에 담는 것: `insta/pub/<코드>/` · `insta/seen.json` · `insta/run-notify.txt` · (고쳤다면) 판형 파일.
   🔴 `insta/out/` · `node_modules` · `package.json` 은 담지 않는다.
3. **기본 브랜치**(`claude/nice-heisenberg-WESq5`)에 닿아야 워크플로가 돈다. 작업 브랜치만 쓰는 세션이면
   `deploy/run-deploy.txt` 의 `branch:` 줄로 「이 기기에서 배포」 를 태운다(CLAUDE.md 「휴대폰·웹 세션…」).
4. 워크플로 「인스타 카드뉴스 게시」 가 그 폴더를 **다시 그리지 않고** 개발자 셋에게 이슈(담당자 지정)로,
   시크릿이 있으면 메일로도 보낸다. 실행 주소를 개발자에게 준다.

## 하지 않는 것

- `--publish` 로 올리기. 게시는 관리자 화면(또는 Actions 「게시」)에서 사람이 누른다.
- 메일을 세션이 직접 보내기(SMTP 열쇠는 워크플로에만 있다).
- 안 물어보고 보내기. 안 보여 주고 "고쳤다" 고 말하기.
