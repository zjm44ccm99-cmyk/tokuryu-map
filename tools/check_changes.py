"""自動更新がコミットする前の安全確認。リポジトリのルートで: python3 tools/check_changes.py
問題があれば理由を表示して終了コード1を返す。その場合はコミット・pushしないこと。"""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ALLOWED = re.compile(r'^(data\.js|og\.png|sitemap\.xml|robots\.txt|pref/[a-z]+\.html|pref/index\.html)$')
problems = []

def git(*a):
    return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True).stdout

changed = set(filter(None, git('diff', '--name-only', 'origin/main').splitlines()))
changed |= set(filter(None, git('ls-files', '--others', '--exclude-standard').splitlines()))
for f in sorted(changed):
    if not ALLOWED.match(f):
        problems.append(f'自動更新で変えてはいけないファイルが変わっている: {f}')

js = r"""
const fs=require('fs'),vm=require('vm');const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.__d={UPDATED,TYPES,PLACES,CASES};',ctx);
process.stdout.write(JSON.stringify(ctx.__d));"""
try:
    D = json.loads(subprocess.run(['node', '-e', js, os.path.join(ROOT, 'data.js')],
                                  capture_output=True, text=True, check=True).stdout)
except Exception as ex:
    print('data.js を読み込めない:', ex); sys.exit(1)

types = set(D['TYPES'])
for i, c in enumerate(D['CASES']):
    tag = f"CASES[{i}] {c.get('pref')}{c.get('city')}"
    if c.get('type') not in types: problems.append(f'{tag}: 種別が不正')
    if f"{c.get('pref')}|{c.get('city')}" not in D['PLACES']: problems.append(f'{tag}: PLACES に場所がない')
    if not str(c.get('url', '')).startswith('https://'): problems.append(f'{tag}: 出典URLが https で始まらない')
    for k in ('desc', 'src', 'show', 'city', 'url'):
        v = str(c.get(k, ''))
        if re.search(r'<|>|javascript:|data:|on\w+=', v, re.I):
            problems.append(f'{tag}: {k} にHTMLやスクリプトのような文字列がある')
        if k == 'desc' and len(v) > 200:
            problems.append(f'{tag}: 説明が長すぎる（200字超）')
    if re.search(r'@[\w.-]+\.\w+|\d{2,4}-\d{2,4}-\d{3,4}', str(c.get('desc', ''))):
        problems.append(f'{tag}: 説明にメールアドレスや電話番号のようなものがある')

if problems:
    print('安全確認で止めました：'); [print(' -', p) for p in problems]; sys.exit(1)
print(f'安全確認OK（変更ファイル {len(changed)} 件、事件 {len(D["CASES"])} 件）')
