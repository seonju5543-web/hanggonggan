/* 데이터 관문이 실패했을 때, 이번 실행이 '새로 자동 등록한 공고만' 골라서 되돌린다.

   왜 파일 전체를 되돌리지 않는가:
   같은 실행에서 원문 발췌 갱신(extract-excerpts) 같은 정상적인 개선도 함께 일어난다.
   파일을 통째로 되돌리면 멀쩡한 작업까지 버려지고, 다음 실행에서 또 하느라
   같은 일이 매일 반복된다. 그래서 '이번에 새로 들어온 auto:true 항목'만 뺀다.

   🔴 2026-10-04 · 로직은 collector/gate-guard.mjs 로 옮겼다 — 이 파일은 그 `auto` 단계만 부르는 얇은 입구다
      (다른 문서·주석이 이 이름을 가리킨다). 옛 판은 되돌린 뒤 관문을 다시 재지 않아, 원인이 기존 항목 쪽이면
      아무것도 못 하고 저장 단계가 관문 실패 상태의 파일을 커밋했다. 워크플로는 이제 gate-guard 를 직접 부른다.

   실행: node collector/revert-auto.mjs [--report <리포트>]   (= gate-guard --stage auto) */
import { main } from './gate-guard.mjs';

try { process.exit(main(['--stage', 'auto', ...process.argv.slice(2)])); } catch (e) {
  console.error(`::error::자동 등록분 되돌리기가 넘어졌습니다 — ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
