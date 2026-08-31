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
      ? 'iPhone은 홈 화면에 앱 추가 후 수신 가능'
      : '이 브라우저는 알림 미지원');
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
    noticeForProfile,
    notStale: (sch) => notStale(sch),   // 화면이 숨긴 오래된 공고는 알림도 하지 않는다
  });
  notifyLedger = out.ledger;

  if (out.events.length) {
    NOTIFY_RULES.pushToInbox(notifyLedger, out.events, Date.now());
    await notifyDeliver(out.events);
    if (!quiet) toast(`새 알림 ${out.events.length}건`);
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
      title: `한대장 · 새 알림 ${events.length}건`,
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
  return NOTIFY_RULES.TYPES.find((t) => t.id === type) || { icon: NOTIFY_RULES.ICON.bell, label: '알림' };
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
    : `<p class="empty">받은 알림 없음<br />새 공고가 등록되거나 마감이 다가오면 여기에 쌓여요.</p>`;

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
    <li><span class="nf-ico">${t.icon}</span><span><strong>${esc(t.label)}</strong></span></li>`).join('');

  openNotifyPanel(`
    <div class="nf-consent-hero">
      <div class="nf-bell"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></svg></div>
      <h3 class="sheet-title" style="margin-top:10px">장학금 알림 받기</h3>
      <p class="sheet-summary" style="margin-top:6px">마감을 놓쳐서 못 받는 장학금이 가장 아깝습니다.<br />꼭 필요한 것만 골라서 알립니다.</p>
    </div>
    <ul class="nf-type-list">${typeRows}</ul>
    <p class="sheet-note">${pushConfigured()
      ? '알림은 <strong>앱을 켜지 않아도</strong> 도착. 내용은 기기 안에서 생성 · 서버 저장은 폰 주소·학교만.'
      : '발송 서버 미연결. 알림은 <strong>앱을 열 때</strong>·<strong>열어 둔 동안</strong>, 지원 기기는 백그라운드 확인 시점에 전달.'} MY에서 언제든 켜기·끄기.</p>
    ${sup.iosNeedsInstall ? '<p class="sheet-note">iPhone은 사파리 공유 → <strong>홈 화면에 추가</strong>로 앱을 설치하면 수신 가능.</p>' : ''}
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
      const p = await pushEnsure(); // 발송 서버가 있으면 '앱을 안 켜도 오는 알림'까지 한 번에 켠다
      toast(p.ok
        ? '알림을 켰습니다. 앱을 켜지 않아도 폰으로 알립니다'
        : '알림을 켰습니다. 새 공고와 마감을 알립니다');
    } else if (perm === 'denied') {
      toast('브라우저에서 알림이 차단돼 있습니다. 앱 안 알림함으로 계속 알립니다');
    } else {
      toast('앱 안 알림함으로 알립니다. MY에서 언제든 켤 수 있습니다');
    }
    if (!$('#screen-my').hidden) renderMy();
    notifyRenderBadge();
  });

  $('#btn-nf-later').addEventListener('click', async () => {
    notifyLedger.enabled = false;
    await finish();
    closeNotifyPanel();
    toast('알림은 MY 화면에서 언제든 켜기 가능');
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
  if (!sup.hasApi) { statusText = sup.iosNeedsInstall ? '홈 화면에 앱 추가 후 사용 가능' : '이 브라우저는 휴대폰 알림 미지원'; statusCls = 'off'; }
  else if (sup.permission === 'denied') { statusText = '브라우저에서 차단됨 · 사이트 설정에서 알림 허용 필요'; statusCls = 'off'; }
  else if (on) { statusText = '휴대폰 알림 켜짐'; statusCls = 'on'; }
  else if (sup.permission === 'granted') { statusText = '허용됨 · 앱에서 꺼 둔 상태'; statusCls = 'off'; }
  else { statusText = '아직 켜지 않음'; statusCls = 'off'; }

  const rows = NOTIFY_RULES.TYPES.map((t) => `
    <label class="nf-pref">
      <span class="nf-pref-text"><strong>${t.icon} ${esc(t.label)}</strong></span>
      <input type="checkbox" class="nf-switch" data-nf-pref="${t.id}" ${notifyLedger.prefs[t.id] ? 'checked' : ''} />
    </label>`).join('');

  /* 진짜 푸시(앱을 안 켜도 오는 알림) — 2026-08-06 개발자 지시로 **기본값**이 됐다.
     예전에는 별도 스위치로 사용자가 한 번 더 켜야 했는데, 그 스위치를 눌러 본 사람이 아무도 없어
     실제로 등록된 폰이 0대였다. 이제 알림을 켜면 자동으로 연결되고(pushEnsure),
     여기서는 **상태만 보여준다**(끄려면 위의 알림 끄기 하나로 충분하다). */
  const canPush = pushConfigured();
  const pushOn = pushActive();
  const iosNotInstalled = /iPad|iPhone|iPod/.test(navigator.userAgent) && !sup.standalone;
  const pushBlock = !canPush ? `
    <div class="nf-push nf-push-off">
      <p class="nf-push-title">앱을 켜지 않아도 받기 — 준비 중</p>
      <p class="nf-desc">지금은 <strong>앱을 열 때</strong> 확인. 발송 서버 연결 시 앱을 안 켜도 도착.</p>
    </div>`
    : !on ? '' : `
    <div class="nf-push${pushOn ? ' nf-push-on' : ''}">
      <p class="nf-push-title">${pushOn ? '앱을 켜지 않아도 받는 중' : '연결하는 중'}</p>
      <p class="nf-desc">${pushOn
        ? '앱을 닫아 두거나 화면이 꺼져 있어도 마감·새 공고 알림 도착.'
        : esc(pushReasonText(pushLastReason, iosNotInstalled))}</p>
      ${iosNotInstalled ? '<p class="nf-desc">iPhone은 사파리 <strong>공유 → 홈 화면에 추가</strong>로 설치해야 앱을 켜지 않아도 수신 가능.</p>' : ''}
      <p class="nf-desc">서버 저장: <strong>폰 주소·학교</strong>만. 이름·성적·소득·서류는 기기 밖으로 안 나감.</p>
    </div>`;

  return `
    <div class="nf-set-head">
      <div>
        <p class="wallet-title">알림</p>
        <p class="nf-status nf-status-${statusCls}">${esc(statusText)}</p>
      </div>
      <button class="wallet-btn ${on ? '' : 'primary'}" id="btn-nf-toggle">${on ? '끄기' : '켜기'}</button>
    </div>
    <div class="nf-prefs">${rows}</div>
    ${pushBlock}
    <p class="wallet-sub" style="margin-top:12px">${canPush && pushOn
      ? '알림 내용은 기기 안에서 생성 — 서버는 폰을 깨우기만 함.'
      : '<strong>앱을 열 때 · 열어 둔 동안</strong> 확인(안드로이드 설치형은 백그라운드도). 알림 내용은 기기 안에서만 생성.'}</p>
`;
}

function bindNotifySettings() {
  const toggle = $('#btn-nf-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', async () => {
    const sup = notifySupport();
    if (notifyLedger.enabled && sup.permission === 'granted') {
      notifyLedger.enabled = false;
      await notifySaveLedger();
      await pushUnsubscribe(); // 알림을 끄면 서버가 폰을 깨우는 것도 함께 멈춘다
      toast('휴대폰 알림 꺼짐 · 앱 안 알림함에는 계속 쌓여요');
    } else {
      const perm = await notifyRequestPermission();
      notifyLedger.askedAt = notifyLedger.askedAt || Date.now();
      notifyLedger.enabled = perm === 'granted';
      await notifySaveLedger();
      if (perm === 'granted') {
        notifyRegisterBackground();
        // 알림을 켜면 '앱을 안 켜도 오는 알림'까지 함께 켠다 (별도 스위치 없음 — 2026-08-06)
        const p = await pushEnsure();
        toast(p && p.ok
          ? '알림을 켰습니다. 앱을 켜지 않아도 폰으로 알립니다'
          : '알림 켜짐');
      }
      else if (perm === 'denied') toast('브라우저 사이트 설정에서 알림 허용 필요');
    }
    renderMy();
  });

  $$('[data-nf-pref]').forEach((el) => el.addEventListener('change', async () => {
    notifyLedger.prefs[el.dataset.nfPref] = el.checked;
    await notifySaveLedger();
  }));

  { const e = $('#btn-nf-inbox'); if (e) e.addEventListener('click', openNotifyInbox); }
  if ($('#btn-nf-recheck')) $('#btn-nf-recheck').addEventListener('click', async () => {
    const n = await notifyCheck({ quiet: true });
    toast(n ? `새 알림 ${n}건` : '새로 온 알림이 없습니다');
  });
  if ($('#btn-nf-test')) $('#btn-nf-test').addEventListener('click', async () => {
    const ev = {
      key: 'test:' + Date.now(),
      type: 'newMatch',
      title: '한대장 테스트 알림',
      body: '알림 도착 예시 · 실제 알림에는 공고 이름과 마감일 포함.',
      url: './?screen=notifications',
    };
    NOTIFY_RULES.pushToInbox(notifyLedger, [ev], Date.now());
    await notifyDeliver([ev]);
    await notifySaveLedger();
    notifyRenderBadge();
    const sup = notifySupport();
    toast(notifyLedger.enabled && sup.permission === 'granted'
      ? '테스트 알림 발송'
      : '알림함에 테스트 알림 기록 (휴대폰 알림 꺼짐)');
  });
}

/* ============================================================
   진짜 푸시 (앱을 켜지 않아도 폰에 오는 알림)
   ------------------------------------------------------------
   발송 서버(server/push/)가 "확인해 봐"라고 폰을 깨우면, 서비스워커가 **기기 안 프로필로**
   판단해 알림을 띄운다. 그래서 이름·성적·소득 같은 개인정보는 서버로 나가지 않고
   **폰 주소와 학교만** 등록된다.
   push-config.js가 비어 있으면(=서버 미배포) 이 절은 통째로 잠들어 아무 일도 하지 않는다.
   ============================================================ */

/* 브라우저가 진짜 푸시를 지원하는지 (iOS는 홈 화면에 설치해야 지원한다) */
function pushSupported() {
  return typeof PushManager !== 'undefined' && 'serviceWorker' in navigator && typeof Notification !== 'undefined';
}

function urlB64ToUint8(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function pushRegistration() {
  if (typeof swReg !== 'undefined' && swReg) return swReg;
  try { return await navigator.serviceWorker.ready; } catch (e) { return null; }
}

/* 폰을 발송 서버에 등록 — 성공하면 앱을 안 켜도 알림이 온다 */
async function pushSubscribe(replacingEndpoint) {
  if (!pushConfigured()) return { ok: false, reason: 'unconfigured' };
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' };

  /* 갈아타기 전의 옛 주소 — 등록에 성공하면 서버에서 지워 달라고 알린다 (2026-08-07).
     폰 주소는 폰이 앱을 정리하거나 저장 공간을 비우면 바뀌는데, 예전에는 새 주소만
     등록하고 옛 주소를 그대로 둬서 서버에 **죽은 등록이 산 것처럼 쌓였다**(KV에 2개가
     보여도 실제로 받는 폰은 1대이던 상태). 사용자가 늘수록 이 껍데기가 발송 예산을
     갉아먹으므로, 갈아탈 때 바로 치운다. 못 지워도 다음 발송이 404로 정리한다(2중 안전망). */
  const oldEndpoint = replacingEndpoint || (notifyLedger && notifyLedger.pushEndpoint) || null;

  const reg = await pushRegistration();
  if (!reg || !reg.pushManager) return { ok: false, reason: 'unsupported' };

  let sub;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true, // 받은 푸시는 반드시 눈에 보이는 알림으로 띄운다는 약속
        applicationServerKey: urlB64ToUint8(PUSH_CONFIG.publicKey),
      });
    }
  } catch (e) { return { ok: false, reason: 'subscribe-failed' }; }

  const p = (typeof state !== 'undefined' && state.profile) || {};
  try {
    const res = await fetch(PUSH_CONFIG.endpoint.replace(/\/+$/, '') + '/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // 서버로 나가는 것은 이 세 가지뿐이다 — 이름·성적·소득·서류는 기기 밖으로 나가지 않는다
      body: JSON.stringify({ endpoint: sub.endpoint, school: p.school || '', campus: p.campus || '' }),
    });
    if (!res.ok) return { ok: false, reason: 'server' };
  } catch (e) { return { ok: false, reason: 'network' }; }

  notifyLedger.pushEndpoint = sub.endpoint;
  notifyLedger.pushSchool = p.school || '';
  notifyLedger.pushSyncedAt = Date.now();   // 하루 뒤 다시 알리기 위한 기준
  await notifySaveLedger();

  // 주소를 갈아탔으면 옛 등록을 서버에서 지운다 (실패해도 등록 자체는 성공 — 다음 발송이 정리)
  if (oldEndpoint && oldEndpoint !== sub.endpoint) {
    try {
      await fetch(PUSH_CONFIG.endpoint.replace(/\/+$/, '') + '/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: oldEndpoint }),
      });
    } catch (e) { /* 다음 발송의 404 정리에 맡긴다 */ }
  }
  return { ok: true };
}

