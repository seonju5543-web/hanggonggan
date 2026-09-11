/* 화면의 말투와 모양이 되돌아가지 않게 하는 관문 (2026-08-29 신설)
 *
 * 왜 만들었나 — 공동개발자·전문가의 지적:
 *   *"디자인뿐 아니라 설명의 빈도, 말투, UX 설계 전부에서 사용자가 앱을 AI로
 *     제작했다는 사실을 알아차릴 수 있고, 이는 앱의 신뢰성을 떨어뜨린다."*
 *   맞는 지적이었다. 실제로 세어 보니 화면에 이모지 80개, 한글 문장 속 느낌표 8개,
 *   "~해 드릴게요" 23회였고, style.css 에는 모서리 값이 10종·그림자 선언이 45개였다.
 *
 * 🔴 이 저장소의 원칙 그대로다 — **안내문에 적는 것은 리포트고, 강제하는 것은 관문이다.**
 *    CLAUDE.md 에 "이모지를 쓰지 말 것"이라고 적어 두는 것만으로는 다음 세션이 또 넣는다.
 *    여기서 세면 사람이 기억하든 말든 막힌다.
 *
 * ⚠️ 대장님(chat.js·style.css 의 .chat-* 규칙)은 **일부러 제외한다** — 2026-08-29 개발자 지시:
 *    "대장님은 사용자가 직접 대화하는 창구이므로 그대로 변경사항 없이 놔둬."
 *
 * 실행:  node verify/ui-tone.mjs          (실패하면 종료 코드 1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`  ${ok ? '✓' : '✕'} ${name}${ok ? '' : `\n      나온 값: ${JSON.stringify(got).slice(0, 400)}`}`);
};

/* 주석을 통째로 걷어낸다 — 주석은 화면에 안 나간다.
   (여기 파일 머리말에도 이모지가 있는데 그걸 세면 관문이 자기 자신을 잡는다) */
const stripComments = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

/* 화면 코드 — 🔴 chat.js 는 넣지 않는다 (위 지시) */
const UI_FILES = ['index.html', 'app.js', 'essay.js', 'notify.js', 'notify-rules.js',
  'forms.js', 'form-plan.js', 'essay-ask.js', 'essay-submit-check.js', 'essay-quality.js'];

/* ── ① 이모지 ───────────────────────────────────────────────────────────────
   ⚠️ `✓ ✕ □ △ ← ↑ ● ■ ※` 같은 것은 이모지가 아니라 **활자**다. 이 앱은 그것들을
      판정 표시(✓ 충족 / ✕ 미달)에 쓰고 있고 그건 지운 적이 없다 — 유니코드 표에서
      이미 Extended_Pictographic 이 아니라 저절로 빠진다.
   🔴 첫 판은 직접 짠 범위 정규식이라 **`⚡`(U+26A1)를 놓쳤다.** 되돌려 보는 검사를
      안 했으면 "통과"라고 보고했을 것이다 — 범위를 손으로 적지 말고 유니코드 속성을 쓴다.
   아래 셋만 예외다(뜻이 활자이고 실제로 쓰고 있다):
      ↗ 외부 링크 · ☑ ☐ 문서 출력의 체크칸(forms.js 가 원본 서식을 그대로 찍는다) */
const KEEP = new Set(['↗', '☑', '☐']);
console.log('■ 화면에 이모지가 없다 (대장님 제외)');
{
  const found = [];
  for (const f of UI_FILES) {
    stripComments(R(f)).split('\n').forEach((l, i) => {
      const m = [...l].filter((c) => /\p{Extended_Pictographic}/u.test(c) && !KEEP.has(c));
      if (m.length) found.push(`${f}:${i + 1} ${m.join('')}`);
    });
  }
  eq('이모지 0개 — 아이콘이 필요하면 SVG 를 쓴다 (.ico)', found, []);
}

