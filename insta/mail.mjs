/**
 * 준비된 카드를 **메일 한 통**으로 만든다 (보내는 것은 워크플로의 curl).
 *
 * 🔴 GitHub 이슈 알림에 기대지 않는다 — 그건 GitHub 알림함으로 가고 꺼 둘 수도 있다.
 *    은서 메일함으로 직접 간다.
 * 🔴 그림을 첨부하지 않고 **공개 주소를 <img> 로 건다** — 카드는 이미 Pages 에 올라가 있고,
 *    첨부를 만들면 MIME 조립이 늘어난다. 워크플로가 `--wait-only` 로 **열리는 것을 확인한 뒤**
 *    이 메일을 만든다(아직 404 면 메일에 깨진 그림이 박힌다).
 * 🔴 주소는 publish.mjs 에 묻는다 — 여기 베끼면 기다린 주소와 갈라진다.
 *
 * 쓰기: node insta/mail.mjs --dir=insta/pub/<날짜> --to=... --from=...  > mail.txt
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=') : d;
};
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const dir = arg('dir');
const to = arg('to');
const from = arg('from', to);
const run = arg('run', '');
if (!dir || !to) { console.error('--dir= 과 --to= 가 필요합니다.'); process.exit(1); }

const root = new URL('../', import.meta.url);
const meta = JSON.parse(readFileSync(new URL(`${dir}/meta.json`, root), 'utf8'));
const caption = readFileSync(new URL(`${dir}/caption.txt`, root), 'utf8').trim();
const urls = execFileSync('node', ['insta/mail-urls.mjs', `--dir=${dir}`], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

// 🔴 제목에 공고 이름을 넣는다 — 메일함에서 제목만 보고도 무엇인지 알아야 누른다.
const subject = `[한대장] 인스타 카드 준비됐습니다 — ${meta.org} ${meta.name}`;
const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
<p style="font-size:15px;line-height:1.7">
<b>${esc(meta.org)}</b><br>${esc(meta.name)}</p>
<p style="font-size:15px;line-height:1.7">카드가 준비됐습니다. 보고 괜찮으면 아래 버튼으로 올리면 됩니다.<br>
마음에 안 들면 <b>그냥 두세요</b> — 아무것도 안 올라갑니다.</p>
${urls.map((u) => `<img src="${u}" width="300" style="display:block;margin:12px 0;border-radius:12px;border:1px solid #e5e5e5">`).join('\n')}
<p style="font-size:13px;color:#666;margin-top:24px">캡션</p>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.7;background:#f7f7f7;padding:16px;border-radius:12px">${esc(caption)}</pre>
<p style="font-size:15px;line-height:1.8;margin-top:24px">
<a href="https://github.com/${process.env.GITHUB_REPOSITORY || 'seonju5543-web/hanggonggan'}/actions/workflows/insta.yml"
   style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">올리기 → Run workflow → 게시</a></p>
<p style="font-size:13px;color:#666;line-height:1.8">
· 판형을 바꾸려면 「준비만」 을 <code>tpl</code> 을 photo·chat·note 로 지정해 다시 돌리세요.<br>
${run ? `· 원본 PNG: <a href="${run}">실행 기록</a><br>` : ''}
· 다음 준비는 월·목 아침 8:41 입니다.</p></div>`;

// 🔴 한글 제목·본문은 그냥 실으면 깨진다 — 제목은 RFC 2047, 본문은 base64 로 싣는다.
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
process.stdout.write([
  `From: 한대장 로봇 <${from}>`,
  `To: ${to}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '', b64(html), '',
].join('\r\n'));
