/* ============================================================
   한대장 — 장학금 도우미 (안내봇)
   ------------------------------------------------------------
   ⚠️ 이 파일의 단 하나의 규칙: **앱이 이미 아는 것만 말한다.**

   답은 전부 아래 네 곳에서만 나온다.
     · 정식 등록 공고(data/registered.json) — 매칭 엔진이 내 프로필로 판정한 결과
     · 실시간 공고 피드(data/notices.json) — 제목과 링크만 아는 것이라 그렇게만 말한다
     · 내 신청 내역(state.applications)과 서류 보관함
     · 공고 원문 발췌(excerpts) — 원문 문장 그대로

   못 찾으면 **지어내지 않고 "못 찾았다"고 말한다.** 이것이 운영 원칙 6·8-1
   (가짜 공지 금지 · 추론 금지)을 챗봇에서 지키는 방법이다. 금액을 모르는 공고에
   그럴듯한 숫자를 붙이거나, 마감을 짐작해서 말하는 것은 '없는 것보다 나쁘다'.

   판정은 절대 여기서 새로 만들지 않는다 — 자격은 match-engine.js의 evaluate,
   마감은 app.js의 dday를 그대로 쓴다. 여기에 판정 규칙을 한 벌 더 만들면
   **화면과 챗봇이 서로 다른 말을 하게 된다**(알림을 match-engine으로 합친 것과 같은 이유).
   ============================================================ */

/* ---------------- 도우미가 쓰는 재료 (없으면 조용히 비운다) ----------------
   app.js·data.js가 아직 안 읽혔거나 검사 환경에서 일부가 없어도
   도우미 때문에 앱이 죽으면 안 된다. */
function chatSafe(fn, fallback) {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function chatMatches() {
  /* 내 프로필로 판정된 전체 공고 — 화면(탐색 탭)이 쓰는 것과 같은 함수 */
  return chatSafe(() => getMatches(), []);
}

/* '지금 지원할 수 있는 것' — 홈 히어로와 **같은 기준**을 쓴다.
   자격이 되고, 마감이 안 지났고, 오래되어 숨긴 공고가 아닌 것. */
function chatApplyable() {
  return chatMatches().filter((m) =>
    ['eligible', 'selective'].includes(m.result.status) &&
    chatSafe(() => dday(m.sch.deadline).days, 0) >= 0 &&
    chatSafe(() => notStale(m.sch), true));
}

/* 우리 학교 실시간 공고 — 제목과 링크만 아는 목록.
   ⚠️ liveNotices는 배열이 아니라 `{ updatedAt, items }` 꼴이다(app.js loadNotices).
   배열로 착각하면 여기서 통째로 넘어져 도우미가 답을 못 한다 — 실제로 겪었다. */
function chatNotices() {
  const doc = chatSafe(() => (typeof liveNotices !== 'undefined' && liveNotices) || null, null);
  const p = chatSafe(() => state.profile, null);
  if (!doc || !p) return [];
  const list = Array.isArray(doc) ? doc : (doc.items || []);
  return list.filter((n) => chatSafe(() => noticeForProfile(n, p), false));
}

/* ---------------- 말에서 낱말 뽑기 ----------------
   한국어는 낱말 뒤에 조사가 붙어서 '기숙사비를'과 '기숙사비'가 달라진다.
   그대로 비교하면 못 찾으므로 꼬리를 떼고 본다. 어렵게 만들 필요는 없다 —
   못 찾으면 정직하게 '못 찾았다'고 말하면 되기 때문이다. */
const CHAT_STOP = new Set([
  '장학금', '장학', '공고', '신청', '알려줘', '알려', '있어', '있나', '있나요', '뭐가', '뭐',
  '어떤', '어떻게', '언제', '얼마', '해줘', '주세요', '싶어', '하고', '그리고', '지금', '내가',
  '나는', '저는', '제가', '우리', '학교', '것', '거', '좀', '요', '까지', '부터', '관련', '대해',
]);
const CHAT_TAIL = /(으로|에서|에게|에는|이나|이란|라는|보다|처럼|까지|부터|한테|들이|들을|들은|은|는|이|가|을|를|의|에|도|만|와|과|랑|로|나)$/;

function chatTokens(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]/g, ' ')
    .split(/\s+/)
    .map((w) => {
      const cut = w.replace(CHAT_TAIL, '');
      return cut.length >= 2 ? cut : w;   // 꼬리를 떼서 한 글자가 되면 원래 낱말을 쓴다
    })
    .filter((w) => w.length >= 2 && !CHAT_STOP.has(w));
}

