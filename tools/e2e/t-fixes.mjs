// Fixes from the 12 Oct review: Sleep marks first and unloads on close, Cancel on a new bookmark folder
// removes it, "Capture" says when there is nothing to capture and reopens Tabatha after a run,
// the Web Store never gets a "Capture preview" button, the page behind does not scroll.
import { launch, withPermissions } from './lib.mjs';
const T = await launch(withPermissions(process.env.EXT, ['bookmarks']));
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url('gamma'));
await ev(() => chrome.tabs.create({ url: 'https://chromewebstore.google.com/', active: false }));
await ev(() => new Promise((r) => setTimeout(r, 1200)));
const f = () => T.frame(a);
const tabs = () => ev(async () => (await chrome.tabs.query({})).map((x) => ({ id: x.id, url: x.url || x.pendingUrl, discarded: x.discarded, active: x.active })));
// Playwright dies when Chrome discards a tab, so the worker only records what it would unload.
await ev(() => { self.__slept = []; chrome.tabs.discard = async (id) => { self.__slept.push(id); }; });
await a.bringToFront(); await T.tap(a);

// Sleep from a card: marked at once, unloaded after Tabatha closes.
const beta = f().locator('#open-grid .card', { hasText: 'beta page' }).first();
await beta.hover(); await beta.locator('.qbtn[title^="Put to sleep"]').click(); await a.waitForTimeout(300);
T.log('Sleep marks the card instead of unloading it at once', /Sleeps when you leave/.test(await beta.textContent()) && !(await tabs()).find((x) => x.url.endsWith('beta.html')).discarded);
await a.keyboard.press('Escape'); await a.waitForTimeout(1200);
T.log('…and the tab is unloaded once Tabatha closes', (await ev(() => self.__slept)).includes((await tabs()).find((x) => x.url.endsWith('beta.html')).id));

// The Web Store can never be captured: no button on its card.
await T.tap(a);
const store = f().locator('#open-grid .card', { hasText: /chromewebstore|Chrome Web Store/ }).first();
T.log('no "Capture preview" on a Chrome Web Store card', (await store.count()) === 1 && (await store.locator('.snap').count()) === 0);

// Bookmarks: New folder, then Cancel, leaves nothing behind.
if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
await f().click('#ptab-marks'); await a.waitForTimeout(300);
const bar = f().locator('#pane-marks .mrow.folder').first();
await bar.hover(); await bar.locator('.pb.more').click(); await a.waitForTimeout(200);
await f().locator('.menu .mi', { hasText: 'New folder here' }).click(); await a.waitForTimeout(400);
await f().locator('#pane-marks .medit button:has-text("Cancel")').click(); await a.waitForTimeout(400);
T.log('Cancel on a new folder removes it', await ev(async () => (await chrome.bookmarks.search({ title: 'New folder' })).length === 0));

// Folder ⋯ menu: delete says how many bookmarks are inside; drag a bookmark onto another folder moves it.
await ev(async () => { const f1 = await chrome.bookmarks.create({ parentId: '1', title: 'Keep' }); const f2 = await chrome.bookmarks.create({ parentId: '1', title: 'Doomed folder' });
  await chrome.bookmarks.create({ parentId: f2.id, title: 'one', url: 'https://example.com/1' }); await chrome.bookmarks.create({ parentId: f2.id, title: 'two', url: 'https://example.com/2' }); });
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a);
if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
await f().click('#ptab-marks'); await a.waitForTimeout(300);
const doomed = f().locator('#pane-marks .mrow.folder', { hasText: 'Doomed folder' }).first();
await doomed.locator('.mname').click(); await a.waitForTimeout(200); // open it
const one = f().locator('#pane-marks .mrow:not(.folder)', { hasText: 'one' }).first();
await one.dragTo(f().locator('#pane-marks .mrow.folder', { hasText: 'Keep' }).first()); await a.waitForTimeout(500);
T.log('dragging a bookmark onto a folder moves it there', await ev(async () => { const [k] = await chrome.bookmarks.search({ title: 'Keep' }); return (await chrome.bookmarks.getChildren(k.id)).some((x) => x.title === 'one'); }));
await doomed.hover(); await doomed.locator('.pb.more').click(); await a.waitForTimeout(200);
await f().locator('.menu .mi', { hasText: 'Delete folder' }).click(); await a.waitForTimeout(200);
T.log('deleting a folder says what is inside and asks again', /the bookmark inside\? Click again/.test(await f().locator('.menu .mi.armed').textContent()));
await f().locator('.menu .mi.armed').click(); await a.waitForTimeout(400);
T.log('…then deletes the folder', await ev(async () => (await chrome.bookmarks.search({ title: 'Doomed folder' })).length === 0));

