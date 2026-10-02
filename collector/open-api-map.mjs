/* ============================================================
   공공 API 응답 → 대외활동·공모전 글 — **바꾸는 규칙 한 곳** (2026-10-01 개발자 지시 "로봇 만들어줘")
   ------------------------------------------------------------
   무엇을 하나
     공공 API 넷(K-Startup · 1365 봉사 · 온통청년 청년정책 · 온통청년 청년콘텐츠)이 준 행을
     data/activities.json 의 글 모양으로 바꾸고(map*), 지난번 글과 합친다(mergeApi).
     부르는 쪽은 collector/open-api.mjs 하나다(네트워크·파일은 거기서만).
   왜 따로 두나
     이 파일은 **불러와도 아무것도 실행하지 않는다** — 관문(test-collector 「공공 API 로봇」)이
     열쇠·인터넷 없이 가짜 응답으로 그대로 돌려 본다.
   규칙
     · 종류 판정은 activity-kind.mjs 한 곳 — 판정 못 한 행은 싣지 않는다(1365 는 출처 자체가 봉사라 '대외활동'·'봉사').
     · 마감은 API 의 날짜 칸만 쓴다(청년콘텐츠는 날짜 칸이 없어 장학과 같은 발췌 규칙 · activity-excerpts.mjs).
       못 읽으면 비운다 — 가짜 마감을 만들지 않는다(원칙 8-1).
     · 원문 주소는 API 가 준 주소만 — 없으면 그 행을 버린다(주소를 짐작해 만들지 않는다).
     · 한 출처를 **못 받아 온 날은 그 출처의 지난 글을 그대로 둔다** — 네트워크가 잠깐 끊겼다고 글이 사라지지 않게.
   ============================================================ */
import { activityKind, activityField } from './activity-kind.mjs';
import { activityExcerpts, activityDetails, putActivityDetails, CONTACT } from './activity-excerpts.mjs';
import { htmlToLines } from './html-text.mjs';
import { decodeEntities } from './clean-title.mjs';
import { canonUrl } from './canon-url.mjs';
import { titleKey } from './url-key.mjs';

/* 출처마다 싣는 최대 글 수 — 넷 합쳐 55. 활동 파일 상한(collect.mjs ACT_CAP 200)을 API 글이 먹어
   게시판 글이 밀려나지 않게(밀려난 게시판 글은 장부 때문에 다시 안 온다 · 리뷰 M1) */
export const API_SOURCES = {
  kstartup: { name: 'K-Startup 사업공고', cap: 15 },
  vol1365: { name: '1365 봉사참여정보', cap: 15 },
  /* 순서 = 받는 순서. 청년콘텐츠(작은 3쪽)를 청년정책(33쪽 · 쪽 사이 2.5초)보다 **먼저** — 6분 예산을 청년정책이 다 쓰면 멀쩡한 콘텐츠가 매일 ❌ 가 된다(2026-10-02 리뷰) */
  youthContent: { name: '온통청년 청년콘텐츠', cap: 10 },
  youthPolicy: { name: '온통청년 청년정책', cap: 15 },
};

const MAX_LEN = 160;
const clip = (v) => {
  const s = decodeEntities(String(v ?? '')).replace(/\s+/g, ' ').trim();
  return s.length > MAX_LEN ? `${s.slice(0, MAX_LEN - 1)}…` : s;
};
/* API 가 준 주소 가운데 '그 공고 하나'를 가리키는 첫 주소. 기관 홈 첫 화면(경로·물음 없음)은 그 공고가 아니라 버린다
   (청년정책의 신청 주소 칸에 기관 홈이 흔하다 · CLAUDE.md 「원문 링크는 그 공고 하나로」 · 리뷰 I1) */
const specific = (u) => { try { const x = new URL(u); return (x.pathname.replace(/\/+$/, '') !== '' || x.search !== ''); } catch { return false; } };
const httpUrl = (...cands) => cands.map((u) => String(u ?? '').trim()).find((u) => /^https?:\/\/\S+$/i.test(u) && specific(u)) || null;

