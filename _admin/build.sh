#!/usr/bin/env bash
# 관리자 페이지 빌드 — Cloudflare Pages의 '빌드 명령'이 이 파일을 실행한다.
#   빌드 명령      : bash _admin/build.sh
#   빌드 출력 폴더 : _admin/dist
#
# 하는 일은 하나뿐이다: **앱1·로봇이 쓰는 원본 코드를 그대로 가져다 놓는 것.**
# 관리자 화면이 쓰는 등록 규칙·주소 정규화·접수 채널 판정·양식 렌더링은 전부 원본이 따로 있고,
# 여기서 베껴 쓰면 언젠가 서로 달라진다(CLAUDE.md가 경고하는 '로봇과 감사가 어긋나는' 문제).
# 그래서 복사는 빌드 때마다 자동으로 하고, 사람이 손으로 옮기지 않는다.

set -euo pipefail
cd "$(dirname "$0")/.."          # 저장소 최상위에서 실행

OUT="_admin/dist"
rm -rf "$OUT"
mkdir -p "$OUT/vendor"

# 화면 자체 (_headers는 Cloudflare가 응답 헤더로 실어 보내는 보안 설정)
cp _admin/index.html _admin/admin.css _admin/admin.js _admin/_headers "$OUT/"

# 검색엔진 수집 차단 (주소가 검색으로 새지 않게 — 잠금은 Cloudflare Access가 한다)
printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"

# ── 공용 원본 ────────────────────────────────────────────────
# 접수 채널 판정(submitChannelLabel·hasFormAttachment) 등
cp data.js "$OUT/vendor/data.js"
# 양식 문서 생성(renderFormDoc·FORM_DOC_CSS)
cp forms.js "$OUT/vendor/forms.js"
# 질문 설계기 — 양식별 질문 개수(클릭/입력/합계)를 화면과 감사가 같은 규칙으로 센다
cp form-plan.js "$OUT/vendor/form-plan.js"
# 공고 주소 정규화 (ES 모듈이라 브라우저에서 그대로 import 된다)
# 🔴 이 파일이 또 부르는 것까지 함께 옮겨야 한다 — 아래 '빠진 이웃' 검사가 강제한다.
cp collector/url-key.mjs "$OUT/vendor/url-key.mjs"
cp collector/deadline-hint.mjs "$OUT/vendor/deadline-hint.mjs"

# 등록 규칙 — Node용 파일이라 브라우저에서 읽히도록 앞뒤만 감싼다.
# (내용은 손대지 않는다. 규칙이 바뀌면 다음 빌드에 그대로 따라온다)
{
  printf '/* 원본: verify/entry-rules.cjs — build.sh가 브라우저용으로 감쌌습니다. 직접 고치지 마세요. */\n'
  printf 'var module = { exports: {} };\nvar exports = module.exports;\n'
  cat verify/entry-rules.cjs
  printf '\nwindow.ENTRY_RULES = module.exports;\n'
} > "$OUT/vendor/entry-rules.js"

# ── 빠진 이웃 검사 (2026-09-13 실사고) ──────────────────────────
# 🔴 규칙은 verify/verify-admin-vendor.js 하나다 — 여기에 베끼지 말 것.
#    CI(verify-ui.yml)도 같은 파일을 부른다. 두 벌이 되면 갈라진다.
#    빌드를 실패시키는 이유: Cloudflare 는 빌드가 실패하면 **옛 판을 그대로 둔다**.
#    깨진 화면(버튼이 안 눌리는 화면)을 내보내는 것보다 낫다.
node "$(dirname "$0")/../verify/verify-admin-vendor.js" "$OUT" || exit 1

echo "빌드 완료 → $OUT"
ls -la "$OUT" "$OUT/vendor"
