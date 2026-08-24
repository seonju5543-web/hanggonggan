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
import { isCandidate, linkCandidates, parseRobots, robotsBlocks, toLines, naverMobile } from './essay-rule-line.mjs';

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
  'consistency': [/통일성/, /일관성/, /한\s*방향/, /끝까지\s*이어/],
  'plain-sentence': [/군더더기/, /주어와\s*서술어/, /수식어/, /간결한\s*문장/],
};

/** 이 문장이 어느 규칙을 말하고 있나 */
function matchRule(text) {
  const hits = [];
  for (const [code, pats] of Object.entries(VOCAB)) {
    if (pats.some((re) => re.test(text))) hits.push(code);
  }
  return hits;
}

/* 우리가 누구인지 밝힌다 — 몰래 읽지 않는다 */
const UA = 'Mozilla/5.0 (compatible; handaejang-playbook/1.0; +https://github.com/seonju5543-web/hanggonggan)';
async function fetchPage(url) {
  /* 네이버 블로그는 모바일 주소로 바꿔 읽는다 — 데스크톱은 프레임 껍데기만 온다 */
  const res = await fetch(naverMobile(url), {
    redirect: 'follow',
    headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/* ============================================================
   ── 스스로 넓히기 (2026-08-24 개발자 지시) ──
   "현재의 크롤링 결과와 출처에 안주하지 말고 계속해서 출처를 넓힐 방안을 찾아.
    사용자의 직접적인 양식 제시 없이."

   그래서 로봇이 **읽은 페이지에서 다음에 읽을 곳을 스스로 찾는다.**
     ① 읽은 글 안의 링크 중 제목·주소가 이 주제인 것만 후보로 줍는다
     ② 그 집의 robots.txt 를 먼저 보고, 막아 둔 곳은 읽지 않는다
     ③ 실행당 몇 곳만 새로 읽는다 (한 번에 몰아치지 않는다 — 남의 서버다)
     ④ 규칙을 하나라도 준 곳은 seeds 로 승격, 아무것도 못 준 곳은 tried 에 적어
        30일 동안 다시 가지 않는다 — 안 그러면 매번 같은 헛걸음을 되풀이한다

   🔴 여전히 원문은 저장하지 않는다. 넓어지는 것은 **어디를 읽었나**뿐이다.
   ============================================================ */
const GROW_PER_RUN = Number(process.env.GROW_PER_RUN || 6);
const RETRY_AFTER_DAYS = 30;
const robotsCache = new Map();
async function robotsAllows(url) {
  let u; try { u = new URL(url); } catch { return false; }
  const host = u.origin;
  if (!robotsCache.has(host)) {
    let rules = [];
    try {
      const res = await fetch(`${host}/robots.txt`, { headers: { 'user-agent': UA } });
      if (res.ok) rules = parseRobots(await res.text());
    } catch { rules = []; }   /* robots.txt 를 못 읽으면 막지 않는다 (없는 집이 흔하다) */
    robotsCache.set(host, rules);
  }
  return !robotsBlocks(robotsCache.get(host), url);
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

const grow = [];               // 읽은 글에서 주운, 다음에 읽을 만한 곳
const yieldedUrls = new Set();  // 이번 실행에서 규칙을 하나라도 준 주소 (seed 건강 점검용)
const today = new Date().toISOString().slice(0, 10);

/** 주소 하나를 읽어 규칙에 붙인다. 규칙을 하나라도 준 곳만 출처가 된다. */
async function readOne(url, note) {
  let html;
  try {
    html = await fetchPage(url);
    okCount++;
  } catch (e) {
    failCount++;
    report.push(`  ✗ ${url}\n      못 읽음: ${String(e.message).slice(0, 80)}`);
    return { ok: false, found: new Map() };
  }
  const lines = toLines(html);
  for (const c of linkCandidates(html, url)) grow.push(c);

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
  let sid = (PLAYBOOK.sources || []).find((x) => x.url === url)?.id;
  if (!sid && found.size) { sid = `s${nextId++}`; newSrc.set(sid, { id: sid, title: note || url, url, seenAt: today }); }
  if (found.size) yieldedUrls.add(url);
  if (sid) for (const c of found.keys()) {
    if (!ruleHits.has(c)) ruleHits.set(c, new Set());
    ruleHits.get(c).add(sid);
  }

  report.push(`  ✓ ${url}\n      줄 ${lines.length} · 규칙을 뒷받침한 것 ${found.size}종`
    + (found.size ? ` (${[...found.keys()].join(', ')})` : '')
    + (unmatched.length ? `\n      🆕 어느 규칙에도 안 붙은 문장 ${unmatched.length}개 — 컨펌 대기` : ''));
  for (const u of unmatched) candidates.push({ url, text: u });
  return { ok: true, found };
}

for (const seed of seeds) await readOne(seed.url, seed.note);

/* ── 스스로 넓히기 — 주운 곳 중 몇 곳만 새로 읽는다 ── */
SOURCES.tried = Array.isArray(SOURCES.tried) ? SOURCES.tried : [];
const known = new Set((SOURCES.seeds || []).map((x) => x.url));
const parked = new Map(SOURCES.tried.map((t) => [t.url, t]));
const stale = (d) => (Date.now() - Date.parse(d || 0)) / 86400000 > RETRY_AFTER_DAYS;

const fresh = [];
const seenGrow = new Set();
for (const c of grow) {
  if (known.has(c.url) || seenGrow.has(c.url)) continue;
  const p = parked.get(c.url);
  if (p && !stale(p.seenAt)) continue;      /* 지난번에 헛걸음한 곳 — 아직 다시 안 간다 */
  seenGrow.add(c.url);
  fresh.push(c);
}

const grown = [];
const barred = [];
for (const c of fresh) {
  if (grown.length >= GROW_PER_RUN) break;
  if (!(await robotsAllows(c.url))) { barred.push(c.url); continue; }
  const r = await readOne(c.url, c.text);
  grown.push({ url: c.url, text: c.text, rules: r.found.size });
  if (r.found.size) {
    /* 규칙을 준 곳은 seeds 로 승격 — 다음 실행부터 정식으로 읽는다.
       🔴 지속가능성: seeds 가 무한정 불어나면 매 실행이 길어지고, 규칙을 더는 안 주는
          죽은 주소가 쌓인다. 상한(MAX_SEEDS)을 두고, 꽉 찼으면 **가장 약한 seed 를
          밀어내야만** 새것이 들어온다(그 판정은 아래 seed 건강 점검이 한다). */
    if (!known.has(c.url)) {
      (SOURCES.seeds = SOURCES.seeds || []).push({ url: c.url, kind: '*', note: `로봇이 스스로 찾음 — ${c.text}`.slice(0, 80), addedAt: today });
      known.add(c.url);
    }
    parked.delete(c.url);
  } else {
    /* 아무것도 못 준 곳은 적어 둔다 — 30일 동안 다시 가지 않는다 */
    parked.set(c.url, { url: c.url, seenAt: today, why: '규칙 0종' });
  }
}
SOURCES.tried = [...parked.values()].slice(-200);

/* ── 🔴 seed 건강 점검 — 지속가능성·오류예방 (2026-08-24 개발자 지시) ──
   "출처 넓히기 두 방법 좋다. 다만 지속가능성과 오류 예방 조치를 진행해라."

   자동 확장을 열어 두면 두 가지가 썩는다: ① seeds 가 끝없이 불어난다 ② 한때 규칙을
   주던 주소가 글이 바뀌거나 사라져 **죽은 seed** 로 남는다. 그래서 매 실행 건강을 잰다:
     · 이번 실행에서 규칙 0종이었던 seed 에 strike 를 +1 (regen 되면 0으로)
     · strike 가 STRIKE_OUT 이상이면 '시든 seed' 로 리포트에 올린다(사람이 지운다 —
       자동 삭제하지 않는다. registered.json 처럼 '삭제가 뜻을 갖는' 파일이라서다).
     · seeds 총수가 MAX_SEEDS 를 넘으면, 사람이 넣은 것(addedAt 없음)은 지키고
       **로봇이 스스로 넣은 것 중 가장 오래 시든 것**부터 리포트에 '밀어낼 후보'로 올린다.
   자동 삭제를 안 하는 이유: 그 주소가 개발자가 손수 넣은 좋은 글일 수 있고, 글이 잠깐
   접속 실패한 것과 영영 죽은 것을 로봇이 구별 못 한다. 판단은 사람에게 남긴다. */
const MAX_SEEDS = Number(process.env.MAX_SEEDS || 60);
const STRIKE_OUT = 3;
const withered = [];
for (const s of (SOURCES.seeds || [])) {
  /* 이번 실행에서 이 seed 를 실제로 읽었고 규칙을 못 줬을 때만 strike. 못 읽은 것(403 등)은
     주소가 죽은 게 아니라 잠깐 막힌 것일 수 있으므로 벌하지 않는다. */
  const read = okCount && seeds.some((x) => x.url === s.url);
  if (read && !yieldedUrls.has(s.url)) s.strike = (s.strike || 0) + 1;
  else if (yieldedUrls.has(s.url)) s.strike = 0;
  if ((s.strike || 0) >= STRIKE_OUT) withered.push(s);
}
const robotSeeds = (SOURCES.seeds || []).filter((s) => s.addedAt);
const overCap = (SOURCES.seeds || []).length > MAX_SEEDS
  ? robotSeeds.slice().sort((a, b) => (b.strike || 0) - (a.strike || 0)).slice(0, (SOURCES.seeds.length - MAX_SEEDS))
  : [];

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
  '## 스스로 넓히기 — 로봇이 읽은 글에서 다음에 읽을 곳을 주웠습니다',
  `주운 곳 ${fresh.length}곳 · 이번에 읽은 곳 ${grown.length}곳 · robots.txt 가 막아 건너뛴 곳 ${barred.length}곳`,
  '',
  grown.length
    ? grown.map((g) => `- ${g.rules ? '⬆️ seeds 로 승격' : '· 규칙 0종 — 30일 뒤 다시 시도'} ${g.url}\n  <sub>${g.text}</sub>`).join('\n')
    : '이번에 새로 읽은 곳이 없습니다.',
  '',
  '## 🩺 seed 건강 (지속가능성)',
  `살아 있는 seed ${(SOURCES.seeds || []).length}개 (상한 ${MAX_SEEDS}) · 이번 실행에서 규칙을 준 곳 ${yieldedUrls.size}개`,
  withered.length
    ? `\n**시든 seed — ${STRIKE_OUT}회 연속 규칙 0종.** 사람이 확인해 지워 주세요(자동 삭제 안 함):\n`
      + withered.map((s) => `- (${s.strike}회) ${s.url}`).join('\n')
    : '\n시든 seed 없음.',
  overCap.length
    ? `\n**seed 가 상한을 넘었습니다.** 밀어낼 후보(로봇이 넣은 것 중 가장 오래 시든 것):\n`
      + overCap.map((s) => `- ${s.url}`).join('\n')
    : '',
  '',
  '## 📌 다음에 크롤링할 출처 — 개발자 확인용 (정직 보고)',
  (SOURCES.nextCrawl && SOURCES.nextCrawl.plan)
    ? SOURCES.nextCrawl.note + '\n\n' + SOURCES.nextCrawl.plan.map((p) => `- **${p.where}** — ${p.how}`).join('\n')
    : '(nextCrawl 계획이 없습니다.)',
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
