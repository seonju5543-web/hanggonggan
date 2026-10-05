/* 정식 등록 항목 1건이 지켜야 할 규칙 — 한 곳에만 적어두고 두 군데서 쓴다.
   ① 수집 로봇(collector/auto-register.mjs): 등록하기 '전'에 걸러 — 잘못된 항목이 앱에 나가지 않게
   ② 감사 도구(verify/audit-data.js): 이미 등록된 것 '전수'를 다시 검사 — 소급 적용 원칙 7

   규칙을 한 곳에 모은 이유: 2026-07-30 전수 감사에서 나온 문제 대부분이
   '로봇은 거르는데 사람이 등록한 건 안 걸러진다' 또는 그 반대였다.
   앞으로 새 규칙은 여기에만 추가하면 로봇과 감사가 동시에 적용된다. */

const RULES = {
  // 원문 보기를 누르면 공고가 아니라 파일이 내려받아지는 주소
  DOWNLOAD_URL: /mode=download|attachNo=|fileDown|\/download\b|\.(png|jpe?g|gif|hwpx?|pdf|docx?|zip|xlsx?)(\?|$)/i,
  // 제목이 첨부 파일 이름인 것 ('…포스터.png')
  FILENAME_TITLE: /\.[a-z]{2,5}$/i,
  /* 장학금이 아닌 융자 — 학부생에게 장학금 카드로 보이면 안 된다.
     단 '대출 원금·이자를 지원하는 장학금'(세종이도 디딤돌 등)은 장학금이므로 LOAN_EXCEPT로 뺀다 */
  LOAN: /^\[학자금\s?대출\]|학자금\s?대출\s*(신청|안내|실행|연장|접수)|학자금융자|생활비\s?대출\s*(신청|안내)/,
  LOAN_EXCEPT: /(원금|이자|상환)[^)]{0,6}(지원|감면)|지원\s*사업/,
  // 학부생 대상 서비스라 대학원 전용 공고는 매칭 대상이 아니다
  GRAD_ONLY: /대학원생?\s?(전용|대상)|\[대학원|석사과정|박사과정|수련의|T\/AS|강의보조/,
  // 개별 공고가 아니라 게시판 목록 주소 (공고 표식 #n- 도 없는 경우)
  BOARD_LIST: /\/list(\.do)?\/?(\?|$)|artclList\.do|list\.do\?/i,
};

const REQUIRED = ['id', 'name', 'type', 'provider', 'amount', 'summary', 'eligibility', 'documents', 'sourceUrl'];

/* 문구에 적힌 **마지막 날짜** — `신청 2026.7.6(월) ~ 8.31(월) 18:00` 의 끝은 8.31 이다.
   해가 안 적힌 끝 날짜는 앞의 해(없으면 마감의 해)를 빌린다 — dateFrom 과 같은 뜻.
   (2026-10-04 · verify/deadline-audit.mjs 에서 옮겼다 — 아래 '화면 문구 ↔ 마감' 규칙이 감사·관리자 저장·자동 등록에서
    같이 돌게. 마감일 감사 도구는 여기서 불러 쓴다 · 정규식뿐이라 관리자 화면(브라우저 감쌈)에서도 돈다) */
