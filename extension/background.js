// Tabatha background service worker (ES module).
// Responsibilities:
//   1. Track tab usage order (MRU) and screenshots  -> lib/store.js, lib/capture.js
//   2. Open the switcher when the shortcut is pressed -> openSwitcher()
//   3. Put focus back where it belongs when the switcher closes
//
// Trust: messages can come from the content script on any page (untrusted
// page context, possibly a compromised renderer) or from our own switcher
// page. Every message is checked for sender and shape; content scripts can
// only ask "open the switcher", nothing else.
//
// Everything here must be safe to run more than once: the worker can be
// suspended and restarted at any moment, and install/reload re-runs setup.

import { MSG, KEY, FRAME_MSG, LIMITS, NUDGE, SWITCHER_PAGE, WINDOW_STATES, CLOSE_REASONS, uninstallUrl } from './lib/constants.js';
import {
  touchMru, removeFromMru, replaceInMru, seedMru, getPreview, cleanupPreviews, markBoot,
  markDiscarded, moveDiscarded, ensureBoot,
  rememberTab, rememberTabs, forgetTabMeta, logClosedTab, cleanupClosedLog,
  setOverlayTab, clearOverlayTab, createLaunch, getOnboard, updateOnboard,
  updateNudge, getReview, getPrefs, updatePrefs,
} from './lib/store.js';
import { dayOf } from './lib/review.js';
import { t, loadLang } from './lib/i18n.js';
import { syncGroups, hasGroupsApi } from './lib/groups.js';
import { runSweep, cancelSweep, isSweeping, sweepJobs } from './lib/sweep.js';
import { scheduleCapture, cancelCapture, captureWindow } from './lib/capture.js';
import { isOwnUrl } from './lib/ext.js';

// With use_dynamic_url this is a per-session random origin, so pages can't
// probe for the extension's permanent id.
const SWITCHER_URL = chrome.runtime.getURL(SWITCHER_PAGE);
// The origin extension frames actually run in (the real id). Used as the
// postMessage target so the launch token can only ever reach our own frame.
const EXT_REAL_ORIGIN = `chrome-extension://${chrome.runtime.id}`;
const INJECTABLE = /^(https?|file):/;

// Only extension pages may read storage: content scripts run inside web pages, and a compromised page
// renderer could otherwise read every stored screenshot through one. Tabatha's page-side code never
// uses storage. (storage.session is like this by default; older Chrome versions may refuse it for local.)
for (const area of [chrome.storage.local, chrome.storage.session]) {
  Promise.resolve().then(() => area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })).catch(() => {});
}
// First worker start of a browser session: remember when it began (see maybeCleanup in store.js).
ensureBoot().catch(() => {});
// After someone removes Tabatha, Chrome opens this page (one optional question). The URL carries
// only the version and the interface language; the removal itself sends nothing.
const setUninstall = () => loadLang().then(() => chrome.runtime.setUninstallURL(uninstallUrl())).catch(() => {});
setUninstall();
// The language setting changed: the uninstall page follows it.
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c[KEY.PREFS]) setUninstall(); });

// ---------------------------------------------------------- tab count on the toolbar icon
let badgeTimer = null;
function updateBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(async () => {
    try {
      const n = (await chrome.tabs.query({ windowType: 'normal' })).length;
      await chrome.action.setBadgeText({ text: n > 999 ? '999+' : String(n) });
    } catch {}
  }, 300);
}
Promise.resolve().then(() => chrome.action.setBadgeBackgroundColor({ color: '#1B2A4A' })).catch(() => {});
Promise.resolve().then(() => chrome.action.setBadgeTextColor({ color: '#D2FF3C' })).catch(() => {});
updateBadge();
// A worker that has just started is not sweeping: clear a "running" flag a dead worker left behind.
chrome.storage.session.get(KEY.SWEEP).then((o) => {
  if (o[KEY.SWEEP] && o[KEY.SWEEP].running && !isSweeping()) chrome.storage.session.set({ [KEY.SWEEP]: { running: false, done: 0, total: 0 } });
}).catch(() => {});

