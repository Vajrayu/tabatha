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

import { KEY, LIMITS, previewKey, tabMetaKey, PREVIEW_PREFIX, WINDOW_STATES, MODES } from './constants.js';
import { normalizeUrl, isWorthReopening, cmpVersion } from './ext.js';
import { emptyReview } from './review.js';

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

// Same, but across contexts: the worker and the switcher page both write some
// keys, and Web Locks are shared by every page of the extension.
export function withLock(name, fn) {
  return navigator.locks ? navigator.locks.request('tabatha:' + name, fn) : serial(fn);
}

// ---------- validation ----------
const isId = (v) => Number.isInteger(v) && v >= 0;
const isTime = (v) => Number.isFinite(v) && v > 0;
const isImage = (v) => typeof v === 'string' && v.startsWith(PREVIEW_PREFIX) && v.length < 4 * 1024 * 1024;
const isPreview = (p) => !!p && typeof p === 'object' && isImage(p.img) && isTime(p.t);

// The preview index: { [normalizedUrl]: { t: capturedAt, n: imageLength, s: last time an open tab had this URL } }.
// `s` is optional on read (older entries): it then counts as `t`.
function cleanIndex(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, e] of Object.entries(v)) {
      if (k && k.length <= LIMITS.MAX_URL_KEY && e && isTime(e.t) && Number.isFinite(e.n) && e.n >= 0) out[k] = { t: e.t, n: e.n, s: isTime(e.s) ? e.s : e.t };
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

// Previews have no expiry on read: cleanupPreviews() is the only thing that
// deletes them, and it never touches a URL an open tab still has.
export async function getPreview(url) {
  const k = keyOf(url);
  if (!k) return null;
  const p = (await L.get(previewKey(k)))[previewKey(k)];
  return isPreview(p) ? p : null;
}

// Returns { [normalizedUrl]: { img, t } } for the URLs that have a preview.
// Look entries up with normalizeUrl(url).
export async function getPreviews(urls) {
  const keys = [...new Set(urls.map(keyOf).filter(Boolean))];
  if (!keys.length) return {};
  const got = await L.get(keys.map(previewKey));
  const out = {};
  for (const k of keys) {
    const p = got[previewKey(k)];
    if (isPreview(p)) out[k] = p;
  }
  return out;
}

// URLs that open tabs have right now (null if Chrome can't tell us). A preview
// for one of these is kept as long as the tab is open, however old it is.
// Starred pages count as open: their previews are kept even while no tab shows them.
async function openKeys() {
  try {
    const [tabs, stars] = await Promise.all([chrome.tabs.query({ windowType: 'normal' }), getStars()]);
    return new Set([...tabs.map((t) => keyOf(t.url || t.pendingUrl)).filter(Boolean), ...Object.keys(stars)]);
  } catch {
    return null;
  }
}

const seen = (e) => Math.max(e.t, e.s);

// Who goes first when over a cap: previews no open tab uses (oldest first),
// then previews open tabs use (oldest capture first). `keep` is never listed.
function evictionOrder(idx, open, keep) {
  const used = (k) => open.has(k);
  return Object.keys(idx)
    .filter((k) => k !== keep)
    .sort((a, b) => (used(a) - used(b)) || (used(a) ? idx[a].t - idx[b].t : seen(idx[a]) - seen(idx[b])));
}

const overCap = (idx) => {
  const keys = Object.keys(idx);
  return keys.length > LIMITS.MAX_PREVIEWS || keys.reduce((sum, k) => sum + idx[k].n, 0) > LIMITS.MAX_PREVIEW_BYTES;
};

// Keys to delete so the cache fits both caps.
function overflow(idx, open, keep) {
  let count = Object.keys(idx).length;
  let bytes = Object.keys(idx).reduce((sum, k) => sum + idx[k].n, 0);
  const out = [];
  for (const k of evictionOrder(idx, open, keep)) {
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
  const saved = serial(async () => {
    const idx = cleanIndex((await L.get(KEY.PREVIEW_INDEX))[KEY.PREVIEW_INDEX]);
    idx[k] = { t: data.t, n: data.img.length, s: Date.now() }; // a tab with this URL is open right now
    const open = overCap(idx) ? (await openKeys()) || new Set([k]) : new Set([k]);
    const evict = overflow(idx, open, k);
    evict.forEach((u) => delete idx[u]);
    if (evict.length) await L.remove(evict.map(previewKey));
    const write = () => L.set({ [previewKey(k)]: { img: data.img, t: data.t }, [KEY.PREVIEW_INDEX]: idx });
    try {
      await write();
    } catch {
      // Quota exceeded: drop the first half of the eviction order, then try once more.
      const order = evictionOrder(idx, (await openKeys()) || new Set(), k);
      const old = order.slice(0, Math.ceil(order.length / 2));
      old.forEach((u) => delete idx[u]);
      await L.remove(old.map(previewKey));
      await write();
    }
  });
  saved.then(maybeCleanup).catch(() => {});
  return saved;
}

// Delete previews that no open tab uses and that are older than 7 days (counted
// from the last capture or the last time an open tab had that URL), then trim
// to the count and size caps. Previews of open tabs are never expired.
export function cleanupPreviews() {
  return serial(async () => {
    const open = await openKeys();
    if (!open) return; // can't tell which previews are in use: don't delete anything
    const idx = cleanIndex((await L.get(KEY.PREVIEW_INDEX))[KEY.PREVIEW_INDEX]);
    const now = Date.now();
    for (const k of open) if (idx[k]) idx[k].s = now;
    const drop = Object.keys(idx).filter((k) => !open.has(k) && seen(idx[k]) <= now - LIMITS.PREVIEW_TTL_MS);
    drop.forEach((k) => delete idx[k]);
    const extra = overflow(idx, open, '');
    extra.forEach((k) => delete idx[k]);
    drop.push(...extra);
    if (drop.length) await L.remove(drop.map(previewKey));
    await L.set({ [KEY.PREVIEW_INDEX]: idx, [KEY.PREVIEW_CLEAN]: now });
  });
}

// Called after every saved preview (i.e. on tab switches): run the cleanup at
// most every 6 hours, and never in the first minute after the browser starts,
// when Chrome may still be restoring tabs (their URLs must count as "open").
let cleaning = false;
async function maybeCleanup() {
  if (cleaning) return;
  const [boot, last] = await Promise.all([S.get(KEY.BOOT_AT), L.get(KEY.PREVIEW_CLEAN)]);
  const now = Date.now();
  if (now - (boot[KEY.BOOT_AT] || 0) < LIMITS.CLEANUP_BOOT_DELAY_MS) return;
  if (now - (last[KEY.PREVIEW_CLEAN] || 0) < LIMITS.CLEANUP_EVERY_MS) return;
  cleaning = true;
  try { await cleanupPreviews(); } finally { cleaning = false; }
}
export const markBoot = () => S.set({ [KEY.BOOT_AT]: Date.now() });
// storage.session is empty at the start of every browser session (and after an extension
// update/reload), so the first worker start that finds no marker is the start of the session.
// This backs up runtime.onStartup, which doesn't fire for every way an extension gets loaded.
export async function ensureBoot() {
  if (!(await S.get(KEY.BOOT_AT))[KEY.BOOT_AT]) await markBoot();
}

// ---------- tabs Chrome has discarded (storage.session) ----------
// tab.discarded is also true for tabs Chrome restores lazily after a restart, which
// aren't "sleeping" in any useful sense. A tab is only shown as Sleeping if we saw
// Chrome discard it during this browser session; storage.session survives the
// service worker being suspended and is wiped on browser restart, like tab ids.
export async function getSlept() {
  const v = (await S.get(KEY.SLEPT))[KEY.SLEPT];
  return Array.isArray(v) ? v.filter(isId) : [];
}
export function markDiscarded(tabId, discarded) {
  if (!isId(tabId)) return Promise.resolve();
  return serial(async () => {
    const cur = await getSlept();
    const has = cur.includes(tabId);
    if (discarded === has) return;
    await S.set({ [KEY.SLEPT]: discarded ? [...cur, tabId].slice(-LIMITS.MAX_SLEPT) : cur.filter((id) => id !== tabId) });
  });
}
export function moveDiscarded(oldId, newId) {
  if (!isId(oldId) || !isId(newId)) return Promise.resolve();
  return serial(async () => {
    const cur = await getSlept();
    if (!cur.includes(oldId)) return;
    await S.set({ [KEY.SLEPT]: [...cur.filter((id) => id !== oldId && id !== newId), newId] });
  });
}

// ---------- closed-tab log (storage.local) ----------
// chrome.sessions only remembers the last 25 closed items, so we keep our own
// 7-day log. tabs.onRemoved doesn't say what the tab was, so we remember each
// open tab's url/title/icon in storage.session (memory only) as it changes,
// and move it into the log when the tab closes.
const isLoggableUrl = (u) => typeof u === 'string' && u.length <= LIMITS.MAX_URL_KEY && /^(https?|file|ftp|chrome):/.test(u);
const isClosedEntry = (e) => !!e && typeof e === 'object' && isLoggableUrl(e.url) && typeof e.title === 'string'
  && typeof e.favIconUrl === 'string' && isTime(e.closedAt);

function cleanLog(v) {
  const cutoff = Date.now() - LIMITS.CLOSED_LOG_TTL_MS;
  return Array.isArray(v) ? v.filter((e) => isClosedEntry(e) && e.closedAt > cutoff).slice(0, LIMITS.MAX_CLOSED_LOG) : [];
}

export async function getClosedLog() {
  return cleanLog((await L.get(KEY.CLOSED_LOG))[KEY.CLOSED_LOG]);
}

const lastMeta = new Map(); // tabId -> last JSON written, to skip repeat writes (lost on worker restart: harmless)
const metaOf = (tab) => {
  const url = (tab && (tab.url || tab.pendingUrl)) || '';
  if (!tab || !isId(tab.id) || tab.incognito || !isLoggableUrl(url) || !isWorthReopening(url)) return null;
  const icon = typeof tab.favIconUrl === 'string' && /^https?:/.test(tab.favIconUrl) && tab.favIconUrl.length <= 512 ? tab.favIconUrl : '';
  return { u: url, ti: String(tab.title || '').slice(0, 300), f: icon };
};

// Call whenever a tab's url, title or icon may have changed.
export function rememberTab(tab) {
  const m = metaOf(tab);
  if (!m) return Promise.resolve();
  const json = JSON.stringify(m);
  if (lastMeta.get(tab.id) === json) return Promise.resolve();
  lastMeta.set(tab.id, json);
  return serial(() => S.set({ [tabMetaKey(tab.id)]: m }));
}

export function rememberTabs(tabs) {
  const writes = {};
  for (const tab of tabs) {
    const m = metaOf(tab);
    if (m) { writes[tabMetaKey(tab.id)] = m; lastMeta.set(tab.id, JSON.stringify(m)); }
  }
  return serial(() => S.set(writes));
}

export function forgetTabMeta(tabId) {
  lastMeta.delete(tabId);
  return serial(() => S.remove(tabMetaKey(tabId)));
}

// A tab was closed: add it to the log (newest first, one entry per page).
export function logClosedTab(tabId) {
  lastMeta.delete(tabId);
  return serial(async () => {
    const k = tabMetaKey(tabId);
    const m = (await S.get(k))[k];
    if (!m) return; // never saw it (opened and closed instantly), or a blank/own page
    await S.remove(k);
    if (!m || typeof m !== 'object' || !isLoggableUrl(m.u)) return;
    const key = normalizeUrl(m.u);
    const log = cleanLog((await L.get(KEY.CLOSED_LOG))[KEY.CLOSED_LOG]).filter((e) => normalizeUrl(e.url) !== key);
    log.unshift({ url: m.u, title: typeof m.ti === 'string' ? m.ti : '', favIconUrl: typeof m.f === 'string' ? m.f : '', closedAt: Date.now() });
    await L.set({ [KEY.CLOSED_LOG]: log.slice(0, LIMITS.MAX_CLOSED_LOG) });
  });
}

// Run once at browser start and after install/update: drop entries older than 7 days, cap the size.
export function cleanupClosedLog() {
  return serial(async () => {
    const raw = (await L.get(KEY.CLOSED_LOG))[KEY.CLOSED_LOG];
    const log = cleanLog(raw);
    if (!Array.isArray(raw) || log.length !== raw.length) await L.set({ [KEY.CLOSED_LOG]: log });
  });
}

// ---------- review prompt counters (storage.local, this device only) ----------
const count = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
function cleanReview(v) {
  const e = emptyReview();
  if (!v || typeof v !== 'object') return e;
  return {
    since: isTime(v.since) ? v.since : e.since, opens: count(v.opens), soft: count(v.soft), lastSoft: count(v.lastSoft),
    asks: count(v.asks), lastAsk: count(v.lastAsk), done: v.done === true,
    day: typeof v.day === 'string' && v.day.length <= 12 ? v.day : '',
  };
}
export async function getReview() {
  return cleanReview((await L.get(KEY.REVIEW))[KEY.REVIEW]);
}
// `change` gets the current counters and returns the new ones.
export function updateReview(change) {
  return withLock('review', async () => {
    const next = cleanReview(change(await getReview()));
    await L.set({ [KEY.REVIEW]: next });
    return next;
  });
}

// ---------- first-run flags (storage.local) ----------
export async function getOnboard() {
  const v = (await L.get(KEY.ONBOARD))[KEY.ONBOARD];
  // cap: the Tabatha version in which the "capture previews" card was answered ('' = not yet)
  return { at: v && isTime(v.at) ? v.at : 0, flyout: !!(v && v.flyout), tour: !!(v && v.tour), cap: v && typeof v.cap === 'string' ? v.cap.slice(0, 20) : '' };
}
export function updateOnboard(patch) {
  return withLock('onboard', async () => {
    const next = { ...(await getOnboard()), ...patch };
    await L.set({ [KEY.ONBOARD]: next });
    return next;
  });
}

// ---------- window names (storage.session) ----------
// Names the user gave windows in the switcher. Memory only: Chrome gives windows new ids on restart, so a name lasts until
// Chrome quits. An empty name removes it (the window is "This window" / "Window N" again).
export async function getWinNames() {
  const v = (await S.get(KEY.WIN_NAMES))[KEY.WIN_NAMES];
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k, n] of Object.entries(v)) if (isId(+k) && typeof n === 'string' && n.trim()) out[k] = n.slice(0, 40);
  return out;
}
export function setWinName(id, name) {
  if (!isId(id)) return Promise.resolve();
  return serial(async () => {
    const cur = await getWinNames();
    const n = String(name || '').trim().slice(0, 40);
    if (n) cur[id] = n; else delete cur[id];
    await S.set({ [KEY.WIN_NAMES]: cur });
  });
}

