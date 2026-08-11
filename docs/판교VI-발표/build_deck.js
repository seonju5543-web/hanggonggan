const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.author = "한대장";
pres.title = "한대장 — 경희 판교VI캠퍼스 입주 발표평가";

// ── palette ────────────────────────────────────────────────
const NAVY = "0F2A4A";
const NAVY2 = "1B3D63";
const AMBER = "E8890C";
const SLATE = "5A6B7D";
const LIGHT = "F4F6F8";
const GRAYL = "A8B4C0";
const WHITE = "FFFFFF";
const INK = "17232F";

const F = "Malgun Gothic";

const W = 13.333, H = 7.5;
const M = 0.65;
const CW = W - 2 * M;

let page = 0;

// ── helpers ────────────────────────────────────────────────
function newSlide(dark) {
  const s = pres.addSlide();
  s.background = { color: dark ? NAVY : WHITE };
  return s;
}

function footer(s, dark) {
  page += 1;
  s.addText("한대장 · 경희 판교VI캠퍼스 입주 발표평가 · 2026.08.12", {
    x: M, y: 6.98, w: 8, h: 0.3, fontFace: F, fontSize: 9,
    color: dark ? GRAYL : GRAYL, align: "left", margin: 0, valign: "middle",
  });
  s.addText(String(page), {
    x: W - M - 1, y: 6.98, w: 1, h: 0.3, fontFace: F, fontSize: 9,
    color: dark ? GRAYL : GRAYL, align: "right", margin: 0, valign: "middle",
  });
}

function title(s, text, dark) {
  s.addText(text, {
    x: M, y: 0.42, w: CW, h: 0.9, fontFace: F, fontSize: 30, bold: true,
    color: dark ? WHITE : NAVY, align: "left", valign: "middle", margin: 0,
  });
}

function subtitle(s, text, y, dark) {
  s.addText(text, {
    x: M, y: y, w: CW, h: 0.4, fontFace: F, fontSize: 14,
    color: dark ? GRAYL : SLATE, align: "left", valign: "middle", margin: 0,
  });
}

// stat card: big number + label + source
function statCard(s, x, y, w, h, num, label, src, opts) {
  const o = opts || {};
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: o.fill || LIGHT }, line: { color: o.fill || LIGHT, width: 0 },
  });
  s.addText(num, {
    x: x + 0.16, y: y + 0.10, w: w - 0.32, h: h * 0.42,
    fontFace: F, fontSize: o.numSize || 30, bold: true,
    color: o.numColor || AMBER, align: "left", valign: "middle", margin: 0,
  });
  s.addText(label, {
    x: x + 0.16, y: y + h * 0.60, w: w - 0.32, h: h * 0.26,
    fontFace: F, fontSize: o.labelSize || 12, color: o.labelColor || INK,
    align: "left", valign: "top", margin: 0,
  });
  if (src) {
    s.addText(src, {
      x: x + 0.16, y: y + h - 0.32, w: w - 0.32, h: 0.24,
      fontFace: F, fontSize: 8.5, color: SLATE, align: "left", valign: "middle", margin: 0,
    });
  }
}

// navy callout box with white text
function callout(s, x, y, w, h, text, opts) {
  const o = opts || {};
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: o.fill || NAVY }, line: { color: o.fill || NAVY, width: 0 },
  });
  s.addText(text, {
    x: x + 0.28, y: y + 0.06, w: w - 0.56, h: h - 0.12,
    fontFace: F, fontSize: o.size || 14, bold: o.bold !== false,
    color: o.color || WHITE, align: "left", valign: "middle", margin: 0,
  });
}

// numbered step card
function stepCard(s, x, y, w, h, n, head, body, accent) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: accent ? NAVY : LIGHT }, line: { color: accent ? NAVY : LIGHT, width: 0 },
  });
  s.addShape(pres.ShapeType.ellipse, {
    x: x + 0.22, y: y + 0.22, w: 0.44, h: 0.44,
    fill: { color: accent ? AMBER : NAVY }, line: { color: accent ? AMBER : NAVY, width: 0 },
  });
  s.addText(String(n), {
    x: x + 0.22, y: y + 0.22, w: 0.44, h: 0.44,
    fontFace: F, fontSize: 13, bold: true, color: WHITE,
    align: "center", valign: "middle", margin: 0,
  });
  s.addText(head, {
    x: x + 0.78, y: y + 0.2, w: w - 1.0, h: 0.48,
    fontFace: F, fontSize: 15, bold: true, color: accent ? WHITE : NAVY,
    align: "left", valign: "middle", margin: 0,
  });
  s.addText(body, {
    x: x + 0.24, y: y + 0.82, w: w - 0.48, h: h - 1.0,
    fontFace: F, fontSize: 12, color: accent ? "D8E2EC" : INK,
    align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
  });
}

const TBL = {
  head: { fill: NAVY, color: WHITE, bold: true },
};
function tableRows(header, rows) {
  const out = [];
  out.push(header.map((t) => ({
    text: t,
    options: { fill: NAVY, color: WHITE, bold: true, fontSize: 11.5, fontFace: F, align: "left", valign: "middle" },
  })));
  rows.forEach((r, i) => {
    out.push(r.map((cell, ci) => {
      const isObj = typeof cell === "object";
      const txt = isObj ? cell.text : cell;
      const hl = isObj && cell.hl;
      return {
        text: txt,
        options: {
          fill: hl ? "FDF0DE" : (i % 2 ? LIGHT : WHITE),
          color: hl ? INK : INK,
          bold: !!(isObj && cell.b),
          fontSize: 11, fontFace: F, align: "left", valign: "middle",
        },
      };
    }));
  });
  return out;
}

function note(s, text, y) {
  s.addText(text, {
    x: M, y: y, w: CW, h: 0.3, fontFace: F, fontSize: 9.5, color: SLATE,
    align: "left", valign: "middle", margin: 0, italic: true,
  });
}

