#!/bin/bash
# usage: rv-mut.sh <name> <file> <python-replace-old> <python-replace-new>
cd /tmp/claude-0/-home-user-hanggonggan/409b9928-bac2-5670-b5b4-24e2b322cd7b/scratchpad/rv-servers
name="$1"; file="$2"
python3 - "$file" "$3" "$4" <<'PY'
import sys
f,old,new=sys.argv[1],sys.argv[2],sys.argv[3]
s=open(f,encoding='utf8').read()
c=s.count(old)
if c!=1: print(f"!! match count {c}"); sys.exit(2)
open(f,'w',encoding='utf8').write(s.replace(old,new))
PY
rc=$?
if [ $rc -ne 0 ]; then echo "$name: MUTATION NOT APPLIED"; git checkout -- "$file"; exit; fi
out=$(node verify/health-gates.mjs servers 2>&1); ec=$?
fails=$(printf '%s\n' "$out" | grep -c '✕')
echo "== $name: exit=$ec fails=$fails"
printf '%s\n' "$out" | grep '✕' | head -6
git checkout -- "$file"
