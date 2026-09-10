# 첫 실행 화면 · 이어보기 시안 (원본)

설계 문서는 `docs/designs/first-run-and-resume.md` 다. 여기 있는 것은 그 문서의 **그림**이다.

올려 둔 시안(개발자가 눈으로 보는 곳):
https://claude.ai/code/artifact/2d324103-60bf-4758-a279-bb64efd6abae

## 무엇이 들어 있나

| 파일 | 무엇 |
|---|---|
| `Main.dc.html` | **눌러 볼 수 있는 시안** — 앱을 껐다 켜 보는 판. 5분 뒤 / 5시간 뒤 / 알림으로 열기를 눌러 비교한다 |
| `Before.dc.html` | 고치기 전 지금 무슨 일이 일어나는가 (2026-09-09 실측) |
| `Boot` `Welcome` `Resume1` `Resume2` `Resume3` `Expired` | 화면 여섯 장 (390×844) |
| `canvas.json` | 화면 배치·쪽 나눔 |

🔴 **`canvas.json` 의 `launch` 를 `canvas` 로 되돌리지 말 것** (2026-09-09 개발자 지적 "버튼이 안눌려"):
캔버스 판에서는 아트보드가 **'고르기' 모드**라 눌러도 아무 일이 안 일어난다 —
제목 옆 **▶(Play interactive artboard)** 를 눌러야 살아난다. 코드는 멀쩡한데 안 눌리는 것처럼 보인다.
`{"view": "focused", "file": "Main.dc.html"}` 으로 열면 **▶ 없이 바로 눌린다**(실측).
캔버스로 돌아가는 길은 오른쪽 위 `Back to canvas` 이고, 그 안내를 시안 안에도 적어 뒀다.

색·글꼴·간격은 지어낸 것이 아니라 `style.css` 의 실제 값을 그대로 옮긴 것이다
(`--bg #fefdfc` · `--text #191713` · `--accent #8a6a1f` · 모서리 13/19/27 · 글자 11.5~38px).
🔴 앱의 값을 고치면 여기도 같이 고쳐야 어긋나지 않는다.

⚠️ 글꼴만 다르다 — 앱은 Pretendard 인데 시안이 도는 곳은 그 글꼴을 못 받아
Noto Sans KR 로 대신한다(글자 폭이 아주 조금 다르다).

## 고쳐서 다시 올리는 법

`.dc.html` 을 고친 다음, 한 줄로 다시 만들어 같은 주소에 올린다.
(결과물 `handaejang-first-run.html` 은 2.5MB 라 저장소에 담지 않는다 — `.gitignore`)

```
node <design 스킬 폴더>/seed-canvas.mjs \
  --template <design 스킬 폴더>/payload.template.html \
  --out handaejang-first-run.html \
  --title "한대장 첫 실행 화면과 이어보기" \
  --artboard Main.dc.html --artboard Before.dc.html \
  --artboard Boot.dc.html --artboard Welcome.dc.html \
  --artboard Resume1.dc.html --artboard Resume2.dc.html \
  --artboard Resume3.dc.html --artboard Expired.dc.html \
  --canvas canvas.json
```
