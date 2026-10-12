// 12 Oct Windows review: close animation, scroll kept after closing, the actions bar at the top, ⋯ More and
// Settings close on a second click, the duplicates button keeps its icon, the Alt+Q note's "Not now",
// and 3 cards a row with the side panel open at 1280 px.
import fs from 'node:fs';
import path from 'node:path';
import { launch, S } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await T.skipFirstRun();
for (let i = 0; i < 18; i++) await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url('gamma') + '?n=' + i);
await ev(async (u) => { await chrome.tabs.create({ url: u, active: false }); }, T.url('beta')); // a duplicate
await ev(() => chrome.storage.local.set({ view: { panel: true, ptab: 'groups' } }));
await a.bringToFront(); await T.tap(a);
const f = () => T.frame(a);

// 3 cards a row with the panel open (1280 px wide).
const perRow = await f().evaluate(() => { const cs = [...document.querySelectorAll('#open-grid .card')]; const top = cs[0].getBoundingClientRect().top; return cs.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length; });
T.log('with the side panel open, 3 or more cards fit in a row at 1280 px', perRow >= 3, String(perRow));
// …and on a narrower window (a laptop with display scaling, or the popup window), still 3.
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await a.setViewportSize({ width: 1100, height: 720 }); await a.waitForTimeout(300);
await T.tap(a);
const narrow = await f().evaluate(() => { const cs = [...document.querySelectorAll('#open-grid .card')]; const top = cs[0].getBoundingClientRect().top; return cs.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length; });
T.log('…and 3 a row on a 1100 px window too', narrow >= 3, String(narrow));
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await a.setViewportSize({ width: 1280, height: 800 }); await a.waitForTimeout(300);
await T.tap(a);

// Closing a tab: its card animates out, and the view stays where it was.
await f().evaluate(() => { document.getElementById('scroller').scrollTop = 600; });
await a.waitForTimeout(200);
const victim = f().locator('#open-grid .card', { hasText: 'gamma' }).nth(8);
const vid = await victim.getAttribute('id');
await victim.hover();
await victim.locator('.x').evaluate((b) => b.click());
await a.waitForTimeout(60);
T.log('a closing card animates out (fades and shrinks) first', await f().evaluate((id) => { const c = document.getElementById(id); return !!c && c.classList.contains('closing'); }, vid));
await a.waitForTimeout(800);
const st = await f().evaluate(() => document.getElementById('scroller').scrollTop);
T.log('…and closing a tab doesn\'t jump back to the top', st > 300, String(st));

// Ticking a tab: the actions bar shows right under the toolbar, and the cards start below it.
await f().evaluate(() => { document.getElementById('scroller').scrollTop = 0; });
await f().locator('#open-grid .card').first().locator('.pick').evaluate((b) => b.click()); await a.waitForTimeout(250);
const pos = await f().evaluate(() => { const acts = document.getElementById('acts').getBoundingClientRect(), tools = document.getElementById('tools').getBoundingClientRect(), body = document.getElementById('body').getBoundingClientRect(); return { actsTop: acts.top, actsBottom: acts.bottom, toolsBottom: tools.bottom, bodyTop: body.top, h: innerHeight }; });
T.log('the actions bar sits at the top, under the toolbar', pos.actsTop >= pos.toolsBottom - 2 && pos.actsTop < pos.h / 3, JSON.stringify(pos));
T.log('…and the cards start below it (it covers nothing)', pos.bodyTop >= pos.actsBottom, JSON.stringify(pos));

// "More" opens on a click and closes on a second click.
const more = f().locator('#acts-btns .qa.more');
await more.evaluate((b) => b.click()); await a.waitForTimeout(150);
const open1 = await f().$$eval('.menu', (x) => x.length);
await more.evaluate((b) => { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); }); await a.waitForTimeout(150);
T.log('"More" opens on a click and closes on the next one', open1 === 1 && (await f().$$eval('.menu', (x) => x.length)) === 0);
await f().locator('#sel-none').evaluate((b) => b.click()); await a.waitForTimeout(150);

// Settings (the gear) does the same.
const gear = f().locator('#settings-btn');
await gear.evaluate((b) => b.click()); await a.waitForTimeout(250);
const s1 = await f().$$eval('.pop.settings', (x) => x.length);
await gear.evaluate((b) => { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); }); await a.waitForTimeout(250);
T.log('Settings opens on a click and closes on the next one', s1 === 1 && (await f().$$eval('.pop.settings', (x) => x.length)) === 0);

// The duplicates button, pressed, keeps its icon visible (it used to be amber on amber).
await f().locator('#dupes-btn').evaluate((b) => b.click()); await a.waitForTimeout(250);
const col = await f().evaluate(() => { const b = document.getElementById('dupes-btn'); return { bg: getComputedStyle(b).backgroundColor, icon: getComputedStyle(b.querySelector('svg')).color, text: document.getElementById('dupes-text').textContent }; });
T.log('the pressed duplicates button shows its icon and text', col.icon !== col.bg && !!col.text, JSON.stringify(col));
await a.keyboard.press('Escape'); await a.waitForTimeout(200);
for (let i = 0; i < 2; i++) await a.keyboard.press('Escape');
await a.waitForTimeout(500);

await T.close();

// The Alt+Q-isn't-set note: says what still works, offers the fix, and "Not now" keeps it away.
// A copy of the extension where Chrome reports the shortcut as unassigned (headless can't unassign it).
const copy = path.join(S, 'ext-noshortcut');
fs.rmSync(copy, { recursive: true, force: true });
fs.cpSync(process.env.EXT, copy, { recursive: true });
const sw = path.join(copy, 'switcher.js');
const src = fs.readFileSync(sw, 'utf8');
if (!src.includes('(await chrome.commands.getAll())')) throw new Error('switcher.js changed: update this test');
fs.writeFileSync(sw, src.replace('(await chrome.commands.getAll())', "[{ name: 'open-switcher', shortcut: '' }]"));
const U = await launch(copy);
const [b] = await U.open(['alpha']);
await U.skipFirstRun();
await b.bringToFront(); await U.tap(b);
const g = () => U.frame(b);
await b.waitForTimeout(600);
const note = await g().evaluate(() => ({ shown: !document.getElementById('alert').hidden, text: document.getElementById('alert-text').textContent, fix: document.getElementById('alert-btn').textContent, later: document.getElementById('alert-later').hidden ? '' : document.getElementById('alert-later').textContent }));
U.log('the Alt+Q note says it still works on web pages, and offers the fix and "Not now"', note.shown && /still works on web pages/.test(note.text) && note.fix === 'Set it in Chrome' && note.later === 'Not now', JSON.stringify(note));
await g().locator('#alert-later').evaluate((x) => x.click()); await b.waitForTimeout(300);
U.log('"Not now" hides it', await g().evaluate(() => document.getElementById('alert').hidden));
for (let i = 0; i < 3; i++) await b.keyboard.press('Escape');
await b.waitForTimeout(500); await U.tap(b); await b.waitForTimeout(600);
U.log('…and it stays away on the next open', await g().evaluate(() => document.getElementById('alert').hidden));
await U.close();
