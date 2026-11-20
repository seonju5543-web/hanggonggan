/* ============================================================
   첨부 경보 세기 (2026-11-17) — 원문 받기 로봇 워크플로(rescue-bodies.yml)의 경보 짝이 부른다

   학생 화면에 떠 있는 정식 등록 공고 가운데 ① 원문 화면에 파일 이름은 보이는데 받을 주소를 못 구한 것 ② 브라우저가 막혀 화면을 못 봤고 첨부가 0개인 것을
   세어 `count=<수>` · `list=<이름들 한 줄>` 로 찍는다(GITHUB_OUTPUT 꼴). 규칙은 rescue-plan.mjs attachmentAlarms 한 곳 — 리포트 맨 위 표와 같은 셈이다.
   읽기만 한다(아무 파일도 안 고친다). 값에 줄바꿈이 들어가지 않게 누른다 — 공고 이름이 출력 파일의 다른 칸을 만들지 못하게.
   ============================================================ */
import fs from 'node:fs';
import { attachmentAlarms } from './rescue-plan.mjs';

const HERE = new URL('.', import.meta.url);
const read = (rel, fallback) => { try { return JSON.parse(fs.readFileSync(new URL(rel, HERE), 'utf8')); } catch { return fallback; } };
const reg = read('../data/registered.json', { items: [] });
const ledger = read('rescue-ledger.json', {});
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const al = attachmentAlarms(reg.items || [], ledger, today);
const one = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
console.log(`count=${al.rows.length}`);
console.log(`checked=${al.checked}`);
console.log(`notyet=${al.notYet}`);
console.log(`list=${one(al.rows.slice(0, 12).map((r) => `${one(r.name).slice(0, 40)}(${r.id})`).join(' / ')).slice(0, 900)}`);
