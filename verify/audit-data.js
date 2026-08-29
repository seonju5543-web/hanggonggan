/* 데이터 소급 감사 — 엔진·정책이 업데이트될 때마다 실행해서
   '새 데이터'뿐 아니라 '기존 데이터'도 현재 기준을 충족하는지 전수 점검한다.
   (2026-07-05 도입: 페이스리프트가 신규 항목에만 적용되고 기존 항목이
    미흡하게 남는 문제의 재발 방지 장치)

   기준:
   ① 정식 등록 항목 필수 필드 (id·name·type·provider·amount·summary·eligibility·documents·sourceUrl)
   ② 신청서류(양식) 첨부가 있는 항목은 formId 연결 또는 noForm 사유 명시
   ③ formId는 data/forms.json에 실제 존재
   ④ forms.json 스키마 유효성 (섹션·필드·타입)
   ⑤ 마감일 형식(YYYY-MM-DD 또는 null)
   실행: node verify/audit-data.js  (오류 시 exit 1 — 경고는 목록만) */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/registered.json'), 'utf8'));
const forms = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/forms.json'), 'utf8'));
const { checkEntry, isDuplicatePair } = require('./entry-rules.cjs');
const { formBudgetReport, FORM_LIMITS } = require('../form-plan.js');
/* 🔴 새 필드 타입을 여기 안 넣으면 감사가 exit 1로 죽고, 그날 수집 로봇 결과가
   하나도 저장되지 않는다(워크플로가 감사 실패 시 되돌리기를 한다) */
const FIELD_TYPES = ['text', 'textarea', 'checks', 'checks+text', 'schedule', 'choice', 'group', 'static'];

const errors = [];
const warns = [];

/* ① ② ③ ⑤ — 정식 등록 항목 */
const seenIds = new Set();
for (const it of reg.items) {
  const where = `registered:${it.id || '(id 없음)'}`;
  if (seenIds.has(it.id)) errors.push(`${where} — id 중복`);
  seenIds.add(it.id);
  /* 항목별 규칙은 verify/entry-rules.cjs 한 곳에만 있다 — 수집 로봇도 같은 규칙으로
     등록 '전'에 거르므로, 새 규칙을 거기 추가하면 양쪽에 동시에 적용된다 */
  for (const p of checkEntry(it, { formIds: new Set(Object.keys(forms.templates)) })) {
    (p.level === 'error' ? errors : warns).push(`${where} — ${p.msg}`);
  }
  // 신청서 첨부가 있는데 양식도 사유도 없는 경우는 따로 더 구체적으로 알린다
  const formAtt = (it.attachments || []).filter((a) =>
    /신청서|양식|지원서|서류/.test(a.name) && /\.(hwp|hwpx|doc|docx|zip)/i.test(a.name));
  if (formAtt.length && !it.formId && !it.noForm) {
    warns.push(`${where} — 신청서류 첨부(${formAtt[0].name.slice(0, 30)}…)가 있는데 양식 미등록`);
  }
}

/* 같은 공고 이중 등록 (2026-07-30 추가: 시립대 빅데이터 장학금이 수동·자동으로 두 번 등록돼 있었다) */
for (let a = 0; a < reg.items.length; a++) {
  for (let b = a + 1; b < reg.items.length; b++) {
    if (isDuplicatePair(reg.items[a], reg.items[b])) {
      warns.push(`registered — 같은 공고 이중 등록 의심: ${reg.items[a].id}('${reg.items[a].name.slice(0, 26)}') ↔ ${reg.items[b].id}('${reg.items[b].name.slice(0, 26)}')`);
    }
  }
}

