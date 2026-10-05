/* 출처 목록(대외활동·교내 소식 게시판)이 지켜야 할 규칙 — 한 곳 (2026-10-04 · 로봇·도구 점검)

   왜 여기인가: 이 규칙들은 test-collector(코드 규칙 관문)가 **실데이터 파일을 읽어** 단정하고 있었다.
   그런데 관리자 저장 관문(admin-apply.yml)은 audit-data 하나만 돌려, 관리자가 근거를 짧게 적거나
   보관한 게시판을 되살려 한 학교에 게시판이 둘이 되면 **저장은 통과하고 다음 로봇 실행의 데이터 관문이 빨개져**
   그 실행 결과가 되돌려졌다(재현: 활동 출처 근거 '학교 공지 확인' 8자 · 소식 출처 park→add→unpark).
   그래서 '관리자가 고치는 데이터의 불변식'은 두 길(로봇·관리자)이 같이 지나는 감사(verify/audit-data.js · 오류)에 두고,
   관리자 저장소(tools/admin-apply.mjs)가 저장 **전에** 같은 함수로 먼저 거절해 화면이 사유를 말하게 한다.

   🔴 파일을 읽지 않는다(순수 함수) — 부르는 쪽이 읽어서 넘긴다(auditSourceFiles 는 읽는 함수를 받는다). 규칙을 베끼지 말고 이 파일을 불러 쓴다.
   반환: …Problems 는 [{ msg }] · auditSourceFiles 는 감사 오류 문장 [string] — 비면 통과. */

/* 근거(evidence)는 '어디서 확인했나'를 적는 칸 — 10자 넘게(날짜 도장 하나로도 넘는다) */
const EVIDENCE_MIN = 10;
/* 교내 소식: 날짜가 붙은 글 줄이 이만큼 있어야 게시판이다 — 찾기 로봇(find-news-boards.mjs MIN_ROWS)이 불러 쓴다 */
const NEWS_MIN_ROWS = 5;

const evidenceOk = (ev) => typeof ev === 'string' && ev.trim().length > EVIDENCE_MIN;

/** 대외활동·공모전 출처(collector/activity-sources.json).
 *  opts.served — 서비스 학교 이름 목록(match-engine.js SERVED_SCHOOLS) · opts.aggregator — 집계 사이트 정규식(collector/link-fix.mjs AGGREGATOR_RE · 있을 때만 잰다) */
function activitySourceProblems(src, opts = {}) {
  const served = opts.served || [];
  const out = [];
  for (const x of (src && src.sources) || []) {
    const who = x.school || x.host || '(이름 없음)';
    if (!('boardUrl' in x)) out.push({ msg: `${who} — boardUrl 칸이 없습니다 (주소가 없으면 null 로 두어야 로봇이 '주소 미설정'으로 알린다)` });
    if (x.school === '') {
      if (!x.host) out.push({ msg: `학교도 주최(host)도 없는 출처입니다 — ${x.boardUrl || '(주소 없음)'}` });
    } else if (!served.includes(x.school)) {
      out.push({ msg: `${who} — 서비스하지 않는 학교입니다(match-engine.js SERVED_SCHOOLS) · 전국 글이면 학교를 비우고 host 를 적습니다` });
    }
    if (x.boardUrl && !evidenceOk(x.evidence)) {
      out.push({ msg: `${who} · ${x.boardUrl} — 확인한 근거(evidence)를 ${EVIDENCE_MIN}자 넘게 적어야 합니다 (지금 「${String(x.evidence || '')}」)` });
    }
    if (x.boardUrl && opts.aggregator && opts.aggregator.test(x.boardUrl)) {
      out.push({ msg: `${who} · ${x.boardUrl} — 집계 사이트는 출처가 아닙니다(주최가 올린 제 게시판을 넣는다)` });
    }
  }
  return out;
}

/** 교내 소식 출처(collector/news-sources.json).
 *  opts.schools — 수집망 학교 이름 목록(collector/schools.json 의 school) · opts.minRows — 기본 NEWS_MIN_ROWS */