/* 등록 해제 — 서버에서도 지우고 브라우저 구독도 끊는다 */
async function pushUnsubscribe() {
  const endpoint = notifyLedger && notifyLedger.pushEndpoint;
  try {
    const reg = await pushRegistration();
    const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
    if (sub) await sub.unsubscribe();
  } catch (e) { /* 이미 끊겼으면 무시 */ }
  if (endpoint && pushConfigured()) {
    try {
      await fetch(PUSH_CONFIG.endpoint.replace(/\/+$/, '') + '/unsubscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });
    } catch (e) { /* 서버가 잠깐 죽어도 앱 쪽은 끊긴다 */ }
  }
  if (notifyLedger) {
    notifyLedger.pushEndpoint = null;
    notifyLedger.pushSchool = '';
    await notifySaveLedger();
  }
}

function pushActive() {
  return !!(notifyLedger && notifyLedger.pushEndpoint && pushConfigured());
}

/* 브라우저에 **실제로 살아 있는** 구독 주소 (없으면 null)
   ------------------------------------------------------------
   pushActive()는 앱이 적어 둔 메모만 본다. 그런데 구독은 앱이 모르는 사이에 사라진다 —
   iPhone이 안 쓰는 앱을 정리할 때, 사용자가 저장 공간을 지울 때, 브라우저가 주소를 바꿀 때.
   그때 메모만 믿으면 앱은 영영 "등록돼 있다"고 착각하고 다시 등록하지 않는다
   (2026-08-06 공동개발자 폰이 정확히 이 상태였다 — 앱을 켤 때만 알림이 보였다). */
async function pushRealEndpoint() {
  try {
    const reg = await pushRegistration();
    if (!reg || !reg.pushManager) return null;
    const sub = await reg.pushManager.getSubscription();
    return sub ? sub.endpoint : null;
  } catch (e) { return null; }
}

/* 서버가 죽은 구독으로 오해해 지웠을 수도 있으므로 하루에 한 번은 다시 알린다.
   /subscribe는 같은 주소를 덮어쓰기만 하므로 여러 번 불러도 안전하다. */
const PUSH_RESYNC_MS = 24 * 60 * 60 * 1000;
function pushNeedsResync() {
  const at = notifyLedger && notifyLedger.pushSyncedAt;
  return !at || (Date.now() - at) > PUSH_RESYNC_MS;
}

/* 학교를 바꾸면 서버에 등록된 학교도 따라가야 한다 (안 그러면 남의 학교 공고로 깨워진다) */
async function pushSyncSchool() {
  if (!pushActive()) return;
  const p = (typeof state !== 'undefined' && state.profile) || {};
  if ((p.school || '') === (notifyLedger.pushSchool || '')) return;
  await pushSubscribe();
}

/* 알림이 켜져 있으면 **자동으로** 발송 서버에 등록한다 (2026-08-06 — 이게 없어서 등록된 폰이 0대였다)
   ------------------------------------------------------------
   예전에는 등록이 '최초 1회 동의 시트'에서만 일어났다. 그런데 그 시트는 사람당 딱 한 번만 뜨므로,
   **알림을 이미 켜 둔 사용자**(= 발송 서버가 생기기 전에 켠 모든 사람)는 영영 등록되지 않았다.
   MY 화면에서 알림을 켜는 경로에도 등록이 빠져 있었다. 그래서 앱을 열 때마다 여기서 메꾼다.

   2026-08-07 보강 — **메모가 아니라 브라우저의 진짜 구독을 확인한다.** 예전에는 메모가 있으면
   그대로 통과시켜서, 구독이 죽은 폰은 앱을 아무리 열어도 되살아나지 않았다. 이제 세 가지를 본다:
   ① 브라우저에 구독이 없으면 → 메모를 지우고 새로 등록  ② 주소가 메모와 다르면 → 다시 등록
   ③ 같아도 하루가 지났으면 → 서버에 한 번 더 알린다(서버가 지웠을 수 있으므로). */
async function pushEnsure() {
  if (!notifyLedger || !notifyLedger.enabled) return pushRemember({ ok: false, reason: 'off' });
  if (!pushConfigured() || !pushSupported()) return pushRemember({ ok: false, reason: 'unsupported' });
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return pushRemember({ ok: false, reason: 'permission' });
  }

  const real = await pushRealEndpoint();
  if (!real) {
    // 브라우저에 구독이 없다 — 메모가 남아 있어도 그건 죽은 기록이다.
    // 메모를 지우기 전에 옛 주소를 붙잡아 둔다: 새로 등록할 때 서버의 죽은 등록도 함께 지우기 위해
    const deadEndpoint = notifyLedger.pushEndpoint || null;
    if (notifyLedger.pushEndpoint) {
      notifyLedger.pushEndpoint = null;
      notifyLedger.pushSchool = '';
      await notifySaveLedger();
    }
    return pushRemember(await pushSubscribe(deadEndpoint));
  }
  if (real !== notifyLedger.pushEndpoint) return pushRemember(await pushSubscribe());

  await pushSyncSchool();
  if (pushNeedsResync()) return pushRemember(await pushSubscribe());
  return pushRemember({ ok: true, reason: 'already' });
}

