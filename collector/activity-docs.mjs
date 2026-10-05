/* ============================================================
   대외활동·공모전 — 본문에 자격이 없는 글의 첨부·포스터 읽기 (2026-10-03 개발자 지시)
   *"자격 읽기 파이프라인을 만들되 실행되는건 나중에 api 잔액 채우고 딸깍 하면 실행하는걸로.
     그리고 자동화 무료로 최대한 땜빵쳐보자"*

   왜 — 본문에 자격이 없는 활동 글은 대개 **포스터 그림 한 장**이거나 **첨부 공고문(HWP·PDF)** 에만 자격이 있다
   (2026-10-03 실측: 자격 0줄 103건 중 본문 그림 있는 것 ~60 · 공고문 첨부 13).
   새 규칙을 만들지 않는다 — 장학 쪽에 이미 있는 것을 그대로 부른다:
     · 글자 뽑기  attachment-text.mjs attachmentText (HWPX·DOCX 는 여기서, HWP 는 hwp-bodytext.py, 포스터 그림은 paddle-ocr.py 의 .ocr.txt)
     · 자격 고르기 activity-excerpts.mjs activityDetails (본문과 같은 규칙)
     · AI         eligibility-ai.mjs askPdf·ask + verifyPdfLines·verifyPick (지어냄을 막는 같은 관문)

   세 단계:
     ① --fetch  (무료) 자격 0줄인 글의 첨부·본문 그림을 collector/act-files/ 에 받는다
                뒤이어 워크플로가 hwp-bodytext.py · paddle-ocr.py(포스터 — tesseract 보다 디자인 글씨를 잘 읽는다)를 **그 폴더에** 돌린다
     ② --apply  (무료) 받은 파일의 글자로 자격을 고른다. 출처 eligibilityFrom '공고문 첨부'·'공고문 첨부(OCR)'
     ③ --ai     (유료 · 기본 꺼짐) ①②로도 못 읽은 글을 AI 에게 — eligibility-ai-config.json enabled 또는 ELIG_AI_ENABLE=1
                일 때만 돌고 --write 를 붙여야 저장한다. 버튼: 「자격요건 매칭 · AI 자격 읽기」(전부·대외활동만).
   🔴 받은 파일은 **커밋하지 않는다**(act-files 는 .gitignore) — 포스터가 글 15건에 8MB 였다(첫 실측). ①②는 한 실행 안에서 끝나고,
      ③은 필요한 파일을 그 자리에서 다시 받는다. 커밋하는 것은 '이미 해 봤다' 장부(act-docs.json)뿐이다.
   🔴 본문에서 자격이 나오면 본문이 이긴다 — 수집 로봇이 다시 읽을 때 putActivityDetails 가 정한다.
   ④ --browser (2026-10-04 개발자 지시 "진짜 브라우저로 열어야 되는 공고는 다 자격요건 로봇으로") — ①②를 **진짜 크롬으로 그린 페이지**로.
      자격요건 로봇(rescue-bodies.yml)만 이 모드로 돌린다(수집 로봇과 따로 · 겹치지 않게). 무료 모드로 이미 해 보고도 못 읽은 글만 맡는다.
      🔴 data/activities.json 은 **쓰지 않는다** — 수집 로봇·공공 API 로봇이 이미 쓰는 파일이라 셋이 쓰면 push 가 부딪힌다.
         결과는 자기 장부(collector/act-browser.json)에만 적고, 수집 로봇의 --apply 가 다음 실행에 합친다.
      규칙(고르기·남의 글 막기·첨부·요강 페이지)은 무료 모드와 **한 벌** — 페이지를 받는 방법(getHtml)만 바꿔 끼운다.
   🔴 학생 화면에는 출처 표식을 안 낸다(2026-09-17 결정 — 공정 이야기는 관리자 몫). 데이터에만 남긴다.
   관문: verify/test-collector.mjs 「대외활동·공모전 — 첨부·포스터 읽기」
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FETCH_HEADERS } from './http-headers.mjs';
import { htmlToLines } from './html-text.mjs';
import { attachmentText, isOcrSource, isNoticeDoc } from './attachment-text.mjs';
import { activityDetails, eligLineOk } from './activity-excerpts.mjs';

const HERE = new URL('.', import.meta.url);
const ACTS = fileURLToPath(new URL('../data/activities.json', HERE));
const DIR = fileURLToPath(new URL('act-files/', HERE));          // 일회용 — .gitignore
const MANIFEST = path.join(DIR, 'manifest.json');                // 이번 실행이 받은 파일 { 주소: [파일] }
const BROWSER = process.argv.includes('--browser');
const PLAIN_LEDGER = fileURLToPath(new URL('act-docs.json', HERE));       // 수집 로봇(무료 모드)의 장부 — { 주소: { at, tries } }
const BROWSER_LEDGER = fileURLToPath(new URL('act-browser.json', HERE));  // 자격요건 로봇(브라우저 모드)의 장부 + 결과
const LEDGER = BROWSER ? BROWSER_LEDGER : PLAIN_LEDGER;                   // 커밋 — 모드마다 제 장부만 쓴다(두 로봇이 같은 파일을 안 쓴다)
const log = (m) => console.log(`[activity-docs] ${m}`);

const POSTS_PER_RUN = Number(process.env.ACT_DOCS_POSTS || 15);   // 한 실행에 받는 글
const FILES_PER_POST = 3;          // 글 하나에서 받는 파일
const MAX_BYTES = 8 * 1024 * 1024; // 파일 하나 (AI 그림 한계 10MB 아래)
const MIN_IMG_BYTES = 40 * 1024;   // 이보다 작은 그림은 아이콘·버튼이다(포스터는 수백 KB)
const BUDGET_MS = Number(process.env.ACT_DOCS_BUDGET_MS || 80000);   // 이 단계 스스로의 예산(워크플로 단계 상한 아래)
const MAX_TRIES = 2;               // 무료로 해 볼 횟수 — 이레 간격(OCR 이 시간에 밀렸을 수 있다)
const RETRY_DAYS = 7;

const DOC_EXT = /\.(hwpx?|docx|pdf|png|jpe?g|webp)(?:[?#]|$)/i;
const IMG_EXT = /\.(png|jpe?g|webp)(?:[?#]|$)/i;
const AI_FILE = /\.(pdf|png|jpe?g|webp)$/i;
/* 학생이 채우는 서식은 자격이 아니다(attachment-text.mjs 첫머리 — 동의서 문구가 자격 자리에 앉은 사고) */
const FORMISH = /서식|양식|신청서|지원서|동의서|서약서|추천서|계획서|이력서|확인서/;
/* 사이트 꾸밈 그림 — 이름으로 거르고 크기(MIN_IMG_BYTES)로 한 번 더 거른다 */
const CHROME_IMG = /logo|icon|ico_|btn|button|banner|bnr|common|header|footer|gnb|lnb|sns|share|blank|spacer|arrow|bullet|top_|quick|kakao|facebook|insta|youtube|naver|qr/i;

