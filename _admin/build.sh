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
# 공고 주소 정규화 (ES 모듈이라 브라우저에서 그대로 import 된다)
cp collector/url-key.mjs "$OUT/vendor/url-key.mjs"

# 등록 규칙 — Node용 파일이라 브라우저에서 읽히도록 앞뒤만 감싼다.
# (내용은 손대지 않는다. 규칙이 바뀌면 다음 빌드에 그대로 따라온다)
{
  printf '/* 원본: verify/entry-rules.cjs — build.sh가 브라우저용으로 감쌌습니다. 직접 고치지 마세요. */\n'
  printf 'var module = { exports: {} };\nvar exports = module.exports;\n'
  cat verify/entry-rules.cjs
  printf '\nwindow.ENTRY_RULES = module.exports;\n'
} > "$OUT/vendor/entry-rules.js"

echo "빌드 완료 → $OUT"
ls -la "$OUT" "$OUT/vendor"
