/* ============================================================
   한대장 — 초안/완성 문서 품질 검사 (브라우저·서버·검사 공용 · 순수 함수)
   ------------------------------------------------------------
   🔴 왜 이 파일이 따로 있나 (2026-08-24, '문서 수정하기' 착수):
      품질 검사(qualityCheck)는 원래 server/essay/draft-guard.mjs 안에만 있어
      **서버가 켜져 있을 때만** 학생에게 '고칠 곳'이 보였다. 하지만 설계
      (docs/designs/essay-edit.md ③)는 이것을 **서버 없이도**, 그리고 학생이
      **직접 고친 글에도** 화면 카드로 보여 주라 한다.

      그래서 이 로직을 브라우저에서도 쓸 수 있게 옮겼다. 단 **베끼지 않는다** —
      이 파일이 유일한 원본이고, draft-guard.mjs 가 여기서 가져다 재수출한다.
      (베끼면 "서버는 통과, 화면은 잡는" 갈라짐이 생긴다 — match-engine.js·
       notice-source.mjs 를 한 곳에 모은 것과 같은 이유.)

   경계선 (draft-guard.mjs 와 같다):
      이 검사는 '글이 좋은지'가 아니라 **'제출 가능한 문서의 조건'을 갖췄나**를
      본다. 통과/실패가 아니라 **고칠 곳 목록**을 돌려준다 — 버리지 않고 짚어
      주는 것이 이 기능의 전제(학생이 읽고 고친다)이기 때문이다.

   비용 0원. 정규식·글자 수만 본다. 규칙은 data/essay-playbook.json 한 벌.

   ⚠️ 브라우저에서는 `<script src="essay-quality.js">` 로 전역 함수가 되고,
      Node/esbuild(worker) 에서는 아래 module.exports 로 가져간다. 이 파일에
      `export` 를 쓰면 브라우저 전역이 깨지므로 절대 쓰지 말 것.
   ============================================================ */

/** 문단 수 — 빈 줄로 나뉜 덩어리 */
function essayParaCount(t) {
  return String(t || '').split(/\n\s*\n/).filter((p) => p.trim().length > 20).length || 1;
}

/**
 * 초안/완성 문서 한 칸의 '수준'을 본다. 통과/실패가 아니라 **고칠 곳 목록**을 돌려준다.
 * @param {string} text     검사할 글 (AI 초안이든 학생이 쓴 글이든)
 * @param {object} opt      { target, ownWords: string[], checks: [] }
 * @returns {{warnings: {code:string,msg:string}[]}}
 */
function essayQualityCheck(text, opt = {}) {
  const t = String(text || '').trim();
  const checks = opt.checks || [];
  const warnings = [];
  const add = (c, msg) => { if (!warnings.some((w) => w.code === c)) warnings.push({ code: c, msg }); };
  if (!t) return { warnings };

  for (const c of checks) {
    if (c.type === 'banRegex') {
      let re;
      try { re = new RegExp(c.pattern); } catch { continue; }
      if (re.test(t)) add(c.code, c.msg);
    } else if (c.type === 'banWords') {
      const hit = (c.words || []).find((w) => t.includes(w));
      if (hit) add(c.code, `${c.msg} ("${hit}")`);
    } else if (c.type === 'minParagraphs') {
      const need = Number(c.whenTargetAtLeast) || 0;
      if ((opt.target || 0) >= need && essayParaCount(t) < (c.min || 2)) add(c.code, c.msg);
    } else if (c.type === 'lengthBand') {
      const tg = Number(opt.target) || 0;
      const tol = Number(c.tolerance) || 0.25;
      if (tg && (t.length < tg * (1 - tol) || t.length > tg * (1 + tol))) {
        add(c.code, `${c.msg} (지금 ${t.length}자 · 목표 약 ${tg}자)`);
      }
    } else if (c.type === 'usesOwnMaterial') {
      /* 학생이 **직접 친 글**(칩이 아니라 자유 입력)의 낱말이 본문에 반영됐는가.
         반영이 하나도 없으면 그 글은 누구에게나 맞는 글이 된다 — 개발자가 걱정한 획일화가
         실제로 일어나는 지점이 여기다. */
      /* 🔴 통짜로 비교하면 안 된다 — 학생이 '새벽 아르바이트를 1년간 했어요'라고 적으면
         글에는 '새벽 아르바이트를 이어 왔습니다'처럼 다르게 들어간다. 문장 전체를 찾으면
         거의 언제나 '안 썼다'가 나와 경고가 소음이 된다. **낱말 단위로** 본다. */
      const STOP = new Set(['해요', '했어요', '합니다', '입니다', '있어요', '없어요', '그리고', '하지만', '예요', '이에요']);
      const tokens = (opt.ownWords || [])
        .flatMap((w) => String(w).split(/[\s,·/]+/))
        .map((x) => x.replace(/[.!?]/g, '').trim())
        .filter((x) => x.length >= 2 && !STOP.has(x));
      if (tokens.length) {
        const body = String(t).replace(/\s/g, '');
        /* 조사가 붙어 형태가 달라지므로 앞 2~4자로 본다 ('아르바이트를' → '아르바이트') */
        const used = tokens.some((x) => body.includes(x) || body.includes(x.slice(0, Math.max(2, x.length - 1))));
        if (!used) add(c.code, c.msg);
      }
    }
  }
  return { warnings };
}

/** 이 칸에 줄 규칙 — 전체 공통(*) + 그 종류 전용 */
function essayRulesFor(playbook, kind) {
  const rs = (playbook && playbook.rules) || [];
  return rs.filter((r) => r.kind === '*' || r.kind === kind);
}

/* ── 브라우저: 전역으로 노출 (아래 이름이 essay.js 가 부르는 이름이다) ──
   🔴 draft-guard.mjs 는 이 짧은 이름(qualityCheck·paraCount·rulesFor)으로 가져가
      기존 export 이름을 그대로 유지한다 — worker.js·검사 드라이버는 손대지 않는다. */
const qualityCheck = essayQualityCheck;
const paraCount = essayParaCount;
const rulesFor = essayRulesFor;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { qualityCheck, paraCount, rulesFor,
    essayQualityCheck, essayParaCount, essayRulesFor };
}
