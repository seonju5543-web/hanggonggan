# 그림·스캔 첨부에서 글자를 읽는다 (OCR · 무료 tesseract) — 2026-09-17 개발자 지시
#   "OCR 사용에 개발자 도움이 필요하다면 사용하지 말고, 직접 할 수 있으면 사용해줘."
#   → 열쇠·비용·사람 손이 전혀 안 드는 길(우분투 패키지 tesseract-ocr-kor)만 쓴다.
#
# 무엇을 읽나: 글자층이 없어 pdf-text.py 가 .txt 를 못 남긴 PDF(스캔본) + 그림 첨부(png·jpg·webp).
# 어디에 남기나: 원본 이름 + '.ocr.txt'. ⚠️ '.txt' 가 아니다 — 두 가지 이유:
#   ① pdf-text.py 의 '.txt 가 있으면 이미 뽑았다' 판정과 섞이면 안 된다.
#   ② 읽는 쪽(attachment-text.mjs)이 **OCR 인 줄 알고** 읽어야 한다. OCR 글자는 원문이 아니라
#      기계가 읽은 것이라 오독이 섞일 수 있고, 학생 화면에는 '원문 그대로' 로 나가므로(운영 원칙 8-1)
#      아래 품질 관문을 넘은 것만 남긴다.
#
# 🔴 품질 관문 — 실측(2026-09-17 · 저장분 전수)으로 정했다:
#      스캔한 인쇄 공고문(달서 0.93 · 봉은 0.96/0.98)은 읽을 만하고,
#      디자인 포스터 그림(0.41~0.86 · `신정 기간`·`ueneE 이하`)은 못 쓴다.
#    · 문서 전체의 한글 비율(한글 ÷ (한글+영문+낱자)) ≥ ACCEPT_RATIO 이고
#    · 살아남은 줄의 한글이 ACCEPT_HANGUL 자 이상일 때만 남긴다.
#    · 줄마다도 본다 — 표 테두리·장식이 `| 한새 Aja 그` 로 읽히는 줄은 버린다(LINE_RATIO).
#    못 넘으면 **아무것도 남기지 않는다** — 틀린 자격 줄은 못 읽는 것보다 나쁘다.
#    (포스터는 그대로 AI 경로(eligibility-fill '첨부만')의 몫이다.)
#
# 🔴 장부(ocr-ledger.json)에 판정을 적어 두고 같은 파일은 다시 안 읽는다 — OCR 은 쪽당 몇 초라
#    매 실행 전부 다시 읽으면 단계 예산(4분)을 넘긴다. 파일 내용이 바뀌면(서명이 다르면) 다시 읽는다.
#    ⚠️ 장부는 훑는 폴더 안에 둔다(collector/extracted/ · data/kosaf-files/) — 워크플로의
#    `git add <폴더>` 가 그대로 담아, 이슈 #79 유형(로봇이 고친 파일이 저장 목록에 없음)을 피한다.
# 🔴 예산 안에서 스스로 끝낸다(--budget-sec · 문서당 MAX_PAGES 쪽) — 남은 것은 다음 실행이 잇는다.
# 🔴 tesseract 가 없으면 실패로 만들지 않되 **경고를 남긴다** — pdf-text.py 와 같은 규칙
#    (조용히 넘어가면 '매번 0개 + 초록불'이 된다).
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'extracted')

ACCEPT_RATIO = 0.90     # 문서 전체 한글 비율 — 스캔 공고문은 0.93 이상, 포스터는 0.86 이하였다
ACCEPT_HANGUL = 200     # 살아남은 줄의 한글 글자 수 최소
LINE_RATIO = 0.60       # 줄 하나의 한글 비율 — 이보다 낮으면 장식·표선이 읽힌 것
LINE_HANGUL = 2
MAX_PAGES = 10          # PDF 한 문서에서 읽는 쪽 수 상한 (300dpi 한 쪽 ≈ 5~10초)
DPI = 300
IMAGE_EXT = ('.png', '.jpg', '.jpeg', '.webp')
LEDGER = 'ocr-ledger.json'
TODAY = time.strftime('%Y-%m-%d')

HANGUL = re.compile(r'[가-힣]')
LATIN = re.compile(r'[A-Za-z]')
JAMO = re.compile(r'[ㄱ-ㅎㅏ-ㅣ]')


def is_pdf(path):
    try:
        with open(path, 'rb') as f:
            return f.read(4) == b'%PDF'
    except OSError:
        return False


def signature(path):
    h = hashlib.sha1()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return f'{os.path.getsize(path)}:{h.hexdigest()[:12]}'


def ratio_of(text):
    h = len(HANGUL.findall(text))
    tot = h + len(LATIN.findall(text)) + len(JAMO.findall(text))
    return (h / tot if tot else 0.0), h


BULLET_SQUARE = re.compile(r'^(?:ㅁ|\[\s?\])\s+')
BULLET_ROUND = re.compile(r'^(?:[ㅇO0@]|\(\d|\(\))\s+')


