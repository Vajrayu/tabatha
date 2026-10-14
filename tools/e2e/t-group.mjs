// 1.3.5: Group by (tab groups, site, last used, none) works with the sort and is remembered; an old "By site"
// sort turns into Group: Site; the toolbar is split left (view) / right (actions); the window list is a navbar;
// the update walkthrough shows once (its details are in t-walk); new installs open at Chrome start.
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
// An existing user who updated from 1.3.4, whose sort was "By site" (previews are there, so no capture card).
await ev(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: true, cap: chrome.runtime.getManifest().version }, view: { sort: 'site' }, wnFrom: '1.3.4' }));
for (const n of ['gamma', 'gamma', 't1']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n));
await ev(async (u) => { await chrome.windows.create({ url: u, focused: false }); }, T.url('t2'));
await a.bringToFront(); await T.tap(a);
const f = () => T.frame(a);
await a.waitForTimeout(900);

// The update walkthrough, once.
const news = await f().evaluate(() => !document.getElementById('modal').hidden && document.getElementById('dlg-title').textContent);
T.log('an updated user sees the walkthrough of what changed, once', !!news && /^Sort and groupNew$/.test(news), String(news).slice(0, 60));
await a.keyboard.press('Escape'); await a.waitForTimeout(300);
T.log('Esc closes it (Tabatha stays open)', (await f().evaluate(() => document.getElementById('modal').hidden)) && (await T.isOpen(a)));
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await T.tap(a); await a.waitForTimeout(900);
T.log('…and it doesn\'t come back on the next open', await f().evaluate(() => document.getElementById('modal').hidden));

// The old By-site sort became Group: Site, sorted by recent.
const label = await f().$eval('#group-by-v', (x) => x.textContent);
const v0 = await ev(() => chrome.storage.local.get('view').then((o) => o.view));
T.log('an old "By site" sort shows as Group: Site with the Recent sort', label === 'Site' && (await f().$eval('#sort [aria-checked="true"]', (x) => x.dataset.sort)) === 'recent', label);
T.log('the sort control no longer has "By site"', (await f().$$eval('#sort [data-sort="site"]', (x) => x.length)) === 0);

// Toolbar: view things left, actions right.
const pos = await f().evaluate(() => ({ star: document.getElementById('star-filter').getBoundingClientRect().left, group: document.getElementById('group-by').getBoundingClientRect().left, panel: document.getElementById('panel-btn').getBoundingClientRect().left, w: innerWidth }));
T.log('Starred, sort and Group are on the left, the panel button on the right', pos.star < pos.w / 3 && pos.group < pos.w / 2 && pos.panel > pos.w / 2, JSON.stringify(pos));

// Group by menu: Last used, then No grouping; each remembered.
const pick = async (name) => { await f().locator('#group-by').evaluate((x) => x.click()); await a.waitForTimeout(150); await f().locator('.menu .mi', { hasText: name }).evaluate((x) => x.click()); await a.waitForTimeout(300); };
await pick('Last used');
const heads = await f().$$eval('#open-grid .ghead .gname', (x) => x.map((n) => n.textContent));
T.log('Group: Last used makes time sections (Last hour first)', heads[0] === 'Last hour', heads.join(' | '));
T.log('…and is remembered', (await ev(() => chrome.storage.local.get('view').then((o) => o.view.group))) === 'recent');
await f().locator('#sort [data-sort="name"]').evaluate((x) => x.click()); await a.waitForTimeout(300);
const inSec = await f().$$eval('#open-grid .gsec', (secs) => secs[0] ? [...secs[0].querySelectorAll('.card .title')].map((n) => n.textContent) : []);
T.log('sort works inside the groups (A–Z within Last hour)', JSON.stringify(inSec) === JSON.stringify([...inSec].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }))), inSec.join(' | '));
await pick('No grouping');
T.log('No grouping shows one plain list', (await f().$$eval('#open-grid .ghead', (x) => x.length)) === 0 && (await f().$$eval('#open-grid .card', (x) => x.length)) > 3);
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await T.tap(a); await a.waitForTimeout(500);
T.log('the grouping and the sort survive a reopen', (await f().$eval('#group-by-v', (x) => x.textContent)) === 'No grouping' && (await f().$eval('#sort [aria-checked="true"]', (x) => x.dataset.sort)) === 'name');

// The window list is a navbar: one short row per window, no pictures.
const nav = await f().evaluate(() => [...document.querySelectorAll('#wins .win')].map((b) => ({ h: Math.round(b.getBoundingClientRect().height), img: b.querySelectorAll('img.shot, .wpic').length, text: b.textContent })));
T.log('the window list is a slim navbar (rows ≤ 40 px, no previews)', nav.length >= 3 && nav.every((r) => r.h <= 40 && r.img === 0), JSON.stringify(nav));

// The panel's tabs look like tabs (underline), not buttons.
await f().evaluate(() => { if (document.getElementById('panel').hidden) document.getElementById('panel-btn').click(); });
await a.waitForTimeout(300);
const tabStyle = await f().$eval('.ptab[aria-selected="true"]', (x) => { const c = getComputedStyle(x); return { bg: c.backgroundColor, line: c.borderBottomColor, radius: c.borderRadius }; });
T.log('the chosen panel tab is underlined, not a filled button', tabStyle.bg === 'rgba(0, 0, 0, 0)' && tabStyle.line === 'rgb(255, 209, 102)', JSON.stringify(tabStyle));
await T.close();

// A new install: Tabatha opens at Chrome start by default, and the tour (not What's new) is what it shows.
const U = await launch(process.env.EXT);
await U.open(['alpha']);
await new Promise((r) => setTimeout(r, 800));
const prefs = await U.sw.evaluate(() => chrome.storage.local.get(['prefs', 'wnFrom']));
U.log('a new install has "Open Tabatha when Chrome starts" on', prefs.prefs && prefs.prefs.startup === true, JSON.stringify(prefs));
await U.close();