export const keyOf = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 12);
const fileHash = (p) => { try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16); } catch { return ''; } };
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const flatK = (x) => String(x || '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/[^가-힣A-Za-z0-9]/g, '');
/** 이 줄이 글 제목(또는 제목을 품은 머리줄)인가 */
export const isTitleLine = (line, title) => { const k = flatK(title).slice(0, 12); return k.length >= 6 && flatK(line).includes(k); };
export const needsElig = (n) => !n.hidden && !(n.eligibilityLines && n.eligibilityLines.length);

/** 받을 후보 — 첨부(공고문·포스터) 먼저, 그다음 본문 그림. 서식·꾸밈 그림은 뺀다. */
/** 글 제목이 HTML 에 마지막으로 나온 자리부터 (없으면 전체) — activity-excerpts.mjs atTitle 과 같은 생각 */
export function afterTitle(html, title) {
  const key = String(title || '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim().slice(0, 10);
  if (key.length < 5) return html;
  const at = html.lastIndexOf(key);
  return at < 0 ? html : html.slice(at);
}

/** 그림의 가로·세로 (PNG·JPEG 머리만 읽는다 — 다른 꼴은 null) */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const mk = buf[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}
/* 포스터·공고문 캡처는 세로로 길거나 정사각에 가깝다. 가로로 넓은 그림은 배너다(첫 실측: 846×510 체육대회 광고) */
/* 🔴 큰 그림(가로 1200px 이상)은 가로로 넓어도 받는다 — 예술위 카드뉴스가 1920×1080 슬라이드였다(2026-10-04 표본). 광고 배너는 그보다 작다(846×510) */
export const posterShaped = (sz) => !sz || sz.h >= sz.w * 0.9 || sz.w >= 1200;

export function candidateFiles(n, html, pageUrl) {
  const out = [];
  for (const a of n.attachments || []) {
    const name = String(a.name || '');
    if (FORMISH.test(name)) continue;
    if (!(DOC_EXT.test(name) || DOC_EXT.test(a.url || ''))) continue;
    if (!(isNoticeDoc(name) || IMG_EXT.test(name) || /포스터|요강|안내문|공고문|리플렛|홍보물/.test(name))) continue;
    out.push({ url: a.url, name, from: 'attach' });
  }
  /* 🔴 본문 그림은 **글 제목 뒤**에서만 — 앞쪽은 사이트 머리·메뉴 그림이다(첫 실측: 인증서·광고 배너가 받아졌다) */
  const body = afterTitle(String(html || ''), n.title);
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (CHROME_IMG.test(m[0])) continue;
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, '&'), pageUrl).href; } catch { continue; }
    if (CHROME_IMG.test(u)) continue;
    /* 페이지에 직접 박힌 그림(`data:image/png;base64,…`)도 받는다 — 감사원 공모 팝업의 포스터가 그 꼴이었다(2026-10-04 표본) */
    if (/^data:/.test(u) && !/^data:image\/(?:png|jpe?g|webp);base64,/i.test(u)) continue;
    out.push({ url: u, name: '', from: 'img' });
  }
  const seen = new Set();
  return out.filter((f) => f.url && !seen.has(f.url) && seen.add(f.url));
}

