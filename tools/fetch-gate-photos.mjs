#!/usr/bin/env node
/* 인서울 주요 대학 정문 사진 수집 — 위키미디어 공용(Commons)에서 **라이선스가 열린 것만** 받는다.
   (2026-09-18 개발자 지시: "sky·서성한·중경외시·건동홍숙 정문 자료를 찾아 2.5초씩 보여 주는 영상으로")

   왜 로봇인가: 작업 샌드박스는 위키미디어·대학 홈페이지가 전부 막혀 있다(403). 바깥에 닿는 것은
   GitHub Actions 뿐이라(수집 로봇들과 같은 길) 이 파일을 Actions 에서 돌려 결과를 커밋한다.
   실행: `tools/run-gate-photos.txt` 를 고쳐 push (push-to-run) → `docs/designs/assets/gates/` 에
   사진과 `manifest.json`(출처·작가·라이선스·표기 문구)이 커밋된다.

   🔴 대학 공식 홈페이지 사진은 받지 않는다 — 저작권이 학교에 있어 앱에 못 쓴다.
      Commons 도 **CC0 · CC BY · CC BY-SA · 퍼블릭 도메인만** 받고, NC(비영리)·ND(변경 금지)는 버린다.
      BY-SA 는 표기 + 동일조건(영상도 같은 라이선스)이라 manifest 에 `shareAlike: true` 로 적어 둔다.
   ⚠️ 검색은 낱말 대조라 엉뚱한 사진(역·동상·건물)이 섞인다 — 학교당 후보를 여러 장 받아 두고
      사람이 고른다. 이 파일은 고르지 않는다. */
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'docs/designs/assets/gates';
const PER_SCHOOL = Number(process.env.PER_SCHOOL || 5);
const MIN_WIDTH = 900;
const THUMB_WIDTH = '1000';   /* 1차 실행의 1400px 는 학교당 4장 × 14곳이 36MB 였다 — 시안 재료엔 1000px 이면 충분 */
const UA = 'HandaejangGateBot/0.1 (https://github.com/seonju5543-web/hanggonggan; design reference)';

/* 학교 — 검색어는 한국어·영어 둘 다 (Commons 파일명은 둘이 섞여 있다).
   🔴 `must`: 파일 제목에 학교 이름이 실제로 들어 있어야 받는다 (1차 실행에서 낱말 대조만으로는
      창덕궁 그림·서울대병원·한림성심대 정문·이대 사진이 서울대·고려대·연세대·시립대 칸에 들어왔다).
   🔴 `not`: 분교·역·병원처럼 이름은 맞지만 장면이 아닌 것을 뺀다 (한양 ERICA·성균관 수원·중앙 안성·
      연세 미래캠퍼스·서강대역·외대앞역·건국 로고). 분교는 법적으로 다른 학교다(CLAUDE.md). */
