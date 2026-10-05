/* 「로봇·도구 점검 관문」 qfeeds 묶음 — 소식·재단·대외활동 글 품질 (2026-10-05 대대적 점검)
   잰다:
     ① 미래 게시일 (news-1): 아주대 「어학졸업인증 …(~2027.1.22)」이 게시일 2027-01-22 로 실려 홈 소식 띠 맨 앞에 붙어 있었다 —
        발행이 새 글·실린 글 구분 없이 오늘보다 뒤인 게시일을 비운다(news-kind.mjs clearFuturePosted · newsFloor 앞)
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import { stripComments } from './gate.mjs';
import { clearFuturePosted, newsFloor } from '../../collector/news-kind.mjs';

const src = (root, rel) => stripComments(fs.readFileSync(new URL(rel, root), 'utf8'));
/* a 가 b 보다 앞에 있다(둘 다 있어야 참) */
const before = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b); return i >= 0 && j >= 0 && i < j; };

export default async function qfeeds(eq, ctx) {
  const root = ctx.root;
  const newsSrc = src(root, 'collector/collect-news.mjs');

  /* ── ① 미래 게시일 ── */
  {
    const items = [{ postedAt: '2027-01-22', foundAt: '2026-10-01' }, { postedAt: '2026-10-04', foundAt: '2026-10-02' }, { foundAt: '2026-10-03' }];
    const n = clearFuturePosted(items, '2026-10-04');
    eq('① 오늘보다 뒤인 게시일만 비운다 — 오늘 글·게시일 없는 글은 그대로 · 지운 개수',
      [n, items.map((i) => i.postedAt || '-')], [1, ['-', '2026-10-04', '-']]);
    /* 같은 학교 글 다섯 — 미래 게시일 글이 바닥 4건의 '게시일 1위'로 남지 않는다 */
    const mk = () => [
      { school: '가대학교', title: '어학졸업인증 (~2027.1.22)', postedAt: '2027-01-22', foundAt: '2026-08-20' },
      { school: '가대학교', title: 'b', postedAt: '2026-10-03', foundAt: '2026-10-03' },
      { school: '가대학교', title: 'c', postedAt: '2026-10-02', foundAt: '2026-10-02' },
      { school: '가대학교', title: 'd', postedAt: '2026-10-01', foundAt: '2026-10-01' },
      { school: '가대학교', title: 'e', postedAt: '2026-09-30', foundAt: '2026-09-30' },
    ];
    const raw = mk();
    const keptRaw = [...newsFloor(raw, 4)].map((i) => i.title);
    const fixed = mk();
    clearFuturePosted(fixed, '2026-10-04');
    const kept = [...newsFloor(fixed, 4)].map((i) => i.title);
    eq('  (대조) 비우지 않으면 미래 게시일 글이 바닥 4건 첫째로 남는다', keptRaw[0], '어학졸업인증 (~2027.1.22)');
    eq('  비운 뒤엔 바닥 4건이 진짜 최근 글 넷이다 (미래 글은 수집일 08-20 로 맨 뒤)', kept, ['b', 'c', 'd', 'e']);
    eq('  소식 로봇이 발행 때 newsFloor 보다 먼저 KST 날짜로 부른다',
      before(newsSrc, 'clearFuturePosted(all, todayStr())', 'newsFloor(all'), true);
  }
}