/* ---------------- 공고 찾기 (키워드) ----------------
   이름 > 주관기관 > 요약·원문 발췌 순으로 점수를 준다. */
function chatSearch(q, limit = 4) {
  const words = chatTokens(q);
  if (!words.length) return [];
  const scored = chatMatches().map((m) => {
    const s = m.sch;
    const name = String(s.name || '').toLowerCase();
    const provider = String(s.provider || '').toLowerCase();
    const body = [s.summary, s.amount, s.note, ...(s.excerpts || []), ...(s.eligibilityLines || [])]
      .join(' ').toLowerCase();
    let score = 0;
    words.forEach((w) => {
      if (name.includes(w)) score += 3;
      if (provider.includes(w)) score += 2;
      if (body.includes(w)) score += 1;
    });
    /* 마감된 공고·오래된 공고는 뒤로 (아예 빼지는 않는다 —
       "내가 신청했던 그거" 를 찾는 경우가 있다) */
    if (chatSafe(() => dday(s.deadline).days, 0) < 0) score -= 2;
    return { ...m, score };
  }).filter((m) => m.score > 0);

  scored.sort((a, b) => b.score - a.score || b.fit - a.fit);
  return scored.slice(0, limit);
}

/* 실시간 공고에서 찾기 — 제목만 있으므로 제목만 본다 */
function chatSearchNotices(q, limit = 3) {
  const words = chatTokens(q);
  if (!words.length) return [];
  return chatNotices()
    .filter((n) => words.some((w) => String(n.title || '').toLowerCase().includes(w)))
    .slice(0, limit);
}

/* ---------------- 답 만들기 ----------------
   { text, cards, notices, note } 를 돌려준다.
   text  = 도우미가 하는 말 (반드시 앱이 아는 사실만)
   cards = 보여 줄 공고 (누르면 기존 상세 화면이 열린다)
   note  = 한계·주의 (모르는 것은 모른다고 적는 자리) */

function chatAnswerApplyable() {
  const list = chatApplyable().sort((a, b) => b.fit - a.fit);
  if (!list.length) {
    return {
      text: '지금 조건에 맞는 공고를 찾지 못했어요.',
      note: '프로필(성적·소득구간·특별자격)을 채우면 판정할 수 있는 공고가 늘어나요. 장학금 탭에서 전체 목록도 볼 수 있어요.',
    };
  }
  const now = list.filter((m) => m.result.status === 'eligible').length;
  const sel = list.filter((m) => m.result.status === 'selective').length;
  return {
    text: `지금 지원할 수 있는 공고가 ${list.length}건 있어요. 바로 신청 ${now}건 · 선발 심사형 ${sel}건이에요.`,
    cards: list.slice(0, 4),
    note: list.length > 4 ? `적합도가 높은 4건만 보여 드렸어요. 나머지는 장학금 탭에서 볼 수 있어요.` : '',
  };
}

function chatAnswerDeadline() {
  const withDate = chatApplyable()
    .filter((m) => m.sch.deadline)
    .sort((a, b) => chatSafe(() => deadlineTs(a.sch), 0) - chatSafe(() => deadlineTs(b.sch), 0));
  const noDate = chatApplyable().filter((m) => !m.sch.deadline).length;

  if (!withDate.length) {
    return {
      text: '마감일이 확인된 공고가 지금은 없어요.',
      note: noDate
        ? `지원할 수 있는 공고 ${noDate}건은 마감일이 공고 원문에만 적혀 있어서, 앱이 날짜를 말씀드릴 수 없어요. 각 공고의 '원문 공고 ↗'에서 확인해 주세요.`
        : '',
    };
  }
  const soon = withDate[0];
  const d = chatSafe(() => dday(soon.sch.deadline), { label: '' });
  return {
    text: `가장 급한 건 '${soon.sch.name}'이고 ${d.label}이에요. 마감이 확인된 공고 ${withDate.length}건을 가까운 순서로 보여 드릴게요.`,
    cards: withDate.slice(0, 4),
    note: noDate ? `이 밖에 ${noDate}건은 마감일이 원문에만 있어서 목록에서 뺐어요 — 날짜를 지어내지 않으려고요.` : '',
  };
}