/* ④ — 양식 스키마 */
for (const [key, tpl] of Object.entries(forms.templates)) {
  const where = `forms:${key}`;
  // pledge(서약문)는 필수가 아니다 — 원본에 서약 문구가 아예 없는 양식이 있다.
  // (2026-08-02: 사랑나눔 자기소개서. 서약은 별개 문서인 개인정보 동의서에 들어 있어,
  //  없는 것을 지어내면 원문 그대로 원칙에 어긋난다. forms.js는 없으면 그 줄을 안 그린다.)
  for (const f of ['title', 'docName', 'org', 'sections']) {
    if (tpl[f] == null) errors.push(`${where} — 필수 필드 누락: ${f}`);
  }
  const ids = new Set();
  const secSigs = new Set();
  for (const sec of tpl.sections || []) {
    for (const f of sec.fields || []) {
      if (!f.id || !f.label || !f.type) { errors.push(`${where} — 필드에 id/label/type 누락`); continue; }
      if (ids.has(f.id)) errors.push(`${where} — 필드 id 중복: ${f.id}`);
      ids.add(f.id);
      if (!FIELD_TYPES.includes(f.type)) errors.push(`${where}.${f.id} — 알 수 없는 type: ${f.type}`);
      if (/checks|choice/.test(f.type) && (!Array.isArray(f.options) || !f.options.length)) {
        errors.push(`${where}.${f.id} — ${f.type} 타입인데 options 없음`);
      }
      /* group은 원본 표의 칸들을 한 질문 카드로 묶은 것 — sub가 비면 문서에 그 칸들이 통째로 빠진다 */
      if (f.type === 'group' && (!Array.isArray(f.sub) || f.sub.length < 2)) {
        errors.push(`${where}.${f.id} — group 타입인데 sub가 2개 미만`);
      }
      if (!f.q) warns.push(`${where}.${f.id} — 질문 문구(q) 없음`);
    }
    /* 로봇이 같은 첨부를 두 번 담으면 같은 섹션이 통째로 되풀이된다
       (실측: 동산장학회 45개×2 = 90개, 가송재단 7개×3). 질문 설계기가 화면에서는
       접어 주지만, 원인은 데이터라 여기서 눈에 보이게 해 둔다 */
    const sig = (sec.fields || []).map((f) => (f.label || '').replace(/[\s　]/g, '')).join('|');
    if (sig) { if (secSigs.has(sig)) warns.push(`${where} — 같은 항목의 섹션이 되풀이됨(로봇이 같은 첨부를 두 번 담았을 수 있음)`); secSigs.add(sig); }
  }

  /* ⑥ 질문 개수 상한 (2026-08-17 개발자 지시: 클릭 15 · 직접입력 10 · 전체 20)
     ⚠️ 넘는다고 앱이 질문을 감추지는 않는다 — 전부 보여 주고 여기서 에스컬레이션한다.
     숨기면 학생이 못 채운 칸이 있는 문서를 제출하게 된다.
     세는 기준은 화면(forms.js)과 같은 form-plan.js를 쓴다 — 베끼면 숫자가 갈라진다.
     프로필이 다 채워졌을 때(=최선의 경우)를 센다: '최적화하면 몇 개인가'가 개발자가 볼 숫자다 */
  try {
    const b = formBudgetReport(tpl);
    if (b.over.length) warns.push(`${where} — 질문 상한 초과: ${b.over.join(' · ')} (직접입력 ${b.counts.input}·클릭 ${b.counts.click}·전체 ${b.counts.total}) — 병합하거나 원본과 대조해 정리가 필요합니다`);
  } catch (e) {
    errors.push(`${where} — 질문 개수를 세지 못했습니다: ${e.message}`);
  }
}

/* 피드·양식 큐 감사 (2026-07-30 추가) — 로봇이 매일 바꾸는 데이터도 같이 본다.
   그동안 감사는 정식 등록만 봤고, 피드 중복(시립대 40건 중 실제 13건)과
   양식 원본 유실은 사람이 눈으로 볼 때까지 아무도 몰랐다. */
const { urlKey, titleKey } = require('../collector/url-key.cjs');
try {
  const notices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/notices.json'), 'utf8'));
  const byUrl = new Map(); const byTitle = new Map(); let dup = 0;
  for (const n of notices.items || []) {
    const uk = `u:${urlKey(n.url)}`; const tk = titleKey(n) ? `t:${titleKey(n)}` : null;
    if (byUrl.has(uk) || (tk && byTitle.has(tk))) {
      dup++;
      if (dup <= 3) warns.push(`notices — 같은 공고가 두 번 들어 있음: '${(n.title || '').slice(0, 40)}'`);
    }
    byUrl.set(uk, 1); if (tk) byTitle.set(tk, 1);
  }
  if (dup) errors.push(`notices — 실시간 공고에 중복 ${dup}건 (수집기 중복 제거가 동작하지 않았습니다)`);
  // 첨부 내려받기 주소가 공고 주소로 들어온 것 (앱에서 '원문 보기'가 파일 다운로드가 된다)
  const badUrl = (notices.items || []).filter((n) => /mode=download|attachNo=|fileDown/i.test(n.url || ''));
  if (badUrl.length) warns.push(`notices — 첨부 내려받기 주소가 공고로 들어온 것 ${badUrl.length}건 (예: '${badUrl[0].title.slice(0, 30)}')`);
} catch { /* 피드 파일이 없으면 건너뜀 */ }

