"""SNS共有用カード画像（og.png）を作り直す。リポジトリのルートで: python3 tools/og/render.py
playwright が無ければ: pip install --break-system-packages playwright && python3 -m playwright install chromium"""
import asyncio, os
from playwright.async_api import async_playwright
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'..','..','og.png')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1200,'height':630})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto('file://'+os.path.join(HERE,'og.html')); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT); await b.close()
        if errs: raise SystemExit('エラー: '+'; '.join(errs))
        print('og.png を更新しました')
asyncio.run(main())
