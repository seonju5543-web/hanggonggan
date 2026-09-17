---
name: probe-run
description: Use when a school board URL, notice body, or link's real status is uncertain in this repo (hanggonggan/한대장) — instead of guessing from curl output or memory, run a live reconnaissance check with a headless browser via GitHub Actions. Triggers on doubts like "이 링크가 진짜 열리나", "본문을 왜 못 읽지", "이 게시판 구조가 뭐지".
---

# 정찰 돌리기 (probe-links.yml)

CLAUDE.md에 "짐작하지 말고 정찰을 돌릴 것"이 여러 번(자격 못 읽음·링크 사냥꾼 실패 등)
반복해서 나온다. curl은 로그인 벽·JS 렌더링·팝업을 못 잡아내 "학교가 막았다"를
잘못 결론 낸 사고가 여러 차례 있었다. 의심스러우면 짐작 대신 이걸 돌린다.

## 절차

1. `collector/run-probe.txt`를 연다.
2. 확인할 내용에 맞는 줄을 추가한다:
   - `checkUrl: <주소>` — 그 주소를 로그인 없는 새 탭에서 열어 상태·제목·
     로그인 벽 여부·화면 글자를 그대로 보고받는다.
   - `findBoard: <학교명>` — 학교 홈에서 메뉴를 따라 들어가 진짜 게시판과
     행별 주소를 찾아낸다.
3. 기본 브랜치에 커밋 + push (push-to-run — `.github/workflows/probe-links.yml`이
   자동 실행된다).
4. `gh run list --workflow=probe-links.yml -L 1` / `gh run watch <run-id>`로
   실행을 지켜보거나, 완료 후 리포트 결과를 읽어 온다.

## 주의

- 확인용 브라우저는 주소마다 새로 만들지 않고 하나만 재사용한다(학교 서버가
  짧은 시간에 여러 연결을 만들면 끊는 경우가 있다) — 정찰 로봇이 이미 그렇게 돼 있다.
- 결과가 나오기 전에 원인을 단정하지 않는다. "AI가 못 읽는다" / "학교가 막았다" /
  "본문이 없다" 같은 결론은 정찰 결과로 확인한 뒤에만 말한다.