// ═══════════════════════════════════════════════════════════
// 1. 표지
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide(true);
  s.addShape(pres.ShapeType.ellipse, {
    x: 9.6, y: -1.6, w: 6.2, h: 6.2,
    fill: { color: NAVY2 }, line: { color: NAVY2, width: 0 },
  });
  s.addText("한대장", {
    x: M, y: 1.9, w: 8.6, h: 1.1, fontFace: F, fontSize: 54, bold: true,
    color: WHITE, align: "left", valign: "middle", margin: 0,
  });
  s.addText("대학생 장학금 자동 매칭 · 신청 플랫폼", {
    x: M, y: 3.0, w: 8.6, h: 0.6, fontFace: F, fontSize: 21,
    color: "C3D2E2", align: "left", valign: "middle", margin: 0,
  });
  s.addText("공고를 모아 보여주는 데서 끝나지 않는다.\n신청서 제출까지 앱에서 끝낸다.", {
    x: M, y: 3.85, w: 8.6, h: 1.0, fontFace: F, fontSize: 16, bold: true,
    color: AMBER, align: "left", valign: "middle", margin: 0, lineSpacingMultiple: 1.35,
  });
  s.addText("공동대표  조세현 (경희대 재학)  ·  이선주 (한국외대 재학)", {
    x: M, y: 5.35, w: 8.6, h: 0.35, fontFace: F, fontSize: 13,
    color: "C3D2E2", align: "left", valign: "middle", margin: 0,
  });
  s.addText("2026년 제2차 경희판교VI캠퍼스 입주기업 발표평가  ·  2026.08.12", {
    x: M, y: 5.72, w: 8.6, h: 0.35, fontFace: F, fontSize: 12,
    color: SLATE, align: "left", valign: "middle", margin: 0,
  });
  footer(s, true);
}