const SCHOOLS = [
  { id: 'snu', name: '서울대학교', must: /Seoul ?Nat(?:ional|l)\.? ?Univ|SNU|서울대/i, not: /Hospital|병원|Bundang|분당/i,   /* 2차: "SeoulNatlUnivMainGate…" 를 놓쳤다 — 줄임말도 받는다 */
    q: ['서울대학교 정문', 'Seoul National University main gate', 'Seoul National University Gwanak campus', 'Seoul National University gate'] },
  { id: 'korea', name: '고려대학교', must: /Korea University|고려대/i, not: /Sejong|세종/i,
    q: ['고려대학교 정문', 'Korea University main gate', 'Korea University Anam campus', 'Korea University main building'] },
  { id: 'yonsei', name: '연세대학교', must: /Yonsei|연세대/i, not: /Mirae|Wonju|미래|원주|International Campus|송도/i,
    q: ['연세대학교 정문', 'Yonsei University main gate', 'Yonsei University Sinchon', '연세대학교 신촌', 'Yonsei University Underwood'] },
  { id: 'sogang', name: '서강대학교', must: /Sogang|서강대/i, not: /Station|역|model|모형|miniature/i,   /* 2차: 모형 사진 한 장뿐이었다 */
    q: ['서강대학교 정문', 'Sogang University main gate', 'Sogang University', '서강대학교', 'Sogang University Seoul campus', 'Sogang University building', 'Sogang University Loyola', '서강대 본관'] },
  { id: 'skku', name: '성균관대학교', must: /Sungkyunkwan|SKKU|성균관대/i, not: /Suwon|수원|Natural Science/i,
    q: ['성균관대학교 정문', 'Sungkyunkwan University main gate', 'SKKU Main Gate', 'Sungkyunkwan University Seoul campus'] },
  { id: 'hanyang', name: '한양대학교', must: /Hanyang|한양대/i, not: /ERICA|Erica|Ansan|안산/i,
    q: ['한양대학교 정문', 'Hanyang University main gate', 'Hanyang University Seoul campus', '한양대학교 서울캠퍼스', 'Hanyang University'] },
  { id: 'cau', name: '중앙대학교', must: /Chung-?ang|CAU\b|중앙대/i, not: /Ansung|Anseong|안성|평동|Gwangmyeong|광명/i,
    q: ['중앙대학교 정문', 'Chung-ang Univ Maingate', 'Chung-Ang University', 'Chung-ang Univ', '중앙대학교', 'Chung-Ang University main gate', 'Chung-Ang University Seoul campus', 'CAU Seoul Heukseok'] },   /* 3차까지 0장 — 1차에 잡혔던 "Chung-ang Univ.Maingate" 를 다시 부른다 */
  { id: 'khu', name: '경희대학교', must: /Kyung ?Hee|경희대/i, not: /Global Campus|국제캠|Suwon|수원|Yongin|용인/i,
    q: ['경희대학교 정문', 'Kyung Hee University main gate', 'Kyung Hee University Seoul campus'] },
  { id: 'hufs', name: '한국외국어대학교', must: /Hankuk University of Foreign Studies|H\.?U\.?F\.?S|한국외대|외국어대/i, not: /Station|역|Global Campus|글로벌캠|Yongin|용인/i,
    q: ['한국외국어대학교 정문', 'Hankuk University of Foreign Studies main gate', 'Hankuk University of Foreign Studies Seoul Campus', 'HUFS Seoul'] },
  { id: 'uos', name: '서울시립대학교', must: /University of Seoul|서울시립대|시립대/i, not: /Station|역/i,
    q: ['서울시립대학교 정문', 'University of Seoul main gate', 'University of Seoul campus', '서울시립대학교 캠퍼스', 'University of Seoul'] },
  { id: 'konkuk', name: '건국대학교', must: /Konkuk|건국대/i, not: /logo|로고|Glocal|충주|Chungju/i,
    q: ['건국대학교 정문', 'Konkuk University main gate', 'Konkuk University Seoul campus', 'Konkuk University lake', 'Konkuk University'] },
  { id: 'dongguk', name: '동국대학교', must: /Dongguk|동국대/i, not: /Gyeongju|경주|WISE|Goyang|고양/i,
    q: ['동국대학교 정문', 'Dongguk University main gate', 'Dongguk University Seoul campus', 'Dongguk University'] },
  { id: 'hongik', name: '홍익대학교', must: /Hongik|홍익대/i, not: /Sejong|세종|Station|역/i,
    q: ['홍익대학교 정문', 'Hongik University main gate', 'Hongik University Gateway', 'Hongik University Seoul'] },
  { id: 'sookmyung', name: '숙명여자대학교', must: /Sookmyung|숙명/i, not: /library|도서관/i,
    q: ['숙명여자대학교 정문', 'Sookmyung Women\'s University main gate', 'Sookmyung Women\'s University campus', 'Sookmyung Women\'s University'] },
];

const OK_LICENSE = /^(CC0|CC BY(?:-SA)? [0-9.]+|Public domain|CC-PD-Mark|PD)/i;
const BAD_LICENSE = /NC|ND/;

