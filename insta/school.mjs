/**
 * 교내 공고를 카드 재료로 바꾼다 — 경희대·한국외대 (2026-09-10)
 *
 * 교외(한국장학재단)는 칸이 나뉜 채로 오는데 교내는 **공고 원문 줄**만 있다.
 * 그래서 같은 `fields` 모양으로 맞춰 주면 렌더러·캡션·관문이 **한 줄도 안 바뀌고** 돈다.
 *
 * 🔴 자격/제외 가르기를 **여기서 새로 만들지 않는다.** 저장소에 이미 한 곳이 있다 —
 *    절 머리글은 `section-head.js`, 줄 단위 제외는 `match-engine.js` 의 `EXCLUDE_LINE`.
 *    베끼면 앱 화면과 카드가 서로 다른 말을 하게 된다(이 저장소가 다섯 번 겪은 유형).
 * 🔴 원문을 고치지 않는다(원칙 8-1). 줄을 **옮기기만** 한다.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const { sectionOf, headText } = require_('../section-head.js');
const { EXCLUDE_LINE } = require_('../match-engine.js');

const ROOT = new URL('../', import.meta.url);

/** 우리가 교내까지 하는 두 학교. 🔴 사진 풀(`insta/photos.json`)의 열쇠와 **같은 글자**여야
 *  그 학교 사진이 표지에 깔린다. 다르면 조용히 교외 사진이 나간다. */
export const SCHOOLS = [
  { key: '경희대', match: /경희대/, org: '경희대학교' },
  { key: '한국외대', match: /한국외국어대|한국외대/, org: '한국외국어대학교' },
];

/** 원문 줄을 자격/제외로 가른다.
 *  ① 절 머리글(`◎ 지원 제외 대상`)을 만나면 그 아래가 통째로 그 절이다 — `sectionOf`.
 *  ② 머리글이 없어도 **줄 자체가 제외를 말하면** 제외다(`* … 기수혜자는 지원불가`).
 *  🔴 ②가 없으면 학교 공고에서 제외 조항이 통째로 자격 칸으로 샌다(실측). */
export function splitLines(lines) {
  const qualify = [], exclude = [];
  let sec = 'qualify';
  for (const raw of lines || []) {
    const t = String(raw).trim();
    if (!t) continue;
    const s = sectionOf(t);
    if (s) {
      sec = s;
      // 🔴 **머리글 자체는 담지 않는다.** `2. 신청자격` 이 자격 한 줄로 들어가서
      //    표지 후킹이 `"2. 신청자격"` 으로 나왔다(실측). 머리글은 경계이지 내용이 아니다.
      continue;
    }
    // 🔴 '선발기준' 절은 자격이 아니다 — 자격을 갖춘 사람 중 어떻게 뽑나다(section-head.js).
    if (sec === 'select' || sec === 'other') continue;
    // 🔴 앞머리 번호·기호(`가 . `, `2. `, `①`)는 게시판 서식이지 사실이 아니다.
    //    떼는 규칙도 section-head.js 것을 쓴다 — 베끼지 않는다.
    const body = headText(t);
    if (!body) continue;
    (EXCLUDE_LINE.test(body) ? exclude : sec === 'exclude' ? exclude : qualify).push(body);
  }
  return { qualify, exclude };
}

/** 게시판 분류 꼬리표를 걷는다.
 *  🔴 **대괄호가 다 같은 게 아니다.** CLAUDE.md 가 경고한 그대로다 —
 *   · `[서울]` `[글로벌]` = **캠퍼스**, 그 캠퍼스 학생만 받는다는 **자격**이다 → 남긴다.
 *   · `[공통]` = 모든 캠퍼스, 즉 제한이 없다는 뜻 → 뗀다(빼도 잃는 게 없다).
 *   · `[교내]` `[국가]` `[국가근로]` = 분류. 카드가 이미 학교를 말하고 있다 → 뗀다.
 *  경희대는 대괄호 없이 `공통 ` `국제 ` 을 앞에 붙인다 — 같은 규칙으로 본다.
 *  꼬리의 `(~9/18)` 는 마감일인데 카드·캡션이 마감을 따로 크게 적으므로 뗀다.
 *  🔴 `cleanTitle`(collector) 은 조회수·작성일 유형이라 이걸 못 걷는다(실측). */
