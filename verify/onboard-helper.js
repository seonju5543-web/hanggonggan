/* 온보딩을 끝까지 넘기는 공용 도우미 (2026-08-29 신설)

   🔴 **드라이버에 온보딩 단계 번호를 박지 말 것.** 단계는 늘어난다.
      실제로 4단계에서 6단계가 됐고(특별자격·'지금 받고 있는 장학금'이 끼워졌다),
      `data-step="3"` 까지만 누르던 드라이버 6개가 **그 순간부터 통째로 죽었다** —
      2026-08-24 verify-essay-ui, 2026-08-29 registered·chat·forms-data·
      new-forms·source-links·push-client. 아무도 몰랐다(워크플로가 안 돌렸다).

   이 도우미는 **찾는 것이 보일 때까지 '다음'을 누른다.** 단계가 더 늘어도 안 깨진다.
   ⚠️ 중간 단계에 반드시 채워야 하는 칸이 있으면 이 도우미로 건너뛰면 안 된다 —
      지금 건너뛰는 단계(특별자격·보유 장학금)는 체크박스뿐이라 비워도 넘어간다. */
async function nextUntil(page, selector, max = 8) {
  for (let i = 0; i < max; i++) {
    if (await page.isVisible(selector)) return true;
    const next = await page.$('.onboard-step:not([hidden]) [data-next]');
    if (!next) break;
    await next.click();
    await page.waitForTimeout(150);
  }
  return page.isVisible(selector);
}
module.exports = { nextUntil };