// ═══════════════════════════════════════════════════════════
// 2. 문제
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "학생은 매년 같은 서류를 다시 쓴다");
  subtitle(s, "전국 4년제 190여 개교가 각자 공고를 올린다. 학생은 학교·재단·학과 게시판을 하나씩 돌아야 한다.", 1.35);

  const cw = (CW - 3 * 0.3) / 4, cy = 2.05, ch = 1.7;
  statCard(s, M + 0 * (cw + 0.3), cy, cw, ch, "190여", "공고가 흩어진 대학 수", "[공개 조사]");
  statCard(s, M + 1 * (cw + 0.3), cy, cw, ch, "185만", "4년제 재학생 (명)", "[공개 조사]");
  statCard(s, M + 2 * (cw + 0.3), cy, cw, ch, "수만 건", "연간 공고 수", "[추정치]");
  statCard(s, M + 3 * (cw + 0.3), cy, cw, ch, "0원", "마감을 놓쳤을 때 받는 금액", "");

  callout(s, M, 4.25, CW, 1.35,
    "마감을 놓치는 것은 정보 부족이 아니라 소득 손실이다.\n학기당 수십만~수백만 원이 사라지지만, 학생은 그 사실조차 모른다.",
    { size: 16 });

  note(s, "탐색 비용이 전부 학생에게 전가되는 구조 — 문제의 원인은 공고의 부족이 아니라 분산이다.", 5.85);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 3. 기존 해법의 한계
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "지금 나와 있는 해법은 '조회'에서 멈춘다");
  subtitle(s, "장학금을 모아 보여주는 서비스가 없는 것이 아니다. 신청까지 가는 서비스가 없다.", 1.35);

  const bw = (CW - 2 * 0.3) / 3, by = 2.0, bh = 1.55;
  stepCard(s, M, by, bw, bh, 1, "공고를 찾는다", "조회형 서비스가 여기까지 해 준다");
  stepCard(s, M + bw + 0.3, by, bw, bh, 2, "서식을 내려받는다", "여기서 앱을 나간다 — 이탈 지점");
  stepCard(s, M + 2 * (bw + 0.3), by, bw, bh, 3, "손으로 다시 적는다", "공고마다 같은 개인정보를 반복 기재");

  s.addTable(
    tableRows(
      ["유형", "공고 수집 범위", "학생이 도달하는 지점"],
      [
        ["대학 공식 포털", "자기 학교 교내 공고만", "교내 양식 안내까지"],
        ["공고 조회형 서비스", "넓으나 갱신이 수동에 의존", "조회에서 종료"],
        [{ text: "한대장", b: true, hl: true }, { text: "45개 캠퍼스 자동 + 교외 재단", hl: true }, { text: "신청서 작성·제출까지", b: true, hl: true }],
      ]
    ),
    { x: M, y: 3.9, w: CW, colW: [3.0, 4.5, 4.533], rowH: 0.42, border: { pt: 0.5, color: "DDE3E9" } }
  );

  note(s, "비교는 개별 회사가 아니라 유형 기준이다. 축은 하나 — 어디까지 데려다주는가.", 6.1);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 4. 해법
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "프로필 한 번이면, 신청서가 채워진 채로 나온다");

  const bw = (CW - 2 * 0.34) / 3, by = 1.6, bh = 2.35;
  stepCard(s, M, by, bw, bh, 1, "등록",
    "프로필 1회 입력\n학교 · 학년 · 성적 · 소득구간 · 특별자격\n\n최초 한 번으로 끝난다");
  stepCard(s, M + bw + 0.34, by, bw, bh, 2, "매칭",
    "12개 신호로 자격 자동 진단\n4단계 판정 · 적합도 점수순 정렬\n\n연산은 학생의 기기 안에서 수행");
  stepCard(s, M + 2 * (bw + 0.34), by, bw, bh, 3, "신청",
    "공고 원본과 같은 구조의 서식이\n앱 안에서 열린다\n\n프로필 값은 이미 채워져 있다", true);

  callout(s, M, 4.28, CW, 1.42,
    "핵심은 3단계다. 공고에 붙은 HWP · PDF 신청서를 자동 해석해\n항목 · 문구 · 체크옵션까지 원본과 동일한 서식으로 앱에 띄운다 — 현재 58종.",
    { size: 15 });

  note(s, "[자사 데이터]  공고 탐색부터 신청서 제출까지 앱을 벗어나지 않는다.", 5.95);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 5. 증명 — 지금도 돌고 있다
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "이 시스템은 지금 이 순간에도 돌고 있다");
  subtitle(s, "계획이 아니라 가동 중인 시스템입니다.", 1.3);

  const gw = 2.15, gh = 1.28, gx = M, gy = 1.85, gap = 0.22;
  const stats = [
    ["45", "개 캠퍼스 수집망"],
    ["613", "건 누적 수집 공고"],
    ["171", "건 자격 매칭 등록"],
    ["58", "종 앱 내 신청서 서식"],
    ["93", "곳 공고 주관 기관"],
    ["30회", "연속 로봇 무중단 성공"],
  ];
  stats.forEach((st, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    statCard(s, gx + col * (gw + gap), gy + row * (gh + gap), gw, gh, st[0], st[1], "", { numSize: 26, labelSize: 11 });
  });

  s.addText("서면 제출 후 이틀간의 변화", {
    x: 7.65, y: 1.85, w: 5.03, h: 0.35, fontFace: F, fontSize: 13, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addTable(
    tableRows(
      ["항목", "서면 (8/9)", "오늘 (8/11)"],
      [
        ["수집망", "42개교", { text: "45개 캠퍼스", b: true, hl: true }],
        ["누적 공고", "600건", { text: "613건", b: true, hl: true }],
        ["매칭 공고", "166건", { text: "171건", b: true, hl: true }],
        ["서식", "56종", { text: "58종", b: true, hl: true }],
      ]
    ),
    { x: 7.65, y: 2.3, w: 5.03, colW: [1.83, 1.6, 1.6], rowH: 0.4, border: { pt: 0.5, color: "DDE3E9" } }
  );

  callout(s, M, 4.9, CW, 1.05,
    "이 증가분에 사람 손이 들어가지 않았습니다. 심사위원께서 서면을 읽으신 이틀 동안 로봇이 스스로 채운 숫자입니다.",
    { size: 15 });

  note(s, "[자사 데이터]  전 수치는 2026.08.11 실측값.", 6.15);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 6. 진입장벽
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "진입장벽은 아이디어가 아니라 45개 캠퍼스의 축적이다");
  subtitle(s, "대학 게시판은 구조가 제각각이다. 우리는 세 유형을 모두 처리한다.", 1.35);

  const bw = (CW - 2 * 0.34) / 3, by = 2.0, bh = 2.05;
  stepCard(s, M, by, bw, bh, 1, "정적 게시판",
    "일반 수집기로 처리\n\n신규 대학 추가\n평균 2시간");
  stepCard(s, M + bw + 0.34, by, bw, bh, 2, "동적 게시판",
    "본문을 자바스크립트로 그림\n실제 브라우저를 띄워 수집\n\n추가 1~2일");
  stepCard(s, M + 2 * (bw + 0.34), by, bw, bh, 3, "클릭형 게시판",
    "링크가 없고 스크립트로만 열림\n행을 실제로 클릭해 상세 채집\n\n이 유형 대응이 결정적", true);

  callout(s, M, 4.4, CW, 1.2,
    "후발 주자가 같은 상태에 도달하려면 평균 3~6개월이 걸린다.\n이 격차 자체가 자산이며, 우리는 신규 대학 1곳을 2시간~2일에 붙인다.",
    { size: 15 });

  note(s, "[자사 경험]  경희대 · 한국외대 · 성균관대 · 중앙대 · 동국대 · 시립대 · 광운대 · 숙명여대 · 홍익대 · 명지대 외 35개 캠퍼스 수집 중.", 5.85);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 7. 서식 변환 엔진
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "서식 변환 엔진 — 공고에 붙은 HWP가 앱 화면이 된다");
  subtitle(s, "이것이 '조회형 서비스'와 갈리는 지점이다.", 1.35);

  const bw = 3.35, by = 2.05, bh = 1.75;
  const ax = [M, M + bw + 0.75, M + 2 * (bw + 0.75)];
  stepCard(s, ax[0], by, bw, bh, 1, "원본", "공고 첨부 신청서 파일\nHWP · HWPX · DOCX · PDF");
  stepCard(s, ax[1], by, bw, bh, 2, "해석", "항목 · 문구 · 체크옵션 ·\n표 구조를 자동 추출");
  stepCard(s, ax[2], by, bw, bh, 3, "결과", "원본과 동일한 구조의 앱 서식\n프로필 값 자동 입력", true);

  [0, 1].forEach((i) => {
    s.addShape(pres.ShapeType.rightArrow, {
      x: ax[i] + bw + 0.14, y: by + bh / 2 - 0.17, w: 0.46, h: 0.34,
      fill: { color: GRAYL }, line: { color: GRAYL, width: 0 },
    });
  });

  statCard(s, M, 4.15, 3.35, 1.25, "58종", "변환 완료 서식", "[자사 데이터]", { numSize: 28 });
  statCard(s, M + 3.35 + 0.34, 4.15, 3.35, 1.25, "41건", "서식이 연결된 공고", "[자사 데이터]", { numSize: 28 });

  callout(s, M + 2 * (3.35 + 0.34), 4.15, CW - 2 * (3.35 + 0.34), 1.25,
    "자유 형식 제출이 확인된 공고에만\n앱 생성 문서를 제공한다.",
    { size: 13.5 });

  note(s, "추론해서 안내하지 않는 것이 설계 원칙이다 — 확인되지 않은 정보는 지어내지 않는다.", 5.65);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 8. 개인정보 아키텍처
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "성적과 소득은 서버에 올라가지 않는다");
  subtitle(s, "개인정보 문제를 정책이 아니라 아키텍처로 해결했다.", 1.35);

  // 좌: 기기 영역 (강조)
  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.95, w: 5.9, h: 2.9, rectRadius: 0.08,
    fill: { color: "FDF0DE" }, line: { color: AMBER, width: 2 },
  });
  s.addText("기기 영역 — 휴대폰 안에만 존재", {
    x: M + 0.28, y: 2.12, w: 5.34, h: 0.4, fontFace: F, fontSize: 14, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addText([
    { text: "프로필 (학교·학년·성적·소득구간·특별자격)", options: { bullet: true, breakLine: true } },
    { text: "서류 보관함 — 정부 발급 증명서 스캔본", options: { bullet: true, breakLine: true } },
    { text: "작성 중인 신청서 답변", options: { bullet: true, breakLine: true } },
    { text: "매칭 연산도 이 영역 안에서 수행", options: { bullet: true, breakLine: true, bold: true } },
    { text: "외부로 내보내는 코드 경로가 존재하지 않는다", options: { bullet: true, bold: true } },
  ], {
    x: M + 0.28, y: 2.58, w: 5.34, h: 2.1, fontFace: F, fontSize: 12.5, color: INK,
    align: "left", valign: "top", margin: 0, paraSpaceAfter: 6,
  });

  // 우: 계정 영역
  s.addShape(pres.ShapeType.roundRect, {
    x: M + 6.2, y: 1.95, w: 5.83, h: 2.9, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
  });
  s.addText("계정 영역 — 회원 기능 도입 후 (설계 확정)", {
    x: M + 6.48, y: 2.12, w: 5.27, h: 0.4, fontFace: F, fontSize: 14, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addText([
    { text: "매칭은 계속 단말에서 수행 — 서버는 성적·소득을 모른다", options: { bullet: true, breakLine: true, bold: true } },
    { text: "서버가 갖는 것은 계정 식별자와 공고 id(이름표)뿐", options: { bullet: true, breakLine: true } },
    { text: "공고 내용도, 민감 항목도 복사하지 않는다", options: { bullet: true, breakLine: true } },
    { text: "로그인은 선택 — 계정 없이도 전체 기능 사용", options: { bullet: true, breakLine: true } },
    { text: "약관·개인정보처리방침을 회원 기능보다 먼저 게시", options: { bullet: true } },
  ], {
    x: M + 6.48, y: 2.58, w: 5.27, h: 2.1, fontFace: F, fontSize: 12.5, color: INK,
    align: "left", valign: "top", margin: 0, paraSpaceAfter: 6,
  });

  callout(s, M, 5.05, CW, 1.15,
    "\"수집하지 않으면 유출되지 않는다.\"  민감정보를 서버에 두지 않는 구조라,\n규제 대응이 사후 약속이 아니라 설계의 결과다.",
    { size: 15 });

  note(s, "민감 항목(장애·기초수급·국가유공자 여부, 성적, 소득분위, 계좌번호)은 별도 동의로 분리한다.", 6.35);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 9. 백엔드
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "서버 없이 운영하는 백엔드");
  subtitle(s, "운영 인프라는 이미 다 서 있고, 고정비는 사실상 0이다.", 1.35);

  const cw = (CW - 3 * 0.28) / 4, cy = 2.0, ch = 2.05;
  const cards = [
    ["수집 자동화", "예약 실행 워크플로 17종\n하루 2회 전 캠퍼스 수집 →\n자동 검수 → 발행까지 무인"],
    ["관리자 대시보드", "6화면 가동\n오늘 할 일 · 공고 · 컨펌 ·\n서식 · 수집망 · 데이터 품질\n접근은 이중 잠금"],
    ["알림 서버", "웹 푸시 구축 완료\n2026.08 실기기 수신 검증 완료"],
    ["접수 메일 서버", "이메일 접수 공고용\n발신 도메인 허용목록 ·\n요청 출처 검사 · 용량 제한"],
  ];
  cards.forEach((c, i) => {
    const x = M + i * (cw + 0.28);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: cy, w: cw, h: ch, rectRadius: 0.08,
      fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
    });
    s.addText(c[0], {
      x: x + 0.22, y: cy + 0.2, w: cw - 0.44, h: 0.42,
      fontFace: F, fontSize: 14, bold: true, color: NAVY, align: "left", valign: "middle", margin: 0,
    });
    s.addText(c[1], {
      x: x + 0.22, y: cy + 0.72, w: cw - 0.44, h: ch - 0.95,
      fontFace: F, fontSize: 11.5, color: INK, align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.3,
    });
  });

  statCard(s, M, 4.35, 2.6, 1.15, "17종", "자동화 워크플로", "[자사 데이터]", { numSize: 26, labelSize: 11 });
  statCard(s, M + 2.88, 4.35, 2.6, 1.15, "30회", "연속 무중단 성공", "[자사 데이터]", { numSize: 26, labelSize: 11 });
  callout(s, M + 5.76, 4.35, CW - 5.76, 1.15,
    "상시 서버가 없는 구조라 인프라 고정비가 거의 발생하지 않는다.\n콘텐츠 확보 비용도 0 — 사람이 공고를 입력하지 않기 때문이다.",
    { size: 12.5 });

  note(s, "매출 0인 초기에도 버틸 수 있는 이유가 여기에 있다 — 버닝률이 인건비 외에는 거의 없다.", 5.75);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 10. 포지셔닝
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "우리만 오른쪽 위에 있다");

  // matrix
  const mx = M, my = 1.55, mw = 5.5, mh = 3.55;
  s.addShape(pres.ShapeType.rect, {
    x: mx, y: my, w: mw, h: mh, fill: { color: LIGHT }, line: { color: "DDE3E9", width: 1 },
  });
  s.addShape(pres.ShapeType.line, {
    x: mx, y: my + mh / 2, w: mw, h: 0, line: { color: "C9D3DD", width: 1, dashType: "dash" },
  });
  s.addShape(pres.ShapeType.line, {
    x: mx + mw / 2, y: my, w: 0, h: mh, line: { color: "C9D3DD", width: 1, dashType: "dash" },
  });

  function quad(x, y, label, on) {
    s.addShape(pres.ShapeType.ellipse, {
      x, y, w: 0.3, h: 0.3,
      fill: { color: on ? AMBER : GRAYL }, line: { color: on ? AMBER : GRAYL, width: 0 },
    });
    s.addText(label, {
      x: x + 0.38, y: y - 0.12, w: 2.15, h: 0.55, fontFace: F,
      fontSize: on ? 13 : 11, bold: on, color: on ? NAVY : SLATE,
      align: "left", valign: "middle", margin: 0,
    });
  }
  quad(mx + 3.0, my + 0.55, "한대장", true);
  quad(mx + 0.5, my + 0.95, "대학 공식 포털", false);
  quad(mx + 3.0, my + 2.6, "공고 조회형 서비스", false);
  quad(mx + 0.5, my + 3.0, "학교 게시판 직접 탐색", false);

  s.addText("공고 수집 범위  →", {
    x: mx, y: my + mh + 0.08, w: mw, h: 0.3, fontFace: F, fontSize: 10.5,
    color: SLATE, align: "center", valign: "middle", margin: 0,
  });
  s.addText("신\n청\n완\n결", {
    x: mx - 0.42, y: my + 0.3, w: 0.36, h: 1.5, fontFace: F, fontSize: 10.5,
    color: SLATE, align: "center", valign: "middle", margin: 0, lineSpacingMultiple: 0.9,
  });

  s.addTable(
    tableRows(
      ["", "한대장", "공고 조회형", "대학 공식 포털"],
      [
        ["공고 수집", { text: "45개 캠퍼스 자동, 하루 2회", b: true, hl: true }, "수동 갱신 의존", "교내만"],
        ["자동 매칭", { text: "12개 신호", b: true, hl: true }, "제한적", "없음"],
        ["신청서 작성", { text: "앱 내 작성·제출 58종", b: true, hl: true }, "불가", "교내 양식만"],
        ["수익 구조", { text: "대학 SaaS + 재단 게재비", b: true, hl: true }, "광고 중심", "해당 없음"],
      ]
    ),
    { x: M + 5.9, y: 1.75, w: CW - 5.9, colW: [1.35, 2.4, 1.3, 1.083], rowH: 0.6, border: { pt: 0.5, color: "DDE3E9" } }
  );

  note(s, "비교는 회사가 아니라 유형 단위로 한다 — 축은 수집 범위와 도달 깊이 두 가지뿐이다.", 5.45);
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 11. 수익 모델
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "학생에게 영원히 무료인 이유");
  subtitle(s, "양면 시장이다. 돈은 반대편에서 나온다.", 1.35);

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 1.95, w: 5.9, h: 1.15, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
  });
  s.addText("학생 — 무료", {
    x: M + 0.28, y: 2.08, w: 5.34, h: 0.35, fontFace: F, fontSize: 14, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addText("매칭·신청 전부 무료. 이것이 성장 엔진이다. 유료화하면 성장이 죽는다.", {
    x: M + 0.28, y: 2.45, w: 5.34, h: 0.55, fontFace: F, fontSize: 12, color: INK,
    align: "left", valign: "top", margin: 0,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M + 6.2, y: 1.95, w: 5.83, h: 1.15, rectRadius: 0.08,
    fill: { color: NAVY }, line: { color: NAVY, width: 0 },
  });
  s.addText("대학 · 재단 — 유료", {
    x: M + 6.48, y: 2.08, w: 5.27, h: 0.35, fontFace: F, fontSize: 14, bold: true,
    color: AMBER, align: "left", valign: "middle", margin: 0,
  });
  s.addText("적격 지원자 모집과 접수 행정이 그들의 비용이다. 우리가 그것을 줄인다.", {
    x: M + 6.48, y: 2.45, w: 5.27, h: 0.55, fontFace: F, fontSize: 12, color: "D8E2EC",
    align: "left", valign: "top", margin: 0,
  });

  s.addTable(
    tableRows(
      ["", "수익원", "단가 근거", "3년차 목표"],
      [
        ["①", { text: "대학 장학팀 SaaS 구독", b: true, hl: true }, { text: "기존 학사·장학관리 솔루션 연 1,000만~5,000만 원/교 참조 [공개 조사]", hl: true }, { text: "30개교 · 5억 원", b: true, hl: true }],
        ["②", "재단 공고 게재·매칭 수수료", "매칭 완료 건당 50만~300만 원 [공개 조사]", "60건 · 1억 원"],
        ["③", "금융·생활 제휴", "대학생 타깃 제휴 건당 5만~50만 원", "0.5억 원"],
        ["④", "익명 집계 리포트", "장학 수요·공급 트렌드 연간 구독", "0.3억 원"],
      ]
    ),
    { x: M, y: 3.35, w: CW, colW: [0.5, 3.2, 5.833, 2.5], rowH: 0.48, border: { pt: 0.5, color: "DDE3E9" } }
  );

  callout(s, M, 5.9, CW, 0.72,
    "대학이 도입할 이유는 선의가 아니다. 장학금 집행률·수혜율이 대학 평가지표이기 때문이다.",
    { size: 14 });
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 12. 시장
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "시장은 38억, 우리가 먼저 잡을 곳은 2개교다");

  // funnel
  const fx = M, fy = 1.7;
  const bars = [
    { w: 5.6, h: 0.95, c: GRAYL, t: "TAM  38억 원 / 년", d: "4년제 190여 개교\n× 평균 2,000만 원" },
    { w: 4.2, h: 0.95, c: SLATE, t: "SAM  9억 원 / 년", d: "수집망을 확보한\n45개 캠퍼스" },
    { w: 2.8, h: 0.95, c: AMBER, t: "SOM  2,400만 원", d: "1년차 파일럿 2개교\n× 연 1,200만 원" },
  ];
  let cy2 = fy;
  bars.forEach((b) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: fx + (5.6 - b.w) / 2, y: cy2, w: b.w, h: b.h, rectRadius: 0.05,
      fill: { color: b.c }, line: { color: b.c, width: 0 },
    });
    s.addText(b.t, {
      x: fx + (5.6 - b.w) / 2, y: cy2, w: b.w, h: b.h, fontFace: F, fontSize: 14, bold: true,
      color: WHITE, align: "center", valign: "middle", margin: 0,
    });
    s.addText(b.d, {
      x: fx + 5.8, y: cy2, w: 1.72, h: b.h, fontFace: F, fontSize: 10.5, color: SLATE,
      align: "left", valign: "middle", margin: 0, lineSpacingMultiple: 1.2,
    });
    cy2 += b.h + 0.28;
  });

  s.addTable(
    tableRows(
      ["", "1년차", "2년차", "3년차"],
      [
        [{ text: "매출 목표", b: true }, { text: "5,000만 원", hl: true }, "2억 원", { text: "6억 원", b: true, hl: true }],
        ["SaaS 계약", "5개교", "15개교", "30개교"],
        ["수집망", "100개교", "—", "150개교"],
        ["인원", "4명", "7명", "12명"],
      ]
    ),
    { x: M + 7.6, y: 1.75, w: CW - 7.6, colW: [1.35, 1.03, 1.03, 1.023], rowH: 0.52, border: { pt: 0.5, color: "DDE3E9" } }
  );

  s.addText("전부 [목표치]", {
    x: M + 7.6, y: 4.45, w: CW - 7.6, h: 0.3, fontFace: F, fontSize: 10, color: SLATE,
    align: "left", valign: "middle", margin: 0,
  });

  callout(s, M, 5.35, CW, 0.95,
    "1년차 성립 조건은 단 하나 — 2분기 내 파일럿 2개교 계약이다.\n시장이 커서가 아니라, 첫 두 곳이 되는지로 이 계획의 진위가 갈린다.",
    { size: 13.5 });
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 13. 로드맵
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "입주 1년, 최초 매출까지 간다");

  const qw = (CW - 3 * 0.28) / 4, qy = 1.75, qh = 2.75;
  const qs = [
    ["1분기", "확산", "약관·개인정보처리방침 게시\n→ 회원 기능 적용\n→ 캠퍼스 홍보", "가입자 2,000명\nD7 리텐션 25%"],
    ["2분기", "파일럿", "\"귀교 학생 N명 사용 중\"\n데이터로 장학팀 영업\n경희대 → 인접 대학", "파일럿 계약 2개교"],
    ["3분기", "최초 매출", "파일럿 성과 정량화\n(수혜율·시간 절감)\n재단 게재 파일럿 병행", "최초 매출 발생\n수집 60개교"],
    ["4분기", "확장", "전국 영업 확대\nSeed 라운드 준비", "가입자 1만 명\nARR 0.5억 원"],
  ];
  qs.forEach((q, i) => {
    const x = M + i * (qw + 0.28);
    const on = i === 2;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: qy, w: qw, h: qh, rectRadius: 0.08,
      fill: { color: on ? NAVY : LIGHT }, line: { color: on ? NAVY : LIGHT, width: 0 },
    });
    s.addText(q[0], {
      x: x + 0.22, y: qy + 0.18, w: qw - 0.44, h: 0.3, fontFace: F, fontSize: 11,
      color: on ? AMBER : SLATE, bold: true, align: "left", valign: "middle", margin: 0,
    });
    s.addText(q[1], {
      x: x + 0.22, y: qy + 0.5, w: qw - 0.44, h: 0.42, fontFace: F, fontSize: 17, bold: true,
      color: on ? WHITE : NAVY, align: "left", valign: "middle", margin: 0,
    });
    s.addText(q[2], {
      x: x + 0.22, y: qy + 1.02, w: qw - 0.44, h: 1.0, fontFace: F, fontSize: 11,
      color: on ? "D8E2EC" : INK, align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
    });
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.22, y: qy + qh - 0.85, w: qw - 0.44, h: 0.66, rectRadius: 0.05,
      fill: { color: on ? AMBER : "E4E9EE" }, line: { color: on ? AMBER : "E4E9EE", width: 0 },
    });
    s.addText(q[3], {
      x: x + 0.3, y: qy + qh - 0.85, w: qw - 0.6, h: 0.66, fontFace: F, fontSize: 10.5, bold: true,
      color: on ? WHITE : NAVY, align: "left", valign: "middle", margin: 0,
    });
  });

  callout(s, M, 4.85, CW, 1.2,
    "추가 개발이 필요 없다. 제품과 인프라가 완성돼 있어 입주 기간 전량을 확산과 영업에 투입한다.\n백엔드 잔여 과제는 회원 기능 하나이며, 설계가 이미 끝나 있어 착수 후 3~5일이면 붙는다.",
    { size: 13.5 });
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 14. 팀
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide();
  title(s, "2명이 5주 만에 만들었고, 외부 자금은 0원이다");

  const cw = (6.0 - 0.28) / 2, cy = 1.7, ch = 1.35;
  statCard(s, M, cy, cw, ch, "2명", "총 인원 (공동대표 전원)", "[자사 데이터]", { numSize: 28, labelSize: 11 });
  statCard(s, M + cw + 0.28, cy, cw, ch, "5주", "기획부터 배포까지", "[자사 데이터]", { numSize: 28, labelSize: 11 });
  statCard(s, M, cy + ch + 0.28, cw, ch, "480회+", "개발 작업 기록", "[자사 커밋 기록]", { numSize: 28, labelSize: 11 });
  statCard(s, M + cw + 0.28, cy + ch + 0.28, cw, ch, "0원", "외부 투자 · 외주 개발비", "[자사 데이터]", { numSize: 28, labelSize: 11 });

  const rx = M + 6.4, rw = CW - 6.4;
  s.addShape(pres.ShapeType.roundRect, {
    x: rx, y: cy, w: rw, h: 1.35, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
  });
  s.addText("조세현  ·  공동대표", {
    x: rx + 0.28, y: cy + 0.18, w: rw - 0.56, h: 0.4, fontFace: F, fontSize: 15, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addText("경희대학교 재학 · 데이터 운영 · 기관 협업\n서비스 실사용자 관점의 기획·운영", {
    x: rx + 0.28, y: cy + 0.6, w: rw - 0.56, h: 0.65, fontFace: F, fontSize: 12, color: INK,
    align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: rx, y: cy + ch + 0.28, w: rw, h: 1.35, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
  });
  s.addText("이선주  ·  공동대표", {
    x: rx + 0.28, y: cy + ch + 0.46, w: rw - 0.56, h: 0.4, fontFace: F, fontSize: 15, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  s.addText("한국외국어대학교 재학 · 개발 · 수집망 구축\n제품·데이터·운영 인프라 전체 자체 개발", {
    x: rx + 0.28, y: cy + ch + 0.88, w: rw - 0.56, h: 0.65, fontFace: F, fontSize: 12, color: INK,
    align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
  });

  callout(s, M, 4.85, CW, 1.25,
    "45개 캠퍼스를 2명이 무인으로 운영 중이다. 인력을 늘려야 확장되는 구조가 아니라,\n이미 확장되는 구조에 인력을 얹는 것이다 — 추가 채용은 가속용이지 전제조건이 아니다.",
    { size: 14 });
  footer(s);
}

// ═══════════════════════════════════════════════════════════
// 15. 마무리
// ═══════════════════════════════════════════════════════════
{
  const s = newSlide(true);
  s.addShape(pres.ShapeType.ellipse, {
    x: 10.2, y: 3.8, w: 5.6, h: 5.6,
    fill: { color: NAVY2 }, line: { color: NAVY2, width: 0 },
  });
  title(s, "남은 병목은 하나, 사업장 주소다", true);
  s.addText("제품은 끝났다. 막힌 것은 계약할 자격이다.", {
    x: M, y: 1.32, w: CW, h: 0.4, fontFace: F, fontSize: 15, color: AMBER,
    align: "left", valign: "middle", margin: 0,
  });

  const bw = (CW - 2 * 0.34) / 3, by = 2.0, bh = 2.35;
  const items = [
    ["막힌 곳", "대학 장학팀·재단과의 공식 계약은 사업장 주소가 사실상 전제조건이다.\n\n예비창업자 신분으로는 기관 행정조직과 협의를 시작할 수 없다."],
    ["입주하면", "본사 소재화 → 사업자등록 →\n장학팀 공식 미팅 개시.\n\n병목이 즉시 사라진다."],
    ["왜 경희 판교VI인가", "공동대표 1인이 경희대 재학생이자 실사용자다.\n\n산학협력단·학생처·장학팀으로 바로 연결되며, 첫 B2B 고객이 곧 대학이다."],
  ];
  items.forEach((it, i) => {
    const x = M + i * (bw + 0.34);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: by, w: bw, h: bh, rectRadius: 0.08,
      fill: { color: i === 2 ? AMBER : NAVY2 }, line: { color: i === 2 ? AMBER : NAVY2, width: 0 },
    });
    s.addText(it[0], {
      x: x + 0.26, y: by + 0.2, w: bw - 0.52, h: 0.42, fontFace: F, fontSize: 15, bold: true,
      color: WHITE, align: "left", valign: "middle", margin: 0,
    });
    s.addText(it[1], {
      x: x + 0.26, y: by + 0.72, w: bw - 0.52, h: bh - 0.95, fontFace: F, fontSize: 12,
      color: i === 2 ? "3B2401" : "C3D2E2", align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
    });
  });

  s.addText("공고를 모으는 일은 이미 끝냈습니다.\n이제 계약을 시작할 주소가 필요합니다.", {
    x: M, y: 4.7, w: CW, h: 1.6, fontFace: F, fontSize: 26, bold: true,
    color: WHITE, align: "left", valign: "middle", margin: 0, lineSpacingMultiple: 1.3,
  });
  footer(s, true);
}

// ═══════════════════════════════════════════════════════════
// 백업 슬라이드
// ═══════════════════════════════════════════════════════════
function backupSlide(tag, head, sub) {
  const s = newSlide();
  s.addText(tag, {
    x: M, y: 0.35, w: CW, h: 0.3, fontFace: F, fontSize: 11, bold: true,
    color: AMBER, align: "left", valign: "middle", margin: 0,
  });
  s.addText(head, {
    x: M, y: 0.68, w: CW, h: 0.7, fontFace: F, fontSize: 26, bold: true,
    color: NAVY, align: "left", valign: "middle", margin: 0,
  });
  if (sub) subtitle(s, sub, 1.42);
  return s;
}

function bullets(s, items, y, h, size) {
  s.addText(items.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i !== items.length - 1 },
  })), {
    x: M, y, w: CW, h, fontFace: F, fontSize: size || 13, color: INK,
    align: "left", valign: "top", margin: 0, paraSpaceAfter: 10, lineSpacingMultiple: 1.25,
  });
}

