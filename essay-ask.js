/* ============================================================
   한대장 — 서술형 칸의 '키워드 질문' 설계기 (2026-08-23)
   ------------------------------------------------------------
   🔴 이 파일이 있는 이유 (개발자 지적 2026-08-23):

     앱이 학생에게 **"장학금 신청 사유를 자기소개서 형식으로 (A4 2장 내외)"**
     라고 적힌 빈 칸을 던지고 있었다. 그건 우리가 해야 할 일을 학생에게
     떠넘긴 것이다. 그 칸을 채울 수 있는 학생은 애초에 이 앱이 필요 없다.

     서비스가 해야 하는 일은 반대다:
       ① 학생은 **키워드만** 고르거나 짧게 적는다
       ② 앱이 그것으로 **문단과 스토리텔링을 갖춘 제출 수준의 글**을 만든다

   🔴 질문 수 상한(FORM_LIMITS)을 건드리지 않는다.
      키워드 질문은 **그 서술형 칸 안에** 들어간다 — 새 질문이 아니다.
      form-plan.js 의 countPlan 은 plan.secs.items 를 세므로 숫자가 그대로다.
      (증명: verify/verify-essay-ask.mjs 의 '질문 수가 안 늘어난다' 절)

   🔴 여기서 사실을 지어내지 않는다.
      이 파일이 정하는 것은 **무엇을 물을까**이지 **무엇이 사실인가**가 아니다.
      학생이 고르지 않은 보기는 글에 들어가지 않는다(server/essay/draft-guard.mjs).

   데이터가 언제나 이긴다: `data/forms.json` 의 칸에 `ask` 가 적혀 있으면 그것을 쓴다.
   여기 규칙은 **아직 안 적은 칸을 메우는 자리**다 (kind 와 같은 방식).

   브라우저·Node 겸용 (match-engine.js·form-plan.js 와 같은 방식) —
   화면과 검사가 같은 파일로 같은 결과를 봐야 한다.
   ============================================================ */

/* ── 분량 — 원본 라벨에 적힌 것을 그대로 읽는다. 지어내지 않는다. ──
   'A4 2장 내외' · '500자 이상' · '1,000자 이내' · '400~800자' */
function essayTargetChars(text) {
  const t = String(text || '').replace(/,/g, '');
  let m;
  if ((m = t.match(/A4\s*(\d+)\s*장/))) return Math.min(2400, Number(m[1]) * 900);
  if ((m = t.match(/(\d{2,5})\s*~\s*(\d{2,5})\s*자/))) return Math.round((Number(m[1]) + Number(m[2])) / 2);
  if ((m = t.match(/(\d{2,5})\s*자\s*이상/))) return Math.min(2400, Math.round(Number(m[1]) * 1.2));
  if ((m = t.match(/(\d{2,5})\s*자\s*이내/))) return Math.round(Number(m[1]) * 0.85);
  if ((m = t.match(/(\d{2,5})\s*자/))) return Number(m[1]);
  return 500;
}

/* ── 어떤 종류의 서술형인가 ──
   순서가 곧 우선순위다. 구체적인 것부터 본다. */
const ESSAY_KINDS = [
  ['growth', /성장\s*과정|가정\s*환경|자라온|가족\s*사항/],
  ['character', /성격|인생관|장\s*[·․.]?\s*단점|강점|생활\s*신조|가치관/],
  ['value', /가치|중요하게\s*생각/],
  ['study', /학업\s*(목표|계획)|연구\s*계획|수학\s*계획|학습\s*계획/],
  ['future', /장래|포부|진로|졸업\s*후|학위\s*취득\s*후|향후[^\n]{0,8}계획|목표와\s*실행/],
  ['share', /나눔|사회\s*(공헌|기여)|환원|후배/],
  ['use', /사용\s*(계획|내용)|사용계획서|지원금\s*활용/],
  ['idea', /아이디어|창업|사회적\s*문제|제품|고객|시장|결과물|프로그램\s*주제|활용\s*방법|도구|윤리|운영\s*아이디어/],
  ['episode', /경험|사례|일화|증명할\s*수\s*있는/],
  ['message', /하고\s*싶은\s*말|드리고\s*싶은|당부/],
  ['effect', /효과성|필요성|장학금이\s*필요/],
  ['motive', /동기|신청\s*사유|지원\s*사유|지원하게\s*된/],
  ['intro', /자기\s*소개|소개서|한\s*줄\s*소개/],
];

function essayKindOf(label, hint) {
  const t = `${label || ''} ${hint || ''}`;
  for (const [k, re] of ESSAY_KINDS) if (re.test(t)) return k;
  return 'generic';
}

