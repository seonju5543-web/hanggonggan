/* 알림 규칙 엔진 단위 검증 — 브라우저·서버 없이 규칙만 돌려본다.
   "언제 알림이 가고, 언제 가지 않는가"를 못 박아 두는 회귀 테스트.
   실행: node verify/verify-notify-rules.js  (실패 시 exit 1) */
const path = require('path');
const ROOT = path.join(__dirname, '..');
const RULES = require(path.join(ROOT, 'notify-rules.js'));
const { evaluate: matchEval, scopedToProfile, notStale } = require(path.join(ROOT, 'match-engine.js'));

let fail = 0;
function ok(cond, label, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label + (cond || extra === undefined ? '' : ' → ' + JSON.stringify(extra)));
  if (!cond) fail++;
}

const NOW = new Date('2026-08-10T09:00:00+09:00').getTime();
const day = (n) => {
  const d = new Date(NOW + n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const profile = {
  school: '한국외국어대학교', campus: '서울캠퍼스', track: 'humanities', year: 3,
  status: 'enrolled', gpa: 3.8, bracket: 4, region: 'seoul', flags: [], cert: false, exchange: false,
};

const mk = (id, over = {}) => Object.assign({
  id, name: id + ' 장학금', type: '교내', provider: '테스트재단', amount: '100만원',
  deadline: day(20), eligibility: {},
}, over);

const run = (ctx) => RULES.evaluate(Object.assign({
  now: NOW, profile, applications: [], scholarships: [], notices: [],
  matchStatus: (s) => matchEval(s, profile).status,
  notStale: (s) => notStale(s, NOW),
}, ctx));

console.log('\n[1] 첫 실행(baseline) — 기존 공고를 새 공고라며 쏟아내지 않는다');
let r = run({ scholarships: [mk('a'), mk('b'), mk('c')], ledger: null });
ok(r.events.length === 0, '첫 동기화는 알림 0건', r.events.map((e) => e.key));
ok(r.ledger.baseline === true, 'baseline 표시됨');
ok(r.ledger.seenSch.length === 3, '기존 공고 3건을 기억함', r.ledger.seenSch);
const base = r.ledger;

console.log('\n[2] 새 공고 알림 — 조건 1');
r = run({ scholarships: [mk('a'), mk('b'), mk('c'), mk('new1')], ledger: JSON.parse(JSON.stringify(base)) });
ok(r.events.length === 1 && r.events[0].type === 'newMatch', '새 공고 1건 알림', r.events.map((e) => e.key));
ok(/new1/.test(r.events[0].title), '공고 이름이 제목에 들어감', r.events[0].title);
ok(r.events[0].url === './?sch=new1', '알림을 누르면 해당 공고로', r.events[0].url);

console.log('\n[3] 같은 공고를 두 번 알리지 않는다');
const after2 = JSON.parse(JSON.stringify(r.ledger));
r = run({ scholarships: [mk('a'), mk('b'), mk('c'), mk('new1')], ledger: after2 });
ok(r.events.length === 0, '재실행 시 0건', r.events.map((e) => e.key));

console.log('\n[4] 자격 미달·마감 지난 공고는 알리지 않는다');
r = run({
  ledger: JSON.parse(JSON.stringify(base)),
  scholarships: [
    mk('a'), mk('b'), mk('c'),
    mk('nomatch', { eligibility: { minGpa: 4.4 } }),       // 성적 미달
    mk('closed', { deadline: day(-3) }),                   // 마감 경과
    mk('otherschool', { eligibility: { schoolOnly: '서울대학교' } }),
    mk('program1', { program: true, deadline: null }),     // 상시 제도
  ],
});
ok(r.events.length === 0, '요건 미충족·마감·타교·상시제도 전부 제외', r.events.map((e) => e.key));

console.log('\n[5] 새 공고가 4건 이상이면 묶음 1건으로');
r = run({
  ledger: JSON.parse(JSON.stringify(base)),
  scholarships: [mk('a'), mk('b'), mk('c'), mk('n1'), mk('n2'), mk('n3'), mk('n4')],
});
ok(r.events.length === 1 && /4건/.test(r.events[0].title), '묶음 알림 1건', r.events.map((e) => e.title));

console.log('\n[6] 마감 하루 전 · 마감 당일 (개발자 요구사항 2)');
const dlList = [mk('d1', { deadline: day(1) }), mk('d0', { deadline: day(0) }), mk('d2', { deadline: day(2) }), mk('d7', { deadline: day(7) })];
const seeded = Object.assign(RULES.newLedger(), { baseline: true, seenSch: dlList.map((s) => s.id) });
r = run({ scholarships: dlList, ledger: seeded });
const dlKeys = r.events.filter((e) => e.type === 'deadline').map((e) => e.key);
ok(dlKeys.length === 2, 'D-1과 D-DAY만 알림 (D-2·D-7은 조용)', dlKeys);
ok(dlKeys.includes('dl:d1:1') && dlKeys.includes('dl:d0:0'), '키가 정확함', dlKeys);
ok(/내일 마감/.test(r.events.find((e) => e.key === 'dl:d1:1').title), 'D-1 문구', r.events[0].title);
ok(/오늘 마감/.test(r.events.find((e) => e.key === 'dl:d0:0').title), 'D-DAY 문구');

console.log('\n[7] 이미 제출을 기록한 공고는 마감 재촉을 하지 않는다');
r = run({
  scholarships: dlList,
  applications: [{ id: 'd1', submittedAt: '2026-08-01' }],
  ledger: Object.assign(RULES.newLedger(), { baseline: true, seenSch: dlList.map((s) => s.id) }),
});
ok(!r.events.some((e) => e.key === 'dl:d1:1'), '제출 기록된 d1은 제외', r.events.map((e) => e.key));

console.log('\n[8] 제출 리마인드 — 준비만 하고 제출 기록이 없는 공고');
r = run({
  scholarships: [mk('p1', { deadline: day(3) }), mk('p2', { deadline: day(10) })],
  applications: [{ id: 'p1', appliedAt: '2026-08-01' }, { id: 'p2', appliedAt: '2026-08-01' }],
  ledger: Object.assign(RULES.newLedger(), { baseline: true, seenSch: ['p1', 'p2'] }),
});
const sub = r.events.filter((e) => e.type === 'submit').map((e) => e.key);
ok(sub.length === 1 && sub[0] === 'sub:p1', '마감 3일 이내인 p1만 리마인드', sub);

console.log('\n[9] 결과 기록 리마인드 — 제출 + 마감 2주 경과');
r = run({
  scholarships: [mk('r1', { deadline: day(-20) }), mk('r2', { deadline: day(-3) })],
  applications: [{ id: 'r1', submittedAt: 'x' }, { id: 'r2', submittedAt: 'x' }],
  ledger: Object.assign(RULES.newLedger(), { baseline: true, seenSch: ['r1', 'r2'] }),
});
const res = r.events.filter((e) => e.type === 'result').map((e) => e.key);
ok(res.length === 1 && res[0] === 'res:r1', '마감 20일 지난 r1만 리마인드', res);

console.log('\n[10] 우리 학교 실시간 공고 — 내 학교만 · 대출은 제외 · 묶음 1건');
r = run({
  notices: [
    { url: 'https://a/1', title: '2026-2학기 교내장학 안내', school: '한국외국어대학교', campus: '서울캠퍼스' },
    { url: 'https://a/2', title: '학자금 대출 신청 안내', school: '한국외국어대학교', campus: '서울캠퍼스' },
    { url: 'https://a/3', title: '타교 공고', school: '성균관대학교' },
    { url: 'https://a/4', title: '외부 장학재단 모집', school: '한국외국어대학교' },
  ],
  ledger: Object.assign(RULES.newLedger(), { baseline: true }),
});
const feed = r.events.filter((e) => e.type === 'feed');
ok(feed.length === 1 && /2건/.test(feed[0].title), '내 학교 장학 공고 2건만 묶음', feed.map((e) => e.title));

console.log('\n[11] 항목별 끄기(prefs)가 실제로 먹는다');
r = run({
  scholarships: dlList,
  ledger: Object.assign(RULES.newLedger(), { baseline: true, seenSch: dlList.map((s) => s.id), prefs: { deadline: false } }),
});
ok(r.events.length === 0, '마감 알림을 끄면 0건', r.events.map((e) => e.key));

console.log('\n[12] 알림함 · 읽지 않음 집계');
let led = RULES.newLedger();
RULES.pushToInbox(led, [{ key: 'k1', type: 'deadline', title: 't', body: 'b' }], NOW);
RULES.pushToInbox(led, [{ key: 'k2', type: 'newMatch', title: 't2', body: 'b2' }], NOW);
ok(led.inbox.length === 2 && RULES.unreadCount(led) === 2, '알림함 2건·읽지 않음 2건');
led.inbox[0].read = true;
ok(RULES.unreadCount(led) === 1, '읽음 처리 반영');

console.log('\n[13] 실제 데이터(data/registered.json)로 학교 한정 필터 확인');
const reg = require(path.join(ROOT, 'data/registered.json'));
const mine = scopedToProfile(reg.items, profile);
ok(mine.length > 0, `외대 프로필에 보이는 등록 공고 ${mine.length}건`);
ok(!mine.some((s) => s.eligibility && s.eligibility.schoolOnly && s.eligibility.schoolOnly !== profile.school),
  '다른 학교 한정 공고가 섞이지 않음');
r = run({ scholarships: mine, ledger: null });
ok(r.ledger.seenSch.length === mine.length, `실데이터 첫 동기화가 ${mine.length}건을 기억함`, r.ledger.seenSch.length);
// 첫 동기화에서 '새 공고'·'학교 피드'는 조용해야 한다. 마감 임박은 진짜 사실이므로 첫날에도 알린다.
ok(!r.events.some((e) => e.type === 'newMatch' || e.type === 'feed'),
  '첫 동기화에 새 공고·피드 알림 없음', r.events.map((e) => e.type));
console.log(`      (첫 동기화에서 나온 시간 기반 알림: ${r.events.length}건 — ${r.events.map((e) => e.key).join(', ') || '없음'})`);
r = run({ scholarships: mine, ledger: JSON.parse(JSON.stringify(r.ledger)) });
ok(r.events.length === 0, '같은 상태로 다시 실행하면 0건(중복 없음)', r.events.map((e) => e.key));

console.log(fail ? `\n❌ 실패 ${fail}건\n` : '\n✅ 알림 규칙 전부 통과\n');
process.exit(fail ? 1 : 0);
