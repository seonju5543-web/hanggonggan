/* 「원문 링크 정직성」 — data 갈래 (2026-10-03): 데이터 감사의 원문 링크 경고(verify/link-audit.cjs)
   🔴 여기는 **가짜 자료로 규칙만** 잰다. 실데이터에 기댄 검사를 관문에 두지 않는다 — 수집 로봇도 이 관문을 돌리므로
      실데이터가 선을 넘는 날 그날 결과가 통째로 되돌려진다(CLAUDE.md 「합칠 때 마감은…」 2026-10-01 사고).
      실데이터는 audit-data.js 가 **경고**로만 본다. */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { auditLinks } = require('../link-audit.cjs');

export default async function gate(eq, ctx) {
  const set = (ds, items) => ({ ds, items, urlOf: (x) => x.sourceUrl || x.url, idOf: (x) => x.id });
  const r = auditLinks([
    set('registered', [
      { id: 'snu', sourceUrl: 'https://student.snu.ac.kr/x/?mod=document&#038;uid=392' },
      { id: 'snue', sourceUrl: 'https://www.snue.ac.kr/snue/na/ntt/selectNttList.do?mi=3004&bbsId=1083&nttId=55323' },
      { id: 'gachon', sourceUrl: 'https://www.gachon.ac.kr/kor/7986/subview.do?article.offset=10&nttId=125311' },
      { id: 'kosaf', sourceUrl: 'https://namgu.gwangju.kr', sourceKind: 'kosaf' },
      { id: 'ok', sourceUrl: 'https://www.konkuk.ac.kr/bbs/konkuk/235/1202780/artclView.do', attachments: [{ name: 'a.hwp', url: 'javascript:downloadfile(1)' }] },
      { id: 'marker', sourceUrl: 'https://www.gachon.ac.kr/bbs/kor/475/artclList.do#n-%EC%A0%9C%EB%AA%A9' },
    ]),
    set('activities', [{ id: 'jeju', url: 'https://www.jeju.go.kr/index.htm' }, { id: 'gone', url: 'https://s.kr/y?id=9' }]),
  ], { bad: { 'https://s.kr/y?id=9': { v: 'gone', at: '2026-10-04' } } });
  const c = r.counts;
  eq('① 기호 · 목록+번호(오프셋 붙은 꼴까지) · 홈페이지(층2 제외) · 스크립트 첨부 · 로봇 확정을 센다 — 표식은 목록+번호로 세지 않는다',
    [c.registered.entity, c.registered.listPlusId, c.registered.home, c.registered.scriptAttach, c.registered.marker, c.activities.home, c.activities.confirmedBad],
    [1, 2, 0, 1, 1, 1, 1]);
  eq('  전부 경고(오류 아님) — 문장에 무엇을 고칠지와 예시 id 를 담는다',
    [r.warns.length, r.warns.some((w) => /HTML 기호.*snu/.test(w)), r.warns.some((w) => /글 번호만.*snue, gachon/.test(w)), r.warns.some((w) => /확정한 링크.*gone\(gone\)/.test(w))],
    [5, true, true, true]);
  eq('  깨끗한 자료면 경고 0', auditLinks([set('registered', [{ id: 'ok', sourceUrl: 'https://a.kr/view.do?id=3' }])], null).warns.length, 0);

  /* ② 배선 — 감사가 이 규칙을 부르고, 오류(errors)로는 올리지 않는다 */
  const audit = fs.readFileSync(new URL('verify/audit-data.js', ctx.root), 'utf8');
  eq('② audit-data.js 가 link-audit 의 경고를 warns 로만 싣는다(실데이터로 로봇 저장을 막지 않는다)',
    [/require\('\.\/link-audit\.cjs'\)/.test(audit), /auditLinks\(sets, readJson\('data\/link-check\.json'\)\)\.warns\.forEach\(\(w\) => warns\.push\(w\)\)/.test(audit), /auditLinks[\s\S]{0,400}errors\.push/.test(audit.slice(audit.indexOf('link-audit.cjs')))],
    [true, true, false]);
  eq('  앱이 보여 주는 다섯 묶음을 모두 훑는다(학교별 공고 파일 · 소식 파일 포함)',
    ['registered', 'notices(학교별)', 'external', 'activities', 'news'].every((ds) => audit.includes(`ds: '${ds}'`)), true);

  /* ③ 합집합 병합기가 실시간 공고 장부를 수집기보다 작게 자르지 않는다 (2026-10-03 사고: 사냥꾼·복구 로봇이 같은 때 저장하며
     병합기를 거치자 '전체 200건' 박힌 상한에 339 → 200건 · 13개교 139건이 장부에서 빠졌다 — 수집기 상한은 학교 수 × 15) */
  {
    const os = await import('node:os');
    const path = await import('node:path');
    const { spawnSync } = await import('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-cap-'));
    const mk = (from, to) => ({ updatedAt: '2026-10-03', items: Array.from({ length: to - from }, (_, k) => {
      const i = from + k;
      return { school: `학교${i % 30}`, title: `2026 표본 장학금 ${i}번 선발 안내`, url: `https://s${i % 30}.ac.kr/view.do?id=${i}`, foundAt: '2026-10-01' };
    }) });
    const base = path.join(dir, 'base.json'); const ours = path.join(dir, 'ours.json'); const theirs = path.join(dir, 'theirs.json');
    fs.writeFileSync(base, JSON.stringify(mk(0, 280), null, 1));
    fs.writeFileSync(ours, JSON.stringify(mk(0, 300), null, 1));
    fs.writeFileSync(theirs, JSON.stringify(mk(0, 290), null, 1));
    const r = spawnSync(process.execPath, [new URL('tools/merge-json-union.mjs', ctx.root).pathname, base, ours, theirs, 'data/notices.json'], { encoding: 'utf8' });
    let n = -1;
    try { n = JSON.parse(fs.readFileSync(ours, 'utf8')).items.length; } catch { /* 깨짐 */ }
    fs.rmSync(dir, { recursive: true, force: true });
    eq('③ 병합기 — 30개교 300건을 합쳐도 300건(수집기 capNotices 와 같은 상한 · 예전 박힌 200 아님)', [r.status, n], [0, 300]);
    const mj = fs.readFileSync(new URL('tools/merge-json-union.mjs', ctx.root), 'utf8');
    eq('  병합기는 상한을 수집기 함수(capNotices)로 — 숫자를 박아 두지 않는다', [/capNotices\(dedupeNotices\(all\)\)/.test(mj), /items\.slice\(0, 200\)/.test(mj)], [true, false]);
  }
}
