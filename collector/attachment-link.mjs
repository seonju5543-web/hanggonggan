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
  { host: /(^|\.)msit\.go\.kr$/i,
    /* 정의(공고 상세 HTML): fn_download(atchFileNo, fileOrd, ext) → 폼을 /ssm/file/fileDown.do 로 보낸다(atchFileNo·fileOrd) — GET 으로도 같은 파일이 온다(2026-10-16 실측 11MB hwpx).
       호출은 href 가 아니라 onclick 에 있다 — detailAttachments 가 onclick 을 href 자리로 넘긴다 */
    call: /^javascript:\s*fn_download\(\s*'(\d+)'\s*,\s*'(\d+)'/i,
    path: (m) => `/ssm/file/fileDown.do?${new URLSearchParams({ atchFileNo: m[1], fileOrd: m[2] })}` },
  /* 경주 WISE 캠퍼스(wise.dongguk.ac.kr)도 같은 함수다 (2026-11-02 · 정식 등록의 javascript: 첨부 6개가 전부 여기였는데 호스트가 dongguk.edu 만이라 null).
     상세 HTML(servicenotice/detail/520872)의 정의를 열어 보니 한 글자도 같았고, 쿠키 없는 새 요청으로 /cmmn/fileDown.do 에서 HWP 원본(34KB)이 받아졌다 */
  { host: /(^|\.)dongguk\.edu$|^wise\.dongguk\.ac\.kr$/i,
    /* 정의(공고 상세 HTML): function downGO(file_nm, file_path, file_sys_nm){ location.href="/cmmn/fileDown.do?filename="+encodeURIComponent(file_nm)+"&filepath="+file_path+"&filerealname="+file_sys_nm }
       이름 안의 따옴표는 `\'` 로 적혀 온다(「웰로 \'Wello\' 앱」) — 그래서 인자를 `\'` 를 건너 읽고 되돌린다 */
    call: /^javascript:\s*downGO\(\s*'((?:\\'|[^'])*)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/i,
    path: (m) => `/cmmn/fileDown.do?filename=${encodeURIComponent(m[1].replace(/\\'/g, "'"))}&filepath=${m[2]}&filerealname=${m[3]}` },
  /* 서울시립대 장학 게시판 (2026-11-21 · 언론인회 장학금의 신청서·자기소개서를 누르면 파일 대신 공고 화면이 열렸다 — 화면 주소가 첨부 주소로 적혀 있었다).
     정의(/js/headquarter/scholarship/scholarship.js): function filedown(brdDate, brdSeq, filSeq) { $("#brdDate").val(brdDate); $("#brdSeq").val(brdSeq); $("#filSeq").val(filSeq);
       $("#sendForm").attr("action", "/scholarship/download.do").submit(); } — sendForm 은 GET 이고 게시판 번호(brdBbsseq)를 숨은 칸으로 들고 있다(공고 주소의 brdBbsseq 와 같은 값).
     실측(쿠키 없는 새 요청): …/download.do?brdBbsseq=1&brdDate=20261105&brdSeq=1&filSeq=1 → HWP 12.8KB · filSeq=2 → HWP 17.4KB — 내려온 이름(Content-Disposition)이 화면의 첨부 이름과 맞았다.
     호출은 `href="#"` 의 onclick 에 있다(detailAttachments ⑤). 🔴 게시판 번호를 공고 주소에서 못 읽으면 풀지 않는다(짐작하지 않는다 — path 가 null) */
  { host: /^scholarship\.uos\.ac\.kr$/i,
    call: /^javascript:\s*filedown\(\s*'(\d{8})'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*\)/i,
    path: (m, pageUrl) => {
      const board = new URL(pageUrl).searchParams.get('brdBbsseq');
      return /^\d+$/.test(board || '') ? `/scholarship/download.do?${new URLSearchParams({ brdBbsseq: board, brdDate: m[1], brdSeq: m[2], filSeq: m[3] })}` : null;
    } },
];

/* 호출 안에 **파일의 절대 주소가 통째로 적힌** 꼴 (2026-11-20 · 공고문 PDF 로봇 첫 실행의 '주소 없음' 3개가 전부 이 꼴이었다):
   한국대학사회봉사협의회 `javascript:file_down_each('https://kr.object.ncloudstorage.com/…/x.hwp', '이름.hwp')` — 정의(공고 상세 HTML)는
   그 주소를 /file_down_each.php 에 넘겨 같은 파일을 내려 준다. 쿠키 없는 새 요청으로 그 주소에서 HWP 원본 3개(424~793KB)가 그대로 받아졌다.
   위 규칙들과 달리 **주소를 짓지 않는다** — 호출에 적힌 글자 그대로라 사이트를 가리지 않는다. 첫 인자가 문서 확장자로 끝나는 http(s) 주소일 때만
   (경로 조각 `/a/b.hwp` 는 여전히 모른다 — 어디에 붙일지는 사이트마다 달라 짐작이 된다). */
const JS_ABSOLUTE_FILE = /^javascript:\s*[\w$.]+\(\s*(['"])(https?:\/\/[^'"\s]+?\.(?:hwpx?|docx?|pdf|xlsx?|pptx?|zip))\1/i;

/** `javascript:` 내려받기 호출을 진짜 주소로. 모르는 사이트·모양이면 null */
export function resolveJsDownload(href, pageUrl) {
  let host;
  try { host = new URL(pageUrl).host; } catch { return null; }
  for (const r of JS_DOWNLOAD_RULES) {
    if (!r.host.test(host)) continue;
    const m = String(href || '').trim().match(r.call);
    const p = m ? r.path(m, pageUrl) : null;   // 규칙이 공고 주소에서 읽을 것이 있으면 읽는다(서울시립대 게시판 번호) · 못 읽으면 null — 풀지 않는다
    if (p) return new URL(p, pageUrl).href;
  }
  const abs = String(href || '').trim().match(JS_ABSOLUTE_FILE);
  return abs ? abs[2] : null;
}

/* 첨부로 볼 링크인가 — 확장자·내려받기 꼴 주소이거나 이름이 파일 이름일 때 */
const ATTACH_EXT = /\.(hwp|hwpx|doc|docx|pdf|xls|xlsx)(\?|$)/i;
/* 안내창·빈 스크립트는 첨부가 아니다(K-Startup: `javascript:alert('현재 작업중입니다.')` — 주석 속 옛 틀에 있었다) */
const JS_NOT_DOWNLOAD = /^javascript:\s*(?:alert|void|;|$)/i;
/* 화면 틀 글자가 그대로 남은 이름(국민대 `' + fileItem.fileNm + '`) — 스크립트가 채울 자리였다 */
const TEMPLATE_NAME = /'\s*\+|\+\s*'|fileItem\.|\$\{/;
/* 내려받기 꼴 주소. `downloadBbsFile.do`(경기대·충북대 selectBbsNttView 게시판 · 2026-11-02)는 `download\.do` 로는 안 걸려 첨부 0건이었다.
   ⚠️ 맨 `download` 로 넓히지 말 것(리뷰) — `/ko/downloads/`·`/attach/list` 같은 메뉴 링크가 첨부가 되어 상한 8을 먼저 채운다 */
const DOWNLOAD_URL = /mode=download|download\.do|downloadBbsFile\.do|fileDown|attach|bbs_download/i;
/* 링크 글자 자체가 파일 이름인가 — 문서·그림·압축 파일. 이 꼴이면 앞 줄에서 이름을 찾지 않는다(detailAttachments) */
const LINK_FILE_NAME = /\.(?:hwpx?|docx?|pdf|xlsx?|pptx?|zip|7z|alz|egg|png|jpe?g|gif|bmp|webp|tiff?|txt|hwt|odt|rtf|csv)$/i;
/* 단추 글자뿐인 링크 — 파일 이름은 바로 앞 요소에 있다(`<span>요강.hwp</span> <a href="downloadBbsFile.do…">다운로드</a>`) · 브라우저 길(rescue-bodies)도 이 낱말을 받는다 */
export const BUTTON_WORD = /^(?:다운로드|내려받기|파일\s?다운로드|download|첨부\s?파일)$/i;

/** 공고 상세 HTML 에서 첨부 {name, url} — 일반 수집기(collect.mjs fetchDetail)가 쓴다.
    🔴 ① `href="…"` 와 `href='…'` 를 따옴표 짝으로 읽는다 — `[^"']*` 로 읽으면 `javascript:downloadfile(` 에서 끊겼다(22건)
    ② HTML 주석을 먼저 걷는다 — 화면에 없는 옛 첨부가 주워졌다 ③ 스크립트 호출은 resolveJsDownload 로 진짜 주소로 */
/* 첨부 이름 끝·앞의 **아이콘 글자**를 뗀다 — 머티리얼 아이콘은 글자(ligature)로 그려져 링크 글에 `선발공고문.pdf chevron_forward` 처럼 붙어 온다
   (2026-10-17 · 강원대: 그 꼬리 때문에 확장자 검사(`\.pdf$`)가 안 맞아 PDF 공고문 3개가 첨부로 인식되지 않았고 포스터 그림만 받혔다).
   두 길(HTML 상세 · 브라우저 링크)이 같이 쓴다. */
/* 소문자만 — 아이콘 글자(ligature)는 늘 소문자고, 이름 속 `Download Guide` 같은 보통 낱말은 대문자로 시작한다 */
const ICON_WORDS = /(?:^|\s)(?:chevron_(?:forward|right|left)|file_download|download|attach_file|attachment|open_in_new|description|insert_drive_file|save_alt|arrow_(?:forward|downward|right))(?=\s|$)/g;
export const cleanAttachName = (name) => String(name || '').replace(ICON_WORDS, ' ').replace(/\s+/g, ' ').trim();

export function detailAttachments(html, pageUrl, { decode = (s) => s, max = 8 } = {}) {
  const src = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  const out = new Map();
  const re = /<a\b([^>]*?)href\s*=\s*(?:"([^"]*)"|'([^']*)')([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(src)) !== null && out.size < max) {
    let raw = decode((m[2] ?? m[3] ?? '').trim());
    /* ④ `href="javascript:void(0)" onclick="fn_download('54098','1','hwpx')"` — 호출이 onclick 에 있는 게시판(과기정통부 · 2026-10-16).
       빈 href 일 때만 onclick 을 호출로 본다 · 모르는 함수면 아래 resolveJsDownload 가 null 이라 첨부가 되지 않는다 */
    const oc = (m[1] + m[4]).match(/\bonclick\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    /* ⑤ `href="#" onclick="filedown('20261117','1','1');return false;"` — 빈 자리표 `#` 도 빈 href 와 같다(서울시립대 장학 게시판 · 2026-11-17 실측: 16건 중 16건이 첨부 0개).
       `#` 로 시작하면 무조건 건너뛰던 탓에 onclick 을 보기도 전에 버렸다. 🔴 `#`+onclick 은 탭·펼치기 단추에도 흔하다 — 아래에서 **이름이 파일 이름일 때만** 첨부로 본다 */
    const hashOnly = /^#/.test(raw);
    if ((!raw || hashOnly || JS_NOT_DOWNLOAD.test(raw)) && oc) raw = `javascript:${decode(oc[1] ?? oc[2] ?? '').trim()}`;
    if (!raw || raw.startsWith('#') || JS_NOT_DOWNLOAD.test(raw)) continue;
    let name = trimSiteTail(cleanAttachName(m[5].replace(/<[^>]+>/g, ' ')), { lonePreview: false });   // 사이트 꼬리(「(71KB)」·「(다운로드 : 12회)」)는 받을 때부터 뗀다(2026-11-25)
    let url = /^javascript:/i.test(raw) ? resolveJsDownload(raw, pageUrl) || raw : null;
    if (hashOnly && url === raw && !ATTACH_EXT.test(name)) continue;   // 모르는 동작 + 파일 이름 아님 = 화면 단추
    if (!url) { try { url = new URL(raw, pageUrl).href; } catch { continue; } }
    /* 「이름 + 미리보기」뿐인 링크는 받는 주소가 분명할 때만 꼬리를 뗀다 — 뷰어 링크(`/synap/doc.html?…`)가 파일 이름을 얻어 같은 이름의 둘째 첨부가 되지 않게(리뷰 2026-11-25) */
    if (ATTACH_EXT.test(url) || DOWNLOAD_URL.test(url)) name = trimSiteTail(name);
    /* 단추 글자(`다운로드`)뿐이면 파일 이름은 바로 앞 요소에 있다 — 태그를 줄로 바꿔 마지막 파일 이름 줄을 쓴다(지어내지 않는다 · 없으면 그대로).
       스크립트 호출(과기정통부)뿐 아니라 보통 내려받기 주소의 단추(경기대·충북대 · 2026-11-02)도 같다 */
    /* 🔴 링크 글자가 이미 파일 이름이면(그림·압축 파일 포함 — 문서 확장자 ATTACH_EXT 만 보면 「…포스터.png」를 단추로 보고 **앞 첨부의 이름**을 빌렸다 · 서울과기대 6건 · 리뷰 3차) 그대로 쓴다 */
    if (!LINK_FILE_NAME.test(name) && ((/^javascript:/i.test(raw) && url !== raw) || (BUTTON_WORD.test(name) && DOWNLOAD_URL.test(url)))) {
      const before = src.slice(Math.max(0, m.index - 500), m.index).replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.replace(/\s+/g, ' ').trim());
      /* 🔴 **바로 앞의 글자 줄 하나**만 본다(리뷰 2026-11-02) — 확장자 있는 줄을 거슬러 찾으면 `<span>포스터.jpg</span><a>다운로드</a>` 의 단추가
         그 앞 행의 `요강.hwp` 이름을 훔쳐 이름·주소 짝이 지어진다. 앞 줄에 파일 이름이 없으면 그대로(아래서 단추 글자로 버려진다) */
      const file = before.reverse().find(Boolean);
      if (file && ATTACH_EXT.test(file) && file.length <= 120) name = file;
    }
    if (BUTTON_WORD.test(name)) continue;   // 이름을 못 찾은 단추는 첨부가 아니다 — 「다운로드」 라는 이름의 첨부를 만들지 않는다
    const isFile = ATTACH_EXT.test(url) || ATTACH_EXT.test(name) || DOWNLOAD_URL.test(url);
    if (isFile && name.length >= 4 && name.length <= 120 && !TEMPLATE_NAME.test(name) && !out.has(url)) out.set(url, { name: name.slice(0, 100), url });
  }
  return [...out.values()];
}

/** 공고 상세 HTML 의 **본문 그림** {name, url, bodyImage} — 재수집 로봇이 봇 차단에 걸려 일반 fetch 로 물러섰을 때 쓴다 (2026-11-02).
    홍익대는 본문이 editorImage.do 그림 한 장(1080×1920)이고 헤드리스 브라우저는 봇 차단에 걸려 그림을 못 적었다 — 글자는 메뉴뿐이라 '본문 확보'로
    보이면서 자격은 영영 비었다(성취장학·선원가족). 이름 꼴은 브라우저 길(`본문이미지-WxH`)과 같아 elig-targets 가 같은 규칙으로 고른다.
    🔴 크기 표식(data-width/height · width/height)이 있는 그림만 — 받아 보기 전엔 로고인지 포스터인지 몰라 지어내지 않는다. */
export function htmlBodyImages(html, pageUrl, min = 300) {
  const out = [];
  const src = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of src.matchAll(/<img\b[^>]*>/gi)) {
    const attr = (k) => { const a = m[0].match(new RegExp(`(?:^|\\s)${k}\\s*=\\s*"([^"]*)"`, 'i')); return a ? a[1].trim() : ''; };   // `\b` 는 data-width 도 width 로 읽는다(리뷰)
    const s = attr('src');
    if (!s || /^data:/i.test(s)) continue;
    const w = Number(attr('data-width') || attr('width')), h = Number(attr('data-height') || attr('height'));
    if (!(w >= min && h >= min)) continue;
    let url;
    try { url = new URL(s, pageUrl).href; } catch { continue; }
    const ext = (url.match(/\.(png|jpe?g|gif|webp)(\?|$)/i) || [, 'jpg'])[1];
    if (!out.some((x) => x.url === url)) out.push({ name: `본문이미지-${w}x${h}.${ext}`, url, bodyImage: true });
  }
  return out;
}

/** 브라우저가 읽은 링크 [{title, url}] → 첨부 {name, url} — 브라우저 수집기의 두 길(상세 방문 · 클릭 수집)이 같이 쓴다.
    화면에 그려진 링크라 주석 문제는 없다. 스크립트 호출만 진짜 주소로 바꾼다(resolveJsDownload). */
export function linkAttachments(links, pageUrl, max = 6) {
  return (links || [])
    .map((l) => ({ ...l, title: cleanAttachName(l.title) }))
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

/* 화면 글자에서 파일 이름 — 확장자로 끝나는 덩어리. 브라우저 안(census)과 관문이 같은 식을 쓴다(FILE_NAME_SRC 를 문자열로 넘긴다).
   그림 확장자는 뺀다 — 본문 그림은 따로 적고(본문이미지-…), 사이트 로고·배너 파일 이름이 글자로 보이는 일은 드물지만 첨부로 세면 경보가 헛돈다.
   (2026-11-20 rescue-plan.mjs 에서 옮김 — 아래 「같은 파일」 판정도 이 눈으로 이름을 읽는다 · rescue-plan 은 여기 것을 그대로 다시 내보낸다) */
export const FILE_NAME_SRC = String.raw`([^\\/:*?"<>|\n\t]{2,120}\.(?:hwp|hwpx|pdf|docx?|xlsx?|pptx?|zip))(?=$|[\s\[\(（【])`;
const FILE_NAME = new RegExp(FILE_NAME_SRC, 'i');
/** 글자 한 덩어리에서 파일 이름 하나(없으면 '') — 확장자 바로 뒤에 글자가 이어지면 파일 이름이 아니다(「…신청서.hwp를 작성하여」 — 본문 문장 · 리뷰 1) */
export function fileNameIn(text) {
  const m = String(text || '').replace(/\s+/g, ' ').trim().match(FILE_NAME);
  return m ? m[1].trim() : '';
}
/* 사이트가 파일 이름 뒤에 붙인 꼬리 — 용량·내려받은 횟수·미리보기 (2026-11-25 · 설계 docs/designs/paid-gate-activities.md 6절 ②③).
   꼬리 때문에 이름이 확장자로 끝나지 않으면 로봇이 그 줄을 문서로 보지 않는다 — 동아대 국어문화원 글(`신청서.hwp (71KB)` · 주소에 확장자도 내려받기 낱말도 없다)은 첨부 둘이
   아예 안 잡혔고, 농림축산식품부 글(`….hwp &nbsp;&nbsp;&nbsp;(파일 용량 : 1449 KB`)은 잡히고도 문서로 안 읽혔다.
   🔴 파일 이름이 맨 앞에 있고 그 뒤가 **전부 이 꼴의 꼬리**일 때만 뗀다 — 본문 문장(「신청서.hwp 작성 방법 안내」)·다른 괄호(「공고문.hwp (최종)」)는 건드리지 않는다.
      꼬리가 없는 이름은 받은 글자 그대로 돌려준다(빈칸도 안 다듬는다 — 실린 이름이 까닭 없이 바뀌지 않게).
   리뷰 2026-11-25 — 페이지가 실제로 주는 글자로 다시 맞췄다:
     · 꼬리는 여럿 이어진다(「(파일 용량 : 1449 KB) 바로보기」) · `&nbsp;` 가 확장자에 바로 붙는다(「….pdf&nbsp; &nbsp;(다운로드 : 4회) 바로보기」) · 단위가 K 한 글자다(「(71.5K)」)
     · 🔴 뜻이 있는 괄호는 꼬리가 아니다 — 단위 뒤에 글자가 이어지면(「(1회차)」) 수가 아니고, 숫자+단위 뒤에 다른 말이 오면(「(3건 이상 제출)」) 안내 문구다.
       이름표로 시작하는 괄호(「(다운로드 …)」)는 숫자가 들어 있을 때만 꼬리다(「(다운로드 후 작성)」은 그대로). 떼면 이름이 다른 두 파일이 같은 이름이 된다 */
const TAIL_SP = String.raw`(?:\s|&nbsp;)`;
const TAIL_NUM = String.raw`\d[\d.,]*\s?(?:KB|MB|GB|K|M|G|bytes?|B|바이트|회|건)(?![가-힣A-Za-z])`;
/* 이름표 괄호는 「이름표 + 숫자(+ 단위)」만 꼬리다(최종 리뷰 2026-11-26) — 숫자만 들어 있으면 떼던 때 「(다운로드 후 2부 작성)」·「(크기 1년 보관)」·「(size: 2 pages)」의 뜻이 잘렸다(장학금 첨부 이름에도 쓰는 함수) */
/* 「다운로드 횟수」·「다운로드수」·「Downloads」 도 이름표다(리뷰 3차 M7 — 좁힌 뒤 못 떼던 꼬리) */
const TAIL_LABEL = String.raw`(?:(?:파일\s?(?:용량|크기)|용량|크기|size|다운로드|내려받기|downloads?)(?:\s?(?:횟수|수))?)`;
const TAIL_LNUM = String.raw`\d[\d.,]*\s?(?:KB|MB|GB|K|M|G|bytes?|B|바이트|회|건)?(?![가-힣A-Za-z\d])`;   // 이름표 뒤 숫자(+ 단위) — 뒤에 글자가 바로 이어지면 꼬리가 아니다
const TAIL_PAIR = String.raw`${TAIL_LABEL}\s*[:：]?\s*${TAIL_LNUM}`;
const TAIL_BRACKET = String.raw`[(（\[【]\s*(?:${TAIL_PAIR}(?:\s*[,·/|]\s*(?:${TAIL_PAIR}|${TAIL_NUM}))*|${TAIL_NUM}(?:[\s,·/|]*${TAIL_NUM})*)\s*[)）\]】]?`;   // 이름표 쌍 뒤에는 쌍이나 단위 붙은 수(「12회, 1.2MB」)
const TAIL_PREVIEW = String.raw`(?:미리\s?보기|바로\s?보기)`;
const SITE_TAIL = new RegExp(String.raw`^(?:${TAIL_SP}*(?:${TAIL_BRACKET}|${TAIL_PREVIEW}))+${TAIL_SP}*$`, 'i');
const LONE_PREVIEW = new RegExp(String.raw`^(?:${TAIL_SP}*${TAIL_PREVIEW})+${TAIL_SP}*$`, 'i');
/** lonePreview: false — 꼬리가 「미리보기」·「바로보기」뿐이면 떼지 않는다(받을 때 쓴다 — 그런 링크는 뷰어 주소일 수 있어, 받는 주소가 분명한지 본 뒤에 뗀다 · detailAttachments) */
export function trimSiteTail(name, { lonePreview = true } = {}) {
  const raw = String(name ?? '');
  const s = raw.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  const f = fileNameIn(s);
  if (!f || !s.startsWith(f)) return raw;
  const rest = s.slice(f.length);
  if (!rest || !SITE_TAIL.test(rest)) return raw;
  return !lonePreview && LONE_PREVIEW.test(rest) ? raw : f;
}
/** 꼬리를 떼지 않을 이름 — 그 이름으로 이미 받은 원본·만든 사본이 있는 첨부(글 id → 이름들). 꼬리를 다듬어 이름이 바뀌면 그 사본이 주인을 잃는다.
    formsIndex = collector/extracted/forms-index.txt 글자(줄마다 탭 칸 · 셋째 = 이름 · 다섯째 = 글 id) · pdfIndexes = data/forms-pdf·docs-pdf 의 index.json(깨졌으면 null) — 수집 로봇이 읽어 넘긴다(2026-11-26) */
export function usedAttachNamesFrom({ formsIndex = '', pdfIndexes = [] } = {}) {
  const used = new Map();
  const put = (id, name) => { if (!id || !name) return; if (!used.has(id)) used.set(id, new Set()); used.get(id).add(name); };
  for (const line of String(formsIndex || '').split('\n')) { const c = line.split('\t'); put(c[4], c[2]); }
  for (const idx of pdfIndexes || []) for (const [id, rows] of Object.entries((idx && idx.items) || {})) for (const r of rows || []) put(id, r && r.name);
  return used;
}
/** 실린 활동 글의 첨부 이름에서 사이트 꼬리를 뗀다(소급 — 수집 로봇이 발행할 때 · 같은 파일 한 줄 만들기 stripSiteChrome 앞). 바꾼 줄 수를 돌려준다.
    used = 글 id → 그 이름으로 이미 받은 원본·만든 사본이 있는 첨부 이름들(위 usedAttachNamesFrom) — 🔴 든 이름은 건드리지 않는다(이름이 바뀌면 그 사본이 주인을 잃는다) */
export function trimActivityTails(items, used = new Map()) {
  let n = 0;
  for (const it of items || []) {
    if (!it || !Array.isArray(it.attachments)) continue;
    const keep = (it.id && used.get(it.id)) || null;
    for (const a of it.attachments) {
      if (!a || typeof a.name !== 'string' || (keep && keep.has(a.name))) continue;
      const t = trimSiteTail(a.name);
      if (t !== a.name) { a.name = t; n += 1; }
    }
  }
  return n;
}

/* ── 같은 파일이 이름만 달리 여러 번 실린 줄 (2026-11-20 · 개발자 지시 *"정리하고 재발하지 않도록"*) ─────────────
   실측: 광운대 인석장학금 한 공고에 파일 2개가 6줄로 실렸다 — 같은 링크를 세 길이 제각기 읽었다(HTML 길 `Attachment 2026….hwp` ·
   브라우저 길 `Attachment2026….hwp` · 화면 글자 세기 `2026….hwp`). 서울교대 우양재단은 파일 3개가 36줄 — 링크 글자에 붙은 내려받은 횟수
   (`X.hwp (다운로드 : 11회)` · `… 12회`)가 볼 때마다 달라 새 첨부가 됐다(11-17 에 쌓이는 것은 막았지만 쌓인 줄은 남아 있었다).
   🔴 **주소가 같다고 같은 파일은 아니다** — 내려받기가 스크립트인 게시판은 서로 다른 파일 셋이 전부 공고 화면 주소(`…#;`)를 달고 있다(중앙대·서울시립대 실측).
      틀리게 합치면 첨부가 학생 화면에서 사라진다(겹쳐 보이는 것보다 나쁘다). 그래서 넷이 다 맞을 때만 같은 파일로 본다:
      ① 받을 주소가 글자까지 같다(http · `#` 없음 · 그 공고 화면 주소가 아님)
      ② 이름(파일 이름만 읽은 것 — 횟수·아이콘 꼬리·앞 번호를 뗀다)이 같거나, 한쪽 앞에 화면 글자가 더 붙었을 뿐이다(`Attachment…`)
      ③ 확장자가 둘 다 있으면 같다
      ④ **그 주소를 단 줄이 전부** 서로 그렇다 — 한 줄이라도 딴 이름이면 그 주소는 파일 하나의 주소가 아니므로 아무것도 합치지 않는다
   학교가 같은 자리의 파일을 새 이름으로 바꿔 올린 것(경희대 `…_수정.pdf` → `…_수정_20261001.pdf`)은 **합치지 않는다**(리뷰 11-20) — 합치면 새 이름이
   영영 안 실려 공고문 PDF 로봇이 바뀐 파일을 다시 바꾸지 않는다. */
const DOC_EXT = /\.(hwpx?|docx?|pdf|xlsx?|pptx?|zip)$/i;
/* 파일 이름 뒤에 괄호로 붙은 화면 글자(`포스터.jpg (다운로드 : 9회)` · `[13KB]`) — 문서는 fileNameIn 이 떼고, 그림 이름은 여기서 뗀다(서울교대 포스터 12줄) */
const TAILED = /^(.*?\.(?:hwpx?|docx?|pdf|xlsx?|pptx?|zip|png|jpe?g|gif|bmp|webp))\s*[(\[（【][^)\]）】]{0,40}[)\]）】]\s*$/i;
const nameKey = (n) => { const s = cleanAttachName(n); return (fileNameIn(s) || s.replace(TAILED, '$1')).replace(/\s*미리보기\s*$/, '').replace(/^\d+\.\s*/, '').trim(); };
const nameParts = (n) => { const k = nameKey(n).normalize('NFC').replace(/\s+/g, '').toLowerCase(); const e = (k.match(DOC_EXT) || [, ''])[1]; return { stem: k.replace(DOC_EXT, ''), ext: e }; };
const fileUrl = (a, pageUrl = '') => { const u = String((a && a.url) || ''); return /^https?:\/\//i.test(u) && !u.includes('#') && u !== pageUrl ? u : ''; };
function sameName(a, b) {
  const x = nameParts(a.name), y = nameParts(b.name);
  if (!x.stem || !y.stem || (x.ext && y.ext && x.ext !== y.ext)) return false;
  return x.stem === y.stem || x.stem.endsWith(y.stem) || y.stem.endsWith(x.stem);
}
/** 두 첨부가 같은 파일인가(①②③) — 줄 둘만 놓고 본다. 목록에 쌓을지는 sameFileAmong(④까지)으로 정한다 */
export function sameFileEntry(a, b) {
  if (!a || !b || a.bodyImage || b.bodyImage) return false;
  const u = fileUrl(a);
  return !!u && u === fileUrl(b) && sameName(a, b);
}
/** 이 줄이 이미 적힌 줄들 가운데 같은 파일인가 — 같은 주소를 단 줄이 있고 **그 전부**와 이름이 맞을 때만(④) */
export function sameFileAmong(rows, a) {
  const u = a && !a.bodyImage ? fileUrl(a) : '';
  if (!u) return false;
  const g = (rows || []).filter((h) => h && !h.bodyImage && fileUrl(h) === u);
  return g.length > 0 && g.every((h) => sameName(h, a));
}
/** 한 공고의 첨부에서 같은 파일을 한 줄로 — 자리는 처음 나온 줄 · 이름은 파일 이름으로 끝나는 쪽, 같으면 앞에 붙은 글자가 없는(짧은) 쪽.
    pageUrl(조각 뗀 그 공고 화면 주소)을 주면 그 주소를 단 줄은 보지 않는다 */
export function collapseSameFiles(atts, pageUrl = '') {
  const list = atts || [];
  const groups = new Map();
  list.forEach((a, i) => { const u = a && !a.bodyImage ? fileUrl(a, pageUrl) : ''; if (u) (groups.get(u) || groups.set(u, []).get(u)).push(i); });
  const pure = (n) => DOC_EXT.test(cleanAttachName(n));
  const better = (n, cur) => (pure(n) !== pure(cur) ? pure(n) : nameParts(n).stem.length !== nameParts(cur).stem.length ? nameParts(n).stem.length < nameParts(cur).stem.length : String(n).length < String(cur).length);
  const drop = new Set(); const rename = new Map();
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    if (!idx.every((i, p) => idx.every((k, q) => q <= p || sameName(list[i], list[k])))) continue;   // ④ 한 줄이라도 딴 이름 — 그 주소는 건드리지 않는다
    rename.set(idx[0], idx.reduce((best, i) => (better(list[i].name, best) ? list[i].name : best), list[idx[0]].name));
    idx.slice(1).forEach((i) => drop.add(i));
  }
  const out = [];
  list.forEach((a, i) => { if (!drop.has(i)) out.push(rename.has(i) && rename.get(i) !== a.name ? { ...a, name: rename.get(i) } : a); });
  return out;
}

/* 빌린 이름 되돌리기 (2026-11-26 · 리뷰 3차에서 드러남) — 예전 detailAttachments 는 링크 글자가 그림·압축 파일 이름이면 앞 첨부의 이름을 빌려 왔다(서울과기대 활동 3 · 장학 3).
   받는 주소에 **원래 이름이 실린** 규칙(서울과기대 bbs_download.jsp 의 ogrfname — 우리가 호출의 셋째 인자로 지은 주소)만 그 이름으로 되돌린다.
   🔴 같은 글의 다른 줄과 이름이 겹칠 때만(빌린 이름) — 사이트가 보인 이름이 원래 이름과 다른 것(띄어쓰기 등)은 사이트가 보인 그대로 둔다 */
const ORIGINAL_NAME_AT = [{ host: /(^|\.)seoultech\.ac\.kr$/i, path: /\/hcm\/bbs\/bbs_download\.jsp$/i, param: 'ogrfname' }];
const originalNameOf = (url) => {
  let u; try { u = new URL(String(url || '')); } catch { return ''; }
  const r = ORIGINAL_NAME_AT.find((x) => x.host.test(u.hostname) && x.path.test(u.pathname));
  return r ? String(u.searchParams.get(r.param) || '').trim() : '';
};
export function unborrowNames(atts) {
  const list = atts || [];
  const count = new Map();
  for (const a of list) if (a && a.name) count.set(a.name, (count.get(a.name) || 0) + 1);
  return list.map((a) => {
    if (!a || !a.name || count.get(a.name) < 2) return a;
    const real = originalNameOf(a.url);
    return real && real !== a.name ? { ...a, name: real } : a;
  });
}

export const CHROME_MIN_PAGES = 3;
/** lists: 공고 배열 여럿([notices.items, registered.items, …]). 첨부 목록을 **그 자리에서** 다듬고 고친 개수를 돌려준다 —
    ① 게시판 공통 링크 걷기 ② 같은 파일 한 줄로(collapseSameFiles) ③ 이제 풀 수 있게 된 `javascript:` 내려받기 호출을 진짜 주소로(resolveJsDownload —
    규칙을 더하면 이미 실린 글에도 저절로 닿는다 · 운영 원칙 7 소급) ④ 앞 첨부에서 빌린 이름을 받는 주소의 원래 이름으로(unborrowNames).
    저장하는 로봇이 저장 직전에 부르므로 지난 글도 다음 실행에 걷힌다 */
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
    let changed = it.attachments.length - kept.length;
    const page = pageOf(it);
    const solved = kept.map((a) => {
      const real = a && /^javascript:/i.test(a.url || '') ? resolveJsDownload(a.url, page) : null;
      if (!real) return a;
      changed += 1;
      return { ...a, url: real };
    });
    const collapsed = collapseSameFiles(solved, page);
    changed += solved.length - collapsed.length;
    const one = unborrowNames(collapsed);   // ④ 앞 첨부에서 빌린 이름 → 받는 주소의 원래 이름(위 unborrowNames)
    changed += one.filter((a, i) => a !== collapsed[i]).length;
    removed += changed;
    if (changed) it.attachments = one;
  }
  return removed;
}