// B1
{
  const s = backupSlide("백업 B1 · 질의응답용", "개인정보 보호 — 지금과 회원 기능 도입 후");
  s.addText("현재 (배포 완료)", { x: M, y: 1.4, w: 5.9, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: NAVY, align: "left", valign: "middle", margin: 0 });
  s.addText([
    { text: "프로필·서류·신청서 답변은 기기 안에만 저장. 외부 전송 코드 없음", options: { bullet: true, breakLine: true } },
    { text: "앱의 외부 통신은 공고 데이터 내려받기(자체 출처)뿐 — 통신 정책으로 그 외 연결 차단", options: { bullet: true, breakLine: true } },
    { text: "외부 유입 데이터는 화면 출력 시 이스케이프, 링크 주소는 스킴 검증", options: { bullet: true, breakLine: true } },
    { text: "관리자 화면은 허용 계정 + 일회용 코드의 이중 잠금", options: { bullet: true } },
  ], { x: M, y: 1.8, w: 5.9, h: 2.0, fontFace: F, fontSize: 12, color: INK, align: "left", valign: "top", margin: 0, paraSpaceAfter: 8 });

  s.addText("회원 기능 도입 후에도 바뀌지 않는 것", { x: M + 6.2, y: 1.4, w: 5.83, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: NAVY, align: "left", valign: "middle", margin: 0 });
  s.addText([
    { text: "매칭은 단말에서 수행 — 성적·소득분위가 서버로 나가지 않는다", options: { bullet: true, breakLine: true, bold: true } },
    { text: "서버는 공고를 복사하지 않고 공고 id(이름표)만 보관", options: { bullet: true, breakLine: true } },
    { text: "서류 보관함은 기본 단말 전용, 백업은 사용자가 켜는 선택 항목", options: { bullet: true, breakLine: true } },
    { text: "로그인은 선택 — 계정 없이도 전체 기능 사용 가능", options: { bullet: true } },
  ], { x: M + 6.2, y: 1.8, w: 5.83, h: 2.0, fontFace: F, fontSize: 12, color: INK, align: "left", valign: "top", margin: 0, paraSpaceAfter: 8 });

  callout(s, M, 3.55, CW, 1.6,
    "착수 전 선행 사항\n· 서비스 이용약관 · 개인정보처리방침 게시 (회원 기능보다 먼저)\n· 민감 항목(장애·기초수급·국가유공자·성적·소득분위·계좌번호) 별도 동의 분리\n· 해외 사업자 인증 서비스 사용 시 국외 이전 고지 · 인증 자체는 직접 구현하지 않는다",
    { size: 12.5, bold: false });
  footer(s);
}

