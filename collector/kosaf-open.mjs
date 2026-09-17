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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyShells, readChars } from './kosaf-empty.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
/* 🔴 '층2에서 무엇을 학생에게 안 보일 것인가'는 **이 파일 하나**가 정한다.
   로봇이 적은 줄(by:'로봇')과 사람이 적은 줄(by:<메일>)이 한 장부에 같이 산다. */
export const BLOCK_PATH = path.join(ROOT, 'collector', 'kosaf-block.json');

export const blockKey = (code, file) => `${code}\u0000${file || ''}`;

/* 🔴 **못 읽은 것과 비어 있는 것을 가른다** (2026-09-14 수리).
   옛 판은 읽기·파싱 오류를 전부 삼켜 빈 장부를 돌려줬다. 그런데 같은 실행 끝의
   saveBlock 이 **로봇 줄만 담아 덮어써서**, 사람이 내려 둔 줄(hidden)과 '로봇이 틀렸다'고
   되살려 둔 줄(keep)이 통째로 사라지고 **종료코드 0 · 초록불**로 저장됐다(실측으로 재현).
   되살릴 길은 git 이력뿐인데 사람에게는 아무 신호도 안 갔다.
   지금은 `ok:false` 로 알리고, 부르는 쪽이 **저장을 건너뛴다**. 파일이 아예 없는 것은
   정상이다(처음 실행) — 그건 ok:true 로 본다. */
export function loadBlock(file = BLOCK_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ok: true, updatedAt: '', hidden: [], keep: [] };
    return { ok: false, why: `장부를 읽지 못했습니다: ${e.message}`, updatedAt: '', hidden: [], keep: [] };
  }
  try {
    const j = JSON.parse(raw);
    return { ok: true, updatedAt: j.updatedAt || '', hidden: j.hidden || [], keep: j.keep || [] };
  } catch (e) {
    return { ok: false, why: `장부가 깨졌습니다: ${e.message}`, updatedAt: '', hidden: [], keep: [] };
  }
}

/* 로봇 기록장과 같은 모양으로 저장한다 — 들여쓰기 1칸(CLAUDE.md '데이터 파일 형식') */
export function saveBlock(block, file = BLOCK_PATH) {
  fs.writeFileSync(file, `${JSON.stringify(block, null, 1)}\n`);
}

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

/** 마감 전인 것만, 앱이 쓰는 칸만.
    `block` 을 주면 거기 적힌 것을 학생 화면에서 내린다(장부가 비면 예전과 똑같이 동작한다).
    🔴 내리는 단위는 둘이다 — `file` 이 있으면 **그 첨부 하나만**, 없으면 그 재단 통째로.
       속이 빈 공고문 때문에 재단째 내리면, 멀쩡히 모집 중인 장학금 5건이 학생에게서
       사라진다(실측: 가천문화재단·한진해운·동산·한국해기사협회·영국문화원).
    🔴 `keep`(사람이 '자동 판정이 틀렸다'고 적은 것)은 `hidden` 을 이긴다. */
