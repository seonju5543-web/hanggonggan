/* ============================================================
   교내 소식 썸네일 — 사진 고르기·확인·이름 규칙 **한 곳** (2026-10-03 개발자 지시
   "실제 뉴스의 사진을 첨부해와서 해당 사진을 썸네일로 쓸 수 있도록 해").

   이 파일은 **순수 함수만** 둔다(받기·줄이기·쓰기는 collect-news-thumbs.mjs). 관문이 인터넷 없이 부를 수 있게.

   어디서 사진을 찾나 — 글의 상세 화면(또는 규칙의 본문 API)에서 차례로:
     ① 대표 이미지(og:image · twitter:image) — 학교 CMS 가 글마다 정하는 사진. 단 **사이트 공통 그림**(로고·공유용 기본 그림)은 뺀다
     ② 본문 사진(<img>) — 머리·메뉴·바닥(header·nav·footer·aside)을 걷어 낸 본문의 그림만
     ③ 첨부 그림(포스터.jpg 같은 링크) — 본문에 안 넣고 파일로만 붙인 포스터
   🔴 고른 그림이 진짜 사진인지는 **받아서** 본다(sniffImage): 그림 파일 서명 · 가로 160 · 세로 100 이상 · 가로세로 3배 이내.
      아이콘·글머리표·띠 배너는 여기서 떨어진다.
   🔴 **여러 글에 똑같이 나오는 그림은 그 학교의 공통 그림이다**(로고·배너·기본 공유 그림) — 수집 로봇이 학교마다 그림 주소를
      세어(장부 srcSeen) 두 글 이상에서 본 것은 막는다(repeatedSrcs). 이름 낱말(logo 등)은 거들 뿐 그것만 믿지 않는다.
   ============================================================ */
import { createHash } from 'node:crypto';
import { urlKey } from './url-key.mjs';

/* 썸네일 파일 — data/news/ 아래라 소식 로봇·관리자 저장 경로의 `git add data/news` 와 감사 실패 되돌리기에 같이 묶인다.
   이름은 **줄인 그림 바이트의 해시**다 — 서비스워커가 그림을 캐시 우선으로 영영 들고 있으므로(sw.js) 같은 이름에 다른 그림을 쓰면
   설치된 앱은 옛 그림을 계속 보여 준다. 해시 이름은 다시 쓰이지 않고, 두 브랜치가 같은 그림을 만들면 같은 이름이라 병합도 충돌하지 않는다. */
export const THUMB_DIR = 'data/news/img';
export const THUMB_RE = /^data\/news\/img\/[0-9a-f]{16}\.webp$/;
export const thumbName = (buf) => `${THUMB_DIR}/${createHash('sha1').update(buf).digest('hex').slice(0, 16)}.webp`;
export const THUMB_SIDE = 240;              // 정사각 240px — 카드의 72px 칸을 화면 밀도 3배까지 또렷하게
export const THUMB_MAX_BYTES = 60 * 1024;   // 감사가 넘으면 막는다 (WebP 240px 는 보통 10~25KB)
export const IMG_MAX_BYTES = 8 * 1024 * 1024;
export const MIN_W = 160;
export const MIN_H = 100;
export const MAX_RATIO = 3;

/* 장부 열쇠 — 새 글 판정과 같은 열쇠(글 번호가 있으면 글 번호 · 없으면 주소). 같은 제목의 다른 글(목록 표식 주소가 같다)이 사진을 나눠 갖지 않게 */
export const thumbKey = (n) => (n && n.postId ? `post:${n.school}:${n.postId}` : `url:${urlKey(n && n.url)}`);

