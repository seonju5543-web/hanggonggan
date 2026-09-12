/**
 * 4번 판형 · 포스터 — 먹색 바탕에 큰 글자만 (2026-09-12 · 바깥 판형 파일의 첫 예시)
 *
 * 이 파일이 '판형 하나' 다. `insta/templates.json` 의 4번이 이 파일을 가리킨다.
 * 새 판형을 만들 때 베끼는 본보기 — `node insta/new-template.mjs <id> "<이름>"` 이 이 꼴로 시작 파일을 만든다.
 *
 * 내줘야 하는 것 셋:
 *   css(skin, kit)   → 문자열. 카드 한 장은 `.card` (kit.W × kit.H)
 *   cards(ctx, kit)  → 카드 HTML 배열(2~10장). 사실 줄은 `data-fit` 을 달아야 브라우저가 줄여서 담는다
 *   fonts            → 실렸는지 확인할 글꼴 두 개(굵기 크기 '이름') — 안 실리면 렌더러가 죽는다
 * 선택: `export const skin = true` 를 두면 `--skin` 색 한 벌을 받는다.
 *
 * 🔴 지키는 것(DESIGN.md '반려된 것'): 그릇(흰 박스) 없음 · 바닥 회색 글씨 없음 · 색 원 안 숫자·이모지 없음 ·
 *    사실 문장은 ctx 에서 온 것만(원칙 8-1) · 개별 판정 문구 없음(관문 C3) · 금지어 없음(관문 C2).
 * 🔴 ctx 에서 쓰는 사실 재료: t1/t2(후킹) · who(자격 줄) · traps(제한 줄) · period · pkText · docs · m(금액) ·
 *    amtSub/moneyRaw · ddText · s0.org/name. 여기 없는 사실을 쓰면 지어내는 것이다.
 */
const INK = '#14181f', PAPER = '#f4efe6', ACCENT = '#ffd24d', RED = '#ff5a48';

export const fonts = ["900 100px 'Noto Sans KR'", "500 40px 'Noto Sans KR'"];

export const css = (k, kit) => `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#333;font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;font-weight:500}
.card{width:${kit.W}px;height:${kit.H}px;position:relative;overflow:hidden;background:${INK};color:${PAPER};
  padding:88px 70px 84px;display:flex;flex-direction:column;word-break:keep-all}
.card.light{background:${PAPER};color:${INK}}
.card.warn{background:${ACCENT};color:${INK}}
.eyebrow{font-size:34px;font-weight:700;letter-spacing:.02em;opacity:.7}
.eyebrow b{font-weight:900;opacity:1}
/* 표지 — 큰 글자가 전부다. 아래에서 위로 쌓는다 */
.hero{margin-top:auto;font-weight:900;line-height:1.04;letter-spacing:-.05em;overflow-wrap:anywhere}
/* 긴 재단명은 잘리지 않고 줄을 바꾼다 — 광산김씨대종중장학문화재단 이 오른쪽으로 나갔다(실측).
   (CSS 주석에 백틱을 쓰면 템플릿 문자열이 거기서 끊긴다 — DESIGN.md) */
.hero em{font-style:normal;color:${ACCENT}}
.card.light .hero em{color:#1f5fd0}
.hero-sub{margin-top:34px;font-size:40px;font-weight:500;opacity:.78;line-height:1.4}
.rule{height:6px;width:180px;background:currentColor;opacity:.9;margin:26px 0 0}
/* 항목 — 큰 번호 + 문장. 원·상자 없이 번호는 글자로만 */
h2{font-weight:900;font-size:96px;line-height:1.06;letter-spacing:-.05em;margin-top:18px}
h2 em{font-style:normal;color:${ACCENT}}
.card.light h2 em{color:#1f5fd0}
.card.warn h2 em{color:${RED}}
.items{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;margin-top:20px}
.it{display:flex;gap:26px;align-items:flex-start;padding:26px 0;border-top:3px solid currentColor}
.it:first-child{border-top:0}
.it .n{flex:0 0 74px;font-weight:900;font-size:64px;line-height:1;letter-spacing:-.04em;opacity:.55}
.it p{flex:1;font-weight:700;line-height:1.38}
mark{background:none;color:${ACCENT};padding:0}
.card.light mark{color:#1f5fd0}
.card.warn mark{color:${RED}}
/* 값 — 라벨 위 · 값 아래 */
.kv{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;margin-top:12px}
.kv b{display:block;font-size:31px;font-weight:700;opacity:.62;margin-bottom:8px}
.kv span{display:block;font-weight:900;font-size:64px;line-height:1.14;letter-spacing:-.04em}
.big{font-weight:900;font-size:200px;line-height:1;letter-spacing:-.06em;color:${ACCENT}}
.big i{font-style:normal;font-size:84px;margin-left:8px}
`;

