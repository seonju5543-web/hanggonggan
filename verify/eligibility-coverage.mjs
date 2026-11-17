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
   줄 쪼개기도 앱의 한 줄(`kosafSplit` · ○ㅇ※ 글머리 · 앱이 버리는 `제한없음` 줄도 버린다)을 그대로 쓴다 — 따로 쪼갰더니 `※ 자세한 사항은 …` 꼬리가
   앞 줄에 붙어 **앱에 없는 줄**을 못 읽는 줄로 세고 있었다(2026-11-11 · 6차) */
const appSrc = fs.readFileSync(new URL('../app.js', HERE), 'utf8');
const takeConst = (name) => { const m = appSrc.match(new RegExp(`^const ${name} = .*$`, 'm')); if (!m) throw new Error(`app.js 에서 ${name} 을 못 찾았습니다`); return m[0]; };
const appCtx = vm.createContext({ String, RegExp, Array });
vm.runInContext([takeConst('KOSAF_ELIG'), takeConst('kosafClean'), takeConst('KOSAF_NOISE'), takeConst('kosafSplit')].join('\n'), appCtx);
const KOSAF_ELIG = vm.runInContext('KOSAF_ELIG', appCtx);
const kosafClean = vm.runInContext('kosafClean', appCtx);
const KOSAF_NOISE = vm.runInContext('KOSAF_NOISE', appCtx);   // 앱이 버리는 줄(`제한없음`·`기관확인필요`·`해당없음`)은 여기서도 버린다 — 규칙은 app.js 한 곳
const split = vm.runInContext('kosafSplit', appCtx);   // 앱 kosafAsScholarships 와 같은 줄 — kosafClean·KOSAF_NOISE 는 이 안에서 쓰인다
const screenLines = (it, raw) => { try { return ME.requirementLines(it, raw, { all: true }) || []; } catch { return raw || []; } };

const SETS = {
  '정식 등록(마감 전)': reg.filter((s) => open(s.deadline)).map((s) => ({ name: s.name, lines: screenLines(s, null) })),
  /* 앱은 자격 칸(KOSAF_ELIG) + 제외 칸(`자격제한` → eligibilityExcludes · 화면 「이런 경우는 제외돼요」)을 학생에게 보인다 — 둘 다 센다(징계·중복수혜 줄이 제외 칸에 있다) */
  /* 제외 칸 줄은 앱처럼 **제외 줄로** 읽는다(parseLine(…, true) · 2026-11-11 · 6차) — 학교 유형·국적 같은 제외 조항은 제외 줄에서만 조건이 나와, 자격 줄로 읽으면 다 '못 읽는 줄'로 셌다.
     자격 칸 줄도 다른 두 묶음처럼 화면 줄(requirementLines)을 거친다 — 앱이 버리는 잡음 줄(`자세한 사항은 … 참고`)을 못 읽는 줄로 세지 않게 */
  '층2 한국장학재단': kosaf.map((k) => ({ name: k.name,
    lines: screenLines({ name: `${k.org} ${k.name}`, provider: k.org }, KOSAF_ELIG.flatMap((f) => split((k.fields || {})[f]))),
    exLines: split((k.fields || {})['자격제한']) })),
  '대외활동·공모전(마감 전)': acts.filter((a) => open(a.deadline)).map((a) => ({ name: a.title, lines: screenLines(a, a.eligibilityLines || []) })),
};

