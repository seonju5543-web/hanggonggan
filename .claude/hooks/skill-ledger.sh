#!/usr/bin/env bash
# 스킬 장부 (2026-08-30 개발자 지시로 신설)
#
# 🔴 왜 생겼나 — 훅이 **부르라고 말만 하고 불렀는지는 못 봤다.**
#    그래서 두 가지가 한 세션에서 동시에 새어 나갔다(2026-08-30):
#      ① `requesting-code-review` 안내가 **코드를 고칠 때마다 무조건** 떠서 소음이 됐고,
#         정작 리뷰가 반쪽으로 끝난 날에도 똑같은 문구만 떴다.
#      ② `systematic-debugging` 은 **아예 안 불렸다.** Stop 훅은 test-collector·audit 이
#         빨간불일 때만 그 말을 하는데, 그날 넘어진 것은 브라우저 드라이버(verify-essay-ui)라
#         두 검사에는 잡히지 않았다 → 훅은 끝까지 조용했고 즉흥 수정이 그대로 지나갔다.
#
#    뿌리는 하나다: **훅이 무슨 일이 있었는지 기억하지 못한다.** 기억을 만든다.
#      · 스킬을 부르면 → 장부에 적는다  (그래서 안내가 '안 부른 경우에만' 뜬다 = 소음이 아니다)
#      · verify 드라이버가 빨간불이면 → '디버깅 빚' 표시를 남긴다 (Stop 훅이 이걸 받는다)
#
# 이 훅은 **절대 막지 않는다.** 기록만 한다. 막는 것은 Stop 훅 한 곳이다.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
gitdir="$(git rev-parse --git-dir 2>/dev/null)" || exit 0
input="$(cat 2>/dev/null || true)"
[ -n "$input" ] || exit 0

read -r tool skill <<<"$(printf '%s' "$input" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print(" "); raise SystemExit
t = d.get("tool_name", "") or ""
s = (d.get("tool_input") or {}).get("skill", "") or "-"
print(t, s)
' 2>/dev/null || echo " ")"

case "$tool" in
  Skill)
    # 스킬 이름을 그대로 적는다 (플러그인 접두어 포함)
    [ "$skill" != "-" ] && printf '%s\n' "$skill" >>"$gitdir/claude-skills-used"
    ;;
  Bash)
    # 🔴 여기가 2026-08-30에 새어 나간 자리다: verify 드라이버가 빨간불인데
    #    test-collector·audit 은 초록이라 아무도 몰랐다. 출력에서 직접 본다.
    printf '%s' "$input" | python3 -c '
import sys, json, re
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
cmd = (d.get("tool_input") or {}).get("command", "") or ""
if not re.search(r"verify/\S+\.(js|mjs|cjs)", cmd):
    raise SystemExit(1)
r = d.get("tool_response")
out = json.dumps(r, ensure_ascii=False) if not isinstance(r, str) else r
raise SystemExit(0 if ("✕" in out or "실패" in out or "FAIL" in out) else 1)
' 2>/dev/null && date +%s >"$gitdir/claude-debug-owed"
    ;;
esac
exit 0
