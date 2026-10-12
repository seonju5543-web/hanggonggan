# 사내 작업 보고서 PDF (tools/work-report)

2026-10-12 개발자 지시: **작업이 끝날 때**와 **하루의 마지막 작업이 끝난 뒤**, 그날 한 일을 사내관리문서 PDF 로 만들어 제시한다.
수치는 모두 시각 자료(그림)로 보인다. 세션이 따르는 순서는 스킬 `.claude/skills/work-report/SKILL.md`.

```bash
REPORT_FONT_DIR=<Pretendard otf 폴더> node tools/work-report/build.mjs <명세.json> --out <보고서.pdf> --png <미리보기 폴더>
```

- 글꼴: 앱과 같은 Pretendard. 없으면 `npm pack pretendard@1.3.9` → 풀어서 `package/dist/public/static` 을 `REPORT_FONT_DIR` 로.
- 브라우저: playwright(전역 설치도 찾는다) · `CHROME_PATH` 로 바꿀 수 있다.
- 🔴 보고서 PDF·명세는 **커밋하지 않는다** — 공개 저장소이고 문서는 사내 한정이다. 세션 임시 폴더에 만든다.
- 🔴 숫자는 원천(기록 파일 · git · GitHub Actions · 노션 · data/)에서 센 것만 쓰고, `sources` 에 어디서 셌는지 적는다.

## 명세 꼴

```jsonc
{
  "meta": {
    "org": "한대장 · 한국 대학교 장학금", "docType": "사내 작업 보고서",
    "docNo": "HDJ-WR-YYYYMMDD-NN",            // 날짜 + 그날 순번 (하루 마감본은 -D)
    "eyebrow": "작업 완료 보고 · 영역", "title": "제목", "subtitle": "한 줄 설명",
    "runningTitle": "머리글", "classification": "사내 한정 · 외부 공유 금지",
    "fields": [["문서 번호", "…"], ["작성일", "…"], ["작업 기간", "…"], ["지시 · 확인", "…"], ["작성", "…"], ["공유 대상", "…"], ["관련 업무", "노션 …"], ["배포", "커밋 …"]],
    "status": "완료 · 배포됨", "statusTone": "good|warn|critical", "statusNote": "남은 일 한 줄",
    "signoff": [["작성", "…"], ["검토", ""], ["확인", "…"]]
  },
  "kpiCols": 3,
  "kpis": [{ "label": "…", "value": 173, "unit": "건", "note": "…", "tone": "good|warn|critical|neutral" }],
  "summary": ["**굵게** 와 `코드` 를 쓸 수 있는 요약 줄"],
  "sections": [{ "title": "…", "newPage": true, "lead": "…", "blocks": [ /* 아래 블록 */ ] }],
  "sources": ["**무엇** — 어디서 어떻게 셌나"]
}
```

| 블록 `type` | 쓰임 | 주요 칸 |
|---|---|---|
| `bars` | 항목별 크기 (가로 막대) | `items[{label,value,unit?,note?,color?}]` · `unit` · `color` · `rowHeight` · `barHeight` · `labelWidth` |
| `stacked` | 구성 (쌓은 가로 막대) | `series[{key,label,color}]` · `rows[{label,values:{key:n}}]` · `legend` · `segmentLabels` |
| `columns` | 날짜·차례별 (세로 막대) | `items[{label,value}]` · `shade[{from,to,label}]` · `height` |
| `timeline` | 일정 | `from` · `to` · `holidays[]` · `items[{label,start,end,startFrac?,endFrac?,kind:'pause'|'milestone',note,color}]` |
| `meters` | n / 전체 비율 | `items[{label,value,total,unit,note,target?}]` · `columns` |
| `kpis` | 숫자 칸 | `items[]` · `cols` |
| `steps` | 단계 · 로드맵 | `items[{title,note,badge,state:'done'|'wait'}]` |
| `table` | 문장 표 (숫자는 그림으로) | `columns[{label,width}]` · `rows[[…]]` |
| `list` · `text` · `callout` · `chips` | 글 | `items` / `paras` / `tone` |
| `grid` | 두 칸 나란히 | `template` · `cellWidth` · `blocks[]` |

색: `series:1`~`series:8`(범주 — 순서 고정), `status:good|warning|serious|critical|neutral`(상태 — 심각도·성공/실패에만), 또는 `#hex`.
그림 제목은 「그림 장-번호」로 달고, 본문은 그 번호로 가리킨다.
