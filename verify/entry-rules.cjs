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
  const err = (msg) => out.push({ level: 'error', msg });
  const warn = (msg) => out.push({ level: 'warn', msg });
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
    warn('sourceUrl이 게시판 목록 주소(#n- 표식) — 원문 공고로 바로 못 갑니다. 복구 로봇 실행: collector/run-resolve-urls.txt 수정 후 push');
  } else if (RULES.BOARD_LIST.test(url)) {
    warn('sourceUrl이 게시판 목록 주소 — 개별 공고 주소가 필요합니다');
  }
  // 장학금이 아닌 것
  if (RULES.FILENAME_TITLE.test(name)) err(`제목이 첨부 파일 이름입니다: '${name.slice(0, 36)}'`);
  if (RULES.LOAN.test(name) && !RULES.LOAN_EXCEPT.test(name)) {
    err(`학자금대출·융자는 장학금이 아니라 정식 등록 대상이 아닙니다: '${name.slice(0, 30)}'`);
  }
  if (RULES.GRAD_ONLY.test(name)) err(`대학원 전용 공고는 학부생 매칭 대상이 아닙니다: '${name.slice(0, 30)}'`);
  // 양식 정보 (원칙 5 — 감사 통과 조건)
  if (!it.formId && !it.noForm) warn('formId도 noForm도 없음 — 양식을 연결하거나 양식 없음 사유를 기재하세요');
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

module.exports = { checkEntry, isDuplicatePair, RULES };
