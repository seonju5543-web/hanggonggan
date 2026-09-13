# HWP 첨부 원본에서 미리보기 텍스트(PrvText)를 뽑아 .txt로 저장한다.
# 양식 스키마화(원본 항목·문구 확인)의 원천 자료 — deep-fetch 워크플로가 실행.
# zip 첨부는 내부의 hwp를 먼저 꺼낸 뒤 같은 방식으로 처리한다.
import os
import re
import sys
import zipfile

import olefile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
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
                # 원본이 있던 자리에 푼다 — 재단별 폴더를 쓰는 사본(data/kosaf-files/<코드>/)에서
                # OUT 에 고정하면 재단이 다른 파일이 한곳에 섞인다 (2026-09-12)
                dest = os.path.join(os.path.dirname(path), f'{base}-in{i}{ext}')
                with open(dest, 'wb') as f:
                    f.write(z.read(info))
                print(f'unzip ok: {os.path.basename(dest)} <- {info.filename!r}')
    except Exception as e:
        print(f'unzip fail: {os.path.basename(path)} — {e}')


def extract_hwpx(path):
    """hwpx(= zip 안의 XML)에서 글자를 뽑는다.

    🔴 왜 필요한가 — 관공서 공고문은 이제 상당수가 hwpx 다. 예전 코드는 `.hwp`(OLE)와
       `.zip` 만 알아서 hwpx 를 통째로 건너뛰었다. 건너뛴 것은 **조용히** 없는 것이 된다.
    ⚠️ 글자가 거의 없으면 빈 .txt 를 남기지 않는다 — 남기면 다음 실행이 '이미 뽑았다'고
       착각하고 영영 건너뛴다(pdf-text.py 와 같은 규칙).
    """
    try:
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if re.search(r'Contents/section\d+\.xml$', n)]
            if not names:
                print(f'no section xml: {os.path.basename(path)}')
                return
            parts = []
            for n in sorted(names):
                xml = z.read(n).decode('utf-8', errors='replace')
                # 문단·줄 경계를 줄바꿈으로 남긴다 — 통짜 한 줄이면 사람도 AI도 못 읽는다
                xml = re.sub(r'</(?:hp:p|hp:linesegarray|p)>', '\n', xml)
                parts.append(re.sub(r'<[^>]+>', '', xml))
    except Exception as e:                                        # noqa: BLE001
        print(f'hwpx fail: {os.path.basename(path)} — {e}')
        return
    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(parts)).strip()
    if len(text) < 40:
        print(f'글자 거의 없음: {os.path.basename(path)} — 빈 .txt 를 남기지 않습니다')
        return
    with open(path + '.txt', 'w', encoding='utf-8') as f:
        f.write(text + '\n')
    print(f'hwpx ok: {os.path.basename(path)}.txt ({len(text)} chars)')


def targets(roots):
    """훑을 파일 목록.

    기본(인자 없음)은 예전 그대로 collector/extracted 한 겹만 본다 — 동작을 바꾸지 않는다.
    인자로 폴더를 주면 **그 아래를 재귀로** 훑는다(사본은 재단별 폴더에 들어 있다).
    """
    if not roots:
        if not os.path.isdir(OUT):
            raise SystemExit('collector/extracted 없음 — deepfetch.mjs 먼저 실행')
        return [os.path.join(OUT, n) for n in sorted(os.listdir(OUT))]
    found = []
    for root in roots:
        full = root if os.path.isabs(root) else os.path.join(REPO, root)
        if not os.path.isdir(full):
            print(f'{root} 이 없습니다 — 건너뜁니다.')
            continue
        for dirpath, _dirs, names in os.walk(full):
            found += [os.path.join(dirpath, n) for n in sorted(names)]
    return found


if __name__ == '__main__':
    paths = targets(sys.argv[1:])
    for path in paths:
        low = path.lower()
        if low.endswith('.zip'):
            unzip_hwp(path)
        elif low.endswith('.hwpx'):
            extract_hwpx(path)
    # 압축을 푼 뒤 다시 훑는다 — 방금 나온 .hwp·.hwpx 도 읽어야 한다.
    # ⚠️ 여기서 .hwpx 를 빠뜨리면 zip 안에 들어 있던 공고문이 **조용히** 안 읽힌다
    #    (2026-09-12 코드 리뷰). zip 에서 나온 .pdf 는 pdf-text.py 가 읽으므로,
    #    워크플로는 **이 스크립트를 먼저** 돌린다.
    for path in targets(sys.argv[1:]):
        low = path.lower()
        if low.endswith('.hwp'):
            extract_prvtext(path)
        elif low.endswith('.hwpx') and not os.path.exists(path + '.txt'):
            extract_hwpx(path)
