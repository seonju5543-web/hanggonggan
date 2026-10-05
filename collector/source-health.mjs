/* 대외활동·재단 출처의 연속 실패 장부 — collector/source-health.json (2026-10-05 점검 collect-08 · api-09)
   ------------------------------------------------------------------
   왜 따로 두나 — 학교 장학 게시판의 연속 실패는 health.json 이 센다. 활동·재단 게시판은 거기 넣을 수 없다
   (prune-health.mjs 가 schools.json 학교 이름이 아닌 열쇠를 고아로 지운다 · collect.mjs 의 actResults 주석). 그래서 그동안
   **연속 실패를 세는 장부가 아예 없었다** — 10-04 리포트 기준 대외활동 출처 23곳 중 14곳(⛔ robots 5 · ⚠️ 404 2 · 🟡 0건 7)이
   글을 못 내는데 리포트 꼬리의 상태 줄에만 남고 경보는 구조적으로 0회였다.
   열쇠는 게시판 주소(boardUrl) — 이름은 리포트용이라 바뀔 수 있다.

   🔴 순수 함수만 둔다(관문 verify/health-gates/browser.mjs 가 표본으로 돈다). 파일 읽기·쓰기는 collect.mjs 가 한다.
   🔴 원인을 단정하지 않는다 — why 는 그 실행의 상태 줄 앞부분 그대로(관측). */

/* 이만큼 연속이면 리포트 머리 🙋 — 수집 로봇이 하루 세 번 돌아 약 이틀. 한두 번은 사이트가 잠깐 늦은 것일 수 있다 */
export const STALE_AT = 6;

/**
 * @param {object} ledger  source-health.json 내용 { [boardUrl]: { name, fails, lastOk, why? } } (그 자리에서 고친다)
 * @param {{key:string, name:string, status:string}[]} rows  이번 실행의 활동·재단 게시판 상태 줄(key = boardUrl)
 * @param {string} today  'YYYY-MM-DD'
 * @param {{live?: Iterable<string>}} [opts]  지금 출처 목록의 boardUrl 전부 — 없으면 rows 의 key
 * @returns {{ledger:object, stale:{key:string,name:string,why:string,n:number}[]}}
 */
export function updateSourceHealth(ledger, rows, today, opts = {}) {
  const out = ledger && typeof ledger === 'object' ? ledger : {};
  const live = new Set(opts.live || (rows || []).map((r) => r && r.key).filter(Boolean));
  /* 같은 주소를 두 출처가 함께 쓰면(활동·재단 양쪽에 적힌 게시판) 한 실행에 한 번만 센다 — 하나라도 ✅ 면 성공, 아니면 첫 실패 줄 */
  const byKey = new Map();
  for (const r of rows || []) {
    const key = r && r.key;
    if (!key) continue;
    const st = String(r.status || '').trim();
    if (/^(?:⏰|⚙️)/u.test(st)) continue;   // 예산으로 안 봄 · 주소 없음 — 성공도 실패도 아니다(lastOk 를 오늘로 찍지 않는다)
    const prev = byKey.get(key);
    if (!prev || (/^✅/u.test(st) && !/^✅/u.test(prev.st))) byKey.set(key, { name: r.name, st });
  }
  for (const [key, { name, st }] of byKey) {
    const h = out[key] || { name: name || '', fails: 0, lastOk: null };
    if (name) h.name = name;
    if (/^✅/u.test(st)) {
      h.fails = 0; h.lastOk = today;
      delete h.why;
    } else {                                   // ⚠️ 접속 실패·오류 · ⛔ robots.txt·시한 · 🟡 열렸지만 글 0건 — 전부 '글이 안 들어온다'
      h.fails = (h.fails || 0) + 1;
      h.why = st.slice(0, 80);
    }
    out[key] = h;
  }
  for (const k of Object.keys(out)) if (!live.has(k)) delete out[k];   // 출처 목록에서 빠진(보관·삭제) 게시판
  const stale = Object.entries(out)
    .filter(([, h]) => h && (h.fails || 0) >= STALE_AT)
    .map(([key, h]) => ({ key, name: h.name || key, why: h.why || '', n: h.fails }));
  return { ledger: out, stale };
}

/* 리포트 머리 한 줄 — '🙋 ' 로 시작해야 0건 날 코멘트(collect-scholarships.yml '0건 실행 알림')에도 실린다 */
export function staleSourcesLine(stale) {
  if (!stale || !stale.length) return '';
  const each = stale.map((s) => `${s.name}(${String(s.why).split(' — ')[0].trim()} · ${s.n}회 연속)`).join(' · ');
  return `🙋 연속 ${STALE_AT}회(약 이틀) 넘게 글이 안 들어오는 대외활동·재단 출처 ${stale.length}곳 — 대외활동은 관리자 「활동」 탭에서 보관하거나 주소를 고치고, 재단·지자체는 collector/external-sources.json 에서 고쳐 주세요: ${each}`;
}
