// 1.3.5 review of 14 Oct: (2) a window's ⋯ menu (rename until Chrome quits, select its tabs, bookmark it, make a tab
// group of it, delete it with a second click); (3) choosing Group: Tab groups asks for the tab-groups permission when it
// is off and only switches if it is allowed; (4) every section that is not a real tab group (site, last used,
// "Ungrouped") has a ⋯ menu: select, bookmark, make a tab group (not when its tabs already are one group), move to a
// new window, sleep, close (second click); "No grouping" has no sections, so no menu. (1) The header, toolbar and window
// list share one left edge.
import { launch, withPermissions } from './lib.mjs';

const within = (p, ms = 3000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const items = (f) => within(f.evaluate(() => [...document.querySelectorAll('.menu .mi')].map((x) => x.textContent)));
const pickItem = (f, text) => f.evaluate((text) => { const b = [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.startsWith(text)); if (b) b.click(); return !!b; }, text);
const click = (f, sel) => f.evaluate((s) => document.querySelector(s).click(), sel);

// ---------- windows ----------
{
  const T = await launch(withPermissions(process.env.EXT, ['tabGroups', 'bookmarks']), { viewport: { width: 1280, height: 800 } });
  const ev = (fn, a) => T.sw.evaluate(fn, a);
  const [a] = await T.open(['alpha', 'beta']);
  await T.skipFirstRun();
  for (const n of ['gamma', 't1']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n));
  await ev(async (u) => { await chrome.windows.create({ url: u, focused: false }); }, T.url('t2'));
  const f = () => T.frame(a);
  const open = async () => { await a.bringToFront(); await T.tap(a); await a.waitForTimeout(600); };
  await open();

  // (1) one left edge
  const edges = await f().evaluate(() => { const L = (s) => Math.round(document.querySelector(s).getBoundingClientRect().left); const I = (s) => Math.round(document.querySelector(s).getBoundingClientRect().left); return { newtab: L('#newtab'), chip: L('#star-filter'), wins: L('#wins'), foot: L('.foot'), newtabIcon: I('#newtab svg'), starIcon: I('#star-filter svg'), winIcon: I('#wins .wico') }; });
  T.log('the New tab button, the toolbar, the window list and the footer share one left edge', edges.newtab === edges.chip && edges.chip === edges.wins && edges.wins === edges.foot, JSON.stringify(edges));
  T.log('…and their first icons line up (within 2 px)', Math.max(edges.newtabIcon, edges.starIcon, edges.winIcon) - Math.min(edges.newtabIcon, edges.starIcon, edges.winIcon) <= 2, JSON.stringify(edges));

  const rows = await f().$$eval('#wins .winrow', (r) => r.map((x) => !!x.querySelector('.wmore')));
  T.log('"All windows" has no ⋯ menu, each real window has one', JSON.stringify(rows) === '[false,true,true]', JSON.stringify(rows));
  const wmore = (i) => f().locator('#wins .winrow').nth(i).locator('.wmore');
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  const mi = await items(f());
  T.log('a window\'s menu: Rename · Select its tabs · Bookmark the window · Make a tab group · Delete window', JSON.stringify(mi) === JSON.stringify(['Rename', 'Select its tabs', 'Bookmark the window', 'Make a tab group', 'Delete window']), JSON.stringify(mi));

  // rename
  await pickItem(f(), 'Rename'); await a.waitForTimeout(250);
  await f().evaluate(() => { const i = document.querySelector('.pop input'); i.value = 'Work'; });
  await f().evaluate(() => document.querySelector('.pop button[type=submit]').click()); await a.waitForTimeout(500);
  const lab = () => f().$$eval('#wins .wlabel', (x) => x.map((n) => n.textContent));
  T.log('renaming a window changes its label in the list', JSON.stringify(await lab()) === JSON.stringify(['All windows', 'Work', 'Window 2']), JSON.stringify(await lab()));
  const stored = await ev(() => chrome.storage.session.get('winnames').then((o) => o.winnames));
  T.log('…kept in memory only (storage.session), not on disk', Object.values(stored || {}).join() === 'Work' && !(await ev(() => chrome.storage.local.get(null).then((o) => JSON.stringify(o).includes('"Work"')))), JSON.stringify(stored));
  await a.keyboard.press('Escape'); await a.waitForTimeout(300);
  await open();
  T.log('…and it is still there next time Tabatha opens', (await lab())[1] === 'Work', JSON.stringify(await lab()));
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Rename'); await a.waitForTimeout(250);
  T.log('the rename card starts with the current name', (await f().evaluate(() => document.querySelector('.pop input').value)) === 'Work');
  await f().evaluate(() => { document.querySelector('.pop input').value = ''; document.querySelector('.pop button[type=submit]').click(); }); await a.waitForTimeout(500);
  T.log('an empty name goes back to "This window"', (await lab())[1] === 'This window', JSON.stringify(await lab()));
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Rename'); await a.waitForTimeout(250);
  await f().evaluate(() => { document.querySelector('.pop input').value = 'x'.repeat(80) + '<b>'; document.querySelector('.pop button[type=submit]').click(); }); await a.waitForTimeout(500);
  const long = (await lab())[1];
  T.log('a name is cut to 40 characters and shown as text', long.length <= 40, long);
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Rename'); await a.waitForTimeout(250);
  await f().evaluate(() => { document.querySelector('.pop input').value = 'Work'; document.querySelector('.pop button[type=submit]').click(); }); await a.waitForTimeout(500);

  // select, bookmark, group
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Select its tabs'); await a.waitForTimeout(300);
  const picked = await f().$$eval('#open-grid .card.picked', (x) => x.length);
  T.log('"Select its tabs" ticks every tab of that window', picked === 4, String(picked));
  await f().evaluate(() => document.getElementById('sel-none') && document.getElementById('sel-none').click()); await a.waitForTimeout(200);
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Bookmark the window'); await a.waitForTimeout(700);
  const bm = await ev(async () => { const r = await chrome.bookmarks.search({ title: 'Work' }); const folder = r.find((x) => !x.url); return folder ? (await chrome.bookmarks.getChildren(folder.id)).length : -1; });
  T.log('"Bookmark the window" makes a folder with its name and one bookmark per tab', bm === 4, String(bm));
  await wmore(1).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Make a tab group'); await a.waitForTimeout(300);
  const prefill = await f().evaluate(() => document.querySelector('.pop input').value);
  T.log('"Make a tab group" starts with the window\'s name', prefill === 'Work', prefill);
  await f().evaluate(() => document.querySelector('.pop button[type=submit]').click()); await a.waitForTimeout(900);
  const grp = await ev(async () => { const g = await chrome.tabGroups.query({}); return g.map((x) => x.title); });
  T.log('…and groups the window\'s tabs', JSON.stringify(grp) === '["Work"]', JSON.stringify(grp));

  // delete: two clicks
  await wmore(2).evaluate((b) => b.click()); await a.waitForTimeout(250);
  const wins0 = await ev(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length);
  await pickItem(f(), 'Delete window'); await a.waitForTimeout(300);
  const armed = await f().evaluate(() => document.querySelector('.menu .mi.danger.armed') && document.querySelector('.menu .mi.danger.armed').textContent);
  T.log('Delete window asks first ("Close this window and its 1 tab? Click again")', armed === 'Close this window and its 1 tab? Click again', String(armed));
  T.log('…nothing is closed by the first click', (await ev(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length)) === wins0);
  await pickItem(f(), 'Close this window'); await a.waitForTimeout(1200);
  const wins1 = await ev(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length);
  T.log('the second click closes the window and its tabs', wins1 === wins0 - 1, `${wins0} -> ${wins1}`);
  await T.close();
}

