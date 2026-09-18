# 시작 화면 투어링 컷 만들기 (2026-09-18)

정문 사진(`docs/designs/assets/gates/`)을 학교당 2.5초씩 **밀고 들어가며** 이어 붙여 시작 화면 영상을 만든다.
영상 편집 도구 없이 이 저장소와 Chromium·ffmpeg 만으로 된다 — 개발자 노트북이 없어도 샌드박스에서 돈다.

```sh
npm i --no-save playwright-core            # 한 번만 (Chromium 은 CHROME_PATH 로 가리킨다)
pip install imageio-ffmpeg                 # 한 번만 — libx264 가 든 ffmpeg 가 같이 온다
node tools/gate-reel/cut.mjs "khu-1.jpg,hufs-3.jpg,snu-1.jpg" /tmp/cut-A.webm
FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
$FF -y -i /tmp/cut-A.webm -t 9.0 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart -an docs/designs/assets/gates/cuts/start-screen-A.mp4
$FF -y -sseof -0.2 -i docs/designs/assets/gates/cuts/start-screen-A.mp4 -frames:v 1 -update 1 /tmp/poster-A.png   # 영상이 못 뜰 때 보일 정지 화면
```

- 한 장면 = 0.35초 페이드인 · 1.00→1.10 확대 · 0.35초 페이드아웃. 마지막 장면은 멈춘 채 남는다(앱 원칙: 한 번 재생 후 정지).
- 카피·버튼 자리는 ui bowl 기준(카피 윗선 522px · 버튼 690px · 스크림 아래 45%) — `reel.html` 한 곳.
- **사진별 초점**(`reel.html` 의 `FOCUS`) — 가로 사진을 세로로 자를 때 정문이 화면에 남는 자리(가로% 세로%).
  눈으로 확인한 6장만 적혀 있고 나머지는 기본값(50% 45%). 새 사진을 쓰면 프레임 띠를 뽑아 보고 적는다.
- `-t 9.0` 은 3곳 × 2.5초 + 마지막 정지 1.5초. 녹화는 화면을 닫는 시간까지 포함해 더 길어서 자른다.
- 🔴 라이선스: 사진의 SA(동일조건) 여부는 `docs/designs/assets/gates/PICKS.md`. SA 사진이 든 영상은 CC BY-SA 로 공개한다.

만든 컷: `docs/designs/assets/gates/cuts/` — A(경희대·한국외대·서울대 · SA 포함) · B(서울대·숙명여대·동국대 · CC BY 만).

## 앱이 쓰는 사본 (2026-09-18 · 시작 화면에 실제로 들어간 것)

앱은 mp4 가 아니라 **사진 3장 + CSS 움직임**으로 컷 A 를 그린다(보이는 것은 같다 — `style.css` 끝 '시작 화면' 절 · `app.js startMontage`).
- 사진: `assets/gates/<파일>` — 원본을 가로 최대 1000px 로 다시 누른 사본(14장 1.8MB · 학생은 그중 3장만 받는다).
- 목록: `assets/gates/gates.json` — `node tools/gate-reel/build-app-gates.mjs` 가 manifest 와 reel.html 의 FOCUS 에서 만든다. 손으로 고치지 말 것.
- 사진을 바꾸면 셋을 같이: manifest/PICKS.md(출처) → 사본 다시 누르기 → gates.json 다시 만들기.
