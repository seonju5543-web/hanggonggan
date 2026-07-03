/* ============================================================
   한장 — 장학금 데이터 (시연용)
   ※ 실제 서비스 시 한국장학재단·각 대학 공식 공고 연동으로
     대체되는 예시 데이터입니다. (source_kind: sample)
   ============================================================ */

/* 전국 주요 대학 (검색 자동완성용 — 직접 입력도 가능) */
const UNIVERSITIES = [
  '서울대학교', '연세대학교', '고려대학교', '한국외국어대학교', '서강대학교',
  '성균관대학교', '한양대학교', '중앙대학교', '경희대학교', '이화여자대학교',
  '서울시립대학교', '건국대학교', '동국대학교', '홍익대학교', '숙명여자대학교',
  '국민대학교', '숭실대학교', '세종대학교', '단국대학교', '광운대학교',
  '명지대학교', '상명대학교', '가톨릭대학교', '아주대학교', '인하대학교',
  '가천대학교', '경기대학교', '한국항공대학교', '서울과학기술대학교', '한성대학교',
  '부산대학교', '경북대학교', '전남대학교', '전북대학교', '충남대학교',
  '충북대학교', '강원대학교', '제주대학교', '경상국립대학교', '부경대학교',
  'KAIST', 'POSTECH', 'UNIST', 'GIST', 'DGIST',
  '한동대학교', '울산대학교', '영남대학교', '계명대학교', '동아대학교',
  '조선대학교', '원광대학교', '순천향대학교', '한림대학교', '을지대학교',
];

/* 전공 계열 */
const TRACKS = [
  { id: 'humanities',  label: '인문·어문' },
  { id: 'social',      label: '사회과학' },
  { id: 'business',    label: '상경·경영' },
  { id: 'education',   label: '사범·교육' },
  { id: 'science',     label: '자연과학' },
  { id: 'engineering', label: '공학·IT' },
  { id: 'arts',        label: '예술·체육' },
  { id: 'medical',     label: '의약·간호' },
];

/*
  eligibility 규칙 필드
  - minGpa        : 직전학기 최저 평점 (4.5 만점)
  - maxBracket    : 학자금 지원구간 상한 (1~10)
  - years         : 지원 가능 학년 배열
  - tracks        : 지원 가능 전공 계열 배열 (없으면 전체)
  - flagsAny      : 프로필 특별자격 중 하나라도 해당해야 함
  - freshmanOnly  : 신입생 전용
  - seoulOnly     : 서울 거주 요건
  - selective     : true면 요건 충족 시에도 '선발 심사' 대상
  - needCert      : 외국어 공인성적 보유 요건
  - exchange      : 교환학생 (예정) 요건
*/

