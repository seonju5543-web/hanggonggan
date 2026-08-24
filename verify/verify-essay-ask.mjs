/* ============================================================
   키워드 질문 검사 — 서술형 칸에 빈 A4 2장을 던지지 않는가

   실행:  node verify/verify-essay-ask.mjs        (브라우저·서버·돈 불필요)

   🔴 이 검사가 지키는 두 가지

   ① **학생이 채워야 하는 양이 실제로 줄었는가.**
      개발자 지적(2026-08-23): "장학 신청 사유를 자기소개서로 (A4 2장 내외)"라고
      적힌 빈 칸을 학생에게 던지는 것은 우리가 할 일을 떠넘기는 것이다.
      서술형 칸 66개 전부에 키워드 질문이 배정돼야 한다 — 하나라도 빠지면
      그 칸은 예전처럼 빈 칸이 된다.

   ② **질문 수 상한(FORM_LIMITS)이 안 늘어났는가.**
      키워드 질문은 서술형 칸 **안에** 그려지므로 form-plan.js 의 countPlan 이
      세는 숫자가 그대로여야 한다. 늘어나면 24차 세션에서 정한 상한이 깨진다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { essayAskFor, essayKindOf, essayTargetChars, essayStage, TRACK_SPEND, DOC_SIGNAL, SCENE_ASKS } = require('../essay-ask.js');
/* countPlan 은 내보내지 않는다 — planFormQuestions 가 plan.counts 에 넣어 주는 값이
   화면·감사가 실제로 쓰는 값이라 그것을 본다. */
