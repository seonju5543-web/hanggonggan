/* 학교 주변 지도 — 처음 지도 점수 (2026-11-25 개발자 지시 3)
   학생 의견이 아직 없을 때 지도에 무엇을 먼저 보일지 정하는 점수다. **학생 평가가 아니다** — 화면에도 그렇게 적는다.
   🔴 지어내지 않는다: 점수·요약·장점·확인할 점은 전부 자료에 있는 사실(거리 · 글의 수와 날짜 · 출처 · 글 속 낱말 · 위치 확인 여부)에서만 나오고,
      글에서 나온 줄에는 그 구절을 근거로 붙인다. 자료에 없는 것(맛 · 분위기 · 별점)은 만들지 않는다.
   브라우저(window.CampusScore)와 Node(module.exports) 겸용 — 나중에 로봇이 같은 파일을 불러 쓴다(베끼지 말 것).

   점수(100점) = 가까움 30 + 근거 30 + 최근 15 + 조건 15 + 위치 확인 10 */
(function (root) {
  'use strict';
  var MAX = { near: 30, proof: 30, fresh: 15, fit: 15, located: 10 };
  var STUDENT_SRC = { '학보': 1, '영자신문': 1, '학교 공식': 1 };   // 재학생 기자·학교가 쓴 글
  // 갈래마다 보는 조건 — 글 속 낱말이 있을 때만 맞은 것으로 친다(좋은 말 pro · 알아 둘 말 con)
  var STUDY = [
    { pro: '예약 없이 쓸 수 있음', re: /예약 없이|자유롭게 사용/ },
    { pro: '콘센트·멀티탭이 있음', re: /콘센트|멀티탭/ },
    { pro: '조용한 편', re: /시끄러운 음악도 없|조용/ },
    { pro: '공부하러 가는 곳으로 나옴', re: /공부하러|공부하기|공부할|카공/ },
    { pro: '재학생 누구나 이용', re: /모든 재학생/ },
    { con: '예약해야 쓸 수 있음', re: /예약제/ },
    { con: '시험 기간엔 자리가 모자란다는 기사가 있음', re: /자리가 없어/ },
  ];
  var CONDS = {
    '카공': STUDY, '카페': STUDY,
    '밥집': [
      { pro: '값이 싼 편', re: /가성비|저렴|1,000원|반 인분|단돈/ },
      { pro: '혼자 가기 좋음', re: /혼자 오면|혼밥|반 인분/ },
      { pro: '오래된 단골집', re: /\d+년 (넘게|동안)|단골/ },
      { pro: '메뉴가 여러 가지', re: /다양한 메뉴|골라 먹을/ },
      { con: '줄을 설 때가 있음', re: /웨이팅/ },
    ],
    '술집': [
      { pro: '재학생이 많이 가는 곳으로 나옴', re: /손님들의 90%|학생들에게 특히 유명|popular pub/ },
      { pro: '단체 자리가 있음', re: /100명 단위|단체/ },
      { pro: '값이 싼 편', re: /저렴|가성비/ },
      { con: '줄을 설 때가 있음', re: /웨이팅/ },
      { con: '시끌시끌한 편', re: /시끌시끌/ },
    ],
    '놀거리': [
      { pro: '산책하기 좋음', re: /산책/ },
      { pro: '저녁에 볼거리가 있음', re: /불빛|저녁 시간/ },
      { pro: '축제가 열림', re: /축제/ },
      { pro: '학생들이 많이 찾는 곳으로 나옴', re: /학생들이 가장 많이 찾는/ },
    ],
    '생활': [
      { pro: '값이 싼 편', re: /1,000~2,000원|식비 절감/ },
      { pro: '기다림이 짧아짐', re: /대기시간이 짧아/ },
      { pro: '교재·복사를 한곳에서', re: /복사실과 서점/ },
    ],
    '복지·혜택': [
      { pro: '값이 싼 편', re: /1,000원/ },
      { pro: '할인·쿠폰이 있음', re: /할인|discount|쿠폰/ },
    ],
  };
  // 글 날짜 → 지금부터 몇 달 전인가(모르면 null). '2026-03-09' · '2024-02경(6…' · '열람 2026-11' · "뽈레 표기 '1년'" · "'9개월"
  function monthsAgo(date, asOf) {
    var s = String(date || ''), m = /(\d{4})-(\d{2})/.exec(s);
    if (m) { var a = /^(\d{4})-(\d{2})/.exec(String(asOf)); return a ? (Number(a[1]) - Number(m[1])) * 12 + (Number(a[2]) - Number(m[2])) : null; }
    m = /(\d+)\s*년/.exec(s); if (m) return Number(m[1]) * 12;
    m = /(\d+)\s*개/.exec(s); if (m) return Number(m[1]);
    return null;
  }
  // 같은 글의 같은 문장을 두 번 세지 않는다(한쪽이 다른 쪽을 품으면 하나)
  function distinct(mentions) {
    var out = [];
    (mentions || []).forEach(function (m) {
      for (var i = 0; i < out.length; i++) {
        if (out[i].url === m.url && (out[i].q.indexOf(m.q) >= 0 || m.q.indexOf(out[i].q) >= 0)) { if (m.q.length > out[i].q.length) out[i] = m; return; }
      }
      out.push(m);
    });
    return out;
  }
  function nearPts(d) { return d == null ? 10 : d <= 300 ? 30 : d <= 500 ? 26 : d <= 800 ? 21 : d <= 1200 ? 15 : d <= 2000 ? 9 : 5; }
  function meters(d) { return d < 30 ? '바로 앞' : d >= 1000 ? (Math.round(d / 100) / 10) + 'km' : (Math.round(d / 10) * 10) + 'm'; }

  /* place: town.js 의 장소 한 곳 · ctx: { asOf, zones:[{id,short,dist}] }
     돌려주는 것: { total, parts:{near,proof,fresh,fit,located}, pros:[{t, q?, src?}], cons:[…], summary, n, latest } */
  function score(place, ctx) {
    var zone = null; (ctx.zones || []).forEach(function (z) { if (z.id === place.zone) zone = z; });
    var located = !!place.lat;
    var dist = located ? place.dist : (zone ? zone.dist : null);
    var ms = distinct(place.mentions), n = ms.length;
    var student = ms.some(function (m) { return STUDENT_SRC[m.src]; });
    var ages = ms.map(function (m) { return monthsAgo(m.date, ctx.asOf); }).filter(function (a) { return a != null; });
    var latest = ages.length ? Math.min.apply(null, ages) : null;
    var parts = {
      near: Math.max(0, nearPts(dist) - (located || dist == null ? 0 : 3)),   // 핀이 없으면 구역 거리로 어림 — 조금 깎는다
      proof: (n >= 4 ? 25 : n === 3 ? 22 : n === 2 ? 17 : n === 1 ? 10 : 0) + (student ? 5 : 0),
      fresh: latest == null ? 3 : latest <= 12 ? 15 : latest <= 24 ? 10 : latest <= 36 ? 6 : 3,
      fit: 0,
      located: located ? 10 : 0,
    };
    var pros = [], cons = [];
    (CONDS[place.category] || []).forEach(function (c) {
      for (var i = 0; i < ms.length; i++) {
        if (c.re.test(ms[i].q)) { (c.pro ? pros : cons).push({ t: c.pro || c.con, q: ms[i].q, src: ms[i].src }); if (c.pro) parts.fit = Math.min(MAX.fit, parts.fit + 5); return; }
      }
    });
    // 자료에서 바로 나오는 사실
    if (place.zone === 'z-campus') pros.push({ t: '학교 안에 있음' });
    else if (located && dist <= 500) pros.push({ t: '정문에서 가까움 · ' + meters(dist) });
    if (n >= 3) pros.push({ t: '여러 글에 나옴 · ' + n + '건' });
    if (!located) cons.push({ t: '위치 확인 전 — 지도에 핀이 없음' });
    if (dist != null && dist > 1200) cons.push({ t: '정문에서 멂 · ' + meters(dist) + (located ? '' : '쯤(구역 기준)') });
    if (n === 1) cons.push({ t: '근거가 글 1건뿐' });
    if (!student) cons.push({ t: '재학생이 쓴 글이 아님(리뷰·기사)' });
    if (latest != null && latest > 24) cons.push({ t: '최근 글이 ' + (latest >= 12 ? Math.floor(latest / 12) + '년' : latest + '달') + ' 넘게 전' });
    var total = parts.near + parts.proof + parts.fresh + parts.fit + parts.located;
    var where = place.zone === 'z-campus' ? '학교 안' : zone ? zone.short + ' 쪽' : (located ? '정문에서 ' + meters(dist) : '');
    var said = pros.filter(function (p) { return p.q; }).slice(0, 2).map(function (p) { return p.t; });
    var summary = (where ? where + ' · ' : '') + '글 ' + n + '건' + (said.length ? ' · ' + said.join(' · ') : '');
    return { total: total, parts: parts, pros: pros, cons: cons, summary: summary, n: n, latest: latest, dist: dist, located: located };
  }
  // 갈래별로 점수 높은 차례(같으면 가까운 곳 먼저)
  function rank(places, ctx) {
    return places.map(function (p) { return { p: p, s: score(p, ctx) }; }).sort(function (a, b) { return b.s.total - a.s.total || (a.s.dist == null ? 1e9 : a.s.dist) - (b.s.dist == null ? 1e9 : b.s.dist); });
  }
  var api = { score: score, rank: rank, MAX: MAX, CONDS: CONDS, monthsAgo: monthsAgo, distinct: distinct, PARTS: [['near', '가까움'], ['proof', '근거'], ['fresh', '최근'], ['fit', '조건'], ['located', '위치 확인']] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CampusScore = api;
})(typeof window !== 'undefined' ? window : globalThis);
