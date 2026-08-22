/* ============================================================
   한대장 — 공유 매칭 엔진
   앱 화면(app.js)과 서비스워커(sw.js, 백그라운드 알림)가 **같은 규칙**을 쓰도록
   자격 판정을 이 파일 한 곳에 둔다. 규칙이 바뀌면 화면과 알림이 동시에 바뀐다.
   (소급 적용 원칙 — 엔진이 두 벌이면 알림만 옛 기준으로 남는 사고가 난다)
   ============================================================ */

/* 자격 진단 — 프로필과 공고의 요건을 대조해 상태·사유·부족정보를 돌려준다 */
function evaluate(sch, p) {
  const e = sch.eligibility || {};
  const reasons = [];
  const missing = [];
  let ok = true;

  const flags = (p && p.flags) || [];
  const gpaExempt = p.status === 'freshman';

  if (e.minGpa != null && !gpaExempt) {
    if (p.gpa == null) missing.push('직전학기 평점');
    else if (p.gpa < e.minGpa) { ok = false; reasons.push(`평점 ${e.minGpa} 이상 필요 (현재 ${p.gpa})`); }
    else reasons.push(`성적 요건 충족 (${e.minGpa} 이상)`);
  }

  if (e.maxBracket != null) {
    if (p.bracket == null) missing.push('학자금 지원구간');
    else if (p.bracket > e.maxBracket) { ok = false; reasons.push(`지원구간 ${e.maxBracket}구간 이내 필요 (현재 ${p.bracket}구간)`); }
    else reasons.push(`소득 요건 충족 (${e.maxBracket}구간 이내)`);
  }

  if (e.years && !e.years.includes(p.year)) {
    ok = false; reasons.push(`${e.years.join('·')}학년만 지원 가능`);
  }

  if (e.freshmanOnly && p.status !== 'freshman') {
    ok = false; reasons.push('신입학 첫 학기 학생만 지원 가능');
  }

  if (e.tracks && !e.tracks.includes(p.track)) {
    ok = false; reasons.push('지원 대상 전공 계열이 아니에요');
  } else if (e.tracks) {
    reasons.push('전공 계열 요건 충족');
  }

  if (e.flagsAny) {
    /* 어떤 자격으로 충족됐는지 괄호로 밝힌다 (2026-08-02 개발자 요청) —
       '특별자격 요건 충족'만으로는 무엇 때문에 통과했는지 알 수 없다.
       라벨은 data.js의 FLAG_LABELS를 쓰되, 서비스워커에는 그 파일이 없으므로 없으면 키를 쓴다. */
    const matched = e.flagsAny.filter((f) => flags.includes(f));
    if (!matched.length) { ok = false; reasons.push('해당 특별자격(수급자·다자녀·보훈 등)이 필요해요'); }
    else {
      const L = (typeof FLAG_LABELS !== 'undefined' && FLAG_LABELS) || {};
      reasons.push(`특별자격 요건 충족 (${matched.map((f) => L[f] || f).join(', ')})`);
    }
  }

  if (e.seoulOnly) {
    if (p.region !== 'seoul') { ok = false; reasons.push('서울 거주자만 지원 가능'); }
    else reasons.push('거주지 요건 충족 (서울)');
  }

  if (e.needCert) {
    if (!p.cert) { ok = false; reasons.push('공인 외국어성적 보유가 필요해요'); }
    else reasons.push('외국어성적 보유 확인');
  }

  if (e.exchange) {
    if (!p.exchange) { ok = false; reasons.push('교환학생 파견 예정자만 지원 가능'); }
    else reasons.push('교환학생 요건 충족');
  }

  if (e.schoolOnly) {
    if (p.school !== e.schoolOnly) { ok = false; reasons.push(`${e.schoolOnly} 재학생만 지원 가능`); }
    else reasons.push(`재학 대학 공고 (${e.schoolOnly})`);
  }

  if (!ok) return { status: 'ineligible', reasons, missing };
  if (missing.length) return { status: 'unknown', reasons, missing };
  if (e.selective) return { status: 'selective', reasons, missing };
  return { status: 'eligible', reasons, missing };
}

