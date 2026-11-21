/* app-prep.js — 신청 준비(일괄 준비·신청 준비 시트·제출처 안내) (2026-11-19 app.js 에서 글자 그대로 떼어 냄)
   🔴 **app.js 보다 먼저 싣는다**(index.html · sw.js) — app.js 의 시작 코드·다른 화면이 이 파일의 함수를 부른다.
   🔴 맨 윗단에는 **함수 선언과 리터럴 값만** — app.js 의 상수·함수는 함수 안에서만 쓴다(먼저 실려서 그 자리엔 아직 없다).
   🔴 검사는 verify/app-source.cjs 가 app.js 의 표시 자리에 이 파일을 끼운 **나누기 전과 같은 글자**로 읽는다.
      관문 「app.js 나누기 — 떼어 낸 화면이 제자리에 실린다」. */
/* ---------------- 신청 준비 ---------------- */
function nowStamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
}

function finalizeApply(sch, docs) {
  const existing = state.applications.find((a) => a.id === sch.id);
  if (existing) {
    existing.pending = false;
    existing.docs = docs;
    existing.appliedAt = nowStamp();
  } else {
    state.applications.push({ id: sch.id, name: sch.name, appliedAt: nowStamp(), step: 0, docs, pending: false, prep: {} });
    if (typeof trackUse === 'function') trackUse('prep', sch.id);
  }
  saveState();
  const ch = officialChannel(sch);
  toast(`'${sch.name}' 신청 준비 완료 · 최종 제출은 ${ch.label}`);
  const current = $$('.screen').find((s) => !s.hidden);
  if (current) showScreen(current.id.replace('screen-', ''));
}

function applyTo(sch) {
  if (formTplIdFor(sch)) { // 공식 양식 또는 준비용 지원문서
    startFormFill(sch);
    return;
  }
  /* 6-1 (2026-11-21) — 공고가 올린 신청서 원본이 있으면 앱이 만든 문서(지원문서·서류 도우미)를 띄우지 않는다.
     원본 PDF 와 「양식 채우기」가 놓인 「신청 준비」 시트로 간다(hasOriginalForm · app-live 한 곳) */
  if (!hasOriginalForm(sch) && essayDefsFor(sch).length) {
    startDocPrep(sch);
    return;
  }
  /* 🔴 **여기서 곧장 finalizeApply 를 부르지 말 것** (2026-09-23 개발자 지적:
     "공고 대부분이 공고양식을 읽지 못하고 신청 준비 시작 버튼을 눌렀을때 바로 신청내역으로 이동").
     예전엔 앱 양식도 서류 도우미도 없는 공고는 **누르는 순간** '신청 준비 완료'가 됐다 —
     학생은 아무것도 준비하지 않았는데 신청내역에 '준비 완료'가 찍혔다(원칙 1 정직한 신청 상태).
     실측으로 마감 전 공고 112건 중 100건(층1 32 · 층2 68)이 이 길이었다.
     이제는 '신청 준비' 시트가 먼저 뜬다 — 원본 양식 파일 · 제출 서류 · 최종 제출 방법을 보여 주고,
     학생이 확인 버튼을 눌러야 담긴다. 관문: verify/test-collector.mjs 「신청 준비 시작 버튼」. */
  renderApplyPrep(sch);
}

/* 앱 양식이 없는 공고의 '신청 준비' 시트.
   🔴 여기서 새로 판정하지 않는다 — 제출처는 officialChannel · 채널 이름은 submitChannelLabel ·
      양식 첨부인지는 isFormAttachment(data.js) · 원문 링크 이름은 sourceNoteHtml 한 곳씩이다.
   🔴 앱 내부 사정(왜 앱 양식이 없는지)은 적지 않는다(2026-09-17 지시) — 학생이 할 일만 적는다.
   🔴 원본에 없는 서류·방법을 지어내지 않는다 — 발췌(excerpts)와 공고가 준 서류 이름만 옮긴다. */
