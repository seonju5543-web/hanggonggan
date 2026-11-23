/* 학교 주변 지도 시안 — 지도 그리기 (Leaflet 1.9.4 · vendor/ 의 저장소 사본 · 외부 스크립트 없음)
   데이터는 data.js 의 window.CAMPUS_MAP(OpenStreetMap · 서울 열린데이터광장에서 받은 실제 장소) 하나만 쓴다.
   폰 화면의 지도 칸은 data-map='{...}' 설정으로 그린다 — 화면마다 그리는 코드를 따로 쓰지 않는다.

   설정 키
     center   'gate' | 장소 id | [위도, 경도]          zoom   숫자(0.25 단위)
     base     'day' | 'night'                          campus false 면 캠퍼스 경계를 안 그린다
     layers   점(작은 동그라미)으로 깔 층 목록          cats   {층: [갈래…]} 그 층에서 이 갈래만
     maxDist  정문에서 이 거리(m) 안만 점으로           pins   핀으로 세울 장소 id 목록(이 차례로 위에 쌓인다)
     labels   이름표를 달 id 목록 | 'all'               labelLeft 이름표를 왼쪽으로 낼 id
     focus    고른 장소 id(크게)                        numbered {id: 번호} 번호 핀(코스)
     done     다녀온 id(속이 빈 핀)                     route  선으로 이을 id 차례('gate' 가능)
     rings    정문 둘레 원 반지름(m) 목록               ringLabels 원 이름표 · ringBearing 이름표 방위각(기본 45)
     dongs    'all' | 동 이름 목록 · dongFocus 강조할 동 · dongLabels true 면 동 이름
     tint     {갈래 또는 id: 층} 색만 바꾼다            rename {id: 보일 이름}
     static   true 면 끌어서 움직이지 않는다(홈 작은 지도)
     offset   [x, y] 픽셀만큼 보기를 민다(아래 판에 가리는 만큼) */
