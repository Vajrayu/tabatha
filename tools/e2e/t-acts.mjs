// Quick actions (12 Oct design): nothing acts until tabs are ticked; while searching "Select all N matching
// tabs" ticks them; the pill floats; Close asks twice for more than one; Group asks for a name and colour;
// duplicates are shown first, then closed. Also the tab count on the icon and the bookmarks panel.
import { launch, withPermissions } from './lib.mjs';
const T = await launch(withPermissions(process.env.EXT, ['tabGroups', 'bookmarks']));
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
for (const n of ['gamma', 't1', 'gamma', 't2']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n));
await ev(() => new Promise((r) => setTimeout(r, 1200)));
const tabs = () => ev(async () => (await chrome.tabs.query({})).map((x) => ({ id: x.id, url: x.url, title: x.title, pinned: x.pinned, muted: x.mutedInfo.muted, groupId: x.groupId, windowId: x.windowId })));
const f = () => T.frame(a);
const reopen = async () => { if (await T.isOpen(a)) { for (let i = 0; i < 3; i++) await a.keyboard.press('Escape'); await a.waitForTimeout(300); } await a.bringToFront(); await T.tap(a); };
const MORE = { md: 'Copy as Markdown', win: 'Move to new window', sleep: 'Sleep', pin: /^(Pin|Unpin)$/, mute: /^(Mute|Unmute)$/ };
// Close, Copy links, Bookmark, Group are on the bar; the rest are in "More".
const btn = (id) => (MORE[id]
  ? { click: async () => { await f().locator('#acts-btns .qa.more').click(); await a.waitForTimeout(150); await f().locator('.menu .mi', { hasText: MORE[id] }).first().click(); } }
  : f().locator('#acts-btns .qa').nth(['close', 'copy', 'mark', 'group'].indexOf(id)));
const pill = async () => !(await f().$eval('#acts', (n) => n.hidden));
const card = (name) => f().locator('#open-grid .card', { hasText: name }).first();
const tick = async (name) => { const c = card(name); await c.hover(); await c.locator('.pick').click(); await a.waitForTimeout(200); };

T.log('the icon shows the number of open tabs', (await ev(() => chrome.action.getBadgeText({}))) === String((await tabs()).length));

await a.bringToFront(); await T.tap(a);
T.log('no actions pill before searching or ticking', !(await pill()));

// Duplicates: the button shows the copies first, marked, then closes only the extra copy.
T.log('duplicates button counts the second gamma', /^1 duplicate$/.test(await f().$eval('#dupes-text', (n) => n.textContent)));
await f().click('#dupes-btn'); await a.waitForTimeout(300);
const shown = await f().$$eval('#open-grid .card .title', (x) => x.map((n) => n.textContent));
const marks = await f().$$eval('#open-grid .card .tag.stays, #open-grid .card .tag.goes', (x) => x.map((n) => n.textContent));
T.log('first click shows only the copies, marked Stays / Closes', shown.length === 2 && shown.every((x) => x === 'gamma page') && marks.join() === 'Stays,Closes', shown.join() + ' / ' + marks.join());
T.log('…and nothing closed yet', (await tabs()).filter((x) => x.url.endsWith('gamma.html')).length === 2);
await f().locator('#acts-btns .qa.danger').click(); await a.waitForTimeout(200);
T.log('Close copies asks once more', /Click again/.test(await f().locator('#acts-btns .qa.danger').textContent()));
await f().locator('#acts-btns .qa.danger').click(); await a.waitForTimeout(700);
T.log('…then closes the extra copy only', (await tabs()).filter((x) => x.url.endsWith('gamma.html')).length === 1);

// Search: the pill only offers "Select all"; actions appear once something is ticked.
await reopen();
await a.keyboard.type('page'); await a.waitForTimeout(400);
T.log('searching shows "Select all N matching tabs" and no actions yet', (await pill()) && /^Select all \d+ matching tabs$/.test(await f().$eval('#sel-all', (n) => n.textContent)) && (await f().$eval('#acts-btns', (n) => n.hidden)));
await f().click('#sel-all'); await a.waitForTimeout(300);
const all = await tabs();
T.log('Select all ticks every match', /selected/.test(await f().$eval('#acts-n', (n) => n.textContent)) && (await f().$$eval('#open-grid .card.picked', (x) => x.length)) === all.filter((x) => x.title.endsWith('page')).length);
await btn('pin').click(); await a.waitForTimeout(500);
T.log('Pin pins the ticked tabs', (await tabs()).filter((x) => x.title.endsWith('page')).every((x) => x.pinned));
await btn('pin').click(); await a.waitForTimeout(500);
T.log('…and the same button unpins them', (await tabs()).every((x) => !x.pinned));
await f().click('#sel-none'); await a.waitForTimeout(200);
T.log('Clear unticks everything', (await f().$$eval('#open-grid .card.picked', (x) => x.length)) === 0);

