"""都道府県別ページ（pref/）と sitemap.xml・robots.txt を data.js から作る。
リポジトリのルートで: python3 tools/gen_pages.py
data.js を更新したら毎回実行する。手で pref/ を編集しない。"""
import json, math, os, subprocess, html, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
BASE = 'https://zjm44ccm99-cmyk.github.io/tokuryu-map/'

# 名前, スラッグ, 県庁所在地の緯度経度
PREFS = [
 ("北海道","hokkaido",43.064,141.347),("青森","aomori",40.824,140.740),("岩手","iwate",39.704,141.153),
 ("宮城","miyagi",38.269,140.872),("秋田","akita",39.719,140.102),("山形","yamagata",38.240,140.364),
 ("福島","fukushima",37.750,140.468),("茨城","ibaraki",36.342,140.447),("栃木","tochigi",36.566,139.884),
 ("群馬","gunma",36.391,139.061),("埼玉","saitama",35.857,139.649),("千葉","chiba",35.605,140.123),
 ("東京","tokyo",35.690,139.692),("神奈川","kanagawa",35.448,139.643),("新潟","niigata",37.902,139.023),
 ("富山","toyama",36.695,137.211),("石川","ishikawa",36.594,136.626),("福井","fukui",36.065,136.222),
 ("山梨","yamanashi",35.664,138.568),("長野","nagano",36.651,138.181),("岐阜","gifu",35.391,136.722),
 ("静岡","shizuoka",34.977,138.383),("愛知","aichi",35.180,136.907),("三重","mie",34.730,136.509),
 ("滋賀","shiga",35.004,135.868),("京都","kyoto",35.021,135.756),("大阪","osaka",34.686,135.520),
 ("兵庫","hyogo",34.691,135.183),("奈良","nara",34.685,135.833),("和歌山","wakayama",34.226,135.168),
 ("鳥取","tottori",35.504,134.238),("島根","shimane",35.472,133.051),("岡山","okayama",34.662,133.935),
 ("広島","hiroshima",34.397,132.460),("山口","yamaguchi",34.186,131.471),("徳島","tokushima",34.066,134.559),
 ("香川","kagawa",34.340,134.043),("愛媛","ehime",33.842,132.766),("高知","kochi",33.560,133.531),
 ("福岡","fukuoka",33.607,130.418),("佐賀","saga",33.249,130.299),("長崎","nagasaki",32.745,129.874),
 ("熊本","kumamoto",32.790,130.742),("大分","oita",33.238,131.613),("宮崎","miyazaki",31.911,131.424),
 ("鹿児島","kagoshima",31.560,130.558),("沖縄","okinawa",26.212,127.681),
]
SUFFIX = {"北海道":"","東京":"都","大阪":"府","京都":"府"}
def full(p): return p + SUFFIX.get(p, "県")
COLORS = {"murder":"var(--murder)","robbery":"var(--robbery)","theft":"var(--theft)",
          "fraud":"var(--fraud)","prep":"var(--prep)","other":"var(--other)"}

def load():
    js = r"""
const fs=require('fs'),vm=require('vm');
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+';this.__d={UPDATED,TYPES,PLACES,CASES,ALERTS:(typeof ALERTS!=="undefined"?ALERTS:[]),POLICE_LINKS:(typeof POLICE_LINKS!=="undefined"?POLICE_LINKS:{}),POLICE_CONTACTS:(typeof POLICE_CONTACTS!=="undefined"?POLICE_CONTACTS:{})};',ctx);
process.stdout.write(JSON.stringify(ctx.__d));
"""
    out = subprocess.run(['node','-e',js,os.path.join(ROOT,'data.js')],capture_output=True,text=True,check=True).stdout
    return json.loads(out)

def km(a,b):
    R=6371; la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    h=math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

def to_date(s):
    y,m,d=map(int,s.split('-')); return datetime.date(y,m,min(d,28))

e = lambda s: html.escape(str(s), quote=True)

