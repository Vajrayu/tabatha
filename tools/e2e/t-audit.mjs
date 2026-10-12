// Fixes from the 12 Oct engineering audit: bookmarklets are never lost through "open and remove",
// a bookmarklet can be renamed, "Delete tab group" forgets the saved copy even when the group holds
// the tab Tabatha is open over, a saved group reopens even if Chrome refuses one of its pages, ⋯ menus work
// with the keyboard, a double click reopens a saved group once, a failed open doesn't block the next press, a frozen page doesn't leave Alt+Q dead, and content scripts can't read Tabatha's storage.
import { launch, withPermissions } from './lib.mjs';
const T = await launch(withPermissions(process.env.EXT, ['tabGroups', 'bookmarks']));
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
const f = () => T.frame(a);
const openMarks = async () => {
  await a.bringToFront(); await T.tap(a);
  if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
  await f().click('#ptab-marks'); await a.waitForTimeout(400);
};
// Inside Tabatha's page, make Chrome refuse one made-up address, as it refuses some real ones (chrome://crash,
// policy-blocked sites). The real chrome://crash is not used: now and then it really crashes the test browser.
const REFUSED = 'https://refused.example/';
const refuse = (frame) => frame.evaluate((bad) => { const orig = chrome.tabs.create.bind(chrome.tabs); chrome.tabs.create = (o) => (String(o && o.url).startsWith(bad) ? Promise.reject(new Error('refused (test)')) : orig(o)); }, REFUSED);
const close = async () => { for (let i = 0; i < 3; i++) await a.keyboard.press('Escape'); await a.waitForTimeout(500); };

// 1. Bookmarklets.
const id = await ev(async () => (await chrome.bookmarks.create({ parentId: '1', title: 'My bookmarklet', url: 'javascript:void(document.title=1)' })).id);
await openMarks();
const row = () => f().locator('#pane-marks .mrow', { hasText: 'My bookmarklet' }).first();
T.log('a bookmarklet has no "open and remove" button', (await row().count()) === 1 && (await row().locator('.pb[title^="Open and remove"]').count()) === 0);
await row().locator('.mname').evaluate((b) => b.click()); await a.waitForTimeout(300);
const exists = () => ev(async (id) => { try { return (await chrome.bookmarks.get(id)).length === 1; } catch { return false; } }, id);
T.log('clicking it explains instead of failing, and keeps it', (await exists()) && /bookmarklet/i.test(await f().$eval('#toast', (n) => n.textContent)) && (await T.isOpen(a)));
await row().locator('.pb[title="Edit"]').evaluate((b) => b.click()); await a.waitForTimeout(300);
await f().locator('.medit input').first().fill('Renamed bookmarklet');
await f().locator('.medit button[type=submit]').evaluate((b) => b.click()); await a.waitForTimeout(500);
const bm = await ev(async (id) => (await chrome.bookmarks.get(id))[0], id);
T.log('a bookmarklet can be renamed (its javascript: address is kept)', bm.title === 'Renamed bookmarklet' && bm.url.startsWith('javascript:'), bm.title);
// "Open and remove" on an address Chrome refuses keeps the bookmark (it is only removed once the tab exists).
const bad = await ev(async (url) => (await chrome.bookmarks.create({ parentId: '1', title: 'Refused page', url })).id, REFUSED);
await close(); await openMarks(); await refuse(f());
await f().locator('#pane-marks .mrow', { hasText: 'Refused page' }).first().locator('.pb[title^="Open and remove"]').evaluate((b) => b.click());
await a.waitForTimeout(600);
T.log('"Open and remove" keeps a bookmark Chrome refuses to open', await ev(async (id) => { try { return (await chrome.bookmarks.get(id)).length === 1; } catch { return false; } }, bad));
const ok = await ev(async (u) => (await chrome.bookmarks.create({ parentId: '1', title: 'Fine page', url: u })).id, T.url('t1'));
await close(); await openMarks();
await f().locator('#pane-marks .mrow', { hasText: 'Fine page' }).first().locator('.pb[title^="Open and remove"]').evaluate((b) => b.click());
await a.waitForTimeout(1000);
const after = await ev(async (id) => { let gone = false; try { await chrome.bookmarks.get(id); } catch { gone = true; } const tabs = (await chrome.tabs.query({})).map((x) => x.pendingUrl || x.url); return { gone, opened: tabs.some((u) => u.endsWith('t1.html')) }; }, ok);
T.log('…and still opens a normal one, then removes it', after.gone && after.opened, JSON.stringify(after));
await a.bringToFront();
await close();