def fix_bullet(line):
    """글머리 기호의 오독을 되돌린다 — `□` 는 `ㅁ`·`[]` 로, `○` 는 `O`·`0`·`@`·`(2` 로 읽힌다(실측).
    기호를 살려 두어야 발췌기(section-head)가 절 머리글(`□ 참가자격`)과 항목(`○ 전국 대학(원)생`)을
    가른다 — 안 되돌리면 `(2 전국 대학(원)생 (휴학생 제외)` 가 자격 줄로 학생 화면에 그대로 나간다."""
    if BULLET_SQUARE.match(line):
        return BULLET_SQUARE.sub('□ ', line)
    if BULLET_ROUND.match(line):
        return BULLET_ROUND.sub('○ ', line)
    return line


def judge(raw):
    """OCR 결과 → (남길 글, 판정 정보). 남길 글이 빈 문자열이면 못 넘은 것이다."""
    ratio, hangul_all = ratio_of(raw)
    kept = []
    for line in raw.splitlines():
        s = re.sub(r'[ \t ]+', ' ', line).strip()
        if not s:
            continue
        r, h = ratio_of(s)
        # 표 테두리가 읽힌 줄(`| -활게 | 90 | 4 1 4 |`)은 한글이 두어 자뿐이고 세로줄이 여럿이다.
        # ⚠️ 한글 비율을 글자 전체로 재면 안 된다 — `3. 신청기간 : 2026. 8. 24. ~ 9. 11.` 처럼
        #    숫자가 많은 날짜 줄이 가장 값진 줄인데 그게 먼저 죽는다. 세로줄 개수로만 가른다.
        if s.count('|') >= 2 and h <= 4:
            continue
        if h >= LINE_HANGUL and r >= LINE_RATIO:
            kept.append(fix_bullet(s))
    kept_text = '\n'.join(kept)
    _, hangul_kept = ratio_of(kept_text)
    info = {'ratio': round(ratio, 3), 'hangul': hangul_kept, 'lines': len(kept)}
    if ratio < ACCEPT_RATIO:
        info['why'] = f'한글 비율 {ratio:.2f} < {ACCEPT_RATIO} — 포스터·장식 글자로 본다'
        return '', info
    if hangul_kept < ACCEPT_HANGUL:
        info['why'] = f'살아남은 한글 {hangul_kept}자 < {ACCEPT_HANGUL}'
        return '', info
    return kept_text + '\n', info


