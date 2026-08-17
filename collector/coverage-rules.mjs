/* ============================================================
   누락 감사 규칙 (2026-08-17 신설) — 순수 함수만
   ------------------------------------------------------------
   왜 필요한가: **로봇은 자기가 읽은 것만 안다.** "장학 공고 12건 수집"이 게시판에
   12건이 있어서인지 30건 중 12건만 알아본 것인지, 로봇 자신은 구분할 수 없다.
   그래서 바깥에서 대조하는 장치가 따로 필요하다(개발자 지시, 2026-08-17).

   🔴 이 파일의 존재 이유이자 가장 중요한 설계 원칙:
      **감사는 수집기와 같은 그물을 쓰면 안 된다.**
      같은 `KEYWORDS`·`isMenuEntry`·`isAttachmentEntry`를 쓰면 감사가 수집기와
      구조적으로 같은 판정을 내려 **언제나 "누락 0건"**이 나온다. 맹점을 공유하기 때문이다.
      그러면 감사는 안심시키는 장식이 된다 — 이 저장소가 가장 경계하는 실패 유형
      ('못 읽음'을 '괜찮음'으로 단정하지 말 것)이다.

   그래서 감사는 **일부러 넓고 멍청하게** 읽는다: 장학과 조금이라도 관련될 수 있는
   제목이면 전부 후보로 집는다(거짓 양성은 감사에서 무해하다 — 상한을 재는 것이므로).
   그 다음 우리 데이터에 없는 것만 남기고, **수집기의 어느 규칙이 그것을 버렸는지**
   유형별로 센다. 그래야 '몇 건 누락'이 아니라 '무엇을 고쳐야 하는지'가 나온다.
   ============================================================ */

/* 감사용 넓은 그물 — 수집기의 KEYWORDS보다 의도적으로 훨씬 넓다.
   장학금과 무관한 것이 섞여도 괜찮다. 아래 classifyMiss가 원인별로 갈라 주고,
   사람은 '원인 미상'만 보면 된다. */
export const LOOSE = /장학|학자금|등록금|수업료|면학|학업\s?지원|학비|생활비|장려금|근로|기숙사비|복지\s?지원|교육비|수혜|선발/;

/* 게시판 행 중 '장학 공고일 수도 있는 것'. 길이만 보고 거의 다 통과시킨다. */
export function looseCandidate(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (t.length < 8 || t.length > 160) return false;
  return LOOSE.test(t);
}

/* 제목 대조용 지문 — 게시판 목록의 제목과 우리가 저장한 제목은 부스러기가 다르다
   (행 번호·조회수·새글 표식·괄호). 그래서 기호·공백을 다 떼고 견준다.
   ⚠️ url-key.mjs의 normTitle과 **일부러 따로 둔다**: 저쪽이 바뀌면 감사 판정도 함께
   바뀌어 "규칙을 고쳤더니 누락이 사라졌다"는 착시가 생긴다. 감사는 독립이어야 한다. */
export function fingerprint(title) {
  return String(title || '')
    .replace(/^\d{1,5}\s+/, '')
    .replace(/\s*20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?\s*/g, ' ')
    .replace(/조회\s*\d+/g, ' ')
    .replace(/신규게시글|새글|Attachment|N$/g, ' ')
    .replace(/[^가-힣a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, 60);
}

/* 두 제목이 같은 공고인가 — 짧은 제목이 긴 제목에 들어 있어도 같다고 본다
   (게시판 목록은 제목을 자르는 곳이 있다). 8자 미만은 우연히 겹칠 수 있어 완전 일치만. */
export function sameNotice(a, b) {
  const x = fingerprint(a); const y = fingerprint(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 12 && long.includes(short);
}

/* 게시판에서 본 후보 중 우리 데이터에 없는 것을 고른다 */
export function findMissing(boardTitles, ourTitles) {
  const ours = ourTitles.map(fingerprint).filter(Boolean);
  const ourSet = new Set(ours);
  return boardTitles.filter((t) => {
    const f = fingerprint(t);
    if (!f) return false;
    if (ourSet.has(f)) return false;
    return !ours.some((o) => sameNotice(o, f));
  });
}

/* 누락의 원인을 수집기 규칙에 비추어 가른다.
   deps로 수집기의 실제 함수를 주입받는다 — 여기서 베끼면 수집기 규칙이 바뀔 때
   감사가 옛 규칙으로 판정해 엉뚱한 원인을 댄다. (판정 자체는 감사 몫, 규칙은 수집기 몫) */
export function classifyMiss(title, deps) {
  const { keywords, isMenuEntry, isAttachmentEntry, page } = deps;
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (t.length < 6 || t.length > 140) return '제목 길이 규칙';
  if (!keywords.test(t)) return '키워드 밖';
  if (isMenuEntry(t)) return '메뉴로 걸러짐';
  if (isAttachmentEntry({ title: t, url: '' })) return '첨부 링크로 걸러짐';
  if (page && page > 1) return '2페이지 이후';
  /* 수집기 규칙을 전부 통과하는데도 우리 데이터에 없다 — 이게 진짜 문제다.
     게시판을 그날 못 읽었거나(접속 실패·시한 초과), 클릭 채집이 못 닿았거나,
     상한에 밀렸다는 뜻. 사람이 볼 것은 이 유형 하나다. */
  return '원인 미상';
}

/* 학교 하나의 인식 비율 */
export function coverageOf(boardCount, missingCount) {
  if (!boardCount) return null;                      // 게시판을 못 읽었으면 비율을 말할 수 없다
  return Math.round(((boardCount - missingCount) / boardCount) * 100);
}
