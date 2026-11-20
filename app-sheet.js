/* app-sheet.js — 상세 시트(공고 상세·자격 묻기·시트 되돌아가기) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
/* ---------------- 상세 바텀시트 ---------------- */
/* 「학교 포털」이 어디인지 알려 주는 한 줄 (백로그 UI-20 · 2026-09-14)

   바로 위 안내 1단계가 예전부터 "학교 포털 장학 메뉴에서 접수 방법 확인"이라고 말해 왔는데
   그 포털이 어디인지는 앱 어디에도 없었다 — 학교마다 다르다(data.js `SCHOOL_PORTALS`).

   🔴 **이 공고의 제출처라고 말하지 않는다.** `eligibility.schoolOnly` 는 '이 학교 학생에게만
      보인다'는 뜻이라, 학교 게시판에 올라온 교외·국가 공고가 전부 여기 들어 있다(실측 35건 중
      12건). 그래서 문장은 '교내 장학금은 여기서 신청한다' + '이 공고의 접수 방법은 원문을
      따르라' 둘로 나뉜다. 하나로 합쳐 "여기에 제출하세요"가 되면 앱이 같은 화면에 인용한
      원문(`www.kosaf.go.kr 을 통하여 신청`)과 반대되는 말을 단정하게 된다(원칙 8-1).
   🔴 표에 없는 학교는 지어내지 않고 **아무것도 안 띄운다.**
   관문: verify/test-collector.mjs '학교 장학 신청 포털' 절. */
function schoolPortalNote(sch) {
  /* 🔴 **공고가 시스템을 말했으면 그 시스템으로 보낸다** (2026-09-23).
     예전에는 학교 포털 주소 하나만 줬는데, 한국외대는 시스템이 둘이라(신청 HUFS Ability ·
     계좌 종합정보시스템) 학교로만 고르면 엉뚱한 화면으로 보낸다.
     🔴 **길은 우리가 쓰지 않는다** — 원문에 통째로 적혀 있으므로 그 문장을 그대로 보여 준다
        (원칙 8-1). 우리가 다시 쓰면 그 순간 추론이 되고, 학교가 메뉴를 바꾸면 거짓이 된다.
     🔴 주소를 모르는 시스템은 **이름만** 말한다(틀린 링크보다 낫다). */
  const sys = portalSystemInfo(sch);
  if (sys) {
    const where = sys.url
      ? `<a href="${esc(safeUrl(sys.url))}" target="_blank" rel="noopener">${esc(sys.label)} ↗</a>`
      : `<b>${esc(sys.label)}</b>`;
    /* 🔴 인용은 **이미 있는 `.r-quote`** 를 쓴다 (2026-08-02 에 '원문 그대로 옮긴 문장'
       용도로 만들어졌는데 아무 데서도 안 쓰이고 있었다). 새 이름을 지어내면 CSS 가 없어
       스타일 없는 글이 앞 문장에 붙어 나온다 — 만들면서 실제로 그렇게 했다가 잡았다.
       ⚠️ 블록 스타일(padding-left·border-left)이라 `<span>` 이 아니라 `<p>` 여야 먹는다. */
    const path = sch.applyPortalSource
      ? `<p class="r-quote">공고 원문 그대로 — 「${esc(sch.applyPortalSource)}」</p>` : '';
    return `<p class="dp-note">${where}에서 신청합니다.</p>${path}`;
  }
  const p = schoolPortal(sch);
  if (!p) return '';
  return `<p class="dp-note">교내 장학금은 <a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.label)} ↗</a>에서 신청합니다. 이 공고의 접수 방법은 위 안내와 공고 원문을 따라 주세요.</p>`;
}

/* '자세한 내용은 ○○ ↗에서 확인' 한 줄 — 공고 상세와 신청 준비 시트가 같이 쓴다.
   🔴 링크 이름은 그 주소가 **실제로 여는 화면**을 말한다(아래 openDetail 의 두 문단 참조).
      시트마다 따로 적으면 한쪽만 '원문 공고'라고 거짓말하게 된다. */
/* ── 「공고 안내」 — 원문 발췌를 **읽을 수 있는 몇 줄**로 (2026-10-15 개발자 지시 ⑤ "원문 글을 그대로 긁어 … 원문 그대로 원칙을 바꿔라").
   예전엔 발췌(excerpts)를 「공고 원문 안내 · 원문 그대로」 머리 아래 줄 단위로 그대로 쏟았다 — 글머리 기호(`8) 문의처`·`■ 접수 방법`·`○ 문의처`)가 붙은 채,
   한 줄에 여러 이름표가 붙은 채. 이제는 **골라서 다듬는다** — 문장을 지어내지는 않는다(원칙 8-1 의 '추론 금지'는 그대로 · 바뀐 것은 '통째로'가 '골라서'로).
     · 이름표(`신청기간 :`·`접수방법 :`·`장학금액 :`·`문의처 :`)를 알아보고 **같은 뜻의 이름표를 한 이름으로** 묶는다 — 신청 기간 · 신청 방법 · 지원 금액 · 제출 서류 · 문의
     · 지원 자격·대상 줄은 여기 다시 적지 않는다(위 「지원 자격」이 보여 준다)
     · 글머리 기호·번호·엔터티를 떼고(tidyRequirement 와 같은 규칙) 한 줄을 180자에서 끊지 않고 **문장 끝에서** 자른다 · 같은 줄은 한 번만
     · 이름표가 없는 문장은 그대로 두되 끝이 `하고`·`및`·`,` 로 잘린 조각은 뺀다(원문이 잘려 온 것 — 보여 주면 "~하고에서 끊김")
     · 많아야 여덟 줄 — 나머지는 원문 링크 몫
   활동 시트의 공고 안내(noticeLines)도 같은 함수를 쓴다(이름표 없는 문장만이라 다듬기·조각 거르기만 걸린다). */
const NS_LABELS = [
  [/^(?:서류\s?)?(?:신청|접수|모집|지원|응모|추천|제출)\s?(?:기간|기한|마감(?:일시?)?)$/, '신청 기간'],
  [/^(?:신청|접수|제출|응모|지원)\s?방법$/, '신청 방법'],
  [/^(?:장학|지원|지급|수여)?\s?금액$|^(?:선발\s?인원\s?및\s?)?(?:장학|지원|지급)\s?금액(?:\s?및\s?(?:선발|추천)\s?인원)?$/, '지원 금액'],
  [/^(?:선발|모집|추천)\s?인원$/, '선발 인원'],
  [/^(?:제출|구비|필수)\s?서류$/, '제출 서류'],
  [/^(?:기타\s?)?(?:관련\s?)?문의(?:처)?(?:\s?및\s?.*)?$|^전화$|^연락처$|^기타\s?사항\s?및\s?문의처$/, '문의'],
  [/^기타\s?사항$|^유의\s?사항$|^참고$/, '참고'],
];
const NS_SKIP = /^(?:지원|신청|응모|모집|선발|추천)\s?(?:자격|대상|요건)$|^자격\s?요건$|^대상$/;
const NS_DANGLE = /(?:하고|하며|하여|이며|및|또는|으로|에서|,|\(|：|:|~|-|·)$/;
/* 줄로 쪼개진 원문을 **읽을 수 있는 줄**로 (2026-10-16 개발자 "공고 안내에도 그냥 원문에서 절만 잘라서") — 글자는 그대로, 잇기만 한다
   · 납작한 표 `활동일시` ↵ `ㅇ 2026.10.18` → `활동일시 : 2026.10.18` (NS_BARE_LABEL — 이름표만 남은 줄은 다음 줄의 이름표다)
   · 줄바꿈으로 끊긴 한 문장 `…희망하는` ↵ `기업들의 …` ↵ `하는 … 합니다.` → 한 줄 (앞 줄이 문장 끝 NS_LINE_END 가 아니고 다음 줄이 항목 머리 NS_ITEM_HEAD 가 아닐 때)
   · 이름표 없는 줄은 **문장이거나 알맹이(숫자·주소)가 있을 때만**(NS_SENTENCE) — `강북창업지원센터에서` 같은 조각은 안 보인다 */
const NS_BARE_LABEL = /^[\s○●■□ㅇ·\-–]*[가-힣\s]{2,8}(?:기간|일시|일정|장소|방법|대상|내용|인원|문의|혜택|접수|자격|요건)\s*[:：]?\s*$/;
const NS_LINE_END = /(?:[.。!?)）」』>:：]|[다요함음임됨]|\d)\s*$/;
/* ▪(U+25AA)·▶(U+25B6)는 글머리 기호인데 유니코드 표에선 그림 글자라 화면 이모지 관문(ui-tone)에 걸린다 — 코드로 적는다 */
const NS_ITEM_HEAD = /^\s*(?:[○•◦\u25AA■□◎※\-–·ㅇ*\u25B6▷◆◇①-⑳]|\d{1,2}\s?[.)]|[A-Za-z가-힣]\s?[.)]\s|[가-힣A-Za-z0-9\s·()]{1,14}\s?[:：])/;
const NS_SENTENCE = /(?:[.。!?)）」』]|[다요함음임됨])\s*$|\d|https?:|@/;
function joinNoticeLines(segs) {
  const out = [];
  for (const raw of segs) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const prev = out[out.length - 1];
    if (prev && NS_BARE_LABEL.test(prev) && !NS_BARE_LABEL.test(s)) { out[out.length - 1] = `${prev.replace(/^[\s○●■□ㅇ·\-–]+/, '').replace(/[\s:：]+$/, '')} : ${s.replace(/^[\s○●■□ㅇ·\-–]+/, '')}`; continue; }
    if (prev && !NS_LINE_END.test(prev) && !NS_BARE_LABEL.test(s) && !NS_ITEM_HEAD.test(s) && !/^[^:：]{1,16}[:：]/.test(prev)) { out[out.length - 1] = `${prev} ${s}`; continue; }
    out.push(s);
  }
  return out;
}
function tidyChars(s) {
  const t = String(s || '').replace(/[․‧]/g, '·').replace(/\s*[⦁•◦∙]\s*/g, ' · ').replace(/\u260E\s?/g, '전화 ')
    .replace(/(\d)\s+(인|명|원|점|개|건|회|년|월|일|학기|학년|학점|구간|분위|부|매|쪽)(?![가-힣])/g, '$1$2')   // `1 인 당 1,000,000 원` → `1인 당 1,000,000원`
    .replace(/\s+/g, ' ').trim();
  return typeof joinSpacedSyllables === 'function' ? joinSpacedSyllables(t) : t;   // `온라인 신 청` (match-engine 의 같은 규칙)
}
/* '같은 문장인가' — 「공고 안내」가 자격·모집 안내에 이미 나온 줄을 뺄 때 쓰는 비교 열쇠 **한 곳**(verify/what-shows.mjs 도 이 함수로 잰다).
   🔴 글머리 기호도 뗀다 — 자격 줄은 `■ 주 1회 이상 …`, 안내 줄은 `주 1회 이상 …` 로 저장돼 같은 문장이 두 칸에 떴다(관악서울대 치과병원 · 2026-10-28 개발자 지적) */
