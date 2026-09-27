// Loads Tabatha into Chromium with fictional demo tabs and captures Web Store screenshots.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXT = process.env.EXT || path.resolve(__dirname, '../../extension');
const OUT = process.env.OUT || path.resolve(__dirname, 'out');
const W = 1280, H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = (h) => `http://${h}/`;

const WIN1 = ['app.pulse.example', 'mail.mailpost.example', 'board.stackboard.example', 'code.gitforge.example',
  'cal.dayplan.example', 'read.longform.example', 'notes.northwind.example', 'docs.northwind.example'];
const WIN2 = ['maps.wayfare.example', 'shop.hearth.example', 'skycast.example', 'play.tunebox.example', 'team.parley.example'];
const INACTIVE = new Set(['cal.dayplan.example', 'skycast.example']); // never shown -> "Inactive" tile
const CLOSED = ['flights.skyroute.example', 'tokens.northwind.example'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync('/tmp/tabatha-prof-');
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--window-size=${W},${H}`,
      '--no-proxy-server', '--host-resolver-rules=MAP *.example 127.0.0.1, MAP skycast.example 127.0.0.1',
      '--screen-info={1920x1200}', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  let sw = ctx.serviceWorkers().find((w) => w.url().endsWith('/background.js'));
  while (!sw) { const w = await ctx.waitForEvent('serviceworker'); if (w.url().endsWith('/background.js')) sw = w; }
  console.log('sw', sw.url()); await sleep(1500);
  const bg = (fn, arg) => sw.evaluate(fn, arg);

  const initial = ctx.pages();
  const w1 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id,
    { urls: WIN1.map(U), W, H });
  const w2 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id,
    { urls: WIN2.map(U), W, H });
  for (const p of initial) await p.close().catch(() => {});
  await sleep(2500);

  // Activate tabs one by one so Tabatha captures a preview of each.
  async function activate(url, win) {
    await bg(async ({ url, win }) => {
      const [t] = await chrome.tabs.query({ url: url + '*' });
      await chrome.windows.update(win, { focused: true });
      await chrome.tabs.update(t.id, { active: true });
    }, { url, win });
    await sleep(1300);
  }
  // Closed tabs first (opened, viewed, closed) so they land in "Recently closed".
  for (const h of CLOSED) {
    await bg(async ({ url, win }) => chrome.tabs.create({ url, windowId: win, active: true }), { url: U(h), win: w1 });
    await sleep(1800);
  }
  for (const h of CLOSED) {
    await bg(async (url) => { const [t] = await chrome.tabs.query({ url: url + '*' }); await chrome.tabs.remove(t.id); }, U(h));
    await sleep(400);
  }
  for (const h of WIN2) if (!INACTIVE.has(h)) await activate(U(h), w2);
  for (const h of WIN1) if (!INACTIVE.has(h)) await activate(U(h), w1);
  // Discard the inactive ones so they show "sleeping"? keep simple: leave inactive.

  const page = ctx.pages().find((p) => p.url().startsWith(U('docs.northwind.example')));
  await page.setViewportSize({ width: W, height: H }); await sleep(800);
  console.log('viewport', await page.evaluate(() => [innerWidth, innerHeight]));
  const shot = async (name) => { await sleep(700); await page.screenshot({ path: path.join(OUT, name) }); console.log('saved', name); };

  // 1. Hero: overlay opened with Alt+Q, Alt still held.
  await page.keyboard.down('Alt');
  await page.keyboard.press('KeyQ');
  await sleep(1800);
  await shot('01-overview.png');
  await page.keyboard.press('KeyQ');
  await page.keyboard.press('KeyQ');
  await shot('01b-overview-cycled.png');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Alt');
  await sleep(800);

  // 2. Search
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyQ'); await page.keyboard.up('Alt');
  await sleep(1800);
  await page.keyboard.type('design', { delay: 60 });
  await shot('02-search.png');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await sleep(800);

  // 3. Window scope (Alt+W twice -> Window 2), recently closed below
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyQ'); await page.keyboard.up('Alt');
  await sleep(1800);
  await page.keyboard.down('Alt'); await page.keyboard.press('KeyW'); await page.keyboard.press('KeyW'); await page.keyboard.up('Alt');
  await shot('03-windows.png');
  await page.keyboard.press('Escape');
  await sleep(800);

  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
