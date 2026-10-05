/* 장학 공고 본문 그림의 OCR 글자가 **그 공고의 것인가** — 아니면 비운다 (2026-10-05 · 노션 UI-12 · 개발자 "paddle ocr 붙여")
   본문 그림(bodyImage)에는 그 공고 포스터 말고도 사이트 배너·다른 장학금 홍보물이 섞여 온다. PaddleOCR 은 디자인 글자도
   잘 읽으므로, 남의 그림 글자가 이 공고의 금액·자격으로 붙을 수 있다(대외활동에서 실제로 그랬다 — activity-docs.mjs ownsImageText).
   규칙은 대외활동과 같은 titleWords 를 쓰되, 장학 제목에 늘 있는 낱말(장학생·장학금·홍보…)은 증거로 치지 않는다 —
   그대로 쓰면 '장학생' 한 낱말로 아무 장학 포스터나 통과한다.
   비운 파일은 지우지 않고 빈 채로 둔다 — 지우면 OCR 이 다음 실행에 또 읽는다(.ocr.txt 가 있으면 건너뛴다).
   실행: node collector/elig-ocr-guard.mjs   (수집 로봇: OCR 다음 · 발췌 앞) */
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.ACTIVITY_DOCS_AS_LIB = process.env.ACTIVITY_DOCS_AS_LIB || '1';
const { titleWords } = await import('./activity-docs.mjs');

const SCHOLAR_GENERIC = /^(장학|장학생|장학금|장학재단|장학회|재단|홍보|교내|교외|(교내|교외)장학|공통|학부|대학|대학교|등록|등록금외지원)$/;
const IMAGE = /\.(png|jpe?g|webp|gif)$/i;

/** 그림 글자에 이 공고 제목의 고유한 낱말이 하나라도 있는가. 고유한 낱말이 없으면 가릴 수 없으니 남긴다 */
export function ownsScholarshipImage(text, title) {
  const words = titleWords(title).filter((w) => !SCHOLAR_GENERIC.test(w));
  if (!words.length) return true;
  const t = String(text || '').replace(/\s/g, '');
  /* 꼬리를 떼고도 본다 — 제목 「포스코비전장학생」 · 포스터 「포스코비전장학은」(진짜 포스터를 비울 뻔했다 · 2026-10-05 실측).
     뗀 줄기가 두 글자 이하면 쓰지 않는다(너무 흔해진다) */
  const stem = (w) => w.replace(/(장학생|장학금|장학회|장학재단|장학|재단법인|재단)$/, '');
  return words.some((w) => t.includes(w) || (stem(w).length >= 3 && t.includes(stem(w))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const HERE = new URL('.', import.meta.url);
  const reg = JSON.parse(fs.readFileSync(new URL('../data/registered.json', HERE), 'utf8'));
  let index = {};
  try { index = JSON.parse(fs.readFileSync(new URL('extracted/elig-docs.json', HERE), 'utf8')); } catch { /* 없음 */ }
  let kept = 0, cleared = 0;
  for (const it of reg.items) {
    for (const f of ((index[it.id] || {}).files || []).filter((x) => IMAGE.test(x))) {
      const p = fileURLToPath(new URL(`extracted/${f}.ocr.txt`, HERE));
      let t = '';
      try { t = fs.readFileSync(p, 'utf8'); } catch { continue; }
      if (!t.trim()) continue;
      if (ownsScholarshipImage(t, `${it.name || ''} ${it.boardTitle || ''}`)) { kept += 1; continue; }
      fs.writeFileSync(p, '');
      cleared += 1;
      console.log(`비움(남의 그림): ${f} — ${String(it.name || '').slice(0, 40)}`);
    }
  }
  console.log(`장학 그림 OCR 주인 확인 — 남김 ${kept} · 비움 ${cleared}`);
}
