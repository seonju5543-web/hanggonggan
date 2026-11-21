/* ============================================================
   학교 바로가기 주소 표 — 홈 그림 칸 「학교 홈」「종정시」「e-class」「도서관」 (2026-11-21 개발자 지시)
   ------------------------------------------------------------
   🔴 **확인한 주소만** 적는다 — 그 주소를 열어 그 학교 사이트(제목·내용에 학교·시스템 이름)인 것을 본 것.
      짐작한 주소는 적지 않는다(CLAUDE.md 「포털 신청」 '주소를 짐작해 채우지 말 것'). 없는 칸은 화면에 칸째 안 뜬다.
   🔴 열쇠는 UNIVERSITIES·SERVED_SCHOOLS 의 학교 이름 그대로(분교는 별개 학교 — '연세대학교 미래캠퍼스').
   🔴 우리는 주소만 넘긴다 — 로그인은 학생이 그 사이트에서 직접 한다(운영 원칙 9 · 아이디·비밀번호를 받지 않는다).
   확인한 방법은 학교·칸마다 docs/designs/school-links-evidence.json 에 적었다(2026-11-21 조사 · 못 확인한 5칸은 비웠다 — 성균관대 종정시·도서관, 홍익대·계명대 e-class, 방송대 종정시).
   칸: home(학교 홈페이지) · portal(종합정보시스템·학사 포털) · eclass(LMS) · library(중앙도서관)
   ============================================================ */
