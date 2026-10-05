# 포스터 그림에서 글자를 읽는다 — PaddleOCR (무료 · 열쇠·비용 없음) — 2026-10-03 개발자 지시 "무료로 최대한"
#
# 왜 tesseract(ocr-text.py)가 아니라 이것인가 — 디자인 포스터에서 tesseract 는 품질 관문을 거의 못 넘는다
# (2026-09-17 실측 0.41~0.86). 같은 포스터 30장을 PaddleOCR 한국어 모델로 읽어 활동 글 24건 중 11건의
# 자격을 원문 그대로 건졌다(2026-10-03 로컬 실측 · 그전 0건). 인쇄 공고문 스캔은 여전히 ocr-text.py 몫이다.
#
# 어디에 남기나: 그림 이름 + '.ocr.txt' — ocr-text.py 와 같은 꼴이라 읽는 쪽(attachment-text.mjs attachmentText ·
#   isOcrSource '공고문 첨부(OCR)' 표식)이 그대로 쓴다.
# 🔴 품질: 글자 덩어리마다 확신도 0.8 미만은 버린다. 같은 높이라도 가로로 떨어진 덩어리는 합치지 않는다
#   (두 단 포스터의 옆 칸이 한 줄로 섞였다 — 「모집대상 구리시 거주 … 청년 참가비」).
# 🔴 이 글자가 **그 글의 포스터인지**는 여기서 못 본다 — collector/activity-docs.mjs 가 글 제목 낱말로 본다
#   (사이트 옆 홍보물 「제주도 내 공공임대주택 입주 가구」가 다른 글의 자격으로 붙을 뻔했다).
# 🔴 그림은 긴 변 2000px 로 줄여 읽는다 — 원본(4238×4239)을 그대로 넣으면 메모리가 바닥나 조용히 죽었다(첫 실측).
# 🔴 한국어 인식 모델을 **이름으로** 정한다 — 글자 찾기 모델을 따로 고르면 lang='korean' 이 무시되고 중국어 모델이 붙어
#   한글이 통째로 빠졌다(「17일(토) 10시」→「17()10-」 · 첫 실측).
# 예산 안에서 스스로 끝낸다(--budget-sec) · 이미 읽은 그림(.ocr.txt 있음)은 건너뛴다.
#
# PDF 공고문도 읽는다 — 쪽을 그림으로 바꿔(pdftoppm · poppler-utils) 같은 모델로(2026-10-03 · 서울문화포털 글은 자격이 「[공고문] ….pdf」 에만 있다).
# 실행: python3 collector/paddle-ocr.py collector/act-files --budget-sec=150
import os
import sys
import time
import tempfile
import subprocess

IMAGE_EXT = ('.png', '.jpg', '.jpeg', '.webp')
PDF_PAGES = 4   # 공고문 PDF 는 앞 네 쪽만 — 자격은 대개 첫 장에 있고, 뒤는 서식이다
MIN_SCORE = 0.8
MAX_SIDE = 2000


def lines_of(result):
    items = []
    for r in result:
        for txt, sc, box in zip(r['rec_texts'], r['rec_scores'], r['rec_boxes']):
            if sc < MIN_SCORE or not txt.strip():
                continue
            x0, y0, x1, y1 = [float(v) for v in box]
            items.append((y0, y1, x0, x1, txt.strip()))
    items.sort()
    rows = []
    for y0, y1, x0, x1, txt in items:
        cy, h = (y0 + y1) / 2, y1 - y0
        row = next((r for r in rows if abs(r['cy'] - cy) < max(8, 0.5 * h)
                    and min(abs(x0 - r['x1']), abs(r['x0'] - x1)) < 1.5 * h), None)
        if row:
            row['parts'].append((x0, txt))
            row['x0'], row['x1'] = min(row['x0'], x0), max(row['x1'], x1)
        else:
            rows.append({'cy': cy, 'x0': x0, 'x1': x1, 'parts': [(x0, txt)]})
    rows.sort(key=lambda r: (round(r['cy'] / 10), r['x0']))
    return [' '.join(t for _, t in sorted(r['parts'])) for r in rows]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    budget = next((int(a.split('=')[1]) for a in sys.argv[1:] if a.startswith('--budget-sec=')), 150)
    folder = args[0] if args else 'collector/act-files'
    # --prefix=elig- : 장학 공고문 첨부만 (collector/extracted 에는 신청서 양식 form-* 도 섞여 있다 · 2026-10-05 UI-12)
    prefix = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--prefix=')), '')
    if not os.path.isdir(folder):
        print(f'{folder} 없음 — 건너뜁니다')
        return
    todo = sorted(f for f in os.listdir(folder)
                  if f.startswith(prefix) and f.lower().endswith(IMAGE_EXT + ('.pdf',)) and not os.path.exists(os.path.join(folder, f + '.ocr.txt')))
    if not todo:
        print('읽을 그림 없음')
        return
    deadline = time.time() + budget
    os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
    from paddleocr import PaddleOCR
    from PIL import Image
    ocr = PaddleOCR(text_detection_model_name='PP-OCRv5_mobile_det', text_recognition_model_name='korean_PP-OCRv5_mobile_rec',
                    use_doc_orientation_classify=False, use_doc_unwarping=False, use_textline_orientation=False)
    done = 0
    for f in todo:
        if time.time() > deadline:
            print(f'예산 바닥 — {done}/{len(todo)}장 읽음 · 나머지는 다음 실행')
            break
        path = os.path.join(folder, f)
        try:
            pages = [path]
            if f.lower().endswith('.pdf'):
                # PDF 는 쪽 그림으로 바꿔 같은 눈으로 읽는다(poppler pdftoppm) — 글자층을 쓰지 않는다:
                # 글자층은 숫자가 빠진 채 나온 적이 있다(attachment-text.mjs 2026-08-20 결정 · `3년 이상` → `년이상`)
                stem = os.path.join(tempfile.gettempdir(), 'paddle-' + f)
                subprocess.run(['pdftoppm', '-r', '150', '-l', str(PDF_PAGES), '-png', path, stem], check=True, timeout=60)
                pages = sorted(os.path.join(tempfile.gettempdir(), n) for n in os.listdir(tempfile.gettempdir())
                               if n.startswith('paddle-' + f + '-') and n.endswith('.png'))
            lines = []
            for pg in pages:
                im = Image.open(pg).convert('RGB')
                im.thumbnail((MAX_SIDE, MAX_SIDE))
                tmp = os.path.join(tempfile.gettempdir(), 'paddle-x-' + os.path.basename(pg) + '.jpg')
                im.save(tmp, quality=92)
                lines += lines_of(ocr.predict(tmp))
        except Exception as e:  # 그림 하나가 깨져도 나머지는 읽는다
            print(f'✕ {f} — {str(e)[:120]}')
            continue
        with open(path + '.ocr.txt', 'w', encoding='utf-8') as out:
            out.write('\n'.join(lines) + '\n')
        done += 1
        print(f'✓ {f} — {len(lines)}줄')
    print(f'끝 — {done}장')


if __name__ == '__main__':
    main()
