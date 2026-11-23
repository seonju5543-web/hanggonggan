/* ============================================================
   한대장 — 실제 장학금 양식 엔진
   실제 공고에 첨부된 신청 양식을 스키마로 옮겨,
   질문으로 정보를 모으고 원본과 동일한 구조의 문서를 생성한다.

   양식 원본(single source of truth)은 data/forms.json.
   새 양식은 forms.json에만 추가하면 설치된 앱에도 재설치 없이
   자동 반영된다(서비스워커가 data/*.json은 네트워크 우선).
   아래 내장 2종은 오프라인·첫 화면용 폴백 — forms.json과 동일 내용 유지.
   (새 양식 추가 절차: 수집 로봇이 첨부를 리포트 → 개발자 컨펌 →
    deep-fetch로 원본 확보 → 스키마화해 data/forms.json에 등록)
   ============================================================ */

const FORM_TEMPLATES = {
  /* 출처: 한국장학재단 '대학생 청소년 AI 교육지원 사업' 공고 첨부 양식(별첨) —
     원본 HWP의 항목·문구·체크 옵션을 그대로 반영 */
  'kosaf-ai-mentor': {
    title: '대학생 청소년 AI 교육지원장학금 활동계획서',
    docName: 'AI교육지원장학금_활동계획서',
    org: '한국장학재단 귀하',
    pledge: '본인은 위 내용이 사실임을 확인하며, 선발 시 활동계획서에 따라 성실히 멘토링을 이행하겠습니다.',
    sections: [
      {
        heading: '1. 기본정보',
        info: [
          ['대학명', 'school', '학과(전공)', 'major'],
          ['성명', 'name', '학번', 'studentId'],
          ['휴대폰번호', 'phone', '이메일 주소', 'email'],
        ],
      },
      {
        heading: '2. 멘토링 활동 계획',
        fields: [
          { id: 'level', label: '희망 대상 학교급', type: 'checks',
            q: '어느 학교급 학생을 가르치고 싶나요? (중복 선택 가능)',
            options: ['초등학교', '중학교', '고등학교'], suffix: '※ 중복 선택 가능' },
          { id: 'region', label: '희망 멘토링 지역', type: 'text',
            q: '멘토링을 하고 싶은 지역', placeholder: '예: 서울 동대문구 일대' },
          { id: 'period', label: '희망 활동기간', type: 'text',
            q: '활동 가능 기간', placeholder: '예: 2026. 09. 01 ~ 2026. 12. 20',
            preset: '2026. 09. 01 ~ 2026. 12. 20' },
          { id: 'schedule', label: '희망 스케줄\n(희망 요일 체크 및 희망시간 기입)', type: 'schedule',
            q: '가능한 요일을 고르고 시간을 적어주세요' },
        ],
      },
      {
        heading: '3. AI 활용 경험 및 역량',
        fields: [
          { id: 'tools', label: '활용 가능한 AI 도구\n(또는 프로그램)', type: 'checks+text',
            q: '써 본 AI 도구를 모두 고르세요',
            options: ['ChatGPT / Gemini 등 대화형 AI', '이미지 생성 AI (예: DALL-E, Midjourney 등)',
              '영상·음악 생성 AI', 'Canva AI 등 디자인 도구',
              'Scratch / 엔트리 / 코딩 프로그램', 'Python 등 프로그래밍 도구'],
            textLabel: '활용 경험(간단히)', tq: '사용 경험을 한두 문장으로',
            sugg: ['과제·아이디어 정리에 대화형 AI를 주 3회 이상 활용하고 있습니다.',
              '교내 프로젝트에서 이미지 생성 AI로 포스터를 제작해 봤습니다.'] },
          { id: 'exp', label: 'AI 관련 활동 경험', type: 'checks+text',
            q: 'AI 관련 경험이 있다면 (해당 항목 모두 선택 · 없으면 선택 안 함)',
            options: ['AI·SW 관련 수업 수강 경험', 'AI·SW 관련 자격증 또는 교육 수료 경험',
              '공모전, 프로젝트, 동아리, 대외활동 경험', '기타 AI·디지털 도구 활용 경험'],
            textLabel: '작성', tq: '경험 내용 (없으면 비워두세요 — "없음"으로 기재)',
            sugg: ['교양 수업에서 AI 리터러시 과목을 이수했습니다.'] , emptyText: '없음' },
        ],
      },
      {
        heading: '4. AI 활동계획서',
        note: '(아래 항목은 멘토 선발의 핵심 평가자료로 활용됨)',
        fields: [
          { id: 'topic', label: '멘토링 프로그램 주제', type: 'textarea',
            q: '멘티와 함께 하고 싶은 AI 활동 주제',
            sugg: ['AI와 함께 만드는 우리 반 그림책', '나만의 학습 도우미 챗봇 만들기', 'AI로 만드는 우리 동네 소개 영상'] },
          { id: 'method', label: '활용하고자 하는\nAI 도구 및 활용방법', type: 'textarea',
            q: '사용할 도구와 활용 방법 (번호로 1~3가지)',
            sugg: ['1. 대화형 AI — 주제 아이디어 발산과 이야기 구성\n2. 이미지 생성 AI — 삽화·포스터 제작\n3. Canva — 결과물 편집과 완성'] },
          { id: 'output', label: '멘티와 함께 만들고자 하는 최종 결과물', type: 'textarea',
            q: '최종 결과물을 구체적으로',
            sugg: ['멘티가 주인공인 8쪽짜리 그림 동화책', '학교 소개 카드뉴스 5장', '1분 분량의 동네 소개 영상'] },
          { id: 'operate', label: '멘티 참여 방식 및\n운영 아이디어', type: 'textarea',
            q: '멘티를 어떻게 참여시키고 운영할까요?',
            sugg: ['매 회차 멘티가 직접 프롬프트를 작성하고 결과를 비교·선택하게 해 주도성을 키우고, 회차 말미에 서로의 결과물을 발표하는 시간을 둡니다.'] },
          { id: 'ethics', label: 'AI 윤리·안전\n고려사항', type: 'textarea',
            q: '허위정보·저작권·개인정보·편향 등을 어떻게 지도할까요?',
            sugg: ['AI 결과물을 함께 사실 검증하는 습관을 들이고, 개인정보를 입력하지 않는 규칙과 생성물 출처 표기를 매 회차 지도합니다.'] },
        ],
      },
      {
        heading: '5. 멘토로서의 강점',
        fields: [
          { id: 'strength', label: '멘토로서 본인의 강점', type: 'textarea',
            q: '멘토로서 나의 강점 (소통 능력, 교육 경험, 책임감 등)',
            sugg: ['과외·봉사로 다져진 눈높이 소통 능력과 끝까지 완주하는 책임감이 강점입니다.',
              '전공 프로젝트 경험을 바탕으로 결과물 완성까지 이끌 수 있습니다.'] },
        ],
      },
    ],
  },

  /* 출처: 성균관대 '2026-2학기 조병두장학금 선발 안내' 공고 첨부
     (붙임1) 조병두장학금 신청서(2026).hwp — 원본 HWP의 13개 항목·문구·체크옵션·자필 서약문을 그대로 반영 */
  'jobyungdu-apply': {
    title: '조병두 장학금 신청서',
    docName: '조병두장학금_신청서',
    org: '학생처장 귀하',
    signLabel: '지원자',
    tag: '(붙임1)',
    photoNote: '※ 원본 양식의 사진란은 인쇄 후 우측 상단에 사진을 부착해 주세요.',
    handwriteNote: '※ 다음의 문구를 하단에 자필로 기재, 서명하시기 바랍니다. (미기재시 서류접수 불가)',
    handwriteText: '본인은 장학금 수혜자로 선정될 경우 “받은 만큼 후배들에게 돌려주라”는 故조병두 동문의 뜻에 따라 재학 중 및 졸업 후에도 받은 혜택을 후배들을 위한 조병두 장학회 기금으로 환원할 것을 서약합니다.',
    pledge: '상기 신청내용이 틀림없고 허위 기재일 경우 장학생 자격이 박탈될 수 있음을 확인하였습니다.',
    sections: [
      {
        heading: '',
        fields: [
          { id: 'nameLine', label: '1. 성       명', type: 'text', auto: 'name',
            q: '성명 — 한자가 있으면 함께 적어주세요', placeholder: '(한글) 홍길동   (한자) 洪吉童' },
          { id: 'studentId', label: '2. 학       번', type: 'text', auto: 'studentId', q: '학번' },
          { id: 'majorLine', label: '3. 학부 / 전공', type: 'text', auto: 'major',
            q: '소속 대학·학과 (원본 표기: ___대학 ___학과)', placeholder: '예: 소프트웨어융합대학 소프트웨어학과' },
          { id: 'birth', label: '4. 생년월일', type: 'text', q: '생년월일', placeholder: '예: 2004. 3. 15.' },
          { id: 'yearRemain', label: '5. 학       년  (잔여학기)', type: 'text', auto: 'yearRemain',
            q: '학년과 잔여학기', placeholder: '예: 3학년 (잔여 3학기)' },
          { id: 'gender', label: '6. 성 별', type: 'checks', q: '성별', options: ['남', '여'] },
          { id: 'addrSelf', label: '7. 주       소 (본인) · 전화', type: 'text',
            q: '본인 주소(우편번호 포함)와 전화번호', placeholder: '서울시 ○○구 ○○로 12 (03016) / 010-0000-0000' },
          { id: 'addrGuardian', label: '7. 주       소 (보호자) · 전화', type: 'text',
            q: '보호자 주소와 전화번호', placeholder: '주소 (우편번호) / 전화번호' },
          { id: 'bracket', label: '8. 한국장학재단 소득분위', type: 'text', auto: 'bracket',
            q: '한국장학재단 소득분위(지원구간)', placeholder: '예: 4구간' },
          { id: 'lastSem', label: '9. 직전학기성적 — 신청학점 / 이수학점 / 평점평균( /4.5)', type: 'text', auto: 'gpaLast',
            q: '직전학기 신청학점·이수학점·평점평균', placeholder: '예: 18 / 18 / 4.02 /4.5' },
          { id: 'totalGpa', label: '10. 전학년성적 — 이수학점 / 평점평균( /4.5)', type: 'text',
            q: '전학년 이수학점과 평점평균', placeholder: '예: 98 / 3.95 /4.5' },
          { id: 'renew', label: '11. 계속자여부', type: 'checks', q: '처음 신청하나요, 계속 장학생인가요?', options: ['신규', '계속'] },
          { id: 'applyType', label: '12. 신청유형', type: 'checks', q: '신청 유형을 고르세요 (택1)',
            options: ['① 등록금 전액', '② 생활비 장학금'], suffix: '中 택1 *세부사항은 공고문 참조' },
        ],
      },
      {
        heading: '별첨. 타장학금 수혜 여부 확인서',
        note: '(*해당자에 한함 — 기간: 2026년 1학기, 2학기(예정), 2027년 1학기, 2학기(예정))',
        fields: [
          { id: 'otherSch', label: '장학금 종류/(지급기관 및 단체) · 수혜 연도 · 수혜 학기/수혜학년 · 장학금액(원)', type: 'textarea',
            q: '타장학금 수혜(예정) 내역 — 해당 없으면 비워두세요',
            sugg: ['국가장학금 I유형 / 한국장학재단 — 2026년 / 1학기(3학년) / 2,600,000원'] },
        ],
      },
    ],
  },
};