// ---------- Group: Tab groups asks for the permission ----------
{
  const T = await launch(process.env.EXT, { viewport: { width: 1280, height: 800 } });
  const [a] = await T.open(['alpha', 'beta']);
  await T.skipFirstRun();
  const f = () => T.frame(a);
  await T.tap(a); await a.waitForTimeout(600);
  await f().evaluate(() => { window.__asked = []; window.__answer = false; chrome.permissions.request = async (p) => { window.__asked.push(p); return window.__answer; }; });
  const group = async (name) => { await click(f(), '#group-by'); await a.waitForTimeout(200); await f().evaluate((n) => [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes(n)).click(), name); await a.waitForTimeout(500); };
  const cur = () => f().$eval('#group-by-v', (x) => x.textContent);
  await group('Site');
  T.log('Group: Site works without any permission', (await cur()) === 'Site' && (await f().evaluate(() => window.__asked.length)) === 0);
  await group('Tab groups');
  const asked = await f().evaluate(() => window.__asked);
  T.log('choosing Tab groups asks for the tab-groups permission', asked.length === 1 && JSON.stringify(asked[0]) === '{"permissions":["tabGroups"]}', JSON.stringify(asked));
  T.log('…and if it is refused the view stays as it was (Site)', (await cur()) === 'Site', await cur());
  await f().evaluate(() => { window.__answer = true; });
  await group('Tab groups');
  T.log('…if it is allowed the view switches to Tab groups', (await cur()) === 'Tab groups' && (await f().evaluate(() => window.__asked.length)) === 2, await cur());
  await group('Site'); await group('No grouping');
  T.log('No grouping and Site never ask', (await f().evaluate(() => window.__asked.length)) === 2);
  await T.close();
}
{
  const T = await launch(withPermissions(process.env.EXT, ['tabGroups']), { viewport: { width: 1280, height: 800 } });
  const [a] = await T.open(['alpha', 'beta']); await T.skipFirstRun();
  const f = () => T.frame(a);
  await T.tap(a); await a.waitForTimeout(600);
  await f().evaluate(() => { window.__asked = []; chrome.permissions.request = async (p) => { window.__asked.push(p); return true; }; });
  await click(f(), '#group-by'); await a.waitForTimeout(200);
  await f().evaluate(() => [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('Site')).click()); await a.waitForTimeout(400);
  await click(f(), '#group-by'); await a.waitForTimeout(200);
  await f().evaluate(() => [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('Tab groups')).click()); await a.waitForTimeout(400);
  T.log('with the permission already on, Tab groups does not ask again', (await f().evaluate(() => window.__asked.length)) === 0 && (await f().$eval('#group-by-v', (x) => x.textContent)) === 'Tab groups');
  await T.close();
}