/* 양식 원본 큐: '원본 확보됨(fetched)'이라고 표시됐는데 실제 파일이 없으면,
   다음 세션이 양식을 만들 수 없다 (2026-07-30 도레이·염곡 원본이 이렇게 사라졌다) */
try {
  const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'collector/pending-forms.json'), 'utf8'));
  const files = fs.existsSync(path.join(ROOT, 'collector/extracted'))
    ? fs.readdirSync(path.join(ROOT, 'collector/extracted')) : [];
  const indexTxt = files.includes('forms-index.txt')
    ? fs.readFileSync(path.join(ROOT, 'collector/extracted/forms-index.txt'), 'utf8') : '';
  for (const q of queue.items || []) {
    if (!q.fetched || q.schematized) continue;
    const key = (q.target || q.name || '').trim().slice(0, 10);
    if (key && !indexTxt.includes(key)) {
      warns.push(`pending-forms:${q.id} — 원본 확보(fetched)로 표시됐는데 collector/extracted에 파일이 없습니다: 재확보가 필요합니다`);
    }
  }
} catch { /* 큐가 없으면 건너뜀 */ }

/* 🔴 표식(#n-) 공고에 게시판 원제목이 없으면 **링크 사냥꾼이 영영 못 찾는다** (2026-08-21 신설).
   우리가 가진 이름은 사람이 다듬은 것이라 게시판 행과 글자가 다르다. 그런데 사냥 리포트에는
   다른 실패와 같은 문구로 찍혀서, 중앙대 11건이 3주 동안 '사라진 공고'로 오해받았다.
   감사에서 미리 잡으면 등록하는 그 자리에서 알 수 있다. */
for (const it of reg.items) {
  if (it.sourceUrl && it.sourceUrl.includes('#n-') && !(it.boardTitle || '').trim()) {
    warns.push(`registered:${it.id} — 게시판 목록 주소인데 boardTitle(게시판에 뜨는 제목 그대로)이 없습니다 — 링크 사냥꾼이 이 공고를 찾을 수 없습니다`);
  }
}

/* 🔴 지원 자격 자리에 '요건이 아닌 것'이 들어갔는가 — 매 실행 채점한다 (2026-08-21 신설)
   개발자가 목포향우회·사랑나눔에서 **세 번** 같은 것을 짚어 준 뒤에 만들었다.
   그동안 이 검사가 없어서, 새 잡음 유형이 생겨도 **다음에 누가 앱을 눈으로 볼 때까지** 아무도 몰랐다.
   ⚠️ 채점 규칙은 화면 필터(match-engine)와 **일부러 다른 축**으로 적는다 —
   "조건을 말하는가"가 아니라 "제목·목록·표처럼 생겼는가". 같은 규칙을 쓰면
   필터의 눈으로 필터를 채점하는 셈이라 **새 유형을 영영 못 본다**(그게 이번 실패의 원인이었다).
   규칙 원본은 verify/eligibility-report.mjs 한 곳뿐이고 여기서는 실행만 한다. */
try {
  const out = require('child_process')
    .execFileSync(process.execPath, [require('path').join(__dirname, 'eligibility-report.mjs'), '--bad'],
      { encoding: 'utf8' });
  out.split('\n').filter((l) => l.includes('✕')).forEach((l) => {
    const body = l.replace(/^\s*✕\s*/, '').trim();
    /* 자리 축(2026-08-24)은 다른 말을 해야 한다 — '요건이 아닌 줄'이 아니라 '칸이 틀렸다'다 */
    const placed = /두 칸에|제외 칸에|자격 칸만|자격 자리에/.test(body);
    warns.push(`자격 품질: ${body}${placed ? ' — 줄이 엉뚱한 칸에 있습니다' : ' — 지원 자격 자리에 요건이 아닌 줄이 있습니다'}`);
  });
} catch (e) { warns.push(`자격 품질 채점을 돌리지 못했습니다: ${e.message.slice(0, 80)}`); }

