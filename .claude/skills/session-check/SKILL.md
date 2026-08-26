---
name: session-check
description: Use at the start of any new work session in this repo (hanggonggan/한대장), before making claims about data state or starting new work — runs the standard health checklist that CLAUDE.md's many separate warnings each ask for individually, so none of them get skipped from memory.
user-invocable: false
---

# 세션 점검

이 저장소는 CLAUDE.md 곳곳에 "세션 시작 시 이것부터 돌려라"는 경고가 흩어져 있다.
한 곳에 모아 매번 빠짐없이 확인한다.

## 순서

1. `node verify/audit-data.js` — 정식 등록·양식 데이터가 현재 엔진 기준을 통과하는지.
   실패 상태면 로봇 결과가 하나도 저장 안 되고 있을 수 있다(감사 실패 → 저장 스킵).
2. `node verify/check-deploy-sync.js` — 지금까지 작업분이 실제 배포된 앱(main)에
   반영됐는지, 밀린 데이터가 있는지.
3. `git show origin/main:PROGRESS.md` — 두 개발자의 완료/개발중/구상중 최신 상태.
4. `node verify/check-collab.js --brief` — 세션 시작 훅이 이미 돌리지만, 결과를
   못 봤다면 다시 확인(상대가 같은 파일을 만지고 있는지 조기 경보).

## 언제 건너뛰어도 되나

단순 질문 답변, 문서만 읽는 작업처럼 데이터·코드를 건드리지 않는 요청이면
이 점검 없이 바로 답해도 된다. 실제로 코드를 고치거나 데이터에 대해
결론("이 공고는 등록됐다", "이 로봇은 정상이다" 등)을 내리기 전에만 돌린다.