/* 정식 등록 양식 로딩 — data/forms.json을 내려받아 내장 폴백 위에 병합.
   덕분에 새 양식 등록·기존 양식 수정이 앱 업데이트 없이 즉시 반영된다. */
function loadFormTemplates() {
  return fetch('data/forms.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.templates) Object.assign(FORM_TEMPLATES, d.templates);
    })
    .catch(() => { /* 오프라인 등 — 내장 폴백으로 동작 */ });
}

/* 질문 입력칸 자동 채움 — 프로필에서 가져올 수 있는 값.
   🔴 여기에 키를 추가하면 form-plan.js의 FORM_AUTO_LABELS·FORM_AUTO_KEYS_ALL도 같이 본다.
   앱이 아는 값을 안 이어 두면 학생이 같은 것을 신청서마다 다시 쓴다
   (실측: 생년월일 20개 양식·주소 30개 항목이 그 상태였다). */
function formAutoVal(key) {
  const p = (typeof state !== 'undefined' && state.profile) || null;
  if (!p || !key) return '';
  const c = p.common || {};
  switch (key) {
    case 'name': return p.name || '';
    case 'studentId': return c.studentId || '';
    case 'major': return p.major || '';
    case 'school': return p.school || '';
    case 'phone': return c.phone || '';
    case 'email': return c.email || '';
    case 'birth': return c.birth || '';
    case 'bank': return c.bank || '';
    case 'account': return c.account || '';
    case 'gender': return c.gender || '';
    case 'addr': return c.addr || '';
    case 'emergency': return c.emergency || '';
    case 'guardianName': return c.guardianName || '';
    case 'guardianRel': return c.guardianRel || '';
    case 'guardianPhone': return c.guardianPhone || '';
    case 'rrn': return c.rrn || '';
    case 'campus': return p.campus || '';
    case 'region': return p.region || '';
    case 'bracket': return p.bracket != null ? `${p.bracket}구간` : '';
    case 'year': return p.year ? `${p.year}학년` : '';
    case 'yearRemain': return p.year ? `${p.year}학년 (잔여  학기)` : '';
    case 'gpaLast': return p.gpa != null ? `  /  / ${p.gpa} /4.5` : '';
    case 'gpa': return p.gpa != null ? `${p.gpa} / 4.5` : (c.gpa || '');   // 앱 지원문서의 성적 칸(2026-11-23)
    default: return '';
  }
}

/* 설계기(form-plan.js)에 넘길 값 묶음 — 순수 함수라 프로필을 직접 못 읽는다 */
function formAutoValues() {
  const out = {};
  (typeof FORM_AUTO_KEYS_ALL !== 'undefined' ? FORM_AUTO_KEYS_ALL : []).forEach((k) => {
    const v = formAutoVal(k);
    if (v) out[k] = v;
  });
  return out;
}


const FORM_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/* ---------- 질문 화면 HTML ----------
   설계기(form-plan.js)가 짠 질문만 그린다. 원본 스키마는 손대지 않으므로
   문서(renderFormDoc)는 그대로다 — 바뀌는 것은 '묻는 방식'뿐이다. */
