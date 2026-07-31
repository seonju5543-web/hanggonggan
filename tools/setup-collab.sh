#!/usr/bin/env bash
# 협업 충돌 자동 해소 장치 등록 (2026-07-31 신설 — COLLAB.md 참조)
#
# .gitattributes에 "이 파일은 jsonunion 병합기로 합쳐라"고 적어 두었지만,
# git은 보안상 저장소 파일이 지정한 프로그램을 그냥 실행하지 않는다.
# 그 프로그램을 이 저장소에서 써도 좋다고 등록하는 것이 이 스크립트의 일이다.
#
# 언제 실행되나:
#   · Claude 세션 시작 시 자동 (.claude/settings.json의 SessionStart 훅)
#   · 로봇 워크플로가 저장하기 전에 자동 (collect / browser-collect / deploy-sync)
#   · 사람이 손으로 클론했을 때는 한 번 직접: bash tools/setup-collab.sh
#
# 여러 번 실행해도 안전하다(같은 값을 다시 쓸 뿐).

set -euo pipefail
cd "$(dirname "$0")/.."

# 병합기가 실제로 있는지 먼저 확인 — 없는 프로그램을 등록하면 병합이 통째로 실패한다
if [ ! -f tools/merge-json-union.mjs ]; then
  echo "⚠️  tools/merge-json-union.mjs 가 없어 병합기 등록을 건너뜁니다." >&2
  exit 0
fi

# 절대 경로로 등록한다 — 병합기는 git이 부르는 것이라, 어느 폴더에서 실행됐는지에
# 기대면 안 된다(하위 폴더에서 git 명령을 쓰면 상대 경로가 어긋난다).
DRIVER="$(pwd)/tools/merge-json-union.mjs"

git config merge.jsonunion.name "로봇 기록장 합집합 병합 (한대장)"
git config merge.jsonunion.driver "node \"$DRIVER\" %O %A %B %P"

# 매 실행 새로 쓰이는 리포트용 — '내 쪽을 그대로 둔다'.
# (git 문서에 이름은 예약돼 있지만 동작은 등록해야 생긴다. true는 '아무것도 안 하고 성공' =
#  결과 파일(%A)이 내 것 그대로 남는다는 뜻. 실제로 등록 안 하면 그냥 충돌한다 — 실험으로 확인함)
git config merge.ours.driver true

echo "✅ 협업 병합기 등록 완료 — data/notices.json·collector/seen.json 등은 이제 충돌하면 자동으로 합쳐집니다."