/* 'yyyyMMdd'·'yyyy-MM-dd'·'yyyy.MM.dd' 의 첫 날짜 → 'YYYY-MM-DD' (아니면 null) */
export function ymd(raw) {
  const m = String(raw ?? '').match(/(20\d{2})[-.]?(\d{2})[-.]?(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${mo}-${d}`;
}

/* 온통청년 신청기간 '20260101 ~ 20261231' (여러 구간이면 줄로 이어 온다) → 가장 늦은 끝 날짜 */
export function lastDate(raw) {
  const all = [...String(raw ?? '').matchAll(/20\d{2}[-.]?\d{2}[-.]?\d{2}/g)].map((m) => ymd(m[0])).filter(Boolean);
  return all.length ? all.sort().at(-1) : null;
}

const range = (a, b) => {
  const s = ymd(a), e = ymd(b);
  return s && e ? `${s} ~ ${e}` : (e ? `~ ${e}` : null);
};
/* 온통청년 신청기간 원문('20260101 ~ 20260331\\N20260901 ~ …')을 날짜 모양으로 — 구간은 ' · ' 로 잇는다 (리뷰 M3) */
const periods = (raw) => String(raw ?? '').split(/\\N|\n|,/).map((p) => {
  const d = [...p.matchAll(/20\d{2}[-.]?\d{2}[-.]?\d{2}/g)].map((m) => ymd(m[0])).filter(Boolean);
  return d.length >= 2 ? `${d[0]} ~ ${d[1]}` : (d[0] || '');
}).filter(Boolean).join(' · ') || null;

const excerpt = (label, text) => (text ? { label, text: clip(text) } : null);

/* API 의 긴 글 칸(신청 대상·공고 내용 등)을 줄로 — 원문 줄바꿈·글머리(○ • - ※ 1.)에서 끊는다. 한 줄 240자 · 최대 8줄.
   🔴 문의처(전화·메일)가 든 줄은 싣지 않는다(activity-excerpts 의 규칙과 같다 — 그 함수를 거친다). */
export function splitLines(raw, max = 8) {
  const t = htmlToLines(String(raw ?? ''));
  const parts = t.split('\n').flatMap((l) => l.split(/\s(?=[○•◦▪■□◎※]\s?)|(?<=\S)\s(?=\d{1,2}[.)]\s)/))
    .map((l) => l.replace(/^[\s\-–·•○◦▪■□◎]+/, '').trim())
    .filter((l) => l.length >= 3 && /[가-힣A-Za-z]/.test(l))   // 3자 — `공무원`·`재직자` 같은 제외 대상이 한 낱말로 온다
    .map((l) => (l.length > 240 ? `${l.slice(0, 239)}…` : l));
  return parts.filter((l) => !CONTACT.test(l)).slice(0, max);
}
const labeled = (label, raw) => {
  const l = splitLines(raw, 3);
  if (!l.length) return [];
  const t = `${label} : ${l.join(' ')}`;
  return [t.length > 240 ? `${t.slice(0, 239)}…` : t];   // 자른 곳은 … 로 알린다(splitLines 와 같은 규칙)
};

/* 같은 모양의 글 하나 — 학교가 빈 전국 글(앱이 모든 학생에게 보인다) */
function item({ title, url, kind, field, deadline, host, excerpts, api, details }) {
  /* 카드 윗줄에 주최가 이미 나온다 — 같은 이름을 발췌 '주최'로 또 적지 않는다 (리뷰 M4) */
  const h = clip(host);
  excerpts = (excerpts || []).filter((x) => x && !(x.label === '주최' && x.text === h));
  return {
    title: clip(title),
    url,
    kind,
    field: field || activityField(title, kind) || undefined,
    deadline: deadline || undefined,
    deadlineHint: null,
    excerpts,
    attachments: [],
    school: '',
    campus: '',
    host: h,
    api,
    /* 자격·제외·우선 선발·원문 안내 — 앱이 장학과 같은 엔진으로 적합도를 낸다(2026-10-01). 없으면 칸을 안 만든다 */
    ...putActivityDetails({}, details || {}),
  };
}

/* 각 map 은 { item } 또는 { drop: '이유' } 를 돌려준다 — 리포트가 버린 이유를 센다 */

export function mapKstartup(r, { scholarship } = {}) {
  const title = r.biz_pbanc_nm || r.intg_pbanc_biz_nm;
  if (!title) return { drop: '제목 없음' };
  const kind = activityKind(title, { scholarship });
  if (!kind) return { drop: '공모전·대외활동 아님(지원사업 등)' };
  const url = httpUrl(r.detl_pg_url, r.biz_aply_url, r.biz_gdnc_url);
  if (!url) return { drop: '원문 주소 없음' };
  return { item: item({
    title, url, kind,
    deadline: ymd(r.pbanc_rcpt_end_dt),
    host: r.pbanc_ntrp_nm || '창업진흥원 K-Startup',
    excerpts: [
      excerpt('모집기간', range(r.pbanc_rcpt_bgng_dt, r.pbanc_rcpt_end_dt)),
      excerpt('대상', r.aply_trgt_ctnt || r.aply_trgt),
      /* 🔴 sprv_inst(명세 '주관 기관')는 실제로 '공공기관'·'민간' 같은 **갈래**가 온다(2026-10-01 첫 실행 실측) —
         '주최 · 민간'은 기관 이름이 아니라 주최로 적지 않는다. 기관 이름은 pbanc_ntrp_nm(카드 윗줄 host) */
      excerpt('활동지역', r.supt_regin),
    ],
    details: {
      /* 대상 연령은 **한 갈래일 때만** 자격 줄로 — 여러 갈래('만 20세 미만,만 20세 이상 ~ 만 39세 이하,…')를 한 줄로 두면 범위 하나로 잘못 읽힌다 */
      eligibilityLines: [...splitLines(r.aply_trgt_ctnt), ...(r.biz_trgt_age && !/,/.test(r.biz_trgt_age) ? [`대상 연령 : ${r.biz_trgt_age}`] : [])],
      eligibilityExcludes: splitLines(r.aply_excl_trgt_ctnt),
      eligibilityPriority: splitLines(r.prfn_matr, 5),
      noticeLines: [...splitLines(r.pbanc_ctnt, 5),
        ...labeled('온라인 접수', r.aply_mthd_onli_rcpt_istc), ...labeled('이메일 접수', r.aply_mthd_eml_rcpt_istc),
        ...labeled('방문 접수', r.aply_mthd_vst_rcpt_istc), ...labeled('우편 접수', r.aply_mthd_pssr_rcpt_istc),
        ...labeled('기타 접수', r.aply_mthd_etc_istc)].slice(0, 8),
    },
    api: 'kstartup',
  }) };
}

/* 1365 는 동네 봉사 일감이 대부분이라 **대학생·청년을 부른 글만** 싣는다(대학생 탭에 동네 일감이 쏟아지지 않게) */
const STUDENT = /대학생|대학교|청년|서포터즈|봉사단/;
export function map1365(r) {
  const title = r.progrmSj;
  if (!title) return { drop: '제목 없음' };
  if (String(r.adultPosblAt || 'Y').toUpperCase() === 'N') return { drop: '성인 참여 불가' };
  if (!STUDENT.test(title)) return { drop: '대학생·청년 대상 아님' };
  const url = httpUrl(r.url);
  if (!url) return { drop: '원문 주소 없음' };
  return { item: item({
    title, url, kind: '대외활동', field: '봉사',
    deadline: ymd(r.noticeEndde),
    host: r.nanmmbyNm || r.mnnstNm || '1365 자원봉사포털',
    excerpts: [
      excerpt('모집기간', range(r.noticeBgnde, r.noticeEndde)),
      excerpt('활동기간', range(r.progrmBgnde, r.progrmEndde)),
      excerpt('활동지역', r.actPlace),
    ],
    api: 'vol1365',
  }), ref: r.progrmRegistNo || null };   // 상세 내용(progrmCn)은 목록에 없어 로봇이 이 번호로 따로 받는다(vol1365Details)
}

export function mapYouthPolicy(r, { scholarship } = {}) {
  const title = r.plcyNm;
  if (!title) return { drop: '제목 없음' };
  const kind = activityKind(title, { scholarship });
  if (!kind) return { drop: '공모전·대외활동 아님(주거·금융 등 정책)' };
  const url = httpUrl(r.aplyUrlAddr, r.refUrlAddr1, r.refUrlAddr2);
  if (!url) return { drop: '원문 주소 없음' };
  const always = String(r.aplyPrdSeCd || '') === '0057002';   // 신청기간 구분: 상시
  const min = Number(r.sprtTrgtMinAge) || 0, max = Number(r.sprtTrgtMaxAge) || 0;
  const age = String(r.sprtTrgtAgeLmtYn || '').toUpperCase() !== 'N' && (min || max) ? `만 ${min || ''}~${max || ''}세` : null;
  /* 판정 엔진이 읽는 나이 줄 — 범위면 '만 19세 ~ 만 34세', 위만 있으면 '만 34세 이하'(parse-requirements parseAge) */
  const ageLine = age ? (min && max ? `만 ${min}세 ~ 만 ${max}세` : (max ? `만 ${max}세 이하` : null)) : null;
  return { item: item({
    title, url, kind,
    deadline: always ? null : lastDate(r.aplyYmd),
    host: r.sprvsnInstCdNm || r.operInstCdNm || '온통청년',
    excerpts: [
      excerpt('모집기간', always ? '상시' : periods(r.aplyYmd)),
      excerpt('대상', age),
      excerpt('혜택', r.plcySprtCn),
      excerpt('주최', r.operInstCdNm && r.operInstCdNm !== r.sprvsnInstCdNm ? r.operInstCdNm : null),
    ],
    details: {
      eligibilityLines: [...(ageLine ? [ageLine] : []), ...splitLines(r.addAplyQlfcCndCn, 6), ...splitLines(r.earnEtcCn, 2)],
      eligibilityExcludes: splitLines(r.ptcpPrpTrgtCn),
      noticeLines: [...splitLines(r.plcyExplnCn, 3), ...labeled('신청 방법', r.plcyAplyMthdCn), ...labeled('심사 방법', r.srngMthdCn),
        ...labeled('제출 서류', r.sbmsnDcmntCn), ...labeled('기타', r.etcMttrCn)].slice(0, 8),
    },
    api: 'youthPolicy',
  }) };
}

/* 청년콘텐츠는 소식 글이 섞여 있다 — 판정되는 글만, 60일 안에 올라온 것만(옛 글이 '새 글'로 뜨지 않게) */
export function mapYouthContent(r, { scholarship, today } = {}) {
  const title = r.pstTtl;
  if (!title) return { drop: '제목 없음' };
  /* 종류 — 제목 판정이 먼저, 못 하면 **게시판 스스로 단 분류**(pstSeNm '대외활동')를 쓴다(1365 가 출처 자체로 봉사인 것과 같은 이치 · 2026-10-02) */
  const kind = activityKind(title, { scholarship }) || (String(r.pstSeNm || '').trim() === '대외활동' && !scholarship?.test(title) ? '대외활동' : null);
  if (!kind) return { drop: '공모전·대외활동 아님(소식 글 등)' };
  const posted = ymd(r.frstRegDt);
  if (posted && today && daysBetween(posted, today) > 60) return { drop: '60일 지난 글' };
  /* 🔴 pstUrlAddr 는 **전부 null** 로 온다(2026-10-02 정찰 실측 10/10). 청년참여 프로그램 게시판(bbsSn 48)의 글 주소는
     `https://www.youthcenter.go.kr/bbs03View/48/{pstSn}` 이다 — 같은 날 10811·10806 두 글을 실제로 열어 API 제목과 같은 글이 뜨는 것을 확인했다.
     확인한 게시판(48)만 만든다. 다른 게시판은 확인 전이라 주소를 짓지 않고 버린다(원문 링크는 그 공고 하나로 · 짐작 금지). */
  const url = httpUrl(r.pstUrlAddr)
    || (String(r.bbsSn) === '48' && /^\d+$/.test(String(r.pstSn || '')) ? `https://www.youthcenter.go.kr/bbs03View/48/${r.pstSn}` : null);
  if (!url) return { drop: '원문 주소 없음' };
  const ex = activityExcerpts(htmlToLines(r.pstWholCn));
  return { item: item({
    title, url, kind,
    deadline: ex.deadline,
    host: r.pstSeNm ? `온통청년 ${r.pstSeNm}` : '온통청년',
    excerpts: ex.excerpts,
    details: activityDetails(htmlToLines(r.pstWholCn)),
    api: 'youthContent',
  }) };
}

export const MAPPERS = { kstartup: mapKstartup, vol1365: map1365, youthPolicy: mapYouthPolicy, youthContent: mapYouthContent };

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/* 응답 어디에 있든 '그 칸을 가진 객체들의 배열'을 찾는다 — 감싸는 껍데기 이름이 바뀌어도 안 깨지게.
   못 찾으면 null(=모양을 모른다 · 0건과 다르다). */
export function findRows(obj, key) {
  const seen = new Set();
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return null;
    seen.add(o);
    if (Array.isArray(o)) {
      if (o.some((x) => x && typeof x === 'object' && key in x)) return o;
      for (const x of o) { const r = walk(x); if (r) return r; }
      return null;
    }
    if (key in o) return [o];   // 1건이면 배열이 아니라 객체 하나로 오는 API 가 있다(XML→JSON)
    for (const v of Object.values(o)) { const r = walk(v); if (r) return r; }
    return null;
  };
  return walk(obj);
}

/* 공공데이터포털 XML(1365) — 칸이 평평한 <item> 들뿐이라 파서 없이 읽는다 */
export function xmlItems(xml) {
  return [...String(xml || '').matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const o = {};
    for (const f of m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = decodeEntities(f[2].replace(/^<!\[CDATA\[|\]\]>$/g, '')).trim();
    return o;
  });
}
export const xmlTag = (xml, tag) => (String(xml || '').match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [])[1]?.trim() || null;

/* 한 출처의 행들 → 실을 글 + 버린 이유 집계. 마감 지난 글은 싣지 않는다. 마감 가까운 순으로 상한까지. */
export function mapRows(source, rows, { scholarship, today }) {
  const dropped = {};
  const items = [];
  const seen = new Set();
  const refs = new Map();   // 글 주소 → 상세를 따로 받을 번호(1365) — 글에는 싣지 않는다
  for (const r of rows) {
    const { item: it, drop, ref } = MAPPERS[source](r, { scholarship, today });
    if (drop) { dropped[drop] = (dropped[drop] || 0) + 1; continue; }
    if (it.deadline && it.deadline < today) { dropped['마감 지남'] = (dropped['마감 지남'] || 0) + 1; continue; }
    /* 같은 글 — 주소로도, 제목으로도(수집 로봇의 dedupeNotices 가 학교·캠퍼스·제목으로 합친다 ·
       1365 엔 센터마다 같은 제목이 흔해 여기서 안 합치면 매일 늘었다 줄었다 한다 · 리뷰 I2) */
    const k = canonUrl(it.url), tk = titleKey(it);
    if (seen.has(k) || (tk && seen.has(tk))) { dropped['같은 글'] = (dropped['같은 글'] || 0) + 1; continue; }
    seen.add(k); if (tk) seen.add(tk);
    if (ref) refs.set(it.url, ref);
    items.push(it);
  }
  items.sort((a, b) => String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
  const cap = API_SOURCES[source].cap;
  if (items.length > cap) dropped[`상한 ${cap}건 초과`] = items.length - cap;
  return { items: items.slice(0, cap), dropped, refs };
}

/* 받아 온 결과를 '성공'으로 쳐도 되는가 — 아니면 이유(문자열). 🔴 성공으로 치면 그 출처의 지난 글이 이번 글로 **바뀐다**.
   그래서 0행 응답이나 칸 이름이 바뀐 응답(거의 전부 '제목 없음')을 성공으로 치면 지난 글이 조용히 다 지워진다 (리뷰 C1).
   마감 지난 글은 앱이 이미 숨기므로(activitiesForMe) 지난 글을 남겨 두는 쪽이 안전하다. */
export function sourceVerdict(rows, dropped) {
  if (!rows.length) return '받은 행 0건 — 조건이 바뀌었거나 서버가 빈 응답을 줬다';
  const blank = (dropped['제목 없음'] || 0);
  if (blank * 2 > rows.length) return `${rows.length}행 중 ${blank}행이 '제목 없음' — 응답 칸 이름이 명세와 달라졌다(리포트의 첫 행 칸을 보고 open-api-map.mjs 를 고친다)`;
  return null;
}

/* 지난 활동 글 + 이번에 받은 출처별 결과 → 새 활동 글 목록.
   results: { [source]: { ok: true, items } | { ok: false } }
   · 받아 온 출처: 그 출처의 지난 글을 이번 글로 **바꾼다**(닫힌 글은 빠진다). 처음 본 날(foundAt)은 이어받는다.
   · 못 받은 출처(열쇠 없음·오류): 지난 글을 **그대로 둔다**.
   · 게시판에서 주운 같은 글(주소가 같다)은 API 글이 대신한다 — 칸이 채워진 쪽이 이긴다(external-sources.md §8-1). 처음 본 날은 이어받는다.
   · 관리자가 숨긴 주소는 hidden 표식(collect.mjs 와 같은 규칙). */
export function mergeApi(prevItems, results, { today, hideUrls = new Set() }) {
  const prev = Array.isArray(prevItems) ? prevItems : [];
  /* 출처끼리도 같은 글은 하나 — 먼저 온 출처가 이긴다(안 합치면 감사가 '중복'으로 그날 결과를 통째로 버린다 · 리뷰 I1) */
  const fresh = [];
  const freshKeys = new Set();
  for (const [, r] of Object.entries(results)) {
    if (!r || !r.ok) continue;
    for (const n of r.items) {
      const k = canonUrl(n.url), tk = titleKey(n);
      if (freshKeys.has(k) || (tk && freshKeys.has(tk))) continue;
      freshKeys.add(k); if (tk) freshKeys.add(tk);
      fresh.push(n);
    }
  }
  const same = (n) => freshKeys.has(canonUrl(n.url)) || (titleKey(n) && freshKeys.has(titleKey(n)));
  const firstSeen = new Map();
  const note = (k, d) => { if (k && d && (!firstSeen.has(k) || d < firstSeen.get(k))) firstSeen.set(k, d); };
  for (const n of prev) { note(canonUrl(n.url), n.foundAt); note(titleKey(n), n.foundAt); }
  const replaced = new Set(Object.entries(results).filter(([, r]) => r && r.ok).map(([s]) => s));
  const kept = prev.filter((n) => {
    if (n.api && replaced.has(n.api)) return false;          // 받아 온 출처의 지난 글은 이번 글로 바뀐다
    if (same(n)) return false;                                // 같은 글은 API 쪽이 대신한다
    return true;
  });
  /* 상세를 못 받은 날(1365 상세 한 건 실패 등)은 **어제 받은 상세를 이어받는다** — 안 그러면 하루 동안 자격·안내 칸이 빈다(2026-10-01 코드 리뷰) */
  const prevByUrl = new Map(prev.filter((n) => n && n.url).map((n) => [canonUrl(n.url), n]));
  const DETAIL_KEYS = ['eligibilityLines', 'eligibilityExcludes', 'eligibilityPriority', 'noticeLines'];
  const added = fresh.map((n) => {
    const k = canonUrl(n.url);
    const old = prevByUrl.get(k);
    if (old && !DETAIL_KEYS.some((f) => (n[f] || []).length)) for (const f of DETAIL_KEYS) if ((old[f] || []).length) n = { ...n, [f]: old[f] };
    const first = [firstSeen.get(k), firstSeen.get(titleKey(n))].filter(Boolean).sort()[0];
    /* excerptsAt: 수집 로봇의 '원문 다시 읽기'가 건너뛰게 · seenAt: 오늘도 API 가 줬다 —
       수집 로봇의 60일 삭제는 API 글엔 처음 본 날이 아니라 이 날로 잰다(오래 열린 정책이 61일째 '새 글'로 돌아오지 않게 · 리뷰 I3) */
    const out = { ...n, foundAt: first || today, seenAt: today, excerptsAt: today };
    if (hideUrls.has(k)) out.hidden = true;
    for (const f of Object.keys(out)) if (out[f] === undefined) delete out[f];
    return out;
  });
  return added.concat(kept);
}
