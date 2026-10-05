/* 「로봇·도구 점검 관문」 qnotice 묶음 — 장학 공고 글 품질·양식·메일 접수 (2026-10-05 대대적 점검)
   잰다:
     ① 메일 접수 — 예외·서류 전용 (app1-04): '오류 발생 시에만' 쓰는 예비 메일·'신청은 다른 곳 · 메일은 서류만' 줄은 접수처가 아니다
        (고려대 송화재단 · 연세대 신문고 실례 — 큰 '접수 메일 열기' 버튼이 학생을 예비 메일함으로 보냈다) ·
        이미 들어간 로봇 값도 매 실행 다시 묻는다(staleApplyEmail) · **진짜 extract-excerpts.mjs 를 임시 폴더에서 돌려** 지워지는지 본다
   🔴 표본(고정 예시)만 잰다 — data/·collector/ 장부를 읽어 단정하지 말 것(verify/health-gates.mjs 머리말).
      로봇을 돌릴 때는 저장소 코드를 임시 폴더로 **복사**해 그 안의 표본만 읽고 쓴다(bodies.mjs sandbox). */
import { sandbox } from './bodies.mjs';
import { judgeLine, findApplyEmail, staleApplyEmail } from '../../collector/apply-email.mjs';

export default async function qnotice(eq, ctx) {
  const root = ctx.root;

  /* ── ① 메일 접수 — 예외·서류 전용 ── */
  {
    const take = (line, before) => { const v = judgeLine(line, before); return v && v.ok ? 'ok' : (v ? v.why : null); };
    const KOREA = '※ 온라인 신청 오류 발생 시 scholarship@korea.ac.kr로 제출';
    const YONSEI = "… 들어가 하단에 있는 '새글'버튼을 눌러 신청서를 작성 하여주시기 바랍니다. ('새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨) 관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다. 메일 발송 시 반드시 제목은 ‘신문고장학금(";
    eq('① 오류 발생 시에만 쓰는 예비 메일은 접수처가 아니다 (고려대 송화재단 원문)', take(KOREA), '예외 경로(오류·불가피 시)');
    eq('  업로드 오류 때 서류 메일도 (조선대 원문)', take('※ 업로드 오류 발생 시 이메일 서류제출 : scholarship@chosun.ac.kr'), '예외 경로(오류·불가피 시)');
    eq('  신청은 새글·저장으로 끝나고 메일은 서류만 (연세대 신문고 원문)', take(YONSEI), '신청은 다른 경로 — 메일은 서류만');
    /* 같은 공고의 다른 판 — 두 말이 앞 줄과 메일 줄로 갈라져 있다 */
    const Y_LINES = [
      "신문고장학금(재난) 신청을 원하시면 신문고 장학금 탭에 들어가 하단에 있는 '새글'버튼을 눌러 신청서를 작성하여주시기 바랍니다. ('새글'버튼을 눌러서 신청서 작성 후 저장해야 장학금 신청 완료됨)",
      '관련 제출서류는 scholar@yonsei.ac.kr로 보내주시기 바랍니다. 메일 발송 시 반드시 제목은 ‘신문고장학금(재난) 서류 제출(학번, 이름)’ 형식으로 기재하시기 바랍니다.',
    ];
    eq('  앞 줄이 다른 경로를 말하면 서류 메일 줄도 접수처가 아니다', findApplyEmail(Y_LINES.join('\n')), null);
    eq('  (앞 줄 없이 그 줄만 보면 받는다 — 앞 줄을 넘기는 것이 하는 일)', take(Y_LINES[1]), 'ok');
    /* 계속 받아야 하는 줄 — test-collector 「메일 접수 주소」의 받는 줄 넷 + 합성 하나 */
    for (const l of [
      '9. 지원방법 : [ 붙임 ] 의 신청서를 작성하여 관재팀 이메일 (khsa0063@khu.ac.kr) 로 제출',
      '◯ 접수주소 : nohsy12@518.org (※우편접수 불가)',
      '⑥ 서류 준비 및 메일(injae@uri.re.kr)로 신청서(3종), 증빙서류 제출',
      '다 . 멘토활동계획서 제출 방법 : 이메일 : scholarship@hufs.ac.kr 또는 장학팀 ( 학생회관 121 호 ) 직접 제출',
      '[합성] 신청서를 작성하여 이메일(a@b.ac.kr)로 제출하면 신청이 완료됩니다',
      '❍ 신청서 및 구비서류 전부 e-mail 제출 (jh@sri.re.kr )',
    ]) eq(`  받는 줄은 그대로 받는다: ${l.slice(0, 28)}…`, take(l), 'ok');
    eq('  홈페이지에서 신청서를 받아 메일로 내는 공고는 메일 접수다',
      findApplyEmail('가. 홈페이지에서 신청서 양식 다운로드\n나. 작성한 신청서와 증빙서류를 apply@found.or.kr 로 제출')?.email, 'apply@found.or.kr');

    /* 이미 들어간 값 — 로봇 값만 다시 묻는다 */
    const robot = (src) => ({ applyEmail: 'scholarship@korea.ac.kr', applyEmailSource: src, applyEmailFrom: '공고 원문' });
    eq('  로봇 값 + 예외 줄 → 걷는다', staleApplyEmail(robot(KOREA)), true);
    eq('  사람(관리자) 값은 건드리지 않는다', staleApplyEmail({ ...robot(KOREA), applyEmailFrom: '관리자 2026-10-04' }), false);
    eq('  정상 근거면 그대로', staleApplyEmail(robot('5. 접수 : 2026. 10. 16.(금) 오후 5시까지 scholarship@korea.ac.kr 으로 제출')), false);
    eq('  잘린 근거라 내는 낱말이 창 밖이면 지우지 않는다(본문 없는 날 멀쩡한 주소를 잃는다)',
      staleApplyEmail(robot('… 붙임 서식 작성 · 사진 첨부 · 스캔본 하나로 scholarship@korea.ac.kr …')), false);

    /* 진짜 발췌기를 임시 폴더에서 — 예외 줄로 들어간 값은 지우고, 같은 본문의 정상 줄이 있으면 새 규칙으로 다시 찾는다 */
    const sb = sandbox(root, 'hdj-qnotice-mail-');
    try {
      const U1 = 'https://www.korea.ac.kr/notice/1';
      const U2 = 'https://www.korea.ac.kr/notice/2';
      /* 본문 분량(한글 MIN_BODY)을 넘겨야 '원문 있음' 길로 간다 */
      const BODY = '지원 대상은 국내 대학에 재학 중인 학부생으로서 직전 학기 성적이 평균 이상인 학생입니다.\n'
        + '선발된 학생에게는 한 학기 등록금 전액과 생활비를 함께 지원하며 학업 계획서를 심사합니다.\n';
      sb.write('collector/extracted/notices-text.json', [
        { title: '2026 표본재단 장학생 선발', url: U1, text: BODY + '6. 신청방법 : 방문 제출 또는 온라인 신청\n' + KOREA + '\n7. 문의 : 장학팀' },
        { title: '2026 표본장학회 장학생 선발', url: U2, text: BODY + '5. 접수 : 2026. 10. 16.(금) 오후 5시까지 ga@sample.com 으로 제출\n' + KOREA },
      ]);
      sb.write('data/registered.json', { items: [
        { id: 't1', name: '2026 표본재단 장학생 선발', sourceUrl: U1, ...robot(KOREA) },
        { id: 't2', name: '2026 표본장학회 장학생 선발', sourceUrl: U2, ...robot(KOREA) },
        { id: 't3', name: '2026 사람이 넣은 메일', sourceUrl: 'https://x.ac.kr/3', ...robot(KOREA), applyEmailFrom: '관리자 2026-10-04' },
      ] });
      const r = sb.run('collector/extract-excerpts.mjs', ['--write'], { EXCERPTS_AS_LIB: '' });   // test-collector 가 켜 둔 '라이브러리로만' 스위치를 끈다
      const out = sb.json('data/registered.json');
      const by = Object.fromEntries((out?.items || []).map((x) => [x.id, x]));
      eq('  [발췌기 실행] 끝까지 돈다', r.status, 0);
      eq('  [발췌기 실행] 예외 줄로 들어간 메일 세 칸을 걷는다', [by.t1?.applyEmail, by.t1?.applyEmailSource, by.t1?.applyEmailFrom], [undefined, undefined, undefined]);
      eq('  [발췌기 실행] 같은 본문의 정상 줄이 있으면 새 규칙으로 다시 찾는다', by.t2?.applyEmail, 'ga@sample.com');
      eq('  [발췌기 실행] 사람이 넣은 값은 그대로', by.t3?.applyEmail, 'scholarship@korea.ac.kr');
    } finally { sb.done?.(); }
  }
}