/* ── 종류별 키워드 질문 ──
   c  = 눌러서 고르는 보기 (여러 개 가능)
   free = 짧게 직접 적는 칸
   fu = **되묻기**. 그 보기를 누른 학생에게만 열리는 한 줄 질문 (2026-08-23 개발자 지시)
   eg = 되묻기의 시작 문장. 눌러 넣고 고친다.

   🔴 보기와 예시 문장은 '흔한 사정'이 아니라 **재단이 무엇을 보는가**에 맞춘다
      (개발자 지시 2026-08-23). 재단은 사정 그 자체가 아니라
      **그 사정 속에서도 학업을 어떻게 이어 왔는지**를 본다 —
      조사에서 확인된 심사 관점이다(data/essay-playbook.json 의 know-the-foundation).
      그래서 eg 는 전부 '어려움 + 그래서 한 일' 꼴로 적는다.

   🔴 되묻기가 이 카드의 핵심이다. 백지에 '꼭 넣고 싶은 말'을 물으면 대부분 비운다 —
      학생이 방금 누른 보기에 대해서만 좁게 되물으면 답이 이미 머릿속에 있다. */
const ESSAY_ASKS = {
  motive: [
    { id: 'need', q: '장학금이 필요한 사정', c: ['등록금 부담', '생활비 부담', '가족 건강', '스스로 벌어 다님', '학자금 대출', '가정 형편'],
      fu: '그런 상황에서도 학업을 어떻게 이어 왔나요?',
      eg: ['등록금을 벌면서도 전공 수업은 한 번도 빠지지 않았어요', '아르바이트 시간을 줄이려고 새벽에 공부하는 습관을 들였어요'] },
    { id: 'now', q: '요즘 하고 있는 것', c: ['아르바이트', '전공 공부', '자격증 준비', '어학 공부', '동아리·학회', '가족 돌봄'] },
    { id: 'change', q: '받으면 달라지는 것', c: ['학업에 전념', '아르바이트 축소', '자격증·어학', '휴학 안 해도 됨', '전공 심화'] },
  ],
  intro: [
    { id: 'who', q: '나를 한마디로', c: ['성실함', '끈기', '빠른 습득', '주변을 챙김', '스스로 찾아 함'],
      fu: '그렇게 말할 수 있는 일이 있었나요?',
      eg: ['맡은 조별과제를 마지막까지 정리해 제출까지 마쳤어요', '1년 동안 스터디를 한 번도 빠지지 않았어요'] },
    { id: 'proud', q: '잘하는 것', c: ['끝까지 해냄', '사람들과 잘 지냄', '계획대로 함', '새것을 빨리 배움', '어려움을 버팀'] },
    { id: 'doing', q: '지금 하는 일·활동', free: true, ph: '예: 전공 스터디, 주말 카페 아르바이트' },
    { id: 'want', q: '앞으로 하고 싶은 일', free: true, ph: '예: 통역사, 개발자, 교사' },
  ],
  growth: [
    { id: 'home', q: '자란 환경 (고르고 싶은 것만)', c: ['맞벌이', '한부모', '조부모와 함께', '다자녀', '자영업', '농어촌', '평범한 가정'],
      fu: '그 환경에서 배운 것이 지금 학업에 어떻게 이어지나요?',
      eg: ['부모님이 늦게 오셔서 스스로 계획을 세우는 습관이 생겼고 지금도 그렇게 공부해요', '아껴 쓰는 습관이 생겨 학기 계획을 미리 세워 지킵니다'] },
    { id: 'hard', q: '자라면서 힘들었던 것', c: ['경제적 어려움', '가족의 건강', '잦은 이사', '혼자 있는 시간', '특별히 없음'] },
    { id: 'learn', q: '그때 배운 것', c: ['성실함', '책임감', '아끼는 습관', '배려', '스스로 해내는 힘'] },
  ],
  character: [
    { id: 'strong', q: '나의 장점', c: ['성실함', '끈기', '책임감', '소통', '배려', '꼼꼼함', '실행력'],
      fu: '그 장점이 드러난 일이 있었나요?',
      eg: ['조원들이 빠진 과제를 끝까지 맡아 마감을 지켰어요', '아르바이트와 수업을 병행하며 한 학기 개근했어요'] },
    { id: 'weak', q: '고치고 싶은 점', c: ['완벽주의', '거절을 못함', '성급함', '낯가림', '혼자 떠안음'] },
    { id: 'fix', q: '그걸 다루는 방법', c: ['미리 계획', '먼저 말하기', '기한 나누기', '도움 청하기'] },
    { id: 'motto', q: '생활 신조 한 줄', free: true, ph: '예: 오늘 할 일은 오늘 끝낸다' },
  ],
  value: [
    { id: 'val', q: '중요하게 여기는 것', c: ['정직', '성실', '책임', '배려', '가족', '꾸준함', '나눔'],
      fu: '그렇게 생각하게 된 일이 있었나요?',
      eg: ['형편이 어려울 때 도움을 받아 본 뒤로 받은 만큼 돌려주려고 해요', '약속을 지키는 사람이 결국 신뢰를 얻는 걸 보고 그렇게 살려고 합니다'] },
    { id: 'keep', q: '지키려고 하는 일', c: ['약속을 지킴', '끝까지 해냄', '주변을 살핌', '작아도 꾸준히'] },
  ],
  study: [
    { id: 'goal', q: '이번 학기 목표', c: ['성적 향상', '전공 기초', '졸업 요건', '자격증', '어학 점수'],
      fu: '그 목표를 위해 지금 하고 있는 일은 무엇인가요?',
      eg: ['매일 두 시간을 정해 전공 복습을 이어 가고 있어요', '학기 초에 과목별 목표 학점을 정해 두고 주마다 점검합니다'] },
    { id: 'field', q: '집중할 분야', free: true, ph: '예: 통번역, 데이터 분석' },
    { id: 'how', q: '어떻게 할 계획', c: ['수업 충실', '스터디', '프로젝트', '교수님 지도', '매일 정해진 시간'] },
  ],
  future: [
    { id: 'prep', q: '지금 하는 준비', c: ['전공 공부', '자격증', '어학', '인턴·현장', '공모전', '봉사'],
      fu: '그 준비로 최근에 실제로 한 일은 무엇인가요?',
      eg: ['방학 동안 전공 관련 자격증 시험을 준비해 응시했어요', '학기 중 스터디를 만들어 매주 발표를 이어 갔어요'] },
    { id: 'job', q: '졸업 후 하고 싶은 일', free: true, ph: '예: 통역사, 개발자, 사회복지사' },
    { id: 'far', q: '몇 년 뒤 되고 싶은 모습', free: true, ph: '예: 현장에서 신뢰받는 실무자' },
  ],
  share: [
    { id: 'think', q: '나눔에 대한 생각', c: ['받은 만큼 돌려주기', '작은 것부터', '재능으로 돕기', '후배 돕기'],
      fu: '실제로 해 본 일이나 앞으로 하려는 일이 있나요?',
      eg: ['후배에게 전공 과제를 봐 주며 도운 적이 있어요', '전공을 살려 지역 아이들 학습을 돕고 싶어요'] },
    { id: 'plan', q: '하고 싶은 것', c: ['후배 멘토링', '전공 재능기부', '정기 봉사', '기부', '아직 못 정함'] },
  ],
  use: [
    { id: 'where', q: '어디에 쓸 계획', c: ['등록금', '교재비', '응시료', '생활비', '실습·재료비', '교통비'],
      fu: '그 지출이 학업에 어떻게 도움이 되나요?',
      eg: ['등록금 부담이 줄면 아르바이트를 줄이고 수업 준비에 시간을 쓸 수 있어요', '교재비가 해결되면 전공 원서를 직접 사서 공부할 수 있어요'] },
    { id: 'why', q: '그 밖에 덧붙일 것', free: true, ph: '한 줄이면 충분해요' },
  ],
  effect: [
    { id: 'after', q: '지원받으면 가능해지는 것', c: ['학업에 전념', '아르바이트 축소', '자격증·어학', '휴학 안 함', '진로 준비'],
      fu: '그렇게 되면 무엇을 이룰 계획인가요?',
      eg: ['아르바이트를 줄여 전공 심화 과목을 제대로 이수하려고 해요', '남는 시간에 어학 점수를 올려 졸업 요건을 채우려 합니다'] },
    { id: 'now', q: '지금 가장 어려운 것', c: ['등록금', '생활비', '공부할 시간', '학원·교재비'] },
    { id: 'path', q: '희망 진로', free: true, ph: '예: 통역사, 개발자' },
  ],
  idea: [
    { id: 'what', q: '무엇에 대한 것인가요 (한 줄)', free: true, ph: '예: 자취생을 위한 식비 절약 앱' },
    { id: 'who', q: '누구에게 필요한가요', free: true, ph: '예: 혼자 사는 대학생' },
    { id: 'why', q: '왜 필요하다고 생각했나요', free: true, ph: '예: 제가 직접 겪어서요' },
    { id: 'how', q: '어떻게 해 볼 생각인가요', free: true, ph: '예: 학기 중에 시험판을 만들어 친구들에게 써 보게 하려고요' },
  ],
  episode: [
    { id: 'what', q: '어떤 일이었나요 (한 줄)', free: true, ph: '예: 1년 동안 새벽 아르바이트를 하며 수업을 모두 들었어요' },
    { id: 'learn', q: '거기서 얻은 것', c: ['성실함', '책임감', '끈기', '자신감', '사람 대하는 법'],
      fu: '그 배움이 지금 학업에 어떻게 쓰이고 있나요?',
      eg: ['그때 생긴 시간 관리 습관으로 이번 학기 과제를 한 번도 늦지 않았어요', '끝까지 해 본 경험이 있어 어려운 전공 과목도 포기하지 않게 됐어요'] },
    { id: 'hard', q: '그때 어려웠던 점', c: ['시간 부족', '체력적으로 힘듦', '혼자 해냄', '처음 해 봄', '주변의 기대'] },
    { id: 'did', q: '어떻게 해냈나요', c: ['계획대로', '매일 조금씩', '도움을 구함', '끝까지 버팀', '방법을 바꿈'] },
  ],
  message: [
    { id: 'promise', q: '앞으로의 다짐', c: ['학업에 전념', '포기하지 않기', '후배 돕기', '결과로 보여 드리기'],
      fu: '그 다짐을 무엇으로 보여 드릴 수 있을까요?',
      eg: ['남은 학기 성적을 지켜 장학생으로서 부끄럽지 않게 하겠습니다', '졸업 후 후배들에게 같은 도움을 이어 가겠습니다'] },
    { id: 'thank', q: '전하고 싶은 마음', c: ['감사', '도움이 되겠습니다', '성실히 하겠습니다', '돌려드리고 싶습니다'] },
  ],
  generic: [
    { id: 'point', q: '이 칸에 꼭 들어갔으면 하는 것', free: true, ph: '생각나는 대로 짧게 — 문장이 아니어도 돼요' },
    { id: 'why', q: '그 밖에 덧붙일 것', free: true, ph: '한 줄이면 충분해요' },
  ],
};