const CAMPUS = /^(서울|글로벌|국제|수원|용인)$/;
export const tidyTitle = (t) => String(t || '')
  .replace(/^(?:\s*\[([^\]]{1,8})\]\s*)+/g, (m) =>
    [...m.matchAll(/\[([^\]]+)\]/g)].map((x) => x[1].trim())
      .filter((w) => CAMPUS.test(w)).map((w) => `[${w}] `).join(''))
  .replace(/^(공통|국제|교내|국가근로|국가)\s+/, '')
  .replace(/\s*[(（]\s*~?\s*\d{1,2}\s*[/.]\s*\d{1,2}(?:[^()（）]|[(（][^()（）]*[)）])*[)）]\s*$/, '')
  .trim();

/** 여러 줄을 KOSAF 와 같은 `○` 글머리 한 덩어리로. 빈 배열이면 빈 문자열(칸 없음). */
const bullets = (a) => (a.length ? a.map((t) => `○ ${t}`).join(' ') : '');

/** 교내 공고 하나 → 카드 재료. 🔴 없는 값은 **지어내지 않고 빈 칸으로 둔다** —
 *  렌더러가 '앱에서 확인' 으로 정직하게 그린다. */
export function toNotice(x) {
  const school = SCHOOLS.find((s) => s.match.test(x.provider || '') || s.match.test(x.name || ''));
  if (!school) return null;
  const { qualify, exclude } = splitLines(x.eligibilityLines);
  return {
    code: x.id,
    // 🔴 기관명을 줄이지 않는다(축약 금지). `… 게시 공고`·`… 장학팀` 같은 꼬리만 뗀다.
    org: school.org,
    name: tidyTitle(x.name) || x.name,
    kind: '교내',
    due: x.deadline || null,
    home: x.sourceUrl || null,
    school: school.key,          // 표지 사진을 그 학교 것으로 고른다
    fields: {
      지원금액: bullets([x.amountSpec?.raw || x.amount].filter(Boolean)),
      신청기간: bullets([x.period].filter(Boolean)),
      특정자격: bullets(qualify),
      자격제한: bullets(exclude),
      '제출처 및 제출서류': bullets((x.documents || []).filter((d) => !/원문 확인|원문 공고/.test(d))),
      선발인원: '',              // 교내 공고는 인원을 거의 안 적는다 — 비워 둔다
    },
  };
}

/** 경희대·한국외대 교내 공고 전부. */
export function schoolNotices() {
  const r = JSON.parse(readFileSync(new URL('data/registered.json', ROOT), 'utf8'));
  return (r.items || r).filter((x) => x.type === '교내').map(toNotice).filter(Boolean);
}

// ── 실행 ────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const all = schoolNotices();
  const now = Date.now();
  console.log(`■ 교내 공고 ${all.length}건 (경희대·한국외대)`);
  for (const n of all) {
    const d = n.due ? Math.round((new Date(`${n.due}T23:59:59+09:00`) - now) / 864e5) : null;
    const f = n.fields;
    console.log(`  ${n.school.padEnd(6)} ${d === null ? '마감없음' : d < 0 ? '지남   ' : `D-${String(d).padStart(3)}`}  ${n.name}`);
    console.log(`         자격 ${f['특정자격'].split('○ ').length - 1}줄 · 제한 ${f['자격제한'].split('○ ').length - 1}줄`
      + ` · 금액 ${f['지원금액'] ? '있음' : '없음'} · 서류 ${f['제출처 및 제출서류'].split('○ ').length - 1}개`);
  }
}