/* 적합도 점수 (0~99) — 정렬용 */
function fitScore(sch, result, p) {
  if (result.status === 'ineligible') return 0;
  const e = sch.eligibility || {};
  let score = 62;
  const condCount = ['minGpa', 'maxBracket', 'years', 'tracks', 'flagsAny', 'seoulOnly', 'needCert', 'exchange', 'freshmanOnly', 'schoolOnly']
    .filter((k) => e[k] != null && e[k] !== false).length;
  score += Math.min(15, condCount * 3);
  if (result.status === 'selective') score -= 8;
  if (result.status === 'unknown') score -= 22;
  if (e.minGpa != null && p.gpa != null) score += Math.min(12, Math.max(0, Math.round((p.gpa - e.minGpa) * 10)));
  if (e.maxBracket != null && p.bracket != null) score += Math.min(6, e.maxBracket - p.bracket);
  if (e.flagsAny) score += 6;
  return Math.max(5, Math.min(99, score));
}

/* 마감일을 확정하지 못한 공고(원문에 마감이 없거나 못 읽은 경우)는 dday가 '기한 원문 확인'이라
   목록에서 영영 사라지지 않는다 — 지난 학기 공고가 계속 떠 있는 문제가 있었다(2026-07-30 발견).
   그래서 등록일(listedAt)로부터 60일이 지나면 숨긴다. 실시간 공고의 60일 규칙과 같은 기준이다.
   마감이 있는 공고는 기존대로 '마감 + 30일' 규칙만 적용된다.
   **알림도 이 함수를 쓴다** — 화면에서 숨긴 공고를 알림으로 알리면 사용자는 눌러도 찾을 수 없다. */
const STALE_DAYS = 60;
function notStale(sch, now) {
  if (!sch || sch.deadline || !sch.listedAt) return true;
  const listed = new Date(sch.listedAt + 'T00:00:00');
  if (Number.isNaN(listed.getTime())) return true;
  const t = new Date(now || Date.now());
  const startOfToday = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((startOfToday - listed) / 86400000) <= STALE_DAYS;
}

/* 학교·캠퍼스 한정 공고 걸러내기 — 다른 학교 공고가 목록·알림에 섞이지 않게 */
function scopedToProfile(list, p) {
  if (!p) return [];
  return (list || []).filter((s) => {
    const e = s.eligibility || {};
    if (e.schoolOnly && e.schoolOnly !== p.school) return false;
    if (e.campusOnly && p.campus && e.campusOnly !== p.campus) return false;
    return true;
  });
}

/* ---------------- 실시간 공고가 이 학생 것인가 ----------------
   화면(app.js)과 알림(notify-rules.js)이 **같은 함수**를 쓴다. 갈라지면 화면에 없는 공고를
   알림으로 알리게 된다(match-engine을 만든 이유와 같다). data.js는 서비스워커가 안 읽으므로
   분교 관련 판정은 반드시 여기 있어야 한다. */

/* 본교와 게시판을 함께 쓰는 분교 → 본교.
   연세 미래·고려 세종·동국 WISE·상명 천안은 자기 게시판이 따로 있어 여기 없다
   (그쪽은 공고의 school 이름이 이미 분교다). */
const SHARED_BOARD_BRANCH = {
  '한양대학교 ERICA캠퍼스': '한양대학교',
  '건국대학교 글로컬캠퍼스': '건국대학교',
  '홍익대학교 세종캠퍼스': '홍익대학교',
};

/* 제목 앞 [표시]로 캠퍼스를 가르는 게시판 — 한양대가 실제로 [서울]·[ERICA]를 붙인다.
   건국([교외]·[교내]·[국가])·홍익([단과대]·[재단명])의 대괄호는 캠퍼스가 아니라 분류라 넣지 않는다. */
const TITLE_CAMPUS = {
  '한양대학교': [
    [/^\s*[\[(]\s*서울\s*[\])]/, '한양대학교'],
    [/^\s*[\[(]\s*(ERICA|에리카)\s*[\])]/i, '한양대학교 ERICA캠퍼스'],
  ],
};

