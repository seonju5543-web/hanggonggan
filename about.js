/* 소개 페이지 숫자 (about.html) — 2026-10-12 · 유은서
   🔴 지어낸 숫자를 쓰지 않는다(운영 원칙 6). 수집 로봇이 매일 쓰는 학교별 공고 색인(data/notices/index.json)에서
      그때그때 센다 — 앱이 자기 학교 파일을 찾을 때 쓰는 그 색인이다(match-engine.js noticeFallbackNeeded).
      못 읽거나 모양이 다르면 숫자 줄을 숨긴 채 둔다. 대신 넣을 숫자는 없다. */
(function () {
  'use strict';
  var box = document.getElementById('ab-stats');
  if (!box || !window.fetch) return;
  fetch('data/notices/index.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (ix) {
      var files = ix && ix.files && typeof ix.files === 'object' ? ix.files : null;
      if (!files) return;
      var names = Object.keys(files);
      var total = names.reduce(function (s, k) { var c = Number(files[k] && files[k].count); return s + (c > 0 ? c : 0); }, 0);
      if (!names.length || !total) return;
      document.getElementById('ab-schools').textContent = names.length + '곳';
      document.getElementById('ab-notices').textContent = total.toLocaleString('ko-KR') + '건';
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(ix.updatedAt || ''))) {
        var d = ix.updatedAt.split('-');
        document.getElementById('ab-asof').textContent = Number(d[1]) + '월 ' + Number(d[2]) + '일 기준';
      }
      box.hidden = false;
    })
    .catch(function () { /* 숫자 없이 보여 준다 */ });
})();