// ---------- the update walkthrough (storage.local) ----------
// The version Tabatha was updated from, kept until the walkthrough for it has been shown. If Chrome
// updates Tabatha twice before it is opened, the older version is kept, so nothing is skipped.
const isVersion = (v) => typeof v === 'string' && /^\d+(\.\d+){0,3}$/.test(v);
export async function getWnFrom() {
  const v = (await L.get(KEY.WN_FROM))[KEY.WN_FROM];
  return isVersion(v) ? v : '';
}
export function noteUpdatedFrom(prev) {
  return withLock('wnfrom', async () => {
    if (!isVersion(prev)) return;
    const cur = await getWnFrom();
    if (!cur || cmpVersion(prev, cur) < 0) await L.set({ [KEY.WN_FROM]: prev });
  });
}
export const clearWnFrom = () => L.remove(KEY.WN_FROM);

// How many previews the last capture run took: the switcher that reopens afterwards says "Done: N previews." once.
export const setSwept = (n) => S.set({ [KEY.SWEPT]: { n: Math.max(0, n | 0), t: Date.now() } });
export async function takeSwept() {
  const v = (await S.get(KEY.SWEPT))[KEY.SWEPT];
  await S.remove(KEY.SWEPT);
  return v && Number.isInteger(v.n) && isTime(v.t) && Date.now() - v.t < 60 * 1000 ? v.n : null;
}

