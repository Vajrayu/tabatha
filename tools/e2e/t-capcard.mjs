// 1.3.5 (part C): "Want previews for all of them?" On a new install the first open offers the existing capture run,
// counted right (awake tabs Tabatha can capture and that have no preview; sleeping ones and pages Chrome refuses are
// mentioned). Capture runs the sweep most-recently-used first, Tabatha reopens with "Done: N previews." and then the
// walkthrough starts; Later goes straight to the walkthrough; shown once. Updaters get it when most previews are
// missing; the toolbar's Capture opens the same card. Cards without a preview show the site's icon large on the
// site's tint, with the page title. (The tiers by tab count are in t-captiers.)
import { launch } from './lib.mjs';

const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const version = await ev(() => chrome.runtime.getManifest().version);
const [a] = await T.open(['alpha']);
const f = () => T.frame(a);
const within = (p, ms = 3000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const wipe = () => ev(async () => { const all = await chrome.storage.local.get(null); await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('pv:') || k === 'pvidx')); });
const title = () => within(f().evaluate(() => (document.getElementById('modal').hidden ? null : document.getElementById('dlg-title').textContent)).catch(() => null));

// Five background tabs used in a known order (beta last), a page Chrome refuses to photograph, and a sleeping tab.
// Chromium can't discard tabs under Playwright, so "sleeping" is simulated inside Tabatha's page (tab.discarded).
const names = ['t2', 't1', 'delta', 'gamma', 'beta'];
const ids = await ev(async ({ names, port }) => {
  const out = {};
  for (const n of [...names, 't3']) out[n] = (await chrome.tabs.create({ url: `http://localhost:${port}/${n}.html`, active: false })).id;
  await chrome.tabs.create({ url: 'chrome://version', active: false });
  return out;
}, { names, port: T.port });
await a.waitForTimeout(1200);
for (const n of names) { await ev((id) => chrome.tabs.update(id, { active: true }), ids[n]); await a.waitForTimeout(250); }
await a.bringToFront(); await ev(async () => { const [x] = await chrome.tabs.query({ title: 'alpha page' }); await chrome.tabs.update(x.id, { active: true }); });
await a.waitForTimeout(800);
await wipe(); // only the order of use stays: no tab has a preview now
await T.ctx.addInitScript((sleepy) => {
  if (location.protocol !== 'chrome-extension:' || !location.pathname.endsWith('/switcher.html')) return;
  const q = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = async (o) => (await q(o)).map((x) => (x.id === sleepy ? { ...x, discarded: true } : x));
}, ids.t3);

await T.tap(a); await a.waitForTimeout(400);
let card = await T.capCard(a);
// 8 tabs are open (this page, five visited ones, the sleeping one, chrome://version); 5 of them need a preview.
T.log('a new install\'s first open shows the capture card (before the tour)', !!card && /^You have 8 tabs open\./.test(card.text), card && card.text);
T.log('…the heading counts every open tab, and a line says how many have no preview yet', !!card && card.text.startsWith('You have 8 tabs open.5 of them have no preview yet.Give me about 5 seconds'), card && card.text);
T.log('…with the 1–10 tier: "Give me about 5 seconds…", Capture them · Later', !!card && card.text.includes('Give me about 5 seconds and they’ll all have previews.') && JSON.stringify(card.buttons) === '["Capture them","Later"]', card && JSON.stringify(card.buttons));
T.log('…counts awake, capturable tabs only, and mentions the sleeping tab and the refused page', !!card && card.text.includes('1 sleeping tab stays asleep (showing it would wake it).') && card.text.includes('1 page Chrome won’t let me photograph (like the Web Store).'), card && card.text);
T.log('…"Capture them" is the default (focused, Enter)', (await f().evaluate(() => document.activeElement.textContent)) === 'Capture them');

// Cards without a preview, behind the card.
const look = await f().evaluate(() => [...document.querySelectorAll('#open-grid .card')].filter((c) => /beta page|gamma page/.test(c.querySelector('.title').textContent)).map((c) => {
  const b = c.querySelector('.nopreview.soft');
  return b && { hue: b.style.getPropertyValue('--hue'), big: !!b.querySelector('img.big'), title: (b.querySelector('.ptitle') || {}).textContent, snap: !!b.querySelector('.snap'), old: /No preview yet/.test(c.textContent) };
}));
T.log('a card without a preview shows the large icon, the site\'s tint and the title (no "No preview yet")', look.length === 2 && look.every((x) => x && x.big && x.hue !== '' && !x.old) && look.map((x) => x.title).sort().join() === 'beta page,gamma page', JSON.stringify(look));
T.log('…the same site gets the same tint, and the camera button stays', look.length === 2 && look[0].hue === look[1].hue && look.every((x) => x.snap), JSON.stringify(look));

