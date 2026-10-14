// 1.3.5 (part D): one walkthrough, built from the current interface. An update from V shows only the steps newer
// than V, marked New / Moved / Changed, then "Also fixed since you last looked" (at most 6 lines + "and N more").
// Several updates before Tabatha is opened keep the oldest version they came from. A step whose when() is false
// or whose target is missing is skipped; it shows once; "How it works" replays everything with no marks; it comes
// before (never on top of) the review question.
// (Chrome's real update event can't be produced here: in this harness the unpacked extension never comes back after
// chrome.runtime.reload(). The test calls the function onInstalled calls, from one of Tabatha's own pages.)
import { launch } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const real = JSON.parse(fs.readFileSync(path.join(process.env.EXT, 'manifest.json'), 'utf8')).version;
const T = await launch(process.env.EXT);
const sw = T.sw;
const ev = (fn, arg) => sw.evaluate(fn, arg);
const [a] = await T.open(['alpha', 'beta']);
await ev(() => chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: true } }));
// Updates arrive while Tabatha is never opened: from 1.3.3, then from 1.3.4.
const own = await T.ctx.newPage();
await own.goto(await ev(() => chrome.runtime.getURL('sweep.html')));
const noteFrom = (v) => own.evaluate(async (v) => { const m = await import(chrome.runtime.getURL('lib/store.js')); await m.noteUpdatedFrom(v); return (await chrome.storage.local.get('wnFrom')).wnFrom; }, v);
const from1 = await noteFrom('1.3.3');
const from2 = await noteFrom('1.3.4');
await own.close();
T.log('an update records the version it came from', from1 === '1.3.3', String(from1));
T.log('two updates before opening keep the oldest (1.3.3)', from2 === '1.3.3', String(from2));
// Previews are there for this user (the capture card has its own test), and a second window exists.
await ev((v) => chrome.storage.local.get('onb').then((o) => chrome.storage.local.set({ onb: { ...o.onb, cap: v } })), real);
await ev(async (u) => { await chrome.windows.create({ url: u, focused: false }); }, T.url('gamma'));
await a.waitForTimeout(800);