// ------------------------------------------------------------- saved tab groups
// Events are batched: closing a window fires dozens, and by the time the batch
// settles the group is gone, so its saved copy keeps the tabs it had (see lib/groups.js).
// Only runs once the user has switched on the optional tabGroups permission.
let groupTimer = null;
function groupsChanged() {
  if (!hasGroupsApi()) return;
  clearTimeout(groupTimer);
  groupTimer = setTimeout(() => syncGroups().catch(() => {}), LIMITS.GROUP_SYNC_MS);
}
let groupListeners = false;
function listenToGroups() {
  if (groupListeners || !hasGroupsApi()) return;
  groupListeners = true;
  for (const ev of ['onCreated', 'onUpdated', 'onRemoved', 'onMoved']) chrome.tabGroups[ev].addListener(groupsChanged);
}
listenToGroups(); // top level, so a worker woken by a group event is already listening
chrome.permissions.onAdded.addListener((p) => {
  if (p.permissions && p.permissions.includes('tabGroups')) { listenToGroups(); syncGroups().catch(() => {}); }
  // The user just allowed site access they had withheld ("On click" in chrome://extensions):
  // put the shortcut listener into the tabs that are already open, and take a first preview.
  if (p.origins && p.origins.length) {
    chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] }).then((tabs) => Promise.allSettled(tabs.map((t) =>
      chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['hotkey.js'] })))).catch(() => {});
    chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([t]) => t && scheduleCapture(t.windowId, 300)).catch(() => {});
  }
});

// ---------------------------------------------------------------- tab events
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (isSweeping()) return; // "Capture all previews" is visiting tabs: that is not the user's order of use
  clearOverlayTab();
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return; }
  if (isOwnUrl(tab.url) || isOwnUrl(tab.pendingUrl)) return;
  touchMru(tabId);
  scheduleCapture(windowId);
  watchCycling(tab);
});

chrome.tabs.onCreated.addListener((tab) => { rememberTab(tab).catch(() => {}); quietAt = Date.now(); updateBadge(); });

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.title || info.favIconUrl) rememberTab(tab).catch(() => {});
  // Chrome unloaded (or reloaded) this tab while we were running: that's a real "Sleeping" tab.
  if (typeof info.discarded === 'boolean') markDiscarded(tabId, info.discarded).catch(() => {});
  if (info.status === 'complete' && tab.active && !isSweeping()) {
    scheduleCapture(tab.windowId, 450);
    offerFlyout(tab);
  }
  if (info.groupId !== undefined || (tab.groupId >= 0 && (info.url || info.title))) groupsChanged();
});
chrome.tabs.onAttached.addListener(groupsChanged);
chrome.tabs.onDetached.addListener(groupsChanged);
chrome.windows.onRemoved.addListener((windowId) => { updateBadge(); steps.delete(windowId); });
chrome.tabs.onMoved.addListener(groupsChanged);

// Previews are keyed by URL, so a closed or replaced tab keeps its preview
// (it's what "Recently closed" shows); old ones expire in cleanupPreviews().
// Every closed tab goes into our own 7-day log, including tabs that close with
// their window (isWindowClosing): the switcher drops those from the list when
// Chrome still holds the whole window as one "Window" card.
chrome.tabs.onRemoved.addListener((tabId) => {
  quietAt = Date.now(); // Chrome now shows the closed tab's neighbour: not a Ctrl+Tab step
  updateBadge();
  removeFromMru(tabId);
  markDiscarded(tabId, false).catch(() => {});
  logClosedTab(tabId).catch(() => {});
  groupsChanged();
});

chrome.tabs.onReplaced.addListener((addedId, removedId) => {
  replaceInMru(removedId, addedId);
  forgetTabMeta(removedId).catch(() => {});
  moveDiscarded(removedId, addedId).catch(() => {});
  chrome.tabs.get(addedId).then((t) => rememberTab(t)).catch(() => {});
});

