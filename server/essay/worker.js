/* ============================================================
   한대장 — 신청서 초안 서버 (Cloudflare Worker · 배포 전)
   ------------------------------------------------------------
   하는 일 하나: **학생이 준 재료를 문장으로 엮어 초안을 만든다.**

   🔴 이 저장소의 다른 AI 경로 셋(도우미·자격 읽기·양식 스키마화)은 전부
      "AI에게 글을 쓰게 하지 않는다"가 뼈대였다. **이것만 다르다** —
      여기서는 AI가 진짜 문장을 쓴다. 그래서 경계선을 다시 그었다
      (2026-08-23 개발자 승인):

        ✅ 허용 — 학생이 준 재료를 문장으로 엮기
        ❌ 금지 — 학생이 안 준 사실 넣기 (없는 수상·봉사시간·동아리·금액·날짜)

      금지인 것은 '글을 쓰는 것'이 아니라 '사실을 만드는 것'이다.
      그 경계는 프롬프트로만 지키지 않는다 — `draft-guard.mjs`가 **받은 뒤에
      한 칸씩 되받아 검사**하고, 걸리면 그 칸은 초안 없이 돌려준다.
      앱은 그때 학생이 쓴 원문을 그대로 둔다. 절대 덮어쓰지 않는다.

   🔴 사실 나열형 칸(kind !== 'story')에는 아예 가지 않는다.
      봉사기관·봉사시간·가족사항을 AI가 채우면 학생이 **허위 서류를 제출**한다.
      앱이 안 보내고, 서버가 또 거른다. 두 겹이다.

   🔴 열쇠(ANTHROPIC_API_KEY)는 Cloudflare 비밀값에만 둔다. 저장소에 넣지 않는다.
   🔴 저장소(KV)를 붙이지 않는다 — 학생이 쓴 글은 여기 남지 않는다.
      (server/chat/ 과 같은 구조. 붙이고 싶어지면 그 순간을 의심할 것.)

   배포: server/essay/README.md
   ============================================================ */

import { scanOutgoing, checkDraft, mayDraft, materialText } from './draft-guard.mjs';

/* 개발자 결정 2026-08-23: 기본은 sonnet-5 (서류 1건당 약 47원).
   opus-5 로 바꾸려면 Cloudflare 변수 ESSAY_MODEL 한 칸만 고치면 된다 (약 78원). */
const MODEL = 'claude-sonnet-5';
const EFFORT = 'medium';

const MAX_FIELDS = 8;      // 한 양식의 서술형 칸은 가장 많은 것이 9개다
const MAX_QUOTES = 14;     // 발췌 칸과 같은 수
const MAX_ANSWER = 1200;   // 학생이 쓴 재료 한 칸
const MAX_TOKENS = 8000;

const ALLOWED_ORIGINS = [
  'https://seonju5543-web.github.io',
  'http://localhost:8123',
];

const SYSTEM = `당신은 한국 대학생의 장학금 신청서 **초안**을 돕는 글쓰기 조력자입니다.

가장 중요한 규칙 — 이것을 어기면 학생이 허위 서류를 제출하게 됩니다:
1. **학생이 주지 않은 사실을 절대 만들지 마세요.**
   없는 수상·자격증·봉사시간·동아리·인턴·가족사항·금액·날짜·기관 이름을 쓰면 안 됩니다.
   숫자(연도·시간·금액·횟수·점수)는 학생이 준 재료에 있는 것만 쓰세요.
2. 재료가 부족한 자리는 지어내지 말고 **[ ]로 비워 두세요.**
   예: "[봉사 기관명]에서 활동하며" — 학생이 채우면 됩니다.
   비워 두는 것은 실패가 아닙니다. 지어내는 것이 실패입니다.
3. 학생이 쓴 짧은 답이 있으면 **그 뜻을 살려서** 문장으로 엮으세요.
   뜻을 바꾸거나 과장하지 마세요.

글의 모양:
4. 1인칭('저는')으로, 담백한 존댓말 서술체로 씁니다. 제목·머리말·인사말은 쓰지 마세요.
5. 각 칸의 분량 안내를 지키세요. 안내가 없으면 400~600자로 씁니다.
6. 상투적인 미사여구("귀 재단의 무궁한 발전을…")를 쓰지 마세요.
7. 공고가 무엇을 보는 장학금인지 재료에 있으면, 학생의 재료와 자연스럽게 이어 주세요.

이것은 **초안**입니다. 학생이 읽고 고칠 것을 전제로 씁니다.`;