function formFieldHtml(f) {
  const fid = `fq-${f.id}`;
  let html = `<div class="field"><span class="field-label">${esc(f.q || f.label)}</span>`;
  if (f.type === 'checks' || f.type === 'checks+text') {
    html += `<div class="chip-group fq-checks" data-f="${f.id}">` +
      (f.options || []).map((o) => `<button type="button" class="chip" data-value="${esc(o)}">${esc(o)}</button>`).join('') +
      `</div>`;
  }
  if (f.type === 'choice') {
    /* 하나만 고르는 항목. 문서 출력은 checks와 똑같다(□/☑ 한 줄) — 원본 구조 불변 */
    html += `<div class="chip-group fq-choice" data-f="${f.id}">` +
      (f.options || []).map((o) => `<button type="button" class="chip" data-value="${esc(o)}">${esc(o)}</button>`).join('') +
      `</div>`;
  }
  if (f.type === 'checks+text') {
    html += `<div class="fq-sugg">${(f.sugg || []).map((s) => `<button type="button" class="chip chip-sm" data-fill="${fid}-t" data-text="${esc(s)}">${esc(s.slice(0, 26))}…</button>`).join('')}</div>`;
    html += `<textarea id="${fid}-t" rows="2" placeholder="${esc(f.tq || '')}" style="margin-top:8px"></textarea>`;
  }
  if (f.type === 'text') {
    html += `<input type="text" id="${fid}" placeholder="${esc(f.placeholder || '')}" value="${esc(f.preset || '')}" autocomplete="off" />`;
    const key = typeof formAutoKey === 'function' ? formAutoKey(f) : '';
    if (key) html += `<label class="fq-keep"><input type="checkbox" class="fq-keep-box" data-key="${esc(key)}" data-for="${fid}" checked /><span>다음 신청서에도 사용</span></label>`;
  }
  if (f.type === 'textarea') {
    /* 🔴 서술형(story) 칸은 빈 칸을 던지지 않는다 (개발자 지적 2026-08-23).
       'A4 2장 내외'를 학생에게 쓰라고 하는 것은 우리가 할 일을 떠넘기는 것이다.
       대신 **키워드 질문**을 이 칸 안에 그리고, 글은 앱이 쓴다.
       카드가 이 칸 '안'에 들어가므로 질문 수 상한(FORM_LIMITS)은 그대로다. */
    const isStory = f.kind === 'story' && typeof essayAskHtml === 'function';
    if (isStory) html += essayAskHtml(f, typeof essayCtx === 'function' ? essayCtx(null) : null);
    html += `<div class="fq-sugg">${(f.sugg || []).map((s) => `<button type="button" class="chip chip-sm" data-fill="${fid}" data-text="${esc(s)}">${esc(s.slice(0, 26))}…</button>`).join('')}</div>`;
    const ph = isStory
      ? (typeof essayOn === 'function' && essayOn()
        ? '위 키워드를 고른 뒤 아래 버튼을 누르면 이 칸이 채워집니다 — 직접 써도 됩니다'
        : '위 키워드를 고른 뒤 아래 버튼을 누르면 이 칸으로 옮겨집니다 — 직접 써도 됩니다')
      : '직접 입력하거나 위 추천 문구를 눌러 채우세요';
    html += `<textarea id="${fid}" rows="${isStory ? 5 : 3}" placeholder="${esc(ph)}"></textarea>`;
  }
  if (f.type === 'group') {
    /* 원본이 표인데 셀마다 질문이 된 것을 한 카드로 묶은 것.
       카드 1개로 세지만 문서에는 원래 칸 수만큼 그대로 나간다. */
    html += `<div class="fq-group">` + (f.sub || []).map((sf) =>
      `<label class="fq-sub"><span>${esc(sf.label)}</span>` +
      `<input type="text" id="fq-${sf.id}" placeholder="${esc(sf.placeholder || '')}" autocomplete="off" /></label>`).join('') + `</div>`;
  }
  if (f.type === 'schedule') {
    html += `<div class="chip-group fq-checks" data-f="${f.id}-days">` +
      FORM_DAYS.map((d) => `<button type="button" class="chip" data-value="${d}">${d}</button>`).join('') + `</div>`;
    html += `<input type="text" id="${fid}-time" placeholder="예: 15:00 ~ 17:00" style="margin-top:8px" autocomplete="off" />`;
  }
  html += `</div>`;
  return html;
}

function formQuestionsHtml(tpl) {
  const plan = formPlanFor(tpl);
  let html = '';

  /* 안 물어본 것을 감추지 않는다 — 무엇을 채웠는지 보이고 그 자리에서 고칠 수 있어야 한다 */
  if (plan.autoRows.length) {
    html += `<details class="fq-auto"><summary>프로필에서 자동으로 채운 항목 ${plan.autoRows.length}개 · 확인하고 고치기</summary>` +
      plan.autoRows.map((r) => `<label class="fq-sub"><span>${esc(String(r.label).replace(/\n/g, ' '))}</span>` +
        `<input type="text" class="fq-auto-in" data-f="${esc(r.id)}" value="${esc(r.value)}" autocomplete="off" /></label>`).join('') +
      `<p class="dp-note">MY → 내 정보에서 고쳐야 다른 신청서에도 들어가요.</p></details>`;
  }
  /* 질문 수 상한을 넘었다는 안내(fq-over)는 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내) */

  plan.secs.forEach((sec) => {
    html += `<div class="dp-block"><h4>${esc(sec.heading || '')}</h4>`;
    sec.items.forEach((f) => { html += formFieldHtml(f); });
    html += `</div>`;
  });
  return html;
}

/* 이 양식의 질문 설계 — 화면·수집이 같은 결과를 봐야 하므로 한 번 계산해 재사용한다 */
let formPlanCache = null;
function formPlanFor(tpl) {
  if (formPlanCache && formPlanCache.tpl === tpl) return formPlanCache.plan;
  const plan = planFormQuestions(tpl, formAutoValues());
  formPlanCache = { tpl, plan };
  return plan;
}
function formInvalidatePlan() { formPlanCache = null; }

/* ---------- 답변 수집 ---------- */
function collectFormAnswers(tpl) {
  const plan = formPlanFor(tpl);
  const ans = {};

  /* ① 안 물어본 것 — 프로필에서 채운 값(확인 패널에서 고쳤으면 고친 값) */
  Object.keys(plan.auto).forEach((id) => { ans[id] = plan.auto[id]; });
  $$('.fq-auto-in').forEach((el) => { ans[el.dataset.f] = el.value.trim(); });

  /* ② 화면에 낸 질문 */
  plan.secs.forEach((sec) => sec.items.forEach((f) => {
    const fid = `fq-${f.id}`;
    if (f.type === 'checks' || f.type === 'checks+text') {
      ans[f.id] = {
        checks: $$(`.fq-checks[data-f="${f.id}"] .chip.active`).map((c) => c.dataset.value),
        text: f.type === 'checks+text' ? ($(`#${fid}-t`) || { value: '' }).value.trim() : '',
      };
    } else if (f.type === 'choice') {
      ans[f.id] = { checks: $$(`.fq-choice[data-f="${f.id}"] .chip.active`).map((c) => c.dataset.value), text: '' };
    } else if (f.type === 'schedule') {
      ans[f.id] = {
        days: $$(`.fq-checks[data-f="${f.id}-days"] .chip.active`).map((c) => c.dataset.value),
        time: ($(`#${fid}-time`) || { value: '' }).value.trim() || '15:00 ~ 17:00',
      };
    } else if (f.type === 'group') {
      /* 묶어서 물었어도 답은 원래 필드 id로 되돌린다 — 문서가 원본 그대로 나오게 */
      (f.sub || []).forEach((sf) => { ans[sf.id] = ($(`#fq-${sf.id}`) || { value: '' }).value.trim(); });
    } else {
      ans[f.id] = ($(`#${fid}`) || { value: '' }).value.trim();
    }
  }));

  /* ③ 같은 섹션이 두 번 들어 있는 양식 — 앞에서 받은 답을 뒤에도 그대로 */
  Object.keys(plan.mirror).forEach((id) => { ans[id] = ans[plan.mirror[id]]; });
  return ans;
}

