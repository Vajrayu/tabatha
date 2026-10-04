// "Capture all previews". Chrome only lets an extension screenshot the tab that is on screen, so the
// only way to preview a tab nobody has looked at is to show it for a moment. When the user asks, this
// visits each awake tab, captures it, and puts every window back on the tab it was showing.
//
// While it runs, normal tab-tracking is paused (isSweeping): the visits must not reorder the
// most-recently-used list, and the MRU is restored afterwards. Sleeping (discarded) tabs are skipped
// because showing them would reload them. Runs only on request; nothing here is automatic.

import { KEY, LIMITS, SWEEP_PAGE } from './constants.js';
import { getMru, setMru, getPreview } from './store.js';
import { captureTab } from './capture.js';

const S = chrome.storage.session;
const CAPTURABLE = /^https?:/;
let sweeping = false;
let cancelled = false;

export const isSweeping = () => sweeping;
export const cancelSweep = () => { cancelled = true; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = (p) => S.set({ [KEY.SWEEP]: p }).catch(() => {});

// Tabs worth visiting: awake, capturable, not the one each window already shows, no recent preview.
export async function sweepJobs() {
  const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
  const now = Date.now();
  const jobs = [];
  for (const w of wins) {
    if (w.state === 'minimized' || w.incognito) continue;
    for (const t of w.tabs || []) {
      if (t.active || t.discarded || !CAPTURABLE.test(t.url || '')) continue;
      const p = await getPreview(t.url).catch(() => null);
      if (p && now - p.t < LIMITS.SWEEP_STALE_MS) continue;
      jobs.push({ windowId: w.id, tabId: t.id, url: t.url });
    }
  }
  return jobs.slice(0, LIMITS.SWEEP_MAX_TABS);
}

async function waitLoaded(tabId) {
  const until = Date.now() + LIMITS.SWEEP_LOAD_MS;
  for (;;) {
    let t;
    try { t = await chrome.tabs.get(tabId); } catch { return null; }
    if (t.status === 'complete' || Date.now() > until) return t;
    await sleep(100);
  }
}

export async function runSweep() {
  if (sweeping) return;
  sweeping = true;
  cancelled = false;
  let win = null;
  const originals = new Map(); // windowId -> tab it was showing
  let focusedWin = null;
  const mruBefore = await getMru();
  try {
    const jobs = await sweepJobs();
    if (!jobs.length) { await progress({ running: false, done: 0, total: 0 }); return; }
    const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
    for (const w of wins) {
      const a = (w.tabs || []).find((t) => t.active);
      if (a) originals.set(w.id, a.id);
      if (w.focused) focusedWin = w.id;
    }
    await progress({ running: true, done: 0, total: jobs.length });
    try { win = await chrome.windows.create({ url: chrome.runtime.getURL(SWEEP_PAGE), type: 'popup', width: 420, height: 210, focused: false }); } catch {}

    let done = 0;
    for (const j of jobs) {
      if (cancelled) break;
      try {
        await chrome.tabs.update(j.tabId, { active: true });
        const tab = await waitLoaded(j.tabId);
        if (tab && CAPTURABLE.test(tab.url || '')) {
          await sleep(LIMITS.SWEEP_PAINT_MS);
          await captureTab(j.windowId, tab);
        }
      } catch { /* tab closed meanwhile */ }
      await progress({ running: true, done: ++done, total: jobs.length });
      await sleep(LIMITS.CAPTURE_GAP_MS); // Chrome allows about 2 captures a second
    }
  } finally {
    for (const [windowId, tabId] of originals) {
      try { await chrome.tabs.update(tabId, { active: true }); } catch {}
    }
    if (focusedWin !== null) { try { await chrome.windows.update(focusedWin, { focused: true }); } catch {} }
    if (win && win.id !== undefined) { try { await chrome.windows.remove(win.id); } catch {} }
    await setMru(mruBefore).catch(() => {});
    await progress({ running: false, done: 0, total: 0 });
    sweeping = false;
  }
}