const extOf = (f, type) => {
  const m = (f.name.match(DOC_EXT) || f.url.match(DOC_EXT) || [])[1];
  if (m) return m.toLowerCase().replace('jpeg', 'jpg');
  for (const [re, e] of [[/pdf/, 'pdf'], [/png/, 'png'], [/jpe?g/, 'jpg'], [/webp/, 'webp'], [/hwp/, 'hwp']]) if (re.test(type)) return e;
  return null;
};

async function download(f, referer) {
  if (/^data:image\//i.test(f.url)) {
    const m = f.url.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!m) return null;
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length < MIN_IMG_BYTES || buf.length > MAX_BYTES || !posterShaped(imageSize(buf))) return null;
    return { buf, ext: m[1].toLowerCase().replace('jpeg', 'jpg'), hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) };
  }
  const res = await fetch(f.url, { redirect: 'follow', headers: { ...FETCH_HEADERS, Referer: referer }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) return null;
  const type = res.headers.get('content-type') || '';
  if (/text\/html/.test(type)) return null;                 // 로그인 화면·오류 화면
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extOf(f, type);
  if (!ext || buf.length > MAX_BYTES) return null;
  if (f.from === 'img' && (buf.length < MIN_IMG_BYTES || !posterShaped(imageSize(buf)))) return null;
  return { buf, ext, hash: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) };
}

/* ── 페이지 받는 방법 — 여기만 갈아 끼운다(무료: fetch · 브라우저: 진짜 크롬) ── */
async function plainHtml(url, referer) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: referer ? { ...FETCH_HEADERS, Referer: referer } : FETCH_HEADERS, signal: AbortSignal.timeout(15000) });
    if (!r.ok || /pdf|image\/|octet-stream|zip|hwp/i.test(r.headers.get('content-type') || '')) return '';
    return await r.text();
  } catch { return ''; }
}
let getHtml = plainHtml;

/* 진짜 크롬 — 자격요건 로봇 전용. 🔴 시간 초과 대비(collector/rescue-bodies.mjs 에서 배운 것을 그대로):
   ① 한 페이지에 절대 시한(PAGE_MS) — goto 가 돌아와도 프레임 읽기가 멈출 수 있다 ② 팝업을 치운다(동국대: 팝업이 본문을 가렸다)
   ③ 프레임 안까지 읽는다 ④ 브라우저가 죽으면 한 번 다시 띄운다 ⑤ 페이지는 반드시 닫는다 */
const PAGE_MS = 45000;
let browser = null, bctx = null;
async function openBrowser() {
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  bctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', locale: 'ko-KR' });
}
async function browserHtml(url) {
  if (!browser || !browser.isConnected()) { try { await openBrowser(); } catch (e) { log(`브라우저를 못 띄움: ${String(e.message).slice(0, 120)}`); return ''; } }
  const page = await bctx.newPage();
  const work = (async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);                      // 자바스크립트가 본문을 그릴 시간
    for (const label of ['오늘 하루 보지 않기', '오늘하루 열지 않기', '오늘 하루 열지 않기', '팝업 닫기', '닫기']) {
      try { const el = page.locator(`text=${label}`).first(); if (await el.count()) await el.evaluate((e) => e.click()); } catch { /* 없으면 그만 */ }
    }
    const parts = [];
    for (const f of page.frames()) { try { parts.push(await f.content()); } catch { /* 죽은 프레임은 건너뛴다 */ } }
    return parts.join('\n');
  })();
  try {
    return await Promise.race([work, new Promise((res) => setTimeout(() => res(''), PAGE_MS))]);
  } catch { return ''; } finally { page.close().catch(() => {}); }
}

