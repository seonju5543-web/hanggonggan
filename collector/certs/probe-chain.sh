#!/usr/bin/env bash
# 인증서 사슬 정찰 (2026-10-01) — probe-links.yml 이 run-probe.txt 의 `certHost: <호스트>` 줄마다 돌린다.
# 무엇을 하나: ① 서버가 보내는 사슬을 그대로 적는다 ② 잎사귀가 시스템 뿌리만으로 검증되면 '사슬 문제 아님'
#   ③ 안 되면 잎사귀의 AIA(CA Issuers) 주소에서 중간 인증서를 받아 **그것을 더하면 검증되는지** 본다(openssl verify)
#   ④ 검증되면 그 PEM 을 로그에 적는다 — 사람이 collector/certs/ 에 넣고 README 표에 적는다(이 워크플로는 저장소에 쓰지 않는다).
# 🔴 검증을 끄는 길이 아니다 — 공개된 진짜 중간 인증서를 이미 믿는 뿌리로 잇는 것뿐이다(README 「🔴 인증서 검증을 끄는 것이 아니다」).
set -u
f="${1:-collector/run-probe.txt}"
hosts=$(grep -E '^certHost:' "$f" 2>/dev/null | sed 's/^certHost:[[:space:]]*//' | tr -d '\r' | awk 'NF')
if [ -z "$hosts" ]; then echo "certHost 줄이 없어 할 일이 없습니다"; exit 0; fi
tmp=$(mktemp -d)
for h in $hosts; do
  echo "=================== $h"
  chain=$(echo | timeout 25 openssl s_client -connect "$h:443" -servername "$h" -showcerts 2>/dev/null || true)
  if ! echo "$chain" | grep -q 'BEGIN CERTIFICATE'; then echo "❌ 연결 실패 또는 인증서 없음"; continue; fi
  echo "--- 서버가 보낸 사슬 (s: 주체 · i: 발급자)"
  echo "$chain" | grep -E '^ *[0-9]+ s:|^ *i:'
  n=$(echo "$chain" | grep -c 'BEGIN CERTIFICATE')
  echo "서버가 보낸 인증서 수: $n $( [ "$n" -le 1 ] && echo '→ 잎사귀만 보냄 (중간 인증서 빠뜨림 의심)' )"
  echo "$chain" | awk '/BEGIN CERTIFICATE/{c++} c==1' | sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' > "$tmp/leaf.pem"
  echo "--- 잎사귀"; openssl x509 -in "$tmp/leaf.pem" -noout -subject -issuer -dates 2>&1
  # 서버가 보낸 나머지(중간) 인증서로 먼저 검증해 본다 — 통과하면 사슬 문제가 아니다(다른 원인 · PEM 을 넣어도 안 고쳐진다)
  echo "$chain" | awk '/BEGIN CERTIFICATE/{c++} c>=2' | sed -n '/BEGIN CERTIFICATE/,/END CERTIFICATE/p' > "$tmp/sent.pem"
  if [ -s "$tmp/sent.pem" ] && openssl verify -untrusted "$tmp/sent.pem" "$tmp/leaf.pem" >/dev/null 2>&1; then echo "✅ 서버가 보낸 사슬로 검증됨 — 빠뜨린 사슬이 아니다 (Node 실패는 다른 원인 · 로그의 오류 글자를 볼 것)"; continue; fi
  if openssl verify "$tmp/leaf.pem" >/dev/null 2>&1; then echo "✅ 시스템 뿌리만으로 검증됨 — 사슬 문제가 아니다 (다른 원인을 볼 것)"; continue; fi
  echo "서버가 보낸 사슬로는 검증 실패 → AIA 에서 중간 인증서를 받아 본다"
  aia=$(openssl x509 -in "$tmp/leaf.pem" -noout -text 2>/dev/null | grep -A1 'CA Issuers' | grep -o 'http[^[:space:]]*' | head -1)
  echo "AIA CA Issuers 주소: ${aia:-없음}"
  [ -z "$aia" ] && continue
  if ! curl -sSL --max-time 25 -o "$tmp/int.bin" "$aia"; then echo "❌ 중간 인증서 받기 실패 ($aia)"; continue; fi
  if ! openssl x509 -inform DER -in "$tmp/int.bin" -out "$tmp/int.pem" 2>/dev/null; then
    if ! openssl x509 -inform PEM -in "$tmp/int.bin" -out "$tmp/int.pem" 2>/dev/null; then
      openssl pkcs7 -inform DER -in "$tmp/int.bin" -print_certs -out "$tmp/int.pem" 2>/dev/null || { echo "❌ 받은 파일이 인증서 꼴이 아님"; continue; }
    fi
  fi
  echo "--- 받은 중간 인증서"; openssl x509 -in "$tmp/int.pem" -noout -subject -issuer -dates 2>&1
  if openssl verify -untrusted "$tmp/int.pem" "$tmp/leaf.pem"; then
    echo "✅ 중간 인증서를 더하면 시스템 뿌리로 검증됨 — 아래 PEM 을 collector/certs/ 에 넣고 README 표와 NODE_EXTRA_CA_CERTS 묶음에 적을 것"
    echo "----- BEGIN PEM ($h) -----"; cat "$tmp/int.pem"; echo "----- END PEM ($h) -----"
  else
    echo "❌ 중간 인증서를 더해도 검증 실패 — 사슬 한 칸이 아니라 다른 문제(두 단계 이상 빠짐·만료·이름 불일치)"
  fi
done
rm -rf "$tmp"
