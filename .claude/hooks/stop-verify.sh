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

gitdir="$(git rev-parse --git-dir 2>/dev/null)"
ledger="$gitdir/claude-skills-used"
# 🔴 **그 실패보다 나중에 불렀는가**를 본다. 이름만 보면 세션 앞부분에 한 번 부른 것으로
#    그 뒤의 실패까지 전부 면제된다(2026-08-30 개발자 지적 "훅은 계속 안 걸리는 것 같은데"
#    — 실제로 그랬다. 장부에 이름이 있어 빚이 쌓여도 통과하고 있었다).
used_after() {   # $1=스킬 이름  $2=기준 시각(epoch)
  [ -f "$ledger" ] || return 1
  awk -v n="$1" -v t="${2:-0}" '$0 ~ n && $1+0 >= t+0 { f=1 } END { exit f?0:1 }' "$ledger"
}

# ⓪ 코드를 고쳤는데 노션 백로그를 한 번도 안 건드렸다 (2026-09-06 개발자 지시).
#    🔴 **막지 않는다.** 이 저장소의 작업이 전부 백로그 항목에 대응하지는 않고(오탈자·잡일),
#       무엇보다 **노션 MCP 가 안 붙은 세션은 만족시킬 방법이 없다** — 막으면 그 개발자의
#       세션이 통째로 갇힌다. 만족 불가능한 조건을 관문으로 삼는 것은 2026-08-29에 이미
#       한 번 저지른 실수다(이 파일 머리말).
#    🔴 **막는 관문들보다 위에 둔다** (2026-09-06 red-green 으로 잡음). 아래 뒀더니
#       리뷰 관문이 `exit 2` 로 먼저 끝나 이 안내가 **한 번도 출력되지 않았다.**
#       막지 않는 말은 막는 말보다 앞에 있어야 보인다.
if [ -f "$gitdir/claude-code-touched" ] \
   && ! used_after 'notion-write' "$(cat "$gitdir/claude-code-touched" 2>/dev/null)"; then
  {
    echo "📋 이번 작업을 노션 백로그에 아직 반영하지 않았습니다."
    echo "   해당 항목이 있으면 **상태·상태 메모**를, 새 일이면 **행**을 더하세요:"
    echo "     data_source 60ac025f-edbd-4284-bb57-5e077bab1c3d (「개발 업무 백로그」)"
    echo "   지금 무엇을 하는 중인지는 「작업 현황」의 '지금 하는 일' 칸에 적습니다."
    echo "   (백로그와 무관한 작업이면 그냥 넘어가세요. 이건 알림이지 관문이 아닙니다.)"
  } >&2
fi

# ① 디버깅 빚 — verify 드라이버가 빨간불이었는데 디버깅 스킬을 안 불렀다.
#    🔴 2026-08-30에 정확히 이 자리가 비어 있었다: verify-essay-ui 가 넘어졌는데
#    test-collector·audit 은 초록이라 훅이 끝까지 아무 말도 안 했고, 즉흥 수정이 지나갔다.
#    🔴 **scope 조기 종료보다 위에 둔다** — 빚은 커밋했다고 사라지지 않는다.
#       아래에 뒀다가 "고치고 커밋하면 관문이 조용히 없어지는" 꼴을 만들었다(같은 날 잡음).
if [ -f "$gitdir/claude-debug-owed" ] && ! used_after 'systematic-debugging' "$(cat "$gitdir/claude-debug-owed" 2>/dev/null)"; then
  {
    echo "🔴 이번 세션에서 verify 검사가 한 번 빨간불이었는데 디버깅 스킬을 안 불렀습니다."
    echo "   **추측으로 고치지 마세요.** 근본 원인을 찾기 전에는 어떤 수정도 하지 않는 것이 그 철칙입니다:"
    echo '       Skill(skill="superpowers:systematic-debugging")'
    echo "   (부르면 이 관문은 저절로 풀립니다.)"
  } >&2
  exit 2
fi

# ② 판정·화면·로봇 코드를 만졌는데 리뷰 스킬을 안 불렀다.
#    🔴 **조기 종료보다 위에 둔다** — 아래 두면 커밋하는 순간 관문이 조용히 사라진다.
#       빚 관문에서 이미 겪은 실수를 리뷰 쪽에 그대로 남겨 뒀다(실제로 한 번도 안 걸렸다).
if [ -f "$gitdir/claude-code-touched" ] \
   && ! used_after 'requesting-code-review' "$(cat "$gitdir/claude-code-touched" 2>/dev/null)"; then
  {
    echo "🔴 판정·화면·로봇 코드를 고쳤는데 코드 리뷰 스킬을 부르지 않았습니다:"
    echo '       Skill(skill="superpowers:requesting-code-review")'
    echo "   ⚠️ 에이전트를 못 쓰는 세션이면 **직접 diff 를 보되** 스킬 항목(요구사항 충족·"
    echo "      경계값·빈 값·기존 검사 무력화)을 하나씩 짚으세요."
  } >&2
  exit 2
fi

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

# ── 아래는 **코드를 고쳤을 때만** 본다 (위 ①은 빚이라 scope 와 무관하게 본다).
#    예전에는 "아직 안 불렀다면"이라고 **무조건** 떠서 소음이었다. 이제 훅이 기억하므로
#    **정말 안 불렀을 때만** 뜬다 — 그래서 막아도 되는 말이 됐다.
#    🔴 '한 번만' 막는다: 위쪽 stop_hook_active 가드가 되풀이를 끊고,
#       빠져나갈 길이 **스킬을 부르는 것**이라 만족 가능하다(2026-08-29에 깨진 조건과 다르다).
exit 0