function noticeFlat(x) {
  return String(unent(x || '')).replace(/[\s:：·\-–■□○●\u25AA\u25B6▷◆◇◎※ㅇ*•]/g, '');
}
function noticeSummaryRows(lines) {
  const rows = []; const seen = new Set();
  /* 한 줄에 글머리 기호로 여러 항목이 붙어 온 것(`○ (신청방법) 네이버 폼 … ○ (모집대상) 만 19세~39세`)은 항목마다 한 줄로 가른다 — 글자는 그대로 */
  const segs = joinNoticeLines((lines || []).flatMap((raw) => String(raw || '').split(/\s+[○●■□\u25B6▷◆◇]\s*(?=\S)/)));
  for (const raw of segs) {
    const t0 = tidyChars(unent(String(raw || '')))
      .replace(/[\u2605☆\u261E]+/g, ' ').replace(/!{2,}/g, '!')   // 꾸밈 기호·느낌표 줄 — 뜻이 없다
      .replace(/^[\s\-–—•\u25AA\u25AB\u25FD\u25FE\u25B6▷◆◇○●■□▣\u2605\u2666⇒‡◦∙❍◎￭·ㆍ*◌◍※]+/, '');   // \u25FD·\u25FE(작은 네모)도 글머리(성암육영회 서류 줄 · 2026-11-02 실화면 · 글자는 ui-tone 이 이모지로 세므로 코드에 안 적는다)   // 그림 기호는 \u 로 적는다(화면 말투 관문 ui-tone 이 이모지로 센다)
    /* 번호를 뗀다 — 숫자 표식은 match-engine stripListNumber 한 곳(자격 줄과 같은 규칙 · 2026-11-17 리뷰 `3.5 이상`→`5 이상`·`2.1 보호조치`→`1 보호조치`).
       ⚠️ `10.22.(목)` 의 `10.` 은 번호가 아니라 날짜다(뒤에 날짜가 이어지면 안 뗀다 · 대외활동 실측 — 그 함수가 지킨다) */
    const t1 = stripListNumber(t0);
    let t = (t1 !== t0 ? t1 : t0.replace(/^[①-⑳]\s*|^[가-힣]\s*[.)]\s+/, ''))
      .replace(/^[(（][월화수목금토일][)）]\s*[-–]?\s*/, '')   // `12.(월) - 접수방법 :` — 앞 줄에서 떨어져 나온 날짜 꼬리(번호는 위에서 이미 뗐다)
      .replace(/^[Oo0](?=\s?[가-힣]{2,8}\s?[:：])\s?/, '')   // 「0모집기간:」·「O접수기간:」 — 글머리 ○ 가 영문 O·숫자 0 으로 읽혀 왔다(2026-11-17 실측 · 이름표 앞에서만)
      .replace(/\s+/g, ' ').trim();
    if (t.length < 4) continue;
    /* '모름'류 낱말이 든 줄은 통째로 뺀다 — 원문 문장(「…확인 필요」·「미확인에 따른 불이익…」)이어도 화면에선 앱이 모른다는 말로 읽힌다(개발자 결정 11-02 · knownValue 와 같은 규칙 — 잘라서 싣지 않는다).
       2026-11-18 유료 카드 읽기 첫 본 실행에서 유의 두 줄이 실려 verify-no-unknown 이 빨개졌다 · 무료 길 발췌에도 같은 줄이 있다(마감 지난 2건) */
    if (SAYS_UNKNOWN.test(t)) continue;
    /* 이름표 — `신청기간 : …` · `(신청방법) …` · 앞 괄호가 잘린 `모집기간) …` 꼴. ⚠️ 시각(`09:00`)·주소(`https://`)의 콜론은 이름표가 아니다(리뷰 2026-10-15) */
    const m = t.match(/^([가-힣A-Za-z0-9\s·]{1,16}?)\s*[:：](?!\d|\/\/)\s*(.+)$/) || t.match(/^[(（]([가-힣A-Za-z0-9\s·]{1,12})[)）]\s*(.+)$/) || t.match(/^([가-힣\s]{2,8})[)）]\s*(.+)$/);
    let label = '', body = t;
    if (m) {
      const key = m[1].replace(/\s+/g, '');
      if (NS_SKIP.test(key)) continue;
      const hit = NS_LABELS.find(([re]) => re.test(key));
      label = hit ? hit[1] : m[1].trim();
      body = m[2].trim();
    }
    if (!label && !NS_SENTENCE.test(body)) continue;   // 이름표 없는 줄은 문장이거나 알맹이가 있어야 한다(2026-10-16)
    if (NS_DANGLE.test(body)) {
      if (!label) continue;   // 이름표 없는 잘린 조각은 뺀다
      /* 이름표가 있는 줄은 남기되 잘린 꼬리(`신청하고`·`및`)만 떼고 끝에 … — 글자를 지어내지 않는다(리뷰 2026-10-15 · "~하고에서 끊김" 그 자리) */
      body = body.replace(/\s*(?:하고|하며|하여|이며|및|또는|으로|에서|,|\(|：|:|~|-|·)$/, '').trim() + '…';
    }
    if (body.length > 180) { const cut = body.slice(0, 180).match(/^[\s\S]*[.。]\s/); body = cut ? cut[0].trim() : body.slice(0, 180).replace(/\s\S*$/, '') + '…'; }
    const k = (label + body).replace(/\s/g, '');
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ label, body });
    if (rows.length >= 8) break;
  }
  return rows;
}
/* 글 속 주소 → 누를 수 있는 짧은 링크 (2026-11-17 개발자 지시 "가독성이 떨어지는 등 … 모두 수리") — 「온라인 접수https://www.k-startup.go.kr/web/contents/webPMSBizUnvs.do?returnUrl=…」
   처럼 긴 주소가 글자째 떠서 줄이 읽히지 않았다. 주소는 원문 그대로 링크에 담고, 보이는 글자만 사이트 이름(「forms.gle ↗」)으로 줄인다(글자를 지어내지 않는다).
   🔴 이 구간(NS_LABELS … sourceNoteHtml)은 관문·what-shows 가 떼어 돌린다 — 바깥 함수(safeUrl 등)에 기대지 말 것. http(s) 주소만 잡으므로 javascript: 는 들어오지 않는다 */