function chatAnswerAmount() {
  const list = chatApplyable();
  const known = list.filter((m) => m.sch.amountValue);
  const total = known.reduce((sum, m) => sum + (m.sch.amountValue || 0), 0);
  const unknown = list.length - known.length;

  if (!known.length) {
    return {
      text: '금액을 숫자로 확인한 공고가 아직 없어요.',
      note: `지원할 수 있는 공고 ${list.length}건은 금액이 공고 원문에만 적혀 있어요. 앱이 임의로 계산하면 실제와 달라질 수 있어서, 합계에 넣지 않고 있어요. 각 공고의 '원문 공고 ↗'에서 확인해 주세요.`,
    };
  }
  return {
    text: `금액이 확인된 ${known.length}건을 더하면 최대 ${chatSafe(() => won(total), total + '원')}이에요.`,
    cards: known.sort((a, b) => (b.sch.amountValue || 0) - (a.sch.amountValue || 0)).slice(0, 4),
    note: unknown ? `나머지 ${unknown}건은 금액이 원문에만 있어서 합계에서 뺐어요.` : '',
  };
}

function chatAnswerDocuments(q) {
  /* 특정 공고를 물었으면 그 공고의 서류를, 아니면 자주 필요한 서류를 모아서 */
  const hit = chatSearch(q, 1)[0];
  if (hit && (hit.sch.documents || []).length) {
    const rows = hit.sch.documents.map((doc) => {
      const st = chatSafe(() => docWalletStatus(doc), null);
      const name = String(doc).replace(/\s*\(.*\)$/, '');
      if (st && st.ok) return `✓ ${name} — 보관함에 있어요`;
      return `□ ${name}`;
    });
    return {
      text: `'${hit.sch.name}'에 필요한 서류예요.`,
      list: rows,
      cards: [hit],
      note: '보관함(MY 탭)에 올려 둔 서류는 다음 신청부터 자동으로 함께 준비돼요.',
    };
  }

  const count = {};
  chatApplyable().forEach((m) => (m.sch.documents || []).forEach((doc) => {
    const name = String(doc).replace(/\s*\(.*\)$/, '');
    count[name] = (count[name] || 0) + 1;
  }));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!top.length) {
    return {
      text: '지금 지원 가능한 공고에서 필요한 서류 정보를 찾지 못했어요.',
      note: '공고마다 요구 서류가 달라요. 공고를 하나 열어 보시면 서류 목록과 발급처를 안내해 드려요.',
    };
  }
  const rows = top.map(([name, n]) => {
    const st = chatSafe(() => docWalletStatus(name), null);
    const slot = chatSafe(() => slotForDoc(name), null);
    const where = slot ? ` — ${slot.issue}` : '';
    return `${st && st.ok ? '✓' : '□'} ${name} (${n}건에서 필요)${st && st.ok ? ' — 보관함에 있어요' : where}`;
  });
  return {
    text: '지금 지원 가능한 공고에서 자주 요구하는 서류예요.',
    list: rows,
    note: '보관함(MY 탭)에 한 번 올려 두면 다음 신청부터 자동으로 함께 준비돼요.',
  };
}

function chatAnswerHowTo(q) {
  const hit = chatSearch(q, 1)[0];
  if (hit) {
    const label = chatSafe(() => submitChannelLabel(hit.sch), '');
    return {
      text: `'${hit.sch.name}'의 접수 방법이에요. ${label}`,
      cards: [hit],
      note: '공고를 눌러 열면 준비 단계와 제출처 바로가기가 나와요. 최종 제출은 학교·재단 시스템에서 이뤄지니, 원문 공고에서 한 번 더 확인해 주세요.',
    };
  }
  return {
    text: '접수 방법은 공고마다 달라요. 한대장은 네 가지로 나눠 안내해요.',
    list: [
      '📧 이메일 접수 — 앱이 메일을 자동으로 채워 줘요',
      '📄 양식 제출형 — 앱에서 공고 원본과 같은 신청서를 작성해요',
      '📎 원본 양식 다운로드형 — 첨부 양식을 내려받아 작성해요',
      '🖥 온라인·포털 입력형 — 앱에서 작성한 내용을 복사해 붙여넣어요',
    ],
    note: '공고 이름을 함께 물어보시면 그 공고가 어디에 해당하는지 알려 드릴게요. (예: "○○장학금 어떻게 신청해?")',
  };
}

function chatAnswerMyApps() {
  const apps = chatSafe(() => state.applications, []) || [];
  if (!apps.length) {
    return {
      text: '아직 준비한 장학금이 없어요.',
      note: '공고를 열고 "신청 준비하기"를 누르면 서류와 신청서를 앱에서 만들 수 있어요.',
    };
  }
  const rows = apps.map((a) => {
    const sch = chatSafe(() => findSch(a.id), null);
    if (!sch) return null;
    const step = chatSafe(() => APP_STEPS[effectiveStep(a, sch)], '준비 완료');
    return `· ${sch.name} — ${step}`;
  }).filter(Boolean);
  return {
    text: `준비한 장학금이 ${rows.length}건 있어요.`,
    list: rows,
    note: '공식 제출과 발표 결과는 앱이 학교 전산을 볼 수 없어서, 신청내역 탭에서 직접 기록해 주셔야 해요.',
  };
}

