/* ============================================================
   교내·교외 **증거 판정기** (2026-09-30 신설 — 개발자 지시 "장학금 판정을 자동화")
   ------------------------------------------------------------
   왜 필요한가 — 판정이 사람 손에 매달려 있었다
     `noticeKind`(match-engine.js)는 제목만 본다: [교내] 표식 또는 사람이 채운 학교 제도 표(OWN_PROGRAMS)에
     이름이 있으면 교내, 아니면 교외. 학교는 제 게시판에 제 장학금을 올릴 때 '교내'라고 적지 않으므로
     (2026-09-20 F-9: 경희대 반영·우정·꿈도전이 전부 교외로 뜸) 표를 학교마다 사람이 원문을 읽고 채워야 했다.
     44개교로 넓히자 그 표는 경희대 한 곳뿐이라 42개교의 자체 장학금이 다시 전부 '교외'가 됐다.
     옛 방식(제목에 재단 낱말이 없으면 교내)은 2026-09-18 실측에서 '교내' 19건 중 17건이 틀렸다 — 낱말 목록으로
     교외를 찾는 길은 막혔다. 남은 길은 **'우리 학교가 준다'는 증거를 원문에서 읽는 것**이다.

   무엇을 증거로 보나 (전부 원문에 적힌 글자 — 추론하지 않는다 · 운영 원칙 8-1)
     교내 ← [교내] 표식 · 학교 제도 표(고정 OWN_PROGRAMS + 학습 own-programs.json) ·
            제목에 학교 이름표(별칭·약칭)가 있고 바깥 기관 낱말이 없음 + 본문이 본교/교비/발전기금/장학팀 접수를 말함
     교외 ← [교외] 표식 · 제목·주관에 바깥 기관 낱말(재단·장학회·공단·시·구·회사·동문회·한국장학재단…) ·
            접수 이메일이 학교 도메인이 아님 · 본문이 "재단에 직접 제출/재단 홈페이지 신청/우편 접수"를 말함
     그 밖 ← 교외(2026-09-18 결정: 교내는 증거가 있을 때만)
   확신 — high(표식·표·학교 이름표+본문 증거) · mid(학교 이름표만 · 본문 한쪽 증거만) · low(기본값).
   `national` — 접수처가 학교 창구가 아니라 재단·공단 쪽이라는 증거가 있으면 true (전국 승격 판단의 재료 · scope-promote.mjs).

   🔴 순수 함수만 둔다 — 파일을 읽지 않는다(관문이 픽스처로 돈다). 표·별칭은 부르는 쪽이 넘긴다.
   🔴 여기서 `noticeKind` 를 베끼지 않는다 — 표식 규칙(NOTICE_CAMPUS_MARK)과 고정 표는 match-engine 것을 받아 쓴다.
   ============================================================ */

/* 바깥 기관 낱말 — 제목·주관에 이게 있으면 학교가 주는 것이 아니다.
   ⚠️ 동문회·총동문회도 바깥이다(법인이 다르다 · 2026-09-18 결정 "교내는 우리 학교가 준다는 뜻"). */
export const ORG_RE = /(재단법인|사단법인|장학재단|장학회|장학관|재단|공단|진흥원|복지회|복지관|협회|학회|은행|[가-힣A-Za-z]+그룹|\(주\)|주식회사|㈜|기업(?!가)|[가-힣]+회사|시청|군청|구청|도청|교육청|(?:^|[^가-힣])(?:시|군|구)\s*장학|[가-힣]{1,5}(?:특별시|광역시|특별자치[시도]|시|군|구|도)\s*(?:청|장학|인재|대학생|청년|거주)|한국장학재단|국가장학|국가근로|[가-힣]+공사(?![가-힣])|위원회|연합회|(?:총)?동문회|동창회|교회|사랑의열매|(?<!학교)법인|[가-힣]+일보|중앙회|공제회|로터리|라이온스|유니세프|적십자)/;
/* ⚠️ 낱말 다섯은 **맨 것으로 쓰지 않는다**(2026-09-30 리뷰 3차): `기업` 은 '기업가정신 장학'에, `법인` 은 '학교법인 ○○학원'(학교 자신)에,
   `그룹`·`회사`·`공사` 는 본문 낱말('공사 중')에 걸렸다. 지자체는 이름이 붙은 꼴(`부산광역시 대학생`·`서울시 청년`)까지 잡는다 —
   학교 이름표 '부산'·'서울'이 지자체 이름 안에 들어 있어 교내로 읽힌 사고(같은 리뷰)를 여기서 먼저 끊는다. */