// ------------------------------------------------------------- the "use Alt+Q" nudge
// Chrome never tells extensions about Ctrl+Tab / Ctrl+PgDn. What it looks like from here: several
// switches in a row, each to the tab right next to the previous one, each within a moment. When
// that happens a second time in a day, a small note says Alt+Q shows every tab at once. Rare by
// design: once a day at most, three times ever, never soon after using Tabatha, never again once
// the habit is there (NUDGE in constants.js), and "Don't show again" ends it.
let quietAt = 0;   // a tab was just opened or closed, or Tabatha just switched: the next activation isn't the user cycling
const steps = new Map(); // windowId -> { index, t, n }
async function watchCycling(tab) {
  const now = Date.now();
  const prev = steps.get(tab.windowId);
  let n = 0;
  if (prev && now - prev.t < NUDGE.STEP_MS && now - quietAt > NUDGE.QUIET_AFTER_EVENT_MS && tab.index !== prev.index) {
    const d = Math.abs(tab.index - prev.index);
    let adjacent = d === 1;
    if (!adjacent && (tab.index === 0 || prev.index === 0)) { // Ctrl+Tab wraps from the last tab to the first
      const count = await chrome.tabs.query({ windowId: tab.windowId }).then((x) => x.length).catch(() => 0);
      adjacent = d === count - 1;
    }
    if (adjacent) n = prev.n + 1;
  }
  steps.set(tab.windowId, { index: tab.index, t: now, n });
  // A run: wait until the switching stops, then speak up on the tab the user landed on.
  if (n >= NUDGE.RUN_STEPS || (settleTimer && settleWin === tab.windowId)) {
    clearTimeout(settleTimer);
    settleWin = tab.windowId;
    settleTimer = setTimeout(async () => {
      settleTimer = null;
      const [t] = await chrome.tabs.query({ active: true, windowId: settleWin }).catch(() => []);
      if (t) onCyclingRun(t).catch(() => {});
    }, NUDGE.SETTLE_MS);
  }
}
let settleTimer = null, settleWin = null;
async function onCyclingRun(tab) {
  const now = Date.now();
  const today = dayOf(now);
  const nd = await updateNudge((x) => ({ ...x, day: today, runs: x.day === today ? x.runs + 1 : 1 }));
  if (nd.never || nd.shown >= NUDGE.MAX || now - nd.last < NUDGE.GAP_MS || nd.runs < NUDGE.RUNS_BEFORE) return;
  const [rv, onb, lo] = await Promise.all([getReview(), getOnboard(), chrome.storage.session.get(KEY.LAST_OPEN)]);
  if (rv.opens >= NUDGE.HABIT_OPENS) return updateNudge((x) => ({ ...x, never: true }));
  if (now - (lo[KEY.LAST_OPEN] || 0) < NUDGE.AFTER_USE_MS) return;
  if (onb.at && now - onb.at < LIMITS.FLYOUT_WINDOW_MS) return; // the first-run flyout is still doing this job
  if (!tab.active || !INJECTABLE.test(tab.url || '') || tab.incognito) return;
  const mac = await chrome.runtime.getPlatformInfo().then((p) => p.os === 'mac').catch(() => false);
  await loadLang();
  const key = mac ? 'Option+Q' : 'Alt+Q';
  const text = { title: t('nudgeTitle'), body: t('nudgeBody', key), tryIt: t('nudgeTry'), ok: t('nudgeOk'), never: t('nudgeNever'), close: t('dismiss') };
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: injectNudge, args: [MSG.NUDGE, NUDGE.SHOW_MS, text, key] });
  await updateNudge((x) => ({ ...x, shown: x.shown + 1, last: now }));
}

// Runs inside the page (isolated world), like the first-run flyout: closed shadow root, textContent only.
function injectNudge(type, showMs, text, key) {
  if (window.__tabathaNudge) return;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483646';
  const root = host.attachShadow({ mode: 'closed' });
  const css = `
    .c{font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B2A4A;background:#EBFFA6;width:300px;padding:14px 16px 12px;
       border:3px solid #1B2A4A;border-radius:4px;box-shadow:4px 4px 0 #1B2A4A;animation:in .25s steps(4) both}
    @keyframes in{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
    .t{font-weight:700;font-size:15px;margin:0 22px 6px 0}.p{margin:0 0 10px}
    kbd{font:inherit;font-weight:700;background:#FFD166;border:2px solid #1B2A4A;border-radius:3px;padding:1px 7px}
    .r{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .b{font:inherit;font-weight:700;font-size:13px;border:2px solid #1B2A4A;background:#FFF8E7;color:#1B2A4A;padding:4px 10px;cursor:pointer}
    .b.p1{background:#FFD166}.q{border:0;background:none;text-decoration:underline;padding:4px 2px;font-weight:400;opacity:.75}
    .x{position:absolute;top:6px;right:8px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#1B2A4A}`;
  try { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); root.adoptedStyleSheets = [sheet]; }
  catch { const style = document.createElement('style'); style.textContent = css; root.append(style); }
  const box = document.createElement('div'); box.className = 'c'; box.setAttribute('role', 'status');
  const h = document.createElement('p'); h.className = 't'; h.textContent = text.title;
  const p = document.createElement('p'); p.className = 'p';
  const [before, after] = text.body.split(key);
  const k = document.createElement('kbd'); k.textContent = key;
  p.append(before || '', k, after || '');
  const row = document.createElement('div'); row.className = 'r';
  const btn = (label, cls, act) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label;
    b.addEventListener('click', (e) => { if (!e.isTrusted) return; done(); chrome.runtime.sendMessage({ type, act }).catch(() => {}); });
    return b;
  };
  row.append(btn(text.tryIt, 'b p1', 'try'), btn(text.ok, 'b', 'ok'), btn(text.never, 'b q', 'never'));
  const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', text.close); x.textContent = '\u00d7';
  x.addEventListener('click', () => done());
  box.append(h, p, row, x); root.append(box);
  const timer = setTimeout(() => done(), showMs);
  function done() { clearTimeout(timer); host.remove(); delete window.__tabathaNudge; }
  window.__tabathaNudge = { host };
  (document.body || document.documentElement).append(host);
}

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE || isSweeping()) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab && !isOwnUrl(tab.url)) {
      touchMru(tab.id);
      scheduleCapture(windowId);
    }
  } catch {}
});