/* ---------------- 교외 장학금 (전국 공통) ---------------- */
const NATIONAL_SCHOLARSHIPS = [
  {
    id: 'kosaf-type1',
    name: '국가장학금 Ⅰ유형',
    type: '교외',
    provider: '한국장학재단',
    amount: '학기당 최대 285만원',
    amountValue: 2850000,
    deadline: '2026-09-10',
    period: '2026학년도 2학기',
    summary: '소득연계형 국가장학금. 학자금 지원구간에 따라 등록금 범위 내에서 차등 지원됩니다.',
    eligibility: { minGpa: 2.75, maxBracket: 8 },
    documents: ['가구원 동의 (온라인)', '성적증명서 (자동 제출)', '재학증명서 (자동 제출)'],
    duplicable: true,
    note: '지원구간 1~3구간은 등록금 전액 수준까지 지원됩니다.',
  },
  {
    id: 'kosaf-type2',
    name: '국가장학금 Ⅱ유형 (대학연계지원형)',
    type: '교외',
    provider: '한국장학재단 · 재학 대학',
    amount: '대학 자체기준 차등 지급',
    amountValue: 1000000,
    deadline: '2026-09-10',
    period: '2026학년도 2학기',
    summary: '대학의 등록금 부담완화 노력과 연계하여 학교 자체 기준으로 지원하는 국가장학금입니다.',
    eligibility: { minGpa: 2.75, maxBracket: 9 },
    documents: ['가구원 동의 (온라인)', '성적증명서 (자동 제출)'],
    duplicable: true,
    note: '국가장학금 Ⅰ유형과 중복 수혜 가능합니다.',
  },
  {
    id: 'kosaf-multichild',
    name: '다자녀 국가장학금',
    type: '교외',
    provider: '한국장학재단',
    amount: '학기당 최대 285만원',
    amountValue: 2850000,
    deadline: '2026-09-10',
    period: '2026학년도 2학기',
    summary: '다자녀(자녀 3명 이상) 가구의 대학생에게 등록금 부담을 덜어주는 국가장학금입니다.',
    eligibility: { minGpa: 2.75, maxBracket: 8, flagsAny: ['multiChild'] },
    documents: ['가족관계증명서 (정부24 자동 연동)', '성적증명서 (자동 제출)'],
    duplicable: false,
    note: '국가장학금 Ⅰ유형과 중복 신청 시 유리한 유형으로 자동 지급됩니다.',
  },
  {
    id: 'kosaf-work',
    name: '국가근로장학금',
    type: '교외',
    provider: '한국장학재단',
    amount: '교내 시급 9,860원 · 교외 시급 12,220원',
    amountValue: 1200000,
    deadline: '2026-08-28',
    period: '2026학년도 2학기',
    summary: '교내외 근로기관에서 근로하고 장학금을 받는 프로그램. 직업 체험 기회도 제공됩니다.',
    eligibility: { minGpa: 2.0, maxBracket: 8 },
    documents: ['가구원 동의 (온라인)', '재학증명서 (자동 제출)'],
    duplicable: true,
    note: '학기당 최대 520시간까지 근로 가능합니다.',
  },
  {
    id: 'kosaf-humanities',
    name: '인문100년장학금 (국가우수장학)',
    type: '교외',
    provider: '한국장학재단',
    amount: '등록금 전액 + 생활비 250만원',
    amountValue: 6000000,
    deadline: '2026-08-20',
    period: '2026학년도 2학기',
    summary: '인문·사회계열 우수 학생을 지원하는 국가우수장학금입니다.',
    eligibility: { minGpa: 3.5, tracks: ['humanities', 'social'], selective: true },
    documents: ['성적증명서 (자동 제출)', '자기소개서', '학업계획서'],
    duplicable: false,
    note: '계속 장학생은 성적 기준 충족 시 졸업 시까지 지원됩니다.',
  },
  {
    id: 'kosaf-science',
    name: '대통령과학장학금 (국가우수장학)',
    type: '교외',
    provider: '한국장학재단',
    amount: '등록금 전액 + 학업장려비',
    amountValue: 7000000,
    deadline: '2026-08-20',
    period: '2026학년도 2학기',
    summary: '자연·공학계열 최우수 인재를 지원하는 국가우수장학금입니다.',
    eligibility: { minGpa: 3.8, tracks: ['science', 'engineering'], selective: true },
    documents: ['성적증명서 (자동 제출)', '연구계획서', '추천서 (지도교수)'],
    duplicable: false,
    note: '수혜 중 이공계 분야 진출 의무가 있습니다.',
  },
  {
    id: 'seoul-hope',
    name: '서울희망 대학진로 장학금',
    type: '교외',
    provider: '서울장학재단',
    amount: '학기당 150만원',
    amountValue: 1500000,
    deadline: '2026-08-31',
    period: '2026학년도 2학기',
    summary: '서울 거주 대학생의 학업과 진로 준비를 지원하는 장학금입니다.',
    eligibility: { minGpa: 2.5, maxBracket: 6, seoulOnly: true, selective: true },
    documents: ['주민등록등본 (정부24 자동 연동)', '성적증명서 (자동 제출)'],
    duplicable: true,
    note: '서울시 거주 기간 1년 이상이어야 합니다.',
  },
  {
    id: 'kwanjeong',
    name: '관정이종환교육재단 국내장학생',
    type: '교외',
    provider: '관정이종환교육재단',
    amount: '연간 등록금 전액',
    amountValue: 8000000,
    deadline: '2026-09-05',
    period: '2026학년도',
    summary: '국내 최대 규모 민간 장학재단의 성적우수 장학금입니다.',
    eligibility: { minGpa: 3.6, selective: true },
    documents: ['성적증명서 (자동 제출)', '자기소개서', '추천서 (지도교수)'],
    duplicable: false,
    note: '타 장학금과 중복 수혜가 제한됩니다.',
  },
  {
    id: 'mirae-exchange',
    name: '미래에셋 해외교환 장학금',
    type: '교외',
    provider: '미래에셋희망재단',
    amount: '최대 500만원 (지역별 차등)',
    amountValue: 5000000,
    deadline: '2026-08-25',
    period: '2026학년도 2학기 파견',
    summary: '해외 교환학생 파견 예정자에게 체재비를 지원하는 장학금입니다.',
    eligibility: { minGpa: 3.0, exchange: true, selective: true },
    documents: ['교환학생 파견 확인서', '성적증명서 (자동 제출)', '수학계획서'],
    duplicable: true,
    note: '파견 대학 소재 지역에 따라 지원 금액이 다릅니다.',
  },
];