/* ---------- 답변 되돌려 넣기 (2026-09-09 · 이어보기 3겹) ----------
   `collectFormAnswers` 의 **거울**이다. 잠깐 나갔다 온 학생의 신청서를 쓰던 그대로
   되살릴 때 쓴다(AI 초안도 같은 `#fq-<id>` 칸에 들어 있어 함께 돌아온다).
   설계: docs/designs/first-run-and-resume.md

   🔴 위 `collectFormAnswers` 와 **칸 종류가 어긋나면 조용히 빈 칸이 된다.** 한쪽에 종류를
      더하면 여기도 더할 것. 관문: verify/test-collector.mjs '이어보기' 절이 두 함수가 다루는
      종류가 같은지 센다. */
function fillFormAnswers(tpl, ans) {
  if (!ans) return 0;
  const plan = formPlanFor(tpl);
  let filled = 0;
  const setVal = (sel, v) => {
    const el = $(sel);
    if (!el || v === undefined || v === null || v === '') return;
    el.value = v;
    filled += 1;
  };
  const setChips = (sel, picked) => {
    const list = Array.isArray(picked) ? picked : [];
    if (!list.length) return;
    $$(`${sel} .chip`).forEach((c) => c.classList.toggle('active', list.indexOf(c.dataset.value) >= 0));
    filled += 1;
  };

  /* ① 프로필에서 채운 값을 학생이 고쳤으면 그 고친 값 */
  $$('.fq-auto-in').forEach((el) => { if (ans[el.dataset.f] !== undefined) { el.value = ans[el.dataset.f]; filled += 1; } });

  /* ② 화면에 낸 질문 — collectFormAnswers 와 같은 순서·같은 종류로 되돌린다 */
  plan.secs.forEach((sec) => sec.items.forEach((f) => {
    const fid = `fq-${f.id}`;
    const v = ans[f.id];
    if (f.type === 'checks' || f.type === 'checks+text') {
      if (!v) return;
      setChips(`.fq-checks[data-f="${f.id}"]`, v.checks);
      if (f.type === 'checks+text') setVal(`#${fid}-t`, v.text);
    } else if (f.type === 'choice') {
      if (v) setChips(`.fq-choice[data-f="${f.id}"]`, v.checks);
    } else if (f.type === 'schedule') {
      if (!v) return;
      setChips(`.fq-checks[data-f="${f.id}-days"]`, v.days);
      setVal(`#${fid}-time`, v.time);
    } else if (f.type === 'group') {
      (f.sub || []).forEach((sf) => setVal(`#fq-${sf.id}`, ans[sf.id]));
    } else {
      setVal(`#${fid}`, v);
    }
  }));
  return filled;
}

/* 학생이 새로 적어 준 값을 프로필에 남긴다 ('다음 신청서에도 쓸게요').
   🔴 저장은 기기 안(localStorage)뿐이다 — 밖으로 나가는 코드는 없다. */
function formKeepToProfile() {
  const p = (typeof state !== 'undefined' && state.profile) || null;
  if (!p) return 0;
  p.common = p.common || {};
  const OWN = { name: 'name', major: 'major', school: 'school' }; // 프로필 최상위에 있는 값
  let n = 0;
  $$('.fq-keep-box').forEach((box) => {
    if (!box.checked) return;
    const el = $(`#${box.dataset.for}`);
    const v = el ? el.value.trim() : '';
    const key = box.dataset.key;
    if (!v || !key) return;
    if (OWN[key]) { if (!p[key]) { p[key] = v; n++; } return; }
    if (!p.common[key]) { p.common[key] = v; n++; }
  });
  return n;
}

