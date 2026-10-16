// Closing the tab Tabatha is drawn on (the first card: the tab you're on) used to make Tabatha vanish.
// Now it switches to the tab next door and opens there again, with the search kept.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta', 't1', 't2']);
await T.skipFirstRun();
await a.bringToFront(); await T.tap(a);
const tabs = () => ev(async () => (await chrome.tabs.query({})).map((x) => ({ id: x.id, url: x.url || x.pendingUrl, active: x.active })));
const overlayOn = async () => {
  for (const p of T.ctx.pages()) { if (!p.isClosed() && (await T.isOpen(p).catch(() => false))) return p; }
  return null;
};
// 1. The x on the first card (alpha, the tab Tabatha is on).
const f = T.frame(a);
const first = f.locator('#open-grid .card').first();
T.log('the first card is the tab Tabatha is on', /alpha/.test(await first.locator('.title').textContent()));
await first.hover(); await first.locator('.x').click();
await new Promise((r) => setTimeout(r, 2500));
const after = await tabs();
const host = await overlayOn();
T.log('closing it closes that tab', !after.some((x) => x.url.endsWith('alpha.html')));
T.log('…and Tabatha opens again on the tab next to it (it used to vanish)', !!host, host ? host.url() : 'not open anywhere');
if (host) {
  await host.waitForTimeout(500);
  T.log('…and the Pro waitlist button is still there (it used to disappear after a quick action)', await T.frame(host).evaluate(() => !document.getElementById('pro').hidden && document.getElementById('pro').getBoundingClientRect().width > 0));
}
// 2. "Close" in the actions bar with the current tab ticked, while searching.
if (host) {
  const g = T.frame(host);
  await g.evaluate(() => { const s = document.getElementById('search'); s.value = 'page'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await host.waitForTimeout(300);
  const cur = g.locator('#open-grid .card').first();
  await cur.locator('.pick').evaluate((b) => b.click()); await host.waitForTimeout(200);
  await g.locator('#acts-btns .qa').first().evaluate((b) => b.click());
  await new Promise((r) => setTimeout(r, 2500)); // that page is gone now: wait without it
  const host2 = await overlayOn();
  T.log('"Close" on ticked tabs that include the current one also reopens Tabatha', !!host2, host2 ? host2.url() : 'not open');
  if (host2) T.log('…with the search kept', (await T.frame(host2).evaluate(() => document.getElementById('search').value)) === 'page');
}
await T.close();