export function slimKosaf(data, today, block = {}) {
  const keep = new Set((block.keep || []).map((b) => blockKey(b.code, b.file)));
  const hid = new Set((block.hidden || []).map((b) => blockKey(b.code, b.file))
    .filter((k) => !keep.has(k)));
  const items = (data.items || [])
    /* 재단째 내린 것 (지금은 안 쓰지만 앞으로 쓸 자리) */
    .filter((i) => !hid.has(blockKey(i.code, '')))
    /* 🔴 `학자금`은 장학금이 아니라 **대여(대출)** 다 — 열려 있는 126건 중 14건이 그렇고,
       금액 칸에 `연 이율 4.0% / 상환기간: 5년`·`대여한도액`이 그대로 적혀 있다.
       갚아야 하는 돈을 '받을 수 있는 장학금' 목록에 넣는 것은 기망이다(운영 원칙 2·
       app.js 의 대출 분리와 같은 규칙). 대출 안내는 실시간 공고 피드 쪽이 맡는다. */
    .filter((i) => i.goods === '장학금')
    /* 🔴 `due` 가 **빈 재단을 버리면 안 된다** (2026-08-30 개발자 지적으로 발견).
       한국장학재단 푸른등대 기부장학금 4곳이 정확히 그 꼴인데, 상세를 열어 보면
       `신청기간: ㅇ1학기: 2. 25. ~ 3. 12. ㅇ2학기: 8. 26. ~ 9. 10.` 처럼
       **해가 없는 학기 일정**이라 목록의 마감일 칸이 비어 있을 뿐 지금 모집 중이다
       (실제로 8/26~9/10 접수 중인 것을 통째로 버리고 있었다).
       해를 지어내지 않는다 — 마감일 없이 두고, 앱이 '기간 원문 확인'으로 정직하게 적는다. */
    .filter((i) => (i.due ? i.due >= today : !!((i.detail || {})['신청기간'] || '').trim()))
    .map((i) => {
      const fields = {};
      for (const k of FIELDS) {
        const v = String((i.detail || {})[k] || '').replace(/\s+/g, ' ').trim();
        /* '해당없음'은 정보가 아니라 빈칸이다 — 화면에 줄만 늘린다 */
        if (v && !/^[○ㅇ\s]*해당\s?없음$/.test(v)) fields[k] = v;
      }
      /* 🔴 **우리가 받아 둔 사본만** 담는다 (2026-09-12 — kosaf-attach.mjs).
         KOSAF 첨부 원주소는 Referer 검사가 있어 앱에서 누르면 "비정상적인 접근"이 뜬다.
         그래서 담는 것은 `data/kosaf-files/…` — 학생이 **우리 도메인에서** 받는 경로다.
         이것이 층2 재단에 붙는 유일한 '공고 원문'이다(KOSAF 상세는 POST 전용이라
         학생에게 줄 주소가 아예 없다). */
      const files = ((i.mirror || {}).files || [])
        .filter((f) => f && f.path && /^data\/kosaf-files\//.test(f.path))
        /* 🔴 내린 첨부는 앱 파일에 **실리지 않는다** — 그래서 앱 코드는 한 글자도 안 바뀐다.
           files 가 비면 아래에서 키 자체가 안 생기고, 화면의 '선발 공고문' 머리말도 안 그려진다. */
        .filter((f) => !hid.has(blockKey(i.code, f.name)))
        .map((f) => ({ name: f.name, path: f.path, bytes: f.bytes || 0 }));
      return { code: i.code, org: i.org, name: i.name, kind: i.kind,
        due: i.due || null, home: fixHome(i.home), fields,
        ...(files.length ? { files } : {}) };
    })
    /* 마감일을 모르는 것은 맨 뒤 — 앞에 두면 급한 공고를 밀어낸다 */
    .sort((a, b) => (!a.due) - (!b.due) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return { updatedAt: data.updatedAt, source: data.source, count: items.length, items };
}

/* ── 장부를 새로 쓰는 곳은 **여기 하나**다 ──────────────────────────────────
   순서가 이 설계의 전부다:
     ① 장부 없이 한 번 추린다(마감·대출 거르기만) — 이것이 '지금 열려 있는 재단'의 정의다
     ② 그 재단들의 첨부를 **열어 보고** 속이 빈 것을 고른다
     ③ 사람이 적어 둔 줄 중 **이미 끝난 회차**의 것을 지운다(장부가 영영 쌓이지 않게)
     ④ 로봇 줄을 ②로 통째로 갈아끼우고 장부를 저장한다
     ⑤ 장부를 적용해 앱 파일을 만든다
   🔴 ②는 글자 뽑기(.txt)가 끝난 **뒤**에 돌아야 한다 — 워크플로 단계 순서가 그래서 중요하다.
      사본이 처음 내려온 회차에 이 단계를 먼저 돌리면 아무것도 안 걸러진다. */
if (import.meta.url === `file://${process.argv[1]}`) {
  const today = new Date().toISOString().slice(0, 10);
  const src = JSON.parse(fs.readFileSync(new URL('../data/kosaf.json', import.meta.url), 'utf8'));

  const openBefore = slimKosaf(src, today);                                      // ①
  const auto = emptyShells(openBefore.items, (f) => readChars(ROOT, f));         // ②

  const block = loadBlock();
  /* 🔴 **장부를 못 읽었으면 저장하지 않는다** (2026-09-14). 그냥 이어서 저장하면 사람이
     내려 둔 줄과 되살려 둔 줄을 로봇 줄로 덮어써 없앤다 — 그것도 초록불로. 멈추는 쪽이
     낫다: 데이터는 그대로 남고, 사람이 장부를 고치면 다음 실행이 정상으로 돈다. */
  if (block.ok === false) {
    console.error(`::error::층2 내림 장부를 읽지 못해 저장을 건너뜁니다 — ${block.why}`);
    console.error('   collector/kosaf-block.json 을 고친 뒤 다시 실행하세요.'
      + ' (그대로 저장하면 사람이 내려 둔 줄과 되살려 둔 줄이 사라집니다)');
    process.exit(1);          // 여기는 모듈 맨 위의 if 블록이라 return 을 못 쓴다
  }
  const openCodes = new Set(openBefore.items.map((i) => i.code));
  const fullCodes = new Set((src.items || []).map((i) => i.code));
  /* 🔴 지우는 근거는 '마감일'이 아니라 **'지금 열린 목록에 없다 + 전체 목록에는 있다'** 둘이다.
     전체 목록에도 없으면(목록 파싱 실패·재단 삭제) **안 지운다** — 못 읽은 것을
     '끝났다'로 읽지 않는다. 마감일 칸이 빈 재단(푸른등대 4곳)은 ①에 남아 있어 안 걸린다. */
  const stale = (b) => !openCodes.has(b.code) && fullCodes.has(b.code);
  const humanHidden = (block.hidden || []).filter((b) => b.by !== '로봇' && !stale(b));  // ③
  const keep = (block.keep || []).filter((b) => !stale(b));
  /* 🔴 사람이 적어 둔 줄은 로봇이 덮지 않는다 — 내린 것(hidden)도, 되살린 것(keep)도.
     keep 을 안 거르면 로봇이 매 실행 같은 줄을 hidden 에 다시 적어, 장부에 '내림'과
     '되살림'이 나란히 쌓인다(결과는 keep 이 이겨 같지만, 사람이 읽고 결과를 못 맞힌다). */
  const taken = new Set([...humanHidden, ...keep].map((b) => blockKey(b.code, b.file)));
  const robotRows = auto                                                          // ④
    .filter((a) => !taken.has(blockKey(a.code, a.file)))
    .map((a) => ({ code: a.code, file: a.file, org: a.org, why: a.why, by: '로봇', at: today }));
  const next = { updatedAt: today, hidden: [...humanHidden, ...robotRows], keep };

  const out = slimKosaf(src, today, next);                                        // ⑤
  const hiddenFiles = next.hidden.filter((b) => b.file).length;
  console.log(`마감 전 ${out.count}건 (전체 ${src.items.length}건 중)`);
  console.log(`첨부: ${openBefore.items.reduce((n, i) => n + (i.files || []).length, 0)}개 중 `
    + `${hiddenFiles}개를 내렸다 (로봇 ${robotRows.length} · 사람 ${humanHidden.length} · 되살림 ${keep.length})`);
  for (const b of next.hidden) console.log(`  · ${b.org || b.code} / ${b.file || '(재단째)'} — ${b.why}`);
  if (process.argv.includes('--write')) {
    saveBlock(next);
    fs.writeFileSync(new URL('../data/kosaf-open.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
    console.log('→ collector/kosaf-block.json · data/kosaf-open.json 저장');
  } else console.log('(미리보기 — 저장하려면 --write)');
}
