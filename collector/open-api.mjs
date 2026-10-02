/* ============================================================
   공공 API 로봇 — 대외활동·공모전을 '칸이 채워진 채로' 받는다 (2026-10-01 개발자 지시)
   ------------------------------------------------------------
   읽는 곳 넷 (열쇠는 GitHub Actions secrets 에만 — 채팅·저장소에 적지 말 것)
     ① K-Startup 사업공고      apis.data.go.kr/B552735/kisedKstartupService01   열쇠 DATA_GO_KR_KEY (등록금 로봇과 같은 열쇠)
     ② 1365 봉사참여정보(_GW)   apis.data.go.kr/1741000/volunteerPartcptnService 열쇠 DATA_GO_KR_KEY
     ③ 온통청년 청년정책        youthcenter.go.kr/go/ythip/getPlcy               열쇠 YOUTHCENTER_KEY
     ④ 온통청년 청년콘텐츠      youthcenter.go.kr/go/ythip/getContent            열쇠 YOUTHCENTER_CONTENT_KEY (정책 열쇠와 같아도 이 칸에 따로 넣는다)
     🔴 온통청년은 공공데이터포털에서 'LINK' 유형이라 **포털 열쇠로 안 열린다** — 온통청년 마이페이지에서 따로 받는다.
   쓰는 곳
     data/activities.json (수집 로봇 collect.mjs 와 같은 파일 · 같은 대기줄 collector 라 동시에 안 쓴다)
     collector/open-api-report.md (출처마다 상태·받은 수·실은 수·버린 이유 · 첫 행의 칸 이름 — 명세와 다르면 여기서 보인다)
   넘어지지 않게
     · 열쇠가 없는 출처는 조용히 건너뛴다(지난 글 그대로).
     · 요청마다 20초 시한 · 두 번 더 시도 · 전체 4분 예산.
     · 한 출처가 실패해도 다른 출처는 저장한다. 실패한 출처의 지난 글은 지우지 않는다.
     · 실패는 리포트에 ❌ 로 적는다 → 워크플로가 이슈로 알린다(로그를 안 봐도 안다).
   실행: node collector/open-api.mjs            (저장)
         node collector/open-api.mjs --dry-run  (받아서 리포트만 · 파일 안 바꿈)
   ============================================================ */
import fs from 'node:fs';
import { API_SOURCES, findRows, xmlItems, xmlTag, mapRows, mergeApi, sourceVerdict, splitLines } from './open-api-map.mjs';
import { activityDetails, putActivityDetails } from './activity-excerpts.mjs';
import { htmlToLines } from './html-text.mjs';
import { canonUrl } from './canon-url.mjs';

/* 장학 낱말 — collect.mjs 의 KEYWORDS 사본(관문이 같은지 잰다 · test-collector 「감사의 수집기 그물 사본」).
   '봉사장학·인턴장학' 같은 장학 제도는 활동 글로 싣지 않는다. */
const KEYWORDS = /장학|학자금|등록금 감면|학업장려|근로장학/;

const HERE = new URL('./', import.meta.url);
const ACTS = new URL('../data/activities.json', HERE);
const REPORT = new URL('open-api-report.md', HERE);
const DRY = process.argv.includes('--dry-run');
const REQ_MS = 20000;
const BUDGET_MS = 4 * 60 * 1000;
const started = Date.now();
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);   // KST

/* 공공데이터포털 열쇠는 Decoding 값을 쓴다 — Encoding 값(%2B…)을 넣었어도 한 번 풀어서 이중 인코딩을 막는다 */
const portalKey = (() => { const k = (process.env.DATA_GO_KR_KEY || '').trim(); try { return k.includes('%') ? decodeURIComponent(k) : k; } catch { return k; } })();
const youthKey = (process.env.YOUTHCENTER_KEY || '').trim();
/* 콘텐츠 열쇠가 정책 열쇠와 같은지 아직 모른다 — 대신 쓰지 않는다(다르면 매일 ❌ 가 뜬다 · 리뷰 M2). 같다면 시크릿 두 칸에 같은 값을 넣는다 */
const youthContentKey = (process.env.YOUTHCENTER_CONTENT_KEY || '').trim();