/** 글 하나의 파일을 받는다 → act-files 안의 파일 이름들 */
async function fetchPost(n, until, common = new Set(), owners = new Map()) {
  const html = await getHtml(n.url);
  if (!html) return null;
  const got = [];
  const key = keyOf(n.url);
  /* 브라우저로 그린 본문은 `-B.txt` 로 — 일반 받기로는 글자 0 이던 자바스크립트 페이지의 본문이다 */
  if (BROWSER) { fs.writeFileSync(path.join(DIR, `${key}-B.txt`), htmlToLines(html)); got.push(`${key}-B.txt`); }
  /* 파일 이름 끝의 `i` = 페이지에서 주운 그림(그 글의 것인지 제목 낱말로 확인해야 한다) · 없으면 글에 붙은 첨부 */
  const save = async (list, referer) => {
    for (const f of list) {
      if (got.length >= FILES_PER_POST * 2 || Date.now() > until) break;
      try {
        const d = await download(f, referer);
        if (!d || common.has(d.hash)) continue;
        /* 🔴 **두 글 이상에 같은 그림 = 사이트 공통 그림**(인증서·로고) — 교내 소식 썸네일과 같은 규칙(news-thumb.mjs) */
        const owner = owners.get(d.hash);
        if (owner && owner !== n.url) { common.add(d.hash); continue; }
        owners.set(d.hash, n.url);
        const name = `${key}-${got.length}${f.from === 'img' ? 'i' : ''}.${d.ext}`;
        fs.writeFileSync(path.join(DIR, name), d.buf);
        got.push(name);
      } catch { /* 이 파일만 건너뛴다 */ }
    }
  };
  await save(candidateFiles(n, html, n.url).slice(0, FILES_PER_POST), n.url);
  /* ② 한 번 더 들어가기 — 공모전 홈페이지·팝업은 자격이 「대회 요강」·「모집 요강」 페이지에 있다(2026-10-03 실측 · 정책브리핑 글 22건).
     같은 사이트 안의, 이름이 요강·공고문·참가 안내인 링크만 두 개까지. 그 페이지 글자는 `-L0.txt` 로 남겨 같은 규칙으로 읽는다 */
  for (const [j, link] of guideLinks(html, n.url).slice(0, 2).entries()) {
    if (Date.now() > until) break;
    try {
      const h = await getHtml(link, n.url);
      if (!h) continue;
      const name = `${key}-L${j}.txt`;
      fs.writeFileSync(path.join(DIR, name), htmlToLines(h));
      got.push(name);
      await save(candidateFiles({ title: n.title, attachments: [] }, h, link).slice(0, 2), link);
    } catch { /* 이 링크만 건너뛴다 */ }
  }
  return got;
}

/* 요강으로 가는 링크 — 이름으로 고른다. 같은 사이트(호스트)만 · 파일·자바스크립트 링크는 뺀다 */
/* 🔴 이름이 분명한 것만 — `자세히 보기`·`모집 안내` 는 옆 목록의 **다른 사업**으로 갔다(스파로스 아카데미 → 「부산에 방문하는 청년」 · 2026-10-03 실측) */
const GUIDE = /요강|공고문|참가\s?안내|참여\s?안내|대회\s?개요|공모\s?개요/;
export function guideLinks(html, pageUrl) {
  let host = '';
  try { host = new URL(pageUrl).host; } catch { return []; }
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || ''))) !== null) {
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    /* 첨부 `미리보기`(게시판이 HWP·PDF 를 웹 페이지로 바꿔 보여 주는 주소) — 다운로드가 자바스크립트 버튼이라 첨부로 안 잡히는 게시판이 있다
       (국립국제교육원 TOPIK 워크숍 · 2026-10-04 표본). 🔴 바로 앞 파일 이름이 **공고문**일 때만 — 신청서·서식의 미리보기는 열지 않는다 */
    if (/^(?:미리\s?보기|바로\s?보기|문서\s?보기)$/.test(label)) {
      const before = String(html).slice(Math.max(0, m.index - 600), m.index).replace(/<[^>]+>/g, ' ');
      const files = before.match(/[^\s|]{0,60}?[^\s|]+\.(?:hwpx?|pdf|docx?)\b/gi) || [];
      const name = files[files.length - 1] || '';
      if (!name || FORMISH.test(name) || !/공고|요강|안내|모집/.test(name)) continue;
    } else if (!label || label.length > 30 || !GUIDE.test(label)) continue;
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, '&'), pageUrl); } catch { continue; }
    if (u.host !== host || /^javascript:/i.test(m[1]) || DOC_EXT.test(u.pathname) || u.href === pageUrl) continue;
    if (!out.includes(u.href)) out.push(u.href);
  }
  return out;
}

