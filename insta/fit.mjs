/** 카드 안 글자를 **브라우저가 실제로 재서** 맞추는 단 하나의 규칙.
 *  🔴 여기 말고 다른 데 쓰지 말 것 — 렌더러와 검사가 베껴 두면 서로 다른 것을 재고,
 *     "렌더는 초록불인데 검사만 빨간불" 이 된다(이 저장소가 반복해서 겪은 유형).
 *  둘 다 `page.evaluate(shrinkToFit)` 로 그대로 넘긴다. */

/** 카드 테두리를 벗어난 자식이 없는가. 🔴 scrollHeight 로 재면 안 된다 —
 *  넘치는 것은 안쪽 상자가 아니라 카드이고, 위로 넘친 것은 scrollHeight 에 안 잡힌다. */
export function shrinkToFit() {
  const fits = (card) => {
    const r = card.getBoundingClientRect();
    return ![...card.querySelectorAll('*')].some((el) => {
      const b = el.getBoundingClientRect();
      return b.height > 0 && (b.top < r.top - 2 || b.bottom > r.bottom + 2);
    });
  };
  // 🔴 옆으로 넘친 글자도 잘린다 — 4번 판형 표지에서 긴 재단명이 오른쪽으로 나갔는데 위아래만
  //    재던 검사가 초록불이었다(2026-09-12 실측). 줄바꿈 못 하는 낱말은 글자를 줄여야 들어간다.
  const fitsWide = (card) => {
    const r = card.getBoundingClientRect();
    return ![...card.querySelectorAll('*')].some((el) => {
      const b = el.getBoundingClientRect();
      return b.height > 0 && b.width > 0 && (b.left < r.left - 2 || b.right > r.right + 2);
    }) && !sideOverflowText(card, r);
  };
  // 인라인 글자는 요소 상자 안에 안 잡히므로 글자 자체의 범위를 잰다(Range).
  const sideOverflowText = (card, r) => {
    const rng = document.createRange();
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      rng.selectNodeContents(n);
      for (const b of rng.getClientRects()) if (b.width > 0 && (b.left < r.left - 2 || b.right > r.right + 2)) return true;
    }
    return false;
  };
  for (const card of document.querySelectorAll('.card')) {
    const box = card.querySelector('[data-fit-box]');
    // 🔴 한 카드 안의 글자는 **같이** 움직인다 — 줄마다 크기가 다르면 지저분하다.
    const els = box ? [box] : [...card.querySelectorAll('[data-fit]')];
    if (!els.length) continue;
    const base = parseFloat(getComputedStyle(els[0]).fontSize);
    // 큰 쪽부터 1px 씩 내려오며 **들어가는 가장 큰 크기**를 고른다.
    for (let f = base; f >= 18; f -= 1) {
      els.forEach((el) => { el.style.fontSize = `${f}px`; });
      if (fits(card)) break;
    }
  }
  // 표지처럼 data-fit 이 없는 큰 글자도 옆으로 넘치면 줄인다 — 아래 overflowing 이 같은 잣대로 본다.
  for (const card of document.querySelectorAll('.card')) {
    if (fitsWide(card)) continue;
    const big = [...card.querySelectorAll('*')].filter((el) => parseFloat(getComputedStyle(el).fontSize) >= 60 && el.children.length <= 3 && el.textContent.trim());
    for (const el of big) {
      const base = parseFloat(getComputedStyle(el).fontSize);
      for (let f = base; f >= 40; f -= 2) { el.style.fontSize = `${f}px`; if (fitsWide(card)) break; }
      if (fitsWide(card)) break;
    }
  }
}

/** 그래도 넘친 카드의 번호. 잘린 채로 올리면 사실이 사라진 게시물이 나간다. */
export function overflowing() {
  const textOut = (card, r) => {
    const rng = document.createRange();
    const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      rng.selectNodeContents(n);
      for (const b of rng.getClientRects()) if (b.width > 0 && (b.left < r.left - 2 || b.right > r.right + 2)) return true;
    }
    return false;
  };
  return [...document.querySelectorAll('.card')].map((card, i) => {
    const r = card.getBoundingClientRect();
    const boxOut = [...card.querySelectorAll('*')].some((el) => {
      const b = el.getBoundingClientRect();
      return b.height > 0 && (b.top < r.top - 2 || b.bottom > r.bottom + 2);
    });
    return boxOut || textOut(card, r) ? i + 1 : 0;   // 🔴 옆으로 넘친 글자도 잘림이다
  }).filter(Boolean);
}
