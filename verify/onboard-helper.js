/* 브라우저 드라이버 공용 도우미 (2026-08-29 신설)

   ── ① 온보딩을 끝까지 넘긴다 ──

   🔴 **드라이버에 온보딩 단계 번호를 박지 말 것.** 단계는 늘어난다.
      실제로 4단계에서 6단계가 됐고(특별자격·'지금 받고 있는 장학금'이 끼워졌다),
      `data-step="3"` 까지만 누르던 드라이버 6개가 **그 순간부터 통째로 죽었다** —
      2026-08-24 verify-essay-ui, 2026-08-29 registered·chat·forms-data·
      new-forms·source-links·push-client. 아무도 몰랐다(워크플로가 안 돌렸다).

   이 도우미는 **찾는 것이 보일 때까지 '다음'을 누른다.** 단계가 더 늘어도 안 깨진다.
   ⚠️ 중간 단계에 반드시 채워야 하는 칸이 있으면 이 도우미로 건너뛰면 안 된다 —
      지금 건너뛰는 단계(특별자격·보유 장학금)는 체크박스뿐이라 비워도 넘어간다. */
const fs = require('fs');
const path = require('path');

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

/* ── ② 재고 있는 서버가 **내 워크트리**인지 확인한다 (2026-08-30 신설) ──

   🔴 **PORT 를 읽는 것만으로는 안 막힌다.** 2026-08-29 에 포트 박기를 걷어내고
      `PORT` 를 먼저 보게 고쳤는데, **바로 다음 날 같은 사고가 또 났다** — PORT 를 안 주면
      기본값 8123 으로 가고 거기엔 다른 워크트리가 8월 29일부터 띄워 둔 서버가 살아 있었다.
      그 서버의 옛 app.js 에는 되돌아가기가 없어 `verify-sheet-back.js` 가 빨간불이었고,
      이 워크트리의 app.js 는 **한 번도 실행되지 않았다.** 반대 방향(가짜 초록불)이
      8/29 `drive.js` 의 `ERRORS: none` 두 번이다 — 둘 다 판정이 거짓이 된다.

   그래서 **읽어 보고 다르면 멈춘다.** 서버가 내주는 app.js 가 디스크의 app.js 와 한 글자라도
   다르면 남의 코드다. 픽스처는 전부 `page.route` 로 주입하므로(verify-forms-data) 이 파일이
   정상적으로 달라지는 경우는 없다. */
async function assertOwnServer(port, file = 'app.js') {
  const mine = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  /* ⚠️ 시한을 걸어야 한다 — 응답 없는 서버를 만나면 fetch 는 **영영 기다린다**(실측).
     예전엔 page.goto 의 30초 시한이 대신 끊어 줬으므로, 시한이 없으면 이 관문이
     오히려 검사를 매달아 놓는 셈이 된다. */
  const served = await fetch(`http://localhost:${port}/${file}`, { signal: AbortSignal.timeout(10000) })
    .then((r) => r.text()).catch(() => null);
  if (served === null) {
    console.error(`FAIL localhost:${port} 에서 앱을 받지 못했습니다 (서버가 없거나 응답하지 않습니다).\n     이 워크트리에서 앱을 띄우고 PORT=<그 포트> 로 주세요.`);
    process.exit(1);
  }
  if (served !== mine) {
    console.error(`FAIL localhost:${port} 는 **다른 워크트리**를 서빙 중입니다 (${file} 가 디스크와 다릅니다).\n`
      + `     여기서 잰 결과는 내 코드의 판정이 아닙니다 — 이 워크트리에서 앱을 띄우고 PORT=<그 포트> 로 주세요.`);
    process.exit(1);
  }
}

module.exports = { nextUntil, assertOwnServer };