/* 제목이 캠퍼스를 밝혔으면 그 학교, 아니면 null */
function taggedSchool(n) {
  for (const [re, school] of TITLE_CAMPUS[n && n.school] || []) if (re.test(n.title || '')) return school;
  return null;
}

function noticeForProfile(n, p) {
  if (!p || !p.school || !n) return false;
  const tagged = taggedSchool(n);
  const school = tagged || n.school;
  if (school === p.school) return !(n.campus && p.campus && n.campus !== p.campus);
  // 공용 게시판의 공고 — 제목이 캠퍼스를 밝히지 않은 것만 분교 학생에게도 보여 준다
  if (!tagged && !n.campus && SHARED_BOARD_BRANCH[p.school] === school) return true;
  return false;
}

/* ---------------- 공고의 자격 요건을 짧게 정리하고 프로필과 대조 ----------------
   원문을 통째로 붙이면 ※ 부연설명까지 섞여 지저분하다(2026-08-02 개발자 지적).
   여기서는 **요건 줄만 골라 다듬어** '1) 4년제 대학생 2) 한부모 가정'처럼 짧게 만든다.
   다듬기는 표기 정리일 뿐 내용을 지어내지 않는다 — 원문에 없는 요건은 절대 만들지 않는다. */

/* 요건이 아니라 부연·안내·다른 항목인 줄 (버린다).
   자격 블록 안에는 선발인원·금액·수여식 같은 줄이 섞여 들어오는데, 이것들이 자리를 차지하면
   정작 중요한 요건이 뒤로 밀려 잘린다(2026-08-02 유흥수 장학금 사례). */
const REQ_NOISE = new RegExp([
  '^(※|상세내역|참고|유의|비고|문의|첨부|붙임)',
  '미신청시|확대 적용|바랍니다|참고하시기|공고문을 확인|일괄 진행|제출필요 없음|담당자|안내드립니다',
  // 선발 인원 : 1명 — 줄 앞뿐 아니라 **중간에 있어도** 인원 안내다
  // ('도우미 장학생 선발인원 : 최대 16명'이 자격 자리에 앉아 있었다, 2026-08-20)
  '^(추천|선발|모집)\\s?인원|(추천|선발|모집)\\s?인원\\s*[:：]',
  '^금\\s*액|^장학\\s*금액|^지원\\s*금액|^지급\\s*액',   // 금 액 : 250만원
  '^(수여식|시상식|일정|장소|기간)\\s*[:：]',
  // '가./나./다.'로 시작한다고 버리면 안 된다 — 그건 자격 절 안의 **진짜 요건 줄**이기도 하다
  // (면학장학금: "가. 2026-2학기 등록자…"). 접두어는 tidyRequirement가 이미 떼고,
  // "나. 장학생 선발" 같은 제목 줄은 아래 '이름표만 남은 제목' 규칙이 잡는다.
  '^(선발\\s?기준|선발\\s?방법|장학생\\s?선발)\\s*$',
  // 이름표만 남은 제목 줄 ("선발 대상", "지원자격" 등) — 내용이 없으면 요건이 아니다.
  // "및 …" 꼬리까지 봐야 한다 — 가톨릭대 동문장학금의 "2. 신청 자격 및 선발인원"이
  // 이 규칙을 비켜 가 **제목 한 줄이 요건 자리에 앉아 있었다** (2026-08-20).
  // 이름표만 남은 제목 줄. 앞에 수식어가 붙거나(`장학생 기본 자격`) 괄호 부연이 달려도
  // (`지원 자격 (가.~사. 모두 충족)` `신청대상(다음 조건을 모두 충족하여야 함)`) 내용은 없다.
  '^(장학생|공통|기본|아래|다음)?\\s*(장학생|공통|기본)?\\s*(신청|지원|응모|선발|모집|추천|장학)?\\s*(자격|대상|요건|기준)\\s*(요건|기준)?\\s*(및\\s*[^:：]{1,12})?\\s*(\\([^)]*\\))?\\s*[:：]?\\s*$',
  '^서류\\s?접수|^제출\\s?서류',                    // 서류 안내
  // 제출서류가 자격 자리에 앉는다 — 중앙대 교내장학금은 **자격 5줄이 전부 서류 이름**이었다
  // (`가족관계증명서` `중앙나래장학금 신청서`…). 자격이 없는데 **있는 척** 보이는 것이라 가장 나쁘다.
  // 줄이 서류 이름으로 **끝날 때만** 버린다 — '증명서 제출 가능한 자'처럼 요건인 문장은 살린다.
  '(증명서|확인서|증빙\\s?서류|서류\\s?사본|신청서|동의서)\\s*(\\([^)]*\\))?\\s*$',
  // 행사 안내 — 조각만 버린다. '수여식 참석 가능한 자'는 진짜 요건이라 살린다
  '^(장학증서\\s?)?(수여식|시상식)\\s*$|^일\\s?시\\s*[:：]|^장\\s?소\\s*[:：]|미\\s?참석.{0,12}(취소|제외)',
  '^시\\s?간\\s*(및\\s*장소)?\\s*[:：]|(수여식|시상식).{0,14}(변경|취소)될',   // 행사 진행 안내
  '확인\\s?경로\\s*[:：]|홈페이지\\s*\\(?[a-z0-9.-]+\\.(kr|com|net)',        // 어디서 확인하나 — 안내
  // 배점표 — '학업성적(50) + 취창업준비계획(20) + …'
  '\\(\\d{1,3}\\)\\s*\\+.*\\(\\d{1,3}\\)',
  // 분류 머리표 — '국가유공자 관련 장학금' '새터민(교육보호대상자) 관련 장학금'
  '관련\\s?장학금\\s*$',
  '^학자금\\s?지원\\s?구간\\s*$',              // 이름표만 남은 칸
  '\\.(hwp|hwpx|pdf|docx?|xlsx?|zip|png|jpg)$',    // 첨부 파일 이름이 섞여 들어온 것
  '신청\\s?(일정|안내)\\s*$',                       // "…국가장학금 1차 신청 안내"
  '지급\\s*$|근무 기준 월|원 지급',                  // 금액·지급 안내
].join('|'));

