#!/bin/bash
# 새 프로세스에서 한 걸음(첫째 인자 = 스크립트)을 처음 부를 때의 시간 — 워커 파일별 10회
S=/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad
R=/home/user/hanggonggan/.claude/worktrees/wf_6db34be4-346-13
script=$1; shift
for w in "$@"; do
  vals=""
  for i in $(seq 1 10); do
    v=$(cd $S && node $script $w $R | tail -1 | python3 -c "import json,sys;x=sys.stdin.read().strip();print(json.loads(x)['wall'] if x.startswith('{') else x)")
    vals="$vals $v"
  done
  echo "$(basename $w): $vals" | python3 -c "import sys;l=sys.stdin.read().split();n=l[0];v=sorted(map(float,l[1:]));print(n,'median',v[len(v)//2],'min',v[0],'max',v[-1])"
done
