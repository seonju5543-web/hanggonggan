const { chromium } = require('playwright-core');
const { assertOwnServer } = require('./onboard-helper.js');
const PORT = process.env.PORT || 8123;   // 워크트리마다 서버 포트가 다르다 — 박아 두면 남의 코드를 잰다
const SHOT = (n) => `${__dirname}/shot-${n}.png`;

/* 앱에서 '아직 마감되지 않은 + 양식이 연결된' 공고를 스스로 찾아 질문 → 문서 생성까지 구동한다.
   대상 공고를 코드에 박아두면 그 공고가 마감되는 순간 검증이 저절로 깨지므로(2026-08-01 조병두),
   양식 종류와 무관하게 굴러가도록 만들었다: 빈 칸은 아무 값으로 채우고 체크는 첫 항목을 고른다. */
/* 알림 동의 시트는 온보딩 **2.9초 뒤**에 뜬다(app.js). 1.3초만 기다리고 넘어가면
   검사 도중에 뒤늦게 떠서 화면을 덮고, 그때부터 모든 클릭이 막힌다 —
   이 드라이버가 오래 빨간불이던 진짜 원인이다(CLAUDE.md 14차 세션 기록).
   그래서 **뜰 때까지 기다렸다가** 치운다. verify-chat.js와 같은 방식. */
