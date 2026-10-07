#!/bin/bash
# verify-ui.yml 의 관문·드라이버를 이 워크트리에서 PORT=8960 · ADMIN_PORT=8961 로 돌린다
cd /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/integ || exit 2
export NODE_PATH=/opt/node-tools/node_modules CHROME_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PORT=8960 ADMIN_PORT=8961
python3 -m http.server 8960 >/dev/null 2>&1 &
SRV=$!
echo "server pid $SRV"
sleep 2
fails=""
for c in "node verify/verify-essay-submit.mjs" "node verify/verify-apply-guard.mjs" "node verify/verify-notify-rules.js" "node verify/verify-push-server.mjs" "node verify/form-snapshot.mjs" "node verify/verify-insta.js" "bash _admin/build.sh" "node verify/ui-tone.mjs"; do
  echo "── $c"; timeout -k 10 300 $c > /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/ui-$(echo $c | tr ' /' '__').log 2>&1 || { echo "❌ $c"; fails="$fails [$c]"; }
done
for f in verify-fit-badge.js verify-explore-sort.js verify-onboard-gaps.js \
         verify-registered.js verify-chat.js verify-apps-manage.js \
         verify-supabase.js verify-essay-ui.js verify-forms-data.js \
         verify-new-forms.js verify-source-links.js verify-push-client.js \
         verify-notify.js verify-sheet-back.js verify-kosaf.js \
         verify-calendar.js verify-resume.js verify-interactions.js \
         verify-admin.js verify-settings.js verify-admin-shape.js \
         verify-elig-ask.js \
         verify-apply-prep.js verify-activities.js verify-news.js \
         verify-region-city.js drive.js; do
  echo "── $f $(date +%T)"
  timeout -k 10 300 node "verify/$f" > /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/ui-$f.log 2>&1 || { rc=$?; echo "❌ $f (rc $rc)"; fails="$fails $f"; }
done
kill $SRV 2>/dev/null; wait $SRV 2>/dev/null
echo "FAILED:${fails:- 없음}"
