/* ============================================================
   '재단이 올린 이 첨부가 진짜 공고문인가'를 정하는 단 하나의 자리 (2026-09-13)
   ------------------------------------------------------------
   왜 필요한가
     층2(한국장학재단)가 학생에게 주는 유일한 공고 원문은 우리가 받아 둔 **선발공고문
     사본**이다. 그런데 재단 일부가 그 자리에 **속이 빈 파일**을 올려 둔다 — 열어 보면
     본문이 `※ 선발 공고문 없음` 한 줄이거나 아예 개행 하나뿐이다. 학생이 '공고 원문'을
     눌러 내려받았는데 빈 문서가 열리는 것은, 안내가 아니라 헛걸음이다.

   🔴 판정은 **파일 이름이 아니라 열어서 읽은 글자**다.
      이름(`공고문 없음.hwp`)은 증거일 뿐 근거가 아니다. 지금은 이름이 멀쩡한데 빈 것이
      한 건도 없지만, 언젠가 온다. 반대로 이름만 보고 거르면 '이름은 그런데 내용이 있는'
      파일을 통째로 내리게 된다.

   🔴 '못 읽음'과 '비었음'은 다른 것이다 (이 저장소의 원칙 8-1).
      스캔한 PDF·포스터 JPG 는 글자가 0이지만 학생은 **그림으로 읽는다**. 실측으로
      지금 사본 70개 중 10개가 그 꼴이다(스캔 PDF 5 · 포스터 JPG 5). 글자만 보고
      거르면 진짜 공고문 10건이 같이 사라진다. **못 읽은 것은 숨기지 않는다.**

   ■ 실측 (2026-09-13 · 사본 70개 전수 · 공백 제외 글자 수)
     | | 이름이 '(선발)공고문 없음' | 이름이 멀쩡 |
     |---|---|---|
     | 100자 미만 | 5건 (0·0·5·8·29자) | 0건 |
     | 300~999자  | 0건 | 3건 |
     | 1000자 이상| 0건 | 52건 |
     | 못 읽음    | 0건 | 10건 (스캔 PDF 5 · 포스터 JPG 5) |
     → 증명된 빈 것의 **최대가 29자**, 진짜 공고문의 **최소가 823자**다. 그 사이가 비어
       있어서 문턱 200자를 그 한가운데 둔다. ⚠️ 옮길 때는 이 표를 다시 만들어 놓고 옮긴다.

   🔴 이 한계는 고치지 말 것: `.txt` 를 남기는 것은 OLE hwp 추출기뿐이고(hwp-prvtext.py),
      hwpx·pdf 추출기는 글자가 거의 없으면 **파일을 안 남긴다**. 그래서 hwpx·pdf 로 된
      빈 껍데기는 여기서 자동으로 못 잡는다 — 그건 사람 장부(kosaf-block.json)가 맡는다.
      빈 `.txt` 를 남기게 고치면 다음 실행이 '이미 뽑았다'고 영영 건너뛴다(그 파일 머리말).

   쓰는 곳: collector/kosaf-open.mjs(장부 만들기) · collector/kosaf-check.mjs(관문) ·
            verify/test-collector.mjs(회귀)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

/** 이 글자 수 미만이면 '속이 빈 파일'로 본다 (위 표의 29자와 823자 사이) */
export const MIN_BODY_CHARS = 200;

/** 공백을 뺀 글자 수 — 바이트로 재면 개행 2바이트가 '2자'가 된다 */
export const charsOfText = (t) => String(t || '').replace(/\s+/g, '').length;

/** 첨부 한 건의 판정. `chars` 가 null 이면 **못 읽은 것**이라 비었다고 하지 않는다. */
export function emptyVerdict({ name, chars }) {
  if (chars == null) return { empty: false, why: '열지 못함(이미지·스캔)' };
  if (chars >= MIN_BODY_CHARS) return { empty: false };
  const alsoName = /공고문\s*없음/.test(String(name || '')) ? ` · 파일 이름도 '${name}'` : '';
  return { empty: true, why: `열어 보니 글자가 ${chars}자${alsoName}` };
}

/* ── 디스크 읽기 (Node 전용) ────────────────────────────────────────────────
   본문(.body.txt)과 미리보기(.txt) 중 **긴 쪽**을 쓴다 — 미리보기는 1023자에서
   잘리므로 짧다고 빈 문서가 아니다. 경로는 path.join 으로만 만든다(이름 속 `%`·`#`). */
export function readChars(repoRoot, filePath) {
  let best = null;
  /* `.ocr.txt` — 스캔 공고문을 OCR 이 읽어 둔 것(품질 관문 통과분만 · 2026-09-17). 이게 없으면
     kosaf-fetch 의 OCR 단계가 만든 파일을 아무도 안 열어 스캔본이 계속 '열지 못함'으로 남는다. */
  for (const suffix of ['.body.txt', '.txt', '.ocr.txt']) {
    const p = path.join(repoRoot, filePath + suffix);
    if (!fs.existsSync(p)) continue;
    const n = charsOfText(fs.readFileSync(p, 'utf8'));
    best = best == null ? n : Math.max(best, n);
  }
  return best;                      // 하나도 없으면 null = 못 읽음
}

/** 층2 목록에서 '속이 빈 첨부'만 뽑는다. `chars(filePath)` 는 숫자 또는 null 을 준다. */
export function emptyShells(openItems, chars) {
  const out = [];
  for (const i of openItems || []) {
    for (const f of (i.files || [])) {
      const v = emptyVerdict({ name: f.name, chars: chars(f.path) });
      if (v.empty) out.push({ code: i.code, org: i.org, file: f.name, path: f.path, why: v.why });
    }
  }
  return out;
}