CSS = """:root{--bg:#f3f5f8;--surface:#fff;--fg:#161b24;--muted:#586273;--line:#d6dbe3;--focus:#c46a10;
--murder:#b3261e;--robbery:#c46a10;--theft:#3d6aa8;--fraud:#7a4fa0;--prep:#6b7380;--other:#2f8a7a;--warn:#c2185b;
--display:"Dela Gothic One","Hiragino Sans","Yu Gothic",sans-serif;--body:"BIZ UDPGothic","Hiragino Sans","Yu Gothic","Meiryo",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#11151c;--surface:#181e27;--fg:#e7ebf1;--muted:#9aa5b5;--line:#2b3442;--focus:#e9963f;
--murder:#ef6b5f;--robbery:#e9963f;--theft:#7aa3e0;--fraud:#b791dc;--prep:#9aa3b1;--other:#6cc5b3;--warn:#f06292;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);line-height:1.7}
a{color:inherit}a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.top{background:var(--surface);border-bottom:1px solid var(--line)}
.in{max-width:860px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.top .in{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;padding-block:10px}
.brand{font-family:var(--display);font-size:18px;text-decoration:none}
nav{display:flex;flex-wrap:wrap;gap:4px}nav a{text-decoration:none;color:var(--muted);font-weight:700;font-size:14px;padding:6px 10px;border-radius:4px}
main.in{padding-block:24px 48px;display:flex;flex-direction:column;gap:24px}
.crumb{font-size:12px;color:var(--muted)}
h1{font-family:var(--display);font-weight:400;font-size:clamp(26px,5vw,38px);line-height:1.25;margin:0;text-wrap:balance}
h2{font-size:17px;margin:0 0 8px;text-wrap:balance}
.lead{margin:0;color:var(--muted)}
.stats{display:flex;flex-wrap:wrap;gap:6px 24px;font-variant-numeric:tabular-nums}
.stats b{font-family:var(--display);font-weight:400;font-size:26px;margin-right:4px}.stats span{font-size:13px;color:var(--muted)}
.report{border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:6px;padding:16px 18px;background:var(--surface);margin:18px 0}.report h2{margin:0 0 8px;font-size:18px}.report p{margin:0 0 8px}.rp-list{margin:0 0 8px;padding-left:1.2em}.rp-list li{margin:2px 0}.rp-how b{user-select:all}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:16px 18px;min-width:0}
ol{list-style:none;margin:0;padding:0}
.item{display:grid;grid-template-columns:4px minmax(0,1fr);gap:12px;padding:12px 0;border-top:1px solid var(--line)}
.item:first-child{border-top:0}.stripe{border-radius:2px}
.meta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.meta .t{font-weight:700}.hl{border:1px dashed var(--muted);border-radius:3px;padding:0 6px}
.place{font-weight:700;margin:2px 0}.desc{margin:0;font-size:14px}.src{font-size:12px;margin-top:4px;color:var(--muted)}
.empty{color:var(--muted);font-size:14px;margin:0}
.call{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
@media (max-width:640px){.call{grid-template-columns:minmax(0,1fr)}}
.call div{border:1px solid var(--line);border-radius:6px;padding:10px 12px;background:var(--surface)}
.call b{font-family:var(--display);font-weight:400;font-size:22px;display:block}.call span{font-size:13px;color:var(--muted)}
.btns{display:flex;flex-wrap:wrap;gap:8px}.btns a{border:1px solid var(--line);background:var(--surface);border-radius:4px;padding:6px 12px;font-size:14px;text-decoration:none;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.grid a{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--surface);border-radius:4px;padding:8px 10px;text-decoration:none;font-variant-numeric:tabular-nums}
.grid a span{color:var(--muted)}.grid a.has span{color:var(--focus);font-weight:700}
.note{font-size:12px;color:var(--muted)}"""

