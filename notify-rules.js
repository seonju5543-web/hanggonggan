/* ============================================================
   한대장 — 알림 규칙 엔진 (순수 로직 · 화면 없음)
   앱 화면(notify.js)과 서비스워커(sw.js 백그라운드 확인)가 이 파일 하나를 공유한다.
   "언제 무엇을 알릴지"의 단 하나의 기준 — 규칙을 고치면 두 경로가 함께 바뀐다.

   설계 원칙 (운영 원칙 1·8-1 준수)
   - 앱은 학교 전산을 볼 수 없다. 그래서 알림은 **앱이 실제로 아는 사실**로만 만든다:
     ① 정식 등록 공고 목록의 변화 ② 공고에 적힌 마감일 ③ 사용자가 직접 기록한 진척도.
     "합격했어요" 같은 앱이 알 수 없는 알림은 만들지 않는다.
   - 처음 켰을 때 기존 공고 수십 건을 '새 공고'라며 쏟아내지 않는다(baseline 처리).
   ============================================================ */

var NOTIFY_RULES = (function () {
  'use strict';

  /* 알림 종류 — 설정 화면의 항목 순서이자 기본값 */
  var TYPES = [
    { id: 'newMatch', icon: '🎓', label: '내 조건에 맞는 새 장학 공고',
      desc: '새로 등록된 공고가 내 자격에 맞으면 알려드려요', on: true },
    { id: 'deadline', icon: '⏰', label: '마감 하루 전 · 마감 당일',
      desc: '신청할 수 있는 공고의 마감이 임박하면 알려드려요', on: true },
    { id: 'submit', icon: '📤', label: '제출 리마인드',
      desc: '앱에서 준비만 하고 아직 공식 제출을 기록하지 않은 공고를 챙겨드려요', on: true },
    { id: 'feed', icon: '🏫', label: '우리 학교 새 공고',
      desc: '우리 학교 게시판에 새 장학 공고가 올라오면 묶어서 알려드려요', on: true },
    { id: 'result', icon: '📮', label: '결과 기록 리마인드',
      desc: '제출한 공고의 접수 마감이 지나면 결과를 기록하도록 알려드려요', on: true },
  ];

  var DEFAULT_PREFS = TYPES.reduce(function (o, t) { o[t.id] = t.on; return o; }, {});

  /* 한 번 확인할 때 만들 수 있는 알림의 상한 — 폭탄 방지 */
  var MAX_EVENTS = 12;
  /* 보낸 기록 보관 기간(재발송 방지) */
  var SENT_TTL = 120 * 86400000;

  function newLedger() {
    return {
      version: 1,
      askedAt: null,        // 최초 1회 동의 안내를 띄운 시각 (있으면 다시 자동으로 뜨지 않음)
      enabled: false,       // 앱 안의 알림 사용 스위치 (OS 권한과 별개)
      prefs: Object.assign({}, DEFAULT_PREFS),
      seenSch: [],          // 이미 인지한 정식 등록 공고 id
      seenNotice: [],       // 이미 인지한 실시간 공고 주소
      sent: {},             // 보낸 알림 키 → 시각 (같은 알림 두 번 안 보내기)
      inbox: [],            // 앱 안 알림함 (최근 60건)
      baseline: false,      // 첫 동기화(기존 공고를 '이미 본 것'으로 정리)를 마쳤는지
      lastCheck: 0,
    };
  }

  /* 저장돼 있던 예전 구조도 안전하게 읽히도록 기본값과 합친다 */
  function normalizeLedger(raw) {
    var l = Object.assign(newLedger(), raw || {});
    l.prefs = Object.assign({}, DEFAULT_PREFS, l.prefs || {});
    l.seenSch = Array.isArray(l.seenSch) ? l.seenSch : [];
    l.seenNotice = Array.isArray(l.seenNotice) ? l.seenNotice : [];
    l.inbox = Array.isArray(l.inbox) ? l.inbox : [];
    l.sent = (l.sent && typeof l.sent === 'object') ? l.sent : {};
    return l;
  }

  /* 날짜 단위로만 비교한다 — 시각까지 섞으면 마감 다음 날 새벽에 'D-DAY'가 뜬다 */
  function daysUntil(dateStr, now) {
    if (!dateStr) return null;
    var t = new Date(String(dateStr) + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var n = new Date(now);
    var start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - start) / 86400000);
  }

  function ymd(now) {
    var n = new Date(now);
    var m = String(n.getMonth() + 1).padStart(2, '0');
    var d = String(n.getDate()).padStart(2, '0');
    return n.getFullYear() + '-' + m + '-' + d;
  }

  /* 장학금이 아닌 학자금 대출·융자 공고는 알림에서 제외 (피드에는 정직하게 남는다) */
  function isLoan(title) {
    return /대출|융자/.test(String(title || ''));
  }

  /* ------------------------------------------------------------
     evaluate(ctx) → { events, ledger }
     ctx = {
       now, profile, applications, scholarships, notices, ledger,
       matchStatus(sch) : 'eligible'|'selective'|'unknown'|'ineligible'
     }
     events[] = { key, type, title, body, schId?, url }
     ------------------------------------------------------------ */
  function evaluate(ctx) {
    ctx = ctx || {};
    var now = ctx.now || Date.now();
    var ledger = normalizeLedger(ctx.ledger);
    var profile = ctx.profile;
    var events = [];

    if (!profile || !profile.school) {
      ledger.lastCheck = now;
      return { events: events, ledger: ledger };
    }

    var prefs = ledger.prefs;
    var list = ctx.scholarships || [];
    var apps = ctx.applications || [];
    var notices = ctx.notices || [];
    var first = !ledger.baseline; // 첫 동기화는 '조용히' 현재 상태만 기억한다
    var seenSch = {};
    ledger.seenSch.forEach(function (id) { seenSch[id] = 1; });
    var seenNotice = {};
    ledger.seenNotice.forEach(function (u) { seenNotice[u] = 1; });

    var statusOf = typeof ctx.matchStatus === 'function'
      ? ctx.matchStatus
      : function () { return 'unknown'; };
    var byId = {};
    list.forEach(function (s) { byId[s.id] = s; });

    function already(key) { return !!ledger.sent[key]; }
    function push(ev) {
      if (already(ev.key) || events.length >= MAX_EVENTS) return;
      ledger.sent[ev.key] = now;
      ev.url = ev.url || (ev.schId ? './?sch=' + encodeURIComponent(ev.schId) : './');
      events.push(ev);
    }

    /* ── 1. 내 조건에 맞는 새 장학 공고 ───────────────────────── */
    var fresh = [];
    list.forEach(function (s) {
      if (!s || !s.id) return;
      if (seenSch[s.id]) return;
      seenSch[s.id] = 1;
      if (s.program) return;                          // 상시 제도는 '새 공고'가 아니다
      var days = daysUntil(s.deadline, now);
      if (days != null && days < 0) return;           // 이미 마감된 공고
      if (statusOf(s) === 'ineligible') return;       // 자격이 안 되는 공고는 알리지 않는다
      fresh.push(s);
    });

    if (!first && prefs.newMatch && fresh.length) {
      if (fresh.length > 3) {
        push({
          key: 'new:batch:' + ymd(now) + ':' + fresh.length,
          type: 'newMatch',
          title: '🎓 새 장학 공고 ' + fresh.length + '건이 등록됐어요',
          body: fresh.slice(0, 2).map(function (s) { return s.name; }).join(', ')
            + ' 외 ' + (fresh.length - 2) + '건 · 내 조건에 맞는 공고예요',
          url: './?screen=explore',
        });
      } else {
        fresh.forEach(function (s) {
          var d = daysUntil(s.deadline, now);
          push({
            key: 'new:' + s.id,
            type: 'newMatch',
            title: '🎓 새 장학 공고 — ' + s.name,
            body: (s.amount ? s.amount + ' · ' : '')
              + (d != null ? (d === 0 ? '오늘 마감' : '마감 D-' + d) : '마감 원문 확인'),
            schId: s.id,
          });
        });
      }
    }

    /* ── 2. 마감 하루 전 · 마감 당일 ──────────────────────────── */
    /* 방금 '새 공고'로 알린 공고는 제외한다 — 그 알림에 이미 마감일이 적혀 있어서
       같은 공고로 알림이 두 번 가면 사용자에겐 그냥 중복으로 보인다 */
    var justAnnounced = {};
    events.forEach(function (ev) { if (ev.type === 'newMatch' && ev.schId) justAnnounced[ev.schId] = 1; });

    if (prefs.deadline) {
      list.forEach(function (s) {
        if (!s || s.program || !s.deadline) return;
        if (justAnnounced[s.id]) return;
        var d = daysUntil(s.deadline, now);
        if (d !== 0 && d !== 1) return;
        var st = statusOf(s);
        if (st === 'ineligible') return;
        var app = apps.filter(function (a) { return a.id === s.id; })[0];
        if (app && app.submittedAt) return;           // 이미 제출을 기록한 공고는 재촉하지 않는다
        push({
          key: 'dl:' + s.id + ':' + d,
          type: 'deadline',
          title: (d === 1 ? '⏰ 내일 마감 — ' : '🚨 오늘 마감 — ') + s.name,
          body: app
            ? '준비해 둔 서류로 ' + (d === 1 ? '내일' : '오늘') + ' 안에 제출하세요.'
            : (d === 1 ? '아직 신청 준비 전이에요. 지금 준비하면 내일 제출할 수 있어요.'
                       : '오늘이 마지막 날이에요. 지금 바로 준비해 보세요.'),
          schId: s.id,
        });
      });
    }

    /* ── 3. 제출 리마인드 (앱에서 준비만 하고 공식 제출 기록이 없는 공고) ─ */
    if (prefs.submit) {
      apps.forEach(function (a) {
        if (!a || a.submittedAt || a.pending) return;
        var s = byId[a.id];
        if (!s || !s.deadline) return;
        var d = daysUntil(s.deadline, now);
        if (d == null || d < 0 || d > 3) return;
        push({
          key: d === 0 ? 'sub:' + s.id + ':last' : 'sub:' + s.id,
          type: 'submit',
          title: '📤 아직 제출 기록이 없어요 — ' + s.name,
          body: '마감 ' + (d === 0 ? '당일' : 'D-' + d) + '이에요. 제출을 마쳤다면 앱에 기록해 주세요.',
          schId: s.id,
        });
      });
    }

    /* ── 4. 우리 학교 실시간 공고 (묶음 1건) ──────────────────── */
    var freshNotices = [];
    notices.forEach(function (n) {
      if (!n || !n.url) return;
      if (n.school !== profile.school) return;
      if (n.campus && profile.campus && n.campus !== profile.campus) return;
      if (seenNotice[n.url]) return;
      seenNotice[n.url] = 1;
      if (isLoan(n.title)) return;                    // 대출·융자는 장학금이 아니다
      freshNotices.push(n);
    });
    if (!first && prefs.feed && freshNotices.length) {
      push({
        key: 'feed:' + ymd(now) + ':' + freshNotices.length,
        type: 'feed',
        title: '🏫 ' + profile.school + ' 새 공고 ' + freshNotices.length + '건',
        body: freshNotices[0].title
          + (freshNotices.length > 1 ? ' 외 ' + (freshNotices.length - 1) + '건' : ''),
        url: './?screen=explore',
      });
    }

    /* ── 5. 결과 기록 리마인드 (제출 기록 + 접수 마감 후 2주) ──── */
    if (prefs.result) {
      apps.forEach(function (a) {
        if (!a || !a.submittedAt || a.result) return;
        var s = byId[a.id];
        if (!s || !s.deadline) return;
        var d = daysUntil(s.deadline, now);
        if (d == null || d > -14) return;
        push({
          key: 'res:' + s.id,
          type: 'result',
          title: '📮 결과가 나왔나요? — ' + s.name,
          body: '접수 마감 후 2주가 지났어요. 선정 결과를 앱에 기록하면 신청 내역이 정확해져요.',
          schId: s.id,
        });
      });
    }

    /* ── 장부 정리 ─────────────────────────────────────────── */
    ledger.seenSch = Object.keys(seenSch);
    ledger.seenNotice = Object.keys(seenNotice).slice(-800);
    Object.keys(ledger.sent).forEach(function (k) {
      if (now - ledger.sent[k] > SENT_TTL) delete ledger.sent[k];
    });
    ledger.baseline = true;
    ledger.lastCheck = now;

    return { events: events, ledger: ledger };
  }

  /* 알림함에 쌓기 — OS 알림이 꺼져 있어도 사용자가 놓치지 않도록 앱 안에 남긴다 */
  function pushToInbox(ledger, events, now) {
    events.forEach(function (ev) {
      ledger.inbox.unshift({
        key: ev.key, type: ev.type, title: ev.title, body: ev.body,
        schId: ev.schId || null, url: ev.url || './', ts: now, read: false,
      });
    });
    ledger.inbox = ledger.inbox.slice(0, 60);
    return ledger;
  }

  function unreadCount(ledger) {
    return (ledger && ledger.inbox ? ledger.inbox : []).filter(function (i) { return !i.read; }).length;
  }

  return {
    TYPES: TYPES,
    DEFAULT_PREFS: DEFAULT_PREFS,
    newLedger: newLedger,
    normalizeLedger: normalizeLedger,
    evaluate: evaluate,
    pushToInbox: pushToInbox,
    unreadCount: unreadCount,
    daysUntil: daysUntil,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NOTIFY_RULES;
