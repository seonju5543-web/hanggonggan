#!/usr/bin/env bash
# 끝내기 전 관문 (2026-08-29 · 같은 날 코드 리뷰 지적으로 재작성)
#
# 🔴 첫 판에는 **만족될 수 없는 조건**이 들어 있었다(리뷰가 Critical 로 잡았다):
#    "코드를 고쳤으면 리뷰를 부르라"며 exit 2 를 냈는데, 스킬을 부르는 것은
#    `git status` 를 바꾸지 않는다. 그래서 커밋하기 전까지 **매 턴이 계속 막히고**
#    Claude Code 의 상한(8회)에 걸려서야 풀린다 — 한 메시지에 8턴을 헛되이 쓴다.
#    게다가 빠져나갈 길이 '커밋'뿐이라 **덜 된 것을 커밋하도록 압박**한다.
#    → ① 리뷰 요구는 **막지 않는다**(stderr 알림 + exit 0). 셸은 스킬 호출 여부를
#         알 수 없으므로 애초에 관문으로 삼으면 안 되는 것이었다.
#      ② `stop_hook_active` 를 읽어 **이미 한 번 막았으면 통과**시킨다.
#         (Claude Code 가 입력으로 알려 준다. 안 읽으면 위의 8회 반복이 된다.)
#
# 막는 것은 하나뿐이다: **검사가 실패한 채로 끝내는 것.**

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
# git 저장소가 아니면 판단할 근거가 없다 — 막지 않되 **조용히 넘어가지도 않는다**
# (리뷰 지적: 아무 말 없이 통과하는 것이 바로 이 훅이 고치려던 실패 방식이다)
git rev-parse --git-dir >/dev/null 2>&1 || { echo "⚠️ git 저장소가 아니라 자동 검증을 건너뜁니다 ($PWD)" >&2; exit 0; }
source "$(dirname "$0")/hook-scope.sh"

input="$(cat 2>/dev/null || true)"
# 이미 한 번 막았다면 통과 — 안 그러면 같은 이유로 계속 막는다
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac

scope="$(hook_scope)"
[ -z "$scope" ] && exit 0

out=""; fail=0
[[ "$scope" == *test*  ]] && { out="$(node verify/test-collector.mjs 2>&1)" || fail=1; }
[[ "$scope" == *audit* && "$fail" == "0" ]] && { out="$(node verify/audit-data.js 2>&1)" || fail=1; }

if [ "$fail" = "1" ]; then
  {
    echo "🔴 검사가 실패한 채로 끝낼 수 없습니다."
    # ✕ 줄이 있으면 그것만, 없으면(크래시·node 없음 등) 꼬리를 그대로 — 증거 없이 막지 않는다
    if echo "$out" | grep -q '✕'; then echo "$out" | grep '✕' | head -12
    else echo "$out" | tail -12; fi
    echo
    echo "   **추측으로 고치지 마세요.** 먼저 디버깅 스킬을 부르세요:"
    echo '       Skill(skill="superpowers:systematic-debugging")'
    echo "   근본 원인을 찾기 전에는 어떤 수정도 하지 않는 것이 그 스킬의 철칙입니다."
  } >&2
  exit 2
fi

# 검사는 통과했다. 리뷰는 **요청만** 한다 — 막지 않는다(위 주석 참조).
if [[ "$scope" == *test* ]]; then
  {
    echo "🔎 코드를 고쳤습니다. 아직 안 불렀다면 끝내기 전에:"
    echo '       Skill(skill="superpowers:requesting-code-review")'
  } >&2
fi
exit 0
