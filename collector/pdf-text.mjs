/* ============================================================
   PDF 글자층 추출기 (비용 0 — 외부 라이브러리·API 없이)

   왜 필요한가: PDF는 두 종류다.
     ① 글자층이 있는 PDF (한글·워드에서 '내보내기'로 만든 것) → 여기서 글자를 그대로 뽑을 수 있다
     ② 스캔 PDF (종이를 찍은 이미지) → 글자가 없어 뽑을 수 없다. 눈으로 봐야 하므로 API 몫.
   ①을 공짜로 처리하면 API 호출(=비용)을 그만큼 아낀다.

   한글은 대부분 CID 폰트로 들어가 바이트가 그대로 글자가 아니다. 폰트에 딸린
   /ToUnicode 표(CMap)를 읽어 바이트 → 유니코드로 되돌린다.

   실행: import { pdfText } from './pdf-text.mjs'  → pdfText(buffer) → 문자열('' 이면 스캔)
   ============================================================ */
import zlib from 'node:zlib';

/* PDF 스트림 압축 해제 (FlateDecode만 — 실무의 대부분) */
function inflate(raw) {
  try { return zlib.inflateSync(raw); } catch { /* 아래로 */ }
  try { return zlib.inflateRawSync(raw); } catch { /* 아래로 */ }
  return null;
}

/* "12 0 obj ... endobj" 를 번호별로 모은다 */
function parseObjects(latin) {
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(latin))) {
    const end = latin.indexOf('endobj', m.index);
    if (end < 0) continue;
    objs.set(Number(m[1]), latin.slice(m.index, end));
  }
  return objs;
}

/* 객체 본문에서 stream ... endstream 의 원본 바이트를 꺼낸다 */
function streamOf(body, buf, latin) {
  const rel = body.indexOf('stream');
  if (rel < 0) return null;
  const abs = latin.indexOf(body.slice(0, 40)); /* 객체 시작 위치 */
  if (abs < 0) return null;
  let s = latin.indexOf('stream', abs) + 6;
  if (latin[s] === '\r') s++;
  if (latin[s] === '\n') s++;
  const e = latin.indexOf('endstream', s);
  if (e < 0) return null;
  return Buffer.from(latin.slice(s, e), 'latin1');
}

/* PDF 문자열 리터럴 (...) 안의 이스케이프 해제 */
function unescapePdf(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== '\\') { out.push(str.charCodeAt(i)); continue; }
    const n = str[++i];
    if (n === undefined) break;
    if (n === 'n') out.push(10);
    else if (n === 'r') out.push(13);
    else if (n === 't') out.push(9);
    else if (n === 'b') out.push(8);
    else if (n === 'f') out.push(12);
    else if (n >= '0' && n <= '7') {
      let oct = n;
      while (oct.length < 3 && str[i + 1] >= '0' && str[i + 1] <= '7') oct += str[++i];
      out.push(parseInt(oct, 8));
    } else out.push(n.charCodeAt(0));
  }
  return Buffer.from(out);
}

/* /ToUnicode CMap 파싱 — bfchar(낱개)와 bfrange(구간) */
function parseCMap(text) {
  const map = new Map();
  const hex = (h) => {
    const s = h.replace(/[^0-9a-fA-F]/g, '');
    let out = '';
    for (let i = 0; i + 3 < s.length + 1; i += 4) {
      const cp = parseInt(s.slice(i, i + 4), 16);
      if (!Number.isNaN(cp)) out += String.fromCharCode(cp);
    }
    return out;
  };

  for (const blk of text.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
    const pairs = blk.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g) || [];
    for (const p of pairs) {
      const mm = p.match(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/);
      map.set(parseInt(mm[1], 16), hex(mm[2]));
    }
  }
  for (const blk of text.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
    let mm;
    while ((mm = re.exec(blk))) {
      const lo = parseInt(mm[1], 16);
      const hi = parseInt(mm[2], 16);
      if (mm[3]) {
        const base = parseInt(mm[3], 16);
        for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCharCode(base + (c - lo)));
      } else if (mm[4]) {
        const items = mm[4].match(/<([0-9a-fA-F]+)>/g) || [];
        items.forEach((it, k) => map.set(lo + k, hex(it)));
      }
    }
  }
  return map;
}

export function pdfText(buf) {
  const latin = buf.toString('latin1');

  /* 스캔 PDF 빠른 판별 — 폰트가 아예 없으면 글자층이 없다 */
  if (!/\/Font/.test(latin)) return '';

  const objs = parseObjects(latin);

  /* 폰트 객체번호 → ToUnicode 맵 */
  const fontMaps = new Map();
  for (const [num, body] of objs) {
    if (!/\/Type\s*\/Font/.test(body)) continue;
    const tu = body.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (!tu) continue;
    const target = objs.get(Number(tu[1]));
    if (!target) continue;
    const raw = streamOf(target, buf, latin);
    const out = raw && inflate(raw);
    if (out) fontMaps.set(num, parseCMap(out.toString('latin1')));
  }

  /* 리소스 이름(/F1) → 폰트 객체번호 */
  const resName = new Map();
  for (const [, body] of objs) {
    const fd = body.match(/\/Font\s*<<([\s\S]*?)>>/);
    if (!fd) continue;
    const re = /\/([A-Za-z0-9#_.-]+)\s+(\d+)\s+\d+\s+R/g;
    let m;
    while ((m = re.exec(fd[1]))) resName.set(m[1], Number(m[2]));
  }

  /* 콘텐츠 스트림에서 텍스트 연산자 읽기 */
  const pieces = [];
  for (const [, body] of objs) {
    const raw = streamOf(body, buf, latin);
    const out = raw && inflate(raw);
    if (!out) continue;
    const content = out.toString('latin1');
    if (!/\b(Tj|TJ)\b/.test(content)) continue;

    let cur = null;
    const tok = /\/([A-Za-z0-9#_.-]+)\s+[\d.]+\s+Tf|\((?:\\.|[^\\()])*\)|<([0-9a-fA-F\s]+)>|\bTJ\b|\bTj\b|\bT\*\b|\bETe?\b/g;
    let m;
    let line = '';
    const emit = (bytes) => {
      const map = cur != null ? fontMaps.get(cur) : null;
      if (map && map.size) {
        /* CID 폰트는 보통 2바이트 단위 */
        for (let i = 0; i + 1 < bytes.length; i += 2) {
          const code = (bytes[i] << 8) | bytes[i + 1];
          line += map.get(code) ?? '';
        }
      } else {
        line += bytes.toString('latin1');
      }
    };
    while ((m = tok.exec(content))) {
      const t = m[0];
      if (t.endsWith('Tf')) { cur = resName.get(m[1]) ?? null; continue; }
      if (t === 'T*') { if (line.trim()) pieces.push(line.trim()); line = ''; continue; }
      if (t === 'Tj' || t === 'TJ') { if (line.trim()) pieces.push(line.trim()); line = ''; continue; }
      if (t[0] === '(') { emit(unescapePdf(t.slice(1, -1))); continue; }
      if (t[0] === '<' && m[2]) {
        const h = m[2].replace(/\s/g, '');
        const bytes = Buffer.from(h.length % 2 ? h + '0' : h, 'hex');
        emit(bytes);
      }
    }
    if (line.trim()) pieces.push(line.trim());
  }

  const text = pieces.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  /* 글자가 거의 안 나오거나 깨졌으면 실패로 본다 (한글·영숫자 비율 확인) */
  const readable = (text.match(/[가-힣A-Za-z0-9]/g) || []).length;
  return readable >= 30 ? text : '';
}
