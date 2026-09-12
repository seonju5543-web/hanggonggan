/**
 * 새 판형 시작 파일 만들기 (2026-09-12 개발자 지시 ⑤ — "좋은 예시를 붙여넣고 '정해진 번호에
 * 추가해 달라' 고 하면 같은 디자인 양식을 번호에 더하고 뒤에도 쓸 수 있게").
 *
 * 하는 일: 다음 번호를 정하고 · `insta/templates/<번호>-<id>.mjs` 를 4번(포스터)을 본떠 만들고 ·
 *          `insta/templates.json` 에 한 줄 더한다. **디자인은 사람(Claude 세션)이 그 파일을 고쳐 넣는다** —
 *          절차는 `.claude/skills/insta-template/SKILL.md`.
 * 🔴 번호는 **끝에 더하기만** 한다. 사이에 끼우거나 번호를 바꾸면 개발자가 "3번" 이라고 한 말이 다른 판형이 된다.
 * 🔴 id 는 영문 소문자·숫자·하이픈만 — 파일 이름이자 meta.json 의 `tpl` 값이다.
 *
 * 실행: node insta/new-template.mjs <id> "<이름>" "<무엇을 베꼈나>"
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REG = join(ROOT, 'insta', 'templates.json');
const [id, name, ref] = process.argv.slice(2);
if (!id || !name) { console.error('쓰는 법: node insta/new-template.mjs <id> "<이름>" "<무엇을 베꼈나>"'); process.exit(1); }
if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) { console.error(`id '${id}' — 영문 소문자로 시작, 소문자·숫자·하이픈만.`); process.exit(1); }

const reg = JSON.parse(readFileSync(REG, 'utf8'));
if (reg.templates.some((t) => t.id === id)) { console.error(`'${id}' 는 이미 있습니다 (${reg.templates.find((t) => t.id === id).no}번).`); process.exit(1); }
const no = Math.max(...reg.templates.map((t) => t.no)) + 1;
const file = join(ROOT, 'insta', 'templates', `${no}-${id}.mjs`);
if (existsSync(file)) { console.error(`${file} 가 이미 있습니다.`); process.exit(1); }

// 4번(포스터)이 본보기다 — 구조·주석·규칙이 다 들어 있다. 머리말만 새 번호로 바꾼다.
const base = join(ROOT, 'insta', 'templates', '4-poster.mjs');
copyFileSync(base, file);
writeFileSync(file, readFileSync(file, 'utf8')
  .replace(/^\/\*\*\n \* 4번 판형 · 포스터[^\n]*\n/, `/**\n * ${no}번 판형 · ${name} — ${ref || '(무엇을 베꼈는지 적을 것)'} (시작 파일 · 4번 포스터를 본떴다 — 디자인을 여기에 옮겨 넣는다)\n`));

reg.templates.push({ no, id, name, ref: ref || '', builtin: false });
writeFileSync(REG, `${JSON.stringify(reg, null, 1)}\n`);   // 🔴 로봇 기록장 형식(들여쓰기 1칸)
console.log(`✅ ${no}번 ${name}(${id}) — ${file.replace(ROOT + '/', '')}`);
console.log(`다음 — ① 그 파일의 css/cards 를 붙여넣은 예시대로 고친다 (사실 재료는 ctx 에서만)`
  + `\n      ② node insta/render.mjs <공고> --tpl=${no}   로 그려 보고 미리보기를 개발자에게 보여 준다`
  + `\n      ③ node verify/verify-insta.js · node insta/sweep-overflow.mjs --tpl=${no}   두 관문을 통과해야 끝이다`);
