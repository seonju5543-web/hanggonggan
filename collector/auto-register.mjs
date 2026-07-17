/* ============================================================
   한대장 — 정식 등록 자동화 (선조치후보고)
   수집 로봇이 발행한 실시간 공고 중, 보수적 규칙을 전부 통과한
   '개별 실공고'만 data/registered.json에 자동 등록한다.

   운영 원칙(2026-07-15 개발자 지시로 도입):
   - 자동 등록분은 auto: true 로 표시되고 앱에 '자동 등록 · 검수 전' 배지가 붙는다
     → 사용자에게 큐레이션 검수 전임을 정직하게 알린다.
   - 모든 자동 등록·제외 판단은 리포트(report.md)에 기록된다 (선조치후보고).
   - 끄기: collector/auto-register-config.json 의 "enabled": false
   - 잘못 등록된 건 되돌리기: 같은 파일 "blockIds" 배열에 id를 넣으면 다음 실행 때 제거된다.

   실행: node collector/auto-register.mjs   (collect.mjs 직후, 워크플로에서 자동 실행)
   ============================================================ */
import fs from 'node:fs';

const HERE = new URL('.', import.meta.url);
const cfgPath = new URL('auto-register-config.json', HERE);
let cfg = { enabled: true, maxPerRun: 8, blockIds: [] };
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgPath, 'utf8')) }; } catch { /* 기본값 */ }

const noticesPath = new URL('../data/notices.json', HERE);
const registeredPath = new URL('../data/registered.json', HERE);
// 리포트 파일은 인자로 바꿀 수 있다 (브라우저형 수집기는 browser-report.md 사용)
const reportPath = process.argv[2] ? new URL(process.argv[2], new URL('..', HERE)) : new URL('report.md', HERE);
const notices = JSON.parse(fs.readFileSync(noticesPath, 'utf8'));
const registered = JSON.parse(fs.readFileSync(registeredPath, 'utf8'));

const TODAY = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // KST

/* ---------- URL 정규화: 목록 파라미터(sort·페이지 등)를 떼고 글 식별자만 남긴다 ---------- */
const ID_PARAMS = /^(seq|articleno|bbs_seq|duid|list_id|entryid|bbsidx|menu_id|contents_no|site_no|board_seq|menuno|no|ntt|nttsn|idx|wr_id|bidx)$/i;
export function canonUrl(raw) {
  try {
    const u = new URL(raw);
    const keep = [];
    for (const [k, v] of u.searchParams) if (ID_PARAMS.test(k) && v) keep.push(`${k.toLowerCase()}=${v}`);
    keep.sort();
    // 클릭형 게시판(경희 등)은 목록 주소+제목 표식(#n-…)이 글의 정체성이다 — 떼면 서로 뭉개진다
    const marker = u.hash && u.hash.startsWith('#n-') ? u.hash : '';
    return u.origin + u.pathname + (keep.length ? '?' + keep.join('&') : '') + marker;
  } catch { return (raw || '').split('#')[0]; }
}

/* 제목 유사도 — 4글자 조각(4-gram) 겹침 비율. 재게시·접수분 중복 감지용 */
function titleSim(a, b) {
  if (!a || !b) return 0;
  const grams = (s) => { const g = new Set(); for (let i = 0; i <= s.length - 4; i++) g.add(s.slice(i, i + 4)); return g; };
  const [ga, gb] = [grams(a), grams(b)];
  const [small, big] = ga.size <= gb.size ? [ga, gb] : [gb, ga];
  if (!small.size) return 0;
  let hit = 0;
  for (const g of small) if (big.has(g)) hit++;
  return hit / small.size;
}

/* ---------- 제목 청소: 클릭형 게시판이 목록에서 그대로 읽어온 부스러기 제거 ---------- */
export function cleanTitle(t) {
  return (t || '')
    .replace(/^(공지\s*)+/, '')                       // "공지 공지 " 접두
    .replace(/^\d{3,5}\s+/, '')                        // 목록 행 번호 "2653 "
    .replace(/\s*20\d{2}\.\d{1,2}\.\d{1,2}\.?\s*조회\s*\d+\s*$/, '') // 꼬리 "2026.07.08. 조회 136"
    .replace(/\s*조회\s*\d+\s*$/, '')
    .replace(/신규게시글|Attachment|새글/g, '')
    .replace(/\s+/g, ' ').trim();
}

