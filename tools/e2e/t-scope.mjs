// 13 Oct: (1) in the duplicates view, ticking cards gives the usual actions bar for just those tabs,
// not only "Close N copies"; (2) "Capture" from one window opens Tabatha again on that window, not "All windows".
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); await chrome.tabs.create({ url: u, active: false }); }, T.url('gamma')); // gamma ×2 = 1 duplicate
await a.bringToFront(); await T.tap(a);
const f = () => T.frame(a);

// 1. Duplicates view, then tick one card.
await f().locator('#dupes-btn').evaluate((b) => b.click()); await a.waitForTimeout(300);
const before = await f().$$eval('#acts-btns .qa span', (x) => x.map((n) => n.textContent));
T.log('the duplicates view starts with "Close N copies"', before.some((x) => /cop/i.test(x)), before.join(' | '));
await f().locator('#open-grid .card').first().locator('.pick').evaluate((b) => b.click()); await a.waitForTimeout(300);
const btns = await f().$$eval('#acts-btns .qa span', (x) => x.map((n) => n.textContent));
T.log('ticking a copy shows the usual actions for just that tab (Close, Copy links, Bookmark…)', btns.includes('Close') && btns.includes('Copy links') && /1 selected/.test(await f().$eval('#acts-n', (n) => n.textContent)), btns.join(' | '));
await f().locator('#acts-btns .qa').first().evaluate((b) => b.click()); await a.waitForTimeout(900);
const g = await ev(async () => (await chrome.tabs.query({})).filter((x) => (x.url || x.pendingUrl).endsWith('gamma.html')).length);
T.log('…and "Close" closes only the ticked one', g === 1, String(g));
for (let i = 0; i < 3; i++) await a.keyboard.press('Escape');
await a.waitForTimeout(500);

// 2. A second window with tabs that have no preview; choose it in the window list, then Capture.
await ev(async (u) => { const w = await chrome.windows.create({ url: [u + '?w=1', u + '?w=2', u + '?w=3'], focused: false }); return w.id; }, T.url('t1'));
await ev(() => new Promise((r) => setTimeout(r, 1500)));
await a.bringToFront(); await T.tap(a);
const wins = f().locator('#wins .win');
const n = await wins.count();
await wins.nth(n - 1).evaluate((b) => b.click()); await a.waitForTimeout(300);
const scopeLabel = await f().$eval('#wins .win[aria-pressed="true"] .wlabel', (x) => x.textContent);
const sweep = await f().$eval('#sweep-btn', (x) => (x.hidden ? '' : document.getElementById('sweep-text').textContent.trim()));
T.log('a window is chosen and Capture is offered there', scopeLabel !== 'All windows' && !!sweep, `${scopeLabel} / ${sweep}`);
await f().locator('#sweep-btn').evaluate((b) => b.click());
await a.waitForTimeout(700);
T.log('…the capture really runs (Tabatha steps aside for it)', !(await T.isOpen(a)));
await ev(() => new Promise((r) => setTimeout(r, 9000)));
const back = await T.isOpen(a);
const label = back ? await f().$eval('#wins .win[aria-pressed="true"] .wlabel', (x) => x.textContent).catch(() => '') : '';
T.log('after the capture, Tabatha is back on the same window (not "All windows")', back && label === scopeLabel, `${back} ${label}`);
await T.close();