/* 🔴 '우선선발'은 자격이 **아니지만 버릴 것도 아니다** — 자격을 갖춘 사람 중 누구를
   먼저 뽑나이고, 학생에게 쓸모가 있다(2026-08-21 개발자 지적).
   그래서 **자격 블록에서는 걸러내고, '먼저 뽑는 기준' 블록에서 따로 보여 준다**
   (제외 대상을 따로 두는 것과 같은 방식). 섞어 놓으면 요건이 실제보다 훨씬 까다로워
   보여서 지원할 수 있는 학생이 스스로 포기한다 — 목포향우회가 그랬다.
   ⚠️ 판정(✓/✗)은 하지 않는다. 충족해도 '된다'는 뜻이 아니라 '먼저 본다'는 뜻이라
   초록 체크를 달면 거짓 안심이 된다(제외 대상과 같은 규칙). */
const PRIORITY_LINE = /우선\s?선발\s*[).\]]*\s*$|우선\s?선발\s?기준|우선\s?순위\s*[:：]|우대\s*[).\]]*\s*$/;

function tidyRequirement(line) {
  return String(line || '')
    // 앞머리 기호 — ■ □ ▣ ▷ ★ 를 빠뜨리면 '■ 자격요건' 같은 절 제목이 요건인 척 남는다
    // (2026-08-03 전수 재채점에서 세종대·서울과기대 사례로 발견)
    .replace(/^[\s\-–—•▪▶▷◆◇○●■□▣★♦⇒‡◦∙❍◎￭·ㆍ*]+/, '')
    // 앞머리 번호 — "3 )" "1." "가." "①" 모두
    .replace(/^\(?\s*\d+\s*[).]|^[①-⑳]|^[가-힣]\s*[.)]\s/, '')
    // "지원자격 : 내용" 처럼 이름표가 앞에 붙은 경우 이름표만 뗀다 (내용은 살린다)
    /* "지원자격 : 내용" 처럼 이름표가 앞에 붙은 경우 이름표만 뗀다 (내용은 살린다).
       바깥 제목이 이미 '지원 자격'이라 **줄마다 또 말하면 같은 말이 두 번** 나온다
       (목포향우회의 `장학생 신청 조건 : 전남 목포…` — 2026-08-21 개발자 지적).
       수식어(장학생·공통…)와 '조건'까지 봐야 그 줄이 걸린다. */
    .replace(/^\s*(장학생|장학금|공통|기본)?\s*(신청|지원|응모|선발|모집|추천|장학)?\s*(자격|대상|요건|기준|조건)\s*[:：]\s*/, '')
    .replace(/^[\s.)\]]+/, '')
    .replace(/\s*★\s*/g, '')
    .replace(/\s+/g, ' ')
    // 수집 과정에서 벌어진 한글/숫자 사이 공백 되붙이기 ("1 유형"→"1유형", "9 분위"→"9분위")
    .replace(/(\d)\s+(유형|분위|구간|학년|학기|학점|명|년|개월)/g, '$1$2')
    .replace(/\s+([,.)%】」』])/g, '$1')
    .replace(/([(【「『])\s+/g, '$1')
    .replace(/([“‘])\s+/g, '$1').replace(/\s+([”’])/g, '$1')   // 따옴표 안쪽 공백
    .replace(/([”’])\s*(로|으로|이|가|는|은|을|를)\b/g, '$1 $2')
    .trim();
}

