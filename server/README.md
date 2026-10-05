# 서버 폴더 안내 — 무엇이 켜져 있고 무엇이 꺼져 있나

> 한대장 앱은 파일만 올려 두는 방식(GitHub Pages)이라 서버 없이도 돌아간다.
> 이 폴더의 서버(Cloudflare Workers)는 **앱이 혼자 못 하는 일 하나씩**만 맡는다.
> 켜고 끄는 스위치는 push·chat·essay 는 앱 쪽 설정 파일(`push-config.js`·`chat-config.js`·`essay-config.js`)의 `endpoint` 한 칸이다 —
> 비어 있으면 앱은 그 서버로 요청을 한 건도 보내지 않는다. apply 는 앱 쪽 설정 파일이 아직 없다 — 우리 도메인이 생긴 뒤 연결한다(`server/apply/README.md` ⓪).
>
> 🔴 여기에는 **지금 켜져 있는가**만 적는다. 등록된 폰 수 같은 숫자는 적지 않는다(적으면 반드시 낡는다) —
>    푸시 서버의 숫자는 `/health` 에서, 매일 확인은 `.github/workflows/push-health.yml` 로그에서 본다.

| 폴더 | 하는 일 | 지금 | 켜는 곳 · 자세한 안내 |
|---|---|---|---|
| `push/` | 하루 두 번, 새 공고·마감이 있는 학교의 폰을 내용 없는 푸시로 깨운다(문구는 폰이 만든다) | **켜짐** — 기본 브랜치의 `server/push/*` 가 바뀌면 Cloudflare 의 GitHub 연결 배포(Workers Builds)가 곧바로 올린다 | `push-config.js` · `server/push/README.md` |
| `chat/` | 도우미가 못 알아들은 질문에 맞는 공고·원문 문장을 골라 준다 | 꺼짐 — `chat-config.js` 의 `endpoint` 가 빈칸 | `server/chat/README.md` |
| `essay/` | 학생이 준 재료로 신청서 초안 문장을 만든다(유료 기능) | 꺼짐 — `essay-config.js` 의 `endpoint` 가 빈칸 | `server/essay/README.md` |
| `apply/` | 접수 메일을 우리가 대신 보낸다 — 보내기 전에 받는 주소·마감·자격을 앱과 같은 엔진으로 다시 본다 | 꺼짐 — 우리 도메인이 아직 없다(발신 인증을 걸 곳이 없다). 그동안 앱의 메일 버튼은 `mailto:` 라 학생이 제 메일 앱에서 직접 보낸다 | `server/apply/README.md` (켜는 순서 ⓪~⑥) |
| `mail-worker.js` | 옛 접수 메일 서버 | **쓰지 않음**(2026-09-25) — 받은 주소·본문을 검증 없이 그대로 보내던 꼴이라 `apply/` 로 갈았다. 같은 꼴로 되돌아가지 않도록 문제를 적어 남겨 둔다 | 파일 머리말 |

## 공통 규칙

- 🔴 **열쇠(시크릿)는 저장소에 두지 않는다.** 전부 `npx wrangler secret put …` 또는 Cloudflare 화면에서 넣는다(각 README).
- 🔴 **판정을 서버에서 새로 만들지 않는다.** 앱과 같은 파일(`match-engine.js`·`essay-quality.js`)을 불러 쓴다.
  불러 쓸 때는 기본 가져오기(`import X from '../../파일.js'`)로 — Workers 에는 `node:module` 이 없어
  `createRequire` 꼴은 올리는 순간 넘어진다(관문 `verify/health-gates/servers.mjs` ①).
- ⚠️ 푸시 서버는 예외로 공용 파일을 싣지 않고 필요한 규칙의 **사본**을 둔다 — 빌드 감시 경로가 `server/push/*` 라
  바깥 파일이 바뀌어도 다시 올라가지 않기 때문이다. 사본은 관문(같은 파일)이 원본과 대조한다 —
  ⑥ `titleSeenKey`(폰 장부와 표본 제목으로) · ⑧ 분교 표(`SHARED_BOARD_BRANCH`)·캠퍼스 표식(`TITLE_CAMPUS`·`taggedSchool` — 소스 글자로).
- 서버마다 무료 등급의 한도(요청 한 번에 계산 10밀리초 · 바깥 요청 50건)를 넘지 않게 짰다 — 푸시 서버 머리말 참조.
