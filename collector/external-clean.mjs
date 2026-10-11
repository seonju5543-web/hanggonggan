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
   판독기를 새로 만들지 않는다 — 여기서는 **접수 회차가 둘 이상인가**와 **마지막 회차의 끝 날짜**만 본다.
   · 접수 회차 = 회차 꼬리표(`1차`) 바로 뒤에 날짜가 딸리고, 그 칸에 **기간 표식**(`~` 뒤 날짜 · 날짜 뒤 `까지`·`마감`)이 있는 칸.
     `1차 서류심사 결과발표: 9. 22.`·`2차 면접: 9. 26.` 처럼 날짜 하나뿐인 선발 단계는 세지 않는다(리뷰 2026-10-11 — 세면 끝을 못 읽어 영영 안 지웠다).
     줄 끝에서 잘린 칸(`2차(3종) : 2026. 3. 23.(월)` — 힌트는 80자에서 자른다)은 기간 표식이 잘렸을 수 있어, 선발 단계 낱말이 없으면 끝을 모르는 회차로 센다.
   · 끝 날짜 = 마지막 회차 칸의 `~` 뒤(또는 `까지`·`마감` 앞) 날짜 중 가장 늦은 것. 해가 없으면 그 줄 앞쪽 날짜의 해를 물려받는다(12월 ~ 1월은 다음 해).
   · 줄 끝에서 잘린 끝 날짜는 **그 글자로 가능한 가장 늦은 날**(상한)로 본다 — 짐작이 아니라 상한이다(리뷰 2026-10-11: 김해 상반기 `~ 3.` 을
     못 읽어 3월 공고가 수집일 60일까지 떴다). `~ 3.` → 그 달 말일 · `~ 2026.10.2` → 10-29 · `~ 3. 25` → 3-25. 달도 못 읽으면(`~`·`~ 1`·`~ 2026.`) 모른다(null). */
