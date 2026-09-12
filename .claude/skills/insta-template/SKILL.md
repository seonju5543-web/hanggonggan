---
name: insta-template
description: Use when a developer pastes or describes a card-news design they like and asks to add it as a numbered Instagram template ("이거 5번으로 추가해", "이 디자인 양식으로 만들어 줘") in this repo (hanggonggan/한대장). Turns the example into insta/templates/<번호>-<id>.mjs so later posts can use it by number.
---

# 새 판형을 번호에 더하기 (2026-09-12 개발자 지시 ④⑤)

> "정해진 양식에 번호를 고정으로 박아 놓고 고르게" · "좋은 예시를 붙여넣고 정해진 번호에 추가해 달라고 하면
> 같은 디자인 양식을 번호에 추가하고 후속 작업에서도 쓸 수 있게."

## 1. 예시를 읽는다 — 무엇을 베낄지 글로 먼저 적는다

붙여넣은 그림·설명에서 **구조**를 뽑는다: 바탕(사진/단색/종이) · 글자(굵기·크기 비율·정렬) · 강조(형광펜/색 글자/밑줄) ·
장마다 다른 리듬(표지/목록/값/경고/마지막). 개발자에게 한 문단으로 되묻지 않고 **적어 보이고** 시작한다.
🔴 베끼는 것은 **모양**이다. 예시의 문구·사실은 가져오지 않는다 — 사실은 `ctx` 에서만 온다(원칙 8-1).

## 2. 시작 파일을 만든다

```bash
node insta/new-template.mjs <id> "<이름>" "<무엇을 베꼈나>"
```

- 다음 번호가 자동으로 붙고 `insta/templates.json` 에 한 줄 더해진다. 🔴 **번호는 끝에 더하기만** — 사이에 끼우거나
  기존 번호를 바꾸면 개발자가 "3번" 이라고 한 말이 다른 판형이 된다.
- 만들어진 `insta/templates/<번호>-<id>.mjs` 는 4번(포스터)을 본뜬 것이다. `css(skin, kit)` · `cards(ctx, kit)` · `fonts` 셋을 내준다.

## 3. 디자인을 옮겨 넣는다

- `cards()` 가 쓸 수 있는 사실 재료: `t1/t2`(후킹) · `who`(자격 줄) · `traps`(제한 줄) · `period` · `pkText` · `docs` · `m`(금액) ·
  `amtSub/moneyRaw` · `ddText` · `s0.org/name` · `photo`(사진 판형일 때). **여기 없는 사실은 쓰지 않는다.**
- 연장(`kit`): `esc` `hi`(형광펜) `scribble` `handCheck` `handX` `handBox` `handOval` `headSize` `W` `H`.
- 사실 줄에는 `data-fit` 을 단다 — 브라우저가 줄여서 전문을 담는다(자르지 않는다 · 관문 C5).
- 🔴 반려된 것(`insta/DESIGN.md`): 흰 박스 그릇 · 바닥 회색 글씨 · 색 원 안 숫자/이모지 · 상대 날짜(`1일 뒤 마감`) ·
  개별 판정 문구(`받을 수 있어요`) · 금지어(`무조건` `역대급` `꿀팁`). 관문 C2·C3 가 판형 파일도 본다.
- 🔴 CSS 템플릿 문자열 **주석에 백틱을 쓰지 말 것** — 거기서 문자열이 끊긴다(4번 만들 때 실제로 겪었다).
- 자격제한이 없는 공고엔 경고 장을 그리지 않는다(`traps.length ? … : …` · 관문 I2).
- 글꼴은 구글 폰트 `@import` 로 싣고 `fonts` 에 두 개를 적는다 — 안 실리면 렌더러가 죽는다(두부 방지).

## 4. 그려서 보여 준다

```bash
INSTA_DEV_FONT_RELAY=1 NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
  node insta/render.mjs <공고 이름 일부> --tpl=<번호> && node insta/preview.mjs <id>
```

`insta/out/_preview.png` 를 **그림으로** 개발자에게 준다(`SendUserFile`). 예시와 다른 점을 짚어 말한다.
`npm i playwright@1.56.1` 이 먼저다(미리 깔린 크로미움과 맞는 판). 루트 `node_modules`·`package.json` 은 커밋하지 않는다.

## 5. 관문 둘 — 통과해야 끝

```bash
node verify/verify-insta.js                       # C2·C3·I2·C11 — 판형 파일도 본다
node insta/sweep-overflow.mjs --tpl=<번호>        # 공고 전수에서 글자가 안 잘리는가 (약 1분)
```

넘침이 나오면 판형에서 글자 크기·여백을 조정한다. 공고 원문을 줄이지 않는다.

## 6. 남긴다

- 커밋: `insta/templates.json` · `insta/templates/<번호>-<id>.mjs`. `insta/DESIGN.md` 판형 표에 한 줄.
- 기본 브랜치에 닿으면 「인스타 판형 견본」 워크플로가 `insta/samples/<번호>-1.jpg` 를 그려 관리자 화면·메일에 뜬다.
- 이후 "이 공고 <번호>번으로" 는 `insta/revise.mjs <코드> --tpl=<번호>` 로 바로 된다(스킬 insta-revise).
