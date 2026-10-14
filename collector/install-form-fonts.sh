#!/usr/bin/env bash
# 신청서 원본 → PDF 변환용 한글 글꼴 (2026-10-14) — collector/form-pdf.mjs 앞에 돌린다. install-h2orestart.sh 와 한 세트.
# ① 한글 글꼴 두 묶음(fonts-nanum · fonts-noto-cjk) ② 한글 문서 글꼴 이름을 그 글꼴로 못 박는 fontconfig 표(collector/fonts/hwp-font-aliases.conf).
# 🔴 `|| true` 로 실패를 삼키지 않는다 — 글꼴이 없으면 변환은 되지만 중국어 글꼴로 표가 깨진다(2026-10-12 실측 14/14). 그건 '됐다'가 아니다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if ! fc-list : family | grep -q -i 'NanumGothic'; then
  sudo -n apt-get install -y -qq fonts-nanum fonts-noto-cjk
fi
DEST="${XDG_CONFIG_HOME:-$HOME/.config}/fontconfig/conf.d"
mkdir -p "$DEST"
cp "$HERE/fonts/hwp-font-aliases.conf" "$DEST/60-hwp-font-aliases.conf"
fc-cache -f >/dev/null 2>&1 || true
# 자가 점검: 한글 문서 글꼴 이름이 한글 글꼴로 풀리는가 (중국어 글꼴이면 실패)
for f in '함초롬돋움' '맑은 고딕' '함초롬바탕' '굴림'; do
  got="$(fc-match "$f" | sed 's/:.*//')"
  echo "글꼴 $f → $got"
  case "$got" in *Nanum*|*Noto*) ;; *) echo "::error::글꼴 $f 이(가) 한글 글꼴로 안 풀립니다 ($got)"; exit 1;; esac
done
