/* ============================================================
   한대장 — 장학금 도우미 AI 서버 (Cloudflare Worker · 아직 배포 안 함)
   ------------------------------------------------------------
   하는 일은 하나다: **학생 질문에 어느 공고·어느 원문 문장이 맞는지 골라 주는 것.**
   답 문장을 쓰지 않는다. 그래서 지어낼 자리가 없다.

   왜 이렇게 만들었나
     이 앱은 7월(가짜 공지 금지)·8월(추론 금지)에 "모르면 모른다고 한다"를 원칙으로 세웠다.
     AI에게 자유롭게 답을 쓰게 하면 그 원칙이 한 문장에 무너진다. 그래서 AI의 일을
     **'사서'로 한정**한다 — 어느 책의 몇 번째 문장인지 알려 주는 것까지.

   앱과의 약속(계약)은 `chat-config.js` 첫머리에 적혀 있다. 그쪽이 정본이다.

   받는 것: POST { q, items: [{ id, name, provider, amount, period, summary,
                                deadline, sourceUrl, quotes: [문장…] }] }
   주는 것: { picks: [{ id, quotes: [번호…] }], lead, needSource }

   🔴 열쇠(ANTHROPIC_API_KEY)는 Cloudflare 비밀값에만 둔다. 저장소에 넣지 않는다.
   🔴 프로필(이름·학교·성적·소득·계좌)은 애초에 앱이 보내지 않는다. 여기서도 받지 않는다.

   배포: server/chat/README.md
   ============================================================ */

const MODEL = 'claude-haiku-4-5-20251001';   // 고르기만 하므로 가장 싼 모델로 충분하다
const MAX_ITEMS = 8;
const MAX_QUOTES = 6;

/* 앱이 어디서 부를 수 있는지 — 이 주소가 아니면 받지 않는다 */
const ALLOWED_ORIGINS = [
  'https://seonju5543-web.github.io',
  'http://localhost:8123',
];

const SYSTEM = `당신은 한국 대학생 장학금 앱의 '사서'입니다. 답을 쓰지 않고 고르기만 합니다.

규칙 (반드시 지킬 것):
1. 주어진 공고 목록 밖의 공고를 만들어 내지 마세요. id는 받은 것만 씁니다.
2. 문장을 새로 쓰지 마세요. 인용은 각 공고의 quotes 배열 **번호**로만 답합니다.
3. lead는 한 줄(최대 60자)로, 무엇을 찾았는지만 말합니다.
   금액·마감일·자격 조건을 lead에 쓰지 마세요. 그건 원문 인용이 대신합니다.
4. 질문에 답할 근거가 목록 안에 없으면 picks를 비우고 needSource를 true로 하세요.
   억지로 고르지 마세요. "모르겠다"가 정답인 경우가 많습니다.
5. 학생에게 유리해 보이려고 추측하지 마세요. 틀린 안내는 안내가 없는 것보다 나쁩니다.`;

const SCHEMA = {
  type: 'object',
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          quotes: { type: 'array', items: { type: 'integer' } },
        },
        required: ['id', 'quotes'],
        additionalProperties: false,
      },
    },
    lead: { type: 'string' },
    needSource: { type: 'boolean' },
  },
  required: ['picks', 'needSource'],
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (request.method !== 'POST') return say({ needSource: true, picks: [] }, origin, 405);
    if (!ALLOWED_ORIGINS.includes(origin)) return say({ needSource: true, picks: [] }, origin, 403);
    if (!env.ANTHROPIC_API_KEY) return say({ needSource: true, picks: [] }, origin, 503);

    let body;
    try { body = await request.json(); } catch (e) { return say({ needSource: true, picks: [] }, origin, 400); }

    const q = String(body && body.q || '').slice(0, 300);
    const items = (Array.isArray(body && body.items) ? body.items : []).slice(0, MAX_ITEMS).map((it) => ({
      id: String(it.id || '').slice(0, 60),
      name: String(it.name || '').slice(0, 120),
      provider: String(it.provider || '').slice(0, 80),
      amount: String(it.amount || '').slice(0, 80),
      deadline: it.deadline || null,
      summary: String(it.summary || '').slice(0, 300),
      quotes: (Array.isArray(it.quotes) ? it.quotes : []).slice(0, MAX_QUOTES).map((s) => String(s).slice(0, 300)),
    }));
    /* 근거가 없으면 부르지 않는다 — 부르면 그때부터 지어낼 수 있다 */
    if (!q || !items.length) return say({ picks: [], needSource: true }, origin);

    const prompt = `학생 질문: ${q}\n\n고를 수 있는 공고 목록:\n${
      items.map((it, i) => `[${i}] id=${it.id}\n이름: ${it.name}\n주관: ${it.provider}\n금액: ${it.amount || '(원문 확인)'}\n마감: ${it.deadline || '(원문 확인)'}\n요약: ${it.summary}\n인용 가능한 원문 문장:\n${
        it.quotes.map((t, n) => `  ${n}) ${t}`).join('\n') || '  (없음)'}`).join('\n\n')
    }`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: env.CHAT_MODEL || MODEL,
          max_tokens: 400,
          system: SYSTEM,
          messages: [{ role: 'user', content: prompt }],
          tools: [{ name: 'answer', description: '고른 공고와 인용 번호', input_schema: SCHEMA }],
          tool_choice: { type: 'tool', name: 'answer' },
        }),
      });
      if (!res.ok) return say({ picks: [], needSource: true }, origin);
      const data = await res.json();
      const block = (data.content || []).find((c) => c.type === 'tool_use');
      if (!block || !block.input) return say({ picks: [], needSource: true }, origin);

      /* 서버에서도 한 번 거른다 — 앱의 검사(chatVerifyAI)가 최후 관문이지만,
         두 겹으로 두는 편이 낫다. 목록에 없는 id는 여기서 이미 떨군다. */
      const ids = new Set(items.map((it) => it.id));
      const picks = (block.input.picks || [])
        .filter((p) => p && ids.has(p.id))
        .map((p) => ({ id: p.id, quotes: (p.quotes || []).filter((n) => Number.isInteger(n) && n >= 0 && n < MAX_QUOTES) }));

      return say({
        picks,
        lead: String(block.input.lead || '').slice(0, 200),
        needSource: !!block.input.needSource || picks.length === 0,
      }, origin);
    } catch (e) {
      return say({ picks: [], needSource: true }, origin);
    }
  },
};
