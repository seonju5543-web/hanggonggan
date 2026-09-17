/* 적합도(퍼센트)와 화면의 ✓/✕가 같은 말을 하는가 — **규칙은 여기 하나뿐이다** (2026-08-29)
 *
 * 🔴 왜 파일로 뺐나: 이 규칙이 `verify/test-collector.mjs`(관문)와
 *    `verify/eligibility-report.mjs`(채점기) 두 곳에 **베껴져** 있었고, 실제로 갈라졌다.
 *    관문 쪽은 2026-08-26 상수 변경(미달 0 → FIT_MIN)을 따라갔는데 채점기 쪽은 못 따라가
 *    경고 227건을 냈다. 이 저장소가 반복해 배운 것: **베끼면 갈라진다.**
 *
 * 🔴 왜 `=== 'no'` 이고 `!== 'ok'` 가 아닌가 (2026-08-29 실측):
 *    선택지 묶음("아래 둘 중 하나")에서 못 고른 쪽은 `requirementMatch` 가 **일부러
 *    `null`** 을 준다(match-engine: "떨어져도 ✕는 안 친다"). `!== 'ok'` 로 보면
 *    그 정상 동작이 모순으로 잡힌다 — 실제로 재현했다(met 1/1 · pct 95 · null 1줄).
 *    `null` 은 "판단 안 함"이지 모순이 아니다.
 *
 * 🔴 숫자를 보지 않는다: 판정 근거는 `fails` 다. 퍼센트는 화면에 보이려고 있는 값이라
 *    상한·하한 상수가 바뀌면 뜻이 달라진다(그게 8/26에 벌어진 일이다).
 */
function fitInconsistency(M, it, p) {
  const fd = M.fitDetail(it, p);
  if (fd.unread) return null;
  const marks = (M.requirementLines(it, it.eligibilityLines) || [])
    .map((l) => M.requirementMatch(l, p, it));
  /* ✕는 미달 사유가 있을 때만 나와야 한다. 사유가 없는데 ✕가 보이면
     화면과 판정이 다른 말을 하는 것이다.
     ('요건을 다 충족했는데 ✕' 는 이 조건에 포함된다 — met === total 이면 fails 가 비어 있다.
      등록 전수 × 프로필 7종으로 확인: 따로 두면 한 번도 혼자 발화하지 않는 죽은 가지다.) */
  if (!fd.fails.length && marks.some((v) => v === 'no'))
    return { why: '미달 사유가 없는데 ✕인 자격 줄이 있다', line: `${fd.met}/${fd.total}` };
  return null;
}
module.exports = { fitInconsistency };
