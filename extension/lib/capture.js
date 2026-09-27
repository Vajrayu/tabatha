// Thumbnail capture. Chrome can only screenshot the *visible* tab of a
// window, so we grab one whenever a tab becomes visible or finishes loading.
// Tabs never shown since the browser started have no preview ("inactive").
// Images never leave the device: they go straight into storage.session.

import { LIMITS, PREVIEW_PREFIX } from './constants.js';
import { savePreview, isOverlayTab } from './store.js';
import { isOwnUrl } from './ext.js';

let lastCaptureAt = 0;
const timers = new Map(); // windowId -> timeout id (debounce per window)

export function scheduleCapture(windowId, delay = 350) {
  cancelCapture(windowId);
  timers.set(windowId, setTimeout(() => {
    timers.delete(windowId);
    captureWindow(windowId).catch(() => {});
  }, delay));
}

export function cancelCapture(windowId) {
  clearTimeout(timers.get(windowId));
  timers.delete(windowId);
}

// `force` waits out the rate limit instead of rescheduling (used right
// before opening the switcher so the current tab's preview is fresh).
export async function captureWindow(windowId, { force = false } = {}) {
  const wait = lastCaptureAt + LIMITS.CAPTURE_GAP_MS - Date.now();
  if (wait > 0) {
    if (!force) return scheduleCapture(windowId, wait + 10);
    await new Promise((r) => setTimeout(r, wait + 10));
  }

  let tab, win;
  try {
    [tab] = await chrome.tabs.query({ active: true, windowId });
    win = await chrome.windows.get(windowId);
  } catch {
    return; // window closed meanwhile
  }
  if (!tab || !tab.url || isOwnUrl(tab.url)) return;
  if (win.type !== 'normal' || win.state === 'minimized' || win.incognito) return;
  if (await isOverlayTab(tab.id)) return; // never photograph our own overlay

  lastCaptureAt = Date.now();
  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 80 });
  } catch {
    return; // chrome:// pages, Web Store, PDF viewer etc. can't be captured
  }

  // The user may have switched tabs or navigated while the capture was in flight.
  const [still] = await chrome.tabs.query({ active: true, windowId });
  if (!still || still.id !== tab.id || still.url !== tab.url) return;

  const img = await shrink(dataUrl);
  if (img) await savePreview(tab.id, { img, url: tab.url, t: Date.now() });
}

// Downscale to at most THUMB_MAX px on the longest side. Decodes the data URL
// by hand rather than with the Fetch API, so the extension's CSP can forbid all
// network access (connect-src 'none').
async function shrink(dataUrl) {
  try {
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const bin = atob(dataUrl.slice(comma + 1));
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);

    const bmp = await createImageBitmap(new Blob([raw], { type: 'image/jpeg' }));
    const scale = Math.min(1, LIMITS.THUMB_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();

    const out = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 })).arrayBuffer());
    let s = '';
    for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode.apply(null, out.subarray(i, i + 0x8000));
    return PREVIEW_PREFIX + btoa(s);
  } catch {
    return null; // never store a full-size screenshot as a fallback
  }
}