export function cards(c, kit) {
  const { esc, hi } = kit;
  const { s0, m, t1, t2, who, traps, docs, period, pkText, ddText, amtSub, moneyRaw } = c;
  // 표지 글자 크기 — 가장 긴 **낱말**로 정한다(줄은 바꿀 수 있어도 낱말은 못 자른다). 76~150px.
  const longest = Math.max(...[t1, String(t2).replace(/<[^>]+>/g, '')].flatMap((x) => x.split(/\s+/)).map((x) => x.length));
  const size = () => Math.max(76, Math.min(150, Math.floor(940 / (longest * 0.95))));
  const list = (arr, cls = '') => arr.map((t, i) =>
    `<div class="it"><span class="n">${String(i + 1).padStart(2, '0')}</span><p data-fit style="font-size:54px">${hi(t)}</p></div>`).join('');

  const cover = `<div class="card">
    <div class="eyebrow"><b>${esc(s0.org)}</b> · ${esc(ddText)}</div>
    <div class="hero" style="font-size:${size()}px">${esc(t1)}<br>${t2}</div>
    <div class="rule"></div>
    <div class="hero-sub">${esc(s0.name)}</div>
  </div>`;

  const who2 = `<div class="card light">
    <div class="eyebrow">지원 자격</div>
    <h2>나도<br><em>받을 수 있나?</em></h2>
    <div class="items">${list(who)}</div>
  </div>`;

  const money3 = `<div class="card">
    <div class="eyebrow">얼마 · 언제까지</div>
    ${m && !m.many
      ? `<div class="big" style="margin-top:26px">${esc(m.n)}<i>${esc(m.unit)}</i></div>
         <div class="hero-sub" style="margin-top:8px">${esc(amtSub || '')}</div>`
      : `<h2><em>금액은</em><br>앱에서 확인</h2><div class="hero-sub" style="margin-top:8px">${esc(moneyRaw)}</div>`}
    <div class="kv">
      <div><b>신청 기간</b><span data-fit style="font-size:64px">${esc(period)}</span></div>
      <div><b>선발 인원${docs.length ? ' · 낼 서류' : ''}</b><span>${esc(pkText)}${docs.length ? ` · 서류 ${docs.length}가지` : ''}</span></div>
    </div>
  </div>`;

  const traps4 = `<div class="card warn">
    <div class="eyebrow">자격 제한</div>
    <h2>이러면<br><em>못 받아요</em></h2>
    <div class="items">${list(traps)}</div>
  </div>`;

  const last5 = `<div class="card">
    <h2>장학금 찾다가<br><em>시간 다 갔죠?</em></h2>
    <div class="items" style="justify-content:space-evenly">
      <p style="font-size:44px;line-height:1.5;opacity:.85">학과 · 학년 · 소득만 넣으면<br><b style="font-weight:900;opacity:1">나한테 되는 것만 남아요.</b></p>
      <p style="font-weight:900;font-size:150px;letter-spacing:-.06em;line-height:1;color:${ACCENT}">한대장</p>
      <p style="font-size:38px;opacity:.7">대학생 장학금 · 교내 + 교외 다 모아봤어요</p>
      <p style="font-weight:900;font-size:58px;letter-spacing:-.03em">프로필 링크 →</p>
    </div>
  </div>`;

  // 🔴 자격제한 칸이 없는 공고에 빈 '못 받아요' 카드를 그리지 않는다(관문 I2 와 같은 규칙).
  return traps.length ? [cover, who2, money3, traps4, last5] : [cover, who2, money3, last5];
}
