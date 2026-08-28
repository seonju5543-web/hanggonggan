#!/usr/bin/env bash
# 두 훅이 **같은 기준**으로 "무엇이 바뀌었나"를 본다 (2026-08-29)
#
# 🔴 훅마다 따로 적으면 갈라진다 — 실제로 그랬다. 첫 판에서 Stop 은 `\.(js|mjs|cjs)$`
#    (앵커 없음), PostToolUse 는 앵커 있는 화이트리스트를 써서, 112개 중 **29개가**
#    "Stop 은 막는데 PostToolUse 는 조용한" 상태였다. `server/essay/worker.js` 를
#    고치면 수집기 검사가 돌고 턴이 막혔고, `entry-rules.cjs`·`notify-rules.js` 는
#    아무 검사도 안 돌았다. 이 저장소가 반복해 배운 것: **베끼면 갈라진다.**

# 바뀐 파일 목록 — 이름에 공백·한글·따옴표가 있어도 안전하고, 새 폴더도 펼친다.
# (예전 `git status --porcelain | awk '{print $NF}'` 는 이름에 공백이 있으면 잘리고,
#  새로 만든 폴더는 `verify/` 한 줄로 접혀 그 안의 파일을 통째로 놓쳤다.)
hook_changed_files() {
  git status --porcelain=v1 -z --no-renames -uall 2>/dev/null | tr '\0' '\n' | cut -c4- | grep -v '^$'
}

# 판정·화면·로봇 코드 — 깨지면 학생 화면이 틀린 말을 한다
HOOK_TEST_RE='^(match-engine|parse-amount|section-head|parse-requirements|app|data|notify-rules|essay-quality|form-plan|forms|chat|essay|sw)\.js$|^collector/[^/]*\.(mjs|cjs)$|^verify/[^/]*\.(js|mjs|cjs)$'
# 데이터와 **데이터 규칙** — audit-data 가 보는 것들 (entry-rules 는 audit 만이 검사한다)
HOOK_AUDIT_RE='^data/(registered|forms|tuition)\.json$|^verify/entry-rules\.cjs$|^collector/(url-key|canon-url|notice-source)\.(mjs|cjs)$'

# 돌려야 할 검사를 "test audit" 꼴로 찍는다 (없으면 빈 줄)
hook_scope() {
  local files; files="$(hook_changed_files)"
  local out=""
  [ -n "$files" ] || return 0
  echo "$files" | grep -qE "$HOOK_TEST_RE"  && out="test"
  echo "$files" | grep -qE "$HOOK_AUDIT_RE" && out="$out audit"
  echo "$out"
}
