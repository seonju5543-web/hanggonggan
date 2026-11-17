/* ============================================================
   자격요건 로봇(rescue-bodies.mjs)의 **순수 규칙** — 대상 거르기 · 차례 · 장부 한 칸 · 첨부 합치기
   (2026-10-04 로봇·도구 점검 bodies-1·bodies-4)

   왜 따로 있나 — rescue-bodies.mjs 는 불러오는 순간 registered.json 을 읽고 브라우저를 띄운다(미리보기면 process.exit).
   관문이 그 파일을 부를 수 없어 규칙을 시험할 길이 없었다. 여기에는 부르는 순간 아무것도 하지 않는 함수만 둔다
   (playwright 도 안 들인다). 페이지를 여는 일은 rescue-bodies.mjs 에 그대로 있다.

   이번에 더한 규칙 (bodies-4 · run #53·#54·#55 실측 — 같은 세 건이 매 실행 맨 앞 세 자리를 차지했다):
     ① 본문을 이레 안에 확보한 공고는 다시 안 연다 — 본문은 있는데 자격 절만 없는 공고는 발췌기·AI 의 몫이다.
        (예전엔 성공하면 장부 칸을 지워 tries 가 0 으로 돌아가, 다음 실행에 또 맨 앞에 왔다)
     ② 마감이 지났거나 학생 화면에서 내려간 공고(match-engine notStale)는 열지 않는다 — 학생이 못 보는 공고다.
     ③ 차례: 덜 해 본 것부터 · 같으면 한 번도 본문을 못 받은 것 먼저 · 그다음 등록 순서.
   관문: verify/health-gates/bodies.mjs
   ============================================================ */
import { createRequire } from 'node:module';
import { canonUrl } from './canon-url.mjs';

const { notStale } = createRequire(import.meta.url)('../match-engine.js');

/** 본문을 확보한 뒤 다시 안 여는 날 수 */
export const OK_REST_DAYS = 7;
/** 이 공고를 열어 볼 이유가 있나 — ① 자격을 아직 못 읽었다(예전 기준 그대로)
    ② 자격은 있어도 **본문이 껍데기**(메뉴뿐)라 금액·마감을 못 읽었다(2026-10-29 · 마감 전 등록 142건 중 61건이 이 상태인데
       대상 기준이 자격뿐이라 로봇이 한 번도 안 갔다 — 금액 모름 66건의 절반, 마감 없음 38건의 셋 중 하나).
    금액은 숫자가 없어도 `등록금 전액·50%·시급` 꼴이면 읽은 것이다. 상시 제도(program)는 마감이 없는 게 정상이다. */
export function wantsBody(it, hasReq, hasBody) {
  if (!hasReq) return true;
  if (hasBody) return false;
  const amt = String((it && it.amount) || '');
  const amountKnown = (it && it.amountValue > 0) || /(전액|반액|\d\s?%|시급|시간당)/.test(amt);
  return !amountKnown || (!(it && it.deadline) && !(it && it.program));
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** 장부에 '이레 안에 본문 확보' 기록이 있는가 */
export function restingAfterOk(led, today) {
  return !!(led && led.ok && daysBetween(led.ok, today) < OK_REST_DAYS);
}

/** 학생 화면에 더는 안 나오는 공고인가 — 마감(한국 날짜)이 오늘 전 · 또는 마감도 없이 오래된 공고(notStale 거짓).
    마감도 등록일도 없으면 notStale 이 참이라 대상에 남는다. */
export function closedForStudents(it, today, now = new Date()) {
  const d = String((it && it.deadline) || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d < today) return true;
  return !notStale(it, now);
}

/** 차례 — [{ tries, everOk, … }] 를 새 배열로. 같은 값끼리는 들어온 차례(등록 순서) 그대로 */
export function orderTargets(list) {
  return (list || []).map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.tries - b.t.tries) || ((a.t.everOk ? 1 : 0) - (b.t.everOk ? 1 : 0)) || (a.i - b.i))
    .map((x) => x.t);
}

