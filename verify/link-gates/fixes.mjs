/* 「원문 링크 정직성」 — fixes 갈래 (2026-10-04 · 개발자 지시 *"원문 공고 링크를 최대한 어떻게든 찾을 방법"* · *"관리자 페이지에 원문 공고를 추가할 칸"*)
   바로잡은 원문(source-link.js ⑥ — 사람: data/link-fixes.json · 로봇: data/link-check.json fix)을 화면 이름 한 곳이 어떻게 쓰는가.
   🔴 표본만으로 잰다(실데이터 금지 — 수집 로봇도 이 관문을 돈다). */
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default async function gate(eq, ctx) {
  const SL = require('../../source-link.js');
  const MARK = 'https://a.kr/bbs/list.do#n-%ED%91%9C%EB%B3%B8';
  const PAGE = 'https://a.kr/bbs/view.do?id=3';
  const marker = { id: 'reg-m', sourceUrl: MARK, name: '표본 목록' };
  const page = { id: 'reg-p', sourceUrl: PAGE, name: '표본 보통' };
  const feed = { title: '표본 피드', url: MARK, school: '가대학교' };
  const kosaf = { id: 'kosaf-0001', sourceKind: 'kosaf', sourceUrl: 'https://found.or.kr', deadline: '2026-10-20', name: '표본 재단' };
  const label = (it) => SL.sourceLink(it, 'detail').label;
  const href = (it) => SL.sourceLink(it, 'detail').href;
  const reset = () => { SL.setLinkChecks(null); SL.setLinkFixes(null); };

  /* ① 로봇 바로잡기 — 목록·재단 홈페이지만 바꾸고, 이미 그 공고로 가는 링크(page)는 그대로 */
  reset();
  SL.setLinkChecks({ bad: {}, fix: {
    'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=9' },
    'id:reg-p': { url: 'https://a.kr/bbs/view.do?id=1' },
    [`u:${MARK}`]: { url: 'https://a.kr/bbs/view.do?id=7' },
    'id:kosaf-0001': { url: 'https://found.or.kr/bbs/view?no=5', round: '2026-10-20' },
  } });
  eq('① 로봇 바로잡기 — 목록 표식(정식 등록·피드)·층2 재단 홈페이지는 원문으로 · 이미 원문인 링크는 안 바꾼다',
    [[label(marker), href(marker)], [label(feed), href(feed)], [label(kosaf), href(kosaf)], href(page)],
    [['원문 공고 ↗', 'https://a.kr/bbs/view.do?id=9'], ['원문 공고 ↗', 'https://a.kr/bbs/view.do?id=7'], ['원문 공고 ↗', 'https://found.or.kr/bbs/view?no=5'], PAGE]);

  /* ② 회차 — 층2 재단 코드는 해마다 그대로다. 마감이 바뀌면 지난 회차 공고를 쓰지 않는다(가짜 공지) */
  reset();
  SL.setLinkChecks({ bad: {}, fix: { 'id:kosaf-0001': { url: 'https://found.or.kr/bbs/view?no=5', round: '2025-10-20' } } });
  eq('② 회차가 다른 바로잡기는 버린다 — 층2는 다시 「재단 홈페이지」', [label(kosaf), href(kosaf)], ['재단 홈페이지 ↗', 'https://found.or.kr']);

  /* ③ 사람이 이긴다 — 이미 원문인 링크도 관리자가 넣은 주소로 · 로봇 바로잡기보다 먼저 */
  reset();
  SL.setLinkChecks({ bad: {}, fix: { 'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=9' } } });
  SL.setLinkFixes({ fix: { 'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=8' }, 'id:reg-p': { url: 'https://a.kr/x/view?no=2' } } });
  eq('③ 관리자 바로잡기 — 로봇보다 먼저 · 이미 원문인 링크도 바꾼다(사람이 열어 보고 넣은 것)', [href(marker), href(page), SL.linkFixFor(page).src], ['https://a.kr/bbs/view.do?id=8', 'https://a.kr/x/view?no=2', 'admin']);

  /* ④ 원문이 아닌 꼴은 바로잡기로 받지 않는다 — 목록 표식·목록+번호·첫 화면 파일·http 아님 */
  reset();
  SL.setLinkFixes({ fix: {
    'id:reg-m': { url: 'https://a.kr/bbs/list.do#n-x' },
    [`u:${MARK}`]: { url: 'https://www.gachon.ac.kr/kor/7986/subview.do?nttId=125842' },
    'id:kosaf-0001': { url: 'https://found.or.kr/index.htm' },
    'id:reg-p': { url: 'javascript:void(0)' },
  } });
  eq('④ 표식·목록+번호·첫 화면 파일·http 아닌 주소는 바로잡기로 안 쓴다', [label(marker), label(feed), label(kosaf), href(page)], ['게시판 목록 ↗', '게시판 목록 ↗', '재단 홈페이지 ↗', PAGE]);

  /* ⑤ 바로잡은 원문도 로봇 장부(bad)로 본다 — 사람이 넣은 주소가 열리지 않으면 '(확인 필요)' */
  reset();
  SL.setLinkFixes({ fix: { 'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=8' } } });
  SL.setLinkChecks({ bad: { 'https://a.kr/bbs/view.do?id=8': { v: 'gone', at: '2026-10-05' } }, fix: {} });
  eq('⑤ 바로잡은 원문이 확정된 문제면 그대로 말한다(확인 필요)', [label(marker), href(marker)], ['원문 공고(확인 필요) ↗', 'https://a.kr/bbs/view.do?id=8']);

  /* ⑥ 학생이 여는 주소 한 곳(effectiveLinkUrl) — 도우미·제출처가 같은 주소를 쓴다 */
  reset();
  SL.setLinkChecks({ bad: {}, fix: { 'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=9' } } });
  const dataSrc = fs.readFileSync(new URL('data.js', ctx.root), 'utf8');
  const box = vm.createContext({ console, URL, sourceLink: SL.sourceLink, module: undefined });
  vm.runInContext(dataSrc, box, { filename: 'data.js' });
  const oc = vm.runInContext('officialChannel', box);
  const ocK = oc({ ...kosaf });
  SL.setLinkChecks({ bad: {}, fix: { 'id:reg-m': { url: 'https://a.kr/bbs/view.do?id=9' }, 'id:kosaf-0001': { url: 'https://found.or.kr/bbs/view?no=5', round: '2026-10-20' } } });
  const ocK2 = oc({ ...kosaf });
  eq('⑥ 제출처(officialChannel)도 바로잡은 원문 — 정식 등록 · 층2(바로잡기 전은 재단 홈페이지 · 뒤는 원문 공고)',
    [SL.effectiveLinkUrl(marker), oc({ ...marker, provider: '가대학교' }).url, [ocK.url, /재단 홈페이지/.test(ocK.label)], [ocK2.url, /재단 홈페이지/.test(ocK2.label)]],
    ['https://a.kr/bbs/view.do?id=9', 'https://a.kr/bbs/view.do?id=9', ['https://found.or.kr', true], ['https://found.or.kr/bbs/view?no=5', false]]);
  reset();

  /* ⑦ 배선 — 앱(loadLinkChecks)과 화면 확인 도구(what-shows)가 두 장부를 다 넘긴다 · 관리자 바로잡기 파일이 있다 */
  const ws = fs.readFileSync(new URL('verify/what-shows.mjs', ctx.root), 'utf8');
  const fxDoc = JSON.parse(fs.readFileSync(new URL('data/link-fixes.json', ctx.root), 'utf8'));
  eq('⑦ what-shows 가 관리자 바로잡기도 넘긴다 · data/link-fixes.json 꼴({v, fix})',
    [/link-fixes\.json/.test(ws) && /setLinkFixes/.test(ws), fxDoc.v === 1 && typeof fxDoc.fix === 'object'], [true, true]);
}