/* lines를 따로 넘기면 그 줄들을 정리한다 — 자격 줄이 없어 원문 발췌로 물러날 때도
   같은 정리를 거치게 하기 위해서다(안 그러면 그 경로로만 ※ 부연이 새어 나온다). */
/* 뒷줄로 이어지는 줄 — 여기서 끊으면 **문장이 잘린 채** 화면에 나간다.
   실제로 이렇게 떠 있었다: `소득분위가 “기초생활수급자” 또는` (뒤가 없다),
   `2026-2학기 정규학기 학부 재학생 및 복학예정자 중`.
   🔴 버리면 안 된다 — 그 줄에 진짜 요건이 들어 있다. **다음 줄과 이어 붙인다.** */
const CONTINUES = /(또는|및|이고|이며|하여|중)\s*$|\s인\s*$|[,·+]\s*$/;

/* 자격이 아닌 것이 확실한 줄만 걷어낸다.
   ⚠️ '조건 낱말이 없으면 버린다'는 식의 일괄 규칙을 쓰지 말 것 — 2026-08-20에 세어 보니
   그렇게 버려지는 105줄 안에 `2026-1학기 종단추천장학 기수혜자`,
   `대한불교조계종 교육원의 장학추천 가능자`, `직전학기 평균성적이 0점인 경우 지원 불가`
   같은 **진짜 요건**이 섞여 있었다. 확실한 것만 이름을 대서 버린다. */
const NOT_REQ_LINE = [
  '^\\(.{1,14}\\)$',                       // (1 종) · (계속장학생) · (신규자) — 구분 머리표
  '^\\d+\\s?종$',
  '^합격일\\s?후|지급\\s?기간',              // 언제까지 주나 — 혜택이지 자격이 아니다
  '^총점\\s|\\(\\d+\\s?%\\)\\s*$|^배점',      // 배점표 — '비교과프로그램참여 (30%)'처럼 뒤에 붙는다
  '참고$|참고하시기|확인\\s?바랍|인정하지\\s?않음|첨부파일\\s*\\d*\\s*\\]?$',   // 참조·부연
].join('|');
const NOT_REQ_RE = new RegExp(NOT_REQ_LINE);

/* 표의 칸 하나가 통째로 줄이 된 것 — `국가고시` `모집부문` `재학여부` 같은 머리글이다.
   띄어쓰기가 없고 짧으며 서술로 끝나지 않는다.
   🔴 다만 **자격 범주 이름은 지킨다** — `북한이탈주민` `국적-몽골` 같은 것은 그 자체가 요건이다
   (전수로 세어 보니 16개 중 2개가 그랬다. 뭉뚱그려 버리면 진짜 자격이 사라진다). */
const BARE_CELL = /^\S{1,10}$/;   // 6자였을 때 `학자금지원구간`(7자)이 새어 나왔다
const REAL_CATEGORY = /(자|생|중|상|하|명|원)$|북한이탈|새터민|다문화|기초생활|차상위|국적|유공|보훈|장애|한부모|다자녀/;
const isTableCell = (t) => BARE_CELL.test(t) && !REAL_CATEGORY.test(t);

