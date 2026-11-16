/* 학생 화면 글자 훑기의 예외 — **학생 화면이 아닌 글자**만, 한 줄마다 까닭을 적는다 (2026-11-15).
   has 는 그 문자열 안의 글자 일부 · 까닭 없는 예외를 더하지 말 것(관문이 why 를 본다). */
const NO_UNKNOWN_ALLOW = [
  { file: 'apply-channel.js', has: '첨부 양식만 있음(제출처 미확인)', why: 'classifyChannels 의 갈래 이름 — data.js hasPortalEvidence 는 「학교 시스템 입력형」만 묻고, 나머지는 로봇 리포트(collector/scan-two-schools·classify-two-schools)에만 나간다 · 학생 화면에 안 나온다' },
  { file: 'apply-channel.js', has: '미확인', exact: true, why: 'classifyChannels 의 「근거 없음」 갈래 이름 — 위와 같이 로봇 리포트용 · 화면은 이 값을 그리지 않는다' },
];
module.exports = { NO_UNKNOWN_ALLOW };
