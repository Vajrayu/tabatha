// All state lives in chrome.storage.session: it survives the service worker
// being suspended, is kept in memory only (never written to disk), is wiped
// when the browser closes, and is readable only by extension pages - never by
// content scripts or websites (Chrome's default access level for this area).
//
// Values are still validated on every read. Nothing untrusted can write here
// today, but a bug elsewhere shouldn't be able to turn bad data into bad
// behaviour.

import { KEY, LIMITS, previewKey, PREVIEW_PREFIX, WINDOW_STATES, MODES } from './constants.js';

const S = chrome.storage.session;

// Every read-modify-write goes through one queue so concurrent events
// (e.g. onActivated + onRemoved firing together) can't lose updates.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

// ---------- validation ----------
const isId = (v) => Number.isInteger(v) && v >= 0;
const isTime = (v) => Number.isFinite(v) && v > 0;
const isUrl = (v) => typeof v === 'string' && v.length < 8192;
const isImage = (v) => typeof v === 'string' && v.startsWith(PREVIEW_PREFIX) && v.length < 4 * 1024 * 1024;
const isPreview = (p) => !!p && typeof p === 'object' && isImage(p.img) && isUrl(p.url) && isTime(p.t);

function cleanIndex(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, t] of Object.entries(v)) if (/^\d{1,12}$/.test(k) && isTime(t)) out[k] = t;
  }
  return out;
}

function cleanClosed(v) {
  const cutoff = Date.now() - LIMITS.CLOSED_PREVIEW_TTL_MS;
  return Array.isArray(v) ? v.filter((p) => isPreview(p) && p.t > cutoff).slice(0, LIMITS.MAX_CLOSED_PREVIEWS) : [];
}

// ---------- MRU ----------
export async function getMru() {
  const v = (await S.get(KEY.MRU))[KEY.MRU];
  return Array.isArray(v) ? v.filter(isId).slice(0, LIMITS.MAX_MRU) : [];
}
export function touchMru(tabId) {
  return serial(async () => {
    const mru = (await getMru()).filter((id) => id !== tabId);
    mru.unshift(tabId);
    await S.set({ [KEY.MRU]: mru.slice(0, LIMITS.MAX_MRU) });
  });
}
export function removeFromMru(tabId) {
  return serial(async () => {
    await S.set({ [KEY.MRU]: (await getMru()).filter((id) => id !== tabId) });
  });
}
export function replaceInMru(oldId, newId) {
  return serial(async () => {
    const mru = (await getMru()).filter((id) => id !== newId).map((id) => (id === oldId ? newId : id));
    await S.set({ [KEY.MRU]: mru });
  });
}
export function seedMru(tabIds) {
  return serial(async () => {
    if (!(await getMru()).length) await S.set({ [KEY.MRU]: tabIds.filter(isId) });
  });
}

// ---------- previews ----------
export async function getPreview(tabId) {
  const k = previewKey(tabId);
  const p = (await S.get(k))[k];
  return isPreview(p) ? p : null;
}

export async function getPreviews(tabIds) {
  const got = await S.get(tabIds.map(previewKey));
  const out = {};
  for (const id of tabIds) if (isPreview(got[previewKey(id)])) out[id] = got[previewKey(id)];
  return out;
}

export function savePreview(tabId, data) {
  if (!isId(tabId) || !isPreview(data)) return Promise.resolve();
  return serial(async () => {
    const idx = cleanIndex((await S.get(KEY.PREVIEW_INDEX))[KEY.PREVIEW_INDEX]);
    idx[tabId] = data.t;
    const byAge = Object.keys(idx).sort((a, b) => idx[b] - idx[a]);
    const evict = byAge.slice(LIMITS.MAX_PREVIEWS);
    evict.forEach((id) => delete idx[id]);
    if (evict.length) await S.remove(evict.map(previewKey));
    try {
      await S.set({ [previewKey(tabId)]: data, [KEY.PREVIEW_INDEX]: idx });
    } catch {
      // Quota exceeded: drop the older half, then try once more.
      const old = byAge.slice(Math.floor(byAge.length / 2)).filter((id) => id !== String(tabId));
      old.forEach((id) => delete idx[id]);
      await S.remove(old.map(previewKey));
      await S.set({ [previewKey(tabId)]: data, [KEY.PREVIEW_INDEX]: idx });
    }
  });
}