/* 제목의 교외 표식 */
export const OFF_MARK_RE = /\[\s*교외|교외\s*장학|외부\s*장학|외부\s*기관/;
/* 본문 — 학교가 준다는 말 */
export const SCHOOL_BODY_RE = /본교\s*(장학|기금|예산)|우리\s*(대학|학교)\s*(장학|재학생)|교내\s*장학|(교비|발전기금|장학예산|학교\s*예산)[^\n]{0,15}(지원|지급|운영|재원|출연|마련)|(장학팀|장학복지팀|학생지원팀|학생처|학생지원처|학생과|학생복지팀)[^\n]{0,10}(주관|운영|선발|심사)/;
/* 본문 — 학교 창구가 아니라 재단·공단에 직접 내라는 말 (전국 승격의 재료) */
export const EXTERNAL_DIRECT_RE = /(재단|공단|진흥원|장학회|복지회|협회)\s*(에|으로|측에|에서)\s*(직접\s*)?(제출|접수|신청|우편|이메일|메일)|(재단|공단|진흥원|장학회|협회)\s*(홈페이지|누리집|사이트|온라인|시스템)\s*(에서|을\s*통해|로)?\s*(신청|접수|지원)|온라인\s*신청\s*\(?(재단|공단)/;
/* 맨 「우편 접수」·「등기우편」 — 받는 곳이 학교 창구가 아닐 때만 재단 쪽 증거다(아래 schoolMailDest · 2026-11-23 홍익 신용카드수수료장학 실측). */
export const MAIL_APPLY_RE = /우편\s*접수|등기\s*우편/;
/* 옛 이름 — 둘을 합친 것(받는 곳을 보지 않는다 · 판정기는 위 둘을 따로 쓴다) */
export const EXTERNAL_APPLY_RE = new RegExp(`${EXTERNAL_DIRECT_RE.source}|${MAIL_APPLY_RE.source}`);
/* ⚠️ 위원회·사무국·본부는 넣지 않는다 — 학교 안 장학위원회·학생지원본부가 흔해 첫 시험에서 성균관대 벽송회장학금이 전국으로 풀렸다(2026-09-30). */
/* 본문 — 학교 창구로 내라는 말 (교내 또는 학교 접수분) */
export const SCHOOL_APPLY_RE = /(장학팀|학생지원팀|학생처|학생과|학과\s*사무실|행정실|교학팀|학사지원팀|장학복지팀)\s*(에|으로|방문|직접|을\s*통해)?\s*(제출|접수|방문|신청)|(포털|종합정보시스템|학사정보시스템|INFO21|HUFSAbility|SAINT|e-?Campus|유레카|KLAS|학생지원시스템)[^\n]{0,24}(신청|접수|등록|입력|제출)/i;

/* ── 우편·방문으로 받는 곳이 학교 창구인가 (2026-11-23 · 홍익 신용카드수수료장학 · 외대 송화재단 실측) ──
   「5. 접수방법 : 방문 또는 등기우편 제출」 ↵ 「* 우편제출 : 04066 서울 마포구 와우산로 94(상수동) 홍익대학교 학생회관 2층 학생처 장학팀」 —
   맨 「등기우편」 을 '재단에 직접 제출'로 세어 학교 접수분이 44개교 전체에 풀렸다. SCHOOL_APPLY_RE 는 「장학팀에 제출」(창구 → 동사) 꼴만 읽어
   「우편제출 : … 장학팀」(동사 → 주소 → 창구) 꼴을 못 봤다. 외대 송화재단은 「5. 제출처 및 문의처」 ↵ 「… 한국외국어대학교 학생회관 108 호 학생지원 . 장학팀」.
   받는 곳 표식 뒤의 같은 줄 — 표식만 있는 줄이면 다음 줄 — 을 읽는다. 「문의」 뒤는 받는 곳이 아니고, 받는 곳에 바깥 기관 낱말(ORG_RE)이 있으면 학교가 아니다
   (「제출처: ○○재단 사무국」 · 통영시 「우편물 제출처: 통영시 평생교육과」 는 그대로 재단·시 쪽 증거). */
const SCHOOL_OFFICE = '장학팀|학생지원팀|학생지원과|학생처|학생과|학과\\s*사무실|행정실|교학팀|학사지원팀|장학복지팀|학생지원처|학생복지팀';
const DEST_MARK_RE = /(?:우편|등기|방문)\s*(?:제출|접수)(?:처)?|(?:우편물\s*)?(?:제출|접수)\s*(?:처|장소|주소)|보내실\s*곳|받는\s*곳/;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function schoolMailDest(body, school) {
  const office = new RegExp(`(${SCHOOL_OFFICE}${school ? `|${escapeRe(school)}` : ''})`);
  const lines = String(body || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = DEST_MARK_RE.exec(lines[i]);
    if (!m) continue;
    let rest = lines[i].slice(m.index + m[0].length).replace(/^\s*(?:및\s*문의처?)?\s*[:：]?\s*/, '');
    if (!/[가-힣A-Za-z0-9]/.test(rest)) rest = lines[i + 1] || '';
    rest = rest.split('문의')[0];
    if (ORG_RE.test(rest)) continue;
    const o = office.exec(rest);
    if (o) return `${m[0].trim()} … ${o[0]}`;
  }
  return null;
}

/* 학교가 추천해 보내는 사업 — 학교 창구다(CLAUDE.md 「학교 범위」: 학교 창구·포털·**추천 배정**으로 받는 것만 그 학교 · 2026-11-23).
   세종대 「② 학생지원과 추천대상자 확정 후 … ③ 추천대상자 한국장학재단 온라인 신청」 은 「재단 온라인 신청」 으로 전국에 풀려 44개교에 보였고,
   성균관대 성암육영회(「학교 추천자로 선발되었어도」)도 같았다. 맨 「추천서」(지도교수 추천서 · 재단 양식 추천서)는 학교 배정이 아니다(동진장학 실례).
   고등·중·초등학교 추천은 대학 창구가 아니다 · 「대학 추천 없이」 처럼 부정이면 아니다. */
export const SCHOOL_RECOMMEND_RE = /(?:(?<!고등|중|초등)학교|대학(?:교)?|총장\s*님?)\s*(?:명의\s*|직인\s*)?추천(?!\s*(?:서\s*)?(?:없이|불필요|필요\s*없|아님|무관|하지\s*않|받지\s*않))|추천\s*대상자|(?:학교|대학)별\s*(?:배정|추천)/;
/* 국가근로 — 소속 대학이 뽑는다. 교외 근로기관은 그 대학과 협약한 곳이고(동양미래대 국가근로 운영 기준 「교외근로장학생 선발 기준은 근로기관과 협약을 통해」 ·
   한국장학재단 근로기관 안내자료 「장학생의 소속대학에 문의 … 대학 담당자와 협의 후 대체장학생 선발」) 그 학교 게시판의 모집 글은 그 학교 학생 몫이다.
   과기대 「국가근로장학생 교체 선발모집_(주)아이티희망나눔」 은 지원서를 회사 메일(naver.com)로 받아 '학교 밖 접수'로 전국에 풀렸다(2026-11-23). */
export const WORK_STUDY_RE = /국가\s*근로/;

/** 학교 창구로 받는다는 원문 증거 — 있으면 전국으로 풀지 않는다(scope-promote ①②) · 이미 푼 것은 되돌린다(같은 로봇 ⓪). 순수 함수.
 *  @param x { title, text, excerpts, school, applyPortal, applyEmail, domain } @returns 근거 한 줄 | null */
export function schoolWindowEvidence(x = {}) {
  const title = String(x.title || '');
  const body = [x.text || '', ...(Array.isArray(x.excerpts) ? x.excerpts : [])].join('\n');
  let m;
  if ((m = WORK_STUDY_RE.exec(title))) return `제목 「${m[0]}」 — 소속 대학이 뽑는다`;
  if ((m = SCHOOL_APPLY_RE.exec(body))) return `접수처 「${m[0].trim()}」`;
  const mail = schoolMailDest(body, x.school);
  if (mail) return `받는 곳 「${mail}」`;
  if ((m = SCHOOL_RECOMMEND_RE.exec(`${title}\n${body}`))) return `학교 추천 「${m[0].trim()}」`;
  if (x.applyPortal) return `포털 ${x.applyPortal}`;
  const ed = String(x.applyEmail || '').split('@')[1] || '';
  if (domainMatches(ed, x.domain)) return `접수 이메일 도메인 ${ed} (학교)`;
  return null;
}

/* 이메일 도메인이 학교 도메인인가 — 같거나 그 하위(`.`)여야 한다. 맨 endsWith 는 `xkhu.ac.kr` 같은 남의 도메인도 통과시킨다(리뷰 3차). */
export function domainMatches(emailDomain, schoolDom) {
  const e = String(emailDomain || '').toLowerCase(); const d = String(schoolDom || '').toLowerCase();
  return !!(e && d && (e === d || e.endsWith('.' + d)));
}

/* 학교의 인터넷 도메인 — 게시판 주소에서 읽는다(표를 새로 만들지 않는다). news.khu.ac.kr → khu.ac.kr */
export function schoolDomain(boardUrl) {
  try {
    const h = new URL(boardUrl).hostname.toLowerCase();
    const m = h.match(/([a-z0-9-]+\.ac\.kr)$/) || h.match(/([a-z0-9-]+\.(?:edu|kr|com|net|org))$/);
    return m ? m[1] : h;
  } catch { return ''; }
}

/* 학교의 도메인 — 수집 설정에서 읽는다 (2026-10-05 점검 collect-16 · 판정 로봇 둘이 각자 갖던 사본을 하나로).
   schools.json 에 그 학교 게시판 주소가 있으면 그것, 없으면(고려·중앙·부산·계명 — 클릭형이라 브라우저 로봇만 읽는다) browser-targets.json
   targets 의 같은 학교 첫 후보 주소. 둘 다 없으면 ''. 보관(parked) 주소는 보지 않는다 — 쓰지 않게 된 게시판이다.
   예전엔 schools.json 만 봐서 그 네 학교는 '' 가 되어 학교 이메일 신호(emailIsSchool)를 영영 못 썼다(교내 high 가 mid 에 머물렀다).
   🔴 순수 함수 — 부르는 쪽이 두 설정의 배열을 넘긴다. */
export function domainForSchool(school, schools = [], targets = []) {
  const row = (schools || []).find((x) => x && x.school === school && x.boardUrl);
  if (row) return schoolDomain(row.boardUrl);
  const t = (targets || []).find((x) => x && x.school === school && (x.candidates || []).length);
  return t ? schoolDomain(t.candidates[0]) : '';
}

/* 제목에 이 학교의 이름표가 있나 — 정식 이름·별칭·짧은 꼴 가운데 하나 (school-names.mjs schoolTokens) */
export function hasSchoolToken(title, tokens) {
  const t = String(title || '');
  return (tokens || []).find((k) => k && t.includes(k)) || null;
}

/**
 * @param {object} x
 *   title, school, boardTitle, provider — 등록 항목 값
 *   text — 공고 본문 글자(있으면) · excerpts — 원문 발췌 줄들(있으면)
 *   applyEmail, applyPortal — 발췌기가 찾은 접수 이메일·포털
 *   tokens — 이 학교의 이름표(schoolTokens) · domain — 학교 도메인(schoolDomain)
 *   campusMark — match-engine 의 NOTICE_CAMPUS_MARK · own — 고정 표 + 학습 표의 제도 이름 배열
 * @returns {{kind:'교내'|'교외', confidence:'high'|'mid'|'low', evidence:string[], national:boolean}}
 */
export function classifyKind(x = {}) {
  const title = String(x.title || '');
  const body = [x.text || '', ...(Array.isArray(x.excerpts) ? x.excerpts : [])].join('\n');
  const ev = [];
  const orgInTitle = ORG_RE.exec(title);
  const orgInProvider = x.provider && !/원문 확인/.test(x.provider) ? ORG_RE.exec(String(x.provider)) : null;
  const emailDomain = x.applyEmail ? String(x.applyEmail).split('@')[1]?.toLowerCase() : '';
  const emailIsSchool = domainMatches(emailDomain, x.domain);
  const emailIsOutside = !!(emailDomain && !emailIsSchool && !/\.ac\.kr$/.test(emailDomain));
  /* 우편·방문으로 받는 곳이 학교 창구면 맨 「등기우편」 은 재단 쪽 증거가 아니라 학교 창구다(schoolMailDest · 2026-11-23 홍익) */
  const mailToSchool = schoolMailDest(body, x.school);
  const externalApply = EXTERNAL_DIRECT_RE.exec(body) || (mailToSchool ? null : MAIL_APPLY_RE.exec(body));
  const schoolApply = SCHOOL_APPLY_RE.exec(body) || (mailToSchool ? { 0: mailToSchool } : null) || (x.applyPortal ? { 0: `포털 ${x.applyPortal}` } : null);
  const schoolBody = SCHOOL_BODY_RE.exec(body);
  const national = !!(externalApply || emailIsOutside);

  /* ① 표식·표 — 사람이 적어 둔 것이 가장 세다 */
  if (x.campusMark && x.campusMark.test(title)) { ev.push(`제목 표식 「${title.match(x.campusMark)[0]}」`); return { kind: '교내', confidence: 'high', evidence: ev, national: false }; }
  if (OFF_MARK_RE.test(title)) { ev.push(`제목 표식 「${title.match(OFF_MARK_RE)[0]}」`); return { kind: '교외', confidence: 'high', evidence: ev, national }; }
  const own = (x.own || []).find((p) => p && title.includes(p));
  if (own) { ev.push(`학교 제도 표 「${own}」`); return { kind: '교내', confidence: 'high', evidence: ev, national: false }; }

  /* ② 바깥 기관이 제목·주관에 드러나면 교외 */
  if (orgInTitle) ev.push(`제목의 바깥 기관 낱말 「${orgInTitle[0].trim()}」`);
  if (orgInProvider) ev.push(`주관 「${x.provider}」`);
  if (emailIsOutside) ev.push(`접수 이메일 도메인 ${emailDomain} (학교 밖)`);
  if (externalApply) ev.push(`본문 「${externalApply[0].trim()}」`);
  if (orgInTitle || orgInProvider) return { kind: '교외', confidence: 'high', evidence: ev, national };
  if (emailIsOutside || externalApply) return { kind: '교외', confidence: 'mid', evidence: ev, national };

  /* ③ 학교 이름표 + 학교가 준다는 본문 → 교내 */
  const token = hasSchoolToken(title, x.tokens);
  if (token) ev.push(`제목의 학교 이름표 「${token}」`);
  if (schoolBody) ev.push(`본문 「${schoolBody[0].trim()}」`);
  if (emailIsSchool) ev.push(`접수 이메일 도메인 ${emailDomain} (학교)`);
  if (schoolApply) ev.push(`접수처 「${String(schoolApply[0]).trim()}」`);
  /* 🔴 high 는 '학교가 준다'는 본문(SCHOOL_BODY_RE)이 있을 때, 또는 약한 신호(학교 이메일·학교 창구)가 **둘** 겹칠 때만.
     창구 하나만으로는 mid — 학교 창구는 바깥 재단 사업도 쓴다(2026-09-30 리뷰 3차 · 학습 표에 들어가는 문턱이라 더 엄하다). */
  const weak = [emailIsSchool, schoolApply].filter(Boolean).length;
  if (token && (schoolBody || weak >= 2)) return { kind: '교내', confidence: 'high', evidence: ev, national: false };
  if (token) return { kind: '교내', confidence: 'mid', evidence: ev, national: false };
  /* 학교 이름표 없이 본문 낱말만으로는 교내로 보지 않는다 — 실측(2026-09-30 첫 시험): 사랑나눔·익산사랑·삼원·푸른등대처럼
     바깥 재단 사업도 학교 게시판 본문엔 '발전기금'·'포털' 메뉴 글자가 섞여 나온다. 껍데기를 걷어내도 학교가 옮겨 적은
     안내문에는 장학팀·포털이 흔하다. 그건 '학교가 접수한다'는 뜻이지 '학교가 준다'는 뜻이 아니다. */

  /* ④ 증거 없음 → 교외(기본값 · 2026-09-18 결정) */
  if (!ev.length) ev.push('교내 증거 없음 — 기본값');
  return { kind: '교외', confidence: 'low', evidence: ev, national };
}

/* 학습 표에 넣을 제도 이름 — 제목에서 대괄호·연도·학기·꼬리말을 떼고 남는 것. 8자 미만이면 배우지 않는다(흔한 이름이 표를 오염시킨다). */
export function programNameForTable(title, tokens = []) {
  let t = String(title || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').replace(/20\d{2}\s*(학년도|년도|년)?|\d\s*학기|(상|하)반기|제?\s*\d+\s*(회|기|차)/g, ' ');
  t = t.replace(/\s+/g, ' ').replace(/^[\s\-–—•·○●■□▶▷※*]+/, '').trim();
  for (let i = 0; i < 3; i++) t = t.replace(/(참여자|참가자|장학생|대상자|학생)?\s*(추가\s*)?(선발|모집|신청|접수|추천|지원)\s*(계획|안내|공고|공지)?(\s*(안내|공고|공지))?$/, '').trim();
  t = t.replace(/[~〜:：_\-\s]+$/, '').trim();
  if (ORG_RE.test(t)) return null;
  /* 학교 이름표가 든 이름(동국리더장학·경희꿈도전장학)은 짧아도 그 학교 것이 분명하다 · 이름표가 없으면 8자 이상만(흔한 이름 방지) */
  const branded = (tokens || []).some((k) => k && t.includes(k));
  return (branded && t.length >= 4) || t.length >= 8 ? t : null;
}
