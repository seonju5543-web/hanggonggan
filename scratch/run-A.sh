sleep(){ echo "[mock sleep $*]"; }
git(){ echo "[mock git $*]"; return 0; }
# 🔴 **두 번까지 본다** (2026-10-04 로봇·도구 점검). 배포 직후에 돌면 Pages 가 아직 옛 판을 내보내는 사이일 수 있다
#    (#384 — 배포 1분 뒤 실행 ❌ · 5분 뒤 다시 돌리니 통과). 처음에 어긋나면 3분 쉬고
#    **저장소 main 도 그때 것으로 다시 받아** 한 번 더 본다. 두 번 다 어긋날 때만 경보다.
#    (대조 스크립트는 회차마다 /tmp/try.out 에 쓰고, 끝에 마지막 회차 값만 진짜 출력으로 옮긴다.)
for try in 1 2; do
if [ "$try" = 2 ]; then
  echo
  echo "⏳ Pages 배포가 진행 중일 수 있어 3분 뒤 다시 봅니다 (저장소 main 도 그때 것으로 다시 받습니다)"
  sleep 180
  git fetch -q origin main && git checkout -q --detach FETCH_HEAD || echo "⚠️ main 을 다시 받지 못했습니다 — 처음 받은 판으로 다시 봅니다"
fi
rm -rf live
mkdir -p live

