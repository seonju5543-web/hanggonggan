# HWP 첨부 원본에서 미리보기 텍스트(PrvText)를 뽑아 .txt로 저장한다.
# 양식 스키마화(원본 항목·문구 확인)의 원천 자료 — deep-fetch 워크플로가 실행.
# zip 첨부는 내부의 hwp를 먼저 꺼낸 뒤 같은 방식으로 처리한다.
import os
import zipfile

import olefile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'extracted')


def extract_prvtext(path):
    try:
        ole = olefile.OleFileIO(path)
    except Exception as e:
        print(f'skip (not OLE): {os.path.basename(path)} — {e}')
        return
    try:
        if not ole.exists('PrvText'):
            print(f'no PrvText: {os.path.basename(path)}')
            return
        raw = ole.openstream('PrvText').read()
        text = raw.decode('utf-16-le', errors='replace')
        txt_path = path + '.txt'
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'prvtext ok: {os.path.basename(txt_path)} ({len(text)} chars)')
    finally:
        ole.close()


def unzip_hwp(path):
    try:
        with zipfile.ZipFile(path) as z:
            for i, info in enumerate(z.infolist(), 1):
                ext = os.path.splitext(info.filename)[1].lower()
                if ext not in ('.hwp', '.hwpx', '.doc', '.docx', '.pdf'):
                    continue
                # 한글 파일명은 인코딩이 깨질 수 있어 ASCII 이름으로 저장
                base = os.path.splitext(os.path.basename(path))[0]
                dest = os.path.join(OUT, f'{base}-in{i}{ext}')
                with open(dest, 'wb') as f:
                    f.write(z.read(info))
                print(f'unzip ok: {os.path.basename(dest)} <- {info.filename!r}')
    except Exception as e:
        print(f'unzip fail: {os.path.basename(path)} — {e}')


if __name__ == '__main__':
    if not os.path.isdir(OUT):
        raise SystemExit('collector/extracted 없음 — deepfetch.mjs 먼저 실행')
    for name in sorted(os.listdir(OUT)):
        if name.lower().endswith('.zip'):
            unzip_hwp(os.path.join(OUT, name))
    for name in sorted(os.listdir(OUT)):
        if name.lower().endswith('.hwp'):
            extract_prvtext(os.path.join(OUT, name))