class ApiError extends Error {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 열쇠가 오류 문구·주소에 섞여 리포트에 찍히지 않게 */
const hideKeys = (s) => [portalKey, youthKey, youthContentKey, encodeURIComponent(portalKey)].filter((k) => k && k.length > 6)
  .reduce((t, k) => t.split(k).join('***'), String(s));

async function getText(base, params) {
  const url = `${base}?${new URLSearchParams(params)}`;
  let last;
  for (let i = 0; i < 3; i += 1) {
    if (Date.now() - started > BUDGET_MS) throw new ApiError('전체 시간 예산(4분) 초과');
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQ_MS), headers: { Accept: 'application/json, application/xml;q=0.9, */*;q=0.8' } });
      const text = await res.text();
      if (res.status >= 500) throw new ApiError(`서버 오류 HTTP ${res.status}`);   // 다시 시도할 만하다
      if (!res.ok) return { status: res.status, text };                            // 401·403 등은 다시 해도 같다
      return { status: res.status, text };
    } catch (e) {
      last = e;
      if (i < 2) await sleep(3000 * (i + 1));
    }
  }
  throw new ApiError(last?.name === 'TimeoutError' ? `응답 없음(${REQ_MS / 1000}초 × 3회)` : `요청 실패: ${last?.message || last}`);
}

/* 오류 응답에서 사람이 읽을 이유를 뽑는다(공공데이터포털은 JSON 을 달라 해도 오류는 XML 로 준다) */
function reasonOf({ status, text }) {
  const t = String(text || '');
  /* XML 이든 JSON 이든 같은 이름표를 찾는다(실측: 포털은 JSON 껍데기 안에 returnAuthMsg · 온통청년은 errorMsg) */
  const pick = (name) => (t.match(new RegExp(`<${name}>([^<]+)</${name}>|"${name}"\\s*:\\s*"([^"]+)"`)) || []).slice(1).find(Boolean);
  const msg = ['returnAuthMsg', 'errorMsg', 'resultMsg', 'resultMessage', 'errMsg', 'message'].map(pick).find(Boolean);
  const hint = /SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은|유효하지 않은|invalid api key|인증/i.test(`${msg} ${t.slice(0, 300)}`)
    ? ' — 열쇠가 아직 활성화 전일 수 있다(승인 뒤 1~2시간) · 계속되면 활용신청 현황과 시크릿 값을 확인' : '';
  return `HTTP ${status} · ${(msg || t.replace(/\s+/g, ' ').slice(0, 160) || '빈 응답')}${hint}`;
}

const parseJson = (r) => { try { return JSON.parse(r.text); } catch { throw new ApiError(reasonOf(r)); } };

/* ── 출처별 받기: 행 배열을 돌려준다(모양을 모르면 ApiError) ── */
const FETCHERS = {
  async kstartup() {
    const rows = [];
    for (let page = 1; page <= 5; page += 1) {
      const r = await getText('https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01', {
        serviceKey: portalKey, page, perPage: 100, returnType: 'json',
        'cond[rcrt_prgs_yn::EQ]': 'Y', 'cond[aply_trgt::LIKE]': '대학생',
      });
      if (r.status !== 200) throw new ApiError(reasonOf(r));
      const j = parseJson(r);
      const got = findRows(j, 'biz_pbanc_nm');
      if (!got) { if (Array.isArray(j?.data) && j.data.length === 0) break; throw new ApiError(`응답 모양이 명세와 다르다 — ${reasonOf(r)}`); }
      rows.push(...got);
      if (got.length < 100) break;
    }
    return rows;
  },
  async vol1365() {
    const rows = [];
    for (let pageNo = 1; pageNo <= 5; pageNo += 1) {
      const r = await getText('https://apis.data.go.kr/1741000/volunteerPartcptnService/getVltrSearchWordList', {
        serviceKey: portalKey, pageNo, numOfRows: 100, keyword: '대학생', adultPosblAt: 'Y',
      });
      const code = xmlTag(r.text, 'resultCode');
      if (r.status !== 200 || (code && !/^0+$/.test(code))) throw new ApiError(reasonOf(r));
      if (!code && !/<items/.test(r.text)) throw new ApiError(`응답 모양이 명세와 다르다 — ${reasonOf(r)}`);
      const got = xmlItems(r.text);
      rows.push(...got);
      if (got.length < 100) break;
    }
    return rows;
  },
  async youthPolicy() {
    const rows = [];
    for (let pageNum = 1; pageNum <= 50; pageNum += 1) {   // 정책 3천여 건 전부 — 종류 판정은 제목으로 하므로 걸러 받을 수가 없다
      const r = await getText('https://www.youthcenter.go.kr/go/ythip/getPlcy', { apiKeyNm: youthKey, pageNum, pageSize: 100, rtnType: 'json' });
      if (r.status !== 200) throw new ApiError(reasonOf(r));
      const j = parseJson(r);
      const got = findRows(j, 'plcyNm');
      if (!got) { if (pageNum > 1 && /\[\s*\]/.test(r.text)) break; throw new ApiError(`${pageNum}쪽 응답 모양이 명세와 다르다 — ${reasonOf(r)}`); }   // 빈 목록만 '끝'이다(리뷰 M6)
      rows.push(...got);
      if (got.length < 100) break;
    }
    return rows;
  },
  async youthContent() {
    const rows = [];
    for (let pageNum = 1; pageNum <= 3; pageNum += 1) {   // 최근 글만(60일 넘은 글은 어차피 버린다)
      const r = await getText('https://www.youthcenter.go.kr/go/ythip/getContent', { apiKeyNm: youthContentKey, pageNum, pageSize: 100, rtnType: 'json' });
      if (r.status !== 200) throw new ApiError(reasonOf(r));
      const j = parseJson(r);
      const got = findRows(j, 'pstTtl');
      if (!got) { if (pageNum > 1 && /\[\s*\]/.test(r.text)) break; throw new ApiError(`${pageNum}쪽 응답 모양이 명세와 다르다 — ${reasonOf(r)}`); }
      rows.push(...got);
      if (got.length < 100) break;
    }
    return rows;
  },
};
/* 1365 상세 — 목록에는 봉사 내용(progrmCn)이 없어 실은 글(최대 15)만 번호로 하나씩 받는다.
   한 건이 실패해도 글은 그대로 싣는다(내용 칸만 빈다) — 상세 때문에 출처 전체를 실패로 치지 않는다. */
