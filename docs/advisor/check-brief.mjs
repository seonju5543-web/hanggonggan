#!/usr/bin/env node
/* ============================================================================
   기술 고문 요청서 — 보내기 전에 숫자를 나란히 찍어 본다 (2026-09-23 신설)

   왜 만들었나 — 이 문서는 **바깥 사람에게 보내는 글**이라 틀려도 고칠 기회가 없다.
   실제로 2026-09-19 판은 숫자 여섯이 낡아 있었다(정식 등록 45→72건 · 재단 116→101곳 ·
   공고 목록 368→34KB · 코드 14,677→17,050줄 …). 그중 공고 목록 크기는 Q7(확장성)의
   **논거 자체**라, 그대로 보냈으면 고문이 **없는 병목**을 놓고 답을 썼을 것이다.

   🔴 이 도구는 **막지 않는다.** 건수는 날마다 변하므로 관문으로 잠그면 곧 통과할 수 없게
      되고, 그러면 다음 사람이 관문 전체를 꺼 버린다(2026-09-11 서체 문턱에서 겪었다).
      잘 안 변하는 전제(수집망 2곳 · 이미 고친 결함)만 `test-collector.mjs` 가 잠그고,
      **변하는 값은 여기서 눈으로 본다.**

   🔴 **문서에서 숫자를 찾아 읽지 않는다** — 정규식으로 긁으면 표·그림·본문에 흩어진 같은
      값을 놓치거나 엉뚱한 숫자를 집는다. 그래서 '지금 값'만 재서 찍고, 문서와 맞는지는
      사람이 본다. 아는 척하지 않는 것이 이 도구의 설계다.

   실행: node docs/advisor/check-brief.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = (...p) => path.join(ROOT, ...p);
const kb = (p) => Math.round(fs.statSync(at(p)).size / 1024);
const json = (p) => JSON.parse(fs.readFileSync(at(p), 'utf8'));

const reg = json('data/registered.json').items;
const notices = json('data/notices.json');
const noticeList = notices.items || notices.notices || [];
const kosaf = json('data/kosaf-open.json').items || [];

/* 앱 코어 = index.html 이 싣는 스크립트 + 서비스워커 (문서 표 2 와 같은 셈법) */
const html = fs.readFileSync(at('index.html'), 'utf8');
const appFiles = [...new Set([...html.matchAll(/src="([a-z0-9.-]+\.js)"/g)].map((m) => m[1]))].concat('sw.js');
let appLines = 0;
for (const f of appFiles) { try { appLines += fs.readFileSync(at(f), 'utf8').split('\n').length; } catch { /* 없으면 센다 */ } }

const dataBytes = fs.readdirSync(at('data'))
  .map((f) => { try { const s = fs.statSync(at('data', f)); return s.isFile() ? s.size : 0; } catch { return 0; } })
  .reduce((a, b) => a + b, 0);

const rows = [
  ['정식 등록 공고', `${reg.length}건 · ${kb('data/registered.json')} KB`],
  ['실시간 공고', `${noticeList.length}건 · ${kb('data/notices.json')} KB`],
  ['KOSAF 재단(층2)', `${kosaf.length}곳 · ${kb('data/kosaf-open.json')} KB`],
  ['data/ 총량', `${(dataBytes / 1024 / 1024).toFixed(1)} MB`],
  ['앱 코어', `${appFiles.length}개 파일 · ${appLines.toLocaleString()}줄`],
  ['수집 로봇(.mjs)', `${fs.readdirSync(at('collector')).filter((f) => f.endsWith('.mjs')).length}개`],
  ['검증 드라이버', `${fs.readdirSync(at('verify')).filter((f) => /\.(js|mjs|cjs)$/.test(f)).length}개`],
  ['이메일 접수 확보', `${reg.filter((x) => x.applyEmail).length}건`],
  ['포털 시스템 확보', `${reg.filter((x) => x.applyPortal).length}건`],
  ['수집 대상 학교', `${(json('collector/schools.json').schools || []).filter((x) => x && !x.parked).length || 2}곳`],
];

console.log('■ 지금 저장소 실측 — 요청서의 숫자와 나란히 보세요\n');
for (const [k, v] of rows) console.log(`   ${k.padEnd(18)} ${v}`);
console.log(`\n   문서: docs/advisor/tech-advisor-brief.html`);
console.log('   고친 뒤에는 꼬리말의 실측 날짜를 함께 고치고 PDF 를 다시 뽑으세요:');
console.log('     node docs/advisor/render.js\n');
/* 🔴 종료 코드는 언제나 0 — 이 도구는 보여 주는 것이지 막는 것이 아니다. */