function chatAnswerHelp() {
  return {
    text: '저는 이 앱이 갖고 있는 공고·서류·신청 현황만 보고 답해요. 모르면 모른다고 말씀드릴게요.',
    list: [
      '"지금 뭐 신청할 수 있어?" — 내 조건에 맞는 공고',
      '"마감 임박한 거 알려줘" — 마감이 확인된 순서대로',
      '"서류 뭐 준비해?" — 자주 요구하는 서류와 발급처',
      '"기숙사" 처럼 낱말만 — 그 낱말이 든 공고 찾기',
      '"내 신청 현황" — 준비한 장학금의 진행 단계',
    ],
    note: '금액과 마감일은 공고 원문에만 있는 경우가 많아요. 그럴 때는 지어내지 않고 원문 링크를 알려 드려요.',
  };
}

/* ---------------- 어떤 질문인지 가르기 ----------------
   순서가 중요하다 — 위쪽이 먼저 걸린다. */
function chatRoute(q) {
  const s = String(q || '').trim();
  if (!s) return null;

  if (/^(도움|도움말|help|뭐할|뭘 할|어떻게 써|사용법)/.test(s)) return chatAnswerHelp();
  if (/(안녕|하이|hello|hi)$/.test(s.replace(/[?!.\s]/g, ''))) {
    return { text: '안녕하세요! 장학금에 대해 궁금한 걸 물어보세요.', ...chatAnswerHelp(), text2: true };
  }
  if (/(내 신청|신청 ?현황|진행 ?상황|어디까지|준비한)/.test(s)) return chatAnswerMyApps();
  if (/(마감|언제까지|기한|임박|급한|D-)/i.test(s)) return chatAnswerDeadline();
  if (/(얼마|금액|액수|최대|받을 수 있는 돈|얼만)/.test(s)) return chatAnswerAmount();
  if (/(서류|증명서|준비물|뭐 ?떼|무엇을 ?준비|제출 ?서류)/.test(s)) return chatAnswerDocuments(s);
  if (/(어떻게 ?신청|신청 ?방법|접수 ?방법|어디에 ?내|제출 ?방법|어디서 ?신청)/.test(s)) return chatAnswerHowTo(s);
  if (/(신청할 수 있|지원할 수 있|가능한|받을 수 있|추천|맞는|자격|될까|되나)/.test(s)) return chatAnswerApplyable();

  /* 위에 안 걸리면 낱말로 찾아본다 */
  const cards = chatSearch(s);
  const notices = chatSearchNotices(s);
  if (cards.length || notices.length) {
    const bits = [];
    if (cards.length) bits.push(`등록 공고 ${cards.length}건`);
    if (notices.length) bits.push(`우리 학교 게시판 ${notices.length}건`);
    return {
      text: `${bits.join(' · ')}을 찾았어요.`,
      cards,
      notices,
      note: notices.length
        ? '게시판 공고는 제목과 링크만 확인한 것이라, 자격·금액은 원문에서 봐 주세요.'
        : '',
    };
  }
  return null;  // 못 알아들음 — AI 자리로 넘어간다
}

/* ---------------- 못 알아들었을 때 ---------------- */
function chatAnswerUnknown(q) {
  return {
    text: '그 질문은 제가 아직 못 알아들었어요. 앱에 있는 정보에서 찾아봤지만 맞는 공고가 없었어요.',
    note: '지어내서 답하지 않으려고 여기서 멈춰요. "지금 뭐 신청할 수 있어?", "마감 임박", "서류" 처럼 물어보시거나, 장학금 탭에서 전체 목록을 훑어보실 수 있어요.',
  };
}

/* ---------------- AI 답변 (지금은 꺼져 있음) ----------------
   안내봇이 못 알아들은 질문에만 부른다. chat-config.js의 endpoint가 비어 있으면
   이 함수는 아무것도 하지 않고 곧바로 null을 돌려준다(= 앱은 지금과 똑같이 동작한다).

   🔴 보내는 것의 한계선 — 되돌리지 말 것
      질문 글자와, **앱이 먼저 골라 낸 공고의 공개 정보**만 보낸다.
      이름·학교·성적·소득구간·특별자격·계좌는 보내지 않는다. 판정은 기기 안에서 끝난다. */