/** 무료로 다시 해 볼 차례인가 — 두 번까지, 이레 간격 */
export function dueFree(entry, today) {
  if (!entry) return true;
  if ((entry.tries || 0) >= MAX_TRIES) return false;
  return (Date.parse(today) - Date.parse(entry.at)) >= RETRY_DAYS * 86400000;
}

/* ── OCR 엔진이 고장 난 동안 깎인 무료 기회 (2026-10-04 점검 gaps-02) ──
   10-03·10-04 첫 클라우드 실행들은 PaddleOCR 이 모든 그림에서 같은 오류로 '0장'이었는데(판 고정 전) 장부는 그 시도를 한 번으로 셌다.
   글마다 두 번뿐인 기회(MAX_TRIES)라, 두 번째도 고장 난 엔진에 걸리면 그 글은 무료 경로에서 영영 빠진다. */
const LEDGER_V = 'paddle-pin-2026-10-04';   // 장부 판 — 바꾸면 다음 실행이 자격 못 찾은 칸을 한 번 비운다
/** 장부 판이 다르면 자격을 못 찾은 칸(lines 없음)을 한 번 비운다 — 비운 글은 다음 실행에 바로 다시 해 본다(dueFree(undefined)=true).
    `_` 로 시작하는 칸(_common 공통 그림 · _ocrV 판)은 남긴다. 몇 칸을 비웠는지 돌려준다. */
export function migrateOcrTries(ledger, v = LEDGER_V) {
  if (!ledger || ledger._ocrV === v) return 0;
  let n = 0;
  for (const k of Object.keys(ledger)) {
    if (k.startsWith('_') || (ledger[k] && ledger[k].lines)) continue;
    delete ledger[k];
    n += 1;
  }
  ledger._ocrV = v;
  return n;
}
/** 이번 실행의 OCR 이 실패한 파일(paddle-ocr.py 의 paddle-status.json failed) 때문에 자격을 못 찾은 글은 그 시도를 세지 않는다 —
    tries 를 1 되돌린다(날짜는 그대로 — 엔진이 계속 고장이면 매 실행 같은 글을 다시 받지 않게). 되돌린 주소 목록을 돌려준다. */
export function rollbackOcrTries(ledger, manifest, status, found = new Set()) {
  const failed = new Set((status && status.failed) || []);
  const back = [];
  if (!failed.size) return back;
  for (const [url, files] of Object.entries(manifest || {})) {
    if (found.has(url) || !(files || []).some((f) => failed.has(f))) continue;
    const e = ledger[url];
    if (!e || !(e.tries > 0)) continue;
    e.tries -= 1;
    back.push(url);
  }
  return back;
}
const PADDLE_STATUS = path.join(DIR, 'paddle-status.json');

/* ── ① 받기 ── */
async function fetchPhase(acts) {
  fs.mkdirSync(DIR, { recursive: true });
  const ledger = readJson(LEDGER, {});
  const cleared = migrateOcrTries(ledger);   // 엔진 고장 동안 깎인 기회 — 판이 바뀐 첫 실행에 한 번(위 머리말)
  if (cleared) log(`장부 판 갱신 — 자격 못 찾은 ${cleared}칸을 비워 다시 해 본다(OCR 엔진 고장 동안 깎인 기회)`);
  const manifest = readJson(MANIFEST, {});
  const plainTried = BROWSER ? readJson(PLAIN_LEDGER, {}) : {};
  const today = new Date().toISOString().slice(0, 10);
  const until = Date.now() + BUDGET_MS;
  const common = new Set(ledger._common || []);   // 공통 그림 서명 — 장부에 남겨 다음 실행도 안 받는다
  const owners = new Map();
  let posts = 0, files = 0;
  for (const n of acts.items) {
    if (posts >= POSTS_PER_RUN || Date.now() > until) break;
    if (!needsElig(n) || !dueFree(ledger[n.url], today)) continue;
    if (BROWSER && !plainTried[n.url]) continue;           // 무료 모드가 먼저 — 그래도 못 읽은 글만 브라우저로
    if (BROWSER && ledger[n.url] && ledger[n.url].lines) continue;   // 이미 찾아 장부에 적었다 — 수집 로봇이 합치기 전까지 다시 열지 않는다
    posts += 1;
    const got = await fetchPost(n, until, common, owners);
    if (got === null) continue;                              // 글을 못 받았다 — 장부에 안 적는다(잠깐 끊긴 것을 굳히지 않게)
    manifest[n.url] = got;
    ledger[n.url] = { ...(ledger[n.url] || {}), at: today, tries: ((ledger[n.url] || {}).tries || 0) + 1 };
    if (BROWSER) fs.writeFileSync(LEDGER, JSON.stringify({ ...ledger, _common: [...common].slice(-200) }, null, 1) + '\n');   // 글마다 저장 — 시간 초과로 끊겨도 해 본 것은 남는다
    files += got.length;
  }
  /* 피드에서 빠진 글은 장부에서도 뺀다 */
  const live = new Set(acts.items.map((n) => n.url));
  for (const u of Object.keys(ledger)) if (!u.startsWith('_') && !live.has(u)) delete ledger[u];   // `_` 칸(_common·_ocrV)은 장부 자체의 것
  /* 이번 실행에서 공통으로 드러난 그림은 먼저 받아 둔 글에서도 지운다 */
  for (const [h, u] of owners) if (common.has(h) && manifest[u]) manifest[u] = manifest[u].filter((f) => !f.startsWith(`${keyOf(u)}-`) || fileHash(path.join(DIR, f)) !== h);
  ledger._common = [...common].slice(-200);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
  fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1) + '\n');
  log(`받기 — 글 ${posts}건 · 파일 ${files}개`);
}

