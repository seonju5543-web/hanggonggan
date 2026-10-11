/* 자동 등록의 '때' 규칙 — 제목 연도 · 차년도 계획 · 오래된 글 (2026-10-11 점검 gap-07 · gap-bf-3) — **한 곳**

   🔴 이 파일에는 실행 코드가 없다(불러도 아무것도 읽고 쓰지 않는다) — 불러오는 순간 실행되는 auto-register.mjs 대신
      관문(verify/health-gates/qnotice.mjs ⑨)이 표본으로 잰다(notice-deadline.mjs 와 같은 까닭).
   🔴 기준 연도는 부르는 쪽이 넘기는 **오늘**(KST 'YYYY-MM-DD')에서 그때그때 읽는다 — 연도를 상수로 박지 말 것.
      예전엔 자동 등록에 `y >= 2027` 이 박혀 있어 10월부터 내년도 장학생 모집(대산농촌재단 ~11/11 · 아산 ~10/26 · 해동 ~10/28 …)을
      전부 컨펌 대기로 돌렸고(10-11 실측 보류 166건 중 90건), 2027-01-01 부터는 '2027학년도 1학기 …' 글이 거의 다 걸려
      자동 등록이 사실상 멈출 참이었다(로봇 등록분 172건 중 164건이 제목에 연도를 단다). 차년도 계획 규칙(`202[7-9]…`)도 같은 꼴이었다. */

const yearOf = (today) => Number(String(today || '').slice(0, 4)) || 0;

