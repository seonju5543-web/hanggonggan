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
import { createRequire } from 'node:module';
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

/* 2026-09-30 — 44개교 복원: 손으로 다듬은 14곳 밖의 서비스 학교는 **이름에서 만든다**(match-engine SERVED_SCHOOLS 를 읽는다 · 박아 두지 않는다).
   must = 정식 이름 또는 '대학교'를 뗀 짧은 이름(한글) · not = 분교·역·병원·로고 공통 목록 · 검색어는 한글만(영문 이름표는 학교마다 달라 짐작하지 않는다).
   id 는 학교별 공고 파일과 같은 규칙(noticeFileKey)이라 파일 이름이 학교마다 유일하다. 사진이 한 장도 없으면 그 학교는 리포트에 '없음'으로 남는다(조용히 넘어가지 않는다). */
const ME = createRequire(import.meta.url)('../match-engine.js');
/* 2026-10-03 — 한글 이름만으로는 한 장도 못 찾은 8곳(10-01 실행 로그 ⚠️)에 영문 이름표·검색어를 손으로 단다.
   분교는 본교 이름만 맞으면 본교 사진이 들어오므로 must 에 분교 낱말(Mirae·Sejong·Gyeongju…)까지 요구한다.
   이름이 겹치는 다른 학교(명지전문대·숭실사이버대·조선이공대·조선간호대)와 병원은 not 으로 뺀다. id 는 이름에서 만든 학교와 같은 규칙(noticeFileKey). */
