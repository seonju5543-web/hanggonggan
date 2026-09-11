---
version: alpha
name: handaejang-design-system
description: "한대장(한국 대학교 장학금) 모바일 PWA 의 디자인 시스템. 흰색에 베이지 한 방울을 탄 밝은 바탕(#fefdfc) 위에 먹빛 글자(#17191c), 그리고 채도를 낮춘 잉크블루(#27508f) **하나**만을 강조색으로 쓴다. 동작(누를 수 있음)은 남색 잉크(#1e2b42)가 맡고, 뜻을 가진 색(마감·검수 전·선정)은 셋뿐이며 전부 채도 60% 아래다. 본문도 제목도 Pretendard 한 벌이고 제목은 굵기·자간으로만 구분한다(2026-09-11 개발자 지시로 SUIT·SUITE 에서 되돌림) — 숫자(금액·남은 날·적합도)가 화면의 주인공이라 tabular-nums 로 자리를 고정한다. 카드는 흰 면 위의 얇은 선(hairline)으로 가르고, 그림자는 떠 있는 것(시트·주 버튼·마스코트)에만 준다. 참고안 둘 — Linear(어두운 마케팅 캔버스)와 Apple(사진이 주인공인 갤러리) — 에서 **구조**(단일 강조색 · 면의 사다리 · 얇은 선 · 4px 격자 · 알약은 '고르는 것'의 모양 · 44px 표적 · 이름 붙인 컴포넌트)를 받되, **값**(어두운 바탕·라벤더·Inter·SF Pro·17px 본문)은 이 앱의 기존 결정(2026-08-31 팔레트 · 2026-09-11 서체·크기 되돌림)을 지킨다. 값을 바꾸는 항목은 맨 아래 「참고안 둘과 충돌 · 컨펌 대기」에 모아 두었다."

colors:
  primary: "#1e2b42"
  primary-hover: "#131c2c"
  primary-weak: "#f2f2f3"
  on-primary: "#fdfbf6"
  accent: "#27508f"
  accent-soft: "#eceff5"
  accent-line: "rgba(39, 80, 143, 0.24)"
  ink: "#17191c"
  ink-muted: "#545a62"
  ink-subtle: "#888e97"
  canvas: "#fefdfc"
  surface-1: "#ffffff"
  surface-2: "#f7f6f4"
  hairline: "rgba(23, 25, 28, 0.09)"
  hairline-strong: "rgba(23, 25, 28, 0.14)"
  inverse-canvas: "#182338"
  inverse-surface: "#2b3a55"
  inverse-ink: "#ffffff"
  inverse-ink-muted: "rgba(232, 239, 254, 0.75)"
  semantic-success: "#3d6b47"
  semantic-success-weak: "#e9efe8"
  semantic-warning: "#8a5a12"
  semantic-warning-weak: "#f4ede0"
  semantic-danger: "#8f3a2e"
  semantic-danger-weak: "#f5e9e6"
  brand-mascot: "#b8912f"
  semantic-overlay: "rgba(16, 22, 38, 0.94)"

typography:
  display-hero:
    fontFamily: Pretendard Variable
    fontSize: 38px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.03em
  display-lg:
    fontFamily: Pretendard Variable
    fontSize: 27px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.03em
  headline:
    fontFamily: Pretendard Variable
    fontSize: 21px
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: -0.03em
  title:
    fontFamily: Pretendard Variable
    fontSize: 18.5px
    fontWeight: 800
    lineHeight: 1.35
    letterSpacing: -0.03em
  card-title:
    fontFamily: Pretendard Variable
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: -0.01em
  body:
    fontFamily: Pretendard Variable
    fontSize: 14.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.014em
  body-sm:
    fontFamily: Pretendard Variable
    fontSize: 13.5px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: -0.014em
  caption:
    fontFamily: Pretendard Variable
    fontSize: 12.5px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.014em
  meta:
    fontFamily: Pretendard Variable
    fontSize: 11.5px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontFamily: Pretendard Variable
    fontSize: 17px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: -0.014em
  number:
    fontFamily: Pretendard Variable
    fontSize: 14.5px
    fontWeight: 800
    lineHeight: 1.5
    letterSpacing: 0

rounded:
  hair: 3px
  xs: 9px
  sm: 13px
  md: 19px
  lg: 27px
  pill: 999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 40px
  screen-gutter: 20px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 16px 20px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
  button-primary-disabled:
    backgroundColor: "rgba(25, 23, 19, 0.12)"
    textColor: "rgba(25, 23, 19, 0.36)"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
  button-inverse:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 16px 20px
  button-ghost:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
  button-link:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.accent}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.hair}"
    padding: 0
  filter-chip:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 8px 16px
  filter-chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: 8px 16px
  sort-button:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: 0 12px
  hero-panel:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.display-hero}"
    rounded: "{rounded.lg}"
    padding: 32px 24px 24px
  notice-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.hair}"
    padding: 16px 20px
  notice-card-pressed:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.hair}"
    padding: 16px 20px
  status-badge:
    backgroundColor: "{colors.primary-weak}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  status-badge-danger:
    backgroundColor: "{colors.semantic-danger-weak}"
    textColor: "{colors.semantic-danger}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  status-badge-warning:
    backgroundColor: "{colors.semantic-warning-weak}"
    textColor: "{colors.semantic-warning}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  status-badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 16px
  text-input-focused:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 16px
  bottom-sheet:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 20px 24px 32px
  bottom-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.meta}"
    rounded: "{rounded.hair}"
    height: 73px
  bottom-nav-selected:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.accent}"
    typography: "{typography.meta}"
    rounded: "{rounded.hair}"
    height: 73px
  toast:
    backgroundColor: "{colors.semantic-overlay}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: 8px 16px
  avatar:
    backgroundColor: "{colors.primary}"
    textColor: "#f6f0e2"
    typography: "{typography.card-title}"
    rounded: "{rounded.full}"
    height: 44px
  mascot-fab:
    backgroundColor: "{colors.inverse-canvas}"
    textColor: "{colors.inverse-ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.full}"
    height: 56px
  status-badge-success:
    backgroundColor: "{colors.semantic-success-weak}"
    textColor: "{colors.semantic-success}"
    typography: "{typography.meta}"
    rounded: "{rounded.pill}"
    padding: 4px 8px
  divider:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.hair}"
    height: 1px
  section-rule:
    backgroundColor: "{colors.hairline-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.hair}"
    height: 1px
  empty-state:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.hair}"
    padding: 32px 20px
