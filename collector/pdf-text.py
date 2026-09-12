# PDF 첨부에서 글자를 뽑아 .txt 로 저장한다 (2026-09-05 개발자 지시).
#
# 왜 만들었나 — 전수조사에서 드러난 것:
#   첨부 293개 중 글자가 뽑혀 있던 것은 **HWP 138개뿐**이었다. PDF 94개(1.9백만 자)는
#   통째로 안 읽히고 있었다. 작성 규정·자격 요건·금액이 그 안에 있어도 아무도 못 봤다.
#
# 같은 자리의 hwp-prvtext.py / hwp-bodytext.py 와 **같은 규칙**을 따른다:
#   · collector/extracted/ 만 훑는다
#   · 원본 이름 + '.txt' 로 저장한다 (essay-house-mine 의 textFilesFor 가 그대로 줍는다)
#   · 못 뽑으면 조용히 넘기되 **왜 못 뽑았는지 한 줄 찍는다**
#
# 🔴 확장자를 믿지 않는다. 실제로 `.bin` 으로 저장된 PDF 가 13개 있었다(첨부 주소에
#    확장자가 없으면 수집기가 .bin 으로 떨군다). 앞 4바이트가 %PDF 인 것을 전부 연다.
# 🔴 글자가 거의 안 나오면 **빈 파일을 만들지 않는다.** 스캔 이미지 PDF 라 OCR 이 필요한
#    것인데, 빈 .txt 를 남기면 다음 실행이 '이미 뽑았다'고 착각하고 영영 건너뛴다.
# 🔴 pdftotext 가 없으면 실패로 만들지 않는다 — 이 스크립트는 보강이지 본업이 아니다.
#    (워크플로가 poppler-utils 를 설치한다. 없으면 그 사실만 알리고 0으로 끝낸다.)
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'extracted')
MIN_CHARS = 40          # 이보다 적으면 스캔 이미지로 본다 (표지만 있는 PDF 도 이쯤이다)


def is_pdf(path):
    try:
        with open(path, 'rb') as f:
            return f.read(4) == b'%PDF'
    except OSError:
        return False


def needs_work(pdf_path, txt_path):
    """아직 안 뽑았거나, 원본이 더 새것이면 다시 뽑는다."""
    if not os.path.exists(txt_path):
        return True
    try:
        return os.path.getmtime(pdf_path) > os.path.getmtime(txt_path)
    except OSError:
        return True


def targets(roots):
    """훑을 파일 목록.

    기본(인자 없음)은 예전 그대로 collector/extracted 한 겹만 본다 — 동작을 바꾸지 않는다.
    인자로 폴더를 주면 **그 아래를 재귀로** 훑는다: 한국장학재단 공고문 사본은
    data/kosaf-files/<재단코드>/ 처럼 재단별 폴더에 들어 있어(2026-09-12) 한 겹만
    보면 한 개도 못 찾는다.
    """
    if not roots:
        if not os.path.isdir(OUT):
            return None
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


def main():
    if not shutil.which('pdftotext'):
        # 🔴 조용히 넘어가면 '매번 0개 + 초록불' 이 된다. Actions 로그에 경고로 남긴다.
        print('::warning::pdftotext 가 없어 PDF 글자를 한 개도 뽑지 못했습니다 '
              '— 워크플로의 poppler-utils 설치 단계를 확인하세요.')
        print('pdftotext 가 없습니다 — 이번 실행은 PDF 를 건너뜁니다.')
        return
    paths = targets(sys.argv[1:])
    if paths is None:
        print(f'{OUT} 이 없습니다.')
        return

    ok = skipped = empty = failed = 0
    chars = 0
    for path in paths:
        name = os.path.basename(path)
        if not os.path.isfile(path) or name.endswith('.txt') or name.endswith('.json'):
            continue
        if not is_pdf(path):
            continue
        txt_path = path + '.txt'
        if not needs_work(path, txt_path):
            skipped += 1
            continue
        try:
            # -layout: 표를 가진 신청서가 많아 칸 배치를 살려야 사람이 읽을 수 있다
            # -q: 경고를 삼킨다 (깨진 글꼴 경고가 로그를 덮는다)
            res = subprocess.run(['pdftotext', '-layout', '-q', path, '-'],
                                 capture_output=True, timeout=120)
        except Exception as e:                                    # noqa: BLE001
            failed += 1
            print(f'실패: {name} — {e}')
            continue
        # 🔴 종료 코드를 본다. 이걸 안 보면 암호화·손상 PDF 의 **실패**를
        #    '스캔 이미지'라고 단정하게 되고(확인 안 한 원인), 잘린 부분 출력이
        #    40자를 넘으면 그 조각을 .txt 로 굳혀 다음 실행이 영영 건너뛴다.
        if res.returncode != 0:
            failed += 1
            why = res.stderr.decode('utf-8', errors='replace').strip().splitlines()
            print(f'못 읽음: {name} — pdftotext 종료코드 {res.returncode}'
                  + (f' · {why[-1][:80]}' if why else ''))
            continue
        text = res.stdout.decode('utf-8', errors='replace').strip()
        if len(text) < MIN_CHARS:
            empty += 1
            print(f'글자 거의 없음: {name} — 글자층이 없는 PDF(스캔본이면 OCR 이 필요하다)')
            continue
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text + '\n')
        ok += 1
        chars += len(text)
        print(f'pdf ok: {name}.txt ({len(text)} chars)')

    print(f'\nPDF 글자 뽑기 — 새로 {ok}개({chars}자) · 이미 있던 것 {skipped}개 '
          f'· 글자 없음 {empty}개 · 실패 {failed}개')


if __name__ == '__main__':
    main()