/* 마지막 결과를 기억해 MY 화면이 **왜** 연결되지 않았는지 말해 줄 수 있게 한다.
   예전에는 '연결하는 중'만 떠서, 폰이 알림을 막고 있는 것인지 서버가 안 되는 것인지
   사용자도 개발자도 알 수 없었다. */
let pushLastReason = null;
function pushRemember(res) {
  pushLastReason = res && res.ok ? null : (res && res.reason) || null;
  return res;
}

/* 원인을 사용자가 할 수 있는 행동으로 바꿔 준다 (전문 용어 금지 — 이 화면은 학생이 본다) */
function pushReasonText(reason, iosNotInstalled) {
  if (iosNotInstalled) return '이 기기에 아직 연결되지 않음.';
  switch (reason) {
    case 'permission':
      return '휴대폰이 이 앱의 알림 차단 중. 폰 설정 → 알림에서 한대장을 허용해 주세요.';
    case 'unsupported':
      return '이 브라우저에서는 앱을 켜지 않아도 오는 알림 사용 불가. 크롬·사파리로 열기 필요(카카오톡 인앱 브라우저 불가).';
    case 'network':
    case 'server':
      return '연결 일시 실패. 앱을 껐다 켜면 재시도.';
    case 'subscribe-failed':
      return '휴대폰이 알림 연결 거절. 폰 설정 → 알림에서 허용한 뒤 앱을 껐다 켜 주세요.';
    default:
      return '곧 자동 연결. 앱을 껐다 켜면 즉시 반영.';
  }
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
    if (document.visibilityState !== 'visible') return;
    setTimeout(() => notifyCheck({ quiet: false }), 1500);
    // 브라우저 설정에서 알림을 뒤늦게 허용한 경우에도 여기서 등록이 메꿔진다
    pushEnsure().catch(() => {});
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

  if (notifyLedger.enabled) {
    notifyRegisterBackground();
    // 아직 발송 서버에 등록되지 않았으면 지금 등록하고, 이미 됐으면 학교만 맞춘다
    pushEnsure().catch(() => {});
  }
  notifyMaybeAskConsent(1800);
}
