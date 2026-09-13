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
  /* 🔴 **'못 돌렸다'를 '실패'라고 부르지 않는다** (2026-09-13).
     예전엔 서버가 없어 검사를 시작도 못 했을 때 `FAIL` 이라고 적었다. 그러면
     ① 사람이 '검사가 깨졌다'고 읽고 ② 스킬 장부 훅(skill-ledger.sh)이 그 글자를
     보고 '디버깅 빚'을 쌓아 Stop 관문이 헛걸렸다(실제로 겪었다 — 서버를 띄워
     다시 돌리니 셋 다 통과였다).
     이 저장소가 이미 세운 규칙 그대로다 — '못 읽음'과 '읽었는데 틀림'을 뭉뚱그리지
     말 것(detail-url · 동국대 사례). 종료코드는 1 그대로 두어 CI 는 여전히 막는다 —
     바뀌는 것은 부르는 이름뿐이다. */
  /* ⚠️ 시한을 걸어야 한다 — 응답 없는 서버를 만나면 fetch 는 **영영 기다린다**(실측).
     예전엔 page.goto 의 30초 시한이 대신 끊어 줬으므로, 시한이 없으면 이 관문이
     오히려 검사를 매달아 놓는 셈이 된다. */
  const served = await fetch(`http://localhost:${port}/${file}`, { signal: AbortSignal.timeout(10000) })
    .then((r) => r.text()).catch(() => null);
  if (served === null) {
    console.error(`판정 불가 — localhost:${port} 에서 앱을 받지 못했습니다 (서버가 없거나 응답하지 않습니다).\n     이 워크트리에서 앱을 띄우고 PORT=<그 포트> 로 주세요.`);
    process.exit(1);
  }
  if (served !== mine) {
    console.error(`판정 불가 — localhost:${port} 는 **다른 워크트리**를 서빙 중입니다 (${file} 가 디스크와 다릅니다).\n`
      + `     여기서 잰 결과는 내 코드의 판정이 아닙니다 — 이 워크트리에서 앱을 띄우고 PORT=<그 포트> 로 주세요.`);
    process.exit(1);
  }
}

/* ── ③ 알림 동의 시트를 치운다 (2026-09-07 신설) ──

   🔴 이 시트는 온보딩이 끝나고 **2.9초 뒤에** 뜬다(app.js). 그래서 "온보딩 직후에 한 번
      보고 없으면 넘어간다"는 방식은 안 된다 — 검사가 도는 **도중에** 뒤늦게 떠서 화면을
      덮고, 그때부터 클릭이 전부 막힌다. 오류 문구는 늘
      `<div id="notify-backdrop"> intercepts pointer events` 다.
   🔴 이 유형은 **세 번째 재발**이다: verify-registered(14차) · verify-chat ·
      그리고 2026-09-07 verify-source-links. 앞의 둘은 각자 제 파일 안에서 고쳤는데,
      사본이 일곱 벌이 되는 바람에 **못 받은 드라이버가 남아 있었다.** 새 드라이버는
      제 손으로 짜지 말고 이것을 부른다.
   ⚠️ 시트가 안 뜨는 경우(이미 물어본 판)도 정상이라 기다림은 전부 조용히 넘긴다 —
      여기서 던지면 멀쩡한 검사가 죽는다.

   남은 일: 이미 제 사본을 가진 드라이버 일곱(chat·apps-manage·essay-ui·explore-sort·
   registered·fit-badge·kosaf)은 아직 각자 것을 쓴다. 손볼 때 이쪽으로 옮길 것. */
/* 🔴 **시트가 안 떴으면 아무것도 누르지 않는다** (2026-09-09에 잡은 잠재 버그).
   예전에는 `#btn-nf-later` 가 없으면 무조건 Escape 를 눌렀는데, 동의 시트가 아예 안 뜬 판
   (프로필을 심어 둔 검사가 그렇다)에서는 그 Escape 가 **열려 있던 공고 상세 시트를 닫았다**
   — app.js 의 Escape 처리가 `notify-sheet` 가 닫혀 있으면 `detail-sheet` 를 닫기 때문이다.
   verify-resume 이 되살린 신청서를 이 Escape 가 도로 닫아 빨간불이 났다. 안 뜨면 할 일이 없다. */
async function dismissNotify(page) {
  const up = await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 })
    .then(() => true).catch(() => false);
  if (!up) return;
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape').catch(() => {});
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
}

/* 🔴 **글꼴이 안 실린 환경에서는 '폭' 검사를 믿지 말 것** (2026-09-13 · 내가 직접 밟은 함정).
   이 앱의 글꼴(Pretendard)은 `cdn.jsdelivr.net` 에서 온다. 바깥이 막힌 샌드박스에서는
   그 요청이 `ERR_TUNNEL_CONNECTION_FAILED` 로 죽고 한글이 다른 글꼴로 **더 넓게** 그려진다.
   그러면 폭에 민감한 항목만 거짓으로 빨간불이 된다 — 실측:
     · verify-explore-sort '360px 잘린 칩이 없다'  → 샌드박스 ❌ · CI ✅
     · verify-interactions '마스코트가 마지막 줄을 가리지 않는다' 2건 → 샌드박스 ❌ · CI ✅
   나는 이걸 모르고 **"관문 3항목이 main 에서 빨간불"이라고 개발자에게 보고했다.** 틀렸다.
   CI 로그를 보니 그 셋은 초록불이었고 진짜 빨간불은 다른 한 건이었다.

   🔴 **빨간불을 초록으로 바꾸지 않는다** — 이 저장소가 사고로 배운 금지 사항이다
      ("검사만 고치고 화면을 바꾸지 말 것"). 대신 **왜 그런지 화면에 크게 적어 준다.**
      다음 사람이 없는 버그를 쫓지 않게 하는 것이 목적이고, 판정은 그대로 둔다.
   ⚠️ CI 에서는 글꼴이 실리므로 이 문구가 아예 안 뜬다(빈 문자열). 그래서 CI 의 판정에는
      아무 영향이 없다 — 관문을 무르게 하는 장치가 아니다. */
async function webfontBanner(page) {
  const loaded = await page.evaluate(
    () => (document.fonts ? document.fonts.size : -1),
  ).catch(() => -1);
  if (loaded !== 0) return '';
  return [
    '',
    '⚠️  이 환경에는 **웹 글꼴이 한 벌도 안 실렸습니다** (document.fonts.size === 0).',
    '    Pretendard 가 cdn.jsdelivr.net 에서 오는데 바깥이 막혀 있습니다.',
    '    한글이 더 넓은 대체 글꼴로 그려지므로 **폭에 민감한 항목은 거짓으로 빨간불이 날 수 있습니다**',
    '    (칩 잘림 · 마스코트 가림 등). 같은 항목이 GitHub Actions 에서는 초록불일 수 있습니다.',
    '    🔴 여기 결과만 보고 "화면이 깨졌다"고 단정하지 마세요 — CI 로그를 먼저 보세요.',
    '',
  ].join('\n');
}

module.exports = { nextUntil, assertOwnServer, dismissNotify, webfontBanner };