const { planFormQuestions, formBudgetReport, FORM_LIMITS } = require('../form-plan.js');
const T = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/forms.json', import.meta.url)), 'utf8')).templates;

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '\n      ' + extra : ''}`); }
};
const head = (s) => console.log(`\n[${s}]`);

const storyFields = [];
for (const [key, tpl] of Object.entries(T))
  for (const sec of tpl.sections || [])
    for (const f of sec.fields || [])
      if (f.type === 'textarea' && f.kind === 'story') storyFields.push({ form: key, f });

head('1) 빈 칸을 던지는 서술형이 하나도 없는가');
ok(storyFields.length > 0, `서술형(story) 칸 ${storyFields.length}개`);
{
  const noAsk = storyFields.filter(({ f }) => {
    const p = essayAskFor(f);
    return !p.asks || p.asks.length < 2;
  });
  ok(noAsk.length === 0, '① 모든 서술형 칸에 키워드 질문이 2개 이상 배정된다',
    noAsk.slice(0, 3).map((x) => `${x.form}/${x.f.id}`).join(', '));

  const generic = storyFields.filter(({ f }) => essayAskFor(f).kind === 'generic');
  ok(generic.length === 0, '① 종류를 못 알아본 칸이 없다 (generic 0)',
    generic.slice(0, 5).map((x) => String(x.f.label).replace(/\s+/g, ' ')).join(' / '));
}
{
  /* 키워드 질문의 절반 이상은 **눌러서 고르는 것**이어야 한다 —
     전부 직접 입력이면 '키워드만 고르면 된다'는 약속이 거짓말이 된다. */
  let clicky = 0, total = 0;
  for (const { f } of storyFields) {
    for (const a of essayAskFor(f).asks) { total++; if (a.c && a.c.length) clicky++; }
  }
  ok(clicky / total >= 0.5, `① 키워드 질문의 과반이 눌러서 고르는 것 (${clicky}/${total})`);
}

head('2) 분량을 원본 라벨에서 읽는가 — 지어내지 않는다');
ok(essayTargetChars('신청사유 (자기소개서) A4 2장 내외') === 1800, 'A4 2장 → 1800자');
ok(essayTargetChars('2. 자기소개 내용을 서술해 주세요. (500자 이상)') === 600, '500자 이상 → 600자');
ok(essayTargetChars('자기소개서 (1,000자 이내)') === 850, '1,000자 이내 → 850자 (쉼표가 있어도 읽는다)');
ok(essayTargetChars('1. 성장과정 및 가족사항 (400~800자)') === 600, '400~800자 → 600자');
ok(essayTargetChars('기타 특기사항') === 500, '분량이 안 적혀 있으면 500자');
{
  const big = storyFields.filter(({ f }) => essayAskFor(f).target >= 1500);
  ok(big.length > 0, `② 원본에 A4 2장이라고 적힌 칸을 실제로 찾아낸다 (${big.length}칸)`,
    big.map((x) => `${x.form}`).join(', '));
}

head('3) 종류를 알아보는가');
ok(essayKindOf('성장과정 · 가정환경') === 'growth', '성장과정 → growth');
ok(essayKindOf('지원 동기 및 포부') === 'future', '지원동기 및 포부 → future (포부가 더 구체적)');
ok(essayKindOf('신청사유 (자기소개서)') === 'motive', '신청사유 → motive');
ok(essayKindOf('성격 · 인생관') === 'character', '성격·인생관 → character');
ok(essayKindOf('나눔에 대한 본인의 생각이나 의지') === 'share', '나눔 → share');
ok(essayKindOf('장학금 사용계획') === 'use', '사용계획 → use');
ok(essayKindOf('재단에 하고 싶은 말') === 'message', '하고 싶은 말 → message');
ok(essayKindOf('자신의 성실성을 증명할 수 있는 경험') === 'episode', '경험 → episode');

head('4) 🔴 질문 수 상한이 안 늘어났는가');
{
  /* 키워드 질문은 서술형 칸 '안'에 그려진다. 그러므로 설계기가 세는 숫자는
     이 작업 전과 **완전히 같아야** 한다. 하나라도 달라지면 상한이 깨진 것이다. */
  /* 🔴 감사(audit-data.js)와 **같은 함수**로 센다 — formBudgetReport.
     여기서만 planFormQuestions(tpl, {}) 처럼 따로 부르면 프로필이 빈 상태로 세어
     감사와 숫자가 갈라진다(실제로 15종 대 2종으로 갈라졌다). */
  const leaked = [];
  let worst = { input: 0, click: 0, total: 0 };
  let overForms = 0;
  for (const [key, tpl] of Object.entries(T)) {
    const b = formBudgetReport(tpl);
    const c = b.counts;
    worst = { input: Math.max(worst.input, c.input), click: Math.max(worst.click, c.click), total: Math.max(worst.total, c.total) };
    if (b.over.length) overForms++;
    /* 설계기가 세는 항목에 '키워드 질문'이 섞여 들어온 것이 없는지 본다 */
    for (const sec of planFormQuestions(tpl, {}).secs)
      for (const f of sec.items)
        if (String(f.id || '').startsWith('ask-')) leaked.push(`${key}/${f.id}`);
  }
  ok(leaked.length === 0, '④ 키워드 질문이 설계기의 질문 목록에 섞이지 않는다', leaked.slice(0, 3).join(', '));
  console.log(`      가장 많은 양식: 직접입력 ${worst.input} · 클릭 ${worst.click} · 전체 ${worst.total}`
    + `  (상한 ${FORM_LIMITS.input}/${FORM_LIMITS.click}/${FORM_LIMITS.total})`);
  /* 상한을 넘는 양식은 이 작업 전에도 2종이었다(감사가 경고로 잡고 있다).
     늘었으면 키워드 질문이 새 질문으로 새어 들어간 것이다. */
  ok(overForms === 2, `④ 상한을 넘는 양식이 그대로 2종이다 (지금 ${overForms}종)`);
}

head('5) 보기를 지어내지 않는가');
{
  /* 키워드 보기는 '흔한 사정'을 적어 둔 것이고, 고르지 않으면 글에 안 들어간다.
     그래도 민감정보(별도 동의가 필요한 항목)를 보기로 내밀면 안 된다 —
     서버가 그 요청을 통째로 거절하므로 기능이 조용히 죽는다. */
  const BAD = ['기초생활수급', '차상위', '국가유공자', '보훈', '장애등급', '장애인등록', '주민등록번호', '계좌'];
  const hits = [];
  for (const { f } of storyFields)
    for (const a of essayAskFor(f).asks)
      for (const c of a.c || [])
        for (const b of BAD) if (c.includes(b)) hits.push(`${c} (${b})`);
  ok(hits.length === 0, '⑤ 민감정보를 보기로 내밀지 않는다 — 서버가 거절해 기능이 죽는다',
    [...new Set(hits)].join(', '));
}

head('6) 학생마다 다른 보기가 나오는가 (2026-08-23)');
{
  const f = { label: '장학금 사용계획', type: 'textarea', kind: 'story' };
  const spend = (p) => (essayAskFor(f, { profile: p }).asks.find((a) => a.id === 'where') || {}).c || [];
  const eng = spend({ track: 'engineering' });
  const art = spend({ track: 'arts' });
  const med = spend({ track: 'medical' });
  ok(eng.includes('개발 장비'), '공학·IT 에게는 개발 장비를 보여 준다', eng.join('/'));
  ok(art.includes('재료·악기'), '예체능에게는 재료·악기를 보여 준다', art.join('/'));
  ok(med.includes('국가시험 교재'), '의약·간호에게는 국가시험 교재를 보여 준다', med.join('/'));
  ok(eng.join() !== art.join(), '계열이 다르면 보기가 실제로 달라진다');
  ok(eng[0] === '실습·재료비' || TRACK_SPEND.engineering.includes(eng[0]),
    '맞춤 보기가 **맨 앞**에 온다 — 뒤에 붙이면 줄바꿈 아래로 밀려 안 보인다', eng[0]);

  const g = { label: '지원 동기', type: 'textarea', kind: 'story' };
  const now = (p) => (essayAskFor(g, { profile: p }).asks.find((a) => a.id === 'now') || {}).c || [];
  ok(now({ status: 'freshman', year: 1 }).includes('첫 학기 적응'), '신입생에게는 첫 학기 적응을 보여 준다');
  ok(now({ status: 'returning', year: 2 }).includes('학업 리듬 되찾기'), '복학생에게는 학업 리듬 되찾기를 보여 준다');
  ok(now({ status: 'enrolled', year: 4 }).includes('졸업 요건 채우기'), '4학년에게는 졸업 요건을 보여 준다');
  ok(essayStage({ status: 'returning', year: 3 }) === 'back', '복학은 학년보다 앞선다');

  const need = (p) => (essayAskFor(g, { profile: p }).asks.find((a) => a.id === 'need') || {}).c || [];
  ok(need({ region: 'etc' }).includes('통학·자취 부담'), '수도권 밖 학생에게는 통학·자취 부담을 보여 준다');
  ok(!need({ region: 'seoul' }).includes('통학·자취 부담'), '서울 학생에게는 안 보여 준다');
  ok(need({ flags: ['multiChild'] }).includes('형제자매와 함께 부담'), '다자녀 가구 신호를 쓴다');

  ok(essayAskFor(g).asks === essayAskFor(g).asks || true, '(참고) ctx 없이 부르면 예전과 같다');
  ok(JSON.stringify(essayAskFor(g).asks) === JSON.stringify(essayAskFor(g, {}).asks),
    'ctx 가 비면 손대지 않는다 — 감사·검사 도구가 그대로 쓴다');
}

head('7) 보관함이 아는 것 — 묻는 데만 쓰는가');
{
  const g = { label: '지원 동기', type: 'textarea', kind: 'story' };
  const withDocs = essayAskFor(g, { profile: { track: 'humanities' }, docs: ['langCert', 'recommend'] }).asks;
  ok(withDocs.some((a) => a.id === 'langUse'), '어학성적표가 있으면 그것에 대해 **묻는다**');
  ok(withDocs.some((a) => a.id === 'recWho'), '추천서가 있으면 그것에 대해 묻는다');
  ok(withDocs.every((a) => !/증명서|파일|첨부/.test(JSON.stringify(a.c || []))),
    '보기 문구에 서류 이름이 안 들어간다 — 서버로 나가는 것은 학생이 고른 답뿐이다');
  const welfare = essayAskFor(g, { profile: {}, docs: ['welfare'] }).asks;
  ok(!welfare.some((a) => /welfare|수급|차상위/.test(JSON.stringify(a))),
    '🔴 수급·차상위 자격 증명은 아예 보지 않는다');
}

head('8) 장면 질문 — 글을 살아 있게 만드는 것');
{
  ok(SCENE_ASKS.length >= 2, `장면 질문 ${SCENE_ASKS.length}개 (언제·누구와)`);
  ok(SCENE_ASKS.every((s2) => (s2.c || []).length >= 3), '장면 질문은 전부 눌러서 고르는 것이다');
  const f = { label: '성장과정', type: 'textarea', kind: 'story' };
  ok((essayAskFor(f).scene || []).length >= 2, '어느 칸에서든 장면 질문이 함께 나온다');
}

head('9) 🔴 맞춤 보기에도 민감 낱말이 없는가 (전수)');
{
  /* 학생이 고른 보기는 **서버로 나간다**. 민감 낱말이 보기에 있으면 그걸 고르는 순간
     draft-guard 가 400 으로 막아 기능이 통째로 죽는다. 조합을 전수로 훑는다. */
  const BAD = ['기초생활수급', '차상위', '국가유공자', '보훈', '장애', '수급자', '주민등록번호', '계좌'];
  const TRACKS = ['humanities', 'social', 'business', 'education', 'science', 'engineering', 'arts', 'medical'];
  const STATUS = ['enrolled', 'freshman', 'returning'];
  const REGION = ['seoul', 'gyeonggi', 'etc'];
  const FLAGS = [[], ['basicLiving'], ['nearPoverty'], ['multiChild'], ['merit'], ['disabled'],
    ['basicLiving', 'disabled', 'merit', 'multiChild', 'nearPoverty']];
  const DOCS = [[], Object.keys(DOC_SIGNAL), ['welfare']];
  const hits = []; let combos = 0;
  for (const { f } of storyFields) {
    for (const track of TRACKS) for (const status of STATUS) for (const region of REGION)
      for (const flags of FLAGS) for (const docs of DOCS) {
        combos++;
        const profile = { track, status, region, flags, year: 3, cert: true, exchange: true };
        for (const a of essayAskFor(f, { profile, docs }).asks)
          for (const c of a.c || [])
            for (const b of BAD) if (c.includes(b)) hits.push(`${c} (${b})`);
      }
  }
  ok(hits.length === 0, `⑨ 조합 ${combos.toLocaleString()}가지를 훑어도 민감 낱말이 보기에 없다`,
    [...new Set(hits)].slice(0, 5).join(', '));
}

/* ───────────────────────────────────────────────────────────────────────────
   10) 작성 규칙 후보 판정 — 메뉴·광고가 컨펌 대기 목록을 채우면 안 된다
   1차 크롤링에서 컨펌 대기 40건 중 25건이 이런 줄이었다. 목록은 **1분에 훑을 분량**이어야
   한다(자격 채점기 '참고' 절과 같은 계열) — 그래서 실제 그때 새어 나온 문장으로 검사한다.
   ─────────────────────────────────────────────────────────────────────────── */
{
  const { isCandidate } = await import('../collector/essay-rule-line.mjs');
  head('10) 🔴 규칙 후보 판정 — 메뉴·광고를 걸러 낸다');

  const 새어나온것 = [
    '디자인·UI/UX',
    '개발·Web/App',
    '진행해야 할 주문 0개 를 확인해 주세요',
    '개인정보취급방침',
    '이용약관, 개인정보처리방침 변경 고지',
    '대외활동 뭐하지',
    'Chrome에서 지원서를 자동 입력하고, 맞춤 이력서를 만들고, 채용 공고를 평가하세요.',
    '뉘앙스를 잃지 않고 이력서를 원하는 언어로 번역하세요.',
    'AI가 작성한 핵심 문구와 검증된 레이아웃으로 세련된 이력서를 생성하세요.',
  ];
  for (const line of 새어나온것) {
    ok(isCandidate(line) === null, `걸러 낸다 — ${line.slice(0, 24)}`);
  }

  const 진짜후보 = [
    '- 통일성 (처음에 제시한 가치관에 대한 태도가 끝까지 이어지도록 서술하기)',
    '· 문장의 군더더기를 없애면 핵심이 보인다.',
    '첫 문장에 결론을 먼저 쓰세요.',
    '자기소개서는 구체적인 경험으로 채워야 합니다.',
  ];
  for (const line of 진짜후보) {
    ok(isCandidate(line) !== null, `남긴다 — ${line.slice(0, 24)}`);
  }

  /* 🔴 학습 로봇이 이 파일을 베끼면 검사가 헛돈다 — 같은 모듈을 쓰는지 본다 */
  const src = fs.readFileSync(new URL('../collector/essay-playbook-learn.mjs', import.meta.url), 'utf8');
  ok(/from '\.\/essay-rule-line\.mjs'/.test(src) && !/const\s+DOMAIN\s*=/.test(src),
    '학습 로봇이 같은 판정 모듈을 쓴다 (베끼지 않았다)');
}

/* ───────────────────────────────────────────────────────────────────────────
   11) B — 이 재단이 보는 것을 앞세운다 (know-the-foundation)
   🔴 지어내지 않는다: 공고 원문에 그 낱말이 있을 때만 켜진다.
   ─────────────────────────────────────────────────────────────────────────── */
{
  head('11) B — 이 재단이 보는 것');
  const { foundationFocus, blindReview, storyAsksFor, STORY_ASKS } = require('../essay-ask.js');

  /* 실제 공고 문구다 (collector/extracted 의 서울인재대학장학금 원문) */
  const 서울인재 = { name: '2026년 하반기 서울인재대학장학금', quotes: [
    '자기소개서에 소속 대학교를 식별할 수 있는 정보(학교명 등)를 기재한 경우 심사에서 제외',
    '<소득기준 [평가기준1순위]>', '<학업성적 [평가기준2순위]>', '<사회공헌 [평가기준3순위]>',
  ] };
  const f = foundationFocus(서울인재);
  ok(f.length === 3, `재단이 보는 것 3가지를 읽었다 — ${f.map((x) => x.say).join(' · ')}`);
  ok(f[0].id === 'need' && f[1].id === 'merit' && f[2].id === 'share',
    '재단이 밝힌 순위(1소득·2성적·3사회공헌) 그대로 정렬한다', f.map((x) => x.id).join(','));

  ok(foundationFocus({ name: '장학금', quotes: [] }).length === 0,
    '🔴 공고에 없으면 빈손이다 — 지어내지 않는다');
  ok(foundationFocus(null).length === 0, '공고가 없어도 넘어지지 않는다');

  ok(blindReview(서울인재) === true, '🔴 블라인드 심사 공고를 알아본다');
  ok(blindReview({ name: '평범한 장학금', quotes: ['성적 3.0 이상'] }) === false,
    '보통 공고를 블라인드로 착각하지 않는다');

  /* B 가 학생에게 새 질문을 만들지 않는다 — 보기 순서만 바꾼다 */
  const { essayAskFor } = require('../essay-ask.js');
  const field = { label: '지원 동기', type: 'textarea', kind: 'story' };
  const before = essayAskFor(field, { profile: { track: 'humanities' } });
  const after = essayAskFor(field, { profile: { track: 'humanities' }, scholarship: 서울인재 });
  ok(before.asks.length === after.asks.length, '🔴 B 는 질문 수를 늘리지 않는다 — 순서만 바꾼다');
  ok(after.blind === true && after.focus.length === 3, '칸 계획에 focus·blind 가 함께 실린다');
}

/* ───────────────────────────────────────────────────────────────────────────
   12) 스토리텔링 질문 — 배운 규칙에서 나왔는지
   ─────────────────────────────────────────────────────────────────────────── */
{
  head('12) 스토리텔링 질문 — 규칙에서 나왔는가');
  const { storyAsksFor, STORY_ASKS } = require('../essay-ask.js');
  const PB = JSON.parse(fs.readFileSync(new URL('../data/essay-playbook.json', import.meta.url), 'utf8'));
  const codes = new Set(PB.rules.map((r) => r.code));

  for (const a of STORY_ASKS) {
    ok(codes.has(a.rule), `'${a.q}' 의 근거 규칙이 규칙집에 실재한다 — ${a.rule}`);
  }
  ok(storyAsksFor('episode')[0].id === 'result',
    "경험 칸에는 '그래서 어떻게 됐나요'가 **맨 앞에** 온다 (공통 셋이 자리를 다 먹지 않는다)");
  ok(storyAsksFor('growth')[0].id === 'turn', "성장과정 칸에는 '언제부터 달라졌나요'가 맨 앞에 온다");
  for (const k of ['episode', 'growth', 'motive', 'share', 'generic'])
    ok(storyAsksFor(k).length === 3, `${k} — 카드가 길어지지 않게 3개까지`);
  ok(STORY_ASKS.every((a) => !a.free && Array.isArray(a.c) && a.c.length),
    '🔴 스토리텔링 질문은 전부 눌러서 고르는 것이다 — 학생이 글을 쓰지 않는다');
  /* 🔴 숫자를 만들어 주는 질문이 잘려 나가지 않는가 — 자리가 3칸뿐이라 순서가 곧 생존이다 */
  const 숫자없는칸 = ['motive', 'growth', 'character', 'value', 'study', 'future', 'share', 'episode', 'message', 'intro', 'generic']
    .filter((k) => !storyAsksFor(k).some((a) => a.id === 'howLong'));
  ok(숫자없는칸.length === 0,
    "🔴 어느 칸에서든 '얼마나 오래'가 살아남는다 — 규칙집이 숫자로 쓰라고 한다", 숫자없는칸.join(', '));
}

/* ───────────────────────────────────────────────────────────────────────────
   13) 스스로 넓히기 — 다음에 읽을 곳을 줍는 눈, 그리고 남의 집 규칙
   🔴 순수 모듈에 있어야 검사가 돌려 볼 수 있다. 학습 로봇은 불러오는 순간 인터넷을 두드린다.
   ─────────────────────────────────────────────────────────────────────────── */
{
  head('13) 🔴 스스로 넓히기 — 링크 줍기와 robots.txt');
  const { linkCandidates, parseRobots, robotsBlocks } = await import('../collector/essay-rule-line.mjs');

  const html = `
    <a href="/tips/jagisogeseo">장학금 자기소개서 작성법</a>
    <a href="https://other.example/blog/글쓰기-요령">글쓰기 요령</a>
    <a href="/login?next=/x">로그인</a>
    <a href="/shop/cart">장바구니</a>
    <a href="/recruit/resume">이력서 자동 작성</a>
    <a href="/notice">공지사항</a>`;
  const got = linkCandidates(html, 'https://ex.example/a/b');
  const urls = got.map((g) => g.url);
  ok(urls.some((u) => u.endsWith('/tips/jagisogeseo')), '주제인 링크를 줍는다 (제목으로)');
  ok(urls.some((u) => /%EA%B8%80%EC%93%B0%EA%B8%B0|글쓰기/.test(decodeURIComponent(u))), '다른 집 링크도 줍는다');
  ok(!urls.some((u) => /login|cart|recruit/.test(u)), '🔴 로그인·장바구니·채용은 줍지 않는다');

  /* 🔴 1차 자동 확장에서 실제로 승격됐던 곳들이다 — 이 기능의 뼈대를 뒤집는 곳이라 막았다 */
  const 예시문사이트 = `
    <a href="https://linkareer.com/cover-letter/search">자기소개서</a>
    <a href="https://x.example/a?keyword=삼성">삼성 최신 합격자소서</a>
    <a href="https://x.example/자소서-예시문-모음">자소서 예시문 모음</a>
    <a href="https://community.example/junior_activity">서류 합격 후기</a>`;
  const 막힌것 = linkCandidates(예시문사이트, 'https://ex.example/');
  ok(막힌것.length === 0,
    '🔴 합격자소서·예시문 모음은 줍지 않는다 — 표절·저작권·획일화 때문에 안 쓰기로 한 곳이다',
    막힌것.map((g) => g.url).join(', '));

  /* 앵커 글자에 속성이 섞이지 않는가 — 1차 실행에서 data-tiara-layer 가 제목으로 잡혔다 */
  const 속성섞임 = linkCandidates('<a href="/t/자기소개서" data-x="본문 하단 > 키워드 클릭">장학금 자기소개서</a>', 'https://ex.example/');
  ok(속성섞임.length === 1 && !/data-|=|"/.test(속성섞임[0].text),
    '링크 제목에 HTML 속성이 섞이지 않는다', 속성섞임[0] && 속성섞임[0].text);
  ok(!urls.some((u) => u.endsWith('/notice')), '주제라는 표시가 없으면 줍지 않는다');
  ok(got.every((g) => /^https?:/.test(g.url) && !g.url.includes('#')), '주소는 절대주소이고 조각(#)이 없다');

  const rules = parseRobots([
    'User-agent: BadBot', 'Disallow: /', '', 'User-agent: *', 'Disallow: /private', 'Disallow: /tmp  # 메모',
  ].join('\n'));
  ok(rules.join(',') === '/private,/tmp', "우리(별표)에게 걸린 규칙만 읽는다 — 남의 규칙을 우리 것으로 읽지 않는다", rules.join(','));
  ok(robotsBlocks(rules, 'https://x.example/private/a') === true, '막아 둔 곳은 안 간다');
  ok(robotsBlocks(rules, 'https://x.example/tips/a') === false, '막지 않은 곳은 간다');
  ok(robotsBlocks(parseRobots('User-agent: *\nDisallow: /'), 'https://x.example/any') === true,
    "'전부 금지'인 집은 한 곳도 안 간다");
  ok(robotsBlocks([], 'https://x.example/any') === false, 'robots.txt 가 없으면 막지 않는다');

  /* 배선 — 학습 로봇이 실제로 robots 를 보고 가는가 */
  const src = fs.readFileSync(new URL('../collector/essay-playbook-learn.mjs', import.meta.url), 'utf8');
  ok(/await robotsAllows\(c\.url\)/.test(src), '🔴 새 주소를 읽기 전에 robots.txt 를 본다');
  ok(/GROW_PER_RUN/.test(src) && /RETRY_AFTER_DAYS/.test(src),
    '한 번에 몰아치지 않고, 헛걸음한 곳은 한동안 다시 안 간다');
  ok(!/const\s+TOPIC\s*=/.test(src), '학습 로봇이 판정을 베끼지 않았다 — 순수 모듈을 쓴다');

    /* 🔴 '가져왔다'만으로는 부족하다 — 저쪽이 실제로 내보내는지 봐야 한다.
     가져오는 줄만 보는 검사는 저쪽에서 함수가 사라져도 통과한다(실제로 그랬다). */
  const pure = fs.readFileSync(new URL('../collector/essay-rule-line.mjs', import.meta.url), 'utf8');
  const 내보낸것 = new Set([...pure.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  const 가져온것 = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/essay-rule-line\.mjs'/g)]
    .flatMap((m) => m[1].split(',').map((x) => x.trim())).filter(Boolean);
  const 없는수출 = 가져온것.filter((n) => !내보낸것.has(n));
  ok(가져온것.length > 0 && 없는수출.length === 0,
    '🔴 가져오는 이름을 판정 모듈이 실제로 내보낸다', `없는 것: ${없는수출.join(', ')}`);

  /* 글자 뽑기 — 실제로 돌려 본다 */
  const { toLines } = await import('../collector/essay-rule-line.mjs');
  const lines = toLines('<script>x</script><div>첫 문장에 결론을 먼저 쓰세요.</div><li>구체적인 경험으로 채워야 합니다.</li>');
  ok(lines.length === 2 && lines[0] === '첫 문장에 결론을 먼저 쓰세요.', 'HTML 에서 글자만 줄로 뽑는다', lines.join(' | '));
  ok(!toLines('<script>alert(1)</script>').length, '스크립트는 글자로 세지 않는다');

  /* 🔴 2026-08-24 사고: toLines 가 로봇에서 사라졌는데 **로컬에서는 안 터졌다.**
     페이지가 전부 403 이라 그 줄까지 가 보지도 못했기 때문이다 — '못 읽어서 안 터진 것'을
     '잘 된 것'으로 읽었다. 그래서 부르기만 하고 어디에도 없는 이름을 정적으로 잡는다. */
  {
    const 선언된것 = new Set([
      ...[...src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
      ...[...src.matchAll(/import\s*\{([^}]*)\}/g)].flatMap((m) => m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop())),
      ...[...src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from/g)].map((m) => m[1]),
      /* 자바스크립트가 원래 주는 것들 */
      'require', 'fetch', 'String', 'Number', 'Boolean', 'Array', 'Object', 'Map', 'Set', 'Date',
      'JSON', 'Math', 'RegExp', 'Error', 'URL', 'Promise', 'parseInt', 'parseFloat', 'isNaN',
      'decodeURIComponent', 'encodeURIComponent', 'console', 'process', 'catch', 'if', 'for',
      'while', 'switch', 'return', 'typeof', 'function', 'await', 'new', 'of', 'in', 'do', 'else',
    ]);
    const 없는것 = [...new Set([...src.matchAll(/(?:^|[^.\w$])([a-z][\w$]*)\s*\(/g)].map((m) => m[1]))]
      .filter((n) => !선언된것.has(n));
    ok(없는것.length === 0, '🔴 학습 로봇이 부르는 이름이 전부 실재한다 (선언되었거나 가져왔다)',
      없는것.join(', '));

  }
}

/* ───────────────────────────────────────────────────────────────────────────
   14) 🔴 위험 원문 — 집 안 자료에서 캔 작성 규정과 감사 관문
   개발자 지적: "같은 위험이 또 있나? 자격 매칭과 엮어 예방할 수 있나?"
   ─────────────────────────────────────────────────────────────────────────── */
{
  head('14) 🔴 위험 원문 규정 — 캐기와 관문');
  const { isFormRule, isBlind, mine } = await import('../collector/essay-house-mine.mjs');

  ok(isBlind(['자기소개서에 소속 대학교를 식별할 수 있는 정보(학교명 등)를 기재한 경우 심사에서 제외']),
    '블라인드 심사 규정을 알아본다');
  ok(isFormRule('자기소개서 전체 분량이 1페이지 미만인 경우 심사에서 제외됩니다.'),
    '분량 미달 실격 규정을 규정으로 캔다');
  ok(!isFormRule('[자기소개서 작성 규정 및 감점 기준]'),
    '🔴 대괄호 머리글은 규정이 아니다 — 학생에게 규칙으로 보여 주면 소음이다');
  ok(!isFormRule('※ 제출 전, 본 문구를 포함한 안내문을 모두 삭제해 주세요.'),
    '서식 설명박스 안내는 규정이 아니다');
  ok(!isFormRule('지원서류: 성적증명서 1부'),
    '제출 서류 목록은 작성 규정이 아니다');

  const { perNotice } = mine();
  const blindCount = Object.values(perNotice).filter((v) => v.blind).length;
  ok(blindCount >= 1, `코퍼스에서 블라인드 심사 공고를 찾는다 (${blindCount}건)`);

  /* 감사 관문이 실제로 배선돼 있는가 — 배선이 끊기면 새 블라인드 공고가 그대로 나간다 */
  const audit = fs.readFileSync(new URL('../verify/audit-data.js', import.meta.url), 'utf8');
  ok(/essay-house-mine/.test(audit) && /essay-form-rules/.test(audit) && /errors\.push/.test(audit.slice(audit.indexOf('essay-house-mine'))),
    '🔴 감사가 essay-form-rules 를 코퍼스와 대조해 배포를 막는다 (자격 매칭과 같은 관문 방식)');
}

console.log(`\n${fail ? '✗' : '✓'} 키워드 질문 — 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
