/* 「로봇·도구 점검 관문」 feed 묶음 — 실시간 공고 피드 복구·자가 회복 (2026-10-04 대대적 점검)
   잰다:
     ① 장부 메우기(publish-notices.mjs healFromLedger · collect-05/collect-01) — 9-30 병합기가 notices.json 을 200건으로 잘라 15개교 215건이
        학생 화면에서 빠졌는데, 수집기는 seen.json 만 보고 '피드에 있는가'는 안 물어 **영영 안 돌아왔다**.
        ⓐ 메우기만 하고 지금 글은 바꾸지 않는다(같은 객체 · 주소 그대로) · 60일 · FEED_HEAL_SINCE · 첨부 · 서비스 밖 · foundAt 그대로 · 차례
        ⓑ 다리 막기 — 장부 안 두 변형이 피드 글과 이어져 감사의 '실시간 공고에 중복'(오류 → 데이터 관문 빨간불)을 만들지 않는다 · 글 번호로 이어진 것도
        ⓒ 두 수집기 모두 saveCandidates 줄 뒤 · dropUnserved 앞에서 부른다
     ② 고아 파일(publishBySchool · app2-F4/collect-12) — 목록에 글이 없는 학교의 옛 파일은 빈 파일로 · 이미 빈 파일·못 읽는 파일·이름이 안 맞는 파일은 그대로
     ③ 화면 0건 학교(zeroFeedSchools · app2-F2/collect-06) — 리포트 머리 한 줄
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments } from './gate.mjs';
import { healFromLedger, publishBySchool, zeroFeedSchools, FEED_HEAL_SINCE } from '../../collector/publish-notices.mjs';
import { dedupeNotices, urlKey, titleKey } from '../../collector/url-key.mjs';

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
    const healAt = src.search(/notices\.items\s*=\s*healFromLedger\(notices\.items,\s*loadCandidates\(\)\.items/);
    const saveAt = src.indexOf('saveCandidates(mergeCandidates(loadCandidates().items, freshAll))');
    const dropAt = src.search(/notices\.items\s*=\s*dropUnserved\(notices\.items\)/);
    eq(`① ⓒ ${f} — 장부 저장 뒤 · 서비스 밖 떨구기 앞에서 메운다 (불러 쓴다)`,
      [healAt > 0, saveAt > 0 && saveAt < healAt, dropAt > healAt, /import \{[^}]*\bhealFromLedger\b[^}]*\} from '\.\/publish-notices\.mjs'/.test(src)],
      [true, true, true, true]);
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

}