async function vol1365Details(items, refs) {
  let got = 0;
  for (const it of items) {
    const no = refs.get(it.url);
    if (!no || Date.now() - started > BUDGET_MS) continue;
    try {
      const r = await getText('https://apis.data.go.kr/1741000/volunteerPartcptnService/getVltrPartcptnItem', { serviceKey: portalKey, progrmRegistNo: no });
      const row = xmlItems(r.text)[0];
      if (!row || !row.progrmCn) continue;
      const d = activityDetails(htmlToLines(row.progrmCn));
      if (!d.noticeLines.length) d.noticeLines = splitLines(row.progrmCn, 6);
      putActivityDetails(it, d);
      got += 1;
    } catch { /* 이 글만 내용 없이 */ }
  }
  return got;
}

const HAS_KEY = { kstartup: !!portalKey, vol1365: !!portalKey, youthPolicy: !!youthKey, youthContent: !!youthContentKey };
const KEY_NAME = { kstartup: 'DATA_GO_KR_KEY', vol1365: 'DATA_GO_KR_KEY', youthPolicy: 'YOUTHCENTER_KEY', youthContent: 'YOUTHCENTER_CONTENT_KEY' };

/* ── 정찰(--probe) — 진짜 열쇠는 Actions 에만 있어 여기서 못 불러 본다. 출처가 ❌ 일 때 **매개변수를 바꿔 가며** 상태와 응답 머리만 찍는다.
   저장하지 않는다 · 열쇠는 가린다 · 워크플로 수동 실행의 probe 입력으로 켠다(2026-10-02 · 온통청년 'invalid param data' 진단) ── */
if (process.argv.includes('--probe')) {
  const P = (n, size = 100) => [`청년정책 pageNum=${n} pageSize=${size}`, 'https://www.youthcenter.go.kr/go/ythip/getPlcy', { apiKeyNm: youthKey, pageNum: n, pageSize: size, rtnType: 'json' }];
  const tries = [P(2), P(5), P(10), P(11), P(20), P(31), P(32), P(33), P(101, 10), P(316, 10), P(317, 10),
    ['청년콘텐츠 pageNum=2 pageSize=10', 'https://www.youthcenter.go.kr/go/ythip/getContent', { apiKeyNm: youthContentKey, pageNum: 2, pageSize: 10, rtnType: 'json' }]];
  for (const [label, base, params] of tries) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${base}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(60000) });
      const text = await res.text();
      console.log(`[정찰] ${label} → HTTP ${res.status} · ${Date.now() - t0}ms · ${text.length}자 · ${hideKeys(text.replace(/\s+/g, ' ').slice(0, 300))}`);
    } catch (e) {
      console.log(`[정찰] ${label} → 실패 ${e.name} · ${Date.now() - t0}ms`);
    }
  }
  process.exit(0);
}