// B2
{
  const s = backupSlide("백업 B2 · 질의응답용", "백엔드 개발 현황과 잔여 과제");
  s.addTable(
    tableRows(
      ["영역", "현재 상태", "잔여 과제", "예상 소요"],
      [
        ["앱 (PWA)", "배포 완료, 자동 업데이트 체계 가동", "—", { text: "완료", b: true }],
        ["수집 파이프라인", "워크플로 17종, 하루 2회 무인 실행, 30회 연속 성공", "수집망 45 → 190개교 확장", "교당 2시간~2일"],
        ["자동 검수·데이터 감사", "매일 자동 실행, 금액·마감·서식 오류 차단", "자동 등록분 사람 검수 병행", "상시"],
        ["서식 변환", "58종 확보, 자동 추출 파이프라인 가동", "스키마화 자동화(AI 연동)", "1~2주"],
        ["관리자 대시보드", "6화면 가동, 접근 이중 잠금", "운영 지표 화면 보강", "1주"],
        ["웹 푸시", "구축 완료, 실기기 수신 검증 완료", "발송 규칙 세분화", "1주"],
        ["접수 메일 서버", "코드 완성, 보안 검사 적용", "발송 서비스 키 연결", "1일"],
        [{ text: "회원 인증·동기화", b: true, hl: true }, { text: "설계 확정, 착수 전", hl: true }, { text: "약관·처리방침 선행 → 구현", hl: true }, { text: "3~5일", b: true, hl: true }],
      ]
    ),
    { x: M, y: 1.5, w: CW, colW: [2.6, 4.6, 3.4, 1.433], rowH: 0.42, border: { pt: 0.5, color: "DDE3E9" } }
  );
  callout(s, M, 5.7, CW, 0.85,
    "잔여 과제 중 신규 설계가 필요한 것은 없다. 전부 정해진 것을 실행하는 단계이며,\n그래서 입주 기간을 개발이 아니라 영업에 쓸 수 있다.",
    { size: 13 });
  footer(s);
}