/* ============================================================
   ── 학생마다 다른 보기 (2026-08-23 개발자 지시) ──
   지금까지 essayAskFor 는 **양식 칸만** 보고 모든 학생에게 같은 보기를 냈다.
   그런데 프로필에는 계열 8 · 학년 4 · 재학상태 3 · 지역 3 · 특별자격 5 가
   이미 들어 있다(288 조합). 새로 묻기 전에 있는 것부터 쓴다.

   🔴 민감정보(기초수급·차상위·유공자·장애)는 **어떤 질문을 낼지 고르는 데만** 쓴다.
      보기 문구에는 절대 넣지 않는다 — 학생이 그 보기를 고르면 그 낱말이 서버로
      나가고, draft-guard 가 400 으로 막아 기능이 통째로 죽는다.
      (개발자 승인 범위: "서버에 반영되는 내용이 아니므로 기기 안에서는 전부 활용")
      회귀 검사가 보기 문구를 전수로 훑는다 — verify/verify-essay-ask.mjs [5].
   ============================================================ */

/* 계열마다 돈 쓰는 데가 다르다 — '교재비'는 공대생에게 실습비고 예체능에겐 재료비다 */
const TRACK_SPEND = {
  engineering: ['실습·재료비', '개발 장비', '학회·공모전 참가비'],
  science: ['실험 재료비', '학회 참가비'],
  medical: ['실습복·실습비', '국가시험 교재'],
  arts: ['재료·악기', '연습실 대관', '작품 제작비'],
  humanities: ['어학 시험 응시료', '원서·전공 도서'],
  education: ['임용 교재', '교생 실습비'],
  business: ['자격증 응시료', '전공 도서'],
  social: ['전공 도서', '자격증 응시료'],
};
/* 계열마다 '지금 하는 준비'도 다르다 */
const TRACK_PREP = {
  engineering: ['전공 프로젝트', '개발 스터디', '공모전'],
  science: ['실험실 참여', '학부연구생'],
  medical: ['실습·임상 준비', '국가시험 준비'],
  arts: ['작품·공연 준비', '실기 연습'],
  humanities: ['어학 공부', '번역·글쓰기 연습'],
  education: ['임용 준비', '교육 봉사'],
  business: ['자격증 준비', '대외활동'],
  social: ['자격증 준비', '전공 스터디'],
};

