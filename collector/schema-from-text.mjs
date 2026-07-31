/* ============================================================
   원본 글자 → 양식 스키마 변환기 (무료 경로 · 2026-07-31)

   지금까지 '무료 경로'로 분류된 신청서(글자가 깨끗하게 뽑히는 HWP·HWPX·DOCX)는
   다음 Claude 채팅 세션이 손으로 옮길 때까지 큐에서 기다렸다. 개발자 지시로
   **기다림 없이 그 자리에서 앱 양식으로 승격**시키기 위해, 규칙만으로 옮기는
   변환기를 만들었다. API를 부르지 않으므로 비용은 0이다.

   원본 글자에서 읽는 모양 (실제 원본 4종으로 맞춤):
     ① 표형 셀      "<재적학교><      학교      대학      과    학년>"
     ② 번호형       "1. 성       명              (한자        )남・여"
     ③ 콜론형       "학    번 :            (인 또는 서명)"
     ④ 점선 마감형  "주  소                                        ."
     ⑤ 체크형       "□ 동의함           □ 동의하지 않음"
   한 파일에 신청서·자기소개서·추천서가 함께 든 경우가 많아, 제목 칸을 만나면
   문서를 나누고 **제3자가 쓰는 서식(추천서 등)은 통째로 뺀다**.

   확신이 서지 않으면(항목이 너무 적거나 공고문이면) 옮기지 않고 사유를 돌려준다 —
   원본과 다른 문서를 만드느니 다운로드 안내를 유지하는 편이 정직하다(운영 원칙 4).
   ============================================================ */

const THIRD_PARTY = /추천서|추천\s*양식|소견서|재직증명|확인서\s*\(기관/;
const FORM_TITLE = /신청서|지원서|선발원서|지급원서|입학원서|원서|동의서|서약서|자기소개서|계획서|이력서|신청\s*서류\s*양식/;
const NOTICE_DOC = /지원\s*기간\s*:|접수\s*기간\s*:|제출\s*처\s*:|문의\s*처\s*:|선발\s*기준|장학금명\s*:/;
/* 파일 이름이 공고문·안내문이면 채울 칸이 있는 서식이 아니다 (남가주 신청공고 사례) */
const NOTICE_FILE = /공고|안내문|모집요강|리플릿|포스터/;
/* "1) 장학금 신청서 1부" 같은 목록 항목은 문서 제목이 아니다 */
const LIST_ITEM = /^\s*(\d+[).]|[가-하][).]|[-·•])\s/;

const INFO_MAP = [
  [/^(성명|이름|신청인성명|지원자)$/, 'name'],
  [/^(학번)$/, 'studentId'],
  [/^(학과|전공|학부학과|소속학과|전공분야|학과전공)$/, 'major'],
  [/^(학교|대학교|재적학교|소속대학|학교명|소속)$/, 'school'],
  [/^(연락처|전화번호|휴대전화|핸드폰|전화|이동전화|긴급연락처)$/, 'phone'],
  [/^(이메일|이메일주소|email|e-?mail)$/i, 'email'],
];

const TEXTAREA = /사유|계획|동기|소개|포부|내용|의견|경위|성장|과정|활동|특기|신조|인생관|성격|장래|비고/;

const squeeze = (s) => String(s || '').replace(/[　]/g, ' ').replace(/\s+/g, ' ').trim();
/* "성       명" 처럼 글자 사이를 벌려 놓은 라벨은 공백을 없애야 원래 낱말이 된다 */
const tight = (s) => {
  const t = squeeze(s);
  return /^([가-힣A-Za-z][ ]){1,}[가-힣A-Za-z]$/.test(t) ? t.replace(/ /g, '') : t;
};
const clean = (s) => tight(String(s || '').replace(/[<>【】\[\]■☞※◯]/g, ' ').replace(/[.·・:：,]+\s*$/, ''));
const key = (s) => clean(s).replace(/\s/g, '');
/* "전화 (   -   -   )" 처럼 빈 괄호가 붙은 라벨에서 알맹이만 남긴다 */
const bare = (s) => key(s).replace(/\([^)]*\)/g, '').replace(/[()（）]/g, '');

