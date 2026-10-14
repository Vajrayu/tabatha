// 1.3.5 (part C): the capture card changes with the tab count (the table in the plan), with real tabs: 5, 20 in one
// window, 30, 80, 180 and 500 (in two windows). The time is about 0.6 s a tab, rounded to something human. Above
// 100 tabs the default is "Your 50 most recent", which runs only those 50; Stop ends early and Tabatha says how
// many it got. The card also reads right in Russian and Spanish. The heading counts ALL open tabs and windows (read live
// from Chrome here), while the tier, time and buttons follow N, the tabs needing a preview; "N of them have no preview yet."
// shows only when N is smaller than the total.
import { launch } from './lib.mjs';

const T = await launch(process.env.EXT, { viewport: { width: 1440, height: 900 } });
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
const [a] = await T.open(['alpha']);
const f = () => T.frame(a);
const w1 = await ev(async () => (await chrome.tabs.query({ title: 'alpha page' }))[0].windowId);
let w2 = null;
const add = (n, win) => ev(async ({ n, win, port }) => {
  const names = ['beta', 'gamma', 'delta', 't1', 't2', 't3'];
  const base = (await chrome.tabs.query({})).length;
  await Promise.all(Array.from({ length: n }, (_, i) => chrome.tabs.create({ url: `http://localhost:${port}/${names[i % 6]}.html?n=${base + i}`, active: false, windowId: win })));
  for (const x of await chrome.tabs.query({})) chrome.tabs.update(x.id, { autoDiscardable: false }).catch(() => {});
}, { n, win, port: T.port });
const fresh = () => ev(async () => {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('pv:') || k === 'pvidx'));
  await chrome.storage.local.set({ onb: { at: 1, flyout: true, tour: false, cap: '' } });
});
const lang = (l) => ev((l) => chrome.storage.local.get('prefs').then((o) => chrome.storage.local.set({ prefs: { ...(o.prefs || {}), lang: l } })), l);
const t0 = Date.now(); const dbg = (x) => { if (process.env.DBG) console.log('  ..', ((Date.now() - t0) / 1000).toFixed(1), x); };
const within = (p, ms = 4000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
// Opens Tabatha as a new install would and reads the card; leaves it open.
async function card() {
  dbg('fresh'); await fresh(); dbg('front');
  await a.bringToFront(); await a.waitForTimeout(300);
  dbg('tap'); await T.tap(a); dbg('read');
  for (let i = 0; i < 40; i++) { const c = await within(T.capCard(a).catch(() => null)); if (c) return c; await a.waitForTimeout(150); }
  return null;
}
const closeAll = async () => { dbg('close'); for (let i = 0; i < 3; i++) { await a.keyboard.press('Escape'); await a.waitForTimeout(250); } await a.waitForTimeout(400); };
// Tabs and windows Chrome has right now (normal windows): what the heading must count.
const live = () => ev(async () => { const ts = await chrome.tabs.query({ windowType: 'normal' }); return { total: ts.length, wins: new Set(ts.map((x) => x.windowId)).size }; });
// head(total, wins) builds the expected heading; `n` is how many tabs need a preview (the tier), and the extra line is
// expected exactly when n < total.
async function check(name, c, head, n, text, buttons, line = (k) => `${k} of them have no preview yet.`) {
  const { total, wins } = await live();
  const h = head(total, wins);
  const extra = line(n);
  const ok = !!c && c.text.startsWith(h) && text.every((x) => c.text.includes(x)) && JSON.stringify(c.buttons) === JSON.stringify(buttons)
    && (n < total ? c.text.includes(extra) && c.text.indexOf(extra) > c.text.indexOf(h) && c.text.indexOf(extra) < c.text.indexOf(text[text.length - 1]) // the line sits between the heading and the body
      : !/ of them have no preview| из них пока нет|de ellas no tien/.test(c.text));
  T.log(name, ok, c ? `[${total} tabs, ${wins} windows, N=${n}] ` + c.text + ' / ' + JSON.stringify(c.buttons) : 'no card');
}

await add(5, w1); await a.waitForTimeout(1500);
let c = await card();
await check('5 tabs need one (6 open): heading counts all 6 · about 5 seconds · Capture them · Later', c, (k) => `You have ${k} tabs open.`, 5,
  ['Give me about 5 seconds and they’ll all have previews.'], ['Capture them', 'Later']);
await closeAll();

await add(15, w1); await a.waitForTimeout(1500);
c = await card();
await check('20 need one (21 open, one window): no window part in the heading', c, (k) => `You have ${k} tabs open.`, 20,
  ['About 15 seconds to get a preview for each. I’ll flip through them once; hands off Chrome meanwhile.'], ['Capture all', 'Later']);
await closeAll();

w2 = await ev(async (u) => (await chrome.windows.create({ url: u, focused: false })).id, T.url('beta'));
await add(10, w2); await a.waitForTimeout(1500);
c = await card();
await check('30 need one (32 open in 2 windows): "You have 32 tabs open in 2 windows." · about 20 seconds · Capture all · Later', c, (k, w) => `You have ${k} tabs open in ${w} windows.`, 30,
  ['About 20 seconds to get a preview for each. I’ll flip through them once; hands off Chrome meanwhile.'], ['Capture all', 'Later']);
await closeAll();
await lang('ru');
c = await card();
await check('…in Russian', c, (k, w) => `У вас открыто ${k} вкладки в ${w} окнах.`, 30, ['Примерно 20 секунд'], ['Сделать все', 'Позже'], (k) => `У ${k} из них пока нет превью.`);
await closeAll();
await lang('es');
c = await card();
await check('…in Spanish', c, (k, w) => `Tienes ${k} pestañas abiertas en ${w} ventanas.`, 30, ['Cerca de 20 segundos'], ['Capturar todas', 'Más tarde'], (k) => `${k} de ellas no tienen vista previa todavía.`);
await closeAll();
await lang('en');

await add(50, w2); await a.waitForTimeout(2500);
c = await card();
await check('80 need one (82 open): "82 tabs in 2 windows. A healthy collection." · about 50 seconds · Capture all · ~50 s · Just this window (20) · Later', c, (k, w) => `${k} tabs in ${w} windows. A healthy collection.`, 80,
  ['About 50 seconds of flipping, and you can stop any time.'], ['Capture all · ~50 s', 'Just this window (20)', 'Later']);
await closeAll();

await add(33, w1); await add(67, w2); await a.waitForTimeout(4000);
c = await card();
await check('180 need one (182 open): "182 tabs. Respect." · about 2 minutes · Your 50 most recent · ~30 s · All 180 · ~2 min · Later', c, (k) => `${k} tabs. Respect.`, 180,
  ['All of them takes about 2 minutes. I’d start with the 50 you used last; the rest get previews as you visit them.'], ['Your 50 most recent · ~30 s', 'All 180 · ~2 min', 'Later']);
await closeAll();

await add(107, w1); await add(213, w2); await a.waitForTimeout(8000);
c = await card();
await check('500 need one (502 open): "502 tabs. I’ve seen browsers give up for less." · about 5 minutes · Your 50 most recent · All 500 · ~5 min · Later', c, (k) => `${k} tabs. I’ve seen browsers give up for less.`, 500,
  ['All of them would take about 5 minutes. Let’s start with the 50 you used last; the others fill in as you go.'], ['Your 50 most recent · ~30 s', 'All 500 · ~5 min', 'Later']);

// "Your 50 most recent" (the default): only those 50 run; Stop ends early; Tabatha says how many.
await a.keyboard.press('Enter');
let total = 0;
for (let i = 0; i < 40 && !total; i++) { await a.waitForTimeout(150); total = (await ev(() => chrome.storage.session.get('sweep').then((o) => (o.sweep && o.sweep.running ? o.sweep.total : 0)))) || 0; }
T.log('"Your 50 most recent" runs exactly 50 tabs (no 100 cap, no more than chosen)', total === 50, String(total));
await a.waitForTimeout(2500);
const pop = T.ctx.pages().find((p) => p.url().includes('sweep.html'));
if (pop) await pop.evaluate(() => document.getElementById('cancel').click()).catch(() => {});
let back = false;
for (let i = 0; i < 100 && !back; i++) { await a.waitForTimeout(200); back = (await T.isOpen(a)) && !!T.frame(a); }
await a.waitForTimeout(500);
const toast = back ? await within(f().evaluate(() => document.getElementById('toast').textContent)) : null;
const m = /^Done: (\d+) previews?\.$/.exec(String(toast));
T.log('Stop ends early; Tabatha reopens with "Done: N previews."', !!m && +m[1] > 0 && +m[1] < 50, String(toast));
T.log('…then the walkthrough', /^Press (Alt|Option)\+Q/.test(String(await within(f().evaluate(() => document.getElementById('dlg-title') && document.getElementById('dlg-title').textContent))).trim()));
await T.close();
