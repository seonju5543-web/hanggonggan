#!/usr/bin/env bash
# LibreOffice 에 HWP·HWPX 가져오기 확장(H2Orestart)을 깐다 — 신청서 원본 → PDF 로봇(collector/form-pdf.mjs)이 쓴다 (2026-10-12).
# LibreOffice 는 한글 HWP 5.x·HWPX 를 기본으로 못 연다. 이 확장(ebandal/H2Orestart · LGPL)이 있어야 `soffice --convert-to pdf` 가 HWP 를 읽는다.
# 🔴 실패해도 워크플로를 죽이지 않는다(보강 단계) — 대신 로봇 리포트가 '변환기가 못 읽음(hwp) — 가져오기 확장 필요' 로 센다.
#    조용히 0건이 되지 않게: 깔렸는지는 unopkg list 로 확인해 적는다.
set -uo pipefail
# 🔴 이 확장은 자바로 돈다 — LibreOffice 의 자바 다리(libreoffice-java-common)와 JRE 가 없으면 깔려도 '파일을 못 읽음'만 난다(2026-10-12 샌드박스 실측: javaldx 없음 → 실패 · 깔자 바로 됨).
if [ ! -e /usr/lib/libreoffice/program/javaldx ]; then echo "⚠️ libreoffice-java-common 이 없습니다 — HWP·HWPX 는 못 바꿉니다(apt-get install libreoffice-java-common)"; fi
# 🔴 --shared 는 /usr/lib/libreoffice 에 쓴다 — GitHub 러너(runner 사용자)에선 sudo 없이 "설치 실패 · exit 0" 이 되어 HWP 전부가 조용히 '못 읽음'이 된다(리뷰 2026-10-12).
UNOPKG="unopkg"; if [ "$(id -u)" != "0" ] && command -v sudo >/dev/null 2>&1; then UNOPKG="sudo -n unopkg"; fi
VER="${H2ORESTART_VERSION:-latest}"
if [ "$VER" = "latest" ]; then URL="https://github.com/ebandal/H2Orestart/releases/latest/download/H2Orestart.oxt";
else URL="https://github.com/ebandal/H2Orestart/releases/download/${VER}/H2Orestart.oxt"; fi
TMP="$(mktemp -d)"
if ! curl -sSL --retry 1 -m 60 -o "$TMP/H2Orestart.oxt" "$URL"; then echo "⚠️ H2Orestart 내려받기 실패 ($URL) — HWP·HWPX 는 이번에 못 바꿉니다"; exit 0; fi
if ! $UNOPKG add --shared --suppress-license "$TMP/H2Orestart.oxt" >/dev/null 2>&1; then echo "⚠️ H2Orestart 설치 실패 — HWP·HWPX 는 이번에 못 바꿉니다"; exit 0; fi
if $UNOPKG list --shared 2>/dev/null | grep -qi h2orestart; then echo "✓ H2Orestart 설치됨"; else echo "⚠️ H2Orestart 가 목록에 없음 — HWP·HWPX 는 이번에 못 바꿉니다"; fi
exit 0