/** 장부 한 칸 — 결과(outcome)마다 무엇을 남기나.
    ok   : 본문 확보 — 날짜를 남긴다(이레 쉼 · 지우면 다음 실행에 또 맨 앞에 온다)
    hung : 한 공고 시한(PAGE_MS) 안에 안 끝남 — 실패로 한 번 센다 · 표식 hung
    miss : 열었는데 본문이 없음 — 실패로 한 번 센다
    gone : 게시판에서 내려간 공고 — 바로 쉼(REST_AFTER 만큼 센 것으로)
    어떤 문턱으로 판정했는지(minBody)는 실패 칸에 남긴다 — 문턱이 내려가면 쉬는 중이라도 다시 해 본다(staleJudgment).
    마지막 확보 날짜(ok)는 실패 칸에도 이어 둔다(차례의 '한 번도 못 받은 것 먼저'에 쓴다). */
export function ledgerEntry(prev, outcome, { today, minBody, name, restAfter = 3 }) {
  const p = prev || {};
  const keepOk = p.ok ? { ok: p.ok } : {};
  /* 첨부를 살핀 기록(att…)은 본문 결과와 다른 일이라 어떤 결과에도 이어 둔다 — 안 이으면 본문 칸을 새로 적을 때마다 '안 살핀 공고'로 돌아가 매 실행 다시 연다 (2026-11-17) */
  const keepAtt = Object.fromEntries(ATT_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
  if (outcome === 'ok') return { ok: today, at: today, tries: 0, name, ...keepAtt };
  if (outcome === 'gone') return { tries: restAfter, at: today, minBody, gone: true, name, ...keepOk, ...keepAtt };
  if (outcome === 'hung') return { tries: (p.tries || 0) + 1, at: today, minBody, hung: true, name, ...keepOk, ...keepAtt };
  return { tries: (p.tries || 0) + 1, at: today, minBody, name, ...keepOk, ...keepAtt };
}

/** 장부에서 등록 목록(items)에 없는 공고의 칸을 지운다(제자리) — 지운 칸 수를 돌려준다.
    열쇠는 로봇이 쓰는 것과 같은 canonUrl(sourceUrl). '_' 로 시작하는 칸(표식)은 남긴다.
    왜: 확보도 날짜로 남기게 된 뒤(ok) 지우는 곳이 없으면 장부가 확보한 공고 수만큼 끝없이 자란다(2026-10-04 리뷰 R5). */
export function pruneLedger(ledger, items) {
  const live = new Set();
  for (const it of items || []) if (it && it.sourceUrl) live.add(canonUrl(it.sourceUrl));
  let dropped = 0;
  for (const k of Object.keys(ledger || {})) {
    if (k.startsWith('_') || live.has(k)) continue;
    delete ledger[k];
    dropped += 1;
  }
  return dropped;
}

/* 첨부 이름 비교 — 앞 번호(`1. `)와 `미리보기` 꼬리를 뗀다. 안 떼면 `1. ○○.hwp` 와 `○○.hwp` 가 다른 첨부로 보여
   같은 파일이 두 번 쌓인다(2026-08-23 실측) */
/* 파일 이름이 들어 있으면 **그 이름만** 본다(2026-11-17 리뷰 5) — 화면 글자는 `X.hwp`, 링크 글자는 `X.hwp (다운로드 : 12회)` 로 와 같은 파일이 둘로 쌓였다
   (서울교대 한 공고에 그런 첨부가 36개). fileNameIn 은 아래에 있다(함수 선언이라 여기서 불러도 된다) */
const normName = (n) => { const s = String(n || ''); return (fileNameIn(s) || s).replace(/\s*미리보기\s*$/, '').replace(/^\d+\.\s*/, '').trim(); };

/** 페이지에서 찾은 첨부 중 아직 기록에 없는 것만 */
export function newAttachments(have, found) {
  const had = new Set((have || []).map((a) => normName(a.name)));
  const out = [];
  for (const a of found || []) {
    const k = normName(a.name);
    if (had.has(k)) continue;
    had.add(k);
    out.push(a);
  }
  return out;
}

/* ============================================================
   첨부 살피기 (2026-11-17 개발자 지시 — *"원문에 있는 양식이 앱에도 뜰 수 있게끔 오류없이 돌아가도록"*)

   실측(2026-11-17): 정식 등록 355건 중 90건 · 실시간 피드 647건 중 243건이 첨부 0개였고, 서울시립대·전북대·국민대·고려대·서강대는
   16건 중 16건이 0개였다. 원문을 열어 보니 파일은 있었다 — 게시판이 첨부를 **주소가 아니라 누르면 도는 동작**으로 내려 주거나(전북대 cf_download),
   목록을 **화면이 뜬 뒤에** 불러와(국민대) 주소만 읽는 로봇은 처음부터 못 봤다. 학교마다 규칙을 한 줄씩 넣는 길(attachment-link JS_DOWNLOAD_RULES)은
   모르는 학교를 조용히 놓친다. 그래서 ① 진짜 브라우저가 그린 화면에서 **파일 이름처럼 보이는 글자**를 세고 ② 주소가 없으면 **눌러서** 내려오는 주소를 잡고
   ③ 그 주소가 세션 없는 새 요청으로도 파일을 주는지 본 뒤에만 적는다. 못 구하면 **이름만** 적는다(앱은 「원문 게시판에서 내려받기」로 보인다 — 지어내지 않는다).
   놓친 것은 장부(attGap)에 남아 리포트·경보로 나간다. 여기에는 부르는 순간 아무것도 하지 않는 규칙만 둔다(페이지를 여는 일은 rescue-bodies.mjs).
   ============================================================ */
/** 장부에 적는 첨부 살핀 기록의 칸 — ledgerEntry 가 이어 둔다 */
export const ATT_KEYS = ['att', 'attSeen', 'attGap', 'attTries', 'attAt'];
/** 받을 주소를 못 구한 첨부가 남은 공고를 다시 살피기까지의 날 수 */
export const ATT_REST_DAYS = 7;
/** 한 공고에서 눌러 보는 첨부 수 · 첨부 살피기에 쓰는 시간(한 공고 시한 60초 안에서) */
export const ATT_MAX_CLICKS = 4;
export const ATT_BUDGET_MS = 20000;

/** 받을 수 있는 주소인가 — http(s) 만. `javascript:`·빈 주소·`#` 는 앱이 이름만 보인다(app.js attachmentLinkHtml) */
export const usableUrl = (u) => /^https?:\/\//i.test(String(u || '').trim());

/* 화면 글자에서 파일 이름 — 확장자로 끝나는 덩어리. 브라우저 안(census)과 여기(관문)가 같은 식을 쓴다(FILE_NAME_SRC 를 문자열로 넘긴다).
   그림 확장자는 뺀다 — 본문 그림은 따로 적고(본문이미지-…), 사이트 로고·배너 파일 이름이 글자로 보이는 일은 드물지만 첨부로 세면 경보가 헛돈다 */
export const FILE_NAME_SRC = String.raw`([^\\/:*?"<>|\n\t]{2,120}\.(?:hwp|hwpx|pdf|docx?|xlsx?|pptx?|zip))(?=$|[\s\[\(（【])`;
const FILE_NAME = new RegExp(FILE_NAME_SRC, 'i');
/** 글자 한 덩어리에서 파일 이름 하나(없으면 '') — 앞 번호·`미리보기` 꼬리·크기 표식은 normName 이 비교 때 뗀다.
    확장자 바로 뒤에 글자가 이어지면 파일 이름이 아니다(「…신청서.hwp를 작성하여」 — 본문 문장 · 리뷰 1) */
export function fileNameIn(text) {
  const m = String(text || '').replace(/\s+/g, ' ').trim().match(FILE_NAME);
  return m ? m[1].trim() : '';
}

/* ── 브라우저 안에서 도는 함수 — 화면에 **보이는** 파일 이름을 센다 ──
   rescue-bodies 가 frame.evaluate 로 넘긴다(함수 글자가 그대로 페이지로 간다 — 바깥 것을 못 쓴다 · 식은 인자 src 로 받는다). 여기 둔 것은 관문이 가짜 화면으로 부르려는 것이다.
   글자 조각마다 파일 이름 꼴인지 보고, 그 글자를 감싼 **누를 수 있는 것**(a · button · onclick · 네 겹 안)에 표식(data-hdj-att)을 단다.
   🔴 세지 않는 것(리뷰 1 — 본문 문장이 첨부로 적혔다): ① 누를 수 있는 것 안에 있지 않은 글자(본문의 「붙임 신청서.hwp 를 작성하여…」) ② 파일 이름 말고 글자가 길게 붙은 조각(문장)
      ③ 안 보이는 것(크기 0) · 스크립트 속 글자.
   🔴 한 단추 안에 파일 이름이 둘이면 둘째부터는 누르지 않는다(i: -1 — 표식을 덮어쓰면 첫째 표식이 사라져 누르기가 30초를 기다렸다 · 리뷰 3).
   돌려주는 것: [{ i, name, href }] — href 는 화면이 그린 진짜 링크일 때만(`#`·`javascript:` 는 빈 값) */
export function censusInPage(src) {
  const FILE = new RegExp(src, 'i');
  const out = [];
  let marks = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = (t.nodeValue || '').replace(/\s+/g, ' ').trim();
    const m = text.match(FILE);
    if (!m) continue;
    const el = t.parentElement;
    if (!el || el.closest('script,style,noscript,textarea,template')) continue;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    let click = null;
    for (let i = 0, p = el; i < 4 && p; i += 1, p = p.parentElement) {
      if (p.tagName === 'A' || p.tagName === 'BUTTON' || p.hasAttribute('onclick')) { click = p; break; }
    }
    if (!click) continue;                                   // ① 누를 수 없는 글자 — 본문 문장
    const name = m[1].trim();
    if (text.length - name.length > 30) continue;           // ② 이름 말고 글자가 길게 붙었다 — 문장
    if (out.some((x) => x.name === name)) continue;
    const raw = click.tagName === 'A' ? (click.getAttribute('href') || '') : '';
    const href = raw && !/^(#|javascript:)/i.test(raw.trim()) ? click.href : '';
    let i = -1;
    if (!click.hasAttribute('data-hdj-att')) { i = marks; marks += 1; click.setAttribute('data-hdj-att', String(i)); }
    out.push({ i, name, href });
  }
  return out;
}

/* 첨부만 살피러 간 공고에서 믿는 첨부 (2026-11-17 실측 — 실제 공고 10건을 돌려 보니 주소에 `file`·`attach` 가 든 **메뉴 링크**가 첨부로 섞였다:
   이화여대 「대학정보공시」(…list.do?filePath=…) · 광운대 「부설연구기관」(research_attach.jsp) · 영남대 「첨부파일 다운로드」「첨부파일 보기」(같은 파일의 단추 둘)).
   본문 대상에서는 예전부터 그렇게 모으고 수집 로봇의 stripSiteChrome(같은 주소가 세 글 이상)이 걷어 왔다. 하지만 첨부 살피기는 **떠 있는 공고 전부**를 열어
   그 잡음을 학생 화면에 그대로 싣게 된다 — 그래서 여기서는 ① 이름이 파일 이름이거나 ② 주소가 분명한 내려받기 꼴인 것만 믿고, 단추 글자뿐인 이름은 버린다.
   본문 그림(로고·웹접근성 마크가 섞인다)은 자격을 읽을 재료라 이미 읽은 공고에는 적지 않는다 */
const STRICT_DOWNLOAD = /mode=(?:file)?download|filedownload|download\.do|downloadBbsFile\.do|fileDown|bbs_download|attach_?no=|attachmentNo=|fileNo=|atchFileId=/i;
const BUTTON_LABEL = /^(?:(?:첨부\s?)?파일\s?)?(?:다운로드|내려받기|보기|미리\s?보기|바로\s?보기|열기|download|preview|view)$/i;
const VIEWER_LINK = /뷰어|viewer/i;   // 「한글뷰어 다운로드」 — 공고의 파일이 아니라 프로그램 안내(리뷰 9)
export function trustedAttachment(a) {
  if (!a || a.bodyImage) return false;
  const name = String(a.name || '').replace(/\s+/g, ' ').trim();
  if (!name || BUTTON_LABEL.test(name) || VIEWER_LINK.test(name)) return false;
  return !!fileNameIn(name) || STRICT_DOWNLOAD.test(String(a.url || ''));
}

/** 이 공고의 첨부를 브라우저로 살필 때인가 — 한 번도 안 살폈거나(att 없음), 지난번에 받을 주소를 못 구한 첨부가 남았고 이레가 지났을 때.
    다 구한 공고는 다시 안 연다(첨부는 글이 올라온 뒤 거의 안 바뀐다 · 같은 학교를 몰아 두드리지 않는다) */
export function wantsAttachments(led, today, { restAfter = 3, restDays = 7 } = {}) {
  if (!led) return true;
  /* 🔴 못 여는 공고를 옆문으로 매 실행 두드리지 않는다(리뷰 2) — 게시판에서 내려간 글 · 본문 쪽에서 세 번 실패해 쉬는 글 · 첨부 살피기로 세 번 못 연 글은 이레를 쉰다.
     쉼이 없으면 러너에서 안 열리는 학교의 공고들이 매 실행 맨 앞을 차지해 다른 공고의 차례가 안 온다 */
  if (led.gone) return false;
  if ((led.tries || 0) >= restAfter && led.at && daysBetween(led.at, today) < restDays) return false;
  if ((led.attTries || 0) >= restAfter && led.attAt && daysBetween(led.attAt, today) < ATT_REST_DAYS) return false;
  if (!led.att) return true;
  return (led.attGap || 0) > 0 && daysBetween(led.att, today) >= ATT_REST_DAYS;
}

/** 장부 칸에 '첨부를 살피러 갔는데 화면을 못 봤다'를 한 번 센다(열지 못함 · 시한 초과) — 본문 칸(tries·ok)은 건드리지 않는다 */
export function withAttMiss(entry, today) {
  const e = entry || {};
  return { ...e, attTries: (e.attTries || 0) + 1, attAt: today };
}

/** 장부 칸에 첨부 살핀 결과를 얹는다 — seen: 화면에서 본 파일 이름 수 · gap: 그중 받을 주소가 없는 수 */
export function withAttCheck(entry, { today, seen, gap }) {
  const e = { ...(entry || {}), att: today, attSeen: seen, attGap: gap };
  delete e.attTries; delete e.attAt;   // 화면을 봤다 — 못 연 횟수는 지운다
  return e;
}

/** 찾은 것에서 같은 이름은 하나로 — 받을 주소가 있는 쪽을 남긴다(주소 읽기가 `javascript:` 를, 누르기가 진짜 주소를 낸 같은 파일) */
export function preferUsable(found) {
  const by = new Map();
  for (const a of found || []) {
    const k = a && a.bodyImage ? `img:${a.url}` : normName(a && a.name);
    if (!k) continue;
    const had = by.get(k);
    if (!had || (!usableUrl(had.url) && usableUrl(a.url))) by.set(k, a);
  }
  return [...by.values()];
}

/** 기록의 첨부 가운데 **이름은 같은데 받을 주소가 없던 것**에 찾은 주소를 채운다 — 새 배열과 채운 이름들을 돌려준다(제자리 안 고침).
    이름·차례는 그대로 둔다(관리자가 고친 이름을 덮지 않는다) */
export function upgradeAttachmentUrls(have, found) {
  const good = new Map();
  for (const a of found || []) if (a && !a.bodyImage && usableUrl(a.url) && !good.has(normName(a.name))) good.set(normName(a.name), a.url);
  const upgraded = [];
  const list = (have || []).map((a) => {
    const u = a && !usableUrl(a.url) ? good.get(normName(a.name)) : null;
    if (!u) return a;
    upgraded.push(a.name);
    return { ...a, url: u };
  });
  return { list, upgraded };
}

/** 살핀 뒤의 셈 — 화면에서 본 파일 이름(seenNames) 가운데 기록(attachments)에 받을 주소가 없는 것의 수 */
export function attGapOf(seenNames, attachments) {
  const ok = new Set((attachments || []).filter((a) => a && usableUrl(a.url)).map((a) => normName(a.name)));
  return [...new Set((seenNames || []).map(normName).filter(Boolean))].filter((n) => !ok.has(n)).length;
}

/** 눌러서 잡은 주소를 믿어도 되나 — 세션 없는 새 요청의 응답으로 잰다: 2xx · 첫 조각이 비지 않고 · 웹페이지가 아니다.
    로그인 화면·오류 화면도 200 으로 오므로 상태 코드만 보지 않는다(attachment-link isHtmlPayload 와 같은 표지) */
export function replayOk(status, headBytes) {
  if (!(status >= 200 && status < 300) || !headBytes || headBytes.length < 4) return false;
  /* 🔴 '웹페이지가 아니면 통과'로 재지 않는다(리뷰 4) — `<script>alert("로그인 후 이용")</script>` · JSON 오류도 웹페이지 표지가 없어 통과했다.
     우리가 세는 파일(hwp·hwpx·pdf·doc(x)·xls(x)·ppt(x)·zip)의 **서명**일 때만 믿는다: PDF `%PDF` · 압축 꼴(hwpx·docx·xlsx·pptx·zip) `PK` ·
     옛 오피스·한글 5(hwp·doc·xls·ppt) `D0 CF 11 E0` · 한글 3 `HWP Document File` */
  const b = Buffer.from(headBytes.subarray(0, 32));
  return b.subarray(0, 4).toString('latin1') === '%PDF' || (b[0] === 0x50 && b[1] === 0x4b)
    || (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) || b.toString('latin1').startsWith('HWP Document File');
}

/** 눌러서 내려온 파일의 이름(suggested)이 화면의 이름(name)과 **다른 종류**인가 — 확장자가 둘 다 있는데 다르면 남의 내려받기다(앞 단추의 늦은 내려받기 · 리뷰 6).
    서버가 이름을 바꿔 주는 일은 흔해서 이름 전체는 견주지 않는다 */
export function wrongKind(name, suggested) {
  const ext = (s) => (String(s || '').toLowerCase().match(/\.(hwpx?|pdf|docx?|xlsx?|pptx?|zip)(?=$|[\s\[\(（【])/) || [])[1] || '';
  const a = ext(fileNameIn(name) || name), b = ext(String(suggested || '').trim());
  return !!(a && b && a !== b);
}

/** 경보 줄 — 학생 화면에 떠 있는 정식 등록 공고 가운데 ① 파일 이름은 보이는데 받을 주소를 못 구한 것 ② 원문 화면을 세 번 열지 못해 확인하지 못한 것.
    notYet 은 아직 한 번도 안 살핀 공고 수(경보가 아니라 진행 상황). items 는 registered.items · ledger 열쇠는 canonUrl(sourceUrl) */
export function attachmentAlarms(items, ledger, today, now = new Date()) {
  const rows = [];
  let notYet = 0, checked = 0;
  for (const it of items || []) {
    const url = String((it && it.sourceUrl) || '');
    if (!it || it.program || !/^https?:\/\//.test(url) || url.includes('#n-') || closedForStudents(it, today, now)) continue;
    const led = (ledger || {})[canonUrl(url)];
    if (!led || !led.att) {
      notYet += 1;
      if (led && (led.attTries || 0) >= 3) rows.push({ id: it.id, name: it.name, url, why: `원문 화면을 ${led.attTries}번 열지 못해 첨부를 확인하지 못했습니다` });
      continue;
    }
    checked += 1;
    if ((led.attGap || 0) > 0) rows.push({ id: it.id, name: it.name, url, why: `화면엔 파일 ${led.attSeen}개 · 그중 ${led.attGap}개는 받을 주소를 못 구해 이름만 보입니다` });
  }
  return { rows, notYet, checked };
}

/** 실시간 피드의 학교별 첨부 현황 — 글이 min 개 이상인데 첨부 있는 글이 다섯에 하나도 안 되는 학교(수집 단계가 그 게시판의 첨부를 못 보는 표시).
    경보가 아니라 진단 표다(피드 카드는 첨부 개수만 보이고, 정식 등록되면 위 살피기가 채운다) */
export function feedAttachmentGaps(notices, min = 8) {
  const by = new Map();
  for (const n of notices || []) {
    const s = (n && n.school) || '';
    if (!s) continue;
    const c = by.get(s) || by.set(s, { school: s, total: 0, withAtt: 0 }).get(s);
    c.total += 1;
    if ((n.attachments || []).length) c.withAtt += 1;
  }
  return [...by.values()].filter((c) => c.total >= min && c.withAtt / c.total < 0.2).sort((a, b) => (a.withAtt / a.total) - (b.withAtt / b.total) || b.total - a.total);
}