// ---------- stars (storage.local) ----------
// Pages the user starred, keyed by normalized URL (tab ids don't survive a restart).
// Not bookmarks: they live only in Tabatha, on this computer.
const isStar = (v) => !!v && typeof v === 'object' && typeof v.u === 'string' && v.u.length <= LIMITS.MAX_URL_KEY && isTime(v.t);
export async function getStars() {
  const v = (await L.get(KEY.STARS))[KEY.STARS];
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, e] of Object.entries(v)) if (k && isStar(e)) out[k] = { u: e.u, ti: String(e.ti || '').slice(0, 300), t: e.t };
  }
  return out;
}
// Star or unstar a page. Returns the new state (true = starred).
export function toggleStar(url, title) {
  const k = keyOf(url);
  if (!k) return Promise.resolve(false);
  return withLock('stars', async () => {
    const stars = await getStars();
    let on;
    if (stars[k]) { delete stars[k]; on = false; } else {
      stars[k] = { u: url, ti: String(title || '').slice(0, 300), t: Date.now() };
      on = true;
      const keys = Object.keys(stars).sort((a, b) => stars[b].t - stars[a].t);
      keys.slice(LIMITS.MAX_STARS).forEach((x) => delete stars[x]); // over the cap: the oldest stars go
    }
    await L.set({ [KEY.STARS]: stars });
    return on;
  });
}

