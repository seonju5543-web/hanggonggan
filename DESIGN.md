---
version: alpha
name: handaejang-design-system
description: "한대장(한국 대학교 장학금) 모바일 PWA 의 디자인 시스템. 흰색에 베이지 한 방울을 탄 밝은 바탕(#fefdfc) 위에 먹빛 글자(#17191c), 그리고 채도를 낮춘 잉크블루(#27508f) **하나**만을 강조색으로 쓴다. 동작(누를 수 있음)은 남색 잉크(#1e2b42)가 맡고, 뜻을 가진 색(마감·검수 전·선정)은 셋뿐이며 전부 채도 60% 아래다. 본문도 제목도 Pretendard 한 벌이고 제목은 굵기·자간으로만 구분한다(2026-09-11 개발자 지시로 SUIT·SUITE 에서 되돌림) — 숫자(금액·남은 날·적합도)가 화면의 주인공이라 tabular-nums 로 자리를 고정한다. 카드는 흰 면 위의 얇은 선(hairline)으로 가르고, 그림자는 떠 있는 것(시트·주 버튼·마스코트)에만 준다. 첨부된 Linear DESIGN.md 의 **구조**(단일 강조색 · 면의 사다리 · 얇은 선 · 4px 격자 · 이름 붙인 컴포넌트)를 그대로 받되, **값**(어두운 바탕·라벤더·Inter)은 이 앱의 기존 결정(2026-08-31 팔레트 · 2026-09-11 서체 되돌림)을 지킨다. 값을 바꾸는 항목은 맨 아래 「Linear 와 충돌 · 컨펌 대기」에 모아 두었다."

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
  semantic-warning: "#8f3a2e"
  semantic-warning-weak: "#f5e9e6"
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
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.accent}"
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
숫자는 2026-09-11 에 브라우저에서 실제로 계산된 값이다), 관문은 `verify/ui-tone.mjs` 다.
값을 바꾸려면 **`style.css` 를 고치고 이 문서를 따라 고친다.** 반대로 하면 두 벌이 갈라진다.

첨부된 Linear DESIGN.md(`docs/designs/DESIGN-linear-reference.md` 로 보관)와 이 앱은 **다른 물건**이다 —
그쪽은 어두운 바탕의 **마케팅 페이지**, 이쪽은 밝은 바탕의 **학생용 도구**다. 그래서 받아들인 것은
셋의 **뼈대**이고, 값은 이 앱의 것이다:

| Linear 에서 받은 것 | 이 앱에서 무엇인가 |
|---|---|
| 강조색은 **하나**, 그것도 드물게 | `{colors.accent}` 잉크블루 — 눌린 탭 · 구획 건수 · 제목 밑줄 · 링크 · 필터 칩에만 |
| 면의 사다리(canvas → surface-1 → surface-2) | `{colors.canvas}` 베이지 한 방울 → `{colors.surface-1}` 순백 카드·시트 → `{colors.surface-2}` 눌린 면 |
| 얇은 선(hairline)으로 가르기 | `{colors.hairline}` 9% · `{colors.hairline-strong}` 14% — 카드 사이 · 구획 사이 |
| 4px 격자 · 이름 붙인 여백 | `--space-4 … --space-40` + 세로 리듬 넷(`--sp-1~4` = 8 · 16 · 24 · 40) |
| 큰 글자일수록 자간을 좁힌다 | `--track-display` −0.03em(24px 이상) · `--track` −0.014em(본문) · `--track-flat` 0(숫자·배지) |
| 컴포넌트에 이름을 붙여 부른다 | 위 `components:` — 앞으로 화면 이야기는 이 이름으로 한다 |
| 반전 면(inverse) 하나 | `{colors.inverse-canvas}` 남색 — 홈 히어로 패널 · 마스코트 · 토스트 |

**받지 않은 것**(어두운 바탕 · 라벤더 · Inter · 8px 모서리 · 그림자 없음 · 3열 격자)은 맨 아래
「Linear 와 충돌 · 컨펌 대기」에 있다. 그 항목들은 **개발자가 정하기 전까지 코드를 바꾸지 않는다.**

## 색

> 출처: `style.css` `:root` 마지막 선언(2026-08-31 「누런 기운 빼기」· 「색 미세 조정」· 2026-09-01). 화면에서 실제로 계산된 값.

### 바탕과 면 (surface ladder)

