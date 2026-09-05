/* ============================================================
   AI 초안 안전장치 검사 — 잔액 없이도 여기까지 전부 증명된다

   실행:  node verify/verify-essay-guard.mjs

   왜 이 검사가 있나
     이 저장소의 다른 AI 경로와 달리 초안 서버는 **AI가 진짜 문장을 쓴다.**
     그래서 "지어냄이 정말 막히는가"를 말이 아니라 **돌려서** 보여야 한다.
     자격 AI가 ELIG_AI_FAKE 로 한 것과 같은 방식이다 — 가짜 응답을 주고
     **모델이 일부러 나쁘게 굴게** 한 뒤, 그 결과가 걸러지는지 본다.

   무엇을 증명하는가 (개발자가 요구한 4가지)
     ① 없는 수상·봉사시간을 넣으면 걸러지는가
     ② 앱이 모르는 숫자·날짜가 들어가면 걸러지는가
     ③ 정보입력형(fact) 칸에는 아예 안 가는가
     ④ 민감정보가 요청 본문에 안 섞이는가 — 실제 요청 본문을 **전수 검사**한다

   진짜 worker.js 를 불러서 돌린다. 베낀 사본을 검사하면 아무것도 증명 못 한다.
   ============================================================ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanOutgoing, checkDraft, mayDraft, materialText, qualityCheck, rulesFor } from '../server/essay/draft-guard.mjs';
import PLAYBOOK from '../data/essay-playbook.json' with { type: 'json' };
import { VOCAB, matchRule, decodeEntities, linkCandidates, NOT_SOURCE } from '../collector/essay-rule-line.mjs';
import ASK from '../essay-ask.js';
import worker from '../server/essay/worker.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? '\n      ' + extra : ''}`); }
};
const head = (s) => console.log(`\n[${s}]`);

const ORIGIN = 'https://seonju5543-web.github.io';
const ENV = { ANTHROPIC_API_KEY: 'test-key-not-real' };

/* ── 가짜 Claude API ──
   호출된 본문을 전부 모아 둔다(④ 전수 검사용). reply 에 모델이 뭐라 답할지 심는다. */
