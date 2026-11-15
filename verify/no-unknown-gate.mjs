/* 관문 「학생 화면에 '모름'류 글자가 없다 (2026-11-15)」 — test-collector 가 부른다(readText·eq 를 넘겨받는다)
   개발자 결정(2026-11-02): '모름' 같은 말이 앱에 보이면 신뢰가 떨어진다 → 학생 화면에서 모르는 것을 말하는 글자를 전부 뺀다.
   모르면 **아무것도 그리지 않는다** — 지어내지 않는다 · 틀린 미달을 만들지 않는다 · 판정 코드(lineVerdict·fitVerdict·match-engine)는 그대로.
   ① 표본(기한·금액·주관·자격을 모르는 공고 · 일부만 아는 공고 · 층2 재단 줄)을 **앱 함수 그대로**(verify/app-vm.cjs) 카드·시트·지원문서·알림으로 그려 낱말을 센다
   ② 결정 1 — 기한도 자격도 모르는 정식 공고는 카드가 아니라 게시판 새 공고(제목+링크)로 · 알림도 같은 함수(feedOnlyFormal)
   ③ 지키는 것 — 판정 못 한 요건 줄은 표시 없이 남는다 · 미달 안내 문장은 그대로 · 어긋난 요건이 없으면 경고색 없음
   ④ app.js·index.html·match-engine.js 의 **문자열**을 훑는다(주석·정규식 제외 · 예외는 verify/no-unknown-allow.cjs 에 까닭과 함께)
   낱말 목록은 verify/no-unknown-words.cjs 한 곳 · 실데이터 전수는 verify/verify-no-unknown.js(브라우저 · verify-ui.yml) */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadApp, screenText } = require('./app-vm.cjs');
const { unknownHits, UNKNOWN_WORDS } = require('./no-unknown-words.cjs');
const { scanFile } = require('./no-unknown-scan.cjs');
const { NO_UNKNOWN_ALLOW } = require('./no-unknown-allow.cjs');

