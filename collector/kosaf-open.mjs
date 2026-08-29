/* 한국장학재단(KOSAF) 목록에서 **지금 열려 있는 것만** 추려 앱이 받을 파일로 만든다.
   (2026-08-30 신설 — docs/designs/kosaf-and-narrowing.md ②)

   왜 따로 만드나 — `data/kosaf.json` 은 1MB 다(재단 1,868곳 · 대부분 지난 회차).
   앱은 그것을 통째로 받을 수 없고, 받아도 학생에게 보여줄 것은 **마감 전인 것뿐**이다.

   🔴 여기서 나온 것은 앱의 **층2**다 — 우리가 원문을 읽은 공고(층1)와 섞으면 안 된다.
      KOSAF 는 재단은 다 알지만 **이번 회차는 19%만** 안다(실측). 그래서 자격 진단도,
      양식 작성도 붙이지 않고 **재단이 적어 둔 칸을 그대로 보여 주고 링크만** 준다.
   🔴 첨부(선발공고문) 주소를 여기 담지 말 것 — KOSAF 는 Referer 를 검사하는데
      앱은 리퍼러를 보내지 않아 학생이 누르면 "비정상적인 접근"이 뜬다.

   실행: node collector/kosaf-open.mjs [--write]   (kosaf-fetch --write 가 자동으로 부른다) */
import fs from 'node:fs';

/* 앱에 보여 줄 칸. KOSAF 가 채워 둔 20칸 중 **학생이 판단에 쓰는 것만** 남긴다.
   운영기관명·상품구분처럼 카드에 이미 있는 것과, 늘 '해당없음'인 칸은 뺀다. */
export const FIELDS = ['신청기간', '지원금액', '특정자격', '학년구분', '학과구분', '대학구분',
  '성적기준', '소득기준', '지역거주구분', '선발인원', '자격제한', '제출처 및 제출서류', '문의처'];

/* 🔴 KOSAF 원본에 **콜론이 빠진 주소**가 그대로 들어 있다(`http//www.jiheonsf.or.kr`).
   그냥 넘기면 앱의 safeUrl 이 그것을 **우리 사이트 안의 경로**로 풀어 버려,
   학생이 재단 홈페이지 대신 빈 화면으로 간다. 고칠 수 있으면 고치고, 아니면 버린다. */
export function fixHome(u) {
  const s = String(u || '').trim().replace(/^(https?)\/\//i, '$1://');
  if (/^https?:\/\/[^\s/]+\.[^\s/]/.test(s)) return s;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(s)) return `http://${s}`;
  return '';
}

/** 마감 전인 것만, 앱이 쓰는 칸만 */
export function slimKosaf(data, today) {
  const items = (data.items || [])
    /* 🔴 `학자금`은 장학금이 아니라 **대여(대출)** 다 — 열려 있는 126건 중 14건이 그렇고,
       금액 칸에 `연 이율 4.0% / 상환기간: 5년`·`대여한도액`이 그대로 적혀 있다.
       갚아야 하는 돈을 '받을 수 있는 장학금' 목록에 넣는 것은 기망이다(운영 원칙 2·
       app.js 의 대출 분리와 같은 규칙). 대출 안내는 실시간 공고 피드 쪽이 맡는다. */
    .filter((i) => i.goods === '장학금')
    .filter((i) => i.due && i.due >= today)
    .map((i) => {
      const fields = {};
      for (const k of FIELDS) {
        const v = String((i.detail || {})[k] || '').replace(/\s+/g, ' ').trim();
        /* '해당없음'은 정보가 아니라 빈칸이다 — 화면에 줄만 늘린다 */
        if (v && !/^[○ㅇ\s]*해당\s?없음$/.test(v)) fields[k] = v;
      }
      return { code: i.code, org: i.org, name: i.name, kind: i.kind,
        due: i.due, home: fixHome(i.home), fields };
    })
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return { updatedAt: data.updatedAt, source: data.source, count: items.length, items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = JSON.parse(fs.readFileSync(new URL('../data/kosaf.json', import.meta.url), 'utf8'));
  const out = slimKosaf(src, new Date().toISOString().slice(0, 10));
  console.log(`마감 전 ${out.count}건 (전체 ${src.items.length}건 중)`);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(new URL('../data/kosaf-open.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
    console.log('→ data/kosaf-open.json 저장');
  } else console.log('(미리보기 — 저장하려면 --write)');
}
