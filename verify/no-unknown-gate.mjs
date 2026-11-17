/* 관문 「학생 화면에 '모름'류 글자가 없다 (2026-11-15)」 — test-collector 가 부른다(readText·eq 를 넘겨받는다)
   개발자 결정(2026-11-02): '모름' 같은 말이 앱에 보이면 신뢰가 떨어진다 → 학생 화면에서 모르는 것을 말하는 글자를 전부 뺀다.
   모르면 **아무것도 그리지 않는다** — 지어내지 않는다 · 틀린 미달을 만들지 않는다 · 판정 코드(lineVerdict·fitVerdict·match-engine)는 그대로.
   ① 표본(기한·금액·주관·자격을 모르는 공고 · 일부만 아는 공고 · 층2 재단 줄)을 **앱 함수 그대로**(verify/app-vm.cjs) 카드·시트·지원문서·알림으로 그려 낱말을 센다
   ② 결정 1 — 기한도 자격도 모르는 정식 공고는 카드가 아니라 게시판 새 공고(제목+링크)로 · 알림도 같은 함수(feedOnlyFormal)
   ③ 지키는 것 — 판정 못 한 요건 줄은 표시 없이 남는다 · 미달 안내 문장은 그대로 · 어긋난 요건이 없으면 경고색 없음
   ④ 학생 화면 글자를 만드는 파일 전부(SCREEN_FILES — app.js·index.html·match-engine.js·source-link.js·data.js·sw.js·약관…)의 **문자열**을 훑는다(주석·정규식 제외 · 예외는 verify/no-unknown-allow.cjs 에 까닭과 함께)
   ⑤ 카드·시트 밖의 자리(2026-11-16 리뷰) — 달력·MY 저장 줄 · 금액 상세 합친 목록 · 신청 내역 「선정」 줄 · 지원서 초안(학업 계획) · 문제 주소 링크 이름·제출처 이름 ·
      자격을 못 읽은 공고의 신청 안내 한 문장 · 「어긋난 요건 없음」은 다 판정했을 때만 · 게시판 글로 간 공고의 알림(feedOnlyBoardRows)
   ⑥ 인용은 통째로 싣거나 통째로 뺀다(2026-11-16 2차 리뷰 · 원칙 8-1) — 낱말이 있는 원문·재단 글은 잘린 조각도 없이 빠진다(knownValue·kosafNoticeValue · SAYS_UNKNOWN 한 곳)
   낱말 목록은 verify/no-unknown-words.cjs 한 곳 · 실데이터 전수는 verify/verify-no-unknown.js(브라우저 · verify-ui.yml) */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadApp, screenText } = require('./app-vm.cjs');