async function dismissNotify(page) {
  await page.waitForSelector('#notify-sheet:not([hidden])', { timeout: 6000 }).catch(() => {});
  const later = await page.$('#btn-nf-later');
  if (later) await later.click().catch(() => {});
  else await page.keyboard.press('Escape');
  await page.waitForSelector('#notify-sheet[hidden]', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function driveAnyLiveForm(page) {
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(500);
  /* 🔴 **후보를 하나만 보고 포기하지 말 것** (2026-09-15 수리).
     예전엔 `formId + 마감 전` 으로 거른 첫 항목(`live[0]`) 하나만 집었다. 그런데 그 조건은
     **학생 화면에 그 카드가 실제로 뜨는가**를 안 본다 — 마감일이 없는 공고는 60일 규칙
     (`notStale`)으로 탐색 목록에서 내려가므로, 목록에 없는 공고를 집어 들고 `!card` 로
     즉시 실패했다. 2026-09-15에 실제로 그렇게 깨졌다: `reg-hi-jeju`(목록에 없음)를 집고
     포기했는데, 같은 조건을 만족하면서 **목록에 있는 `reg-dongsan`** 은 시도도 안 했다.
     지금은 **화면에 실제로 그려진 카드**에서 고르고(그게 앱의 진짜 판정이다),
     하나가 안 되면 다음 후보로 넘어간다. 데이터가 바뀌어도 안 깨진다.
     CLAUDE.md: 드라이버는 앱의 evaluate·dday 를 그대로 쓰고, 검증 대상을 박아 두지 않는다. */
  const ids = await page.evaluate(() => [...document.querySelectorAll('#explore-list [data-detail]')]
    .map((el) => el.dataset.detail)
    .filter((id) => {
      const s = (typeof registeredList !== 'undefined' ? registeredList : []).find((x) => x.id === id);
      return s && s.formId && FORM_TEMPLATES[s.formId];
    }));
  if (!ids.length) return { id: null, ok: false };
  const tried = [];
  for (const id of ids) {
    /* 🔴 **예외도 '다음 후보'다** (2026-09-15 코드 리뷰). `return` 으로 넘어가는 길은
       셋뿐이고(카드 없음·버튼 잠김·문서 비었다) 나머지 세 자리는 waitForSelector 의
       throw 다. 감싸지 않으면 첫 후보가 **느리게** 실패하는 순간 뒤 후보는 시도조차
       못 한다 — 이번에 고치려던 증상이 모양만 바꿔 남는다. */
    const r = await driveOneForm(page, id).catch((e) => ({ id, ok: false, why: String(e.message || e).split('\n')[0].slice(0, 80) }));
    if (r.ok) return r;
    tried.push(`${id}(${r.why})`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);   /* 시트 퇴장 0.22s — 같은 파일의 다른 자리와 맞춘다 */
  }
  return { id: tried.join(', '), ok: false };
}

/* 후보 하나를 실제로 끝까지 몰아 본다 — 왜 실패했는지까지 돌려준다(조용한 실패 금지) */
async function driveOneForm(page, id) {
  const card = await page.$(`#explore-list [data-detail="${id}"]`);
  if (!card) return { id, ok: false, why: '카드 없음' };
  await card.click();
  await page.waitForSelector('#detail-sheet.show', { timeout: 8000 });   /* 기본 30초는 순회를 통째로 잡아먹는다 */
  await page.waitForTimeout(300);
  if (await page.$eval('#btn-apply-one', (el) => el.disabled)) return { id, ok: false, why: '신청 버튼 잠김' };
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  /* 빈 칸 채우기 — 자동 채움된 칸은 건드리지 않는다 */
  for (const inp of await page.$$('.form-q input[type="text"], .form-q textarea')) {
    if (!(await inp.inputValue())) await inp.fill('검증 입력');
  }
  for (const grp of await page.$$('.fq-checks')) {
    const chip = await grp.$('.chip');
    if (chip) await chip.click();
  }
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  const ok = doc.includes('검증 입력') || doc.length > 200;
  return { id, ok, why: ok ? '' : '문서가 비었다' };
}

(async () => {
  /* 🔴 재기 전에 **이 서버가 내 앱인지** 확인한다 — 아니면 여기서 멈춘다.
     이 저장소는 작업 폴더를 여러 개 두고 쓰는데, 8123 에 다른 폴더의 서버가 떠 있으면
     그 옛 앱을 재고도 아무도 모른다(빨간불이든 **가짜 초록불이든**). 규칙은 onboard-helper 한 곳. */
  await assertOwnServer(PORT);
  const browser = await chromium.launch({ executablePath: (process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome') });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.click('.onboard-step[data-step="0"] [data-next]');

  // 성균관대 프로필 (3학년 — 조병두 자격)
  await page.fill('#in-school', '성균관');
  await page.waitForTimeout(200);
  await page.click('.ac-list:not([hidden]) .ac-item');
  console.log('school:', await page.inputValue('#in-school'));
  await page.click('#in-track .chip[data-value="engineering"]');
  await page.fill('#in-major', '소프트웨어학과');
  await page.fill('#in-name', '김성균');
  await page.click('#in-year .chip[data-value="3"]');
  await page.click('#in-status .chip[data-value="재학"]');
  await page.click('.onboard-step[data-step="1"] [data-next]');
  await page.fill('#in-gpa', '4.0');
  await page.selectOption('#in-bracket', '4');
  await page.selectOption('#in-region', '서울');
  await page.click('.onboard-step[data-step="2"] [data-next]');
  /* 🔴 단계 번호를 박지 말 것 (2026-08-29 — 실제로 이것 때문에 이 검사가 죽어 있었다).
     공동개발자가 4단계(지금 받고 있는 장학금)를 끼우자 서류 칸이 뒤로 밀렸고,
     `data-step="3"` 만 누르던 이 드라이버는 `#in-sid` 를 못 찾아 30초 만에 시간초과로
     통째로 실패했다. verify-essay-ui.js 가 2026-08-24에 똑같이 죽었고 그때 쓴 처방이
     이것이다 — **서류 칸이 보일 때까지 '다음'을 누른다.** 단계가 더 늘어도 안 깨진다. */
  for (let i = 0; i < 5 && !(await page.isVisible('#in-sid')); i++) {
    await page.click('.onboard-step:not([hidden]) [data-next]');
    await page.waitForTimeout(150);
  }
  await page.fill('#in-sid', '2023310123');
  await page.fill('#in-phone', '010-1234-5678');
  await page.fill('#in-email', 'test@skku.edu');
  await page.click('#btn-finish-onboard');
  await page.waitForSelector('#screen-home:not([hidden])');
  await dismissNotify(page);

  // 탐색 탭: 정식 등록 공고 (성균관 6건) 노출 확인
  await page.click('.nav-item[data-nav="explore"]');
  await page.waitForTimeout(600);
  const cards = await page.$$eval('#explore-list .sch-card .sch-name', (els) => els.map((e) => e.textContent));
  const regCards = cards.filter((c) => /조병두|삼일|보건|산학협동|청년창업농/.test(c));
  console.log('explore total cards:', cards.length, '| SKKU registered visible:', regCards.length);
  regCards.forEach((c) => console.log('  •', c));
  // 광운대 '학교한정' 공고가 새어나오지 않는지 검사 (호반은 전국 승격돼 정상 노출 → 카나리에서 제외)
  const kwLeak = cards.filter((c) => /보훈장학금 신청|종근당고촌|화도·동해/.test(c));
  console.log('타 학교(광운 학교한정) 공고 미노출 확인:', kwLeak.length === 0 ? 'OK' : 'LEAK! ' + kwLeak);
  await page.screenshot({ path: SHOT('30-explore-registered') });

  // 조병두 상세: 첨부 양식 링크 + 마감 배지 (홈 마감임박 목록에도 같은 카드가 있어 explore로 범위 한정)
  // 마감이 한참 지난 공고는 목록에서 지워지므로(2026-08-02 마감 36건 정리 때 실제로 사라졌다)
  // 카드가 없으면 이 구간을 통째로 건너뛰고 마감 전 양식 공고로 같은 경로를 구동한다.
  // 검증 대상을 코드에 박아 두면 데이터가 정리될 때마다 검사가 깨진다 — README의 규칙과 같은 이유다.
  /* 실시간 피드에서 등록 공고 중복 제거 확인.
     🔴 **아래 조병두 분기보다 위에 둔다** (2026-09-17 코드 리뷰). 예전에는 파일 맨 끝에
        있었는데, 조병두가 마감돼 목록에서 내려간 뒤로 그 분기가 `process.exit` 로 먼저
        끝나서 이 검사가 **한 번도 실행되지 않았다**(오늘 실측: 한 줄도 안 찍혔다).
     🔴 **피드는 이제 홈에 있다** (2026-09-18 개발자 지시로 '교내' 칸에서 옮겼다 · 코드 리뷰가
        잡았다). 그때까지 이 블록은 '교내' 칸을 눌러 피드를 띄웠는데, 그 누름이 **아무 일도
        안 하게** 되면서 `#live-notices` 를 앞 화면이 남긴 상태로 재고 있었다.
     🔴 **비어 있으면 로그만 찍지 않고 실패시킨다** — 0건이면 이 줄은 무엇을 재든
        '제거됨 OK' 라고 답한다(중복이 돌아와도 초록불). 조용한 통과가 이 검사의 사고 유형이다. */
  {
    /* 🔴 **픽스처를 스스로 주입한다** (2026-09-18). 예전에는 '조병두' 라는 공고 이름을 박아
       두고 피드에 그 이름이 없으면 '제거됨 OK' 라고 답했는데 —
         ① 조병두는 이제 등록 목록에 아예 없고(마감돼 내려갔다),
         ② 이 드라이버의 학교(성균관대)는 **수집 대상이 아니라** 피드가 늘 0건이다.
       그래서 이 줄은 오랫동안 **무엇을 재든 통과**였다. 지금은 지금 등록된 공고 하나의
       주소를 그대로 쓴 가짜 피드 항목과, 등록된 적 없는 항목을 **함께 심어** 앞의 것만
       사라지는지 본다 — 학교·데이터가 바뀌어도 안 깨진다. */
    await page.click('.nav-item[data-nav="home"]').catch(() => {});
    await page.waitForSelector('#screen-home:not([hidden])', { timeout: 5000 }).catch(() => {});
    const dedup = await page.evaluate(() => {
      const p = state.profile;
      const reg = (registeredList || []).find((s) => s.sourceUrl && /^https?:/.test(s.sourceUrl));
      if (!reg) return { skip: '등록 공고에 원문 주소가 하나도 없다' };
      /* 🔴 **수집 대상 학교로 잠깐 바꿔서 잰다** — 피드는 `noticeForProfile` 이 거르는데,
         그 함수는 `SERVED_SCHOOLS` 밖 학교(이 드라이버의 성균관대)의 글을 **전부 버린다**.
         안 바꾸면 심어 둔 둘이 같이 사라져 '너무 많이 지운다'로 잘못 걸린다(실측). */
      const served = (typeof SERVED_SCHOOLS !== 'undefined' && SERVED_SCHOOLS[0]) || p.school;
      const keepSchool = p.school, keepCampus = p.campus;
      p.school = served; p.campus = '';
      const keep = liveNotices;
      liveNotices = { updatedAt: '2026-09-18', items: [
        { title: '검사용 · 이미 등록된 공고', school: served, campus: '',
          url: reg.sourceUrl, attachments: [], foundAt: '2026-09-18' },
        { title: '검사용 · 등록된 적 없는 공고', school: served, campus: '',
          url: 'https://example.ac.kr/notice/never-registered', attachments: [], foundAt: '2026-09-18' },
      ] };
      renderHome();
      const names = [...document.querySelectorAll('#screen-home #live-notices .notice-card .sch-name')]
        .map((e) => e.textContent);
      liveNotices = keep; p.school = keepSchool; p.campus = keepCampus; renderHome();
      return { 등록된것: names.some((t) => /이미 등록된/.test(t)),
        안등록된것: names.some((t) => /등록된 적 없는/.test(t)), 쓴공고: reg.name, 학교: served };
    });
    if (dedup.skip) errors.push('중복 판정을 못 했습니다 — ' + dedup.skip);
    else {
      console.log('중복 제거 — 대조에 쓴 등록 공고:', dedup.쓴공고);
      if (dedup.등록된것) errors.push('등록 공고가 피드에서 제거되지 않았습니다(중복 노출)');
      if (!dedup.안등록된것) errors.push('등록된 적 없는 공고까지 피드에서 사라졌습니다(너무 많이 지운다)');
      console.log('  이미 등록된 것 사라짐:', !dedup.등록된것, '| 안 등록된 것 남음:', dedup.안등록된것);
    }
    /* 🔴 아래 검사들은 탐색 목록에서 카드를 찾는다 — 화면을 되돌린다 */
    await page.click('.nav-item[data-nav="explore"]').catch(() => {});
    await page.waitForSelector('#screen-explore:not([hidden])', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(400);
  }

  if (!(await page.$('#explore-list [data-detail="reg-skku-jobyungdu"]'))) {
    console.log('조병두 구간 건너뜀 — 마감돼 목록에서 내려간 공고입니다. 마감 전 양식 공고로 대체 구동합니다.');
    const drove = await driveAnyLiveForm(page);
    console.log('대체 구동(마감 전 양식 공고):', drove.id || '없음', '| 문서 생성:', drove.ok);
    if (!drove.ok) errors.push('마감 전 양식 공고를 하나도 구동하지 못했습니다');
    await page.screenshot({ path: SHOT('32-live-form-doc') });
    console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
    await browser.close();
    process.exit(errors.length ? 1 : 0);
  }
  await page.click('#explore-list [data-detail="reg-skku-jobyungdu"]');
  await page.waitForSelector('#detail-sheet.show');
  await page.waitForTimeout(400);
  const badge = await page.$eval('#detail-sheet .badge-dday', (el) => el.textContent);
  const atts = await page.$$eval('#detail-sheet .doc-list a', (els) => els.map((e) => e.textContent.slice(0, 40)));
  console.log('조병두 D-day:', badge, '| 원본 첨부 링크:', atts.length);
  atts.forEach((a) => console.log('  📎', a));
  await page.screenshot({ path: SHOT('31-jobyungdu-detail') });

  // 원클릭 신청 준비 → 양식 질문 화면
  // 마감된 공고는 신청 버튼이 잠겨 있어 클릭하면 30초 타임아웃으로 깨진다 (README '마감된 공고를
  // 대상으로 삼지 말 것'). 조병두는 2026-07-31 마감 — 마감이면 이 구간은 정직하게 건너뛰고,
  // 대신 아직 마감 전인 양식 공고를 앱에서 스스로 찾아 같은 경로(질문 → 문서 생성)를 구동한다.
  // 그래서 공고가 마감돼도 '양식 작성이 되는가'라는 검사 자체는 사라지지 않는다. (2026-08-01)
  const applyLocked = await page.$eval('#btn-apply-one', (el) => el.disabled);
  if (applyLocked) {
    console.log('조병두 양식 UI 구동 건너뜀 — 이 공고는 마감됨(신청 버튼 잠김). 마감 전 양식 공고로 대체 구동합니다.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const drove = await driveAnyLiveForm(page);
    console.log('대체 구동(마감 전 양식 공고):', drove.id || '없음', '| 문서 생성:', drove.ok);
    if (!drove.ok) errors.push('마감 전 양식 공고를 하나도 구동하지 못했습니다');
    await page.screenshot({ path: SHOT('32-live-form-doc') });
  } else {
  await page.click('#btn-apply-one');
  await page.waitForSelector('#btn-ff-generate', { timeout: 8000 });
  const autoName = await page.inputValue('#fq-nameLine');
  const autoSid = await page.inputValue('#fq-studentId');
  const autoBracket = await page.inputValue('#fq-bracket');
  console.log('양식 자동 채움 — 성명:', autoName, '| 학번:', autoSid, '| 소득분위:', autoBracket);
  await page.fill('#fq-birth', '2004. 3. 15.');
  await page.click('.fq-checks[data-f="gender"] .chip:first-child');
  await page.click('.fq-checks[data-f="renew"] .chip:first-child');
  await page.click('.fq-checks[data-f="applyType"] .chip:first-child');
  await page.screenshot({ path: SHOT('32-jobyungdu-questions') });
  await page.click('#btn-ff-generate');
  await page.waitForSelector('.form-doc', { timeout: 8000 });
  const doc = await page.$eval('.form-doc', (el) => el.textContent);
  console.log('문서 제목 포함:', doc.includes('조병두 장학금 신청서'));
  console.log('체크 표시(☑ 신규):', doc.includes('☑ 신규'));
  console.log('신청유형 체크:', doc.includes('☑ ① 등록금 전액'));
  console.log('자필 서약문 포함:', doc.includes('받은 만큼 후배들에게 돌려주라'));
  console.log('학생처장 귀하:', doc.includes('학생처장 귀하'));
  console.log('별첨 확인서 포함:', doc.includes('타장학금 수혜 여부 확인서'));
  await page.screenshot({ path: SHOT('33-jobyungdu-doc'), fullPage: false });
  }

  console.log('ERRORS:', errors.length ? errors.join(' ; ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