const t0 = Date.now();
await a.keyboard.press('Enter');
await a.waitForTimeout(600);
T.log('Capture closes Tabatha and starts the run, with the progress card', !(await T.isOpen(a)) && T.ctx.pages().some((p) => p.url().includes('sweep.html')));
let back = 0;
while (Date.now() - t0 < 20000) { if (await T.isOpen(a) && T.frame(a)) { back = Date.now() - t0; break; } await a.waitForTimeout(100); }
T.log('…Tabatha opens again afterwards', back > 0, back + ' ms');
await a.waitForTimeout(400);
const toast = await within(f().evaluate(() => { const x = document.getElementById('toast'); return x.hidden ? '' : x.textContent; }));
T.log('…saying "Done: 5 previews."', toast === 'Done: 5 previews.', String(toast));
await a.waitForTimeout(500);
T.log('…and then the walkthrough starts', /^Press (Alt|Option)\+Q/.test(String(await title())), String(await title()));
const idx = await ev(() => chrome.storage.local.get('pvidx').then((o) => o.pvidx || {}));
const at = names.slice().reverse().map((n) => { const k = Object.keys(idx).find((u) => u.endsWith('/' + n + '.html')); return k ? idx[k].t : 0; });
T.log('the run went most recently used first (beta, gamma, delta, t1, t2)', at.every((x, i) => x > 0 && (i === 0 || x > at[i - 1])), JSON.stringify(at.map((x) => x - at[0])));
const gaps = at.slice(1).map((x, i) => x - at[i]);
const perTab = gaps.reduce((s, x) => s + x, 0) / gaps.length;
T.log('…about 0.6 s a tab (the card\'s estimate)', perTab > 400 && perTab < 750, Math.round(perTab) + ' ms a tab');
T.log('the sleeping tab was left asleep (not visited)', !Object.keys(idx).some((u) => u.endsWith('/t3.html')));
T.log('the answer is saved (once per install)', (await ev(() => chrome.storage.local.get('onb').then((o) => o.onb.cap))) === version);
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await wipe();
await T.tap(a); await a.waitForTimeout(500);
T.log('shown once: no card and no walkthrough on the next open', (await title()) === null, String(await title()));

// The toolbar's "N without preview · Capture" opens the same card; Later there just closes it.
await f().evaluate(() => document.getElementById('sweep-btn').click()); await a.waitForTimeout(300);
card = await T.capCard(a);
T.log('the toolbar\'s Capture opens the same card', !!card && /^You have 8 tabs open\.5 of them/.test(card.text), card && card.text);
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
T.log('…Esc there is Later: the card closes, Tabatha stays, no walkthrough', (await T.isOpen(a)) && (await title()) === null);
await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// A search that leaves only tabs without a preview: all of them need one, so no "N of them" line.
await T.tap(a); await a.waitForTimeout(400);
await a.keyboard.type('gamma', { delay: 40 }); await a.waitForTimeout(400);
await f().evaluate(() => document.getElementById('sweep-btn').click()); await a.waitForTimeout(300);
card = await T.capCard(a);
T.log('when every tab the card is about needs a preview, there is no "of them" line', !!card && card.text.startsWith('You have 1 tab open.') && !/of them/.test(card.text), card && card.text);
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// Later on a new install: straight to the walkthrough.
await ev(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: false, cap: '' } }));
await T.tap(a); await a.waitForTimeout(400);
T.log('new install, Later: the card first', !!(await T.capCard(a)));
await T.capPress(a, 'Later'); await a.waitForTimeout(300);
T.log('…then straight to the walkthrough', /^Press (Alt|Option)\+Q/.test(String(await title())), String(await title()));
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await a.keyboard.press('Escape'); await a.waitForTimeout(400);
T.log('…and the answer is saved', (await ev(() => chrome.storage.local.get('onb').then((o) => o.onb.cap))) === version);

// Updaters: the card comes at the start of their walkthrough when more than half of their tabs have no preview.
await ev(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: true, cap: '1.3.4' }, wnFrom: '1.3.4' }));
await T.tap(a); await a.waitForTimeout(400);
card = await T.capCard(a);
T.log('an updater with most previews missing gets the card first', !!card, card && card.text);
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
T.log('…then their update walkthrough', String(await title()).startsWith('Sort and group'), String(await title()));
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await a.keyboard.press('Escape'); await a.waitForTimeout(400);
// Previews for most tabs: no card, just the walkthrough.
await ev(async () => {
  const c = new OffscreenCanvas(56, 35); c.getContext('2d').fillRect(0, 0, 56, 35);
  const b = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg' })).arrayBuffer());
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  const img = 'data:image/jpeg;base64,' + btoa(s); const now = Date.now(); const set = {}; const idx = {};
  for (const x of (await chrome.tabs.query({})).filter((t) => /^http/.test(t.url)).slice(0, 5)) { const u = x.url; set['pv:' + u] = { img, t: now }; idx[u] = { t: now, n: img.length, s: now }; }
  set.pvidx = idx; set.onb = { at: 1, flyout: true, tour: true, cap: '1.3.4' }; set.wnFrom = '1.3.4';
  await chrome.storage.local.set(set);
});
await T.tap(a); await a.waitForTimeout(400);
T.log('an updater whose tabs mostly have previews goes straight to the walkthrough', !(await T.capCard(a)) && String(await title()).startsWith('Sort and group'), String(await title()));
await T.close();