// Tick two, mute, copy.
await tick('alpha page');
await card('beta page').locator('.title').click({ modifiers: ['ControlOrMeta'] }); await a.waitForTimeout(200);
T.log('the box and Ctrl/Cmd+click tick cards', (await f().$$eval('#open-grid .card.picked', (x) => x.length)) === 2 && /^2 selected/.test(await f().$eval('#acts-n', (n) => n.textContent)));
await btn('mute').click(); await a.waitForTimeout(500);
T.log('Mute acts on the ticked tabs only', (await tabs()).filter((x) => x.muted).length === 2);
await btn('copy').click(); await a.waitForTimeout(300);
T.log('Copy links says how many', /Copied 2 links/.test(await f().$eval('#toast', (n) => n.textContent)));

// Group: a popover asks for a name (the search word to start with) and a colour.
await btn('group').click(); await a.waitForTimeout(300);
T.log('Group opens a name + colour card, prefilled with the search', (await f().$eval('.pop input', (n) => n.value)) === 'page' && (await f().$$eval('.pop .sw', (x) => x.length)) === 9);
await f().fill('.pop input', 'Reading'); await f().locator('.pop .sw').nth(4).click(); await f().locator('.pop button[type=submit]').click(); await a.waitForTimeout(800);
const g = await ev(async () => { const gs = await chrome.tabGroups.query({}); return gs.map((x) => [x.title, x.color]); });
T.log('…and makes a group with that name and colour', g.length === 1 && g[0][0] === 'Reading' && g[0][1] === 'green', JSON.stringify(g));

// Bookmarks panel + bookmark the ticked tabs into a folder named after the search.
await f().click('#sel-all').catch(() => {}); await a.waitForTimeout(200);
if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
await f().click('#ptab-marks'); await a.waitForTimeout(300);
await btn('mark').click(); await a.waitForTimeout(800);
const bm = await ev(async () => { const [r] = await chrome.bookmarks.getTree(); return r.children.find((x) => x.id === '1').children.map((x) => ({ title: x.title, n: (x.children || []).length })); });
T.log('Bookmark with several ticked tabs makes a folder named after the search', bm.some((m) => m.title === 'page' && m.n >= 4), JSON.stringify(bm));

// Edit and delete one bookmark in the panel.
await a.keyboard.press('Escape'); await a.waitForTimeout(300); // clears the search: the tree shows
if (!(await f().locator('#pane-marks .mrow:not(.folder)').count())) { await f().locator('#pane-marks .mrow.folder .mname', { hasText: 'page' }).first().click(); await a.waitForTimeout(200); }
const row = f().locator('#pane-marks .mrow:not(.folder)').first();
await row.hover(); await row.locator('.pb[title="Edit"]').click(); await a.waitForTimeout(200);
await f().fill('#pane-marks .medit input', 'Renamed bookmark'); await f().click('#pane-marks .medit button[type=submit]'); await a.waitForTimeout(500);
T.log('a bookmark can be renamed in the panel', await ev(async () => (await chrome.bookmarks.search({ title: 'Renamed bookmark' })).length === 1));
const r2 = f().locator('#pane-marks .mrow', { hasText: 'Renamed bookmark' }).first();
await r2.hover(); await r2.locator('.pb.x').click(); await a.waitForTimeout(200);
T.log('deleting a bookmark asks first', await ev(async () => (await chrome.bookmarks.search({ title: 'Renamed bookmark' })).length === 1));
await f().locator('#pane-marks .btn.danger').click(); await a.waitForTimeout(400);
T.log('…and the second click deletes it', await ev(async () => (await chrome.bookmarks.search({ title: 'Renamed bookmark' })).length === 0));

// Close two ticked tabs: two presses.
await reopen(); await a.keyboard.type('page'); await a.waitForTimeout(300);
await tick('t1 page'); await tick('t2 page');
const before = (await tabs()).length;
await btn('close').click(); await a.waitForTimeout(300);
T.log('closing two tabs asks first', (await tabs()).length === before && /Click again/.test(await btn('close').textContent()));
await btn('close').click(); await a.waitForTimeout(700);
T.log('…and the second press closes both', (await tabs()).length === before - 2);
T.log('the icon count follows', (await ev(() => new Promise((r) => setTimeout(r, 500)).then(() => chrome.action.getBadgeText({})))) === String(before - 2));

// New window.
await reopen(); await a.keyboard.type('beta'); await a.waitForTimeout(300);
T.log('one match shows no actions until it is ticked', !(await pill()) || (await f().$eval('#acts-btns', (n) => n.hidden)));
await tick('beta page');
await btn('win').click(); await a.waitForTimeout(800);
const now = await tabs();
const beta = now.find((x) => x.url.endsWith('beta.html'));
T.log('Move to new window gives the ticked tab a window of its own', beta && now.filter((x) => x.windowId === beta.windowId).length === 1);
await T.close();