// 2. Delete tab group when the group holds the tab Tabatha sits on.
const tabsNow = await ev(async () => (await chrome.tabs.query({})).map((x) => ({ id: x.id, url: x.url })));
const alpha = tabsNow.find((x) => x.url.endsWith('alpha.html')), beta = tabsNow.find((x) => x.url.endsWith('beta.html'));
await ev(async ({ ids }) => { const g = await chrome.tabs.group({ tabIds: ids }); await chrome.tabGroups.update(g, { title: 'Doomed here', color: 'red' }); }, { ids: [alpha.id, beta.id] });
await ev(() => new Promise((r) => setTimeout(r, 1500)));
const saved = () => ev(async () => ((await chrome.storage.local.get('groups')).groups || []).map((g) => g.title));
T.log('the open group has a saved copy', (await saved()).includes('Doomed here'));
await a.bringToFront(); await T.tap(a);
if (await f().$eval('#panel', (n) => n.hidden)) await f().click('#panel-btn');
await f().click('#ptab-groups'); await a.waitForTimeout(300);
await f().locator('#pane-groups .layer.live', { hasText: 'Doomed here' }).locator('.pb.more').evaluate((b) => b.click()); await a.waitForTimeout(200);
await f().locator('.menu .mi', { hasText: 'Delete the group and its tabs' }).evaluate((b) => b.click()); await a.waitForTimeout(150);
await f().locator('.menu .mi.armed').evaluate((b) => b.click()).catch(() => {});
await ev(() => new Promise((r) => setTimeout(r, 3000)));
const left = await ev(async () => (await chrome.tabs.query({})).map((x) => x.url));
T.log('…its tabs close, the one under Tabatha too', !left.some((u) => /alpha|beta/.test(u)), left.join(' '));
T.log('…and the saved copy is gone (it used to stay under Saved)', !(await saved()).includes('Doomed here'), (await saved()).join());

// 3. Reopening a saved group skips a page Chrome refuses, instead of stopping half way.
await ev(async ({ u, bad }) => {
  const g = { id: 'probe-1', title: 'Half bad', color: 'green', tabs: [{ u: bad, ti: 'refused' }, { u, ti: 'gamma page' }], t: Date.now(), cid: null, b: 0, open: false };
  const cur = (await chrome.storage.local.get('groups')).groups || [];
  await chrome.storage.local.set({ groups: [...cur, g] });
}, { u: T.url('gamma'), bad: REFUSED });
{
  const p2 = await T.ctx.newPage();
  await p2.goto(T.url('t1')); await p2.waitForTimeout(600); await p2.bringToFront();
  await T.tap(p2);
  const f2 = T.frame(p2);
  if (await f2.$eval('#panel', (n) => n.hidden)) await f2.click('#panel-btn');
  await f2.click('#ptab-groups'); await p2.waitForTimeout(300);
  await refuse(f2);
  await f2.locator('#pane-groups .layer.saved', { hasText: 'Half bad' }).locator('.lname').evaluate((b) => b.click());
  await p2.waitForTimeout(1200);
  const g = await ev(async () => { const gs = await chrome.tabGroups.query({ title: 'Half bad' }); if (!gs.length) return null; return (await chrome.tabs.query({ groupId: gs[0].id })).map((x) => x.pendingUrl || x.url); });
  T.log('a saved group with a page Chrome refuses still reopens as a group, without that page', !!g && g.length === 1 && g[0].endsWith('gamma.html'), JSON.stringify(g));
}

// 4. Keyboard in a ⋯ menu: arrows move between its items, Esc closes only the menu.
{
  const p3 = await T.ctx.newPage(); // its own page: earlier steps close tabs
  await p3.goto(T.url('t2')); await p3.waitForTimeout(600); await p3.bringToFront();
  await T.tap(p3);
  const f3 = T.frame(p3);
  const card = f3.locator('#open-grid .card').first();
  await card.locator('.pick').evaluate((b) => b.click()); await p3.waitForTimeout(200);
  const selBefore = await f3.$eval('[aria-selected="true"].card', (n) => n.id);
  await f3.locator('#acts-btns .qa.more').evaluate((b) => b.click()); await p3.waitForTimeout(200);
  const focused = () => f3.evaluate(() => document.activeElement && document.activeElement.textContent);
  const first = await focused();
  await p3.keyboard.press('ArrowDown'); await p3.waitForTimeout(100);
  const second = await focused();
  T.log('ArrowDown moves to the next menu item', first !== second && (await f3.$$eval('.menu .mi', (x) => x.map((n) => n.textContent))).indexOf(second) === 1, first + ' -> ' + second);
  T.log('…and leaves the card selection alone', (await f3.$eval('[aria-selected="true"].card', (n) => n.id)) === selBefore);
  await p3.keyboard.press('Escape'); await p3.waitForTimeout(200);
  T.log('Esc closes the menu, not Tabatha', (await f3.$$eval('.menu', (x) => x.length)) === 0 && (await T.isOpen(p3)));
  await p3.keyboard.press('Escape').catch(() => {});
}

