// Two storage areas, on purpose:
//   - chrome.storage.session: MRU order, overlay flag, launch token. Kept in
//     memory only, wiped when the browser closes, readable only by extension
//     pages - never by content scripts or websites.
//   - chrome.storage.local: tab previews, keyed by normalized URL (tab IDs
//     don't survive a restart). Written to disk, kept 7 days, capped by count
//     and size. Images never leave the device: nothing here touches the network.
//
// Values are still validated on every read. Nothing untrusted can write here
// today, but a bug elsewhere shouldn't be able to turn bad data into bad
// behaviour.

import { KEY, LIMITS, previewKey, PREVIEW_PREFIX, WINDOW_STATES, MODES } from './constants.js';
import { normalizeUrl } from './ext.js';

const S = chrome.storage.session;
const L = chrome.storage.local;

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
const isImage = (v) => typeof v === 'string' && v.startsWith(PREVIEW_PREFIX) && v.length < 4 * 1024 * 1024;
const isPreview = (p) => !!p && typeof p === 'object' && isImage(p.img) && isTime(p.t);
const isFresh = (p) => Date.now() - p.t < LIMITS.PREVIEW_TTL_MS;

// The preview index: { [normalizedUrl]: { t: capturedAt, n: imageLength } }.
function cleanIndex(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, e] of Object.entries(v)) {
      if (k && k.length <= LIMITS.MAX_URL_KEY && e && isTime(e.t) && Number.isFinite(e.n) && e.n >= 0) out[k] = { t: e.t, n: e.n };
    }
  }
  return out;
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

// ---------- previews (storage.local, keyed by normalized URL) ----------
const keyOf = (url) => {
  const k = normalizeUrl(url);
  return k && k.length <= LIMITS.MAX_URL_KEY ? k : '';
};

export async function getPreview(url) {
  const k = keyOf(url);
  if (!k) return null;
  const p = (await L.get(previewKey(k)))[previewKey(k)];
  return isPreview(p) && isFresh(p) ? p : null;
}

// Returns { [normalizedUrl]: { img, t } } for the URLs that have a fresh
// preview. Look entries up with normalizeUrl(url).
export async function getPreviews(urls) {
  const keys = [...new Set(urls.map(keyOf).filter(Boolean))];
  if (!keys.length) return {};
  const got = await L.get(keys.map(previewKey));
  const out = {};
  for (const k of keys) {
    const p = got[previewKey(k)];
    if (isPreview(p) && isFresh(p)) out[k] = p;
  }
  return out;
}

// Keys to delete so the cache fits both caps, oldest first.
function overflow(idx) {
  const byAge = Object.keys(idx).sort((a, b) => idx[a].t - idx[b].t);
  let count = byAge.length;
  let bytes = byAge.reduce((sum, k) => sum + idx[k].n, 0);
  const out = [];
  for (const k of byAge) {
    if (count <= LIMITS.MAX_PREVIEWS && bytes <= LIMITS.MAX_PREVIEW_BYTES) break;
    out.push(k);
    count--;
    bytes -= idx[k].n;
  }
  return out;
}

export function savePreview(url, data) {
  const k = keyOf(url);
  if (!k || !isPreview(data)) return Promise.resolve();
  return serial(async () => {
    const idx = cleanIndex((await L.get(KEY.PREVIEW_INDEX))[KEY.PREVIEW_INDEX]);
    idx[k] = { t: data.t, n: data.img.length };
    const evict = overflow(idx);
    evict.forEach((u) => delete idx[u]);
    if (evict.length) await L.remove(evict.map(previewKey));
    const write = () => L.set({ [previewKey(k)]: { img: data.img, t: data.t }, [KEY.PREVIEW_INDEX]: idx });
    try {
      await write();
    } catch {
      // Quota exceeded: drop the older half, then try once more.
      const byAge = Object.keys(idx).filter((u) => u !== k).sort((a, b) => idx[a].t - idx[b].t);
      const old = byAge.slice(0, Math.ceil(byAge.length / 2));
      old.forEach((u) => delete idx[u]);
      await L.remove(old.map(previewKey));
      await write();
    }
  });
}

// Run once at browser start and after install/update (not on every write):
// delete previews older than 7 days, then trim to the count and size caps.
export function cleanupPreviews() {
  return serial(async () => {
    const idx = cleanIndex((await L.get(KEY.PREVIEW_INDEX))[KEY.PREVIEW_INDEX]);
    const cutoff = Date.now() - LIMITS.PREVIEW_TTL_MS;
    const drop = Object.keys(idx).filter((u) => idx[u].t <= cutoff);
    drop.forEach((u) => delete idx[u]);
    const extra = overflow(idx);
    extra.forEach((u) => delete idx[u]);
    drop.push(...extra);
    if (drop.length) await L.remove(drop.map(previewKey));
    await L.set({ [KEY.PREVIEW_INDEX]: idx });
  });
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