/* 글 제목의 낱말 — 흔한 말(모집·안내·청년·공모전…)은 뺀다. 그림이 **그 글의 포스터인지** 가리는 데 쓴다 */
const GENERIC_WORD = /^(?:모집|안내|공고|참가자|참여자|선발|신청|운영|프로그램|개최|지원|대상|기간|마감|일반|공통|공지|외부|학사|봉사|모집중|추가|하반기|상반기|공모전|참가|참여|교육|특강|청년|대학생|학생|사업|활동|행사|홍보|국제교류|10월|11월|12월)$/;
/* 🔴 대괄호 안도 낱말이다 — `[구리시 청년성장프로젝트] 10월 …` 의 고유한 이름이 거기 있다(통째로 버렸더니 그 포스터를 놓쳤다).
   `[일반]`·`[공통]` 같은 꼬리표는 GENERIC_WORD 가 거른다 */
export const titleWords = (title) => [...new Set(String(title || '').replace(/기간\s*:.*$/g, ' ')
  .split(/[^가-힣A-Za-z0-9]+/).filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !GENERIC_WORD.test(w)))];
/** OCR 로 읽은 그림이 이 글의 것인가 — 글 제목 낱말이 하나라도 그림 글자에 있어야 한다.
    🔴 사이트 옆 홍보물(「제주도 내 공공임대주택에 입주한 가구」)이 「청년 체인지메이커 아카데미」의 자격으로 붙을 뻔했다(2026-10-03 실측) */
export const ownsImageText = (text, title) => { const t = String(text || '').replace(/\s/g, ''); return titleWords(title).some((w) => t.includes(w)); };

/* 읽는 순서 — 요강 페이지 글자 → 원문 글자(HWP·HWPX·DOCX) → OCR(PDF·그림). 사람이 쓴 글자가 기계가 읽은 글자보다 먼저다 */
const RANK = (f) => (/-B\.txt$/.test(f) ? 0 : /\.txt$/.test(f) ? 1 : /\.(hwpx?|docx)$/i.test(f) ? 2 : 3);   // 브라우저 본문 → 요강 페이지 → HWP·DOCX → OCR
export const fileOrder = (files) => [...(files || [])].sort((a, b) => RANK(a) - RANK(b));
/** 받은 파일 글자에서 자격을 고른다 — 규칙은 본문과 같은 activityDetails 하나 */
export function eligFromFiles(n, files, readText = (p) => (/\.txt$/.test(p) ? fs.readFileSync(p, 'utf8') : attachmentText(p)), dir = DIR, isOcr = isOcrSource) {
  for (const f of fileOrder(files)) {
    const p = path.join(dir, f);
    let text = '';
    try { text = readText(p); } catch { continue; }
    if (!text || !text.trim()) continue;
    const ocr = !/\.txt$/.test(f) && isOcr(p);
    /* 페이지에서 주운 그림(이름 끝 `i`)과 따라간 요강 페이지(`-L0.txt`)는 그 글의 것인지 본다 — 글에 붙은 첨부는 그 글의 것이다.
       🔴 따라간 페이지가 재단의 다른 장학금 안내였던 적이 있다(장학수기 공모전 심사 결과 → 「성적우수 장학금 (대학교 2학년 이상)」) */
    /* 브라우저 본문(`-B.txt`)도 같다 — 글 주소가 포털 첫 화면으로 가서 1,409줄에 제목이 한 번도 없었다(제주도청 · 메뉴 `장애인 복지정책` 이 자격으로 뽑혔다) */
    if ((/-[LB]\d*\.txt$/.test(f) || (ocr && /\di\.\w+$/.test(f))) && !ownsImageText(text, n.title)) continue;
    const d = activityDetails(text, n.title);
    if (d.eligibilityLines.length) return { ...d, from: /-B\.txt$/.test(f) ? '브라우저 본문' : /\.txt$/.test(f) ? '요강 페이지' : ocr ? '공고문 첨부(OCR)' : '공고문 첨부' };
  }
  return null;
}