export function coverage(sets = SETS) {
  const out = {};
  for (const [name, items] of Object.entries(sets)) {
    const kinds = new Map(), traits = new Map(), abouts = new Map(), noCond = new Map();
    let lines = 0;
    for (const it of items) {
      const k = new Set(), t = new Set(), a = new Set();
      for (const [line, ex] of [...it.lines.map((l) => [l, false]), ...(it.exLines || []).map((l) => [l, true])]) {
        lines += 1;
        let conds = [];
        try { conds = PR.parseLine(line, ex).conds || []; } catch { /* 못 읽는 줄은 아래 noCond 로 */ }
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

/* 가상 학생 셋의 카드·줄 판정 분포 (2026-11-15 · 1단계 '측정') — 파서를 고칠 때마다 '모름 n → m' 으로 비교하는 자. 앱 함수(fitDetail·requirementLines)를 그대로 부른다.
   학생 셋은 10-24~11-11 분석에 쓴 것과 같다(완전한 학생 · 약한 학생 · 이과) — 바꾸면 추이가 끊긴다. ※ 참고 줄(aside)은 분모가 아니라 세지 않는다. 숫자는 경고로만 쓴다(실데이터 고정 검사 금지) */
const BASE_STUDENT = { school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과', year: 3, status: '재학', gpa: 3.8, bracket: 5, credits: 15, region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {}, scholarships: [] };
export const STUDENTS = {
  '완전(외대3)': BASE_STUDENT,
  '약한(경희1)': { ...BASE_STUDENT, school: '경희대학교', major: '경영학과', track: 'social', year: 1, gpa: 2.0, bracket: 10, credits: 10, region: '제주', parentRegion: '제주' },
  '이과(연세2)': { ...BASE_STUDENT, school: '연세대학교', major: '기계공학과', track: 'engineering', year: 2, gpa: 3.2, bracket: 3, region: '부산', parentRegion: '부산' },
};
export function verdictDist(items, students = STUDENTS) {
  const live = (items || []).filter((s) => !s.program && open(s.deadline));
  const out = {};
  for (const [name, p] of Object.entries(students)) {
    const r = { cards: live.length, unread: 0, fail: 0, full: 0, partial: 0, lines: 0, ok: 0, no: 0, unknown: 0, noCond: 0 };
    for (const s of live) {
      const fd = ME.fitDetail(s, p);
      if (fd.unread) r.unread += 1; else if (fd.fails.length) r.fail += 1; else if (fd.unknown === 0) r.full += 1; else r.partial += 1;
      for (const it of ME.requirementLines(s, s.eligibilityLines || [], { withMeta: true, all: true })) {
        if (it.aside) continue;
        r.lines += 1;
        const one = ME.fitDetail({ eligibilityLines: [it.text], eligibility: {} }, p);   // 줄 하나의 판정 — 앱이 쓰는 그 함수로(규칙을 베끼지 않는다)
        const v = one.unread ? 'unknown' : one.fails.length ? 'no' : (one.met === one.total && one.total > 0) ? 'ok' : 'unknown';
        r[v] += 1;
        if (v === 'unknown') { let conds = []; try { conds = PR.parseLine(PR.untag(it.text), false).conds || []; } catch { /* 못 읽는 줄 */ } if (!conds.length) r.noCond += 1; }
      }
    }
    out[name] = r;
  }
  return out;
}
export const verdictBrief = (dist) => {
  const names = Object.keys(dist); if (!names.length) return '';
  const col = (k) => names.map((n) => dist[n][k]).join('/');
  const a = dist[names[0]];
  return `- 가상 학생 판정(마감 전 등록 ${a.cards}건 · ${names.join('/')}): 자격미확인 ${col('unread')} · 미달 ${col('fail')} · 전부충족 ${col('full')} · 일부/모름 ${col('partial')} · 자격 줄 ${a.lines}개 중 모름 ${col('unknown')} (${names.map((n) => (dist[n].lines ? Math.round(dist[n].unknown * 100 / dist[n].lines) : 0) + '%').join('/')}) · 조건 못 집음 ${col('noCond')}`;
};

const top = (m, n = 99) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(' · ');

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url) {
  const cov = coverage();
  const noCondTotal = Object.values(cov).reduce((a, s) => a + s.noCond.size, 0);
  const totals = traitTotals(cov);
  const asked = new Set(EA.ONBOARD_TRAITS || []);
  if (process.argv.includes('--brief')) {
    /* 수집 리포트용 한 줄 — 온보딩에서 묻는 처지가 4곳 미만이 되거나, 안 묻는 처지가 4곳 이상이면 「손볼 때」 */
    const under = totals.filter(([k, n]) => asked.has(k) && n < 4).map(([k, n]) => `${k} ${n}`);
    /* 단체 회원(`member:<단체>`)은 공고 안에서 그 단체 이름으로만 묻는다 — 온보딩 후보가 아니다(2026-11-16 개발자 결정 1번) */
    const over = totals.filter(([k, n]) => !asked.has(k) && n >= 4 && !/^member:/.test(k)).map(([k, n]) => `${k} ${n}`);
    const flag = (under.length || over.length) ? ` · ⚠️ 온보딩 질문 목록 손볼 때 — 4곳 미만인데 묻는 것: ${under.join(', ') || '없음'} · 4곳 이상인데 안 묻는 것: ${over.join(', ') || '없음'}` : '';
    console.log(`- 자격 줄 전수: 공고 ${Object.values(cov).map((s) => s.notices).join('/')} · 조건을 하나도 못 읽는 줄 ${Object.values(cov).map((s) => s.noCond.size).join('/')} (등록/재단/활동 · 합 ${noCondTotal}) · 처지 상위 ${totals.slice(0, 5).map(([k, n]) => `${k} ${n}`).join(', ')}${flag}`);
    console.log(verdictBrief(verdictDist(reg)));   // 둘째 줄 — 가상 학생 셋의 카드·줄 판정 분포(1단계 측정)
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
