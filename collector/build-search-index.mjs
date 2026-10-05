/* ============================================================
   검색용 요약 파일 만들기 — data/search-index.json
   ------------------------------------------------------------
   왜 만드나: 장학금 도우미(대장님)가 "기숙사비 지원되는 거 있어?"처럼 물었을 때
   등록 공고의 **원문 전문**까지 뒤져야 제대로 찾는다. 그런데 원문 전문은
   `collector/extracted/notices-text.json` 하나가 수 MB라 앱이 통째로 받을 수 없다.

   그래서 로봇이 **찾는 데 필요한 낱말만** 추려 작은 파일로 만들어 둔다.
   앱은 이 파일만 받는다. (푸시 서버가 요약 파일만 읽게 한 것과 같은 발상)

   🔴 두 가지를 반드시 지킨다
   ① **문장을 만들지 않는다.** 여기서 나오는 것은 '찾기용 낱말 자루'일 뿐,
      화면에 그대로 보여 주는 글이 아니다. 화면에 뜨는 문장은 지금처럼 원문 발췌
      (registered.json의 excerpts)만 쓴다. 여기서 만든 것을 문장처럼 보여 주면
      **잘린 낱말이 사실처럼 읽혀** 원칙 8-1이 깨진다.
   ② **이미 앱이 갖고 있는 낱말은 뺀다.** 이름·주관기관·요약·발췌는 앱이 이미
      들고 있어 또 담으면 파일만 커진다. 그래서 '원문에만 있는 낱말'만 남긴다.

   🔴 원문은 **껍데기를 걷고** 읽는다 (2026-10-05 점검 app1-05) — 요약 98건 중 7건에 메뉴 낱말(스킵네비게이션·주메뉴바로가기·로그아웃·
      학생포탈·eclass)이 들어가, '취업'·'학생포탈' 같은 질문에 엉뚱한 공고가 섞였다(도우미는 요약에 낱말이 있으면 점수를 준다).
      걷는 것: 같은 호스트 여러 쪽에 똑같이 나오는 줄(page-boilerplate · 일반·브라우저 원문을 따로 배워 합친다) · 다른 공고 제목을 담은 줄
      (notice-source.mjs makeTitleLine — 본문 분량 재기와 같은 함수) · 「이전글·다음글」 줄과 그 뒤 두 줄 · 바로 다음 줄이 날짜만 있는 줄(옆 목록 위젯).

   실행: node collector/build-search-index.mjs   (불러오기만 하면 아무것도 쓰지 않는다 — 관문이 buildSearchIndex 를 표본으로 잰다)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { indexTexts, sourceFor, hasText, looksLikeErrorPage, makeTitleLine } from './notice-source.mjs';
import { makeStripperMulti } from './page-boilerplate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REG = path.join(ROOT, 'data/registered.json');
const TEXTS = path.join(ROOT, 'collector/extracted/notices-text.json');
const BROWSER = path.join(ROOT, 'collector/extracted/browser-bodies.json');
const OUT = path.join(ROOT, 'data/search-index.json');

/* 한 공고가 차지할 수 있는 글자 수 상한.
   🔴 올리기 전에 반드시 파일 크기를 재 볼 것 — 이 파일은 **학생 폰이 내려받는다.**
   학교를 늘릴 때 걸리는 것이 파일 크기 하나뿐이라는 것을 이미 겪었다(2026-08-01). */
const PER_ITEM = 240;
const TOTAL_BUDGET = 120 * 1024;   // 전체 120KB를 넘기지 않는다

/* 찾는 데 도움이 안 되는 흔한 말 — 담아 봐야 모든 공고에 다 걸려 쓸모가 없다 */
const COMMON = new Set([
  '장학금', '장학', '신청', '공고', '대상', '선발', '지원', '제출', '서류', '학생', '대학',
  '대학교', '학년', '학기', '성적', '기준', '이상', '이하', '해당', '경우', '관련', '안내',
  '방법', '기간', '접수', '문의', '담당', '전화', '이메일', '주소', '홈페이지', '붙임',
  '아래', '다음', '내용', '사항', '결과', '발표', '확인', '작성', '제출처', '기타', '참고',
  '본교', '재학', '재학생', '학과', '전공', '학번', '성명', '연락처', '증명서', '사본',
]);