function newsSourceProblems(src, opts = {}) {
  const schools = opts.schools || [];
  const minRows = opts.minRows || NEWS_MIN_ROWS;
  const out = [];
  const rows = (src && src.sources) || [];
  for (const s of rows) {
    if (!schools.includes(s.school)) out.push({ msg: `${s.school || '(학교 없음)'} — 수집망 학교(collector/schools.json)가 아닙니다` });
    for (const c of s.candidates || []) {
      if (!/^https?:\/\//.test(c.url || '') || typeof c.evidence !== 'string' || c.evidence.length < EVIDENCE_MIN) {
        out.push({ msg: `${s.school} — 후보 ${c.url || '(주소 없음)'} 에 근거(웹 검색 결과 주소 등 ${EVIDENCE_MIN}자 이상)가 없습니다` });
      }
    }
    if (!s.boardUrl) continue;
    const robot = s.autoFound && s.autoFound.rows >= minRows && Array.isArray(s.autoFound.sample);
    if (!robot && !evidenceOk(s.evidence)) {
      out.push({ msg: `${s.school} · ${s.boardUrl} — 로봇 확인(autoFound ${minRows}행 이상)도 사람의 근거(evidence ${EVIDENCE_MIN}자 넘게)도 없습니다` });
    }
  }
  /* 학교 하나에 게시판 줄 하나 — 둘이면 리포트·건강 장부에서 이름이 겹쳐 한쪽 실패가 묻힌다(둘째 게시판은 extraBoards 칸) */
  const seen = new Map();
  for (const s of rows.filter((x) => x.boardUrl)) seen.set(s.school, (seen.get(s.school) || 0) + 1);
  for (const [school, n] of seen) if (n > 1) out.push({ msg: `${school} — 게시판이 있는 줄이 ${n}개입니다(학교 하나에 하나 · 바꾸려면 지금 줄을 먼저 보관)` });
  return out;
}

/** 감사(verify/audit-data.js)가 부르는 한 곳 — 두 출처 파일을 재서 **오류 문장**을 돌려준다(빈 배열 = 통과).
 *  감사는 이 결과를 그대로 errors 에 넣기만 한다 — 관문(health-gates/gate.mjs ②)이 표본으로 이 함수를 돌리고,
 *  감사가 결과를 경고(warns)로 낮추지 않았는지도 본다(리뷰 2026-10-04: errors → warns 로 바꿔도 관문이 조용했다).
 *  read(rel) — 부르는 쪽이 준다(이 파일은 파일을 읽지 않는다). 못 읽으면 그것도 오류(조용히 꺼지는 검사 금지).
 *  opts.served — 서비스 학교 이름 목록 · opts.aggregator — 집계 사이트 정규식(collector/link-fix.mjs AGGREGATOR_RE · 한 곳).
 *  🔴 집계 사이트 정규식을 못 받으면 그것도 오류 — 규칙 하나가 조용히 빠지지 않게. */
function auditSourceFiles(read, opts = {}) {
  const errors = [];
  const why = (e) => String((e && e.message) || e).slice(0, 80);
  if (!(opts.aggregator instanceof RegExp)) {
    errors.push('activity-sources — 집계 사이트 규칙(collector/link-fix.mjs AGGREGATOR_RE)을 받지 못해 그 검사를 못 했습니다(감사 경고에 이유)');
  }
  try {
    const src = read('collector/activity-sources.json');
    for (const p of activitySourceProblems(src, { served: opts.served, aggregator: opts.aggregator })) errors.push(`activity-sources — ${p.msg}`);
  } catch (e) { errors.push(`activity-sources — 출처 목록을 읽지 못했습니다: ${why(e)}`); }
  try {
    const schools = ((read('collector/schools.json') || {}).schools || []).map((s) => s.school);
    for (const p of newsSourceProblems(read('collector/news-sources.json'), { schools })) errors.push(`news-sources — ${p.msg}`);
  } catch (e) { errors.push(`news-sources — 출처 목록을 읽지 못했습니다: ${why(e)}`); }
  return errors;
}

module.exports = { activitySourceProblems, newsSourceProblems, auditSourceFiles, evidenceOk, EVIDENCE_MIN, NEWS_MIN_ROWS };