/* ---------------- 교내 장학금 템플릿 (재학 대학 기준 생성) ---------------- */
function buildCampusScholarships(school) {
  const list = [
    {
      id: 'campus-merit',
      name: '성적우수 장학금',
      amount: '등록금의 30~100%',
      amountValue: 3500000,
      deadline: '2026-08-22',
      summary: '직전학기 성적 우수자에게 학과별 석차 기준으로 지급되는 교내 대표 장학금입니다.',
      eligibility: { minGpa: 3.5, selective: true },
      documents: ['성적증명서 (자동 제출)'],
      duplicable: false,
      note: '학과별 정원 대비 석차로 선발됩니다. 앱에서 신청 의사를 등록하면 누락을 방지할 수 있어요.',
    },
    {
      id: 'campus-need',
      name: '가계곤란 장학금',
      amount: '학기당 100~200만원',
      amountValue: 2000000,
      deadline: '2026-08-29',
      summary: '가계 곤란 학생의 학업 지속을 지원하는 교내 장학금입니다.',
      eligibility: { minGpa: 2.0, maxBracket: 4 },
      documents: ['학자금 지원구간 확인 (자동 연동)', '사유서'],
      duplicable: true,
      note: '기초생활수급자·차상위계층은 우선 선발됩니다.',
    },
    {
      id: 'campus-work',
      name: '교내 근로장학금',
      amount: '시급 10,030원 (월 최대 60시간)',
      amountValue: 1200000,
      deadline: '2026-08-27',
      summary: '도서관·행정부서 등 교내 기관에서 근로하며 장학금을 받는 프로그램입니다.',
      eligibility: { minGpa: 2.0 },
      documents: ['재학증명서 (자동 제출)', '근로 희망부서 신청서'],
      duplicable: true,
      note: '수업 시간표와 겹치지 않는 범위에서 배정됩니다.',
    },
    {
      id: 'campus-alumni',
      name: '총동문회 장학금',
      amount: '학기당 100만원',
      amountValue: 1000000,
      deadline: '2026-09-08',
      summary: '동문회 기금으로 성실한 재학생을 지원하는 장학금입니다.',
      eligibility: { minGpa: 3.0, maxBracket: 6, selective: true },
      documents: ['성적증명서 (자동 제출)', '자기소개서'],
      duplicable: true,
      note: '학과 교수 추천이 있으면 우대됩니다.',
    },
    {
      id: 'campus-freshman',
      name: '신입생 입학성적 우수 장학금',
      amount: '등록금의 50~100%',
      amountValue: 4000000,
      deadline: '2026-08-18',
      summary: '입학 성적 우수 신입생에게 지급되는 장학금입니다. 1학년 2학기는 직전학기 성적 기준으로 연장됩니다.',
      eligibility: { years: [1], freshmanOnly: true, minGpa: 3.3 },
      documents: ['성적증명서 (자동 제출)'],
      duplicable: false,
      note: '연장 조건: 직전학기 3.3 이상.',
    },
    {
      id: 'campus-welfare',
      name: '보훈·복지 장학금',
      amount: '등록금 전액 또는 반액',
      amountValue: 4000000,
      deadline: '2026-09-01',
      summary: '국가유공자 자녀, 장애 학생, 기초생활수급자 등을 위한 복지 장학금입니다.',
      eligibility: { flagsAny: ['merit', 'disabled', 'basicLiving', 'nearPoverty'] },
      documents: ['해당 자격 증명서 (정부24 자동 연동)', '재학증명서 (자동 제출)'],
      duplicable: true,
      note: '자격 유형에 따라 지원 금액이 다릅니다.',
    },
  ];

  /* 외국어 특성화 대학 전용 */
  if (/외국어대/.test(school)) {
    list.push({
      id: 'campus-global',
      name: '글로벌 리더 장학금 (외국어우수)',
      amount: '학기당 150만원',
      amountValue: 1500000,
      deadline: '2026-09-03',
      summary: '공인 외국어 성적 우수자에게 지급되는 외국어 특성화 장학금입니다.',
      eligibility: { minGpa: 3.0, needCert: true, selective: true },
      documents: ['공인 외국어성적표', '성적증명서 (자동 제출)'],
      duplicable: true,
      note: 'FLEX, TOEFL, HSK, JLPT, DELE, DELF 등 인정. 2개 언어 이상 보유 시 가산점.',
    });
  }

  return list.map((s) => ({
    ...s,
    type: '교내',
    provider: school,
    period: '2026학년도 2학기',
  }));
}

const FLAG_LABELS = {
  basicLiving: '기초생활수급자',
  nearPoverty: '차상위계층',
  multiChild: '다자녀 가구 (3자녀 이상)',
  merit: '국가유공자 (본인/자녀)',
  disabled: '장애 학생',
};