// ---------- switcher layout (storage.local) ----------
export const SORTS = Object.freeze(['recent', 'newest', 'oldest', 'name']);
// How the open tabs are put into sections. Works together with the sort (which orders the tabs inside them).
export const GROUPINGS = Object.freeze(['groups', 'site', 'recent', 'none']);
export async function getView() {
  const v = (await L.get(KEY.VIEW))[KEY.VIEW] || {};
  // Before 1.3.5 "By site" was a sort: it is now a grouping, with the tabs sorted by recent use.
  const oldSite = v.sort === 'site' && !GROUPINGS.includes(v.group);
  return {
    sort: SORTS.includes(v.sort) ? v.sort : 'recent',
    group: oldSite ? 'site' : GROUPINGS.includes(v.group) ? v.group : 'groups',
    collapsed: Array.isArray(v.collapsed) ? v.collapsed.filter((x) => typeof x === 'string' && x.length <= 300).slice(0, LIMITS.MAX_COLLAPSED) : [],
    panel: typeof v.panel === 'boolean' ? v.panel : null, // the right panel: null = not chosen yet (open on wide screens)
    ptab: v.ptab === 'marks' ? 'marks' : 'groups',
    folder: typeof v.folder === 'string' && v.folder.length <= 40 ? v.folder : '', // last bookmark folder used
    gorder: Array.isArray(v.gorder) ? v.gorder.filter((x) => typeof x === 'string' && x.length <= 60).slice(0, 200) : [], // order of saved groups in the panel
  };
}
export function updateView(patch) {
  return withLock('view', async () => {
    const next = { ...(await getView()), ...patch };
    next.collapsed = next.collapsed.slice(-LIMITS.MAX_COLLAPSED);
    await L.set({ [KEY.VIEW]: next });
    return next;
  });
}