function renderApplyPrep(sch) {
  const ch = officialChannel(sch);
  const atts = sch.attachments || [];
  const kosaf = sch.sourceKind === 'kosaf';
  /* 층2 첨부는 재단이 올린 **선발 공고문**이다 — 신청서라고 부르면 학생이 그 안에서 빈칸을 찾는다
     (상세 시트의 '선발 공고문' 머리말과 같은 규칙) */
  /* 신청서 묶음 — 신청서인가는 attIsForm 한 곳(로봇이 원본 내용으로 가른 roles 가 먼저 · app-live) + PDF 로 올라온 신청서(사본과 이름이 같은 첨부 · 개발자 11-20 「원래 PDF 는 두 곳 다」 — 위 PDF 줄과 맨 밑 원본 둘 다) */
  const formNames = new Set(formPdfsFor(sch).map((f) => f.name));
  const formAtts = kosaf ? [] : atts.filter((a) => a && !a.bodyImage && (attIsForm(sch, a) || formNames.has(a.name)));
  /* 본문 사진(bodyImage)은 공고 원문 그 자체다 — '첨부 파일'로 늘어놓지 않는다(원문 링크가 준다) */
  const otherAtts = atts.filter((a) => a && !a.bodyImage && !formAtts.includes(a));
  /* 2026-11-20 승인 시안(docs/designs/all-docs-pdf.md) — 묶음마다 위는 PDF 줄(attachPdfRowsHtml 한 곳 · 첨부 차례), 맨 밑은 올린 원본(아이콘 · 이름 · ↓ · 작은 글씨 없음) */
  /* 공고문에서 뗀 서식 쪽(form-pages)도 여기 선다(2026-11-21 · 6-1 — 원본이 있는 공고가 이제 이 시트로 온다) — 자리는 지원문서 머리(prepOriginalsHtml)와 같다:
     PDF 줄 → 서식 쪽 → 올린 원본. 층1은 신청서 묶음에, 층2는 선발 공고문 묶음에 */
  const pageRows = formPageRowsHtml(sch);
  const listOf = (list, pages = '') => `<ul class="doc-list">${attachPdfRowsHtml(sch, list)}${pages}${list.map((a) => attachRowHtml(a)).join('')}</ul>`;
  const excerpts = sch.excerpts || [];
  const certHtml = certStatusListHtml(sch);
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" id="apply-prep">
      <h3 class="sheet-title">신청 준비</h3>
      <p class="sheet-provider">${esc(sch.name)} · 준비할 것을 확인하고 담아 두세요</p>
      ${(formAtts.length || (!kosaf && pageRows)) ? `
      <h4>신청서 양식 <span class="channel-tag">공고 원본</span></h4>
      ${listOf(formAtts, kosaf ? '' : pageRows)}` : ''}
      ${(otherAtts.length || (kosaf && pageRows)) ? `
      <h4>${kosaf ? '선발 공고문 <span class="channel-tag">재단 원문</span>' : '공고 첨부 파일'}</h4>
      ${listOf(otherAtts, kosaf ? pageRows : '')}` : ''}
      ${noticeSummaryHtml(excerpts)}
      ${certHtml}
      <h4>최종 제출 방법 <span class="channel-tag">${submitChannelLabel(sch)}</span></h4>
      <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
      ${schoolPortalNote(sch)}
      ${(kosaf && sch.contact) ? `<p class="doc-legend">문의 ${esc(sch.contact)}</p>` : ''}
      ${sourceNoteHtml(sch)}
      ${/* 🔴 '완료'라는 말을 학생이 아무것도 안 한 시점에 쓰지 않는다 (2026-10-13 개발자 결정). 이 시트가 뜨는 곳 —
           공고가 올린 신청서 원본이 있는 공고(2026-11-21 · 6-1) · 앱 지원문서가 없는 상시 제도. 그 밖은 앱 지원문서 작성 화면이 먼저다 */ ''}
      <button class="btn btn-primary btn-lg" id="btn-prep-confirm">확인했어요 — 신청내역에 담기</button>
      ${/* 정직한 신청 상태(원칙 1)는 한 마디로 — 긴 설명은 뺐다(2026-10-15) */ ''}
      <p class="dp-note">신청내역에 담길 뿐, 학교·재단에 접수되지는 않아요.</p>
    </div>`;
  /* 확인하면 **닫지 않고 그 공고의 '준비 완료' 화면을 연다** (2026-09-23 리뷰) — 다음 할 일
     (메일 접수 버튼·제출처 열기·'공식 제출 완료로 기록')이 거기 있다. 닫아 버리면 메일 접수
     공고는 버튼을 찾으러 공고를 다시 열어야 했다. */
  $('#btn-prep-confirm').addEventListener('click', () => {
    finalizeApply(sch, null);
    openDetail(sch.id);
  });
  if (typeof attachFormFillButtons === 'function') attachFormFillButtons(sch, $('#detail-sheet'));   // 빈칸을 찾은 PDF 에만 「양식 채우기」(formfill.js)
  $('#detail-sheet').scrollTop = 0;
}

/* ── 금액 상세 (2026-08-27) ────────────────────────────────────
   홈의 '최대 N원'을 누르면 열린다. 그 숫자가 **어떻게 나왔는지 줄 단위로** 보여 준다.
   갈래를 넷으로 나눈 이유: 합계 하나만 보여 주면 방어가 안 되고, 갈래를 나누면
   각 줄이 원문을 근거로 갖는다. 특히 **안 더한 것도 보여 준다** — 감춘 게 아니라
   이유가 있다는 걸 학생이 봐야 한다(개발자와 확정한 배치).

   🔴 여기서 다시 계산하지 않는다. renderHome 이 만든 lastBill 을 그대로 그린다 —
      따로 계산하면 히어로 숫자와 상세가 다른 말을 하게 된다. */
/* 🔴 **추정값을 확정값처럼 적지 않는다** (2026-09-11 코드 리뷰에서 잡았다).
   2026-09-10 수리로 비율형(`등록금 100%`)도 이중수혜 갈래를 거치게 되면서, 같은 공고가
   `added`(또는 `onlyOne`)와 `estimated` **양쪽에** 들어간다 — 합계는 맞지만(한 번만 더한다)
   화면은 네 갈래를 서로 안 겹치는 것처럼 그리고 있었다. 그래서 ① 건수를 더하면 공고 수보다
   많아지고 ② 무엇보다 합산 줄이 `400만원` 이라고 **딱 떨어지게** 적었다 — 그 값은 학교 평균
   등록금에서 뽑은 추정인데 확정된 금액처럼 읽힌다(원칙 8-1 · 이 파일 첫머리의 '기망').
   ⚠️ 계산은 건드리지 않는다 — `parse-amount.js` 의 total 은 옳다. 적는 법만 고친다. */
function estOpt(m, opt) {
  const bill = lastBill && lastBill.bill;
  if (!bill || bill.estimated.indexOf(m) < 0) return opt;
  return Object.assign({}, opt, { tone: 'est', text: '약 ' + won(m.won) });
}

function amountDetailRow(m, opt) {
  const o = opt || {};
  const sch = m.ref, a = sch.amountSpec || null;
  const val = o.text || (m.won ? won(m.won) : '');   // 모르는 금액은 비운다(2026-11-15 · 예전 '금액 원문 확인' — 갈래 이름이 이미 그 사실을 말한다)
  /* 줄을 누르면 **그 공고의 상세 시트**가 뜬다 (2026-08-27 개발자 지시로 변경).
     처음엔 장학금 탭으로 옮겨 그 카드를 찾아 스크롤했는데, 카드를 못 찾으면(필터·정렬·
     마감 숨김) 아무 일도 안 일어난 것처럼 보였다. 지금은 찾아가지 않고 **바로 연다** —
     장학금 탭에서 카드를 누른 것과 같은 화면이다.
     시트 그릇(`#detail-sheet`)이 금액 상세와 같아서 내용만 갈린다(새 시트를 만들지 않는다).
     안쪽 `원문 보기` 를 여닫는 클릭은 이동이 아니다 — 아래 핸들러가 details·a 를 걸러낸다. */
  const cls = (o.dim ? 'ad-row dim' : 'ad-row') + ' tappable';
  const merged = (m.mergedFrom || []).length;
  /* 🔴 **수집한 글이므로 `esc()` 앞에서 기호를 되돌린다** (2026-09-13).
     이 두 줄은 게시판 원문에서 그대로 온다 — `취 &middot; 창업지원금` 처럼 HTML 기호가
     섞여 있고, `esc()` 만 하면 `&` 가 한 번 더 감싸져 학생 화면에 **글자로** 뜬다.
     ⚠️ 순서를 뒤집지 말 것 — `esc()` 뒤에 되돌리면 `&amp;middot;` 가 돼 영영 안 풀린다.
     (2026-09-11 에 `n.title`·`n.deadlineHint` 에서 같은 사고가 있었다. 그때 관문은
      **칸 이름 두 개만** 보는 손 목록이라 이 자리를 못 잡았다 — 관문도 함께 넓혔다.) */
  /* 인용은 통째로 싣거나 통째로 뺀다 — '모름'류 낱말이 있는 원문·재단 글(「지원금액: ※ 기관확인필요」 · 「… 단, 소득분위 확인 필요」)은 따옴표 안에 싣지 않는다(knownValue · 2026-11-16 2차 리뷰 · 원칙 8-1).
     자른 글을 원문이라며 보이면 조건이 사라진 문장이 된다 — 그때는 아래 원문 링크만 남는다 */
  const raw = a && a.raw ? knownValue(unent(a.raw)) : '';
  const exRaw = sch.exclusivity && sch.exclusivity.raw ? knownValue(unent(sch.exclusivity.raw)) : '';
  return `<div class="${cls}" data-goto="${esc(sch.id)}" role="button" tabindex="0">
    <div class="ad-top"><p class="ad-name">${esc(sch.name || '')}</p>
      ${val || o.check ? `<p class="ad-val ${o.tone || ''}">${o.check ? '<span class="ad-chk">✓</span>' : ''}${esc(val)}</p>` : ''}</div>
    ${o.note ? `<p class="ad-note">${esc(o.note)}</p>` : ''}
    ${merged ? `<details><summary>${esc(schoolOfNotice(m.mergedFrom[0]) || '다른 학교')} 외 ${merged}건</summary>
      <div class="ad-list"><span>같은 재단이 여러 학교에서 접수하는 공고. 1건으로 합산.</span>
      ${[sch, ...m.mergedFrom].map((x) => `<span>${esc(providerUnknown(x.provider) ? (x.name || '') : x.provider)}</span>`).join('')}</div></details>` : ''}
    ${/* 층2는 우리가 읽은 공고 원문이 아니라 재단이 한국장학재단에 적어 둔 칸이다 — '원문'이라 부르지 않는다 (2026-10-03) */ ''}
    ${raw || exRaw ? `<details><summary>${sch.sourceKind === 'kosaf' ? '재단이 적어 둔 글' : '원문 보기'}</summary>
      <p class="ad-src">"${esc(raw || exRaw)}"<em>${esc(noticeSourceLabel(sch))}</em></p></details>`
    /* 🔴 발췌가 없으면 지어내지 않고 **원문으로 가는 길**을 준다 (원칙 8-1).
       금액이 첨부파일이나 제목에만 있어 사람이 손으로 넣은 공고가 있다 — 화면에 금액이
       뜨는데 근거를 하나도 못 보여 주는 상태로 두면 안 된다(개발자 지적 2026-08-27).
       게시판 목록 주소인 공고는 '원문 공고'라고 쓰면 거짓말이라 라벨을 바꾼다. */
    : (o.text || m.won || o.srcLink ? amountSourceLinkHtml(sch) : '')}
  </div>`;
}