const SCHOOL_LINKS = {
  "경희대학교": {"home":"https://www.khu.ac.kr","portal":"https://info21.khu.ac.kr","eclass":"https://e-campus.khu.ac.kr","library":"https://lib.khu.ac.kr"},
  "한국외국어대학교": {"home":"https://www.hufs.ac.kr","portal":"https://wis.hufs.ac.kr/src08/jsp/index.jsp","eclass":"https://eclass.hufs.ac.kr","library":"https://lib.hufs.ac.kr"},
  "서울대학교": {"home":"https://www.snu.ac.kr","portal":"https://my.snu.ac.kr","eclass":"https://myetl.snu.ac.kr","library":"https://lib.snu.ac.kr"},
  "연세대학교": {"home":"https://www.yonsei.ac.kr","portal":"https://portal.yonsei.ac.kr","eclass":"https://ys.learnus.org","library":"https://library.yonsei.ac.kr"},
  "연세대학교 미래캠퍼스": {"home":"https://mirae.yonsei.ac.kr","portal":"https://portal.yonsei.ac.kr","eclass":"https://ys.learnus.org","library":"https://wlib.yonsei.ac.kr"},
  "고려대학교": {"home":"https://www.korea.ac.kr","portal":"https://portal.korea.ac.kr","eclass":"https://lms.korea.ac.kr","library":"https://library.korea.ac.kr"},
  "고려대학교 세종캠퍼스": {"home":"https://sejong.korea.ac.kr","portal":"https://portal.korea.ac.kr","eclass":"https://lms.korea.ac.kr","library":"https://libs.korea.ac.kr"},
  "서강대학교": {"home":"https://www.sogang.ac.kr","portal":"https://saint.sogang.ac.kr/irj/portal","eclass":"https://eclass.sogang.ac.kr","library":"https://library.sogang.ac.kr"},
  "성균관대학교": {"home":"https://www.skku.edu","eclass":"https://canvas.skku.edu"},
  "한양대학교": {"home":"https://www.hanyang.ac.kr","portal":"https://portal.hanyang.ac.kr","eclass":"https://learning.hanyang.ac.kr","library":"https://library.hanyang.ac.kr"},
  "중앙대학교": {"home":"https://www.cau.ac.kr","portal":"https://mportal.cau.ac.kr","eclass":"https://eclass3.cau.ac.kr","library":"https://library.cau.ac.kr"},
  "서울시립대학교": {"home":"https://www.uos.ac.kr","portal":"https://portal.uos.ac.kr","eclass":"https://uclass.uos.ac.kr","library":"https://library.uos.ac.kr"},
  "건국대학교": {"home":"https://www.konkuk.ac.kr","portal":"https://kuis.konkuk.ac.kr","eclass":"https://ecampus.konkuk.ac.kr","library":"https://library.konkuk.ac.kr"},
  "동국대학교": {"home":"https://www.dongguk.edu","portal":"https://nportal.dongguk.edu","eclass":"https://eclass.dongguk.edu","library":"https://lib.dongguk.edu"},
  "동국대학교 WISE캠퍼스": {"home":"https://web.dongguk.ac.kr","portal":"https://nportal.dongguk.ac.kr","eclass":"https://eclass.dongguk.ac.kr","library":"https://libk.dongguk.ac.kr"},
  "홍익대학교": {"home":"https://www.hongik.ac.kr","portal":"https://cn.hongik.ac.kr","library":"https://honors.hongik.ac.kr"},
  "숙명여자대학교": {"home":"https://www.sookmyung.ac.kr","portal":"https://portal.sookmyung.ac.kr","eclass":"https://snowboard.sookmyung.ac.kr","library":"https://lib.sookmyung.ac.kr"},
  "광운대학교": {"home":"https://www.kw.ac.kr","portal":"https://klas.kw.ac.kr","eclass":"https://klas.kw.ac.kr","library":"https://kupis.kw.ac.kr"},
  "명지대학교": {"home":"https://www.mju.ac.kr","portal":"https://msi.mju.ac.kr","eclass":"https://lms.mju.ac.kr","library":"https://lib.mju.ac.kr"},
  "상명대학교": {"home":"https://www.smu.ac.kr","portal":"https://smul.smu.ac.kr","eclass":"https://ecampus.smu.ac.kr","library":"https://lib.smu.ac.kr"},
  "가천대학교": {"home":"https://www.gachon.ac.kr","portal":"https://portal.gachon.ac.kr","eclass":"https://cyber.gachon.ac.kr","library":"https://lib.gachon.ac.kr"},
  "아주대학교": {"home":"https://www.ajou.ac.kr","portal":"https://portal.ajou.ac.kr","eclass":"https://eclass2.ajou.ac.kr","library":"https://library.ajou.ac.kr"},
  "국민대학교": {"home":"https://www.kookmin.ac.kr","portal":"https://portal.kookmin.ac.kr","eclass":"https://ecampus.kookmin.ac.kr","library":"https://lib.kookmin.ac.kr"},
  "숭실대학교": {"home":"https://ssu.ac.kr","portal":"https://saint.ssu.ac.kr/irj/portal","eclass":"https://lms.ssu.ac.kr","library":"https://oasis.ssu.ac.kr"},
  "세종대학교": {"home":"https://www.sejong.ac.kr","portal":"https://portal.sejong.ac.kr","eclass":"https://ecampus.sejong.ac.kr","library":"https://library.sejong.ac.kr"},
  "이화여자대학교": {"home":"https://www.ewha.ac.kr","portal":"https://portal.ewha.ac.kr","eclass":"https://cyber.ewha.ac.kr","library":"https://lib.ewha.ac.kr"},
  "인하대학교": {"home":"https://www.inha.ac.kr","portal":"https://portal.inha.ac.kr","eclass":"https://learn.inha.ac.kr","library":"https://lib.inha.ac.kr"},
  "부산대학교": {"home":"https://www.pusan.ac.kr","portal":"https://onestop.pusan.ac.kr","eclass":"https://plato.pusan.ac.kr","library":"https://lib.pusan.ac.kr"},
  "가톨릭대학교": {"home":"https://www.catholic.ac.kr","portal":"https://uportal.catholic.ac.kr","eclass":"https://e-cyber.catholic.ac.kr","library":"https://library.catholic.ac.kr"},
  "한국항공대학교": {"home":"https://www.kau.ac.kr","portal":"https://nportal.kau.ac.kr","eclass":"https://lms.kau.ac.kr","library":"https://lib.kau.ac.kr"},
  "경기대학교": {"home":"https://www.kyonggi.ac.kr","portal":"https://kutis.kyonggi.ac.kr/webkutis/view/indexWeb.jsp","eclass":"https://lms.kyonggi.ac.kr","library":"https://library.kyonggi.ac.kr"},
  "서울과학기술대학교": {"home":"https://www.seoultech.ac.kr","portal":"https://for-a.seoultech.ac.kr/index-s.html","eclass":"https://eclass.seoultech.ac.kr","library":"https://library.seoultech.ac.kr"},
  "계명대학교": {"home":"https://www.kmu.ac.kr","portal":"https://portal.kmu.ac.kr","library":"https://library.kmu.ac.kr"},
  "서울교육대학교": {"home":"https://www.snue.ac.kr","portal":"https://portal.snue.ac.kr/portal/lo/login/loginPage.do","eclass":"https://lms.snue.ac.kr","library":"https://lib.snue.ac.kr"},
  "한국방송통신대학교": {"home":"https://www.knou.ac.kr","eclass":"https://ucampus.knou.ac.kr","library":"https://library.knou.ac.kr"},
  "경북대학교": {"home":"https://www.knu.ac.kr","portal":"https://knuin.knu.ac.kr","eclass":"https://lms1.knu.ac.kr","library":"https://kudos.knu.ac.kr"},
  "영남대학교": {"home":"https://www.yu.ac.kr","portal":"https://portal.yu.ac.kr","eclass":"https://nice.yu.ac.kr/sso/ssocheck.php?ru=learningx","library":"https://libs.yu.ac.kr"},
  "전북대학교": {"home":"https://www.jbnu.ac.kr","portal":"https://oasis.jbnu.ac.kr","eclass":"https://lms.jbnu.ac.kr","library":"https://dl.jbnu.ac.kr"},
  "충남대학교": {"home":"https://plus.cnu.ac.kr","portal":"https://portal.cnu.ac.kr","eclass":"https://e-learn.cnu.ac.kr","library":"https://library.cnu.ac.kr"},
  "전남대학교": {"home":"https://www.jnu.ac.kr","portal":"https://portal.jnu.ac.kr","eclass":"https://sel.jnu.ac.kr","library":"https://lib.jnu.ac.kr"},
  "조선대학교": {"home":"https://www.chosun.ac.kr","portal":"https://p.chosun.ac.kr","eclass":"https://clc.chosun.ac.kr","library":"https://library.chosun.ac.kr"},
  "충북대학교": {"home":"https://www.chungbuk.ac.kr","portal":"https://eis.cbnu.ac.kr","eclass":"https://lms.chungbuk.ac.kr","library":"https://cbnul.chungbuk.ac.kr"},
  "부경대학교": {"home":"https://www.pknu.ac.kr","portal":"https://portal.pknu.ac.kr","eclass":"https://lms.pknu.ac.kr","library":"https://libweb.pknu.ac.kr"},
  "강원대학교": {"home":"https://www.kangwon.ac.kr","portal":"https://kcloud.kangwon.ac.kr","eclass":"https://eruri.kangwon.ac.kr","library":"https://library.kangwon.ac.kr"},
  "성신여자대학교": {"home":"https://www.sungshin.ac.kr","portal":"https://portal.sungshin.ac.kr","eclass":"https://slms.sungshin.ac.kr","library":"https://lib.sungshin.ac.kr"},
};
const SCHOOL_LINK_KINDS = ['home', 'portal', 'eclass', 'library'];

/* 프로필 → 그 학교의 그 칸 주소(없으면 '') · https/http 주소만 */
function schoolLinkFor(profile, kind) {
  const row = profile && profile.school && SCHOOL_LINKS[profile.school];
  const url = row && SCHOOL_LINK_KINDS.indexOf(kind) >= 0 ? row[kind] : '';
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : '';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCHOOL_LINKS, SCHOOL_LINK_KINDS, schoolLinkFor };
}
