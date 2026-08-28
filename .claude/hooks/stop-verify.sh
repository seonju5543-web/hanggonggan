#!/usr/bin/env bash
# 끝내기 전 관문 (2026-08-29 개발자 지시로 신설)
#
# 🔴 왜 필요한가 — 2026-08-29 하루에만 이런 일이 있었다:
#    "고쳤습니다" → 나중에 재보니 도달률이 떨어져 있었다 / 검사 2건이 깨져 있었다 /
#    측정을 잘못해 "18건이 안 뜬다"고 잘못 보고했다. 전부 **끝내기 전에 안 재봐서** 생겼다.
#    세션 안내문에 "검증하고 끝내라"고 적어 두는 것은 리포트다(실제로 안 지켜졌다).
#    이 훅은 **exit 2 로 끝내기를 실제로 막는다.**
#
# 막는 것: 검사 실패. 막지 않는 것: 리뷰 안 부른 것(그건 알림으로만 — 셸이 알 수 없다).

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
cat >/dev/null 2>&1 || true

changed="$(git status --porcelain 2>/dev/null | awk '{print $NF}')"
[ -z "$changed" ] && exit 0

code="$(echo "$changed" | grep -E '\.(js|mjs|cjs)$' || true)"
data="$(echo "$changed" | grep -E '^data/(registered|forms|tuition)\.json$' || true)"
[ -z "$code$data" ] && exit 0

out=""; fail=0
if [ -n "$code" ]; then
  out="$(node verify/test-collector.mjs 2>&1)" || fail=1
fi
if [ -n "$data" ] && [ "$fail" = "0" ]; then
  out="$(node verify/audit-data.js 2>&1)" || fail=1
fi

if [ "$fail" = "1" ]; then
  {
    echo "🔴 검사가 실패한 채로 끝낼 수 없습니다."
    echo "$out" | grep -E '✕' | head -12
    echo
    echo "   **추측으로 고치지 마세요.** 먼저 디버깅 스킬을 부르세요:"
    echo '       Skill(skill="superpowers:systematic-debugging")'
    echo "   근본 원인을 찾기 전에는 어떤 수정도 하지 않는 것이 그 스킬의 철칙입니다."
  } >&2
  exit 2      # 🔴 exit 2 = 끝내기를 막고 위 내용을 Claude 에게 돌려준다
fi

# 검사는 통과했지만 코드를 고쳤다 — 리뷰를 요구한다(막지는 않는다)
if [ -n "$code" ]; then
  {
    echo "🔎 코드를 고쳤습니다($(echo "$code" | wc -l | tr -d ' ')개 파일). 끝내기 전에 코드 리뷰 스킬을 부르세요:"
    echo '       Skill(skill="superpowers:requesting-code-review")'
    echo "   (이미 이번 턴에 불렀다면 그대로 진행하세요.)"
  } >&2
  exit 2
fi
exit 0