// ------------------------------------------------------------- setup (idempotent)
// If Chrome left the shortcut unassigned (another extension or app owns it, or a policy
// blocks it), say so in the worker console instead of failing silently.
async function checkShortcut() {
  try {
    const cmds = await chrome.commands.getAll();
    const main = cmds.find((c) => c.name === 'open-switcher');
    if (!main || !main.shortcut) console.warn('[Tabatha] The Alt+Q shortcut is not assigned. Set it at chrome://extensions/shortcuts (the in-page Alt+Q fallback still works on web pages).');
  } catch {}
}

async function setup({ fresh = false } = {}) {
  checkShortcut();
  // After an install/update every tab already exists, so it's safe to expire old previews now.
  // At browser start Chrome may still be restoring tabs (their previews must count as "in use"),
  // so there the cleanup is left to the save path, which waits a minute (maybeCleanup in store.js).
  if (fresh) cleanupPreviews().catch(() => {});
  cleanupClosedLog().catch(() => {}); // ...and the 7-day closed-tab log
  chrome.tabs.query({ windowType: 'normal' }).then(rememberTabs).catch(() => {}); // what each open tab is, for the log
  groupsChanged(); // saved tab groups (if switched on)
  const active = await chrome.tabs.query({ active: true, windowType: 'normal' });
  await seedMru(active.map((t) => t.id));
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused) scheduleCapture(focused.windowId, 200);
}

chrome.runtime.onStartup.addListener(async () => {
  await markBoot().catch(() => {}); // start of a browser session: tab ids and the "slept" list are new
  await setup();
  // Settings → "Open Tabatha when Chrome starts": once Chrome has put the tabs back, show them all.
  const prefs = await getPrefs().catch(() => ({ startup: false }));
  if (prefs.startup) setTimeout(() => trigger(1, null, 'startup'), LIMITS.STARTUP_OPEN_MS);
});
chrome.runtime.onInstalled.addListener(async (details) => {
  await setup({ fresh: true });
  if (details.reason === 'install') {
    await updateOnboard({ at: Date.now(), flyout: false, tour: false }).catch(() => {});
    // New installs open Tabatha when Chrome starts (Settings can turn it off). Updates keep whatever the user had.
    await updatePrefs({ startup: true }).catch(() => {});
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
    if (t) offerFlyout(t);
  }
  // Tabs that were open before install/reload don't have the content script
  // yet. hotkey.js guards itself, so injecting twice is harmless.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  await Promise.allSettled(tabs.map((t) =>
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['hotkey.js'] })));
});

// ------------------------------------------------------------ opening the switcher
let opening = null;   // { t, extra } while a switcher is loading (dedupes rapid presses)
let watchdog = null;  // { token, timer } for an overlay that hasn't reported READY yet
let lastTrigger = 0;

function trigger(dir, tab, via = 'key') {
  // Both Chrome's shortcut and the in-page listener may see the same press;
  // this also rate-limits a misbehaving sender.
  if (Date.now() - lastTrigger < 120) return;
  lastTrigger = Date.now();
  openSwitcher(dir, tab, via).catch((e) => {
    opening = null; // a failed open must not swallow the next presses for OPENING_LOCK_MS
    console.warn('[Tabatha] could not open the switcher:', e && e.message);
  });
}

