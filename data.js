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

/* ---------------- 교내 장학금 템플릿 (재학 대학·캠퍼스 기준 생성) ---------------- */
function buildCampusScholarships(school, campus) {
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
    provider: campus ? `${school} ${campus}` : school,
    period: '2026학년도 2학기',
  }));
}

/* 학교 검색 별칭 (줄임말 → 정식 명칭) */
const UNIV_ALIASES = {
  '외대': '한국외국어대학교', '한국외대': '한국외국어대학교', '한외대': '한국외국어대학교',
  '서울대': '서울대학교', '연대': '연세대학교', '고대': '고려대학교',
  '서강': '서강대학교', '성대': '성균관대학교', '성균관': '성균관대학교',
  '한양': '한양대학교', '중대': '중앙대학교', '경희': '경희대학교',
  '이대': '이화여자대학교', '이화': '이화여자대학교', '시립대': '서울시립대학교',
  '서울시립': '서울시립대학교', '건대': '건국대학교', '동대': '동국대학교',
  '홍대': '홍익대학교', '숙대': '숙명여자대학교', '숙명': '숙명여자대학교',
  '국민대': '국민대학교', '숭실': '숭실대학교', '세종대': '세종대학교',
  '단대': '단국대학교', '광운': '광운대학교', '명지': '명지대학교',
  '아주': '아주대학교', '인하': '인하대학교', '가천': '가천대학교',
  '항공대': '한국항공대학교', '과기대': '서울과학기술대학교', '서울과기대': '서울과학기술대학교',
  '부산대': '부산대학교', '부대': '부산대학교', '경북대': '경북대학교',
  '전남대': '전남대학교', '전북대': '전북대학교', '충남대': '충남대학교',
  '충북대': '충북대학교', '강원대': '강원대학교', '제주대': '제주대학교',
  '카이스트': 'KAIST', '포스텍': 'POSTECH', '포항공대': 'POSTECH',
  '유니스트': 'UNIST', '지스트': 'GIST', '디지스트': 'DGIST',
  '한동': '한동대학교', '울산대': '울산대학교', '영남대': '영남대학교',
};

/* 학과 자동추천 — 전국 공통 학과 카탈로그 (시연용) */
const MAJORS_COMMON = [
  '국어국문학과', '영어영문학과', '중어중문학과', '일어일문학과', '불어불문학과',
  '독어독문학과', '노어노문학과', '사학과', '철학과', '언어학과',
  '경영학과', '경제학과', '무역학과', '회계학과', '금융학과',
  '행정학과', '정치외교학과', '사회학과', '심리학과', '사회복지학과',
  '미디어커뮤니케이션학과', '광고홍보학과', '법학과', '국제학부', '자유전공학부',
  '교육학과', '국어교육과', '영어교육과', '수학교육과', '체육교육과',
  '수학과', '물리학과', '화학과', '생명과학과', '통계학과', '지구환경과학과',
  '컴퓨터공학과', '소프트웨어학과', '인공지능학과', '데이터사이언스학과', '정보보호학과',
  '전자공학과', '전기공학과', '기계공학과', '화학공학과', '신소재공학과',
  '토목공학과', '건축학과', '산업공학과', '항공우주공학과', '조선해양공학과',
  '간호학과', '약학과', '의예과', '치의예과', '수의예과', '식품영양학과',
  '체육학과', '음악학과', '미술학과', '디자인학과', '연극영화학과', '관광경영학과',
];

/* 학교별 학과 카탈로그 (시연용 — 실서비스에서는 학교 데이터 연동으로 대체) */
const MAJORS_BY_SCHOOL = {
  '한국외국어대학교': [
    '영어학과', 'ELLT학과', 'EICC학과', '영미문학문화학과', '프랑스어학부',
    '독일어과', '스페인어과', '이탈리아어과', '포르투갈어과', '네덜란드어과',
    '스칸디나비아어과', '러시아어과', '폴란드어과', '체코슬로바키아어과', '루마니아어과',
    '중국언어문화학부', '중국외교통상학부', '일본언어문화학부', '융합일본지역학부',
    '베트남어과', '태국어과', '말레이·인도네시아어과', '아랍어과', '튀르키예·아제르바이잔어과',
    '페르시아어·이란학과', '인도어과', '몽골어과', '한국어교육과',
    '정치외교학과', '행정학과', '미디어커뮤니케이션학부', '국제통상학과', '경제학부',
    '경영학부', 'LD학부', 'LT학부', '국제학부', 'ELD학부',
    '수학과', '통계학과', '물리학과', '화학과', '환경학과', '생명공학과',
    '컴퓨터공학부', '정보통신공학과', '전자공학과', '산업경영공학과', 'AI데이터융합학부',
  ],
};

