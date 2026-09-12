/** 인스타 카드 사실 관문 — 145건 전수로 잰다.
 *  🔴 여기서 잡는 것은 전부 **실제로 났던 사고**다(2026-09-09 코드 리뷰).
 *     고친 것이 되돌아오면 이 검사가 빨간불이 된다. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = join(__dirname, '..');
const raw = readFileSync(join(ROOT, 'insta/render.mjs'), 'utf8');
// 🔴 바깥 판형 파일(insta/templates/*.mjs)도 같은 잣대로 본다 — 새 출처를 붙일 때 관문이 안 따라가면 그 판형은 아무도 안 보는 것과 같다.
const TPL_DIR = join(ROOT, 'insta/templates');
const tplFiles = require('node:fs').existsSync(TPL_DIR) ? require('node:fs').readdirSync(TPL_DIR).filter((f) => f.endsWith('.mjs')).map((f) => join(TPL_DIR, f)) : [];
const tplRaw = tplFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
// 🔴 주석을 빼고 본다 — 안 그러면 '이렇게 하면 안 된다' 는 설명까지 위반으로 잡는다(실제로 그랬다).
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const src = strip(raw);
const tplSrc = strip(tplRaw);
// 🔴 교외만 재면 교내가 무방비다 — 새 출처를 붙일 때 관문이 안 따라가면 그 출처는
//    아무도 안 보는 것과 같다. `insta/notices.mjs` 가 '무엇을 올릴 수 있나' 의 한 곳이다.
let items = [], meta = {};


// 렌더러에서 규칙을 이름으로 떼어 온다 — 베끼면 갈라진다
const pick = (name, re) => { const m = raw.match(re); if (!m) throw new Error(`${name} 를 render.mjs 에서 못 찾음`); return m; };
const NEG = eval(pick('NEG', /const NEG = (\/.+?\/);/)[1]);
const clamp = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const dropParen = eval('(' + pick('dropParen', /const dropParen = (\(t\) => t[\s\S]*?\.trim\(\));/)[1] + ')');
const tidy = (s) => String(s || '').replace(/:{2,}/g, ':').replace(/\s{2,}/g, ' ').trim();
const bullets = (s) => String(s || '').split(/\s*○\s*/)
  .map((t) => tidy(t.replace(/\s*※\s*자세한 사항은[^○]*$/, ''))).filter(Boolean).filter((t) => !/기관확인필요/.test(t));

let bad = 0;
const fail = (tag, org, why) => { bad++; console.log(`  ✗ [${tag}] ${org} — ${why}`); };
const today = new Date();

