// 학교 마스코트 그림 후보를 네이버 검색(NAVER API HUB)에 묻는다 — 3D 마스코트 시안(docs/designs/mascot-survey.md)의 빈 칸 메우기용.
// 저장소에 쓰지 않는다(그림은 학교 자산 — 공개 저장소에 싣지 않는다). 결과는 로그와 아티팩트(JSON)로만.
// 열쇠는 GitHub Secrets NAVER_CLIENT_ID · NAVER_CLIENT_SECRET — 값을 찍지 않는다.
import { writeFileSync } from 'node:fs';

const BASE = 'https://naverapihub.apigw.ntruss.com/search/v1/';
const Q = [
  ['경희대학교', '쿠옹'], ['한국외국어대학교', '부 Boo'], ['서울대학교', '스누베어'], ['연세대학교', '독수리'], ['고려대학교', '호이 환호'],
  ['서강대학교', '알로스'], ['성균관대학교', '명륜이 율전이'], ['한양대학교', '하이리온'], ['중앙대학교', '푸앙'], ['서울시립대학교', '이루매'],
  ['건국대학교', '쿠'], ['동국대학교', '아코'], ['동국대학교 WISE캠퍼스', ''], ['홍익대학교', '와우'], ['숙명여자대학교', '눈송이'],
  ['광운대학교', '비마'], ['명지대학교', '마루'], ['상명대학교', '수뭉이'], ['가천대학교', '무한이'], ['아주대학교', '치토'],
  ['국민대학교', '미스터닥터'], ['숭실대학교', '슝슝이'], ['세종대학교', '세린이'], ['이화여자대학교', ''], ['인하대학교', '안뇽'],
  ['부산대학교', '산지니'], ['가톨릭대학교', '하양이'], ['한국항공대학교', '마하'], ['경기대학교', '기룡이'], ['서울과학기술대학교', '테크뇽'],
  ['계명대학교', '비사'], ['서울교육대학교', '새록이'], ['한국방송통신대학교', '크누'], ['경북대학교', '호반우'], ['영남대학교', '푸르마'],
  ['전북대학교', '표범'], ['충남대학교', '차차'], ['전남대학교', '용비 봉비'], ['조선대학교', '조아'], ['충북대학교', '우왕이'],
  ['부경대학교', '백경이'], ['강원대학교', '곰두리'], ['연세대학교 미래캠퍼스', ''], ['고려대학교 세종캠퍼스', ''],
];
const id = (process.env.NAVER_CLIENT_ID || '').trim(), secret = (process.env.NAVER_CLIENT_SECRET || '').trim();
if (!id || !secret) { console.error('열쇠 없음 — NAVER_CLIENT_ID · NAVER_CLIENT_SECRET'); process.exit(1); }
const headers = { 'X-NCP-APIGW-API-KEY-ID': id, 'X-NCP-APIGW-API-KEY': secret };
/* 검색 결과 제목의 <b> 표시 떼기 — 더 지울 것이 없을 때까지, 남은 꺾쇠도 지운다(한 번만 떼면 CodeQL 「불완전한 여러 글자 정리」 high · 2026-11-19 #679) */
const clean = (x) => {
  let s = String(x || ''), prev;
  do { prev = s; s = s.replace(/<[^>]*>/g, ''); } while (s !== prev);
  return s.replace(/[<>]/g, '').replace(/&(quot|#39|amp|lt|gt);/g, ' ').replace(/[\s|]+/g, ' ').trim();
};
async function ask(kind, query, display) {
  try {
    const r = await fetch(`${BASE}${kind}?query=${encodeURIComponent(query)}&display=${display}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { status: r.status, items: [] };
    const j = await r.json(); return { status: 200, items: Array.isArray(j.items) ? j.items : [] };
  } catch (e) { return { status: String(e && e.name || 'error'), items: [] }; }
}
const out = [];
for (const [school, name] of Q) {
  const query = `${school} 마스코트 ${name}`.trim();
  const img = await ask('image', query, 8), web = await ask('webkr', `${school} 공식 마스코트 캐릭터`, 4);
  out.push({ school, query, imageStatus: img.status, webStatus: web.status,
    images: img.items.map((i) => ({ title: clean(i.title).slice(0, 40), link: i.link, thumb: i.thumbnail, w: i.sizewidth, h: i.sizeheight })),
    web: web.items.map((i) => ({ title: clean(i.title).slice(0, 50), link: i.link })) });
  console.log(`## ${school} | 그림 ${img.status}·${img.items.length} | 글 ${web.status}·${web.items.length}`);
  for (const i of out[out.length - 1].images) console.log(`I|${i.title}|${i.link}`);
  for (const w of out[out.length - 1].web) console.log(`W|${w.title}|${w.link}`);
  await new Promise((r) => setTimeout(r, 150));
}
writeFileSync(process.argv[2] || 'mascot-search.json', JSON.stringify(out, null, 1));
