# HWP 첨부 원본에서 **본문 전체**(BodyText)를 뽑아 .body.txt로 저장한다.
#
# 왜 따로 만들었나 (2026-08-14):
#   기존 `hwp-prvtext.py`는 `PrvText` 스트림을 읽는데, 그건 한글이 **미리보기용으로
#   앞부분만** 담아 두는 칸이라 **1023자에서 잘린다**(저장분 91개 중 38개가 정확히 1023자,
#   1023자를 넘는 파일은 하나도 없었다 — 실측).
#   그래서 양식 자동 변환기는 **모든 신청서의 앞 1000자만 보고** 있었고, 그 뒤에 있는
#   항목은 아예 존재를 몰랐다. 원본 대조에서 나온 '조용한 누락'의 구조적 원인이다.
#
#   BodyText/Section* 는 진짜 본문이다. 압축(zlib raw deflate)돼 있고 레코드 구조라
#   조금 손이 가지만, 외부 라이브러리 없이 표준 모듈만으로 읽을 수 있다.
#   실측: 변호산장학금 신청서 — 미리보기 1,023자 → 본문 3,000자 이상.
#
# 실행: python3 collector/hwp-bodytext.py   (deepfetch가 원본을 받아 둔 뒤)
import os
import struct
import zlib

import olefile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'extracted')

HWPTAG_PARA_TEXT = 0x10 + 51          # 문단의 글자가 들어 있는 레코드

# 본문에는 표·그림 자리를 가리키는 제어문자가 섞여 있다.
# 그중 일부는 **뒤에 14바이트(문자 7개)를 더 끌고 다닌다** — 그걸 안 건너뛰면
# 쓰레기 글자가 본문에 섞인다.
INLINE = {1, 2, 3, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23}
# 줄바꿈·칸 구분으로 볼 제어문자
BREAKS = {10: '\n', 13: '\n', 24: '-', 25: ' ', 30: ' ', 31: ' ', 9: '\t'}


def records(data):
    """HWP 5.0 레코드 훑기 — 머리 4바이트에 tag(10bit)·level(10bit)·size(12bit)가 들어 있다."""
    i = 0
    while i + 4 <= len(data):
        header = struct.unpack('<I', data[i:i + 4])[0]
        tag = header & 0x3FF
        size = (header >> 20) & 0xFFF
        i += 4
        if size == 0xFFF:                      # 4095를 넘으면 다음 4바이트가 진짜 길이
            if i + 4 > len(data):
                return
            size = struct.unpack('<I', data[i:i + 4])[0]
            i += 4
        yield tag, data[i:i + size]
        i += size


def para_text(payload):
    out = []
    i = 0
    while i + 2 <= len(payload):
        ch = struct.unpack('<H', payload[i:i + 2])[0]
        i += 2
        if ch in INLINE:
            i += 14                            # 제어문자가 끌고 다니는 꼬리
        elif ch in BREAKS:
            out.append(BREAKS[ch])
        elif 0xD800 <= ch <= 0xDFFF:
            # 서러게이트 짝(이모지 등) — 짝을 맞춰 붙여야 UTF-8로 저장된다
            if i + 2 <= len(payload):
                lo = struct.unpack('<H', payload[i:i + 2])[0]
                if 0xDC00 <= lo <= 0xDFFF:
                    i += 2
                    out.append(chr(0x10000 + ((ch - 0xD800) << 10) + (lo - 0xDC00)))
            # 짝이 없는 조각은 버린다 (UTF-8로 못 쓴다)
        elif ch >= 32:
            out.append(chr(ch))
    return ''.join(out)


def extract(path):
    try:
        ole = olefile.OleFileIO(path)
    except Exception as e:
        print(f'skip (not OLE): {os.path.basename(path)} — {e}')
        return
    try:
        head = ole.openstream('FileHeader').read()
        flags = struct.unpack('<I', head[36:40])[0]
        if flags & 2:
            print(f'skip (암호화됨): {os.path.basename(path)}')
            return
        packed = bool(flags & 1)
        chunks = []
        for entry in sorted(ole.listdir()):
            if entry[0] != 'BodyText':
                continue
            raw = ole.openstream('/'.join(entry)).read()
            try:
                data = zlib.decompress(raw, -15) if packed else raw
            except zlib.error as e:
                print(f'skip (풀 수 없음): {os.path.basename(path)} — {e}')
                return
            for tag, payload in records(data):
                if tag == HWPTAG_PARA_TEXT:
                    chunks.append(para_text(payload))
        text = '\n'.join(c for c in chunks if c.strip())
        if not text.strip():
            print(f'no body text: {os.path.basename(path)}')
            return
        with open(path + '.body.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'body ok: {os.path.basename(path)}.body.txt ({len(text)} chars)')
    finally:
        ole.close()


if __name__ == '__main__':
    if not os.path.isdir(OUT):
        raise SystemExit('collector/extracted 없음 — deepfetch.mjs 먼저 실행')
    for name in sorted(os.listdir(OUT)):
        if name.lower().endswith('.hwp'):
            extract(os.path.join(OUT, name))