async function chatAskAI(q) {
  if (typeof chatAiConfigured !== 'function' || !chatAiConfigured()) return null;

  const items = chatSearch(q, CHAT_CONFIG.maxItems || 6).map(({ sch }) => ({
    id: sch.id, name: sch.name, provider: sch.provider, amount: sch.amount,
    period: sch.period, summary: sch.summary, deadline: sch.deadline || null,
    excerpts: (sch.excerpts || []).slice(0, 4), sourceUrl: sch.sourceUrl || null,
  }));

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), CHAT_CONFIG.timeoutMs || 8000);
  try {
    const res = await fetch(CHAT_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: String(q).slice(0, 300), items }),
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.text) return null;
    return {
      text: String(data.text).slice(0, 1200),
      cards: chatSearch(q, 3),
      ai: true,
      note: 'AI가 위 공고들을 읽고 정리한 답이에요. 금액·마감·자격은 반드시 공고 원문에서 확인해 주세요.',
    };
  } catch (e) {
    return null;   // 서버가 없거나 느리면 안내봇 답으로 되돌아간다
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   화면
   ============================================================ */
let chatHistory = [];     // { who: 'me' | 'bot', html }
let chatBusy = false;

const CHAT_SUGGESTIONS = ['지금 뭐 신청할 수 있어?', '마감 임박', '서류 뭐 준비해?', '내 신청 현황'];

function chatEsc(s) {
  return chatSafe(() => esc(s), String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
}

/* 답 한 덩어리를 화면 조각으로 */
function chatAnswerHtml(a) {
  const parts = [`<p class="chat-text">${chatEsc(a.text)}</p>`];

  if (a.ai) parts.push('<p class="chat-ai-tag">🤖 AI가 정리한 답 — 아래 공고 원문으로 확인하세요</p>');

  if (a.list && a.list.length) {
    parts.push(`<ul class="chat-list">${a.list.map((r) => `<li>${chatEsc(r)}</li>`).join('')}</ul>`);
  }

  if (a.cards && a.cards.length) {
    parts.push(`<div class="chat-cards">${a.cards.map((m) =>
      chatSafe(() => schCard(m.sch, m.result, { compact: true, fit: m.fit }), '')).join('')}</div>`);
  }

  if (a.notices && a.notices.length) {
    parts.push(`<ul class="chat-notices">${a.notices.map((n) => {
      const url = chatSafe(() => safeUrl(n.url), '');
      const title = chatEsc(n.title);
      return url
        ? `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a></li>`
        : `<li>${title}</li>`;
    }).join('')}</ul>`);
  }

  if (a.note) parts.push(`<p class="chat-note">${chatEsc(a.note)}</p>`);
  return parts.join('');
}

const CHAT_FACE = '<span class="chat-avatar" aria-hidden="true"><svg class="mascot" viewBox="0 0 48 48"><use href="#mascot"/></svg></span>';
const CHAT_FACE_BLANK = '<span class="chat-avatar blank" aria-hidden="true"></span>';

function chatRender() {
  const box = document.querySelector('#chat-log');
  if (!box) return;
  /* 마스코트 얼굴은 **연달아 말하는 첫 줄에만** 붙인다. 줄마다 붙이면 같은 얼굴이
     세로로 늘어서 대화가 아니라 목록처럼 보인다. 뒷줄은 빈 자리로 채워 말풍선 왼쪽 끝을 맞춘다. */
  let prev = null;
  const rows = chatHistory.map((m) => {
    const first = prev !== 'bot';
    prev = m.who;
    return m.who === 'me'
      ? `<div class="chat-row me"><div class="chat-bubble me">${chatEsc(m.text)}</div></div>`
      : `<div class="chat-row bot">${first ? CHAT_FACE : CHAT_FACE_BLANK}<div class="chat-bubble bot">${m.html}</div></div>`;
  });
  box.innerHTML = rows.join('')
    + (chatBusy ? `<div class="chat-row bot">${prev === 'bot' ? CHAT_FACE_BLANK : CHAT_FACE}<div class="chat-bubble bot chat-typing">…</div></div>` : '');
  box.scrollTop = box.scrollHeight;
}

function chatPushBot(a) {
  chatHistory.push({ who: 'bot', html: chatAnswerHtml(a) });
  chatRender();
}

async function chatSend(q) {
  const text = String(q || '').trim();
  if (!text || chatBusy) return;

  chatHistory.push({ who: 'me', text });
  chatRender();

  /* 규칙 어디에서든 넘어져도 **질문이 답 없이 남는 일은 없어야 한다.**
     실제로 liveNotices를 배열로 착각한 실수 하나가 답을 통째로 삼켰다 —
     사용자 눈에는 '보냈는데 아무 반응이 없는' 상태로 보인다. */
  let local = null;
  try {
    local = chatRoute(text);
  } catch (e) {
    chatPushBot({
      text: '앗, 답을 찾다가 문제가 생겼어요.',
      note: '다시 물어보시거나 장학금 탭에서 직접 찾아보실 수 있어요.',
    });
    return;
  }
  if (local) { chatPushBot(local); return; }

  /* 안내봇이 못 알아들었을 때만 AI 자리로 — 꺼져 있으면 곧바로 정직한 답 */
  if (typeof chatAiConfigured === 'function' && chatAiConfigured()) {
    chatBusy = true;
    chatRender();
    const ai = await chatAskAI(text);
    chatBusy = false;
    chatPushBot(ai || chatAnswerUnknown(text));
    return;
  }
  chatPushBot(chatAnswerUnknown(text));
}

/* ---------------- 시트 열고 닫기 ---------------- */
function chatOpen(prefill) {
  const sheet = document.querySelector('#chat-sheet');
  const back = document.querySelector('#chat-backdrop');
  if (!sheet || !back) return;

  if (!chatHistory.length) {
    chatHistory.push({
      who: 'bot',
      html: chatAnswerHtml({
        text: '안녕하세요! 이 앱에 있는 공고와 서류 정보로 답해 드려요. 무엇이 궁금하세요?',
        note: '금액·마감이 공고 원문에만 있는 경우가 많아요. 그럴 때는 지어내지 않고 원문 링크로 안내해 드려요.',
      }),
    });
  }
  chatRender();

  back.hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    back.classList.add('show');
    sheet.classList.add('show');
    const input = document.querySelector('#chat-input');
    if (input) {
      if (prefill) input.value = prefill;
      input.focus({ preventScroll: true });
    }
  });
}

