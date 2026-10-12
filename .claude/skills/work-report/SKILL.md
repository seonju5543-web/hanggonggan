---
name: work-report
description: Use when a task in this repo (hanggonggan/한대장) is finished, and again after the day's last task — the developer requires an internal work report PDF (사내 작업 보고서) each time, with every number shown as a chart. Also use when asked for "작업 보고서", "사내관리문서", "오늘 한 일 PDF", "일일 보고".
---

# 사내 작업 보고서 PDF

2026-10-12 개발자 지시(이선주): 개발자들과 하루 작업을 요약한 **사내관리문서 PDF** 를 만들어 제시한다.
**작업이 끝날 때**(작업 보고)와 **하루의 마지막 작업이 끝난 뒤**(하루 마감 보고) 두 번. 전문적인 꼴을 갖추고 **수치는 모두 시각 자료로**.

## 순서

1. **숫자를 원천에서 센다** — 짐작·기억으로 적지 않는다(CLAUDE.md 원칙 5). 원천의 예:
   git(`git log`·`git diff --numstat` · 날짜는 한국 시각 `TZ=Asia/Seoul`) · GitHub Actions(커넥터 `mcp__github__actions_list`) ·
   노션 백로그(커넥터 · data_source `60ac025f-edbd-4284-bb57-5e077bab1c3d`) · `data/` 파일 · 검사 출력(`verify/*`) · 그 작업의 기록 파일.
2. **명세 JSON 을 세션 임시 폴더에 쓴다** — 꼴은 `tools/work-report/README.md`. 문서 번호 `HDJ-WR-YYYYMMDD-NN`(하루 마감본은 `-D`).
   구성: 표지(상태·관련 노션 행) → 한눈에 보기(숫자 칸) → 요약 → 경과(일정·커밋) → 한 일 → 검사·배포 상태 → 남은 일·결정 요청·기한 → 출처.
   숫자가 나오는 곳은 반드시 그림 블록(`bars`·`stacked`·`columns`·`timeline`·`meters`·`kpis`)으로. 표는 문장만.
   개발자는 코드를 모른다 — 전문 용어 없이 쓰고, 끝에 용어 풀이를 둔다.
3. **만든다** — `REPORT_FONT_DIR=… node tools/work-report/build.mjs <명세> --out <pdf> --png <폴더>`.
4. **그림으로 떠서 눈으로 본다** — 쪽마다 넘침·잘림·빈 쪽·외톨이 그림을 고친다(`newPage`·`grid`·`rowHeight`).
5. **숫자를 다시 대조한다** — 명세의 숫자를 원천과 하나씩 맞춘다(여럿이면 검증 에이전트를 나눠 띄운다). 틀린 것은 고치고, 지난 보고가 틀렸으면 문서 안에 「정정」으로 적는다.
6. **전한다** — `SendUserFile` 로 PDF 를 보낸다. 🔴 PDF·명세를 저장소에 커밋하지 않는다(공개 저장소). 드라이브·노션·메일로 공유하는 것은 개발자가 원할 때만.
7. **하루 마감본**은 그날의 작업 보고를 합친다 — 같은 날 앞선 보고서의 명세를 읽어 숫자를 합산하고, 그날 남은 일·내일 할 일을 덧붙인다.
