/* 만들어진 양식에 **원본의 항목이 다 들어 있나**를 본다 (2026-08-14 신설)
   ------------------------------------------------------------------
   `form-quality.mjs`와 짝이지만 보는 것이 정반대다.

     · form-quality  — 나온 양식에 **이상한 것이 들어갔나** (단위 한 글자·부스러기 선택지·공고문)
     · form-coverage — 원본에 있던 것이 **빠지지 않았나**

   왜 둘 다 필요한가: 무료 변환기의 가장 위험한 실패는 **조용한 누락**이다. 남은 항목은
   전부 멀쩡해 보여서 form-quality는 통과시킨다. 실제로 겪은 것들 —

     · 인하대 변호산장학금 — 자기소개서 **4문항 중 3번 "학업계획 및 향후 진로계획"만** 빠짐.
       학생이 이 양식으로 쓰면 재단이 요구한 문항 하나를 빼고 낸다.
     · 방송대 중앙도서관 국가근로 — **우선선발 대상자 체크칸**(장애인·다자녀·다문화·보훈…)과
       **자기소개 및 지원 사유**가 통째로 빠짐. 둘 다 선발에 직결되는 칸이다.
     · 염곡문화재단 — 서약 본문·생년월일·보호자 연락처 빠짐(원본 3장 → 질문 8개).

   운영 원칙 4는 "원본에 첨부된 신청서와 **동일한 구조**"를 요구한다. 항목이 빠진 문서는
   그 조건을 못 지키고, **없는 것보다 나쁘다**(학생이 모자란 신청서를 그대로 제출한다).

   ⚠️ 이 검사는 **원본 글자가 있을 때만** 뜻이 있다. 원본이 없으면 '통과'가 아니라
   **'모른다'**이다. 그 둘을 뭉뚱그리면 확인한 적 없는 양식이 확인된 것처럼 보인다
   (이 저장소의 '못 읽음을 사실로 단정하지 말 것' 원칙과 같은 계열). */

/* 한국 신청서에 거의 항상 나오는 칸 이름 — 이것만 본다.
   원본 전체를 낱말로 훑으면 안내문·제출서류 목록까지 '빠진 항목'으로 세어 헛경보가 난다. */
const SLOT = /(성\s*명|생년월일|학\s*번|학\s*과|전\s*공|학\s*년|연락처|휴대(?:전화|폰)|이메일|e-?mail|주\s*소|성\s*별|은\s*행|계좌|보호자|평점|소득분위|지원\s*동기|지원\s*사유|자기소개|학업\s*계획|진로\s*계획|우선선발|서\s*약)/gi;

/* 프로필에서 자동으로 채워 넣는 칸은 id로 들어 있다 — 그것도 '들어 있는 것'으로 친다 */
const ALIAS = {
  성명: 'name', 생년월일: 'birth', 학번: 'studentid', 학과: 'major', 전공: 'major',
  학년: 'grade', 연락처: 'phone', 휴대전화: 'phone', 휴대폰: 'phone',
  이메일: 'email', email: 'email', 'e-mail': 'email', 주소: 'address',
  은행: 'bank', 계좌: 'account', 평점: 'gpa', 소득분위: 'income',
};

const squash = (s) => String(s || '').replace(/[\s:：.·]/g, '').toLowerCase();

/* 🔴 개인정보 동의서의 '수집·이용 항목' 나열을 **양식의 빈칸으로 세면 안 된다**
   (2026-08-20 크레딧 누수 조사에서 찾은 진짜 버그).
   동의서에는 "수집·이용하는 개인정보 항목: 성명, 생년월일, 주소, 연락처, 이메일, 평점, 소득분위"
   같은 줄이 있다. 이건 '이런 정보를 가져다 쓰겠다'는 **설명**이지 학생이 채울 칸이 아니다.
   그런데 이 검사는 원본 어디에 나오든 칸으로 셌기 때문에, 동의서는 빈칸 6개가 늘 '빠짐'으로
   나와 **어떤 변환기도 통과할 수 없었다.** 통과 못 하면 큐에 남고, 큐에 남으면 다음 실행이
   또 유료 API로 보낸다 — 하루 4회씩 같은 동의서를 끝없이 재전송한 원인이다.
   그래서 그 나열 구간(항목 머리글 ~ 다음 절/빈 줄)을 세기 전에 들어낸다. */
const COLLECTED_HEAD = /(수집[·\s]*이용(하는)?\s*(개인정보\s*)?(항목|정보)|수집하는\s*개인정보의?\s*항목|개인정보\s*수집\s*항목)/;
function stripCollectedList(text) {
  return String(text || '').split(/\n/).reduce((acc, line) => {
    if (acc.skip) {
      // 다음 절 머리글이나 빈 줄을 만나면 다시 센다 — 나열은 보통 한 문단이다
      if (!line.trim() || /^[\s]*[○●■□▶◆\d가-힣][.)]\s|^\s*\[/.test(line)) acc.skip = false;
      else return acc;
    }
    if (COLLECTED_HEAD.test(line)) { acc.skip = true; return acc; }
    acc.out.push(line);
    return acc;
  }, { out: [], skip: false }).out.join('\n');
}

/* originalText: 저장된 원본 첨부의 글자(여러 장이면 이어 붙인 것)
   반환: { known, missing[], want[] }  — known=false면 '모른다'(원본 없음) */
export function checkFormCoverage(tpl, originalText) {
  if (!originalText || originalText.trim().length < 40) return { known: false, missing: [], want: [] };
  const want = [...new Set((stripCollectedList(originalText).match(SLOT) || []).map(squash))];
  const have = squash((tpl?.sections || []).flatMap((s) => [
    ...(s.fields || []).map((f) => f.label),
    ...(s.fields || []).map((f) => f.id),
    /* 선택지·질문 문구도 '들어 있는 것'이다 — 안 보면 체크칸으로 담은 항목이
       '빠졌다'로 나온다(2026-08-14: 방송대 이력서의 '초등 2학년 이하'가 그랬다). */
    ...(s.fields || []).flatMap((f) => f.options || []),
    ...(s.fields || []).map((f) => f.q || ''),
    ...(s.fields || []).map((f) => f.placeholder || ''),
    ...(s.info || []).flat(),
    /* 🔴 절 제목의 키는 `heading`이다. `title`만 읽으면 손으로 만든 양식의 절 제목
       ('자기소개서' 등)을 통째로 못 봐서 **멀쩡한 양식이 '빠졌다'로 나온다**
       (2026-08-14에 실제로 그랬다). 로봇 판이 쓰던 `title`도 함께 본다. */
    s.heading || '', s.title || '', s.note || '',
  ]).join('|') + '|' + (tpl?.pledge || '') + '|' + (tpl?.note || ''));
  const missing = want.filter((w) => !have.includes(w) && !(ALIAS[w] && have.includes(ALIAS[w])));
  return { known: true, missing, want };
}

export default checkFormCoverage;
