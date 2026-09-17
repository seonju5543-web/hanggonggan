/**
 * 준비된 카드를 **메일 한 통**으로 만든다 (보내는 것은 워크플로의 curl).
 *
 * 🔴 받는 사람은 `insta/team.json` 의 **개발자 셋 전부**다(2026-09-12 개발자 지시 —
 *    "은서뿐만 아니라 개발자 세 명에게 모두 메일로 제시"). `--to` 를 주면 그걸 쓴다.
 * 🔴 한 실행에서 준비한 게시물이 여럿이면 **한 통에 다 담는다**(`--dirs=a,b,c`).
 *    공고당 한 통씩 보내면 하루 여섯 통이 세 사람에게 가서 아무도 안 읽게 된다.
 * 🔴 그림을 첨부하지 않고 **공개 주소를 <img> 로 건다** — 카드는 이미 Pages 에 올라가 있고,
 *    첨부를 만들면 MIME 조립이 늘어난다. 워크플로가 `--wait-only` 로 **열리는 것을 확인한 뒤**
 *    이 메일을 만든다(아직 404 면 메일에 깨진 그림이 박힌다).
 * 🔴 주소는 publish.mjs 에 묻는다 — 여기 베끼면 기다린 주소와 갈라진다.
 * 🔴 판형은 **번호로** 안내한다(`insta/templates.json`) — 개발자가 "3번으로" 라고 답할 수 있게.
 *
 * 쓰기: node insta/mail.mjs --dirs=insta/pub/<코드>[,…] [--to=a@x,b@y] --from=... [--run=URL] [--subject=...]  > mail.txt
 *       (예전 `--dir=` 도 받는다)
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const root = new URL('../', import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const dirs = (arg('dirs') || arg('dir') || '').split(',').map((s) => s.trim()).filter(Boolean);
const team = J('insta/team.json').people;
const to = (arg('to') || team.map((p) => p.email).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const from = arg('from', to[0]);
const run = arg('run', '');
const kind = arg('kind', 'ready');          // ready(새로 준비) · revised(채팅에서 고침)
if (!dirs.length || !to.length) { console.error('--dirs= 와 받는 사람이 필요합니다.'); process.exit(1); }

const tpls = J('insta/templates.json').templates;
const tplName = (no) => { const t = tpls.find((x) => x.no === no); return t ? `${t.no}번 ${t.name}` : `${no}번`; };
const repo = process.env.GITHUB_REPOSITORY || 'seonju5543-web/hanggonggan';

const posts = dirs.map((dir) => {
  const meta = J(`${dir}/meta.json`);
  const caption = readFileSync(new URL(`${dir}/caption.txt`, root), 'utf8').trim();
  const urls = execFileSync('node', ['insta/mail-urls.mjs', `--dir=${dir}`], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  return { dir, meta, caption, urls };
});

// 🔴 제목에 공고 이름을 넣는다 — 메일함에서 제목만 보고도 무엇인지 알아야 누른다.
const first = posts[0].meta;
const subject = arg('subject') || (kind === 'revised'
  ? `[한대장] 인스타 카드 수정본 — ${first.org} ${first.name}`
  : posts.length === 1
    ? `[한대장] 인스타 카드 준비됐습니다 — ${first.org} ${first.name}`
    : `[한대장] 인스타 카드 ${posts.length}건 준비됐습니다 — ${first.org} ${first.name} 외 ${posts.length - 1}건`);

const postHtml = ({ meta, caption, urls }) => `
<div style="border-top:1px solid #e5e5e5;padding-top:18px;margin-top:22px">
<p style="font-size:15px;line-height:1.7;margin:0 0 6px">
<b>${esc(meta.org)}</b><br>${esc(meta.name)}<br>
<span style="color:#666;font-size:13px">마감 ${esc(meta.due || '원문 확인')} · 판형 ${esc(tplName(meta.tplNo))}${meta.font ? ` · 글꼴 ${esc(meta.font)}` : ''} · 공고 코드 <code>${esc(meta.code)}</code></span></p>
<div style="display:flex;flex-wrap:wrap;gap:8px">
${urls.map((u) => `<img src="${u}" width="200" style="display:block;border-radius:10px;border:1px solid #e5e5e5">`).join('\n')}
</div>
<details style="margin-top:10px"><summary style="font-size:13px;color:#666;cursor:pointer">캡션 보기</summary>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7;background:#f7f7f7;padding:14px;border-radius:10px">${esc(caption)}</pre></details>
</div>`;

const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;color:#1a1a1a">
<p style="font-size:15px;line-height:1.7">${kind === 'revised'
    ? '채팅에서 고친 <b>수정본</b>입니다. 이대로 괜찮으면 관리자 화면에서 올리면 됩니다.'
    : `새 공고 <b>${posts.length}건</b>의 카드가 준비됐습니다. 보고 괜찮으면 관리자 화면 → 인스타 에서 <b>게시</b>를 누르면 됩니다.`}<br>
마음에 안 들면 <b>그냥 두세요</b> — 아무것도 안 올라갑니다.</p>
${posts.map(postHtml).join('\n')}
<p style="font-size:15px;line-height:1.8;margin-top:26px">
<a href="https://hanggonggan-admin.pages.dev/#insta"
   style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">관리자 화면에서 보기 · 올리기</a></p>
<p style="font-size:13px;color:#666;line-height:1.8">
· 고치고 싶으면 Claude Code 채팅에 그대로 말하면 됩니다 — 예: “<code>${esc(first.code)}</code> 3번 판형으로”, “글꼴 바꿔”, “2장 문구 줄여”.
  수정본 그림을 먼저 보여 드리고, 메일로 다시 보낼지 물어본 뒤 보냅니다.<br>
· 판형 번호: ${tpls.map((t) => `${t.no}번 ${esc(t.name)}`).join(' · ')}<br>
${run ? `· 원본 PNG: <a href="${run}">실행 기록</a><br>` : ''}
· 새 공고가 수집되면 그때마다 카드를 그려 이 메일이 옵니다.</p></div>`;

// 🔴 한글 제목·본문은 그냥 실으면 깨진다 — 제목은 RFC 2047, 본문은 base64 로 싣는다.
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
process.stdout.write([
  `From: 한대장 로봇 <${from}>`,
  `To: ${to.join(', ')}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '', b64(html), '',
].join('\r\n'));