async function openSwitcher(dir, fromTab, via = 'key') {
  // 1. Already open anywhere? Just move its selection.
  try {
    const r = await chrome.runtime.sendMessage({ type: MSG.CYCLE, dir });
    if (r && r.ok) return;
  } catch { /* no switcher open */ }

  // 2. Still loading from a press a moment ago? Queue the move for it.
  if (opening && Date.now() - opening.t < LIMITS.OPENING_LOCK_MS) {
    opening.extra += dir;
    return;
  }
  opening = { t: Date.now(), extra: 0 };
  chrome.storage.session.set({ [KEY.LAST_OPEN]: Date.now() }).catch(() => {});

  let tab = fromTab;
  if (!tab || !tab.active) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.incognito) { opening = null; return; }

  let win = {};
  try { win = await chrome.windows.get(tab.windowId); } catch {}

  // 3. Refresh the current tab's screenshot before anything covers it.
  cancelCapture(tab.windowId);
  const prev = await getPreview(tab.url);
  if (!prev || Date.now() - prev.t > 1500) {
    await Promise.race([
      captureWindow(tab.windowId, { force: true }).catch(() => {}),
      new Promise((r) => setTimeout(r, 900)),
    ]);
  }

  const ctx = {
    src: tab.id, win: tab.windowId, dir, via,
    state: WINDOW_STATES.includes(win.state) ? win.state : 'normal',
  };

  // 4. Show it inside the page; fall back to a popup window where extensions
  //    can't inject (chrome://, New Tab, Web Store) or the overlay fails.
  if (INJECTABLE.test(tab.url || '')) {
    try {
      const token = await createLaunch({ ...ctx, mode: 'overlay' });
      await setOverlayTab(tab.id);
      armWatchdog(token, tab.id, win, ctx); // before injecting: READY can arrive very quickly
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectOverlay,
        args: [SWITCHER_URL, token, EXT_REAL_ORIGIN, FRAME_MSG],
      });
      return;
    } catch {
      disarmWatchdog();
      await clearOverlayTab();
    }
  }
  await openPopupWindow(win, await createLaunch({ ...ctx, mode: 'window' }));
}

// Some pages block the overlay's scripts (e.g. a "Content-Security-Policy:
// sandbox" header) or never render it. If the switcher hasn't said READY in
// time, remove the overlay and use the popup window instead.
function armWatchdog(token, tabId, win, ctx) {
  disarmWatchdog();
  watchdog = {
    token,
    timer: setTimeout(async () => {
      if (!watchdog || watchdog.token !== token) return;
      watchdog = null;
      // Not awaited: a frozen page never answers, and waiting for it left Alt+Q and the toolbar icon doing
      // nothing until Chrome was restarted. The clean-up runs whenever the page comes back.
      chrome.scripting.executeScript({ target: { tabId }, func: removeOverlay }).catch(() => {});
      await clearOverlayTab();
      opening = null;
      await openPopupWindow(win, await createLaunch({ ...ctx, mode: 'window' })).catch(() => {});
    }, LIMITS.OVERLAY_WATCHDOG_MS),
  };
}

function disarmWatchdog() {
  if (watchdog) clearTimeout(watchdog.timer);
  watchdog = null;
}

async function openPopupWindow(win, token) {
  const url = SWITCHER_URL + '?t=' + token;
  const W = win.width || 1280, H = win.height || 800;
  const w = Math.round(Math.min(1440, W - 40)); // most of the window: room for the panel and several cards a row
  const h = Math.round(Math.min(900, H - 40));
  try {
    await chrome.windows.create({
      url, type: 'popup', focused: true, width: w, height: h,
      left: Math.round((win.left || 0) + (W - w) / 2),
      top: Math.round((win.top || 0) + (H - h) / 2),
    });
  } catch {
    // Bounds rejected (window partly off-screen, odd multi-monitor layout):
    // let Chrome place it.
    await chrome.windows.create({ url, type: 'popup', focused: true });
  }
}

