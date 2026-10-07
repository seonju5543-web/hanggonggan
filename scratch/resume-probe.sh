#!/bin/bash
D=$1; S=/tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad
cd "$S/$D" || exit 2
python3 -m http.server 8960 >/dev/null 2>&1 &
SRV=$!
sleep 2
for i in 1 2; do NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PORT=8960 timeout 120 node "$S/resume-probe.js" 2>&1 | tail -1 | sed "s/^/$D /"; done
kill $SRV; wait $SRV 2>/dev/null; exit 0
