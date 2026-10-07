#!/bin/bash
# usage: resume-trial.sh <dir> <n>  — 그 폴더에서 서버를 띄우고 verify-resume 를 n 번
D=$1; N=$2; S=/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad
cd "$S/$D" || exit 2
python3 -m http.server 8960 >/dev/null 2>&1 &
SRV=$!
sleep 2
for i in $(seq 1 $N); do
  NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PORT=8960 timeout 300 node verify/verify-resume.js > "$S/resume-$D-$i.log" 2>&1
  echo "$D run $i exit $? :: $(tail -1 "$S/resume-$D-$i.log")"
done
kill $SRV; wait $SRV 2>/dev/null; exit 0
