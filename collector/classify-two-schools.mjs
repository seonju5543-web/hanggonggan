/* ============================================================
   조사 결과 재분류 — 본문 + **첨부 원본 글자**로 신청 채널을 정한다 (2026-09-02)

   왜 따로 있나: 경희대는 공고 본문에 신청 방법을 적지 않는다. 본문은
   "상세 내용은 첨부파일 확인 바랍니다."로 끝나고 내용은 전부 첨부 안에 있다(실측).
   그래서 본문만 보면 그 학교는 통째로 '미확인'이 된다 — 그건 "포털 신청이 없다"가
   아니라 "본문만으로는 모른다"는 뜻이고, 둘을 섞어 말하면 안 된다.

   🔴 판정 규칙은 여기 없다 — apply-channel.mjs 하나뿐이다. 크롤러와 같은 파일을 쓴다.
   ⚠️ PDF 는 글자를 안 쓴다(attachment-text.mjs 의 결정). 숫자가 빠진 채 뽑혀
      원문보다 나쁜 안내가 된 적이 있다. HWP·HWPX·DOCX 만 읽는다.

   실행: node collector/classify-two-schools.mjs
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { classifyChannels, METHOD_LINE, NOT_EVIDENCE } from './apply-channel.mjs';
import { attachmentText } from './attachment-text.mjs';

const OUT_DIR = path.join(process.cwd(), 'collector', 'extracted', 'two-school');
const scanPath = path.join(OUT_DIR, 'scan.json');
const state = JSON.parse(fs.readFileSync(scanPath, 'utf8'));

const NAMES = { khu: '경희대학교', hufs: '한국외국어대학교' };

let attRead = 0;
let attMiss = 0;

for (const key of Object.keys(state.schools)) {
  for (const it of state.schools[key].items) {
    /* 첨부에서 뽑힌 글자를 본문 뒤에 잇는다 — 어느 쪽에서 나온 근거인지는 따로 적는다 */
    let attText = '';
    for (const a of it.attachFiles || []) {
      if (!a.file) continue;
      const t = attachmentText(path.join(process.cwd(), a.file));
      if (t && t.trim()) { attText += `\n${t}`; attRead += 1; } else { attMiss += 1; }
    }
    it.attachTextLen = attText.replace(/\s+/g, '').length;

    const bodyLines = String(it.body || '').split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const attLines = attText.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const lines = bodyLines.concat(attLines);
    const methodLines = lines.filter((l) => METHOD_LINE.test(l) && !NOT_EVIDENCE.test(l)).slice(0, 20);

    it.methodLines = methodLines;
    it.channels = it.error
      ? [{ kind: '읽기 실패', evidence: it.error, how: '열지 못함' }]
      : classifyChannels({ lines, methodLines, attachments: it.attachments || [] });
    /* 근거가 본문에서 나왔는지 첨부에서 나왔는지 — 이 구분이 곧 '학교가 어디에 적는가'다 */
    it.channels.forEach((c) => {
      if (!c.evidence) return;
      c.from = bodyLines.some((l) => l === c.evidence) ? '본문' : (attLines.some((l) => l === c.evidence) ? '첨부' : '본문');
    });
  }
}

state.classifiedAt = new Date().toISOString();
state.attachStats = { 읽은첨부: attRead, 글자없음: attMiss };
fs.writeFileSync(scanPath, JSON.stringify(state, null, 1));

/* ── 보고서 ── */
const L = [];
L.push('# 경희대·한국외대 장학 공고 신청 채널 전수 조사');
L.push('');
L.push(`- 조사: ${state.startedAt} · 재분류: ${state.classifiedAt}`);
L.push('- 근거는 **공고 원문(본문 + 첨부 원본)에서 신청·접수 방법을 말하는 줄**뿐입니다. 추론하지 않고, 근거가 없으면 「미확인」이라고 적습니다.');
L.push(`- 첨부에서 글자를 뽑은 파일 ${attRead}개 · 글자가 안 나온 파일 ${attMiss}개(그림으로 된 문서 등)`);
L.push('');

for (const key of ['khu', 'hufs']) {
  const st = state.schools[key];
  if (!st) continue;
  L.push(`## ${NAMES[key] || key}`);
  L.push('');
  L.push(`- 게시판에서 찾은 공고 **${st.rows}건** · 상세를 연 것 **${st.items.length}건**`);
  const withAtt = st.items.filter((i) => (i.attachFiles || []).some((a) => a.file)).length;
  const bodyEv = st.items.filter((i) => (i.channels || []).some((c) => c.from === '본문')).length;
  const attEv = st.items.filter((i) => (i.channels || []).some((c) => c.from === '첨부')).length;
  L.push(`- 첨부 원본을 받은 공고 ${withAtt}건 · 신청 방법이 **본문**에 적힌 공고 ${bodyEv}건 · **첨부**에만 적힌 공고 ${attEv}건`);
  L.push('');
  const tally = {};
  st.items.forEach((i) => (i.channels || []).forEach((c) => { tally[c.kind] = (tally[c.kind] || 0) + 1; }));
  L.push('| 신청 채널 | 건수 |');
  L.push('|---|---|');
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => L.push(`| ${k} | ${v} |`));
  L.push('');

  const portal = st.items.filter((i) => (i.channels || []).some((c) => c.kind === '학교 시스템 입력형'));
  L.push(`### 🔴 포털(학교 시스템) 입력형 — ${portal.length}건`);
  L.push('');
  if (!portal.length) L.push('_원문 근거로 확인된 건이 없습니다._');
  portal.forEach((i) => {
    const c = i.channels.find((x) => x.kind === '학교 시스템 입력형');
    L.push(`- **${i.title}**`);
    L.push(`  - ${i.url}`);
    L.push(`  - 원문 근거(${c.from}): \`${c.evidence}\``);
  });
  L.push('');
  L.push('<details><summary>전체 목록</summary>');
  L.push('');
  st.items.forEach((i) => {
    L.push(`- **[${(i.channels || []).map((c) => c.kind).join(' + ')}]** ${i.title}`);
    L.push(`  - ${i.url}`);
    (i.channels || []).filter((c) => c.evidence).forEach((c) => L.push(`  - ${c.from || ''} 근거: ${c.evidence}`));
  });
  L.push('');
  L.push('</details>');
  L.push('');
}
fs.writeFileSync(path.join(OUT_DIR, 'REPORT.md'), L.join('\n'));
console.log(`재분류 완료 — 첨부 글자 ${attRead}개 읽음 / ${attMiss}개 실패`);
for (const key of ['khu', 'hufs']) {
  const st = state.schools[key];
  if (!st) continue;
  const tally = {};
  st.items.forEach((i) => (i.channels || []).forEach((c) => { tally[c.kind] = (tally[c.kind] || 0) + 1; }));
  console.log(`\n▶ ${NAMES[key]} (${st.items.length}건)`);
  Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(3)} ${k}`));
}