/* 이원화·분교 캠퍼스 (캠퍼스별로 장학 공고가 다를 수 있음) */
const CAMPUSES_BY_SCHOOL = {
  '연세대학교': ['신촌캠퍼스', '미래캠퍼스(원주)'],
  '고려대학교': ['서울캠퍼스(안암)', '세종캠퍼스'],
  '한국외국어대학교': ['서울캠퍼스', '글로벌캠퍼스(용인)'],
  '성균관대학교': ['인문사회과학캠퍼스(서울)', '자연과학캠퍼스(수원)'],
  '경희대학교': ['서울캠퍼스', '국제캠퍼스(용인)'],
  '중앙대학교': ['서울캠퍼스', '다빈치캠퍼스(안성)'],
  '한양대학교': ['서울캠퍼스', 'ERICA캠퍼스(안산)'],
  '건국대학교': ['서울캠퍼스', '글로컬캠퍼스(충주)'],
  '동국대학교': ['서울캠퍼스', 'WISE캠퍼스(경주)'],
  '홍익대학교': ['서울캠퍼스', '세종캠퍼스'],
  '단국대학교': ['죽전캠퍼스', '천안캠퍼스'],
  '상명대학교': ['서울캠퍼스', '천안캠퍼스'],
  '명지대학교': ['인문캠퍼스(서울)', '자연캠퍼스(용인)'],
};

/* 서류 보관함 슬롯 — 요구 서류명과 자동 매칭 */
const DOC_SLOTS = [
  { slot: 'gradeCert',  label: '성적증명서',        match: /성적증명서/,   issue: '학교 포털 증명발급 또는 웹민원센터 (인터넷 즉시 발급)' },
  { slot: 'enrollCert', label: '재학증명서',        match: /재학증명서/,   issue: '학교 포털 증명발급 (인터넷 즉시 발급)' },
  { slot: 'family',     label: '가족관계증명서',     match: /가족관계증명서/, issue: '정부24 (gov.kr) 무료 발급' },
  { slot: 'resident',   label: '주민등록등본',       match: /주민등록등본/,  issue: '정부24 (gov.kr) 무료 발급' },
  { slot: 'welfare',    label: '수급·차상위 등 자격 증명', match: /자격 증명서/, issue: '정부24 또는 주민센터' },
  { slot: 'langCert',   label: '공인 외국어성적표',   match: /외국어성적표/,  issue: '각 시험 주관사 홈페이지에서 성적표 발급' },
  { slot: 'exchange',   label: '교환학생 파견 확인서', match: /파견 확인서/,  issue: '학교 국제교류팀 발급' },
  { slot: 'recommend',  label: '추천서',            match: /추천서/,       issue: '지도교수님께 요청 (양식은 공고 첨부 확인)' },
];
function slotForDoc(doc) {
  return DOC_SLOTS.find((s) => s.match.test(doc)) || null;
}

/* 공식 확인·최종 제출 채널 (신청 준비 완료 후 안내) */
const OFFICIAL_CHANNELS = {
  'kosaf-type1':      { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'kosaf-type2':      { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'kosaf-multichild': { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'kosaf-work':       { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'kosaf-humanities': { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'kosaf-science':    { label: '한국장학재단', url: 'https://www.kosaf.go.kr' },
  'seoul-hope':       { label: '서울장학재단', url: 'https://www.hissf.or.kr' },
  'kwanjeong':        { label: '관정이종환교육재단', url: 'https://www.ikef.or.kr' },
  'mirae-exchange':   { label: '미래에셋희망재단 홈페이지' },
};
/* 접수 채널별 최종 제출 단계 가이드 */
const SUBMIT_GUIDES = {
  kosaf: [
    '한국장학재단 홈페이지(kosaf.go.kr) 또는 앱에 접속해요',
    '통합신청 기간에 로그인(본인 인증)하고 신청서를 작성해요',
    '가구원 정보제공 동의를 진행해요 (부모님 인증 필요)',
    '이 앱에서 준비한 내용은 [복사] 버튼으로 붙여넣을 수 있어요',
  ],
  foundation: [
    '재단 공고에서 접수 방법(이메일·온라인 접수·우편)을 확인해요',
    '이메일 접수라면 [파일과 함께 공유]로 서류를 한 번에 보낼 수 있어요',
    '온라인 접수라면 [복사] 버튼으로 작성한 내용을 붙여넣어요',
  ],
  campus: [
    '학교 포털 장학 메뉴 또는 장학팀 공지에서 접수 방법을 확인해요',
    '이메일 접수라면 [파일과 함께 공유]로 서류를 한 번에 보낼 수 있어요',
    '포털 입력형이라면 [복사] 버튼으로 내용을 붙여넣어요',
  ],
};

function officialChannel(sch) {
  const ch = OFFICIAL_CHANNELS[sch.id];
  if (ch) {
    const kind = sch.id.startsWith('kosaf') ? 'kosaf' : 'foundation';
    return { ...ch, guide: SUBMIT_GUIDES[kind] };
  }
  return { label: `${sch.provider} 장학공지 (학교 포털)`, guide: SUBMIT_GUIDES.campus };
}

const FLAG_LABELS = {
  basicLiving: '기초생활수급자',
  nearPoverty: '차상위계층',
  multiChild: '다자녀 가구 (3자녀 이상)',
  merit: '국가유공자 (본인/자녀)',
  disabled: '장애 학생',
};
