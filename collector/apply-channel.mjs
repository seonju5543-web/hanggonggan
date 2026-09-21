/* 신청 채널 판정 — **규칙은 여기 없다.** 원본은 저장소 뿌리의 `apply-channel.js` 하나다.

   왜 껍데기만 남았나 (2026-09-21): 앱(`data.js`)도 같은 판정을 써야 해서 규칙을 브라우저·Node
   겸용 파일로 옮겼다(그 파일 머리말 참조). 조사 로봇 둘(`scan-two-schools.mjs`·
   `classify-two-schools.mjs`)은 이 주소로 import 하고 있어, 고치지 않아도 되게 여기서 다시 내보낸다.

   🔴 여기에 규칙을 도로 적지 말 것 — 그 순간 로봇과 앱이 다른 말을 한다. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const shared = require('../apply-channel.js');

export const METHOD_LINE = shared.METHOD_LINE;
export const NOT_EVIDENCE = shared.NOT_EVIDENCE;
export const classifyChannels = shared.classifyChannels;
