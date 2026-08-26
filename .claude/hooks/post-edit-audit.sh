#!/usr/bin/env bash
# data/registered.json · data/forms.json 수정 직후 자동 감사 (2026-08-27 신설)
#
# CLAUDE.md 원칙 7(소급 적용)·여러 세션의 사고 기록이 반복해서 지적한 것:
# 이 두 파일을 고치고 감사를 깜빡하면 잘못된 데이터가 다음 세션까지 안 걸러진다.
# 그래서 사람이 기억하는 대신 훅이 매번 돌린다.
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
  */data/registered.json|*/data/forms.json|data/registered.json|data/forms.json)
    echo "🔍 등록 데이터가 바뀌어 자동 감사를 돌립니다 (verify/audit-data.js)"
    node verify/audit-data.js
    ;;
esac

exit 0
