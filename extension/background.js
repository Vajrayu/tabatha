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

import { MSG, FRAME_MSG, LIMITS, SWITCHER_PAGE, WINDOW_STATES, CLOSE_REASONS } from './lib/constants.js';
import {
  touchMru, removeFromMru, replaceInMru, seedMru, getPreview,
  dropPreview, movePreview, setOverlayTab, clearOverlayTab, createLaunch,
} from './lib/store.js';
import { scheduleCapture, cancelCapture, captureWindow } from './lib/capture.js';
import { isOwnUrl } from './lib/ext.js';

// With use_dynamic_url this is a per-session random origin, so pages can't
// probe for the extension's permanent id.
const SWITCHER_URL = chrome.runtime.getURL(SWITCHER_PAGE);
// The origin extension frames actually run in (the real id). Used as the
// postMessage target so the launch token can only ever reach our own frame.
const EXT_REAL_ORIGIN = `chrome-extension://${chrome.runtime.id}`;
const INJECTABLE = /^(https?|file):/;

// ---------------------------------------------------------------- tab events
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  clearOverlayTab();
  let tab;
  try { tab = await chrome.tabs.get(tabId); } catch { return; }
  if (isOwnUrl(tab.url) || isOwnUrl(tab.pendingUrl)) return;
  touchMru(tabId);
  scheduleCapture(windowId);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) scheduleCapture(tab.windowId, 450);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  removeFromMru(tabId);
  dropPreview(tabId, { keepAsClosed: true });
});

chrome.tabs.onReplaced.addListener((addedId, removedId) => {
  replaceInMru(removedId, addedId);
  movePreview(removedId, addedId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab && !isOwnUrl(tab.url)) {
      touchMru(tab.id);
      scheduleCapture(windowId);
    }
  } catch {}
});

// ------------------------------------------------------------- setup (idempotent)
async function setup() {
  const active = await chrome.tabs.query({ active: true, windowType: 'normal' });
  await seedMru(active.map((t) => t.id));
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused) scheduleCapture(focused.windowId, 200);
}

chrome.runtime.onStartup.addListener(setup);
chrome.runtime.onInstalled.addListener(async () => {
  await setup();
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

function trigger(dir, tab) {
  // Both Chrome's shortcut and the in-page listener may see the same press;
  // this also rate-limits a misbehaving sender.
  if (Date.now() - lastTrigger < 120) return;
  lastTrigger = Date.now();
  openSwitcher(dir, tab).catch((e) => console.warn('[Tabatha] could not open the switcher:', e && e.message));
}

async function openSwitcher(dir, fromTab) {
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

  let tab = fromTab;
  if (!tab || !tab.active) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || tab.incognito) { opening = null; return; }

  let win = {};
  try { win = await chrome.windows.get(tab.windowId); } catch {}

  // 3. Refresh the current tab's screenshot before anything covers it.
  cancelCapture(tab.windowId);
  const prev = await getPreview(tab.id);
  if (!prev || prev.url !== tab.url || Date.now() - prev.t > 1500) {
    await Promise.race([
      captureWindow(tab.windowId, { force: true }).catch(() => {}),
      new Promise((r) => setTimeout(r, 900)),
    ]);
  }

  const ctx = {
    src: tab.id, win: tab.windowId, dir,
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
      await chrome.scripting.executeScript({ target: { tabId }, func: removeOverlay }).catch(() => {});
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
  const w = Math.round(Math.min(1180, W - 80));
  const h = Math.round(Math.min(780, H - 80));
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

// --------------------------------------------------------------- entry points
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'open-switcher') trigger(1, tab);
  else if (command === 'open-switcher-reverse') trigger(-1, tab);
});

chrome.action.onClicked.addListener((tab) => trigger(1, tab));

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
    case MSG.CLOSED:
      if (!fromSwitcher(sender)) return;
      disarmWatchdog();
      opening = null;
      clearOverlayTab();
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
