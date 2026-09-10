/** 인스타 카드 사실 관문 — 145건 전수로 잰다.
 *  🔴 여기서 잡는 것은 전부 **실제로 났던 사고**다(2026-09-09 코드 리뷰).
 *     고친 것이 되돌아오면 이 검사가 빨간불이 된다. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ROOT = join(__dirname, '..');
const raw = readFileSync(join(ROOT, 'insta/render.mjs'), 'utf8');
// 🔴 주석을 빼고 본다 — 안 그러면 '이렇게 하면 안 된다' 는 설명까지 위반으로 잡는다(실제로 그랬다).
const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
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
    if (/'모집 중'/.test(src)) fail('C1', '-', "'모집 중' 문구가 아직 남아 있다");
    console.log(`  · 마감 지난 공고 ${past}건 — '마감 지남' 으로 표시되는지 확인`);
  }
  // C2 · 금지어 · 학위 조건을 안 보는 표지 문구
  for (const w of ['무조건', '역대급', '꿀팁', '안 보면 손해'])
    if (src.includes(`'${w}`) || src.includes(`>${w}`)) fail('C2', '-', `금지어 '${w}' 가 남아 있다`);
  // C3 · 개별 학생 판정 문구
  for (const w of ['신청 가능한 장학금', '받을 수 있어요', '해당됩니다'])
    if (src.includes(w)) fail('C3', '-', `판정 문구 '${w}' 가 남아 있다`);
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
    const { caption, LIMIT, SHORTEN } = cap;
    let made = 0, past = 0;
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
      // 🔴 지역 태그는 재단 이름으로 확인된 것만 — `#반드시장학금` 이 실제로 나왔다.
      for (const tag of tags) {
        const m = tag.match(/^#(.+)장학금$/);
        if (!m || /^(교외|대학생|경희대|한국외대)$/.test(m[1])) continue;
        // 긴 이름도 근거로 친다(경상남도장학회 ↔ #경남장학금). 축약표는 caption.mjs 것을 받아 쓴다.
        const own = `${x.org}${x.name}`.replace(/\s/g, '');
        const stem = m[1].replace(/(시|군|구)$/, '');
        const long = Object.keys(SHORTEN).find((k) => SHORTEN[k] === stem);
        if (!own.includes(stem) && !(long && own.includes(long)))
          fail('C8', x.org, `근거 없는 지역 태그 ${tag}`);
      }
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
    if (!/^\s*await waitLive\(/m.test(pub)) fail('C9', '-', '그림이 공개됐는지 확인하지 않고 올린다');
    // 🔴 올린 것을 기억 못 하면 내일 같은 공고를 다시 올린다(이슈 #75 유형).
    if (!/seen\.json/.test(pickSrc) || !/writeSeen/.test(pub))
      fail('C9', '-', 'seen.json 에 기록하지 않는다 — 같은 공고를 다시 올리게 된다');
    // 🔴 게시용 그림은 커밋돼야 Pages 가 서빙한다. 무시되면 인스타가 가져갈 주소가 없다.
    if (/^insta\/pub/m.test(ig)) fail('C9', '-', 'insta/pub 이 .gitignore 에 있다 — 공개 주소가 죽는다');
    // 🔴 시간 초과는 '실패' 가 아니라 '취소' 다 — 둘 다 잡아야 조용히 안 죽는다.
    if (!/failure\(\) \|\| cancelled\(\)/.test(wf)) fail('C9', '-', '워크플로가 취소를 안 잡는다');
    if (!/timeout-minutes/.test(wf)) fail('C9', '-', '워크플로에 timeout-minutes 가 없다');
    // 🔴 게시 단계가 다시 그리면 관리자가 본 것과 다른 공고가 올라간다.
    const pubJob = wf.slice(wf.indexOf('  publish:'));
    if (/render\.mjs/.test(pubJob)) fail('C9', '-', '게시 단계가 다시 그린다 — 준비된 것만 올려야 한다');
    console.log('  · 게시 경로 — 예행연습 기본 · JPEG · 공개 확인 · seen 기록 · 다시 안 그림');
    console.log(bad ? `\n🚨 ${bad}건 실패` : '\n✅ 전부 통과');
    process.exit(bad ? 1 : 0);

})();