/* ── 돌리기 ── */
const results = {};
const lines = [`## 🛰 공공 API 로봇 리포트 (${today})`, ''];
for (const src of Object.keys(API_SOURCES)) {
  const name = API_SOURCES[src].name;
  if (!HAS_KEY[src]) { results[src] = { ok: false }; lines.push(`- ⏸ **${name}** — 열쇠(${KEY_NAME[src]})가 없어 건너뜀 · 지난 글 그대로`); continue; }
  try {
    const rows = await FETCHERS[src]();
    const { items, dropped, refs } = mapRows(src, rows, { scholarship: KEYWORDS, today });
    const why = Object.entries(dropped).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
    const bad = sourceVerdict(rows, dropped);
    /* 상세는 **성공으로 칠 응답일 때만** 받는다 — 실패로 칠 응답에 15번 더 두드리지 않는다(2026-10-01 코드 리뷰) */
    const detailNote = !bad && src === 'vol1365' && items.length ? ` · 상세 내용 ${await vol1365Details(items, refs)}/${items.length}건` : '';
    if (bad) {   // 🔴 성공으로 치지 않는다 — 치면 지난 글이 조용히 지워진다 (리뷰 C1)
      results[src] = { ok: false };
      lines.push(`- ❌ **${name}** — ${bad} · 지난 글 그대로 둠${why ? ` · 버림: ${why}` : ''}`);
    } else {
      results[src] = { ok: true, items };
      lines.push(`- ✅ **${name}** — 받은 행 ${rows.length} · 실은 글 **${items.length}**${detailNote}${why ? ` · 버림: ${why}` : ''}`);
      /* 자격 줄을 읽은 글 수 — 적합도 배지가 붙는 글이다. 0 이면 응답 칸이 바뀌었는지 본다 */
      lines.push(`  - 자격 줄 있는 글 ${items.filter((n) => (n.eligibilityLines || []).length).length}/${items.length} · 원문 안내 있는 글 ${items.filter((n) => (n.noticeLines || []).length).length}/${items.length}`);
    }
    /* 첫 행의 칸 이름 — 명세와 실제가 다르면 여기서 바로 보인다(값은 안 적는다 · 담당자 연락처 등이 섞여 있다) */
    if (rows[0]) lines.push(`  - 첫 행 칸: \`${Object.keys(rows[0]).slice(0, 40).join(', ')}\``);
    items.slice(0, 3).forEach((n) => lines.push(`  - ${n.kind} · ${n.title}${n.deadline ? ` (~${n.deadline})` : ''} — ${n.url}`));
  } catch (e) {
    results[src] = { ok: false };
    lines.push(`- ❌ **${name}** — ${hideKeys(e instanceof ApiError ? e.message : `로봇 오류: ${e?.stack || e}`)} · 지난 글 그대로 둠`);
  }
}

let prev = { updatedAt: today, items: [] };
try { prev = JSON.parse(fs.readFileSync(ACTS, 'utf8')); } catch { /* 처음 */ }
let hideUrls = new Set();
try { hideUrls = new Set((JSON.parse(fs.readFileSync(new URL('activity-config.json', HERE), 'utf8')).hideUrls || []).map(canonUrl)); } catch { /* 설정 없음 */ }
const before = (prev.items || []).filter((n) => n.api).length;
const next = mergeApi(prev.items, results, { today, hideUrls });
const after = next.filter((n) => n.api).length;
lines.push('', `data/activities.json — API 글 ${before} → **${after}건** (전체 ${next.length}건)${DRY ? ' · 미리보기라 저장 안 함' : ''}`);
lines.push('', '> 열쇠·출처 설명: `collector/open-api.mjs` 머리말 · 바꾸는 규칙: `collector/open-api-map.mjs` · 설계: `docs/designs/external-sources.md` §10');

if (!DRY) {
  /* 로봇과 같은 형식(JSON.stringify(x, null, 1)) — 다르면 병합 때 파일 전체가 충돌한다 */
  fs.writeFileSync(ACTS, JSON.stringify({ ...prev, updatedAt: today, items: next }, null, 1));
  fs.writeFileSync(REPORT, `${hideKeys(lines.join('\n'))}\n`);
}
console.log(hideKeys(lines.join('\n')));