const f = () => T.frame(a);
// A frame that goes away mid-call can leave evaluate() waiting forever: give up after a moment.
const within = (p, ms = 3000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
// Opens Tabatha and pages through the walkthrough with →, collecting each step's title, mark and list.
async function walk(open = true) {
  if (open) { await T.tap(a); await a.waitForTimeout(700); }
  const steps = [];
  for (let i = 0; i < 14; i++) {
    const fr = f();
    const s = !fr ? null : await within(fr.evaluate(() => {
      if (document.getElementById('modal').hidden) return null;
      const h = document.getElementById('dlg-title'); const m = h.querySelector('.mark');
      const of = document.querySelector('#dialog .stepof');
      return { title: [...h.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''), mark: m ? m.textContent : '', items: [...document.querySelectorAll('#dialog .news li')].map((x) => x.textContent), of: of ? of.textContent : '' };
    }).catch(() => null));
    if (!s) break;
    steps.push(s);
    if (!s.of || /^(\d+) \/ \1$/.test(s.of)) break;
    await a.keyboard.press('ArrowRight'); await a.waitForTimeout(150);
  }
  return steps;
}
const show = (steps) => steps.map((s) => s.title + (s.mark ? ` [${s.mark}]` : '')).join(' · ');
const done = async () => { await a.keyboard.press('Escape'); await a.waitForTimeout(300); };

// 1.3.3 → now
let steps = await walk();
T.log('1.3.3 → 1.3.5: Group by (new), window list (changed), actions bar (moved), panel tabs (changed), then the fixes',
  show(steps) === 'Sort and group [New] · Your windows [Changed] · Many at once [Moved] · Groups and bookmarks [Changed] · Also fixed since you last looked', show(steps));
const fixes = steps.length ? steps[steps.length - 1].items : [];
T.log('…the fixes card lists 1.3.5 then 1.3.4: six lines and "and 1 more"', fixes.length === 7 && fixes[0].startsWith('On dark-mode pages') && fixes[3].startsWith('Closing the tab') && fixes[6] === 'and 1 more', fixes.join(' | '));
await done();
T.log('Esc ends it, Tabatha stays open', (await T.isOpen(a)) && (await f().evaluate(() => document.getElementById('modal').hidden)));
T.log('…and the update counts as seen', !(await ev(() => chrome.storage.local.get('wnFrom').then((o) => o.wnFrom))));
await a.keyboard.press('Escape'); await a.waitForTimeout(400);
steps = await walk();
T.log('shown once: the next open has no walkthrough', steps.length === 0, show(steps));
await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// 1.3.4 → now
await ev(() => chrome.storage.local.set({ wnFrom: '1.3.4' }));
steps = await walk();
T.log('1.3.4 → 1.3.5: the same minus the actions bar, and only 1.3.5\'s fixes',
  show(steps) === 'Sort and group [New] · Your windows [Changed] · Groups and bookmarks [Changed] · Also fixed since you last looked' && steps[3].items.length === 3, show(steps) + ' / ' + (steps[3] ? steps[3].items.join(' | ') : ''));
// The last step's Done (Enter on the focused button) also ends it.
await a.keyboard.press('Enter'); await a.waitForTimeout(300);
T.log('Done on the last card ends it and marks it seen', (await f().evaluate(() => document.getElementById('modal').hidden)) && !(await ev(() => chrome.storage.local.get('wnFrom').then((o) => o.wnFrom))));
await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// Replay: everything, no marks; a step whose target is gone is skipped.
await T.tap(a); await a.waitForTimeout(500);
await f().evaluate(() => document.getElementById('tour-btn').click()); await a.waitForTimeout(300);
steps = await walk(false);
T.log('"How it works" shows the full current walkthrough, without marks',
  /^Press (Alt|Option)\+Q · Move · Search · Sort and group · Your windows · Many at once · Groups and bookmarks · Settings · Anything off\?$/.test(show(steps)), show(steps));
await done();
await f().evaluate(() => { document.getElementById('group-by').style.display = 'none'; document.getElementById('tour-btn').click(); }); await a.waitForTimeout(300);
steps = await walk(false);
T.log('a step whose target isn\'t on screen is skipped', steps.length > 3 && !steps.some((s) => s.title === 'Sort and group'), show(steps));
await done();
await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// One window: the window step's when() is false.
await ev(async () => { const ws = await chrome.windows.getAll(); for (const w of ws.slice(1)) await chrome.windows.remove(w.id); });
await ev(() => chrome.storage.local.set({ wnFrom: '1.3.4' }));
await a.waitForTimeout(500);
steps = await walk();
T.log('with one window the window step is left out', show(steps) === 'Sort and group [New] · Groups and bookmarks [Changed] · Also fixed since you last looked', show(steps));
await done(); await a.keyboard.press('Escape'); await a.waitForTimeout(400);

// The review question would be due: the walkthrough comes first, the question waits for a later open.
await ev(() => chrome.storage.local.set({ wnFrom: '1.3.4', rv: { since: 1, opens: 100, soft: 0, lastSoft: 0, asks: 0, lastAsk: 0, done: false, day: '' } }));
// (`day` is set to today by the first open, so the second open is not "the first of the day")
steps = await walk();
const rv = await ev(() => chrome.storage.local.get('rv').then((o) => o.rv));
T.log('the walkthrough comes before the review question (not both, not on top)', steps[0] && steps[0].title === 'Sort and group' && rv.asks === 0, JSON.stringify({ first: steps[0] && steps[0].title, asks: rv.asks }));
await done(); await a.keyboard.press('Escape'); await a.waitForTimeout(400);
await T.tap(a); await a.waitForTimeout(800);
const ask = await f().evaluate(() => !document.getElementById('modal').hidden && document.getElementById('dlg-title').textContent);
T.log('…the question comes on a later open', /How is Tabatha working for you/.test(String(ask)), String(ask));
await T.close();
