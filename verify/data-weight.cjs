/* ============================================================
   폰이 받는 양을 재는 곳 한 곳 (2026-09-26 · 개발자 지시)

   개발자: *"그럼 학교 늘리면 그때 다시 학교별로 나누라고 얘기해줘."*

   🔴 **문서에만 적으면 아무도 안 본다** — CLAUDE.md 의 규칙 그대로다:
      "검사는 '돌리라고 적어 두면' 안 돈다 — 워크플로·훅에 걸어야 돈다."
      그래서 데이터가 **스스로 재서** 그때 말한다.

   🔴 재는 규칙을 여기 한 곳에만 둔다 — 감사(`verify/audit-data.js`)와 수집 리포트
      (`collector/collect.mjs` → GitHub 이슈)가 **같은 함수**를 쓴다. 두 곳에 베껴 두면
      한쪽 숫자만 고치고 다른 쪽이 옛말을 하게 된다(이 저장소가 match-engine 을 화면·알림이
      함께 쓰는 것과 같은 이유).
   ⚠️ 경고는 **오류가 아니다** — 오류로 두면 자동 등록이 멈춘다(`entry-rules.cjs` 와 같은 이유).
   ============================================================ */

/* 🔴 선은 여기 한 곳. 150KB = 그 시점이면 학생이 **자기와 상관없는 공고만으로**
   지금 파일 전체(2026-09-26 실측 191KB)에 가까운 양을 받는다.
   ⚠️ 숫자를 문서에 베껴 적지 말 것 — 사본은 반드시 낡는다(CLAUDE.md). */
const SPLIT_WARN_BYTES = 150 * 1024;

/**
 * 정식 등록이 학교별로 나눌 때가 됐는가.
 *
 * 왜 아직 안 나눴나 (2026-09-26 실측): 191KB 중 **88KB 가 전국 공고**라 모두가 받아야 한다.
 * 학교 한정분 81KB 중 60KB 가 가장 큰 학교 것이니, 한 학생이 남의 학교 것으로 받는 양은
 * **21KB** 뿐이었다 — 나눠도 오늘 이득이 작고, 공고·학과와 달리 **전국분을 따로 두는 한 겹**이
 * 더 붙는다. 그런데 그 21KB 는 학교 수와 함께 자란다(추정: 10곳 244KB · 40곳 1MB).
 *
 * @param {{items?: object[]}} reg  data/registered.json
 * @returns {{over: boolean, wasted: number, nation: number, schools: number, line: string|null}}
 */
/* 이 공고를 받는 **학교들**. 비어 있으면 전국(모두가 받는다).
   🔴 나누면 파일은 **학교 단위**다(`noticeFileFor` 와 같은 단위). 그래서 여러 학교가 함께
      받는 공고는 그 학교들 파일에 **각각** 들어간다 — 묶음 하나로 세면 안 된다
      (2026-09-26 코드 리뷰에서 잡았다: 7개 학교가 든 공고 하나를 '남의 것'으로 세어
      낭비를 네 배로 부풀렸고, `학교 N곳` 도 묶음 수라 틀렸다).
   ⚠️ `schoolsAny` 항목은 `"학교"` 또는 `"학교|캠퍼스"` 꼴이다(CLAUDE.md) → `|` 앞만 쓴다.
   ⚠️ `campusOnly` 는 캠퍼스 이름만 담아 학교를 모른다 — 실측 결과 그것만 있는 공고는 없고
      늘 `schoolOnly` 와 함께 온다. 혹시 혼자 오면 **전국으로 세지 않도록** 그 값으로 센다
      (학교를 모르니 한 묶음이 되지만, 전국으로 세어 낭비를 0으로 만드는 쪽이 더 나쁘다). */
function schoolsOfNotice(eligibility) {
  const e = eligibility || {};
  const out = new Set();
  if (e.schoolOnly) out.add(String(e.schoolOnly));
  if (Array.isArray(e.schoolsAny)) {
    for (const v of e.schoolsAny) {
      const name = String(v || '').split('|')[0].trim();
      if (name) out.add(name);
    }
  }
  if (!out.size && e.campusOnly) out.add(`캠퍼스:${e.campusOnly}`);
  return out;
}

/**
 * 정식 등록이 학교별로 나눌 때가 됐는가.
 *
 * 왜 아직 안 나눴나 (2026-09-26 실측): 191KB 중 **88KB 가 전국 공고**라 모두가 받아야 한다.
 * 학교 한정분 81KB 중 60KB 가 가장 큰 학교 것이니, 한 학생이 남의 학교 것으로 받는 양은
 * **21KB** 뿐이었다 — 나눠도 오늘 이득이 작고, 공고·학과와 달리 **전국분을 따로 두는 한 겹**이
 * 더 붙는다. 그런데 그 21KB 는 학교 수와 함께 자란다(추정: 10곳 244KB · 40곳 1MB).
 *
 * @param {{items?: object[]}} reg  data/registered.json
 * @returns {{over: boolean, wasted: number, nation: number, schools: number, line: string|null}}
 */
function registeredSplitAdvice(reg) {
  const perSchool = {};        // 학교 → 그 학교 학생이 받아야 하는 바이트
  let nation = 0;              // 모두가 받아야 하는 바이트
  let scopedTotal = 0;         // 학교 한정 바이트 (겹쳐도 한 번만)
  for (const it of (reg && reg.items) || []) {
    const bytes = Buffer.byteLength(JSON.stringify(it));
    const schools = schoolsOfNotice(it && it.eligibility);
    if (!schools.size) { nation += bytes; continue; }
    scopedTotal += bytes;
    for (const s of schools) perSchool[s] = (perSchool[s] || 0) + bytes;
  }
  /* 한 학생이 **쓰지 못하는** 양 — 가장 많이 받는 학교 학생 기준(가장 유리한 쪽으로 잡는다) */
  const biggest = Object.values(perSchool).reduce((a, b) => Math.max(a, b), 0);
  const wasted = scopedTotal - biggest;
  const schools = Object.keys(perSchool).length;
  const kb = (n) => `${Math.round(n / 1024)}KB`;
  const over = wasted > SPLIT_WARN_BYTES;
  return {
    over,
    wasted,
    nation,
    schools,
    line: over
      ? `정식 등록을 **학교별 파일로 나눌 때입니다.** 지금 한 학생이 남의 학교 공고로만 `
        + `${kb(wasted)} 를 받습니다(학교 ${schools}곳 · 전국분 ${kb(nation)} 은 모두가 받아야 합니다). `
        + `실시간 공고·학과 목록과 같은 방식입니다 — 전국분 파일 하나 + 학교별 파일. `
        + `이름 규칙은 match-engine.js 에, 발행은 collector/publish-notices.mjs 를 본뜨면 됩니다 `
        + `(왜 2026-09-26에는 미뤘는지: SESSIONS.md 「첫 화면에서 받는 양 절반으로」)`
      : null,
  };
}

module.exports = { registeredSplitAdvice, schoolsOfNotice, SPLIT_WARN_BYTES };
