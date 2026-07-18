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
            q: 'AI 관련 경험이 있다면 모두 고르세요 (없으면 선택하지 않아도 돼요)',
            options: ['AI·SW 관련 수업 수강 경험', 'AI·SW 관련 자격증 또는 교육 수료 경험',
              '공모전, 프로젝트, 동아리, 대외활동 경험', '기타 AI·디지털 도구 활용 경험'],
            textLabel: '작성', tq: '경험 내용 (없으면 비워두세요 — "없음"으로 기재돼요)',
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

/* 질문 입력칸 자동 채움 — 프로필에서 가져올 수 있는 값 */
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
    case 'bracket': return p.bracket != null ? `${p.bracket}구간` : '';
    case 'yearRemain': return p.year ? `${p.year}학년 (잔여  학기)` : '';
    case 'gpaLast': return p.gpa != null ? `  /  / ${p.gpa} /4.5` : '';
    default: return '';
  }
}

const FORM_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/* ---------- 질문 화면 HTML ---------- */
function formQuestionsHtml(tpl) {
  let html = '';
  tpl.sections.forEach((sec, si) => {
    if (!sec.fields || !sec.fields.length) return; // 안내 전용 섹션(추천서·동의서 등)은 질문 없음
    html += `<div class="dp-block"><h4>${esc(sec.heading)}</h4>`;
    sec.fields.forEach((f) => {
      const fid = `fq-${f.id}`;
      html += `<div class="field"><span class="field-label">${esc(f.q)}</span>`;
      if (f.type === 'checks' || f.type === 'checks+text') {
        html += `<div class="chip-group fq-checks" data-f="${f.id}">` +
          f.options.map((o) => `<button type="button" class="chip" data-value="${esc(o)}">${esc(o)}</button>`).join('') +
          `</div>`;
      }
      if (f.type === 'checks+text') {
        html += `<div class="fq-sugg">${(f.sugg || []).map((s) => `<button type="button" class="chip chip-sm" data-fill="${fid}-t" data-text="${esc(s)}">${esc(s.slice(0, 26))}…</button>`).join('')}</div>`;
        html += `<textarea id="${fid}-t" rows="2" placeholder="${esc(f.tq || '')}" style="margin-top:8px"></textarea>`;
      }
      if (f.type === 'text') {
        html += `<input type="text" id="${fid}" placeholder="${esc(f.placeholder || '')}" value="${esc(f.preset || formAutoVal(f.auto) || '')}" autocomplete="off" />`;
      }
      if (f.type === 'textarea') {
        html += `<div class="fq-sugg">${(f.sugg || []).map((s) => `<button type="button" class="chip chip-sm" data-fill="${fid}" data-text="${esc(s)}">${esc(s.slice(0, 26))}…</button>`).join('')}</div>`;
        html += `<textarea id="${fid}" rows="3" placeholder="직접 입력하거나 위 추천 문구를 눌러 채워보세요"></textarea>`;
      }
      if (f.type === 'schedule') {
        html += `<div class="chip-group fq-checks" data-f="${f.id}-days">` +
          FORM_DAYS.map((d) => `<button type="button" class="chip" data-value="${d}">${d}</button>`).join('') + `</div>`;
        html += `<input type="text" id="${fid}-time" placeholder="예: 15:00 ~ 17:00" style="margin-top:8px" autocomplete="off" />`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  });
  return html;
}

/* ---------- 답변 수집 ---------- */
function collectFormAnswers(tpl) {
  const ans = {};
  tpl.sections.forEach((sec) => {
    (sec.fields || []).forEach((f) => {
      const fid = `fq-${f.id}`;
      if (f.type === 'checks' || f.type === 'checks+text') {
        ans[f.id] = {
          checks: $$(`.fq-checks[data-f="${f.id}"] .chip.active`).map((c) => c.dataset.value),
          text: f.type === 'checks+text' ? ($(`#${fid}-t`) || { value: '' }).value.trim() : '',
        };
      } else if (f.type === 'schedule') {
        ans[f.id] = {
          days: $$(`.fq-checks[data-f="${f.id}-days"] .chip.active`).map((c) => c.dataset.value),
          time: ($(`#${fid}-time`) || { value: '' }).value.trim() || '15:00 ~ 17:00',
        };
      } else {
        ans[f.id] = ($(`#${fid}`) || { value: '' }).value.trim();
      }
    });
  });
  return ans;
}

/* ---------- 문서 렌더링 (원본 양식과 동일 구조) ---------- */
function renderFormDoc(tpl, p, ans, { editable = false } = {}) {
  const c = (p && p.common) || {};
  const autoVal = { school: p.school || '', major: p.major || '', name: p.name || '',
    studentId: c.studentId || '', phone: c.phone || '', email: c.email || '' };
  const ed = editable ? ' contenteditable="true"' : '';
  const box = (checked) => (checked ? '☑' : '□');

  let html = `<div class="form-doc"><p class="fd-tag">${esc(tpl.tag || '<별첨>')}</p>
    <h2 class="fd-title">${esc(tpl.title)}</h2>`;
  if (tpl.photoNote) html += `<p class="fd-note">${esc(tpl.photoNote)}</p>`;

  tpl.sections.forEach((sec) => {
    if (sec.heading || sec.note) html += `<p class="fd-sec">${esc(sec.heading)}${sec.note ? ` <span class="fd-note">${esc(sec.note)}</span>` : ''}</p>`;
    if (sec.info) {
      html += '<table class="fd-table">';
      sec.info.forEach((row) => {
        html += `<tr><th>${esc(row[0])}</th><td${ed}>${esc(autoVal[row[1]] || '')}</td>
                 <th>${esc(row[2])}</th><td${ed}>${esc(autoVal[row[3]] || '')}</td></tr>`;
      });
      html += '</table>';
      // 여기서 끝내면 안 된다 — info와 fields가 같은 섹션에 있으면(산학디딤돌 등)
      // 성별·주민번호 같은 원본 항목이 통째로 빠진 문서가 생성된다 (2026-07-15 수정)
    }
    if (!sec.fields || !sec.fields.length) return; // 안내 전용 섹션 — 제목·주석만 출력
    html += '<table class="fd-table">';
    (sec.fields || []).forEach((f) => {
      const a = ans[f.id];
      const label = esc(f.label).replace(/\n/g, '<br />');
      if (f.type === 'checks') {
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
        html += `<tr><th>${label}</th><td${ed}>${esc(a || '')
          .replace(/\n/g, '<br />')}</td></tr>`;
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
  html += `<p class="fd-pledge">${esc(tpl.pledge)}</p>
    <p class="fd-sign">작성일: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일&nbsp;&nbsp;&nbsp;
    ${esc(tpl.signLabel || '신청인')}: ${esc(p.name || '')} (서명 또는 날인)</p>
    <p class="fd-org">${esc(tpl.org)}</p></div>`;
  return html;
}

const FORM_DOC_CSS = `
  .form-doc { background:#fff; color:#111; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; padding:8px 2px; }
  .fd-tag { font-size:12px; color:#444; }
  .fd-title { text-align:center; font-size:19px; margin:10px 0 16px; }
  .fd-sec { font-weight:700; margin:16px 0 6px; font-size:14.5px; }
  .fd-note { font-weight:400; font-size:11.5px; color:#555; }
  .fd-table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .fd-table th, .fd-table td { border:1px solid #333; padding:7px 8px; font-size:12.5px; vertical-align:top; text-align:left; }
  .fd-table th { background:#f0f0f0; width:26%; font-weight:600; }
  .fd-inner { width:60%; border-collapse:collapse; }
  .fd-inner th, .fd-inner td { border:1px solid #666; padding:4px 8px; font-size:12px; }
  .fd-pledge { margin-top:18px; font-size:12.5px; text-align:center; }
  .fd-sign { text-align:center; font-size:12.5px; margin-top:10px; }
  .fd-org { text-align:center; font-weight:700; margin-top:12px; font-size:14px; }
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
  toast('문서 파일(.doc)로 저장했어요 — 한글·워드에서 열 수 있어요');
}

function printFormDoc(tpl, p, ans) {
  const w = window.open('', '_blank');
  if (!w) { toast('팝업이 차단됐어요. 브라우저 설정을 확인해 주세요'); return; }
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

/* ---------- 자유 형식 지원문서 (2026-07-15 개발자 지시) ----------
   공고가 별도 양식 없이 자유 형식 제출을 받는다고 원문으로 확인된 공고
   (registered.json의 prepDoc: true)에만 제공한다 — 실제 제출 가능한 문서.
   제출이 불가능한 공고에는 절대 붙이지 않는다(사용자 혼란·신뢰 훼손 방지). */
function buildPrepTemplate(sch) {
  return {
    title: `${sch.name} — 지원문서`,
    docName: `지원문서_${(sch.name || '').replace(/[^가-힣a-zA-Z0-9]/g, '').slice(0, 24) || '장학금'}`,
    org: sch.provider || '',
    tag: '※ 이 공고는 별도 신청서 양식 없이 자유 형식 제출을 받습니다 — 아래 문서를 그대로 제출할 수 있어요.',
    unofficial: true,
    pledge: '위 내용은 사실과 다름이 없습니다.',
    signLabel: '지원자',
    sections: [
      {
        heading: '신청 개요',
        info: [
          ['성 명', 'name', '학 교', 'school'],
          ['학 과', 'major', '학 번', 'studentId'],
          ['연락처', 'phone', '이메일', 'email']
        ],
        fields: [
          { id: 'grade', label: '학년 (학기)', type: 'text', q: '학년(학기)', placeholder: '예: 3학년(6학기)' }
        ]
      },
      {
        heading: '지원 동기 및 신청 사유',
        fields: [
          { id: 'reason', label: '지원 동기 및 신청 사유', type: 'textarea', q: '이 장학금에 지원하는 동기와 신청 사유', sugg: [
            '등록금 부담을 덜고 학업에 온전히 집중하고 싶어 지원합니다. 가계 형편상 장학 지원이 학업을 이어가는 데 큰 힘이 됩니다.',
            '전공 심화와 진로 준비에 필요한 비용을 마련하고자 지원합니다. 성실히 쌓아온 성적으로 그 의지를 증명하겠습니다.'
          ] }
        ]
      },
      {
        heading: '학업 및 활동 요약',
        fields: [
          { id: 'study', label: '학업 성취 (성적·이수 현황)', type: 'textarea', q: '직전 학기 성적과 학업 성취를 요약해 주세요', sugg: [
            '직전 학기 평점 4.0 이상을 유지하며 전공 필수 과목을 성실히 이수했습니다.'
          ] },
          { id: 'activity', label: '교내·외 활동', type: 'textarea', q: '교내·외 활동 내역 (동아리·봉사·프로젝트 등)', sugg: [
            '전공 학회와 봉사 동아리에서 꾸준히 활동하며 협업과 책임감을 길렀습니다.'
          ] }
        ]
      },
      {
        heading: '향후 계획',
        fields: [
          { id: 'plan', label: '학업·진로 계획', type: 'textarea', q: '남은 학기 학업 계획과 진로 목표', sugg: [
            '남은 학기 동안 전공 심화 과목을 집중 이수하고, 졸업 후에는 전공을 살려 사회에 기여하겠습니다.'
          ] }
        ]
      },
      {
        heading: '제출 서류 확인',
        note: (sch.documents || []).join(' · ') || '제출 서류는 원문 공고에서 확인하세요.',
        fields: []
      }
    ]
  };
}
