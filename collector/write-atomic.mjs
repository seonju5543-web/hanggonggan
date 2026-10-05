/* 파일을 **통째로 바꿔 끼운다** (2026-10-04 리뷰 R2 · rescue-bodies saveAll) —
   같은 폴더의 임시 파일(<이름>.tmp)에 끝까지 쓴 뒤 이름만 바꾼다. 이름 바꾸기는 한 번에 일어나서,
   쓰는 도중 프로세스가 강제로 죽어도(단계 시한) 원래 파일은 바로 앞 판 그대로 남는다.
   왜: 반쯤 쓴 JSON 이 커밋되면 감사는 그 파일을 읽지 않아 통과하고, 다음 실행은 읽기에 실패해 빈 장부로 시작해
   그동안 모은 것(브라우저 본문 전부)을 잃는다. 남은 .tmp 는 다음 저장이 덮어쓴다(커밋하는 로봇은 파일 이름을 하나씩 add 한다).
   🔴 fs 는 기본 내보내기로 부른다 — 관문(verify/health-gates/bodies.mjs ①)이 fs.writeFileSync 를 가로채 '쓰다가 죽기'를 흉내 낸다. */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function writeFileAtomic(target, text) {
  const p = target instanceof URL ? fileURLToPath(target) : String(target);
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
}

export default writeFileAtomic;