/* 금액 상세 한 줄의 출처 링크 — 이름은 sourceLink(sch, 'amount') 한 곳 (2026-10-03 · 원문 링크 정직성).
   🔴 층2(재단 홈페이지)를 '원문 공고'라 부르던 자리다 — 상세 시트는 '재단 홈페이지'라 하는데 여기만
      `program`·`#n-` 둘만 보고 나머지를 전부 원문이라 불렀다(같은 재단 홈페이지가 화면마다 다른 이름). */
function amountSourceLinkHtml(sch) {
  const link = sourceLink(sch, 'amount');
  const href = safeUrl(link.href);
  return href ? `<p class="ad-link"><a href="${esc(href)}" target="_blank" rel="noopener">${esc(link.label)}</a></p>` : '';
}

/* 원문 발췌 밑에 붙는 출처 한 줄 — `광운대학교 게시 원문`.
   🔴 학교 이름을 줄이지 않는다(기관명 축약 금지) — provider 의 `(광운대 접수)` 대신
      eligibility.schoolOnly 의 정식 명칭을 쓴다. 둘 다 없으면 출처를 지어내지 않고 비운다. */
const noticeSourceLabel = (sch) => {
  if (sch && sch.sourceKind === 'kosaf') return '한국장학재단 등록 정보';   // 층2 — 공고 원문이 아니다(2026-10-03)
  const school = (sch && sch.eligibility && sch.eligibility.schoolOnly) || '';
  return school ? `${school} 게시 원문` : '공고 원문';
};