/* 학년·재학상태마다 글의 무게중심이 다르다.
   신입생에게 '그동안 해 온 일'을 물으면 쓸 말이 없고,
   4학년에게 '앞으로의 다짐'만 물으면 그동안 해 온 것이 통째로 빠진다. */
function essayStage(p) {
  if (!p) return 'mid';
  if (p.status === 'freshman' || Number(p.year) <= 1) return 'new';
  if (p.status === 'returning') return 'back';
  return Number(p.year) >= 4 ? 'late' : 'mid';
}
const STAGE_NOW = {
  new: ['첫 학기 적응', '전공 기초 다지기', '아르바이트', '동아리 찾는 중'],
  back: ['학업 리듬 되찾기', '아르바이트', '밀린 전공 따라잡기', '자격증 준비'],
  late: ['졸업 요건 채우기', '취업·진학 준비', '전공 심화', '아르바이트'],
  mid: [],
};

/* 그 밖의 신호 — 전부 기기 안에서만 쓴다 */
const SIGNAL_CHIPS = {
  cert: '어학 점수 활용',            // 프로필: 공인 외국어성적 보유
  exchange: '교환학생 준비',          // 프로필: 해외 교환학생 파견 예정
  region_etc: '통학·자취 부담',       // 지역: 수도권 밖
  multiChild: '형제자매와 함께 부담',  // 특별자격: 다자녀 (민감 낱말 아님)
};