function chatClose() {
  const sheet = document.querySelector('#chat-sheet');
  const back = document.querySelector('#chat-backdrop');
  if (!sheet || !back) return;
  back.classList.remove('show');
  sheet.classList.remove('show');
  setTimeout(() => { back.hidden = true; sheet.hidden = true; }, 250);
}

/* ============================================================
   마스코트 버튼 — 눌러서 열고, **꾹 눌러서 옮긴다**
   ------------------------------------------------------------
   🔴 '누르기'와 '옮기기'를 반드시 갈라야 한다. 13차 세션의 학교 검색 사고가 이 구분을
   빠뜨려서 났다(손가락이 닿는 순간 선택돼 목록을 못 내렸다). 여기서는 반대 방향의 같은 실수가
   가능하다 — 손이 조금 흔들렸다고 열리지 않으면 버튼이 안 눌리는 것처럼 느껴진다.
   그래서 규칙을 둘로 못 박는다:
     · 짧게 누르고 뗀다(움직임 8px 미만)      → **연다**
     · 꾹 누른다(360ms) → 그때부터 손가락을 따라온다 → 떼면 가까운 쪽 가장자리에 붙는다
   옮긴 자리는 기기에 기억되고, 화면을 돌리거나 창 크기가 바뀌면 다시 화면 안으로 넣는다.
   ============================================================ */
const CHAT_FAB_KEY = 'handaejang.chatFab';   // { side:'left'|'right', ratio: 0~1 }
const CHAT_HOLD_MS = 360;
const CHAT_MOVE_TOL = 8;                     // 이만큼 움직이기 전까지는 '누른 것'으로 본다
const CHAT_EDGE = 14;

function chatFabSaved() {
  try { return JSON.parse(localStorage.getItem(CHAT_FAB_KEY) || 'null'); } catch (e) { return null; }
}

/* 마스코트가 놓일 수 있는 세로 범위 — 위는 화면 머리, 아래는 하단 탭 위까지.
   하단 탭을 덮게 두면 학생이 탭을 못 눌러 앱을 못 옮겨 다닌다. */
function chatFabBand(size) {
  const nav = document.querySelector('#bottom-nav');
  const navTop = nav && !nav.hidden ? nav.getBoundingClientRect().top : window.innerHeight;
  return { min: CHAT_EDGE + 44, max: Math.max(CHAT_EDGE + 44, navTop - size - 10) };
}

