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

module.exports = { checkEntry, isDuplicatePair, RULES, FIX_PLAN };