/* ── ② 한글 문장 속 느낌표 ─────────────────────────────────────────────────
   `!` 는 자바스크립트에서 부정 연산자이기도 하다. **한글 바로 뒤에 오는 것만** 센다. */
console.log('\n■ 화면 문구에 느낌표가 없다');
{
  const found = [];
  for (const f of UI_FILES) {
    stripComments(R(f)).split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/[가-힣][^\n'"`<>]{0,40}?[가-힣]\s*!/g)) found.push(`${f}:${i + 1} …${m[0].slice(-24)}`);
    });
  }
  eq('느낌표 0개 — 금융·행정 서비스는 쓰지 않는다', found, []);
}

/* ── ③ 앱이 1인칭으로 말하지 않는다 ────────────────────────────────────────
   "찾아 드릴게요 / 챙겨드려요" 는 앱이 자기를 주어로 세우는 말이다. 챗봇 말투라
   화면 전체에 깔리면 "AI가 만든 앱"으로 읽힌다. 대장님 안에서만 허용한다. */
console.log('\n■ 앱이 1인칭 서비스 말투를 쓰지 않는다');
{
  const BAD = /(드릴게요|드려요|드릴 수 있어요|챙겨드|알려드|찾아드|보내 드|해 드리)/g;
  const found = [];
  for (const f of UI_FILES) {
    stripComments(R(f)).split('\n').forEach((l, i) => {
      const m = l.match(BAD);
      if (m) found.push(`${f}:${i + 1} ${m.join(',')}`);
    });
  }
  eq('1인칭 서비스 말투 0개', found, []);
}

/* ── ④ style.css — 토큰 밖의 값 ────────────────────────────────────────────
   토큰이 있는데도 매번 새 값이 붙으면 화면마다 재질이 달라 보인다. 정리 전 실측:
   모서리 10종 · 그림자 선언 45개 · 글자 크기 27종 · 그라데이션 15곳.
   ⚠️ `.chat-*` 규칙과 @keyframes 는 뺀다 — 대장님은 손대지 않기로 했고,
      애니메이션은 중간값이 필요해 토큰으로 못 쓴다. */