async function api(params) {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`api ${res.status} ${url}`);
  return res.json();
}

async function search(q) {
  const data = await api({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: q, gsrlimit: '20',
    prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: THUMB_WIDTH,
  });
  return Object.values(data.query?.pages || {});
}

function pick(pages, school) {
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime)) continue;
    if ((ii.width || 0) < MIN_WIDTH) continue;
    /* 제목에 학교 이름이 없으면 낱말 대조가 우연히 맞은 것이다 — 버린다 */
    if (school && (!school.must.test(p.title) || (school.not && school.not.test(p.title)))) continue;
    const md = ii.extmetadata || {};
    const lic = (md.LicenseShortName?.value || '').trim();
    if (!OK_LICENSE.test(lic) || BAD_LICENSE.test(lic)) continue;
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    out.push({
      title: p.title, pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
      thumb: ii.thumburl || ii.url, width: ii.width, height: ii.height,
      license: lic, licenseUrl: md.LicenseUrl?.value || '', shareAlike: /SA/.test(lic),
      author: strip(md.Artist?.value), credit: strip(md.Credit?.value), description: strip(md.ImageDescription?.value).slice(0, 200),
      date: md.DateTimeOriginal?.value || '',
    });
  }
  return out;
}

async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

fs.mkdirSync(OUT, { recursive: true });
/* ONLY=snu,cau 이면 그 학교만 다시 받고 나머지 학교의 사진·기록은 그대로 둔다 (저장소가 매 실행 18MB 씩 불지 않게) */
const only = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const targets = only.length ? SCHOOLS.filter((s) => only.includes(s.id)) : SCHOOLS;
/* FRESH=1 이면 지난 실행의 사진을 먼저 비운다 — 안 비우면 걸러 낸 엉뚱한 사진이 폴더에 남는다 (ONLY 면 그 학교 것만) */
if (process.env.FRESH === '1') for (const f of fs.readdirSync(OUT)) if (/\.(jpe?g|png)$/i.test(f) && targets.some((s) => f.startsWith(s.id + '-'))) fs.unlinkSync(path.join(OUT, f));
const prevPath = path.join(OUT, 'manifest.json');
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, 'utf8')) : null;
const manifest = { fetchedAt: new Date().toISOString(), source: 'Wikimedia Commons (API search, namespace 6)', rule: 'CC0 · CC BY · CC BY-SA · PD 만 · NC/ND 제외 · 폭 900px 이상', schools: [] };
let total = 0;
for (const s of SCHOOLS) {
  if (!targets.includes(s)) { const kept = prev?.schools?.find((p) => p.id === s.id); if (kept) manifest.schools.push(kept); continue; }
  const seen = new Set(); const cands = [];
  for (const q of s.q) {
    try {
      for (const c of pick(await search(q), s)) { if (!seen.has(c.title)) { seen.add(c.title); cands.push({ ...c, query: q }); } }
    } catch (e) { console.log(`  ! ${s.name} "${q}": ${e.message}`); }
    if (cands.length >= PER_SCHOOL * 2) break;
  }
  const chosen = cands.slice(0, PER_SCHOOL);
  const files = [];
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const ext = /png/i.test(c.thumb) ? 'png' : 'jpg';
    const file = `${s.id}-${i + 1}.${ext}`;
    try { await download(c.thumb, path.join(OUT, file)); files.push({ file, ...c }); total++; }
    catch (e) { console.log(`  ! ${s.name} ${c.title}: ${e.message}`); }
  }
  manifest.schools.push({ id: s.id, name: s.name, candidates: cands.length, files });
  console.log(`${s.name}: 후보 ${cands.length} · 받음 ${files.length}` + files.map((f) => `\n   · ${f.file}  ${f.license}${f.shareAlike ? ' (SA)' : ''}  ${f.title}`).join(''));
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`\n합계 ${total}장 → ${OUT}/manifest.json`);
