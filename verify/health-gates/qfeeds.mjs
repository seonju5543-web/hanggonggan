/* 「로봇·도구 점검 관문」 qfeeds 묶음 — 소식·재단·대외활동 글 품질 (2026-10-05 대대적 점검)
   잰다:
     ① 미래 게시일 (news-1): 아주대 「어학졸업인증 …(~2027.1.22)」이 게시일 2027-01-22 로 실려 홈 소식 띠 맨 앞에 붙어 있었다 —
        발행이 새 글·실린 글 구분 없이 오늘보다 뒤인 게시일을 비운다(news-kind.mjs clearFuturePosted · newsFloor 앞)
     ② 재단 새 공고 — 마감 지난 글 (collect-09 · api-01 · app2-F6): 송파 상반기 06-24·음성 09-18 이 몇 달 떠 있었다 —
        마감 다음 날까지만(CLOSED_KEEP_DAYS 와 같은 뜻) · 제목 머리 [마감] 표식 · 마감 칸 없는 옛 글은 원문 기간 줄에서 같은 판독기로 채운다 ·
        소급 도구(tools/refilter-feeds.mjs)는 임시 폴더에서 진짜로 돌린다
     ③ 합집합 병합기 (app2-F7): .gitattributes 에 merge=jsonunion 이라 적은 파일마다 **병합기를 진짜로 돌려** 규칙이 있는지 본다 ·
        활동 피드는 학교 없는 글을 상한으로 자르지 않는다 · 재단 피드는 합친 뒤 발행 거름을 다시 건다(로봇이 뺀 지난 글을 되살리지 않는다) ·
        seen-activities 는 이른 날짜
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripComments, cleanEnv } from './gate.mjs';
import { sandbox } from './bodies.mjs';
import { clearFuturePosted, newsFloor } from '../../collector/news-kind.mjs';
import { dropReason as extDropReason, fillDeadlineFromHint, tidyExternal } from '../../collector/external-clean.mjs';

const src = (root, rel) => stripComments(fs.readFileSync(new URL(rel, root), 'utf8'));
/* a 가 b 보다 앞에 있다(둘 다 있어야 참) */
const before = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b); return i >= 0 && j >= 0 && i < j; };

