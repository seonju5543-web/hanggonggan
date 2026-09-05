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
  # 노션 백로그에 실제로 **쓴** 것만 적는다 (2026-09-06 개발자 지시).
  # 🔴 읽기(fetch·search)는 세지 않는다 — 읽기만 해도 면제되면 관문이 뜻을 잃는다.
  # ⚠️ MCP 서버 이름은 개발자마다 다른 UUID 라 이름을 박으면 안 된다. notion 이라는
  #    글자로만 가린다(설정의 matcher 도 같은 이유로 정규식이다).
  *notion-update-page|*notion-create-pages)
    printf '%s %s\n' "$(date +%s)" "notion-write" >>"$gitdir/claude-skills-used"
    ;;
  Skill)
    # 🔴 **시각을 함께 적는다.** 이름만 적었더니 세션 앞부분에 한 번 부른 것으로
    #    그 뒤에 난 실패까지 전부 면제됐다(개발자가 "훅이 계속 안 걸린다"고 짚었다).
    [ "$skill" != "-" ] && printf '%s %s\n' "$(date +%s)" "$skill" >>"$gitdir/claude-skills-used"
    ;;
  Bash)
    # 🔴 여기가 2026-08-30에 새어 나간 자리다: verify 드라이버가 빨간불인데
    #    test-collector·audit 은 초록이라 아무도 몰랐다. 출력에서 직접 본다.
    printf '%s' "$input" | python3 -c '
import sys, json, re
# 🔴 **"실패" 라는 낱말만 보면 안 된다** (2026-08-30). 검사 요약이 `실패: 없음` 이라고
#    적는데 그 글자 때문에 통과한 실행이 실패로 잡혀, 관문이 헛으로 걸렸다.
#    ✕ 표시나 **1건 이상**을 말하는 문장만 실패로 본다.
def FAILED(out):
    import re
    if "✕" in out or "❌" in out or "FAIL " in out or "FAIL:" in out:
        return True
    return bool(re.search(r"실패\s*[1-9]\d*\s*건", out))
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
cmd = (d.get("tool_input") or {}).get("command", "") or ""
if not re.search(r"verify/\S+\.(js|mjs|cjs)", cmd):
    raise SystemExit(1)
# 🔴 **검사만 돌린 명령일 때만 본다** (2026-08-30 · 같은 판정기를 세 번째 고치며 세운 규칙).
#    ⚠️ 이 주석에 작은따옴표를 쓰지 말 것 — 이 파이썬은 python3 -c 뒤 홑따옴표 안에 있어서
#       따옴표 하나가 셸 문자열을 끊고, 판정기가 조용히 죽는다(만들면서 실제로 그랬다).
#    판정기는 명령 전체의 출력을 글자로 훑는다. 그래서 검사와 상관없는 ✕ 까지 주웠다:
#      1차 red-green 이 일부러 낸 ✕  ·  2차 요약 줄 「실패: 없음」  ·  3차 git push 거부의 ✕
#    셋 다 같은 뿌리다 — 섞인 출력에서 「검사 것」을 가려낼 방법이 없다.
#    그래서 **섞이지 않은 명령만** 본다. git·루프가 붙은 명령은 아예 판단하지 않는다.
#    (놓치는 대신 헛으로 걸지 않는다. 관문이 헛걸리면 무시하게 되고, 그게 더 나쁘다.)
if re.search(r"\bgit\b|\bfor\b|\bwhile\b|&&\s*git", cmd):
    raise SystemExit(1)
r = d.get("tool_response")
out = json.dumps(r, ensure_ascii=False) if not isinstance(r, str) else r
raise SystemExit(0 if FAILED(out) else 1)
' 2>/dev/null && date +%s >"$gitdir/claude-debug-owed"
    # 🔴 **초록으로 돌아오면 빚을 지운다** (2026-08-30). 이 저장소는 관문을 만들 때마다
    #    **일부러 망가뜨려 빨간불을 확인**한다(red-green). 그 ✕ 까지 빚으로 남기면
    #    관문이 매번 헛으로 걸려 소음이 된다 — 무조건 뜨던 옛 리뷰 안내와 같은 실패다.
    #    빚은 '고쳐지지 않은 실패'에만 뜻이 있다.
    printf '%s' "$input" | python3 -c '
import sys, json, re
# 🔴 **"실패" 라는 낱말만 보면 안 된다** (2026-08-30). 검사 요약이 `실패: 없음` 이라고
#    적는데 그 글자 때문에 통과한 실행이 실패로 잡혀, 관문이 헛으로 걸렸다.
#    ✕ 표시나 **1건 이상**을 말하는 문장만 실패로 본다.
def FAILED(out):
    import re
    if "✕" in out or "❌" in out or "FAIL " in out or "FAIL:" in out:
        return True
    return bool(re.search(r"실패\s*[1-9]\d*\s*건", out))
try:
    d = json.load(sys.stdin)
except Exception:
    raise SystemExit(1)
cmd = (d.get("tool_input") or {}).get("command", "") or ""
if not re.search(r"verify/\S+\.(js|mjs|cjs)", cmd):
    raise SystemExit(1)
# 🔴 **검사만 돌린 명령일 때만 본다** (2026-08-30 · 같은 판정기를 세 번째 고치며 세운 규칙).
#    ⚠️ 여기(빚을 **지우는** 쪽)에는 위와 같은 차단을 걸지 않는다 — 걸었더니
#       루프로 초록을 확인해도 빚이 안 지워져, 관문이 계속 헛으로 걸렸다(코드 리뷰에서 잡음).
#       판정은 **양쪽이 달라야 한다**: 빚을 지울 때는 좁게(오탐 금지), 지울 때는 넉넉하게.
#       일찍 지워서 잃는 것은 잔소리 한 번이고, 안 지워서 잃는 것은 관문 자체다.
r = d.get("tool_response")
out = json.dumps(r, ensure_ascii=False) if not isinstance(r, str) else r
bad = FAILED(out)
raise SystemExit(1 if bad else 0)
' 2>/dev/null && rm -f "$gitdir/claude-debug-owed"
    # 🔴 **코드를 만졌다는 사실은 커밋해도 남는다.** 예전엔 Stop 훅이 '지금 고쳐진 파일'만
    #    봐서, 커밋하고 나면 리뷰 관문이 조용히 사라졌다.
    ( . "$(dirname "$0")/hook-scope.sh" 2>/dev/null
      [ -n "$(hook_scope)" ] && date +%s >"$gitdir/claude-code-touched" ) 2>/dev/null || true
    ;;
esac
exit 0
