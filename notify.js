/* ============================================================
   한대장 — 앱 알림 (동의 · 발송 · 알림함 · 설정)
   ------------------------------------------------------------
   무엇이 어떻게 동작하는지 (개발자용 요약)
   1) 알림 동의: 앱을 처음 쓸 때 **딱 한 번** 안내 시트를 띄운다. '나중에'를 눌러도
      다시 자동으로 뜨지 않고, MY 화면에서 언제든 켤 수 있다.
   2) 무엇을 알릴지는 notify-rules.js가 결정한다(앱 화면과 서비스워커가 같은 규칙 사용).
   3) 알림은 두 곳으로 나간다:
      · 휴대폰 알림(OS) — 동의했을 때만
      · 앱 안 '알림함' — 항상 쌓인다. OS 알림을 거절했거나 못 봤어도 놓치지 않게.
   4) 정직 원칙: 한대장은 발송 서버가 없다. 그래서 알림은 ① 앱을 열 때 ② 앱을 열어 둔 동안
      ③ (안드로이드 설치형에서 지원되는) 백그라운드 자동 확인 시점에 확인해 보낸다.
      "폰이 꺼져 있어도 즉시 도착"이라고 말하지 않는다 — 화면 문구에도 그대로 적었다.
   ============================================================ */

const NOTIFY_DB = 'handaejang-notify';
const NOTIFY_STORE = 'state';
const NOTIFY_CHECK_INTERVAL = 15 * 60 * 1000; // 앱을 열어 둔 동안 확인 주기
const NOTIFY_MAX_OS = 3;                      // 한 번에 띄우는 휴대폰 알림 최대 수 (넘으면 묶음 1건)

let notifyLedger = null;   // 알림 장부 (설정·읽음·중복방지 기록) — IndexedDB에 저장
let notifyReady = false;

/* ---------------- 저장소 (서비스워커와 공유하므로 IndexedDB) ---------------- */
function nfDbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(NOTIFY_DB, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(NOTIFY_STORE)) rq.result.createObjectStore(NOTIFY_STORE, { keyPath: 'k' });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function nfTx(mode, fn) {
  return nfDbOpen().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(NOTIFY_STORE, mode);
    const out = fn(tx.objectStore(NOTIFY_STORE));
    tx.oncomplete = () => res(out && out.result);
    tx.onerror = () => rej(tx.error);
  }));
}
function nfGet(k) { return nfTx('readonly', (st) => st.get(k)); }
function nfPut(k, value) { return nfTx('readwrite', (st) => st.put(Object.assign({ k }, value))); }

async function notifyLoadLedger() {
  let raw = null;
  try { raw = await nfGet('ledger'); } catch (e) { /* 저장소를 못 열면 이번 세션만 메모리로 */ }
  notifyLedger = NOTIFY_RULES.normalizeLedger(raw || null);
  return notifyLedger;
}
async function notifySaveLedger() {
  try { await nfPut('ledger', notifyLedger); } catch (e) { /* 저장 실패는 조용히 — 알림은 부가 기능 */ }
}

/* 서비스워커가 앱을 열지 않고도 판단할 수 있게 프로필·신청내역 사본을 넘겨 둔다.
   (localStorage는 서비스워커에서 읽을 수 없다) */
function notifySyncContext() {
  if (typeof state === 'undefined') return Promise.resolve();
  return nfPut('ctx', {
    profile: state.profile || null,
    applications: state.applications || [],
    savedAt: Date.now(),
  }).catch(() => {});
}

/* ---------------- 지원 여부 · 권한 ---------------- */
function notifySupport() {
  const hasApi = typeof Notification !== 'undefined';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return {
    hasApi,
    permission: hasApi ? Notification.permission : 'unsupported',
    // iOS는 홈 화면에 설치한 앱에서만 알림을 지원한다 (iOS 16.4+)
    iosNeedsInstall: isIOS && !standalone && !hasApi,
    standalone,
  };
}