const ROUND_MARK = /(?<!\d)\d{1,2}\s*차(?![가-힣])/g;
const FULL_YMD = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})(?=\s*[.일(\s])/g;
const ymdOk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
const DATED = /^[^~∼～]{0,20}?(?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2}/;
/* 기간 표식 — `~` 뒤가 숫자(시각 `~ 15:00` 은 아니다)이거나 줄 끝(잘림) · 날짜 가까이 뒤의 `까지`·`마감` */
const PERIOD_MARK = /[~∼～]\s*(?:$|(?!\d{1,2}\s*:)\d)|\d[\d\s.:일()월화수목금토]{0,16}(?:까지|마감)/;
const STAGE_WORD = /발표|면접|심사|결과|합격|시험|평가|통보|선정/;
const maxDay = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
/* 해 없는 날짜가 해를 물려받을 날짜 — 그 줄에서 pos 앞에 나온 마지막 온전한 날짜 { y, m, d } · 없으면 null */
function anchorBefore(s, pos) {
  const anchors = [...s.slice(0, pos).matchAll(FULL_YMD)];
  if (!anchors.length) return null;
  const a = anchors[anchors.length - 1];
  return { y: Number(a[1]), m: Number(a[2]), d: Number(a[3]) };
}
/* 해 없는 끝 날짜의 해 — 물려받은 날짜보다 앞서면 다음 해(12월 ~ 1월) */
function yearFor(s, pos, mo, d) {
  const a = anchorBefore(s, pos);
  return a ? a.y + (mo * 100 + d < a.m * 100 + a.d ? 1 : 0) : null;
}
/* 줄 끝에서 잘린 끝 날짜의 상한. 날짜 조각이 아니면 undefined · 조각인데 달을 못 읽으면 null */
function cutEndMax(s, pos, tail) {
  const t = tail.trim();
  if (/^(?:\d{0,4}|20\d{2}\s*[.\-/년])$/.test(t)) return null;   // `~` · `~ 1` · `~ 2026.` — 달을 모른다
  const m = t.match(/^(?:(20\d{2})\s*[.\-/년]\s*)?(\d{1,2})(?:\s*([.\-/월])\s*(\d{0,2}))?$/);
  if (!m) return undefined;
  const [, y, mo, sep, d] = m;
  /* 달 후보 — 구분 글자가 붙었으면 그 달 · 해 뒤에 숫자만 있으면 이어질 수 있다(`1` → 1·10·11·12 · `0` → 01~09) */
  const months = sep ? [Number(mo)] : mo === '1' ? [1, 10, 11, 12] : mo === '0' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [Number(mo)];
  const a = y ? null : anchorBefore(s, pos);
  if (!y && !a) return null;
  let best = null;
  for (const mm of months) {
    if (mm < 1 || mm > 12) continue;
    /* 날 후보 — 없으면 그 달 전부 · 한 자리면 그 날과 이어질 수 있는 두 자리(2 → 2·20~29 · 0 → 01~09) · 두 자리면 그 날 */
    const days = [];
    for (let dd = 1; dd <= 31; dd++) {
      const ds = String(dd).padStart(2, '0');
      if (!d || (d.length === 1 ? ds[0] === d || dd === Number(d) : ds === d)) days.push(dd);
    }
    for (const dd of days) {
      /* 해 없는 후보 — 앞선 달이면 다음 해(12월 ~ 1월) · 같은 달에서 시작보다 앞선 날은 끝이 될 수 없어 후보가 아니다
         (`3. 23. ~ 3.` 의 3월 1~22일을 다음 해로 넘기면 상한이 이듬해 3월이 된다) */
      if (a && mm === a.m && dd < a.d) continue;
      const yy = y ? Number(y) : a.y + (mm < a.m ? 1 : 0);
      if (dd > new Date(Date.UTC(yy, mm, 0)).getUTCDate()) continue;
      best = maxDay(best, ymdOk(yy, mm, dd));
    }
  }
  return best;
}
/** 회차 줄이 아니면 undefined · 회차 줄이면 마지막 회차의 끝 날짜(YYYY-MM-DD · 잘렸으면 상한) · 그 끝을 못 읽으면 null */
export function lastRoundEnd(hint) {
  const s = String(hint || '');
  const marks = [...s.matchAll(ROUND_MARK)];
  const rounds = marks.map((m, i) => ({ at: m.index + m[0].length, end: i + 1 < marks.length ? marks[i + 1].index : s.length }))
    .filter((r) => {
      const cell = s.slice(r.at, r.end);
      if (!DATED.test(cell)) return false;
      if (PERIOD_MARK.test(cell)) return true;
      return r.end === s.length && !STAGE_WORD.test(cell);   // 줄 끝에서 잘린 칸 — 기간 표식이 잘렸을 수 있다
    });
  if (rounds.length < 2) return undefined;
  const last = rounds[rounds.length - 1];
  const cell = s.slice(last.at, last.end);
  let out = null;
  /* 마지막 회차 칸 안에서 `~` 뒤 날짜(시각 범위 `13:00~15:30` 은 날짜가 아니라 건너뛴다) · `날짜 까지`·`날짜 마감` */
  for (const m of cell.matchAll(/[~∼～]\s*((?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2})(?=\s*[.일(\s])|((?:20\d{2}\s*[.\-/년]\s*)?\d{1,2}\s*[.\-/월]\s*\d{1,2})\s*[.일]?\s*(?:\([^)]{0,4}\)\s*)?(?:\d{1,2}:\d{2}\s*)?(?:까지|마감)/g)) {
    const raw = m[1] || m[2];
    const nums = raw.match(/\d+/g).map(Number);
    let y; let mo; let d;
    if (nums.length === 3) [y, mo, d] = nums;
    else {
      [mo, d] = nums;
      y = yearFor(s, last.at + m.index, mo, d);
      if (!y) continue;
    }
    out = maxDay(out, ymdOk(y, mo, d));
  }
  /* 줄 끝에서 잘린 끝 날짜 — 그 글자로 가능한 가장 늦은 날. 달을 못 읽으면 끝을 모른다(null) */
  if (last.end === s.length) {
    const cut = cell.match(/[~∼～]([^~∼～]*)$/);
    if (cut) {
      const ub = cutEndMax(s, last.at + cut.index, cut[1]);
      if (ub === null) return null;
      if (ub) out = maxDay(out, ub);
    }
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
  /* 회차가 둘 이상인 기간 줄이면 마감 칸(첫 회차의 끝일 수 있다)이 아니라 마지막 회차의 끝(잘렸으면 상한)으로 본다 — 마감 칸이 없어도(채우지 않는다) ·
     그 끝을 못 읽으면 마감으로는 지우지 않는다(feeds-R2) · 마감 칸이 더 늦으면 그 날 */
  const roundEnd = lastRoundEnd(n.deadlineHint);
  const closeDay = roundEnd === undefined ? n.deadline : roundEnd && maxDay(roundEnd, n.deadline || null);
  if (closeDay && String(closeDay) < dayBefore(today)) return '마감 지남';
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