const NS_URL = /https?:\/\/[^\s<>"'()\[\]{}\u3131-\uD7A3]+/g;   // 주소에 붙은 한글(「…/abc에서 신청」)은 주소가 아니다 — 글자를 잃지 않는다(리뷰 2026-11-17)
function nsBodyHtml(body) {
  const s = String(body || ''); let out = '', last = 0;
  for (const m of s.matchAll(NS_URL)) {
    const u = m[0].replace(/[.,;:!?。]+$/, '');
    let host = ''; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
    const before = s.slice(last, m.index);
    const gap = /[^\s(（\[「『'"]$/.test(before) ? ' ' : '';   // 「접수https://…」 처럼 글자에 붙은 주소 앞에만 빈칸 하나 — 괄호 안·뒤 글자에는 더하지 않는다(리뷰 2026-11-17)
    out += esc(before) + (host ? `${gap}<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)} ↗</a>` : esc(u));
    last = m.index + u.length;
  }
  return (out + esc(s.slice(last))).replace(/\s{2,}/g, ' ').trim();
}
/* 「공고 안내」 절 — 다섯 줄까지 펼치고 나머지는 「더 보기」 안에(승인 시안 2026-11-02 · 줄 규칙은 위 noticeSummaryRows 그대로) */
const NS_SHOWN = 5;
function noticeSummaryHtml(lines) {
  const rows = noticeSummaryRows(lines);
  if (!rows.length) return '';
  const li = (r) => `<li>${r.label ? `<b class="ns-k">${esc(r.label)}</b>` : ''}${nsBodyHtml(r.body)}</li>`;
  const head = rows.slice(0, NS_SHOWN), rest = rows.slice(NS_SHOWN);
  return `<h4>공고 안내</h4><ul class="doc-list notice-summary">${head.map(li).join('')}</ul>`
    + (rest.length ? `<details class="ns-more"><summary>더 보기</summary><ul class="doc-list notice-summary">${rest.map(li).join('')}</ul></details>` : '');
}

/* ── 상세 시트 한 벌 (2026-11-02 개발자 승인 · docs/designs/mockups/sheet-consistency.html) ──
   장학(openDetail)·층2(같은 함수)·대외활동(openActivityDetail)이 머리줄과 절 다섯을 **여기서** 받는다 —
   지원 자격 → 접수 → 공고 안내 → 첨부 → 원문. 같은 사실은 한 자리에만: 마감은 머리줄 D-day 와 「접수 · 기간」 둘뿐 ·
   주최는 머리줄 · 「일정」·「마감일」 줄, 「이런 경우는 제외돼요」·「혜택」·「모집 안내」 절은 없다(내용은 자리를 옮겼다). 글자는 원문 그대로, 이름표 셋(기간·방법·서류)만 앱의 말. */
const fmtDay = (iso) => { const s = String(iso || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''; const y = String(new Date().getFullYear()); return (s.slice(0, 4) === y ? s.slice(5) : s).replace(/-/g, '.'); };   // 올해면 MM.DD · 해가 다르면 YYYY.MM.DD(리뷰 2026-11-02)
const isActivityItem = (x) => !!(x.activity || x.api || (x.kind && !x.type));   // 활동 글(피드 항목·activityAsSch 사본)인가 — 장학 공고는 type 이 있다
function sheetHeadHtml({ x, d, save }) {
  const org = isActivityItem(x) ? activityHostLine(x) : cardProviderLine(x);
  const dw = d ? ddayWords(d) : '';   // 마감을 모르면 빈 글자 — 배지를 안 그린다(2026-11-15 · 예전 「기한 확인 중」)
  const dd = x.program ? '<span class="badge badge-dday badge-program">상시 제도</span>' : (dw ? `<span class="badge badge-dday ${d.cls}">${esc(dw)}</span>` : '');   // 상시 제도는 마감 자리에(카드 아랫줄과 같은 글자)
  return `<div class="sch-top sheet-top">${kindChipHtml(x)}${org ? `<span class="sch-org">${esc(org)}</span>` : ''}${dd}${save}</div>`;
}
/* 「접수」 절의 세 줄 — 기간은 접수 시작~마감(둘 다 날짜일 때만 · 아니면 원문 기간 문구) · 방법은 원문 문장(noApply·메일·포털·재단) · 서류는 읽은 것만.
   🔴 모르는 줄은 **안 그린다** (2026-11-15 · 개발자 결정 11-02 — 예전 「기간 원문 확인」·「방법 원문 확인」). 세 줄 다 없으면 「접수」 절이 통째로 없다(「지원 자격」 칸과 같은 규칙 · 2026-11-07) */
function applySectionHtml(sch, opts) {
  const act = (opts && opts.activity) || null;   // 활동 글의 서류는 그 글이 원문 「제출서류」 절에서 읽은 것(collector activityDocuments · 2026-10-30) — 없으면 서류 줄이 없다
  const from = fmtDay(sch.openDate), to = fmtDay(sch.deadline);
  const rawPeriod = String(sch.period || '').replace(/^(?:(?:접수|모집|신청|지원)\s*(?:기간\s*)?|기간\s*)[:：·]?\s*/, '').replace(/\s*https?:\/\/\S*$/, '').replace(/\d{4}-(\d{2})-(\d{2})/g, '$1.$2').trim();   // ISO 날짜는 MM.DD 로(글자를 더하지 않고 줄인다) · 층2 「접수 ~…」·자동 등록 「접수 기간 ~…」 머리는 이름표와 겹친다(「기간 기간 ~09.21」 · 2026-11-17) · 모집·신청·지원 기간 머리도(활동 기간 토막 · 리뷰) · 끝에 붙은 주소는 기간이 아니다(80자에서 잘린 주소 — 리뷰)
  const period = (from && to) ? `${from} ~ ${to}`
    : (/\d/.test(rawPeriod) && !providerUnknown(rawPeriod)) ? rawPeriod
    : to ? `~ ${to}`
    : /상시/.test(rawPeriod) ? '상시'
    : '';
  /* 유료 카드 읽기가 읽은 신청 방법(원문 문장 · 줄머리 이름표를 뗀 것)이 있으면 그것을 줄마다 보인다(2026-11-15) */
  const paidApply = (!act && sch.cardRead && Array.isArray(sch.cardRead.apply)) ? sch.cardRead.apply.filter((l) => typeof l === 'string' && knownValue(l)) : [];   // '모름'류 낱말이 든 줄은 통째로 뺀다(「공고 안내」와 같은 규칙)
  const method = sch.noApply ? sch.noApply
    : sch.applyEmail ? (sch.applyEmailSource || `메일 ${sch.applyEmail}`)
    : sch.applyPortalSource ? sch.applyPortalSource
    : sch.sourceKind === 'kosaf' ? '재단 선발 공고문·홈페이지가 정한 접수 방법'
    : '';
  const docs = (act ? act.documents || [] : sch.documents || []).filter((doc) => !DOC_PLACEHOLDER.test(doc));
  const row = (k, v, plain) => `<li><b class="ns-k">${k}</b>${plain ? esc(v) : nsBodyHtml(v)}</li>`;   // 기간 줄은 plain — 80자에서 잘린 기간 토막의 주소를 진짜 같은 링크로 만들지 않는다(리뷰 2026-11-17)
  const docText = docs.map((d) => String(d).replace(/^[\s\-–—•\u25AA\u25AB\u25FD\u25FE■□▣○●◆◇·ㆍ*]+/, '').trim()).filter(Boolean).join(' · ');   // 원문 글머리 기호(■·○)는 뗀다 — 점으로 잇는 한 줄이라 기호가 두 겹(실화면 2026-11-02)
  const methodRow = paidApply.length ? `<li><b class="ns-k">방법</b>${paidApply.map(esc).join('<br>')}</li>` : (method ? row('방법', method) : '');
  const rows = `${period ? row('기간', period, true) : ''}${methodRow}${docText ? row('서류', docText) : ''}`;
  return rows ? `<h4>접수</h4><ul class="doc-list notice-summary apply-rows">${rows}</ul>` : '';
}
/* 상세 시트 「첨부」에 늘어놓는 첨부 — 본문 사진(bodyImage)은 첨부가 아니다 · 같은 파일이 두 번 실린 글(「1. 2026 절주서포터즈 모집 안내.pdf」 두 줄 · 2026-11-17 실측)은
   이름+주소가 같으면 한 번만. verify/what-shows.mjs 가 이 함수를 그대로 불러 화면과 같은 줄 수를 말한다(베끼지 말 것) */
function sheetAttachments(list) {
  const seen = new Set();
  return (list || []).filter((a) => a && !a.bodyImage).filter((a) => { const k = `${String(a.name || '').trim()}|${a.url || ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
function sheetSectionsHtml({ sch, result, fit, fd, activity = null, noticeLines = [] }) {
  /* ① 지원 자격 — 판정은 eligibilityRowsHtml·fitBadgeHtml 그대로(알약 status-pill 은 없다 · 두 축의 말이라).
     🔴 넣을 줄이 없고 물을 것도 없으면 **칸 자체를 안 그린다** (2026-11-07 개발자 지시 "지원자격을 못읽은경우에도 내용 없는 지원자격 칸이 있음 … 칸 자체를 없애기" —
     11-02 시안의 「원문에서 확인」 한 줄(칸은 늘 있음)을 뒤집었다). 장학 카드는 「자격 미확인」 배지가 그 사실을 말하고, 활동 카드엔 그 배지가 없어(아래 noticeCardHtml 10-03 결정)
     활동 시트는 이제 아무 데서도 말하지 않는다 — 개발자 지시대로다(리뷰 2026-11-07). */
  const rows = eligibilityRowsHtml(sch, result);   // 못 읽은 공고는 빈 글자(2026-11-15 · 예전엔 「? 지원 자격은 …」 줄을 여기서 걷어냈다)
  const ask = eligAskHtml(sch);
  const elig = (rows || ask) ? `<div class="sheet-verdict"><h4>지원 자격</h4><span class="verdict-marks">${fitBadgeHtml(fit, fd, { full: true })}</span></div>
      <ul class="reason-list">${rows}</ul>
      ${ask}` : '';
  /* ② 접수 ③ 공고 안내 */
  const apply = applySectionHtml(sch, { activity });
  const notice = noticeSummaryHtml(noticeLines);
  /* ④ 첨부 — 본문 사진(bodyImage)은 첨부가 아니다 · 층2 첨부는 재단이 올린 선발 공고문이라 꼬리표로 말한다(신청서 양식이라 부르지 않는다)
     🔴 2026-11-20 승인 시안(docs/designs/all-docs-pdf.md · 개발자 "원본인 한글파일이나 독스는 그냥 맨 밑에 첨부파일에 원본 넣어놓고 학생이 열 수 있는 공고들은 다 pdf 로"):
        위 목록 = PDF 줄(첨부 차례 · attachPdfRowsHtml 한 곳 — 장학·재단·활동 같은 함수 · 활동은 글 id 가 열쇠 · 활동 신청서 PDF 밑엔 「양식 채우기」 자리),
        맨 밑 목록 = 올린 첨부 목록 그대로(원래 PDF 도 다시 · 이름만 — 크기 글씨 없음). 사본이 없는 첨부는 맨 밑에만 보인다. */
  const atts = sheetAttachments(activity ? activity.attachments : sch.attachments);
  const pdfRows = attachPdfRowsHtml(activity && activity.id ? activity : sch, atts);
  const origRows = atts.map((a) => `<li class="att">${attachmentLinkHtml(a, 'color:var(--primary)')}</li>`).join('');
  const att = (pdfRows || origRows)
    ? `<h4>첨부${sch.sourceKind === 'kosaf' ? ' <span class="channel-tag">재단 선발 공고문</span>' : ''}</h4>${pdfRows ? `<ul class="doc-list">${pdfRows}</ul>` : ''}${origRows ? `<ul class="doc-list">${origRows}</ul>` : ''}`
    : '';
  /* ⑤ 원문 — 이름·안내는 source-link.js 한 곳(sourceLinkHtml · sourceLinkHintHtml) · 층2 문의 */
  const link = activity ? sourceLink(activity, 'activity') : sourceLink(sch, 'detail');
  const a = activity ? (() => { const href = safeUrl(link.href); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a>` : ''; })() : sourceLinkHtml(sch);   // 장학·층2는 sourceLinkHtml 한 곳(detail 자리)
  const hint = activity ? activityLinkWhy(activity, link) : sourceLinkHintHtml(link);
  const src = `<h4>원문</h4><div class="sheet-facts"><p class="doc-legend sheet-source">${a || sourceNoteHtml(sch)}${hint ? `<br />${hint}` : ''}</p>${(sch.sourceKind === 'kosaf' && sch.contact) ? `<p class="doc-legend">문의 ${esc(sch.contact)}</p>` : ''}</div>`;
  /* 절마다 한 묶음(.sheet-sec) — 묶음 사이 옅은 선 + 절 이름 앞 점(2026-11-16 개발자 지시 "각 칸을 시각적으로 구분하고 큰 틀 안내가 불렛포인트로").
     빈 절은 묶음도 없다(11-07 「칸 자체를 없애기」 그대로) · h4 글자는 그대로라 드라이버가 읽는 이름은 안 바뀐다 */
  return [elig, apply, notice, att, src].filter(Boolean).map((s) => `<section class="sheet-sec">${s}</section>`).join('');
}

function sourceNoteHtml(sch) {
  const a = sourceLinkHtml(sch);
  /* 목록이면 찾을 제목, 로봇이 문제를 확정한 주소면 본 것 한 줄 — 상세 시트 맨 아래와 같은 안내(2026-10-03) */
  const hint = sourceLinkHintHtml(sourceLink(sch, 'detail'));
  if (/<a /.test(a)) return `<p class="doc-legend">자세한 내용은 ${a}에서 확인${hint ? `<br />${hint}` : ''}</p>`;
  return sch.sourceKind === 'kosaf'   // 층2는 우리가 읽은 원문이 없다 — 주소가 없으면 재단을 가리킨다
    ? '<p class="doc-legend">자세한 내용은 재단에 확인해 주세요</p>'
    : '<p class="doc-legend">자세한 내용은 원문 공고에서 확인</p>';
}

/* 원문 링크 하나 — **이름은 source-link.js 의 sourceLink(sch, 'detail') 한 곳**이다 (2026-10-03).
   상세 시트 맨 아래 한 줄과 신청 준비 시트(sourceNoteHtml)가 이것을 쓴다.
   보통 주소는 예전 그대로 '원문 공고', 목록 표식·로봇이 목록으로 확정한 주소는 '게시판 목록',
   층2는 '재단 홈페이지', 상시 제도는 '한국장학재단', 로봇이 '그 공고가 아니었다'를 확정한 주소는 '(확인 필요)'.
   주소가 없으면 링크 없이 '원문 공고 확인' 글자만 — 층2는 원문이 없으니 아무것도 안 돌려준다(문의 줄이 따로 있다). */
function sourceLinkHtml(sch) {
  const link = sourceLink(sch, 'detail');
  const href = safeUrl(link.href);
  if (href) return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a>`;
  return sch.sourceKind === 'kosaf' ? '' : '원문 공고 확인';
}

/* 판정에 쓸 학생 정보가 없어 못 맞춰 본 요건 → 그 요건 한 줄 (2026-11-15). 이름은 match-engine evaluate 의 missing 그대로 받는다.
   🔴 지어내지 않는다 — 숫자는 공고의 조건 값, 중복 수혜는 원문 문장(exclusivity.raw)이다. 모르는 이름이면 줄을 만들지 않는다 */
function missingReqText(m, sch) {
  const e = (sch && sch.eligibility) || {};
  if (m === '직전학기 평점' && e.minGpa != null) return `직전학기 평점 ${e.minGpa} 이상`;
  if (m === '학자금 지원구간' && e.maxBracket != null) return `학자금 지원구간 ${e.maxBracket}구간 이내`;
  /* 중복 수혜 — 원문 칸에서 **그 조항 한 마디만**(○·※ 로 나뉜 항목 중 중복·타 장학금을 말하는 것) · 재단 칸 전체를 쏟지 않는다(2026-08-30 개발자 지적과 같은 이유) */
  if (m === '지금 받고 있는 장학금') {
    const raw = sch.exclusivity && sch.exclusivity.raw ? unent(String(sch.exclusivity.raw)) : '';
    return raw.split(/\s*[○ㅇ●◦※]\s*/).map((x) => x.replace(/\s+/g, ' ').trim()).find((x) => x.length >= 4 && /중복|타\s?(?:장학|재단|기관)|외부\s?장학/.test(x)) || '';
  }
  return '';
}

/* 상세 시트의 '지원 자격' 줄들 — 장학(openDetail)과 대외활동·공모전(openActivityDetail)이 **한 함수**를 쓴다 (2026-10-01 개발자 지시:
   *"원문 공고나 첨부파일, 자격요건 적합도 등이 장학금 탭 수준"*). 판정은 match-engine 그대로 — 여기서 새 판정을 만들지 않는다. */
function eligibilityRowsHtml(sch, result) {
  /* 공고 원문에 적힌 자격 문장을 **그대로** 덧붙인다 (2026-08-02 개발자 지시).
     소득·학년 같은 구조화된 조건이 일부 있어도 그게 요건의 전부가 아니다 — 5·18희망장학생의
     '민주화운동·국가폭력 피해자 유자녀' 같은 항목은 기계 조건으로 잡히지 않는다.
     그래서 조건 유무와 상관없이 **항상** 보여 준다. 추론이 아니라 원문 발췌라 원칙 8-1을 지킨다. */
  const QUALIFY_RE = /(신청\s?자격|지원\s?자격|응모\s?자격|자격\s?요건|지원\s?대상|신청\s?대상|모집\s?대상|선발\s?대상|추천\s?대상)/;
  /* eligibilityLines = 공고의 자격 항목을 **블록째** 뽑아 둔 것(1) 2) …).
     없으면 자격 낱말이 든 발췌 문장이라도 보여 준다. */
  const qBlock = (sch.eligibilityLines || []).filter((l) => !QUALIFY_RE.test(l) || l.length > 14);
  const qLines = qBlock.length ? qBlock : (sch.excerpts || []).filter((e) => QUALIFY_RE.test(e));

  /* '재학 대학 공고 (○○대)'는 자격이 아니라 **이 공고가 우리 학교 것**이라는 범위 표시다.
     초록 체크로 띄우면 "자격이 된다"로 읽혀 모순이 된다(2026-08-02 개발자 지적) — 카드 자체가
     이미 그 학교 학생에게만 보이므로 통과 쪽은 아예 빼고, 학교가 다른 경우(✕)만 남긴다. */
  const isScopeOk = (r) => /^재학 대학 공고/.test(r);
  /* 🔴 상세 시트는 요건을 **전부** 보여 준다 (2026-08-24). 화면 상한(5줄) 때문에
     배지는 '요건 9개 중 3개 충족'이라고 하는데 시트에는 5줄만 떠서, 학생이 세어 보면
     숫자가 안 맞았다. 카드는 요약이라 짧아도 되지만 **상세는 읽으러 오는 자리**다. */
  /* 2026-10-15 카드 전수(개발자 지시 "가독성이 매우 떨어짐") — 세 가지를 줄인다.
     ① 경우별 분기(`신입생:`·`재학생:`·`복학생:`…)는 **내 경우 줄이 있으면 그 줄만** 보인다(정읍시민 7줄 → 4줄). 내 경우가 없으면 전부.
     ② ※ 예외 곁말(`10학기 이하 후기 이중전공자는 … 신청 가능`)은 요건이 아니라 참고라 옅게(r-aside · 적합도 분모에서도 뺀다 — match-engine).
     ③ 위에서 ✕ 로 이미 보인 줄을 '내 정보로 확인한 항목'에 **또** 적지 않는다(111건이 같은 줄을 두 번 보였다). */
  const reqItems = requirementLines(sch, null, { all: true, withMeta: true });
  const myCase = (t) => { const cs = PR.caseBranch(t); return cs === null ? null : !!(state.profile && state.profile.status && cs.includes(state.profile.status)); };
  const hasMyCase = reqItems.some((it) => myCase(it.text) === true);
  const reqShown = reqItems.filter((it) => !(hasMyCase && myCase(it.text) === false));
  const reqLines = reqShown.map((it) => it.text);
  const shownBad = new Set(reqShown.filter((it) => !it.aside && requirementMatch(it.text, state.profile, sch) === 'no').map((it) => it.text));
  const FAIL_PREFIX = '공고에 적힌 요건에 미달해요: ';
  const judged = result.reasons.filter((r) => !isScopeOk(r) && !(r.startsWith(FAIL_PREFIX) && shownBad.has(r.slice(FAIL_PREFIX.length))));

  const checkRows = judged.map((r) => {
    /* 🔴 `미달`을 빠뜨려 **미달 근거 줄에 초록 ✓ 가 붙어 있었다** (2026-09-12 코드 리뷰).
       `공고에 적힌 요건에 미달해요: …` 가 '필요·아니에요·가능' 중 어디에도 안 걸려
       충족으로 그려졌다 — 화면이 스스로 모순된 말을 한 것이다.
       ⚠️ `!/충족|확인/` 이 뒤에 있어 '확인'이 든 미달 줄은 여전히 ✓ 가 된다 — 그건
          '확인 필요'(모름)를 ✓ 로 두지 않으려던 장치라, 미달을 먼저 본다. */
    const bad = /미달/.test(r) || (/필요|아니에요|가능$/.test(r) && !/충족|확인/.test(r));
    return `<li class="${bad ? 'r-bad' : 'r-ok'}">${bad ? '✕' : '✓'} ${esc(r)}</li>`;
  }).join('');
  /* 🔴 판정 못 한 요건은 **표시 없이 요건 그대로** (2026-11-15 · 개발자 결정 11-02 — 예전 「? ○○ 정보를 입력하면 정확히 판단할 수 있습니다」).
     줄은 버리지 않는다(요건이 사라지면 학생이 모른 채 지원한다) — 글자는 그 공고의 조건 값·원문 문장이다(missingReqText) · 그리는 자리는 아래 「내 정보로 확인한 항목」 */
  const missTexts = result.missing.map((m) => missingReqText(m, sch)).filter(Boolean);

  /* 지원 자격 한 덩어리 — 원문 요건을 먼저 보여 주고, 그 아래에 '내 정보로 확인한 것'을 붙인다.
     앱이 판정할 수 있는 건 성적·소득구간·학년 같은 숫자 조건뿐이고, 원문의 '유자녀' 같은 항목은
     판정할 수 없다. 그래서 두 묶음을 **구분해서** 보여 준다 — 섞으면 앱이 다 판정한 것처럼 읽힌다. */
  let reasonRows = '';
  /* 'AI가 읽음 · 검수 전' — '자동 등록 · 검수 전' 배지와 같은 규칙(2026-08-23).
     사람이 검수하지 않았다는 사실을 숨기지 않는다. 관리자 화면에서 컨펌하면
     eligibilityReviewed 가 true 가 되어 사라진다. */
  /* 요건은 원문을 통째로 붙이지 않고 **짧게 다듬어 번호를 매겨** 보여 준다.
     프로필과 확실히 맞으면 ✓, 확실히 안 맞으면 ✕, 판정할 수 없으면 색 없이 둔다
     (2026-08-02 개발자 지시). 판정 규칙은 match-engine에 있어 알림과 갈라지지 않는다. */
  /* 요건 한 줄을 그리는 법 — 구조 렌더와 평평한 렌더가 **같은 함수**를 쓴다.
     따로 두면 한쪽만 고쳐져서 두 모양의 판정이 갈라진다. 줄(문자열) 또는 withMeta 항목({text, aside}) 둘 다 받는다. */
  const reqRow = (it, extra) => {
    const e = typeof it === 'string' ? it : it.text;
    if (it && it.aside) return `<li class="r-elig r-aside${extra ? ' ' + extra : ''}">${esc(e)}</li>`;
    const m = requirementMatch(e, state.profile, sch);
    /* 🔴 `r-req`는 **자격 요건·먼저 뽑는 기준·제외** 세 블록이 함께 쓴다. 그래서 밖에서는
       어느 줄이 자격인지 가릴 수 없었다(검사가 셋을 다 세고 있었다 — 2026-08-26).
       자격 줄에만 `r-elig`를 달아 구분한다. 보이는 모양은 그대로다. */
    const cls = m === 'ok' ? 'r-elig r-ok' : m === 'no' ? 'r-elig r-bad' : 'r-elig r-req';
    const mark = m === 'ok' ? '✓ ' : m === 'no' ? '✕ ' : '';
    /* 🔴 줄마다 「적어서 확인」 을 달지 않는다 (2026-09-18 개발자 지시) —
       자격 블록 아래 한 줄(`.elig-ask-open`)이 같은 일을 하므로 중복이다.
       그 한 줄을 누르면 못 읽은 줄이 전부 펼쳐지고, 무엇을 물을지는 거기서 정한다. */
    return `<li class="${cls}${extra ? ' ' + extra : ''}">${mark}${esc(e)}</li>`;
  };

  /* 원문이 표인 공고 — 공통 / 둘 중 하나 / 성적을 갈라서 그린다 (2026-08-23).
     평평하게 늘어놓으면 '둘 중 하나'가 '둘 다'로 읽혀 뜻이 정반대가 된다
     (동국대 종단추천장학: 신규 지원자가 "기수혜자여야 한다"로 읽고 포기했다).
     🔴 갈래가 둘 이상인 공고에서만 이 모양이 나온다 — 나머지는 아래 평평한 렌더 그대로. */
  const reqStruct = requirementStruct(sch);
  if (reqStruct) {
    const must = [...reqStruct.common, ...reqStruct.grade];
    if (must.length) reasonRows += `<li class="r-head">공통 요건 <em>모두 해당해야 합니다</em></li>` + must.map((e) => reqRow(e)).join('');
    reasonRows += `<li class="r-head">다음 ${reqStruct.either.length === 2 ? '둘' : reqStruct.either.length + '가지'} 중 하나 <em>하나만 해당하면 됩니다</em></li>`;
    reqStruct.either.forEach((b, i) => {
      /* 이름을 못 읽었으면 지어내지 않고 순서로만 가른다 (원칙 8-1) */
      /* 갈래 이름이 첫 줄과 같은 글자면(`취업지원형 : …` 가 이름이자 줄) 줄을 한 번만 — 같은 문장이 두 번 보였다(2026-10-15) */
      reasonRows += `<li class="r-branch">${esc(b.label || `${i + 1}번째 경우`)}</li>`
        + b.lines.filter((e) => e !== b.label).map((e) => reqRow(e, 'r-inbranch')).join('');
    });
  } else if (reqLines.length) {
    // 소제목을 달지 않는다 — 바깥 <h4>가 이미 '지원 자격'이라 두 번 나온다
    /* 번호(1) 2) 3))는 붙이지 않는다 — 요건은 순서가 아니라 목록이고,
       판정 못 한 줄에 번호만 달면 체크된 줄과 뒤섞여 어수선하다(2026-08-02 개발자 지시). */
    /* 🔴 택1 묶음은 머리 줄을 이름표로 (2026-11-17 · 충남대 사회 재환원 장학금) — 엔진은 「차등조건(1개 이상 충족 시 …)」 아래 셋을 한 요건으로 세는데
       화면이 셋을 평평하게 늘어놓아 '셋 다 갖춰야 한다'로 읽혔다. 원문 머리 줄(match-engine pickHeadCaption · 앞 번호만 뗌)을 그 묶음 첫 줄 위에 작게 —
       요건 줄이 아니라 r-elig 를 달지 않는다(드라이버·적합도가 세지 않는다). 내 경우 거르기로 첫 줄이 빠져도 남은 첫 줄 위에 */
    const pickHead = {};
    reqItems.forEach((it) => { if (it.group && it.head && !pickHead[it.group]) pickHead[it.group] = it.head; });
    const headDone = new Set();
    reasonRows += reqShown.map((it) => {
      const cap = it.group && pickHead[it.group] && !headDone.has(it.group) ? (headDone.add(it.group), `<li class="r-pick">${esc(pickHead[it.group])}</li>`) : '';
      return cap + reqRow(it);
    }).join('');
  } else if (requirementLines(sch, qLines).length) {
    // 자격 줄이 없으면 발췌 문장으로 물러나되, **같은 정리를 거쳐** 보여 준다
    reasonRows += requirementLines(sch, qLines)
      .map((e) => `<li class="r-elig r-req">${esc(e)}</li>`).join('');
  }
  /* 먼저 뽑는 기준 — 자격이 **아니지만** 학생에게 쓸모가 있다 (2026-08-21 개발자 지적).
     자격 블록에 섞으면 요건이 실제보다 훨씬 까다로워 보여 지원할 수 있는 학생이 포기한다
     (목포향우회: 진짜 자격은 한 줄인데 우선순위까지 5줄이 떠 있었다). 그래서 자리를 나눈다.
     🔴 판정(✓/✗)을 하지 않는다 — 충족해도 '된다'가 아니라 '먼저 본다'는 뜻이라
     초록 체크를 달면 거짓 안심이 된다(제외 대상과 같은 규칙). */
  /* 두 곳에서 모은다 — 수집기가 따로 갈라 둔 것 + **자격 줄에 섞여 있던 것**.
     뒤쪽이 없으면 `학년이 높은 학생`처럼 자격에서 뺀 줄이 그냥 사라진다(2026-08-24). */
  const priLines = [...new Set([
    ...requirementLines(sch, sch.eligibilityPriority || [], { keepPriority: true }),
    ...requirementLines(sch, sch.eligibilityLines || [], { keepPriority: true, onlyPriority: true }),
    /* 자격 칸이 비지 않게 되돌린 줄은 여기 또 쓰지 않는다 — 같은 문장이 두 블록에 뜬다 */
  ])].filter((t) => !reqLines.includes(t));
  if (priLines.length) {
    reasonRows += `<li class="r-head">우선 선발 기준 <em>자격을 갖춘 사람 중 먼저 뽑는 기준</em></li>`
      + priLines.map((e) => `<li class="r-req">${esc(e)}</li>`).join('');
  }

  /* 제외 대상 — '누가 받을 수 있나'만큼 '누가 못 받나'도 자격 정보다 (2026-08-03 개발자 지적).
     판정하지 않고 원문 그대로 보여 준다 — 해당 여부는 학생이 안다. */
  /* 🔴 제외 줄은 **자격 줄 목록 안에도** 섞여 있다 (2026-08-24 개발자 지적).
     발췌기가 따로 뽑아 둔 eligibilityExcludes만 보면, 자격 절에 섞인 제외 줄이
     '지원 자격'으로 뜨거나(휴학생·자퇴생이 자격으로 떴다) 갈 곳이 없어 사라졌다.
     둘을 합쳐 넘기고, 무엇이 제외인지는 match-engine이 절 경계로 판정한다. */
  /* 🔴 두 목록을 **따로** 거른다 (2026-10-15 카드 전수) — 이어 붙이면 제외 목록의 절 머리글이 뒤따르는 자격 줄까지 제외 절로 끌어들여
     자격 세 줄이 '지원 제외 대상'에 **또** 떴다(미래의동반자재단). 적합도(fitDetail)는 애초에 따로 본다 — 화면만 이어 붙이고 있었다.
     위 자격 블록에 이미 보인 줄은 제외 블록에 다시 적지 않는다(같은 줄이 ✓ 와 제외로 두 번 보이던 kosaf 글). */
  const shownReq = new Set(reqLines);
  const exLines = [...new Set([
    ...requirementLines(sch, sch.eligibilityExcludes || [], { onlyExclude: true }),
    ...requirementLines(sch, sch.eligibilityLines || [], { onlyExclude: true }),
  ])].filter((t) => !shownReq.has(t));
  /* 승인 시안(2026-11-02) — 제외 조건은 같은 목록 안 ✗ 줄(머리글 없음). 판정은 안 한다(해당 여부는 학생이 안다) */
  if (exLines.length) {
    reasonRows += exLines.map((e) => `<li class="r-elig r-x">✗ ${esc(e)}</li>`).join('');
  }
  /* 🔴 '이 자격은 AI가 공고 원문에서 읽은 것입니다 · 사람 검수 전' 줄을 **뺐다**
     (2026-09-17 개발자 지시 — 앱 내부 사정은 관리자에게만). 누가 읽었고 사람이 검수했는지는
     우리 공정 이야기이고, 학생이 그 줄을 보고 할 수 있는 일이 하나도 없다.
     🔴 사라진 게 아니라 **자리를 옮겼다** — 관리자 화면 '데이터 품질'의
        'AI가 읽은 자격 · 사람 검수 전' 카드가 같은 것을 센다(`_admin/admin.js` aiReadCount).
     ⚠️ 그 줄을 만들던 `aiRead` 상수도 함께 지웠다 — 여기서 쓰는 곳이 더는 없다.
        판정식(`/^AI/.test(eligibilityFrom) && eligibilityReviewed !== true`)의 원본은
        이제 관리자 쪽 한 곳이다. 되살린다면 베끼지 말고 그 함수를 부를 것. */
  /* 못 맞춘 요건 한 줄(missingReqText) — 위 자격·제외 줄에 이미 보인 문장이면 또 적지 않는다(같은 줄 두 번 · 2026-10-15 카드 전수와 같은 규칙) */
  const flatT = (t) => String(t || '').replace(/[\s.·,]/g, '');
  const shownFlat = [...reqLines, ...exLines].map(flatT);
  const missRows = missTexts.filter((t) => !shownFlat.some((x) => x.includes(flatT(t)) || flatT(t).includes(x)))
    .map((t) => `<li class="r-req">${esc(t)}</li>`).join('');
  if (checkRows || missRows) {
    reasonRows += `<li class="r-head">내 정보로 확인한 항목</li>` + checkRows + missRows;
  }
  if (!reasonRows) {
    /* 원문 요건도 못 읽었고 판정할 조건도 없는 경우 — '제한이 없다'가 아니라 **모른다**는 뜻이다.
       원문에서 '제한 없음'을 확인한 공고만 eligibilityVerified로 확신 문구를 낸다.
       🔴 못 읽었으면 **아무 줄도 없다** (2026-11-15 · 개발자 결정 11-02 — 예전 「? 지원 자격은 아래 링크에서 확인해 주세요 (지원자 중 선발 심사로 결정됩니다)」).
       줄이 없으면 「지원 자격」 칸 자체가 안 그려진다(sheetSectionsHtml · 2026-11-07 지시) */
    reasonRows = sch.eligibilityVerified
      ? `<li class="r-ok">✓ 별도 자격 제한이 없는 공고입니다${result.status === 'selective' ? ' — 지원자 중 선발 심사로 결정됩니다' : ''}</li>`
      : '';
  }
  return reasonRows;
}

function openDetail(id) {
  /* 대외활동 줄(달력·보관함)은 활동 시트로 — 같은 [data-detail] 길로 들어온다(2026-10-02) */
  if (isActivityId(id)) { openActivityDetail(id.slice(4)); return; }
  const sch = appSch(id);   // 데이터에서 내려갔어도 결과를 적기 전이면 떠 둔 사본으로 연다(2026-10-02)
  if (typeof trackUse === 'function') trackUse('detail', id);   // 이용 횟수 — 누가는 안 담는다(usage-report.js)
  { const dsh = document.getElementById('detail-sheet'); if (dsh) dsh.dataset.useItem = id; }
  if (!sch) return;
  const result = evaluateFor(sch, state.profile);   // 카드와 같은 판정을 쓴다(위 주석)
  const fit = fitScore(sch, result, state.profile);
  const fd = fitDetailFor(sch, state.profile);   // 카드와 같은 근거를 쓴다(위 주석)
  const d = dday(sch.deadline);
  const app = state.applications.find((a) => a.id === id);
  const lock = applyLock(result, app, d, sch, fd);
  /* 데이터에서 내려간 공고(사본으로 연 시트)에서는 신청을 시작·이어가지 않는다 — 양식 흐름이 findSch 로 공고를 다시 찾다 넘어진다(2026-10-02 리뷰).
     기록(제출·결과)은 신청 내역 패널에서 그대로 적을 수 있다 */
  const gone = !findSch(id);
  const canApply = lock.canApply && !gone;
  const applyCaution = lock.caution;
  const ch = officialChannel(sch);

  /* 안내는 한 문장으로 (2026-09-01 개발자 지시). 한 화면에 설명이 셋이나 떠 있었는데
     (발췌 출처 설명 · 전국 공고 회색 상자 · 제출 서류 부연) 셋 다 결국 '원문을 보라'였다.
     🔴 링크 이름은 그 주소가 **실제로 여는 화면**을 말한다 — 목록 주소밖에 못 찾은
        공고를 '원문 공고'라고 적으면 눌러 본 학생에게 거짓말이 된다(원칙 8-1). */
  /* 🔴 **층2 링크를 '한국장학재단'이라고 부르면 안 된다** (2026-09-12).
     층2의 sourceUrl 은 KOSAF 가 아니라 **그 재단 자기 홈페이지**다(예: `namgu.gwangju.kr`).
     '한국장학재단 ↗'이라 적어 두면 눌러 본 학생에게 거짓말이 된다 — 이 규칙(링크 이름은
     그 주소가 **실제로 여는 화면**을 말한다)은 바로 윗 문단이 이미 적어 둔 것이다.
     KOSAF 를 가리키는 것은 `program`(data.js 의 상시 제도)뿐이다. */
  /* 🔴 2026-10-03 — 이름·안내 둘 다 source-link.js 의 sourceLink 한 곳에서 받는다. 목록이면 '목록에서 ○○을(를)
     찾아 눌러 주세요'(표식 주소든 로봇이 목록으로 확정한 주소든), 로봇이 '그 공고가 아니었다'를 확정했으면 본 것 한 줄. */
  let btnLabel = '신청 준비 시작';
  if (lock.noApply) btnLabel = '별도 신청 없음 — 학교가 선발';
  else if (app && !app.pending) btnLabel = prepStateLabel(app, sch, '신청 준비 완료됨') === '신청 준비 완료됨' ? '신청 준비 완료됨' : `${prepStateLabel(app, sch, '')} — 아래 체크리스트`;
  else if (app && app.pending && gone) btnLabel = '이어서 작성할 수 없는 공고';   // 데이터에서 빠진 공고 — 왜 빠졌는지는 단정하지 않는다(원칙 8-1)
  else if (app && app.pending) btnLabel = '서류 작성 이어서 하기';
  else if (d.days < 0) btnLabel = '마감된 장학금';
  /* 🔴 여기에 '요건 미충족 — 신청할 수 없음' 문구를 **되살리지 말 것** (2026-09-13).
     자격 판정은 이제 버튼을 잠그지 않는다(위 canApply). 못 미더운 판정은 버튼 위
     `applyCaution` 줄이 말하고, 누를지는 학생이 정한다. 문구를 여기로 되돌리면
     '신청할 수 없음'이라는 **사실이 아닌 말**이 화면에 다시 뜬다. */

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      ${/* 승인 시안(2026-11-02 · sheet-consistency.html) — 머리줄(칩·주최·D-day·저장) → 제목 → 금액 → 절 다섯(sheetSectionsHtml 한 곳 · 활동 시트와 같은 함수).
           🔴 상세 제목도 카드와 같은 정리(cardTitleParts — 지우고 나누기만) · 금액은 읽은 것만 굵게, 재단이 적어 둔 긴 금액은 옅게, 모르면 줄 없음(「원문 확인」 글자를 띄우지 않는다). */ ''}
      ${sheetHeadHtml({ x: sch, d: sch.program ? null : d, save: gone ? '' : saveBtnHtml(sch.id) })}
      <h3 class="sheet-title">${esc(cardTitleParts(sch).title)}</h3>
      ${(() => { const amt = amountLine(sch); const t = amt.text.replace(/^금액 · /, '') || (sch.amountNote && !providerUnknown(sch.amountNote) ? String(sch.amountNote).trim() : ''); return !t ? '' : amt.known ? `<p class="sheet-amount">${esc(t)}</p>` : `<p class="sheet-amount sheet-amount-unknown">${esc(t)}</p>`; })()}   ${/* 시트는 재단이 적어 둔 금액 글자를 버리지 않는다(2026-08-30) — 다만 「기관확인필요」 같은 모름 표시는 금액이 아니라 안 띄운다(리뷰 2026-11-02) */ ''}
      ${sheetSectionsHtml({ sch, result, fit, fd, noticeLines: [...(sch.noticeLines || []), ...(sch.excerpts || [])] })}

      ${app && !app.pending ? (() => {
        const step = effectiveStep(app, sch);
        const stepLabels = APP_STEPS.map((s, i) => (i === 3 && app.result === 'lost') ? '결과 확인' : s);
        return `
        <div class="app-progress">
          ${stepLabels.map((s, i) => `
            <div class="ap-step ${i <= step ? 'done' : ''}">
              <span class="ap-dot"></span><span class="ap-label">${s}</span>
            </div>`).join('')}
        </div>
        ${(() => {
          /* 준비 체크리스트 (2026-10-13 ③) — 첫 단계에서만 · 자동 항목은 ✓/— 로 보이고 나머지는 학생이 누른다 */
          if (step !== 0) return '';
          const pc = prepChecklist(app, sch);
          return `<h4>신청 준비 체크리스트 <span class="channel-tag">${pc.done}/${pc.total}</span></h4>
          <ul class="doc-list doc-badged prep-check">${pc.items.map((it) => `
            <li>${it.done ? '<span class="doc-auto">✓</span>' : '<span class="doc-manual">□</span>'} ${esc(it.label)}${it.auto && it.done ? ' <span class="doc-legend">자동 확인</span>' : ''}${
              it.manual && !(it.auto && it.done) ? ` <button class="link-btn" data-prep-toggle="${it.key}">${it.done ? '되돌리기' : '확인했어요'}</button>` : ''}${
              it.key === 'write' && !it.done ? ' <span class="doc-legend">「서류 작성 이어서 하기」로</span>' : ''}</li>`).join('')}
          </ul>`;
        })()}
        <p class="applied-at">${app.appliedAt} ${prepChecklist(app, sch).complete || step > 0 ? '준비 완료' : '신청내역에 담김 · 준비 중'} · 최종 제출처: ${ch.url ? `<a href="${esc(safeUrl(ch.url))}" target="_blank" rel="noopener">${esc(ch.label)}</a>` : esc(ch.label)}${ch.note ? ` <span class="doc-legend">${esc(ch.note)}</span>` : ''}</p>
        ${step === 0 ? `
          <button class="btn btn-outline" id="btn-mark-submitted" style="width:100%;margin-bottom:6px">공식 제출 완료로 기록</button>
          <p class="dp-note">최종 제출은 ${esc(ch.label)}에서 이루어집니다. 제출을 마친 뒤 누르면 다음 단계로 넘어갑니다.</p>` : ''}
        ${step === 1 ? `
          <p class="progress-note">${app.submittedAt} 공식 제출 기록됨${sch.deadline ? ` · 접수 마감(${sch.deadline}) 후 자동으로 심사 단계로 표시됩니다` : ''}</p>
          <button class="link-btn" id="btn-undo-progress" style="margin-bottom:10px">제출 기록 취소</button>` : ''}
        ${step === 2 ? `
          <p class="progress-note">접수가 마감되어 심사가 진행 중입니다. 발표 결과가 나오면 아래에 기록해 주세요 — 발표 확인은 ${esc(ch.label)}${/* '원문 공고'는 그 공고로 가는 주소(post)일 때만 — 재단 홈페이지·목록을 원문이라 부르지 않는다 (2026-10-03) */ ''}${sch.sourceUrl && sourceLink(sch, 'detail').cls === 'post' ? ' 또는 원문 공고' : ''}에서 할 수 있습니다.</p>
          <div class="submit-actions" style="margin-bottom:12px">
            <button class="btn btn-outline" id="btn-result-won">선정됨</button>
            <button class="btn btn-outline" id="btn-result-lost">아쉽게 미선정</button>
          </div>` : ''}
        ${step === 3 ? `
          <p class="progress-note ${app.result === 'won' ? 'progress-won' : ''}">${app.result === 'won'
            ? `${esc(app.resultAt)} 선정${(() => { const t = amountLine(sch).text.replace(/^금액 · /, ''); return t ? ` · ${esc(t)}` : ''; })()}`   /* 금액은 카드와 같은 amountLine — 모르면 「선정」까지만(예전 「선정 · 금액 원문 확인」 · 2026-11-16) */
            : `${esc(app.resultAt)} 미선정으로 기록됨`}</p>
          <button class="link-btn" id="btn-undo-progress" style="margin-bottom:10px">결과 기록 취소</button>` : ''}
        ${app.docs && app.docs.length ? `
          <details class="dp-saved"><summary>작성한 서류 보기 (${app.docs.length})</summary>
            ${app.docs.map((t) => `<h4>${esc(t.doc)}</h4><pre>${esc(t.text)}</pre>`).join('')}
          </details>` : ''}
        ${app.formAns && formTplIdFor(sch) ? `
          <h4>작성한 양식 문서</h4>
          <div class="submit-actions">
            <button class="btn btn-outline" id="btn-form-save">.doc 저장</button>
            <button class="btn btn-outline" id="btn-form-print">인쇄 · PDF</button>
            <button class="btn btn-outline" id="btn-form-share">공유</button>
          </div>
          <button class="btn btn-outline" id="btn-form-edit" style="width:100%;margin-bottom:14px">양식 다시 작성</button>` : ''}
        ${certStatusListHtml(sch)}
        <h4>최종 제출 방법 <span class="channel-tag">${submitChannelLabel(sch)}</span></h4>
        <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
        ${schoolPortalNote(sch)}
        ${(ch.url || sch.sourceUrl) && step < 1 ? `
        <button class="btn btn-primary" id="btn-go-submit" style="width:100%;margin-bottom:8px">내용 복사하고 제출처 열기 ↗</button>` : ''}
        <div class="submit-actions">
          <button class="btn btn-outline" id="btn-copy-docs">서류 내용 복사</button>
          <button class="btn btn-outline" id="btn-share-docs">파일과 함께 공유</button>
        </div>
        ${sch.applyEmail ? `<button class="btn btn-primary btn-lg" id="btn-mail-apply" style="margin-bottom:14px">접수 메일 열기 (내용 자동 완성)</button>` : ''}`;
      })() : ''}

      ${/* 🔴 판정이 못 미더울 때 **막는 대신 말한다** (2026-09-13 · 핵심-2).
           문구는 두 갈래다 — 못 읽은 것(unknown)과 안 맞아 보이는 것(ineligible)은
           학생이 해야 할 일이 다르다: 앞은 '원문을 읽어 보라', 뒤는 '그래도 내가 맞는지
           따져 보라'. 뭉뚱그리면 둘 다 '안 된다'로 읽힌다. */ ''}
      ${/* 🔴 앞 갈래에서 **우리 사정을 뺐다** (2026-09-17 개발자 지시: "'이 공고는 지원자격을
           아직 읽지 못했습니다' 와 같은 설명이 나타나지 않게 전부 삭제 … 앱 내부 사정에 대한
           설명은 학생이 아니라 관리자에게만"). 학생이 할 일은 그대로 남는다 — 남은 한 문장은
           '우리가 뭘 못 했다'가 아니라 '원문에서 자격을 보고 신청하라'는 안내다.
           🔴 문장을 통째로 지우지는 않았다: 지우면 자격을 한 줄도 못 읽은 공고가 아무 말 없이
              신청 버튼만 내밀어, 앱이 자격을 확인해 준 것처럼 읽힌다(원칙 8-1).
           🔴 몇 건이 그런 상태인지는 관리자 화면 '지원 자격 미확보'가 센다. */ ''}
      ${applyCaution ? `<p class="dp-note dp-caution">${applyCaution === 'unknown'
        ? '신청 전에 공고 원문에서 지원 자격을 확인하세요.'
        : '입력한 정보로는 요건이 맞지 않아 보입니다. 판정이 틀릴 수 있으니 원문을 확인한 뒤 신청하세요.'}</p>` : ''}
      ${lock.noApply ? `<p class="dp-note">원문: 「${esc(sch.noApply)}」</p>` : ''}
      <button class="btn btn-primary btn-lg" id="btn-apply-one" ${canApply ? '' : 'disabled'}>${btnLabel}</button>
      ${/* 단추 밑에는 아무 줄도 없다 — 「최종 제출 · 제출처」 한 마디도 2026-10-29 개발자 지시로 뺐다(2026-10-15 "happy talk 전부 삭제" 뒤 남아 있던 마지막 줄).
           제출처는 신청 준비 화면(「최종 제출 방법」 절)이 말한다 */ ''}
    </div>`;

  openSheetShell();
  /* 이어보기 — 보던 공고를 적어 둔다. 🔴 **판정은 적지 않는다**: 다시 열 때 이 함수가
     처음부터 다시 돌아 `dday`·`evaluate` 로 새로 판정한다(자리를 비운 사이 마감될 수 있다). */
  if (typeof resumeSave === 'function') resumeSave({ sheet: { kind: 'detail', id: sch.id } });

  if (canApply) {
    $('#btn-apply-one').addEventListener('click', () => applyTo(sch));
  }
  /* 자격 묻기 — 줄 아래 단추와 펼침 구획 (2026-09-17 · 노션 AI-1) */
  eligAskWire(sch);
  /* 진척도 기록 버튼 (있을 때만) */
  /* 준비 체크리스트 토글 (2026-10-13 ③) — 학생이 확인한 것만 적는다 · 자동 항목(작성·증명서 자동)은 버튼이 없다 */
  $$('#detail-sheet [data-prep-toggle]').forEach((b) => b.addEventListener('click', () => {
    const a = state.applications.find((x) => x.id === sch.id);
    if (!a) return;
    a.prep = a.prep || {};
    const k = b.dataset.prepToggle;
    a.prep[k] = !a.prep[k];
    saveState();
    openDetail(sch.id);
  }));
  const markBtn = $('#btn-mark-submitted');
  if (markBtn) markBtn.addEventListener('click', () => recordSubmitted(sch));
  const wonBtn = $('#btn-result-won');
  if (wonBtn) wonBtn.addEventListener('click', () => recordResult(sch, true));
  const lostBtn = $('#btn-result-lost');
  if (lostBtn) lostBtn.addEventListener('click', () => recordResult(sch, false));
  const undoBtn = $('#btn-undo-progress');
  if (undoBtn) undoBtn.addEventListener('click', () => undoProgress(sch));
  const goBtn = $('#btn-go-submit');
  if (goBtn) goBtn.addEventListener('click', () => {
    copyText(buildSubmissionText(sch, app));
    const url = safeUrl(ch.url || effectiveLinkUrl(sch));   // 제출처 표가 없으면 원문 — 바로잡은 원문이 있으면 그 주소(source-link.js ⑥)
    if (url) window.open(url, '_blank', 'noopener');
  });
  if (app && app.formAns && formTplIdFor(sch)) {
    const tpl = FORM_TEMPLATES[formTplIdFor(sch)];
    $('#btn-form-save').addEventListener('click', () => downloadFormDoc(tpl, state.profile, app.formAns));
    $('#btn-form-print').addEventListener('click', () => printFormDoc(tpl, state.profile, app.formAns));
    $('#btn-form-share').addEventListener('click', () => shareFormDoc(tpl, state.profile, app.formAns, sch));
    $('#btn-form-edit').addEventListener('click', () => { startFormFill(sch); formFill.ans = app.formAns; formFill.stage = 'preview'; renderFormFill(); });
  }
  const copyBtn = $('#btn-copy-docs');
  if (copyBtn) copyBtn.addEventListener('click', () => copyText(buildSubmissionText(sch, app)));
  const shareBtn = $('#btn-share-docs');
  if (shareBtn) shareBtn.addEventListener('click', () => shareApplication(sch, app));
  const mailBtn = $('#btn-mail-apply');
  if (mailBtn) mailBtn.addEventListener('click', () => {
    const p = state.profile;
    const subject = `[장학금 신청] ${sch.name} - ${p.school} ${p.name || ''}`;
    const body = buildSubmissionText(sch, app) + '\n\n(첨부: 앱 보관함의 증명서류와 작성한 양식 문서를 함께 첨부해 주세요)';
    location.href = `mailto:${sch.applyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
}

/* 손가락 아래에 아직 위로 올릴 수 있는 스크롤 영역이 남아 있으면 그건 '닫기'가 아니라 스크롤이다.
   시트 자신뿐 아니라 **안쪽 스크롤 영역까지** 봐야 한다 — 도우미 시트는 시트가 고정이고
   안쪽 대화 목록이 스크롤돼서, 시트만 보면 scrollTop이 늘 0이라 대화를 올려 보려 할 때마다 닫힌다. */
function scrollableAtTop(target, sheet) {
  for (let el = target; el && el !== sheet.parentNode; el = el.parentElement) {
    if (el.scrollTop > 0) return false;
  }
  return true;
}

/* 바텀시트를 아래로 쓸어내려 닫기 — 앱 안에서 뜨는 시트 전부가 같은 규칙을 쓴다
   (#detail-sheet · #notify-sheet · #chat-sheet). 위로 올릴 내용이 남아 있지 않을 때
   아래로 끄는 동작만 '닫기'로 본다. 그래야 안쪽 내용 스크롤을 뺏지 않는다
   (학교 목록에서 손가락이 닿는 순간 선택돼 버리던 것과 같은 계열의 실수를 막는 조건).
   ⚠️ 새로 만드는 시트에도 반드시 붙일 것 — 2026-08-21 개발자 지시. */
function enableSheetSwipe(sheet, close) {
  let startY = 0, dy = 0, dragging = false, startT = 0;
  /* 🔴 **거리만 보면 안 된다** (2026-09-06). 90px 을 넘겨야만 닫히니 짧고 빠르게 튕기는
     — 시트를 닫는 가장 자연스러운 손짓 — 이 무시됐다. 빠르기(px/ms)도 함께 본다.
     0.11 은 '툭 치는 것'과 '천천히 끄는 것'이 갈리는 선이다. */
  const FLICK = 0.11;
  sheet.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startT = Date.now();
    dy = 0;
    dragging = scrollableAtTop(e.target, sheet);
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { dragging = false; sheet.style.transition = ''; sheet.style.transform = ''; return; }
    e.preventDefault();
    sheet.style.transition = 'none';
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  }, { passive: false });

  sheet.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    void sheet.offsetHeight;          // transition을 되살린 뒤에 transform을 바꿔야 튀지 않는다
    sheet.style.transform = '';
    const speed = dy / Math.max(1, Date.now() - startT);
    if (dy > 90 || (dy > 12 && speed > FLICK)) close();
  }, { passive: true });
}

/* ── 안쪽 화면을 **오른쪽으로 쓸어** 되돌아가기 (2026-09-11 개발자 요청) ──────────
   설정·휴지통·이용약관은 MY 안쪽 화면이라 나가는 길이 왼쪽 위 화살표 하나뿐이었다.
   손가락으로 오른쪽으로 쓸면 그 화면을 나간다 — 시트를 아래로 쓸어 닫는 것과 같은 계열이다.

   🔴 **규칙은 시트 것(enableSheetSwipe)과 같은 뼈대를 쓴다**: 거리만 보지 않고 **튕김
      빠르기**도 함께 본다(짧고 빠르게 튕기는 것이 가장 자연스러운 손짓인데 거리만 보면
      무시된다 — 2026-09-06 에 시트에서 겪은 그것). 문턱 값도 같은 뜻으로 맞춰 뒀다.

   🔴 **세로 스크롤을 뺏지 않는다.** 첫 움직임에서 축을 정하고, 세로가 더 크면 그 손짓은
      통째로 포기한다(다시 붙잡지 않는다). 이 저장소는 '보이지 않는 것이 손가락을 가로채는'
      사고를 여러 번 냈다 — 밀어서 삭제가 그래서 걷어내졌다(2026-09-01).

   🔴 **가로로 스크롤되는 것 위에서는 안 된다.** 약관의 표처럼 옆으로 밀리는 영역이
      왼쪽 끝이 아니면 그건 그 영역의 스크롤이다(시트의 `scrollableAtTop` 과 같은 판정).

   ⚠️ iOS 는 **화면 왼쪽 끝**에서 오른쪽으로 끄는 것을 제 '뒤로 가기'로 가로챈다. 그래서
      왼쪽 끝 24px 에서 시작한 손짓은 건드리지 않고 넘긴다 — 우리가 잡아 봐야 OS 와 둘이
      같이 반응해 두 번 나가거나 화면이 튄다. 그 자리를 뺀다고 손해가 없다(가운데에서
      쓸어도 되니까).
   ⚠️ 회귀는 **반드시 TouchEvent 로** 재현할 것 — 마우스로는 이 유형이 한 번도 재현되지
      않았다(13차 세션 학교 검색 사고). verify/verify-settings.js 의 '쓸어서 나가기' 절. */
function scrollableAtLeft(target, screen) {
  for (let el = target; el && el !== screen.parentNode; el = el.parentElement) {
    if (el.scrollLeft > 0) return false;
  }
  return true;
}

const SWIPE_EDGE_IOS = 24;   /* iOS 제 뒤로가기에 양보하는 왼쪽 끝 폭 */

/* 🔴 손짓은 **앱 전체**(`#app`)에서 받는다 — 화면 조각에 붙이면 안 된다.
   빈 휴지통처럼 내용이 짧은 화면은 아래쪽이 통째로 비어 있어서, 그 조각에만 붙이면
   학생이 화면 가운데를 쓸어도 아무 일도 안 일어난다(검사에서 실제로 그렇게 걸렸다).
   지금 어느 화면인지는 `currentScreen` 이 말해 주고, 안쪽 화면일 때만 맡는다. */
const SWIPE_BACK_TO = {
  myinfo: 'my',
  mydocs: 'my',
  mysaved: 'my',
  settings: 'my',
  trash: 'settings',
  terms: 'settings',
  logins: 'settings',
  faq: 'settings',
  support: 'settings',
  perms: 'settings',
};

function enableScreenSwipeBack(root) {
  if (!root || root.dataset.swipeBack) return;
  root.dataset.swipeBack = '1';
  const screen = () => $(`#screen-${currentScreen}`);
  let x0 = 0, y0 = 0, dx = 0, t0 = 0, W = 1;
  let live = false;      // 이 손짓을 우리가 맡았나
  let axis = '';         // '' 아직 모름 · 'x' 우리 것 · 'y' 스크롤이라 포기
  /* 🔴 속도는 **마지막 짧은 구간**으로 잰다. 손짓 전체로 나누면 '조금 끌고 → 멈췄다가 →
     뗀다' 가 툭 치기로 읽혀, 되돌리려던 화면이 나가 버린다. 손을 멈췄으면 속도는 0이다. */
  let vs = [];           // 최근 몇 점 {t, x}
  const VWIN = 100;      // 속도를 재는 구간 (ms)
  const VREST = 90;      // 이만큼 멈춰 있었으면 '놓은 것'이지 '친 것'이 아니다
  const FLICK = 0.08;    // 튕김으로 볼 빠르기 (px/ms)
  const TAKE = 0.22;     // 이만큼 끌면 놓아도 나간다 (화면 너비의 몫 · 430px 폰에서 95px)

  /* 🔴 **우리가 그린 적 없으면 지우지 않는다** (2026-09-12 코드 리뷰가 잡았다).
     손짓이 끝날 때마다 화면의 transform 을 비우고 있었는데, 그 자리엔 **당겨서 새로고침**
     (`interactions.js`)이 붙잡아 둔 `translateY` 가 들어 있을 수 있다. 우리 손짓 판정은
     `#app` 에 붙어 있어 document 보다 먼저 돌기 때문에, 안쪽 화면에서 아래로 당기면
     놓는 순간 우리가 먼저 자국을 지워 **되돌아가는 움직임이 통째로 사라졌다**
     (실측: 당기는 중 translateY(50px) → 뗀 직후 빈 값). */
  let painted = false;
  const reset = () => {
    live = false; axis = '';
    if (!painted) return;
    painted = false;
    const el = screen();
    if (!el) return;
    el.style.transition = '';
    void el.offsetHeight;
    el.style.transform = '';
    el.style.opacity = '';
  };

  root.addEventListener('touchstart', (e) => {
    live = false;
    if (e.touches.length !== 1) return;
    if (!SWIPE_BACK_TO[currentScreen] || !screen()) return;   // 안쪽 화면일 때만
    /* 🔴 시트 안에서는 손대지 않는다. 시트(#detail-sheet 등)는 `#app` **안에** 있어서,
       설정 화면 위에 로그인 시트가 떠 있을 때 그 안의 손짓까지 이 규칙이 가로챈다 —
       시트는 제 손짓(아래로 쓸어 닫기)이 따로 있다(enableSheetSwipe). */
    if (e.target.closest && e.target.closest('.sheet, .sheet-backdrop')) return;
    const t = e.touches[0];
    if (t.clientX <= SWIPE_EDGE_IOS) return;                   // OS 몫
    if (!scrollableAtLeft(e.target, root)) return;
    x0 = t.clientX; y0 = t.clientY; dx = 0; t0 = Date.now();
    /* 문턱에 쓸 너비는 **여기서** 잰다 — 안 재면 1로 남아 문턱이 0.22px 이 된다 */
    W = Math.max(1, screen().getBoundingClientRect().width);
    vs = [{ t: t0, x: 0 }];
    live = true; axis = '';
  }, { passive: true });

  root.addEventListener('touchmove', (e) => {
    if (!live) return;
    const el = screen();
    if (!el) { live = false; return; }
    const t = e.touches[0];
    const mx = t.clientX - x0;
    const my = t.clientY - y0;
    if (!axis) {
      /* 🔴 **엄지는 곧게 못 움직인다.** 8px 움직인 순간 `|가로| > |세로|` 하나로 정하면
         엄지를 굴려 세로가 먼저 나가는 흔한 손짓을 통째로 버린다("쓸었는데 안 된다").
         뚜렷해질 때까지 기다리되, **맡는 순간에는 가로가 이겨 있어야** 한다 —
         비스듬한 손짓은 브라우저가 이미 세로로 굴리는 중이라 늦게 끼어들면 화면이 튄다. */
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx) * 1.4) { live = false; return; }
      if (mx <= -10) { live = false; return; }
      if (mx < 10 || Math.abs(my) >= mx) return;   // 아직 방향을 말하지 않았다
      axis = 'x';
    }
    dx = mx;
    const now = Date.now();
    vs.push({ t: now, x: mx });
    while (vs.length > 2 && now - vs[0].t > VWIN) vs.shift();
    if (dx <= 0) { if (painted) { el.style.transform = ''; el.style.opacity = ''; } return; }
    e.preventDefault();
    /* 🔴 **인라인으로 끈다.** 당겨서 새로고침(`interactions.js release`)이 이 화면에
       `transition: transform 0.28s` 를 인라인으로 남기는데, 인라인은 클래스를 이기므로
       CSS 로는 못 끈다 — 안 끄면 화면이 손보다 0.28초 늦게 따라온다. */
    painted = true;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dx}px)`;
    /* 멀리 끌수록 옅어진다 — '나가는 중'이 손끝에 보이게 (0.4 아래로는 안 내린다) */
    el.style.opacity = String(Math.max(0.4, 1 - dx / 520));
  }, { passive: false });

  const finish = () => {
    if (!live) { reset(); return; }
    const moved = dx;
    const nowMs = Date.now();
    const a = vs[0], z = vs[vs.length - 1];
    /* 🔴 '멈췄다'와 '너무 빨라서 시간이 0'을 **가르는 것**이 여기다 (2026-09-12).
       멈춤의 증거는 오직 **마지막 점 이후의 빈 시간**(VREST)이다. 구간 길이가 0인 것은
       그 반대 — 그 짧은 사이에 손이 그만큼 갔다는 뜻이라 오히려 빠른 것이다.
       ⚠️ 둘을 한 줄에 뭉쳐 `z.t <= a.t → 0` 으로 두었더니, 점들이 **같은 밀리초**에
          몰린 빠른 튕김이 '멈춤'으로 읽혀 검사가 세 번에 한 번 빨간불이었다(실측).
          브라우저는 touchmove 를 묶어 보내고 Date.now() 는 1ms 눈금이라 실제로 생긴다. */
    let span = z && a ? z.t - a.t : 0;
    let dist = z && a ? z.x - a.x : 0;
    if (span <= 0) { span = nowMs - t0; dist = moved; }   // 한 틱에 몰렸다 — 손짓 전체로 다시 본다
    const speed = (!z || nowMs - z.t > VREST)
      ? 0                                           // 손이 멈춰 있었다 — 친 게 아니다
      : (span > 0 ? dist / span : Infinity);        // 0ms 에 그만큼 갔다 = 아주 빠른 튕김
    const to = SWIPE_BACK_TO[currentScreen];
    reset();
    if (to && (moved > W * TAKE || (moved > 12 && speed > FLICK))) showScreen(to, { back: true });
  };
  root.addEventListener('touchend', finish, { passive: true });
  root.addEventListener('touchcancel', () => { live = false; reset(); }, { passive: true });
}

/* 바텀시트를 여는 동작 한 곳 — 상세 시트와 일괄 준비 목록이 **같은 함수**를 쓴다.
   베끼면 열리는 모양이 갈라진다(내용은 부르는 쪽이 innerHTML 로 채운다). */
function openSheetShell(keepScroll) {
  $('#sheet-backdrop').hidden = false;
  const sheet = $('#detail-sheet');
  sheet.hidden = false;
  void sheet.offsetHeight;   /* 배치를 확정시켜 transition 이 걸리게 한다 (rAF 대신) */
  {
    $('#sheet-backdrop').classList.add('show');
    sheet.classList.add('show');
    /* 🔴 **맨 위부터 보여 준다** (2026-08-29 개발자 지적: "공고를 누르면 그 공고의
       아랫부분이 나온다"). 스크롤되는 것은 `.sheet` 자신인데(style.css `overflow-y:auto`)
       내용만 innerHTML 로 갈아끼우므로 **앞 내용에서 내려 둔 위치가 그대로 남는다** —
       금액 상세를 한참 내려보다 공고를 누르면 그 공고의 중간부터 보였다.
       여기서 하는 이유: 부르는 쪽은 이 함수 **뒤에** innerHTML 을 채우므로 그 자리에서
       되돌리면 내용이 없어 안 먹는다. 이 rAF 는 채운 뒤에 돈다.
       되돌아가기(`dismissSheet`)만 보던 자리를 넘겨 그 위치를 되살린다. */
    sheet.scrollTop = keepScroll || 0;
  }
}

/* 시트를 내렸을 때 **돌아갈 곳** (2026-08-29 개발자 요청).
   금액 상세에서 공고를 눌러 들어갔는데, 내리면 그냥 닫혀서 금액 상세를 처음부터
   다시 열어야 했다("귀찮음이 있어서"). 한 단계 뒤로 가게 한다.
   🔴 `closeSheet()` 자체를 고치면 안 된다 — 신청 준비·양식 작성 흐름도 그걸 부르는데,
      그때 금액 상세로 튕겨 돌아가면 엉뚱하다. **사용자가 내리는 경로만** 뒤로 간다. */
let sheetBack = null;

/* 사용자가 시트를 내렸다 — 돌아갈 곳이 있으면 거기로, 없으면 닫는다 */
function dismissSheet() {
  const back = sheetBack;
  sheetBack = null;
  if (typeof back !== 'function') { closeSheet(); return; }
  /* 🔴 **내려가는 동작을 끝까지 보여 준 뒤에** 이전 화면을 올린다
     (2026-08-29 개발자 지적: "그 탭을 내리면 금액 상세 탭이 너무 빠르게 나와서 헷갈린다").
     예전에는 손을 떼자마자 innerHTML 만 갈아끼웠다 — 쓸어내린 시트가 도로 **올라오면서**
     내용만 바뀌니, 학생 눈에는 '닫으려 했는데 다른 게 튀어나온' 것으로 보였다.
     지금은 ① 내려보내고 ② 다 내려간 뒤 이전 화면으로 채우고 ③ 다시 올린다.
     배경(backdrop)은 끄지 않는다 — 끄면 그 사이에 화면이 한 번 번쩍인다.
     ⏱ 기다리는 시간은 **CSS 에서 읽는다**(style.css `.sheet` transition). 숫자를 여기 적으면
        CSS 를 고칠 때 조용히 어긋난다 — 이 저장소가 반복해 겪은 '베끼면 갈라진다'. */
  const sheet = $('#detail-sheet');
  /* 🔴 **`.show` 를 뗀 뒤에 읽는다** (2026-09-06) — 들어올 때(0.3s)와 나갈 때(0.22s)의
     시간이 달라졌다. 떼기 전에 읽으면 들어올 때의 값이 나와 80ms 를 헛되이 기다린다. */
  sheet.classList.remove('show');
  const ms = (parseFloat(getComputedStyle(sheet).transitionDuration) || 0.22) * 1000;
  setTimeout(() => {
    /* 🔴 되돌아가기가 **실패하면 그냥 닫는다.** `renderAmountDetail()` 은 `lastBill` 이
       없으면 아무것도 안 그리고 돌아오는데, 그때 여기서 return 해 버리면 시트가
       **내려간 채 멈춘다** — 배경만 깔린 화면이 남는다. */
    if (back() === false) closeSheet();
  }, ms);
}

/* 금액 상세에서 공고로 들어갈 때 — 돌아갈 곳과 **보던 위치**를 함께 기억한다.
   두 곳(누르기·키보드)에서 부르므로 함수로 둔다. 베껴 두면 한쪽만 고쳐져 갈라진다. */
function rememberAmountBack() {
  const y = $('#detail-sheet').scrollTop;
  /* 지금 열린 목록으로 돌아간다 — 금액 상세 · 히어로 줄 목록(매칭된 공고 · 마감) 모두 (2026-11-20) */
  const back = (typeof sheetListRender === 'function' && sheetListRender) || renderAmountDetail;
  sheetBack = () => back(y);
}

/* ── 자격 확인 도우미 — 못 읽은 자격을 그 자리에서 묻는다 (2026-09-17 · 노션 AI-1) ──
   🔴 앱이 하는 말은 「맞춰 볼 자격 n」 하나다(2026-11-15 이름 바꿈 · 예전 「미확인 자격 n」 — 개발자 결정 11-02). 설명·약속 문장을 넣지 말 것 —
      앱이 아는 것은 공고에 적힌 요건 중 **자기가 읽어낸 것**뿐이고, 적는다고
      좋은 소식이 는 것도 아니다(적은 결과가 ✕ 일 수 있다). 설계 3-2.
   🔴 재사용을 화면이 말하지 않는다 (2026-09-17 개발자 결정) — 그렇게 동작하되
      「다른 공고에도 적용됨」 류의 줄을 되살리지 말 것.

   🔴 **공고 팝업을 갈아치우지 않는다** (2026-09-18 개발자 지시:
      "적을 때의 팝업은 그 공고카드 팝업에서 예쁘게 나왔으면"). 예전에는 `#detail-sheet`
      의 innerHTML 을 통째로 바꿔 자격 묻기 시트를 띄웠는데, 그러면 보고 있던 공고가
      사라지고 **뒤에 홈 화면이 비친다** — 학생 눈에는 딴 데로 끌려간 것이다.
      지금은 자격 블록 **바로 아래에서 펼쳐진다.** 시트는 그대로 있고 돌아갈 곳도 필요 없다.
   설계: docs/designs/eligibility-ask.md · 관문: verify/verify-elig-ask.js */

/* 🔴 펼쳤을 때 **본 줄**을 기억한다 (2026-09-17 실측으로 잡은 버그).
   매번 '아직 판정 없는 줄'로 다시 세면, 저장해서 풀린 줄이 초록으로 바뀌는 게 아니라
   목록에서 **사라진다** — 학생 눈에는 방금 적은 그 줄이 없어진 것이다. */
let eligAsk = null;   /* { id, open, shown } — 지금 펼친 공고와 그때 본 줄 */

/* 🔴 화살표는 **한 곳에서만** 그린다 — 접힌 줄과 펼친 머리줄이 같은 그림을 쓴다.
   베껴 두면 한쪽만 고쳐져 두 상태가 다른 모양이 된다. 펼침 표시는 CSS 가 뒤집는다
   (`.elig-ask-head .elig-chev { transform: rotate(180deg) }`). */
const ELIG_CHEV = '<svg class="elig-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6.5 8 10.5 12 6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function eligAskHtml(sch) {
  const keys = askableForSch(sch, state.profile);
  const mine = eligAsk && eligAsk.id === sch.id ? eligAsk : null;
  if (!keys.length && !mine) return '';        /* 물을 것이 없으면 자리도 안 만든다 */
  /* 🔴 화면에 보일 자격 줄이 없으면 묻지도 않는다 (2026-11-15 개발자 재제보 — 실측 4건: 「지원 자격 — 미확인 자격 0」 만 남은 빈 칸).
     질문 거리(askableForSch)는 **저장된 줄 전부**에서 잡고 화면 줄(requirementLines)은 서류 안내·※ 조각을 걸러서, 줄은 0개인데 질문만 남았다 —
     답해도 바뀔 줄이 없다(답하면 칸이 통째로 사라졌다). 제외 줄(✗)만 있는 시트도 같다(리뷰). 관문 `verify-elig-ask.js` ⑩ */
  if (!requirementLines(sch, null, { all: true }).length) return '';
  const open = !!(mine && mine.open);
  const shown = (mine && mine.shown) || requirementLines(sch, null, { all: true })
    .filter((l) => !requirementMatch(l, state.profile, sch));
  eligAsk = { id: sch.id, open, shown };
  const left = shown.filter((l) => !requirementMatch(l, state.profile, sch)).length;
  if (!open) {
    return `<div class="elig-ask"><button type="button" class="elig-ask-open"`
      + ` data-elig-open="${esc(sch.id)}" aria-expanded="false">`
      + `맞춰 볼 자격 <b>${left}</b>${ELIG_CHEV}</button></div>`;   // 이름 「미확인 자격」 → 「맞춰 볼 자격」(2026-11-15 · 개발자 결정 11-02)
  }
  const rows = eligAskRowsHtml(keys);
  /* 🔴 **미확인 줄을 여기 다시 나열하지 않는다** (2026-09-18 실측으로 드러났다).
     위 자격 블록이 이미 그 줄들을 보여 주고 있어서, 펼치면 똑같은 줄이 회색으로
     한 번 더 나왔다 — 화면이 두 배로 길어지고 표처럼 어수선했다.
     저장하면 **위 자격 블록의 그 줄**이 ✓ 또는 ✕ 로 바뀐다. 눈금은 거기 있다. */
  /* 🔴 물을 칸이 없으면 **아래 줄을 통째로** 안 그린다 — 예전에는 저장 단추만 빼서
     「나중에 하기」가 빈 줄에 덩그러니 남았다(실측). 누를 것이 없으면 자리도 없앤다.
     🔴 저장은 **작은 알약**이다 — 꽉 찬 남색 판으로 두면 아래의 진짜 주 버튼
     (신청 준비 / 마감된 장학금)과 무게가 같아져 무엇이 주인지 흐려진다. */
  const foot = keys.length
    ? `<div class="elig-ask-foot">`
      + `<button type="button" class="elig-ask-later" data-elig-close="${esc(sch.id)}">나중에 하기</button>`
      + `<button type="button" class="elig-ask-save" data-elig-save="${esc(sch.id)}">저장</button>`
      + `</div>`
    : '';
  return `<div class="elig-ask elig-ask-on">`
    + `<button type="button" class="elig-ask-head" data-elig-close="${esc(sch.id)}"`
    + ` aria-expanded="true">맞춰 볼 자격 <b>${left}</b>${ELIG_CHEV}</button>`
    + `<div class="elig-ask-fields">${rows}</div>` + foot
    + `</div>`;
}

/* 묻는 칸의 줄들 — **공고 안 「미확인 자격」 상자와 대외활동 관문 「내 정보」가 같은 그림**을 쓴다(2026-11-15 · 베끼면 두 벌).
   값은 지금 프로필에서 읽어 채워 둔다 · 모으기는 eligAskCollect 한 곳 */
function eligAskRowsHtml(keys) {
  return keys.map((k) => {
    const pv = state.profile || {};
    /* 🔴 처지(trait) — 프로필에 칸이 없던 개인 사정은 **예/아니요**로 묻는다
       (2026-09-18 개발자 지시: "평점 말고 개인적인 부분들"). 종류는 parse-requirements
       의 TRAIT_PAT 이 정하고 칸 이름은 elig-ask 의 TRAIT_LABEL 이 갖는다 — 여기서 짓지 않는다. */
    if (k.indexOf('trait:') === 0) {
      const tk = k.slice(6);
      const now = ((pv.traits || {})[tk]);
      const yn = (v, lbl) => `<button type="button" class="elig-yn${now === v ? ' on' : ''}"`
        + ` data-elig-trait="${esc(tk)}" data-elig-val="${v ? '1' : '0'}">${lbl}</button>`;
      return `<div class="elig-ask-row elig-ask-yn"><span>${esc(typeof traitLabel === 'function' ? traitLabel(tk) : (TRAIT_LABEL[tk] || tk))}</span>`
        + `<span class="elig-yn-pair">${yn(true, '예')}${yn(false, '아니요')}</span></div>`;
    }
    const f = FIELD_META[k];
    const val = pv[k] != null ? String(pv[k]) : '';
    /* data-elig-was — 이 칸이 **처음에 보인 값**. 저장 때 그대로면 프로필을 건드리지 않는다(eligAskCollect). 선택 칸은 선택지에 없는 옛 값이면 빈 칸으로 보이므로 빈 글자 */
    const optVals = f.kind === 'select' ? f.options.map((o) => (o && o.value != null ? String(o.value) : String(o))) : null;
    const was = optVals ? (optVals.includes(val) ? val : '') : val;
    const input = f.kind === 'select'
      ? `<select class="elig-ask-in" data-elig-field="${k}" data-elig-was="${esc(was)}"><option value=""></option>`
        /* 선택지는 글자(`대한민국`) 또는 {value, label}(거주 기간 — 값은 개월 · elig-ask FIELD_META) */
        + f.options.map((o) => {
          const v = o && o.value != null ? String(o.value) : String(o);
          const l = o && o.label != null ? o.label : o;
          return `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`;
        }).join('')
        + `</select>`
      : `<input class="elig-ask-in" data-elig-field="${k}" data-elig-was="${esc(was)}" value="${esc(val)}" placeholder="—"`
        /* 숫자 칸도 type="text" 다 — type="number" 는 '999'·'e' 를 그대로 받고, 칠 때 막을 수 없다(input-guard.js).
           범위는 PROFILE_LIMITS 에 있는 칸이면 그것을 쓴다(data-guard) · 없으면 FIELD_META 의 min/max */
        + (f.kind === 'number'
          ? ` type="text" inputmode="${f.step === 1 ? 'numeric' : 'decimal'}" autocomplete="off" step="${f.step}" min="${f.min}" max="${f.max}"`
            + (typeof PROFILE_LIMITS !== 'undefined' && PROFILE_LIMITS[k] ? ` data-guard="${k}"` : ` data-guard-min="${f.min}" data-guard-max="${f.max}" data-guard-dec="${f.step === 1 ? 0 : 2}"`)
          : ' type="text"') + `>`;
    return `<label class="elig-ask-row"><span>${esc(f.label)}</span>`
      + `<span class="elig-ask-wrap">${input}`
      + (f.suffix ? `<em>${esc(f.suffix)}</em>` : '') + `</span></label>`;
  }).join('');
}
/* 예/아니요 알약은 누르는 즉시 그 칸만 켠다 — 저장은 부르는 쪽 단추가 한 번에 한다 */
function eligAskWireTraits(root) {
  $$('[data-elig-trait]', root).forEach((b) => b.addEventListener('click', () => {
    $$(`[data-elig-trait="${b.dataset.eligTrait}"]`, root).forEach((o) => { o.classList.remove('on'); delete o.dataset.eligPicked; });
    b.classList.add('on');
    b.dataset.eligPicked = '1';   // 학생이 **이번에 누른** 알약 — 처음부터 켜져 있던 것과 가른다(eligAskCollect)
  }));
}
/* 그 줄들에 적힌 답을 프로필에 옮긴다(저장은 부르는 쪽이) — 처지는 **고른 것만**(안 고른 칸을 false 로 적으면 '아니요'라고 답한 것이 된다).
   🔴 **학생이 건드린 칸만 적는다** (2026-11-15 리뷰). 대외활동 관문은 이미 답한 칸도 채워서 보이므로, 보인 값을 그대로 되적으면
      ① 선택지에 없는 값(옛 글자)이 빈 칸으로 보였다가 null 로 지워지고 ② 관문을 그려 둔 사이 학적정보에서 고친 값을 옛 값으로 덮으며
      ③ 온보딩이 받아 준 값(1945년생·19.5학점)이 이 칸의 범위로 깎인다. 처음 보인 값(data-elig-was)과 같으면 건너뛴다.
   시·도를 바꾸면 짝 시·군·구를 비운다(다른 시·도의 구가 남지 않게 · elig-ask FIELD_META 의 city) · 본인 거주지면 「지금 주소 거주 기간」도(온보딩과 같은 규칙) */
function eligAskCollect(root) {
  const wrote = new Set();
  $$('[data-elig-field]', root).forEach((el) => {
    if (el.value === (el.dataset.eligWas || '')) return;
    state.profile[el.dataset.eligField] = coerceField(el.dataset.eligField, el.value);
    wrote.add(el.dataset.eligField);
  });
  wrote.forEach((k) => {
    const city = (FIELD_META[k] || {}).city;
    if (city && !wrote.has(city)) state.profile[city] = null;
    if (k === 'region' && !wrote.has('residenceMonths')) state.profile.residenceMonths = null;
  });
  const picked = $$('[data-elig-trait].on[data-elig-picked]', root);
  if (picked.length) {
    state.profile.traits = Object.assign({}, state.profile.traits || {});
    picked.forEach((b) => { state.profile.traits[b.dataset.eligTrait] = b.dataset.eligVal === '1'; });
  }
}

/* innerHTML 을 채운 **뒤에** 배선한다 — openDetail 이 쓰는 방식 그대로.
   🔴 인라인 `onclick` 은 CSP(`script-src 'self'`)가 조용히 막는다(2026-09-09 boot.js). */
/* reopen — 다시 그리는 길. 장학은 openDetail, 대외활동은 openActivityDetail(2026-10-01) — 묻기 상자는 한 벌이다 */
function eligAskWire(sch, reopen = () => openDetail(sch.id)) {
  const sheet = $('#detail-sheet');
  const redraw = (open) => {
    /* 🔴 펼칠 때만 본 줄을 새로 고른다 — 저장 뒤 다시 그릴 때는 그대로 둔다 */
    eligAsk = open ? { id: sch.id, open: true, shown: null } : null;
    const y = sheet.scrollTop;
    reopen();
    sheet.scrollTop = y;
    const box = $('#detail-sheet .elig-ask');
    if (open && box) box.scrollIntoView({ block: 'nearest' });
  };
  const o = $('[data-elig-open]', sheet); if (o) o.addEventListener('click', () => redraw(true));
  /* 닫는 자리는 둘이다 — 머리줄(화살표)과 「나중에 하기」 */
  $$('[data-elig-close]', sheet).forEach((c) => c.addEventListener('click', () => redraw(false)));
  const s = $('[data-elig-save]', sheet); if (s) s.addEventListener('click', () => eligAskSave(sch, reopen));
  eligAskWireTraits(sheet);
}

function eligAskSave(sch, reopen = () => openDetail(sch.id)) {
  const sheet = $('#detail-sheet');
  if (!guardStepOk(sheet.querySelector('.elig-ask') || sheet)) return;   // 다 못 친 값은 저장하지 않고 짚는다
  eligAskCollect(sheet);
  saveState();
  /* 적은 것이 **다른 공고에도 쓰이므로** 목록·홈도 다시 그린다 */
  renderHome();
  renderExplore();
  if (!$('#screen-activities').hidden) renderActivities();   // 대외활동 카드의 적합도도 같은 프로필로 다시 잰다
  const y = sheet.scrollTop;
  reopen();                        /* 본 줄은 eligAsk.shown 에 그대로 있다 */
  sheet.scrollTop = y;
}

function closeSheet() {
  sheetBack = null;          // 흐름이 닫을 때는 돌아갈 곳도 지운다
  sheetListRender = null;    // 열려 있던 목록(금액 상세·히어로 줄 목록)도 놓는다 — 다음에 다른 데서 연 공고가 엉뚱한 목록으로 돌아가지 않게
  eligAsk = null;            // 자격 묻기 — 펼친 상태와 본 줄을 놓는다
  docPrep = null;
  /* 🔴 **쓰던 신청서 표시도 함께 내린다** (2026-09-09 코드 리뷰). 안 내리면 시트가 닫힌 뒤에도
     `formFill` 이 남아, ① 같은 시트를 쓰는 일괄 준비에서 체크만 해도 위임 리스너가
     `formProgressSave` 를 불러 **칸이 없는 화면에서 답을 모아 빈 값으로 덮어쓰고**
     ② 앱이 숨을 때 방금 지운 `sheet:{kind:'form'}` 을 다시 적어 다음에 켤 때 학생이
     닫은 신청서가 도로 열린다. 🔴 장부의 `form`(쓴 글)은 여기서 안 지운다 — 시트를 내린 것과
     쓴 글을 버리는 것은 다른 일이다. 지우는 곳은 `formProgressClear()` 하나뿐이다. */
  formFill = null;
  clearTimeout(formSaveTimer);
  /* 이어보기 — 시트를 닫았으니 '열려 있던 시트'도 지운다.
     🔴 쓰던 신청서(`form`)는 **여기서 지우지 않는다.** 학생이 시트를 내렸다고 해서
        쓴 글을 버리는 것은 아니다 — 그건 '이대로 신청 준비 완료'를 눌렀을 때만 지운다. */
  if (typeof resumeSave === 'function') resumeSave({ sheet: null });
  $('#sheet-backdrop').classList.remove('show');
  $('#detail-sheet').classList.remove('show');
  setTimeout(() => {
    $('#sheet-backdrop').hidden = true;
    $('#detail-sheet').hidden = true;
  }, 250);
}