async function notifyRequestPermission() {
  const sup = notifySupport();
  if (!sup.hasApi) {
    toast(sup.iosNeedsInstall
      ? 'iPhone은 홈 화면에 앱을 추가해야 알림을 받을 수 있어요'
      : '이 브라우저는 알림을 지원하지 않아요');
    return 'unsupported';
  }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch (e) { perm = Notification.permission; }
  }
  return perm;
}

/* 백그라운드 자동 확인 등록 — 안드로이드 설치형 크롬에서만 실제로 동작한다(선택 기능) */
async function notifyRegisterBackground() {
  try {
    const reg = (typeof swReg !== 'undefined' && swReg) ? swReg : await navigator.serviceWorker.ready;
    if (!reg || !('periodicSync' in reg)) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('handaejang-check', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch (e) { return false; }
}

/* ---------------- 규칙 실행 → 발송 ---------------- */
async function notifyCheck({ quiet = false } = {}) {
  if (!notifyReady || !notifyLedger) return 0;
  if (typeof state === 'undefined' || !state.profile) return 0;

  const scholarships = (typeof allScholarships === 'function') ? allScholarships() : [];
  const notices = (typeof liveNotices !== 'undefined' && liveNotices && liveNotices.items) ? liveNotices.items : [];

  const out = NOTIFY_RULES.evaluate({
    now: Date.now(),
    profile: state.profile,
    applications: state.applications || [],
    scholarships,
    notices,
    ledger: notifyLedger,
    matchStatus: (sch) => evaluate(sch, state.profile).status,
    notStale: (sch) => notStale(sch),   // 화면이 숨긴 오래된 공고는 알림도 하지 않는다
  });
  notifyLedger = out.ledger;

  if (out.events.length) {
    NOTIFY_RULES.pushToInbox(notifyLedger, out.events, Date.now());
    await notifyDeliver(out.events);
    if (!quiet) toast(`🔔 새 알림 ${out.events.length}건이 도착했어요`);
  }
  await notifySaveLedger();
  notifyRenderBadge();
  return out.events.length;
}

/* 휴대폰 알림 띄우기 — 동의 + 앱 스위치가 켜져 있을 때만 */
async function notifyDeliver(events) {
  if (!notifyLedger.enabled) return;
  const sup = notifySupport();
  if (!sup.hasApi || sup.permission !== 'granted') return;

  let toShow = events;
  if (events.length > NOTIFY_MAX_OS) {
    toShow = [{
      key: 'sum:' + Date.now(),
      type: 'newMatch',
      title: `🔔 한대장 새 알림 ${events.length}건`,
      body: events.slice(0, 2).map((e) => e.title.replace(/^[^ ]+ /, '')).join(' / ') + ' 외',
      url: './?screen=notifications',
    }];
  }

  for (const ev of toShow) {
    const options = {
      body: ev.body,
      tag: ev.key,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      lang: 'ko',
      data: { url: ev.url || './', schId: ev.schId || null, type: ev.type },
    };
    try {
      const reg = (typeof swReg !== 'undefined' && swReg) ? swReg : null;
      if (reg && reg.showNotification) await reg.showNotification(ev.title, options);
      else new Notification(ev.title, options);
    } catch (e) { /* 알림 실패는 앱 동작을 막지 않는다 — 알림함에는 이미 쌓였다 */ }
  }
}

/* 서비스워커가 백그라운드에서 보낸 알림을 앱이 다시 열릴 때 받아 온다 */
async function notifyMergeBackground() {
  try {
    const raw = await nfGet('ledger');
    if (!raw) return;
    const fromSw = NOTIFY_RULES.normalizeLedger(raw);
    if (!notifyLedger || (fromSw.lastCheck || 0) > (notifyLedger.lastCheck || 0)) {
      // 서비스워커 쪽이 더 최신이면 그 장부를 쓰되, 사용자가 방금 바꾼 설정은 지킨다
      const prefs = notifyLedger ? notifyLedger.prefs : fromSw.prefs;
      const enabled = notifyLedger ? notifyLedger.enabled : fromSw.enabled;
      const askedAt = notifyLedger ? notifyLedger.askedAt : fromSw.askedAt;
      notifyLedger = Object.assign(fromSw, { prefs, enabled, askedAt });
    }
  } catch (e) { /* 무시 */ }
}

/* ---------------- 알림함 (앱 안) ---------------- */
function notifyTimeText(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return '방금 전';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function notifyTypeMeta(type) {
  return NOTIFY_RULES.TYPES.find((t) => t.id === type) || { icon: '🔔', label: '알림' };
}

/* 알림함에서는 종류 아이콘을 따로 보여주므로 제목 앞 그림문자를 뺀다 (같은 그림이 두 번 뜨지 않게).
   휴대폰 알림 제목에는 그대로 남긴다 — 거기선 아이콘이 눈에 띄는 유일한 표시라서. */
function notifyPlainTitle(title) {
  return String(title || '').replace(/^[\p{Extended_Pictographic}️‍]+\s*/u, '');
}

function notifyRenderBadge() {
  const el = $('#notify-badge');
  if (!el || !notifyLedger) return;
  const n = NOTIFY_RULES.unreadCount(notifyLedger);
  el.textContent = n > 9 ? '9+' : String(n);
  el.hidden = n === 0;
  const btn = $('#btn-notify');
  if (btn) btn.setAttribute('aria-label', n ? `알림 ${n}건` : '알림');
}

function openNotifyPanel(html) {
  const sheet = $('#notify-sheet');
  sheet.innerHTML = `<div class="sheet-handle"></div><div class="sheet-body">${html}</div>`;
  $('#notify-backdrop').hidden = false;
  sheet.hidden = false;
  requestAnimationFrame(() => {
    $('#notify-backdrop').classList.add('show');
    sheet.classList.add('show');
  });
}
function closeNotifyPanel() {
  $('#notify-backdrop').classList.remove('show');
  $('#notify-sheet').classList.remove('show');
  setTimeout(() => {
    $('#notify-backdrop').hidden = true;
    $('#notify-sheet').hidden = true;
  }, 250);
}

function openNotifyInbox() {
  if (!notifyLedger) return;
  const items = notifyLedger.inbox || [];
  const unread = NOTIFY_RULES.unreadCount(notifyLedger);
  const rows = items.length ? items.map((it) => `
    <button class="nf-item${it.read ? '' : ' nf-unread'}" data-nf-open="${esc(it.key)}">
      <span class="nf-ico">${notifyTypeMeta(it.type).icon}</span>
      <span class="nf-text">
        <span class="nf-title">${esc(notifyPlainTitle(it.title))}</span>
        <span class="nf-body">${esc(it.body)}</span>
        <span class="nf-time">${notifyTimeText(it.ts)}</span>
      </span>
    </button>`).join('')
    : `<p class="empty">아직 받은 알림이 없어요.<br />새 공고가 등록되거나 마감이 다가오면 여기에 쌓여요.</p>`;

  openNotifyPanel(`
    <div class="nf-head">
      <h3 class="sheet-title" style="margin-top:0">알림함</h3>
      ${unread ? '<button class="wallet-btn" id="btn-nf-readall">모두 읽음</button>' : ''}
    </div>
    <p class="sheet-provider">읽지 않은 알림 ${unread}건 · 최근 ${items.length}건 보관</p>
    <div class="nf-list">${rows}</div>
    <button class="btn btn-outline" id="btn-nf-settings" style="margin-top:16px">알림 설정 열기</button>
  `);

  const readAll = $('#btn-nf-readall');
  if (readAll) readAll.addEventListener('click', async () => {
    notifyLedger.inbox.forEach((i) => { i.read = true; });
    await notifySaveLedger();
    notifyRenderBadge();
    openNotifyInbox();
  });
  $('#btn-nf-settings').addEventListener('click', () => { closeNotifyPanel(); showScreen('my'); setTimeout(() => { const el = $('#my-notify'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120); });

  $$('[data-nf-open]').forEach((btn) => btn.addEventListener('click', async () => {
    const item = items.find((i) => i.key === btn.dataset.nfOpen);
    if (!item) return;
    item.read = true;
    await notifySaveLedger();
    notifyRenderBadge();
    closeNotifyPanel();
    setTimeout(() => {
      if (item.schId && typeof findSch === 'function' && findSch(item.schId)) openDetail(item.schId);
      else showScreen('explore');
    }, 260);
  }));
}

/* ---------------- 최초 1회 동의 ---------------- */
function notifyConsentSheet() {
  const sup = notifySupport();
  const typeRows = NOTIFY_RULES.TYPES.map((t) => `
    <li><span class="nf-ico">${t.icon}</span><span><strong>${esc(t.label)}</strong><br /><span class="nf-desc">${esc(t.desc)}</span></span></li>`).join('');

  openNotifyPanel(`
    <div class="nf-consent-hero">
      <div class="nf-bell">🔔</div>
      <h3 class="sheet-title" style="margin-top:10px">장학금 알림을 받으시겠어요?</h3>
      <p class="sheet-summary" style="margin-top:6px">마감을 놓쳐서 못 받는 장학금이 가장 아까워요.<br />꼭 필요한 것만 골라서 알려드릴게요.</p>
    </div>
    <ul class="nf-type-list">${typeRows}</ul>
    <p class="sheet-note">💡 한대장은 발송 서버 없이 동작해요. 알림은 <strong>앱을 열 때</strong>와 <strong>앱을 열어 둔 동안</strong>, 그리고 휴대폰이 지원하면 백그라운드 자동 확인 시점에 전달돼요. 언제든 MY에서 끄고 켤 수 있어요.</p>
    ${sup.iosNeedsInstall ? '<p class="sheet-note">📱 iPhone은 사파리 공유 → <strong>홈 화면에 추가</strong>로 앱을 설치하면 알림을 받을 수 있어요.</p>' : ''}
    <button class="btn btn-primary btn-lg" id="btn-nf-allow" style="margin-top:16px">알림 받기</button>
    <button class="btn btn-outline" id="btn-nf-later" style="margin-top:8px">나중에 할게요</button>
  `);

  const finish = async () => { notifyLedger.askedAt = Date.now(); await notifySaveLedger(); };

  $('#btn-nf-allow').addEventListener('click', async () => {
    const perm = await notifyRequestPermission();
    notifyLedger.enabled = perm === 'granted';
    await finish();
    closeNotifyPanel();
    if (perm === 'granted') {
      notifyRegisterBackground();
      toast('알림을 켰어요. 새 공고와 마감을 챙겨드릴게요');
    } else if (perm === 'denied') {
      toast('브라우저에서 알림이 차단돼 있어요. 앱 안 알림함으로 계속 알려드릴게요');
    } else {
      toast('앱 안 알림함으로 알려드릴게요. MY에서 언제든 켤 수 있어요');
    }
    if (!$('#screen-my').hidden) renderMy();
    notifyRenderBadge();
  });

  $('#btn-nf-later').addEventListener('click', async () => {
    notifyLedger.enabled = false;
    await finish();
    closeNotifyPanel();
    toast('알림은 MY 화면에서 언제든 켤 수 있어요');
    if (!$('#screen-my').hidden) renderMy();
  });
}

/* 최초 1회만 자동으로 뜬다 — 이후에는 MY 화면에서만 켠다 */
function notifyMaybeAskConsent(delay = 900) {
  if (!notifyReady || !notifyLedger) return;
  if (notifyLedger.askedAt) return;
  if (typeof state === 'undefined' || !state.profile) return;
  setTimeout(() => {
    if (notifyLedger.askedAt) return;
    if (!$('#notify-sheet').hidden || !$('#detail-sheet').hidden) return; // 다른 시트가 떠 있으면 방해하지 않는다
    notifyConsentSheet();
  }, delay);
}

/* ---------------- MY 화면의 알림 설정 ---------------- */
function notifySettingsHtml() {
  if (!notifyLedger) return '';
  const sup = notifySupport();
  const on = notifyLedger.enabled && sup.permission === 'granted';

  let statusText;
  let statusCls;
  if (!sup.hasApi) { statusText = sup.iosNeedsInstall ? '홈 화면에 앱을 추가하면 사용할 수 있어요' : '이 브라우저는 휴대폰 알림을 지원하지 않아요'; statusCls = 'off'; }
  else if (sup.permission === 'denied') { statusText = '브라우저에서 차단됨 · 사이트 설정에서 알림을 허용해 주세요'; statusCls = 'off'; }
  else if (on) { statusText = '휴대폰 알림 켜짐'; statusCls = 'on'; }
  else if (sup.permission === 'granted') { statusText = '허용됨 · 앱에서 꺼 둔 상태예요'; statusCls = 'off'; }
  else { statusText = '아직 켜지 않았어요'; statusCls = 'off'; }

  const rows = NOTIFY_RULES.TYPES.map((t) => `
    <label class="nf-pref">
      <span class="nf-pref-text"><strong>${t.icon} ${esc(t.label)}</strong><span class="nf-desc">${esc(t.desc)}</span></span>
      <input type="checkbox" class="nf-switch" data-nf-pref="${t.id}" ${notifyLedger.prefs[t.id] ? 'checked' : ''} />
    </label>`).join('');

  return `
    <div class="nf-set-head">
      <div>
        <p class="wallet-title">알림</p>
        <p class="nf-status nf-status-${statusCls}">${esc(statusText)}</p>
      </div>
      <button class="wallet-btn ${on ? '' : 'primary'}" id="btn-nf-toggle">${on ? '끄기' : '켜기'}</button>
    </div>
    <div class="nf-prefs">${rows}</div>
    <p class="wallet-sub" style="margin-top:12px">한대장은 발송 서버가 없어서, 알림은 <strong>앱을 열 때 · 열어 둔 동안</strong> 확인해 보내드려요(안드로이드 설치형은 백그라운드 확인도 지원). 알림 내용은 이 기기 안에서만 만들어지고 밖으로 나가지 않아요.</p>
    <div class="nf-set-actions">
      <button class="wallet-btn" id="btn-nf-inbox">알림함 열기</button>
      <button class="wallet-btn" id="btn-nf-test">테스트 알림</button>
      <button class="wallet-btn" id="btn-nf-recheck">지금 확인</button>
    </div>`;
}

function bindNotifySettings() {
  const toggle = $('#btn-nf-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', async () => {
    const sup = notifySupport();
    if (notifyLedger.enabled && sup.permission === 'granted') {
      notifyLedger.enabled = false;
      await notifySaveLedger();
      toast('휴대폰 알림을 껐어요. 앱 안 알림함에는 계속 쌓여요');
    } else {
      const perm = await notifyRequestPermission();
      notifyLedger.askedAt = notifyLedger.askedAt || Date.now();
      notifyLedger.enabled = perm === 'granted';
      await notifySaveLedger();
      if (perm === 'granted') { notifyRegisterBackground(); toast('알림을 켰어요'); }
      else if (perm === 'denied') toast('브라우저 사이트 설정에서 알림을 허용해 주세요');
    }
    renderMy();
  });

  $$('[data-nf-pref]').forEach((el) => el.addEventListener('change', async () => {
    notifyLedger.prefs[el.dataset.nfPref] = el.checked;
    await notifySaveLedger();
  }));

  $('#btn-nf-inbox').addEventListener('click', openNotifyInbox);
  $('#btn-nf-recheck').addEventListener('click', async () => {
    const n = await notifyCheck({ quiet: true });
    toast(n ? `새 알림 ${n}건을 받았어요` : '새로 알려드릴 내용이 없어요');
  });
  $('#btn-nf-test').addEventListener('click', async () => {
    const ev = {
      key: 'test:' + Date.now(),
      type: 'newMatch',
      title: '🔔 한대장 테스트 알림',
      body: '알림이 이렇게 도착해요. 실제 알림에는 공고 이름과 마감일이 담겨요.',
      url: './?screen=notifications',
    };
    NOTIFY_RULES.pushToInbox(notifyLedger, [ev], Date.now());
    await notifyDeliver([ev]);
    await notifySaveLedger();
    notifyRenderBadge();
    const sup = notifySupport();
    toast(notifyLedger.enabled && sup.permission === 'granted'
      ? '테스트 알림을 보냈어요'
      : '알림함에 테스트 알림을 넣었어요 (휴대폰 알림은 꺼져 있어요)');
  });
}

/* 데이터 초기화와 함께 알림 설정·알림함도 지운다 (MY → 데이터 초기화) */
async function notifyReset() {
  notifyLedger = NOTIFY_RULES.newLedger();
  try {
    await nfTx('readwrite', (st) => st.delete('ctx'));
    await notifySaveLedger();
  } catch (e) { /* 무시 */ }
  notifyRenderBadge();
}

/* ---------------- 알림 클릭으로 앱이 열렸을 때 ---------------- */
function notifyHandleLaunch() {
  let params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  const sch = params.get('sch');
  const screen = params.get('screen');
  if (!sch && !screen) return;
  // 주소창을 원래대로 되돌린다 (새로고침할 때 또 열리지 않게)
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* 무시 */ }
  setTimeout(() => {
    if (typeof state === 'undefined' || !state.profile) return;
    if (screen === 'notifications') { openNotifyInbox(); return; }
    if (screen && ['home', 'explore', 'applications', 'my'].includes(screen)) { showScreen(screen); return; }
    if (sch && typeof findSch === 'function' && findSch(sch)) openDetail(sch);
    else if (sch) showScreen('explore');
  }, 400);
}

/* ---------------- 시작 ---------------- */
async function notifyInit() {
  if (typeof NOTIFY_RULES === 'undefined') return;
  await notifyLoadLedger();
  notifyReady = true;
  notifyRenderBadge();
  await notifySyncContext();

  // 백그라운드(서비스워커)가 보낸 알림 결과 합치기
  await notifyMergeBackground();
  notifyRenderBadge();

  // 데이터(공고·정식등록)가 도착할 시간을 준 뒤 첫 확인
  setTimeout(() => { notifyCheck({ quiet: true }).then(() => notifyHandleLaunch()); }, 1200);

  // 앱을 열어 둔 동안 주기적으로 확인 (마감 임박은 시간이 지나며 발생한다)
  setInterval(() => { notifyCheck({ quiet: false }); }, NOTIFY_CHECK_INTERVAL);

  // 다른 화면 갔다 돌아왔을 때도 확인
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setTimeout(() => notifyCheck({ quiet: false }), 1500);
  });

  // 서비스워커에서 알림을 눌렀다는 신호가 오면 해당 화면을 연다
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const msg = e.data || {};
      if (msg.type !== 'notify-click') return;
      const d = msg.data || {};
      if (d.schId && typeof findSch === 'function' && findSch(d.schId)) openDetail(d.schId);
      else openNotifyInbox();
      notifyMergeBackground().then(notifyRenderBadge);
    });
  }

  if (notifyLedger.enabled) notifyRegisterBackground();
  notifyMaybeAskConsent(1800);
}