/* ---------- 제목 정규화: 학교별 재게시·꼬리표 차이를 흡수 ---------- */
const normTitle = (t) => cleanTitle(t).replace(/\[[^\]]*\]/g, '').replace(/[\s·ㆍ()~〜.,'"“”‘’!⭐★]/g, '').replace(/공지/g, '').toLowerCase();

/* ---------- 재단명 추출: 같은 재단 사업의 학교별 재게시를 식별 ---------- */
const GENERIC_FOUNDATION = /^(한국|국가|대학|교내|교외|학교|서울|재단)$/;
export function foundationKey(t) {
  const m = cleanTitle(t).match(/([가-힣A-Za-z]{2,10})\s*(장학재단|장학회|장학관|청암재단|문화재단)/);
  if (!m || GENERIC_FOUNDATION.test(m[1])) return null;
  return m[1];
}

/* ---------- 판정 규칙 (verify/list-unregistered.js와 동일 계열 + 자동화용 강화) ---------- */
const NON_NOTICE = /^(장학금 종류|장학금 신청|장학\/?학자금|장학 및 학자금|학자금 대출|장학금·학자금|국가장학금 및 학자금대출|국제화장학금|교외장학재단|근로장학공고게시판|네오르네상스장학|장학금안내|장학\(공지\)|학생지원팀|학생지원센터|장학 및 학자금 대출|학자금 중복지원)/;
const LOAN = /학자금\s?대출|학자금융자|무이자|이자지원|대출 신청|대출 안내|대출 관련/;
const EVENT = /교육\s*\*|참가팀 모집|참가자 선발|운영계획서|포스터$|Q&amp;A|Q&A|설명회|박람회|공모전|연수|탐방/;
const MENU_TAIL = /\[등록\/장학\]\s*$|^\d+\.\s|^\(붙임|^\(신청서식|^\(공고문|\.pdf$|\.hwp$|\.zip$/i;
const EMPLOYMENT = /채용|조교(?!.*장학금)|근무자 모집|직원 모집/;
const NOT_UNDERGRAD = /대학원생?\s|석사|박사|수련의|졸업(생|자)\s*대상|T\/AS|강의보조/;
const ADMIN_NOTICE = /출근부|지급\s*안내|지급일|계좌\s*등록|서류\s*보완|유의사항\s*안내|중복지원|반환|환수|추천서\s*(총장|직인)|안내\s*및\s*FAQ/;
const FUTURE_PLAN = /202[7-9](?![\d])[^\d]*(학년도|년).*(유학|연수|입학|신입학)|신입학|입학전형/;
const POSITIVE = /(장학생|장학금)/;
const ACTION = /(선발|모집|신청|추천|접수)/;

/* 마감 후보 추출 — 명확한 것만 (YYYY.M.D / ~M/D는 연도 불명이라 제외) */
function parseDeadline(n) {
  const hay = `${n.title} ${n.deadlineHint || ''}`;
  const m = hay.match(/~\s*(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})/) ||
            hay.match(/(\d{4})[.\-\/\s]+(\d{1,2})[.\-\/\s]+(\d{1,2})\s*[^\d]{0,6}(까지|마감)/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  // 연도 없는 "~7.03"·"~7/19" — 올해로 해석 (마감 경과 거르기용)
  const m2 = hay.match(/~\s*(\d{1,2})[.\/](\d{1,2})/);
  if (m2) return `${TODAY.slice(0, 4)}-${String(m2[1]).padStart(2, '0')}-${String(m2[2]).padStart(2, '0')}`;
  return null;
}

function classify(n, regUrlSet, regEntries, batchSeen) {
  const t = n.title || '';
  const cu = canonUrl(n.url);
  const nt = normTitle(t);
  if (regUrlSet.has(cu)) return { verdict: 'skip', why: '이미 등록(원문 동일)' };
  if (batchSeen.has(cu) || batchSeen.has(n.school + '|' + nt)) return { verdict: 'skip', why: '이번 실행 내 중복' };
  if (t.length < 8) return { verdict: 'skip', why: '제목 파편' };
  if (/\[?마감\]/.test(t)) return { verdict: 'skip', why: '게시판에 마감 표시됨' };
  if (NON_NOTICE.test(t) || MENU_TAIL.test(t)) return { verdict: 'skip', why: '메뉴·안내 페이지' };
  if (LOAN.test(t)) return { verdict: 'skip', why: '학자금 대출·융자(장학금 아님)' };
  if (EVENT.test(t)) return { verdict: 'skip', why: '행사·연수·설명회(신청형 장학 아님)' };
  if (EMPLOYMENT.test(t)) return { verdict: 'skip', why: '채용·고용성' };
  if (NOT_UNDERGRAD.test(t)) return { verdict: 'skip', why: '학부생 대상 아님(대학원 등)' };
  if (ADMIN_NOTICE.test(t)) return { verdict: 'skip', why: '행정 안내(신청 공고 아님)' };
  if (FUTURE_PLAN.test(t)) return { verdict: 'skip', why: '차년도 계획·신입학(현 재학생 신청 대상 아님)' };
  if (/국가장학금/.test(t)) return { verdict: 'skip', why: '국가장학금 상시 제도 — 앱 내 카드로 이미 안내' };
  if (!POSITIVE.test(t)) return { verdict: 'skip', why: "'장학' 신호 없음" };
  // 2027년 이후 연도가 제목에 있으면 미래 사업일 가능성 — 자동 등록하지 않고 컨펌 대기
  const years = (t.match(/20\d{2}/g) || []).map(Number);
  if (years.some((y) => y >= 2027)) return { verdict: 'hold', why: '2027년 이후 사업으로 보임 — 개발자 컨펌 대기' };
  // 같은 재단·같은 사업 감지: ① 제목 유사도(4-gram) ② 재단명 일치
  // 같은 학교(또는 전국 등록분)와 겹치면 = 재게시 중복(스킵), 다른 학교와 겹치면 = 타교 접수분일 수 있음(컨펌 대기)
  const fk = foundationKey(t);
  const similars = regEntries.filter((r) => titleSim(nt, r.nt) >= 0.55 || (fk && r.name.includes(fk)));
  if (similars.length) {
    // 같은 학교(또는 전국) 등록분이 하나라도 있으면 재게시 중복 — 타교뿐이면 접수분일 수 있어 컨펌 대기
    const same = similars.find((r) => !r.school || r.school === n.school);
    if (same) return { verdict: 'skip', why: `이미 등록(동일 사업: ${same.name.slice(0, 24)})` };
    return { verdict: 'hold', why: `타교 등록분과 동일 사업(${similars[0].name.slice(0, 24)}) — 접수분 여부 컨펌 대기` };
  }
  if (!ACTION.test(t)) return { verdict: 'hold', why: '선발·모집·신청 신호 없음 — 개발자 컨펌 대기' };
  const deadline = parseDeadline(n);
  if (deadline && deadline < TODAY) return { verdict: 'skip', why: `마감 경과(${deadline})` };
  return { verdict: 'register', deadline };
}

/* ---------- 실행 ---------- */
const report = [];
if (!cfg.enabled) {
  report.push('', '### 🤝 자동 등록: 꺼짐 (auto-register-config.json enabled=false)');
} else {
  const regUrlSet = new Set(registered.items.map((i) => canonUrl(i.sourceUrl || '')).filter(Boolean));
  const regEntries = registered.items.map((i) => ({
    name: i.name || '',
    // "(동국대 접수)" 같은 꼬리표는 떼고 사업명만 비교
    nt: normTitle((i.name || '').replace(/\([^)]*\)/g, '')),
    school: (i.eligibility && i.eligibility.schoolOnly) || '',
  }));
  const batchSeen = new Set();
  const added = [];
  const held = [];

  // blockIds: 개발자가 지정한 잘못된 자동 등록분 제거 (되돌리기 장치)
  const before = registered.items.length;
  registered.items = registered.items.filter((i) => !(i.auto && (cfg.blockIds || []).includes(i.id)));
  const removed = before - registered.items.length;

  for (const n of notices.items || []) {
    if (added.length >= (cfg.maxPerRun || 8)) break;
    const r = classify(n, regUrlSet, regEntries, batchSeen);
    if (r.verdict === 'hold') { held.push({ n, why: r.why }); continue; }
    if (r.verdict !== 'register') continue;
    const cu = canonUrl(n.url);
    batchSeen.add(cu);
    batchSeen.add(n.school + '|' + normTitle(n.title));
    // 첨부는 신청서·공고문류만 (게시판 메뉴 링크 오염 방지)
    const atts = (n.attachments || [])
      .filter((a) => /신청서|지원서|서식|양식|공고/.test(a.name) && /\.(hwp|hwpx|doc|docx|pdf|zip|xlsx?)(\?|$)?/i.test(a.name + a.url))
      .slice(0, 4);
    const id = 'auto-' + cu.replace(/[^a-z0-9]/gi, '').slice(-24).toLowerCase();
    if (registered.items.some((i) => i.id === id)) continue;
    const title = cleanTitle(n.title).slice(0, 70);
    const entry = {
      id,
      name: title,
      type: /교외|재단|장학회|재청|시민|청암|문화재단/.test(title) ? '교외' : '교내',
      provider: `${n.school}${n.campus ? ' ' + n.campus : ''} 게시 공고`,
      amount: '장학금 (세부 원문 확인)',
      amountValue: 500000,
      deadline: r.deadline || null,
      period: r.deadline ? `접수 ~${r.deadline}` : '접수 기간 원문 확인',
      summary: `${n.school} 게시판에서 수집돼 자동 등록된 공고예요(검수 전). 지원 자격·금액·마감·신청 방법은 반드시 원문 공고에서 확인하세요.`,
      eligibility: { selective: true, schoolOnly: n.school, ...(n.campus ? { campusOnly: n.campus } : {}) },
      documents: ['지원 자격·제출 서류는 원문 공고에서 확인'],
      duplicable: true,
      note: '수집 로봇이 자동 등록한 공고예요(검수 전). 세부 내용이 실제와 다를 수 있으니 원문 공고를 꼭 확인하세요.',
      noForm: `자동 등록(검수 전) ${TODAY} — 양식 스키마화는 검수 후 진행`,
      auto: true,
      attachments: atts,
      sourceUrl: n.url,
      sourceKind: 'auto'
    };
    registered.items.push(entry);
    regUrlSet.add(cu);
    regEntries.push({ name: title, nt: normTitle(title), school: n.school });
    added.push(entry);
  }

  if (added.length || removed) {
    registered.updatedAt = TODAY;
    fs.writeFileSync(registeredPath, JSON.stringify(registered, null, 1) + '\n');
  }

  // 스키마화 대기 큐: 신청서 첨부가 있는 자동 등록분은 워크플로가 곧바로 원본을
  // 내려받고(pending-forms.json → deepfetch), 다음 Claude 세션이 스키마화한다.
  // 목표: '원본 양식 다운로드형' 채널이 하루 이상 남아 있지 않게 한다.
  const queuePath = new URL('pending-forms.json', HERE);
  let queue = { items: [] };
  try { queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')); } catch { /* 첫 실행 */ }
  let queued = 0;
  for (const e of added) {
    if (!(e.attachments || []).some((a) => /신청서|지원서|서식|양식/.test(a.name))) continue;
    if (queue.items.some((q) => q.id === e.id)) continue;
    // deepfetch가 제목 부분일치로 대상을 찾으므로, 부스러기 없는 제목 앞부분을 표적으로 쓴다
    const target = cleanTitle(e.name).replace(/\[[^\]]*\]/g, '').trim().slice(0, 12);
    queue.items.push({ id: e.id, name: e.name, target, added: TODAY, fetched: false, schematized: false });
    queued++;
  }
  if (queued) {
    fs.writeFileSync(queuePath, JSON.stringify(queue, null, 1) + '\n');
    report.push('', `**🧩 양식 원본 자동 확보 예약 ${queued}건** — 원본은 이 실행에서 바로 내려받고, 스키마화(앱 내 작성 전환)는 다음 Claude 세션이 처리해요.`);
  }
  const waiting = queue.items.filter((q) => q.fetched && !q.schematized).length;
  if (waiting) report.push('', `**⏳ 스키마화 대기 중 ${waiting}건** (원본 확보됨 — collector/pending-forms.json)`);

  report.push('', `### 🤖 자동 등록 (선조치후보고) — ${added.length}건 등록${removed ? ` · ${removed}건 제거(blockIds)` : ''}`);
  if (added.length) {
    report.push('', '자동 등록분은 앱에 **자동 등록 · 검수 전** 배지로 표시돼요. 잘못 등록된 건이 있으면 채팅으로 알려주시거나 `collector/auto-register-config.json`의 `blockIds`에 id를 넣어주세요.', '');
    for (const e of added) report.push(`- \`${e.id}\` [${e.name}](${e.sourceUrl})${e.deadline ? ` · 마감 ${e.deadline}` : ''} · ${(e.eligibility.schoolOnly || '')}`);
  } else {
    report.push('', '이번 실행에서 자동 등록 기준(개별 실공고·미등록·마감 전)을 전부 통과한 공고가 없어요.');
  }
  if (held.length) {
    report.push('', `**컨펌 대기 (자동 기준 미달 ${held.length}건)** — 장학 신호는 있지만 선발·모집 신호가 약해요:`);
    for (const h of held.slice(0, 10)) report.push(`- ${h.n.title.slice(0, 60)} (${h.why})`);
  }
}

if (fs.existsSync(reportPath)) fs.appendFileSync(reportPath, report.join('\n') + '\n');
console.log(report.join('\n').trim() || 'auto-register: no-op');
