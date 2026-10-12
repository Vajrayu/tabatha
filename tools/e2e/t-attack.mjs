// Adversarial checks: what a hostile web page can and can't do to Tabatha's overlay.
// The page's own scripts run in the page's main world (page.evaluate), never in the extension.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
const f = () => T.frame(a);

// 1. Fake key presses from page script don't open Tabatha (hotkey.js only takes trusted events).
await a.bringToFront();
await a.evaluate(() => { for (const t of ['keydown', 'keyup']) window.dispatchEvent(new KeyboardEvent(t, { code: 'KeyQ', key: 'q', altKey: true, bubbles: true })); });
await a.waitForTimeout(900);
T.log('a page faking Alt+Q does not open Tabatha', !(await T.isOpen(a)));

// 2. The page frames the switcher itself (it can read our iframe's address): it gets an empty page.
await T.tap(a);
const src = await a.evaluate(() => document.querySelector('iframe[aria-label="Tabatha tab switcher"]').src);
await a.keyboard.press('Escape'); await a.waitForTimeout(500);
await a.evaluate((u) => { const x = document.createElement('iframe'); x.id = 'evil'; x.src = u; x.style.cssText = 'width:800px;height:500px'; document.body.append(x); }, src);
await a.waitForTimeout(1500);
const evil = await (await a.$('#evil')).contentFrame();
// Either Chrome refuses to load it in a page's own frame, or it loads and shows nothing.
const state = evil ? await evil.evaluate(() => ({ url: location.href, app: document.getElementById('app') ? !document.getElementById('app').hidden : null })).catch((e) => ({ err: String(e.message).slice(0, 80) })) : { err: 'no frame' };
T.log('a page that frames the switcher page itself gets nothing (no token)', !!evil && (state.app === false || state.app === null || !!state.err), JSON.stringify(state));
// …and guessing tokens doesn't help either.
if (evil) {
  await a.evaluate(() => { const x = document.getElementById('evil'); for (let i = 0; i < 8; i++) x.contentWindow.postMessage({ tabatha: 'launch', token: crypto.randomUUID() }, '*'); });
  await a.waitForTimeout(800);
  T.log('…and posting guessed launch tokens still shows nothing', !(await evil.evaluate(() => !document.getElementById('app').hidden).catch(() => false)));
}
await a.evaluate(() => document.getElementById('evil')?.remove());

// 3. The page floods our real frame with fake tokens before the real one: Tabatha still opens (popup fallback).
await a.evaluate(() => {
  const mo = new MutationObserver(() => {
    const x = document.querySelector('iframe[aria-label="Tabatha tab switcher"]');
    if (x && !x.__spam) { x.__spam = true; const spam = () => { for (let i = 0; i < 10; i++) try { x.contentWindow.postMessage({ tabatha: 'launch', token: 'x' + i }, '*'); } catch {} }; x.addEventListener('load', spam, { once: true }); spam(); }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  window.__mo = mo;
});
await T.tap(a); await a.waitForTimeout(3500);
const opened = (await T.isOpen(a) && !!(await f()?.evaluate(() => !document.getElementById('app').hidden).catch(() => false)))
  || (await ev(async () => (await chrome.windows.getAll()).some((w) => w.type === 'popup')));
T.log('a page spamming fake launch tokens can\'t stop Tabatha opening', opened);
await a.evaluate(() => window.__mo.disconnect());
await ev(async () => { for (const w of await chrome.windows.getAll()) if (w.type === 'popup') await chrome.windows.remove(w.id); });
for (let i = 0; i < 3; i++) await a.keyboard.press('Escape');
await a.waitForTimeout(500);

// 4. The page makes the overlay invisible to trick a click: the click does nothing.
await T.tap(a); await a.waitForTimeout(800);
const before = await ev(async () => (await chrome.tabs.query({})).length);
await a.evaluate(() => { document.querySelector('iframe[aria-label="Tabatha tab switcher"]').style.setProperty('opacity', '0.01', 'important'); });
await a.waitForTimeout(600);
await f().locator('#newtab').click({ force: true }).catch(() => {});
await a.waitForTimeout(600);
T.log('a click on an overlay the page made invisible is ignored', (await ev(async () => (await chrome.tabs.query({})).length)) === before);
// …and Enter while hidden closes Tabatha instead of acting.
await a.keyboard.press('Enter'); await a.waitForTimeout(600);
T.log('…and Enter then closes Tabatha instead of switching', !(await T.isOpen(a)) && (await ev(async () => (await chrome.tabs.query({})).length)) === before);
await T.close();