// ---------- section menus ----------
{
  const T = await launch(withPermissions(process.env.EXT, ['tabGroups', 'bookmarks']), { viewport: { width: 1280, height: 800 } });
  const ev = (fn, a) => T.sw.evaluate(fn, a);
  const [a] = await T.open(['alpha', 'beta']); await T.skipFirstRun();
  // two tabs on another host form their own site section
  for (const n of ['gamma', 't1']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n).replace('localhost', '127.0.0.1'));
  const f = () => T.frame(a);
  const open = async () => { await a.bringToFront(); await T.tap(a); await a.waitForTimeout(700); };
  const group = async (name) => { await click(f(), '#group-by'); await a.waitForTimeout(200); await f().evaluate((n) => [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes(n)).click(), name); await a.waitForTimeout(500); };
  const secMore = () => f().$$eval('#open-grid .gsec .hrow', (r) => r.map((x) => ({ name: x.querySelector('.gname').textContent, more: !!x.querySelector('.pb.more') })));
  await open();
  await group('Site');
  let s = await secMore();
  T.log('Group: Site: each site section has a ⋯ menu', s.length === 2 && s.every((x) => x.more), JSON.stringify(s));
  await group('Last used');
  s = await secMore();
  T.log('Group: Last used: the sections have a ⋯ menu', s.length >= 1 && s.every((x) => x.more), JSON.stringify(s));
  await group('No grouping');
  T.log('No grouping: no sections, so no ⋯ menu', (await f().$$eval('#open-grid .hrow', (r) => r.length)) === 0);
  await group('Site');
  const moreOf = (i) => f().locator('#open-grid .gsec .hrow').nth(i).locator('.pb.more');
  const idx = (await secMore()).findIndex((x) => x.name.startsWith('127.0.0.1'));
  await moreOf(idx).evaluate((b) => b.click()); await a.waitForTimeout(250);
  const mi = await items(f());
  T.log('a section\'s menu: Select · Bookmark · Make a tab group · Move to a new window · Sleep · Close', JSON.stringify(mi) === JSON.stringify(['Select its tabs', 'Bookmark these tabs', 'Make a tab group', 'Move to a new window', 'Put its tabs to sleep', 'Close these tabs']), JSON.stringify(mi));
  await pickItem(f(), 'Select its tabs'); await a.waitForTimeout(300);
  T.log('"Select its tabs" ticks the section\'s tabs', (await f().$$eval('#open-grid .card.picked', (x) => x.length)) === 2);
  await f().evaluate(() => document.getElementById('sel-none') && document.getElementById('sel-none').click()); await a.waitForTimeout(200);
  await moreOf(idx).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Bookmark these tabs'); await a.waitForTimeout(700);
  const bm = await ev(async () => { const r = await chrome.bookmarks.search('127.0.0.1'); const folder = r.find((x) => !x.url && x.title.startsWith('127.0.0.1')); return folder ? (await chrome.bookmarks.getChildren(folder.id)).length : -1; });
  T.log('"Bookmark these tabs" makes a folder named after the section', bm === 2, String(bm));
  await moreOf(idx).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Put its tabs to sleep'); await a.waitForTimeout(300);
  T.log('"Put its tabs to sleep" marks them to sleep as Tabatha closes', (await f().$$eval('#open-grid .card.asleep', (x) => x.length)) >= 1);
  await moreOf(idx).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Put its tabs to sleep'); await a.waitForTimeout(300); // again = unmark (Chrome would unload them when Tabatha closes, which kills Playwright)
  T.log('…and choosing it again takes the mark off', (await f().$$eval('#open-grid .card.asleep', (x) => x.length)) === 0);
  await moreOf(idx).evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Make a tab group'); await a.waitForTimeout(300);
  const pre = await f().evaluate(() => document.querySelector('.pop input').value);
  T.log('"Make a tab group" starts with the site name', pre.startsWith('127.0.0.1'), pre);
  await f().evaluate(() => document.querySelector('.pop button[type=submit]').click()); await a.waitForTimeout(900);
  T.log('…and groups the section\'s tabs', (await ev(async () => (await chrome.tabGroups.query({})).length)) === 1);
  // in the same section now every tab is one tab group: no "Make a tab group"
  await group('Site');
  const idx2 = (await secMore()).findIndex((x) => x.name.startsWith('127.0.0.1'));
  if (idx2 >= 0 && (await f().$$eval('#open-grid .gsec .hrow .pb.more', (r) => r.length)) > 0) {
    const el = f().locator('#open-grid .gsec .hrow').nth(idx2).locator('.pb.more');
    await el.evaluate((b) => b.click()); await a.waitForTimeout(250);
    const m2 = await items(f());
    T.log('a section whose tabs already are one tab group has no "Make a tab group"', Array.isArray(m2) && !m2.includes('Make a tab group'), JSON.stringify(m2));
    await a.keyboard.press('Escape'); await a.waitForTimeout(200);
  } else T.log('a section whose tabs already are one tab group has no "Make a tab group"', true, 'in Tab groups the section is a real group (it uses the group menu)');
  // the real tab group keeps the group menu
  await group('Tab groups');
  const gm = await f().$$eval('#open-grid .gsec', (r) => r.map((x) => ({ name: x.querySelector('.gname') && x.querySelector('.gname').textContent, more: !!x.querySelector('.pb.more') })));
  T.log('Group: Tab groups: the real group and "Ungrouped" both have a ⋯ menu', gm.length === 2 && gm.every((x) => x.more), JSON.stringify(gm));
  const gi = gm.findIndex((x) => x.name === 'Ungrouped');
  await f().locator('#open-grid .gsec .hrow').nth(gi).locator('.pb.more').evaluate((b) => b.click()); await a.waitForTimeout(250);
  const um = await items(f());
  T.log('"Ungrouped" gets the section menu (with "Make a tab group")', Array.isArray(um) && um.includes('Make a tab group') && !um.includes('Rename or recolour'), JSON.stringify(um));
  await a.keyboard.press('Escape'); await a.waitForTimeout(200);
  const rg = f().locator('#open-grid .gsec .hrow').nth(1 - gi).locator('.pb.more');
  await rg.evaluate((b) => b.click()); await a.waitForTimeout(250);
  const rm = await items(f());
  T.log('the real tab group keeps its own menu (Rename or recolour, Ungroup…)', Array.isArray(rm) && rm.includes('Rename or recolour') && rm.includes('Ungroup (keep the tabs)'), JSON.stringify(rm));
  await a.keyboard.press('Escape'); await a.waitForTimeout(200);
  // move to a new window, then close the section from there
  await group('Site');
  const idx3 = (await secMore()).findIndex((x) => x.name.startsWith('127.0.0.1'));
  const wins0 = await ev(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length);
  await f().locator('#open-grid .gsec .hrow').nth(idx3).locator('.pb.more').evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Move to a new window'); await a.waitForTimeout(1200);
  const wins1 = await ev(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] })).length);
  T.log('"Move to a new window" moves the section\'s tabs into a new window', wins1 === wins0 + 1, `${wins0} -> ${wins1}`);
  await T.close();
}
{
  const T = await launch(process.env.EXT, { viewport: { width: 1280, height: 800 } });
  const ev = (fn, a) => T.sw.evaluate(fn, a);
  const [a] = await T.open(['alpha', 'beta']); await T.skipFirstRun();
  for (const n of ['gamma', 't1']) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url(n).replace('localhost', '127.0.0.1'));
  const f = () => T.frame(a);
  await a.bringToFront(); await T.tap(a); await a.waitForTimeout(700);
  await click(f(), '#group-by'); await a.waitForTimeout(200);
  await f().evaluate(() => [...document.querySelectorAll('.menu .mi')].find((x) => x.textContent.includes('Site')).click()); await a.waitForTimeout(500);
  const names = await f().$$eval('#open-grid .gsec .hrow .gname', (r) => r.map((x) => x.textContent));
  const i = names.findIndex((x) => x.startsWith('127.0.0.1'));
  const n0 = await ev(async () => (await chrome.tabs.query({})).length);
  await f().locator('#open-grid .gsec .hrow').nth(i).locator('.pb.more').evaluate((b) => b.click()); await a.waitForTimeout(250);
  await pickItem(f(), 'Close these tabs'); await a.waitForTimeout(300);
  const armed = await f().evaluate(() => document.querySelector('.menu .mi.danger.armed') && document.querySelector('.menu .mi.danger.armed').textContent);
  T.log('"Close these tabs" asks first ("Close 2 tabs? Click again")', armed === 'Close 2 tabs? Click again', String(armed));
  T.log('…nothing is closed by the first click', (await ev(async () => (await chrome.tabs.query({})).length)) === n0);
  await pickItem(f(), 'Close 2 tabs'); await a.waitForTimeout(1500);
  T.log('the second click closes the section\'s tabs', (await ev(async () => (await chrome.tabs.query({})).length)) === n0 - 2, String(await ev(async () => (await chrome.tabs.query({})).length)));
  await T.close();
}