function requirementLines(sch, lines, opts) {
  const keepPriority = !!(opts && opts.keepPriority);   // '먼저 뽑는 기준' 블록을 그릴 때만 참
  const raw = lines || (sch && sch.eligibilityLines) || [];
  /* ① 먼저 이어지는 줄을 붙인다 — 정리·거르기는 **붙인 뒤에** 해야 한다.
     (붙이기 전에 거르면 앞줄이 잡음 규칙에 걸려 사라지고 뒷줄만 덩그러니 남는다) */
  const joined = [];
  for (const l of raw) {
    const s = String(l || '').trim();
    if (!s) continue;
    const prev = joined[joined.length - 1];
    if (prev && CONTINUES.test(prev) && (prev + ' ' + s).length <= 160) joined[joined.length - 1] = `${prev} ${s}`;
    else joined.push(s);
  }
  const out = [];
  for (const l of joined) {
    const t = tidyRequirement(l);
    // 다듬은 뒤에 검사한다 — "3 ) 금 액 : …"은 번호를 떼야 '금액' 줄인 것이 드러난다
    if (REQ_NOISE.test(l.trim()) || REQ_NOISE.test(t)) continue;
    if (NOT_REQ_RE.test(t) || isTableCell(t)) continue;
    if (!keepPriority && PRIORITY_LINE.test(t)) continue;   // 자격 블록에서는 뺀다 (위 주석)
    if (t.length < 4 || t.length > 160) continue;
    if (/^(신청\s?자격|지원\s?자격|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|자격\s?요건)$/.test(t)) continue;
    if (!out.includes(t)) out.push(t);
    /* 5줄이면 충분하다 — 더 늘어놓으면 학생이 안 읽는다. 사람이 정리한 것처럼 보여야 한다.
       못 담은 것은 바로 아래 '원문 보기'로 갈 수 있다. */
    if (out.length >= 5) break;
  }
  return out;
}

/* 요건 한 줄이 이 학생에게 맞는지 — **확실할 때만** 판정한다.
   틀린 초록 체크는 '모른다'보다 나쁘다(자격도 안 되는 학생이 서류를 준비하게 된다).
   그래서 숫자·낱말이 명확한 것만 보고, 조금이라도 애매하면 null(판정 안 함)을 낸다. */
function requirementMatch(text, p) {
  if (!p) return null;
  const t = String(text || '');
  const flags = p.flags || [];
  const has = (f) => flags.includes(f);

  // 소득분위/구간 — "1~9분위", "8분위 이내", "0분위"
  const band = t.match(/(\d)\s*[~∼-]\s*(\d)\s*(?:분위|구간)/) || t.match(/(\d)\s*(?:분위|구간)\s*(이내|이하|까지)/);
  if (band && p.bracket != null && /분위|구간/.test(t)) {
    const lo = band[3] ? 0 : Number(band[1]);
    const hi = band[3] ? Number(band[1]) : Number(band[2]);
    return p.bracket >= lo && p.bracket <= hi ? 'ok' : 'no';
  }
  // 평점 — "평점 3.0 이상", "평균평점 2.75/4.5 이상"
  const gpa = t.match(/(?:평점|평균평점|성적)[^0-9]{0,8}(\d\.\d{1,2})\s*(?:\/\s*4\.5)?\s*이상/);
  if (gpa && p.gpa != null) return p.gpa >= Number(gpa[1]) ? 'ok' : 'no';
  // 특별자격 — 낱말이 그대로 있을 때만
  if (/한부모/.test(t)) return has('basicLiving') || has('nearPoverty') ? null : null; // 프로필에 한부모 항목이 없다 — 판정하지 않는다
  if (/기초\s?생활|수급자/.test(t)) return has('basicLiving') ? 'ok' : 'no';
  if (/차상위/.test(t)) return has('nearPoverty') ? 'ok' : 'no';
  if (/다자녀|3자녀|세자녀/.test(t)) return has('multiChild') ? 'ok' : 'no';
  if (/국가유공|보훈/.test(t)) return has('merit') ? 'ok' : 'no';
  if (/장애\s?(학생|인)/.test(t)) return has('disabled') ? 'ok' : 'no';
  // 학년 — "1학년만", "2~3학년"
  const yr = t.match(/(\d)\s*[~∼-]\s*(\d)\s*학년/);
  if (yr && p.year != null) return p.year >= +yr[1] && p.year <= +yr[2] ? 'ok' : 'no';
  const yr1 = t.match(/(\d)\s*학년\s*(?:만|대상|재학생)/);
  if (yr1 && p.year != null) return p.year === +yr1[1] ? 'ok' : 'no';
  // 재학 상태 — "재학생 및 복학예정자"
  if (/재학생/.test(t) && !/대학원|졸업생/.test(t)) {
    if (p.status === 'enrolled' || p.status === 'returning') return 'ok';
    if (p.status === 'freshman' && /신입/.test(t)) return 'ok';
  }
  if (/4\s?년제|대학생|학부생/.test(t) && !/대학원/.test(t)) return 'ok';
  return null;   // 판정 불가 — 색을 칠하지 않는다
}