def head(title, desc, path):
    url = BASE + path
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="トクリュウ事件マップ">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}"><meta property="og:image" content="{BASE}og.png">
<meta property="og:locale" content="ja_JP"><meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Dela+Gothic+One&display=swap">
<style>{CSS}</style></head><body>
<header class="top"><div class="in"><a class="brand" href="../">トクリュウ事件マップ</a>
<nav aria-label="ページ"><a href="../#now">いまの状況</a><a href="../#teguchi">手口を知る</a><a href="../#taisaku">対策する</a><a href="../#data">データ</a><a href="./">都道府県別</a></nav></div></header>
"""

FOOT = """<p class="note">掲載は、警察や報道が匿流（トクリュウ）・闇バイトの関与を指摘した事件のうち、出典を確認できたものだけです。全件網羅ではなく、載っていない地域でも被害がないとは限りません。「見出しで確認」は記事本文を確認できず見出しで分類したもの、「〜か」と報じられた捜査中の事件も含みます。所在地は市区町村まで、氏名は載せません。情報提供・訂正のご依頼は <a href="https://github.com/zjm44ccm99-cmyk/tokuryu-map/issues" target="_blank" rel="noopener">GitHubのIssue</a> へ。</p>
</main></body></html>
"""

def item(c, types, dist=None):
    t = types[c['type']]
    badge = '<span class="hl">見出しで確認</span>' if c.get('basis') == 'headline' else ''
    d = f'<span>約{round(dist/10)*10}km</span>' if dist is not None else ''
    return (f'<li class="item"><span class="stripe" style="background:{COLORS[c["type"]]}"></span><div>'
            f'<div class="meta"><span>{e(c["show"])}</span><span class="t" style="color:{COLORS[c["type"]]}">{e(t["label"])}</span>{d}{badge}</div>'
            f'<div class="place">{e(full(c["pref"]))} {e(c["city"])}</div><p class="desc">{e(c["desc"])}</p>'
            f'<div class="src">出典：<a href="{e(c["url"] if str(c["url"]).startswith("https://") else "#")}" target="_blank" rel="noopener noreferrer">{e(c["src"])}</a></div></div></li>')

def main():
    D = load(); types = D['TYPES']; places = D['PLACES']; cases = D['CASES']
    alerts = [x for x in D.get('ALERTS', []) if (x['pref']+'|'+x['city']) in places]
    today = to_date(D['UPDATED'])
    os.makedirs(os.path.join(ROOT,'pref'), exist_ok=True)
    def coord(c): p = places[c['pref']+'|'+c['city']]; return (p[0], p[1])
    def age(c): return 10**6 if c.get('nodate') else (today - to_date(c['d'])).days
    counts = {}
    for c in cases: counts[c['pref']] = counts.get(c['pref'],0)+1
    urls = [BASE, BASE+'pref/']
    for name, slug, lat, lon in PREFS:
        fn = full(name)
        own = sorted([c for c in cases if c['pref']==name], key=lambda c: (not c.get('nodate'), c['d']), reverse=True)
        recent = [c for c in own if age(c) <= 365]
        near = sorted([(c, km((lat,lon), coord(c))) for c in cases if c['pref']!=name and age(c)<=365],
                      key=lambda x: x[1])
        near = [x for x in near if x[1] <= 150][:12]
        al = sorted([(x, km((lat,lon), tuple(places[x['pref']+'|'+x['city']][:2]))) for x in alerts
                     if (today - to_date(x['d'])).days <= 30], key=lambda y: y[1])
        al = [y for y in al if y[1] <= 150]
        title = f"{fn}のトクリュウ事件｜トクリュウ事件マップ"
        if own:
            desc = f"{fn}で報じられたトクリュウ（匿名・流動型犯罪グループ）・闇バイト関連の事件{len(own)}件を、時期・市区町村・手口とともにまとめています。近隣の事件と相談先も。"
        else:
            desc = f"{fn}と周辺で報じられたトクリュウ（匿名・流動型犯罪グループ）・闇バイト関連の事件と、手口・対策・相談先をまとめています。"
        cities = sorted({c['city'] for c in own if not places[c['pref']+'|'+c['city']][2:]} )
        lead = (f"{fn}で報じられたトクリュウ・闇バイト関連の事件をまとめています。" +
                (f"掲載している市区町村：{'、'.join(cities)}。" if cities else ""))
        parts = [head(title, desc, f'pref/{slug}.html'), '<main class="in">',
                 f'<div class="crumb"><a href="../">トップ</a> ／ <a href="./">都道府県別</a> ／ {e(fn)}</div>',
                 f'<div><h1>{e(fn)}のトクリュウ事件</h1></div><p class="lead">{e(lead)}</p>',
                 f'<div class="stats"><div><b>{len(own)}</b><span>件を掲載</span></div><div><b>{len(recent)}</b><span>件が直近1年</span></div><div><b>{len(near)}</b><span>件が周辺150km（直近1年）</span></div></div>',
                 '<div class="btns"><a href="../#now">全国の地図で見る</a><a href="../#teguchi">手口を知る</a><a href="../#taisaku">対策する</a></div>',
                 f'<section class="panel"><h2>{e(fn)}の事件</h2>']
        parts.append('<ol>'+''.join(item(c,types) for c in own)+'</ol>' if own else
                     f'<p class="empty">{e(fn)}の事件はまだ掲載していません。報道で確認できたものに限っているためで、被害がないという意味ではありません。</p>')
        parts.append('</section>')
        if al:
            parts.append(f'<section class="panel" style="border-left:4px solid var(--warn)"><h2>警察の注意情報（周辺150km・{e(D["UPDATED"])}までの30日）</h2><p class="note">予兆電話や不審な電話・訪問の多発など。事件の前触れになりやすい情報です。</p><ol>'
                         + ''.join(f'<li class="item"><span class="stripe" style="background:var(--warn)"></span><div><div class="meta"><span>{e(x["d"])}</span><span class="t" style="color:var(--warn)">{e(x["kind"])}</span><span>約{round(d/10)*10}km</span>{"<span class=\"hl\">見出しで確認</span>" if x.get("basis")=="headline" else ""}</div><div class="place">{e(full(x["pref"]))} {e(x["city"])}</div><p class="desc">{e(x["desc"])}</p><div class="src">出典：<a href="{e(x["url"] if str(x["url"]).startswith("https://") else "#")}" target="_blank" rel="noopener noreferrer">{e(x["src"])}</a></div></div></li>' for x, d in al)
                         + '</ol></section>')
        parts.append(f'<section class="panel"><h2>周辺の事件（{e(fn)}の県庁所在地から150km以内・直近1年）</h2>')
        parts.append('<ol>'+''.join(item(c,types,d) for c,d in near)+'</ol>' if near else
                     '<p class="empty">周辺150km以内で、直近1年に掲載している事件はありません。</p>')
        parts.append('</section>')
        pc = D.get('POLICE_CONTACTS', {}).get(name)
        if pc:
            okurl = lambda u: u if str(u).startswith('https://') else '#'
            parts.append(f'<section class="panel"><h2>{e(fn)}警察の連絡先</h2>'
                         f'<div class="call"><div><b>{e(pc["hq"])}</b><span>{e(fn)}警察本部（代表）</span></div>'
                         f'<div><b>#9110</b><span>警察相談専用電話（全国共通）</span></div>'
                         f'<div><b>110</b><span>いま危ない、事件が起きている</span></div></div>'
                         f'<p class="note" style="margin-top:10px">警察を名乗る電話を確かめるときは、着信画面に出た番号ではなく、この番号か<a href="{e(okurl(pc["list"]))}" target="_blank" rel="noopener noreferrer">公式サイトの警察署一覧</a>にある番号へ、自分から掛け直してください。番号は県警の公式サイトで確認しています（<a href="{e(okurl(pc["verify"]))}" target="_blank" rel="noopener noreferrer">確認元</a>）。</p></section>')
        pls = D.get('POLICE_LINKS', {}).get(name, [])
        if pls:
            parts.append(f'<section class="panel"><h2>{e(fn)}警察の公式発信</h2><p class="note">最新の予兆電話や事件の速報は、警察の公式SNSが最も早く出します。県警の公式サイトでリンクを確認したものだけを載せています。</p><div class="btns">'
                         + ''.join(f'<a href="{e(l["url"] if str(l["url"]).startswith("https://") else "#")}" target="_blank" rel="noopener noreferrer">{e(l["name"])}</a>' for l in pls)
                         + '</div></section>')
        parts.append('<section class="report"><h2>不審な電話は、警察に伝えよう</h2><p>だまされずに切った電話でも、知らせる意味があります。同じ名乗りの電話は、近所のほかの家にもかかっていることが多いからです。警察に集まった情報は、地域への注意の呼びかけ（予兆電話情報など）や捜査の手がかりになります。</p><ul class="rp-list"><li><b>いつ</b>：かかってきた日時</li><li><b>だれを名乗ったか</b>：警察官、市役所、銀行、家族など</li><li><b>何を聞かれたか</b>：家族構成、現金や資産、家にいる時間など</li><li><b>着信の番号</b>：画面に出た番号（偽装されていることもあります）</li></ul><p class="rp-how">急ぎでなければ <b>#9110</b>（警察相談専用電話）か最寄りの警察署へ。「これから家に行く」「お金を取りに行く」と言われたら、すぐに <b>110</b> へ。</p></section>')
        parts.append('<section><h2>不審な電話や訪問があったら</h2><div class="call">'
                     '<div><b>110</b><span>不審な人や車がいる、いま危ない</span></div>'
                     '<div><b>#9110</b><span>警察相談専用電話。急ぎでない相談</span></div>'
                     '<div><b>0120-924-839</b><span>匿名通報ダイヤル（平日10〜17時）</span></div></div></section>')
        parts.append(FOOT)
        open(os.path.join(ROOT,'pref',f'{slug}.html'),'w').write('\n'.join(parts))
        urls.append(BASE+f'pref/{slug}.html')
    # 一覧ページ
    regions = [("北海道・東北",0,7),("関東",7,14),("中部",14,23),("近畿",23,30),("中国",30,35),("四国",35,39),("九州・沖縄",39,47)]
    p = [head("都道府県別のトクリュウ事件｜トクリュウ事件マップ",
              "47都道府県ごとに、報道されたトクリュウ（匿名・流動型犯罪グループ）・闇バイト関連の事件をまとめています。", 'pref/'),
         '<main class="in"><div class="crumb"><a href="../">トップ</a> ／ 都道府県別</div>',
         '<h1>都道府県別のトクリュウ事件</h1><p class="lead">お住まいの都道府県を選ぶと、その地域と周辺で報じられた事件を見られます。数字は掲載件数です。</p>']
    for rname, a, b in regions:
        p.append(f'<section><h2>{rname}</h2><div class="grid">')
        for name, slug, *_ in PREFS[a:b]:
            n = counts.get(name, 0)
            p.append(f'<a href="{slug}.html" class="{"has" if n else ""}">{e(full(name))}<span>{n}件</span></a>')
        p.append('</div></section>')
    p.append(FOOT)
    open(os.path.join(ROOT,'pref','index.html'),'w').write('\n'.join(p))
    # sitemap / robots
    lm = D['UPDATED']
    sm = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    sm += [f'<url><loc>{u}</loc><lastmod>{lm}</lastmod></url>' for u in urls]
    sm.append('</urlset>')
    open(os.path.join(ROOT,'sitemap.xml'),'w').write('\n'.join(sm)+'\n')
    open(os.path.join(ROOT,'robots.txt'),'w').write(f'User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n')
    print(f'{len(PREFS)}都道府県のページと一覧、sitemap.xml を作りました')

if __name__ == '__main__':
    main()
