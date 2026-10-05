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
     ④ 활동 자격 (api-06): 납작한 표의 `대상연령 : 만 20세 이상 ~ 만 39세 이하, 만 40세 이상` 이 범위 하나로 읽혀 45세가 미달(틀린 미달) ·
        개인정보 처리 안내문이 자격 자리에 — activity-excerpts.mjs eligLineOk 한 곳 · 실린 글 sanitizeElig · 브라우저 장부 mergeBrowserResults
     ⑤ 뺀 게시판의 소식 (news-4): 경북 boardUrl 을 포토뉴스 → 학사공지로 바꾼 뒤 포토뉴스 글이 바닥 4건 자리에 남았다 —
        새 글에 게시판 열쇠(src) · 이번에 본 글은 열쇠를 고쳐 단다 · 지금 출처에 없는 게시판의 글은 발행에서 뺀다(news-board-rules.mjs dropRetiredBoards)
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments, cleanEnv } from './gate.mjs';
import { sandbox } from './bodies.mjs';
import { clearFuturePosted, newsFloor } from '../../collector/news-kind.mjs';
import { dropReason as extDropReason, fillDeadlineFromHint, tidyExternal } from '../../collector/external-clean.mjs';
import { activityDetails, eligLineOk, sanitizeElig } from '../../collector/activity-excerpts.mjs';
import { boardKey, dropRetiredBoards } from '../../collector/news-board-rules.mjs';
import { urlKey } from '../../collector/url-key.mjs';