for (const s of [
  { name: '연세대학교 미래캠퍼스', must: /Yonsei.*(?:Mirae|Wonju)|(?:Mirae|Wonju).*Yonsei|연세대.*(?:미래|원주)/i, not: /Hospital|병원|Severance|세브란스|Station|역|logo|로고|Museum|박물관/i,
    q: ['Yonsei University Mirae Campus', 'Yonsei University Wonju Campus', '연세대학교 미래캠퍼스', '연세대학교 원주캠퍼스', 'Yonsei Wonju', 'Yonsei University Wonju lake', '연세대학교 원주 매지호'] },
  { name: '고려대학교 세종캠퍼스', must: /Korea University.*Sejong|Sejong.*Korea University|고려대.*세종|Korea Univ.*Sejong/i, not: /Hospital|병원|Station|역|logo|로고/i,
    q: ['Korea University Sejong Campus', '고려대학교 세종캠퍼스', 'Korea University Sejong', '고려대 세종', 'Korea University Jochiwon'] },
  { name: '동국대학교 WISE캠퍼스', must: /Dongguk.*(?:Gyeongju|WISE)|(?:Gyeongju|WISE).*Dongguk|동국대.*(?:경주|WISE)/i, not: /Hospital|병원|Station|역|logo|로고/i,
    q: ['Dongguk University Gyeongju Campus', 'Dongguk University WISE', '동국대학교 경주캠퍼스', '동국대학교 WISE캠퍼스', 'Dongguk University Gyeongju', '동국대 경주'] },
  { name: '명지대학교', must: /Myong ?ji|명지대/i, not: /College|전문대|High School|고등학교|중학교|초등|Hospital|병원|Station|역|logo|로고|Bus|버스|Post ?office|우체국|Festival|축제/i,
    q: ['Myongji University', 'Myongji University Seoul campus', 'Myongji University Yongin', '명지대학교', 'Myongji University Natural Science Campus', '명지대학교 자연캠퍼스', '명지대학교 인문캠퍼스', 'Myongji University library'] },
  { name: '국민대학교', must: /Kookmin|국민대/i, not: /Station|역|logo|로고|Bank|은행|Post ?office|우체국/i,
    q: ['Kookmin University', 'Kookmin University campus', '국민대학교', 'Kookmin Univ', 'Kookmin University building', '국민대학교 본부관', 'Kookmin University library'] },
  { name: '숭실대학교', must: /Soong ?sil|숭실대/i, not: /Cyber|사이버|Station|역|logo|로고|High School|고등학교|중학교/i,
    q: ['Soongsil University', 'Soongsil University campus', '숭실대학교'] },
  { name: '경북대학교', must: /Kyungpook|경북대/i, not: /Hospital|병원|Station|역|logo|로고|Sangju|상주/i,
    q: ['Kyungpook National University', 'Kyungpook National University campus', 'Kyungpook National University main gate', '경북대학교'] },
  { name: '조선대학교', must: /Chosun University|조선대/i, not: /Hospital|병원|Station|역|logo|로고|이공대|Science and Technology|간호대|Nursing/i,
    q: ['Chosun University', 'Chosun University main building', 'Chosun University Gwangju', '조선대학교 본관'] },
  /* 2026-10-03 2차 — 1차(한글 이름만)에서 쓸 사진이 없던 학교. 영문 이름표·상징 건물 이름으로 넓힌다. 사람·실험실·우체국은 not 으로 미리 뺀다 */
  { name: '광운대학교', must: /Kwangwoon|광운대/i, not: /Station|역|logo|로고|Ice ?Rink|아이스링크|Post ?office|우체국/i,
    q: ['Kwangwoon University', 'Kwangwoon University campus', '광운대학교', '광운대학교 비마관', 'Kwangwoon University building'] },
  { name: '세종대학교', must: /Sejong University|세종대학교|세종대/i, not: /Korea University|고려대|Station|역|logo|로고|Hospital|병원|세종시|Sejong City|세종로|Sejong-ro|대왕|the Great|안전교육|협약|소방/i,
    q: ['Sejong University', 'Sejong University campus', '세종대학교 캠퍼스', '세종대학교 대양AI센터', 'Sejong University Seoul', '세종대학교 애지헌'] },
  { name: '가톨릭대학교', must: /Catholic University of Korea|가톨릭대/i, not: /Hospital|병원|성모|St\.? Mary|Kwandong|관동|대구가톨릭|Daegu|부산가톨릭|Busan|인천가톨릭|Incheon|Station|역|logo|로고/i,
    q: ['Catholic University of Korea', 'Catholic University of Korea Songsim', '가톨릭대학교 성심교정', '가톨릭대학교', 'Catholic University of Korea Bucheon'] },
  { name: '한국항공대학교', must: /Korea Aerospace University|한국항공대|항공대학교/i, not: /Laborator|Lab\b|연구실|실습실|Station|역|logo|로고/i,
    q: ['Korea Aerospace University', 'Korea Aerospace University campus', '한국항공대학교', '한국항공대학교 캠퍼스', 'Korea Aerospace University Goyang'] },
  { name: '경기대학교', must: /Kyonggi University|경기대/i, not: /Station|역|logo|로고|Hospital|병원/i,
    q: ['Kyonggi University', 'Kyonggi University campus', '경기대학교', 'Kyonggi University Suwon', '경기대학교 수원캠퍼스'] },
  { name: '서울교육대학교', must: /Seoul National University of Education|서울교육대|서울교대/i, not: /Station|역|logo|로고|부설|초등학교/i,
    q: ['Seoul National University of Education', '서울교육대학교', '서울교육대학교 정문', 'Seoul National University of Education campus'] },
  { name: '한국방송통신대학교', must: /Korea National Open University|방송통신대|방송대|\bKNOU\b/i, not: /Station|역|logo|로고|소방|응급처치|지역대학|Regional/i,
    q: ['Korea National Open University', '한국방송통신대학교', '한국방송통신대학교 본부', 'Korea National Open University Daehangno', '방송통신대학교 대학로'] },
  { name: '전남대학교', must: /Chonnam National University|전남대/i, not: /Hospital|병원|Yeosu|여수|Hwasun|화순|Station|역|logo|로고|미술학과|졸업작품/i,
    q: ['Chonnam National University', 'Chonnam National University campus', '전남대학교', '전남대학교 정문', 'Chonnam National University Gwangju', '전남대학교 용봉'] },
  { name: '부경대학교', must: /Pukyong|부경대/i, not: /Station|역|logo|로고/i,
    q: ['Pukyong National University', 'Pukyong National University campus', '부경대학교', '부경대학교 대연캠퍼스', 'Pukyong National University Daeyeon'] },
  { name: '강원대학교', must: /Kangwon National University|강원대/i, not: /Samcheok|삼척|Dogye|도계|Hospital|병원|Station|역|logo|로고/i,
    q: ['Kangwon National University', 'Kangwon National University campus', '강원대학교', '강원대학교 춘천캠퍼스', 'Kangwon National University Chuncheon'] },
]) SCHOOLS.push({ id: ME.noticeFileKey(s.name), ...s });
const GENERIC_NOT = /Station|역|병원|Hospital|logo|로고|모형|miniature|세종캠|Sejong|ERICA|글로컬|미래캠|원주|WISE|경주|안성|수원|용인|천안|Global Campus/i;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const name of ME.SERVED_SCHOOLS) {
  if (SCHOOLS.some((x) => x.name === name)) continue;
  const short = name.replace(/대학교$/, '');
  const isBranch = /캠퍼스$/.test(name);
  SCHOOLS.push({
    id: ME.noticeFileKey(name), name, generated: true,
    /* 짧은 이름이 두 글자(부산·조선…)면 낱말 하나로는 딴 사진(부산 야경)이 걸린다 — `○○대` 꼴까지 있어야 받는다(리뷰 3차 2026-09-30) */
    must: new RegExp(short.length <= 2 ? `${esc(name)}|${esc(short)}대` : `${esc(name)}|${esc(short)}`),
    not: isBranch ? /Station|역|병원|logo|로고|모형/i : GENERIC_NOT,
    q: [`${name} 정문`, `${name} 캠퍼스`, `${name}`, `${short} 정문`],
  });
}

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