// B3
{
  const s = backupSlide("백업 B3 · 질의응답용", "인프라 비용 구조 — 왜 매출 0에도 버티는가");
  const cw = (CW - 3 * 0.28) / 4;
  const items = [
    ["콘텐츠 확보비", "0원", "공고를 사람이 입력하지 않는다.\n수집·검수·발행이 전부 자동"],
    ["서버 고정비", "사실상 0", "상시 가동 서버가 없다.\n정적 배포 + 예약 실행"],
    ["외주 개발비", "0원", "제품·데이터·운영 인프라\n전체를 공동대표 2명이 직접"],
    ["외부 조달", "0원", "투자·정부지원금 없이\n현재 상태까지 도달"],
  ];
  items.forEach((it, i) => {
    const x = M + i * (cw + 0.28), cy3 = 1.7, ch3 = 2.15;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: cy3, w: cw, h: ch3, rectRadius: 0.08,
      fill: { color: LIGHT }, line: { color: LIGHT, width: 0 },
    });
    s.addText(it[0], {
      x: x + 0.2, y: cy3 + 0.16, w: cw - 0.4, h: 0.34,
      fontFace: F, fontSize: 13, bold: true, color: NAVY,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(it[1], {
      x: x + 0.2, y: cy3 + 0.56, w: cw - 0.4, h: 0.62,
      fontFace: F, fontSize: 28, bold: true, color: AMBER,
      align: "left", valign: "middle", margin: 0,
    });
    s.addText(it[2], {
      x: x + 0.2, y: cy3 + 1.3, w: cw - 0.4, h: 0.72,
      fontFace: F, fontSize: 11, color: SLATE,
      align: "left", valign: "top", margin: 0, lineSpacingMultiple: 1.25,
    });
  });
  callout(s, M, 4.15, CW, 1.35,
    "버닝률(월 소진액)이 인건비 외에는 거의 없다.\n1~2분기 매출 공백을 견딜 수 있는 근거가 여기에 있으며,\n조달하는 자금은 생존비가 아니라 확장 속도에 쓰인다.",
    { size: 14 });
  footer(s);
}

