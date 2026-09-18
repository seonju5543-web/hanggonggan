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

  /* 🔴 **면 위에 놓인 것에는 그림자를 다시 붙이지 않는다** (2026-09-12 · 노션 UI-9).
     개발자 지적: "그림자가 과해서 생성된 뒤 손보지 않은 인상을 준다." 걷어낸 넷을 여기서 지킨다.
     ⚠️ 브라우저 검사(verify-interactions)는 **프로필이 있는 화면만** 훑어서 온보딩의 둘
        (로고·기능 카드)을 못 본다 — 코드 리뷰가 그 구멍을 실증했다. 그래서 CSS 에서 본다. */
  const FLAT = [['.avatar', '홈·MY 프로필 원'], ['.hero-card', '홈 히어로 패널'],
    /* 2026-09-18 부터 온보딩 0단계는 정문 투어링 시작 화면이다 — 로고 타일·기능 카드는 없고,
       사진 위의 학교 이름표와 흰 버튼이 '면 위에 놓인 것'이다. */
    ['.start-school', '시작 화면 학교 이름표'], ['.onboard-step[data-step="0"] .btn-primary', '시작 화면 흰 버튼']];
  const withShadow = [];
  for (const [sel, name] of FLAT) {
    /* 그 선택자로 시작하는 블록 안에 box-shadow 가 있으면 잡는다(hover·active 는 다른 블록이다) */
    const re = new RegExp(`(^|\\n)${sel.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`, 'g');
    for (const m of R('style.css').matchAll(re)) if (/box-shadow:\s*[^;]*(--shadow|rgba|0 )/.test(m[0])) withShadow.push(name);
  }
  eq('면 위에 놓인 것(아바타·히어로·온보딩 로고와 카드)에 그림자가 없다', withShadow, []);
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
const CEILING = { space: 509, color: 75, ghost: 0 };   // 2026-09-18 시작 화면(UI-3): 옛 환영 화면 규칙을 걷어 516 → 509 · 76 → 75

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

  /* 🔴 **입력칸 글자는 16px 밑으로 내려가면 안 된다** (2026-09-17 신설).
     iOS 는 16px 미만인 칸을 누르면 화면을 통째로 확대하고, 학생이 손가락으로 다시 줄여야 한다.
     이 값은 척도가 아니라 **기능값**이라 위 '단계마다 1.07배' 검사에 안 걸린다 — 그래서
     따로 지킨다. 지키는 것이 없으면 다음 사람이 '조금 더 줄여 달라'는 말에 14.5px 로 내리고,
     그 화면은 아이폰에서만 확대되므로 **여기서는 아무도 못 본다**(안드로이드·데스크톱은 멀쩡).
     ⚠️ 값을 낮추라는 지시가 오면 이 줄이 아니라 **개발자에게** 그 대가를 먼저 말할 것. */
  const inputSize = css.match(/--t-input:\s*([\d.]+)px/);
  eq('입력칸 글자 크기(--t-input)가 선언되어 있다', !!inputSize, true);
  eq('입력칸 글자가 16px 이상이다 (iOS 자동 확대 바닥값)',
    inputSize ? parseFloat(inputSize[1]) >= 16 : false, true);

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

  /* 🔴 **칸 이름을 손으로 적는 목록은 썩는다** (2026-09-13에 실제로 썩은 것을 잡았다).
     위 검사는 `n.title`·`n.deadlineHint` 둘만 본다. 그래서 금액 근거 줄
     (`amountSpec.raw`·`exclusivity.raw`)이 `&middot;` 를 글자 그대로 띄우는 것을 못 잡았다.
     → 이제 **데이터에 실제로 나오는 기호를 앱이 전부 아는지** 센다. 칸 이름을 안 적으므로
        새 칸이 생겨도, 새 기호가 들어와도 그때 빨간불이 된다. */
  const ENT_LIST = (app.match(/const ENTITIES = \{(.*?)\};/) || [, ''])[1];
  const knownEnt = [...ENT_LIST.matchAll(/(?:'([^']+)'|([A-Za-z]+))\s*:/g)].map((m) => m[1] || m[2]);
  eq('앱이 아는 기호 목록을 읽어 냈다 (못 읽으면 아래가 헛돈다)', knownEnt.length > 0, true);
  /* 🔴 정규식에 목록이 한 벌 더 있으면 갈라진다 — ENTITIES 에 더해도 안 먹던 자리다 */
  eq('되돌리는 정규식을 그 목록에서 만든다 (두 벌로 두지 않는다)',
     /new RegExp\('&\(' \+ Object\.keys\(ENTITIES\)/.test(app), true);

  const seen = new Set();
  /* 🔴 **앱이 실제로 받아 가는 파일을 전부 본다** (2026-09-13 코드 리뷰).
     처음엔 뿌리의 json 셋만 훑었는데, 학교별로 나뉜 `data/notices/*.json` 도 앱이 받는다
     (loadNotices). 손으로 적은 목록은 새 파일이 생기면 그대로 썩는다 — 디렉터리를 읽는다. */
  const dataFiles = ['data/registered.json', 'data/notices.json', 'data/kosaf-open.json'];
  try {
    for (const n of fs.readdirSync(path.join(ROOT, 'data/notices')).filter((x) => x.endsWith('.json'))) {
      dataFiles.push('data/notices/' + n);
    }
  } catch { /* 그 폴더가 없는 판도 있다 */ }
  for (const f of dataFiles) {
    let raw = '';
    try { raw = R(f); } catch { continue; }   // 이 파일이 이미 쓰는 읽기 함수 (경로 규칙 한 벌)
    for (const m of raw.matchAll(/&(#?[a-zA-Z0-9]{2,8});/g)) seen.add(m[1]);
  }
  eq('데이터에 나오는 HTML 기호를 앱이 전부 안다',
     [...seen].filter((k) => !knownEnt.includes(k)), []);
}

/* ── ⑧ 관리자 화면도 같은 체계다 (2026-09-13 개발자 지시) ────────────────────
   *"디자인 측면에서도 앱1과 같은 체계를 맞춰줘"* 로 `_admin/admin.css` 를 앱1 토큰으로 옮겼다.
   🔴 **사본은 관문이 없으면 썩는다** — 이 저장소가 이미 겪었다(DESIGN.md 가 만들어진 3분 뒤
   서체 되돌림 커밋이 들어와 옛 값을 적은 채 남아 있었다). 그래서 두 가지를 센다:
     ① 관리자 CSS 가 토큰 밖의 생 값을 쓰지 않는가
     ② 관리자가 적어 둔 색·글자·모서리 값이 **style.css 의 실효값과 같은가**
   ⚠️ 앱1은 `:root` 를 여러 벌 겹쳐 쓴다 — **마지막에 이긴 값**이 실효값이다. */
console.log('\n■ 관리자 화면이 앱1과 같은 체계를 쓴다 (2026-09-13)');
{
  const admin = stripComments(R('_admin/admin.css'));

  /* ① 토큰 밖의 생 값 */
  const rawRadius = [], rawFont = [], rawSpace = [];
  admin.split('\n').forEach((l, i) => {
    if (/border-radius:\s*[0-9.]+px/.test(l)) rawRadius.push(`${i + 1}: ${l.trim().slice(0, 46)}`);
    if (/font-size:\s*[0-9.]+(px|rem)/.test(l)) rawFont.push(`${i + 1}: ${l.trim().slice(0, 46)}`);
    if (/\b(padding|margin|gap)[a-z-]*:\s*[^;{}]*[0-9]+px/.test(l)) rawSpace.push(`${i + 1}: ${l.trim().slice(0, 46)}`);
  });
  eq('모서리는 --radius-* 토큰만 쓴다', rawRadius, []);
  eq('글자 크기는 --t-* 토큰만 쓴다', rawFont, []);
  eq('여백은 --space-* 토큰만 쓴다', rawSpace, []);

  /* ② 어두운 화면이 되살아나지 않았는가 — 앱1은 밝은 한 벌뿐이다(style.css 의 지시) */
  eq('어두운 화면 정의가 없다 (앱1과 같은 밝은 한 벌)',
    /prefers-color-scheme|\[data-theme=/.test(admin), false);

  /* ③ 값이 앱1과 같은가 — 이름이 같은 토큰끼리 대조한다 */
  const effective = (css) => {
    const out = {};
    for (const m of stripComments(css).matchAll(/:root\s*\{([^{}]*)\}/g)) {
      for (const d of m[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
        out[d[1]] = d[2].trim().replace(/\s+/g, ' ');
      }
    }
    return out;
  };
  const app1 = effective(R('style.css'));
  const adm = effective(R('_admin/admin.css'));
  /* 관리자만 쓰는 것은 뺀다 — 경고 놋쇠(--warn*)와 자릿수 맞춤 글꼴(--mono) */
  const ADMIN_ONLY = new Set(['--warn', '--warn-weak', '--mono']);
  const drift = Object.keys(adm)
    .filter((k) => !ADMIN_ONLY.has(k) && app1[k] !== undefined && app1[k] !== adm[k])
    .map((k) => `${k}: 관리자 ${adm[k]} / 앱1 ${app1[k]}`);
  eq('색·글자·모서리 값이 앱1(style.css)과 같다', drift, []);
  const shared = Object.keys(adm).filter((k) => !ADMIN_ONLY.has(k) && app1[k] !== undefined).length;
  console.log(`      대조한 토큰 ${shared}개 (관리자 전용 ${ADMIN_ONLY.size}개는 뺐다)`);
  /* 🔴 대조할 것이 거의 없으면 이 검사는 헛돈다 — 실제로 겹치는지 하한을 둔다 */
  eq('대조할 토큰이 충분하다 (헛도는 검사가 아니다)', shared >= 15, true);

  /* ④ **서체는 이름이 아니라 실제로 실려야 같다** (2026-09-14 개발자 지시 "서체만 앱1에 맞추고")
     🔴 `admin.css` 는 처음부터 `--font-text: 'Pretendard Variable', …` 이라 적고 있었고
        위 ③ 토큰 대조도 초록불이었다. 그런데 관리자 `index.html` 에는 그 글꼴을 **내려받는
        줄이 없었고** CSP 도 막고 있어, 브라우저는 이름을 건너뛰고 다음 대체 글꼴로 그렸다.
        값이 같아도 **글자 모양이 달랐다** — 두 화면을 나란히 놓았을 때 마지막으로 남은 차이다.
     ⚠️ 이 샌드박스는 cdn.jsdelivr.net 이 막혀 있어 **그려 놓고는 못 잰다**(둘 다 대체
        글꼴로 뜬다). 그래서 '같은 주소를 싣는가'와 'CSP 가 그것을 허용하는가'를 센다. */
  /* 🔴 **주석을 걷고 읽는다** — 이 파일 ① 이 이미 같은 함정을 적어 뒀는데(설명에도 'Pretendard'
     가 여러 번 나온다) ④ 가 그것을 되풀이했다. 실측: 링크를 주석 안에만 남겨도 다섯 항목이
     전부 통과했다(2026-09-14 코드 리뷰). CSP 는 주석 안에 있을 리 없지만 같은 사본을 쓴다. */
  const app1Html = stripComments(R('index.html'));
  const admHtml = stripComments(R('_admin/index.html'));
  /* 🔴 **'주소가 적혀 있다'와 '그 서체가 적용된다'는 다르다** — `rel="preload"` 는 받아만 두고
     적용하지 않고, `media="print"` 는 화면에서 빠진다. 실측으로 둘 다 통과했다. 그래서
     **`rel="stylesheet"` 이고 화면에 적용되는 링크**만 센다. */
  const fontLink = (h) => {
    for (const m of h.matchAll(/<link\b[^>]*>/gi)) {
      const tag = m[0];
      const href = (tag.match(/href="([^"]+)"/i) || [])[1] || '';
      if (!/cdn\.jsdelivr\.net\/.*pretendard/i.test(href)) continue;
      if (!/rel="stylesheet"/i.test(tag)) continue;
      const media = (tag.match(/media="([^"]+)"/i) || [])[1];
      if (media && !/^(all|screen)$/i.test(media.trim())) continue;
      return href;
    }
    return null;
  };
  eq('앱1이 싣는 서체 주소를 읽었다 (못 읽으면 아래가 헛돈다)', typeof fontLink(app1Html), 'string');
  eq('관리자도 **같은 주소**로 같은 서체를 싣는다', fontLink(admHtml), fontLink(app1Html));
  /* 🔴 링크와 CSP 는 **한 세트**다 — 하나만 하면 조용히 막힌다(CSP 는 화면에 오류를 안 띄운다).
     🔴 **두 화면 다 본다** — 관리자만 보면, 앱1 쪽이 닫히는 날 두 화면이 반대 방향으로
     갈라지는데도 초록불이 난다(2026-09-14 코드 리뷰). */
  const cspOf = (h) => (h.match(/Content-Security-Policy"\s+content="([^"]+)"/) || [])[1] || '';
  const dirOf = (csp, name) => (csp.match(new RegExp(`${name}\\s+([^;]*)`)) || [])[1] || '';
  for (const [who, html] of [['관리자', admHtml], ['앱1', app1Html]]) {
    const csp = cspOf(html);
    eq(`  ${who} CSP 의 style-src 가 그 서체를 허용한다`, /cdn\.jsdelivr\.net/.test(dirOf(csp, 'style-src')), true);
    eq(`  ${who} CSP 의 font-src 가 그 서체를 허용한다`, /cdn\.jsdelivr\.net/.test(dirOf(csp, 'font-src')), true);
  }
  /* 🔴 열어 준 것은 **모양뿐**이다 — 실행 코드는 그대로 self 여야 한다(관리자 화면엔 열쇠가 있다) */
  eq('  그래도 script-src 는 self 뿐이다 (서체 때문에 코드까지 열지 않았다)',
    dirOf(cspOf(admHtml), 'script-src').trim(), "'self'");
}

console.log(fail ? `\n✕ 실패 ${fail}건 — 되돌아간 곳이 있습니다` : '\n✓ 말투·토큰 관문 전부 통과');
process.exit(fail ? 1 : 0);
