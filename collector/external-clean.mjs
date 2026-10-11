/* ============================================================
   재단·지자체 게시판 글 다듬기 — **한 곳** (2026-10-01 개발자 지시 "옛날 글 빼고 제목도 고쳐줘")
   ------------------------------------------------------------
   왜 필요한가
     재단 홈페이지 게시판은 학교 게시판과 생김새가 제각각이라, 목록 한 줄(<a>)에
     번호·게시일·본문 미리보기·HTML 주석 부스러기가 제목과 함께 딸려 왔다(실측 156건 중 긴 제목 31건).
     또 처음 읽는 게시판은 **몇 년 치 글을 한꺼번에** 주는데 전부 오늘 수집(foundAt)으로 찍혀
     홈 「재단·지자체 새 공고」 맨 위에 2002~2025년 글·합격자 발표·재단 메뉴('오시는 길')가 떴다.
   무엇을 하나
     tidyExternal(n) — 제목에서 부스러기를 떼고, 줄에 적힌 게시일을 postedAt 으로 옮긴다.
     dropReason(n, today) — 학생이 '신청하러 갈' 글이 아니면 이유를 돌려준다(아니면 null).
   🔴 수집 로봇이 **발행할 때마다** 전체에 다시 건다(collect.mjs) — 이 파일은 합집합 병합(jsonunion)이라
      병합이 지운 글을 되살려도 다음 실행이 다시 거른다. 앱에서 따로 거르지 않는다(규칙이 두 벌이 된다).
   ⚠️ 날짜가 없는 글(삼원·지헌 '제 19기' 등)은 옛 글인지 **모른다** — 짐작해 빼지 않는다(원칙 8-1).
   마감(deadline)을 읽은 글은 마감 다음 날까지만 남긴다(2026-10-05 점검 collect-09 — 송파 상반기 06-24·음성 09-18 이 홈 「재단·지자체 새 공고」에
   몇 달 떠 있었다). 마감 칸이 없는 옛 글은 원문 기간 줄(deadlineHint)에서 같은 판독기로 채운다(fillDeadlineFromHint · 판독기는 부르는 쪽이 넘긴다).
   회차가 둘 이상인 기간 줄은 마지막 회차의 끝으로 판정한다(lastRoundEnd · 2026-10-11 점검 feeds-R2 — 1차 마감으로 2차가 열린 공고를 지웠다).
   이 파일은 불러와도 아무것도 실행하지 않고 아무것도 불러오지 않는다(검사·병합기·감사가 그대로 돌려 본다).
   ============================================================ */

/* 게시일이 이보다 오래된 글은 '새 공고'가 아니다 — 장학 공고는 학기 단위라 넉 달이면 지난 학기다 */
export const EXT_OLD_DAYS = 120;