function words(text) {
  const out = [];
  const seen = new Set();
  for (const w of String(text).toLowerCase().split(/[^0-9a-z가-힣]+/)) {
    if (w.length < 2 || w.length > 12) continue;
    if (/^\d+$/.test(w)) continue;              // 숫자만 있는 토막은 찾기에 안 쓴다
    if (COMMON.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

/* 껍데기를 걷은 본문 — 위 머리말의 넷. 순수 함수(파일을 읽지도 쓰지도 않는다) */
const PREV_NEXT = /(이전\s?글|다음\s?글)/;
const DATE_ONLY = /^20\d{2}\s*[.\-/]\s*\d{1,2}\s*[.\-/]\s*\d{1,2}\.?$/;
export function bodyForIndex(text, { strip, url, isTitleLine }) {
  const body = strip ? strip(url || '', String(text || ''), { fallback: false }) : String(text || '');
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const drop = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    if (PREV_NEXT.test(lines[i])) { drop.add(i); drop.add(i + 1); drop.add(i + 2); }
    if (DATE_ONLY.test(lines[i + 1] || '') && !DATE_ONLY.test(lines[i])) { drop.add(i); drop.add(i + 1); }
  }
  return lines.filter((l, i) => !drop.has(i) && !(isTitleLine && isTitleLine(l))).join('\n');
}

/**
 * 등록 항목 + 저장된 원문 → { 항목 id: 찾기용 낱말 } (그리고 셈). 파일을 쓰지 않는다.
 * @param {object[]} items          data/registered.json items
 * @param {object|object[]} texts   collector/extracted/notices-text.json
 * @param {object} browserBodies    collector/extracted/browser-bodies.json (주소 → { text, title })
 */
export function buildSearchIndex(items, texts, browserBodies) {
  const idx = indexTexts(texts || {}, browserBodies || {});
  const general = Object.values(texts || {});
  const browserList = Object.entries(browserBodies || {}).map(([url, v]) => (v && v.text ? { url, ...v } : null)).filter(Boolean);
  const strip = makeStripperMulti([general, browserList]);
  const isTitleLine = makeTitleLine([...general, ...browserList]);
  const cleanOf = new Map();
  const bodyOf = (item) => {
    if (cleanOf.has(item.id)) return cleanOf.get(item.id);
    const src = sourceFor(item, idx);
    const v = !hasText(src) || looksLikeErrorPage(src.text) ? null : bodyForIndex(src.text, { strip, url: src.url, isTitleLine });
    cleanOf.set(item.id, v);
    return v;
  };

  /* 🔴 1차: 어떤 낱말이 '여러 공고에 다 나오는가'를 먼저 센다.
     저장된 원문에는 공고 내용뿐 아니라 **게시판 페이지의 껍데기**가 섞여 있다
     (로그인 · 사이트맵 · 본문 바로가기 · 입학 · 취업 …). 그대로 담으면
     "취업" 한 마디에 그 학교 공고가 전부 걸려 **검색이 오히려 나빠진다.**
     껍데기는 같은 학교의 모든 글에 똑같이 나오므로, **여러 공고에 공통으로 나오는 낱말을
     빼는 것**으로 이름을 하나하나 적지 않고도 걸러진다(위 bodyForIndex 가 먼저 줄 단위로 걷는다 — 등록이 적은 학교는 이것만으로 안 걸러졌다). */
  const docFreq = new Map();
  const bodies = new Map();
  for (const item of items || []) {
    const text = bodyOf(item);
    if (text == null) continue;
    const ws = words(text);
    bodies.set(item.id, ws);
    new Set(ws).forEach((w) => docFreq.set(w, (docFreq.get(w) || 0) + 1));
  }
  /* 🔴 문턱을 아주 낮게 잡는다 — **두 건까지만** 남긴다.
     학교마다 게시판 껍데기가 달라서(홍익은 '대학원과정', 성균관은 '킹고id') 비율로 자르면
     그 학교 글이 몇 건 안 될 때 그대로 통과한다. 반면 **정말 그 공고를 가리키는 낱말**
     (재단 이름·사업 이름·특이 요건)은 원래 한두 건에만 나온다.
     즉 여기서 담을 값어치가 있는 것은 애초에 '드문 낱말'뿐이다.
     흔한 낱말은 어차피 이름·요약·발췌에 들어 있어 앱이 이미 찾을 수 있다. */
  const tooCommon = 2;

  const out = {};
  let withText = 0, bytes = 0;
  for (const item of items || []) {
    if (bodyOf(item) == null) continue;   // 원문이 없거나 오류 화면은 원문이 아니다
    withText++;

    /* 앱이 이미 들고 있는 낱말은 뺀다 — 또 담으면 파일만 커진다 */
    const known = new Set(words([
      item.name, item.provider, item.summary, item.amount, item.note,
      ...(item.excerpts || []), ...(item.eligibilityLines || []),
    ].filter(Boolean).join(' ')));

    const fresh = [];
    let len = 0;
    for (const w of (bodies.get(item.id) || [])) {
      if (known.has(w)) continue;
      if ((docFreq.get(w) || 0) > tooCommon) continue;   // 여러 공고에 다 나오는 껍데기 낱말
      if (len + w.length + 1 > PER_ITEM) break;
      fresh.push(w);
      len += w.length + 1;
    }
    if (!fresh.length) continue;
    const blob = fresh.join(' ');
    if (bytes + blob.length > TOTAL_BUDGET) break;    // 예산을 넘기면 거기서 멈춘다
    out[item.id] = blob;
    bytes += blob.length;
  }
  return { items: out, withText, common: [...docFreq.values()].filter((n) => n > tooCommon).length };
}

function main() {
  const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const items = reg.items || [];
  let texts = {};
  try { texts = JSON.parse(fs.readFileSync(TEXTS, 'utf8')); } catch (e) { /* 원문이 없으면 빈 파일이 나온다 */ }
  let browserBodies = {};
  try { browserBodies = JSON.parse(fs.readFileSync(BROWSER, 'utf8')); } catch (e) { /* 아직 없음 */ }
  const built = buildSearchIndex(items, texts, browserBodies);

  const doc = { updatedAt: new Date().toISOString().slice(0, 10), items: built.items };
  fs.writeFileSync(OUT, JSON.stringify(doc));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`검색용 요약: 등록 ${items.length}건 · 원문 있는 것 ${built.withText}건 · 담은 것 ${Object.keys(built.items).length}건 · ${kb}KB`);
  console.log(`  (여러 공고에 공통으로 나와 뺀 낱말 ${built.common}개 — 게시판 껍데기)`);
  if (fs.statSync(OUT).size > TOTAL_BUDGET * 1.2) {
    console.log('⚠️ 파일이 예산보다 큽니다 — PER_ITEM을 줄이세요 (학생 폰이 내려받는 파일입니다)');
  }
}

/* 직접 실행할 때만 쓴다(search-index.yml 의 `node collector/build-search-index.mjs`) — 불러오는 순간 data/search-index.json 을 덮어쓰던 것을 막는다 */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
