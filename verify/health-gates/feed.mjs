/* 「로봇·도구 점검 관문」 feed 묶음 — 실시간 공고 피드 복구·자가 회복 (2026-10-04 대대적 점검)
   잰다:
     ① 장부 메우기(publish-notices.mjs healFromLedger · collect-05/collect-01) — 9-30 병합기가 notices.json 을 200건으로 잘라 15개교 215건이
        학생 화면에서 빠졌는데, 수집기는 seen.json 만 보고 '피드에 있는가'는 안 물어 **영영 안 돌아왔다**.
        ⓐ 메우기만 하고 지금 글은 바꾸지 않는다(같은 객체 · 주소 그대로) · 60일 · FEED_HEAL_SINCE · 첨부 · 서비스 밖 · foundAt 그대로 · 차례
        ⓑ 다리 막기 — 장부 안 두 변형이 피드 글과 이어져 감사의 '실시간 공고에 중복'(오류 → 데이터 관문 빨간불)을 만들지 않는다 · 글 번호로 이어진 것도
        ⓒ 두 수집기 모두 saveCandidates 줄 뒤 · dropUnserved 앞에서 부른다 · 학교별 파일(readSchoolFiles)을 opts.current 로 넘긴다 · 리포트 🔁 는 restored 만
        ⓓ (리뷰 R1) 학생이 지금 보는 판(학교별 파일)이 장부보다 먼저 — notices.json 상한(학교당 40)에 잘렸다 다시 실리는 글이 장부의 수집 당시
           주소로 되돌아가지 않는다(고친 주소 X · 10-03 이 표식으로 바꾼 Y) · 수집기 끝부분과 같은 차례로 두 번·세 번 돌려 잰다
        ⓔ (리뷰 R2) 메운 글 주소의 HTML 기호(&#038;)는 앱과 같은 함수로 되돌린다 · ⓕ (리뷰 R3) 진짜 유실(restored)과 상한에 잘린 글(kept)을 따로 센다
     ② 고아 파일(publishBySchool · app2-F4/collect-12) — 목록에 글이 없는 학교의 옛 파일은 빈 파일로 · 이미 빈 파일·못 읽는 파일·이름이 안 맞는 파일은 그대로
     ③ 화면 0건 학교(zeroFeedSchools · app2-F2/collect-06) — 리포트 머리 한 줄
     ④ 누락 감사(coverage-rules classifyMiss inLedger · collect-10) — 장부에만 남은 글을 '가진 것'으로 세지 않는다
     ⑤ 사람이 돌리는 메우기 도구(collector/heal-feed.mjs · collect-01 복구) — 임시 git 저장소에서 사고 직전 커밋을 원천으로 그대로 돌린다
     ⑥ (리뷰 R5) 수집기가 notices.json 을 못 읽은 실행(빈 목록으로 시작)에도 학교별 파일의 글이 비지 않는다
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { cleanEnv, stripComments } from './gate.mjs';
import { healFromLedger, publishBySchool, zeroFeedSchools, readSchoolFiles, dropUnserved, FEED_HEAL_SINCE } from '../../collector/publish-notices.mjs';
import { dedupeNotices, capNotices, urlKey, titleKey } from '../../collector/url-key.mjs';
import { classifyMiss } from '../../collector/coverage-rules.mjs';
import { isAttachmentEntry } from '../../collector/attachment-link.mjs';

const require = createRequire(import.meta.url);
const { noticeFileKey } = require('../../match-engine.js');

/* 감사(verify/audit-data.js '실시간 공고에 중복')와 같은 열쇠로 센 중복 수 */
const auditDup = (items) => {
  const u = new Set(); const t = new Set(); let d = 0;
  for (const n of items) {
    const uk = `u:${urlKey(n.url)}`; const tk = titleKey(n) ? `t:${titleKey(n)}` : null;
    if (u.has(uk) || (tk && t.has(tk))) d++;
    u.add(uk); if (tk) t.add(tk);
  }
  return d;
};

/* 수집기 끝부분(collect.mjs·browser-collect.mjs 의 '앱 발행' 단락)과 같은 함수·같은 차례 — 새 글 얹기 → 60일 → 첨부 → dedupe →
   메우기(학교별 파일 먼저 · 장부) → 서비스 밖 → 학교별 파일 발행(자르기 전) → notices.json 상한. 임시 폴더에만 쓴다. */
