// Captures the real Tabatha 1.3.2 switcher (fictional demo tabs) in several states,
// with the on-screen rects of every interactive element so the film's cursor hits real targets.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
const EXT = '/home/claude/vajrayu/tabatha/extension';
const [W, H, TAG] = [+process.argv[2], +process.argv[3], process.argv[4]];
const OUT = `/home/claude/tv/cap/${TAG}`; fs.mkdirSync(OUT, { recursive: true });
const PORT = 8080, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), U = (h) => `http://${h}/`;
const WIN1 = ['app.pulse.example', 'mail.mailpost.example', 'board.stackboard.example', 'code.gitforge.example',
  'cal.dayplan.example', 'read.longform.example', 'notes.northwind.example', 'docs.northwind.example'];
const WIN2 = ['maps.wayfare.example', 'shop.hearth.example', 'skycast.example', 'play.tunebox.example', 'team.parley.example'];
const INACTIVE = new Set(['cal.dayplan.example', 'skycast.example']);
const CLOSED = ['flights.skyroute.example', 'tokens.northwind.example'];
(async () => {
  const profile = fs.mkdtempSync('/tmp/tabatha-prof-');
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--window-size=${W},${H}`,
      '--no-proxy-server', `--host-resolver-rules=MAP *.example 127.0.0.1:${PORT}, MAP skycast.example 127.0.0.1:${PORT}`,
      '--screen-info={2560x1600}', '--hide-scrollbars', '--force-device-scale-factor=2'],
  });
  let sw = ctx.serviceWorkers().find((w) => w.url().endsWith('/background.js'));
  while (!sw) { const w = await ctx.waitForEvent('serviceworker'); if (w.url().endsWith('/background.js')) sw = w; }
  await sleep(1500);
  const bg = (fn, arg) => sw.evaluate(fn, arg);
  // Skip the first-run tour / flyout so the plain switcher shows (the tour is captured separately below).
  const initial = ctx.pages();
  const w1 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id, { urls: WIN1.map(U), W, H });
  const w2 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id, { urls: WIN2.map(U), W, H });
  for (const p of initial) await p.close().catch(() => {});
  await sleep(2500);
  async function activate(url, win) {
    await bg(async ({ url, win }) => { const [t] = await chrome.tabs.query({ url: url + '*' }); await chrome.windows.update(win, { focused: true }); await chrome.tabs.update(t.id, { active: true }); }, { url, win });
    await sleep(1300);
  }
  for (const h of CLOSED) { await bg(async ({ url, win }) => chrome.tabs.create({ url, windowId: win, active: true }), { url: U(h), win: w1 }); await sleep(1800); }
  for (const h of CLOSED) { await bg(async (url) => { const [t] = await chrome.tabs.query({ url: url + '*' }); await chrome.tabs.remove(t.id); }, U(h)); await sleep(400); }
  for (const h of WIN2) if (!INACTIVE.has(h)) await activate(U(h), w2);
  for (const h of WIN1) if (!INACTIVE.has(h)) await activate(U(h), w1);
  const page = ctx.pages().find((p) => p.url().startsWith(U('docs.northwind.example')));
  await page.setViewportSize({ width: W, height: H }); await sleep(800);
  const frame = () => page.frames().find((f) => f.url().includes('switcher.html'));
  const rects = async () => {
    const f = frame(); if (!f) return null;
    const off = await page.evaluate(() => { const i = [...document.querySelectorAll('iframe')].pop(); const r = i ? i.getBoundingClientRect() : { x: 0, y: 0 }; return [r.x, r.y]; });
    return f.evaluate((off) => {
      const R = (e) => { const r = e.getBoundingClientRect(); return [r.x + off[0], r.y + off[1], r.width, r.height].map(Math.round); };
      const q = (s) => [...document.querySelectorAll(s)];
      return {
        search: q('.search').map(R)[0], input: q('#search').map(R)[0], chips: q('.chip').map((e) => ({ r: R(e), t: e.textContent.trim(), on: e.getAttribute('aria-pressed') })),
        cards: q('.card').map((e) => ({ r: R(e), t: (e.querySelector('.title') || e).textContent.trim().slice(0, 60), sel: e.getAttribute('aria-selected'), closed: e.classList.contains('closed') })),
        heads: q('.section-h').map((e) => ({ r: R(e), t: e.textContent.trim() })), coffee: q('#coffee').map(R)[0], hint: q('.hint').map(R)[0], dialog: q('#dialog').map(R)[0],
        modal: !document.querySelector('#modal').hidden,
      };
    }, off);
  };
  const shot = async (name, wait = 700) => { console.log('shot', name); await sleep(wait); await page.bringToFront(); await page.screenshot({ timeout: 15000,  path: path.join(OUT, name + '.png') }); fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(await rects())); console.log('saved', name); };
  await shot('00-page', 100);
  const tap = async () => { await page.keyboard.down('Alt'); await page.keyboard.press('KeyQ'); await page.keyboard.up('Alt'); await sleep(1800); };
  // 1. First tap-open: the real 1.3.2 first-run tour.
  await tap(); await shot('05-tour1');
  let r = await rects();
  if (r && r.modal) { for (let i = 2; i <= 5; i++) { await page.keyboard.press('ArrowRight'); await shot('05-tour' + i, 600); } await page.keyboard.press('Escape'); await sleep(700); }
  await shot('10-overview');
  await page.keyboard.press('Escape'); await sleep(1000);
  // 3. Search
  await tap();
  for (const [i, s] of ['n', 'no', 'nor', 'nort', 'north'].entries()) { await page.keyboard.type(s.slice(-1)); await shot(`11-search-${i}`, 450); }
  await page.keyboard.press('Escape'); await sleep(500);
  await shot('12-cleared');
  const rr = await rects();
  // Window filter via chip click (real click) then Alt+W
  const chip = rr.chips.find((c) => /Window 2/.test(c.t));
  if (chip) { await page.mouse.click(chip.r[0] + chip.r[2] / 2, chip.r[1] + chip.r[3] / 2); await shot('13-window2'); await frame().evaluate(() => { const s = document.querySelector('#scroller'); s.scrollTop = s.scrollHeight; }); await shot('14-window2-closed'); }
  await page.keyboard.press('Escape'); await sleep(1200);
  // 2. Hold Alt and cycle (MRU), then cancel with Esc so we stay on this tab.
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyQ'); await sleep(1600);
  await shot('01-open-held');
  await page.keyboard.press('KeyQ'); await shot('02-cycle1', 450);
  await page.keyboard.press('KeyQ'); await shot('03-cycle2', 450);
  await page.keyboard.press('KeyQ'); await shot('04-cycle3', 450);
  
  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
