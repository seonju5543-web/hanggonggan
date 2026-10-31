/* 자격 줄 전수 집계 — 열린 공고가 **무엇을 묻고, 무엇을 못 읽는가** (2026-10-31 · 적합도 신뢰도 고도화 5단계)

   왜 있나 — 10-24 에 온보딩 「적합도 높이기」 질문 7종을 고를 때 열린 공고 399곳을 손으로 세었다(설계 문서 academic-info-tailoring.md 4절).
   그 숫자는 공고가 바뀌면 낡는다. 그래서 같은 집계를 도구로 두고 수집 리포트가 한 줄로 싣는다 — 처지 종류별 공고 수가 바뀌면
   「질문 목록을 손볼 때」가 보이고, 조건을 하나도 못 읽는 줄 수가 늘면 파서가 새 꼴을 만난 것이다.

   무엇을 세나 — 화면이 실제로 보여 주는 자격 줄(match-engine requirementLines)을 parse-requirements 로 읽어
     · 공고 수: 조건 종류별(status·grade·trait…) · 처지 종류별(award·kosafApplied…) · 거주지 갈래별(home·origin·school)
     · 조건이 하나도 안 나온 줄(= 못 읽는 줄 · 자격이 아닌 줄도 섞여 있다 — 사람이 유형을 가른다)
   세 묶음 — 정식 등록(마감 전) · 층2 한국장학재단(열린 재단) · 대외활동·공모전(마감 전).
   🔴 판정 규칙을 베끼지 않는다 — 화면과 같은 함수(requirementLines · parseLine)를 부른다.
   ⚠️ 온보딩 질문 목록(elig-ask ONBOARD_TRAITS)을 여기서 바꾸지 않는다 — 숫자만 보인다. 바꾸는 것은 사람이다(10-31 권고).

   실행: node verify/eligibility-coverage.mjs            (묶음별 표)
         node verify/eligibility-coverage.mjs --brief    (수집 리포트용 한 줄)
         OUT=<폴더> node verify/eligibility-coverage.mjs --dump   (못 읽는 줄을 nocond-<묶음>.tsv 로 떨군다 — 2단계 유형 분류용) */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PR = require('../parse-requirements.js');
const ME = require('../match-engine.js');
const EA = require('../elig-ask.js');
const HERE = new URL('.', import.meta.url);
const readJson = (p) => JSON.parse(fs.readFileSync(new URL(p, HERE), 'utf8'));

/* 파일 자리는 환경변수로 바꿀 수 있다(관문이 표본으로 돌릴 때) · 없거나 못 읽으면 빈 묶음 — 이 도구 때문에 수집 로봇 관문이 빨개지면 안 된다(리뷰) */
const readItems = (envKey, rel) => {
  try { return readJson(process.env[envKey] ? `file://${process.env[envKey]}` : rel).items || []; } catch { return []; }
};
const reg = readItems('COVERAGE_REGISTERED', '../data/registered.json');
const kosaf = readItems('COVERAGE_KOSAF', '../data/kosaf-open.json');
const acts = readItems('COVERAGE_ACTIVITIES', '../data/activities.json');
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);   // KST
const open = (d) => !d || d >= today;
/* 층2 는 자격 줄이 재단 칸에 들어 있다 — **앱의 상수를 글자로 읽어 쓴다**(app.js `KOSAF_ELIG`·`kosafClean` 한 줄짜리 const · 베끼면 칸 수가 갈라진다 — 리뷰가 잡았다).
   줄 쪼개기는 앱이 쪼개는 모양(줄바꿈·○ 글머리)과 같게 두고, 앱이 버리는 `제한없음` 줄도 버린다 */
const appSrc = fs.readFileSync(new URL('../app.js', HERE), 'utf8');
const takeConst = (name) => { const m = appSrc.match(new RegExp(`^const ${name} = .*$`, 'm')); if (!m) throw new Error(`app.js 에서 ${name} 을 못 찾았습니다`); return m[0]; };
const appCtx = vm.createContext({ String, RegExp, Array });
vm.runInContext([takeConst('KOSAF_ELIG'), takeConst('kosafClean')].join('\n'), appCtx);
const KOSAF_ELIG = vm.runInContext('KOSAF_ELIG', appCtx);
const kosafClean = vm.runInContext('kosafClean', appCtx);
const split = (v) => String(v || '').split(/\n|\s*[○◦•·▪]\s+/).map((s) => kosafClean(s.trim())).filter((s) => s.length >= 4 && !/^제한\s?없음/.test(s));
const screenLines = (it, raw) => { try { return ME.requirementLines(it, raw, { all: true }) || []; } catch { return raw || []; } };

