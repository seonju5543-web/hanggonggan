/* ============================================================
   최종 검토(6번)가 ok 가 아니라고 본 PDF 사본을 앱에서 내린다 (2026-11-21 개발자 지시)
   *"문서 문제도 그냥 너가 잡아서 올바른 버전으로 수정해서 푸쉬하면 안되나 앱에"*

   둘째 AI 는 앱이 보여 주는 사본(신청서 사본 · 공고문에서 뗀 서식 쪽 · 공고문 사본)을 파일째 보고 판정한다(collector/final-review.json 의 pdfs).
   깨졌거나(broken) · 이 공고 문서가 아니거나(wrong) · 읽을 내용이 없는(empty) 사본은 학생에게 보이면 원본보다 나쁘다 — 앱이 받는 색인에서 그 줄을 뺀다.
   학생에게는 올린 원본 파일만 보인다(앱은 색인에 줄이 없으면 사본 줄을 그리지 않는다 · app-live attachPdfRowsHtml).
   🔴 내리는 것으로 끝내면 안 된다 — 변환 로봇이 새벽마다 같은 사본을 다시 만들고 6번이 돈을 내고 다시 내린다. 그래서 **그 로봇의 색인에** 「다시 만들지 말 것」을 남긴다:
        신청서 사본(form)  data/forms-pdf/index.json  rejected["<id>|<첨부 이름>"] = { srcBytes, fonts, verdict, at }   (form-pdf isRejected — 원본·글꼴 표가 바뀌면 풀린다)
        공고문 사본(doc)   data/docs-pdf/index.json   tried["<id>|<첨부 이름>"] = { at, verdict, mk, ai, srcHash, review: true }     (doc-pdf resting — 만드는 법(MAKER)이나 AI 의 답(ai)이 바뀌면 풀린다)
        서식 쪽(pages)     data/form-pages/index.json 그 줄을 「서식 쪽 없음」 줄로 { src, srcBytes, none, at, verdict } (form-pages — 원본이나 AI 의 답이 바뀌면 풀린다)
      세 색인은 앱이 받는 파일이다 — 표시에는 판정과 날짜만 적고 AI 가 쓴 까닭은 옮기지 않는다(까닭은 collector/final-review.json 의 dropped 에 있다 · 관리자 화면이 읽는다).
   🔴 판정은 **그 바이트의 사본**에 대한 것이다 — 색인 줄이 그대로 있고 크기(bytes)가 같을 때만 내린다. 그사이 다시 만든 사본(크기가 다르다)·없는 줄은 건드리지 않는다.
   부르는 곳: 최종 검토(판정한 그 자리에서 — 같은 커밋으로 앱에서 사라진다 · 🔴 색인만 고치고 파일은 안 지운다 deleteFiles:false ·
                       반영 길의 시작에도 앞선 판정 전부를 한 번 더 — 저장이 부딪혀 내린 줄이 버려졌을 때) ·
              변환 로봇 셋의 시작(색인이 옛 판으로 되돌려졌을 때 다시 내린다 · loadPdfVerdicts · 파일도 지운다) ·
              심층 수집의 저장 고리(deep-fetch.yml — 다시 얹은 뒤 이 실행의 색인을 되돌려 놓고 그 위에 · 색인만).
   🔴 최종 검토가 파일을 안 지우는 까닭(2026-11-22) — 세 색인은 병합 때 「내 것」(merge=ours)이라, 최종 검토와 새벽 변환이 같은 때 저장하면 늦게 올린 쪽의 색인 고침은 버려지고
      파일 지우기만 실린다: 줄은 있는데 파일이 없어 학생이 깨진 링크를 누른다. 색인에서 빠진 파일(고아)은 그 변환 로봇이 다음 실행에서 스스로 지운다(공고 폴더 정리).
   🔴 이 파일은 변환 로봇(form-pdf · doc-pdf · form-pages)을 불러오지 않는다 — 그 셋은 불러오는 순간 본편이 돈다(최종 검토가 이 파일을 불러 쓴다).
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const DIR = { form: 'forms-pdf', doc: 'docs-pdf', pages: 'form-pages' };
const NOT_OK = ['broken', 'wrong', 'empty'];
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const rm = (p, opt = {}) => { try { fs.rmSync(p, { force: true, ...opt }); } catch { /* 무시 */ } };

/** collector/final-review.json 의 사본 판정을 한 줄씩 — [{ id, kind, file, name, bytes, verdict, why }] · 파일이 없으면 빈 목록 */
export function loadPdfVerdicts(root) {
  const items = (readJson(path.join(root, 'collector', 'final-review.json')) || {}).items || {};
  return Object.entries(items).flatMap(([id, e]) => (Array.isArray(e && e.pdfs) ? e.pdfs : []).filter(Boolean).map((p) => ({ id, ...p })));
}