function collectorTail({ dir, today, served, notices, fresh = [], ledger = [] }) {
  const cutoff = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  let items = fresh.concat(notices || []);
  items = items.filter((n) => (n.foundAt || '9999') >= cutoff);
  items = items.filter((n) => !isAttachmentEntry(n));
  items = dedupeNotices(items);
  const counts = {};
  items = healFromLedger(items, ledger, { today, served, current: readSchoolFiles({ dir }), counts });
  items = dropUnserved(items, served);
  publishBySchool(items, { dir, today });
  return { notices: capNotices(items), counts };
}
const fileItems = (dir, school) => {
  try { return JSON.parse(fs.readFileSync(new URL(`${noticeFileKey(school)}.json`, dir), 'utf8')).items; } catch { return null; }
};

export default async function feed(eq, ctx) {
  const root = ctx.root;
  const TODAY = new Date('2026-10-04T00:00:00Z');
  const SERVED = ['경희대학교', '건국대학교'];

  /* ── ① ⓐ 메우기만 · 지금 글은 그대로 ── */
  {
    const A = { school: '경희대학교', title: '2026 고속도로 장학생 선발', url: 'https://k.kr/view?id=1', foundAt: '2026-10-01' };
    /* 같은 제목·다른 진짜 주소 · 첨부와 읽히는 마감 힌트가 있는 장부의 옛 판 — 그냥 합치면 preferNotice 가 이쪽을 고른다 */
    const A2 = { school: '경희대학교', title: '2026 고속도로 장학생 선발', url: 'https://k.kr/view?id=99', foundAt: '2026-09-30',
      attachments: [{ name: '신청서.hwp', url: 'https://k.kr/f/1' }], deadlineHint: '신청기간 : 10월 11일까지' };
    const B = { school: '건국대학교', title: '논산시장학회 장학생 선발', url: 'https://kk.kr/v?no=1', foundAt: '2026-09-30' };
    const B2 = { ...B, url: 'https://kk.kr/v?no=1&sort=2' };                                        // 정렬 순번만 붙은 같은 글
    const C = { school: '건국대학교', title: '2026 8월 장학 안내', url: 'https://kk.kr/v?no=2', foundAt: '2026-08-20' };   // FEED_HEAL_SINCE 앞
    const C0 = { school: '건국대학교', title: '2026 7월 장학 안내', url: 'https://kk.kr/v?no=3', foundAt: '2026-07-01' };  // 60일 밖
    const D = { school: '건국대학교', title: '장학 신청서.hwp', url: 'https://kk.kr/download.do?attachNo=3', foundAt: '2026-09-30' };   // 첨부
    const E = { school: '안서비스대학교', title: '2026 장학 안내', url: 'https://x.kr/1', foundAt: '2026-09-30' };       // 서비스 밖
    const feedIn = [A];
    const ledger = [A2, B, B2, C, C0, D, E];
    const out = healFromLedger(feedIn, ledger, { today: TODAY, served: SERVED });
    eq('① ⓐ 장부에서 메운다 — 지금 글 A 다음에 빠졌던 B 하나 (같은 글 변형·since 앞·60일 밖·첨부·서비스 밖은 안 싣는다)',
      out.map((n) => n.url), ['https://k.kr/view?id=1', 'https://kk.kr/v?no=1']);
    eq('  🔴 지금 글은 같은 객체 · 주소 그대로 (그냥 합치면 장부의 옛 판 id=99 로 되돌아간다)', [out[0] === A, out[0].url], [true, 'https://k.kr/view?id=1']);
    eq('  입력을 고치지 않는다 · foundAt 은 원래 날짜', [feedIn.length, ledger.length, out[1].foundAt], [1, 7, '2026-09-30']);
    const wide = healFromLedger(feedIn, ledger, { today: TODAY, served: SERVED, since: '0000-00-00' });
    eq("  since '0000-00-00' 이면 60일 규칙만 — 8월 글은 들고 7월(60일 밖)은 안 든다 · foundAt 내림차순",
      wide.map((n) => n.foundAt), ['2026-10-01', '2026-09-30', '2026-08-20']);
    eq('  기본 since = 44개교 복원일', FEED_HEAL_SINCE, '2026-09-29');
    eq('  메울 것이 없으면 피드 그대로', healFromLedger([A], [A2], { today: TODAY, served: SERVED }).map((n) => n === A), [true]);
    /* 제목은 저장하는 로봇과 같은 청소(cleanTitle)를 거친다 — 장부에는 청소 전 제목이 남아 있다 */
    const dirty = { school: '건국대학교', title: '2026학년도 2학기 성적우수 장학생 선발 안내 학생지원팀 2026-09-30 조회 738', url: 'https://kk.kr/v?no=9', foundAt: '2026-10-02' };
    const cleaned = healFromLedger([], [dirty], { today: TODAY, served: SERVED });
    eq('  메운 글의 제목은 청소한다 (장부 원본은 그대로)', [cleaned[0].title, dirty.title.length > cleaned[0].title.length, cleaned[0] !== dirty],
      ['2026학년도 2학기 성적우수 장학생 선발 안내', true, true]);
  }

  /* ── ① ⓑ 다리 막기 ── */
  {
    const A3 = { school: '경희대학교', title: '2026 하반기 미래인재 장학생 선발', url: 'https://k.kr/y', foundAt: '2026-10-01' };
    const p1 = { school: '경희대학교', title: '[장학] 미래인재 장학생 모집 안내', url: 'https://k.kr/x', foundAt: '2026-09-30' };
    const p2 = { school: '경희대학교', title: '2026 하반기 미래인재 장학생 선발', url: 'https://k.kr/x', foundAt: '2026-09-30', attachments: [{ name: 'b', url: 'https://k.kr/b' }] };
    const out = healFromLedger([A3], [p1, p2], { today: TODAY, served: SERVED });
    eq('① ⓑ 장부 두 변형(같은 주소·다른 제목)이 피드 글과 이어져도 감사의 중복 0 — 피드 글은 남긴다',
      [auditDup(out), out[0] === A3], [0, true]);
    /* 글 번호(pid)로 이어진 다리 — 목록 표식 g0 이 새 칸을 열고, 같은 제목의 진짜 주소 g1 이 그 칸을 이겨 피드 글 a 와 글 번호가 같아진다.
       감사(u/t)는 못 보지만 다음 실행의 dedupe 가 합쳤다 메우기가 다시 붙이는 일이 매번 되풀이된다 → dedupe 의 열쇠 전부로 대 본다 */
    const a = { school: '경희대학교', title: '2026 다문화 장학생 선발', url: 'https://u.ac.kr/bbs/u/1/123456/artclView.do', foundAt: '2026-10-01' };
    const g0 = { school: '경희대학교', title: '2026 다문화 장학 추천 안내', url: 'https://u.ac.kr/notice/list.do#n-다문화', foundAt: '2026-09-30' };
    const g1 = { school: '경희대학교', title: '2026 다문화 장학 추천 안내', url: 'https://u.ac.kr/bbs/u/2/123456/artclView.do', foundAt: '2026-09-30' };
    const o2 = healFromLedger([a], [g0, g1], { today: TODAY, served: SERVED });
    eq('  글 번호로 이어진 다리도 막는다 — 결과는 dedupe 를 다시 걸어도 그대로(숨은 중복 0)', [o2.length, dedupeNotices(o2).length], [1, 1]);
    /* 다리와 상관없는 새 글은 그대로 든다 */
    const z = { school: '경희대학교', title: '2026 다른 재단 장학생 선발', url: 'https://k.kr/z', foundAt: '2026-09-30' };
    eq('  다리 없는 새 글은 막지 않는다', healFromLedger([A3], [p1, p2, z], { today: TODAY, served: SERVED }).map((n) => n.url).includes('https://k.kr/z'), true);
  }

  /* ── ① ⓒ 두 수집기 배선 ── */
  for (const f of ['collector/collect.mjs', 'collector/browser-collect.mjs']) {
    const src = stripComments(fs.readFileSync(new URL(f, root), 'utf8'));
    const healAt = src.search(/notices\.items\s*=\s*healFromLedger\(notices\.items,\s*loadCandidates\(\)\.items,\s*\{\s*current:\s*readSchoolFiles\(\),\s*counts:\s*healCounts\s*\}\)/);
    const saveAt = src.indexOf('saveCandidates(mergeCandidates(loadCandidates().items, freshAll))');
    const dropAt = src.search(/notices\.items\s*=\s*dropUnserved\(notices\.items\)/);
    const pubAt = src.indexOf('publishBySchool(beforeCap)');
    eq(`① ⓒ ${f} — 장부 저장 뒤 · 서비스 밖 떨구기 앞 · 학교별 파일을 다시 쓰기 전에 지금 학교별 파일을 원천으로 넘겨 메운다 (불러 쓴다)`,
      [healAt > 0, saveAt > 0 && saveAt < healAt, dropAt > healAt, pubAt > healAt, /import \{[^}]*\bhealFromLedger\b[^}]*\breadSchoolFiles\b[^}]*\} from '\.\/publish-notices\.mjs'/.test(src)],
      [true, true, true, true, true]);
    eq('  리포트의 🔁 숫자는 진짜 유실(학교별 파일에도 없던 글 · restored)만 — 상한에 잘렸다 다시 실린 글(kept)은 안 센다 (리뷰 R3)',
      [/const healedCount = healCounts\.restored;/.test(src), /🔁[^`]*\$\{healedCount\}/.test(src)], [true, true]);
  }

  /* ── ① ⓓ 학생이 지금 보는 판이 장부보다 먼저 (리뷰 R1) ──
     같은 학교 글 40건(notices.json 학교당 상한) · 가장 오래된 X 는 링크 로봇이 표식 → 진짜 주소로 고친 글, Y 는 10-03 정리가 '다른 글을 여는 주소' →
     표식으로 바꾼 글. 장부(candidates.json)는 둘 다 수집 당시 판(X 표식 · Y 틀린 주소)을 들고 있다. 새 글 2건이 들어오면 X·Y 가 notices.json 에서 잘리고
     (학교별 파일에는 남는다), 다음 실행이 메울 때 장부 판을 쓰면 학교별 파일의 X·Y 주소가 수집 당시로 되돌아간다 — 그 뒤로는 notices.json 에 없어
     patchUrlsBySchool 도 못 고친다. */
  {
    const dir = pathToFileURL(fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-cap-')) + path.sep);
    const K = '경희대학교';
    const day = (i) => `2026-10-${String(3 - Math.floor(i / 20)).padStart(2, '0')}`;   // 10-03 · 10-02 (최신이 앞)
    const base = Array.from({ length: 38 }, (_, i) => ({ school: K, title: `2026 표본 장학 공고 ${i + 1}호 선발 안내`, url: `https://k.kr/v?no=${100 + i}`, foundAt: day(i) }));
    const X = { school: K, title: '2026 산재근로자 자녀 장학생 선발', url: 'https://k.kr/v?no=7', foundAt: '2026-09-30' };          // 링크 로봇이 고친 진짜 주소
    const Y = { school: K, title: '2026 하반기 지역인재 장학생 모집', url: 'https://k.kr/list.do#n-지역인재', foundAt: '2026-09-29' };   // 10-03 정리가 표식으로
    const ledger = [...base.map((n) => ({ ...n })),
      { ...X, url: 'https://k.kr/list.do#n-산재', attachments: [{ name: '신청서.hwp', url: 'https://k.kr/f/7' }] },   // 수집 당시 표식 (첨부 점수까지 있다)
      { ...Y, url: 'https://k.kr/v?no=999', deadlineHint: '신청기간 : 10월 30일까지' }];                               // 수집 당시 '다른 글을 여는 주소'
    const notices0 = base.concat([X, Y]);
    publishBySchool(notices0, { dir, today: TODAY });
    const fresh = [{ school: K, title: '2026 새 장학 공고 가 선발', url: 'https://k.kr/v?no=501', foundAt: '2026-10-04' },
      { school: K, title: '2026 새 장학 공고 나 선발', url: 'https://k.kr/v?no=502', foundAt: '2026-10-04' }];
    const runA = collectorTail({ dir, today: TODAY, served: SERVED, notices: notices0.map((n) => ({ ...n })), fresh, ledger });
    const inN = (r, u) => r.notices.some((n) => n.url === u);
    const urlIn = (title) => (fileItems(dir, K) || []).filter((n) => n.title === title).map((n) => n.url);
    eq('① ⓓ (전제) 새 글 2건이 들어오면 가장 오래된 X·Y 는 notices.json 상한(학교당 40)에서 잘리고 학교별 파일에는 남는다',
      [runA.notices.length, inN(runA, X.url), inN(runA, Y.url), urlIn(X.title), urlIn(Y.title)], [40, false, false, [X.url], [Y.url]]);
    const runB = collectorTail({ dir, today: TODAY, served: SERVED, notices: runA.notices, ledger: ledger.concat(fresh) });
    const runC = collectorTail({ dir, today: TODAY, served: SERVED, notices: runB.notices, ledger: ledger.concat(fresh) });
    eq('  🔴 다음 실행·그다음 실행에도 학교별 파일의 X 는 고친 주소, Y 는 표식 그대로 (장부의 수집 당시 판으로 되돌아가지 않는다)',
      [urlIn(X.title), urlIn(Y.title), (fileItems(dir, K) || []).length], [[X.url], [Y.url], 42]);
    eq('  잘렸다 다시 실린 둘은 진짜 유실이 아니다 — kept 로만 센다 (리포트 🔁 에 안 뜬다 · 리뷰 R3)', [runB.counts, runC.counts], [{ restored: 0, kept: 2 }, { restored: 0, kept: 2 }]);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ── ① ⓔ 메운 글 주소의 HTML 기호 되돌리기 (리뷰 R2) · ⓕ 숫자 나누기 (리뷰 R3) ── */
  {
    const K2 = '경희대학교';
    const L = { school: K2, title: '2026학년도 2학기 학자금대출 안내[재학생]', url: 'https://s.kr/notice/?mod=document&#038;category1=%EC%9E%A5%ED%95%99&#038;uid=316', foundAt: '2026-09-30' };
    const L2 = { school: K2, title: '2026학년도 2학기 학자금대출 안내[수료생]', url: 'https://s.kr/notice/?mod=document&amp;#038;uid=323', foundAt: '2026-09-30' };
    const shownE = { school: K2, title: '2026 표본 재단 장학생 선발', url: 'https://s.kr/notice/?mod=document&amp;uid=400', foundAt: '2026-10-01' };
    const counts = {};
    const out = healFromLedger([], [L, L2], { today: TODAY, served: SERVED, current: [shownE], counts });
    eq('① ⓔ 메운 글 주소의 &#038;·&amp; 를 되돌린다 (장부·학교별 파일 원본은 그대로) — 안 하면 #038; 뒤가 조각이 되어 글 번호가 잘린다',
      [out.map((n) => n.url).sort(), L.url.includes('&#038;'), shownE.url.includes('&amp;')],
      [['https://s.kr/notice/?mod=document&category1=%EC%9E%A5%ED%95%99&uid=316', 'https://s.kr/notice/?mod=document&uid=323', 'https://s.kr/notice/?mod=document&uid=400'], true, true]);
    eq('① ⓕ 학교별 파일에도 없던 글(restored) · 학교별 파일에 있던 글(kept)을 따로 센다', counts, { restored: 2, kept: 1 });
  }

  /* ── ② 고아 파일 → 빈 파일 ── */
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-orphan-'));
    const at = (f) => path.join(dir, f);
    const key = (s) => `${noticeFileKey(s)}.json`;
    const J = (x) => JSON.stringify(x, null, 1);
    fs.writeFileSync(at(key('충북대학교')), J({ school: '충북대학교', updatedAt: '2026-09-30', items: [{ school: '충북대학교', title: '옛 글', url: 'https://c.kr/1', foundAt: '2026-09-30' }] }));
    const emptyBytes = J({ school: '충남대학교', updatedAt: '2026-09-01', items: [] });
    fs.writeFileSync(at(key('충남대학교')), emptyBytes);
    fs.writeFileSync(at(key('한국방송통신대학교')), '{ 깨진 json');
    const otherBytes = J({ school: '충북대학교', items: [{ title: '이름이 안 맞는 파일' }] });
    fs.writeFileSync(at('nzzzzzz.json'), otherBytes);
    const r = publishBySchool([{ school: '경희대학교', title: '새 글', url: 'https://k.kr/1', foundAt: '2026-10-03' }],
      { dir: pathToFileURL(dir + path.sep), today: TODAY });
    const orphan = JSON.parse(fs.readFileSync(at(key('충북대학교')), 'utf8'));
    eq('② 목록에 글이 없는 학교의 옛 파일은 빈 파일로 (지우지 않는다 · 날짜는 발행일)', [orphan.items.length, orphan.updatedAt, orphan.school, r.emptied], [0, '2026-10-04', '충북대학교', 1]);
    eq('  이미 빈 파일 · 못 읽는 파일 · 이름 규칙이 안 맞는 파일은 바이트 그대로',
      [fs.readFileSync(at(key('충남대학교')), 'utf8') === emptyBytes, fs.readFileSync(at(key('한국방송통신대학교')), 'utf8'), fs.readFileSync(at('nzzzzzz.json'), 'utf8') === otherBytes],
      [true, '{ 깨진 json', true]);
    const idx = JSON.parse(fs.readFileSync(at('index.json'), 'utf8'));
    eq('  색인에는 글이 있는 학교만 (앱의 옛 파일 물러나기 판단 그대로)', Object.keys(idx.files), ['경희대학교']);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ── ③ 화면 0건 학교 ── */
  {
    eq('③ zeroFeedSchools — 글이 하나도 없는 서비스 학교를 차례대로 · 빈 목록이면 전부',
      [zeroFeedSchools([{ school: '가' }, { school: '가' }, null], ['가', '나', '다']), zeroFeedSchools([], ['가', '나'])], [['나', '다'], ['가', '나']]);
    const src = stripComments(fs.readFileSync(new URL('collector/collect.mjs', root), 'utf8'));
    const pubAt = src.indexOf('publishBySchool(beforeCap)');
    const zAt = src.indexOf('zeroFeedSchools(beforeCap)');
    eq('  수집 리포트가 발행 목록으로 재고 머리에 한 줄 적는다 (까닭은 게시판 상태 줄에서)',
      [pubAt > 0 && zAt > pubAt, /lines\.push\(`🙋 서비스 학교인데 앱 실시간 공고 0건 \$\{zeroFeed\.length\}곳/.test(src), /게시판 주소 미설정/.test(src)], [true, true, true]);
  }

  /* ── ④ 누락 감사 — 장부에만 남은 글 ── */
  {
    const deps = { keywords: /장학/, isMenuEntry: () => false, isAttachmentEntry: () => false, page: 1 };
    const T = '2026학년도 2학기 성적우수장학금 선발 공고';
    eq("④ 피드엔 없고 장부에만 있는 글은 '수집했지만 피드에서 빠짐' · 넘기지 않으면 예전처럼 '원인 미상'",
      [classifyMiss(T, { ...deps, inLedger: () => true }), classifyMiss(T, deps), classifyMiss(T, { ...deps, inLedger: () => false })],
      ['수집했지만 피드에서 빠짐', '원인 미상', '원인 미상']);
    const src = stripComments(fs.readFileSync(new URL('collector/audit-coverage.mjs', root), 'utf8'));
    eq('  감사의 \'가진 것\' = 학생이 보는 것(notices.json + 학교별 파일) · 장부는 inLedger 로만',
      [/\[\.\.\.notices, \.\.\.candidates\]/.test(src), /inLedger:/.test(src), /\.\.\/data\/notices\//.test(src), /bySchool\(candidates\)/.test(src)], [false, true, true, true]);
  }

  /* ── ⑥ notices.json 을 못 읽은 실행 (리뷰 R5) — 수집기는 빈 목록으로 시작한다 ──
     예전 메우기는 장부의 FEED_HEAL_SINCE 이후 글만 메워, 그 전 글(9-29 전 경희·외대)과 상한에 잘린 글만 있던 학교 파일이 빈 파일로 다시 쓰였다. */
  {
    const dir = pathToFileURL(fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-noread-')) + path.sep);
    const old = { school: '경희대학교', title: '2026 9월 장학 안내 (FEED_HEAL_SINCE 전 수집)', url: 'https://k.kr/v?no=11', foundAt: '2026-09-20' };
    const gone = { school: '건국대학교', title: '2026 7월 장학 안내 (60일 밖)', url: 'https://kk.kr/v?no=12', foundAt: '2026-07-20' };
    publishBySchool([old, gone], { dir, today: new Date('2026-09-21T00:00:00Z') });
    const r = collectorTail({ dir, today: TODAY, served: SERVED, notices: [], ledger: [] });
    eq('⑥ notices.json 을 못 읽어도(빈 목록) 학교별 파일의 60일 안 글은 비지 않는다 · 60일 밖 글만 있던 파일은 빈 파일로',
      [(fileItems(dir, '경희대학교') || []).map((n) => n.url), (fileItems(dir, '건국대학교') || []).length, r.counts], [[old.url], 0, { restored: 0, kept: 1 }]);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ── ⑤ 사람이 돌리는 메우기 도구 — 임시 git 저장소에서 그대로 돌린다 ── */
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-tool-'));
    const w = (rel, body) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), JSON.stringify(body, null, 1)); };
    const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: cleanEnv() });
    g('init', '-q'); g('config', 'user.email', 'gate@example.com'); g('config', 'user.name', 'gate'); g('config', 'commit.gpgsign', 'false');
    const day = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);   // 도구는 지금 시각으로 60일을 잰다
    const K = '경희대학교';
    /* 사고 전 판에는 첨부·읽히는 마감 힌트가 있다 — 그냥 합치면 preferNotice 가 이 옛 판을 골라 고친 주소가 되돌아간다 */
    const a = { school: K, title: '2026 표본 장학생 선발 안내', url: 'https://k.kr/v?no=1', foundAt: day(1),
      attachments: [{ name: '신청서.hwp', url: 'https://k.kr/f/1' }], deadlineHint: '신청기간 : 10월 11일까지' };
    const b = { school: K, title: '2026 표본 재단 장학생 모집', url: 'https://k.kr/v?no=2', foundAt: day(20) };
    const fileK = `data/notices/${noticeFileKey(K)}.json`;
    w('data/notices.json', { updatedAt: day(0), items: [a, b] }); w(fileK, { school: K, updatedAt: day(0), items: [a, b] });
    g('add', '-A'); g('commit', '-qm', '사고 전');
    const snap = g('rev-parse', 'HEAD').stdout.trim();
    const a2 = { school: K, title: a.title, url: 'https://k.kr/v?no=1&fixed=1', foundAt: a.foundAt };   // 사고 뒤 링크 로봇이 고친 주소 — 메우기가 되돌리면 안 된다
    w('data/notices.json', { updatedAt: day(0), items: [a2] }); w(fileK, { school: K, updatedAt: day(0), items: [a2] });
    g('add', '-A'); g('commit', '-qm', '사고(잘림)');
    const tool = fileURLToPath(new URL('collector/heal-feed.mjs', root));
    const run = (...args) => spawnSync(process.execPath, [tool, ...args], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
    const dry = run('--dry', '--since=0000-00-00', `git:${snap}:data/notices/`);
    const dryClean = g('status', '--porcelain').stdout.trim() === '';
    const bad = run('--since=0000-00-00', 'git:없는커밋:data/notices.json');
    const badClean = g('status', '--porcelain').stdout.trim() === '';
    const r = run('--since=0000-00-00', `git:${snap}:data/notices/`, `git:${snap}:data/notices.json`);
    const feedOut = JSON.parse(fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8')).items;
    const fileOut = JSON.parse(fs.readFileSync(path.join(dir, fileK), 'utf8')).items;
    eq('⑤ 메우기 도구 — --dry 와 못 읽는 원천은 아무것도 안 쓴다 · 사고 직전 커밋에서 빠진 글만 메운다',
      [dry.status, dryClean, bad.status, badClean, r.status], [0, true, 1, true, 0]);
    eq('  notices.json·학교별 파일 둘 다 · 고친 주소는 그대로 · 메운 글의 foundAt 은 원래 날짜',
      [feedOut.map((n) => n.url), fileOut.map((n) => n.url), feedOut[1] && feedOut[1].foundAt], [[a2.url, b.url], [a2.url, b.url], b.foundAt]);
    eq('  JSON.stringify(x, null, 1) 로 저장한다 (로봇과 같은 꼴)',
      fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8') === JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8')), null, 1), true);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
