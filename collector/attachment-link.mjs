/* 첨부파일 링크 판별 (2026-07-31 신설)
 *
 * 왜 필요한가: 일부 게시판(상명대 notice.do 유형)은 목록에서 **공고 링크가 아니라 첨부파일
 * 내려받기 링크**를 함께 내준다. 그대로 담으면 앱 실시간 공고에
 *   "코나아이_소상공인_장학생_모집_포스터.png"
 *   "5. (홈페이지 게시용) 2026-2 면학장학금 신청 안내문.hwp"
 * 같은 **파일 이름이 공고 제목처럼** 뜬다(실제로 15건 그 상태였다). 학생이 눌러도 공고가
 * 아니라 파일이 내려받아진다.
 *
 * 같은 이유로 양식 원본을 받을 때도 쓴다 — 게시판 하단 메뉴(부서 링크 등)를 첨부로 착각해
 * 받아 두면 스키마화가 매번 그걸 붙들고 실패한다(연구지원팀·연구진흥팀 사례).
 */

/* 내려받기 주소인가 (주소만 보고 판단) */
export function isDownloadUrl(url = '') {
  return /mode=download|fileDown|file_?down|download\.do|attachNo=|attachmentNo=|fileNo=|\/download(\/|\?|$)/i.test(url)
      || /\.(hwp|hwpx|docx?|pdf|xlsx?|pptx?|zip|png|jpe?g|gif|bmp|webp)(\?|$)/i.test(url);
}

/* 제목이 파일 이름인가 (확장자로 끝나면 공고 제목이 아니라 첨부 파일명) */
export function looksLikeFileName(title = '') {
  return /\.(hwp|hwpx|docx?|pdf|xlsx?|pptx?|zip|png|jpe?g|gif|bmp|webp)\s*$/i.test(String(title).trim());
}

/* 제목이 분류 꼬리표뿐인가 — 예: "서울 [등록/장학]" (게시판 말머리만 걸린 부스러기).
   학생이 봐도 무슨 공고인지 알 수 없으므로 피드에 넣지 않는다. */
export function isEmptyTitle(title = '') {
  const body = String(title)
    .replace(/\[[^\]]*\]/g, ' ')                               // [등록/장학] 같은 말머리 제거
    .replace(/^(서울|천안|글로벌|공통|일반|홍보|교외|교내)\s*/g, ' ') // 캠퍼스·분류 접두어 제거
    .replace(/\s+/g, ' ').trim();
  return body.length < 6;
}

/* 공고 목록에 넣으면 안 되는 항목인가 */
export function isAttachmentEntry(item = {}) {
  const title = item.title || item.name || '';
  return isDownloadUrl(item.url || '') || looksLikeFileName(title) || isEmptyTitle(title);
}

/* 내려받은 파일이 사실은 웹페이지인가 (메뉴 링크를 첨부로 착각해 받은 경우)
   — HWP·PDF·DOCX는 모두 고유한 서명으로 시작하므로, HTML이면 양식이 아니다. */
export function isHtmlPayload(buf) {
  const head = Buffer.from(buf.subarray(0, 600)).toString('utf8').trim().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<meta charset')
      || /<head[\s>]/.test(head);
}
