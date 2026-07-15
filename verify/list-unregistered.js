#!/usr/bin/env node
/* 개발자 도우미 — 수집됐지만 아직 정식 등록되지 않은 공고를 추린다.
   정식 등록 컨펌 작업을 빠르게 하기 위한 목록. (저장소 루트 또는 verify/에서 실행)

   node verify/list-unregistered.js          # 등록 후보만 (메뉴·중복·마감경과 제외)
   node verify/list-unregistered.js --all     # 제외분 사유까지 전부 표시

   판정 규칙(honesty 원칙 반영):
   - 이미 registered.json의 sourceUrl과 겹치면 '중복'
   - 메뉴/안내/대출/융자/행사성 제목이면 '비공고'
   - deadlineHint 또는 제목의 날짜가 오늘 이전이면 '마감경과'
   - 그 외 = 등록 후보 (첨부가 있으면 양식 스키마화 대상 표시) */
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync('data/notices.json') ? '.' : path.join(__dirname, '..');
const notices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
const registered = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
const showAll = process.argv.includes('--all');
const TODAY = new Date().toISOString().slice(0, 10);

/* URL 정규화 — collector/auto-register.mjs의 canonUrl과 같은 규칙.
   목록 파라미터(sort·페이지)는 떼고 글 식별자만 남기되, 클릭형 게시판의
   #n-제목 표식은 글의 정체성이므로 유지한다 (떼면 게시판 전체가 중복으로 뭉개짐) */
const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|idx|wr_id|bidx)$/i;
function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) if (ID_PARAMS.test(k) && v) keep.push(`${k.toLowerCase()}=${v}`);
    keep.sort();
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    return u.origin + u.pathname + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}
const regKeys = new Set(registered.items.map((i) => canonUrl(i.sourceUrl || '')).filter(Boolean));
const isRegistered = (url) => regKeys.has(canonUrl(url));

// 메뉴/비공고/대출/행사 신호 — 개별 장학 공고가 아님
const NON_NOTICE = /^(장학금 종류|장학금 신청|장학\/?학자금|장학 및 학자금|학자금 대출|장학금·학자금|국가장학금 및 학자금대출|국제화장학금|교외장학재단|근로장학공고게시판|네오르네상스장학|장학금안내|장학\(공지\)|학생지원팀|학생지원센터|장학 및 학자금 대출|학자금 중복지원)/;
const LOAN = /학자금\s?대출|학자금융자|무이자|이자지원|대출 신청|대출 안내/;
const EVENT = /교육\s*\*|참가팀 모집|운영계획서|포스터$|Q&amp;A|Q&A/;
const MENU_TAIL = /\[등록\/장학\]\s*$|^\d+\.\s|^\(붙임|^\(신청서식|^\(공고문/;

function pastDeadline(n) {
  // 제목·마감단서에서 YYYY.M.D 또는 ~M/D 형태를 뽑아 오늘과 비교 (보수적: 명확한 것만)
  const hay = `${n.title} ${n.deadlineHint || ''}`;
  const m = hay.match(/~\s*(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/) ||
            hay.match(/(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})\s*(까지|마감)/);
  if (!m) return false;
  const d = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  return d < TODAY;
}

const buckets = { candidate: [], duplicate: [], nonNotice: [], past: [] };
for (const n of notices.items) {
  let why = 'candidate';
  if (isRegistered(n.url)) why = 'duplicate';
  else if (NON_NOTICE.test(n.title) || LOAN.test(n.title) || EVENT.test(n.title) || MENU_TAIL.test(n.title) || n.title.length < 8) why = 'nonNotice';
  else if (pastDeadline(n)) why = 'past';
  buckets[why].push(n);
}

// 후보를 학교별로
const bySchool = {};
for (const n of buckets.candidate) {
  const k = n.school + (n.campus ? ' ' + n.campus : '');
  (bySchool[k] = bySchool[k] || []).push(n);
}

console.log(`\n=== 정식 등록 후보 (${buckets.candidate.length}건) — 컨펌 대상 ===`);
for (const [k, items] of Object.entries(bySchool)) {
  console.log(`\n■ ${k} (${items.length})`);
  for (const n of items) {
    const att = (n.attachments || []).length;
    console.log(`  • ${n.title.slice(0, 74)}`);
    console.log(`    ${n.url}`);
    if (n.deadlineHint) console.log(`    ⏰ ${n.deadlineHint.slice(0, 60)}`);
    if (att) {
      console.log(`    📎 첨부 ${att}건${/신청서|서식|양식/.test(JSON.stringify(n.attachments)) ? ' (양식 스키마화 대상 가능)' : ''}`);
      if (showAll) n.attachments.forEach((a) => console.log(`       - ${a.name}`));
    }
  }
}

console.log(`\n=== 요약 ===`);
console.log(`등록 후보 ${buckets.candidate.length} · 이미 등록(중복) ${buckets.duplicate.length} · 비공고/메뉴/대출/행사 ${buckets.nonNotice.length} · 마감경과 ${buckets.past.length} · 전체 ${notices.items.length}`);
console.log(`현재 정식 등록: ${registered.items.length}건`);

if (showAll) {
  const dump = (label, arr) => { console.log(`\n--- ${label} (${arr.length}) ---`); arr.forEach((n) => console.log(`  ${n.title.slice(0, 70)}`)); };
  dump('중복(이미 등록)', buckets.duplicate);
  dump('비공고/메뉴/대출/행사', buckets.nonNotice);
  dump('마감경과', buckets.past);
}
