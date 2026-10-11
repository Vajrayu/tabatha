// Sort, "By site" sections, collapsing, stars and the per-card "Capture preview".
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
// Background tabs nobody has looked at (no previews), two of them on the same page.
for (const n of ['gamma', 't1', 'gamma']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n));
await ev(() => new Promise((r) => setTimeout(r, 1500)));
await a.bringToFront(); await a.waitForTimeout(600);
const f = () => T.frame(a);
const titles = () => f().$$eval('#open-grid .card .title', (x) => x.map((n) => n.textContent));
const alt = async (key) => { await a.keyboard.down('Alt'); await a.keyboard.press(key); await a.keyboard.up('Alt'); await a.waitForTimeout(350); };

await T.tap(a);
T.log('sort control shows Recent by default', (await f().$eval('#sort [aria-checked="true"]', (n) => n.dataset.sort)) === 'recent');

await f().click('#sort [data-sort="name"]'); await a.waitForTimeout(300);
const byName = await titles();
T.log('A–Z sorts by title', JSON.stringify(byName) === JSON.stringify([...byName].sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }))), byName.join(' | '));

await f().click('#sort [data-sort="newest"]'); await a.waitForTimeout(300);
T.log('Newest puts the last opened tab first', (await titles())[0] === (await ev(async () => { const t = await chrome.tabs.query({}); return t.sort((x, y) => y.id - x.id)[0].title; })));

await f().click('#sort [data-sort="site"]'); await a.waitForTimeout(300);
const heads = await f().$$eval('#open-grid .ghead .gname', (x) => x.map((n) => n.textContent));
T.log('By site makes one section for the site with many tabs', heads[0].startsWith('localhost'), heads.join());
T.log('sort choice is remembered', (await ev(() => chrome.storage.local.get('view').then((o) => o.view.sort))) === 'site');

// Collapse the site section, reopen the switcher: it stays collapsed.
await f().click('#open-grid .ghead'); await a.waitForTimeout(300);
T.log('collapsing hides the cards', (await f().$$eval('#open-grid .card', (x) => x.length)) === 0);
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await T.tap(a);
T.log('collapsed sections are remembered', (await ev(() => chrome.storage.local.get('view').then((o) => o.view.collapsed.length))) === 1);
// Every tab is in that one section, so Alt+Q's pick is inside it: the section opens for this visit only.
T.log('Alt+Q into a collapsed section opens it for this visit', (await f().$$eval('#open-grid .card[aria-selected="true"]', (x) => x.length)) === 1);
await f().click('#open-grid .ghead'); await a.waitForTimeout(300); // collapse (it was only peeking)
await f().click('#open-grid .ghead'); await a.waitForTimeout(300); // expand for good
T.log('expanding forgets it', (await ev(() => chrome.storage.local.get('view').then((o) => o.view.collapsed.length))) === 0);
await f().click('#sort [data-sort="recent"]'); await a.waitForTimeout(300);

// Star the selected tab with Alt+S, then filter to starred.
const selTitle = await f().$eval('.card[aria-selected="true"] .title', (n) => n.textContent);
await alt('KeyS');
T.log('Alt+S stars the selected tab', (await f().$eval('.card[aria-selected="true"] .star', (n) => n.classList.contains('on'))));
T.log('star count updates', (await f().$eval('#star-n', (n) => n.textContent)) === '1');
await f().click('#star-filter'); await a.waitForTimeout(300);
const starred = await titles();
T.log('Starred filter shows only starred tabs', starred.length === 1 && starred[0] === selTitle, starred.join());
await f().click('#star-filter'); await a.waitForTimeout(300);

// Per-card capture of a tab in the same window: the switcher closes, the tab is captured, the switcher comes back.
const before = await ev(() => chrome.storage.local.get('pvidx').then((o) => Object.keys(o.pvidx || {}).filter((u) => u.endsWith('t1.html')).length));
T.log('a background tab has no preview yet', before === 0);
const snap = await f().$$eval('.card', (cards) => cards.findIndex((c) => c.querySelector('.title').textContent === 't1 page' && c.querySelector('.snap')));
T.log('its card offers Capture preview', snap >= 0);
const actBefore = await ev(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
await f().$$eval('.card', (cards, i) => cards[i].querySelector('.snap').click(), snap);
await a.waitForTimeout(4500);
const after = await ev(() => chrome.storage.local.get('pvidx').then((o) => Object.keys(o.pvidx || {}).filter((u) => u.endsWith('t1.html')).length));
T.log('the tab now has a preview', after === 1);
T.log('the original tab is active again', (await ev(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id)) === actBefore);
T.log('the switcher is open again', await T.isOpen(a));
T.log('...with the captured tab selected', (await f().$eval('.card[aria-selected="true"] .title', (n) => n.textContent)) === 't1 page');
T.log('...showing its picture', !!(await f().$('.card[aria-selected="true"] img.shot')));

await T.close();
