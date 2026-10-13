/* 자동 등록이 피드 글의 첨부 중 무엇을 등록분에 남기는가 — 한 곳 (2026-10-13)

   🔴 왜 바꿨나 — 실측(2026-10-13 · 마감 전 정식 등록 109건): 첨부가 하나도 없는 등록분이 38건이었다.
      예전 규칙은 **이름 허용 목록**(신청서·지원서·양식·서식·동의서·서약서·추천서·공고)이라, 「붙임1」「선발요강」
      「안내문」「포스터」 같은 이름의 문서는 등록 순간 버려졌다(표본 6건 중 2건은 피드엔 첨부가 있는데 등록분엔 없었다).
      그 파일 안에 신청서 서식이 들어 있어도(공고문 뒷장 「별지」) 아무도 모른다.
   이제는 **차단 목록**이다 — 문서 확장자면 남기고, 사이트 공통 링크(부속기관·사이트맵·개인정보처리방침)만 뺀다.
   🔴 자동 등록(auto-register.mjs)이 부르고 관문(test-collector 「등록 첨부 고르기」)이 같은 함수를 잰다 — 베끼지 말 것. */

export const REGISTER_ATT_MAX = 6;
/* 문서 확장자 — 이름 또는 주소 끝에 붙는다(주소가 download.do 꼴이면 이름이 말한다) */
const DOC_EXT = /\.(hwp|hwpx|doc|docx|pdf|zip|xls|xlsx|ppt|pptx)(\?|$)/i;
/* 게시판 하단 메뉴가 첨부로 섞여 들어오는 것들 — 이름으로 거른다(연구지원팀·부속기관 링크 사례) */
const SITE_CHROME = /부속기관|부설|사이트맵|개인정보\s*처리\s*방침|이메일\s*무단\s*수집|홈페이지\s*바로가기/;

/** 피드 글의 첨부 목록 → 등록분에 남길 첨부 (순서 유지 · 중복 주소 제거 · 상한) */
export function pickRegisterAttachments(atts, { max = REGISTER_ATT_MAX } = {}) {
  const out = [];
  const seen = new Set();
  for (const a of atts || []) {
    if (!a || typeof a !== 'object') continue;
    const name = String(a.name || '');
    const url = String(a.url || '');
    if (!name && !url) continue;
    if (SITE_CHROME.test(name)) continue;
    /* 본문 사진(bodyImage)은 공고 원문 그 자체라 남긴다 — 그 밖은 문서 파일만 */
    if (!a.bodyImage && !DOC_EXT.test(name) && !DOC_EXT.test(url)) continue;
    const key = url || name;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}
