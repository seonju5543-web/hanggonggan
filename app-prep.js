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
  if (essayDefsFor(sch).length) {
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
  const formAtts = kosaf ? [] : atts.filter(isApplicationForm);
  /* 본문 사진(bodyImage)은 공고 원문 그 자체다 — '첨부 파일'로 늘어놓지 않는다(원문 링크가 준다) */
  const pdfRows = kosaf ? '' : formPdfRowsHtml(sch);
  /* 로봇이 PDF 로 둔 그 파일(이름이 같은 첨부)은 「원본 양식 그대로 보기」 줄이 이미 보여 준다 — 밑에 또 늘어놓지 않는다(PDF 신청서는 isApplicationForm 밖이라 여기 걸렸다 · 10-14 실측 선원가족) */
  const pdfNames = new Set(formPdfsFor(sch).map((f) => f.name));   // 이름으로만 거른다 — 학교가 같은 이름으로 다른 파일을 올리면 로봇이 크기 차이로 다시 바꾼다(form-pdf srcBytes)
  const otherAtts = atts.filter((a) => !formAtts.includes(a) && !a.bodyImage && !pdfNames.has(a.name));
  /* 첨부 줄 — 승인 시안 A(2026-10-14) 꼴: 아이콘 · 이름 · 작은 글씨(출처 · 크기) · 오른쪽 ↓. 신청서 양식 묶음엔 로봇이 바꿔 둔 원본 PDF 줄이 맨 위에 선다 */
  const kb = attachKb;
  const attList = (list, where) => `<ul class="doc-list">${list.map((a) => attachRowHtml(a, { meta: `${where}${kb(a)}` })).join('')}</ul>`;
  const excerpts = sch.excerpts || [];
  const certHtml = certStatusListHtml(sch);
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body" id="apply-prep">
      <h3 class="sheet-title">신청 준비</h3>
      <p class="sheet-provider">${esc(sch.name)} · 준비할 것을 확인하고 담아 두세요</p>
      ${(formAtts.length || pdfRows) ? `
      <h4>신청서 양식 <span class="channel-tag">공고 원본</span></h4>
      <ul class="doc-list">${pdfRows}${formAtts.map((a) => attachRowHtml(a, { meta: `학교 게시판 첨부 · 내려받기${kb(a)}` })).join('')}</ul>
      <p class="dp-note">${pdfRows ? '빈칸을 찾은 PDF 는 「양식 채우기」로 답을 얹을 수 있어요 — 문서는 그대로예요.' : '원본 파일을 내려받아 작성해 주세요.'}</p>` : ''}
      ${otherAtts.length ? `
      <h4>${kosaf ? '선발 공고문 <span class="channel-tag">재단 원문</span>' : '공고 첨부 파일'}</h4>
      ${attList(otherAtts, kosaf ? '재단 원문 첨부' : '학교 게시판 첨부')}` : ''}
      ${noticeSummaryHtml(excerpts)}
      ${certHtml}
      <h4>최종 제출 방법 <span class="channel-tag">${submitChannelLabel(sch)}</span></h4>
      <ol class="guide-list">${ch.guide.map((g) => `<li>${g}</li>`).join('')}</ol>
      ${schoolPortalNote(sch)}
      ${(kosaf && sch.contact) ? `<p class="doc-legend">문의 ${esc(sch.contact)}</p>` : ''}
      ${sourceNoteHtml(sch)}
      ${/* 🔴 '완료'라는 말을 학생이 아무것도 안 한 시점에 쓰지 않는다 (2026-10-13 개발자 결정 — 이 시트는 이제
           앱 지원문서가 없는 상시 제도·층2에서만 뜬다 · 그 밖은 양식 작성 화면이 먼저다) */ ''}
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

/* ══════════════════════════════════════════════════════════════════════════
   일괄 신청 준비 (2026-08-25 개발자 지시로 재설계)

   예전엔 브라우저 기본 `confirm()` 창 하나였다. 그 창은 앱이 아니라 **브라우저가**
   만드는 것이라 확인·취소 두 버튼밖에 못 넣는다 — 그래서 지원자격도 금액도 안 보이고,
   원하지 않는 장학금을 **한 건도 뺄 수 없었다**(전부 담거나 전부 취소).

   지금은 앱이 만든 목록이다. 겉에 보이는 것은 넷 — 체크 · 제목 · 자격 단어 · 금액.
   마감·배지·제출처·자격 원문은 '더보기' 안에 접는다(2026-08-25 개발자 지시).

   🔴 확인을 눌러도 학교·재단에 **실제 접수가 되는 것은 아니다**(운영원칙 1).
      일어나는 일은 '신청 준비 완료 상태로 신청내역에 담기는 것'이고, 화면 문구도 그렇게 적는다.
   🔴 시트 그릇은 #detail-sheet 를 그대로 쓴다 — 쓸어 닫기·배경 눌러 닫기·ESC 가 이미
      배선돼 있다. 새 시트를 만들면 그 배선을 또 해야 하고 한쪽만 고쳐져 갈라진다.
   ══════════════════════════════════════════════════════════════════════════ */
let bulkPrep = null;   // { list: [sch], ids: Set } — 목록이 열려 있는 동안만 산다

/* 서류(자소서·앱 양식)를 써야 끝나는 공고인가.
   🔴 신청내역의 '서류 작성 필요' 배지와 **같은 기준**이어야 한다 — 여기서 새 기준을
      만들면 두 화면이 같은 공고를 두고 다른 말을 한다. */
function bulkNeedsWork(sch) {
  /* 앱 지원문서(prep:)도 '쓸 것'이다 (2026-10-13 리뷰 — formId 만 보던 탓에 일괄 준비가 107건을 아무 문서 없이 '준비 완료'로 담았다) */
  return !!(essayDefsFor(sch).length || formTplIdFor(sch));
}

/* 일괄 준비 대상 — 자격 통과 · 아직 안 담음 · 마감 전 · 오래되지 않음.
   ⚠️ 목록을 **열 때와 확인을 누를 때 둘 다** 이 함수를 쓴다. 열 때만 거르면
      목록을 한참 보다가 자정을 넘겨 확인한 학생이 마감된 공고를 담게 된다. */
function bulkTargets() {
  return getMatches()
    .filter((m) => ['eligible', 'selective'].includes(m.result.status))
    .filter((m) => !state.applications.some((a) => a.id === m.sch.id))
    .filter((m) => dday(m.sch.deadline).days >= 0 && notStale(m.sch) && !m.sch.noApply)   // noApply: 신청 절차가 없는 공고(applyLock) — 일괄 시트에도 안 담는다(리뷰 2026-11-02 가 잡았다)
    .map((m) => m.sch)
    .sort((a, b) => deadlineTs(a) - deadlineTs(b));   // 마감일을 겉에 안 써도 급한 것이 위로
}

/* 지원 자격을 **단어로** 옮긴다.
   🔴 원문 문장을 잘라 단어를 만들지 않는다 — 자르면 뜻이 바뀐다. 등록할 때 이미
      구조로 저장해 둔 값(sch.eligibility)만 옮긴다 — evaluate() 가 읽는 그 값이다.
      하나도 없으면 지어내지 않고 '자격 원문 확인'이라고 말한다(원칙 8-1).
   순수 함수라 브라우저 없이 검사할 수 있다. */
/* 학적상태 낱말에 '생'을 붙일지 — `복학예정생`·`초과학기생`은 말이 안 된다 */
const BULK_STATUS_WORD = {
  재학: '재학생', 휴학: '휴학생', 졸업: '졸업생', 수료: '수료생', 대학원: '대학원생',
  복학예정: '복학예정', 초과학기: '초과학기', 졸업유예: '졸업유예', 자퇴: '자퇴',
  편입학: '편입생', 재입학: '재입학생',
};

/* 파서가 읽어 낸 조건 하나 → 화면에 띄울 낱말.
   🔴 숫자·지역·학적은 **원문에서 읽어 낸 값 그대로** 쓴다. 앱이 보태는 것은 조사뿐이다. */
function bulkCondWords(c, L) {
  const S = (typeof GRADE_SCALE !== 'undefined' && GRADE_SCALE) || {};
  switch (c.kind) {
    case 'grade':
      if (c.min == null) return [];
      /* 단위를 섞으면 재앙이다 — 백분위 70을 평점 70으로 적으면 학생이 오해한다 */
      if (c.scale === S.percent) return [`백분위 ${c.min} 이상`];
      if (c.scale === S.letter) return [`${c.min} 이상`];
      return [`평점 ${c.min} 이상`];
    case 'bracket': return c.max == null ? [] : [`소득 ${c.max}구간 이하`];
    case 'credits':
      if (c.min != null) return [`${c.min}학점 이상`];
      return c.max != null ? [`${c.max}학점 이하`] : [];
    case 'year':
      if (c.eq != null) return [`${c.eq}학년`];
      if (c.min != null) return [`${c.min}학년 이상`];
      return c.max != null ? [`${c.max}학년 이하`] : [];
    case 'status':
      return (c.anyOf || []).map((x) => BULK_STATUS_WORD[x] || x)
        .concat((c.not || []).map((x) => (BULK_STATUS_WORD[x] || x) + ' 제외'));
    case 'flags': return (c.anyOf || []).map((f) => L[f] || f);
    case 'nationality': return [c.eq === 'foreign' ? '외국인 유학생' : '대한민국 국적'];
    case 'age': return c.max == null ? [] : [`만 ${c.max}세 이하`];
    case 'residence': return (c.anyOf || []).slice(0, 2).map((r) => r + ' 거주');
    default: return [];
  }
}

/* 지원 자격을 **단어로** 옮긴다. 두 곳에서 가져온다.
   ① 등록할 때 사람이 구조로 넣어 둔 값(sch.eligibility) — evaluate() 가 읽는 그 값.
   ② 공고 원문 자격 줄 — 화면·적합도가 이미 쓰는 파서(parse-requirements.js)로 읽는다.
   ②가 필요한 이유: 등록 데이터의 eligibility 는 실제로 대부분 selective 하나뿐이라
   ①만 쓰면 거의 모든 공고가 '자격 원문 확인'으로만 뜬다(실측으로 확인).
   🔴 어느 쪽도 지어내지 않는다 — 문장을 잘라 만들지도 않는다. 원문에 실제로 적힌
      숫자·지역·자격만 읽어 조사만 붙인다. 하나도 못 읽으면 '자격 원문 확인'이다(원칙 8-1).
   순수 함수라 브라우저 없이 검사할 수 있다. */
const BULK_TAG_MAX = 5;
function bulkTags(sch) {
  const out = [];
  const add = (label) => { if (label && !out.includes(label)) out.push(label); };
  const e = (sch && sch.eligibility) || {};
  const L = (typeof FLAG_LABELS !== 'undefined' && FLAG_LABELS) || {};

  if (e.schoolOnly) add('우리 학교 공고');
  if (e.schoolsAny) add('지원 대상 대학');
  if (e.flagsAny) e.flagsAny.forEach((f) => add(L[f] || f));
  if (e.minGpa != null) add(`평점 ${e.minGpa} 이상`);
  if (e.maxBracket != null) add(`소득 ${e.maxBracket}구간 이하`);
  if (e.freshmanOnly) add('신입생만');
  else if (e.years && e.years.length) add(`${e.years.join('·')}학년`);
  if (e.tracks && e.tracks.length && typeof TRACKS !== 'undefined') {
    e.tracks.forEach((id) => {
      const tr = TRACKS.find((x) => x.id === id);
      if (tr) add(tr.label);
    });
  }
  if (e.seoulOnly) add('서울 거주');
  if (e.needCert) add('외국어성적');
  if (e.exchange) add('교환학생 예정');

  if (typeof parseLine === 'function' && typeof requirementLines === 'function') {
    for (const line of requirementLines(sch) || []) {
      if (out.length >= BULK_TAG_MAX) break;
      /* 대학원 전용 줄은 학부생 화면에 띄우지 않는다 — 파서가 이미 가려 준다 */
      if (typeof gradOnly === 'function' && gradOnly(line)) continue;
      for (const c of (parseLine(line).conds || [])) bulkCondWords(c, L).forEach(add);
    }
  }
  return out.slice(0, BULK_TAG_MAX);   // 못 읽었으면 칩 없음(2026-11-15 · 예전 '자격 원문 확인')
}

/* 목록 한 줄. 겉은 넷(체크·제목·자격 단어·금액)이고 나머지는 <details> 안이다.
   <details> 는 브라우저가 이미 가진 접기 기능이라 여닫는 코드가 한 줄도 필요 없다. */
function bulkRowHtml(sch) {
  const on = bulkPrep.ids.has(sch.id);
  const d = dday(sch.deadline);
  /* 줄마다 택1 묶음의 머리 줄(`head` · 상세 시트와 같은 이름표)을 그 묶음 첫 줄 위에 — 요건 줄로 세지 않는다(2026-11-17) */
  const reqs = (typeof requirementLines === 'function' ? requirementLines(sch, null, { withMeta: true }) : []).slice(0, 6);
  return `
    <div class="bulk-row${on ? '' : ' off'}" data-row="${esc(sch.id)}">
      <input type="checkbox" class="bulk-check" data-bulk="${esc(sch.id)}" ${on ? 'checked' : ''}
        aria-label="${esc(sch.name)} 준비 목록에 넣기" />
      <div class="bulk-main">
        <p class="bulk-name">${esc(sch.name)}${bulkNeedsWork(sch) ? '<span class="badge badge-pending">서류 작성 필요</span>' : ''}</p>
        <p class="bulk-tags">${bulkTags(sch).map((x) => `<span class="chip-sm">${esc(x)}</span>`).join('')}</p>
        ${amountLine(sch).text ? `<p class="bulk-amount">${esc(amountLine(sch).text.replace(/^금액 · /, ''))}</p>` : ''}${/* 모르는 금액은 줄 없음(2026-11-15 · amountLine 한 곳 · 예전 '금액 원문 확인') */ ''}
        <details class="bulk-more">
          <summary>더보기</summary>
          <div class="bulk-badges">
            <span class="badge badge-${sch.type === '교내' ? 'in' : 'out'}">${esc(sch.type)}</span>
            ${sch.program ? '<span class="badge badge-program">상시 제도</span>' : (ddayWords(d) ? `<span class="badge badge-dday ${d.cls}">${esc(ddayWords(d))}</span>` : '')}
            ${/* 🔴 '자동 등록 · 검수 전' 배지를 뺐다 (2026-09-17 개발자 지시 — 내부 공정은
                 관리자에게만). 운영 원칙 2 의 '정직한 표시'는 **학생이 판단에 쓸 수 있는 것**을
                 감추지 말라는 뜻이고, 우리 검수 공정의 단계는 거기 해당하지 않는다.
                 세는 곳은 관리자 '오늘 할 일'의 검수 전 카드 둘이다(_admin/admin.js). */ ''}
          </div>
          ${sch.deadline ? `<p class="bulk-meta">마감 ${esc(sch.deadline.replace(/-/g, '.'))}</p>` : ''}${/* 마감을 모르면 줄 없음(2026-11-15) */ ''}
          <p class="bulk-meta">${esc(submitChannelLabel(sch))}</p>
          ${reqs.length
            ? `<p class="bulk-meta-head">지원자격 (공고 원문)</p><ul class="bulk-reqs">${reqs.map((r) => `${r.head ? `<li class="r-pick">${esc(r.head)}</li>` : ''}<li>${esc(r.text)}</li>`).join('')}</ul>`
            : ''}
        </details>
      </div>
    </div>`;
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
  const { bill, count } = lastBill;
  const p = state.profile;
  const sum = (arr) => arr.reduce((s, m) => s + (m.won || 0), 0);
  /* 🔴 갈래는 **비어 있어도 그린다.** 승인받은 화면이 네 갈래이기 때문이다.
     처음에 '내용 없으면 통째로 숨김'을 넣었다가 개발자가 승인한 화면과 다른 것이 나갔다
     (2026-08-27). 보여 주고 승인받은 구조를 코드에서 조용히 바꾸지 말 것. */
  const grp = (title, right, note, rows, empty) => `
    <div class="ad-grp"><div class="ad-grp-h"><b>${title}</b><span>${rows ? right : '해당 없음'}</span></div>
    ${rows && note ? `<p class="ad-grp-note">${note}</p>` : ''}${rows || `<p class="ad-empty">${empty}</p>`}</div>`;

  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">금액 상세</h3>
      <p class="sheet-provider">${esc(p.school || '')}${p.campus ? ' · ' + esc(p.campus) : ''} · 신청 가능 ${count}건</p>
      <div class="ad-total">
        <p class="ad-total-lb">지금 받을 수 있는 장학금</p>
        <p class="ad-total-amt">${bill.assumedWon > 0 ? '약' : '최대'} ${won(bill.total)}</p>
        <p class="ad-total-sub">${bill.assumedWon > 0
          ? `금액을 못 읽은 ${bill.assumed.length}건은 어림잡아 더함`
          : `금액을 읽은 공고만 합산${bill.unknown.length ? ` · 못 읽은 ${bill.unknown.length}건 제외` : ''}`}</p>
      </div>
      ${grp('합산', `${bill.added.length}건 · ${won(sum(bill.added))}`, '',
        bill.added.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on' }))).join(''),
        '합산할 공고가 아직 없어요')}
      ${grp('중복 수혜 불가', `${bill.onlyOne.length + bill.dropped.length}건 중 ${bill.onlyOne.length}건`,
        '함께 받을 수 없는 공고입니다. 가장 큰 1건만 합산했습니다.',
        bill.onlyOne.map((m) => amountDetailRow(m, estOpt(m, { tone: 'on', check: true }))).join('')
        + (bill.dropped.length ? `<details><summary>함께 못 받는 공고 ${bill.dropped.length}건</summary>
          ${bill.dropped.map((m) => amountDetailRow(m, { dim: true, tone: 'off', note: '위 공고와 동시 수혜 불가' })).join('')}</details>` : ''),
        '모두 함께 받을 수 있는 공고입니다.')}
      ${grp('등록금 비율 환산', `${bill.estimated.length}건 · 추정`,
        '금액이 등록금 비율로만 적힌 공고입니다. 학교별 한 학기 등록금 기준 추정값이며 실제 금액과 다를 수 있습니다. 위 갈래에 이미 들어 있는 공고를 다시 적은 것이라 건수를 더하지 마세요.',
        bill.estimated.map((m) => amountDetailRow(m, { tone: 'est', text: '약 ' + won(m.won) })).join(''),
        '등록금 비율로 적힌 공고는 없어요')}
      ${/* 🔴 홈 히어로가 이 몫을 어림잡아 더하므로(2026-09-17 개발자 지시) 이 칸도 그렇게
           적어야 한다 — 합계에 넣어 놓고 '0원'이라고 적으면 두 숫자가 서로 다른 말을 한다.
           🔴 줄마다의 금액은 여전히 비어 있다(2026-11-15 · 예전 '금액 원문 확인'): 어림잡은 것은 **합계 한 곳**이지
              그 공고의 금액이 아니다(원칙 8-1 · parse-amount.js sumAmounts ④). */ ''}
      ${/* 갈래 이름 '금액 미확인' → '금액을 못 읽은 공고' (2026-11-15 · 개발자 결정 11-02 '미확인'류 글자 없음 · 히어로 아랫줄 「금액을 못 읽은 n건」과 같은 말) */ ''}
      ${grp('금액을 못 읽은 공고', bill.assumedWon > 0
          ? `${bill.unknown.length}건 · 어림 ${won(bill.assumedWon)}`
          : `${bill.unknown.length}건 · 0원`,
        bill.assumedWon > 0
          ? `원문에 금액이 없거나 첨부파일에만 있는 공고입니다. 이 중 ${bill.assumed.length}건은 위 합계에 한 건당 ${won(bill.assumedEach)}(확인된 공고들의 중앙값)으로 어림잡아 더했습니다 — 실제 금액과 다를 수 있습니다.`
          : '원문에 금액이 없거나 첨부파일에만 있는 공고입니다.',
        bill.unknown.length ? `<details><summary>공고 ${bill.unknown.length}건 보기</summary>
          ${bill.unknown.map((m) => amountDetailRow(m, { dim: true, tone: 'off', srcLink: true })).join('')}</details>` : '',
        '모든 공고의 금액을 확인했습니다.')}
      <p class="ad-foot">모든 금액은 공고 원문 기준입니다.<br>선발 결과에 따라 실제 수혜액은 달라질 수 있습니다.</p>
    </div>`;
  openSheetShell(keepScroll);   // 되돌아온 것이면 보던 자리로 (아니면 undefined → 맨 위)
  return true;
}

function renderBulkPrep() {
  const targets = bulkPrep.list;
  const ready = targets.filter((sch) => !bulkNeedsWork(sch));
  const need = targets.filter(bulkNeedsWork);
  $('#detail-sheet').innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-body">
      <h3 class="sheet-title">한 번에 신청 준비</h3>
      <p class="sheet-provider" id="bulk-sum"></p>
      <label class="bulk-all"><input type="checkbox" id="bulk-all" checked /> 전체 선택</label>
      ${ready.length ? `<p class="bulk-group-head">바로 준비 가능 · ${ready.length}건</p>${ready.map(bulkRowHtml).join('')}` : ''}
      ${need.length ? `<p class="bulk-group-head">서류 작성 필요 · ${need.length}건</p>${need.map(bulkRowHtml).join('')}
        <p class="dp-note">이 ${need.length}건은 담아 둔 뒤 신청내역에서 자소서·신청서 작성.</p>` : ''}
      <button class="btn btn-primary btn-lg" id="btn-bulk-go"></button>
      <p class="dp-note">※ 최종 제출은 한국장학재단·학교 등 공식 채널에서 이루어져요.</p>
    </div>`;
  bulkRefresh();
  $('#detail-sheet').scrollTop = 0;
}

/* 체크를 눌렀을 때 **목록을 다시 그리지 않는다** — 다시 그리면 펼쳐 둔 '더보기'가 접히고
   스크롤이 맨 위로 튄다. 바뀌는 것(줄 흐리기·합계·버튼)만 손댄다. */
function bulkRefresh() {
  const picked = bulkPrep.list.filter((sch) => bulkPrep.ids.has(sch.id));
  const total = picked.reduce((sum, sch) => sum + (sch.amountValue || 0), 0);
  /* 금액을 확인 못 한 공고는 합계에 넣지 않는다 — 지어낸 숫자를 섞지 않는다(원칙 8-1).
     홈 히어로의 '금액 미확인 n건 제외'와 같은 규칙이다. */
  const unknown = picked.filter((sch) => !sch.amountValue).length;
  $('#bulk-sum').textContent = `선택 ${picked.length}건 · 최대 ${won(total)}${unknown ? ` · 금액을 못 읽은 ${unknown}건 제외` : ''}`;
  const all = $('#bulk-all');
  if (all) all.checked = picked.length === bulkPrep.list.length;
  $$('#detail-sheet [data-bulk]').forEach((box) => {
    const row = box.closest('.bulk-row');
    if (row) row.classList.toggle('off', !box.checked);
  });
  const go = $('#btn-bulk-go');
  go.disabled = !picked.length;
  go.textContent = `선택한 ${picked.length}건 준비하기`;
}

function bulkStart() {
  /* 🔴 담기 직전에 마감을 한 번 더 본다. 목록을 열 때만 걸렀다면, 한참 보다가 자정을
     넘겨 확인한 학생이 마감된 공고를 담게 된다. 빠진 건은 조용히 버리지 않고 알린다. */
  const live = new Set(bulkTargets().map((sch) => sch.id));
  const picked = bulkPrep.list.filter((sch) => bulkPrep.ids.has(sch.id));
  const gone = picked.filter((sch) => !live.has(sch.id));
  const go = picked.filter((sch) => live.has(sch.id));
  if (!go.length) {
    closeSheet();
    toast(gone.length ? '고른 장학금 전부 그 사이 마감' : '준비할 수 있는 장학금이 없어요');
    return;
  }
  const need = go.filter(bulkNeedsWork);
  go.forEach((sch) => state.applications.push({
    id: sch.id, name: sch.name, appliedAt: nowStamp(), step: 0, docs: null, pending: bulkNeedsWork(sch), prep: {},
  }));
  saveState();
  if (typeof trackUse === 'function') go.forEach((sch) => trackUse('prep', sch.id));   // 일괄 신청 준비도 공고마다 한 번
  closeSheet();
  const goneMsg = gone.length ? ` · ${gone.length}건은 그 사이 마감돼 제외` : '';
  toast(need.length
    ? `${go.length - need.length}건 준비 완료 · ${need.length}건은 신청내역에서 서류를 이어서 쓰세요${goneMsg}`
    : `장학금 ${go.length}건 신청 준비 완료${goneMsg}`);
  showScreen('applications');
}

function applyAll() {
  const targets = bulkTargets();
  if (!targets.length) { toast('준비할 수 있는 장학금이 없어요'); return; }
  bulkPrep = { list: targets, ids: new Set(targets.map((sch) => sch.id)) };
  openSheetShell();
  renderBulkPrep();
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
   ⚠️ 일괄 신청 준비(`bulkTargets`)는 일부러 안 열었다 — 거기는 여러 건을 한꺼번에 고르는
      자리라 미달까지 섞으면 학생이 무엇을 고른 것인지 알 수 없게 된다.

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