(function () {
  'use strict';
  var D = window.CAMPUS_MAP;
  var TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  var CAT_ICON = {
    building: 'campus', student_center: 'campus', dormitory: 'home', facility: 'campus', construction: 'campus',
    library: 'library', reading_room: 'library', cafe: 'cafe', study_cafe: 'study', coworking: 'study',
    convenience: 'store', supermarket: 'store', coin_laundry: 'laundry', laundry: 'laundry', pharmacy: 'pharmacy',
    clinic: 'clinic', hospital: 'clinic', doctors: 'clinic', dentist: 'clinic', health: 'health',
    post_office: 'post', bank: 'bank', atm: 'bank', dong_office: 'docs', civil_kiosk: 'kiosk',
    police: 'police', cctv: 'cctv', emergency_bell: 'bell', emergency_phone: 'bell', fire_station: 'bell',
    station: 'subway', subway_entrance: 'subway', bus_stop: 'bus', bicycle_rental: 'bike',
    restaurant: 'food', fast_food: 'food', gate: 'gate', toilets: 'home',
    '카공': 'study', '카페': 'cafe', '밥집': 'food', '술집': 'beer', '과팅': 'people', '생활': 'store', '복지·혜택': 'benefit', '놀거리': 'pin',
  };

  var byIdCache = null;
  function byId(id) {
    if (!byIdCache) {
      byIdCache = {};
      D.pois.forEach(function (p) { byIdCache[p.id] = p; });
      // 대학가 리서치 자료(town.js · 재학생 커뮤니티에서 모은 곳) — id 는 t- 로 시작
      ((window.CAMPUS_TOWN || {}).places || []).forEach(function (p) { byIdCache[p.id] = p; });
    }
    return byIdCache[id] || null;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function layerOf(p, cfg) {
    var t = cfg.tint || {};
    return t[p.id] || t[p.cat] || p.layer;
  }

  function pinIcon(p, cfg, kind) {
    var lc = 'l-' + layerOf(p, cfg);
    if (kind === 'dot') {
      return L.divIcon({ className: 'm-pin-wrap', html: '<span class="m-dot ' + lc + '"></span>', iconSize: [10, 10], iconAnchor: [5, 5] });
    }
    var sel = cfg.focus === p.id;
    var num = cfg.numbered && cfg.numbered[p.id];
    var done = (cfg.done || []).indexOf(p.id) >= 0;
    var wantLabel = cfg.labels === 'all' || (cfg.labels || []).indexOf(p.id) >= 0 || sel;
    var name = (cfg.rename && cfg.rename[p.id]) || p.name;
    var left = (cfg.labelLeft || []).indexOf(p.id) >= 0;
    var inner = num ? '<b class="m-num">' + num + '</b>' : window.mapIcon(CAT_ICON[p.cat] || CAT_ICON[p.category] || 'campus', sel ? 17 : 14);
    var html = '<span class="m-pin ' + lc + (sel ? ' is-sel' : '') + (done ? ' is-done' : '') + '">' + inner + '</span>' +
      (wantLabel && name ? '<span class="m-label' + (sel ? ' is-sel' : '') + (left ? ' is-left' : '') + '">' + esc(name) + '</span>' : '');
    var s = sel ? 34 : 26;
    return L.divIcon({ className: 'm-pin-wrap', html: html, iconSize: [s, s], iconAnchor: [s / 2, s / 2] });
  }

  function ringCentroid(ring) {
    // 다각형 넓이 중심(작은 동네라 평면 근사로 충분)
    var a = 0, cx = 0, cy = 0;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var f = ring[j][1] * ring[i][0] - ring[i][1] * ring[j][0];
      a += f; cx += (ring[j][1] + ring[i][1]) * f; cy += (ring[j][0] + ring[i][0]) * f;
    }
    if (!a) return ring[0];
    return [cy / (3 * a), cx / (3 * a)];
  }

  function mount(el) {
    var cfg = {};
    try { cfg = JSON.parse(el.getAttribute('data-map') || '{}'); } catch (e) { console.error('data-map', e); }
    var center;
    if (!cfg.center || cfg.center === 'gate') center = [D.gate.lat, D.gate.lon];
    else if (typeof cfg.center === 'string') { var cp = byId(cfg.center); center = [cp.lat, cp.lon]; }
    else center = cfg.center;

    var map = L.map(el, {
      zoomControl: false, attributionControl: false, scrollWheelZoom: false, dragging: !cfg.static,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: !cfg.static, zoomSnap: 0.25,
      inertia: false, fadeAnimation: false, zoomAnimation: false, markerZoomAnimation: false,
    });
    map.setView(center, cfg.zoom || 16, { animate: false });
    if (cfg.offset) map.panBy(cfg.offset, { animate: false });   // [x, y] px — 아래 판에 가리는 만큼 지도를 민다
    L.tileLayer(TILE, { maxZoom: 19, crossOrigin: true }).addTo(map);
    el.classList.add(cfg.base === 'night' ? 'm-night' : 'm-day');

    if (cfg.dongs && D.dongs) {
      D.dongs.forEach(function (d) {
        if (cfg.dongs !== 'all' && cfg.dongs.indexOf(d.name) < 0) return;
        var hl = (cfg.dongFocus || []).indexOf(d.name) >= 0;
        (d.rings || []).forEach(function (r) {
          L.polygon(r, { className: 'm-dong' + (hl ? ' is-hl' : ''), weight: hl ? 2 : 1.2, interactive: false }).addTo(map);
        });
        if (cfg.dongLabels && d.rings && d.rings[0]) {
          var c = (cfg.dongLabelAt && cfg.dongLabelAt[d.name]) || ringCentroid(d.rings[0]);
          L.marker(c, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'm-dong-label-wrap', html: '<span class="m-dong-label' + (hl ? '' : ' dim') + '">' + esc(d.name) + '</span>', iconSize: [0, 0] }) }).addTo(map);
        }
      });
    }
    if (cfg.zones) {
      var T = window.CAMPUS_TOWN || { zones: [] };
      T.zones.forEach(function (z) {
        if (cfg.zones !== 'all' && cfg.zones.indexOf(z.id) < 0) return;
        var hl = (cfg.zoneFocus || []).indexOf(z.id) >= 0;
        L.circle([z.lat, z.lon], { radius: z.r || 250, className: 'm-zone' + (hl ? ' is-hl' : ''), weight: hl ? 2 : 1.2, interactive: false }).addTo(map);
        if (cfg.zoneLabels !== false) {
          L.marker([z.lat, z.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'm-dong-label-wrap', html: '<span class="m-dong-label' + (hl || !cfg.zoneFocus ? '' : ' dim') + '">' + esc(z.name) + '</span>', iconSize: [0, 0] }) }).addTo(map);
        }
      });
    }
    // 리서치 장소를 점으로 — townCats: 갈래 목록 · townZone: 그 구역만
    if (cfg.townCats) {
      var pinned0 = {}; (cfg.pins || []).forEach(function (id) { pinned0[id] = 1; });
      ((window.CAMPUS_TOWN || {}).places || []).forEach(function (p) {
        if (pinned0[p.id] || cfg.townCats.indexOf(p.category) < 0) return;
        if (cfg.townZone && p.zone !== cfg.townZone) return;
        L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'm-pin-wrap', html: '<span class="m-dot"></span>', iconSize: [10, 10], iconAnchor: [5, 5] }), interactive: false, keyboard: false }).addTo(map);
      });
    }
    if (cfg.campus !== false && D.campus && D.campus.length) {
      L.polygon(D.campus, { className: 'm-campus', weight: 1.6, interactive: false }).addTo(map);
    }
    (cfg.rings || []).forEach(function (r) {
      L.circle([D.gate.lat, D.gate.lon], { radius: r, className: 'm-ring', weight: 1.2, interactive: false, fill: false }).addTo(map);
    });
    (cfg.ringLabels || []).forEach(function (t, i) {
      var r = (cfg.rings || [])[i]; if (!r || !t) return;
      // 원 위 이름표 자리 — 방위각(도, 북=0 · 기본 45=북동). 북쪽은 캠퍼스 핀과 겹친다
      var br = (cfg.ringBearing == null ? 45 : cfg.ringBearing) * Math.PI / 180;
      var lat = D.gate.lat + (r * Math.cos(br)) / 111320;
      var lon = D.gate.lon + (r * Math.sin(br)) / (111320 * Math.cos(D.gate.lat * Math.PI / 180));
      L.marker([lat, lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'm-ring-label-wrap', html: '<span class="m-ring-label">' + esc(t) + '</span>', iconSize: [0, 0] }) }).addTo(map);
    });
    if (cfg.route) {
      var pts = cfg.route.map(function (id) { var p = id === 'gate' ? D.gate : byId(id); return [p.lat, p.lon]; });
      L.polyline(pts, { className: 'm-route', weight: 3, interactive: false }).addTo(map);
    }

    var layers = cfg.layers || [];
    var pinned = {};
    (cfg.pins || []).forEach(function (id) { pinned[id] = 1; });
    var drawn = 0;
    D.pois.forEach(function (p) {
      if (pinned[p.id]) return;
      var inLayer = layers.indexOf(p.layer) >= 0 || (p.also || []).some(function (a) { return layers.indexOf(a) >= 0; });
      if (!inLayer) return;
      if (cfg.cats) {
        var ok = false;
        [p.layer].concat(p.also || []).forEach(function (l) { if (cfg.cats[l] && cfg.cats[l].indexOf(p.cat) >= 0) ok = true; });
        if (!ok) return;
      }
      if (cfg.maxDist && p.dist > cfg.maxDist) return;
      L.marker([p.lat, p.lon], { icon: pinIcon(p, cfg, 'dot'), interactive: false, keyboard: false }).addTo(map);
      drawn++;
    });
    (cfg.pins || []).forEach(function (id, i) {
      var p = byId(id);
      if (!p) { console.warn('핀 없음', id); return; }
      L.marker([p.lat, p.lon], { icon: pinIcon(p, cfg, 'pin'), interactive: false, keyboard: false, zIndexOffset: cfg.focus === id ? 1000 : 200 + i }).addTo(map);
    });
    if (cfg.gate !== false) {
      L.marker([D.gate.lat, D.gate.lon], { interactive: false, keyboard: false, zIndexOffset: 900, icon: L.divIcon({ className: 'm-pin-wrap', html: '<span class="m-gate">' + window.mapIcon('gate', 13) + '<i>정문</i></span>', iconSize: [0, 0] }) }).addTo(map);
    }
    el.setAttribute('data-drawn', String(drawn));
    return map;
  }

  // 하단 탭 — 앱 index.html 의 다섯 칸 그대로(아이콘 원문 · 이름 · 차례). data-tab 이 고른 칸
  var NAV = [
    ['home', '홈', '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>'],
    ['explore', '장학금', '<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>'],
    ['activities', '대외활동', '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3"/><path d="M17 6h3v2a3 3 0 0 1-3 3"/>'],
    ['applications', '신청내역', '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'],
    ['my', 'MY', '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>'],
  ];
  function fillUi() {
    var navs = document.querySelectorAll('nav.bottom-nav[data-tab]');
    for (var i = 0; i < navs.length; i++) {
      var on = navs[i].getAttribute('data-tab');
      navs[i].innerHTML = NAV.map(function (n) {
        return '<button class="nav-item' + (n[0] === on ? ' active' : '') + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + n[2] + '</svg>' + n[1] + '</button>';
      }).join('');
    }
    // 목록 줄 앞 그림 — 지도 핀과 같은 그림(CAT_ICON 이름 또는 아이콘 이름)
    var ics = document.querySelectorAll('[data-icon]');
    for (var j = 0; j < ics.length; j++) {
      var n = ics[j].getAttribute('data-icon');
      ics[j].innerHTML = window.mapIcon(CAT_ICON[n] || n, Number(ics[j].getAttribute('data-size') || 16));
    }
    var gos = document.querySelectorAll('.go[data-go]');
    for (var k = 0; k < gos.length; k++) gos[k].innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  }

  window.MapMock = { mount: mount, byId: byId };
  function boot() {
    fillUi();
    var els = document.querySelectorAll('[data-map]');
    for (var i = 0; i < els.length; i++) {
      try { mount(els[i]); } catch (e) { console.error('지도 그리기 실패', e); }
    }
    document.documentElement.setAttribute('data-maps', String(els.length));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