---

## 이 문서가 하는 일

이 문서는 **`style.css` 의 값을 사람이 읽을 수 있게 옮겨 적은 것**이지, 새로운 값을 정한 것이 아니다.
원본은 `style.css` 의 `:root` 이고(여러 번 겹쳐 선언돼 있어 **마지막 선언이 이긴다** — 이 문서의
숫자는 2026-09-11 에 브라우저에서 실제로 계산된 값이다), 관문은 `verify/ui-tone.mjs` 와
`verify/test-collector.mjs` 의 'DESIGN.md 가 style.css 와 같은 값을 적는가' 절이다.
값을 바꾸려면 **`style.css` 를 고치고 이 문서를 따라 고친다.** 반대로 하면 두 벌이 갈라진다.

참고안은 둘이다. 둘 다 `docs/designs/` 에 원문 그대로 보관한다.

| 참고안 | 보관 위치 | 무엇인가 | 이 앱과 다른 점 |
|---|---|---|---|
| Linear | `docs/designs/DESIGN-linear-reference.md` | 어두운 바탕(#010102)의 **개발 도구 마케팅 페이지** | 어두움 · 라벤더 · Inter · 1280 그릇 |
| Apple | `docs/designs/DESIGN-apple-reference.md` | 밝은 바탕(#fff · #f5f5f7)의 **제품 사진 갤러리** | 사진이 주인공 · 17px 본문 · 알약 CTA · 1440 그릇 |

둘은 서로도 다르다(어두움 ↔ 밝음, 알약 CTA 금지 ↔ 알약 CTA 필수). 그래서 이 앱이 받은 것은
**둘이 같은 말을 하는 뼈대**이고, 값은 이 앱의 것이다:

| 참고안 둘이 같은 말을 하는 것 | 이 앱에서 무엇인가 |
|---|---|
| 강조색은 **하나**, 누를 수 있는 것에만 | `{colors.accent}` 잉크블루 — 눌린 탭 · 구획 건수 · 제목 밑줄 · 링크 · 눌린 필터 칩 |
| 면의 사다리(canvas → surface-1 → surface-2) | `{colors.canvas}` 베이지 한 방울 → `{colors.surface-1}` 순백 시트 → `{colors.surface-2}` 눌린 면 |
| 얇은 선(hairline)으로 가르기 · 카드에 그림자 없음 | `{colors.hairline}` 9% · `{colors.hairline-strong}` 14% |
| 4px 격자 · 이름 붙인 여백 | `--space-4 … --space-40` + 세로 리듬 넷(`--sp-1~4` = 8 · 14 · 24 · 34) |
| 큰 글자는 자간을 좁히고 작은 글자·숫자는 안 좁힌다 | `--track-display` −0.03em(24px 이상) · `--track` −0.014em(본문) · `--track-flat` 0 |
| 그림자·그라데이션은 거의 안 쓴다 | 지금은 **아직 쓴다** — 아래 「충돌」 5·6번 |
| 제목은 600, 700 이상을 피한다 | 지금은 **800** — 아래 「충돌」 10번 |
| 터치 표적 44px | 탭·입력·정렬은 통과, 아이콘 버튼·링크·필터 칩은 미달 — 아래 「충돌」 9번 |
| 컴포넌트에 이름을 붙여 부른다 | 위 `components:` — 화면 이야기는 이 이름으로 한다 |

Apple 에서만 받은 것도 있다. **"알약은 고르는 것의 모양"** 이라는 문법(검색 입력 · 옵션 칩 · 정렬이
알약, 이 앱도 이미 그렇다), **"누를 수 있는 것은 전부 같은 방식으로 반응한다"** 는 규칙(지금은 큰 버튼만
반응한다 — 「충돌」 14번), **폭에 따라 히어로 글자를 한 단씩 내리는 것**(「충돌」 15번).

**받지 않은 것**(어두운 바탕 · 라벤더 · Inter · Apple 파랑 #0066cc · 17px 본문 · 알약 CTA · 데스크톱 격자)은
맨 아래 「참고안 둘과 충돌 · 컨펌 대기」에 있다. 그 항목들은 **개발자가 정하기 전까지 코드를 바꾸지 않는다.**

## 색

> 출처: `style.css` `:root` 마지막 선언(2026-08-31 「누런 기운 빼기」· 「색 미세 조정」· 2026-09-01). 화면에서 실제로 계산된 값.

### 바탕과 면 (surface ladder)

- **Canvas** (`{colors.canvas}` #fefdfc): 화면 바탕. 흰색에 베이지 한 방울 — R254 G253 B252. 🔴 순백(#ffffff)으로 올리지 말 것 — 카드와 바탕이 같은 색이 되어 사다리가 무너진다. `manifest.json` `background_color` · `<meta theme-color>` 와 **같은 값**이어야 한다(부팅 화면이 깜빡이지 않게). Apple 의 흰(#ffffff) ↔ 양피지(#f5f5f7) 한 단과 같은 구조다.
- **Surface 1** (`{colors.surface-1}` #ffffff): 한 단 위 — 카드가 아니라 **시트 · 입력칸 · 반전 버튼**. 목록 카드는 면을 칠하지 않고 얇은 선으로만 가른다(아래 「카드」).
- **Surface 2** (`{colors.surface-2}` #f7f6f4): 눌린 면 · 첨부 블록 · 자격 요약 칩의 바탕.
- **Hairline** (`{colors.hairline}` 9%): 카드 사이 · 목록 줄 사이 1px 선. **선은 겹치지 않는다** — 구획 선과 목록 첫 선이 겹치던 것을 2026-08-31 에 하나로 줄였다(`.card-list { border-top: 0 }`).
- **Hairline Strong** (`{colors.hairline-strong}` 14%): 구획 머리 위의 선 · 입력칸 테두리.

### 잉크(글자)

- **Ink** (`{colors.ink}` #17191c): 제목·본문. 갈색 기운을 뺀 먹 — 흰 바탕 위 16:1. Apple 의 #1d1d1f 와 같은 생각(순검정을 피한다).
- **Ink Muted** (`{colors.ink-muted}` #545a62): 설명 · 빈 상태 · 정렬 버튼. 7.6:1.
- **Ink Subtle** (`{colors.ink-subtle}` #888e97): 기관명 · 금액 미확인 · 안 눌린 탭. 3.6:1 — **안 읽어도 되는 글자에만** 쓴다(본문에 쓰면 접근성 기준 4.5:1 미달).

### 동작과 강조

- **Primary** (`{colors.primary}` #1e2b42): 주 버튼 · 아바타 — **남색 잉크**. "누를 수 있다"는 뜻은 채도가 아니라 무게로 말한다. 눌린 상태 `{colors.primary-hover}` #131c2c. ⚠️ 참고안 둘은 CTA 도 강조색으로 칠한다 — 이 앱은 2026-08-31 개발자 결정으로 잉크다(「충돌」 8번).
- **Accent** (`{colors.accent}` #27508f): **이 앱의 유일한 유채색.** 쓰는 자리는 다섯 — 눌린 탭(`bottom-nav-selected`) · 구획 머리의 건수(`.list-group-n`) · 화면 제목 밑 28px 강조선 · 링크 버튼(`button-link`) · 눌린 필터 칩. 🔴 형광 파랑(#2f6bff)으로 되돌리지 말 것 — 2026-08-31 개발자 지시. Apple 파랑(#0066cc)도 같은 이유로 받지 않는다 — 그 색 하나가 앱을 '흔한 화면'으로 만든다.
- **Accent Soft / Line** (`{colors.accent-soft}` · `{colors.accent-line}`): 강조 배지의 바탕 · 포커스 링. CSS 원본은 rgba(39,80,143) 9% · 24% 이고, 위 front matter 에는 흰 면 위에서 보이는 불투명 값(#eceff5)을 적었다(린터가 투명도를 못 재서). `{colors.primary-weak}` #f2f2f3 도 같은 이유 — CSS 는 잉크 5.5% 다.
- **Brand Mascot** (`{colors.brand-mascot}` #b8912f): 학사모 금색. **그림 안의 색**이라 화면 요소에는 쓰지 않는다.

### 뜻을 가진 색 (semantic)

전부 채도 60% 아래 — 중성 위에 얹히게. **뜻이 있을 때만** 쓴다(장식 금지). Apple 문서에는 오류·상태 색이 없다(마케팅 페이지라 상태가 없다) — 이 앱은 마감·검수·선정을 말해야 하므로 셋을 둔다.

- **Danger** (`{colors.semantic-danger}` #8f3a2e): 마감 임박(7일 이내) · 초기화. 카드의 `오늘 마감` 글자와 아래 막대가 이 색이다.
- **Warning** (`{colors.semantic-warning}` #8a5a12): 자동 등록·검수 전 · 컨펌 대기.
- **Success** (`{colors.semantic-success}` #3d6b47): 선정 · 신청 완료 기록. 🔴 **첨부 개수 같은 중립 정보에 이 색을 쓰지 말 것** — 2026-09-11 에 '첨부 n개'가 초록이라 '신청이 끝났다'로 읽혔다(운영 원칙 1).

### 반전 면 (inverse)

- **Inverse Canvas** (`{colors.inverse-canvas}` #182338): 홈 히어로 패널 · 마스코트 · 도우미. `--grad-navy` 는 이 남색 위에 **방사형 빛 하나**(오른쪽 위 파란 기운 30%)를 얹은 것이다 — 45도 균일 그라데이션은 쓰지 않는다. Apple 이 밝은 판 사이에 끼우는 '어두운 판' 하나에 해당하는 자리다 — 이 앱에서 어두운 판은 **홈 히어로 하나**다.
- **Inverse Ink** (`{colors.inverse-ink}` #ffffff · `{colors.inverse-ink-muted}` 75%): 패널 안 글자.

## 서체

### 글꼴

- **Pretendard Variable 한 벌** — 본문·제목·버튼·배지·입력 전부. 2026-09-10 페이스리프트가 SUIT(본문)·SUITE(제목)로 바꿨는데 개발자가 배포된 앱을 보고 *"폰트 바뀌었어 예전으로 돌리고"* 라고 해서 2026-09-11 에 되돌렸다.
- 칸 이름 `--font-text`·`--font-display` 는 **둘 다 남아 있고 지금은 같은 글꼴**을 가리킨다. 제목은 굵기·자간으로만 구분된다. 나중에 제목 글꼴을 따로 쓰기로 하면 `--font-display` 한 곳만 고친다.
- 🔴 스택 마지막의 Pretendard 를 지우지 말 것 — CDN 이 흔들리면 글자가 조용히 다 깨진다(관문 `ui-tone` '서체와 글자 척도').
- 🔴 서체를 다시 바꾸자는 제안이 나오면 **조사만으로 바꾸지 말고 개발자에게 화면을 보여 주고** 정한다. Inter·SF Pro 에는 한글이 없어 결국 대체 글꼴로 떨어진다(Linear 대조판 3번에 그 모습이 있다).
- ⚠️ 이 저장소의 샌드박스는 CDN 을 막아 검사 스크린샷은 **전부 시스템 대체 글꼴**로 그려진다. 실제 앱은 Pretendard 다.

### 척도

| 토큰 | 크기 | 굵기 | 줄간격 | 자간 | 쓰는 곳 |
|---|---|---|---|---|---|
| `{typography.display-hero}` | 38px (`--t-hero`) | 800 | 1.2 | −0.03em | 홈 히어로 금액 · 신청내역 합계 · 온보딩 금액 |
| `{typography.display-lg}` | 27px (`--t-3xl`) | 800 | 1.2 | −0.03em | 온보딩 제목 · 일괄 준비 합계 |
| `{typography.headline}` | 21px (`--t-2xl`) | 800 | 1.2 | −0.03em | 화면 제목 · 상세 시트 제목 · MY 이름 |
| `{typography.title}` | 18.5px (`--t-xl`) | 800 | 1.35 | −0.03em | 홈 인사말 · 시트 금액 · 온보딩 태그라인 |
| `{typography.card-title}` | 17px (`--t-lg`) | 700 | 1.35 | −0.01em | 구획 머리 · 큰 버튼 · 보관함 제목 |
| `{typography.body}` | 14.5px (`--t-md`) | 400 | 1.5 | −0.014em | 본문 · 공고 카드 제목 · 필터 칩 · 원문 발췌 |
| `{typography.body-sm}` | 13.5px (`--t-sm`) | 400 | 1.5 | −0.014em | 카드 금액·마감 · 히어로 설명 · 링크 · 정렬 |
| `{typography.caption}` | 12.5px (`--t-xs`) | 600 | 1.5 | −0.014em | 기관명 · 적합도 |
| `{typography.meta}` | 11.5px (`--t-2xs`) | 600 | 1.5 | 0 | 배지 · 탭 이름 |
| `{typography.button}` | 17px | 700 | 1.5 | −0.014em | 주 버튼(`.btn-lg`) |
| `{typography.number}` | 14.5px | 800 | 1.5 | 0 | 카드 금액(tabular-nums) |

🔴 **2026-09-11 개발자 지시로 되돌린 척도다** — *"글씨 크기도 줄여"*. 2026-09-10 에 본문을 14.5 → 17px 로 키웠다가
돌아왔다. Apple 의 17px 본문 · Linear 의 16px 본문과 다르지만 **개발자가 화면을 보고 정한 값**이라 다시 묻지 않는다.
⚠️ 그래서 아래 네 단계(11.5 · 12.5 · 13.5 · 14.5)는 3px 안에 몰려 있다. 관문 `ui-tone` '단계마다 최소 1.07배'는
이 척도에 맞춰 낮춘 것이다(1.08 이면 통과할 수 없는 관문이 된다). 새 크기를 끼워 넣지 말 것.

### 원칙

- **굵기 — 정직하게 적는다.** `style.css` 에 선언된 굵기는 **아홉 가지**(400 · 450 · 500 · 550 · 600 · 650 · 700 · 800 · 900)이고, 홈 화면에 실제로 그려진 것은 여섯(400 · 500 · 550 · 600 · 700 · 800 — 2026-09-11 실측)이다. 이전 문서의 "다섯 가지뿐"은 사실과 달랐다. 칩·탭·링크·정렬이 쓰는 **550** 은 variable 글꼴의 중간값이다. Apple 은 300/400/600/700 넷만 쓰고 **500 을 일부러 비운다**, Linear 도 제목 600 — 「충돌」 10번.
- **줄간격**도 여덟 가지(1 · 1.3 · 1.45 · 1.5 · 1.55 · 1.6 · 1.65 · 1.7)가 선언돼 있다. 본문 1.5 가 기본이고, Apple 의 1.47 과 같은 편이다.
- **큰 글자는 좁히고 숫자는 안 좁힌다.** 24px 이상 −0.03em, 본문 −0.014em, 숫자·배지·영문 약자 0. Apple 도 같은 규칙이다(17px 이상만 좁히고 12px 아래는 안 좁힌다). 🔴 한글에 **양수 자간**(+0.02em 이상)을 주지 말 것 — '발 급 방 법'처럼 벌어진다.
- **숫자는 `tabular-nums`.** 금액 · 남은 날 · 적합도 · 건수 — 자리가 흔들리면 카드가 미세하게 어긋나 '대충 만든 느낌'이 된다.
- **한국어는 어절 단위로 끊는다** — `word-break: keep-all` + `overflow-wrap: break-word` 짝. 2026-09-11 되돌림에서 **유일하게 남긴 글자 작업**이다. 인쇄 문서(`.fd-*`)와 원문 발췌는 원본 줄바꿈이 뜻을 가지므로 예외.

## 배치

### 여백

- **기본 단위 4px.** `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 40. 2px · 6px 는 격자 밖이지만 아이콘과 글자 사이처럼 4px 도 넓은 자리를 위해 남긴다. Apple 의 4/8/12/24/32 와 같다(Apple 의 17 · 48 · 80 은 마케팅 판의 여백이라 해당 없음).
- **세로 리듬은 넷** — 같은 덩어리 안 8 · 덩어리 사이 14 · 절 안의 묶음 사이 24 · 절과 절 사이 34 (`--sp-1~4`). 이전 문서의 8·16·24·40 은 옛 값이었다. 새 요소를 만들 때 숫자를 직접 쓰지 말고 여기서 고른다.
- 화면 좌우 여백 `{spacing.screen-gutter}` 20px. 카드 안쪽 17px 20px. 시트 안쪽 20px 24px. 히어로 패널 32px 24px 24px.
- 관문: `ui-tone` '토큰 이탈이 더 늘지 않는다' — 생 px 여백 천장 **519곳**(톱니 · 늘면 실패 · 줄면 천장을 내린다). 2026-09-10 에 20곳까지 줄였다가 2026-09-11 지시("크기 조정 부분 모두 되돌려")로 되돌아온 숫자다.

### 그릇과 격자

- **그릇은 폰 한 장이다** — `.app { max-width: 480px }`, 데스크톱에서는 가운데 정렬 + `--shadow-lift`. 격자 열은 없고 목록은 항상 1열이다(아래 「반응형」).
- 홈은 **히어로 패널 → 구획(마감 임박 · 신청 현황 · 실시간 공고)** 순서. 탐색은 **제목 → 검색 → 필터 칩 → 구획 7개**(오늘·내일 마감 / 이번 주 / …).

### 빈 공간의 뜻

바탕이 곧 여백이다. 구획은 **면을 칠해서가 아니라 선 하나와 34px 로** 가른다. Apple 은 밝은 판과 어두운 판을
번갈아 놓아 "색이 바뀌는 것"을 구분선으로 삼는데, 목록 앱에서 그렇게 하면 카드가 면을 갖게 되어 「카드는
선으로 가른다」가 무너진다 — 이 앱의 어두운 판은 홈 히어로 하나다. 카드도 면을 칠하지 않는다 — 칠하는 것은
눌렸을 때(`{colors.surface-2}`)뿐이다. 그래서 화면에 '떠 있는 것'은 히어로 패널 · 시트 · 주 버튼 · 마스코트 넷이다.

## 높낮이

| 단 | 처리 | 쓰는 곳 |
|---|---|---|
| 0 (평면) | 그림자 없음 · 선 없음 | 본문 · 구획 안 글자 |
| 1 (선) | 1px `{colors.hairline}` | 목록 카드 · 줄 |
| 2 (눌림) | `{colors.surface-2}` 바탕 | 누른 카드 · 첨부 블록 |
| 3 (뜸) | `--shadow` (0 1px 2px 5% + 0 8px 22px 7%) | 아바타 · 입력칸 포커스 |
| 4 (떠 있음) | `--shadow-lift` (0 2px 6px 7% + 0 18px 40px 14%) | 히어로 패널 · 토스트 · 데스크톱 프레임 |
| 5 (시트) | `--shadow-sheet` (0 −14px 48px 20%) | 상세 시트 · 도우미 시트 |
| 색 있는 그림자 | `--shadow-btn` 22% · `--shadow-chip` 26% | 주 버튼 · 눌린 필터 칩 — **그림자가 버튼 색을 띤다** |
| 포커스 | `--ring` 0 0 0 3px 강조색 18% | 입력칸 · 버튼 |

🔴 **그림자는 바탕의 색조를 띤다** — 순수 검정 저투명도는 회색 때가 낀 것처럼 보인다. 남색 계열 rgba(24,35,56)로 통일했고 빛의 방향은 위 하나다.
🔴 그림자 토큰은 열 개로 **닫혀 있다**(관문 '그림자도 토큰만 쓴다'). 새 값을 만들지 말고 이 중에서 고른다.
⚠️ **참고안 둘이 여기서 같은 말을 한다** — Linear 는 "그림자를 거의 쓰지 않는다", Apple 은 "그림자는 딱 하나, 제품 사진 아래에만 · 카드·버튼·글자에는 절대 없다". 노션 백로그 UI-9(그림자가 너무 많다)도 열려 있다 — 「충돌」 5번.

### 장식적 깊이

- 히어로 패널의 **방사형 빛 하나**(`--grad-navy`)가 이 앱의 유일한 그라데이션이다(관문 '그라데이션은 --grad-navy 한 곳'). 참고안 둘 다 장식 그라데이션을 쓰지 않는다 — 「충돌」 6번.
- 바탕에 아주 옅은 결(`body::after` 노이즈 26%) — 진하면 누런 얼룩으로 보인다.
- 카드 아래 **마감까지 남은 시간 막대**(`interactions.js` 컨텍스트 바) — 재료는 마감일 하나뿐이고 문턱은 7일. 접수 기간의 몇 %가 아니다(원칙 8-1).

## 모양

### 모서리

| 토큰 | 값 | 쓰는 곳 | Apple 의 대응 |
|---|---|---|---|
| `{rounded.hair}` | 3px | 화면 제목 밑 강조선 · 막대 · 시트 손잡이 | — |
| `{rounded.xs}` | 9px | 작은 버튼(ghost · 저장) · 배지 안쪽 | sm 8 |
| `{rounded.sm}` | 13px | 주 버튼 · 입력칸 · 토스트 · 아이콘 버튼 | md 11 |
| `{rounded.md}` | 19px | 카드형 패널(온보딩 · MY 카드) | lg 18 |
| `{rounded.lg}` | 27px | 히어로 패널 · 시트 윗모서리 | — |
| `{rounded.pill}` | 999px | 필터 칩 · 정렬 버튼 · 검색 · 배지 | pill — 칩·검색·정렬 |
| `{rounded.full}` | 9999px (CSS 는 `50%`) | 아바타 · 마스코트 | full — 원형 아이콘 버튼 |

**중첩 반경 규칙** — 안쪽은 더 조이고 바깥은 더 부드럽게(시트 27 안의 버튼 13 안의 배지 9). 바깥보다 안쪽이 둥글면 '덜 만든 앱'이 된다.
**알약은 고르는 것의 모양** — 검색 입력 · 필터 칩 · 정렬 · 배지. 누르는 것(주 버튼 · 입력칸)은 13px 이다. Apple 은 CTA 도 알약, Linear 는 CTA 알약 금지 — 정반대라 이 앱은 그 사이(「충돌」 4번). 관문: `ui-tone` '모서리는 토큰만 쓴다'.

### 그림과 마스코트

- 마스코트(학사모 캐릭터)는 도우미 FAB 56px 원 안에 산다. 🔴 캐릭터를 다른 곳에 장식으로 뿌리지 말 것 — 백로그 UI-7 이 "원형 FAB 안의 캐릭터는 AI 앱의 표식"이라고 이미 지적하고 있다.
- 사진은 없다. 기관 로고도 싣지 않는다(원문 링크가 대신한다). Apple 의 '사진이 주인공' 구조는 이 앱에 옮길 자리가 없다 — 이 앱의 주인공은 **숫자**(금액 · 남은 날 · 적합도)다.

## 움직임

- 곡선은 하나 — `--ease` cubic-bezier(0.32, 0.72, 0, 1), 튕김이 필요할 때만 `--ease-spring`. 길이는 둘 — `--dur` 0.22s · `--dur-slow` 0.42s. 요소마다 다른 곡선을 쓰면 '덜 만든 앱'이 된다.
- **눌림**: `.btn:active { transform: scale(0.98) }` — 큰 버튼만. 칩·아이콘 버튼·카드는 배경색만 바뀐다. Apple 은 **누를 수 있는 것 전부에 `scale(0.95)` 하나**를 건다 — 「충돌」 14번.
- 시트는 들어올 때 0.3s · 나갈 때 0.22s(응답은 빠르게). 전부 아래로 쓸어내려 닫는다(`enableSheetSwipe` 한 곳).
- `prefers-reduced-motion` 이면 움직임을 끈다(일곱 곳). 부팅 화면의 등장은 **한 번 나타나고 멈춘다**(`docs/designs/first-run-and-resume.md`).
- 손짓(당겨서 새로고침 · 저장 튕김 · 마감 막대 · 뼈대)은 `interactions.js` 한 곳 — 판정은 새로 만들지 않는다.

## 컴포넌트

### 버튼

**`button-primary`** — 남색 잉크 주 버튼. 화면당 **하나**.
- `{colors.primary}` 바탕 · `{colors.on-primary}` 글자 · `{typography.button}` · `{rounded.sm}` 13px · 17px 안쪽 여백 · `--shadow-btn`. 눌림 `button-primary-hover` (#131c2c), 잠김 `button-primary-disabled` (12% 잉크 · 그림자 없음). 높이 60px(홈 히어로 안 실측).

**`button-inverse`** — 남색 패널 위의 흰 버튼(홈 히어로 "15건 신청 준비"). `{colors.surface-1}` 바탕 · `{colors.ink}` 글자 · `--shadow-btn-white`.

**`button-ghost`** — 얇은 선 버튼(더보기 · 원문 · 달력 보기). 투명 바탕 · `{colors.ink-muted}` · 1px hairline · `{rounded.xs}` · 6px 12px · 최소 32px.

**`button-link`** — 글자만 있는 버튼("전체 보기" · "수정하기 ›"). `{colors.accent}` · `{typography.body-sm}` 550. 🔴 실측 높이 **21px** — 아래 「반응형 · 터치 표적」.

### 칩과 정렬

**`filter-chip`** / **`filter-chip-selected`** — 탐색의 전체 · 교내 · 교외 · 신청 가능만.
- 기본: `{colors.surface-1}` 바탕 · 1.5px 잉크 10% 선 · `{colors.ink-muted}` 글자 550. 선택: **`{colors.accent}` 칠하기** + `--shadow-chip`. `{rounded.pill}` · 8.5px 15px · 실측 높이 41px.
- ⚠️ 참고안 둘 다 선택 칩을 **칠하지 않는다** — Linear 는 면을 한 단 올리고, Apple 은 흰 바탕에 2px 파란 테두리(`configurator-option-chip-selected`). 「충돌」 7번.

**`sort-button`** — "↕ 적합도순". 투명 · 1px hairline · pill · 44px(통과).

### 카드와 그릇

**`notice-card`** — 공고 카드. **이 앱의 주인공.**
- 면을 칠하지 않고 아래 1px hairline 으로 가른다. 17px 20px. 누르면 `notice-card-pressed` (`{colors.surface-2}`). 마감된 카드는 55% 불투명.
- 안의 순서는 **기관 글(caption · ink-subtle) → 제목(body 700) → 금액(body-sm) + 마감(body-sm · danger 7일 이내) → 마감 막대**. 배지는 **최대 1개**(미달 · 미확인 · 신청 완료에만). 금액을 못 읽은 공고는 감추지 않고 `.sch-amount.unknown` 으로 무게만 낮춘다(원칙 8-1).
- 🔴 카드를 그리는 함수는 둘이다(`schCard` · `liveNoticesHtml`) — 하나만 고치면 한 화면에 카드 말투가 두 가지가 된다(2026-09-11 실사고).

**`hero-panel`** — 홈 히어로. `{colors.inverse-canvas}` + `--grad-navy` · `{rounded.lg}` 27px · 32px 24px 24px · `--shadow-lift`. 안에 `display-hero` 금액 하나, 설명 한 줄, `button-inverse` 하나. 🔴 숫자에 해명 세 토막을 붙이지 않는다(백로그 UI-6). ⚠️ 38px 고정이라 **360px 폰에서 네 자리 금액(1,405만원)이 두 줄**로 꺾인다 — 「충돌」 15번.

**`bottom-sheet`** — 상세·도우미·일괄 준비 전부 이 그릇(`#detail-sheet`). `{colors.surface-1}` · 윗모서리 `{rounded.lg}` · 20px 24px 32px · `--shadow-sheet` · 위에 손잡이 44×5. **전부 아래로 쓸어내려 닫는다**(2026-08-21 개발자 지시). 데스크톱에서도 폭 480px 가운데(1440px 에서 실측 480).

**`empty-state`** — "없어요" 한 가지 말투 + 다음 동작 단추 하나(ghost). `{colors.ink-muted}` · 32px 20px.

### 배지

**`status-badge`** 와 변형 셋 — `{typography.meta}` 11.5px 700 · `{rounded.xs}` 9px(실측 · front matter 의 pill 은 시트 안 배지) · 3.5px 9px.
- 중립(`status-badge`): 잉크 5.5% 바탕 · ink-muted — 교내/교외 · 종류.
- `status-badge-danger`: 마감 임박(D-DAY). `status-badge-warning`: 검수 전 · 컨펌 대기. `status-badge-accent`: 양식 있음 · 상시 제도.
- 🔴 적합도는 배지가 아니라 **글자**다(`.sch-fit` caption) — 다섯 장 연속 같은 색 덩어리가 제목보다 먼저 읽혔다.

### 입력

**`text-input`** — `{colors.surface-1}` · 1px 잉크 10% 테두리 · `{rounded.sm}` 13px · 16px · `{typography.body}`. 포커스: 테두리 `{colors.accent}` + `--ring`. 최소 높이 56px(통과). 검색 입력만 알약(Apple 의 `search-input` 과 같다). 체크박스는 앱 공용 그림을 써야 보인다(전역 `appearance:none`).

### 탐색

**`bottom-nav`** — 4탭(홈 · 장학금 · 신청내역 · MY). 반투명 바탕(흰색 82~88% + `backdrop-filter: blur(18px) saturate(1.6)`) + 위 1px hairline · 높이 73px + 안전 영역. 아이콘 23px 선 1.8 + `{typography.meta}` 550. 선택 `bottom-nav-selected` = `{colors.accent}` 글자 + 위 짧은 강조선. Apple 의 frosted 고정 바와 같은 처리다.

**`icon-button`** — 알림 · 설정(톱니) · 뒤로. 22px 아이콘 + 8px 여백 = **38×38**(실측) · `{rounded.sm}` · 투명. Apple 의 원형 아이콘 버튼은 정확히 44 — 「충돌」 9번.

**`mascot-fab`** — 도우미 진입. 56px 원 · `{colors.inverse-canvas}` · 그림자 34%. 끌어서 옮길 수 있다("끌어서 이동 가능" 툴팁). 탭바 바로 위에 떠서 목록 마지막 항목을 가린다(UI-7 · 열려 있음).

**`toast`** — `{colors.semantic-overlay}` 94% · 흰 글자 · `{rounded.sm}` · 8px 16px · 아래에서 올라온다.

## 하는 것 · 하지 않는 것

### 한다

- 강조색 `{colors.accent}` 는 **다섯 자리에만** — 눌린 탭 · 구획 건수 · 제목 밑줄 · 링크 · 눌린 칩.
- 새 색을 만들지 않는다. 필요하면 **있는 토큰을 안 쓰던 자리에** 쓴다.
- 위계는 굵기가 아니라 **크기와 자리**로 세운다.
- 화면당 주 버튼 하나. 나머지는 ghost 나 link.
- 카드는 선으로 가른다. 칠하는 것은 눌렸을 때뿐.
- 고르는 것은 알약, 누르는 것은 13px 모서리.
- 모르는 값은 감추지 않고 **무게를 낮춰서** 보여 준다(금액 미확인 · 기한 원문 확인). 원칙 8-1.
- 시트는 아래로 쓸어내려 닫히게 만든다.
- 화면이 어떻게 보이는지는 **`node verify/what-shows.mjs <공고>`** 로 재고 말한다. 배치·표적은 브라우저를 띄워 실측한다.

### 하지 않는다

- 형광 파랑 · Apple 파랑(#0066cc) · 보라·파랑 그라데이션 · 45도 균일 그라데이션 — 전부 '흔한 화면'으로 가는 길이다.
- 이모지 · 한글 문장 속 느낌표 · 앱이 1인칭으로 말하기(`ui-tone` ①②③ 관문).
- 한글에 양수 자간. 11px 아래 글자. 새 글자 크기.
- 배지 두 개 이상을 한 카드에. 첨부 개수에 초록.
- 캐릭터를 장식으로. 사진·로고.
- `display` 를 클래스에 직접 — `[hidden]` 이 안 먹는다(열한 번 재발한 버그).
- 라이트/다크 두 벌 — 지금 앱은 **밝은 한 벌**이다(아래 「충돌」 1번).
- 개발자가 화면을 보고 되돌린 값(서체 · 본문 크기 · 여백)을 조사만 근거로 다시 바꾸는 것.

## 반응형 (2026-09-11 실측 · Playwright · 서비스워커 포함 · Apple 의 폭 기준으로 재 봄)

### 재 본 폭

| 폭 | Apple 의 이름 | 그릇 폭 | 왼쪽 여백 | 가로 넘침 | 히어로 금액(1,405만원) |
|---|---|---|---|---|---|
| 360 | 소형 폰 | 360 | 0 | 없음 | **두 줄** |
| 390 | 폰 | 390 | 0 | 없음 | 한 줄 |
| 419 | 소형 폰 상한 | 419 | 0 | 없음 | 한 줄 |
| 640 | 폰 상한 | 480 | 80 | 없음 | 한 줄 · 프레임 가운데 + `--shadow-lift` |
| 734 | 큰 폰 상한 | 480 | 127 | 없음 | 한 줄 |
| 833 | 태블릿 세로 상한 | 480 | 177 | 없음 | 한 줄 |
| 1068 | 작은 데스크톱 상한 | 480 | 294 | 없음 | 한 줄 |
| 1440 | 데스크톱 | 480 | 480 | 없음 | 한 줄 · 시트도 480 가운데 |

- **미디어 쿼리는 셋** — `min-width: 520px`(프레임 그림자) · `max-width: 560px`(약관 표를 카드로 펼침) · `hover: none`(손가락 기기에 hover 색을 안 준다). 나머지는 `prefers-reduced-motion` 일곱.
- 바텀시트 · 탭바 · 토스트 모두 프레임 폭(480)에 맞춰 가운데에 뜬다 — 데스크톱에서도 모바일 배치가 그대로다. Apple 의 5→4→3→2→1열 격자 · 1440 그릇은 받지 않는다(「충돌」 11번).
- 확대 막기: `viewport maximum-scale=1` + `touch-action: pan-x pan-y` + gesture 차단 한 세트.
- 🔴 **히어로 금액은 38px 고정**이라 360px 에서 네 자리 금액이 두 줄이 된다. 이전 문서의 "360px 에서도 한 줄"은 세 자리(805만원)일 때만 맞았다. Apple 은 폭마다 히어로를 한 단씩 내린다(56 → 40 → 34 → 28) — 「충돌」 15번.

### 터치 표적 (Apple 최소 44 · Linear CTA ≥ 40 · 입력 ≥ 44)

| 요소 | 실측 | 판정 |
|---|---|---|
| `button-primary` / `button-inverse` | 60px | 통과 |
| `text-input` | 56px | 통과 |
| `sort-button` | 44px | 통과 |
| 탭(`bottom-nav`) | 54px | 통과 |
| `filter-chip` | **41px** | 44 미만 — 3px 모자람 |
| `icon-button`(알림 · 설정) | **38×38** | 44 미만 — 6px 모자람 |
| `button-link`("전체 보기") | **58×21** | 44 미만 — 글자 높이 그대로 |

세 항목은 코드 변경 없이 판정만 적는다(이 문서는 코드를 바꾸지 않는다). 고칠 때는 여백(padding)으로 표적만 키우고 글자 크기는 그대로 둔다 — 「충돌」 9번.

### 줄이는 방식

- **목록**: 언제나 1열. 폭이 넓어져도 카드가 옆으로 늘어나지 않는다(프레임이 480 에서 멈춘다).
- **한국어 줄바꿈**: `keep-all` 이라 좁은 폭에서 제목이 어절 단위로 두 줄이 된다(360px 에서 확인).
- **약관 표**: 560px 아래에서 줄마다 카드로 펼쳐진다(`.legal-table`).

## 반복할 때의 순서

1. 한 번에 컴포넌트 **하나**만 — 위 `components:` 이름으로 부른다.
2. 새 구획을 만들 때 먼저 정한다: 선으로 가르나(1단) · 눌림 면인가(2단) · 떠 있나(4단).
3. 본문은 `{typography.body}` 14.5px 400 이 기본. 제목은 같은 글꼴에 굵기·자간으로.
4. 값을 고쳤으면 `node verify/ui-tone.mjs` + `node verify/test-collector.mjs` — 톱니 천장(여백 519 · 유채색 76 · 없는 토큰 0)과 'DESIGN.md 가 style.css 와 같은 값' 절을 넘기면 빨간불.
5. 화면 이야기는 `node verify/what-shows.mjs <공고>` 로 재고 한다.
6. 강조색은 아낀다. 여섯 번째 자리를 만들려면 다섯 자리 중 하나를 뺀다.
7. 이 문서의 숫자를 바꿀 때는 **`style.css` 를 먼저** 고친다(문서는 사본이다).
8. 참고안과 다른 것을 발견하면 코드를 고치지 말고 아래 표에 **번호를 더한다.**

## 아직 없는 것

- **다크 모드가 없다.** `:root[data-theme="dark"]` 규칙이 `essay-*` 몇 곳에만 있고 나머지는 밝은 한 벌이다. 폰 설정이 다크인 학생에게도 밝게 뜬다. Apple 문서도 밝은 판만 기록했다.
- **태블릿·데스크톱 배치가 없다.** 폰 프레임을 가운데 두는 것이 전부다.
- 입력칸의 오류 상태 색이 정해져 있지 않다(온보딩은 오류를 문구로만 말한다). Apple 문서에도 오류 상태가 없다.
- 안 눌린 탭 이름과 기관명이 `{colors.ink-subtle}` 3.6:1 이라 WCAG AA(4.5:1)에 못 미친다 — 12~13.5px 글자라 실제로 읽기 어렵다는 지적이 오면 `{colors.ink-muted}` 로 한 단 올린다.
- 인쇄 문서(`.fd-*` · `.form-doc`)와 도우미(`.chat-*`)는 이 시스템 밖이다 — 원본 서식 그대로 · 2026-08-29 지시로 손대지 않는다.
- 소형 폰(≤375px)용 히어로 단계가 없다(「충돌」 15번).

---

## 참고안 둘과 충돌 · 컨펌 대기 (2026-09-11 · Apple 대조로 갱신)

Linear · Apple DESIGN.md 와 지금 코드가 **다르게 정해 둔 것**들이다. 번호 1~13 은 Linear 대조 때의 번호 그대로이고
14~17 은 Apple 대조에서 더한 것이다. 전부 **앞선 개발자 결정이나 열린 백로그와 얽혀 있어** 코드를 바꾸지 않고 여기에 모았다.
🔴 정하기 전까지 `style.css` 는 한 줄도 바꾸지 않았다.
시안: **Linear** `docs/designs/mockups/design-conflicts.html` · **Apple** `docs/designs/mockups/design-conflicts-apple.html` (한 항목씩 '지금 ↔ 바꿨을 때').

| # | 항목 | Linear | Apple | 지금 앱 | 제안 |
|---|---|---|---|---|---|
| 1 | **바탕** | 어두운 #010102 | **밝은** #fff · #f5f5f7 | 밝은 #fefdfc 한 벌 | **밝은 바탕 유지.** Apple 은 이 앱과 같은 편. 다크 한 벌은 별도 작업 |
| 2 | **강조색** | 라벤더 #5e6ad2 | Apple 파랑 #0066cc | 잉크블루 #27508f | **유지.** "하나만"은 이미 같다. Apple 파랑은 형광에 가까워 2026-08-31 지시와 부딪힌다 |
| 3 | **서체** | Inter | SF Pro(대체 Inter) | Pretendard 한 벌 | **유지.** 2026-09-11 개발자 지시. 둘 다 한글이 없다 |
| 4 | **모서리** | 8/12/16 · "CTA 알약 금지" | 5/8/11/18 · "CTA 는 알약" | 9/13/19/27 · 칩·검색·정렬만 알약 | **유지.** 둘이 정반대이고 앱은 그 사이. Apple 척도(11·18)는 지금(13·19)과 거의 같다 |
| 5 | **그림자** | 거의 안 씀 | **딱 하나** · 제품 사진에만 · UI 에는 없음 | 토큰 10종 · 주 버튼·칩·히어로·시트 | **바꾸는 쪽 권함 — 둘이 같은 말.** 주 버튼·칩의 색 그림자를 빼고 시트·히어로만 남김. UI-9 와 같이 |
| 6 | **그라데이션** | 없음 | 없음 | 히어로 방사광 하나 | **5번과 함께 정할 것.** 5번을 (b)로 하면 같이 빼고, 유지하면 같이 둔다 |
| 7 | **선택 칩** | surface-2 로 한 단 올림 | 흰 바탕 + **2px 파란 테두리** | 강조색 **칠하기** + 색 그림자 | **바꾸는 쪽 권함 — 둘 다 칠하지 않는다.** 이 앱의 칩이 이미 Apple 옵션 칩과 같은 알약이라 **Apple 방식**(흰 바탕 · 2px 테두리)을 제안 |
| 8 | **주 버튼 색** | 강조색 CTA | 강조색 CTA(#0066cc) | 남색 잉크 CTA | **유지.** 둘 다 반대하지만 2026-08-31 개발자 결정("동작 = 잉크"). 뒤집을지는 개발자가 |
| 9 | **터치 표적** | CTA ≥ 40 · 입력 ≥ 44 | **전부 ≥ 44** | 아이콘 38 · 링크 21 · 필터 칩 41 | **바꾸는 쪽 권함 — 여백만.** 글자 크기는 그대로(2026-09-11 지시와 안 부딪힘) |
| 10 | **굵기** | 제목 600 · "700 이상 피함" | 제목 600 · **500 없음**(300/400/600/700) | 제목 800 · 칩·탭 550 · 선언 9종 | **눈으로 보고 정할 것.** (a) 유지 (b) 제목 700 + 550→600 (c) 제목 600. 이전 문서 "다섯"은 사실과 달랐다 |
| 11 | **데스크톱** | 1280 그릇 · 3열 | 1440 그릇 · 5→1열 | 480 폰 프레임 · 1열 | **유지.** 설치형 PWA. 1440 까지 실측 넘침 없음 |
| 12 | **뜻을 가진 색** | 초록 하나 | 기록 없음 | 빨강·주황·초록 | **셋 유지.** 마감 임박을 색 없이 말할 방법이 없다 |
| 13 | **포커스 링** | 2px · 50% | 2px solid · 흐리지 않음 | 3px · 18% | **바꾸는 쪽 권함 — 둘이 같은 말.** `--ring` 한 줄 |
| 14 | **누름 반응** | — | 모든 버튼 `scale(0.95)` 하나 | `.btn:active` 0.98 · 칩·아이콘은 반응 없음 | **바꾸는 쪽 권함.** 값(0.95/0.97)보다 **전부에 거는 것**이 요점. "정적이다"(2026-09-09 지적)와 닿는다 |
| 15 | **히어로 소형 폰** | — | 폭마다 한 단 내림(56→40→34→28) | 38 고정 · **360px 에서 두 줄** | **바꾸는 쪽 권함.** `max-width: 375px` 에서 `--t-3xl` 27px 로 — 있는 척도 안에서 한 단 |
| 16 | **본문 크기** | 16px | 17px · 1.47 | 14.5px · 1.5 | **유지 · 재론 없음.** 2026-09-11 개발자 지시로 17 → 14.5 로 되돌린 바로 그 값 |
| 17 | **절 가르기** | 얇은 선 | 밝은 판 ↔ 어두운 판 번갈아 | 얇은 선 + 34px | **유지.** Linear 가 이 앱과 같은 편. 판을 번갈아 칠하면 「카드는 선으로」가 무너진다 |

**정해 주면 이렇게 진행한다**: 각 번호에 (a)/(b) 또는 "유지"만 적어 주면 된다. **5·6·7·9·13·14** 는 전부 덜어내거나 한 줄
고치는 방향이라 한 번에 하는 것이 자연스럽다. **10** 은 앱 인상이 바뀌므로 실제 앱에 임시로 적용해 폰으로 본 뒤 정한다.
**15** 는 360px 폰을 쓰는 학생이 지금도 보고 있는 화면이라 먼저 해도 된다. 1·2·3·8·11·16 은 개발자 결정이 이미 있는 자리라 다시 묻지 않는다.
