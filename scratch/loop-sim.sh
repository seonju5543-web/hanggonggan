OUT="$1"
: > "$OUT"
GITHUB_OUTPUT="$OUT"
fails=""
for f in no-such-driver.js verify-region-city.js also-missing.js; do
  echo "── $f"
  timeout 300 node "verify/$f" >/dev/null 2>&1 || { echo "❌ $f"; fails="$fails $f"; }
done
echo "failed=${fails# }" >> "$GITHUB_OUTPUT"
if [ -n "$fails" ]; then echo "❌ 실패한 드라이버:$fails"; exit 1; fi