// Runs *inside the web page* (content-script isolated world). Page scripts
// can't see these variables, but they CAN see and restyle the iframe element,
// so: the iframe URL carries nothing sensitive - the one-time launch token is handed
// to the frame with postMessage, addressed to the extension's own origin (if
// the page swaps the frame for something else, the token isn't delivered);
// and the switcher refuses clicks while it's hidden or covered.
// Re-running it replaces the previous overlay cleanly.
function injectOverlay(src, token, extOrigin, FRAME) {
  const prev = window.__tabathaOverlay;
  if (prev) prev.cleanup();

  const prevFocus = document.activeElement;
  // The blur sits on a separate element *behind* the iframe. Putting it on
  // the iframe itself would make Chrome report the frame as "not visible"
  // (a visual effect on an ancestor), which disables the switcher's
  // clickjacking guard.
  const base = [
    'all:initial', 'display:block', 'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
    'border:0', 'margin:0', 'padding:0', 'z-index:2147483647', 'opacity:0', 'pointer-events:none',
    'transition:opacity .12s ease',
  ];
  const shade = document.createElement('div');
  shade.style.cssText = [...base,
    'backdrop-filter:blur(18px) brightness(.45) saturate(1.2)',
    '-webkit-backdrop-filter:blur(18px) brightness(.45) saturate(1.2)',
  ].join(';');
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.setAttribute('allowtransparency', 'true');
  frame.setAttribute('allow', 'clipboard-write'); // "Copy links" (the page's own policy can still refuse; the switcher falls back)
  frame.setAttribute('aria-label', 'Tabatha tab switcher');
  // Invisible and click-through until the switcher reports it has rendered,
  // so a page that blocks it is never left covered by an empty frame.
  frame.style.cssText = [...base, 'background:transparent', 'color-scheme:normal'].join(';');

  const onMsg = (e) => {
    if (e.source !== frame.contentWindow || !e.data || typeof e.data.tabatha !== 'string') return;
    if (e.data.tabatha === FRAME.READY) {
      shade.style.opacity = '1';
      frame.style.opacity = '1';
      frame.style.pointerEvents = 'auto';
    } else if (e.data.tabatha === FRAME.CLOSE) {
      cleanup();
    }
  };
  const onVis = () => { if (document.hidden) cleanup(); };
  function cleanup() {
    window.removeEventListener('message', onMsg, true);
    document.removeEventListener('visibilitychange', onVis, true);
    frame.remove();
    shade.remove();
    if (window.__tabathaOverlay && window.__tabathaOverlay.frame === frame) delete window.__tabathaOverlay;
    try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch {}
  }

  window.addEventListener('message', onMsg, true);
  document.addEventListener('visibilitychange', onVis, true);
  frame.addEventListener('load', () => {
    frame.focus();
    try { frame.contentWindow.postMessage({ tabatha: FRAME.LAUNCH, token }, extOrigin); } catch {}
  });
  (document.body || document.documentElement).append(shade, frame);
  frame.focus();
  window.__tabathaOverlay = { frame, cleanup };
}

function removeOverlay() {
  if (window.__tabathaOverlay) window.__tabathaOverlay.cleanup();
}

// ------------------------------------------------------------ closing the switcher
// Windows treats Alt+Esc as "send this window to the back", so pressing Esc
// while still holding Alt made Chrome look minimised. After a cancel we put
// the window back in front (and un-minimise it if needed).
async function restoreWindow(windowId, state) {
  try {
    const w = await chrome.windows.get(windowId);
    if (w.state === 'minimized') {
      await chrome.windows.update(windowId, { state: WINDOW_STATES.includes(state) ? state : 'normal' });
    }
    await chrome.windows.update(windowId, { focused: true });
  } catch {}
}

// ------------------------------------------------------------ first-run flyout
// Right after a fresh install a small card on the page says "Press Alt+Q". Pages
// extensions can't touch (the Web Store, chrome://) can't show it, so it is offered
// again on the next ordinary page the user loads, for a short while. It goes away
// when dismissed, after 20 s, or as soon as the switcher has been opened once.
let flyoutOver = false; // once true it stays true for this worker: no storage read per page load
async function offerFlyout(tab) {
  try {
    if (flyoutOver || !tab || !INJECTABLE.test(tab.url || '') || tab.incognito) return;
    const o = await getOnboard();
    if (!o.at || o.flyout || o.tour || Date.now() - o.at > LIMITS.FLYOUT_WINDOW_MS) { if (o.at) flyoutOver = true; return; }
    await loadLang();
    await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: injectFlyout,
      args: [MSG.FLYOUT_DONE, LIMITS.FLYOUT_SHOW_MS, { title: t('flyoutTitle'), body: t('flyoutBody', '$KEY$'), sub: t('flyoutSub'), close: t('dismiss') }],
    });
  } catch {}
}