/* ---------------- 학교별 공고 파일 이름 (2026-08-17 신설) ----------------
   왜 나눴나: `data/notices.json`은 **폰이 통째로 내려받는 파일**이라, 고려대 학생도
   동국대 공고를 같이 받았다. 그래서 크기 상한(학교 수 × 15건)이 필요했고, 학교가 41곳이
   되면서 그 상한이 실제로 물려 바쁜 학교 34곳이 **16건에서 잘리고** 있었다.
   학교별로 나누면 학생은 자기 학교 것만 받으므로 **상한 자체가 필요 없어진다.**

   ⚠️ 파일 이름에 한글을 쓰지 않는 이유: 이 저장소에는 한글 파일명이 하나도 없다.
   지금 들이면 git 설정(core.quotepath)·GitHub Pages·나중의 Cloudflare 이전까지
   전부 확인해야 할 것이 늘어난다. 그래서 학교 이름을 **정해진 규칙으로 짧은 영숫자**로
   바꾼다(FNV-1a). 사람이 읽을 이름은 `data/notices/index.json`에 함께 적어 둔다.

   ⚠️ 이 함수는 **화면(app.js)·알림(sw.js)·수집 로봇(Node)이 같이 쓴다.**
   베껴 두면 로봇이 쓴 파일을 앱이 못 찾는다 — 그런데 앱은 404를 조용히 넘기므로
   **아무 오류 없이 공고가 0건이 된다**(가장 찾기 힘든 종류의 고장).
   verify/test-collector.mjs가 로봇과 이 함수의 결과가 같은지 검사한다. */
function noticeFileKey(school) {
  let h = 0x811c9dc5;
  const s = String(school || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;    // imul — 32비트 곱셈을 정확히 (그냥 *는 정밀도를 잃는다)
  }
  return `n${h.toString(36)}`;
}

function noticeFileFor(school) {
  return `data/notices/${noticeFileKey(school)}.json`;
}

/* 이 학생이 받아야 할 공고 파일들.
   분교가 본교 게시판을 함께 쓰는 경우(한양 ERICA·건국 글로컬·홍익 세종)에는 본교 파일도
   받아야 한다 — 공고가 본교 이름으로 저장되기 때문. 어느 것이 내 공고인지는 그다음에
   noticeForProfile이 가른다(그 판정은 여기서 손대지 않는다). */
function noticeFilesForProfile(p) {
  if (!p || !p.school) return [];
  const list = [noticeFileFor(p.school)];
  const parent = SHARED_BOARD_BRANCH[p.school];
  if (parent) list.push(noticeFileFor(parent));
  return list;
}

/* Node(검증 스크립트)에서도 같은 엔진을 불러 쓸 수 있게 — 브라우저·서비스워커에는 영향 없음 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { evaluate, fitScore, scopedToProfile, notStale, STALE_DAYS,
                     requirementLines, requirementMatch, tidyRequirement,
                     noticeForProfile, taggedSchool, SHARED_BOARD_BRANCH,
                     noticeFileKey, noticeFileFor, noticeFilesForProfile };
}