// ---------- settings (storage.local) ----------
export async function getPrefs() {
  const v = (await L.get(KEY.PREFS))[KEY.PREFS] || {};
  return { lang: ['auto', 'en', 'ru', 'es'].includes(v.lang) ? v.lang : 'auto', startup: v.startup === true };
}
export function updatePrefs(patch) {
  return withLock('prefs', async () => {
    const next = { ...(await getPrefs()), ...patch };
    await L.set({ [KEY.PREFS]: next });
    return next;
  });
}

// ---------- the "use Alt+Q" nudge (storage.local, this device only) ----------
export async function getNudge() {
  const v = (await L.get(KEY.NUDGE))[KEY.NUDGE] || {};
  return { day: typeof v.day === 'string' ? v.day : '', runs: count(v.runs), shown: count(v.shown), last: count(v.last), never: v.never === true };
}
export function updateNudge(change) {
  return withLock('nudge', async () => {
    const next = change(await getNudge());
    await L.set({ [KEY.NUDGE]: next });
    return next;
  });
}

// ---------- resume (storage.session) ----------
// Capturing one tab in the switcher's own window hides the page the switcher sits on, which closes
// it. The switcher leaves a note of what it was showing, and opens again where it was.
export const setResume = (r) => S.set({ [KEY.RESUME]: { ...r, t: Date.now() } });
export async function takeResume() {
  const r = (await S.get(KEY.RESUME))[KEY.RESUME];
  await S.remove(KEY.RESUME);
  // A note can ask to live longer (a capture run of many tabs), but never more than 10 minutes.
  const ttl = r && Number.isFinite(r.ttl) ? Math.min(Math.max(r.ttl, LIMITS.RESUME_TTL_MS), 10 * 60 * 1000) : LIMITS.RESUME_TTL_MS;
  return r && isTime(r.t) && Date.now() - r.t < ttl ? r : null;
}