# 🔴 **앱이 실제로 받는 파일을 본다** (2026-09-29 신설).
#    그전까지 이 점검은 data/notices.json·registered.json·forms.json 만 봤는데,
#    앱은 2026-08-17부터 공고를, 09-26부터 학과 목록을 **학교별 파일**에서 읽는다.
#    즉 **앱이 안 받는 파일을 검사하고, 정작 받는 파일은 아무도 안 보고 있었다.**
#    그 파일이 404면 앱은 옛 파일·전국 공통 목록으로 **조용히 물러난다** — 화면상
#    아무 일도 안 일어난 것처럼 보여서 이 점검이 없으면 영영 모른다.
#    ⚠️ 파일 이름을 여기 박지 않는다 — match-engine.js 의 규칙으로 뽑는다(앱과 같은 곳).
EXTRA=$(node -e "
  const M = require('./match-engine.js');
  const fs = require('fs');
  const out = ['data/notices/index.json'];
  // 공고: 색인에 있는 학교 전부 (2026-09-29 부터 44개교 — 색인이 정한다, 여기 박지 않는다)
  try {
    const ni = JSON.parse(fs.readFileSync('data/notices/index.json','utf8'));
    for (const k of Object.keys(ni.files)) out.push(M.noticeFilesForProfile({school:k})[0]);
  } catch {}
  // 학과: 전부 받으면 209번이라, 두 곳만 — 하나는 **별칭을 거친 이름**(KAIST)으로 고른다.
  //       커리어넷 이름과 앱 이름이 달라 2026-09-26까지 7곳이 조용히 안 받아지고 있었다.
  for (const k of ['한국외국어대학교','KAIST']) out.push(M.majorsFileFor(k));
  // 교내 소식 (2026-09-30): 색인이 있는 학교 전부 — 앱이 받는 파일이므로 여기서도 본다(CLAUDE.md 「명령」 규칙)
  try {
    const nx = JSON.parse(fs.readFileSync('data/news/index.json','utf8'));
    out.push('data/news/index.json');
    for (const k of Object.keys(nx.files)) out.push(M.newsFilesForProfile({school:k})[0]);
  } catch {}
  // 소식 사진 (2026-10-03): 실린 글의 썸네일 세 장 — 앱이 받는 그림이므로 여기서도 본다(아래에서 바이트로 비교)
  try {
    let k = 0;
    for (const f of fs.readdirSync('data/news')) {
      if (!/\.json$/.test(f) || f === 'index.json') continue;
      const t = (JSON.parse(fs.readFileSync('data/news/' + f, 'utf8')).items || []).find((n) => n.thumb);
      if (t) { out.push(t.thumb); if (++k >= 3) break; }
    }
  } catch {}
  // 원문 링크 확인 (2026-10-03): 로봇이 확정한 문제 링크 — 앱이 이것을 받아 링크 이름을 정직하게 바꾼다.
  //   안 나가면 앱은 확정된 목록·404 링크를 그대로 '원문 공고'라 부른다(404 여도 조용히 물러난다).
  out.push('data/link-check.json');
  // 관리자가 넣은 원문 공고 주소 (2026-10-04): 앱이 이것을 받아 목록·홈 링크 대신 그 공고로 연다 — 안 나가면 넣어도 조용히 안 보인다.
  out.push('data/link-fixes.json');
  // 학교 대표 사진 (2026-10-03): 글에 사진이 없을 때 앱이 받는 목록 + 그 첫 그림 하나 (바이트로 비교)
  try {
    const sp = JSON.parse(fs.readFileSync('assets/schools/photos.json', 'utf8'));
    out.push('assets/schools/photos.json');
    const first = Object.values(sp.schools || {})[0];
    if (first && first[0]) out.push(first[0].src);
  } catch {}
  console.log([...new Set(out)].join(' '));
")

# 🔴 앱이 받는 그 밖의 파일 (2026-10-04 로봇·도구 점검) — 이 점검이 대외활동·재단·층2·등록금·검색 요약·자기소개서 규칙 둘·
#    정문 사진 목록·약관을 안 봐서 404 여도 초록이었다. 손 목록을 만들지 않고 **앱 스크립트의 fetch·getDoc 글자**에서 뽑는다
#    (tools/app-fetch-files.cjs — 앱이 새 파일을 받게 되면 저절로 따라온다). 위 목록·EXTRA 에 이미 있는 것은 뺀다.
APP_FILES=$(node -e "
  const { appFetchFiles } = require('./tools/app-fetch-files.cjs');
  const skip = new Set(['sw.js', 'app.js', 'data/notices.json', 'data/registered.json', 'data/forms.json', ...process.argv.slice(1)]);
  console.log(appFetchFiles('.').filter((f) => !skip.has(f)).join(' '));
" $EXTRA)

for f in sw.js app.js data/notices.json data/registered.json data/forms.json $EXTRA $APP_FILES; do
  mkdir -p "live/$(dirname "$f")"
  curl -sSL --max-time 30 -H 'Cache-Control: no-cache' "$SITE/$f" -o "live/$f" || echo "받기 실패: $f"
done
echo "— 앱이 실제로 받는 파일도 확인: $EXTRA —"
echo "— 앱 스크립트가 받는 그 밖의 파일: $APP_FILES —"

echo "— 캐시 응답 헤더(참고) —"
curl -sSI --max-time 30 "$SITE/data/registered.json" | grep -i "cache-control\|etag\|last-modified" || true

: > /tmp/try.out
EXTRA_FILES="$EXTRA" APP_FILES="$APP_FILES" GITHUB_OUTPUT=/tmp/try.out node - <<'EOF'
const fs = require('fs');
/* 파일마다 담는 모양이 달라서(공고=items 배열, 양식=templates 목록) 개수를 각각 센다.
   모양을 못 읽으면 '읽기실패'로 남겨 두 쪽 다 undefined라 통과해 버리는 일이 없게 한다. */
const count = (p) => {
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    /* ⚠️ `majors` 도 안다 — 모르면 학과 파일에서 **칸 수 3**(school·updatedAt·majors)을
       세어, 내용이 달라도 3 대 3 으로 통과한다(404 만 겨우 잡힌다). */
    const box = j.items || j.templates || j.majors || (/assets[\/\\]schools[\/\\]photos\.json$/.test(p) ? j.schools : null) || j;   // schools 는 학교 사진 목록에서만 — 색인 파일의 schools 는 숫자라 '읽기실패' 끼리 같다고 세면 404 도 통과한다(리뷰 10-03)
       /* 🔴 빗금은 두 가지를 다 받는다 (2026-10-03). 로봇은 리눅스라 `/` 지만, 개발자 컴퓨터(윈도우)에서
          관문이 이 함수를 떼어 **진짜 파일 경로**로 돌리면 `C:\…\assets\schools\photos.json` 이라
          `/` 만 보는 정규식이 안 걸렸다. 그러면 j 통째(칸 2개)를 세어 35 대신 2 가 나오고,
          관문이 개발자 화면에서만 빨간불이 된다 — 이 저장소가 네 번 겪은 그 유형이다. */
    if (Array.isArray(box)) return box.length;
    if (box && typeof box === 'object') return Object.keys(box).length;
    return '읽기실패';
  } catch { return '읽기실패'; }
};
/* 그림은 개수가 아니라 **바이트 수**로 — 404 쪽(HTML)·빈 파일은 WebP 서명이 없어 '읽기실패'라 같다고 세지 않는다 */
const bytes = (p) => { try { const b = fs.readFileSync(p); return b.length > 12 && b.toString('latin1', 8, 12) === 'WEBP' ? b.length : '읽기실패'; } catch { return '읽기실패'; } };
const cache = (p) => { try { return (fs.readFileSync(p, 'utf8').match(/const CACHE = '([^']+)'/) || [,'?'])[1]; } catch { return '?'; } };
/* 원문 링크 확인 장부는 칸이 셋(updatedAt·v·bad)뿐이라 `count` 로 세면 늘 3 대 3 이다 —
   문제 건수 + 확인 시각으로 잰다(시각이 다르면 어제 결과가 안 나간 것이다). bad 칸이 없으면 '읽기실패'. */
const linkCheck = (p) => { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return j && j.bad && typeof j.bad === 'object' ? `${Object.keys(j.bad).length}건+${Object.keys(j.fix || {}).length}@${String(j.updatedAt || '-').slice(0, 16)}` : '읽기실패'; } catch { return '읽기실패'; } };
// 관리자 바로잡기(data/link-fixes.json)는 bad 가 없고 fix 만 있다 — 건수·시각으로 비교(못 읽으면 '읽기실패' · 404 를 통과로 세지 않는다)
const linkFixes = (p) => { try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return j && j.fix && typeof j.fix === 'object' ? `${Object.keys(j.fix).length}건@${String(j.updatedAt || '-').slice(0, 16)}` : '읽기실패'; } catch { return '읽기실패'; } };
/* 앱이 받는 그 밖의 파일·색인은 **바이트 수 + 지문**으로 (2026-10-04) — Pages 는 머리말 없는 파일을 바이트 그대로 내보내므로
   같아야 정상이다. 개수로 세면 칸 수만 같아도 통과한다(색인은 칸 넷 대 넷). 404 쪽(HTML)은 지문이 달라 같다고 세지 않는다. */
const hash = (p) => { try { const b = fs.readFileSync(p); return `${b.length}B#${require('crypto').createHash('sha1').update(b).digest('hex').slice(0, 8)}`; } catch { return '읽기실패'; } };
const rows = [
  ['서비스워커 버전', cache('sw.js'), cache('live/sw.js')],
  ['실시간 공고(옛)', count('data/notices.json'), count('live/data/notices.json')],
  ['정식 등록', count('data/registered.json'), count('live/data/registered.json')],
  ['양식', count('data/forms.json'), count('live/data/forms.json')],
];
/* 🔴 **앱이 실제로 받는 학교별 파일** — 위 목록은 앱이 더 이상 받지 않는 파일들이다.
   이 줄들이 ❌ 면 학생은 옛 파일·전국 공통 목록으로 조용히 물러나고 있다는 뜻이다.
   ⚠️ `count` 는 못 읽으면 '읽기실패'를 주므로, 404 를 통과로 세는 일이 없다. */
const extra = (process.env.EXTRA_FILES || '').split(/\s+/).filter(Boolean);
for (const f of extra) {
  const label = f.startsWith('data/majors/') ? '학과(학교별)'
    : f === 'data/link-check.json' ? '원문 링크 확인'
    : f === 'data/link-fixes.json' ? '원문 바로잡기'
    : f.startsWith('data/news/img/') ? '소식 사진'
    : f.startsWith('assets/schools/') ? (f.endsWith('.json') ? '학교 사진 목록' : '학교 사진')
    : f.startsWith('data/news/') ? (f.endsWith('index.json') ? '소식 색인' : '소식(학교별)')
    : f.endsWith('index.json') ? '공고 색인' : '공고(학교별)';
  const measure = f.endsWith('.webp') ? bytes : count;
  const m = f === 'data/link-check.json' ? linkCheck : f === 'data/link-fixes.json' ? linkFixes : measure;   // 원문 링크 확인·바로잡기는 건수·시각으로(위 linkCheck·linkFixes)
  rows.push([`${label} ${f.split('/').pop()}`, m(f), m('live/' + f)]);
}
const appFiles = (process.env.APP_FILES || '').split(/\s+/).filter(Boolean);
for (const f of appFiles) rows.push([`앱이 받는 파일 ${f}`, hash(f), hash('live/' + f)]);
for (const f of ['data/notices/index.json', 'data/news/index.json']) rows.push([`색인 지문 ${f.split('/').slice(-2).join('/')}`, hash(f), hash('live/' + f)]);
let bad = 0;
const diffs = [];
console.log('\n항목             저장소(main)   실제 앱   결과');
for (const [name, repo, live] of rows) {
  const ok = String(repo) === String(live);
  if (!ok) { bad++; diffs.push(`· ${name} — 저장소 ${repo} · 앱 ${live}`); }
  console.log(`${name.padEnd(16)} ${String(repo).padEnd(13)} ${String(live).padEnd(9)} ${ok ? '✅ 같음' : '❌ 다름'}`);
}
const appOk = fs.existsSync('live/app.js') && fs.readFileSync('live/app.js', 'utf8').length > 1000;
console.log(`앱 코드 내려받기 ${appOk ? '✅ 정상' : '❌ 실패'}`);
if (!appOk) { bad++; diffs.push('· 앱 코드 내려받기 실패'); }
fs.appendFileSync(process.env.GITHUB_OUTPUT, `bad=${bad}\n`);
fs.appendFileSync(process.env.GITHUB_OUTPUT, `diff<<__LIVE_DIFF__\n${diffs.join('\n') || '(없음)'}\n__LIVE_DIFF__\n`);
console.log(bad === 0
  ? '\n✅ 배포된 앱이 저장소와 같습니다 — 사용자는 재설치 없이 최신 내용을 봅니다.'
  : `\n❌ ${bad}개 항목이 어긋납니다 (Pages 배포가 아직 안 끝났거나 동기화 실패).`);
EOF
bad=$(sed -n 's/^bad=//p' /tmp/try.out | tail -1)
[ "$bad" = "0" ] && break
done
cat /tmp/try.out >> "$GITHUB_OUTPUT"
