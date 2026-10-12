// A page that filters or covers Tabatha's overlay (a dark-mode extension's colour filter, the page's own
// dialog drawn on top) makes Chrome unable to confirm the overlay is visible, so clicks were silently ignored
// (the clickjacking guard). Now Tabatha moves into its own window, where clicks work; a plain page keeps the overlay.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
const active = () => ev(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].url);
const popups = () => ev(async () => (await chrome.windows.getAll()).filter((w) => w.type === 'popup').length);
const cleanup = async () => {
  await ev(async () => { for (const w of await chrome.windows.getAll()) if (w.type === 'popup') await chrome.windows.remove(w.id); const [t] = await chrome.tabs.query({ url: '*://localhost/*alpha.html' }); await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); });
  await a.evaluate(() => { document.documentElement.style.filter = ''; document.querySelectorAll('dialog').forEach((d) => d.remove()); });
  await a.waitForTimeout(500);
};

// Plain page: the overlay stays, no window.
await a.bringToFront(); await T.tap(a); await a.waitForTimeout(2200);
T.log('on a plain page Tabatha stays in the page (no extra window)', (await T.isOpen(a)) && (await popups()) === 0);
for (let i = 0; i < 3; i++) await a.keyboard.press('Escape');
await a.waitForTimeout(500);

for (const [label, setup] of [
  ['a colour-filtered page (dark-mode extensions)', () => { document.documentElement.style.filter = 'invert(1) hue-rotate(180deg)'; }],
  ['a page with its own dialog on top', () => { const d = document.createElement('dialog'); d.textContent = 'cookie banner'; document.body.append(d); d.showModal(); }],
]) {
  await a.bringToFront(); await a.evaluate(setup); await a.waitForTimeout(300);
  await T.tap(a); await a.waitForTimeout(2200);
  const win = T.ctx.pages().find((p) => p.url().includes('switcher.html') && !p.isClosed());
  T.log(`on ${label}, Tabatha moves into its own window`, !!win && !(await T.isOpen(a)) && (await popups()) === 1);
  if (win) {
    await win.locator('#open-grid .card', { hasText: 'beta' }).first().locator('.title').click({ timeout: 4000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 900));
    T.log('…where a click on a card opens that tab', /beta\.html$/.test(await active()), await active());
  }
  await cleanup();
}
await T.close();