/* 서류보관함이 아는 것 — 파일도 파일 이름도 서버로 안 나간다.
   여기 쓰는 것은 **무엇을 물을지** 고르는 데까지다 (개발자 지시 2026-08-23 · E안).
   🔴 수급·차상위 자격 증명(welfare) 슬롯은 민감정보라 아예 보지 않는다. */
const DOC_SIGNAL = {
  langCert: { ask: 'langUse', q: '어학 점수를 어디에 쓸 계획인가요', c: ['교환학생', '전공 원서 읽기', '취업 준비', '번역·통역'] },
  exchange: { ask: 'exchangePlan', q: '교환학생으로 무엇을 해 보고 싶나요', c: ['전공 심화', '어학 실력', '현지 경험', '진로 탐색'] },
  recommend: { ask: 'recWho', q: '추천서를 써 주실 분과 어떤 인연인가요', c: ['전공 수업', '연구실·프로젝트', '동아리 지도', '오래 지켜봐 주심'] },
};

/* ============================================================
   ── 스토리텔링 질문 (2026-08-24 · 크롤링으로 배운 규칙에서 나왔다) ──

   되묻기가 열렸을 때만 덧붙는다. 되묻기를 여는 학생에게만 붙으므로 카드가 길어지지 않는다.

   🔴 이 질문들은 **짐작해서 만든 것이 아니다.** 9곳에서 배운 규칙집
      (data/essay-playbook.json)이 "좋은 글에는 이것이 있다"고 말한 것을,
      학생이 **글을 쓰지 않고 눌러서** 줄 수 있는 모양으로 바꾼 것이다.
      그래서 질문마다 `rule` 로 근거를 적어 둔다 — 다음 세션이 '이건 왜 있지?' 하고
      지우지 않게, 그리고 규칙이 바뀌면 질문도 같이 손보게.

        concrete-scene  형용사 대신 구체적인 장면·행동·숫자   → 언제 · 누구와 · 얼마나 오래
        episode-star    상황 → 어려움 → 내가 한 일 → 결과     → 그래서 어떻게 됐나요
        growth-lesson   환경 설명은 짧게, 배운 것에 분량을     → 언제부터 달라졌나요

   🔴 '얼마나 오래'가 숫자를 만든다. 규칙집이 여러 곳에서 '숫자로 쓰라'고 하는데,
      학생에게 "숫자를 쓰세요"라고 하면 아무도 안 쓴다. 눌러서 고르게 하면 준다.
      그리고 그 숫자는 **학생이 준 사실**이라 draft-guard 가 지어냄으로 막지 않는다.
   ============================================================ */