export default async function qfeeds(eq, ctx) {
  const root = ctx.root;
  const newsSrc = src(root, 'collector/collect-news.mjs');
  const collectSrc = src(root, 'collector/collect.mjs');

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

  /* ── ② 재단 새 공고 — 마감 지난 글 ── */
  {
    const T = '2026-10-04';
    const D = (o) => extDropReason(tidyExternal(o), T);
    eq('② 마감이 이틀 넘게 지난 재단 글은 뺀다 · 이유 글자에 숫자가 없다(집계가 옛 글로 뭉치지 않게)',
      D({ title: '2026년 군민평생 장학생 선발 공고', deadline: '2026-09-18' }), '마감 지남');
    eq('  마감 다음 날까지는 남긴다 (CLOSED_KEEP_DAYS) · 남은 마감 · 마감 모름',
      [D({ title: '2026년 하반기 송파구인재육성장학재단 장학생 선발 공고', deadline: '2026-10-03' }),
        D({ title: '2026년 하반기 송파구인재육성장학재단 장학생 선발 공고', deadline: '2026-10-10' }),
        D({ title: '2026년 하반기 송파구인재육성장학재단 장학생 선발 공고' })], [null, null, null]);
    eq('  제목 머리 마감 표식은 뺀다 · [마감임박] 은 남긴다',
      [!!D({ title: "[마감] '원거리 진학 대학생 주거 장학금' 대상자 모집" }), !!D({ title: '(모집마감) 2026 장학생 모집' }), D({ title: '[마감임박] 2026 장학생 모집 공고' })],
      [true, true, null]);
    const fake = (t) => (/9\.\s*18/.test(t) ? '2026-09-18' : null);
    const a = { title: 'x', deadlineHint: '신청기간 : 2026. 8. 31.(월) ～ 9. 18.(금)' };
    const b = { title: 'y', deadline: '2026-10-30', deadlineHint: '신청기간 : 2026. 8. 31.(월) ～ 9. 18.(금)' };
    const c = { title: 'z', deadlineHint: '문의 : 장학팀' };
    eq('  마감 칸 없는 옛 글은 원문 기간 줄에서 채운다 · 이미 있는 마감·못 읽는 줄은 그대로',
      [fillDeadlineFromHint(a, fake), a.deadline, fillDeadlineFromHint(b, fake), b.deadline, fillDeadlineFromHint(c, fake), c.deadline || null],
      [true, '2026-09-18', false, '2026-10-30', false, null]);
    eq('  수집 로봇이 발행 때 거름(map(tidyExternal)) 앞에서 수집과 같은 판독기로 채운다',
      before(collectSrc, 'fillDeadlineFromHint(n, (t) => activityExcerpts(t).deadline)', 'ext.items = ext.items.map(tidyExternal)'), true);

    /* 소급 도구(tools/refilter-feeds.mjs)를 임시 폴더에서 진짜로 돌린다 — 날짜는 오늘과 상관없게(2020·2099) */
    const sb = sandbox(root, 'hdj-qfeeds-refilter-');
    try {
      sb.write('tools/refilter-feeds.mjs', fs.readFileSync(new URL('tools/refilter-feeds.mjs', root)));
      sb.write('collector/extracted/notices-text.json', []);   // 마감 판독기(extract-excerpts.mjs)가 불러올 때 읽는 두 파일 — 빈 표본
      sb.write('data/registered.json', { items: [] });
      const EXT = { updatedAt: '2026-10-01', items: [
        { title: '군민평생 장학생 선발 공고', url: 'https://a.example.or.kr/1', host: '음성군장학회', deadline: '2020-09-18' },
        { title: '영동군민장학생 선발 알림', url: 'https://a.example.or.kr/2', host: '영동군', deadlineHint: '신청기간 : 2020. 8. 31.(월) ～ 2020. 9. 18.(금)' },
        { title: "[마감] '원거리 진학 대학생 주거 장학금' 대상자 모집", url: 'https://a.example.or.kr/3', host: '고속도로장학재단' },
        { title: '하반기 장학생 선발 공고', url: 'https://a.example.or.kr/4', host: '송파구', deadline: '2099-12-31' },
      ] };
      sb.write('data/external.json', JSON.stringify(EXT, null, 1));
      const dry = sb.run('tools/refilter-feeds.mjs');
      const unchanged = sb.read('data/external.json') === JSON.stringify(EXT, null, 1);
      const w = sb.run('tools/refilter-feeds.mjs', ['--write']);
      const out = sb.json('data/external.json');
      eq('  [소급 도구] 보기만 하면 안 쓴다 · --write 면 마감 지남(칸·기간 줄)·마감 표식을 빼고 열린 글만 · 로봇과 같은 저장 꼴',
        [dry.status, unchanged, w.status, (out?.items || []).map((n) => n.url.slice(-1)), sb.read('data/external.json') === JSON.stringify(out, null, 1)],
        [0, true, 0, ['4'], true]);
    } finally { sb.done(); }
  }

  /* ── ③ 합집합 병합기 ── */
  {
    const merger = fileURLToPath(new URL('tools/merge-json-union.mjs', root));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hdj-qfeeds-merge-'));
    /* 병합 도구가 불리는 꼴 그대로: base ours theirs <경로> — ours 에 결과를 쓴다 */
    const merge = (rel, base, ours, theirs) => {
      const f = (n, x) => { const p = path.join(dir, n); fs.writeFileSync(p, JSON.stringify(x, null, 1)); return p; };
      const o = f('o.json', ours);
      const r = spawnSync(process.execPath, [merger, f('b.json', base), o, f('t.json', theirs), rel], { encoding: 'utf8', env: cleanEnv() });
      let out = null;
      try { out = JSON.parse(fs.readFileSync(o, 'utf8')); } catch { /* 못 읽음 */ }
      return { status: r.status, err: r.stderr || '', out };
    };
    try {
      const ga = fs.readFileSync(new URL('.gitattributes', root), 'utf8');
      const declared = [...ga.matchAll(/^(\S+)\s+merge=jsonunion\b/gm)].map((m) => m[1].replace(/\*/g, 'x'));
      const bad = declared.map((rel) => [rel, merge(rel, {}, {}, {})]).filter(([, r]) => r.status !== 0 || /규칙 없는 파일/.test(r.err))
        .map(([rel, r]) => `${rel} (종료 ${r.status})`);
      eq(`③ 합집합이라 적은 파일(${declared.length}개)마다 병합기를 돌리면 합친다 — 규칙 없는 파일이 없다`, [declared.length >= 10, bad], [true, []]);

      const nat = (side, n) => Array.from({ length: n }, (_, i) => ({ url: `https://act.example.kr/${side}/${i}`, title: `${side} 글 ${i}`, foundAt: `2026-10-0${1 + (i % 3)}` }));
      const acts = merge('data/activities.json', {}, { updatedAt: '2026-10-03', items: nat('a', 60) }, { updatedAt: '2026-10-04', items: nat('b', 60) });
      eq('  활동 피드 — 학교 없는 전국 글 60+60 을 합치면 120 (학교 열쇠 하나로 묶여 40건에 잘리지 않는다) · 날짜는 늦은 쪽',
        [acts.status, (acts.out?.items || []).length, acts.out?.updatedAt], [0, 120, '2026-10-04']);

      const ext = merge('data/external.json', {},
        { updatedAt: '2026-10-03', items: [{ url: 'https://e.example.or.kr/1', title: '하반기 장학생 선발 공고', host: '가재단', deadline: '2026-10-30' }] },
        { updatedAt: '2026-10-04', items: [
          { url: 'https://e.example.or.kr/2', title: '군민평생 장학생 선발 공고', host: '나장학회', deadline: '2026-09-18' },
          { url: 'https://e.example.or.kr/3', title: "[마감] '주거 장학금' 대상자 모집", host: '다재단' },
        ] });
      eq('  재단 피드 — 합친 뒤 발행 거름을 다시 건다: 마감 지난 글·[마감] 표식 글은 되살아나지 않고 열린 글은 남는다',
        [ext.status, (ext.out?.items || []).map((n) => n.url.slice(-1))], [0, ['1']]);

      const seen = merge('collector/seen-activities.json', {}, { 'https://x/1': '2026-10-01' }, { 'https://x/1': '2026-10-03', 'https://x/2': '2026-10-04' });
      eq('  seen-activities — 같은 열쇠는 이른 날짜를 남긴다(늦은 날짜면 같은 글을 새 글로 다시 담는다)',
        [seen.status, seen.out], [0, { 'https://x/1': '2026-10-01', 'https://x/2': '2026-10-04' }]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
}
