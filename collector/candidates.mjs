/* ============================================================
   검수 후보 장부 (2026-08-17 신설)
   ------------------------------------------------------------
   왜 만들었나 — '수집은 했는데 아무도 못 본 공고 747건'

   `data/notices.json`은 **폰이 통째로 내려받는 파일**이라 크기 상한이 있다
   (학교 수 × 15건, 학교당 최대 40건 — `url-key.mjs`의 capNotices).
   학교가 41곳이 되면서 이 상한이 실제로 물려, 바쁜 학교 34곳이 **정확히 16건**에서
   잘리고 있었다. 문제는 잘린 공고가 `seen.json`에는 '봤다'로 남는다는 것 —
   **다시 수집되지 않는데 어디에도 남아 있지 않다.** 2026-08-17 실측 747건.

   그게 왜 나쁜가: 앱 피드는 어차피 학교당 8칸이라 학생 화면에는 티가 안 난다.
   진짜 손해는 **정식 등록 후보 발굴**이다. `auto-register.mjs`와
   `verify/list-unregistered.js`가 보는 것이 notices.json이라, 잘린 공고는
   매칭 카드·양식 지원의 후보가 될 기회를 **한 번도 못 갖고** 사라진다.
   이 앱의 핵심 가치가 그 경로에 있으므로 조용한 유실 중 가장 비싼 유실이다.

   해법: 폰이 받는 파일과 사람이 검수하는 기록을 **분리한다.**
   이 파일은 저장소에만 있고 앱이 fetch하지 않으므로 크기 제한이 없다.
   그래서 상한을 낮춰 잡아도 후보는 하나도 잃지 않는다.

   ⚠️ 이 파일을 `data/` 밑에 두지 말 것 — 거기 두면 나중에 누가 앱에서 받게 만들기
      쉽고, 그 순간 폰이 1MB짜리 파일을 받게 된다. 앱이 받는 것은 data/notices.json 하나다.
   ============================================================ */
import fs from 'node:fs';
import { urlKey, preferNotice } from './url-key.mjs';

const HERE = new URL('.', import.meta.url);
export const CANDIDATES_PATH = new URL('candidates.json', HERE);

/* 공고가 후보 장부에 머무는 기간 — 실시간 공고·seen.json과 같은 60일.
   같은 값을 쓰는 이유: 여기만 길면 seen에서 지워진 공고가 되살아나 중복이 생기고,
   여기만 짧으면 아직 유효한 공고가 검수 전에 사라진다. */
export const KEEP_DAYS = 60;

export function loadCandidates(p = CANDIDATES_PATH) {
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(d.items) ? d : { updatedAt: null, items: [] };
  } catch { return { updatedAt: null, items: [] }; }
}

/* 새로 모은 공고를 장부에 얹는다.
   - 같은 공고(정규화 주소가 같음)는 **정보가 더 많은 쪽**을 남긴다(preferNotice —
     수집기·중복 제거와 같은 규칙. 갈라지면 마감·첨부가 있는 판을 버리게 된다).
   - 60일 지난 것은 떨군다. 상한은 없다 — 이 파일은 폰이 안 받는다. */
export function mergeCandidates(prev, fresh, today = new Date()) {
  const cutoff = new Date(today.getTime() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  const byKey = new Map();
  for (const n of [...(fresh || []), ...(prev || [])]) {
    if (!n || !n.url) continue;
    if ((n.foundAt || '9999') < cutoff) continue;
    const k = urlKey(n.url);
    const cur = byKey.get(k);
    byKey.set(k, cur ? preferNotice(cur, n) : n);
  }
  /* 순서를 고정한다 — 이게 없으면 매 실행 항목 순서가 뒤바뀌어, 내용이 거의 같은데도
     git이 파일 전체를 새로 저장한다(1MB × 하루 2회 = 저장소가 빠르게 불어난다).
     수집일 내림차순 + 주소 순으로 못 박아 두면 실행 사이 차이가 '새로 추가된 몇 줄'뿐이라
     git이 그 차이만 저장한다. 사람이 파일을 열어 볼 때 최신순인 것도 덤. */
  return [...byKey.values()].sort((a, b) => {
    const d = String(b.foundAt || '').localeCompare(String(a.foundAt || ''));
    return d || urlKey(a.url).localeCompare(urlKey(b.url));
  });
}

export function saveCandidates(items, p = CANDIDATES_PATH, today = new Date()) {
  const doc = {
    /* 이 파일이 무엇인지 파일 안에도 적어 둔다 — 저장소를 처음 보는 사람이
       'notices.json과 뭐가 다른가'를 바로 알 수 있어야 한다. */
    note: '검수 후보 전량 기록 (앱이 받지 않는 파일). data/notices.json은 폰이 받는 파일이라 상한이 있고, 여기에는 상한이 없다. 자세한 경위는 collector/candidates.mjs 첫머리 주석.',
    updatedAt: new Date(today.getTime() + 9 * 3600000).toISOString().slice(0, 10),
    count: items.length,
    items,
  };
  fs.writeFileSync(p, JSON.stringify(doc, null, 1));
  return doc;
}

/* 검수 도구가 볼 목록 — 후보 장부가 있으면 그것, 없으면 앱 파일로 물러난다.
   (장부가 생기기 전에 만들어진 도구도 그대로 돌아가게 하려는 것) */
export function reviewPool(noticesItems, p = CANDIDATES_PATH) {
  const c = loadCandidates(p);
  return c.items.length ? c.items : (noticesItems || []);
}