- **Canvas** (`{colors.canvas}` #fefdfc): 화면 바탕. 흰색에 베이지 한 방울 — R254 G253 B252. 🔴 순백(#ffffff)으로 올리지 말 것 — 카드와 바탕이 같은 색이 되어 사다리가 무너진다. `manifest.json` `background_color` · `<meta theme-color>` 와 **같은 값**이어야 한다(부팅 화면이 깜빡이지 않게).
- **Surface 1** (`{colors.surface-1}` #ffffff): 한 단 위 — 카드가 아니라 **시트 · 입력칸 · 반전 버튼**. 목록 카드는 면을 칠하지 않고 얇은 선으로만 가른다(아래 「카드」).
- **Surface 2** (`{colors.surface-2}` #f7f6f4): 눌린 면 · 첨부 블록 · 자격 요약 칩의 바탕.
- **Hairline** (`{colors.hairline}` 9%): 카드 사이 · 목록 줄 사이 1px 선. **선은 겹치지 않는다** — 구획 선과 목록 첫 선이 겹치던 것을 2026-08-31 에 하나로 줄였다(`.card-list { border-top: 0 }`).
- **Hairline Strong** (`{colors.hairline-strong}` 14%): 구획 머리 위의 선 · 입력칸 테두리.

### 잉크(글자)

- **Ink** (`{colors.ink}` #17191c): 제목·본문. 갈색 기운을 뺀 먹 — 흰 바탕 위 16:1.
- **Ink Muted** (`{colors.ink-muted}` #545a62): 설명 · 빈 상태 · 정렬 버튼. 7.6:1.
- **Ink Subtle** (`{colors.ink-subtle}` #888e97): 기관명 · 금액 미확인 · 안 눌린 탭. 3.6:1 — **안 읽어도 되는 글자에만** 쓴다(본문에 쓰면 접근성 기준 4.5:1 미달).

### 동작과 강조

- **Primary** (`{colors.primary}` #1e2b42): 주 버튼 · 아바타 — **남색 잉크**. "누를 수 있다"는 뜻은 채도가 아니라 무게로 말한다. 눌린 상태 `{colors.primary-hover}` #131c2c.
- **Accent** (`{colors.accent}` #27508f): **이 앱의 유일한 유채색.** 쓰는 자리는 다섯 — 눌린 탭(`bottom-nav-selected`) · 구획 머리의 건수(`.list-group-n`) · 화면 제목 밑 28px 강조선 · 링크 버튼(`button-link`) · 눌린 필터 칩. 🔴 형광 파랑(#2f6bff)으로 되돌리지 말 것 — 2026-08-31 개발자 지시. 그 색 하나가 앱을 '흔한 AI 화면'으로 만든다.
- **Accent Soft / Line** (`{colors.accent-soft}` · `{colors.accent-line}`): 강조 배지의 바탕 · 포커스 링. CSS 원본은 rgba(39,80,143) 9% · 24% 이고, 위 front matter 에는 흰 면 위에서 보이는 불투명 값(#eceff5)을 적었다(린터가 투명도를 못 재서). `{colors.primary-weak}` #f2f2f3 도 같은 이유 — CSS 는 잉크 5.5% 다.
- **Brand Mascot** (`{colors.brand-mascot}` #b8912f): 학사모 금색. **그림 안의 색**이라 화면 요소에는 쓰지 않는다.

### 뜻을 가진 색 (semantic)

전부 채도 60% 아래 — 중성 위에 얹히게. **뜻이 있을 때만** 쓴다(장식 금지).

- **Danger** (`{colors.semantic-danger}` #8f3a2e): 마감 임박(7일 이내) · 초기화. 카드의 `오늘 마감` 글자와 아래 막대가 이 색이다.
- **Warning** (`{colors.semantic-warning}`): 자동 등록·검수 전 · 컨펌 대기. **2026-09-11 개발자 결정(12번)으로 빨강과 같은 값**(#8f3a2e)이다 — 역할은 남기고 색조만 둘로 줄였다. CSS 의 `--orange` 이름은 그대로 두고 값만 `--red` 와 같다.
- **Success** (`{colors.semantic-success}` #3d6b47): 선정 · 신청 완료 기록. 🔴 **첨부 개수 같은 중립 정보에 이 색을 쓰지 말 것** — 2026-09-11 에 '첨부 n개'가 초록이라 '신청이 끝났다'로 읽혔다(운영 원칙 1).

### 반전 면 (inverse)

- **Inverse Canvas** (`{colors.inverse-canvas}` #182338): 홈 히어로 패널 · 마스코트 · 도우미. `--grad-navy` 는 이 남색 위에 **방사형 빛 하나**(오른쪽 위 파란 기운 30%)를 얹은 것이다 — 45도 균일 그라데이션은 쓰지 않는다.
- **Inverse Ink** (`{colors.inverse-ink}` #ffffff · `{colors.inverse-ink-muted}` 75%): 패널 안 글자.

## 서체

### 글꼴

- **SUIT Variable** — 본문·버튼·배지·입력. 숫자와 비율이 정돈된 UI 본문용. 이 앱은 금액·마감·적합도처럼 **숫자가 주인공**이라 여기에 맞다(2026-09-10 개발자 지시 "폰트와 앱 분위기, 바이브").
- **SUITE Variable** — 제목·금액. 같은 활자소(Sun)의 짝이라 본문과 어울리면서 기하학적 골격이라 제목에서 다른 목소리가 난다. 🔴 본문에 쓰지 않는다 — 길게 읽으면 피로하다.
- 되돌아갈 자리: **Pretendard**. 🔴 스택 마지막의 Pretendard 를 지우지 말 것 — CDN 이 흔들리면 글자가 조용히 다 깨진다(관문이 지킨다).
- ⚠️ 이 세션의 샌드박스는 CDN 을 막아 아래 스크린샷은 **전부 시스템 대체 글꼴**로 그려졌다. 실제 앱은 SUIT/SUITE 다.

### 척도

| 토큰 | 크기 | 굵기 | 줄간격 | 자간 | 쓰는 곳 |
|---|---|---|---|---|---|
| `{typography.display-hero}` | 46px | 800 | 1.2 | −0.03em | 홈 히어로 금액 **하나뿐** |
| `{typography.display-lg}` | 30px | 800 | 1.2 | −0.03em | 온보딩 제목 |
| `{typography.headline}` | 27px | 800 | 1.2 | −0.03em | 상세 시트 제목 |
| `{typography.title}` | 24px | 800 | 1.35 | −0.03em | 화면 제목 · 인사말 · MY 이름 |
| `{typography.card-title}` | 20px | 700 | 1.35 | −0.01em | 공고 카드 제목 · 구획 머리 |
| `{typography.body}` | 17px | 400 | 1.5 | −0.014em | 본문 · 필터 칩 · 원문 발췌 |
| `{typography.body-sm}` | 15px | 400 | 1.5 | −0.014em | 히어로 설명 · 정렬 · 링크 |
| `{typography.caption}` | 13.5px | 600 | 1.5 | −0.014em | 기관명 · 마감 · 적합도 |
| `{typography.meta}` | 12px | 600 | 1.5 | 0 | 배지 · 탭 이름 |
| `{typography.button}` | 16px | 700 | 1.5 | −0.014em | 버튼 |
| `{typography.number}` | 17px | 800 | 1.5 | 0 | 카드 금액(SUITE · tabular-nums) |

🔴 **비율이 있는 척도다** — 단계마다 최소 1.08배(실제 1.11배). 전에는 11.5 · 12.5 · 13.5 · 14.5 가 3px 안에 몰려
화면 절반이 "그냥 작은 회색 글자"였다. 새 크기를 끼워 넣지 말 것(관문 `ui-tone` '서체와 글자 척도').

### 원칙

- **굵기는 다섯 가지뿐** — 400 · 500 · 600 · 700 · 800. 줄간격도 다섯(1 · 1.2 · 1.35 · 1.5 · 1.65).
- **큰 글자는 좁히고 숫자는 안 좁힌다.** 24px 이상 −0.03em, 본문 −0.014em, 숫자·배지·영문 약자 0. 🔴 한글에 **양수 자간**(+0.02em 이상)을 주지 말 것 — '발 급 방 법'처럼 벌어진다(라틴 대문자 습관).
- **숫자는 `tabular-nums`.** 금액 · 남은 날 · 적합도 · 건수 — 자리가 흔들리면 카드가 미세하게 어긋나 '대충 만든 느낌'이 된다.
- **한국어는 어절 단위로 끊는다** — `word-break: keep-all` + `overflow-wrap: break-word` 짝. 인쇄 문서(`.fd-*`)와 원문 발췌는 원본 줄바꿈이 뜻을 가지므로 예외.
- 본문 17px 은 Linear 의 16px 보다 크다 — **한국어 본문은 16px 아래에서 급격히 읽기 힘들어지고**, 이 앱은 공고 원문을 그대로 읽히는 앱이라 본문이 주인공이다.

## 배치

### 여백

- **기본 단위 4px.** `{spacing.xxs}` 4 · `{spacing.xs}` 8 · `{spacing.sm}` 12 · `{spacing.md}` 16 · `{spacing.lg}` 24 · `{spacing.xl}` 32 · `{spacing.xxl}` 40. 2px · 6px 는 격자 밖이지만 아이콘과 글자 사이처럼 4px 도 넓은 자리를 위해 남긴다.
- **세로 리듬은 넷** — 같은 덩어리 안 8 · 덩어리 사이 16 · 절 안의 묶음 사이 24 · 절과 절 사이 40 (`--sp-1~4`). 새 요소를 만들 때 숫자를 직접 쓰지 말고 여기서 고른다.
- 화면 좌우 여백 `{spacing.screen-gutter}` 20px. 카드 안쪽 16px 20px. 시트 안쪽 20px 24px. 히어로 패널 32px 24px 24px.
- 관문: `ui-tone` '토큰 이탈이 더 늘지 않는다' — 생 px 여백 천장 **20곳**(톱니 · 늘면 실패).

### 그릇과 격자

- **그릇은 폰 한 장이다** — `.app { max-width: 480px }`, 데스크톱에서는 가운데 정렬 + `--shadow-lift`. 격자 열은 없고 목록은 항상 1열이다(아래 「반응형」).
- 홈은 **히어로 패널 → 구획(마감 임박 · 신청 현황 · 실시간 공고)** 순서. 탐색은 **제목 → 검색 → 필터 칩 → 구획 7개**(오늘·내일 마감 / 이번 주 / …).

### 빈 공간의 뜻

바탕이 곧 여백이다. 구획은 **면을 칠해서가 아니라 선 하나와 40px 로** 가른다. 카드도 면을 칠하지 않는다 —
칠하는 것은 눌렸을 때(`{colors.surface-2}`)뿐이다. 그래서 화면에 '떠 있는 것'은 히어로 패널 · 시트 · 주 버튼 · 마스코트 넷이다.

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
| 포커스 | `--ring` 0 0 0 2px 강조색 50% (13번 · 2026-09-11) | 입력칸 · 버튼 |
| 오류 | 테두리 `--red` + outline 2px `--red-weak` — `:user-invalid` 에만 (16번 · 2026-09-11) | 최대·최소를 넘긴 입력칸 |

🔴 **그림자는 바탕의 색조를 띤다** — 순수 검정 저투명도는 회색 때가 낀 것처럼 보인다. 남색 계열 rgba(24,35,56)로 통일했고 빛의 방향은 위 하나다.
🔴 그림자 토큰은 열 개로 **닫혀 있다**(관문 '그림자도 토큰만 쓴다'). 새 값을 만들지 말고 이 중에서 고른다.
⚠️ Linear 는 "그림자를 거의 쓰지 않는다"고 적었고, 노션 백로그 UI-9(그림자가 너무 많다)도 열려 있다 — 아래 「충돌」 5번.

### 장식적 깊이

- 히어로 패널의 **방사형 빛 하나**(`--grad-navy`)가 이 앱의 유일한 그라데이션이다(관문 '그라데이션은 --grad-navy 한 곳').
- 바탕에 아주 옅은 결(`body::after` 노이즈 26%) — 진하면 누런 얼룩으로 보인다.
- 카드 아래 **마감까지 남은 시간 막대**(`interactions.js` 컨텍스트 바) — 재료는 마감일 하나뿐이고 문턱은 7일. 접수 기간의 몇 %가 아니다(원칙 8-1).

## 모양

### 모서리

| 토큰 | 값 | 쓰는 곳 |
|---|---|---|
| `{rounded.hair}` | 3px | 화면 제목 밑 강조선 · 막대 |
| `{rounded.xs}` | 9px | 작은 버튼(ghost · 저장) · 칩 안쪽 |
| `{rounded.sm}` | 13px | 주 버튼 · 입력칸 · 토스트 |
| `{rounded.md}` | 19px | 카드형 패널(온보딩 · MY 카드) |
| `{rounded.lg}` | 27px | 히어로 패널 · 시트 윗모서리 |
| `{rounded.pill}` | 999px | 필터 칩 · 정렬 버튼 · 배지 |
| `{rounded.full}` | 9999px (CSS 는 `50%`) | 아바타 · 마스코트 |

**중첩 반경 규칙** — 안쪽은 더 조이고 바깥은 더 부드럽게(시트 27 안의 버튼 13 안의 배지 9). 바깥보다 안쪽이 둥글면 '덜 만든 앱'이 된다.
관문: `ui-tone` '모서리는 토큰만 쓴다'.

### 그림과 마스코트

- 마스코트(학사모 캐릭터)는 도우미 FAB 56px 원 안에 산다. 🔴 캐릭터를 다른 곳에 장식으로 뿌리지 말 것 — 백로그 UI-7 이 "원형 FAB 안의 캐릭터는 AI 앱의 표식"이라고 이미 지적하고 있다.
- 사진은 없다. 기관 로고도 싣지 않는다(원문 링크가 대신한다).

## 컴포넌트

### 버튼

**`button-primary`** — 남색 잉크 주 버튼. 화면당 **하나**.
- `{colors.primary}` 바탕 · `{colors.on-primary}` 글자 · `{typography.button}` · `{rounded.sm}` 13px · 16px 20px · `--shadow-btn`. 눌림 `button-primary-hover` (#131c2c), 잠김 `button-primary-disabled` (12% 잉크 · 그림자 없음). 높이 60px 안팎(`.btn-lg` — 여백 16px + 글자 20px).

**`button-inverse`** — 남색 패널 위의 흰 버튼(홈 히어로 "12건 신청 준비"). `{colors.surface-1}` 바탕 · `{colors.ink}` 글자 · `--shadow-btn-white`.

**`button-ghost`** — 얇은 선 버튼(더보기 · 원문). 투명 바탕 · `{colors.ink-muted}` · 1px hairline · `{rounded.xs}` · 6px 12px · 최소 32px.

**`button-link`** — 글자만 있는 버튼("전체 보기" · "수정하기 ›"). `{colors.accent}` · `{typography.body-sm}` 600. 🔴 지금 실측 높이 23px — 아래 「반응형 · 터치 표적」.

### 칩과 정렬

**`filter-chip`** / **`filter-chip-selected`** — 탐색의 전체 · 교내 · 교외 · 신청 가능만.
- 기본: `{colors.surface-1}` 바탕 · 1px hairline · `{colors.ink-muted}` 글자. 선택: **`{colors.accent}` 칠하기** + `--shadow-chip`. `{rounded.pill}` · 8px 16px · `{typography.body}` 600.
- ⚠️ Linear 의 선택 칩은 '면을 한 단 올리는 것'이고 칠하지 않는다 — 아래 「충돌」 7번.

**`sort-button`** — "↕ 적합도순". 투명 · 1px hairline · pill · 최소 44px.

### 카드와 그릇

**`notice-card`** — 공고 카드. **이 앱의 주인공.**
- 면을 칠하지 않고 아래 1px hairline 으로 가른다. 16px 20px. 누르면 `notice-card-pressed` (`{colors.surface-2}`). 마감된 카드는 55% 불투명.
- 안의 순서는 **기관 글(caption · ink-subtle) → 제목(card-title) → 금액(number · SUITE 800) + 마감(caption · danger 7일 이내)**. 배지는 **최대 1개**(미달 · 미확인 · 신청 완료에만). 금액을 못 읽은 공고는 감추지 않고 `.sch-amount.unknown` 으로 무게만 낮춘다(원칙 8-1).
- 🔴 카드를 그리는 함수는 둘이다(`schCard` · `liveNoticesHtml`) — 하나만 고치면 한 화면에 카드 말투가 두 가지가 된다(2026-09-11 실사고).

**`hero-panel`** — 홈 히어로. `{colors.inverse-canvas}` + `--grad-navy` · `{rounded.lg}` 27px · 32px 24px 24px · `--shadow-lift`. 안에 `display-hero` 금액 하나, 설명 한 줄, `button-inverse` 하나. 🔴 숫자에 해명 세 토막을 붙이지 않는다(백로그 UI-6) — 해명은 "금액을 아직 못 읽은 n건은 뺀 금액이에요" 한 줄.

**`bottom-sheet`** — 상세·도우미·일괄 준비 전부 이 그릇(`#detail-sheet`). `{colors.surface-1}` · 윗모서리 `{rounded.lg}` · 20px 24px 32px · `--shadow-sheet` · 위에 손잡이. **전부 아래로 쓸어내려 닫는다**(`enableSheetSwipe` 한 곳 · 2026-08-21 개발자 지시). 데스크톱에서도 폭 480px 가운데.

**`empty-state`** — "없어요" 한 가지 말투 + 다음 동작 단추 하나. `{colors.ink-muted}` · 32px 20px.

### 배지

**`status-badge`** 와 변형 셋 — `{typography.meta}` 12px 600 · `{rounded.pill}` · 4px 8px.
- 중립(`status-badge`): 잉크 5.5% 바탕 · ink-muted — 교내/교외 · 종류.
- `status-badge-danger`: 마감 임박. `status-badge-warning`: 검수 전 · 컨펌 대기. `status-badge-accent`: 양식 있음 · 상시 제도.
- 🔴 적합도는 배지가 아니라 **글자**다(`.sch-fit` caption) — 다섯 장 연속 같은 색 덩어리가 제목보다 먼저 읽혔다.

### 입력

**`text-input`** — `{colors.surface-1}` · 1px 잉크 10% 테두리 · `{rounded.sm}` 13px · 16px · `{typography.body}`. 포커스: 테두리 `{colors.primary}` + `--ring`. 최소 높이 56px. 체크박스는 앱 공용 그림을 써야 보인다(전역 `appearance:none`).

### 탐색

**`bottom-nav`** — 4탭(홈 · 장학금 · 신청내역 · MY). 반투명 바탕(canvas 82%) + 위 1px hairline · 높이 73px + 안전 영역. 아이콘 23px 선 1.8 + `{typography.meta}`. 선택 `bottom-nav-selected` = `{colors.accent}` 글자 + 아래 짧은 강조선. 🔴 이 앱의 **눌린 탭이 강조색을 쓰는 유일한 자리 중 하나**다 — 전에는 먹색이라 안 눌린 것과 굵기로만 갈렸다.

**`mascot-fab`** — 도우미 진입. 56px 원 · `{colors.inverse-canvas}` · 그림자 34%. 끌어서 옮길 수 있다("끌어서 이동 가능" 툴팁). 탭바 바로 위에 떠서 목록 마지막 항목을 가린다(UI-7 · 열려 있음).

**`toast`** — `{colors.semantic-overlay}` 94% · 흰 글자 · `{rounded.sm}` · 8px 16px · 아래에서 올라온다.

## 하는 것 · 하지 않는 것

### 한다

- 강조색 `{colors.accent}` 는 **다섯 자리에만** — 눌린 탭 · 구획 건수 · 제목 밑줄 · 링크 · 눌린 칩.
- 새 색을 만들지 않는다. 필요하면 **있는 토큰을 안 쓰던 자리에** 쓴다(2026-09-10 페이스리프트의 방식).
- 위계는 굵기가 아니라 **크기**로 세운다(척도가 1.11배씩 벌어져 있으니 가능하다).
- 화면당 주 버튼 하나. 나머지는 ghost 나 link.
- 카드는 선으로 가른다. 칠하는 것은 눌렸을 때뿐.
- 모르는 값은 감추지 않고 **무게를 낮춰서** 보여 준다(금액 미확인 · 기한 원문 확인). 원칙 8-1.
- 시트는 아래로 쓸어내려 닫히게 만든다.
- 화면이 어떻게 보이는지는 **`node verify/what-shows.mjs <공고>`** 로 재고 말한다.

### 하지 않는다

- 형광 파랑 · 보라·파랑 그라데이션 · 45도 균일 그라데이션 — 전부 2026-08-31 에 걷어낸 'AI 지문'이다.
- 이모지 · 한글 문장 속 느낌표 · 앱이 1인칭으로 말하기(`ui-tone` ①②③ 관문).
- 한글에 양수 자간. 11px 아래 글자. 새 글자 크기.
- 배지 두 개 이상을 한 카드에. 첨부 개수에 초록.
- 캐릭터를 장식으로. 사진·로고.
- `display` 를 클래스에 직접 — `[hidden]` 이 안 먹는다(열한 번 재발한 버그).
- 라이트/다크 두 벌 — 지금 앱은 **밝은 한 벌**이다(아래 「충돌」 1번 참조).

## 반응형 (2026-09-11 실측 · Playwright · 서비스워커 포함)

### 재 본 폭

| 폭 | 그릇 폭 | 왼쪽 여백 | 가로 넘침 | 비고 |
|---|---|---|---|---|
| 360 | 360 | 0 | 없음 | 소형 폰 · 히어로 금액 46px 한 줄에 들어감 |
| 390 | 390 | 0 | 없음 | 기준 폰(iPhone 14 급) |
| 768 | 480 | 144 | 없음 | 태블릿 — 폰 프레임 가운데 + `--shadow-lift` |
| 1024 | 480 | 272 | 없음 | 노트북 |
| 1440 | 480 | 480 | 없음 | 데스크톱 — 양옆 여백이 각각 프레임 폭만큼 |

- **미디어 쿼리는 하나뿐**(`min-width: 520px` — 프레임 그림자). 나머지는 `prefers-reduced-motion` 넷과 `hover: none`(손가락 기기에 hover 색이 눌린 채 굳지 않게).
- 바텀시트 · 탭바 · 토스트 모두 프레임 폭(480)에 맞춰 가운데에 뜬다 — 데스크톱에서도 모바일 배치가 그대로다.
- 확대 막기: `viewport maximum-scale=1` + `touch-action: pan-x pan-y` + gesture 차단 한 세트.

### 터치 표적 (Linear 기준 CTA ≥ 40px · 입력 ≥ 44px)

| 요소 | 실측 | 판정 |
|---|---|---|
| `button-primary` | 52px 이상 | 통과 |
| `text-input` | 56px | 통과 |
| `sort-button` | 44px | 통과 |
| 탭(`bottom-nav`) | 53px | 통과 |
| 아이콘 버튼(알림 · 설정) | **38×38** | 40 미만 — 2px 모자람 |
| `button-link`("전체 보기") | **64×23** | 40 미만 — 글자 높이 그대로 |

두 항목은 코드 변경 없이 판정만 적는다(이 문서는 코드를 바꾸지 않는다). 고칠 때는 여백(padding)으로 표적만 키우고 글자 크기는 그대로 둔다 — 아래 「충돌」 9번에 컨펌 항목으로 넣었다.

### 줄이는 방식

- **목록**: 언제나 1열. 폭이 넓어져도 카드가 옆으로 늘어나지 않는다(프레임이 480 에서 멈춘다).
- **히어로 금액**: 46px 고정. 360px 폭에서도 "최대 805만원"이 한 줄에 들어간다(실측). 8자리 금액(1,000만원 이상)은 재 보지 않았다.
- **한국어 줄바꿈**: `keep-all` 이라 좁은 폭에서 제목이 어절 단위로 두 줄이 된다(360px 에서 확인).

## 반복할 때의 순서

1. 한 번에 컴포넌트 **하나**만 — 위 `components:` 이름으로 부른다.
2. 새 구획을 만들 때 먼저 정한다: 선으로 가르나(1단) · 눌림 면인가(2단) · 떠 있나(4단).
3. 본문은 `{typography.body}` 17px 400 이 기본. 제목만 SUITE.
4. 값을 고쳤으면 `node verify/ui-tone.mjs` — 톱니 천장(여백 20 · 유채색 76 · 없는 토큰 0)을 넘기면 빨간불.
5. 화면 이야기는 `node verify/what-shows.mjs <공고>` 로 재고 한다.
6. 강조색은 아낀다. 여섯 번째 자리를 만들려면 다섯 자리 중 하나를 뺀다.
7. 이 문서의 숫자를 바꿀 때는 **`style.css` 를 먼저** 고친다(문서는 사본이다).

## 아직 없는 것

- **다크 모드가 없다.** `:root[data-theme="dark"]` 규칙이 `essay-*` 몇 곳에만 있고 나머지는 밝은 한 벌이다. 폰 설정이 다크인 학생에게도 밝게 뜬다.
- **태블릿·데스크톱 배치가 없다.** 폰 프레임을 가운데 두는 것이 전부다.
- 입력칸의 오류 상태 색이 정해져 있지 않다(온보딩은 오류를 문구로만 말한다).
- 안 눌린 탭 이름과 기관명이 `{colors.ink-subtle}` 3.6:1 이라 WCAG AA(4.5:1)에 못 미친다 — 12~13.5px 글자라 실제로 읽기 어렵다는 지적이 오면 `{colors.ink-muted}` 로 한 단 올린다(린터 경고 그대로 남겨 둠).
- 인쇄 문서(`.fd-*` · `.form-doc`)와 도우미(`.chat-*`)는 이 시스템 밖이다 — 원본 서식 그대로 · 2026-08-29 지시로 손대지 않는다.
- Mobbin 대조는 이번에 하지 못했다 — 커넥터가 유료 플랜을 요구해 검색이 거부됐다(2026-09-11 · `Mobbin MCP requires a paid plan`).

---

## Linear 와 충돌 · 컨펌 대기 (2026-09-11)

첨부된 Linear DESIGN.md 와 지금 코드가 **다르게 정해 둔 것**들이다. 어느 쪽이든 고를 수 있지만
전부 **앞선 개발자 결정이나 열린 백로그와 얽혀 있어** 코드를 바꾸지 않고 여기에 모았다.
🔴 정하기 전까지 `style.css` 는 한 줄도 바꾸지 않았다.

### 2026-09-11 개발자 결정 — 반영된 것과 남긴 것

| # | 결정 | 코드에 한 것 |
|---|---|---|
| 7 | 적용 | 선택 칩 = `surface-2` 바탕 + 강조색 글자 + `--accent-line` 선 · 그림자 없음 |
| 11 | 적용 (공고는 세로) | ≥1024px 에서 프레임 960 · 홈은 히어로가 왼쪽에 고정된 두 칸 · 목록은 **어느 폭에서도 1열** · 시트 640 · 탭바·마스코트는 프레임을 따라감. 데스크톱 전용 홈페이지는 **만들지 않는다**(아래 「11번 검토」) |
| 12 | 적용 (색조 셋 → 둘) | `--orange` 값을 `--red` 와 같게 — 검수 전·컨펌 대기 역할은 그대로, 빨강 색조로 |
| 13 | 적용 | `--ring` 2px · 강조색 50% |
| 16 | 적용 | `:user-invalid` 입력칸에 빨간 테두리 + 옅은 빨강 outline. 문구는 새로 만들지 않았다 |
| 18 | 적용 (중요한 건 검은색) | 구획 이름표를 `--t-xs` 700 회색으로 내리고, 마감을 말하는 구획(홈 '마감 임박' · 탐색 첫 구획)만 먹색. 양수 자간은 안 준다 |
| 19 | 탭 표시만 | 눌린 탭의 점(4px 원) → 선(18×2). 옅은 글자 대비는 그대로 |
| 나머지 | 유지 | 1·2·3·4·5·6·8·9·10·14·15·17 은 건드리지 않았다(개발자 지시) |

**11번 검토 — 데스크톱 전용 홈페이지를 따로 만들어야 하나** (2026-09-11 · 웹 검색으로 확인한 것만):
또래 앱 셋(에브리타임 everytime.kr · 드림스폰 dreamspon.com · 캠퍼스픽 campuspick.com)은 전부 **별도의 데스크톱 사이트가
아니라 같은 앱을 웹에서 넓게 보여 주는 방식**이고, PC·모바일 이용 비율은 어느 곳도 공개하지 않는다. 그래서 지금은
전용 홈페이지를 만들지 않고 위 반응형 두 칸 배치로 둔다. 다시 볼 시점: 앱 소개(랜딩)가 필요해질 때 — 그때는
Linear 문서의 마케팅 절(제품 화면이 주인공 · 1280 그릇)이 통째로 쓸모가 생긴다.

| # | 항목 | Linear | 지금 앱 | 얽힌 결정 | 제안 |
|---|---|---|---|---|---|
| 1 | **바탕** | 어두운 #010102 · "라이트 모드를 내지 말 것" | 밝은 #fefdfc 한 벌 · 다크 없음 | 2026-08-31 「누런 기운 빼기」 · manifest/theme-color 와 한 세트 | **밝은 바탕 유지.** 학생이 공고 원문을 오래 읽는 앱이라 밝은 면이 맞다. 원하면 `prefers-color-scheme` 다크 **한 벌 추가**를 별도 작업으로(토큰이 이미 갈라져 있어 가능) |
| 2 | **강조색** | 라벤더 #5e6ad2 | 잉크블루 #27508f | 2026-08-31 개발자 지시 "형광 파랑으로 돌아가지 말 것" | **잉크블루 유지.** 라벤더로 바꾸면 남색 패널·주 버튼과 두 계열이 된다. 바꾸려면 `--accent`·`--accent-soft`·`--accent-line`·`--ring`·`--shadow-chip`·`--grad-navy` 여섯을 한 번에 |
| 3 | **서체** | Inter / SF Pro (Linear 커스텀) | SUIT 본문 + SUITE 제목 | 2026-09-10 개발자 지시 · 관문 '서체와 글자 척도' | **SUIT/SUITE 유지.** Inter 는 한글이 없어 결국 Pretendard 로 떨어진다 |
| 4 | **모서리** | 버튼 8 · 카드 12 · "CTA 를 알약으로 만들지 말 것" | 버튼 13 · 패널 19/27 · 필터 칩·정렬·배지 **알약** | 「중첩 반경 규칙」(2026-08-31) · 관문 '모서리는 토큰만' | 둘 중 하나: **(a)** 지금 유지 **(b)** 척도를 8/12/16/24 로 내리고 칩만 알약 남김. (b)는 앱 인상이 확 달라져 개발자 판단 필요 |
| 5 | **그림자** | 거의 안 씀 · 면의 사다리 + 얇은 선 | 토큰 10종 · 주 버튼·칩·히어로·시트에 사용 | 백로그 **UI-9 "그림자가 너무 많다" (열림)** | **Linear 쪽으로 가는 것을 권함** — 주 버튼·칩의 색 그림자(`--shadow-btn`·`--shadow-chip`)를 빼고 시트·히어로만 남기는 안. UI-9 와 같이 처리 |
| 6 | **그라데이션** | "대기 같은 그라데이션 없음" | 히어로에 방사형 빛 하나(`--grad-navy`) | 2026-08-31 에 45도 균일 그라데이션을 걷어내고 남긴 것 | 지금 유지(장식이 아니라 패널의 깊이). 5번과 함께 빼도 된다 |
| 7 | **선택 칩** | 면을 한 단 올림(surface-2) · 칠하지 않음 | 강조색 **칠하기** + 색 그림자 | 2026-08-31 「강조색만 놋쇠 → 파랑」 | Linear 방식이 더 조용하다 — **(a)** 유지 **(b)** `surface-2` 바탕 + 강조색 글자로 바꿈. 5번과 한 세트 |
| 8 | **주 버튼 색** | 강조색으로 칠한 CTA | 남색 잉크 CTA(강조색은 링크·탭에만) | "동작 = 잉크, 파랑이 아니다"(2026-08-31) | **지금 유지.** 강조색 CTA 로 바꾸면 화면당 파랑이 셋 이상이 된다 |
| 9 | **터치 표적** | CTA ≥ 40 · 입력 ≥ 44 | 아이콘 버튼 38 · 링크 버튼 23 | 없음(단순 실측) | **고치는 것을 권함** — 여백만 키워 40/44 로. 글자 크기는 그대로 |
| 10 | **제목 굵기** | 600 · "700 이상을 피한다" | 800 (히어로·시트·화면 제목) | 백로그 UI-8(완료 · 굵기 9→5종) | 한글 SUITE 는 600 이 라틴 600 보다 가늘어 보인다. **(a)** 유지 **(b)** 제목 700 으로 한 단 내림 — 눈으로 봐야 정할 수 있다 |
| 11 | **데스크톱** | 1280 그릇 · 카드 3열 → 2열 → 1열 | 480 폰 프레임 가운데 · 항상 1열 | 앱은 모바일 PWA(설치형) | **지금 유지.** 데스크톱 이용은 드물고, 3열로 펴면 카드 두 함수·시트·탭바를 전부 다시 짜야 한다. 원하면 별도 항목으로 |
| 12 | **뜻을 가진 색** | 초록 하나(success)만 | 빨강(마감) · 주황(검수 전) · 초록(선정) | 운영 원칙 1(정직한 상태) · 마감 표기 | **셋 유지.** 마감 임박을 색 없이 말할 방법이 없다 |
| 13 | **포커스 링** | 2px · 강조색 50% | 3px · 강조색 18% | 없음 | 아무 쪽이나 — 바꾸면 `--ring` 한 줄 |

### 추가 후보 14~19 — Linear 에는 있고 우리에겐 없는데 아무 결정과도 안 부딪히는 것 (2026-09-11)

위 13건과 달리 **뒤집을 결정이 없어** 컨펌 없이도 할 수 있는 종류다. 그래도 한 번에 정하는 편이 화면이 한 방향으로 움직인다.
대조 그림은 `docs/designs/mockups/design-conflicts.html` 14~19번.

| # | 항목 | 지금 앱 | 바꾸면 | 제안 |
|---|---|---|---|---|
| 14 | 면의 사다리 4단(드롭다운 = surface-3) | 정렬 메뉴가 흰 면 + `--shadow-lift` | 메뉴가 한 단 밝은 면(#f2f1ee) + 선 14% · 그림자 0. 토큰 하나 추가 | **권장 · 5번과 같이** |
| 15 | 떠 있는 패널 윗변 1px 흰 선 | 히어로에 흰 원 장식(8%) | 원을 빼고 윗변에 inset 1px 흰 14%. 시트도 같은 처리 | 눈으로 결정 · 6번과 짝 |
| 16 | 입력칸 오류 상태 색 | 문구로만 말함 | 잘못된 칸 테두리 `--red` + 링 14% + 문구 `--red`. 새 색 없음 | **권장** |
| 17 | 카드 hover 에 진한 선 | surface-2 만 | `@media (hover: hover)` 안에서 테두리 14% 추가 | 아무 쪽이나 · 폰에선 차이 없음 |
| 18 | eyebrow(작은 글자 + 양수 자간) | 20px 800 제목 | **받지 않는다** — 한글 양수 자간 금지(2026-09-01)와 충돌 | 유지 |
| 19 | 옅은 글자 대비 4.5:1 | `--text-weak` #888e97 (3.6:1) | 토큰 값을 #545a62 급이나 중간값(#6b717a · 5.2:1)으로 | **권장** · '일부러 흐린' 자리(금액 미확인)는 따로 남길지 결정 |

**정해 주면 이렇게 진행한다**(2026-09-11 에 정해졌다 — 위 「개발자 결정」 표): 1~19 각 번호에 (a)/(b) 또는 "유지"만 적어 주면 된다. 5·7·9 는 함께 한 번에 하는 것이
자연스럽다(전부 '덜어내기'). 1·4·10·11 은 앱 인상이 크게 바뀌므로 시안을 먼저 만들어 보여 준 뒤 코드를 바꾼다.
