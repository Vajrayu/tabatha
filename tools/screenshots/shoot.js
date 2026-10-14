// Loads Tabatha into Chromium with fictional demo tabs and captures Web Store screenshots (1.3.3 layout:
// window sidebar, side panel, quick actions). The optional permissions (tabGroups, bookmarks) are made normal
// ones in a temporary copy, since a script can't click Chrome's permission prompt.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SRC = process.env.EXT || path.resolve(__dirname, '../../extension');
const OUT = process.env.OUT || path.resolve(__dirname, 'out');
const W = 1280, H = 800; // the store size; the side panel opens by itself at this width
const PORT = process.env.PORT || 80; // must match serve.py
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const U = (h) => `http://${h}/`;

const WIN1 = ['app.pulse.example', 'mail.mailpost.example', 'board.stackboard.example', 'code.gitforge.example',
  'cal.dayplan.example', 'read.longform.example', 'notes.northwind.example', 'docs.northwind.example', 'tokens.northwind.example'];
const WIN2 = ['maps.wayfare.example', 'shop.hearth.example', 'skycast.example', 'play.tunebox.example', 'team.parley.example'];
const INACTIVE = new Set(['cal.dayplan.example', 'skycast.example']); // never shown -> "No preview yet"
const CLOSED = ['flights.skyroute.example']; // opened in a group, then closed: shows under "Saved" in the panel
const GROUPS = [
  { title: 'Northwind launch', color: 'yellow', hosts: ['notes.northwind.example', 'docs.northwind.example', 'tokens.northwind.example'] },
  { title: 'Trip', color: 'cyan', hosts: ['maps.wayfare.example', 'skycast.example'] },
];
const MARKS = { Reading: ['read.longform.example', 'board.stackboard.example'], Work: ['code.gitforge.example', 'app.pulse.example', 'docs.northwind.example'], Recipes: [] };

function extCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tabatha-shot-ext-'));
  fs.cpSync(SRC, dir, { recursive: true });
  const mp = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.permissions.push(...(m.optional_permissions || []));
  delete m.optional_permissions;
  fs.writeFileSync(mp, JSON.stringify(m, null, 1));
  return dir;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const EXT = extCopy();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tabatha-prof-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: null,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--window-size=${W},${H}`,
      '--no-proxy-server', `--host-resolver-rules=MAP *.example 127.0.0.1:${PORT}, MAP skycast.example 127.0.0.1:${PORT}`,
      '--screen-info={1920x1200}', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  let sw = ctx.serviceWorkers().find((w) => w.url().endsWith('/background.js'));
  while (!sw) { const w = await ctx.waitForEvent('serviceworker'); if (w.url().endsWith('/background.js')) sw = w; }
  await sleep(1500);
  const bg = (fn, arg) => sw.evaluate(fn, arg);
  // No first-run flyout, tour, capture card or walkthrough; English UI; no review question.
  await bg(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: true, cap: chrome.runtime.getManifest().version }, prefs: { lang: 'en', startup: false } }));

  const initial = ctx.pages();
  const w1 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id, { urls: WIN1.map(U), W, H });
  const w2 = await bg(async ({ urls, W, H }) => (await chrome.windows.create({ url: urls, width: W, height: H + 139, left: 0, top: 0 })).id, { urls: WIN2.map(U), W, H });
  for (const p of initial) await p.close().catch(() => {});
  await sleep(2500);

  async function activate(url, win) {
    await bg(async ({ url, win }) => {
      const [t] = await chrome.tabs.query({ url: url + '*' });
      await chrome.windows.update(win, { focused: true });
      await chrome.tabs.update(t.id, { active: true });
    }, { url, win });
    await sleep(1300);
  }
  for (const h of CLOSED) { await bg(async ({ url, win }) => chrome.tabs.create({ url, windowId: win, active: true }), { url: U(h), win: w1 }); await sleep(1800); }
  await bg(async (urls) => {
    const ids = [];
    for (const u of urls) ids.push((await chrome.tabs.query({ url: u + '*' }))[0].id);
    const gid = await chrome.tabs.group({ tabIds: ids });
    await chrome.tabGroups.update(gid, { title: 'Weekend flights', color: 'purple' });
  }, CLOSED.map(U));
  await sleep(1500);
  for (const h of CLOSED) { await bg(async (url) => { const [t] = await chrome.tabs.query({ url: url + '*' }); await chrome.tabs.remove(t.id); }, U(h)); await sleep(400); }
  await sleep(1200);
  for (const h of WIN2) if (!INACTIVE.has(h)) await activate(U(h), w2);
  for (const h of WIN1) if (!INACTIVE.has(h)) await activate(U(h), w1);
  // Tab groups and bookmark folders.
  for (const g of GROUPS) {
    await bg(async (g) => {
      const ids = [];
      for (const h of g.hosts) ids.push((await chrome.tabs.query({ url: `http://${h}/*` }))[0].id);
      const gid = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(gid, { title: g.title, color: g.color });
    }, g);
  }
  await bg(async (marks) => {
    for (const [title, hosts] of Object.entries(marks)) {
      const f = await chrome.bookmarks.create({ parentId: '1', title });
      for (const h of hosts) { const [t] = await chrome.tabs.query({ url: `http://${h}/*` }); await chrome.bookmarks.create({ parentId: f.id, title: t.title, url: t.url }); }
    }
  }, MARKS);
  await sleep(1500);
  await activate(U('docs.northwind.example'), w1);

  const page = ctx.pages().find((p) => p.url().startsWith(U('docs.northwind.example')));
  await page.setViewportSize({ width: W, height: H }); await sleep(800);
  const frame = () => page.frames().find((f) => f.url().includes('switcher.html'));
  const shot = async (name) => { await sleep(800); await page.mouse.move(W - 4, 4); await sleep(200); await page.screenshot({ path: path.join(OUT, name) }); console.log('saved', name); };
  const open = async () => {
    await page.bringToFront(); await page.keyboard.down('Alt'); await page.keyboard.press('KeyQ'); await page.keyboard.up('Alt'); await sleep(1800);
    await frame().evaluate(() => { document.querySelector('main').scrollTop = 0; }); await sleep(300);
  };
  const close = async () => { for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await sleep(150); } await sleep(700); };
  const panelTab = async (id) => { const f = frame(); if (await f.$eval('#panel', (n) => n.hidden)) await f.click('#panel-btn'); await f.click(id); await sleep(400); };

  // 1. Overview: window list, cards with group sections, tab groups panel.
  await open(); await panelTab('#ptab-groups');
  await shot('01-overview.png');
  await close();

  // 2. Search: open and recently closed tabs.
  await open();
  await page.keyboard.type('design', { delay: 60 });
  await shot('02-search.png');
  await close();

  // 3. Quick actions: three tabs ticked, the pill shows what can be done with them.
  await open(); await panelTab('#ptab-groups');
  await frame().locator('#wins .win').nth(2).click(); await sleep(400);
  for (const name of ['Longform', 'Stackboard', 'Gitforge']) {
    const c = frame().locator('#open-grid .card', { hasText: new RegExp(name, 'i') }).first();
    await c.locator('.title').click({ modifiers: ['ControlOrMeta'] }); await sleep(200);
  }
  await shot('03-actions.png');
  await close();

  // 4. Bookmarks in the side panel.
  await open(); await panelTab('#ptab-marks');
  const work = frame().locator('#pane-marks .mrow.folder .mname', { hasText: 'Work' }).first();
  if (await work.count()) { await work.click(); await sleep(300); }
  await shot('04-bookmarks.png');
  await close();

  // 5. Sort and Group: the Group menu open (Site is chosen), the window navbar on the left.
  await open();
  await frame().evaluate(() => document.getElementById('group-by').click()); await sleep(400);
  await shot('05-group.png');
  await close();

  // 6. First open on a new install: the capture card (every preview removed first).
  await bg(async () => {
    const all = await chrome.storage.local.get(null);
    await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('pv:') || k === 'pvidx'));
    await chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: false, cap: '' } });
  });
  await open(); await sleep(700);
  await shot('06-capture.png');
  await close();

  await ctx.close();
  fs.rmSync(EXT, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
