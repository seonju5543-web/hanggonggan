#!/usr/bin/env bash
# 고친 직후 자동 검증 (2026-08-29 · 같은 날 코드 리뷰 지적으로 재작성)
#
# 🔴 왜 있나 — **관문은 이미 있었는데 아무도 통과하지 않고 있었다.** 옛 훅은 matcher 가
#    `Edit|Write` 뿐인데 이 세션은 "가능하면 Bash 로 고쳐라"로 돌아, sed·python3 로
#    고친 registered.json·match-engine.js 에 훅이 **한 번도 안 울렸다**(2026-08-29 확인).
#    그래서 이 훅은 **도구를 가리지 않고** git 이 본 변경으로 판단한다.
#
# 🔴 그런데 그것만으로는 **매 Bash 호출마다 1.7초**를 물린다(리뷰 지적). 한 번 더러워지면
#    `ls` 한 번에도 검사가 돈다 — 60번이면 2~3분이 허공에 날아간다.
#    → 검사한 내용의 지문을 남겨, **바뀐 게 없으면 건너뛴다.**

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
# git 저장소가 아니면 판단할 근거가 없다 — 막지 않되 **조용히 넘어가지도 않는다**
# (리뷰 지적: 아무 말 없이 통과하는 것이 바로 이 훅이 고치려던 실패 방식이다)
git rev-parse --git-dir >/dev/null 2>&1 || { echo "⚠️ git 저장소가 아니라 자동 검증을 건너뜁니다 ($PWD)" >&2; exit 0; }
source "$(dirname "$0")/hook-scope.sh"
cat >/dev/null 2>&1 || true

# 노션 반영 알림의 표식 — **무엇이든** 고쳤으면 남긴다(커밋해도 남는다).
# Stop 훅이 이걸 보고 "이번 작업을 노션에 적었나"를 묻는다.
# 🔴 **두 조기 종료보다 위에 둔다** (2026-09-06 red-green 으로 잡음). 아래 뒀더니
#    좁은 그물(hook_scope)에 안 걸리는 파일 — tools/·server/·index.html — 을 고칠 때
#    이 줄에 닿기도 전에 exit 0 이 나서 표식이 영영 안 생겼다.
[ -n "$(hook_touched_any)" ] && date +%s > "$(git rev-parse --git-dir)/claude-work-touched" 2>/dev/null || true

scope="$(hook_scope)"
[ -z "$scope" ] && exit 0

# 지문 = (검사 대상 파일들의 내용) — 내용이 그대로면 다시 돌리지 않는다
sig="$(hook_changed_files | grep -E "$HOOK_TEST_RE|$HOOK_AUDIT_RE" \
        | while IFS= read -r f; do [ -f "$f" ] && shasum "$f" 2>/dev/null; done | shasum | cut -d' ' -f1)"
mark="$(git rev-parse --git-dir 2>/dev/null)/hook-last-verified"
[ "$(cat "$mark" 2>/dev/null)" = "$sig" ] && exit 0

fail=0
if [[ "$scope" == *test* ]]; then
  echo "🔍 판정·수집 코드가 바뀌어 규칙 검증을 돌립니다 (verify/test-collector.mjs)"
  node verify/test-collector.mjs || fail=1
fi
if [[ "$scope" == *audit* ]]; then
  echo "🔍 데이터·등록 규칙이 바뀌어 감사를 돌립니다 (verify/audit-data.js)"
  node verify/audit-data.js || fail=1
fi

if [ "$fail" = "1" ]; then
  cat <<'MSG'

🔴 검사가 실패했습니다.
   **추측으로 고치지 마세요.** superpowers 의 디버깅 스킬을 먼저 부르세요:
       Skill(skill="superpowers:systematic-debugging")
   그 스킬의 철칙: 근본 원인을 찾기 전에는 어떤 수정도 하지 않는다.
MSG
else
  echo "$sig" > "$mark" 2>/dev/null || true   # 통과한 상태만 기억한다(실패는 다음에 또 본다)
fi
exit 0