const STORY_ASKS = [
  { id: 'when', q: '주로 언제였나요', rule: 'concrete-scene', for: '*',
    c: ['새벽·야간', '방학 내내', '학기 중 매주', '시험 기간', '몇 달 동안'] },
  /* 🔴 '얼마나 오래'가 '누구와'보다 앞이다. 자리가 3칸뿐인데 뒤로 두었더니
     대부분의 칸에서 잘려 나갔다(전수로 확인하고 고쳤다). 규칙집이 여러 곳에서
     **숫자로 쓰라**고 하는데, 숫자를 만들어 주는 질문이 이것 하나다. */
  { id: 'howLong', q: '얼마나 오래 했나요', rule: 'concrete-scene', for: '*',
    c: ['한 학기 동안', '1년쯤', '2년 넘게', '방학 동안', '지금도 계속'] },
  { id: 'with', q: '누구와 함께였나요', rule: 'concrete-scene', for: '*',
    c: ['혼자서', '가족과', '친구·동기와', '교수님 지도로', '후배들과'] },
  { id: 'result', q: '그래서 어떻게 됐나요', rule: 'episode-star',
    for: ['episode', 'future', 'study', 'motive', 'effect', 'intro', 'generic'],
    c: ['끝까지 마쳤어요', '성적이 올랐어요', '자격증을 땄어요', '주변이 알아줬어요', '아직 하는 중이에요'] },
  { id: 'turn', q: '언제부터 달라졌나요', rule: 'growth-lesson',
    for: ['growth', 'character', 'value', 'message', 'share'],
    c: ['고등학교 때', '대학에 오고 나서', '그 일을 겪고 나서', '가족을 보며', '조금씩 계속'] },
];

/** 그 칸 종류에 맞는 스토리텔링 질문 — 카드가 길어지지 않게 3개까지.
    🔴 **종류 전용을 먼저** 담는다. 공통('*') 셋을 앞에 두면 3칸을 다 먹어
       '그래서 어떻게 됐나요'가 어느 칸에도 안 나온다(실측하고 고쳤다). */
function storyAsksFor(kind) {
  const mine = STORY_ASKS.filter((a) => Array.isArray(a.for) && a.for.includes(kind));
  const any = STORY_ASKS.filter((a) => a.for === '*');
  return mine.concat(any).slice(0, 3);
}

/* 예전 이름 — 다른 곳에서 쓰던 것이 있으면 그대로 돌게 둔다 */
const SCENE_ASKS = STORY_ASKS.filter((a) => a.id === 'when' || a.id === 'with');

/* ============================================================
   ── B · 이 재단이 무엇을 보는가 (2026-08-24 개발자 컨펌 후 되살림) ──

   경위: 처음 낸 안은 "저는 이 재단이 찾는 인재입니다" 같은 **자기규정 문장**을
   글에 넣는 것이었고, 개발자가 "이상적인 예시문에 그런 문장은 없다"며 보류시켰다.
   그 뒤 9곳을 읽어 보니 개발자가 맞았다 — 자기규정을 권한 곳은 **한 곳도 없었고**,
   오히려 `no-self-label`(자기규정 금지)이 여러 곳에서 나왔다.

   대신 5곳이 공통으로 말한 것은 `know-the-foundation` 이다:
     **재단의 목적을 알고, 거기에 이어지는 내 재료를 앞세워라.**

   그래서 B 를 이렇게 다시 만들었다 — 문장을 만들어 넣는 것이 아니라 **순서를 정한다**:
     ① 공고 원문·이름에서 이 재단이 보는 것을 읽는다 (아래 FOCUS_THEMES)
     ② 학생에게 낼 보기에서 그것과 이어지는 것을 앞에 둔다
     ③ 초안 서버에 '이 재단이 보는 것'을 함께 보내 앞 문단에 배치하게 한다
   학생에게 질문을 더 던지지 않는다. 이미 가진 공고 정보만 쓴다.

   🔴 지어내지 않는다. 공고 원문에 그 낱말이 실제로 있을 때만 켜진다 —
      없으면 focus 는 빈 배열이고 예전과 똑같이 동작한다(원칙 8-1).
   ============================================================ */
const FOCUS_THEMES = [
  { id: 'faith',  re: /신앙|교회|기독|성도|불자|불교|천주교/, say: '신앙 생활',
    chips: ['신앙 활동', '교회·모임 봉사'] },
  { id: 'region', re: /지역\s*인재|출신|거주|시민|군민|도민|향우|고향|재학생\s*중\s*[가-힣]{2,4}\s*출신/, say: '지역과의 인연',
    chips: ['고향·지역과의 인연', '지역에서 한 활동'] },
  { id: 'stem',   re: /이공|공학|과학|SW|소프트웨어|반도체|기술|IT|디지털/, say: '이공계 전공 역량',
    chips: ['전공 프로젝트', '실습·실험'] },
  { id: 'share',  re: /나눔|봉사|사회\s*공헌|환원|기여|사랑|이웃/, say: '나눔과 사회 기여',
    chips: ['봉사·나눔 경험', '후배·이웃 돕기'] },
  { id: 'merit',  re: /성적\s*우수|학업\s*우수|학업\s*성적|우수\s*인재|평점|성적\s*기준/, say: '학업 성적과 성실함',
    chips: ['성적 관리', '수업 개근'] },
  { id: 'need',   re: /가정\s*형편|생활\s*형편|저소득|소득\s*기준|소득\s*분위|경제적\s*어려움|형편이\s*어려운|생활비/, say: '경제적 형편',
    chips: [] },
  { id: 'char',   re: /품행|인성|모범|성실|바른/, say: '성실함과 품행',
    chips: ['꾸준히 해 온 일'] },
  { id: 'global', re: /글로벌|해외|교환|어학|국제/, say: '국제 역량',
    chips: ['어학 공부', '교환학생 준비'] },
  { id: 'leader', re: /리더|지도자|인재\s*육성|미래\s*인재|차세대/, say: '앞으로의 성장 가능성',
    chips: ['맡아서 이끈 일'] },
];