/* ---------- 문서 렌더링 (원본 양식과 동일 구조) ---------- */
function renderFormDoc(tpl, p, ans, { editable = false } = {}) {
  /* 앱 지원문서는 틀이 다르다(한 틀 문서 · 2026-11-23) — 공고 원본 양식(아래)은 한 글자도 안 바뀐다(form-snapshot) */
  if (tpl && tpl.layout === 'frame') return renderPrepDoc(tpl, p, ans, { editable });
  /* 🔴 info 칸의 값 사전을 따로 두지 않는다 — 예전엔 여기 6키, formAutoVal에 9키로
     갈라져 있어서 bracket·yearRemain·gpaLast가 info에서만 조용히 빈 칸이 됐다 */
  const autoVal = (k) => (k ? formAutoVal(k) : '');
  const ed = editable ? ' contenteditable="true"' : '';
  const box = (checked) => (checked ? '☑' : '□');

  /* 사진란 (2026-09-11 개발자 지시 — MY 의 프로필 사진을 사진을 요구하는 공고에 쓴다).
     🔴 들어가는 양식은 **photoNote 가 있는 양식뿐**이다 — 원본 서식에 사진란이 있다고 스키마화 때
        적어 둔 표식이고, 사진란이 없는 서식에 사진을 붙이는 것은 지어내는 것이다.
     🔴 사진이 없으면 예전 문구 그대로(인쇄 후 부착). 있으면 원본 서식처럼 **우측 상단**에 넣고
        문구를 바꾼다 — 단, 규격(크기·배경·촬영 시기)은 우리가 모르므로 공고에서 확인하라고 적는다.
     🔴 `photoNote` 는 이름과 달리 **사진 이야기가 아닌 안내**도 담고 있다(코드 리뷰 실측: 13건 중 3건이
        '회색 안내 문구 삭제'·'추천란 서명·시험합격확인서 첨부'). 그래서 문구에 '사진' 이 있을 때만 사진란으로 본다.
     🔴 원문 안내는 **지우지 않고 그대로 두고** 한 줄을 덧붙인다 — 규격(3cm×4cm·3개월 이내·컬러)은 원문이 말하고
        우리는 모른다. 원본이 '좌측 상단' 이면 왼쪽에 붙인다(한 서식이 실제로 그렇다).
     ⚠️ app.js 가 없는 곳(Node 검사·관리자 화면)에서는 함수가 없어 예전 문서와 한 글자도 안 다르다.
     ⚠️ 사진이 없을 때 글자 하나(공백 포함)도 더하지 않는다 — form-snapshot 이 문서 동일성을 잰다. */
  const hasPhotoBox = !!(tpl.photoNote && /사진/.test(tpl.photoNote));
  const photo = (hasPhotoBox && typeof profilePhotoDataUrl === 'function') ? profilePhotoDataUrl() : '';
  const photoSide = /좌측|왼쪽/.test(tpl.photoNote || '') ? ' left' : '';
  let html = `<div class="form-doc"><p class="fd-tag">${esc(tpl.tag || '<별첨>')}</p>
    ${photo ? `<img class="fd-photo${photoSide}" src="${photo}" alt="증명사진" />\n    ` : ''}<h2 class="fd-title">${esc(tpl.title)}</h2>`;
  if (tpl.photoNote) {
    html += `<p class="fd-note">${esc(tpl.photoNote)}</p>`;
    if (photo) html += `<p class="fd-note fd-photo-note">※ 앱이 MY 의 프로필 사진을 사진란에 넣었어요. 위 안내의 규격(크기·배경·촬영 시기)과 다르면 인쇄한 뒤 원본 사진을 붙여 주세요.</p>`;
  }

  tpl.sections.forEach((sec) => {
    if (sec.heading || sec.note) html += `<p class="fd-sec">${esc(sec.heading)}${sec.note ? ` <span class="fd-note">${esc(sec.note)}</span>` : ''}</p>`;
    if (sec.info) {
      html += '<table class="fd-table">';
      sec.info.forEach((row) => {
        /* 한 줄에 칸이 하나뿐인 서식도 있다 — 없는 칸을 그리면 'undefined'가 찍힌다 */
        html += `<tr><th>${esc(row[0])}</th><td${ed}>${esc(autoVal(row[1]) || '')}</td>
                 <th>${esc(row[2] || '')}</th><td${ed}>${esc(autoVal(row[3]) || '')}</td></tr>`;
      });
      html += '</table>';
      // 여기서 끝내면 안 된다 — info와 fields가 같은 섹션에 있으면(산학디딤돌 등)
      // 성별·주민번호 같은 원본 항목이 통째로 빠진 문서가 생성된다 (2026-07-15 수정)
    }
    if (!sec.fields || !sec.fields.length) return; // 안내 전용 섹션 — 제목·주석만 출력
    html += '<table class="fd-table">';
    (sec.fields || []).forEach((f) => {
      /* 🔴 저장된 답(formAns)은 기기에 남아 나중에 다시 그려진다. 그 사이 타입이 바뀌었으면
         모양이 달라 a.checks.includes(...)에서 터진다 — 버리지 않고 맞춰 준다 */
      const a = typeof formAnswerFor === 'function' ? formAnswerFor(f, ans[f.id]) : ans[f.id];
      const label = esc(f.label).replace(/\n/g, '<br />');
      const cell = (v) => esc(v || '').replace(/\n/g, '<br />');
      if (f.type === 'group') {
        /* 묶어서 물었어도 문서는 원본대로 칸마다 한 줄씩 — 한 줄 칸과 같은 HTML이어야 한다 */
        (f.sub || []).forEach((sf) => {
          html += `<tr><th>${esc(sf.label).replace(/\n/g, '<br />')}</th><td${ed}>${cell(a[sf.id])}</td></tr>`;
        });
      } else if (f.type === 'checks' || f.type === 'choice') {
        const line = f.options.map((o) => `${box(a.checks.includes(o))} ${esc(o)}`).join('&nbsp;&nbsp;&nbsp;');
        html += `<tr><th>${label}</th><td${ed}>${line}${f.suffix ? `&nbsp;&nbsp;<span class="fd-note">${esc(f.suffix)}</span>` : ''}</td></tr>`;
      } else if (f.type === 'checks+text') {
        const opts = f.options.map((o) => `${box(a.checks.includes(o))} ${esc(o)}`).join('<br />');
        const textOut = a.text || (a.checks.length ? '' : (f.emptyText || ''));
        html += `<tr><th>${label}</th><td${ed}>${opts}<br />• ${esc(f.textLabel)}: ${esc(textOut)}</td></tr>`;
      } else if (f.type === 'schedule') {
        let grid = '<table class="fd-inner"><tr><th>희망 요일</th><th>희망 시간</th></tr>';
        FORM_DAYS.forEach((d) => {
          const on = a.days.includes(d);
          grid += `<tr><td>${box(on)} ${d}</td><td>${on ? esc(a.time) : '00:00 ~ 00:00'}</td></tr>`;
        });
        grid += '</table>';
        html += `<tr><th>${label}</th><td${ed}>${grid}</td></tr>`;
      } else {
        /* text · textarea · static(채우는 칸이 아닌 표 헤더 — 원본대로 빈 칸) ·
           그리고 아직 모르는 타입. 예전엔 모르는 타입이 조용히 빈 칸이 되어
           검사가 못 잡았다 — 이제는 콘솔에 남긴다 */
        if (f.type !== 'text' && f.type !== 'textarea' && f.type !== 'static'
            && typeof console !== 'undefined') console.warn('[forms] 모르는 필드 타입:', f.type, f.id);
        html += `<tr><th>${label}</th><td${ed}>${cell(a)}</td></tr>`;
      }
    });
    html += '</table>';
  });

  const now = new Date();
  if (tpl.handwriteNote) {
    html += `<p class="fd-note" style="margin-top:14px">${esc(tpl.handwriteNote)}</p>
      <p class="fd-pledge" style="border:1px dashed #666;padding:10px 12px;text-align:left">${esc(tpl.handwriteText || '')}</p>
      <p class="fd-note" style="text-align:center">↑ 인쇄 후 이 문구를 하단 여백에 자필로 옮겨 적고 서명하세요</p>`;
  }
  // 서약문이 없는 양식도 있다 — 원본에 서약 문구가 아예 없는 자기소개서 등(2026-08-02 확인:
  // 사랑나눔 자기소개서는 서약이 별개 문서인 개인정보 동의서에 있다). 없는데 그대로 그리면
  // esc(undefined)가 "undefined"라 문서에 그 글자가 찍힌다.
  if (tpl.pledge) html += `<p class="fd-pledge">${esc(tpl.pledge)}</p>`;
  html += `<p class="fd-sign">작성일: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일&nbsp;&nbsp;&nbsp;
    ${esc(tpl.signLabel || '신청인')}: ${esc(p.name || '')} (서명 또는 날인)</p>
    <p class="fd-org">${esc(tpl.org)}</p></div>`;
  return html;
}

/* ---------- 앱 지원문서 그리기 — 한 틀 문서 (2026-11-23 개발자 결정 · 시안 docs/designs/mockups/prep-doc-options-2.html 「시안 2」) ----------
   등록 양식 가운데 한독제석재단 「자기소개서」의 짜임을 옮겼다 — 굵은 바깥 틀 하나 · 옅은 청색 이름표 열 · 맺음말·날짜·서명·기관명이 틀 안.
   🔴 왼쪽 위 「※ 앱 자체 제작 문서입니다」 줄은 지웠다(같은 날 개발자 지시) — 「실제 접수가 아니다」는 틀 아래 제출 안내 줄이 말한다.
   칸은 템플릿(buildPrepTemplate)이 공고에 맞춰 고른 것을 그대로 그린다 — 여기서 칸을 더하거나 빼지 않는다.
   짧은 칸은 두 개씩 한 줄 · 긴 칸(wide)·서술·체크는 한 줄을 통째로. */