/* 🔴 화면에 금액이 뜨는데 근거를 못 보여 주는 공고 (2026-08-27 신설)
   개발자 지적: *"실패분이라는 게 있는 게 말이 된다고 생각해, 사용자 앱에 들어가는 화면인데?"*
   `amountValue`(화면에 뜨는 숫자)는 있는데 `amountSpec`(원문에서 읽은 근거)이 없으면,
   학생은 금액만 보고 어디서 나온 값인지 확인할 길이 없다. 그런 공고는 화면이
   **원문 공고 링크라도** 줘야 한다(원칙 8-1). 링크조차 없으면 오류로 막는다.
   ⚠️ 이 검사는 파서가 나빠지는 것도 같이 잡는다 — 규칙을 잘못 고쳐 읽던 금액을
      못 읽게 되면 여기 건수가 늘어난다(2026-08-27에 실제로 48→35건으로 떨어뜨렸다). */
{
  const noBasis = reg.items.filter((it) => (it.amountValue || 0) > 0 && !it.amountSpec);
  for (const it of noBasis) {
    const where = `registered:${it.id}`;
    if (!it.sourceUrl) {
      errors.push(`${where} — 화면에 ${it.amountValue.toLocaleString()}원이 뜨는데 원문 근거도 링크도 없습니다`);
    } else {
      warns.push(`${where} — 금액 ${it.amountValue.toLocaleString()}원의 원문 발췌가 없습니다 (원문이 첨부·제목에만 있는 공고 — 화면은 원문 링크를 줍니다)`);
    }
  }
  const withSpec = reg.items.filter((it) => it.amountSpec).length;
  console.log(`금액 근거: 원문 발췌 ${withSpec}건 · 발췌 없이 숫자만 ${noBasis.length}건`);
}

/* 결과 */
console.log(`감사 대상: 정식 등록 ${reg.items.length}건 · 양식 ${Object.keys(forms.templates).length}종`);
/* ── 🔴 자격 자리에 자격이 아닌 줄이 있으면 **저장을 막는다** (2026-08-23) ──
   개발자가 네 번째로 같은 것을 지적하며 물었다: "왜 자꾸 재발하는거지?"
   답은 **발견을 사람에게 맡겨 뒀기 때문**이다. 지금까지 잡음을 찾아내는 일이
   개발자가 앱을 눈으로 보는 것뿐이었고, 그래서 새 유형이 나오면 며칠씩 그대로 나갔다.

   이제 **관문으로 만든다.** 여기서 오류가 나면 수집 워크플로가 그 실행분을 되돌리므로
   잡음이 섞인 데이터는 앱에 하루도 못 나간다. 리포트가 아니라 관문이어야
   '사람이 기억해서 확인하는 일'이 사라진다.

   ⚠️ '글자가 상한 줄'(잘린 조각)은 경고로만 둔다 — 부류가 틀린 게 아니라 수집 단계에서
   글자가 빠진 것이라 성격이 다르고, 버리면 **진짜 요건을 잃는다**
   (동국인재육성의 `…12학점 이상인 경우만 성적 인 (…)` 이 그렇다). */
{
  /* 화면으로 나가는 문과 **같은 함수**로 본다 — 감사가 제 규칙을 따로 두면
     "감사는 통과하는데 화면엔 잡음이 뜨는" 상태가 된다(이 저장소가 여러 번 겪은 유형). */
  const { requirementLines, REQ_SIGNAL, HARD_THRESHOLD } = require('../match-engine.js');
  /* 규칙은 채점기와 **같은 파일**을 읽는다 — 예전엔 여기 한 벌이 베껴져 있어
     한쪽만 고치면 조용히 갈라졌다(2026-08-24). */
  const { NOISE_KIND: kinds, FRAGMENT: FRAG, MISPLACED } = require('./eligibility-noise.cjs');
  for (const it of reg.items) {
    if (it.program) continue;
    const shownLines = requirementLines(it);
    for (const l of shownLines) {
      for (const [k, re] of Object.entries(kinds)) {
        /* 요건 신호가 뚜렷하면 '자리가 틀린 것'(제외)만 문제 삼는다 — 안 그러면
           `한부모가족증명서 발급 대상 가정의 대학생` 같은 진짜 요건을 잡음이라 부른다 */
        if (!re(l) || (REQ_SIGNAL.test(l) && !MISPLACED.test(k))) continue;
        /* 순위 기준을 **일부러 남긴** 두 자리는 막지 않는다 (2026-08-24, match-engine과 같은 예외):
           ① 같은 줄에 진짜 커트라인이 있다 — 옮기면 그 선이 사라진다
           ② 그 줄이 이 공고의 유일한 자격이다 — 옮기면 카드가 '못 읽었어요'가 된다
           둘 다 채점기(넓은 축)가 경고로 계속 올리므로 눈에서 사라지지는 않는다. */
        if (k.startsWith('순위 기준') && (HARD_THRESHOLD.test(l) || shownLines.length === 1)) continue;
        errors.push(`registered:${it.id} — 지원 자격에 [${k}] 줄이 있습니다: "${l.slice(0, 60)}"`);
        break;
      }
      /* 🔴 **원인을 단정하지 않는다** (2026-08-29 고침). 예전 문구는 `(수집 단계)`라고
         못 박았는데, 걸린 두 건을 원문과 대조해 보니 **둘 다 수집 탓이 아니었다**:
           · 동국인재육성장학 — 원문(5,019자·안 잘림)이 그대로 `경우만 성적 인` 이다
           · 광운대 희망사다리 — 원문이 `( 단 , 현재 중소 ? 중견기업 …` 에서 줄을 바꾼다.
             같은 문서 다른 줄은 `신 · 편입` 으로 가운뎃점이 멀쩡하다 → 우리 인코딩 문제가 아니다
         둘 다 **학교가 문장 중간에 줄을 바꾼 것**이고, 우리는 줄 단위로 담는다.
         원문을 안 열어 보고 원인을 적으면 다음 세션이 없는 버그를 쫓는다 —
         이 저장소가 반복해 배운 '짐작하지 말고 열어 볼 것'을 경고 문구 자체가 어기고 있었다.
         버리지 않고 경고로 두는 이유는 test-collector 에 적혀 있다(버리면 진짜 요건을 잃는다). */
      if (FRAG.test(l)) warns.push(`registered:${it.id} — 자격 줄이 조각나 보입니다 (원문 줄바꿈일 수 있음 — 원문을 열어 확인하세요): "${l.slice(0, 60)}"`);
    }
  }
}

