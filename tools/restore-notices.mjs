/* 실시간 공고 장부 복구 — 옛 커밋의 data/notices.json 에서 지금 장부에 없는 글을 되살린다.
   ------------------------------------------------------------------
   왜 있나 — 같은 사고가 나흘에 두 번 났다.
     · 2026-09-30 01:31 일반 수집(run 36652803481)이 브라우저 수집과 같은 때 저장하며 pull --rebase 로
       합집합 병합기(tools/merge-json-union.mjs)를 거쳤고, 병합기에 박혀 있던 '전체 200건' 상한이 장부를
       460 → 200건으로 잘랐다 — 16개교(경희·외대·건국·서울대·성균관·영남·전남·전북·충남·충북·경북·광운·
       명지·서울교대·조선·방통대)가 0건이 됐다. 아무 경보도 울리지 않았다.
     · 2026-10-03 같은 모양으로 339 → 200건. 커밋 b75c58b6 이 병합기 상한을 수집기 함수(capNotices)로 고치고
       그날 분은 손으로 되살렸다 — 그런데 09-30 분은 10-04 까지 아무도 되살리지 않았다(경희 26 → 3건).
     잘린 글은 seen.json 에 '봤다'로 남아 로봇이 다시 담지 않고, 다음 발행이 학교별 파일을 그 장부로 다시
     만들어 학생 화면에서도 사라진다 — 수집도 감사도 전부 초록불인 채로.
   무엇을 하나 — 옛 커밋의 장부를 지금 장부 **뒤에** 붙여 수집기(collector/collect.mjs)와 같은 규칙·같은 **순서**로 정리한다:
     60일 지난 글 제외 → 첨부 항목 제외(isAttachmentEntry) → 같은 글 판정 dedupeNotices(주소·제목·글 번호) →
     서비스 학교만(dropUnserved) → 학교별 파일은 자르기 **전** 목록으로(publishBySchool) → 옛 통짜 파일만 capNotices.
     🔴 거르기가 중복 제거보다 **앞**이어야 한다(리뷰 2026-10-04) — 뒤에 두면 같은 글의 옛 판(60일 지난 것·첨부 주소)이
        주소 순위로 지금 판을 이긴 뒤 걸러져 **지금 글까지 사라진다**(가짜 자료로 재현 · 관문에 그 두 경우가 있다).
     같은 글이 둘이면 preferNotice 가 주소 순위(noticeUrlRank)가 나은 쪽을 고르고, 순위가 같을 때만 앞에 둔 지금 장부가 이긴다 —
     옛 판이 더 나은 주소를 들고 있으면 그쪽이 남는다(publish-notices patchUrlsBySchool 의 '순위를 낮추는 쪽으로는 안 고친다'와 같은 방향).
     규칙은 불러 쓴다 — 베끼면 수집기와 갈라진다(CLAUDE.md 아키텍처 절). 수집기가 내보내지 않는 것 둘(60일 상수 · KST 날짜)만 여기 적었고,
     새 글이 앞에 오도록 날짜로 정렬하는 것은 이 도구가 더한 것이다(수집기는 새 글을 앞에 붙이므로 정렬이 필요 없다).
   하지 않는 것 — seen.json·candidates.json 은 건드리지 않는다(둘 다 그 글을 이미 알고 있다).
   실행: node tools/restore-notices.mjs <커밋> [<커밋>…] [--dry]   예) node tools/restore-notices.mjs 60ce385a 0398c86a
   관문: verify/test-collector.mjs 「실시간 공고 장부 복구」                                                        */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dedupeNotices, capNotices } from '../collector/url-key.mjs';
import { isAttachmentEntry } from '../collector/attachment-link.mjs';
import { publishBySchool, dropUnserved } from '../collector/publish-notices.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const KEEP_DAYS = 60;   // 수집기의 '수집일로부터 60일' 과 같은 날수

/* 지금 장부(current)에 옛 장부들(olds)을 붙여 수집기와 같은 규칙으로 정리한 목록을 돌려준다. 순수 함수 — 관문이 가짜 자료로 돈다. */
export function mergeLedgers(current, olds, { today = new Date() } = {}) {
  const cutoff = new Date(today.getTime() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  /* 수집기와 같은 순서: 거르기(60일 · 첨부) → 중복 제거 → 서비스 학교. 중복 제거를 먼저 하면 걸러질 옛 판이 지금 판을 삼키고 사라진다. */
  const all = [...(current || []), ...(olds || []).flat()];
  const kept = all.filter((n) => (n.foundAt || '9999') >= cutoff && !isAttachmentEntry(n));
  const merged = dedupeNotices(kept);
  /* 새 글이 앞 — 상한(capNotices)이 뒤에서부터 자르므로 순서가 뜻을 가진다. 같은 날짜는 원래 차례 그대로(안정 정렬). */
  return dropUnserved(merged).sort((a, b) => String(b.foundAt || '').localeCompare(String(a.foundAt || '')));
}

function ledgerAt(ref) {
  let text;
  try {
    text = execFileSync('git', ['show', `${ref}:data/notices.json`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`커밋 ${ref} 의 data/notices.json 을 읽지 못했습니다 — ${String(e.stderr || e.message).trim().split('\n')[0]}`);
    console.error('쓰는 법: node tools/restore-notices.mjs <커밋> [<커밋>…] [--dry]   (커밋은 git log -- data/notices.json 에서 고른다)');
    process.exit(2);
  }
  return JSON.parse(text).items || [];
}
const bySchool = (items) => { const b = {}; for (const n of items) b[n.school] = (b[n.school] || 0) + 1; return b; };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const refs = args.filter((a) => !a.startsWith('--'));
  if (!refs.length) { console.error('쓰는 법: node tools/restore-notices.mjs <커밋> [<커밋>…] [--dry]'); process.exit(2); }

  const p = path.join(ROOT, 'data/notices.json');
  const notices = JSON.parse(fs.readFileSync(p, 'utf8'));
  const before = notices.items || [];
  const items = mergeLedgers(before, refs.map(ledgerAt));
  const a = bySchool(before), b = bySchool(items);
  console.log(`장부 ${before.length} → ${items.length}건 (옛 커밋 ${refs.join(', ')} · 학교별 파일은 이 목록 그대로, 옛 통짜 파일은 상한 뒤 ${capNotices(items).length}건)`);
  for (const s of Object.keys({ ...a, ...b }).sort()) if ((a[s] || 0) !== (b[s] || 0)) console.log(`  ${s}: ${a[s] || 0} → ${b[s] || 0}`);
  if (dry) { console.log('(--dry · 파일은 그대로)'); process.exit(0); }

  publishBySchool(items);
  notices.items = capNotices(items);
  notices.updatedAt = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  fs.writeFileSync(p, JSON.stringify(notices, null, 1));
  console.log('data/notices.json · data/notices/*.json 을 다시 썼습니다 — node verify/audit-data.js 로 확인하세요.');
}
