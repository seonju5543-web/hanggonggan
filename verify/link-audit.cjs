/* 원문 링크 감사 — 앱이 보여 주는 링크 전부를 주소 꼴로 훑어 **경고**한다 (2026-10-03 신설)
   ─────────────────────────────────────────────────────────────────────────────
   쓰는 곳: verify/audit-data.js(데이터를 바꾼 뒤 · 로봇 저장 직전) — 관문 묶음은 이 함수를 가짜 자료로 잰다.
   🔴 **경고만 낸다(오류 없음).** 실데이터에 기댄 오류는 로봇의 하루치 결과를 통째로 되돌린다 —
      CLAUDE.md 「합칠 때 마감은…」의 사고(2026-10-01 자동 등록 8건 되돌림)와 같은 길이다.
      여기 걸리는 것은 **사람이나 로봇이 고칠 일**의 목록이고, 화면은 이미 source-link.js 가 정직하게 이름 붙인다.
   🔴 주소 꼴만으로 '틀렸다'고 단정하지 않는다 — 꼴은 의심일 뿐, 확정은 원문 링크 확인 로봇
      (collector/link-check.mjs)이 새 탭으로 열어 본 결과(data/link-check.json)다. 문구도 그렇게 쓴다.
   ───────────────────────────────────────────────────────────────────────────── */
const L = require('../source-link.js');

/* 목록 주소에 글 번호만 붙인 꼴은 source-link.js 의 isListPlusId 한 곳(앱·병합 순위와 같은 규칙 — 베끼지 않는다) */
const URL_ENTITY = /&(?:amp|#0*38|#x0*26);/i;

/* sets: [{ ds, items, urlOf(item), idOf(item) }] · checks: data/link-check.json 문서(없으면 null)
   → { warns: [문장], counts } */
function auditLinks(sets, checks) {
  const warns = [];
  const counts = {};
  const bad = (checks && checks.bad) || {};
  for (const s of sets || []) {
    const c = { total: 0, marker: 0, home: 0, entity: 0, listPlusId: 0, scriptAttach: 0, confirmedBad: 0 };
    const ex = { home: [], entity: [], listPlusId: [], scriptAttach: [], confirmedBad: [] };
    for (const it of s.items || []) {
      const raw = s.urlOf(it) || '';
      if (!raw) continue;
      c.total += 1;
      const shape = L.linkShape(raw);
      if (shape === 'marker') c.marker += 1;
      if (shape === 'home' && it.sourceKind !== 'kosaf') { c.home += 1; ex.home.push(s.idOf(it)); }
      if (URL_ENTITY.test(raw)) { c.entity += 1; ex.entity.push(s.idOf(it)); }
      if (shape === 'listid') { c.listPlusId += 1; ex.listPlusId.push(s.idOf(it)); }
      for (const a of it.attachments || []) {
        if (a && a.url && /^\s*javascript:/i.test(a.url)) { c.scriptAttach += 1; ex.scriptAttach.push(s.idOf(it)); break; }
      }
      const b = bad[L.decodeUrlEntities(raw)];
      if (b && L.LINK_BAD.indexOf(b.v) >= 0) { c.confirmedBad += 1; ex.confirmedBad.push(`${s.idOf(it)}(${b.v})`); }
    }
    counts[s.ds] = c;
    const eg = (arr) => arr.slice(0, 3).join(', ') + (arr.length > 3 ? ` 외 ${arr.length - 3}` : '');
    if (c.entity) warns.push(`${s.ds} — 원문 주소에 HTML 기호(&#038;·&amp;)가 남은 것 ${c.entity}건 — 글 번호가 잘려 다른 화면이 열립니다(앱은 되돌려 열지만 데이터를 고쳐 주세요): ${eg(ex.entity)}`);
    if (c.listPlusId) warns.push(`${s.ds} — 게시판 목록 주소에 글 번호만 붙인 꼴 ${c.listPlusId}건 — 서버가 번호를 무시하고 목록을 주는 게시판입니다(가천·고려·서울교대 실측): ${eg(ex.listPlusId)}`);
    if (c.home) warns.push(`${s.ds} — 원문 링크가 사이트 첫 화면 꼴인 것 ${c.home}건 — 앱은 '홈페이지'라고 부릅니다(그 공고 주소를 찾으면 바꿔 주세요): ${eg(ex.home)}`);
    if (c.scriptAttach) warns.push(`${s.ds} — 첨부가 javascript: 내려받기 스크립트인 공고 ${c.scriptAttach}건 — 앱은 링크 없이 이름만 보입니다: ${eg(ex.scriptAttach)}`);
    if (c.confirmedBad) warns.push(`${s.ds} — 원문 링크 확인 로봇이 '그 공고가 아니다'를 확정한 링크 ${c.confirmedBad}건 — 앱은 (확인 필요)·게시판 목록 등으로 부릅니다: ${eg(ex.confirmedBad)}`);
  }
  return { warns, counts };
}

module.exports = { auditLinks, URL_ENTITY };
