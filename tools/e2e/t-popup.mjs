// The switcher in its own popup window (used on chrome:// pages and the Web Store): tour, keys, sweep.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const [a] = await T.open(['alpha']);
for (const n of ['beta', 'gamma']) await T.sw.evaluate(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n));
await T.sw.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
const extId = new URL(T.sw.url()).host;
const info = await T.sw.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return { src: t.id, win: t.windowId }; });
async function openWindowMode() {
  const token = crypto.randomUUID();
  await T.sw.evaluate(([tok, i]) => chrome.storage.session.set({ launch: { token: tok, t: Date.now(), ctx: { src: i.src, win: i.win, dir: 1, state: 'normal', mode: 'window' } } }), [token, info]);
  const page = await T.ctx.newPage();
  await page.goto(`chrome-extension://${extId}/switcher.html?t=${token}`);
  await page.waitForTimeout(500);
  await page.mouse.move(300, 300); await page.mouse.move(340, 320); // a mouse move means nothing is being held
  await page.waitForTimeout(700);
  return page;
}
let page = await openWindowMode();
T.log('popup mode renders cards', (await page.$$eval('#open-grid .card', (x) => x.length)) === 3);
T.log('first-run tour shows in popup mode too', !(await page.$eval('#modal', (n) => n.hidden)));
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
T.log('arrow keys step the tour', (await page.$eval('#dlg-title', (n) => n.textContent)) === 'Move');
await page.keyboard.press('Escape'); await page.waitForTimeout(250);
T.log('Esc ends the tour', await page.$eval('#modal', (n) => n.hidden));
T.log('health check ran: no alert', await page.$eval('#alert', (n) => n.hidden));
const label = await page.$eval('#sweep-btn', (n) => (n.hidden ? '' : n.textContent));
T.log('capture button offered', /Capture all previews \(\d\)/.test(label), label);
await page.click('#sweep-btn'); await T.sw.evaluate(() => new Promise((r) => setTimeout(r, 6000)));
const idx = await T.sw.evaluate(() => chrome.storage.local.get('pvidx').then((o) => Object.keys(o.pvidx || {}).map((u) => u.split('/').pop())));
T.log('sweep from popup mode captured the background tabs', idx.includes('beta.html') && idx.includes('gamma.html'), idx.join());
await T.close();