/** ok 가 아닌 판정의 사본을 내린다 — verdicts: [{ id, kind: 'form'|'doc'|'pages', file: '<forms-pdf|docs-pdf|form-pages>/<색인의 file>', bytes, verdict, why }]
    돌려주는 것: { dropped: [{ id, kind, file, name, verdict }] } — 실제로 내린 것만. 바뀐 색인만 로봇 형식(JSON.stringify(x, null, 1) + 개행)으로 다시 쓴다 · 두 번 불러도 같다.
    deleteFiles: false 면 색인만 고친다(최종 검토 — 위 머리말) · 기본은 그 사본 파일과 쪽 그림 폴더도 지운다(변환 로봇의 시작).
    🔴 색인을 먼저 쓰고 파일은 그 뒤에 지운다 — 색인 쓰기가 넘어지면(던진다) 파일은 그대로다. 거꾸로 하면 줄은 있는데 파일이 없어 학생이 깨진 링크를 누른다(write 는 관문이 넘어지는 쓰기를 넘겨 본다) */
export function applyPdfVerdicts({ root, verdicts = [], today, deleteFiles = true, write = fs.writeFileSync }) {
  const dropped = [];
  const doomed = [];   // 색인을 쓴 뒤에 지울 사본
  const open = {};   // 갈래 → { file, index, dirty }
  const indexOf = (kind) => (open[kind] ||= { file: path.join(root, 'data', DIR[kind], 'index.json'), index: readJson(path.join(root, 'data', DIR[kind], 'index.json')), dirty: false });
  for (const v of verdicts || []) {
    if (!v || !NOT_OK.includes(v.verdict) || !DIR[v.kind] || !String(v.file || '').startsWith(`${DIR[v.kind]}/`)) continue;
    const box = indexOf(v.kind);
    const rows = box.index && box.index.items && box.index.items[v.id];
    const rel = v.file.slice(DIR[v.kind].length + 1);
    const at = Array.isArray(rows) && /\.pdf$/i.test(rel) && !rel.split('/').includes('..') ? rows.findIndex((r) => r && r.file === rel) : -1;
    if (at < 0 || typeof v.bytes !== 'number' || rows[at].bytes !== v.bytes) continue;   // 줄이 없거나 그사이 다시 만든 사본(크기가 다르다) — 이 판정이 본 사본이 아니다
    const row = rows[at];
    const key = `${v.id}|${row.name}`;
    if (v.kind === 'pages') {
      /* 서식 쪽은 줄을 지우지 않고 「서식 쪽 없음」으로 바꾼다 — 이 로봇은 그 줄이 있는 동안(같은 원본 · 같은 AI 답) 다시 떼지 않는다 */
      rows[at] = { src: row.src, srcBytes: row.srcBytes, none: true, at: today, verdict: v.verdict, ...(row.ai ? { ai: row.ai } : {}) };
    } else {
      rows.splice(at, 1);
      if (!rows.length) delete box.index.items[v.id];
      if (v.kind === 'form') (box.index.rejected ||= {})[key] = { srcBytes: row.srcBytes || 0, fonts: row.fonts, verdict: v.verdict, at: today };
      else {
        /* 만드는 법의 판 번호(doc-pdf MAKER) — 그 줄에 적힌 것 · 없으면(판 번호를 적기 전의 줄) 색인에 적힌 가장 큰 번호 = 지금 판. 이 파일은 doc-pdf 를 불러올 수 없다 */
        const mk = row.mk || Math.max(0, ...[...Object.values(box.index.items).flat(), ...Object.values(box.index.tried || {})].map((x) => (x && x.mk) || 0));
        /* 그 사본을 만든 AI 의 답(ai — 붙은 문서를 자른 자리)과 받은 원본의 바이트 해시(srcHash)도 옮긴다 — 6번이 갈라낸 자리를 고치면(서식이 시작되는 줄) doc-pdf 가 표시를 풀고 새 자리로 다시 만든다 */
        (box.index.tried ||= {})[key] = { at: today, verdict: v.verdict, ...(mk ? { mk } : {}), ...(row.ai ? { ai: row.ai } : {}), ...(row.srcHash ? { srcHash: row.srcHash } : {}), review: true };
      }
    }
    doomed.push(path.join(root, 'data', DIR[v.kind], row.file));
    box.dirty = true;
    dropped.push({ id: v.id, kind: v.kind, file: v.file, name: row.name || '', verdict: v.verdict });
  }
  for (const box of Object.values(open)) if (box.dirty) write(box.file, `${JSON.stringify(box.index, null, 1)}\n`);
  for (const pdf of deleteFiles ? doomed : []) {
    rm(pdf);
    rm(pdf.replace(/\.pdf$/i, '-pages'), { recursive: true });   // 그 사본의 쪽 그림 폴더(form-fields 가 만든 것)
  }
  return { dropped };
}
