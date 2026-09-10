/**
 * 인스타 카드뉴스 렌더러 — 4:5 (1080×1350) · 5장 캐러셀 · 템플릿 3벌
 * 스크립트 규격 `insta/SCRIPT.md` · 설계 `docs/designs/instagram-pipeline.md`
 *
 * 🔴 **템플릿이 돌아가는 축이고 색(skin)은 아니다.** 씨앗으로 photo/chat/note 중 하나를
 *    고른다 — 같은 공고는 늘 같은 얼굴, 공고가 바뀌면 얼굴도 바뀐다.
 * 🔴 `--skin` 은 **photo 판형에만** 걸린다. chat 은 카카오톡, note 는 종이라
 *    색을 바꾸면 베낀 레퍼런스가 무너진다 — 그래서 그 둘은 `k` 를 안 받는다.
 *    다른 템플릿에 `--skin` 을 주면 조용히 무시하지 않고 경고한다.
 * 🔴 그릇(흰 카드 프레임)은 걷어냈다 — 개발자가 반려했다("저 네모박스 좀 빼고").
 *    배경 위에 글자만 얹으므로 글자가 커야 화면이 안 빈다.
 * 🔴 사실 문장은 전부 kosaf-open.json 원문. 요약·의역·추정 금지(원칙 8-1).
 * 🔴 개별 학생 판정('당신은 받을 수 있어요')은 안 쓴다 — 앱 몫이다(자기잠식 선).
 *
 * 실행: node insta/render.mjs [공고이름일부] [--tpl=photo|chat|note|all] [--skin=…] [--seed=N] [--school=…]
 */
import { shrinkToFit, overflowing } from './fit.mjs';
import { caption, LIMIT } from './caption.mjs';
import { readFileSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'insta', 'out');
const W = 1080, H = 1350;

// ── 원문 다루기 ─────────────────────────────────────────────
const tidy = (s) => String(s || '').replace(/:{2,}/g, ':').replace(/\s{2,}/g, ' ').trim();
/** '※ 자세한 사항은 …' 은 줄 **끝에 꼬리로** 붙으므로 앞만 보면 못 거른다(실측).
 *  🔴 **괄호 안의 `○` 에서 자르면 안 된다** — 원문에 `…재학중인 자 (○ 사이버대 제외)` 가
 *     있어서 `자 (` 와 `사이버대 제외)` 두 줄로 부서졌다(여는 괄호로 끝나고 닫는 괄호로
 *     시작하는 줄). 괄호 안에서는 글머리가 아니라 그냥 글자다. */
//    ⚠️ 다른 글자로 바꿔 두면 안 된다 — 그것도 원문을 고치는 것이다(원칙 8-1).
//       자르는 동안만 표식으로 숨겼다가 **그대로 되돌린다.**
const HIDE = '\u0000';
const unbulletInParens = (s) => {
  let d = 0, out = '';
  for (const ch of String(s || '')) {
    if (ch === '(' || ch === '（') d++;
    else if (ch === ')' || ch === '）') d = Math.max(0, d - 1);
    out += (ch === '○' && d > 0) ? HIDE : ch;
  }
  return out;
};
const bullets = (s) =>
  unbulletInParens(s).split(/\s*○\s*/)
    .map((t) => t.split(HIDE).join('○'))
    .map((t) => tidy(t.replace(/\s*※\s*자세한 사항은[^○]*$/, '')))
    .filter(Boolean).filter((t) => !/기관확인필요/.test(t));
/** 🔴 손으로 그린 표시들 — 선이 전부 반듯하면 사람이 안 만든 티가 난다.
 *  일부러 곡선을 어긋나게 그려 붓으로 친 느낌을 낸다. */
const scribble = (w, c) => `<svg class="sc" width="${w}" height="26" viewBox="0 0 ${w} 26">`
  + `<path d="M5,17 C${Math.round(w * 0.3)},7 ${Math.round(w * 0.6)},23 ${w - 7},12"`
  + ` stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".92"/></svg>`;
