/* 온보딩을 건너뛰고 홈부터 보기 — **즉석 화면 확인용** (2026-08-29 개발자 요청)
 *
 * 왜 필요했나: 개발자가 화면을 지적하면 그 자리에서 눌러 봐야 하는데, 앱은 온보딩을
 * 끝내야 홈이 나온다. 그래서 브라우저를 열 때마다 학교·계열·성적을 손으로 채우고 있었다.
 * (`?e2e=1` 은 **아무 일도 안 한다** — app.js 에 그런 분기가 없다. 드라이버들은 실제로
 *  온보딩을 클릭해 넘긴다: `verify/onboard-helper.js` 의 nextUntil.)
 *
 * 🔴 **앱 코드에 뒷문을 넣지 않는다.** 주소에 `?demo=1` 같은 걸 만들면 그건 배포되는
 *    앱에 남는 뒷문이다. 대신 브라우저에서 저장소만 채운다 — 앱은 한 글자도 안 바뀐다.
 *
 * 쓰는 법 (둘 중 아무거나):
 *   · 브라우저 콘솔에 이 파일 내용을 붙여넣는다 → 프로필이 깔리고 새로고침된다
 *   · Node 에서: `require('./verify/demo-profile.js').DEMO_STATE`
 *
 * ⚠️ 이건 **검사 도구가 아니다.** 회귀 검사는 `verify/` 의 드라이버들이고, 그것들은
 *    온보딩을 실제로 눌러 통과한다(사용자가 겪는 길을 그대로 밟아야 하므로).
 *    이 파일은 "지금 이 화면 좀 보자"에만 쓴다.
 */
const DEMO_PROFILE = {
  school: '한국외국어대학교', campus: '', track: 'humanities', major: '영어학과',
  year: 3, status: '재학', gpa: 3.2, bracket: 6, credits: 14,
  region: '서울', parentRegion: '서울', nationality: 'korean', birthYear: 2004,
  flags: [], common: {},
};
/* what-shows.mjs 의 기준 학생과 **같은 값**이다 — 다르면 "도구로 잰 것"과
   "화면에서 본 것"이 어긋나서, 그걸 맞춰 보느라 또 시간을 쓴다. */
const DEMO_STATE = {
  profile: DEMO_PROFILE,
  applications: [],
  consent: { sensitive: false },
  updatedAt: new Date().toISOString(),
};

if (typeof window !== 'undefined' && window.localStorage) {
  localStorage.setItem('handaejang.v1', JSON.stringify(DEMO_STATE));   // app.js STORAGE_KEY
  location.reload();
} else if (typeof module !== 'undefined') {
  module.exports = { DEMO_PROFILE, DEMO_STATE };
}