const SETS = {
  '정식 등록(마감 전)': reg.filter((s) => open(s.deadline)).map((s) => ({ name: s.name, lines: screenLines(s, null) })),
  /* 앱은 자격 칸(KOSAF_ELIG) + 제외 칸(`자격제한` → eligibilityExcludes · 화면 「이런 경우는 제외돼요」)을 학생에게 보인다 — 둘 다 센다(징계·중복수혜 줄이 제외 칸에 있다) */
  '층2 한국장학재단': kosaf.map((k) => ({ name: k.name, lines: [...KOSAF_ELIG, '자격제한'].flatMap((f) => split((k.fields || {})[f])) })),
  '대외활동·공모전(마감 전)': acts.filter((a) => open(a.deadline)).map((a) => ({ name: a.title, lines: screenLines(a, a.eligibilityLines || []) })),
};

export function coverage(sets = SETS) {
  const out = {};
  for (const [name, items] of Object.entries(sets)) {
    const kinds = new Map(), traits = new Map(), abouts = new Map(), noCond = new Map();
    let lines = 0;
    for (const it of items) {
      const k = new Set(), t = new Set(), a = new Set();
      for (const line of it.lines) {
        lines += 1;
        let conds = [];
        try { conds = PR.parseLine(line).conds || []; } catch { /* 못 읽는 줄은 아래 noCond 로 */ }
        if (!conds.length) { noCond.set(line, (noCond.get(line) || []).concat(it.name)); continue; }
        for (const c of conds) {
          k.add(c.kind);
          if (c.kind === 'trait') (c.anyOf || []).forEach((x) => t.add(x));
          if (c.kind === 'residence' && c.about) a.add(c.about);
        }
      }
      k.forEach((x) => kinds.set(x, (kinds.get(x) || 0) + 1));
      t.forEach((x) => traits.set(x, (traits.get(x) || 0) + 1));
      a.forEach((x) => abouts.set(x, (abouts.get(x) || 0) + 1));
    }
    out[name] = { notices: items.length, lines, kinds, traits, abouts, noCond };
  }
  return out;
}

/* 처지 종류별 공고 수 — 세 묶음 합 (온보딩 질문을 고른 잣대 「4곳 이상」을 사람이 다시 보게) */
export function traitTotals(cov) {
  const sum = new Map();
  for (const s of Object.values(cov)) for (const [k, n] of s.traits) sum.set(k, (sum.get(k) || 0) + n);
  return [...sum.entries()].sort((a, b) => b[1] - a[1]);
}

const top = (m, n = 99) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(' · ');

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const cov = coverage();
  const noCondTotal = Object.values(cov).reduce((a, s) => a + s.noCond.size, 0);
  const totals = traitTotals(cov);
  const asked = new Set(EA.ONBOARD_TRAITS || []);
  if (process.argv.includes('--brief')) {
    /* 수집 리포트용 한 줄 — 온보딩에서 묻는 처지가 4곳 미만이 되거나, 안 묻는 처지가 4곳 이상이면 「손볼 때」 */
    const under = totals.filter(([k, n]) => asked.has(k) && n < 4).map(([k, n]) => `${k} ${n}`);
    const over = totals.filter(([k, n]) => !asked.has(k) && n >= 4).map(([k, n]) => `${k} ${n}`);
    const flag = (under.length || over.length) ? ` · ⚠️ 온보딩 질문 목록 손볼 때 — 4곳 미만인데 묻는 것: ${under.join(', ') || '없음'} · 4곳 이상인데 안 묻는 것: ${over.join(', ') || '없음'}` : '';
    console.log(`- 자격 줄 전수: 공고 ${Object.values(cov).map((s) => s.notices).join('/')} · 조건을 하나도 못 읽는 줄 ${Object.values(cov).map((s) => s.noCond.size).join('/')} (등록/재단/활동 · 합 ${noCondTotal}) · 처지 상위 ${totals.slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ')}${flag}`);
    process.exit(0);
  }
  for (const [name, s] of Object.entries(cov)) {
    console.log(`\n■ ${name} — 공고 ${s.notices} · 자격 줄 ${s.lines} · 조건 0 줄 ${s.noCond.size}`);
    console.log(`   조건 종류(공고 수): ${top(s.kinds)}`);
    console.log(`   처지(공고 수): ${top(s.traits) || '없음'}`);
    console.log(`   거주지 갈래: ${top(s.abouts) || '없음'}`);
  }
  console.log(`\n■ 처지 종류별 공고 수 합 — 온보딩에서 묻는 것은 ★ (잣대: 4곳 이상 · 바꾸는 것은 사람)`);
  console.log('   ' + totals.map(([k, n]) => `${asked.has(k) ? '★' : ''}${k} ${n}`).join(' · '));
  if (process.argv.includes('--dump')) {
    const dir = process.env.OUT || '.';
    for (const [name, s] of Object.entries(cov)) {
      const file = `${dir}/nocond-${name.replace(/[^가-힣A-Za-z0-9]+/g, '-')}.tsv`;
      fs.writeFileSync(file, [...s.noCond.entries()].sort((a, b) => b[1].length - a[1].length).map(([l, names]) => `${names.length}\t${l}\t${names[0]}`).join('\n'));
      console.log(`   → ${file}`);
    }
  }
}