const calls = [];
let reply = { drafts: [] };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: JSON.parse(init.body) });
  return new Response(JSON.stringify({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(reply) }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};

const post = (payload) => worker.fetch(
  new Request('https://x/', { method: 'POST', headers: { Origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
  ENV,
);

/* 정상적인 요청 하나 — 학생이 준 재료가 분명하다 */
const basePayload = () => ({
  scholarship: {
    name: '가송재단 장학금', provider: '가송재단', amountText: '학기당 200만원',
    quotes: ['가정형편이 어려운 학생을 우선 선발한다.'],
  },
  profile: { school: '한국외국어대학교', year: '3학년', major: '소프트웨어학과' },
  materials: [
    { label: '왜 필요한가', value: '등록금이 부담돼서' },
    { label: '봉사', value: '지역아동센터에서 120시간 봉사했습니다' },
  ],
  fields: [{
    key: 'growth', kind: 'story', label: '성장과정 · 가정환경', hint: '성장과정과 가정환경',
    target: 600, answer: '',
    /* 학생이 고른 키워드 — 이 서비스의 재료 본체다 */
    asks: [
      { q: '어떤 가정에서 자랐나요', a: '맞벌이 가정' },
      { q: '그 시간에서 배운 것', a: '성실함, 아끼는 습관' },
    ],
  }],
});

/* ─────────────────────────────────────────────────────────── */
head('1) 규칙 — 재료에 없는 사실을 잡는가');

const MAT = '등록금이 부담돼서\n지역아동센터에서 120시간 봉사했습니다\n가송재단 가정형편이 어려운 학생을 우선 선발한다.';

ok(checkDraft('저는 지역아동센터에서 120시간 동안 봉사했습니다.', MAT).ok,
  '재료에 있는 숫자(120시간)는 통과한다');
ok(!checkDraft('저는 300시간의 봉사활동을 해 왔습니다.', MAT).ok,
  '① 재료에 없는 봉사시간(300시간)은 걸린다');
ok(!checkDraft('2023년 교내 공모전에서 우수상을 받았습니다.', MAT).ok,
  '① 없는 수상(우수상)은 걸린다');
ok(!checkDraft('토익 900점을 취득하였습니다.', MAT).ok,
  '① 없는 자격증·점수(토익 900점)는 걸린다');
ok(!checkDraft('저는 2019년에 입학하여', MAT).ok,
  '② 앱이 모르는 연도(2019년)는 걸린다');
ok(!checkDraft('한마음재단의 지원을 받은 경험이 있습니다.', MAT).ok,
  '② 재료에 없는 기관(한마음재단)은 걸린다');
ok(checkDraft('가계 사정으로 등록금 마련이 어려워 학업에 전념하기 힘든 상황입니다.', MAT).ok,
  '재료를 문장으로 엮은 것은 통과한다 — 이것이 허용하려는 바로 그 일이다');
ok(checkDraft('[봉사 기관명]에서 꾸준히 활동해 왔습니다.', MAT).ok,
  '모르는 자리를 [ ]로 비워 두면 통과한다 — 비우는 것은 실패가 아니다');
ok(!checkDraft('', MAT).ok, '빈 초안은 통과하지 못한다');

head('2) 규칙 — 어느 칸에 붙일 수 있는가');
ok(mayDraft({ kind: 'story' }), 'story 칸에는 붙는다');
ok(!mayDraft({ kind: 'fact' }), '③ fact 칸에는 안 붙는다');
ok(!mayDraft({}), '③ kind 가 없으면 fact 로 본다 — 애매할 때 안 건드리는 쪽');
ok(!mayDraft(null), '③ 칸 자체가 없으면 안 붙는다');

head('3) 규칙 — 민감정보를 잡는가');
ok(scanOutgoing(basePayload()).ok, '정상 요청은 통과한다');
ok(!scanOutgoing({ a: '010203-3456789' }).ok, '주민등록번호 꼴을 잡는다');
ok(!scanOutgoing({ a: '110-234-567890' }).ok, '계좌번호 꼴을 잡는다');
ok(!scanOutgoing({ a: '저는 기초생활수급자입니다' }).ok, '민감 낱말(기초생활수급)을 잡는다');
ok(!scanOutgoing({ a: '국가유공자 자녀입니다' }).ok, '민감 낱말(국가유공자)을 잡는다');
ok(!scanOutgoing({ profile: { disabled: true } }).ok, "민감 항목 키('disabled')를 잡는다");
ok(!scanOutgoing({ profile: { basicLiving: false } }).ok, '값이 false 여도 키가 있으면 잡는다');

/* ─────────────────────────────────────────────────────────── */
head('4) 진짜 서버 — 사실 나열형 칸에는 부르지도 않는가');
calls.length = 0;
{
  const p = basePayload();
  p.fields = [{ key: 'volunteer', kind: 'fact', label: '봉사기관 · 봉사일자 · 봉사시간', hint: '', answer: '' }];
  const r = await post(p);
  const j = await r.json();
  ok(calls.length === 0, '③ fact 칸만 있으면 API를 아예 부르지 않는다 (돈 0)', `호출 ${calls.length}회`);
  ok(j.drafts.length === 0 && j.skipped.some((s) => s.key === 'volunteer'),
    '③ 왜 안 썼는지 이유를 돌려준다 — 조용히 넘어가지 않는다');
}

head('5) 진짜 서버 — 민감정보가 섞이면 부르지 않는가');
calls.length = 0;
{
  const p = basePayload();
  p.materials.push({ label: '사정', value: '저희 집은 기초생활수급 가정입니다' });
  const r = await post(p);
  const j = await r.json();
  ok(r.status === 400 && j.error === 'sensitive', '④ 민감정보가 있으면 400으로 막는다');
  ok(calls.length === 0, '④ 그때 API는 부르지 않는다 (돈 0)', `호출 ${calls.length}회`);
  ok((j.hits || []).length > 0, '④ 무엇이 걸렸는지 알려 준다');
}

head('6) 진짜 서버 — 모델이 일부러 나쁘게 굴 때');
calls.length = 0;
reply = { drafts: [{ key: 'growth', text: '저는 2018년 전국대학생봉사대회에서 최우수상을 받았고 500시간을 봉사했습니다.' }] };
{
  const r = await post(basePayload());
  const j = await r.json();
  ok(j.drafts.length === 0, '①② 없는 수상·시간·연도가 든 초안은 버려진다');
  ok(j.skipped.some((s) => s.key === 'growth'), '버린 이유를 남긴다');
  const why = (j.skipped.find((s) => s.key === 'growth') || {}).reasons || [];
  ok(why.length >= 2, '걸린 사유를 하나로 뭉뚱그리지 않는다', why.join(' / '));
}

head('7) 진짜 서버 — 모델이 안 물어본 칸을 답할 때');
reply = { drafts: [{ key: '없는칸', text: '아무 말' }, { key: 'growth', text: '가계 사정으로 등록금 마련이 어렵습니다.' }] };
{
  const j = await (await post(basePayload())).json();
  ok(j.drafts.length === 1 && j.drafts[0].key === 'growth', '안 물어본 칸은 버린다');
}

head('8) 진짜 서버 — 정상일 때는 초안이 나온다');
reply = { drafts: [{ key: 'growth', text: '가계 사정으로 등록금 마련이 어려워 학업에 전념하기 어려운 상황입니다. 지역아동센터에서 120시간 봉사하며 배운 것을 이어 가고 싶습니다.' }] };
{
  const j = await (await post(basePayload())).json();
  ok(j.drafts.length === 1, '재료로 엮은 초안은 통과한다');
  ok(!j.drafts[0].text.includes('최우수상'), '통과한 초안에 지어낸 사실이 없다');
}

head('9) 진짜 서버 — 실패해도 학생 원문을 덮지 않는가');
reply = { drafts: [] };
{
  const p = basePayload();
  p.fields[0].answer = '제가 직접 쓴 문장입니다';
  const j = await (await post(p)).json();
  ok(j.drafts.length === 0 && j.skipped.some((s) => s.key === 'growth'),
    '초안을 못 받으면 빈 초안을 주지 않는다 — 앱이 학생 원문을 그대로 둔다');
}

/* ─────────────────────────────────────────────────────────── */
head('10) 전수 — 등록된 fact 칸 36개 어디에도 AI가 닿지 않는가');
{
  const T = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../data/forms.json', import.meta.url)), 'utf8')).templates;
  const factFields = [];
  for (const [key, tpl] of Object.entries(T))
    for (const sec of tpl.sections || [])
      for (const f of sec.fields || [])
        if (f.type === 'textarea' && f.kind !== 'story') factFields.push({ form: key, f });

  ok(factFields.length > 0, `검사할 fact 칸이 있다 (${factFields.length}개)`);
  calls.length = 0;
  let leaked = [];
  for (const { form, f } of factFields) {
    const p = basePayload();
    p.fields = [{ key: f.id, kind: f.kind, label: f.label, hint: f.q || '', answer: '' }];
    const j = await (await post(p)).json();
    if (j.drafts.length) leaked.push(`${form} / ${f.id}`);
  }
  ok(calls.length === 0, `③ fact 칸 ${factFields.length}개 전수 — API 호출 0회`, `호출 ${calls.length}회`);
  ok(leaked.length === 0, '③ 어느 fact 칸에도 초안이 나가지 않는다', leaked.slice(0, 3).join(', '));
}

head('11) 전수 — 실제로 나간 요청 본문에 민감정보가 없는가');
calls.length = 0;
reply = { drafts: [{ key: 'growth', text: '가계 사정으로 등록금 마련이 어렵습니다.' }] };
{
  /* story 칸을 여럿 태워 실제 호출을 여러 번 일으킨 뒤, 나간 본문 전부를 훑는다 */
  for (const answer of ['등록금이 부담돼서', '아버지가 편찮으셔서', '혼자 생활비를 벌고 있어서']) {
    const p = basePayload();
    p.fields[0].answer = answer;
    await post(p);
  }
  ok(calls.length === 3, `요청이 실제로 나갔다 (${calls.length}회)`);
  const bad = [];
  for (const c of calls) {
    const text = JSON.stringify(c.body);
    for (const w of ['주민등록번호', '기초생활수급', '국가유공자', '계좌', 'disabled', 'basicLiving', 'merit', 'gpa', 'bracket', 'income'])
      if (text.includes(w)) bad.push(w);
    if (/\d{6}\s*-\s*[1-4]\d{6}/.test(text)) bad.push('주민번호 꼴');
  }
  ok(bad.length === 0, '④ 나간 본문 전수에 민감정보가 하나도 없다', [...new Set(bad)].join(', '));
  ok(calls.every((c) => c.url === 'https://api.anthropic.com/v1/messages'),
    '④ Anthropic 말고 다른 데로는 아무것도 안 보낸다');
  ok(calls.every((c) => !JSON.stringify(c.body).includes('fallbacks')),
    "`fallbacks` 를 붙이지 않는다 — sonnet-5 는 이 값에서 400이 난다 (2026-08-23 실측)");
}

head('12) 재료 모으기 — 검사와 프롬프트가 같은 글을 보는가');
{
  const m = materialText(basePayload());
  ok(m.includes('120시간') && m.includes('등록금이 부담돼서') && m.includes('가정형편'),
    '학생 재료와 공고 발췌가 모두 재료에 들어간다');
  /* 🔴 이 한 줄이 빠지면 기능이 통째로 죽는다 — 검사기가 키워드로 쓴 멀쩡한 글을
     전부 '지어냄'으로 보고 버린다 (2026-08-23 실제로 그럴 뻔했다). */
  ok(m.includes('맞벌이 가정') && m.includes('아끼는 습관'),
    '🔴 학생이 고른 키워드가 재료에 들어간다 — 빠지면 초안이 전부 버려진다');
  ok(checkDraft('저는 맞벌이 가정에서 자라며 아끼는 습관을 익혔습니다.', m).ok,
    '키워드로 쓴 글이 검사를 통과한다');
  ok(!m.includes('test-key'), '열쇠는 재료에 섞이지 않는다');
}

/* ─────────────────────────────────────────────────────────── */
head('13) 앱 쪽 (essay.js) — 무엇을 재료로 모으는가');
{
  const vm = await import('node:vm');
  const src = fs.readFileSync(fileURLToPath(new URL('../essay.js', import.meta.url)), 'utf8');

  /* 화면을 흉내 낸다 — 학생이 여러 칸에 글을 쳐 넣은 상태 */
  const values = {
    'fq-growth': '아버지가 편찮으셔서 제가 생활비를 보태고 있습니다',   // 서술형(story)
    'fq-vol': '지역아동센터 120시간',                                  // 서술형(fact) — 좋은 재료다
    'fq-name': '홍길동',                                              // 짧은 입력 + auto 키 → 나가면 안 된다
    'fq-account': '110-234-567890',                                   // 짧은 입력 + auto 키 → 나가면 안 된다
    'fq-club': '코딩 동아리 회장',                                    // 짧은 입력, auto 키 없음 → 재료
  };
  const fakeDoc = {
    getElementById: (id) => (values[id] != null ? { value: values[id] } : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  };
  const plan = { secs: [{ items: [
    { id: 'growth', type: 'textarea', kind: 'story', label: '성장과정', q: '성장과정' },
    { id: 'vol', type: 'textarea', kind: 'fact', label: '봉사내역', q: '' },
    { id: 'name', type: 'text', label: '성명' },
    { id: 'account', type: 'text', label: '계좌번호' },
    { id: 'club', type: 'text', label: '교외 활동' },
  ] }] };

  const ctx = {
    console, document: fakeDoc,
    ESSAY_CONFIG: { endpoint: 'https://x.workers.dev', label: 'AI 초안 만들기' },
    state: { profile: { school: '한국외국어대학교', year: 3, major: '소프트웨어학과', name: '홍길동', gpa: 4.1, bracket: 4 } },
    esc: (s) => String(s == null ? '' : s),
    formPlanFor: () => plan,
    /* 진짜 form-plan.js 와 같은 판정: 프로필로 채울 수 있는 자리에는 auto 키가 있다 */
    formAutoKey: (f) => ({ name: 'name', account: 'account' }[f.id] || ''),
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);

  const story = ctx.essayStoryFields(plan);
  ok(story.length === 1 && story[0].id === 'growth',
    '③ story 칸만 고른다 — fact 서술형(봉사내역)은 안 고른다');

  const mats = ctx.essayMaterials(plan);
  const ids = mats.map((m) => m.id);
  ok(!ids.includes('name'), '④ 이름은 재료에 안 들어간다');
  ok(!ids.includes('account'), '④ 계좌번호는 재료에 안 들어간다');
  ok(ids.includes('vol'), '학생이 쓴 봉사 내역은 재료로 쓴다 — 자소서의 가장 좋은 재료다');
  ok(ids.includes('club'), '프로필로 못 채우는 자유 입력은 재료로 쓴다');
  /* story 칸은 **결과가 들어갈 자리**라 재료 목록에 넣지 않는다.
     학생이 거기 직접 쓴 글은 fields[].answer 로 따로 실려 간다 — 그 뜻은 살린다. */
  ok(!ids.includes('growth'), 'story 칸은 재료가 아니라 결과가 들어갈 자리다');

  const prof = ctx.essayProfile();
  /* 🔴 개발자와 정한 전송 범위는 학교·학년·전공 셋이다. schoolAliases 는 **넷째 항목이 아니라**
     학교 이름을 달리 부르는 말일 뿐이고(그래서 새 정보가 아니다), 쓰이는 곳은
     블라인드 심사에서 그 이름을 **지우는** 자리 하나뿐이다 — 프롬프트에는 안 들어간다.
     새 항목이 늘어나면 여기서 바로 걸린다. */
  ok(Object.keys(prof).sort().join(',') === 'major,school,schoolAliases,year',
    '④ 나가는 프로필은 학교·학년·전공(+학교 별칭) 뿐이다', Object.keys(prof).join(','));
  {
    const w = fs.readFileSync(new URL('../server/essay/worker.js', import.meta.url), 'utf8');
    const promptPart = w.slice(w.indexOf('const prompt = ['), w.indexOf('let data;'));
    ok(!/schoolAliases/.test(promptPart), '🔴 학교 별칭은 프롬프트에 실리지 않는다 — 지울 때만 쓴다');
  }
  ok(!JSON.stringify(prof).includes('4.1') && !JSON.stringify(prof).includes('홍길동'),
    '④ 성적·소득분위·이름은 프로필에 섞이지 않는다');

  /* 서버가 다시 봐도 안전한가 — 앱이 모은 그대로 서버 검사에 넣어 본다 */
  const built = { scholarship: { quotes: [] }, profile: prof, materials: mats, fields: [] };
  const serverSees = scanOutgoing(built);
  ok(serverSees.ok, '앱이 모은 재료는 서버 민감정보 검사도 통과한다', (serverSees.hits || []).join(', '));

  /* 꺼져 있으면 버튼이 아예 없다 */
  ctx.ESSAY_CONFIG.endpoint = '';
  const offBtn = ctx.essayButtonHtml({});
  ok(offBtn.includes('옮기기') && !offBtn.includes('✨'),
    '⑤ endpoint 가 비면 "옮기기" 버튼만 나온다 — 못 하는 일을 한다고 하지 않는다');
  ctx.ESSAY_CONFIG.endpoint = 'https://x.workers.dev';
  ok(ctx.essayButtonHtml({}).includes('btn-essay-ai'), '켜져 있고 도울 칸이 있으면 버튼이 나온다');
  ok(ctx.essayStoryFields({ secs: [{ items: [{ id: 'a', type: 'textarea' }] }] }).length === 0,
    '③ kind 가 없는 서술형은 안 고른다 — 애매할 때 안 건드리는 쪽');
}

/* ─────────────────────────────────────────────────────────── */
head('14) 품질 규칙 — 에세이가 아니라 제출 가능한 문서인가');
{
  const C = PLAYBOOK.checks;
  const w = (t, opt) => qualityCheck(t, Object.assign({ checks: C }, opt)).warnings.map((x) => x.code);

  ok(w('저는 성실합니다. 그래서 열심히 하겠습니다.').includes('no-self-label'),
    "'저는 성실합니다' 같은 자기규정 문장을 잡는다 — 심사자가 가장 공허하게 보는 문장");
  ok(!w('새벽 아르바이트를 1년간 하루도 빠지지 않았습니다.').includes('no-self-label'),
    '장면으로 쓴 글은 안 걸린다');
  ok(w('귀 재단의 무궁한 발전을 기원합니다.').includes('no-cliche'), '상투적 미사여구를 잡는다');
  ok(w('어릴 적부터 화목한 가정에서 자랐습니다.').includes('no-cliche'), '진부한 성장과정 도입을 잡는다');
  ok(w('부족하지만 지푸라기라도 잡는 심정입니다.').includes('no-self-pity'), '자기 비하 표현을 잡는다');

  const one = '가'.repeat(600);
  ok(w(one, { target: 600 }).includes('paragraphs'), '600자인데 한 덩어리면 잡는다');
  ok(!w(one + '\n\n' + '나'.repeat(60), { target: 660 }).includes('paragraphs'), '문단이 나뉘면 안 걸린다');
  ok(w('짧게 끝.', { target: 600 }).includes('length'), '분량 미달을 잡는다');
  ok(!w('가'.repeat(600), { target: 600 }).includes('length'), '분량이 맞으면 안 걸린다');

  ok(w('가'.repeat(600), { target: 600, ownWords: ['새벽 아르바이트를 1년간 했어요'] }).includes('uses-own-words'),
    '🔴 학생이 직접 쓴 내용이 글에 안 들어가면 잡는다 — 획일화가 실제로 일어나는 지점');
  ok(!w('저는 새벽 아르바이트를 이어 왔습니다. ' + '가'.repeat(560), { target: 600, ownWords: ['새벽 아르바이트를 1년간 했어요'] }).includes('uses-own-words'),
    '반영됐으면 안 걸린다');

  /* 규칙이 종류별로 갈리는가 */
  const all = rulesFor(PLAYBOOK, 'motive').map((r) => r.code);
  ok(all.includes('lead-first') && all.includes('motive-need-then-plan'),
    '공통 규칙 + 그 종류 전용 규칙이 함께 나온다');
  ok(!rulesFor(PLAYBOOK, 'motive').some((r) => r.kind === 'growth'), '다른 종류의 규칙은 안 섞인다');
  ok(PLAYBOOK.rules.every((r) => (r.src || []).length), '모든 규칙에 출처가 붙어 있다 — 왜 있는지 알 수 있어야 지워지지 않는다');
  ok(PLAYBOOK.sources.every((x) => x.url && x.seenAt), '출처에 주소와 본 날짜가 있다');
  /* 🔴 규칙집에는 **규칙**만 담는다. 남의 예시문을 옮겨 오면 표절·저작권 문제가
     그대로 따라온다(docs/designs/essay-tailoring.md). 규칙은 짧고, 예시문은 길다 —
     길이로 잡는다. (규칙 안에 인용부호로 든 금지 표현은 규칙의 일부라 괜찮다.) */
  const longest = Math.max(...PLAYBOOK.rules.map((r) => r.text.length));
  ok(longest <= 120, `🔴 규칙집에 예시 문장이 섞이지 않는다 — 가장 긴 규칙 ${longest}자 (상한 120)`);
  ok(PLAYBOOK.rules.every((r) => (r.text.match(/[.。]/g) || []).length <= 2),
    '규칙 하나가 문단이 되지 않는다 (문장 2개 이내)');
}

head('14-1) 학생이 직접 쓴 한 줄이 글의 중심이 되는가');
calls.length = 0;
reply = { drafts: [{ key: 'growth', text: '맞벌이 가정에서 자라 스스로 계획을 세우는 습관이 생겼습니다.\n\n그 습관으로 지금도 학기 계획을 지키고 있습니다.' }] };
{
  const p = basePayload();
  p.fields[0].asks.push({ q: '그 환경에서 배운 것이 지금 학업에 어떻게 이어지나요?',
    a: '부모님이 늦게 오셔서 스스로 계획을 세우는 습관이 생겼어요', own: true });
  await post(p);
  /* 🔴 system 프롬프트에도 같은 낱말이 있으므로 **사용자 쪽 본문**만 본다 —
     통째로 보면 언제나 통과해 검사가 아무것도 증명하지 못한다. */
  const body = calls[calls.length - 1].body.messages[0].content;
  ok(body.includes('학생이 직접 쓴 이야기'), '직접 쓴 한 줄이 **따로** 표시돼 나간다');
  ok(body.includes('글의 중심으로 삼으세요'), '그것을 글의 중심으로 삼으라고 지시한다');
  ok(body.includes('엮을 재료'), '고른 보기는 거기에 엮을 재료라고 알려 준다');
  const own = body.indexOf('학생이 직접 쓴 이야기');
  const chips = body.indexOf('엮을 재료');
  ok(own > 0 && chips > own, '직접 쓴 것이 고른 보기보다 **먼저** 나온다', `own=${own} chips=${chips}`);
}
calls.length = 0;
{
  /* 직접 쓴 것이 없으면 그 자리를 만들지 않는다 — 빈 ★ 블록이 나가면 모델이 헷갈린다 */
  await post(basePayload());
  const body = calls[calls.length - 1].body.messages[0].content;
  ok(!body.includes('학생이 직접 쓴 이야기'), '직접 쓴 것이 없으면 그 블록이 아예 안 나간다');
}

head('15) 진짜 서버 — 초안과 함께 고칠 곳을 돌려주는가');
reply = { drafts: [{ key: 'growth', text: '저는 성실합니다. 맞벌이 가정에서 자라며 아끼는 습관을 배웠습니다.' }] };
{
  const j = await (await post(basePayload())).json();
  ok(j.drafts.length === 1, '지어냄이 없으면 초안은 그대로 준다 (버리지 않는다)');
  const codes = (j.drafts[0].quality || []).map((x) => x.code);
  ok(codes.includes('no-self-label'), '수준이 낮은 부분을 짚어 준다', codes.join(', '));
  const body = JSON.stringify(calls[calls.length - 1].body);
  ok(body.includes('지켜야 할 규칙'), '요청에 작성 규칙이 조건으로 실려 간다');
  ok(body.includes('두괄식'), '규칙집의 실제 규칙이 실려 간다');
}

globalThis.fetch = realFetch;
/* ───────────────────────────────────────────────────────────────────────────
   🔴 블라인드 심사 — 학교명이 들어가면 학생이 심사에서 제외된다
   실제 공고 문구에서 나온 요구다(서울인재대학장학금). 프롬프트로만 지키지 않는다.
   ─────────────────────────────────────────────────────────────────────────── */
{
  head('16) 🔴 블라인드 심사 — 학교명을 지운다');
  const { scrubSchool } = await import('../server/essay/draft-guard.mjs');

  const r1 = scrubSchool('저는 한국외국어대학교 통번역학과에서 공부하고 있습니다.', '한국외국어대학교');
  ok(!r1.text.includes('한국외국어대학교') && r1.hits.length === 1, '정식 명칭을 지운다');
  ok(r1.text.includes('제가 다니는 학교'), "버리지 않고 '제가 다니는 학교'로 바꾼다");

  const r2 = scrubSchool('외대 도서관에서 매일 공부했습니다.', '한국외국어대학교', ['외대', '한국외대']);
  ok(!r2.text.includes('외대'), '🔴 줄임말도 지운다 — 별칭표를 함께 받는다');

  const r3 = scrubSchool('명지대학교 학생회에서 활동했습니다.', '명지대학교');
  ok(scrubSchool('명지대 학생회에서 활동했습니다.', '명지대학교').hits.length === 1,
    "'명지대'처럼 줄여 쓴 말은 이름에서 만들어 지운다");
  ok(!/학교\s*(대학교|대학)/.test(r3.text), '바꾼 뒤에 학교학교 같은 말이 남지 않는다');

  const r4 = scrubSchool('저는 통번역학과에서 공부하고 있습니다.', '한국외국어대학교');
  ok(r4.hits.length === 0 && r4.text.includes('통번역학과'), '없으면 아무것도 건드리지 않는다');
  ok(scrubSchool('아무 글', '').hits.length === 0, '학교를 모르면 그대로 둔다');

  /* 서버가 실제로 이것을 부르는지 — 배선이 끊기면 프롬프트만 남는다 */
  const w = fs.readFileSync(new URL('../server/essay/worker.js', import.meta.url), 'utf8');
  ok(/scrubSchool\(text, payload\.profile\.school/.test(w), '서버가 받은 초안에 실제로 이 검사를 건다');
  ok(/s\.blind[\s\S]{0,200}payload\.profile\.major/.test(w), '블라인드 공고에는 프롬프트에서도 학교를 빼고 보낸다');
}

/* ============================================================
   학습 로봇이 '못 배우는 종류'를 만들지 않는가 (2026-09-05 신설)

   실제로 만들어진 뒤 줄곧 그랬다(2026-08-23~09-05, 실행 7회): 리포트는 매번 "intro·value·effect·idea 는 전용 규칙이
   없습니다. 그 종류 글 주소를 seeds 에 넣어 주세요"라고 안내했는데, **주소를 넣어도
   생기지 않았다.** 붙일 규칙 어휘(VOCAB)가 아예 없어서 그 종류 문장은 전부
   '컨펌 대기'로만 쌓였기 때문이다. 안내가 사실이 아니었던 것 — 관문이 없으니 아무도 몰랐다.
   ============================================================ */
head('20) 종류마다 배울 길이 열려 있는가');
{
  const kinds = ASK.ESSAY_KINDS.map(([k]) => k);
  const withRules = new Set(PLAYBOOK.rules.filter((r) => r.kind !== '*').map((r) => r.kind));
  const missing = kinds.filter((k) => !withRules.has(k));
  ok(missing.length === 0,
    '🔴 화면이 가르는 종류마다 전용 규칙이 있다 — 없으면 그 칸은 공통 규칙만 받는다',
    missing.length ? `규칙 없는 종류: ${missing.join(', ')}` : '');

  const codes = new Set(Object.keys(VOCAB));
  const orphan = PLAYBOOK.rules.map((r) => r.code).filter((c) => !codes.has(c));
  ok(orphan.length === 0,
    '🔴 규칙마다 어휘가 있다 — 어휘가 없으면 그 규칙은 출처를 영영 못 받는다',
    orphan.length ? `어휘 없는 규칙: ${orphan.join(', ')}` : '');

  /* 어휘가 진짜 붙는지 — 실제로 컨펌 대기에 쌓여 있던 문장들로 재 본다 */
  ok(matchRule('특히 장학금이 필요한 이유는 다른 장학금이 아닌 이 장학금이 필요한 이유를 녹여주면 좋습니다.').includes('effect-why-this'),
    "'다른 장학금이 아닌 이 장학금' 문장이 effect 규칙에 붙는다");
  ok(matchRule('여러 번 퇴고를 거쳐 맞춤법과 띄어쓰기를 점검해 주세요.').includes('proofread'),
    '맞춤법·퇴고 문장이 규칙에 붙는다');
  ok(matchRule('실패한 경험을 언급하는 것도 좋습니다.').includes('failure-lesson'),
    '실패 경험 문장이 규칙에 붙는다');
  ok(matchRule('가치관을 형성한 계기를 구체적으로 적어야 합니다.').includes('value-evidence'),
    '가치관 문장이 value 규칙에 붙는다');
  ok(matchRule('문제 정의를 먼저 하고 기대 효과를 적으세요.').includes('idea-problem-first'),
    '아이디어 문장이 idea 규칙에 붙는다');
}

/* ============================================================
   로봇이 주운 주소가 성한가 (2026-09-05 신설)
   실제 사고: `?idx=17893&amp;code=1219` 가 그대로 seeds 에 올라가 매주 헛걸음했다.
   저쪽 서버는 `amp;code` 라는 없는 칸을 받는다.
   ============================================================ */
head('21) 주운 주소·광고 거르기');
{
  ok(decodeEntities('a&amp;b') === 'a&b', 'HTML 실체참조를 되돌린다');
  const html = '<a href="https://ex.com/view.php?idx=1&amp;code=2">장학금 자기소개서 작성법</a>';
  const got = linkCandidates(html, 'https://ex.com/');
  ok(got.length === 1 && got[0].url === 'https://ex.com/view.php?idx=1&code=2',
    "🔴 주운 주소에 &amp; 가 남지 않는다", got.map((g) => g.url).join(' '));

  ok(NOT_SOURCE.test('https://www.skillagit.com/product/view.php?idx=3862'),
    '첨삭 상품 판매 페이지는 출처가 아니다');
  ok(NOT_SOURCE.test('Ai로 만든 자소서, 깔끔하게 수정해드립니다.'),
    '파는 문구가 제목이면 줍지 않는다');
  ok(!NOT_SOURCE.test('https://community.linkareer.com/employment_data/3576403'),
    '멀쩡한 팁 글은 막지 않는다');

  const urls = JSON.parse(fs.readFileSync(new URL('../collector/essay-sources.json', import.meta.url), 'utf8'))
    .seeds.map((x) => x.url);
  ok(!urls.some((u) => u.includes('&amp;')), '지금 seeds 에 깨진 주소가 없다');
  ok(!urls.some((u) => NOT_SOURCE.test(u)), '지금 seeds 에 광고·예시문 DB 가 없다');

  /* 출처 번호가 겹치면 규칙이 엉뚱한 글을 근거로 달게 된다 (2026-09-05 코드리뷰에서 발견) */
  const ids = PLAYBOOK.sources.map((x) => x.id);
  ok(new Set(ids).size === ids.length, '🔴 출처 번호가 겹치지 않는다',
    ids.filter((v, i) => ids.indexOf(v) !== i).join(' '));
  const learn = fs.readFileSync(new URL('../collector/essay-playbook-learn.mjs', import.meta.url), 'utf8');
  ok(/nextId\s*=\s*Math\.max/.test(learn) && !/nextId\s*=\s*\(PLAYBOOK\.sources[^)]*\)\s*\.length/.test(learn),
    '🔴 출처 번호를 개수가 아니라 가장 큰 번호 다음으로 매긴다 — 하나라도 빼면 개수는 겹친다');
  ok(/decodeEntities\(body\)/.test(fs.readFileSync(new URL('../collector/essay-rule-line.mjs', import.meta.url), 'utf8')),
    '실체참조를 되돌리는 곳이 한 군데다 (toLines 도 같은 함수를 쓴다)');
}

console.log(`\n${fail ? '✗' : '✓'} AI 초안 안전장치 — 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
