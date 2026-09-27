// Builds captioned store screenshots (1280x800) and promo tiles (440x280, 1400x560) from the raw captures.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.resolve(__dirname, 'out');
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const ICON = b64(path.resolve(process.env.EXT || path.resolve(__dirname, '../../extension'), 'icons/icon128.png'));
const shot = (n) => b64(path.join(OUT, n));

const BASE = `*{box-sizing:border-box;margin:0}body{font-family:Inter,sans-serif;color:#fff;overflow:hidden;
background:radial-gradient(900px 500px at 15% 0%,#6d5cf6 0%,transparent 60%),radial-gradient(900px 600px at 100% 100%,#9b3fd8 0%,transparent 55%),#17132e}`;

const captioned = (img, title, sub) => `<style>${BASE}
.t{position:absolute;top:44px;left:0;right:0;text-align:center}h1{font-size:44px;font-weight:700;letter-spacing:-.02em}p{font-size:21px;opacity:.8;margin-top:8px}
.s{position:absolute;left:90px;right:90px;top:180px;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.12)}
.s img{display:block;width:100%}</style>
<div class=t><h1>${title}</h1><p>${sub}</p></div><div class=s><img src="${img}"></div>`;

const kbd = (k) => `<span class=k>${k}</span>`;
const small = `<style>${BASE}
.w{position:absolute;left:30px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:12px;width:230px}
.w img{width:64px;height:64px}h1{font-size:40px;font-weight:700;letter-spacing:-.02em}p{font-size:16px;opacity:.85;line-height:1.35}
.k{display:inline-block;background:rgba(255,255,255,.18);border-radius:5px;padding:0 6px;font-weight:600}
.s{position:absolute;left:270px;top:40px;width:330px;border-radius:10px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.5);transform:rotate(-4deg)}.s img{display:block;width:100%}</style>
<div class=w><img src="${ICON}"><h1>Tabatha</h1><p><span style=white-space:nowrap>${kbd('Alt')} + ${kbd('Q')}</span> for live previews of every tab</p></div><div class=s><img src="${shot('01-overview.png')}"></div>`;

const marquee = `<style>${BASE}
.w{position:absolute;left:90px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:18px;width:470px}
.w img{width:88px;height:88px}h1{font-size:64px;font-weight:700;letter-spacing:-.03em}p{font-size:24px;opacity:.85;line-height:1.4}
.k{display:inline-block;background:rgba(255,255,255,.18);border-radius:6px;padding:0 8px;font-weight:600}
.s{position:absolute;left:640px;top:60px;width:820px;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);transform:rotate(-3deg)}.s img{display:block;width:100%}</style>
<div class=w><img src="${ICON}"><h1>Tabatha</h1><p>Live previews of all your tabs. Press <span style=white-space:nowrap>${kbd('Alt')} + ${kbd('Q')}</span>, search, switch windows and reopen what you just closed.</p></div>
<div class=s><img src="${shot('01-overview.png')}"></div>`;

(async () => {
  const b = await chromium.launch();
  const render = async (html, w, h, name) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, name) }); await p.close(); console.log('saved', name);
  };
  await render(captioned(shot('01-overview.png'), 'See every tab at a glance', 'Press Alt+Q for live previews of all your tabs, like Alt+Tab for Chrome'), 1280, 800, 'captioned-01-overview.png');
  await render(captioned(shot('02-search.png'), 'Find any tab in a keystroke', 'Just start typing to search open and recently closed tabs'), 1280, 800, 'captioned-02-search.png');
  await render(captioned(shot('03-windows.png'), 'Jump between windows', 'Filter by window with Alt+W and bring back tabs you just closed'), 1280, 800, 'captioned-03-windows.png');
  await render(small, 440, 280, 'promo-small-440x280.png');
  await render(marquee, 1400, 560, 'promo-marquee-1400x560.png');
  await b.close();
})();
