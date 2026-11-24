/* 학교 주변 지도 — 눌러 보는 시안 (play.html · 2026-11-24)
   그림 시안(index.html)의 화면 11장을 폰 한 대 안에서 서로 이어 붙였다. 화면 모양은 index.html 의 것을 그대로 쓰고(play.html 의 <template>),
   그림이 없던 주제(밥집 · 생활 · 교통 · 복지·혜택)와 장소 시트 · 목록 · 구역 화면은 같은 부품으로 자료(data.js · town.js)에서 만든다.
   🔴 지어내지 않는다 — 재학생 의견은 비어 있고, 이 기기에서 방금 남긴 것만 「내가 남긴 의견」으로 보인다(어디에도 보내지 않는다 · 탭을 닫으면 사라진다). */
(function () {
  'use strict';
  var D = window.CAMPUS_MAP, T = window.CAMPUS_TOWN, M = window.MapMock, esc = M.esc;
  var app = document.getElementById('app');
  var KEY = 'campus-map-play-v1';

  // ───────── 상태(이 탭에만) ─────────
  var S = { verified: false, ops: {}, sug: [], done: ['n6046633874', 'n5547152189'], justSent: false };
  try { var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (saved) S = saved; } catch (e) {}
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var stack = [{ name: 'intro' }];
  var maps = [];
  var pendingAfterVerify = null;

  // ───────── 자료 찾기 ─────────
  var THEME_TPL = { '학교 안': 's2', '카공': 's3', '술집·과팅': 's5', '안전': 's6' };
  var HOLD = { 't-p008': 1 };   // 중앙도서관 쉼터 — 신축 공사 기사가 있어 확인 뒤에 올린다(그림 시안 ③ 메모)
  var NAME2ID = {
    '도서관/정보전산원': 'w382499365', '제2학생회관': 'w382499348', '제1학생회관': 'w382499358',
    '공릉터널 보행로 안전비상벨': 'pd-bell-w199637113', '공릉치안센터': 'n368602672', '하계1치안센터': 'n368602233',
    '원자력병원': 'pd-kiosk-410-r5689751', '공릉1동주민센터': 'pd-kiosk-103-w258026356',
    '공릉역(서울과학기술대)': 'n6046633874', '서울과학기술대학교정문앞': 'n5547152189',
  };
  var RENAME = { 'pd-kiosk-410-r5689751': '원자력병원 무인민원발급기', 'pd-kiosk-103-w258026356': '공릉1동주민센터 무인민원발급기', 'pd-kiosk-401-w579134079': '노원문화원 무인민원발급기', 'pd-kiosk-405-w570198783': '을지병원 무인민원발급기', 'pd-bell-w199637113': '공릉터널 보행로 안전비상벨', 'n6046633874': '공릉역' };
  var CATLABEL = {
    building: '건물', student_center: '학생회관', dormitory: '기숙사', facility: '교내 시설', library: '도서관', reading_room: '열람실', cafe: '카페',
    convenience: '편의점', supermarket: '마트', coin_laundry: '빨래방', pharmacy: '약국', doctors: '의원', hospital: '병원', dentist: '치과',
    post_office: '우체국', bank: '은행', atm: 'ATM', dong_office: '주민센터', civil_kiosk: '무인민원발급기', police: '경찰', emergency_bell: '비상벨',
    fire_station: '소방서', station: '지하철역', subway_entrance: '지하철 출입구', bus_stop: '버스 정류장', bicycle_rental: '따릉이 대여소',
    restaurant: '식당', fast_food: '식당', gate: '문', health: '보건', toilets: '화장실', construction: '공사 중',
  };
  var SRCNAME = { '학보': '서울과기대신문', '영자신문': '서울과기대 영자신문', '뽈레': '뽈레', '학교 공식': '학교 공식 안내', '서울시': '서울시', '기사': '기사' };
  var SRCSHORT = { '뽈레': '리뷰' };
  var WORDS = {
    '카공': ['콘센트 많아요', '조용해요', '대화해도 돼요', '자리 넉넉해요', '늦게까지 해요', '오래 있어도 돼요'],
    '카페': ['콘센트 많아요', '조용해요', '대화해도 돼요', '자리 넉넉해요', '늦게까지 해요', '오래 있어도 돼요'],
    '밥집': ['혼밥 편해요', '양 많아요', '값이 착해요', '빨리 나와요', '늦게까지 해요', '단체도 돼요'],
    '술집': ['단체 자리 있어요', '값이 착해요', '얘기하기 좋아요', '늦게까지 해요', '안주가 좋아요', '역에서 가까워요'],
    '_': ['찾기 쉬워요', '친절해요', '기다림이 짧아요', '늦게까지 해요', '신입생에게 추천해요'],
  };
  var townAll = T.places.concat(T.unplaced).filter(function (p) { return !HOLD[p.id]; });
  function findPlace(key) {
    if (!key) return null;
    var p = M.byId(key) || M.byId(NAME2ID[key]);
    if (p) return p;
    var i;
    for (i = 0; i < townAll.length; i++) if (townAll[i].id === key || townAll[i].name === key) return townAll[i];
    for (i = 0; i < D.pois.length; i++) if (D.pois[i].name === key) return D.pois[i];
    for (i = 0; i < townAll.length; i++) if (townAll[i].name.indexOf(key) === 0 || key.indexOf(townAll[i].name) === 0) return townAll[i];
    return null;
  }
  function disp(p) { return RENAME[p.id] || p.name; }
  function isTown(p) { return p && String(p.id).indexOf('t-') === 0; }
  function zoneOf(id) { for (var i = 0; i < T.zones.length; i++) if (T.zones[i].id === id) return T.zones[i]; return null; }
  function catOf(p, theme) { return isTown(p) ? p.category : (CATLABEL[p.cat] || theme || '장소'); }
  function iconOf(p) { return isTown(p) ? p.category : p.cat; }
  function meters(d) { return d < 30 ? '바로 앞' : d >= 1000 ? (Math.round(d / 100) / 10) + 'km' : (Math.round(d / 10) * 10) + 'm'; }
  function right(p) {
    if (p.lat) return meters(p.dist);
    var z = zoneOf(p.zone); return z ? (z.id === 'z-campus' ? '학교 안' : z.short + ' 쪽') : '';
  }
  function fmtDate(d) { var m = /^\d{4}(-\d{2}){0,2}/.exec(String(d || '')); return m ? m[0].replace(/-/g, '.') : ''; }
  function cut(q, n) { return q.length > n ? q.slice(0, n) + '…' : q; }
  var GO = '<span class="go" data-go></span>';
  function rowHtml(p, theme) {
    var m = isTown(p) && p.mentions && p.mentions[0];
    var op = S.ops[p.id];
    var sub = m ? '<small><i>' + esc(SRCSHORT[m.src] || m.src) + '</i> 「' + esc(m.q) + '」</small>'
      : '<small>' + esc(CATLABEL[p.cat] || '') + '</small>';
    var mine = op && op.tags.length ? '<em class="op-n">' + esc(op.tags[0]) + ' 1' + (op.tags.length > 1 ? ' 외 ' + (op.tags.length - 1) : '') + '</em>' : '';
    return '<li class="' + (m ? 'q2' : '') + '" data-act="place" data-key="' + esc(p.id) + '" data-theme="' + esc(theme || '') + '"><span class="pi" data-icon="' + esc(iconOf(p)) + '"></span><span class="pt"><b>' + esc(disp(p)) + '</b>' + sub + mine + '</span><span class="pd">' + esc(right(p)) + '</span>' + GO + '</li>';
  }
  function suggestRow(theme) { return '<li class="suggest" data-act="suggest" data-theme="' + esc(theme || '') + '"><span class="pi" data-icon="plus"></span><span class="pt"><b>빠진 곳 제안하기</b></span>' + GO + '</li>'; }
  var NAV = '<nav class="bottom-nav" data-tab="home" aria-label="하단 탭"></nav>';
  var CREDIT = '<span class="m-credit">© OpenStreetMap</span>';
  function topHtml(theme) { return '<div class="ms-top"><header data-subhead="학교 주변"></header><div data-chips="' + esc(theme) + '"></div></div>'; }
  function mapHtml(cfg) { return '<div class="m-map" data-map=\'' + JSON.stringify(cfg).replace(/'/g, '&#39;') + '\'></div>'; }
  function tpl(id) { var t = document.getElementById('tpl-' + id); return { html: t.innerHTML, mapTop: t.getAttribute('data-map-top') || '' }; }
  function nearest(cat, n, maxDist) {
    return D.pois.filter(function (p) { return p.cat === cat && p.name && (!maxDist || p.dist <= maxDist); }).sort(function (a, b) { return a.dist - b.dist; })
      .filter(function (p, i, arr) { return arr.findIndex(function (q) { return q.name === p.name; }) === i; }).slice(0, n);
  }

  // ───────── 주제별 자료(그림이 없던 주제 + 「목록 보기」) ─────────
  function themeData(theme) {
    var town = function (cat, f) { return townAll.filter(function (p) { return p.category === cat && (!f || f(p)); }).sort(function (a, b) { return (a.lat ? a.dist : 1e6) - (b.lat ? b.dist : 1e6); }); };
    var notTransit = function (p) { return p.kind !== '교통'; };
    if (theme === '밥집') return { head: '학보·리뷰에 나온 밥집 <b>' + town('밥집').length + '</b>곳', groups: [{ rows: town('밥집') }], dots: { layers: ['campus'], cats: { campus: ['restaurant'] } } };
    if (theme === '복지·혜택') return { head: '학보에 나온 복지·혜택 <b>' + town('복지·혜택').length + '</b>곳', groups: [{ rows: town('복지·혜택') }], dots: {}, memo: '장학·복지 공고와 제휴 혜택 글은 관리자가 확인한 뒤 장소에 잇습니다(11-23 결정).' };
    if (theme === '생활') {
      var near = [].concat(nearest('convenience', 1), nearest('pharmacy', 1), nearest('doctors', 1), nearest('coin_laundry', 1), nearest('bank', 1), nearest('post_office', 1), nearest('supermarket', 1)).sort(function (a, b) { return a.dist - b.dist; });
      return { head: '가까운 생활 시설 · 거리는 정문에서', groups: [{ title: '종류마다 가장 가까운 곳', rows: near }, { title: '학보·학교 안내에 나온 곳', rows: town('생활', notTransit) }], dots: { layers: ['life'], maxDist: 600 }, pinsFrom: near };
    }
    if (theme === '교통') {
      var tr = [].concat(nearest('station', 2), nearest('bus_stop', 2), nearest('bicycle_rental', 2)).sort(function (a, b) { return a.dist - b.dist; });
      return { head: '가까운 역·정류장 · 거리는 정문에서', groups: [{ title: '가까운 곳', rows: tr }, { title: '학보·학교 안내에 나온 길', rows: town('생활', function (p) { return p.kind === '교통'; }) }], dots: { layers: ['transit'], maxDist: 500 }, pinsFrom: tr };
    }
    if (theme === '카공') return { groups: [{ title: '학보·리뷰에 나온 곳', rows: town('카공') }, { title: '그 밖의 카페·도서관 (공개 지도 · 이름과 위치만)', rows: D.pois.filter(function (p) { return p.layer === 'study' && p.name && p.dist <= 900; }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, 12) }] };
    if (theme === '술집·과팅') return { groups: [{ title: '학보·리뷰에 나온 술집', rows: town('술집') }, { title: '과팅 장소', empty: '추천된 곳이 아직 없어요' }, { title: '공개 지도의 주점 (이름과 위치만)', plain: T.bars.map(function (b) { return { name: b.name, right: meters(b.dist) }; }) }] };
    if (theme === '안전') return { groups: [{ title: '정문에서 가까운 차례', rows: D.pois.filter(function (p) { return p.layer === 'safety' && p.name; }).sort(function (a, b) { return a.dist - b.dist; }) }] };
    return { groups: [{ title: '학교 안 건물 · 정문에서 가까운 차례', rows: D.pois.filter(function (p) { return p.layer === 'campus' && p.name && ['building', 'student_center', 'library', 'dormitory', 'facility'].indexOf(p.cat) >= 0; }).sort(function (a, b) { return a.dist - b.dist; }).slice(0, 30) }] };
  }
  function genTheme(theme) {
    var d = themeData(theme);
    var rows = []; d.groups.forEach(function (g) { (g.rows || []).forEach(function (p) { rows.push(p); }); });
    var pins = (d.pinsFrom || rows).filter(function (p) { return p.lat; }).slice(0, 7);
    var cfg = { center: 'gate', zoom: 16.25, layers: (d.dots.layers || []), pins: pins.map(function (p) { return p.id; }), labels: pins.slice(0, 2).map(function (p) { return p.id; }), rename: RENAME };
    if (d.dots.cats) cfg.cats = d.dots.cats;
    if (d.dots.maxDist) cfg.maxDist = d.dots.maxDist;
    var html = topHtml(theme) + mapHtml(cfg) + CREDIT + '<section class="ms-panel"><div class="sheet-handle"></div>' +
      '<div class="p-head"><p class="p-sum">' + d.head + '</p><button class="link-btn" data-act="list">목록 보기 ›</button></div>' +
      '<ul class="place-list">' + rows.slice(0, 3).map(function (p) { return rowHtml(p, theme); }).join('') + suggestRow(theme) + '</ul>' +
      (d.memo ? '<p class="plan-slot"><span class="plan-tag">시안 메모</span>' + esc(d.memo) + '</p>' : '') + '</section>' + NAV;
    return { html: html, mapTop: '138px' };
  }

  // ───────── 화면 ─────────
  var SCREENS = {
    intro: function () {
      return { html: '<div class="app-scroll intro"><p class="kicker">한대장 · 눌러 보는 시안 · 3판</p><h1>학교 주변 지도</h1>' +
        '<p class="lead">서울과학기술대학교 1학년 화면입니다. 실제 앱처럼 눌러서 넘겨 보세요.</p>' +
        '<ul class="try"><li><b>홈</b>의 「우리 학교 주변」 세 줄에서 들어갑니다</li><li><b>주제 칩</b>을 누르면 지도가 바뀝니다 — 학교 안 · 카공 · 밥집 · 술집·과팅 · 생활 · 안전 · 교통 · 복지·혜택</li><li><b>핀이나 목록 줄</b>을 누르면 그 장소가 열립니다 — 목록은 손잡이를 누르면 펼쳐집니다</li><li><b>의견 남기기 · 빠진 곳 제안하기</b>를 직접 해 볼 수 있습니다</li><li><b>대학가 한눈에</b>에서 구역을 누르면 그 구역의 장소가 나옵니다</li></ul>' +
        '<p class="fine">남긴 의견·제안은 이 화면에만 잠깐 남고 어디에도 보내지 않습니다. 학생들의 말은 학보 등 출처의 구절 그대로이고, 재학생 의견은 처음엔 비어 있습니다.</p>' +
        '<button class="btn btn-primary btn-lg" data-act="start">시작하기</button>' +
        '<a class="sheet-link" href="index.html">설명이 붙은 그림 시안 보기 ›</a></div>' };
    },
    home: function () {
      var t = tpl('s1'); var box = document.createElement('div'); box.innerHTML = t.html;
      var rows = box.querySelectorAll('.near-rows li');
      rows[0].setAttribute('data-act', 'map'); rows[0].setAttribute('data-theme', '학교 안');
      rows[1].setAttribute('data-act', 'course'); rows[1].querySelector('small').textContent = '다섯 곳 중 ' + S.done.length + '곳 다녀옴';
      rows[2].setAttribute('data-act', 'zones');
      var card = box.querySelector('.sch-card'); if (card) { card.setAttribute('data-act', 'docs'); }
      var misc = box.querySelectorAll('.link-btn, .save-btn, .card-src-link');
      for (var i = 0; i < misc.length; i++) { misc[i].setAttribute('data-act', 'toast'); misc[i].setAttribute('data-msg', '이 시안은 「우리 학교 주변」만 다룹니다'); }
      return { html: box.innerHTML };
    },
    map: function (st) {
      var id = THEME_TPL[st.theme];
      if (!id) return genTheme(st.theme);
      var t = tpl(id); var box = document.createElement('div'); box.innerHTML = t.html;
      var lis = box.querySelectorAll('.place-list li');
      for (var i = 0; i < lis.length; i++) {
        if (lis[i].classList.contains('suggest')) { lis[i].setAttribute('data-act', 'suggest'); lis[i].setAttribute('data-theme', st.theme); continue; }
        var name = lis[i].querySelector('.pt b').textContent;
        lis[i].setAttribute('data-act', 'place'); lis[i].setAttribute('data-key', name); lis[i].setAttribute('data-theme', st.theme);
        var p = findPlace(name), op = p && S.ops[p.id];
        if (op && op.tags.length) lis[i].querySelector('.pt').insertAdjacentHTML('beforeend', '<em class="op-n">' + esc(op.tags[0]) + ' 1' + (op.tags.length > 1 ? ' 외 ' + (op.tags.length - 1) : '') + '</em>');
      }
      var lb = box.querySelector('.p-head .link-btn'); if (lb) lb.setAttribute('data-act', 'list');
      if (st.theme === '안전' && !lb) box.querySelector('.p-group').insertAdjacentHTML('beforeend', ' <button class="link-btn inline" data-act="list">목록 보기 ›</button>');
      return { html: box.innerHTML, mapTop: t.mapTop };
    },
    place: function (st) {
      var p = findPlace(st.key), theme = st.theme || '학교 안';
      var name = p ? disp(p) : st.key;
      var chipTheme = THEME_TPL[theme] || ['밥집', '생활', '교통', '복지·혜택'].indexOf(theme) >= 0 ? theme : '';
      var cfg = p && p.lat ? { center: [p.lat, p.lon], zoom: 16.5, offset: [0, 250], layers: [], pins: [p.id], focus: p.id, gate: false, rename: RENAME }
        : { center: 'gate', zoom: 15.5, offset: [0, 250], layers: [], pins: [] };
      var where = [];
      if (p) {
        var z = isTown(p) && zoneOf(p.zone);
        if (z) where.push(z.id === 'z-campus' ? '학교 안' : z.short);
        if (!isTown(p) && CATLABEL[p.cat]) where.push(CATLABEL[p.cat]);
        where.push(p.lat ? (p.dist < 30 ? '정문 바로 앞' : '정문에서 ' + right(p)) : '위치 확인 전 — 핀 없이 목록에만 있어요');
        if (p.hours && /[가-힣]/.test(p.hours)) where.push(p.hours.replace(/00:00-24:?00/g, '24시간'));
      }
      var op = p && S.ops[p.id];
      var sec1 = '<section class="sheet-sec"><h4>재학생 의견</h4>' +
        (op ? '<p class="mine-note">내가 남긴 의견 · 시안이라 이 화면에만 보여요</p>' +
          (op.tags.length ? '<div class="tag-counts">' + op.tags.map(function (t) { return '<span>' + esc(t) + ' <b>1</b></span>'; }).join('') + '</div>' : '') +
          (op.text ? '<ul class="op-list"><li>' + esc(op.text) + '<small>방금</small></li></ul>' : '')
          : '<p class="empty-line">아직 의견이 없어요</p>') +
        '<button class="btn-ghost btn-wide" data-act="opine">' + (op ? '의견 고치기' : '의견 남기기') + '</button></section>';
      var sec2 = '';
      if (p && isTown(p) && p.mentions.length) {
        var qs = p.mentions.map(function (m, i) {
          var meta = '<small><b>' + esc(SRCNAME[m.src] || m.src) + (m.url ? ' ↗' : '') + '</b>' + (fmtDate(m.date) ? ' · ' + fmtDate(m.date) : '') + '</small>';
          return (m.url ? '<a class="quote-row' + (i ? ' more' : '') + '" href="' + esc(m.url) + '" target="_blank" rel="noopener">' : '<div class="quote-row' + (i ? ' more' : '') + '">') + '「' + esc(m.q) + '」' + meta + (m.url ? '</a>' : '</div>');
        }).join('');
        sec2 = '<section class="sheet-sec quotes"><h4>학보·리뷰에서</h4>' + qs + (p.mentions.length > 1 ? '<button class="link-btn more-btn" data-act="more-quotes">구절 ' + (p.mentions.length - 1) + '개 더 보기</button>' : '') + '</section>';
      }
      var sec3 = '';
      if (p && p.id === 't-p005') { var n = document.getElementById('tpl-s4').content.querySelector('.news-row'); if (n) sec3 = n.closest('.sheet-sec').outerHTML; }
      var foot = (p && p.lat ? '<a class="btn-ghost btn-wide" href="https://map.kakao.com/link/to/' + encodeURIComponent(name) + ',' + p.lat + ',' + p.lon + '" target="_blank" rel="noopener">길찾기 ↗</a>' : '') +
        '<a class="sheet-link" href="#" data-act="report">틀린 정보 알리기 ›</a>';
      var html = (chipTheme ? topHtml(chipTheme) : '<div class="ms-top"><header data-subhead="학교 주변"></header></div>') + mapHtml(cfg) + CREDIT +
        '<section class="ms-panel sheet tall"><div class="sheet-handle" data-act="back"></div>' +
        '<div class="sch-top sheet-top" style="padding-right:0"><span class="badge badge-kind">' + esc(p ? catOf(p, theme) : theme) + '</span></div>' +
        '<h3 class="sheet-title">' + esc(name) + '</h3><p class="place-where">' + esc(where.join(' · ')) + '</p>' + sec1 + sec2 + sec3 + foot + '</section>' + NAV;
      return { html: html, mapTop: chipTheme ? '138px' : '64px', pid: p ? p.id : null };
    },
    course: function () {
      var t = tpl('s8'); var box = document.createElement('div'); box.innerHTML = t.html;
      var mapEl = box.querySelector('[data-map]'); var cfg = JSON.parse(mapEl.getAttribute('data-map'));
      cfg.done = S.done.slice(); mapEl.setAttribute('data-map', JSON.stringify(cfg));
      var lis = box.querySelectorAll('.check-list li');
      for (var i = 0; i < lis.length; i++) { var id = cfg.route[i]; lis[i].setAttribute('data-act', 'check'); lis[i].setAttribute('data-id', id); lis[i].classList.toggle('checked', S.done.indexOf(id) >= 0); }
      box.querySelector('.ms-sub').textContent = '다섯 곳 중 ' + S.done.length + '곳 다녀옴 · 줄을 누르면 체크돼요';
      return { html: box.innerHTML, mapTop: t.mapTop };
    },
    zones: function () {
      var t = tpl('s9'); var box = document.createElement('div'); box.innerHTML = t.html;
      var ids = ['z-rail', 'z-hyeopdong', 'z-nowon']; var lis = box.querySelectorAll('.place-list li');
      for (var i = 0; i < lis.length; i++) { lis[i].setAttribute('data-act', 'zone'); lis[i].setAttribute('data-zid', ids[i]); }
      box.querySelector('.p-head .link-btn').setAttribute('data-act', 'zone-list');
      return { html: box.innerHTML, mapTop: t.mapTop };
    },
    zone: function (st) {
      var z = zoneOf(st.zid); var rows = townAll.filter(function (p) { return p.zone === z.id; }).sort(function (a, b) { return (a.lat ? a.dist : 1e6) - (b.lat ? b.dist : 1e6); });
      var pins = rows.filter(function (p) { return p.lat; }).slice(0, 6);
      var cfg = { center: [z.lat, z.lon], zoom: 15.75, offset: [0, 140], layers: [], zones: [z.id], zoneFocus: [z.id], zoneLabels: false, pins: pins.map(function (p) { return p.id; }), labels: pins.slice(0, 2).map(function (p) { return p.id; }), gate: z.dist < 700 };
      var say = z.say && z.say[0];
      var html = '<div class="ms-top"><header data-subhead="' + esc(z.short) + '" style="margin-bottom:2px"></header><p class="ms-sub" style="margin:0 0 4px 32px">대학가 구역 · ' + (z.dist < 30 ? '정문 바로 앞' : '정문에서 ' + meters(z.dist)) + '</p></div>' +
        mapHtml(cfg) + CREDIT + '<section class="ms-panel zone-panel"><div class="sheet-handle"></div>' +
        (say ? '<a class="quote-row zone-say" href="' + esc(say.url || '#') + '" target="_blank" rel="noopener">「' + esc(say.q) + '」<small><b>' + esc(SRCNAME[say.src] || say.src) + ' ↗</b>' + (fmtDate(say.date) ? ' · ' + fmtDate(say.date) : '') + '</small></a>' : '') +
        '<p class="p-group" style="margin-top:12px">이 구역에서 나온 곳 ' + rows.length + '곳</p>' +
        (rows.length ? '' : '<p class="empty-line">아직 나온 곳이 없어요</p>') +
        '<ul class="place-list">' + rows.map(function (p) { return rowHtml(p, p.category); }).join('') + suggestRow('') + '</ul></section>' + NAV;
      return { html: html, mapTop: '100px' };
    },
    docs: function () {
      var t = tpl('s7'); var box = document.createElement('div'); box.innerHTML = t.html;
      var lis = box.querySelectorAll('.place-list li');
      for (var i = 0; i < lis.length; i++) {
        var name = lis[i].querySelector('.pt b').textContent;
        if (name === '정부24') { lis[i].setAttribute('data-act', 'ext'); lis[i].setAttribute('data-url', 'https://www.gov.kr'); }
        else { lis[i].setAttribute('data-act', 'place'); lis[i].setAttribute('data-key', name); lis[i].setAttribute('data-theme', '생활'); }
      }
      return { html: box.innerHTML, mapTop: t.mapTop };
    },
    suggest: function (st) {
      var t = tpl('s10'); var box = document.createElement('div'); box.innerHTML = t.html;
      var ins = box.querySelectorAll('.f-input');
      ins[0].outerHTML = '<input class="f-input" id="sg-name" type="text" maxlength="40" placeholder="가게·장소 이름" autocomplete="off">';
      ins[1].outerHTML = '<input class="f-input" id="sg-text" type="text" maxlength="60" placeholder="왜 좋은지 한 줄" autocomplete="off">';
      var groups = box.querySelectorAll('.pick-chips'); groups[0].id = 'sg-theme'; groups[1].id = 'sg-zone';
      var pre = { '술집·과팅': '술집', '카공': '카공', '밥집': '밥집', '생활': '생활', '복지·혜택': '복지·혜택', '카페': '카페', '놀거리': '놀거리', '술집': '술집' }[st.theme] || '';
      var cs = groups[0].querySelectorAll('.chip'); for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('active', cs[i].textContent === pre);
      box.querySelector('.btn-primary').setAttribute('data-act', 'send-suggest');
      return { html: box.innerHTML };
    },
    sent: function () {
      var list = S.sug.length ? '<ul class="sent-list">' + S.sug.slice().reverse().map(function (s) { return '<li><b class="real">' + esc(s.name) + '<small>' + esc([s.theme, s.zone].filter(Boolean).join(' · ')) + '</small></b><span class="st">접수</span></li>'; }).join('') + '</ul>' : '<p class="empty-line" style="margin-top:14px">아직 보낸 제안이 없어요</p>';
      var just = S.justSent; S.justSent = false; save();
      return { html: '<div class="app-scroll form-screen"><header data-subhead="내가 보낸 제안"></header>' +
        (just ? '<h3 class="sent-h">보냈어요. 확인되면 지도에 실려요</h3>' : '') + list +
        '<p class="fine" style="margin-top:16px">운영자가 확인하면 「지도에 실림」, 싣지 않으면 「실리지 않음」으로 바뀌고 알림이 가요. 시안이라 실제로 보내지는 않았습니다.</p>' +
        '<button class="btn-ghost btn-wide" data-act="back" style="margin-top:18px">지도로 돌아가기</button></div>' + NAV };
    },
  };

  // ───────── 그리기 ─────────
  function closeOverlay() { var o = app.querySelectorAll('.ov'); for (var i = 0; i < o.length; i++) o[i].remove(); }
  function openOverlay(html, cls) {
    closeOverlay();
    app.insertAdjacentHTML('beforeend', '<div class="sheet-backdrop show ov" data-act="close"></div><section class="ms-panel sheet over ov ' + (cls || '') + '"><div class="sheet-handle" data-act="close"></div>' + html + '</section>');
    M.fillUi();
  }
  function toast(msg) {
    var old = app.querySelector('.p-toast'); if (old) old.remove();
    var el = document.createElement('div'); el.className = 'p-toast'; el.textContent = msg; app.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 2400);
  }
  function render() {
    maps.forEach(function (m) { try { m.remove(); } catch (e) {} }); maps = [];
    var top = stack[stack.length - 1];
    var out = SCREENS[top.name](top);
    app.innerHTML = out.html;
    app.style.setProperty('--map-top', out.mapTop || '108px');
    app.setAttribute('data-screen', top.name);
    M.fillUi();
    // 화면이 낮은 기기(휴대폰 브라우저)에서는 목록 판을 낮게 시작한다 — 지도가 먼저 보이게. 판 안에서 굴리거나 손잡이를 눌러 편다.
    var pn = app.querySelector('.ms-panel:not(.sheet)');
    if (pn && app.clientHeight < 760) pn.classList.add('peek');
    var els = app.querySelectorAll('[data-map]');
    for (var i = 0; i < els.length; i++) {
      try { maps.push(els[i].closest('.thumb') ? M.mount(els[i]) : frame(els[i])); } catch (e) { console.error('지도 그리기 실패', e); }
    }
    var side = document.getElementById('where'); if (side) side.textContent = ({ intro: '안내', home: '① 홈', map: '지도 — ' + (top.theme || ''), place: '장소 시트', course: '⑧ 신입생 첫 주 코스', zones: '⑨ 대학가 한눈에', zone: '구역', docs: '⑦ 서류 떼는 곳', suggest: '⑩ 장소 제안', sent: '내가 보낸 제안' })[top.name] || '';
  }
  // 지도 보기 맞추기 — 아래 판에 가리지 않는 칸 안에 핀(또는 구역)이 다 보이게. 화면 높이가 기기마다 달라 그림 시안의 고정 값(offset)을 쓰지 않는다.
  // 구역 이름표는 그릴 때의 확대 값으로 자리를 잡으므로, 확대 값이 달라지면 지도를 한 번 다시 그린다.
  function frame(el) {
    var cfg = JSON.parse(el.getAttribute('data-map') || '{}');
    var m = M.mount(el);
    var panel = app.querySelector('.ms-panel');
    var mapH = el.clientHeight, visH = panel ? Math.max(80, panel.offsetTop - el.offsetTop) : mapH, hidden = Math.max(0, mapH - visH);
    var pts = [];
    (cfg.pins || []).forEach(function (id) { var p = M.byId(id); if (p && p.lat) pts.push([p.lat, p.lon]); });
    if (cfg.zones) T.zones.forEach(function (z) { if (z.id !== 'z-campus' && (cfg.zones === 'all' || cfg.zones.indexOf(z.id) >= 0)) pts.push([z.lat, z.lon]); });
    if (cfg.bars) T.bars.forEach(function (b) { if (!cfg.maxDist || b.dist <= cfg.maxDist) pts.push([b.lat, b.lon]); });
    if (cfg.gate !== false && !cfg.focus) pts.push([D.gate.lat, D.gate.lon]);
    if (!pts.length) pts.push(m.getCenter());
    var maxZ = cfg.zoom || 16;
    if (pts.length === 1) { m.setView(pts[0], maxZ, { animate: false }); m.panBy([0, hidden / 2], { animate: false }); return m; }
    var bounds = L.latLngBounds(pts), padX = cfg.zones === 'all' ? 150 : 110, padTop = cfg.zones ? 48 : 40;
    var z = Math.min(maxZ, m.getBoundsZoom(bounds, false, L.point(padX, hidden + padTop + 34)));
    if (cfg.zones && Math.abs(z - m.getZoom()) > 0.01) { m.remove(); cfg.zoom = z; delete cfg.offset; el.setAttribute('data-map', JSON.stringify(cfg)); m = M.mount(el); }
    m.fitBounds(bounds, { paddingTopLeft: [padX / 2, padTop], paddingBottomRight: [padX / 2, hidden + 34], maxZoom: z, animate: false });
    if (cfg.zones) { cfg.zoom = m.getZoom(); el.setAttribute('data-map', JSON.stringify(cfg)); watchZoom(el, m); }
    return m;
  }
  // 구역 지도를 손으로 확대·축소하면 이름표 자리를 새 확대 값으로 다시 잡는다(같은 자리에서 지도만 다시 그린다)
  function watchZoom(el, m) {
    m.on('zoomend', function () {
      var cfg = JSON.parse(el.getAttribute('data-map')), z = m.getZoom(), c = m.getCenter();
      if (Math.abs(z - cfg.zoom) < 0.01) return;
      setTimeout(function () {
        var i = maps.indexOf(m); try { m.remove(); } catch (e) {}
        cfg.zoom = z; cfg.center = [c.lat, c.lng]; delete cfg.offset; el.setAttribute('data-map', JSON.stringify(cfg));
        var m2 = M.mount(el); if (i >= 0) maps[i] = m2; watchZoom(el, m2);
      }, 0);
    });
  }
  function go(name, params) { var s = params || {}; s.name = name; stack.push(s); render(); }
  function replace(name, params) { stack.pop(); go(name, params); }
  function back() { if (stack.length > 1) stack.pop(); else stack = [{ name: 'home' }]; render(); }
  function curTheme() { for (var i = stack.length - 1; i >= 0; i--) if (stack[i].name === 'map') return stack[i].theme; return ''; }
  function withVerify(next) {
    if (S.verified) return next();
    pendingAfterVerify = next;
    openOverlay('<h3 class="sheet-title" style="margin-top:4px">재학생만 남길 수 있어요</h3><p class="place-where">학교 메일로 한 번만 확인하면 돼요. 지도를 보는 것은 누구나 할 수 있어요.</p>' +
      '<input class="f-input" type="email" placeholder="학교 메일 (@seoultech.ac.kr)" autocomplete="off" style="margin-top:16px">' +
      '<button class="btn btn-primary btn-lg" data-act="verify-ok" style="margin-top:14px">확인 메일 받기</button>' +
      '<p class="f-note">시안에서는 메일을 보내지 않고 바로 확인된 것으로 넘어갑니다.</p>');
  }

  // ───────── 누르기 ─────────
  var ACT = {
    start: function () { stack = [{ name: 'home' }]; render(); },
    back: function () { back(); },
    close: function () { closeOverlay(); },
    toast: function (el) { toast(el.getAttribute('data-msg')); },
    ext: function (el) { window.open(el.getAttribute('data-url'), '_blank', 'noopener'); },
    map: function (el) { go('map', { theme: el.getAttribute('data-theme') }); },
    course: function () { go('course'); },
    zones: function () { go('zones'); },
    docs: function () { go('docs'); toast('공고 시트 「접수 › 서류」의 「떼는 곳 ›」에서 들어오는 화면입니다'); },
    zone: function (el) { go('zone', { zid: el.getAttribute('data-zid') }); },
    place: function (el) { closeOverlay(); go('place', { key: el.getAttribute('data-key'), theme: el.getAttribute('data-theme') || curTheme() }); },
    check: function (el) { var id = el.getAttribute('data-id'), i = S.done.indexOf(id); if (i >= 0) S.done.splice(i, 1); else S.done.push(id); save(); render(); },
    list: function () {
      var theme = curTheme(), d = themeData(theme);
      openOverlay('<h3 class="sheet-title" style="margin-top:4px">' + esc(theme) + '</h3>' + d.groups.map(function (g) {
        return (g.title ? '<p class="p-group" style="margin-top:14px">' + esc(g.title) + '</p>' : '') +
          (g.empty ? '<p class="empty-line">' + esc(g.empty) + '</p>' : '') +
          '<ul class="place-list">' + (g.rows || []).map(function (p) { return rowHtml(p, theme); }).join('') +
          (g.plain || []).map(function (r) { return '<li class="plain"><span class="pi" data-icon="술집"></span><span class="pt"><b>' + esc(r.name) + '</b></span><span class="pd">' + esc(r.right) + '</span></li>'; }).join('') + '</ul>';
      }).join('') + '<ul class="place-list" style="margin-top:6px">' + suggestRow(theme) + '</ul>', 'list');
    },
    'zone-list': function () {
      openOverlay('<h3 class="sheet-title" style="margin-top:4px">학생들이 부르는 구역</h3><ul class="place-list">' + T.zones.filter(function (z) { return z.id !== 'z-campus'; }).map(function (z) {
        var m = z.say && z.say[0];
        return '<li class="q2" data-act="zone" data-zid="' + z.id + '"><span class="pt"><b>' + esc(z.short) + '</b>' + (m ? '<small><i>' + esc(SRCSHORT[m.src] || m.src) + '</i> 「' + esc(m.q) + '」</small>' : '') + '</span><span class="pd">' + meters(z.dist) + '</span>' + GO + '</li>';
      }).join('') + '</ul>', 'list');
    },
    'more-quotes': function (el) { el.closest('.quotes').classList.add('open'); el.remove(); },
    suggest: function (el) { var theme = el.getAttribute('data-theme') || curTheme(); closeOverlay(); withVerify(function () { go('suggest', { theme: theme }); }); },
    'verify-ok': function () { S.verified = true; save(); closeOverlay(); toast('재학생으로 확인됐어요'); var n = pendingAfterVerify; pendingAfterVerify = null; if (n) setTimeout(n, 350); },
    'send-suggest': function () {
      var name = (document.getElementById('sg-name').value || '').trim();
      if (!name) { toast('장소 이름을 적어 주세요'); document.getElementById('sg-name').focus(); return; }
      var th = app.querySelector('#sg-theme .chip.active'), zn = app.querySelector('#sg-zone .chip.active');
      if (!th) { toast('주제를 하나 골라 주세요'); return; }
      S.sug.push({ name: name, theme: th.textContent, zone: zn ? zn.textContent : '', text: (document.getElementById('sg-text').value || '').trim() });
      S.justSent = true; save(); replace('sent');
    },
    opine: function () {
      var top = stack[stack.length - 1]; var p = findPlace(top.key); if (!p) { toast('이 장소는 아직 의견을 받을 수 없어요'); return; }
      withVerify(function () {
        var words = WORDS[isTown(p) ? p.category : '_'] || WORDS._; var op = S.ops[p.id] || { tags: [], text: '' };
        openOverlay('<h3 class="sheet-title" style="margin-top:4px">' + esc(disp(p)) + '</h3>' +
          '<label class="f-label" style="margin-top:14px">어땠나요? (여러 개 고를 수 있어요)</label><div class="pick-chips multi" id="op-tags">' +
          words.map(function (w) { return '<span class="chip' + (op.tags.indexOf(w) >= 0 ? ' active' : '') + '">' + esc(w) + '</span>'; }).join('') + '</div>' +
          '<label class="f-label">한 줄 의견 (선택)</label><input class="f-input" id="op-text" type="text" maxlength="60" placeholder="다른 학생에게 알려 주고 싶은 것" autocomplete="off" value="' + esc(op.text) + '">' +
          '<button class="btn btn-primary btn-lg" data-act="send-opinion" style="margin-top:20px">의견 보내기</button>');
      });
    },
    'send-opinion': function () {
      var top = stack[stack.length - 1]; var p = findPlace(top.key);
      var tags = [].map.call(app.querySelectorAll('#op-tags .chip.active'), function (c) { return c.textContent; });
      var text = (document.getElementById('op-text').value || '').trim();
      if (!tags.length && !text) { toast('하나 이상 고르거나 한 줄을 적어 주세요'); return; }
      S.ops[p.id] = { tags: tags, text: text }; save(); render(); toast('의견을 남겼어요');
    },
    report: function () {
      openOverlay('<h3 class="sheet-title" style="margin-top:4px">틀린 정보 알리기</h3><ul class="place-list">' + ['문 닫았어요', '위치가 달라요', '이름이 달라요'].map(function (w) { return '<li data-act="report-pick"><span class="pt"><b>' + w + '</b></span>' + GO + '</li>'; }).join('') + '</ul><p class="f-note" style="text-align:left">세 명이 알리면 지도에서 내리고 운영자가 확인해요.</p>');
    },
    'report-pick': function () { closeOverlay(); withVerify(function () { toast('알려 주셔서 고마워요'); }); },
    reset: function () { S = { verified: false, ops: {}, sug: [], done: ['n6046633874', 'n5547152189'], justSent: false }; save(); stack = [{ name: 'intro' }]; render(); },
  };
  app.addEventListener('click', function (e) {
    var t = e.target;
    var a = t.closest('[data-act]');
    if (a && app.contains(a)) { if (a.tagName === 'A' && a.getAttribute('href') === '#') e.preventDefault(); ACT[a.getAttribute('data-act')](a); return; }
    if (t.closest('.sub-back')) { back(); return; }
    var hd = t.closest('.ms-panel:not(.sheet) > .sheet-handle');
    if (hd) { hd.parentNode.classList.add('anim'); hd.parentNode.classList.toggle('peek'); return; }
    var chip = t.closest('.ms-chips .filter-chip');
    if (chip) { var th = chip.textContent; if (stack[stack.length - 1].name === 'map') replace('map', { theme: th }); else { while (stack.length && stack[stack.length - 1].name !== 'map') stack.pop(); if (stack.length) replace('map', { theme: th }); else { stack = [{ name: 'home' }]; go('map', { theme: th }); } } return; }
    var pc = t.closest('.pick-chips .chip');
    if (pc) { var grp = pc.parentNode; if (grp.classList.contains('multi')) pc.classList.toggle('active'); else { var was = pc.classList.contains('active'); [].forEach.call(grp.querySelectorAll('.chip'), function (c) { c.classList.remove('active'); }); if (!was) pc.classList.add('active'); } return; }
    var nav = t.closest('.nav-item');
    if (nav) { var label = nav.textContent.trim(); if (label === '홈') { stack = [{ name: 'home' }]; render(); } else if (label === 'MY') { go('sent'); } else toast('이 시안은 「우리 학교 주변」만 다룹니다'); return; }
  });
  var ty = null;
  app.addEventListener('touchstart', function (e) { ty = e.target.closest('.ms-panel:not(.sheet) > .sheet-handle, .ms-panel:not(.sheet) > .p-head') ? e.touches[0].clientY : null; }, { passive: true });
  app.addEventListener('touchend', function (e) {
    if (ty == null) return; var dy = e.changedTouches[0].clientY - ty; ty = null;
    var pnl = app.querySelector('.ms-panel:not(.sheet)'); if (!pnl || Math.abs(dy) < 24) return;
    pnl.classList.add('anim'); pnl.classList.toggle('peek', dy > 0);
  }, { passive: true });
  M.onPick = function (id) { var top = stack[stack.length - 1]; if (top.name === 'place') { if (top.key === id) return; replace('place', { key: id, theme: top.theme }); } else go('place', { key: id, theme: curTheme() }); };
  M.onZone = function (id) { if (stack[stack.length - 1].name === 'zones') go('zone', { zid: id }); };
  var rs = document.querySelectorAll('[data-reset]'); for (var r = 0; r < rs.length; r++) rs[r].addEventListener('click', function () { ACT.reset(); });
  window.addEventListener('resize', function () { maps.forEach(function (m) { try { m.invalidateSize(); } catch (e) {} }); });
  window.PlayProto = { go: go, back: back, state: function () { return { stack: stack, S: S }; } };
  render();
})();