function renderPrepDoc(tpl, p, ans, { editable = false } = {}) {
  const ed = editable ? ' contenteditable="true"' : '';
  const cell = (v) => esc(v || '').replace(/\n/g, '<br />');
  const lab = (f) => esc(f.label).replace(/\n/g, '<br />') + (f.sub ? `<small>${esc(f.sub)}</small>` : '');
  const valOf = (f) => {
    const raw = ans ? ans[f.id] : undefined;
    /* 옛 답(칸이 늘기 전에 담아 둔 신청)에는 새 칸의 답이 없다 — 프로필이 아는 값이면 그것으로 */
    if (raw === undefined && f.auto) return formAutoVal(f.auto);
    return typeof formAnswerFor === 'function' ? formAnswerFor(f, raw) : raw;
  };
  let rows = '';
  let pend = [];
  const flush = () => {
    for (let i = 0; i < pend.length; i += 2) {
      const a = pend[i]; const b = pend[i + 1];
      rows += b
        ? `<tr><th>${lab(a)}</th><td${ed}>${cell(valOf(a))}</td><th>${lab(b)}</th><td${ed}>${cell(valOf(b))}</td></tr>`
        : `<tr><th>${lab(a)}</th><td colspan="3"${ed}>${cell(valOf(a))}</td></tr>`;
    }
    pend = [];
  };
  let foot = '';
  (tpl.sections || []).forEach((sec) => {
    (sec.fields || []).forEach((f) => {
      if (f.type === 'text' && !f.wide) { pend.push(f); return; }
      flush();
      if (f.type === 'checks' || f.type === 'choice') {
        const a = valOf(f) || { checks: [] };
        const line = (f.options || []).map((o) => `${(a.checks || []).includes(o) ? '☑' : '□'} ${esc(o)}`).join('<br />');
        rows += `<tr><th>${lab(f)}</th><td colspan="3"${ed}>${line}</td></tr>`;
      } else {
        rows += `<tr${f.type === 'textarea' ? ' class="fd-long"' : ''}><th>${lab(f)}</th><td colspan="3"${ed}>${cell(valOf(f))}</td></tr>`;
      }
    });
    if (sec.docs && sec.docs.length) {
      flush();
      rows += `<tr><th>${esc(sec.docsLabel || '제출 서류')}</th><td colspan="3"${ed}>${sec.docs.map((d) => `□ ${esc(d)}`).join('<br />')}</td></tr>`;
    } else if (!(sec.fields || []).length && sec.note) {
      foot += `<p class="fd-foot">${esc(sec.note)}</p>`;
    }
  });
  flush();
  const now = new Date();
  return `<div class="form-doc"><h2 class="fd-title">${esc(tpl.docTitle || tpl.title)}</h2>
    ${tpl.docSub ? `<p class="fd-name">${esc(tpl.docSub)}</p>` : ''}
    <table class="fd-frame"><colgroup><col style="width:21%"><col style="width:29%"><col style="width:21%"><col style="width:29%"></colgroup>${rows}
    <tr class="fd-close"><td colspan="4">${tpl.pledge ? `<p>${esc(tpl.pledge)}</p>` : ''}
      <p class="fd-when">${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일&nbsp;&nbsp;&nbsp;&nbsp;${esc(tpl.signLabel || '지원자')}&nbsp;&nbsp;${esc((p && p.name) || '')}&nbsp;&nbsp;(인)</p>
      ${tpl.org ? `<p class="fd-org">${esc(tpl.org)}</p>` : ''}</td></tr></table>${foot}</div>`;
}

const FORM_DOC_CSS = `
  .form-doc { background:#fff; color:#111; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; padding:8px 2px; }
  .fd-tag { font-size:12px; color:#444; }
  .fd-title { text-align:center; font-size:19px; margin:10px 0 16px; }
  .fd-sec { font-weight:700; margin:16px 0 6px; font-size:14.5px; }
  .fd-note { font-weight:400; font-size:11.5px; color:#555; }
  .fd-photo { float:right; width:3cm; height:4cm; object-fit:cover; border:1px solid #444; margin:0 0 8px 12px; }
  .fd-photo.left { float:left; margin:0 12px 8px 0; }
  .fd-photo-note { clear:both; }
  .fd-table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .fd-table th, .fd-table td { border:1px solid #333; padding:7px 8px; font-size:12.5px; vertical-align:top; text-align:left; }
  .fd-table th { background:#f0f0f0; width:26%; font-weight:600; }
  .fd-inner { width:60%; border-collapse:collapse; }
  .fd-inner th, .fd-inner td { border:1px solid #666; padding:4px 8px; font-size:12px; }
  .fd-pledge { margin-top:18px; font-size:12.5px; text-align:center; }
  .fd-sign { text-align:center; font-size:12.5px; margin-top:10px; }
  .fd-org { text-align:center; font-weight:700; margin-top:12px; font-size:14px; }
  .fd-name { text-align:center; font-size:13px; color:#333; margin:-8px 0 16px; }
  .fd-frame { width:100%; border-collapse:collapse; table-layout:fixed; border:2px solid #111; }
  .fd-frame th, .fd-frame td { border:1px solid #111; padding:8px 9px; font-size:12.5px; vertical-align:middle; text-align:left; word-break:keep-all; overflow-wrap:anywhere; }
  .fd-frame th { background:#dce3f1; font-weight:700; text-align:center; }
  .fd-frame th small { display:block; font-weight:400; font-size:10.5px; }
  .fd-long td { height:120px; vertical-align:top; }
  .fd-close td { text-align:center; padding:18px 9px 20px; }
  .fd-close p { margin:0; }
  .fd-close .fd-when { margin:14px 0 12px; }
  .fd-close .fd-org { font-size:17px; margin:0; }
  .fd-foot { font-size:11px; color:#555; margin:10px 0 0; }
`;

