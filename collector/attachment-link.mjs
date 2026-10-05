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

/* ── 게시판 내려받기 스크립트 → 진짜 내려받기 주소 (2026-10-05) ─────────────────────────
   어떤 게시판은 첨부를 `javascript:downloadfile('…','…','…')` 처럼 **스크립트로** 내려준다. 그대로 담으면 앱은
   주소가 아니라서 이름만 보이고(app.js attachmentLinkHtml) 학생은 신청서 양식을 못 받는다 — 실측 34건(서울과기대 22 ·
   대전청년포털 7 · K-Startup 5 · 동국대는 다시 읽을 때 드러남). 함수의 정의를 원문 페이지에서 읽고, **세션 없는 새 브라우저에서 그 주소로 파일이
   받아지는 것**까지 확인한 사이트만 여기 적는다. 함수 이름이 같아도 사이트가 다르면 모른다(호스트로 묶는다).
   잘리거나 인자가 모자란 호출은 짐작하지 않는다(null — 앱은 이름만 보인다). */
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const JS_DOWNLOAD_RULES = [
  { host: /(^|\.)seoultech\.ac\.kr$/i,
    /* 정의(공고 상세 HTML): function downloadfile(filePath, fileName, ogrfname) → POST /hcm/bbs/bbs_download.jsp {fpath,fname,ogrfname} — GET 으로도 받아진다 */
    /* 원래 이름(셋째 인자)에 따옴표가 이스케이프 없이 그대로 온다(「웰로 'Wello' 앱」) — 셋째는 마지막 `' )` 까지 읽는다 */
    call: /^javascript:\s*downloadfile\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'(.*)'\s*\)\s*;?\s*$/i,
    path: (m) => `/hcm/bbs/bbs_download.jsp?${new URLSearchParams({ fpath: m[1], fname: m[2], ogrfname: safeDecode(m[3]) })}` },
  { host: /(^|\.)daejeonyouthportal\.kr$/i,
    /* 정의(/js/dyp/comt/commonFn.js): fileDownLoad(atchFileId, fileSn) → window.open(contextPath + "/comt/fms/FileDown.do?atchFileId=…&fileSn=…") · contextPath = "" */
    call: /^javascript:\s*(?:dypCommonFn\.fileManage\.)?fileDownLoad\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/i,
    path: (m) => `/comt/fms/FileDown.do?${new URLSearchParams({ atchFileId: m[1], fileSn: m[2] })}` },
  { host: /(^|\.)dongguk\.edu$/i,
    /* 정의(공고 상세 HTML): function downGO(file_nm, file_path, file_sys_nm){ location.href="/cmmn/fileDown.do?filename="+encodeURIComponent(file_nm)+"&filepath="+file_path+"&filerealname="+file_sys_nm }
       이름 안의 따옴표는 `\'` 로 적혀 온다(「웰로 \'Wello\' 앱」) — 그래서 인자를 `\'` 를 건너 읽고 되돌린다 */
    call: /^javascript:\s*downGO\(\s*'((?:\\'|[^'])*)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/i,
    path: (m) => `/cmmn/fileDown.do?filename=${encodeURIComponent(m[1].replace(/\\'/g, "'"))}&filepath=${m[2]}&filerealname=${m[3]}` },
];

/** `javascript:` 내려받기 호출을 진짜 주소로. 모르는 사이트·모양이면 null */
export function resolveJsDownload(href, pageUrl) {
  let host;
  try { host = new URL(pageUrl).host; } catch { return null; }
  for (const r of JS_DOWNLOAD_RULES) {
    if (!r.host.test(host)) continue;
    const m = String(href || '').trim().match(r.call);
    if (m) return new URL(r.path(m), pageUrl).href;
  }
  return null;
}

/* 첨부로 볼 링크인가 — 확장자·내려받기 꼴 주소이거나 이름이 파일 이름일 때 */
const ATTACH_EXT = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i;
/* 안내창·빈 스크립트는 첨부가 아니다(K-Startup: `javascript:alert('현재 작업중입니다.')` — 주석 속 옛 틀에 있었다) */
const JS_NOT_DOWNLOAD = /^javascript:\s*(?:alert|void|;|$)/i;
/* 화면 틀 글자가 그대로 남은 이름(국민대 `' + fileItem.fileNm + '`) — 스크립트가 채울 자리였다 */
const TEMPLATE_NAME = /'\s*\+|\+\s*'|fileItem\.|\$\{/;

/** 공고 상세 HTML 에서 첨부 {name, url} — 일반 수집기(collect.mjs fetchDetail)가 쓴다.
    🔴 ① `href="…"` 와 `href='…'` 를 따옴표 짝으로 읽는다 — `[^"']*` 로 읽으면 `javascript:downloadfile(` 에서 끊겼다(22건)
    ② HTML 주석을 먼저 걷는다 — 화면에 없는 옛 첨부가 주워졌다 ③ 스크립트 호출은 resolveJsDownload 로 진짜 주소로 */
export function detailAttachments(html, pageUrl, { decode = (s) => s, max = 8 } = {}) {
  const src = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  const out = new Map();
  const re = /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(src)) !== null && out.size < max) {
    const raw = decode((m[1] ?? m[2] ?? '').trim());
    if (!raw || raw.startsWith('#') || JS_NOT_DOWNLOAD.test(raw)) continue;
    const name = m[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    let url = /^javascript:/i.test(raw) ? resolveJsDownload(raw, pageUrl) || raw : null;
    if (!url) { try { url = new URL(raw, pageUrl).href; } catch { continue; } }
    const isFile = ATTACH_EXT.test(url) || ATTACH_EXT.test(name) || /mode=download|download\.do|fileDown|attach|bbs_download/i.test(url);
    if (isFile && name.length >= 4 && name.length <= 120 && !TEMPLATE_NAME.test(name) && !out.has(url)) out.set(url, { name: name.slice(0, 100), url });
  }
  return [...out.values()];
}

/** 브라우저가 읽은 링크 [{title, url}] → 첨부 {name, url} — 브라우저 수집기의 두 길(상세 방문 · 클릭 수집)이 같이 쓴다.
    화면에 그려진 링크라 주석 문제는 없다. 스크립트 호출만 진짜 주소로 바꾼다(resolveJsDownload). */
export function linkAttachments(links, pageUrl, max = 6) {
  return (links || [])
    .map((l) => (/^javascript:/i.test(l.url || '') ? { ...l, url: resolveJsDownload(l.url, pageUrl) || l.url } : l))
    .filter((l) => !JS_NOT_DOWNLOAD.test(l.url || ''))
    .filter((l) => ATTACH_EXT.test(l.url) || /download|fileDown/i.test(l.url))
    .filter((l) => l.title && l.title.length >= 4 && l.title.length <= 120 && !TEMPLATE_NAME.test(l.title))
    .slice(0, max).map((l) => ({ name: l.title.slice(0, 100), url: l.url }));
}

/* ── 게시판 공통 링크 걷기 (2026-10-05) ───────────────────────────────────────────────
   상세 페이지의 링크를 첨부로 모으면 **모든 글에 똑같이 붙는** 게시판 머리·옆 메뉴 링크가 섞인다 — 실측 17개 주소:
   서울과기대 「장학금 규정 전문·지침 전문·신청 주요 일정」(게시판 머리 div.link_btn) · 계명대 「캠퍼스 투어」「AI 활용 가이드라인」 ·
   광운대 부서 안내(attach01~05.jsp) · 성균관대 「부속기관」 · 국민대 화면 틀 글자 · 학교 로고·웹 접근성 마크.
   진짜 첨부는 글마다 번호가 달라 주소가 겹치지 않는다. 그래서 **같은 주소가 서로 다른 공고 페이지 3곳 이상**에 붙으면 공통 링크로 본다
   (두 곳까지는 같은 사업을 두 글로 올린 것일 수 있어 남긴다). 같은 글이 장부·정식 등록 두 파일에 있으면 한 번으로 센다(페이지 주소로 센다).
   데이터 전체를 놓고 세므로 로봇이 저장할 때마다 부르면 지난 것도 저절로 걷힌다. */
const pageOf = (it) => String((it && (it.sourceUrl || it.url)) || '').split('#')[0];
export const CHROME_MIN_PAGES = 3;
/** lists: 공고 배열 여럿([notices.items, registered.items, …]). 공통 링크를 **그 자리에서** 걷고 걷어 낸 개수를 돌려준다 */
export function stripSiteChrome(lists, min = CHROME_MIN_PAGES) {
  const pages = new Map();
  for (const arr of lists) for (const it of arr || []) for (const a of it.attachments || []) {
    if (!a || !a.url) continue;
    (pages.get(a.url) || pages.set(a.url, new Set()).get(a.url)).add(pageOf(it));
  }
  const chrome = new Set([...pages].filter(([, s]) => s.size >= min).map(([u]) => u));
  let removed = 0;
  for (const arr of lists) for (const it of arr || []) {
    if (!Array.isArray(it.attachments) || !it.attachments.length) continue;
    const kept = it.attachments.filter((a) => !(a && chrome.has(a.url)));
    removed += it.attachments.length - kept.length;
    if (kept.length !== it.attachments.length) it.attachments = kept;
  }
  return removed;
}
