/* ============================================================
   작성 규칙 학습 로봇 (2026-08-23 개발자 승인)

   하는 일: 공개된 '좋은 장학 자기소개서 쓰는 법' 글을 읽어
            **규칙 후보 문장만** 뽑고, 우리 규칙 어휘에 붙인다.

   🔴 예시문을 저장하지 않는다. 규칙만 배운다.
      이유(조사로 확인): ① 장학재단은 표절률 검사를 엄격히 하고, 예시문이 공개된 곳이
      곧 표절 도구가 크롤링하는 문서 더미다 ② 남의 글이라 저작권 ③ 모두가 같은 예시를
      보면 결과가 오히려 획일화된다. 경위 전문: docs/designs/essay-tailoring.md
      → 저장소에 남는 것: **주소 · 본 날짜 · 어느 규칙에 붙었는지**. 원문은 안 남는다.

   🔴 Claude API 를 쓰지 않는다 (개발자 지시: API 사용 최대한 회피). 규칙 매칭만 한다.

   🔴 이 샌드박스에서는 한국 사이트가 막혀 있다(403). **GitHub Actions 에서 돈다** —
      학교 게시판을 읽는 수집 로봇들과 같은 사정이다.

   실행:  node collector/essay-playbook-learn.mjs          미리보기 (저장 안 함)
          node collector/essay-playbook-learn.mjs --write  data/essay-playbook.json 갱신
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const WRITE = process.argv.includes('--write');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').slice(8)) || 20;

const SOURCES = rd('collector/essay-sources.json');
const PLAYBOOK = rd('data/essay-playbook.json');

/* ── 우리 규칙 어휘 ──
   글에서 뽑은 문장이 **이미 아는 규칙**을 말하고 있으면 그 규칙에 출처만 붙인다.
   어느 규칙에도 안 붙으면 '새 규칙 후보'로 리포트에만 올린다(운영 원칙 2 — 컨펌).
   🔴 여기서 규칙 문장을 새로 쓰지 않는다. 사람이 컨펌한 것만 규칙집에 들어간다. */
const VOCAB = {
  'lead-first': [/두괄식/, /결론부터/, /첫\s*문장/, /맨\s*앞에.*핵심/, /핵심을?\s*먼저/],
  'show-dont-tell': [/성실합니다/, /공허/, /말하기만/, /~한\s*사람입니다/, /규정하지/, /단정적/],
  'concrete-scene': [/구체적/, /수치/, /장면/, /사례/, /경험을?\s*들어/, /에피소드/],
  'answer-the-question': [/질문을?\s*(꼼꼼히|정확히)/, /묻는\s*것에/, /문항/, /질문에\s*맞는/],
  'know-the-foundation': [/재단/, /취지/, /설립\s*목적/, /인재상/, /선발\s*기준/, /미리\s*공부/],
  'direction': [/방향성/, /목표/, /계획/, /진로/, /포부/],
  'no-cliche': [/진부/, /상투/, /흔한\s*표현/, /남발/, /속담/, /명언/, /금칙어/, /금지어/],
  'no-self-pity': [/부정적인\s*표현/, /자기\s*비하/, /낮추는/, /겸손/],
  'motive-need-then-plan': [/지원\s*동기/, /신청\s*사유/, /왜\s*필요/],
  'growth-lesson': [/성장\s*과정/, /가정\s*환경/, /어린\s*시절/],
  'character-evidence': [/장단점|장\s*·?\s*단점/, /성격/, /강점/],
  'future-steps': [/장래/, /향후/, /졸업\s*후/],
  'study-measurable': [/학업\s*계획/, /학습\s*계획/],
  'share-specific': [/나눔/, /환원/, /사회\s*공헌/, /기여/],
  'use-itemized': [/사용\s*계획/, /사용처/, /어디에\s*쓸/],
  'episode-star': [/STAR/i, /상황.*행동.*결과/, /경험\s*기술/],
  'message-short': [/간결/, /짧게/, /담백/],
};

/* 규칙처럼 생긴 문장인가 — 목록 항목이거나 권고·금지형 어미로 끝난다 */
const LISTY = /^\s*(?:[-–—·•●▶▸◆■□▣①②③④⑤⑥⑦⑧⑨⑩]|\d{1,2}[.)])\s*/;
const ADVICE = /(하세요|해야|하지\s*마|하지\s*말|것이\s*좋|중요합?니다|피하|권장|필수|금물|안\s*됩니다|주의)/;

/* 규칙 후보로 볼 수 없는 줄 — 게시판 껍데기·광고·목차 */
const JUNK = /(로그인|회원가입|댓글|조회수|구독|광고|저작권|무단전재|이전\s*글|다음\s*글|목차|바로가기|앱\s*다운|카카오|공유하기|스크랩)/;