const isBlank = (c) => c === undefined || /^[\s_.…\-()（）~∼㊞인]*$/.test(String(c));

/* 항목이 아니라 칸 장식인 것들 — 사진칸, (한글)/(한자) 같은 부속칸, 도장·서명 자리 */
const NOT_A_FIELD = /^(사진|사진란|한글|한문|한자|인|서명|날인|직인|이상|위|계|합계|비고|인적사항|위원인)$/;
/* 채우는 칸이 아니라 설명·안내 문구 */
const INSTRUCTION = /아래에|기재하|작성하여|바랍니다|해당사항|참고하|다음과 같이|등의 내용/;
function isLabel(text, { long = false } = {}) {
  const t = clean(text);
  if (!t || !/[가-힣]/.test(t)) return false;
  if (t.length > (long ? 40 : 16)) return false;
  if (/귀중|귀하|합니다|바랍니다|하시기|년\s*월\s*일|^20\d*$|^\d+$/.test(t)) return false;
  if (!bare(t)) return false;                 // "(한 글)"처럼 괄호 부속칸만 남는 것
  if (NOT_A_FIELD.test(bare(t))) return false;
  if (INSTRUCTION.test(t)) return false;
  return true;
}

function fieldId(label, used) {
  const base = 'f_' + (label.replace(/[^가-힣a-zA-Z0-9]/g, '') || 'item')
    .split('').map((ch) => (/[a-zA-Z0-9]/.test(ch) ? ch.toLowerCase() : ch.charCodeAt(0).toString(36))).join('')
    .slice(0, 22);
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

function makeField(label, used, forceType) {
  const l = clean(label);
  const f = { id: fieldId(l, used), label: l, type: forceType || 'text', q: `${l}을(를) 적어 주세요.` };
  if (!forceType && (TEXTAREA.test(l) || l.length > 14)) { f.type = 'textarea'; f.q = `${l} — 원본 서식대로 작성해 주세요.`; }
  if (/^성별$/.test(key(l))) { f.type = 'checks'; f.options = ['남', '여']; f.q = '성별을 선택해 주세요.'; }
  if (/병역구분/.test(key(l))) { f.type = 'checks'; f.options = ['필', '미필', '면제', '해당없음']; f.q = '병역 구분을 선택해 주세요.'; }
  return f;
}

/* ---------- 원본을 훑어 문서(신청서/자소서/추천서…)별 항목을 모은다 ---------- */
function walk(text) {
  const docs = [{ head: '', labels: [], checks: [], pledge: '', org: '' }];
  const cur = () => docs[docs.length - 1];
  const push = (label, opts) => { if (isLabel(label, opts)) cur().labels.push(clean(label)); };

  /* 제목 칸에 뒷말이 붙어 있으면 제목까지만 쓴다 ("자기소개서   성명:" → "자기소개서") */
  const titleOf = (t) => {
    const c = clean(t);
    const m = c.match(FORM_TITLE) || c.match(THIRD_PARTY);
    return m ? clean(c.slice(0, m.index + m[0].length)) : c;
  };
  const startDoc = (head) => {
    if (cur().labels.length === 0 && cur().checks.length === 0 && !cur().head) { cur().head = clean(head); return; }
    docs.push({ head: clean(head), labels: [], checks: [], pledge: '', org: '' });
  };

  const handleText = (raw) => {
    const t = squeeze(raw);
    if (!t) return;

    /* 문서 제목 → 여기서부터 새 문서 */
    const ct = clean(t);   // "장  학  지  원  서" → "장학지원서"
    if ((FORM_TITLE.test(ct) || THIRD_PARTY.test(ct)) && !LIST_ITEM.test(t) && titleOf(ct).length <= 22) { startDoc(titleOf(ct)); return; }
    if (/^첨부\s*\d+$|^제\s*\d+\s*호\s*서식$|^별지\s*제?\s*\d+\s*호/.test(clean(t))) { startDoc(''); return; }

    if (/귀\s*중|귀\s*하/.test(t)) {
      const o = clean(t.split(/귀\s*중|귀\s*하/)[0]).split(/\s{2,}/).pop();
      if (o && o.length <= 24 && !cur().org) cur().org = o;
      return;
    }
    if (/(본인은|위\s*학생|상기).{0,60}(합니다|하겠습니다|서약)/.test(t)) {
      if (!cur().pledge) cur().pledge = t.replace(/\s+/g, ' ').slice(0, 200);
      return;
    }

    /* ⑤ 체크형 */
    const boxes = t.match(/[□☐▢○●]\s*[^□☐▢○●\n]{1,20}/g);
    if (boxes && boxes.length >= 2) {
      const options = boxes.map((b) => clean(b.replace(/^[□☐▢○●]\s*/, ''))).filter(Boolean);
      if (options.length >= 2) cur().checks.push(options);
      return;
    }

    /* ③ 콜론형 */
    const colon = t.match(/^([^:：]{1,20})[:：]/);
    if (colon && isLabel(colon[1])) { push(colon[1]); return; }

    /* ② 번호형 */
    const num = t.match(/^\s*\d+\s*[.)]\s*(.+)$/);
    if (num) {
      let body = num[1];
      if (/남\s*[·・\/]\s*여/.test(body)) { push('성별'); body = body.replace(/남\s*[·・\/]\s*여/g, ' '); }
      const paren = body.match(/\(([^)]{1,10})\)/);
      if (paren && /[가-힣]/.test(paren[1]) && !/만\s*세/.test(paren[1])) push(paren[1]);
      push(body.replace(/\([^)]*\)/g, ' ').split(/\s{3,}|☏|\.{2,}/)[0]);
      return;
    }

    /* ④ 점선 마감형·기호 마감형: "주  소            ." / "성  명       ㊞  ☏" */
    const tail = raw.match(/^\s*([가-힣][가-힣\s]{0,14}?)\s{2,}[\s.…_㊞☏()\-]*$/);
    if (tail) { push(tail[1]); return; }
  };

  for (const raw of text.split('\n')) {
    const line = raw.replace(/　/g, ' ');
    if (!squeeze(line)) continue;

    /* 칸이 여러 개인 줄만 표로 읽는다. 칸 하나짜리 줄(제목 칸 등)은 글줄로 읽어야
       제목·번호 항목을 놓치지 않는다 (염곡 "…남・여<>" / 가송 "<자 기 소 개 서 …>" 사례) */
    if (!/></.test(line)) { handleText(line.replace(/^\s*<|>\s*$/g, ' ')); continue; }
    if (true) {
      const cells = line.split(/></).map((c) => c.replace(/^\s*</, '').replace(/>\s*$/, ''));
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const t = clean(c);
        if (!t) continue;
        if ((FORM_TITLE.test(t) || THIRD_PARTY.test(t)) && !LIST_ITEM.test(t) && clean(titleOf(c)).length <= 22) { startDoc(titleOf(c)); continue; }
        if (/[□☐▢○●]/.test(c) || /귀\s*중|본인은|합니다/.test(c)) { handleText(c); continue; }
        /* 라벨 옆이 빈칸이면 확실한 항목, 아니면 짧은 라벨만 인정 */
        if (isLabel(c, { long: isBlank(cells[i + 1]) })) cur().labels.push(t);
      }
      continue;
    }
    handleText(line);
  }
  return docs;
}