/* ── 🔴 초안이 학생을 탈락시키지 못하게 하는 관문 (2026-08-24) ──
   개발자 지적: "공고 원문·첨부에서 드러난 위험과 같은 위험이 또 있나? 자격 매칭 개발과
   엮어 확인하고 예방할 수 있나?"

   있었다. 코퍼스 전수를 훑어 보니 초안에 영향을 주는 실격·감점 규정이 세 갈래였다:
     ① 블라인드 심사 — 학교명을 쓰면 **심사에서 제외**. 앱이 학교명을 서버로 보낸다.
     ② 분량 미달/초과 — "1페이지 미만 심사 제외" · "2페이지 초과 페이지당 감점".
     ③ 내용 부실/질문 무관 — 초안이 엉뚱하면 제외(품질 규칙이 이미 짚는다).
   (참고: '대필'은 9건 나왔지만 전부 '수업 대필 도우미'라는 근로장학 역할명이었다 —
    자기소개서 대필 금지가 아니다. 오해해서 기능을 막지 않도록 확인 후 남긴다.)

   자격 매칭과 엮는 방식은 **관문을 공유**하는 것이다. 자격 잡음이 리포트가 아니라
   관문이 되어서야 재발이 끝났듯(위 절), 이 위험도 관문으로 막는다:
     **코퍼스가 '블라인드'라고 말하는 공고를 앱(essay-form-rules.json)이 모르면 배포 차단.**
   그러면 새 블라인드 공고가 들어와도 앱이 학교명을 지우지 못한 채 나가는 일이 없다.
   판정은 자격 추출과 **같은 원문 링크 규칙**(notice-source·canon-url)을 쓰는 miner 다. */
try {
  const { mine } = require('../collector/essay-house-mine.mjs');
  const rulesPath = path.join(__dirname, '..', 'data', 'essay-form-rules.json');
  const deployed = fs.existsSync(rulesPath) ? JSON.parse(fs.readFileSync(rulesPath, 'utf8')).notices || {} : {};
  const fresh = mine().perNotice;              // 코퍼스에서 지금 다시 계산한 것
  for (const [id, v] of Object.entries(fresh)) {
    if (v.blind && !(deployed[id] && deployed[id].blind)) {
      errors.push(`essay-form-rules:${id} — 코퍼스는 블라인드 심사 공고라는데 앱이 모릅니다. ` +
        `학교명이 든 초안이 나가면 학생이 심사에서 제외됩니다 — '작성 규칙 학습' 워크플로(읽고 저장)를 돌려 갱신하세요`);
    }
  }
} catch (e) {
  warns.push(`초안 위험 관문을 돌리지 못했습니다: ${e.message.slice(0, 80)}`);
}

if (errors.length) { console.log('\n[오류 — 반드시 수정]'); errors.forEach((e) => console.log(' ✕', e)); }
if (warns.length) { console.log('\n[경고 — 소급 적용 필요 항목]'); warns.forEach((w) => console.log(' ⚠', w)); }
if (!errors.length && !warns.length) console.log('✓ 모든 데이터가 현재 엔진 기준을 충족합니다');
process.exit(errors.length ? 1 : 0);