// B4
{
  const s = backupSlide("백업 B4 · 질의응답용", "수집의 적법성");
  bullets(s, [
    "수집 대상은 대학이 공개 게시한 공고의 제목·링크·본문 발췌이며, 로그인이 필요한 영역에는 접근하지 않는다",
    "앱은 원문을 재작성하지 않는다 — 원문 문장을 그대로 발췌해 '공고 원문 안내'로만 표시한다 (원문 발췌 보유 107건)",
    "발췌가 없으면 지어내지 않고 원문 링크만 제공한다",
    "모든 공고 카드는 원본 게시글로 이동한다 — 트래픽은 학교로 되돌아간다",
    "대학이 중단을 요청하면 해당 학교를 즉시 수집 대상에서 제외한다",
  ], 1.55, 2.9);
  callout(s, M, 4.05, CW, 1.35,
    "나아가 장학팀과의 정보 연계 계약이 1순위 수익원이다.\n대학과 대립하는 구조가 아니라, 수집을 계약으로 전환하는 구조다.",
    { size: 14 });
  footer(s);
}

// B5
{
  const s = backupSlide("백업 B5 · 질의응답용", "자동 등록 공고의 정확도 관리");
  const cw = (CW - 0.28) / 2;
  statCard(s, M, 1.55, cw, 1.2, "79건", "사람이 검수한 공고", "", { numSize: 28, numColor: NAVY, labelSize: 12 });
  statCard(s, M + cw + 0.28, 1.55, cw, 1.2, "92건", "로봇이 자동 등록한 공고", "", { numSize: 28, labelSize: 12 });
  bullets(s, [
    "자동 등록은 보수적 규칙(개별 실공고·미등록·마감 전·대출/행사/고용/대학원 제외)을 전부 통과한 것만 대상으로 한다",
    "자동 등록분은 앱에서 '자동 등록 · 검수 전' 배지로 표시한다 — 검수 전인 것을 검수된 것처럼 보이게 하지 않는다",
    "금액·마감이 원문에서 확인되지 않으면 추정치를 만들지 않고 '원문 확인'으로 두며, 합계 금액에서도 제외한다",
    "매일 자동 데이터 감사가 금액·마감·서식 연결 오류를 차단한다. 오등록은 차단 목록으로 즉시 제거된다",
  ], 3.0, 2.4, 12.5);
  callout(s, M, 5.0, CW, 0.9,
    "정확도 관리의 원칙은 하나 — 모르는 것을 아는 척하지 않는다.",
    { size: 15 });
  footer(s);
}