console.log('\n■ style.css 가 토큰 밖의 값을 쓰지 않는다');
{
  const css = R('style.css').split('\n');
  let sel = '', inKeyframes = 0, depth = 0;
  const radius = [], shadow = [], font = [], grad = [];
  for (let i = 0; i < css.length; i++) {
    const l = css[i];
    const m = l.match(/^\s*([.#a-zA-Z[][^{}]*?)\s*\{/);
    if (m) sel = m.group ? m.group(1) : m[1].trim();
    if (/@keyframes/.test(l)) { inKeyframes = 1; depth = 0; }
    if (inKeyframes) { depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length; if (depth <= 0 && /\}/.test(l)) inKeyframes = 0; continue; }
    if (/chat/.test(sel)) continue;                       // 대장님 제외
    const line = l.replace(/\/\*[\s\S]*?\*\//g, '');
    if (/border-radius:\s*[0-9.]+px/.test(line)) radius.push(`${i + 1}: ${line.trim().slice(0, 50)}`);
    if (/box-shadow:\s*[0-9-]/.test(line)) shadow.push(`${i + 1}: ${line.trim().slice(0, 50)}`);
    if (/font-size:\s*[0-9.]+px/.test(line)) font.push(`${i + 1}: ${line.trim().slice(0, 50)}`);
    if (/linear-gradient/.test(line) && !/--grad-navy:/.test(line)) grad.push(`${i + 1}: ${line.trim().slice(0, 50)}`);
  }
  eq('모서리는 --radius-* 토큰만 쓴다', radius, []);
  eq('글자 크기는 --t-* 토큰만 쓴다', font, []);
  /* 그림자는 기능적으로 리터럴이 필요한 것이 하나 있다(스위치 손잡이) — 그 하나까지만 봐준다 */
  eq('그림자도 토큰만 쓴다 (--shadow · --shadow-lift · --shadow-sheet · --ring · --cutout · --knob)', shadow, []);
  eq('그라데이션은 --grad-navy 한 곳에서만 정의한다', grad, []);
}

/* ── ⑤ 되돌아가지 않게 하는 톱니 (2026-09-10) ───────────────────────────────
   왜 만들었나 — 개발자 지시 *"디자인 측면에서 AI티를 없앨 수 있는 방법"* 을 검토하다
   **이미 한 번 고친 것이 그대로 되돌아와 있는 것**을 찾았다. 2026-09-01 에 개발자가
   *"간격이 맞지 않은 부분이 많다"* 고 지적해 세로 간격을 네 단계(--sp-1~4)로 못 박았는데,
   실제로 그 토큰을 쓰는 곳은 24군데뿐이고 **토큰을 만든 뒤에 새로 쓴 생 px 여백이 104곳**이었다.
   style.css 머리말에 "숫자를 직접 쓰지 말 것"이라고 적어 두기만 했기 때문이다.

   🔴 이 저장소의 원칙 그대로다 — **안내문에 적는 것은 리포트고, 강제하는 것은 관문이다.**

   ⚠️ **톱니**다: 지금 값을 천장으로 적어 두고 **늘어나면 실패**시킨다. 줄이면 천장을 같이
      내리라고 알린다. 그래서 오늘 다 못 고쳐도 **내일 더 나빠지지는 않는다.**
   ✅ 2026-09-10 페이스리프트에서 내렸다: 여백 521 → 20 · 색 95 → 76 · 없는 토큰 4 → 0.
   🔴 **2026-09-11 개발자 지시로 여백을 되돌렸다 → 천장을 519 로 다시 올렸다.**
      "앱 내에서 크기 조정 부분 모두 다시 되돌려" 였고, 여백 토큰화는 값을 1~3px 씩
      움직였으므로 크기 조정에 해당한다. 색 76 과 없는 토큰 0 은 **색 작업이라 그대로 둔다**
      (되돌리라는 지시 범위가 아니었고, 없는 토큰 4종은 팔레트에 없는 색이 화면에 뜨던 진짜 결함이다).
      ⚠️ 천장을 올린 것은 "여백이 흩어져도 좋다"는 뜻이 **아니다.** 톱니는 여전히
         **더 늘어나는 것**을 막는다 — 지금이 새 기준선일 뿐이다.

   ⚠️ 세는 데서 빼는 것 셋 — 이유가 각각 다르다:
      · `.chat-*`  대장님. 2026-08-29 개발자 지시로 손대지 않기로 한 영역이다.
      · `.fd-*` `.form-doc`  인쇄되는 신청서 문서다. 흰 종이에 검은 글씨·회색 괘선이 맞다.
      · `@keyframes`  움직임의 중간값이라 여백 리듬과 무관하다. */
const CEILING = { space: 519, color: 76, ghost: 0 };

/** 천장 검사 — 늘면 실패, 줄면 천장을 내리라고 알린다(실패는 아니다). */
const le = (name, got, ceiling, hint) => {
  const ok = got <= ceiling;
  if (!ok) fail++;
  console.log(`  ${ok ? '✓' : '✕'} ${name}: ${got} (천장 ${ceiling})`);
  if (!ok) console.log(`      ${hint}`);
  else if (got < ceiling) console.log(`      ↓ ${ceiling - got}곳 줄었습니다 — CEILING 을 ${got} 로 내려 주세요(안 내리면 다시 늘어도 안 잡힙니다).`);
};

/* ── 🔴 괄호 짝 (2026-09-11) ──
   style.css 끝 블록에서 미디어 쿼리를 걷어내다 닫는 `}` 하나가 남았다. 브라우저는 짝 없는 `}` 를 만나면
   **그 뒤에 오는 첫 규칙을 통째로 버린다** — 같은 날 오후 덧댄 `:root { --ring }` 이 실제로 안 먹었고
   (검사도 눈도 모른 채) 실측으로만 드러났다. 주석·문자열을 뺀 뒤 `{` 와 `}` 의 개수가 같아야 한다. */
console.log('\n■ style.css 의 괄호 짝이 맞는다 (2026-09-11)');
{
  const css = R('style.css').replace(/\/\*[\s\S]*?\*\//g, '').replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '');
  const open = (css.match(/\{/g) || []).length, close = (css.match(/\}/g) || []).length;
  eq(`여는 괄호 ${open} = 닫는 괄호 ${close} (짝 없는 } 는 뒤따르는 규칙을 브라우저가 버린다)`, open, close);
}

console.log('\n■ 토큰 이탈이 더 늘지 않는다 (톱니 · 2026-09-10)');
{
  const lines = R('style.css').split('\n');
  let sel = '', inRoot = false, inKeyframes = false, depth = 0;
  const space = [], color = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/@keyframes/.test(raw)) { inKeyframes = true; depth = 0; }
    if (inKeyframes) {
      depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
      if (depth <= 0 && /\}/.test(raw)) inKeyframes = false;
      continue;
    }
    const l = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    const m = l.match(/^\s*([.#a-zA-Z:[][^{}]*?)\s*\{/);
    if (m) { sel = m[1].trim(); inRoot = /^:root/.test(sel.split(',')[0].trim()); }
    if (inRoot) continue;
    if (/^\s*--/.test(l)) continue;            // 토큰 선언 줄 자체
    if (/^\.(fd-|form-doc)/.test(sel)) continue;
    if (/chat/.test(sel)) continue;
    const sp = l.match(/(?:^|[;{\s])(?:padding|margin|gap|row-gap|column-gap)(?:-top|-bottom|-left|-right|-block|-inline)?\s*:\s*([^;{}]+)/);
    if (sp) for (const v of sp[1].match(/-?\d+(?:\.\d+)?px/g) || []) space.push(`${i + 1}:${v}`);
    for (const c of (l.match(/#[0-9a-fA-F]{3,8}\b/g) || [])) {
      const lc = c.toLowerCase();
      if (['#fff', '#ffffff', '#000', '#000000'].includes(lc)) continue;   // 순백·순흑은 팔레트 문제가 아니다
      color.push(`${i + 1}:${lc}`);
    }
  }
  le('여백을 토큰(--sp-1~4) 대신 생 px 로 쓴 곳', space.length, CEILING.space,
    '새 여백은 --space-2/4/6/8/12/16/20/24/32/40 중에서 고르세요(세로 리듬은 --sp-1~4). 마지막 몇 줄: ' + space.slice(-4).join(' '));
  le('팔레트(:root) 밖에서 직접 쓴 유채색', color.length, CEILING.color,
    '새 색은 :root 에 토큰으로 먼저 넣고 var() 로 쓰세요. 마지막 몇 줄: ' + color.slice(-4).join(' '));
}

console.log('\n■ 없는 토큰에 폴백을 달지 않는다');
{
  /* 🔴 `var(--없는것, #색)` 은 조용히 **폴백 색이 그대로 화면에 뜬다.** 팔레트를 고쳐도
     안 따라오므로, 팔레트가 한 벌인 줄 알았는데 화면에는 다른 색이 있는 상태가 된다.
     실제로 `--chip-bg` 가 없어서 '자격 미확인' 배지가 팔레트에 없는 회색으로 떠 있었다. */
  const body = R('style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const declared = new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...body.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/g)].map((m) => m[1]));
  const ghost = [...used].filter((t) => !declared.has(t)).sort();
  le('선언된 적 없는 토큰에 단 폴백', ghost.length, CEILING.ghost,
    '이 토큰들이 :root 에 없습니다 → 폴백 색이 그대로 화면에 뜹니다: ' + ghost.join(' '));
}

/* ── ⑥ 한국어 줄바꿈과 글꼴 (2026-09-10 신설 · 2026-09-11 범위 축소) ──────────
   🔴 **2026-09-11 개발자 지시로 서체 교체와 글자 척도를 되돌렸다** —
      *"글자에서 한국어 줄바꿈 작업 빼고 모두 다시 되돌려."*
      그래서 여기서 재던 셋 중 **둘을 뺐다**: 폰트 스택 둘(SUIT/SUITE)의 존재 검사와,
      척도 단계가 최소 1.08배 벌어지는지 보던 검사. 지금 척도는 페이스리프트 이전 값이라
      13.5 → 14.5 가 1.074배다 — 그건 **개발자가 고른 상태**이지 결함이 아니다.
   ⚠️ 되살리지 말 것. 되살리면 상시 빨간불이 되고, 상시 빨간불인 관문은 새로 들어온
      위반을 가린다(2026-09-06 백로그 B-4 가 정확히 그 사고였다).

   여기서 지키는 셋 — 전부 실제로 겪은 것이다:
   ① **폰트 스택에서 Pretendard 를 빼지 않는다.** SUIT/SUITE 는 CDN 에서 오는데
      이 저장소 샌드박스는 그 주소를 확인할 수 없다(프록시가 막는다). 스택 마지막의
      Pretendard 가 **되돌아갈 자리**다 — 그것을 지우면 CDN 이 하루라도 흔들릴 때
      학생 화면의 글자가 통째로 시스템 폰트로 떨어지고, 아무도 모른다.
      🔴 실제로 2026-09-11 되돌리는 작업에서 index.html 의 Pretendard 링크를 SUIT/SUITE 와
         **함께 지웠다가** 이 검사가 그 자리에서 잡았다. 이 앱 글자의 유일한 출처다.
   ② **글자 크기 단계가 붙어 있지 않다.** 단계가 너무 붙으면 눈이 구분을 못 해
      화면 절반이 '그냥 작은 회색 글자' 한 덩어리로 읽힌다.
      🔴 문턱을 1.08 → **1.07** 로 낮췄다 (2026-09-11 개발자 지시 "글씨 크기도 줄여").
         페이스리프트가 키운 척도를 개발자가 예전 값으로 되돌리라고 했고, 그 척도의
         가장 좁은 단계가 13.5 → 14.5 (1.074배)다. 화면을 그대로 두고 관문만 남기면
         **통과할 수 없는 관문**이 되어 다음 사람이 관문 전체를 꺼 버린다.
         ⚠️ 관문을 무르게 한 것이 맞다. 다만 '단계가 역전되거나 같아지는 것'은 여전히
            여기서 막힌다 — 지키려던 최소선은 남아 있다.
   ③ **한국어 줄바꿈(`keep-all`)을 끄지 않는다.** 이게 없어서 온보딩 제목이
      '알려주세 / 요' 로 끊겨 마지막 줄에 '요' 한 글자만 남아 있었다(실측). */
console.log('\n■ 서체와 글자 척도 (2026-09-10)');
{
  /* 🔴 **주석을 걷어내고 본다.** 처음 짤 때 이 줄이 `R('style.css')` 였는데, 바로 위
     설명 주석에 `word-break: keep-all` 이라는 글자가 들어 있어서 **주석을 읽고 통과**시켰다
     (일부러 꺼 보는 red-green 확인에서 잡았다 — 안 했으면 아무것도 안 재는 검사가 됐다).
     같은 이유로 index.html 도 주석을 걷는다: 거기 붙인 설명에도 'Pretendard' 가 여러 번 나온다. */
  const css = stripComments(R('style.css'));
  const html = stripComments(R('index.html'));

  /* ① 되돌아갈 자리 — 스택 마지막의 Pretendard 와 index.html 의 링크 둘 다 본다 */
  const stackLines = [...css.matchAll(/--font-(?:text|display):\s*([^;]+);/g)].map((m) => m[1]);
  eq('폰트 스택이 둘 다 선언돼 있다', stackLines.length, 2);
  eq('두 스택 모두 Pretendard 를 담고 있다 (2026-09-11 되돌림 뒤 둘 다 Pretendard 한 벌이다)',
    stackLines.filter((v) => /Pretendard/.test(v)).length, 2);
  eq('index.html 이 Pretendard 를 계속 싣는다',
    /pretendard/i.test(html), true);

  /* ② 척도 — **값은 보지 않는다**(2026-09-11 되돌림). 단계가 있는지만 본다:
     단계를 지우면 그 크기를 쓰던 자리가 조용히 브라우저 기본값으로 떨어진다. */
  const scale = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'hero']
    .map((k) => {
      const m = css.match(new RegExp('--t-' + k.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + ':\\s*([\\d.]+)px'));
      return m ? parseFloat(m[1]) : null;
    });
  eq('글자 크기 아홉 단계가 모두 있다', scale.filter((v) => v !== null).length, 9);
  const tooClose = [];
  for (let i = 1; i < scale.length; i++) {
    const ratio = scale[i] / scale[i - 1];
    if (ratio < 1.07) tooClose.push(`${scale[i - 1]}px → ${scale[i]}px (${ratio.toFixed(3)}배)`);
  }
  eq('단계마다 최소 1.07배는 벌어진다 (붙어 있으면 눈이 구분 못 한다)', tooClose, []);

  /* ③ 한국어 줄바꿈 — 페이스리프트에서 **유일하게 남긴** 글자 작업이다 */
  eq('한국어 줄바꿈(keep-all)을 켜 둔다', /word-break:\s*keep-all/.test(css), true);
  eq('  긴 낱말이 화면 밖으로 나가지 않게 짝(overflow-wrap)도 함께 둔다',
    /overflow-wrap:\s*break-word/.test(css), true);
}

/* ── ⑦ 수집한 글의 HTML 기호가 화면에 글자로 새지 않는다 (2026-09-11) ─────────
   🔴 실시간 공고 39건 중 **9건**이 `&nbsp;` 를 글자 그대로 띄우고 있었다
      ('국가근로장학금 장학생 기본요건 ( 소득구간 &nbsp; 9 구간 이하'). 게시판 원문은 빈칸인데
      수집이 기호째 담아 와, `esc()` 가 `&` 를 한 번 더 감싸면서 영영 안 풀린 것이다.
   🔴 고치는 자리는 **`esc()` 앞**이다 — `unent()` 로 되돌린 뒤 `esc()` 로 다시 감싼다.
      순서를 뒤집으면 `&amp;nbsp;` 가 돼 화면에 그대로 남는다.
   ⚠️ 이 검사는 **주석을 걷고** 본다 — 안 걷으면 위 설명 주석의 글자를 읽고 통과한다
      (2026-09-10 서체 관문에서 실제로 그렇게 새는 것을 red-green 으로 잡았다). */
console.log('\n■ 수집한 글의 HTML 기호를 글자로 띄우지 않는다 (2026-09-11)');
{
  const app = stripComments(R('app.js'));
  eq('되돌리는 함수(unent)가 있다', /function unent\s*\(/.test(app), true);
  /* 수집 데이터에서 온 글(n.title · n.deadlineHint)을 unent 없이 esc 만 하는 곳 */
  const bare = [];
  app.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/esc\(\s*(n\.(?:title|deadlineHint))\s*\)/g)) bare.push(`${i + 1}:${m[1]}`);
  });
  eq('게시판에서 온 글은 전부 unent 를 거친다', bare, []);
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 되돌아간 곳이 있습니다` : '\n✓ 말투·토큰 관문 전부 통과');
process.exit(fail ? 1 : 0);