function pick(pages, school, opts = {}) {
  const out = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime)) continue;
    if ((ii.width || 0) < MIN_WIDTH) continue;
    /* 제목에 학교 이름이 없으면 낱말 대조가 우연히 맞은 것이다 — 버린다 */
    /* 학교의 위키미디어 분류·위키데이터 대표 사진에서 온 파일은 분류 자체가 근거라 제목 이름표를 묻지 않는다(not 은 그대로 — 로고·역·병원 거름) */
    if (school && ((!opts.skipMust && !school.must.test(p.title)) || (school.not && school.not.test(p.title)))) continue;
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

/* ── 2026-10-03 3차 출처 (개발자 지시 "사진이 없는 학교도 없어. 어떻게든 해당 학교의 사진을 찾고") ──
   검색 낱말 대조로 못 찾은 학교를 위해 ① 위키데이터의 학교 항목(이름이 정확히 같은 항목만)이 적어 둔 대표 사진(P18)·파노라마(P4291)·야경(P3451)·항공(P8592)
   ② 그 항목의 위키미디어 분류(P373) 안 파일(+ 하위 분류 한 단계) ③ Openverse(플리커 등의 CC 사진 모음 · 열린 라이선스만 · 제목/꼬리표에 학교 이름이 있어야)
   🔴 라이선스 거름(OK_LICENSE·BAD_LICENSE)은 똑같이 · 사람이 눈으로 고른다(이 파일은 고르지 않는다). SOURCES=wikidata,openverse 일 때만. */