const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'", '#34': '"', '#38': '&' };
/* 엔티티 풀기 — 범위 밖 숫자(&#99999999;)는 글자 그대로 둔다(리뷰 12차: fromCodePoint 가 던져 글 하나의 후보가 통째로 사라졌다) */
const decode = (s) => String(s || '').replace(/&(amp|quot|apos|lt|gt|nbsp|#39|#34|#38);/gi, (m, k) => ENT[k.toLowerCase()] ?? m)
  .replace(/&#(\d+);/g, (m, d) => { const n = Number(d); return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m; });
function attr(tag, name) {
  const m = String(tag).match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[1] ?? m[2] ?? m[3] ?? '').trim() : '';
}
/* 상대 주소를 글 화면 기준으로 펴고 http(s) 만 남긴다 (data:·javascript:·blob: 은 버린다).
   `;jsessionid=…` 는 뗀다 — 쿠키 없는 로봇에게 JSP 사이트가 요청마다 다른 세션 번호를 붙여, 같은 기본 그림이 글마다 다른 주소로 보여
   '여러 글에 같은 그림' 판정을 피해 갔다(리뷰 12차 · 모든 글이 학교 로고를 썸네일로 받았다). */
export function absImg(u, base) {
  const s = String(u || '').trim();
  if (!s || /^(?:data|javascript|blob|about):/i.test(s)) return '';
  try { const x = new URL(s, base); return /^https?:$/.test(x.protocol) ? x.href.replace(/;jsessionid=[^?#/]*/gi, '') : ''; } catch { return ''; }
}

/* 그림 주소·이름표가 장식처럼 생겼나 — 로고·아이콘·단추·빈 그림·공유 단추. **거드는 신호**일 뿐(진짜 판정은 받아서 크기·여러 글 반복).
   🔴 **파일 이름**과 몇 개의 분명한 폴더 이름만 본다 — 학교 CMS 는 진짜 사진도 /file/·/attach/·/upload/ 아래 둔다(그 낱말로 막으면 본문 사진이 다 빠진다).
   🔴 '카카오·인스타·배너·기본' 같은 낱말 하나로 막지 않는다(리뷰 12차) — `KakaoTalk_20261002_….jpg` 는 카톡으로 받은 **진짜 사진**이고
      `…_festival_banner.jpg` 는 행사 포스터다. SNS 는 '단추·아이콘' 꼴(sns_kakao · kakao_icon)일 때만 장식이다. 띠 배너는 가로세로 비율이, 사이트 배너는 여러 글 반복이 잡는다. */
const CHROME_FILE = /(?:^|[_.\-])(?:logo|logos|emblem|symbol|icon|icons|ico|btn|button|bullet|arrow|blank|spacer|loading|loader|spinner|favicon|noimg|noimage|no_image|no-image|og_?default|ogimage|default_?(?:img|image|og|thumb)|(?:img|image|thumb)_?default)(?:[_.\-0-9]|$)/i;
const SNS_FILE = /(?:^|[_.\-])(?:(?:sns|share)[_\-]?(?:kakao\w*|facebook|fb|twitter|tw|insta\w*|youtube|naver|blog|band|link|url|copy)|(?:kakao|kakaotalk|kakaostory|facebook|fb|twitter|instagram|insta|youtube|naver|band|blog)[_\-]?(?:ico|icon|btn|logo|share|sns))(?:[_.\-0-9]|$)/i;
const CHROME_DIR = /\/(?:logo|logos|icon|icons|ico|btn|button|banner|banners|bnr|sns|emoticon|emoji)\//i;
export function looksChrome(src, alt = '', cls = '') {
  let path = '';
  try { path = new URL(String(src)).pathname; } catch { path = String(src).split('?')[0]; }
  const raw = path.split('/').pop() || '';
  let file = raw;
  try { file = decodeURIComponent(raw); } catch { /* 날것의 '%'·EUC-KR 바이트 — 풀지 않고 그대로 본다 (리뷰 12차: 여기서 던져 글 하나의 후보가 통째로 사라졌다) */ }
  file = file.toLowerCase();
  return CHROME_FILE.test(file) || SNS_FILE.test(file) || CHROME_DIR.test(path) || /(?:^|\s)(?:logo|icon|ico|btn|sns|share)\b/i.test(cls)
    || /^(?:로고|아이콘|단추|버튼|공유|프린트|인쇄|닫기|검색|.*\s로고)$/.test(String(alt).trim());
}

/* 머리·메뉴·바닥·옆칸·스크립트를 걷어 낸 본문.
   🔴 **짝을 세어** 바깥 상자째 지운다 (리뷰 12차) — 정규식 하나로는 `<div id="header"><div class="inner">…` 처럼 안에 같은 태그가 든 머리를 못 지워
      머리의 그림(학교 상징·배너 5장)이 후보를 다 써 버리고 진짜 사진은 열어 보지도 못했다.
   상자 이름은 **낱말 하나로 시작하는 것만**(header·header-wrap · has-header 는 아님) — 본문을 감싼 상자를 통째로 지우지 않게. */
const CHROME_BOX = /^(?:header|gnb|lnb|snb|footer|foot|quick|quickmenu|sitemap|familysite|family-site|util|skip|skipnav|breadcrumb|location|sns|share|banner|popup|sub-?visual|sub_visual|top-?visual|top-?banner)(?:[-_].*)?$/i;
function removeBalanced(html, isChromeOpen) {
  let s = html; let from = 0; let guard = 0;
  const open = /<(header|nav|footer|aside|div|section|ul)\b[^>]*>/gi;
  while (guard++ < 400) {
    open.lastIndex = from;
    const m = open.exec(s);
    if (!m) break;
    if (!isChromeOpen(m[1].toLowerCase(), m[0])) { from = m.index + m[0].length; continue; }
    const tag = m[1].toLowerCase();
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'); re.lastIndex = m.index + m[0].length;
    let depth = 1; let end = -1; let t;
    while ((t = re.exec(s)) !== null) { if (/\/>$/.test(t[0])) continue; depth += t[1] ? -1 : 1; if (depth === 0) { end = re.lastIndex; break; } }
    if (end < 0) { from = m.index + m[0].length; continue; }   // 닫히지 않은 상자는 건드리지 않는다
    s = s.slice(0, m.index) + ' ' + s.slice(end);
    from = m.index;
  }
  return s;
}
function stripChrome(html) {
  const s = String(html || '').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ');
  return removeBalanced(s, (tag, open) => {
    if (/^(?:header|nav|footer|aside)$/.test(tag)) return true;
    const names = `${attr(open, 'id')} ${attr(open, 'class')}`.split(/\s+/).filter(Boolean);
    return names.some((x) => CHROME_BOX.test(x));
  });
}

/* 글 화면 HTML → 후보 그림 [{ src, from:'og'|'body'|'attach', alt }] (차례가 곧 우선순위 · 같은 주소는 한 번) */
export function imageCandidates(html, base) {
  const src = String(html || '');
  const out = []; const seen = new Set();
  const self = String(base || '').split('#')[0];
  const push = (u, from, alt = '', cls = '') => {
    try {
      const a = absImg(u, base);
      if (!a || seen.has(a)) return;
      seen.add(a);
      if (a.split('#')[0] === self) return;                       // 글 화면 자신(href="#" 첨부 글자) — 그림이 아니다
      if (/\.svg(?:$|\?)/i.test(a)) return;                    // 벡터(로고·아이콘이 대부분)는 사진이 아니다
      if (looksChrome(a, alt, cls)) return;
      out.push({ src: a, from, alt: String(alt || '').slice(0, 80) });
    } catch { /* 후보 하나가 이상해도 나머지 후보는 산다 */ }
  };
  /* ① 대표 이미지 */
  for (const m of src.matchAll(/<meta\b[^>]*>/gi)) {
    const k = (attr(m[0], 'property') || attr(m[0], 'name') || attr(m[0], 'itemprop')).toLowerCase();
    if (/^(?:og:image(?::url|:secure_url)?|twitter:image(?::src)?|image)$/.test(k)) push(attr(m[0], 'content'), 'og');
  }
  for (const m of src.matchAll(/<link\b[^>]*>/gi)) if (/^image_src$/i.test(attr(m[0], 'rel'))) push(attr(m[0], 'href'), 'og');
  /* ② 본문 사진 — 늦게 싣는 그림(data-src·data-original)은 그 주소가 진짜다 */
  const body = stripChrome(src);
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const w = Number(attr(t, 'width')); const h = Number(attr(t, 'height'));
    if ((w && w < 120) || (h && h < 80)) continue;              // 적힌 크기가 작으면 아이콘이다 (적힌 게 없으면 받아서 잰다)
    const lazy = attr(t, 'data-src') || attr(t, 'data-original') || attr(t, 'data-lazy-src') || attr(t, 'data-url');
    const plain = attr(t, 'src');
    push(lazy || plain, 'body', attr(t, 'alt'), attr(t, 'class'));
  }
  /* ③ 첨부 그림 — 링크 글자나 주소가 그림 파일 이름인 것 (내려받기 주소라도 받아 보면 그림인지 안다) */
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const href = attr(m[0].slice(0, m[0].indexOf('>') + 1), 'href');
    if (/\.(?:jpe?g|png|webp|gif)(?:\s*\(|\s*\[|\s*$)/i.test(text) || /\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(href)) push(href, 'attach', text);
  }
  return out;
}

/* 본문이 JSON 인 규칙(서강 BbsData · 중앙 BoardViewData) — 문자열 값 가운데 HTML 조각은 HTML 로, 그림 주소처럼 생긴 값은 후보로 */
export function jsonImageCandidates(json, base) {
  const htmls = []; const urls = [];
  const walk = (v, k, d) => {
    if (d > 6 || v == null) return;
    if (typeof v === 'string') {
      if (/<img\b/i.test(v)) htmls.push(v);
      /* 이미 **주소인 값**만(http·// · /로 시작) — 파일 이름만 든 칸(orignlFileNm·streFileNm)을 글 주소에 붙여 지어 부르지 않는다(리뷰 12차 · 주소 유추 금지) */
      else if (/(?:image|img|thumb|photo|file)/i.test(k || '') && /^(?:https?:\/\/|\/)/i.test(v.trim()) && /\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(v)) urls.push(v);
      return;
    }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, k, d + 1)); return; }
    if (typeof v === 'object') for (const [kk, vv] of Object.entries(v)) walk(vv, kk, d + 1);
  };
  walk(json, '', 0);
  const out = imageCandidates(htmls.join('\n'), base);
  const seen = new Set(out.map((c) => c.src));
  for (const u of urls) { try { const a = absImg(u, base); if (a && !seen.has(a) && !looksChrome(a)) { seen.add(a); out.push({ src: a, from: 'body', alt: '' }); } } catch { /* 하나가 이상해도 나머지는 산다 */ } }
  return out;
}

/* 받은 바이트가 정말 그림인가 · 크기는 — 파일 머리만 읽는다(외부 도구 없이 관문이 잴 수 있게). JPEG·PNG·GIF·WebP 만. */
export function sniffImage(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 24) return null;
  if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.toString('latin1', 0, 4) === 'GIF8') return { type: 'gif', width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = b.toString('latin1', 12, 16);
    if (chunk === 'VP8 ' && b.length >= 30) return { type: 'webp', width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L' && b.length >= 25) { const v = b.readUInt32LE(21); return { type: 'webp', width: (v & 0x3fff) + 1, height: ((v >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8X' && b.length >= 30) return { type: 'webp', width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    return null;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i += 1; continue; }
      const mk = b[i + 1];
      if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7) || mk === 0xff) { i += mk === 0xff ? 1 : 2; continue; }
      const len = b.readUInt16BE(i + 2);
      if ((mk >= 0xc0 && mk <= 0xcf) && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { type: 'jpeg', width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  return null;
}

/* 썸네일로 쓸 만한 그림인가 — 사진 크기(가로 160·세로 100 이상)·가로세로 3배 이내(띠 배너·세로 줄 배제)·너무 작은 파일 배제 */
export function photoProblem(info, bytes) {
  if (!info) return '그림 파일이 아님';
  if (bytes < 3000) return `파일이 너무 작음 (${bytes}바이트)`;
  if (info.width < MIN_W || info.height < MIN_H) return `그림이 작음 (${info.width}×${info.height})`;
  const r = Math.max(info.width / info.height, info.height / info.width);
  if (r > MAX_RATIO) return `가로세로가 치우침 (${info.width}×${info.height} · 띠 배너로 보임)`;
  return '';
}

/* 학교마다 **두 글 이상**에서 본 그림 주소 = 공통 그림(로고·배너·기본 공유 그림) — 사진이 아니다.
   seen: { 그림주소: [글 열쇠…] } (장부 srcSeen[학교]) */
export function repeatedSrcs(seen) {
  const out = new Set();
  for (const [src, keys] of Object.entries(seen || {})) if (new Set(keys).size >= 2) out.add(src);
  return out;
}

/* 카드가 그릴 썸네일 경로인가 — 로봇이 만든 해시 이름만(그 밖의 값은 그리지 않는다 · 앱과 감사가 같은 꼴을 본다) */
export const isThumbPath = (p) => THUMB_RE.test(String(p || ''));

/* ── 장부 (collector/news-thumbs.json) ─────────────────────────────────────────────
   { posts: { 글열쇠: { at, school, file?, src?, from? } | { at, school, none } | { at, school, err, tries } },
     srcSeen: { 학교: { 그림주소: [글열쇠…] } } }
   ok(file)·none 은 다시 받지 않는다. err 는 하루 뒤 다시(최대 MAX_TRIES). 파일이 사라진 ok 는 다시 받는다. */
export const RETRY_DAYS = 1;
export const MAX_TRIES = 3;
export const LEDGER_KEEP_DAYS = 60;
export const emptyLedger = () => ({ posts: {}, srcSeen: {}, commonFiles: {} });

/* 관리자가 사진을 뺀 글인가 — 지금 열쇠 또는 **글 번호가 붙기 전의 주소 열쇠**(리뷰 12차: 나중에 규칙이 글 번호를 달면 열쇠가 바뀌어 뺀 사진이 돌아왔다).
   목록 표식 주소(#n-제목)는 같은 제목의 다른 글과 같아 주소 열쇠로 보지 않는다. */
export function optedOut(n, noThumb) {
  if (!noThumb || !noThumb.size) return false;
  if (noThumb.has(thumbKey(n))) return true;
  return !!(n && n.postId && !/#n-/.test(String(n.url || '')) && noThumb.has(`url:${urlKey(n.url)}`));
}

/* QR 코드 — 색이 없고 **검정과 흰색이 둘 다 넉넉하며 그 둘이 거의 전부**인 그림 (리뷰 12차).
   🔴 정보량(엔트로피)으로 가르지 않는다 — 실측: 단색 디자인 행사 포스터(1.5)가 JPEG 로 저장한 QR(1.6~2.6)보다 낮아 포스터가 먼저 떨어졌다.
   🔴 작게 줄일 때 섞지 않는다(가장 가까운 점 · 160px) — 섞으면 QR 의 칸이 회색이 된다. 실측(정문 사진 15장 · QR 두 장):
      QR 검정 36~52% · 흰색 48~64% · 합 100% / 사진 합 7~79%(밤 사진은 검정만 77%) / 흰 바탕 글자 포스터는 검정이 거의 안 잡혀 사는 쪽.
   rgb: 줄인 그림의 RGB 바이트(3바이트씩) → { black, white } 몫 */
export function monoParts(rgb) {
  const b = rgb || []; let bk = 0; let wh = 0; let n = 0;
  for (let i = 0; i + 2 < b.length; i += 3) {
    n += 1;
    const r = b[i]; const g = b[i + 1]; const bl = b[i + 2];
    if (Math.max(r, g, bl) - Math.min(r, g, bl) >= 24) continue;   // 색이 있는 점
    const l = (r + g + bl) / 3;
    if (l < 70) bk += 1; else if (l > 190) wh += 1;
  }
  return n ? { black: bk / n, white: wh / n } : { black: 0, white: 0 };
}
export const looksLikeQr = (p) => !!(p && p.black >= 0.15 && p.white >= 0.15 && p.black + p.white >= 0.95);
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/* 이번 실행에 사진을 찾아볼 글 — 숨김·사진 빼기(noThumb)는 건너뛰고, 새 글부터, 학교마다 돌아가며(한 학교를 몰아치지 않게) perSchool 까지 */
export function planQueue(items, ledger, opts = {}) {
  const today = opts.today; const per = opts.perSchool ?? 6;
  const noThumb = opts.noThumb || new Set(); const exists = opts.fileExists || (() => true);
  const want = [];
  for (const n of items) {
    if (!n || !n.url || !n.school || n.hidden) continue;
    const k = thumbKey(n);
    if (optedOut(n, noThumb)) continue;
    const e = ledger.posts[k];
    if (e && e.file && exists(e.file)) continue;
    if (e && e.none) continue;
    if (e && e.err && ((e.tries || 1) >= MAX_TRIES || (today && dayDiff(e.at, today) < RETRY_DAYS))) continue;
    want.push(n);
  }
  want.sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')) || String(b.postedAt || '').localeCompare(String(a.postedAt || '')));
  const bySchool = new Map();
  for (const n of want) { if (!bySchool.has(n.school)) bySchool.set(n.school, []); const l = bySchool.get(n.school); if (l.length < per) l.push(n); }
  const lanes = [...bySchool.values()]; const out = [];
  for (let i = 0; lanes.some((l) => i < l.length); i += 1) for (const l of lanes) if (i < l.length) out.push(l[i]);
  return out;
}

/* 글 화면에서 본 그림 주소를 학교별로 센다 — 두 글 이상에서 보면 공통 그림 */
export function recordPage(ledger, school, key, srcs) {
  const m = (ledger.srcSeen[school] ||= {});
  for (const s of new Set(srcs || [])) { const l = (m[s] ||= []); if (!l.includes(key) && l.length < 3) l.push(key); }
}
export const blockedFor = (ledger, school) => repeatedSrcs(ledger.srcSeen[school]);

/* **줄인 그림이 같은 파일**(바이트 해시가 같다)인 글이 한 학교에 둘이면 그것도 공통 그림이다 (리뷰 12차) — 주소가 달라도
   (CDN 주소·요청마다 바뀌는 꼬리) 같은 그림이면 같은 파일 이름이 나온다. commonFiles[학교] 에 적어 두고 다시 쓰지 않는다. */
export const isCommonFile = (ledger, school, file) => !!(ledger.commonFiles && (ledger.commonFiles[school] || []).includes(file));
export function markCommonFile(ledger, school, file) {
  const l = ((ledger.commonFiles ||= {})[school] ||= []);
  if (!l.includes(file)) l.push(file);
}
/* 이 학교에서 file 을 이미 쓰는 다른 글이 있나 */
export const fileTwins = (ledger, school, file, key) => Object.entries(ledger.posts).filter(([k, e]) => k !== key && e.school === school && e.file === file).map(([k]) => k);

/* 공통 그림으로 드러난 것을 이미 썸네일로 받은 글 — 장부에서 지워 다시 찾게 한다(되돌린 열쇠 목록) */
export function revokeRepeated(ledger, school) {
  const bad = blockedFor(ledger, school); const out = [];
  for (const [k, e] of Object.entries(ledger.posts)) if (e.school === school && e.file && (bad.has(e.src) || isCommonFile(ledger, school, e.file))) { delete ledger.posts[k]; out.push(k); }
  return out;
}

/* 소급 — 장부를 실린 글 전부에 다시 입힌다(병합·합치기가 thumb 칸을 떨어뜨려도 다음 실행이 되살린다 · 사진 빼기는 지운다).
   docs: [{ doc: { items } }] · 바뀐 글 수를 돌려준다 */
export function applyThumbs(docs, ledger, opts = {}) {
  const noThumb = opts.noThumb || new Set(); const exists = opts.fileExists || (() => true);
  let changed = 0;
  for (const d of docs) {
    d.changed = d.changed || false;
    for (const n of d.doc.items || []) {
      const k = thumbKey(n); const e = ledger.posts[k];
      const want = e && e.file && isThumbPath(e.file) && !optedOut(n, noThumb) && exists(e.file) && !isCommonFile(ledger, n.school, e.file) ? e.file : undefined;
      if (n.thumb === want) continue;
      if (want) n.thumb = want; else delete n.thumb;
      d.changed = true; changed += 1;
    }
  }
  return changed;
}

/* 장부 다듬기 — 실린 글이 아닌 열쇠는 LEDGER_KEEP_DAYS 뒤 지운다. 그림 주소 셈은 실린 글 것만 남기되, 공통 그림(두 글 이상)은 막는 목록으로 남긴다 */
export function pruneLedger(ledger, liveKeys, today) {
  for (const [k, e] of Object.entries(ledger.posts)) if (!liveKeys.has(k) && today && dayDiff(e.at, today) > LEDGER_KEEP_DAYS) delete ledger.posts[k];
  for (const [school, m] of Object.entries(ledger.srcSeen)) {
    for (const [src, keys] of Object.entries(m)) {
      if (new Set(keys).size >= 2) { m[src] = [...new Set(keys)].slice(0, 2); continue; }
      const kept = keys.filter((k) => liveKeys.has(k));
      if (kept.length) m[src] = kept; else delete m[src];
    }
    if (!Object.keys(m).length) delete ledger.srcSeen[school];
  }
  /* 공통 파일 목록은 막는 목록이라 남긴다(학교당 짧다) */
  ledger.commonFiles ||= {};
}
