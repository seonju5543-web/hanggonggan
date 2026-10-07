#!/bin/bash
# usage: mut.sh <file> <perl-expr> <label>
cd /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/rv-qfeeds
f="$1"; e="$2"; label="$3"
perl -0pi -e "$e" "$f"
if git diff --quiet -- "$f"; then echo "[$label] MUTATION DID NOT APPLY"; exit 1; fi
out=$(node verify/health-gates.mjs qfeeds 2>&1)
echo "[$label] exit=$? "
echo "$out" | grep -E "✕|전부 통과|실패" | head -8
git checkout -- "$f"
