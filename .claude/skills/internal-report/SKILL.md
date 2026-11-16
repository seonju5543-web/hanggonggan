---
name: internal-report
description: Use when the developer asks for a 사내 보고서 · 검토 보고서 · 결과 보고서 · 기획 보고서 · "보고서 PDF로" · "문서로 정리해서 공유" in this repo (hanggonggan/한대장) — builds it in the team's own report format (tools/report-kit · 표지 로고·결재란 · 보고 개요 · Ⅰ/Ⅱ 장 · 붙임), the format the developer asked to reuse on 2026-11-17.
---

# 한대장 사내 보고서 (report-kit)

2026-11-17 개발자 지시(이선주): 사내 보고서 양식을 조사해 **우리 앱에 맞는 양식**을 만들고, **다음에도 쓴다**.
양식 규칙 · 근거 · 명세 꼴은 `tools/report-kit/README.md` 하나에 있다 — 먼저 읽는다.

## 순서

1. **만들어도 되는지** — CLAUDE.md 「공유문서 만들기 중단(10-30 지시)」이 있다. 개발자가 그 대화에서 보고서 · 문서를 **직접 요청했을 때만** 만든다.
2. **숫자 · 사실을 원천에서 센다** — git · GitHub Actions · 커넥터 · data/ · 검사 출력. 확인 못 한 것은 '미확인'으로 적고 마지막 장에 모은다.
3. **명세 JSON 을 세션 임시 폴더(scratchpad)에 쓴다** — 쪽 구성은 고정: 표지 → 보고 개요 → 장(Ⅰ·Ⅱ…, 장마다 새 쪽) → 붙임(출처 · 용어 · 문서 이력) → 끝.
   - 개조식(~함 · ~임 · 명사형) · 두괄식 · 전문 용어는 붙임 용어 풀이로.
   - 결정을 구하는 문서면 **권장 · 비추천 같은 척도를 넣지 않는다** — 장단점만(2026-11-17 지시).
   - 문서 번호 `HDJ-<종류>-<연도>-<순번>` · 결재란 기본 작성 / 검토 / 승인.
4. **만든다** — `node tools/report-kit/build.mjs <명세.json> --out <보고서.pdf> --png <미리보기 폴더>`
5. **그림으로 떠서 눈으로 본다** — 쪽 넘침 · 잘린 표 · 빈 쪽 · 머리글 로고를 확인하고 한 번 고친다.
6. **전한다** — `SendUserFile` 로 PDF 를 보낸다(파일 이름은 한글 제목). 🔴 PDF · 명세는 저장소에 커밋하지 않는다(공개 저장소).

## 양식을 고칠 때

- 모양은 `tools/report-kit/report.css`, 쪽 구성 · 머리글 · 바닥글은 `build.mjs` 의 `renderHtml` 한 곳.
- 색 · 로고는 앱(`style.css` · `icons/icon.svg`)에서 온다 — 앱 디자인이 바뀌면 같이 맞춘다.
- 양식을 바꾸면 README 의 「쪽 구성」 · 「명세 꼴」도 같이 고친다.