/* ── ② 읽기 ── */
function applyPhase(acts) {
  const manifest = readJson(MANIFEST, {});
  let got = 0;
  /* 브라우저 모드는 결과를 제 장부에만 — data/activities.json 은 수집 로봇 몫(위 ④) */
  const bled = BROWSER ? readJson(BROWSER_LEDGER, {}) : null;
  const found = new Set();
  for (const n of acts.items) {
    const files = manifest[n.url];
    if (!files || !files.length || !needsElig(n)) continue;
    const d = eligFromFiles(n, files);
    if (!d) continue;
    found.add(n.url);
    if (BROWSER) { bled[n.url] = { ...(bled[n.url] || {}), lines: d.eligibilityLines, excludes: d.eligibilityExcludes, from: d.from }; got += 1; continue; }
    n.eligibilityLines = d.eligibilityLines;
    if (d.eligibilityExcludes.length) n.eligibilityExcludes = d.eligibilityExcludes;
    n.eligibilityFrom = d.from;
    got += 1;
  }
  /* OCR 이 실패한 파일 때문에 못 읽은 글은 그 시도를 세지 않는다(위 rollbackOcrTries) — 같은 결과로 두 번 되돌리지 않게 표시해 둔다 */
  const status = readJson(PADDLE_STATUS, null);
  if (status && !status.applied) {
    const led = BROWSER ? bled : readJson(PLAIN_LEDGER, {});
    const back = rollbackOcrTries(led, manifest, status, found);
    if (back.length) {
      log(`OCR 이 실패한 파일 때문에 못 읽은 글 ${back.length}건 — 무료 기회를 되돌림${status.engineFailed ? ' (엔진 고장)' : ''}`);
      if (!BROWSER) fs.writeFileSync(PLAIN_LEDGER, JSON.stringify(led, null, 1) + '\n');
    }
    fs.writeFileSync(PADDLE_STATUS, JSON.stringify({ ...status, applied: true }, null, 1));
  }
  if (BROWSER) fs.writeFileSync(BROWSER_LEDGER, JSON.stringify(bled, null, 1) + '\n');
  else got += mergeBrowserResults(acts);
  log(`읽기 — ${BROWSER ? '브라우저로 ' : '첨부·포스터에서 '}자격 ${got}건`);
  return got;
}

/** 자격요건 로봇이 장부에 적어 둔 결과를 활동 글에 합친다 — 수집 로봇(무료 모드 --apply)만 부른다. 아직 자격이 없는 글에만.
    장부에 이미 적힌 옛 줄도 지금 거름(activity-excerpts.mjs eligLineOk — 여러 갈래 나이·개인정보 안내문)을 지나야 한다 —
    안 그러면 발행이 걷은 줄을 다음 실행이 장부에서 다시 붙여 자격 칸이 비었다 찼다 한다. 남는 줄이 없으면 합치지 않는다 (2026-10-05 점검 api-06) */
export function mergeBrowserResults(acts, bled = readJson(BROWSER_LEDGER, {})) {
  let got = 0;
  for (const n of acts.items) {
    const r = bled[n.url];
    const lines = ((r && r.lines) || []).filter(eligLineOk);
    if (!lines.length || !needsElig(n)) continue;
    n.eligibilityLines = lines;
    const excludes = (r.excludes || []).filter(eligLineOk);
    if (excludes.length) n.eligibilityExcludes = excludes;
    n.eligibilityFrom = r.from;
    got += 1;
  }
  return got;
}

