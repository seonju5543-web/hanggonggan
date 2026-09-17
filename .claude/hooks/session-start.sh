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

# 스킬 장부·디버깅 빚을 비운다 — 지난 세션 기록이 남아 있으면 이번 세션을 엉뚱하게 막는다
gitdir="$(git rev-parse --git-dir 2>/dev/null)" \
  && rm -f "$gitdir/claude-skills-used" "$gitdir/claude-debug-owed" "$gitdir/claude-code-touched"

# 🔴 스킬을 언제 부를지 못 박는다 (2026-08-29 개발자 지시)
#    superpowers 안내문은 이미 매 세션 들어오는데도 2026-08-29 하루 종일 한 번도
#    안 불렸다 — "적용되면 써라"는 **판단에 맡기는 말**이라 긴 세션에서 밀린다.
#    그래서 **어느 시점에 무엇을 부르는지**를 못 박아 둔다. 검사 자체는 훅이 강제한다
#    (PostToolUse: 고칠 때마다 · Stop: 끝내기 전 — 실패하면 exit 2 로 못 끝낸다).
cat <<'MSG'

📌 이 저장소에서 반드시 부를 스킬 (판단하지 말고 그대로)
   · 코드를 짜거나 고쳤으면 → 끝내기 전에
        Skill(skill="superpowers:requesting-code-review")
     ⚠️ 이 스킬은 **리뷰어 서브에이전트**를 띄우라고 한다. 에이전트를 못 쓰는 세션이면
        건너뛰지 말고 **직접 diff 를 보되 스킬 항목을 하나씩 짚는다**(요구사항 충족 ·
        경계값·빈 값 · 기존 검사를 무력화하지 않는가). 2026-08-30에 그 절차 없이
        훑다가 '마감일 칸이 빈 재단을 통째로 버리는' 버그를 놓쳤다.
   · 오류·검사 실패·예상 못 한 동작이 나오면 → 고치기 **전에**
        Skill(skill="superpowers:systematic-debugging")
   · "고쳤다/됐다"고 말하기 직전 → Skill(skill="superpowers:verification-before-completion")
   🔴 이제 훅이 **불렀는지 기억한다**(.claude/hooks/skill-ledger.sh). 안 부르고 끝내려 하면
      Stop 훅이 한 번 막는다 — verify 드라이버가 빨간불이었는데 디버깅 스킬을 안 불렀거나,
      판정·화면·로봇 코드를 고쳤는데 리뷰 스킬을 안 불렀을 때. 부르면 저절로 풀린다.

📌 화면이 어떻게 보이는지 말하기 전에 (2026-08-29 — 여기서 틀려서 잘못 보고한 적 있다)
   그 자리에서 짠 스크립트로 재지 말 것. 목록은 5줄 상한, 상세는 전부라 결과가 다르다.
        node verify/what-shows.mjs <공고 id 또는 이름 일부>

MSG

exit 0
