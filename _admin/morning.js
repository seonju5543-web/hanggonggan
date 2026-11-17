/* ============================================================
   아침 지표 (2026-11-15 · 은서) — 이용 횟수 · 앱 오류 · 로봇 경보를 한 장에
   ------------------------------------------------------------
   · 이용 횟수·오류: Supabase usage_report(열쇠, 일수) — 열쇠는 0007 SQL 이 만들어 보여 준다 · 이 기기 localStorage 에만 둔다
   · 공고 이름: 저장소의 data/*.json(raw.githubusercontent — 관리자 화면이 이미 쓰는 곳)으로 번호 → 이름 · 활동은 usageItem 지문으로 되짚는다
   · 로봇 경보: 관리자 화면에 넣어 둔 GitHub 열쇠(같은 사이트라 같은 저장소 칸)로 열린 🚨·🛡·🔑 이슈
   🔴 화면에 그리는 글자는 전부 esc() — 오류 문구도 바깥에서 온 글이다.
   ============================================================ */
(function () {
  'use strict';
  const OWNER = 'seonju5543-web';
  const REPO = 'hanggonggan';
  const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/`;
  const KEY_LS = 'handaejang.morning.key';
  const GH_KEY = 'handaejang.admin.key';   // _admin/admin.js KEY_NAME 과 같다
  const EV = { open: '앱 방문', onboard: '새 가입(온보딩)', detail: '공고 상세 보기', save: '저장', source: '원문 열기', prep: '신청 준비', form_open: '양식 열기', form_edit: '양식 작성·수정', submitted: '제출 기록' };
  const TRACK = { humanities: '인문', social: '사회', business: '상경', science: '자연', engineering: '공학', medical: '의약', arts: '예체능' };   // match-engine.js TRACK_GROUP 의 열쇠
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => (n == null ? '5 미만' : Number(n).toLocaleString('ko-KR'));
  const ls = { get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } } };
  const ghKey = () => { try { return sessionStorage.getItem(GH_KEY) || localStorage.getItem(GH_KEY) || ''; } catch (e) { return ''; } };
  let names = {};
  let report = null;

  async function loadNames() {
    const out = {};
    const arr = (x) => (Array.isArray(x) ? x : (x && (x.items || x.list)) || []);
    const get = (f) => fetch(RAW + f, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [reg, act, kos] = await Promise.all([get('data/registered.json'), get('data/activities.json'), get('data/kosaf-open.json')]);
    for (const s of arr(reg)) if (s && s.id) out[s.id] = s.name || s.title || s.id;
    for (const s of arr(kos)) if (s && s.id) out[s.id] = s.name || s.title || s.id;
    for (const a of arr(act)) if (a && a.url && typeof usageItem === 'function') out[usageItem(a.url)] = a.title || a.url;
    names = out;
  }

  async function loadReport(days) {
    const c = typeof SUPABASE_CONFIG !== 'undefined' ? SUPABASE_CONFIG : null;
    const key = ls.get(KEY_LS);
    if (!c || !c.url || !c.anonKey) return { ok: false, why: 'supabase-config 없음' };
    if (!key) return { ok: false, why: 'nokey' };
    try {
      const r = await fetch(String(c.url).replace(/\/+$/, '') + '/rest/v1/rpc/usage_report', {
        method: 'POST', headers: { apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key: key, p_days: days }),
      });
      if (r.status === 404) return { ok: false, why: 'nosql' };
      if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
      const j = await r.json();
      return j && j.ok ? j : { ok: false, why: 'badkey' };
    } catch (e) { return { ok: false, why: '연결 실패' }; }
  }

  function sumBy(list, pred) { return list.filter(pred).reduce((a, x) => a + (Number(x.n) || 0), 0); }

  function renderTiles() {
    const daily = report.daily || [];
    const today = String(report.today);
    const yday = new Date(Date.parse(today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
    $('#mo-tiles').innerHTML = Object.keys(EV).map((ev) => {
      const y = sumBy(daily, (x) => x.event === ev && String(x.day) === yday);
      const t = sumBy(daily, (x) => x.event === ev && String(x.day) === today);
      const all = sumBy(daily, (x) => x.event === ev);
      const grp = (ev === 'open' || ev === 'onboard') ? 't-reach' : (['prep', 'form_open', 'form_edit', 'submitted'].includes(ev) ? 't-apply' : '');
      return `<div class="tile ${grp}"><span>${esc(EV[ev])}</span><b>${num(y)}</b><em>오늘 ${num(t)} · 기간 ${num(all)}</em></div>`;
    }).join('');
  }

  function renderItems() {
    const by = {};
    for (const x of report.items || []) { (by[x.item] = by[x.item] || {})[x.event] = x.n; }
    const rows = Object.entries(by).sort((a, b) => (b[1].detail || 0) - (a[1].detail || 0)).slice(0, 15);
    $('#mo-items').innerHTML = rows.length ? rows.map(([item, v]) => `<tr><td class="name" title="${esc(names[item] || item)}">${esc(names[item] || item)}</td>${['detail', 'save', 'source', 'prep', 'submitted'].map((e) => `<td class="n${v[e] == null ? ' dim' : ''}">${v[e] == null ? '–' : num(v[e])}</td>`).join('')}</tr>`).join('')
      : '<tr><td colspan="6" class="muted">아직 5건 넘는 공고가 없습니다</td></tr>';
  }

  function renderGroups() {
    const ev = $('#mo-ev').value || 'detail';
    const g = (report.groups || []).filter((x) => x.event === ev);
    const label = (dim, val) => {
      if (dim !== 'grade_track') return val === '?' ? '모름' : val;
      const [gr, tr] = String(val).split('|');
      return `${gr === '?' ? '학년 모름' : gr + '학년'} · ${TRACK[tr] || (tr === '?' ? '계열 모름' : tr)}`;
    };
    const fill = (sel, dim) => {
      const rows = g.filter((x) => x.dim === dim).sort((a, b) => (b.n || 0) - (a.n || 0));
      $(sel).innerHTML = rows.length ? rows.map((x) => `<tr><td class="name">${esc(label(dim, x.val))}</td><td class="n${x.n == null ? ' dim' : ''}">${num(x.n)}</td></tr>`).join('') : '<tr><td class="muted">없음</td></tr>';
    };
    fill('#mo-g-gt', 'grade_track'); fill('#mo-g-rg', 'region'); fill('#mo-g-sc', 'school');
  }

  function renderErrors() {
    const d = report.errors_daily || [];
    const today = String(report.today);
    const yday = new Date(Date.parse(today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
    const y = sumBy(d, (x) => String(x.day) === yday);
    const t = sumBy(d, (x) => String(x.day) === today);
    const all = sumBy(d, () => true);
    $('#mo-err-tiles').innerHTML = `<div class="tile ${y > 0 ? 't-err' : 't-ok'}"><span>어제 오류</span><b>${y}</b><em>오늘 ${t} · 기간 ${all}</em></div>`;
    const top = report.errors_top || [];
    $('#mo-err-top').innerHTML = top.length ? top.map((x) => `<tr><td>${esc(x.message)}</td><td class="name">${esc(x.source || '')}</td><td class="n">${x.n}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">최근 24시간 오류 없음</td></tr>';
  }

  async function renderAlerts() {
    const box = $('#mo-alerts');
    const token = ghKey();
    if (!token) { box.innerHTML = `<li class="muted">관리자 화면에 GitHub 열쇠를 넣으면 여기에 보입니다 · <a href="https://github.com/${OWNER}/${REPO}/issues" target="_blank" rel="noopener">이슈 목록 열기</a></li>`; return; }
    try {
      const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues?state=open&per_page=100`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const list = (await r.json()).filter((i) => !i.pull_request && /^(🚨|🛡|🔑)/.test(i.title || ''));
      box.innerHTML = list.length ? list.map((i) => `<li><a href="${esc(i.html_url)}" target="_blank" rel="noopener">#${i.number}</a> ${esc(i.title)} <span class="muted">· ${esc(String(i.updated_at).slice(0, 10))}</span></li>`).join('') : '<li class="ok">열린 경보 없음</li>';
    } catch (e) { box.innerHTML = `<li class="muted">경보를 못 읽었습니다(${esc(e.message)}) · <a href="https://github.com/${OWNER}/${REPO}/issues" target="_blank" rel="noopener">이슈 목록 열기</a></li>`; }
  }

  async function refresh() {
    const days = Number($('#mo-days').value) || 7;
    $('#mo-when').textContent = '불러오는 중…';
    const [rep] = await Promise.all([loadReport(days), Object.keys(names).length ? null : loadNames()]);
    renderAlerts();
    if (!rep.ok) {
      const why = { nokey: '보고서 열쇠를 넣어 주세요.', badkey: '열쇠가 맞지 않습니다 — 0007 SQL 결과의 열쇠를 다시 넣어 주세요.', nosql: 'Supabase 에 0007_usage_counts.sql 을 아직 실행하지 않았습니다.' }[rep.why] || `이용 횟수를 못 읽었습니다(${rep.why}).`;
      $('#mo-when').textContent = why;
      $('#mo-key').hidden = !(rep.why === 'nokey' || rep.why === 'badkey');
      return;
    }
    report = rep;
    $('#mo-key').hidden = true;
    $('#mo-when').textContent = `${rep.today} 기준 · 최근 ${days}일 합계`;
    renderTiles(); renderItems(); renderGroups(); renderErrors();
  }

  $('#mo-ev').innerHTML = ['detail', 'save', 'source', 'prep', 'form_edit', 'submitted', 'open', 'onboard'].map((e) => `<option value="${e}">${esc(EV[e])}</option>`).join('');
  $('#mo-ev').addEventListener('change', () => report && renderGroups());
  $('#mo-days').addEventListener('change', refresh);
  $('#mo-key-save').addEventListener('click', () => { const v = $('#mo-key-in').value.trim(); if (v) { ls.set(KEY_LS, v); $('#mo-key-in').value = ''; refresh(); } });
  refresh();
})();