/* ── ③ AI (유료 · 기본 꺼짐) ── */
async function aiPhase(acts, write) {
  process.env.ELIG_AI_AS_LIB = '1';      // 본편(장학 등록분 처리)은 건너뛰고 함수만 쓴다
  const AI = await import('./eligibility-ai.mjs');
  const cfg = readJson(fileURLToPath(new URL('eligibility-ai-config.json', HERE)), {});
  const targets = acts.items.filter((n) => needsElig(n) && (n.aiTries || 0) < (cfg.giveUpAfter ?? 3));
  log(`AI 대상 ${targets.length}건 (자격 0줄 · 무료로 못 읽은 것)`);
  const on = cfg.enabled || process.env.ELIG_AI_ENABLE === '1';
  if (!on) { log('꺼져 있음 (eligibility-ai-config.json enabled · 버튼은 ELIG_AI_ENABLE=1) — 부르지 않는다'); return 0; }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ELIG_AI_FAKE) { log('API 열쇠 없음 — 부르지 않는다'); return 0; }
  if (!write) { log('미리보기 — --write 를 붙여야 부르고 저장한다'); return 0; }

  fs.mkdirSync(DIR, { recursive: true });
  /* 공통 그림(인증서·로고)은 AI 에도 안 보낸다 — 무료 단계가 장부에 남긴 서명 + 이 실행에서 드러난 것(돈이 나가는 자리) */
  const common = new Set(readJson(LEDGER, {})._common || []);
  const owners = new Map();
  const cap = Number(process.env.ACT_AI_MAX || 40);
  let calls = 0, got = 0;
  for (const n of targets) {
    if (calls >= cap) { log(`이번 실행 한도(${cap}건) — 나머지는 다음에`); break; }
    const item = { name: n.title };
    let v = null, from = '';
    try {
      const files = (await fetchPost(n, Date.now() + 60000, common, owners)) || [];
      const file = files.find((f) => AI_FILE.test(f));
      if (file) {
        const kind = /\.pdf$/i.test(file) ? 'pdf' : 'image';
        calls += 1;
        v = AI.verifyPdfLines(await AI.askPdf(item, path.join(DIR, file), kind));
        from = kind === 'image' ? 'AI(공고 포스터 그림)' : 'AI(공고문 PDF)';
      } else {
        const r = await fetch(n.url, { redirect: 'follow', headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) });
        const lines = r.ok ? htmlToLines(await r.text()).split('\n').map((l) => l.trim()).filter((l) => l.length >= 2 && l.length <= 200) : [];
        if (!lines.length) continue;
        calls += 1;
        v = AI.verifyPick(await AI.ask(item, lines), lines);
        from = 'AI(원문 줄 그대로)';
      }
    } catch (e) { log(`✕ ${n.title.slice(0, 30)} — 호출 실패(글 탓 아님): ${String(e && e.message || e).slice(0, 300)}`); continue; }
    /* 🔴 글 제목 줄은 자격이 아니다 — 관문의 '청년' 신호를 제목(`용산 청년지음 … 참여자 모집`)이 통과했다(가짜 응답 시험) */
    if (v && v.ok) { v.lines = v.lines.filter((l) => !isTitleLine(l, n.title)); if (!v.lines.length) v = { ok: false, why: '고른 줄이 글 제목뿐' }; }
    if (!v || !v.ok) { n.aiTries = (n.aiTries || 0) + 1; log(`· ${n.title.slice(0, 30)} — ${v ? v.why : '응답 없음'}`); continue; }
    n.eligibilityLines = v.lines;
    if (v.excludes && v.excludes.length) n.eligibilityExcludes = v.excludes;
    n.eligibilityFrom = from;
    n.eligibilityReviewed = false;
    delete n.aiTries;
    got += 1;
    log(`✓ ${n.title.slice(0, 30)} — ${from} ${v.lines.length}줄`);
  }
  log(`AI 끝 — 호출 ${calls}회 · 확보 ${got}건`);
  return got + targets.filter((n) => n.aiTries).length;   // aiTries 가 바뀐 것도 저장한다
}

/* ── 본편 ── */
if (!process.env.ACTIVITY_DOCS_AS_LIB) {
  const acts = readJson(ACTS, null);
  if (!acts || !Array.isArray(acts.items)) { log('data/activities.json 없음 — 건너뜀'); process.exit(0); }
  const arg = (a) => process.argv.includes(a);
  let changed = false;
  if (BROWSER) {
    getHtml = browserHtml;
    /* 넘어져도 장부는 남긴다(글마다 이미 저장) · 브라우저는 반드시 닫는다 */
    const bye = () => { try { if (browser) browser.close(); } catch { /* 이미 닫힘 */ } };
    process.on('uncaughtException', (e) => { log(`넘어짐: ${String(e && e.message || e).slice(0, 200)}`); bye(); process.exit(1); });
  }
  if (arg('--fetch')) await fetchPhase(acts);
  if (browser) await browser.close().catch(() => {});
  if (arg('--apply')) changed = applyPhase(acts) > 0 || changed;
  if (arg('--ai')) changed = (await aiPhase(acts, arg('--write'))) > 0 || changed;
  /* 저장 형식은 수집 로봇과 같다(collect.mjs — JSON.stringify(x, null, 1)) — 다르면 파일 전체가 바뀐 것으로 보인다.
     🔴 브라우저 모드는 activities.json 을 쓰지 않는다(위 ④) */
  if (changed && !BROWSER) fs.writeFileSync(ACTS, JSON.stringify(acts, null, 1));
  log(`자격 0줄인 활동 글 ${acts.items.filter(needsElig).length}건 남음 (전체 ${acts.items.length})`);
}