def tesseract(image_path, timeout=90):
    res = subprocess.run(['tesseract', image_path, '-', '-l', 'kor+eng', '--psm', '6'],
                         capture_output=True, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(res.stderr.decode('utf-8', 'replace').strip().splitlines()[-1:] or 'tesseract 실패')
    return res.stdout.decode('utf-8', 'replace')


def ocr_pdf(path, deadline):
    with tempfile.TemporaryDirectory() as tmp:
        prefix = os.path.join(tmp, 'pg')
        subprocess.run(['pdftoppm', '-r', str(DPI), '-png', '-f', '1', '-l', str(MAX_PAGES), path, prefix],
                       capture_output=True, timeout=120)
        # ⚠️ 쪽 번호 자릿수는 전체 쪽 수를 따른다(9쪽까지 pg-1, 10쪽 넘으면 pg-01) — 이름을 짐작하지 말고 정렬해서 다 읽는다
        pages = sorted(n for n in os.listdir(tmp) if n.endswith('.png'))
        if not pages:
            raise RuntimeError('pdftoppm 이 쪽을 하나도 못 그렸다')
        parts = []
        for n in pages:
            if time.time() > deadline:
                break
            parts.append(tesseract(os.path.join(tmp, n)))
        return '\n'.join(parts), len(parts)


def targets(roots):
    if not roots:
        return [OUT] if os.path.isdir(OUT) else []
    found = []
    for root in roots:
        full = root if os.path.isabs(root) else os.path.join(REPO, root)
        if os.path.isdir(full):
            found.append(full)
        else:
            print(f'{root} 이 없습니다 — 건너뜁니다.')
    return found


def load_ledger(root):
    try:
        with open(os.path.join(root, LEDGER), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_ledger(root, ledger):
    with open(os.path.join(root, LEDGER), 'w', encoding='utf-8') as f:
        json.dump(ledger, f, ensure_ascii=False, indent=1)
        f.write('\n')


def candidates(root):
    for dirpath, _dirs, names in os.walk(root):
        for name in sorted(names):
            path = os.path.join(dirpath, name)
            low = name.lower()
            if low.endswith(('.txt', '.json')):
                continue
            if low.endswith(IMAGE_EXT):
                yield path, 'image'
            elif is_pdf(path):
                if os.path.exists(path + '.txt'):
                    continue            # 글자층이 있는 PDF 는 pdf-text.py 가 이미 뽑았다
                yield path, 'pdf'


def run(roots, budget_sec):
    deadline = time.time() + budget_sec
    stats = {'ok': 0, 'rejected': 0, 'skipped': 0, 'failed': 0, 'left': 0, 'chars': 0}
    for root in targets(roots):
        ledger = load_ledger(root)
        changed = False
        for path, kind in candidates(root):
            rel = os.path.relpath(path, root)
            out_path = path + '.ocr.txt'
            try:
                sig = signature(path)
            except OSError:
                continue
            entry = ledger.get(rel)
            if entry and entry.get('sig') == sig and (not entry.get('ok') or os.path.exists(out_path)):
                stats['skipped'] += 1
                continue
            if time.time() > deadline:
                stats['left'] += 1
                continue
            try:
                if kind == 'pdf':
                    raw, pages = ocr_pdf(path, deadline)
                else:
                    raw, pages = tesseract(path), 1
            except Exception as e:                                   # noqa: BLE001
                stats['failed'] += 1
                print(f'실패: {rel} — {e}')
                continue
            text, info = judge(raw)
            entry = {'sig': sig, 'ok': bool(text), 'at': TODAY, 'pages': pages, **info}
            ledger[rel] = entry
            changed = True
            if text:
                with open(out_path, 'w', encoding='utf-8') as f:
                    f.write(text)
                stats['ok'] += 1
                stats['chars'] += len(text)
                print(f"ocr ok: {rel}.ocr.txt ({info['hangul']}자 · 비율 {info['ratio']})")
            else:
                if os.path.exists(out_path):
                    os.remove(out_path)  # 내용이 바뀌어 관문을 못 넘게 됐으면 옛 결과를 남기지 않는다
                stats['rejected'] += 1
                print(f"못 씀: {rel} — {info['why']}")
        if changed:
            save_ledger(root, ledger)
    print(f"\nOCR — 새로 {stats['ok']}개({stats['chars']}자) · 관문 못 넘음 {stats['rejected']}개 · "
          f"이미 본 것 {stats['skipped']}개 · 실패 {stats['failed']}개 · 예산 밖에 남은 것 {stats['left']}개")


def self_test():
    """관문이 살아 있는지 — 실제 OCR 출력 두 조각으로 본다 (test-collector 가 부른다)."""
    good = ('재단법인 달서인재육성장학재단 공고 제 2026-3호\n'
            '2026년도 하반기 장학생 선발 공고\n'
            '달서인재육성장학재단에서는 2026년도 하반기 장학생 선발계획을 다음과 같이 공고합니다.\n'
            '1. 선발규모 및 지원금액 : 대학생 90명, 1인당 100만원\n'
            '2. 신청자격 : 공고일 현재 달서구에 1년 이상 주민등록을 두고 있는 대학 재학생\n'
            '3. 신청기간 : 2026. 8. 24.(월) ~ 9. 11.(금) 18:00까지\n'
            '4. 제출서류 : 신청서, 재학증명서, 성적증명서, 주민등록등본, 개인정보 수집 이용 동의서\n'
            '| 한새 Aja 그 | HAS ag 비고 |\n'
            'ㅁ 참가자격\n(2 전국 대학(원)생 (휴학생 제외)\n') * 2
    bad = ('=     2026년     재5지.\n프로그램 소개   지원 자격\n신정 기간   29   ueneE 이하\n'
           '화)~7.13.(월   장학생 혜택\n신정 방법   yaaa xa as\n8% 한국고등교육재단 문의처: 02-6310-7878\n')
    g, gi = judge(good)
    b, bi = judge(bad)
    ok = (bool(g) and not b and ('한새 Aja' not in g) and g.count('신청기간') == 2
          and '□ 참가자격' in g and '○ 전국 대학(원)생 (휴학생 제외)' in g and '(2 ' not in g)
    print(json.dumps({'good': gi, 'bad': bi, 'ok': ok}, ensure_ascii=False))
    return 0 if ok else 1


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--self-test' in sys.argv:
        sys.exit(self_test())
    budget = 150
    for a in sys.argv[1:]:
        if a.startswith('--budget-sec='):
            budget = int(a.split('=', 1)[1])
    if not shutil.which('tesseract'):
        print('::warning::tesseract 가 없어 그림·스캔 첨부를 한 개도 읽지 못했습니다 '
              '— 워크플로의 tesseract-ocr-kor 설치 단계를 확인하세요.')
        return
    langs = subprocess.run(['tesseract', '--list-langs'], capture_output=True).stdout.decode('utf-8', 'replace')
    if 'kor' not in langs:
        print('::warning::tesseract 에 한국어(kor)가 없습니다 — tesseract-ocr-kor 를 설치해야 읽습니다.')
        return
    if not shutil.which('pdftoppm'):
        print('::warning::pdftoppm(poppler-utils) 이 없어 스캔 PDF 는 건너뜁니다 — 그림 첨부만 읽습니다.')
    run(args, budget)


if __name__ == '__main__':
    main()