/* 공고가 순위를 직접 적어 둔 경우가 있다 — 실제 문구:
   `<소득기준 [평가기준1순위]>` `<학업성적 [평가기준2순위]>` `<사회공헌 [평가기준3순위]>`
   (collector/extracted 의 공고 원문에서 확인. 재단이 스스로 밝힌 순서라 우리 짐작보다 낫다.) */
const FOCUS_RANK = /(?:평가|심사)\s*기준\s*(\d)\s*순위/;

/** 이 공고가 무엇을 보는가 — 원문에 있는 것만. 없으면 빈 배열. */
function foundationFocus(sch) {
  if (!sch) return [];
  const quotes = Array.isArray(sch.quotes) ? sch.quotes : [];
  const hay = `${sch.name || ''} ${sch.provider || ''} ${quotes.join(' ')}`;
  const out = [];
  for (const t of FOCUS_THEMES) {
    if (!t.re.test(hay)) continue;
    /* 그 낱말이 들어 있는 줄에 '평가기준N순위'가 함께 있으면 그 순위를 그대로 쓴다 */
    let rank = 9;
    for (const q of quotes) {
      if (!t.re.test(q)) continue;
      const m = q.match(FOCUS_RANK);
      if (m) rank = Math.min(rank, Number(m[1]));
    }
    out.push({ id: t.id, say: t.say, chips: t.chips || [], rank });
  }
  /* 재단이 밝힌 순위 → 그다음은 찾은 순서(구체적인 것부터) */
  return out.sort((a, b) => a.rank - b.rank).slice(0, 3);
}

/* ── 블라인드 심사 — 학교명을 쓰면 심사에서 제외된다 ──
   🔴 실제 공고 문구(collector/extracted/form-x0lmrs-1.hwp.body.txt):
      "자기소개서에 소속 대학교를 식별할 수 있는 정보(학교명 등)를 기재한 경우 심사에서 제외"
   우리는 프로필의 학교를 초안 서버에 보내고 프롬프트에도 넣는다. 그대로 두면
   **앱이 만든 초안 때문에 학생이 탈락한다.** 공고가 이렇게 말할 때만 켜진다. */
const BLIND_RE = /식별할\s*수\s*있는\s*정보|학교명[\s\S]{0,24}(기재|표기)[\s\S]{0,24}(제외|감점)|블라인드/;
function blindReview(sch) {
  if (!sch) return false;
  const quotes = Array.isArray(sch.quotes) ? sch.quotes : [];
  return BLIND_RE.test(`${sch.name || ''} ${quotes.join(' ')}`);
}

/* 보기 목록에서 특정 값을 갈아 끼운다 (원본을 건드리지 않는다) */
function swapChips(ask, replace, add) {
  const base = (replace && replace.length) ? replace.slice() : (ask.c || []).slice();
  /* 🔴 맞춤 보기를 **앞에** 둔다. 뒤에 붙이면 줄바꿈 아래로 밀려 안 보이고,
     그러면 맞춤이 있으나 마나가 된다(실측하고 고쳤다). */
  const c = [];
  for (const x of (add || [])) if (x && !c.includes(x)) c.push(x);
  for (const x of base) if (x && !c.includes(x)) c.push(x);
  return Object.assign({}, ask, { c: c.slice(0, 8) });
}