// Runs inside the page (isolated world). A closed shadow root keeps the page's CSS out and
// its scripts away from our nodes; text is set with textContent only.
function injectFlyout(doneType, showMs, text) {
  if (window.__tabathaFlyout) return;
  const mac = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;top:16px;right:16px;z-index:2147483646';
  const root = host.attachShadow({ mode: 'closed' });
  const css = `
    .c{font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1B2A4A;background:#FFF8E7;width:280px;padding:14px 16px 14px;
       border:3px solid #1B2A4A;border-radius:4px;box-shadow:4px 4px 0 #1B2A4A;animation:in .25s steps(4) both}
    @keyframes in{from{transform:translateY(-10px);opacity:0}to{transform:none;opacity:1}}
    .t{font-weight:700;font-size:15px;margin:0 22px 6px 0}.p{margin:0 0 10px}
    kbd{font:inherit;font-weight:700;background:#FFD166;border:2px solid #1B2A4A;border-radius:3px;padding:1px 7px}
    .s{font-size:12px;opacity:.75;margin:0}
    button{position:absolute;top:6px;right:8px;border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:#1B2A4A}`;
  // A constructable stylesheet is not blocked by a page's Content-Security-Policy (an inline <style> can be).
  try { const sheet = new CSSStyleSheet(); sheet.replaceSync(css); root.adoptedStyleSheets = [sheet]; }
  catch { const style = document.createElement('style'); style.textContent = css; root.append(style); }
  const box = document.createElement('div'); box.className = 'c'; box.setAttribute('role', 'status');
  const t = document.createElement('p'); t.className = 't'; t.textContent = text.title;
  const p = document.createElement('p'); p.className = 'p';
  const k = document.createElement('kbd'); k.textContent = mac ? 'Option+Q' : 'Alt+Q';
  const [before, after] = text.body.split('$KEY$');
  p.append(before || '', k, after || '');
  const s = document.createElement('p'); s.className = 's'; s.textContent = text.sub;
  const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', text.close); x.textContent = '\u00d7';
  box.append(t, p, s, x); root.append(box);
  const done = () => {
    clearTimeout(timer); host.remove(); delete window.__tabathaFlyout;
    chrome.runtime.sendMessage({ type: doneType }).catch(() => {});
  };
  x.addEventListener('click', done);
  const timer = setTimeout(() => { host.remove(); delete window.__tabathaFlyout; }, showMs); // left alone: offered again on the next page
  window.__tabathaFlyout = { host };
  (document.body || document.documentElement).append(host);
}

// --------------------------------------------------------------- entry points
// MV3 note: this worker is not persistent; Chrome stops it when idle and starts it again for
// an event. Keep every listener registered at the top level, synchronously (nothing awaited
// before it), or the event that woke the worker can be missed. If a user reports "Alt+Q
// does nothing until I click the toolbar icon": (1) is the shortcut assigned? (checkShortcut
// logs a warning, and chrome://extensions/shortcuts shows it); (2) managed browsers can
// restrict extension shortcuts by policy; (3) hotkey.js is the fallback and retries once
// (see send() there). A keep-alive alarm would need the `alarms` permission: last resort.
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-switcher') trigger(1, tab);
  else if (command === 'open-switcher-reverse') trigger(-1, tab);
});

chrome.action.onClicked.addListener((tab) => trigger(1, tab, 'icon'));

async function captureOne(tabId, reopenTab) {
  const n = await runSweep({ only: [tabId], force: true, quiet: true });
  await reopenOver(reopenTab);
  return { ok: n > 0 };
}
// Open the switcher again over a tab (after Tabatha had to step aside to take screenshots).
async function reopenOver(tabId) {
  if (tabId === null) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    opening = null;
    await openSwitcher(1, tab);
  } catch {}
}

