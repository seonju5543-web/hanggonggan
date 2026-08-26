#!/usr/bin/env bash
# collector/*.mjs 수정 직후 자동 규칙 검증 (2026-08-27 신설)
#
# CLAUDE.md: "워크플로가 매 실행 돌린다"고 돼 있는 test-collector.mjs를
# push하기 전에 로컬에서도 돌려, 로봇 규칙 깨짐을 그 자리에서 잡는다.
#
# 이 훅은 절대로 편집 자체를 막지 않는다 — 결과를 보여줄 뿐이다.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

input="$(cat)"
file_path="$(node -e '
  let d="";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { console.log(JSON.parse(d).tool_input?.file_path || ""); }
    catch { console.log(""); }
  });
' <<<"$input")"

case "$file_path" in
  */collector/*.mjs|collector/*.mjs)
    echo "🔍 수집 로봇 코드가 바뀌어 자동 검증을 돌립니다 (verify/test-collector.mjs)"
    node verify/test-collector.mjs
    ;;
esac

exit 0
