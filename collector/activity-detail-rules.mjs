/* ============================================================
   활동 글 상세 규칙 — 본문이 스크립트로 그려지는 게시판의 **숨은 글 주소** (2026-10-28 · 개발자 "출처는 그대로 두되 최대한 공짜 경로로")
   ------------------------------------------------------------
   온통청년(youthcenter.go.kr) 게시판 글은 평문으로 받으면 메뉴뿐이다(한글 1,003자 · 글마다 똑같다). 화면은 글 번호로 JSON 을 따로 받아 그린다:
     · 글      GET /sur/cmu/bbs/pst/<bbsSn>/<pstSn>?pstExpsrYn=Y&isMaskingYn=Y        → result.bbs.pstWholCn(본문 HTML) · pstAtchFileMngSn · pstRprsImgSn
     · 첨부·그림 GET /sur/com/atchFile/atchFileDet?atchFileMngSn=<sn>&useYn=Y&isMaskingYn=Y → atchFileDetList[].atchFilePath/atchFileNm/atchFileExtnNm · imgSubTextCn
     · 그림    GET /image?imageName=<atchFilePath>/<atchFileNm>.<ext>
   🔴 JSON 은 그 페이지를 먼저 열어 받은 **쿠키(XSRF-TOKEN 등)** 를 들고 불러야 열린다(없으면 401 · 2026-10-27 실측). 그림은 쿠키 없이도 열린다.
   🔴 `imgSubTextCn` 은 사이트가 포스터마다 적어 둔 **대체 글**(접근성 문구)이다 — 포스터의 글자(모집 대상·기간·문의)를 사람이 옮겨 적은 것이라
      OCR 보다 정확하고 돈이 안 든다. 본문 뒤에 그대로 잇는다(원문 발췌 원칙 8-1 · 지어내지 않는다).
   수집 로봇(collect.mjs fetchDetail)과 첨부 로봇(activity-docs.mjs fetchPost)이 **같은 함수** detailByRule 을 먼저 부른다 — 규칙이 없는 주소는 null.
   관문: verify/test-collector.mjs 「공고 카드 품질」 ⑭-4.
   ============================================================ */
import { FETCH_HEADERS } from './http-headers.mjs';
import { htmlToLines } from './html-text.mjs';

const YOUTHCENTER = /^https?:\/\/(?:www\.)?youthcenter\.go\.kr\/bbs\d+View\/(\d+)\/(\d+)/i;

/** 규칙이 있는 주소인가 — 호출 전에 싸게 묻는 용도 */
export const hasDetailRule = (url) => YOUTHCENTER.test(String(url || ''));

/** 페이지를 열어 Set-Cookie 를 한 줄로 */
async function cookieOf(pageUrl, fetchImpl) {
  const r = await fetchImpl(pageUrl, { headers: FETCH_HEADERS, redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const list = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
  return list.map((c) => c.split(';')[0]).join('; ');
}

async function getJson(url, pageUrl, cookie, fetchImpl) {
  const r = await fetchImpl(url, { headers: { ...FETCH_HEADERS, Cookie: cookie, Referer: pageUrl, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}

/* 온통청년 글 하나 — 본문 글자 + 포스터 대체 글 + 그림·첨부 */
async function youthcenter(url, m, fetchImpl) {
  const origin = 'https://www.youthcenter.go.kr';
  const cookie = await cookieOf(url, fetchImpl);
  const post = await getJson(`${origin}/sur/cmu/bbs/pst/${m[1]}/${m[2]}?pstExpsrYn=Y&isMaskingYn=Y`, url, cookie, fetchImpl);
  const bbs = post && post.result && post.result.bbs;
  if (!bbs) return null;
  const lines = [String(bbs.pstTtl || '').trim(), String(htmlToLines(bbs.pstWholCn || ''))].filter(Boolean);
  const images = [], attachments = [];
  for (const sn of [...new Set([bbs.pstRprsImgSn, bbs.pstAtchFileMngSn].filter((x) => x && String(x) !== '0'))]) {
    const det = await getJson(`${origin}/sur/com/atchFile/atchFileDet?atchFileMngSn=${sn}&useYn=Y&isMaskingYn=Y`, url, cookie, fetchImpl);
    for (const f of (det && det.result && det.result.atchFileDetList) || []) {
      const ext = String(f.atchFileExtnNm || '').toLowerCase();
      const name = `${f.exsFileNm || f.atchFileNm || sn}.${ext}`;
      if (/^(?:png|jpe?g|webp|gif)$/.test(ext)) images.push({ url: `${origin}/image?imageName=${f.atchFilePath}/${f.atchFileNm}.${ext}`, name });
      else if (ext) attachments.push({ name, url: `${origin}/sur/com/atchFile/download?atchFileMngSn=${sn}&atchFileSn=${f.atchFileSn || ''}` });
      /* 포스터 대체 글 — 그 그림의 글자를 사이트가 적어 둔 것. 그림마다 한 토막씩, 원문 그대로 */
      const alt = String(f.imgSubTextCn || '').trim();
      if (alt) lines.push(`[포스터 글 · ${name}]`, alt);
    }
  }
  return { text: lines.join('\n'), images, attachments, via: 'youthcenter-json' };
}

/**
 * 규칙으로 상세를 받는다 — 규칙이 없는 주소면 null(그러면 부른 쪽이 예전처럼 HTML 을 받는다).
 * @returns {Promise<null | { text: string, images: {url,name}[], attachments: {name,url}[], via: string }>}
 */
export async function detailByRule(url, fetchImpl = fetch) {
  const m = String(url || '').match(YOUTHCENTER);
  if (!m) return null;
  try { return await youthcenter(url, m, fetchImpl); } catch { return null; }
}