const require = createRequire(import.meta.url);
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

  /* ── ④ 활동 자격 — 여러 갈래 나이·개인정보 안내문 ── */
  {
    const T = '2026년 테스트 교육 참가자 모집 공고';
    const body = (age) => [T, '대상', '대학생, 일반인', '대상연령', age].join('\n');
    const many = activityDetails(body('만 20세 이상 ~ 만 39세 이하, 만 40세 이상'), T).eligibilityLines;
    const one = activityDetails(body('만 19세 이상 ~ 만 34세 이하'), T).eligibilityLines;
    eq('④ 납작한 표의 여러 갈래 나이 줄은 자격 줄로 쓰지 않는다(틀린 미달) · 대상 줄은 남는다 · 갈래 하나면 남는다(대조)',
      [many.some((l) => /대상연령/.test(l)), many.includes('대상 : 대학생, 일반인'), one.some((l) => /대상연령 : 만 19세 이상 ~ 만 34세 이하/.test(l))], [false, true, true]);
    const PRIV = '신청 시 요청하는 정보(개인정보포함)는 사업운영기관에서 관리되오니 이점 반드시 유의하여 주시기 바랍니다.';
    const AGES = '대상연령 : 만 20세 이상 ~ 만 39세 이하, 만 40세 이상';
    eq('  eligLineOk — 개인정보 안내문·여러 갈래 나이는 아니다 · 자격 이름표 줄·갈래 하나 나이는 맞다',
      [eligLineOk(PRIV), eligLineOk(AGES), eligLineOk('참가자격 : 만 19~34세 대한민국 국민'), eligLineOk('○ 연령 : 만 19세 이상')], [false, false, true, true]);
    /* 이미 실린 글 — 발행 때 같은 거름 · 사람이 넣은 줄은 그대로 · 비면 칸과 출처 표식을 지운다 */
    const a = { eligibilityLines: [PRIV, AGES, '대상 : 대학생'], eligibilityFrom: '브라우저 본문' };
    const b = { eligibilityLines: [PRIV], eligibilityFrom: '브라우저 본문' };
    const c = { eligibilityLines: [AGES], eligibilityFrom: '관리자 2026-10-05' };
    eq('  sanitizeElig — 실린 글을 거른다 · 비면 칸·출처 표식을 지운다 · 관리자 줄은 건드리지 않는다',
      [sanitizeElig(a), a.eligibilityLines, sanitizeElig(b), 'eligibilityLines' in b, 'eligibilityFrom' in b, sanitizeElig(c), c.eligibilityLines],
      [true, ['대상 : 대학생'], true, false, false, false, [AGES]]);
    /* 브라우저 장부에 이미 적힌 옛 줄도 합칠 때 거른다 — 남는 줄이 없으면 합치지 않는다 */
    const prevLib = process.env.ACTIVITY_DOCS_AS_LIB;
    process.env.ACTIVITY_DOCS_AS_LIB = '1';   // 본편이 돌지 않게(불러오는 순간 data/activities.json 을 고친다)
    const AD = await import('../../collector/activity-docs.mjs');
    if (prevLib === undefined) delete process.env.ACTIVITY_DOCS_AS_LIB; else process.env.ACTIVITY_DOCS_AS_LIB = prevLib;
    const acts = { items: [{ url: 'u', title: 't' }, { url: 'v', title: 's' }] };
    const got = AD.mergeBrowserResults(acts, { u: { lines: [PRIV, AGES, '대상 : 대학생'], from: '브라우저 본문' }, v: { lines: [PRIV], from: '브라우저 본문' } });
    eq('  mergeBrowserResults — 장부의 옛 줄도 거른다 · 다 걸러지면 합치지 않는다',
      [got, acts.items[0].eligibilityLines, 'eligibilityLines' in acts.items[1]], [1, ['대상 : 대학생'], false]);
    eq('  수집 로봇이 발행 때 실린 글 전부에 sanitizeElig 를 건다', /acts\.items\.forEach\(sanitizeElig\)/.test(collectSrc), true);

    /* 소급 도구 — 활동 피드도 같은 함수로 */
    const sb = sandbox(root, 'hdj-qfeeds-refilter-act-');
    try {
      sb.write('tools/refilter-feeds.mjs', fs.readFileSync(new URL('tools/refilter-feeds.mjs', root)));
      sb.write('collector/extracted/notices-text.json', []);
      sb.write('data/registered.json', { items: [] });
      sb.write('data/external.json', JSON.stringify({ updatedAt: '2026-10-01', items: [] }, null, 1));
      const ACTS = { updatedAt: '2026-10-01', items: [{ url: 'https://k.example/1', title: 't', eligibilityLines: [AGES, '대상 : 대학생'] }, { url: 'https://k.example/2', title: 's', eligibilityLines: ['대상 : 청년'] }] };
      sb.write('data/activities.json', JSON.stringify(ACTS, null, 1));
      const w = sb.run('tools/refilter-feeds.mjs', ['--write']);
      const out = sb.json('data/activities.json');
      eq('  [소급 도구] 활동 피드 자격 줄도 같은 거름 · 로봇과 같은 저장 꼴',
        [w.status, (out?.items || []).map((n) => n.eligibilityLines), sb.read('data/activities.json') === JSON.stringify(out, null, 1)],
        [0, [['대상 : 대학생'], ['대상 : 청년']], true]);
    } finally { sb.done(); }
  }

  /* ── ⑤ 출처에서 뺀 게시판의 글은 다음 발행에서 빠진다 ── */
  {
    const A = 'https://ga.example.ac.kr/photo/list.do';
    const B = 'https://ga.example.ac.kr/notice/list.do';
    const live = new Map([['가대학교', new Set([boardKey(B)])]]);
    const items = [
      { school: '가대학교', url: 'https://ga.example.ac.kr/photo/view.do?no=1', title: '옛 게시판 글', src: boardKey(A) },
      { school: '가대학교', url: 'https://ga.example.ac.kr/notice/view.do?no=2', title: '지금 게시판 글', src: boardKey(B) },
      { school: '가대학교', url: 'https://ga.example.ac.kr/x/view.do?no=3', title: '열쇠 없는 옛 글' },
      { school: '가대학교', url: 'https://ga.example.ac.kr/photo/view.do?no=4', title: '두 게시판에 걸친 글', src: boardKey(A) },
    ];
    const seenNow = new Map([[urlKey('https://ga.example.ac.kr/photo/view.do?no=4'), boardKey(B)]]);
    const out = dropRetiredBoards(items, live, seenNow);
    eq('⑤ 옛 게시판 글은 빠진다 · 지금 게시판 글·열쇠 없는 옛 글은 남는다 · 이번에 지금 게시판 목록에서 다시 본 글은 열쇠를 고쳐 달고 남는다',
      [out.map((n) => n.title), items[3].src === boardKey(B)], [['지금 게시판 글', '열쇠 없는 옛 글', '두 게시판에 걸친 글'], true]);
    eq('  열쇠는 주소 대신 8자 · 주소 같음 규칙(canonUrl)을 따른다', [boardKey(B).length, boardKey(B) === boardKey(`${B}#top`)], [8, true]);
    eq('  소식 로봇 — 새 글에 열쇠를 달고 · 이번에 본 글은 열쇠를 고쳐 적고 · 발행에서 dropUnserved 뒤 · newsFloor 앞에 거른다',
      [/it\.src = boardKey\(s\.boardUrl\)/.test(newsSrc), /srcByUrl\.set\(urlKey\(i\.url\), boardKey\(s\.boardUrl\)\)/.test(newsSrc),
        before(newsSrc, 'all = dropUnserved(all)', 'dropRetiredBoards(all, liveBoards, srcByUrl)') && before(newsSrc, 'dropRetiredBoards(all, liveBoards, srcByUrl)', 'newsFloor(all')],
      [true, true, true]);

    /* 진짜 소식 로봇을 임시 폴더에서 — 예산 0 이라 게시판을 하나도 두드리지 않고 발행만 돈다(인터넷 없음).
       실려 있던 글: 뺀 게시판(A) 글 · 지금 게시판(B) 글 · 열쇠 없는 옛 글(앞날 게시일) */
    const sb = sandbox(root, 'hdj-qfeeds-news-');
    try {
      const SCHOOL = '경북대학교';
      const key = require('../../match-engine.js').noticeFileKey(SCHOOL);
      const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
      const KA = 'https://www.knu.example.ac.kr/photo/list.do';
      const KB = 'https://www.knu.example.ac.kr/notice/list.do';
      sb.write('collector/news-sources.json', { sources: [{ school: SCHOOL, campus: '', boardUrl: KB }] });
      sb.write('collector/news-config.json', {});
      sb.write(`data/news/${key}.json`, { school: SCHOOL, updatedAt: today, items: [
        { school: SCHOOL, campus: '', url: 'https://www.knu.example.ac.kr/photo/view.do?no=1', title: '포토뉴스 합동소방훈련 실시', src: boardKey(KA), foundAt: today },
        { school: SCHOOL, campus: '', url: 'https://www.knu.example.ac.kr/notice/view.do?no=2', title: '2학기 수강신청 정정 안내', src: boardKey(KB), foundAt: today },
        { school: SCHOOL, campus: '', url: 'https://www.knu.example.ac.kr/x/view.do?no=3', title: '도서관 열람실 운영시간 변경 안내', foundAt: today, postedAt: '2099-01-22' },
      ] });
      const r = sb.run('collector/collect-news.mjs', [], { NEWS_BUDGET_MS: '0' });
      const doc = sb.json(`data/news/${key}.json`);
      const by = Object.fromEntries((doc?.items || []).map((n) => [n.url.slice(-1), n]));
      eq('  [소식 로봇 실행] 게시판을 안 두드리고 끝난다 · 뺀 게시판 글은 빠지고 지금 게시판·열쇠 없는 글은 남는다 · 앞날 게시일은 비운다',
        [r.status, Object.keys(by).sort(), by['3'] ? ('postedAt' in by['3']) : 'missing', /오늘보다 뒤인 게시일 1건/.test(sb.read('collector/news-report.md') || '')],
        [0, ['2', '3'], false, true]);
      if (r.status !== 0) console.log(r.out.slice(-800));
    } finally { sb.done(); }
  }
}
