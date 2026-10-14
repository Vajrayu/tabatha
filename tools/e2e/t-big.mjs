// A big profile (400 tabs, 300 stored previews; N=... to change). On a page a dark-mode extension filters,
// Tabatha used to draw the overlay, wait 1.2 s for Chrome to call it visible (clicks blocked all that time),
// then draw everything again in its own window. Now it goes straight to the window; a plain page keeps the
// overlay and must not be taken for a covered one however long the first draw takes.
import { launch } from './lib.mjs';
const N = +process.env.N || 400;
const T = await launch(process.env.EXT, { viewport: { width: 1440, height: 900 } });
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha']);
await T.skipFirstRun();
await ev(() => chrome.storage.local.set({ wnSeen: '9.9.9' }));
await ev(async ({ N, port }) => {
  const names = ['alpha', 'beta', 'gamma', 'delta', 't1', 't2', 't3'];
  const w2 = await chrome.windows.create({ url: `http://localhost:${port}/beta.html?w2`, focused: false });
  await Promise.all(Array.from({ length: N }, (_, i) => chrome.tabs.create({ url: `http://localhost:${port}/${names[i % 7]}.html?n=${i}`, active: false, windowId: i % 3 ? undefined : w2.id })));
  for (const t of await chrome.tabs.query({})) chrome.tabs.update(t.id, { autoDiscardable: false }).catch(() => {});
  // ~15 KB JPEGs, like real previews
  const c = new OffscreenCanvas(560, 350); const g = c.getContext('2d');
  for (let i = 0; i < 120; i++) { g.fillStyle = `hsl(${Math.random() * 360},60%,50%)`; g.fillRect(Math.random() * 560, Math.random() * 350, 12, 8); }
  const b = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.5 })).arrayBuffer());
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  const img = 'data:image/jpeg;base64,' + btoa(s); const now = Date.now(); const set = {}; const idx = {};
  for (const t of (await chrome.tabs.query({})).slice(0, 300)) { const u = t.url || t.pendingUrl; set['pv:' + u] = { img, t: now }; idx[u] = { t: now, n: img.length, s: now }; }
  set.pvidx = idx; await chrome.storage.local.set(set);
}, { N, port: T.port });
await a.bringToFront(); await a.waitForTimeout(3000);

const frame = () => T.frame(a);
const win = () => T.ctx.pages().find((p) => p.url().includes('switcher.html') && !p.isClosed());
// A frame that goes away mid-call can leave evaluate() waiting forever: give up after a moment.
const cards = (f) => (f ? Promise.race([f.evaluate(() => document.querySelectorAll('#open-grid .card').length).catch(() => 0), new Promise((r) => setTimeout(() => r(0), 500))]) : 0);
// Opens Tabatha and follows it for `ms`: when cards showed in the page, and when in a window.
async function openAndWatch(ms = 4000) {
  const s = Date.now(); let inPage = 0, inWin = 0;
  await a.keyboard.down('Alt'); await a.keyboard.press('KeyQ'); await a.keyboard.up('Alt');
  while (Date.now() - s < ms) {
    if (!inPage && (await cards(frame())) > 0) inPage = Date.now() - s;
    if (!inWin && (await cards(win())) > 0) inWin = Date.now() - s;
    await new Promise((r) => setTimeout(r, 20));
  }
  return { inPage, inWin };
}
const reset = async () => {
  for (const p of T.ctx.pages()) if (p.url().includes('switcher.html') && !p.isClosed()) await p.close().catch(() => {});
  await a.bringToFront(); for (let i = 0; i < 3; i++) await a.keyboard.press('Escape');
  await a.evaluate(() => { document.documentElement.style.filter = ''; document.querySelectorAll('dialog').forEach((d) => d.remove()); });
  await a.waitForTimeout(1500);
};

let r = await openAndWatch();
T.log(`${N} tabs, plain page: Tabatha opens in the page`, r.inPage > 0 && r.inPage < 3000, `${r.inPage} ms`);
T.log('…and stays there (a slow first draw is not taken for a covered page)', !r.inWin && (await T.isOpen(a)));
await reset();

await a.evaluate(() => { document.documentElement.style.filter = 'invert(.9) hue-rotate(180deg)'; });
r = await openAndWatch();
T.log('filtered page (dark-mode extension): no overlay drawn first', !r.inPage);
T.log('…Tabatha opens as its own window straight away', r.inWin > 0 && r.inWin < 3000, `${r.inWin} ms`);
await reset();

// The page's own dialog on top can't be seen beforehand: the first open moves, after that the site goes straight to the window.
await ev(() => chrome.storage.session.remove('covered'));
await a.evaluate(() => { const d = document.createElement('dialog'); d.textContent = 'cookie banner'; document.body.append(d); d.showModal(); });
r = await openAndWatch();
T.log('page with its own dialog on top: Tabatha moves into a window', r.inWin > 0);
await reset();
r = await openAndWatch();
T.log('…and next time on that site it opens there directly', !r.inPage && r.inWin > 0, `${r.inWin} ms`);
await reset();
await T.close();