// B6
{
  const s = backupSlide("백업 B6 · 질의응답용", "대학이 실제로 돈을 낼 것인가");
  s.addTable(
    tableRows(
      ["논점", "근거"],
      [
        [{ text: "예산은 있는가", b: true }, "대학은 이미 학사·장학관리 시스템에 연 1,000만~5,000만 원을 지출한다 [공개 조사].\n신규 예산 신설이 아니라 기존 정보화 예산 안의 경쟁이다"],
        [{ text: "왜 도입하는가", b: true }, "장학금 집행률·수혜율이 대학 평가지표다. 수혜율 개선은 학교의 직접 이익이다"],
        [{ text: "도입 저항", b: true }, "학사 시스템 교체가 아니라 공고 게시와 접수 단계만 얹는 구조라 전산 연동 부담이 작다"],
        [{ text: "영업 진입점", b: true }, "\"귀교 학생 N명이 이미 사용 중\" 데이터를 들고 들어간다 — 1분기 확산 목표에서 나오는 숫자다"],
        [{ text: "가격", b: true }, "하한 1,200만 원 / 재학생 1만 명 이상 3,000만 원. 파일럿은 할인 적용"],
      ]
    ),
    { x: M, y: 1.55, w: CW, colW: [2.6, 9.433], rowH: 0.72, border: { pt: 0.5, color: "DDE3E9" } }
  );
  footer(s);
}

// B7
{
  const s = backupSlide("백업 B7 · 질의응답용", "대학이 직접 만들면 어떻게 되나");
  bullets(s, [
    "대학 포털은 자기 학교 교내 공고만 다룬다. 학생이 받는 장학금의 상당수는 교외 재단 공고이며, 여기에 대학 단위 게시는 구조적으로 불가능하다",
    "우리가 파는 것은 목록이 아니라 교내·교외·타교를 가로지르는 매칭과 신청 완결이다. 한 학교가 자체 구축해도 이 범위는 나오지 않는다",
    "190개교가 각자 만들면 학생은 다시 190개를 돌아야 한다 — 분산이 문제의 원인이므로, 학교별 자체 구축은 해법이 아니다",
  ], 1.55, 2.5);
  callout(s, M, 4.3, CW, 1.5,
    "따라서 대학과 우리는 경쟁이 아니라 채널 관계다.\n대학 SaaS가 1순위 수익원인 이유가 여기 있다.",
    { size: 15 });
  footer(s);
}

// B8
{
  const s = backupSlide("백업 B8 · 질의응답용", "지식재산과 방어 수단");
  s.addTable(
    tableRows(
      ["보호 대상", "내용", "수단", "시기"],
      [
        ["수집 엔진", "게시판 3유형 대응 · 실패 자동 진단", "소스 비공개(영업비밀) + 접근권한 통제", { text: "적용 중", b: true }],
        ["서식 변환 엔진", "HWP · PDF → 앱 서식 자동 변환", "소스 비공개 + 특허 출원 검토", "26년 하반기"],
        ["브랜드", "서비스명 · 로고 \"한대장\"", "상표 출원", "26년 하반기"],
      ]
    ),
    { x: M, y: 1.55, w: CW, colW: [2.4, 4.2, 4.0, 1.433], rowH: 0.62, border: { pt: 0.5, color: "DDE3E9" } }
  );
  callout(s, M, 4.3, CW, 1.75,
    "현재 등록 지식재산권은 없다.\n예비창업 단계에서 방어의 실체는 특허가 아니라\n45개 캠퍼스 수집망의 축적과 이를 2시간~2일에 늘리는 운영 역량이며,\n이는 공개해도 복제에 시간이 드는 종류의 자산이다.",
    { size: 14 });
  footer(s);
}

pres.writeFile({ fileName: "한대장_판교VI_발표.pptx" }).then((f) => console.log("saved:", f));
