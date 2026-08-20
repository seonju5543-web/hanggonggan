/* ============================================================
   forms.js를 Node에서 그대로 불러오는 다리 (2026-08-18)

   왜 필요한가: 양식 엔진(forms.js)은 브라우저용 전역 스크립트라
   Node에서 require/import가 안 된다. 그런데 "질문을 줄여도 문서는
   그대로인가"를 증명하려면 48종 전부의 문서를 브라우저 없이
   찍어 봐야 한다.

   🔴 베껴 쓰지 말 것 — 이 파일은 forms.js를 **읽어서 실행**한다.
   렌더 규칙을 여기에 복사해 두면 앱과 검사가 서로 다른 문서를
   만들게 되고, 그러면 이 검사는 아무것도 증명하지 못한다.
   (_admin/build.sh가 forms.js를 vendor로 '복사'하는 것과 같은 이유)
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);

/* app.js에 있는 전역 헬퍼 중 forms.js가 실제로 쓰는 것만 최소로 흉내 낸다.
   esc는 app.js:196의 것을 그대로 옮긴 것이 아니라 — 읽어 온다. */
function readEsc(appSrc) {
  const m = appSrc.match(/function esc\(s\)\s*\{[\s\S]*?\n\}/);
  if (!m) throw new Error('app.js에서 esc()를 찾지 못했습니다 — 함수 모양이 바뀌었나요?');
  return m[0];
}

export function loadFormEngine({ profile = null } = {}) {
  const formsSrc = fs.readFileSync(fileURLToPath(new URL('forms.js', ROOT)), 'utf8');
  const appSrc = fs.readFileSync(fileURLToPath(new URL('app.js', ROOT)), 'utf8');

  const preamble = `
    ${readEsc(appSrc)}
    const state = { profile: __profile };
    const document = { querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ click(){}, remove(){}, style:{} }) };
    const $ = () => null;
    const $$ = () => [];
    const toast = () => {};
    const fetch = () => Promise.resolve({ ok: false });
    const navigator = {};
    const window = {};
    const Blob = function () {};
    const File = function () {};
    const URL2 = null;
  `;
  const epilogue = `
    return { FORM_TEMPLATES, formAutoVal, formQuestionsHtml, renderFormDoc, formDocFullHtml,
             FORM_DAYS, buildPrepTemplate,
             planFormQuestions: (typeof planFormQuestions === 'function' ? planFormQuestions : null),
             formAutoKey: (typeof formAutoKey === 'function' ? formAutoKey : null),
             formAnswerFor: (typeof formAnswerFor === 'function' ? formAnswerFor : null) };
  `;
  // eslint-disable-next-line no-new-func
  const make = new Function('__profile', preamble + '\n' + formsSrc + '\n' + epilogue);
  const eng = make(profile);

  /* data/forms.json을 얹는다 — 앱에서 loadFormTemplates()가 하는 일과 같다 */
  const data = JSON.parse(fs.readFileSync(fileURLToPath(new URL('data/forms.json', ROOT)), 'utf8'));
  Object.assign(eng.FORM_TEMPLATES, data.templates);
  return eng;
}

/* 검사용 표준 프로필 — 값이 비면 자동채움이 도는지 안 도는지 구분이 안 된다 */
export const SAMPLE_PROFILE = {
  name: '홍길동', school: '성균관대학교', major: '소프트웨어학과', year: 3,
  track: 'eng', status: '재학', gpa: 4.02, bracket: 4, campus: '', region: '서울',
  flags: [], cert: false, exchange: false,
  common: {
    studentId: '2022123456', birth: '2003.05.14', phone: '010-1234-5678',
    email: 'hong@skku.edu', bank: '국민은행', account: '123456-78-901234',
  },
};
