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

  /* 알림 종류의 아이콘 — 이모지가 아니라 선 아이콘이다 (2026-08-29 UI 정리).
     🔴 이모지로 되돌리지 말 것: 기기마다 그림이 달라 브랜드가 잡히지 않고,
        "AI가 만든 앱"으로 읽히는 가장 큰 신호였다(공동개발자·전문가 지적).
     ⚠️ 이 문자열은 innerHTML 로 들어간다 — 사용자 입력이 아니라 여기 고정된 값뿐이라 안전하다.
     ⚠️ 서비스워커도 이 파일을 읽지만 OS 알림 아이콘은 icons/icon-192.png 를 쓴다(sw.js). */
  function svg(d) {
    return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }
  var NF_ICON = {
    cap:    svg('<path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/>'),
    clock:  svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    up:     svg('<path d="M12 19V6"/><path d="M6 12l6-6 6 6"/><path d="M4 21h16"/>'),
    school: svg('<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M10 21v-5h4v5"/>'),
    mail:   svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    bell:   svg('<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>'),
  };

  /* 알림 종류 — 설정 화면의 항목 순서이자 기본값 */
  var TYPES = [
    { id: 'newMatch', icon: NF_ICON.cap, label: '내 조건에 맞는 새 장학 공고',
      desc: '새로 등록된 공고가 내 자격에 맞으면 알립니다', on: true },
    { id: 'deadline', icon: NF_ICON.clock, label: '마감 하루 전 · 마감 당일',
      desc: '신청할 수 있는 공고의 마감이 임박하면 알립니다', on: true },
    { id: 'submit', icon: NF_ICON.up, label: '제출 리마인드',
      desc: '준비만 하고 아직 공식 제출을 기록하지 않은 공고를 알립니다', on: true },
    { id: 'feed', icon: NF_ICON.school, label: '우리 학교 새 공고',
      desc: '우리 학교 게시판에 새 장학 공고가 올라오면 묶어서 알립니다', on: true },
    { id: 'result', icon: NF_ICON.mail, label: '결과 기록 리마인드',
      desc: '제출한 공고의 접수 마감이 지나면 결과를 기록하도록 알립니다', on: true },
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

  /* 깨우기 푸시를 받았을 때 **구독을 스스로 끊어야 하는가** (2026-08-07 사고로 신설)
     ------------------------------------------------------------
     알림을 끈 사람에게는 알림을 띄우지 않아야 하므로, 그런 폰은 구독을 정리하는 것이 맞다.
     문제는 **'껐다'와 '못 읽었다'를 구분하지 않은 것**이었다. 서비스워커가 장부를 못 읽으면
     normalizeLedger(null)이 enabled:false인 **기본 장부**를 만들어 돌려주는데, 예전 코드는
     그걸 "사용자가 껐다"로 읽고 구독을 끊었다. 그래서 알림을 켜 둔 폰이 발송 서버에서
     조용히 사라졌다(2026-08-07 공동개발자 폰이 실제로 이렇게 없어졌다 — KV에 두 대가
     있다가 한 대가 됐다).
     그래서 **확실히 읽었고, 확실히 꺼져 있을 때만** 끊는다. 못 읽었으면 아무것도 하지 않는다
     (조용한 안내 알림 1건이 뜰 뿐이고, 그게 구독을 잃는 것보다 훨씬 가볍다).
       readOk : 장부 읽기가 오류 없이 끝났는가
       raw    : 실제로 저장돼 있던 장부 (없으면 null/undefined) */
  function shouldSelfUnsubscribe(raw, readOk) {
    if (!readOk) return false;                       // 못 읽었다 = 모른다
    if (!raw || typeof raw !== 'object') return false; // 장부 자체가 없다 = 모른다
    return normalizeLedger(raw).enabled === false;   // 읽었고, 꺼져 있다
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
    /* 화면에서 숨겨진 오래된 공고는 알림도 하지 않는다 — 눌러도 찾을 수 없는 공고를
       알리면 사용자만 혼란스럽다. 판정은 match-engine.js의 notStale 하나로 통일한다.
       (호출자가 넘겨주지 않으면 전역에 실린 notStale을 쓰고, 그마저 없으면 거르지 않는다) */
    var isFresh = ctx.notStale;
    if (typeof isFresh !== 'function') {
      isFresh = (typeof notStale === 'function')
        ? function (s) { return notStale(s, now); }
        : function () { return true; };
    }
    list = list.filter(isFresh);

    /* 실시간 공고가 내 학교 것인가 — 판정은 match-engine.js의 noticeForProfile 하나로 통일한다.
       분교(한양 ERICA 등)와 제목의 [서울]·[ERICA] 표시를 여기서 함께 처리하므로,
       화면과 갈라져 '화면에 없는 공고를 알리는' 일이 없다.
       (호출자가 안 넘기면 전역, 그마저 없으면 학교 이름이 같은 것만 — notStale과 같은 방식) */
    var noticeMine = ctx.noticeForProfile;
    if (typeof noticeMine !== 'function') {
      noticeMine = (typeof noticeForProfile === 'function')
        ? noticeForProfile
        : function (n, p) { return n.school === p.school && !(n.campus && p.campus && n.campus !== p.campus); };
    }

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
          title: '새 장학 공고 ' + fresh.length + '건',
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
            title: '새 장학 공고 · ' + s.name,
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
          title: (d === 1 ? '내일 마감 · ' : '오늘 마감 · ') + s.name,
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
          title: '제출 기록 없음 · ' + s.name,
          body: '마감 ' + (d === 0 ? '당일' : 'D-' + d) + '이에요. 제출을 마쳤다면 앱에 기록해 주세요.',
          schId: s.id,
        });
      });
    }

    /* ── 4. 우리 학교 실시간 공고 (묶음 1건) ──────────────────── */
    var freshNotices = [];
    notices.forEach(function (n) {
      if (!n || !n.url) return;
      // 내 학교 공고인지는 match-engine이 정한다 — 화면(app.js)과 같은 판정이어야
      // 화면에 없는 공고를 알림으로 알리는 일이 없다. 분교(한양 ERICA 등)도 여기서 처리된다.
      if (!noticeMine(n, profile)) return;
      if (seenNotice[n.url]) return;
      seenNotice[n.url] = 1;
      if (isLoan(n.title)) return;                    // 대출·융자는 장학금이 아니다
      freshNotices.push(n);
    });
    if (!first && prefs.feed && freshNotices.length) {
      push({
        key: 'feed:' + ymd(now) + ':' + freshNotices.length,
        type: 'feed',
        title: profile.school + ' 새 공고 ' + freshNotices.length + '건',
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
          title: '결과 기록하기 · ' + s.name,
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
    ICON: NF_ICON,      /* 화면(notify.js)이 기본 아이콘을 쓸 때 */
    DEFAULT_PREFS: DEFAULT_PREFS,
    newLedger: newLedger,
    normalizeLedger: normalizeLedger,
    shouldSelfUnsubscribe: shouldSelfUnsubscribe,
    evaluate: evaluate,
    pushToInbox: pushToInbox,
    unreadCount: unreadCount,
    daysUntil: daysUntil,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NOTIFY_RULES;
