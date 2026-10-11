// The "use Alt+Q" nudge: quick next-tab switches (what Ctrl+Tab looks like from an extension) twice in a
// day show one small note; not the first time, not again the same day, not soon after using Tabatha,
// and never again after "Don't show again".
import { launch } from './lib.mjs';
const T = await launch(process.env.EXT);
const ev = (fn, arg) => T.sw.evaluate(fn, arg);
await T.open(['alpha', 'beta', 'gamma', 't1', 't2']);
await T.skipFirstRun(); // onb.at is long ago: the first-run flyout window is over
// Ctrl+Tab four times: each switch goes to the tab right next to the last one, quickly.
const cycle = () => ev(async () => {
  const [w] = await chrome.windows.getAll({ populate: true });
  const tabs = w.tabs.sort((a, b) => a.index - b.index);
  for (let i = 0; i < 5; i++) { await chrome.tabs.update(tabs[i % tabs.length].id, { active: true }); await new Promise((r) => setTimeout(r, 250)); }
  return tabs[4 % tabs.length].id;
});
const shown = (tabId) => ev(async (id) => (await chrome.scripting.executeScript({ target: { tabId: id }, func: () => !!window.__tabathaNudge }))[0].result, tabId);
const nd = () => ev(() => chrome.storage.local.get('nudge').then((o) => o.nudge || {}));
const pause = () => ev(() => new Promise((r) => setTimeout(r, 2200)));

let tab = await cycle(); await pause();
T.log('the first run of the day shows nothing', !(await shown(tab)) && (await nd()).runs === 1, JSON.stringify(await nd()));
tab = await cycle(); await pause();
T.log('the second run shows the note', await shown(tab), JSON.stringify(await nd()));
T.log('…and counts it', (await nd()).shown === 1);
await ev((id) => chrome.scripting.executeScript({ target: { tabId: id }, func: () => window.__tabathaNudge && window.__tabathaNudge.host.remove() }), tab);
await ev((id) => chrome.scripting.executeScript({ target: { tabId: id }, func: () => { delete window.__tabathaNudge; } }), tab);
tab = await cycle(); await pause();
T.log('not again the same day', !(await shown(tab)));

// A day later, but Tabatha was just used: still quiet.
await ev(() => chrome.storage.local.get('nudge').then((o) => chrome.storage.local.set({ nudge: { ...o.nudge, last: Date.now() - 2 * 86400000, runs: 5 } })));
await ev(() => chrome.storage.session.set({ lastOpen: Date.now() }));
tab = await cycle(); await pause();
T.log('quiet within 10 minutes of opening Tabatha', !(await shown(tab)));

// "Don't show again" (sent from the page, as the note's button does) ends it for good.
await ev(() => chrome.storage.session.set({ lastOpen: 0 }));
await ev((id) => chrome.scripting.executeScript({ target: { tabId: id }, func: () => chrome.runtime.sendMessage({ type: 'tabatha:nudge', act: 'never' }) }), tab);
await pause();
T.log('"Don’t show again" is remembered', (await nd()).never === true);
tab = await cycle(); await pause();
T.log('…and nothing shows after it', !(await shown(tab)));
await T.close();