// Removes a tab's preview. If `keepAsClosed`, the image is kept for a while
// (keyed by URL) so the "Recently closed" section can still show it.
export function dropPreview(tabId, { keepAsClosed = false } = {}) {
  return serial(async () => {
    const k = previewKey(tabId);
    const got = await S.get([k, KEY.PREVIEW_INDEX, KEY.CLOSED_PREVIEWS]);
    const idx = cleanIndex(got[KEY.PREVIEW_INDEX]);
    delete idx[tabId];
    const writes = { [KEY.PREVIEW_INDEX]: idx };
    let closed = cleanClosed(got[KEY.CLOSED_PREVIEWS]);
    if (keepAsClosed && isPreview(got[k])) {
      closed = closed.filter((c) => c.url !== got[k].url);
      closed.unshift({ url: got[k].url, img: got[k].img, t: Date.now() });
    }
    writes[KEY.CLOSED_PREVIEWS] = closed.slice(0, LIMITS.MAX_CLOSED_PREVIEWS);
    await S.remove(k);
    await S.set(writes);
  });
}

export function movePreview(fromId, toId) {
  return serial(async () => {
    const from = previewKey(fromId);
    const got = await S.get([from, KEY.PREVIEW_INDEX]);
    if (!isPreview(got[from]) || !isId(toId)) return;
    const idx = cleanIndex(got[KEY.PREVIEW_INDEX]);
    idx[toId] = idx[fromId] || Date.now();
    delete idx[fromId];
    await S.set({ [previewKey(toId)]: got[from], [KEY.PREVIEW_INDEX]: idx });
    await S.remove(from);
  });
}

export async function getClosedPreviews() {
  return cleanClosed((await S.get(KEY.CLOSED_PREVIEWS))[KEY.CLOSED_PREVIEWS]);
}

// ---------- overlay bookkeeping ----------
// Stored (not kept in memory) so a restarted service worker still knows
// not to screenshot a tab that currently has the overlay on top of it.
export const setOverlayTab = (tabId) => S.set({ [KEY.OVERLAY]: { tabId, t: Date.now() } });
export const clearOverlayTab = () => S.remove(KEY.OVERLAY);
export async function isOverlayTab(tabId) {
  const o = (await S.get(KEY.OVERLAY))[KEY.OVERLAY];
  return !!o && o.tabId === tabId && isTime(o.t) && Date.now() - o.t < 10 * 60 * 1000;
}

// ---------- launch ----------
// The switcher page has to be web-accessible (it lives in an iframe on the
// page), so any site could try to load it. It only renders when it presents
// the one-time token the background created for this launch. All launch
// details are kept here, so the URL (which the page can see) holds nothing
// but that random token.
export async function createLaunch(ctx) {
  const token = crypto.randomUUID();
  await S.set({ [KEY.LAUNCH]: { token, t: Date.now(), ctx } });
  return token;
}

// Returns the launch context if `token` is the current, unexpired token, and
// invalidates it; otherwise null. A wrong token does not invalidate the real one.
export function consumeLaunch(token) {
  return serial(async () => {
    const l = (await S.get(KEY.LAUNCH))[KEY.LAUNCH];
    if (!l || typeof token !== 'string' || typeof l.token !== 'string' || l.token !== token) return null;
    await S.remove(KEY.LAUNCH);
    if (!isTime(l.t) || Date.now() - l.t > LIMITS.LAUNCH_TTL_MS || !l.ctx) return null;
    const c = l.ctx;
    if (!isId(c.src) || !isId(c.win)) return null;
    return Object.freeze({
      srcTab: c.src,
      srcWin: c.win,
      srcState: WINDOW_STATES.includes(c.state) ? c.state : 'normal',
      dir: c.dir === -1 ? -1 : 1,
      mode: MODES.includes(c.mode) ? c.mode : 'window',
    });
  });
}