export function runNoUnknownGate(eq, readText) {
  const read = (f) => readText(new URL(`../${f}`, import.meta.url));
  const iso = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const P = { school: '표본대학교', campus: '', track: 'humanities', major: '영어학과', year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14,
    region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004, flags: [], common: {} };
  /* 로봇이 못 읽으면 적는 '모름' 표시 그대로(auto-register) — 화면이 이것을 하나도 옮기지 않아야 한다 */
  const UNK = { type: '교외', provider: '주관 기관 원문 확인', amount: '금액 원문 확인', amountValue: 0, period: '접수 기간 원문 확인', auto: true,
    documents: ['지원 자격·제출 서류는 원문 공고에서 확인'], attachments: [], listedAt: iso(-3), eligibility: { selective: true, schoolOnly: '표본대학교' } };
  const reg = [
    { ...UNK, id: 'g-none', name: '2026학년도 표본 장학생 선발 안내', deadline: null, eligibilityLines: [], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=1' },
    { ...UNK, id: 'g-unread', name: '2026학년도 표본 봉사 장학생 선발', deadline: iso(10), eligibilityLines: ['봉사 정신이 투철한 학생'], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=2' },
    { ...UNK, id: 'g-part', name: '2026학년도 표본 성적 장학생 선발', deadline: iso(12), eligibilityLines: ['직전학기 평점 3.0 이상인 자', '봉사 정신이 투철한 학생'], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=3' },
    { ...UNK, id: 'g-miss', name: '2026학년도 표본 성적우수 장학생', deadline: iso(14), eligibility: { selective: true, schoolOnly: '표본대학교', minGpa: 3.0 }, eligibilityLines: [], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=4' },
    { ...UNK, id: 'g-fail', name: '2026학년도 표본 최우수 장학생', deadline: iso(9), eligibilityLines: ['직전학기 평점 4.0 이상인 자'], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=5' },
  ];
  const kosaf = [{ code: 'g1', org: '표본장학회', name: '표본 장학생', due: '', home: 'https://pyobon.or.kr',
    fields: { 지원금액: '기관확인필요', 선발인원: '기관확인필요', 선발방법: '학교마다 선발인원 상이하므로 각 대학 홈페이지 확인 필요', 신청기간: '', 특정자격: '○ 대학 재학생 중 봉사 정신이 투철한 학생' } }];
  const A = loadApp({ profile: P, kosaf, registered: reg, read });
  const run = A.run;
  run('(x) => { liveNotices = x; }')({ updatedAt: iso(0), items: [] });
  eq('(준비) 앱 선언을 빠짐없이 실었다 — 못 실은 const/let 0 (하나라도 빠지면 그리는 길이 표본에서 달라진다)', A.skipped, []);

  const ids = run('getMatches')().map((m) => m.sch.id);
  const card = (id) => { const m = run('getMatches')().find((x) => x.sch.id === id); return m ? run('schCard')(m.sch, m.result, { fit: m.fit, fd: m.fd }) : ''; };
  const hits = (html) => unknownHits(screenText(html));
  const prep = (id) => { const s = JSON.parse(JSON.stringify(run('findSch')(id))); run('attachPrepTemplates')([s]); const t = run('FORM_TEMPLATES')[run('formTplIdFor')(s)] || {}; return [t.lead, t.tag, ...(t.sections || []).map((x) => x.note || '')].filter(Boolean).join('\n'); };

  /* ① 카드·시트·지원문서에 낱말 0 */
  const shown = {};
  for (const id of ['g-none', 'g-unread', 'g-part', 'g-miss', 'g-fail']) shown[id] = { card: hits(card(id)), sheet: hits(A.sheetHtml(id)), prep: hits(prep(id)) };
  const kid = 'kosaf-g1';
  shown[kid] = { card: hits(card(kid)), sheet: hits(A.sheetHtml(kid)), prep: hits(prep(kid)) };
  const dirty = Object.entries(shown).flatMap(([id, w]) => Object.entries(w).filter(([, h]) => Object.keys(h).length).map(([k, h]) => `${id}·${k}·${Object.keys(h).join('/')}`));
  eq(`① 기한·금액·주관·자격을 모르는 표본 공고 6건(층1 5 · 층2 1)의 카드·상세 시트·지원문서에 「${UNKNOWN_WORDS.join('·')}」·맨 앞 「?」 가 하나도 없다`, dirty, []);
  eq('  (헛돌지 않는다) 표본이 실제로 그려졌다 — 카드 4장(층1) · 층2 카드 · 시트에 제목', [['g-unread', 'g-part', 'g-miss', 'g-fail'].every((id) => ids.includes(id)), ids.includes(kid),
    screenText(A.sheetHtml('g-unread')).includes('2026학년도 표본 봉사 장학생 선발')], [true, true, true]);
  const s1 = screenText(A.sheetHtml('g-unread'));
  eq('  모르는 금액·주관·기한·방법 줄은 안 그린다 — 「0원」·「금액」 줄·「방법」 줄도 없다', [/0원/.test(s1), /\n금액/.test(screenText(card('g-unread'))), /\n방법\n/.test(s1), /주관/.test(s1)], [false, false, false, false]);
  eq('  자격을 못 읽은 카드엔 알약이 없다 — 35% 같은 정렬용 숫자가 새지 않는다(fitBadgeHtml · cardBadgeHtml 의 unread 갈래는 빈 글자)',
    [/적합도|%/.test(screenText(card('g-unread'))), run('fitBadgeHtml')(35, { unread: true, pct: 35, met: 0, total: 1, unknown: 1, fails: [] }, { full: true }), run('cardBadgeHtml')(35, { unread: true, pct: 35, fails: [] }, null, {})], [false, '', '']);

  /* ③ 지키는 것 */
  eq('③ 판정 못 한 요건 줄은 **표시 없이 남는다** (줄을 버리지 않는다)', /<li class="r-elig r-req">봉사 정신이 투철한 학생<\/li>/.test(A.sheetHtml('g-unread')), true);
  const partSheet = A.sheetHtml('g-part');
  eq('  일부만 아는 공고 — 상세 알약은 「적합도 n% · 맞는 요건 M개 · 어긋난 요건 없음」 · 경고색(빨강·주황) 없음 · 모르는 줄은 표시 없이',
    [/적합도 \d+% <em>맞는 요건 1개 · 어긋난 요건 없음<\/em>/.test(partSheet), /fit-(red|orange)/.test(partSheet + card('g-part')), /<li class="r-elig r-req">봉사 정신이 투철한 학생<\/li>/.test(partSheet), /r-elig r-ok">✓ 직전학기 평점 3.0 이상인 자/.test(partSheet)],
    [true, false, true, true]);
  A.setProfile({ ...P, gpa: null });
  eq('  학생 정보가 없어 못 맞춘 구조화 조건은 「?」 줄이 아니라 그 요건 한 줄(공고의 값 그대로)', [/<li class="r-req">직전학기 평점 3 이상<\/li>/.test(A.sheetHtml('g-miss')), /\? /.test(screenText(A.sheetHtml('g-miss')))], [true, false]);
  A.setProfile(P);
  eq('  🔴 미달 안내 문장은 **그대로** — 틀릴 수 있음을 말하는 그 한 문장(지우면 틀린 미달을 단정하는 셈)',
    A.sheetHtml('g-fail').includes('입력한 정보로는 요건이 맞지 않아 보입니다. 판정이 틀릴 수 있으니 원문을 확인한 뒤 신청하세요.'), true);
  eq('  미달은 미달 그대로(판정 코드 무변경) — 카드 「지원 자격 미달」', /지원 자격 미달/.test(card('g-fail')), true);

  /* ④ 코드의 학생 화면 글자 훑기 */
  const scan = ['app.js', 'index.html', 'match-engine.js'].flatMap((f) => scanFile(f, read(f), NO_UNKNOWN_ALLOW));
  eq('④ app.js·index.html·match-engine.js 의 문자열(화면에 나가는 글자)에 \'모름\'류 낱말이 없다 — 주석·정규식은 안 본다', scan.map((h) => `${h.file}:${h.line} [${h.word}] ${h.text.slice(0, 50)}`), []);
  eq('  예외는 학생 화면이 아닌 것만 · 하나마다 까닭(why)이 있다', NO_UNKNOWN_ALLOW.filter((a) => !a.why || !a.file || !a.has).length, 0);
  /* 훑개가 살아 있는지 — 주석 속 낱말은 안 잡고 문자열 속 낱말은 잡는다(조용하면 무력해진 것부터 의심한다) */
  eq('  (훑개 대조군) 문자열 속 「자격 미확인」은 잡고 주석·정규식 속 낱말은 넘긴다',
    scanFile('x.js', "/* 자격 미확인 */ const a = /미확인/.test(x); const b = '<span>자격 미확인</span>'; const c = `기한 ${d} 확인 필요`;", []).map((h) => h.word), ['미확인', '확인 필요']);

  /* ② 결정 1 */
  eq('② 결정 1 — 판정 함수 feedOnlyFormal 이 match-engine 에 있다(화면·알림이 같이 부른다)', run('typeof feedOnlyFormal'), 'function');
  if (run('typeof feedOnlyFormal') !== 'function') return;   // 없으면 아래는 넘어진다 — 빨간불은 위 한 줄로 충분하다
  const fo = (id) => run('feedOnlyFormal')(run('findSch')(id), P);
  eq('② 결정 1 — 기한도 자격도 모르는 정식 공고만 게시판 글로(feedOnlyFormal) · 기한을 알거나 자격을 읽었거나 미달이면 카드 · 층2는 대상 아님',
    [fo('g-none'), fo('g-unread'), fo('g-part'), fo('g-fail'), run('feedOnlyFormal')(run('findSch')(kid), P), run('feedOnlyFormal')({ ...reg[0], eligibilityLines: ['직전학기 평점 3.0 이상인 자'] }, P)],
    [true, false, false, false, false, false]);
  eq('  카드 목록(getMatches — 홈·탐색·일괄 준비·도우미)에 없다 · 게시판 새 공고(boardNoticesForMe)에 제목+링크로 있다 · 상세는 여전히 열린다(저장·딥링크)',
    [ids.includes('g-none'), run('boardNoticesForMe')().some((n) => n.url === reg[0].sourceUrl && n.title === reg[0].name), screenText(A.sheetHtml('g-none')).includes(reg[0].name)], [false, true, true]);
  const NR = run('NOTIFY_RULES');
  const fresh = NR.evaluate({ now: Date.now(), profile: P, scholarships: [reg[0], reg[1]], notices: [], ledger: { ...NR.newLedger(), baseline: true, enabled: true }, matchStatus: () => 'selective' });
  const evIds = fresh.events.filter((e) => e.type === 'newMatch').map((e) => e.schId);
  eq('  알림도 같은 함수 — 게시판 글로 간 공고는 「새 장학 공고」로 안 운다 · 카드인 공고의 알림 문구에도 「원문 확인」 없음',
    [evIds.includes('g-none'), evIds.includes('g-unread'), fresh.events.some((e) => Object.keys(unknownHits(`${e.title}\n${e.body}`)).length)], [false, true, false]);
  eq('  sw.js 는 match-engine·notify-rules 를 같이 싣는다(베끼지 않는다 — 전역 feedOnlyFormal 을 notify-rules 가 부른다)',
    /importScripts\([^)]*'match-engine\.js'[^)]*'notify-rules\.js'/.test(read('sw.js')) && /typeof feedOnlyFormal === 'function'/.test(read('notify-rules.js')), true);

}