/* ---------- 본체 ---------- */
export function schemaFromText(text, { notice = '', attachment = '', org = '' } = {}) {
  if (!text || text.length < 60) return { ok: false, why: '원본에서 읽은 글자가 너무 적음' };
  if (THIRD_PARTY.test(attachment)) return { ok: false, why: '제3자 작성 서식' };

  const used = new Set();
  const usedInfoKeys = new Set();
  const docs = walk(text);
  const sections = [];
  let pledge = '', orgName = org, title = '';

  for (const d of docs) {
    if (THIRD_PARTY.test(d.head)) continue;            // 추천서 등은 통째로 제외
    if (!d.labels.length && !d.checks.length) continue;

    const info = [];
    const fields = [];
    const seen = new Set();
    for (const label of d.labels) {
      const k = key(label);
      if (seen.has(k)) continue;
      seen.add(k);
      const hit = INFO_MAP.find(([re]) => re.test(bare(label)));
      /* 같은 칸(예: 연락처)이 두 번 나오면 첫 번째만 프로필에서 자동으로 채우고,
         나머지는 별도 입력칸으로 둔다 — 둘 다 같은 값이 들어가면 원본과 달라진다 */
      if (hit && !usedInfoKeys.has(hit[1])) { usedInfoKeys.add(hit[1]); info.push(clean(label), hit[1]); }
      else fields.push(makeField(label, used));
    }
    d.checks.forEach((options, i) => {
      const label = /동의/.test(options.join()) ? '동의 여부' : `선택 ${i + 1}`;
      const f = makeField(label, used, 'checks');
      f.options = options;
      f.q = `${label}를 선택해 주세요.`;
      fields.push(f);
    });

    /* 동의서: 표에 적힌 수집 항목·목적·기간은 '읽는 내용'이지 채우는 칸이 아니다 */
    if (/동의서/.test(d.head || '')) {
      const desc = fields.filter((f) => f.type !== 'checks').map((f) => f.label);
      const keep = fields.filter((f) => f.type === 'checks');
      if (keep.length) { fields.length = 0; fields.push(...keep); if (desc.length) d.note = desc.join(' / ').slice(0, 400); }
    }

    if (!fields.length && !info.length) continue;
    if (!title) title = d.head;
    if (!pledge && d.pledge) pledge = d.pledge;
    if (!orgName && d.org) orgName = d.org;

    const sec = { heading: d.head || '신청 내용', fields };
    if (d.note) sec.note = d.note;
    if (info.length) {
      /* 한 줄에 두 칸씩 — 기존 양식 스키마와 같은 모양. 홀수로 남는 칸은 한 칸짜리 줄로 둔다
         (빈 칸을 채워 넣으면 '허용되지 않은 info 키'로 검증에 걸린다) */
      sec.info = [];
      for (let i = 0; i < info.length; i += 4) sec.info.push(info.slice(i, i + 4));
    }
    sections.push(sec);
  }

  const fieldCount = sections.reduce((n, s) => n + s.fields.length, 0);
  const infoCount = sections.reduce((n, s) => n + (s.info ? s.info[0].length / 2 : 0), 0);
  if (NOTICE_FILE.test(String(attachment))) return { ok: false, why: '공고문·안내문 파일(채울 칸이 있는 서식 아님)' };
  const looksForm = FORM_TITLE.test(title) || FORM_TITLE.test(String(attachment));

  if (!looksForm && NOTICE_DOC.test(text)) return { ok: false, why: '공고문(안내문)이라 채울 칸이 없음' };
  if (!sections.length) return { ok: false, why: '옮길 항목을 찾지 못함' };
  if (!looksForm && fieldCount + infoCount < 5) return { ok: false, why: '신청서로 보기 어려움(항목 부족)' };
  if (fieldCount + infoCount < 3) return { ok: false, why: `옮길 항목이 너무 적음(${fieldCount + infoCount}개)` };

  const autoNote = '원본 첨부 파일에서 항목을 그대로 옮겨 만든 서식이에요. 제출 전 원본과 한 번 비교해 주세요.';
  sections[0].note = sections[0].note ? `${sections[0].note} · ${autoNote}` : autoNote;

  const tpl = {
    title: title || clean(String(attachment).replace(/\.(hwp|hwpx|docx?|pdf)$/i, '')) || '장학금 신청서',
    docName: String(attachment || title || 'form').replace(/\.(hwp|hwpx|docx?|pdf)$/i, '').replace(/[^가-힣A-Za-z0-9]+/g, '_').slice(0, 40),
    org: orgName || String(notice).slice(0, 30),
    sections,
  };
  if (pledge) tpl.pledge = pledge;
  return { ok: true, tpl, stats: { fields: fieldCount, info: infoCount, sections: sections.length } };
}