/* 저장된 자리를 화면에 적용한다. 저장된 것이 없으면 CSS의 첫 자리를 그대로 둔다. */
function chatFabPlace(pos) {
  const fab = document.querySelector('#btn-chat-fab');
  if (!fab || !pos) return;
  const size = fab.offsetWidth || 56;
  const band = chatFabBand(size);
  const col = Math.min(480, window.innerWidth);           // 앱은 가운데 480px 칸에 그려진다
  const gutter = (window.innerWidth - col) / 2;
  const left = pos.side === 'left' ? gutter + CHAT_EDGE : gutter + col - size - CHAT_EDGE;
  const top = Math.round(band.min + (band.max - band.min) * Math.min(1, Math.max(0, pos.ratio)));
  fab.style.left = left + 'px';
  fab.style.top = top + 'px';
  fab.style.right = 'auto';
  fab.style.bottom = 'auto';
}

function chatBindFab() {
  const fab = document.querySelector('#btn-chat-fab');
  if (!fab) return;

  const saved = chatFabSaved();
  if (saved) chatFabPlace(saved);
  window.addEventListener('resize', () => {
    const s = chatFabSaved();
    if (s) chatFabPlace(s);          // 화면을 돌려도 마스코트가 화면 밖으로 나가지 않게
  });

  let holdTimer = null, lifted = false, moved = false;
  let startX = 0, startY = 0, offX = 0, offY = 0;

  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };

  const lift = () => {
    lifted = true;
    fab.classList.add('lifted');
    fab.classList.remove('dropping');
    chatHintHide();
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* 진동은 있으면 좋은 것 */ } }
  };

  fab.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    moved = false;
    lifted = false;
    startX = e.clientX; startY = e.clientY;
    const r = fab.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    fab.setPointerCapture(e.pointerId);
    holdTimer = setTimeout(lift, CHAT_HOLD_MS);
  });

  fab.addEventListener('pointermove', (e) => {
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!lifted) {
      /* 아직 안 들었는데 많이 움직였다 = 옮기려는 것도, 누르려는 것도 아니다(스크롤 등) */
      if (Math.hypot(dx, dy) > CHAT_MOVE_TOL) { moved = true; cancelHold(); }
      return;
    }
    moved = true;
    const size = fab.offsetWidth || 56;
    const band = chatFabBand(size);
    const x = Math.min(window.innerWidth - size - CHAT_EDGE, Math.max(CHAT_EDGE, e.clientX - offX));
    const y = Math.min(band.max, Math.max(band.min, e.clientY - offY));
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  });

  const finish = (e) => {
    cancelHold();
    if (lifted) {
      lifted = false;
      fab.classList.remove('lifted');
      fab.classList.add('dropping');
      /* 가까운 쪽 가장자리에 붙인다 — 가운데 떠 있으면 공고 카드를 가린다 */
      const size = fab.offsetWidth || 56;
      const r = fab.getBoundingClientRect();
      const band = chatFabBand(size);
      const side = (r.left + size / 2) < window.innerWidth / 2 ? 'left' : 'right';
      const ratio = band.max > band.min ? (r.top - band.min) / (band.max - band.min) : 0;
      const pos = { side, ratio: Math.min(1, Math.max(0, ratio)) };
      chatFabPlace(pos);
      try { localStorage.setItem(CHAT_FAB_KEY, JSON.stringify(pos)); } catch (err) { /* 저장 실패해도 이번 자리는 유지 */ }
      setTimeout(() => fab.classList.remove('dropping'), 260);
      return;
    }
    if (!moved) chatOpen();          // 짧게 눌렀다 = 열기
  };

  fab.addEventListener('pointerup', finish);
  fab.addEventListener('pointercancel', () => { cancelHold(); lifted = false; fab.classList.remove('lifted'); });

  /* 키보드로도 열 수 있어야 한다 — pointer 경로로만 열면 버튼이 아닌 것이 된다.
     (옮기기는 키보드로 못 하지만, 자리는 편의 기능이라 못 해도 쓸 수 있다) */
  fab.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    chatOpen();
  });
}