// The page behind doesn't scroll when you scroll the switcher's header.
const y0 = await a.evaluate(() => { document.body.style.height = '5000px'; return scrollY; });
await a.mouse.move(640, 30); await a.mouse.wheel(0, 600); await a.waitForTimeout(300);
T.log('scrolling over Tabatha doesn’t scroll the page behind', (await a.evaluate(() => scrollY)) === y0);

// Settings: the language can be switched inside Tabatha (and back), and "open when Chrome starts" is saved.
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a);
await f().evaluate(() => document.getElementById('settings-btn').click()); await a.waitForTimeout(400); // headless Chrome drops real clicks at the very bottom edge
await f().selectOption('.pop.settings select', 'ru'); await a.waitForTimeout(400);
T.log('choosing Русский switches the interface at once', (await f().$eval('#open-h', (n) => n.textContent)) === 'Открытые вкладки' && /Поиск/.test(await f().$eval('#search', (n) => n.placeholder)));
await a.keyboard.press('Escape'); await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a);
T.log('…and stays Russian next time', (await f().$eval('#open-h', (n) => n.textContent)) === 'Открытые вкладки');
await f().evaluate(() => document.getElementById('settings-btn').click()); await a.waitForTimeout(400);
await f().selectOption('.pop.settings select', 'en'); await a.waitForTimeout(300);
await f().check('#set-startup'); await a.waitForTimeout(300);
T.log('…and back to English; the start-up option is saved', (await f().$eval('#open-h', (n) => n.textContent)) === 'Open tabs' && (await ev(() => chrome.storage.local.get('prefs').then((o) => o.prefs))).startup === true);
await a.keyboard.press('Escape'); await a.waitForTimeout(200);

// Typing in the group-name card (and in a bookmark's edit form) stays there; it must not go into the search box.
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a);
const c1 = f().locator('#open-grid .card').first(); await c1.hover(); await c1.locator('.pick').click(); await a.waitForTimeout(200);
await f().locator('#acts-btns .qa').nth(3).click(); await a.waitForTimeout(300); // Group
await f().fill('.pop input', ''); await f().locator('.pop input').pressSequentially('Work stuff'); await a.waitForTimeout(200);
T.log('typing a group name stays in the name field', (await f().$eval('.pop input', (n) => n.value)) === 'Work stuff' && (await f().$eval('#search', (n) => n.value)) === '');
await a.keyboard.press('Escape'); await a.waitForTimeout(200);
T.log('Esc closes the card and leaves Tabatha open', !(await f().$('.pop')) && (await T.isOpen(a)));
if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
await f().click('#ptab-marks'); await a.waitForTimeout(300);
const kf = f().locator('#pane-marks .mrow.folder', { hasText: 'Keep' }).first();
await kf.hover(); await kf.locator('.pb.more').click(); await a.waitForTimeout(200);
await f().locator('.menu .mi', { hasText: 'Rename' }).click(); await a.waitForTimeout(300);
await f().locator('#pane-marks .medit input').first().fill(''); await f().locator('#pane-marks .medit input').first().pressSequentially('Kept things'); await a.waitForTimeout(200);
T.log('typing a bookmark folder name stays in its field', (await f().locator('#pane-marks .medit input').first().inputValue()) === 'Kept things' && (await f().$eval('#search', (n) => n.value)) === '');
await a.keyboard.press('Enter'); await a.waitForTimeout(500);
T.log('…and Enter saves it', await ev(async () => (await chrome.bookmarks.search({ title: 'Kept things' })).length === 1));
await f().locator('#acts #sel-none').click().catch(() => {});

// "Capture": nothing to do -> says so and stays open; something to do -> runs and reopens Tabatha.
await ev(async () => { for (const t of await chrome.tabs.query({})) if (/gamma/.test(t.url)) await chrome.tabs.remove(t.id); });
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a);
const sweepShown = !(await f().$eval('#sweep-btn', (n) => n.hidden));
T.log('with every tab captured there is no Capture button', !sweepShown);
await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url('t1'));
await a.keyboard.press('Escape'); await a.waitForTimeout(300); await T.tap(a); await a.waitForTimeout(300);
await f().click('#sweep-btn'); await a.waitForTimeout(300);
await T.capPress(a, 0); await a.waitForTimeout(500); // the capture card (1.3.5): its first button
T.log('Capture closes Tabatha while it works', !(await T.isOpen(a)));
await a.waitForTimeout(4500);
T.log('…and opens it again when done', await T.isOpen(a));
T.log('the tab now has a preview', await ev(async () => { const o = await chrome.storage.local.get(null); return Object.keys(o).some((k) => k.startsWith('pv:') && k.includes('t1.html')); }));
await T.close();