// ---------- capture diagnostics (storage.session) ----------
// The last thing that happened when Tabatha tried to take a preview, so the switcher can say
// why one is missing ("Chrome blocked the screenshot: ..."). Memory only; never contains page content.
export async function noteCapture(stage, msg = '', url = '') {
  let host = '';
  try { host = new URL(url).host; } catch {}
  try { await S.set({ [KEY.CAPDIAG]: { t: Date.now(), stage, msg: String(msg), host } }); } catch {}
  // Pages Chrome never lets extensions screenshot (the Web Store, some built-in pages): remember them,
  // so the switcher stops offering "Capture preview" there. A later success forgets the page again.
  const k = url && normalizeUrl(url);
  if (!k) return;
  const blocked = stage === 'error' && /cannot be scripted|cannot access|extensions gallery|chrome:\/\/|edge:\/\//i.test(msg);
  if (!blocked && stage !== 'ok') return;
  try {
    await serial(async () => {
      const list = ((await S.get(KEY.NOCAP))[KEY.NOCAP] || []).filter((x) => typeof x === 'string' && x !== k);
      if (blocked) list.unshift(k);
      await S.set({ [KEY.NOCAP]: list.slice(0, 300) });
    });
  } catch {}
}
export async function getNoCapture() {
  const v = (await S.get(KEY.NOCAP))[KEY.NOCAP];
  return new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
}
export async function getCaptureNote() {
  const v = (await S.get(KEY.CAPDIAG))[KEY.CAPDIAG];
  return v && typeof v === 'object' && isTime(v.t) ? { t: v.t, stage: String(v.stage), msg: String(v.msg || ''), host: String(v.host || '') } : null;
}
// Sites where the overlay couldn't be shown clickable (a dark-mode filter, the page's own dialog on top):
// for the rest of this browser session Tabatha opens there as its own window straight away.
export async function isCovered(origin) {
  const v = (await S.get(KEY.COVERED))[KEY.COVERED];
  return Array.isArray(v) && v.includes(origin);
}
export function addCovered(origin) {
  if (typeof origin !== 'string' || !origin || origin === 'null') return Promise.resolve();
  return serial(async () => {
    const v = ((await S.get(KEY.COVERED))[KEY.COVERED] || []).filter((x) => typeof x === 'string' && x !== origin);
    await S.set({ [KEY.COVERED]: [origin, ...v].slice(0, 100) });
  });
}
export function setMru(ids) {
  return serial(() => S.set({ [KEY.MRU]: ids.filter(isId).slice(0, LIMITS.MAX_MRU) }));
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
      via: ['key', 'icon', 'startup', 'resume'].includes(c.via) ? c.via : 'key', // how it was opened ('resume': by Tabatha itself, after a capture run)
    });
  });
}