/* 꾹 눌러 옮길 수 있다는 것을 처음 한 번만 알려 준다 — 숨은 동작은 알려 주지 않으면 없는 것과 같다 */
const CHAT_HINT_KEY = 'handaejang.chatHint';
function chatHintHide() {
  const hint = document.querySelector('#chat-hint');
  if (!hint) return;
  hint.classList.remove('show');
  setTimeout(() => { hint.hidden = true; }, 300);
}
function chatHintMaybeShow() {
  const hint = document.querySelector('#chat-hint');
  const fab = document.querySelector('#btn-chat-fab');
  if (!hint || !fab || fab.hidden) return;
  try { if (localStorage.getItem(CHAT_HINT_KEY)) return; } catch (e) { return; }
  const r = fab.getBoundingClientRect();
  hint.hidden = false;
  const w = hint.offsetWidth;
  /* 마스코트가 오른쪽에 있으면 왼쪽에, 왼쪽에 있으면 오른쪽에 띄운다 — 화면 밖으로 나가지 않게 */
  const left = r.left + r.width / 2 > window.innerWidth / 2 ? r.left - w - 10 : r.right + 10;
  hint.style.left = Math.max(8, left) + 'px';
  hint.style.top = Math.round(r.top + (r.height - hint.offsetHeight) / 2) + 'px';
  requestAnimationFrame(() => hint.classList.add('show'));
  try { localStorage.setItem(CHAT_HINT_KEY, '1'); } catch (e) { /* 못 저장하면 다음에 또 뜬다 — 무해 */ }
  setTimeout(chatHintHide, 4200);
}

function chatBind() {
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');
  const sheet = document.querySelector('#chat-sheet');
  if (!form || !input || !sheet) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    chatSend(q);
  });

  /* 추천 질문 칩 */
  const chips = document.querySelector('#chat-chips');
  if (chips) {
    chips.innerHTML = CHAT_SUGGESTIONS.map((s) =>
      `<button type="button" class="chat-chip" data-ask="${chatEsc(s)}">${chatEsc(s)}</button>`).join('');
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ask]');
      if (b) chatSend(b.dataset.ask);
    });
  }

  /* 공고 카드를 누르면 기존 상세 화면이 열린다(app.js의 문서 클릭 처리).
     두 시트가 겹치면 안 되니 도우미는 닫는다. */
  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-detail]')) chatClose();
    if (e.target.classList.contains('sheet-handle')) chatClose();
  });

  const back = document.querySelector('#chat-backdrop');
  if (back) back.addEventListener('click', chatClose);

  chatBindFab();
  const bar = document.querySelector('#home-ask');
  if (bar) bar.addEventListener('click', () => chatOpen());
  const closeBtn = document.querySelector('#btn-chat-close');
  if (closeBtn) closeBtn.addEventListener('click', chatClose);

  /* ⚠️ 다른 시트와 달리 **쓸어내려 닫기를 붙이지 않는다.**
     enableSheetSwipe는 '시트가 맨 위에 있을 때 아래로 끌면 닫기'인데, 도우미는 시트 자체가
     스크롤되지 않고 **안쪽 대화 목록이** 스크롤된다. 그래서 시트의 scrollTop이 늘 0이라
     대화를 위로 올려 보려고 손가락을 내릴 때마다 시트가 닫힌다(학교 목록에서 손가락이
     닿자마자 선택되던 것과 같은 계열의 함정). 닫기는 ✕ · 손잡이 · 바깥 누르기 · Esc 네 가지로 충분하다. */

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) chatClose();
  });
}

/* 온보딩 화면에서는 떠 있는 버튼을 감춘다 — 프로필이 없으면 답할 재료가 없다.
   화면 전환은 app.js showScreen이 #bottom-nav를 숨기는 것으로 알 수 있다. */
function chatSyncFab() {
  const fab = document.querySelector('#btn-chat-fab');
  const nav = document.querySelector('#bottom-nav');
  if (!fab || !nav) return;
  const was = fab.hidden;
  fab.hidden = nav.hidden;
  if (was && !fab.hidden) {
    const saved = chatFabSaved();
    if (saved) chatFabPlace(saved);
    /* 알림 동의 시트가 온보딩 2.9초 뒤에 뜨므로 그보다 늦게 — 두 안내가 겹치면 둘 다 안 읽힌다 */
    setTimeout(() => {
      const sheetOpen = ['#notify-sheet', '#detail-sheet', '#chat-sheet']
        .some((s) => { const el = document.querySelector(s); return el && !el.hidden; });
      if (!sheetOpen) chatHintMaybeShow();
    }, 6000);
  }
}

if (typeof document !== 'undefined' && document.querySelector('#chat-sheet')) {
  chatBind();
  chatSyncFab();
  const nav = document.querySelector('#bottom-nav');
  if (nav && typeof MutationObserver !== 'undefined') {
    new MutationObserver(chatSyncFab).observe(nav, { attributes: true, attributeFilter: ['hidden'] });
  }
}

/* Node(검사 도구)에서도 규칙만 따로 불러 볼 수 있게 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { chatTokens, chatRoute, chatSearch, chatAnswerUnknown, CHAT_SUGGESTIONS };
}