// 5. A double click on a saved group opens it once, not twice.
await ev(async (u) => {
  const g = { id: 'dbl-1', title: 'Twice', color: 'green', tabs: [{ u, ti: 'beta page' }], t: Date.now(), cid: null, b: 0, open: false };
  const cur = (await chrome.storage.local.get('groups')).groups || [];
  await chrome.storage.local.set({ groups: [...cur, g] });
}, T.url('beta'));
{
  const p4 = await T.ctx.newPage();
  await p4.goto(T.url('t2')); await p4.waitForTimeout(600); await p4.bringToFront();
  await T.tap(p4);
  const f4 = T.frame(p4);
  if (await f4.$eval('#panel', (n) => n.hidden)) await f4.click('#panel-btn');
  await f4.click('#ptab-groups'); await p4.waitForTimeout(300);
  await f4.locator('#pane-groups .layer.saved', { hasText: 'Twice' }).locator('.lname').evaluate((b) => { b.click(); b.click(); });
  await p4.waitForTimeout(1500);
  T.log('a double click on a saved group reopens it once', (await ev(async () => (await chrome.tabGroups.query({ title: 'Twice' })).length)) === 1);
}

// 6. Content scripts can't read Tabatha's storage (previews are screenshots of every site).
const p = await T.ctx.newPage();
await p.goto(T.url('gamma')); await p.waitForTimeout(500);
const res = await ev(async () => {
  const [t] = await chrome.tabs.query({ url: '*://localhost/*' });
  const [r] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: async () => { try { await chrome.storage.local.get(null); return 'read'; } catch { return 'blocked'; } } });
  return r.result;
});
T.log('a content script is refused storage.local', res === 'blocked', res);
// 7. A failed open (the popup window couldn't be made) doesn't swallow the presses that follow.
{
  const pv = await T.ctx.newPage(); await pv.goto('chrome://version'); await pv.waitForTimeout(500); await pv.bringToFront();
  await ev(() => { self.__wc = chrome.windows.create; let n = 0; chrome.windows.create = async (o) => { if (n++ < 2) throw new Error('simulated'); return self.__wc(o); }; });
  const press = () => ev(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); chrome.commands.onCommand.dispatch('open-switcher', t); });
  await press(); await pv.waitForTimeout(1100); // the first try fails (both popup attempts)
  await press(); await pv.waitForTimeout(1500);
  const n = await ev(async () => (await chrome.windows.getAll()).filter((w) => w.type === 'popup').length);
  T.log('a press right after a failed open still opens Tabatha', n === 1, String(n));
  await ev(() => { chrome.windows.create = self.__wc; });
}
// 8. A frozen page (Chrome: "Page unresponsive") doesn't leave Alt+Q dead: the popup window takes over.
{
// The page freezes (its main thread never comes back), like a tab Chrome calls "unresponsive".
const fz = await T.ctx.newPage(); await fz.goto(T.url('t1')); await fz.waitForTimeout(500); await fz.bringToFront();
await fz.evaluate(() => { setTimeout(() => { for (;;) {} }, 50); });
await new Promise((r) => setTimeout(r, 500));
const t0 = Date.now();
await ev(async () => { const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); chrome.commands.onCommand.dispatch('open-switcher', t); });
let popup = 0;
for (let i = 0; i < 16 && !popup; i++) { await new Promise((r) => setTimeout(r, 500)); popup = await ev(async () => (await chrome.windows.getAll()).filter((w) => w.type === 'popup').length); }
T.log('Alt+Q on a frozen page still opens Tabatha (as a window)', !!popup, popup ? `${Date.now() - t0} ms` : 'nothing after 8 s');
await ev(async () => { for (const w of await chrome.windows.getAll()) if (w.type === 'popup') await chrome.windows.remove(w.id); });
}
await T.ctx.close().catch(() => {}); process.exit(process.exitCode || 0);