/* ---------- 문서 내보내기 ---------- */
function formDocFullHtml(tpl, p, ans) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(tpl.title)}</title>
    <style>${FORM_DOC_CSS} body{margin:24px}</style></head><body>${renderFormDoc(tpl, p, ans)}</body></html>`;
}

function downloadFormDoc(tpl, p, ans) {
  const blob = new Blob(['﻿', formDocFullHtml(tpl, p, ans)], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${tpl.docName}_${p.name || '신청인'}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('문서 파일(.doc)로 저장했어요');
}

function printFormDoc(tpl, p, ans) {
  const w = window.open('', '_blank');
  if (!w) { toast('팝업이 차단됐습니다. 브라우저 설정을 확인해 주세요'); return; }
  w.document.write(formDocFullHtml(tpl, p, ans));
  w.document.close();
  setTimeout(() => w.print(), 400);
}

async function shareFormDoc(tpl, p, ans, sch) {
  const file = new File(['﻿', formDocFullHtml(tpl, p, ans)],
    `${tpl.docName}_${p.name || '신청인'}.doc`, { type: 'application/msword' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: tpl.title, files: [file] });
      return;
    }
  } catch (e) { return; }
  downloadFormDoc(tpl, p, ans);
}

/* ---------- 공고별 지원문서 (2026-07-15 개발자 지시 → 2026-10-13 개발자 결정으로 모든 등록 공고에) ----------
   🔴 2026-10-13 개발자 결정: *"앱 자체 문서는 일단 있는 게 맞다 — 없으면 「신청 준비 시작」을 눌렀을 때
      바로 신청내역으로 가고 앱의 신뢰도가 낮아진다."* 그래서 앱 양식(formId)이 없는 **모든 정식 등록 공고**에
      이 문서가 붙는다(예전엔 prepDoc: true 인 공고만 — 실데이터에 0건이라 학생은 늘 빈 준비 시트만 봤다).
   🔴 정직함은 **머리말(tag)**이 지킨다 — 같은 틀이지만 공고가 받는 것에 따라 다르게 말한다(prepKindFor):
      free(원문이 자유 양식이라 확인 · prepDoc) → "그대로 제출할 수 있다" · attached(첨부 신청서 있음) → "원본 양식에 옮겨 적을
      내용을 정리한다" · portal → "입력 칸에 붙여 넣을 답" · email → "메일에 첨부·본문으로" · unknown → "제출 전 원문에서 양식 유무 확인".
      '그대로 제출 가능'이라는 말은 free 에서만 한다(원칙 8-2).
   🔴 공고마다 다른 것은 **원문에서 온 것만**이다 — 작성형 서류 이름(documents)·지원 자격 줄(eligibilityLines)·제출 서류·제출 안내.
      원문에 없는 절을 지어내지 않는다: 작성형 서류 이름이 없으면 기본 세 절(지원 동기·학업/활동·계획)만.
   🔴 순수 함수 — 공고 객체만 받는다(브라우저·Node 겸용 · 관문 test-collector 「공고별 지원문서」가 Node 에서 부른다).
      isApplicationForm(data.js)이 있으면 쓰고 없으면 이름 규칙으로 물러난다. */
const PREP_WRITE_DOCS = [
  { match: /자기소개서|자소서/, label: '자기소개서', q: '자기소개서에 담을 내용 — 성장 과정·지원 동기·강점을 사실대로' },
  { match: /학업계획서|수학계획서/, label: '학업계획서', q: '남은 학기의 학업 계획과 목표' },
  { match: /연구계획서/, label: '연구계획서', q: '연구 주제·방법·기대 결과' },
  { match: /활동계획서/, label: '활동계획서', q: '활동 계획 — 무엇을 언제 어떻게' },
  { match: /사유서|신청\s*사유/, label: '신청 사유서', q: '이 장학금을 신청하는 사유를 사실대로' },
  { match: /지원\s*동기/, label: '지원 동기', q: '지원 동기' },
  { match: /에세이|포부/, label: '에세이(포부)', q: '요구한 주제에 맞는 글' },
];
/* 자리표시 안내 줄('원문 공고에서 확인')과 자동 제출 서류는 서류 이름이 아니다 — app.js 의 DOC_PLACEHOLDER 와 같은 꼴(베끼지 않고 좁게 둔다) */
const PREP_DOC_PLACEHOLDER = /(원문\s*공고|공고문)(에서)?\s*확인/;
const PREP_ATT_FORM_NAME = /신청서|지원서|원서|계획서|동의서|서약서/;
const PREP_ATT_DOC_EXT = /\.(hwp|hwpx|docx?|zip|pdf)/i;

function prepRealDocs(sch) {
  return (sch.documents || []).filter((d) => d && !PREP_DOC_PLACEHOLDER.test(d) && !/자동/.test(d));
}
function prepWriteDocs(sch) {
  const out = [];
  for (const d of prepRealDocs(sch)) {
    const def = PREP_WRITE_DOCS.find((w) => w.match.test(d));
    if (def && !out.some((o) => o.label === def.label)) out.push({ ...def, doc: d.replace(/\s*\(.*\)$/, '') });
  }
  return out;
}
function prepHasFormAttachment(sch) {
  /* 층2(한국장학재단이 아는 재단 장학금)의 첨부는 재단이 올린 **선발 공고문**이다 — 이름에 '신청서'가 있어도 신청서라 부르지 않는다(CLAUDE.md 「층2」) */
  if (sch.sourceKind === 'kosaf') return false;
  const atts = (sch.attachments || []).filter((a) => a && !a.bodyImage);
  if (typeof isApplicationForm === 'function') return atts.some(isApplicationForm);
  return atts.some((a) => PREP_ATT_FORM_NAME.test(a.name || '') && PREP_ATT_DOC_EXT.test(a.name || ''));
}
/* 이 공고가 **무엇을 받는가** — 머리말을 정하는 한 곳. 순서가 뜻이다: 원문 확인(free) > **원문이 말한 접수 방법(메일·포털)** > 첨부 신청서 > 모름.
   🔴 접수 방법이 첨부 파일명보다 앞이다 — data.js submitChannelKind 와 같은 결정(2026-09-23: 첨부는 거기서 받아 내는 서식이지 다른 제출처가 아니다).
      첨부 신청서는 어느 갈래든 질문 화면 머리(prepOriginalsHtml)가 따로 보여 준다. */
function prepKindFor(sch) {
  if (sch.prepDoc) return 'free';
  /* 층2(한국장학재단이 아는 재단 장학금 · 2026-10-13 ①) — 재단이 직접 받는다. 첨부는 선발 공고문이지 신청서가 아니고, 접수 방법은 공고문·재단 홈페이지가 말한다 */
  if (sch.sourceKind === 'kosaf') return 'kosaf';
  if (sch.applyEmail) return 'email';
  if (sch.applyPortal) return 'portal';
  if (prepHasFormAttachment(sch)) return 'attached';
  return 'unknown';
}
/* 🔴 문서 왼쪽 위 머리말(「※ 앱 자체 제작 문서입니다」)은 없다 (2026-11-23 개발자 지시로 삭제 · 11-17 에는 그 한 줄만 남겼었다).
   갈래별로 다른 말(접수 방법·그대로 제출 가능 여부)은 작성 화면 둘째 줄(PREP_LEADS)과 제출 안내 줄(prepSubmitNote)이 맡는다 —
   '그대로 제출 가능'은 여전히 free 만 말한다(원칙 8-2). */
/* 화면 머리줄용 짧은 말 — 긴 tag 는 문서 위에, 이것은 작성 화면 둘째 줄에 */
const PREP_LEADS = {
  free: '자유 형식 제출 공고 — 이 문서를 그대로 제출할 수 있습니다',
  attached: '첨부 신청서 양식에 옮겨 적을 내용을 정리합니다 — 제출은 원본 양식으로',
  portal: '포털 입력 칸에 붙여 넣을 답을 정리합니다',
  email: '메일 접수 공고 — 공고가 정한 서식에 옮겨 적을 내용을 정리합니다',
  unknown: '공고에 낼 내용을 정리합니다 — 제출은 공고가 정한 방법으로',
  kosaf: '재단 접수 공고 — 선발 공고문의 서식·방법에 맞춰 옮겨 적을 내용을 정리합니다',
};
/* 지원 자격 줄 → 학생이 스스로 확인하는 체크 항목(판정이 아니다 · 너무 긴 줄·조각 줄은 뺀다 · 여섯 줄까지) */
function prepEligOptions(sch) {
  const lines = (sch.eligibilityLines || []).map((l) => String(l || '').replace(/\s+/g, ' ').trim());
  const out = [];
  for (const l of lines) {
    if (l.length < 6 || l.length > 90) continue;
    if (!out.includes(l)) out.push(l);
    if (out.length >= 6) break;
  }
  return out;
}
function prepSubmitNote(sch) {
  const kind = prepKindFor(sch);
  const where = { free: '공고의 접수처', attached: '원본 양식을 채워 공고의 접수처', portal: '공고가 안내한 포털·온라인 입력', email: `메일 ${sch.applyEmail || ''}`.trim(), unknown: '공고가 정한 접수 방법', kosaf: '재단이 정한 접수 방법' }[kind];
  const due = sch.deadline ? `마감 ${sch.deadline}` : '';   // 마감을 모르면 말하지 않는다(2026-11-15 · 예전 '마감은 원문 확인')
  return `${[where, due].filter(Boolean).join(' · ')} · 학교·재단에 실제로 접수되는 것은 아니며 제출은 학생이 직접 합니다.`;
}

/* ── 공고가 묻는 칸 고르기 (2026-11-23 개발자 결정 — *"각 칸에 들어갈 내용은 공고별로 상이하므로, 공고의 내용에 맞춰 칸의 필아웃 내용을 조정하는 구조"*) ──
   늘 있는 칸(성명·학교·소속·학년·학번·연락처·이메일) 뒤에, **그 공고의 글이 말한 것만** 칸으로 더한다.
   읽는 글 = 지원 자격 줄 · 제외 줄 · 제출 서류 이름 · 이중수혜 원문(prepNoticeText). 공고 이름·요약은 안 읽는다(장학회 이름의 「구민」 같은 낱말에 속는다).
   🔴 공고에 없는 것을 묻지 않는다(원칙 8-1) — 규칙에 안 걸리면 칸이 없다. 값은 학생 본인 정보다(프로필이 알면 채우고 모르면 묻는다 · auto).
   실제 양식이 묻는 비율(등록 양식 73종 실측): 주소 64% · 생년월일 34% · 성적 23% · 보호자 22% · 계좌 19% · 소득분위 10%. */
const PREP_INFO_RULES = [
  { id: 'i_birth', label: '생년월일', auto: 'birth', q: '생년월일', placeholder: '예: 2004.03.14', match: /주민등록|가족관계|만\s*\d+\s*세|연령|나이|출생|생년/ },
  { id: 'i_gpa', label: '성 적', auto: 'gpa', q: '성적 (평점 평균)', placeholder: '예: 3.9 / 4.5', match: /성적|평점|학점|백분위|석차/ },
  { id: 'i_bracket', label: '지원구간', auto: 'bracket', q: '학자금 지원구간(소득분위)', placeholder: '예: 6구간', match: /소득|분위|지원구간|기초생활|차상위|수급|저소득|가계|경제적|형편/ },
  { id: 'i_bank', label: '은 행', auto: 'bank', q: '장학금을 받을 은행', match: /통장|계좌/ },
  { id: 'i_account', label: '계좌번호', auto: 'account', q: '계좌번호 (본인 명의)', match: /통장|계좌/ },
  { id: 'i_guardian', label: '보호자 성명', auto: 'guardianName', q: '보호자 성명', match: /보호자|부모|학부모|가족관계/ },
  { id: 'i_guardianPhone', label: '보호자 연락처', auto: 'guardianPhone', q: '보호자 연락처', match: /보호자|부모|학부모|가족관계/ },
  { id: 'i_addr', label: '주 소', auto: 'addr', wide: true, q: '주소', match: /거주|주소|주민등록|관내|도민|시민|구민|군민/ },
  { id: 'i_others', label: '타 장학금\n수혜 내역', wide: true, q: '이번 학기에 받는(받을 예정인) 다른 장학금 — 없으면 「없음」', placeholder: '예: 국가장학금 Ⅰ유형 150만원', match: /이중\s*수혜|중복\s*(수혜|수급|지원)|타\s*장학|다른\s*장학|수혜\s*(내역|여부|사실|현황)/ },
  { id: 'i_cert', label: '어학 · 자격증', wide: true, q: '어학 성적·자격증 (시험 이름 · 점수 · 취득일)', match: /토익|TOEIC|토플|TOEFL|TEPS|어학\s*(성적|점수|능력)|자격증/i },
];
function prepNoticeText(sch) {
  return [].concat(sch.eligibilityLines || [], sch.eligibilityExcludes || [], prepRealDocs(sch),
    (sch.exclusivity && sch.exclusivity.raw) || []).map((x) => String(x || '')).join('\n');
}
function prepInfoFields(sch) {
  const text = prepNoticeText(sch);
  const base = [
    { id: 'i_name', label: '성 명', type: 'text', auto: 'name', q: '성명' },
    { id: 'i_school', label: '학 교 명', type: 'text', auto: 'school', q: '학교' },
    { id: 'i_major', label: '소 속', type: 'text', auto: 'major', q: '학과(전공)' },
    { id: 'grade', label: '학년 (학기)', type: 'text', q: '학년(학기)', placeholder: '예: 3학년(6학기)' },
    { id: 'i_sid', label: '학 번', type: 'text', auto: 'studentId', q: '학번' },
    { id: 'i_phone', label: '연 락 처', type: 'text', auto: 'phone', q: '연락처 (휴대전화)' },
    { id: 'i_email', label: 'E-mail', type: 'text', auto: 'email', q: '이메일' },
  ];
  const extra = PREP_INFO_RULES.filter((r) => r.match.test(text))
    .map(({ match, ...f }) => ({ type: 'text', ...f }));   // match 는 고르는 데만 쓴다 — 템플릿에 정규식을 싣지 않는다(저장·비교되는 값)
  return base.concat(extra);
}

function buildPrepTemplate(sch) {
  const kind = prepKindFor(sch);
  const writeDocs = prepWriteDocs(sch);
  const sections = [
    { heading: '신청 개요', fields: prepInfoFields(sch) },
  ];
  if (writeDocs.length) {
    /* 공고가 이름 붙여 요구한 작성형 서류마다 절 하나 — 절 이름은 원문 서류 이름 그대로 */
    writeDocs.forEach((w, i) => sections.push({
      heading: w.doc,
      fields: [{ id: `write${i + 1}`, label: w.doc, type: 'textarea', kind: 'story', q: w.q }],
    }));
  } else {
    sections.push(
      {
        heading: '지원 동기 및 신청 사유',
        fields: [
          { id: 'reason', label: '지원 동기 및 신청 사유', type: 'textarea', kind: 'story', q: '이 장학금에 지원하는 동기와 신청 사유', sugg: [
            '등록금 부담을 덜고 학업에 온전히 집중하고 싶어 지원합니다. 가계 형편상 장학 지원이 학업을 이어가는 데 큰 힘이 됩니다.',
            '전공 심화와 진로 준비에 필요한 비용을 마련하고자 지원합니다. 성실히 쌓아온 성적으로 그 의지를 증명하겠습니다.'
          ] }
        ]
      },
      {
        heading: '학업 및 활동 요약',
        fields: [
          { id: 'study', label: '학업 성취 (성적·이수 현황)', type: 'textarea', kind: 'story', q: '직전 학기 성적과 학업 성취를 요약해 주세요', sugg: [
            '직전 학기 평점 4.0 이상을 유지하며 전공 필수 과목을 성실히 이수했습니다.'
          ] },
          { id: 'activity', label: '교내·외 활동', type: 'textarea', kind: 'story', q: '교내·외 활동 내역 (동아리·봉사·프로젝트 등)', sugg: [
            '전공 학회와 봉사 동아리에서 꾸준히 활동하며 협업과 책임감을 길렀습니다.'
          ] }
        ]
      },
      ...(/봉사/.test(prepNoticeText(sch)) ? [{
        heading: '봉사활동 내역',
        fields: [{ id: 'volunteer', label: '봉사활동 내역', type: 'textarea', kind: 'story', q: '봉사활동 내역 (기관 · 기간 · 시간 · 내용)' }]
      }] : []),
      {
        heading: '향후 계획',
        fields: [
          { id: 'plan', label: '학업·진로 계획', type: 'textarea', kind: 'story', q: '남은 학기 학업 계획과 진로 목표', sugg: [
            '남은 학기 동안 전공 심화 과목을 집중 이수하고, 졸업 후에는 전공을 살려 사회에 기여하겠습니다.'
          ] }
        ]
      },
    );
  }
  const elig = prepEligOptions(sch);
  if (elig.length) {
    sections.push({
      heading: '지원 자격 확인',
      /* 절 설명 줄은 2026-11-21 개발자 지시로 지움(학생이 읽지 않는 안내 — 아래 질문이 같은 말) */
      fields: [{ id: 'eligCheck', label: '지원 자격', sub: '(해당 항목 표시)', type: 'checks', multi: true /* 자격 줄은 여러 개 해당할 수 있다 — 두 줄뿐일 때 하나만 고르게 바뀌던 것을 막는다(form-plan formIsSingleChoice) */, q: '공고의 지원 자격 중 해당하는 항목을 모두 고르세요 (본인 확인)', options: elig }],
    });
  }
  const docs = prepRealDocs(sch);
  /* 서류를 못 읽었으면 절을 안 만든다 (2026-11-15 · 예전 「제출 서류는 원문 공고에서 확인하세요.」 — 개발자 결정 11-02) */
  if (docs.length) sections.push({ heading: '제출 서류 확인', note: docs.join(' · '), docs, fields: [] });
  sections.push({ heading: '제출 안내', note: prepSubmitNote(sch), fields: [] });
  return {
    title: `${sch.name} — 지원문서`,
    layout: 'frame',          // 한 틀 문서(renderPrepDoc)
    docTitle: '지원문서',
    docSub: sch.name || '',
    docName: `지원문서_${(sch.name || '').replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 24) || '장학금'}`,
    org: sch.provider || '',
    lead: PREP_LEADS[kind],
    prepKind: kind,
    unofficial: true,
    pledge: '위 내용은 사실과 다름이 없습니다.',
    signLabel: '지원자',
    sections,
  };
}
