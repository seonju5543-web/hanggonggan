/* 브라우저 수집 로봇의 학교별 결과 → 건강 장부(collector/health.json) (2026-10-05 점검 B4)
   ------------------------------------------------------------------
   왜 따로 뺐나 — 예전 판정은 '후보 주소 하나라도 열렸나'뿐이었다. 그래서
     ① 열렸지만 장학 공고를 하나도 못 알아본 학교(홍익·시립 10-02~04)도 성공으로 적혀 lastOk 가 매일 오늘이었고,
     ② 예산으로 **건너뛴** 학교도 성공으로 적혔다(일반 로봇의 ⏰ 규칙과 반대 — 안 본 학교를 '오늘 성공'이라 적는다),
     ③ 장부를 일반 로봇과 같이 쓰는데(같은 학교 이름이 열쇠) 일반 로봇이 매 실행 fails 를 0 으로 되돌려
        브라우저 쪽 연속 실패가 영영 3에 닿지 않았다(서울대 10-01~04 매 실행 멈춤 · 경보 0회).
   그래서 브라우저 쪽 연속 횟수는 **제 칸(browserFails · browserWhy)**에 센다. 일반 로봇은 fails·lastOk 만 고치므로 이 칸은 지워지지 않는다.
   공용 칸 fails 의 뜻은 그대로다(관리자 화면의 'fails>0' 목록이 같이 본다).

   🔴 순수 함수만 둔다 — 파일·망을 쓰지 않는다(관문 verify/health-gates/browser.mjs 가 표본으로 돈다).
   🔴 원인을 단정하지 않는다 — 이유 문구는 '관측한 것'만(시한 안에 못 끝냄 · 열지 못함 · 장학 0건). */

/** 학교 하나의 이번 실행 결과
 *  skipped — 예산으로 시작하지 않았다(성공도 실패도 아니다 · 장부를 건드리지 않는다)
 *  stalled — 절대 시한(TARGET_HARD_MS)에 걸려 끊었다
 *  failed  — 후보 주소를 하나도 못 열었다
 *  empty   — 열렸지만 장학 공고를 하나도 못 알아봤다(이미 아는 공고를 건너뛴 것은 '읽은 것'이다 · worked)
 *  ok      — 읽었다 */
export function targetOutcome({ loadedAny, worked, stalled, skipped } = {}) {
  if (skipped) return 'skipped';
  if (stalled) return 'stalled';
  if (!loadedAny) return 'failed';
  if (!worked) return 'empty';
  return 'ok';
}

export const BROWSER_WHY = { stalled: '시한 안에 못 끝냄', failed: '게시판을 열지 못함', empty: '열렸지만 장학 공고 0건' };
/* 이만큼 연속이면 리포트 머리 🚨 + 알림 — 한 번은 학교 서버가 잠깐 늦은 것일 수 있다(일반 로봇과 같은 문턱) */
export const CHRONIC_AT = 3;

/**
 * @param {object} health  health.json 내용(그 자리에서 고친다)
 * @param {{name:string, outcome:string}[]} rows  이번 실행의 브라우저 대상 전부(browser-targets.json targets)
 * @param {string} runDate  'YYYY-MM-DD'(한국 날짜)
 * @returns {{health:object, chronic:{name:string,n:number,why:string}[]}}
 */
export function applyBrowserHealth(health, rows, runDate) {
  const h0 = health && typeof health === 'object' ? health : {};
  const chronic = [];
  const names = new Set();
  for (const { name, outcome } of rows || []) {
    if (!name) continue;
    names.add(name);
    if (outcome === 'skipped') continue;   // 안 본 학교 — lastOk 를 오늘로 찍지 않는다
    const h = h0[name] || { fails: 0, lastOk: null };
    if (outcome === 'ok') {
      h.fails = 0; h.lastOk = runDate; h.browserFails = 0;
      delete h.browserWhy;
    } else {
      h.fails = (h.fails || 0) + 1;
      h.browserFails = (h.browserFails || 0) + 1;
      h.browserWhy = BROWSER_WHY[outcome] || String(outcome || '');
      if (h.browserFails >= CHRONIC_AT) chronic.push({ name, n: h.browserFails, why: h.browserWhy });
    }
    h0[name] = h;
  }
  /* 브라우저 대상에서 빠진 학교(parked 로 옮김 등)의 브라우저 칸은 지운다 — 남겨 두면 다시 대상이 될 때 옛 횟수에서 시작한다 */
  for (const [k, h] of Object.entries(h0)) {
    if (names.has(k) || !h || typeof h !== 'object') continue;
    if ('browserFails' in h || 'browserWhy' in h) { delete h.browserFails; delete h.browserWhy; }
  }
  return { health: h0, chronic };
}

/* 리포트 머리 줄·워크플로 출력(한 줄) — 같은 글자를 두 곳에 쓴다 */
export const chronicList = (chronic) => (chronic || []).map((c) => `${c.name}(${c.n}회 연속 · ${c.why})`).join(' · ');