const SCHEMA = {
  type: 'object',
  properties: {
    drafts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['key', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['drafts'],
  additionalProperties: false,
};

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const say = (obj, origin, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: cors(origin) });

/* 받은 것을 우리가 아는 모양으로만 남긴다 — 모르는 칸은 통째로 버린다.
   앱이 실수로 프로필을 통째로 실어도 여기서 떨어진다. */
function sanitize(body) {
  const s = body && body.scholarship || {};
  const p = body && body.profile || {};
  return {
    scholarship: {
      name: String(s.name || '').slice(0, 120),
      provider: String(s.provider || '').slice(0, 80),
      amountText: String(s.amountText || '').slice(0, 80),
      quotes: (Array.isArray(s.quotes) ? s.quotes : []).slice(0, MAX_QUOTES).map((q) => String(q).slice(0, 300)),
    },
    /* 🔴 보낼 수 있는 프로필은 이 셋뿐이다. 성적·소득분위·이름·연락처는 받지 않는다. */
    profile: {
      school: String(p.school || '').slice(0, 40),
      year: String(p.year || '').slice(0, 20),
      major: String(p.major || '').slice(0, 40),
    },
    materials: (Array.isArray(body && body.materials) ? body.materials : []).slice(0, 20).map((m) => ({
      label: String(m.label || '').slice(0, 60),
      value: String(m.value || '').slice(0, MAX_ANSWER),
    })).filter((m) => m.value),
    fields: (Array.isArray(body && body.fields) ? body.fields : []).slice(0, MAX_FIELDS).map((f) => ({
      key: String(f.key || '').slice(0, 60),
      kind: String(f.kind || ''),
      label: String(f.label || '').slice(0, 120),
      hint: String(f.hint || '').slice(0, 200),
      answer: String(f.answer || '').slice(0, MAX_ANSWER),
    })).filter((f) => f.key && f.label),
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return say({ drafts: [], error: 'method' }, origin, 405);
    if (!ALLOWED_ORIGINS.includes(origin)) return say({ drafts: [], error: 'origin' }, origin, 403);
    if (!env.ANTHROPIC_API_KEY) return say({ drafts: [], error: 'no-key' }, origin, 503);

    let raw;
    try { raw = await request.json(); } catch { return say({ drafts: [], error: 'bad-json' }, origin, 400); }
    const payload = sanitize(raw);

    /* 🔴 사실 나열형은 여기서 잘린다. 앱도 안 보내지만 서버가 다시 본다. */
    const blocked = payload.fields.filter((f) => !mayDraft(f));
    payload.fields = payload.fields.filter(mayDraft);
    const skipped = blocked.map((f) => ({ key: f.key, reason: '사실을 적는 칸이라 직접 쓰셔야 해요' }));

    if (!payload.fields.length) return say({ drafts: [], skipped }, origin);

    /* 🔴 민감정보가 섞였으면 **부르지 않는다**. 무엇이 걸렸는지 알려 준다. */
    const scan = scanOutgoing(payload);
    if (!scan.ok) return say({ drafts: [], skipped, error: 'sensitive', hits: scan.hits }, origin, 400);

    const s = payload.scholarship;
    const prompt = [
      `■ 장학금`,
      `이름: ${s.name || '(미상)'}`,
      s.provider ? `주관: ${s.provider}` : '',
      s.amountText ? `금액: ${s.amountText}` : '',
      s.quotes.length ? `공고 원문에서:\n${s.quotes.map((q) => `  · ${q}`).join('\n')}` : '',
      '',
      `■ 학생 (이것이 전부입니다 — 여기 없는 사실은 쓰지 마세요)`,
      `${payload.profile.school || ''} ${payload.profile.major || ''} ${payload.profile.year || ''}`.trim() || '(밝히지 않음)',
      ...payload.materials.map((m) => `· ${m.label}: ${m.value}`),
      '',
      `■ 써 주실 칸`,
      ...payload.fields.map((f) => [
        `[key=${f.key}] ${f.label}`,
        f.hint ? `  안내: ${f.hint}` : '',
        f.answer ? `  학생이 쓴 것(이 뜻을 살려 주세요): ${f.answer}` : '  학생이 쓴 것: (없음 — 위 재료만으로 쓰세요)',
      ].filter(Boolean).join('\n')),
    ].filter((l) => l !== '').join('\n');

    let data;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        /* 🔴 `fallbacks`를 붙이지 말 것 — `claude-sonnet-5` does not support the
           `fallbacks` parameter. 로 **400이 난다**(2026-08-23 이 저장소에서 실측).
           Fable 5·Opus 5 전용 파라미터다. 습관적으로 붙였다가 첫 호출부터 전부 죽었다. */
        body: JSON.stringify({
          model: env.ESSAY_MODEL || MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          output_config: { effort: env.ESSAY_EFFORT || EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) {
        /* 오류 전문을 짧게 남긴다 — 400은 과금되지 않아 진단은 공짜다.
           (자격 AI가 60자에서 잘라 원인을 못 찾았던 일이 있다.) */
        const why = (await res.text()).slice(0, 300);
        return say({ drafts: [], skipped, error: 'api', status: res.status, why }, origin);
      }
      data = await res.json();
    } catch (e) {
      return say({ drafts: [], skipped, error: 'network' }, origin);
    }

    if (data.stop_reason === 'refusal') return say({ drafts: [], skipped, error: 'refusal' }, origin);

    let out;
    try {
      const block = (data.content || []).find((c) => c.type === 'text');
      out = JSON.parse(block.text);
    } catch { return say({ drafts: [], skipped, error: 'parse' }, origin); }

    /* ── 되받아 검사 — 여기가 '지어냄'을 실제로 막는 자리다 ── */
    const material = materialText(payload);
    const wanted = new Set(payload.fields.map((f) => f.key));
    const drafts = [];
    for (const d of (out.drafts || [])) {
      const key = String(d && d.key || '');
      if (!wanted.has(key)) continue;                      // 안 물어본 칸은 버린다
      const text = String(d.text || '').trim();
      const v = checkDraft(text, material);
      if (v.ok) drafts.push({ key, text });
      else skipped.push({ key, reason: v.reasons[0], reasons: v.reasons });
    }
    /* 아무 말도 못 받은 칸은 조용히 넘어가지 않고 이유를 남긴다 */
    for (const f of payload.fields) {
      if (!drafts.some((d) => d.key === f.key) && !skipped.some((k) => k.key === f.key)) {
        skipped.push({ key: f.key, reason: '초안을 받지 못했어요' });
      }
    }

    return say({ drafts, skipped }, origin);
  },
};