function lastDateIn(text, year) {
  /* `모집 ~2026.8.5 · 선발 발표 8.26(수)` — 발표·지급 날짜는 마감이 아니다. 그 말 앞까지만 본다 */
  const p = String(text || '').split(/발표|지급|공고일|게시/)[0];
  /* ⚠️ 뒤에 소수점 자리가 더 오면 날짜가 아니다 — `평점 3.5 ~ 4.5` 를 3월 5일로 읽지 않는다 */
  const re = /(?<!\d)(?:(20\d{2})\s?[-./년]\s?)?(\d{1,2})\s?[-./월]\s?(\d{1,2})(?![\d.]\d)(?!\d)/g;
  let last = null, y = year, prevMo = 0;
  for (const m of p.matchAll(re)) {
    if (m[1]) y = m[1];
    if (!y) continue;
    const mo = Number(m[2]), da = Number(m[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) continue;
    /* 성적 이야기 속 소수(`평점 3.5 ~ 4.5`)는 날짜가 아니다 — 앞 10자에 성적 낱말이 있거나 뒤에 `점·이상` 이 붙는다 */
    if (/평점|성적|학점|점수|GPA/i.test(p.slice(Math.max(0, m.index - 10), m.index)) || /^\s*(점|이상|이하|만점)/.test(p.slice(m.index + m[0].length))) continue;
    /* 해가 안 적힌 채 달이 거꾸로 가면(`12.20 ~ 1.10`) 해가 넘어간 것이다(2026-09-17 코드 리뷰) */
    if (!m[1] && prevMo && mo < prevMo) y = String(Number(y) + 1);
    prevMo = mo;
    last = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  return last;
}

/* 항목 1건 검사 → [{level:'error'|'warn', msg}]
   opts.formIds: data/forms.json에 있는 양식 id 집합 (없으면 formId 존재 검사 생략) */
function checkEntry(it, opts = {}) {
  const out = [];
  /* `fix` 는 **누가 고칠 수 있는가**를 기계가 읽을 수 있게 적어 둔 이름이다 (2026-09-13).
     🔴 사람에게 시키는 말("…파일을 고쳐서 push 하세요")을 문구에 넣지 않는다 —
     이 저장소의 개발자는 코드 지식이 없고, 그 문구를 읽어도 할 수 있는 일이 없다.
     대신 화면이 이 이름을 보고 **그 자리에 버튼**을 띄운다(관리자 화면 '할 일').
     값은 워크플로 파일 이름이다. 없으면 사람이 하나씩 봐야 하는 일이다. */
  const err = (msg, fix) => out.push(fix ? { level: 'error', msg, fix } : { level: 'error', msg });
  const warn = (msg, fix) => out.push(fix ? { level: 'warn', msg, fix } : { level: 'warn', msg });
  const name = it.name || '';
  const url = it.sourceUrl || '';

  for (const f of REQUIRED) if (it[f] == null) err(`필수 필드 누락: ${f}`);
  if (it.deadline != null && !/^\d{4}-\d{2}-\d{2}$/.test(it.deadline)) err(`마감일 형식 오류: ${it.deadline}`);
  if (it.listedAt != null && !/^\d{4}-\d{2}-\d{2}$/.test(it.listedAt)) err(`listedAt 형식 오류: ${it.listedAt}`);
  /* 🔴 **화면 문구(period)의 끝 날짜와 마감이 같아야 한다** (2026-10-04 · 로봇·도구 점검 — test-collector 의 실데이터 단정에서 옮김).
     카드는 마감(D-n)과 문구를 나란히 보이므로 둘이 다르면 학생은 어느 날이 끝인지 모른다. 관리자가 마감만 고치고 문구를 두면
     예전엔 관리자 관문(감사)은 통과하고 **다음 로봇 실행의 데이터 관문이 빨개져** 그 실행 결과가 되돌려졌다 — 이제 한 규칙이 두 길을 같이 막는다.
     ⚠️ 상시 제도(program)는 뺀다 — 마감이 없는 제도다. 문구에 날짜가 없으면(`접수 기간 원문 확인`) 잴 것이 없다. */
  if (!it.program && it.deadline && it.period && /^\d{4}-\d{2}-\d{2}$/.test(it.deadline)) {
    const pe = lastDateIn(it.period, it.deadline.slice(0, 4));
    if (pe && pe !== it.deadline) err(`화면 문구의 끝 날짜(${pe})와 마감(${it.deadline})이 다릅니다 — 문구(period)도 같이 고치세요: 「${String(it.period).slice(0, 40)}」`);
  }

  // 지어낸 금액 — 금액 문구에 숫자가 없는데 합계에 들어갈 값이 있으면 추론이다 (원칙 8-1)
  if ((it.amountValue || 0) > 0 && !/\d/.test(it.amount || '')) {
    err(`금액 문구('${(it.amount || '').slice(0, 24)}')에 숫자가 없는데 amountValue=${it.amountValue} — 확인 못 한 금액은 0`);
  }
  // 목록에서 영영 사라지지 않는 항목 방지
  if (!it.deadline && !it.listedAt) warn('마감일이 없으면 listedAt(등록일)이 있어야 60일 뒤 자동으로 감춰집니다');
  // 원문 주소
  if (RULES.DOWNLOAD_URL.test(url)) err('sourceUrl이 첨부 내려받기 주소 — 공고 원문 주소로 바꾸세요');
  else if (url.includes('#n-')) {
    /* 2026-07-31: 예전에는 표식(#n-제목)이 있으면 통과시켰는데, 이 주소를 누르면 그 장학금
       공고가 아니라 **학교 장학 공지 목록 전체**가 열린다(사용자가 목록에서 다시 찾아야 하고,
       글이 뒤로 밀리면 아예 못 찾는다). 표식은 '아직 원문 주소를 못 찾았다'는 임시 표시일 뿐이므로
       감사에 남긴다 — 복구 로봇(collector/resolve-detail-urls.mjs)이 원문 주소로 바꿔 준다. */
    warn('학생이 원문 보기를 눌러도 그 공고로 못 가고 게시판 목록이 열립니다 (원문 주소를 아직 못 찾았습니다)',
      'resolve-detail-urls.yml');
  } else if (RULES.BOARD_LIST.test(url)) {
    warn('sourceUrl이 게시판 목록 주소 — 개별 공고 주소가 필요합니다', 'resolve-detail-urls.yml');
  }
  // 장학금이 아닌 것
  if (RULES.FILENAME_TITLE.test(name)) err(`제목이 첨부 파일 이름입니다: '${name.slice(0, 36)}'`);
  if (RULES.LOAN.test(name) && !RULES.LOAN_EXCEPT.test(name)) {
    err(`학자금대출·융자는 장학금이 아니라 정식 등록 대상이 아닙니다: '${name.slice(0, 30)}'`);
  }
  if (RULES.GRAD_ONLY.test(name)) err(`대학원 전용 공고는 학부생 매칭 대상이 아닙니다: '${name.slice(0, 30)}'`);
  /* 지원 자격을 아직 못 읽은 공고 — 학생 화면에는 "공고 원문에서 지원 자격을 확인하세요"로 나간다
     (2026-09-17 개발자 지시로 우리 사정을 말하던 옛 문구를 걷었다 — 그 뒤로도 이 경고 문구가
      옛 학생 문장을 인용하고 있어 관리자 화면이 **없는 문장**을 두 군데서 다르게 말했다).
     🔴 문구를 '잘못됐다'로 쓰지 않는다 — 갓 자동 등록된 공고는 발췌기가 **나중에** 채우므로
        여기 걸린 것 대부분은 틀린 게 아니라 아직 안 읽은 것이다(확인 안 한 원인을 단정하지 않는다). */
  if (!(it.eligibilityLines || []).length && !it.eligibilityVerified) {
    warn('지원 자격을 아직 못 읽었습니다 — 학생 화면에는 "공고 원문에서 지원 자격을 확인하세요"로만 나갑니다',
      'eligibility-fill.yml');
  }
  // 양식 정보 (원칙 5 — 감사 통과 조건)
  if (!it.formId && !it.noForm) {
    warn('formId도 noForm도 없음 — 양식을 연결하거나 양식 없음 사유를 기재하세요', 'deep-fetch.yml');
  }
  if (it.formId && opts.formIds && !opts.formIds.has(it.formId)) err(`formId '${it.formId}'가 data/forms.json에 없음`);

  /* 🔴 학교가 스스로 운영하는 장학 제도가 '교외'로 남아 있는가 (2026-09-20 개발자 지시 · 소급 · 원칙 7)
     *"그 셋이 대체 왜 교외에 있었는지 모르겠으며 교내로 바꾸고 재발하지 않도록 해줘."*
     경희대 반영장학·우정장학·경희꿈도전장학이 교외로 등록돼 있었다 — 판정이 **제목에 `교내` 라고
     적혀 있을 때만** 교내라고 부르는데 학교는 제 게시판에 그 글자를 안 쓰기 때문이다.
     🔴 **이 검사가 '재발 방지'의 실체다** — 규칙(match-engine 의 `OWN_PROGRAMS`)만 고치면
        이미 등록된 것은 교외로 남는다(`type` 은 등록할 때 한 번 정해지고 다시 안 본다).

     🔴 **`opts.noticeKind` 로 판정을 받아 온다 — 여기서 match-engine 을 require 하지 말 것.**
        이 파일은 `_admin/build.sh` 가 감싸서 **브라우저로도** 읽는다(관리자 화면). 최상위
        require 를 넣으면 admin.js 가 통째로 안 돌아 버튼이 죽는다(2026-09-13 실사고와 같은 유형).

     ⚠️ **오류가 아니라 경고다.** 오류로 두면 사람이 관리자 화면에서 '교외'로 고치는 순간
        감사가 영영 실패하고, 그러면 수집 워크플로가 매일 되돌리기를 돌려 **자동 등록이 통째로
        멈춘다** — 되돌리기(collector/gate-guard.mjs)가 이번 실행의 새 등록분·정식 등록 파일을 직전 판으로
        되돌려도 원인이 기존 데이터라 매 실행 still-failing(빨간불)로 끝난다. 사람 판단을 기계가 잠그면 안 된다.
     ⚠️ 학교를 모르는 전국 등록분은 건너뛴다 — 표가 학교별이라 적용할 수 없다. */
  const ownSchool = (it.eligibility || {}).schoolOnly || '';
  if (opts.noticeKind && ownSchool && it.type !== '교내'
    // `name` 은 70자로 잘린 값이라 게시판 원제목도 같이 본다 (이름이 뒤에 있으면 놓친다)
    && opts.noticeKind(`${name} ${it.boardTitle || ''}`, ownSchool) === '교내') {
    warn(`${ownSchool}가 스스로 운영하는 장학 제도인데 '${it.type}'로 등록돼 있습니다 `
      + `— 교내로 고치거나, 아니라면 match-engine.js 의 OWN_PROGRAMS 에서 그 이름을 빼세요 `
      + `(근거: docs/designs/on-campus-programs.md)`);
  }

  /* 🔴 **접수 메일 주소는 근거 없이 못 들어온다** (2026-09-23 신설 · 원칙 8-1).
     이 주소가 틀리면 학생의 신청서와 증명서류가 **엉뚱한 사람의 메일함**으로 간다.
     그래서 주소를 넣었으면 그것이 적힌 원문 문장(`applyEmailSource`)을 함께 남기고,
     여기서 **주소가 그 문장 안에 실제로 들어 있는지** 다시 본다.
     ⚠️ 관리자가 손으로 넣은 것(`applyEmailFrom` 이 '관리자'·'AI')은 **경고까지만** 한다 —
        오류로 만들면 사람이 화면에서 고치는 순간 감사가 영영 실패해 자동 등록이 통째로
        멈춘다(바로 위 '교내' 규칙과 같은 이유). 로봇이 넣은 것은 근거가 반드시 있어야
        하므로 오류다 — 근거 없이 들어왔다면 그건 버그다. */
  if (it.applyEmail) {
    const src = it.applyEmailSource || '';
    const byHuman = /^(AI|관리자)/.test(it.applyEmailFrom || '');
    if (!src) {
      (byHuman ? warn : err)(`접수 메일 주소(${it.applyEmail})에 근거 문장이 없습니다 `
        + `— applyEmailSource 에 그 주소가 적힌 공고 원문 한 줄을 남기세요`);
    } else if (!src.includes(it.applyEmail)) {
      err(`접수 메일 주소(${it.applyEmail})가 근거 문장 안에 없습니다 `
        + `— 근거: 「${src.slice(0, 60)}…」`);
    }
  }

  /* 🔴 **포털 시스템도 근거 없이 못 들어온다** (2026-09-23 · 접수 메일과 같은 규칙).
     여기가 틀리면 학생을 엉뚱한 화면으로 보낸다 — 한국외대는 시스템이 둘이라
     '신청'이 아니라 '계좌 등록' 화면으로 보내면 신청 버튼을 영영 못 찾는다.
     ⚠️ 관리자가 손으로 넣은 것은 경고까지만(위 접수 메일과 같은 이유). */
  if (it.applyPortal) {
    const src = it.applyPortalSource || '';
    const byHuman = /^(AI|관리자)/.test(it.applyPortalFrom || '');
    if (!src) {
      (byHuman ? warn : err)(`포털 시스템(${it.applyPortal})에 근거 문장이 없습니다 `
        + `— applyPortalSource 에 신청 방법이 적힌 공고 원문 한 줄을 남기세요`);
    }
  }
  /* 근거 문장은 학생 화면에 그대로 나간다 — HTML 기호(`&rarr;`)가 남으면 글자로 샌다(2026-09-11 사고와 같은 줄 · 발췌기가 풀어 넣는다).
     (2026-10-04 · test-collector 의 실데이터 단정에서 옮김 — 로봇이 넣는 칸이라 오류) */
  const entity = `${it.applyPortalSource || ''} ${it.applyEmailSource || ''}`.match(/&[a-zA-Z#0-9]+;/);
  if (entity) err(`접수 근거 문장에 HTML 기호(${entity[0]})가 남아 있습니다 — 학생 화면에 글자로 보입니다`);

  return out;
}

/* 같은 공고가 두 번 등록됐는지 — 주소가 달라도 같은 학교·같은 이름이면 중복이다.
   '(2026-2학기)'처럼 공통 꼬리표 때문에 비슷해 보이는 다른 장학금은 걸러낸다. */
const clean = (s) => (s || '').replace(/[\s·ㆍ~〜.,'"]/g, '').toLowerCase();
const variants = (s) => [clean(s), clean((s || '').replace(/\[[^\]]*\]/g, ''))];
const gram = (s) => { const g = new Set(); for (let i = 0; i <= s.length - 4; i++) g.add(s.slice(i, i + 4)); return g; };
function simOf(x, y) {
  const [ga, gb] = [gram(x), gram(y)];
  const small = ga.size <= gb.size ? ga : gb; const big = ga.size <= gb.size ? gb : ga;
  if (!small.size) return 0;
  let hit = 0; for (const g of small) if (big.has(g)) hit++;
  return hit / small.size;
}
function distinctiveSim(x, y) {
  let i = 0;
  while (i < x.length && i < y.length && x[x.length - 1 - i] === y[y.length - 1 - i]) i++;
  const [rx, ry] = [x.slice(0, x.length - i), y.slice(0, y.length - i)];
  if (!rx.length || !ry.length) return 1;
  return simOf(rx, ry);
}
function isDuplicatePair(A, B) {
  const sa = (A.eligibility || {}).schoolOnly || '';
  const sb = (B.eligibility || {}).schoolOnly || '';
  if (sa !== sb) return false; // 학교별 접수분은 별건 등록이 정상
  let sim = 0; let distinct = 0;
  for (const x of variants(A.name)) {
    for (const y of variants(B.name)) {
      const s = simOf(x, y);
      if (s > sim) { sim = s; distinct = distinctiveSim(x, y); }
    }
  }
  return sim >= 0.8 && distinct >= 0.5;
}

/* ── 사업 열쇠 — 학교가 달라도 같은 사업인가 (2026-09-30 · F-5 재발에서) ──────────────
   `isDuplicatePair` 는 같은 학교 안의 재게시를 잡는 눈이고(학교가 다르면 false), 한 재단 사업이 여러 학교 게시판에
   올라온 경우는 제목의 접두어·꼬리가 학교마다 달라 4-gram 유사도로도 못 잡았다:
     `[교외장학] 2026 산재 노동자 자녀 성장지원사업 모집` ↔ `2026년도 산재 노동자 자녀 성장지원사업 참여자 모집 안내`
   그래서 대괄호 표식·연도·학기·회차·기수·게시판 붙박이 말(모집·안내·공고·선발·신청·접수·참여자·장학생)을 떼고 남는
   **알맹이**를 열쇠로 삼는다. 열쇠가 같으면 같은 사업이다. 🔴 열쇠가 8자 미만이면 판정하지 않는다 — `성적우수장학` 처럼
   여러 학교가 각자 운영하는 흔한 이름이 한 사업으로 묶이면 학교별 제도가 조용히 지워진다(그건 재게시가 아니다). */
const PROGRAM_NOISE = /\[[^\]]*\]|\([^)]*\)|20\d{2}\s*(학년도|년도|년)?|\d\s*학기|(상|하)반기|제?\s*\d+\s*(회|기|차)|하반기|상반기|공통|서울|글로벌|국제/g;
const PROGRAM_TAIL = /(참여자|참가자|장학생|대상자|학생)?\s*(추가\s*)?(선발|모집|신청|접수|추천|지원)\s*(계획|안내|공고|공지)?(\s*(안내|공고|공지))?$/;
function programKey(title) {
  let t = String(title || '').replace(PROGRAM_NOISE, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) t = t.replace(PROGRAM_TAIL, '').trim();
  t = t.replace(/[\s·ㆍ~〜.,'"「」『』:：\-–—_/]/g, '').toLowerCase();
  return t.length >= 8 ? t : null;
}
/* 같은 사업인가 — 열쇠가 같으면 같다. 학교 축은 보지 않는다(부르는 쪽이 '다른 학교'를 따로 확인한다). */
function sameProgram(a, b) {
  const ka = programKey(a && a.name != null ? a.name : a);
  const kb = programKey(b && b.name != null ? b.name : b);
  return !!ka && ka === kb;
}

/* ── `fix` 로 부를 로봇을 **어떤 모양으로** 부르는가 (2026-09-14) ──────────────
   🔴 **입력 없이 부르지 말 것.** `eligibility-fill.yml` 의 `mode` 기본값은 '전부' 라,
      화면이 값을 안 보내면 버튼 한 번에 **전수(약 2,229원)** 가 돈다.
      `deep-fetch.yml` 의 `form_targets` 기본값은 '조병두' 라, 값을 안 보내면 지금 보는
      공고가 아니라 **엉뚱한 공고의 첨부**를 받아 온다(실측).
   🔴 여기 적는 글자는 워크플로 yml 의 `options:`·기본값과 **한 글자도** 달라선 안 된다 —
      다르면 GitHub 이 422 로 거부한다. 관문(test-collector)이 yml 과 대조한다.
   🔴 `_admin/admin.js` 에만 두지 말 것 — 로봇 규칙과 갈라진다. 규칙과 같은 파일에 둔다.

   칸 뜻
     main   눈에 띄는 버튼(싼 쪽·안전한 쪽)   ·   all  흐린 버튼(비싼 쪽·되돌릴 수 없는 쪽)
     inputs 워크플로에 그대로 보낼 값
     argFrom  'names' 이면 화면이 **그 원인에 걸린 공고 제목들**을 `arg` 칸에 채운다
     cost   돈이 나가는 로봇이면 사람이 읽을 금액. 있으면 확인 시트가 한 줄 더 묻는다 */
const FIX_PLAN = {
  'eligibility-fill.yml': {
    main: { label: '시범 3건만 읽기', inputs: { mode: '시범 3건만' }, cost: '약 50원' },
    all: { label: '전부 읽기', inputs: { mode: '전부' }, cost: '건당 약 13원 (2026-08-23 실측 2,229원/169건)', danger: true },
    note: '원문이 저장된 공고만 읽습니다 — 원문이 없는 공고는 로봇이 조용히 건너뜁니다.',
  },
  'deep-fetch.yml': {
    main: { label: '첨부 원본 받아 오기', argFrom: 'names', arg: 'form_targets' },
    note: '공고 제목으로 찾아 첨부 원본을 받아 옵니다. 받아 온 뒤 양식으로 만드는 것은 다음 수집 때입니다.',
  },
};

module.exports = { checkEntry, isDuplicatePair, programKey, sameProgram, lastDateIn, RULES, FIX_PLAN };
