/* ============================================================
   한대장 — 실제 장학금 양식 엔진
   실제 공고에 첨부된 신청 양식을 스키마로 옮겨,
   질문으로 정보를 모으고 원본과 동일한 구조의 문서를 생성한다.
   (새 양식 추가 절차: 수집 로봇이 첨부를 리포트 → 개발자 컨펌 →
    양식을 스키마화해 이 파일에 등록)
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
};

const FORM_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/* ---------- 질문 화면 HTML ---------- */
function formQuestionsHtml(tpl) {
  let html = '';
  tpl.sections.forEach((sec, si) => {
    if (!sec.fields) return;
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
        html += `<input type="text" id="${fid}" placeholder="${esc(f.placeholder || '')}" value="${esc(f.preset || '')}" autocomplete="off" />`;
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

  let html = `<div class="form-doc"><p class="fd-tag">&lt;별첨&gt;</p>
    <h2 class="fd-title">${esc(tpl.title)}</h2>`;

  tpl.sections.forEach((sec) => {
    html += `<p class="fd-sec">${esc(sec.heading)}${sec.note ? ` <span class="fd-note">${esc(sec.note)}</span>` : ''}</p>`;
    if (sec.info) {
      html += '<table class="fd-table">';
      sec.info.forEach((row) => {
        html += `<tr><th>${esc(row[0])}</th><td${ed}>${esc(autoVal[row[1]] || '')}</td>
                 <th>${esc(row[2])}</th><td${ed}>${esc(autoVal[row[3]] || '')}</td></tr>`;
      });
      html += '</table>';
      return;
    }
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
  html += `<p class="fd-pledge">${esc(tpl.pledge)}</p>
    <p class="fd-sign">작성일: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일&nbsp;&nbsp;&nbsp;
    신청인: ${esc(p.name || '')} (서명 또는 날인)</p>
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