/** 프로필·공고·보관함에 맞춰 보기를 고쳐 낸다. 원본 ESSAY_ASKS 는 그대로 둔다. */
function tailorAsks(asks, ctx) {
  const p = (ctx && ctx.profile) || {};
  const track = p.track || '';
  const stage = essayStage(p);
  const flags = p.flags || [];
  const docs = (ctx && ctx.docs) || [];
  /* B — 공고 원문이 실제로 말한 것만. 없으면 빈 배열이라 예전과 똑같이 동작한다. */
  const focusChips = [];
  for (const f of foundationFocus(ctx && ctx.scholarship)) for (const c of f.chips) if (!focusChips.includes(c)) focusChips.push(c);

  const extra = [];
  if (p.cert) extra.push(SIGNAL_CHIPS.cert);
  if (p.exchange) extra.push(SIGNAL_CHIPS.exchange);
  if (p.region && p.region !== 'seoul' && p.region !== 'gyeonggi') extra.push(SIGNAL_CHIPS.region_etc);
  if (flags.includes('multiChild')) extra.push(SIGNAL_CHIPS.multiChild);

  const out = asks.map((a) => {
    if (a.free) return a;
    /* 🔴 맞춤은 **겹친다.** 예전엔 `if … return` 이 줄줄이라 앞의 조건 하나가 걸리면
       뒤의 맞춤이 통째로 무시됐다 — 복학생 보기가 걸려서 B(재단이 보는 것)가
       화면에 한 번도 안 나타났다(시연 화면으로 발견하고 고쳤다).
       그래서 앞세울 보기를 **모아서** 한 번에 넣는다. */
    const add = [];
    /* B — 이 재단이 보는 것과 이어지는 보기를 맨 앞에 (know-the-foundation).
       학생에게 새로 묻지 않는다. 이미 있는 보기의 순서만 바꾼다. */
    if (focusChips.length && ['now', 'prep', 'proud', 'plan', 'think', 'change'].includes(a.id))
      add.push(...focusChips);
    /* 돈 쓰는 데 — 계열마다 다르다 */
    if (a.id === 'where' && TRACK_SPEND[track]) add.push(...TRACK_SPEND[track]);
    /* 지금 하는 준비 — 계열마다 다르다 */
    if (a.id === 'prep' && TRACK_PREP[track]) add.push(...TRACK_PREP[track]);
    /* 요즘 하는 것 — 학년·재학상태마다 다르다 */
    if (a.id === 'now' && STAGE_NOW[stage]) add.push(...STAGE_NOW[stage]);
    /* 사정 — 지역·가구 신호를 덧붙인다 */
    if (a.id === 'need') add.push(...extra);
    if (a.id === 'change' && p.exchange) add.push('교환학생 준비에 집중');
    return add.length ? swapChips(a, null, add) : a;
  });

  /* 보관함이 알려 주는 것 — 그 증명서가 있으면 그것에 대해 **묻는다**.
     내용은 모르므로 답은 학생이 준다(원칙 8-1). */
  for (const slot of docs) {
    const d = DOC_SIGNAL[slot];
    if (d && !out.some((a) => a.id === d.ask)) out.push({ id: d.ask, q: d.q, c: d.c });
  }
  return out.slice(0, 6);
}

/**
 * 서술형 칸 하나에 낼 키워드 질문.
 * @returns {{kind:string, target:number, asks:Array}}
 */
function essayAskFor(field, ctx) {
  const label = String((field && field.label) || '').replace(/\s+/g, ' ');
  const hint = String((field && field.q) || '');
  const target = essayTargetChars(`${label} ${hint}`);
  /* 데이터가 이긴다 — 사람이 원본을 보고 적어 둔 것이 규칙보다 낫다 */
  if (field && Array.isArray(field.ask) && field.ask.length) {
    return {
      kind: 'data', target, asks: field.ask,
      scene: storyAsksFor(essayKindOf(label, hint)),
      focus: foundationFocus(ctx && ctx.scholarship),
      blind: blindReview(ctx && ctx.scholarship),
    };
  }
  const kind = essayKindOf(label, hint);
  const base = ESSAY_ASKS[kind] || ESSAY_ASKS.generic;
  /* ctx 를 안 주면 예전과 똑같이 동작한다 — 검사 도구·감사가 그대로 쓴다 */
  return {
    kind, target,
    asks: ctx ? tailorAsks(base, ctx) : base,
    scene: storyAsksFor(kind),
    focus: foundationFocus(ctx && ctx.scholarship),
    blind: blindReview(ctx && ctx.scholarship),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { essayAskFor, essayKindOf, essayTargetChars, essayStage, tailorAsks,
    foundationFocus, blindReview, storyAsksFor,
    ESSAY_ASKS, ESSAY_KINDS, SCENE_ASKS, STORY_ASKS, FOCUS_THEMES,
    TRACK_SPEND, TRACK_PREP, DOC_SIGNAL };
}
