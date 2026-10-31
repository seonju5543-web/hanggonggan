"""신청서 쪽 그림(PNG → WebP) + 표의 선(가로·세로) 검출 — collector/form-fields.mjs 가 부른다.
사용: python3 -I collector/form-page-images.py <png 폴더> <webp 폴더> <dpi>
출력: 쪽마다 한 줄 — "<쪽> <가로px> <세로px> {"h":[[y,x0,x1]…],"v":[[x,y0,y1]…]}" (선 좌표는 PDF 포인트). Pillow 가 없으면 "nopil" 한 줄.
"""
import sys, os
try:
    from PIL import Image
except Exception:
    print('nopil'); sys.exit(0)
import re, json
src, dst, dpi = sys.argv[1], sys.argv[2], float(sys.argv[3])
MIN_H, MIN_V = 30, 18          # 선으로 볼 최소 길이(px) — 글자 밑줄·표 테두리는 이보다 길다
def runs(bw, w, h, minlen):
    # bw: 1바이트/픽셀(어두움=0) · 각 줄에서 0 이 minlen 이상 이어진 구간
    out = []
    for y in range(h):
        row = bw[y*w:(y+1)*w]
        for m in re.finditer(rb'\x00{%d,}' % minlen, row):
            out.append((y, m.start(), m.end()))
    return out
def merge(rs):
    # 이웃한 줄(두께)의 같은 구간을 하나로 — (y평균, x0, x1)
    rs.sort(); merged = []
    for y, a, b in rs:
        if merged and y - merged[-1][3] <= 1 and not (b < merged[-1][1] - 2 or a > merged[-1][2] + 2):
            m = merged[-1]; merged[-1] = (m[0], min(m[1], a), max(m[2], b), y, m[4] + 1)
        else: merged.append((y, a, b, y, 1))
    return [((y0 + y1) / 2, a, b) for y0, a, b, y1, k in merged]
def lines_of(im):
    g = im.convert('L').point(lambda v: 0 if v < 150 else 255, 'L')
    w, h = g.size
    hb = g.tobytes(); H = merge(runs(hb, w, h, MIN_H))
    t = g.transpose(Image.TRANSPOSE); V = merge(runs(t.tobytes(), h, w, MIN_V))
    k = 72.0 / dpi
    return ([[round(y*k,1), round(a*k,1), round(b*k,1)] for y, a, b in H],
            [[round(x*k,1), round(a*k,1), round(b*k,1)] for x, a, b in V])
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    n = int(f.split('-')[-1].split('.')[0])
    im = Image.open(os.path.join(src, f)).convert('RGB')
    im.save(os.path.join(dst, f'{n}.webp'), 'WEBP', quality=80, method=4)
    H, V = lines_of(im)
    print(f'{n} {im.size[0]} {im.size[1]} ' + json.dumps({'h': H, 'v': V}, separators=(',', ':')))
