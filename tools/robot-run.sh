#!/usr/bin/env bash
# 로봇을 이 컴퓨터에서 돌릴 때 쓰는 겉옷 (2026-08-21 신설)
#
# ■ 왜 필요한가 — 2026-08-21에 실제로 겪은 일
#   링크 사냥꾼을 로컬에서 돌리는 동안 **클라우드의 같은 로봇도 돌고 있었다**(예약 실행).
#   둘 다 `data/registered.json`을 고쳤는데 그 파일은 **일부러 자동 병합에서 빼 뒀다**
#   (거기서는 '삭제'가 뜻을 가진다 — 잘못 등록분 제거. 합집합으로 합치면 지운 항목이
#   되살아난다. COLLAB.md 참조). 그래서 합칠 때 사람이 손으로 풀어야 했다.
#   이번엔 양쪽 다 '찾아낸 주소'뿐이라 손해가 시간뿐이었지만, 한쪽이 **등록분을 지우는**
#   조치였다면 그게 조용히 되살아났을 수 있다.
#
# ■ 하는 일 세 가지 — 로봇도 워크플로도 한 줄 안 건드린다
#   ① 클라우드에서 데이터 로봇이 돌거나 줄 서 있으면 **아예 시작하지 않는다**
#   ② 시작 전에 최신을 받아 둔다 — 겹칠 거리를 줄인다
#   ③ 끝난 뒤, 도는 동안 원격이 움직였으면 **크게 알린다** (합치기 전에 커밋하라고)
#
#   ⚠️ 클라우드 로봇들의 대기줄(concurrency)을 하나로 합치는 방법은 **쓰면 안 된다.**
#      GitHub은 같은 그룹에서 대기 중인 실행을 새 실행이 오면 취소해 버려서,
#      예약 수집이 조용히 사라진다(CLAUDE.md의 deploy-sync·main-guard 교훈과 같은 함정).
#
# ■ 쓰는 법
#   bash tools/robot-run.sh node collector/link-hunter.mjs
#   bash tools/robot-run.sh node collector/deepfetch.mjs --fill
#
#   급하면 건너뛸 수 있다: ROBOT_RUN_FORCE=1 bash tools/robot-run.sh ...
#   (건너뛴다는 것은 '지금 겹쳐도 내가 손으로 푼다'는 뜻이다)

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
# 저장소 안이 아니면 이 겉옷은 아무것도 지켜 주지 못한다 — 지키는 척하지 말고 멈춘다
git rev-parse --git-dir >/dev/null 2>&1 || { echo "⛔ 저장소 안에서 실행하세요 (tools/robot-run.sh)"; exit 1; }
BASE=claude/nice-heisenberg-WESq5     # 예약 실행이 도는 기본 브랜치
FORCE=${ROBOT_RUN_FORCE:-0}

[ $# -ge 1 ] || { echo "쓰는 법: bash tools/robot-run.sh node collector/link-hunter.mjs"; exit 2; }

# 데이터를 고치는 로봇들. 이 중 하나라도 돌고 있으면 로컬 실행을 미룬다.
# (pages 배포·잠금 확인처럼 데이터를 안 건드리는 것은 여기 없다 — 넣으면 늘 막힌다)
DATA_ROBOTS='장학공고 수집 로봇|브라우저형 수집 로봇|링크 사냥꾼|원문 링크 복구 로봇|공고 원문 심층 수집|검색용 요약 만들기|관리자 조정|학과 목록 갱신'

echo "■ ① 클라우드에서 로봇이 도는지 확인"
if command -v gh >/dev/null 2>&1; then
  BUSY=$(gh run list --limit 30 --json status,name \
    -q '.[] | select(.status=="in_progress" or .status=="queued") | .name' 2>/dev/null \
    | grep -E "$DATA_ROBOTS" || true)
  if [ -n "$BUSY" ]; then
    echo "⛔ 지금 클라우드에서 도는 로봇이 있습니다 — 끝난 뒤에 돌리세요:"
    echo "$BUSY" | sed 's/^/     · /'
    [ "$FORCE" = "1" ] || { echo "   (그래도 돌리려면 ROBOT_RUN_FORCE=1)"; exit 1; }
    echo "   ROBOT_RUN_FORCE=1 — 겹침을 알고도 진행합니다."
  else
    echo "   비어 있음 ✅"
  fi
else
  echo "   ⚠️ gh가 없어 확인을 건너뜁니다 (겹칠 수 있습니다)"
fi

# 로봇 결과와 내가 고치던 것이 섞이면 나중에 못 가른다
if [ -n "$(git status --porcelain)" ]; then
  echo "⛔ 저장 안 한 변경이 있습니다 — 먼저 커밋하거나 stash 하세요 (로봇 결과와 섞입니다)."
  [ "$FORCE" = "1" ] || exit 1
fi

echo "■ ② 최신을 받아 둡니다"
git fetch -q origin "$BASE" || echo "   ⚠️ fetch 실패 — 오프라인일 수 있습니다"
BEFORE=$(git rev-parse "origin/$BASE" 2>/dev/null || echo none)
git merge -q --no-edit "origin/$BASE" 2>/dev/null \
  && echo "   기본 브랜치와 같은 자리에서 시작합니다 ✅" \
  || echo "   ⚠️ 합치지 못했습니다 — 손으로 확인하세요"

echo "■ ③ 로봇 실행: $*"
"$@"; RC=$?
echo "■ 로봇 종료 (코드 $RC)"

git fetch -q origin "$BASE" 2>/dev/null || true
AFTER=$(git rev-parse "origin/$BASE" 2>/dev/null || echo none)
echo
if [ "$BEFORE" != "$AFTER" ] && [ "$AFTER" != none ]; then
  echo "🚨 도는 동안 클라우드가 움직였습니다 — 같은 파일을 고쳤을 수 있습니다."
  git log --oneline "$BEFORE..$AFTER" 2>/dev/null | sed 's/^/     · /'
  echo "   순서를 지키세요: ⓐ 지금 결과를 먼저 커밋 → ⓑ git merge origin/$BASE"
  echo "   (반대로 하면 로봇 결과가 병합에 휩쓸립니다)"
else
  echo "✅ 도는 동안 클라우드는 조용했습니다 — 겹친 것 없음"
fi
echo
echo "■ 이번 실행으로 바뀐 파일"
git status --porcelain | sed 's/^/     /'
exit $RC
