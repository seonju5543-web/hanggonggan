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
import { scanOutgoing, checkDraft, mayDraft, materialText } from '../server/essay/draft-guard.mjs';
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
  fields: [{ key: 'growth', kind: 'story', label: '성장과정 · 가정환경', hint: '성장과정과 가정환경', answer: '' }],
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
  ok(!m.includes('test-key'), '열쇠는 재료에 섞이지 않는다');
}

globalThis.fetch = realFetch;
console.log(`\n${fail ? '✗' : '✓'} AI 초안 안전장치 — 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