const SOURCES = (process.env.SOURCES || '').split(',').map((x) => x.trim()).filter(Boolean);
async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function commonsFiles(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const data = await api({ action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: THUMB_WIDTH });
    out.push(...Object.values(data.query?.pages || {}));
  }
  return out;
}
async function categoryFiles(cat, depth = 1) {
  const files = [];
  const members = async (type, title) => {
    const data = await api({ action: 'query', list: 'categorymembers', cmtitle: title, cmtype: type, cmlimit: '60' });
    return (data.query?.categorymembers || []).map((m) => m.title);
  };
  files.push(...await members('file', `Category:${cat}`));
  if (depth > 0) for (const sub of (await members('subcat', `Category:${cat}`)).slice(0, 12)) files.push(...(await members('file', sub)).slice(0, 25));
  return [...new Set(files)];
}
async function wikidataCandidates(s) {
  const found = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=ko&uselang=ko&type=item&limit=5&search=${encodeURIComponent(s.name)}`);
  const hit = (found.search || []).find((x) => x.label === s.name);   // 이름이 정확히 같은 항목만 — 비슷한 이름(분교·전문대)을 데려오지 않는다
  if (!hit) return { files: [], note: '위키데이터에 같은 이름 항목 없음' };
  const ent = (await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${hit.id}`)).entities[hit.id];
  const vals = (pid) => ((ent.claims || {})[pid] || []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => typeof v === 'string');
  const direct = ['P18', 'P4291', 'P3451', 'P8592'].flatMap(vals).map((f) => `File:${f}`);
  const cats = vals('P373');
  const inCat = [];
  for (const c of cats) inCat.push(...await categoryFiles(c));
  return { files: [...new Set([...direct, ...inCat])], note: `${hit.id} · 대표 ${direct.length} · 분류 ${cats.join(',') || '없음'} ${inCat.length}` };
}
const OV_LIC = { by: 'CC BY', 'by-sa': 'CC BY-SA', cc0: 'CC0', pdm: 'Public domain' };
async function openverseCandidates(s) {
  const q = s.q.find((x) => /^[A-Za-z]/.test(x)) || s.name;
  const data = await getJson(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=by,by-sa,cc0,pdm&page_size=30&mature=false`);
  const out = [];
  for (const r of data.results || []) {
    const text = `${r.title || ''} ${(r.tags || []).map((t) => t.name).join(' ')}`;
    if (!s.must.test(text) || (s.not && s.not.test(r.title || ''))) continue;
    if ((r.width || 0) && r.width < MIN_WIDTH) continue;
    const lic = r.license === 'cc0' || r.license === 'pdm' ? OV_LIC[r.license] : `${OV_LIC[r.license]} ${r.license_version || ''}`.trim();
    if (!OV_LIC[r.license] || !OK_LICENSE.test(lic) || BAD_LICENSE.test(lic)) continue;
    out.push({ title: r.title || '(제목 없음)', pageUrl: r.foreign_landing_url || r.url, thumb: r.url, width: r.width, height: r.height,
      license: lic, licenseUrl: r.license_url || '', shareAlike: /SA/.test(lic), author: r.creator || '', credit: r.attribution || '', description: '', date: '', source: r.source || r.provider || '' });
  }
  return out;
}

/* 큰 원본(플리커 등)은 가로 1000px 로 줄여 둔다 — sharp 가 있을 때만(워크플로가 설치) · 없으면 6MB 넘는 원본은 받지 않는다 */
let sharpLib = null;
try { sharpLib = (await import('sharp')).default; } catch { /* 없으면 줄이지 않는다 */ }
async function download(url, file) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  let buf = Buffer.from(await res.arrayBuffer());
  if (sharpLib) {
    const meta = await sharpLib(buf).metadata();
    if ((meta.width || 0) > 1000) buf = await sharpLib(buf).rotate().resize({ width: 1000 }).jpeg({ quality: 86 }).toBuffer();
  } else if (buf.length > 6e6) throw new Error(`원본이 너무 큼 (${Math.round(buf.length / 1e6)}MB · sharp 없음)`);
  fs.writeFileSync(file, buf);
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
/* 사람이 고른 기록(picks — 시작 화면 14장 · build-app-gates.mjs 가 읽는다)과 걸러 낸 기록(pruned)은 다시 받아도 잇는다 — 안 이으면 다음 빌드가 사진 0장이 된다 */
for (const k of ['pruned', 'picks']) if (prev && prev[k] !== undefined) manifest[k] = prev[k];
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
  for (const c of cands) c.via = c.via || 'search';
  /* 3차 출처 — 검색 후보 뒤에 붙인다(같은 파일은 한 번) */
  if (SOURCES.includes('wikidata')) {
    try {
      const wd = await wikidataCandidates(s);
      console.log(`  · ${s.name} 위키데이터: ${wd.note}`);
      if (wd.files.length) for (const c of pick(await commonsFiles(wd.files), s, { skipMust: true })) if (!seen.has(c.title)) { seen.add(c.title); cands.push({ ...c, via: 'wikidata' }); }
    } catch (e) { console.log(`  ! ${s.name} 위키데이터: ${e.message}`); }
  }
  if (SOURCES.includes('openverse')) {
    try {
      for (const c of await openverseCandidates(s)) if (!seen.has(c.pageUrl)) { seen.add(c.pageUrl); cands.push({ ...c, via: 'openverse' }); }
    } catch (e) { console.log(`  ! ${s.name} Openverse: ${e.message}`); }
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
  console.log(`${s.name}: 후보 ${cands.length} · 받음 ${files.length}` + files.map((f) => `\n   · ${f.file}  ${f.license}${f.shareAlike ? ' (SA)' : ''}  [${f.via}] ${f.title}`).join(''));
}
const empty = manifest.schools.filter((m) => !(m.files || []).length).map((m) => m.name);
if (empty.length) console.log(`\n⚠️ 사진이 한 장도 없는 학교 ${empty.length}곳 — ${empty.join(' · ')} (위키미디어에 열린 라이선스 사진이 없거나 이름표가 파일 제목에 없다)`);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`\n합계 ${total}장 → ${OUT}/manifest.json`);