const DATE = /(20\d{2})[-.]\s?(\d{1,2})[-.]\s?(\d{1,2})\.?/;
const iso = (m) => `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;

/* 미리보기가 붙은 줄을 제목에서 끊는 자리 — 제목이 흔히 끝나는 말 뒤의 빈칸 */
/* ⚠️ '선발'은 넣지 않는다 — 제목 한가운데 흔하다('장학생 선발 명단'이 '…선발'에서 잘려 명단 글이 살아남았다).
   괄호 꼬리('공고(대학생)')는 제목에 붙여 둔다. */
const TITLE_END = /(공고|안내|모집|발표|알림|접수|명단|습니다|합니다)(\([^)]*\))?(?=\s)/g;

export function tidyTitle(raw) {
  let t = String(raw || '');
  let postedAt = null;
  /* ① HTML 주석 부스러기 — "X --> --> --> X" 는 앞쪽 X 만 남긴다 */
  t = t.replace(/<!--/g, ' ').replace(/^(\s*-->\s*)+/, '');
  if (t.includes('-->')) t = t.split('-->')[0];
  /* ② 꼬리: '더보기'·'New' 와 게시일 */
  t = t.replace(/\s*(더보기|New)\s*$/i, '').replace(/\s*(더보기|New)\s*$/i, '');
  const tail = t.match(new RegExp(`\\s+${DATE.source}\\s*$`));
  if (tail) { postedAt = iso(tail); t = t.slice(0, tail.index); }
  /* ③ 머리: 목록 번호(1~3자리) · 앞에 놓인 게시일 · 분류 낱말 '사항' */
  t = t.replace(/^\s*\d{1,3}\s+(?=\S)/, '');
  const head = t.match(new RegExp(`^\\s*${DATE.source}\\s+`));
  if (head) { postedAt = postedAt || iso(head); t = t.slice(head[0].length); }
  t = t.replace(/^사항\s+/, '');
  /* ④ 본문 미리보기 — 줄 가운데 말줄임표가 있으면 거기까지가 제목이다(게시판이 잘라 둔 제목) */
  t = t.replace(/\s+/g, ' ').trim();
  const mid = t.search(/(\.\.\.|…)\s+\S/);
  if (mid > 0) t = t.slice(0, mid).trim() + '…';
  else if (t.length > 60 || /(\.\.\.?|…)$/.test(t)) {
    /* 끝에 미리보기가 붙은 줄 — 제목이 흔히 끝나는 말 뒤에서 끊는다(8자 넘는 첫 자리) */
    TITLE_END.lastIndex = 0;
    let m;
    while ((m = TITLE_END.exec(t)) !== null) {
      const end = m.index + m[0].length;
      if (end >= 8) { t = t.slice(0, end).trim(); break; }
    }
  }
  t = t.replace(/\.{2,}$/, '…').replace(/\s+/g, ' ').trim();
  return { title: t, postedAt };
}

export function tidyExternal(n) {
  const { title, postedAt } = tidyTitle(n.title);
  const out = { ...n, title };
  if (postedAt && !n.postedAt) out.postedAt = postedAt;
  return out;
}

/* 학생이 신청하러 갈 글이 아니다 — 결과·명단·행정·언론·재단 소개 */
const NOT_APPLY = /합격자|선발\s?결과|선정\s?결과|심사\s?결과|선발\s?장학생\s?(발표|명단)|장학생\s?(발표|명단)|수혜자\s?(선정\s?)?발표|선정\s?발표|선정하였|선발하였|수령\s?(방법|안내)|결산|공시|채용|이사회|간담회|별세|기부|약정|수여|최고장|환수금|예정\s?없음|명단|비상임이사|기탁|장학기금/;
const SITE_MENU = /확인해\s?보세요|확인하실\s?수|한눈에 보실|오시는\s?길|포토갤러리|카카오채널|친구추가|장학증서\s?(조회|출력)|리뉴얼|업그레이드 작업|후기입니다/;

/* 게시판이 제목 머리에 단 마감 표식 — 「[마감] '원거리 진학 대학생 주거 장학금' 대상자 모집」(고속도로장학재단) · 「(모집마감) …」.
   「[마감임박]」은 아직 열린 글이라 남긴다. */
const CLOSED_MARK = /^\s*[\[［(（]\s*(?:모집\s*)?마감\s*[\]］)）]/;

/* 하루 앞 날짜 (YYYY-MM-DD) — 마감 다음 날까지는 남긴다: 앱 장학·활동 목록의 CLOSED_KEEP_DAYS(=1 · '마감 다음 날까지')와 같은 뜻 */
const dayBefore = (today) => new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

/* ── 회차가 둘 이상인 기간 줄 (2026-10-11 점검 feeds-R2) ──
   `신청기간: 1차 2026. 9. 1. ~ 9. 15. / 2차 2026. 10. 1. ~ 10. 31.` — 마감 판독기(extractDeadline)는 **첫 회차의 끝**(09-15)을 마감으로 읽는다.
   그 날로 '마감 지남'을 걸면 2차 접수가 열려 있는 공고가 1차 이틀 뒤 지워지고, seen-external 장부에 남아 다음 수집에도 돌아오지 않는다.
   판독기를 새로 만들지 않는다 — 여기서는 **날짜가 딸린 회차 꼬리표(`1차 … 날짜`)가 둘 이상인가**와 **마지막 회차의 끝 날짜**만 본다.
   끝 날짜는 `~` 뒤(또는 `까지` 앞)의 날짜뿐이고, 해가 없으면 그 줄 앞쪽 날짜의 해를 물려받는다. 날 뒤에 마침표·`일`·괄호·빈칸이 없으면
   (줄이 80자에서 잘린 `~ 3.`·`~ 2026.10.2`) 못 읽은 것으로 둔다 — 짐작해 이른 날로 지우지 않는다(원칙 8-1).
   `1차 서류전형 > 2차 면접` 처럼 날짜가 안 딸린 회차는 세지 않는다(선발 단계이지 접수 회차가 아니다). */
const ROUND_MARK = /(?<!\d)\d{1,2}\s*차(?![가-힣])/g;
const FULL_YMD = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?=\s*[.일(\s])/g;
const ymdOk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
const DATED = /^[^~∼～]{0,20}?(?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2}/;
/** 회차 줄이 아니면 undefined · 회차 줄이면 마지막 회차의 끝 날짜(YYYY-MM-DD) · 그 끝을 못 읽으면 null */
export function lastRoundEnd(hint) {
  const s = String(hint || '');
  const marks = [...s.matchAll(ROUND_MARK)];
  const dated = marks.map((m, i) => ({ at: m.index + m[0].length, end: i + 1 < marks.length ? marks[i + 1].index : s.length }))
    .filter((r) => DATED.test(s.slice(r.at, r.end)));
  if (dated.length < 2) return undefined;
  const last = dated[dated.length - 1];
  let out = null;
  /* 마지막 회차 칸 안에서 `~` 뒤 날짜(시각 범위 `13:00~15:30` 은 날짜가 아니라 건너뛴다) · `날짜 까지` */
  for (const m of s.slice(last.at, last.end).matchAll(/[~∼～]\s*((?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2})(?=\s*[.일(\s])|((?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2})\s*[.일]?\s*(?:\([^)]{0,4}\)\s*)?(?:\d{1,2}:\d{2}\s*)?까지/g)) {
    const raw = m[1] || m[2];
    const pos = last.at + m.index;
    const nums = raw.match(/\d+/g).map(Number);
    let y; let mo; let d;
    if (nums.length === 3) [y, mo, d] = nums;
    else {
      /* 해 없는 끝 날짜 — 그 줄에서 이보다 앞에 나온 마지막 온전한 날짜의 해 · 그 날짜보다 앞서면 다음 해(12월 ~ 1월) */
      const anchors = [...s.slice(0, pos).matchAll(FULL_YMD)];
      if (!anchors.length) continue;
      const a = anchors[anchors.length - 1];
      [mo, d] = nums;
      y = Number(a[1]);
      if (mo * 100 + d < Number(a[2]) * 100 + Number(a[3])) y += 1;
    }
    const v = ymdOk(y, mo, d);
    if (v) out = v;
  }
  return out;
}

/* 마감 칸이 없는 글에 원문 기간 줄(deadlineHint)에서 마감을 채운다 — 수집 때와 **같은 판독기**를 부르는 쪽이 넘긴다
   (collect.mjs: activityExcerpts(t).deadline · 이 파일은 아무것도 불러오지 않는다). 이미 마감이 있는 글은 건드리지 않는다.
   247b89f9 이전에 실린 글(영동 09-18 · 김해 03-20)은 마감 칸이 없어 '마감 지남' 규칙을 비켜 갔다(점검 api-01 ①). 바뀌면 true.
   회차가 둘 이상인 줄(lastRoundEnd)은 채우지 않는다 — 판독기는 첫 회차의 끝을 읽어, 학생 화면에 2차가 열린 공고를 '마감'으로 보인다(feeds-R2). */
export function fillDeadlineFromHint(n, deadlineOf) {
  if (!n || n.deadline || !n.deadlineHint || typeof deadlineOf !== 'function') return false;
  if (lastRoundEnd(n.deadlineHint) !== undefined) return false;
  const d = deadlineOf(n.deadlineHint);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return false;
  n.deadline = d;
  return true;
}

export function dropReason(n, today) {
  const t = String(n.title || '');
  if (!t || t.replace(/\s/g, '').length < 6) return '제목 없음';
  if (SITE_MENU.test(t)) return '재단 메뉴';
  if (NOT_APPLY.test(t)) return '결과·행정 글';
  /* 해도 신청 낱말도 없는 줄은 공고가 아니라 재단·제도 소개 메뉴다('국가장학금 I유형(학생직접지원형)' ·
     '모범 화물운전자 자녀 장학금') — 신청하러 갈 공고는 둘 중 하나는 적는다 */
  if (!/20\d{2}/.test(t) && !/모집|선발|신청|공고|안내|접수|마감|공모|알림/.test(t)) return '소개 글';
  /* 🔴 이유 글자에 숫자를 넣지 말 것 — collect.mjs 집계(extDropped)가 숫자 든 이유를 '옛 글'로 뭉친다 */
  if (CLOSED_MARK.test(t)) return '마감 표식';
  if (n.deadline && String(n.deadline) < dayBefore(today)) {
    /* 회차가 둘 이상인 기간 줄이면 마감 칸(첫 회차의 끝일 수 있다)이 아니라 마지막 회차의 끝으로 본다 · 그 끝을 못 읽으면 마감으로는 지우지 않는다(feeds-R2) */
    const end = lastRoundEnd(n.deadlineHint);
    if (end === undefined || (end && end < dayBefore(today))) return '마감 지남';
  }
  const now = new Date(`${today}T00:00:00Z`);
  if (n.postedAt) {
    const age = (now - new Date(`${n.postedAt}T00:00:00Z`)) / 86400000;
    if (age > EXT_OLD_DAYS) return `게시 ${n.postedAt} (옛 글)`;
  }
  /* 게시일이 없으면 제목의 연도로 — 적힌 해가 전부 올해보다 앞이면 지난 공고다
     ('2026-2027' 처럼 올해 이후가 하나라도 있으면 남긴다) */
  const years = (t.match(/20\d{2}(?!\d)/g) || []).map(Number);
  if (years.length && Math.max(...years) < now.getUTCFullYear()) return `${Math.max(...years)}년 글`;
  return null;
}
