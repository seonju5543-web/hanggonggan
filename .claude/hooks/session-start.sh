#!/usr/bin/env bash
# Claude 세션이 시작될 때마다 자동 실행 (2026-07-31 신설 — COLLAB.md 참조)
#
# 하는 일 두 가지:
#   ① 협업 병합기 등록 — 로봇이 만드는 기록장(공고 목록·본 공고 장부 등)이 충돌하면
#      자동으로 합쳐지게 한다. 세션마다 저장소를 새로 내려받으므로 매번 등록이 필요하다.
#   ② 겹침 조기 경보 — 상대가 최근에 만진 파일을 나도 고치려는 상황이면 지금 알려준다.
#      (다 만든 뒤에 알면 한쪽 작업을 손으로 되살려야 한다)
#
# 이 훅은 절대로 세션을 막지 않는다 — 무슨 일이 있어도 성공으로 끝난다.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

bash tools/setup-collab.sh 2>&1 || echo "⚠️ 협업 병합기 등록을 건너뛰었습니다 (충돌 시 손으로 합쳐야 합니다)."

# 인터넷이 막혀 있으면 조용히 넘어간다
node verify/check-collab.js --brief 2>/dev/null || true

exit 0
