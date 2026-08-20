# 학교 서버가 안 보내 주는 중간 인증서

## 왜 여기에 있나
계명대(`www.kmu.ac.kr`)는 **잎사귀 인증서 하나만 보내고 중간 인증서를 빠뜨린다.**
브라우저·curl은 시스템 저장소에서 발급자를 찾아 사슬을 스스로 이어 붙이지만
(실측: `Verify return code: 0 (ok)`), **Node는 그렇게 하지 않아** 연결 자체가 실패한다
(`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). 그래서 로봇만 못 읽고 학생은 멀쩡히 보는 상태가 됐다
— 이 저장소가 여러 번 겪은 **'못 읽음 ≠ 학생도 못 봄'**의 또 다른 형태다.

## 🔴 인증서 검증을 끄는 것이 아니다
`rejectUnauthorized: false`나 `NODE_TLS_REJECT_UNAUTHORIZED=0`은 **절대 쓰지 말 것.**
그건 아무 서버나 믿겠다는 뜻이라 중간자 공격에 그대로 열린다.
여기 있는 것은 **공개된 진짜 중간 인증서**이고, 이미 신뢰하는 뿌리 인증서로 이어진다.
서버가 깜빡한 사슬 한 칸을 우리가 들고 있는 것뿐이라 검증은 그대로 살아 있다.

## 쓰는 법
워크플로에서 `NODE_EXTRA_CA_CERTS`로 지정한다(수집 로봇 2종에 배선돼 있다).
손으로 돌릴 때도 같다:

    NODE_EXTRA_CA_CERTS=collector/certs/sectigo-server-auth-dv-r36.pem node collector/deepfetch.mjs --fill

## 지금 들어 있는 것
| 파일 | 무엇 | 만료 |
|---|---|---|
| `sectigo-server-auth-dv-r36.pem` | Sectigo Public Server Authentication CA DV R36 (계명대) | 2036-03-21 |

## 다른 학교가 같은 증상을 보이면
1. `echo \| openssl s_client -connect <호스트>:443 -servername <호스트>` 로 사슬을 본다.
   `0 s:` 한 줄만 나오면 중간 인증서를 안 보내는 것이다.
2. 그 인증서의 `Authority Information Access → CA Issuers` 주소에서 중간 인증서를 받아
   PEM으로 바꿔 이 폴더에 넣고 위 표에 적는다.
3. `NODE_EXTRA_CA_CERTS`는 **파일 하나만** 받는다. 두 개 이상이면 `cat`으로 이어 붙인
   묶음 파일을 만들어 그것을 가리킨다.