const fromContentScript = (s) => !!s.tab && Number.isInteger(s.tab.id) && !isOwnUrl(s.url);
const fromSwitcher = (s) => isOwnUrl(s.url, SWITCHER_PAGE);

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
  switch (msg.type) {
    case MSG.HOTKEY:
      // The only thing a page's content script may ask for.
      if (fromContentScript(sender)) trigger(msg.dir === -1 ? -1 : 1, sender.tab);
      return;
    case MSG.READY:
      if (!fromSwitcher(sender)) return;
      disarmWatchdog();
      respond({ extra: opening ? Math.max(-20, Math.min(20, opening.extra)) : 0 });
      opening = null;
      return;
    case MSG.SWEEP: {
      // Answer first (how many tabs need a picture), so the switcher can say "nothing to capture"
      // instead of closing for nothing; then run, and open the switcher again over the tab it came from.
      if (!fromSwitcher(sender)) return;
      const only = Array.isArray(msg.tabIds) ? msg.tabIds.filter(Number.isInteger).slice(0, LIMITS.SWEEP_MAX_TABS) : null;
      sweepJobs({ only }).then((jobs) => {
        respond({ n: jobs.length });
        if (!jobs.length) return;
        setTimeout(() => runSweep({ only })
          .then(() => reopenOver(Number.isInteger(msg.reopen) ? msg.reopen : null))
          .catch((e) => console.warn('[Tabatha] preview sweep failed:', e && e.message)), 150);
      }, () => respond({ n: 0 }));
      return true;
    }
    case MSG.SLEEP: {
      // Tabs the user put to sleep in the switcher: unloaded once it has closed, so the switcher stays smooth.
      if (!fromSwitcher(sender) || !Array.isArray(msg.tabIds)) return;
      const ids = msg.tabIds.filter(Number.isInteger).slice(0, 500);
      setTimeout(async () => {
        for (const id of ids) {
          try { const t = await chrome.tabs.get(id); if (!t.active && !t.discarded) await chrome.tabs.discard(id); } catch {}
        }
      }, 400);
      return;
    }
    case MSG.TO_WINDOW: {
      // The page hides or covers the overlay: open Tabatha as its own window for the same tab and window.
      if (!fromSwitcher(sender) || !Number.isInteger(msg.src) || !Number.isInteger(msg.win)) return;
      disarmWatchdog();
      opening = null;
      clearOverlayTab();
      const ctx = { src: msg.src, win: msg.win, dir: msg.dir === -1 ? -1 : 1, via: 'key', state: WINDOW_STATES.includes(msg.state) ? msg.state : 'normal' };
      (async () => {
        const w = await chrome.windows.get(msg.win).catch(() => ({}));
        await openPopupWindow(w, await createLaunch({ ...ctx, mode: 'window' }));
      })().catch(() => {});
      return;
    }
    case MSG.CLOSE_HERE: {
      // The switcher's own tab is being closed: close the tabs, show the tab next to it, open Tabatha there.
      if (!fromSwitcher(sender) || !Array.isArray(msg.tabIds)) return;
      const ids = msg.tabIds.filter(Number.isInteger).slice(0, 500);
      const next = Number.isInteger(msg.next) && !ids.includes(msg.next) ? msg.next : null;
      (async () => {
        if (next !== null) await chrome.tabs.update(next, { active: true }).catch(() => {});
        await chrome.tabs.remove(ids).catch(() => {});
        if (next !== null) await reopenOver(next);
      })().catch(() => {});
      return;
    }
    case MSG.CAPTURE_ONE:
      // One card's "Capture preview". If the tab is in the window the overlay sits in, showing it
      // closes the overlay; `reopen` then brings the switcher back over the original tab.
      if (!fromSwitcher(sender) || !Number.isInteger(msg.tabId)) return;
      captureOne(msg.tabId, Number.isInteger(msg.reopen) ? msg.reopen : null).then(respond, () => respond({ ok: false }));
      return true;
    case MSG.SWEEP_CANCEL:
      if (isOwnUrl(sender.url, 'sweep.html')) cancelSweep();
      return;
    case MSG.GROUPS:
      if (fromSwitcher(sender)) syncGroups().catch(() => {});
      return;
    case MSG.FLYOUT_DONE:
      if (fromContentScript(sender)) updateOnboard({ flyout: true }).catch(() => {});
      return;
    case MSG.NUDGE:
      if (!fromContentScript(sender)) return;
      if (msg.act === 'try') trigger(1, sender.tab);
      else if (msg.act === 'never') updateNudge((x) => ({ ...x, never: true })).catch(() => {});
      return;
    case MSG.CLOSED:
      if (!fromSwitcher(sender)) return;
      disarmWatchdog();
      opening = null;
      clearOverlayTab();
      quietAt = Date.now(); // the switch Tabatha just made isn't the user cycling with Ctrl+Tab
      if (msg.reason === 'cancel' && Number.isInteger(msg.win)) {
        const state = WINDOW_STATES.includes(msg.state) ? msg.state : 'normal';
        restoreWindow(msg.win, state);
        setTimeout(() => restoreWindow(msg.win, state), 250); // after the OS acts on Alt+Esc
      } else if (!CLOSE_REASONS.includes(msg.reason)) {
        console.warn('[Tabatha] unexpected close reason');
      }
      return;
  }
});