const schoolOfNotice = (sch) => {
  const m = String(sch && sch.provider || '').match(/\(([^)]*대학교[^)]*)\s*접수\)/);
  return m ? m[1] : (sch && sch.school) || '';
};

function renderAmountDetail(keepScroll) {
  /* 못 그렸다는 것을 부르는 쪽이 알아야 한다 — dismissSheet 가 이 값을 보고 닫는다 */
  if (!lastBill) return false;
  const { bill } = lastBill;
  /* 🔴 2026-11-20 개발자 지시 — 「자격 요건 매칭」 갈래 하나만 남기고 나머지(합계 상자 · 중복 수혜 불가 · 등록금 비율 환산 · 금액을 못 읽은 공고 · 맺음말)는 지웠다:
       "총장학금 클릭 시, 자격요건매칭만 나오게 하고 나머지는 모두 삭제해줘. 추정 값도 그대로 자격 요건 매칭 칸에 들어가게 하고 앞에 약이라는 표현만 써."
     줄 = 수령 가능액 합계에 실제로 더한 것 그대로 — added(같이 받을 수 있는 것) + onlyOne(함께 못 받는 것 중 고른 1건) + assumed(금액을 못 읽어 어림잡아 더한 것).
     그래서 줄 금액을 더하면 머리줄 합계(= 홈 수령 가능액)와 맞는다.
     · 등록금 비율로 적힌 공고 → 「약 n만원」(estOpt)
     · 금액이 안 적힌 공고 → 「약 n만원」(확인된 공고들의 중앙값 — 개발자 결정 11-20 "②도 '약 n만원'으로 표시". 그 공고의 금액이 아니라 어림값이라 반드시 「약」)
     🔴 합계에 안 든 공고(함께 못 받아 뺀 것 · 넓게 막혀 어림에서도 뺀 것)는 이 목록에 없다 — 줄 합계와 머리줄이 갈라지지 않게 */
  const rows = []
    .concat(bill.added.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on' }))))
    .concat(bill.onlyOne.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on' }))))
    .concat((bill.assumed || []).map((m) => amountDetailRow(m, { tone: 'on', text: '약 ' + won(bill.assumedEach) })));
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">금액 상세</h3>
      <div class="ad-grp"><div class="ad-grp-h"><b>자격 요건 매칭</b><span>${rows.length}건 · ${won(bill.total)}</span></div>
      ${rows.join('') || '<p class="ad-empty">지금 신청할 수 있는 장학금이 없어요</p>'}</div>
    </div>`;
  openSheetShell(keepScroll);   // 되돌아온 것이면 보던 자리로 (아니면 undefined → 맨 위)
  sheetListRender = renderAmountDetail;
  return true;
}

/* ── 히어로 안내 줄을 누르면 열리는 목록 (2026-11-20 승인 시안 「가리키는 마스코트」) ──
   수령 가능액 → 「자격 요건 매칭」 목록(위 renderAmountDetail · 줄을 누르면 그 공고의 상세 시트) · 매칭된 공고 줄은 열지 않는다(11-20 개발자 지시 — 같은 내용이라 수령 가능액만) ·
   마감 → 그날 마감인 공고 · 이어서 쓰기 → 쓰던 신청서.
   🔴 숫자는 renderHome 이 센 값(lastHero · lastBill) 그대로 — 여기서 다시 판정하지 않는다.
   🔴 공고 줄은 금액 상세와 같은 줄(amountDetailRow)이고 금액 색은 하나다(2026-11-20 개발자 지시 · 추정은 「약」 글자로만).
   공고로 들어갔다 내리면 **이 목록**으로 돌아온다(sheetListRender — rememberAmountBack 이 읽는다). */
let sheetListRender = null;

/* 공고 하나 → 금액 상세의 그 줄(합친 공고는 대표 줄 하나) */
function billItemFor(sch) {
  const b = lastBill && lastBill.bill;
  if (!b) return null;
  const all = [].concat(b.added || [], b.onlyOne || [], b.dropped || [], b.unknown || []);
  return all.find((m) => m.ref === sch || (m.mergedFrom || []).indexOf(sch) >= 0) || null;
}

function renderDueList(keepScroll) {
  if (!lastHero || !lastHero.dueList.length) return false;
  const d = lastHero.dueDays, dd = d === 0 ? 'D-Day' : `D-${d}`;
  const rows = lastHero.dueList.map((m) => {
    const item = billItemFor(m.sch);
    const assumed = item && (lastBill.bill.assumed || []).indexOf(item) >= 0;   // 금액을 못 읽어 어림한 것 — 수령 가능액 목록과 같은 「약」
    const val = !item ? '' : assumed ? '약 ' + won(lastBill.bill.assumedEach) : (estOpt(item, {}).text || (item.won ? won(item.won) : ''));
    return `<div class="hero-due-row tappable" data-goto="${esc(m.sch.id)}" role="button" tabindex="0">
      <span class="hero-due-dd">${dd}</span>
      <span class="hero-due-t">${esc(m.sch.name || '')}${val ? `<span class="hero-due-m">${esc(val)}</span>` : ''}</span>
    </div>`;
  }).join('');
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">마감 ${dd} · ${lastHero.dueList.length}건</h3>
      <p class="sheet-provider">${d === 0 ? '오늘' : `${d}일 뒤`} 마감인 매칭 공고</p>
      ${rows}
    </div>`;
  openSheetShell(keepScroll);
  sheetListRender = renderDueList;
  return true;
}

function renderDraftSheet() {
  const dr = typeof resumeDraft === 'function' ? resumeDraft() : null;   // 열 때 장부를 다시 읽는다 — 홈을 그린 뒤 더 쓴 것까지
  if (!dr) return false;
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">이어서 쓰기</h3>
      <p class="sheet-provider">쓰다 만 신청서</p>
      <div class="hero-draft-card">
        <p class="hero-draft-t">${esc(dr.sch.name || dr.sch.title || '')}</p>
        <p class="hero-draft-m">${esc(agoLabel(dr.prog.at))}에 쓰던 것</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-hero-draft">이어서 쓰기</button>
    </div>`;
  openSheetShell();
  sheetListRender = null;
  $('#btn-hero-draft').addEventListener('click', () => { sheetBack = null; startFormFill(dr.sch, dr.prog); });
  return true;
}

/* 히어로 줄 → 그 줄의 목록 (app-mascot.js 가 줄을 누른 뒤 부른다) */
function openHeroLine(k) {
  if (k === 'amount') return renderAmountDetail();
  if (k === 'due') return renderDueList();
  if (k === 'draft') return renderDraftSheet();
  return false;
}

/* 🔴 **'신청 버튼을 누를 수 있는가'의 단 하나의 기준** (2026-09-13 · 노션 백로그 핵심-2).
   화면(openDetail)과 검사 도구(verify/what-shows.mjs)가 **같은 함수**를 쓴다.
   ⚠️ 베껴 두면 갈라진다 — 실제로 갈라져 있었다: 이 규칙이 openDetail 안의 지역 변수라
      what-shows 가 제 사본을 들고 있었고, 잠금을 푼 뒤에도 계속 '잠김'이라 보고했다.
      (그 파일 머리말은 "앱 규칙을 한 줄도 베끼지 않는다"고 적어 둔 채였다.)

   🔴 **자격 판정으로는 막지 않는다.** 예전에는 `['eligible','selective']` 가 이 식에
   함께 있어서 미달·미확인이면 버튼이 통째로 잠겼다. 그런데 우리 판정은 100% 가 아니다 —
   원문을 못 받았거나(`unknown`) 축이 없어서 미달이 된 공고가 실제로는 신청 가능하고,
   막아 버리면 그 학생은 받을 수 있는 장학금을 **영영 못 본다**. 판정은 참고로 보여 주고
   **결정은 학생이 한다**(caution 이 무엇을 확인해야 하는지 말한다).

   ⚠️ 마감(`d.days >= 0`)과 이미 신청함(`app.pending`)은 **그대로 막는다** — 그 둘은
      우리 판정이 아니라 **사실**이다. 마감된 공고를 신청하게 하는 것은 정직하지 않다(원칙 1).

   caution — 자격이 확인되지 않은 채 신청하는 경우에만 값이 있다(없으면 빈 문자열).
   🔴 **모르는 것을 '미충족'이라고 부르지 않는다** (2026-09-09 에 배운 것을 여기로 옮겼다).
      `unknown` 은 '요건에 못 미친다'가 아니라 **'우리가 못 읽었다'**는 뜻이다 — 동산장학회
      (이공계 새터민)에서 실제로 그랬다: 새터민이고 이공계이고 성적도 넘는 학생인데 자격 줄
      셋 중 둘을 못 읽어 unknown 이 됐고, 화면은 그 학생에게 '요건 미충족'이라 단정했다.
      그때는 **버튼 문구만** 갈랐고 잠금은 안 갈라서, 그 학생은 여전히 못 눌렀다. */
/* 🔴 fd(fitDetailFor) — 자격 줄을 한 줄도 못 읽은 공고(fd.unread)도 「원문에서 자격을 보라」 한 문장을 단다 (2026-11-16 리뷰). 정식 등록 공고는 거의 다
   status 'selective' 라 status 갈래로는 안내가 영영 안 붙고, 「자격 미확인」 배지도 뺐으니(11-02 결정) 앱이 자격을 확인해 준 공고와 똑같아 보인다.
   문장은 'unknown' 갈래와 같은 것(모르는 것을 말하는 낱말이 없는 할 일 안내) · 판정은 바꾸지 않는다(버튼은 그대로 열린다) */
function applyLock(result, app, d, sch, fd) {
  /* 🔴 원문이 「별도 신청 없이 학교가 선발」이라 적은 공고(noApply = 그 원문 문장 · 관리자가 적는다 · 2026-11-02 세종대 학업수석총장장학금) —
     자격이 맞아도 버튼을 열지 않는다. 열면 학생이 없는 절차를 준비한다. 홈 「바로 신청」·앱 지원문서도 같은 칸을 본다. */
  if (sch && sch.noApply) return { canApply: false, caution: '', noApply: true };
  const canApply = (!app || app.pending) && d.days >= 0;
  const unsure = !['eligible', 'selective'].includes((result && result.status) || '');
  const caution = !canApply ? '' : unsure ? result.status : (fd && fd.unread ? 'unknown' : '');
  return { canApply, caution };
}
