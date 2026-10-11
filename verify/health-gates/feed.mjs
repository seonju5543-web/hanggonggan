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
        ⓖ 학교별 파일 상한 · ⓗ (CC-1) 장부 원천은 9-30 사고 창(FEED_HEAL_UNTIL)까지만 — 사냥꾼이 합친 옛 판·제목을 고친 옛 판이 되살아나지 않는다 ·
           (리뷰 R2) 창 안 장부 표식도 사냥꾼이 푼 기록(link-hunt.json · resolvedNoticeUrls · readHuntMoves)으로 찾은 주소를 바꿔 끼운다 · 서울과기대 같은 글(bnum·bidx) ·
           (리뷰 R4) until '' 은 기본값
        ⓘ (CC-1) 사냥꾼이 바꾼 주소(movedNoticeUrls)로 학교별 파일도 고치고 파일 안에서 합친다 — 다음 수집 뒤에도 한 장 · (리뷰 R7) 색인 count 도
     ② 고아 파일(publishBySchool · app2-F4/collect-12) — 목록에 글이 없는 학교의 옛 파일은 빈 파일로 · 이미 빈 파일·못 읽는 파일·이름이 안 맞는 파일은 그대로
     ③ 화면 0건 학교(zeroFeedSchools · zeroFeedWhy · app2-F2/collect-06) — 리포트 머리 한 줄 · 까닭은 이번 상태 줄에서만(브라우저 학교를 '주소 없음'이라 적지 않는다)
     ④ 누락 감사(coverage-rules coverageSets · classifyMiss inLedger · collect-10 · 리뷰 R4) — 장부에만 남은 글을 '가진 것'으로 세지 않는다
        (가르는 곳은 순수 함수 하나 — 표본으로 잰다 · 감사 스크립트는 그 함수에 장부를 ledger 로만 넘긴다)
     ⑤ 사람이 돌리는 메우기 도구(collector/heal-feed.mjs · collect-01 복구) — 임시 git 저장소에서 사고 직전 커밋을 원천으로 그대로 돌린다 ·
        (리뷰 R1) --dry 가 메울 글을 한 줄씩([표식] · 원천)·--skip=<주소>·원천에 없는 --skip 은 멈춤 · 사냥꾼이 푼 표식은 찾은 주소로 · (리뷰 R4) since > until 은 멈춤
     ⑥ (리뷰 R5) 수집기가 notices.json 을 못 읽은 실행(빈 목록으로 시작)에도 학교별 파일의 글이 비지 않는다
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { cleanEnv, stripComments, stripYamlComments } from './gate.mjs';
import { healFromLedger, publishBySchool, zeroFeedSchools, zeroFeedWhy, readSchoolFiles, readHuntMoves, dropUnserved, patchUrlsBySchool, FEED_HEAL_SINCE, FEED_HEAL_UNTIL } from '../../collector/publish-notices.mjs';
import { movedNoticeUrls, resolvedNoticeUrls } from '../../collector/link-hunt-rules.mjs';
import { dedupeNotices, capNotices, urlKey, titleKey } from '../../collector/url-key.mjs';
import { classifyMiss, coverageSets, findMissing } from '../../collector/coverage-rules.mjs';
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
function collectorTail({ dir, today, served, notices, fresh = [], ledger = [], until }) {
  const cutoff = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  let items = fresh.concat(notices || []);
  items = items.filter((n) => (n.foundAt || '9999') >= cutoff);
  items = items.filter((n) => !isAttachmentEntry(n));
  items = dedupeNotices(items);
  const counts = {};
  /* until — 수집기는 넘기지 않는다(기본 FEED_HEAL_UNTIL). 장부 날짜가 사고 창 뒤인 옛 표본(상한 ⓖ)만 상한 없이('9999-12-31') 잰다 */
  items = healFromLedger(items, ledger, { today, served, current: readSchoolFiles({ dir }), counts, ...(until ? { until } : {}) });
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
    eq('  기본 since = 44개교 복원일 · 기본 until = 9-30 사고 창 끝 (CC-1)', [FEED_HEAL_SINCE, FEED_HEAL_UNTIL], ['2026-09-29', '2026-09-30']);
    eq('  메울 것이 없으면 피드 그대로', healFromLedger([A], [A2], { today: TODAY, served: SERVED }).map((n) => n === A), [true]);
    /* 차례 — 장부가 오래된 글 먼저여도 결과는 foundAt 내림차순(리뷰 2026-10-05 R2: wide 표본은 장부가 이미 최신순이라 정렬을 지워도 초록이었다).
       정렬이 없으면 메운 글이 맨 뒤에 붙어 capNotices(학교당 40)가 더 최근 글을 자르고, 앱은 파일 차례대로 그려 맨 아래에 보인다. */
    const Aold = { school: '경희대학교', title: '2026 차례 표본 지금 글', url: 'https://k.kr/view?id=31', foundAt: '2026-09-25' };
    const Cold = { school: '건국대학교', title: '2026 차례 표본 오래된 글', url: 'https://kk.kr/v?no=32', foundAt: '2026-08-20' };
    const Bnew = { school: '건국대학교', title: '2026 차례 표본 새 글', url: 'https://kk.kr/v?no=33', foundAt: '2026-09-30' };
    eq('  🔴 장부 차례가 [오래된 글, 새 글]이어도 결과는 foundAt 내림차순 (메운 글이 맨 뒤에 붙지 않는다)',
      healFromLedger([Aold], [Cold, Bnew], { today: TODAY, served: SERVED, since: '0000-00-00' }).map((n) => n.foundAt), ['2026-09-30', '2026-09-25', '2026-08-20']);
    /* 제목은 저장하는 로봇과 같은 청소(cleanTitle)를 거친다 — 장부에는 청소 전 제목이 남아 있다 */
    const dirty = { school: '건국대학교', title: '2026학년도 2학기 성적우수 장학생 선발 안내 학생지원팀 2026-09-30 조회 738', url: 'https://kk.kr/v?no=9', foundAt: '2026-09-30' };   // 사고 창 안
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
    /* moved: readHuntMoves() — 사냥꾼이 푼 표식(link-hunt.json)으로 장부 판의 주소를 바꿔 끼운다(리뷰 R2 · 동작은 ① ⓗ) */
    const healAt = src.search(/notices\.items\s*=\s*healFromLedger\(notices\.items,\s*loadCandidates\(\)\.items,\s*\{\s*current:\s*readSchoolFiles\(\),\s*moved:\s*readHuntMoves\(\),\s*counts:\s*healCounts\s*\}\)/);
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

  /* ── ① ⓖ 학교별 파일 상한 (리뷰 2026-10-05 R1) ──
     한 학교 장부 65건(60일 안 · FEED_HEAL_SINCE 뒤) · notices.json 40건(최신). 발행은 학교당 PER_SCHOOL(60)에서 자르는데 메우기가 그걸 모르면
     1회차에 25건을 '다시 실었다'고 세지만 파일에 드는 것은 20건이고, 2·3회차에도 같은 5건을 매번 '다시 실었다'고 센다(리포트 🔁 거짓). */
  {
    const dir = pathToFileURL(fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-perschool-')) + path.sep);
    const K = '경희대학교';
    const L = Array.from({ length: 65 }, (_, i) => ({ school: K, title: `2026 상한 표본 장학 공고 ${i + 1}호 선발 안내`, url: `https://k.kr/v?no=${1000 + i}`,
      foundAt: new Date(TODAY.getTime() - Math.floor(i / 11) * 86400000).toISOString().slice(0, 10) }));   // 10-04 … 09-29 (최신이 앞)
    const notices0 = L.slice(0, 40).map((n) => ({ ...n }));
    publishBySchool(notices0, { dir, today: TODAY });
    const urlsOf = () => (fileItems(dir, K) || []).map((n) => n.url);
    const before = new Set(urlsOf());
    const U = '9999-12-31';   // 표본 장부 날짜(10-04 … 09-29)가 사고 창 뒤까지 걸쳐 있다 — 상한 규칙만 재려고 창을 연다
    const run1 = collectorTail({ dir, today: TODAY, served: SERVED, notices: notices0, ledger: L, until: U });
    const addedToFile = urlsOf().filter((u) => !before.has(u)).length;
    const run2 = collectorTail({ dir, today: TODAY, served: SERVED, notices: run1.notices, ledger: L, until: U });
    const after2 = urlsOf();
    const run3 = collectorTail({ dir, today: TODAY, served: SERVED, notices: run2.notices, ledger: L, until: U });
    eq('① ⓖ 🔴 1회차 restored = 학교별 파일에 실제로 더해진 수 (상한 60 밖으로 밀리는 장부 글은 싣지도 세지도 않는다)',
      [run1.counts.restored, addedToFile, urlsOf().length], [20, 20, 60]);
    eq('  2·3회차는 restored 0 — 같은 글을 매 실행 \'다시 실었다\'고 세지 않는다 · 파일은 그대로 60건',
      [run2.counts, run3.counts, after2.length, urlsOf().join() === after2.join()], [{ restored: 0, kept: 20 }, { restored: 0, kept: 20 }, 60, true]);
    eq('  상한은 발행과 같은 값을 쓴다 (opts.perSchool 로 바꾸면 그만큼만)',
      [healFromLedger(notices0, L, { today: TODAY, served: SERVED, until: U }).length, healFromLedger(notices0, L, { today: TODAY, served: SERVED, perSchool: 45, until: U }).length], [60, 45]);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ── ① ⓗ 장부 원천은 9-30 사고 창까지만 (CC-1 · 2026-10-11) ──
     장부(candidates.json)는 수집 당시 주소·제목을 들고 있다. 링크 사냥꾼이 표식을 풀고 제목이 다른 짝과 합친 글(가천)·게시판이 제목을 고친 글(고려)은
     dedupeNotices 열쇠(주소·제목·글 번호)가 셋 다 어긋나, 창을 묶지 않으면 '빠진 글'로 되살아나 학생 화면에 같은 장학금이 두 장 뜬다. */
  {
    const S2 = [...SERVED, '가천대학교', '고려대학교'];
    const GT = '(생활비)2027년 아산사회복지재단 북한이탈청소년장학생 선발 안내';
    const R = { school: '가천대학교', title: `[공통] ${GT}`, url: 'https://www.gachon.ac.kr/bbs/kor/478/125899/artclView.do', foundAt: '2026-10-03' };
    const M = { school: '가천대학교', title: `[장학공지] ${GT}`, url: `https://www.gachon.ac.kr/kor/7986/subview.do#n-${encodeURIComponent(`[장학공지] ${GT}`)}`, foundAt: '2026-10-03' };
    const K1 = { school: '고려대학교', title: '[교외-11/2]2027학년도 해동과학문화재단 해동장학생 모집 안내(학교지원)', url: 'https://www.korea.ac.kr/ko/568/subview.do?enc=Zm5jdDF8QEB8JTJGcG9ydGFsQm9hcmQ%3D', foundAt: '2026-10-03' };
    const K0 = { school: '고려대학교', title: '[교외-11/3]2027학년도 해동과학문화재단 해동장학생 모집 안내(학교지원)', url: 'https://www.korea.ac.kr/ko/568/subview.do?article.offset=10&nttId=000100000000003865', foundAt: '2026-10-01' };
    const Z = { school: '고려대학교', title: '2026 표본 사고 창 안에서 빠진 재단 장학생 선발', url: 'https://www.korea.ac.kr/ko/568/subview.do?nttId=000100000000003700', foundAt: '2026-09-30' };
    const open = healFromLedger([R, K1], [M, K0, Z], { today: TODAY, served: S2, until: '9999-12-31' });
    const out = healFromLedger([R, K1], [M, K0, Z], { today: TODAY, served: S2 });
    eq('① ⓗ (전제) 창을 열면 장부의 옛 판 둘(가천 표식 · 고려 [교외-11/3])이 되살아난다 — dedupe 열쇠가 셋 다 어긋나 같은 글로 못 본다',
      [open.length, open.some((n) => n.url === M.url), open.some((n) => n.url === K0.url)], [5, true, true]);
    eq('  🔴 기본(FEED_HEAL_UNTIL)은 9-30 뒤 수집한 장부 글을 메우지 않는다 — 옛 판 둘은 빠지고 · 창 안(9-30)에서 빠진 글은 그대로 메운다',
      out.map((n) => n.url), [R.url, K1.url, Z.url]);
    /* 학생이 지금 보는 판(학교별 파일)은 창으로 묶지 않는다 — 상한에 잘린 10-03 글은 그대로 돌아온다 */
    const C3 = { school: '가천대학교', title: '2026 표본 상한에 잘린 10월 장학 안내', url: 'https://www.gachon.ac.kr/bbs/kor/478/125950/artclView.do', foundAt: '2026-10-03' };
    const counts = {};
    eq('  학생이 지금 보는 판(opts.current)은 창으로 묶지 않는다 — 10-03 글도 kept 로 돌아온다',
      [healFromLedger([R], [], { today: TODAY, served: S2, current: [R, C3], counts }).map((n) => n.url), counts], [[R.url, C3.url], { restored: 0, kept: 1 }]);
    /* (리뷰 R4) until 에 빈 글자를 넘겨도 상한이 없어지지 않는다(`??` 는 '' 를 통과시켰다) */
    eq("  until '' 은 기본값(FEED_HEAL_UNTIL)과 같다 — 상한이 사라지지 않는다 (리뷰 R4)",
      healFromLedger([R, K1], [M, K0, Z], { today: TODAY, served: S2, until: '' }).map((n) => n.url), [R.url, K1.url, Z.url]);

    /* (리뷰 R2) 창 **안**(9-30) 장부 표식 + 사냥꾼이 푼 기록 — 사냥꾼이 그 표식을 제목이 다른 짝과 합쳤으면 장부 판을 찾은 주소로 바꿔 끼워
       같은 글로 본다(안 그러면 메우기가 다시 싣고 → 사냥꾼이 다시 합치고 → 다시 싣는 진동). 기록은 link-hunt.json 의 찾은 줄(resolvedNoticeUrls 한 곳) */
    const W = { school: '가천대학교', title: '[비교과] 2026 표본 창 안 표식 글', url: `https://www.gachon.ac.kr/kor/7986/subview.do#n-${encodeURIComponent('[비교과] 2026 표본 창 안 표식 글')}`, foundAt: '2026-09-30' };
    const WR = { school: '가천대학교', title: '[공통] 2026 표본 창 안 표식 글 (연장)', url: 'https://www.gachon.ac.kr/bbs/kor/478/125700/artclView.do', foundAt: '2026-09-30' };
    const huntItems = {
      [`n:${W.url}`]: { status: 'resolved', resolvedUrl: WR.url, lastTried: '2026-10-06' },
      'n:https://www.gachon.ac.kr/kor/7986/subview.do#n-x': { status: '', attempts: 2 },                        // 아직 못 찾은 줄
      'r:auto-sample': { status: 'resolved', resolvedUrl: 'https://www.gachon.ac.kr/bbs/kor/478/1/artclView.do' }, // 정식 등록 줄
      'n:https://www.gachon.ac.kr/a/view.do?no=1': { status: 'resolved', resolvedUrl: 'https://www.gachon.ac.kr/a/view.do?no=1' },   // 주소 그대로
    };
    const hm = resolvedNoticeUrls(huntItems);
    eq('  🔴 (리뷰 R2) 창 안(9-30) 장부 표식 + 사냥꾼이 푼 기록 — 기록 없이는 옛 표식 판이 되살아나고 · 기록(moved)이 있으면 찾은 주소로 같은 글이 되어 안 실린다',
      [healFromLedger([WR], [W], { today: TODAY, served: S2 }).length, healFromLedger([WR], [W], { today: TODAY, served: S2, moved: hm }).map((n) => n.url)],
      [2, [WR.url]]);
    eq('  resolvedNoticeUrls — 찾은(resolved) 실시간 공고 줄만 옛 주소 → 찾은 주소 · 못 찾은 줄·정식 등록 줄·주소가 그대로인 줄은 안 넣는다',
      [[...hm], resolvedNoticeUrls().size, resolvedNoticeUrls(null).size], [[[W.url, WR.url]], 0, 0]);
    /* 순위 가드 — 기록이 진짜 주소를 표식으로 바꾸라고 해도 장부 판의 진짜 주소는 그대로 둔다 */
    const realLedger = { ...WR, title: '2026 표본 진짜 주소 장부 글', url: 'https://www.gachon.ac.kr/bbs/kor/478/125701/artclView.do' };
    eq('  moved 에도 순위 가드 — 진짜 주소를 표식으로 바꿔 끼우지 않는다',
      healFromLedger([], [realLedger], { today: TODAY, served: S2, moved: new Map([[realLedger.url, W.url]]) }).map((n) => n.url), [realLedger.url]);
    /* 읽는 쪽(readHuntMoves) — 파일 하나를 읽어 같은 규칙으로 · 없거나 못 읽으면 빈 Map(메우기는 예전처럼 돈다) */
    const hdir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-huntmoves-'));
    fs.writeFileSync(path.join(hdir, 'link-hunt.json'), JSON.stringify({ updatedAt: '2026-10-06', items: huntItems }));
    fs.writeFileSync(path.join(hdir, 'broken.json'), '{ 깨진');
    eq('  readHuntMoves — link-hunt.json 을 읽어 같은 Map · 파일이 없거나 깨졌으면 빈 Map',
      [[...readHuntMoves({ path: path.join(hdir, 'link-hunt.json') })], readHuntMoves({ path: path.join(hdir, 'none.json') }).size, readHuntMoves({ path: path.join(hdir, 'broken.json') }).size],
      [[[W.url, WR.url]], 0, 0]);
    fs.rmSync(hdir, { recursive: true, force: true });

    /* (리뷰 R2) 서울과기대 — 같은 글(bnum·bidx)이 목록 쪽 번호(nowpage)와 제목('(~9/28(월)까지)' → '(마감)')만 바뀐 판. 주소·제목 열쇠로는 못 잇는다 */
    const ST = (np, title, foundAt, bidx = '894350', bnum = '5233') => ({ school: '서울과학기술대학교', title, foundAt,
      url: `https://www.seoultech.ac.kr/service/info/janghak/?do=commonview&searchtext=&searchtype=-1&nowpage=${np}&bnum=${bnum}&bidx=${bidx}&qidx=${bnum}&cate=0&allboard=true&nowpage=${np}` });
    const S0 = ST(2, '(홍보) 2026년도 하반기 (재)달서인재육성장학재단 장학생 선발 공고(~9/28(월)까지)', '2026-09-30');
    const S1 = ST(3, '(홍보) 2026년도 하반기 (재)달서인재육성장학재단 장학생 선발 공고(마감)', '2026-10-07');
    const S3 = [...SERVED, '서울과학기술대학교'];
    eq('  🔴 (리뷰 R2) 서울과기대 같은 글(게시판 번호 + 글 번호)은 쪽 번호·제목이 달라도 한 글 — 창 안 장부 판이 되살아나지 않는다 · 피드 판(마감)이 남는다',
      [dedupeNotices([S1, S0]).map((n) => n.url), healFromLedger([S1], [S0], { today: TODAY, served: S3 }).map((n) => n.url)], [[S1.url], [S1.url]]);
    eq('  글 번호가 다르거나 게시판 번호가 다르면 다른 글이다(넓게 묶지 않는다)',
      [dedupeNotices([S1, ST(2, '(홍보) 다른 재단 장학생 선발', '2026-09-30', '894351')]).length, dedupeNotices([S1, ST(2, '[공지] 다른 게시판 글', '2026-09-30', '894350', '57138')]).length], [2, 2]);
  }

  /* ── ① ⓘ 사냥꾼이 바꾼 주소로 학교별 파일도 고치고 합친다 (CC-1 · 2026-10-11) ──
     학교별 파일 [R, M] → 사냥꾼(표식 M 을 R 의 주소로 풀고 notices.json 을 dedupe) → 학교별 파일 고치기 → 다음 수집.
     제목이 달라 예전 고치기(제목 열쇠만)는 M 을 못 찾았고, 다음 수집의 메우기가 학교별 파일의 M 을 kept 로 다시 실어 두 장이 계속 남았다. */
  {
    const dir = pathToFileURL(fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-moved-')) + path.sep);
    const S2 = [...SERVED, '가천대학교'];
    const GT = '(생활비)2027년 아산사회복지재단 북한이탈청소년장학생 선발 안내';
    const R = { school: '가천대학교', title: `[공통] ${GT}`, url: 'https://www.gachon.ac.kr/bbs/kor/478/125899/artclView.do', foundAt: '2026-10-03',
      attachments: [{ name: '포스터.pdf', url: 'https://www.gachon.ac.kr/bbs/kor/478/156401/download.do' }] };
    const M = { school: '가천대학교', title: `[장학공지] ${GT}`, url: `https://www.gachon.ac.kr/kor/7986/subview.do#n-${encodeURIComponent(`[장학공지] ${GT}`)}`, foundAt: '2026-10-03' };
    const O = { school: '가천대학교', title: '2026 표본 다른 장학 안내', url: 'https://www.gachon.ac.kr/bbs/kor/478/125800/artclView.do', foundAt: '2026-10-02' };
    publishBySchool([R, M, O], { dir, today: TODAY });
    /* 사냥꾼 흉내 — 표적 열쇠는 표적을 모을 때의 주소('n:<표식>'), 찾으면 그 글의 주소만 바꾼다(link-hunter.mjs 1·3단계) · 저장 때 dedupe → 학교별 파일 고치기 */
    const items = [R, M, O].map((n) => ({ ...n }));
    const targets = [{ ref: items[1], field: 'url', title: items[1].title, key: `n:${items[1].url}` },
      { ref: { sourceUrl: 'https://www.gachon.ac.kr/x/view?id=1' }, field: 'sourceUrl', title: '정식 등록', key: 'r:auto-x' }];
    items[1].url = R.url;
    const moved = movedNoticeUrls(targets);
    const notices = dedupeNotices(items);
    const r = patchUrlsBySchool(notices, { dir, moved });
    const afterHunt = (fileItems(dir, '가천대학교') || []).map((n) => n.url);
    const ixAfterHunt = ((JSON.parse(fs.readFileSync(new URL('index.json', dir), 'utf8')).files || {})['가천대학교'] || {}).count;
    const next = collectorTail({ dir, today: TODAY, served: S2, notices, ledger: [M] });
    const afterCollect = (fileItems(dir, '가천대학교') || []).map((n) => n.url);
    eq('① ⓘ movedNoticeUrls — 이번에 바뀐 실시간 공고만(옛 주소 → 새 주소) · 정식 등록·그대로인 표적은 안 넣는다',
      [[...moved], movedNoticeUrls([{ ref: { url: 'https://a.kr/1' }, field: 'url', key: 'n:https://a.kr/1' }]).size, movedNoticeUrls().size], [[[M.url, R.url]], 0, 0]);
    eq('  🔴 사냥꾼 직후 학교별 파일에서도 표식 판이 진짜 판과 한 장으로 합쳐진다 (제목이 달라도 옛 주소로 찾는다) · 고친 수·합친 수를 돌려준다',
      [afterHunt, r.fixed, r.merged, notices.length], [[R.url, O.url], 1, 1, 2]);
    eq('  (리뷰 R7) 파일 안에서 합쳐 글 수가 줄면 색인(index.json)의 그 학교 count 도 고친다(3 → 2)', ixAfterHunt, 2);
    eq('  🔴 다음 수집 뒤에도 한 장 — 학교별 파일(kept)·장부(창 밖 10-03) 어느 쪽에서도 옛 판이 되살아나지 않는다',
      [afterCollect, next.counts, next.notices.map((n) => n.url)], [[R.url, O.url], { restored: 0, kept: 0 }, [R.url, O.url]]);
    /* 순위 가드는 moved 에도 — 진짜 주소를 표식으로 바꾸는 쪽(옛 주소 → 표식)은 고치지 않는다 · 바뀔 것이 없으면 파일을 안 쓴다 */
    const before = fs.readFileSync(new URL(`${noticeFileKey('가천대학교')}.json`, dir), 'utf8');
    const g2 = patchUrlsBySchool([], { dir, moved: new Map([[R.url, M.url]]) });
    eq('  순위 가드는 moved 에도 건다(진짜 주소를 표식으로 덮지 않는다) · 안 바뀌면 파일을 안 쓴다',
      [g2.fixed, g2.files, fs.readFileSync(new URL(`${noticeFileKey('가천대학교')}.json`, dir), 'utf8') === before], [0, 0, true]);
    fs.rmSync(dir, { recursive: true, force: true });
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
    eq('  수집 리포트가 발행 목록으로 재고 머리에 한 줄 적는다 (까닭은 zeroFeedWhy 하나 · 브라우저 학교인지 같이 넘긴다)',
      [pubAt > 0 && zAt > pubAt, /lines\.push\(`🙋 서비스 학교인데 앱 실시간 공고 0건 \$\{zeroFeed\.length\}곳/.test(src),
        /zeroFeedWhy\(results\.filter\([^;]*\{\s*browser:\s*browserSchools\.has\(school\)\s*\}\)/.test(src)], [true, true, true]);
    /* 0건 날에도 사람에게 닿는다 (리뷰 2026-10-05 R5) — 리포트 이슈는 새 공고가 있는 날만 생기고, 0건 날엔 코멘트 한 줄뿐이었다.
       코멘트 단계가 report.md 의 🔁·🙋 줄(줄 맨 앞)을 집어 코멘트에 붙이는가 · 수집기가 그 줄을 줄 맨 앞에 쓰는가 */
    const cs = stripYamlComments(fs.readFileSync(new URL('.github/workflows/collect-scholarships.yml', root), 'utf8'));
    const zeroStep = cs.split(/\n(?= {6}- )/).find((s) => /name: 0건 실행 알림/.test(s)) || '';
    const grepAt = zeroStep.search(/feedlines=\$\(grep -E '\^\(🔁\|🙋\) ' collector\/report\.md/);
    const addAt = zeroStep.search(/msg="\$msg"\$'\\n\\n'"\$feedlines"/);
    const sendAt = zeroStep.indexOf('gh issue comment "$last"');
    eq('  🔴 0건 날 코멘트에도 report.md 의 🔁·🙋 줄을 붙인다 (보내기 전에) · 수집기는 두 줄을 줄 맨 앞에 쓴다',
      [grepAt > 0, addAt > grepAt, sendAt > addAt, /lines\.push\(`🔁 /.test(src), /lines\.push\(`🙋 /.test(src)], [true, true, true, true, true]);
    /* 까닭은 그 학교 게시판의 이번 상태 줄에서만 — 상태 줄 글자는 collect.mjs harvestBoard 의 꼴 그대로 */
    const unset = { status: '⚙️ 게시판 주소 미설정 (행이 클릭형이라 browser-targets.json 이 담당)', items: [] };
    const seenAll = { status: '✅ 정상 (실공고 15건 감지)', items: [] };
    const fresh1 = { status: '✅ 정상 (실공고 3건 감지)', items: [{ title: '새 글' }] };
    eq("  zeroFeedWhy — 🔴 schools.json 주소가 비어도 브라우저 로봇이 읽는 학교는 '게시판 주소 없음'이라 적지 않는다 (고려·중앙·부산·계명)",
      [zeroFeedWhy([unset], { browser: true }), zeroFeedWhy([unset]), zeroFeedWhy([], { browser: true }), zeroFeedWhy([])],
      ['브라우저 로봇이 읽는 학교 — browser-report 참조', '게시판 주소 없음', '브라우저 로봇이 읽는 학교 — browser-report 참조', '이번 일반 수집 기록 없음']);
    eq('  감지한 글이 모두 전에 본 글 · 브라우저 담당 줄 · 그 밖의 상태 줄은 그대로 · 같은 까닭은 한 번만',
      [zeroFeedWhy([seenAll]), zeroFeedWhy([{ status: '🖥 브라우저 담당 게시판 — 일반 로봇은 건너뜀', items: [] }]),
        zeroFeedWhy([{ status: '⚠️ 오류 (시간 초과) — 주소 확인 필요', items: [] }]), zeroFeedWhy([seenAll, seenAll]), zeroFeedWhy([fresh1])],
      ['게시판 15건 감지 · 모두 전에 본 글', '브라우저 로봇이 읽는 학교 — browser-report 참조', '⚠️ 오류 (시간 초과) — 주소 확인 필요', '게시판 15건 감지 · 모두 전에 본 글', '✅ 정상 (실공고 3건 감지)']);
  }

  /* ── ④ 누락 감사 — 장부에만 남은 글 ── */
  {
    const deps = { keywords: /장학/, isMenuEntry: () => false, isAttachmentEntry: () => false, page: 1 };
    const T = '2026학년도 2학기 성적우수장학금 선발 공고';
    eq("④ 피드엔 없고 장부에만 있는 글은 '수집했지만 피드에서 빠짐' · 넘기지 않으면 예전처럼 '원인 미상'",
      [classifyMiss(T, { ...deps, inLedger: () => true }), classifyMiss(T, deps), classifyMiss(T, { ...deps, inLedger: () => false })],
      ['수집했지만 피드에서 빠짐', '원인 미상', '원인 미상']);
    /* '가진 것'을 가르는 순수 함수 — 장부에만 있는 제목은 가진 것에 없고(누락으로 잡힌다) inLedger 로만 보인다 (리뷰 R4) */
    const KH = '경희대학교';
    const have = coverageSets({
      notices: [{ school: KH, title: '2026 피드 장학생 선발 공고' }],
      schoolFiles: [{ school: KH, title: '2026 학교별 파일에만 있는 장학 공고' }],
      registered: [{ name: '2026 정식 등록 재단 장학금' }],
      ledger: [{ school: KH, title: T }, { school: KH, title: '2026 피드 장학생 선발 공고' }],
    });
    eq("  coverageSets — 가진 것 = 피드 + 학교별 파일 + 정식 등록 · 장부에만 있는 글은 누락으로 잡히고 원인은 '수집했지만 피드에서 빠짐'",
      [findMissing([T, '2026 피드 장학생 선발 공고', '2026 학교별 파일에만 있는 장학 공고', '2026 정식 등록 재단 장학금'], have.ours(KH)),
        have.inLedger(KH, T), have.inLedger(KH, '2026 전혀 다른 장학 공고 선발'), have.inLedger('건국대학교', T),
        classifyMiss(T, { ...deps, inLedger: (title) => have.inLedger(KH, title) })],
      [[T], true, false, false, '수집했지만 피드에서 빠짐']);
    const src = stripComments(fs.readFileSync(new URL('collector/audit-coverage.mjs', root), 'utf8'));
    const call = (src.match(/coverageSets\(\{([^}]*)\}\)/) || [])[1] || '';
    eq('  감사 스크립트는 coverageSets 하나로 가르고 장부는 ledger 로만 넘긴다 (스크립트에서 목록을 합치지 않는다)',
      [Boolean(call), (call.match(/candidates/g) || []).length, /\bledger:\s*candidates\b/.test(call), /findMissing\(boardTitles,\s*have\.ours\(t\.school\)\)/.test(src),
        /inLedger:\s*\(title\)\s*=>\s*have\.inLedger\(t\.school,\s*title\)/.test(src), /readSchoolFiles\(\)/.test(src), /\bbySchool\(|\.concat\(schoolFiles|\.\.\.candidates/.test(src)],
      [true, 1, true, true, true, true, false]);
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
    /* 지금 notices.json 에 남은 60일 밖 글·첨부 링크 — 수집기는 메우기 전에 거른다(리뷰 2026-10-05 R6: 도구는 안 걸러 학교별 파일에 다시 실었다) */
    const stale = { school: K, title: '2026 표본 오래된 장학 안내', url: 'https://k.kr/v?no=3', foundAt: day(70) };
    const attach = { school: K, title: '장학 신청서.hwp', url: 'https://k.kr/download.do?attachNo=4', foundAt: day(2) };
    w('data/notices.json', { updatedAt: day(0), items: [a2, attach, stale] }); w(fileK, { school: K, updatedAt: day(0), items: [a2] });
    /* (리뷰 R2) 사냥꾼 장부 — 표식 M2 를 R2 의 주소로 푼 기록. 도구도 수집기처럼 이 기록으로 장부 판의 주소를 바꿔 끼운다(아래 srcMix) */
    const R2 = { school: K, title: '[공통] 2026 표본 사냥꾼이 합친 재단 장학 안내', url: 'https://k.kr/v?no=21', foundAt: day(2) };
    const M2 = { school: K, title: '[장학공지] 2026 표본 사냥꾼이 합친 재단 장학 안내', url: `https://k.kr/list.do#n-${encodeURIComponent('[장학공지] 2026 표본 사냥꾼이 합친 재단 장학 안내')}`, foundAt: day(2) };
    /* 학교가 제목만 고친 같은 글의 표식 판 — 도구는 같은 글인지 모른다(사람이 목록을 보고 --skip 으로 뺀다) */
    const K2 = { school: K, title: '공통 제36기 표본레에셋 해외교환 장학생 선발', url: `https://k.kr/list.do#n-${encodeURIComponent('공통 제36기 표본레에셋 해외교환 장학생 선발')}`, foundAt: day(3) };
    w('collector/link-hunt.json', { updatedAt: day(0), items: { [`n:${M2.url}`]: { status: 'resolved', resolvedUrl: R2.url, lastTried: day(1) } } });
    g('add', '-A'); g('commit', '-qm', '사고(잘림)');
    const tool = fileURLToPath(new URL('collector/heal-feed.mjs', root));
    const run = (...args) => spawnSync(process.execPath, [tool, ...args], { cwd: dir, encoding: 'utf8', env: cleanEnv() });
    /* 표본 날짜는 지금 시각 기준(60일 규칙을 도구가 지금 시각으로 잰다)이라 사고 창(FEED_HEAL_UNTIL) 뒤다 — 메우기를 재는 실행은 --until 로 창을 연다 */
    const dry = run('--dry', '--since=0000-00-00', '--until=9999-12-31', `git:${snap}:data/notices/`);
    const dryClean = g('status', '--porcelain').stdout.trim() === '';
    const bad = run('--since=0000-00-00', '--until=9999-12-31', 'git:없는커밋:data/notices.json');
    const badClean = g('status', '--porcelain').stdout.trim() === '';
    /* 🔴 --until 을 안 주면 FEED_HEAL_UNTIL — 그 뒤 수집분은 메우지 않는다(CC-1) · 잘못된 꼴은 멈춘다.
       원천은 저장소 밖 파일 하나(어제 수집한 새 글 — 지금 시각 기준이라 늘 사고 창 뒤) */
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-feed-tool-src-'));
    const srcNew = path.join(srcDir, 'new.json');
    fs.writeFileSync(srcNew, JSON.stringify({ items: [{ school: K, title: '2026 표본 새로 수집한 재단 장학 안내', url: 'https://k.kr/v?no=5', foundAt: day(1) }] }));
    const dryDefault = run('--dry', '--since=0000-00-00', srcNew);
    const dryOpen = run('--dry', '--since=0000-00-00', '--until=9999-12-31', srcNew);
    const badUntil = run('--dry', '--until=10월', srcNew);
    /* (리뷰 R4) 빈 창 — --since 만 주어 기본 --until 보다 늦으면 소리 없이 0건이 되던 것 → 멈춘다 */
    const emptyWin = run('--dry', `--since=${day(1)}`, srcNew);
    const emptyWin2 = run('--dry', '--since=2026-10-05', '--until=2026-10-01', srcNew);
    /* (리뷰 R1) 메울 글 목록 · --skip · (리뷰 R2) 사냥꾼이 푼 표식 */
    const srcMix = path.join(srcDir, 'mix.json');
    fs.writeFileSync(srcMix, JSON.stringify({ items: [R2, M2, K2] }));
    const W9 = '--until=9999-12-31';
    const dryMix = run('--dry', '--since=0000-00-00', W9, srcMix);
    const drySkip = run('--dry', '--since=0000-00-00', W9, `--skip=${K2.url}`, srcMix);
    const badSkip = run('--dry', '--since=0000-00-00', W9, '--skip=https://k.kr/v?no=없는글', srcMix);
    const mixClean = g('status', '--porcelain').stdout.trim() === '';
    fs.rmSync(srcDir, { recursive: true, force: true });
    const rowsOf = (o) => (o.stdout || '').split('\n').filter((l) => l.startsWith('- '));
    const r = run('--since=0000-00-00', '--until=9999-12-31', `git:${snap}:data/notices/`, `git:${snap}:data/notices.json`);
    const feedOut = JSON.parse(fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8')).items;
    const fileOut = JSON.parse(fs.readFileSync(path.join(dir, fileK), 'utf8')).items;
    eq('⑤ 메우기 도구 — --dry 와 못 읽는 원천은 아무것도 안 쓴다 · 사고 직전 커밋에서 빠진 글만 메운다',
      [dry.status, dryClean, bad.status, badClean, r.status], [0, true, 1, true, 0]);
    eq(`  🔴 --until 을 안 주면 FEED_HEAL_UNTIL(${FEED_HEAL_UNTIL}) — 그 뒤 수집한 원천 글은 메우지 않는다 · 창을 열면 1건 · --until 꼴이 틀리면 멈춘다 (CC-1)`,
      [dryDefault.status, (dryDefault.stdout.match(/메울 글 (\d+)건/) || [])[1], new RegExp(`until ${FEED_HEAL_UNTIL}`).test(dryDefault.stdout),
        dryOpen.status, (dryOpen.stdout.match(/메울 글 (\d+)건/) || [])[1], badUntil.status],
      [0, '0', true, 0, '1', 2]);
    eq('  🔴 (리뷰 R4) --since 가 --until 보다 늦으면(빈 창) 이유를 적고 멈춘다 — --since 만 줘 기본 --until 에 걸린 경우도',
      [emptyWin.status, /메울 창이 비었습니다/.test(emptyWin.stderr), /--until 기본값은/.test(emptyWin.stderr), emptyWin2.status, /--until 기본값은/.test(emptyWin2.stderr)],
      [2, true, true, 2, false]);
    eq('  🔴 (리뷰 R1) --dry 는 메울 글을 한 줄씩(학교 · 수집일 · 제목 · 주소 · 원천) — 표식 주소는 [표식] · 원천별·표식 수 · 사냥꾼이 푼 표식(M2)은 찾은 주소로 같은 글(R2)이 되어 한 줄',
      [dryMix.status, (dryMix.stdout.match(/메울 글 (\d+)건/) || [])[1], rowsOf(dryMix),
        new RegExp(`원천별: ${srcMix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} 2 · 그중 목록 표식\\(#n-\\) 1건`).test(dryMix.stdout)],
      [0, '2', [`- ${K} · ${R2.foundAt} · ${R2.title} · ${R2.url} (${srcMix})`, `- [표식] ${K} · ${K2.foundAt} · ${K2.title} · ${K2.url} (${srcMix})`], true]);
    eq('  🔴 (리뷰 R1) --skip=<주소> 는 그 글을 원천에서 뺀다 · 원천에 없는 주소면 오타일 수 있어 멈춘다(아무것도 안 쓴다)',
      [drySkip.status, (drySkip.stdout.match(/메울 글 (\d+)건/) || [])[1], /원천에서 뺀 글 1건/.test(drySkip.stdout), rowsOf(drySkip).some((l) => l.includes('[표식]')),
        badSkip.status, /--skip 주소가 원천에 없습니다/.test(badSkip.stderr), mixClean],
      [0, '1', true, false, 2, true, true]);
    eq('  notices.json·학교별 파일 둘 다 · 고친 주소는 그대로 · 메운 글의 foundAt 은 원래 날짜 · 수집기처럼 60일 밖 글·첨부 링크는 거른다',
      [feedOut.map((n) => n.url), fileOut.map((n) => n.url), feedOut[1] && feedOut[1].foundAt], [[a2.url, b.url], [a2.url, b.url], b.foundAt]);
    /* '수집기 끝부분과 같은 함수·같은 차례'를 글자로 대조 — 피드를 바꾸는 함수(url-key · publish-notices · attachment-link 가 내보내는 이름)
       호출의 첫 등장 차례. 두 수집기의 공통 차례에 단계가 더해지면(예: 기본 브랜치의 게시판 공통 링크 걷기) 여기가 빨개져 도구도 같이 고치게 한다. */
    const vocab = new Set([...Object.keys(await import('../../collector/url-key.mjs')), ...Object.keys(await import('../../collector/publish-notices.mjs')),
      ...Object.keys(await import('../../collector/attachment-link.mjs'))]);
    const callsIn = (s) => { const out = []; for (const m of s.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) if (vocab.has(m[1]) && !out.includes(m[1])) out.push(m[1]); return out; };
    const tailOf = (f) => {
      const s = stripComments(fs.readFileSync(new URL(f, root), 'utf8'));
      const from = s.indexOf('notices.items = freshAll.concat(notices.items || [])');
      const to = s.indexOf('fs.writeFileSync(noticesPath', from);
      return from > 0 && to > from ? callsIn(s.slice(from, to)) : [];
    };
    const cTail = tailOf('collector/collect.mjs');
    const bTail = tailOf('collector/browser-collect.mjs');
    const common = cTail.filter((x) => bTail.includes(x));
    const toolSrc = stripComments(fs.readFileSync(new URL('collector/heal-feed.mjs', root), 'utf8'));
    const toolSeq = callsIn(toolSrc.slice(toolSrc.indexOf('const notices = JSON.parse(')));
    eq('  🔴 도구의 차례 = 두 수집기 \'앱 발행\' 단락의 공통 차례 (같은 함수 · 같은 차례 — 새 글 얹기만 없다)',
      [common.length >= 6 && common.includes('healFromLedger') && common.includes('publishBySchool'), bTail.filter((x) => cTail.includes(x)).join() === common.join(), toolSeq],
      [true, true, common]);
    eq('  JSON.stringify(x, null, 1) 로 저장한다 (로봇과 같은 꼴)',
      fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8') === JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, 'data/notices.json'), 'utf8')), null, 1), true);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