(async function main() {
  ({ items, meta } = await (await import(new URL('../insta/notices.mjs', `file://${__filename}`).href)).allNotices());
  const 교내 = items.filter((x) => x.school).length;
  console.log('■ 인스타 카드 사실 관문 —', items.length, `건 (교외 ${items.length - 교내} · 교내 ${교내})`);

  // C1 · 마감 지난 공고를 '모집 중' 이라 하지 않는다
  {
    let past = 0;
    for (const x of items) {
      if (!x.due) continue;
      const t = new Date(x.due + 'T23:59:59+09:00').getTime();
      if (!Number.isNaN(t) && t - today < 0) past++;
    }
    if (!/state: 'past'/.test(src)) fail('C1', '-', "dday 가 '지남' 을 따로 안 가른다");
    // 🔴 몇 시간 전에 지난 마감이 `Math.round` 때문에 `-0` 이 돼 최대 12시간 동안
    //    '오늘 마감' 으로 살아 있었다(2026-09-11 실측). 시각으로 먼저 갈라야 한다.
    const dday0 = eval('(' + pick('dday', /const dday = (\(due, today\) => \{[\s\S]*?\n\});/)[1] + ')');
    const at = new Date('2026-09-11T00:20:00+09:00');
    for (const [due, want] of [['2026-09-10', 'past'], ['2026-09-11', 'open'], ['2026-09-18', 'open']]) {
      const got = dday0(due, at).state;
      if (got !== want) fail('C1', '-', `마감 ${due} 판정이 ${want} 가 아니라 ${got}`);
    }
    // 🔴 남은 날은 달력 날짜 차이다 — 9/11 에서 9/18 은 D-7. 시각 차를 반올림하면 하루 밀린다.
    if (dday0('2026-09-18', at).d !== 7) fail('C1', '-', `9/11→9/18 이 D-7 이 아니라 D-${dday0('2026-09-18', at).d}`);
    if (dday0('2026-09-11', at).d !== 0) fail('C1', '-', '오늘 마감이 D-0 이 아니다');
    if (/'모집 중'/.test(src)) fail('C1', '-', "'모집 중' 문구가 아직 남아 있다");
    console.log(`  · 마감 지난 공고 ${past}건 — '마감 지남' 으로 표시되는지 확인`);
  }
  // C2 · 금지어 · 학위 조건을 안 보는 표지 문구 (바깥 판형 파일도 같이)
  for (const w of ['무조건', '역대급', '꿀팁', '안 보면 손해'])
    for (const [name, t] of [['render.mjs', src], ['templates/', tplSrc]])
      if (t.includes(`'${w}`) || t.includes(`>${w}`)) fail('C2', name, `금지어 '${w}' 가 남아 있다`);
  // C3 · 개별 학생 판정 문구
  for (const w of ['신청 가능한 장학금', '받을 수 있어요', '해당됩니다'])
    for (const [name, t] of [['render.mjs', src], ['templates/', tplSrc]])
      if (t.includes(w)) fail('C3', name, `판정 문구 '${w}' 가 남아 있다`);
  // C4 · '분할' 을 '매달' 로 읽지 않는다
  {
    const monthly = eval(pick('monthly', /const monthly = (\/.+?\/)\.test/)[1]);
    for (const x of items) {
      const raw = (x.fields || {})['지원금액'] || '';
      if (/분할/.test(raw) && !/매월|매달/.test(raw) && monthly.test(raw))
        fail('C4', x.org, `'분할' 을 매달로 읽음 — ${tidy(raw).slice(0, 40)}`);
    }
  }
  // C5 · 사실 줄을 자르지 않는다 — 자르면 뜻이 뒤집히거나 조항이 사라진다
  // 🔴 2026-09-09 개발자 지시로 **자르기를 통째로 없앴다**("말 끊기지 말라했지").
  //    버리는 것은 지어내는 것과 같은 거짓이라, 대신 fitAll 이 글자를 줄여 전문을 담는다.
  {
    // 사실 줄에 자르기가 되살아나면 잡는다 — 이름이 뭐든 `…` 를 붙이는 함수는 못 쓴다.
    for (const m of raw.matchAll(/(who|traps|arr|L)\.map\(\(t[,)][^\n]*/g))
      if (/\bclamp/.test(m[0])) fail('C5', '-', `사실 줄을 자른다 — ${m[0].trim().slice(0, 60)}`);
    if (/const clamp\w* = /.test(src)) fail('C5', '-', '자르는 함수가 되살아났다');
    if (!/shrinkToFit/.test(src)) fail('C5', '-', '브라우저 축소를 안 한다 — 긴 줄을 담을 방법이 없다');
    // 🔴 render.mjs 를 import 하는 쪽(이 관문·캡션)이 브라우저를 요구하면 안 된다 —
    //    CI 는 playwright-core 만 깔아서 `Cannot find package 'playwright'` 로 죽는다.
    //    로컬은 통과하고 CI 만 빨간불인 유형이라 여기서 막는다.
    if (/^import .*from 'playwright'/m.test(raw))
      fail('C5', '-', "render.mjs 가 최상단에서 playwright 를 부른다 — CLI 안에서 동적으로 부를 것");
    // 🔴 곁가지 괄호는 context 한 곳에서만 걷는다 — 쓰는 쪽마다 부르면 한 판형만 빠뜨려도
    //    카드와 캡션이 다른 글을 보여 준다(실제로 카톡만 빠뜨린 적이 있다).
    if (!/who: whoLines\(f\)\.map\(dropParen\)/.test(src) || !/traps: bullets\(f\['자격제한'\]\)\.map\(dropParen\)/.test(src))
      fail('C5', '-', 'context 가 who·traps 에 dropParen 을 안 건다');
    // 🔴 축소 규칙은 insta/fit.mjs 한 곳. 베껴 두면 렌더는 초록불인데 검사만 빨간불이 된다.
    for (const f of ['insta/render.mjs', 'insta/sweep-overflow.mjs']) {
      const t = readFileSync(join(ROOT, f), 'utf8');
      if (/getBoundingClientRect/.test(t)) fail('C5', '-', `${f} 가 축소 규칙을 베꼈다 — fit.mjs 를 쓸 것`);
      if (!/from '\.\/fit\.mjs'/.test(t)) fail('C5', '-', `${f} 가 fit.mjs 를 안 쓴다`);
    }
    // 🔴 괄호를 걷어내다 부정어를 잃으면 그것부터가 사고다.
    const whoLines0 = eval('(' + pick('whoLines', /const whoLines = (\([^)]*\) => (?:\{[\s\S]*?\n\}|[^\n]+));/)[1] + ')');
    for (const x of items) {
      const f = x.fields || {};
      for (const t of [...bullets(f['자격제한']), ...whoLines0(f)]) {
        const d = dropParen(t);
        if (NEG.test(t) && !NEG.test(d)) fail('C5', x.org, `괄호를 걷다 부정어를 잃음 — ${d.slice(0, 40)}`);
      }
    }
  }
  // C6 · 지역·소득 조건이 조용히 사라지지 않는다
  // 🔴 규칙을 베껴 쓰면 코드를 되돌려도 초록불이 된다(실제로 그랬다) — 렌더러에서 떼어 온다.
  {
    const whoLines = eval('(' + pick('whoLines', /const whoLines = (\([^)]*\) => (?:\{[\s\S]*?\n\}|[^\n]+));/)[1] + ')');
    for (const x of items) {
      const f = x.fields || {};
      const who = whoLines(f);
      for (const [name, key] of [['지역', '지역거주구분'], ['소득', '소득기준']]) {
        const b = bullets(f[key]);
        if (b.length && !who.includes(b[0])) fail('C6', x.org, `${name} 조건이 빠짐`);
      }
    }
  }
  // C7 · 폰트 가드가 정직한가 (check() 만 쓰면 폰트가 없어도 통과한다)
  if (!/arr\.length > 0/.test(src) || !/document\.fonts\.size > 0/.test(src))
    fail('C7', '-', 'load() 결과 길이를 안 본다 — 폰트가 없어도 통과한다');
  // I2 · 자격제한 없는 공고에 빈 경고 카드를 그리지 않는다
  {
    const none = items.filter((x) => !bullets((x.fields || {})['자격제한']).length).length;
    if (!/traps\.length \?/.test(src)) fail('I2', '-', '조항 없는 공고에도 4장을 그린다');
    for (const f of tplFiles) if (!/traps\.length \?/.test(strip(readFileSync(f, 'utf8')))) fail('I2', f.split('/').pop(), '바깥 판형이 조항 없는 공고에도 경고 장을 그린다');
    console.log(`  · 자격제한 없는 공고 ${none}건 — 4장을 빼는지 확인`);
  }
  // I8 · CC BY·BY-SA 사진의 저작자·라이선스가 실제로 카드에 나간다
  {
    const P = JSON.parse(readFileSync(join(ROOT, 'insta/photos.json'), 'utf8'));
    for (const [k, v] of Object.entries(P)) for (const x of v) {
      if (!x.by || !x.lic || x.lic === '?') fail('I8', k, `저작자·라이선스가 빈 사진 — ${x.url.slice(0, 60)}`);

    }
    if (!/photo\.by/.test(src) || !/photo\.lic/.test(src)) fail('I8', '-', '카드가 저작자·라이선스를 안 그린다');
    // 🔴 잘린 길이를 세면 그때 그 사고 하나만 잡는다. **자르지 않는다는 규칙**을 본다 —
    //    26자 스텀프를 잡던 검사는 27자짜리를 그냥 통과시켰다.
    const fp = readFileSync(join(ROOT, 'insta/find-photos.mjs'), 'utf8');
    for (const m of fp.matchAll(/by:[^\n]*/g))
      if (/slice\(/.test(m[0])) fail('I8', '-', `저작자 이름을 자른다 — ${m[0].trim().slice(0, 60)}`);
  }
  // I5 · 신청기간을 자르지 않는다
  if (/clamp\(bullets\(f\['신청기간'\]\)\[0\]/.test(src)) fail('I5', '-', '신청기간을 자른다 — 날짜가 사라질 수 있다');

  // C8 · 캡션 — 카드와 같은 사실 규칙이 걸린다
  // 🔴 캡션은 사람이 눈으로 보는 마지막 관문이 없다(카드는 그림이라 보게 된다).
  //    그래서 여기서 세게 잡는다. 규칙은 caption.mjs 를 **실제로 돌려서** 확인한다.
    const cap = await import(new URL('../insta/caption.mjs', `file://${__filename}`).href);
    const rnd = await import(new URL('../insta/render.mjs', `file://${__filename}`).href);
    const { caption, LIMIT, SHORTEN, FIXED_TAGS, SCHOOL_TAG } = cap;
    let made = 0, past = 0;
    const caps = [];
    for (const x of items) {
      const seed = [...(x.org + x.name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
      // 🔴 마감 지난 공고는 캡션이 **만들어지면 안 된다** — 첫 줄이 신청하라는 말이라
      //    지난 공고에 붙이면 그 자체가 거짓이다. 안 만드는 것까지가 규칙이다.
      const gone = x.due && new Date(`${x.due}T23:59:59+09:00`).getTime() < today;
      let t;
      const c0 = rnd.context(x, today, rnd.SKINS.blue, seed, null);
      try { t = caption(x, c0, meta); } catch (e) { past++; continue; }
      if (gone) { fail('C8', x.org, `마감 지난 공고(${x.due})에 캡션을 만들었다`); continue; }
      made++;
    caps.push(t);
      if (t.length > LIMIT.chars) fail('C8', x.org, `캡션이 ${t.length}자 — 인스타 상한 ${LIMIT.chars}`);
      const tags = t.match(/#[^\s#]+/g) || [];
      if (tags.length > LIMIT.tags) fail('C8', x.org, `해시태그 ${tags.length}개 — 상한 ${LIMIT.tags}`);
      if (tags.length < 6) fail('C8', x.org, `해시태그 ${tags.length}개 — 너무 적다`);
      // 🔴 카드에서 금지한 말은 캡션에서도 금지다(C2·C3).
      for (const w of ['무조건', '역대급', '꿀팁', '안 보면 손해', '받을 수 있어요', '해당됩니다'])
        if (t.includes(w)) fail('C8', x.org, `캡션에 금지어 '${w}'`);
      // 🔴 사실 줄을 자르지 않는다 — 카드와 같은 규칙.
      if (/…/.test(t)) fail('C8', x.org, '캡션에서 글이 잘렸다(…)');
      // 🔴 게시물은 피드에 남는데 이미지는 굳는다 — '지금' 을 말하면 마감 뒤 거짓이 된다.
      for (const w of ['현재 모집', '모집 중', '오늘까지', '내일 마감', '이번 주 마감'])
        if (t.includes(w)) fail('C8', x.org, `캡션이 '지금' 을 말한다 ('${w}') — 게시물은 남는다`);
      // 🔴 캡션에 자격·조항 **원문을 옮겨 적지 않는다**(2026-09-10 개발자 결정).
      //    카드가 이미 전부 싣는데 캡션이 또 쓰면 공고문이 되고, 궁금증을 여기서 풀어 주면
      //    카드를 넘길 이유도 앱을 열 이유도 사라진다. 개수는 사실이라 써도 된다.
      //    ⚠️ **첫 줄은 뺀다** — 거기는 표지 카드와 같은 후킹이고, 따옴표로 감싼 인용이다.
      //       빼지 않으면 `자격에 딱 한 줄 "세대주가 만 65세 이하"` 가 위반으로 잡힌다.
      const body = t.split('\n').slice(1).join('\n');
      for (const line of [...c0.who, ...c0.traps])
        if (line.length > 12 && body.includes(line.slice(0, 12)))
          fail('C8', x.org, `캡션이 원문을 옮겨 적었다 — ${line.slice(0, 24)}…`);
      // 🔴 접히기 전 두 줄에 프로필 안내가 없으면 앱으로 가는 통로가 사라진다.
      if (!t.split('\n').slice(0, 2).join(' ').includes('프로필')) fail('C8', x.org, '1·2줄에 프로필 안내가 없다');
      // 🔴 **고정 태그도 그 공고에 대해 참이어야 한다.** 2026-09-11 첫 실전 카드가
      //    한국외대 교내 공고인데 `#교외장학금` 과 `#경희대장학금` 을 달고 나갔다.
      //    '늘 붙이는 태그' 라는 이유로 사실 검사에서 빠져 있던 자리다.
      if (x.school) {
        if (tags.includes('#교외장학금')) fail('C8', x.org, '교내 공고인데 #교외장학금 이 붙었다');
        for (const [sch, tg] of Object.entries(SCHOOL_TAG))
          if (sch !== x.school && tags.includes(tg))
            fail('C8', x.org, `${x.school} 공고인데 ${tg} 이 붙었다`);
      } else if (tags.includes('#교내장학금')) {
        fail('C8', x.org, '교외 공고인데 #교내장학금 이 붙었다');
      }
      // 🔴 지역 태그는 재단 이름으로 확인된 것만 — `#반드시장학금` 이 실제로 나왔다.
      for (const tag of tags) {
        // 🔴 고정 태그 목록은 caption.mjs 것을 **받아 쓴다** — 여기 베껴 두면
        //    태그를 바꿀 때 한쪽만 고쳐져, 멀쩡한 태그가 '근거 없음' 으로 잡힌다.
        if (FIXED_TAGS.includes(tag)) continue;
        const m = tag.match(/^#(.+)장학금$/);
        if (!m) continue;
        // 긴 이름도 근거로 친다(경상남도장학회 ↔ #경남장학금). 축약표는 caption.mjs 것을 받아 쓴다.
        const own = `${x.org}${x.name}`.replace(/\s/g, '');
        const stem = m[1].replace(/(시|군|구)$/, '');
        const long = Object.keys(SHORTEN).find((k) => SHORTEN[k] === stem);
        if (!own.includes(stem) && !(long && own.includes(long)))
          fail('C8', x.org, `근거 없는 지역 태그 ${tag}`);
      }
    }
    // 🔴 매 게시물이 한 글자도 안 다르면 봇 티가 난다. 자리마다 **실제로 돌아가는지** 잰다 —
  //    첫 판은 목록마다 같은 씨앗을 써서 변주들이 서로 붙어 다녔다(두 공고가 통째로 같았다).
  {
    const slot = (re) => new Set(caps.map((t) => (t.match(re) || [''])[0]).filter(Boolean));
    for (const [name, re, least] of [
      ['저장 유도', /^.*저장.*📌.*$/m, 3],
      ['앱 안내', /^(?:"나는 되나\?" 싶으면|자격 하나하나 보기 귀찮으면|본인이 되는지 3초면 나와요)$/m, 3],
      ['마무리', /^(?:장학금 찾는 시간|놓쳐서 못 받는|이번 학기 등록금|찾다 지치지).*$/m, 3],
    ]) {
      const got = slot(re).size;
      if (got < least) fail('C8', '-', `캡션 '${name}' 이 ${got}종뿐 — 매번 같은 말이면 봇 티가 난다`);
    }
    // 🔴 변주가 서로 붙어 다니면 안 된다 — 두 공고의 저장 줄이 같다고 마무리까지 같으면
    //    씨앗을 목록마다 안 섞은 것이다(실측으로 겪었다).
    const pair = new Map();
    let stuck = 0;
    for (const t of caps) {
      const a = (t.match(/^.*저장.*📌.*$/m) || [''])[0];
      const b = (t.match(/^(?:장학금 찾는 시간|놓쳐서 못 받는|이번 학기 등록금|찾다 지치지).*$/m) || [''])[0];
      if (pair.has(a) && pair.get(a) !== b) stuck = -1;
      else if (!pair.has(a)) pair.set(a, b);
    }
    if (stuck === 0 && pair.size > 1) fail('C8', '-', '캡션 변주가 서로 붙어 다닌다 — 목록마다 씨앗을 섞을 것');
  }
  console.log(`  · 캡션 ${made}건 · 마감 지나 거부 ${past}건`);

    // C9 · 게시 경로 — 되돌릴 수 없는 것이라 여기서 세게 막는다
    const pub = readFileSync(join(ROOT, 'insta/publish.mjs'), 'utf8');
    const pickSrc = readFileSync(join(ROOT, 'insta/pick.mjs'), 'utf8');   // 🔴 바깥 pick() 과 이름이 겹치면 TDZ 로 죽는다
    const wf = readFileSync(join(ROOT, '.github/workflows/insta.yml'), 'utf8');
    const ig = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    // 🔴 기본이 예행연습이어야 한다 — 실수로 브랜드 계정에 올라가는 길을 안 만든다.
    if (!/--publish/.test(pub) || !/if \(!live\)/.test(pub))
      fail('C9', '-', '게시가 기본으로 실행된다 — --publish 를 줘야만 올라가야 한다');
    // 🔴 인스타는 JPEG 만 받는다. PNG 를 주면 컨테이너 만들기에서 막힌다.
    if (!/\.jpg/.test(pub) || /\.png/.test(pub))
      fail('C9', '-', '게시가 PNG 를 올린다 — 인스타는 JPEG 만 받는다');
    if (!/type: 'jpeg'/.test(src)) fail('C9', '-', '렌더러가 JPEG 를 안 뽑는다');
    // 🔴 Pages 배포 전에 컨테이너를 만들면 인스타가 404 를 받고 조용히 실패한다.
    //    ⚠️ 함수가 **있는지**가 아니라 **부르는지**를 봐야 한다 — 주석 처리해도 정의는 남는다.
    //    🔴 그리고 **올리는 길 안에서** 불러야 한다. `--wait-only` 처럼 안 올리는 길에도
    //       같은 줄이 생기면서, 파일 어디든 한 줄 있으면 통과하던 검사가 그 미끼를 보고
    //       초록불이 됐다(2026-09-11 리뷰에서 red-green 으로 드러남). publish() 안만 본다.
    const publishBody = pub.slice(pub.indexOf('export async function publish'));
    if (!/^\s*await waitLive\(/m.test(publishBody)
        || publishBody.indexOf('await waitLive(') > publishBody.indexOf('is_carousel_item'))
      fail('C9', '-', '올리기 전에 그림이 공개됐는지 확인하지 않는다');
    // 🔴 올린 것을 기억 못 하면 내일 같은 공고를 다시 올린다(이슈 #75 유형).
    if (!/seen\.json/.test(pickSrc) || !/writeSeen/.test(pub))
      fail('C9', '-', 'seen.json 에 기록하지 않는다 — 같은 공고를 다시 올리게 된다');
    // 🔴 게시용 그림은 커밋돼야 Pages 가 서빙한다. 무시되면 인스타가 가져갈 주소가 없다.
    if (/^insta\/pub/m.test(ig)) fail('C9', '-', 'insta/pub 이 .gitignore 에 있다 — 공개 주소가 죽는다');
    // 🔴 시간 초과는 '실패' 가 아니라 '취소' 다 — 둘 다 잡아야 조용히 안 죽는다.
    if (!/failure\(\) \|\| cancelled\(\)/.test(wf)) fail('C9', '-', '워크플로가 취소를 안 잡는다');
    if (!/timeout-minutes/.test(wf)) fail('C9', '-', '워크플로에 timeout-minutes 가 없다');
  // 🔴 실패를 단계 요약에만 적으면 **아무도 안 본다** — 수동 실행 워크플로는 더 그렇다.
  //    이 저장소의 다른 로봇들과 같게 이슈로 사람을 부른다.
  if (!/gh issue create/.test(wf)) fail('C9', '-', '게시 워크플로가 실패를 이슈로 안 알린다');
  if (!/issues: write/.test(wf)) fail('C9', '-', '게시 워크플로에 이슈 권한이 없다');
    // 🔴 게시 단계가 다시 그리면 관리자가 본 것과 다른 공고가 올라간다.
    const pubJob = wf.slice(wf.indexOf('  publish:'));
    const prepJob = wf.slice(wf.indexOf('  prepare:'), wf.indexOf('  publish:'));
    if (/render\.mjs/.test(pubJob)) fail('C9', '-', '게시 단계가 다시 그린다 — 준비된 것만 올려야 한다');
    // 🔴 **예약은 준비까지만이다.** 예약 실행에는 inputs 가 통째로 없어서 `inputs.step` 이
    //    빈 값이 된다 — 그러니 게시 작업의 조건은 **긍정형**이어야 꺼진다. `!startsWith`
    //    로 뒤집는 순간 매주 아무도 안 본 카드가 브랜드 계정으로 나간다. 되돌릴 수 없다.
    //    안내문에 적는 것은 리포트다(CLAUDE.md) — 여기서 강제한다.
    if (/schedule:/.test(wf)) {
      if (!/if: \$\{\{ startsWith\(inputs\.step, '게시'\) \}\}/.test(pubJob))
        fail('C9', '-', '예약이 게시까지 간다 — 게시 조건이 긍정형 startsWith 가 아니다');
      if (/--publish/.test(prepJob))
        fail('C9', '-', '준비 작업이 --publish 를 쓴다 — 예약이 사람 없이 올리게 된다');
    }
    // 🔴 주소를 워크플로에 베끼지 말 것 — publish.mjs 가 유일한 집이다(그 파일 머리말).
    //    베끼면 기다리는 주소와 이슈에 박는 주소가 갈라져, 확인은 초록불인데 깨진 그림이 간다.
    if (/github\.io\/hanggonggan/.test(wf))
      fail('C9', '-', '워크플로에 공개 주소가 박혀 있다 — publish.mjs 에서 받아 써야 한다');
    // C10 · 토큰 만료 감시 — 🔴 만료되면 **조용히** 게시가 멈춘다(노션 F-4 와 같은 유형).
  //    못 물어본 것을 '괜찮다' 로 읽으면 두 달 뒤에나 안다. 갈래를 전부 시험한다.
  {
    const { tokenState, WARN_DAYS, LIFE_DAYS, fingerprint } =
      await import(new URL('../insta/token-days.mjs', `file://${__filename}`).href);
    const mk = (body, ok = true) => async () => ({ ok, json: async () => body });
    // 🔴 `graph.instagram.com` 에는 debug_token 이 없다 — 살아 있는지는 **물어서** 알고,
    //    남은 날은 **우리가 처음 본 날**에서 센다. 두 축을 따로 시험한다.
    const before = process.env.IG_ACCESS_TOKEN;
    process.env.IG_ACCESS_TOKEN = 'tok-시험';
    const T0 = Date.parse('2026-09-11T00:00:00Z');
    const mem = (v) => ({ read: () => v, write: (x) => Object.assign(v, x) });
    const aged = (n) => ({ fp: fingerprint('tok-시험'),
      firstSeen: new Date(T0 - n * 864e5).toISOString().slice(0, 10) });
    const live = mk({ user_id: '1' });
    const want = [
      ['처음 보는 토큰', live, {}, 'ok'],
      ['넉넉함', live, aged(LIFE_DAYS - 40), 'ok'],
      ['문턱 하루 전', live, aged(LIFE_DAYS - WARN_DAYS - 1), 'ok'],
      ['문턱 당일', live, aged(LIFE_DAYS - WARN_DAYS), 'expiring'],
      ['우리가 본 지 60일', live, aged(LIFE_DAYS), 'dead'],
      ['토큰이 거부됨', mk({ error: { message: 'bad' } }, false), {}, 'dead'],
      ['계정을 못 가리킴', mk({}), {}, 'dead'],
      ['못 물어봄', async () => { throw new Error('ENOTFOUND'); }, {}, 'dead'],
    ];
    for (const [name, f, store, expect] of want) {
      const got = (await tokenState(f, mem({ ...store }), T0)).state;
      if (got !== expect) fail('C10', '-', `토큰 판정 '${name}' 이 ${expect} 가 아니라 ${got}`);
    }
    // 🔴 **토큰 자체를 파일에 적으면 안 된다** — 공개 저장소다. 지문만 남는지 본다.
    {
      const box = {};
      await tokenState(live, { read: () => ({}), write: (v) => Object.assign(box, v) }, T0);
      if (JSON.stringify(box).includes('tok-시험')) fail('C10', '-', '기록장에 토큰이 그대로 적힌다');
      if (box.fp !== fingerprint('tok-시험')) fail('C10', '-', '토큰 지문을 안 적는다 — 바뀐 것을 못 알아챈다');
    }
    // 🔴 토큰이 바뀌면 **날수를 다시 센다** — 안 그러면 새 토큰이 하루 만에 죽었다고 한다.
    {
      const r = await tokenState(live, mem({ fp: 'ffffffff', firstSeen: '2026-01-01' }), T0);
      if (r.days !== LIFE_DAYS) fail('C10', '-', `새 토큰인데 ${r.days}일로 센다 — 60일이어야 한다`);
    }
    process.env.IG_ACCESS_TOKEN = '';
    if ((await tokenState(live, mem({}), T0)).state !== 'none') fail('C10', '-', '토큰이 없는데 none 이 아니다');
    if (before === undefined) delete process.env.IG_ACCESS_TOKEN; else process.env.IG_ACCESS_TOKEN = before;
    /* 🔴 **토큰이 없는 것을 '살아 있음' 이라고 말하지 않는다** (2026-09-12 인수인계 중 발견).
       위 줄은 `state` 만 본다. 그런데 손으로 돌려 보는 사람이 읽는 것은 그 아래 **한국어 줄**이고,
       그 줄이 `none` 에서도 '살아 있음 · null일 남음 (처음 본 날 undefined)' 이라고 답했다 —
       시크릿을 아직 안 넣은 사람에게 넣었다고 말하는 것이다(원칙 8-1 · 「매 세션」 5번).
       ⚠️ 워크플로는 셸에서 먼저 걸러 이 줄에 안 닿으므로 **초록불로는 안 드러난다.**
       그래서 파일을 읽지 않고 **실제로 돌려서** 사람이 보는 글자를 본다. */
    {
      const r = spawnSync(process.execPath, [join(ROOT, 'insta/token-days.mjs')],
        { encoding: 'utf8', env: { ...process.env, IG_ACCESS_TOKEN: '' } });
      const said = `${r.stdout || ''}${r.stderr || ''}`;
      if (!/state=none/.test(said)) fail('C10', '-', '토큰 없이 돌렸는데 state=none 이 아니다 (검사가 헛돈다)');
      if (/살아 있음/.test(said)) fail('C10', '-', '토큰이 없는데 「살아 있음」이라고 말한다');
      if (/undefined|null일/.test(said)) fail('C10', '-', '토큰이 없을 때 빈 값을 그대로 찍는다');
    }
    // 🔴 Instagram Login 경로다 — 페이스북 호스트로 돌아가면 페이지 없는 계정에서 죽는다.
    const tdSrc = readFileSync(join(ROOT, 'insta/token-days.mjs'), 'utf8');
    const pubSrc2 = readFileSync(join(ROOT, 'insta/publish.mjs'), 'utf8');
    for (const [f, src] of [['token-days.mjs', tdSrc], ['publish.mjs', pubSrc2]]) {
      if (!/graph\.instagram\.com/.test(src)) fail('C10', '-', `${f} 가 graph.instagram.com 을 안 쓴다`);
      if (/graph\.facebook\.com/.test(src)) fail('C10', '-', `${f} 에 graph.facebook.com 이 남아 있다`);
      // ⚠️ 낱말이 아니라 **부르는 꼴**을 본다 — 주석에 "debug_token 은 없다" 라고 적어 둔 것이
      //    걸려서 빨간불이 났다. 부르는 곳은 `graph('debug_token'` 이거나 `debug_token?` 이다.
      if (/debug_token['"]|debug_token\?/.test(src))
        fail('C10', '-', `${f} 가 debug_token 을 부른다 — 그 경로엔 없다`);
    }
    const tw = readFileSync(join(ROOT, '.github/workflows/insta-token-check.yml'), 'utf8');
    if (!/schedule:/.test(tw)) fail('C10', '-', '토큰 확인이 예약으로 안 돈다 — 사람이 기억해야 하면 안 돈다');
    if (!/issues: write/.test(tw)) fail('C10', '-', '토큰 확인이 이슈를 못 만든다');
    // 🔴 **로봇이 고친 파일은 저장 목록에 넣는 것까지가 한 세트다**(CLAUDE.md · 이슈 #79 유형).
    //    처음 본 날을 안 적으면 매일 '오늘이 1일째'가 돼 남은 날이 영영 60일로 굳고,
    //    만료를 조용히 지나친다 — 이 로봇이 막으라고 있는 바로 그 일이다.
    if (!/contents: write/.test(tw)) fail('C10', '-', '토큰 확인이 기록을 저장할 권한이 없다');
    if (!/git add insta\/token-seen\.json/.test(tw))
      fail('C10', '-', '토큰 확인이 처음 본 날을 저장하지 않는다 — 남은 날이 영영 60일로 굳는다');
    if (!/git push/.test(tw)) fail('C10', '-', '토큰 확인이 기록을 올리지 않는다');
    if (/^insta\/token-seen/m.test(ig)) fail('C10', '-', 'token-seen.json 이 .gitignore 에 있다');
    console.log(`  · 토큰 감시 — 갈래 ${want.length}가지 · 수명 ${LIFE_DAYS}일 · 경고 ${WARN_DAYS}일 · 매일 예약`);
  }
  console.log('  · 게시 경로 — 예행연습 기본 · JPEG · 공개 확인 · seen 기록 · 다시 안 그림');

  // C11 · 2026-09-12 개발자 지시 여섯 — 공고당 게시물 하나 · 생기면 바로 · 개발자 셋 · 번호 판형 · 채팅 수정 · 관리자 화면
  {
    const { loadTemplates, resolveTpl } = rnd;
    const reg = JSON.parse(readFileSync(join(ROOT, 'insta/templates.json'), 'utf8')).templates;
    // 번호는 고정 · 1부터 빈틈없이 · 파일이 실제로 있고 모양이 맞는가 (loadTemplates 가 던지면 그것이 실패다)
    const nos = reg.map((t) => t.no);
    if (nos.join() !== nos.map((_, i) => i + 1).join()) fail('C11', '-', `판형 번호가 1부터 빈틈없이 이어지지 않는다 — ${nos.join(',')}`);
    let ALL = null;
    try { ALL = await loadTemplates(); } catch (e) { fail('C11', '-', `판형 목록을 못 읽는다 — ${e.message}`); }
    if (ALL) {
      for (const t of reg) {
        const got = resolveTpl(ALL, String(t.no));
        if (!got || got.id !== t.id) fail('C11', '-', `${t.no}번이 ${t.id} 를 가리키지 않는다`);
        if (!Array.isArray(got?.fonts) || got.fonts.length < 1) fail('C11', t.id, '확인할 글꼴이 없다 — 두부(□)가 나가도 초록불이 된다');
        // 바깥 판형은 카드를 실제로 만들어 본다 — 사실 재료 밖의 글자를 지어내지 않는지는 사람이 보지만, 최소한 2~10장은 나와야 한다
        if (!got.builtin) {
          const x = items.find((y) => y.due && !((y.fields || {})['자격제한'] === '')) || items[0];
          const c0 = rnd.context(x, today, rnd.SKINS.blue, 7, x.school || null);
          const cards = got.cards(c0, rnd.KIT);
          if (!Array.isArray(cards) || cards.length < 2 || cards.length > 10) fail('C11', t.id, `카드가 ${cards?.length}장 — 캐러셀은 2~10장`);
          if (!/\.card/.test(got.css(rnd.SKINS.blue, rnd.KIT))) fail('C11', t.id, 'css 에 .card 가 없다 — 렌더러가 카드를 못 찾는다');
          if (!cards.some((h) => /data-fit/.test(h))) fail('C11', t.id, '사실 줄에 data-fit 이 없다 — 긴 원문이 잘린다');
        }
      }
    }
    // 팀 셋 — 이슈 담당자(github)와 메일(email) 둘 다
    const team = JSON.parse(readFileSync(join(ROOT, 'insta/team.json'), 'utf8')).people;
    if (team.length < 3) fail('C11', '-', `팀이 ${team.length}명 — 개발자 셋 전부여야 한다`);
    for (const p of team) if (!p.github || !/@/.test(p.email || '')) fail('C11', p.name, 'github 또는 email 이 비었다');
    // 워크플로 — 수집 뒤 바로 · 담당자는 team.json 에서 · 예약이 게시까지 안 간다(C9) · 알림 push-to-run
    if (!/workflow_run:/.test(wf) || !/'장학공고 수집 로봇'/.test(wf)) fail('C11', '-', '수집 로봇이 끝나도 카드를 안 그린다 — workflow_run 이 없다');
    if (!/team\.json/.test(wf) || /--assignee didinin-wq/.test(wf)) fail('C11', '-', '담당자를 team.json 에서 읽지 않는다(한 사람만 지정)');
    if (!/insta\/run-notify\.txt/.test(wf)) fail('C11', '-', '채팅에서 고친 카드를 다시 알리는 push-to-run 통로가 없다');
    if (!/ledger\.mjs prepared/.test(wf)) fail('C11', '-', '그린 것을 준비 장부에 안 적는다 — 다음 실행이 같은 공고를 또 그린다');
    if (!/pick\.mjs --new/.test(wf)) fail('C11', '-', '새 공고 전부가 아니라 하나만 고른다');
    const ml = readFileSync(join(ROOT, 'insta/mail.mjs'), 'utf8');
    if (!/team\.json/.test(ml)) fail('C11', '-', 'mail.mjs 가 받는 사람을 team.json 에서 읽지 않는다');
    // 관리자 화면 — step 글자가 워크플로 선택지와 한 글자도 다르지 않은가 (다르면 422 로 조용히 죽는다)
    const adm = readFileSync(join(ROOT, '_admin/admin.js'), 'utf8');
    const opts = (wf.match(/options: \[([^\]]*)\]/) || ['', ''])[1].split(',').map((x) => x.trim());
    for (const m of adm.matchAll(/INSTA_STEP = \{([\s\S]*?)\};/g)) for (const v of m[1].matchAll(/'([^']+)'/g))
      if (!opts.includes(v[1])) fail('C11', '-', `관리자 화면의 step '${v[1]}' 이 insta.yml 선택지에 없다`);
    if (!/screen-insta/.test(readFileSync(join(ROOT, '_admin/index.html'), 'utf8'))) fail('C11', '-', '관리자 화면에 인스타 탭이 없다');
    // 채팅 수정 도구·스킬 — 그림을 보여 주고 **묻는다**
    const rv = readFileSync(join(ROOT, 'insta/revise.mjs'), 'utf8');
    if (/--publish|smtps:|mail\.mjs/.test(rv)) fail('C11', '-', 'revise.mjs 가 메일을 보내거나 게시한다 — 보여 주고 묻는 것까지가 이 도구다');
    if (!/preview\.mjs/.test(rv)) fail('C11', '-', 'revise.mjs 가 미리보기 그림을 안 만든다 — 보여 줄 것이 없다');
    for (const sk of ['insta-revise', 'insta-template']) {
      const f = join(ROOT, `.claude/skills/${sk}/SKILL.md`);
      if (!require('node:fs').existsSync(f)) { fail('C11', '-', `스킬 ${sk} 이 없다`); continue; }
      const t = readFileSync(f, 'utf8');
      if (sk === 'insta-revise' && !/보낼까요/.test(t)) fail('C11', '-', 'insta-revise 스킬이 메일 발송 전에 묻지 않는다');
      if (sk === 'insta-template' && !/new-template\.mjs/.test(t)) fail('C11', '-', 'insta-template 스킬이 시작 파일 도구를 안 쓴다');
    }
    // 트랙션·댓글 — 가짜 서버로 한 바퀴 (토큰은 서버에만 · 한 게시물 실패가 전체를 비우지 않는다 · 답글은 --do 없이는 안 나간다)
    {
      const st = await import(new URL('../insta/stats.mjs', `file://${__filename}`).href);
      const cm = await import(new URL('../insta/comments.mjs', `file://${__filename}`).href);
      const before = process.env.IG_ACCESS_TOKEN;
      process.env.IG_ACCESS_TOKEN = 'tok-시험';
      const box = {};
      const store = { read: () => ({ history: [{ at: '2026-09-11', followers: 10 }], posts: [] }), write: (v) => Object.assign(box, v), seen: () => ({ posted: [{ code: 'A', media: '111', org: 'o', name: 'n' }] }) };
      const fk = async (u) => {
        const s = String(u);
        const j = (b) => ({ ok: true, json: async () => b });
        if (/\/me\?/.test(s)) return j({ username: 'handaejang', followers_count: 12, media_count: 1 });
        if (/me\/media/.test(s)) return j({ data: [{ id: '111', permalink: 'https://www.instagram.com/p/x/', timestamp: '2026-09-12T00:00:00+0000', like_count: 3, comments_count: 1, media_type: 'CAROUSEL_ALBUM' }, { id: '222', timestamp: '2026-09-10T00:00:00+0000', like_count: 1 }] });
        if (/111\/insights/.test(s)) return j({ data: [{ name: 'reach', values: [{ value: 40 }] }, { name: 'saved', values: [{ value: 5 }] }] });
        if (/222\/insights/.test(s)) return { ok: false, json: async () => ({ error: { message: 'no insights' } }) };
        if (/111\/comments/.test(s)) return j({ data: [{ id: '9', text: '되나요?', username: 'stu', timestamp: '2026-09-12T01:00:00+0000', like_count: 0, hidden: false, replies: { data: [] } }] });
        if (/9\/replies/.test(s)) return j({ id: '99' });
        throw new Error('unexpected ' + s);
      };
      const r = await st.harvest(fk, store, Date.parse('2026-09-12T03:00:00Z'));
      if (r.state !== 'ok' || box.posts?.length !== 2) fail('C11', '-', `트랙션 수확이 게시물 2건을 안 적는다 (${r.state} · ${box.posts?.length})`);
      const bad = (box.posts || []).find((p) => p.id === '222');
      if (!bad || !bad.error || bad.reach !== null) fail('C11', '-', '반응을 못 받은 게시물을 0 으로 적거나 버린다 — 실패는 error 칸에 남아야 한다');
      if ((box.posts || []).find((p) => p.id === '111')?.code !== 'A') fail('C11', '-', '올린 장부(seen.posted)의 공고 코드를 게시물에 잇지 않는다');
      if ((box.history || []).length !== 2 || box.history[1].followers !== 12) fail('C11', '-', '팔로워 이력을 하루 한 줄로 덧붙이지 않는다');
      if (JSON.stringify(box).includes('tok-시험')) fail('C11', '-', 'stats.json 에 토큰이 적힌다');
      const cbox = {};
      const cstore = { read: () => ({ items: [{ id: '9', handledAt: '2026-09-11 10:00' }] }), write: (v) => Object.assign(cbox, v), seen: store.seen };
      const cr = await cm.fetchAll(fk, cstore, Date.parse('2026-09-12T03:00:00Z'));
      if (cr.state !== 'ok' || cbox.items?.[0]?.id !== '9') fail('C11', '-', '댓글을 받아 적지 않는다');
      if (cbox.items?.[0]?.handledAt !== '2026-09-11 10:00') fail('C11', '-', '받아 적을 때 우리 표식(handledAt)을 지운다 — 답한 댓글이 매번 새 댓글로 되살아난다');
      const dry = await cm.act('reply', { comment: '9', text: '안녕하세요' }, false, fk, cstore);
      if (!dry.dry) fail('C11', '-', '--do 없이 답글이 나간다');
      const live = await cm.act('reply', { comment: '9', text: '안녕하세요' }, true, fk, { read: () => ({ items: [{ id: '9' }] }), write: (v) => Object.assign(cbox, v), seen: store.seen }, Date.parse('2026-09-12T03:00:00Z'));
      if (live.dry || live.id !== '99' || !cbox.items?.[0]?.handledAt) fail('C11', '-', '답글을 보낸 뒤 처리 표식을 안 남긴다');
      let threw = false; try { await cm.act('reply', { comment: 'x9', text: 'a' }, true, fk, cstore); } catch { threw = true; }
      if (!threw) fail('C11', '-', '댓글 ID 가 숫자가 아닌데 보낸다');
      if (before === undefined) delete process.env.IG_ACCESS_TOKEN; else process.env.IG_ACCESS_TOKEN = before;
      // 토큰은 서버에만 — 관리자 화면이 인스타에 직접 묻지 않는다
      // ⚠️ 시크릿 **이름**은 안내 문구에 나와도 된다 — 부르는 꼴(호스트·access_token 파라미터)만 본다
      if (/graph\.instagram\.com|access_token=/.test(adm)) fail('C11', '-', '관리자 화면이 인스타에 직접 묻거나 토큰을 쓴다');
      for (const f of ['insta-stats.yml', 'insta-comments.yml', 'insta-samples.yml']) {
        const w = readFileSync(join(ROOT, `.github/workflows/${f}`), 'utf8');
        if (!/timeout-minutes/.test(w)) fail('C11', f, 'timeout-minutes 가 없다');
        if (!/failure\(\) \|\| cancelled\(\)/.test(w)) fail('C11', f, '취소를 안 잡는다');
      }
      const cw = readFileSync(join(ROOT, '.github/workflows/insta-comments.yml'), 'utf8');
      if (!/reply.*--do/.test(cw)) fail('C11', '-', '댓글 워크플로가 --do 없이 답글을 부른다(예행연습만 된다)');
    }
    // 못 그린 공고는 7일 쉬었다 다시 뜬다 — 바로 다시 뽑히면 나머지를 굶긴다(코드 리뷰)
    {
      const { candidates } = await import(new URL('../insta/pick.mjs', `file://${__filename}`).href);
      const t0 = Date.parse('2026-09-12T03:00:00Z');
      const fake = [{ code: 'F1', org: 'o', name: 'n', due: '2026-09-30', fields: { 지원금액: '100만원' } },
        { code: 'F2', org: 'o', name: 'n', due: '2026-09-30', fields: { 지원금액: '100만원' } }];
      const seenF = { posted: [], prepared: [
        { code: 'F1', status: 'failed', failedAt: '2026-09-11' },   // 어제 실패 — 아직 쉰다
        { code: 'F2', status: 'failed', failedAt: '2026-09-01' }] };  // 열하루 전 — 다시 뜬다
      const got = candidates(fake, t0, seenF, { unpreparedOnly: true }).ok.map((c) => c.x.code);
      if (got.includes('F1') || !got.includes('F2')) fail('C11', '-', `실패한 공고의 재시도 간격이 틀리다 — 뽑힌 것 ${got.join(',') || '없음'}`);
      if (!/ledger\.mjs failed/.test(wf)) fail('C11', '-', '워크플로가 못 그린 공고를 장부에 안 적는다');
    }
    console.log(`  · 2026-09-12 지시 — 판형 ${reg.length}벌(번호 고정) · 팀 ${team.length}명 · 수집 뒤 바로 · 관리자 화면 · 트랙션·댓글 가짜 서버 한 바퀴`);
  }
    console.log(bad ? `\n🚨 ${bad}건 실패` : '\n✅ 전부 통과');
    process.exit(bad ? 1 : 0);

})();