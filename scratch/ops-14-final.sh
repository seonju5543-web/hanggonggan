#!/usr/bin/env bash
# ops-14 (Node 24 판 액션) — 모든 묶음을 합친 뒤 마지막 한 커밋으로 다시 적용한다 (리뷰 R2 · fix/ops 의 2f2e649d 가 14a5dc94 를 되돌렸다)
# 쓰는 법: cd <합친 작업본> && bash <이 파일>   → 결과를 보고 커밋한다(이 스크립트는 커밋하지 않는다)
# 하는 일: ① 워크플로·로컬 액션의 판 줄 치환(다른 줄은 손대지 않는다) ② 판 번호를 박은 두 관문 정규식을 @v\d+ 로 ③ 관문 ops ⑦ 더하기 ④ 관문 실행
# upload-artifact 는 바꾸지 않는다 — Node 24 판의 릴리스 노트를 확인한 뒤 따로(⑦ 이름표가 그렇게 말한다)
set -euo pipefail
[ -f verify/health-gates/ops.mjs ] || { echo "저장소 맨 위에서 돌리세요"; exit 1; }
FILES=$(ls .github/workflows/*.yml .github/workflows/*.yaml .github/actions/*/action.yml 2>/dev/null || true)
# ① 판 줄
sed -i -E \
  -e 's#actions/checkout@v[1-4]\b#actions/checkout@v5#g' \
  -e 's#actions/setup-node@v[1-4]\b#actions/setup-node@v5#g' \
  -e 's#actions/github-script@v[1-7]\b#actions/github-script@v8#g' \
  -e "s#(node-version:[[:space:]]*)(['\"]?)(1[0-9]|20)\2([[:space:]]*[},]|[[:space:]]*\$|[[:space:]]+\#)#\1\222\2\4#g" \
  $FILES
# ② 판 번호를 박은 관문 정규식(실제 워크플로 글자를 잰다) — 없으면 건너뛴다
sed -i 's#- uses: actions\\/checkout@v4\\n\\s+with:#- uses: actions\\/checkout@v\\d+\\n\\s+with:#g' verify/test-collector.mjs verify/health-gates/refresh.mjs
# ③ 관문 ops ⑦ — 이미 있으면 더하지 않는다
if ! grep -q '── ⑦ ops-14' verify/health-gates/ops.mjs; then
python3 - <<'PY'
p='verify/health-gates/ops.mjs'
s=open(p,encoding='utf8').read()
block = r"""
  /* ── ⑦ ops-14 Node 20 판 액션이 남지 않았다 (워크플로·로컬 액션 전부 · 모든 묶음을 합친 뒤 마지막 한 커밋으로 넣었다) ── */
  {
    const files = [
      ...fs.readdirSync(new URL('.github/workflows/', root)).filter((f) => /\.ya?ml$/.test(f)).map((f) => `.github/workflows/${f}`),
      ...fs.readdirSync(new URL('.github/actions/', root)).map((d) => `.github/actions/${d}/action.yml`).filter((f) => fs.existsSync(new URL(f, root))),
    ];
    const OLD = [/actions\/(checkout|setup-node)@v[1-4]\b/, /actions\/github-script@v[1-7]\b/, /node-version:\s*['"]?(1\d|20)\b/];
    const left = files.filter((f) => { const t = read(root, f).split('\n').filter((l) => !/^\s*#/.test(l)).join('\n'); return OLD.some((re) => re.test(t)); });
    eq('⑦ ops-14 워크플로·로컬 액션을 읽어 냈다 (못 읽으면 아래가 헛돈다)', files.length > 30, true);
    eqCode(`  checkout·setup-node v4 이하 · github-script v7 이하 · node-version 20 이하가 0곳 (지금 ${left.length}곳 · upload-artifact 는 아직 — 릴리스 노트 확인 뒤)`, left, []);
  }
}
"""
i = s.rstrip().rfind('}')
s = s[:i].rstrip() + '\n' + block
open(p,'w',encoding='utf8').write(s)
PY
fi
node --check verify/health-gates/ops.mjs
echo "■ 남은 옛 판(0줄이어야 한다):"
grep -nE "actions/(checkout|setup-node)@v[1-4]\b|actions/github-script@v[1-7]\b|node-version:[[:space:]]*['\"]?(1[0-9]|20)\b" $FILES | grep -v '^\s*#' || echo "   없음"
node verify/health-gates.mjs ops