/** 제목의 연도들 — 숫자에 붙은 20xx(글 번호 등)는 연도가 아니다 · 학년도 범위 `2027-2028`(스위스 정부초청)은 앞 해 하나로 본다. */
export function titleYears(title) {
  const t = String(title || '').replace(/(?<!\d)(20\d{2})\s*[-~∼〜～]\s*(20\d{2})(?!\d)/g, (m, a, b) => (Number(b) === Number(a) + 1 ? a : m));
  return [...t.matchAll(/(?<!\d)(20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
}

/** 차년도 계획·신입학 — `<오늘의 다음 해 이후>학년도·년 … 유학·연수·입학·신입학` · `신입학` · `입학전형` (현 재학생 신청 대상이 아니다) */
export function futurePlan(title, today) {
  const t = String(title || '');
  if (/신입학|입학전형/.test(t)) return true;
  const Y = yearOf(today);
  if (!Y) return false;
  return [...t.matchAll(/(?<!\d)(20\d{2})(?!\d)(?=[^\d]*(?:학년도|년).*(?:유학|연수|입학|신입학))/g)].some((m) => Number(m[1]) >= Y + 1);
}

/* ── 같은 사업으로 보이는 다른 글(형제) ──
   내년도 사업은 한 재단 공고가 수십 개 학교 게시판에 제각기 다른 제목으로 올라온다. 같은 사업 판정(entry-rules programKey)은
   그 변형을 한 사업으로 못 묶는다 — 10-11 실측: 대산농촌재단 넷이 `대산농촌재단대산` · `대산농촌재단장학생선발안내까지)` · (없음) · (없음).
   그래서 연도 보류만 풀면 한 실행에 같은 재단이 학교마다 따로 2~4건 등록됐다(점검 반박 실측). 내년도 글은 형제가 있으면 보류한다.
   🔴 일부러 느슨하다 — 형제로 잘못 보면 보류(예전과 같다)이고, 놓치면 같은 사업이 학교마다 따로 등록된다. */
/* 게시판 붙박이 말로만 된 덩어리 — 이것끼리 같다고 같은 사업이 아니다 */
const STOCK = /^(?:공통|교외|교내|홍보|장학|장학생|장학금|장학사업|신규|추가|선발|모집|안내|공고|공지|신청|접수|추천|지원|년도|학년도|학년|학기|까지|마감|대학|대학생|대학원|학생|학부|생|재학|신입|복학|편입|졸업|휴학|생활비|등록금|학자금|대출|구제|재단|법인|사단|학교|등록|분야|계열|전공|공학|이공계|이공|인문|자연|예체능|정부|초청|팀|글로벌|서울|국제|하반기|상반기|봄학기|가을학기|파견|교환|해외|진학|예정자|기간|연장|긴급|필독|재공고|수정|최대|만원|전액|학업|장려금|기금|발전|국가|일반|특별|성적|우수)+$/;
/** 이름 낱말 — 연도·숫자·기호를 걷고 남은 한글·영문 덩어리 가운데 3자 이상이고 붙박이 말로만 되지 않은 것 */
export function nameTokens(title) {
  return [...new Set(String(title || '').replace(/(?<!\d)20\d{2}(?!\d)/g, ' ').split(/[^가-힣A-Za-z]+/)
    .filter((w) => w.length >= 3 && !STOCK.test(w)))];
}
/** 같은 사업으로 보이는가(느슨하게) — 같은 이름 낱말이 있거나, 4자 이상 낱말이 다른 쪽 낱말 안에 들어 있으면(`북한이탈청소년` ⊂ `북한이탈청소년장학생`) 같다고 본다.
 *  3자 낱말은 같을 때만 — 안에 든 것까지 보면 `학부생` 같은 말 하나로 남의 사업이 묶인다(만들면서 실측). */
export function looksSameProgram(a, b) {
  const A = nameTokens(a);
  const B = nameTokens(b);
  const inside = (big, small) => small.length >= 4 && big.includes(small);
  return A.some((x) => B.some((y) => x === y || inside(x, y) || inside(y, x)));
}

/**
 * 제목 연도로 본 보류 — null(보류 아님) 또는 { why }.
 *   · 올해+2 이후 → 보류
 *   · 올해+1(내년도 사업) → 마감을 읽었고 그 마감이 **오늘 ~ 올해 12-31** 안일 때만 통과. 마감을 못 읽었거나 올해 밖이면 보류.
 *     같은 사업으로 보이는 다른 글(형제)이 있으면 보류 — `sibling` 은 그 글을 한 줄로 말한 값(또는 그 값을 내는 함수 · 필요할 때만 부른다).
 *   · 올해 이전·올해 → 보류 아님(이 규칙과 상관없다)
 * 마감이 이미 지난 글은 부르는 쪽이 먼저 '마감 경과'로 거른다(여기서도 지난 마감은 통과시키지 않는다).
 */
export function yearHold({ title, deadline, today, sibling } = {}) {
  const Y = yearOf(today);
  const ys = titleYears(title);
  if (!Y || !ys.length) return null;
  const top = Math.max(...ys);
  if (top >= Y + 2) return { why: `${top}년 사업으로 보임(올해+2 이후) — 개발자 컨펌 대기` };
  if (top !== Y + 1) return null;
  if (!deadline) return { why: `${top}년(내년도) 사업인데 마감을 못 읽음 — 개발자 컨펌 대기` };
  if (deadline < String(today) || deadline > `${Y}-12-31`) return { why: `${top}년(내년도) 사업 · 마감 ${deadline} 이 오늘~올해 안이 아님 — 개발자 컨펌 대기` };
  const sib = typeof sibling === 'function' ? sibling() : sibling;
  if (sib) return { why: `${top}년(내년도) 사업 · 같은 사업으로 보이는 다른 글(${String(sib).slice(0, 40)})이 있어 학교마다 따로 등록되지 않게 컨펌 대기` };
  return null;
}

/**
 * 오래된 글 보류 — 수집한 지(foundAt) `days` 일이 넘은 글인데 마감을 못 읽었으면 보류(원칙 2 보수적 규칙 · gap-bf-3).
 * 피드를 메우는 길(publish-notices healFromLedger · heal-feed.mjs)은 예전에 수집한 글을 수집일 그대로 되살린다 — 그 가운데 마감을 못 읽는 글은
 * 이미 끝난 공고일 수 있다. 10-11 실측: 지금 로봇 등록분 가운데 이 규칙에 걸렸을 것은 1건뿐이고(수집 08-18 → 등록 09-30 ·
 * `…근로장학생(국가,교내) 모집_모집완료` · 마감 08-24) 그것도 지난 공고였다 — 상시 제도는 막지 않았다.
 */
export function staleHold({ foundAt, deadline, today, days = 30 } = {}) {
  if (deadline || !foundAt || !today) return null;
  const age = Math.floor((Date.parse(String(today).slice(0, 10)) - Date.parse(String(foundAt).slice(0, 10))) / 86400000);
  if (!(age > days)) return null;
  return { why: `수집한 지 ${age}일 된 글인데 마감을 못 읽음 — 이미 끝난 공고일 수 있어 컨펌 대기` };
}