const { unknownHits, UNKNOWN_WORDS } = require('./no-unknown-words.cjs');
const { scanFile, SCREEN_FILES } = require('./no-unknown-scan.cjs');
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
    { ...UNK, id: 'g-full', name: '2026학년도 표본 우수 장학생', deadline: iso(11), eligibilityLines: ['직전학기 평점 3.0 이상인 자'], sourceUrl: 'https://www.pyobon.ac.kr/notice/view?no=6' },
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
  for (const id of ['g-none', 'g-unread', 'g-part', 'g-miss', 'g-fail', 'g-full']) shown[id] = { card: hits(card(id)), sheet: hits(A.sheetHtml(id)), prep: hits(prep(id)) };
  const kid = 'kosaf-g1';
  shown[kid] = { card: hits(card(kid)), sheet: hits(A.sheetHtml(kid)), prep: hits(prep(kid)) };
  const dirty = Object.entries(shown).flatMap(([id, w]) => Object.entries(w).filter(([, h]) => Object.keys(h).length).map(([k, h]) => `${id}·${k}·${Object.keys(h).join('/')}`));
  eq(`① 기한·금액·주관·자격을 모르는 표본 공고 7건(층1 6 · 층2 1)의 카드·상세 시트·지원문서에 「${UNKNOWN_WORDS.join('·')}」·맨 앞 「?」 가 하나도 없다`, dirty, []);
  eq('  (헛돌지 않는다) 표본이 실제로 그려졌다 — 카드 4장(층1) · 층2 카드 · 시트에 제목', [['g-unread', 'g-part', 'g-miss', 'g-fail'].every((id) => ids.includes(id)), ids.includes(kid),
    screenText(A.sheetHtml('g-unread')).includes('2026학년도 표본 봉사 장학생 선발')], [true, true, true]);
  const s1 = screenText(A.sheetHtml('g-unread'));
  eq('  모르는 금액·주관·기한·방법 줄은 안 그린다 — 「0원」·「금액」 줄·「방법」 줄도 없다', [/0원/.test(s1), /\n금액/.test(screenText(card('g-unread'))), /\n방법\n/.test(s1), /주관/.test(s1)], [false, false, false, false]);
  eq('  자격을 못 읽은 카드엔 알약이 없다 — 35% 같은 정렬용 숫자가 새지 않는다(fitBadgeHtml · cardBadgeHtml 의 unread 갈래는 빈 글자)',
    [/적합도|%/.test(screenText(card('g-unread'))), run('fitBadgeHtml')(35, { unread: true, pct: 35, met: 0, total: 1, unknown: 1, fails: [] }, { full: true }), run('cardBadgeHtml')(35, { unread: true, pct: 35, fails: [] }, null, {})], [false, '', '']);

  /* ③ 지키는 것 */
  eq('③ 판정 못 한 요건 줄은 **표시 없이 남는다** (줄을 버리지 않는다)', /<li class="r-elig r-req">봉사 정신이 투철한 학생<\/li>/.test(A.sheetHtml('g-unread')), true);
  const partSheet = A.sheetHtml('g-part');
  /* 🔴 「어긋난 요건 없음」은 요건을 **전부 판정했을 때만**(fd.unknown === 0 · 2026-11-16 리뷰) — 판정 못 한 줄이 남았는데 이 말을 하면 틀린 안심이다 */
  eq('  일부만 아는 공고 — 상세 알약은 「적합도 n% · 맞는 요건 M개」(「어긋난 요건 없음」 없음) · 경고색(빨강·주황) 없음 · 모르는 줄은 표시 없이',
    [/적합도 \d+% <em>맞는 요건 1개<\/em>/.test(partSheet) && !/어긋난 요건 없음/.test(partSheet), /fit-(red|orange)/.test(partSheet + card('g-part')), /<li class="r-elig r-req">봉사 정신이 투철한 학생<\/li>/.test(partSheet), /r-elig r-ok">✓ 직전학기 평점 3.0 이상인 자/.test(partSheet)],
    [true, false, true, true]);
  A.setProfile({ ...P, gpa: null });
  eq('  학생 정보가 없어 못 맞춘 구조화 조건은 「?」 줄이 아니라 그 요건 한 줄(공고의 값 그대로)', [/<li class="r-req">직전학기 평점 3 이상<\/li>/.test(A.sheetHtml('g-miss')), /\? /.test(screenText(A.sheetHtml('g-miss')))], [true, false]);
  A.setProfile(P);
  eq('  🔴 미달 안내 문장은 **그대로** — 틀릴 수 있음을 말하는 그 한 문장(지우면 틀린 미달을 단정하는 셈)',
    A.sheetHtml('g-fail').includes('입력한 정보로는 요건이 맞지 않아 보입니다. 판정이 틀릴 수 있으니 원문을 확인한 뒤 신청하세요.'), true);
  eq('  미달은 미달 그대로(판정 코드 무변경) — 카드 「지원 자격 미달」', /지원 자격 미달/.test(card('g-fail')), true);

  eq('  다 판정한 공고(모르는 줄 0)는 「맞는 요건 M개 · 어긋난 요건 없음」 그대로 · 모르는 줄만 있으면 퍼센트만(빈 「맞는 요건 0개」 없음)',
    [/적합도 \d+% <em>맞는 요건 1개 · 어긋난 요건 없음<\/em>/.test(A.sheetHtml('g-full')),
      /^<span class="badge badge-fit fit-\w+">적합도 60%<\/span>$/.test(run('fitBadgeHtml')(60, { unread: false, pct: 60, met: 0, total: 2, unknown: 2, fails: [] }, { full: true }))],
    [true, true]);

  /* ⑤ 카드·시트 밖의 자리 (2026-11-16 리뷰 — 이 자리들은 칸을 그대로 옮겨 낱말이 살아남았다) */
  const reg1 = run('findSch')('g-unread'), kos1 = run('findSch')(kid);
  const fifth = {
    '달력·저장 줄(층1)': run('calRowHtml')(reg1, { save: true }), '달력 줄(층2 — 선발인원 「기관확인필요」)': run('calRowHtml')(kos1),
    '금액 상세 합친 목록': run('amountDetailRow')({ ref: reg1, won: 0, mergedFrom: [run('findSch')('g-part')] }, {}),
    '금액 상세 층2(재단이 적어 둔 글 — 「지원금액: 기관확인필요」)': run('amountDetailRow')({ ref: kos1, won: 0, mergedFrom: [] }, { srcLink: true }),
    '지원서 초안 학업 계획': run('generateEssay')({ kind: 'plan' }, reg1, P, { goal: '전공 공부를 이어가겠습니다', career: '연구자' }, {}),
  };
  run('(a) => { state.applications = a; }')([{ id: 'g-unread', appliedAt: iso(-5), submittedAt: iso(-4), result: 'won', resultAt: iso(-1) }]);
  fifth['신청 내역 선정 줄'] = A.sheetHtml('g-unread');
  run('(a) => { state.applications = a; }')([]);
  const LC = { updatedAt: 't', bad: { [reg1.sourceUrl]: { v: 'gone', at: '2026-11-10' }, 'https://www.pyobon.ac.kr/news/7': { v: 'other', at: '2026-11-10' } } };
  run('setLinkChecks')(LC);
  fifth['문제 주소 — 상세 링크·안내'] = run('sourceLinkHtml')(reg1) + run('sourceNoteHtml')(reg1);
  fifth['문제 주소 — 제출처 이름'] = run('officialChannel')(reg1).label;
  fifth['문제 주소 — 신청 내역 단추'] = run('appLogLinkHtml')(reg1);
  fifth['문제 주소 — 금액 출처 링크'] = run('amountSourceLinkHtml')(reg1);
  fifth['문제 주소 — 게시판·소식 카드'] = run('noticeCardHtml')({ title: '표본 소식', url: 'https://www.pyobon.ac.kr/news/7', school: '표본대학교', foundAt: iso(-1) }, {});
  fifth['문제 주소 — 도우미·활동'] = ['chat', 'activity', 'activityButton'].map((w) => run('sourceLink')({ url: 'https://www.pyobon.ac.kr/news/7' }, w).label).join('\n');
  fifth['문제 주소 — 신청 내역 제출처 줄'] = (run('(a) => { state.applications = a; }')([{ id: 'g-unread', appliedAt: iso(-1) }]), A.sheetHtml('g-unread'));
  const troubleSays = [screenText(run('sourceLinkHtml')(reg1)), run('sourceLink')({ url: 'https://www.pyobon.ac.kr/news/7' }, 'card').label, /이 주소가 열리지 않았어요 \(2026-11-10 확인\)/.test((fifth['문제 주소 — 신청 내역 제출처 줄'].match(/<p class="applied-at">[\s\S]*?<\/p>/) || [''])[0])];
  run('(a) => { state.applications = a; }')([]);
  run('setLinkChecks')(null);
  const fifthDirty = Object.entries(fifth).filter(([, h]) => Object.keys(hits(h)).length).map(([k, h]) => `${k}·${Object.keys(hits(h)).join('/')}`);
  eq(`⑤ 카드·시트 밖의 자리 ${Object.keys(fifth).length}곳(달력·저장 · 금액 상세 · 지원서 초안 · 선정 줄 · 문제 주소 링크·제출처)에 「${UNKNOWN_WORDS.join('·')}」가 없다`, fifthDirty, []);
  eq('  (헛돌지 않는다) 그 자리가 실제로 그려졌다 — 달력 줄에 제목(층1·층2) · 선정 줄 · 초안 학업 계획 · 합친 목록에 공고 이름(주관을 모르면 이름)',
    [screenText(fifth['달력·저장 줄(층1)']).includes('2026학년도 표본 봉사 장학생 선발'), screenText(fifth['달력 줄(층2 — 선발인원 「기관확인필요」)']).includes('표본 장학생'),
      new RegExp(`${iso(-1)} 선정\\n`).test(screenText(fifth['신청 내역 선정 줄']) + '\n'), /\[학업 계획\]\n전공 공부를 이어가겠습니다\./.test(fifth['지원서 초안 학업 계획']),
      (screenText(fifth['금액 상세 합친 목록']).match(/2026학년도 표본 (봉사|성적) 장학생 선발/g) || []).length >= 3],
    [true, true, true, true, true]);
  eq('  🔴 문제 주소의 정직함은 남는다 — 이름에 로봇이 본 것(열리지 않음·다른 화면) · 신청 내역 제출처 줄에 본 것 한 줄(지우기만 하면 멀쩡한 원문처럼 읽힌다)',
    troubleSays, ['원문 공고(열리지 않음) ↗', '원문 보기(다른 화면) ↗', true]);
  /* 자격을 못 읽은 공고 — 「자격 미확인」 배지를 뺐으니 버튼 위 한 문장이 남아야 한다(앱이 자격을 확인해 준 것처럼 읽히지 않게 · 낱말 없이) */
  const unreadSheet = A.sheetHtml('g-unread');
  eq('  🔴 자격을 못 읽은 선발형 공고(fd.unread · status selective)의 상세 — 신청 버튼은 열리고 바로 위에 「신청 전에 공고 원문에서 지원 자격을 확인하세요.」 · 읽은 공고엔 없다',
    [/<p class="dp-note dp-caution">신청 전에 공고 원문에서 지원 자격을 확인하세요\.<\/p>/.test(unreadSheet), /id="btn-apply-one" >/.test(unreadSheet),
      /dp-caution/.test(A.sheetHtml('g-full')), Object.keys(unknownHits('신청 전에 공고 원문에서 지원 자격을 확인하세요.')).length],
    [true, true, false, 0]);

  /* ⑥ 인용은 통째로 싣거나 통째로 뺀다 (2026-11-16 2차 리뷰 · 원칙 8-1) — 예전 knownValue → kosafNoticeValue 가 「확인 필요」 와 앞 세 낱말을 문장 가운데서 떼어
     「등록금 전액 지원 단, 소득분위 확인 필요」 → 「등록금 전액」(조건이 사라진 글)을 따옴표 안 원문으로 보였다. 리뷰가 낸 입력 그대로 — 조각도 낱말도 없어야 한다 */
  const Q = { ...reg1, id: 'g-quote', name: '표본 인용 장학', amountValue: 0 };
  const quoteRow = (raw, exRaw) => run('amountDetailRow')({ ref: { ...Q, amountSpec: raw ? { kind: 'unknown', raw } : null, exclusivity: exRaw ? { raw: exRaw } : null }, won: 0, mergedFrom: [] }, { srcLink: true });
  const cut = {
    '금액 인용 — 조건이 붙은 문장': [quoteRow('등록금 전액 지원 단, 소득분위 확인 필요'), '등록금 전액'],
    '금액 인용 — 괄호 속 조건': [quoteRow('1인당 300만원 지원 (소득구간별 차등, 학교 확인 필요)'), '300만원'],
    '이중수혜 인용 — 꼬리 조건': [quoteRow('', '최대 500만원, 성적에 따라 차등 지급 확인 필요'), '500만원'],
    '달력 줄 선발인원(실데이터 2700058001)': [run('calRowHtml')({ ...Q, headcount: '학교마다 선발인원 상이하므로 각 대학 홈페이지 확인 필요' }), '학교마다'],
    '지원서 초안 학업 계획 — 기간 끝날짜가 잘리던 칸(2000342003)': [run('generateEssay')({ kind: 'plan' }, { ...Q, period: '2026-03-18 ~ 2026-11-30 기관 확인 필요요' }, P, { goal: '전공 공부를 이어가겠습니다', career: '연구자' }, {}), '2026-03-18'],
  };
  const setKosaf = run('(k) => { kosafList = k; }');
  setKosaf([{ code: 'g2', org: '표본장학회', name: '표본 인용 재단 장학', due: '', home: 'https://pyobon.or.kr',
    fields: { 지원금액: '1인당 300만원 지원 ※ 소득구간별 차등, 학교 확인 필요', 선발인원: '※ 학교마다 선발인원 상이하므로 각 대학 홈페이지 확인 필요', 선발방법: '○ 서류 심사 후 면접', 신청기간: '' } }]);
  const kq = run('kosafAsScholarships')()[0] || {};
  setKosaf(kosaf);
  cut['층2 공고 안내 줄(선발인원)'] = [(kq.noticeLines || []).join('\n'), '학교마다'];
  cut['층2 금액 상세(재단이 적어 둔 글)'] = [run('amountDetailRow')({ ref: kq, won: 0, mergedFrom: [] }, { srcLink: true }), '300만원'];
  const cutDirty = Object.entries(cut).filter(([, [h, frag]]) => Object.keys(hits(h)).length || screenText(h).includes(frag)).map(([k]) => k);
  eq(`⑥ 인용·재단 칸에 '모름'류 낱말이 있으면 그 글은 통째로 없다 — 잘린 조각(「등록금 전액」·「300만원 지원 )」·「성적에」·「학교마다 선발인원 상이하므로」·「2026-03-18 동안」)도 없다 (${Object.keys(cut).length}곳)`, cutDirty, []);
  eq('  인용이 빠지면 따옴표 칸이 아니라 원문으로 가는 링크만 남는다 · 낱말 없는 인용·칸은 한 글자도 안 바꾸고 그대로(대조군)',
    [/class="ad-src"/.test(cut['금액 인용 — 조건이 붙은 문장'][0]), /class="ad-link"/.test(cut['금액 인용 — 조건이 붙은 문장'][0]),
      /<p class="ad-src">"1인당 300만원 지원 \(소득구간별 차등\)"/.test(quoteRow('1인당 300만원 지원 (소득구간별 차등)')),
      screenText(run('calRowHtml')({ ...Q, headcount: '10명 내외' })).includes('10명 내외'),
      /\[학업 계획\]\n2026학년도 2학기 동안 전공/.test(run('generateEssay')({ kind: 'plan' }, { ...Q, period: '2026학년도 2학기' }, P, { goal: '전공 공부를 이어가겠습니다', career: '연구자' }, {})),
      kq.noticeLines], [false, true, true, true, true, ['선발방법: 서류 심사 후 면접']]);
  eq('  낱말 판정은 앱의 SAYS_UNKNOWN 한 곳 — 낱말 목록(no-unknown-words.cjs)의 낱말마다 잡는다(브라우저가 그 파일을 못 읽어 앱에 한 번 더 둔 것이 갈라지지 않게)',
    run('typeof SAYS_UNKNOWN') !== 'object' ? ['SAYS_UNKNOWN 없음'] : UNKNOWN_WORDS.filter((w) => !run('SAYS_UNKNOWN').test(`앞 ${w} 뒤`)), []);

  /* ④ 코드의 학생 화면 글자 훑기 */
  const scan = SCREEN_FILES.flatMap((f) => scanFile(f, read(f), NO_UNKNOWN_ALLOW));
  eq(`④ 학생 화면 글자를 만드는 파일 ${SCREEN_FILES.length}개(${SCREEN_FILES.slice(0, 5).join('·')}…)의 문자열에 '모름'류 낱말이 없다 — 주석·정규식은 안 본다`, scan.map((h) => `${h.file}:${h.line} [${h.word}] ${h.text.slice(0, 50)}`), []);
  const scripts = [...read('index.html').matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/-config\.js$/.test(f));
  eq('  index.html 이 싣는 화면 스크립트(설정 파일 제외)가 전부 훑는 목록에 있다 · 서비스워커·약관 화면도', [scripts.filter((f) => !SCREEN_FILES.includes(f)), ['sw.js', 'terms.html'].filter((f) => !SCREEN_FILES.includes(f))], [[], []]);
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
  /* 🔴 게시판 글로 간 공고는 알림에서도 사라지면 안 된다(2026-11-16 리뷰) — 1번 규칙이 「4번(실시간 공고)이 맡는다」며 건너뛰는데 4번은 게시판 글만 봐서
     이 학교 게시판에 없는 공고(다른 게시판·재단에서 온 정식 공고)는 어디서도 안 울었다. 화면(boardNoticesForMe)과 알림이 같은 feedOnlyBoardRows 를 부른다 */
  const feedEv = fresh.events.filter((e) => e.type === 'feed');
  eq('  게시판 글로 간 공고(이 학교 게시판에 없는 것)는 「○○ 새 공고」 묶음 알림으로 운다 — 화면의 게시판 새 공고와 같은 줄 · 같은 함수(feedOnlyBoardRows)를 화면·알림이 부른다',
    [feedEv.length === 1 && feedEv[0].body.includes(reg[0].name), /feedOnlyBoardRows\(allScholarships\(\), fromFeed, p\)/.test(read('app.js')), /feedOnlyBoardRows\(list, mineFeed, profile, now\)/.test(read('notify-rules.js')), run('typeof feedOnlyBoardRows')],
    [true, true, true, 'function']);
  const fresh2 = NR.evaluate({ now: Date.now(), profile: P, scholarships: [reg[0]], notices: [{ title: reg[0].name, url: reg[0].sourceUrl, school: '표본대학교', foundAt: iso(0) }], ledger: { ...NR.newLedger(), baseline: true, enabled: true }, matchStatus: () => 'selective', noticeForProfile: (n, p) => n.school === p.school });
  eq('  게시판에 같은 글이 이미 있으면 두 번 세지 않는다(새 공고 1건)', fresh2.events.filter((e) => e.type === 'feed').map((e) => e.title), ['표본대학교 새 공고 1건']);
  eq('  sw.js 는 match-engine·notify-rules 를 같이 싣는다(베끼지 않는다 — 전역 feedOnlyFormal 을 notify-rules 가 부른다)',
    /importScripts\([^)]*'match-engine\.js'[^)]*'notify-rules\.js'/.test(read('sw.js')) && /typeof feedOnlyFormal === 'function'/.test(read('notify-rules.js')), true);

}