const handCheck = (c) => `<svg width="62" height="62" viewBox="0 0 46 46" style="flex:0 0 62px;margin-top:-6px"><path d="M9,24 C14,27 16,30 19,34 C25,23 31,15 38,9"`
  + ` stroke="${c}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const handX = (c) => `<svg width="60" height="60" viewBox="0 0 46 46" style="flex:0 0 60px;margin-top:-4px">`
  + `<path d="M11,10 C18,18 26,27 34,36 M35,11 C27,19 19,28 12,36" stroke="${c}" stroke-width="7"`
  + ` fill="none" stroke-linecap="round"/></svg>`;
/** 손으로 그린 네모 체크칸 — 🔴 색 원 안에 숫자·이모지를 넣는 것은 AI 슬롭의 대표 항목이고,
 *  한 판형 안에서 은유가 세 번 바뀌었다(순번/부정/이모지). 노트에서 실제로 하는 표시로 바꾼다. */
const handBox = (c, checked) => `<svg width="56" height="56" viewBox="0 0 48 48" style="flex:0 0 56px;margin-top:2px;overflow:visible">
  <path d="M6,7 L41,5 L43,41 L5,43 Z" fill="none" stroke="${c}" stroke-width="3.4"
    stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>
  ${checked ? `<path d="M11,25 C16,29 18,32 21,36 C27,25 33,16 40,9" fill="none" stroke="${c}"
    stroke-width="5" stroke-linecap="round"/>` : ''}</svg>`;

const handOval = (c) => `<svg class="ov" viewBox="0 0 300 120" preserveAspectRatio="none">`
  + `<path d="M150,8 C60,8 12,34 12,60 C12,88 66,112 152,112 C240,112 290,86 288,58 C286,30 232,7 140,10"`
  + ` stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`;

/** 형광펜 — 🔴 글자를 바꾸지 않고 감싸기만 한다. 숫자·단위와 판정에 걸리는 낱말만.
 *  강조가 하나도 없으면 균일한 회색 덩어리가 되고, 그게 사람이 안 만든 티다. */
const KEY = /(\d[\d,]*\s*(?:만원|원|명|학점|점|개월|년|%|가지|회))|(신입생 포함|제한 ?없음|중복지원 불가|재학 중|불가|제외|이상|필수)/g;
const hi = (t) => esc(t).replace(KEY, (x) => `<mark>${x}</mark>`);

/** 사실 줄 자르기. 🔴 그냥 자르면 **부정어가 떨어져 뜻이 뒤집힌다** —
 *  '중복 수혜 가능하나 … 선발 제외' 가 '중복 수혜 가능' 으로 남았다(실측 8건).
 *  잘릴 자리 뒤에 부정어가 있으면 앞머리와 **꼬리를 같이** 남긴다. */
const NEG = /제외|불가|아닌|아님|없는|없음|않는|않음|초과할 수 없|해당하지|미만|미소지|철회|중단/;
/** 곁가지 괄호를 걷어낸다 — 잘려서 `…(부모 직장에서의 지원…` 처럼 끊기던 것 때문(개발자 지시).
 *  🔴 **부정어나 숫자가 든 괄호는 남긴다.** `(…은 제외)` 를 지우면 자격이 뒤집히고,
 *     `(4.5 기준)` 을 지우면 앞의 `2.5 이상` 이 뜻을 잃는다. 걷어내는 것은
 *     `(보호자)` `(부 또는 모/후견인)` `(4년제 및 전문대학교)` 같은 곁가지뿐이다.
 *  실측: 잘리는 줄 201 → 187, 남은 것도 문장이 안 끊긴다. */
const dropParen = (t) => t
  .replace(/\s*[(（][^()（）]{1,40}[)）]/g, (m) => (NEG.test(m) || /[0-9]/.test(m) ? m : ''))
  .replace(/\s{2,}/g, ' ').trim();




const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function money(raw) {
  const m = String(raw || '').match(/([0-9][0-9,]*)\s*(만원|원)/);
  // 🔴 '분할' 은 매달이 아니다. '연 2회 분할' 을 '매달' 이라 부르면 금액을 지어내는 것이다(실측 2건).
  const monthly = /매월|매달|월 ?[0-9][0-9,]*\s*만?원/.test(raw);
  // 🔴 금액이 여러 개거나 '전액' 이 섞이면 첫 숫자를 대표로 내세우지 않는다(실측: 90만원이 등록금 전액을 가림).
  const many = (String(raw).match(/[0-9][0-9,]*\s*(?:만원|원)/g) || []).length > 1 || /전액/.test(raw);
  return m ? { n: m[1], unit: m[2], monthly, many } : null;
}
/** 마감까지 남은 날. 🔴 세 상태를 뭉뚱그리지 않는다 —
 *  칸이 비었거나(unknown) 날짜를 못 읽었거나(unknown) 지났거나(past)는 서로 다른 말이다.
 *  예전엔 셋 다 null 이라 **마감 지난 공고가 '모집 중' 으로 나갔다**(145건 중 21건). */
const dday = (due, today) => {
  if (!due) return { state: 'unknown' };
  const t = new Date(due + 'T23:59:59+09:00').getTime();
  if (Number.isNaN(t)) return { state: 'unknown' };
  const d = Math.round((t - today) / 864e5);
  return d < 0 ? { state: 'past' } : { state: 'open', d };
};
const ddayText = (x) => x.state === 'unknown' ? '기간 앱에서 확인'
  : x.state === 'past' ? '마감 지남' : x.d === 0 ? '오늘 마감' : `마감 D-${x.d}`;

/** 배경 사진 — `insta/photos.json` (교내는 위키미디어, 교외는 Openverse).
 *  🔴 교내 공고는 그 학교 사진, 교외는 학교가 안 드러나는 사진을 쓴다.
 *     교외에 특정 학교 건물을 깔면 그 학교 장학금으로 읽힌다.
 *  🔴 저작자·라이선스는 캡션에 적어야 한다 — photos.json 에 같이 들고 다닌다. */
const POOL = JSON.parse(readFileSync(join(ROOT, 'insta/photos.json'), 'utf8'));
const photoFor = (school, seed) => {
  const bank = (school && POOL[school]?.length) ? POOL[school]
    : Object.entries(POOL).filter(([k]) => k.startsWith('교외')).flatMap(([, v]) => v);
  return bank.length ? bank[Math.abs(seed) % bank.length] : null;
};

/** 🔴 **사실 줄은 자르지 않는다**(2026-09-09 개발자 지시 — "말 끊기지 말라했지").
 *  버리는 것은 지어내는 것과 같은 거짓이라(원칙 8-1), 대신 **글자를 줄여 전부 담는다.**
 *  🔴 크기를 여기서 계산하지 않는다 — 글자 폭을 손으로 어림하면 늘 빗나가서
 *     짧은 카드는 여백이 남고 긴 카드는 넘쳤다. **넉넉한 크기로 그려 두고
 *     브라우저가 실제로 재서 줄인다**(아래 `shrinkToFit`). 어림값이 없으니 상수 조율도 없다.
 *  `data-fit` 이 붙은 요소만 줄어든다. */

/** 2장 '누가 받나요' 세 줄.
 *  🔴 그냥 이어 붙이고 자르면 특정자격이 자리를 다 먹어 **지역·소득 조건이 사라진다**
 *     (실측 145건 중 54건). 칸마다 한 줄씩 먼저 담고, 남는 자리만 더 채운다.
 *  🔴 이름을 붙여 밖으로 뺀 이유는 **관문이 이걸 떼어다 돌리기 위해서**다 —
 *     검사가 규칙을 베끼면 코드를 되돌려도 초록불로 남는다(실제로 그랬다). */
const whoLines = (f) => {
  const cols = [bullets(f['특정자격']), bullets(f['지역거주구분']),
    bullets(f['소득기준']), bullets(f['성적기준'])].filter((a) => a.length);
  const out = cols.map((a) => a[0]);              // 칸마다 대표 한 줄
  for (const a of cols) for (const t of a.slice(1)) if (out.length < 3) out.push(t);
  return out.slice(0, 3);
};

/** 표지 제목 — 개발자가 정한 어그로 형식. 🔴 원문이 받쳐 줄 때만 쓴다. */
function bigTitle(s0, m, seed, d, school) {
  const f = s0.fields || {}, specs = bullets(f['특정자격']);
  const VAGUE = /의지|성실|품행|열정|인재상|공감/;
  // 🔴 기관명을 줄이면 남의 공고가 된다(축약 금지). 실측 최장 20자라 20이면 전부 담긴다 —
  //    12자였을 때 `재단법인 대구광역시서구인재육성재단` 같은 이름 12건이 잘리고 있었다.
  const org = esc(s0.org.replace(/^\(재\)|^재단법인 /, '').trim());
  const opts = [];
  // 🔴 '…이면 신청 가능' 은 개별 학생 판정이다(자기잠식 선). 공고가 그렇게 적었다고만 말한다.
  //    실측: 재학 조항이 있는 58건 중 다수가 지역·소득·성적 조건을 함께 달고 있었다.
  if (specs.some((t) => /재학 ?중인 자|재학생|대학교에 재학/.test(t)))
    opts.push(['공고에 이렇게 적혀 있어요', '<em>“대학 재학 중인 자”</em>']);
  const c = specs.find((t) => !VAGUE.test(t) && t.length <= 14);
  // 🔴 윗줄이 같으면 갈래가 늘어도 화면에서는 한 문장이다 — 실측 5갈래가 3문장으로 접혔다.
  //    갈래마다 **다른 윗줄**을 준다.
  if (c) opts.push(['자격에 딱 한 줄', `<em>“${esc(c)}”</em>`]);
  if (m) opts.push(['이거 신청하면', `<em>${m.monthly ? '매달 ' : ''}${m.n}${m.unit}</em>`, 'amount']);
  if (!/^한국|정부|교육부|보훈/.test(s0.org)) opts.push(['아무도 안 알려주는', `<em>${org} 장학금</em>`]);
  // 🔴 개발자가 지정한 학교 갈래. 교내 공고에서만 쓴다 — 교외에 쓰면 거짓말이 된다.
  if (school) opts.push([`${esc(school)} 학생이면`, '<em>이건 챙기세요</em>', 'school']);
  // 마감이 코앞인 것은 그 자체가 후킹이다. 🔴 **상대 날짜를 쓰지 말 것** —
  //    게시물은 피드에 남는데 `1일 뒤 마감` 은 내일이면 거짓말이 된다(사진은 굳는다).
  //    절대 날짜는 안 늙는다.
  if (d && d.state === 'open' && d.d <= 7) {
    const [, mm, dd] = s0.due.split('-');
    opts.push([`${Number(mm)}월 ${Number(dd)}일 마감`, `<em>${org} 장학금</em>`, 'dday']);
  }
  // 선발 인원은 원문 숫자다(실측 94건). '몇 명 뽑나' 는 학생이 실제로 궁금해하는 값.
  const pk0 = bullets(f['선발인원'])[0] || '';
  const pkN = pk0.match(/^([0-9]+) *명/);
  if (pkN && Number(pkN[1]) > 0) opts.push(['이번에', `<em>${pkN[1]}명 뽑아요</em>`, 'pick']);
  // 🔴 폴백이 '모집 중' 이면 마감 지난 공고도 열려 있다고 말하게 된다. 중립 문구를 쓴다.
  if (!opts.length) opts.push([esc(s0.name), '<em>앱에서 확인</em>']);
  return opts[Math.abs(seed) % opts.length];
}

// ── 판형 4벌 — 전부 미리캔버스 템플릿을 베낀 것 ──────────────
/** photo 판형의 색 한 벌. 🔴 여기 있는 칸은 **CSS 가 실제로 읽는 다섯**뿐이다 —
 *  안 읽는 칸을 남겨 두면 다음 세션이 '판형이 네 가지 모양' 이라고 잘못 읽는다(실제로 그랬다). */
const SKINS = {
  blue:    { bg: 'linear-gradient(170deg,#2f6be0,#1c47b8)', card: '#fff', ink: '#12225c', accent: '#2f6be0', warn: '#d13b3b' },
  marker:  { bg: '#c6c6c6', card: '#fff', ink: '#1d1d1d', accent: '#e0453c', warn: '#e0453c' },
  folder:  { bg: 'linear-gradient(165deg,#bdece2,#8fd8c8)', card: '#fff', ink: '#14524a', accent: '#12897a', warn: '#c4553c' },
  minimal: { bg: '#eef1f6', card: '#fff', ink: '#1b2440', accent: '#3a4ee0', warn: '#d3403f' },
};


const CSS_photo = (k) => `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#333;font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;font-weight:500}
.card{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:${k.bg};
  padding:76px 66px 100px;display:flex;flex-direction:column}



/* 형광펜 */
mark{background:linear-gradient(transparent 56%, #ffe66b 56%);color:inherit;padding:0 2px}


/* 손으로 그린 표시 */
.sc{display:block;margin:-4px 0 0 -4px}
.ov{position:absolute;left:-22px;right:-22px;top:-10px;bottom:-10px;pointer-events:none}

/* 🔴 네모 박스·트레이·칸을 전부 걷어냈다. 구분은 얇은 선과 여백만.
   그릇이 없으니 글자가 커야 화면이 안 빈다. */
/* 🔴 바닥글을 없앴으니 아래 여백도 같이 줄인다 — 안 그러면 빈자리가 남는다. */
.plain{padding:82px 68px 76px;display:flex;flex-direction:column;position:relative}
.plain .lab{font-size:32px;opacity:.62;margin-bottom:12px}
.plain h2{font-weight:900;font-size:104px;line-height:1.06;letter-spacing:-.05em}
.plain h2 em{font-style:normal}
/* 🔴 가운데 정렬이 아니라 **남은 자리를 채운다** — 항목이 둘뿐일 때 아래가 통째로 비었다. */
.plain .items{flex:1;display:flex;flex-direction:column;justify-content:space-evenly}
.plain .it{display:flex;gap:22px;align-items:flex-start;padding:34px 0;
  border-top:2px solid currentColor}
.plain .it:first-child{border-top:0}
.plain .it p{font-weight:500;line-height:1.44;flex:1}

/* 값 — 칸 없이 라벨 위, 값 아래 */
/* 🔴 가운데 정렬이면 아래가 통째로 빈다 — 실측 3장 아래 371px(카드의 27%).
   .items 와 같은 규칙으로 남은 자리를 채운다. ⚠️ 이 주석에 백틱을 쓰면
   CSS 템플릿 문자열이 거기서 끊긴다(실제로 그랬다). */
.kv2{flex:1;display:flex;flex-direction:column;justify-content:space-evenly}
.kv2 div b{display:block;font-size:29px;opacity:.6;font-weight:500;margin-bottom:6px}
.kv2 div span{font-weight:900;font-size:60px;letter-spacing:-.03em;line-height:1.16;display:block}

/* 🔴 4장은 **색을 뒤집는다** — 2장과 4장이 라벨·아이콘만 다른 같은 뼈대였다.
   흰·흰·흰·빨강·흰이면 넘길 때 박자가 생기고, 조항 장이 실제로 사람을 멈춰 세운다.
   (이 계정의 정체성이 4장이라 여기만 다르게 생겨야 한다.) */
.onWarn{color:#fff;background:${k.warn}}
.onWarn .lab{opacity:.8}
.onWarn .it{border-top-color:rgba(255,255,255,.34)}
.onWarn mark{background:none;color:#ffe04d;padding:0}
.onWarn .no{flex:0 0 54px;font-weight:900;font-size:46px;line-height:1.1;opacity:.55}

/* 밝은 바탕 — 나머지는 흰 바탕이다 */
.onLight{color:${k.ink};background:${k.card}} .onLight .it{border-color:rgba(0,0,0,.13)}

/* ── 표지(사진): 배경 사진 위에 글자만. 박스·그릇 없음 ── */
.photo{padding:0;display:block;background:#111}
.photo .bg{position:absolute;inset:0;background-size:cover;background-position:center;
  filter:saturate(.85) contrast(1.05)}
/* 글자가 읽히도록 아래를 어둡게 — 장식이 아니라 가독성 장치다 */
.photo .veil{position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(10,14,26,.52) 0%,rgba(10,14,26,.18) 26%,rgba(10,14,26,.72) 58%,rgba(10,14,26,.97) 88%,rgba(10,14,26,1) 100%)}
.photo .meta{position:absolute;left:70px;top:92px;right:70px;
  color:rgba(255,255,255,.82);font-size:33px;font-weight:500;letter-spacing:-.01em}
/* 🔴 날짜·금액 줄을 걷어낸 만큼 제목이 커진다. 아래에서 위로 쌓아 바닥선을 맞춘다. */
.photo .head{position:absolute;left:64px;right:60px;bottom:196px;
  font-weight:900;font-size:152px;line-height:1.12;letter-spacing:-.05em;color:#fff;
  word-break:keep-all;text-shadow:0 8px 34px rgba(0,0,0,.46)}
.photo .head em{font-style:normal;color:#ffe04d}
/* 🔴 조건 칩 — 금액·제목만 크게 걸고 조건을 숨기면 미끼가 된다. 칸이 있다는 것만 말한다. */
/* 🔴 CC BY·BY-SA 는 저작자 표시가 조건이다 — 캡션은 잘려 접히니 사진 위에 박는다. */
.photo .cred{position:absolute;right:70px;bottom:40px;max-width:470px;font-size:19px;
  font-weight:400;line-height:1.35;color:rgba(255,255,255,.5);letter-spacing:-.01em;text-align:right}










`;

// ── 카드 5장 ────────────────────────────────────────────────
/** 공고 하나에서 카드가 쓰는 값을 한 번에 뽑는다. 템플릿 셋이 같은 것을 나눠 쓴다. */
function context(s0, today, k, seed, school) {
  const f = s0.fields || {};
  const m = money(f['지원금액']);
  const d = dday(s0.due, today);
  const [t1, t2, tKind] = bigTitle(s0, m, seed, d, school);
  const pk = bullets(f['선발인원'])[0];
  return { s0, f, k, seed, school, m, d, t1, t2, tKind,
    photo: photoFor(school, seed),
    ddText: ddayText(d),
    moneyLine: tidy(bullets(f['지원금액'])[0] || ''),
    // 🔴 괄호를 지우면 원문이 상한다 — `연 150만원 이내(생활장학금)` 가
    //    `연 150만원 이내생활장학금` 이 됐다(실측 24건). 앞머리 금액만 뗀다.
    // 🔴 원문 줄이 그 자체로 '확인하세요' 면 두 번 말하는 것이다 — 교내 공고가 그렇다.
    amtSub: (bullets(f['지원금액'])[0] || '').replace(/^[0-9,]+\s*만?원\s*/, '')
      .replace(/^.*(원문 확인|앱에서 확인|기관확인).*$/, '').trim(),
    // 🔴 그냥 이어 붙이고 자르면 특정자격이 자리를 다 먹어 **지역·소득 조건이 사라진다**
    //    (실측 145건 중 54건). 칸마다 한 줄씩 먼저 담고, 남는 자리만 더 채운다.
    // 🔴 곁가지 괄호는 **여기서 한 번만** 걷는다. 쓰는 쪽마다 부르면 한 판형만 빠뜨려도
    //    카드와 캡션이 다른 글을 보여 준다(실제로 카톡만 빠뜨린 적이 있다).
    who: whoLines(f).map(dropParen),
    // 🔴 3줄만 싣고 '외 N건' 을 회색으로 달던 것을 없앴다(개발자 지시 — 회색 글씨 금지).
    //    셋으로 자르고 나머지를 흐린 글씨로 미루면, 걸리는 조항이 거기 있어도 안 읽힌다.
    //    실측 최다 6줄·전부 담아도 167자라 **다 싣는다** — 글자 크기는 브라우저가 맞춘다.
    traps: bullets(f['자격제한']).map(dropParen),
    // 🔴 이 칸에는 서류가 아닌 줄이 섞인다 — `※ … 온라인 접수` 같은 제출 방법(실측 1건).
    //    그리고 `(선택)` 서류를 '내야 할 서류' 로 세면 부풀린 숫자가 된다(한진해운은 11 중 3).
    docs: bullets(f['제출처 및 제출서류'])
      .filter((t) => !/접수$|접수를 통한|온라인 접수/.test(t) && !/\(선택\)/.test(t)),
    // 🔴 마감·기간을 자르면 날짜가 통째로 사라진다(실측 59건 잘림, 4건은 날짜 손실).
    //    기간은 자르지 않는다 — 길면 화면에서 글자를 줄인다.
    period: tidy(bullets(f['신청기간'])[0] || '앱에서 확인'),
    pkText: pk && !/^0+명/.test(pk) ? pk : '앱에서 확인',
    // 🔴 흰 영역이 비는 이유는 항목이 2~3개뿐인데 글자가 작아서다.
    //    지어내 채울 수 없으니(원칙 8-1) 크기로 채운다.
    fit: (n) => (n <= 2 ? { f: 56, p: 46 } : n === 3 ? { f: 47, p: 36 } : { f: 40, p: 28 }),
    pick: (n, arr) => arr[Math.abs(seed + n * 7919) % arr.length],
  };
}

/** 표지 제목 크기 — 🔴 고정 크기로 두면 긴 재단명이 카드 밖으로 나간다
 *  (`천안사랑장학재단` 의 `단` 이 오른쪽 테두리를 넘었다). 가장 긴 줄로 정한다.
 *  글상자 폭 956px ÷ 글자당 0.95배 = 한 줄에 담기는 글자 수. */
const headSize = (t1, t2) => {
  const longest = Math.max(...[t1, String(t2).replace(/<[^>]+>/g, '')]
    .flatMap((x) => x.split(/\s+/).concat(x))
    .map((x) => x.length));
  return Math.max(88, Math.min(152, Math.floor(956 / (longest * 0.95))));
};

function cards_photo(c) {
  const { s0, k, m, f, t1, t2, photo, amtSub, who, traps, docs, period, pkText, fit, ddText } = c;
  // ── 1장 표지: 사진 배경 + 글자만. 🔴 박스·그릇 안 쓴다 ─────────
  const c1 = `<div class="card photo">
    ${photo ? `<div class="bg" style="background-image:url(&quot;${esc(photo.url)}&quot;)"></div>` : ''}
    <div class="veil"></div>
    ${/* 🔴 후킹이 재단명 갈래면 왼쪽 위 재단명과 가운데 큰 글씨가 같은 말이다(실측 40%).
          겹칠 때는 위를 공고명으로 바꾼다 — 버리지 않고 다른 사실을 준다. */
      `<div class="meta">${esc(t2.includes(esc(s0.org.replace(/^\(재\)|^재단법인 /, '').trim())) ? s0.name : s0.org)}</div>`}
    <div class="head" style="font-size:${headSize(t1, t2)}px">${esc(t1)}<br>${t2}</div>
    ${photo ? `<div class="cred">사진 ${esc(photo.by)} · ${esc(photo.lic)}</div>` : ''}
  </div>`;

  // ── 2장 자격 — 박스 없음. 손 체크 + 얇은 선 ──────────────
  const c2 = `<div class="card plain onLight">
    <div><div class="lab">지원 자격</div>
      <h2>나도<br><em style="color:${k.accent}">받을 수 있나?</em></h2>
      ${scribble(430, k.accent)}</div>
    <div class="items">${who.map((t) =>
      `<div class="it">${handCheck(k.accent)}<p data-fit style="font-size:58px">${hi(t)}</p></div>`).join('')}</div>
  </div>`;

  // ── 3장 얼마·언제 — 금액이 주인공, 칸 없음 ────────────────
  const c3 = `<div class="card plain onLight">
    <div><div class="lab">얼마 받고 언제까지?</div>
      ${m && !m.many ? `<h2 style="font-size:176px;line-height:1;color:${k.accent}">
        <span style="position:relative;display:inline-block">${esc(m.n)}${handOval(k.accent)}</span><em style="font-size:80px">${esc(m.unit)}</em></h2>
      <div class="lab" style="margin-top:20px">${esc(amtSub || '')}</div>`
      : `<h2 style="font-size:96px;color:${k.accent}">금액은<br>앱에서 확인</h2>
      <div class="lab" style="margin-top:20px">${esc(bullets(f['지원금액'])[0] || '')}</div>`}</div>
    <div class="kv2">
      <div><b>신청 기간</b><span>${esc(period)}</span></div>
      <div><b>선발 인원${docs.length ? ' · 낼 서류' : ''}</b><span>${esc(pkText)}${docs.length ? ` · 서류 ${docs.length}가지` : ''}</span></div>
    </div>
  </div>`;

  // ── 4장 조항 — 색을 뒤집고 손 엑스 ────────────────────────
  const c4 = `<div class="card plain onWarn">
    <div><div class="lab">자격 제한</div>
      <h2>이러면<br><em style="color:#ffe04d">못 받아요</em></h2>
      ${scribble(430, '#ffe04d')}</div>
    <div class="items">${traps.map((t, i) =>
      `<div class="it"><span class="no">${i + 1}</span><p data-fit style="font-size:58px">${hi(t)}</p></div>`).join('')}</div>
  </div>`;

  // ── 5장 한대장 — 공감 한 방. 알약 버튼도 뺐다 ──────────────
  const c5 = `<div class="card plain onLight">
    <div><h2>장학금 찾다가<br><em style="color:${k.accent}">시간 다 갔죠?</em></h2>
      ${scribble(470, k.accent)}</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">
      <p style="font-size:46px;line-height:1.5;opacity:.8">학과 · 학년 · 소득만 넣으면<br>
        <b style="font-weight:900;opacity:1">나한테 되는 것만 남아요.</b></p>
      <p style="font-weight:900;font-size:132px;letter-spacing:-.05em;
        line-height:1;color:${k.accent}">한대장</p>
      ${scribble(340, k.accent)}
      <p style="font-size:38px;opacity:.7;margin-top:6px">대학생 장학금 · 교내 + 교외 다 모아봤어요</p>
      <p style="font-weight:900;font-size:58px;letter-spacing:-.03em">
        프로필 링크 →</p>
    </div>
  </div>`;

  // 🔴 자격제한 칸이 없는 공고(실측 21건)에 빈 '못 받아요' 카드를 그리지 않는다.
  return traps.length ? [c1, c2, c3, c4, c5] : [c1, c2, c3, c5];
}


// ════════ T2 · 카카오톡 대화 ════════════════════════════════
// 🔴 대화로 만들되 **사실은 지어내지 않는다**: 묻는 말은 우리가 쓰고,
//    답하는 흰 말풍선은 공고 원문 그대로다(원칙 8-1).
const CSS_chat = () => `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#333;font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif}
.card{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:#9bbbd4;
  display:flex;flex-direction:column}
.kh{background:#a3c1d9;padding:0 34px;height:112px;display:flex;align-items:center;gap:20px;
  color:#1a1a1a;font-size:38px;font-weight:700}
.kh .bk{font-size:46px;font-weight:400;opacity:.8}
.kh .rt{margin-left:auto;letter-spacing:.18em;opacity:.55;font-size:30px}
.kbody{flex:1;padding:40px 32px 24px;display:flex;flex-direction:column;gap:30px;
  justify-content:flex-end;overflow:hidden}
.row{display:flex;gap:16px;align-items:flex-end}
.row.me{justify-content:flex-end}
.av{flex:0 0 94px;width:94px;height:94px;border-radius:30px;background:#f0c33c;
  display:flex;align-items:center;justify-content:center;font-size:50px}
.wrap2{max-width:790px}
.nm{font-size:.67em;color:#31485c;margin:0 0 11px 6px}
/* 🔴 이어지는 말풍선은 프로필 자리만 비워 둔다 — 왼쪽 줄이 맞아야 카톡처럼 보인다. */
.av.ghost{background:none}
.row.cont .bub{border-radius:20px 20px 20px 6px}
.bub{background:#fff;border-radius:6px 24px 24px 24px;padding:30px 34px;
  font-size:43px;line-height:1.46;color:#111;box-shadow:0 1px 0 rgba(0,0,0,.06)}
.me .bub{background:#fee500;border-radius:22px 6px 22px 22px}
.big2{font-size:60px;font-weight:900;line-height:1.3;letter-spacing:-.03em}
.tm{font-size:24px;color:#40566b;opacity:.8;white-space:nowrap;padding-bottom:6px}
/* 🔴 말풍선이 늘면 위(헤더 쪽)부터 조용히 잘린다 — 아래 정렬이라 그렇다.
   지어내 줄일 수 없으니(원칙 8-1) 글자로 줄인다. 단계는 말풍선 수가 정한다. */
/* 🔴 카톡 말풍선도 브라우저가 재서 줄인다 — 말풍선 수만 세면 긴 원문에서 또 잘린다. */
.kbody[data-fit-box]{font-size:43px}
.kbody .bub{font-size:1em;padding:.62em .74em}
.kbody .big2{font-size:1.35em}
.kbody .nm{font-size:.67em}
.kfoot{background:#fff;padding:22px 30px;display:flex;align-items:center;gap:18px}
.kfoot .pl{font-size:44px;color:#9aa2ab}
.kfoot .inp{flex:1;height:64px;border-radius:999px;background:#f1f2f4}
.kfoot .sd{font-size:30px;color:#c8ccd1;font-weight:700}
mark{background:linear-gradient(transparent 56%, #ffe66b 56%);padding:0 2px}
/* 손으로 그린 표시 — 🔴 템플릿마다 있어야 한다. T1 에만 두면 다른 템플릿에서 흘러내린다 */
.sc{display:block;margin:-4px 0 0 -4px}
.ov{position:absolute;left:-26px;right:-26px;top:-6px;bottom:-6px;pointer-events:none;overflow:visible}

/* 카톡 표지 = 잠금화면 알림. 본문(대화)과 짜임새를 확실히 가른다 */
.lock{background:linear-gradient(165deg,#243447,#0e1620) !important;padding:0;display:block}
.lock .clock{position:absolute;left:0;right:0;top:236px;text-align:center;color:#fff}
.lock .clock b{display:block;font-size:186px;font-weight:200;letter-spacing:-.04em;line-height:1}
.lock .clock span{display:inline-block;margin-top:24px;font-size:31px;font-weight:400;
  padding:9px 26px;border-radius:999px;background:rgba(255,255,255,.16);color:rgba(255,255,255,.92)}
/* 🔴 실제 iOS 잠금화면은 알림이 **아래에** 쌓인다. 가운데 띄워 두니 위아래가 통째로 비었다.
   뒤에 반쯤 보이는 알림 둘을 두는 것이 '진짜 폰' 을 만드는 장치다. */
.lock .stack{position:absolute;left:52px;right:52px;bottom:246px}
.lock .peek,.lock .peek2{position:absolute;border-radius:34px;height:72px}
.lock .peek{left:18px;right:18px;bottom:-20px;background:rgba(255,255,255,.5)}
.lock .peek2{left:38px;right:38px;bottom:-38px;background:rgba(255,255,255,.26)}
.lock .noti{position:relative;
  background:rgba(255,255,255,.95);border-radius:34px;padding:36px 40px 40px;
  box-shadow:0 20px 50px rgba(0,0,0,.45)}
.lock .noti .sub4{margin-top:18px;font-size:31px;color:#5a6472;font-weight:400;line-height:1.5}
.lock .noti .top2{display:flex;align-items:center;gap:14px;font-size:29px;color:#5a6472}
.lock .noti .ico{width:54px;height:54px;border-radius:17px;background:#fee500;
  display:flex;align-items:center;justify-content:center;font-size:28px}
.lock .noti .msg{margin-top:22px;font-size:68px;font-weight:900;line-height:1.26;
  letter-spacing:-.03em;color:#14181f;word-break:keep-all}
.lock .noti .msg em{font-style:normal;color:#1f5fd0}
.lock .swipe{position:absolute;left:0;right:0;bottom:104px;text-align:center;
  color:rgba(255,255,255,.48);font-size:30px;font-weight:400}
/* 🔴 조건 칩 — 표지에 조건이 있다는 것만 알린다. 빼면 금액만 큰 미끼가 된다. */
.lock .bar{position:absolute;left:50%;transform:translateX(-50%);bottom:56px;
  width:220px;height:8px;border-radius:8px;background:rgba(255,255,255,.38)}
`;

function cards_chat(c) {
  const { s0, m, who, traps, docs, period, pkText, ddText, amtSub, t1, t2 } = c;
  const room = s0.org;   // 🔴 축약 금지(실측 최장 20자) — 14자로 자르던 시절 13건이 잘렸다
  const head = `<div class="kh"><span class="bk">‹</span><span>${esc(room)}</span>
    <span class="rt">⌕ ☰</span></div>`;
  const foot = `<div class="kfoot"><span class="pl">＋</span><span class="inp"></span><span class="sd">전송</span></div>`;
  // 🔴 말풍선을 **묶어서** 그린다 — 실제 카카오톡은 같은 사람이 연달아 보내면
  //    프로필·이름을 첫 말풍선에만 붙이고 시각은 **마지막에만** 찍는다.
  //    첫 판은 말풍선마다 다 붙여서 한 화면에 '한대장' 이 여섯 번 나왔다(가짜 티의 8할).
  const me = (t, tm) => ({ who: 'me', html: esc(t), tm });
  const you = (html, tm, big) => ({ who: 'you', html, tm, big });
  const wrap = (rows) => {
    const html = rows.map((r, i) => {
      const first = i === 0 || rows[i - 1].who !== r.who;          // 이 사람의 첫 마디
      const last = i === rows.length - 1 || rows[i + 1].who !== r.who
        || rows[i + 1].tm !== r.tm;                                 // 같은 시각 묶음의 끝
      const tm = last ? `<span class="tm">${r.tm}</span>` : '<span class="tm"></span>';
      if (r.who === 'me') return `<div class="row me">${tm}<div class="wrap2">
        <div class="bub">${r.html}</div></div></div>`;
      return `<div class="row${first ? '' : ' cont'}">
        ${first ? '<div class="av">🎓</div>' : '<div class="av ghost"></div>'}
        <div class="wrap2">${first ? '<div class="nm">한대장</div>' : ''}
        <div class="bub${r.big ? ' big2' : ''}">${r.html}</div></div>${tm}</div>`;
    }).join('');
    return `<div class="card">${head}<div class="kbody" data-fit-box style="gap:${
      Math.max(8, Math.round(26 - (rows.length - 4) * 4))}px">${html}</div>${foot}</div>`;
  };

  const lock = `<div class="card lock">
    <div class="clock"><b>8:41</b><span>${esc(ddText)}</span></div>
    <div class="stack">
      <div class="peek2"></div><div class="peek"></div>
      <div class="noti">
        <div class="top2"><span class="ico">💬</span><span>카카오톡 · 지금</span></div>
        <div class="msg">${esc(t1)}<br>${t2}</div>
        <div class="sub4">${esc(s0.org)} · ${m ? esc(m.n) + esc(m.unit) : '금액 앱에서 확인'}</div>
      </div>
    </div>
    <div class="swipe">밀어서 확인 →</div><div class="bar"></div>
  </div>`;

  return [
    lock,
    // 🔴 앞에 한 마디를 세우고 그 밑에 원문을 단다(개발자 지시). 이모티콘으로 때우지 않는다.
    //    말은 **조건문**이어야 한다 — `너 이거면 넣을 수 있어` 는 공고 조건이고,
    //    `너는 된다` 는 개별 판정이라 못 쓴다(자기잠식 선 · 관문 C3).
    wrap([me('나도 받을 수 있어?', '오후 8:42'),
      you('<b>너 이거면 넣을 수 있어</b>', '8:42'),
      ...who.map((t) => you(hi(t), '8:42'))]),
    wrap([me('얼마 주는데? 언제까지야?', '오후 8:43'),
      you(m && !m.many ? `<b style="font-size:56px;font-weight:900">${esc(m.n)}${esc(m.unit)}</b>`
        + (amtSub ? `<br><span style="font-size:30px;color:#666">${esc(amtSub)}</span>` : '')
        : `금액은 앱에서 확인<br><span style="font-size:30px;color:#666">${esc(bullets((s0.fields||{})['지원금액'])[0] || '')}</span>`, '8:43'),
      you(`신청 기간 <mark>${esc(period)}</mark>`, '8:43'),
      you(`선발 ${esc(pkText)}${docs.length ? ` · 낼 서류 <mark>${docs.length}가지</mark>` : ''}`, '8:43')]),
    ...(traps.length ? [wrap([me('오케이 바로 넣는다', '오후 8:44'),
      you('아 잠깐', '8:44'),
      you('<b>너 이거에 해당하면 못 받아</b>', '8:44'),
      ...traps.map((t) => you(hi(t), '8:44'))])] : []),
    // 🔴 말풍선이 너무 많으면 위가 헤더에 잘린다(아래 정렬이라 넘치면 위부터 사라진다).
    //    줄을 줄이고 '한대장' 을 큰 말풍선으로 세운다.
    wrap([me('이런 거 어디서 봐?', '오후 8:45'),
      you('<b>한대장</b><br><span style="font-size:32px;font-weight:400;color:#5a6472">대학생 장학금 · 교내 + 교외</span>', '8:45', true),
      you('학과·학년·소득 넣으면<br><b>나한테 되는 것만</b> 남아', '8:45'),
      you('<b style="font-size:48px;font-weight:900">프로필 링크 →</b>', '8:45'),
      me('개꿀 ㄱㅅ', '오후 8:45')]),
  ];
}

// ════════ T3 · 아이패드 굿노트 필기 ═════════════════════════
const CSS_note = () => `
@import url('https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Noto+Sans+KR:wght@500;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#333;font-family:'Gaegu','Apple SD Gothic Neo',cursive}
/* 🔴 개발자 레퍼런스는 "실제 필기 노트 느낌" 인데 첫 판은 크림색 바탕 + 손글씨 폰트가
   전부였다(옅은 모눈 하나). 노트로 읽히게 하는 것은 **가로줄 + 왼쪽 여백선**이다 —
   줄 간격은 본문 글자 크기에 맞춘다(안 맞으면 글이 줄 위에 안 앉아 더 가짜가 된다). */
.card{width:${W}px;height:${H}px;position:relative;overflow:hidden;background:#fbf7ec;
  padding:78px 66px 88px 150px;display:flex;flex-direction:column;color:#22252b}
.card::before{content:'';position:absolute;inset:0;pointer-events:none;
  background-image:repeating-linear-gradient(#e7e1d2 0 2px, transparent 2px 68px)}
/* 왼쪽 여백선 — 이 한 줄이 '종이' 를 만든다 */
.card::after{content:'';position:absolute;left:108px;top:0;bottom:0;width:3px;
  background:#e8a9a0;pointer-events:none}
.tag2{align-self:flex-start;font-family:'Gaegu';font-weight:700;font-size:40px;color:#2f6be0;
  border:4px solid #2f6be0;border-radius:999px;padding:6px 30px;transform:rotate(-2deg)}
h1{font-family:'Gaegu';font-weight:700;font-size:104px;line-height:1.16;letter-spacing:-.02em;
  word-break:keep-all;
  margin-top:26px;position:relative;z-index:1}
h1 em{font-style:normal;background:linear-gradient(transparent 54%, #ffe36b 54%);padding:0 6px}
.sub2{font-family:'Gaegu';font-weight:400;font-size:44px;color:#5b6270;margin-top:14px}
.notes{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;
  gap:24px;position:relative;z-index:1;margin-top:26px}
.nrow{display:flex;gap:24px;align-items:flex-start}
/* 3장은 목록이 아니라 '항목: 값' 이다 — 다른 장과 리듬이 달라야 한다 */
.key{flex:0 0 148px;font-family:'Gaegu';font-weight:700;font-size:42px;color:#2f6be0;
  padding-top:6px;transform:rotate(-1.2deg)}
.nrow p{font-family:'Gaegu';font-weight:400;font-size:48px;line-height:1.42;flex:1}
.nrow p b{font-weight:700}
mark{background:linear-gradient(transparent 56%, #ffe36b 56%);padding:0 3px}
/* 🔴 테두리 박스는 개발자가 반려한 것이다. 노트에서 하듯 **형광펜으로 긋는다**. */
.memo{align-self:flex-start;font-family:'Gaegu';font-weight:700;font-size:44px;
  background:linear-gradient(transparent 52%, #ffe36b 52%);padding:0 10px 2px;
  transform:rotate(-.8deg)}
.wm2{margin-top:34px;text-align:center;font-family:'Gaegu';font-weight:700;font-size:112px;
  line-height:1.05;color:#2f6be0;letter-spacing:-.02em}
.wm2 span{display:block;font-weight:400;font-size:36px;color:#5b6270;margin-top:2px}
/* 손으로 그린 표시 — 🔴 템플릿마다 있어야 한다. T1 에만 두면 다른 템플릿에서 흘러내린다 */
.sc{display:block;margin:-4px 0 0 -4px}
.ov{position:absolute;left:-26px;right:-26px;top:-6px;bottom:-6px;pointer-events:none;overflow:visible}
.bigN2{font-family:'Gaegu';font-weight:700;font-size:196px;line-height:1.05;color:#2f6be0;
  position:relative;display:inline-block;padding:0 8px}
`;

function cards_note(c) {
  const { s0, m, who, traps, docs, period, pkText, ddText, amtSub, t1, t2 } = c;
  // 🔴 5장이 전부 같은 틀이었다(태그 → 제목 → 밑줄 → 검은 막대 → 번호 목록 → ☆ 박스).
  //    검은 막대와 테두리 박스는 노트에 없는 것이라 걷어내고, 장마다 다른 표시를 쓴다.
  const page = (tag, title, sub, inner, memo) => `<div class="card">
    <div class="tag2">${tag}</div>
    <h1>${title}</h1>${scribble(440, '#2f6be0')}
    ${sub ? `<div class="sub2">${sub}</div>` : ''}
    <div class="notes">${inner}</div>
    ${memo ? `<div class="memo">${memo}</div>` : ''}
  </div>`;
  // 자격 = 체크칸(✓) · 제한 = 빈 칸 + 빨간 X. 색 원도 이모지도 안 쓴다.
  const list = (arr, ok) => arr.map((t) =>
    `<div class="nrow">${ok ? handBox('#2f6be0', true) : handX('#d8442f')}
      <p data-fit style="font-size:50px">${hi(t)}</p></div>`).join('');

  return [
    page(ddText, `${esc(t1)}<br><em>${t2.replace(/<\/?em>/g, '')}</em>`, esc(s0.org),
      m && !m.many ? `<div style="text-align:center"><span class="bigN2">${esc(m.n)}<i
        style="font-style:normal;font-size:88px">${esc(m.unit)}</i>${handOval('#e0533d')}</span>
        <div class="sub2" style="text-align:center;margin-top:22px">${esc(amtSub || '')}</div></div>`
      : `<div style="text-align:center"><span class="bigN2" style="font-size:110px">금액 앱에서 확인</span>
        <div class="sub2" style="text-align:center;margin-top:18px">${esc(bullets((s0.fields||{})['지원금액'])[0] || '')}</div></div>`,
      '저장해두고 마감 전에 다시 보기'),
    page('지원 자격', '나도 <em>받을 수 있나?</em>', '', list(who, true),
      '하나라도 안 맞으면 신청 안 돼요'),
    page('얼마 · 언제', '얼마 받고 <em>언제까지?</em>', '',
      `<div class="nrow"><span class="key">얼마</span>
        <p data-fit style="font-size:50px"><b>${m ? esc(m.n) + esc(m.unit) : '앱에서 확인'}</b> ${esc(amtSub || '')}</p></div>
       <div class="nrow"><span class="key">언제</span>
        <p data-fit style="font-size:50px"><mark>${esc(period)}</mark></p></div>
       <div class="nrow"><span class="key">몇 명</span>
        <p data-fit style="font-size:50px">${esc(pkText)}${docs.length ? ` · 낼 서류 <mark>${docs.length}가지</mark>` : ''}</p></div>`,
      ''),
    ...(traps.length ? [page('자격 제한', '이러면 <em>못 받아요</em>', '', list(traps, false),
      '신청 전에 꼭 확인')] : []),
    page('한대장', '장학금 찾다가<br><em>시간 다 갔죠?</em>', '',
      `<div class="nrow">${handBox('#2f6be0', true)}<p>학과·학년·소득 넣으면 <b>나한테 되는 것만</b> 남아요</p></div>
       <div class="nrow">${handBox('#2f6be0', true)}<p>마감 임박 공고는 <mark>알림</mark>으로</p></div>
       <div class="nrow">${handBox('#2f6be0', true)}<p>신청서 양식까지 앱에서 작성</p></div>
       <div class="wm2">한대장<span>대학생 장학금</span></div>`,
      '프로필 링크 →'),
  ];
}

// ── 템플릿 등록 ─────────────────────────────────────────────
const TPL = {
  photo: { css: CSS_photo, cards: cards_photo, skin: true, fonts: ["900 100px 'Noto Sans KR'", "500 30px 'Noto Sans KR'"] },
  chat:  { css: CSS_chat,  cards: cards_chat,  fonts: ["900 60px 'Noto Sans KR'", "400 38px 'Noto Sans KR'"] },
  note:  { css: CSS_note,  cards: cards_note,  fonts: ["700 110px 'Gaegu'", "400 48px 'Gaegu'"] },
};

// ── 밖에서 쓰라고 내주는 것 ─────────────────────────────────
// 🔴 캡션 생성기·넘침 스윕이 **같은 추출기**를 써야 카드와 캡션이 갈라지지 않는다.
//    예전엔 이 파일을 통째로 베껴 _lib.mjs 로 쓰고 지웠다 — 꼼수라 걷어냈다.
export { TPL, SKINS, context, bigTitle, whoLines, bullets, dropParen, money, dday, ddayText, tidy, esc, W, H };

// ── 실행 (직접 돌릴 때만 — import 하면 안 돈다) ──────────────
// 🔴 playwright 를 최상단에서 부르면 **이 파일을 import 하는 쪽이 다 브라우저를 요구한다.**
//    관문(verify-insta.js)이 추출기를 쓰려고 import 했다가 CI 에서 죽었다 —
//    CI 는 playwright-core 만 깐다. 로컬은 통과하고 CI 만 빨간불인 유형.
//    브라우저는 **직접 돌릴 때만** 필요하니 그 안에서 부른다.
const RUN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (RUN) {
  const { chromium } = await import('playwright');
  const args = process.argv.slice(2);
  // 🔴 `--seed=`(빈 값) 은 undefined 로 돌려준다 — 안 그러면 Number('') 가 0 이 돼
  //    "왜 늘 같은 얼굴이지" 가 된다. `--seed`(= 없음) 도 안 준 것으로 본다.
  const val = (k) => {
    const a = args.find((x) => x.startsWith(`--${k}=`) || x === `--${k}`);
    if (a === undefined) return undefined;
    const v = a.split('=').slice(1).join('=');
    return v === '' ? undefined : v;
  };
  const needle = args.find((a) => !a.startsWith('--'));
  if (!needle) { console.error('공고 이름 일부를 주세요 — 예: node insta/render.mjs 한진해운 --tpl=all'); process.exit(1); }
  const skinName = val('skin') || 'blue';
  const k = SKINS[skinName];
  if (!k) { console.error(`판형 '${skinName}' 없음 (${Object.keys(SKINS).join(' / ')})`); process.exit(1); }

  // 🔴 교외·교내를 **한 목록**으로 본다 — 따로 읽으면 고르기와 렌더러가 갈라진다.
  const { allNotices, findNotice } = await import('./notices.mjs');
  const { items, meta: data } = allNotices();
  const s = findNotice(items, needle);
  if (!s) { console.error(`'${needle}' 공고를 못 찾았습니다.`); process.exit(1); }
  if (s.school) console.log(`  교내 — ${s.school}`);

  // 🔴 씨앗을 안 주면 공고 이름에서 만든다 — 같은 공고는 늘 같은 얼굴, 공고가 바뀌면 얼굴도 바뀐다.
  if (val('seed') !== undefined && !Number.isFinite(Number(val('seed')))) {
    console.error(`--seed 는 숫자여야 합니다 (받은 값: ${val('seed')})`); process.exit(1);
  }
  const seed = val('seed') !== undefined ? Number(val('seed'))
    : [...(s.org + s.name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7);
  const school = val('school') || s.school || null;
  const names = Object.keys(TPL);
  const wantTpl = val('tpl');
  const list = wantTpl === 'all' ? names
    : wantTpl ? [wantTpl] : [names[Math.abs(seed) % names.length]];   // 안 주면 씨앗으로 돌린다
  for (const t of list) if (!TPL[t]) { console.error(`템플릿 '${t}' 없음 (${names.join(' / ')} / all)`); process.exit(1); }
  // 🔴 조용히 무시하면 '색을 바꿨는데 왜 그대로지' 를 다음 사람이 다시 겪는다.
  if (val('skin') && list.every((t) => !TPL[t].skin))
    console.error(`⚠️  --skin 은 photo 판형에만 걸립니다 — ${list.join('/')} 는 색이 고정입니다.`);

  // 🔴 캡션도 여기서 만든다 — 따로 돌리면 다른 씨앗·다른 공고로 짝이 어긋난다.
//    `--caption` 만 주면 그림 없이 캡션만 찍는다(눈으로 볼 때 빠르다).
const cap = (() => {
  try { return caption(s, context(s, new Date(), k, seed, school), data); }
  catch (e) { console.error(`⚠️  캡션 없음 — ${e.message}`); return null; }
})();
if (args.includes('--caption')) {
  if (!cap) process.exit(1);
  console.log(cap);
  const nTag = (cap.match(/#[^\s#]+/g) || []).length;
  console.error(`\n── ${cap.length}자 / ${LIMIT.chars} · 해시태그 ${nTag}개 / ${LIMIT.tags}`);
  process.exit(cap.length > LIMIT.chars ? 1 : 0);
}

mkdirSync(OUT, { recursive: true });
  let overflowed = false;
  const browser = await chromium.launch();
  for (const name of list) {
    const t = TPL[name];
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    await page.setContent(`<style>${t.css(k)}</style>${t.cards(context(s, new Date(), k, seed, school)).join('')}`);
    await page.waitForLoadState('networkidle');
    // 🔴 폰트가 안 실리면 전부 두부(□)가 되는데 로그는 초록불이다. 시끄럽게 죽인다.
    //    ⚠️ fonts.check() 는 기본 시험 글자가 라틴이라 한글 서브셋에선 늘 false → 한글로 묻는다.
    //    ⚠️ check() 만 하면 'unloaded' 로 남는다 — load() 로 불러오라고 시켜야 한다(실측).
    // 🔴 fonts.check() 는 **맞는 FontFace 가 하나도 없으면 참을 돌려준다**(CSS Font Loading 규격).
    //    그래서 폰트를 아예 못 받아온 경우 — 두부(□)가 되는 바로 그 경우 — 를 통과시켰다(실측).
    //    load() 가 돌려주는 배열의 길이를 봐야 '진짜 실렸는지' 를 안다.
    const ok = await page.evaluate(async (specs) => {
      const got = await Promise.all(specs.map((x) => document.fonts.load(x, '한글가나')));
      await document.fonts.ready;
      return got.every((arr) => arr.length > 0) && document.fonts.size > 0;
    }, t.fonts);
    if (!ok) { console.error(`🚨 ${name}: 한글 폰트를 못 실었습니다 — 글자가 깨집니다.`); await browser.close(); process.exit(1); }
    // 🔴 배경 사진이 404 면 표지가 통째로 까매지는데 로그는 초록불이다(폰트와 같은 유형).
    //    background-image 는 onerror 가 없으니 같은 주소를 <img> 로 한 번 더 받아 본다.
    const bgUrl = await page.evaluate(() => {
      const el = document.querySelector('.photo .bg'); if (!el) return null;
      return (el.style.backgroundImage.match(/url\("(.+)"\)/) || [])[1] || null;
    });
    if (bgUrl) {
      const w = await page.evaluate((u) => new Promise((ok) => {
        const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = u;
      }), bgUrl);
      if (!w) { console.error(`🚨 ${name}: 배경 사진을 못 받았습니다 — 표지가 까맣게 나갑니다\n   ${bgUrl}`); await browser.close(); process.exit(1); }
    }
    // 🔴 글자 크기를 코드에서 어림하지 않는다 — 넉넉하게 그려 두고 **브라우저가 재서** 줄인다.
    //    손으로 어림하던 시절엔 짧은 카드에 여백이 남고 긴 카드는 넘쳤다(둘 다 지적받았다).
    //    규칙은 `insta/fit.mjs` 한 곳 — 검사도 같은 파일을 쓴다.
    await page.evaluate(shrinkToFit);
    const over = await page.evaluate(overflowing);
    if (over.length) { console.error(`🚨 ${name}: ${over.join('·')}번째 카드에서 글자가 잘립니다`); overflowed = true; }
    // 🔴 옛 그림을 안 지우면 4장짜리 공고에 지난 렌더의 5장이 섞인다(미리보기에서 실제로 봤다).
    for (const f of await readdir(OUT))
      if (new RegExp(`^${name}-\\d+\\.(png|jpg)$`).test(f)) rmSync(join(OUT, f));
    const els = await page.$$('.card');
    // 🔴 인스타 게시(Content Publishing)는 **JPEG 만** 받는다 — PNG 로 올리면 컨테이너
    //    만들기에서 막힌다. 눈으로 볼 때는 PNG 가 편하니 둘 다 떨군다.
    //    (사진 표지는 1MB 가 넘는데 JPEG 로는 1/5 로 준다. 인스타 상한은 8MB.)
    for (let i = 0; i < els.length; i++) {
      await els[i].screenshot({ path: join(OUT, `${name}-${i + 1}.png`) });
      await els[i].screenshot({ path: join(OUT, `${name}-${i + 1}.jpg`), type: 'jpeg', quality: 92 });
    }
    await page.close();
    console.log(`  ${name} — ${els.length}장`);
  }
  // 마감 지난 공고면 캡션이 없다 — '올리면 안 되는 것' 이라는 신호다.
  if (cap) { writeFileSync(join(OUT, 'caption.txt'), cap + '\n'); console.log('  캡션 — insta/out/caption.txt'); }

  // 🔴 게시용으로 내보내기 — 인스타는 파일 업로드를 안 받고 **공개 주소**를 요구한다.
  //    그래서 여기만 저장소에 커밋해 GitHub Pages 가 서빙하게 한다(`out/` 은 작업용이라 무시).
  //    ⚠️ 한 판형만 내보낸다 — 캐러셀은 한 벌이다.
  if (args.includes('--pub')) {
    if (!cap) { console.error('🚨 캡션이 없어 게시용으로 못 내보냅니다.'); process.exit(1); }
    if (list.length !== 1) { console.error('🚨 --pub 은 판형 하나만 — --tpl=photo 처럼 지정하세요.'); process.exit(1); }
    const day = new Date().toISOString().slice(0, 10);
    const pub = join(ROOT, 'insta', 'pub', day);
    // ponytail: 지난 날짜를 지워 작업 트리를 한 벌로 유지한다. 히스토리는 계속 자란다
    //           (하루 1MB) — 커지면 GitHub Release 자산으로 옮기는 게 다음 수다.
    rmSync(join(ROOT, 'insta', 'pub'), { recursive: true, force: true });
    mkdirSync(pub, { recursive: true });
    const name = list[0];
    const n = (await readdir(OUT)).filter((f) => f.startsWith(`${name}-`) && f.endsWith('.jpg')).length;
    for (let i = 1; i <= n; i++) copyFileSync(join(OUT, `${name}-${i}.jpg`), join(pub, `${i}.jpg`));
    writeFileSync(join(pub, 'caption.txt'), cap + '\n');
    writeFileSync(join(pub, 'meta.json'), JSON.stringify(
      { code: s.code, org: s.org, name: s.name, due: s.due, tpl: name, seed, at: day }, null, 1) + '\n');
    console.log(`  게시용 — insta/pub/${day}/ (${n}장 + 캡션)`);
  }
  await browser.close();
  // 🔴 잘린 채로 올리면 사실이 사라진 게시물이 나간다 — 조용히 끝내지 않는다.
  if (overflowed) process.exit(2);
  console.log(`${s.org} · ${s.name} (마감 ${s.due} · 씨앗 ${seed})`);

}