/** HTML 에서 글자만 — 태그를 지우고 줄로 자른다 */
function toLines(html) {
  const body = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return body.split(/\n+/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/** 이 줄이 규칙 후보인가 */
function isCandidate(line) {
  const t = line.replace(LISTY, '').trim();
  if (t.length < 8 || t.length > 120) return null;
  if (JUNK.test(t)) return null;
  if (!/[가-힣]/.test(t)) return null;
  const listy = LISTY.test(line);
  if (!listy && !ADVICE.test(t)) return null;
  return t;
}

/** 이 문장이 어느 규칙을 말하고 있나 */
function matchRule(text) {
  const hits = [];
  for (const [code, pats] of Object.entries(VOCAB)) {
    if (pats.some((re) => re.test(text))) hits.push(code);
  }
  return hits;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      /* 학교 게시판을 읽을 때와 같은 방식 — 사람이 브라우저로 여는 것처럼 */
      'user-agent': 'Mozilla/5.0 (compatible; handaejang-playbook/1.0; +https://github.com/seonju5543-web/hanggonggan)',
      'accept-language': 'ko-KR,ko;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ── 본편 ── */
const seeds = (SOURCES.seeds || []).slice(0, LIMIT);
const report = [];
const newSrc = new Map();      // sourceId -> {url,title,seenAt}
const ruleHits = new Map();    // ruleCode -> Set(sourceId)
const candidates = [];         // 어느 규칙에도 안 붙은 것 — 컨펌 대기
let okCount = 0, failCount = 0;

const existingUrls = new Set((PLAYBOOK.sources || []).map((s) => s.url));
let nextId = (PLAYBOOK.sources || []).length + 1;

for (const seed of seeds) {
  let lines;
  try {
    lines = toLines(await fetchPage(seed.url));
    okCount++;
  } catch (e) {
    failCount++;
    report.push(`  ✗ ${seed.url}\n      못 읽음: ${String(e.message).slice(0, 80)}`);
    continue;
  }

  const found = new Map();     // code -> 그 규칙을 말한 문장 수
  const unmatched = [];
  for (const line of lines) {
    const t = isCandidate(line);
    if (!t) continue;
    const codes = matchRule(t);
    if (codes.length) for (const c of codes) found.set(c, (found.get(c) || 0) + 1);
    else if (unmatched.length < 6) unmatched.push(t);
  }

  /* 출처 등록 — 규칙을 하나라도 뒷받침했을 때만 */
  let sid = (PLAYBOOK.sources || []).find((s) => s.url === seed.url)?.id;
  if (!sid && found.size) { sid = `s${nextId++}`; newSrc.set(sid, { id: sid, title: seed.note || seed.url, url: seed.url, seenAt: new Date().toISOString().slice(0, 10) }); }
  if (sid) for (const c of found.keys()) {
    if (!ruleHits.has(c)) ruleHits.set(c, new Set());
    ruleHits.get(c).add(sid);
  }

  report.push(`  ✓ ${seed.url}\n      줄 ${lines.length} · 규칙을 뒷받침한 것 ${found.size}종`
    + (found.size ? ` (${[...found.keys()].join(', ')})` : '')
    + (unmatched.length ? `\n      🆕 어느 규칙에도 안 붙은 문장 ${unmatched.length}개 — 컨펌 대기` : ''));
  for (const u of unmatched) candidates.push({ url: seed.url, text: u });
}

/* ── 규칙이 모자란 종류를 큐에 올린다 (미학습 양식이 생기면 계속 배운다) ── */
const kindsWithRules = new Set(PLAYBOOK.rules.filter((r) => r.kind !== '*').map((r) => r.kind));
const ALL_KINDS = ['motive', 'intro', 'growth', 'character', 'value', 'study', 'future', 'share', 'use', 'effect', 'idea', 'episode', 'message'];
const thin = ALL_KINDS.filter((k) => !kindsWithRules.has(k));

/* ── 저장 ── */
let added = 0;
if (WRITE && (newSrc.size || ruleHits.size)) {
  PLAYBOOK.sources = (PLAYBOOK.sources || []).concat([...newSrc.values()]);
  for (const r of PLAYBOOK.rules) {
    const hits = ruleHits.get(r.code);
    if (!hits) continue;
    const src = new Set(r.src || []);
    for (const s of hits) if (!src.has(s)) { src.add(s); added++; }
    r.src = [...src];
  }
  PLAYBOOK.updatedAt = new Date().toISOString().slice(0, 10);
  PLAYBOOK.version = (PLAYBOOK.version || 1) + 1;
  fs.writeFileSync(path.join(ROOT, 'data/essay-playbook.json'), JSON.stringify(PLAYBOOK, null, 2) + '\n');
}
SOURCES.queue = thin;
if (WRITE) fs.writeFileSync(path.join(ROOT, 'collector/essay-sources.json'), JSON.stringify(SOURCES, null, 2) + '\n');

/* ── 리포트 ── */
const md = [
  `# 작성 규칙 학습 — ${new Date().toISOString().slice(0, 10)}`,
  '',
  `읽은 곳 ${okCount}곳 · 못 읽은 곳 ${failCount}곳 · 규칙에 붙은 출처 ${added}건`,
  '',
  '## 읽은 곳',
  ...report,
  '',
  '## 🆕 어느 규칙에도 안 붙은 문장 — 개발자 컨펌 대기',
  candidates.length
    ? '아래는 **규칙 후보**입니다. 규칙집에 넣을지는 사람이 정합니다(운영 원칙 2).\n'
      + '넣기로 하면 우리 말로 다시 적어 `data/essay-playbook.json` 의 `rules` 에 추가합니다 — 원문을 그대로 옮기지 않습니다.\n'
      + candidates.slice(0, 40).map((c) => `- ${c.text}\n  <sub>${c.url}</sub>`).join('\n')
    : '없습니다.',
  '',
  '## 규칙이 모자란 종류',
  thin.length ? thin.map((k) => `- \`${k}\` — 이 종류 전용 규칙이 없습니다. 관련 글 주소를 \`collector/essay-sources.json\` 의 seeds 에 넣어 주세요.`).join('\n') : '없습니다.',
  '',
  '---',
  '🔴 원문은 저장하지 않습니다. 남는 것은 주소·본 날짜·어느 규칙에 붙었는지뿐입니다(저작권).',
].join('\n');

fs.writeFileSync(path.join(ROOT, 'collector/essay-playbook-report.md'), md + '\n');
console.log(md);
console.log(`\n${WRITE ? '저장했습니다' : '미리보기 — 저장하려면 --write'}`);
