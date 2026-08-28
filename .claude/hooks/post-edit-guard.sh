#!/usr/bin/env bash
# 코드·데이터를 고친 직후 자동 검증 (2026-08-29 개발자 지시로 신설)
#
# 🔴 왜 새로 만들었나 — **관문은 이미 있었는데 아무도 통과하지 않고 있었다.**
#    기존 훅 둘은 `Edit|Write` 도구에만 걸려 있었는데, 이 저장소의 Claude 세션은
#    "가능하면 Bash 로 파일을 고쳐라"는 설정으로 돌아서 sed·python3·heredoc 으로
#    파일을 고쳤다. 그래서 registered.json 도 match-engine.js 도 고쳤지만
#    **훅이 한 번도 안 울렸다**(2026-08-29 확인). 두 설정이 서로를 무력화했다.
#    → 이 훅은 **도구를 가리지 않는다.** 무엇으로 고쳤든 git 이 본 변경으로 판단한다.
#
# 편집 자체는 절대 막지 않는다 — 결과를 보여 주고, 실패하면 무엇을 부르라고 말한다.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
cat >/dev/null 2>&1 || true      # 훅 입력은 안 쓴다(도구를 가리지 않으므로)

changed="$(git status --porcelain 2>/dev/null | awk '{print $NF}')"
[ -z "$changed" ] && exit 0

run=""
# 판정·화면에 닿는 코드 — 여기가 깨지면 학생 화면이 틀린 말을 한다
echo "$changed" | grep -qE '^(match-engine|parse-amount|section-head|parse-requirements|app|data)\.js$|^collector/.*\.mjs$|^verify/.*\.(js|mjs)$' && run="test"
# 데이터 — 잘못된 값이 앱에 나가는 것을 막는다 (CLAUDE.md 원칙 7)
echo "$changed" | grep -qE '^data/(registered|forms|tuition)\.json$' && run="${run} audit"
[ -z "$run" ] && exit 0

fail=0
if [[ "$run" == *test* ]]; then
  echo "🔍 판정·수집 코드가 바뀌어 규칙 검증을 돌립니다 (verify/test-collector.mjs)"
  node verify/test-collector.mjs || fail=1
fi
if [[ "$run" == *audit* ]]; then
  echo "🔍 데이터가 바뀌어 감사를 돌립니다 (verify/audit-data.js)"
  node verify/audit-data.js || fail=1
fi

if [ "$fail" = "1" ]; then
  cat <<'MSG'

🔴 검사가 실패했습니다.
   **추측으로 고치지 마세요.** superpowers 의 디버깅 스킬을 먼저 부르세요:
       Skill(skill="superpowers:systematic-debugging")
   그 스킬의 철칙: 근본 원인을 찾기 전에는 어떤 수정도 하지 않는다.
MSG
fi
exit 0
